import { tokenRadiusIn } from './game.js'
import { distance, pointInPolygon, segmentIntersection } from './geometry.js'

// Targeting checks for the Sightline tool, following the Kill Team core rules
// (see docs/kill-team-rules.md):
// - Targeting lines run from one point of the shooter's base to every facing part
//   of the target's base; anything at least one line crosses is intervening.
// - Cover: intervening terrain within 1" of the target (its control range), but
//   never while the operatives are within 2" of each other. 1 automatic save.
// - Obscured: intervening Heavy terrain more than 1" from both operatives. The
//   attacker discards one success and crits become normal successes.
// - A target can't be in cover from and obscured by the same terrain feature: the
//   defender picks one.
// - Not a valid target: Conceal order and in cover, or a friendly operative within
//   its control range.
// - Vantage (unitState.vantage, 2 or 4 inches up): Accurate 1/2 against lower Engage
//   targets; Conceal targets 2"+ lower can't use Light terrain for cover (but keep a
//   better cover save); Heavy terrain of the feature either operative stands on
//   doesn't obscure.
// Visibility (the shooter's head to any part of the target model, in 3D) can't be
// checked top-down. As a table stand-in, Heavy terrain is treated as tall and solid:
// a target that every targeting line reaches only through Heavy terrain (wholly
// intervening) counts as not visible, so not a valid target. Partly behind Heavy
// terrain it's obscured, per the rules.

const CONTROL_RANGE = 1
// A Smoke Grenade's smoke reaches 1" horizontally from the marker.
const SMOKE_SPREAD = 1
const NO_COVER_WITHIN = 2
const ARC_SAMPLES = 13

// Terrain types in the killzone data: Volkus doors are Accessible and Heavy.
const TERRAIN_KIND = { heavy: 'heavy', door: 'heavy', light: 'light' }

export const statusOf = (players, token) => {
  const unit = (token?.seat && token.unitKey && players?.[token.seat]?.unitState?.[token.unitKey]) || {}
  return {
    order: unit.order ?? 'conceal',
    dead: Boolean(unit.dead),
    wounds: unit.wounds,
    vantage: Number(unit.vantage) || 0,
  }
}

// The point on the shooter's base edge closest to the target.
export const defaultShooterPoint = (shooter, target) => {
  const d = distance(shooter, target)
  if (!d) return { x: shooter.x, y: shooter.y }
  const r = tokenRadiusIn(shooter)
  return { x: shooter.x + ((target.x - shooter.x) / d) * r, y: shooter.y + ((target.y - shooter.y) / d) * r }
}

// Keep a point inside a token's base.
export const clampToBase = (token, point) => {
  const r = tokenRadiusIn(token)
  const d = distance(token, point)
  if (d <= r) return point
  return { x: token.x + ((point.x - token.x) / d) * r, y: token.y + ((point.y - token.y) / d) * r }
}

// The facing part of a circle seen from `point`: samples along the near arc between
// the two tangent points (both included).
export const facingArc = (point, centre, r, samples = ARC_SAMPLES) => {
  const d = distance(point, centre)
  if (d <= r) return [{ x: centre.x, y: centre.y }]
  const towards = Math.atan2(point.y - centre.y, point.x - centre.x)
  const half = Math.acos(r / d)
  return Array.from({ length: samples }, (_, index) => {
    const angle = towards - half + (2 * half * index) / (samples - 1)
    return { x: centre.x + r * Math.cos(angle), y: centre.y + r * Math.sin(angle) }
  })
}

const edgeDistance = (a, b) => Math.max(0, distance(a, b) - tokenRadiusIn(a) - tokenRadiusIn(b))

const liveOperatives = (tokens, players, seat) =>
  tokens.filter((token) => token.seat === seat && token.unitKey && !statusOf(players, token).dead)

