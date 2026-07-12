import {
  Circle,
  CircleCheck,
  CircleX,
  Clock3,
  Navigation,
  OctagonAlert,
  Send,
  ShieldCheck,
  TriangleAlert,
  WifiOff,
  type LucideIcon
} from 'lucide-react'

export type StatusBadgeStatus =
  | 'idle'
  | 'available'
  | 'ready'
  | 'assigned'
  | 'sent'
  | 'delivered'
  | 'acknowledged'
  | 'moving'
  | 'in_progress'
  | 'holding'
  | 'required'
  | 'requested'
  | 'authorized'
  | 'crossed'
  | 'completed'
  | 'stopped'
  | 'emergency'
  | 'cancelled'
  | 'connected'
  | 'online'
  | 'offline'
  | 'disconnected'
  | 'stale'
  | 'comms_lost'
  | 'off_route'

type StatusTone = 'neutral' | 'info' | 'active' | 'warning' | 'danger' | 'success' | 'offline'

interface StatusDefinition {
  label: string
  tone: StatusTone
  icon: LucideIcon
}

const statusDefinitions: Record<StatusBadgeStatus, StatusDefinition> = {
  idle: { label: 'Idle', tone: 'neutral', icon: Circle },
  available: { label: 'Available', tone: 'success', icon: CircleCheck },
  ready: { label: 'Ready', tone: 'success', icon: CircleCheck },
  assigned: { label: 'Assigned', tone: 'info', icon: Send },
  sent: { label: 'Sent', tone: 'info', icon: Send },
  delivered: { label: 'Delivered', tone: 'info', icon: Send },
  acknowledged: { label: 'Acknowledged', tone: 'success', icon: ShieldCheck },
  moving: { label: 'En route', tone: 'active', icon: Navigation },
  in_progress: { label: 'In progress', tone: 'active', icon: Navigation },
  holding: { label: 'Holding', tone: 'warning', icon: Clock3 },
  required: { label: 'Clearance required', tone: 'warning', icon: Clock3 },
  requested: { label: 'Clearance requested', tone: 'warning', icon: Clock3 },
  authorized: { label: 'Authorized', tone: 'success', icon: ShieldCheck },
  crossed: { label: 'Crossed', tone: 'success', icon: CircleCheck },
  completed: { label: 'Completed', tone: 'success', icon: CircleCheck },
  stopped: { label: 'Stopped', tone: 'danger', icon: OctagonAlert },
  emergency: { label: 'Emergency', tone: 'danger', icon: OctagonAlert },
  cancelled: { label: 'Cancelled', tone: 'danger', icon: CircleX },
  connected: { label: 'Connected', tone: 'success', icon: ShieldCheck },
  online: { label: 'Online', tone: 'success', icon: ShieldCheck },
  offline: { label: 'Offline', tone: 'offline', icon: WifiOff },
  disconnected: { label: 'Disconnected', tone: 'offline', icon: WifiOff },
  stale: { label: 'Position stale', tone: 'offline', icon: WifiOff },
  comms_lost: { label: 'Communications lost', tone: 'offline', icon: WifiOff },
  off_route: { label: 'Off route', tone: 'warning', icon: TriangleAlert }
}

interface StatusBadgeProps {
  status: StatusBadgeStatus | (string & {})
  label?: string
  announce?: boolean
  className?: string
}

function normalizeStatus(status: string) {
  return status.trim().toLowerCase().replace(/[\s-]+/g, '_')
}

function readableStatus(status: string) {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function StatusBadge({ status, label, announce = false, className }: StatusBadgeProps) {
  const normalizedStatus = normalizeStatus(status) || 'unknown'
  const definition = statusDefinitions[normalizedStatus as StatusBadgeStatus]
  const Icon = definition?.icon ?? Circle
  const tone = definition?.tone ?? 'neutral'
  const visibleLabel = label ?? definition?.label ?? readableStatus(normalizedStatus)
  const statusClass = normalizedStatus.replace(/[^a-z0-9_-]/g, '')

  return (
    <span
      className={[
        'status-badge',
        `status-badge--${tone}`,
        `status-badge--status-${statusClass}`,
        className
      ].filter(Boolean).join(' ')}
      data-status={normalizedStatus}
      data-tone={tone}
      role={announce ? 'status' : undefined}
      aria-live={announce ? 'polite' : undefined}
    >
      <Icon className="status-badge__icon" size={14} strokeWidth={2.5} aria-hidden="true" />
      <span className="status-badge__label">{visibleLabel}</span>
    </span>
  )
}
