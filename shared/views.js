import { SEATS } from './game.js'

// viewFor(state, role) -> the slice of state a given device is allowed to see.
//   role: 'A' | 'B' | 'table'
// Hidden information never leaves the server: the opponent's (and the table's) copy
// has secrets replaced with { hidden: true } placeholders.

const HIDDEN = { hidden: true }

const SECRET_ROSTER_PHASES = new Set(['lobby', 'setup', 'muster'])

const redactPlayer = (player, phase) => {
  const redacted = { ...player }

  if (player.tacOp && !player.tacOpRevealed && phase !== 'results') {
    redacted.tacOp = HIDDEN
  }
  if (player.primaryOp && phase !== 'results') {
    redacted.primaryOp = HIDDEN
  }
  if (SECRET_ROSTER_PHASES.has(phase)) {
    redacted.units = player.units.map(() => HIDDEN)
    redacted.weapons = {}
    redacted.equipment = player.equipment.map(() => HIDDEN)
  }
  return redacted
}

export const viewFor = (state, role) => {
  const players = {}
  SEATS.forEach((seat) => {
    players[seat] =
      seat === role ? state.players[seat] : redactPlayer(state.players[seat], state.phase)
  })
  return { ...state, players }
}

export const isHidden = (value) => Boolean(value && value.hidden === true)
