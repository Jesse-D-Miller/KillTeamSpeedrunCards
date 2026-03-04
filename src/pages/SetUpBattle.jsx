import { Link, useLocation } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { resolveWsUrl } from '../state/wsUrl.js'
import './SetUpBattle.css'

const checklistItems = [
  'Select Kill Teams',
  'Determine killzone, set up terrain, specify terrain types',
  'Determine Crit Op',
  'Roll off - winner decides initiative',
  'Player with initiative selects Drop Zone',
]

function SetUpBattle() {
  const WS_URL = resolveWsUrl()
  const location = useLocation()
  const killteamId = location.state?.killteamId
  const [selectedDropZone, setSelectedDropZone] = useState('')
  const [isHost, setIsHost] = useState(true)
  const socketRef = useRef(null)

  const getRoomContext = () => {
    const roomCode =
      sessionStorage.getItem('kt-room-code') ||
      localStorage.getItem('kt-room-code') ||
      ''
    const playerId =
      sessionStorage.getItem('kt-player-id') ||
      localStorage.getItem('kt-player-id') ||
      ''
    const playerName =
      sessionStorage.getItem('kt-player-name') ||
      localStorage.getItem('kt-player-name') ||
      ''
    const hostId = roomCode
      ? localStorage.getItem(`kt-room-host-${roomCode}`) || ''
      : ''
    return {
      roomCode,
      playerId,
      playerName,
      hostId,
      gameId: localStorage.getItem('kt-game-id') || '',
    }
  }

  const persistDropZoneAssignments = (zone) => {
    try {
      const { roomCode, playerId, gameId } = getRoomContext()
      const storedPlayers = roomCode
        ? localStorage.getItem(`kt-room-players-${roomCode}`)
        : ''
      const roomPlayers = storedPlayers ? JSON.parse(storedPlayers) : []
      const opponentPlayer = roomPlayers.find(
        (player) =>
          player?.id &&
          player.id !== playerId &&
          String(player?.name || '').trim().toUpperCase() !== 'MAP',
      )
      const playerTeamId =
        (roomCode && playerId &&
          ((gameId &&
            localStorage.getItem(
              `kt-room-player-killteam-${roomCode}-${playerId}-${gameId}`,
            )) ||
            localStorage.getItem(
              `kt-room-player-killteam-${roomCode}-${playerId}`,
            ))) ||
        killteamId ||
        ''
      const opponentTeamId = opponentPlayer?.id
        ? (gameId &&
            localStorage.getItem(
              `kt-room-player-killteam-${roomCode}-${opponentPlayer.id}-${gameId}`,
            )) ||
          localStorage.getItem(
            `kt-room-player-killteam-${roomCode}-${opponentPlayer.id}`,
          )
        : ''
      const assignments = {
        playerAssignments: {
          [zone]: playerId || '',
          [zone === 'A' ? 'B' : 'A']: opponentPlayer?.id || '',
        },
      }
      if (playerTeamId) {
        assignments[zone] = playerTeamId
      }
      if (opponentTeamId) {
        assignments[zone === 'A' ? 'B' : 'A'] = opponentTeamId
      }
      if (roomCode) {
        const baseKey = `kt-drop-zone-assignments-${roomCode}`
        localStorage.setItem(baseKey, JSON.stringify(assignments))
        if (gameId) {
          localStorage.setItem(`${baseKey}-${gameId}`, JSON.stringify(assignments))
        }
      } else {
        localStorage.setItem('kt-drop-zone-assignments', JSON.stringify(assignments))
      }
      return assignments
    } catch (error) {
      console.warn('Failed to persist drop zone assignments.', error)
      return {}
    }
  }

  useEffect(() => {
    const applyRoomRole = () => {
      const { roomCode, playerId, hostId } = getRoomContext()
      const storedDropZone = localStorage.getItem('kt-drop-zone') || ''
      if (storedDropZone) {
        setSelectedDropZone(storedDropZone)
      }
      if (!roomCode) {
        setIsHost(true)
        return
      }
      if (roomCode && playerId && hostId) {
        setIsHost(playerId === hostId)
        return
      }
      setIsHost(false)
    }

    applyRoomRole()
    const handleStorage = () => applyRoomRole()
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  useEffect(() => {
    const { roomCode, playerId, playerName } = getRoomContext()
    if (!roomCode || !playerId) return undefined

    const socket = new WebSocket(WS_URL)
    socketRef.current = socket

    const applyDropZoneUpdate = (message) => {
      const zone = String(message?.zone || '').toUpperCase()
      if (zone !== 'A' && zone !== 'B') return
      const selectorPlayerId = String(message?.selectorPlayerId || '')
      const myZone = selectorPlayerId && selectorPlayerId === playerId
        ? zone
        : zone === 'A'
          ? 'B'
          : 'A'
      const opponentZone = myZone === 'A' ? 'B' : 'A'

      setSelectedDropZone(myZone)
      localStorage.setItem('kt-drop-zone', myZone)
      localStorage.setItem('kt-drop-zone-opponent', opponentZone)

      const assignments =
        message?.assignments && typeof message.assignments === 'object'
          ? message.assignments
          : null
      if (assignments) {
        const { gameId } = getRoomContext()
        const baseKey = `kt-drop-zone-assignments-${roomCode}`
        localStorage.setItem(baseKey, JSON.stringify(assignments))
        if (gameId) {
          localStorage.setItem(`${baseKey}-${gameId}`, JSON.stringify(assignments))
        }
      }

      window.dispatchEvent(new CustomEvent('kt-dropzone-update'))
    }

    const handleMessage = (event) => {
      const message = JSON.parse(event.data)
      if (message.type === 'drop_zone_update') {
        applyDropZoneUpdate(message)
      }
    }

    socket.addEventListener('open', () => {
      socket.send(
        JSON.stringify({
          type: 'sync_init',
          code: roomCode,
          name: playerName || 'Player',
          playerId,
        }),
      )
      socket.send(
        JSON.stringify({
          type: 'request_drop_zone',
          code: roomCode,
          playerId,
        }),
      )
    })
    socket.addEventListener('message', handleMessage)

    return () => {
      socket.removeEventListener('message', handleMessage)
      socket.close()
      socketRef.current = null
    }
  }, [WS_URL])

  const handleDropZoneSelect = (zone) => {
    if (!isHost) return
    setSelectedDropZone(zone)
    localStorage.setItem('kt-drop-zone', zone)
    localStorage.setItem('kt-drop-zone-opponent', zone === 'A' ? 'B' : 'A')
    const assignments = persistDropZoneAssignments(zone)
    const { roomCode, playerId } = getRoomContext()
    const socket = socketRef.current
    if (
      roomCode &&
      playerId &&
      socket &&
      socket.readyState === WebSocket.OPEN
    ) {
      socket.send(
        JSON.stringify({
          type: 'set_drop_zone',
          code: roomCode,
          playerId,
          zone,
          assignments,
        }),
      )
    }
    window.dispatchEvent(new CustomEvent('kt-dropzone-update'))
  }

  return (
    <div className="app-shell">
      <main className="app-content">
        <section className="page setup-battle">
          <div className="setup-battle-card">
            <h1>Set Up the Battle</h1>
            <p className="setup-battle-lede">
              Check everything off before selecting operatives.
            </p>
            <ul className="setup-battle-list">
              {checklistItems.map((item, index) => {
                const isDropZone = index === checklistItems.length - 1
                if (!isDropZone) {
                  return (
                    <li key={item} className="setup-battle-item">
                      <input
                        type="checkbox"
                        aria-label={item}
                        defaultChecked={index < 3}
                      />
                      <span>{item}</span>
                    </li>
                  )
                }

                return (
                  <li key={item} className="setup-battle-item is-drop-zone">
                    <div className="setup-battle-dropzone-header">
                      <div className="setup-battle-dropzone-title">
                        <span>{item}</span>
                        {!isHost ? (
                          <span
                            className="setup-battle-dropzone-lock"
                            title="Host only: drop zone selection is locked."
                          >
                            Host only
                          </span>
                        ) : null}
                      </div>
                      {selectedDropZone ? (
                        <strong>Selected: Drop Zone {selectedDropZone}</strong>
                      ) : !isHost ? (
                        <em>Waiting for host to select.</em>
                      ) : (
                        <em>Select A or B</em>
                      )}
                    </div>
                    <div className="setup-battle-dropzone-actions">
                      <button
                        type="button"
                        disabled={!isHost}
                        className={
                          selectedDropZone === 'A'
                            ? 'dropzone-button is-selected'
                            : 'dropzone-button'
                        }
                        onClick={() => handleDropZoneSelect('A')}
                      >
                        Drop Zone A
                      </button>
                      <button
                        type="button"
                        disabled={!isHost}
                        className={
                          selectedDropZone === 'B'
                            ? 'dropzone-button is-selected'
                            : 'dropzone-button'
                        }
                        onClick={() => handleDropZoneSelect('B')}
                      >
                        Drop Zone B
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
            {killteamId ? (
              <Link
                className="setup-battle-next"
                to={`/select-army/${killteamId}/units`}
              >
                Next: Select operatives
              </Link>
            ) : (
              <Link className="setup-battle-next" to="/select-army">
                Back to select army
              </Link>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

export default SetUpBattle
