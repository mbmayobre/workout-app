/**
 * Human-readable names for the values stored in the database.
 *
 * The database stores short codes ('fullBody', 'kg'); the screens show
 * labels ('Full body'). Keeping every label here means renaming something in
 * the UI is a one-line change that cannot break stored data.
 */
import type { DayType, Equipment, Exercise, MuscleGroup, PlanPick, ShuffleStyle } from '../db/types'
import { formatDuration } from './units'

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  legs: 'Legs',
  shoulders: 'Shoulders',
  arms: 'Arms',
  core: 'Core',
}

export const DAY_TYPE_LABELS: Record<DayType, string> = {
  ...MUSCLE_LABELS,
  fullBody: 'Full body',
  cardio: 'Cardio',
  kettlebell: 'Kettlebell',
}

/** The order day types appear in pickers and titles. */
export const DAY_TYPES: DayType[] = [
  'chest',
  'back',
  'legs',
  'shoulders',
  'arms',
  'core',
  'fullBody',
  'cardio',
  'kettlebell',
]

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  kettlebell: 'Kettlebell',
  cable: 'Cable',
  machine: 'Machine',
  bodyweight: 'Bodyweight',
  cardio: 'Cardio',
  other: 'Other',
}

export const STYLE_LABELS: Record<ShuffleStyle, string> = {
  balanced: 'Balanced',
  compound: 'More compound',
  focused: 'More focused',
}

/** Join words as a sentence list: ["Legs"] -> "Legs", three items -> "A, b, and c". */
export function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('')
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

/** Title for a plan day: "Chest", "Shoulders and arms", "Rest". */
export function dayTitle(types: DayType[]): string {
  if (types.length === 0) return 'Rest'
  const ordered = DAY_TYPES.filter((type) => types.includes(type))
  const words = ordered.map((type, index) =>
    index === 0 ? DAY_TYPE_LABELS[type] : DAY_TYPE_LABELS[type].toLowerCase(),
  )
  return joinList(words)
}

/** The target for a pick: "4 × 8", "3 × 45s", or "15:00" for cardio. */
export function targetLabel(pick: PlanPick, exercise: Exercise | undefined): string {
  if (exercise?.kind === 'cardio') return formatDuration(pick.seconds)
  if (exercise?.logMode === 'time') return `${pick.sets} × ${pick.seconds}s`
  return `${pick.sets} × ${pick.reps}`
}

/** One-line description of an exercise for list rows: "Barbell · Chest, arms". */
export function exerciseSubtitle(exercise: Exercise): string {
  if (exercise.kind === 'cardio') return 'Cardio · timed'
  const groups = [...exercise.primary, ...exercise.secondary].map((group) => MUSCLE_LABELS[group])
  const text = groups.map((label, index) => (index === 0 ? label : label.toLowerCase())).join(', ')
  return `${EQUIPMENT_LABELS[exercise.equipment]} · ${exercise.fullBody ? 'Full body' : text}`
}
