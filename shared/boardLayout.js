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
const clamp = (value, max) => Math.min(Math.max(value, 0), Math.max(max, 0))
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
      return [piece, Number.isFinite(spot?.x) && Number.isFinite(spot?.y) ? { ...base, x: spot.x, y: spot.y } : base]
    }),
  )
}

const overlaps = (a, b) => a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6

// Where a dropped piece lands: snapped, kept on the board, and moved to the nearest
// free spot (in any direction) if it would cover another piece; left where dropped if
// the board has no room for it.
export const placePiece = (layout, piece, { x, y }) => {
  const { w, h } = layout[piece]
  const others = BOARD_PIECES.filter((other) => other !== piece).map((other) => layout[other])
  const at = (px, py) => ({ x: fix(clamp(round(px), 1 - w)), y: fix(clamp(round(py), 1 - h)), w, h })
  const dropped = at(x, y)
  const free = (rect) => !others.some((other) => overlaps(rect, other))
  if (free(dropped)) return { x: dropped.x, y: dropped.y }
  // Every snapped spot on the board, nearest first.
  const steps = Math.round(1 / SNAP)
  let best = null
  for (let i = 0; i <= steps; i += 1) {
    for (let j = 0; j <= steps; j += 1) {
      const spot = at(i * SNAP, j * SNAP)
      if (spot.x !== fix(i * SNAP) || spot.y !== fix(j * SNAP) || !free(spot)) continue
      const distance = Math.hypot(spot.x - dropped.x, spot.y - dropped.y)
      if (!best || distance < best.distance) best = { ...spot, distance }
    }
  }
  return best ? { x: best.x, y: best.y } : { x: dropped.x, y: dropped.y }
}
