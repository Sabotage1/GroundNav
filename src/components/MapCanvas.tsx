import { useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { Crosshair, Flame, LocateFixed, Minus, Plus, RotateCcw, Truck, Wrench } from 'lucide-react'
import type { HoldingPoint, MapId, MapPoint, StartupPoint, Vehicle } from '../types'

interface MapCanvasProps {
  mapId: MapId
  vehicles?: Vehicle[]
  route?: MapPoint[]
  draftRoute?: MapPoint[]
  holdingPoints?: HoldingPoint[]
  startupPoints?: StartupPoint[]
  selectedVehicleId?: string
  activeHoldingPointIds?: string[]
  onVehicleSelect?: (vehicleId: string) => void
  onMapClick?: (point: MapPoint) => void
  onHoldingPointSelect?: (point: HoldingPoint) => void
  onStartupPointSelect?: (point: StartupPoint) => void
  interactiveLabel?: string
  toolbarExtra?: ReactNode
  className?: string
}

const mapMeta = {
  airport: { src: '/maps/llbg-airport.png', width: 1956, height: 1438, alt: 'Supplied LLBG airport diagram' },
  terminal: { src: '/maps/terminal-3.png', width: 1724, height: 1026, alt: 'Supplied LLBG Terminal 3 pushback diagram' }
}

function routePoints(points: MapPoint[]) {
  return points.map((point) => `${point.x},${point.y}`).join(' ')
}

function VehicleIcon({ vehicle }: { vehicle: Vehicle }) {
  if (vehicle.type === 'pushback') return <Truck aria-hidden="true" />
  if (vehicle.type === 'fire') return <Flame aria-hidden="true" />
  if (vehicle.type === 'maintenance') return <Wrench aria-hidden="true" />
  return <LocateFixed aria-hidden="true" />
}

export function MapCanvas({
  mapId,
  vehicles = [],
  route = [],
  draftRoute = [],
  holdingPoints = [],
  startupPoints = [],
  selectedVehicleId,
  activeHoldingPointIds = [],
  onVehicleSelect,
  onMapClick,
  onHoldingPointSelect,
  onStartupPointSelect,
  interactiveLabel,
  toolbarExtra,
  className = ''
}: MapCanvasProps) {
  const [zoom, setZoom] = useState(1)
  const stageRef = useRef<HTMLDivElement>(null)
  const meta = mapMeta[mapId]
  const visibleVehicles = useMemo(() => vehicles.filter((vehicle) => vehicle.position.map === mapId), [vehicles, mapId])

  function handleMapClick(event: MouseEvent<HTMLDivElement>) {
    if (!onMapClick || !stageRef.current) return
    if ((event.target as HTMLElement).closest('button')) return
    const bounds = stageRef.current.getBoundingClientRect()
    onMapClick({
      x: Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100)),
      y: Math.max(0, Math.min(100, ((event.clientY - bounds.top) / bounds.height) * 100))
    })
  }

  return (
    <section className={`map-card ${className}`} aria-label={interactiveLabel ?? `${mapId} operations map`}>
      <div className="map-toolbar">
        <div className="map-toolbar__title">
          <Crosshair size={16} aria-hidden="true" />
          <span>{mapId === 'airport' ? 'LLBG airfield' : 'Terminal 3 apron'}</span>
          {interactiveLabel && <span className="map-mode-chip">{interactiveLabel}</span>}
        </div>
        <div className="map-toolbar__actions">
          {toolbarExtra}
          <button type="button" className="icon-button" onClick={() => setZoom((value) => Math.min(3, value + 0.35))} aria-label="Zoom in">
            <Plus />
          </button>
          <button type="button" className="icon-button" onClick={() => setZoom((value) => Math.max(1, value - 0.35))} aria-label="Zoom out" disabled={zoom <= 1}>
            <Minus />
          </button>
          <button type="button" className="icon-button" onClick={() => setZoom(1)} aria-label="Reset map zoom" disabled={zoom === 1}>
            <RotateCcw />
          </button>
        </div>
      </div>
      <div className="map-scroll" data-map={mapId}>
        <div
          ref={stageRef}
          className={`map-stage ${onMapClick ? 'map-stage--interactive' : ''}`}
          style={{ width: `${zoom * 100}%`, aspectRatio: `${meta.width} / ${meta.height}` }}
          onClick={handleMapClick}
        >
          <img src={meta.src} width={meta.width} height={meta.height} alt={meta.alt} draggable={false} />
          <svg className="map-routes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {route.length > 1 && (
              <>
                <polyline className="route-halo" points={routePoints(route)} />
                <polyline className="route-line" points={routePoints(route)} />
              </>
            )}
            {draftRoute.length > 1 && (
              <>
                <polyline className="route-halo route-halo--draft" points={routePoints(draftRoute)} />
                <polyline className="route-line route-line--draft" points={routePoints(draftRoute)} />
              </>
            )}
          </svg>

          {route.map((point, index) => (
            <span key={`route-${index}`} className="waypoint waypoint--route" style={{ left: `${point.x}%`, top: `${point.y}%` }}>
              {index + 1}
            </span>
          ))}
          {draftRoute.map((point, index) => (
            <span key={`draft-${index}`} className="waypoint waypoint--draft" style={{ left: `${point.x}%`, top: `${point.y}%` }}>
              {index + 1}
            </span>
          ))}

          {holdingPoints.filter((point) => point.active).map((point) => (
            <button
              type="button"
              key={point.id}
              className={`hold-marker ${activeHoldingPointIds.includes(point.id) ? 'hold-marker--active' : ''}`}
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
              onClick={() => onHoldingPointSelect?.(point)}
              aria-label={`${point.name}, holding point for runway ${point.runway}${point.mandatory ? ', tower authorization required' : ''}`}
              title={`${point.name} · RWY ${point.runway}`}
            >
              <span aria-hidden="true" />
            </button>
          ))}

          {startupPoints.filter((point) => point.active).map((point) => (
            <button
              type="button"
              key={point.id}
              className="startup-marker"
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
              onClick={() => onStartupPointSelect?.(point)}
              aria-label={`Startup position ${point.name}; directions ${point.directions.join(', ')}`}
              title={`SP ${point.name} · ${point.directions.join('/')}`}
            >
              {point.name}
            </button>
          ))}

          {visibleVehicles.map((vehicle) => (
            <button
              type="button"
              key={vehicle.id}
              className={`vehicle-marker ${selectedVehicleId === vehicle.id ? 'vehicle-marker--selected' : ''} ${vehicle.connected ? '' : 'vehicle-marker--stale'}`}
              style={{ left: `${vehicle.position.x}%`, top: `${vehicle.position.y}%`, '--vehicle-color': vehicle.color } as React.CSSProperties}
              onClick={() => onVehicleSelect?.(vehicle.id)}
              aria-label={`${vehicle.callsign}, ${vehicle.status}, ${vehicle.connected ? 'connected' : 'offline'}`}
            >
              <span className="vehicle-marker__icon" style={{ transform: `rotate(${vehicle.position.heading}deg)` }}>
                <VehicleIcon vehicle={vehicle} />
              </span>
              <span className="vehicle-marker__label">{vehicle.callsign}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="map-legend" aria-label="Map legend">
        <span><i className="legend-dot legend-dot--vehicle" /> Vehicle</span>
        {mapId === 'airport' && <span><i className="legend-diamond" /> Authorization hold</span>}
        {mapId === 'terminal' && <span><i className="legend-startup" /> Startup position</span>}
        <span><i className="legend-line" /> Assigned route</span>
        <span className="map-scale-note">Normalized chart coordinates · simulation</span>
      </div>
    </section>
  )
}
