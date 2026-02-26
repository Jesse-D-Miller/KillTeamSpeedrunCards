import { createServer } from 'http'
import { randomUUID } from 'crypto'
import { WebSocket, WebSocketServer } from 'ws'

const PORT = Number(process.env.PORT || 8080)
const CODE_LENGTH = 6
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const MAX_PLAYERS = 2

const server = createServer()
const wss = new WebSocketServer({ server })
const DEBUG_WS = process.env.DEBUG_WS === '1'

const rooms = new Map()

const createCode = () => {
  let code = ''
  while (!code || rooms.has(code)) {
    code = Array.from({ length: CODE_LENGTH })
      .map(() => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)])
      .join('')
  }
  return code
}

const serializeRoom = (room) => ({
  code: room.code,
  hostId: room.hostId,
  players: Array.from(room.players.values()),
})

const isMapName = (name) => String(name || '').trim().toUpperCase() === 'MAP'

const getNonMapPlayers = (room) =>
  Array.from(room.players.values()).filter(
    (player) => !isMapName(player.name),
  )

const hasMapPlayer = (room) =>
  Array.from(room.players.values()).some((player) => isMapName(player.name))

const broadcastRoom = (room) => {
  const payload = JSON.stringify({
    type: 'room_update',
    ...serializeRoom(room),
  })
  room.players.forEach((player) => {
    if (player.socket && player.socket.readyState === WebSocket.OPEN) {
      player.socket.send(payload)
    }
  })
}

const sendMessage = (socket, payload) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload))
  }
}

const removePlayer = (room, playerId) => {
  const player = room.players.get(playerId)
  room.players.delete(playerId)
  room.stateByPlayerId.delete(playerId)
  room.selectionReadyByPlayerId.delete(playerId)
  if (room.players.size === 0) {
    rooms.delete(room.code)
    return
  }
  if (room.hostId === playerId) {
    const nextHost = room.players.values().next().value
    room.hostId = nextHost.id
  }
  broadcastRoom(room)
}

