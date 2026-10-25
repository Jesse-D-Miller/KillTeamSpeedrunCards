// Board geometry in inches. Origin is bottom-left, +y is up (matches the map/terrain JSON).

export const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y)

export const pathLength = (points) =>
  points.reduce((total, point, index) => (index ? total + distance(points[index - 1], point) : 0), 0)

export const transformPoint = ([x, y], placement) => {
  const offsetX = placement?.x || 0
  const offsetY = placement?.y || 0
  const rotation = placement?.rotation || 0
  if (!rotation) return { x: x + offsetX, y: y + offsetY }
  const radians = (rotation * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return { x: x * cos - y * sin + offsetX, y: x * sin + y * cos + offsetY }
}

export const getPieceAreas = (piece) => {
  if (piece?.areas?.length) return piece.areas
  return piece?.area ? [piece.area] : []
}

export const getSegmentType = (segment) =>
  Array.isArray(segment?.[0]) ? 'heavy' : segment?.type || 'heavy'

const getSegmentPoints = (segment) => (Array.isArray(segment?.[0]) ? segment : segment?.segment)

export const polygonCentroid = (points) => {
  if (!Array.isArray(points) || points.length < 3) return null
  let signedArea = 0
  let cx = 0
  let cy = 0
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length]
    const cross = point.x * next.y - next.x * point.y
    signedArea += cross
    cx += (point.x + next.x) * cross
    cy += (point.y + next.y) * cross
  })
  if (Math.abs(signedArea) < 1e-6) {
    const sum = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 })
    return { x: sum.x / points.length, y: sum.y / points.length }
  }
  const factor = 1 / (3 * signedArea)
  return { x: cx * factor, y: cy * factor }
}

// Flatten an arrangement into world-space polygons and wall segments.
export const buildTerrain = (arrangement, pieceById) => {
  const areas = []
  const walls = []
  ;(arrangement?.terrain ?? []).forEach((entry) => {
    const piece = entry?.pieceId ? pieceById.get(entry.pieceId) : entry
    if (!piece) return
    const placement = entry.placement
    const label = String(piece.name || piece.id || '').match(/volkus_([A-Za-z])$/)?.[1]?.toUpperCase() ?? ''
    getPieceAreas(piece).forEach((area, areaIndex) => {
      if (!area?.points?.length) return
      const points = area.points.map((point) => transformPoint(point, placement))
      areas.push({
        id: `${entry.id || piece.id}-area-${areaIndex}`,
        // The terrain feature this belongs to (rules care about "the same feature").
        featureId: entry.id || piece.id,
        pieceLabel: label,
        // Volkus B's second area is the tall tower.
        vantage: label ? (label === 'B' && areaIndex === 1 ? 4 : 2) : null,
        points,
        centroid: polygonCentroid(points),
      })
    })
    ;(piece.walls?.segments ?? []).forEach((segment, index) => {
      const segmentPoints = getSegmentPoints(segment)
      if (!Array.isArray(segmentPoints)) return
      walls.push({
        id: `${entry.id || piece.id}-wall-${index}`,
        featureId: entry.id || piece.id,
        type: getSegmentType(segment),
        start: transformPoint(segmentPoints[0], placement),
        end: transformPoint(segmentPoints[1], placement),
      })
    })
  })
  return { areas, walls }
}

// Map 2 zone rects are authored in portrait (22x30); the board is always drawn landscape.
export const resolveZoneRect = (zone, mapId) => {
  if (!zone) return null
  if (mapId === 'map_02') return { x: zone.y, y: zone.x, w: zone.h, h: zone.w }
  return { x: zone.x, y: zone.y, w: zone.w, h: zone.h }
}

// Which board edge a drop zone sits on; used to orient text toward that player.
export const zoneEdge = (rect, board) => {
  if (!rect) return 'bottom'
  if (rect.w >= board.width - 0.01) return rect.y <= 0.01 ? 'bottom' : 'top'
  return rect.x <= 0.01 ? 'left' : 'right'
}

export const EDGE_ROTATION = { bottom: 0, top: 180, left: 90, right: -90 }

// Ray-casting point-in-polygon test.
export const pointInPolygon = (point, polygon) => {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]
    const b = polygon[j]
    if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside
    }
  }
  return inside
}

// Segment/segment intersection. Returns { x, y, t } with t along a->b, or null.
export const segmentIntersection = (a, b, c, d) => {
  const rx = b.x - a.x
  const ry = b.y - a.y
  const sx = d.x - c.x
  const sy = d.y - c.y
  const denom = rx * sy - ry * sx
  if (Math.abs(denom) < 1e-9) return null
  const qx = c.x - a.x
  const qy = c.y - a.y
  const t = (qx * sy - qy * sx) / denom
  const u = (qx * ry - qy * rx) / denom
  if (t < 0 || t > 1 || u < 0 || u > 1) return null
  return { x: a.x + rx * t, y: a.y + ry * t, t }
}

