import { tokenRadiusIn } from '../../../../shared/game.js'
import { distance } from '../../../../shared/geometry.js'
import * as generic from '../generic.js'
import { mod } from '../effects.js'

// Imperial Navy Breachers (IMP-INB). Hand-checked so far against the current team rules
// (Wahapedia): Void Armour, Attack Order, Defence Order, Close Assault, Brace for
// Counterattack and Blitz. Everything else still comes from the rules-text reader
// (generic.js), added alongside; the rules handled here are taken out of its suggestions.

const VOID_ARMOUR = 'IMP-INB-void-armour'
const PLOYS = {
  attackOrder: 'IMP-INB-S-AO',
  defenceOrder: 'IMP-INB-S-DO',
  closeAssault: 'IMP-INB-S-CA',
  braceForCounterattack: 'IMP-INB-S-BFCA',
  blitz: 'IMP-INB-T-BL',
}
const EQUIPMENT = { rebreathers: 'IMP-INB-RB', slugs: 'IMP-INB-SL' }
const HANDLED_NAMES = new Set(['Void Armour'])
const HANDLED_IDS = new Set([...Object.values(PLOYS), ...Object.values(EQUIPMENT)])
const unhandled = (mods) => mods.filter((modifier) => !HANDLED_NAMES.has(modifier.name) && !HANDLED_IDS.has(modifier.id))

// Within 3" of the player's own Attack Order / Defence Order marker (edge to edge).
const ORDER_RANGE = 3
const nearOrder = (ctx, token, seat, catalogId) =>
  (ctx.game.markers ?? []).some(
    (marker) => marker.catalogId === catalogId && marker.seat === seat && distance(token, marker) - tokenRadiusIn(token) - (marker.radius ?? 0) <= ORDER_RANGE,
  )

// Attack Order: shooting, fighting or retaliating within 3" of the marker, Ceaseless.
const attackOrder = (ctx, owner, token, seat) => {
  if (!ctx.stratActive(owner, PLOYS.attackOrder)) return []
  const base = { id: PLOYS.attackOrder, owner, source: 'strat', name: 'Attack Order' }
  return [
    nearOrder(ctx, token, seat, 'imp-inb-attack-order')
      ? mod({ ...base, text: 'Within 3" of the Attack Order marker: Ceaseless', effect: { addRules: { ceaseless: true } }, tone: 'good' })
      : mod({ ...base, mode: 'inactive', text: 'Not within 3" of the Attack Order marker' }),
  ]
}

// Defence Order: shot at within 3" of the marker, re-roll any defence dice of one result.
const defenceOrder = (ctx) => {
  if (!ctx.stratActive('defender', PLOYS.defenceOrder)) return []
  const base = { id: PLOYS.defenceOrder, owner: 'defender', source: 'strat', name: 'Defence Order' }
  return [
    nearOrder(ctx, ctx.targetToken, ctx.target.seat, 'imp-inb-defence-order')
      ? mod({ ...base, text: 'Within 3" of the Defence Order marker: re-roll any defence dice of one result', effect: { reroll: 'defence' }, tone: 'good' })
      : mod({ ...base, mode: 'inactive', text: 'Not within 3" of the Defence Order marker' }),
  ]
}

// Void Armour: shot at with a Blast or Torrent weapon (not a sweeping profile), re-roll
// one defence die, or up to two for a Grenadier.
const voidArmour = (ctx) => {
  const rules = ctx.attackRules
  if (!(rules?.blast || rules?.torrent) || /sweeping/i.test(ctx.weapon?.profile ?? '')) return []
  const grenadier = ctx.target.keywords.has('GRENADIER')
  return [
    mod({
      id: VOID_ARMOUR,
      owner: 'defender',
      source: 'faction',
      name: 'Void Armour',
      text: grenadier ? 'Blast or Torrent: re-roll up to two defence dice (Grenadier)' : 'Blast or Torrent: re-roll one defence die',
      effect: { reroll: 'defence' },
      tone: 'good',
    }),
  ]
}

// Close Assault: fighting or shooting an operative within 3", its Navis (heavy) shotguns
// get +1 to both Dmg stats; turning a fail into a normal success is the player's call.
const closeAssault = (ctx, owner, weapon) => {
  if (!weapon || !ctx.stratActive(owner, PLOYS.closeAssault) || ctx.gap > 3) return []
  const base = { id: PLOYS.closeAssault, owner, source: 'strat', name: 'Close Assault' }
  return /navis (heavy )?shotgun/i.test(weapon.name)
    ? [mod({ ...base, text: 'Within 3": +1 Dmg; with two or more fails, discard one to keep another as a normal success', effect: { normalDmg: 1, critDmg: 1 }, tone: 'good' })]
    : [mod({ ...base, mode: 'note', text: 'Within 3": with two or more fails, discard one to keep another as a normal success' })]
}

