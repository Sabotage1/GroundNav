import assert from 'node:assert/strict'
import test from 'node:test'
import { createDefaultState } from '../src/data/defaultState'
import { createAssignment, holdingPointsAlongRoute, setClearance, transitionAssignment } from './domain'

test('a route near a configured holding point requires tower clearance', () => {
  const state = createDefaultState()
  const hold = state.holdingPoints[0]
  const matches = holdingPointsAlongRoute(
    [{ x: hold.x - 4, y: hold.y }, { x: hold.x + 4, y: hold.y }],
    state.holdingPoints,
    1
  )
  assert.ok(matches.some((candidate) => candidate.id === hold.id))
})

test('vehicle cannot advance while a route clearance is locked', () => {
  const state = createDefaultState()
  const hold = state.holdingPoints[0]
  const assignment = createAssignment(state, {
    vehicleId: state.vehicles[0].id,
    kind: 'route',
    map: 'airport',
    title: 'Crossing test',
    instruction: 'Proceed via the marked route',
    route: [{ x: hold.x - 4, y: hold.y }, { x: hold.x + 4, y: hold.y }]
  })
  transitionAssignment(state, assignment.id, 'acknowledge')
  transitionAssignment(state, assignment.id, 'start')
  assert.throws(() => transitionAssignment(state, assignment.id, 'next_waypoint'), /authorization is required/i)
})

test('requested and authorized clearance unlocks route progress after crossing', () => {
  const state = createDefaultState()
  const hold = state.holdingPoints[0]
  const assignment = createAssignment(state, {
    vehicleId: state.vehicles[0].id,
    kind: 'route',
    map: 'airport',
    title: 'Authorized crossing',
    instruction: 'Proceed after tower clearance',
    route: [{ x: hold.x - 4, y: hold.y }, { x: hold.x + 4, y: hold.y }]
  })
  transitionAssignment(state, assignment.id, 'acknowledge')
  transitionAssignment(state, assignment.id, 'start')
  setClearance(state, assignment.id, hold.id, 'requested')
  setClearance(state, assignment.id, hold.id, 'authorized')
  setClearance(state, assignment.id, hold.id, 'crossed')
  const updated = transitionAssignment(state, assignment.id, 'next_waypoint')
  assert.equal(updated.currentWaypoint, 1)
})

test('vehicle may advance along pre-hold route points before clearance is needed', () => {
  const state = createDefaultState()
  const hold = state.holdingPoints[0]
  const assignment = createAssignment(state, {
    vehicleId: state.vehicles[0].id,
    kind: 'route',
    map: 'airport',
    title: 'Approach before hold',
    instruction: 'Proceed to the holding point',
    route: [
      { x: hold.x - 12, y: hold.y },
      { x: hold.x - 8, y: hold.y },
      { x: hold.x - 4, y: hold.y },
      { x: hold.x + 4, y: hold.y }
    ]
  })
  transitionAssignment(state, assignment.id, 'acknowledge')
  transitionAssignment(state, assignment.id, 'start')
  assert.equal(transitionAssignment(state, assignment.id, 'next_waypoint').currentWaypoint, 1)
  assert.equal(transitionAssignment(state, assignment.id, 'next_waypoint').currentWaypoint, 2)
  assert.throws(() => transitionAssignment(state, assignment.id, 'next_waypoint'), /authorization is required/i)
})

test('STOP remains latched after the driver acknowledges it', () => {
  const state = createDefaultState()
  const vehicle = state.vehicles[0]
  const stop = createAssignment(state, {
    vehicleId: vehicle.id,
    kind: 'stop',
    map: 'airport',
    title: 'STOP IMMEDIATELY',
    instruction: 'Remain stopped',
    route: [],
    priority: 'emergency'
  })
  transitionAssignment(state, stop.id, 'acknowledge')
  assert.equal(vehicle.status, 'stopped')
})

test('startup points support multiple directions', () => {
  const state = createDefaultState()
  state.startupPoints.push({
    id: 'sp-multi-direction-test',
    name: 'TEST',
    x: 50,
    y: 50,
    directions: ['N', 'W'],
    active: true
  })
  const point = state.startupPoints.at(-1)
  assert.deepEqual(point?.directions, ['N', 'W'])
})
