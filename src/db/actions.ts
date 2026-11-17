/**
 * Actions: every way the app CHANGES stored data.
 *
 * Screens never write to the database directly; they call a function from
 * this file. Keeping writes in one place means the rules (for example "a
 * built-in exercise is archived, not deleted") live in exactly one spot, and
 * you can see everything the app is able to change by reading this file.
 *
 * Reading data is done with the hooks in ./hooks.ts.
 */
import { dateKey } from '../lib/dates'
import { shuffleDay, swapPick } from '../lib/shuffle'
import { inProgressLogs } from '../lib/stats'
import { endWorkoutTimers, getTimers, workoutElapsedMs } from '../lib/timers'
import { db, newId } from './db'
import { SETTINGS_ID } from './seed'
import type { Exercise, PlanDay, SetLog, Settings } from './types'

// ── Settings ─────────────────────────────────────────────────────────────

export async function updateSettings(changes: Partial<Omit<Settings, 'id'>>): Promise<void> {
  await db.settings.update(SETTINGS_ID, changes)
}

// ── Exercises ────────────────────────────────────────────────────────────

/** Create or update an exercise. Pass an exercise without an id to create one. */
export async function saveExercise(exercise: Omit<Exercise, 'id'> & { id?: string }): Promise<string> {
  const id = exercise.id ?? newId()
  await db.exercises.put({ ...exercise, id })
  return id
}

/**
 * Remove an exercise from the library and from every plan day.
 * Logged sets are kept, so history and personal bests are not lost.
 */
export async function deleteExercise(id: string): Promise<void> {
  await db.transaction('rw', db.exercises, db.planDays, async () => {
    if (id.startsWith('#')) {
      // Built-in: hide it (see `archived` in ./types.ts for why).
      await db.exercises.update(id, { archived: true })
    } else {
      await db.exercises.delete(id)
    }
    const days = await db.planDays.toArray()
    for (const day of days) {
      if (day.picks.some((pick) => pick.exerciseId === id)) {
        await db.planDays.update(day.id, { picks: day.picks.filter((pick) => pick.exerciseId !== id) })
      }
    }
  })
}

// ── Weekly plan ──────────────────────────────────────────────────────────

export async function updatePlanDay(id: string, changes: Partial<Omit<PlanDay, 'id' | 'weekday'>>): Promise<void> {
  await db.planDays.update(id, changes)
}

/** IDs of exercises that are in `before` but not in `after`. */
function replacedIds(before: PlanDay['picks'], after: PlanDay['picks']): string[] {
  const kept = new Set(after.map((pick) => pick.exerciseId))
  return before.map((pick) => pick.exerciseId).filter((exerciseId) => !kept.has(exerciseId))
}

/** Re-roll every unpinned exercise of one day. */
export async function reshuffleDay(day: PlanDay, exercises: Exercise[]): Promise<void> {
  const picks = shuffleDay(day, exercises)
  await db.planDays.update(day.id, { picks, lastPickIds: replacedIds(day.picks, picks) })
}

/** Re-roll every unpinned exercise of every day. */
export async function reshuffleWeek(days: PlanDay[], exercises: Exercise[]): Promise<void> {
  await db.transaction('rw', db.planDays, async () => {
    for (const day of days) await reshuffleDay(day, exercises)
  })
}

/**
 * Change how many exercises a day has, keeping the ones already there.
 * Growing adds new exercises by the usual shuffle rules; shrinking removes
 * unpinned exercises from the end (pinned ones are never removed here).
 */
export async function resizeDay(day: PlanDay, count: number, exercises: Exercise[]): Promise<void> {
  let picks = day.picks
  if (picks.length > count) {
    const surplus = picks.length - count
    // Walk backwards, dropping unpinned picks until enough are gone.
    let dropped = 0
    picks = [...picks]
      .reverse()
      .filter((pick) => pick.pinned || dropped++ >= surplus)
      .reverse()
  } else if (picks.length < count) {
    // Shuffle with every current pick temporarily pinned, so only the empty
    // slots are filled, then give the original picks their real pin state back.
    const wasPinned = new Map(picks.map((pick) => [pick.exerciseId, pick.pinned]))
    const frozen = { ...day, count, picks: picks.map((pick) => ({ ...pick, pinned: true })) }
    picks = shuffleDay(frozen, exercises).map((pick) => ({
      ...pick,
      pinned: wasPinned.get(pick.exerciseId) ?? false,
    }))
  }
  await db.planDays.update(day.id, { count, picks })
}

/** Change a day's workout types (or shuffle style) and re-roll its unpinned exercises to match. */
export async function retargetDay(
  day: PlanDay,
  changes: Partial<Pick<PlanDay, 'types' | 'style'>>,
  exercises: Exercise[],
): Promise<void> {
  const next = { ...day, ...changes }
  const picks = shuffleDay(next, exercises)
  await db.planDays.update(day.id, { ...changes, picks, lastPickIds: replacedIds(day.picks, picks) })
}

