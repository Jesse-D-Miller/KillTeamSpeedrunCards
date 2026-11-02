import { distance, segmentIntersection } from './geometry.js'
import { otherSeat, tokenRadiusIn } from './game.js'

// The move actions picked from an operative's Move ring (core rules, Kill Team 2024):
//   Reposition: up to its Move stat.            Dash: up to 3".
//   Charge: Move + 2", ending in an enemy's control range.
//   Fall Back (2AP): up to its Move stat, starting in an enemy's control range and not
//   ending in one.
// Adjust nudges a finished move (see token/adjust). With no action picked a drag is
// unrestricted. Injured operatives have 2" less Move (Dash isn't based on Move).

export const MOVE_KINDS = {
  reposition: { label: 'Move' },
  dash: { label: 'Dash' },
  charge: { label: 'Charge' },
  fallBack: { label: 'Fall Back' },
}

export const isMoveKind = (kind) => Object.hasOwn(MOVE_KINDS, kind)

export const CONTROL_RANGE_IN = 1
const DASH_IN = 3
const CHARGE_BONUS_IN = 2
const INJURED_MOVE_PENALTY_IN = 2

// '6"' -> 6.
export const moveStat = (text) => {
  const parsed = Number.parseFloat(String(text ?? ''))
  return Number.isFinite(parsed) ? parsed : 0
}

// How far (whole inches) a move of this kind can go; Infinity for a free drag.
export const moveLimit = (kind, move, injured = false) => {
  const base = Math.max(0, move - (injured ? INJURED_MOVE_PENALTY_IN : 0))
  if (kind === 'reposition' || kind === 'fallBack') return Math.floor(base)
  if (kind === 'charge') return Math.floor(base + CHARGE_BONUS_IN)
  if (kind === 'dash') return DASH_IN
  return Infinity
}

// A path pulled past its limit: its first `keep` points (the route already moved)
// plus `limit` more 1" steps.
export const capPath = (path, keep, limit) => (Number.isFinite(limit) ? path.slice(0, keep + limit) : path)

// The new part of a path (after its first `keep - 1` points) bent toward `target`
// without getting any longer: each 1" step keeps its length and the start stays put,
// so the route swings round like a chain (FABRIK).
export const bendToward = (path, target, keep = 1) => {
  const base = Math.max(0, keep - 1)
  const chain = path.slice(base).map((point) => ({ ...point }))
  if (chain.length < 2) return path
  const lengths = chain.slice(1).map((point, index) => distance(chain[index], point))
  const root = { ...chain[0] }
  for (let pass = 0; pass < 6; pass += 1) {
    chain[chain.length - 1] = { x: target.x, y: target.y }
    for (let i = chain.length - 2; i >= 0; i -= 1) {
      const gap = distance(chain[i], chain[i + 1]) || 1
      const t = lengths[i] / gap
      chain[i] = { x: chain[i + 1].x + (chain[i].x - chain[i + 1].x) * t, y: chain[i + 1].y + (chain[i].y - chain[i + 1].y) * t }
    }
    chain[0] = root
    for (let i = 1; i < chain.length; i += 1) {
      const gap = distance(chain[i - 1], chain[i]) || 1
      const t = lengths[i - 1] / gap
      chain[i] = { x: chain[i - 1].x + (chain[i].x - chain[i - 1].x) * t, y: chain[i - 1].y + (chain[i].y - chain[i - 1].y) * t }
    }
  }
  return [...path.slice(0, base), ...chain]
}

// The straight line a long marker (e.g. Razor Wire) lies along, end to end.
export const markerSegment = (marker) => {
  const half = (marker.span ?? 0) / 2
  const angle = ((marker.angle ?? 0) * Math.PI) / 180
  const dx = Math.cos(angle) * half
  const dy = Math.sin(angle) * half
  return { a: { x: marker.x - dx, y: marker.y - dy }, b: { x: marker.x + dx, y: marker.y + dy } }
}

// Obstructing terrain (Razor Wire) on the killzone floor, as segments.
export const obstructions = (markers = []) => markers.filter((marker) => marker.span && !marker.attachedTo).map(markerSegment)

