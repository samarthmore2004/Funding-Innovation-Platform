import { useSearchParams } from 'react-router-dom'
import { FileText, FlaskConical, Grid3x3, LineChart, Network, Radio, Search, Users } from 'lucide-react'
import { Alert, PageHeader, Tabs } from '../components/ui'
import PatentSearchTab from './patents/PatentSearchTab'
import { AssigneesTab, ClustersTab, InnovationMapTab, LiveSearchTab, PatentTrendsTab } from './patents/PatentAnalyticsTabs'
import { patentsApi } from '../api/patents'
import { useApi } from '../utils/hooks'
import { formatNumber } from '../utils/format'

const TABS = [
  { key: 'search', label: 'Patent search', icon: Search },
  { key: 'trends', label: 'Filing trends', icon: LineChart },
  { key: 'competitors', label: 'Assignees & competitors', icon: Users },
  { key: 'clusters', label: 'Clusters', icon: Network },
  { key: 'map', label: 'Innovation map', icon: Grid3x3 },
  { key: 'live', label: 'Live search', icon: Radio },
]

export default function PatentsPage() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'search'
  const { data: facets } = useApi(() => patentsApi.facets(), [])
  const illustrativeCount = (facets?.record_types || []).find((r) => r.value === 'illustrative')?.count || 0
  const setTab = (key) => setParams(key === 'search' ? {} : { tab: key }, { replace: true })

  return (
    <div>
      <PageHeader
        icon={FileText}
        title="Patent landscape analysis"
        description="Patent search, clustering, filing trends, competitor analysis and innovation mapping."
      />
      {illustrativeCount > 0 && (
        <Alert variant="warning" icon={FlaskConical} title="Includes illustrative sample data" className="mb-6">
          {formatNumber(illustrativeCount)} patent records are synthetic demo data with fictional assignees and identifiers (marked
          “Illustrative sample”). They demonstrate the analytics and are not real patents. Administrators can import real exports
          (e.g. Google Patents or The Lens CSV) under Admin → Datasets, or enable live PatentsView search with an API key.
        </Alert>
      )}
      <Tabs className="mb-6" tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'trends' ? (
        <PatentTrendsTab facets={facets} />
      ) : tab === 'competitors' ? (
        <AssigneesTab facets={facets} />
      ) : tab === 'clusters' ? (
        <ClustersTab facets={facets} />
      ) : tab === 'map' ? (
        <InnovationMapTab />
      ) : tab === 'live' ? (
        <LiveSearchTab />
      ) : (
        <PatentSearchTab facets={facets} />
      )}
    </div>
  )
}
