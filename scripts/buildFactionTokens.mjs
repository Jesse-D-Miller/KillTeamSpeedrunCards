// Builds src/data/factionTokens.json: each kill team's own markers and tokens, found
// by scanning its equipment, ploys and abilities for "X marker" / "X token".
// Run with `node scripts/buildFactionTokens.mjs`, then review the output by hand.
import { readFileSync, writeFileSync } from 'node:fs'

const killteams = JSON.parse(readFileSync(new URL('../src/data/kt24_v4.json', import.meta.url)))

// Universal equipment and mission markers live in their own categories.
const UNIVERSAL = new Set([
  'Ammo Cache',
  'Comms Device',
  'Smoke Grenade',
  'Mines',
  'Mine',
  'Objective',
  'Pick Up',
  'Breach',
  'Utility Grenade',
])
// Words that start a match but aren't part of a name ("Your Tunnel marker").
const LEADING = /^(?:A|An|The|That|This|Your|Each|One|Its|Their|Friendly|Enemy|Another|Any|Same|Every|Remove|Place|Set|Then|If|When|Whenever)\s+/i
const SKIP = /^(?:A|An|The|That|This|Your|Each|One|It|Its|Same|Other|Every|Any)$/i

const titleCase = (text) =>
  text
    .toLowerCase()
    .split(/(\s|-)/)
    .map((part) => (part.length > 1 ? part[0].toUpperCase() + part.slice(1) : part))
    .join('')

const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

const shortFor = (name) => {
  const words = name.replace(/[^A-Za-z\s-]/g, '').split(/[\s-]+/).filter(Boolean)
  if (words.length === 1) return words[0].slice(0, 4).toUpperCase()
  return words
    .map((word) => word[0])
    .join('')
    .slice(0, 4)
    .toUpperCase()
}

const PATTERN = /((?:[A-Z][\w'’-]*\s){1,3})(marker|token)s?\b/g

const result = {}
for (const killteam of killteams) {
  const texts = [
    ...killteam.equipments.map((item) => item.description),
    ...killteam.ploys.map((ploy) => ploy.description),
    ...killteam.opTypes.flatMap((opType) => (opType.abilities ?? []).map((ability) => ability.description)),
  ]
  const found = new Map()
  for (const text of texts) {
    for (const match of String(text ?? '').matchAll(PATTERN)) {
      let name = match[1].trim()
      while (LEADING.test(name)) name = name.replace(LEADING, '')
      name = titleCase(name.replace(/’/g, "'"))
      if (!name || SKIP.test(name) || UNIVERSAL.has(name)) continue
      const kind = match[2]
      const id = `${slug(killteam.killteamId)}-${slug(name)}`
      if (!found.has(id)) found.set(id, { id, name, short: shortFor(name), kind })
    }
  }
  result[killteam.killteamId] = [...found.values()]
}

writeFileSync(new URL('../src/data/factionTokens.json', import.meta.url), `${JSON.stringify(result, null, 2)}\n`)
console.log(
  Object.entries(result)
    .map(([id, tokens]) => `${id}: ${tokens.map((token) => `${token.name} (${token.kind[0]}, ${token.short})`).join(', ')}`)
    .join('\n'),
)
