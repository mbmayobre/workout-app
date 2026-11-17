/**
 * Shuffle: choosing which exercises fill a plan day.
 *
 * Everything here is a PURE function: it takes data in and returns new data,
 * and never touches the database or the screen. That makes the rules easy to
 * unit-test (see ./shuffle.test.ts). The plain-English version of these rules
 * is in docs/SHUFFLE.md; keep the two in step.
 *
 * Summary of the rules:
 *
 * 1. Pinned picks are never replaced.
 * 2. The candidate pool comes from the day's types:
 *      - muscle groups  -> exercises whose PRIMARY groups include one of them
 *      - 'fullBody'     -> every strength/bodyweight exercise
 *      - 'kettlebell'   -> an equipment filter applied on top of the above
 *                          (alone, it means "any kettlebell exercise")
 *      - 'cardio'       -> cardio exercises. Alone: every slot is cardio.
 *                          Combined with others: exactly one cardio slot.
 * 3. Strength slots are filled one at a time, each time taking an exercise
 *    that adds the most coverage of muscle groups not yet covered, with a
 *    random choice among near-equal options so results vary.
 * 4. Exercises replaced by the previous shuffle are avoided where possible.
 */
import type { DayType, Exercise, MuscleGroup, PlanDay, PlanPick, ShuffleStyle } from '../db/types'

export const MUSCLE_GROUPS: MuscleGroup[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core']

/** A source of random numbers in [0, 1). Math.random in the app; a seeded one in tests. */
export type Rng = () => number

// ── Scoring weights ──────────────────────────────────────────────────────
// Tuning knobs for the greedy selection. Coverage gain is measured in
// "muscle groups", so 1.0 means "one whole group newly covered".

/** How much a secondary muscle group counts towards coverage (primary = 1). */
const SECONDARY_WEIGHT = 0.5
/** Minimum coverage a whole-body exercise gives to EVERY group. */
const FULL_BODY_WEIGHT = 0.5
/** Score removed from exercises used in the previous version of the day. */
const REPEAT_PENALTY = 0.75
/**
 * Flat score given to every "good enough" candidate in balanced style. It is
 * higher than any possible coverage gain (at most 6), so these candidates
 * always outrank ones that do not finish a group.
 */
const BALANCED_SCORE = 10
/** Candidates within this much of the best score are treated as equally good. */
const TIE_TOLERANCE = 0.3

function isMuscleGroup(type: DayType): type is MuscleGroup {
  return (MUSCLE_GROUPS as string[]).includes(type)
}

/**
 * The muscle groups a day is trying to cover.
 * Full-body days and kettlebell-only days aim for all six.
 */
export function targetGroups(types: DayType[]): MuscleGroup[] {
  const groups = types.filter(isMuscleGroup)
  if (types.includes('fullBody')) return MUSCLE_GROUPS
  if (groups.length === 0 && types.includes('kettlebell')) return MUSCLE_GROUPS
  return groups
}

/** True for days where the "Covers N of 6 muscle groups" line is meaningful. */
export function showsCoverage(types: DayType[]): boolean {
  return targetGroups(types).length === MUSCLE_GROUPS.length
}

/** How many of the day's slots are cardio. */
function cardioSlots(types: DayType[], count: number): number {
  if (!types.includes('cardio')) return 0
  return types.length === 1 ? count : 1
}

/** Strength and bodyweight exercises that are allowed on this day. */
export function strengthPool(types: DayType[], exercises: Exercise[]): Exercise[] {
  const groups = types.filter(isMuscleGroup)
  const anyGroup = types.includes('fullBody') || (groups.length === 0 && types.includes('kettlebell'))
  if (!anyGroup && groups.length === 0) return [] // a cardio-only or rest day

  return exercises.filter((exercise) => {
    if (exercise.archived || exercise.kind === 'cardio') return false
    if (types.includes('kettlebell') && exercise.equipment !== 'kettlebell') return false
    return anyGroup || exercise.primary.some((group) => groups.includes(group))
  })
}

/**
 * How much one exercise contributes to each muscle group (0 to 1).
 *
 * With `primaryOnly`, secondary groups and the full-body flag count for
 * nothing. Muscle-group days use that mode: on a "shoulders and arms" day,
 * an overhead press (arms secondary) must not stand in for a real arms
 * exercise. Full-body days count everything, because there the aim is to
 * touch every group with as few exercises as possible.
 */
function contribution(exercise: Exercise, primaryOnly = false): Record<MuscleGroup, number> {
  const result = { chest: 0, back: 0, legs: 0, shoulders: 0, arms: 0, core: 0 }
  for (const group of MUSCLE_GROUPS) {
    if (exercise.primary.includes(group)) result[group] = 1
    else if (primaryOnly) continue
    else if (exercise.secondary.includes(group)) result[group] = SECONDARY_WEIGHT
    if (!primaryOnly && exercise.fullBody) result[group] = Math.max(result[group], FULL_BODY_WEIGHT)
  }
  return result
}

/** A fresh, unpinned pick using the exercise's default targets. */
export function makePick(exercise: Exercise): PlanPick {
  return {
    exerciseId: exercise.id,
    pinned: false,
    sets: exercise.defaultSets,
    reps: exercise.defaultReps,
    seconds: exercise.defaultSeconds,
  }
}

/** Pick one item at random. */
function randomItem<T>(items: T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)]
}

