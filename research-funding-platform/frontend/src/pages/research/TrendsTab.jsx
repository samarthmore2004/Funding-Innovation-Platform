import { useState } from 'react'
import { Globe, Minus, Search, TrendingDown, TrendingUp } from 'lucide-react'
import { Alert, Badge, Button, Card, CardHeader, Field, Input, Select, Table, TagInput } from '../../components/ui'
import DomainTrendChart from '../../components/charts/DomainTrendChart'
import TrendLineChart from '../../components/charts/TrendLineChart'
import { researchApi } from '../../api/research'
import { getErrorMessage } from '../../api/client'
import { useApi } from '../../utils/hooks'
import { useTaxonomy } from '../../utils/taxonomy'
import { formatDateTime, formatNumber, formatPercent } from '../../utils/format'
import { YEAR_OPTIONS } from '../../utils/validation'

const CURRENT_YEAR = new Date().getFullYear()

const TREND_STYLE = {
  rising: { color: 'green', icon: TrendingUp, label: 'Rising' },
  stable: { color: 'slate', icon: Minus, label: 'Stable' },
  declining: { color: 'rose', icon: TrendingDown, label: 'Declining' },
}

export function TrendBadge({ trend }) {
  const style = TREND_STYLE[trend] || TREND_STYLE.stable
  return (
    <Badge color={style.color} icon={style.icon}>
      {style.label}
    </Badge>
  )
}

function LiveTrend() {
  const [query, setQuery] = useState('')
  const [start, setStart] = useState(String(CURRENT_YEAR - 10))
  const [end, setEnd] = useState(String(CURRENT_YEAR - 1))
  const [state, setState] = useState({ loading: false, error: null, data: null })

  const run = async (event) => {
    event.preventDefault()
    if (query.trim().length < 2) {
      setState((prev) => ({ ...prev, error: 'Enter a topic of at least 2 characters.' }))
      return
    }
    if (Number(start) > Number(end)) {
      setState((prev) => ({ ...prev, error: 'Start year must be before end year.' }))
      return
    }
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const data = await researchApi.liveTrend({ query: query.trim(), start_year: start, end_year: end })
      setState({ loading: false, error: null, data })
    } catch (err) {
      setState((prev) => ({ ...prev, loading: false, error: getErrorMessage(err) }))
    }
  }

  const data = state.data
  return (
    <Card>
      <CardHeader
        title="Live topic trend"
        subtitle="Queries OpenAlex for publication counts per year; falls back to the local corpus if the API is unavailable."
        icon={Globe}
      />
      <form onSubmit={run} className="grid gap-3 px-5 pt-4 sm:grid-cols-[1fr_8rem_8rem_auto] sm:items-end">
        <Field label="Topic or phrase">
          {(id) => <Input id={id} icon={Search} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. perovskite solar cells" />}
        </Field>
        <Field label="From">{(id) => <Select id={id} value={start} onChange={(e) => setStart(e.target.value)} options={YEAR_OPTIONS} />}</Field>
        <Field label="To">{(id) => <Select id={id} value={end} onChange={(e) => setEnd(e.target.value)} options={YEAR_OPTIONS} />}</Field>
        <Button type="submit" loading={state.loading}>
          Analyze trend
        </Button>
      </form>
      <div className="px-5 pb-5 pt-4">
        {state.error && <Alert variant="error">{state.error}</Alert>}
        {data && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <Badge color={data.source === 'openalex' ? 'green' : 'amber'}>
                {data.source === 'openalex' ? 'Live: OpenAlex' : 'Fallback: local corpus'}
              </Badge>
              <span>
                “{data.query}” · {formatNumber(data.total)} publications in range
              </span>
              {data.fetched_at && <span>· fetched {formatDateTime(data.fetched_at)}</span>}
            </div>
            {data.note && <p className="text-xs text-slate-500">{data.note}</p>}
            {data.series?.length ? (
              <TrendLineChart data={data.series} series={[{ key: 'count', name: 'Publications' }]} xKey="year" height={260} />
            ) : (
              <p className="py-6 text-center text-sm text-slate-500">No publications found for this topic in the selected years.</p>
            )}
          </div>
        )}
        {!data && !state.error && (
          <p className="py-4 text-center text-sm text-slate-500">Enter any research topic to see how publication volume has evolved.</p>
        )}
      </div>
    </Card>
  )
}

export default function TrendsTab() {
  const { domainOptions, domainName } = useTaxonomy()
  const [selected, setSelected] = useState(null)
  const [requested, setRequested] = useState(null)
  const [start, setStart] = useState(String(CURRENT_YEAR - 10))
  const [end, setEnd] = useState(String(CURRENT_YEAR - 1))

  const { data, error, loading, reload } = useApi(
    () => researchApi.trends({ domains: requested || undefined, start_year: start, end_year: end }),
    [requested ? requested.join(',') : '', start, end],
  )

  const shown = selected ?? (data?.domains || []).map((d) => d.key)
  const domains = (data?.domains || []).map((d) => ({ key: d.key, name: d.name || domainName(d.key) }))

  const onDomains = (next) => {
    setSelected(next)
    setRequested(next.length ? next : null)
  }

  return (
    <div className="space-y-6">
      <Card padded>
        <div className="grid gap-4 md:grid-cols-[1fr_8rem_8rem]">
          <Field label="Domains to compare" hint="Up to 5 domains. Leave empty for your profile domains.">
            {(id) => <TagInput id={id} value={shown} onChange={onDomains} suggestions={domainOptions} allowCustom={false} max={5} placeholder="Add a domain" />}
          </Field>
          <Field label="From">{(id) => <Select id={id} value={start} onChange={(e) => setStart(e.target.value)} options={YEAR_OPTIONS} />}</Field>
          <Field label="To">{(id) => <Select id={id} value={end} onChange={(e) => setEnd(e.target.value)} options={YEAR_OPTIONS} />}</Field>
        </div>
      </Card>

      <DomainTrendChart
        title="Publication trend by domain"
        subtitle={
          data
            ? `Source: ${data.source === 'openalex_snapshot' ? 'OpenAlex snapshot (global counts)' : 'local publication corpus'}${data.retrieved_at ? ` · retrieved ${formatDateTime(data.retrieved_at)}` : ''}`
            : undefined
        }
        domains={domains}
        series={data?.series || []}
        loading={loading}
        error={error}
        onRetry={reload}
      />

      <Card>
        <CardHeader title="Domain growth" subtitle="5-year compound annual growth rate (CAGR) of publication volume up to the last complete year (2-year averaged end points); totals cover the whole snapshot." />
        <div className="px-2 py-2">
          <Table
            rows={data?.growth || []}
            rowKey="domain"
            empty={loading ? 'Loading…' : 'No growth data.'}
            columns={[
              { key: 'name', header: 'Domain', render: (row) => <span className="font-medium text-slate-800">{row.name || domainName(row.domain)}</span> },
              { key: 'cagr', header: 'CAGR', align: 'right', render: (row) => formatPercent(row.cagr, 1, { signed: true }) },
              { key: 'total', header: 'Total publications', align: 'right', render: (row) => formatNumber(row.total) },
              { key: 'recent', header: 'Last 5 years', align: 'right', render: (row) => formatNumber(row.recent) },
              { key: 'trend', header: 'Trend', render: (row) => <TrendBadge trend={row.trend} /> },
            ]}
          />
        </div>
      </Card>

      <LiveTrend />
    </div>
  )
}
