/**
 * Standalone stopwatch and countdown timer, for use outside a planned
 * workout. These are the same two timers the active workout screen uses
 * (see ../lib/timers.ts), so a timer started here keeps running there.
 */
import { useState } from 'react'
import { Page } from '../components/Layout'
import { RestCard, StopwatchCard } from '../components/TimerCards'
import { Button, Chip, NumberField, PageHeader, SectionLabel } from '../components/ui'
import { useSettings } from '../db/hooks'
import { unlockAudio, useWakeLock } from '../lib/device'
import { restStatus, startRest, useTimers } from '../lib/timers'
import { formatDuration, parseNumber } from '../lib/units'

const PRESETS = [30, 60, 90, 120, 180, 300]

export function TimersPage() {
  const settings = useSettings()
  const { rest, stopwatch } = useTimers()
  const [minutesText, setMinutesText] = useState('')
  const [secondsText, setSecondsText] = useState('')
  const [error, setError] = useState('')

  // Keep the screen on while either timer is running.
  useWakeLock(stopwatch.startedAt !== null || rest.endsAt !== null)

  const start = (seconds: number) => {
    unlockAudio()
    startRest(seconds)
  }

  const startCustom = () => {
    const seconds = (parseNumber(minutesText) ?? 0) * 60 + (parseNumber(secondsText) ?? 0)
    if (seconds <= 0) return setError('Enter minutes or seconds first.')
    setError('')
    start(Math.round(seconds))
  }

  const timerIdle = restStatus(rest, Date.now()) === 'idle'

  return (
    <Page>
      <PageHeader title="Timers" back="/" />

      <SectionLabel>Stopwatch</SectionLabel>
      <StopwatchCard />

      <SectionLabel>Countdown timer</SectionLabel>
      {!timerIdle && <RestCard defaultSeconds={settings.restSeconds} label="Timer" />}
      <div className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((seconds) => (
          <Chip key={seconds} onClick={() => start(seconds)}>
            {formatDuration(seconds)}
          </Chip>
        ))}
      </div>
      <div className="mt-3 flex items-end gap-2">
        <NumberField label="Minutes" value={minutesText} placeholder="0" onChange={(text) => { setError(''); setMinutesText(text) }} />
        <NumberField label="Seconds" value={secondsText} placeholder="0" onChange={(text) => { setError(''); setSecondsText(text) }} />
        <Button className="h-12" onClick={startCustom}>
          Start
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-bad">
          {error}
        </p>
      )}
    </Page>
  )
}
