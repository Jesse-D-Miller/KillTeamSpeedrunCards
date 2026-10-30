import { useMemo } from 'react'
import { clampToBase, splashTargets, statusOf } from '../../shared/targeting.js'
import { tokenRadiusIn } from '../../shared/game.js'
import { computeFight } from '../rules/shooting/fight.js'
import { computeShot, glanceShot } from '../rules/shooting/index.js'
import { rangedWeaponsFor } from '../rules/weaponRules.js'
import { BOARD, toSvgY } from './boardData.js'

// The Sightline and Shoot/Fight tools' pictures (rules: shared/targeting.js and
// src/rules/shooting):
// - a status badge on every enemy of the shooter, at a glance, with every rule applied;
// - for the chosen target, a scan from the shooter's point over the facing side of
//   its base: green where it's clear, red behind Heavy terrain that obscures it;
// - Sightline: chips beside the target and shooter say what applies;
// - Shoot: the weapon's range and area rings, and who an area rule catches. The numbers
//   go to the players' side bars (projector) and stats drawers (iPads), not the board;
// - Fight: the attacker's control range, a line to the enemy, and who's assisting.

const BADGE = { valid: '✓', cover: 'C', obscured: 'O', invalid: '✕' }
const CHIP_HEIGHT = 0.4
const CHIP_GAP = 0.08
const CHIP_FONT = 0.24
const CHIP_CHAR = 0.145

const SCAN_SAMPLES = 41

const lerp = (from, to, t) => ({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t })
const pointsAttr = (points) => points.map((point) => `${point.x},${toSvgY(point.y)}`).join(' ')

// The scan: a translucent green cone over the clear part of every targeting line,
// and red cones over the shadow behind Heavy terrain that obscures (or hides) it.
function Scan({ lines }) {
  const from = lines[0].from
  const clear = [from, ...lines.map((line) => lerp(line.from, line.to, line.redFrom))]
  const runs = []
  lines.forEach((line, index) => {
    if (line.redFrom >= 1) return
    const run = runs.at(-1)
    if (run && run.end === index - 1) run.end = index
    else runs.push({ start: index, end: index })
  })
  return (
    <>
      <polygon className="target-scan is-clear" points={pointsAttr(clear)} />
      {runs.map(({ start, end }) => {
        const slice = lines.slice(start, end + 1)
        const shadow = [
          ...slice.map((line) => lerp(line.from, line.to, line.redFrom)),
          ...slice.map((line) => line.to).reverse(),
        ]
        return <polygon key={start} className="target-scan is-blocked" points={pointsAttr(shadow)} />
      })}
    </>
  )
}

// Chips stacked beside a token, flipped to its left near the right edge of the mat.
function Chips({ token, chips }) {
  if (!chips.length) return null
  const r = tokenRadiusIn(token)
  const widest = Math.max(...chips.map(({ text }) => text.length * CHIP_CHAR + 0.3))
  const right = token.x + r + 0.25
  const x = right + widest > BOARD.width - 0.1 ? token.x - r - 0.25 - widest : right
  const top = toSvgY(token.y) - r
  return (
    <g className="target-chips" data-chips-for={token.id}>
      {chips.map(({ text, tone }, index) => {
        const width = text.length * CHIP_CHAR + 0.3
        const y = top + index * (CHIP_HEIGHT + CHIP_GAP)
        return (
          <g key={text} className={`target-chip is-${tone}`}>
            <rect x={x} y={y} width={width} height={CHIP_HEIGHT} rx={CHIP_HEIGHT / 2} />
            <text x={x + width / 2} y={y + CHIP_HEIGHT / 2} textAnchor="middle" dominantBaseline="central" style={{ fontSize: CHIP_FONT }}>
              {text}
            </text>
          </g>
        )
      })}
    </g>
  )
}

const toneOf = (text) =>
  /CAN’T|NOT VALID|FRIENDLY|INJURED/.test(text)
    ? 'bad'
    : /ACCURATE|CAN SHOOT/.test(text)
      ? 'good'
      : /WEAPON|RNG|BLAST|TORRENT|DEVASTATING|HEAVY|PIERCING|LETHAL/.test(text)
        ? 'info'
        : 'warn'

const SPLASH_LABEL = { blast: 'BLAST', torrent: 'TORRENT', stun: 'STUN' }

// The distance of the weapon's area rule around the primary target, if any.
const areaOf = (rules) =>
  rules?.blast ?? rules?.torrent ?? rules?.devastating?.distance ?? rules?.stunArea ?? null

