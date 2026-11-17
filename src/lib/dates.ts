/**
 * Date helpers.
 *
 * Workout days are stored as local calendar dates in 'YYYY-MM-DD' form (a
 * "date key"). We deliberately avoid `toISOString()`, which converts to UTC:
 * an evening workout in the Americas would be filed under tomorrow's date.
 */

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Monday-first display order of weekday numbers (0 = Sunday). */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

/** A Date as a local 'YYYY-MM-DD' key. */
export function dateKey(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** A date key back into a Date at local midnight. */
export function fromDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** "Mon, Nov 16" */
export function formatShortDate(key: string): string {
  return fromDateKey(key).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

/** "Monday, Nov 16" */
export function formatLongDate(date: Date = new Date()): string {
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}
