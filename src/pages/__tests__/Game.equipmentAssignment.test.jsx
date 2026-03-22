import { describe, expect, it } from 'vitest'
import { buildAssignedEquipmentForUnit } from '../Game.jsx'
import { getKillteamById } from '../../data/ktData.js'

const buildUnit = (weaponNames) => ({
  opType: {
    weapons: weaponNames.map((wepName) => ({ wepName })),
  },
})

const BREACHER_EQUIPMENT = [
  { eqId: 'IMP-INB-RB', eqName: 'Rebreathers' },
  { eqId: 'IMP-INB-SL', eqName: 'Slugs' },
  { eqId: 'IMP-INB-CS', eqName: 'Combat Stimms' },
  { eqId: 'IMP-INB-SORD', eqName: 'System Override Device' },
]

describe('buildAssignedEquipmentForUnit IMP-INB', () => {
  it('includes Slugs for units with Navis Shotgun', () => {
    const assigned = buildAssignedEquipmentForUnit({
      unit: buildUnit(['Navis Shotgun', 'Gun Butt']),
      selectedEquipment: BREACHER_EQUIPMENT,
      killteamId: 'IMP-INB',
    })

    expect(assigned.map((item) => item.eqId)).toEqual([
      'IMP-INB-RB',
      'IMP-INB-SL',
      'IMP-INB-CS',
      'IMP-INB-SORD',
    ])
  })

  it('excludes Slugs for units without Navis Shotgun', () => {
    const assigned = buildAssignedEquipmentForUnit({
      unit: buildUnit(['Navis Heavy Shotgun']),
      selectedEquipment: BREACHER_EQUIPMENT,
      killteamId: 'IMP-INB',
    })

    expect(assigned.map((item) => item.eqId)).toEqual([
      'IMP-INB-RB',
      'IMP-INB-CS',
      'IMP-INB-SORD',
    ])
  })

  it('keeps Rebreathers, Combat Stimms, and System Override Device on all IMP-INB units', () => {
    const assigned = buildAssignedEquipmentForUnit({
      unit: buildUnit(['Power Weapon']),
      selectedEquipment: BREACHER_EQUIPMENT,
      killteamId: 'IMP-INB',
    })

    expect(assigned.find((item) => item.eqId === 'IMP-INB-RB')).toBeTruthy()
    expect(assigned.find((item) => item.eqId === 'IMP-INB-CS')).toBeTruthy()
    expect(assigned.find((item) => item.eqId === 'IMP-INB-SORD')).toBeTruthy()
    expect(assigned.find((item) => item.eqId === 'IMP-INB-SL')).toBeFalsy()
  })

  it('applies Slugs across real IMP-INB operatives only when Navis Shotgun is present', () => {
    const breachers = getKillteamById('IMP-INB')
    expect(breachers).toBeTruthy()

    const operatives = breachers?.opTypes ?? []
    expect(operatives.length).toBeGreaterThan(0)

    let shotgunOperativeCount = 0
    let nonShotgunOperativeCount = 0

    operatives.forEach((opType) => {
      const weaponNames = (opType.weapons ?? []).map((weapon) =>
        String(weapon?.wepName ?? ''),
      )
      const hasNavisShotgun = weaponNames.some((name) =>
        /navis\s*shotgun/i.test(name),
      )

      if (hasNavisShotgun) shotgunOperativeCount += 1
      else nonShotgunOperativeCount += 1

      const assigned = buildAssignedEquipmentForUnit({
        unit: { opType },
        selectedEquipment: BREACHER_EQUIPMENT,
        killteamId: 'IMP-INB',
      })
      const assignedIds = assigned.map((item) => item.eqId)

      expect(assignedIds).toContain('IMP-INB-RB')
      expect(assignedIds).toContain('IMP-INB-CS')
      expect(assignedIds).toContain('IMP-INB-SORD')

      if (hasNavisShotgun) {
        expect(assignedIds).toContain('IMP-INB-SL')
      } else {
        expect(assignedIds).not.toContain('IMP-INB-SL')
      }
    })

    expect(shotgunOperativeCount).toBeGreaterThan(0)
    expect(nonShotgunOperativeCount).toBeGreaterThan(0)
  })
})
