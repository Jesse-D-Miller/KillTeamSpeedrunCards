import { describe, expect, it } from 'vitest'
import { createGame } from '../../../../shared/game.js'
import { applyAction } from '../../../../shared/reducer.js'
import { parseAttackText, parseDefenceText } from '../generic.js'
import { computeAttack, computeShot, glanceShot, shotKey } from '../index.js'
import { meleeWeaponsFor } from '../../weaponRules.js'
import { inTorchZone } from '../teams/vespidStingwings.js'

// Operatives on 28.5mm bases (radius ~0.56") along y = 5, shooter on the left.
const op = (id, seat, unitKey, x, y = 5, extra = {}) => ({ id, seat, unitKey, x, y, baseMm: 28.5, label: id, ...extra })
// A wall across the targeting lines at x.
const wall = (id, type, x, y1 = 2, y2 = 8) => ({ id, featureId: id, type, start: { x, y: y1 }, end: { x, y: y2 } })
const engage = (...unitKeys) => Object.fromEntries(unitKeys.map((unitKey) => [unitKey, { order: 'engage' }]))

const setup = ({ teams = ['VOT-HKY', 'TAU-VESP'], tokens, units = {}, equipment = {}, ploys = {}, phase = 'battle', markers = [], shots = {} }) => {
  const base = createGame()
  const player = (seat, killteamId) => ({
    ...base.players[seat],
    killteamId,
    equipment: equipment[seat] ?? [],
    ploysByTp: { 1: ploys[seat] ?? [] },
    unitState: units[seat] ?? {},
  })
  return {
    ...base,
    phase,
    battle: { ...base.battle, tp: 1, firefightTp: 1, shots },
    tokens,
    markers,
    players: { A: player('A', teams[0]), B: player('B', teams[1]) },
  }
}
const shoot = (game, weaponId, { walls = [], point = null, shooter = 's', target = 't' } = {}) =>
  computeShot({ game, layout: { walls, areas: [] }, payload: { shooterId: shooter, targetId: target, weaponId, point } })
const toggled = (seat, toggles, key = 'shoot|s|t') => ({ [key]: { toggles: { A: {}, B: {}, [seat]: toggles }, spent: { A: {}, B: {} } } })
const find = (shot, side, name) => shot.modifiers[side].find((modifier) => modifier.name === name)
const ruleState = (shot, key) => shot.attack.rules.find((rule) => rule.key === key)?.state
const rerolls = (shot, side = 'attack') => shot[side].rerolls.map((entry) => entry.text)

// Theyn (bolt revolver 4 / 3+ / 3/5, Range 8") shoots a Vespid Warrior (Save 5+) 6" away.
const THEYN = 'VOT-HKY-THEYN-0'
const WARRIOR = 'TAU-VESP-WAR-0'
const basic = (extra = {}) =>
  setup({
    tokens: [op('s', 'A', THEYN, 2), op('t', 'B', WARRIOR, 8)],
    units: { A: engage(THEYN), B: engage(WARRIOR) },
    ...extra,
  })

