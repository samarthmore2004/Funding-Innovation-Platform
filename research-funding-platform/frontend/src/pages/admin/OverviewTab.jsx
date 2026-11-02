import { Bell, BookOpen, CircleDollarSign, FileBarChart, FileText, FolderKanban, Sparkles, UserCheck, Users } from 'lucide-react'
import { ErrorState, LoadingState, StatCard } from '../../components/ui'
import { CountBarChart, DailyLineChart } from '../dashboard/widgets'
import { adminApi } from '../../api/admin'
import { useApi } from '../../utils/hooks'
import { compactNumber, formatNumber, humanize } from '../../utils/format'
import { ROLE_LABELS, labelFor } from '../../utils/labels'

export default function OverviewTab() {
  const { data, error, loading, reload } = useApi(() => adminApi.analytics(), [])
  if (error && !data) return <ErrorState message={error} onRetry={reload} />
  if (!data) return <LoadingState />
  const roles = (data.users_by_role || []).map((row) => ({ ...row, label: labelFor(ROLE_LABELS, row.role) }))
  const reports = (data.reports_by_type || []).map((row) => ({ ...row, label: humanize(row.type) }))
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Registered users" value={formatNumber(data.users_total)} icon={Users} tone="indigo" />
        <StatCard label="Active users" value={formatNumber(data.active_users)} icon={UserCheck} tone="green" />
        <StatCard label="Innovation projects" value={formatNumber(data.projects_total)} icon={FolderKanban} tone="violet" />
        <StatCard label="Recommendations served" value={compactNumber(data.recommendations_served)} icon={Sparkles} tone="sky" />
        <StatCard label="Funding opportunities" value={formatNumber(data.funding_total)} icon={CircleDollarSign} tone="amber" />
        <StatCard label="Publications" value={compactNumber(data.publications_total)} icon={BookOpen} tone="indigo" />
        <StatCard label="Patents" value={compactNumber(data.patents_total)} icon={FileText} tone="violet" />
        <StatCard label="Reports generated" value={formatNumber(data.reports_generated)} hint={`${formatNumber(data.notifications_total)} notifications sent`} icon={FileBarChart} tone="rose" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <DailyLineChart title="Registrations" subtitle="New accounts per day" rows={data.registrations_by_day || []} valueName="Registrations" />
        <DailyLineChart title="Sign-ins" subtitle="Successful logins per day" rows={data.logins_by_day || []} valueName="Logins" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <CountBarChart title="Users by role" rows={roles} valueName="Users" horizontal />
        <CountBarChart title="Reports by type" rows={reports} valueName="Reports" horizontal />
      </div>
      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <Bell className="h-3.5 w-3.5" aria-hidden="true" /> {formatNumber(data.notifications_total)} notifications have been generated in total.
      </p>
    </div>
  )
}
