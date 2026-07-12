import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Home, Menu, Navigation, PlaneTakeoff, RadioTower, ShieldCheck, TriangleAlert, X } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

interface AppShellProps {
  children?: ReactNode
  compact?: boolean
  mobile?: boolean
  headerActions?: ReactNode
  className?: string
  mainClassName?: string
}

const navigationItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/tower', label: 'Tower', icon: RadioTower },
  { to: '/pushback', label: 'Pushback', icon: PlaneTakeoff },
  { to: '/admin', label: 'Admin', icon: ShieldCheck }
]

function classes(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(' ')
}

export function AppShell({
  children,
  compact = false,
  mobile = false,
  headerActions,
  className,
  mainClassName
}: AppShellProps) {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!mobileNavigationOpen) return

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setMobileNavigationOpen(false)
      mobileMenuButtonRef.current?.focus()
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [mobileNavigationOpen])

  const navigation = (variant: 'desktop' | 'mobile') => (
    <nav
      id={variant === 'mobile' ? 'mobile-primary-navigation' : undefined}
      className={`app-shell__navigation app-shell__navigation--${variant}`}
      aria-label={variant === 'mobile' ? 'Mobile primary navigation' : 'Primary navigation'}
      hidden={variant === 'mobile' && !mobileNavigationOpen}
    >
      {navigationItems.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) => classes('app-shell__nav-link', isActive && 'app-shell__nav-link--active')}
          onClick={() => setMobileNavigationOpen(false)}
        >
          <Icon className="app-shell__nav-icon" size={18} aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )

  return (
    <div
      className={classes(
        'app-shell',
        compact && 'app-shell--compact',
        mobile && 'app-shell--mobile',
        className
      )}
      data-layout={mobile ? 'mobile' : compact ? 'compact' : 'default'}
    >
      <a className="app-shell__skip-link" href="#main-content">
        Skip to main content
      </a>

      <div className="app-shell__simulation-banner" role="note" aria-label="Simulation warning">
        <TriangleAlert size={18} aria-hidden="true" />
        <strong>Simulation only</strong>
        <span aria-hidden="true">·</span>
        <span>Not for operational use</span>
      </div>

      <header className="app-shell__header">
        <div className="app-shell__header-inner">
          <NavLink className="app-shell__brand" to="/" aria-label="LLBG GroundNav home">
            <span className="app-shell__brand-mark" aria-hidden="true">
              <Navigation size={22} />
            </span>
            <span className="app-shell__brand-copy">
              <span className="app-shell__brand-name">LLBG GroundNav</span>
              {!compact && !mobile && <span className="app-shell__brand-tagline">Airside operations simulator</span>}
            </span>
          </NavLink>

          {navigation('desktop')}

          <div className="app-shell__header-actions">
            {headerActions}
            <button
              ref={mobileMenuButtonRef}
              type="button"
              className="app-shell__mobile-menu-button"
              aria-label={mobileNavigationOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileNavigationOpen}
              aria-controls="mobile-primary-navigation"
              onClick={() => setMobileNavigationOpen((open) => !open)}
            >
              {mobileNavigationOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </button>
          </div>
        </div>

        {navigation('mobile')}
      </header>

      <main
        id="main-content"
        className={classes(
          'app-shell__main',
          compact && 'app-shell__main--compact',
          mobile && 'app-shell__main--mobile',
          mainClassName
        )}
        tabIndex={-1}
      >
        {children ?? <Outlet />}
      </main>
    </div>
  )
}
