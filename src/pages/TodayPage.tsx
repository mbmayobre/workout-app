/**
 * Today: the workout of the day.
 *
 * Shows the plan day that matches today's weekday, lets you swap single
 * exercises or re-roll the whole day, and starts the active workout.
 */
import { Check, Pin, RefreshCw, Settings as SettingsIcon, Shuffle, Timer } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../components/Layout'
import { Button, IconButton, PageHeader, Row } from '../components/ui'
import { reshuffleDay, swapDayPick } from '../db/actions'
import { useAllExercises, useAllLogs, useDayLogs, useExerciseMap, usePlanDay, useSettings } from '../db/hooks'
import { dateKey, formatLongDate } from '../lib/dates'
import { dayTitle, joinList, MUSCLE_LABELS, targetLabel } from '../lib/labels'
import { coverageSummary, showsCoverage } from '../lib/shuffle'
import { describeLog, lastLogByExercise } from '../lib/stats'

export function TodayPage() {
  const navigate = useNavigate()
  const today = new Date()
  const day = usePlanDay(today.getDay())
  const exercises = useAllExercises()
  const exerciseMap = useExerciseMap()
  const settings = useSettings()
  const todayLogs = useDayLogs(dateKey(today))
  const allLogs = useAllLogs()

  const headerActions = (
    <>
      <IconButton label="Stopwatch and timer" onClick={() => navigate('/timers')}>
        <Timer />
      </IconButton>
      <IconButton label="Settings" className="-mr-2" onClick={() => navigate('/settings')}>
        <SettingsIcon />
      </IconButton>
    </>
  )

  // Still loading from the database: draw the frame only.
  if (!day || !exercises) {
    return (
      <Page>
        <PageHeader title="Today" subtitle={formatLongDate(today)} action={headerActions} />
      </Page>
    )
  }

  if (day.types.length === 0) {
    return (
      <Page>
        <PageHeader title="Rest day" subtitle={formatLongDate(today)} action={headerActions} />
        <p className="text-soft">Nothing planned today. Recover, stretch, or go for a walk.</p>
        <Button className="mt-4" onClick={() => navigate(`/plan/${day.weekday}`)}>
          Plan a workout for today
        </Button>
      </Page>
    )
  }

  const lastLogs = lastLogByExercise(allLogs ?? [])
  const setsDone = (exerciseId: string) => (todayLogs ?? []).filter((log) => log.exerciseId === exerciseId).length
  const started = (todayLogs ?? []).length > 0
  const coverage = coverageSummary(day.picks, exercises)

  return (
    <Page>
      <PageHeader title={dayTitle(day.types)} subtitle={formatLongDate(today)} action={headerActions} />

      {day.picks.length === 0 ? (
        <p className="text-soft">No exercises yet. Shuffle to fill the day from your library.</p>
      ) : (
        <div>
          {day.picks.map((pick, index) => {
            const exercise = exerciseMap.get(pick.exerciseId)
            const last = lastLogs.get(pick.exerciseId)
            const done = setsDone(pick.exerciseId)
            return (
              <Row key={pick.exerciseId}>
                <div className="min-w-0 flex-1">
                  <div className="truncate">{exercise?.name ?? 'Deleted exercise'}</div>
                  <div className="truncate text-sm text-soft">
                    {targetLabel(pick, exercise)}
                    {last && ` · last ${describeLog(last, exercise, settings)}`}
                  </div>
                </div>
                {done > 0 && (
                  <span className="flex items-center gap-1 text-sm text-good">
                    <Check size={16} />
                    {exercise?.kind === 'cardio' ? 'Done' : `${done}/${pick.sets}`}
                  </span>
                )}
                {pick.pinned ? (
                  <span className="flex size-11 items-center justify-center text-accent" title="Pinned">
                    <Pin size={18} aria-label="Pinned" />
                  </span>
                ) : (
                  <IconButton label={`Swap ${exercise?.name ?? 'exercise'}`} onClick={() => swapDayPick(day, index, exercises)}>
                    <RefreshCw size={18} />
                  </IconButton>
                )}
              </Row>
            )
          })}
        </div>
      )}

      {showsCoverage(day.types) && day.picks.length > 0 && (
        <p className="mt-3 text-sm text-soft">
          Covers {coverage.covered.length} of 6 muscle groups
          {coverage.missing.length > 0 &&
            ` · no ${joinList(coverage.missing.map((group) => MUSCLE_LABELS[group].toLowerCase()))}`}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-2">
        <Button full onClick={() => reshuffleDay(day, exercises)}>
          <Shuffle size={18} />
          {day.picks.some((pick) => pick.pinned) ? 'Shuffle unpinned' : `Shuffle all ${day.count}`}
        </Button>
        <Button full variant="primary" disabled={day.picks.length === 0} onClick={() => navigate('/workout')}>
          {started ? 'Continue workout' : 'Start workout'}
        </Button>
      </div>
    </Page>
  )
}
