// The numbers each player rolls, from the weapon's datacard profile and every
// modifier that applies. Each number keeps its datacard value (base) so the card can
// show it green when it's better for whoever rolls it and red when worse.
//
// Core rules used here (docs/kill-team-rules.md):
// - Accurate x: keep up to x attack dice as normal successes without rolling; two or
//   more instances count as Accurate 2.
// - Lethal x+: successes of x+ are crits (a result must still be a success).
// - Obscured: discard one success, and crits count as normal successes and can't be
//   changed to crits (Punishing, Rending, Severe, Devastating, Piercing Crits and Stun
//   then do nothing).
// - A 1 always fails and a 6 is always a crit, so Hit and Save are shown 2+ to 6+.
// - Defence: 3 dice minus Piercing x; a cover save keeps one normal success without
//   rolling (none against Saturate); no more dice kept than collected.

const clampDie = (value) => Math.min(6, Math.max(2, value))

const toneOf = (base, value, lowerIsBetter = false) =>
  value === base ? 'same' : (lowerIsBetter ? value < base : value > base) ? 'better' : 'worse'

const stat = (base, value, lowerIsBetter = false) => ({ base, value, tone: toneOf(base, value, lowerIsBetter) })

// ---- why a number changed ----
// A reason is { text, tone: 'better' | 'worse' | 'info' }, from the point of view of
// whoever rolls that stat. Sources come from effects.trace (see effects.js); a rule the
// weapon has itself is credited to the weapon.
const traced = (effects, key) => (effects.trace ?? []).filter((entry) => entry.key === key)
const better = (text) => ({ text, tone: 'better' })
const worse = (text) => ({ text, tone: 'worse' })
const info = (text) => ({ text, tone: 'info' })
const sourceOf = (effects, rule, base) => traced(effects, `rule:${rule}`)[0]?.name ?? (base?.[rule] ? 'weapon' : null)
const byName = (entries) =>
  entries.reduce((acc, entry) => {
    const found = acc.find((other) => other.name === entry.name)
    if (found) found.value += entry.value
    else acc.push({ ...entry })
    return acc
  }, [])

