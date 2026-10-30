// Shot modifiers: every rule that changes (or might change) a shot, and how their
// effects add up.
//
// A modifier:
//   id      unique per player for the shot (ploy id, equipment id or a rule key)
//   owner   'attacker' | 'defender': whose half of the card lists it, and who turns it
//           on or off on their own iPad
//   source  'core' | 'weapon' | 'equipment' | 'strat' | 'firefight' | 'faction' | 'ability'
//   name    the rule's name; text: what it does here
//   mode    'auto'     its conditions are met, so it applies
//           'default'  applies unless its owner turns it off
//           'toggle'   applies once its owner turns it on (e.g. a firefight ploy)
//           'note'     a reminder; changes no numbers
//           'inactive' in play, but its conditions aren't met (text says why)
//           'warning'  something that stops or limits the shot
//   cost    CP spent when it's turned on; limit: uses per turning point
//   generic true for suggestions read from another team's rules text
//   blockedBy(onModifiers) -> reason it can't apply right now, or null
//   effect  see emptyEffects

export const mod = (fields) => ({ mode: 'auto', effect: {}, ...fields })

// Weapon rules a modifier can add, with "select which x to use" when the weapon already
// has the rule (core rules: weapons gain no benefit from having a rule twice).
const BEST_X = {
  lethal: Math.min,
  piercing: Math.max,
  piercingCrits: Math.max,
  blast: Math.max,
  torrent: Math.max,
  range: Math.max,
}

export const emptyEffects = () => ({
  // Stat changes: + is worse for Hit and Save (a higher number to roll).
  hit: 0,
  atk: 0,
  normalDmg: 0,
  critDmg: 0,
  save: 0,
  addRules: [],
  // Accurate x instances (two or more count as Accurate 2).
  accurate: [],
  removeRange: false,
  ignoreSaturate: false,
  ignorePiercing: false,
  cannotBeObscured: false,
  // Skytorch and Explosive: no cover, not obscured, no target selection.
  noCover: false,
  noObscured: false,
  skipTargeting: null,
  allowFriendly: false,
  // Ocelli: inches higher for Vantage.
  vantageBonus: 0,
  assumeCover: false,
  extraAutoSaves: 0,
  coverImprove: false,
  coverAsCrit: false,
  critsToNormal: false,
  chooseCover: false,
  spendsCommunion: false,
  // e.g. "Normal Dmg of 3 or more inflicts 1 less damage": { atLeast: 3, by: 1 }
  dmgReduction: null,
  // The same, on the opponent's weapon in a fight (e.g. Hardened Exoskeleton).
  opponentDmgReduction: null,
  // "improve the Hit stat by 1 (to a maximum of 3+)"
  hitMax: null,
  rerolls: { attack: [], defence: [] },
  notValid: [],
  // Why the numbers changed: { key, value, name } for every effect of an applied rule
  // (key 'hit', 'atk', … a flag such as 'ignorePiercing', or 'rule:piercing' for an
  // added weapon rule), so each changed stat can name its causes.
  trace: [],
})

const TRACED_FLAGS = ['ignoreSaturate', 'ignorePiercing', 'coverImprove', 'coverAsCrit', 'critsToNormal', 'cannotBeObscured']

