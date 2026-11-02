import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { compactNumber, formatNumber } from '../../utils/format'
import { ChartLegend, ChartTooltip, TruncatedTick } from './ChartParts'
import { ACCENT, AXIS_TICK, DEEMPHASIS, INK, SERIES_COLORS } from './palette'

/**
 * Bar/column chart following the mark spec: bars ≤ 24px, 4px rounded data-end, square at
 * the baseline, a 2px surface gap between stacked segments, recessive grid.
 *
 * - `horizontal` = true draws horizontal bars (category on the y-axis) – best for long names.
 * - bars: [{ key, name, color? }]; one bar series needs no legend.
 * - `highlight(row)` → emphasis mode: matching bars in the accent, the rest in gray.
 * - `showValues` puts the value at the bar tip (single series only).
 */
export default function BarChartBasic({
  data = [],
  categoryKey = 'label',
  bars = [],
  horizontal = false,
  stacked = false,
  height,
  valueFormatter = formatNumber,
  categoryFormatter,
  showValues = false,
  highlight,
  categoryWidth = 132,
  maxChars = 20,
}) {
  const resolved = bars.map((b, index) => ({ ...b, color: b.color || SERIES_COLORS[index % SERIES_COLORS.length] }))
  const single = resolved.length === 1
  const computedHeight = height || (horizontal ? Math.max(160, data.length * 34 + 40) : 260)
  const lastKey = resolved[resolved.length - 1]?.key

  const radiusFor = (key) => {
    if (stacked && key !== lastKey) return 0
    return horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]
  }

  return (
    <div>
      <div style={{ height: computedHeight }} role="img" aria-label={`Bar chart of ${resolved.map((b) => b.name).join(', ')}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout={horizontal ? 'vertical' : 'horizontal'}
            margin={{ top: 8, right: showValues && single ? 44 : 12, bottom: 0, left: 0 }}
            barCategoryGap="28%"
            barGap={2}
          >
            <CartesianGrid horizontal={!horizontal} vertical={horizontal} stroke={INK.grid} />
            {horizontal ? (
              <>
                <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={compactNumber} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey={categoryKey}
                  width={categoryWidth}
                  tickLine={false}
                  axisLine={{ stroke: INK.axis }}
                  interval={0}
                  tick={(props) => (
                    <TruncatedTick
                      {...props}
                      maxChars={maxChars}
                      payload={{ ...props.payload, value: categoryFormatter ? categoryFormatter(props.payload.value) : props.payload.value }}
                    />
                  )}
                />
              </>
            ) : (
              <>
                <XAxis
                  dataKey={categoryKey}
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={{ stroke: INK.axis }}
                  tickFormatter={categoryFormatter}
                  interval="preserveStartEnd"
                  minTickGap={8}
                />
                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={compactNumber} width={44} allowDecimals={false} />
              </>
            )}
            <Tooltip
              cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }}
              content={(props) => (
                <ChartTooltip
                  {...props}
                  valueFormatter={valueFormatter}
                  labelFormatter={categoryFormatter ? (label) => categoryFormatter(label) : undefined}
                />
              )}
            />
            {resolved.map((b) => (
              <Bar
                key={b.key}
                dataKey={b.key}
                name={b.name}
                fill={highlight ? ACCENT : b.color}
                stackId={stacked ? 'stack' : undefined}
                maxBarSize={24}
                radius={radiusFor(b.key)}
                stroke={stacked ? INK.surface : undefined}
                strokeWidth={stacked ? 2 : 0}
                isAnimationActive={false}
              >
                {highlight &&
                  data.map((row, index) => <Cell key={`cell-${index}`} fill={highlight(row) ? ACCENT : DEEMPHASIS} />)}
                {showValues && single && (
                  <LabelList
                    dataKey={b.key}
                    position={horizontal ? 'right' : 'top'}
                    formatter={(value) => valueFormatter(value)}
                    style={{ fill: INK.secondary, fontSize: 11 }}
                  />
                )}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend items={resolved} mark="rect" />
    </div>
  )
}
