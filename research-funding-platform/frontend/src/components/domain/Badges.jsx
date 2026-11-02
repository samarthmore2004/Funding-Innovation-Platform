import { BadgeCheck, CircleHelp, CircleMinus, CircleCheck, CircleX, FlaskConical, Upload, Building2, Radio, UserRound } from 'lucide-react'
import Badge from '../ui/Badge'
import {
  BAND_COLORS,
  ELIGIBILITY_LABELS,
  FUNDER_TYPE_LABELS,
  FUNDING_RECORD_LABELS,
  FUNDING_STATUS_COLORS,
  FUNDING_STATUS_LABELS,
  MATURITY_COLORS,
  PATENT_RECORD_LABELS,
  PATENT_STATUS_COLORS,
  PATENT_STATUS_LABELS,
  RECORD_COLORS,
  ROLE_COLORS,
  ROLE_LABELS,
  labelFor,
} from '../../utils/labels'

const RECORD_ICONS = { verified: BadgeCheck, illustrative: FlaskConical, imported: Upload, internal: Building2, live: Radio, user: UserRound }

export function FundingRecordBadge({ type }) {
  if (!type) return null
  return (
    <Badge color={RECORD_COLORS[type] || 'slate'} icon={RECORD_ICONS[type]} title={recordTitle(type)}>
      {labelFor(FUNDING_RECORD_LABELS, type)}
    </Badge>
  )
}

export function PatentRecordBadge({ type }) {
  if (!type) return null
  return (
    <Badge color={RECORD_COLORS[type] || 'slate'} icon={RECORD_ICONS[type]}>
      {labelFor(PATENT_RECORD_LABELS, type)}
    </Badge>
  )
}

function recordTitle(type) {
  switch (type) {
    case 'verified':
      return 'Fetched from an official source; see the source link and verification date.'
    case 'illustrative':
      return 'Synthetic demo record — not a real funding opportunity.'
    case 'imported':
      return 'Imported by an administrator from an uploaded dataset.'
    case 'internal':
      return 'Created inside the platform by an innovation manager or administrator.'
    default:
      return undefined
  }
}

export function FundingStatusBadge({ status }) {
  if (!status) return null
  return <Badge color={FUNDING_STATUS_COLORS[status] || 'slate'}>{labelFor(FUNDING_STATUS_LABELS, status)}</Badge>
}

export function FunderTypeBadge({ type }) {
  if (!type) return null
  return <Badge color="indigo">{labelFor(FUNDER_TYPE_LABELS, type)}</Badge>
}

const ELIGIBILITY_STYLE = {
  eligible: { color: 'green', icon: CircleCheck },
  partially_eligible: { color: 'amber', icon: CircleMinus },
  ineligible: { color: 'rose', icon: CircleX },
  unknown: { color: 'slate', icon: CircleHelp },
}

export function EligibilityBadge({ status }) {
  const style = ELIGIBILITY_STYLE[status] || ELIGIBILITY_STYLE.unknown
  return (
    <Badge color={style.color} icon={style.icon}>
      {labelFor(ELIGIBILITY_LABELS, status || 'unknown')}
    </Badge>
  )
}

export function BandBadge({ band }) {
  if (!band) return null
  return <Badge color={BAND_COLORS[band] || 'slate'}>{band}</Badge>
}

export function MaturityBadge({ stage }) {
  if (!stage) return null
  return <Badge color={MATURITY_COLORS[stage] || 'slate'}>{stage}</Badge>
}

export function PatentStatusBadge({ status }) {
  if (!status) return null
  return <Badge color={PATENT_STATUS_COLORS[status] || 'slate'}>{labelFor(PATENT_STATUS_LABELS, status)}</Badge>
}

export function RoleBadge({ role }) {
  if (!role) return null
  return <Badge color={ROLE_COLORS[role] || 'slate'}>{labelFor(ROLE_LABELS, role)}</Badge>
}
