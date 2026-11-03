import * as generic from '../generic.js'
import { mod } from '../effects.js'

// Phobos Strike Team (IMP-PHO). Hand-checked so far against the current team rules
// (Wahapedia): Astartes and Multi-Spectrum Array. Everything else still comes from the
// rules-text reader (generic.js), added alongside; the rules handled here are taken out of
// its suggestions.

const HANDLED_NAMES = new Set(['Astartes', 'Multi-Spectrum Array'])
const unhandled = (mods) => mods.filter((modifier) => !HANDLED_NAMES.has(modifier.name))

// Astartes: two Shoot actions (one with a bolt weapon) or two Fight actions in an
// activation. The app doesn't count actions, so it's a reminder; counteracting on either
// order is in the turn order (COUNTERACT_ANY_ORDER).
const astartes = (owner, text) => mod({ id: 'IMP-PHO-astartes', owner, source: 'faction', name: 'Astartes', mode: 'note', text })

// Multi-Spectrum Array: a friendly Incursor shooting, enemies can't be obscured.
const multiSpectrum = (ctx) =>
  ctx.shooter.keywords.has('INCURSOR')
    ? [mod({ id: 'IMP-PHO-multi-spectrum', owner: 'attacker', source: 'ability', name: 'Multi-Spectrum Array', text: 'Incursor shooting: the target can’t be obscured', effect: { cannotBeObscured: true }, tone: 'good' })]
    : []

export const attack = (ctx) => [
  ...unhandled(generic.attack(ctx)),
  ...(ctx.weapon?.atk != null ? multiSpectrum(ctx) : []),
  ...(ctx.inBattle ? [astartes('attacker', 'It can Shoot twice this activation (one of them with a bolt weapon)')] : []),
]
export const defence = (ctx) => unhandled(generic.defence(ctx))
export const fight = (ctx, side) => [
  ...unhandled(generic.fight(ctx, side)),
  ...(side === 'attacker' && ctx.inBattle ? [astartes(side, 'It can Fight twice this activation')] : []),
]
