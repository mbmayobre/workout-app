/**
 * The two timer displays: the rest countdown and the stopwatch.
 *
 * These components only DRAW the timers and forward button taps. All the
 * timing logic lives in ../lib/timers.ts.
 */
import { Pause, Play, RotateCcw, X } from 'lucide-react'
import { useEffect } from 'react'
import { beep, unlockAudio, vibrate } from '../lib/device'
import {
  adjustRest,
  clearRest,
  markRestAlerted,
  pauseRest,
  pauseStopwatch,
  resetStopwatch,
  restRemainingMs,
  restStatus,
  resumeRest,
  startRest,
  startStopwatch,
  stopwatchElapsedMs,
  useNow,
  useTimers,
} from '../lib/timers'
import { formatDuration } from '../lib/units'
import { Button, IconButton, cx } from './ui'

/**
 * Plays the "rest over" alert. Mounted once at the top of the app (see
 * App.tsx) so the alert fires on whichever screen you happen to be on.
 * It draws nothing.
 */
export function RestAlarm({ sound }: { sound: boolean }) {
  const { rest } = useTimers()
  const now = useNow(rest.endsAt !== null)
  const finished = restStatus(rest, now) === 'done'

  useEffect(() => {
    if (!finished || rest.alerted) return
    if (sound) beep()
    vibrate()
    markRestAlerted()
  }, [finished, rest.alerted, sound])

  return null
}

/** Rest countdown with −15s, pause, +15s, and skip. `defaultSeconds` is used by "Start rest". */
export function RestCard({ defaultSeconds, label = 'Rest' }: { defaultSeconds: number; label?: string }) {
  const { rest } = useTimers()
  const now = useNow(rest.endsAt !== null)
  const status = restStatus(rest, now)
  const remainingMs = restRemainingMs(rest, now)

  if (status === 'idle') {
    return (
      <Button
        full
        onClick={() => {
          unlockAudio()
          startRest(defaultSeconds)
        }}
      >
        Start {label.toLowerCase()} · {formatDuration(defaultSeconds)}
      </Button>
    )
  }

  // Fraction of the rest that has passed, for the thin progress bar.
  const progress = rest.totalMs > 0 ? 1 - Math.min(1, remainingMs / rest.totalMs) : 1

  return (
    <div className={cx('rounded-2xl p-4', status === 'done' ? 'bg-good/15' : 'bg-accent-soft')}>
      <div className="flex items-center justify-between">
        <span className={cx('text-sm', status === 'done' ? 'text-good' : 'text-accent')}>
          {status === 'done' ? `${label} over` : status === 'paused' ? `${label} paused` : label}
        </span>
        <IconButton label="Dismiss rest timer" className="-m-2" onClick={clearRest}>
          <X size={18} />
        </IconButton>
      </div>
      {/* Round UP so the display reaches 0:00 exactly when the alert fires. */}
      <div
        role="timer"
        className={cx('digits text-center text-6xl font-semibold', status === 'done' ? 'text-good' : 'text-accent')}
      >
        {formatDuration(Math.ceil(remainingMs / 1000))}
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
        <div className="h-full bg-accent" style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="mt-3 flex justify-center gap-2">
        <Button onClick={() => adjustRest(-15)}>−15s</Button>
        {status === 'paused' ? (
          <Button aria-label="Resume rest" onClick={resumeRest}>
            <Play size={18} />
          </Button>
        ) : (
          <Button aria-label="Pause rest" disabled={status === 'done'} onClick={pauseRest}>
            <Pause size={18} />
          </Button>
        )}
        <Button onClick={() => adjustRest(15)}>+15s</Button>
      </div>
    </div>
  )
}

/**
 * Stopwatch with start/pause and reset.
 * With `targetSeconds`, it also shows how much of the target is left.
 */
export function StopwatchCard({ targetSeconds, label = 'Stopwatch' }: { targetSeconds?: number; label?: string }) {
  const { stopwatch } = useTimers()
  const running = stopwatch.startedAt !== null
  const now = useNow(running)
  const elapsedSeconds = stopwatchElapsedMs(stopwatch, now) / 1000
  const reachedTarget = targetSeconds !== undefined && elapsedSeconds >= targetSeconds

  return (
    <div className={cx('rounded-2xl p-4', reachedTarget ? 'bg-good/15' : 'bg-surface')}>
      <div className="text-center text-sm text-soft">{label}</div>
      <div role="timer" className={cx('digits text-center text-6xl font-semibold', reachedTarget && 'text-good')}>
        {formatDuration(elapsedSeconds)}
      </div>
      {targetSeconds !== undefined && (
        <div className="text-center text-sm text-soft">
          {reachedTarget ? 'Target reached' : `${formatDuration(Math.ceil(targetSeconds - elapsedSeconds))} to go`}
        </div>
      )}
      <div className="mt-3 flex justify-center gap-2">
        <Button
          className="min-w-28"
          onClick={() => {
            unlockAudio()
            if (running) pauseStopwatch()
            else startStopwatch()
          }}
        >
          {running ? <Pause size={18} /> : <Play size={18} />}
          {running ? 'Pause' : elapsedSeconds > 0 ? 'Resume' : 'Start'}
        </Button>
        <Button disabled={elapsedSeconds === 0} onClick={resetStopwatch}>
          <RotateCcw size={18} />
          Reset
        </Button>
      </div>
    </div>
  )
}
