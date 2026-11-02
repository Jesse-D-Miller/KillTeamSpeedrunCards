import { describe, expect, it } from 'vitest'
import { getKillteamById } from '../../data/ktData.js'
import { chargeOnConceal, concealOnly, engageOnlyInBattle } from '../orders.js'

const opType = (killteamId, opTypeId) => getKillteamById(killteamId).opTypes.find((candidate) => candidate.opTypeId === opTypeId)

describe('order rules', () => {
  it('knows Bomb Squigs can only take an Engage order in the battle', () => {
    expect(engageOnlyInBattle(opType('ORK-KOM', 'ORK-KOM-SQUIG'))).toBe(true)
    expect(engageOnlyInBattle(opType('ORK-WK', 'ORK-WK-SQUIG'))).toBe(true)
    expect(engageOnlyInBattle(opType('ORK-KOM', 'ORK-KOM-GROT'))).toBe(false)
  })

  it('knows Kommando Grots can never take an Engage order', () => {
    expect(concealOnly(opType('ORK-KOM', 'ORK-KOM-GROT'))).toBe(true)
    expect(concealOnly(opType('ORK-KOM', 'ORK-KOM-BOY'))).toBe(false)
  })

  it('knows who can Charge on a Conceal order', () => {
    // Kommandos' Throat Slittas, except Bomb Squigs.
    expect(chargeOnConceal(opType('ORK-KOM', 'ORK-KOM-BOY'))).toBe(true)
    expect(chargeOnConceal(opType('ORK-KOM', 'ORK-KOM-SQUIG'))).toBe(false)
    // A Yaegir Bladekyn's Stalker, but not the other Yaegirs.
    expect(chargeOnConceal(opType('VOT-HKY', 'VOT-HKY-BLD'))).toBe(true)
    expect(chargeOnConceal(opType('VOT-HKY', 'VOT-HKY-WAR'))).toBe(false)
  })
})