/**
 * Choose `howMany` strength exercises by greedy coverage.
 *
 * "Greedy" means: at each step take what looks best right now, given what
 * has already been chosen. It is not guaranteed to find the perfect
 * combination, but for a pool of a few dozen exercises it gets full coverage
 * whenever that is possible in practice, and it is simple to reason about.
 */
function chooseStrength(
  pool: Exercise[],
  alreadyChosen: Exercise[],
  howMany: number,
  targets: MuscleGroup[],
  style: ShuffleStyle,
  avoid: Set<string>,
  rng: Rng,
): Exercise[] {
  // Only days aiming for all six groups give credit for secondary muscles.
  const primaryOnly = targets.length < MUSCLE_GROUPS.length
  // Running total of how well each target group is covered, capped at 1.
  const coverage = new Map<MuscleGroup, number>(targets.map((group) => [group, 0]))
  const addCoverage = (exercise: Exercise) => {
    const adds = contribution(exercise, primaryOnly)
    for (const group of targets) {
      coverage.set(group, Math.min(1, coverage.get(group)! + adds[group]))
    }
  }
  alreadyChosen.forEach(addCoverage)

  const usedIds = new Set(alreadyChosen.map((exercise) => exercise.id))
  const chosen: Exercise[] = []

  for (let slot = 0; slot < howMany; slot++) {
    const candidates = pool.filter((exercise) => !usedIds.has(exercise.id))
    if (candidates.length === 0) break // the library has run out of options

    // Everything is covered: start a new round so extra slots are spread
    // evenly instead of all scoring zero.
    if (targets.every((group) => coverage.get(group)! >= 1)) {
      targets.forEach((group) => coverage.set(group, 0))
    }

    const uncovered = targets.filter((group) => coverage.get(group)! < 1).length
    // Slots left over after giving each uncovered group one slot of its own.
    // The style preference is only allowed to influence the choice while
    // there is slack; once every remaining slot is needed, coverage decides.
    const spare = howMany - slot - uncovered

    const scored = candidates.map((exercise) => {
      const adds = contribution(exercise, primaryOnly)
      // Coverage gain: how much closer this exercise brings the targets to
      // being fully covered.
      let gain = 0
      for (const group of targets) {
        const current = coverage.get(group)!
        gain += Math.min(1, current + adds[group]) - current
      }
      // How many uncovered groups this exercise would finish off completely.
      let completes = 0
      for (const group of targets) {
        const current = coverage.get(group)!
        if (current < 1 && current + adds[group] >= 1) completes++
      }
      let score = gain
      // Balanced, with a slot to spare for every uncovered group: any exercise
      // that finishes at least one group is as good as any other. Scoring them
      // equally gives a varied mix of compound and single-muscle exercises;
      // always taking the biggest gain would pick the same few whole-body
      // moves every week.
      if (style === 'balanced' && spare >= 0 && completes > 0) score = BALANCED_SCORE
      if (style === 'compound' && spare > 0) {
        score += 0.25 * exercise.primary.length + 0.1 * exercise.secondary.length
        if (exercise.fullBody) score += 0.5
      }
      if (style === 'focused' && spare >= 0) {
        score -= 0.6 * (exercise.primary.length - 1) + 0.2 * exercise.secondary.length
        if (exercise.fullBody) score -= 1
      }
      if (avoid.has(exercise.id)) score -= REPEAT_PENALTY
      return { exercise, score, gain }
    })

    // While any group is still uncovered, only consider exercises that make
    // progress on coverage. Without this, a style penalty could drag a useful
    // exercise down to the level of one that adds nothing.
    const useful = scored.filter((entry) => entry.gain > 0)
    const contenders = useful.length > 0 ? useful : scored
    const best = Math.max(...contenders.map((entry) => entry.score))
    const shortlist = contenders.filter((entry) => entry.score >= best - TIE_TOLERANCE)
    const pick = randomItem(shortlist, rng).exercise

    chosen.push(pick)
    usedIds.add(pick.id)
    addCoverage(pick)
  }
  return chosen
}

/** Choose `howMany` cardio exercises at random, avoiding recent ones where possible. */
function chooseCardio(
  exercises: Exercise[],
  usedIds: Set<string>,
  howMany: number,
  avoid: Set<string>,
  rng: Rng,
): Exercise[] {
  const chosen: Exercise[] = []
  for (let slot = 0; slot < howMany; slot++) {
    const available = exercises.filter(
      (exercise) => exercise.kind === 'cardio' && !exercise.archived && !usedIds.has(exercise.id),
    )
    if (available.length === 0) break
    const fresh = available.filter((exercise) => !avoid.has(exercise.id))
    const pick = randomItem(fresh.length > 0 ? fresh : available, rng)
    chosen.push(pick)
    usedIds.add(pick.id)
  }
  return chosen
}

