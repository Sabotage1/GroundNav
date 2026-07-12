import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Eraser,
  MoveRight,
  Navigation,
  Plane,
  Route,
  Send,
  ShieldCheck,
  Truck,
  Undo2
} from 'lucide-react'
import { MapCanvas } from '../components/MapCanvas'
import { StatusBadge } from '../components/StatusBadge'
import { useAppState } from '../state/AppStateContext'
import type { Assignment, AssignmentInput, CardinalDirection, MapPoint } from '../types'

const directionNames: Record<CardinalDirection, string> = {
  N: 'North', NE: 'North-east', E: 'East', SE: 'South-east', S: 'South', SW: 'South-west', W: 'West', NW: 'North-west'
}

export function PushbackPage() {
  const { state, connection, mutate } = useAppState()
  const [selectedTugId, setSelectedTugId] = useState('')
  const [aircraftCallsign, setAircraftCallsign] = useState('EL AL 315')
  const [aircraftStand, setAircraftStand] = useState('C-6')
  const [startupPointId, setStartupPointId] = useState('')
  const [direction, setDirection] = useState<CardinalDirection | ''>('')
  const [presetId, setPresetId] = useState('')
  const [customRoute, setCustomRoute] = useState<MapPoint[]>([])
  const [instruction, setInstruction] = useState('')
  const [drawMode, setDrawMode] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sentMessage, setSentMessage] = useState('')

  const tugs = useMemo(() => (state?.vehicles ?? []).filter((vehicle) => vehicle.type === 'pushback'), [state?.vehicles])
  const effectiveTugId = selectedTugId || tugs[0]?.id || ''
  const selectedTug = tugs.find((tug) => tug.id === effectiveTugId)
  const selectedPreset = state?.pushPresets.find((preset) => preset.id === presetId)
    ?? (!startupPointId && !presetId ? state?.pushPresets[0] : undefined)
  const effectiveStartupId = startupPointId || selectedPreset?.startupPointId || state?.startupPoints[0]?.id || ''
  const selectedStartup = state?.startupPoints.find((point) => point.id === effectiveStartupId)
  const effectiveDirection = direction || selectedPreset?.direction || selectedStartup?.directions[0] || ''
  const previewRoute = customRoute.length > 0 ? customRoute : selectedPreset?.route ?? []
  const activeJobs = (state?.assignments ?? []).filter((assignment) => assignment.kind === 'pushback' && !['completed', 'cancelled'].includes(assignment.status))

  function chooseStartup(id: string) {
    const point = state?.startupPoints.find((candidate) => candidate.id === id)
    setStartupPointId(id)
    setDirection(point?.directions[0] ?? '')
    if (selectedPreset?.startupPointId !== id) setPresetId('')
  }

  function choosePreset(id: string) {
    const preset = state?.pushPresets.find((candidate) => candidate.id === id)
    if (!preset) return
    setPresetId(id)
    setStartupPointId(preset.startupPointId)
    setDirection(preset.direction)
    setInstruction(preset.instruction)
    setCustomRoute([])
  }

  async function transmit() {
    if (!selectedTug || !selectedStartup || !effectiveDirection) return
    if (previewRoute.length < 2) {
      setError('Choose a preset or draw at least two ordered route points on the Terminal 3 map.')
      return
    }
    setBusy(true)
    setError('')
    setSentMessage('')
    const payload: AssignmentInput = {
      vehicleId: selectedTug.id,
      kind: 'pushback',
      map: 'terminal',
      title: `${aircraftCallsign} · Stand ${aircraftStand} → SP ${selectedStartup.name}`,
      instruction: instruction.trim() || selectedPreset?.instruction || `Proceed to stand ${aircraftStand}, push ${aircraftCallsign} to startup position ${selectedStartup.name}, final direction ${directionNames[effectiveDirection]}.`,
      route: previewRoute,
      priority: 'priority',
      pushback: {
        aircraftCallsign: aircraftCallsign.trim(),
        aircraftStand: aircraftStand.trim(),
        startupPointId: selectedStartup.id,
        direction: effectiveDirection,
        presetId: selectedPreset?.id
      }
    }
    try {
      await mutate<Assignment, AssignmentInput>('/api/assignments', payload)
      setSentMessage(`Pushback instruction transmitted to ${selectedTug.callsign}.`)
      setCustomRoute([])
      setDrawMode(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Pushback assignment could not be transmitted')
    } finally {
      setBusy(false)
    }
  }

  if (!state) return <div className="loading-screen"><span className="loading-spinner" /> Loading Terminal 3 pushback control…</div>

  return (
    <div className="operations-page pushback-page">
      <header className="operations-header">
        <div><span className="eyebrow">Terminal 3 · Apron control</span><h1>Pushback control</h1></div>
        <div className="operations-header__metrics">
          <span className={`connection-indicator connection-indicator--${connection}`}><CircleDot /><span><strong>{connection === 'live' ? 'Live link' : connection}</strong><small>Mac host</small></span></span>
          <span><strong>{tugs.filter((tug) => tug.connected).length}/{tugs.length}</strong><small>tugs online</small></span>
          <span><strong>{activeJobs.length}</strong><small>active pushbacks</small></span>
          <span><strong>{state.startupPoints.length}</strong><small>startup points</small></span>
        </div>
      </header>

      {error && <div className="inline-alert inline-alert--danger" role="alert"><AlertTriangle /><span>{error}</span><button type="button" onClick={() => setError('')}>Dismiss</button></div>}
      {sentMessage && <div className="inline-alert inline-alert--success" role="status"><CheckCircle2 /><span>{sentMessage}</span><button type="button" onClick={() => setSentMessage('')}>Dismiss</button></div>}

      <div className="pushback-layout">
        <section className="pushback-map-column">
          <MapCanvas
            mapId="terminal"
            vehicles={tugs}
            startupPoints={state.startupPoints}
            selectedVehicleId={effectiveTugId}
            route={previewRoute}
            draftRoute={customRoute}
            onVehicleSelect={setSelectedTugId}
            onStartupPointSelect={(point) => chooseStartup(point.id)}
            onMapClick={drawMode ? (point) => setCustomRoute((route) => [...route, { ...point, label: `Push point ${route.length + 1}` }]) : undefined}
            interactiveLabel={drawMode ? 'Custom push route drawing' : 'Pushback preview'}
          />

          <section className="active-jobs panel-card">
            <div className="panel-card__header"><div><span className="eyebrow">Live board</span><h2>Active pushbacks</h2></div><span className="count-pill">{activeJobs.length}</span></div>
            {activeJobs.length ? (
              <div className="job-grid">
                {activeJobs.map((job) => {
                  const tug = tugs.find((vehicle) => vehicle.id === job.vehicleId)
                  const point = state.startupPoints.find((candidate) => candidate.id === job.pushback?.startupPointId)
                  return (
                    <article className="job-card" key={job.id}>
                      <div className="job-card__top"><span className="job-card__icon"><Plane /></span><StatusBadge status={job.status} /></div>
                      <strong>{job.pushback?.aircraftCallsign}</strong>
                      <p>{tug?.callsign} · Stand {job.pushback?.aircraftStand}</p>
                      <div className="job-card__route"><span>SP {point?.name}</span><MoveRight /><span>{job.pushback?.direction}</span></div>
                    </article>
                  )
                })}
              </div>
            ) : <div className="empty-state empty-state--compact"><Truck /><h3>No active pushbacks</h3><p>New transmitted jobs will appear here.</p></div>}
          </section>
        </section>

        <aside className="pushback-composer panel-card">
          <div className="panel-card__header"><div><span className="eyebrow">New instruction</span><h2>Build pushback job</h2></div><span className="step-count">6 steps</span></div>

          <ol className="composer-steps">
            <li className={selectedTug ? 'composer-step--complete' : ''}>
              <span>1</span>
              <div><label htmlFor="push-tug">Select tug</label><select id="push-tug" value={effectiveTugId} onChange={(event) => setSelectedTugId(event.target.value)}>{tugs.map((tug) => <option key={tug.id} value={tug.id}>{tug.callsign} · {tug.connected ? 'online' : 'offline'}</option>)}</select></div>
            </li>
            <li className={aircraftCallsign && aircraftStand ? 'composer-step--complete' : ''}>
              <span>2</span>
              <fieldset><legend>Aircraft and stand</legend><div className="form-row"><label>Aircraft callsign<input value={aircraftCallsign} onChange={(event) => setAircraftCallsign(event.target.value.toUpperCase())} /></label><label>Stand<input value={aircraftStand} onChange={(event) => setAircraftStand(event.target.value.toUpperCase())} /></label></div></fieldset>
            </li>
            <li className={selectedStartup ? 'composer-step--complete' : ''}>
              <span>3</span>
              <div><label htmlFor="startup-point">Startup position</label><select id="startup-point" value={effectiveStartupId} onChange={(event) => chooseStartup(event.target.value)}>{state.startupPoints.filter((point) => point.active).map((point) => <option value={point.id} key={point.id}>SP {point.name} · {point.directions.join('/')}</option>)}</select></div>
            </li>
            <li className={effectiveDirection ? 'composer-step--complete' : ''}>
              <span>4</span>
              <fieldset><legend>Final aircraft direction</legend><div className="direction-grid">{(['N','NE','E','SE','S','SW','W','NW'] as CardinalDirection[]).map((candidate) => { const allowed = selectedStartup?.directions.includes(candidate); return <button key={candidate} type="button" className={effectiveDirection === candidate ? 'direction-button direction-button--selected' : 'direction-button'} disabled={!allowed} onClick={() => setDirection(candidate)} title={allowed ? directionNames[candidate] : `Not configured for SP ${selectedStartup?.name}`}><Navigation style={{ transform: `rotate(${(['N','NE','E','SE','S','SW','W','NW'] as CardinalDirection[]).indexOf(candidate) * 45}deg)` }} />{candidate}</button> })}</div></fieldset>
            </li>
            <li className={previewRoute.length >= 2 ? 'composer-step--complete' : ''}>
              <span>5</span>
              <fieldset><legend>Push route</legend><div className="preset-list">{state.pushPresets.filter((preset) => preset.startupPointId === effectiveStartupId).map((preset) => <button type="button" className={presetId === preset.id && !customRoute.length ? 'preset-card preset-card--selected' : 'preset-card'} key={preset.id} onClick={() => choosePreset(preset.id)}><Route /><span><strong>{preset.name}</strong><small>{preset.route.length} points · face {preset.direction}</small></span></button>)}</div><div className="route-tool-row"><button type="button" className={drawMode ? 'mode-toggle mode-toggle--active' : 'mode-toggle'} onClick={() => { setDrawMode((value) => !value); setPresetId('') }}><Route /> {drawMode ? 'Click map now' : 'Draw custom'}</button><button type="button" className="icon-text-button" onClick={() => setCustomRoute((route) => route.slice(0, -1))} disabled={!customRoute.length}><Undo2 /> Undo</button><button type="button" className="icon-text-button" onClick={() => setCustomRoute([])} disabled={!customRoute.length}><Eraser /> Clear</button></div><small className="helper-text">{previewRoute.length} route points in preview</small></fieldset>
            </li>
            <li className={previewRoute.length >= 2 ? 'composer-step--complete' : ''}>
              <span>6</span>
              <div><label htmlFor="push-instruction">Review instruction</label><textarea id="push-instruction" rows={4} value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder={selectedPreset?.instruction ?? 'Explicit push and stop instruction shown to the tug driver'} /></div>
            </li>
          </ol>

          <section className="pushback-review">
            <span className="eyebrow">Transmission preview</span>
            <div><strong>{selectedTug?.callsign ?? 'Select tug'}</strong><MoveRight /><strong>Stand {aircraftStand || '—'}</strong><MoveRight /><strong>SP {selectedStartup?.name ?? '—'}</strong></div>
            <p>{aircraftCallsign || 'Aircraft'} · final aircraft heading <strong>{effectiveDirection ? directionNames[effectiveDirection] : 'not selected'}</strong></p>
          </section>
          <button className="button button--primary button--full button--large" type="button" onClick={transmit} disabled={busy || !selectedTug || !selectedStartup || !effectiveDirection || previewRoute.length < 2 || !aircraftCallsign || !aircraftStand}>
            {busy ? <span className="button-spinner" /> : <Send />} Transmit pushback instruction
          </button>
          <p className="form-safety-note"><ShieldCheck /> The tug must acknowledge the job. Startup position selection does not itself authorize entry into a runway or protected area.</p>
        </aside>
      </div>
    </div>
  )
}
