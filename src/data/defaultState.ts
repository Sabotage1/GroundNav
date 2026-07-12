import type { AppState, HoldingPoint, PushPreset, StartupPoint, Vehicle } from '../types'

const now = new Date().toISOString()

export const defaultVehicles: Vehicle[] = [
  {
    id: 'ops-21',
    callsign: 'OPS 21',
    type: 'operations',
    operator: 'Airfield Operations',
    color: '#39d98a',
    status: 'available',
    position: { map: 'airport', x: 45.2, y: 57.6, heading: 40, speedKph: 0, source: 'simulated' },
    lastSeen: now,
    connected: false
  },
  {
    id: 'follow-me-3',
    callsign: 'FOLLOW ME 3',
    type: 'operations',
    operator: 'Apron Control',
    color: '#f8c451',
    status: 'available',
    position: { map: 'airport', x: 64.5, y: 68.4, heading: 310, speedKph: 0, source: 'simulated' },
    lastSeen: now,
    connected: false
  },
  {
    id: 'tug-7',
    callsign: 'TUG 7',
    type: 'pushback',
    operator: 'Ground Handling',
    color: '#4fa8ff',
    status: 'available',
    position: { map: 'terminal', x: 46.2, y: 60.4, heading: 0, speedKph: 0, source: 'simulated' },
    lastSeen: now,
    connected: false
  },
  {
    id: 'tug-12',
    callsign: 'TUG 12',
    type: 'pushback',
    operator: 'Ground Handling',
    color: '#9e8cff',
    status: 'available',
    position: { map: 'terminal', x: 68.2, y: 57.5, heading: 180, speedKph: 0, source: 'simulated' },
    lastSeen: now,
    connected: false
  },
  {
    id: 'fire-1',
    callsign: 'RESCUE 1',
    type: 'fire',
    operator: 'Airport Fire Service',
    color: '#ff625f',
    status: 'available',
    position: { map: 'airport', x: 71.5, y: 70.8, heading: 215, speedKph: 0, source: 'simulated' },
    lastSeen: now,
    connected: false
  }
]

