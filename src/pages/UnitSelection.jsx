import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getKillteamById } from '../data/ktData.js'
import { useSelection } from '../state/SelectionContext.jsx'
import { resolveWsUrl } from '../state/wsUrl.js'
import UnitCard from '../components/UnitCard.jsx'
import './UnitSelection.css'

const WS_URL = resolveWsUrl()

const normalizeText = (value) =>
  value
    ? value
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, ' ')
        .trim()
    : ''

const parseRepeatableKeywords = (composition) => {
  if (!composition) return []
  const match = composition.match(
    /Other than ([^.]+?) operatives?, your kill team can only include each operative on this list once/i,
  )
  if (!match) return []
  return match[1]
    .split(/,| and /i)
    .map((value) => normalizeText(value))
    .filter(Boolean)
}

const UNIT_COUNT_OVERRIDES = {
  'VOT-HKY': {
    'VOT-HKY-WAR': 3,
  },
  'TAU-VESP': {
    'TAU-VESP-WAR': 5,
  },
  'ORK-KOM': {
    'ORK-KOM-BOY': 2,
  },
}

const buildUnitCounts = (killteam, operatives) => {
  const composition = killteam?.composition ?? ''
  if (!composition || operatives.length === 0) return new Map()

  const repeatableKeywords = parseRepeatableKeywords(composition)
  const opTypeLookup = operatives.map((opType) => ({
    name: opType.opTypeName,
    normalized: normalizeText(opType.opTypeName),
  }))

  const lines = composition
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const counts = new Map()
  let currentGroupCount = null
  let currentGroupUnits = new Set()

  const applyGroup = () => {
    if (!currentGroupCount || currentGroupUnits.size === 0) return
    currentGroupUnits.forEach((name) => {
      const normalizedName = normalizeText(name)
      const isRepeatable = repeatableKeywords.length
        ? repeatableKeywords.some((keyword) => normalizedName.includes(keyword))
        : true
      const count = isRepeatable ? currentGroupCount : 1
      const previous = counts.get(name) ?? 1
      counts.set(name, Math.max(previous, count))
    })
  }

  lines.forEach((line) => {
    const groupMatch = line.match(
      /^-\s*(\d+)\s+.*operatives selected from the following list:/i,
    )
    if (groupMatch) {
      applyGroup()
      currentGroupCount = Number.parseInt(groupMatch[1], 10)
      currentGroupUnits = new Set()
      return
    }

    if (currentGroupCount && line.startsWith('-')) {
      const normalizedLine = normalizeText(line)
      const matched = opTypeLookup.find((opType) =>
        normalizedLine.includes(opType.normalized),
      )
      if (matched) {
        currentGroupUnits.add(matched.name)
      }
    }
  })

  applyGroup()
  const overrides = UNIT_COUNT_OVERRIDES[killteam?.killteamId] ?? {}
  operatives.forEach((opType) => {
    if (overrides[opType.opTypeId]) {
      counts.set(opType.opTypeName, overrides[opType.opTypeId])
    }
  })

  return counts
}