// Obstructing: each time a path crosses one, the move costs an extra 1". Counts the
// crossings in the path's steps from index `from` on (the part not already paid for).
export const obstructedCrossings = (path, segments, from = 0) => {
  let count = 0
  for (let i = Math.max(0, from); i < path.length - 1; i += 1) {
    count += segments.filter(({ a, b }) => segmentIntersection(path[i], path[i + 1], a, b)).length
  }
  return count
}

// Gap between two bases (edge to edge), in inches. radius(token) gives a base radius.
const edgeGap = (a, b, radius) => distance(a, b) - radius(a) - radius(b)

// What breaks the rules at the end of a move, as a short warning (null if nothing).
// Visibility isn't checked (control range also needs the enemy to be visible), so
// these are warnings for the players, not hard limits.
//   mover: { x, y, ... } where it ends; start: where it began; enemies: other side's
//   live operatives; radius: base radius in inches.
export const moveWarning = ({ kind, mover, start, enemies, radius }) => {
  const inRange = (spot) => enemies.some((enemy) => edgeGap({ ...mover, ...spot }, enemy, radius) <= CONTROL_RANGE_IN)
  const ends = inRange(mover)
  if (kind === 'charge' && !ends) return 'A Charge must end within control range (1") of an enemy.'
  if ((kind === 'reposition' || kind === 'dash') && ends) {
    return `A ${MOVE_KINDS[kind].label} can't end within an enemy's control range.`
  }
  if (kind === 'fallBack') {
    if (start && !inRange(start)) return 'Fall Back is for an operative within an enemy’s control range.'
    if (ends) return 'A Fall Back can’t end within an enemy’s control range.'
  }
  return null
}

// An operative within an enemy operative's control range (1" edge to edge) on the board.
// Visibility isn't checked, so a wall between them doesn't help (rules like Resourceful
// that ask for this treat it as a close approximation).
const livingOperatives = (state, seat) =>
  state.tokens.filter((token) => token.seat === seat && token.unitKey && !state.players[seat]?.unitState?.[token.unitKey]?.dead)
export const inEnemyControl = (state, token) =>
  livingOperatives(state, otherSeat(token.seat)).some(
    (enemy) => distance(token, enemy) - tokenRadiusIn(token) - tokenRadiusIn(enemy) <= CONTROL_RANGE_IN,
  )
// Seat's living operatives on a Conceal order with no enemy operative within `inches`
// (edge to edge).
export const concealedAndClear = (state, seat, inches) =>
  livingOperatives(state, seat).filter(
    (token) =>
      (state.players[seat]?.unitState?.[token.unitKey]?.order ?? 'conceal') === 'conceal' &&
      livingOperatives(state, otherSeat(seat)).every((enemy) => distance(token, enemy) - tokenRadiusIn(token) - tokenRadiusIn(enemy) > inches),
  )

// How many of seat's operatives are in the killzone and outside enemy control range.
export const outsideEnemyControl = (state, seat) => livingOperatives(state, seat).filter((token) => !inEnemyControl(state, token)).length

// An operative controls a marker when it's within control range of it and no enemy
// operative is (the full rule compares total APL when both sides are close; the
// players settle that case).
const nearMarker = (token, marker) => distance(token, marker) - tokenRadiusIn(token) - (marker.radius ?? 0) <= CONTROL_RANGE_IN
export const controlsMarker = (state, token, marker) =>
  nearMarker(token, marker) && !livingOperatives(state, otherSeat(token.seat)).some((enemy) => nearMarker(enemy, marker))

// Universal equipment, Comms Device: while an operative controls one of its own kill
// team's Comms Device markers, its SUPPORT rules reach 3" further.
export const COMMS_DEVICE_MARKER = 'comms-device'
export const COMMS_DEVICE_BONUS_IN = 3
export const supportBonus = (state, token) =>
  (state.markers ?? []).some(
    (marker) => marker.catalogId === COMMS_DEVICE_MARKER && marker.seat === token.seat && !marker.attachedTo && controlsMarker(state, token, marker),
  )
    ? COMMS_DEVICE_BONUS_IN
    : 0
