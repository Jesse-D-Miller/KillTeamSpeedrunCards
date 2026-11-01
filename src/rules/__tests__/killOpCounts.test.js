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

  it('leaves out every operative its rules say is ignored for the kill op, not just Bomb Squigs', () => {
    // Navis C.A.T. Unit and Gheistskull are Expendable.
    const navis = ['IMP-INB-SGT-0', 'IMP-INB-ARM-1', 'IMP-INB-ARM-2', 'IMP-INB-AXE-0', 'IMP-INB-END-0', 'IMP-INB-GNR-1', 'IMP-INB-CAT-0', 'IMP-INB-GS-0']
    expect(deriveKillOpCount('IMP-INB', navis)).toBe(6)
    expect(deriveDeadCount('IMP-INB', { 'IMP-INB-CAT-0': true, 'IMP-INB-ARM-1': true })).toBe(1)
    // The Spectre Vox-Relay Beacon too.
    const spectres = ['IMP-SPC-SGT-0', 'IMP-SPC-VRB-0', 'IMP-SPC-MED-0', 'IMP-SPC-GRN-0', 'IMP-SPC-GDE-0', 'IMP-SPC-TRP-1']
    expect(deriveKillOpCount('IMP-SPC', spectres)).toBe(5)
  })

  it('uses a starting number fixed by a team rule (Hierotek Chronomancer: 5)', () => {
    const hierotek = ['NEC-HIER-CHRON-0', 'NEC-HIER-PSYCH-0', 'NEC-HIER-TECH-0', 'NEC-HIER-PA-0', 'NEC-HIER-PR-0', 'NEC-HIER-APP-0']
    expect(deriveKillOpCount('NEC-HIER', hierotek)).toBe(5)
  })

  it('returns null when kill op count is outside supported range', () => {
    expect(deriveKillOpCount('ORK-KOM', ['ORK-KOM-NOB-1'])).toBeNull()
  })
})

describe('killGrade', async () => {
  const { killGrade } = await import('../killOpCounts.js')

  it('counts thresholds reached and the next one', () => {
    expect(killGrade(10, 0)).toEqual({ grade: 0, nextAt: 2 })
    expect(killGrade(10, 5)).toEqual({ grade: 2, nextAt: 6 })
    expect(killGrade(5, 5)).toEqual({ grade: 5, nextAt: null })
    expect(killGrade(14, 2)).toEqual({ grade: 0, nextAt: 3 })
  })

  it('is null outside the table', () => {
    expect(killGrade(4, 1)).toBeNull()
    expect(killGrade(null, 1)).toBeNull()
  })
})
