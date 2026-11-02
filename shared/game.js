// Shared game model. Pure data + helpers, imported by both the Node server and the React client.

export const SEATS = ['A', 'B']

// lobby   - devices join, players name themselves
// setup   - kill teams, killzone, crit op, initiative roll-off, drop zones
// muster  - private: operatives, weapons, equipment, tac op
// deploy  - place equipment + operatives (Approved Ops 2025 has no scouting step)
// battle  - turning points 1-4; the primary op is a secret gambit in TP1
// results - scores + reveal
export const PHASES = ['lobby', 'setup', 'muster', 'deploy', 'battle', 'results']

export const MAX_TP = 4

// How far a finished move can be nudged (inches from where it ended), keeping its length.
export const MOVE_ADJUST_REACH = 1

// Operative bases are round, in mm (oval bases use their long axis).
export const DEFAULT_BASE_MM = 32
export const BASE_SIZES_MM = [25, 28.5, 32, 40, 50, 60]
export const baseRadiusIn = (mm) => (mm || DEFAULT_BASE_MM) / 25.4 / 2
export const tokenRadiusIn = (token) => baseRadiusIn(token?.baseMm)
// Approved Ops: each player starts with 2CP, then gains 1CP in the Ready step of
// every turning point (TP1 included), so both have 3CP once the battle starts.
export const STARTING_CP = 2
export const READY_CP = 1

// Up to four equipment options per player, each at most once. A "select two"
// option (utility or explosive grenades) is one option however it's split.
export const MAX_EQUIPMENT_OPTIONS = 4
export const equipmentOptionKey = (eqId) => String(eqId).replace(/^(UNIVERSAL-UE-(?:UG|XG))-.*$/, '$1')
export const equipmentOptionCount = (eqIds) => new Set((eqIds ?? []).map(equipmentOptionKey)).size

export const otherSeat = (seat) => (seat === 'A' ? 'B' : 'A')

// Kommandos' SSSSHHHH! (strategy ploy, not in TP1): each Kommando that isn't a valid
// target for enemy operatives, or has a Conceal order and is more than 6" from enemy
// operatives, can immediately Dash for free.
export const KOMMANDOS = 'ORK-KOM'
export const SSSSHHHH = 'ORK-KOM-S-SHHH'
export const SSSSHHHH_RANGE_IN = 6

// Kommandos' Krump 'Em! (firefight ploy): at the end of the Firefight phase, one friendly
// Kommando can immediately fight for free.
export const KRUMP_EM = 'ORK-KOM-T-KE'

// Hernkyn Yaegirs' Resourceful (faction rule, Aug 2026): in the Ready step of each
// Strategy phase after the first they gain 2 points with 5+ friendly operatives in the
// killzone outside enemy control range, 1 with 1-4, and discard them at the end of the
// turning point. Each operative can spend 1 per activation: +1 APL until the end of its
// activation, or regain D3+1 lost wounds when it's activated (both only outside enemy
// control range).
export const HERNKYN_YAEGIRS = 'VOT-HKY'
export const resourcefulGain = (outsideControl) => (outsideControl >= 5 ? 2 : outsideControl >= 1 ? 1 : 0)
// Bonds That Bind (Yaegir firefight ploy): when a Yaegir is activated, pick another ready
// Yaegir visible to and within 3" of it to activate straight after it.
export const BONDS_THAT_BIND = 'VOT-HKY-T-BTB'
export const BONDS_RANGE_IN = 3

// Yaegir Ironbraek's Minefield: five face-down Minefield markers, three HY-Pex mines and
// two blanks (which is which stays hidden until one flips).
export const MINEFIELD = 'vot-hky-minefield'
export const MINEFIELD_COUNTS = { mines: 3, blanks: 2 }
export const HY_PEX_DAMAGE = 3

