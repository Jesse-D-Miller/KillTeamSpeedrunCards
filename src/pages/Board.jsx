import { useMemo, useState } from 'react'
import mapsData from '../data/killzoneMaps.json'
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
  const shouldRotateZones = activeMap?.id === 'map_02'
  const sourceWidth = shouldRotateZones ? board.height : board.width
  const sourceHeight = shouldRotateZones ? board.width : board.height

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

  return (
    <div className="board-view">
      <div className="board-toolbar">
        <div className="board-toggle">
          {maps.map((map) => (
            <button
              key={map.id}
              type="button"
              className={`board-toggle-button${
                map.id === activeMap?.id ? ' is-active' : ''
              }`}
              onClick={() => setSelectedMapId(map.id)}
            >
              {map.name}
            </button>
          ))}
        </div>
      </div>
      <div
        className="board-surface"
        style={{ '--board-width': board.width, '--board-height': board.height }}
      >
        <div className="board-frame">
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
        </div>
      </div>
    </div>
  )
}

export default Board
