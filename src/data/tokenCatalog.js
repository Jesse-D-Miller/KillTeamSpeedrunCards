import { getKillteamById } from './ktData.js'
import factionTokens from './factionTokens.json'
import { getTacOp } from './tacOps.js'

// Standard tokens for the iPad's Token tool, grouped the way the rules use them.
// In Kill Team a marker sits on the killzone and a token sits on an operative, so
// kind 'token' entries attach to an operative when dropped on one.
//   { id, name, short (shown on the disc), kind: 'marker' | 'token' | 'base', ring? }
// kind 'base' is a blank operative-sized base rather than a marker.

// Core rules: objective markers are 40mm across, all other markers 20mm. Tokens
// have no official size; ours are small enough to sit beside a base.
export const MARKER_RADIUS_IN = 20 / 25.4 / 2
export const TOKEN_RADIUS_IN = 0.22
export const OBJECTIVE_RADIUS_IN = 40 / 25.4 / 2
// Sizes a marker or token disc can be set to (diameter, mm). Operative bases use
// BASE_SIZES_MM (shared/game.js).
export const MARKER_SIZES_MM = [10, 15, 20, 25, 28.5, 32, 40, 50, 60]

const marker = (id, name, short, extra = {}) => ({ id, name, short, kind: 'marker', ...extra })
const token = (id, name, short, extra = {}) => ({ id, name, short, kind: 'token', ...extra })

// Universal equipment; eqIds link back to what the player took at muster.
const EQUIPMENT = [
  marker('ammo-cache', 'Ammo Cache', 'AMMO', { eqIds: ['UNIVERSAL-UE-AC'] }),
  marker('comms-device', 'Comms Device', 'COMM', { eqIds: ['UNIVERSAL-UE-CD'] }),
  // Triggers when within an operative's control range (1").
  marker('mines', 'Mines', 'MINE', { eqIds: ['UNIVERSAL-UE-MN'], ring: 1 }),
  // Smoke spreads 1" horizontally from the marker.
  marker('smoke-grenade', 'Smoke Grenade', 'SMK', { eqIds: ['UNIVERSAL-UE-UG-SMK'], ring: 1 }),
  marker('portable-barricade', 'Portable Barricade', 'PB', { eqIds: ['UNIVERSAL-UE-PB'] }),
  marker('light-barricade', 'Light Barricade', 'LB', { eqIds: ['UNIVERSAL-UE-LB'] }),
  marker('heavy-barricade', 'Heavy Barricade', 'HB', { eqIds: ['UNIVERSAL-UE-HB'] }),
  marker('ladder', 'Ladder', 'LAD', { eqIds: ['UNIVERSAL-UE-LAD'] }),
  marker('razor-wire', 'Razor Wire', 'WIRE', { eqIds: ['UNIVERSAL-UE-RW'] }),
  marker('breach', 'Breach', 'BRCH', { eqIds: ['UNIVERSAL-UE-BC'] }),
  // Grenade tokens track how many of each grenade the kill team has left.
  token('frag-grenade', 'Frag grenade', 'FRAG', { eqIds: ['UNIVERSAL-UE-XG-FRAG'] }),
  token('krak-grenade', 'Krak grenade', 'KRAK', { eqIds: ['UNIVERSAL-UE-XG-KRAK'] }),
  token('stun-grenade', 'Stun grenade', 'STUN', { eqIds: ['UNIVERSAL-UE-UG-STN'] }),
]

// Mission markers for every crit op, then the states each crit op tracks on its objectives.
const MISSION_COMMON = [
  marker('objective', 'Objective', 'OBJ', { radius: OBJECTIVE_RADIUS_IN }),
  marker('pick-up', 'Pick Up', 'PICK'),
]
// Approved Ops 2025: the tokens each crit op uses to track its objective markers.
const CRIT_OP_TOKENS = {
  crit_ops_01: [marker('secured', 'Secured', 'SEC')],
  crit_ops_02: [marker('looted', 'Looted', 'LOOT')],
  crit_ops_03: [marker('transmitting', 'Transmitting', 'TX')],
  crit_ops_04: [marker('orb', 'Orb', 'ORB')],
  crit_ops_05: [marker('stake-claim', 'Stake Claim', 'CLM')],
  crit_ops_06: [],
  crit_ops_07: [marker('downloaded', 'Downloaded', 'DL')],
  crit_ops_08: [marker('data-point', 'Data point', 'DATA')],
  crit_ops_09: [
    marker('objective-1', 'Objective 1', '1'),
    marker('objective-2', 'Objective 2', '2'),
    marker('objective-3', 'Objective 3', '3'),
    marker('inert', 'Inert', 'INRT'),
  ],
}

// The core rules' status tokens. APL can change by at most 1 either way.
// Guard is only used in close quarters killzones (Gallowdark, Tomb World).
const OPERATIVE = [
  token('apl-minus', 'APL −1', '−1'),
  token('apl-plus', 'APL +1', '+1'),
  token('guard', 'Guard', 'GRD'),
]

const GENERAL = [
  { id: 'blank-base', name: 'Blank base', short: '', kind: 'base' },
  marker('marker', 'Marker', ''),
  token('counter', 'Counter', '#'),
]

export const radiusFor = (entry) =>
  entry.radius ?? (entry.kind === 'token' ? TOKEN_RADIUS_IN : MARKER_RADIUS_IN)

export const factionTokensFor = (killteamId) => factionTokens[killteamId] ?? []

// The Token tool's categories for this player: [{ id, name, entries }].
export const categoriesFor = (game, seat) => {
  const player = game.players?.[seat]
  const chosen = new Set(player?.equipment ?? [])
  const isChosen = (entry) => (entry.eqIds ?? []).some((eqId) => chosen.has(eqId))
  const equipment = [
    ...EQUIPMENT.filter(isChosen).map((entry) => ({ ...entry, chosen: true })),
    ...EQUIPMENT.filter((entry) => !isChosen(entry)),
  ]
  const killteam = getKillteamById(player?.killteamId)
  // Your own (secret) tac op's markers and tokens, once you've picked one.
  const tacOp = getTacOp(player?.tacOp?.id)
  const tacOpCategory = tacOp?.tokens.length
    ? [{ id: 'tacop', name: `Tac op · ${tacOp.name}`, entries: tacOp.tokens.map((entry) => ({ ...entry, id: `tacop-${entry.id}` })) }]
    : []
  return [
    { id: 'mission', name: 'Mission', entries: [...MISSION_COMMON, ...(CRIT_OP_TOKENS[game.table?.critOpId] ?? [])] },
    { id: 'equipment', name: 'Equipment', entries: equipment },
    { id: 'faction', name: killteam?.killteamName ?? 'Faction', entries: factionTokensFor(player?.killteamId) },
    ...tacOpCategory,
    { id: 'operative', name: 'Operative', entries: OPERATIVE },
    { id: 'general', name: 'General', entries: GENERAL },
  ]
}
