import { SKULL_PATH } from './icons.js'

// An operative's Engage / Conceal order, drawn as a tag pointing straight out from
// its base: the narrow end hugs the base's curve, the far end is a little wider.
// The tag is red or black; it swaps each time the operative is expended (see
// orderFlips in the reducer), so the colour that means "ready" alternates per TP.

// The same size on every base, in inches; only the near edge's curve follows the base.
const GAP = 0.1
const LENGTH = 0.62
const INNER_HALF = 0.15
const OUTER_HALF = 0.21
const ICON = 0.15
// The skull only fills part of its box, so it's drawn larger than the crosshair.
const SKULL_BOOST = 1.45

// Icons in a unit box centred on 0,0 (y down).
// Engage: a stroked crosshair. Conceal: a filled skull.
const ENGAGE_PATH =
  'M0,-1 V-0.35 M0,0.35 V1 M-1,0 H-0.35 M0.35,0 H1 M0.62,0 A0.62,0.62 0 1 1 -0.62,0 A0.62,0.62 0 1 1 0.62,0'

// The tag's outline. cx/cy/r: the base (SVG coords); angle: direction outward, degrees.
const orderTagPath = (cx, cy, r, angle) => {
  const theta = (angle * Math.PI) / 180
  const u = { x: Math.cos(theta), y: Math.sin(theta) }
  const v = { x: -u.y, y: u.x }
  const inner = r + GAP
  const outer = inner + LENGTH
  const spread = Math.asin(Math.min(0.95, (INNER_HALF) / inner))
  const onBase = (sign) => ({
    x: cx + inner * Math.cos(theta + sign * spread),
    y: cy + inner * Math.sin(theta + sign * spread),
  })
  const atEnd = (sign) => ({
    x: cx + u.x * outer + v.x * OUTER_HALF * sign,
    y: cy + u.y * outer + v.y * OUTER_HALF * sign,
  })
  const [a, b, c, d] = [onBase(-1), atEnd(-1), atEnd(1), onBase(1)]
  const f = (point) => `${point.x.toFixed(3)},${point.y.toFixed(3)}`
  // The near edge follows the base circle, so it curves in toward the operative.
  return `M${f(a)} L${f(b)} L${f(c)} L${f(d)} A${inner.toFixed(3)},${inner.toFixed(3)} 0 0 0 ${f(a)} Z`
}

// tokenId/order/black: what to draw; angle: outward direction (degrees, SVG);
// iconRotation: turns the icon to read for whoever it faces.
function OrderTag({ tokenId, cx, cy, r, angle, iconRotation = 0, order, black, onPointerDown }) {
  const theta = (angle * Math.PI) / 180
  const middle = r + (GAP + LENGTH * 0.55)
  const ix = cx + Math.cos(theta) * middle
  const iy = cy + Math.sin(theta) * middle
  return (
    <g
      className={`board-order-tag is-${order} ${black ? 'is-black' : 'is-red'}${onPointerDown ? ' is-interactive' : ''}`}
      data-order-for={tokenId}
      data-order={order}
      data-order-color={black ? 'black' : 'red'}
      data-facing={iconRotation}
      role={onPointerDown ? 'button' : undefined}
      aria-label={onPointerDown ? `${order === 'engage' ? 'Engage' : 'Conceal'} order, tap to switch` : undefined}
      onPointerDown={onPointerDown}
    >
      <path className="board-order-tag-shape" d={orderTagPath(cx, cy, r, angle)} />
      <path
        className={`board-order-tag-icon is-${order === 'engage' ? 'engage' : 'conceal'}`}
        d={order === 'engage' ? ENGAGE_PATH : SKULL_PATH}
        fillRule="evenodd"
        transform={`translate(${ix.toFixed(3)} ${iy.toFixed(3)}) rotate(${iconRotation}) scale(${ICON * (order === 'engage' ? 1 : SKULL_BOOST)})`}
      />
    </g>
  )
}

export default OrderTag
