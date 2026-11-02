/*
 * Chart color system (dataviz reference palette, validated with the dataviz skill's
 * validate_palette.js against the white card surface #ffffff, adjacent pairs:
 * worst CVD ΔE 9.1, worst normal-vision ΔE 19.6). Slots 3, 4 and 5 sit below 3:1
 * contrast on white, so every multi-series chart ships a legend plus a table view.
 *
 * Rules applied across the app:
 *  - categorical hues are assigned in this fixed order and follow the entity (useStableColors);
 *  - scatter plots use at most 3 hues (here: emphasis = 1 accent + gray);
 *  - magnitude uses the single blue sequential ramp;
 *  - status colors are reserved for status and always paired with an icon + label.
 */
export const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']

/** Blue sequential ramp, steps 100 → 700 (light → dark). */
export const SEQUENTIAL_BLUE = [
  '#cde2fb',
  '#b7d3f6',
  '#9ec5f4',
  '#86b6ef',
  '#6da7ec',
  '#5598e7',
  '#3987e5',
  '#2a78d6',
  '#256abf',
  '#1c5cab',
  '#184f95',
  '#104281',
  '#0d366b',
]

export const ACCENT = SERIES_COLORS[0]
/** De-emphasis gray for "the rest" in emphasis charts. */
export const DEEMPHASIS = '#a8b3c4'

export const STATUS = { good: '#0ca30c', warning: '#fab219', serious: '#ec835a', critical: '#d03b3b' }

/** Recessive chart chrome mapped onto the app's slate neutrals. */
export const INK = {
  primary: '#0f172a',
  secondary: '#475569',
  muted: '#64748b',
  grid: '#e2e8f0',
  axis: '#cbd5e1',
  surface: '#ffffff',
}

/** Meter: fill + a lighter step of the same ramp for the unfilled track. */
export const METER = { fill: '#2a78d6', track: '#cde2fb' }

export const AXIS_TICK = { fill: INK.muted, fontSize: 12 }

/** Picks a step of the sequential ramp for value/max (0 → lightest). */
export function sequentialColor(value, max) {
  if (!max || !value || value <= 0) return null
  const ratio = Math.min(1, value / max)
  const index = Math.min(SEQUENTIAL_BLUE.length - 1, Math.max(0, Math.round(ratio * (SEQUENTIAL_BLUE.length - 1))))
  return SEQUENTIAL_BLUE[index]
}

/** White text on dark fills, ink on light fills. */
export function textOn(hex) {
  if (!hex) return INK.primary
  const n = parseInt(hex.replace('#', ''), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return luminance < 0.55 ? '#ffffff' : INK.primary
}
