import { isInjured } from './health.js'

// Quiet indicators around an operative's base for states that last: small, faint and on
// or outside the rim (the base itself stays black on the projector), so the table reads
// at a glance without anything pulling the eye. Each pairs its colour with a shape.
//   view: { x, cy, r, facing }; status: the operative's unit state; maxWounds: its
//   starting wounds (null for blank tokens).

// Injured: a broken red ring that breathes slowly, its gaps reading as cracks.
const CRACKS = '0.34 0.05 0.16 0.07 0.42 0.04 0.22 0.08'

function StatusRim({ token, view, status, maxWounds }) {
  const { x, cy, r } = view
  const injured = maxWounds && status?.wounds != null && isInjured(maxWounds, status.wounds)
  return (
    <g className="status-rim" data-status-for={token.id} aria-hidden="true">
      {injured ? <circle className="status-injured" data-status="injured" cx={x} cy={cy} r={r + 0.14} strokeDasharray={CRACKS} /> : null}
    </g>
  )
}

export default StatusRim
