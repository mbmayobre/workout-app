/**
 * Progress: body weight over time, and a personal best for every exercise
 * that has been logged. Tap an exercise for its full history.
 */
import { ChevronRight, X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../components/Layout'
import { TrendChart } from '../components/LazyTrendChart'
import { Button, Card, IconButton, NumberField, PageHeader, Row, SectionLabel, Segmented } from '../components/ui'
import { deleteBodyWeight, saveBodyWeight, updateSettings } from '../db/actions'
import { useAllExercises, useAllLogs, useBodyWeights, useSettings } from '../db/hooks'
import type { WeightUnit } from '../db/types'
import { dateKey, formatShortDate, fromDateKey } from '../lib/dates'
import { bestLog, describeLog, groupByDate } from '../lib/stats'
import { formatWeight, kgToUnit, parseNumber, trimNumber, unitToKg } from '../lib/units'

export function ProgressPage() {
  const navigate = useNavigate()
  const settings = useSettings()
  const bodyWeights = useBodyWeights()
  const exercises = useAllExercises()
  const logs = useAllLogs()
  const [weightText, setWeightText] = useState('')
  const [error, setError] = useState('')
  const unit = settings.weightUnit

  const latest = bodyWeights?.at(-1)

  // Change over roughly the last month: latest entry minus the oldest entry
  // from the past 30 days.
  let monthChange: number | undefined
  if (latest && bodyWeights) {
    const cutoff = fromDateKey(latest.date)
    cutoff.setDate(cutoff.getDate() - 30)
    const baseline = bodyWeights.find((entry) => fromDateKey(entry.date) >= cutoff)
    if (baseline && baseline.id !== latest.id) {
      monthChange = kgToUnit(latest.weightKg, unit) - kgToUnit(baseline.weightKg, unit)
    }
  }

  const logWeight = async () => {
    const value = parseNumber(weightText)
    if (!value) return setError('Enter your weight first.')
    await saveBodyWeight(dateKey(), unitToKg(value, unit))
    setWeightText('')
    setError('')
  }

  // Exercises that have at least one log, most recently trained first.
  const logsByExercise = new Map<string, NonNullable<typeof logs>>()
  for (const log of logs ?? []) {
    const list = logsByExercise.get(log.exerciseId)
    if (list) list.push(log)
    else logsByExercise.set(log.exerciseId, [log])
  }
  const trained = (exercises ?? [])
    .filter((exercise) => logsByExercise.has(exercise.id))
    .sort((a, b) => logsByExercise.get(b.id)!.at(-1)!.at - logsByExercise.get(a.id)!.at(-1)!.at)

  return (
    <Page>
      <PageHeader
        title="Progress"
        action={
          <div className="w-28">
            <Segmented<WeightUnit>
              label="Weight unit"
              value={unit}
              onChange={(weightUnit) => updateSettings({ weightUnit })}
              options={[
                { value: 'lb', label: 'lb' },
                { value: 'kg', label: 'kg' },
              ]}
            />
          </div>
        }
      />

      <SectionLabel>Body weight</SectionLabel>
      <Card>
        {latest ? (
          <div className="flex items-baseline justify-between">
            <span className="digits text-3xl font-semibold">{formatWeight(latest.weightKg, unit)}</span>
            {monthChange !== undefined && (
              <span className="text-sm text-soft">
                {monthChange > 0 ? '+' : monthChange < 0 ? '−' : ''}
                {trimNumber(Math.abs(monthChange))} {unit} in 30 days
              </span>
            )}
          </div>
        ) : (
          <p className="text-soft">Log your weight to start tracking it.</p>
        )}

        <TrendChart
          unit={unit}
          points={(bodyWeights ?? []).map((entry) => ({
            date: entry.date,
            value: Number(kgToUnit(entry.weightKg, unit).toFixed(1)),
          }))}
        />

        <div className="mt-2 flex items-end gap-2">
          <NumberField
            label="Today's weight"
            suffix={unit}
            value={weightText}
            placeholder={latest ? trimNumber(kgToUnit(latest.weightKg, unit)) : '0'}
            onChange={(text) => {
              setError('')
              setWeightText(text)
            }}
          />
          <Button className="h-12" onClick={logWeight}>
            Log weight
          </Button>
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm text-bad">
            {error}
          </p>
        )}

        {/* The five most recent entries, newest first, each removable. */}
        {bodyWeights && bodyWeights.length > 0 && (
          <div className="mt-3">
            {bodyWeights
              .slice(-5)
              .reverse()
              .map((entry) => (
                <div key={entry.id} className="flex min-h-11 items-center justify-between border-t border-line text-sm">
                  <span className="text-soft">{formatShortDate(entry.date)}</span>
                  <span className="flex items-center">
                    <span className="digits">{formatWeight(entry.weightKg, unit)}</span>
                    <IconButton label={`Delete entry for ${formatShortDate(entry.date)}`} className="-mr-3" onClick={() => deleteBodyWeight(entry.id)}>
                      <X size={16} />
                    </IconButton>
                  </span>
                </div>
              ))}
          </div>
        )}
      </Card>

      <SectionLabel>Exercise history</SectionLabel>
      {trained.length === 0 ? (
        <p className="text-soft">Sets you log during a workout show up here with your personal bests.</p>
      ) : (
        <div>
          {trained.map((exercise) => {
            const exerciseLogs = logsByExercise.get(exercise.id)!
            const best = bestLog(exerciseLogs, exercise)
            const sessions = groupByDate(exerciseLogs).length
            return (
              <Row key={exercise.id} onClick={() => navigate(`/progress/${encodeURIComponent(exercise.id)}`)}>
                <div className="min-w-0 flex-1">
                  <div className="truncate">{exercise.name}</div>
                  <div className="truncate text-sm text-soft">
                    Best {best ? describeLog(best, exercise, settings) : '—'} · {sessions}{' '}
                    {sessions === 1 ? 'session' : 'sessions'}
                  </div>
                </div>
                <ChevronRight size={18} className="text-faint" />
              </Row>
            )
          })}
        </div>
      )}
    </Page>
  )
}
