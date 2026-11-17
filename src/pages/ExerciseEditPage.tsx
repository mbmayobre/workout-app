/**
 * Add or edit an exercise.
 *
 * Unlike the plan editor, this screen has an explicit Save button: an
 * exercise is only valid once it has a name and a category, so saving
 * half-filled forms on every keystroke would create broken records.
 *
 * The same component handles both cases. With an `:id` in the URL it edits
 * that exercise; at /exercises/new it starts from a blank one.
 */
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Page } from '../components/Layout'
import { Button, Chip, PageHeader, SectionLabel, Segmented, Stepper, TextField, Toggle } from '../components/ui'
import { deleteExercise, saveExercise } from '../db/actions'
import { useAllExercises } from '../db/hooks'
import type { Equipment, Exercise, ExerciseKind, LogMode, MuscleGroup, WeightUnit } from '../db/types'
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from '../lib/labels'
import { MUSCLE_GROUPS } from '../lib/shuffle'

const BLANK: Omit<Exercise, 'id'> = {
  name: '',
  kind: 'strength',
  equipment: 'barbell',
  primary: [],
  secondary: [],
  fullBody: false,
  logMode: 'reps',
  defaultSets: 3,
  defaultReps: 10,
  defaultSeconds: 30,
}

export function ExerciseEditPage() {
  const { id } = useParams()
  const exercises = useAllExercises()
  if (!exercises) return <Page>{null}</Page>

  const existing = id ? exercises.find((exercise) => exercise.id === id) : undefined
  if (id && !existing) {
    return (
      <Page>
        <PageHeader title="Exercise not found" back="/exercises" />
      </Page>
    )
  }
  // `key` resets the form if the URL changes to a different exercise.
  return <ExerciseForm key={id ?? 'new'} initial={existing ?? BLANK} id={id} />
}

