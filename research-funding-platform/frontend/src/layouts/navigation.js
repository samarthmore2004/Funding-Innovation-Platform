import {
  Bell,
  Cpu,
  FileBarChart,
  FileText,
  FolderKanban,
  Gauge,
  LayoutDashboard,
  Rocket,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserRound,
} from 'lucide-react'

/** Sidebar structure. `roles` restricts an item/section; omit it for everyone. */
export const NAV_SECTIONS = [
  {
    title: 'Overview',
    items: [{ to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true }],
  },
  {
    title: 'Funding',
    items: [
      { to: '/app/funding', label: 'Funding discovery', icon: Search },
      { to: '/app/recommendations', label: 'Recommendations', icon: Sparkles },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { to: '/app/research', label: 'Research trends', icon: TrendingUp },
      { to: '/app/patents', label: 'Patent landscape', icon: FileText },
      { to: '/app/technology', label: 'Technology intelligence', icon: Cpu },
    ],
  },
  {
    title: 'Innovation',
    items: [
      { to: '/app/innovation', label: 'Innovation scoring', icon: Gauge },
      { to: '/app/commercialization', label: 'Commercialization', icon: Rocket },
      { to: '/app/portfolio', label: 'Portfolio & pipeline', icon: FolderKanban, roles: ['innovation_manager', 'admin'] },
    ],
  },
  {
    title: 'Workspace',
    items: [
      { to: '/app/profile', label: 'Research profile', icon: UserRound },
      { to: '/app/notifications', label: 'Notifications', icon: Bell, badgeKey: 'unread' },
      { to: '/app/reports', label: 'Reports & export', icon: FileBarChart },
      { to: '/app/settings', label: 'Settings', icon: Settings },
    ],
  },
  {
    title: 'Administration',
    roles: ['admin'],
    items: [{ to: '/app/admin', label: 'Admin console', icon: ShieldCheck, roles: ['admin'] }],
  },
]

export function visibleSections(role) {
  return NAV_SECTIONS.filter((section) => !section.roles || section.roles.includes(role))
    .map((section) => ({ ...section, items: section.items.filter((item) => !item.roles || item.roles.includes(role)) }))
    .filter((section) => section.items.length > 0)
}

/** Title for the top bar: the nav item with the longest matching path prefix. */
export function titleForPath(pathname) {
  let best = null
  NAV_SECTIONS.forEach((section) =>
    section.items.forEach((item) => {
      const matches = item.end ? pathname === item.to || pathname === `${item.to}/` : pathname.startsWith(item.to)
      if (matches && (!best || item.to.length > best.to.length)) best = item
    }),
  )
  return best?.label || 'Workspace'
}
