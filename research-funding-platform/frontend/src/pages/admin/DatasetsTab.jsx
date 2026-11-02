import { useRef, useState } from 'react'
import { CloudDownload, Database, FileDown, FileUp, Globe, Upload } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Select,
  Table,
  TagInput,
  useToast,
} from '../../components/ui'
import { adminApi } from '../../api/admin'
import { getErrorMessage } from '../../api/client'
import { useApi } from '../../utils/hooks'
import { useTaxonomy } from '../../utils/taxonomy'
import { formatDateTime, formatNumber, humanize } from '../../utils/format'

const STATUS_COLORS = { completed: 'green', partial: 'amber', failed: 'rose' }

function ImportResult({ result }) {
  if (!result) return null
  const variant = result.status === 'completed' ? 'success' : result.status === 'partial' ? 'warning' : 'error'
  return (
    <Alert variant={variant} title={`Import ${result.status}`} className="mt-3">
      <p>
        {formatNumber(result.rows_imported)} of {formatNumber(result.rows_total)} rows imported
        {result.rows_failed ? `, ${formatNumber(result.rows_failed)} failed` : ''}
        {result.filename ? ` from ${result.filename}` : ''}.
      </p>
      {result.errors?.length > 0 && (
        <ul className="mt-1 max-h-40 list-disc overflow-y-auto pl-4 text-xs">
          {result.errors.slice(0, 20).map((line, index) => (
            <li key={index}>{line}</li>
          ))}
          {result.errors.length > 20 && <li>… and {result.errors.length - 20} more</li>}
        </ul>
      )}
    </Alert>
  )
}

function DatasetCard({ dataset, onImported }) {
  const toast = useToast()
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(null)
  const [result, setResult] = useState(null)

  const upload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!/\.(csv|json)$/i.test(file.name)) {
      toast.error('Please choose a .csv or .json file.')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Files larger than 20 MB are not supported.')
      return
    }
    setBusy('import')
    setResult(null)
    try {
      const res = await adminApi.importDataset(dataset.key, file)
      setResult(res)
      onImported?.()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const template = async () => {
    setBusy('template')
    try {
      await adminApi.downloadTemplate(dataset.key)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className="flex flex-col">
      <div className="flex-1 px-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{dataset.label}</h3>
            <p className="mt-0.5 text-xs text-slate-500">{dataset.description}</p>
          </div>
          <span className="text-2xl font-semibold text-slate-900">{formatNumber(dataset.count)}</span>
        </div>
        {dataset.by_source?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {dataset.by_source.map((s) => (
              <Badge key={s.source} color="slate">
                {humanize(s.source)} · {formatNumber(s.count)}
              </Badge>
            ))}
          </div>
        )}
        {dataset.by_record_type?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {dataset.by_record_type.map((r) => (
              <Badge key={r.value} color={r.value === 'illustrative' ? 'amber' : r.value === 'verified' ? 'green' : 'sky'}>
                {humanize(r.value)} · {formatNumber(r.count)}
              </Badge>
            ))}
          </div>
        )}
        {dataset.last_updated && <p className="mt-2 text-[11px] text-slate-400">Last updated {formatDateTime(dataset.last_updated)}</p>}
        <ImportResult result={result} />
      </div>
      {dataset.importable && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 px-5 py-3">
          <Button size="sm" variant="ghost" icon={FileDown} onClick={template} loading={busy === 'template'}>
            CSV template
          </Button>
          <input ref={inputRef} type="file" accept=".csv,.json,text/csv,application/json" className="hidden" onChange={upload} aria-label={`Import ${dataset.label}`} />
          <Button size="sm" variant="secondary" icon={Upload} className="ml-auto" onClick={() => inputRef.current?.click()} loading={busy === 'import'}>
            Import CSV / JSON
          </Button>
        </div>
      )}
    </Card>
  )
}

