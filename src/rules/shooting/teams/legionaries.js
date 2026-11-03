import * as generic from '../generic.js'
import { mod } from '../effects.js'

// Legionaries (CHAOS-LEG). Hand-checked so far against the current team rules
// (Wahapedia, Aug 2026): the Marks of Chaos, Astartes and the strategy ploys. Everything
// else still comes from the rules-text reader (generic.js), added alongside; the rules
// handled here are taken out of its suggestions.

const PLOYS = {
  implacable: 'CHAOS-LEG-S-IMP',
  quicksilverSpeed: 'CHAOS-LEG-S-QSS',
  fickleFates: 'CHAOS-LEG-S-FF',
  bloodForTheBloodGod: 'CHAOS-LEG-S-BFTBG',
  malignantAura: 'CHAOS-LEG-T-MA',
  unendingBloodshed: 'CHAOS-LEG-T-UEBS',
  // Played from the Firefight ploys panel (they change APL, not a shot or fight).
  sickeningCaptivation: 'CHAOS-LEG-T-SC',
  mutabilityAndChange: 'CHAOS-LEG-T-MAC',
}
const HANDLED = new Set(Object.values(PLOYS))
const unhandled = (mods) => mods.filter((modifier) => !HANDLED.has(modifier.id))
const DMG_MAX = 7

// Moved during this turning point (an action in which it moved).
const movedThisTp = (ctx, operative, token) => operative.movedTp === ctx.game.battle.tp || Boolean(token?.lastMove)

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

// Astartes: two Shoot actions in an activation (one with a bolt pistol, boltgun or tainted
// bolt pistol), or two Fight actions. The app doesn't count actions, so it's a reminder.
const astartes = (owner, text) => mod({ id: 'CHAOS-LEG-astartes', owner, source: 'faction', name: 'Astartes', mode: 'note', text })

// Strategy ploys while a Legionary shoots.
const shootingPloys = (ctx) => {
  const mods = []
  const owner = 'attacker'
  if (!ctx.weapon || ctx.weapon.atk == null) return mods
  // Fickle Fates: Balanced against a ready enemy.
  if (ctx.stratActive(owner, PLOYS.fickleFates)) {
    const base = { id: PLOYS.fickleFates, owner, source: 'strat', name: 'Fickle Fates' }
    mods.push(
      ctx.target.activation === 'ready'
        ? mod({ ...base, text: 'Shooting a ready enemy: Balanced', effect: { addRules: { balanced: true } }, tone: 'good' })
        : mod({ ...base, mode: 'inactive', text: 'The target isn’t ready' }),
    )
  }
  // Malignant Aura (firefight ploy): a Nurgle Legionary shooting an enemy within 3" has
  // Piercing 1.
  if (ctx.inBattle && ctx.shooter.mark === 'NURGLE') {
    const base = { id: PLOYS.malignantAura, owner, source: 'firefight', name: 'Malignant Aura' }
    mods.push(
      ctx.gap <= 3
        ? mod({ ...base, mode: 'toggle', cost: 1, limit: 1, text: 'Nurgle, enemy within 3": Piercing 1', effect: { addRules: { piercing: 1 } }, tone: 'good' })
        : mod({ ...base, mode: 'inactive', text: 'Nurgle: the enemy is more than 3" away' }),
    )
  }
  // Implacable: an injured Nurgle Legionary ignores being injured (its Hit too).
  if (ctx.stratActive(owner, PLOYS.implacable) && ctx.shooter.mark === 'NURGLE' && ctx.shooter.injured) {
    mods.push(mod({ id: PLOYS.implacable, owner, source: 'strat', name: 'Implacable', text: 'Nurgle: ignores being injured', effect: { hit: -1 }, tone: 'good' }))
  }
  return mods
}

export const attack = (ctx) => [
  ...unhandled(generic.attack(ctx)),
  ...shootingMarks(ctx),
  ...shootingPloys(ctx),
  ...(ctx.inBattle ? [astartes('attacker', 'It can Shoot twice this activation (one of them with a bolt pistol, boltgun or tainted bolt pistol)')] : []),
]

// Strategy ploys while a Legionary is shot at.
const defencePloys = (ctx) => {
  const mods = []
  const owner = 'defender'
  if (ctx.stratActive(owner, PLOYS.implacable)) {
    mods.push(mod({ id: PLOYS.implacable, owner, source: 'strat', name: 'Implacable', text: 'Piercing 1 counts only on crits (Piercing Crits 1)', effect: { piercingToCrits: 1 }, tone: 'good' }))
  }
  // Quicksilver Speed: shooting a moved Slaanesh Legionary more than 6" away, Hit is worse
  // (not on top of the shooter being injured).
  if (ctx.stratActive(owner, PLOYS.quicksilverSpeed) && ctx.target.mark === 'SLAANESH') {
    const base = { id: PLOYS.quicksilverSpeed, owner, source: 'strat', name: 'Quicksilver Speed' }
    const moved = movedThisTp(ctx, ctx.target, ctx.targetToken)
    mods.push(
      !moved
        ? mod({ ...base, mode: 'inactive', text: 'Slaanesh: it hasn’t moved this turning point' })
        : ctx.gap <= 6
          ? mod({ ...base, mode: 'inactive', text: 'Slaanesh: the shooter is within 6"' })
          : ctx.shooter.injured
            ? mod({ ...base, mode: 'inactive', text: 'Not on top of the shooter being injured' })
            : mod({ ...base, text: 'Slaanesh, moved, more than 6" away: the shooter’s Hit is worse by 1', effect: { hit: 1 }, tone: 'good' }),
    )
  }
  // Fickle Fates: a ready Tzeentch Legionary keeping a crit can keep a fail as a normal.
  if (ctx.stratActive(owner, PLOYS.fickleFates) && ctx.target.mark === 'TZEENTCH' && ctx.target.activation === 'ready') {
    mods.push(mod({ id: PLOYS.fickleFates, owner, source: 'strat', name: 'Fickle Fates', mode: 'note', text: 'Tzeentch, ready: if you keep a crit, keep one fail as a normal success' }))
  }
  return mods
}

