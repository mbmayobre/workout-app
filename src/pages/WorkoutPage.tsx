/**
 * Active workout: the screen used in the gym.
 *
 * One exercise at a time, with everything needed on a single screen:
 * the rest timer or stopwatch, the set counter, inputs for weight and reps,
 * and the sets logged so far. Previous / Next step through today's plan.
 *
 * Structure:
 *
 *   WorkoutPage      picks the current exercise (from the `?i=` URL parameter)
 *   └ ExerciseLogger loads that exercise's logs from the database
 *     └ LoggerForm   the inputs and buttons; holds what has been typed
 *
 * The split exists because LoggerForm's input boxes must be pre-filled from
 * the last logged set, and that data loads asynchronously. LoggerForm is
 * only created once the data is ready, so its starting values are right.
 */
import { Check, ChevronLeft, ChevronRight, Minus, Pause, Play, Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Page } from '../components/Layout'
import { RestCard, StopwatchCard } from '../components/TimerCards'
import { Button, IconButton, NumberField } from '../components/ui'
import { adjustPickSets, deleteSetLog, finishWorkout, logSet } from '../db/actions'
import { useExerciseLogs, useExerciseMap, usePlanDay, useSettings } from '../db/hooks'
import type { Exercise, PlanPick, SetLog, Settings } from '../db/types'
import { dateKey, formatShortDate } from '../lib/dates'
import { unlockAudio, useWakeLock } from '../lib/device'
import { dayTitle, targetLabel } from '../lib/labels'
import { describeLog, groupByDate } from '../lib/stats'
import {
  pauseWorkoutClock,
  resetStopwatch,
  resumeWorkoutClock,
  startRest,
  startWorkoutClock,
  useNow,
  useTimers,
  workoutElapsedMs,
} from '../lib/timers'
import {
  formatDuration,
  kgToUnit,
  parseNumber,
  trimNumber,
  unitToKg,
  unitToMetres,
  weightUnitFor,
} from '../lib/units'

export function WorkoutPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const today = dateKey()
  const day = usePlanDay(new Date().getDay())
  const exerciseMap = useExerciseMap()
  const settings = useSettings()
  const { workout } = useTimers()
  const now = useNow(true)

  // Keep the phone screen on for as long as this screen is open.
  useWakeLock(true)
  useEffect(() => startWorkoutClock(today), [today])

  if (!day || exerciseMap.size === 0) return <Page>{null}</Page> // loading
  if (day.picks.length === 0) return <Navigate to="/" replace />

  // The current position is kept in the URL (?i=2) so a page reload or the
  // phone's back button returns to the same exercise.
  const requested = Number(params.get('i') ?? 0)
  const index = Math.min(Math.max(0, Number.isInteger(requested) ? requested : 0), day.picks.length - 1)
  const pick = day.picks[index]
  const exercise = exerciseMap.get(pick.exerciseId)
  const isLast = index === day.picks.length - 1

  const goTo = (next: number) => setParams({ i: String(next) }, { replace: true })
  const clock = workout?.date === today ? workout : null
  const paused = Boolean(clock?.pausedAt)

  // Saves the workout summary and stops every timer (see finishWorkout).
  const finish = async () => {
    await finishWorkout(dayTitle(day.types), today)
    navigate('/')
  }

  return (
    <>
      <Page>
        <div className="mb-2 flex items-center justify-between text-sm text-soft">
          <IconButton label="Back to today" className="-ml-2" onClick={() => navigate('/')}>
            <ChevronLeft />
          </IconButton>
          <span>
            Exercise {index + 1} of {day.picks.length}
          </span>
          {/* Workout clock. Tapping it pauses or resumes the workout. */}
          <button
            type="button"
            onClick={paused ? resumeWorkoutClock : pauseWorkoutClock}
            aria-label={paused ? 'Resume workout' : 'Pause workout'}
            className={`digits -mr-2 flex min-h-11 items-center gap-1 rounded-xl px-2 active:bg-raised ${paused ? 'text-accent' : ''}`}
          >
            {paused ? <Play size={14} /> : <Pause size={14} />}
            {clock ? formatDuration(workoutElapsedMs(clock, now) / 1000) : '0:00'}
          </button>
        </div>

        {exercise ? (
          // `key` makes React build a fresh logger (with fresh input boxes)
          // whenever the exercise changes.
          <ExerciseLogger
            key={exercise.id}
            pick={pick}
            exercise={exercise}
            settings={settings}
            date={today}
            onAdjustSets={(delta, min) => adjustPickSets(day.id, index, delta, { min, max: MAX_SETS })}
          />
        ) : (
          <p className="text-soft">This exercise was deleted. Swap it out on the Today screen.</p>
        )}
      </Page>

      <footer className="border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-2 px-4 py-2">
          <Button variant="ghost" disabled={index === 0} onClick={() => goTo(index - 1)}>
            <ChevronLeft size={18} />
            Previous
          </Button>
          {isLast ? (
            <Button onClick={finish}>
              <Check size={18} />
              Finish workout
            </Button>
          ) : (
            <Button onClick={() => goTo(index + 1)}>
              Next
              <ChevronRight size={18} />
            </Button>
          )}
        </div>
      </footer>
    </>
  )
}

