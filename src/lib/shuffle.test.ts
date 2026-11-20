/**
 * Tests for the shuffle rules. Run with `npm test`.
 *
 * Each test uses the real seed library and loops over many random seeds, so
 * a rule has to hold for every outcome, not just one lucky draw.
 */
import { describe, expect, it } from 'vitest'
import { seedExercises } from '../db/seed'
import type { DayType, PlanDay, ShuffleStyle } from '../db/types'
import { coverageSummary, seededRng, shuffleDay, swapPick } from './shuffle'

const byId = new Map(seedExercises.map((exercise) => [exercise.id, exercise]))
const SEEDS = Array.from({ length: 50 }, (_, index) => index + 1)

function makeDay(types: DayType[], count: number, style: ShuffleStyle = 'balanced'): PlanDay {
  return { id: '#day-test', weekday: 1, types, count, style, picks: [], lastPickIds: [] }
}

/** Shuffle a day and return the chosen exercises. */
function run(day: PlanDay, seed: number) {
  return shuffleDay(day, seedExercises, seededRng(seed)).map((pick) => byId.get(pick.exerciseId)!)
}

describe('shuffleDay', () => {
  it('returns nothing for a rest day', () => {
    expect(shuffleDay(makeDay([], 4), seedExercises)).toEqual([])
  })

  it('fills a muscle-group day with distinct exercises that primarily train that group', () => {
    for (const seed of SEEDS) {
      const chosen = run(makeDay(['chest'], 4), seed)
      expect(chosen).toHaveLength(4)
      expect(new Set(chosen.map((e) => e.id)).size).toBe(4)
      expect(chosen.every((e) => e.primary.includes('chest'))).toBe(true)
    }
  })

  it('gives different results for different random seeds', () => {
    const results = new Set(SEEDS.map((seed) => run(makeDay(['chest'], 4), seed).map((e) => e.id).join()))
    expect(results.size).toBeGreaterThan(5)
  })

  it('covers both groups on a two-group day', () => {
    for (const seed of SEEDS) {
      const chosen = run(makeDay(['shoulders', 'arms'], 4), seed)
      expect(chosen.some((e) => e.primary.includes('shoulders'))).toBe(true)
      expect(chosen.some((e) => e.primary.includes('arms'))).toBe(true)
    }
  })

  it('keeps pinned picks and never duplicates them', () => {
    for (const seed of SEEDS) {
      const day = makeDay(['legs'], 5)
      day.picks = [{ exerciseId: '#ex-squat', pinned: true, sets: 5, reps: 5, seconds: 30 }]
      const picks = shuffleDay(day, seedExercises, seededRng(seed))
      expect(picks).toHaveLength(5)
      // The pinned pick is kept exactly, including its custom sets and reps.
      expect(picks.filter((pick) => pick.exerciseId === '#ex-squat')).toEqual([day.picks[0]])
    }
  })

  it('keeps pinned picks at the position they were in', () => {
    for (const seed of SEEDS) {
      const day = makeDay(['back'], 4)
      day.picks = shuffleDay(day, seedExercises, seededRng(seed))
      // Pin the third exercise, as if it had been dragged there and pinned.
      day.picks[2] = { ...day.picks[2], pinned: true }
      const after = shuffleDay(day, seedExercises, seededRng(seed + 500))
      expect(after).toHaveLength(4)
      expect(after[2]).toEqual(day.picks[2])
    }
  })

  it('avoids the exercises the day had before, when the pool allows', () => {
    for (const seed of SEEDS) {
      const day = makeDay(['chest'], 4)
      day.picks = shuffleDay(day, seedExercises, seededRng(seed))
      const before = new Set(day.picks.map((pick) => pick.exerciseId))
      const after = shuffleDay(day, seedExercises, seededRng(seed + 1000))
      // There are more than 8 chest exercises, so a full change is possible.
      expect(after.some((pick) => before.has(pick.exerciseId))).toBe(false)
    }
  })

  it('uses only kettlebell exercises on a kettlebell day', () => {
    for (const seed of SEEDS) {
      const chosen = run(makeDay(['kettlebell'], 5), seed)
      expect(chosen).toHaveLength(5)
      expect(chosen.every((e) => e.equipment === 'kettlebell')).toBe(true)
    }
  })

  it('combines kettlebell with a muscle group as a filter', () => {
    for (const seed of SEEDS) {
      const chosen = run(makeDay(['legs', 'kettlebell'], 3), seed)
      expect(chosen.length).toBeGreaterThan(0)
      expect(chosen.every((e) => e.equipment === 'kettlebell' && e.primary.includes('legs'))).toBe(true)
    }
  })

  it('makes every slot cardio on a cardio-only day', () => {
    const chosen = run(makeDay(['cardio'], 2), 1)
    expect(chosen).toHaveLength(2)
    expect(chosen.every((e) => e.kind === 'cardio')).toBe(true)
  })

  it('adds exactly one cardio exercise, last, when cardio is combined', () => {
    for (const seed of SEEDS) {
      const chosen = run(makeDay(['fullBody', 'cardio'], 6), seed)
      expect(chosen).toHaveLength(6)
      expect(chosen.filter((e) => e.kind === 'cardio')).toHaveLength(1)
      expect(chosen[5].kind).toBe('cardio')
    }
  })
})

describe('full-body coverage', () => {
  it('covers all six muscle groups with 5 or more exercises, in every style', () => {
    for (const style of ['balanced', 'compound', 'focused'] as const) {
      for (const seed of SEEDS) {
        const picks = shuffleDay(makeDay(['fullBody'], 6, style), seedExercises, seededRng(seed))
        expect(coverageSummary(picks, seedExercises).missing).toEqual([])
      }
    }
  })

  it('covers at least five groups with only 2 exercises, by choosing compound moves', () => {
    for (const seed of SEEDS) {
      const picks = shuffleDay(makeDay(['fullBody'], 2), seedExercises, seededRng(seed))
      expect(coverageSummary(picks, seedExercises).covered.length).toBeGreaterThanOrEqual(5)
    }
  })

  it('"focused" picks narrower exercises than "compound" when there is room', () => {
    // Average number of primary muscle groups per chosen exercise.
    const breadth = (style: ShuffleStyle) => {
      const all = SEEDS.flatMap((seed) => run(makeDay(['fullBody'], 7, style), seed))
      return all.reduce((sum, e) => sum + e.primary.length, 0) / all.length
    }
    expect(breadth('focused')).toBeLessThan(breadth('compound'))
  })
})

describe('swapPick', () => {
  it('replaces only the chosen slot with a different, unused exercise', () => {
    for (const seed of SEEDS) {
      const day = makeDay(['back'], 4)
      day.picks = shuffleDay(day, seedExercises, seededRng(seed))
      const after = swapPick(day, 2, seedExercises, seededRng(seed + 1))

      expect(after).toHaveLength(4)
      expect(after[2].exerciseId).not.toBe(day.picks[2].exerciseId)
      expect(after.filter((_, i) => i !== 2)).toEqual(day.picks.filter((_, i) => i !== 2))
      expect(new Set(after.map((pick) => pick.exerciseId)).size).toBe(4)
    }
  })

  it('swaps cardio for cardio', () => {
    const day = makeDay(['fullBody', 'cardio'], 4)
    day.picks = shuffleDay(day, seedExercises, seededRng(7))
    const after = swapPick(day, 3, seedExercises, seededRng(8))
    expect(byId.get(after[3].exerciseId)!.kind).toBe('cardio')
    expect(after[3].exerciseId).not.toBe(day.picks[3].exerciseId)
  })
})
