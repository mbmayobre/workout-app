/**
 * Weekly plan: the seven days at a glance. Tap a day to edit it.
 */
import { ChevronRight, Shuffle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../components/Layout'
import { Button, PageHeader, cx } from '../components/ui'
import { reshuffleWeek } from '../db/actions'
import { useAllExercises, usePlanDays } from '../db/hooks'
import { WEEKDAY_NAMES, WEEK_ORDER } from '../lib/dates'
import { dayTitle } from '../lib/labels'

export function PlanPage() {
  const navigate = useNavigate()
  const days = usePlanDays()
  const exercises = useAllExercises()
  const todayWeekday = new Date().getDay()

  if (!days || !exercises) {
    return (
      <Page>
        <PageHeader title="Weekly plan" />
      </Page>
    )
  }

  const workoutDays = days.filter((day) => day.types.length > 0).length

  return (
    <Page>
      <PageHeader
        title="Weekly plan"
        subtitle={`${workoutDays} workout ${workoutDays === 1 ? 'day' : 'days'} · ${7 - workoutDays} rest`}
      />

      <div>
        {/* Monday first, even though the database numbers Sunday as 0. */}
        {WEEK_ORDER.map((weekday) => {
          const day = days.find((candidate) => candidate.weekday === weekday)
          if (!day) return null
          const isToday = weekday === todayWeekday
          const isRest = day.types.length === 0
          const pinned = day.picks.filter((pick) => pick.pinned).length
          return (
            <button
              key={day.id}
              type="button"
              onClick={() => navigate(`/plan/${weekday}`)}
              className={cx(
                'flex min-h-16 w-full items-center gap-3 border-b border-line px-3 text-left last:border-b-0 active:bg-raised',
                isToday && 'rounded-xl border-b-0 bg-accent-soft',
              )}
            >
              <span className={cx('w-10 text-sm', isToday ? 'text-accent' : 'text-soft')}>
                {WEEKDAY_NAMES[weekday].slice(0, 3)}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cx('block truncate', isRest && 'text-faint', isToday && 'text-accent')}>
                  {dayTitle(day.types)}
                </span>
                {!isRest && (
                  <span className={cx('block text-sm', isToday ? 'text-accent' : 'text-soft')}>
                    {day.picks.length} {day.picks.length === 1 ? 'exercise' : 'exercises'}
                    {pinned > 0 && ` · ${pinned} pinned`}
                    {isToday && ' · today'}
                  </span>
                )}
              </span>
              <ChevronRight size={18} className={isToday ? 'text-accent' : 'text-faint'} />
            </button>
          )
        })}
      </div>

      <Button full className="mt-5" onClick={() => reshuffleWeek(days, exercises)}>
        <Shuffle size={18} />
        Shuffle the whole week
      </Button>
      <p className="mt-2 text-center text-sm text-soft">Pinned exercises stay. Everything else is re-rolled.</p>
    </Page>
  )
}