// Rules shown on the attack side, in this order.
const RULE_LABELS = [
  ['range', (rules) => `Range ${rules.range}"`],
  ['blast', (rules) => `Blast ${rules.blast}"`],
  ['torrent', (rules) => `Torrent ${rules.torrent}"`],
  ['piercing', (rules) => `Piercing ${rules.piercing}`],
  ['piercingCrits', (rules) => `Piercing Crits ${rules.piercingCrits}`],
  ['devastating', (rules) => `${rules.devastating.distance ? `${rules.devastating.distance}" ` : ''}Devastating ${rules.devastating.damage}`],
  ['punishing', () => 'Punishing'],
  ['rending', () => 'Rending'],
  ['severe', () => 'Severe'],
  ['stun', () => 'Stun'],
  ['saturate', () => 'Saturate'],
  ['seek', () => 'Seek'],
  ['seekLight', () => 'Seek Light'],
  ['brutal', () => 'Brutal'],
  ['shock', () => 'Shock'],
  ['hot', () => 'Hot'],
  ['silent', () => 'Silent'],
  ['heavy', (rules) => (rules.heavy === 'any' ? 'Heavy' : `Heavy (${rules.heavy === 'dash' ? 'Dash' : 'Reposition'} only)`)],
  ['limited', (rules) => `Limited ${rules.limited}`],
]
// They need a crit kept (or a normal changed into one), so obscured stops them.
const NEED_CRITS = new Set(['punishing', 'rending', 'severe', 'devastating', 'piercingCrits', 'stun'])
const REROLL_RULES = [
  ['balanced', 'Balanced (1 die)'],
  ['ceaseless', 'Ceaseless (one result)'],
  ['relentless', 'Relentless (any)'],
]

const has = (rules, key) => {
  const value = rules?.[key]
  return Boolean(value) && !(key === 'devastating' && !value?.damage)
}

// One side's attack dice, for shooting or fighting.
//   base: the weapon's own rules; rules: after every modifier.
//   obscured: shooting an obscured target (crits count as normal successes).
export const attackProfile = ({ weapon, base, rules, effects, obscured = false }) => {
  const atk = Math.max(1, weapon.atk + effects.atk)
  const accurateXs = [...(base.accurate ? [base.accurate] : []), ...effects.accurate.map((entry) => entry.x)]
  const accurate = accurateXs.length > 1 ? Math.max(2, ...accurateXs) : accurateXs[0] ?? 0
  const autoHits = Math.min(accurate, atk)
  // An improvement "to a maximum of 3+" stops there (a better datacard Hit stays).
  const improved = weapon.hit + effects.hit
  const capped = Boolean(effects.hitMax) && improved < effects.hitMax
  const hit = clampDie(capped ? Math.min(weapon.hit, effects.hitMax) : improved)
  const lethal = rules.lethal ?? 6
  // A crit must also be a success.
  const critAt = Math.max(Math.min(lethal, 6), hit)
  const baseCritAt = Math.max(Math.min(base.lethal ?? 6, 6), weapon.hit)
  const normalDmg = Math.max(0, weapon.dmg.normal + effects.normalDmg)
  const critDmg = Math.max(0, weapon.dmg.crit + effects.critDmg)
  const reduction = effects.dmgReduction
  const reduced = Boolean(reduction) && normalDmg >= reduction.atLeast
  const normalHit = reduced ? Math.max(0, normalDmg - reduction.by) : normalDmg
  const crits = obscured ? 'none' : effects.critsToNormal ? 'normal' : 'yes'
  const dmgCrit = crits === 'normal' ? normalHit : critDmg

  // ---- reasons ----
  const diceReasons = byName(traced(effects, 'atk')).map(({ value, name }) =>
    value > 0 ? better(`+${value} Atk · ${name}`) : worse(`−${-value} Atk · ${name}`),
  )
  if (accurate > (base.accurate ?? 0)) {
    effects.accurate.forEach(({ x, name }) => diceReasons.push(better(`Accurate ${x} · ${name}`)))
    if (accurateXs.length > 1) diceReasons.push(better('Two Accurate rules: Accurate 2'))
  }
  const hitReasons = byName(traced(effects, 'hit')).map(({ value, name }) =>
    value < 0 ? better(`${name} · Hit +${-value}`) : worse(`${name} · Hit −${value}`),
  )
  if (capped) hitReasons.push(info(`Improves to ${effects.hitMax}+ at best`))
  else if (improved < 2) hitReasons.push(info('A 1 always fails: 2+ at best'))
  const critReasons = []
  const lethalBy = traced(effects, 'rule:lethal').find((entry) => entry.value === rules.lethal)
  if (lethalBy && rules.lethal < (base.lethal ?? 7)) critReasons.push(better(`Lethal ${rules.lethal}+ · ${lethalBy.name}`))
  if (lethal < 6 && critAt > lethal && crits !== 'none') critReasons.push(worse(`Hit ${hit}+ is worse than Lethal ${lethal}+`))
  if (crits === 'none') critReasons.push(worse('Obscured: crits count as normal'))
  if (crits === 'normal') {
    traced(effects, 'critsToNormal').forEach(({ name }) => critReasons.push(worse(`${name}: crits become normal`)))
  }
  const dmgEntries = [...traced(effects, 'normalDmg').map((entry) => ({ ...entry, kind: 'normal' })), ...traced(effects, 'critDmg').map((entry) => ({ ...entry, kind: 'crit' }))]
  const dmgReasons = [...new Set(dmgEntries.map((entry) => entry.name))].map((name) => {
    const normal = dmgEntries.filter((entry) => entry.name === name && entry.kind === 'normal').reduce((sum, entry) => sum + entry.value, 0)
    const crit = dmgEntries.filter((entry) => entry.name === name && entry.kind === 'crit').reduce((sum, entry) => sum + entry.value, 0)
    const signed = (n) => (n >= 0 ? `+${n}` : `−${-n}`)
    const text = normal === crit ? `Dmg ${signed(normal)}/${signed(crit)}` : normal ? `Normal Dmg ${signed(normal)}` : `Crit Dmg ${signed(crit)}`
    return normal + crit >= 0 ? better(`${text} · ${name}`) : worse(`${text} · ${name}`)
  })
  if (reduced) {
    const by = traced(effects, 'dmgReduction')[0]?.name ?? 'Enemy rule'
    dmgReasons.push(worse(`−${reduction.by} Normal Dmg (${reduction.atLeast}+) · ${by}`))
  }
  if (crits === 'normal') dmgReasons.push(worse('Crits deal Normal Dmg'))
  if (rules.devastating?.damage && crits !== 'none') {
    const added = !has(base, 'devastating')
    const text = `Devastating ${rules.devastating.damage} per crit${added ? ` · ${sourceOf(effects, 'devastating', base)}` : ''}`
    dmgReasons.push(added ? better(text) : info(text))
  }

  const ruleList = RULE_LABELS.filter(([key]) => has(base, key) || has(rules, key)).map(([key, label]) => {
    const inBase = has(base, key)
    const inFinal = has(rules, key)
    const changed = inBase && inFinal && JSON.stringify(base[key]) !== JSON.stringify(rules[key])
    const state = !inFinal ? 'removed' : obscured && NEED_CRITS.has(key) ? 'blocked' : !inBase || changed ? 'added' : 'base'
    return { key, text: label(inFinal ? rules : base), state, by: state === 'added' ? sourceOf(effects, key, null) : null }
  })
  const rerolls = [
    ...REROLL_RULES.filter(([key]) => rules[key]).map(([key, label]) => ({ text: label, added: !base[key], by: base[key] ? null : sourceOf(effects, key, null) })),
    ...effects.rerolls.attack.map((name) => ({ text: name, added: true, by: null })),
  ]
  return {
    // More dice, or more of them kept without rolling (Accurate), is better.
    dice: {
      ...stat(weapon.atk, atk),
      tone: atk !== weapon.atk ? toneOf(weapon.atk, atk) : toneOf(base.accurate ?? 0, accurate),
      rolled: atk - autoHits,
      auto: autoHits,
      accurate,
      reasons: diceReasons,
    },
    hit: { ...stat(weapon.hit, hit, true), reasons: hitReasons },
    crit: {
      ...stat(baseCritAt, critAt, true),
      crits,
      tone: crits === 'yes' ? toneOf(baseCritAt, critAt, true) : 'worse',
      reasons: critReasons,
    },
    dmg: {
      normal: stat(weapon.dmg.normal, normalHit),
      crit: { ...stat(weapon.dmg.crit, dmgCrit), tone: crits === 'normal' ? 'worse' : toneOf(weapon.dmg.crit, dmgCrit) },
      devastating: rules.devastating?.damage && crits !== 'none' ? rules.devastating.damage : null,
      reasons: dmgReasons,
    },
    rerolls,
    rules: ruleList,
  }
}

//   base: the weapon's own rules; rules: after every modifier.
//   state: { cover, obscured } once the defender's choice is made.
export const buildProfile = ({ weapon, base, rules, analysis, effects, state, target }) => {
  if (weapon?.atk == null) return null
  const attack = attackProfile({ weapon, base, rules, effects, obscured: state.obscured })
  const { crits } = attack.crit

  // ---- defence ----
  const piercingRaw = rules.piercing ?? 0
  const piercingCritsRaw = rules.piercingCrits ?? 0
  const smoke = (x) => (analysis.smokePiercing && x === 2 ? 1 : x)
  const piercing = smoke(piercingRaw)
  const piercingCrits = smoke(piercingCritsRaw)
  const dice = Math.max(0, 3 - piercing)
  // Piercing Crits x is the same rule as Piercing: the bigger x counts once a crit is kept.
  const diceIfCrit = crits !== 'none' && piercingCrits > piercing ? Math.max(0, 3 - piercingCrits) : null

  const coverSave = state.cover && !rules.saturate
  // Vantage (Conceal target, Light terrain) and rules like Weavewërke Cloak: keep the
  // cover save as a crit or keep one more; they don't stack with each other.
  const improve = coverSave && (analysis.vantageCoverImprove || effects.coverImprove)
  const allCrit = coverSave && effects.coverAsCrit
  const extra = effects.extraAutoSaves
  const cap = (count) => Math.min(dice, count)
  let auto
  if (!coverSave) {
    auto = { normal: cap(extra), crit: 0, alt: null }
  } else if (allCrit) {
    auto = { normal: 0, crit: cap(improve ? 2 : 1), alt: null }
    auto.normal = cap(auto.crit + extra) - auto.crit
  } else if (improve) {
    // Either one cover save kept as a crit, or two cover saves.
    auto = { normal: cap(extra), crit: Math.min(1, dice), alt: { normal: cap(2 + extra), crit: 0 } }
  } else {
    auto = { normal: cap(1 + extra), crit: 0, alt: null }
  }
  const autoCount = auto.normal + auto.crit
  const bestAuto = Math.max(autoCount, auto.alt ? auto.alt.normal + auto.alt.crit : 0)
  const autoTone = bestAuto > 0 ? 'better' : state.cover && rules.saturate ? 'worse' : 'same'
  const save = target.save ? clampDie(target.save + effects.save) : null

  // ---- reasons ----
  const diceReasons = []
  if (piercing) diceReasons.push(worse(`Piercing ${piercing} · ${sourceOf(effects, 'piercing', base) ?? 'weapon'}`))
  if (diceIfCrit != null) {
    diceReasons.push(worse(`Piercing Crits ${piercingCrits}: ${diceIfCrit} if a crit is kept · ${sourceOf(effects, 'piercingCrits', base) ?? 'weapon'}`))
  }
  if (analysis.smokePiercing && (piercingRaw === 2 || piercingCritsRaw === 2)) diceReasons.push(better('Smoke: Piercing 2 counts as 1'))
  const hadPiercing = base.piercing || base.piercingCrits || traced(effects, 'rule:piercing').length || traced(effects, 'rule:piercingCrits').length
  if (hadPiercing) traced(effects, 'ignorePiercing').forEach(({ name }) => diceReasons.push(better(`Ignores Piercing · ${name}`)))
  const autoReasons = []
  if (state.cover && rules.saturate) autoReasons.push(worse(`No cover save: Saturate · ${sourceOf(effects, 'saturate', base) ?? 'weapon'}`))
  else if (state.cover) autoReasons.push(better('Cover save'))
  const hadSaturate = base.saturate || traced(effects, 'rule:saturate').length
  if (state.cover && hadSaturate) traced(effects, 'ignoreSaturate').forEach(({ name }) => autoReasons.push(better(`Ignores Saturate · ${name}`)))
  if (allCrit) traced(effects, 'coverAsCrit').forEach(({ name }) => autoReasons.push(better(`Cover saves are crits · ${name}`)))
  if (improve) {
    const by = analysis.vantageCoverImprove ? 'Vantage' : traced(effects, 'coverImprove')[0]?.name ?? 'Rule'
    autoReasons.push(better(`1 crit or 2 normal · ${by}`))
  }
  byName(traced(effects, 'extraAutoSaves')).forEach(({ value, name }) => autoReasons.push(better(`+${value} kept · ${name}`)))
  if (autoCount < (coverSave ? 1 : 0) + extra) autoReasons.push(info(`Only ${dice} dice to keep`))
  const saveReasons = byName(traced(effects, 'save')).map(({ value, name }) =>
    value < 0 ? better(`${name} · Save +${-value}`) : worse(`${name} · Save −${value}`),
  )
  if (target.save && target.save + effects.save < 2) saveReasons.push(info('2+ at best'))

  return {
    attack,
    defence: {
      dice: { ...stat(3, dice), ifCrit: diceIfCrit, piercing, reasons: diceReasons },
      auto: { ...auto, count: autoCount, best: bestAuto, tone: autoTone, saturated: Boolean(state.cover && rules.saturate), reasons: autoReasons },
      save: save == null ? null : { ...stat(target.save, save, true), reasons: saveReasons },
      rolled: Math.max(0, dice - autoCount),
      rerolls: effects.rerolls.defence.map((name) => ({ text: name, added: true })),
    },
  }
}
