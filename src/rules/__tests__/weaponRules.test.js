import { describe, expect, it } from 'vitest'
import { matchesKeywords, parseWeaponRules, rangedWeaponsFor, weaponRuleChips } from '../weaponRules.js'

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

describe('rangedWeaponsFor stats and extra weapons', () => {
  const player = (killteamId, equipment = []) => ({ players: { A: { killteamId, weapons: {}, equipment } } })
  const ids = (game, unitKey) => rangedWeaponsFor(game, { seat: 'A', unitKey }).map((weapon) => weapon.id)

  it('gives each profile its Atk, Hit and Dmg', () => {
    const [revolver, , longRange] = rangedWeaponsFor(player('VOT-HKY'), { seat: 'A', unitKey: 'VOT-HKY-THEYN-0' })
    expect(revolver).toMatchObject({ atk: 4, hit: 3, dmg: { normal: 3, crit: 5 }, source: 'datacard' })
    // Current rules: the long-range bolt shotgun is 2/3.
    expect(longRange).toMatchObject({ profile: 'Long Range', atk: 4, hit: 5, dmg: { normal: 2, crit: 3 } })
  })

  it('adds equipment weapons for the operatives they’re for', () => {
    const game = player('ORK-KOM', ['ORK-KOM-DYN', 'ORK-KOM-HRP'])
    expect(ids(game, 'ORK-KOM-BOY-0')).toEqual(['ORK-KOM-BOY-SLG-0', 'ORK-KOM-DYN-0', 'ORK-KOM-HRP-0', 'grenade-stun'])
    // "(excluding BOMB SQUIG and GROT)"
    expect(ids(game, 'ORK-KOM-GROT-0')).toEqual([])
    expect(ids(game, 'ORK-KOM-SQUIG-0')).toEqual(['ORK-KOM-SQUIG-EXPL-0'])
    const [, dynamite] = rangedWeaponsFor(game, { seat: 'A', unitKey: 'ORK-KOM-BOY-0' })
    expect(dynamite).toMatchObject({ atk: 5, hit: 4, uses: 'Once per battle', rules: { range: 4, blast: 1, saturate: true, heavy: 'reposition', limited: 1 } })
  })

  it('gives Grenadiers frag and krak grenades with their Hit bonus', () => {
    const list = rangedWeaponsFor(player('IMP-AOD'), { seat: 'A', unitKey: 'IMP-AOD-GRN-0' })
    expect(list.map((weapon) => weapon.id)).toEqual(['IMP-AOD-GRN-HBP-0', 'grenade-frag', 'grenade-krak'])
    expect(list[1]).toMatchObject({ source: 'grenade', grenade: 'frag', grenadier: { hitBonus: 1 } })
  })

  it('reads equipment weapon rules from the table when the data leaves them out', () => {
    const [, , , , charge] = rangedWeaponsFor(player('TYR-WB', ['TYR-WB-BC']), { seat: 'A', unitKey: 'TYR-WB-GNR-0' })
    expect(charge).toMatchObject({ name: 'Blasting Charge', rules: { range: 4, blast: 1, saturate: true } })
  })

  it('Tactical Wot-Notz gives Kommando Boys the Stun grenade action', () => {
    expect(ids(player('ORK-KOM'), 'ORK-KOM-BOY-0')).toContain('grenade-stun')
    expect(ids(player('ORK-KOM'), 'ORK-KOM-NOB-0')).not.toContain('grenade-stun')
  })
})

describe('matchesKeywords', () => {
  it('needs the phrase to be made of the operative’s keywords', () => {
    const keywords = new Set(['WYRMBLADE', 'TYRANIDS', 'NEOPHYTE', 'GUNNER'])
    expect(matchesKeywords('WYRMBLADE NEOPHYTE', keywords)).toBe(true)
    expect(matchesKeywords('WYRMBLADE LEADER', keywords)).toBe(false)
    expect(matchesKeywords('PLAGUE MARINE', new Set(['PLAGUE MARINE', 'CHAOS']))).toBe(true)
  })
})
