import { useMemo, useState } from 'react'
import { formatNumber } from '../../utils/format'
import { INK, SEQUENTIAL_BLUE, sequentialColor, textOn } from './palette'

/**
 * Sequential (single blue hue) heatmap rendered as an HTML grid.
 * rows: [{ key, label }], columns: [{ key, label }], cells: [{ row, column, value }]
 * Every cell carries its value on hover/focus and as visible text, so color is never
 * the only channel.
 */
export default function HeatmapGrid({ rows = [], columns = [], cells = [], rowHeader = 'Domain', valueLabel = 'patents' }) {
  const [hover, setHover] = useState(null)
  const lookup = useMemo(() => {
    const map = new Map()
    cells.forEach((cell) => map.set(`${cell.row}\u0001${cell.column}`, cell.value))
    return map
  }, [cells])
  const max = useMemo(() => cells.reduce((m, c) => Math.max(m, Number(c.value) || 0), 0), [cells])

  const legendSteps = [0.15, 0.4, 0.65, 0.9, 1].map((ratio) => ({
    color: sequentialColor(Math.max(1, Math.round(max * ratio)), max) || SEQUENTIAL_BLUE[0],
    value: Math.max(1, Math.round(max * ratio)),
  }))

  return (
    <div>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="border-separate border-spacing-[2px] text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white px-2 py-1 text-left font-semibold text-slate-500">{rowHeader}</th>
              {columns.map((column) => (
                <th key={column.key} className="h-28 w-12 align-bottom font-medium text-slate-500" scope="col">
                  <div className="mx-auto w-5 origin-bottom-left translate-x-3 -rotate-45 whitespace-nowrap text-left" title={column.label}>
                    {column.label.length > 22 ? `${column.label.slice(0, 21)}…` : column.label}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th scope="row" className="sticky left-0 z-10 max-w-[12rem] truncate bg-white px-2 py-1 text-left font-medium text-slate-600" title={row.label}>
                  {row.label}
                </th>
                {columns.map((column) => {
                  const value = lookup.get(`${row.key}\u0001${column.key}`) || 0
                  const fill = sequentialColor(value, max)
                  const isHover = hover && hover.row === row.key && hover.column === column.key
                  return (
                    <td
                      key={column.key}
                      tabIndex={0}
                      onMouseEnter={() => setHover({ row: row.key, column: column.key })}
                      onMouseLeave={() => setHover(null)}
                      onFocus={() => setHover({ row: row.key, column: column.key })}
                      onBlur={() => setHover(null)}
                      title={`${row.label} × ${column.label}: ${formatNumber(value)} ${valueLabel}`}
                      className="h-9 w-12 rounded-[4px] text-center font-medium tabular focus:outline-2 focus:outline-indigo-500"
                      style={{
                        background: fill || '#f8fafc',
                        color: fill ? textOn(fill) : INK.muted,
                        boxShadow: isHover ? `inset 0 0 0 2px ${INK.primary}` : undefined,
                      }}
                    >
                      {value ? formatNumber(value) : '·'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span>Fewer {valueLabel}</span>
        <div className="flex gap-[2px]">
          {legendSteps.map((step, index) => (
            <span key={index} className="h-3 w-8 rounded-[3px]" style={{ background: step.color }} title={`≈ ${step.value}`} />
          ))}
        </div>
        <span>More {valueLabel}</span>
        {hover && (
          <span className="ml-auto font-medium text-slate-700">
            {rows.find((r) => r.key === hover.row)?.label} × {columns.find((c) => c.key === hover.column)?.label}:{' '}
            {formatNumber(lookup.get(`${hover.row}\u0001${hover.column}`) || 0)} {valueLabel}
          </span>
        )}
      </div>
    </div>
  )
}