// What the target's chips say without a weapon: why it can't be shot, or its cover
// and obscured status once every rule is applied.
const targetChipsOf = (shot) => {
  if (!shot.valid) return shot.blocks.map((block) => `✕ NOT VALID · ${block.text.toUpperCase()}`)
  const { analysis, state } = shot
  const chips = []
  if (state.choose) chips.push('COVER OR OBSCURED · DEFENDER CHOOSES')
  else {
    if (state.cover) chips.push(analysis.vantageCoverImprove ? 'VANTAGE · COVER SAVE AS CRIT, OR +1 COVER SAVE' : 'COVER · 1 AUTO SAVE')
    if (state.obscured) chips.push(analysis.terrainObscured ? 'OBSCURED · −1 SUCCESS · NO CRITS' : 'SMOKE · OBSCURED · −1 SUCCESS · NO CRITS')
  }
  if (!state.cover && analysis.tooClose && analysis.lines.some((line) => line.crossings.some((crossing) => crossing.covers))) {
    chips.push('WITHIN 2" · NO COVER')
  }
  return chips
}

// And the shooter's: what stops it shooting, injured, and Accurate from Vantage.
const shooterChipsOf = (shot) =>
  shot.modifiers.attack
    .filter((modifier) => modifier.on && modifier.source === 'core')
    .map((modifier) =>
      modifier.mode === 'warning'
        ? `CAN’T SHOOT · ${modifier.text.toUpperCase()}`
        : modifier.id === 'core-injured'
          ? 'INJURED · HIT WORSE BY 1'
          : modifier.id === 'core-vantage-accurate'
            ? `VANTAGE · ACCURATE ${modifier.effect.accurate}`
            : null,
    )
    .filter(Boolean)

// game: the shared game state (tokens, players, markers, battle.shots).
// payload: { shooterId, targetId, point: { dx, dy } | null, weaponId } (point is
// relative to the shooter; without it the lines start at the shooter's edge closest
// to each target).
// payload.tool 'target' (Sightline) or 'attack' (Shoot/Fight, with mode and weaponId).
function TargetingOverlay({ game, layout, payload }) {
  if (payload.tool === 'attack' && payload.mode === 'fight') return <FightOverlay game={game} layout={layout} payload={payload} />
  return <ShootOverlay game={game} layout={layout} payload={payload} />
}

const FIGHT_TAG = 'ASSIST +1'

// A fight: the attacker's 1" control range, a line to the enemy, and assist tags.
function FightOverlay({ game, layout, payload }) {
  const fight = useMemo(() => computeFight({ game, layout, payload }), [game, layout, payload])
  const tokens = game.tokens ?? []
  const attacker = tokens.find((token) => token.id === payload.shooterId)
  if (!attacker || statusOf(game.players, attacker).dead) return null
  const target = fight ? tokens.find((token) => token.id === payload.targetId) : null
  const assisting = fight ? [...fight.assists.attacker, ...fight.assists.defender] : []
  return (
    <g className="targeting is-fight" data-shooter={attacker.id} data-target={target?.id}>
      <circle className="fight-range-ring" cx={attacker.x} cy={toSvgY(attacker.y)} r={tokenRadiusIn(attacker) + 1} />
      {target ? (
        <>
          <line
            className={`fight-line${fight.valid ? '' : ' is-invalid'}`}
            x1={attacker.x}
            y1={toSvgY(attacker.y)}
            x2={target.x}
            y2={toSvgY(target.y)}
            data-fight-line
          />
          <circle className="fight-target-ring" cx={target.x} cy={toSvgY(target.y)} r={tokenRadiusIn(target) + 0.12} />
          {fight.valid ? null : <Chips token={target} chips={[{ text: '✕ NOT WITHIN CONTROL RANGE', tone: 'bad' }]} />}
        </>
      ) : null}
      {assisting.map((id) => {
        const token = tokens.find((candidate) => candidate.id === id)
        if (!token) return null
        const width = FIGHT_TAG.length * CHIP_CHAR + 0.3
        const y = toSvgY(token.y) + tokenRadiusIn(token) + 0.05
        return (
          <g key={id} className="target-splash is-assist" data-assist-for={id}>
            <rect x={token.x - width / 2} y={y} width={width} height={CHIP_HEIGHT} rx={CHIP_HEIGHT / 2} />
            <text x={token.x} y={y + CHIP_HEIGHT / 2} textAnchor="middle" dominantBaseline="central" style={{ fontSize: CHIP_FONT }}>
              {FIGHT_TAG}
            </text>
          </g>
        )
      })}
    </g>
  )
}

