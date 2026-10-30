import { getKillteamById } from '../data/ktData.js'
import { toOpTypeId } from './killOpCounts.js'
import { parseEquipmentWeaponEffects } from './equipment.js'

// Weapon rules as the kill team data writes them in each profile's WR field, e.g.
// 'Rng 8", Prc1', 'Blast 2", Sat', '1" Dev3', 'Hvy(Dash)', 'Tor1"', 'Seek Light',
// 'Sil', '*Poison' (team rules start with *). Parsed into what the Sightline tool
// needs (see docs/kill-team-rules.md, weapon rules).

const inches = (text) => Number.parseFloat(text)

const FLAG_RULES = [
  [/^(?:saturate|sat)$/i, 'saturate'],
  [/^seek light$/i, 'seekLight'],
  [/^seek$/i, 'seek'],
  [/^(?:silent|sil)$/i, 'silent'],
  [/^(?:balanced|bal)$/i, 'balanced'],
  [/^ceaseless$/i, 'ceaseless'],
  [/^relentless$/i, 'relentless'],
  [/^(?:rending|rnd)$/i, 'rending'],
  [/^punishing$/i, 'punishing'],
  [/^(?:severe|sev)$/i, 'severe'],
  [/^brutal$/i, 'brutal'],
  [/^shock$/i, 'shock'],
  [/^stun$/i, 'stun'],
  [/^hot$/i, 'hot'],
]