export const mergeEffects = (modifiers, into = emptyEffects()) =>
  modifiers.reduce((acc, modifier) => {
    const effect = modifier.effect ?? {}
    const name = modifier.name
    ;['hit', 'atk', 'normalDmg', 'critDmg', 'save', 'extraAutoSaves'].forEach((key) => {
      acc[key] += effect[key] ?? 0
      if (effect[key]) acc.trace.push({ key, value: effect[key], name })
    })
    TRACED_FLAGS.forEach((key) => {
      if (effect[key]) acc.trace.push({ key, value: true, name })
    })
    Object.entries(effect.addRules ?? {}).forEach(([rule, value]) => {
      if (value != null && value !== false) acc.trace.push({ key: `rule:${rule}`, value, name })
    })
    ;['accurate', 'dmgReduction', 'opponentDmgReduction', 'hitMax'].forEach((key) => {
      if (effect[key]) acc.trace.push({ key, value: effect[key], name })
    })
    ;[
      'removeRange',
      'ignoreSaturate',
      'ignorePiercing',
      'cannotBeObscured',
      'noCover',
      'noObscured',
      'allowFriendly',
      'assumeCover',
      'coverImprove',
      'coverAsCrit',
      'critsToNormal',
      'chooseCover',
      'spendsCommunion',
    ].forEach((key) => {
      if (effect[key]) acc[key] = true
    })
    if (effect.addRules) acc.addRules.push(effect.addRules)
    if (effect.accurate) acc.accurate.push({ x: effect.accurate, name: modifier.name })
    if (effect.vantageBonus) acc.vantageBonus = Math.max(acc.vantageBonus, effect.vantageBonus)
    if (effect.skipTargeting) acc.skipTargeting = effect.skipTargeting
    if (effect.dmgReduction) acc.dmgReduction = effect.dmgReduction
    if (effect.opponentDmgReduction) acc.opponentDmgReduction = effect.opponentDmgReduction
    if (effect.hitMax) acc.hitMax = Math.max(acc.hitMax ?? 0, effect.hitMax)
    if (effect.reroll) acc.rerolls[effect.reroll].push(modifier.name)
    if (effect.notValid) acc.notValid.push({ code: modifier.id, text: effect.notValid })
    return acc
  }, into)

// The weapon's rules once modifiers have added theirs (and removed Range).
export const applyRuleChanges = (rules, effects) => {
  const next = { ...rules, special: [...(rules?.special ?? [])] }
  effects.addRules.forEach((added) => {
    Object.entries(added).forEach(([key, value]) => {
      if (value == null || value === false) return
      if (BEST_X[key] && typeof value === 'number') next[key] = next[key] ? BEST_X[key](next[key], value) : value
      else next[key] = value
    })
  })
  if (effects.removeRange) delete next.range
  if (effects.ignoreSaturate) next.saturate = false
  if (effects.ignorePiercing) {
    next.piercing = 0
    next.piercingCrits = 0
  }
  return next
}

// Which modifiers apply. toggles: { [modifierId]: boolean } per seat.
export const resolveModifiers = (modifiers, ctx) => {
  const decided = modifiers.map((modifier) => {
    if (modifier.mode === 'auto' || modifier.mode === 'warning') return { ...modifier, on: true }
    if (!['default', 'toggle'].includes(modifier.mode)) return { ...modifier, on: false }
    const explicit = ctx.toggles[ctx.seatOf(modifier.owner)]?.[modifier.id]
    return { ...modifier, on: explicit ?? modifier.mode === 'default' }
  })
  // Rules that can't combine with others (e.g. Warrior Instincts needs no Communion
  // point spent): switched off, with the reason shown.
  const on = decided.filter((modifier) => modifier.on)
  return decided.map((modifier) => {
    const reason = modifier.blockedBy?.(on.filter((other) => other !== modifier)) ?? null
    return reason ? { ...modifier, on: false, mode: 'inactive', text: reason } : modifier
  })
}

const MODE_ORDER = { warning: 0, auto: 1, default: 2, toggle: 3, note: 4, inactive: 5 }

// Adds who owns each modifier and whether its uses this turning point are spent, and
// sorts them for the card: warnings, then what applies, then what's on offer.
export const listModifiers = (list, ctx, saved) =>
  list
    .map((modifier) => {
      const spent = saved?.spent?.[ctx.seatOf(modifier.owner)] ?? {}
      const spentHere = modifier.id in spent
      const uses = ctx.usesThisTp(modifier.owner, modifier.id)
      return {
        ...modifier,
        seat: ctx.seatOf(modifier.owner),
        spentHere,
        // Used up this turning point by another shot or fight.
        used: Boolean(modifier.limit) && uses >= modifier.limit && !spentHere,
      }
    })
    .sort((a, b) => MODE_ORDER[a.mode] - MODE_ORDER[b.mode])
