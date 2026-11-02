import { useState } from 'react'
import clsx from 'clsx'
import { BarChart3, Table2 } from 'lucide-react'
import { Card } from '../ui/Card'
import { SegmentedControl } from '../ui/Tabs'
import Table from '../ui/Table'
import { LoadingState } from '../ui/Spinner'
import ErrorState from '../ui/ErrorState'
import EmptyState from '../ui/EmptyState'

/**
 * Card wrapper for every chart: title, subtitle, actions, loading/error/empty states and a
 * chart ↔ table toggle (the table view is the accessible way to read every value).
 *
 * table: { columns: [{ key, label, format?(value,row), align? }], rows: [object] }
 */
export default function ChartFrame({
  title,
  subtitle,
  actions,
  table,
  loading = false,
  error,
  onRetry,
  empty = false,
  emptyTitle = 'No data to chart yet',
  emptyDescription,
  footer,
  className,
  bodyClassName,
  children,
}) {
  const [view, setView] = useState('chart')
  const showTableToggle = Boolean(table && table.rows?.length && !error && !empty)
  const initialLoad = loading && empty

  return (
    <Card className={clsx('flex flex-col', className)}>
      {(title || actions || showTableToggle) && (
        <div className="flex flex-wrap items-start justify-between gap-2 px-5 pt-4">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold text-slate-900">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {actions}
            {showTableToggle && (
              <SegmentedControl
                size="xs"
                ariaLabel="Chart or table view"
                value={view}
                onChange={setView}
                options={[
                  { value: 'chart', label: 'Chart', icon: BarChart3 },
                  { value: 'table', label: 'Table', icon: Table2 },
                ]}
              />
            )}
          </div>
        </div>
      )}
      <div className={clsx('flex-1 px-5 pb-5 pt-3', bodyClassName)}>
        {error ? (
          <ErrorState compact message={error} onRetry={onRetry} />
        ) : initialLoad ? (
          <LoadingState compact />
        ) : empty ? (
          <EmptyState compact title={emptyTitle} description={emptyDescription} />
        ) : view === 'table' && table ? (
          <Table
            dense
            rows={table.rows}
            rowKey={(row, index) => index}
            columns={table.columns.map((column) => ({
              key: column.key,
              header: column.label,
              align: column.align,
              render: (row) => (column.format ? column.format(row[column.key], row) : row[column.key] ?? '—'),
            }))}
            className="max-h-96"
          />
        ) : (
          <div className={clsx('transition-opacity', loading && 'opacity-50')}>{children}</div>
        )}
        {footer && !error && <div className="mt-3">{footer}</div>}
      </div>
    </Card>
  )
}
