import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { compactNumber, formatNumber } from '../../utils/format'
import { ChartLegend, ChartTooltip } from './ChartParts'
import { AXIS_TICK, INK, SERIES_COLORS } from './palette'

/**
 * Time-series line chart (one y-axis only).
 * series: [{ key, name, color? }]; data: [{ [xKey]: x, [series.key]: number }]
 * A single series renders as a line over a 10% area wash and needs no legend.
 * Up to four series get a value label at the line end; the legend is always shown for 2+.
 */
export default function TrendLineChart({
  data = [],
  series = [],
  xKey = 'year',
  height = 280,
  valueFormatter = formatNumber,
  xFormatter,
  yLabel,
  area,
}) {
  const single = series.length === 1
  const showArea = area ?? single
  const endLabels = series.length > 0 && series.length <= 4
  const lastIndex = data.length - 1
  const resolved = series.map((s, index) => ({ ...s, color: s.color || SERIES_COLORS[index % SERIES_COLORS.length] }))

  const endLabel = (s) =>
    function EndLabel({ x, y, index, value }) {
      if (index !== lastIndex || value === null || value === undefined) return null
      return (
        <text x={x + 6} y={y} dy={4} fontSize={11} fill={INK.secondary} textAnchor="start">
          {compactNumber(value)}
        </text>
      )
    }

  return (
    <div>
      <div style={{ height }} role="img" aria-label={`Line chart of ${resolved.map((s) => s.name).join(', ')}`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: endLabels ? 40 : 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={INK.grid} />
            <XAxis
              dataKey={xKey}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: INK.axis }}
              tickFormatter={xFormatter}
              minTickGap={16}
            />
            <YAxis
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              tickFormatter={compactNumber}
              width={48}
              allowDecimals={false}
              label={
                yLabel
                  ? { value: yLabel, angle: -90, position: 'insideLeft', fill: INK.muted, fontSize: 11, dx: 4, dy: 30 }
                  : undefined
              }
            />
            <Tooltip
              cursor={{ stroke: INK.axis, strokeWidth: 1 }}
              content={(props) => <ChartTooltip {...props} valueFormatter={valueFormatter} labelFormatter={xFormatter} />}
            />
            {resolved.map((s) =>
              showArea && single ? (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={2}
                  fill={s.color}
                  fillOpacity={0.1}
                  dot={false}
                  activeDot={{ r: 4, stroke: INK.surface, strokeWidth: 2 }}
                  connectNulls
                  isAnimationActive={false}
                  label={endLabels ? endLabel(s) : undefined}
                />
              ) : (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  dot={false}
                  activeDot={{ r: 4, stroke: INK.surface, strokeWidth: 2 }}
                  connectNulls
                  isAnimationActive={false}
                  label={endLabels ? endLabel(s) : undefined}
                />
              ),
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend items={resolved} mark="line" />
    </div>
  )
}