function GrantsGovSync({ onDone }) {
  const toast = useToast()
  const [keywords, setKeywords] = useState([])
  const [limit, setLimit] = useState('10')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const run = async (event) => {
    event.preventDefault()
    setBusy(true)
    setResult(null)
    try {
      const res = await adminApi.syncGrantsGov({ keywords: keywords.length ? keywords : undefined, limit_per_keyword: Number(limit) })
      setResult(res)
      onDone?.()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card>
      <CardHeader title="Sync verified funding from Grants.gov" subtitle="Imports open and forecasted US federal opportunities with source links and verification dates." icon={CloudDownload} />
      <form onSubmit={run} className="space-y-4 px-5 py-4">
        <Field label="Keywords" hint="Leave empty to use the platform's technology-area keywords.">
          {(id) => <TagInput id={id} value={keywords} onChange={setKeywords} placeholder="e.g. quantum computing" max={10} />}
        </Field>
        <Field label="Opportunities per keyword" className="max-w-[12rem]">
          {(id) => <Select id={id} value={limit} onChange={(e) => setLimit(e.target.value)} options={['5', '10', '20', '25'].map((v) => ({ value: v, label: v }))} />}
        </Field>
        <div className="flex justify-end">
          <Button type="submit" icon={Globe} loading={busy}>
            Run Grants.gov sync
          </Button>
        </div>
        <ImportResult result={result} />
      </form>
    </Card>
  )
}

function OpenAlexSync({ onDone }) {
  const toast = useToast()
  const { domainOptions } = useTaxonomy()
  const [query, setQuery] = useState('')
  const [domain, setDomain] = useState('')
  const [limit, setLimit] = useState('25')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const run = async (event) => {
    event.preventDefault()
    if (query.trim().length < 2) {
      toast.error('Enter a search query.')
      return
    }
    if (!domain) {
      toast.error('Choose the domain to tag imported publications with.')
      return
    }
    setBusy(true)
    setResult(null)
    try {
      const res = await adminApi.syncOpenAlex({ query: query.trim(), domain, limit: Number(limit) })
      setResult(res)
      onDone?.()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card>
      <CardHeader title="Import publications from OpenAlex" subtitle="Adds highly cited works matching a query to the research corpus." icon={Database} />
      <form onSubmit={run} className="space-y-4 px-5 py-4">
        <Field label="Search query">{(id) => <Input id={id} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. graph neural networks" />}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tag with domain">{(id) => <Select id={id} value={domain} onChange={(e) => setDomain(e.target.value)} options={domainOptions} placeholder="Select a domain" />}</Field>
          <Field label="Maximum works">{(id) => <Select id={id} value={limit} onChange={(e) => setLimit(e.target.value)} options={['10', '25', '50'].map((v) => ({ value: v, label: v }))} />}</Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" icon={FileUp} loading={busy}>
            Import from OpenAlex
          </Button>
        </div>
        <ImportResult result={result} />
      </form>
    </Card>
  )
}

export default function DatasetsTab() {
  const { data, error, loading, reload } = useApi(() => adminApi.datasets(), [])
  if (error && !data) return <ErrorState message={error} onRetry={reload} />
  if (!data) return <LoadingState />
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(data.datasets || []).map((dataset) => (
          <DatasetCard key={dataset.key} dataset={dataset} onImported={reload} />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <GrantsGovSync onDone={reload} />
        <OpenAlexSync onDone={reload} />
      </div>
      <Card>
        <CardHeader title="Import history" />
        <div className="px-2 py-2">
          <Table
            rows={data.imports || []}
            empty="No imports yet."
            columns={[
              { key: 'created_at', header: 'When', render: (row) => formatDateTime(row.created_at) },
              { key: 'dataset', header: 'Dataset', render: (row) => humanize(row.dataset) },
              { key: 'source', header: 'Source', render: (row) => row.filename || humanize(row.source) },
              { key: 'status', header: 'Status', render: (row) => <Badge color={STATUS_COLORS[row.status] || 'slate'}>{humanize(row.status)}</Badge> },
              { key: 'rows', header: 'Imported / total', align: 'right', render: (row) => `${formatNumber(row.rows_imported)} / ${formatNumber(row.rows_total)}` },
              { key: 'user_email', header: 'By', render: (row) => row.user_email || '—' },
            ]}
          />
        </div>
      </Card>
    </div>
  )
}
