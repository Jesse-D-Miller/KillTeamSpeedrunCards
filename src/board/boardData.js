import mapsData from '../data/killzoneMaps.json'
import terrainData from '../data/terrain.json'
import terrainPiecesData from '../data/terrainPieces.json'
import critOpsData from '../data/critOpsCards.json'
import { buildTerrain, resolveZoneRect, zoneEdge } from '../../shared/geometry.js'

export const BOARD = mapsData?.meta?.board ?? { width: 30, height: 22 }

export const MAPS = mapsData?.maps ?? []
export const ARRANGEMENTS = terrainData?.arrangements ?? []
export const CRIT_OPS = critOpsData?.cards ?? []

const pieceById = new Map((terrainPiecesData?.pieces ?? []).map((piece) => [piece.id, piece]))
const terrainCache = new Map()

export const arrangementsForMap = (mapId) => ARRANGEMENTS.filter((arrangement) => arrangement.mapId === mapId)

export const getCritOp = (critOpId) => CRIT_OPS.find((card) => card.id === critOpId) ?? null

// Everything needed to draw one killzone layout, memoized per arrangement.
export const getLayout = (mapId, arrangementId) => {
  const map = MAPS.find((candidate) => candidate.id === mapId) ?? MAPS[0]
  const arrangement =
    ARRANGEMENTS.find((candidate) => candidate.id === arrangementId && candidate.mapId === map.id) ??
    arrangementsForMap(map.id)[0] ??
    null
  const cacheKey = `${map.id}:${arrangement?.id}`
  if (!terrainCache.has(cacheKey)) {
    const zones = {}
    ;['A', 'B'].forEach((zone) => {
      const source = map.zones?.[`player${zone}`] ?? {}
      const drop = resolveZoneRect(source.dropZone, map.id)
      zones[zone] = {
        drop,
        territory: resolveZoneRect(source.territory, map.id),
        edge: zoneEdge(drop, BOARD),
      }
    })
    terrainCache.set(cacheKey, {
      map,
      arrangement,
      zones,
      objectives: arrangement?.objectives ?? [],
      ...buildTerrain(arrangement, pieceById),
    })
  }
  return terrainCache.get(cacheKey)
}

// Board y is up; SVG y is down.
export const toSvgY = (y) => BOARD.height - y
