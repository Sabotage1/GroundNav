import { randomUUID } from 'node:crypto'
import type {
  AppState,
  Assignment,
  AssignmentInput,
  AssignmentStatus,
  HoldingPoint,
  MapPoint,
  OperationsEvent,
  VehicleStatus
} from '../src/types'

const terminalStatuses: AssignmentStatus[] = ['completed', 'cancelled']

function distanceToSegment(point: MapPoint, start: MapPoint, end: MapPoint) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y)
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)))
  const nearestX = start.x + t * dx
  const nearestY = start.y + t * dy
  return Math.hypot(point.x - nearestX, point.y - nearestY)
}

export function holdingPointsAlongRoute(route: MapPoint[], holdingPoints: HoldingPoint[], threshold = 2.5) {
  if (route.length < 2) return []
  return holdingPoints.filter((holdingPoint) => {
    if (!holdingPoint.active || !holdingPoint.mandatory) return false
    for (let index = 1; index < route.length; index += 1) {
      if (distanceToSegment(holdingPoint, route[index - 1], route[index]) <= threshold) return true
    }
    return false
  })
}

function crossingRouteIndex(route: MapPoint[], holdingPoint: HoldingPoint) {
  let bestIndex = 1
  let bestDistance = Number.POSITIVE_INFINITY
  for (let index = 1; index < route.length; index += 1) {
    const distance = distanceToSegment(holdingPoint, route[index - 1], route[index])
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  }
  return bestIndex
}

export function vehicleStatusForAssignment(status: AssignmentStatus): VehicleStatus {
  switch (status) {
    case 'sent':
    case 'acknowledged':
      return 'assigned'
    case 'in_progress':
      return 'moving'
    case 'holding':
      return 'holding'
    case 'cancelled':
    case 'completed':
      return 'available'
  }
}

export function makeEvent(input: Omit<OperationsEvent, 'id' | 'time'>): OperationsEvent {
  return { ...input, id: randomUUID(), time: new Date().toISOString() }
}

export function addEvent(state: AppState, event: OperationsEvent) {
  state.events = [event, ...state.events].slice(0, 200)
}

export function createAssignment(state: AppState, input: AssignmentInput): Assignment {
  const vehicle = state.vehicles.find((candidate) => candidate.id === input.vehicleId)
  if (!vehicle) throw new Error('Vehicle not found')
  if (input.kind !== 'stop' && input.route.length === 0) throw new Error('Add at least one route point')
  if (input.kind === 'pushback' && !input.pushback) throw new Error('Pushback details are required')

  const createdAt = new Date().toISOString()
  const clearances = input.map === 'airport'
    ? holdingPointsAlongRoute(input.route, state.holdingPoints).map((point) => ({
        holdingPointId: point.id,
        status: 'required' as const,
        routeIndex: crossingRouteIndex(input.route, point),
        updatedAt: createdAt
      }))
    : []

  for (const existing of state.assignments) {
    if (existing.vehicleId === input.vehicleId && !terminalStatuses.includes(existing.status)) {
      existing.status = 'cancelled'
      existing.updatedAt = createdAt
    }
  }

  const assignment: Assignment = {
    id: randomUUID(),
    vehicleId: input.vehicleId,
    kind: input.kind,
    map: input.map,
    title: input.title.trim(),
    instruction: input.instruction.trim(),
    route: input.route.map((point) => ({ ...point })),
    status: 'sent',
    priority: input.priority ?? 'routine',
    createdAt,
    updatedAt: createdAt,
    currentWaypoint: 0,
    clearances,
    pushback: input.pushback
  }

  state.assignments.unshift(assignment)
  vehicle.status = input.kind === 'stop' ? 'stopped' : 'assigned'
  addEvent(state, makeEvent({
    level: input.kind === 'stop' ? 'critical' : 'info',
    title: input.kind === 'stop' ? `STOP sent to ${vehicle.callsign}` : `Instruction sent to ${vehicle.callsign}`,
    detail: assignment.title,
    vehicleId: vehicle.id,
    assignmentId: assignment.id
  }))
  return assignment
}

export type AssignmentAction = 'acknowledge' | 'start' | 'hold' | 'resume' | 'next_waypoint' | 'complete' | 'cancel'

