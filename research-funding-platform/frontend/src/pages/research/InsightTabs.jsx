import { useState } from 'react'
import { Flame, Info } from 'lucide-react'
import { Card, CardHeader, EmptyState, ErrorState, Field, LoadingState, ProgressBar, Select, Table } from '../../components/ui'
import ChartFrame from '../../components/charts/ChartFrame'
import BarChartBasic from '../../components/charts/BarChartBasic'
import TrendLineChart from '../../components/charts/TrendLineChart'
import { researchApi } from '../../api/research'
import { useApi } from '../../utils/hooks'
import { useTaxonomy } from '../../utils/taxonomy'
import { formatDecimal, formatNumber, formatPercent, formatRatio } from '../../utils/format'

/** The API reports growth_rate as a percentage change between the two windows (150 = +150%). */
export function growthText(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return formatPercent(Number(value), 0, { signed: true })
}

function MethodNote({ text }) {
  if (!text) return null
  return (
    <p className="flex gap-1.5 text-xs text-slate-500">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {text}
    </p>
  )
}

export function EmergingTab() {
  const { domainOptions, domainName } = useTaxonomy()
  const [domain, setDomain] = useState('')
  const [limit, setLimit] = useState('15')
  const { data, error, loading, reload } = useApi(() => researchApi.emergingTopics({ domain, limit }), [domain, limit])
  const items = data?.items || []
  const windowInfo = data?.window
  const rows = items.map((item) => ({ ...item, label: item.term }))

  return (
    <div className="space-y-6">
      <Card padded>
        <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
          <Field label="Domain">{(id) => <Select id={id} value={domain} onChange={(e) => setDomain(e.target.value)} options={domainOptions} placeholder="All domains" />}</Field>
          <Field label="Topics">
            {(id) => <Select id={id} value={limit} onChange={(e) => setLimit(e.target.value)} options={['10', '15', '25'].map((v) => ({ value: v, label: `Top ${v}` }))} />}
          </Field>
        </div>
      </Card>
      <ChartFrame
        title="Emerging research topics"
        subtitle={
          windowInfo?.recent && windowInfo?.previous
            ? `Emergence score comparing ${windowInfo.recent[0]}–${windowInfo.recent[1]} with ${windowInfo.previous[0]}–${windowInfo.previous[1]}`
            : 'Emergence score per topic'
        }
        loading={loading}
        error={error}
        onRetry={reload}
        empty={!rows.length}
        emptyTitle="No emerging topics detected for this selection"
        table={{
          columns: [
            { key: 'term', label: 'Topic' },
            { key: 'previous_count', label: 'Earlier window', align: 'right', format: (v) => formatNumber(v) },
            { key: 'recent_count', label: 'Recent window', align: 'right', format: (v) => formatNumber(v) },
            { key: 'growth_rate', label: 'Growth', align: 'right', format: (v) => growthText(v) },
            { key: 'score', label: 'Score', align: 'right', format: (v) => formatDecimal(v, 1) },
          ],
          rows,
        }}
        footer={<MethodNote text={data?.method} />}
      >
        <BarChartBasic data={rows} categoryKey="label" bars={[{ key: 'score', name: 'Emergence score' }]} horizontal showValues valueFormatter={(v) => formatDecimal(v, 1)} />
      </ChartFrame>
      {rows.length > 0 && (
        <Card>
          <CardHeader title="Topic details" />
          <div className="px-2 py-2">
            <Table
              rows={rows}
              rowKey="term"
              columns={[
                { key: 'term', header: 'Topic', render: (row) => <span className="font-medium text-slate-800">{row.term}</span> },
                { key: 'domains', header: 'Domains', render: (row) => (row.domains || []).map((d) => domainName(d)).join(', ') || '—' },
                { key: 'previous_count', header: 'Earlier', align: 'right', render: (row) => formatNumber(row.previous_count) },
                { key: 'recent_count', header: 'Recent', align: 'right', render: (row) => formatNumber(row.recent_count) },
                { key: 'growth_rate', header: 'Growth', align: 'right', render: (row) => growthText(row.growth_rate) },
              ]}
            />
          </div>
        </Card>
      )}
    </div>
  )
}

