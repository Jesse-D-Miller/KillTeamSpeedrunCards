import { tokenRadiusIn } from '../../../../shared/game.js'
import { distance } from '../../../../shared/geometry.js'
import * as generic from '../generic.js'
import { mod } from '../effects.js'

// Phobos Strike Team (IMP-PHO). Hand-checked so far against the current team rules
// (Wahapedia): Astartes, Multi-Spectrum Array and the ploys. Everything else still comes from the
// rules-text reader (generic.js), added alongside; the rules handled here are taken out of
// its suggestions.

const PLOYS = {
  knowNoFear: 'IMP-PHO-S-ATSKNF',
  deadlyShots: 'IMP-PHO-S-DS',
  lethalAssaults: 'IMP-PHO-S-LA',
  criticalShot: 'IMP-PHO-T-CS',
  stealthAssault: 'IMP-PHO-T-SA',
  transhumanPhysiology: 'IMP-PHO-T-TP',
}
const HANDLED_NAMES = new Set(['Astartes', 'Multi-Spectrum Array'])
const HANDLED_IDS = new Set(Object.values(PLOYS))
const unhandled = (mods) => mods.filter((modifier) => !HANDLED_NAMES.has(modifier.name) && !HANDLED_IDS.has(modifier.id))
const MOVE_ACTIONS = ['charge', 'fallBack', 'reposition']

// And They Shall Know No Fear: an injured Phobos operative ignores being injured (its Hit
// here; its Move in the Move ring).
const knowNoFear = (ctx, owner, operative) =>
  operative.injured && ctx.stratActive(owner, PLOYS.knowNoFear)
    ? [mod({ id: PLOYS.knowNoFear, owner, source: 'strat', name: 'And They Shall Know No Fear', text: 'Ignores being injured', effect: { hit: -1 }, tone: 'good' })]
    : []

// Deadly Shots: Balanced if it hasn't Charged, Fallen Back or Repositioned this activation,
// or if the target isn't in cover and is more than 6" away. A free drag can't say which
// move it was.
const deadlyShots = (ctx) => {
  if (!ctx.stratActive('attacker', PLOYS.deadlyShots)) return []
  const base = { id: PLOYS.deadlyShots, owner: 'attacker', source: 'strat', name: 'Deadly Shots', effect: { addRules: { balanced: true } }, tone: 'good' }
  const kinds = ctx.moveKinds ?? []
  const stillThisActivation = !kinds.some((kind) => MOVE_ACTIONS.includes(kind)) && !kinds.includes('free')
  const farInTheOpen = !ctx.analysis?.cover && ctx.gap > 6
  if (stillThisActivation || farInTheOpen) {
    return [mod({ ...base, text: farInTheOpen ? 'Target not in cover and more than 6" away: Balanced' : 'No Charge, Fall Back or Reposition this activation: Balanced' })]
  }
  if (kinds.includes('free')) return [mod({ ...base, mode: 'toggle', text: 'If it hasn’t Charged, Fallen Back or Repositioned this activation: Balanced' })]
  return [mod({ ...base, mode: 'inactive', text: 'It moved this activation, and the target is in cover or within 6"' })]
}

// Auspex Scan (Voxbreaker): until its next activation, Phobos operatives shooting an enemy
// within 8" of it: the target can't be obscured, and an Incursor's weapons get Seek Light.
const auspexScan = (ctx) => {
  const seat = ctx.shooter.seat
  const unitState = ctx.game.players[seat]?.unitState ?? {}
  const scanning = ctx.tokens.find(
    (token) =>
      token.seat === seat &&
      unitState[token.unitKey]?.auspex &&
      !unitState[token.unitKey]?.dead &&
      distance(token, ctx.targetToken) - tokenRadiusIn(token) - tokenRadiusIn(ctx.targetToken) <= 8,
  )
  if (!scanning) return []
  const incursor = ctx.shooter.keywords.has('INCURSOR')
  return [
    mod({
      id: 'IMP-PHO-auspex-scan',
      owner: 'attacker',
      source: 'ability',
      name: 'Auspex Scan',
      text: incursor ? 'Within 8" of the scanning Voxbreaker: can’t be obscured; Seek Light' : 'Within 8" of the scanning Voxbreaker: can’t be obscured',
      effect: { cannotBeObscured: true, ...(incursor ? { addRules: { seekLight: true } } : {}) },
      tone: 'good',
    }),
  ]
}

// Firefight ploys whose effect is on the dice as they're resolved: a switch with the rule.
const dicePloy = (owner, id, name, text) => mod({ id, owner, source: 'firefight', name, mode: 'toggle', cost: 1, limit: 1, text, tone: 'good' })

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
  ...(ctx.weapon?.atk != null ? [...multiSpectrum(ctx), ...auspexScan(ctx), ...deadlyShots(ctx), ...knowNoFear(ctx, 'attacker', ctx.shooter)] : []),
  // Critical Shot: a crit with a bolt weapon deals D3 more (the player rolls it).
  ...(ctx.inBattle && /\bbolt\b/i.test(ctx.weapon?.name ?? '') ? [dicePloy('attacker', PLOYS.criticalShot, 'Critical Shot', 'When a crit is resolved with this bolt weapon: D3 more damage')] : []),
  ...(ctx.inBattle ? [astartes('attacker', 'It can Shoot twice this activation (one of them with a bolt weapon)')] : []),
]
export const defence = (ctx) => [
  ...unhandled(generic.defence(ctx)),
  ...(ctx.inBattle ? [dicePloy('defender', PLOYS.transhumanPhysiology, 'Transhuman Physiology', 'Keep one of your normal successes as a crit')] : []),
]
// Lethal Assaults: fighting, Balanced; Lethal 5+ too if it charged this activation.
const lethalAssaults = (ctx, side, operative, token) => {
  if (!ctx.stratActive(side, PLOYS.lethalAssaults)) return []
  const kinds = ctx.moveKindsOf(token, operative)
  const base = { id: PLOYS.lethalAssaults, owner: side, source: 'strat', name: 'Lethal Assaults', tone: 'good' }
  if (kinds.includes('charge')) return [mod({ ...base, text: 'Charged this activation: Balanced, Lethal 5+', effect: { addRules: { balanced: true, lethal: 5 } } })]
  return [
    mod({ ...base, text: 'Fighting: Balanced', effect: { addRules: { balanced: true } } }),
    ...(kinds.includes('free') ? [mod({ ...base, id: `${PLOYS.lethalAssaults}-charge`, mode: 'toggle', text: 'If it charged this activation: Lethal 5+', effect: { addRules: { lethal: 5 } } })] : []),
  ]
}

export const fight = (ctx, side) => {
  const { operative, token, weapon, retaliating } = ctx.fighter(side)
  return [
    ...unhandled(generic.fight(ctx, side)),
    ...(weapon ? knowNoFear(ctx, side, operative) : []),
    ...(weapon && !retaliating ? lethalAssaults(ctx, side, operative, token) : []),
    // Stealth Assault: activated on Conceal, given Engage, Charged then Fought: after its
    // first attack die, resolve another before the opponent.
    ...(weapon && !retaliating && ctx.inBattle ? [dicePloy(side, PLOYS.stealthAssault, 'Stealth Assault', 'Activated on Conceal, Charged then Fought: after your first attack die, resolve another before your opponent')] : []),
    ...(side === 'attacker' && ctx.inBattle ? [astartes(side, 'It can Fight twice this activation')] : []),
  ]
}
