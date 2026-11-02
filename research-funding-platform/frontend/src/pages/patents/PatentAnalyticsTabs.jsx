import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { Info, Radio, Search } from 'lucide-react'
import { Alert, Button, Card, CardHeader, EmptyState, ErrorState, Field, Input, LoadingState, Select, Table, TagInput } from '../../components/ui'
import ChartFrame from '../../components/charts/ChartFrame'
import TrendLineChart from '../../components/charts/TrendLineChart'
import BarChartBasic from '../../components/charts/BarChartBasic'
import ScatterPlot from '../../components/charts/ScatterPlot'
import HeatmapGrid from '../../components/charts/HeatmapGrid'
import { PatentStatusBadge } from '../../components/domain/Badges'
import { patentsApi } from '../../api/patents'
import { getErrorMessage } from '../../api/client'
import { useApi, useStableColors } from '../../utils/hooks'
import { useTaxonomy } from '../../utils/taxonomy'
import { formatDate, formatDecimal, formatNumber, formatPercent, formatRatio, truncate } from '../../utils/format'
import { normalizeOptions } from '../../utils/labels'

function DomainFilter({ value, onChange, facets, placeholder = 'All domains', label = 'Technology domain' }) {
  const { domainName } = useTaxonomy()
  const options = normalizeOptions(facets?.domains).map((o) => ({ ...o, label: o.label === o.value ? domainName(o.value) : o.label }))
  return (
    <Card padded>
      <Field label={label} className="max-w-sm">
        {(id) => <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} options={options} placeholder={placeholder} />}
      </Field>
    </Card>
  )
}

export function PatentTrendsTab({ facets }) {
  const { domainName } = useTaxonomy()
  const [domain, setDomain] = useState('')
  const { data, error, loading, reload } = useApi(() => patentsApi.trends({ domain }), [domain])
  const series = data?.series || []
  const domains = data?.domains || []

  const topDomains = useMemo(() => {
    const totals = domains.map((d) => ({ ...d, total: series.reduce((sum, row) => sum + (Number(row[d.key]) || 0), 0) }))
    return totals.sort((a, b) => b.total - a.total).slice(0, 5)
  }, [domains, series])
  const colors = useStableColors(topDomains.map((d) => d.key))

  return (
    <div className="space-y-6">
      <DomainFilter value={domain} onChange={setDomain} facets={facets} />
      <ChartFrame
        title={domain ? `Patent filings per year · ${domainName(domain)}` : 'Patent filings per year · all domains'}
        loading={loading}
        error={error}
        onRetry={reload}
        empty={!series.length}
        table={{ columns: [{ key: 'year', label: 'Year' }, { key: 'total', label: 'Filings', align: 'right' }], rows: series }}
      >
        <TrendLineChart data={series} series={[{ key: 'total', name: 'Patent filings' }]} xKey="year" height={260} />
      </ChartFrame>
      {!domain && topDomains.length > 1 && (
        <ChartFrame
          title="Filing trend by technology domain"
          subtitle="Five most active domains"
          table={{
            columns: [{ key: 'year', label: 'Year' }, ...topDomains.map((d) => ({ key: d.key, label: d.name || domainName(d.key), align: 'right' }))],
            rows: series,
          }}
        >
          <TrendLineChart
            data={series}
            series={topDomains.map((d) => ({ key: d.key, name: d.name || domainName(d.key), color: colors[d.key] }))}
            xKey="year"
            height={300}
          />
        </ChartFrame>
      )}
    </div>
  )
}