// Normalized positions are based on the supplied LLBG airport chart. These are
// simulator defaults and are intentionally editable from the admin screen.
export const defaultHoldingPoints: HoldingPoint[] = [
  { id: 'H01', name: 'H01 · Apron Q', runway: '08/26', x: 86.09, y: 10.78, mandatory: true, active: true },
  { id: 'H02', name: 'H02 · E1', runway: '08/26', x: 86.96, y: 14.46, mandatory: true, active: true },
  { id: 'H03', name: 'H03 · T1 northeast', runway: '03/21', x: 91.0, y: 16.76, mandatory: true, active: true },
  { id: 'H04', name: 'H04 · W1', runway: '08/26', x: 74.49, y: 18.57, mandatory: true, active: true },
  { id: 'H05', name: 'H05 · E', runway: '03/21', x: 83.23, y: 18.98, mandatory: true, active: true },
  { id: 'H06', name: 'H06 · W2', runway: '08/26', x: 72.44, y: 19.05, mandatory: true, active: true },
  { id: 'H07', name: 'H07 · W3', runway: '08/26', x: 59.51, y: 23.02, mandatory: true, active: true },
  { id: 'H08', name: 'H08 · W4 north', runway: '12/30', x: 34.25, y: 28.51, mandatory: true, active: true },
  { id: 'H09', name: 'H09 · W4 south', runway: '12/30', x: 33.33, y: 30.6, mandatory: true, active: true },
  { id: 'H10', name: 'H10 · K west', runway: '08/26', x: 24.03, y: 32.55, mandatory: true, active: true },
  { id: 'H11', name: 'H11 · W4/K', runway: '12/30', x: 31.39, y: 34.77, mandatory: true, active: true },
  { id: 'H12', name: 'H12 · S west', runway: '08/26', x: 16.67, y: 35.95, mandatory: true, active: true },
  { id: 'H13', name: 'H13 · K/Z junction', runway: '12/30', x: 33.13, y: 37.62, mandatory: true, active: true, needsReview: true },
  { id: 'H14', name: 'H14 · T east', runway: '03/21', x: 85.28, y: 39.08, mandatory: true, active: true, needsReview: true },
  { id: 'H15', name: 'H15 · E2', runway: '03/21', x: 76.74, y: 39.71, mandatory: true, active: true },
  { id: 'H16', name: 'H16 · T2 / Apron V', runway: '03/21', x: 80.57, y: 42.7, mandatory: true, active: true, needsReview: true },
  { id: 'H17', name: 'H17 · VC / Apron V2', runway: '03/21', x: 82.06, y: 43.46, mandatory: true, active: true, needsReview: true },
  { id: 'H18', name: 'H18 · R north', runway: '12/30', x: 51.64, y: 45.97, mandatory: true, active: true },
  { id: 'H19', name: 'H19 · R south', runway: '12/30', x: 49.8, y: 50.14, mandatory: true, active: true },
  { id: 'H20', name: 'H20 · E/N', runway: '03/21', x: 70.19, y: 55.56, mandatory: true, active: true },
  { id: 'H21', name: 'H21 · Y/N', runway: '12/30', x: 66.97, y: 58.76, mandatory: true, active: true },
  { id: 'H22', name: 'H22 · N east', runway: '03/21', x: 74.03, y: 58.69, mandatory: true, active: true },
  { id: 'H23', name: 'H23 · Y/T3', runway: '12/30', x: 63.39, y: 62.66, mandatory: true, active: true, needsReview: true },
  { id: 'H24', name: 'H24 · Y/E3', runway: '03/21', x: 65.03, y: 63.0, mandatory: true, active: true, needsReview: true },
  { id: 'H25', name: 'H25 · Y west', runway: '12/30', x: 61.35, y: 63.77, mandatory: true, active: true },
  { id: 'H26', name: 'H26 · E3 upper', runway: '03/21', x: 65.9, y: 66.34, mandatory: true, active: true, needsReview: true },
  { id: 'H27', name: 'H27 · E3 middle', runway: '03/21', x: 65.75, y: 67.66, mandatory: true, active: true, needsReview: true },
  { id: 'H28', name: 'H28 · L', runway: '12/30', x: 79.35, y: 68.92, mandatory: true, active: true },
  { id: 'H29', name: 'H29 · F north', runway: '12/30', x: 71.98, y: 68.85, mandatory: true, active: true },
  { id: 'H30', name: 'H30 · E3 lower', runway: '03/21', x: 64.72, y: 69.19, mandatory: true, active: true },
  { id: 'H31', name: 'H31 · T3 central', runway: '03/21', x: 69.33, y: 69.82, mandatory: true, active: true, needsReview: true },
  { id: 'H32', name: 'H32 · T3 south', runway: '03/21', x: 68.25, y: 71.91, mandatory: true, active: true, needsReview: true },
  { id: 'H33', name: 'H33 · F / Fire Station', runway: '12/30', x: 72.24, y: 73.02, mandatory: true, active: true, needsReview: true },
  { id: 'H34', name: 'H34 · L south', runway: '12/30', x: 78.12, y: 73.99, mandatory: true, active: true, needsReview: true },
  { id: 'H35', name: 'H35 · E4', runway: '03/21', x: 61.3, y: 76.15, mandatory: true, active: true },
  { id: 'H36', name: 'H36 · E5', runway: '03/21', x: 60.48, y: 78.65, mandatory: true, active: true },
  { id: 'H37', name: 'H37 · T4', runway: '03/21', x: 64.06, y: 83.03, mandatory: true, active: true, needsReview: true }
]

