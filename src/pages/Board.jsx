import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import mapsData from '../data/killzoneMaps.json'
import terrainData from '../data/terrain.json'
import terrainPiecesData from '../data/terrainPieces.json'
import critOpsCardsData from '../data/critOpsCards.json'
import CritOpsCard from '../components/CritOpsCard'
import './Board.css'

function Board() {
  const maps = mapsData?.maps ?? []
  const [selectedMapId, setSelectedMapId] = useState(maps[0]?.id || '')
  const activeMap = useMemo(
    () => maps.find((map) => map.id === selectedMapId) || maps[0],
    [maps, selectedMapId],
  )
  const board = mapsData?.meta?.board || { width: 30, height: 22 }
  const grid = mapsData?.renderDefaults?.grid || { enabled: false, cell: 1 }
  const arrangements = terrainData?.arrangements ?? []
  const terrainPieces = terrainPiecesData?.pieces ?? []
  const objectiveDefaultRadius =
    terrainData?.meta?.objective?.defaultRadius ?? 0.5
  const mapArrangements = useMemo(
    () => arrangements.filter((arr) => arr.mapId === activeMap?.id),
    [arrangements, activeMap?.id],
  )
  const critOpsCards = critOpsCardsData?.cards ?? []
  const [arrangementIndex, setArrangementIndex] = useState(0)
  const activeArrangement = mapArrangements[arrangementIndex] || null
  const hasRandomizedMapRef = useRef(false)
  const boardSurfaceRef = useRef(null)
  const boardFrameRef = useRef(null)
  const [selectedCardIndex, setSelectedCardIndex] = useState(0)
  const shouldRotateZones = activeMap?.id === 'map_02'
  const sourceWidth = shouldRotateZones ? board.height : board.width
  const sourceHeight = shouldRotateZones ? board.width : board.height
  const terrainPieceById = useMemo(
    () => new Map(terrainPieces.map((piece) => [piece.id, piece])),
    [terrainPieces],
  )

  const toPercent = (value, max) => `${(value / max) * 100}%`

  const renderZone = (zone, className) => {
    if (!zone) return null
    const rotated = shouldRotateZones
      ? {
          x: (zone.y / sourceHeight) * board.width,
          y: (zone.x / sourceWidth) * board.height,
          w: (zone.h / sourceHeight) * board.width,
          h: (zone.w / sourceWidth) * board.height,
        }
      : zone
    return (
      <div
        className={`board-zone ${className}`}
        style={{
          left: toPercent(rotated.x, board.width),
          bottom: toPercent(rotated.y, board.height),
          width: toPercent(rotated.w, board.width),
          height: toPercent(rotated.h, board.height),
        }}
      />
    )
  }

  useEffect(() => {
    if (!maps.length || hasRandomizedMapRef.current) return
    const randomMap = maps[Math.floor(Math.random() * maps.length)]
    setSelectedMapId(randomMap.id)
    hasRandomizedMapRef.current = true
  }, [maps])

  useEffect(() => {
    if (!mapArrangements.length) {
      setArrangementIndex(0)
      return
    }
    const randomIndex = Math.floor(
      Math.random() * mapArrangements.length,
    )
    setArrangementIndex(randomIndex)
  }, [activeMap?.id, mapArrangements.length])

  useEffect(() => {
    if (!critOpsCards.length) return
    const randomIndex = Math.floor(Math.random() * critOpsCards.length)
    setSelectedCardIndex(randomIndex)
  }, [critOpsCards.length])

  useLayoutEffect(() => {
    const surface = boardSurfaceRef.current
    const frame = boardFrameRef.current
    if (!surface || !frame) return

    const centerBoard = () => {
      const canScrollSurface =
        surface.scrollHeight > surface.clientHeight + 1 ||
        surface.scrollWidth > surface.clientWidth + 1
      if (canScrollSurface) {
        const scrollLeft = Math.max(
          0,
          (surface.scrollWidth - surface.clientWidth) / 2,
        )
        const scrollTop = Math.max(
          0,
          (surface.scrollHeight - surface.clientHeight) / 2,
        )
        surface.scrollTo({
          left: scrollLeft,
          top: scrollTop,
          behavior: 'auto',
        })
        return
      }

      const rect = frame.getBoundingClientRect()
      const targetLeft =
        rect.left + window.scrollX + rect.width / 2 - window.innerWidth / 2
      const targetTop =
        rect.top + window.scrollY + rect.height / 2 - window.innerHeight / 2
      window.scrollTo({ left: targetLeft, top: targetTop, behavior: 'auto' })
    }

    const rafId = requestAnimationFrame(() =>
      requestAnimationFrame(centerBoard),
    )
    const timeoutIds = [
      window.setTimeout(centerBoard, 0),
      window.setTimeout(centerBoard, 150),
      window.setTimeout(centerBoard, 500),
    ]
    const handleResize = () => centerBoard()
    window.addEventListener('resize', handleResize)
    return () => {
      cancelAnimationFrame(rafId)
      timeoutIds.forEach((id) => window.clearTimeout(id))
      window.removeEventListener('resize', handleResize)
    }
  }, [activeMap?.id, arrangementIndex])

  const advanceArrangement = () => {
    if (!mapArrangements.length) return
    setArrangementIndex((prev) => (prev + 1) % mapArrangements.length)
  }

  const transformPoint = ([x, y], placement) => {
    const offsetX = placement?.x || 0
    const offsetY = placement?.y || 0
    const rotation = placement?.rotation || 0
    if (!rotation) return [x + offsetX, y + offsetY]
    const radians = (rotation * Math.PI) / 180
    const cos = Math.cos(radians)
    const sin = Math.sin(radians)
    const rotatedX = x * cos - y * sin
    const rotatedY = x * sin + y * cos
    return [rotatedX + offsetX, rotatedY + offsetY]
  }

  const renderPoints = (points, placement) =>
    points
      .map((point) => {
        const [x, y] = transformPoint(point, placement)
        return `${x},${y}`
      })
      .join(' ')

  const getPieceAreas = (piece) => {
    if (piece?.areas?.length) return piece.areas
    return piece?.area ? [piece.area] : []
  }

  const getPieceLabel = (piece) => {
    const source = piece?.name || piece?.id
    if (!source) return null
    const match = source.match(/volkus_([A-Za-z])$/)
    return match ? match[1].toUpperCase() : null
  }

  const resolveTerrainPiece = (entry) =>
    entry?.pieceId ? terrainPieceById.get(entry.pieceId) : entry

  const getWallClassName = (type) => {
    const normalized = ['heavy', 'light', 'door'].includes(type)
      ? type
      : 'heavy'
    return `board-wall board-wall-${normalized}`
  }

  const getSegmentType = (segment) =>
    Array.isArray(segment?.[0]) ? 'heavy' : segment?.type || 'heavy'

  const selectedCritOpsCard = critOpsCards[selectedCardIndex] || null
  const map1OpClass =
    selectedCritOpsCard?.opNumber === 4
      ? ' is-op-04'
      : selectedCritOpsCard?.opNumber === 5
        ? ' is-op-05'
        : selectedCritOpsCard?.opNumber === 6
          ? ' is-op-06'
          : selectedCritOpsCard?.opNumber === 7
            ? ' is-op-07'
            : selectedCritOpsCard?.opNumber === 8
              ? ' is-op-08'
              : selectedCritOpsCard?.opNumber === 9
                ? ' is-op-09'
                : ''
  const map2OpClass =
    selectedCritOpsCard?.opNumber === 1
      ? ' is-op-01'
      : selectedCritOpsCard?.opNumber === 2
        ? ' is-op-02'
        : selectedCritOpsCard?.opNumber === 3
          ? ' is-op-03'
          : selectedCritOpsCard?.opNumber === 4
            ? ' is-op-04'
            : selectedCritOpsCard?.opNumber === 5
              ? ' is-op-05'
              : selectedCritOpsCard?.opNumber === 6
                ? ' is-op-06'
                : selectedCritOpsCard?.opNumber === 7
                  ? ' is-op-07'
                  : selectedCritOpsCard?.opNumber === 9
                    ? ' is-op-09'
                    : ''

  return (
    <div className="board-view">
      <div className="board-toolbar" />
      <div
        ref={boardSurfaceRef}
        className="board-surface"
        style={{ '--board-width': board.width, '--board-height': board.height }}
      >
        <div ref={boardFrameRef} className="board-frame">
          {grid.enabled ? (
            <div
              className="board-grid"
              style={{ '--grid-cell': grid.cell }}
            />
          ) : null}
          {activeMap ? (
            <>
              {renderZone(activeMap.zones?.playerA?.territory, 'zone-a-territory')}
              {renderZone(activeMap.zones?.playerB?.territory, 'zone-b-territory')}
              {renderZone(activeMap.zones?.playerA?.dropZone, 'zone-a-drop')}
              {renderZone(activeMap.zones?.playerB?.dropZone, 'zone-b-drop')}
            </>
          ) : null}
          <svg
            className="board-overlay"
            viewBox={`0 0 ${board.width} ${board.height}`}
            preserveAspectRatio="none"
          >
            <g transform={`scale(1,-1) translate(0, -${board.height})`}>
              <line
                className="board-centerline"
                x1={board.width / 2}
                y1={0}
                x2={board.width / 2}
                y2={board.height}
              />
              <line
                className="board-centerline"
                x1={0}
                y1={board.height / 2}
                x2={board.width}
                y2={board.height / 2}
              />
              {(activeArrangement?.objectives ?? []).map((objective) => {
                const radius = objective.radius ?? objectiveDefaultRadius
                return (
                  <g key={objective.id} className="board-objective">
                    <circle cx={objective.x} cy={objective.y} r={radius} />
                    <line
                      className="board-objective-slice"
                      x1={objective.x - radius}
                      y1={objective.y}
                      x2={objective.x + radius}
                      y2={objective.y}
                    />
                    <line
                      className="board-objective-slice"
                      x1={objective.x}
                      y1={objective.y - radius}
                      x2={objective.x}
                      y2={objective.y + radius}
                    />
                  </g>
                )
              })}
              {(activeArrangement?.terrain ?? []).map((entry) => {
                const piece = resolveTerrainPiece(entry)
                if (!piece) return null
                const placement = entry.placement
                const label = getPieceLabel(piece)
                const labelPosition = {
                  x: (placement?.x || 0) + 0.1,
                  y: (placement?.y || 0) + 0.45,
                }
                return (
                  <g className="board-terrain" key={entry.id || piece.id}>
                    {getPieceAreas(piece)
                      .filter((area) => area?.points?.length)
                      .map((area, areaIndex) => (
                        <polygon
                          key={`${entry.id || piece.id}-area-${areaIndex}`}
                          className="board-terrain-fill"
                          points={renderPoints(
                            area.points,
                            placement,
                          )}
                        />
                      ))}
                    {label ? (
                      <text
                        className="board-terrain-label"
                        fontSize={0.375}
                        x={labelPosition.x}
                        y={-labelPosition.y}
                        transform="scale(1,-1)"
                      >
                        {label}
                      </text>
                    ) : null}
                  </g>
                )
              })}
              {['light', 'heavy', 'door'].map((wallType) =>
                (activeArrangement?.terrain ?? []).map((entry) => {
                  const piece = resolveTerrainPiece(entry)
                  if (!piece) return null
                  const placement = entry.placement
                  return (piece.walls?.segments ?? []).map(
                    (segment, index) => {
                      const segmentType = getSegmentType(segment)
                      if (segmentType !== wallType) return null
                      const segmentPoints = Array.isArray(segment?.[0])
                        ? segment
                        : segment?.segment
                      if (!Array.isArray(segmentPoints)) return null
                      const [start, end] = segmentPoints
                      const [x1, y1] = transformPoint(start, placement)
                      const [x2, y2] = transformPoint(end, placement)
                      return (
                        <line
                          key={`${entry.id || piece.id}-wall-${wallType}-${index}`}
                          className={getWallClassName(segmentType)}
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                        />
                      )
                    },
                  )
                }),
              )}
            </g>
          </svg>
          {activeMap?.id === 'map_01' && selectedCritOpsCard ? (
            <>
              <div
                className={`board-card-overlay is-bottom-left is-map-01${map1OpClass}`}
              >
                <CritOpsCard card={selectedCritOpsCard} />
              </div>
              <div
                className={`board-card-overlay is-top-right is-map-01${map1OpClass}`}
              >
                <CritOpsCard card={selectedCritOpsCard} />
              </div>
            </>
          ) : activeMap?.id === 'map_02' && selectedCritOpsCard ? (
            <>
              <div
                className={`board-card-overlay is-top-left is-map-02${map2OpClass}`}
              >
                <CritOpsCard card={selectedCritOpsCard} isTwoColumn />
              </div>
              <div
                className={`board-card-overlay is-bottom-right is-map-02${map2OpClass}`}
              >
                <CritOpsCard card={selectedCritOpsCard} isTwoColumn />
              </div>
            </>
          ) : null}
          </div>
      </div>
    </div>
  )
}

export default Board
