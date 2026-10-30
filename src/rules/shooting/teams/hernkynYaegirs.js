import { CONTROL_RANGE, abilityNamed, gapBetween } from '../context.js'
import { mod } from '../effects.js'

// Hernkyn Yaegirs (VOT-HKY), hand-checked against the current team rules (Wahapedia,
// November 2025 update; see docs/kill-team-rules.md).

const PLOYS = {
  masterfulBladework: 'VOT-HKY-S-MBW',
  hiddenEngagement: 'VOT-HKY-S-HE',
  inPosition: 'VOT-HKY-S-IP',
  toughSurvivalists: 'VOT-HKY-S-TS',
  noKinLeftBehind: 'VOT-HKY-T-NKLB',
  stalwartDefence: 'VOT-HKY-T-SD',
  sturdy: 'VOT-HKY-T-STRD',
}
const EQUIPMENT = {
  plasmaKnives: 'VOT-HKY-PK',
  firestorm: 'VOT-HKY-FSBS',
  stabilised: 'VOT-HKY-SBS',
  undersuit: 'VOT-HKY-KVCU',
}
const FALLEN_KIN = 'vot-hky-fallen-kin'

const boltShotgun = (weapon, range) => /bolt shotgun/i.test(weapon.name) && new RegExp(range, 'i').test(weapon.profile)

export const attack = (ctx) => {
  const { shooter, weapon } = ctx
  const mods = []
  const owner = 'attacker'
  if (ctx.stratActive(owner, PLOYS.hiddenEngagement)) {
    const base = { id: PLOYS.hiddenEngagement, owner, source: 'strat', name: 'Hidden Engagement' }
    mods.push(
      ctx.shooterInCoverFromTarget()
        ? mod({ ...base, text: 'In cover from the target: Balanced', effect: { addRules: { balanced: true } }, tone: 'good' })
        : mod({ ...base, mode: 'inactive', text: 'Not in cover from every point of the target’s base' }),
    )
  }
  // No Kin Left Behind's Fallen Kin marker stays in play once placed.
  const kin = ctx.markers.find(
    (marker) => marker.catalogId === FALLEN_KIN && marker.seat === shooter.seat && !marker.attachedTo,
  )
  if (kin && gapBetween(ctx.shooterToken, kin) <= 3) {
    mods.push(
      mod({
        id: PLOYS.noKinLeftBehind,
        owner,
        source: 'firefight',
        name: 'Fallen Kin',
        text: 'Within 3": keep 1 fail as a normal success, or 1 normal success as a crit',
        tone: 'good',
      }),
    )
  }
  if (abilityNamed(shooter, 'Pan Spectral Visor')) {
    const base = { id: 'VOT-HKY-pan-spectral-visor', owner, source: 'ability', name: 'Pan Spectral Visor' }
    mods.push(
      ctx.gap <= 6
        ? mod({
            ...base,
            text: 'Within 6": Seek Light, and the target can’t be obscured',
            effect: { addRules: { seekLight: true }, cannotBeObscured: true },
            tone: 'good',
          })
        : mod({ ...base, mode: 'inactive', text: 'Target more than 6" away' }),
    )
  }
  if (abilityNamed(shooter, 'Tracker')) {
    const base = { id: 'VOT-HKY-tracker', owner, source: 'ability', name: 'Tracker' }
    mods.push(
      ctx.targetExpended && ctx.gap <= 6
        ? mod({ ...base, text: 'Expended target within 6": Punishing', effect: { addRules: { punishing: true } }, tone: 'good' })
        : mod({ ...base, mode: 'inactive', text: ctx.targetExpended ? 'Target more than 6" away' : 'Target isn’t expended' }),
    )
  }
  if (!weapon) return mods
  if (weapon.rules.special.includes('Bipod')) {
    const base = { id: 'VOT-HKY-bipod', owner, source: 'weapon', name: 'Bipod' }
    mods.push(
      !ctx.movedThisActivation || ctx.counteracting
        ? mod({
            ...base,
            text: ctx.counteracting ? 'Counteracting: Ceaseless' : 'Hasn’t moved this activation: Ceaseless',
            effect: { addRules: { ceaseless: true } },
            tone: 'good',
          })
        : mod({ ...base, mode: 'inactive', text: 'It moved this activation' }),
    )
  }
  if (weapon.rules.special.includes('Concealed Position')) {
    mods.push(
      mod({ id: 'VOT-HKY-concealed-position', owner, source: 'weapon', name: 'Concealed Position', mode: 'note', text: 'Only the first time it shoots in the battle' }),
    )
  }
  if (abilityNamed(shooter, 'Brazen Killer') && /wroughtlock/i.test(weapon.name)) {
    mods.push(
      mod({
        id: 'VOT-HKY-brazen-killer',
        owner,
        source: 'ability',
        name: 'Brazen Killer',
        mode: 'note',
        text: 'If it incapacitates the target: roll a D6 for each other enemy visible to and within 2" of it; beat its APL for −1 APL',
      }),
    )
  }
  // Stalwart Defence: another Yaegir (not itself engaged) within 6" of a friendly
  // Yaegir shoots the enemy that just moved into that Yaegir's control range.
  const shooterEngaged = ctx
    .operatives(ctx.target.seat)
    .some((enemy) => gapBetween(enemy, ctx.shooterToken) <= CONTROL_RANGE)
  const guardedNearby = ctx
    .operatives(shooter.seat, ctx.shooterToken)
    .some((friend) => gapBetween(friend, ctx.targetToken) <= CONTROL_RANGE && gapBetween(friend, ctx.shooterToken) <= 6)
  if (guardedNearby && !shooterEngaged && weapon.atk != null) {
    const barred = weapon.grenade === 'frag' || weapon.grenade === 'krak' || weapon.rules.blast || weapon.rules.devastating?.distance
    mods.push(
      mod({
        id: PLOYS.stalwartDefence,
        owner,
        source: 'firefight',
        name: 'Stalwart Defence',
        mode: 'toggle',
        cost: 1,
        limit: 1,
        text: barred
          ? 'Can’t use frag, krak, Blast or x" Devastating weapons'
          : 'It just moved into a friendly Yaegir’s control range: shoot it anyway',
        effect: barred ? { notValid: 'Stalwart Defence: no frag, krak, Blast or x" Devastating weapons' } : { allowFriendly: true },
        tone: barred ? 'bad' : 'good',
      }),
    )
  }
  if (ctx.hasEquipment(owner, EQUIPMENT.firestorm) && boltShotgun(weapon, 'short')) {
    mods.push(
      mod({
        id: EQUIPMENT.firestorm,
        owner,
        source: 'equipment',
        name: 'Firestorm Bolt Shells',
        mode: 'toggle',
        limit: 1,
        text: 'Blast 1" (once per turning point)',
        effect: { addRules: { blast: 1 } },
        tone: 'good',
      }),
    )
  }
  if (ctx.hasEquipment(owner, EQUIPMENT.stabilised) && boltShotgun(weapon, 'long')) {
    mods.push(
      mod({
        id: EQUIPMENT.stabilised,
        owner,
        source: 'equipment',
        name: 'Stabilised Bolt Shells',
        mode: 'toggle',
        limit: 2,
        text: 'Hit +1, Dmg +1/+1, Accurate 1 (twice per turning point)',
        effect: { hit: -1, normalDmg: 1, critDmg: 1, accurate: 1 },
        tone: 'good',
      }),
    )
  }
  return mods
}

