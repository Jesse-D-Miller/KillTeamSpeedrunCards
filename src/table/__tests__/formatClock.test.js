import { describe, expect, it } from 'vitest'
import { formatClock } from '../formatClock.js'

describe('formatClock', () => {
  it('shows minutes and seconds, and hours once past one', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(42_900)).toBe('0:42')
    expect(formatClock((12 * 60 + 5) * 1000)).toBe('12:05')
    expect(formatClock((3600 + 3 * 60 + 27) * 1000)).toBe('1:03:27')
    expect(formatClock(-5000)).toBe('0:00')
  })
})
