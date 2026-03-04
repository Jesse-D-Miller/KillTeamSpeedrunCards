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
  const killteamId =
    location.state?.killteamId || localStorage.getItem('kt-last-killteam') || ''
  const [selectedDropZone, setSelectedDropZone] = useState('')
  const [isHost, setIsHost] = useState(true)
  const socketRef = useRef(null)

  const resolveEffectiveHostId = (roomCode, rawHostId) => {
    if (!roomCode) return rawHostId || ''
    try {
      const playersRaw = localStorage.getItem(`kt-room-players-${roomCode}`)
      const players = playersRaw ? JSON.parse(playersRaw) : []
      const nonMapPlayers = Array.isArray(players)
        ? players.filter(
            (player) =>
              player?.id &&
              String(player?.name || '').trim().toUpperCase() !== 'MAP',
          )
        : []
      const hostPlayer = Array.isArray(players)
        ? players.find((player) => player?.id === rawHostId)
        : null
      const hostIsMap =
        String(hostPlayer?.name || '').trim().toUpperCase() === 'MAP'
      if (rawHostId && !hostIsMap) return rawHostId
      return nonMapPlayers[0]?.id || rawHostId || ''
    } catch {
      return rawHostId || ''
    }
  }

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
    const effectiveHostId = resolveEffectiveHostId(roomCode, hostId)
    return {
      roomCode,
      playerId,
      playerName,
      hostId: effectiveHostId,
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

  const buildSetupSyncState = () => {
    try {
      const selectionRaw = localStorage.getItem('kt-selection-state')
      const selection = selectionRaw ? JSON.parse(selectionRaw) : {}
      const selectedUnits =
        killteamId &&
        Array.isArray(selection?.selectedUnitsByTeam?.[killteamId])
          ? selection.selectedUnitsByTeam[killteamId]
          : []
      return {
        killteamId: killteamId || '',
        selectedUnits,
      }
    } catch (error) {
      console.warn('Failed to build setup sync state.', error)
      return {
        killteamId: killteamId || '',
        selectedUnits: [],
      }
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
      if (message.type === 'sync_ready') {
        try {
          if (roomCode && Array.isArray(message.players)) {
            localStorage.setItem(
              `kt-room-players-${roomCode}`,
              JSON.stringify(message.players),
            )
            const incomingHostId = String(message.hostId || '')
            const nonMapPlayers = message.players.filter(
              (player) =>
                player?.id &&
                String(player?.name || '').trim().toUpperCase() !== 'MAP',
            )
            const incomingHostPlayer = message.players.find(
              (player) => player?.id === incomingHostId,
            )
            const incomingHostIsMap =
              String(incomingHostPlayer?.name || '').trim().toUpperCase() === 'MAP'
            const resolvedHostId =
              incomingHostId && !incomingHostIsMap
                ? incomingHostId
                : nonMapPlayers[0]?.id || incomingHostId
            if (resolvedHostId) {
              localStorage.setItem(`kt-room-host-${roomCode}`, resolvedHostId)
            }
            const { gameId } = getRoomContext()
            message.players.forEach((player) => {
              const id = String(player?.id || '').trim()
              if (!id) return
              const incomingName = String(player?.name || '').trim()
              const incomingKillteamId = String(player?.killteamId || '').trim()
              if (incomingName) {
                localStorage.setItem(
                  `kt-room-player-name-${roomCode}-${id}`,
                  incomingName,
                )
              }
              if (incomingKillteamId) {
                localStorage.setItem(
                  `kt-room-player-killteam-${roomCode}-${id}`,
                  incomingKillteamId,
                )
                if (gameId) {
                  localStorage.setItem(
                    `kt-room-player-killteam-${roomCode}-${id}-${gameId}`,
                    incomingKillteamId,
                  )
                }
              }
            })
          }
        } catch (error) {
          console.warn('Failed to persist setup room metadata.', error)
        }
        return
      }
      if (message.type === 'drop_zone_update') {
        applyDropZoneUpdate(message)
        return
      }
      if (message.type === 'killteam_update') {
        try {
          const incomingPlayerId = String(message.playerId || '').trim()
          const incomingKillteamId = String(message.killteamId || '').trim()
          if (!incomingPlayerId || !incomingKillteamId) return
          const { gameId } = getRoomContext()
          localStorage.setItem(
            `kt-room-player-killteam-${roomCode}-${incomingPlayerId}`,
            incomingKillteamId,
          )
          if (gameId) {
            localStorage.setItem(
              `kt-room-player-killteam-${roomCode}-${incomingPlayerId}-${gameId}`,
              incomingKillteamId,
            )
          }
        } catch (error) {
          console.warn('Failed to persist killteam update in setup.', error)
        }
        return
      }
      if (message.type === 'opponent_state' && message.state) {
        try {
          const incomingState = message.state
          const incomingPlayerId = String(incomingState.playerId || '')
          if (!incomingPlayerId || incomingPlayerId === playerId) return
          const { gameId } = getRoomContext()
          if (incomingState.name) {
            localStorage.setItem(
              `kt-room-player-name-${roomCode}-${incomingPlayerId}`,
              String(incomingState.name),
            )
          }
          if (incomingState.killteamId) {
            localStorage.setItem(
              `kt-room-player-killteam-${roomCode}-${incomingPlayerId}`,
              String(incomingState.killteamId),
            )
            if (gameId) {
              localStorage.setItem(
                `kt-room-player-killteam-${roomCode}-${incomingPlayerId}-${gameId}`,
                String(incomingState.killteamId),
              )
            }
          }
          if (Array.isArray(incomingState.selectedUnits)) {
            const baseKey = `kt-room-player-selected-units-${roomCode}-${incomingPlayerId}`
            const payload = JSON.stringify(incomingState.selectedUnits)
            localStorage.setItem(baseKey, payload)
            if (gameId) {
              localStorage.setItem(`${baseKey}-${gameId}`, payload)
            }
          }
          if (
            incomingState.deadUnits &&
            typeof incomingState.deadUnits === 'object'
          ) {
            const baseKey = `kt-room-player-dead-units-${roomCode}-${incomingPlayerId}`
            const payload = JSON.stringify(incomingState.deadUnits)
            localStorage.setItem(baseKey, payload)
            if (gameId) {
              localStorage.setItem(`${baseKey}-${gameId}`, payload)
            }
          }
          window.dispatchEvent(new CustomEvent('kt-killop-update'))
        } catch (error) {
          console.warn('Failed to persist setup opponent state.', error)
        }
      }
    }

    socket.addEventListener('open', () => {
      socket.send(
        JSON.stringify({
          type: 'sync_init',
          code: roomCode,
          name: playerName || '',
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
      const setupState = buildSetupSyncState()
      socket.send(
        JSON.stringify({
          type: 'sync_state',
          code: roomCode,
          playerId,
          state: {
            name: playerName || '',
            playerId,
            killteamId: setupState.killteamId,
            selectedUnits: setupState.selectedUnits,
            selectedEquipment: [],
            activeStratPloys: [],
            unitStates: {},
            deadUnits: {},
            woundsByUnit: {},
            stanceByUnit: {},
            statusesByUnit: {},
            aplAdjustByUnit: {},
            legionaryMarkByUnit: {},
          },
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
