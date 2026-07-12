const buildConfiguredServer = String(import.meta.env.VITE_GROUNDNAV_SERVER ?? '').trim().replace(/\/+$/, '')
// Versioned so a stale Wi-Fi address saved by an older APK cannot override a
// newly compiled LAN default after the app is upgraded.
const serverStorageKey = 'groundnav.serverOrigin.v2'

/**
 * The optional HTTP(S) origin of the GroundNav server. An empty value keeps
 * requests on the current origin, which is the normal browser/dev setup.
 */
export const GROUNDNAV_SERVER = buildConfiguredServer

export function configuredGroundNavServer() {
  if (typeof window !== 'undefined') {
    const override = window.localStorage.getItem(serverStorageKey)?.trim().replace(/\/+$/, '')
    if (override) return override
  }
  return buildConfiguredServer
}

export function setGroundNavServer(origin: string) {
  const normalized = origin.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(normalized)) throw new Error('Enter a complete server address beginning with http:// or https://')
  new URL(normalized)
  window.localStorage.setItem(serverStorageKey, normalized)
  return normalized
}

export function clearGroundNavServer() {
  window.localStorage.removeItem(serverStorageKey)
}

export type ApiFetchOptions<TBody = unknown> = Omit<RequestInit, 'body'> & {
  body?: TBody | BodyInit | null
}

export class GroundNavApiError extends Error {
  readonly status: number
  readonly statusText: string
  readonly url: string
  readonly details: unknown

  constructor(input: {
    message: string
    status: number
    statusText?: string
    url: string
    details?: unknown
    cause?: unknown
  }) {
    super(input.message, input.cause === undefined ? undefined : { cause: input.cause })
    this.name = 'GroundNavApiError'
    this.status = input.status
    this.statusText = input.statusText ?? ''
    this.url = input.url
    this.details = input.details
  }
}

function withLeadingSlash(path: string) {
  return path.startsWith('/') ? path : `/${path}`
}

export function groundNavUrl(path: string) {
  const normalizedPath = withLeadingSlash(path)
  const server = configuredGroundNavServer()
  return server ? `${server}${normalizedPath}` : normalizedPath
}

export function groundNavWebSocketUrl(path = '/ws') {
  const base = configuredGroundNavServer() || (typeof window !== 'undefined' ? window.location.origin : '')
  if (!base) throw new Error('Set VITE_GROUNDNAV_SERVER before opening a GroundNav WebSocket')

  const url = new URL(withLeadingSlash(path), `${base.replace(/\/+$/, '')}/`)
  if (url.protocol === 'https:') url.protocol = 'wss:'
  else if (url.protocol === 'http:') url.protocol = 'ws:'
  else {
    throw new Error(
      `GroundNav WebSocket requires an HTTP(S) server origin; received ${url.protocol || 'an invalid URL'}. ` +
        'Set VITE_GROUNDNAV_SERVER to the Mac server URL.'
    )
  }
  return url.toString()
}

function isNativeBody(value: unknown): value is BodyInit {
  if (typeof value === 'string') return true
  if (typeof Blob !== 'undefined' && value instanceof Blob) return true
  if (typeof FormData !== 'undefined' && value instanceof FormData) return true
  if (typeof URLSearchParams !== 'undefined' && value instanceof URLSearchParams) return true
  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) return true
  if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(value)) return true
  if (typeof ReadableStream !== 'undefined' && value instanceof ReadableStream) return true
  return false
}

function errorMessage(payload: unknown, response: Response) {
  if (payload && typeof payload === 'object') {
    const candidate = payload as { error?: unknown; message?: unknown }
    if (typeof candidate.error === 'string' && candidate.error.trim()) return candidate.error
    if (typeof candidate.message === 'string' && candidate.message.trim()) return candidate.message
  }
  if (typeof payload === 'string' && payload.trim()) return payload
  return `${response.status} ${response.statusText || 'Request failed'}`
}

async function readResponse(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined
  const text = await response.text()
  if (!text) return undefined

  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text) as unknown
    } catch {
      return text
    }
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

/** Fetch JSON from the GroundNav server and surface server/network failures. */
export async function apiFetch<TResponse, TBody = unknown>(
  path: string,
  options: ApiFetchOptions<TBody> = {}
): Promise<TResponse> {
  const url = groundNavUrl(path)
  const { body, headers: suppliedHeaders, ...requestOptions } = options
  const headers = new Headers(suppliedHeaders)
  headers.set('Accept', 'application/json')

  let requestBody: BodyInit | null | undefined
  if (body !== undefined && body !== null) {
    if (isNativeBody(body)) {
      requestBody = body
      if (typeof body === 'string' && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json')
      }
    } else {
      requestBody = JSON.stringify(body)
      if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
    }
  } else {
    requestBody = body === null ? null : undefined
  }

  let response: Response
  try {
    response = await fetch(url, {
      credentials: 'same-origin',
      ...requestOptions,
      headers,
      body: requestBody
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new GroundNavApiError({
      message: `Unable to reach the GroundNav server at ${url}`,
      status: 0,
      url,
      details: error,
      cause: error
    })
  }

  const payload = await readResponse(response)
  if (!response.ok) {
    throw new GroundNavApiError({
      message: errorMessage(payload, response),
      status: response.status,
      statusText: response.statusText,
      url,
      details: payload
    })
  }

  return payload as TResponse
}