// Walls crossed by a sightline from `from` to `to`, nearest first, with the distance
// from the target (KT "intervening" checks care about the 1" control range around it).
export const sightlineHits = (from, to, walls) => {
  const length = distance(from, to)
  return walls
    .map((wall) => {
      const hit = segmentIntersection(from, to, wall.start, wall.end)
      if (!hit) return null
      return {
        wallId: wall.id,
        type: wall.type,
        x: hit.x,
        y: hit.y,
        fromTarget: length * (1 - hit.t),
      }
    })
    .filter(Boolean)
    .sort((left, right) => right.fromTarget - left.fromTarget)
}

export const isObscured = (hits) => hits.some((hit) => hit.type === 'heavy' && hit.fromTarget > 1)

// Grow a movement path toward `point` in fixed steps (1" for Kill Team moves).
// The path's last vertex is where the operative stands. Moving back near the
// previous vertex removes steps, so a route can be corrected mid-drag.
export const stepPath = (path, point, step = 1) => {
  const next = path.slice()
  while (next.length > 1 && distance(next[next.length - 2], point) < step / 2) next.pop()
  let last = next[next.length - 1]
  let gap = distance(last, point)
  while (gap >= step) {
    const t = step / gap
    last = { x: last.x + (point.x - last.x) * t, y: last.y + (point.y - last.y) * t }
    next.push(last)
    gap = distance(last, point)
  }
  return next
}

// A free drag's measured route: the trail recorded so far, then the finger.
export const trailPoints = ({ trail, x, y }) => [...trail, { x, y }]

// Where dead operatives sit: a row of slots lined up against an edge.
//   area: { start, along, out, inset } - `start` is a corner of that edge, `along`
//   the unit direction the row runs, `out` the unit direction away from the edge,
//   `inset` the gap before the first token.
// `deadTokens` need { id, radius }; returns Map(id -> { x, y }).
const CASUALTY_LABEL_ROOM = 0.45

export const casualtySlots = (deadTokens, area) => {
  const slots = new Map()
  if (!deadTokens.length) return slots
  // Each slot leaves room for the operative's curved name around its base.
  const footprint = (radius) => radius + CASUALTY_LABEL_ROOM
  const widest = Math.max(...deadTokens.map((token) => footprint(token.radius)))
  const spacing = widest * 2 + 0.1
  const sorted = [...deadTokens].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
  sorted.forEach((token, index) => {
    const along = area.inset + widest + index * spacing
    const out = footprint(token.radius) + 0.15
    slots.set(token.id, {
      x: area.start.x + area.along.x * along + area.out.x * out,
      y: area.start.y + area.along.y * along + area.out.y * out,
    })
  })
  return slots
}

// Just off the mat on one edge (used where there are no side panels, e.g. the iPad).
export const edgeCasualtyArea = (edge, board) => {
  const areas = {
    bottom: { start: { x: 0, y: 0 }, along: { x: 1, y: 0 }, out: { x: 0, y: -1 } },
    top: { start: { x: 0, y: board.height }, along: { x: 1, y: 0 }, out: { x: 0, y: 1 } },
    left: { start: { x: 0, y: 0 }, along: { x: 0, y: 1 }, out: { x: -1, y: 0 } },
    right: { start: { x: board.width, y: 0 }, along: { x: 0, y: 1 }, out: { x: 1, y: 0 } },
  }
  return { ...(areas[edge] ?? areas.bottom), inset: 1 }
}

// To the left of a player's side panel, as that player sees it from their seat.
//   slot: the panel's x range { x0, x1 } in board inches (it spans the board height).
//   rotation: the panel's rotation toward its player (0 bottom, 180 top, 90 left, -90 right).
// The row starts at the player's end of the panel and runs away from them.
export const panelCasualtyArea = ({ x0, x1 }, rotation, board) => {
  const areas = {
    0: { start: { x: x0, y: 0 }, along: { x: 0, y: 1 }, out: { x: -1, y: 0 } },
    180: { start: { x: x1, y: board.height }, along: { x: 0, y: -1 }, out: { x: 1, y: 0 } },
    90: { start: { x: x0, y: board.height }, along: { x: 1, y: 0 }, out: { x: 0, y: 1 } },
    '-90': { start: { x: x1, y: 0 }, along: { x: -1, y: 0 }, out: { x: 0, y: -1 } },
  }
  return { ...(areas[rotation] ?? areas[0]), inset: 0.3 }
}
