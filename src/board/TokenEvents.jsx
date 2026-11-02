// One-off effects for things that just happened to an operative (see useTokenFx), drawn
// on or outside its rim and gone within about a second. Hurt, crit and heal effects play
// on the token itself (WoundFx in BoardSvg).
//   effects: [{ kind, key, x, cy, r }]; color: the operative's seat colour.

// A drop of blood: round at the bottom, pointed at the top.
const DROP_PATH = 'M0 -0.09C0.05 -0.02 0.06 0.02 0.06 0.04A0.06 0.06 0 0 1 -0.06 0.04C-0.06 0.02 -0.05 -0.02 0 -0.09Z'

// Taken out: six pieces of the rim fly a short way outward and fade.
const SHARD_ANGLES = [15, 75, 135, 195, 255, 315]
const shardPath = (r) => {
  const half = (22 * Math.PI) / 180
  return `M${-r * Math.sin(half)} ${-r * Math.cos(half)}A${r} ${r} 0 0 1 ${r * Math.sin(half)} ${-r * Math.cos(half)}`
}

function TokenEvent({ effect }) {
  const { kind, x, cy, r } = effect
  if (kind === 'engage' || kind === 'conceal') {
    // Engage: one orange ring ripples out. Conceal: a dashed ring closes in on the rim
    // and fades, like ducking out of sight. --from/--to scale it from/to the rim.
    const engage = kind === 'engage'
    const far = (r + (engage ? 0.6 : 0.3)) / r
    return (
      <g className={`token-event token-event-${kind}`} data-event={kind} transform={`translate(${x} ${cy})`}>
        <circle className="token-event-order-ring" r={r} style={{ '--from': engage ? 1 : far, '--to': engage ? far : 1.04 }} />
      </g>
    )
  }
  if (kind === 'shatter') {
    return (
      <g className="token-event token-event-shatter" data-event="shatter" transform={`translate(${x} ${cy})`}>
        {SHARD_ANGLES.map((angle) => (
          <g key={angle} transform={`rotate(${angle})`}>
            <path className="token-event-shard" d={shardPath(r)} />
          </g>
        ))}
      </g>
    )
  }
  if (kind === 'injured') {
    // Just injured: a drop runs a short way down the right of the rim and fades.
    return (
      <g className="token-event token-event-injured" data-event="injured" transform={`translate(${x} ${cy})`}>
        <g className="token-event-drip">
          <path className="token-event-drop" d={DROP_PATH} transform={`translate(0 ${-(r + 0.14)}) scale(1.5)`} />
        </g>
      </g>
    )
  }
  return null
}

function TokenEvents({ tokenId, effects, color }) {
  if (!effects.length) return null
  return (
    <g className="token-events" data-events-for={tokenId} style={{ '--token-color': color }} aria-hidden="true">
      {effects.map((effect) => (
        <TokenEvent key={effect.key} effect={effect} />
      ))}
    </g>
  )
}

export default TokenEvents
