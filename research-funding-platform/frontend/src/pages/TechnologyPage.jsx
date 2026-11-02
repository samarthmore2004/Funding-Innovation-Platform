import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Cpu, Lightbulb, LineChart, Minus, Sparkles, Swords, Table2, TrendingDown, TrendingUp } from 'lucide-react'
import { Alert, Badge, Card, CardHeader, EmptyState, ErrorState, Field, LoadingState, PageHeader, ProgressBar, Select, Table, Tabs, TagInput } from '../components/ui'
import ChartFrame from '../components/charts/ChartFrame'
import BarChartBasic from '../components/charts/BarChartBasic'
import ScatterPlot from '../components/charts/ScatterPlot'
import TrendLineChart from '../components/charts/TrendLineChart'
import { MaturityBadge } from '../components/domain/Badges'
import { technologyApi } from '../api/technology'
import { useApi, useStableColors } from '../utils/hooks'
import { formatDecimal, formatNumber, formatPercent, formatRatio, humanize } from '../utils/format'

const TABS = [
  { key: 'overview', label: 'Technology areas', icon: Table2 },
  { key: 'emerging', label: 'Emerging technologies', icon: Sparkles },
  { key: 'opportunities', label: 'Opportunities', icon: Lightbulb },
  { key: 'adoption', label: 'Adoption tracking', icon: LineChart },
  { key: 'competitive', label: 'Competitive monitoring', icon: Swords },
]

const SORTS = [
  { value: 'emerging_score', label: 'Emerging score' },
  { value: 'opportunity_score', label: 'Opportunity score' },
  { value: 'maturity_index', label: 'Maturity' },
  { value: 'adoption_index', label: 'Adoption' },
  { value: 'publication_cagr', label: 'Research growth' },
  { value: 'patent_count', label: 'Patent volume' },
]

function median(values) {
  const sorted = values.filter((v) => typeof v === 'number' && !Number.isNaN(v)).sort((a, b) => a - b)
  if (!sorted.length) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function OverviewTab() {
  const navigate = useNavigate()
  const [sort, setSort] = useState('emerging_score')
  const { data, error, loading, reload } = useApi(() => technologyApi.areas(), [])
  const items = useMemo(() => [...(data?.items || [])].sort((a, b) => (Number(b[sort]) || 0) - (Number(a[sort]) || 0)), [data, sort])
  if (error && !data) return <ErrorState message={error} onRetry={reload} />
  if (!data) return <LoadingState />
  return (
    <div className="space-y-4">
      {data?.notes?.length > 0 && (
        <Alert variant="info" title="How these indicators are derived">
          <ul className="list-disc space-y-0.5 pl-4">
            {data.notes.map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
        </Alert>
      )}
      <Card>
        <CardHeader
          title="Technology areas"
          subtitle="Click a row for the full area profile."
          actions={<Select aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value)} options={SORTS} className="h-9 w-48" />}
        />
        <div className="px-2 py-2">
          <Table
            rows={items}
            rowKey="key"
            onRowClick={(row) => navigate(`/app/technology/${row.key}`)}
            empty="No technology areas."
            columns={[
              { key: 'name', header: 'Area', className: 'min-w-[12rem]', render: (row) => <span className="font-medium text-slate-800">{row.name}</span> },
              { key: 'maturity_stage', header: 'Maturity', render: (row) => <MaturityBadge stage={row.maturity_stage} /> },
              { key: 'publication_count', header: 'Publications', align: 'right', render: (row) => formatNumber(row.publication_count) },
              { key: 'publication_cagr', header: 'Pub. growth', align: 'right', render: (row) => formatPercent(row.publication_cagr, 1, { signed: true }) },
              { key: 'patent_count', header: 'Patents', align: 'right', render: (row) => formatNumber(row.patent_count) },
              { key: 'patent_cagr', header: 'Patent growth', align: 'right', render: (row) => formatPercent(row.patent_cagr, 1, { signed: true }) },
              { key: 'funding_count', header: 'Funding calls', align: 'right', render: (row) => formatNumber(row.funding_count) },
              { key: 'emerging_score', header: 'Emerging', className: 'min-w-[7rem]', render: (row) => <ProgressBar value={row.emerging_score} size="sm" /> },
              { key: 'opportunity_score', header: 'Opportunity', className: 'min-w-[7rem]', render: (row) => <ProgressBar value={row.opportunity_score} size="sm" /> },
            ]}
          />
        </div>
      </Card>
    </div>
  )
}

