'use client'

/**
 * ResponsiveTable
 *
 * On desktop (md+): renders a standard <table>.
 * On mobile (<md):  renders stacked cards — one card per row.
 *
 * Usage:
 *   <ResponsiveTable
 *     columns={[
 *       { key: 'name', header: 'Nume', cell: (row) => row.name },
 *       { key: 'value', header: 'Valoare', cell: (row) => row.value, mobileLabel: false },
 *     ]}
 *     rows={data}
 *     keyExtractor={(row) => row.id}
 *   />
 */

import { clsx } from 'clsx'
import { useIsMobile } from '@/hooks/use-mobile'

export interface ResponsiveColumn<T> {
  key: string
  header: React.ReactNode
  /** Render cell content. Receives the row item. */
  cell: (row: T) => React.ReactNode
  /** Show column label above cell value in mobile card. Default true. */
  mobileLabel?: boolean
  /** Extra className for <td> / card section */
  className?: string
  /** If true, this column is shown as the card title on mobile */
  mobileTitle?: boolean
  /** Hide this column on mobile */
  hideOnMobile?: boolean
}

interface ResponsiveTableProps<T> {
  columns: ResponsiveColumn<T>[]
  rows: T[]
  keyExtractor: (row: T, idx: number) => string | number
  /** Renders below each card on mobile (e.g. action buttons) */
  mobileActions?: (row: T) => React.ReactNode
  /** Row className (desktop table row) */
  rowClassName?: string | ((row: T) => string)
  /** Called when a row is clicked */
  onRowClick?: (row: T) => void
  /** Message shown when rows is empty */
  emptyMessage?: React.ReactNode
  /** Extra className on the wrapping element */
  className?: string
}

export function ResponsiveTable<T>({
  columns,
  rows,
  keyExtractor,
  mobileActions,
  rowClassName,
  onRowClick,
  emptyMessage = 'Nu există date.',
  className,
}: ResponsiveTableProps<T>) {
  const isMobile = useIsMobile()

  if (rows.length === 0) {
    return (
      <div className={clsx('py-10 text-center text-sm text-gray-400', className)}>
        {emptyMessage}
      </div>
    )
  }

  /* ── Desktop: standard table ──────────────────────────────────────── */
  if (!isMobile) {
    return (
      <div className={clsx('overflow-x-auto rounded-xl border border-gray-200', className)}>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {columns.map(col => (
                <th
                  key={col.key}
                  className={clsx('px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide', col.className)}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row, idx) => {
              const rClass = typeof rowClassName === 'function' ? rowClassName(row) : rowClassName
              return (
                <tr
                  key={keyExtractor(row, idx)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={clsx(
                    'bg-white transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-gray-50',
                    rClass,
                  )}
                >
                  {columns.map(col => (
                    <td key={col.key} className={clsx('px-4 py-3', col.className)}>
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  /* ── Mobile: stacked cards ──────────────────────────────────────────── */
  const titleCol = columns.find(c => c.mobileTitle)
  const bodyColumns = columns.filter(c => !c.mobileTitle && !c.hideOnMobile)

  return (
    <div className={clsx('space-y-3', className)}>
      {rows.map((row, idx) => (
        <div
          key={keyExtractor(row, idx)}
          onClick={onRowClick ? () => onRowClick(row) : undefined}
          className={clsx(
            'bg-white rounded-xl border border-gray-200 p-4 shadow-sm',
            onRowClick && 'cursor-pointer active:bg-gray-50',
          )}
        >
          {/* Card title */}
          {titleCol && (
            <div className="mb-3 font-semibold text-gray-900 text-sm">
              {titleCol.cell(row)}
            </div>
          )}

          {/* Fields grid */}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            {bodyColumns.map(col => (
              <div key={col.key} className={clsx('flex flex-col', col.className)}>
                {col.mobileLabel !== false && (
                  <dt className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">
                    {col.header}
                  </dt>
                )}
                <dd className="text-sm text-gray-800 font-medium mt-0.5">
                  {col.cell(row)}
                </dd>
              </div>
            ))}
          </dl>

          {/* Actions */}
          {mobileActions && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              {mobileActions(row)}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
