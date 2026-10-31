// Moved from pages/Game.jsx: roster expansion rules.

const normalizeText = (value) =>
  value
    ? value
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, ' ')
        .trim()
    : ''

// Which operatives can be taken more than once, by keyword. Worded several ways:
// "Other than TROOPER operatives(,) your kill team / killteam can only include each
// operative (on this list | above) once", "each option", or with no exceptions (then
// none repeat: []). With no such sentence at all, any can repeat (null).
const parseRepeatableKeywords = (composition) => {
  const text = String(composition ?? '')
  const match = text.match(
    /Other than ([^.]+?) operatives?,? your kill ?team can only include each (?:operative|option)[^.]*?\bonce/i,
  )
  if (!match) return /can only include each (?:operative|option)[^.]*?\bonce/i.test(text) ? [] : null
  return match[1]
    .split(/,| and /i)
    .map((value) => normalizeText(value))
    .filter(Boolean)
}

const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 }

// "Your kill team can only include up to two PURGATUS operatives": keyword -> cap.
const parseCaps = (composition) =>
  [...String(composition ?? '').matchAll(/up to (one|two|three|four|five|six|\d+) ([A-Z][A-Z' -]*?[A-Z]) operatives?/g)].map(
    ([, count, keyword]) => ({ keyword: normalizeText(keyword), count: NUMBER_WORDS[count.toLowerCase()] ?? Number(count) }),
  )

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

// A list entry names an operative without its team ("- TROOPER", "- GUNNER with
// meltagun and gun butt"), so it's matched on the operative's short name as well as its
// full one; the longest match wins, so "STUB-GUNNER" isn't read as "GUNNER".
const entryOperative = (line, lookup) => {
  const entry = normalizeText(line)
  const names = (opType) => [opType.normalized, opType.short]
  return lookup
    .flatMap((opType) => names(opType).map((name) => ({ opType, name })))
    .filter(({ name }) => name && (entry === name || entry.startsWith(`${name} `) || entry.includes(` ${name} `)))
    .sort((a, b) => b.name.length - a.name.length)[0]?.opType
}

const buildUnitCounts = (killteam, operatives) => {
  const composition = killteam?.composition ?? ''
  if (!composition || operatives.length === 0) return new Map()

  const repeatableKeywords = parseRepeatableKeywords(composition)
  const caps = parseCaps(composition)
  const shortNames = shortNamesFor(killteam)
  const opTypeLookup = operatives.map((opType) => ({
    name: opType.opTypeName,
    normalized: normalizeText(opType.opTypeName),
    short: normalizeText(shortNames.get(opType.opTypeId)),
    keywords: String(opType.keywords ?? '').split(',').map(normalizeText),
  }))

  const lines = composition
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const counts = new Map()
  let currentGroupCount = null
  // Operative -> how many list entries name it (one per weapon option, e.g. Gunners).
  let currentGroupUnits = new Map()

  const applyGroup = () => {
    if (!currentGroupCount || currentGroupUnits.size === 0) return
    currentGroupUnits.forEach((entries, opType) => {
      // "Other than TROOPER operatives, ... only once": operatives with that keyword (or
      // that name) repeat freely; the rest once per list entry naming them.
      const named = (keyword) => keyword === opType.short || opType.keywords.includes(keyword)
      const isRepeatable = repeatableKeywords ? repeatableKeywords.some(named) : true
      const cap = caps.find(({ keyword }) => named(keyword))?.count ?? Infinity
      const count = Math.min(isRepeatable ? currentGroupCount : entries, currentGroupCount, cap)
      const previous = counts.get(opType.name) ?? 1
      counts.set(opType.name, Math.max(previous, count))
    })
  }

  lines.forEach((line) => {
    const groupMatch = line.match(
      /^-\s*(\d+)\s+.*operatives selected from the following list:/i,
    )
    if (groupMatch) {
      applyGroup()
      currentGroupCount = Number.parseInt(groupMatch[1], 10)
      currentGroupUnits = new Map()
      return
    }

    if (currentGroupCount && line.startsWith('-')) {
      const matched = entryOperative(line.replace(/^-\s*/, '').replace(/\*+$/, ''), opTypeLookup)
      if (matched) {
        currentGroupUnits.set(matched, (currentGroupUnits.get(matched) ?? 0) + 1)
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
