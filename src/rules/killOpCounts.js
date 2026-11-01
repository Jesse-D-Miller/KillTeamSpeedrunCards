import { getKillteamById } from '../data/ktData.js'

export const toOpTypeId = (unitKey) => {
  if (typeof unitKey !== 'string') return ''
  const lastDashIndex = unitKey.lastIndexOf('-')
  if (lastDashIndex <= 0) return unitKey
  return unitKey.slice(0, lastDashIndex)
}

// Some operatives don't count for the opponent's kill op ("This operative is ignored
// for your opponent's kill/elimination op": Bomb Squigs, Navis C.A.T. Units, drones,
// the Spectre Vox-Relay Beacon...). Read from each datacard's rules.
const IGNORED = /ignored for (?:your )?opponent['’]s kill/i
export const ignoredForKillOp = (opType) => (opType?.abilities ?? []).some((ability) => IGNORED.test(ability.description ?? ''))

// A team rule can fix the starting number the opponent uses (the Hierotek Chronomancer:
// "treats your starting number of HIEROTEK CIRCLE operatives as 5").
const STARTING_AS = /treats your starting number of [A-Z' -]+ operatives as (\d+)/
const startingNumberRule = (killteam) => {
  for (const opType of killteam?.opTypes ?? []) {
    for (const ability of opType.abilities ?? []) {
      const match = String(ability.description ?? '').match(STARTING_AS)
      if (match) return Number(match[1])
    }
  }
  return null
}

const countingOpTypes = (killteamId) => {
  const killteam = getKillteamById(killteamId)
  const opTypeById = new Map((killteam?.opTypes ?? []).map((opType) => [opType.opTypeId, opType]))
  return { killteam, counts: (unitKey) => !ignoredForKillOp(opTypeById.get(toOpTypeId(unitKey))) }
}

// The opponent's starting number of operatives for the kill op table (5-14), or null.
export const deriveKillOpCount = (killteamId, selectedUnits) => {
  if (!killteamId || !Array.isArray(selectedUnits) || !selectedUnits.length) {
    return null
  }
  const { killteam, counts } = countingOpTypes(killteamId)
  const fixed = startingNumberRule(killteam)
  if (fixed) return fixed
  const count = selectedUnits.filter(counts).length
  if (count < 5 || count > 14) return null
  return count
}

// How many of a team's incapacitated operatives count as kills.
export const deriveDeadCount = (killteamId, deadUnits) => {
  if (!killteamId || !deadUnits || typeof deadUnits !== 'object') return 0
  const { counts } = countingOpTypes(killteamId)
  return Object.entries(deadUnits).filter(([unitKey, isDead]) => isDead && counts(unitKey)).length
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
