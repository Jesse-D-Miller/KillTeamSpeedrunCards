import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { persistMultiplayerIdentity } from '../state/multiplayerStorage.js'
import './Multiplayer.css'

const WS_URL =
  import.meta.env.VITE_WS_URL ||
  `ws://${window.location.hostname}:8080`

const normalizeCode = (value) => value.replace(/\s+/g, '').toUpperCase()

function Multiplayer() {
  const navigate = useNavigate()
  const socketRef = useRef(null)
  const [mode, setMode] = useState('choice')
  const [name, setName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [players, setPlayers] = useState([])
  const [playerId, setPlayerId] = useState('')
  const [hostId, setHostId] = useState('')
  const [status, setStatus] = useState('disconnected')
  const [error, setError] = useState('')

  const localPlayer = useMemo(
    () => players.find((player) => player.id === playerId),
    [players, playerId],
  )
  const isReady = Boolean(localPlayer?.ready)
  const hasTwoPlayers = players.length === 2

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close()
      }
    }
  }, [])

  const sendMessage = (payload) => {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return false
    socket.send(JSON.stringify(payload))
    return true
  }

  const handleMessage = (event) => {
    const message = JSON.parse(event.data)

    if (message.type === 'error') {
      setError(message.message || 'Unable to connect to room.')
      setStatus('disconnected')
      return
    }

    if (message.type === 'room_created' || message.type === 'room_joined') {
      setRoomCode(message.code)
      setPlayers(message.players || [])
      setPlayerId(message.playerId)
      setHostId(message.hostId)
      setMode('lobby')
      setError('')
      try {
        const resolvedName =
          message.players?.find((player) => player.id === message.playerId)
            ?.name || name.trim()
        persistMultiplayerIdentity(localStorage, sessionStorage, {
          code: message.code || '',
          name: resolvedName,
          playerId: message.playerId || '',
        })
      } catch (storageError) {
        console.warn('Failed to persist multiplayer identity.', storageError)
      }
      return
    }

    if (message.type === 'room_update') {
      setPlayers(message.players || [])
      setHostId(message.hostId || '')
      return
    }

    if (message.type === 'game_started') {
      const startTime = message.startTime || Date.now()
      try {
        localStorage.setItem('kt-timer-start', String(startTime))
        const resolvedCode = message.code || roomCode
        const resolvedName = name?.trim()
        if (resolvedCode) {
          localStorage.setItem('kt-room-code', resolvedCode)
          sessionStorage.setItem('kt-room-code', resolvedCode)
        }
        if (resolvedName) {
          localStorage.setItem('kt-player-name', resolvedName)
          sessionStorage.setItem('kt-player-name', resolvedName)
        }
        if (playerId) {
          sessionStorage.setItem('kt-player-id', playerId)
        }
      } catch (storageError) {
        console.warn('Failed to persist multiplayer data.', storageError)
      }
      navigate('/select-army')
    }
  }

  const connectAndSend = (payload) => {
    setError('')
    if (socketRef.current) {
      socketRef.current.close()
    }

    const socket = new WebSocket(WS_URL)
    socketRef.current = socket
    setStatus('connecting')

    socket.addEventListener('open', () => {
      setStatus('connected')
      socket.send(JSON.stringify(payload))
    })

    socket.addEventListener('message', handleMessage)

    socket.addEventListener('close', () => {
      setStatus('disconnected')
    })

    socket.addEventListener('error', () => {
      setError('Unable to reach the multiplayer server.')
    })
  }

  const handleCreate = () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Enter a username to create a room.')
      return
    }
    connectAndSend({ type: 'create_room', name: trimmedName })
  }

  const handleJoin = () => {
    const trimmedName = name.trim()
    const normalized = normalizeCode(roomCode)
    if (!trimmedName || !normalized) {
      setError('Enter a username and room code to join.')
      return
    }
    connectAndSend({ type: 'join_room', name: trimmedName, code: normalized })
  }

  const handleReady = () => {
    if (!sendMessage({ type: 'set_ready', ready: true, code: roomCode, playerId })) {
      setError('Connection lost. Please reconnect.')
    }
  }

  const handleBack = () => {
    setMode('choice')
    setError('')
    setPlayers([])
    setRoomCode('')
    setPlayerId('')
    setHostId('')
    setStatus('disconnected')
    if (socketRef.current) {
      socketRef.current.close()
      socketRef.current = null
    }
  }

  return (
    <div className="app-shell">
      <main className="app-content">
        <section className="page multiplayer">
          <div className="multiplayer-header">
            <p className="eyebrow">Multiplayer</p>
            <h1>Host or join a match.</h1>
            <p className="lede">
              Create a room, share the code, and start once you are both ready.
            </p>
          </div>

          {mode === 'choice' && (
            <div className="multiplayer-actions">
              <button
                className="primary-link"
                type="button"
                onClick={() => setMode('create')}
              >
                Create
              </button>
              <button
                className="ghost-link"
                type="button"
                onClick={() => setMode('join')}
              >
                Join
              </button>
            </div>
          )}

          {(mode === 'create' || mode === 'join') && (
            <div className="multiplayer-form">
              <div className="multiplayer-field">
                <label htmlFor="mp-name">Username</label>
                <input
                  id="mp-name"
                  type="text"
                  placeholder="Your callsign"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              {mode === 'join' && (
                <div className="multiplayer-field">
                  <label htmlFor="mp-code">Room code</label>
                  <input
                    id="mp-code"
                    type="text"
                    placeholder="ABC123"
                    value={roomCode}
                    onChange={(event) =>
                      setRoomCode(normalizeCode(event.target.value))
                    }
                  />
                </div>
              )}
              <div className="multiplayer-actions">
                <button
                  className="primary-link"
                  type="button"
                  onClick={mode === 'create' ? handleCreate : handleJoin}
                  disabled={status === 'connecting'}
                >
                  {mode === 'create' ? 'Create Room' : 'Join Room'}
                </button>
                <button
                  className="ghost-link"
                  type="button"
                  onClick={handleBack}
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {mode === 'lobby' && (
            <div className="multiplayer-lobby">
              <div className="multiplayer-room">
                <p className="room-label">Room code</p>
                <p className="room-code">{roomCode}</p>
                <p className="room-hint">Share this code to invite a player.</p>
              </div>
              <div className="multiplayer-players">
                {players.map((player) => (
                  <div
                    key={player.id}
                    className={`player-card ${
                      player.id === hostId ? 'player-host' : ''
                    }`}
                  >
                    <div>
                      <p className="player-name">{player.name}</p>
                      {player.id === hostId && (
                        <p className="player-role">Host</p>
                      )}
                    </div>
                    <span
                      className={`player-status ${
                        player.ready ? 'ready' : 'waiting'
                      }`}
                    >
                      {player.ready ? 'Ready' : 'Waiting'}
                    </span>
                  </div>
                ))}
              </div>
              <div className="multiplayer-actions">
                <button
                  className="primary-link"
                  type="button"
                  onClick={handleReady}
                  disabled={isReady}
                >
                  {isReady ? 'Ready' : 'Start Game'}
                </button>
                <button
                  className="ghost-link"
                  type="button"
                  onClick={handleBack}
                >
                  Leave
                </button>
              </div>
              <p className="room-footer">
                {hasTwoPlayers
                  ? 'Waiting for both players to ready up.'
                  : 'Waiting for another player to join.'}
              </p>
            </div>
          )}

          {error && <p className="multiplayer-error">{error}</p>}
          {status === 'connecting' && (
            <p className="multiplayer-status">Connecting...</p>
          )}
        </section>
      </main>
    </div>
  )
}

export default Multiplayer
