// @vitest-environment node
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { createGame } from '../../shared/game.js'
import { gameRecord, readHistory, recordGame } from '../history.js'

const finishedGame = () => {
  const state = createGame()
  state.phase = 'results'
  state.battle = { ...state.battle, startedAt: 1000, endedAt: 1000 + 45 * 60000 }
  state.clock = { startedAt: 400, endedAt: 1000 + 45 * 60000 + 5000 }
  state.players.A = {
    ...state.players.A,
    name: 'Alice',
    killteamId: 'VOT-HKY',
    units: ['a1', 'a2'],
    unitState: { a1: { dead: true } },
    score: { critOp: 4, killOp: 2, tacOp: 3 },
    primaryOp: { category: 'critOp' },
  }
  state.players.B = {
    ...state.players.B,
    name: 'Bob',
    killteamId: 'TAU-VESP',
    units: ['b1', 'b2', 'b3'],
    unitState: { b1: { dead: true }, b2: { dead: true } },
    score: { critOp: 1, killOp: 5, tacOp: 2 },
  }
  return state
}

const tempFile = () => join(mkdtempSync(join(tmpdir(), 'kt-history-')), 'history.json')

describe('gameRecord', () => {
  it('records VP with the primary op, kills, losses, the winner and the length', () => {
    const record = gameRecord(finishedGame())
    expect(record).toMatchObject({ id: '1000', battleMs: 45 * 60000, winner: 'A', mapId: 'map_01' })
    // The game clock (from both iPads joining), as the projector shows it.
    expect(record.durationMs).toBe(45 * 60000 + 5600)
    expect(record.players.A).toMatchObject({ name: 'Alice', vp: 11, primaryBonus: 2, primaryOp: 'critOp', kills: 2, lost: 1 })
    expect(record.players.B).toMatchObject({ name: 'Bob', vp: 8, primaryBonus: 0, kills: 1, lost: 2 })
  })

  it('calls a draw when VP are level', () => {
    const state = finishedGame()
    state.players.B.score = { critOp: 0, killOp: 6, tacOp: 5 }
    expect(gameRecord(state).winner).toBeNull()
  })
})

describe('recordGame', () => {
  it('adds games and replaces a game that reaches the results again', () => {
    const path = tempFile()
    const record = gameRecord(finishedGame())
    recordGame(path, record)
    recordGame(path, { ...record, id: 'other' })
    recordGame(path, { ...record, winner: null })
    const saved = readHistory(path)
    expect(saved.map((game) => game.id)).toEqual(['other', '1000'])
    expect(saved[1].winner).toBeNull()
  })

  it('sets a broken file aside instead of overwriting it', () => {
    const path = tempFile()
    writeFileSync(path, '[{ "id": "half an edit"')
    expect(readHistory(path)).toBeNull()
    recordGame(path, gameRecord(finishedGame()))
    expect(readHistory(path)).toHaveLength(1)
    const dir = join(path, '..')
    expect(readdirSync(dir).some((name) => name.startsWith('history.json.broken-'))).toBe(true)
  })

  it('reads a missing file as no games', () => {
    const path = tempFile()
    expect(existsSync(path)).toBe(false)
    expect(readHistory(path)).toEqual([])
    recordGame(path, gameRecord(finishedGame()))
    expect(JSON.parse(readFileSync(path, 'utf8'))).toHaveLength(1)
  })
})
