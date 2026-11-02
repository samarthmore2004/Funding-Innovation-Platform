import { Link } from 'react-router-dom'
import { Activity, ArrowRight, Database, Server, Sparkles } from 'lucide-react'
import RecommendationCard from '../../components/domain/RecommendationCard'
import EmptyState from '../../components/ui/EmptyState'
import Badge from '../../components/ui/Badge'
import StatCard from '../../components/ui/StatCard'
import Table from '../../components/ui/Table'
import {
  AssigneeBars,
  CommercializationTable,
  CountBarChart,
  DailyLineChart,
  OpportunityList,
  ProjectsWidget,
  PublicationAnalyticsWidget,
  RecentPatents,
  ResearchTrendsWidget,
  SectionCard,
  TechTrendsTable,
  UpcomingDeadlines,
} from './widgets'
import { formatDateTime, formatDecimal, formatNumber, formatRatio, formatScore, timeAgo } from '../../utils/format'
import { FUNDER_TYPE_LABELS, FUNDING_RECORD_LABELS, FUNDING_STATUS_LABELS, ROLE_LABELS, STAGE_LABELS, labelFor } from '../../utils/labels'
import { useTaxonomy } from '../../utils/taxonomy'

function RecommendationsSection({ items = [], title = 'Top funding recommendations', columns = 1 }) {
  return (
    <SectionCard title={title} subtitle="Ranked by text similarity and eligibility" to="/app/recommendations" icon={Sparkles}>
      {items.length === 0 ? (
        <EmptyState
          compact
          title="No recommendations yet"
          description="Add research domains and keywords to your profile to receive matches."
          action={
            <Link to="/app/profile" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
              Complete your profile
            </Link>
          }
        />
      ) : (
        <div className={columns === 2 ? 'grid gap-3 xl:grid-cols-2' : 'space-y-3'}>
          {items.map((rec, index) => (
            <RecommendationCard key={rec.funding?.id ?? index} rec={rec} rank={index + 1} compact />
          ))}
        </div>
      )}
    </SectionCard>
  )
}

export function ResearcherView({ data }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RecommendationsSection items={data.recommendations || []} />
        </div>
        <UpcomingDeadlines items={data.upcoming_deadlines || []} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <ResearchTrendsWidget trends={data.research_trends} />
        <PublicationAnalyticsWidget analytics={data.publication_analytics} />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <AssigneeBars items={data.patent_insights?.top_assignees || []} subtitle="Patent insights for your technology areas" />
        <RecentPatents items={data.patent_insights?.recent_patents || []} />
        <ProjectsWidget projects={data.innovation?.projects || []} avgScore={data.innovation?.avg_score} />
      </div>
    </div>
  )
}

export function StartupView({ data }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RecommendationsSection items={data.funding_opportunities || []} title="Funding opportunities for your startup" columns={2} />
        </div>
        <UpcomingDeadlines items={data.upcoming_deadlines || []} />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <OpportunityList items={data.technology_opportunities || []} />
        <AssigneeBars
          items={data.patent_intelligence?.competitors || []}
          title="Patent intelligence: active competitors"
          subtitle="Most active assignees in your technology areas"
        />
        <RecentPatents items={data.patent_intelligence?.recent_patents || []} title="Recent competitor patents" />
      </div>
      <CommercializationTable items={data.commercialization || []} />
    </div>
  )
}

export function ManagerView({ data }) {
  const { domainName } = useTaxonomy()
  const portfolio = data.portfolio || {}
  const funding = data.funding_analytics || {}
  const stageRows = (portfolio.by_stage || []).map((row) => ({ ...row, label: labelFor(STAGE_LABELS, row.stage) }))
  const domainRows = (portfolio.by_domain || []).map((row) => ({ ...row, label: row.name || domainName(row.domain) }))
  const funderRows = (funding.by_funder_type || []).map((row) => ({ ...row, label: row.label || labelFor(FUNDER_TYPE_LABELS, row.type) }))
  const recordRows = (funding.by_record_type || []).map((row) => ({ ...row, label: labelFor(FUNDING_RECORD_LABELS, row.value) }))
  const statusRows = (funding.by_status || []).map((row) => ({ ...row, label: labelFor(FUNDING_STATUS_LABELS, row.value) }))

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Projects in portfolio" value={formatNumber(portfolio.projects_count ?? 0)} icon={Database} tone="indigo" />
        <StatCard label="Projects scored" value={formatNumber(portfolio.scored_count ?? 0)} icon={Activity} tone="violet" />
        <StatCard label="Average innovation score" value={formatScore(portfolio.avg_score)} icon={Sparkles} tone="sky" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <CountBarChart
          title="Innovation pipeline"
          subtitle="Projects by development stage"
          rows={stageRows}
          valueName="Projects"
          footer={
            <Link to="/app/portfolio" className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800">
              Open pipeline board <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        <CountBarChart title="Portfolio analytics" subtitle="Projects by technology domain" rows={domainRows} valueName="Projects" horizontal />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <TechTrendsTable items={data.technology_trends || []} />
        <CountBarChart
          title="Funding analytics: deadlines ahead"
          subtitle="Open opportunities closing per month"
          rows={(funding.deadlines_by_month || []).map((row) => ({ ...row, label: row.month }))}
          valueName="Deadlines"
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <CountBarChart title="Opportunities by funder type" rows={funderRows} valueName="Opportunities" horizontal />
        <CountBarChart title="Opportunities by status" rows={statusRows} valueName="Opportunities" horizontal />
        <CountBarChart title="Opportunities by data source" rows={recordRows} valueName="Opportunities" horizontal />
      </div>
    </div>
  )
}

