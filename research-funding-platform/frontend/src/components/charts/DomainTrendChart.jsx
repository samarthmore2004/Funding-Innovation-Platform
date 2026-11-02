import TrendLineChart from './TrendLineChart'
import ChartFrame from './ChartFrame'
import { useStableColors } from '../../utils/hooks'
import { formatNumber } from '../../utils/format'

/**
 * Publications-per-year by domain. `domains` = [{key, name}], `series` = [{year, <key>: n}].
 * Colors are bound to the domain key, so adding/removing a domain never repaints the others.
 */
export default function DomainTrendChart({ domains = [], series = [], title, subtitle, actions, loading, error, onRetry, height = 300, footer }) {
  const colors = useStableColors(domains.map((d) => d.key))
  const lines = domains.map((d) => ({ key: d.key, name: d.name || d.key, color: colors[d.key] }))
  const table = {
    columns: [{ key: 'year', label: 'Year' }, ...domains.map((d) => ({ key: d.key, label: d.name || d.key, align: 'right', format: (v) => formatNumber(v) }))],
    rows: series,
  }
  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      actions={actions}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={!series.length || !domains.length}
      emptyTitle="No trend data for this selection"
      table={table}
      footer={footer}
    >
      <TrendLineChart data={series} series={lines} xKey="year" height={height} />
    </ChartFrame>
  )
}
