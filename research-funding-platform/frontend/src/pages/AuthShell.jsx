import { Link } from 'react-router-dom'
import { BadgeCheck } from 'lucide-react'
import { BrandMark } from '../layouts/BrandMark'

const POINTS = [
  'Personalised funding recommendations with eligibility checks',
  'Research, patent and technology trend intelligence',
  'Explainable innovation scoring and commercialization pathways',
]

/** Split-screen frame shared by the login and registration pages. */
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
        <Link to="/" className="relative flex items-center gap-3">
          <BrandMark size={40} />
          <span className="text-lg font-semibold leading-tight">
            Research Funding &amp; Innovation
            <span className="block text-sm font-medium text-indigo-200">Intelligence Platform</span>
          </span>
        </Link>
        <div className="relative mt-auto">
          <h2 className="text-3xl font-semibold leading-tight">Turn research into funded, market-ready innovation.</h2>
          <ul className="mt-8 space-y-3">
            {POINTS.map((point) => (
              <li key={point} className="flex gap-3 text-indigo-100">
                <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-indigo-200" />
                {point}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex flex-col justify-center px-4 py-12 sm:px-8 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center gap-2 lg:hidden">
            <BrandMark />
            <span className="text-sm font-semibold text-slate-900">Funding &amp; Innovation Intelligence</span>
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 text-center text-sm text-slate-500">{footer}</div>}
        </div>
      </div>
    </div>
  )
}
