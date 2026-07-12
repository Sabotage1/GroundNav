import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import express, { type NextFunction, type Request, type Response } from 'express'
import { WebSocketServer, type WebSocket } from 'ws'
import type { AssignmentInput, CardinalDirection, HoldingPoint, MapId, MapPoint, PushPreset, StartupPoint, VehiclePosition, VehicleType } from '../src/types'
import { addEvent, createAssignment, makeEvent, setClearance, transitionAssignment } from './domain'
import { StateStore } from './state'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = join(currentDir, '..')
const port = Number(process.env.PORT ?? 4173)
const host = process.env.HOST ?? '0.0.0.0'
const isProduction = process.env.NODE_ENV === 'production'
const store = new StateStore(join(rootDir, 'data', 'state.json'))
await store.init()

const app = express()
const httpServer = createServer(app)
const webSockets = new WebSocketServer({ server: httpServer, path: '/ws' })
const adminSessions = new Set<string>()
const sockets = new Map<WebSocket, { vehicleId?: string }>()

app.use(express.json({ limit: '1mb' }))
app.use((request, response, next) => {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token')
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  if (request.method === 'OPTIONS') return response.sendStatus(204)
  next()
})

function sendError(response: Response, error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : 'Request failed'
  response.status(status).json({ error: message })
}

function broadcast(state = store.snapshot()) {
  const payload = JSON.stringify({ type: 'state', state })
  for (const socket of webSockets.clients) {
    if (socket.readyState === socket.OPEN) socket.send(payload)
  }
}

async function mutate(response: Response, work: Parameters<StateStore['update']>[0]) {
  try {
    const { result, state } = await store.update(work)
    broadcast(state)
    response.json(result ?? state)
  } catch (error) {
    sendError(response, error)
  }
}

function requireAdmin(request: Request, response: Response, next: NextFunction) {
  const token = request.header('x-admin-token')
  if (!token || !adminSessions.has(token)) return response.status(401).json({ error: 'Admin session required' })
  next()
}

app.get('/api/health', (_request, response) => {
  const state = store.snapshot()
  response.json({ ok: true, revision: state.revision, vehicles: state.vehicles.length, updatedAt: state.lastUpdated })
})

app.get('/api/state', (_request, response) => response.json(store.snapshot()))

app.post('/api/admin/login', (request, response) => {
  const expected = process.env.ADMIN_PASSWORD ?? '1337'
  if (String(request.body?.password ?? '') !== expected) return response.status(401).json({ error: 'Incorrect test password' })
  const token = randomUUID()
  adminSessions.add(token)
  response.json({ token, expiresInMinutes: 120 })
})

app.post('/api/admin/logout', requireAdmin, (request, response) => {
  const token = request.header('x-admin-token')
  if (token) adminSessions.delete(token)
  response.json({ ok: true })
})

app.post('/api/vehicles/register', (request, response) => {
  const callsign = String(request.body?.callsign ?? '').trim().toUpperCase()
  const type = String(request.body?.type ?? 'operations') as VehicleType
  if (!callsign) return sendError(response, new Error('Callsign is required'))
  mutate(response, (state) => {
    const id = callsign.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || randomUUID()
    if (state.vehicles.some((vehicle) => vehicle.id === id || vehicle.callsign === callsign)) throw new Error('That vehicle already exists')
    const map: MapId = type === 'pushback' ? 'terminal' : 'airport'
    const vehicle = {
      id,
      callsign,
      type,
      operator: type === 'pushback' ? 'Ground Handling' : 'Airfield Operations',
      color: type === 'pushback' ? '#4fa8ff' : '#39d98a',
      status: 'available' as const,
      position: { map, x: 50, y: 50, heading: 0, speedKph: 0, source: 'simulated' as const },
      lastSeen: new Date().toISOString(),
      connected: true
    }
    state.vehicles.push(vehicle)
    addEvent(state, makeEvent({ level: 'success', title: `${callsign} registered`, detail: 'New vehicle added to the simulator fleet.', vehicleId: id }))
    return vehicle
  })
})