export const defence = (ctx) => {
  const { target } = ctx
  const owner = 'defender'
  const mods = []
  if (ctx.stratActive(owner, PLOYS.inPosition)) {
    const base = { id: PLOYS.inPosition, owner, source: 'strat', name: 'In Position' }
    const inCover = ctx.analysis.cover
    mods.push(
      target.order === 'conceal' && inCover
        ? mod({
            ...base,
            text: 'Conceal order and in cover: not a valid target (beats Seek and Vantage)',
            effect: { notValid: 'In Position: Conceal order and in cover' },
            tone: 'good',
          })
        : mod({
            ...base,
            mode: 'inactive',
            text: target.order !== 'conceal' ? 'Needs a Conceal order' : ctx.analysis.tooClose ? 'Within 2": no cover' : 'Not in cover',
          }),
    )
  }
  if (ctx.stratActive(owner, PLOYS.toughSurvivalists)) {
    mods.push(
      mod({
        id: PLOYS.toughSurvivalists,
        owner,
        source: 'strat',
        name: 'Tough Survivalists',
        mode: 'note',
        text: 'First damage it takes this turning point: halve it (round up, min 2)',
      }),
    )
  }
  if (ctx.weapon?.atk != null && ctx.inBattle) {
    const base = { id: PLOYS.sturdy, owner, source: 'firefight', name: 'Sturdy' }
    mods.push(
      ctx.certainlyObscured()
        ? mod({ ...base, mode: 'inactive', text: 'Obscured: the attacker has no crits anyway' })
        : mod({
            ...base,
            mode: 'toggle',
            cost: 1,
            limit: 1,
            text: 'The attacker’s crits become normal successes (resolved rules still apply)',
            effect: { critsToNormal: true },
            tone: 'good',
          }),
    )
  }
  if (abilityNamed(target, 'Outright Conviction')) {
    mods.push(
      mod({
        id: 'VOT-HKY-outright-conviction',
        owner,
        source: 'ability',
        name: 'Outright Conviction',
        mode: 'note',
        text: 'First time it would be incapacitated: 1 wound left, the rest of the attack dice are discarded',
      }),
    )
  }
  if (abilityNamed(target, 'Weavewerke Cloak')) {
    mods.push(
      mod({
        id: 'VOT-HKY-weavewerke-cloak',
        owner,
        source: 'ability',
        name: 'Weavewërke Cloak',
        text: 'Ignores Saturate; with a cover save: keep 1 more, or keep it as a crit (not with Vantage’s)',
        effect: { ignoreSaturate: true, coverImprove: true },
        tone: 'good',
      }),
    )
  }
  const rules = ctx.attackRules
  if (ctx.hasEquipment(owner, EQUIPMENT.undersuit) && (rules?.blast || rules?.torrent)) {
    mods.push(
      mod({
        id: EQUIPMENT.undersuit,
        owner,
        source: 'equipment',
        name: 'KV-Ceramide Undersuit',
        text: 'Blast or Torrent: re-roll one defence die',
        effect: { reroll: 'defence' },
        tone: 'good',
      }),
    )
  }
  return mods
}

