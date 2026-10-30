import { clampToBase, defaultShooterPoint } from '../../../shared/targeting.js'
import { rangedWeaponsFor } from '../weaponRules.js'
import { buildShotContext } from './context.js'
import { applyRuleChanges, emptyEffects, listModifiers, mergeEffects, resolveModifiers } from './effects.js'
import * as generic from './generic.js'
import { computeFight } from './fight.js'
import { buildProfile } from './profile.js'
import * as hernkynYaegirs from './teams/hernkynYaegirs.js'
import * as kommandos from './teams/kommandos.js'
import * as vespidStingwings from './teams/vespidStingwings.js'
import { COVER_CHOICE, PORTABLE_BARRICADE, coreModifiers, universalAttack, universalDefence } from './universal.js'

// The shot card: what each player rolls when the Sightline tool has a shooter, a
// target and a weapon, and every rule that changes it.
//
// 1. A first targeting check gives the facts rules depend on (cover, distance...).
// 2. The attacker's rules, then the defender's (which can strip weapon rules, e.g.
//    ignore Piercing), each applying or offered for their owner to turn on.
// 3. A second targeting check with the final weapon rules (Seek Light, Range
//    removed, Ocelli's extra height...), then the core rules read off it.
// 4. Validity (rules that take precedence over Seek and Vantage), then the numbers.

const CURATED = { 'VOT-HKY': hernkynYaegirs, 'TAU-VESP': vespidStingwings, 'ORK-KOM': kommandos }
export const CURATED_TEAMS = Object.keys(CURATED)
const teamRules = (killteamId) => CURATED[killteamId] ?? generic

// Toggles are kept per action, shooter and target (the weapon can change). The
// Sightline tool shares the shoot key, so a cover choice or barricade carries over.
export const shotKey = (payload) => `${payload.mode === 'fight' ? 'fight' : 'shoot'}|${payload.shooterId}|${payload.targetId}`

export const shooterPointFor = (shooterToken, targetToken, payload) =>
  payload.point
    ? clampToBase(shooterToken, { x: shooterToken.x + payload.point.dx, y: shooterToken.y + payload.point.dy })
    : defaultShooterPoint(shooterToken, targetToken)


