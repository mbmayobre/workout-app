/**
 * Timers: the rest countdown, the stopwatch, and the workout clock.
 *
 * THE KEY IDEA: timers store timestamps, not a running count.
 *
 * A naive timer adds 1 every second. Phones pause JavaScript when the screen
 * locks or you switch apps, so that kind of timer falls behind. Instead we
 * store WHEN something started or ends (a clock time in milliseconds) and
 * work out the display from the current time whenever we draw:
 *
 *     remaining = endsAt - Date.now()
 *
 * The answer is correct no matter how long the page was asleep.
 *
 * State lives in `localStorage` rather than the database because it belongs
 * to this device only: a rest timer running on your phone should not appear
 * on your desktop. It also survives an accidental page reload mid-workout.
 */
import { useEffect, useState, useSyncExternalStore } from 'react'

export interface RestTimer {
  /** Clock time (ms) when the rest ends. Null when not running. */
  endsAt: number | null
  /** Milliseconds left when paused. Null when not paused. */
  pausedMs: number | null
  /** The full length of this rest, for the progress bar. */
  totalMs: number
  /** True once the "rest over" sound has played, so it plays only once. */
  alerted: boolean
}

export interface Stopwatch {
  /** Clock time (ms) when the current run started. Null when stopped. */
  startedAt: number | null
  /** Time collected in earlier runs, before the last pause. */
  accumulatedMs: number
}

interface TimerState {
  rest: RestTimer
  stopwatch: Stopwatch
  /** When today's workout was started, to show total workout time. */
  workout: { date: string; startedAt: number } | null
}

const STORAGE_KEY = 'workout.timers'

const initialState: TimerState = {
  rest: { endsAt: null, pausedMs: null, totalMs: 0, alerted: false },
  stopwatch: { startedAt: null, accumulatedMs: 0 },
  workout: null,
}

function load(): TimerState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? { ...initialState, ...JSON.parse(saved) } : initialState
  } catch {
    // Private browsing or blocked storage: timers still work, they just
    // will not survive a reload.
    return initialState
  }
}

// A tiny hand-rolled store: one state object, a list of listeners to notify
// when it changes. React reads it through `useSyncExternalStore` below.
let state = load()
const listeners = new Set<() => void>()

function setState(next: TimerState): void {
  state = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // See load(): ignore storage failures.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The current timer state. The component re-renders when it changes. */
export function useTimers(): TimerState {
  return useSyncExternalStore(subscribe, () => state)
}

/**
 * The current time, refreshed a few times a second while `active` is true.
 * Components that show a ticking clock use this to redraw; when nothing is
 * running, pass false so the app is not waking up for no reason.
 */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const interval = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(interval)
  }, [active])
  return now
}

// ── Reading values ───────────────────────────────────────────────────────

export type RestStatus = 'idle' | 'running' | 'paused' | 'done'

export function restStatus(rest: RestTimer, now: number): RestStatus {
  if (rest.pausedMs !== null) return 'paused'
  if (rest.endsAt === null) return 'idle'
  return now >= rest.endsAt ? 'done' : 'running'
}

/** Milliseconds of rest left (0 when finished or idle). */
export function restRemainingMs(rest: RestTimer, now: number): number {
  if (rest.pausedMs !== null) return rest.pausedMs
  if (rest.endsAt === null) return 0
  return Math.max(0, rest.endsAt - now)
}

export function stopwatchElapsedMs(stopwatch: Stopwatch, now: number): number {
  const running = stopwatch.startedAt === null ? 0 : Math.max(0, now - stopwatch.startedAt)
  return stopwatch.accumulatedMs + running
}

// ── Rest timer actions ───────────────────────────────────────────────────

export function startRest(seconds: number): void {
  const totalMs = seconds * 1000
  setState({ ...state, rest: { endsAt: Date.now() + totalMs, pausedMs: null, totalMs, alerted: false } })
}

/** Add or remove time from a running or paused rest (for the +15s / −15s buttons). */
export function adjustRest(deltaSeconds: number): void {
  const { rest } = state
  const deltaMs = deltaSeconds * 1000
  if (rest.pausedMs !== null) {
    setState({ ...state, rest: { ...rest, pausedMs: Math.max(0, rest.pausedMs + deltaMs) } })
  } else if (rest.endsAt !== null) {
    // If the rest already ran out, extend from now rather than from the past.
    const base = Math.max(rest.endsAt, Date.now())
    setState({ ...state, rest: { ...rest, endsAt: base + deltaMs, alerted: false } })
  }
}

export function pauseRest(): void {
  const { rest } = state
  if (rest.endsAt === null) return
  setState({ ...state, rest: { ...rest, endsAt: null, pausedMs: Math.max(0, rest.endsAt - Date.now()) } })
}

export function resumeRest(): void {
  const { rest } = state
  if (rest.pausedMs === null) return
  setState({ ...state, rest: { ...rest, endsAt: Date.now() + rest.pausedMs, pausedMs: null } })
}

export function clearRest(): void {
  setState({ ...state, rest: initialState.rest })
}

export function markRestAlerted(): void {
  setState({ ...state, rest: { ...state.rest, alerted: true } })
}

// ── Stopwatch actions ────────────────────────────────────────────────────

export function startStopwatch(): void {
  if (state.stopwatch.startedAt !== null) return
  setState({ ...state, stopwatch: { ...state.stopwatch, startedAt: Date.now() } })
}

export function pauseStopwatch(): void {
  const { stopwatch } = state
  if (stopwatch.startedAt === null) return
  setState({
    ...state,
    stopwatch: { startedAt: null, accumulatedMs: stopwatchElapsedMs(stopwatch, Date.now()) },
  })
}

export function resetStopwatch(): void {
  setState({ ...state, stopwatch: initialState.stopwatch })
}

// ── Workout clock ────────────────────────────────────────────────────────

/** Start the workout clock for `date`, unless it is already running for that day. */
export function startWorkoutClock(date: string): void {
  if (state.workout?.date === date) return
  setState({ ...state, workout: { date, startedAt: Date.now() } })
}

export function clearWorkoutClock(): void {
  setState({ ...state, workout: null })
}
