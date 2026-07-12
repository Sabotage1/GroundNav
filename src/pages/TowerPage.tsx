import { useMemo, useState } from 'react'
import {
  AlertOctagon,
  ArrowUpRight,
  Check,
  CircleDot,
  Clock3,
  Crosshair,
  Eraser,
  LocateFixed,
  Radio,
  Redo2,
  Route,
  Send,
  ShieldCheck,
  Square,
  Undo2,
  Wifi,
  WifiOff
} from 'lucide-react'
import { MapCanvas } from '../components/MapCanvas'
import { StatusBadge } from '../components/StatusBadge'
import { useAppState } from '../state/AppStateContext'
import type { Assignment, AssignmentInput, MapPoint, Vehicle } from '../types'

const activeStatuses = ['sent', 'acknowledged', 'in_progress', 'holding']

function ageLabel(timestamp: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(timestamp).getTime()) / 1000))
  if (seconds < 5) return 'now'
  if (seconds < 60) return `${seconds}s ago`
  return `${Math.floor(seconds / 60)}m ago`
}

function priorityForVehicle(vehicle: Vehicle, assignment?: Assignment) {
  if (vehicle.status === 'stopped' || assignment?.priority === 'emergency') return 0
  if (!vehicle.connected) return 1
  if (assignment?.clearances.some((clearance) => clearance.status === 'requested')) return 2
  if (assignment?.status === 'sent') return 3
  if (assignment) return 4
  return 5
}