// Stalwart Defence (Yaegir firefight ploy): an enemy ends a move within control range of a
// Yaegir; another Yaegir within 6" of that one (not itself within enemy control range)
// shoots it for free, without grenades, Blast or x" Devastating weapons.
export const STALWART_DEFENCE = 'VOT-HKY-T-SD'
export const STALWART_RANGE_IN = 6

// No Kin Left Behind (Yaegir firefight ploy): when a Yaegir is incapacitated, move the
// Fallen Kin marker to where it fell.
export const NO_KIN_LEFT_BEHIND = 'VOT-HKY-T-NKLB'
export const FALLEN_KIN = 'vot-hky-fallen-kin'
// Markers are 20mm across.
export const FALLEN_KIN_RADIUS_IN = 20 / 25.4 / 2

// Tough Survivalists (Yaegir strategy ploy): the first damage each Yaegir takes in the
// turning point can be halved, rounding up, to a minimum of 2. null when halving
// wouldn't lower it.
export const TOUGH_SURVIVALISTS = 'VOT-HKY-S-TS'
export const toughSurvivalistsDamage = (damage) => {
  const halved = Math.max(2, Math.ceil(damage / 2))
  return halved < damage ? halved : null
}
// Whether an operative (of player) can still halve damage with Tough Survivalists.
export const canToughOut = (player, unit, tp) =>
  player?.killteamId === HERNKYN_YAEGIRS && activePloyIds(player, tp).includes(TOUGH_SURVIVALISTS) && unit?.damagedTp !== tp

// APL an operative has from spending Resourceful this activation.
export const aplBonus = (unit) => (unit?.resourceful === 'apl' ? 1 : 0)

// Kill teams that keep a tally of special points (Yaegirs' Resourceful points, the
// Vespids' points) shown beside CP and VP.
const SP_KILLTEAMS = new Set(['VOT-HKY', 'TAU-VESP'])
export const tracksSp = (killteamId) => SP_KILLTEAMS.has(killteamId)

export const isSeat = (value) => SEATS.includes(value)

export const createPlayer = (seat) => ({
  name: `Player ${seat}`,
  killteamId: '',
  units: [],
  weapons: {},
  equipment: [],
  tacOp: null,
  tacOpRevealed: false,
  // { category: 'critOp' | 'killOp' | 'tacOp' }, picked in secret in turning point 1.
  primaryOp: null,
  // Approved Ops 2025 initiative cards: { id, value } where value 0 is the Re-roll
  // card and N is the +N/-N card. Used cards are discarded.
  initiativeCards: [],
  cp: STARTING_CP,
  score: { critOp: 0, killOp: 0, tacOp: 0 },
  sp: 0,
  ploysByTp: {},
  // Ploys and equipment used from shot cards: { [tp]: { [id]: times } }.
  usesByTp: {},
  unitState: {},
})

// Heights (inches) of the Vantage floors an operative can stand on, as the Volkus models
// measure them: a stronghold's first floor, and Stronghold B's tower. A large ruin's
// upper level counts as a stronghold's first floor (killzone rules).
export const VANTAGE_FLOORS = [
  { floor: 1, height: 3.2 },
  { floor: 2, height: 6.4 },
]

// Which floor a stored Vantage height is; games saved before real heights used 2 and 4.
export const vantageFloor = (height) => (!height ? 0 : height > VANTAGE_FLOORS[0].height + 0.5 ? 2 : 1)

export const DEFAULT_SETTINGS = {
  calibration: null,
  showGrid: true,
  showTerrain: true,
  // The letter and Vantage height written on each terrain piece.
  showTerrainLabels: true,
  showZones: true,
  showObjectives: true,
  showPanels: true,
  panelInches: 8,
  // Each player's own arrangement of their side bar (see boardLayout.js), kept between
  // games: { A: { portrait: { score: { x, y } } }, B: {} }.
  boardLayouts: { A: {}, B: {} },
}

