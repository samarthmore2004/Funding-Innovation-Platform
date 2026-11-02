import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { BookmarkCheck, FilterX, NotebookPen, Plus, Search, SlidersHorizontal, Trash2 } from 'lucide-react'
import {
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  Pagination,
  Select,
  Table,
  Tabs,
  Textarea,
  useToast,
} from '../components/ui'
import FundingCard, { DeadlineText } from '../components/domain/FundingCard'
import FundingForm from '../components/domain/FundingForm'
import { FundingRecordBadge } from '../components/domain/Badges'
import { fundingApi } from '../api/funding'
import { getErrorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useApi, useDebounce } from '../utils/hooks'
import { useTaxonomy } from '../utils/taxonomy'
import { formatNumber } from '../utils/format'
import {
  APPLICANT_TYPE_LABELS,
  FUNDER_TYPE_LABELS,
  FUNDING_RECORD_LABELS,
  FUNDING_STATUS_LABELS,
  SAVED_STATUS_LABELS,
  normalizeOptions,
  optionsFrom,
} from '../utils/labels'

const FILTER_KEYS = ['q', 'funder_type', 'domain', 'country', 'status', 'record_type', 'applicant_type', 'deadline_before', 'min_amount', 'include_closed', 'sort']
const SORTS = [
  { value: 'deadline', label: 'Deadline (soonest)' },
  { value: 'relevance', label: 'Relevance to my profile' },
  { value: 'amount', label: 'Amount (largest)' },
  { value: 'newest', label: 'Newest' },
  { value: 'title', label: 'Title (A–Z)' },
]
const PAGE_SIZE = 12

function withCounts(options, facet = []) {
  const counts = new Map((facet || []).map((f) => [String(f.value), f.count]))
  return options.map((option) => ({ ...option, count: counts.get(String(option.value)) }))
}

