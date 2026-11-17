/**
 * Built-in starting data: the exercise library, a default weekly plan, and
 * default settings. ./db.ts adds any of these that are missing each time the
 * database opens.
 *
 * To add a built-in exercise, append a line to `seedExercises`. Pick a new,
 * unique slug (the first argument); it becomes the permanent ID, so do not
 * rename slugs of exercises that have already shipped.
 */
import { shuffleDay } from '../lib/shuffle'
import type {
  DayType,
  Equipment,
  Exercise,
  ExerciseKind,
  MuscleGroup,
  PlanDay,
  Settings,
} from './types'

/** Optional fields when declaring a seed exercise; anything omitted gets a sensible default. */
type SeedOptions = Partial<
  Pick<Exercise, 'fullBody' | 'logMode' | 'weightUnit' | 'defaultSets' | 'defaultReps' | 'defaultSeconds'>
>

/** Compact constructor so the list below reads like a table. */
function ex(
  slug: string,
  name: string,
  kind: ExerciseKind,
  equipment: Equipment,
  primary: MuscleGroup[],
  secondary: MuscleGroup[] = [],
  options: SeedOptions = {},
): Exercise {
  return {
    id: `#ex-${slug}`,
    name,
    kind,
    equipment,
    primary,
    secondary,
    fullBody: false,
    // Cardio is always timed; everything else counts reps unless stated.
    logMode: kind === 'cardio' ? 'time' : 'reps',
    defaultSets: kind === 'cardio' ? 1 : 3,
    defaultReps: 10,
    defaultSeconds: kind === 'cardio' ? 15 * 60 : 30,
    ...options,
  }
}

/** Kettlebells are labelled in kilograms, so kettlebell exercises default to kg. */
const kb = { weightUnit: 'kg' } as const

