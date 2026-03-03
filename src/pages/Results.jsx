import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { resolveWsUrl } from '../state/wsUrl.js'
import {
  getGameId,
  getPlayerId,
  getRoomCode,
  getRoomPlayers,
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
    }

    socket.addEventListener('open', sendCurrentState)

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)

      if (message.type === 'sync_ready' || message.type === 'request_sync_state') {
        sendCurrentState()
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

      if (message.type !== 'sync_state') return

      const state = message.state || {}
      const incomingPlayerId = state.playerId || message.playerId || ''
      const incomingFinalResults = state.finalResults || null
      if (!incomingPlayerId || !incomingFinalResults) return

      writeFinalResult({
        roomCode,
        playerId: incomingPlayerId,
        gameId,
        result: incomingFinalResults,
      })
      setResultsVersion((prev) => prev + 1)
    })

    return () => {
      socket.close()
    }
  }, [roomCode, playerId, gameId])

  const displayPlayers = useMemo(() => {
    if (players.length) {
      return players.slice(0, 2)
    }

    if (roomCode && playerId) {
      return [{ id: playerId, name: 'Player 1' }, { id: 'opponent', name: 'Player 2' }]
    }

    return [{ id: 'local', name: 'Player' }]
  }, [players, roomCode, playerId])

  const resultsByPlayer = useMemo(() => {
    const next = {}
    displayPlayers.forEach((player) => {
      next[player.id] = readFinalResult({ roomCode, playerId: player.id, gameId })
    })
    return next
  }, [displayPlayers, roomCode, gameId, resultsVersion])

  const expectedLocks = roomCode ? 2 : 1
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