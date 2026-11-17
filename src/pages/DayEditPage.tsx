/**
 * Edit one day of the weekly plan: its workout types, how many exercises it
 * has, which exercises are pinned, and each exercise's target sets and reps.
 *
 * Every control saves immediately (there is no Save button), matching how
 * the rest of the app works: what you see is what is stored.
 */
import { Pin, PinOff, RefreshCw, Shuffle, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { Page } from '../components/Layout'
import { Button, Chip, IconButton, PageHeader, SectionLabel, Segmented, Stepper, cx } from '../components/ui'
import { reshuffleDay, resizeDay, retargetDay, swapDayPick, updatePlanDay } from '../db/actions'
import { useAllExercises, useExerciseMap, usePlanDay } from '../db/hooks'
import type { DayType, PlanPick, ShuffleStyle } from '../db/types'
import { WEEKDAY_NAMES } from '../lib/dates'
import { DAY_TYPES, DAY_TYPE_LABELS, joinList, MUSCLE_LABELS, STYLE_LABELS, targetLabel } from '../lib/labels'
import { coverageSummary, makePick, showsCoverage } from '../lib/shuffle'

const STYLE_OPTIONS = (Object.keys(STYLE_LABELS) as ShuffleStyle[]).map((value) => ({
  value,
  label: STYLE_LABELS[value],
}))

export function DayEditPage() {
  const weekday = Number(useParams().weekday)
  const validWeekday = Number.isInteger(weekday) && weekday >= 0 && weekday <= 6
  const day = usePlanDay(validWeekday ? weekday : 0)
  const exercises = useAllExercises()
  const exerciseMap = useExerciseMap()
  // Which exercise row is expanded to show its sets/reps editor.
  const [openId, setOpenId] = useState<string | null>(null)

  if (!validWeekday) return <Navigate to="/plan" replace />
  if (!day || !exercises) return <Page>{null}</Page>

  const isRest = day.types.length === 0
  const coverage = coverageSummary(day.picks, exercises)

  const toggleType = (type: DayType) => {
    const types = day.types.includes(type) ? day.types.filter((t) => t !== type) : [...day.types, type]
    void retargetDay(day, { types }, exercises)
  }

  /** Apply a change to the pick at `index`. */
  const changePick = (index: number, changes: Partial<PlanPick>) => {
    const picks = day.picks.map((pick, i) => (i === index ? { ...pick, ...changes } : pick))
    void updatePlanDay(day.id, { picks })
  }

  const removePick = (index: number) => {
    const picks = day.picks.filter((_, i) => i !== index)
    void updatePlanDay(day.id, { picks, count: Math.max(1, picks.length) })
  }

  /** Add a specific exercise by hand. Hand-picked exercises start pinned. */
  const addExercise = (exerciseId: string) => {
    const exercise = exerciseMap.get(exerciseId)
    if (!exercise) return
    const picks = [...day.picks, { ...makePick(exercise), pinned: true }]
    void updatePlanDay(day.id, { picks, count: picks.length })
  }

  const addable = exercises.filter(
    (exercise) => !exercise.archived && !day.picks.some((pick) => pick.exerciseId === exercise.id),
  )

  return (
    <Page>
      <PageHeader title={WEEKDAY_NAMES[weekday]} back="/plan" />

      <SectionLabel>Workout type</SectionLabel>
      <div className="flex flex-wrap gap-2">
        {DAY_TYPES.map((type) => (
          <Chip key={type} selected={day.types.includes(type)} onClick={() => toggleType(type)}>
            {DAY_TYPE_LABELS[type]}
          </Chip>
        ))}
        <Chip selected={isRest} onClick={() => retargetDay(day, { types: [] }, exercises)}>
          Rest day
        </Chip>
      </div>
      <p className="mt-2 text-sm text-soft">
        Choose one or more. Kettlebell limits the day to kettlebell exercises.
      </p>

      {!isRest && (
        <>
          <div className="mt-5 flex items-center justify-between">
            <span>Number of exercises</span>
            <Stepper label="number of exercises" value={day.count} min={1} max={12} onChange={(count) => resizeDay(day, count, exercises)} />
          </div>

          {showsCoverage(day.types) && (
            <>
              <SectionLabel>Shuffle style</SectionLabel>
              <Segmented label="Shuffle style" options={STYLE_OPTIONS} value={day.style} onChange={(style) => retargetDay(day, { style }, exercises)} />
              <p className="mt-2 text-sm text-soft">
                {day.style === 'compound' && 'Favors exercises that work several muscle groups at once.'}
                {day.style === 'focused' && 'Favors one muscle group per exercise, once every group is covered.'}
                {day.style === 'balanced' && 'Covers every muscle group first, with no other preference.'}
              </p>
            </>
          )}

          <SectionLabel>This week's exercises</SectionLabel>
          {day.picks.length === 0 && <p className="text-sm text-soft">No exercises match this day yet.</p>}
          <div>
            {day.picks.map((pick, index) => {
              const exercise = exerciseMap.get(pick.exerciseId)
              const open = openId === pick.exerciseId
              const isCardio = exercise?.kind === 'cardio'
              const isTimed = exercise?.logMode === 'time'
              return (
                <div key={pick.exerciseId} className="border-b border-line last:border-b-0">
                  <div className="flex min-h-14 items-center gap-1">
                    <IconButton
                      label={pick.pinned ? `Unpin ${exercise?.name}` : `Pin ${exercise?.name}`}
                      className={cx('-ml-2', pick.pinned && 'text-accent')}
                      onClick={() => changePick(index, { pinned: !pick.pinned })}
                    >
                      {pick.pinned ? <Pin size={18} /> : <PinOff size={18} />}
                    </IconButton>
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setOpenId(open ? null : pick.exerciseId)}
                      className="min-w-0 flex-1 py-2 text-left"
                    >
                      <span className="block truncate">{exercise?.name ?? 'Deleted exercise'}</span>
                      <span className="block text-sm text-soft">
                        {pick.pinned ? 'Pinned' : 'Shuffled'} · {targetLabel(pick, exercise)}
                      </span>
                    </button>
                    {!pick.pinned && (
                      <IconButton label={`Swap ${exercise?.name}`} className="-mr-2" onClick={() => swapDayPick(day, index, exercises)}>
                        <RefreshCw size={18} />
                      </IconButton>
                    )}
                  </div>

                  {open && (
                    <div className="flex flex-col gap-3 pb-4 pl-10">
                      {!isCardio && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Sets</span>
                          <Stepper label="sets" value={pick.sets} min={1} max={20} onChange={(sets) => changePick(index, { sets })} />
                        </div>
                      )}
                      {!isCardio && !isTimed && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Reps</span>
                          <Stepper label="reps" value={pick.reps} min={1} max={100} onChange={(reps) => changePick(index, { reps })} />
                        </div>
                      )}
                      {isCardio && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Minutes</span>
                          <Stepper
                            label="minutes"
                            value={Math.round(pick.seconds / 60)}
                            min={1}
                            max={240}
                            onChange={(minutes) => changePick(index, { seconds: minutes * 60 })}
                          />
                        </div>
                      )}
                      {!isCardio && isTimed && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Seconds per set</span>
                          <div className="flex gap-2">
                            <Button onClick={() => changePick(index, { seconds: Math.max(5, pick.seconds - 5) })}>−5s</Button>
                            <Button onClick={() => changePick(index, { seconds: pick.seconds + 5 })}>+5s</Button>
                          </div>
                        </div>
                      )}
                      <Button variant="danger" onClick={() => removePick(index)}>
                        <Trash2 size={16} />
                        Remove from this day
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {showsCoverage(day.types) && day.picks.length > 0 && (
            <p className="mt-3 text-sm text-soft">
              Covers {coverage.covered.length} of 6 muscle groups
              {coverage.missing.length > 0 &&
                ` · no ${joinList(coverage.missing.map((group) => MUSCLE_LABELS[group].toLowerCase()))}`}
            </p>
          )}

          <div className="mt-5 flex flex-col gap-2">
            <Button full onClick={() => reshuffleDay(day, exercises)}>
              <Shuffle size={18} />
              Shuffle unpinned
            </Button>
            {/* A native <select> gives the phone's own scrolling picker for free. */}
            <label className="block">
              <span className="sr-only">Add a specific exercise</span>
              <select
                value=""
                onChange={(event) => addExercise(event.target.value)}
                className="h-11 w-full rounded-xl border border-line bg-raised px-3 text-sm text-ink"
              >
                <option value="">Add a specific exercise…</option>
                {addable.map((exercise) => (
                  <option key={exercise.id} value={exercise.id}>
                    {exercise.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </>
      )}
    </Page>
  )
}
