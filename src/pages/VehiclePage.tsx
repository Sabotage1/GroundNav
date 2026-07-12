import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Browser } from '@capacitor/browser'
import {
  AlertOctagon,
  ArrowLeft,
  Check,
  ChevronRight,
  Crosshair,
  Download,
  Gauge,
  LockKeyhole,
  MapPin,
  Navigation,
  Radio,
  Server,
  RefreshCw,
  Route,
  Satellite,
  ShieldAlert,
  ShieldCheck,
  Truck,
  UserRoundCheck,
  Wifi,
  WifiOff,
  X
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { MapCanvas } from '../components/MapCanvas'
import { Modal } from '../components/Modal'
import { StatusBadge } from '../components/StatusBadge'
import { clearGroundNavServer, configuredGroundNavServer, setGroundNavServer } from '../lib/api'
import { useAppState } from '../state/AppStateContext'
import type { Assignment, ClearanceStatus, Vehicle, VehicleType } from '../types'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const activeStatuses = ['sent', 'acknowledged', 'in_progress', 'holding']
const appVersion = import.meta.env.VITE_APP_VERSION || '0.2.0'
const latestReleaseUrl = 'https://github.com/Sabotage1/GroundNav/releases/latest'

function activeAssignmentFor(assignments: Assignment[], vehicleId: string) {
  return assignments.find((assignment) => assignment.vehicleId === vehicleId && activeStatuses.includes(assignment.status))
}

function clearanceCopy(status?: ClearanceStatus) {
  if (status === 'required') return 'HOLD — TOWER CLEARANCE REQUIRED'
  if (status === 'requested') return 'HOLD — WAIT FOR TOWER'
  if (status === 'authorized') return 'CROSSING AUTHORIZED'
  return undefined
}

export function VehiclePage() {
  const { state, connection, mutate, identifyVehicle } = useAppState()
  const [searchParams] = useSearchParams()
  const [vehicleId, setVehicleId] = useState(() => searchParams.get('vehicle') || localStorage.getItem('groundnav.vehicleId') || '')
  const [simulationMode, setSimulationMode] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [showVehiclePicker, setShowVehiclePicker] = useState(!vehicleId)
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [showConnectionSetup, setShowConnectionSetup] = useState(false)
  const [connectionSetupReady, setConnectionSetupReady] = useState(false)
  const [gpsFix, setGpsFix] = useState<{ lat: number; lng: number; accuracy: number } | null>(null)
  const [gpsError, setGpsError] = useState('')
  const lastAssignmentRef = useRef('')

  const vehicle = state?.vehicles.find((candidate) => candidate.id === vehicleId)
  const assignment = vehicle && state ? activeAssignmentFor(state.assignments, vehicle.id) : undefined
  const holdingClearance = assignment?.clearances.find(
    (clearance) => clearance.status !== 'crossed' && (clearance.routeIndex ?? 1) <= assignment.currentWaypoint + 1
  )
  const holdingPoint = state?.holdingPoints.find((point) => point.id === holdingClearance?.holdingPointId)
  const currentWaypoint = assignment?.route[assignment.currentWaypoint]
  const atFinalWaypoint = Boolean(assignment && assignment.route.length > 0 && assignment.currentWaypoint >= assignment.route.length - 1)
  const criticalCopy = assignment?.kind === 'stop' ? 'STOP IMMEDIATELY' : clearanceCopy(holdingClearance?.status)

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  useEffect(() => {
    if (state) return
    const timer = window.setTimeout(() => setConnectionSetupReady(true), 1_200)
    return () => window.clearTimeout(timer)
  }, [state])

  useEffect(() => {
    identifyVehicle(vehicleId || undefined)
    if (!vehicleId) return
    const heartbeat = () => void mutate(`/api/vehicles/${vehicleId}/heartbeat`, {}).catch(() => undefined)
    heartbeat()
    const timer = window.setInterval(heartbeat, 15_000)
    return () => window.clearInterval(timer)
  }, [identifyVehicle, mutate, vehicleId])

  useEffect(() => {
    if (!assignment || assignment.id === lastAssignmentRef.current) return
    lastAssignmentRef.current = assignment.id
    if ('vibrate' in navigator) navigator.vibrate(assignment.kind === 'stop' ? [220, 120, 220, 120, 360] : [100, 80, 100])
  }, [assignment])

  function chooseVehicle(id: string) {
    setVehicleId(id)
    localStorage.setItem('groundnav.vehicleId', id)
    setShowVehiclePicker(false)
    setMenuOpen(false)
  }

  async function performAction(action: string) {
    if (!assignment) return
    setBusy(true)
    setError('')
    try {
      await mutate(`/api/assignments/${assignment.id}/action`, { action })
      if ('vibrate' in navigator) navigator.vibrate(70)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Action could not be sent to tower')
    } finally {
      setBusy(false)
    }
  }

  async function updateClearance(status: 'requested' | 'crossed') {
    if (!assignment || !holdingClearance) return
    setBusy(true)
    setError('')
    try {
      await mutate(`/api/assignments/${assignment.id}/clearances/${holdingClearance.holdingPointId}`, { status })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Clearance update could not be sent')
    } finally {
      setBusy(false)
    }
  }

  async function moveSimulation(x: number, y: number) {
    if (!vehicle || !simulationMode) return
    try {
      await mutate(`/api/vehicles/${vehicle.id}/location`, {
        ...vehicle.position,
        x,
        y,
        speedKph: 7,
        source: 'simulated'
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Simulated position could not be updated')
    }
  }

  function requestGps() {
    setGpsError('')
    if (!navigator.geolocation) {
      setGpsError('This device does not provide browser geolocation.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsFix({ lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy })
        setSimulationMode(false)
      },
      (caught) => setGpsError(`${caught.message}. Use simulation mode or open the installed Android wrapper.`),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 2_000 }
    )
  }

  async function installApp() {
    if (!installPrompt) return
    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  async function openLatestRelease() {
    setMenuOpen(false)
    try {
      await Browser.open({ url: latestReleaseUrl, presentationStyle: 'popover' })
    } catch {
      window.open(latestReleaseUrl, '_blank', 'noopener,noreferrer')
    }
  }

  if (!state) {
    if (!connectionSetupReady) return <div className="vehicle-loading"><span className="loading-spinner" /><strong>Connecting GroundNav</strong><small>Waiting for the Mac host…</small></div>
    return <ServerConnectionSetup />
  }

  if (!vehicle || showVehiclePicker) {
    return <VehiclePicker vehicles={state.vehicles} onChoose={chooseVehicle} selectedId={vehicleId} onClose={vehicle ? () => setShowVehiclePicker(false) : undefined} />
  }

  const instructionTitle = criticalCopy ?? assignment?.title ?? 'Await tower assignment'
  const instructionBody = assignment?.instruction ?? 'Remain available. New tower instructions will appear here and require acknowledgement.'

  return (
    <div className={`vehicle-app ${assignment?.kind === 'stop' ? 'vehicle-app--stop' : ''}`}>
      <div className="vehicle-simulation-banner"><ShieldAlert /> SIMULATION · NOT FOR OPERATIONAL USE</div>
      <header className="vehicle-header">
        <button type="button" className="vehicle-identity" onClick={() => setMenuOpen(true)} aria-label="Open vehicle menu">
          <span className="vehicle-identity__icon" style={{ '--vehicle-color': vehicle.color } as React.CSSProperties}>{vehicle.type === 'pushback' ? <Truck /> : <Navigation />}</span>
          <span><small>{vehicle.operator}</small><strong>{vehicle.callsign}</strong></span>
          <ChevronRight />
        </button>
        <div className="vehicle-header__status">
          <span className={connection === 'live' ? 'mobile-connection mobile-connection--live' : 'mobile-connection mobile-connection--offline'}>{connection === 'live' ? <Wifi /> : <WifiOff />}<span>{connection === 'live' ? 'Tower link' : 'Link lost'}</span></span>
          <StatusBadge status={assignment?.status ?? vehicle.status} />
        </div>
      </header>

      {connection !== 'live' && (
        <div className="vehicle-critical-banner" role="alert"><WifiOff /><div><strong>CONNECTION LOST — STOP AND CONTACT TOWER</strong><span>Last accepted instruction remains visible for reference. No new clearance is valid while offline.</span></div></div>
      )}
      {error && <div className="vehicle-error" role="alert"><AlertOctagon /><span>{error}</span><button type="button" aria-label="Dismiss error" onClick={() => setError('')}><X /></button></div>}

      <main className="vehicle-main" id="main-content">
        <div className="vehicle-map-wrap">
          <MapCanvas
            mapId={vehicle.position.map}
            vehicles={[vehicle]}
            route={assignment?.route ?? []}
            holdingPoints={vehicle.position.map === 'airport' ? state.holdingPoints : []}
            startupPoints={vehicle.position.map === 'terminal' ? state.startupPoints : []}
            selectedVehicleId={vehicle.id}
            activeHoldingPointIds={assignment?.clearances.map((clearance) => clearance.holdingPointId)}
            onMapClick={simulationMode ? (point) => moveSimulation(point.x, point.y) : undefined}
            interactiveLabel={simulationMode ? 'Tap map to simulate vehicle position' : 'GPS display'}
            toolbarExtra={
              <button className="map-source-button" type="button" onClick={() => setSimulationMode((value) => !value)}>
                {simulationMode ? <Crosshair /> : <Satellite />} {simulationMode ? 'SIM' : 'GPS'}
              </button>
            }
          />
          <div className="vehicle-map-data">
            <span><MapPin /><strong>{vehicle.position.x.toFixed(1)}, {vehicle.position.y.toFixed(1)}</strong><small>map X / Y %</small></span>
            <span><Gauge /><strong>{vehicle.position.speedKph.toFixed(0)} km/h</strong><small>reported speed</small></span>
            <span><Navigation /><strong>{Math.round(vehicle.position.heading)}°</strong><small>heading</small></span>
            <span><Radio /><strong>{vehicle.position.source.toUpperCase()}</strong><small>position source</small></span>
          </div>
        </div>

        <section className={`driver-instruction ${criticalCopy ? 'driver-instruction--critical' : ''}`} aria-live="assertive">
          <div className="driver-instruction__header">
            <span className="instruction-symbol">{assignment?.kind === 'stop' ? <AlertOctagon /> : holdingClearance ? <LockKeyhole /> : assignment ? <Route /> : <Radio />}</span>
            <div><span className="eyebrow">{assignment ? 'Tower instruction' : 'Vehicle ready'}</span><h1>{instructionTitle}</h1></div>
            {assignment && <StatusBadge status={holdingClearance?.status ?? assignment.status} />}
          </div>
          <p className="driver-instruction__body">{instructionBody}</p>

          {assignment?.pushback && (
            <div className="pushback-driver-summary">
              <span><small>Aircraft</small><strong>{assignment.pushback.aircraftCallsign}</strong></span>
              <span><small>Stand</small><strong>{assignment.pushback.aircraftStand}</strong></span>
              <span><small>Startup</small><strong>SP {state.startupPoints.find((point) => point.id === assignment.pushback?.startupPointId)?.name}</strong></span>
              <span><small>Final direction</small><strong>{assignment.pushback.direction}</strong></span>
            </div>
          )}

          {holdingClearance && holdingPoint && (
            <div className={`hold-clearance-panel hold-clearance-panel--${holdingClearance.status}`}>
              <ShieldCheck />
              <div><small>Runway protection gate</small><strong>{holdingPoint.name} · RWY {holdingPoint.runway}</strong><span>{holdingClearance.status === 'authorized' ? 'Tower authorization received. Confirm crossing, then report when clear.' : holdingClearance.status === 'requested' ? 'Request transmitted. Remain stopped.' : 'Authorization is required before crossing.'}</span></div>
            </div>
          )}

          {assignment && assignment.route.length > 0 && (
            <div className="next-waypoint-card">
              <span>{assignment.currentWaypoint + 1}</span>
              <div><small>Current route point</small><strong>{currentWaypoint?.label ?? `Waypoint ${assignment.currentWaypoint + 1}`}</strong></div>
              <strong>{assignment.currentWaypoint + 1}/{assignment.route.length}</strong>
            </div>
          )}

          <div className="driver-actions">
            {assignment?.status === 'sent' && (
              <button className={`driver-primary-action ${assignment.kind === 'stop' ? 'driver-primary-action--danger' : ''}`} type="button" onClick={() => performAction('acknowledge')} disabled={busy || connection !== 'live'}>
                <UserRoundCheck /> {assignment.kind === 'stop' ? 'ACKNOWLEDGE STOP' : 'ACKNOWLEDGE INSTRUCTION'}
              </button>
            )}
            {assignment?.status === 'acknowledged' && assignment.kind !== 'stop' && (
              <button className="driver-primary-action" type="button" onClick={() => performAction('start')} disabled={busy || connection !== 'live'}><Navigation /> START INSTRUCTION</button>
            )}
            {assignment?.status === 'acknowledged' && assignment.kind === 'stop' && (
              <button className="driver-primary-action driver-primary-action--disabled" type="button" disabled><AlertOctagon /> REMAIN STOPPED</button>
            )}
            {assignment?.status === 'in_progress' && holdingClearance?.status === 'required' && (
              <button className="driver-primary-action driver-primary-action--warning" type="button" onClick={() => updateClearance('requested')} disabled={busy || connection !== 'live'}><LockKeyhole /> AT HOLD — REQUEST CLEARANCE</button>
            )}
            {assignment?.status === 'in_progress' && holdingClearance?.status === 'requested' && (
              <button className="driver-primary-action driver-primary-action--disabled" type="button" disabled><RefreshCw /> WAIT FOR TOWER</button>
            )}
            {assignment?.status === 'in_progress' && holdingClearance?.status === 'authorized' && (
              <button className="driver-primary-action driver-primary-action--success" type="button" onClick={() => updateClearance('crossed')} disabled={busy || connection !== 'live'}><ShieldCheck /> CONFIRM RUNWAY VACATED</button>
            )}
            {assignment?.status === 'in_progress' && !holdingClearance && !atFinalWaypoint && (
              <button className="driver-primary-action" type="button" onClick={() => performAction('next_waypoint')} disabled={busy || connection !== 'live'}><ChevronRight /> MOVE TO NEXT CHECKPOINT</button>
            )}
            {assignment?.status === 'in_progress' && !holdingClearance && atFinalWaypoint && (
              <button className="driver-primary-action driver-primary-action--success" type="button" onClick={() => performAction('complete')} disabled={busy || connection !== 'live'}><Check /> CONFIRM ARRIVAL</button>
            )}
            {assignment?.status === 'holding' && (
              <button className="driver-primary-action" type="button" onClick={() => performAction('resume')} disabled={busy || connection !== 'live'}><Navigation /> RESUME AS INSTRUCTED</button>
            )}
            {assignment?.status === 'in_progress' && (
              <button className="driver-secondary-action" type="button" onClick={() => performAction('hold')} disabled={busy || connection !== 'live'}>REPORT HOLDING POSITION</button>
            )}
          </div>
        </section>

        {assignment && assignment.route.length > 0 && (
          <details className="vehicle-route-steps">
            <summary><Route /> Route steps <span>{assignment.route.length}</span></summary>
            <ol>{assignment.route.map((point, index) => <li className={index < assignment.currentWaypoint ? 'route-step--done' : index === assignment.currentWaypoint ? 'route-step--active' : ''} key={`${point.x}-${point.y}-${index}`}><span>{index + 1}</span><div><strong>{point.label ?? `Waypoint ${index + 1}`}</strong><small>X {point.x.toFixed(1)} · Y {point.y.toFixed(1)}</small></div>{index < assignment.currentWaypoint && <Check />}</li>)}</ol>
          </details>
        )}
      </main>

      <Modal isOpen={menuOpen} onClose={() => setMenuOpen(false)} title={vehicle.callsign} description="Vehicle device and connection settings" size="small">
        <div className="vehicle-settings">
          <button type="button" onClick={() => { setMenuOpen(false); setShowVehiclePicker(true) }}><Truck /><span><strong>Change vehicle</strong><small>Select a different fleet identity</small></span><ChevronRight /></button>
          <button type="button" onClick={requestGps}><Satellite /><span><strong>Request GPS fix</strong><small>{gpsFix ? `${gpsFix.lat.toFixed(5)}, ${gpsFix.lng.toFixed(5)} · ±${gpsFix.accuracy.toFixed(0)}m` : 'Requires a secure Android context'}</small></span><ChevronRight /></button>
          <button type="button" onClick={() => setSimulationMode((value) => !value)}><Crosshair /><span><strong>Simulation movement</strong><small>{simulationMode ? 'Enabled — tap the map to move' : 'Disabled'}</small></span><StatusBadge status={simulationMode ? 'ready' : 'idle'} label={simulationMode ? 'On' : 'Off'} /></button>
          <button type="button" onClick={() => { setMenuOpen(false); setShowConnectionSetup(true) }}><Server /><span><strong>Mac server</strong><small>{configuredGroundNavServer() || window.location.origin}</small></span><ChevronRight /></button>
          <button type="button" onClick={openLatestRelease}><Download /><span><strong>Check for Android update</strong><small>GitHub Releases · installed v{appVersion}</small></span><ChevronRight /></button>
          {installPrompt && <button type="button" onClick={installApp}><Download /><span><strong>Install Android app</strong><small>Add GroundNav to this device</small></span><ChevronRight /></button>}
          {gpsError && <p className="settings-error"><AlertOctagon /> {gpsError}</p>}
          {gpsFix && <p className="settings-warning"><ShieldAlert /> GPS fix received, but this raster chart is not calibrated. The map coordinate remains unchanged.</p>}
          <Link className="settings-link" to="/"><ArrowLeft /> Return to workstation selector</Link>
        </div>
      </Modal>
      <Modal isOpen={showConnectionSetup} onClose={() => setShowConnectionSetup(false)} title="Mac server connection" description="Change the GroundNav host used by this Android device" size="small">
        <ServerConnectionForm onCancel={() => setShowConnectionSetup(false)} />
      </Modal>
    </div>
  )
}

function ServerConnectionSetup() {
  return (
    <div className="server-setup-page">
      <div className="vehicle-simulation-banner"><ShieldAlert /> SIMULATION · NOT FOR OPERATIONAL USE</div>
      <main>
        <span className="server-setup-icon"><Server /></span>
        <span className="eyebrow">Android connection</span>
        <h1>Connect to the Mac tower</h1>
        <p>Start GroundNav on the Mac, keep both devices on the same Wi-Fi, then enter the Mac network address below.</p>
        <ServerConnectionForm />
      </main>
    </div>
  )
}

function ServerConnectionForm({ onCancel }: { onCancel?: () => void }) {
  const [origin, setOrigin] = useState(() => configuredGroundNavServer())
  const [formError, setFormError] = useState('')

  function save(event: FormEvent) {
    event.preventDefault()
    setFormError('')
    try {
      setGroundNavServer(origin)
      window.location.reload()
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Invalid server address')
    }
  }

  return (
    <form className="server-connection-form" onSubmit={save}>
      <label htmlFor={onCancel ? 'settings-server-origin' : 'server-origin'}>Mac server address<input id={onCancel ? 'settings-server-origin' : 'server-origin'} type="url" value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder="http://192.168.1.20:4173" autoCapitalize="none" autoCorrect="off" /></label>
      <p className="helper-text">On the Mac, run <code>npm start</code>. The terminal prints the address to use.</p>
      {formError && <p className="form-error" role="alert">{formError}</p>}
      <button className="button button--primary button--full" type="submit" disabled={!origin}><RefreshCw /> Save and reconnect</button>
      <div className="server-form-secondary">
        <button type="button" className="text-button" onClick={() => window.location.reload()}>Try again</button>
        <button type="button" className="text-button" onClick={() => { clearGroundNavServer(); window.location.reload() }}>Use bundled default</button>
        {onCancel && <button type="button" className="text-button" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}

function VehiclePicker({ vehicles, onChoose, selectedId, onClose }: { vehicles: Vehicle[]; onChoose: (id: string) => void; selectedId: string; onClose?: () => void }) {
  const [filter, setFilter] = useState<VehicleType | 'all'>('all')
  const filtered = useMemo(() => vehicles.filter((vehicle) => filter === 'all' || vehicle.type === filter), [filter, vehicles])
  return (
    <div className="vehicle-picker">
      <div className="vehicle-simulation-banner"><ShieldAlert /> SIMULATION · NOT FOR OPERATIONAL USE</div>
      <header><Link to="/" aria-label="Back to home"><ArrowLeft /></Link><div><span className="eyebrow">Android vehicle client</span><h1>Select this vehicle</h1><p>The selected callsign becomes this device’s live tower identity.</p></div>{onClose && <button type="button" onClick={onClose} aria-label="Close vehicle selector"><X /></button>}</header>
      <main id="main-content">
        <div className="vehicle-filter" aria-label="Filter vehicles">{(['all','operations','pushback','maintenance','fire'] as const).map((type) => <button type="button" className={filter === type ? 'vehicle-filter__active' : ''} onClick={() => setFilter(type)} key={type}>{type === 'all' ? 'All' : type}</button>)}</div>
        <div className="vehicle-choice-list">
          {filtered.map((vehicle) => <button type="button" className={selectedId === vehicle.id ? 'vehicle-choice vehicle-choice--selected' : 'vehicle-choice'} onClick={() => onChoose(vehicle.id)} key={vehicle.id}><span className="vehicle-choice__icon" style={{ '--vehicle-color': vehicle.color } as React.CSSProperties}>{vehicle.type === 'pushback' ? <Truck /> : <Navigation />}</span><span><strong>{vehicle.callsign}</strong><small>{vehicle.operator}</small></span><StatusBadge status={vehicle.connected ? 'online' : vehicle.status} /><ChevronRight /></button>)}
        </div>
        <aside className="vehicle-picker__note"><Radio /><div><strong>Testing on two devices</strong><p>Keep the Mac server running, then open the same network address on Android. Choose a different vehicle identity in each browser tab or device.</p></div></aside>
      </main>
    </div>
  )
}
