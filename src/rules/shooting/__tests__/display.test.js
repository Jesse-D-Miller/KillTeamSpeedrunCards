import { describe, expect, it } from 'vitest'
import { badgeOf } from '../display.js'

describe('modifier switch badge', () => {
  it('shows CP cost, uses left for free limited equipment, or Used', () => {
    expect(badgeOf({ cost: 1, limit: 1, usesLeft: 1 })).toBe('1CP')
    expect(badgeOf({ cost: 0, limit: 2, usesLeft: 1 })).toBe('1/2 left')
    expect(badgeOf({ cost: 0, limit: 2, usesLeft: 0, used: true })).toBe('Used')
    expect(badgeOf({ cost: 0 })).toBe('')
  })
})
