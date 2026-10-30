import {
  DEFAULT_BASE_MM,
  MAX_CATEGORY_VP,
  MAX_EQUIPMENT_OPTIONS,
  MAX_TP,
  COMMAND_REROLL,
  PHASES,
  READY_CP,
  SCORE_CATEGORIES,
  SEATS,
  createGame,
  activeUnit,
  canCounteract,
  createUnitState,
  equipmentOptionCount,
  initiativeBefore,
  isSeat,
  musterBlocker,
  otherSeat,
  ployUses,
} from './game.js'
import { ARRANGEMENT_OPTIONS, CRIT_OP_IDS, pickRandom } from './rolls.js'

// applyAction(state, action, actor, random) -> next state
//   actor: 'A' | 'B' | 'table'
//   random: () => [0, 1), injected so dice rolls are testable
// Throws ActionError for invalid actions so the server can report back to the sender.
// State is treated as immutable; every handler returns a new object.

export class ActionError extends Error {}

const fail = (message) => {
  throw new ActionError(message)
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const updatePlayer = (state, seat, patch) => ({
  ...state,
  players: {
    ...state.players,
    [seat]: {
      ...state.players[seat],
      ...(typeof patch === 'function' ? patch(state.players[seat]) : patch),
    },
  },
})

// A seat acts for itself; the table can act for either seat by passing `seat`.
const resolveSeat = (action, actor) => {
  if (isSeat(actor)) return actor
  if (isSeat(action.seat)) return action.seat
  return fail('A seat is required for this action.')
}

const requirePhase = (state, ...phases) => {
  if (!phases.includes(state.phase)) {
    fail(`Not available during ${state.phase}.`)
  }
}

const toggleInList = (list, value) =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value]

const rollKillzone = (state, random) => {
  const { mapId, arrangementId } = pickRandom(
    ARRANGEMENT_OPTIONS,
    (option) => option.arrangementId === state.table.arrangementId,
    random,
  )
  return { ...state, table: { ...state.table, mapId, arrangementId }, tokens: [], markers: [] }
}

const rollCritOp = (state, random) => ({
  ...state,
  table: { ...state.table, critOpId: pickRandom(CRIT_OP_IDS, (id) => id === state.table.critOpId, random) },
})

const enterPhase = (state, phase, random) => {
  let next = { ...state, phase, ready: { A: false, B: false } }
  // Killzone and crit op are rolled for the players; they can re-roll from setup.
  if (phase === 'setup') next = rollCritOp(rollKillzone(next, random), random)
  if (phase === 'battle' && !state.battle.startedAt) {
    // Shot card toggles tried out while deploying don't carry into the battle.
    next = { ...next, battle: { ...next.battle, startedAt: Date.now(), shots: {} } }
    // Ready step of the first turning point.
    SEATS.forEach((seat) => {
      next = updatePlayer(next, seat, (player) => ({ cp: player.cp + READY_CP }))
    })
  }
  if (phase === 'results' && !state.battle.endedAt) {
    next = { ...next, battle: { ...next.battle, endedAt: Date.now() } }
  }
  return next
}

const canLeavePhase = (state) => {
  const { players, table } = state
  switch (state.phase) {
    case 'setup':
      if (!SEATS.every((seat) => players[seat].killteamId)) {
        return 'Both players need a kill team.'
      }
      if (!table.dropZones.A || !table.dropZones.B) return 'Pick drop zones first.'
      return null
    case 'muster': {
      const blocked = SEATS.map((seat) => musterBlocker(players[seat])).find(Boolean)
      return blocked ? `${blocked} first.` : null
    }
    default:
      return null
  }
}

const advancePhase = (state, random) => {
  const index = PHASES.indexOf(state.phase)
  if (index < 0 || index >= PHASES.length - 1) return state
  const blocker = canLeavePhase(state)
  if (blocker) fail(blocker)
  return enterPhase(state, PHASES[index + 1], random)
}

const UNIT_FIELDS = {
  activation: (value) => (['ready', 'active', 'expended'].includes(value) ? value : null),
  order: (value) => (['conceal', 'engage'].includes(value) ? value : null),
  wounds: (value) => Math.max(0, Math.round(toNumber(value))),
  dead: (value) => Boolean(value),
  statuses: (value) => (Array.isArray(value) ? value.map(String) : null),
  apl: (value) => clamp(Math.round(toNumber(value)), -3, 3),
  mark: (value) => (value == null ? null : String(value)),
  // Height on Vantage terrain (0 = killzone floor), used by the Sightline tool.
  vantage: (value) => ([0, 2, 4].includes(Number(value)) ? Number(value) : null),
}

const sanitizeUnitPatch = (patch) => {
  const clean = {}
  Object.entries(patch ?? {}).forEach(([key, value]) => {
    const sanitize = UNIT_FIELDS[key]
    if (!sanitize) return
    const result = sanitize(value)
    if (result !== null) clean[key] = result
  })
  return clean
}

