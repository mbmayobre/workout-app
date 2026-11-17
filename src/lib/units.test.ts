/** Tests for unit conversion and formatting. Run with `npm test`. */
import { describe, expect, it } from 'vitest'
import { formatDuration, formatWeight, kgToUnit, parseNumber, trimNumber, unitToKg, unitToMetres, metresToUnit } from './units'

describe('weight', () => {
  it('survives a round trip through kilograms without drifting', () => {
    // What the user typed must be what they see again, in either unit.
    for (const pounds of [2.5, 45, 135, 185, 225.5, 405]) {
      expect(trimNumber(kgToUnit(unitToKg(pounds, 'lb'), 'lb'))).toBe(String(pounds))
    }
  })

  it('formats in the requested unit', () => {
    expect(formatWeight(100, 'kg')).toBe('100 kg')
    expect(formatWeight(100, 'lb')).toBe('220.5 lb')
  })
})

describe('distance', () => {
  it('converts between metres, kilometres, and miles', () => {
    expect(unitToMetres(5, 'km')).toBe(5000)
    expect(metresToUnit(1609.344, 'mi')).toBeCloseTo(1)
  })
})

describe('formatDuration', () => {
  it('shows minutes and seconds, adding hours only when needed', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(75)).toBe('1:15')
    expect(formatDuration(3725)).toBe('1:02:05')
  })

  it('rounds down and never goes negative', () => {
    expect(formatDuration(59.9)).toBe('0:59')
    expect(formatDuration(-5)).toBe('0:00')
  })
})

describe('parseNumber', () => {
  it('reads numbers, including a decimal comma', () => {
    expect(parseNumber('82.5')).toBe(82.5)
    expect(parseNumber('82,5')).toBe(82.5)
  })

  it('rejects blank, invalid, and negative input', () => {
    expect(parseNumber('')).toBeUndefined()
    expect(parseNumber('   ')).toBeUndefined()
    expect(parseNumber('abc')).toBeUndefined()
    expect(parseNumber('-3')).toBeUndefined()
  })
})