function ExerciseForm({ initial, id }: { initial: Omit<Exercise, 'id'>; id?: string }) {
  const navigate = useNavigate()
  // One state object holding the whole draft; `set` updates a single field.
  const [draft, setDraft] = useState(initial)
  const [error, setError] = useState('')
  const set = <K extends keyof typeof draft>(field: K, value: (typeof draft)[K]) => {
    setError('')
    setDraft((current) => ({ ...current, [field]: value }))
  }

  const isCardio = draft.kind === 'cardio'

  /** Tap a muscle chip: add or remove it, and make sure it is not in both lists. */
  const toggleGroup = (list: 'primary' | 'secondary', group: MuscleGroup) => {
    const other = list === 'primary' ? 'secondary' : 'primary'
    setError('')
    setDraft((current) => ({
      ...current,
      [list]: current[list].includes(group) ? current[list].filter((g) => g !== group) : [...current[list], group],
      [other]: current[other].filter((g) => g !== group),
    }))
  }

  const changeKind = (kind: ExerciseKind) => {
    setError('')
    setDraft((current) => ({
      ...current,
      kind,
      // Keep related fields consistent with the kind.
      equipment: kind === 'cardio' ? 'cardio' : kind === 'bodyweight' ? 'bodyweight' : current.equipment === 'cardio' ? 'barbell' : current.equipment,
      logMode: kind === 'cardio' ? 'time' : current.logMode,
      defaultSets: kind === 'cardio' ? 1 : current.defaultSets,
      defaultSeconds: kind === 'cardio' ? Math.max(60, current.defaultSeconds) : current.defaultSeconds,
      primary: kind === 'cardio' ? [] : current.primary,
      secondary: kind === 'cardio' ? [] : current.secondary,
      fullBody: kind === 'cardio' ? false : current.fullBody,
    }))
  }

  const save = async () => {
    const name = draft.name.trim()
    if (!name) return setError('Enter a name first.')
    if (!isCardio && draft.primary.length === 0) return setError('Choose at least one primary muscle group.')
    await saveExercise({ ...draft, name, id })
    navigate('/exercises')
  }

  const remove = async () => {
    if (!id) return
    // A browser confirm is plain but safe: deleting is the one action here that cannot be undone.
    if (!window.confirm(`Delete ${draft.name}? Your logged sets for it are kept.`)) return
    await deleteExercise(id)
    navigate('/exercises')
  }

  return (
    <Page>
      <PageHeader title={id ? 'Edit exercise' : 'New exercise'} back="/exercises" />

      <div className="flex flex-col gap-1">
        <TextField label="Name" value={draft.name} onChange={(name) => set('name', name)} placeholder="Bench press" />

        <SectionLabel>Type</SectionLabel>
        <Segmented<ExerciseKind>
          label="Type"
          value={draft.kind}
          onChange={changeKind}
          options={[
            { value: 'strength', label: 'Weighted' },
            { value: 'bodyweight', label: 'Bodyweight' },
            { value: 'cardio', label: 'Cardio' },
          ]}
        />

        {!isCardio && (
          <>
            <SectionLabel>Equipment</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(EQUIPMENT_LABELS) as Equipment[])
                .filter((equipment) => equipment !== 'cardio')
                .map((equipment) => (
                  <Chip key={equipment} selected={draft.equipment === equipment} onClick={() => set('equipment', equipment)}>
                    {EQUIPMENT_LABELS[equipment]}
                  </Chip>
                ))}
            </div>

            <SectionLabel>Primary muscle groups</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {MUSCLE_GROUPS.map((group) => (
                <Chip key={group} selected={draft.primary.includes(group)} onClick={() => toggleGroup('primary', group)}>
                  {MUSCLE_LABELS[group]}
                </Chip>
              ))}
            </div>
            <p className="mt-1 text-sm text-soft">The muscles it mainly trains. Shuffle uses these to match a day.</p>

            <SectionLabel>Secondary muscle groups</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {MUSCLE_GROUPS.map((group) => (
                <Chip key={group} selected={draft.secondary.includes(group)} onClick={() => toggleGroup('secondary', group)}>
                  {MUSCLE_LABELS[group]}
                </Chip>
              ))}
            </div>
            <p className="mt-1 text-sm text-soft">Muscles that assist. They count half on full-body days.</p>

            <div className="mt-3">
              <Toggle label="Whole-body move" checked={draft.fullBody} onChange={(fullBody) => set('fullBody', fullBody)} />
            </div>

            <SectionLabel>Count sets by</SectionLabel>
            <Segmented<LogMode>
              label="Count sets by"
              value={draft.logMode}
              onChange={(logMode) => set('logMode', logMode)}
              options={[
                { value: 'reps', label: 'Reps' },
                { value: 'time', label: 'Time' },
              ]}
            />
          </>
        )}

        {draft.kind === 'strength' && (
          <>
            <SectionLabel>Weight unit</SectionLabel>
            <Segmented<WeightUnit | 'default'>
              label="Weight unit"
              value={draft.weightUnit ?? 'default'}
              onChange={(unit) => set('weightUnit', unit === 'default' ? undefined : unit)}
              options={[
                { value: 'default', label: 'App setting' },
                { value: 'lb', label: 'Always lb' },
                { value: 'kg', label: 'Always kg' },
              ]}
            />
          </>
        )}

        <SectionLabel>Default target</SectionLabel>
        <div className="flex flex-col gap-3">
          {!isCardio && (
            <div className="flex items-center justify-between">
              <span>Sets</span>
              <Stepper label="sets" value={draft.defaultSets} min={1} max={20} onChange={(value) => set('defaultSets', value)} />
            </div>
          )}
          {!isCardio && draft.logMode === 'reps' && (
            <div className="flex items-center justify-between">
              <span>Reps</span>
              <Stepper label="reps" value={draft.defaultReps} min={1} max={100} onChange={(value) => set('defaultReps', value)} />
            </div>
          )}
          {!isCardio && draft.logMode === 'time' && (
            <div className="flex items-center justify-between">
              <span>Seconds per set</span>
              <div className="flex items-center gap-2">
                <Button onClick={() => set('defaultSeconds', Math.max(5, draft.defaultSeconds - 5))}>−5s</Button>
                <span className="digits w-10 text-center text-lg font-semibold">{draft.defaultSeconds}</span>
                <Button onClick={() => set('defaultSeconds', draft.defaultSeconds + 5)}>+5s</Button>
              </div>
            </div>
          )}
          {isCardio && (
            <div className="flex items-center justify-between">
              <span>Minutes</span>
              <Stepper
                label="minutes"
                value={Math.round(draft.defaultSeconds / 60)}
                min={1}
                max={240}
                onChange={(minutes) => set('defaultSeconds', minutes * 60)}
              />
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm text-bad">
            {error}
          </p>
        )}

        <Button full variant="primary" className="mt-5" onClick={save}>
          Save exercise
        </Button>
        {id && (
          <Button full variant="danger" className="mt-2" onClick={remove}>
            Delete exercise
          </Button>
        )}
      </div>
    </Page>
  )
}
