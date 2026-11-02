import { isInjured } from './health.js'

// Quiet indicators around an operative's base for states that last: small, faint and on
// or outside the rim (the base itself stays black on the projector), so the table reads
// at a glance without anything pulling the eye. Each pairs its colour with a shape.
//   view: { x, cy, r, facing }; status: the operative's unit state; maxWounds: its
//   starting wounds (null for blank tokens).

// Injured: a broken red ring that breathes slowly, its gaps reading as cracks.
const CRACKS = '0.34 0.05 0.16 0.07 0.42 0.04 0.22 0.08'

// Stunned: three small four-pointed sparks circling the rim slowly.
const SPARK_PATH = 'M0 -0.07L0.018 -0.018L0.07 0L0.018 0.018L0 0.07L-0.018 0.018L-0.07 0L-0.018 -0.018Z'
const SPARK_ANGLES = [0, 120, 240]

// APL changed: a small tag on the left of the base (clear of the name, order tag, riders
// and wound badge), ▲ green for more, ▼ red for less. Stunned counts as −1.
const APL_TAG_ANGLE = 180
const aplChange = (status) => (Number(status?.apl) || 0) + ((status?.statuses ?? []).includes('stunned') ? -1 : 0)

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

function StatusRim({ token, view, status, maxWounds }) {
  const { x, cy, r } = view
  const injured = maxWounds && status?.wounds != null && isInjured(maxWounds, status.wounds)
  const stunned = (status?.statuses ?? []).includes('stunned')
  const apl = aplChange(status)
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
      {apl ? <AplTag key={apl} view={view} change={apl} /> : null}
    </g>
  )
}

export default StatusRim
