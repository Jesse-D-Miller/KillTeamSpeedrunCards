import { useNavigate } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { useSelection } from '../state/SelectionContext.jsx'
import KillOp from '../components/KillOp.jsx'
import { resolveWsUrl } from '../state/wsUrl.js'
import {
  getGameId,
  getPlayerId,
  getPlayerName,
  getRoomCode,
  writeFinalResult,
} from '../state/finalResults.js'
import './GameEnd.css'

const scoreRows = [
  { key: 'critOp', label: 'Crit Op' },
  { key: 'killOp', label: 'Kill Op' },
  { key: 'tacOp', label: 'Tac Op' },
  { key: 'primaryOp', label: 'Primary Op' },
]

const primarySourceByIndex = {
  '01': 'critOp',
  '02': 'killOp',
  '03': 'tacOp',
}

const WS_URL = resolveWsUrl()

function GameEnd() {
  const navigate = useNavigate()
  const { selectedTacOpsByTeam, selectedPrimaryOpsByTeam } = useSelection()
  const storedKillteamId =
    typeof window !== 'undefined'
      ? localStorage.getItem('kt-last-killteam')
      : null
  const storedTacOp =
    typeof window !== 'undefined'
      ? localStorage.getItem('kt-selected-tacop')
      : null
  const storedPrimaryOp =
    typeof window !== 'undefined'
      ? localStorage.getItem('kt-selected-primaryop')
      : null
  const fallbackKillteamId = Object.keys(selectedTacOpsByTeam || {})[0] || null
  const killteamId = storedKillteamId || fallbackKillteamId
  const selectedTacOp = killteamId ? selectedTacOpsByTeam[killteamId] : null
  const selectedPrimaryOp = killteamId
    ? selectedPrimaryOpsByTeam[killteamId]
    : null
  const resolvedTacOp = useMemo(() => {
    if (selectedTacOp) return selectedTacOp
    if (!storedTacOp) return null
    try {
      return JSON.parse(storedTacOp)
    } catch (error) {
      console.warn('Failed to parse stored tac op.', error)
      return null
    }
  }, [selectedTacOp, storedTacOp])
  const resolvedPrimaryOp = useMemo(() => {
    if (selectedPrimaryOp) return selectedPrimaryOp
    if (!storedPrimaryOp) return null
    try {
      return JSON.parse(storedPrimaryOp)
    } catch (error) {
      console.warn('Failed to parse stored primary op.', error)
      return null
    }
  }, [selectedPrimaryOp, storedPrimaryOp])
  const primaryIndexMatch = resolvedPrimaryOp?.src?.match(
    /primary-op-(\d+)/,
  )
  const primarySourceKey = primaryIndexMatch
    ? primarySourceByIndex[primaryIndexMatch[1]]
    : null
  const critOpSrc =
    typeof window !== 'undefined'
      ? localStorage.getItem('kt-crit-op-src')
      : null
  const critOpLabel =
    typeof window !== 'undefined'
      ? localStorage.getItem('kt-crit-op-label')
      : null
  const [scores, setScores] = useState({
    critOp: 0,
    killOp: 0,
    tacOp: 0,
    primaryOp: 0,
  })
  const computedPrimaryOp = useMemo(() => {
    if (!primarySourceKey) return 0
    const baseValue = scores[primarySourceKey] ?? 0
    return Math.ceil(0.5 * baseValue)
  }, [primarySourceKey, scores])
  const totalVp = useMemo(() => {
    const totalBase = Object.entries(scores)
      .filter(([key]) => key !== 'primaryOp')
      .reduce((sum, [, value]) => sum + Number(value || 0), 0)
    return totalBase + computedPrimaryOp
  }, [scores, computedPrimaryOp])

  const updateScore = (key, delta) => {
    if (key === 'primaryOp') return
    setScores((prev) => ({
      ...prev,
      [key]: Math.min(6, Math.max(0, (prev[key] ?? 0) + delta)),
    }))
  }

  const handleImmortaliseResults = () => {
    const roomCode = getRoomCode()
    const playerId = getPlayerId()
    const gameId = getGameId()
    const playerName = getPlayerName()

    const resultPayload = {
      playerName,
      scores: {
        ...scores,
        primaryOp: computedPrimaryOp,
      },
      totalVp,
      lockedAt: Date.now(),
    }

    if (roomCode && playerId) {
      try {
        writeFinalResult({
          roomCode,
          playerId,
          gameId,
          result: resultPayload,
        })
      } catch (error) {
        console.warn('Failed to store final results.', error)
      }

      try {
        const socket = new WebSocket(WS_URL)
        socket.addEventListener('open', () => {
          socket.send(
            JSON.stringify({
              type: 'sync_state',
              code: roomCode,
              playerId,
              state: {
                playerId,
                finalResults: resultPayload,
              },
            }),
          )
          setTimeout(() => {
            try {
              socket.close()
            } catch {
              // no-op
            }
          }, 150)
        })
      } catch (error) {
        console.warn('Failed to sync final results.', error)
      }
    }

    navigate('/results')
  }

  const renderPreview = (key, label) => {
    if (key === 'killOp') {
      return (
        <div className="game-end-preview-inline game-end-preview-killop">
          <KillOp />
        </div>
      )
    }

    if (key === 'tacOp') {
      return resolvedTacOp?.src ? (
        <img
          src={resolvedTacOp.src}
          alt={resolvedTacOp.label || 'Selected Tac Op'}
          loading="lazy"
        />
      ) : (
        <div className="game-end-preview-empty">No Tac Op selected.</div>
      )
    }

    if (key === 'critOp') {
      return critOpSrc ? (
        <img
          src={critOpSrc}
          alt={critOpLabel || 'Selected Crit Op'}
          loading="lazy"
        />
      ) : (
        <div className="game-end-preview-empty">No Crit Op selected.</div>
      )
    }

    if (key === 'primaryOp') {
      return resolvedPrimaryOp?.src ? (
        <img
          src={resolvedPrimaryOp.src}
          alt={resolvedPrimaryOp.label || 'Selected Primary Op'}
          loading="lazy"
        />
      ) : (
        <div className="game-end-preview-empty">No Primary Op selected.</div>
      )
    }

    return (
      <div className="game-end-preview-empty">No {label} selected.</div>
    )
  }

  return (
    <div className="app-shell">
      <main className="app-content">
        <section className="page game-end">
          <div className="game-end-card">
            <h1>Game End</h1>
            <p className="game-end-lede">Record final scores and wrap up.</p>
            <div className="game-end-list">
                {scoreRows.map((row) => (
                  <div className="game-end-row" key={row.key}>
                  <div className="game-end-preview-inline">
                    {renderPreview(row.key, row.label)}
                  </div>
                    {row.key === 'primaryOp' ? (
                      <div className="game-end-controls game-end-controls--computed">
                        <span className="game-end-value">
                          {computedPrimaryOp}
                        </span>
                      </div>
                    ) : (
                      <div className="game-end-controls">
                        <button
                          type="button"
                          className="game-end-step"
                          onClick={() => updateScore(row.key, -1)}
                          aria-label={`Decrease ${row.label}`}
                        >
                          −
                        </button>
                        <span className="game-end-value">{scores[row.key]}</span>
                        <button
                          type="button"
                          className="game-end-step"
                          onClick={() => updateScore(row.key, 1)}
                          aria-label={`Increase ${row.label}`}
                        >
                          +
                        </button>
                      </div>
                    )}
                </div>
              ))}
              <div className="game-end-total">
                <span>Total VP</span>
                <span className="game-end-total-value">{totalVp}</span>
              </div>
            </div>
            <button
              type="button"
              className="game-end-next"
              onClick={handleImmortaliseResults}
            >
              Emortalize results?
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}

export default GameEnd
