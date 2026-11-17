/**
 * The frame around every screen: a centred column for the content and,
 * on the four main screens, the bottom tab bar.
 *
 * Mobile first: the column is the full width of a phone. On a desktop
 * browser it stops growing at a comfortable reading width and is centred,
 * so the same layout works everywhere without a separate desktop design.
 */
import { CalendarDays, ChartLine, Dumbbell, House } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { cx } from './ui'

const TABS = [
  { to: '/', label: 'Today', icon: House },
  { to: '/plan', label: 'Plan', icon: CalendarDays },
  { to: '/exercises', label: 'Exercises', icon: Dumbbell },
  { to: '/progress', label: 'Progress', icon: ChartLine },
]

/** Scrollable content column. `env(safe-area-inset-*)` keeps clear of the iPhone notch. */
export function Page({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 overflow-y-auto px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-6">
      {children}
    </main>
  )
}

/** Layout for the main screens: content above, tab bar pinned to the bottom. */
export function TabLayout() {
  return (
    <div className="flex h-full flex-col">
      {/* <Outlet /> is where React Router draws the current screen. */}
      <Outlet />
      <nav className="border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-xl">
          {TABS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              // `end` on "/" stops Today from staying highlighted on every other route.
              end={to === '/'}
              className={({ isActive }) =>
                cx('flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs', isActive ? 'text-accent' : 'text-faint')
              }
            >
              <Icon size={22} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

/** Layout for focused screens (active workout, editors): no tab bar. */
export function PlainLayout() {
  return (
    <div className="flex h-full flex-col">
      <Outlet />
    </div>
  )
}
