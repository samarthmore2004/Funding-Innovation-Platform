import { useState } from 'react'
import { Eye, FileBarChart, FileDown, FileSpreadsheet, FileText, History, RefreshCw } from 'lucide-react'
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  Modal,
  PageHeader,
  Select,
  Table,
  useToast,
} from '../components/ui'
import { reportsApi } from '../api/reports'
import { innovationApi } from '../api/innovation'
import { getErrorMessage } from '../api/client'
import { useApi } from '../utils/hooks'
import { useTaxonomy } from '../utils/taxonomy'
import { formatDateTime, formatNumber, humanize } from '../utils/format'
import { REPORT_FORMAT_LABELS } from '../utils/labels'

const FORMAT_ICONS = { csv: FileText, xlsx: FileSpreadsheet, pdf: FileDown }

function ReportCard({ report, domainOptions, projectOptions, onDownloaded, onPreview }) {
  const toast = useToast()
  const params = report.params || []
  const [domain, setDomain] = useState('')
  const [projectId, setProjectId] = useState('')
  const [busy, setBusy] = useState(null)
  const needsProject = params.includes('project_id')
  const query = { domain: params.includes('domain') ? domain : undefined, project_id: needsProject ? projectId : undefined }

  const download = async (format) => {
    setBusy(format)
    try {
      const filename = await reportsApi.download(report.key, { ...query, format })
      toast.success(`Downloaded ${filename}`)
      onDownloaded?.()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className="flex flex-col">
      <div className="flex-1 px-5 pt-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <FileBarChart className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{report.title}</h3>
            <p className="mt-0.5 text-xs text-slate-500">{report.description}</p>
          </div>
        </div>
        {(params.includes('domain') || needsProject) && (
          <div className="mt-4 grid gap-3">
            {params.includes('domain') && (
              <Field label="Domain (optional)">
                {(id) => <Select id={id} value={domain} onChange={(e) => setDomain(e.target.value)} options={domainOptions} placeholder="All domains" />}
              </Field>
            )}
            {needsProject && (
              <Field label="Project (optional)">
                {(id) => <Select id={id} value={projectId} onChange={(e) => setProjectId(e.target.value)} options={projectOptions} placeholder="All my projects" />}
              </Field>
            )}
          </div>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-3">
        <Button size="sm" variant="ghost" icon={Eye} onClick={() => onPreview(report, query)}>
          Preview
        </Button>
        <span className="ml-auto flex flex-wrap gap-2">
          {(report.formats || ['csv', 'xlsx', 'pdf']).map((format) => (
            <Button key={format} size="sm" variant="secondary" icon={FORMAT_ICONS[format] || FileDown} loading={busy === format} disabled={Boolean(busy)} onClick={() => download(format)}>
              {REPORT_FORMAT_LABELS[format] || format.toUpperCase()}
            </Button>
          ))}
        </span>
      </div>
    </Card>
  )
}

export default function ReportsPage() {
  const { domainOptions } = useTaxonomy()
  const types = useApi(() => reportsApi.types(), [])
  const history = useApi(() => reportsApi.history(), [])
  const projects = useApi(() => innovationApi.projects('mine'), [])
  const [preview, setPreview] = useState(null) // { report, loading, error, data }

  const projectOptions = (projects.data || []).map((p) => ({ value: String(p.id), label: p.title }))

  const openPreview = async (report, query) => {
    setPreview({ report, loading: true, error: null, data: null })
    try {
      const data = await reportsApi.preview(report.key, query)
      setPreview({ report, loading: false, error: null, data })
    } catch (err) {
      setPreview({ report, loading: false, error: getErrorMessage(err), data: null })
    }
  }

  return (
    <div>
      <PageHeader
        icon={FileBarChart}
        title="Reports & export"
        description="Generate funding, patent, research trend, innovation and commercialization reports as CSV, Excel or PDF."
      />
      {types.error && !types.data ? (
        <ErrorState message={types.error} onRetry={types.reload} />
      ) : !types.data ? (
        <LoadingState />
      ) : (
        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {types.data.map((report) => (
            <ReportCard
              key={report.key}
              report={report}
              domainOptions={domainOptions}
              projectOptions={projectOptions}
              onDownloaded={history.reload}
              onPreview={openPreview}
            />
          ))}
        </div>
      )}

      <Card>
        <CardHeader
          title="Report history"
          subtitle="Reports you have generated"
          icon={History}
          actions={
            <Button size="sm" variant="ghost" icon={RefreshCw} onClick={() => history.reload()}>
              Refresh
            </Button>
          }
        />
        <div className="px-2 py-2">
          {history.error && !history.data ? (
            <ErrorState compact message={history.error} onRetry={history.reload} />
          ) : (
            <Table
              rows={history.data || []}
              empty={history.loading ? 'Loading…' : 'No reports generated yet.'}
              columns={[
                { key: 'report_type', header: 'Report', render: (row) => <span className="font-medium text-slate-800">{humanize(row.report_type)}</span> },
                { key: 'format', header: 'Format', render: (row) => REPORT_FORMAT_LABELS[row.format] || row.format },
                { key: 'filename', header: 'File', render: (row) => <span className="font-mono text-xs">{row.filename}</span> },
                { key: 'row_count', header: 'Rows', align: 'right', render: (row) => formatNumber(row.row_count) },
                { key: 'created_at', header: 'Generated', render: (row) => formatDateTime(row.created_at) },
              ]}
            />
          )}
        </div>
      </Card>

      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.data?.title || preview?.report?.title || 'Report preview'} size="xl">
        {preview?.loading ? (
          <LoadingState compact label="Generating preview…" />
        ) : preview?.error ? (
          <ErrorState compact message={preview.error} />
        ) : preview?.data ? (
          <div className="space-y-4">
            {preview.data.generated_at && <p className="text-xs text-slate-500">Generated {formatDateTime(preview.data.generated_at)}</p>}
            {preview.data.summary?.length > 0 && (
              <dl className="grid gap-3 sm:grid-cols-3">
                {preview.data.summary.map((item) => (
                  <div key={item.label} className="rounded-lg bg-slate-50 p-3">
                    <dt className="text-xs text-slate-500">{item.label}</dt>
                    <dd className="text-sm font-semibold text-slate-900">{String(item.value ?? '—')}</dd>
                  </div>
                ))}
              </dl>
            )}
            {preview.data.rows?.length ? (
              <>
                <Table
                  dense
                  className="max-h-[50vh]"
                  rows={preview.data.rows}
                  rowKey={(row, index) => index}
                  columns={(preview.data.columns || []).map((column, index) => ({
                    key: String(index),
                    header: column,
                    render: (row) => {
                      const value = Array.isArray(row) ? row[index] : row?.[column]
                      return value === null || value === undefined || value === '' ? '—' : String(value)
                    },
                  }))}
                />
                <p className="text-xs text-slate-500">
                  Showing {formatNumber(preview.data.rows.length)} of {formatNumber(preview.data.total_rows ?? preview.data.rows.length)} rows. Download the
                  report for the full dataset.
                </p>
              </>
            ) : (
              <EmptyState compact title="This report has no rows for the selected options" />
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
