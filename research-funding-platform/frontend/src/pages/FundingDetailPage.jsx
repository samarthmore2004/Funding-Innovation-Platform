import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BadgeCheck, Bookmark, BookmarkCheck, ExternalLink, FlaskConical, Pencil, Trash2 } from 'lucide-react'
import {
  Alert,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  ErrorState,
  LoadingState,
  Modal,
  PageHeader,
  ProgressBar,
  Select,
  useToast,
} from '../components/ui'
import EligibilityChecklist from '../components/domain/EligibilityChecklist'
import FundingForm from '../components/domain/FundingForm'
import { FunderTypeBadge, FundingRecordBadge, FundingStatusBadge } from '../components/domain/Badges'
import { DeadlineText } from '../components/domain/FundingCard'
import { fundingApi } from '../api/funding'
import { getErrorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useApi } from '../utils/hooks'
import { useTaxonomy } from '../utils/taxonomy'
import { formatAmountRange, formatDate, formatDateTime, formatDecimal } from '../utils/format'
import { APPLICANT_TYPE_LABELS, CAREER_STAGE_LABELS, FUNDER_TYPE_LABELS, SAVED_STATUS_LABELS, labelFor, optionsFrom } from '../utils/labels'

function Detail({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{children || '—'}</dd>
    </div>
  )
}

