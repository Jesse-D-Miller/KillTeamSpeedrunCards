import { seatColor } from './colors.js'
import TokenLabel from './TokenLabel.jsx'

// A marker on the killzone, or a token riding on an operative: a disc in its
// owner's colour with its name curved over the top like an operative's, but
// smaller and fainter.
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
      <circle cx={x} cy={cy} r={marker.radius} />
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
