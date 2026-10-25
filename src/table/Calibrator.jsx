import { useEffect, useRef, useState } from 'react'
import { BOARD } from '../board/boardData.js'

const CORNER_NAMES = ['Top left', 'Top right', 'Bottom right', 'Bottom left']

// Drag the four handles onto the corners of the physical mat. Keys 1-4 pick a corner,
// arrows nudge it (hold Shift for 10px).
function Calibrator({ corners, onChange, onSave, onReset, onCancel }) {
  const [selected, setSelected] = useState(0)
  const dragRef = useRef(null)
  const cornersRef = useRef(corners)

  useEffect(() => {
    cornersRef.current = corners
  }, [corners])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (['1', '2', '3', '4'].includes(event.key)) {
        setSelected(Number(event.key) - 1)
        return
      }
      const step = event.shiftKey ? 10 : 1
      const delta = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      }[event.key]
      if (!delta) return
      event.preventDefault()
      onChange(
        cornersRef.current.map((corner, index) =>
          index === selected ? { x: corner.x + delta[0], y: corner.y + delta[1] } : corner,
        ),
      )
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onChange, selected])

  const onPointerDown = (event, index) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    setSelected(index)
    dragRef.current = { index, startX: event.clientX, startY: event.clientY, origin: corners[index] }
  }

  const onPointerMove = (event) => {
    const drag = dragRef.current
    if (!drag) return
    onChange(
      cornersRef.current.map((corner, index) =>
        index === drag.index
          ? { x: drag.origin.x + event.clientX - drag.startX, y: drag.origin.y + event.clientY - drag.startY }
          : corner,
      ),
    )
  }

  const onPointerUp = () => {
    dragRef.current = null
  }

  return (
    <>
      {corners.map((corner, index) => (
        <div
          key={CORNER_NAMES[index]}
          className={`calibrate-handle${index === selected ? ' is-selected' : ''}`}
          style={{ left: corner.x, top: corner.y }}
          onPointerDown={(event) => onPointerDown(event, index)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span>{index + 1}</span>
        </div>
      ))}
      <div className="calibrate-bar">
        <div>
          <strong>Calibrate projector</strong>
          <div className="calibrate-hint">
            Drag each numbered handle onto that corner of the {BOARD.width}&quot; × {BOARD.height}&quot; mat. Keys 1–4
            select, arrows nudge. Check the 6&quot; rulers with a tape measure.
          </div>
        </div>
        <div className="calibrate-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" onClick={onReset}>
            Reset
          </button>
          <button type="button" className="is-primary" onClick={onSave}>
            Save
          </button>
        </div>
      </div>
    </>
  )
}

// Test pattern drawn on the table plane: 6" rulers on every edge plus corner crosses.
function Pattern() {
  const W = BOARD.width
  const H = BOARD.height
  const ruler = (x1, y1, dx, dy, key) => {
    const ticks = []
    for (let i = 0; i <= 6; i += 1) {
      const x = x1 + dx * i
      const y = y1 + dy * i
      const major = i === 0 || i === 6
      ticks.push(
        <line
          key={`${key}-${i}`}
          x1={x}
          y1={y}
          x2={x + (dy ? (major ? 0.8 : 0.4) * Math.sign(W / 2 - x1 || 1) : 0)}
          y2={y + (dx ? (major ? 0.8 : 0.4) * Math.sign(H / 2 - y1 || 1) : 0)}
        />,
      )
    }
    return (
      <g key={key}>
        <line x1={x1} y1={y1} x2={x1 + dx * 6} y2={y1 + dy * 6} />
        {ticks}
      </g>
    )
  }
  return (
    <svg className="calibrate-pattern" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <rect x={0.02} y={0.02} width={W - 0.04} height={H - 0.04} />
      {ruler(1, 0.05, 1, 0, 'top')}
      {ruler(W - 7, H - 0.05, 1, 0, 'bottom')}
      {ruler(0.05, 1, 0, 1, 'left')}
      {ruler(W - 0.05, H - 7, 0, 1, 'right')}
      <path d={`M${W / 2 - 1},${H / 2} H${W / 2 + 1} M${W / 2},${H / 2 - 1} V${H / 2 + 1}`} />
      <text x={W / 2} y={H / 2 + 2} textAnchor="middle">
        {W}&quot; × {H}&quot;
      </text>
    </svg>
  )
}

Calibrator.Pattern = Pattern

export default Calibrator
