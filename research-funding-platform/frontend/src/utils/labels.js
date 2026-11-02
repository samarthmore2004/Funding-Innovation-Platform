/** Human-readable labels and badge colors for the enumerations defined in docs/API.md. */
import { humanize } from './format'

export const ROLE_LABELS = {
  researcher: 'Researcher',
  startup_founder: 'Startup Founder',
  innovation_manager: 'Innovation Manager',
  admin: 'Administrator',
}
export const ROLES = Object.keys(ROLE_LABELS)
export const ROLE_COLORS = { researcher: 'indigo', startup_founder: 'violet', innovation_manager: 'sky', admin: 'rose' }

export const FUNDER_TYPE_LABELS = {
  government_grant: 'Government Grant',
  research_council: 'Research Council',
  innovation_fund: 'Innovation Fund',
  startup_accelerator: 'Startup Accelerator',
  venture_program: 'Venture Program',
  international_agency: 'International Funding Agency',
}

export const FUNDING_STATUS_LABELS = { open: 'Open', forecasted: 'Forecasted', closed: 'Closed', rolling: 'Rolling' }
export const FUNDING_STATUS_COLORS = { open: 'green', forecasted: 'sky', closed: 'slate', rolling: 'violet' }

export const FUNDING_RECORD_LABELS = {
  verified: 'Verified source',
  illustrative: 'Illustrative sample',
  imported: 'Imported',
  internal: 'Internal program',
}
export const PATENT_RECORD_LABELS = {
  illustrative: 'Illustrative sample',
  imported: 'Imported',
  live: 'Live (PatentsView)',
  user: 'Your patent',
}
export const RECORD_COLORS = { verified: 'green', illustrative: 'amber', imported: 'sky', internal: 'violet', live: 'green', user: 'indigo' }

export const APPLICANT_TYPE_LABELS = {
  researcher: 'Researcher',
  startup: 'Startup',
  university: 'University',
  enterprise: 'Enterprise',
  nonprofit: 'Nonprofit',
  government: 'Government',
}

export const ORG_TYPE_LABELS = {
  university: 'University',
  research_institute: 'Research institute',
  startup: 'Startup',
  enterprise: 'Enterprise',
  government: 'Government',
  nonprofit: 'Nonprofit',
  other: 'Other',
}

export const CAREER_STAGE_LABELS = {
  student: 'Student',
  early_career: 'Early career',
  mid_career: 'Mid career',
  senior: 'Senior',
  industry: 'Industry',
}

export const STAGES = ['idea', 'research', 'prototype', 'pilot', 'market_ready']
export const STAGE_LABELS = {
  idea: 'Idea',
  research: 'Research',
  prototype: 'Prototype',
  pilot: 'Pilot',
  market_ready: 'Market ready',
}

export const MARKET_SIZE_LABELS = { niche: 'Niche', medium: 'Medium', large: 'Large', very_large: 'Very large' }

export const NOTIFICATION_TYPE_LABELS = {
  funding_match: 'New funding match',
  funding_deadline: 'Funding deadline',
  patent_alert: 'Patent monitoring',
  tech_alert: 'Emerging technology',
  trend_update: 'Research trend update',
  commercialization: 'Commercialization opportunity',
  system: 'Platform notification',
}
export const NOTIFICATION_TYPES = Object.keys(NOTIFICATION_TYPE_LABELS)

export const SAVED_STATUS_LABELS = {
  interested: 'Interested',
  preparing: 'Preparing',
  submitted: 'Submitted',
  awarded: 'Awarded',
  rejected: 'Rejected',
}
export const SAVED_STATUS_COLORS = { interested: 'slate', preparing: 'sky', submitted: 'indigo', awarded: 'green', rejected: 'rose' }

export const REPORT_FORMAT_LABELS = { csv: 'CSV', xlsx: 'Excel', pdf: 'PDF' }

export const ELIGIBILITY_LABELS = {
  eligible: 'Eligible',
  partially_eligible: 'Partially eligible',
  ineligible: 'Not eligible',
  unknown: 'Eligibility unknown',
}

export const BAND_COLORS = { High: 'green', Promising: 'indigo', Developing: 'amber', Early: 'slate' }

export const PATENT_STATUS_LABELS = { granted: 'Granted', pending: 'Pending', expired: 'Expired' }
export const PATENT_STATUS_COLORS = { granted: 'green', pending: 'amber', expired: 'slate' }

export const MATURITY_COLORS = { Emerging: 'violet', Growing: 'indigo', Maturing: 'sky', Established: 'slate' }

export const HISTORY_KIND_LABELS = {
  position: 'Position',
  project: 'Project',
  grant: 'Grant',
  education: 'Education',
  award: 'Award',
}

export const PATHWAY_LABELS = {
  licensing: 'Technology licensing',
  startup: 'Startup creation',
  productization: 'Productization',
  industry_partnership: 'Industry partnership',
  grant_research: 'Grant-funded research',
}

/** Looks a value up in a label map, falling back to a humanized version of the raw value. */
export function labelFor(map, value) {
  if (value === null || value === undefined || value === '') return '—'
  return map?.[value] || humanize(value)
}

/** Builds `{value, label}` options from a label map. */
export function optionsFrom(map) {
  return Object.entries(map).map(([value, label]) => ({ value, label }))
}

/**
 * Normalises option lists that may arrive as strings, `{key, name}` or `{value, label}` objects.
 */
export function normalizeOptions(list, labelMap) {
  if (!Array.isArray(list)) return []
  return list
    .map((item) => {
      if (item === null || item === undefined) return null
      if (typeof item === 'string' || typeof item === 'number') {
        return { value: String(item), label: labelMap?.[item] || (labelMap ? humanize(item) : String(item)) }
      }
      const value = item.value ?? item.key ?? item.id
      if (value === undefined) return null
      return { value: String(value), label: item.label ?? item.name ?? labelMap?.[value] ?? humanize(value), count: item.count }
    })
    .filter(Boolean)
}