export const createGame = (settings = DEFAULT_SETTINGS) => ({
  phase: 'lobby',
  // The speedrun clock (server time, ms): started the first time both iPads are
  // connected, stopped at the results.
  clock: { startedAt: null, endedAt: null },
  ready: { A: false, B: false },
  players: { A: createPlayer('A'), B: createPlayer('B') },
  table: {
    mapId: 'map_01',
    arrangementId: 'arr_01',
    critOpId: 'crit_ops_01',
    // Setup roll-off: its winner decides who has initiative for setting up.
    rollOffWinner: null,
    initiativeSeat: null,
    // seat -> 'A' | 'B' drop zone
    dropZones: { A: null, B: null },
  },
  battle: {
    tp: 1,
    // The turning point whose Firefight phase has started (moves then activate operatives).
    firefightTp: null,
    // Seat that started the latest activation in each turning point (turn order).
    lastActivatedByTp: {},
    // The activation change the latest move made automatically, so undoing it reverts it.
    lastAuto: null,
    // Each turning point's initiative roll-off winner, and who then took initiative.
    rollOffByTp: {},
    initiativeByTp: {},
    // Sightline shot cards: { 'shooterId|targetId': { toggles: { A, B }, spent: { A, B } } }.
    shots: {},
    // Players who've confirmed the end of this turning point; it moves on when both have.
    tpReady: { A: false, B: false },
    // Who has tapped Start firefight this turning point (it starts once both have).
    firefightReady: { A: false, B: false },
    startedAt: null,
    endedAt: null,
  },
  tokens: [],
  markers: [],
  settings: { ...DEFAULT_SETTINGS, ...settings },
  nextId: 1,
})

export const createUnitState = (maxWounds) => ({
  activation: 'ready',
  order: 'conceal',
  // Times expended (minus undos): the order tag is red when even, black when odd.
  orderFlips: 0,
  wounds: maxWounds,
  dead: false,
  statuses: [],
  apl: 0,
  mark: null,
})

export const activePloyIds = (player, tp) => player?.ploysByTp?.[tp] ?? []

// What a player still has to pick in the muster phase before they can ready up:
// operatives, at least one equipment option and a tac op. null once they're done.
export const musterBlocker = (player) => {
  if (!player?.units?.length) return 'Pick your operatives'
  if (!player.equipment?.length) return 'Pick your equipment'
  if (!player.tacOp) return 'Pick a tac op'
  return null
}

// Tapping a unit card's activation pill steps through these.
export const NEXT_ACTIVATION = { ready: 'active', active: 'expended', expended: 'ready' }

// Firefight ploys: each usable once per turning point, except Command Re-roll (core
// rules). Uses are counted in usesByTp, by ploy id, wherever they were played (the
// Team tab, or the Shoot/Fight stats drawer).
export const COMMAND_REROLL = 'command-reroll'
export const ployUses = (player, tp, ployId) => player?.usesByTp?.[tp]?.[ployId] ?? 0

// ---- activations (Firefight phase) ----
// Operatives without unit state yet are ready; dead ones never count.
const activationOf = (player, unitKey) => player?.unitState?.[unitKey]?.activation ?? 'ready'
const isDead = (player, unitKey) => Boolean(player?.unitState?.[unitKey]?.dead)

export const readyUnitKeys = (player) =>
  (player?.units ?? []).filter((unitKey) => !isDead(player, unitKey) && activationOf(player, unitKey) === 'ready')

// Only one operative is ever active: { seat, unitKey } or null.
export const activeUnit = (state) => {
  for (const seat of SEATS) {
    const player = state.players[seat]
    const unitKey = Object.keys(player?.unitState ?? {}).find(
      (key) => !isDead(player, key) && activationOf(player, key) === 'active',
    )
    if (unitKey) return { seat, unitKey }
  }
  return null
}

