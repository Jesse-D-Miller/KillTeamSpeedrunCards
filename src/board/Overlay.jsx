import { distance, isObscured, pathLength, sightlineHits } from '../../shared/geometry.js'
import { BOARD, toSvgY } from './boardData.js'
import { seatColor } from './colors.js'

// Live tool previews (measure / line of sight / ping). Drawn identically on the iPad
// that owns the tool and on every other screen that receives it.

const inches = (value) => `${value.toFixed(1)}"`

// A distance in the middle of the piece being moved, counting in 0.1" steps.
export function MoveCount({ x, y, value, tokenId }) {
  return (
    <text
      className="overlay-label move-count"
      data-count-for={tokenId}
      x={x}
      y={toSvgY(y)}
      textAnchor="middle"
      dominantBaseline="central"
    >
      {inches(value)}
    </text>
  )
}

// Keep labels on the mat even when the line runs to an edge.
function Label({ x, y, children, className = '' }) {
  const safeX = Math.min(BOARD.width - 3, Math.max(3, x))
  const safeY = Math.min(BOARD.height - 0.2, Math.max(1.2, y))
  return (
    <text className={`overlay-label ${className}`} x={safeX} y={toSvgY(safeY) - 0.5} textAnchor="middle">
      {children}
    </text>
  )
}

// onToken: a dragged operative's measured route, counted in the middle of the token.
function Measure({ points, onToken = false }) {
  if (!points?.length) return null
  const total = pathLength(points)
  const end = points[points.length - 1]
  const ticks = []
  let carried = 0
  points.slice(1).forEach((point, index) => {
    const start = points[index]
    const length = distance(start, point)
    for (let d = 1 - carried; d <= length; d += 1) {
      const t = d / length
      ticks.push({ x: start.x + (point.x - start.x) * t, y: start.y + (point.y - start.y) * t })
    }
    carried = (carried + length) % 1
  })
  return (
    <g className="overlay-measure">
      <polyline points={points.map((point) => `${point.x},${toSvgY(point.y)}`).join(' ')} />
      {ticks.map((tick, index) => (
        <circle key={index} className="overlay-tick" cx={tick.x} cy={toSvgY(tick.y)} r={0.09} />
      ))}
      <circle className="overlay-origin" cx={points[0].x} cy={toSvgY(points[0].y)} r={0.18} />
      {onToken ? (
        <MoveCount x={end.x} y={end.y} value={total} />
      ) : (
        <Label x={end.x} y={end.y}>
          {inches(total)}
        </Label>
      )}
    </g>
  )
}

// An operative's move: every vertex is one locked 1" step. `tip` is the finger
// mid-drag, drawn as a thin line beyond the last locked inch; while dragging, the
// count (in the middle of the token, under the finger) includes that part inch.
// A settled move's count is drawn over its token by BoardSvg instead.
function MovePath({ path, settled, tip }) {
  if (!path?.length) return null
  const end = path[path.length - 1]
  return (
    <g className={`overlay-move${settled ? ' is-settled' : ''}`}>
      <circle className="overlay-move-start" cx={path[0].x} cy={toSvgY(path[0].y)} r={0.35} />
      <polyline points={path.map((point) => `${point.x},${toSvgY(point.y)}`).join(' ')} />
      {tip ? (
        <line className="overlay-move-tip" x1={end.x} y1={toSvgY(end.y)} x2={tip.x} y2={toSvgY(tip.y)} />
      ) : null}
      {path.slice(1, -1).map((point, index) => (
        <circle key={index} className="overlay-tick" cx={point.x} cy={toSvgY(point.y)} r={0.09} />
      ))}
      {settled ? null : (
        <MoveCount
          x={(tip ?? end).x}
          y={(tip ?? end).y}
          value={path.length - 1 + (tip ? distance(end, tip) : 0)}
        />
      )}
    </g>
  )
}

function LineOfSight({ from, to, walls }) {
  if (!from || !to) return null
  const hits = sightlineHits(from, to, walls)
  const obscured = isObscured(hits)
  const cover = hits.some((hit) => hit.fromTarget <= 1)
  const status = [obscured ? 'OBSCURED' : 'CLEAR', cover ? 'COVER' : null].filter(Boolean).join(' · ')
  return (
    <g className={`overlay-los${obscured ? ' is-obscured' : ''}`}>
      <line x1={from.x} y1={toSvgY(from.y)} x2={to.x} y2={toSvgY(to.y)} />
      <circle className="overlay-los-target" cx={to.x} cy={toSvgY(to.y)} r={1.5} />
      {hits.map((hit) => (
        <circle key={hit.wallId} className={`overlay-hit is-${hit.type}`} cx={hit.x} cy={toSvgY(hit.y)} r={0.22} />
      ))}
      <Label x={to.x} y={to.y + 1.6}>
        {inches(distance(from, to))} · {status}
      </Label>
    </g>
  )
}

function Ping({ x, y }) {
  return (
    <g className="overlay-ping">
      <circle cx={x} cy={toSvgY(y)} r={0.6} />
      <circle className="overlay-ping-wave" cx={x} cy={toSvgY(y)} r={0.6} />
    </g>
  )
}

function Overlay({ owner, payload, walls }) {
  if (!payload) return null
  let content = null
  if (payload.tool === 'measure') content = <Measure points={payload.points} onToken={payload.onToken} />
  if (payload.tool === 'count') content = <MoveCount x={payload.to.x} y={payload.to.y} value={distance(payload.from, payload.to)} />
  if (payload.tool === 'los') content = <LineOfSight from={payload.from} to={payload.to} walls={walls} />
  if (payload.tool === 'ping') content = <Ping x={payload.x} y={payload.y} />
  if (payload.tool === 'move') content = <MovePath path={payload.path} settled={payload.settled} tip={payload.tip} />
  if (!content) return null
  return (
    <g className="board-overlay" style={{ '--overlay-color': seatColor(owner) }}>
      {content}
    </g>
  )
}

export default Overlay
