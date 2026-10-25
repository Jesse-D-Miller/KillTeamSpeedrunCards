import { randomUUID } from 'crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import { WebSocket, WebSocketServer } from 'ws'
import { SEATS, createGame, createPlayer, isSeat } from '../shared/game.js'
import { ActionError, applyAction } from '../shared/reducer.js'
import { viewFor } from '../shared/views.js'

// One table, one game. The server owns the state; devices send actions and receive
// role-filtered snapshots. Tool previews (rulers, sightlines, drags) are relayed as
// "ephemeral" messages and never stored.

const HEARTBEAT_MS = 15000
const SAVE_DELAY_MS = 250

const loadSnapshot = (path) => {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'))
    const fresh = createGame()
    // Merge over defaults so saves from older versions pick up new fields.
    const players = Object.fromEntries(
      SEATS.map((seat) => [seat, { ...createPlayer(seat), ...parsed.state?.players?.[seat] }]),
    )
    return {
      state: {
        ...fresh,
        ...parsed.state,
        players,
        table: { ...fresh.table, ...parsed.state?.table },
        battle: { ...fresh.battle, ...parsed.state?.battle },
        settings: { ...fresh.settings, ...parsed.state?.settings },
      },
      seatTokens: { A: null, B: null, ...parsed.seatTokens },
    }
  } catch {
    return { state: createGame(), seatTokens: { A: null, B: null } }
  }
}

export const createGameServer = ({ server, persistPath = null, log = console.log }) => {
  const snapshot = persistPath ? loadSnapshot(persistPath) : null
  let state = snapshot?.state ?? createGame()
  const seatTokens = snapshot?.seatTokens ?? { A: null, B: null }
  const wss = new WebSocketServer({ server, path: '/ws' })
  let saveTimer = null

  const save = () => {
    if (!persistPath) return
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      try {
        mkdirSync(dirname(persistPath), { recursive: true })
        const tmp = `${persistPath}.tmp`
        writeFileSync(tmp, JSON.stringify({ state, seatTokens }, null, 2))
        renameSync(tmp, persistPath)
      } catch (error) {
        log('Failed to save game state:', error.message)
      }
    }, SAVE_DELAY_MS)
  }

  const send = (socket, payload) => {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload))
  }

  const clients = () => Array.from(wss.clients).filter((socket) => socket.role)

  const presence = () => {
    const connected = clients()
    return {
      A: connected.some((socket) => socket.seat === 'A'),
      B: connected.some((socket) => socket.seat === 'B'),
      tables: connected.filter((socket) => socket.role === 'table').length,
      claimed: { A: Boolean(seatTokens.A), B: Boolean(seatTokens.B) },
    }
  }

  const sendState = (socket, meta = presence()) => {
    send(socket, { type: 'state', state: viewFor(state, socket.seat || 'table'), presence: meta })
  }

  const broadcastState = () => {
    const meta = presence()
    clients().forEach((socket) => sendState(socket, meta))
  }

  const relay = (from, payload) => {
    clients().forEach((socket) => {
      if (socket !== from.socket) send(socket, { type: 'ephemeral', from: from.id, payload })
    })
  }

  const releaseSeat = (seat) => {
    seatTokens[seat] = null
    clients()
      .filter((socket) => socket.seat === seat)
      .forEach((socket) => {
        send(socket, { type: 'released', seat })
        socket.role = null
        socket.seat = null
      })
    relay({ id: seat, socket: null }, null)
    save()
    broadcastState()
  }

  const handleHello = (socket, message) => {
    if (message.role === 'table') {
      socket.role = 'table'
      socket.seat = null
      socket.clientId = `table-${randomUUID().slice(0, 6)}`
      send(socket, { type: 'welcome', role: 'table', clientId: socket.clientId })
      broadcastState()
      return
    }
    const seat = message.seat
    if (!isSeat(seat)) {
      send(socket, { type: 'error', message: 'Unknown seat.' })
      return
    }
    const owned = seatTokens[seat] && seatTokens[seat] === message.token
    if (seatTokens[seat] && !owned && !message.takeover) {
      send(socket, { type: 'seat_taken', seat })
      return
    }
    if (!owned) {
      // A takeover kicks whichever device held the seat before.
      clients()
        .filter((other) => other.seat === seat)
        .forEach((other) => {
          send(other, { type: 'released', seat })
          other.role = null
          other.seat = null
        })
      seatTokens[seat] = randomUUID()
      save()
    }
    socket.role = 'seat'
    socket.seat = seat
    socket.clientId = seat
    send(socket, { type: 'welcome', role: 'seat', seat, token: seatTokens[seat] })
    broadcastState()
  }

  const handleAction = (socket, message) => {
    try {
      state = applyAction(state, message.action ?? {}, socket.seat || 'table')
      if (message.id != null) send(socket, { type: 'ack', id: message.id })
      save()
      broadcastState()
    } catch (error) {
      if (!(error instanceof ActionError)) log('Action failed:', error)
      send(socket, { type: 'error', id: message.id, message: error.message })
    }
  }

  wss.on('connection', (socket) => {
    socket.isAlive = true
    socket.on('pong', () => {
      socket.isAlive = true
    })

    socket.on('message', (raw) => {
      let message
      try {
        message = JSON.parse(raw.toString())
      } catch {
        send(socket, { type: 'error', message: 'Invalid message.' })
        return
      }
      if (message.type === 'hello') return handleHello(socket, message)
      if (!socket.role) {
        send(socket, { type: 'error', message: 'Say hello first.' })
        return
      }
      if (message.type === 'action') return handleAction(socket, message)
      if (message.type === 'ephemeral') return relay({ id: socket.clientId, socket }, message.payload ?? null)
      if (message.type === 'release_seat') {
        const seat = isSeat(message.seat) ? message.seat : socket.seat
        if (seat) releaseSeat(seat)
        return
      }
      if (message.type === 'sync') return sendState(socket)
    })

    socket.on('close', () => {
      if (socket.clientId) relay({ id: socket.clientId, socket }, null)
      if (socket.role) broadcastState()
    })
  })

  const heartbeat = setInterval(() => {
    wss.clients.forEach((socket) => {
      if (!socket.isAlive) {
        socket.terminate()
        return
      }
      socket.isAlive = false
      socket.ping()
    })
  }, HEARTBEAT_MS)

  wss.on('close', () => clearInterval(heartbeat))

  return {
    wss,
    getState: () => state,
    close: () => {
      clearInterval(heartbeat)
      clearTimeout(saveTimer)
      wss.clients.forEach((socket) => socket.terminate())
      wss.close()
    },
  }
}