export const seedExercises: Exercise[] = [
  // ── Chest ────────────────────────────────────────────────────────────
  ex('bench-press', 'Bench press', 'strength', 'barbell', ['chest'], ['arms', 'shoulders'], { defaultSets: 4, defaultReps: 8 }),
  ex('incline-db-press', 'Incline dumbbell press', 'strength', 'dumbbell', ['chest'], ['shoulders', 'arms']),
  ex('db-bench-press', 'Dumbbell bench press', 'strength', 'dumbbell', ['chest'], ['arms', 'shoulders']),
  ex('cable-fly', 'Cable fly', 'strength', 'cable', ['chest'], [], { defaultReps: 12 }),
  ex('pec-deck', 'Pec deck', 'strength', 'machine', ['chest'], [], { defaultReps: 12 }),
  ex('chest-dip', 'Chest dip', 'bodyweight', 'bodyweight', ['chest'], ['arms', 'shoulders']),
  ex('push-up', 'Push-up', 'bodyweight', 'bodyweight', ['chest'], ['arms', 'core'], { defaultReps: 15 }),
  ex('decline-push-up', 'Decline push-up', 'bodyweight', 'bodyweight', ['chest'], ['shoulders', 'arms'], { defaultReps: 12 }),

  // ── Back ─────────────────────────────────────────────────────────────
  ex('deadlift', 'Deadlift', 'strength', 'barbell', ['back', 'legs'], ['core'], { defaultReps: 5 }),
  ex('barbell-row', 'Barbell row', 'strength', 'barbell', ['back'], ['arms'], { defaultReps: 8 }),
  ex('db-row', 'One-arm dumbbell row', 'strength', 'dumbbell', ['back'], ['arms']),
  ex('lat-pulldown', 'Lat pulldown', 'strength', 'cable', ['back'], ['arms']),
  ex('seated-cable-row', 'Seated cable row', 'strength', 'cable', ['back'], ['arms']),
  ex('pull-up', 'Pull-up', 'bodyweight', 'bodyweight', ['back'], ['arms'], { defaultReps: 8 }),
  ex('chin-up', 'Chin-up', 'bodyweight', 'bodyweight', ['back', 'arms'], [], { defaultReps: 8 }),
  ex('face-pull', 'Face pull', 'strength', 'cable', ['back', 'shoulders'], [], { defaultReps: 15 }),

  // ── Legs ─────────────────────────────────────────────────────────────
  ex('squat', 'Squat', 'strength', 'barbell', ['legs'], ['core'], { defaultSets: 4, defaultReps: 6 }),
  ex('romanian-deadlift', 'Romanian deadlift', 'strength', 'barbell', ['legs'], ['back'], { defaultReps: 8 }),
  ex('leg-press', 'Leg press', 'strength', 'machine', ['legs']),
  ex('walking-lunge', 'Walking lunge', 'strength', 'dumbbell', ['legs'], ['core'], { defaultReps: 12 }),
  ex('bulgarian-split-squat', 'Bulgarian split squat', 'strength', 'dumbbell', ['legs'], ['core']),
  ex('leg-curl', 'Leg curl', 'strength', 'machine', ['legs'], [], { defaultReps: 12 }),
  ex('leg-extension', 'Leg extension', 'strength', 'machine', ['legs'], [], { defaultReps: 12 }),
  ex('calf-raise', 'Calf raise', 'strength', 'machine', ['legs'], [], { defaultReps: 15 }),
  ex('bodyweight-squat', 'Bodyweight squat', 'bodyweight', 'bodyweight', ['legs'], [], { defaultReps: 20 }),

  // ── Shoulders ────────────────────────────────────────────────────────
  ex('overhead-press', 'Overhead press', 'strength', 'barbell', ['shoulders'], ['arms', 'core'], { defaultReps: 8 }),
  ex('db-shoulder-press', 'Dumbbell shoulder press', 'strength', 'dumbbell', ['shoulders'], ['arms']),
  ex('lateral-raise', 'Lateral raise', 'strength', 'dumbbell', ['shoulders'], [], { defaultReps: 15 }),
  ex('rear-delt-fly', 'Rear delt fly', 'strength', 'dumbbell', ['shoulders'], ['back'], { defaultReps: 15 }),
  ex('pike-push-up', 'Pike push-up', 'bodyweight', 'bodyweight', ['shoulders'], ['arms']),

  // ── Arms ─────────────────────────────────────────────────────────────
  ex('barbell-curl', 'Barbell curl', 'strength', 'barbell', ['arms']),
  ex('hammer-curl', 'Hammer curl', 'strength', 'dumbbell', ['arms'], [], { defaultReps: 12 }),
  ex('incline-db-curl', 'Incline dumbbell curl', 'strength', 'dumbbell', ['arms'], [], { defaultReps: 12 }),
  ex('triceps-pushdown', 'Triceps pushdown', 'strength', 'cable', ['arms'], [], { defaultReps: 12 }),
  ex('skull-crusher', 'Skull crusher', 'strength', 'barbell', ['arms']),
  ex('overhead-triceps-ext', 'Overhead triceps extension', 'strength', 'dumbbell', ['arms'], [], { defaultReps: 12 }),
  ex('close-grip-bench', 'Close-grip bench press', 'strength', 'barbell', ['arms'], ['chest'], { defaultReps: 8 }),
  ex('bench-dip', 'Bench dip', 'bodyweight', 'bodyweight', ['arms'], ['chest'], { defaultReps: 12 }),

  // ── Core ─────────────────────────────────────────────────────────────
  ex('plank', 'Plank', 'bodyweight', 'bodyweight', ['core'], [], { logMode: 'time', defaultSeconds: 45 }),
  ex('side-plank', 'Side plank', 'bodyweight', 'bodyweight', ['core'], [], { logMode: 'time', defaultSeconds: 30 }),
  ex('hanging-leg-raise', 'Hanging leg raise', 'bodyweight', 'bodyweight', ['core'], [], { defaultReps: 12 }),
  ex('cable-crunch', 'Cable crunch', 'strength', 'cable', ['core'], [], { defaultReps: 15 }),
  ex('russian-twist', 'Russian twist', 'bodyweight', 'bodyweight', ['core'], [], { defaultReps: 20 }),
  ex('ab-wheel', 'Ab wheel rollout', 'bodyweight', 'other', ['core'], ['shoulders']),
  ex('dead-bug', 'Dead bug', 'bodyweight', 'bodyweight', ['core'], [], { defaultReps: 12 }),

  // ── Kettlebell (equipment, spanning several muscle groups) ───────────
  ex('kb-swing', 'Kettlebell swing', 'strength', 'kettlebell', ['legs', 'back'], ['core', 'shoulders'], { ...kb, defaultReps: 15 }),
  ex('kb-goblet-squat', 'Goblet squat', 'strength', 'kettlebell', ['legs'], ['core'], kb),
  ex('kb-turkish-get-up', 'Turkish get-up', 'strength', 'kettlebell', ['shoulders', 'core'], ['legs', 'arms'], { ...kb, fullBody: true, defaultReps: 3 }),
  ex('kb-clean-and-press', 'Kettlebell clean and press', 'strength', 'kettlebell', ['shoulders', 'legs'], ['back', 'arms', 'core'], { ...kb, fullBody: true, defaultReps: 6 }),
  ex('kb-snatch', 'Kettlebell snatch', 'strength', 'kettlebell', ['shoulders', 'back', 'legs'], ['core'], { ...kb, fullBody: true, defaultReps: 8 }),
  ex('kb-thruster', 'Kettlebell thruster', 'strength', 'kettlebell', ['legs', 'shoulders'], ['core', 'arms'], { ...kb, fullBody: true }),
  ex('kb-row', 'Kettlebell row', 'strength', 'kettlebell', ['back'], ['arms'], kb),
  ex('kb-floor-press', 'Kettlebell floor press', 'strength', 'kettlebell', ['chest'], ['arms'], kb),
  ex('kb-halo', 'Kettlebell halo', 'strength', 'kettlebell', ['shoulders'], ['core', 'arms'], kb),
  ex('kb-windmill', 'Kettlebell windmill', 'strength', 'kettlebell', ['core'], ['shoulders', 'legs'], { ...kb, defaultReps: 6 }),
  ex('kb-farmers-carry', "Farmer's carry", 'strength', 'kettlebell', ['arms', 'core'], ['back', 'legs'], { ...kb, logMode: 'time', defaultSeconds: 40 }),
  ex('kb-curl', 'Kettlebell curl', 'strength', 'kettlebell', ['arms'], [], kb),

  // ── Other whole-body moves ───────────────────────────────────────────
  ex('burpee', 'Burpee', 'bodyweight', 'bodyweight', ['legs', 'chest'], ['core', 'shoulders', 'arms'], { fullBody: true, defaultReps: 12 }),
  ex('db-thruster', 'Dumbbell thruster', 'strength', 'dumbbell', ['legs', 'shoulders'], ['core', 'arms'], { fullBody: true }),
  ex('renegade-row', 'Renegade row', 'strength', 'dumbbell', ['back', 'core'], ['chest', 'arms']),

  // ── Cardio ───────────────────────────────────────────────────────────
  ex('run', 'Running', 'cardio', 'cardio', [], [], { defaultSeconds: 20 * 60 }),
  ex('treadmill', 'Treadmill', 'cardio', 'cardio', [], [], { defaultSeconds: 20 * 60 }),
  ex('rowing-machine', 'Rowing machine', 'cardio', 'cardio', [], []),
  ex('cycling', 'Cycling', 'cardio', 'cardio', [], [], { defaultSeconds: 30 * 60 }),
  ex('stair-climber', 'Stair climber', 'cardio', 'cardio', [], []),
  ex('elliptical', 'Elliptical', 'cardio', 'cardio', [], [], { defaultSeconds: 20 * 60 }),
  ex('jump-rope', 'Jump rope', 'cardio', 'cardio', [], [], { defaultSeconds: 10 * 60 }),
]

/** The default week. Sunday is index 0 to match Date.getDay(). */
const defaultWeek: { types: DayType[]; count: number }[] = [
  { types: [], count: 4 }, // Sun: rest
  { types: ['chest'], count: 4 }, // Mon
  { types: ['back'], count: 4 }, // Tue
  { types: [], count: 4 }, // Wed: rest
  { types: ['legs'], count: 5 }, // Thu
  { types: ['shoulders', 'arms'], count: 5 }, // Fri
  { types: ['fullBody', 'cardio'], count: 6 }, // Sat
]

/** The seven plan days, each pre-filled with a first shuffle so Today is never empty. */
export const seedPlanDays: PlanDay[] = defaultWeek.map((day, weekday) => {
  const planDay: PlanDay = {
    id: `#day-${weekday}`,
    weekday,
    types: day.types,
    count: day.count,
    style: 'balanced',
    picks: [],
    lastPickIds: [],
  }
  planDay.picks = shuffleDay(planDay, seedExercises)
  return planDay
})

export const SETTINGS_ID = '#settings'

export const defaultSettings: Settings = {
  id: SETTINGS_ID,
  weightUnit: 'lb',
  distanceUnit: 'km',
  restSeconds: 90,
  autoRest: true,
  sound: true,
}
