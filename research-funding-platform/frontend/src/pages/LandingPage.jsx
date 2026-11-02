import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  BrainCircuit,
  Briefcase,
  Building2,
  Cpu,
  FileBarChart,
  FileText,
  FlaskConical,
  Gauge,
  GraduationCap,
  LayoutDashboard,
  Rocket,
  Search,
  Server,
  ShieldCheck,
  TrendingUp,
  UserRound,
} from 'lucide-react'
import Button from '../components/ui/Button'
import { useAuth } from '../auth/AuthContext'
import { useDocumentTitle } from '../utils/hooks'
import { SERIES_COLORS } from '../components/charts/palette'

const MODULES = [
  { icon: UserRound, title: 'User & profile management', text: 'Secure accounts, role-based access, research domains, keywords, publications, patents and history.' },
  { icon: Search, title: 'Funding discovery', text: 'Search government grants, research councils, innovation funds, accelerators and international programs.' },
  { icon: TrendingUp, title: 'Research trend intelligence', text: 'Publication trends, emerging-topic detection, research hotspots and citation analytics.' },
  { icon: FileText, title: 'Patent landscape analysis', text: 'Patent search, clustering, filing trends, competitor comparison and innovation mapping.' },
  { icon: Cpu, title: 'Technology intelligence', text: 'Emerging technology identification, maturity, adoption tracking and white-space opportunities.' },
  { icon: Gauge, title: 'Innovation scoring engine', text: 'A transparent weighted score with a component-by-component explanation.' },
  { icon: Rocket, title: 'Commercialization', text: 'Licensing, startup, productization and partnership pathways with next steps.' },
  { icon: Bell, title: 'Notifications & alerts', text: 'New funding matches, deadline reminders, patent and emerging-technology alerts.' },
  { icon: LayoutDashboard, title: 'Dashboards & analytics', text: 'Role-specific dashboards for researchers, founders, innovation managers and admins.' },
  { icon: FileBarChart, title: 'Reports & export', text: 'Funding, patent, trend, innovation and commercialization reports as CSV, Excel or PDF.' },
  { icon: ShieldCheck, title: 'Security & compliance', text: 'JWT authentication, hashed passwords, audit logs, data export and account deletion.' },
  { icon: Server, title: 'System management', text: 'Dataset imports, external source sync, background jobs, health and API metrics.' },
]

const ROLES = [
  {
    icon: GraduationCap,
    title: 'Researchers',
    points: ['Personalised grant recommendations with eligibility checks', 'Trends and citation analytics for your domains', 'Score and position your research outputs'],
  },
  {
    icon: Rocket,
    title: 'Startup founders',
    points: ['Accelerator, venture and innovation-fund matches', 'Competitor patent intelligence', 'Commercialization pathway guidance'],
  },
  {
    icon: Briefcase,
    title: 'Innovation managers',
    points: ['Portfolio analytics and pipeline tracking', 'Technology trend monitoring', 'Funding analytics across programs'],
  },
  {
    icon: Building2,
    title: 'Administrators',
    points: ['User and role management', 'Dataset administration and source sync', 'Recommendation monitoring and audit logs'],
  },
]

const STEPS = [
  { title: 'Build your profile', text: 'Add research domains, keywords, technology areas, publications and patents.' },
  { title: 'Match funding', text: 'TF-IDF text similarity plus rule-based eligibility ranks every open opportunity for you.' },
  { title: 'Read the landscape', text: 'Publication trends, emerging topics, patent clusters and technology maturity in one place.' },
  { title: 'Score & commercialize', text: 'Get an explainable innovation score and concrete commercialization pathways.' },
  { title: 'Report & act', text: 'Track applications, receive alerts and export reports for your team.' },
]

const WEIGHTS = [
  { label: 'Research novelty', weight: 30 },
  { label: 'Patent strength', weight: 20 },
  { label: 'Technology maturity', weight: 15 },
  { label: 'Market potential', weight: 20 },
  { label: 'Funding relevance', weight: 15 },
]