export const defaultStartupPoints: StartupPoint[] = [
  { id: 'sp-20', name: '20', x: 81.44, y: 12.48, directions: ['N'], active: true },
  { id: 'sp-21', name: '21', x: 81.44, y: 20.27, directions: ['S'], active: true },
  { id: 'sp-22', name: '22', x: 81.44, y: 35.48, directions: ['N'], active: true },
  { id: 'sp-23', name: '23', x: 81.44, y: 44.05, directions: ['S'], active: true },
  { id: 'sp-24', name: '24', x: 81.55, y: 61.79, directions: ['N'], active: true },
  { id: 'sp-25', name: '25', x: 81.55, y: 82.85, directions: ['S'], active: true },
  { id: 'sp-30', name: '30', x: 67.17, y: 17.74, directions: ['NW'], active: true },
  { id: 'sp-32', name: '32', x: 75.75, y: 35.67, directions: ['N'], active: true },
  { id: 'sp-33', name: '33', x: 75.75, y: 44.05, directions: ['S'], active: true },
  { id: 'sp-34', name: '34', x: 75.75, y: 64.72, directions: ['N'], active: true },
  { id: 'sp-35', name: '35', x: 75.64, y: 83.04, directions: ['S'], active: true },
  { id: 'sp-36', name: '36', x: 70.88, y: 23.98, directions: ['SE'], active: true },
  { id: 'sp-37', name: '37', x: 55.68, y: 6.04, directions: ['E'], active: true },
  { id: 'sp-42', name: '42', x: 20.19, y: 35.48, directions: ['N'], active: true },
  { id: 'sp-43', name: '43', x: 20.19, y: 43.86, directions: ['S'], active: true },
  { id: 'sp-46', name: '46', x: 25.41, y: 23.0, directions: ['SW'], active: true },
  { id: 'sp-47', name: '47', x: 40.02, y: 5.85, directions: ['W'], active: true },
  { id: 'sp-48', name: '48', x: 28.65, y: 18.13, directions: ['NE'], active: true },
  { id: 'sp-50', name: '50', x: 14.5, y: 13.26, directions: ['N'], active: true },
  { id: 'sp-51', name: '51', x: 14.39, y: 20.66, directions: ['S'], active: true },
  { id: 'sp-52', name: '52', x: 14.5, y: 35.67, directions: ['N'], active: true },
  { id: 'sp-53', name: '53', x: 14.39, y: 42.88, directions: ['S'], active: true },
  { id: 'sp-54', name: '54', x: 14.62, y: 61.6, directions: ['N'], active: true },
  { id: 'sp-55', name: '55', x: 14.73, y: 78.17, directions: ['S'], active: true }
]

export const defaultPushPresets: PushPreset[] = [
  {
    id: 'preset-c-to-30-nw',
    name: 'Pier C to SP 30 northwest',
    startupPointId: 'sp-30',
    direction: 'NW',
    route: [
      { x: 48.2, y: 28.0, label: 'Clear stand' },
      { x: 55.0, y: 17.0, label: 'Join M' },
      { x: 66.2, y: 17.0, label: 'Follow M east' },
      { x: 67.17, y: 17.74, label: 'SP 30' }
    ],
    instruction: 'Push from Pier C, align on the marked lead-in and stop at SP 30 facing northwest.',
    tugNotes: 'Confirm bypass pin removed after disconnect.'
  },
  {
    id: 'preset-b-to-42-n',
    name: 'Pier B to SP 42 north-facing',
    startupPointId: 'sp-42',
    direction: 'N',
    route: [
      { x: 34.3, y: 35.5, label: 'Clear stand' },
      { x: 25.2, y: 32.0, label: 'Join K4' },
      { x: 20.19, y: 35.48, label: 'SP 42' }
    ],
    instruction: 'Push from Pier B, remain inside the red lead-in and stop on SP 42 facing north.',
    tugNotes: 'Hold before K4 until apron clearance is confirmed.'
  }
]

export function createDefaultState(): AppState {
  const createdAt = new Date().toISOString()
  return {
    revision: 1,
    lastUpdated: createdAt,
    vehicles: defaultVehicles.map((vehicle) => ({ ...vehicle, position: { ...vehicle.position }, lastSeen: createdAt })),
    assignments: [],
    holdingPoints: defaultHoldingPoints.map((point) => ({ ...point })),
    startupPoints: defaultStartupPoints.map((point) => ({ ...point, directions: [...point.directions] })),
    pushPresets: defaultPushPresets.map((preset) => ({ ...preset, route: preset.route.map((point) => ({ ...point })) })),
    events: [
      {
        id: 'event-system-ready',
        time: createdAt,
        level: 'success',
        title: 'GroundNav simulator ready',
        detail: 'Waiting for vehicle clients and tower instructions.'
      }
    ]
  }
}
