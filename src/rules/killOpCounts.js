import { getKillteamById } from '../data/ktData.js'

export const toOpTypeId = (unitKey) => {
  if (typeof unitKey !== 'string') return ''
  const lastDashIndex = unitKey.lastIndexOf('-')
  if (lastDashIndex <= 0) return unitKey
  return unitKey.slice(0, lastDashIndex)
}

const isBombSquigOpType = (opTypeId, opTypeName) =>
  opTypeId === 'ORK-KOM-SQUIG' || /\bBOMB\s+SQUIG\b/i.test(String(opTypeName ?? ''))

export const deriveKillOpCount = (killteamId, selectedUnits) => {
  if (!killteamId || !Array.isArray(selectedUnits) || !selectedUnits.length) {
    return null
  }
  const killteam = getKillteamById(killteamId)
  const opTypeById = new Map(
    (killteam?.opTypes ?? []).map((opType) => [opType.opTypeId, opType]),
  )
  const count = selectedUnits.reduce((total, unitKey) => {
    const opTypeId = toOpTypeId(unitKey)
    const opType = opTypeById.get(opTypeId)
    return isBombSquigOpType(opTypeId, opType?.opTypeName) ? total : total + 1
  }, 0)
  if (count < 5 || count > 14) return null
  return count
}

export const deriveDeadCount = (killteamId, deadUnits) => {
  if (!killteamId || !deadUnits || typeof deadUnits !== 'object') return 0
  const killteam = getKillteamById(killteamId)
  const opTypeById = new Map(
    (killteam?.opTypes ?? []).map((opType) => [opType.opTypeId, opType]),
  )
  return Object.entries(deadUnits).reduce((total, [unitKey, isDead]) => {
    if (!isDead) return total
    const opTypeId = toOpTypeId(unitKey)
    const opType = opTypeById.get(opTypeId)
    return isBombSquigOpType(opTypeId, opType?.opTypeName) ? total : total + 1
  }, 0)
}

// Kill op table: for each starting number of enemy operatives (5-14), the kills
// needed to reach kill grades 1-5. (Moved from components/KillOp.jsx.)
export const KILL_OP_GRID = {
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 4, 5, 6],
  7: [1, 3, 4, 6, 7],
  8: [2, 3, 5, 6, 8],
  9: [2, 4, 5, 7, 9],
  10: [2, 4, 6, 8, 10],
  11: [2, 4, 7, 9, 11],
  12: [2, 5, 7, 10, 12],
  13: [3, 5, 8, 10, 13],
  14: [3, 6, 8, 11, 14],
}

// { grade 0-5, nextAt: kills needed for the next grade (null at max) }, or null
// when the starting count is outside the table.
export const killGrade = (startCount, deadCount) => {
  const thresholds = KILL_OP_GRID[startCount]
  if (!thresholds) return null
  const grade = thresholds.filter((needed) => deadCount >= needed).length
  return { grade, nextAt: thresholds[grade] ?? null }
}
