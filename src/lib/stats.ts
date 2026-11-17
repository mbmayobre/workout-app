/**
 * Progress calculations: turning raw set logs into "last time" lines,
 * personal bests, and chart points. Pure functions, no database access.
 */
import type { Exercise, SetLog, Settings } from '../db/types'
import { formatDistance, formatDuration, formatWeight, kgToUnit, metresToUnit, weightUnitFor } from './units'

/** One set as text: "185 lb × 8", "12 reps", "45s", "20 kg × 40s", "15:00 · 3.1 km". */
export function describeLog(log: SetLog, exercise: Exercise | undefined, settings: Settings): string {
  if (exercise?.kind === 'cardio') {
    const parts = [formatDuration(log.seconds ?? 0)]
    if (log.distanceM) parts.push(formatDistance(log.distanceM, settings.distanceUnit))
    if (log.calories) parts.push(`${log.calories} cal`)
    return parts.join(' · ')
  }
  const amount = log.seconds !== undefined ? `${log.seconds}s` : `${log.reps ?? 0}`
  if (log.weightKg !== undefined) {
    return `${formatWeight(log.weightKg, weightUnitFor(exercise, settings))} × ${amount}`
  }
  return log.seconds !== undefined ? amount : `${amount} reps`
}

/** The most recent log for each exercise. `logs` must be oldest first. */
export function lastLogByExercise(logs: SetLog[]): Map<string, SetLog> {
  const result = new Map<string, SetLog>()
  for (const log of logs) result.set(log.exerciseId, log) // later logs overwrite earlier ones
  return result
}

/** Logs grouped into sessions (one per calendar day), oldest session first. */
export function groupByDate(logs: SetLog[]): { date: string; logs: SetLog[] }[] {
  const groups = new Map<string, SetLog[]>()
  for (const log of logs) {
    const group = groups.get(log.date)
    if (group) group.push(log)
    else groups.set(log.date, [log])
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayLogs]) => ({ date, logs: dayLogs }))
}

/**
 * The number that best represents "how well did this set go" for an
 * exercise, used to find bests and draw the chart:
 *
 * - cardio:            distance if recorded, otherwise time
 * - weighted exercise: the weight
 * - timed exercise:    seconds held
 * - bodyweight reps:   reps
 */
export function logScore(log: SetLog, exercise: Exercise): number {
  if (exercise.kind === 'cardio') return log.seconds ?? 0
  if (log.weightKg !== undefined) return log.weightKg
  if (exercise.logMode === 'time') return log.seconds ?? 0
  return log.reps ?? 0
}

/**
 * The best set out of `logs`. Ties on the main number are broken by reps
 * (so 185 × 8 beats 185 × 6), then by which came first.
 */
export function bestLog(logs: SetLog[], exercise: Exercise): SetLog | undefined {
  let best: SetLog | undefined
  for (const log of logs) {
    if (!best) {
      best = log
      continue
    }
    const difference = logScore(log, exercise) - logScore(best, exercise)
    if (difference > 0 || (difference === 0 && (log.reps ?? 0) > (best.reps ?? 0))) best = log
  }
  return best
}

/** What the chart's vertical axis measures for an exercise, with its unit. */
export function chartMetric(exercise: Exercise, logs: SetLog[], settings: Settings): { label: string; unit: string } {
  if (exercise.kind === 'cardio') return { label: 'Time', unit: 'min' }
  if (logs.some((log) => log.weightKg !== undefined)) {
    return { label: 'Top weight', unit: weightUnitFor(exercise, settings) }
  }
  return exercise.logMode === 'time' ? { label: 'Longest hold', unit: 's' } : { label: 'Most reps', unit: 'reps' }
}

/** One chart point per session: the best score of that day, in display units. */
export function chartPoints(
  logs: SetLog[],
  exercise: Exercise,
  settings: Settings,
): { date: string; value: number }[] {
  return groupByDate(logs).map(({ date, logs: dayLogs }) => {
    const top = Math.max(...dayLogs.map((log) => logScore(log, exercise)))
    let value = top
    if (exercise.kind === 'cardio') value = top / 60
    else if (dayLogs.some((log) => log.weightKg !== undefined)) value = kgToUnit(top, weightUnitFor(exercise, settings))
    return { date, value: Number(value.toFixed(1)) }
  })
}

/** Total distance of a group of cardio logs, as text, or undefined if none was recorded. */
export function totalDistance(logs: SetLog[], settings: Settings): string | undefined {
  const metres = logs.reduce((sum, log) => sum + (log.distanceM ?? 0), 0)
  return metres > 0 ? `${Number(metresToUnit(metres, settings.distanceUnit).toFixed(2))} ${settings.distanceUnit}` : undefined
}
