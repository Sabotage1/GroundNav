import { ArrowRight, CarFront, ChevronRight, ClipboardCheck, RadioTower, ShieldCheck, Truck, Waypoints } from 'lucide-react'
import { Link } from 'react-router-dom'

const roles = [
  {
    to: '/vehicle',
    eyebrow: 'Android / vehicle',
    title: 'Vehicle navigation',
    description: 'Receive routes, acknowledge instructions, request runway-crossing clearance and report progress.',
    icon: CarFront,
    accent: 'green'
  },
  {
    to: '/tower',
    eyebrow: 'Mac / tower',
    title: 'Airfield control',
    description: 'Monitor the full fleet, draw routes, issue STOP or HOLD instructions and authorize crossings.',
    icon: RadioTower,
    accent: 'blue'
  },
  {
    to: '/pushback',
    eyebrow: 'Terminal 3',
    title: 'Pushback control',
    description: 'Assign tugs to aircraft, select startup positions and transmit approved pushback paths.',
    icon: Truck,
    accent: 'violet'
  },
  {
    to: '/admin',
    eyebrow: 'Protected setup',
    title: 'Map administration',
    description: 'Create holding points, multi-direction startup positions and reusable pushback presets.',
    icon: ShieldCheck,
    accent: 'amber'
  }
]

export function HomePage() {
  return (
    <div className="home-page page-width">
      <section className="hero-panel">
        <div className="hero-panel__copy">
          <span className="eyebrow"><span className="live-pip" /> LLBG live ground simulator</span>
          <h1>One shared picture for every vehicle on the airfield.</h1>
          <p>
            GroundNav connects the control tower and airport vehicles through clear, acknowledged instructions—using the supplied LLBG charts as a test environment.
          </p>
          <div className="hero-actions">
            <Link className="button button--primary" to="/tower">Open tower console <ArrowRight /></Link>
            <Link className="button button--secondary" to="/vehicle">Open vehicle app</Link>
          </div>
        </div>
        <div className="hero-panel__visual" aria-label="Operational workflow summary">
          <div className="signal-orbit signal-orbit--outer" />
          <div className="signal-orbit signal-orbit--inner" />
          <div className="tower-node"><RadioTower /></div>
          <div className="workflow-node workflow-node--one"><CarFront /><span>OPS 21</span><strong>EN ROUTE</strong></div>
          <div className="workflow-node workflow-node--two"><Truck /><span>TUG 7</span><strong>SP 24 · WEST</strong></div>
          <div className="workflow-node workflow-node--three"><ClipboardCheck /><span>HOLD W4</span><strong>AUTH REQUIRED</strong></div>
        </div>
      </section>

      <section className="home-section" aria-labelledby="choose-screen">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Choose a workstation</span>
            <h2 id="choose-screen">Start from the screen you are testing</h2>
          </div>
          <p>All screens share the same live state through this Mac.</p>
        </div>
        <div className="role-grid">
          {roles.map(({ to, eyebrow, title, description, icon: Icon, accent }) => (
            <Link className={`role-card role-card--${accent}`} to={to} key={to}>
              <span className="role-card__icon"><Icon /></span>
              <span className="role-card__eyebrow">{eyebrow}</span>
              <strong>{title}</strong>
              <span>{description}</span>
              <span className="role-card__link">Open screen <ChevronRight /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="workflow-strip" aria-label="Instruction lifecycle">
        <div><span>01</span><Waypoints /><strong>Tower draws route</strong><p>Ordered points and required holds are detected.</p></div>
        <ChevronRight className="workflow-strip__arrow" />
        <div><span>02</span><RadioTower /><strong>Instruction transmitted</strong><p>The assigned vehicle receives one persistent job.</p></div>
        <ChevronRight className="workflow-strip__arrow" />
        <div><span>03</span><ClipboardCheck /><strong>Driver acknowledges</strong><p>Progress and clearance requests return live.</p></div>
      </section>

      <aside className="safety-callout">
        <ShieldCheck aria-hidden="true" />
        <div>
          <strong>Training environment</strong>
          <p>The supplied raster charts are not georeferenced or validated for operational navigation. Runway crossings always require an explicit, separate tower authorization in the simulator.</p>
        </div>
      </aside>
    </div>
  )
}
