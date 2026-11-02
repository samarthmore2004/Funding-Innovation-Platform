/** Display formatters. All functions tolerate null/undefined and return a dash. */

export const DASH = '—'

const isBlank = (value) => value === null || value === undefined || value === ''

/** Parses `YYYY-MM-DD` as a local calendar date (avoids the UTC off-by-one) and ISO timestamps normally. */
export function parseDate(value) {
  if (isBlank(value)) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const str = String(value)
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str)
  if (dateOnly) return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
  // Naive timestamps from the API are UTC.
  const normalized = /T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(str) ? `${str}Z` : str
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDate(value, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  const date = parseDate(value)
  return date ? date.toLocaleDateString(undefined, options) : DASH
}

export function formatDateTime(value) {
  const date = parseDate(value)
  return date
    ? date.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : DASH
}

export function timeAgo(value) {
  const date = parseDate(value)
  if (!date) return DASH
  const seconds = Math.round((Date.now() - date.getTime()) / 1000)
  const abs = Math.abs(seconds)
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]
  for (const [unit, size] of units) {
    if (abs >= size) return rtf.format(-Math.round(seconds / size), unit)
  }
  return 'just now'
}

export function formatNumber(value, maximumFractionDigits = 0) {
  if (isBlank(value) || Number.isNaN(Number(value))) return DASH
  // Guard against callers (e.g. chart callbacks) passing extra non-numeric arguments.
  const digits = Number.isInteger(maximumFractionDigits) && maximumFractionDigits >= 0 && maximumFractionDigits <= 20 ? maximumFractionDigits : 0
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: digits })
}

export function formatDecimal(value, digits = 1) {
  if (isBlank(value) || Number.isNaN(Number(value))) return DASH
  return Number(value).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

const compactFormatter = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
export function compactNumber(value) {
  if (isBlank(value) || Number.isNaN(Number(value))) return DASH
  return compactFormatter.format(Number(value))
}

export function formatCurrency(amount, currency = 'USD', { compact = false } = {}) {
  if (isBlank(amount) || Number.isNaN(Number(amount))) return DASH
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 1 : 0,
    }).format(Number(amount))
  } catch {
    return `${currency || ''} ${formatNumber(amount)}`.trim()
  }
}

export function formatAmountRange(min, max, currency = 'USD') {
  const hasMin = !isBlank(min) && Number(min) > 0
  const hasMax = !isBlank(max) && Number(max) > 0
  if (hasMin && hasMax && Number(min) !== Number(max)) {
    return `${formatCurrency(min, currency, { compact: true })} – ${formatCurrency(max, currency, { compact: true })}`
  }
  if (hasMax) return `Up to ${formatCurrency(max, currency, { compact: true })}`
  if (hasMin) return `From ${formatCurrency(min, currency, { compact: true })}`
  return 'Amount not specified'
}

/** `value` already in percent units (e.g. 8.1 -> "8.1%"). */
export function formatPercent(value, digits = 1, { signed = false } = {}) {
  if (isBlank(value) || Number.isNaN(Number(value))) return DASH
  const num = Number(value)
  const text = `${num.toFixed(digits)}%`
  return signed && num > 0 ? `+${text}` : text
}

/** `value` as a 0–1 ratio. */
export function formatRatio(value, digits = 0) {
  if (isBlank(value) || Number.isNaN(Number(value))) return DASH
  return `${(Number(value) * 100).toFixed(digits)}%`
}

export function formatScore(value, digits = 1) {
  if (isBlank(value) || Number.isNaN(Number(value))) return DASH
  return Number(value).toFixed(digits)
}

export function daysUntil(dateValue) {
  const date = parseDate(dateValue)
  if (!date) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  return Math.round((target - today) / 86400000)
}

export function deadlineLabel(days, deadline) {
  const d = days ?? daysUntil(deadline)
  if (d === null || d === undefined) return deadline ? formatDate(deadline) : 'No fixed deadline'
  if (d < 0) return 'Deadline passed'
  if (d === 0) return 'Due today'
  if (d === 1) return '1 day left'
  return `${d} days left`
}

export function truncate(text, length = 160) {
  if (!text) return ''
  const str = String(text)
  return str.length > length ? `${str.slice(0, length).trimEnd()}…` : str
}

export function humanize(value) {
  if (isBlank(value)) return DASH
  const str = String(value).replace(/[_-]+/g, ' ').trim()
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function initials(name, email) {
  const source = (name || email || '?').trim()
  const parts = source.split(/[\s@._-]+/).filter(Boolean)
  return ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase()
}

const HONORIFICS = new Set(['dr', 'dr.', 'prof', 'prof.', 'mr', 'mr.', 'mrs', 'mrs.', 'ms', 'ms.', 'mx', 'mx.', 'sir'])

export function firstName(name) {
  if (!name) return ''
  const parts = String(name).trim().split(/\s+/)
  const given = parts.find((part) => !HONORIFICS.has(part.toLowerCase()))
  return given || parts[0]
}

export function clamp(value, min, max) {
  const num = Number(value)
  if (Number.isNaN(num)) return min
  return Math.min(max, Math.max(min, num))
}