/**
 * Add `delta` sets (negative to remove) to the target of the exercise at
 * `index`, keeping the result between `min` and `max`.
 *
 * The current value is read inside the same transaction as the write.
 * Passing a new value computed on screen instead would lose taps: two quick
 * taps would both start from the same old number before the screen had
 * redrawn.
 */
export async function adjustPickSets(
  dayId: string,
  index: number,
  delta: number,
  { min = 1, max = 20 }: { min?: number; max?: number } = {},
): Promise<void> {
  await db.transaction('rw', db.planDays, async () => {
    const day = await db.planDays.get(dayId)
    const pick = day?.picks[index]
    if (!day || !pick) return
    const sets = Math.min(max, Math.max(min, pick.sets + delta))
    if (sets === pick.sets) return
    await db.planDays.update(dayId, { picks: day.picks.map((p, i) => (i === index ? { ...p, sets } : p)) })
  })
}

/** Replace the single exercise at `index` in a day. */
export async function swapDayPick(day: PlanDay, index: number, exercises: Exercise[]): Promise<void> {
  const picks = swapPick(day, index, exercises)
  // Remember the swapped-out exercise too, so it does not come straight back.
  const lastPickIds = [...new Set([...day.lastPickIds, ...replacedIds(day.picks, picks)])]
  await db.planDays.update(day.id, { picks, lastPickIds })
}

// ── Set logs ─────────────────────────────────────────────────────────────

export async function logSet(entry: Omit<SetLog, 'id' | 'at'>): Promise<void> {
  await db.setLogs.add({ ...entry, id: newId(), at: Date.now() })
}

export async function deleteSetLog(id: string): Promise<void> {
  await db.setLogs.delete(id)
}

// ── Workout lifecycle ────────────────────────────────────────────────────
//
// A workout moves through these states (see the Today screen):
//
//   not started --Start--> in progress <--Pause/Resume--> paused
//   in progress or paused --Finish--> finished (a WorkoutSession is saved)
//   in progress or paused --Reset---> not started (its sets are deleted)
//
// "In progress" means sets have been logged since the day's last finished
// workout, or the workout clock is running on this device.

/**
 * Finish the workout in progress: save a summary (see WorkoutSession in
 * ./types.ts) and stop all timers. The sets were already saved as they were
 * logged; this marks them as one completed workout.
 *
 * Returns false, saving nothing, if no sets were logged.
 */
export async function finishWorkout(title: string, date: string = dateKey()): Promise<boolean> {
  const [logs, sessions] = await Promise.all([
    db.setLogs.where('date').equals(date).toArray(),
    db.sessions.where('date').equals(date).toArray(),
  ])
  const sets = inProgressLogs(logs, sessions)
  const clock = getTimers().workout
  const now = Date.now()
  endWorkoutTimers()
  if (sets.length === 0) return false

  const times = sets.map((log) => log.at)
  const clockToday = clock?.date === date ? clock : undefined
  await db.sessions.add({
    id: newId(),
    date,
    title,
    startedAt: Math.min(clockToday?.startedAt ?? Infinity, ...times),
    finishedAt: now,
    // With no clock on this device (sets logged on another device), the
    // best estimate is the span from the first set to the last.
    activeSeconds: Math.round(
      (clockToday ? workoutElapsedMs(clockToday, now) : Math.max(...times) - Math.min(...times)) / 1000,
    ),
    setCount: sets.length,
    exerciseCount: new Set(sets.map((log) => log.exerciseId)).size,
  })
  return true
}

/**
 * Cancel the workout in progress: delete the sets logged in it and stop all
 * timers. Sets from workouts already finished today are not touched.
 * Returns how many sets were deleted.
 */
export async function resetWorkout(date: string = dateKey()): Promise<number> {
  endWorkoutTimers()
  return db.transaction('rw', db.setLogs, db.sessions, async () => {
    const [logs, sessions] = await Promise.all([
      db.setLogs.where('date').equals(date).toArray(),
      db.sessions.where('date').equals(date).toArray(),
    ])
    const sets = inProgressLogs(logs, sessions)
    await db.setLogs.bulkDelete(sets.map((log) => log.id))
    return sets.length
  })
}

// ── Body weight ──────────────────────────────────────────────────────────

/** Record body weight for a day. A second entry on the same day replaces the first. */
export async function saveBodyWeight(date: string, weightKg: number): Promise<void> {
  await db.transaction('rw', db.bodyWeights, async () => {
    const existing = await db.bodyWeights.where('date').equals(date).first()
    await db.bodyWeights.put({ id: existing?.id ?? newId(), date, weightKg })
  })
}

export async function deleteBodyWeight(id: string): Promise<void> {
  await db.bodyWeights.delete(id)
}
