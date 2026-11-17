/**
 * History of one exercise: personal best, a trend chart with one point per
 * session, and every logged set grouped by day (newest first).
 */
import { X } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { Page } from '../components/Layout'
import { TrendChart } from '../components/LazyTrendChart'
import { Card, IconButton, PageHeader, SectionLabel } from '../components/ui'
import { deleteSetLog } from '../db/actions'
import { useExerciseLogs, useExerciseMap, useSettings } from '../db/hooks'
import { formatShortDate } from '../lib/dates'
import { exerciseSubtitle } from '../lib/labels'
import { bestLog, chartMetric, chartPoints, describeLog, groupByDate } from '../lib/stats'

export function ExerciseHistoryPage() {
  const { id } = useParams()
  const exercise = useExerciseMap().get(id ?? '')
  const logs = useExerciseLogs(id)
  const settings = useSettings()

  if (!exercise || !logs) {
    return (
      <Page>
        <PageHeader title="History" back="/progress" />
      </Page>
    )
  }

  const best = bestLog(logs, exercise)
  const metric = chartMetric(exercise, logs, settings)
  const sessions = groupByDate(logs).reverse()

  return (
    <Page>
      <PageHeader title={exercise.name} subtitle={exerciseSubtitle(exercise)} back="/progress" />

      <Card>
        <div className="text-sm text-soft">Personal best</div>
        <div className="digits text-3xl font-semibold">{best ? describeLog(best, exercise, settings) : '—'}</div>
        {best && <div className="text-sm text-soft">{formatShortDate(best.date)}</div>}
      </Card>

      <SectionLabel>
        {metric.label} per session ({metric.unit})
      </SectionLabel>
      <Card>
        <TrendChart points={chartPoints(logs, exercise, settings)} unit={metric.unit} />
      </Card>

      <SectionLabel>Sessions</SectionLabel>
      {sessions.length === 0 && <p className="text-soft">Nothing logged yet.</p>}
      <div className="flex flex-col gap-3">
        {sessions.map((session) => (
          <Card key={session.date} className="py-2">
            <div className="py-2 text-sm text-soft">{formatShortDate(session.date)}</div>
            {session.logs.map((log, index) => (
              <div key={log.id} className="flex min-h-11 items-center gap-3 border-t border-line">
                <span className="w-6 text-sm text-soft">{index + 1}</span>
                <span className="digits flex-1">{describeLog(log, exercise, settings)}</span>
                <IconButton label={`Delete set ${index + 1} from ${formatShortDate(session.date)}`} className="-mr-3" onClick={() => deleteSetLog(log.id)}>
                  <X size={16} />
                </IconButton>
              </div>
            ))}
          </Card>
        ))}
      </div>
    </Page>
  )
}
