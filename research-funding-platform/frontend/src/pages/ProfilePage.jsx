import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BookOpen, FileText, History, Quote, Sparkles, UserRound } from 'lucide-react'
import { Alert, Card, ErrorState, LoadingState, PageHeader, ProgressBar, StatCard, Tabs } from '../components/ui'
import ProfileForm from './profile/ProfileForm'
import PublicationsTab from './profile/PublicationsTab'
import PatentsTab from './profile/PatentsTab'
import HistoryTab from './profile/HistoryTab'
import { profileApi } from '../api/profile'
import { useApi } from '../utils/hooks'
import { formatDateTime, formatNumber } from '../utils/format'

export default function ProfilePage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'profile'
  const welcome = params.get('welcome') === '1'
  const { data: profile, error, loading, reload, setData } = useApi(() => profileApi.get(), [])
  const [dismissed, setDismissed] = useState(false)

  const setTab = (key) => {
    const next = new URLSearchParams(params)
    next.set('tab', key)
    next.delete('welcome')
    setParams(next, { replace: true })
  }

  const stats = profile?.stats || {}

  return (
    <div>
      <PageHeader
        icon={UserRound}
        title="Research profile"
        description="Your domains, keywords, organization, publications, patents and history power recommendations, alerts and scoring."
      />

      {welcome && !dismissed && (
        <Alert variant="success" title="Welcome aboard!" className="mb-6" action={<button type="button" className="text-xs font-medium underline" onClick={() => setDismissed(true)}>Dismiss</button>}>
          Add your research domains and keywords below — they are used to personalise funding recommendations and alerts.
        </Alert>
      )}

      {error && !profile ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !profile ? (
        <LoadingState />
      ) : (
        <>
          <div className="mb-6 grid gap-4 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
            <Card padded className="flex flex-col justify-center">
              <ProgressBar value={profile.completeness} label="Profile completeness" valueText={`${formatNumber(profile.completeness ?? 0)}%`} size="lg" />
              <p className="mt-2 text-xs text-slate-500">
                {profile.completeness >= 80
                  ? 'Great — your profile has enough detail for strong matching.'
                  : 'Add domains, keywords, organization details and publications to improve matching.'}
              </p>
              {profile.updated_at && <p className="mt-1 text-[11px] text-slate-400">Last updated {formatDateTime(profile.updated_at)}</p>}
            </Card>
            <StatCard label="Publications" value={formatNumber(stats.publications ?? 0)} icon={BookOpen} tone="indigo" />
            <StatCard label="Citations" value={formatNumber(stats.citations ?? 0)} icon={Quote} tone="violet" />
            <StatCard label="h-index" value={formatNumber(stats.h_index ?? 0)} icon={Sparkles} tone="sky" />
            <StatCard label="Patents" value={formatNumber(stats.patents ?? 0)} icon={FileText} tone="green" />
          </div>

          <Tabs
            className="mb-6"
            value={tab}
            onChange={setTab}
            tabs={[
              { key: 'profile', label: 'Profile & interests', icon: UserRound },
              { key: 'publications', label: 'Publications', icon: BookOpen, count: stats.publications },
              { key: 'patents', label: 'Patents', icon: FileText, count: stats.patents },
              { key: 'history', label: 'Research history', icon: History, count: stats.history_entries },
            ]}
          />

          {tab === 'publications' ? (
            <PublicationsTab onChanged={reload} />
          ) : tab === 'patents' ? (
            <PatentsTab onChanged={reload} />
          ) : tab === 'history' ? (
            <HistoryTab onChanged={reload} />
          ) : (
            <ProfileForm profile={profile} onSaved={(saved) => (saved ? setData(saved) : reload())} />
          )}
        </>
      )}
    </div>
  )
}
