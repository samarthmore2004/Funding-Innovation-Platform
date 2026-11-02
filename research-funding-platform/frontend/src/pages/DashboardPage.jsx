import { useState } from 'react'
import {
  Activity,
  Bell,
  BookOpen,
  CalendarClock,
  CircleDollarSign,
  FileText,
  FolderKanban,
  Gauge,
  LayoutDashboard,
  Quote,
  RefreshCw,
  Sparkles,
  Users,
} from 'lucide-react'
import { dashboardApi } from '../api/dashboard'
import { useAuth } from '../auth/AuthContext'
import { useApi } from '../utils/hooks'
import { firstName } from '../utils/format'
import { Button, ErrorState, LoadingState, PageHeader, SegmentedControl, StatCard } from '../components/ui'
import { kpiValue } from './dashboard/widgets'
import { AdminView, ManagerView, ResearcherView, StartupView } from './dashboard/RoleViews'

const VIEW_LABELS = { researcher: 'Researcher', startup: 'Startup', manager: 'Innovation manager', admin: 'Admin' }
const VIEW_DESCRIPTIONS = {
  researcher: 'Funding recommendations, research trends, publication analytics, patent insights and your innovation scores.',
  startup: 'Funding opportunities, technology opportunities, patent intelligence and commercialization insights.',
  manager: 'Portfolio analytics, innovation pipeline, technology trend monitoring and funding analytics.',
  admin: 'Users, platform analytics, recommendation monitoring and system health.',
}
const TONES = ['indigo', 'violet', 'sky', 'green', 'amber', 'rose']

function iconFor(key = '') {
  const k = key.toLowerCase()
  if (k.includes('deadline')) return CalendarClock
  if (k.includes('recommend') || k.includes('match')) return Sparkles
  if (k.includes('fund') || k.includes('grant')) return CircleDollarSign
  if (k.includes('citation')) return Quote
  if (k.includes('publication') || k.includes('paper')) return BookOpen
  if (k.includes('patent')) return FileText
  if (k.includes('score')) return Gauge
  if (k.includes('project') || k.includes('portfolio')) return FolderKanban
  if (k.includes('user')) return Users
  if (k.includes('notification') || k.includes('alert')) return Bell
  return Activity
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [view, setView] = useState('')
  const { data, error, loading, reload } = useApi(() => dashboardApi.get(view || undefined), [view])

  const previewOptions =
    user?.role === 'admin'
      ? ['researcher', 'startup', 'manager', 'admin']
      : user?.role === 'innovation_manager'
        ? ['researcher', 'startup', 'manager']
        : []
  const activeView = data?.view || view
  const kpis = data?.kpis || []

  return (
    <div>
      <PageHeader
        icon={LayoutDashboard}
        title={`Welcome back${user?.full_name ? `, ${firstName(user.full_name)}` : ''}`}
        description={VIEW_DESCRIPTIONS[activeView] || 'Your innovation intelligence overview.'}
        actions={
          <>
            {previewOptions.length > 0 && (
              <SegmentedControl
                ariaLabel="Dashboard view"
                value={activeView}
                onChange={(next) => setView(next)}
                options={previewOptions.map((value) => ({ value, label: VIEW_LABELS[value] }))}
              />
            )}
            <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => reload()} loading={loading && Boolean(data)}>
              Refresh
            </Button>
          </>
        }
      />

      {error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <LoadingState label="Building your dashboard…" />
      ) : (
        <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          {kpis.length > 0 && (
            <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {kpis.map((kpi, index) => (
                <StatCard
                  key={kpi.key || kpi.label}
                  label={kpi.label}
                  value={kpiValue(kpi.value)}
                  hint={kpi.hint}
                  icon={iconFor(kpi.key || kpi.label)}
                  tone={TONES[index % TONES.length]}
                />
              ))}
            </div>
          )}
          {data.view === 'startup' ? (
            <StartupView data={data} />
          ) : data.view === 'manager' ? (
            <ManagerView data={data} />
          ) : data.view === 'admin' ? (
            <AdminView data={data} />
          ) : (
            <ResearcherView data={data} />
          )}
        </div>
      )}
    </div>
  )
}
