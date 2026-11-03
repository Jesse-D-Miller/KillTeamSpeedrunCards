import { tokenRadiusIn } from '../../../../shared/game.js'
import { distance } from '../../../../shared/geometry.js'
import * as generic from '../generic.js'
import { mod } from '../effects.js'

// Imperial Navy Breachers (IMP-INB). Hand-checked so far against the current team rules
// (Wahapedia): Void Armour, Attack Order and Defence Order. Everything else still comes from the rules-text reader
// (generic.js), added alongside; the rules handled here are taken out of its suggestions.

const VOID_ARMOUR = 'IMP-INB-void-armour'
const PLOYS = { attackOrder: 'IMP-INB-S-AO', defenceOrder: 'IMP-INB-S-DO' }
const HANDLED_NAMES = new Set(['Void Armour'])
const HANDLED_IDS = new Set(Object.values(PLOYS))
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

export const attack = (ctx) => [...unhandled(generic.attack(ctx)), ...(ctx.weapon?.atk != null ? attackOrder(ctx, 'attacker', ctx.shooterToken, ctx.shooter.seat) : [])]
export const defence = (ctx) => [...unhandled(generic.defence(ctx)), ...voidArmour(ctx), ...defenceOrder(ctx)]
export const fight = (ctx, side) => {
  const { operative, token, weapon } = ctx.fighter(side)
  return [...unhandled(generic.fight(ctx, side)), ...(weapon ? attackOrder(ctx, side, token, operative.seat) : [])]
}

// Void Armour: x" Devastating doesn't affect Breachers that aren't the target.
export const immuneToDevastating = (game) => (token) => game.players?.[token.seat]?.killteamId === 'IMP-INB'
