import { meleeWeaponsFor } from '../weaponRules.js'
import { CONTROL_RANGE, buildShotContext, gapBetween } from './context.js'
import { applyRuleChanges, listModifiers, mergeEffects, mod, resolveModifiers } from './effects.js'
import * as generic from './generic.js'
import { attackProfile } from './profile.js'
import * as hernkynYaegirs from './teams/hernkynYaegirs.js'
import * as kommandos from './teams/kommandos.js'
import * as vespidStingwings from './teams/vespidStingwings.js'
import { COMMAND_REROLL } from './universal.js'

// Fights (core rules, Fight action):
// - The attacker fights an enemy within its control range; that enemy retaliates with a
//   melee weapon its player picks, and both roll their attack dice at once.
// - Assist: Hit improves by 1 for each other friendly operative within control range of
//   the enemy in the fight that isn't within control range of another enemy.
// - Injured: Hit worse by 1. No cover or obscured.
// - Resolve: alternate one success at a time, starting with the attacker: strike
//   (Normal or Crit Dmg) or block one of the opponent's unresolved successes (a normal
//   blocks a normal, a crit blocks either). Brutal: only crits can block it.

const CURATED = { 'VOT-HKY': hernkynYaegirs, 'TAU-VESP': vespidStingwings, 'ORK-KOM': kommandos }
const teamRules = (killteamId) => CURATED[killteamId] ?? generic

const SIDES = ['attacker', 'defender']
const opposite = (side) => (side === 'attacker' ? 'defender' : 'attacker')

// Friendly operatives assisting `side`: within control range of the enemy in the
// fight, and not within control range of another enemy.
const assistsFor = (ctx, side) => {
  const self = side === 'attacker' ? ctx.shooterToken : ctx.targetToken
  const enemy = side === 'attacker' ? ctx.targetToken : ctx.shooterToken
  return ctx
    .operatives(self.seat, self)
    .filter(
      (friend) =>
        gapBetween(friend, enemy) <= CONTROL_RANGE &&
        !ctx.operatives(enemy.seat, enemy).some((other) => gapBetween(other, friend) <= CONTROL_RANGE),
    )
}

const coreFight = (ctx, side) => {
  const fighter = ctx.fighter(side)
  if (!fighter.weapon) return []
  const mods = []
  if (fighter.operative.injured) {
    mods.push(mod({ id: 'core-injured', owner: side, source: 'core', name: 'Injured', text: 'Below half wounds: Hit worse by 1', effect: { hit: 1 }, tone: 'bad' }))
  }
  const assists = ctx.assists[side].length
  if (assists) {
    mods.push(
      mod({
        id: 'core-assist',
        owner: side,
        source: 'core',
        name: 'Assist',
        text: `${assists} friendly operative${assists === 1 ? '' : 's'} in the enemy’s control range: Hit +${assists}`,
        effect: { hit: -assists },
        tone: 'good',
      }),
    )
  }
  if (ctx.inBattle) {
    mods.push(
      mod({ id: COMMAND_REROLL, owner: side, source: 'firefight', name: 'Command Re-roll', mode: 'toggle', cost: 1, text: 'Re-roll one attack die', effect: { reroll: 'attack' }, tone: 'good' }),
    )
  }
  return mods
}

// payload: { mode: 'fight', shooterId (the attacker), targetId, weaponId }. The
// defender's retaliation weapon is their pick on their iPad (battle.shots[key].weapons).
export const computeFight = ({ game, layout, payload }) => {
  const tokens = game.tokens ?? []
  const shooterToken = tokens.find((token) => token.id === payload?.shooterId)
  const targetToken = tokens.find((token) => token.id === payload?.targetId)
  if (!shooterToken || !targetToken) return null
  const key = `fight|${payload.shooterId}|${payload.targetId}`
  const saved = game.battle?.shots?.[key]
  const weapon = meleeWeaponsFor(game, shooterToken).find((candidate) => candidate.id === payload.weaponId) ?? null
  const defenderWeapons = meleeWeaponsFor(game, targetToken)
  const defenderWeapon =
    defenderWeapons.find((candidate) => candidate.id === saved?.weapons?.[targetToken.seat]) ?? defenderWeapons[0] ?? null
  const ctx = buildShotContext({
    game,
    layout,
    shooterToken,
    targetToken,
    weapon,
    point: { x: shooterToken.x, y: shooterToken.y },
    toggles: saved?.toggles,
    samples: 3,
  })
  ctx.mode = 'fight'
  ctx.defenderWeapon = defenderWeapon
  ctx.assists = { attacker: assistsFor(ctx, 'attacker'), defender: assistsFor(ctx, 'defender') }
  // One side of the fight: the attacker is fighting, the defender retaliating.
  ctx.fighter = (side) =>
    side === 'attacker'
      ? { operative: ctx.shooter, token: shooterToken, weapon, enemy: ctx.target, enemyToken: targetToken, retaliating: false }
      : { operative: ctx.target, token: targetToken, weapon: defenderWeapon, enemy: ctx.shooter, enemyToken: shooterToken, retaliating: true }

  const mods = Object.fromEntries(
    SIDES.map((side) => {
      const operative = side === 'attacker' ? ctx.shooter : ctx.target
      const team = teamRules(operative.killteamId)
      return [side, resolveModifiers([...coreFight(ctx, side), ...(team.fight?.(ctx, side) ?? [])], ctx)]
    }),
  )
  const effects = Object.fromEntries(SIDES.map((side) => [side, mergeEffects(mods[side].filter((modifier) => modifier.on))]))
  // Some rules change the opponent's dice (e.g. Hardened Exoskeleton: less damage on it).
  SIDES.forEach((side) => {
    const reduction = effects[opposite(side)].opponentDmgReduction
    if (reduction && !effects[side].dmgReduction) {
      effects[side].dmgReduction = reduction
      const source = effects[opposite(side)].trace.find((entry) => entry.key === 'opponentDmgReduction')
      effects[side].trace.push({ key: 'dmgReduction', value: reduction, name: source?.name ?? 'Enemy rule' })
    }
  })
  const profileOf = (side) => {
    const own = ctx.fighter(side).weapon
    if (!own) return null
    const rules = applyRuleChanges(own.rules, effects[side])
    return { weapon: own, rules, ...attackProfile({ weapon: own, base: own.rules, rules, effects: effects[side] }) }
  }

  const blocks = ctx.gap > CONTROL_RANGE ? [{ code: 'control-range', text: 'Not within control range (1")' }] : []
  return {
    mode: 'fight',
    key,
    weapon,
    shooter: ctx.shooter,
    target: ctx.target,
    valid: blocks.length === 0,
    blocks,
    assists: { attacker: ctx.assists.attacker.map((token) => token.id), defender: ctx.assists.defender.map((token) => token.id) },
    attack: profileOf('attacker'),
    retaliation: profileOf('defender'),
    defenderWeapon,
    defenderWeapons,
    modifiers: { attack: listModifiers(mods.attacker, ctx, saved), defence: listModifiers(mods.defender, ctx, saved) },
  }
}
