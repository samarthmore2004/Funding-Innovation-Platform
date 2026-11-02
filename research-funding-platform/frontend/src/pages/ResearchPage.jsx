import { useSearchParams } from 'react-router-dom'
import { BarChart3, BookOpen, Database, Flame, Layers, LineChart, Quote, Sparkles, TrendingUp, UserRound } from 'lucide-react'
import { Badge, PageHeader, StatCard, Tabs } from '../components/ui'
import TrendsTab from './research/TrendsTab'
import { CitationsTab, EmergingTab, HotspotsTab } from './research/InsightTabs'
import { MyAnalyticsTab, PublicationsExplorer } from './research/PublicationTabs'
import { researchApi } from '../api/research'
import { useApi } from '../utils/hooks'
import { useTaxonomy } from '../utils/taxonomy'
import { compactNumber, formatDecimal, formatNumber, humanize } from '../utils/format'

const TABS = [
  { key: 'trends', label: 'Publication trends', icon: LineChart },
  { key: 'emerging', label: 'Emerging topics', icon: Sparkles },
  { key: 'hotspots', label: 'Research hotspots', icon: Flame },
  { key: 'citations', label: 'Citation analytics', icon: Quote },
  { key: 'publications', label: 'Publications', icon: BookOpen },
  { key: 'mine', label: 'My analytics', icon: UserRound },
]

export default function ResearchPage() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'trends'
  const { domainName } = useTaxonomy()
  const { data: overview } = useApi(() => researchApi.overview(), [])

  const setTab = (key) => setParams(key === 'trends' ? {} : { tab: key }, { replace: true })

  return (
    <div>
      <PageHeader
        icon={TrendingUp}
        title="Research trend intelligence"
        description="Publication trends, emerging-topic detection, research hotspots, domain monitoring and citation analytics."
      />
      {overview && (
        <div className="mb-6 space-y-3">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Publications analysed" value={compactNumber(overview.total_publications)} icon={Database} tone="indigo" />
            <StatCard label="Total citations" value={compactNumber(overview.total_citations)} icon={Quote} tone="violet" />
            <StatCard label="Average citations" value={formatDecimal(overview.avg_citations, 1)} icon={BarChart3} tone="sky" />
            <StatCard label="Domains covered" value={formatNumber(overview.domains_covered)} icon={Layers} tone="green" />
            <StatCard
              label="Most active domain"
              value={overview.top_domain ? domainName(overview.top_domain) : '—'}
              hint={overview.year_range?.length === 2 ? `Years ${overview.year_range[0]}–${overview.year_range[1]}` : undefined}
              icon={TrendingUp}
              tone="amber"
            />
          </div>
          {overview.sources?.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>Data sources:</span>
              {overview.sources.map((source) => (
                <Badge key={source.source} color="slate">
                  {humanize(source.source)} · {formatNumber(source.count)}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
      <Tabs className="mb-6" tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'emerging' ? (
        <EmergingTab />
      ) : tab === 'hotspots' ? (
        <HotspotsTab />
      ) : tab === 'citations' ? (
        <CitationsTab />
      ) : tab === 'publications' ? (
        <PublicationsExplorer />
      ) : tab === 'mine' ? (
        <MyAnalyticsTab />
      ) : (
        <TrendsTab />
      )}
    </div>
  )
}
