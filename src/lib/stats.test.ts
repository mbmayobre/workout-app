/** Tests for workout-lifecycle helpers. Run with `npm test`. */
import { describe, expect, it } from 'vitest'
import type { SetLog, WorkoutSession } from '../db/types'
import { inProgressLogs } from './stats'
import { workoutElapsedMs } from './timers'

const log = (at: number): SetLog => ({ id: `log-${at}`, exerciseId: '#ex-squat', date: '2026-11-17', at, reps: 5 })
const session = (finishedAt: number): WorkoutSession => ({
  id: `s-${finishedAt}`,
  date: '2026-11-17',
  title: 'Legs',
  startedAt: 0,
  finishedAt,
  activeSeconds: 0,
  setCount: 0,
  exerciseCount: 0,
})

describe('inProgressLogs', () => {
  it('treats every set as in progress when nothing has been finished today', () => {
    expect(inProgressLogs([log(10), log(20)], [])).toHaveLength(2)
  })

  it('keeps only sets logged after the latest finished workout', () => {
    const logs = [log(10), log(20), log(40), log(50)]
    expect(inProgressLogs(logs, [session(15), session(30)]).map((entry) => entry.at)).toEqual([40, 50])
  })
})

describe('workoutElapsedMs', () => {
  it('counts time since the start while running', () => {
    expect(workoutElapsedMs({ date: 'd', startedAt: 1000 }, 61_000)).toBe(60_000)
  })

  it('stops counting while paused and leaves out earlier pauses', () => {
    const clock = { date: 'd', startedAt: 0, pausedAt: 50_000, pausedMs: 10_000 }
    // Paused at 50s after 10s of earlier pauses: 40s of work, however late it is now.
    expect(workoutElapsedMs(clock, 999_000)).toBe(40_000)
  })
})
