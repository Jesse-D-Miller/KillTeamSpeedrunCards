import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { resolveWsUrl } from '../state/wsUrl.js'
import {
  getGameId,
  getPlayerId,
  getRoomCode,
  getRoomPlayers,
  listFinalResultPlayerIds,
  readFinalResult,
  writeFinalResult,
} from '../state/finalResults.js'
import './Results.css'

const WS_URL = resolveWsUrl()

const formatDuration = (milliseconds) => {
  const totalSeconds = Math.max(0, Math.floor(Number(milliseconds || 0) / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function Results() {
  const roomCode = getRoomCode()
  const playerId = getPlayerId()
  const gameId = getGameId()
  const [nowTick, setNowTick] = useState(() => Date.now())
  const [players, setPlayers] = useState(() => getRoomPlayers(roomCode))
  const [resultsVersion, setResultsVersion] = useState(0)

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowTick(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    if (!roomCode) return undefined

    const refresh = () => {
      setPlayers(getRoomPlayers(roomCode))
      setResultsVersion((prev) => prev + 1)
    }

    const intervalId = window.setInterval(refresh, 1000)
    const handleStorage = () => refresh()
    window.addEventListener('storage', handleStorage)

    refresh()

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('storage', handleStorage)
    }
  }, [roomCode])

  useEffect(() => {
    if (!roomCode || !playerId) return undefined

    const socket = new WebSocket(WS_URL)

    const requestPeerState = () => {
      if (socket.readyState !== WebSocket.OPEN) return
      socket.send(
        JSON.stringify({
          type: 'request_opponent_state',
          code: roomCode,
          playerId,
        }),
      )
    }

    const sendCurrentState = () => {
      if (socket.readyState !== WebSocket.OPEN) return
      const ownResults = readFinalResult({ roomCode, playerId, gameId })
      if (!ownResults) return

      socket.send(
        JSON.stringify({
          type: 'sync_state',
          code: roomCode,
          playerId,
          state: {
            playerId,
            finalResults: ownResults,
          },
        }),
      )

      requestPeerState()
    }

    const persistIncomingFinalResults = (state, fallbackPlayerId = '') => {
      const incomingPlayerId = state?.playerId || fallbackPlayerId || ''
      const incomingFinalResults = state?.finalResults || null
      if (!incomingPlayerId || !incomingFinalResults) return

      writeFinalResult({
        roomCode,
        playerId: incomingPlayerId,
        gameId,
        result: incomingFinalResults,
      })
      setResultsVersion((prev) => prev + 1)
    }

    socket.addEventListener('open', () => {
      socket.send(
        JSON.stringify({
          type: 'sync_init',
          code: roomCode,
          playerId,
        }),
      )
      sendCurrentState()
      requestPeerState()
    })

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)

      if (message.type === 'sync_ready' || message.type === 'request_sync_state') {
        sendCurrentState()
        requestPeerState()
        return
      }

      if (message.type === 'room_update') {
        try {
          localStorage.setItem(
            `kt-room-players-${roomCode}`,
            JSON.stringify(message.players || []),
          )
        } catch (error) {
          console.warn('Failed to persist room update on results page.', error)
        }
        setPlayers(getRoomPlayers(roomCode))
        return
      }

      if (message.type === 'sync_state' || message.type === 'opponent_state') {
        persistIncomingFinalResults(message.state || {}, message.playerId)
      }
    })

    const refreshInterval = window.setInterval(() => {
      if (socket.readyState !== WebSocket.OPEN) return
      sendCurrentState()
      requestPeerState()
    }, 1500)

    return () => {
      window.clearInterval(refreshInterval)
      socket.close()
    }
  }, [roomCode, playerId, gameId])

  const displayPlayers = useMemo(() => {
    if (!roomCode) {
      return [{ id: 'local', name: 'Player' }]
    }

    const playerById = new Map()
    players.forEach((player) => {
      const id = String(player?.id || '').trim()
      if (!id) return
      playerById.set(id, {
        id,
        name: String(player?.name || '').trim() || 'Player',
      })
    })

    if (playerId && !playerById.has(playerId)) {
      const storedName = localStorage.getItem(`kt-room-player-name-${roomCode}-${playerId}`)
      playerById.set(playerId, {
        id: playerId,
        name: String(storedName || 'Player').trim() || 'Player',
      })
    }

    listFinalResultPlayerIds({ roomCode, gameId }).forEach((id) => {
      if (playerById.has(id)) return
      const storedName = localStorage.getItem(`kt-room-player-name-${roomCode}-${id}`)
      playerById.set(id, {
        id,
        name: String(storedName || 'Player').trim() || 'Player',
      })
    })

    const resolved = Array.from(playerById.values()).slice(0, 2)
    if (resolved.length) return resolved

    if (playerId) {
      return [{ id: playerId, name: 'Player' }]
    }

    return [{ id: 'local', name: 'Player' }]
  }, [players, roomCode, playerId, gameId])

  const resultsByPlayer = useMemo(() => {
    const next = {}
    displayPlayers.forEach((player) => {
      next[player.id] = readFinalResult({ roomCode, playerId: player.id, gameId })
    })
    return next
  }, [displayPlayers, roomCode, gameId, resultsVersion])

  const expectedLocks = roomCode
    ? Math.max(1, Math.min(2, displayPlayers.length))
    : 1
  const lockedResults = displayPlayers
    .map((player) => ({ player, result: resultsByPlayer[player.id] }))
    .filter((entry) => entry.result)
  const isComplete = lockedResults.length >= expectedLocks

  const winner = useMemo(() => {
    if (!isComplete) return null
    const sorted = [...lockedResults].sort(
      (a, b) => Number(b.result?.totalVp || 0) - Number(a.result?.totalVp || 0),
    )
    const top = sorted[0]
    const second = sorted[1]
    if (
      second &&
      Number(top.result?.totalVp || 0) === Number(second.result?.totalVp || 0)
    ) {
      return { name: 'DRAW' }
    }
    return {
      name: top?.result?.playerName || top?.player?.name || 'Winner',
    }
  }, [isComplete, lockedResults])

  const gameTime = useMemo(() => {
    if (!isComplete) return ''

    const startTimeRaw = localStorage.getItem('kt-timer-start')
    const startTime = Number(startTimeRaw || 0)
    if (!Number.isFinite(startTime) || startTime <= 0) return ''

    const endTime = lockedResults.reduce((latest, entry) => {
      const lockedAt = Number(entry.result?.lockedAt || 0)
      return lockedAt > latest ? lockedAt : latest
    }, 0)

    if (!Number.isFinite(endTime) || endTime <= startTime) return ''
    return formatDuration(endTime - startTime)
  }, [isComplete, lockedResults])

  const liveGameTime = useMemo(() => {
    if (isComplete) return ''

    const startTimeRaw = localStorage.getItem('kt-timer-start')
    const startTime = Number(startTimeRaw || 0)
    if (!Number.isFinite(startTime) || startTime <= 0) return ''
    if (nowTick <= startTime) return ''

    return formatDuration(nowTick - startTime)
  }, [isComplete, nowTick])

  return (
    <div className="app-shell">
      <main className="app-content">
        <section className="page results-page">
          <div className="results-card">
            {!isComplete ? (
              <>
                <h1 className="results-calculating">CALCULATING RESULTS...</h1>
                {liveGameTime ? (
                  <p className="results-calculating-time">Game Time: {liveGameTime}</p>
                ) : null}
              </>
            ) : (
              <>
                <h1 className="results-title">WINNER</h1>
                <p className="results-winner-name">{winner?.name}</p>
                {gameTime ? <p className="results-game-time">Game Time: {gameTime}</p> : null}
                <div className="results-scores">
                  {lockedResults.map(({ player, result }) => (
                    <p key={player.id}>
                      {result?.playerName || player.name}: {Number(result?.totalVp || 0)} VP
                    </p>
                  ))}
                </div>
              </>
            )}

            <Link className="results-home" to="/">
              Back to Home
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}

export default Results