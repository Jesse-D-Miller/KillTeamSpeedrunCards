import http from 'http'
import { WebSocketServer } from 'ws'

const PORT = Number.parseInt(process.env.PORT || '8080', 10)
const MAX_PLAYERS = 2
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('ok')
    return
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('Multiplayer server running')
})

const wss = new WebSocketServer({
  server,
  verifyClient: ALLOWED_ORIGINS.length
    ? (info, done) => {
        const origin = info.origin || ''
        const allowed = ALLOWED_ORIGINS.some((allowedOrigin) =>
          origin.startsWith(allowedOrigin),
        )
        done(allowed, allowed ? 200 : 403, 'Forbidden')
      }
    : undefined,
})

const rooms = new Map()

const isMapName = (value) => String(value || '').trim().toUpperCase() === 'MAP'

const getNonMapPlayers = (room) =>
  Array.from(room.players.values()).filter(
    (player) => !isMapName(player.name),
  )

const hasMapPlayer = (room) =>
  Array.from(room.players.values()).some((player) => isMapName(player.name))

const randomId = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

const generateRoomCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return code
}

const ensureRoomCode = () => {
  let code = generateRoomCode()
  while (rooms.has(code)) {
    code = generateRoomCode()
  }
  return code
}

const sendJson = (socket, payload) => {
  if (!socket || socket.readyState !== socket.OPEN) return false
  socket.send(JSON.stringify(payload))
  return true
}

const broadcast = (room, payload) => {
  room.players.forEach((player) => {
    sendJson(player.ws, payload)
  })
}

const getPlayersArray = (room) =>
  Array.from(room.players.values()).map((player) => ({
    id: player.id,
    name: player.name,
    ready: Boolean(player.ready),
  }))

const sendRoomUpdate = (room) => {
  broadcast(room, {
    type: 'room_update',
    players: getPlayersArray(room),
    hostId: room.hostId,
  })
}

const tryStartGame = (room) => {
  const nonMapPlayers = getNonMapPlayers(room)
  if (nonMapPlayers.length < MAX_PLAYERS) return
  const allReady = nonMapPlayers.every((player) => player.ready)
  if (!allReady) return
  const startTime = Date.now()
  broadcast(room, {
    type: 'game_started',
    code: room.code,
    startTime,
  })
}

const registerPlayer = (room, { id, name, ws }) => {
  room.players.set(id, {
    id,
    name,
    ready: false,
    ws,
  })
}

const getOpponentId = (room, playerId) =>
  Array.from(room.players.keys()).find((id) => id !== playerId) || null

const handleDisconnect = (socket) => {
  const roomCode = socket.roomCode
  const playerId = socket.playerId
  if (!roomCode || !playerId) return
  const room = rooms.get(roomCode)
  if (!room) return
  room.players.delete(playerId)
  room.states.delete(playerId)
  if (room.hostId === playerId) {
    const nextHost = room.players.keys().next().value
    room.hostId = nextHost || ''
  }
  if (room.players.size === 0) {
    rooms.delete(roomCode)
    return
  }
  sendRoomUpdate(room)
}