function SourceAttribution({ funding }) {
  if (funding.record_type === 'verified') {
    return (
      <Alert variant="success" icon={BadgeCheck} title="Verified source">
        Retrieved from <strong>{funding.source_name || 'an official source'}</strong>
        {funding.verified_at ? ` on ${formatDateTime(funding.verified_at)}` : ''}. Always confirm the current terms and deadline at
        the official page before applying.
        {funding.source_url && (
          <a href={funding.source_url} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-1 font-medium underline">
            Open official listing <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </Alert>
    )
  }
  if (funding.record_type === 'illustrative') {
    return (
      <Alert variant="warning" icon={FlaskConical} title="Illustrative sample — not a real opportunity">
        This synthetic record exists only to demonstrate the platform. The organization, amounts and dates are not an official call
        for proposals. Do not apply or cite it.
      </Alert>
    )
  }
  return (
    <Alert variant="neutral" title={funding.record_type === 'internal' ? 'Internal program' : 'Imported record'}>
      {funding.record_type === 'internal'
        ? 'Created inside the platform by an innovation manager or administrator.'
        : 'Imported by an administrator from an uploaded dataset.'}{' '}
      {funding.source_name && <>Source: {funding.source_name}. </>}
      {funding.source_url && (
        <a href={funding.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium underline">
          Source link <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </Alert>
  )
}

export default function FundingDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { hasRole } = useAuth()
  const { domainName } = useTaxonomy()
  const { data: funding, error, loading, reload } = useApi(() => fundingApi.get(id), [id])
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (error && !funding) return <ErrorState message={error} onRetry={reload} />
  if (!funding || (loading && String(funding.id) !== String(id))) return <LoadingState />

  const saved = funding.saved

  const toggleSave = async () => {
    setBusy(true)
    try {
      if (saved) {
        await fundingApi.unsave(funding.id)
        toast.info('Removed from tracked opportunities.')
      } else {
        await fundingApi.save(funding.id, { status: 'interested' })
        toast.success('Tracking this opportunity.')
      }
      await reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const updateStatus = async (status) => {
    try {
      await fundingApi.updateSaved(saved.id, { status })
      toast.success('Application status updated.')
      reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const saveEdit = async (payload) => {
    setBusy(true)
    try {
      await fundingApi.update(funding.id, payload)
      toast.success('Opportunity updated.')
      setEditing(false)
      reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    try {
      await fundingApi.remove(funding.id)
      toast.success('Opportunity deleted.')
      navigate('/app/funding', { replace: true })
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const match = funding.match

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Funding discovery', to: '/app/funding' }, { label: 'Opportunity' }]}
        title={funding.title}
        description={funding.organization}
        actions={
          <>
            {saved ? (
              <Select
                aria-label="Application status"
                value={saved.status || 'interested'}
                onChange={(event) => updateStatus(event.target.value)}
                options={optionsFrom(SAVED_STATUS_LABELS)}
                className="h-9 w-40"
              />
            ) : null}
            <Button variant={saved ? 'secondary' : 'primary'} icon={saved ? BookmarkCheck : Bookmark} onClick={toggleSave} loading={busy && !editing}>
              {saved ? 'Tracking' : 'Track opportunity'}
            </Button>
            {hasRole('innovation_manager', 'admin') && (
              <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            {hasRole('admin') && (
              <Button variant="danger-ghost" icon={Trash2} onClick={() => setDeleting(true)}>
                Delete
              </Button>
            )}
          </>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <FunderTypeBadge type={funding.funder_type} />
        <FundingRecordBadge type={funding.record_type} />
        <FundingStatusBadge status={funding.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SourceAttribution funding={funding} />
          <Card>
            <CardHeader title="About this opportunity" />
            <div className="space-y-4 px-5 py-4">
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{funding.description || 'No description provided.'}</p>
              {funding.eligibility_text && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Eligibility</h3>
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{funding.eligibility_text}</p>
                </div>
              )}
            </div>
          </Card>
          <Card>
            <CardHeader title="Key details" />
            <dl className="grid gap-4 px-5 py-4 sm:grid-cols-2">
              <Detail label="Funder type">{labelFor(FUNDER_TYPE_LABELS, funding.funder_type)}</Detail>
              <Detail label="Funding amount">{formatAmountRange(funding.min_amount, funding.max_amount, funding.currency)}</Detail>
              <Detail label="Opens">{formatDate(funding.open_date)}</Detail>
              <Detail label="Deadline">
                <DeadlineText funding={funding} />
              </Detail>
              <Detail label="Eligible applicants">
                {funding.applicant_types?.length ? funding.applicant_types.map((t) => labelFor(APPLICANT_TYPE_LABELS, t)).join(', ') : 'Not restricted'}
              </Detail>
              <Detail label="Eligible countries">{funding.eligible_countries?.length ? funding.eligible_countries.join(', ') : 'Not restricted'}</Detail>
              <Detail label="Career stages">
                {funding.career_stages?.length ? funding.career_stages.map((s) => labelFor(CAREER_STAGE_LABELS, s)).join(', ') : 'Any'}
              </Detail>
              <Detail label="Reference number">{funding.external_id}</Detail>
              <Detail label="Domains">{funding.domains?.length ? funding.domains.map((d) => domainName(d)).join(', ') : null}</Detail>
              <Detail label="Keywords">{funding.keywords?.length ? funding.keywords.join(', ') : null}</Detail>
            </dl>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Match with your profile" subtitle="TF-IDF cosine similarity combined with eligibility" />
            <div className="space-y-3 px-5 py-4">
              {match ? (
                <>
                  <ProgressBar value={match.match_score} label="Match score" size="lg" />
                  <p className="text-xs text-slate-500">
                    Cosine similarity <span className="font-semibold text-slate-800">{formatDecimal(match.similarity, 3)}</span>
                  </p>
                  {match.matched_terms?.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {match.matched_terms.map((term) => (
                        <span key={term} className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700">
                          {term}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No overlapping terms with your profile.</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-500">
                  <Link to="/app/profile" className="font-medium text-indigo-600">
                    Complete your profile
                  </Link>{' '}
                  to see how well this opportunity matches you.
                </p>
              )}
            </div>
          </Card>
          <Card>
            <CardHeader title="Eligibility check" subtitle="Rule-based comparison with your profile" />
            <div className="px-5 py-4">
              <EligibilityChecklist eligibility={funding.eligibility} />
            </div>
          </Card>
        </div>
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit opportunity" size="xl">
        {editing && <FundingForm initial={funding} onSubmit={saveEdit} onCancel={() => setEditing(false)} submitting={busy} />}
      </Modal>
      <ConfirmDialog
        open={deleting}
        danger
        title="Delete this opportunity?"
        message="It will be removed for all users, including anyone tracking it."
        confirmLabel="Delete"
        onConfirm={remove}
        onCancel={() => setDeleting(false)}
      />
    </div>
  )
}
