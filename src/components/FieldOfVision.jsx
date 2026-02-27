import { useEffect, useMemo, useRef, useState } from 'react'
import './FieldOfVision.css'

const EPSILON = 0.0005

function raySegmentIntersection(origin, direction, segmentStart, segmentEnd) {
  const rdx = direction.x
  const rdy = direction.y
  const sdx = segmentEnd.x - segmentStart.x
  const sdy = segmentEnd.y - segmentStart.y

  const denom = rdx * sdy - rdy * sdx
  if (Math.abs(denom) < 1e-9) return null

  const qpx = segmentStart.x - origin.x
  const qpy = segmentStart.y - origin.y
  const t = (qpx * sdy - qpy * sdx) / denom
  const u = (qpx * rdy - qpy * rdx) / denom

  if (t < 0 || u < 0 || u > 1) return null

  return {
    x: origin.x + rdx * t,
    y: origin.y + rdy * t,
    t,
  }
}

function computeVisibility(center, radius, segments, bounds) {
  const angles = []
  const pushAngle = (angle) => {
    angles.push(angle - EPSILON, angle, angle + EPSILON)
  }

  segments.forEach((segment) => {
    const a1 = Math.atan2(
      segment.start.y - center.y,
      segment.start.x - center.x,
    )
    const a2 = Math.atan2(
      segment.end.y - center.y,
      segment.end.x - center.x,
    )
    pushAngle(a1)
    pushAngle(a2)
  })

  const corners = [
    { x: 0, y: 0 },
    { x: bounds.width, y: 0 },
    { x: bounds.width, y: bounds.height },
    { x: 0, y: bounds.height },
  ]
  corners.forEach((corner) => {
    const angle = Math.atan2(corner.y - center.y, corner.x - center.x)
    pushAngle(angle)
  })

  const results = []
  angles.forEach((angle) => {
    const direction = { x: Math.cos(angle), y: Math.sin(angle) }
    const rayOrigin = {
      x: center.x + direction.x * radius,
      y: center.y + direction.y * radius,
    }
    let closest = null

    segments.forEach((segment) => {
      const hit = raySegmentIntersection(
        rayOrigin,
        direction,
        segment.start,
        segment.end,
      )
      if (!hit) return
      if (!closest || hit.t < closest.t) closest = hit
    })

    if (closest) {
      results.push({ x: closest.x, y: closest.y, angle })
    }
  })

  results.sort((a, b) => a.angle - b.angle)
  return results
}

