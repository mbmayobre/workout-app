/**
 * The route table: which screen is shown for which URL.
 *
 *   /                 Today (workout of the day)
 *   /workout          Active workout: timers, set counter, logging
 *   /plan             Weekly plan
 *   /plan/:weekday    Edit one day of the plan
 *   /exercises        Exercise library
 *   /exercises/new    Add an exercise
 *   /exercises/:id    Edit an exercise
 *   /progress         Body weight and personal bests
 *   /progress/:id     History of one exercise
 *   /timers           Standalone stopwatch and countdown
 *   /settings         Units, rest time, sync, backup
 *
 * Routes inside <TabLayout> show the bottom tab bar; routes inside
 * <PlainLayout> are focused screens without it.
 */
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { PlainLayout, TabLayout } from './components/Layout'
import { RestAlarm } from './components/TimerCards'
import { useSettings } from './db/hooks'
import { DayEditPage } from './pages/DayEditPage'
import { ExerciseEditPage } from './pages/ExerciseEditPage'
import { ExerciseHistoryPage } from './pages/ExerciseHistoryPage'
import { ExercisesPage } from './pages/ExercisesPage'
import { PlanPage } from './pages/PlanPage'
import { ProgressPage } from './pages/ProgressPage'
import { SettingsPage } from './pages/SettingsPage'
import { TimersPage } from './pages/TimersPage'
import { TodayPage } from './pages/TodayPage'
import { WorkoutPage } from './pages/WorkoutPage'

export default function App() {
  const settings = useSettings()
  return (
    <BrowserRouter>
      {/* Invisible: plays the "rest over" alert on any screen. */}
      <RestAlarm sound={settings.sound} />
      <Routes>
        <Route element={<TabLayout />}>
          <Route index element={<TodayPage />} />
          <Route path="plan" element={<PlanPage />} />
          <Route path="exercises" element={<ExercisesPage />} />
          <Route path="progress" element={<ProgressPage />} />
        </Route>
        <Route element={<PlainLayout />}>
          <Route path="workout" element={<WorkoutPage />} />
          <Route path="plan/:weekday" element={<DayEditPage />} />
          <Route path="exercises/new" element={<ExerciseEditPage />} />
          <Route path="exercises/:id" element={<ExerciseEditPage />} />
          <Route path="progress/:id" element={<ExerciseHistoryPage />} />
          <Route path="timers" element={<TimersPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        {/* Unknown URL: go home. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
