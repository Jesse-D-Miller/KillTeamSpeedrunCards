import * as generic from '../generic.js'
import { mod } from '../effects.js'

// Imperial Navy Breachers (IMP-INB). Hand-checked so far against the current team rules
// (Wahapedia): Void Armour. Everything else still comes from the rules-text reader
// (generic.js), added alongside; the rules handled here are taken out of its suggestions.

const VOID_ARMOUR = 'IMP-INB-void-armour'
const HANDLED_NAMES = new Set(['Void Armour'])
const unhandled = (mods) => mods.filter((modifier) => !HANDLED_NAMES.has(modifier.name))

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

export const attack = (ctx) => unhandled(generic.attack(ctx))
export const defence = (ctx) => [...unhandled(generic.defence(ctx)), ...voidArmour(ctx)]
export const fight = (ctx, side) => unhandled(generic.fight(ctx, side))

// Void Armour: x" Devastating doesn't affect Breachers that aren't the target.
export const immuneToDevastating = (game) => (token) => game.players?.[token.seat]?.killteamId === 'IMP-INB'