export default function LandingPage() {
  useDocumentTitle()
  const { user } = useAuth()
  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-indigo-50 via-white to-white" aria-hidden="true" />
        <div className="absolute -top-24 right-0 -z-10 h-96 w-96 rounded-full bg-violet-200/40 blur-3xl" aria-hidden="true" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200">
              <BrainCircuit className="h-3.5 w-3.5" /> Research funding &amp; innovation intelligence
            </span>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
              Find the right funding. See where innovation is heading.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-600">
              One workspace for researchers, startups and innovation teams to discover funding, analyse research and patent
              landscapes, score innovations and plan their path to market.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {user ? (
                <Button as={Link} to="/app" size="lg" iconRight={ArrowRight}>
                  Open your dashboard
                </Button>
              ) : (
                <>
                  <Button as={Link} to="/register" size="lg" iconRight={ArrowRight}>
                    Create a free account
                  </Button>
                  <Button as={Link} to="/login" size="lg" variant="secondary">
                    Sign in
                  </Button>
                </>
              )}
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Funding records show their source and verification date. Demo records are clearly labelled as illustrative.
            </p>
          </div>

          {/* Formula card: the real scoring weights, not invented metrics */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-indigo-100/60">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Gauge className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">Innovation score model</p>
                <p className="text-xs text-slate-500">Each component is normalised to 0–100</p>
              </div>
            </div>
            <ul className="mt-6 space-y-4">
              {WEIGHTS.map((item, index) => (
                <li key={item.label}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="flex items-center gap-2 text-slate-700">
                      <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: SERIES_COLORS[index] }} aria-hidden="true" />
                      {item.label}
                    </span>
                    <span className="font-semibold text-slate-900">{item.weight}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full" style={{ width: `${item.weight * 3}%`, background: SERIES_COLORS[index] }} />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-6 rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600">
              Score = 0.30·N + 0.20·P + 0.15·T + 0.20·M + 0.15·F
            </p>
            <p className="mt-3 text-xs text-slate-500">
              A heuristic decision-support score — not a validated prediction of commercial success.
            </p>
          </div>
        </div>
      </section>

      {/* Modules */}
      <section id="modules" className="scroll-mt-20 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-indigo-600">Twelve integrated modules</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Everything from first idea to funded innovation</h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((module) => (
              <div key={module.title} className="rounded-xl border border-slate-200 p-5 transition hover:border-indigo-200 hover:shadow-sm">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <module.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-sm font-semibold text-slate-900">{module.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{module.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="scroll-mt-20 bg-slate-50 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-indigo-600">Role-based workspaces</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">A dashboard built for how you work</h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {ROLES.map((role) => (
              <div key={role.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <role.icon className="h-6 w-6 text-violet-600" />
                <h3 className="mt-3 font-semibold text-slate-900">{role.title}</h3>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  {role.points.map((point) => (
                    <li key={point} className="flex gap-2">
                      <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-20 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-indigo-600">How it works</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">From profile to funded project in five steps</h2>
          </div>
          <ol className="mt-10 grid gap-4 md:grid-cols-5">
            {STEPS.map((step, index) => (
              <li key={step.title} className="relative rounded-xl border border-slate-200 p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-sm font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Transparency */}
      <section id="transparency" className="scroll-mt-20 bg-slate-900 py-16 text-white sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <p className="text-sm font-semibold text-indigo-300">Data sources &amp; transparency</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">You always know where a number comes from</h2>
            <p className="mt-4 text-slate-300">
              Every funding record carries a source label. Verified records link to the official source with the date they were
              checked. Synthetic demo records are labelled “Illustrative sample” and must never be treated as real calls for
              proposals.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: BadgeCheck, title: 'Verified funding', text: 'Imported from official sources such as Grants.gov, with source link and verification date.' },
              { icon: FlaskConical, title: 'Illustrative samples', text: 'Synthetic demo funding and patent records used to demonstrate features — clearly flagged.' },
              { icon: TrendingUp, title: 'Open research metadata', text: 'Publication data from OpenAlex and Crossref, with local snapshots when the APIs are unavailable.' },
              { icon: Gauge, title: 'Explainable scoring', text: 'Every score shows its components, weights and input factors. It supports decisions; it does not predict success.' },
            ].map((item) => (
              <div key={item.title} className="rounded-xl bg-white/5 p-5 ring-1 ring-white/10">
                <item.icon className="h-5 w-5 text-indigo-300" />
                <h3 className="mt-3 text-sm font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm text-slate-300">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Ready to map your next opportunity?</h2>
          <p className="mt-3 text-slate-600">Create an account, complete your research profile and get your first recommendations in minutes.</p>
          <div className="mt-8 flex justify-center gap-3">
            <Button as={Link} to={user ? '/app' : '/register'} size="lg" iconRight={ArrowRight}>
              {user ? 'Go to dashboard' : 'Get started'}
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}