export function AssigneesTab({ facets }) {
  const { domainName } = useTaxonomy()
  const [domain, setDomain] = useState('')
  const top = useApi(() => patentsApi.assignees({ domain, limit: 10 }), [domain])
  const assigneeOptions = normalizeOptions(facets?.assignees)
  const [picked, setPicked] = useState(null)
  const chosen = picked ?? assigneeOptions.slice(0, 3).map((o) => o.value)
  const ready = chosen.length >= 2
  const comp = useApi(() => (ready ? patentsApi.competitors(chosen) : Promise.resolve(null)), [chosen.join('\u0001')])
  const colors = useStableColors(chosen)

  const topRows = (top.data?.items || []).map((row) => ({ ...row, label: row.assignee }))
  const compData = comp.data
  const byDomain = (compData?.by_domain || []).map((row) => ({ ...row, label: row.name || domainName(row.domain) }))
  const lines = (compData?.assignees || chosen).map((name) => ({ key: name, name, color: colors[name] }))

  return (
    <div className="space-y-6">
      <DomainFilter value={domain} onChange={setDomain} facets={facets} />
      <div className="grid gap-6 xl:grid-cols-2">
        <ChartFrame
          title="Most active assignees"
          subtitle={domain ? domainName(domain) : 'All technology domains'}
          loading={top.loading}
          error={top.error}
          onRetry={top.reload}
          empty={!topRows.length}
          table={{
            columns: [
              { key: 'assignee', label: 'Assignee' },
              { key: 'patents', label: 'Patents', align: 'right' },
              { key: 'citations', label: 'Citations', align: 'right' },
              { key: 'avg_citations', label: 'Avg citations', align: 'right', format: (v) => formatDecimal(v, 1) },
              { key: 'recent_share', label: 'Recent share', align: 'right', format: (v) => formatRatio(v) },
            ],
            rows: topRows,
          }}
        >
          <BarChartBasic data={topRows} categoryKey="label" bars={[{ key: 'patents', name: 'Patents' }]} horizontal showValues categoryWidth={170} maxChars={24} />
        </ChartFrame>
        <Card>
          <CardHeader title="Assignee profiles" subtitle="Portfolio size, impact and activity window" />
          <div className="px-2 py-2">
            <Table
              dense
              rows={topRows}
              rowKey="assignee"
              empty="No assignees."
              columns={[
                { key: 'assignee', header: 'Assignee', render: (row) => <span className="font-medium text-slate-800">{row.assignee}</span> },
                { key: 'top_domain', header: 'Main domain', render: (row) => domainName(row.top_domain) },
                { key: 'patents', header: 'Patents', align: 'right' },
                { key: 'avg_citations', header: 'Avg cites', align: 'right', render: (row) => formatDecimal(row.avg_citations, 1) },
                { key: 'years', header: 'Active', render: (row) => `${row.first_year ?? '—'}–${row.last_year ?? '—'}` },
              ]}
            />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Competitor comparison" subtitle="Pick 2–5 assignees to compare filing activity and technology focus." />
        <div className="px-5 py-4">
          <Field label="Assignees to compare">
            {(id) => <TagInput id={id} value={chosen} onChange={setPicked} suggestions={assigneeOptions} allowCustom={false} max={5} placeholder="Add an assignee" />}
          </Field>
          {!ready && <p className="mt-3 text-sm text-slate-500">Select at least two assignees.</p>}
        </div>
      </Card>

      {ready && (
        <>
          {comp.error && <Alert variant="error">{comp.error}</Alert>}
          <div className="grid gap-6 xl:grid-cols-2">
            <ChartFrame
              title="Filings per year"
              loading={comp.loading}
              empty={!compData?.by_year?.length}
              table={{ columns: [{ key: 'year', label: 'Year' }, ...lines.map((l) => ({ key: l.key, label: l.name, align: 'right' }))], rows: compData?.by_year || [] }}
            >
              <TrendLineChart data={compData?.by_year || []} series={lines} xKey="year" height={280} />
            </ChartFrame>
            <ChartFrame
              title="Technology focus"
              subtitle="Patents per domain"
              loading={comp.loading}
              empty={!byDomain.length}
              table={{ columns: [{ key: 'label', label: 'Domain' }, ...lines.map((l) => ({ key: l.key, label: l.name, align: 'right' }))], rows: byDomain }}
            >
              <BarChartBasic data={byDomain} categoryKey="label" bars={lines} horizontal categoryWidth={150} maxChars={20} />
            </ChartFrame>
          </div>
          <Card>
            <CardHeader title="Competitive summary" />
            <div className="px-2 py-2">
              <Table
                rows={compData?.summary || []}
                rowKey="assignee"
                empty={comp.loading ? 'Loading…' : 'No data.'}
                columns={[
                  {
                    key: 'assignee',
                    header: 'Assignee',
                    render: (row) => (
                      <span className="inline-flex items-center gap-2 font-medium text-slate-800">
                        <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: colors[row.assignee] }} aria-hidden="true" />
                        {row.assignee}
                      </span>
                    ),
                  },
                  { key: 'patents', header: 'Patents', align: 'right' },
                  { key: 'citations', header: 'Citations', align: 'right', render: (row) => formatNumber(row.citations) },
                  { key: 'avg_citations', header: 'Avg cites', align: 'right', render: (row) => formatDecimal(row.avg_citations, 1) },
                  { key: 'top_classifications', header: 'Top classes', render: (row) => <span className="font-mono text-xs">{(row.top_classifications || []).join(', ') || '—'}</span> },
                  {
                    key: 'growth',
                    header: 'Growth (last 3 yrs)',
                    align: 'right',
                    render: (row) => (typeof row.growth === 'number' ? formatPercent(row.growth, 0, { signed: true }) : '—'),
                  },
                ]}
              />
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

export function ClustersTab({ facets }) {
  const navigate = useNavigate()
  const [domain, setDomain] = useState('')
  const [k, setK] = useState('')
  const { data, error, loading, reload } = useApi(() => patentsApi.clusters({ domain, k }), [domain, k])
  const clusters = data?.clusters || []
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    if (!clusters.length) return
    if (selected === null || !clusters.some((c) => c.id === selected)) {
      const largest = [...clusters].sort((a, b) => (b.size || 0) - (a.size || 0))[0]
      setSelected(largest.id)
    }
  }, [clusters, selected])

  const current = clusters.find((c) => c.id === selected)
  const points = (data?.points || []).map((p) => ({
    ...p,
    label: truncate(p.title, 60),
    sublabel: p.assignee,
    highlight: p.cluster === selected,
  }))

  return (
    <div className="space-y-6">
      <Card padded>
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
          <Field label="Technology domain">
            {(id) => (
              <Select
                id={id}
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                options={normalizeOptions(facets?.domains)}
                placeholder="All domains"
              />
            )}
          </Field>
          <Field label="Number of clusters">
            {(id) => (
              <Select
                id={id}
                value={k}
                onChange={(e) => setK(e.target.value)}
                options={[3, 4, 5, 6, 7, 8].map((n) => ({ value: String(n), label: `${n} clusters` }))}
                placeholder="Automatic (best silhouette)"
              />
            )}
          </Field>
        </div>
      </Card>
      {error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <LoadingState label="Clustering patents…" />
      ) : clusters.length === 0 ? (
        <EmptyState title="Not enough patents to cluster" description="Choose a broader domain or import more patent data." />
      ) : (
        <div className={clsx('grid gap-6 xl:grid-cols-[1fr_22rem]', loading && 'opacity-60')}>
          <ChartFrame
            title="Patent innovation map"
            subtitle={`TF-IDF + K-means (k = ${data.k}), projected to 2-D with truncated SVD · silhouette ${formatDecimal(data.silhouette, 3)}. Click a point to open the patent.`}
            table={{
              columns: [
                { key: 'title', label: 'Patent' },
                { key: 'assignee', label: 'Assignee' },
                { key: 'cluster', label: 'Cluster', format: (v) => clusters.find((c) => c.id === v)?.label || v },
              ],
              rows: data.points || [],
            }}
          >
            <ScatterPlot
              points={points}
              xLabel="Component 1"
              yLabel="Component 2"
              highlightLabel={current ? `Cluster: ${current.label}` : 'Selected cluster'}
              restLabel="Other clusters"
              labelHighlighted={false}
              height={380}
              onPointClick={(point) => point?.id && navigate(`/app/patents/${point.id}`)}
            />
          </ChartFrame>
          <Card>
            <CardHeader title="Clusters" subtitle="Select a cluster to highlight it on the map" />
            <ul className="max-h-[30rem] divide-y divide-slate-100 overflow-y-auto">
              {clusters.map((cluster) => (
                <li key={cluster.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(cluster.id)}
                    aria-pressed={cluster.id === selected}
                    className={clsx('w-full px-5 py-3 text-left transition-colors', cluster.id === selected ? 'bg-indigo-50' : 'hover:bg-slate-50')}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900">{cluster.label}</span>
                      <span className="text-xs text-slate-500">{formatNumber(cluster.size)} patents</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{(cluster.top_terms || []).slice(0, 6).join(' · ')}</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Avg citations {formatDecimal(cluster.avg_citations, 1)}
                      {cluster.top_assignees?.length ? ` · ${cluster.top_assignees.slice(0, 2).join(', ')}` : ''}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  )
}

export function InnovationMapTab() {
  const { domainName } = useTaxonomy()
  const { data, error, loading, reload } = useApi(() => patentsApi.innovationMap(), [])
  if (error && !data) return <ErrorState message={error} onRetry={reload} />
  if (!data) return <LoadingState />
  const rows = (data?.domains || []).map((d) => ({ key: d.key, label: d.name || domainName(d.key) }))
  const columns = (data?.assignees || []).map((a) => ({ key: a, label: a }))
  const cells = (data?.cells || []).map((c) => ({ row: c.domain, column: c.assignee, value: c.count }))
  if (!rows.length || !columns.length) return <EmptyState title="No data for the innovation map" />
  return (
    <ChartFrame
      title="Innovation map: who patents what"
      subtitle="Patent counts by technology domain and assignee. Darker cells mean more filings."
      table={{
        columns: [
          { key: 'domain', label: 'Domain', format: (v) => domainName(v) },
          { key: 'assignee', label: 'Assignee' },
          { key: 'count', label: 'Patents', align: 'right' },
        ],
        rows: data.cells || [],
      }}
    >
      <HeatmapGrid rows={rows} columns={columns} cells={cells} rowHeader="Domain" valueLabel="patents" />
    </ChartFrame>
  )
}

export function LiveSearchTab() {
  const [q, setQ] = useState('')
  const [state, setState] = useState({ loading: false, error: null, unavailable: null, data: null })
  const run = async (event) => {
    event.preventDefault()
    if (q.trim().length < 2) return
    setState({ loading: true, error: null, unavailable: null, data: null })
    try {
      const data = await patentsApi.liveSearch(q.trim())
      setState({ loading: false, error: null, unavailable: null, data })
    } catch (err) {
      if (err?.response?.status === 503) setState({ loading: false, error: null, unavailable: getErrorMessage(err), data: null })
      else setState({ loading: false, error: getErrorMessage(err), unavailable: null, data: null })
    }
  }
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Live patent search (USPTO PatentsView)"
          subtitle="Optional integration. Requires a free PatentsView API key configured on the server (PATENTSVIEW_API_KEY)."
          icon={Radio}
        />
        <form onSubmit={run} className="flex flex-col gap-3 px-5 py-4 sm:flex-row">
          <Input icon={Search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. solid-state battery electrolyte" className="flex-1" aria-label="Patent search terms" />
          <Button type="submit" loading={state.loading}>
            Search live data
          </Button>
        </form>
      </Card>
      {state.unavailable && (
        <Alert variant="neutral" icon={Info} title="Live patent search is not configured">
          {state.unavailable}
        </Alert>
      )}
      {state.error && <Alert variant="error">{state.error}</Alert>}
      {state.data && (
        <Card>
          <CardHeader title={`${formatNumber(state.data.items?.length || 0)} live results`} subtitle={state.data.note} />
          <div className="px-2 py-2">
            <Table
              rows={state.data.items || []}
              rowKey={(row, index) => row.patent_number || index}
              empty="No patents matched."
              columns={[
                {
                  key: 'title',
                  header: 'Patent',
                  render: (row) => (
                    <div>
                      {row.url ? (
                        <a href={row.url} target="_blank" rel="noreferrer" className="font-medium text-slate-800 hover:text-indigo-700">
                          {row.title}
                        </a>
                      ) : (
                        <span className="font-medium text-slate-800">{row.title}</span>
                      )}
                      <p className="font-mono text-[11px] text-slate-500">{row.patent_number}</p>
                    </div>
                  ),
                },
                { key: 'assignee', header: 'Assignee', render: (row) => row.assignee || '—' },
                { key: 'filing_date', header: 'Date', render: (row) => formatDate(row.grant_date || row.filing_date) },
                { key: 'status', header: 'Status', render: (row) => <PatentStatusBadge status={row.status} /> },
                { key: 'citation_count', header: 'Cited by', align: 'right', render: (row) => formatNumber(row.citation_count) },
              ]}
            />
          </div>
        </Card>
      )}
    </div>
  )
}