// Half-mm steps so 28.5mm bases survive.
const MAX_PATH_POINTS = 200

// Put a token at the end of its movement path; a path with no steps means "not moved".
// extra: more to remember about the move (see prevMovedTp).
const setMovePath = (state, id, from, path, extra = {}) => {
  const end = path[path.length - 1]
  const lastMove = path.length > 1 ? { from, path, inches: path.length - 1, ...extra } : null
  return {
    ...state,
    tokens: state.tokens.map((token) => {
      if (token.id === id) return { ...token, ...end, lastMove }
      // Only the most recent operative's movement stays on the board.
      return lastMove && token.lastMove ? { ...token, lastMove: null } : token
    }),
  }
}

const REROLL_CARD = { id: 'reroll', value: 0, used: false }

const withoutCard = (cards, id) => (cards ?? []).filter((card) => card.id !== id)

// Sets (or clears, with null) who has initiative in a turning point, moving the
// extra Ready-step CP that the player without initiative gains from TP2 onward.
const setInitiative = (state, tp, seat) => {
  const previous = state.battle.initiativeByTp[tp] ?? null
  if (previous === seat) return state
  const initiativeByTp = { ...state.battle.initiativeByTp }
  if (seat) initiativeByTp[tp] = seat
  else delete initiativeByTp[tp]
  let next = { ...state, battle: { ...state.battle, initiativeByTp } }
  if (tp > 1) {
    if (previous) next = updatePlayer(next, otherSeat(previous), (player) => ({ cp: Math.max(0, player.cp - 1) }))
    if (seat) next = updatePlayer(next, otherSeat(seat), (player) => ({ cp: player.cp + 1 }))
  }
  return next
}

// ---- activations ----
// Unit state for an operative, seeded on first use. Without known wounds the wounds
// field is left out, so readers fall back to the operative's starting wounds.
const seedUnitState = (maxWounds) => {
  const wounds = Math.max(0, toNumber(maxWounds))
  if (wounds > 0) return createUnitState(wounds)
  const rest = createUnitState(0)
  delete rest.wounds
  return rest
}

// Every unit state change goes through here. The order tag swaps colour each time
// the operative is expended (and back on undo), so the colour that means "ready"
// alternates every turning point.
const patchUnit = (state, seat, unitKey, patch, maxWounds) =>
  updatePlayer(state, seat, (player) => {
    const current = player.unitState[unitKey] ?? seedUnitState(maxWounds)
    const flips = current.orderFlips ?? 0
    const wasExpended = current.activation === 'expended'
    const isExpended = (patch.activation ?? current.activation) === 'expended'
    const orderFlips = flips + (isExpended && !wasExpended ? 1 : !isExpended && wasExpended ? -1 : 0)
    return { unitState: { ...player.unitState, [unitKey]: { ...current, ...patch, orderFlips } } }
  })

// Only one operative is active at a time: expend whichever is (other than `keep`).
const expendActive = (state, keep = null) => {
  const active = activeUnit(state)
  if (!active || (keep && active.seat === keep.seat && active.unitKey === keep.unitKey)) {
    return { state, expended: null }
  }
  return { state: patchUnit(state, active.seat, active.unitKey, { activation: 'expended' }), expended: active }
}

const markActivated = (state, seat) => ({
  ...state,
  battle: { ...state.battle, lastActivatedByTp: { ...state.battle.lastActivatedByTp, [state.battle.tp]: seat } },
})

// Moving an operative in the Firefight phase activates it (expending the last one),
// or counts as its counteraction. Returns the new state with battle.lastAuto set so
// undoing the move can revert it.
const autoActivate = (state, token, maxWounds) => {
  const { battle } = state
  if (state.phase !== 'battle' || battle.firefightTp !== battle.tp || !token.unitKey || !isSeat(token.seat)) {
    return state
  }
  const player = state.players[token.seat]
  const unit = player.unitState[token.unitKey]
  if (unit?.dead) return state
  const activation = unit?.activation ?? 'ready'
  const previousLast = battle.lastActivatedByTp?.[battle.tp] ?? null
  if (activation === 'ready') {
    const { state: next, expended } = expendActive(state)
    const activated = markActivated(patchUnit(next, token.seat, token.unitKey, { activation: 'active' }, maxWounds), token.seat)
    return { ...activated, battle: { ...activated.battle, lastAuto: { tokenId: token.id, kind: 'activate', expended, previousLast } } }
  }
  if (activation === 'expended' && canCounteract(state, token.seat, token.unitKey)) {
    const { state: next, expended } = expendActive(state)
    const countered = patchUnit(next, token.seat, token.unitKey, { counteractedTp: battle.tp })
    return { ...countered, battle: { ...countered.battle, lastAuto: { tokenId: token.id, kind: 'counteract', expended, previousLast } } }
  }
  return state
}

