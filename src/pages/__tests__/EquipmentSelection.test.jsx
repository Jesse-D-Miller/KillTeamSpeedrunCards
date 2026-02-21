import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EquipmentSelection from '../EquipmentSelection.jsx'
import { SelectionProvider } from '../../state/SelectionContext.jsx'

class MockWebSocket {
  static OPEN = 1

  constructor() {
    this.readyState = MockWebSocket.OPEN
    this.sent = []
    this.listeners = {}
    MockWebSocket.instances.push(this)
  }

  addEventListener(type, handler) {
    this.listeners[type] = this.listeners[type] || new Set()
    this.listeners[type].add(handler)
  }

  removeEventListener(type, handler) {
    this.listeners[type]?.delete(handler)
  }

  send(payload) {
    this.sent.push(payload)
  }

  close() {
    this.readyState = 3
  }

  emit(type, event) {
    this.listeners[type]?.forEach((handler) => handler(event))
  }
}

MockWebSocket.instances = []

describe('EquipmentSelection multiplayer start', () => {
  beforeEach(() => {
    MockWebSocket.instances = []
    vi.stubGlobal('WebSocket', MockWebSocket)
    window.WebSocket = MockWebSocket
    localStorage.clear()
    localStorage.setItem('kt-room-code', 'ROOM01')
    localStorage.setItem('kt-player-name', 'Host')
    localStorage.setItem('kt-player-id', 'player-1')
  })

  afterEach(() => {
    cleanup()
  })

  const renderPage = () =>
    render(
      <SelectionProvider>
        <MemoryRouter initialEntries={['/select-army/IMP-AOD/equipment']}>
          <Routes>
            <Route
              path="/select-army/:killteamId/equipment"
              element={<EquipmentSelection />}
            />
            <Route path="/game/:killteamId" element={<div>GAME</div>} />
          </Routes>
        </MemoryRouter>
      </SelectionProvider>,
    )

  it('navigates immediately on Start Game', async () => {
    const user = userEvent.setup()
    renderPage()
    const socket = MockWebSocket.instances[0]
    socket.emit('open')

    await user.click(
      await screen.findByRole('button', { name: /start game/i }),
    )

    expect(await screen.findByText('GAME')).toBeInTheDocument()
  })

  it('sends sync_state with room code and player id', async () => {
    const user = userEvent.setup()
    renderPage()
    const socket = MockWebSocket.instances[0]
    socket.emit('open')

    await user.click(
      await screen.findByRole('button', { name: /start game/i }),
    )

    const syncPayload = socket.sent.find((payload) => {
      const parsed = JSON.parse(payload)
      return parsed.type === 'sync_state'
    })

    expect(syncPayload).toBeTruthy()
    const parsed = JSON.parse(syncPayload)
    expect(parsed.code).toBe('ROOM01')
    expect(parsed.playerId).toBe('player-1')
  })
})
