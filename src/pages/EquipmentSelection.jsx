import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getKillteamById } from '../data/ktData.js'
import { useSelection } from '../state/SelectionContext.jsx'
import { resolveWsUrl } from '../state/wsUrl.js'
import './EquipmentSelection.css'

const WS_URL = resolveWsUrl()

const parseEquipmentWeaponEffects = (effects) => {
  if (!effects) return []
  return String(effects)
    .split(';')
    .map((entry) => entry.trim())
    .filter((entry) => entry.startsWith('ADDWEP:'))
    .map((entry, index) => {
      const parts = entry.replace('ADDWEP:', '').split('|')
      const [name, range, atk, hit, dmg, wr] = parts
      return {
        key: `${name ?? 'weapon'}-${index}`,
        name: name?.trim() || 'Weapon',
        range: range?.trim() || '',
        ATK: atk?.trim() || '—',
        HIT: hit?.trim() || '—',
        DMG: dmg?.trim() || '—',
        WR: wr?.trim() || '—',
      }
    })
}

const stripEquipmentTable = (description) => {
  if (!description) return ''
  const lines = String(description).split('\n')
  let inTable = false
  const result = []

  lines.forEach((line) => {
    if (line.includes('|**Name**|')) {
      inTable = true
      return
    }

    if (inTable) {
      if (!line.trim().startsWith('|')) {
        inTable = false
      } else {
        return
      }
    }

    result.push(line)
  })

  return result.join('\n').trim()
}

