/**
 * The frame around every screen: a centred column for the content and the
 * bottom tab bar, which is shown on EVERY screen so each section is always
 * one tap away, even mid-workout.
 *
 * Mobile first: the column is the full width of a phone. On a desktop
 * browser it stops growing at a comfortable reading width and is centred,
 * so the same layout works everywhere without a separate desktop design.
 */
import { CalendarDays, ChartLine, Dumbbell, House, Settings, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { cx } from './ui'

interface Tab {
  to: string
  label: string
  icon: LucideIcon
  /** URL prefixes that count as "inside" this tab, so it stays highlighted on sub-screens. */
  sections: string[]
}

const TABS: Tab[] = [
  // The active workout and the timers screen are reached from Today, so they belong to it.
  { to: '/', label: 'Today', icon: House, sections: ['/workout', '/timers'] },
  { to: '/plan', label: 'Plan', icon: CalendarDays, sections: ['/plan'] },
  { to: '/exercises', label: 'Exercises', icon: Dumbbell, sections: ['/exercises'] },
  { to: '/progress', label: 'Progress', icon: ChartLine, sections: ['/progress'] },
  { to: '/settings', label: 'Settings', icon: Settings, sections: ['/settings'] },
]

/** True when `path` is the tab's own page or one of its sub-screens. */
function isInTab(tab: Tab, path: string): boolean {
  if (path === tab.to) return true
  return tab.sections.some((section) => path === section || path.startsWith(`${section}/`))
}

/** Scrollable content column. `env(safe-area-inset-*)` keeps clear of the iPhone notch. */
export function Page({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 overflow-y-auto px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-6">
      {children}
    </main>
  )
}

/**
 * The one layout every route uses: the current screen above, the tab bar
 * pinned to the bottom. A screen may add its own bar (the active workout's
 * Previous / Next) by rendering it after its <Page>; it then sits directly
 * above the tab bar.
 */
export function AppLayout() {
  const { pathname } = useLocation()
  return (
    <div className="flex h-full flex-col">
      {/* <Outlet /> is where React Router draws the current screen. */}
      <Outlet />
      <nav className="border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-xl">
          {TABS.map((tab) => {
            const active = isInTab(tab, pathname)
            const Icon = tab.icon
            return (
              <Link
                key={tab.to}
                to={tab.to}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs',
                  active ? 'text-accent' : 'text-faint',
                )}
              >
                <Icon size={22} />
                {tab.label}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
