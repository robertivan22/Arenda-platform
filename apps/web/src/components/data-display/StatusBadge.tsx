import { clsx } from 'clsx'

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  // General
  ACTIVE:      { label: 'Activ',      classes: 'bg-green-100 text-green-800' },
  INACTIVE:    { label: 'Inactiv',    classes: 'bg-gray-100 text-gray-600' },
  DRAFT:       { label: 'Ciornă',     classes: 'bg-yellow-100 text-yellow-800' },
  ARCHIVED:    { label: 'Arhivat',    classes: 'bg-gray-100 text-gray-500' },

  // Contract statuses
  VALID:       { label: 'Valid',      classes: 'bg-green-100 text-green-800' },
  EXPIRED:     { label: 'Expirat',    classes: 'bg-orange-100 text-orange-800' },
  TERMINATED:  { label: 'Reziliat',   classes: 'bg-red-100 text-red-800' },
  PENDING:     { label: 'În așteptare', classes: 'bg-blue-100 text-blue-800' },

  // Lessor statuses
  BLOCKED_PAYMENT: { label: 'Blocat plată', classes: 'bg-red-100 text-red-800' },

  // Payment statuses
  PAID:        { label: 'Plătit',     classes: 'bg-green-100 text-green-800' },
  PARTIAL:     { label: 'Parțial',    classes: 'bg-yellow-100 text-yellow-800' },
  OVERDUE:     { label: 'Restant',    classes: 'bg-red-100 text-red-800' },
  NOT_DUE:     { label: 'Neexigibil', classes: 'bg-gray-100 text-gray-500' },

  // Physical person types
  NATURAL:     { label: 'Persoană fizică', classes: 'bg-blue-50 text-blue-700' },
  LEGAL:       { label: 'Persoană juridică', classes: 'bg-purple-50 text-purple-700' },
  PFA:         { label: 'PFA',              classes: 'bg-indigo-50 text-indigo-700' },
}

interface StatusBadgeProps {
  status: string
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status]
  const label = config?.label ?? status
  const classes = config?.classes ?? 'bg-gray-100 text-gray-700'

  return (
    <span
      className={clsx(
        'status-badge',
        classes,
        size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-xs',
      )}
    >
      {label}
    </span>
  )
}
