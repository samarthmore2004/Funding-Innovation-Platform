import { CartesianGrid, LabelList, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts'
import { compactNumber, formatDecimal } from '../../utils/format'
import { ChartLegend } from './ChartParts'
import { ACCENT, AXIS_TICK, DEEMPHASIS, INK } from './palette'

/** 8px dot with a 2px surface ring, inside a transparent 24px hit target. */
function Dot({ cx, cy, fill }) {
  if (cx === undefined || cy === undefined) return null
  return (
    <g>
      <circle cx={cx} cy={cy} r={12} fill="transparent" />
      <circle cx={cx} cy={cy} r={5} fill={fill} stroke={INK.surface} strokeWidth={2} />
    </g>
  )
}

/** Single-line direct label above a point (Recharts would otherwise wrap text to the mark's width). */
function PointLabel(props) {
  const { x, y, width = 0, cx, cy, value } = props
  if (value === null || value === undefined || value === '') return null
  const px = cx ?? x + width / 2
  const py = cy ?? y
  const text = String(value)
  return (
    <text x={px} y={py - 12} textAnchor="middle" fontSize={11} fill={INK.secondary} pointerEvents="none">
      {text.length > 28 ? `${text.slice(0, 27)}…` : text}
    </text>
  )
}

function ScatterTooltip({ active, payload, xLabel, yLabel, valueFormatter }) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload
  if (!point) return null
  return (
    <div className="pointer-events-none max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-semibold text-slate-900">{point.label}</div>
      {point.sublabel && <div className="mb-1 text-slate-500">{point.sublabel}</div>}
      <div className="flex gap-2">
        <span className="font-semibold text-slate-900 tabular">{valueFormatter(point.x)}</span>
        <span className="text-slate-500">{xLabel}</span>
      </div>
      <div className="flex gap-2">
        <span className="font-semibold text-slate-900 tabular">{valueFormatter(point.y)}</span>
        <span className="text-slate-500">{yLabel}</span>
      </div>
    </div>
  )
}

/**
 * Emphasis scatter: highlighted points in the accent hue (direct-labelled), the rest in gray.
 * points: [{ id, x, y, label, sublabel?, highlight?: boolean }]
 * Optional reference lines split the plane into quadrants (e.g. at the medians).
 */
export default function ScatterPlot({
  points = [],
  xLabel = 'x',
  yLabel = 'y',
  height = 340,
  referenceX,
  referenceY,
  highlightLabel = 'Highlighted',
  restLabel = 'Other',
  labelHighlighted = true,
  valueFormatter = (v) => formatDecimal(v, 1),
  onPointClick,
  quadrantLabels,
}) {
  const highlighted = points.filter((p) => p.highlight)
  const rest = points.filter((p) => !p.highlight)
  const legend =
    highlighted.length && rest.length
      ? [
          { key: 'hl', name: highlightLabel, color: ACCENT },
          { key: 'rest', name: restLabel, color: DEEMPHASIS },
        ]
      : []

  return (
    <div>
      <div className="relative" style={{ height }} role="img" aria-label={`Scatter plot of ${yLabel} against ${xLabel}`}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 16, right: 24, bottom: 24, left: 4 }}>
            <CartesianGrid stroke={INK.grid} />
            <XAxis
              type="number"
              dataKey="x"
              name={xLabel}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: INK.axis }}
              tickFormatter={compactNumber}
              label={{ value: xLabel, position: 'insideBottom', offset: -14, fill: INK.muted, fontSize: 12 }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name={yLabel}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              tickFormatter={compactNumber}
              width={48}
              label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: INK.muted, fontSize: 12, dy: 40 }}
            />
            {referenceX !== undefined && referenceX !== null && <ReferenceLine x={referenceX} stroke={INK.axis} />}
            {referenceY !== undefined && referenceY !== null && <ReferenceLine y={referenceY} stroke={INK.axis} />}
            <Tooltip
              cursor={false}
              content={(props) => <ScatterTooltip {...props} xLabel={xLabel} yLabel={yLabel} valueFormatter={valueFormatter} />}
            />
            {rest.length > 0 && (
              <Scatter
                name={restLabel}
                data={rest}
                fill={DEEMPHASIS}
                shape={Dot}
                isAnimationActive={false}
                onClick={onPointClick ? (point) => onPointClick(point?.payload || point) : undefined}
                style={onPointClick ? { cursor: 'pointer' } : undefined}
              />
            )}
            {highlighted.length > 0 && (
              <Scatter
                name={highlightLabel}
                data={highlighted}
                fill={ACCENT}
                shape={Dot}
                isAnimationActive={false}
                onClick={onPointClick ? (point) => onPointClick(point?.payload || point) : undefined}
                style={onPointClick ? { cursor: 'pointer' } : undefined}
              >
                {labelHighlighted && <LabelList dataKey="label" content={PointLabel} />}
              </Scatter>
            )}
          </ScatterChart>
        </ResponsiveContainer>
        {quadrantLabels && (
          <div className="pointer-events-none absolute inset-0 text-[11px] font-medium uppercase tracking-wide text-slate-400">
            <span className="absolute left-16 top-3">{quadrantLabels.topLeft}</span>
            <span className="absolute right-8 top-3">{quadrantLabels.topRight}</span>
            <span className="absolute bottom-12 left-16">{quadrantLabels.bottomLeft}</span>
            <span className="absolute bottom-12 right-8">{quadrantLabels.bottomRight}</span>
          </div>
        )}
      </div>
      <ChartLegend items={legend} mark="rect" />
    </div>
  )
}
