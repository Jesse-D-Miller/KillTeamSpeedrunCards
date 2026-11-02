import { createReadStream, existsSync, readFileSync, statSync } from 'fs'
import { gzipSync } from 'zlib'
import { createServer } from 'http'
import { networkInterfaces } from 'os'
import { dirname, extname, join, normalize, resolve, sep } from 'path'
import { fileURLToPath } from 'url'
import { createGameServer } from './gameServer.js'
import { readHistory } from './history.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')
const PORT = Number(process.env.PORT || 3000)
const PERSIST_PATH = process.env.KT_STATE_FILE || join(ROOT, 'server', 'data', 'game.json')
const HISTORY_PATH = process.env.KT_HISTORY_FILE || join(ROOT, 'server', 'data', 'history.json')
const SERVE_STATIC = process.env.KT_SERVE_STATIC !== '0' && existsSync(DIST)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff2': 'font/woff2',
}

const lanAddresses = () =>
  Object.values(networkInterfaces())
    .flat()
    .filter((entry) => entry && entry.family === 'IPv4' && !entry.internal)
    .map((entry) => entry.address)

// Text files go out gzipped (the app's data file is ~7MB raw, ~1MB gzipped) to devices
// that accept it. Built assets never change (their names carry a hash), so each is
// compressed once and kept.
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg'])
const gzipped = new Map()

const sendFile = (req, res, path) => {
  const type = MIME[extname(path).toLowerCase()] || 'application/octet-stream'
  const asset = path.includes(`${join('dist', 'assets')}`)
  const headers = {
    'Content-Type': type,
    'Cache-Control': asset ? 'public, max-age=31536000, immutable' : 'no-cache',
    Vary: 'Accept-Encoding',
  }
  if (COMPRESSIBLE.has(extname(path).toLowerCase()) && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '')) {
    let body = asset ? gzipped.get(path) : null
    if (!body) {
      body = gzipSync(readFileSync(path))
      if (asset) gzipped.set(path, body)
    }
    res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', 'Content-Length': body.length })
    res.end(body)
    return
  }
  res.writeHead(200, headers)
  createReadStream(path).pipe(res)
}

const badRequest = (res) => {
  res.writeHead(400)
  res.end('Bad request')
}

const server = createServer((req, res) => {
  // Malformed URLs (e.g. "/%E0") throw while parsing; answer 400 instead of crashing the server.
  let url
  let pathname
  try {
    url = new URL(req.url, 'http://localhost')
    pathname = decodeURIComponent(url.pathname)
  } catch {
    badRequest(res)
    return
  }

  if (url.pathname === '/api/info') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify({ addresses: lanAddresses(), port: PORT }))
    return
  }

  // The stats page's games (see server/history.js).
  if (url.pathname === '/api/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify(readHistory(HISTORY_PATH) ?? []))
    return
  }

  if (!SERVE_STATIC) {
    res.writeHead(404)
    res.end('Not found. In development, open the Vite dev server instead.')
    return
  }

  const requested = normalize(join(DIST, pathname))
  // Trailing separator so sibling folders like "dist-ssr" don't pass the check.
  if (requested.startsWith(DIST + sep) && existsSync(requested) && statSync(requested).isFile()) {
    sendFile(req, res, requested)
    return
  }
  // SPA fallback for /table, /play, etc.
  sendFile(req, res, join(DIST, 'index.html'))
})

// The built page's main script name (hashed by Vite), sent to each device so a page left
// open across a rebuild (npm run table restarts with new code) reloads itself.
const builtScript = () => {
  if (!SERVE_STATIC) return null
  try {
    return readFileSync(join(DIST, 'index.html'), 'utf8').match(/assets\/(index-[\w-]+\.js)/)?.[1] ?? null
  } catch {
    return null
  }
}

createGameServer({ server, persistPath: PERSIST_PATH, historyPath: HISTORY_PATH, build: builtScript })

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\nKill Team table server on port ${PORT}`)
  if (SERVE_STATIC) {
    lanAddresses().forEach((address) => {
      console.log(`  Projector: http://${address}:${PORT}/table`)
    })
    console.log('  iPads: scan the QR codes shown on the projector.\n')
  } else {
    console.log('  (dev mode: websocket only, open the Vite URL)\n')
  }
})