// Undo what autoActivate did for this token's move, if it was the latest change.
const revertAuto = (state, token) => {
  const auto = state.battle.lastAuto
  if (!auto || auto.tokenId !== token.id) return state
  let next =
    auto.kind === 'activate'
      ? patchUnit(state, token.seat, token.unitKey, { activation: 'ready' })
      : patchUnit(state, token.seat, token.unitKey, { counteractedTp: null })
  if (auto.expended) next = patchUnit(next, auto.expended.seat, auto.expended.unitKey, { activation: 'active' })
  const lastActivatedByTp = { ...next.battle.lastActivatedByTp }
  if (auto.previousLast) lastActivatedByTp[next.battle.tp] = auto.previousLast
  else delete lastActivatedByTp[next.battle.tp]
  return { ...next, battle: { ...next.battle, lastActivatedByTp, lastAuto: null } }
}

// An operative put back where its move started is ready again: revert what the move
// set off, or, if that's no longer on record, just make an active operative ready.
const returnToStart = (state, token) => {
  if (state.battle.lastAuto?.tokenId === token.id) return revertAuto(state, token)
  if (isSeat(token.seat) && token.unitKey && state.players[token.seat].unitState[token.unitKey]?.activation === 'active') {
    return patchUnit(state, token.seat, token.unitKey, { activation: 'ready' })
  }
  return state
}

const clearAuto = (state) => (state.battle.lastAuto ? { ...state, battle: { ...state.battle, lastAuto: null } } : state)

// Rules like "until the end of the turning point, if it moved" need to know when an
// operative last moved: unitState.movedTp. A move remembers the value before it
// (lastMove.prevMovedTp) so undoing the whole move puts it back.
const operativeUnit = (state, token) =>
  token?.unitKey && isSeat(token.seat) ? state.players[token.seat].unitState[token.unitKey] ?? null : null

const restoreMovedTp = (state, token) => {
  if (!token.lastMove || !operativeUnit(state, token)) return state
  return patchUnit(state, token.seat, token.unitKey, { movedTp: token.lastMove.prevMovedTp ?? null })
}

// Sightline shot cards keep their toggles for the latest few shooter/target pairs.
const MAX_SHOTS = 12
const emptyShot = () => ({ toggles: { A: {}, B: {} }, spent: { A: {}, B: {} } })

const sanitizeRing = (value) => clamp(toNumber(value), 0, 12)

const sanitizeHost = (state, value) => {
  if (value == null) return null
  const id = String(value)
  if (!state.tokens.some((token) => token.id === id)) fail('Token not found.')
  return id
}

const dropOrphanMarkers = (state) => {
  const ids = new Set(state.tokens.map((token) => token.id))
  return { ...state, markers: state.markers.filter((marker) => !marker.attachedTo || ids.has(marker.attachedTo)) }
}

const sanitizeBase = (value) => clamp(Math.round(toNumber(value, DEFAULT_BASE_MM) * 2) / 2, 20, 80)

const sanitizePoint = (action) => ({
  x: clamp(toNumber(action.x), -20, 60),
  y: clamp(toNumber(action.y), -20, 60),
})