// -> { range, blast, torrent, devastating: { damage, distance } | null, heavy:
//      'any' | 'dash' | 'reposition' | null, accurate, piercing, piercingCrits, lethal,
//      limited, saturate, seek, seekLight, silent, …other flags, special: [] }
export const parseWeaponRules = (wr) => {
  const rules = { devastating: null, heavy: null, special: [] }
  String(wr ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && part !== '—')
    .forEach((part) => {
      let match
      if (part.startsWith('*')) rules.special.push(part.slice(1).trim())
      else if ((match = part.match(/^(?:rng|range)\s*([\d.]+)"?$/i))) rules.range = inches(match[1])
      else if ((match = part.match(/^blast\s*([\d.]+)"?$/i))) rules.blast = inches(match[1])
      else if ((match = part.match(/^(?:tor|torrent)\s*([\d.]+)"?$/i))) rules.torrent = inches(match[1])
      else if ((match = part.match(/^([\d.]+)"\s*(?:dev|devastating)\s*(\d+)$/i))) {
        rules.devastating = { distance: inches(match[1]), damage: Number(match[2]) }
      } else if ((match = part.match(/^(?:dev|devastating)\s*(\d+)$/i))) {
        rules.devastating = { distance: null, damage: Number(match[1]) }
      } else if ((match = part.match(/^(?:hvy|heavy)\s*(?:\((dash|repos)\w*(?: only)?\))?$/i))) {
        rules.heavy = match[1] ? (match[1].toLowerCase() === 'dash' ? 'dash' : 'reposition') : 'any'
      } else if ((match = part.match(/^(?:prccrit|piercing crits)\s*(\d+)$/i))) rules.piercingCrits = Number(match[1])
      else if ((match = part.match(/^(?:prc|piercing)\s*(\d+)$/i))) rules.piercing = Number(match[1])
      else if ((match = part.match(/^lethal\s*(\d)\+?$/i))) rules.lethal = Number(match[1])
      else if ((match = part.match(/^(?:acc|accurate)\s*(\d+)$/i))) rules.accurate = Number(match[1])
      // A bare "Lim" (e.g. Kommando Dynamite) is once per battle.
      else if ((match = part.match(/^(?:lim|limited)\s*(\d+)?$/i))) rules.limited = Number(match[1] ?? 1)
      else {
        const flag = FLAG_RULES.find(([pattern]) => pattern.test(part))
        if (flag) rules[flag[1]] = true
        else rules.special.push(part)
      }
    })
  return rules
}

// Short chip text for the rules that change the dice (shown under the shooter).
export const weaponRuleChips = (rules) =>
  [
    rules.range ? `RNG ${rules.range}"` : null,
    rules.blast ? `BLAST ${rules.blast}"` : null,
    rules.torrent ? `TORRENT ${rules.torrent}"` : null,
    rules.devastating
      ? `${rules.devastating.distance ? `${rules.devastating.distance}" ` : ''}DEVASTATING ${rules.devastating.damage}`
      : null,
    rules.heavy === 'any' ? 'HEAVY · ONLY IF NOT MOVED' : null,
    rules.heavy === 'dash' ? 'HEAVY · DASH ONLY' : null,
    rules.heavy === 'reposition' ? 'HEAVY · REPOSITION ONLY' : null,
    rules.piercing ? `PIERCING ${rules.piercing}` : null,
    rules.piercingCrits ? `PIERCING CRITS ${rules.piercingCrits}` : null,
    rules.lethal ? `LETHAL ${rules.lethal}+` : null,
    rules.saturate ? 'SATURATE' : null,
    rules.seek ? 'SEEK' : null,
    rules.seekLight ? 'SEEK LIGHT' : null,
    ...['balanced', 'ceaseless', 'relentless', 'rending', 'punishing', 'severe', 'brutal', 'shock', 'stun', 'hot']
      .filter((flag) => rules[flag])
      .map((flag) => flag.toUpperCase()),
    rules.limited ? `LIMITED ${rules.limited}` : null,
    ...rules.special.map((rule) => rule.toUpperCase()),
  ].filter(Boolean)

const GRENADES = {
  'UNIVERSAL-UE-XG-FRAG': 'frag',
  'UNIVERSAL-UE-XG-KRAK': 'krak',
}
const STUN_EQUIPMENT = 'UNIVERSAL-UE-UG-STN'
// The Stun grenade is an action, not a weapon: a visible target within 6", and it and
// every operative within 1" of it take a stun test. No attack dice.
const STUN_GRENADE = {
  id: 'grenade-stun',
  name: 'Stun grenade',
  profile: '',
  atk: null,
  hit: null,
  dmg: null,
  rules: { range: 6, stunArea: 1, devastating: null, heavy: null, special: [] },
  source: 'grenade',
  grenade: 'stun',
}

const statNumber = (text) => {
  const parsed = Number.parseInt(String(text ?? ''), 10)
  return Number.isFinite(parsed) ? parsed : null
}

// '3/5' -> { normal: 3, crit: 5 }
const parseDamage = (text) => {
  const [normal, crit] = String(text ?? '').split('/').map(statNumber)
  return { normal: normal ?? null, crit: crit ?? normal ?? null }
}

const statsOf = ({ ATK, HIT, DMG }) => ({ atk: statNumber(ATK), hit: statNumber(HIT), dmg: parseDamage(DMG) })

export const keywordsOf = (opType) =>
  new Set(
    String(opType?.keywords ?? '')
      .split(',')
      .map((keyword) => keyword.trim().toUpperCase())
      .filter(Boolean),
  )

// Whether a phrase from rules text ("KOMMANDO BOY", "WYRMBLADE NEOPHYTE", "PLAGUE
// MARINE") names this operative: it must be made up entirely of its keywords.
export const matchesKeywords = (phrase, keywords) => {
  const words = String(phrase ?? '').trim().toUpperCase().split(/\s+/).filter(Boolean)
  const covers = (start) =>
    start === words.length ||
    words.some((_, end) => end >= start && keywords.has(words.slice(start, end + 1).join(' ')) && covers(end + 1))
  return words.length > 0 && covers(0)
}

// Equipment that's for some operatives only: "a friendly KOMMANDO operative (excluding
// BOMB SQUIG and GROT)".
const equipmentAllows = (description, keywords) => {
  const text = String(description ?? '')
  const who = text.match(/friendly ([A-Z][A-Z' ]*?[A-Z]) operatives?/)?.[1]
  if (who && !matchesKeywords(who, keywords)) return false
  const excluded = text.match(/\(excluding ([^)]*)\)/i)?.[1] ?? ''
  return !excluded
    .split(/,|\band\b/)
    .map((phrase) => phrase.trim())
    .some((phrase) => phrase && matchesKeywords(phrase, keywords))
}

// "Once per turning point" etc., shown with the weapon.
const usesNote = (description) => {
  const text = String(description ?? '')
  if (/once per turning point/i.test(text)) return 'Once per turning point'
  if (/once per battle/i.test(text)) return 'Once per battle'
  const times = text.match(/more than (once|twice|\w+ times) during the battle/i)?.[1]
  return times ? `Up to ${times === 'once' ? 'once' : times} per battle` : null
}

// The weapons of one type ('R' ranged, 'M' melee) an equipment item adds. Some data
// leaves the ADDWEP rules empty; the description's table still lists them.
const equipmentWeapons = (item, type = 'R') =>
  parseEquipmentWeaponEffects(item.effects)
    .filter((weapon) => weapon.range.toUpperCase() === type)
    .map((weapon) => {
      const tableRules = String(item.description ?? '').match(/\|\*\*Weapon Rules\*\*\|\s*\|([^|]+)\|/i)?.[1]
      return { ...weapon, WR: weapon.WR !== '—' ? weapon.WR : tableRules?.trim() ?? '' }
    })

// "This operative can use frag, krak and stun grenades (see universal equipment)...
// improve the Hit stat of that weapon by 1": which grenades, and whether Hit improves.
export const grenadierOf = (opType) => {
  const grenades = new Set()
  let hitBonus = 0
  ;(opType?.abilities ?? []).forEach((ability) => {
    const text = String(ability.description ?? '')
    const names = text.match(/can use ([a-z ,]+?) grenades/i)?.[1]
    if (names) {
      names
        .split(/,|\band\b/i)
        .map((name) => name.trim().toLowerCase())
        .filter(Boolean)
        .forEach((name) => grenades.add(name))
      if (/improve the hit stat/i.test(text)) hitBonus = 1
    }
    if (/perform the Stun Grenade action/i.test(text) || /^stun grenade$/i.test(ability.abilityName ?? '')) {
      grenades.add('stun')
    }
  })
  return { grenades, hitBonus }
}

// The ranged weapon profiles a placed operative can shoot with (its loadout when the
// player picked one), then weapons from equipment its player took, then grenades
// (from equipment, or from its own abilities such as Grenadier).
//   -> [{ id, name, profile, atk, hit, dmg: { normal, crit }, rules,
//         source: 'datacard' | 'equipment' | 'grenade', grenade?, grenadier?, uses? }]
export const rangedWeaponsFor = (game, token) => {
  const player = game.players?.[token?.seat]
  if (!player || !token?.unitKey) return []
  const killteam = getKillteamById(player.killteamId)
  const opType = (killteam?.opTypes ?? []).find((candidate) => candidate.opTypeId === toOpTypeId(token.unitKey))
  const keywords = keywordsOf(opType)
  const taken = new Set(player.equipment ?? [])
  const loadout = player.weapons?.[token.unitKey]
  const weapons = (opType?.weapons ?? [])
    .filter((weapon) => weapon.wepType === 'R')
    .filter((weapon) => !loadout?.length || loadout.includes(weapon.wepId))
    .flatMap((weapon) =>
      (weapon.profiles ?? []).map((profile, index) => ({
        id: profile.wepprofileId ?? `${weapon.wepId}-${index}`,
        name: String(weapon.wepName ?? '').trim(),
        profile: weapon.profiles.length > 1 ? profile.profileName : '',
        ...statsOf(profile),
        rules: parseWeaponRules(profile.WR),
        source: 'datacard',
      })),
    )
  const equipment = (killteam?.equipments ?? [])
    .filter((item) => item.killteamId && taken.has(item.eqId) && equipmentAllows(item.description, keywords))
    .flatMap((item) =>
      equipmentWeapons(item).map((weapon, index) => ({
        id: `${item.eqId}-${index}`,
        name: weapon.name,
        profile: '',
        ...statsOf(weapon),
        rules: parseWeaponRules(weapon.WR),
        source: 'equipment',
        uses: usesNote(item.description),
      })),
    )
  const grenadier = grenadierOf(opType)
  const grenades = (killteam?.equipments ?? []).flatMap((item) => {
    const universal = GRENADES[item.eqId]
    return equipmentWeapons(item)
      .map((weapon) => ({ weapon, kind: universal ?? weapon.name.replace(/\s*grenades?$/i, '').toLowerCase() }))
      .filter(({ kind }) => grenadier.grenades.has(kind) || (universal && taken.has(item.eqId)))
      .map(({ weapon, kind }) => ({
        id: `grenade-${kind}`,
        name: weapon.name,
        profile: '',
        ...statsOf(weapon),
        rules: parseWeaponRules(weapon.WR),
        source: 'grenade',
        grenade: kind,
        // Grenadier: using it doesn't count towards limits, and may improve Hit.
        grenadier: grenadier.grenades.has(kind) ? { hitBonus: grenadier.hitBonus } : null,
      }))
  })
  const stun = taken.has(STUN_EQUIPMENT) || grenadier.grenades.has('stun') ? [STUN_GRENADE] : []
  // A grenade already on the datacard (e.g. a Plague Marine Bombardier's blight
  // grenade) stays as printed; a Grenadier's copy of a faction grenade replaces the
  // equipment one.
  const datacardNames = new Set(weapons.map((weapon) => weapon.name))
  const ownGrenades = grenades.filter((weapon) => !datacardNames.has(weapon.name))
  const grenadeNames = new Set(ownGrenades.map((weapon) => weapon.name))
  return [...weapons, ...equipment.filter((weapon) => !grenadeNames.has(weapon.name)), ...ownGrenades, ...stun].filter(
    (weapon, index, list) => list.findIndex((other) => other.id === weapon.id) === index,
  )
}

// The melee weapons a placed operative can fight or retaliate with: its datacard (by
// loadout), then melee weapons from equipment its player took (e.g. Kommando Choppas,
// Yaegir Plasma Knives). An operative that already has that weapon on its datacard
// uses the better, datacard version.
//   -> [{ id, name, profile, atk, hit, dmg, rules, source: 'datacard' | 'equipment' }]
export const meleeWeaponsFor = (game, token) => {
  const player = game.players?.[token?.seat]
  if (!player || !token?.unitKey) return []
  const killteam = getKillteamById(player.killteamId)
  const opType = (killteam?.opTypes ?? []).find((candidate) => candidate.opTypeId === toOpTypeId(token.unitKey))
  const keywords = keywordsOf(opType)
  const taken = new Set(player.equipment ?? [])
  const loadout = player.weapons?.[token.unitKey]
  const weapons = (opType?.weapons ?? [])
    .filter((weapon) => weapon.wepType === 'M')
    .filter((weapon) => !loadout?.length || loadout.includes(weapon.wepId))
    .flatMap((weapon) =>
      (weapon.profiles ?? []).map((profile, index) => ({
        id: profile.wepprofileId ?? `${weapon.wepId}-${index}`,
        name: String(weapon.wepName ?? '').trim(),
        profile: weapon.profiles.length > 1 ? profile.profileName : '',
        ...statsOf(profile),
        rules: parseWeaponRules(profile.WR),
        source: 'datacard',
      })),
    )
  const own = new Set(weapons.map((weapon) => weapon.name.toLowerCase()))
  const equipment = (killteam?.equipments ?? [])
    .filter((item) => item.killteamId && taken.has(item.eqId) && equipmentAllows(item.description, keywords))
    .flatMap((item) =>
      equipmentWeapons(item, 'M').map((weapon, index) => ({
        id: `${item.eqId}-${index}`,
        name: weapon.name,
        profile: '',
        ...statsOf(weapon),
        rules: parseWeaponRules(weapon.WR),
        source: 'equipment',
        eqId: item.eqId,
      })),
    )
    .filter((weapon) => !own.has(weapon.name.toLowerCase()))
  return [...weapons, ...equipment]
}

export const weaponLabel = (weapon) => (weapon.profile ? `${weapon.name} · ${weapon.profile}` : weapon.name)
