import { SEATS, otherSeat } from './game.js'

// The stats page: a win-rate leaderboard and podium prizes, worked out from the saved
// games (server/data/history.json). The file is hand-edited, so anything missing counts
// as zero and games without two named players are skipped.

// A player is their name, ignoring case and spacing, so fixing a typo in the file
// merges the two.
export const playerKey = (name) => String(name ?? '').trim().toLowerCase()

const number = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)

const validGames = (games) =>
  (Array.isArray(games) ? games : []).filter((game) =>
    SEATS.every((seat) => playerKey(game?.players?.[seat]?.name)),
  )

// The game's winner by VP when the record doesn't say (or says something odd).
const winnerOf = (game) => {
  if (game.winner === null || SEATS.includes(game.winner)) return game.winner
  const [a, b] = SEATS.map((seat) => number(game.players[seat].vp))
  return a === b ? null : a > b ? 'A' : 'B'
}

const mostCommon = (values) => {
  const counts = new Map()
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1))
  return [...counts.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null
}

export const leaderboard = (games) => {
  const players = new Map()
  // Oldest first, so a player's shown name is the spelling they used last.
  const ordered = [...validGames(games)].sort((x, y) => String(x.endedAt ?? '').localeCompare(String(y.endedAt ?? '')))
  ordered.forEach((game) => {
    const winner = winnerOf(game)
    SEATS.forEach((seat) => {
      const entry = game.players[seat]
      const key = playerKey(entry.name)
      const row = players.get(key) ?? { key, name: '', games: 0, wins: 0, losses: 0, draws: 0, totalVp: 0, kills: 0, teams: [] }
      row.name = String(entry.name).trim()
      row.games += 1
      if (winner === null) row.draws += 1
      else if (winner === seat) row.wins += 1
      else row.losses += 1
      row.totalVp += number(entry.vp)
      row.kills += number(entry.kills)
      row.teams.push(entry.killteamId)
      players.set(key, row)
    })
  })
  return [...players.values()]
    .map(({ teams, ...row }) => ({
      ...row,
      // A draw is half a win.
      winRate: (row.wins + row.draws / 2) / row.games,
      avgVp: row.totalVp / row.games,
      killteamId: mostCommon(teams),
    }))
    .sort((x, y) => y.winRate - x.winRate || y.games - x.games || y.avgVp - x.avgVp || x.name.localeCompare(y.name))
}

// The top three places, best first. Ties share a place (two firsts, then a third).
// Each name only takes its best result, so one player can't fill the podium alone.
const podium = (rows, { lowest = false } = {}) => {
  const better = (x, y) => (lowest ? x.value < y.value : x.value > y.value)
  const best = new Map()
  rows.forEach((row) => {
    const key = playerKey(row.name)
    if (!best.has(key) || better(row, best.get(key))) best.set(key, row)
  })
  const ranked = [...best.values()]
  return ranked
    .map((row) => ({ ...row, place: 1 + ranked.filter((other) => better(other, row)).length }))
    .filter((row) => row.place <= 3)
    .sort((x, y) => x.place - y.place || x.name.localeCompare(y.name))
}

const matchName = (game) => `${game.players.A.name} vs ${game.players.B.name}`

// kind tells the page how to show the value: 'vp', 'count' or 'duration' (ms).
export const prizes = (games) => {
  const valid = validGames(games)
  const board = leaderboard(valid)
  const perPlayer = (field) => board.filter((row) => row[field] > 0).map((row) => ({ name: row.name, value: row[field] }))
  const timed = valid
    .filter((game) => number(game.durationMs) > 0)
    .map((game) => ({ name: matchName(game), value: number(game.durationMs), detail: game.endedAt }))

  return [
    {
      id: 'mostVpGame',
      title: 'Most VP in a game',
      kind: 'vp',
      places: podium(
        valid.flatMap((game) =>
          SEATS.map((seat) => ({
            name: String(game.players[seat].name).trim(),
            value: number(game.players[seat].vp),
            detail: `vs ${game.players[otherSeat(seat)].name}`,
          })),
        ).filter((row) => row.value > 0),
      ),
    },
    { id: 'totalVp', title: 'Total VP', kind: 'vp', places: podium(perPlayer('totalVp')) },
    { id: 'kills', title: 'Total kills', kind: 'count', places: podium(perPlayer('kills')) },
    { id: 'wins', title: 'Most wins', kind: 'count', places: podium(perPlayer('wins')) },
    { id: 'games', title: 'Games played', kind: 'count', places: podium(perPlayer('games')) },
    { id: 'fastest', title: 'Fastest game', kind: 'duration', places: podium(timed, { lowest: true }) },
    { id: 'longest', title: 'Longest game', kind: 'duration', places: podium(timed) },
    {
      id: 'avgVp',
      title: 'Best average VP',
      note: '3+ games',
      kind: 'vp',
      places: podium(board.filter((row) => row.games >= 3).map((row) => ({ name: row.name, value: Math.round(row.avgVp * 10) / 10 }))),
    },
    {
      id: 'biggestWin',
      title: 'Biggest win',
      kind: 'vp',
      places: podium(
        valid
          .filter((game) => winnerOf(game))
          .map((game) => {
            const winner = winnerOf(game)
            const [won, lost] = [game.players[winner], game.players[otherSeat(winner)]]
            return {
              name: String(won.name).trim(),
              value: number(won.vp) - number(lost.vp),
              detail: `${number(won.vp)}–${number(lost.vp)} vs ${lost.name}`,
            }
          })
          .filter((row) => row.value > 0),
      ),
    },
  ]
}

export const gameCount = (games) => validGames(games).length