// payload: the Sightline tool's { shooterId, targetId, point: { dx, dy } | null, weaponId }.
// glance: a quicker check for the at-a-glance badges.
// -> null without a shooter and target.
export const computeShot = ({ game, layout, payload, samples = 41, glance = false }) => {
  const tokens = game.tokens ?? []
  const shooterToken = tokens.find((token) => token.id === payload?.shooterId)
  const targetToken = tokens.find((token) => token.id === payload?.targetId)
  if (!shooterToken || !targetToken) return null
  const weapon = payload.weaponId
    ? rangedWeaponsFor(game, shooterToken).find((candidate) => candidate.id === payload.weaponId) ?? null
    : null
  const key = shotKey(payload)
  const saved = game.battle?.shots?.[key]
  const toggles = saved?.toggles ?? { A: {}, B: {} }
  const point = shooterPointFor(shooterToken, targetToken, payload)
  const ctx = buildShotContext({ game, layout, shooterToken, targetToken, weapon, point, toggles, samples, glance })
  const defenderSeat = ctx.target.seat
  // A Portable Barricade the target is connected to isn't on the map: its owner says so.
  const assumeCover =
    ctx.gap > 2 && ctx.hasEquipment('defender', PORTABLE_BARRICADE) && toggles[defenderSeat]?.[PORTABLE_BARRICADE] === true

  ctx.analysis = ctx.analyse({ weapon: weapon?.rules ?? null, assumeCover })
  const attackMods = resolveModifiers([...universalAttack(ctx), ...teamRules(ctx.shooter.killteamId).attack(ctx)], ctx)
  const attackOn = attackMods.filter((modifier) => modifier.on)
  ctx.attackEffects = mergeEffects(attackOn)
  ctx.attackRules = weapon ? applyRuleChanges(weapon.rules, { ...emptyEffects(), addRules: ctx.attackEffects.addRules }) : null
  const defenceMods = resolveModifiers([...universalDefence(ctx), ...teamRules(ctx.target.killteamId).defence(ctx)], ctx)
  const effects = mergeEffects([...attackOn, ...defenceMods.filter((modifier) => modifier.on)])
  const rules = weapon ? applyRuleChanges(weapon.rules, effects) : null
  const final = ctx.analyse({ weapon: rules, vantageBonus: effects.vantageBonus, assumeCover })

  // In cover from and obscured by the same terrain: the defender picks (obscured
  // unless they take the cover save).
  const canObscure = !effects.cannotBeObscured && !effects.noObscured
  const choose = final.chooseOne && canObscure && !effects.noCover
  const chooseCover = choose && toggles[defenderSeat]?.[COVER_CHOICE] === true
  const state = {
    choose,
    chooseCover,
    obscured: final.obscured && canObscure && !(choose && chooseCover),
    cover: final.cover && !effects.noCover && !(choose && !chooseCover),
  }
  const core = coreModifiers(ctx, final, rules, effects, state)
  const coreAttack = resolveModifiers(core.attack, ctx)
  const coreDefence = resolveModifiers(core.defence, ctx)
  mergeEffects([...coreAttack, ...coreDefence].filter((modifier) => modifier.on), effects)

  let blocks = final.blocks.filter(
    (block) => !(effects.allowFriendly && block.code === 'friendly') && !(effects.noCover && block.code === 'conceal-cover'),
  )
  if (effects.skipTargeting === 'torch') {
    // Skytorch: no valid target; it shoots everyone in its torch zone.
    blocks = vespidStingwings.inTorchZone(shooterToken, targetToken)
      ? []
      : [{ code: 'torch', text: 'Not in the torch zone (between where it started and ended its move)' }]
  } else if (effects.skipTargeting === 'explosive') {
    // The Bomb Squig is the primary target; Blast catches those visible to and near it.
    const blast = rules?.blast ?? 1
    blocks = [
      ...(ctx.gap > blast ? [{ code: 'explosive', text: `Not within ${blast}" of the Bomb Squig` }] : []),
      ...(final.hidden ? [{ code: 'hidden', text: 'Not visible to the Bomb Squig' }] : []),
    ]
  } else {
    blocks = [...blocks, ...effects.notValid]
  }

  const profile = weapon ? buildProfile({ weapon, base: weapon.rules, rules, analysis: final, effects, state, target: ctx.target }) : null
  const listed = (list) => listModifiers(list, ctx, saved)

  return {
    mode: 'shoot',
    key,
    weapon,
    point,
    shooter: ctx.shooter,
    target: ctx.target,
    analysis: final,
    rules,
    effects,
    state,
    valid: blocks.length === 0,
    blocks,
    attack: profile?.attack ?? null,
    defence: profile?.defence ?? null,
    modifiers: { attack: listed([...coreAttack, ...attackMods]), defence: listed([...coreDefence, ...defenceMods]) },
    immuneToDevastating: hernkynYaegirs.immuneToDevastating(game),
  }
}

// 'valid' | 'cover' | 'obscured' | 'invalid' for an enemy's badge, with every rule applied.
export const glanceShot = ({ game, layout, payload }) => {
  const shot = computeShot({ game, layout, payload, samples: 13, glance: true })
  if (!shot || !shot.valid) return 'invalid'
  return shot.state.obscured ? 'obscured' : shot.state.cover ? 'cover' : 'valid'
}

// Shoot or Fight, from the Shoot/Fight tool's payload ({ mode, shooterId, targetId,
// point, weaponId }).
export const computeAttack = ({ game, layout, payload }) =>
  payload?.mode === 'fight' ? computeFight({ game, layout, payload }) : computeShot({ game, layout, payload })