// Fighting (side 'attacker') or retaliating (side 'defender').
export const fight = (ctx, side) => {
  const { operative, token, weapon, retaliating } = ctx.fighter(side)
  const mods = []
  const owner = side
  // Plasma Knives: an operative that already has a better plasma knife uses it, and it
  // has Balanced for the battle.
  const knifeBalanced = Boolean(weapon) && ctx.hasEquipment(owner, EQUIPMENT.plasmaKnives) && weapon.source === 'datacard' && /^plasma knife$/i.test(weapon.name)
  if (knifeBalanced) {
    mods.push(mod({ id: EQUIPMENT.plasmaKnives, owner, source: 'equipment', name: 'Plasma Knives', text: 'Its better plasma knife: Balanced', effect: { addRules: { balanced: true } }, tone: 'good' }))
  }
  if (weapon && ctx.stratActive(owner, PLOYS.masterfulBladework)) {
    const base = { id: PLOYS.masterfulBladework, owner, source: 'strat', name: 'Masterful Bladework' }
    const atk = Math.max(0, Math.min(4, weapon.atk + 1) - weapon.atk)
    const balanced = weapon.rules.balanced || knifeBalanced
    mods.push(
      !retaliating || operative.order === 'conceal'
        ? mod({
            ...base,
            text: `${atk ? 'Atk +1 (max 4), ' : ''}${balanced ? 'Ceaseless (already Balanced)' : 'Balanced'}`,
            effect: { atk, addRules: balanced ? { ceaseless: true } : { balanced: true } },
            tone: 'good',
          })
        : mod({ ...base, mode: 'inactive', text: 'Retaliating on an Engage order' }),
    )
  }
  const kin = ctx.markers.find((marker) => marker.catalogId === FALLEN_KIN && marker.seat === operative.seat && !marker.attachedTo)
  if (kin && gapBetween(token, kin) <= 3) {
    mods.push(
      mod({ id: PLOYS.noKinLeftBehind, owner, source: 'firefight', name: 'Fallen Kin', text: 'Within 3": keep 1 fail as a normal success, or 1 normal success as a crit', tone: 'good' }),
    )
  }
  if (!retaliating && abilityNamed(operative, 'Tracker')) {
    const base = { id: 'VOT-HKY-tracker', owner, source: 'ability', name: 'Tracker' }
    mods.push(
      ctx.targetExpended && ctx.gap <= 6
        ? mod({ ...base, text: 'Fighting an expended enemy: Punishing', effect: { addRules: { punishing: true } }, tone: 'good' })
        : mod({ ...base, mode: 'inactive', text: 'The enemy isn’t expended' }),
    )
  }
  if (ctx.stratActive(owner, PLOYS.toughSurvivalists)) {
    mods.push(mod({ id: PLOYS.toughSurvivalists, owner, source: 'strat', name: 'Tough Survivalists', mode: 'note', text: 'First damage it takes this turning point: halve it (round up, min 2)' }))
  }
  if (abilityNamed(operative, 'Irrepressible Hardiness')) {
    mods.push(mod({ id: 'VOT-HKY-irrepressible-hardiness', owner, source: 'ability', name: 'Irrepressible Hardiness', mode: 'note', text: 'If incapacitated in this fight: strike once more with an unresolved success first' }))
  }
  if (abilityNamed(operative, 'Outright Conviction')) {
    mods.push(mod({ id: 'VOT-HKY-outright-conviction', owner, source: 'ability', name: 'Outright Conviction', mode: 'note', text: 'First time it would be incapacitated: 1 wound left, the rest of the attack dice are discarded' }))
  }
  return mods
}

// KV-Ceramide Undersuit: x" Devastating doesn't affect Yaegirs that aren't the target.
export const immuneToDevastating = (game) => (token) =>
  game.players?.[token.seat]?.killteamId === 'VOT-HKY' && (game.players[token.seat].equipment ?? []).includes(EQUIPMENT.undersuit)