function DiscoverTab({ savedMap, onToggleSave, savingId }) {
  const [params, setParams] = useSearchParams()
  const { domainOptions, domainName } = useTaxonomy()
  const filters = Object.fromEntries(FILTER_KEYS.map((key) => [key, params.get(key) || '']))
  const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1)
  const [query, setQuery] = useState(filters.q)
  const debouncedQuery = useDebounce(query, 400)
  const [showFilters, setShowFilters] = useState(true)

  const update = (changes, resetPage = true) => {
    const next = new URLSearchParams(params)
    Object.entries(changes).forEach(([key, value]) => {
      if (value === '' || value === null || value === undefined || value === false) next.delete(key)
      else next.set(key, String(value))
    })
    if (resetPage) next.delete('page')
    setParams(next, { replace: true })
  }

  useEffect(() => {
    if (debouncedQuery !== filters.q) update({ q: debouncedQuery })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery])

  const { data: facets } = useApi(() => fundingApi.facets(), [])
  const requestKey = params.toString()
  const { data, error, loading, reload } = useApi(
    () =>
      fundingApi.list({
        ...filters,
        include_closed: filters.include_closed === 'true' ? true : undefined,
        sort: filters.sort || 'deadline',
        page,
        page_size: PAGE_SIZE,
      }),
    [requestKey],
  )

  const funderOptions = withCounts(optionsFrom(FUNDER_TYPE_LABELS), facets?.funder_types)
  const domainSelect = facets?.domains?.length
    ? normalizeOptions(facets.domains).map((o) => ({ ...o, label: o.label === o.value ? domainName(o.value) : o.label }))
    : domainOptions
  const countryOptions = normalizeOptions(facets?.countries)
  const statusOptions = withCounts(optionsFrom(FUNDING_STATUS_LABELS), facets?.statuses)
  const recordOptions = withCounts(optionsFrom(FUNDING_RECORD_LABELS), facets?.record_types)
  const activeCount = FILTER_KEYS.filter((key) => key !== 'sort' && filters[key]).length

  const items = data?.items || []

  return (
    <div className="space-y-5">
      <Card padded>
        <div className="flex flex-col gap-3 md:flex-row">
          <Input
            icon={Search}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search titles, descriptions, organizations and keywords…"
            className="flex-1"
            aria-label="Search funding opportunities"
          />
          <div className="flex gap-2">
            <Select
              aria-label="Sort results"
              value={filters.sort || 'deadline'}
              onChange={(event) => update({ sort: event.target.value })}
              options={SORTS}
              className="md:w-56"
            />
            <Button variant="secondary" icon={SlidersHorizontal} onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
              Filters{activeCount ? ` (${activeCount})` : ''}
            </Button>
          </div>
        </div>
        {showFilters && (
          <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Funder type">
              {(id) => <Select id={id} value={filters.funder_type} onChange={(e) => update({ funder_type: e.target.value })} options={funderOptions} placeholder="All types" showCounts />}
            </Field>
            <Field label="Domain">
              {(id) => <Select id={id} value={filters.domain} onChange={(e) => update({ domain: e.target.value })} options={domainSelect} placeholder="All domains" showCounts />}
            </Field>
            <Field label="Country">
              {(id) => <Select id={id} value={filters.country} onChange={(e) => update({ country: e.target.value })} options={countryOptions} placeholder="Any country" showCounts />}
            </Field>
            <Field label="Status">
              {(id) => <Select id={id} value={filters.status} onChange={(e) => update({ status: e.target.value })} options={statusOptions} placeholder="Open, forecasted & rolling" showCounts />}
            </Field>
            <Field label="Data source">
              {(id) => <Select id={id} value={filters.record_type} onChange={(e) => update({ record_type: e.target.value })} options={recordOptions} placeholder="All sources" showCounts />}
            </Field>
            <Field label="Applicant type">
              {(id) => (
                <Select id={id} value={filters.applicant_type} onChange={(e) => update({ applicant_type: e.target.value })} options={optionsFrom(APPLICANT_TYPE_LABELS)} placeholder="Any applicant" />
              )}
            </Field>
            <Field label="Deadline before">
              {(id) => <Input id={id} type="date" value={filters.deadline_before} onChange={(e) => update({ deadline_before: e.target.value })} />}
            </Field>
            <Field label="Minimum amount">
              {(id) => (
                <Input id={id} type="number" min={0} value={filters.min_amount} onChange={(e) => update({ min_amount: e.target.value })} placeholder="e.g. 50000" />
              )}
            </Field>
            <div className="flex items-center justify-between gap-3 sm:col-span-2 lg:col-span-4">
              <Checkbox
                label="Include closed opportunities"
                checked={filters.include_closed === 'true'}
                onChange={(e) => update({ include_closed: e.target.checked ? 'true' : '' })}
              />
              <Button
                variant="ghost"
                size="sm"
                icon={FilterX}
                disabled={!activeCount}
                onClick={() => {
                  setQuery('')
                  setParams(new URLSearchParams(), { replace: true })
                }}
              >
                Clear filters
              </Button>
            </div>
          </div>
        )}
      </Card>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <LoadingState label="Searching opportunities…" />
      ) : items.length === 0 ? (
        <EmptyState icon={Search} title="No opportunities match these filters" description="Try removing some filters or broadening your search terms." />
      ) : (
        <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <p className="mb-3 text-sm text-slate-500">
            {formatNumber(data.total)} opportunit{data.total === 1 ? 'y' : 'ies'} found
          </p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((funding) => (
              <FundingCard
                key={funding.id}
                funding={funding}
                saved={savedMap.has(funding.id)}
                saving={savingId === funding.id}
                onToggleSave={onToggleSave}
              />
            ))}
          </div>
          <Pagination
            className="mt-6"
            page={data.page || page}
            pages={data.pages}
            total={data.total}
            pageSize={data.page_size || PAGE_SIZE}
            onChange={(next) => update({ page: next }, false)}
          />
        </div>
      )}
    </div>
  )
}