// Everything the Sightline tool shows for one shooter -> target pair.
//   point: where on the shooter's base the targeting lines start.
//   maxWoundsOf(token): the operative's starting wounds (for injured), or null.
//   samples: how many targeting lines to draw across the target's facing side.
//   weapon: the chosen weapon's parsed rules (src/rules/weaponRules.js), if any.
//   markers: board markers (Smoke Grenade markers make smoke).
export const analyseTarget = ({
  tokens,
  players,
  walls,
  areas = [],
  shooter,
  target,
  point,
  maxWoundsOf = () => null,
  samples = ARC_SAMPLES,
  weapon = null,
  markers = [],
}) => {
  const shooterStatus = statusOf(players, shooter)
  const targetStatus = statusOf(players, target)
  const targetR = tokenRadiusIn(target)
  const shooterR = tokenRadiusIn(shooter)
  const gap = edgeDistance(shooter, target)
  const tooClose = gap <= NO_COVER_WITHIN
  const height = shooterStatus.vantage - targetStatus.vantage

  // Heavy terrain of the feature an operative on Vantage stands on doesn't obscure.
  const standingOn = (token, status) =>
    status.vantage ? areas.filter((area) => pointInPolygon(token, area.points)).map((area) => area.featureId) : []
  const ignoredForObscuring = new Set([...standingOn(shooter, shooterStatus), ...standingOn(target, targetStatus)])

  const lines = facingArc(point, target, targetR, samples).map((to) => {
    const crossings = walls
      .map((wall) => {
        const hit = segmentIntersection(point, to, wall.start, wall.end)
        if (!hit) return null
        const kind = TERRAIN_KIND[wall.type] ?? 'heavy'
        const fromTarget = Math.max(0, distance(hit, target) - targetR)
        const fromShooter = Math.max(0, distance(hit, shooter) - shooterR)
        return {
          x: hit.x,
          y: hit.y,
          t: hit.t,
          kind,
          featureId: wall.featureId ?? wall.id,
          covers: fromTarget <= CONTROL_RANGE,
          obscures:
            kind === 'heavy' &&
            fromTarget > CONTROL_RANGE &&
            fromShooter > CONTROL_RANGE &&
            !ignoredForObscuring.has(wall.featureId ?? wall.id),
        }
      })
      .filter(Boolean)
      .sort((left, right) => left.t - right.t)
    return { from: point, to, crossings }
  })

  // Every line passes through Heavy terrain (other than the feature an operative on
  // Vantage stands on): treated as not visible.
  const hidden = lines.every((line) =>
    line.crossings.some((crossing) => crossing.kind === 'heavy' && !ignoredForObscuring.has(crossing.featureId)),
  )
  // Where each line turns red for the scan picture: at its first obscuring crossing,
  // or for a hidden target at the Heavy terrain that hides it (1 = never).
  lines.forEach((line) => {
    const blocking = line.crossings.find((crossing) =>
      hidden ? crossing.kind === 'heavy' && !ignoredForObscuring.has(crossing.featureId) : crossing.obscures,
    )
    line.redFrom = blocking ? blocking.t : 1
  })
  const crossings = lines.flatMap((line) => line.crossings)
  const coverCrossings = tooClose ? [] : crossings.filter((crossing) => crossing.covers)
  const obscureCrossings = crossings.filter((crossing) => crossing.obscures)
  // From Vantage, a Conceal target 2"+ lower can't use Light terrain for cover; Seek
  // weapons ignore terrain for cover, Seek Light ignores Light terrain. Either way
  // only target selection changes: the cover save stays.
  const vantageLightRule = shooterStatus.vantage > 0 && height >= 2 && targetStatus.order === 'conceal'
  const coverForTargeting = weapon?.seek
    ? []
    : coverCrossings.filter(
        (crossing) => !((vantageLightRule || weapon?.seekLight) && crossing.kind === 'light'),
      )
  const cover = coverCrossings.length > 0
  // Smoke: an operative wholly within a Smoke Grenade's 1" area is obscured to
  // operatives more than 2" away, and vice versa.
  const smoke = markers
    .filter((marker) => marker.catalogId === 'smoke-grenade' && !marker.attachedTo)
    .map((marker) => ({ x: marker.x, y: marker.y, r: marker.radius + SMOKE_SPREAD }))
  const inSmoke = (token) => smoke.some((area) => distance(token, area) + tokenRadiusIn(token) <= area.r)
  const targetInSmoke = inSmoke(target)
  const smokeObscured = gap > NO_COVER_WITHIN && (targetInSmoke || inSmoke(shooter))
  const terrainObscured = obscureCrossings.length > 0
  const obscured = terrainObscured || smokeObscured
  const coverFeatures = new Set(coverCrossings.map((crossing) => crossing.featureId))
  const obscureFeatures = new Set(obscureCrossings.map((crossing) => crossing.featureId))
  const distinctFeatures = [...coverFeatures].some((a) => [...obscureFeatures].some((b) => a !== b))
  const chooseOne = cover && terrainObscured && !smokeObscured && !distinctFeatures

  const reasons = []
  if (hidden) reasons.push('Wholly behind Heavy terrain (not visible)')
  if (liveOperatives(tokens, players, shooter.seat).some((friend) => edgeDistance(friend, target) <= CONTROL_RANGE)) {
    reasons.push('A friendly operative is within its control range')
  }
  if (targetStatus.order === 'conceal' && coverForTargeting.length) reasons.push('Conceal order in cover')
  if (weapon?.range && gap > weapon.range) reasons.push(`Out of range (Rng ${weapon.range}")`)

  const shooterWarnings = []
  if (shooterStatus.order === 'conceal' && !weapon?.silent) shooterWarnings.push('CONCEAL · CAN’T SHOOT (SILENT ONLY)')
  if (liveOperatives(tokens, players, target.seat).some((enemy) => edgeDistance(enemy, shooter) <= CONTROL_RANGE)) {
    shooterWarnings.push('ENGAGED · CAN’T SHOOT')
  }

  const targetChips = []
  // A target that can't be seen can't be shot, so its cover and obscured don't matter.
  if (hidden) {
    // nothing else to add
  } else if (chooseOne) targetChips.push('COVER OR OBSCURED · DEFENDER CHOOSES')
  else {
    if (cover && weapon?.saturate) targetChips.push('COVER · NO SAVE (SATURATE)')
    else if (cover && vantageLightRule && !coverForTargeting.length) {
      targetChips.push('VANTAGE · COVER SAVE AS CRIT, OR +1 COVER SAVE')
    } else if (cover) targetChips.push('COVER · 1 AUTO SAVE')
    if (obscured) {
      targetChips.push(
        terrainObscured ? 'OBSCURED · −1 SUCCESS · NO CRITS' : 'SMOKE · OBSCURED · −1 SUCCESS · NO CRITS',
      )
    }
    if (targetInSmoke && gap > NO_COVER_WITHIN && (weapon?.piercing === 2 || weapon?.piercingCrits === 2)) {
      targetChips.push(weapon.piercing === 2 ? 'SMOKE · PIERCING 2 → 1' : 'SMOKE · PIERCING CRITS 2 → 1')
    }
  }
  if (!hidden && tooClose && crossings.some((crossing) => crossing.covers)) targetChips.push('WITHIN 2" · NO COVER')

  const shooterChips = [...shooterWarnings]
  const maxWounds = maxWoundsOf(shooter)
  const wounds = shooterStatus.wounds ?? maxWounds
  if (maxWounds && wounds < maxWounds / 2) shooterChips.push('INJURED · HIT WORSE BY 1')
  if (shooterStatus.order === 'conceal' && weapon?.silent) shooterChips.push('SILENT · CAN SHOOT ON CONCEAL')
  // Accurate from Vantage and from the weapon: two Accurate rules count as Accurate 2.
  const vantageAccurate =
    shooterStatus.vantage > 0 && targetStatus.order === 'engage' && height >= 2 ? (height >= 4 ? 2 : 1) : 0
  const weaponAccurate = weapon?.accurate ?? 0
  if (vantageAccurate || weaponAccurate) {
    const total = vantageAccurate && weaponAccurate ? 2 : Math.max(vantageAccurate, weaponAccurate)
    shooterChips.push(vantageAccurate ? `VANTAGE · ACCURATE ${total}` : `ACCURATE ${total}`)
  }

  return {
    lines,
    cover,
    obscured,
    chooseOne,
    hidden,
    tooClose,
    distance: gap,
    valid: reasons.length === 0,
    reasons,
    shooterWarnings,
    targetChips,
    shooterChips,
  }
}

