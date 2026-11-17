/**
 * A small line chart of one value over time, used for body weight and for
 * exercise progress. Wraps the Recharts library so the rest of the app does
 * not need to know its API.
 */
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatShortDate } from '../lib/dates'

export interface TrendPoint {
  /** 'YYYY-MM-DD' */
  date: string
  value: number
}

export function TrendChart({ points, unit }: { points: TrendPoint[]; unit: string }) {
  // A line needs at least two points to be worth drawing.
  if (points.length < 2) {
    return <p className="py-6 text-center text-sm text-soft">Log at least two days to see a trend.</p>
  }
  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="date"
            tickFormatter={(date: string) => date.slice(5).replace('-', '/')}
            tick={{ fontSize: 11, fill: 'var(--color-faint)' }}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          {/* 'auto' domain zooms in on the data instead of starting the axis at zero,
              which would flatten small changes in body weight into a straight line. */}
          <YAxis
            domain={['auto', 'auto']}
            width={36}
            tick={{ fontSize: 11, fill: 'var(--color-faint)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value) => [`${value} ${unit}`, '']}
            labelFormatter={(date) => formatShortDate(String(date))}
            separator=""
            contentStyle={{
              background: 'var(--color-raised)',
              border: '1px solid var(--color-line)',
              borderRadius: 12,
              color: 'var(--color-ink)',
            }}
            itemStyle={{ color: 'var(--color-ink)' }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--color-accent)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--color-accent)', strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
