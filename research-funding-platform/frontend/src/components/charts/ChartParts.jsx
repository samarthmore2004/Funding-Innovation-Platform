import { formatNumber } from '../../utils/format'
import { INK } from './palette'

/**
 * Tooltip content for Recharts: value leads (strong), series name follows (secondary),
 * each row keyed by a short stroke of the series color. Text is rendered as React text
 * nodes, so API-provided labels are never interpreted as HTML.
 */
export function ChartTooltip({ active, payload, label, labelFormatter, valueFormatter = formatNumber, hideLabel = false }) {
  if (!active || !payload || payload.length === 0) return null
  const rows = payload.filter((item) => item && item.value !== undefined && item.value !== null)
  if (!rows.length) return null
  const heading = hideLabel ? null : labelFormatter ? labelFormatter(label, rows) : label
  return (
    <div className="pointer-events-none min-w-[8rem] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      {heading !== null && heading !== undefined && heading !== '' && (
        <div className="mb-1.5 font-medium text-slate-500">{heading}</div>
      )}
      <div className="space-y-1">
        {rows.map((item, index) => (
          <div key={`${item.dataKey}-${index}`} className="flex items-center gap-2">
            <span
              className="inline-block h-[3px] w-3 shrink-0 rounded-full"
              style={{ background: item.color || item.stroke || item.fill || item.payload?.fill || INK.secondary }}
              aria-hidden="true"
            />
            <span className="font-semibold text-slate-900 tabular">{valueFormatter(item.value)}</span>
            <span className="truncate text-slate-500">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** HTML legend that mirrors the mark: a line key for lines, a rounded rect for bars/areas. */
export function ChartLegend({ items = [], mark = 'line', className = '' }) {
  if (items.length < 2) return null
  return (
    <ul className={`mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600 ${className}`}>
      {items.map((item) => (
        <li key={item.key} className="inline-flex items-center gap-1.5">
          {mark === 'line' ? (
            <span className="inline-block h-[3px] w-4 rounded-full" style={{ background: item.color }} aria-hidden="true" />
          ) : (
            <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: item.color }} aria-hidden="true" />
          )}
          <span>{item.name}</span>
        </li>
      ))}
    </ul>
  )
}

/** Y-axis category tick that truncates long names (full name in a native tooltip). */
export function TruncatedTick({ x, y, payload, width = 120, maxChars = 18 }) {
  const text = String(payload?.value ?? '')
  const short = text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{text}</title>
      <text x={-6} y={0} dy={4} textAnchor="end" fill={INK.secondary} fontSize={12} style={{ maxWidth: width }}>
        {short}
      </text>
    </g>
  )
}
