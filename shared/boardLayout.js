// Each player arranges the pieces of their in-game side bar on the projector from
// their iPad. A layout gives each piece's top-left corner as fractions of the board
// (0..1 across and down, upright as its player reads it); sizes stay at their
// defaults. Portrait (Map 1) and landscape (Map 2) boards are arranged separately.

export const BOARD_SHAPES = ['portrait', 'landscape']

export const BOARD_PIECES = ['id', 'score', 'turn', 'kill', 'ploys', 'tacop', 'critop']

export const BOARD_PIECE_LABELS = {
  id: 'Name',
  score: 'Score',
  turn: 'Turning points',
  kill: 'Kill op',
  ploys: 'Ploys',
  tacop: 'Tac op',
  critop: 'Crit op',
}

// Where everything starts: the old fixed layout, widened to use the whole bar.
export const DEFAULT_BOARD_LAYOUTS = {
  portrait: {
    id: { x: 0.06, y: 0.03, w: 0.88, h: 0.065 },
    score: { x: 0.06, y: 0.11, w: 0.88, h: 0.15 },
    turn: { x: 0.06, y: 0.275, w: 0.88, h: 0.095 },
    kill: { x: 0.06, y: 0.385, w: 0.88, h: 0.085 },
    ploys: { x: 0.06, y: 0.485, w: 0.88, h: 0.07 },
    tacop: { x: 0.06, y: 0.57, w: 0.3, h: 0.4 },
    critop: { x: 0.38, y: 0.57, w: 0.56, h: 0.4 },
  },
  landscape: {
    id: { x: 0.03, y: 0.06, w: 0.4, h: 0.24 },
    score: { x: 0.03, y: 0.33, w: 0.2, h: 0.61 },
    turn: { x: 0.25, y: 0.33, w: 0.18, h: 0.61 },
    kill: { x: 0.45, y: 0.06, w: 0.18, h: 0.48 },
    ploys: { x: 0.45, y: 0.58, w: 0.18, h: 0.36 },
    tacop: { x: 0.65, y: 0.06, w: 0.09, h: 0.88 },
    critop: { x: 0.76, y: 0.06, w: 0.21, h: 0.88 },
  },
}

// Drops snap to 1% of the board.
const SNAP = 0.01

const round = (value) => Math.round(value / SNAP) * SNAP
const fix = (value) => Number(value.toFixed(3))

export const isBoardShape = (shape) => BOARD_SHAPES.includes(shape)
export const isBoardPiece = (piece) => BOARD_PIECES.includes(piece)

// Every piece's rect for one seat and shape: the saved spots over the defaults.
export const boardLayoutFor = (settings, seat, shape) => {
  const saved = settings?.boardLayouts?.[seat]?.[shape] ?? {}
  return Object.fromEntries(
    BOARD_PIECES.map((piece) => {
      const base = DEFAULT_BOARD_LAYOUTS[shape][piece]
      const spot = saved[piece]
      // z: pieces moved later sit on top of earlier ones where they overlap.
      return [piece, Number.isFinite(spot?.x) && Number.isFinite(spot?.y) ? { ...base, x: spot.x, y: spot.y, z: spot.z ?? 0 } : base]
    }),
  )
}

// Where pieces may go, as fractions of the board: the bar itself is 0..1, and pieces
// can go out past its edges (to the edge of the projected picture) except on the
// side facing the mat. Bounds from a device are kept within this much of the bar.
const MAX_REACH = 0.5
export const BAR_ONLY = { minX: 0, maxX: 1, minY: 0, maxY: 1 }

const sanitizeBounds = (bounds) => {
  const pick = (value, fallback, lo, hi) => (Number.isFinite(value) ? Math.min(Math.max(value, lo), hi) : fallback)
  return {
    minX: pick(bounds?.minX, 0, -MAX_REACH, 0),
    maxX: pick(bounds?.maxX, 1, 1, 1 + MAX_REACH),
    minY: pick(bounds?.minY, 0, -MAX_REACH, 0),
    maxY: pick(bounds?.maxY, 1, 1, 1 + MAX_REACH),
  }
}

// The room around a bar: `margin` inches past every edge except the one facing the mat.
//   width/height: the bar in inches, upright as its player reads it; rotation: how it
//   turns on the table (degrees); matSide: 'left' or 'right' of the bar on the table.
export const barBounds = ({ width, height, rotation, matSide, margin }) => {
  const r = (rotation * Math.PI) / 180
  const toMat = matSide === 'left' ? -1 : 1
  // The mat's direction in the bar's own axes (screen y points down).
  const across = toMat * Math.cos(r)
  const down = toMat * -Math.sin(r)
  return {
    minX: across < -0.5 ? 0 : -margin / width,
    maxX: across > 0.5 ? 1 : 1 + margin / width,
    minY: down < -0.5 ? 0 : -margin / height,
    maxY: down > 0.5 ? 1 : 1 + margin / height,
  }
}

// Where a dropped piece lands: snapped to 1% and kept within the bounds. Pieces may
// overlap; players lay them out as they like.
export const placePiece = (layout, piece, { x, y }, bounds = BAR_ONLY) => {
  const { w, h } = layout[piece]
  const { minX, maxX, minY, maxY } = sanitizeBounds(bounds)
  const fit = (value, lo, hi) => Math.min(Math.max(round(value), lo), Math.max(hi, lo))
  return { x: fix(fit(x, minX, maxX - w)), y: fix(fit(y, minY, maxY - h)) }
}