interface LoggerProps {
  pick: PlanPick
  exercise: Exercise
  settings: Settings
  date: string
  /**
   * Add `delta` sets to this exercise's target (negative removes), never
   * going below `min`. Saved to today's plan day.
   */
  onAdjustSets: (delta: number, min: number) => void
}

/** Most sets an exercise can be given; matches the day editor's limit. */
const MAX_SETS = 20

/** Loads the exercise's history, then shows the form. */
function ExerciseLogger(props: LoggerProps) {
  const history = useExerciseLogs(props.exercise.id)
  if (!history) return null // loading
  return <LoggerForm {...props} history={history} />
}

function LoggerForm({ pick, exercise, settings, date, history, onAdjustSets }: LoggerProps & { history: SetLog[] }) {
  const isCardio = exercise.kind === 'cardio'
  const isTimed = !isCardio && exercise.logMode === 'time'
  const usesWeight = exercise.kind === 'strength'
  const unit = weightUnitFor(exercise, settings)

  const todayLogs = history.filter((log) => log.date === date)
  // The most recent earlier session, for the "Last time" line.
  const previousSession = groupByDate(history.filter((log) => log.date !== date)).at(-1)
  // The most recent set of all, used to pre-fill the inputs.
  const lastLog = history.at(-1)

  // Input boxes hold text; see NumberField in components/ui.tsx for why.
  const [weightText, setWeightText] = useState(
    lastLog?.weightKg !== undefined ? trimNumber(kgToUnit(lastLog.weightKg, unit)) : '',
  )
  const [repsText, setRepsText] = useState(String(lastLog?.reps ?? pick.reps))
  const [secondsText, setSecondsText] = useState(String(pick.seconds))
  const [minutesText, setMinutesText] = useState(String(Math.floor(pick.seconds / 60)))
  const [cardioSecondsText, setCardioSecondsText] = useState(String(pick.seconds % 60))
  const [distanceText, setDistanceText] = useState('')
  const [caloriesText, setCaloriesText] = useState('')
  const [error, setError] = useState('')

  // When the stopwatch is paused with time on it, copy that time into the
  // duration boxes, so "stop the watch, tap log" is all it takes.
  const { stopwatch } = useTimers()
  useEffect(() => {
    if (!(isCardio || isTimed) || stopwatch.startedAt !== null || stopwatch.accumulatedMs === 0) return
    const seconds = Math.round(stopwatch.accumulatedMs / 1000)
    if (isCardio) {
      setMinutesText(String(Math.floor(seconds / 60)))
      setCardioSecondsText(String(seconds % 60))
    } else {
      setSecondsText(String(seconds))
    }
  }, [isCardio, isTimed, stopwatch.startedAt, stopwatch.accumulatedMs])

  /** Validate the inputs and save one set. */
  const log = async () => {
    unlockAudio() // allow the rest-over beep later (browsers need a tap first)
    const entry: Omit<SetLog, 'id' | 'at'> = { exerciseId: exercise.id, date }

    if (usesWeight) {
      const weight = parseNumber(weightText)
      if (weight === undefined) return setError('Enter a weight first.')
      entry.weightKg = unitToKg(weight, unit)
    }
    if (isCardio) {
      const seconds = (parseNumber(minutesText) ?? 0) * 60 + (parseNumber(cardioSecondsText) ?? 0)
      if (seconds <= 0) return setError('Enter how long you went for.')
      entry.seconds = Math.round(seconds)
      const distance = parseNumber(distanceText)
      if (distance) entry.distanceM = unitToMetres(distance, settings.distanceUnit)
      const calories = parseNumber(caloriesText)
      if (calories) entry.calories = Math.round(calories)
    } else if (isTimed) {
      const seconds = parseNumber(secondsText)
      if (!seconds) return setError('Enter the seconds first.')
      entry.seconds = Math.round(seconds)
    } else {
      const reps = parseNumber(repsText)
      if (!reps) return setError('Enter the reps first.')
      entry.reps = Math.round(reps)
    }

    setError('')
    await logSet(entry)
    if (isCardio || isTimed) resetStopwatch()
    if (!isCardio && settings.autoRest) startRest(settings.restSeconds)
  }

  // The target can't drop below the sets already done (a logged set you
  // want gone is deleted with the × in the list below), or below 1.
  const minSets = Math.max(1, todayLogs.length)

  // Typing in any box clears a previous error message.
  const editing = (setter: (text: string) => void) => (text: string) => {
    setError('')
    setter(text)
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{exercise.name}</h1>
        <p className="text-sm text-soft">Target {targetLabel(pick, exercise)}</p>
        {previousSession && (
          <p className="truncate text-sm text-soft">
            Last time ({formatShortDate(previousSession.date)}):{' '}
            {previousSession.logs.map((entry) => describeLog(entry, exercise, settings)).join(', ')}
          </p>
        )}
      </div>

      {isCardio && <StopwatchCard targetSeconds={pick.seconds} label="Elapsed" />}
      {isTimed && <StopwatchCard targetSeconds={pick.seconds} label="Set timer" />}
      {!isCardio && <RestCard defaultSeconds={settings.restSeconds} />}

      {/*
        The set counter: sets done / target sets. − and + change the TARGET
        (3 sets becomes 4), not the sets done. Sets are done by logging them
        with the button below.
      */}
      {!isCardio && (
        <div className="flex items-center justify-between">
          <span className="whitespace-nowrap">Sets done</span>
          <div className="flex items-center gap-1">
            <IconButton
              label="Remove a set from the target"
              className="bg-raised"
              disabled={pick.sets <= minSets}
              onClick={() => onAdjustSets(-1, minSets)}
            >
              <Minus size={18} />
            </IconButton>
            <span className="digits w-20 text-center text-2xl font-semibold">
              {todayLogs.length} / {pick.sets}
            </span>
            <IconButton
              label="Add a set to the target"
              className="bg-raised"
              disabled={pick.sets >= MAX_SETS}
              onClick={() => onAdjustSets(1, minSets)}
            >
              <Plus size={18} />
            </IconButton>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        {usesWeight && <NumberField label="Weight" suffix={unit} value={weightText} onChange={editing(setWeightText)} placeholder="0" />}
        {isCardio ? (
          <>
            <NumberField label="Minutes" value={minutesText} onChange={editing(setMinutesText)} />
            <NumberField label="Seconds" value={cardioSecondsText} onChange={editing(setCardioSecondsText)} />
          </>
        ) : isTimed ? (
          <NumberField label="Time" suffix="s" value={secondsText} onChange={editing(setSecondsText)} />
        ) : (
          <NumberField label="Reps" value={repsText} onChange={editing(setRepsText)} />
        )}
      </div>
      {isCardio && (
        <div className="flex gap-3">
          <NumberField label="Distance (optional)" suffix={settings.distanceUnit} value={distanceText} onChange={editing(setDistanceText)} />
          <NumberField label="Calories (optional)" value={caloriesText} onChange={editing(setCaloriesText)} />
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      )}

      <Button full variant="primary" className="min-h-14 text-base" onClick={log}>
        {isCardio ? 'Log cardio' : `Log set ${todayLogs.length + 1}`}
      </Button>

      {todayLogs.length > 0 && (
        <ol className="rounded-2xl bg-surface px-4">
          {todayLogs.map((entry, position) => (
            <li key={entry.id} className="flex min-h-12 items-center gap-3 border-b border-line last:border-b-0">
              <span className="w-6 text-sm text-soft">{position + 1}</span>
              <span className="digits flex-1">{describeLog(entry, exercise, settings)}</span>
              <IconButton label={`Delete set ${position + 1}`} className="-mr-3" onClick={() => deleteSetLog(entry.id)}>
                <X size={16} />
              </IconButton>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
