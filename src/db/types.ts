/**
 * Data model: the shape of everything the app stores.
 *
 * This file is types only (no code runs here). The tables that hold these
 * records are declared in ./db.ts. A longer walkthrough with examples lives
 * in docs/DATA-MODEL.md.
 *
 * Two conventions apply to every record:
 *
 * 1. IDs are strings. User-created records get a random UUID (see `newId` in
 *    ./db.ts). Built-in records (seed exercises, the seven plan days, the
 *    settings record) use fixed IDs that start with "#". Dexie Cloud treats a
 *    "#" ID as private to the signed-in user, so the same built-in record on
 *    two devices merges into one instead of duplicating.
 *
 * 2. Measurements are stored in ONE canonical unit and converted only for
 *    display: weight in kilograms, distance in metres, time in seconds. This
 *    is what lets you flip between lb and kg without touching history.
 *    Conversion helpers are in ../lib/units.ts.
 */

/** The six muscle groups exercises are categorised by. */
export type MuscleGroup = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core'

/** What you need to perform an exercise. Kettlebell is equipment, not a muscle group. */
export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'kettlebell'
  | 'cable'
  | 'machine'
  | 'bodyweight'
  | 'cardio'
  | 'other'

/**
 * - strength:   uses external weight; logs weight + reps (or weight + time).
 * - bodyweight: no external weight; logs reps (or time).
 * - cardio:     logs time, with optional distance and calories.
 */
export type ExerciseKind = 'strength' | 'bodyweight' | 'cardio'

/** Whether a set is counted in repetitions or in seconds (planks, carries, timed swings). */
export type LogMode = 'reps' | 'time'

export type WeightUnit = 'lb' | 'kg'
export type DistanceUnit = 'km' | 'mi'

export interface Exercise {
  id: string
  name: string
  kind: ExerciseKind
  equipment: Equipment
  /** Groups the exercise mainly trains. Shuffle matches a muscle-group day on these only. */
  primary: MuscleGroup[]
  /** Groups that assist. They count half towards full-body coverage. */
  secondary: MuscleGroup[]
  /** True for whole-body moves (Turkish get-up, thruster) that do not belong to one or two groups. */
  fullBody: boolean
  logMode: LogMode
  /**
   * Optional per-exercise unit that overrides the global setting. Kettlebells
   * are usually labelled in kg even where everything else is in lb.
   */
  weightUnit?: WeightUnit
  /** Starting targets used when the exercise is added to a day. */
  defaultSets: number
  defaultReps: number
  /** Target seconds per set (time mode) or total seconds (cardio). */
  defaultSeconds: number
  /**
   * Set when a BUILT-IN exercise is "deleted". Built-ins are hidden rather
   * than removed, because first-run setup would otherwise add them back, and
   * because old set logs still need the name. Exercises you created yourself
   * are deleted for real.
   */
  archived?: boolean
}

/**
 * What a plan day can be. A day can combine several, for example
 * ['fullBody', 'cardio'] or ['legs', 'kettlebell'].
 *
 * - a MuscleGroup: exercises whose primary groups include it
 * - 'fullBody':    exercises chosen to cover as many groups as possible
 * - 'cardio':      cardio exercises
 * - 'kettlebell':  an equipment filter: only kettlebell exercises
 *
 * An empty list means a rest day.
 */
export type DayType = MuscleGroup | 'fullBody' | 'cardio' | 'kettlebell'

/**
 * Preference for coverage-based shuffling (full-body and kettlebell days).
 * Coverage always comes first; this only decides between otherwise good options.
 */
export type ShuffleStyle = 'balanced' | 'compound' | 'focused'

/** One exercise slot inside a plan day. */
export interface PlanPick {
  exerciseId: string
  /** Pinned picks survive every shuffle. */
  pinned: boolean
  sets: number
  reps: number
  seconds: number
}

/** One of the seven days of the weekly plan. There are always exactly seven records. */
export interface PlanDay {
  /** Fixed: '#day-0' (Sunday) to '#day-6' (Saturday). */
  id: string
  /** 0 = Sunday … 6 = Saturday, matching JavaScript's Date.getDay(). */
  weekday: number
  types: DayType[]
  /** How many exercises the day should have. */
  count: number
  style: ShuffleStyle
  /** The current exercises. They stay the same until you shuffle or edit. */
  picks: PlanPick[]
  /**
   * Exercise IDs that were replaced by the most recent shuffle. The next
   * shuffle avoids them where it can, so consecutive weeks feel different.
   */
  lastPickIds: string[]
}

/**
 * One logged set (or one cardio effort).
 *
 * There is no separate "workout session" record. A workout is simply all the
 * set logs that share a `date`, which keeps the model small and makes the set
 * counter a plain count of today's logs for an exercise.
 */
export interface SetLog {
  id: string
  exerciseId: string
  /** Local calendar day, 'YYYY-MM-DD'. Used to group sets into workouts. */
  date: string
  /** Exact time the set was logged, in milliseconds since 1970. Used for ordering. */
  at: number
  /** Kilograms. Absent for bodyweight and cardio. */
  weightKg?: number
  reps?: number
  /** Duration in seconds (time-mode sets and cardio). */
  seconds?: number
  /** Metres (cardio, optional). */
  distanceM?: number
  calories?: number
}

/** One body-weight measurement. At most one per day (a second entry replaces the first). */
export interface BodyWeightEntry {
  id: string
  date: string
  weightKg: number
}

/** App-wide preferences. Exactly one record, with the fixed ID '#settings'. */
export interface Settings {
  id: string
  weightUnit: WeightUnit
  distanceUnit: DistanceUnit
  /** Default rest between sets, in seconds. */
  restSeconds: number
  /** Start the rest timer automatically when a set is logged. */
  autoRest: boolean
  /** Play a beep when a timer finishes. */
  sound: boolean
}
