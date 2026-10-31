import { describe, expect, it } from 'vitest'
import { getKillteamById } from '../../data/ktData.js'
import { expandUnits } from '../roster.js'

// How many of each operative a team's muster offers.
const counts = (killteamId) =>
  expandUnits(getKillteamById(killteamId)).reduce(
    (map, unit) => ({ ...map, [unit.opType.opTypeName]: (map[unit.opType.opTypeName] ?? 0) + 1 }),
    {},
  )

describe('roster counts from the team composition', () => {
  it('lets the repeatable operative fill the list, others once (entries name it without the team)', () => {
    expect(counts('IMP-KAS')).toMatchObject({ 'Kasrkin Trooper': 9, 'Kasrkin Vox-Trooper': 1, 'Kasrkin Sharpshooter': 1 })
    expect(counts('IMP-DKK')['Death Korps Trooper']).toBe(9)
  })

  it('matches the longest name, so a Stub-Gunner is not a Gunner', () => {
    expect(counts('IMP-SPC')).toMatchObject({
      'Spectre Trooper': 9,
      'Spectre Gunner': 1,
      'Spectre Stub-Gunner': 1,
      'Spectre Heavy Gunner': 1,
      'Spectre Veteran Sergeant': 1,
      'Spectre Vox-Relay Beacon': 1,
    })
  })

  it('reads repeatable keywords and "up to" caps', () => {
    // "Other than MILITANT and PURGATUS operatives ... up to two PURGATUS operatives."
    expect(counts('IMP-NOV')).toMatchObject({ 'Novitiate Militant': 9, 'Novitiate Purgatus': 2, 'Novitiate Exactor': 1 })
    // "Other than BOMB SQUIG, BREAKA BOY FIGHTER, and TANKBUSTA GUNNER operatives ..."
    expect(counts('ORK-WK')).toMatchObject({ 'Breaka Boy Fighter': 5, 'Tankbusta Gunner': 5, 'Breaka Boy Krusha': 1 })
    // Warriors by keyword: "INFILTRATOR WARRIOR", "INCURSOR WARRIOR", "REIVER WARRIOR".
    expect(counts('TYR-RAV')).toMatchObject({ 'Ravener Warrior': 4, 'Ravener Wrecker': 1 })
  })

  it('takes "each operative once" with no exceptions literally, and no sentence as no limit', () => {
    expect(counts('CHAOS-PM')['Plague Marine Warrior']).toBe(1)
    expect(counts('AEL-BOK')['Dire Avenger Warrior']).toBe(7)
  })
})