// One-word status for every enemy at a glance: 'invalid' | 'obscured' | 'cover' | 'valid'.
export const glanceStatus = (analysis) =>
  !analysis.valid ? 'invalid' : analysis.obscured ? 'obscured' : analysis.cover ? 'cover' : 'valid'

// Operatives caught around the primary target by the weapon's area rules:
// - Blast x: every other operative (friendlies too) visible to and within x of it;
// - Torrent x: other valid targets within x of it (not engaged with friendlies);
// - x" Devastating: every other operative visible to and within x of it (on a crit);
// - Stun grenade: every other operative within 1" of it.
// Visibility from the primary target uses the same "wholly behind Heavy terrain" test.
//   -> [{ token, kind, friendly }]
export const splashTargets = ({ tokens, players, walls, areas = [], markers = [], shooter, target, point, weapon, maxWoundsOf }) => {
  if (!weapon) return []
  const others = tokens.filter(
    (token) => token.unitKey && token.seat && token.id !== target.id && !statusOf(players, token).dead,
  )
  const within = (token, inches) => edgeDistance(token, target) <= inches
  const visibleFromTarget = (token) =>
    !analyseTarget({ tokens, players, walls, areas, shooter: target, target: token, point: defaultShooterPoint(target, token) })
      .hidden
  const caught = []
  const add = (token, kind) => caught.push({ token, kind, friendly: token.seat === shooter.seat })
  if (weapon.blast) others.filter((token) => within(token, weapon.blast) && visibleFromTarget(token)).forEach((token) => add(token, 'blast'))
  if (weapon.torrent) {
    others
      .filter((token) => token.seat === target.seat && within(token, weapon.torrent))
      .filter(
        (token) =>
          analyseTarget({ tokens, players, walls, areas, markers, shooter, target: token, point, weapon, maxWoundsOf }).valid,
      )
      .forEach((token) => add(token, 'torrent'))
  }
  if (weapon.devastating?.distance) {
    others
      .filter((token) => within(token, weapon.devastating.distance) && visibleFromTarget(token))
      .forEach((token) => add(token, 'devastating'))
  }
  if (weapon.stunArea) others.filter((token) => within(token, weapon.stunArea)).forEach((token) => add(token, 'stun'))
  return caught
}