wss.on('connection', (socket) => {
  socket.on('message', (data) => {
    let message
    try {
      message = JSON.parse(data.toString())
    } catch (error) {
      sendJson(socket, { type: 'error', message: 'Invalid payload.' })
      return
    }

    if (message.type === 'create_room') {
      const name = String(message.name || '').trim()
      if (!name) {
        sendJson(socket, { type: 'error', message: 'Name required.' })
        return
      }
      const code = ensureRoomCode()
      const playerId = randomId()
      const room = {
        code,
        hostId: playerId,
        players: new Map(),
        states: new Map(),
      }
      rooms.set(code, room)
      socket.roomCode = code
      socket.playerId = playerId
      registerPlayer(room, { id: playerId, name, ws: socket })
      sendJson(socket, {
        type: 'room_created',
        code,
        players: getPlayersArray(room),
        playerId,
        hostId: room.hostId,
      })
      return
    }

    if (message.type === 'join_room') {
      const code = String(message.code || '').trim().toUpperCase()
      const name = String(message.name || '').trim()
      const room = rooms.get(code)
      if (!room) {
        sendJson(socket, { type: 'error', message: 'Room not found.' })
        return
      }
      const isMap = isMapName(name) || message.isMap === true
      const resolvedName = isMap ? 'MAP' : name
      if (isMap && hasMapPlayer(room)) {
        sendJson(socket, { type: 'error', message: 'Map already joined.' })
        return
      }
      if (!isMap && getNonMapPlayers(room).length >= MAX_PLAYERS) {
        sendJson(socket, { type: 'error', message: 'Room is full.' })
        return
      }
      const playerId = randomId()
      socket.roomCode = code
      socket.playerId = playerId
      registerPlayer(room, { id: playerId, name: resolvedName, ws: socket })
      sendJson(socket, {
        type: 'room_joined',
        code,
        players: getPlayersArray(room),
        playerId,
        hostId: room.hostId,
      })
      sendRoomUpdate(room)
      return
    }

    if (message.type === 'set_ready') {
      const code = message.code
      const playerId = message.playerId
      const room = rooms.get(code)
      if (!room || !room.players.has(playerId)) {
        sendJson(socket, { type: 'error', message: 'Room not found.' })
        return
      }
      const player = room.players.get(playerId)
      player.ready = Boolean(message.ready)
      sendRoomUpdate(room)
      tryStartGame(room)
      return
    }

    if (message.type === 'sync_init') {
      const code = String(message.code || '').trim().toUpperCase()
      const playerId = String(message.playerId || '').trim()
      const name = String(message.name || '').trim()
      if (!code || !playerId) {
        sendJson(socket, { type: 'error', message: 'Missing room data.' })
        return
      }
      const room = rooms.get(code)
      if (!room) {
        sendJson(socket, { type: 'error', message: 'Room not found.' })
        return
      }
      socket.roomCode = code
      socket.playerId = playerId
      if (!room.players.has(playerId)) {
        if (room.players.size >= 2) {
          sendJson(socket, { type: 'error', message: 'Room is full.' })
          return
        }
        registerPlayer(room, { id: playerId, name: name || 'Player', ws: socket })
      } else {
        const existing = room.players.get(playerId)
        existing.ws = socket
        if (name) existing.name = name
      }
      sendJson(socket, { type: 'sync_ready' })
      sendRoomUpdate(room)
      return
    }

    if (message.type === 'sync_state') {
      const code = message.code
      const playerId = message.playerId
      const room = rooms.get(code)
      if (!room) return
      if (playerId) {
        room.states.set(playerId, message.state)
        const opponentId = getOpponentId(room, playerId)
        if (opponentId) {
          const opponent = room.players.get(opponentId)
          if (opponent?.ws) {
            sendJson(opponent.ws, {
              type: 'opponent_state',
              state: message.state,
              source: 'sync',
            })
          }
        }
      }
      return
    }

    if (message.type === 'request_opponent_state') {
      const code = message.code
      const playerId = message.playerId
      const room = rooms.get(code)
      if (!room) return
      const opponentId = getOpponentId(room, playerId)
      if (opponentId) {
        const opponentState = room.states.get(opponentId) || null
        sendJson(socket, {
          type: 'opponent_state',
          state: opponentState,
          source: 'refresh',
        })
        const opponent = room.players.get(opponentId)
        if (opponent?.ws) {
          sendJson(opponent.ws, {
            type: 'request_sync_state',
            code,
          })
        }
      }
      return
    }
  })

  socket.on('close', () => handleDisconnect(socket))
  socket.on('error', () => handleDisconnect(socket))
})

server.listen(PORT, () => {
  console.log(`Multiplayer server running on ${PORT}`)
})
