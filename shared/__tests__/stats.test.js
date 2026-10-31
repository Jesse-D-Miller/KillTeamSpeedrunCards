import { describe, expect, it } from 'vitest'
import { gameCount, leaderboard, playerKey, prizes } from '../stats.js'

const game = (id, a, b, extra = {}) => ({
  id,
  endedAt: `2026-10-${String(id).padStart(2, '0')}T20:00:00.000Z`,
  durationMs: 3600000,
  ...extra,
  players: {
    A: { name: a[0], vp: a[1], kills: a[2] ?? 0, killteamId: a[3] ?? 'VOT-HKY' },
    B: { name: b[0], vp: b[1], kills: b[2] ?? 0, killteamId: b[3] ?? 'TAU-VESP' },
  },
})

const prize = (games, id) => prizes(games).find((entry) => entry.id === id).places

describe('stats leaderboard', () => {
  it('ranks by win rate, a draw counting as half a win', () => {
    const games = [
      game(1, ['Alice', 14], ['Bob', 6]),
      game(2, ['Alice', 8], ['Bob', 8], { winner: null }),
      game(3, ['Cara', 10], ['Bob', 9]),
    ]
    const board = leaderboard(games)
    expect(board.map((row) => row.name)).toEqual(['Cara', 'Alice', 'Bob'])
    const alice = board.find((row) => row.name === 'Alice')
    expect(alice).toMatchObject({ games: 2, wins: 1, draws: 1, losses: 0, winRate: 0.75, totalVp: 22, avgVp: 11 })
  })

  it('merges names that differ only in case or spacing, showing the latest spelling', () => {
    const board = leaderboard([game(1, ['alice ', 10], ['Bob', 5]), game(2, ['Alice', 10], ['Bob', 5])])
    expect(board).toHaveLength(2)
    expect(board[0]).toMatchObject({ name: 'Alice', games: 2 })
    expect(playerKey(' ALICE ')).toBe('alice')
  })

  it('picks the team played most', () => {
    const board = leaderboard([
      game(1, ['Alice', 10, 0, 'ORK-KOM'], ['Bob', 5]),
      game(2, ['Alice', 10, 0, 'ORK-KOM'], ['Bob', 5]),
      game(3, ['Alice', 10, 0, 'VOT-HKY'], ['Bob', 5]),
    ])
    expect(board[0].killteamId).toBe('ORK-KOM')
  })

  it('skips games without two named players and counts missing numbers as zero', () => {
    const games = [game(1, ['Alice', 'x'], ['Bob', 4]), { id: 'junk' }, game(2, ['', 3], ['Bob', 2]), null]
    expect(gameCount(games)).toBe(1)
    expect(leaderboard(games)[0]).toMatchObject({ name: 'Bob', wins: 1 })
    expect(leaderboard('not a list')).toEqual([])
  })
})

describe('stats prizes', () => {
  const games = [
    game(1, ['Alice', 14, 6], ['Bob', 6, 2], { durationMs: 40 * 60000 }),
    game(2, ['Cara', 14, 3], ['Bob', 9, 4], { durationMs: 90 * 60000 }),
    game(3, ['Dan', 12, 1], ['Alice', 11, 5], { durationMs: 55 * 60000 }),
    game(4, ['Eve', 2, 0], ['Bob', 1, 0], { durationMs: 70 * 60000 }),
  ]

  it('gives ties the same place', () => {
    const places = prize(games, 'mostVpGame')
    expect(places.map((row) => [row.place, row.name, row.value])).toEqual([
      [1, 'Alice', 14],
      [1, 'Cara', 14],
      [3, 'Dan', 12],
    ])
  })

  it('gives each player only their best game on a podium', () => {
    const repeat = [...games, game(5, ['Alice', 13], ['Eve', 2]), game(6, ['Alice', 13], ['Eve', 3])]
    expect(prize(repeat, 'mostVpGame').filter((row) => row.name === 'Alice')).toHaveLength(1)
  })

  it('totals kills and games per player', () => {
    expect(prize(games, 'kills')[0]).toMatchObject({ place: 1, name: 'Alice', value: 11 })
    expect(prize(games, 'games')[0]).toMatchObject({ place: 1, name: 'Bob', value: 3 })
  })

  it('finds the fastest and longest games', () => {
    expect(prize(games, 'fastest')[0]).toMatchObject({ name: 'Alice vs Bob', value: 40 * 60000 })
    expect(prize(games, 'longest')[0]).toMatchObject({ name: 'Cara vs Bob', value: 90 * 60000 })
  })

  it('measures the biggest win by VP margin', () => {
    expect(prize(games, 'biggestWin')[0]).toMatchObject({ name: 'Alice', value: 8, detail: '14–6 vs Bob' })
  })

  it('only averages players with three or more games', () => {
    expect(prize(games, 'avgVp').map((row) => row.name)).toEqual(['Bob'])
  })
})