describe('shot card numbers', () => {
  it('reads the datacard: Atk, Hit, crits and Dmg, then 3 defence dice against the Save', () => {
    const shot = shoot(basic(), 'VOT-HKY-THEYN-BR-0')
    expect(shot.valid).toBe(true)
    expect(shot.attack.dice).toMatchObject({ base: 4, value: 4, rolled: 4, auto: 0, tone: 'same' })
    expect(shot.attack.hit).toMatchObject({ value: 3, tone: 'same' })
    expect(shot.attack.crit).toMatchObject({ value: 6, crits: 'yes', tone: 'same' })
    expect(shot.attack.dmg.normal.value).toBe(3)
    expect(shot.attack.dmg.crit.value).toBe(5)
    expect(shot.defence.dice).toMatchObject({ value: 3, tone: 'same' })
    expect(shot.defence.save).toMatchObject({ base: 5, value: 5, tone: 'same' })
    expect(shot.defence).toMatchObject({ rolled: 3, auto: { count: 0, tone: 'same' } })
  })

  it('an injured shooter’s Hit is worse by 1', () => {
    const shot = shoot(basic({ units: { A: { [THEYN]: { order: 'engage', wounds: 4 } }, B: engage(WARRIOR) } }), 'VOT-HKY-THEYN-BR-0')
    expect(shot.attack.hit).toMatchObject({ base: 3, value: 4, tone: 'worse' })
    expect(find(shot, 'attack', 'Injured').on).toBe(true)
  })

  it('a target out of Range isn’t valid', () => {
    const game = setup({ tokens: [op('s', 'A', THEYN, 2), op('t', 'B', WARRIOR, 12)], units: { A: engage(THEYN), B: engage(WARRIOR) } })
    expect(shoot(game, 'VOT-HKY-THEYN-BR-0').blocks.map((block) => block.code)).toEqual(['range'])
  })

  it('cover keeps one normal success without rolling; Saturate takes the cover save away', () => {
    const walls = [wall('w', 'light', 7.2)]
    const covered = shoot(basic(), 'VOT-HKY-THEYN-BR-0', { walls })
    expect(covered.defence.auto).toMatchObject({ normal: 1, crit: 0, count: 1, tone: 'better' })
    expect(covered.defence.rolled).toBe(2)
    const frag = shoot(basic({ equipment: { A: ['UNIVERSAL-UE-XG-FRAG'] } }), 'grenade-frag', { walls })
    expect(frag.defence.auto).toMatchObject({ count: 0, tone: 'worse', saturated: true })
    expect(find(frag, 'defence', 'Cover').text).toMatch(/Saturate/)
  })

  it('obscured: no crits, so rules that need one do nothing', () => {
    const game = setup({
      teams: ['TAU-VESP', 'VOT-HKY'],
      tokens: [op('s', 'A', WARRIOR, 2), op('t', 'B', THEYN, 8)],
      units: { A: engage(WARRIOR), B: engage(THEYN) },
    })
    const shot = shoot(game, 'TAU-VESP-WAR-NB-0', { walls: [wall('w', 'heavy', 5)] })
    expect(shot.state.obscured).toBe(true)
    expect(shot.attack.crit).toMatchObject({ crits: 'none', tone: 'worse' })
    expect(ruleState(shot, 'devastating')).toBe('blocked')
    expect(shot.attack.dmg.devastating).toBeNull()
  })

  it('two Accurate rules count as Accurate 2 (here Vantage and Warrior Instincts)', () => {
    const game = setup({
      teams: ['TAU-VESP', 'VOT-HKY'],
      tokens: [op('s', 'A', WARRIOR, 2), op('t', 'B', THEYN, 7)],
      units: { A: { [WARRIOR]: { order: 'engage', vantage: 2 } }, B: engage(THEYN) },
    })
    const shot = shoot(game, 'TAU-VESP-WAR-NB-0')
    expect(shot.attack.dice).toMatchObject({ value: 4, auto: 2, rolled: 2, accurate: 2, tone: 'better' })
  })

  it('Piercing takes defence dice away; Piercing Crits only once a crit is kept', () => {
    const gunner = setup({
      tokens: [op('s', 'A', 'VOT-HKY-GNR-0', 2), op('t', 'B', WARRIOR, 8)],
      units: { A: engage('VOT-HKY-GNR-0'), B: engage(WARRIOR) },
    })
    expect(shoot(gunner, 'VOT-HKY-GNR-APM-0').defence.dice).toMatchObject({ value: 2, tone: 'worse', ifCrit: null })
    const grenadier = setup({
      teams: ['IMP-AOD', 'TAU-VESP'],
      tokens: [op('s', 'A', 'IMP-AOD-GRN-0', 2), op('t', 'B', WARRIOR, 6)],
      units: { A: engage('IMP-AOD-GRN-0'), B: engage(WARRIOR) },
    })
    expect(shoot(grenadier, 'IMP-AOD-GRN-HBP-0').defence.dice).toMatchObject({ value: 3, ifCrit: 2 })
  })

  it('Grenadier: frag and krak without the equipment, Hit improved by 1', () => {
    const game = setup({
      teams: ['IMP-AOD', 'TAU-VESP'],
      tokens: [op('s', 'A', 'IMP-AOD-GRN-0', 2), op('t', 'B', WARRIOR, 6)],
      units: { A: engage('IMP-AOD-GRN-0'), B: engage(WARRIOR) },
    })
    const shot = shoot(game, 'grenade-krak')
    expect(shot.attack.hit).toMatchObject({ base: 4, value: 3, tone: 'better' })
    expect(shot.defence.dice.value).toBe(2)
  })

  it('a Save is never better than 2+ (Portable Barricade on an Oversight Drone)', () => {
    const drone = 'TAU-VESP-OSD-0'
    const game = setup({
      tokens: [op('s', 'A', THEYN, 2), op('t', 'B', drone, 7)],
      units: { A: engage(THEYN), B: engage(drone) },
      equipment: { B: ['UNIVERSAL-UE-PB'] },
      shots: toggled('B', { 'UNIVERSAL-UE-PB': true }),
    })
    const shot = shoot(game, 'VOT-HKY-THEYN-BR-0')
    expect(shot.defence.save).toMatchObject({ base: 2, value: 2, tone: 'same' })
    // The barricade it's connected to gives it a cover save too.
    expect(shot.defence.auto.count).toBe(1)
  })

  it('in cover from and obscured by the same terrain: obscured unless the defender takes the cover save', () => {
    // One Heavy feature (a ruin): one wall within 1" of the target, one further out.
    const walls = [
      { ...wall('near', 'heavy', 7.2), featureId: 'ruin' },
      { ...wall('far', 'heavy', 5, 4.9, 8), featureId: 'ruin' },
    ]
    const obscured = shoot(basic(), 'VOT-HKY-THEYN-BR-0', { walls })
    expect(obscured.state).toMatchObject({ choose: true, obscured: true, cover: false })
    const cover = shoot(basic({ shots: toggled('B', { 'core-cover-choice': true }) }), 'VOT-HKY-THEYN-BR-0', { walls })
    expect(cover.state).toMatchObject({ choose: true, obscured: false, cover: true })
    expect(cover.defence.auto.count).toBe(1)
  })
})