app.post('/api/vehicles/:vehicleId/heartbeat', (request, response) => {
  mutate(response, (state) => {
    const vehicle = state.vehicles.find((candidate) => candidate.id === request.params.vehicleId)
    if (!vehicle) throw new Error('Vehicle not found')
    vehicle.connected = true
    vehicle.lastSeen = new Date().toISOString()
    return { ok: true }
  })
})

app.post('/api/vehicles/:vehicleId/location', (request, response) => {
  mutate(response, (state) => {
    const vehicle = state.vehicles.find((candidate) => candidate.id === request.params.vehicleId)
    if (!vehicle) throw new Error('Vehicle not found')
    const position = request.body as VehiclePosition
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y) || position.x < 0 || position.x > 100 || position.y < 0 || position.y > 100) {
      throw new Error('Position must use normalized X/Y values between 0 and 100')
    }
    vehicle.position = {
      ...vehicle.position,
      ...position,
      x: Number(position.x),
      y: Number(position.y),
      heading: Number(position.heading ?? 0),
      speedKph: Number(position.speedKph ?? 0)
    }
    vehicle.lastSeen = new Date().toISOString()
    vehicle.connected = true
    return vehicle
  })
})

app.post('/api/assignments', (request, response) => {
  mutate(response, (state) => createAssignment(state, request.body as AssignmentInput))
})

app.post('/api/assignments/:assignmentId/action', (request, response) => {
  mutate(response, (state) => transitionAssignment(state, request.params.assignmentId, request.body?.action))
})

app.post('/api/assignments/:assignmentId/clearances/:holdingPointId', (request, response) => {
  mutate(response, (state) => setClearance(state, request.params.assignmentId, request.params.holdingPointId, request.body?.status))
})

app.post('/api/admin/holding-points', requireAdmin, (request, response) => {
  mutate(response, (state) => {
    const input = request.body as Partial<HoldingPoint>
    if (!input.name?.trim() || !input.runway?.trim()) throw new Error('Name and runway are required')
    if (!Number.isFinite(input.x) || !Number.isFinite(input.y)) throw new Error('Map coordinates are required')
    const point: HoldingPoint = {
      id: input.id ?? randomUUID(),
      name: input.name.trim(),
      runway: input.runway.trim(),
      x: Number(input.x),
      y: Number(input.y),
      mandatory: true,
      active: input.active ?? true,
      notes: input.notes?.trim()
    }
    const index = state.holdingPoints.findIndex((candidate) => candidate.id === point.id)
    if (index >= 0) state.holdingPoints[index] = point
    else state.holdingPoints.push(point)
    return point
  })
})

app.delete('/api/admin/holding-points/:id', requireAdmin, (request, response) => {
  mutate(response, (state) => {
    state.holdingPoints = state.holdingPoints.filter((point) => point.id !== request.params.id)
    return { ok: true }
  })
})

app.post('/api/admin/startup-points', requireAdmin, (request, response) => {
  mutate(response, (state) => {
    const input = request.body as Partial<StartupPoint>
    if (!input.name?.trim()) throw new Error('Startup point name is required')
    if (!Number.isFinite(input.x) || !Number.isFinite(input.y)) throw new Error('Map coordinates are required')
    if (!Array.isArray(input.directions) || input.directions.length === 0) throw new Error('Select at least one allowed direction')
    const point: StartupPoint = {
      id: input.id ?? randomUUID(),
      name: input.name.trim(),
      x: Number(input.x),
      y: Number(input.y),
      directions: input.directions as CardinalDirection[],
      active: input.active ?? true,
      notes: input.notes?.trim()
    }
    const index = state.startupPoints.findIndex((candidate) => candidate.id === point.id)
    if (index >= 0) state.startupPoints[index] = point
    else state.startupPoints.push(point)
    return point
  })
})

