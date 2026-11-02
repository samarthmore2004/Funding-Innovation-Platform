import { Link, useParams } from 'react-router-dom'
import { BookOpen, CircleDollarSign, Cpu, FileText, Gauge, Lightbulb, Sparkles, TrendingUp } from 'lucide-react'
import { Card, CardHeader, EmptyState, ErrorState, LoadingState, PageHeader, StatCard, Table } from '../components/ui'
import ChartFrame from '../components/charts/ChartFrame'
import TrendLineChart from '../components/charts/TrendLineChart'
import FundingCard from '../components/domain/FundingCard'
import { MaturityBadge } from '../components/domain/Badges'
import { technologyApi } from '../api/technology'
import { useApi } from '../utils/hooks'
import { compactNumber, formatDecimal, formatNumber, formatPercent } from '../utils/format'

export default function TechnologyAreaPage() {
  const { key } = useParams()
  const { data: area, error, loading, reload } = useApi(() => technologyApi.area(key), [key])

  if (error && !area) return <ErrorState message={error} onRetry={reload} />
  if (!area || (loading && area.key !== key)) return <LoadingState />

  const pubSeries = area.publication_series || []
  const patSeries = area.patent_series || []

  return (
    <div>
      <PageHeader
        icon={Cpu}
        breadcrumbs={[{ label: 'Technology intelligence', to: '/app/technology' }, { label: area.name }]}
        title={area.name}
        description={area.description}
        actions={<MaturityBadge stage={area.maturity_stage} />}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Publications" value={compactNumber(area.publication_count)} hint={`Growth ${formatPercent(area.publication_cagr, 1, { signed: true })} per year`} icon={BookOpen} tone="indigo" />
        <StatCard label="Patents" value={formatNumber(area.patent_count)} hint={`Growth ${formatPercent(area.patent_cagr, 1, { signed: true })} per year`} icon={FileText} tone="violet" />
        <StatCard label="Funding opportunities" value={formatNumber(area.funding_count)} icon={CircleDollarSign} tone="green" />
        <StatCard label="Distinct assignees" value={formatNumber(area.assignee_count)} icon={TrendingUp} tone="sky" />
        <StatCard label="Maturity index" value={formatDecimal(area.maturity_index, 0)} hint={area.maturity_stage} icon={Gauge} tone="slate" />
        <StatCard label="Emerging score" value={formatDecimal(area.emerging_score, 0)} icon={Sparkles} tone="amber" />
        <StatCard label="Adoption index" value={formatDecimal(area.adoption_index, 0)} icon={TrendingUp} tone="sky" />
        <StatCard label="Opportunity score" value={formatDecimal(area.opportunity_score, 0)} icon={Lightbulb} tone="rose" />
      </div>
      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <ChartFrame
          title="Publications per year"
          empty={!pubSeries.length}
          table={{ columns: [{ key: 'year', label: 'Year' }, { key: 'count', label: 'Publications', align: 'right' }], rows: pubSeries }}
        >
          <TrendLineChart data={pubSeries} series={[{ key: 'count', name: 'Publications' }]} height={240} />
        </ChartFrame>
        <ChartFrame
          title="Patent filings per year"
          empty={!patSeries.length}
          table={{ columns: [{ key: 'year', label: 'Year' }, { key: 'count', label: 'Filings', align: 'right' }], rows: patSeries }}
        >
          <TrendLineChart data={patSeries} series={[{ key: 'count', name: 'Patent filings' }]} height={240} />
        </ChartFrame>
      </div>
      <div className="mb-6 grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader title="Leading assignees" />
          <div className="px-2 py-2">
            <Table
              dense
              rows={area.top_assignee_details || []}
              rowKey="assignee"
              empty="No assignees."
              columns={[
                { key: 'assignee', header: 'Assignee', render: (row) => <span className="font-medium text-slate-800">{row.assignee}</span> },
                { key: 'patents', header: 'Patents', align: 'right' },
                { key: 'recent_patents', header: 'Recent', align: 'right' },
              ]}
            />
          </div>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title="Most cited publications" />
          <div className="px-2 py-2">
            <Table
              dense
              rows={area.top_publications || []}
              empty="No publications."
              columns={[
                {
                  key: 'title',
                  header: 'Publication',
                  render: (row) =>
                    row.doi || row.url ? (
                      <a href={row.url || `https://doi.org/${row.doi}`} target="_blank" rel="noreferrer" className="font-medium text-slate-800 hover:text-indigo-700">
                        {row.title}
                      </a>
                    ) : (
                      <span className="font-medium text-slate-800">{row.title}</span>
                    ),
                },
                { key: 'year', header: 'Year', align: 'right' },
                { key: 'citation_count', header: 'Citations', align: 'right', render: (row) => formatNumber(row.citation_count) },
              ]}
            />
          </div>
        </Card>
      </div>
      {area.keywords?.length > 0 && (
        <Card padded className="mb-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Keywords tracked</p>
          <div className="flex flex-wrap gap-1.5">
            {area.keywords.map((keyword) => (
              <span key={keyword} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {keyword}
              </span>
            ))}
          </div>
        </Card>
      )}
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Funding opportunities in this area</h2>
      {area.funding?.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {area.funding.map((funding) => (
            <FundingCard key={funding.id} funding={funding} compact />
          ))}
        </div>
      ) : (
        <EmptyState
          compact
          icon={CircleDollarSign}
          title="No open funding opportunities tagged with this area"
          action={
            <Link to="/app/funding" className="text-sm font-medium text-indigo-600">
              Browse all funding
            </Link>
          }
        />
      )}
    </div>
  )
}
