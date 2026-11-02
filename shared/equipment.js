import { baseWithinRect, distance, pointInPolygon, segmentIntersection } from './geometry.js'
import { markerSegment } from './movement.js'

// Where universal equipment can be set up before the battle (Universal Equipment, June
// 2026). The app warns rather than refuses: the players may agree otherwise, and the
// killzone data has no access points (only close quarters killzones have them).
//   territory: wholly within your territory; nearDrop: wholly within that many inches
//   of your drop zone; fromMarkers / fromEquipment / fromAccessible / fromDoors: more
//   than that many inches from other markers (objectives too), other equipment terrain
//   features, Accessible terrain (doors), or doors.
const AWAY_FROM_TERRAIN = { territory: true, fromEquipment: 2, fromAccessible: 2 }
const PLACEMENT = {
  'ammo-cache': { territory: true },
  'comms-device': { territory: true },
  mines: { territory: true, fromMarkers: 2, fromAccessible: 2 },
  'razor-wire': AWAY_FROM_TERRAIN,
  'light-barricade': AWAY_FROM_TERRAIN,
  'portable-barricade': AWAY_FROM_TERRAIN,
  'heavy-barricade': { nearDrop: 4, fromEquipment: 2, fromAccessible: 2 },
  ladder: { territory: true, fromEquipment: 2, fromDoors: 1 },
}

// Equipment that's a terrain feature (rather than a marker).
export const EQUIPMENT_TERRAIN = new Set(['razor-wire', 'light-barricade', 'heavy-barricade', 'portable-barricade', 'ladder'])

// A marker's shape: its disc, or a long marker's run (Razor Wire) with the disc's radius.
const shapeOf = (marker) => (marker.span ? { ...markerSegment(marker), r: marker.radius ?? 0 } : { a: marker, b: marker, r: marker.radius ?? 0 })

const pointToSegment = (point, a, b) => {
  const length = distance(a, b) ** 2
  if (!length) return distance(point, a)
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / length))
  return distance(point, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
}
const segmentToSegment = (a, b, c, d) =>
  segmentIntersection(a, b, c, d) ? 0 : Math.min(pointToSegment(a, c, d), pointToSegment(b, c, d), pointToSegment(c, a, b), pointToSegment(d, a, b))

// Edge to edge, in inches.
const markerGap = (one, other) => {
  const [a, b] = [shapeOf(one), shapeOf(other)]
  return segmentToSegment(a.a, a.b, b.a, b.b) - a.r - b.r
}
const polygonGap = (marker, points) => {
  const shape = shapeOf(marker)
  if (pointInPolygon(shape.a, points) || pointInPolygon(shape.b, points)) return 0
  const edges = points.map((point, index) => [point, points[(index + 1) % points.length]])
  return Math.min(...edges.map(([c, d]) => segmentToSegment(shape.a, shape.b, c, d))) - shape.r
}

// Why this equipment marker breaks its set-up rules, or null.
//   marker: the placed marker; markers: every marker on the board; objectives: [{ x, y,
//   radius }]; doors: [{ points }]; territory, drop: { x, y, w, h } of its owner.
export const placementWarning = ({ marker, markers = [], objectives = [], doors = [], territory = null, drop = null }) => {
  const rule = PLACEMENT[marker.catalogId]
  if (!rule) return null
  const shape = shapeOf(marker)
  const wholly = (rect, margin = 0) => baseWithinRect(shape.a, shape.r, rect, margin) && baseWithinRect(shape.b, shape.r, rect, margin)
  if (rule.territory && territory && !wholly(territory)) return 'Set it up wholly within your territory.'
  if (rule.nearDrop && drop && !wholly(drop, rule.nearDrop)) return `Set it up wholly within ${rule.nearDrop}" of your drop zone.`
  const others = markers.filter((other) => other.id !== marker.id && !other.attachedTo)
  if (rule.fromMarkers && [...others, ...objectives].some((other) => markerGap(marker, other) <= rule.fromMarkers)) {
    return `Keep it more than ${rule.fromMarkers}" from other markers.`
  }
  if (rule.fromEquipment && others.some((other) => EQUIPMENT_TERRAIN.has(other.catalogId) && markerGap(marker, other) <= rule.fromEquipment)) {
    return `Keep it more than ${rule.fromEquipment}" from other equipment terrain.`
  }
  const fromDoors = rule.fromAccessible ?? rule.fromDoors
  if (fromDoors && doors.some((door) => polygonGap(marker, door.points) <= fromDoors)) {
    return rule.fromAccessible ? `Keep it more than ${fromDoors}" from Accessible terrain (doors).` : `Keep it more than ${fromDoors}" from doors.`
  }
  return null
}