/**
 * Re-roll a whole day: keep the pinned picks, replace the rest.
 *
 * Returns the new list of picks (strength first, cardio last). It does not
 * save anything; the caller writes the result to the database and records
 * the replaced exercise IDs in `lastPickIds` (see ../db/actions.ts).
 */
export function shuffleDay(day: PlanDay, exercises: Exercise[], rng: Rng = Math.random): PlanPick[] {
  if (day.types.length === 0) return [] // rest day

  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]))
  const isCardio = (pick: PlanPick) => byId.get(pick.exerciseId)?.kind === 'cardio'

  // Pinned picks whose exercise still exists are kept as they are.
  const kept = day.picks.filter((pick) => pick.pinned && byId.has(pick.exerciseId))
  const keptExercises = kept.map((pick) => byId.get(pick.exerciseId)!)

  // Avoid both what the day has now and what the previous shuffle replaced.
  const avoid = new Set([...day.lastPickIds, ...day.picks.filter((p) => !p.pinned).map((p) => p.exerciseId)])

  const cardioTarget = cardioSlots(day.types, day.count)
  const needCardio = Math.max(0, cardioTarget - kept.filter(isCardio).length)
  const needStrength = Math.max(0, day.count - cardioTarget - kept.filter((p) => !isCardio(p)).length)

  const strength = chooseStrength(
    strengthPool(day.types, exercises),
    keptExercises.filter((exercise) => exercise.kind !== 'cardio'),
    needStrength,
    targetGroups(day.types),
    day.style,
    avoid,
    rng,
  )
  const usedIds = new Set([...keptExercises, ...strength].map((exercise) => exercise.id))
  const cardio = chooseCardio(exercises, usedIds, needCardio, avoid, rng)

  const all = [...kept, ...strength.map(makePick), ...cardio.map(makePick)]
  // Stable sort: cardio goes to the end, everything else keeps its order.
  return [...all.filter((pick) => !isCardio(pick)), ...all.filter(isCardio)]
}

/**
 * Replace the single pick at `index`, leaving every other pick untouched.
 * The replacement is the same kind (strength or cardio) as the one removed.
 * Returns the picks unchanged if the library has nothing else to offer.
 */
export function swapPick(
  day: PlanDay,
  index: number,
  exercises: Exercise[],
  rng: Rng = Math.random,
): PlanPick[] {
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]))
  const outgoing = day.picks[index]
  if (!outgoing) return day.picks

  const others = day.picks.filter((_, i) => i !== index)
  const otherExercises = others.flatMap((pick) => byId.get(pick.exerciseId) ?? [])
  const usedIds = new Set([...otherExercises.map((exercise) => exercise.id), outgoing.exerciseId])
  const avoid = new Set(day.lastPickIds)

  const wasCardio = byId.get(outgoing.exerciseId)?.kind === 'cardio'
  let replacement: Exercise | undefined
  if (wasCardio) {
    replacement = chooseCardio(exercises, usedIds, 1, avoid, rng)[0]
  } else {
    // Exclude the outgoing exercise from the pool so it cannot be re-picked.
    const pool = strengthPool(day.types, exercises).filter((e) => e.id !== outgoing.exerciseId)
    replacement = chooseStrength(
      pool,
      otherExercises.filter((exercise) => exercise.kind !== 'cardio'),
      1,
      targetGroups(day.types),
      day.style,
      avoid,
      rng,
    )[0]
  }
  if (!replacement) return day.picks

  const result = [...day.picks]
  result[index] = makePick(replacement)
  return result
}

/**
 * Which muscle groups a set of picks covers, for the "Covers 5 of 6" line.
 * A group counts as covered when its total reaches 1: one exercise with it
 * as a primary group, or two that hit it as a secondary group.
 */
export function coverageSummary(
  picks: PlanPick[],
  exercises: Exercise[],
): { covered: MuscleGroup[]; missing: MuscleGroup[] } {
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]))
  const totals = { chest: 0, back: 0, legs: 0, shoulders: 0, arms: 0, core: 0 }
  for (const pick of picks) {
    const exercise = byId.get(pick.exerciseId)
    if (!exercise || exercise.kind === 'cardio') continue
    const adds = contribution(exercise)
    for (const group of MUSCLE_GROUPS) totals[group] += adds[group]
  }
  return {
    covered: MUSCLE_GROUPS.filter((group) => totals[group] >= 1),
    missing: MUSCLE_GROUPS.filter((group) => totals[group] < 1),
  }
}

/**
 * A small seeded random number generator ("mulberry32"). Given the same seed
 * it always produces the same sequence, which makes shuffle tests repeatable.
 * Not used in the app itself, which uses Math.random.
 */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
