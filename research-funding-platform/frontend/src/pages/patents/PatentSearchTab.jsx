import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FilterX, Search } from 'lucide-react'
import { Button, Card, ErrorState, Field, Input, LoadingState, Pagination, Select, Table } from '../../components/ui'
import { PatentRecordBadge, PatentStatusBadge } from '../../components/domain/Badges'
import { patentsApi } from '../../api/patents'
import { useApi, useDebounce } from '../../utils/hooks'
import { useTaxonomy } from '../../utils/taxonomy'
import { formatDate, formatNumber } from '../../utils/format'
import { PATENT_STATUS_LABELS, normalizeOptions } from '../../utils/labels'
import { YEAR_OPTIONS } from '../../utils/validation'

const SORTS = [
  { value: 'filing_date', label: 'Newest filings' },
  { value: 'citations', label: 'Most cited' },
  { value: 'title', label: 'Title (A–Z)' },
]

const EMPTY_FILTERS = { assignee: '', classification: '', domain: '', status: '', year_from: '', year_to: '', sort: 'filing_date' }

export default function PatentSearchTab({ facets }) {
  const navigate = useNavigate()
  const { domainName } = useTaxonomy()
  const [q, setQ] = useState('')
  const debouncedQ = useDebounce(q, 400)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [page, setPage] = useState(1)

  const { data, error, loading, reload } = useApi(
    () => patentsApi.list({ q: debouncedQ, ...filters, page, page_size: 15 }),
    [debouncedQ, JSON.stringify(filters), page],
  )

  const set = (key) => (event) => {
    setFilters((prev) => ({ ...prev, [key]: event.target.value }))
    setPage(1)
  }

  const domainOptions = normalizeOptions(facets?.domains).map((o) => ({ ...o, label: o.label === o.value ? domainName(o.value) : o.label }))
  const assigneeOptions = normalizeOptions(facets?.assignees)
  const classOptions = normalizeOptions(facets?.classifications)
  const statusOptions = normalizeOptions(facets?.statuses, PATENT_STATUS_LABELS)

  return (
    <div className="space-y-4">
      <Card padded>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Search" className="md:col-span-2">
            {(id) => (
              <Input
                id={id}
                icon={Search}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value)
                  setPage(1)
                }}
                placeholder="Title, abstract, assignee or keyword"
              />
            )}
          </Field>
          <Field label="Technology domain">{(id) => <Select id={id} value={filters.domain} onChange={set('domain')} options={domainOptions} placeholder="All domains" showCounts />}</Field>
          <Field label="Assignee">{(id) => <Select id={id} value={filters.assignee} onChange={set('assignee')} options={assigneeOptions} placeholder="All assignees" showCounts />}</Field>
          <Field label="Classification">{(id) => <Select id={id} value={filters.classification} onChange={set('classification')} options={classOptions} placeholder="All classes" showCounts />}</Field>
          <Field label="Status">{(id) => <Select id={id} value={filters.status} onChange={set('status')} options={statusOptions} placeholder="Any status" showCounts />}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Filed from">{(id) => <Select id={id} value={filters.year_from} onChange={set('year_from')} options={YEAR_OPTIONS} placeholder="Any" />}</Field>
            <Field label="Filed to">{(id) => <Select id={id} value={filters.year_to} onChange={set('year_to')} options={YEAR_OPTIONS} placeholder="Any" />}</Field>
          </div>
          <div className="flex items-end gap-2">
            <Field label="Sort" className="flex-1">{(id) => <Select id={id} value={filters.sort} onChange={set('sort')} options={SORTS} />}</Field>
            <Button
              variant="ghost"
              icon={FilterX}
              onClick={() => {
                setQ('')
                setFilters(EMPTY_FILTERS)
                setPage(1)
              }}
              aria-label="Clear filters"
            />
          </div>
        </div>
      </Card>
      <Card>
        <div className="px-2 py-2">
          {error && !data ? (
            <ErrorState compact message={error} onRetry={reload} />
          ) : !data ? (
            <LoadingState compact />
          ) : (
            <div className={loading ? 'opacity-60' : ''}>
              <Table
                rows={data.items || []}
                onRowClick={(row) => navigate(`/app/patents/${row.id}`)}
                empty="No patents match these filters."
                columns={[
                  {
                    key: 'title',
                    header: 'Patent',
                    className: 'min-w-[18rem]',
                    render: (row) => (
                      <div>
                        <p className="font-medium text-slate-800">{row.title}</p>
                        <p className="font-mono text-[11px] text-slate-500">{row.patent_number || '—'}</p>
                      </div>
                    ),
                  },
                  { key: 'assignee', header: 'Assignee', render: (row) => row.assignee || '—' },
                  { key: 'filing_date', header: 'Filed', render: (row) => formatDate(row.filing_date) },
                  { key: 'technology_domain', header: 'Domain', render: (row) => domainName(row.technology_domain) },
                  { key: 'classification', header: 'Class', render: (row) => <span className="font-mono text-xs">{row.classification || '—'}</span> },
                  { key: 'status', header: 'Status', render: (row) => <PatentStatusBadge status={row.status} /> },
                  { key: 'citation_count', header: 'Cited by', align: 'right', render: (row) => formatNumber(row.citation_count) },
                  { key: 'record_type', header: 'Data', render: (row) => <PatentRecordBadge type={row.record_type} /> },
                ]}
              />
              <Pagination className="px-3 py-3" page={data.page || page} pages={data.pages} total={data.total} pageSize={data.page_size || 15} onChange={setPage} />
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