// Brace for Counterattack: against a Breacher in your territory (drop zone included), or
// one that hasn't Charged, Fallen Back or Repositioned this turning point, Normal and Crit
// Dmg of 3 or more deals 1 less. A free drag can't say which move it was: the player
// decides.
const BRACE_REDUCTION = { atLeast: 3, by: 1, crit: true }
const inOwnTerritory = (ctx, token, seat) => {
  const zone = ctx.layout?.zones?.[ctx.game.table?.dropZones?.[seat]]
  const inside = (rect) => rect && token.x >= rect.x && token.x <= rect.x + rect.w && token.y >= rect.y && token.y <= rect.y + rect.h
  return zone ? inside(zone.territory) || inside(zone.drop) : null
}
const brace = (ctx, owner, operative, token, key) => {
  if (!ctx.stratActive(owner, PLOYS.braceForCounterattack)) return []
  const base = { id: PLOYS.braceForCounterattack, owner, source: 'strat', name: 'Brace for Counterattack', effect: { [key]: BRACE_REDUCTION }, tone: 'good' }
  const territory = inOwnTerritory(ctx, token, operative.seat)
  const kinds = ctx.game.phase === 'battle' ? token.lastMove?.kinds ?? [] : []
  const moved = kinds.some((kind) => ['charge', 'fallBack', 'reposition'].includes(kind))
  if (territory || (!moved && !kinds.includes('free'))) {
    return [mod({ ...base, text: territory ? 'In your territory: Dmg 3+ deals 1 less' : 'No Charge, Fall Back or Reposition this turning point: Dmg 3+ deals 1 less' })]
  }
  if (moved && territory === false) return [mod({ ...base, mode: 'inactive', text: 'It moved this turning point and isn’t in your territory' })]
  return [mod({ ...base, mode: 'toggle', text: 'If it’s in your territory or hasn’t Charged, Fallen Back or Repositioned this turning point: Dmg 3+ deals 1 less' })]
}

// Blitz (firefight ploy): against an enemy within 6", Accurate 1 if it's the team's first
// operative to Shoot or Fight this turning point (the player says so), and Severe too if it
// was the first activated this turning point (recorded).
const blitz = (ctx, owner, operative) => {
  if (!ctx.inBattle || ctx.gap > 6) return []
  const first = ctx.game.battle.firstActivatedByTp?.[ctx.game.battle.tp]?.[operative.seat] === operative.unitKey
  return [
    mod({
      id: PLOYS.blitz,
      owner,
      source: 'firefight',
      name: 'Blitz',
      mode: 'toggle',
      cost: 1,
      limit: 1,
      text: first ? 'First to Shoot or Fight this turning point, and first activated: Accurate 1, Severe' : 'If it’s the first to Shoot or Fight this turning point: Accurate 1',
      effect: { accurate: 1, ...(first ? { addRules: { severe: true } } : {}) },
      tone: 'good',
    }),
  ]
}

// Spot (C.A.T. Unit): shooting the enemy it spotted this turning point, Seek Light and it
// can't be obscured (while it stays visible to the C.A.T. Unit: the players' call).
const spot = (ctx) => {
  const marked = ctx.shooter.player?.spot
  if (!ctx.inBattle || marked?.tp !== ctx.game.battle.tp || marked.targetId !== ctx.targetToken.id) return []
  return [
    mod({
      id: 'IMP-INB-spot',
      owner: 'attacker',
      source: 'ability',
      name: 'Spot',
      mode: 'default',
      text: 'Spotted by the C.A.T. Unit: Seek Light, and it can’t be obscured',
      effect: { addRules: { seekLight: true }, cannotBeObscured: true },
      tone: 'good',
    }),
  ]
}

// Slugs: up to three times per turning point, a Navis shotgun's long range profile gets
// Hit +1, +1 to both Dmg and Accurate 1.
const slugs = (ctx) =>
  ctx.inBattle && ctx.hasEquipment('attacker', EQUIPMENT.slugs) && /navis shotgun/i.test(ctx.weapon.name) && /long/i.test(ctx.weapon.profile ?? '')
    ? [mod({ id: EQUIPMENT.slugs, owner: 'attacker', source: 'equipment', name: 'Slugs', mode: 'toggle', limit: 3, text: 'Hit +1, +1 Dmg, Accurate 1', effect: { hit: -1, normalDmg: 1, critDmg: 1, accurate: 1 }, tone: 'good' })]
    : []

// Rebreathers: enemy Shock doesn't affect Breachers (their APL changes are ignored too,
// on the cards and the board). Shown in every fight: Shock can come from the enemy's own
// rules (e.g. a Vespid's Sting), which aren't known here.
const rebreathers = (ctx, side) =>
  ctx.hasEquipment(side, EQUIPMENT.rebreathers)
    ? [mod({ id: EQUIPMENT.rebreathers, owner: side, source: 'equipment', name: 'Rebreathers', mode: 'note', text: 'Enemy Shock doesn’t affect it' })]
    : []

export const attack = (ctx) => [
  ...unhandled(generic.attack(ctx)),
  ...(ctx.weapon?.atk != null ? spot(ctx) : []),
  ...(ctx.weapon?.atk != null
    ? [...attackOrder(ctx, 'attacker', ctx.shooterToken, ctx.shooter.seat), ...closeAssault(ctx, 'attacker', ctx.weapon), ...blitz(ctx, 'attacker', ctx.shooter), ...slugs(ctx)]
    : []),
]
export const defence = (ctx) => [...unhandled(generic.defence(ctx)), ...voidArmour(ctx), ...defenceOrder(ctx), ...brace(ctx, 'defender', ctx.target, ctx.targetToken, 'dmgReduction')]
export const fight = (ctx, side) => {
  const { operative, token, weapon, retaliating } = ctx.fighter(side)
  return [
    ...unhandled(generic.fight(ctx, side)),
    ...(weapon ? attackOrder(ctx, side, token, operative.seat) : []),
    ...(!retaliating ? [...closeAssault(ctx, side, weapon), ...(weapon ? blitz(ctx, side, operative) : [])] : []),
    ...brace(ctx, side, operative, token, 'opponentDmgReduction'),
    ...rebreathers(ctx, side),
  ]
}

// Void Armour: x" Devastating doesn't affect Breachers that aren't the target.
export const immuneToDevastating = (game) => (token) => game.players?.[token.seat]?.killteamId === 'IMP-INB'