// Counteract: when you would activate (your opponent has just activated) but all
// your operatives are expended while your opponent still has ready ones, an expended
// Engage operative can perform one 1AP action (moving at most 2"), once per turning
// point. It isn't an activation.
export const canCounteract = (state, seat, unitKey) => {
  const player = state.players[seat]
  const unit = player?.unitState?.[unitKey]
  return (
    state.phase === 'battle' &&
    state.battle.lastActivatedByTp?.[state.battle.tp] === otherSeat(seat) &&
    readyUnitKeys(player).length === 0 &&
    readyUnitKeys(state.players[otherSeat(seat)]).length > 0 &&
    unit?.activation === 'expended' &&
    !unit.dead &&
    unit.order === 'engage' &&
    unit.counteractedTp !== state.battle.tp
  )
}

export const COUNTERACT_MOVE_IN = 2

// Whose turn it is in the Firefight phase. Activations alternate, starting with the
// player with initiative; a player with no ready operatives is skipped (and may
// counteract instead).
//   { activeSeat, activeUnitKey, nextSeat, counteractSeat, done }
export const turnState = (state) => {
  const { tp } = state.battle
  const active = activeUnit(state)
  const ready = Object.fromEntries(SEATS.map((seat) => [seat, readyUnitKeys(state.players[seat]).length]))
  const done = !active && SEATS.every((seat) => ready[seat] === 0)
  let nextSeat = null
  // A chained activation (Bonds That Bind): once the first operative is expended, the
  // chosen second one activates before the opponent.
  const chain = state.battle.chain?.tp === tp ? state.battle.chain : null
  const chainUnit = (key) => state.players[chain.seat]?.unitState?.[key]
  const chainedUnitKey =
    chain && chainUnit(chain.after)?.activation === 'expended' && (chainUnit(chain.next)?.activation ?? 'ready') === 'ready' && !chainUnit(chain.next)?.dead
      ? chain.next
      : null
  if (!active && !done) {
    const last = state.battle.lastActivatedByTp?.[tp] ?? null
    const preferred = last ? otherSeat(last) : state.battle.initiativeByTp?.[tp] ?? null
    if (chainedUnitKey) nextSeat = chain.seat
    else if (preferred) nextSeat = ready[preferred] > 0 ? preferred : otherSeat(preferred)
  }
  const counteractSeat =
    SEATS.find((seat) =>
      (state.players[seat]?.units ?? []).some((unitKey) => canCounteract(state, seat, unitKey)),
    ) ?? null
  return {
    activeSeat: active?.seat ?? null,
    activeUnitKey: active?.unitKey ?? null,
    nextSeat,
    chainedUnitKey: active ? null : chainedUnitKey,
    counteractSeat,
    done,
  }
}

// VP come from three ops, max 6 each. The primary op adds half (rounded up) of
// the category it names; it stays secret until results, so callers opt in.
export const SCORE_CATEGORIES = [
  ['critOp', 'Crit op'],
  ['killOp', 'Kill op'],
  ['tacOp', 'Tac op'],
]
export const MAX_CATEGORY_VP = 6

export const primaryCategory = (player) => {
  const category = player?.primaryOp?.category
  return SCORE_CATEGORIES.some(([key]) => key === category) ? category : null
}

// Who holds initiative going into a turning point's roll-off: last turning point's
// holder, or the setup holder before turning point 1.
export const initiativeBefore = (state, tp) =>
  (tp > 1 ? state.battle.initiativeByTp[tp - 1] : null) ?? state.table.initiativeSeat ?? null

export const primaryBonus = (player) => {
  const category = primaryCategory(player)
  return category ? Math.ceil((player.score?.[category] ?? 0) / 2) : 0
}

export const totalVp = (player, { withPrimary = false } = {}) => {
  const base = SCORE_CATEGORIES.reduce((sum, [key]) => sum + (player?.score?.[key] ?? 0), 0)
  return withPrimary ? base + primaryBonus(player) : base
}
