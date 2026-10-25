// Moved from pages/Game.jsx: roster expansion rules.

const normalizeText = (value) =>
  value
    ? value
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, ' ')
        .trim()
    : ''

const parseRepeatableKeywords = (composition) => {
  if (!composition) return []
  const match = composition.match(
    /Other than ([^.]+?) operatives?, your kill team can only include each operative on this list once/i,
  )
  if (!match) return []
  return match[1]
    .split(/,| and /i)
    .map((value) => normalizeText(value))
    .filter(Boolean)
}

const UNIT_COUNT_OVERRIDES = {
  'VOT-HKY': {
    'VOT-HKY-WAR': 3,
  },
  'TAU-VESP': {
    'TAU-VESP-WAR': 5,
  },
  'ORK-KOM': {
    'ORK-KOM-BOY': 2,
  },
  'IMP-INB': {
    'IMP-INB-GNR': 2,
  },
}

const buildUnitCounts = (killteam, operatives) => {
  const composition = killteam?.composition ?? ''
  if (!composition || operatives.length === 0) return new Map()

  const repeatableKeywords = parseRepeatableKeywords(composition)
  const opTypeLookup = operatives.map((opType) => ({
    name: opType.opTypeName,
    normalized: normalizeText(opType.opTypeName),
  }))

  const lines = composition
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const counts = new Map()
  let currentGroupCount = null
  let currentGroupUnits = new Set()

  const applyGroup = () => {
    if (!currentGroupCount || currentGroupUnits.size === 0) return
    currentGroupUnits.forEach((name) => {
      const normalizedName = normalizeText(name)
      const isRepeatable = repeatableKeywords.length
        ? repeatableKeywords.some((keyword) => normalizedName.includes(keyword))
        : true
      const count = isRepeatable ? currentGroupCount : 1
      const previous = counts.get(name) ?? 1
      counts.set(name, Math.max(previous, count))
    })
  }

  lines.forEach((line) => {
    const groupMatch = line.match(
      /^-\s*(\d+)\s+.*operatives selected from the following list:/i,
    )
    if (groupMatch) {
      applyGroup()
      currentGroupCount = Number.parseInt(groupMatch[1], 10)
      currentGroupUnits = new Set()
      return
    }

    if (currentGroupCount && line.startsWith('-')) {
      const normalizedLine = normalizeText(line)
      const matched = opTypeLookup.find((opType) =>
        normalizedLine.includes(opType.normalized),
      )
      if (matched) {
        currentGroupUnits.add(matched.name)
      }
    }
  })

  applyGroup()
  const overrides = UNIT_COUNT_OVERRIDES[killteam?.killteamId] ?? {}
  operatives.forEach((opType) => {
    if (overrides[opType.opTypeId]) {
      counts.set(opType.opTypeName, overrides[opType.opTypeId])
    }
  })

  return counts
}

export { buildUnitCounts }

export const unitKeyFor = (opType, instance) => `${opType.opTypeId}-${instance ?? 0}`

export const weaponKeyFor = (weapon, index) => weapon.wepId ?? `${weapon.wepName ?? 'weapon'}-${index}`

// Every selectable operative instance for a kill team, in roster order.
export const expandUnits = (killteam) => {
  if (!killteam) return []
  const operatives = (killteam.opTypes ?? []).filter((opType) => opType.isOpType)
  const counts = buildUnitCounts(killteam, operatives)
  return operatives
    .flatMap((opType) => {
      const count = counts.get(opType.opTypeName) ?? 1
      return Array.from({ length: count }, (_, index) => ({
        opType,
        instance: count > 1 ? index + 1 : null,
        instanceCount: count,
      }))
    })
    .map((unit, index) => ({ ...unit, key: unitKeyFor(unit.opType, unit.instance), index }))
}

export const maxWoundsFor = (opType) => {
  const parsed = Number.parseInt(opType?.WOUNDS, 10)
  return Number.isNaN(parsed) ? 0 : parsed
}

export const unitDisplayName = (unit) =>
  unit.instance ? `${unit.opType.opTypeName} ${unit.instance}` : unit.opType.opTypeName

// ---- short names for board tokens ("Kommando Boss Nob" -> "Boss Nob") ----

// Spelling variants in the data ("Yaegir", "Yeagir", "Yeaegir") share a skeleton.
const wordSkeleton = (word) => word.toLowerCase().replace(/[^a-z]/g, '').replace(/[aeiou]/g, '')

const SHARED_WORD_SHARE = 0.6

// Repeatedly drop the leading word that most of the team's operatives share
// (trailing words like "Boy" or "Servitor" carry meaning, so they stay).
const stripSharedPrefix = (names) => {
  let words = names.map((name) => name.split(/\s+/))
  for (;;) {
    const counts = new Map()
    words.forEach((parts) => {
      if (parts.length < 2) return
      const key = wordSkeleton(parts[0])
      counts.set(key, (counts.get(key) ?? 0) + 1)
    })
    const [key, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? []
    if (!key || count < words.length * SHARED_WORD_SHARE) break
    words = words.map((parts) => (parts.length > 1 && wordSkeleton(parts[0]) === key ? parts.slice(1) : parts))
  }
  return words.map((parts) => parts.join(' '))
}

const shortNameCache = new Map()

// opTypeId -> short name for one kill team. Falls back to the full name wherever
// shortening would make two operatives look the same.
const shortNamesFor = (killteam) => {
  if (!killteam) return new Map()
  if (shortNameCache.has(killteam.killteamId)) return shortNameCache.get(killteam.killteamId)
  const operatives = (killteam.opTypes ?? []).filter((opType) => opType.isOpType)
  const full = operatives.map((opType) => opType.opTypeName)
  const short = stripSharedPrefix(full)
  const counts = short.reduce((map, name) => map.set(name, (map.get(name) ?? 0) + 1), new Map())
  const names = new Map(
    operatives.map((opType, index) => [opType.opTypeId, counts.get(short[index]) > 1 ? full[index] : short[index]]),
  )
  shortNameCache.set(killteam.killteamId, names)
  return names
}

export const tokenLabelFor = (killteam, unit) => {
  const name = shortNamesFor(killteam).get(unit.opType.opTypeId) ?? unit.opType.opTypeName
  return unit.instance ? `${name} ${unit.instance}` : name
}

export const factionEquipmentIds = (killteam) =>
  (killteam?.equipments ?? [])
    .filter((equipment) => equipment.killteamId === killteam.killteamId)
    .map((equipment) => equipment.eqId)

// Hernkyn Yaegirs field every operative; other teams start empty.
export const defaultUnitKeys = (killteam) =>
  killteam?.killteamId === 'VOT-HKY' ? expandUnits(killteam).map((unit) => unit.key) : []
