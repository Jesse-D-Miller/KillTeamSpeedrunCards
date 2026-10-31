import { distance } from './geometry.js'

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
