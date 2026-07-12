import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import type { AppState } from '../types'
import { apiFetch, groundNavWebSocketUrl, type ApiFetchOptions } from '../lib/api'

export type ConnectionStatus = 'connecting' | 'live' | 'offline'

export type AppStateMutation = <TResponse = unknown, TBody = unknown>(
  path: string,
  body?: TBody,
  options?: Omit<ApiFetchOptions<TBody>, 'body'>
) => Promise<TResponse>

export interface AppStateContextValue {
  state: AppState | null
  connection: ConnectionStatus
  refresh: () => Promise<AppState>
  mutate: AppStateMutation
  identifyVehicle: (vehicleId?: string) => void
}

type StateSocketMessage = {
  type: 'state'
  state: AppState
}

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined)

function isAppState(value: unknown): value is AppState {
  if (!value || typeof value !== 'object') return false
  const state = value as Partial<AppState>
  return (
    typeof state.revision === 'number' &&
    typeof state.lastUpdated === 'string' &&
    Array.isArray(state.vehicles) &&
    Array.isArray(state.assignments) &&
    Array.isArray(state.holdingPoints) &&
    Array.isArray(state.startupPoints) &&
    Array.isArray(state.pushPresets) &&
    Array.isArray(state.events)
  )
}

function isStateSocketMessage(value: unknown): value is StateSocketMessage {
  if (!value || typeof value !== 'object') return false
  const message = value as { type?: unknown; state?: unknown }
  return message.type === 'state' && isAppState(message.state)
}

export function AppStateProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AppState | null>(null)
  const [connection, setConnection] = useState<ConnectionStatus>('connecting')
  const socketRef = useRef<WebSocket | null>(null)
  const identifiedVehicleRef = useRef<string | undefined>(undefined)

  const applySnapshot = useCallback((snapshot: AppState) => {
    setState((current) => (!current || snapshot.revision >= current.revision ? snapshot : current))
  }, [])

  const refresh = useCallback(async () => {
    const snapshot = await apiFetch<AppState>('/api/state')
    if (!isAppState(snapshot)) throw new Error('GroundNav server returned an invalid state snapshot')
    applySnapshot(snapshot)
    return snapshot
  }, [applySnapshot])

  const mutate = useCallback(
    async <TResponse = unknown, TBody = unknown,>(
      path: string,
      body?: TBody,
      options: Omit<ApiFetchOptions<TBody>, 'body'> = {}
    ): Promise<TResponse> => {
      const result = await apiFetch<TResponse, TBody>(path, {
        method: 'POST',
        ...options,
        body
      })

      // Mutations are also broadcast by the server. Refreshing keeps clients
      // correct when a WebSocket is temporarily unavailable, but a refresh
      // failure must not turn a successfully committed mutation into an error.
      try {
        await refresh()
      } catch {
        // The reconnect loop or the next manual refresh will resynchronize.
      }
      return result
    },
    [refresh]
  )

  const identifyVehicle = useCallback((vehicleId?: string) => {
    const normalizedId = vehicleId?.trim() || undefined
    const previousId = identifiedVehicleRef.current
    identifiedVehicleRef.current = normalizedId

    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    if (previousId && previousId !== normalizedId) {
      // Closing first lets the server mark the previous vehicle offline before
      // the reconnect identifies this socket as the new vehicle.
      socket.close(1000, normalizedId ? 'Vehicle identity changed' : 'Vehicle identity cleared')
    } else if (normalizedId) {
      socket.send(JSON.stringify({ type: 'identify', vehicleId: normalizedId }))
    }
  }, [])

  useEffect(() => {
    let disposed = false
    let retryAttempt = 0
    let retryTimer: ReturnType<typeof setTimeout> | undefined

    const clearRetry = () => {
      if (retryTimer !== undefined) clearTimeout(retryTimer)
      retryTimer = undefined
    }

    const scheduleReconnect = (connect: () => void) => {
      if (disposed || (typeof navigator !== 'undefined' && !navigator.onLine)) return
      clearRetry()
      const exponentialDelay = Math.min(10_000, 500 * 2 ** retryAttempt)
      const jitter = Math.round(exponentialDelay * Math.random() * 0.2)
      retryAttempt += 1
      retryTimer = setTimeout(connect, exponentialDelay + jitter)
    }

    const connect = () => {
      if (disposed || (typeof navigator !== 'undefined' && !navigator.onLine)) return
      const existingSocket = socketRef.current
      if (
        existingSocket &&
        (existingSocket.readyState === WebSocket.CONNECTING || existingSocket.readyState === WebSocket.OPEN)
      ) {
        return
      }

      setConnection('connecting')
      let socket: WebSocket
      try {
        socket = new WebSocket(groundNavWebSocketUrl())
      } catch {
        setConnection('offline')
        scheduleReconnect(connect)
        return
      }
      socketRef.current = socket

      socket.addEventListener('open', () => {
        if (disposed || socketRef.current !== socket) return
        retryAttempt = 0
        setConnection('live')
        const vehicleId = identifiedVehicleRef.current
        if (vehicleId) socket.send(JSON.stringify({ type: 'identify', vehicleId }))
      })

      socket.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(String(event.data)) as unknown
          if (isStateSocketMessage(message)) applySnapshot(message.state)
        } catch {
          // Ignore a malformed frame and keep the last verified snapshot.
        }
      })

      socket.addEventListener('error', () => {
        socket.close()
      })

      socket.addEventListener('close', () => {
        if (socketRef.current === socket) socketRef.current = null
        if (disposed) return
        setConnection('offline')
        scheduleReconnect(connect)
      })
    }

    const handleOffline = () => {
      clearRetry()
      setConnection('offline')
      socketRef.current?.close()
    }

    const handleOnline = () => {
      clearRetry()
      void refresh().catch(() => undefined)
      connect()
    }

    // The HTTP snapshot makes the UI usable if the first WebSocket frame is
    // delayed or WebSockets are blocked on the current network.
    void refresh().catch(() => {
      if (!disposed && socketRef.current?.readyState !== WebSocket.OPEN) setConnection('offline')
    })
    connect()
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      disposed = true
      clearRetry()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      const socket = socketRef.current
      socketRef.current = null
      socket?.close(1000, 'Provider unmounted')
    }
  }, [applySnapshot, refresh])

  const value = useMemo<AppStateContextValue>(
    () => ({ state, connection, refresh, mutate, identifyVehicle }),
    [connection, identifyVehicle, mutate, refresh, state]
  )

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

// The hook intentionally lives beside its provider so consumers have one
// stable import for this context.
// eslint-disable-next-line react-refresh/only-export-components
export function useAppState() {
  const context = useContext(AppStateContext)
  if (!context) throw new Error('useAppState must be used within an AppStateProvider')
  return context
}
