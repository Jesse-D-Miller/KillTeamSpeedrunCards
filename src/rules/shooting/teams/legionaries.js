import * as generic from '../generic.js'
import { mod } from '../effects.js'

// Legionaries (CHAOS-LEG). Hand-checked so far against the current team rules
// (Wahapedia, Aug 2026): the Marks of Chaos. Everything else still comes from the
// rules-text reader (generic.js), added alongside.

// Each operative's mark is picked on the map (its action ring's Mark), saved as
// unitState.mark.
const VICIOUS_REAVERS_RANGE = 6
const markMod = (owner, mark, name, fields) => mod({ id: `CHAOS-LEG-mark-${mark.toLowerCase()}`, owner, source: 'faction', name, tone: 'good', ...fields })

// Shooting: Tzeentch's ranged weapons are Severe; Undivided gets Ceaseless against an
// enemy within 6".
const shootingMarks = (ctx) => {
  const mark = ctx.shooter.mark
  if (!ctx.weapon || ctx.weapon.atk == null) return []
  if (mark === 'TZEENTCH') return [markMod('attacker', mark, 'Empyreal Guidance', { text: 'Tzeentch: ranged weapons have Severe', effect: { addRules: { severe: true } } })]
  if (mark === 'UNDIVIDED') return [viciousReavers('attacker', ctx.gap)]
  return []
}

const viciousReavers = (owner, gap) =>
  gap <= VICIOUS_REAVERS_RANGE
    ? markMod(owner, 'UNDIVIDED', 'Vicious Reavers', { text: 'Undivided: enemy within 6", Ceaseless', effect: { addRules: { ceaseless: true } } })
    : markMod(owner, 'UNDIVIDED', 'Vicious Reavers', { mode: 'inactive', text: 'Undivided: the enemy is more than 6" away' })

// Nurgle's Disgusting Vigour is the defender's own roll, so it's a reminder.
const disgustingVigour = (owner) =>
  markMod(owner, 'NURGLE', 'Disgusting Vigour', {
    mode: 'note',
    text: 'Nurgle: each time Normal Dmg of 3 or more is inflicted on it, roll a D6: on a 5+, 1 less damage',
  })

export const attack = (ctx) => [...generic.attack(ctx), ...shootingMarks(ctx)]

export const defence = (ctx) => [...generic.defence(ctx), ...(ctx.target.mark === 'NURGLE' ? [disgustingVigour('defender')] : [])]

// Fighting (side 'attacker') or retaliating ('defender'): Khorne's melee weapons are
// Severe, Undivided gets Ceaseless (the enemy is always within 6" in a fight), and
// Nurgle's damage reminder.
export const fight = (ctx, side) => {
  const { operative, weapon } = ctx.fighter(side)
  const mods = [...generic.fight(ctx, side)]
  if (weapon && operative.mark === 'KHORNE') {
    mods.push(markMod(side, 'KHORNE', 'Wrathful Onslaught', { text: 'Khorne: melee weapons have Severe', effect: { addRules: { severe: true } } }))
  }
  if (weapon && operative.mark === 'UNDIVIDED') mods.push(viciousReavers(side, ctx.gap))
  if (operative.mark === 'NURGLE') mods.push(disgustingVigour(side))
  return mods
}
