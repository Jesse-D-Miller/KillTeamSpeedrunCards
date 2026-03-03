import { describe, expect, it } from 'vitest'
import { deriveDeadCount, deriveKillOpCount } from '../killOpCounts.js'

describe('killOpCounts helpers', () => {
  it('counts Kommandos grot and excludes Bomb Squig for kill op count', () => {
    const selectedUnits = [
      'ORK-KOM-NOB-1',
      'ORK-KOM-BOY-1',
      'ORK-KOM-BREACHA-1',
      'ORK-KOM-BURNA-1',
      'ORK-KOM-GROT-1',
      'ORK-KOM-SQUIG-1',
    ]

    expect(deriveKillOpCount('ORK-KOM', selectedUnits)).toBe(5)
  })

  it('counts dead operatives with same Squig exclusion rule', () => {
    const deadUnits = {
      'ORK-KOM-GROT-1': true,
      'ORK-KOM-SQUIG-1': true,
      'ORK-KOM-BOY-1': true,
      'ORK-KOM-BURNA-1': true,
    }

    expect(deriveDeadCount('ORK-KOM', deadUnits)).toBe(3)
  })

  it('returns null when kill op count is outside supported range', () => {
    expect(deriveKillOpCount('ORK-KOM', ['ORK-KOM-NOB-1'])).toBeNull()
  })
})
