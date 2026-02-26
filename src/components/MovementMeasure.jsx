import { useEffect, useMemo, useState } from 'react'
import './MovementMeasure.css'

function MovementMeasure({ boardWidth, boardHeight, svgRef, active }) {
  const [points, setPoints] = useState([])
  const [origin, setOrigin] = useState(null)

  const polylinePoints = useMemo(
    () => points.map((point) => `${point.x},${point.y}`).join(' '),
    [points],
  )

  useEffect(() => {
    if (!active) {
      setPoints([])
      setOrigin(null)
      return
    }

    setPoints([])
    setOrigin(null)
  }, [active])

  useEffect(() => {
    if (!active) return
    const handleClear = () => {
      setPoints([])
      setOrigin(null)
    }

    window.addEventListener('kt-clear-tools', handleClear)
    return () => window.removeEventListener('kt-clear-tools', handleClear)
  }, [active])

  const getBoardPoint = (event) => {
    const svg = svgRef?.current
    if (!svg) return null
    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return null
    const svgPoint = point.matrixTransform(ctm.inverse())
    const x = Math.min(Math.max(svgPoint.x, 0), boardWidth)
    const y = Math.min(
      Math.max(boardHeight - svgPoint.y, 0),
      boardHeight,
    )
    return { x, y }
  }

  const handlePointerDown = (event) => {
    if (!active) return
    const point = getBoardPoint(event)
    if (!point) return
    if (!origin) {
      setOrigin(point)
      setPoints([point])
      return
    }

    setPoints((prev) => {
      if (!prev.length) return [point]
      const last = prev[prev.length - 1]
      const dx = point.x - last.x
      const dy = point.y - last.y
      const dist = Math.hypot(dx, dy)
      if (!dist) return prev

      const nx = dx / dist
      const ny = dy / dist
      const nextPoint = { x: last.x + nx, y: last.y + ny }
      return [...prev, nextPoint]
    })
  }

  if (!active) return null

  const markerSize = 0.18
  const labelOffset = 0.3

  return (
    <g className="movement-measure">
      <rect
        className="movement-measure-capture is-active"
        x={0}
        y={0}
        width={boardWidth}
        height={boardHeight}
        onPointerDown={handlePointerDown}
      />
      {origin ? (
        <g className="movement-measure-origin">
          <line
            x1={origin.x - 0.2}
            y1={origin.y - 0.2}
            x2={origin.x + 0.2}
            y2={origin.y + 0.2}
          />
          <line
            x1={origin.x - 0.2}
            y1={origin.y + 0.2}
            x2={origin.x + 0.2}
            y2={origin.y - 0.2}
          />
        </g>
      ) : null}
      {points.length >= 2 ? (
        <>
          <polyline className="movement-measure-line" points={polylinePoints} />
          {points.slice(1).map((point, index) => {
            const prev = points[index]
            const dx = point.x - prev.x
            const dy = point.y - prev.y
            const dist = Math.hypot(dx, dy) || 1
            const nx = -dy / dist
            const ny = dx / dist
            const inch = index + 1
            const x1 = point.x + nx * markerSize
            const y1 = point.y + ny * markerSize
            const x2 = point.x - nx * markerSize
            const y2 = point.y - ny * markerSize
            const labelX = point.x + nx * (markerSize + labelOffset)
            const labelY = point.y + ny * (markerSize + labelOffset)

            return (
              <g key={`measure-marker-${inch}`}>
                <line
                  className="movement-measure-marker"
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                />
                {inch % 3 === 0 ? (
                  <text
                    className="movement-measure-label"
                    x={labelX}
                    y={labelY}
                    fontSize={0.28}
                  >
                    {inch}
                  </text>
                ) : null}
              </g>
            )
          })}
        </>
      ) : null}
    </g>
  )
}

export default MovementMeasure
