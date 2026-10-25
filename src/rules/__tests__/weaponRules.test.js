import { describe, expect, it } from 'vitest'
import { parseWeaponRules, rangedWeaponsFor, weaponRuleChips } from '../weaponRules.js'

describe('parseWeaponRules', () => {
  it('reads range, piercing and lethal', () => {
    expect(parseWeaponRules('Rng 8", Prc1')).toMatchObject({ range: 8, piercing: 1 })
    expect(parseWeaponRules('Rng 8", Hot, Lethal 5+, Prc1')).toMatchObject({ range: 8, hot: true, lethal: 5, piercing: 1 })
  })

  it('reads area rules', () => {
    expect(parseWeaponRules('Blast 2", Sat')).toMatchObject({ blast: 2, saturate: true })
    expect(parseWeaponRules('Tor1"').torrent).toBe(1)
    expect(parseWeaponRules('Tor 2"').torrent).toBe(2)
    expect(parseWeaponRules('1" Dev3').devastating).toEqual({ distance: 1, damage: 3 })
    expect(parseWeaponRules('Dev 2').devastating).toEqual({ distance: null, damage: 2 })
  })

  it('reads heavy variants, cover rules and silent', () => {
    expect(parseWeaponRules('Hvy').heavy).toBe('any')
    expect(parseWeaponRules('Hvy(Dash)').heavy).toBe('dash')
    expect(parseWeaponRules('Hvy(Repos)').heavy).toBe('reposition')
    expect(parseWeaponRules('Seek Light')).toMatchObject({ seekLight: true })
    expect(parseWeaponRules('Seek').seek).toBe(true)
    expect(parseWeaponRules('Sil').silent).toBe(true)
    expect(parseWeaponRules('PrcCrit1, Rnd, Acc1').piercingCrits).toBe(1)
  })

  it('keeps team rules as special and lists chips', () => {
    const rules = parseWeaponRules('*Bipod, Hvy(Repos), Blast 2"')
    expect(rules.special).toEqual(['Bipod'])
    expect(weaponRuleChips(rules)).toEqual(['BLAST 2"', 'HEAVY · REPOSITION ONLY', 'BIPOD'])
  })
})

describe('rangedWeaponsFor', () => {
  const game = (weapons = {}, equipment = []) => ({
    players: { A: { killteamId: 'VOT-HKY', weapons, equipment } },
  })
  const gunner = { seat: 'A', unitKey: 'VOT-HKY-GNR-0' }

  it('lists each ranged profile of the operative', () => {
    const list = rangedWeaponsFor(game(), gunner)
    expect(list.map((weapon) => weapon.rules.blast ?? null)).toEqual([null, 2, 3])
  })

  it('follows the loadout and adds the grenades the player took', () => {
    const theyn = { seat: 'A', unitKey: 'VOT-HKY-THEYN-0' }
    const list = rangedWeaponsFor(game({ 'VOT-HKY-THEYN-0': ['VOT-HKY-THEYN-BR'] }, ['UNIVERSAL-UE-XG-FRAG', 'UNIVERSAL-UE-UG-STN']), theyn)
    expect(list.map((weapon) => weapon.id)).toEqual(['VOT-HKY-THEYN-BR-0', 'grenade-frag', 'grenade-stun'])
    expect(list[1].rules).toMatchObject({ range: 6, blast: 2, saturate: true })
    expect(list[2].rules.stunArea).toBe(1)
  })
})
