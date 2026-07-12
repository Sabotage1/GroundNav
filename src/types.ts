export type MapId = 'airport' | 'terminal'

export interface MapPoint {
  x: number
  y: number
  label?: string
}

export type VehicleType = 'operations' | 'pushback' | 'maintenance' | 'fire'
export type VehicleStatus = 'available' | 'assigned' | 'moving' | 'holding' | 'stopped' | 'offline'
export type PositionSource = 'simulated' | 'gps' | 'tower'

export interface VehiclePosition extends MapPoint {
  map: MapId
  heading: number
  speedKph: number
  source: PositionSource
  accuracyM?: number
}

export interface Vehicle {
  id: string
  callsign: string
  type: VehicleType
  operator: string
  color: string
  status: VehicleStatus
  position: VehiclePosition
  lastSeen: string
  connected: boolean
}

export type CardinalDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'

export interface HoldingPoint extends MapPoint {
  id: string
  name: string
  runway: string
  mandatory: boolean
  active: boolean
  needsReview?: boolean
  notes?: string
}

export interface StartupPoint extends MapPoint {
  id: string
  name: string
  directions: CardinalDirection[]
  active: boolean
  notes?: string
}

export interface PushPreset {
  id: string
  name: string
  startupPointId: string
  direction: CardinalDirection
  route: MapPoint[]
  instruction: string
  tugNotes?: string
}

export type AssignmentKind = 'route' | 'stop' | 'hold' | 'pushback'
export type AssignmentStatus =
  | 'sent'
  | 'acknowledged'
  | 'in_progress'
  | 'holding'
  | 'completed'
  | 'cancelled'

export type ClearanceStatus = 'required' | 'requested' | 'authorized' | 'crossed'

export interface HoldClearance {
  holdingPointId: string
  status: ClearanceStatus
  routeIndex?: number
  updatedAt: string
}

export interface PushbackDetails {
  aircraftCallsign: string
  aircraftStand: string
  startupPointId: string
  direction: CardinalDirection
  presetId?: string
}

export interface Assignment {
  id: string
  vehicleId: string
  kind: AssignmentKind
  map: MapId
  title: string
  instruction: string
  route: MapPoint[]
  status: AssignmentStatus
  priority: 'routine' | 'priority' | 'emergency'
  createdAt: string
  updatedAt: string
  acknowledgedAt?: string
  startedAt?: string
  completedAt?: string
  currentWaypoint: number
  clearances: HoldClearance[]
  pushback?: PushbackDetails
}

export type EventLevel = 'info' | 'success' | 'warning' | 'critical'

export interface OperationsEvent {
  id: string
  time: string
  level: EventLevel
  title: string
  detail: string
  vehicleId?: string
  assignmentId?: string
}

export interface AppState {
  revision: number
  lastUpdated: string
  vehicles: Vehicle[]
  assignments: Assignment[]
  holdingPoints: HoldingPoint[]
  startupPoints: StartupPoint[]
  pushPresets: PushPreset[]
  events: OperationsEvent[]
}

export interface AssignmentInput {
  vehicleId: string
  kind: AssignmentKind
  map: MapId
  title: string
  instruction: string
  route: MapPoint[]
  priority?: Assignment['priority']
  pushback?: PushbackDetails
}

export interface ApiError {
  error: string
}
