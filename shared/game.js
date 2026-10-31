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

export const DEFAULT_SETTINGS = {
  calibration: null,
  showGrid: true,
  showTerrain: true,
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
  if (!active && !done) {
    const last = state.battle.lastActivatedByTp?.[tp] ?? null
    const preferred = last ? otherSeat(last) : state.battle.initiativeByTp?.[tp] ?? null
    if (preferred) nextSeat = ready[preferred] > 0 ? preferred : otherSeat(preferred)
  }
  const counteractSeat =
    SEATS.find((seat) =>
      (state.players[seat]?.units ?? []).some((unitKey) => canCounteract(state, seat, unitKey)),
    ) ?? null
  return { activeSeat: active?.seat ?? null, activeUnitKey: active?.unitKey ?? null, nextSeat, counteractSeat, done }
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
