import { Link, useParams } from 'react-router-dom'
import { ExternalLink, FlaskConical } from 'lucide-react'
import { Alert, Card, CardHeader, ErrorState, LoadingState, PageHeader, Table } from '../components/ui'
import { PatentRecordBadge, PatentStatusBadge } from '../components/domain/Badges'
import { patentsApi } from '../api/patents'
import { useApi } from '../utils/hooks'
import { useTaxonomy } from '../utils/taxonomy'
import { formatDate, formatNumber } from '../utils/format'

function Detail({ label, children, mono }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className={mono ? 'mt-0.5 font-mono text-sm text-slate-800' : 'mt-0.5 text-sm text-slate-800'}>{children || '—'}</dd>
    </div>
  )
}

export default function PatentDetailPage() {
  const { id } = useParams()
  const { domainName } = useTaxonomy()
  const { data: patent, error, loading, reload } = useApi(() => patentsApi.get(id), [id])

  if (error && !patent) return <ErrorState message={error} onRetry={reload} />
  if (!patent || (loading && String(patent.id) !== String(id))) return <LoadingState />

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Patent landscape', to: '/app/patents' }, { label: patent.patent_number || 'Patent' }]}
        title={patent.title}
        description={patent.assignee}
        actions={
          patent.url ? (
            <a href={patent.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800">
              View source <ExternalLink className="h-4 w-4" />
            </a>
          ) : null
        }
      />
      <div className="mb-6 flex flex-wrap gap-2">
        <PatentStatusBadge status={patent.status} />
        <PatentRecordBadge type={patent.record_type} />
      </div>
      {patent.record_type === 'illustrative' && (
        <Alert variant="warning" icon={FlaskConical} title="Illustrative sample record" className="mb-6">
          This patent, its identifier and its assignee are synthetic demo data. It is not a real patent.
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Abstract" />
          <p className="whitespace-pre-line px-5 py-4 text-sm leading-relaxed text-slate-700">{patent.abstract || 'No abstract available.'}</p>
          {patent.keywords?.length > 0 && (
            <div className="flex flex-wrap gap-1 px-5 pb-5">
              {patent.keywords.map((keyword) => (
                <span key={keyword} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                  {keyword}
                </span>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <CardHeader title="Patent information" />
          <dl className="grid gap-4 px-5 py-4">
            <Detail label="Patent number" mono>
              {patent.patent_number}
            </Detail>
            <Detail label="Assignee">{patent.assignee}</Detail>
            <Detail label="Inventors">{patent.inventors?.join(', ')}</Detail>
            <Detail label="Filing date">{formatDate(patent.filing_date)}</Detail>
            <Detail label="Grant date">{formatDate(patent.grant_date)}</Detail>
            <Detail label="Classification" mono>
              {patent.classification}
            </Detail>
            <Detail label="Technology domain">{domainName(patent.technology_domain)}</Detail>
            <Detail label="Cited by">{formatNumber(patent.citation_count)}</Detail>
            <Detail label="Jurisdiction">{patent.jurisdiction}</Detail>
            <Detail label="Data source">{patent.source}</Detail>
          </dl>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader title="Similar patents" subtitle="Nearest neighbours by TF-IDF cosine similarity of title and abstract" />
        <div className="px-2 py-2">
          <Table
            rows={patent.similar || []}
            empty="No similar patents found."
            columns={[
              {
                key: 'title',
                header: 'Patent',
                render: (row) => (
                  <Link to={`/app/patents/${row.id}`} className="font-medium text-slate-800 hover:text-indigo-700">
                    {row.title}
                  </Link>
                ),
              },
              { key: 'assignee', header: 'Assignee', render: (row) => row.assignee || '—' },
              { key: 'filing_date', header: 'Filed', render: (row) => formatDate(row.filing_date) },
              { key: 'citation_count', header: 'Cited by', align: 'right', render: (row) => formatNumber(row.citation_count) },
            ]}
          />
        </div>
      </Card>
    </div>
  )
}