// Unleash Daemon (Anointed): Normal and Critical Dmg of 4 or more deals 1 less to it,
// and its daemonic claw has Ceaseless and Lethal 5+.
const DAEMON_REDUCTION = { atLeast: 4, by: 1, crit: true }
const daemonDefence = (owner, key) =>
  mod({ id: 'CHAOS-LEG-unleash-daemon', owner, source: 'ability', name: 'Unleash Daemon', text: 'Dmg of 4 or more deals 1 less to it', effect: { [key]: DAEMON_REDUCTION }, tone: 'good' })

export const defence = (ctx) => [
  ...(ctx.target.daemon ? [daemonDefence('defender', 'dmgReduction')] : []),...unhandled(generic.defence(ctx)), ...(ctx.target.mark === 'NURGLE' ? [disgustingVigour('defender')] : []), ...defencePloys(ctx)]

// Fighting (side 'attacker') or retaliating ('defender'): Khorne's melee weapons are
// Severe, Undivided gets Ceaseless (the enemy is always within 6" in a fight), and
// Nurgle's damage reminder.
export const fight = (ctx, side) => {
  const { operative, weapon, token, enemy, retaliating } = ctx.fighter(side)
  const mods = [...unhandled(generic.fight(ctx, side))]
  if (operative.daemon) {
    mods.push(daemonDefence(side, 'opponentDmgReduction'))
    if (weapon && /daemonic claw/i.test(weapon.name)) {
      mods.push(mod({ id: 'CHAOS-LEG-daemon-claw', owner: side, source: 'ability', name: 'Unleash Daemon', text: 'Daemonic claw: Ceaseless, Lethal 5+', effect: { addRules: { ceaseless: true, lethal: 5 } }, tone: 'good' }))
    }
  }
  // Blood for the Blood God: Khorne melee weapons +1 to both Dmg stats (max 7); others,
  // fighting, add 1 damage to their first strike.
  if (weapon && ctx.stratActive(side, PLOYS.bloodForTheBloodGod)) {
    const base = { id: PLOYS.bloodForTheBloodGod, owner: side, source: 'strat', name: 'Blood for the Blood God' }
    if (operative.mark === 'KHORNE') {
      const up = (value) => (value != null && value < DMG_MAX ? 1 : 0)
      mods.push(mod({ ...base, text: 'Khorne: +1 Dmg (max 7)', effect: { normalDmg: up(weapon.dmg?.normal), critDmg: up(weapon.dmg?.crit) }, tone: 'good' }))
    } else if (!retaliating) {
      mods.push(mod({ ...base, mode: 'note', text: 'The first time it strikes in this fight: 1 more damage (max 7)' }))
    }
  }
  // Quicksilver Speed: fighting after moving this turning point, the enemy's Hit is worse
  // (not on top of the enemy being injured).
  if (weapon && !retaliating && ctx.stratActive(side, PLOYS.quicksilverSpeed)) {
    const base = { id: PLOYS.quicksilverSpeed, owner: side, source: 'strat', name: 'Quicksilver Speed' }
    mods.push(
      !movedThisTp(ctx, operative, token)
        ? mod({ ...base, mode: 'inactive', text: 'It hasn’t moved this turning point' })
        : enemy.injured
          ? mod({ ...base, mode: 'inactive', text: 'Not on top of the enemy being injured' })
          : mod({ ...base, text: 'Moved this turning point: the enemy’s Hit is worse by 1', effect: { opponentHit: 1 }, tone: 'good' }),
    )
  }
  // Unending Bloodshed (firefight ploy): a Khorne Legionary incapacitated in this fight
  // strikes with one unresolved success before it's removed.
  if (weapon && ctx.inBattle && operative.mark === 'KHORNE') {
    mods.push(
      mod({ id: PLOYS.unendingBloodshed, owner: side, source: 'firefight', name: 'Unending Bloodshed', mode: 'toggle', cost: 1, limit: 1, text: 'Khorne: if it’s incapacitated in this fight, strike with one unresolved success first', tone: 'good' }),
    )
  }
  // Implacable: an injured Nurgle Legionary ignores being injured (its Hit too).
  if (weapon && ctx.stratActive(side, PLOYS.implacable) && operative.mark === 'NURGLE' && operative.injured) {
    mods.push(mod({ ...{ id: PLOYS.implacable, owner: side, source: 'strat', name: 'Implacable' }, text: 'Nurgle: ignores being injured', effect: { hit: -1 }, tone: 'good' }))
  }
  if (weapon && operative.mark === 'KHORNE') {
    mods.push(markMod(side, 'KHORNE', 'Wrathful Onslaught', { text: 'Khorne: melee weapons have Severe', effect: { addRules: { severe: true } } }))
  }
  if (weapon && operative.mark === 'UNDIVIDED') mods.push(viciousReavers(side, ctx.gap))
  if (operative.mark === 'NURGLE') mods.push(disgustingVigour(side))
  if (side === 'attacker' && ctx.inBattle) mods.push(astartes(side, 'It can Fight twice this activation'))
  return mods
}
