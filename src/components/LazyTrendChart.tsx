/**
 * Loads the chart on demand.
 *
 * The charting library (Recharts) is by far the largest dependency, and it is
 * only needed on the Progress screens. `lazy` tells the bundler to put it in
 * a separate file that is downloaded the first time a chart is shown, which
 * keeps the first load of the app (Today, the active workout) small.
 *
 * Import TrendChart from this file, not from ./TrendChart directly.
 */
import { lazy, Suspense } from 'react'
import type { TrendPoint } from './TrendChart'

const Chart = lazy(() => import('./TrendChart').then((module) => ({ default: module.TrendChart })))

export function TrendChart(props: { points: TrendPoint[]; unit: string }) {
  return (
    // The fallback reserves the chart's height so the page does not jump when it arrives.
    <Suspense fallback={<div className="h-40" />}>
      <Chart {...props} />
    </Suspense>
  )
}