export function AdminView({ data }) {
  const platform = data.platform || {}
  const monitoring = data.recommendation_monitoring || {}
  const system = data.system || {}
  const metrics = system.metrics || {}
  const roleRows = (platform.users_by_role || []).map((row) => ({ ...row, label: labelFor(ROLE_LABELS, row.role) }))
  const evaluation = monitoring.evaluation || {}

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-3">
        <CountBarChart title="Users by role" rows={roleRows} valueName="Users" horizontal />
        <DailyLineChart title="Registrations" subtitle="New accounts per day" rows={platform.registrations_by_day || []} valueName="Registrations" />
        <DailyLineChart title="Sign-ins" subtitle="Successful logins per day" rows={platform.logins_by_day || []} valueName="Logins" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Recommendation monitoring" to="/app/admin?tab=recommendations" icon={Sparkles}>
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-slate-500">Recommendations served</dt>
              <dd className="text-lg font-semibold text-slate-900">{formatNumber(monitoring.served_total ?? 0)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Average match score</dt>
              <dd className="text-lg font-semibold text-slate-900">{formatScore(monitoring.avg_match_score)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Engagement rate</dt>
              <dd className="text-lg font-semibold text-slate-900">{formatRatio(monitoring.engagement_rate, 1)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Precision@{evaluation.k ?? 'k'}</dt>
              <dd className="text-lg font-semibold text-slate-900">{formatDecimal(evaluation.precision_at_k, 2)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Recall@{evaluation.k ?? 'k'}</dt>
              <dd className="text-lg font-semibold text-slate-900">{formatDecimal(evaluation.recall_at_k, 2)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Eligibility accuracy</dt>
              <dd className="text-lg font-semibold text-slate-900">{formatRatio(evaluation.eligibility_accuracy, 1)}</dd>
            </div>
          </dl>
        </SectionCard>
        <SectionCard title="System health" to="/app/admin?tab=system" icon={Server}>
          <div className="flex flex-wrap gap-2">
            <Badge color={system.database?.ok ? 'green' : 'rose'}>
              Database {system.database?.dialect || ''}: {system.database?.ok ? 'OK' : 'Unavailable'}
            </Badge>
            {system.version && <Badge color="slate">Version {system.version}</Badge>}
            {system.environment && <Badge color="slate">{system.environment}</Badge>}
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-slate-500">Requests</dt>
              <dd className="text-lg font-semibold text-slate-900">{formatNumber(metrics.requests_total ?? 0)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Errors</dt>
              <dd className="text-lg font-semibold text-slate-900">{formatNumber(metrics.errors_total ?? 0)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Avg latency</dt>
              <dd className="text-lg font-semibold text-slate-900">{formatDecimal(metrics.avg_latency_ms, 1)} ms</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">p95 latency</dt>
              <dd className="text-lg font-semibold text-slate-900">{formatDecimal(metrics.p95_latency_ms, 1)} ms</dd>
            </div>
          </dl>
          {(system.jobs || []).length > 0 && (
            <Table
              dense
              className="mt-4"
              rows={system.jobs}
              rowKey="name"
              columns={[
                { key: 'name', header: 'Job' },
                { key: 'last_status', header: 'Last status', render: (row) => row.last_status || 'never run' },
                { key: 'last_run_at', header: 'Last run', render: (row) => (row.last_run_at ? timeAgo(row.last_run_at) : '—') },
              ]}
            />
          )}
        </SectionCard>
      </div>
      <SectionCard title="Most recent recommendations" to="/app/admin?tab=recommendations" bodyClassName="px-2 py-2">
        <Table
          dense
          rows={(monitoring.recent || []).slice(0, 8)}
          rowKey={(row, index) => index}
          empty="No recommendations have been served yet."
          columns={[
            { key: 'user_email', header: 'User' },
            { key: 'funding_title', header: 'Opportunity' },
            { key: 'match_score', header: 'Match', align: 'right', render: (row) => formatScore(row.match_score) },
            { key: 'created_at', header: 'When', render: (row) => formatDateTime(row.created_at) },
          ]}
        />
      </SectionCard>
    </div>
  )
}
