import { useSearchParams } from 'react-router-dom'
import { Database, LayoutDashboard, Megaphone, ScrollText, Server, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { PageHeader, Tabs } from '../components/ui'
import OverviewTab from './admin/OverviewTab'
import UsersTab from './admin/UsersTab'
import RecommendationTab from './admin/RecommendationTab'
import DatasetsTab from './admin/DatasetsTab'
import { AuditTab, BroadcastTab, SystemTab } from './admin/SystemTabs'

const TABS = [
  { key: 'overview', label: 'Platform analytics', icon: LayoutDashboard },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'recommendations', label: 'Recommendation monitoring', icon: Sparkles },
  { key: 'datasets', label: 'Datasets', icon: Database },
  { key: 'audit', label: 'Audit logs', icon: ScrollText },
  { key: 'system', label: 'System & jobs', icon: Server },
  { key: 'broadcast', label: 'Broadcast', icon: Megaphone },
]

export default function AdminPage() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'overview'
  const setTab = (key) => setParams(key === 'overview' ? {} : { tab: key }, { replace: true })
  return (
    <div>
      <PageHeader
        icon={ShieldCheck}
        title="Administration"
        description="User management, platform analytics, recommendation monitoring, dataset administration, audit logs and system health."
      />
      <Tabs className="mb-6" tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'users' ? (
        <UsersTab />
      ) : tab === 'recommendations' ? (
        <RecommendationTab />
      ) : tab === 'datasets' ? (
        <DatasetsTab />
      ) : tab === 'audit' ? (
        <AuditTab />
      ) : tab === 'system' ? (
        <SystemTab />
      ) : tab === 'broadcast' ? (
        <BroadcastTab />
      ) : (
        <OverviewTab />
      )}
    </div>
  )
}
