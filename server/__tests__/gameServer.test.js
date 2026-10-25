// @vitest-environment node
import { createServer } from 'http'
import { mkdtempSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import { createGameServer } from '../gameServer.js'

let httpServer
let game
let url
let persistPath
const sockets = []

const connect = () =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(url)
    const inbox = []
    const waiters = []
    socket.on('message', (raw) => {
      const message = JSON.parse(raw.toString())
      const index = waiters.findIndex((waiter) => waiter.match(message))
      if (index >= 0) waiters.splice(index, 1)[0].resolve(message)
      else inbox.push(message)
    })
    socket.next = (type, predicate = () => true) => {
      const match = (message) => message.type === type && predicate(message)
      const index = inbox.findIndex(match)
      if (index >= 0) return Promise.resolve(inbox.splice(index, 1)[0])
      return new Promise((done) => waiters.push({ match, resolve: done }))
    }
    socket.drain = () => inbox.splice(0)
    socket.sendJson = (payload) => socket.send(JSON.stringify(payload))
    socket.on('open', () => resolve(socket))
    socket.on('error', reject)
    sockets.push(socket)
  })

const join_ = async (hello) => {
  const socket = await connect()
  socket.sendJson({ type: 'hello', ...hello })
  return socket
}

beforeEach(async () => {
  persistPath = join(mkdtempSync(join(tmpdir(), 'kt-')), 'game.json')
  httpServer = createServer()
  game = createGameServer({ server: httpServer, persistPath, log: () => {} })
  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve))
  url = `ws://127.0.0.1:${httpServer.address().port}/ws`
})

afterEach(async () => {
  sockets.splice(0).forEach((socket) => socket.terminate())
  game.close()
  await new Promise((resolve) => httpServer.close(resolve))
})

describe('game server', () => {
  it('lets a seat reclaim with its token and blocks other devices', async () => {
    const first = await join_({ role: 'seat', seat: 'A' })
    const welcome = await first.next('welcome')
    expect(welcome.token).toBeTruthy()

    const intruder = await join_({ role: 'seat', seat: 'A' })
    await intruder.next('seat_taken')

    first.terminate()
    const again = await join_({ role: 'seat', seat: 'A', token: welcome.token })
    const rewelcome = await again.next('welcome')
    expect(rewelcome.token).toBe(welcome.token)
  })

  it('takeover kicks the previous device', async () => {
    const first = await join_({ role: 'seat', seat: 'B' })
    await first.next('welcome')
    const second = await join_({ role: 'seat', seat: 'B', takeover: true })
    await second.next('welcome')
    await first.next('released')
  })

  it('broadcasts filtered state after an action', async () => {
    const table = await join_({ role: 'table' })
    await table.next('welcome')
    const seatA = await join_({ role: 'seat', seat: 'A' })
    await seatA.next('welcome')
    table.drain()
    seatA.drain()

    const tacOp = { id: 'flank', label: 'Flank' }
    seatA.sendJson({ type: 'action', id: 1, action: { type: 'muster/tacOp', tacOp } })
    await seatA.next('ack', (message) => message.id === 1)

    const mine = await seatA.next('state', (message) => message.state.players.A.tacOp)
    expect(mine.state.players.A.tacOp).toEqual(tacOp)
    const tableView = await table.next('state', (message) => message.state.players.A.tacOp)
    expect(tableView.state.players.A.tacOp).toEqual({ hidden: true })
  })

  it('reports invalid actions only to the sender', async () => {
    const seatA = await join_({ role: 'seat', seat: 'A' })
    await seatA.next('welcome')
    seatA.sendJson({ type: 'action', id: 7, action: { type: 'battle/togglePloy', ployId: 'x' } })
    seatA.sendJson({ type: 'action', id: 8, action: { type: 'bogus' } })
    const error = await seatA.next('error', (message) => message.id === 8)
    expect(error.message).toMatch(/Unknown action/)
  })

  it('relays ephemeral tool previews to other devices', async () => {
    const table = await join_({ role: 'table' })
    await table.next('welcome')
    const seatB = await join_({ role: 'seat', seat: 'B' })
    await seatB.next('welcome')
    seatB.sendJson({ type: 'ephemeral', payload: { tool: 'measure', points: [{ x: 1, y: 1 }] } })
    const message = await table.next('ephemeral')
    expect(message.from).toBe('B')
    expect(message.payload.tool).toBe('measure')

    seatB.close()
    const cleared = await table.next('ephemeral', (next) => next.payload === null)
    expect(cleared.from).toBe('B')
  })

  it('persists state to disk', async () => {
    const seatA = await join_({ role: 'seat', seat: 'A' })
    await seatA.next('welcome')
    seatA.sendJson({ type: 'action', id: 1, action: { type: 'player/rename', name: 'Jesse' } })
    await seatA.next('ack')
    await new Promise((resolve) => setTimeout(resolve, 400))
    const saved = JSON.parse(readFileSync(persistPath, 'utf8'))
    expect(saved.state.players.A.name).toBe('Jesse')
    expect(saved.seatTokens.A).toBeTruthy()
  })
})