function TrackedTab({ saved, loading, error, reload, onRemove }) {
  const toast = useToast()
  const [notesFor, setNotesFor] = useState(null)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState(null)

  const updateStatus = async (item, status) => {
    try {
      await fundingApi.updateSaved(item.id, { status })
      toast.success('Application status updated.')
      reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const saveNotes = async () => {
    setBusy(true)
    try {
      await fundingApi.updateSaved(notesFor.id, { notes })
      toast.success('Notes saved.')
      setNotesFor(null)
      reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (error) return <ErrorState message={error} onRetry={reload} />
  if (loading && !saved) return <LoadingState />
  if (!saved?.length)
    return (
      <EmptyState
        icon={BookmarkCheck}
        title="You are not tracking any opportunities yet"
        description="Use the bookmark icon on any opportunity to track it and manage your application status."
      />
    )

  return (
    <Card>
      <div className="px-2 py-2">
        <Table
          rows={saved}
          columns={[
            {
              key: 'title',
              header: 'Opportunity',
              className: 'min-w-[16rem]',
              render: (row) => (
                <div>
                  <Link to={`/app/funding/${row.funding?.id}`} className="font-medium text-slate-800 hover:text-indigo-700">
                    {row.funding?.title}
                  </Link>
                  <p className="text-xs text-slate-500">{row.funding?.organization}</p>
                  <div className="mt-1">
                    <FundingRecordBadge type={row.funding?.record_type} />
                  </div>
                </div>
              ),
            },
            { key: 'deadline', header: 'Deadline', render: (row) => <DeadlineText funding={row.funding} className="text-xs" /> },
            {
              key: 'status',
              header: 'Application status',
              render: (row) => (
                <Select
                  aria-label="Application status"
                  value={row.status || 'interested'}
                  onChange={(event) => updateStatus(row, event.target.value)}
                  options={optionsFrom(SAVED_STATUS_LABELS)}
                  className="h-8 w-40 text-xs"
                />
              ),
            },
            {
              key: 'notes',
              header: 'Notes',
              className: 'max-w-xs',
              render: (row) => <p className="line-clamp-2 text-xs text-slate-600">{row.notes || <span className="text-slate-400">No notes</span>}</p>,
            },
            {
              key: 'actions',
              header: <span className="sr-only">Actions</span>,
              align: 'right',
              render: (row) => (
                <div className="flex justify-end gap-1">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Edit notes"
                    onClick={() => {
                      setNotesFor(row)
                      setNotes(row.notes || '')
                    }}
                  >
                    <NotebookPen className="h-4 w-4" />
                  </Button>
                  <Button size="icon-sm" variant="danger-ghost" aria-label="Stop tracking" onClick={() => setRemoving(row)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </div>
      <Modal
        open={Boolean(notesFor)}
        onClose={() => setNotesFor(null)}
        title="Application notes"
        description={notesFor?.funding?.title}
        footer={
          <>
            <Button variant="secondary" onClick={() => setNotesFor(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={saveNotes} loading={busy}>
              Save notes
            </Button>
          </>
        }
      >
        <Textarea rows={6} value={notes} onChange={(event) => setNotes(event.target.value)} aria-label="Notes" maxLength={4000} />
      </Modal>
      <ConfirmDialog
        open={Boolean(removing)}
        title="Stop tracking this opportunity?"
        message="Its application status and notes will be removed."
        confirmLabel="Stop tracking"
        danger
        onConfirm={async () => {
          await onRemove(removing.funding?.id)
          setRemoving(null)
        }}
        onCancel={() => setRemoving(null)}
      />
    </Card>
  )
}

export default function FundingPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'tracked' ? 'tracked' : 'discover'
  const saved = useApi(() => fundingApi.saved(), [])
  const [savingId, setSavingId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const savedMap = useMemo(() => {
    const map = new Map()
    ;(saved.data || []).forEach((item) => item.funding?.id && map.set(item.funding.id, item))
    return map
  }, [saved.data])

  const toggleSave = async (funding) => {
    setSavingId(funding.id)
    try {
      if (savedMap.has(funding.id)) {
        await fundingApi.unsave(funding.id)
        toast.info('Removed from tracked opportunities.')
      } else {
        await fundingApi.save(funding.id, { status: 'interested' })
        toast.success('Added to tracked opportunities.')
      }
      await saved.reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSavingId(null)
    }
  }

  const removeTracked = async (fundingId) => {
    try {
      await fundingApi.unsave(fundingId)
      toast.info('Stopped tracking.')
      await saved.reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const create = async (payload) => {
    setSubmitting(true)
    try {
      const created = await fundingApi.create(payload)
      toast.success('Program created.')
      setCreating(false)
      if (created?.id) navigate(`/app/funding/${created.id}`)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const setTab = (key) => {
    const next = new URLSearchParams(params)
    if (key === 'tracked') next.set('tab', 'tracked')
    else next.delete('tab')
    setParams(next, { replace: true })
  }

  return (
    <div>
      <PageHeader
        icon={Search}
        title="Funding discovery"
        description="Search government grants, research councils, innovation funds, accelerators, venture programs and international agencies."
        actions={
          hasRole('innovation_manager', 'admin') ? (
            <Button icon={Plus} onClick={() => setCreating(true)}>
              New internal program
            </Button>
          ) : null
        }
      />
      <Tabs
        className="mb-5"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'discover', label: 'Discover', icon: Search },
          { key: 'tracked', label: 'My tracked', icon: BookmarkCheck, count: saved.data?.length },
        ]}
      />
      {tab === 'tracked' ? (
        <TrackedTab saved={saved.data} loading={saved.loading} error={saved.error} reload={saved.reload} onRemove={removeTracked} />
      ) : (
        <DiscoverTab savedMap={savedMap} onToggleSave={toggleSave} savingId={savingId} />
      )}
      <Modal open={creating} onClose={() => setCreating(false)} title="New internal funding program" size="xl">
        {creating && <FundingForm onSubmit={create} onCancel={() => setCreating(false)} submitting={submitting} />}
      </Modal>
    </div>
  )
}
