/**
 * Unit conversion and number formatting.
 *
 * The database always stores kilograms, metres, and seconds (see
 * ../db/types.ts). These helpers convert to and from what the user sees.
 * Rule of thumb: convert at the edge. Parse the user's input into canonical
 * units as soon as it is typed, and format back only when drawing.
 */
import type { DistanceUnit, Exercise, Settings, WeightUnit } from '../db/types'

const LB_PER_KG = 2.2046226218
const M_PER_KM = 1000
const M_PER_MI = 1609.344

export function kgToUnit(kg: number, unit: WeightUnit): number {
  return unit === 'kg' ? kg : kg * LB_PER_KG
}

export function unitToKg(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? value : value / LB_PER_KG
}

export function metresToUnit(metres: number, unit: DistanceUnit): number {
  return metres / (unit === 'km' ? M_PER_KM : M_PER_MI)
}

export function unitToMetres(value: number, unit: DistanceUnit): number {
  return value * (unit === 'km' ? M_PER_KM : M_PER_MI)
}

/**
 * Round for display and drop a trailing ".0", so 185 lb stored as
 * 83.9146 kg shows as "185", not "184.99999" or "185.0".
 */
export function trimNumber(value: number, decimals = 1): string {
  return String(Number(value.toFixed(decimals)))
}

/** "185 lb" / "84 kg". */
export function formatWeight(kg: number, unit: WeightUnit): string {
  return `${trimNumber(kgToUnit(kg, unit))} ${unit}`
}

/** "3.1 km" / "1.9 mi". */
export function formatDistance(metres: number, unit: DistanceUnit): string {
  return `${trimNumber(metresToUnit(metres, unit), 2)} ${unit}`
}

/** The unit to show for an exercise: its own override if it has one, else the global setting. */
export function weightUnitFor(exercise: Pick<Exercise, 'weightUnit'> | undefined, settings: Settings): WeightUnit {
  return exercise?.weightUnit ?? settings.weightUnit
}

/**
 * Seconds as a clock: 75 -> "1:15", 3725 -> "1:02:05".
 * Always rounds down, so a stopwatch never shows a second that has not finished.
 */
export function formatDuration(totalSeconds: number): string {
  const whole = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const seconds = whole % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
}

/** Read a number from a text input. Returns undefined for blank or invalid text. */
export function parseNumber(text: string): number | undefined {
  const value = Number(text.replace(',', '.'))
  return text.trim() === '' || !Number.isFinite(value) || value < 0 ? undefined : value
}