function EmergingTab() {
  const { data, error, loading, reload } = useApi(() => technologyApi.emerging(), [])
  const items = data?.items || []
  const rows = items.map((item) => ({ ...item, label: item.name }))
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <ChartFrame
        title="Emerging technology identification"
        subtitle="Emerging score combines recent research and patent acceleration"
        loading={loading}
        error={error}
        onRetry={reload}
        empty={!rows.length}
        table={{
          columns: [
            { key: 'name', label: 'Area' },
            { key: 'emerging_score', label: 'Emerging score', align: 'right', format: (v) => formatDecimal(v, 1) },
            { key: 'publication_cagr', label: 'Pub. growth', align: 'right', format: (v) => formatPercent(v, 1) },
            { key: 'patent_cagr', label: 'Patent growth', align: 'right', format: (v) => formatPercent(v, 1) },
          ],
          rows,
        }}
      >
        <BarChartBasic data={rows} categoryKey="label" bars={[{ key: 'emerging_score', name: 'Emerging score' }]} horizontal showValues valueFormatter={(v) => formatDecimal(v, 0)} categoryWidth={190} maxChars={28} />
      </ChartFrame>
      <Card>
        <CardHeader title="Ranked emerging areas" />
        <ul className="divide-y divide-slate-100">
          {items.slice(0, 8).map((item, index) => (
            <li key={item.key} className="px-5 py-3">
              <div className="flex items-center justify-between gap-2">
                <Link to={`/app/technology/${item.key}`} className="text-sm font-medium text-slate-800 hover:text-indigo-700">
                  {index + 1}. {item.name}
                </Link>
                <MaturityBadge stage={item.maturity_stage} />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Research growth {formatPercent(item.publication_cagr, 1, { signed: true })} · Patent growth {formatPercent(item.patent_cagr, 1, { signed: true })} ·{' '}
                {formatNumber(item.funding_count)} funding calls
              </p>
              <ProgressBar value={item.emerging_score} size="sm" className="mt-2" showValue={false} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

function OpportunitiesTab() {
  const navigate = useNavigate()
  const { data, error, loading, reload } = useApi(() => technologyApi.opportunities(), [])
  const items = data?.items || []
  const ranked = [...items].sort((a, b) => (b.opportunity_score || 0) - (a.opportunity_score || 0))
  const topKeys = new Set(ranked.slice(0, 3).map((i) => i.key))
  const points = items.map((item) => ({
    id: item.key,
    x: Number(item.research_momentum) || 0,
    y: Number(item.patent_density) || 0,
    label: item.name,
    sublabel: `Opportunity score ${formatDecimal(item.opportunity_score, 0)}`,
    highlight: topKeys.has(item.key),
  }))
  if (error && !data) return <ErrorState message={error} onRetry={reload} />
  if (!data) return <LoadingState />
  if (!items.length) return <EmptyState icon={Lightbulb} title="No opportunity data" />
  return (
    <div className="space-y-6">
      <ChartFrame
        title="Innovation opportunity quadrant"
        subtitle="Research momentum vs patent density. Bottom-right = strong research activity with relatively few patents (white space). Top 3 opportunities highlighted."
        table={{
          columns: [
            { key: 'name', label: 'Area' },
            { key: 'research_momentum', label: 'Research momentum', align: 'right', format: (v) => formatDecimal(v, 1) },
            { key: 'patent_density', label: 'Patent density', align: 'right', format: (v) => formatDecimal(v, 1) },
            { key: 'funding_availability', label: 'Funding availability', align: 'right', format: (v) => formatDecimal(v, 1) },
            { key: 'opportunity_score', label: 'Opportunity', align: 'right', format: (v) => formatDecimal(v, 1) },
          ],
          rows: ranked,
        }}
      >
        <ScatterPlot
          points={points}
          xLabel="Research momentum"
          yLabel="Patent density"
          referenceX={median(points.map((p) => p.x))}
          referenceY={median(points.map((p) => p.y))}
          highlightLabel="Top opportunities"
          restLabel="Other areas"
          height={400}
          onPointClick={(point) => point?.id && navigate(`/app/technology/${point.id}`)}
          quadrantLabels={{ topLeft: 'Crowded', topRight: 'Hot & contested', bottomLeft: 'Quiet', bottomRight: 'White space' }}
        />
      </ChartFrame>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ranked.map((item) => (
          <Card key={item.key} padded>
            <Link to={`/app/technology/${item.key}`} className="text-sm font-semibold text-slate-900 hover:text-indigo-700">
              {item.name}
            </Link>
            <ProgressBar value={item.opportunity_score} label="Opportunity score" className="mt-3" />
            <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div>
                <dt className="text-slate-500">Momentum</dt>
                <dd className="font-semibold text-slate-800">{formatDecimal(item.research_momentum, 0)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Patent density</dt>
                <dd className="font-semibold text-slate-800">{formatDecimal(item.patent_density, 0)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Funding</dt>
                <dd className="font-semibold text-slate-800">{formatDecimal(item.funding_availability, 0)}</dd>
              </div>
            </dl>
            {item.rationale?.length > 0 && (
              <ul className="mt-3 list-disc space-y-0.5 pl-4 text-xs text-slate-600">
                {item.rationale.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}

function AdoptionTab() {
  const { data, error, loading, reload } = useApi(() => technologyApi.adoption(), [])
  const areas = data?.areas || []
  const series = data?.series || []
  const defaults = useMemo(() => {
    const last = series[series.length - 1] || {}
    return [...areas].sort((a, b) => (Number(last[b.key]) || 0) - (Number(last[a.key]) || 0)).slice(0, 4).map((a) => a.key)
  }, [areas, series])
  const [picked, setPicked] = useState(null)
  const chosen = picked ?? defaults
  const colors = useStableColors(chosen)
  const nameOf = (key) => areas.find((a) => a.key === key)?.name || key
  const diversity = (data?.assignee_diversity || []).map((row) => ({ ...row, label: row.name || nameOf(row.key) }))

  if (error && !data) return <ErrorState message={error} onRetry={reload} />
  if (!data) return <LoadingState />
  return (
    <div className="space-y-6">
      <Card padded>
        <Field label="Technology areas" hint="Up to 5 areas.">
          {(id) => (
            <TagInput
              id={id}
              value={chosen}
              onChange={setPicked}
              suggestions={areas.map((a) => ({ value: a.key, label: a.name }))}
              allowCustom={false}
              max={5}
            />
          )}
        </Field>
      </Card>
      <ChartFrame
        title="Technology adoption: cumulative patent filings"
        subtitle="Cumulative filings per year as an adoption proxy"
        empty={!series.length || !chosen.length}
        table={{ columns: [{ key: 'year', label: 'Year' }, ...chosen.map((key) => ({ key, label: nameOf(key), align: 'right' }))], rows: series }}
      >
        <TrendLineChart data={series} series={chosen.map((key) => ({ key, name: nameOf(key), color: colors[key] }))} xKey="year" height={320} />
      </ChartFrame>
      <ChartFrame
        title="Adoption breadth: distinct assignees per area"
        subtitle="More distinct organisations filing suggests broader adoption"
        empty={!diversity.length}
        table={{ columns: [{ key: 'label', label: 'Area' }, { key: 'assignees', label: 'Assignees', align: 'right' }], rows: diversity }}
      >
        <BarChartBasic data={diversity} categoryKey="label" bars={[{ key: 'assignees', name: 'Distinct assignees' }]} horizontal showValues categoryWidth={190} maxChars={28} />
      </ChartFrame>
    </div>
  )
}

const MOMENTUM_STYLE = {
  accelerating: { color: 'green', icon: TrendingUp, label: 'Accelerating' },
  steady: { color: 'slate', icon: Minus, label: 'Steady' },
  slowing: { color: 'amber', icon: TrendingDown, label: 'Slowing' },
}

/** Filing momentum label from the API ("accelerating" | "steady" | "slowing"), shown with icon + text. */
function MomentumBadge({ value }) {
  const style = MOMENTUM_STYLE[value]
  if (!style) return <span className="text-slate-400">{value ? humanize(value) : '—'}</span>
  return (
    <Badge color={style.color} icon={style.icon}>
      {style.label}
    </Badge>
  )
}

function CompetitiveTab() {
  const areas = useApi(() => technologyApi.areas(), [])
  const [area, setArea] = useState('')
  const options = (areas.data?.items || []).map((a) => ({ value: a.key, label: a.name }))
  const selected = area || options[0]?.value || ''
  const { data, error, loading, reload } = useApi(() => (selected ? technologyApi.competitive(selected) : Promise.resolve(null)), [selected])
  const rows = (data?.assignees || []).map((row) => ({ ...row, label: row.assignee }))
  return (
    <div className="space-y-6">
      <Card padded>
        <Field label="Technology area" className="max-w-sm">
          {(id) => <Select id={id} value={selected} onChange={(e) => setArea(e.target.value)} options={options} />}
        </Field>
      </Card>
      <div className="grid gap-6 xl:grid-cols-2">
        <ChartFrame
          title={`Competitive landscape${data?.name ? ` · ${data.name}` : ''}`}
          subtitle="Patents held per organisation"
          loading={loading || areas.loading}
          error={error}
          onRetry={reload}
          empty={!rows.length}
          table={{
            columns: [
              { key: 'assignee', label: 'Assignee' },
              { key: 'patents', label: 'Patents', align: 'right' },
              { key: 'recent_patents', label: 'Recent', align: 'right' },
              { key: 'share', label: 'Share', align: 'right', format: (v) => formatRatio(v, 1) },
              { key: 'momentum', label: 'Momentum', format: (v) => (v ? humanize(v) : '—') },
            ],
            rows,
          }}
        >
          <BarChartBasic data={rows.slice(0, 12)} categoryKey="label" bars={[{ key: 'patents', name: 'Patents' }]} horizontal showValues categoryWidth={170} maxChars={24} />
        </ChartFrame>
        <Card>
          <CardHeader title="Competitor activity" subtitle="Recent filings (last 3 years) and momentum versus the 3 years before" />
          <div className="px-2 py-2">
            <Table
              dense
              rows={rows}
              rowKey="assignee"
              empty={loading ? 'Loading…' : 'No competitors found.'}
              columns={[
                { key: 'assignee', header: 'Assignee', render: (row) => <span className="font-medium text-slate-800">{row.assignee}</span> },
                { key: 'patents', header: 'Patents', align: 'right' },
                { key: 'recent_patents', header: 'Recent', align: 'right' },
                { key: 'share', header: 'Share', align: 'right', render: (row) => formatRatio(row.share, 1) },
                { key: 'momentum', header: 'Momentum', render: (row) => <MomentumBadge value={row.momentum} /> },
              ]}
            />
          </div>
        </Card>
      </div>
    </div>
  )
}

export default function TechnologyPage() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'overview'
  const setTab = (key) => setParams(key === 'overview' ? {} : { tab: key }, { replace: true })
  return (
    <div>
      <PageHeader
        icon={Cpu}
        title="Technology intelligence"
        description="Emerging technology identification, maturity analysis, adoption tracking, opportunity discovery and competitive monitoring — derived from publication, patent and funding data."
      />
      <Tabs className="mb-6" tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'emerging' ? (
        <EmergingTab />
      ) : tab === 'opportunities' ? (
        <OpportunitiesTab />
      ) : tab === 'adoption' ? (
        <AdoptionTab />
      ) : tab === 'competitive' ? (
        <CompetitiveTab />
      ) : (
        <OverviewTab />
      )}
    </div>
  )
}