export function TowerPage() {
  const { state, connection, mutate } = useAppState()
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [draftRoute, setDraftRoute] = useState<MapPoint[]>([])
  const [routeTitle, setRouteTitle] = useState('Proceed via assigned airfield route')
  const [instruction, setInstruction] = useState('Follow the numbered route. Hold at every marked runway holding point until separately authorized by tower.')
  const [priority, setPriority] = useState<Assignment['priority']>('routine')
  const [composerOpen, setComposerOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const airportVehicles = useMemo(
    () => (state?.vehicles ?? []).filter((vehicle) => vehicle.position.map === 'airport'),
    [state?.vehicles]
  )
  const assignmentsByVehicle = useMemo(() => {
    const map = new Map<string, Assignment>()
    for (const assignment of state?.assignments ?? []) {
      if (!map.has(assignment.vehicleId) && activeStatuses.includes(assignment.status)) map.set(assignment.vehicleId, assignment)
    }
    return map
  }, [state?.assignments])
  const sortedVehicles = useMemo(
    () => [...airportVehicles].sort((a, b) => priorityForVehicle(a, assignmentsByVehicle.get(a.id)) - priorityForVehicle(b, assignmentsByVehicle.get(b.id))),
    [airportVehicles, assignmentsByVehicle]
  )
  const effectiveVehicleId = selectedVehicleId || sortedVehicles[0]?.id || ''
  const selectedVehicle = sortedVehicles.find((vehicle) => vehicle.id === effectiveVehicleId)
  const activeAssignment = selectedVehicle ? assignmentsByVehicle.get(selectedVehicle.id) : undefined
  const activeRoute = activeAssignment?.route ?? []
  const requestedClearances = (state?.assignments ?? []).flatMap((assignment) =>
    assignment.clearances
      .filter((clearance) => clearance.status === 'requested')
      .map((clearance) => ({ assignment, clearance }))
  )

  async function issue(input: AssignmentInput) {
    setBusy(true)
    setError('')
    try {
      await mutate<Assignment, AssignmentInput>('/api/assignments', input)
      setDraftRoute([])
      setComposerOpen(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Instruction could not be sent')
    } finally {
      setBusy(false)
    }
  }

  async function sendRoute() {
    if (!selectedVehicle) return
    if (draftRoute.length < 2) {
      setError('Click at least two points on the map to create an ordered route.')
      return
    }
    await issue({
      vehicleId: selectedVehicle.id,
      kind: 'route',
      map: 'airport',
      title: routeTitle,
      instruction,
      route: draftRoute,
      priority
    })
  }

  async function sendStop() {
    if (!selectedVehicle) return
    await issue({
      vehicleId: selectedVehicle.id,
      kind: 'stop',
      map: 'airport',
      title: 'STOP IMMEDIATELY',
      instruction: 'Stop the vehicle immediately and remain stopped. Contact tower before moving.',
      route: [],
      priority: 'emergency'
    })
  }

  async function sendHold() {
    if (!selectedVehicle) return
    await issue({
      vehicleId: selectedVehicle.id,
      kind: 'hold',
      map: 'airport',
      title: 'Hold position',
      instruction: 'Hold your current position and await further tower instruction.',
      route: [{ x: selectedVehicle.position.x, y: selectedVehicle.position.y, label: 'Hold here' }],
      priority: 'priority'
    })
  }

  async function setClearance(assignmentId: string, holdingPointId: string, status: 'authorized' | 'required') {
    setError('')
    try {
      await mutate(`/api/assignments/${assignmentId}/clearances/${holdingPointId}`, { status })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Clearance could not be updated')
    }
  }

  if (!state) {
    return <div className="loading-screen"><span className="loading-spinner" /> Connecting to the GroundNav server…</div>
  }

  const onlineCount = airportVehicles.filter((vehicle) => vehicle.connected).length

  return (
    <div className="operations-page tower-page">
      <header className="operations-header">
        <div>
          <span className="eyebrow">Airfield control · LLBG</span>
          <h1>Tower ground console</h1>
        </div>
        <div className="operations-header__metrics">
          <span className={`connection-indicator connection-indicator--${connection}`}>
            {connection === 'live' ? <Wifi /> : <WifiOff />}
            <span><strong>{connection === 'live' ? 'Live link' : connection}</strong><small>Revision {state.revision}</small></span>
          </span>
          <span><strong>{onlineCount}/{airportVehicles.length}</strong><small>vehicles online</small></span>
          <span><strong>{requestedClearances.length}</strong><small>clearance requests</small></span>
          <time><strong>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong><small>local time</small></time>
        </div>
      </header>

      {error && <div className="inline-alert inline-alert--danger" role="alert"><AlertOctagon /> <span>{error}</span><button type="button" onClick={() => setError('')}>Dismiss</button></div>}

      {requestedClearances.length > 0 && (
        <section className="clearance-queue" aria-labelledby="clearance-queue-title">
          <div className="clearance-queue__title">
            <span><Clock3 /></span>
            <div><strong id="clearance-queue-title">Runway crossing requests</strong><small>Review each vehicle and holding point before authorizing.</small></div>
          </div>
          <div className="clearance-queue__items">
            {requestedClearances.map(({ assignment, clearance }) => {
              const vehicle = state.vehicles.find((candidate) => candidate.id === assignment.vehicleId)
              const point = state.holdingPoints.find((candidate) => candidate.id === clearance.holdingPointId)
              return (
                <article key={`${assignment.id}-${clearance.holdingPointId}`}>
                  <div><strong>{vehicle?.callsign}</strong><span>{point?.name} · RWY {point?.runway}</span></div>
                  <button className="button button--success button--small" type="button" onClick={() => setClearance(assignment.id, clearance.holdingPointId, 'authorized')}>
                    <ShieldCheck /> Authorize crossing
                  </button>
                </article>
              )
            })}
          </div>
        </section>
      )}

      <div className="tower-layout">
        <aside className="fleet-panel panel-card" aria-label="Airport vehicle fleet">
          <div className="panel-card__header">
            <div><span className="eyebrow">Live fleet</span><h2>Vehicles</h2></div>
            <span className="count-pill">{airportVehicles.length}</span>
          </div>
          <div className="fleet-list">
            {sortedVehicles.map((vehicle) => {
              const assignment = assignmentsByVehicle.get(vehicle.id)
              return (
                <button
                  type="button"
                  key={vehicle.id}
                  className={`fleet-row ${effectiveVehicleId === vehicle.id ? 'fleet-row--selected' : ''}`}
                  onClick={() => setSelectedVehicleId(vehicle.id)}
                >
                  <span className="fleet-row__marker" style={{ background: vehicle.color }}><LocateFixed /></span>
                  <span className="fleet-row__body">
                    <span className="fleet-row__top"><strong>{vehicle.callsign}</strong><small>{ageLabel(vehicle.lastSeen)}</small></span>
                    <span>{assignment?.title ?? vehicle.operator}</span>
                    <span className="fleet-row__status">
                      <StatusBadge status={assignment?.status ?? vehicle.status} />
                      <small className={vehicle.connected ? 'text-success' : 'text-muted'}>{vehicle.connected ? 'Connected' : 'Offline'}</small>
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
          <div className="fleet-panel__footer">
            <Radio /> Position source and timestamp are shown for every vehicle. Offline markers retain the last known fix.
          </div>
        </aside>

        <MapCanvas
          mapId="airport"
          vehicles={airportVehicles}
          holdingPoints={state.holdingPoints}
          selectedVehicleId={effectiveVehicleId}
          route={activeRoute}
          draftRoute={draftRoute}
          activeHoldingPointIds={activeAssignment?.clearances.map((clearance) => clearance.holdingPointId)}
          onVehicleSelect={setSelectedVehicleId}
          onMapClick={composerOpen ? (point) => setDraftRoute((route) => [...route, { ...point, label: `Waypoint ${route.length + 1}` }]) : undefined}
          interactiveLabel={composerOpen ? 'Route drawing mode' : 'Fleet monitoring'}
        />

        <aside className="instruction-panel panel-card" aria-label="Vehicle instructions">
          {selectedVehicle ? (
            <>
              <div className="selected-vehicle-card">
                <div className="selected-vehicle-card__identity">
                  <span className="vehicle-avatar" style={{ '--vehicle-color': selectedVehicle.color } as React.CSSProperties}><LocateFixed /></span>
                  <div><span className="eyebrow">Selected vehicle</span><h2>{selectedVehicle.callsign}</h2><p>{selectedVehicle.operator}</p></div>
                </div>
                <div className="selected-vehicle-card__meta">
                  <StatusBadge status={activeAssignment?.status ?? selectedVehicle.status} />
                  <span>{selectedVehicle.position.speedKph.toFixed(0)} km/h</span>
                  <span>{selectedVehicle.position.source}</span>
                </div>
              </div>

              <div className="quick-command-grid">
                <button className="command-button command-button--danger" type="button" onClick={sendStop} disabled={busy}>
                  <AlertOctagon /><span><strong>STOP</strong><small>Immediate</small></span>
                </button>
                <button className="command-button command-button--warning" type="button" onClick={sendHold} disabled={busy}>
                  <Square /><span><strong>HOLD</strong><small>Current position</small></span>
                </button>
              </div>

              {activeAssignment && (
                <section className="active-assignment-card">
                  <div className="active-assignment-card__head"><span>Current instruction</span><StatusBadge status={activeAssignment.status} /></div>
                  <h3>{activeAssignment.title}</h3>
                  <p>{activeAssignment.instruction}</p>
                  <div className="assignment-progress">
                    <span><Route /> {activeAssignment.route.length} route points</span>
                    <span><Crosshair /> {activeAssignment.currentWaypoint + 1}/{Math.max(1, activeAssignment.route.length)}</span>
                  </div>
                  {activeAssignment.clearances.length > 0 && (
                    <div className="assignment-clearances">
                      <strong>Crossing gates</strong>
                      {activeAssignment.clearances.map((clearance) => {
                        const point = state.holdingPoints.find((candidate) => candidate.id === clearance.holdingPointId)
                        return (
                          <div key={clearance.holdingPointId}>
                            <span>{point?.name ?? clearance.holdingPointId}</span>
                            <StatusBadge status={clearance.status} />
                            {clearance.status === 'authorized' && (
                              <button type="button" className="text-button text-button--danger" onClick={() => setClearance(activeAssignment.id, clearance.holdingPointId, 'required')}>Revoke</button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </section>
              )}

              <div className="composer-section">
                <div className="composer-section__head">
                  <div><span className="eyebrow">New instruction</span><h3>Assign route</h3></div>
                  <button type="button" className={`mode-toggle ${composerOpen ? 'mode-toggle--active' : ''}`} onClick={() => setComposerOpen((open) => !open)}>
                    <Route /> {composerOpen ? 'Drawing' : 'Draw route'}
                  </button>
                </div>
                {composerOpen && (
                  <div className="route-composer">
                    <p className="helper-text">Click ordered waypoints on the map. Nearby default hold markers are attached automatically.</p>
                    <div className="route-tool-row">
                      <span>{draftRoute.length} points</span>
                      <button type="button" className="icon-text-button" onClick={() => setDraftRoute((route) => route.slice(0, -1))} disabled={!draftRoute.length}><Undo2 /> Undo</button>
                      <button type="button" className="icon-text-button" onClick={() => setDraftRoute([])} disabled={!draftRoute.length}><Eraser /> Clear</button>
                    </div>
                    <label>Instruction title<input value={routeTitle} onChange={(event) => setRouteTitle(event.target.value)} /></label>
                    <label>Driver instruction<textarea rows={3} value={instruction} onChange={(event) => setInstruction(event.target.value)} /></label>
                    <label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value as Assignment['priority'])}><option value="routine">Routine</option><option value="priority">Priority</option><option value="emergency">Emergency</option></select></label>
                    <button className="button button--primary button--full" type="button" onClick={sendRoute} disabled={busy || draftRoute.length < 2}>
                      {busy ? <span className="button-spinner" /> : <Send />} Send to {selectedVehicle.callsign}
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state"><CircleDot /><h2>No vehicle selected</h2><p>Select a vehicle on the map or in the live fleet.</p></div>
          )}
        </aside>
      </div>

      <section className="activity-strip panel-card">
        <div className="panel-card__header"><div><span className="eyebrow">Audit trail</span><h2>Latest activity</h2></div><ArrowUpRight /></div>
        <div className="activity-list">
          {state.events.slice(0, 6).map((event) => (
            <article key={event.id} className={`activity-event activity-event--${event.level}`}>
              <span>{event.level === 'success' ? <Check /> : event.level === 'warning' ? <Clock3 /> : event.level === 'critical' ? <AlertOctagon /> : <Redo2 />}</span>
              <div><strong>{event.title}</strong><p>{event.detail}</p></div>
              <time>{ageLabel(event.time)}</time>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
