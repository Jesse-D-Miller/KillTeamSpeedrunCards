import { tokenRadiusIn } from '../../../shared/game.js'
import { distance } from '../../../shared/geometry.js'
import { analyseTarget, statusOf } from '../../../shared/targeting.js'
import { getKillteamById } from '../../data/ktData.js'
import { toOpTypeId } from '../killOpCounts.js'
import { maxWoundsFor } from '../roster.js'
import { keywordsOf } from '../weaponRules.js'

// The facts shooting rules check, for one shooter -> target pair (see index.js).

export const CONTROL_RANGE = 1
// Points around the target's base its owner can pick to draw targeting lines from
// (Hidden Engagement), plus its centre.
const PERSPECTIVE_POINTS = 16

// Edge-to-edge distance between two operatives, or an operative and a marker.
export const gapBetween = (token, other) =>
  Math.max(0, distance(token, other) - tokenRadiusIn(token) - (other.radius ?? tokenRadiusIn(other)))

// One operative on the board, with its datacard and unit state.
export const operativeOf = (game, token) => {
  const player = game.players?.[token?.seat] ?? null
  const killteam = getKillteamById(player?.killteamId)
  const opType = (killteam?.opTypes ?? []).find((candidate) => candidate.opTypeId === toOpTypeId(token?.unitKey)) ?? null
  const unit = player?.unitState?.[token?.unitKey] ?? {}
  const maxWounds = (opType ? maxWoundsFor(opType) : token?.maxWounds) || null
  const wounds = unit.wounds ?? maxWounds
  return {
    token,
    seat: token?.seat ?? null,
    player,
    killteamId: player?.killteamId ?? '',
    opType,
    name: opType?.opTypeName ?? token?.label ?? '',
    keywords: keywordsOf(opType),
    abilities: opType?.abilities ?? [],
    save: Number.parseInt(opType?.SAVE, 10) || null,
    maxWounds,
    wounds,
    injured: Boolean(maxWounds) && wounds < maxWounds / 2,
    order: unit.order ?? 'conceal',
    activation: unit.activation ?? 'ready',
    vantage: Number(unit.vantage) || 0,
    dead: Boolean(unit.dead),
    counteractedTp: unit.counteractedTp ?? null,
    movedTp: unit.movedTp ?? null,
  }
}

// Names compared without case or curly apostrophes ("Krumpin' Time").
const nameKey = (name) => String(name ?? '').trim().toLowerCase().replace(/[’‘]/g, "'")
export const abilityNamed = (operative, name) =>
  operative.abilities.find((ability) => nameKey(ability.abilityName) === nameKey(name)) ?? null

// game: the shared game state; layout: the killzone's walls and areas.
// toggles: { A: { [modifierId]: boolean }, B: … } for this shot.
// glance: skip facts only the full shot card needs (for the at-a-glance badges).
export const buildShotContext = ({ game, layout, shooterToken, targetToken, weapon, point, toggles, samples, glance = false }) => {
  const tp = game.battle?.tp ?? 1
  const shooter = operativeOf(game, shooterToken)
  const target = operativeOf(game, targetToken)
  const maxWoundsOf = (token) => operativeOf(game, token).maxWounds
  const markers = game.markers ?? []
  const tokens = game.tokens ?? []
  const counteracting = shooter.activation === 'expended' && shooter.counteractedTp === tp
  const inBattle = game.phase === 'battle'
  // A token keeps its latest move until another operative moves or the turning point
  // ends, so a moved active (or counteracting) operative moved during this activation.
  const movedThisActivation =
    inBattle && Boolean(shooterToken.lastMove) && (shooter.activation === 'active' || counteracting)
  const seatOf = (side) => (side === 'attacker' ? shooter.seat : target.seat)
  const playerOf = (side) => game.players?.[seatOf(side)] ?? null

  const analyse = (options = {}) =>
    analyseTarget({
      tokens,
      players: game.players,
      walls: layout.walls,
      areas: layout.areas,
      shooter: shooterToken,
      target: targetToken,
      point,
      maxWoundsOf,
      samples,
      markers,
      ...options,
    })

  let inCoverFromTarget = null
  const ctx = {
    game,
    layout,
    tp,
    inBattle,
    glance,
    shooter,
    target,
    shooterToken,
    targetToken,
    weapon,
    point,
    markers,
    tokens,
    toggles: toggles ?? { A: {}, B: {} },
    gap: gapBetween(shooterToken, targetToken),
    counteracting,
    movedThisActivation,
    // The move actions it used this activation ('free' for a drag with none picked).
    moveKinds: movedThisActivation ? shooterToken.lastMove.kinds ?? ['free'] : [],
    // The same for either operative in a fight (it moved this activation or counteraction).
    moveKindsOf: (token, operative) =>
      inBattle && token?.lastMove && (operative.activation === 'active' || (operative.activation === 'expended' && operative.counteractedTp === tp))
        ? token.lastMove.kinds ?? ['free']
        : [],
    movedThisTp: inBattle && (shooter.movedTp === tp || Boolean(shooterToken.lastMove)),
    targetExpended: target.activation === 'expended',
    // Set by computeShot as it goes: the first targeting check, then the attacker's
    // effects and the weapon rules they give (before the defender's rules are read).
    analysis: null,
    attackEffects: null,
    attackRules: weapon?.rules ?? null,
    analyse,
    // Obscured with no way out of it (so crit rules can't matter).
    certainlyObscured: () =>
      Boolean(
        ctx.analysis?.obscured &&
          !ctx.analysis.chooseOne &&
          !ctx.attackEffects?.cannotBeObscured &&
          !ctx.attackEffects?.noObscured,
      ),
    seatOf,
    stratActive: (side, ployId) => (playerOf(side)?.ploysByTp?.[tp] ?? []).includes(ployId),
    hasEquipment: (side, eqId) => (playerOf(side)?.equipment ?? []).includes(eqId),
    usesThisTp: (side, id) => playerOf(side)?.usesByTp?.[tp]?.[id] ?? 0,
    // Living operatives of a seat, other than `except`.
    operatives: (seat, except = null) =>
      tokens.filter(
        (token) => token.seat === seat && token.unitKey && token.id !== except?.id && !statusOf(game.players, token).dead,
      ),
    // Whether the shooter is in cover from the target's perspective, with the target's
    // owner choosing where on its base the targeting lines start: it must be in cover
    // from every point they could pick.
    shooterInCoverFromTarget: () => {
      if (glance) return false
      if (inCoverFromTarget !== null) return inCoverFromTarget
      const r = tokenRadiusIn(targetToken) * 0.999
      const points = [
        { x: targetToken.x, y: targetToken.y },
        ...Array.from({ length: PERSPECTIVE_POINTS }, (_, index) => {
          const angle = (2 * Math.PI * index) / PERSPECTIVE_POINTS
          return { x: targetToken.x + r * Math.cos(angle), y: targetToken.y + r * Math.sin(angle) }
        }),
      ]
      inCoverFromTarget = points.every(
        (from) =>
          analyseTarget({
            tokens,
            players: game.players,
            walls: layout.walls,
            areas: layout.areas,
            shooter: targetToken,
            target: shooterToken,
            point: from,
            maxWoundsOf,
            markers,
          }).cover,
      )
      return inCoverFromTarget
    },
  }
  return ctx
}
