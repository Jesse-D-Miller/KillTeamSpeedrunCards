// One-off effects for things that just happened to an operative (see useTokenFx), drawn
// on or outside its rim and gone within about a second. Hurt, crit and heal effects play
// on the token itself (WoundFx in BoardSvg).
//   effects: [{ kind, key, x, cy, r }].

// A drop of blood: round at the bottom, pointed at the top.
const DROP_PATH = 'M0 -0.09C0.05 -0.02 0.06 0.02 0.06 0.04A0.06 0.06 0 0 1 -0.06 0.04C-0.06 0.02 -0.05 -0.02 0 -0.09Z'

function TokenEvent({ effect }) {
  const { kind, x, cy, r } = effect
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

function TokenEvents({ tokenId, effects }) {
  if (!effects.length) return null
  return (
    <g className="token-events" data-events-for={tokenId} aria-hidden="true">
      {effects.map((effect) => (
        <TokenEvent key={effect.key} effect={effect} />
      ))}
    </g>
  )
}

export default TokenEvents
