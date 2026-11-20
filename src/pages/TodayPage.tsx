/**
 * Today: the workout of the day.
 *
 * Shows the plan day that matches today's weekday, lets you swap single
 * exercises or re-roll the whole day, and controls the workout itself:
 *
 *   not started   Start workout
 *   in progress   Continue workout · Pause · Finish workout · Reset
 *   paused        Resume workout   · Finish workout · Reset
 *   finished      a summary card, plus Start another workout
 *
 * The rules behind Finish and Reset are in finishWorkout / resetWorkout in
 * ../db/actions.ts.
 */
import { Check, Pause, Pin, Play, RefreshCw, RotateCcw, Shuffle, Timer } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../components/Layout'
import { Button, Card, IconButton, PageHeader, Row } from '../components/ui'
import { SortableList } from '../components/SortableList'
import { finishWorkout, movePick, reshuffleDay, resetWorkout, swapDayPick } from '../db/actions'
import { useAllExercises, useAllLogs, useDayLogs, useExerciseMap, usePlanDay, useSessionsOn, useSettings } from '../db/hooks'
import { dateKey, formatLongDate } from '../lib/dates'
import { dayTitle, joinList, MUSCLE_LABELS, targetLabel } from '../lib/labels'
import { coverageSummary, showsCoverage } from '../lib/shuffle'
import { describeLog, inProgressLogs, lastLogByExercise } from '../lib/stats'
import { pauseWorkoutClock, resumeWorkoutClock, useNow, useTimers, workoutElapsedMs } from '../lib/timers'
import { formatDuration } from '../lib/units'