function EquipmentSelection() {
  const { killteamId } = useParams()
  const {
    selectedEquipmentByTeam,
    selectedUnitsByTeam,
    setSelectedEquipment,
  } = useSelection()
  const [expandedEquipment, setExpandedEquipment] = useState(() => new Set())
  const didInitRef = useRef(new Set())
  const navigate = useNavigate()
  const socketRef = useRef(null)
  const [roomCode, setRoomCode] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [isMultiplayer, setIsMultiplayer] = useState(false)
  const killteam = useMemo(
    () => getKillteamById(killteamId),
    [killteamId],
  )

  useEffect(() => {
    try {
      const storedCode =
        sessionStorage.getItem('kt-room-code') ||
        localStorage.getItem('kt-room-code') ||
        ''
      const storedName =
        sessionStorage.getItem('kt-player-name') ||
        localStorage.getItem('kt-player-name') ||
        ''
      const storedId = sessionStorage.getItem('kt-player-id') || ''
      setRoomCode(storedCode)
      setPlayerName(storedName)
      setPlayerId(storedId)
      setIsMultiplayer(Boolean(storedCode))
    } catch (error) {
      console.warn('Failed to read multiplayer metadata.', error)
    }
  }, [])

  useEffect(() => {
    if (!roomCode || (!playerName && !playerId)) return undefined
    const socket = new WebSocket(WS_URL)
    socketRef.current = socket

    const handleMessage = (event) => {
      const message = JSON.parse(event.data)
      if (message.type === 'sync_ready') {
        // Ready for sync; no selection lock.
      }
      if (message.type === 'request_sync_state') {
        sendSyncState()
      }
    }

    socket.addEventListener('open', () => {
      const syncName = playerName || 'Player'
      socket.send(
        JSON.stringify({
          type: 'sync_init',
          code: roomCode,
          name: syncName,
          playerId,
        }),
      )
    })
    socket.addEventListener('message', handleMessage)

    return () => {
      socket.removeEventListener('message', handleMessage)
      socket.close()
    }
  }, [roomCode, playerName, playerId, killteamId, navigate])

  if (!killteam) {
    return (
      <div className="app-shell">
        <main className="app-content">
          <section className="page">
            <p className="lede">Army not found.</p>
            <Link className="ghost-link" to="/select-army">
              Back to army select
            </Link>
          </section>
        </main>
      </div>
    )
  }

  const equipments = useMemo(
    () => killteam?.equipments ?? [],
    [killteam],
  )
  const factionEquipment = useMemo(
    () =>
      equipments.filter(
        (equipment) => equipment.killteamId === killteam.killteamId,
      ),
    [equipments, killteam],
  )
  const universalEquipment = useMemo(
    () => equipments.filter((equipment) => equipment.killteamId == null),
    [equipments],
  )

  useEffect(() => {
    if (!killteamId || didInitRef.current.has(killteamId)) return
    if (selectedEquipmentByTeam[killteamId]?.length) {
      didInitRef.current.add(killteamId)
      return
    }
    const defaultSelected = new Set(
      factionEquipment.map((equipment) => equipment.eqId),
    )
    setSelectedEquipment(killteamId, defaultSelected)
    didInitRef.current.add(killteamId)
  }, [
    killteamId,
    factionEquipment,
    selectedEquipmentByTeam,
    setSelectedEquipment,
  ])

  const selectedEquipment = new Set(
    selectedEquipmentByTeam[killteamId] ?? [],
  )
  const selectedUnits = selectedUnitsByTeam[killteamId] ?? []

  const toggleEquipment = (eqId) => {
    const next = new Set(selectedEquipment)
    if (next.has(eqId)) {
      next.delete(eqId)
    } else {
      next.add(eqId)
    }
    setSelectedEquipment(killteamId, next)
  }

  const toggleExpanded = (eqId) => {
    setExpandedEquipment((prev) => {
      const next = new Set(prev)
      if (next.has(eqId)) {
        next.delete(eqId)
      } else {
        next.add(eqId)
      }
      return next
    })
  }

  const handleToggleExpanded = (eqId) => {
    toggleExpanded(eqId)
    if (selectedEquipment.has(eqId)) return
    setSelectedEquipment(killteamId, new Set(selectedEquipment).add(eqId))
  }

  const sendSyncState = () => {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    socket.send(
      JSON.stringify({
        type: 'sync_state',
        code: roomCode,
        playerId,
        state: {
          name: playerName || 'Player',
          killteamId,
          selectedUnits,
          selectedEquipment: Array.from(selectedEquipment),
          unitStates: {},
          deadUnits: {},
          woundsByUnit: {},
          stanceByUnit: {},
          statusesByUnit: {},
        },
      }),
    )
  }

  const handleStart = () => {
    if (isMultiplayer) {
      const socket = socketRef.current
      if (socket && socket.readyState === WebSocket.OPEN) {
        sendSyncState()
      }
    }
    navigate('/select-tac-ops', { state: { killteamId } })
  }

  const renderEquipmentCard = (equipment) => {
    const weaponRows = parseEquipmentWeaponEffects(equipment.effects)
    const descriptionText = stripEquipmentTable(equipment.description)

    return (
      <article
        className={`equipment-card${
          selectedEquipment.has(equipment.eqId) ? ' selected' : ''
        }${expandedEquipment.has(equipment.eqId) ? ' expanded' : ''
        }`}
        key={equipment.eqId}
        role="button"
        tabIndex={0}
        aria-pressed={selectedEquipment.has(equipment.eqId)}
        onClick={() => toggleEquipment(equipment.eqId)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            toggleEquipment(equipment.eqId)
          }
        }}
      >
        <div className="equipment-card-header">
          <button
            className="equipment-toggle"
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              handleToggleExpanded(equipment.eqId)
            }}
            aria-expanded={expandedEquipment.has(equipment.eqId)}
            aria-label={`Toggle ${equipment.eqName} details`}
          >
            &gt;
          </button>
          <h3>{equipment.eqName}</h3>
        </div>
        <div className="equipment-description">
          {weaponRows.length ? (
            <div className="equipment-weapon-table">
              <div className="equipment-weapon-row equipment-weapon-header">
                <span>NAME</span>
                <span>ATK</span>
                <span>HIT</span>
                <span>DMG</span>
                <span>WR</span>
              </div>
              {weaponRows.map((row) => (
                <div className="equipment-weapon-row" key={`${equipment.eqId}-${row.key}`}>
                  <span className="equipment-weapon-name">{row.name}</span>
                  <span>{row.ATK}</span>
                  <span>{row.HIT}</span>
                  <span>{row.DMG}</span>
                  <span className="equipment-weapon-rules">{row.WR}</span>
                </div>
              ))}
            </div>
          ) : null}
          {descriptionText
            ? descriptionText.split('\n').map((line, lineIndex, lines) => (
                <span key={`${equipment.eqId}-line-${lineIndex}`}>
                  {line}
                  {lineIndex < lines.length - 1 ? <br /> : null}
                </span>
              ))
            : null}
        </div>
      </article>
    )
  }

  return (
    <div className="app-shell">
      <main className="app-content">
        <section className="page equipment-selection">
          <div className="equipment-header">
            <div>
              <p className="eyebrow">Equipment</p>
              <h1>{killteam.killteamName}</h1>
              <p className="lede">Review equipment rules before locking in.</p>
            </div>
            <Link className="ghost-link" to={`/select-army/${killteamId}/units`}>
              Back to units
            </Link>
          </div>

          <section className="equipment-group">
            <div className="equipment-group-header">
              <h2>Faction Equipment</h2>
              <span className="equipment-count">
                {factionEquipment.length} items
              </span>
            </div>
            <div className="equipment-grid">
              {factionEquipment.map(renderEquipmentCard)}
            </div>
          </section>

          <section className="equipment-group">
            <div className="equipment-group-header">
              <h2>Universal Equipment</h2>
              <span className="equipment-count">
                {universalEquipment.length} items
              </span>
            </div>
            <div className="equipment-grid">
              {universalEquipment.map(renderEquipmentCard)}
            </div>
          </section>

          <div className="equipment-footer">
            <button
              className="equipment-start-button"
              type="button"
              onClick={handleStart}
            >
              Next: Select Tac Ops
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}

export default EquipmentSelection
