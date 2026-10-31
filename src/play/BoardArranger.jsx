import { useLayoutEffect, useRef, useState } from 'react'
import { BOARD_PIECE_LABELS, BOARD_PIECES, barBounds, boardLayoutFor } from '../../shared/boardLayout.js'
import { BOARD } from '../board/boardData.js'
import { seatColor } from '../board/colors.js'
import PlayerBoard from '../table/panel/PlayerBoard.jsx'
import { CASUALTY_MARGIN_IN, panelLayout } from '../table/panelLayout.js'
import { usePlayer } from './usePlayer.js'

// "My board": the player's own side bar from the projector, upright and as big as the
// screen allows, with a handle over each piece to drag it somewhere else. Pieces can
// overlap and go past the bar to the edge of the projected picture, except on the side
// facing the mat. A drop snaps to the grid (board/layout) and the projector follows.
// Portrait (Map 1) and landscape (Map 2) bars keep their own arrangements.
function BoardArranger({ onClose }) {
  const { state: game, seat, act, presence } = usePlayer()
  const stageRef = useRef(null)
  const [room, setRoom] = useState({ width: 0, height: 0 })
  // The piece being dragged: where it started, where the finger started, where it is.
  const [drag, setDrag] = useState(null)

  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) return undefined
    const measure = () => setRoom({ width: stage.clientWidth, height: stage.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  const panelInches = game.settings.panelInches || 8
  const panels = panelLayout(game, panelInches)
  const side = panels.left.seat === seat ? 'left' : 'right'
  const rotation = panels[side].rotation
  const landscape = Math.abs(rotation) === 90
  const shape = landscape ? 'landscape' : 'portrait'
  // The bar as its player reads it, scaled to fit the screen.
  const across = landscape ? BOARD.height : panelInches
  const down = landscape ? panelInches : BOARD.height
  // The room around the bar: the picture's margin, but not toward the mat.
  const bounds = barBounds({ width: across, height: down, rotation, matSide: side === 'left' ? 'right' : 'left', margin: CASUALTY_MARGIN_IN })
  const spanX = bounds.maxX - bounds.minX
  const spanY = bounds.maxY - bounds.minY
  const scale = Math.max(0, Math.min(room.width / (across * spanX), room.height / (down * spanY)))
  const width = across * scale
  const height = down * scale
  const matEdge = bounds.minY === 0 ? 'top' : bounds.maxY === 1 ? 'bottom' : bounds.minX === 0 ? 'left' : 'right'

  const saved = boardLayoutFor(game.settings, seat, shape)
  // The piece being dragged rides on top.
  const top = 1 + Math.max(0, ...BOARD_PIECES.map((piece) => saved[piece].z ?? 0))
  const layout = drag ? { ...saved, [drag.piece]: { ...saved[drag.piece], x: drag.x, y: drag.y, z: top } } : saved
  // Shown as in the battle, even before it starts.
  const preview = game.phase === 'battle' || game.phase === 'results' ? game : { ...game, phase: 'battle' }

  const start = (piece) => (event) => {
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setDrag({ piece, from: saved[piece], pointer: { x: event.clientX, y: event.clientY }, x: saved[piece].x, y: saved[piece].y })
  }
  const move = (event) => {
    if (!drag || !width || !height) return
    const keep = (value, lo, hi) => Math.min(Math.max(value, lo), hi)
    setDrag({
      ...drag,
      x: keep(drag.from.x + (event.clientX - drag.pointer.x) / width, bounds.minX, bounds.maxX - drag.from.w),
      y: keep(drag.from.y + (event.clientY - drag.pointer.y) / height, bounds.minY, bounds.maxY - drag.from.h),
    })
  }
  const drop = () => {
    if (!drag) return
    act({ type: 'board/layout', shape, piece: drag.piece, x: drag.x, y: drag.y, bounds })
    setDrag(null)
  }

  return (
    <div className="arranger" role="dialog" aria-label="Arrange my board" style={{ '--seat-color': seatColor(seat) }}>
      <header className="arranger-head">
        <div>
          <h2>My board</h2>
          <p className="muted">
            Drag the pieces of your side bar on the projector. {landscape ? 'Landscape' : 'Portrait'} bars (Map {landscape ? 2 : 1}) are arranged separately.
          </p>
        </div>
        <div className="row">
          <button type="button" className="btn" onClick={() => act({ type: 'board/resetLayout', shape })}>
            Reset
          </button>
          <button type="button" className="btn is-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </header>
      <div className="arranger-stage" ref={stageRef}>
        {scale > 0 ? (
          <div className="arranger-area" style={{ width: width * spanX, height: height * spanY }}>
            <span className={`arranger-mat is-${matEdge}`} style={{ left: -bounds.minX * width, top: -bounds.minY * height, width, height }}>
              <span>Mat this side</span>
            </span>
            <div className="arranger-board" style={{ width, height, left: -bounds.minX * width, top: -bounds.minY * height }}>
              <PlayerBoard
                game={preview}
                seat={seat}
                rotation={rotation}
                upright
                connected={Boolean(presence?.[seat])}
                widthPx={panelInches * scale}
                heightPx={BOARD.height * scale}
                layout={layout}
              />
              <div className="arranger-handles">
                {BOARD_PIECES.map((piece) => {
                  const rect = layout[piece]
                  return (
                    <div
                      key={piece}
                      className={`arranger-handle${drag?.piece === piece ? ' is-dragging' : ''}`}
                      data-handle={piece}
                      style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%`, zIndex: rect.z ?? 0 }}
                      onPointerDown={start(piece)}
                      onPointerMove={move}
                      onPointerUp={drop}
                      onPointerCancel={() => setDrag(null)}
                    >
                      <span>{BOARD_PIECE_LABELS[piece]}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default BoardArranger