function FieldOfVision({ boardWidth, boardHeight, svgRef, active, wallSegments }) {
  const [center, setCenter] = useState(null)
  const [radius, setRadius] = useState(0)
  const [anchor, setAnchor] = useState(null)
  const gradientIdRef = useRef(`fov-grad-${Math.random().toString(36).slice(2)}`)
  const clipIdRef = useRef(`fov-clip-${Math.random().toString(36).slice(2)}`)
  const dragStateRef = useRef(null)

  useEffect(() => {
    if (!active) {
      setCenter(null)
      setRadius(0)
      setAnchor(null)
      return
    }
    setCenter(null)
    setRadius(0)
    setAnchor(null)
  }, [active])

  useEffect(() => {
    if (!active) return
    const handleClear = () => {
      setCenter(null)
      setRadius(0)
      setAnchor(null)
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

  const maxRadiusForOrigin = (center) => {
    if (!center) return 0
    const maxX = Math.max(center.x, boardWidth - center.x)
    const maxY = Math.max(center.y, boardHeight - center.y)
    return Math.hypot(maxX, maxY)
  }

  const handlePointerDown = (event) => {
    if (!active) return
    const point = getBoardPoint(event)
    if (!point) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragStateRef.current = {
      start: point,
      moved: false,
    }
    setAnchor(point)
    setCenter(point)
    setRadius(0)
  }

  const handlePointerMove = (event) => {
    if (!active || !dragStateRef.current) return
    const point = getBoardPoint(event)
    if (!point) return
    const { start } = dragStateRef.current
    const dx = point.x - start.x
    const dy = point.y - start.y
    const dist = Math.hypot(dx, dy)
    if (dist < 0.1) return

    dragStateRef.current.moved = true
    const nextRadius = dist / 2
    const nextCenter = { x: (start.x + point.x) / 2, y: (start.y + point.y) / 2 }
    const capped = Math.min(nextRadius, maxRadiusForOrigin(nextCenter))
    setAnchor(start)
    setCenter(nextCenter)
    setRadius(capped)
  }

  const handlePointerUp = (event) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (!dragStateRef.current) return

    const { start, moved } = dragStateRef.current
    dragStateRef.current = null
    if (!moved) {
      setAnchor(null)
      setCenter(start)
      setRadius(0)
      return
    }

    setAnchor(start)
  }

  const bounds = useMemo(
    () => ({ width: boardWidth, height: boardHeight }),
    [boardWidth, boardHeight],
  )

  const segments = useMemo(() => {
    const boardEdges = [
      { start: { x: 0, y: 0 }, end: { x: boardWidth, y: 0 } },
      { start: { x: boardWidth, y: 0 }, end: { x: boardWidth, y: boardHeight } },
      { start: { x: boardWidth, y: boardHeight }, end: { x: 0, y: boardHeight } },
      { start: { x: 0, y: boardHeight }, end: { x: 0, y: 0 } },
    ]
    return [...boardEdges, ...(wallSegments || [])]
  }, [boardWidth, boardHeight, wallSegments])

  const visibilityPoints = useMemo(() => {
    if (!center) return []
    return computeVisibility(center, radius, segments, bounds)
  }, [center, radius, segments, bounds])

  if (!active) return null

  const gradientRadius = Math.max(boardWidth, boardHeight) * 1.2
  const edgeStop = radius > 0 ? Math.min(0.98, radius / gradientRadius) : 0
  const midStop = Math.min(0.9, Math.max(edgeStop + 0.2, 0.6))

  return (
    <>
      <defs>
        <radialGradient
          id={gradientIdRef.current}
          cx={center?.x ?? 0}
          cy={center?.y ?? 0}
          r={gradientRadius}
          gradientUnits="userSpaceOnUse"
        >
          {edgeStop > 0 ? (
            <>
              <stop offset="0%" stopColor="rgba(210, 40, 40, 0)" />
              <stop offset={`${edgeStop * 100}%`} stopColor="rgba(210, 40, 40, 0)" />
              <stop offset={`${edgeStop * 100}%`} stopColor="rgba(210, 40, 40, 0.35)" />
              <stop offset={`${midStop * 100}%`} stopColor="rgba(210, 40, 40, 0.18)" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="rgba(210, 40, 40, 0.35)" />
              <stop offset="60%" stopColor="rgba(210, 40, 40, 0.18)" />
            </>
          )}
          <stop offset="100%" stopColor="rgba(210, 40, 40, 0)" />
        </radialGradient>
        {center && visibilityPoints.length > 2 ? (
          <clipPath id={clipIdRef.current}>
            <path
              d={`M ${visibilityPoints
                .map((p) => `${p.x} ${p.y}`)
                .join(' ')} Z`}
            />
          </clipPath>
        ) : null}
      </defs>
      <rect
        className="fov-capture"
        x={0}
        y={0}
        width={boardWidth}
        height={boardHeight}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      {center ? (
        <>
          {radius > 0 ? (
            <g clipPath={`url(#${clipIdRef.current})`}>
              {Array.from({
                length: Math.max(
                  0,
                  Math.floor(maxRadiusForOrigin(center) - radius),
                ),
              }).map((_, index) => (
                <circle
                  key={`fov-ring-${index + 1}`}
                  className={
                    (index + 1) % 3 === 0
                      ? 'fov-ring fov-ring-strong'
                      : 'fov-ring'
                  }
                  cx={center.x}
                  cy={center.y}
                  r={radius + index + 1}
                />
              ))}
              <circle
                className="fov-circle"
                cx={center.x}
                cy={center.y}
                r={radius}
              />
            </g>
          ) : null}
          {visibilityPoints.length > 2 ? (
            <path
              className="fov-area"
              d={`M ${visibilityPoints.map((p) => `${p.x} ${p.y}`).join(' ')} Z`}
              fill={`url(#${gradientIdRef.current})`}
            />
          ) : null}
        </>
      ) : null}
    </>
  )
}

export default FieldOfVision