function UnitSelection() {
  const { killteamId } = useParams()
  const {
    selectedUnitsByTeam,
    setSelectedUnits,
    selectedWeaponsByTeam,
    setSelectedWeapons,
  } = useSelection()
  const didInitRef = useRef(new Set())
  const socketRef = useRef(null)
  const [roomCode, setRoomCode] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [wsReady, setWsReady] = useState(false)
  const killteam = useMemo(
    () => getKillteamById(killteamId),
    [killteamId],
  )

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

  const operatives = (killteam.opTypes ?? []).filter((opType) => opType.isOpType)
  const unitCounts = buildUnitCounts(killteam, operatives)
  const expandedUnits = operatives.flatMap((opType) => {
    const count = unitCounts.get(opType.opTypeName) ?? 1
    return Array.from({ length: count }, (_, index) => ({
      opType,
      instance: count > 1 ? index + 1 : null,
      instanceCount: count,
    }))
  })

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
      const storedId =
        sessionStorage.getItem('kt-player-id') ||
        localStorage.getItem('kt-player-id') ||
        ''
      setRoomCode(storedCode)
      setPlayerName(storedName)
      setPlayerId(storedId)
    } catch (error) {
      console.warn('Failed to read multiplayer metadata.', error)
    }
  }, [])

  const selectedUnits = new Set(selectedUnitsByTeam[killteamId] ?? [])

  const sendSyncState = () => {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    socket.send(
      JSON.stringify({
        type: 'sync_state',
        code: roomCode,
        playerId,
        state: {
          name: playerName || '',
          killteamId,
          selectedUnits: Array.from(selectedUnits),
          selectedEquipment: [],
          unitStates: {},
          deadUnits: {},
          woundsByUnit: {},
          stanceByUnit: {},
          statusesByUnit: {},
        },
      }),
    )
  }

  useEffect(() => {
    if (!roomCode || (!playerName && !playerId)) return undefined
    const socket = new WebSocket(WS_URL)
    socketRef.current = socket
    setWsReady(false)

    const handleMessage = (event) => {
      const message = JSON.parse(event.data)
      if (message.type === 'sync_ready') {
        setWsReady(true)
        try {
          if (roomCode && Array.isArray(message.players)) {
            localStorage.setItem(
              `kt-room-players-${roomCode}`,
              JSON.stringify(message.players),
            )
            if (message.hostId) {
              localStorage.setItem(`kt-room-host-${roomCode}`, message.hostId)
            }
            const activeGameId = localStorage.getItem('kt-game-id') || ''
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
                if (activeGameId) {
                  localStorage.setItem(
                    `kt-room-player-killteam-${roomCode}-${id}-${activeGameId}`,
                    incomingKillteamId,
                  )
                }
              }
            })
          }
        } catch (error) {
          console.warn('Failed to persist unit selection room metadata.', error)
        }
        return
      }
      if (message.type === 'request_sync_state') {
        sendSyncState()
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
    })
    socket.addEventListener('message', handleMessage)
    socket.addEventListener('close', () => {
      setWsReady(false)
    })

    return () => {
      socket.removeEventListener('message', handleMessage)
      socket.close()
    }
  }, [roomCode, playerName, playerId])

  useEffect(() => {
    if (!wsReady) return
    sendSyncState()
  }, [wsReady, killteamId, selectedUnitsByTeam])

  useEffect(() => {
    if (!roomCode || !playerId || !killteamId) return
    try {
      const activeGameId = localStorage.getItem('kt-game-id') || ''
      const baseKey = `kt-room-player-selected-units-${roomCode}-${playerId}`
      const payload = JSON.stringify(selectedUnitsByTeam[killteamId] ?? [])
      localStorage.setItem(baseKey, payload)
      if (activeGameId) {
        localStorage.setItem(`${baseKey}-${activeGameId}`, payload)
      }
      window.dispatchEvent(new CustomEvent('kt-killop-update'))
    } catch (error) {
      console.warn('Failed to persist room selected units from unit selection.', error)
    }
  }, [roomCode, playerId, killteamId, selectedUnitsByTeam])

  useEffect(() => {
    if (!killteamId || didInitRef.current.has(killteamId)) return
    if (selectedUnitsByTeam[killteamId]?.length) {
      didInitRef.current.add(killteamId)
      return
    }
    if (killteamId === 'VOT-HKY') {
      const allUnitKeys = expandedUnits.map(
        ({ opType, instance }) => `${opType.opTypeId}-${instance ?? 0}`,
      )
      setSelectedUnits(killteamId, allUnitKeys)
    } else {
      setSelectedUnits(killteamId, [])
    }
    didInitRef.current.add(killteamId)
  }, [killteamId, expandedUnits, setSelectedUnits, selectedUnitsByTeam])

  return (
    <div className="app-shell">
      <main className="app-content">
        <section className="page unit-selection">
          <div className="unit-selection-header">
            <div>
              <p className="eyebrow">Unit Selection</p>
              <h1>{killteam.killteamName}</h1>
              <p className="lede">
                Tap a card to view detailed rules and wargear.
              </p>
            </div>
            <Link className="ghost-link" to="/select-army">
              Change army
            </Link>
          </div>

          <div className="unit-grid">
            {expandedUnits.map(({ opType, instance, instanceCount }) => {
              const unitKey = `${opType.opTypeId}-${instance ?? 0}`
              const weapons = opType.weapons ?? []
              const weaponKeys = weapons.map(
                (weapon, index) =>
                  weapon.wepId ?? `${weapon.wepName ?? 'weapon'}-${index}`,
              )
              const storedWeapons =
                selectedWeaponsByTeam[killteamId]?.[unitKey]
              const activeWeapons = new Set(
                Array.isArray(storedWeapons) ? storedWeapons : weaponKeys,
              )
              const isSelected = selectedUnits.has(unitKey)
              const parsedWounds = Number.parseInt(opType.WOUNDS, 10)
              const currentWounds = Number.isNaN(parsedWounds)
                ? 0
                : parsedWounds

              const handleToggle = () => {
                const next = new Set(selectedUnits)
                if (next.has(unitKey)) {
                  next.delete(unitKey)
                } else {
                  next.add(unitKey)
                }
                setSelectedUnits(killteamId, next)
              }

              return (
                <div
                  className={`unit-selection-card${
                    isSelected ? ' is-selected' : ''
                  }`}
                  key={unitKey}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={handleToggle}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      handleToggle()
                    }
                  }}
                >
                  <UnitCard
                    opType={opType}
                    instance={instance}
                    instanceCount={instanceCount}
                    currentWounds={currentWounds}
                    detailsOpen
                    state="ready"
                    stance="conceal"
                    readOnly
                    weaponSelection={Array.from(activeWeapons)}
                    onWeaponSelectionChange={(nextSelection) =>
                      setSelectedWeapons(killteamId, unitKey, nextSelection)
                    }
                  />
                </div>
              )
            })}
          </div>

          <Link
            className="unit-lock-button"
            to={`/select-army/${killteamId}/equipment`}
          >
            Lock In Units
          </Link>
        </section>
      </main>
    </div>
  )
}

export default UnitSelection