app.delete('/api/admin/startup-points/:id', requireAdmin, (request, response) => {
  mutate(response, (state) => {
    state.startupPoints = state.startupPoints.filter((point) => point.id !== request.params.id)
    state.pushPresets = state.pushPresets.filter((preset) => preset.startupPointId !== request.params.id)
    return { ok: true }
  })
})

app.post('/api/admin/push-presets', requireAdmin, (request, response) => {
  mutate(response, (state) => {
    const input = request.body as Partial<PushPreset>
    const route = (input.route ?? []) as MapPoint[]
    if (!input.name?.trim() || !input.startupPointId || !input.direction) throw new Error('Name, startup point and direction are required')
    if (route.length < 2) throw new Error('Click at least two map points to define the push route')
    const startupPoint = state.startupPoints.find((point) => point.id === input.startupPointId)
    if (!startupPoint) throw new Error('Startup point not found')
    if (!startupPoint.directions.includes(input.direction)) throw new Error('Direction is not permitted at this startup point')
    const preset: PushPreset = {
      id: input.id ?? randomUUID(),
      name: input.name.trim(),
      startupPointId: input.startupPointId,
      direction: input.direction,
      route,
      instruction: input.instruction?.trim() || `Push to startup point ${startupPoint.name}, face ${input.direction}.`,
      tugNotes: input.tugNotes?.trim()
    }
    const index = state.pushPresets.findIndex((candidate) => candidate.id === preset.id)
    if (index >= 0) state.pushPresets[index] = preset
    else state.pushPresets.push(preset)
    return preset
  })
})

app.delete('/api/admin/push-presets/:id', requireAdmin, (request, response) => {
  mutate(response, (state) => {
    state.pushPresets = state.pushPresets.filter((preset) => preset.id !== request.params.id)
    return { ok: true }
  })
})

app.post('/api/admin/reset', requireAdmin, async (_request, response) => {
  const state = await store.reset()
  broadcast(state)
  response.json(state)
})

webSockets.on('connection', (socket) => {
  sockets.set(socket, {})
  socket.send(JSON.stringify({ type: 'state', state: store.snapshot() }))
  socket.on('message', async (raw) => {
    try {
      const message = JSON.parse(String(raw))
      if (message.type !== 'identify' || !message.vehicleId) return
      sockets.set(socket, { vehicleId: message.vehicleId })
      const { state } = await store.update((current) => {
        const vehicle = current.vehicles.find((candidate) => candidate.id === message.vehicleId)
        if (vehicle) {
          vehicle.connected = true
          vehicle.lastSeen = new Date().toISOString()
        }
      })
      broadcast(state)
    } catch {
      socket.send(JSON.stringify({ type: 'error', error: 'Invalid socket message' }))
    }
  })
  socket.on('close', async () => {
    const identity = sockets.get(socket)
    sockets.delete(socket)
    if (!identity?.vehicleId) return
    const stillConnected = [...sockets.values()].some((candidate) => candidate.vehicleId === identity.vehicleId)
    if (stillConnected) return
    const { state } = await store.update((current) => {
      const vehicle = current.vehicles.find((candidate) => candidate.id === identity.vehicleId)
      if (vehicle) vehicle.connected = false
    })
    broadcast(state)
  })
})

if (isProduction) {
  app.use(express.static(join(rootDir, 'dist')))
  app.use((request, response, next) => {
    if (request.path.startsWith('/api/')) return next()
    response.sendFile(join(rootDir, 'dist', 'index.html'))
  })
} else {
  const { createServer: createViteServer } = await import('vite')
  const vite = await createViteServer({
    root: rootDir,
    server: { middlewareMode: true, hmr: { server: httpServer } },
    appType: 'spa'
  })
  app.use(vite.middlewares)
}

httpServer.listen(port, host, () => {
  console.log(`LLBG GroundNav ${isProduction ? 'production' : 'development'} server`)
  console.log(`Local:   http://localhost:${port}`)
  console.log(`Network: http://<this-mac-ip>:${port}`)
})