export function HotspotsTab() {
  const { domainName } = useTaxonomy()
  const { data, error, loading, reload } = useApi(() => researchApi.hotspots({ limit: 8 }), [])
  const items = data?.items || []
  if (error && !data) return <ErrorState message={error} onRetry={reload} />
  if (!data) return <LoadingState />
  if (!items.length) return <EmptyState icon={Flame} title="No research hotspots identified" />
  const rows = items.map((item) => ({ ...item, chartLabel: item.label }))
  return (
    <div className="space-y-6">
      <ChartFrame
        title="Hotspot score"
        subtitle="Clusters of related publications ranked by volume, recency and citation impact"
        table={{
          columns: [
            { key: 'label', label: 'Hotspot' },
            { key: 'size', label: 'Publications', align: 'right' },
            { key: 'avg_citations', label: 'Avg citations', align: 'right', format: (v) => formatDecimal(v, 1) },
            { key: 'recent_share', label: 'Recent share', align: 'right', format: (v) => formatRatio(v) },
            { key: 'hotspot_score', label: 'Score', align: 'right', format: (v) => formatDecimal(v, 1) },
          ],
          rows,
        }}
        footer={<MethodNote text={data?.method} />}
      >
        <BarChartBasic data={rows} categoryKey="chartLabel" bars={[{ key: 'hotspot_score', name: 'Hotspot score' }]} horizontal showValues valueFormatter={(v) => formatDecimal(v, 1)} categoryWidth={180} maxChars={26} />
      </ChartFrame>
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item, index) => (
          <Card key={`${item.label}-${index}`} padded>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                  <Flame className="h-4 w-4 text-orange-500" aria-hidden="true" /> {item.label}
                </p>
                {item.domain && <p className="text-xs text-slate-500">{domainName(item.domain)}</p>}
              </div>
              <span className="text-xs text-slate-500">{formatNumber(item.size)} papers</span>
            </div>
            <ProgressBar value={item.hotspot_score} label="Hotspot score" size="sm" className="mt-3" />
            <div className="mt-3 flex flex-wrap gap-1">
              {(item.top_terms || []).slice(0, 8).map((term) => (
                <span key={term} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                  {term}
                </span>
              ))}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-slate-500">Avg citations</dt>
                <dd className="font-semibold text-slate-800">{formatDecimal(item.avg_citations, 1)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Published in recent years</dt>
                <dd className="font-semibold text-slate-800">{formatRatio(item.recent_share)}</dd>
              </div>
            </dl>
            {item.sample_titles?.length > 0 && (
              <ul className="mt-3 list-disc space-y-0.5 pl-4 text-xs text-slate-600">
                {item.sample_titles.slice(0, 3).map((title) => (
                  <li key={title}>{title}</li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}

export function CitationsTab() {
  const { domainOptions, domainName } = useTaxonomy()
  const [domain, setDomain] = useState('')
  const { data, error, loading, reload } = useApi(() => researchApi.citations({ domain }), [domain])
  const byYear = data?.by_year || []
  const byDomain = (data?.by_domain || []).map((row) => ({ ...row, label: row.name || domainName(row.domain) }))
  const distribution = data?.distribution || []

  return (
    <div className="space-y-6">
      <Card padded>
        <Field label="Domain" className="max-w-sm">
          {(id) => <Select id={id} value={domain} onChange={(e) => setDomain(e.target.value)} options={domainOptions} placeholder="All domains" />}
        </Field>
      </Card>
      <div className="grid gap-6 xl:grid-cols-2">
        <ChartFrame
          title="Publications per year"
          subtitle="In the analysed corpus"
          loading={loading}
          error={error}
          onRetry={reload}
          empty={!byYear.length}
          table={{
            columns: [
              { key: 'year', label: 'Year' },
              { key: 'publications', label: 'Publications', align: 'right' },
              { key: 'citations', label: 'Citations', align: 'right', format: (v) => formatNumber(v) },
              { key: 'avg_citations', label: 'Avg citations', align: 'right', format: (v) => formatDecimal(v, 1) },
            ],
            rows: byYear,
          }}
        >
          <BarChartBasic data={byYear} categoryKey="year" bars={[{ key: 'publications', name: 'Publications' }]} height={240} />
        </ChartFrame>
        <ChartFrame title="Average citations per paper" subtitle="By publication year (older papers have had more time to be cited)" loading={loading} empty={!byYear.length} error={error}>
          <TrendLineChart data={byYear} series={[{ key: 'avg_citations', name: 'Avg citations' }]} xKey="year" height={240} valueFormatter={(v) => formatDecimal(v, 1)} />
        </ChartFrame>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <ChartFrame
          title="Citation impact by domain"
          subtitle="Average citations per publication"
          loading={loading}
          empty={!byDomain.length}
          error={error}
          table={{
            columns: [
              { key: 'label', label: 'Domain' },
              { key: 'publications', label: 'Publications', align: 'right' },
              { key: 'citations', label: 'Citations', align: 'right', format: (v) => formatNumber(v) },
              { key: 'avg_citations', label: 'Avg citations', align: 'right', format: (v) => formatDecimal(v, 1) },
            ],
            rows: byDomain,
          }}
        >
          <BarChartBasic data={byDomain} categoryKey="label" bars={[{ key: 'avg_citations', name: 'Avg citations' }]} horizontal showValues valueFormatter={(v) => formatDecimal(v, 1)} categoryWidth={170} maxChars={24} />
        </ChartFrame>
        <ChartFrame
          title="Citation distribution"
          subtitle="Number of publications per citation bucket"
          loading={loading}
          empty={!distribution.length}
          error={error}
          table={{ columns: [{ key: 'bucket', label: 'Citations' }, { key: 'count', label: 'Publications', align: 'right' }], rows: distribution }}
        >
          <BarChartBasic data={distribution} categoryKey="bucket" bars={[{ key: 'count', name: 'Publications' }]} height={240} showValues />
        </ChartFrame>
      </div>
      <Card>
        <CardHeader title="Most cited publications" />
        <div className="px-2 py-2">
          <Table
            rows={data?.top_cited || []}
            empty={loading ? 'Loading…' : 'No publications.'}
            columns={[
              {
                key: 'title',
                header: 'Title',
                className: 'min-w-[18rem]',
                render: (row) => (
                  <div>
                    {row.doi || row.url ? (
                      <a href={row.url || `https://doi.org/${row.doi}`} target="_blank" rel="noreferrer" className="font-medium text-slate-800 hover:text-indigo-700">
                        {row.title}
                      </a>
                    ) : (
                      <span className="font-medium text-slate-800">{row.title}</span>
                    )}
                    <p className="text-xs text-slate-500">{row.venue}</p>
                  </div>
                ),
              },
              { key: 'year', header: 'Year', align: 'right' },
              { key: 'domain', header: 'Domain', render: (row) => domainName(row.domain) },
              { key: 'citation_count', header: 'Citations', align: 'right', render: (row) => formatNumber(row.citation_count) },
            ]}
          />
        </div>
      </Card>
    </div>
  )
}
