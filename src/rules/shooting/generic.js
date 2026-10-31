import { getKillteamById } from '../../data/ktData.js'
import { matchesKeywords, parseWeaponRules } from '../weaponRules.js'
import { mod } from './effects.js'

// Kill teams without hand-checked rules get suggestions read from their rules text:
// the strategy ploys that are active, shooting firefight ploys, equipment taken, and
// the two operatives' abilities. Anything with conditions is offered as a toggle for
// its owner to turn on ("check the conditions"); only plain, unconditional text from
// an active strategy ploy or an operative's own ability applies by itself.

// Rules text without markdown, or the weapon rule definitions some texts end with
// ("**Balanced:** Can re-roll one Attack die.").
const clean = (text) =>
  String(text ?? '')
    .replace(/\*\*[A-Z][\w ]*?(?: x)?:\*\*[\s\S]*$/, '')
    .replace(/\*\*/g, '')
    .replace(/[_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

// "Whenever a friendly X operative is shooting" / "this operative's ranged weapons have".
const OFFENSIVE =
  /(?:friendly [A-Z][A-Z' ]*operatives?(?:'|’)? (?:is|are) (?:shooting|performing the Shoot action)|friendly [A-Z][A-Z' ]*operatives? performs? the Shoot action|this operative is (?:shooting|performing the Shoot action)|(?:it|that operative|this operative) (?:is shooting|performs the Shoot action)|ranged weapons? (?:have|has|gains?) the|when (?:it|this operative) shoots)/i
// "Whenever an (enemy) operative is shooting a friendly X operative / this operative",
// or a friendly operative "is selected as the valid target".
const DEFENSIVE =
  /(?:selected as the (?:valid )?target|selects (?:a|this) friendly [^.]*? as the|(?:enemy operative|an operative)(?: within [^,.]*?)? (?:is shooting|shoots|is performing the Shoot action|performs the Shoot action)|shooting (?:against )?(?:a friendly|this operative)|is being shot)/i
const CONDITIONS =
  /\b(if|unless|while|within|during|until|when|first time|once per|instead|that has|that have|that was|already|wounded|in cover|obscured|conceal|engage|wholly|visible|expended|ready|counteract|injured|marker|token|select|roll|against)\b/i
// Triggers that aren't conditions in themselves.
const PLAIN_TRIGGER =
  /^(?:Whenever (?:this operative|a friendly [A-Z][A-Z' ]* operative|an (?:enemy )?operative) is (?:shooting(?: (?:this operative|a friendly [A-Z][A-Z' ]* operative))?|fighting(?: or retaliating)?|retaliating), |Friendly [A-Z][A-Z' ]* operatives(?:'|’) )/

// Fights: rules for the operative fighting (the attacker) or retaliating (defender).
const FIGHTING = /\b(?:is fighting|are fighting|fights|melee weapons?)\b/i
const RETALIATING = /\b(?:retaliat\w*|melee weapons?)\b/i

const unconditional = (text) => !CONDITIONS.test(text.replace(PLAIN_TRIGGER, ''))

// What the rule is used for, from its trigger (its first sentence).
const sideOf = (text) => {
  const trigger = text.split(/(?<!e\.g|i\.e)\.\s/)[0]
  const defensive = DEFENSIVE.test(trigger)
  return {
    attack: !defensive && OFFENSIVE.test(text),
    defence: defensive || DEFENSIVE.test(text),
  }
}

// The operative a rule is for, e.g. "a friendly KASRKIN TROOPER operative (excluding …)".
const appliesTo = (text, keywords) => {
  const who = text.match(/friendly ([A-Z][A-Z' ]*?[A-Z]) operatives?/)?.[1]
  if (who && !matchesKeywords(who, keywords)) return false
  const excluded = text.match(/friendly [A-Z][A-Z' ]*?operatives? \(excluding ([^)]*)\)/)?.[1] ?? ''
  return !excluded
    .split(/,|\band\b|\bor\b/)
    .map((phrase) => phrase.trim())
    .some((phrase) => phrase && matchesKeywords(phrase, keywords))
}

const short = (text, max = 110) => {
  const sentence = clean(text)
    .replace(/^Use this (?:firefight|strategy) ploy /i, 'Use ')
    .split(/(?<!e\.g|i\.e)\.\s/)[0]
  return sentence.length > max ? `${sentence.slice(0, max - 1).trimEnd()}…` : sentence
}

// Weapon rules a text grants: "have the Lethal 5+ and Saturate weapon rules". An
// alternative after "; if the weapon already has …" or "… instead" isn't added too.
const grantedRules = (raw) => {
  const text = raw.split(/;\s*if\b/i)[0]
  const added = {}
  const names = []
  for (const match of text.matchAll(/(?:have|has|gains?) the ([^.;:]+?) weapon rules?/gi)) {
    if (/\bor\b/i.test(match[1])) continue
    const parts = match[1].split(/,\s*|\s+and\s+/i).map((part) => part.trim())
    const parsed = parseWeaponRules(parts.join(', '))
    Object.entries(parsed).forEach(([key, value]) => {
      if (key === 'special' || !value) return
      added[key] = value
    })
    parts.filter((part) => !parsed.special.includes(part) && !names.includes(part)).forEach((part) => names.push(part))
  }
  return { added, names }
}

export const parseAttackText = (raw) => {
  const text = clean(raw)
  const effect = {}
  const summary = []
  const { added, names } = grantedRules(text)
  if (added.accurate) {
    effect.accurate = added.accurate
    delete added.accurate
  }
  if (Object.keys(added).length || effect.accurate) {
    if (Object.keys(added).length) effect.addRules = added
    summary.push(names.join(', '))
  }
  let match
  if ((match = text.match(/improve the Hit stat of [^.]*? by (\d)(?: \(to a maximum of (\d)\+\))?/i))) {
    effect.hit = -Number(match[1])
    if (match[2]) effect.hitMax = Number(match[2])
    summary.push(`Hit +${match[1]}${match[2] ? ` (max ${match[2]}+)` : ''}`)
  }
  if ((match = text.match(/add (\d) to (?:the |its |their |that weapon(?:'|’)s )?Atk stat/i))) {
    effect.atk = Number(match[1])
    summary.push(`Atk +${match[1]}`)
  }
  if ((match = text.match(/add (\d) to both (?:of )?(?:its |their |that weapon(?:'|’)s )?Dmg stats/i))) {
    effect.normalDmg = Number(match[1])
    effect.critDmg = Number(match[1])
    summary.push(`Dmg +${match[1]}/+${match[1]}`)
  } else {
    if ((match = text.match(/add (\d) to (?:its |their |the |that weapon(?:'|’)s )?Normal Dmg/i))) {
      effect.normalDmg = Number(match[1])
      summary.push(`Normal Dmg +${match[1]}`)
    }
    if ((match = text.match(/add (\d) to (?:its |their |the |that weapon(?:'|’)s )?Critical Dmg/i))) {
      effect.critDmg = Number(match[1])
      summary.push(`Crit Dmg +${match[1]}`)
    }
  }
  if (/re-roll one of your attack dice/i.test(text)) {
    effect.reroll = 'attack'
    summary.push('Re-roll one attack die')
  } else if (/re-roll any of your attack dice/i.test(text) && !effect.addRules?.relentless) {
    effect.addRules = { ...effect.addRules, relentless: true }
    summary.push('Re-roll any attack dice')
  }
  if (/cannot be obscured/i.test(text)) {
    effect.cannotBeObscured = true
    summary.push('Target can’t be obscured')
  }
  return { effect, summary: summary.join('; ') }
}

export const parseDefenceText = (raw) => {
  const text = clean(raw)
  const effect = {}
  const summary = []
  let match
  if ((match = text.match(/worsen the Hit stat of [^.]*? by (\d)/i))) {
    effect.hit = Number(match[1])
    summary.push(`Attacker’s Hit −${match[1]}`)
  }
  if ((match = text.match(/subtract (\d) from (?:the |its |their |that weapon(?:'|’)s )?Atk stat/i))) {
    effect.atk = -Number(match[1])
    summary.push(`Attacker’s Atk −${match[1]}`)
  }
  if ((match = text.match(/improve (?:its|the|their|this operative(?:'|’)s|that operative(?:'|’)s) Save stat by (\d)/i))) {
    effect.save = -Number(match[1])
    summary.push(`Save +${match[1]}`)
  }
  if (/ignore the Piercing(?: Crits)? weapon rule/i.test(text)) {
    effect.ignorePiercing = true
    summary.push('Ignore Piercing')
  }
  if (/ignore the Saturate weapon rule/i.test(text)) {
    effect.ignoreSaturate = true
    summary.push('Ignore Saturate')
  }
  if (/retain one of your defence dice as a normal success without rolling/i.test(text)) {
    effect.extraAutoSaves = 1
    summary.push('Keep 1 normal success without rolling')
  }
  if (/cover saves? (?:are|is) retained as (?:a )?critical success|retain (?:one|a|your) cover saves? as a critical success/i.test(text)) {
    effect.coverAsCrit = true
    summary.push('Cover saves are crits')
  } else if (/retain one additional cover save/i.test(text)) {
    effect.coverImprove = true
    summary.push('Keep 1 more cover save (or one as a crit)')
  }
  if (/re-roll (?:one|any) of your defence dice/i.test(text)) {
    effect.reroll = 'defence'
    // "Re-roll any of your defence dice results of one" (e.g. Whipcord Emergence since
    // Aug 2026) only re-rolls 1s, not any dice.
    const anyDice = /re-roll any of your defence dice(?! results of one)/i.test(text)
    const ones = /re-roll any of your defence dice results of one/i.test(text)
    summary.push(anyDice ? 'Re-roll any defence dice' : ones ? 'Re-roll defence dice showing 1' : 'Re-roll one defence die')
  }
  if (/cannot be selected as a valid target/i.test(text)) {
    effect.notValid = 'Not a valid target (team rule)'
    summary.push('Not a valid target')
  }
  if ((match = text.match(/Normal Dmg of (\d) or more inflicts (\d) less damage/i))) {
    summary.push(`Normal Dmg ${match[1]}+ deals ${match[2]} less`)
    effect.dmgReduction = { atLeast: Number(match[1]), by: Number(match[2]) }
  }
  return { effect, summary: summary.join('; ') }
}

const SOURCE_FOR_PLOY = { S: 'strat', T: 'firefight', F: 'firefight' }

// Candidate rules texts for one side: { id, source, name, text, kind }.
const rulesFor = (ctx, side, weapon = side === 'attacker' ? ctx.weapon : null) => {
  const operative = side === 'attacker' ? ctx.shooter : ctx.target
  const player = operative.player
  const killteam = getKillteamById(operative.killteamId)
  if (!killteam) return []
  const active = new Set(player?.ploysByTp?.[ctx.tp] ?? [])
  const ploys = (killteam.ploys ?? [])
    .filter((ploy) => (ploy.ployType === 'S' ? active.has(ploy.ployId) : SOURCE_FOR_PLOY[ploy.ployType]))
    .map((ploy) => ({ id: ploy.ployId, source: SOURCE_FOR_PLOY[ploy.ployType], name: ploy.ployName, text: ploy.description }))
  const equipment = (killteam.equipments ?? [])
    .filter((item) => item.killteamId && (player?.equipment ?? []).includes(item.eqId))
    .map((item) => ({ id: item.eqId, source: 'equipment', name: item.eqName, text: item.description }))
  const special = new Set(weapon?.rules.special ?? [])
  const abilities = operative.abilities
    .filter((ability) => {
      const name = String(ability.abilityName ?? '').trim()
      return !name.startsWith('*') || special.has(name.slice(1).trim())
    })
    .map((ability) => {
      const name = String(ability.abilityName ?? '').trim()
      return {
        id: `${operative.killteamId}-${name}`,
        source: name.startsWith('*') ? 'weapon' : ability.isFactionRule ? 'faction' : 'ability',
        name: name.replace(/^\*/, ''),
        text: ability.description,
      }
    })
  return [...ploys, ...equipment, ...abilities]
}

// Reading a rules text is the slow part, and the same texts come up for every enemy's
// badge on every frame, so each text is read once.
const readings = new Map()
// kind: 'attacker' | 'defender' (shooting) or 'fighting' | 'retaliating'.
const parseFightText = (text) => {
  const own = parseAttackText(text)
  const reduction = parseDefenceText(text).effect.dmgReduction
  if (!reduction) return own
  return {
    effect: { ...own.effect, opponentDmgReduction: reduction },
    summary: [own.summary, `Normal Dmg ${reduction.atLeast}+ deals ${reduction.by} less to it`].filter(Boolean).join('; '),
  }
}
const PARSERS = { attacker: parseAttackText, defender: parseDefenceText, fighting: parseFightText, retaliating: parseFightText }
const relevantFor = (text, kind) =>
  kind === 'fighting'
    ? FIGHTING.test(text)
    : kind === 'retaliating'
      ? RETALIATING.test(text)
      : sideOf(text)[kind === 'attacker' ? 'attack' : 'defence']

const readRule = (raw, kind) => {
  const key = `${kind}\u0000${raw}`
  if (!readings.has(key)) {
    // Rules made of several options (headed sections) can't be read as one effect.
    const text = /#{3,}/.test(raw) ? '' : clean(raw)
    const { effect, summary } = text ? PARSERS[kind](text) : { effect: {}, summary: '' }
    readings.set(key, {
      text,
      relevant: Boolean(text) && relevantFor(text, kind),
      effect,
      summary,
      plain: Boolean(text) && unconditional(text),
      short: text ? short(text) : '',
    })
  }
  return readings.get(key)
}

const suggestions = (ctx, side, kind = side, weapon = undefined) => {
  const owner = side
  const operative = side === 'attacker' ? ctx.shooter : ctx.target
  return rulesFor(ctx, side, weapon).flatMap((rule) => {
    const reading = readRule(String(rule.text ?? ''), kind)
    if (!reading.text || !appliesTo(reading.text, operative.keywords)) return []
    const weaponRule = rule.source === 'weapon'
    if (!reading.relevant && !weaponRule) return []
    const { effect, summary } = reading
    const parsed = Object.keys(effect).length > 0
    const base = { id: rule.id, owner, source: rule.source, name: rule.name, generic: true }
    if (rule.source === 'firefight') {
      if (!ctx.inBattle) return []
      return [mod({ ...base, mode: 'toggle', cost: 1, limit: 1, text: parsed ? summary : reading.short, effect, tone: 'good' })]
    }
    const plain = (rule.source === 'strat' || rule.source === 'ability' || rule.source === 'faction') && reading.plain
    if (parsed) return [mod({ ...base, mode: plain ? 'auto' : 'toggle', text: summary, effect, tone: 'good' })]
    // Nothing to apply automatically, but an active strategy ploy or the weapon's own
    // rule is worth a reminder.
    if (rule.source === 'strat' || weaponRule) return [mod({ ...base, mode: 'note', text: reading.short })]
    return []
  })
}

export const attack = (ctx) => suggestions(ctx, 'attacker')
export const defence = (ctx) => suggestions(ctx, 'defender')
export const fight = (ctx, side) =>
  suggestions(ctx, side, side === 'attacker' ? 'fighting' : 'retaliating', ctx.fighter(side).weapon)
