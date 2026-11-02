import { aplBonus } from '../../shared/game.js'
import { isMissionMarker } from '../data/tokenCatalog.js'
import { isInjured } from './health.js'

// Quiet indicators around an operative's base for states that last: small, faint and on
// or outside the rim (the base itself stays black on the projector), so the table reads
// at a glance without anything pulling the eye. Each pairs its colour with a shape.
//   view: { x, cy, r, facing }; status: the operative's unit state; maxWounds: its
//   starting wounds (null for blank tokens); riders: the tokens riding on it.

// Injured: a broken red ring that breathes slowly, its gaps reading as cracks.
const CRACKS = '0.34 0.05 0.16 0.07 0.42 0.04 0.22 0.08'

// Stunned: three small four-pointed sparks circling the rim slowly.
const SPARK_PATH = 'M0 -0.07L0.018 -0.018L0.07 0L0.018 0.018L0 0.07L-0.018 0.018L-0.07 0L-0.018 -0.018Z'
const SPARK_ANGLES = [0, 120, 240]

// Poisoned (a team's Poison token rides on it): a soft green haze drifting round the
// outside of the rim, and now and then a couple of tiny bubbles rise off it.
const isPoison = (marker) => /-poison$/.test(marker.catalogId ?? '')
const BUBBLES = [
  { dx: -0.12, delay: 0 },
  { dx: 0.16, delay: 1.3 },
]

// On guard (a Guard token rides on it): a thin arc on the side facing the opponent's edge
// sweeps slowly back and forth, like a sentry watching. Labels turn by `facing` to read
// from the opponent's seat, so that side is straight down in their turned frame.
const isGuard = (marker) => marker.catalogId === 'guard'
const guardArc = (radius) => {
  const half = (35 * Math.PI) / 180
  return `M${-radius * Math.sin(half)} ${radius * Math.cos(half)}A${radius} ${radius} 0 0 0 ${radius * Math.sin(half)} ${radius * Math.cos(half)}`
}

// Mark of Chaos (legionaries): six small glyphs round the base in the god's colour, each
// god with its own shape so it reads without colour too, breathing slowly.
const MARK_GLYPHS = {
  KHORNE: { color: '#e03131', d: 'M-0.05 -0.05L0.05 0.05M0.05 -0.05L-0.05 0.05' },
  NURGLE: { color: '#82c91e', d: 'M0.05 0A0.05 0.05 0 1 1 -0.05 0A0.05 0.05 0 1 1 0.05 0Z' },
  SLAANESH: { color: '#e64980', d: 'M0 -0.06L0.05 0L0 0.06L-0.05 0Z' },
  TZEENTCH: { color: '#4dabf7', d: 'M0 -0.055L0.055 0.045L-0.055 0.045Z' },
  UNDIVIDED: { color: '#c9a86a', d: 'M0 -0.06V0.06M-0.06 0H0.06M-0.042 -0.042L0.042 0.042M0.042 -0.042L-0.042 0.042' },
}
const MARK_ANGLES = [30, 90, 150, 210, 270, 330]

// Carrying a mission marker (objective, Pick Up, Orb…): a small diamond orbits the base
// slowly, so it's clear at a glance who has it.
const CARRY_PATH = 'M0 -0.13L0.095 0L0 0.13L-0.095 0Z'

// APL changed: a small tag on the left of the base (clear of the name, order tag, riders
// and wound badge), ▲ green for more, ▼ red for less. Stunned counts as −1, a Resourceful
// +1 APL as +1 until its activation ends.
const APL_TAG_ANGLE = 180
const aplChange = (status) => (Number(status?.apl) || 0) + ((status?.statuses ?? []).includes('stunned') ? -1 : 0) + aplBonus(status)

function AplTag({ view, change }) {
  const { x, cy, r, facing = 0 } = view
  const angle = ((APL_TAG_ANGLE + facing) * Math.PI) / 180
  const tx = x + Math.cos(angle) * (r + 0.3)
  const ty = cy + Math.sin(angle) * (r + 0.3)
  const up = change > 0
  return (
    <g className={`status-apl ${up ? 'is-up' : 'is-down'}`} data-status="apl" data-apl={change} transform={`translate(${tx} ${ty}) rotate(${facing})`}>
      <g className="status-apl-in">
        <rect x={-0.27} y={-0.13} width={0.54} height={0.26} rx={0.13} />
        <text x={0} y={0.005} textAnchor="middle" dominantBaseline="central">
          {up ? '▲' : '▼'}
          {up ? `+${change}` : `−${-change}`}
        </text>
      </g>
    </g>
  )
}

function StatusRim({ token, view, status, maxWounds, riders = [] }) {
  const { x, cy, r } = view
  const injured = maxWounds && status?.wounds != null && isInjured(maxWounds, status.wounds)
  const stunned = (status?.statuses ?? []).includes('stunned')
  const apl = aplChange(status)
  const poisoned = riders.some(isPoison)
  const guarding = riders.some(isGuard)
  const mark = MARK_GLYPHS[status?.mark] ?? null
  const carrying = riders.some((marker) => isMissionMarker(marker.catalogId))
  return (
    <g className="status-rim" data-status-for={token.id} aria-hidden="true">
      {injured ? <circle className="status-injured" data-status="injured" cx={x} cy={cy} r={r + 0.14} strokeDasharray={CRACKS} /> : null}
      {stunned ? (
        <g className="status-stunned" data-status="stunned" transform={`translate(${x} ${cy})`}>
          <g className="status-orbit">
            {SPARK_ANGLES.map((angle) => (
              <path key={angle} className="status-spark" d={SPARK_PATH} transform={`rotate(${angle}) translate(0 ${-(r + 0.22)}) scale(1.3)`} />
            ))}
          </g>
        </g>
      ) : null}
      {poisoned ? (
        <g className="status-poison" data-status="poisoned" transform={`translate(${x} ${cy})`}>
          <circle className="status-haze" r={r + 0.17} />
          {BUBBLES.map(({ dx, delay }) => (
            <circle key={dx} className="status-bubble" cx={dx} cy={-(r + 0.12)} r={0.035} style={{ animationDelay: `${delay}s` }} />
          ))}
        </g>
      ) : null}
      {guarding ? (
        <g className="status-guard" data-status="guard" transform={`translate(${x} ${cy}) rotate(${view.facing ?? 0})`}>
          <path className="status-guard-arc" d={guardArc(r + 0.32)} />
        </g>
      ) : null}
      {mark ? (
        <g className="status-mark" data-status="mark" data-mark={status.mark} transform={`translate(${x} ${cy})`} style={{ '--mark-color': mark.color }}>
          {MARK_ANGLES.map((angle) => (
            <g key={angle} transform={`rotate(${angle}) translate(0 ${-(r + 0.26)})`}>
              <path className="status-mark-glyph" d={mark.d} />
            </g>
          ))}
        </g>
      ) : null}
      {carrying ? (
        <g className="status-carry" data-status="carrying" transform={`translate(${x} ${cy})`}>
          <g className="status-carry-orbit">
            <circle className="status-carry-track" r={r + 0.2} />
            <path className="status-carry-icon" d={CARRY_PATH} transform={`translate(0 ${-(r + 0.2)})`} />
          </g>
        </g>
      ) : null}
      {apl ? <AplTag key={apl} view={view} change={apl} /> : null}
    </g>
  )
}

export default StatusRim
