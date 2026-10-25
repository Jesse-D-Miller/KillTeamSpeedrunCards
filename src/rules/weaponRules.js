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
      else if ((match = part.match(/^(?:lim|limited)\s*(\d+)$/i))) rules.limited = Number(match[1])
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
// The Stun grenade is an action, not a weapon: a visible target within 6", and it and
// every operative within 1" of it take a stun test.
const STUN_GRENADE = { id: 'grenade-stun', name: 'Stun grenade', profile: '', rules: { range: 6, stunArea: 1, special: [] } }

// The ranged weapon profiles a placed operative can shoot with (its loadout when the
// player picked one), plus the grenades its player took as equipment.
//   -> [{ id, name, profile, rules }]
export const rangedWeaponsFor = (game, token) => {
  const player = game.players?.[token?.seat]
  if (!player || !token?.unitKey) return []
  const killteam = getKillteamById(player.killteamId)
  const opType = (killteam?.opTypes ?? []).find((candidate) => candidate.opTypeId === toOpTypeId(token.unitKey))
  const loadout = player.weapons?.[token.unitKey]
  const weapons = (opType?.weapons ?? [])
    .filter((weapon) => weapon.wepType === 'R')
    .filter((weapon) => !loadout?.length || loadout.includes(weapon.wepId))
    .flatMap((weapon) =>
      (weapon.profiles ?? []).map((profile, index) => ({
        id: profile.wepprofileId ?? `${weapon.wepId}-${index}`,
        name: weapon.wepName,
        profile: weapon.profiles.length > 1 ? profile.profileName : '',
        rules: parseWeaponRules(profile.WR),
      })),
    )
  const grenades = (killteam?.equipments ?? [])
    .filter((item) => GRENADES[item.eqId] && (player.equipment ?? []).includes(item.eqId))
    .flatMap((item) =>
      parseEquipmentWeaponEffects(item.effects).map((weapon) => ({
        id: `grenade-${GRENADES[item.eqId]}`,
        name: weapon.name,
        profile: '',
        rules: parseWeaponRules(weapon.WR),
      })),
    )
  const stun = (player.equipment ?? []).includes('UNIVERSAL-UE-UG-STN') ? [STUN_GRENADE] : []
  return [...weapons, ...grenades, ...stun]
}

export const weaponLabel = (weapon) => (weapon.profile ? `${weapon.name} · ${weapon.profile}` : weapon.name)