describe('Hernkyn Yaegirs', () => {
  it('Hidden Engagement: Balanced while in cover from every point of the target’s base', () => {
    const game = basic({ ploys: { A: ['VOT-HKY-S-HE'] } })
    const inCover = shoot(game, 'VOT-HKY-THEYN-BR-0', { walls: [wall('w', 'light', 3, 0, 10)] })
    expect(find(inCover, 'attack', 'Hidden Engagement').mode).toBe('auto')
    expect(rerolls(inCover)).toContain('Balanced (1 die)')
    const open = shoot(game, 'VOT-HKY-THEYN-BR-0')
    expect(find(open, 'attack', 'Hidden Engagement').mode).toBe('inactive')
    expect(rerolls(open)).toEqual([])
  })

  it('In Position: a Conceal Yaegir in cover can’t be targeted, even with Seek, except within 2"', () => {
    const burna = 'ORK-KOM-BRN-0'
    const make = (x, ploys) =>
      setup({ teams: ['ORK-KOM', 'VOT-HKY'], tokens: [op('s', 'A', burna, 2), op('t', 'B', THEYN, x)], units: { A: engage(burna) }, ploys })
    const walls = [wall('w', 'light', 4.7)]
    // The deluge burna has Seek, so cover doesn't stop it picking the target...
    expect(shoot(make(5.5), 'ORK-KOM-BRN-BRN-1', { walls }).valid).toBe(true)
    // ...but In Position takes precedence.
    const inPosition = shoot(make(5.5, { B: ['VOT-HKY-S-IP'] }), 'ORK-KOM-BRN-BRN-1', { walls })
    expect(inPosition.valid).toBe(false)
    expect(inPosition.blocks.map((block) => block.text)).toContain('In Position: Conceal order and in cover')
    // Within 2" there's no cover.
    expect(shoot(make(4.9, { B: ['VOT-HKY-S-IP'] }), 'ORK-KOM-BRN-BRN-1', { walls: [wall('w', 'light', 4.2)] }).valid).toBe(true)
  })

  it('Bipod: Ceaseless unless it moved this activation', () => {
    const gunner = 'VOT-HKY-GNR-0'
    const still = setup({ tokens: [op('s', 'A', gunner, 2), op('t', 'B', WARRIOR, 8)], units: { A: { [gunner]: { order: 'engage', activation: 'active' } } } })
    expect(rerolls(shoot(still, 'VOT-HKY-GNR-APM-0'))).toContain('Ceaseless (one result)')
    const moved = setup({
      tokens: [op('s', 'A', gunner, 2, 5, { lastMove: { from: { x: 1, y: 5 }, path: [], inches: 1 } }), op('t', 'B', WARRIOR, 8)],
      units: { A: { [gunner]: { order: 'engage', activation: 'active' } } },
    })
    const shot = shoot(moved, 'VOT-HKY-GNR-APM-0')
    expect(find(shot, 'attack', 'Bipod').mode).toBe('inactive')
    expect(rerolls(shot)).toEqual([])
  })

  it('Tracker: Punishing against an expended enemy within 6"', () => {
    const tracker = 'VOT-HKY-TRK-0'
    const game = (activation) =>
      setup({ tokens: [op('s', 'A', tracker, 2), op('t', 'B', WARRIOR, 7)], units: { A: engage(tracker), B: { [WARRIOR]: { order: 'engage', activation } } } })
    expect(ruleState(shoot(game('expended'), 'VOT-HKY-TRK-SINR-0'), 'punishing')).toBe('added')
    expect(find(shoot(game('ready'), 'VOT-HKY-TRK-SINR-0'), 'attack', 'Tracker').mode).toBe('inactive')
  })

  it('Pan Spectral Visor: within 6" the target can’t be obscured and Light terrain doesn’t hide it', () => {
    const tracker = 'VOT-HKY-TRK-0'
    const game = setup({ tokens: [op('s', 'A', tracker, 2), op('t', 'B', WARRIOR, 7)], units: { A: engage(tracker) } })
    expect(shoot(game, 'VOT-HKY-TRK-SINR-0', { walls: [wall('h', 'heavy', 4.5)] }).state.obscured).toBe(false)
    // A Conceal target in Light cover is still a valid target (Seek Light).
    expect(shoot(game, 'VOT-HKY-TRK-SINR-0', { walls: [wall('l', 'light', 6.2)] }).valid).toBe(true)
  })

  it('Weavewërke Cloak: ignores Saturate, and a cover save can be kept as a crit or one more', () => {
    const burna = 'ORK-KOM-BRN-0'
    const riflekyn = 'VOT-HKY-RFL-0'
    const game = setup({
      teams: ['ORK-KOM', 'VOT-HKY'],
      tokens: [op('s', 'A', burna, 2), op('t', 'B', riflekyn, 8)],
      units: { A: engage(burna), B: engage(riflekyn) },
    })
    const shot = shoot(game, 'ORK-KOM-BRN-BRN-0', { walls: [wall('w', 'light', 7.2)] })
    expect(ruleState(shot, 'saturate')).toBe('removed')
    expect(shot.defence.auto).toMatchObject({ crit: 1, alt: { normal: 2, crit: 0 }, best: 2 })
  })

  it('Sturdy: the attacker’s crits become normal successes', () => {
    const game = setup({
      teams: ['TAU-VESP', 'VOT-HKY'],
      tokens: [op('s', 'A', WARRIOR, 2), op('t', 'B', THEYN, 8)],
      units: { A: engage(WARRIOR), B: engage(THEYN) },
      shots: toggled('B', { 'VOT-HKY-T-STRD': true }),
    })
    const shot = shoot(game, 'TAU-VESP-WAR-NB-0')
    expect(find(shot, 'defence', 'Sturdy')).toMatchObject({ on: true, cost: 1, limit: 1, owner: 'defender' })
    expect(shot.attack.crit).toMatchObject({ crits: 'normal', tone: 'worse' })
    expect(shot.attack.dmg.crit).toMatchObject({ value: 3, tone: 'worse' })
    // Devastating already resolved when the crit was kept.
    expect(shot.attack.dmg.devastating).toBe(2)
  })

  it('KV-Ceramide Undersuit: a defence re-roll against Blast, and no x" Devastating splash', () => {
    const skyblast = 'TAU-VESP-VSB-0'
    const game = setup({
      teams: ['TAU-VESP', 'VOT-HKY'],
      tokens: [op('s', 'A', skyblast, 2), op('t', 'B', THEYN, 8)],
      units: { A: engage(skyblast), B: engage(THEYN) },
      equipment: { B: ['VOT-HKY-KVCU'] },
    })
    const shot = shoot(game, 'TAU-VESP-VSB-NGL-0')
    expect(rerolls(shot, 'defence')).toContain('KV-Ceramide Undersuit')
    expect(shot.immuneToDevastating(game.tokens[1])).toBe(true)
    expect(shot.immuneToDevastating(game.tokens[0])).toBe(false)
  })

  it('Firestorm and Stabilised Bolt Shells for the bolt shotgun', () => {
    const equipment = { A: ['VOT-HKY-FSBS', 'VOT-HKY-SBS'] }
    const short = shoot(basic({ equipment, shots: toggled('A', { 'VOT-HKY-FSBS': true }) }), 'VOT-HKY-THEYN-BS-0', {})
    expect(short.rules.blast).toBe(1)
    expect(find(short, 'attack', 'Firestorm Bolt Shells')).toMatchObject({ on: true, limit: 1 })
    const long = shoot(basic({ equipment, shots: toggled('A', { 'VOT-HKY-SBS': true }) }), 'VOT-HKY-THEYN-BS-1')
    expect(long.attack.hit).toMatchObject({ base: 5, value: 4, tone: 'better' })
    expect(long.attack.dmg.normal).toMatchObject({ base: 2, value: 3, tone: 'better' })
    expect(long.attack.dmg.crit).toMatchObject({ base: 3, value: 4 })
    expect(long.attack.dice.auto).toBe(1)
  })
})

