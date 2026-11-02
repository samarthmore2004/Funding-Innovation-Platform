import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, ExternalLink, Quote, Search, Sparkles, Trophy } from 'lucide-react'
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, Field, Input, LoadingState, Pagination, Select, StatCard, Table } from '../../components/ui'
import ChartFrame from '../../components/charts/ChartFrame'
import BarChartBasic from '../../components/charts/BarChartBasic'
import { researchApi } from '../../api/research'
import { useApi, useDebounce } from '../../utils/hooks'
import { useTaxonomy } from '../../utils/taxonomy'
import { formatNumber, humanize } from '../../utils/format'
import { YEAR_OPTIONS } from '../../utils/validation'

const SORTS = [
  { value: 'citations', label: 'Most cited' },
  { value: 'year', label: 'Newest' },
  { value: 'title', label: 'Title (A–Z)' },
]

function PublicationTitle({ row }) {
  const href = row.url || (row.doi ? `https://doi.org/${row.doi}` : null)
  return (
    <div>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="font-medium text-slate-800 hover:text-indigo-700">
          {row.title} <ExternalLink className="inline h-3 w-3 text-slate-400" aria-hidden="true" />
        </a>
      ) : (
        <span className="font-medium text-slate-800">{row.title}</span>
      )}
      <p className="text-xs text-slate-500">
        {(row.authors || []).slice(0, 3).join(', ')}
        {(row.authors || []).length > 3 ? ' et al.' : ''}
        {row.venue ? ` · ${row.venue}` : ''}
      </p>
    </div>
  )
}

export function PublicationsExplorer() {
  const { domainOptions, domainName } = useTaxonomy()
  const [q, setQ] = useState('')
  const debouncedQ = useDebounce(q, 400)
  const [domain, setDomain] = useState('')
  const [yearFrom, setYearFrom] = useState('')
  const [yearTo, setYearTo] = useState('')
  const [sort, setSort] = useState('citations')
  const [page, setPage] = useState(1)

  const { data, error, loading, reload } = useApi(
    () => researchApi.publications({ q: debouncedQ, domain, year_from: yearFrom, year_to: yearTo, sort, page, page_size: 15 }),
    [debouncedQ, domain, yearFrom, yearTo, sort, page],
  )
  const reset = (setter) => (event) => {
    setter(event.target.value)
    setPage(1)
  }

  return (
    <div className="space-y-4">
      <Card padded>
        <div className="grid gap-3 md:grid-cols-[1fr_12rem_8rem_8rem_10rem]">
          <Field label="Search">
            {(id) => (
              <Input
                id={id}
                icon={Search}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value)
                  setPage(1)
                }}
                placeholder="Title, abstract or keyword"
              />
            )}
          </Field>
          <Field label="Domain">{(id) => <Select id={id} value={domain} onChange={reset(setDomain)} options={domainOptions} placeholder="All" />}</Field>
          <Field label="From">{(id) => <Select id={id} value={yearFrom} onChange={reset(setYearFrom)} options={YEAR_OPTIONS} placeholder="Any" />}</Field>
          <Field label="To">{(id) => <Select id={id} value={yearTo} onChange={reset(setYearTo)} options={YEAR_OPTIONS} placeholder="Any" />}</Field>
          <Field label="Sort">{(id) => <Select id={id} value={sort} onChange={reset(setSort)} options={SORTS} />}</Field>
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
                empty="No publications match these filters."
                columns={[
                  { key: 'title', header: 'Publication', className: 'min-w-[20rem]', render: (row) => <PublicationTitle row={row} /> },
                  { key: 'year', header: 'Year', align: 'right' },
                  { key: 'domain', header: 'Domain', render: (row) => (row.domain ? domainName(row.domain) : '—') },
                  { key: 'citation_count', header: 'Citations', align: 'right', render: (row) => formatNumber(row.citation_count) },
                  { key: 'source', header: 'Source', render: (row) => <Badge color={row.source === 'openalex' || row.source === 'crossref' ? 'green' : 'slate'}>{humanize(row.source)}</Badge> },
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

export function MyAnalyticsTab() {
  const { domainName } = useTaxonomy()
  const { data, error, loading, reload } = useApi(() => researchApi.myAnalytics(), [])
  if (error && !data) return <ErrorState message={error} onRetry={reload} />
  if (!data) return <LoadingState />
  if (!data?.total_publications) {
    return (
      <EmptyState
        icon={BookOpen}
        title="No publications in your profile yet"
        description="Add publications (or import them by DOI) to see your citation analytics, h-index and output over time."
        action={
          <Button as={Link} to="/app/profile?tab=publications">
            Add publications
          </Button>
        }
      />
    )
  }
  const byYear = data.by_year || []
  const byDomain = (data.by_domain || []).map((row) => ({ ...row, label: domainName(row.domain) }))
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Publications" value={formatNumber(data.total_publications)} icon={BookOpen} tone="indigo" />
        <StatCard label="Citations" value={formatNumber(data.total_citations)} icon={Quote} tone="violet" />
        <StatCard label="h-index" value={formatNumber(data.h_index)} icon={Trophy} tone="sky" hint="h papers with at least h citations" />
        <StatCard label="i10-index" value={formatNumber(data.i10_index)} icon={Sparkles} tone="green" hint="Papers with 10+ citations" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <ChartFrame
          title="Publications per year"
          empty={!byYear.length}
          table={{ columns: [{ key: 'year', label: 'Year' }, { key: 'publications', label: 'Publications', align: 'right' }, { key: 'citations', label: 'Citations', align: 'right' }], rows: byYear }}
        >
          <BarChartBasic data={byYear} categoryKey="year" bars={[{ key: 'publications', name: 'Publications' }]} height={240} showValues />
        </ChartFrame>
        <ChartFrame title="Citations received by publication year" empty={!byYear.length}>
          <BarChartBasic data={byYear} categoryKey="year" bars={[{ key: 'citations', name: 'Citations', color: '#2a78d6' }]} height={240} showValues />
        </ChartFrame>
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <ChartFrame title="Output by domain" empty={!byDomain.length} className="xl:col-span-1">
          <BarChartBasic data={byDomain} categoryKey="label" bars={[{ key: 'count', name: 'Publications' }]} horizontal showValues />
        </ChartFrame>
        <Card className="xl:col-span-2">
          <CardHeader title="Your most cited publications" />
          <div className="px-2 py-2">
            <Table
              rows={data.top || []}
              columns={[
                { key: 'title', header: 'Publication', render: (row) => <PublicationTitle row={row} /> },
                { key: 'year', header: 'Year', align: 'right' },
                { key: 'citation_count', header: 'Citations', align: 'right', render: (row) => formatNumber(row.citation_count) },
              ]}
            />
          </div>
        </Card>
      </div>
    </div>
  )
}