export function TodayPage() {
  const navigate = useNavigate()
  const today = new Date()
  const todayKey = dateKey(today)
  const day = usePlanDay(today.getDay())
  const exercises = useAllExercises()
  const exerciseMap = useExerciseMap()
  const settings = useSettings()
  const todayLogs = useDayLogs(todayKey)
  const sessions = useSessionsOn(todayKey)
  const allLogs = useAllLogs()
  const { workout } = useTimers()
  const [notice, setNotice] = useState('')

  // The workout clock only counts if it belongs to today.
  const clock = workout?.date === todayKey ? workout : null
  const paused = Boolean(clock?.pausedAt)
  const now = useNow(Boolean(clock) && !paused)

  const headerActions = (
    <IconButton label="Stopwatch and timer" className="-mr-2" onClick={() => navigate('/timers')}>
      <Timer />
    </IconButton>
  )

  // Still loading from the database: draw the frame only.
  if (!day || !exercises || !todayLogs || !sessions) {
    return (
      <Page>
        <PageHeader title="Today" subtitle={formatLongDate(today)} action={headerActions} />
      </Page>
    )
  }

  const title = dayTitle(day.types)
  const activeSets = inProgressLogs(todayLogs, sessions)
  const inProgress = Boolean(clock) || activeSets.length > 0
  const lastSession = sessions.at(-1)

  const finish = async () => {
    const saved = await finishWorkout(title, todayKey)
    setNotice(saved ? '' : "No sets were logged, so there was nothing to save.")
  }

  const reset = async () => {
    const count = activeSets.length
    const message =
      count > 0
        ? `Reset this workout? The ${count} ${count === 1 ? 'set' : 'sets'} you logged in it will be deleted.`
        : 'Reset this workout? The workout timer will be cleared.'
    // A browser confirm is plain but safe: this is the one control here that deletes data.
    if (!window.confirm(message)) return
    await resetWorkout(todayKey)
    setNotice('')
  }

  if (day.types.length === 0 && !inProgress) {
    return (
      <Page>
        <PageHeader title="Rest day" subtitle={formatLongDate(today)} action={headerActions} />
        {lastSession && <SessionSummary title="Workout finished" seconds={lastSession.activeSeconds} sets={lastSession.setCount} />}
        <p className="text-soft">Nothing planned today. Recover, stretch, or go for a walk.</p>
        <Button className="mt-4" onClick={() => navigate(`/plan/${day.weekday}`)}>
          Plan a workout for today
        </Button>
      </Page>
    )
  }

  const lastLogs = lastLogByExercise(allLogs ?? [])
  const setsDone = (exerciseId: string) => activeSets.filter((log) => log.exerciseId === exerciseId).length
  const coverage = coverageSummary(day.picks, exercises)

  return (
    <Page>
      <PageHeader title={title} subtitle={formatLongDate(today)} action={headerActions} />

      {lastSession && !inProgress && (
        <SessionSummary title="Workout finished" seconds={lastSession.activeSeconds} sets={lastSession.setCount} />
      )}

      {day.picks.length === 0 ? (
        <p className="text-soft">No exercises yet. Shuffle to fill the day from your library.</p>
      ) : (
        // Drag the grip on the left to change the order you do the exercises in.
        <SortableList
          ids={day.picks.map((pick) => pick.exerciseId)}
          onMove={(from, to) => movePick(day.id, from, to)}
          renderItem={(exerciseId, handle) => {
            const index = day.picks.findIndex((pick) => pick.exerciseId === exerciseId)
            const pick = day.picks[index]
            if (!pick) return null
            const exercise = exerciseMap.get(pick.exerciseId)
            const last = lastLogs.get(pick.exerciseId)
            const done = setsDone(pick.exerciseId)
            return (
              <Row>
                {handle}
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
          }}
        />
      )}

      {showsCoverage(day.types) && day.picks.length > 0 && (
        <p className="mt-3 text-sm text-soft">
          Covers {coverage.covered.length} of 6 muscle groups
          {coverage.missing.length > 0 &&
            ` · no ${joinList(coverage.missing.map((group) => MUSCLE_LABELS[group].toLowerCase()))}`}
        </p>
      )}

      {inProgress ? (
        <div className="mt-5 flex flex-col gap-2">
          {/* Status line: time so far and sets logged in this workout. */}
          <p className="text-center text-sm text-soft">
            {paused ? 'Paused' : 'In progress'}
            {clock && <span className="digits"> · {formatDuration(workoutElapsedMs(clock, now) / 1000)}</span>}
            {' · '}
            {activeSets.length} {activeSets.length === 1 ? 'set' : 'sets'} logged
          </p>
          {/* Opening the workout screen resumes a paused clock (see startWorkoutClock). */}
          <Button
            full
            variant="primary"
            disabled={day.picks.length === 0}
            onClick={() => {
              resumeWorkoutClock()
              navigate('/workout')
            }}
          >
            {paused ? <Play size={18} /> : null}
            {paused ? 'Resume workout' : 'Continue workout'}
          </Button>
          <div className="flex gap-2">
            {/* While paused, the button above already resumes, so Pause is only shown while running. */}
            {clock && !paused && (
              <Button className="flex-1" onClick={pauseWorkoutClock}>
                <Pause size={18} />
                Pause
              </Button>
            )}
            <Button className="flex-1" onClick={finish}>
              <Check size={18} />
              Finish workout
            </Button>
          </div>
          <Button variant="danger" onClick={reset}>
            <RotateCcw size={18} />
            Reset workout
          </Button>
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-2">
          <Button full onClick={() => reshuffleDay(day, exercises)}>
            <Shuffle size={18} />
            {day.picks.some((pick) => pick.pinned) ? 'Shuffle unpinned' : `Shuffle all ${day.count}`}
          </Button>
          <Button full variant="primary" disabled={day.picks.length === 0} onClick={() => navigate('/workout')}>
            {lastSession ? 'Start another workout' : 'Start workout'}
          </Button>
        </div>
      )}

      {notice && (
        <p role="status" className="mt-3 text-center text-sm text-soft">
          {notice}
        </p>
      )}
    </Page>
  )
}

/** "Workout finished · 48:12 · 16 sets" card. */
function SessionSummary({ title, seconds, sets }: { title: string; seconds: number; sets: number }) {
  return (
    <Card className="mb-4 flex items-center gap-3 bg-good/15">
      <Check className="text-good" />
      <div>
        <div className="font-medium text-good">{title}</div>
        <div className="digits text-sm text-soft">
          {formatDuration(seconds)} · {sets} {sets === 1 ? 'set' : 'sets'}
        </div>
      </div>
    </Card>
  )
}
