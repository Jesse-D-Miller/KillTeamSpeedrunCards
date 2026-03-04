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
  players: Array.from(room.players.values()).map((player) => ({
    id: player.id,
    name: player.name,
    ready: Boolean(player.ready),
    killteamId: player.killteamId || '',
  })),
})

const isMapName = (name) => String(name || '').trim().toUpperCase() === 'MAP'

const getNonMapPlayers = (room) =>
  Array.from(room.players.values()).filter(
    (player) => !isMapName(player.name),
  )

const hasMapPlayer = (room) =>
  Array.from(room.players.values()).some((player) => isMapName(player.name))

const resolveHostId = (room) => {
  const nonMapHost = getNonMapPlayers(room)[0]
  if (nonMapHost?.id) return nonMapHost.id
  const fallback = room.players.values().next().value
  return fallback?.id || ''
}

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
    const nextHostId = resolveHostId(room)
    if (nextHostId) {
      room.hostId = nextHostId
    }
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
      if (isMapName(name) || message.isMap === true) {
        sendMessage(socket, {
          type: 'error',
          message: 'Map cannot create rooms. Join an existing code as MAP.',
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
        stratPloysByPlayerId: new Map(),
        selectionReadyByPlayerId: new Map(),
        dropZoneState: null,
        started: false,
      }
      room.players.set(playerId, {
        id: playerId,
        name,
        ready: false,
        killteamId: '',
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
      if (isMap && getNonMapPlayers(room).length === 0) {
        sendMessage(socket, {
          type: 'error',
          message: 'Map can only join after at least one player has joined.',
        })
        return
      }
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
        killteamId: '',
        socket,
      })
      room.selectionReadyByPlayerId.set(playerId, false)
      if (!isMap && isMapName(room.players.get(room.hostId)?.name)) {
        room.hostId = playerId
      }
      socket.playerId = playerId
      socket.roomCode = code
      sendMessage(socket, {
        type: 'room_joined',
        playerId,
        ...serializeRoom(room),
      })
      if (room.dropZoneState) {
        sendMessage(socket, {
          type: 'drop_zone_update',
          ...room.dropZoneState,
        })
      }
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
      if (isMap && getNonMapPlayers(room).length === 0) {
        sendMessage(socket, {
          type: 'error',
          message: 'Map can only join after at least one player has joined.',
        })
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
          killteamId: '',
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
      if (!isMap && isMapName(room.players.get(room.hostId)?.name)) {
        room.hostId = player.id
      }
      const incomingKillteamId = String(message.killteamId || '').trim()
      if (incomingKillteamId) {
        player.killteamId = incomingKillteamId
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
      if (room.dropZoneState) {
        sendMessage(socket, {
          type: 'drop_zone_update',
          ...room.dropZoneState,
        })
      }
      return
    }

    if (message.type === 'set_killteam') {
      const code = String(message.code || '').toUpperCase()
      const playerId = String(message.playerId || '').trim()
      const killteamId = String(message.killteamId || '').trim()
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
      if (!killteamId) {
        sendMessage(socket, { type: 'error', message: 'Kill team not found.' })
        return
      }
      player.socket = socket
      player.killteamId = killteamId

      room.players.forEach((candidate) => {
        sendMessage(candidate.socket, {
          type: 'killteam_update',
          code,
          playerId: player.id,
          killteamId,
        })
      })
      broadcastRoom(room)
      return
    }

    if (message.type === 'set_strat_ploys') {
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
      const ploys = Array.isArray(message.ploys)
        ? message.ploys.filter((entry) => entry && typeof entry === 'object')
        : []
      player.socket = socket
      room.stratPloysByPlayerId.set(player.id, ploys)
      room.players.forEach((candidate) => {
        sendMessage(candidate.socket, {
          type: 'strat_ploys_update',
          code,
          playerId: player.id,
          ploys,
        })
      })
      return
    }

    if (message.type === 'set_drop_zone') {
      const code = String(message.code || '').toUpperCase()
      const playerId = String(message.playerId || '').trim()
      const zone = String(message.zone || '').toUpperCase()
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
      if (room.hostId !== player.id) {
        sendMessage(socket, {
          type: 'error',
          message: 'Only host can select drop zone.',
        })
        return
      }
      if (zone !== 'A' && zone !== 'B') {
        sendMessage(socket, {
          type: 'error',
          message: 'Invalid drop zone.',
        })
        return
      }
      const assignments =
        message.assignments && typeof message.assignments === 'object'
          ? message.assignments
          : {}
      room.dropZoneState = {
        zone,
        selectorPlayerId: player.id,
        assignments,
        at: Date.now(),
      }
      room.players.forEach((candidate) => {
        sendMessage(candidate.socket, {
          type: 'drop_zone_update',
          ...room.dropZoneState,
        })
      })
      return
    }

    if (message.type === 'request_drop_zone') {
      const code = String(message.code || '').toUpperCase()
      const room = rooms.get(code)
      if (!room) {
        sendMessage(socket, { type: 'error', message: 'Room not found.' })
        return
      }
      sendMessage(socket, {
        type: 'drop_zone_update',
        ...(room.dropZoneState || {
          zone: '',
          selectorPlayerId: '',
          assignments: {},
          at: Date.now(),
        }),
      })
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
      const syncKillteamId = String(message.state?.killteamId || '').trim()
      if (syncKillteamId) {
        player.killteamId = syncKillteamId
      }
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
      if (Array.isArray(message.state?.activeStratPloys)) {
        room.stratPloysByPlayerId.set(player.id, message.state.activeStratPloys)
        room.players.forEach((candidate) => {
          sendMessage(candidate.socket, {
            type: 'strat_ploys_update',
            code,
            playerId: player.id,
            ploys: message.state.activeStratPloys,
          })
        })
      }
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

    if (message.type === 'request_player_state') {
      const code = String(message.code || '').toUpperCase()
      const requesterId = String(message.requesterId || '').trim()
      const targetPlayerId = String(message.targetPlayerId || '').trim()
      const room = rooms.get(code)
      if (!room) {
        sendMessage(socket, { type: 'error', message: 'Room not found.' })
        return
      }
      const requester = room.players.get(requesterId)
      if (!requester) {
        sendMessage(socket, { type: 'error', message: 'Player not found.' })
        return
      }
      if (!targetPlayerId || targetPlayerId === requesterId) {
        sendMessage(socket, {
          type: 'opponent_state',
          state: null,
          source: 'targeted',
        })
        return
      }
      const targetState = room.stateByPlayerId.get(targetPlayerId) || null
      if (targetState) {
        sendMessage(socket, {
          type: 'opponent_state',
          state: targetState,
          source: 'targeted',
        })
        return
      }
      const targetPlayer = room.players.get(targetPlayerId)
      if (targetPlayer?.socket) {
        sendMessage(targetPlayer.socket, {
          type: 'request_sync_state',
          code,
          requesterId,
        })
      }
      sendMessage(socket, {
        type: 'opponent_state',
        state: null,
        source: 'targeted',
      })
      return
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
