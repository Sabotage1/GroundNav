import { useState, type FormEvent } from 'react'
import {
  AlertTriangle,
  Check,
  ChevronRight,
  CircleDot,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  LogOut,
  MapPin,
  Navigation,
  Plus,
  Route,
  Save,
  ShieldCheck,
  Trash2,
  Undo2
} from 'lucide-react'
import { MapCanvas } from '../components/MapCanvas'
import { StatusBadge } from '../components/StatusBadge'
import { apiFetch } from '../lib/api'
import { useAppState } from '../state/AppStateContext'
import type { CardinalDirection, HoldingPoint, MapPoint, PushPreset, StartupPoint } from '../types'

type AdminTab = 'startup' | 'holding' | 'presets'
const directions: CardinalDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

const emptyStartup = (): Partial<StartupPoint> => ({ name: '', x: 50, y: 50, directions: ['N'], active: true })
const emptyHolding = (): Partial<HoldingPoint> => ({ name: '', runway: '03/21', x: 50, y: 50, mandatory: true, active: true })
const emptyPreset = (): Partial<PushPreset> => ({ name: '', startupPointId: '', direction: 'N', route: [], instruction: '', tugNotes: '' })

export function AdminPage() {
  const { state, connection, mutate } = useAppState()
  const [token, setToken] = useState(() => sessionStorage.getItem('groundnav.adminToken') ?? '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [tab, setTab] = useState<AdminTab>('startup')
  const [startupDraft, setStartupDraft] = useState<Partial<StartupPoint>>(emptyStartup)
  const [holdingDraft, setHoldingDraft] = useState<Partial<HoldingPoint>>(emptyHolding)
  const [presetDraft, setPresetDraft] = useState<Partial<PushPreset>>(emptyPreset)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const presetStartupId = presetDraft.startupPointId || state?.startupPoints[0]?.id || ''
  const selectedPresetStartup = state?.startupPoints.find((point) => point.id === presetStartupId)
  const selectedPresetDirection = selectedPresetStartup?.directions.includes(presetDraft.direction as CardinalDirection)
    ? presetDraft.direction as CardinalDirection
    : selectedPresetStartup?.directions[0] ?? 'N'

  async function login(event: FormEvent) {
    event.preventDefault()
    setLoggingIn(true)
    setLoginError('')
    try {
      const result = await apiFetch<{ token: string }>('/api/admin/login', { method: 'POST', body: { password } })
      sessionStorage.setItem('groundnav.adminToken', result.token)
      setToken(result.token)
      setPassword('')
    } catch (caught) {
      setLoginError(caught instanceof Error ? caught.message : 'Login failed')
    } finally {
      setLoggingIn(false)
    }
  }

  async function adminMutation<TResponse = unknown>(path: string, body?: unknown, method = 'POST') {
    return mutate<TResponse, unknown>(path, body, { method, headers: { 'x-admin-token': token } })
  }

  function handleAdminError(caught: unknown) {
    const text = caught instanceof Error ? caught.message : 'Admin change could not be saved'
    setError(text)
    if (/session|required|401/i.test(text)) {
      sessionStorage.removeItem('groundnav.adminToken')
      setToken('')
    }
  }

  async function saveStartup() {
    setBusy(true); setError(''); setMessage('')
    try {
      await adminMutation<StartupPoint>('/api/admin/startup-points', startupDraft)
      setMessage(`Startup position ${startupDraft.name} saved.`)
      setStartupDraft(emptyStartup())
    } catch (caught) { handleAdminError(caught) } finally { setBusy(false) }
  }

  async function saveHolding() {
    setBusy(true); setError(''); setMessage('')
    try {
      await adminMutation<HoldingPoint>('/api/admin/holding-points', holdingDraft)
      setMessage(`Holding point ${holdingDraft.name} saved.`)
      setHoldingDraft(emptyHolding())
    } catch (caught) { handleAdminError(caught) } finally { setBusy(false) }
  }

  async function savePreset() {
    setBusy(true); setError(''); setMessage('')
    try {
      const payload = { ...presetDraft, startupPointId: presetStartupId, direction: selectedPresetDirection }
      await adminMutation<PushPreset>('/api/admin/push-presets', payload)
      setMessage(`Pushback preset ${presetDraft.name} saved and is available to the controller.`)
      setPresetDraft(emptyPreset())
    } catch (caught) { handleAdminError(caught) } finally { setBusy(false) }
  }

  async function remove(path: string, label: string) {
    if (!window.confirm(`Delete ${label}? Presets that depend on a deleted startup point will also be removed.`)) return
    setBusy(true); setError(''); setMessage('')
    try {
      await adminMutation(path, undefined, 'DELETE')
      setMessage(`${label} deleted.`)
    } catch (caught) { handleAdminError(caught) } finally { setBusy(false) }
  }

  async function logout() {
    try { await apiFetch('/api/admin/logout', { method: 'POST', headers: { 'x-admin-token': token } }) } catch { /* Session may already be gone. */ }
    sessionStorage.removeItem('groundnav.adminToken')
    setToken('')
  }

  if (!token) {
    return (
      <div className="admin-login-page">
        <section className="admin-login-card">
          <span className="admin-login-card__icon"><LockKeyhole /></span>
          <span className="eyebrow">Protected configuration</span>
          <h1>GroundNav administration</h1>
          <p>Sign in to edit LLBG holding points, startup directions and controller pushback presets.</p>
          <div className="test-credential-warning"><AlertTriangle /><span><strong>Test credential only</strong><small>Password is set to 1337 for this simulator. Replace it before any shared deployment.</small></span></div>
          <form onSubmit={login}>
            <label htmlFor="admin-password">Admin password</label>
            <div className="password-field"><KeyRound /><input id="admin-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" inputMode="numeric" autoFocus /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff /> : <Eye />}</button></div>
            {loginError && <p className="form-error" role="alert">{loginError}</p>}
            <button className="button button--primary button--full button--large" type="submit" disabled={loggingIn || !password}>{loggingIn ? <span className="button-spinner" /> : <ShieldCheck />} Unlock admin editor</button>
          </form>
          <p className="admin-login-card__footnote">Sessions are stored only in this browser tab and are cleared when you sign out.</p>
        </section>
      </div>
    )
  }

  if (!state) return <div className="loading-screen"><span className="loading-spinner" /> Loading administrator data…</div>

  const mapId = tab === 'holding' ? 'airport' : 'terminal'
  const currentPoint = tab === 'startup' ? startupDraft : holdingDraft
  const coordinateWidth = mapId === 'airport' ? 1956 : 1724
  const coordinateHeight = mapId === 'airport' ? 1438 : 1026

  function handleMapClick(point: MapPoint) {
    if (tab === 'startup') setStartupDraft((draft) => ({ ...draft, x: point.x, y: point.y }))
    else if (tab === 'holding') setHoldingDraft((draft) => ({ ...draft, x: point.x, y: point.y }))
    else setPresetDraft((draft) => ({ ...draft, route: [...(draft.route ?? []), { ...point, label: `Push point ${(draft.route?.length ?? 0) + 1}` }] }))
  }

  return (
    <div className="operations-page admin-page">
      <header className="operations-header">
        <div><span className="eyebrow">Protected configuration · LLBG</span><h1>Map administration</h1></div>
        <div className="operations-header__metrics">
          <span className={`connection-indicator connection-indicator--${connection}`}><CircleDot /><span><strong>{connection === 'live' ? 'Live server' : connection}</strong><small>Revision {state.revision}</small></span></span>
          <span><strong>{state.holdingPoints.length}</strong><small>holding points</small></span>
          <span><strong>{state.startupPoints.length}</strong><small>startup points</small></span>
          <button className="button button--secondary button--small" type="button" onClick={logout}><LogOut /> Sign out</button>
        </div>
      </header>

      <div className="admin-warning"><AlertTriangle /><div><strong>Live simulator configuration</strong><span>Changes become available to new controller assignments immediately. Existing assignments keep their transmitted route snapshot.</span></div></div>
      {message && <div className="inline-alert inline-alert--success" role="status"><Check /><span>{message}</span><button type="button" onClick={() => setMessage('')}>Dismiss</button></div>}
      {error && <div className="inline-alert inline-alert--danger" role="alert"><AlertTriangle /><span>{error}</span><button type="button" onClick={() => setError('')}>Dismiss</button></div>}

      <nav className="admin-tabs" aria-label="Admin editor sections">
        <button type="button" className={tab === 'startup' ? 'admin-tab admin-tab--active' : 'admin-tab'} onClick={() => setTab('startup')}><Navigation /><span><strong>Startup positions</strong><small>Points and allowed headings</small></span><span className="count-pill">{state.startupPoints.length}</span></button>
        <button type="button" className={tab === 'holding' ? 'admin-tab admin-tab--active' : 'admin-tab'} onClick={() => setTab('holding')}><MapPin /><span><strong>Runway holding points</strong><small>Authorization-required gates</small></span><span className="count-pill">{state.holdingPoints.length}</span></button>
        <button type="button" className={tab === 'presets' ? 'admin-tab admin-tab--active' : 'admin-tab'} onClick={() => setTab('presets')}><Route /><span><strong>Pushback presets</strong><small>Controller-ready routes</small></span><span className="count-pill">{state.pushPresets.length}</span></button>
      </nav>

      <div className="admin-editor-layout">
        <aside className="entity-list panel-card">
          <div className="panel-card__header"><div><span className="eyebrow">Published entities</span><h2>{tab === 'startup' ? 'Startup positions' : tab === 'holding' ? 'Holding points' : 'Pushback presets'}</h2></div><button className="icon-button" type="button" aria-label="Create new entity" onClick={() => tab === 'startup' ? setStartupDraft(emptyStartup()) : tab === 'holding' ? setHoldingDraft(emptyHolding()) : setPresetDraft(emptyPreset())}><Plus /></button></div>
          <div className="entity-list__items">
            {tab === 'startup' && state.startupPoints.map((point) => <article key={point.id} className={startupDraft.id === point.id ? 'entity-row entity-row--selected' : 'entity-row'}><button type="button" onClick={() => setStartupDraft({ ...point })}><span className="entity-row__symbol">{point.name}</span><span><strong>SP {point.name}</strong><small>{point.directions.join(' · ')} · X {point.x.toFixed(1)} / Y {point.y.toFixed(1)}</small></span><ChevronRight /></button><button type="button" className="entity-delete" aria-label={`Delete startup position ${point.name}`} onClick={() => remove(`/api/admin/startup-points/${point.id}`, `startup position ${point.name}`)}><Trash2 /></button></article>)}
            {tab === 'holding' && state.holdingPoints.map((point) => <article key={point.id} className={holdingDraft.id === point.id ? 'entity-row entity-row--selected' : 'entity-row'}><button type="button" onClick={() => setHoldingDraft({ ...point })}><span className="entity-row__hold"><LockKeyhole /></span><span><strong>{point.name}</strong><small>RWY {point.runway} · {point.needsReview ? 'needs review' : 'verified seed'}</small></span><ChevronRight /></button><button type="button" className="entity-delete" aria-label={`Delete holding point ${point.name}`} onClick={() => remove(`/api/admin/holding-points/${point.id}`, `holding point ${point.name}`)}><Trash2 /></button></article>)}
            {tab === 'presets' && state.pushPresets.map((preset) => { const point = state.startupPoints.find((candidate) => candidate.id === preset.startupPointId); return <article key={preset.id} className={presetDraft.id === preset.id ? 'entity-row entity-row--selected' : 'entity-row'}><button type="button" onClick={() => setPresetDraft({ ...preset, route: preset.route.map((routePoint) => ({ ...routePoint })) })}><span className="entity-row__hold"><Route /></span><span><strong>{preset.name}</strong><small>SP {point?.name} · {preset.direction} · {preset.route.length} points</small></span><ChevronRight /></button><button type="button" className="entity-delete" aria-label={`Delete preset ${preset.name}`} onClick={() => remove(`/api/admin/push-presets/${preset.id}`, `preset ${preset.name}`)}><Trash2 /></button></article> })}
          </div>
        </aside>

        <MapCanvas
          mapId={mapId}
          holdingPoints={tab === 'holding' ? state.holdingPoints : []}
          startupPoints={tab !== 'holding' ? state.startupPoints : []}
          draftRoute={tab === 'presets' ? presetDraft.route ?? [] : currentPoint.x !== undefined && currentPoint.y !== undefined ? [{ x: currentPoint.x, y: currentPoint.y }] : []}
          onMapClick={handleMapClick}
          onHoldingPointSelect={(point) => setHoldingDraft({ ...point })}
          onStartupPointSelect={(point) => tab === 'startup' ? setStartupDraft({ ...point }) : setPresetDraft((draft) => ({ ...draft, startupPointId: point.id, direction: point.directions[0] }))}
          interactiveLabel={tab === 'startup' ? 'Click to place startup position' : tab === 'holding' ? 'Click to place runway hold' : 'Click ordered push route points'}
        />

        <aside className="properties-panel panel-card">
          <div className="panel-card__header"><div><span className="eyebrow">Properties</span><h2>{tab === 'startup' ? (startupDraft.id ? `Edit SP ${startupDraft.name}` : 'New startup position') : tab === 'holding' ? (holdingDraft.id ? `Edit ${holdingDraft.name}` : 'New holding point') : (presetDraft.id ? 'Edit pushback preset' : 'New pushback preset')}</h2></div><StatusBadge status="ready" label={tab === 'presets' ? `${presetDraft.route?.length ?? 0} points` : 'Draft'} /></div>

          {tab === 'startup' && (
            <div className="properties-form">
              <label>Position number / name<input value={startupDraft.name ?? ''} onChange={(event) => setStartupDraft((draft) => ({ ...draft, name: event.target.value.replace(/^SP\s*/i, '') }))} placeholder="24" /></label>
              <CoordinateFields x={startupDraft.x} y={startupDraft.y} width={1724} height={1026} onChange={(x, y) => setStartupDraft((draft) => ({ ...draft, x, y }))} />
              <fieldset><legend>Allowed final directions</legend><p className="helper-text">Select every aircraft-facing direction permitted at this point.</p><div className="direction-check-grid">{directions.map((candidate) => { const selected = startupDraft.directions?.includes(candidate); return <label className={selected ? 'direction-check direction-check--selected' : 'direction-check'} key={candidate}><input type="checkbox" checked={selected} onChange={() => setStartupDraft((draft) => ({ ...draft, directions: selected ? draft.directions?.filter((item) => item !== candidate) : [...(draft.directions ?? []), candidate] }))} /><Navigation style={{ transform: `rotate(${directions.indexOf(candidate) * 45}deg)` }} /><span>{candidate}</span></label> })}</div></fieldset>
              <label>Notes<textarea rows={3} value={startupDraft.notes ?? ''} onChange={(event) => setStartupDraft((draft) => ({ ...draft, notes: event.target.value }))} placeholder="Optional controller setup note" /></label>
              <button className="button button--primary button--full" type="button" onClick={saveStartup} disabled={busy || !startupDraft.name || !startupDraft.directions?.length}><Save /> Save startup position</button>
            </div>
          )}

          {tab === 'holding' && (
            <div className="properties-form">
              <label>Holding point name<input value={holdingDraft.name ?? ''} onChange={(event) => setHoldingDraft((draft) => ({ ...draft, name: event.target.value }))} placeholder="H38 · Taxiway K" /></label>
              <label>Associated runway<select value={holdingDraft.runway ?? '03/21'} onChange={(event) => setHoldingDraft((draft) => ({ ...draft, runway: event.target.value }))}><option>03/21</option><option>08/26</option><option>12/30</option><option>Protected area</option></select></label>
              <CoordinateFields x={holdingDraft.x} y={holdingDraft.y} width={1956} height={1438} onChange={(x, y) => setHoldingDraft((draft) => ({ ...draft, x, y }))} />
              <div className="locked-setting"><LockKeyhole /><span><strong>Tower authorization required</strong><small>Locked on for all runway holding points</small></span><StatusBadge status="authorized" label="Enabled" /></div>
              <label>Notes<textarea rows={3} value={holdingDraft.notes ?? ''} onChange={(event) => setHoldingDraft((draft) => ({ ...draft, notes: event.target.value }))} placeholder="Approach side or review note" /></label>
              <button className="button button--primary button--full" type="button" onClick={saveHolding} disabled={busy || !holdingDraft.name || !holdingDraft.runway}><Save /> Save holding point</button>
            </div>
          )}

          {tab === 'presets' && (
            <div className="properties-form">
              <label>Preset name<input value={presetDraft.name ?? ''} onChange={(event) => setPresetDraft((draft) => ({ ...draft, name: event.target.value }))} placeholder="Pier C to SP 24" /></label>
              <label>Startup position<select value={presetStartupId} onChange={(event) => { const point = state.startupPoints.find((candidate) => candidate.id === event.target.value); setPresetDraft((draft) => ({ ...draft, startupPointId: event.target.value, direction: point?.directions[0] })) }}>{state.startupPoints.map((point) => <option key={point.id} value={point.id}>SP {point.name} · {point.directions.join('/')}</option>)}</select></label>
              <fieldset><legend>Final direction</legend><div className="direction-grid">{directions.map((candidate) => { const allowed = selectedPresetStartup?.directions.includes(candidate); return <button type="button" key={candidate} disabled={!allowed} className={selectedPresetDirection === candidate ? 'direction-button direction-button--selected' : 'direction-button'} onClick={() => setPresetDraft((draft) => ({ ...draft, direction: candidate }))}>{candidate}</button> })}</div></fieldset>
              <div className="route-editor-summary"><Route /><span><strong>{presetDraft.route?.length ?? 0} ordered route points</strong><small>Click the map to add points from stand toward the startup position.</small></span><button type="button" className="icon-text-button" onClick={() => setPresetDraft((draft) => ({ ...draft, route: draft.route?.slice(0, -1) }))} disabled={!presetDraft.route?.length}><Undo2 /> Undo</button></div>
              <label>Driver instruction<textarea rows={4} value={presetDraft.instruction ?? ''} onChange={(event) => setPresetDraft((draft) => ({ ...draft, instruction: event.target.value }))} placeholder="Push tail…, follow the marked line…, stop at SP…" /></label>
              <label>Tug notes<textarea rows={2} value={presetDraft.tugNotes ?? ''} onChange={(event) => setPresetDraft((draft) => ({ ...draft, tugNotes: event.target.value }))} placeholder="Optional hook-up or disconnect note" /></label>
              <button className="button button--primary button--full" type="button" onClick={savePreset} disabled={busy || !presetDraft.name || !presetStartupId || (presetDraft.route?.length ?? 0) < 2}><Save /> Save controller preset</button>
            </div>
          )}

          {tab !== 'presets' && (
            <div className="coordinate-readout"><span>Source image pixel</span><strong>{Math.round(((currentPoint.x ?? 0) / 100) * coordinateWidth)} × {Math.round(((currentPoint.y ?? 0) / 100) * coordinateHeight)}</strong><small>{coordinateWidth} × {coordinateHeight} original raster</small></div>
          )}
        </aside>
      </div>
    </div>
  )
}

function CoordinateFields({ x = 0, y = 0, width, height, onChange }: { x?: number; y?: number; width: number; height: number; onChange: (x: number, y: number) => void }) {
  return (
    <fieldset className="coordinate-fields"><legend>Map coordinates</legend><p className="helper-text">Click the map or enter normalized percentages. Source pixels are shown for fine tuning.</p><div className="form-row"><label>X percent<input type="number" min="0" max="100" step="0.01" value={Number(x.toFixed(2))} onChange={(event) => onChange(Number(event.target.value), y)} /></label><label>Y percent<input type="number" min="0" max="100" step="0.01" value={Number(y.toFixed(2))} onChange={(event) => onChange(x, Number(event.target.value))} /></label></div><div className="pixel-readout"><span><small>Pixel X</small><strong>{Math.round((x / 100) * width)}</strong></span><span><small>Pixel Y</small><strong>{Math.round((y / 100) * height)}</strong></span></div></fieldset>
  )
}
