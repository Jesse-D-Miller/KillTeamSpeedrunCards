import { getKillteamById } from '../data/ktData.js'

const toOpTypeId = (unitKey) => {
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