wss.on('connection', (socket) => {
  socket.on('message', (raw) => {
    let message
    try {
      message = JSON.parse(raw.toString())
    } catch (error) {
      sendMessage(socket, { type: 'error', message: 'Invalid message.' })
      return
    }

    if (message.type === 'create_room') {
      const name = String(message.name || '').trim()
      if (!name) {
        sendMessage(socket, {
          type: 'error',
          message: 'Name is required to create a room.',
        })
        return
      }
      const code = createCode()
      const playerId = randomUUID()
      const room = {
        code,
        hostId: playerId,
        players: new Map(),
        stateByPlayerId: new Map(),
        selectionReadyByPlayerId: new Map(),
        started: false,
      }
      room.players.set(playerId, {
        id: playerId,
        name,
        ready: false,
        socket,
      })
      room.selectionReadyByPlayerId.set(playerId, false)
      socket.playerId = playerId
      socket.roomCode = code
      rooms.set(code, room)
      sendMessage(socket, {
        type: 'room_created',
        playerId,
        ...serializeRoom(room),
      })
      return
    }

    if (message.type === 'join_room') {
      const name = String(message.name || '').trim()
      const code = String(message.code || '').toUpperCase()
      if (!name || !code) {
        sendMessage(socket, {
          type: 'error',
          message: 'Name and room code are required.',
        })
        return
      }
      const room = rooms.get(code)
      if (!room) {
        sendMessage(socket, { type: 'error', message: 'Room not found.' })
        return
      }
      const isMap = isMapName(name) || message.isMap === true
      const resolvedName = isMap ? 'MAP' : name
      if (isMap && hasMapPlayer(room)) {
        sendMessage(socket, { type: 'error', message: 'Map already joined.' })
        return
      }
      if (!isMap && getNonMapPlayers(room).length >= MAX_PLAYERS) {
        sendMessage(socket, { type: 'error', message: 'Room is full.' })
        return
      }
      if (room.started) {
        sendMessage(socket, { type: 'error', message: 'Game already started.' })
        return
      }
      const playerId = randomUUID()
      room.players.set(playerId, {
        id: playerId,
        name: resolvedName,
        ready: false,
        socket,
      })
      room.selectionReadyByPlayerId.set(playerId, false)
      socket.playerId = playerId
      socket.roomCode = code
      sendMessage(socket, {
        type: 'room_joined',
        playerId,
        ...serializeRoom(room),
      })
      broadcastRoom(room)
      return
    }

    if (message.type === 'sync_init') {
      if (DEBUG_WS) {
        console.log('sync_init', {
          code: message.code,
          name: message.name,
          playerId: message.playerId,
        })
      }
      const name = String(message.name || '').trim()
      const isMap = isMapName(name) || message.isMap === true
      const resolvedName = isMap ? 'MAP' : name
      const code = String(message.code || '').toUpperCase()
      const playerId = String(message.playerId || '').trim()
      if (!code || !playerId) {
        sendMessage(socket, {
          type: 'error',
          message: 'Name and room code are required.',
        })
        return
      }
      const room = rooms.get(code)
      if (!room) {
        sendMessage(socket, { type: 'error', message: 'Room not found.' })
        return
      }
      let player = room.players.get(playerId) || null
      if (!player) {
        if (room.started) {
          sendMessage(socket, { type: 'error', message: 'Room is full.' })
          return
        }
        if (!isMap && getNonMapPlayers(room).length >= MAX_PLAYERS) {
          sendMessage(socket, { type: 'error', message: 'Room is full.' })
          return
        }
        player = {
          id: playerId,
          name: resolvedName || 'Player',
          ready: false,
          socket,
        }
        room.players.set(playerId, player)
        room.selectionReadyByPlayerId.set(playerId, false)
      } else {
        player.socket = socket
        if (name) {
          player.name = resolvedName
        }
      }
      socket.playerId = playerId
      socket.roomCode = code
      sendMessage(socket, {
        type: 'sync_ready',
        playerId: player.id,
        ...serializeRoom(room),
      })

      const readyCount = getNonMapPlayers(room).filter((candidate) =>
        room.selectionReadyByPlayerId.get(candidate.id),
      ).length
      sendMessage(socket, {
        type: 'selection_status',
        readyCount,
        total: getNonMapPlayers(room).length,
      })

      const opponentEntry = Array.from(room.stateByPlayerId.entries()).find(
        ([playerId]) => playerId !== player.id,
      )
      if (opponentEntry) {
        sendMessage(socket, {
          type: 'opponent_state',
          state: opponentEntry[1],
          source: 'sync',
        })
      }
      return
    }

    if (message.type === 'set_ready') {
      const code = String(message.code || '').toUpperCase()
      const playerId = String(message.playerId || '').trim()
      const room = rooms.get(code)
      if (!room) {
        sendMessage(socket, { type: 'error', message: 'Room not found.' })
        return
      }
      const player = room.players.get(playerId)
      if (!player) {
        sendMessage(socket, { type: 'error', message: 'Player not found.' })
        return
      }
      player.ready = Boolean(message.ready)
      broadcastRoom(room)

      const nonMapPlayers = getNonMapPlayers(room)
      if (
        nonMapPlayers.length === MAX_PLAYERS &&
        nonMapPlayers.every((candidate) => candidate.ready)
      ) {
        room.started = true
        const startTime = Date.now()
        const payload = {
          type: 'game_started',
          code: room.code,
          startTime,
        }
        room.players.forEach((candidate) => {
          sendMessage(candidate.socket, payload)
        })
      }
    }

    if (message.type === 'select_ready') {
      const incomingPlayerId = String(message.playerId || '').trim()
      const incomingCode = String(message.code || '').toUpperCase()
      const room = rooms.get(incomingCode)
      if (!room) {
        sendMessage(socket, { type: 'error', message: 'Room not found.' })
        return
      }
      const player = room.players.get(incomingPlayerId)
      if (!player) {
        sendMessage(socket, { type: 'error', message: 'Player not found.' })
        return
      }
      player.socket = socket
      room.selectionReadyByPlayerId.set(player.id, true)
      const readyCount = getNonMapPlayers(room).filter((candidate) =>
        room.selectionReadyByPlayerId.get(candidate.id),
      ).length
      room.players.forEach((candidate) => {
        sendMessage(candidate.socket, {
          type: 'selection_status',
          readyCount,
          total: getNonMapPlayers(room).length,
        })
      })
      const nonMapPlayers = getNonMapPlayers(room)
      const bothReady =
        nonMapPlayers.length === MAX_PLAYERS &&
        nonMapPlayers.every((candidate) =>
          room.selectionReadyByPlayerId.get(candidate.id),
        )
      if (bothReady) {
        room.players.forEach((candidate) => {
          sendMessage(candidate.socket, {
            type: 'selection_ready',
            code: room.code,
          })
        })
      }
    }

    if (message.type === 'sync_state') {
      if (DEBUG_WS) {
        console.log('sync_state', {
          name: message.state?.name,
          killteamId: message.state?.killteamId,
        })
      }
      const code = String(message.code || '').toUpperCase()
      const playerId = String(message.playerId || '').trim()
      const room = rooms.get(code)
      if (!room) {
        sendMessage(socket, { type: 'error', message: 'Room not found.' })
        return
      }
      const player = room.players.get(playerId)
      if (!player) {
        sendMessage(socket, { type: 'error', message: 'Player not found.' })
        return
      }
      player.socket = socket
      room.stateByPlayerId.set(player.id, message.state)
      room.players.forEach((candidate) => {
        if (candidate.id !== player.id) {
          sendMessage(candidate.socket, {
            type: 'opponent_state',
            state: message.state,
            source: 'sync',
          })
        }
      })
    }

    if (message.type === 'request_opponent_state') {
      const code = String(message.code || '').toUpperCase()
      const playerId = String(message.playerId || '').trim()
      const room = rooms.get(code)
      if (!room) {
        sendMessage(socket, { type: 'error', message: 'Room not found.' })
        return
      }
      const player = room.players.get(playerId)
      if (!player) {
        sendMessage(socket, { type: 'error', message: 'Player not found.' })
        return
      }
      const opponentEntry = Array.from(room.stateByPlayerId.entries()).find(
        ([id]) => id !== playerId,
      )
      if (opponentEntry) {
        sendMessage(socket, {
          type: 'opponent_state',
          state: opponentEntry[1],
          source: 'refresh',
        })
        return
      }
      const opponent = Array.from(room.players.values()).find(
        (candidate) => candidate.id !== playerId,
      )
      if (opponent?.socket) {
        sendMessage(opponent.socket, {
          type: 'request_sync_state',
          code,
          requesterId: playerId,
        })
      }
      sendMessage(socket, {
        type: 'opponent_state',
        state: null,
        source: 'refresh',
      })
    }
  })

  socket.on('close', () => {
    const room = socket.roomCode ? rooms.get(socket.roomCode) : null
    if (!room) return
    const player = socket.playerId ? room.players.get(socket.playerId) : null
    if (!player) return
    if (room.started) {
      player.socket = null
      return
    }
    removePlayer(room, player.id)
  })
})

server.listen(PORT, () => {
  console.log(`Multiplayer server running on ws://localhost:${PORT}`)
})
