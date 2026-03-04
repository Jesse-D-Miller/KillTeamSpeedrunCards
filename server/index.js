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
    import './wsServer.js'
  }
