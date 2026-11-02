import { Info, MousePointerClick, Sparkles, Target, ThumbsDown, Users } from 'lucide-react'
import { Card, CardHeader, ErrorState, LoadingState, StatCard, Table } from '../../components/ui'
import ChartFrame from '../../components/charts/ChartFrame'
import TrendLineChart from '../../components/charts/TrendLineChart'
import { DailyLineChart } from '../dashboard/widgets'
import { adminApi } from '../../api/admin'
import { useApi } from '../../utils/hooks'
import { formatDate, formatDateTime, formatDecimal, formatNumber, formatRatio, formatScore } from '../../utils/format'

export default function RecommendationTab() {
  const { data, error, loading, reload } = useApi(() => adminApi.recommendationMonitoring(), [])
  if (error && !data) return <ErrorState message={error} onRetry={reload} />
  if (!data) return <LoadingState />
  const evaluation = data.evaluation || {}
  const feedback = data.feedback || {}
  const byDay = data.by_day || []
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Recommendations served" value={formatNumber(data.served_total)} icon={Sparkles} tone="indigo" />
        <StatCard label="Users reached" value={formatNumber(data.unique_users)} icon={Users} tone="violet" />
        <StatCard label="Average match score" value={formatScore(data.avg_match_score)} icon={Target} tone="sky" />
        <StatCard
          label="Engagement rate"
          value={formatRatio(data.engagement_rate, 1)}
          hint={`${formatNumber(feedback.clicked ?? 0)} clicked · ${formatNumber(feedback.saved ?? 0)} saved · ${formatNumber(feedback.dismissed ?? 0)} dismissed`}
          icon={MousePointerClick}
          tone="green"
        />
      </div>

      <Card>
        <CardHeader title="Offline evaluation" subtitle="Quality metrics computed against labelled evaluation personas" icon={Target} />
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-slate-500">Precision@{evaluation.k ?? 'k'}</p>
            <p className="text-2xl font-semibold text-slate-900">{formatDecimal(evaluation.precision_at_k, 3)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Recall@{evaluation.k ?? 'k'}</p>
            <p className="text-2xl font-semibold text-slate-900">{formatDecimal(evaluation.recall_at_k, 3)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Eligibility matching accuracy</p>
            <p className="text-2xl font-semibold text-slate-900">{formatRatio(evaluation.eligibility_accuracy, 1)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Personas evaluated</p>
            <p className="text-2xl font-semibold text-slate-900">{formatNumber(evaluation.personas)}</p>
          </div>
          {evaluation.method && (
            <p className="flex gap-1.5 text-xs text-slate-500 sm:col-span-2 lg:col-span-4">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {evaluation.method}
            </p>
          )}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <DailyLineChart title="Recommendations served per day" rows={byDay} valueName="Recommendations" />
        <ChartFrame
          title="Average match score per day"
          empty={!byDay.length}
          table={{
            columns: [
              { key: 'date', label: 'Date', format: (v) => formatDate(v) },
              { key: 'avg_score', label: 'Avg score', align: 'right', format: (v) => formatScore(v) },
            ],
            rows: byDay,
          }}
        >
          <TrendLineChart
            data={byDay}
            series={[{ key: 'avg_score', name: 'Average match score' }]}
            xKey="date"
            xFormatter={(v) => formatDate(v, { day: 'numeric', month: 'short' })}
            valueFormatter={(v) => formatScore(v)}
            height={220}
          />
        </ChartFrame>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Most recommended opportunities" />
          <div className="px-2 py-2">
            <Table
              dense
              rows={data.top_recommended || []}
              rowKey="funding_id"
              empty="No data yet."
              columns={[
                { key: 'title', header: 'Opportunity' },
                { key: 'count', header: 'Times shown', align: 'right', render: (row) => formatNumber(row.count) },
              ]}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Recent recommendations" icon={ThumbsDown} />
          <div className="px-2 py-2">
            <Table
              dense
              rows={data.recent || []}
              rowKey={(row, index) => index}
              empty="No recommendations served yet."
              columns={[
                { key: 'user_email', header: 'User' },
                { key: 'funding_title', header: 'Opportunity' },
                { key: 'match_score', header: 'Match', align: 'right', render: (row) => formatScore(row.match_score) },
                { key: 'created_at', header: 'When', render: (row) => formatDateTime(row.created_at) },
              ]}
            />
          </div>
        </Card>
      </div>
    </div>
  )
}
