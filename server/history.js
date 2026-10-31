import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import { SEATS, otherSeat, primaryBonus, primaryCategory, totalVp } from '../shared/game.js'

// Every game that reaches the results is kept in a JSON file (server/data/history.json)
// for the stats page. It's meant to be fixed by hand (a typo in a name, a test game to
// delete), so it's a plain, pretty-printed array with one record per game.

const deadCount = (player) => (player?.units ?? []).filter((unitKey) => player.unitState?.[unitKey]?.dead).length

// The record for a finished game: the same VP the results screen shows (primary op
// included). Kills are the opponent's operatives dead at the end.
export const gameRecord = (state) => {
  const { battle, clock, table, players } = state
  const vp = Object.fromEntries(SEATS.map((seat) => [seat, totalVp(players[seat], { withPrimary: true })]))
  const startedAt = battle.startedAt ?? null
  const endedAt = battle.endedAt ?? Date.now()
  // The game's length is the projector's game clock (from both iPads joining to the
  // results), the time the players see; battleMs is turning point 1 to the results.
  const clockMs = clock?.startedAt && clock?.endedAt ? clock.endedAt - clock.startedAt : null
  const battleMs = startedAt ? endedAt - startedAt : null
  return {
    // One id per game, so reaching the results twice (back to battle and on again)
    // replaces the record instead of counting the game twice.
    id: String(startedAt ?? clock?.startedAt ?? endedAt),
    endedAt: new Date(endedAt).toISOString(),
    durationMs: clockMs ?? battleMs,
    battleMs,
    mapId: table.mapId,
    winner: vp.A === vp.B ? null : vp.A > vp.B ? 'A' : 'B',
    players: Object.fromEntries(
      SEATS.map((seat) => {
        const player = players[seat]
        return [
          seat,
          {
            name: player.name,
            killteamId: player.killteamId,
            vp: vp[seat],
            score: { ...player.score },
            primaryOp: primaryCategory(player),
            primaryBonus: primaryBonus(player),
            tacOp: player.tacOp?.id ?? null,
            kills: deadCount(players[otherSeat(seat)]),
            lost: deadCount(player),
          },
        ]
      }),
    ),
  }
}

// A missing or unreadable file reads as no games (the stats page shows none rather
// than breaking while the file is being hand-edited).
export const readHistory = (path) => {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'))
    return Array.isArray(parsed) ? parsed : null
  } catch (error) {
    return error.code === 'ENOENT' ? [] : null
  }
}

export const recordGame = (path, record) => {
  let games = readHistory(path)
  // A file that doesn't parse (a bad hand edit) is set aside, never overwritten, so
  // no past games are lost; the new game starts a fresh file.
  if (!games) {
    renameSync(path, `${path}.broken-${Date.now()}`)
    games = []
  }
  games = games.filter((game) => game?.id !== record.id)
  games.push(record)
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, `${JSON.stringify(games, null, 2)}\n`)
  renameSync(tmp, path)
  return games
}
