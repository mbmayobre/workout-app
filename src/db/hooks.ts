/**
 * Hooks: how screens READ stored data.
 *
 * Each hook wraps Dexie's `useLiveQuery`, which runs a database query and
 * re-runs it automatically whenever the data it touched changes, whether
 * the change came from this screen, another screen, or a sync from another
 * device. Screens therefore never need to "refresh" anything by hand.
 *
 * While a query is still loading, `useLiveQuery` returns `undefined`. Hooks
 * here either pass that through (so a screen can show nothing until ready)
 * or substitute a safe default, as noted on each one.
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from './db'
import { defaultSettings, SETTINGS_ID } from './seed'
import type { BodyWeightEntry, Exercise, PlanDay, SetLog, Settings } from './types'

/** App settings. Returns the defaults until the real ones have loaded. */
export function useSettings(): Settings {
  return useLiveQuery(() => db.settings.get(SETTINGS_ID)) ?? defaultSettings
}

/** Every exercise, including archived ones (needed to name old logs), sorted by name. */
export function useAllExercises(): Exercise[] | undefined {
  return useLiveQuery(() => db.exercises.orderBy('name').toArray())
}

/** Lookup table from exercise ID to exercise. Empty until loaded. */
export function useExerciseMap(): Map<string, Exercise> {
  const exercises = useAllExercises()
  return useMemo(() => new Map((exercises ?? []).map((exercise) => [exercise.id, exercise])), [exercises])
}

/** The seven plan days, Sunday (0) first. */
export function usePlanDays(): PlanDay[] | undefined {
  return useLiveQuery(() => db.planDays.orderBy('weekday').toArray())
}

export function usePlanDay(weekday: number): PlanDay | undefined {
  return useLiveQuery(() => db.planDays.where('weekday').equals(weekday).first(), [weekday])
}

/** Sets logged for one exercise on one day, oldest first. */
export function useSetLogsOn(exerciseId: string | undefined, date: string): SetLog[] | undefined {
  return useLiveQuery(
    () => (exerciseId ? db.setLogs.where('[exerciseId+date]').equals([exerciseId, date]).sortBy('at') : []),
    [exerciseId, date],
  )
}

/** Every set ever logged for one exercise, oldest first. */
export function useExerciseLogs(exerciseId: string | undefined): SetLog[] | undefined {
  return useLiveQuery(
    () => (exerciseId ? db.setLogs.where('exerciseId').equals(exerciseId).sortBy('at') : []),
    [exerciseId],
  )
}

/** All sets logged on one day (any exercise). */
export function useDayLogs(date: string): SetLog[] | undefined {
  return useLiveQuery(() => db.setLogs.where('date').equals(date).toArray(), [date])
}

/** Every set log. Used by the Progress screen to compute personal bests. */
export function useAllLogs(): SetLog[] | undefined {
  return useLiveQuery(() => db.setLogs.orderBy('date').toArray())
}

/** Body-weight entries, oldest first. */
export function useBodyWeights(): BodyWeightEntry[] | undefined {
  return useLiveQuery(() => db.bodyWeights.orderBy('date').toArray())
}