function ShootOverlay({ game, layout, payload }) {
  // Only the Shoot tool has a weapon; the Sightline is the line-of-sight check alone.
  const shooting = payload.tool === 'attack'
  const view = useMemo(() => {
    const { tokens = [], players, markers = [] } = game
    const shooter = tokens.find((token) => token.id === payload.shooterId)
    if (!shooter || statusOf(players, shooter).dead) return null
    const weapon =
      shooting && payload.weaponId
        ? rangedWeaponsFor(game, shooter).find((candidate) => candidate.id === payload.weaponId) ?? null
        : null
    const enemies = tokens.filter(
      (token) => token.unitKey && token.seat && token.seat !== shooter.seat && !statusOf(players, token).dead,
    )
    const target = enemies.find((token) => token.id === payload.targetId) ?? null
    const shot = target ? computeShot({ game, layout, payload, samples: SCAN_SAMPLES }) : null
    const statusOfShot = (result) =>
      !result.valid ? 'invalid' : result.state.obscured ? 'obscured' : result.state.cover ? 'cover' : 'valid'
    const badges = enemies.map((enemy) => ({
      enemy,
      status: enemy === target ? statusOfShot(shot) : glanceShot({ game, layout, payload: { ...payload, targetId: enemy.id } }),
    }))
    const rules = shot?.rules ?? weapon?.rules ?? null
    const caught =
      shot && rules
        ? splashTargets({
            tokens,
            players,
            walls: layout.walls,
            areas: layout.areas,
            markers,
            shooter,
            target,
            point: shot.point,
            weapon: rules,
            immuneToDevastating: shot.immuneToDevastating,
          })
        : []
    return { shooter, weapon, target, shot, badges, rules, caught }
  }, [game, layout, payload, shooting])
  if (!view) return null
  const { shooter, target, shot, badges, rules, caught } = view

  const friendlyHits = caught.filter((entry) => entry.kind === 'blast' && entry.friendly).length
  const area = target ? areaOf(rules) : null
  const point = shot
    ? shot.point
    : payload.point
      ? clampToBase(shooter, { x: shooter.x + payload.point.dx, y: shooter.y + payload.point.dy })
      : null
  // Shooting, the side bars (projector) and stats drawers (iPads) say it all.
  const showChips = !shooting
  const targetChips =
    shot && showChips
      ? [...targetChipsOf(shot), ...(friendlyHits ? [`BLAST HITS ${friendlyHits} FRIENDLY`] : [])].map((text) => ({
          text,
          tone: toneOf(text),
        }))
      : []
  const shooterChips = showChips && shot ? shooterChipsOf(shot).map((text) => ({ text, tone: toneOf(text) })) : []

  return (
    <g className={`targeting${shooting ? ' is-shoot' : ''}`} data-shooter={shooter.id} data-target={target?.id}>
      {rules?.range ? (
        <circle
          className="target-range-ring"
          cx={shooter.x}
          cy={toSvgY(shooter.y)}
          r={tokenRadiusIn(shooter) + rules.range}
          data-range-ring={rules.range}
        />
      ) : null}
      {shot ? <Scan lines={shot.analysis.lines} /> : null}
      {area ? (
        <circle
          className="target-area-ring"
          cx={target.x}
          cy={toSvgY(target.y)}
          r={tokenRadiusIn(target) + area}
          data-area-ring={area}
        />
      ) : null}
      {caught.map(({ token, kind, friendly }) => {
        const label = kind === 'devastating' ? `DEV ${rules.devastating.damage}` : SPLASH_LABEL[kind]
        const r = tokenRadiusIn(token)
        const width = label.length * CHIP_CHAR + 0.3
        const y = toSvgY(token.y) + r + 0.05
        return (
          <g
            key={`${kind}-${token.id}`}
            className={`target-splash${friendly ? ' is-friendly' : ''}`}
            data-splash-for={token.id}
            data-splash={kind}
          >
            <rect x={token.x - width / 2} y={y} width={width} height={CHIP_HEIGHT} rx={CHIP_HEIGHT / 2} />
            <text x={token.x} y={y + CHIP_HEIGHT / 2} textAnchor="middle" dominantBaseline="central" style={{ fontSize: CHIP_FONT }}>
              {label}
            </text>
          </g>
        )
      })}
      {badges.map(({ enemy, status }) => {
        const r = tokenRadiusIn(enemy)
        return (
          <g key={enemy.id} className={`target-badge is-${status}`} data-badge-for={enemy.id} data-status={status}>
            <circle cx={enemy.x - r * 0.75} cy={toSvgY(enemy.y) - r * 0.75} r={0.24} />
            <text x={enemy.x - r * 0.75} y={toSvgY(enemy.y) - r * 0.75} textAnchor="middle" dominantBaseline="central">
              {BADGE[status]}
            </text>
          </g>
        )
      })}
      {point ? (
        <g className="target-point">
          <circle cx={point.x} cy={toSvgY(point.y)} r={0.2} className="target-point-ring" />
          <circle cx={point.x} cy={toSvgY(point.y)} r={0.1} />
        </g>
      ) : (
        <circle className="target-shooter-ring" cx={shooter.x} cy={toSvgY(shooter.y)} r={tokenRadiusIn(shooter) + 0.15} />
      )}
      {target ? <Chips token={target} chips={targetChips} /> : null}
      <Chips token={shooter} chips={shooterChips} />
    </g>
  )
}

export default TargetingOverlay