const handlers = {
  // ---- general ----
  'game/reset': (state) => createGame(state.settings),

  // The clock is the server's alone (actor 'server'); devices can't set it.
  'clock/start': (state, action, actor) => {
    if (actor !== 'server') fail('Only the table server runs the clock.')
    if (state.clock?.startedAt) return state
    return { ...state, clock: { startedAt: toNumber(action.at), endedAt: null } }
  },

  'clock/stop': (state, action, actor) => {
    if (actor !== 'server') fail('Only the table server runs the clock.')
    if (!state.clock?.startedAt || state.clock.endedAt) return state
    return { ...state, clock: { ...state.clock, endedAt: toNumber(action.at) } }
  },

  'phase/ready': (state, action, actor, random) => {
    const seat = resolveSeat(action, actor)
    // Mustering: no readying up until operatives, equipment and a tac op are picked.
    if (state.phase === 'muster' && action.ready !== false) {
      const blocked = musterBlocker(state.players[seat])
      if (blocked) fail(`${blocked} first.`)
    }
    const ready = { ...state.ready, [seat]: action.ready !== false }
    const next = { ...state, ready }
    if (SEATS.every((candidate) => ready[candidate])) return advancePhase(next, random)
    return next
  },

  'phase/advance': (state, action, actor, random) => advancePhase(state, random),

  'phase/set': (state, action, actor, random) => {
    if (!PHASES.includes(action.phase)) fail('Unknown phase.')
    return enterPhase(state, action.phase, random)
  },

  'player/rename': (state, action, actor) => {
    const seat = resolveSeat(action, actor)
    const name = String(action.name ?? '').trim().slice(0, 24)
    return updatePlayer(state, seat, { name: name || `Player ${seat}` })
  },

  'settings/update': (state, action) => {
    const allowed = Object.keys(state.settings)
    const patch = Object.fromEntries(
      Object.entries(action.patch ?? {}).filter(([key]) => allowed.includes(key)),
    )
    return { ...state, settings: { ...state.settings, ...patch } }
  },

  // ---- setup ----
  'setup/killteam': (state, action, actor) => {
    requirePhase(state, 'lobby', 'setup', 'muster')
    const seat = resolveSeat(action, actor)
    const killteamId = String(action.killteamId ?? '')
    if (state.players[seat].killteamId === killteamId) return state
    return updatePlayer(state, seat, {
      killteamId,
      units: Array.isArray(action.units) ? action.units.map(String) : [],
      weapons: {},
      equipment: (Array.isArray(action.equipment) ? action.equipment.map(String) : []).filter(
        (eqId, index, list) => equipmentOptionCount(list.slice(0, index + 1)) <= MAX_EQUIPMENT_OPTIONS,
      ),
      tacOp: null,
      unitState: {},
    })
  },

  'setup/map': (state, action) => {
    const mapId = String(action.mapId ?? state.table.mapId)
    const arrangementId = String(action.arrangementId ?? state.table.arrangementId)
    return {
      ...state,
      table: { ...state.table, mapId, arrangementId },
      tokens: [],
      markers: [],
    }
  },

  'setup/rollKillzone': (state, action, actor, random) => rollKillzone(state, random),

  'setup/rollCritOp': (state, action, actor, random) => rollCritOp(state, random),

  'setup/critOp': (state, action) => ({
    ...state,
    table: { ...state.table, critOpId: String(action.critOpId ?? '') },
  }),

  // Approved Ops 2025 setup: roll off, the winner decides who has initiative, the
  // player with initiative picks a drop zone and the other gains the Re-roll card.
  'setup/rollOff': (state, action) => {
    const winner = action.winner == null ? null : action.winner
    if (winner !== null && !isSeat(winner)) fail('Unknown seat.')
    if (winner === state.table.rollOffWinner) return state
    let next = { ...state, table: { ...state.table, rollOffWinner: winner, initiativeSeat: null, dropZones: { A: null, B: null } } }
    SEATS.forEach((seat) => {
      next = updatePlayer(next, seat, (player) => ({ initiativeCards: withoutCard(player.initiativeCards, REROLL_CARD.id) }))
    })
    return next
  },

  'setup/initiative': (state, action, actor) => {
    const seat = action.seat
    if (!isSeat(seat)) fail('Unknown seat.')
    const winner = state.table.rollOffWinner
    if (!winner) fail('Roll off first.')
    if (isSeat(actor) && actor !== winner) fail('The roll-off winner decides who has initiative.')
    if (seat === state.table.initiativeSeat) return state
    let next = { ...state, table: { ...state.table, initiativeSeat: seat, dropZones: { A: null, B: null } } }
    SEATS.forEach((candidate) => {
      next = updatePlayer(next, candidate, (player) => {
        const cards = withoutCard(player.initiativeCards, REROLL_CARD.id)
        return { initiativeCards: candidate === seat ? cards : [...cards, { ...REROLL_CARD }] }
      })
    })
    return next
  },

  // The player with initiative picks a drop zone; the opponent gets the other one.
  'setup/dropZone': (state, action, actor) => {
    const seat = resolveSeat(action, actor)
    if (!state.table.initiativeSeat) fail('Decide initiative first.')
    if (seat !== state.table.initiativeSeat) fail('The player with initiative picks the drop zone.')
    const zone = action.zone
    if (zone !== 'A' && zone !== 'B') fail('Drop zone must be A or B.')
    return {
      ...state,
      table: {
        ...state.table,
        dropZones: { [seat]: zone, [otherSeat(seat)]: zone === 'A' ? 'B' : 'A' },
      },
    }
  },

  // ---- muster ----
  'muster/units': (state, action, actor) => {
    const seat = resolveSeat(action, actor)
    const units = Array.isArray(action.units) ? action.units.map(String) : []
    return updatePlayer(state, seat, { units })
  },

  'muster/toggleUnit': (state, action, actor) => {
    const seat = resolveSeat(action, actor)
    const unitKey = String(action.unitKey ?? '')
    if (!unitKey) fail('Missing unit.')
    return updatePlayer(state, seat, (player) => ({
      units: toggleInList(player.units, unitKey),
    }))
  },

  'muster/weapons': (state, action, actor) => {
    const seat = resolveSeat(action, actor)
    const unitKey = String(action.unitKey ?? '')
    const weapons = Array.isArray(action.weapons) ? action.weapons.map(String) : []
    return updatePlayer(state, seat, (player) => ({
      weapons: { ...player.weapons, [unitKey]: weapons },
    }))
  },

  'muster/toggleEquipment': (state, action, actor) => {
    const seat = resolveSeat(action, actor)
    const eqId = String(action.eqId ?? '')
    if (!eqId) fail('Missing equipment.')
    return updatePlayer(state, seat, (player) => {
      const equipment = toggleInList(player.equipment, eqId)
      if (equipmentOptionCount(equipment) > MAX_EQUIPMENT_OPTIONS) {
        fail(`You can take up to ${MAX_EQUIPMENT_OPTIONS} equipment options.`)
      }
      return { equipment }
    })
  },

  'muster/tacOp': (state, action, actor) => {
    const seat = resolveSeat(action, actor)
    // Approved Ops 2025 tac ops are identified by id (see src/data/tacOps.js).
    const tacOp = action.tacOp?.id ? { id: String(action.tacOp.id), label: String(action.tacOp.label ?? '') } : null
    return updatePlayer(state, seat, { tacOp, tacOpRevealed: false })
  },

  // ---- battle: turning point 1 gambit ----
  // Approved Ops 2025: each player secretly picks crit, kill or tac op as their
  // primary op as a STRATEGIC GAMBIT in the first turning point.
  'battle/primaryOp': (state, action, actor) => {
    requirePhase(state, 'battle')
    if (state.battle.tp !== 1) fail('The primary op is chosen in the first turning point.')
    const seat = resolveSeat(action, actor)
    const category = action.category == null ? null : String(action.category)
    if (category !== null && !SCORE_CATEGORIES.some(([key]) => key === category)) fail('Unknown op.')
    return updatePlayer(state, seat, { primaryOp: category ? { category } : null })
  },

  // ---- battle ----
  'battle/score': (state, action, actor) => {
    const seat = resolveSeat(action, actor)
    const field = action.field
    if (!['cp', 'sp'].includes(field)) fail('Unknown score.')
    return updatePlayer(state, seat, (player) => ({
      [field]: Math.max(0, player[field] + Math.round(toNumber(action.delta))),
    }))
  },

  'battle/vp': (state, action, actor) => {
    const seat = resolveSeat(action, actor)
    const category = action.category
    if (!SCORE_CATEGORIES.some(([key]) => key === category)) fail('Unknown VP category.')
    return updatePlayer(state, seat, (player) => ({
      score: {
        ...player.score,
        [category]: clamp(player.score[category] + Math.round(toNumber(action.delta)), 0, MAX_CATEGORY_VP),
      },
    }))
  },

  // Strat ploys cost 1CP each for the current turning point; toggling off refunds.
  'battle/togglePloy': (state, action, actor) => {
    const seat = resolveSeat(action, actor)
    const ployId = String(action.ployId ?? '')
    const { tp } = state.battle
    return updatePlayer(state, seat, (player) => {
      const current = player.ploysByTp[tp] ?? []
      const isActive = current.includes(ployId)
      if (!isActive && player.cp <= 0) fail('Not enough CP.')
      return {
        cp: isActive ? player.cp + 1 : player.cp - 1,
        ploysByTp: { ...player.ploysByTp, [tp]: toggleInList(current, ployId) },
      }
    })
  },

  // A firefight ploy played outside a shot or fight (from the Team tab). on: spend its
  // CP and count a use; off: undo the last use and refund it.
  'battle/firefightPloy': (state, action, actor) => {
    requirePhase(state, 'battle')
    const seat = resolveSeat(action, actor)
    const ployId = String(action.ployId ?? '').slice(0, 80)
    if (!ployId) fail('Missing ploy.')
    const cost = clamp(Math.round(toNumber(action.cost, 1)), 0, 3)
    const { tp } = state.battle
    return updatePlayer(state, seat, (player) => {
      const uses = ployUses(player, tp, ployId)
      if (action.on === false) {
        if (!uses) return {}
        return {
          cp: player.cp + cost,
          usesByTp: { ...player.usesByTp, [tp]: { ...player.usesByTp?.[tp], [ployId]: uses - 1 } },
        }
      }
      if (uses && ployId !== COMMAND_REROLL) fail('Already used this turning point.')
      if (player.cp < cost) fail('Not enough CP.')
      return {
        cp: player.cp - cost,
        usesByTp: { ...player.usesByTp, [tp]: { ...player.usesByTp?.[tp], [ployId]: uses + 1 } },
      }
    })
  },

  // Each turning point (including the first) starts with an initiative roll-off.
  // A tie goes to the player who doesn't currently have initiative. Except in the
  // fourth turning point, the loser gains the +N/-N initiative card (N = the TP).
  'battle/rollOff': (state, action) => {
    requirePhase(state, 'battle')
    const { tp } = state.battle
    let winner = action.winner
    if (winner === 'tie') {
      const holder = initiativeBefore(state, tp)
      if (!holder) fail('Roll off again: nobody has initiative yet.')
      winner = otherSeat(holder)
    }
    if (!isSeat(winner)) fail('Unknown seat.')
    const rollOffByTp = state.battle.rollOffByTp ?? {}
    if (rollOffByTp[tp] === winner) return state
    const cardId = `tp${tp}`
    let next = setInitiative(state, tp, null)
    next = { ...next, battle: { ...next.battle, rollOffByTp: { ...rollOffByTp, [tp]: winner } } }
    SEATS.forEach((seat) => {
      next = updatePlayer(next, seat, (player) => {
        const cards = withoutCard(player.initiativeCards, cardId)
        const gains = seat !== winner && tp < MAX_TP
        return { initiativeCards: gains ? [...cards, { id: cardId, value: tp, used: false }] : cards }
      })
    })
    return next
  },

  // The roll-off winner decides who has initiative. From TP2 onward the player
  // WITHOUT initiative gains 2CP instead of 1 in the Ready step, so the extra 1CP
  // follows the decision if it changes.
  'battle/initiative': (state, action, actor) => {
    requirePhase(state, 'battle')
    const seat = action.seat
    if (!isSeat(seat)) fail('Unknown seat.')
    const { tp } = state.battle
    const winner = state.battle.rollOffByTp?.[tp]
    if (!winner) fail('Roll off for initiative first.')
    if (isSeat(actor) && actor !== winner) fail('The roll-off winner decides who has initiative.')
    return setInitiative(state, tp, seat)
  },

  // The Firefight phase has started: from now on moving an operative activates it.
  'battle/startFirefight': (state) => {
    requirePhase(state, 'battle')
    if (state.battle.firefightTp === state.battle.tp) return state
    return { ...state, battle: { ...state.battle, firefightTp: state.battle.tp } }
  },

  // End the activation in progress (the active operative becomes expended).
  'battle/endActivation': (state) => {
    requirePhase(state, 'battle')
    return clearAuto(expendActive(state).state)
  },

  // Playing an initiative card discards it; tapping it again takes it back.
  'battle/useInitiativeCard': (state, action, actor) => {
    const seat = resolveSeat(action, actor)
    const id = String(action.id ?? '')
    return updatePlayer(state, seat, (player) => {
      if (!player.initiativeCards.some((card) => card.id === id)) fail('You don’t have that initiative card.')
      return {
        initiativeCards: player.initiativeCards.map((card) =>
          card.id === id ? { ...card, used: action.used !== false } : card,
        ),
      }
    })
  },

  'battle/revealTacOp': (state, action, actor) => {
    const seat = resolveSeat(action, actor)
    return updatePlayer(state, seat, { tacOpRevealed: action.revealed !== false })
  },

  // `fromTp` makes this idempotent: if both players tap "Next TP" at once, only one counts.
  'battle/nextTp': (state, action) => {
    requirePhase(state, 'battle')
    if (action.fromTp != null && action.fromTp !== state.battle.tp) return state
    if (state.battle.tp >= MAX_TP) return enterPhase(state, 'results', Math.random)
    let next = {
      ...state,
      battle: { ...state.battle, tp: state.battle.tp + 1, lastAuto: null, shots: {} },
      tokens: state.tokens.map((token) => (token.lastMove ? { ...token, lastMove: null } : token)),
    }
    SEATS.forEach((seat) => {
      next = updatePlayer(next, seat, (player) => ({
        cp: player.cp + READY_CP,
        initiativeCards: (player.initiativeCards ?? []).filter((card) => !card.used),
        unitState: Object.fromEntries(
          Object.entries(player.unitState).map(([key, unit]) => [
            key,
            { ...unit, activation: 'ready' },
          ]),
        ),
      }))
    })
    return next
  },

  // Sightline shot card: a player turns one of their own modifiers on or off for the
  // shot `key` (shooterId|targetId). A cost (CP) and a limit (uses per turning point,
  // e.g. 1 for a firefight ploy) are spent when it's turned on, and refunded if it's
  // turned off again in the same shot.
  'shot/toggle': (state, action, actor) => {
    const seat = resolveSeat(action, actor)
    const key = String(action.key ?? '').slice(0, 80)
    const id = String(action.id ?? '').slice(0, 80)
    if (!key || !id) fail('Missing modifier.')
    const on = Boolean(action.on)
    const cost = clamp(Math.round(toNumber(action.cost)), 0, 3)
    const limit = action.limit == null ? null : clamp(Math.round(toNumber(action.limit)), 1, 9)
    const { tp } = state.battle
    const shots = state.battle.shots ?? {}
    const shot = shots[key] ?? emptyShot()
    const spent = { ...shot.spent[seat] }
    let next = state
    if ((cost || limit) && on && !(id in spent)) {
      requirePhase(state, 'battle')
      const player = state.players[seat]
      const uses = player.usesByTp?.[tp]?.[id] ?? 0
      if (limit && uses >= limit) fail(limit === 1 ? 'Already used this turning point.' : `Already used ${limit} times this turning point.`)
      if (player.cp < cost) fail('Not enough CP.')
      next = updatePlayer(next, seat, (current) => ({
        cp: current.cp - cost,
        usesByTp: { ...current.usesByTp, [tp]: { ...current.usesByTp?.[tp], [id]: uses + 1 } },
      }))
      spent[id] = cost
    } else if (!on && id in spent) {
      next = updatePlayer(next, seat, (current) => ({
        cp: current.cp + spent[id],
        usesByTp: {
          ...current.usesByTp,
          [tp]: { ...current.usesByTp?.[tp], [id]: Math.max(0, (current.usesByTp?.[tp]?.[id] ?? 1) - 1) },
        },
      }))
      delete spent[id]
    }
    const updated = {
      ...shot,
      toggles: { ...shot.toggles, [seat]: { ...shot.toggles[seat], [id]: on } },
      spent: { ...shot.spent, [seat]: spent },
    }
    // Most recent last; the oldest shots drop off.
    const rest = Object.entries(shots).filter(([candidate]) => candidate !== key).slice(-(MAX_SHOTS - 1))
    return { ...next, battle: { ...next.battle, shots: Object.fromEntries([...rest, [key, updated]]) } }
  },

  // A fight's defender picks the melee weapon they retaliate with (per player, per fight).
  'shot/weapon': (state, action, actor) => {
    const seat = resolveSeat(action, actor)
    const key = String(action.key ?? '').slice(0, 80)
    if (!key) fail('Missing fight.')
    const weaponId = action.weaponId == null ? null : String(action.weaponId).slice(0, 80)
    const shots = state.battle.shots ?? {}
    const shot = shots[key] ?? emptyShot()
    const updated = { ...shot, weapons: { ...shot.weapons, [seat]: weaponId } }
    const rest = Object.entries(shots).filter(([candidate]) => candidate !== key).slice(-(MAX_SHOTS - 1))
    return { ...state, battle: { ...state.battle, shots: Object.fromEntries([...rest, [key, updated]]) } }
  },

  'battle/prevTp': (state) => {
    requirePhase(state, 'battle')
    return { ...state, battle: { ...state.battle, tp: Math.max(1, state.battle.tp - 1) } }
  },

  // patch: subset of unit fields. maxWounds seeds state the first time a unit is touched.
  'unit/update': (state, action, actor) => {
    const seat = resolveSeat(action, actor)
    const unitKey = String(action.unitKey ?? '')
    if (!unitKey) fail('Missing unit.')
    const patch = sanitizeUnitPatch(action.patch)
    let next = clearAuto(state)
    // Activating an operative by hand also ends the activation in progress.
    if (patch.activation === 'active' && state.players[seat].unitState[unitKey]?.activation !== 'active') {
      next = markActivated(expendActive(next, { seat, unitKey }).state, seat)
    }
    return patchUnit(next, seat, unitKey, patch, action.maxWounds)
  },

  // ---- tokens + markers (board objects shared on the projector) ----
  'token/add': (state, action, actor) => {
    const owner = isSeat(action.seat) ? action.seat : isSeat(actor) ? actor : null
    const token = {
      id: `t${state.nextId}`,
      seat: owner,
      ...sanitizePoint(action),
      label: String(action.label ?? '').slice(0, 24),
      unitKey: action.unitKey ? String(action.unitKey) : null,
      // An operative's starting wounds, so its unit state can be seeded when it's moved.
      maxWounds: action.unitKey ? Math.max(0, Math.round(toNumber(action.maxWounds))) || null : null,
      baseMm: sanitizeBase(action.baseMm),
      // False while the base size is being picked during placement (the on-token − / +).
      baseLocked: Boolean(action.baseLocked),
      ring: sanitizeRing(action.ring),
    }
    return { ...state, tokens: [...state.tokens, token], nextId: state.nextId + 1 }
  },

  'token/update': (state, action) => {
    const id = String(action.id ?? '')
    const token = state.tokens.find((candidate) => candidate.id === id)
    if (!token) fail('Token not found.')
    const patch = {}
    if (action.x != null || action.y != null) Object.assign(patch, sanitizePoint(action), { lastMove: null })
    if (action.label != null) patch.label = String(action.label).slice(0, 24)
    if (action.ring != null) patch.ring = sanitizeRing(action.ring)
    if (action.baseMm != null) patch.baseMm = sanitizeBase(action.baseMm)
    if (action.baseLocked) patch.baseLocked = true
    return {
      ...state,
      tokens: state.tokens.map((token) => (token.id === id ? { ...token, ...patch } : token)),
    }
  },

  // An operative's movement this turning point, as a path of 1" steps from where it
  // started. Dragging the same operative again sends the whole path (old steps plus
  // new), so a move can be continued or shortened. Cleared by undo or the next TP.
  'token/move': (state, action) => {
    const id = String(action.id ?? '')
    const token = state.tokens.find((candidate) => candidate.id === id)
    if (!token) fail('Token not found.')
    const from = token.lastMove?.from ?? { x: token.x, y: token.y }
    const steps = (Array.isArray(action.path) ? action.path : []).slice(1, MAX_PATH_POINTS).map(sanitizePoint)
    const prevMovedTp = token.lastMove ? token.lastMove.prevMovedTp ?? null : operativeUnit(state, token)?.movedTp ?? null
    const moved = setMovePath(state, id, from, [from, ...steps], { prevMovedTp })
    // Back-tracking all the way to where it started undoes the move and its activation.
    if (!steps.length) return returnToStart(restoreMovedTp(moved, token), token)
    const maxWounds = token.maxWounds ?? action.maxWounds
    const marked =
      state.phase === 'battle' && token.unitKey && isSeat(token.seat)
        ? patchUnit(moved, token.seat, token.unitKey, { movedTp: state.battle.tp }, maxWounds)
        : moved
    return autoActivate(marked, token, maxWounds)
  },

  // Undoing the whole move also undoes the activation (or counteraction) it started.
  'token/undoMove': (state, action) => {
    const token = state.tokens.find((candidate) => candidate.id === String(action.id ?? ''))
    if (!token?.lastMove) fail('Nothing to undo.')
    return returnToStart(restoreMovedTp(setMovePath(state, token.id, token.lastMove.from, [token.lastMove.from]), token), token)
  },

  'token/undoStep': (state, action) => {
    const token = state.tokens.find((candidate) => candidate.id === String(action.id ?? ''))
    if (!token?.lastMove) fail('Nothing to undo.')
    const path = token.lastMove.path.slice(0, -1)
    const next = setMovePath(state, token.id, token.lastMove.from, path, { prevMovedTp: token.lastMove.prevMovedTp ?? null })
    return path.length > 1 ? next : restoreMovedTp(next, token)
  },

  // Removing a token also removes the tokens riding on it.
  'token/remove': (state, action) => {
    const id = String(action.id ?? '')
    return dropOrphanMarkers({ ...state, tokens: state.tokens.filter((token) => token.id !== id) })
  },

  'token/clear': (state, action) =>
    dropOrphanMarkers({
      ...state,
      tokens: isSeat(action.seat) ? state.tokens.filter((token) => token.seat !== action.seat) : [],
    }),

  // Markers sit on the killzone; tokens (kind 'token') can ride on an operative
  // (attachedTo: token id) and follow it around.
  'marker/add': (state, action, actor) => {
    const marker = {
      id: `m${state.nextId}`,
      seat: isSeat(actor) ? actor : null,
      kind: String(action.kind ?? 'marker').slice(0, 24),
      catalogId: action.catalogId ? String(action.catalogId).slice(0, 48) : null,
      label: String(action.label ?? '').slice(0, 24),
      short: String(action.short ?? '').slice(0, 6),
      radius: clamp(toNumber(action.radius, 0.5), 0.1, 6),
      ring: sanitizeRing(action.ring),
      attachedTo: sanitizeHost(state, action.attachedTo),
      ...sanitizePoint(action),
    }
    return { ...state, markers: [...state.markers, marker], nextId: state.nextId + 1 }
  },

  'marker/update': (state, action) => {
    const id = String(action.id ?? '')
    const patch = {}
    if (action.x != null || action.y != null) Object.assign(patch, sanitizePoint(action), { attachedTo: null })
    if (action.attachedTo !== undefined) patch.attachedTo = sanitizeHost(state, action.attachedTo)
    if (action.label != null) patch.label = String(action.label).slice(0, 24)
    if (action.short != null) patch.short = String(action.short).slice(0, 6)
    if (action.radius != null) patch.radius = clamp(toNumber(action.radius, 0.5), 0.1, 6)
    if (action.ring != null) patch.ring = sanitizeRing(action.ring)
    return {
      ...state,
      markers: state.markers.map((marker) => (marker.id === id ? { ...marker, ...patch } : marker)),
    }
  },

  'marker/remove': (state, action) => ({
    ...state,
    markers: state.markers.filter((marker) => marker.id !== String(action.id ?? '')),
  }),
}

export const ACTION_TYPES = Object.keys(handlers)

export const applyAction = (state, action, actor, random = Math.random) => {
  const handler = handlers[action?.type]
  if (!handler) fail(`Unknown action: ${action?.type}`)
  return handler(state, action, actor, random)
}
