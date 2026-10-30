import { act, cleanup, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createGame } from '../../../shared/game.js'
import { viewFor } from '../../../shared/views.js'
import { GameProvider } from '../GameProvider.jsx'
import { useGame } from '../gameContext.js'

// A WebSocket the test drives: open it, deliver messages, read what was sent. Like an
// iPad's dead connection, it never closes by itself.
class FakeSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  static all = []

  constructor(url) {
    this.url = url
    this.readyState = FakeSocket.CONNECTING
    this.sent = []
    this.listeners = {}
    FakeSocket.all.push(this)
  }

  addEventListener(type, listener) {
    ;(this.listeners[type] ??= []).push(listener)
  }

  emit(type, event = {}) {
    ;(this.listeners[type] ?? []).forEach((listener) => listener(event))
  }

  send(raw) {
    this.sent.push(JSON.parse(raw))
  }

  close() {
    if (this.readyState === FakeSocket.CLOSED) return
    this.readyState = FakeSocket.CLOSED
    this.emit('close')
  }

  open() {
    this.readyState = FakeSocket.OPEN
    this.emit('open')
  }

  receive(message) {
    this.emit('message', { data: JSON.stringify(message) })
  }

  ofType(type) {
    return this.sent.filter((message) => message.type === type)
  }
}

let game

function Probe() {
  const value = useGame()
  useEffect(() => {
    game = value
  })
  return (
    <>
      <span data-testid="name">{value.state?.players.A.name}</span>
      <span data-testid="status">{value.status}</span>
    </>
  )
}

const latest = () => FakeSocket.all.at(-1)

const join = (socket, state = createGame()) =>
  act(() => {
    socket.open()
    socket.receive({ type: 'welcome', role: 'seat', seat: 'A', token: 'token-A' })
    socket.receive({ type: 'state', state: viewFor(state, 'A'), presence: {} })
  })

const rename = (name) => act(() => game.act({ type: 'player/rename', name }))

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('WebSocket', FakeSocket)
  FakeSocket.all = []
  render(
    <GameProvider role="seat" seat="A">
      <Probe />
    </GameProvider>,
  )
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('GameProvider', () => {
  it('shows an action straight away and keeps it until the server confirms it', () => {
    const socket = latest()
    join(socket)
    rename('Jesse')
    expect(screen.getByTestId('name')).toHaveTextContent('Jesse')
    const [sent] = socket.ofType('action')
    expect(sent.action).toEqual({ type: 'player/rename', name: 'Jesse' })

    // An unrelated update before the confirmation still shows it.
    act(() => socket.receive({ type: 'state', state: viewFor(createGame(), 'A'), presence: {} }))
    expect(screen.getByTestId('name')).toHaveTextContent('Jesse')

    // Confirmed: from now on the server's state is shown as it is.
    const renamed = createGame()
    renamed.players.A.name = 'Jesse'
    act(() => socket.receive({ type: 'state', state: viewFor(renamed, 'A'), presence: {}, ack: sent.id }))
    act(() => socket.receive({ type: 'state', state: viewFor(createGame(), 'A'), presence: {} }))
    expect(screen.getByTestId('name')).toHaveTextContent('Player A')
  })

  it('drops an action the server refuses', async () => {
    const socket = latest()
    join(socket)
    let refused = null
    act(() => {
      game.dispatch({ type: 'player/rename', name: 'Nope' }).catch((error) => {
        refused = error
      })
    })
    const [sent] = socket.ofType('action')
    await act(async () => socket.receive({ type: 'error', id: sent.id, message: 'Not now.' }))
    expect(refused?.message).toBe('Not now.')
    expect(screen.getByTestId('name')).toHaveTextContent('Player A')
  })

  it('replaces a connection that stops answering and re-sends what wasn’t confirmed', () => {
    const first = latest()
    join(first)
    rename('Jesse')
    const [sent] = first.ofType('action')

    act(() => vi.advanceTimersByTime(5000))
    expect(first.ofType('ping')).toHaveLength(1)
    act(() => vi.advanceTimersByTime(7000))
    expect(screen.getByTestId('status')).toHaveTextContent('offline')
    // Still shown while it waits to go through.
    expect(screen.getByTestId('name')).toHaveTextContent('Jesse')

    act(() => vi.advanceTimersByTime(300))
    const second = latest()
    expect(second).not.toBe(first)
    join(second)
    expect(second.ofType('hello')[0]).toMatchObject({ seat: 'A', token: 'token-A' })
    expect(second.ofType('action')).toEqual([sent])
  })

  it('keeps a connection that answers its pings', () => {
    const socket = latest()
    join(socket)
    for (let i = 0; i < 5; i += 1) {
      act(() => vi.advanceTimersByTime(4000))
      act(() => socket.receive({ type: 'pong' }))
    }
    expect(socket.ofType('ping').length).toBeGreaterThanOrEqual(4)
    expect(FakeSocket.all).toHaveLength(1)
    expect(screen.getByTestId('status')).toHaveTextContent('online')
  })

  it('checks the connection on waking and reconnects at once if it doesn’t answer', () => {
    const first = latest()
    join(first)
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(first.ofType('ping')).toHaveLength(1)
    act(() => vi.advanceTimersByTime(3000))
    expect(latest()).not.toBe(first)
  })

  it('queues an action made while offline and sends it on reconnecting', () => {
    const first = latest()
    join(first)
    act(() => first.close())
    rename('Offline')
    expect(screen.getByTestId('name')).toHaveTextContent('Offline')
    act(() => vi.advanceTimersByTime(300))
    const second = latest()
    expect(second.ofType('action')).toHaveLength(0)
    join(second)
    expect(second.ofType('action')).toHaveLength(1)
  })

  it('waits for the server when an action changes the phase', () => {
    const socket = latest()
    const waiting = createGame()
    waiting.ready.B = true
    join(socket, waiting)
    act(() => game.act({ type: 'phase/ready', ready: true }))
    expect(game.state.phase).toBe('lobby')
    expect(socket.ofType('action')).toHaveLength(1)
  })
})
