import { useEffect, useRef, useState } from 'react'
import './SightLine.css'

function SightLine({ boardWidth, boardHeight, svgRef, active }) {
  const [sightLine, setSightLine] = useState(() => ({
    x: boardWidth / 2,
    y: boardHeight / 2,
    angle: 0,
    visible: true,
  }))
  const [clickOrigin, setClickOrigin] = useState(null)
  const sightShiftRef = useRef(false)
  const sightActiveKeysRef = useRef(new Set())
  const sightIntervalRef = useRef(null)
  const sightRepeatTimeoutRef = useRef(null)

  useEffect(() => {
    setSightLine((prev) => ({
      ...prev,
      x: Math.min(Math.max(prev.x, 0), boardWidth),
      y: Math.min(Math.max(prev.y, 0), boardHeight),
    }))
  }, [boardHeight, boardWidth])

  useEffect(() => {
    if (!active) return
    const isEditableTarget = (target) => {
      if (!target) return false
      if (target.isContentEditable) return true
      const tagName = target.tagName
      return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT'
    }

    const clamp = (value, min, max) => Math.min(Math.max(value, min), max)
    const moveStep = 0.015625
    const rotateStep = 0.0625
    const repeatDelayMs = 250
    const repeatIntervalMs = 6

    const applyKeys = (keys) => {
      let deltaX = 0
      let deltaY = 0
      let deltaAngle = 0

      if (keys.has('w') || keys.has('W')) deltaY += moveStep
      if (keys.has('s') || keys.has('S')) deltaY -= moveStep
      if (keys.has('a') || keys.has('A')) deltaX -= moveStep
      if (keys.has('d') || keys.has('D')) deltaX += moveStep
      if (keys.has('ArrowLeft') || keys.has('ArrowUp')) deltaAngle += rotateStep
      if (keys.has('ArrowRight') || keys.has('ArrowDown')) deltaAngle -= rotateStep

      if (!deltaX && !deltaY && !deltaAngle) return

      setSightLine((prev) => {
        const nextX = clamp(prev.x + deltaX, 0, boardWidth)
        const nextY = clamp(prev.y + deltaY, 0, boardHeight)
        return {
          ...prev,
          x: nextX,
          y: nextY,
          angle: prev.angle + deltaAngle,
          visible: true,
        }
      })
    }

    const startRepeat = () => {
      if (sightIntervalRef.current) return
      sightIntervalRef.current = window.setInterval(() => {
        if (!sightActiveKeysRef.current.size) return
        applyKeys(sightActiveKeysRef.current)
      }, repeatIntervalMs)
    }

    const startRepeatDelay = () => {
      if (sightRepeatTimeoutRef.current || sightIntervalRef.current) return
      sightRepeatTimeoutRef.current = window.setTimeout(() => {
        sightRepeatTimeoutRef.current = null
        if (!sightActiveKeysRef.current.size) return
        startRepeat()
      }, repeatDelayMs)
    }

    const stopRepeat = () => {
      if (!sightIntervalRef.current) return
      window.clearInterval(sightIntervalRef.current)
      sightIntervalRef.current = null
    }

    const stopRepeatDelay = () => {
      if (!sightRepeatTimeoutRef.current) return
      window.clearTimeout(sightRepeatTimeoutRef.current)
      sightRepeatTimeoutRef.current = null
    }

    const handleKeyDown = (event) => {
      if (event.defaultPrevented || isEditableTarget(event.target)) return
      const isControlKey =
        event.key === 'w' ||
        event.key === 'W' ||
        event.key === 's' ||
        event.key === 'S' ||
        event.key === 'a' ||
        event.key === 'A' ||
        event.key === 'd' ||
        event.key === 'D' ||
        event.key === 'ArrowLeft' ||
        event.key === 'ArrowRight' ||
        event.key === 'ArrowUp' ||
        event.key === 'ArrowDown'

      if (!isControlKey) return
      event.preventDefault()
      event.stopPropagation()

      if (!sightActiveKeysRef.current.has(event.key)) {
        sightActiveKeysRef.current.add(event.key)
        applyKeys(sightActiveKeysRef.current)
      }
      startRepeatDelay()
    }

    const handleKeyUp = (event) => {
      if (sightActiveKeysRef.current.has(event.key)) {
        sightActiveKeysRef.current.delete(event.key)
        if (!sightActiveKeysRef.current.size) {
          stopRepeatDelay()
          stopRepeat()
        }
      }
    }

    const handleBlur = () => {
      sightShiftRef.current = false
      sightActiveKeysRef.current.clear()
      stopRepeatDelay()
      stopRepeat()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
      stopRepeatDelay()
      stopRepeat()
    }
  }, [active, boardHeight, boardWidth])

  useEffect(() => {
    if (!active) {
      setClickOrigin(null)
      return
    }

    setClickOrigin(null)
    setSightLine({
      x: boardWidth / 2,
      y: boardHeight / 2,
      angle: 0,
      visible: true,
    })
  }, [active, boardHeight, boardWidth])

  useEffect(() => {
    if (!active) return
    const handleClear = () => {
      setClickOrigin(null)
      setSightLine({
        x: boardWidth / 2,
        y: boardHeight / 2,
        angle: 0,
        visible: false,
      })
    }

    window.addEventListener('kt-clear-tools', handleClear)
    return () => window.removeEventListener('kt-clear-tools', handleClear)
  }, [active, boardHeight, boardWidth])

  const handleClick = (event) => {
    if (!active) return
    const svg = svgRef?.current
    if (!svg) return
    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return
    const svgPoint = point.matrixTransform(ctm.inverse())
    const nextX = Math.min(Math.max(svgPoint.x, 0), boardWidth)
    const nextY = Math.min(Math.max(boardHeight - svgPoint.y, 0), boardHeight)

    if (!sightLine.visible) {
      setSightLine((prev) => ({ ...prev, visible: true }))
    }

    if (!clickOrigin) {
      setClickOrigin({ x: nextX, y: nextY })
      setSightLine((prev) => ({ ...prev, x: nextX, y: nextY }))
      return
    }

    const deltaX = nextX - clickOrigin.x
    const deltaY = nextY - clickOrigin.y
    const angle = (Math.atan2(deltaY, deltaX) * 180) / Math.PI
    setSightLine((prev) => ({
      ...prev,
      x: clickOrigin.x,
      y: clickOrigin.y,
      angle,
    }))
    setClickOrigin(null)
  }

  if (!active) return null

  const baseX = sightLine.x
  const baseY = sightLine.y
  const computedAngle = sightLine.angle
  const sightLineLength = Math.max(boardWidth, boardHeight) * 1.5
  const sightLineMarkerCount = Math.floor(sightLineLength) + 1
  const showOriginOnly = Boolean(clickOrigin)

  return (
    <>
      <rect
        className="board-sightline-capture"
        x={0}
        y={0}
        width={boardWidth}
        height={boardHeight}
        onClick={handleClick}
      />
      <g
        className="board-sightline"
        transform={`translate(${baseX} ${baseY}) rotate(${computedAngle})`}
      >
        {sightLine.visible ? (
          showOriginOnly ? (
            <g className="board-sightline-origin">
              <line x1={-0.2} y1={-0.2} x2={0.2} y2={0.2} />
              <line x1={-0.2} y1={0.2} x2={0.2} y2={-0.2} />
            </g>
          ) : (
            <>
              {Array.from({ length: sightLineMarkerCount }).map((_, index) => {
                const x = index
                return (
                  <g key={`sightline-marker-${x}`}>
                    <line
                      className="board-sightline-marker"
                      x1={x}
                      y1={-0.1}
                      x2={x}
                      y2={0.1}
                    />
                    {x % 3 === 0 ? (
                      <g
                        transform={`rotate(180) scale(-1 1) translate(${x + 0.12} ${0.22})`}
                      >
                        <text
                          className="board-sightline-label"
                          x={0}
                          y={0}
                          fontSize={0.22}
                        >
                          {x}
                        </text>
                      </g>
                    ) : null}
                  </g>
                )
              })}
              <line x1={0} y1={0} x2={sightLineLength} y2={0} />
            </>
          )
        ) : null}
      </g>
    </>
  )
}

export default SightLine
