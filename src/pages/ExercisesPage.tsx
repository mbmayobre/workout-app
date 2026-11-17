/**
 * Exercise library: search and filter by category and by equipment.
 * Tap an exercise to edit it, or + to add your own.
 */
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../components/Layout'
import { Chip, IconButton, PageHeader, Row } from '../components/ui'
import { useAllExercises } from '../db/hooks'
import type { Equipment, Exercise, MuscleGroup } from '../db/types'
import { EQUIPMENT_LABELS, exerciseSubtitle, MUSCLE_LABELS } from '../lib/labels'
import { MUSCLE_GROUPS } from '../lib/shuffle'

/** The category filter: a muscle group, or one of the two special categories. */
type Category = MuscleGroup | 'fullBody' | 'cardio'

const CATEGORIES: { value: Category; label: string }[] = [
  ...MUSCLE_GROUPS.map((group) => ({ value: group, label: MUSCLE_LABELS[group] })),
  { value: 'fullBody', label: 'Full body' },
  { value: 'cardio', label: 'Cardio' },
]

const EQUIPMENT_FILTERS: Equipment[] = ['barbell', 'dumbbell', 'kettlebell', 'cable', 'machine', 'bodyweight']

function matchesCategory(exercise: Exercise, category: Category): boolean {
  if (category === 'cardio') return exercise.kind === 'cardio'
  if (category === 'fullBody') return exercise.fullBody
  // Primary or secondary: the library shows everything that touches the group.
  return exercise.primary.includes(category) || exercise.secondary.includes(category)
}

export function ExercisesPage() {
  const navigate = useNavigate()
  const exercises = useAllExercises()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<Category | null>(null)
  const [equipment, setEquipment] = useState<Equipment | null>(null)

  const visible = (exercises ?? []).filter(
    (exercise) =>
      !exercise.archived &&
      exercise.name.toLowerCase().includes(search.trim().toLowerCase()) &&
      (category === null || matchesCategory(exercise, category)) &&
      (equipment === null || exercise.equipment === equipment),
  )

  return (
    <Page>
      <PageHeader
        title="Exercises"
        action={
          <IconButton label="Add exercise" className="-mr-2 bg-raised" onClick={() => navigate('/exercises/new')}>
            <Plus />
          </IconButton>
        }
      />

      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search exercises"
        aria-label="Search exercises"
        className="h-11 w-full rounded-xl border border-line bg-raised px-3 outline-none placeholder:text-faint focus:border-accent"
      />

      {/*
        Both filter rows sit inside ONE sideways-scrolling area, so they move
        together. `w-max` lets the inner block be as wide as its longest row
        instead of squeezing to the screen width. Tapping a selected chip
        clears that filter.
      */}
      <div className="-mx-4 mt-3 overflow-x-auto pb-1 pl-4">
        <div className="flex w-max flex-col gap-2 pr-4">
          <div role="group" aria-label="Filter by category" className="flex gap-2">
            {CATEGORIES.map(({ value, label }) => (
              <Chip key={value} selected={category === value} onClick={() => setCategory(category === value ? null : value)}>
                {label}
              </Chip>
            ))}
          </div>
          <div role="group" aria-label="Filter by equipment" className="flex gap-2">
            {EQUIPMENT_FILTERS.map((value) => (
              <Chip key={value} selected={equipment === value} onClick={() => setEquipment(equipment === value ? null : value)}>
                {EQUIPMENT_LABELS[value]}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-3 text-sm text-soft">
        {visible.length} {visible.length === 1 ? 'exercise' : 'exercises'}
      </p>
      <div>
        {visible.map((exercise) => (
          <Row key={exercise.id} onClick={() => navigate(`/exercises/${encodeURIComponent(exercise.id)}`)}>
            <div className="min-w-0 flex-1">
              <div className="truncate">{exercise.name}</div>
              <div className="truncate text-sm text-soft">{exerciseSubtitle(exercise)}</div>
            </div>
            {exercise.primary.slice(0, 2).map((group) => (
              <Chip key={group} selected>
                {MUSCLE_LABELS[group]}
              </Chip>
            ))}
          </Row>
        ))}
      </div>
      {exercises && visible.length === 0 && (
        <p className="mt-6 text-center text-soft">No exercises match. Clear a filter or add your own.</p>
      )}
    </Page>
  )
}
