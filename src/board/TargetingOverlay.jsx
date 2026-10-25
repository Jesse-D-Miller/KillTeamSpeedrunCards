import {
  analyseTarget,
  clampToBase,
  defaultShooterPoint,
  glanceStatus,
  splashTargets,
  statusOf,
} from '../../shared/targeting.js'
import { rangedWeaponsFor, weaponLabel, weaponRuleChips } from '../rules/weaponRules.js'
import { tokenRadiusIn } from '../../shared/game.js'
import { BOARD, toSvgY } from './boardData.js'

// The Sightline tool's picture (see shared/targeting.js for the rules):
// - a status badge on every enemy of the shooter, at a glance;
// - for the chosen target, a scan from the shooter's point over the facing side of
//   its base: green where it's clear, red behind Heavy terrain that obscures it;
// - chips beside the target and shooter with the roll effects that apply.

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
  /CAN’T|NOT VALID|FRIENDLY/.test(text)
    ? 'bad'
    : /ACCURATE|CAN SHOOT/.test(text)
      ? 'good'
      : /AWAY|VISIBILITY|WEAPON|RNG|BLAST|TORRENT|DEVASTATING|HEAVY|PIERCING|LETHAL/.test(text)
        ? 'info'
        : 'warn'

const SPLASH_LABEL = { blast: 'BLAST', torrent: 'TORRENT', stun: 'STUN' }

// The distance of the weapon's area rule around the primary target, if any.
const areaOf = (rules) =>
  rules?.blast ?? rules?.torrent ?? rules?.devastating?.distance ?? rules?.stunArea ?? null

// payload: { shooterId, targetId, point: { dx, dy } | null } (point is relative to the
// shooter; without it the lines start at the shooter's edge closest to each target).
// payload.weaponId: one of rangedWeaponsFor(shooter); its rules feed the checks.
function TargetingOverlay({ tokens, players, markers = [], layout, payload, maxWoundsOf }) {
  const shooter = tokens.find((token) => token.id === payload.shooterId)
  if (!shooter || statusOf(players, shooter).dead) return null
  const weapon = payload.weaponId
    ? rangedWeaponsFor({ players }, shooter).find((candidate) => candidate.id === payload.weaponId) ?? null
    : null
  const rules = weapon?.rules ?? null
  const pointFor = (target) =>
    payload.point
      ? clampToBase(shooter, { x: shooter.x + payload.point.dx, y: shooter.y + payload.point.dy })
      : defaultShooterPoint(shooter, target)
  const analyse = (target) =>
    analyseTarget({
      tokens,
      players,
      walls: layout.walls,
      areas: layout.areas,
      shooter,
      target,
      point: pointFor(target),
      maxWoundsOf,
      samples: SCAN_SAMPLES,
      weapon: rules,
      markers,
    })
  const enemies = tokens.filter(
    (token) => token.unitKey && token.seat && token.seat !== shooter.seat && !statusOf(players, token).dead,
  )
  const target = enemies.find((token) => token.id === payload.targetId) ?? null
  const result = target ? analyse(target) : null
  const caught =
    target && rules
      ? splashTargets({
          tokens,
          players,
          walls: layout.walls,
          areas: layout.areas,
          markers,
          shooter,
          target,
          point: pointFor(target),
          weapon: rules,
          maxWoundsOf,
        })
      : []
  const friendlyHits = caught.filter((entry) => entry.kind === 'blast' && entry.friendly).length
  const area = target ? areaOf(rules) : null
  const point = target ? pointFor(target) : payload.point ? pointFor(shooter) : null

  const targetChips = result
    ? [
        ...result.reasons.map((reason) => `✕ NOT VALID · ${reason.toUpperCase()}`),
        ...result.targetChips,
        ...(friendlyHits ? [`BLAST HITS ${friendlyHits} FRIENDLY`] : []),
        `${result.distance.toFixed(1)}" AWAY`,
        'VISIBILITY: CHECK AT THE TABLE',
      ].map((text) => ({ text, tone: toneOf(text) }))
    : []
  // The weapon's name, then its rules (split so neither chip runs off the mat).
  const ruleText = weapon ? weaponRuleChips(rules).join(' · ') : ''
  const weaponChip = weapon ? [`WEAPON · ${weaponLabel(weapon).toUpperCase()}`, ...(ruleText ? [ruleText] : [])] : []
  const shooterChips = [...weaponChip, ...(result ? result.shooterChips : [])].map((text) => ({
    text,
    tone: toneOf(text),
  }))

  return (
    <g className="targeting" data-shooter={shooter.id} data-target={target?.id}>
      {rules?.range ? (
        <circle
          className="target-range-ring"
          cx={shooter.x}
          cy={toSvgY(shooter.y)}
          r={tokenRadiusIn(shooter) + rules.range}
          data-range-ring={rules.range}
        />
      ) : null}
      {result ? <Scan lines={result.lines} /> : null}
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
      {enemies.map((enemy) => {
        const status = glanceStatus(enemy === target ? result : analyse(enemy))
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