describe('Vespid Stingwings', () => {
  const vespidShot = (extra = {}, target = THEYN) =>
    setup({
      teams: ['TAU-VESP', 'VOT-HKY'],
      tokens: [op('s', 'A', WARRIOR, 2), op('t', 'B', target, 7)],
      units: { A: engage(WARRIOR), B: engage(target) },
      ...extra,
    })

  it('Neutron Charge: Piercing 1 once it has moved this turning point', () => {
    expect(shoot(vespidShot(), 'TAU-VESP-WAR-NB-0').defence.dice.value).toBe(3)
    const moved = vespidShot({ units: { A: { [WARRIOR]: { order: 'engage', movedTp: 1 } }, B: engage(THEYN) } })
    expect(shoot(moved, 'TAU-VESP-WAR-NB-0').defence.dice).toMatchObject({ value: 2, tone: 'worse' })
  })

  it('Airborne Predators: Balanced after moving this activation', () => {
    const moved = vespidShot({
      ploys: { A: ['TAU-VESP-S-AP'] },
      tokens: [op('s', 'A', WARRIOR, 2, 5, { lastMove: { from: { x: 0, y: 5 }, path: [], inches: 2 } }), op('t', 'B', THEYN, 7)],
      units: { A: { [WARRIOR]: { order: 'engage', activation: 'active' } }, B: engage(THEYN) },
    })
    expect(rerolls(shoot(moved, 'TAU-VESP-WAR-NB-0'))).toContain('Balanced (1 die)')
    expect(find(shoot(vespidShot({ ploys: { A: ['TAU-VESP-S-AP'] } }), 'TAU-VESP-WAR-NB-0'), 'attack', 'Airborne Predators').mode).toBe('inactive')
  })

  it('Warrior Instincts: Accurate 1 unless a Communion point is spent', () => {
    expect(shoot(vespidShot(), 'TAU-VESP-WAR-NB-0').attack.dice.auto).toBe(1)
    const reroll = shoot(vespidShot({ shots: toggled('A', { 'TAU-VESP-communion-reroll': true }) }), 'TAU-VESP-WAR-NB-0')
    expect(reroll.attack.dice.auto).toBe(0)
    expect(find(reroll, 'attack', 'Warrior Instincts').mode).toBe('inactive')
    expect(rerolls(reroll)).toContain('Communion')
  })

  it('Communion: a point to target anything but the closest enemy within 8"', () => {
    const game = vespidShot({ tokens: [op('s', 'A', WARRIOR, 2), op('t', 'B', THEYN, 9), op('n', 'B', 'VOT-HKY-WAR-0', 5, 8)] })
    const shot = shoot(game, 'TAU-VESP-WAR-NB-0')
    expect(find(shot, 'attack', 'Communion')).toMatchObject({ mode: 'warning' })
    expect(shot.attack.dice.auto).toBe(0)
    // More than 8" away always needs a point (FAQ).
    const far = shoot(vespidShot({ tokens: [op('s', 'A', WARRIOR, 2), op('t', 'B', THEYN, 12)] }), 'TAU-VESP-WAR-NB-0')
    expect(far.modifiers.attack.some((modifier) => modifier.mode === 'warning' && /more than 8"/.test(modifier.text))).toBe(true)
  })

  it('Ocelli: Vantage benefits as if 3" higher', () => {
    const game = vespidShot({
      tokens: [op('s', 'A', WARRIOR, 2, 5, { lastMove: { from: { x: 0, y: 5 }, path: [], inches: 2 } }), op('t', 'B', THEYN, 7)],
      units: { A: { [WARRIOR]: { order: 'engage', activation: 'active' } }, B: engage(THEYN) },
      shots: toggled('A', { 'TAU-VESP-T-OCL': true, 'TAU-VESP-warrior-instincts': false }),
    })
    const shot = shoot(game, 'TAU-VESP-WAR-NB-0')
    expect(find(shot, 'attack', 'Vantage').text).toMatch(/Accurate 1/)
    expect(shot.attack.dice.auto).toBe(1)
  })

  it('Aerial Guidance: Lethal 5+ and Saturate when a guiding Oversight Drone is near', () => {
    const drone = 'TAU-VESP-OSD-0'
    const game = vespidShot({
      tokens: [op('s', 'A', WARRIOR, 2), op('t', 'B', THEYN, 7), op('d', 'A', drone, 3, 7)],
      shots: toggled('A', { 'TAU-VESP-aerial-guidance': true }),
    })
    const shot = shoot(game, 'TAU-VESP-WAR-NB-0')
    expect(shot.attack.crit).toMatchObject({ value: 5, tone: 'better' })
    expect(ruleState(shot, 'saturate')).toBe('added')
  })

  it('Camouflaged: ignores Piercing and cover saves are crits; Ghost Rig: Conceal and more than 6" away isn’t valid', () => {
    const shadestrain = 'TAU-VESP-VSS-0'
    const game = (x, order) =>
      setup({ tokens: [op('s', 'A', 'VOT-HKY-GNR-0', 2), op('t', 'B', shadestrain, x)], units: { A: engage('VOT-HKY-GNR-0'), B: { [shadestrain]: { order } } } })
    const camo = shoot(game(7, 'engage'), 'VOT-HKY-GNR-APM-0', { walls: [wall('w', 'light', 6.2)] })
    expect(camo.defence.dice.value).toBe(3)
    expect(camo.defence.auto).toMatchObject({ crit: 1, normal: 0 })
    expect(shoot(game(9.5, 'conceal'), 'VOT-HKY-GNR-APM-0').blocks.map((block) => block.code)).toContain('TAU-VESP-ghost-rig')
    expect(shoot(game(7, 'conceal'), 'VOT-HKY-GNR-APM-0').valid).toBe(true)
  })

  it('Evasive Drone: ignores Piercing; Conceal in cover isn’t a valid target', () => {
    const drone = 'TAU-VESP-OSD-0'
    const game = (order) =>
      setup({ tokens: [op('s', 'A', 'VOT-HKY-GNR-0', 2), op('t', 'B', drone, 7)], units: { A: engage('VOT-HKY-GNR-0'), B: { [drone]: { order } } } })
    expect(shoot(game('engage'), 'VOT-HKY-GNR-APM-0').defence.dice.value).toBe(3)
    expect(shoot(game('conceal'), 'VOT-HKY-GNR-APM-0', { walls: [wall('w', 'heavy', 6.2)] }).valid).toBe(false)
  })

  it('Skytorch: only operatives in its torch zone, never in cover or obscured', () => {
    const swarmguard = 'TAU-VESP-VSG-0'
    const moved = { lastMove: { from: { x: 2, y: 9 }, path: [], inches: 5 } }
    const game = (targetY) =>
      setup({
        teams: ['TAU-VESP', 'VOT-HKY'],
        tokens: [op('s', 'A', swarmguard, 2, 3, moved), op('t', 'B', THEYN, 2.6, targetY)],
        units: { A: engage(swarmguard) },
      })
    const inZone = shoot(game(6), 'TAU-VESP-VSG-FL-1', { walls: [wall('w', 'heavy', 2.3, 0, 10)] })
    expect(inZone).toMatchObject({ valid: true, state: { cover: false, obscured: false } })
    expect(inTorchZone(game(6).tokens[0], game(6).tokens[1])).toBe(true)
    expect(shoot(setup({
      teams: ['TAU-VESP', 'VOT-HKY'],
      tokens: [op('s', 'A', swarmguard, 2, 3, moved), op('t', 'B', THEYN, 8, 6)],
      units: { A: engage(swarmguard) },
    }), 'TAU-VESP-VSG-FL-1').blocks.map((block) => block.code)).toEqual(['torch'])
  })
})

describe('Kommandos', () => {
  const BOY = 'ORK-KOM-BOY-0'
  const kommandos = (extra = {}) =>
    setup({ teams: ['ORK-KOM', 'TAU-VESP'], tokens: [op('s', 'A', BOY, 2), op('t', 'B', WARRIOR, 7)], units: { A: engage(BOY), B: engage(WARRIOR) }, ...extra })

  it('DAKKA! DAKKA! DAKKA!: ranged weapons have Punishing', () => {
    expect(ruleState(shoot(kommandos({ ploys: { A: ['ORK-KOM-S-DD'] } }), 'ORK-KOM-BOY-SLG-0'), 'punishing')).toBe('added')
  })

  it('Collapsible Stocks: the slugga loses its Range', () => {
    const far = { tokens: [op('s', 'A', BOY, 2), op('t', 'B', WARRIOR, 14)] }
    expect(shoot(kommandos(far), 'ORK-KOM-BOY-SLG-0').valid).toBe(false)
    const stocked = shoot(kommandos({ ...far, equipment: { A: ['ORK-KOM-CS'] } }), 'ORK-KOM-BOY-SLG-0')
    expect(stocked.valid).toBe(true)
    expect(ruleState(stocked, 'range')).toBe('removed')
  })

  it('Skulk About: a Conceal Kommando keeps one more normal success without rolling, even against Saturate', () => {
    const game = setup({
      teams: ['VOT-HKY', 'ORK-KOM'],
      tokens: [op('s', 'A', THEYN, 2), op('t', 'B', BOY, 6)],
      units: { A: engage(THEYN) },
      equipment: { A: ['UNIVERSAL-UE-XG-FRAG'] },
      ploys: { B: ['ORK-KOM-S-SA'] },
    })
    expect(shoot(game, 'grenade-frag').defence.auto).toMatchObject({ normal: 1, count: 1 })
  })

  it('Sneaky Zogger: a Grot in cover can’t be targeted, and Just A Scratch isn’t for Grots', () => {
    const grot = 'ORK-KOM-GROT-0'
    const game = setup({ teams: ['VOT-HKY', 'ORK-KOM'], tokens: [op('s', 'A', THEYN, 2), op('t', 'B', grot, 7)], units: { A: engage(THEYN) } })
    const shot = shoot(game, 'VOT-HKY-THEYN-BR-0', { walls: [wall('w', 'light', 6.2)] })
    expect(shot.blocks.map((block) => block.code)).toContain('ORK-KOM-sneaky-zogger')
    expect(find(shot, 'defence', 'Just A Scratch')).toBeUndefined()
    const boy = setup({ teams: ['VOT-HKY', 'ORK-KOM'], tokens: [op('s', 'A', THEYN, 2), op('t', 'B', BOY, 7)], units: { A: engage(THEYN) } })
    expect(find(shoot(boy, 'VOT-HKY-THEYN-BR-0'), 'defence', 'Just A Scratch')).toMatchObject({ mode: 'toggle', cost: 1, limit: 1 })
  })

  it('Explosive: the Bomb Squig is the primary target, so only operatives near it can be hit', () => {
    const squig = 'ORK-KOM-SQUIG-0'
    const near = setup({ teams: ['ORK-KOM', 'TAU-VESP'], tokens: [op('s', 'A', squig, 2), op('t', 'B', WARRIOR, 3.5)] })
    const shot = shoot(near, 'ORK-KOM-SQUIG-EXPL-0')
    expect(shot.valid).toBe(true)
    expect(shot.modifiers.attack.some((modifier) => modifier.mode === 'warning')).toBe(false)
    const far = setup({ teams: ['ORK-KOM', 'TAU-VESP'], tokens: [op('s', 'A', squig, 2), op('t', 'B', WARRIOR, 6)] })
    expect(shoot(far, 'ORK-KOM-SQUIG-EXPL-0').blocks.map((block) => block.code)).toEqual(['explosive'])
  })
})

describe('other kill teams (read from their rules text)', () => {
  it('reads weapon rules, Hit and Dmg changes from attack rules', () => {
    expect(parseAttackText('Friendly DEATH KORPS operatives’ ranged weapons have the Saturate and Accurate 1 weapon rules.').effect).toEqual({
      accurate: 1,
      addRules: { saturate: true },
    })
    expect(
      parseAttackText('Whenever a friendly HEARTHKYN SALVAGER operative is shooting an enemy operative within 6" of it, improve the Hit stat of that friendly operative’s ranged weapons by 1 (to a maximum of 3+).').effect,
    ).toEqual({ hit: -1, hitMax: 3 })
    // An alternative ("if it already has Balanced, Ceaseless instead") isn't added too.
    expect(
      parseAttackText('…its weapons have the Balanced weapon rule; if the weapon already has that weapon rule, it has the Ceaseless weapon rule instead of Balanced.').effect,
    ).toEqual({ addRules: { balanced: true } })
  })

  it('reads defence rules', () => {
    expect(parseDefenceText('Whenever an operative is shooting this operative, ignore the Piercing weapon rule.').effect).toEqual({ ignorePiercing: true })
    expect(parseDefenceText('you can retain one of your defence dice as a normal success without rolling it').effect).toEqual({ extraAutoSaves: 1 })
    expect(parseDefenceText('worsen the Hit stat of that operative’s weapons by 1').effect).toEqual({ hit: 1 })
  })

  it('applies an active, unconditional strategy ploy; conditional rules wait for their owner', () => {
    const bruiser = 'IMP-DKK-BRU-0'
    const game = (ploys) =>
      setup({
        teams: ['IMP-DKK', 'TAU-VESP'],
        tokens: [op('s', 'A', bruiser, 2), op('t', 'B', WARRIOR, 7)],
        units: { A: engage(bruiser), B: engage(WARRIOR) },
        ploys,
      })
    // Siege Warfare: "ranged weapons have the Saturate and Accurate 1 weapon rules".
    const siege = shoot(game({ A: ['IMP-DKK-S-SWF'] }), 'IMP-DKK-BRU-LG-0', { walls: [wall('w', 'light', 6.2)] })
    expect(find(siege, 'attack', 'Siege Warfare')).toMatchObject({ mode: 'auto', generic: true })
    expect(siege.attack.dice.auto).toBe(1)
    expect(siege.defence.auto).toMatchObject({ count: 0, saturated: true })
    // Take Cover has conditions: a reminder for the defender's opponent? No: it's a
    // Death Korps defence rule, so it doesn't show when they're shooting.
    expect(find(siege, 'attack', 'Take Cover')).toBeUndefined()
    // Combined Arms (firefight) is offered with its CP cost.
    expect(find(siege, 'attack', 'Combined Arms')).toMatchObject({ mode: 'toggle', cost: 1, limit: 1 })
  })
})

describe('at a glance', () => {
  it('uses every rule: In Position makes a Conceal Yaegir in cover invalid', () => {
    const game = setup({
      teams: ['TAU-VESP', 'VOT-HKY'],
      tokens: [op('s', 'A', WARRIOR, 2), op('t', 'B', THEYN, 8)],
      units: { A: engage(WARRIOR) },
      ploys: { B: ['VOT-HKY-S-IP'] },
    })
    const payload = { shooterId: 's', targetId: 't', weaponId: null, point: null }
    expect(glanceShot({ game, layout: { walls: [wall('w', 'light', 7.2)], areas: [] }, payload })).toBe('invalid')
    expect(glanceShot({ game, layout: { walls: [], areas: [] }, payload })).toBe('valid')
  })
})

describe('toggling from a player’s iPad', () => {
  it('spends the CP for a firefight ploy and shows it as used for other shots this turning point', () => {
    let game = setup({
      teams: ['TAU-VESP', 'VOT-HKY'],
      tokens: [op('s', 'A', WARRIOR, 2), op('t', 'B', THEYN, 8), op('u', 'B', 'VOT-HKY-WAR-0', 8, 8)],
      units: { A: engage(WARRIOR), B: engage(THEYN, 'VOT-HKY-WAR-0') },
    })
    const cp = game.players.B.cp
    const shot = shoot(game, 'TAU-VESP-WAR-NB-0')
    const sturdy = find(shot, 'defence', 'Sturdy')
    game = applyAction(game, { type: 'shot/toggle', key: shot.key, id: sturdy.id, on: true, cost: sturdy.cost, limit: sturdy.limit }, 'B')
    expect(game.players.B.cp).toBe(cp - 1)
    expect(find(shoot(game, 'TAU-VESP-WAR-NB-0'), 'defence', 'Sturdy')).toMatchObject({ on: true, spentHere: true, used: false })
    const other = shoot(game, 'TAU-VESP-WAR-NB-0', { target: 'u' })
    expect(shotKey({ shooterId: 's', targetId: 'u' })).toBe('shoot|s|u')
    expect(other.key).toBe('shoot|s|u')
    expect(find(other, 'defence', 'Sturdy')).toMatchObject({ on: false, used: true })
  })
})

describe('fights', () => {
  const fight = (game, weaponId, { shooter = 's', target = 't' } = {}) =>
    computeAttack({ game, layout: { walls: [], areas: [] }, payload: { mode: 'fight', shooterId: shooter, targetId: target, weaponId } })
  // A Yaegir Theyn (plasma knife 4 / 3+ / 3/5, Lethal 5+) fights a Vespid Warrior
  // (claws 3 / 4+ / 3/4) in base contact.
  const brawl = (extra = {}) =>
    setup({ tokens: [op('s', 'A', THEYN, 5), op('t', 'B', WARRIOR, 6.2)], units: { A: engage(THEYN), B: engage(WARRIOR) }, ...extra })

  it('both sides roll their melee weapon; the defender retaliates with their first by default', () => {
    const result = fight(brawl(), 'VOT-HKY-THEYN-PK-0')
    expect(result).toMatchObject({ mode: 'fight', valid: true, key: 'fight|s|t' })
    expect(result.attack).toMatchObject({ dice: { value: 4 }, hit: { value: 3 }, crit: { value: 5 }, dmg: { normal: { value: 3 }, crit: { value: 5 } } })
    expect(result.defenderWeapon.name).toBe('Claws')
    expect(result.retaliation).toMatchObject({ dice: { value: 3 }, hit: { value: 4 }, dmg: { normal: { value: 3 }, crit: { value: 4 } } })
  })

  it('needs the enemy within control range', () => {
    const far = setup({ tokens: [op('s', 'A', THEYN, 5), op('t', 'B', WARRIOR, 8)], units: { A: engage(THEYN) } })
    expect(fight(far, 'VOT-HKY-THEYN-PK-0').blocks.map((block) => block.code)).toEqual(['control-range'])
  })

  it('assists improve Hit by 1 each, unless the helper is engaged with another enemy', () => {
    const game = brawl({
      tokens: [
        op('s', 'A', THEYN, 5),
        op('t', 'B', WARRIOR, 6.2),
        op('h', 'A', 'VOT-HKY-WAR-0', 6.2, 6.3),
        op('busy', 'A', 'VOT-HKY-BLD-0', 6.2, 3.7),
        op('other', 'B', 'TAU-VESP-VSL-0', 6.2, 2.5),
      ],
    })
    const result = fight(game, 'VOT-HKY-THEYN-PK-0')
    expect(result.assists.attacker).toEqual(['h'])
    expect(result.attack.hit).toMatchObject({ value: 2, tone: 'better' })
    expect(find({ modifiers: result.modifiers }, 'attack', 'Assist').text).toMatch(/Hit \+1/)
  })

  it('injured fighters hit worse, and the retaliation shows its own modifiers', () => {
    const game = brawl({ units: { A: engage(THEYN), B: { [WARRIOR]: { order: 'engage', wounds: 4 } } } })
    expect(fight(game, 'VOT-HKY-THEYN-PK-0').retaliation.hit).toMatchObject({ value: 5, tone: 'worse' })
  })

  it('the defender’s retaliation pick comes from the shared state', () => {
    const game = brawl({ teams: ['TAU-VESP', 'ORK-KOM'], tokens: [op('s', 'A', WARRIOR, 5), op('t', 'B', 'ORK-KOM-NOB-0', 6.2)] })
    const picked = { ...game, battle: { ...game.battle, shots: { 'fight|s|t': { toggles: { A: {}, B: {} }, spent: { A: {}, B: {} }, weapons: { B: 'ORK-KOM-NOB-PC-0' } } } } }
    const result = fight(picked, 'TAU-VESP-WAR-C-0')
    expect(result.defenderWeapons.map((weapon) => weapon.name)).toEqual(['Big Choppa', 'Power Claw'])
    expect(result.defenderWeapon.name).toBe('Power Claw')
    expect(result.retaliation.rules.map((rule) => rule.key)).toEqual(['brutal', 'shock'])
  })

  it('Masterful Bladework: Atk +1 (max 4) and Balanced, or Ceaseless if already Balanced; retaliating only on Conceal', () => {
    const ploys = { A: ['VOT-HKY-S-MBW'] }
    const warrior = 'VOT-HKY-WAR-0'
    const game = setup({ tokens: [op('s', 'A', warrior, 5), op('t', 'B', WARRIOR, 6.2)], units: { A: engage(warrior) }, ploys, equipment: { A: ['VOT-HKY-PK'] } })
    const knife = fight(game, 'VOT-HKY-WAR-PK-0')
    // The Warrior's own plasma knife is the better one: Balanced from Plasma Knives, so Ceaseless.
    expect(knife.attack.dice.value).toBe(4)
    expect(knife.attack.rerolls.map((entry) => entry.text)).toEqual(['Balanced (1 die)', 'Ceaseless (one result)'])
    const fists = fight(game, 'VOT-HKY-WAR-F-0')
    expect(fists.attack).toMatchObject({ dice: { value: 4, tone: 'better' } })
    expect(fists.attack.rerolls.map((entry) => entry.text)).toEqual(['Balanced (1 die)'])
    // Retaliating: only on a Conceal order.
    const swapped = setup({ teams: ['TAU-VESP', 'VOT-HKY'], tokens: [op('s', 'A', WARRIOR, 5), op('t', 'B', warrior, 6.2)], units: { B: engage(warrior) }, ploys: { B: ['VOT-HKY-S-MBW'] } })
    expect(find({ modifiers: fight(swapped, 'TAU-VESP-WAR-C-0').modifiers }, 'defence', 'Masterful Bladework').mode).toBe('inactive')
    const concealed = { ...swapped, players: { ...swapped.players, B: { ...swapped.players.B, unitState: {} } } }
    expect(find({ modifiers: fight(concealed, 'TAU-VESP-WAR-C-0').modifiers }, 'defence', 'Masterful Bladework').on).toBe(true)
  })

  it('Sting and Hardened Exoskeleton (Vespids); WAAAGH! (Kommandos)', () => {
    const game = setup({
      teams: ['ORK-KOM', 'TAU-VESP'],
      tokens: [op('s', 'A', 'ORK-KOM-NOB-0', 5), op('t', 'B', WARRIOR, 6.2)],
      units: { A: engage('ORK-KOM-NOB-0') },
      ploys: { A: ['ORK-KOM-S-WAAGH'], B: ['TAU-VESP-S-ST', 'TAU-VESP-S-HES'] },
    })
    const result = fight(game, 'ORK-KOM-NOB-BC-0')
    // Big choppa 5/6: Normal Dmg 5 deals 1 less to the Vespid.
    expect(result.attack.dmg.normal).toMatchObject({ base: 5, value: 4, tone: 'worse' })
    expect(result.attack.rerolls.map((entry) => entry.text)).toEqual(['Balanced (1 die)'])
    expect(result.retaliation).toMatchObject({ hit: { value: 3, tone: 'better' }, crit: { value: 5 } })
    expect(result.retaliation.rules.find((rule) => rule.key === 'shock').state).toBe('added')
  })

  it('melee weapons from equipment: Choppas for operatives without a better choppa', () => {
    const game = { players: { A: { killteamId: 'ORK-KOM', weapons: {}, equipment: ['ORK-KOM-CHP'] } } }
    expect(meleeWeaponsFor(game, { seat: 'A', unitKey: 'ORK-KOM-BOY-0' }).map((weapon) => weapon.name)).toEqual(['Choppa'])
    expect(meleeWeaponsFor(game, { seat: 'A', unitKey: 'ORK-KOM-RKT-0' }).map((weapon) => weapon.name)).toEqual(['Fists', 'Choppa'])
    expect(meleeWeaponsFor(game, { seat: 'A', unitKey: 'ORK-KOM-GROT-0' }).map((weapon) => weapon.name)).toEqual(['Grot Choppa'])
  })
})

describe('why each number changed', () => {
  const texts = (reasons, tone) => reasons.filter((reason) => !tone || reason.tone === tone).map((reason) => reason.text)

  it('Piercing names its source: the weapon, or the rule that gave it; ignoring it is a green reason', () => {
    const gunner = setup({ tokens: [op('s', 'A', 'VOT-HKY-GNR-0', 2), op('t', 'B', WARRIOR, 8)], units: { A: engage('VOT-HKY-GNR-0'), B: engage(WARRIOR) } })
    expect(texts(shoot(gunner, 'VOT-HKY-GNR-APM-0').defence.dice.reasons, 'worse')).toEqual(['Piercing 1 · weapon'])
    const moved = setup({
      teams: ['TAU-VESP', 'VOT-HKY'],
      tokens: [op('s', 'A', WARRIOR, 2), op('t', 'B', THEYN, 7)],
      units: { A: { [WARRIOR]: { order: 'engage', movedTp: 1 } }, B: engage(THEYN) },
    })
    expect(texts(shoot(moved, 'TAU-VESP-WAR-NB-0').defence.dice.reasons, 'worse')).toEqual(['Piercing 1 · Neutron Charge'])
    const shadestrain = 'TAU-VESP-VSS-0'
    const camo = setup({ tokens: [op('s', 'A', 'VOT-HKY-GNR-0', 2), op('t', 'B', shadestrain, 7)], units: { A: engage('VOT-HKY-GNR-0'), B: engage(shadestrain) } })
    expect(shoot(camo, 'VOT-HKY-GNR-APM-0').defence.dice.reasons).toEqual([{ text: 'Ignores Piercing · Camouflaged', tone: 'better' }])
  })

  it('Hit: injured is red, an assist is green', () => {
    const injured = shoot(basic({ units: { A: { [THEYN]: { order: 'engage', wounds: 4 } }, B: engage(WARRIOR) } }), 'VOT-HKY-THEYN-BR-0')
    expect(injured.attack.hit.reasons).toEqual([{ text: 'Injured · Hit −1', tone: 'worse' }])
    const game = setup({
      tokens: [op('s', 'A', THEYN, 5), op('t', 'B', WARRIOR, 6.2), op('h', 'A', 'VOT-HKY-WAR-0', 6.2, 6.3)],
      units: { A: engage(THEYN) },
    })
    const fight = computeAttack({ game, layout: { walls: [], areas: [] }, payload: { mode: 'fight', shooterId: 's', targetId: 't', weaponId: 'VOT-HKY-THEYN-PK-0' } })
    expect(fight.attack.hit.reasons).toEqual([{ text: 'Assist · Hit +1', tone: 'better' }])
  })

  it('auto saves: the cover save, or Saturate taking it away', () => {
    const walls = [wall('w', 'light', 7.2)]
    expect(texts(shoot(basic(), 'VOT-HKY-THEYN-BR-0', { walls }).defence.auto.reasons)).toEqual(['Cover save'])
    const frag = shoot(basic({ equipment: { A: ['UNIVERSAL-UE-XG-FRAG'] } }), 'grenade-frag', { walls })
    expect(frag.defence.auto.reasons).toEqual([{ text: 'No cover save: Saturate · weapon', tone: 'worse' }])
  })

  it('crits: obscured and Sturdy are red', () => {
    const game = setup({ teams: ['TAU-VESP', 'VOT-HKY'], tokens: [op('s', 'A', WARRIOR, 2), op('t', 'B', THEYN, 8)], units: { A: engage(WARRIOR), B: engage(THEYN) } })
    expect(texts(shoot(game, 'TAU-VESP-WAR-NB-0', { walls: [wall('w', 'heavy', 5)] }).attack.crit.reasons, 'worse')).toEqual(['Obscured: crits count as normal'])
    const sturdy = shoot({ ...game, battle: { ...game.battle, shots: toggled('B', { 'VOT-HKY-T-STRD': true }) } }, 'TAU-VESP-WAR-NB-0')
    expect(texts(sturdy.attack.crit.reasons, 'worse')).toEqual(['Sturdy: crits become normal'])
  })

  it('Dmg: the opponent’s Hardened Exoskeleton is red on the attacker’s damage', () => {
    const game = setup({
      teams: ['ORK-KOM', 'TAU-VESP'],
      tokens: [op('s', 'A', 'ORK-KOM-NOB-0', 5), op('t', 'B', WARRIOR, 6.2)],
      units: { A: engage('ORK-KOM-NOB-0') },
      ploys: { B: ['TAU-VESP-S-HES'] },
    })
    const fight = computeAttack({ game, layout: { walls: [], areas: [] }, payload: { mode: 'fight', shooterId: 's', targetId: 't', weaponId: 'ORK-KOM-NOB-BC-0' } })
    expect(fight.attack.dmg.reasons).toEqual([{ text: '−1 Normal Dmg (4+) · Hardened Exoskeleton', tone: 'worse' }])
  })

  it('Save: Portable Barricade, and 2+ at best', () => {
    const drone = 'TAU-VESP-OSD-0'
    const game = setup({
      tokens: [op('s', 'A', THEYN, 2), op('t', 'B', drone, 7)],
      units: { A: engage(THEYN), B: engage(drone) },
      equipment: { B: ['UNIVERSAL-UE-PB'] },
      shots: toggled('B', { 'UNIVERSAL-UE-PB': true }),
    })
    expect(shoot(game, 'VOT-HKY-THEYN-BR-0').defence.save.reasons).toEqual([
      { text: 'Portable Barricade · Save +1', tone: 'better' },
      { text: '2+ at best', tone: 'info' },
    ])
  })
})
