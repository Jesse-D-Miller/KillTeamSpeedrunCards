import { describe, expect, it } from 'vitest'
import { getKillteamById } from '../../data/ktData.js'
import { concealOnly, engageOnlyInBattle } from '../orders.js'

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
})