const allowedActions: Record<AssignmentAction, AssignmentStatus[]> = {
  acknowledge: ['sent'],
  start: ['acknowledged'],
  hold: ['acknowledged', 'in_progress'],
  resume: ['holding'],
  next_waypoint: ['in_progress'],
  complete: ['acknowledged', 'in_progress', 'holding'],
  cancel: ['sent', 'acknowledged', 'in_progress', 'holding']
}

export function transitionAssignment(state: AppState, assignmentId: string, action: AssignmentAction) {
  const assignment = state.assignments.find((candidate) => candidate.id === assignmentId)
  if (!assignment) throw new Error('Assignment not found')
  if (!allowedActions[action].includes(assignment.status)) {
    throw new Error(`Cannot ${action.replace('_', ' ')} an assignment that is ${assignment.status.replace('_', ' ')}`)
  }

  const vehicle = state.vehicles.find((candidate) => candidate.id === assignment.vehicleId)
  if (!vehicle) throw new Error('Vehicle not found')
  const updatedAt = new Date().toISOString()

  if (action === 'acknowledge') {
    assignment.status = 'acknowledged'
    assignment.acknowledgedAt = updatedAt
  } else if (action === 'start') {
    assignment.status = 'in_progress'
    assignment.startedAt = updatedAt
  } else if (action === 'hold') {
    assignment.status = 'holding'
  } else if (action === 'resume') {
    assignment.status = 'in_progress'
  } else if (action === 'next_waypoint') {
    const nextWaypoint = Math.min(assignment.currentWaypoint + 1, Math.max(0, assignment.route.length - 1))
    const lockedClearance = assignment.clearances.find(
      (clearance) => ['required', 'requested'].includes(clearance.status) && (clearance.routeIndex ?? 1) <= nextWaypoint
    )
    if (lockedClearance) throw new Error('Tower authorization is required before continuing beyond the holding point')
    assignment.currentWaypoint = nextWaypoint
    const waypoint = assignment.route[assignment.currentWaypoint]
    if (waypoint) {
      vehicle.position = {
        ...vehicle.position,
        map: assignment.map,
        x: waypoint.x,
        y: waypoint.y,
        speedKph: 8,
        source: 'simulated'
      }
      vehicle.lastSeen = updatedAt
    }
  } else if (action === 'complete') {
    assignment.status = 'completed'
    assignment.completedAt = updatedAt
  } else if (action === 'cancel') {
    assignment.status = 'cancelled'
  }

  assignment.updatedAt = updatedAt
  vehicle.status = assignment.kind === 'stop' && !terminalStatuses.includes(assignment.status)
    ? 'stopped'
    : vehicleStatusForAssignment(assignment.status)
  addEvent(state, makeEvent({
    level: action === 'complete' ? 'success' : action === 'hold' ? 'warning' : 'info',
    title: `${vehicle.callsign}: ${action.replace('_', ' ')}`,
    detail: assignment.title,
    vehicleId: vehicle.id,
    assignmentId: assignment.id
  }))
  return assignment
}

export function setClearance(
  state: AppState,
  assignmentId: string,
  holdingPointId: string,
  status: 'requested' | 'authorized' | 'crossed' | 'required'
) {
  const assignment = state.assignments.find((candidate) => candidate.id === assignmentId)
  if (!assignment) throw new Error('Assignment not found')
  const clearance = assignment.clearances.find((candidate) => candidate.holdingPointId === holdingPointId)
  if (!clearance) throw new Error('This holding point is not part of the assigned route')
  if (status === 'authorized' && clearance.status !== 'requested' && clearance.status !== 'required') {
    throw new Error('Clearance is not awaiting tower action')
  }
  if (status === 'crossed' && clearance.status !== 'authorized') {
    throw new Error('Crossing has not been authorized')
  }
  clearance.status = status
  clearance.updatedAt = new Date().toISOString()
  assignment.updatedAt = clearance.updatedAt
  const point = state.holdingPoints.find((candidate) => candidate.id === holdingPointId)
  const vehicle = state.vehicles.find((candidate) => candidate.id === assignment.vehicleId)
  addEvent(state, makeEvent({
    level: status === 'authorized' ? 'success' : status === 'requested' ? 'warning' : 'info',
    title: `${vehicle?.callsign ?? 'Vehicle'}: crossing ${status}`,
    detail: point ? `${point.name} — ${point.runway}` : holdingPointId,
    vehicleId: assignment.vehicleId,
    assignmentId
  }))
  return assignment
}

export function touchState(state: AppState) {
  state.revision += 1
  state.lastUpdated = new Date().toISOString()
}
