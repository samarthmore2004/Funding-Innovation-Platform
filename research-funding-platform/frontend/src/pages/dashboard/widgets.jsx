import { Link } from 'react-router-dom'
import { ArrowRight, CalendarClock } from 'lucide-react'
import { Card, CardHeader } from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import ProgressBar from '../../components/ui/ProgressBar'
import Table from '../../components/ui/Table'
import ChartFrame from '../../components/charts/ChartFrame'
import BarChartBasic from '../../components/charts/BarChartBasic'
import TrendLineChart from '../../components/charts/TrendLineChart'
import DomainTrendChart from '../../components/charts/DomainTrendChart'
import { BandBadge, FundingRecordBadge, MaturityBadge, PatentRecordBadge } from '../../components/domain/Badges'
import { DeadlineText } from '../../components/domain/FundingCard'
import { compactNumber, formatDate, formatNumber, formatPercent, formatScore } from '../../utils/format'
import { PATHWAY_LABELS, STAGE_LABELS, labelFor } from '../../utils/labels'
import { useTaxonomy } from '../../utils/taxonomy'

export function SectionCard({ title, subtitle, to, linkLabel = 'View all', icon, children, className, bodyClassName = 'px-5 py-4' }) {
  return (
    <Card className={className}>
      <CardHeader
        title={title}
        subtitle={subtitle}
        icon={icon}
        actions={
          to ? (
            <Link to={to} className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800">
              {linkLabel} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : null
        }
      />
      <div className={bodyClassName}>{children}</div>
    </Card>
  )
}

export function UpcomingDeadlines({ items = [] }) {
  return (
    <SectionCard title="Upcoming deadlines" subtitle="Tracked and recommended opportunities" to="/app/funding?tab=tracked" icon={CalendarClock}>
      {items.length === 0 ? (
        <EmptyState compact title="No upcoming deadlines" description="Track opportunities to see their deadlines here." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.slice(0, 6).map((funding) => (
            <li key={funding.id} className="py-2.5">
              <Link to={`/app/funding/${funding.id}`} className="text-sm font-medium text-slate-800 hover:text-indigo-700">
                {funding.title}
              </Link>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <DeadlineText funding={funding} />
                <FundingRecordBadge type={funding.record_type} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

export function ResearchTrendsWidget({ trends }) {
  const domains = trends?.domains || []
  const series = trends?.series || []
  return (
    <DomainTrendChart
      title="Research trends in your domains"
      subtitle={trends?.source === 'openalex_snapshot' ? 'Publications per year · OpenAlex snapshot' : 'Publications per year'}
      domains={domains}
      series={series}
      height={260}
      footer={
        <Link to="/app/research" className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800">
          Explore research intelligence <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      }
    />
  )
}

export function PublicationAnalyticsWidget({ analytics }) {
  const byYear = analytics?.by_year || []
  return (
    <ChartFrame
      title="Your publication analytics"
      subtitle={`${formatNumber(analytics?.total_publications ?? 0)} publications · ${formatNumber(analytics?.total_citations ?? 0)} citations · h-index ${analytics?.h_index ?? 0}`}
      empty={!byYear.length}
      emptyTitle="No publications in your profile yet"
      emptyDescription="Add publications on your research profile to see analytics."
      table={{
        columns: [
          { key: 'year', label: 'Year' },
          { key: 'publications', label: 'Publications', align: 'right' },
          { key: 'citations', label: 'Citations', align: 'right' },
        ],
        rows: byYear,
      }}
      footer={
        <Link to="/app/profile" className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800">
          Manage publications <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      }
    >
      <BarChartBasic data={byYear} categoryKey="year" bars={[{ key: 'publications', name: 'Publications' }]} height={220} showValues />
    </ChartFrame>
  )
}

export function AssigneeBars({ items = [], title = 'Top patent assignees', subtitle, to = '/app/patents' }) {
  const rows = items.slice(0, 8).map((item) => ({ ...item, label: item.assignee }))
  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      empty={!rows.length}
      emptyTitle="No patent data for your technology areas"
      table={{
        columns: [
          { key: 'assignee', label: 'Assignee' },
          { key: 'patents', label: 'Patents', align: 'right' },
          { key: 'citations', label: 'Citations', align: 'right', format: (v) => formatNumber(v) },
        ],
        rows,
      }}
      footer={
        to ? (
          <Link to={to} className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800">
            Open patent landscape <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : null
      }
    >
      <BarChartBasic data={rows} categoryKey="label" bars={[{ key: 'patents', name: 'Patents' }]} horizontal showValues />
    </ChartFrame>
  )
}

export function RecentPatents({ items = [], title = 'Recent patents in your areas' }) {
  const { domainName } = useTaxonomy()
  return (
    <SectionCard title={title} to="/app/patents">
      {items.length === 0 ? (
        <EmptyState compact title="No recent patents" />
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.slice(0, 5).map((patent) => (
            <li key={patent.id} className="py-2.5">
              <Link to={`/app/patents/${patent.id}`} className="text-sm font-medium text-slate-800 hover:text-indigo-700">
                {patent.title}
              </Link>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>{patent.assignee || 'Unknown assignee'}</span>
                <span>·</span>
                <span>{formatDate(patent.filing_date)}</span>
                <span>·</span>
                <span>{domainName(patent.technology_domain)}</span>
                <PatentRecordBadge type={patent.record_type} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

export function ProjectsWidget({ projects = [], avgScore }) {
  const { domainName } = useTaxonomy()
  return (
    <SectionCard
      title="Innovation scores"
      subtitle={avgScore !== undefined && avgScore !== null ? `Average score ${formatScore(avgScore)}` : 'Your innovation projects'}
      to="/app/innovation"
    >
      {projects.length === 0 ? (
        <EmptyState
          compact
          title="No innovation projects yet"
          description="Create a project to get an explainable innovation score."
          action={
            <Link to="/app/innovation?new=1" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
              Create a project
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {projects.slice(0, 5).map((project) => (
            <li key={project.id}>
              <div className="flex items-start justify-between gap-2">
                <Link to={`/app/innovation/${project.id}`} className="text-sm font-medium text-slate-800 hover:text-indigo-700">
                  {project.title}
                </Link>
                <BandBadge band={project.latest_score?.band} />
              </div>
              <p className="text-xs text-slate-500">
                {domainName(project.domain)} · {labelFor(STAGE_LABELS, project.stage)} · TRL {project.trl}
              </p>
              <ProgressBar
                value={project.latest_score?.overall}
                showValue
                label={project.latest_score ? 'Innovation score' : 'Not scored yet'}
                size="sm"
                className="mt-1.5"
              />
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

export function TechTrendsTable({ items = [], title = 'Technology trend monitoring' }) {
  return (
    <SectionCard title={title} to="/app/technology" bodyClassName="px-2 py-2">
      <Table
        dense
        rows={items}
        rowKey="key"
        empty="No technology areas available."
        columns={[
          {
            key: 'name',
            header: 'Technology area',
            render: (row) => (
              <Link to={`/app/technology/${row.key}`} className="font-medium text-slate-800 hover:text-indigo-700">
                {row.name}
              </Link>
            ),
          },
          { key: 'maturity_stage', header: 'Stage', render: (row) => <MaturityBadge stage={row.maturity_stage} /> },
          { key: 'publication_cagr', header: 'Research growth', align: 'right', render: (row) => formatPercent(row.publication_cagr, 1, { signed: true }) },
          {
            key: 'emerging_score',
            header: 'Emerging score',
            className: 'min-w-[8rem]',
            render: (row) => <ProgressBar value={row.emerging_score} size="sm" />,
          },
        ]}
      />
    </SectionCard>
  )
}

export function OpportunityList({ items = [] }) {
  return (
    <SectionCard title="Technology opportunities" subtitle="Strong research momentum with room in the patent landscape" to="/app/technology?tab=opportunities">
      {items.length === 0 ? (
        <EmptyState compact title="No opportunities identified" />
      ) : (
        <ul className="space-y-4">
          {items.slice(0, 5).map((item) => (
            <li key={item.key}>
              <div className="flex items-baseline justify-between gap-2">
                <Link to={`/app/technology/${item.key}`} className="text-sm font-medium text-slate-800 hover:text-indigo-700">
                  {item.name}
                </Link>
              </div>
              <ProgressBar value={item.opportunity_score} label="Opportunity score" size="sm" className="mt-1" />
              {item.rationale?.[0] && <p className="mt-1 text-xs text-slate-500">{item.rationale[0]}</p>}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

export function CommercializationTable({ items = [] }) {
  return (
    <SectionCard title="Commercialization insights" to="/app/commercialization" bodyClassName="px-2 py-2">
      <Table
        dense
        rows={items}
        rowKey="project_id"
        empty="Create and score an innovation project to see commercialization pathways."
        columns={[
          {
            key: 'title',
            header: 'Project',
            render: (row) => (
              <Link to={`/app/commercialization?project=${row.project_id}`} className="font-medium text-slate-800 hover:text-indigo-700">
                {row.title}
              </Link>
            ),
          },
          { key: 'overall', header: 'Score', align: 'right', render: (row) => formatScore(row.overall) },
          {
            key: 'top_pathway',
            header: 'Best pathway',
            render: (row) => row.top_pathway_title || labelFor(PATHWAY_LABELS, row.top_pathway),
          },
          { key: 'fit_score', header: 'Fit', align: 'right', render: (row) => formatScore(row.fit_score, 0) },
        ]}
      />
    </SectionCard>
  )
}

export function CountBarChart({ title, subtitle, rows = [], categoryKey = 'label', valueKey = 'count', valueName = 'Count', horizontal = false, height, categoryFormatter, footer }) {
  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      empty={!rows.length}
      table={{
        columns: [
          { key: categoryKey, label: 'Category', format: (v) => (categoryFormatter ? categoryFormatter(v) : v) },
          { key: valueKey, label: valueName, align: 'right', format: (v) => formatNumber(v, 1) },
        ],
        rows,
      }}
      footer={footer}
    >
      <BarChartBasic
        data={rows}
        categoryKey={categoryKey}
        bars={[{ key: valueKey, name: valueName }]}
        horizontal={horizontal}
        height={height}
        categoryFormatter={categoryFormatter}
        showValues
      />
    </ChartFrame>
  )
}

export function DailyLineChart({ title, subtitle, rows = [], valueKey = 'count', valueName = 'Count', xKey = 'date' }) {
  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      empty={!rows.length}
      table={{
        columns: [
          { key: xKey, label: 'Date', format: (v) => formatDate(v) },
          { key: valueKey, label: valueName, align: 'right', format: (v) => formatNumber(v, 1) },
        ],
        rows,
      }}
    >
      <TrendLineChart
        data={rows}
        series={[{ key: valueKey, name: valueName }]}
        xKey={xKey}
        height={220}
        xFormatter={(value) => formatDate(value, { day: 'numeric', month: 'short' })}
      />
    </ChartFrame>
  )
}

export const kpiValue = (value) => {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'number') {
    if (Math.abs(value) >= 10000) return compactNumber(value)
    return Number.isInteger(value) ? formatNumber(value) : formatNumber(value, 1)
  }
  return String(value)
}
