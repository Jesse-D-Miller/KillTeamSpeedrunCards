import { seatColor } from './colors.js'
import TokenLabel from './TokenLabel.jsx'

// A marker on the killzone, or a token riding on an operative: a disc in its
// owner's colour with its name curved over the top like an operative's, but
// smaller and fainter.
// A long marker (Razor Wire) also draws its run of wire through the disc: a line with
// barbs zigzagging along it, turned by its angle (anticlockwise on the board, y up).
const BARB_STEP = 0.25
const BARB_SIZE = 0.09
const barbs = (span) => {
  const count = Math.max(2, Math.round(span / BARB_STEP))
  return Array.from({ length: count + 1 }, (_, index) => `${-span / 2 + (index * span) / count} ${index % 2 ? BARB_SIZE : -BARB_SIZE}`).join(' ')
}

function Wire({ marker, x, cy }) {
  return (
    <g className="board-wire" data-span={marker.span} data-angle={marker.angle ?? 0} transform={`translate(${x} ${cy}) rotate(${-(marker.angle ?? 0)})`}>
      <line className="board-wire-core" x1={-marker.span / 2} x2={marker.span / 2} y1={0} y2={0} />
      <polyline className="board-wire-barbs" points={barbs(marker.span)} />
    </g>
  )
}

// facing: turns the name to read for the owner's opponent; labelId: unique id for its arc.
function MarkerDisc({ marker, x, cy, riding, facing = 0, labelId, highlighted, onPointerDown }) {
  const text = marker.label || marker.short
  return (
    <g
      className={`board-marker is-${marker.kind}${marker.catalogId ? ' is-catalog' : ''}${riding ? ' is-riding' : ''}${highlighted ? ' is-highlighted' : ''}`}
      style={{ '--token-color': seatColor(marker.seat) }}
      data-marker-id={marker.id}
      data-catalog-id={marker.catalogId ?? undefined}
      data-attached-to={marker.attachedTo ?? undefined}
      onPointerDown={onPointerDown}
    >
      {marker.span && !riding ? <Wire marker={marker} x={x} cy={cy} /> : null}
      <circle cx={x} cy={cy} r={marker.radius} />
      {/* Smoke: activations left before it clears, once its D3 is rolled. */}
      {marker.smoke?.left != null ? (
        <text className="board-marker-count" data-smoke-left={marker.smoke.left} x={x} y={cy} textAnchor="middle" dominantBaseline="central" transform={facing ? `rotate(${facing} ${x} ${cy})` : undefined}>
          {marker.smoke.left}
        </text>
      ) : null}
      {text ? (
        <g
          className="board-marker-name"
          data-facing={facing}
          transform={facing ? `rotate(${facing} ${x} ${cy})` : undefined}
        >
          <TokenLabel
            id={labelId}
            x={x}
            cy={cy}
            r={marker.radius}
            text={text}
            className="board-marker-label"
            maxFont={0.2}
            minFont={0.1}
          />
        </g>
      ) : null}
    </g>
  )
}

export default MarkerDisc
