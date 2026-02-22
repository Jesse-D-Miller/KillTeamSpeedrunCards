import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  getKillteamById,
  getRuleDescription,
  getRuleSuggestions,
  tokenizeWeaponRuleText,
} from '../data/ktData.js'
import { useSelection } from '../state/SelectionContext.jsx'
import { resolveWsUrl } from '../state/wsUrl.js'
import UnitCard from '../components/UnitCard.jsx'
import OpponentPanel from '../components/OpponentPanel.jsx'
import './Game.css'

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

const formatElapsed = (elapsedMs) => {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

const SP_KILLTEAMS = new Set(['VOT-HKY', 'TAU-VESP'])
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

const parseRules = (wrValue) => {
  if (!wrValue || wrValue === '—') return []
  return String(wrValue)
    .split(',')
    .map((rule) => rule.trim())
    .filter(Boolean)
}

const formatCostLabel = (item) => {
  if (!item) return null
  if (item.AP != null) return `${item.AP}AP`
  if (item.CP != null) return `${item.CP}CP`
  return null
}

const isLegionaryUnit = (opType) =>
  /\bLEGIONARY\b/i.test(opType?.keywords ?? '')

function Game() {
  const { killteamId } = useParams()
  const {
    selectedUnitsByTeam,
    selectedEquipmentByTeam,
    setSelectedUnits,
    setSelectedEquipment,
    legionaryMarksByTeam,
    setLegionaryMarks,
  } = useSelection()
  const [unitStates, setUnitStates] = useState({})
  const [deadUnits, setDeadUnits] = useState({})
  const [woundsByUnit, setWoundsByUnit] = useState({})
  const [detailsOpenByUnit, setDetailsOpenByUnit] = useState({})
  const [stanceByUnit, setStanceByUnit] = useState({})
  const [statusesByUnit, setStatusesByUnit] = useState({})
  const [aplAdjustByUnit, setAplAdjustByUnit] = useState({})
  const [timerStart, setTimerStart] = useState(null)
  const [timerNow, setTimerNow] = useState(Date.now())
  const [menuOpen, setMenuOpen] = useState(false)
  const [ruleModal, setRuleModal] = useState(null)
  const [tpCount, setTpCount] = useState(1)
  const [cpCount, setCpCount] = useState(0)
  const [vpCount, setVpCount] = useState(0)
  const [spCount, setSpCount] = useState(0)
  const [opponentPanelOpen, setOpponentPanelOpen] = useState(false)
  const [opponentState, setOpponentState] = useState(null)
  const [opponentSnapshot, setOpponentSnapshot] = useState(null)
  const [opponentDebug, setOpponentDebug] = useState({})
  const [roomCode, setRoomCode] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [wsReady, setWsReady] = useState(false)
  const [opponentRefreshAt, setOpponentRefreshAt] = useState(null)
  const socketRef = useRef(null)
  const syncStateRef = useRef(null)
  const hasHydratedRef = useRef(false)
  const hydratedKillteamRef = useRef(null)
  const opponentStorageKey = useMemo(
    () => (roomCode && playerId ? `kt-opponent-${roomCode}-${playerId}` : null),
    [roomCode, playerId],
  )
  const ruleDetails = useMemo(
    () => (ruleModal ? getRuleDescription(ruleModal) : null),
    [ruleModal],
  )
  const ruleSuggestions = useMemo(
    () => (ruleModal && !ruleDetails ? getRuleSuggestions(ruleModal, 3) : []),
    [ruleModal, ruleDetails],
  )

  useEffect(() => {
    setOpponentDebug((prev) => ({
      ...prev,
      mountedAt: Date.now(),
    }))
  }, [])

  useEffect(() => {
    if (!roomCode || !wsReady) return undefined
    const interval = window.setInterval(() => {
      const socket = socketRef.current
      const currentState = syncStateRef.current
      if (
        !socket ||
        socket.readyState !== WebSocket.OPEN ||
        !currentState
      ) {
        return
      }
      socket.send(
        JSON.stringify({
          type: 'sync_state',
          code: roomCode,
          playerId,
          state: currentState,
        }),
      )
    }, 2000)
    return () => window.clearInterval(interval)
  }, [roomCode, playerId, wsReady])

  const isRangeRule = (rule) => /^(Rng|Range)\b/i.test(rule)

  const renderRuleText = (text, onRuleClick) =>
    tokenizeWeaponRuleText(text).map((token, tokenIndex) =>
      token.type === 'rule' && !isRangeRule(token.value) ? (
        <button
          key={`rule-token-${tokenIndex}`}
          type="button"
          className="weapon-rule weapon-rule-button"
          onClick={() => onRuleClick(token.ruleName)}
        >
          {token.value}
        </button>
      ) : (
        <span key={`rule-token-${tokenIndex}`}>{token.value}</span>
      ),
    )
  const killteam = useMemo(
    () => getKillteamById(killteamId),
    [killteamId],
  )
  const storageKey = useMemo(
    () => (killteamId ? `kt-game-${killteamId}` : null),
    [killteamId],
  )

  useEffect(() => {
    try {
      const stored = localStorage.getItem('kt-timer-start')
      setTimerStart(stored ? Number.parseInt(stored, 10) : null)
    } catch (error) {
      console.warn('Failed to read timer start.', error)
    }
  }, [])

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
    } catch (error) {
      console.warn('Failed to read multiplayer metadata.', error)
    }
  }, [])

  useEffect(() => {
    if (!timerStart) return undefined
    const interval = window.setInterval(() => {
      setTimerNow(Date.now())
    }, 1000)
    return () => window.clearInterval(interval)
  }, [timerStart])

  useEffect(() => {
    if (!roomCode || (!playerName && !playerId)) return undefined
    const socket = new WebSocket(WS_URL)
    socketRef.current = socket
    setWsReady(false)

    const handleMessage = (event) => {
      const message = JSON.parse(event.data)
      if (message.type === 'error') {
        console.warn('Multiplayer error:', message.message)
        setOpponentDebug((prev) => ({
          ...prev,
          lastError: message.message || 'Unknown error',
          lastErrorAt: Date.now(),
        }))
        return
      }
      if (message.type === 'sync_ready') {
        setWsReady(true)
        setOpponentDebug((prev) => ({
          ...prev,
          lastSyncReadyAt: Date.now(),
        }))
        const currentState = syncStateRef.current
        if (currentState && socket.readyState === WebSocket.OPEN) {
          socket.send(
            JSON.stringify({
              type: 'sync_state',
              code: roomCode,
              playerId,
              state: currentState,
            }),
          )
        }
        return
      }
      if (message.type === 'opponent_state') {
        setOpponentState(message.state)
        setOpponentDebug((prev) => ({
          ...prev,
          lastOpponentAt: Date.now(),
          lastOpponentSource: message.source || 'unknown',
          lastOpponentSummary: message.state
            ? {
                name: message.state.name,
                killteamId: message.state.killteamId,
                selectedUnits: message.state.selectedUnits?.length || 0,
              }
            : null,
        }))
        if (message.source === 'refresh') {
          setOpponentSnapshot(message.state)
        }
        if (opponentStorageKey) {
          localStorage.setItem(
            opponentStorageKey,
            JSON.stringify({ state: message.state, at: Date.now() }),
          )
        }
      }
      if (message.type === 'request_sync_state') {
        setOpponentDebug((prev) => ({
          ...prev,
          lastRequestSyncAt: Date.now(),
        }))
        const currentState = syncStateRef.current
        if (!currentState || socket.readyState !== WebSocket.OPEN) return
        socket.send(
          JSON.stringify({
            type: 'sync_state',
            code: message.code || roomCode,
            playerId,
            state: currentState,
          }),
        )
      }
    }

    socket.addEventListener('open', () => {
      setOpponentDebug((prev) => ({
        ...prev,
        lastSocketOpenAt: Date.now(),
      }))
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
    socket.addEventListener('close', () => {
      setWsReady(false)
      setOpponentDebug((prev) => ({
        ...prev,
        lastSocketCloseAt: Date.now(),
      }))
    })
    socket.addEventListener('error', () => {
      setOpponentDebug((prev) => ({
        ...prev,
        lastSocketErrorAt: Date.now(),
      }))
    })

    return () => {
      socket.removeEventListener('message', handleMessage)
      socket.close()
    }
  }, [roomCode, playerName, playerId, opponentStorageKey])

  useEffect(() => {
    if (!opponentStorageKey) return
    const stored = localStorage.getItem(opponentStorageKey)
    if (!stored) return
    try {
      const parsed = JSON.parse(stored)
      if (parsed?.state) {
        setOpponentState(parsed.state)
      }
    } catch (error) {
      console.warn('Failed to read opponent storage.', error)
    }
  }, [opponentStorageKey])

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

  const selectedUnitKeys = selectedUnitsByTeam[killteamId] ?? []
  const selectedEquipmentKeys = selectedEquipmentByTeam[killteamId] ?? []
  const selectedUnits = new Set(selectedUnitKeys)
  const selectedEquipmentIds = new Set(selectedEquipmentKeys)
  const selectedEquipment = useMemo(
    () =>
      (killteam.equipments ?? []).filter((equipment) =>
        selectedEquipmentIds.has(equipment.eqId),
      ),
    [killteam, selectedEquipmentIds],
  )
  const ploys = killteam.ploys ?? []
  const stratPloys = ploys.filter((ploy) => ploy.ployType === 'S')
  const firefightPloys = ploys.filter(
    (ploy) => ploy.ployType === 'T' || ploy.ployType === 'F',
  )
  const factionRules = useMemo(() => {
    const seen = new Set()
    const rules = []
    ;(killteam.opTypes ?? []).forEach((opType) => {
      ;(opType.abilities ?? [])
        .filter((ability) => ability.isFactionRule)
        .forEach((ability) => {
          const name = String(ability.abilityName ?? '').trim().toLowerCase()
          const description = String(ability.description ?? '')
            .trim()
            .toLowerCase()
          const key = `${name}::${description}`
          if (!name || seen.has(key)) return
          seen.add(key)
          rules.push(ability)
        })
    })
    return rules
  }, [killteam])
  const visibleUnits = expandedUnits
    .map((unit, index) => ({
      ...unit,
      key: `${unit.opType.opTypeId}-${unit.instance ?? 0}`,
      index,
    }))
    .filter((unit) => selectedUnits.has(unit.key))
  const legionaryMarkByUnit = legionaryMarksByTeam[killteamId] ?? {}
  const isMultiplayer = Boolean(roomCode)
  const opponentRenderState = opponentSnapshot ?? opponentState
  const opponentKillteam = useMemo(() => {
    if (!opponentRenderState?.killteamId) return null
    return getKillteamById(opponentRenderState.killteamId)
  }, [opponentRenderState])
  const opponentOperatives = useMemo(() => {
    return (opponentKillteam?.opTypes ?? []).filter((opType) => opType.isOpType)
  }, [opponentKillteam])
  const opponentUnitCounts = useMemo(() => {
    if (!opponentKillteam) return new Map()
    return buildUnitCounts(opponentKillteam, opponentOperatives)
  }, [opponentKillteam, opponentOperatives])
  const opponentExpandedUnits = useMemo(() => {
    if (!opponentKillteam) return []
    return opponentOperatives.flatMap((opType) => {
      const count = opponentUnitCounts.get(opType.opTypeName) ?? 1
      return Array.from({ length: count }, (_, index) => ({
        opType,
        instance: count > 1 ? index + 1 : null,
        instanceCount: count,
      }))
    })
  }, [opponentKillteam, opponentOperatives, opponentUnitCounts])
  const opponentAllUnits = useMemo(() => {
    return opponentExpandedUnits.map((unit, index) => ({
      ...unit,
      key: `${unit.opType.opTypeId}-${unit.instance ?? 0}`,
      index,
    }))
  }, [opponentExpandedUnits])

  const requestOpponentState = () => {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN || !roomCode || !playerId) {
      return
    }
    const currentState = syncStateRef.current
    if (currentState) {
      socket.send(
        JSON.stringify({
          type: 'sync_state',
          code: roomCode,
          playerId,
          state: currentState,
        }),
      )
    }
    setOpponentSnapshot(null)
    socket.send(
      JSON.stringify({
        type: 'request_opponent_state',
        code: roomCode,
        playerId,
      }),
    )
    setOpponentRefreshAt(Date.now())
  }

  useEffect(() => {
    if (!storageKey || !killteamId) return
    if (hydratedKillteamRef.current === killteamId) return
    const stored = localStorage.getItem(storageKey)
    if (!stored) {
      hasHydratedRef.current = true
      hydratedKillteamRef.current = killteamId
      return
    }
    try {
      const parsed = JSON.parse(stored)
      setUnitStates(parsed.unitStates ?? {})
      setDeadUnits(parsed.deadUnits ?? {})
      setWoundsByUnit(parsed.woundsByUnit ?? {})
      setDetailsOpenByUnit(parsed.detailsOpenByUnit ?? {})
      setStanceByUnit(parsed.stanceByUnit ?? {})
      setStatusesByUnit(parsed.statusesByUnit ?? {})
      setAplAdjustByUnit(parsed.aplAdjustByUnit ?? {})
      if (parsed.legionaryMarkByUnit && killteamId) {
        setLegionaryMarks(killteamId, (current) =>
          Object.keys(current).length ? current : parsed.legionaryMarkByUnit,
        )
      }
      if ((selectedUnitsByTeam[killteamId] ?? []).length === 0) {
        const storedUnits = parsed.selectedUnits ?? []
        if (storedUnits.length) {
          setSelectedUnits(killteamId, storedUnits)
        }
      }
      if ((selectedEquipmentByTeam[killteamId] ?? []).length === 0) {
        const storedEquipment = parsed.selectedEquipment ?? []
        if (storedEquipment.length) {
          setSelectedEquipment(killteamId, storedEquipment)
        }
      }
    } catch (error) {
      console.warn('Failed to load saved game state.', error)
    } finally {
      hasHydratedRef.current = true
      hydratedKillteamRef.current = killteamId
    }
  }, [
    storageKey,
    killteamId,
    setSelectedUnits,
    setSelectedEquipment,
    setLegionaryMarks,
  ])

  useEffect(() => {
    if (!killteamId) return
    const currentGameId = localStorage.getItem('kt-game-id') || ''
    if (!currentGameId) return
    const marksGameKey = `kt-legionary-marks-game-${killteamId}`
    const marksGameId = localStorage.getItem(marksGameKey) || ''
    if (marksGameId === currentGameId) return
    setLegionaryMarks(killteamId, {})
    localStorage.setItem(marksGameKey, currentGameId)
  }, [killteamId, setLegionaryMarks])

  useEffect(() => {
    if (!killteamId || visibleUnits.length === 0) return

    setUnitStates((prev) => {
      let hasChanges = false
      const next = { ...prev }
      visibleUnits.forEach((unit) => {
        if (!next[unit.key]) {
          next[unit.key] = 'ready'
          hasChanges = true
        }
      })
      return hasChanges ? next : prev
    })

    setWoundsByUnit((prev) => {
      let hasChanges = false
      const next = { ...prev }
      visibleUnits.forEach((unit) => {
        const maxWounds = Number.parseInt(unit.opType.WOUNDS, 10)
        const safeMax = Number.isNaN(maxWounds) ? 0 : maxWounds
        if (next[unit.key] == null) {
          next[unit.key] = safeMax
          hasChanges = true
        } else if (next[unit.key] > safeMax) {
          next[unit.key] = safeMax
          hasChanges = true
        }
      })
      return hasChanges ? next : prev
    })

    setDetailsOpenByUnit((prev) => {
      let hasChanges = false
      const next = { ...prev }
      visibleUnits.forEach((unit) => {
        if (next[unit.key] == null) {
          next[unit.key] = false
          hasChanges = true
        }
      })
      return hasChanges ? next : prev
    })

    setStanceByUnit((prev) => {
      let hasChanges = false
      const next = { ...prev }
      visibleUnits.forEach((unit) => {
        if (!next[unit.key]) {
          next[unit.key] = 'conceal'
          hasChanges = true
        }
      })
      return hasChanges ? next : prev
    })

    setStatusesByUnit((prev) => {
      let hasChanges = false
      const next = { ...prev }
      visibleUnits.forEach((unit) => {
        if (!Array.isArray(next[unit.key])) {
          next[unit.key] = []
          hasChanges = true
        }
      })
      return hasChanges ? next : prev
    })

    setAplAdjustByUnit((prev) => {
      let hasChanges = false
      const next = { ...prev }
      visibleUnits.forEach((unit) => {
        if (next[unit.key] == null) {
          next[unit.key] = 0
          hasChanges = true
        }
      })
      return hasChanges ? next : prev
    })

    if (killteamId) {
      setLegionaryMarks(killteamId, (current) => {
        let hasChanges = false
        const next = { ...current }
        visibleUnits.forEach((unit) => {
          if (!isLegionaryUnit(unit.opType)) return
          if (!(unit.key in next)) {
            next[unit.key] = null
            hasChanges = true
          }
        })
        return hasChanges ? next : current
      })
    }
  }, [killteamId, visibleUnits])

  useEffect(() => {
    if (!storageKey || !hasHydratedRef.current) return
    const payload = {
      selectedUnits: selectedUnitKeys,
      selectedEquipment: selectedEquipmentKeys,
      unitStates,
      deadUnits,
      woundsByUnit,
      detailsOpenByUnit,
      stanceByUnit,
      statusesByUnit,
      aplAdjustByUnit,
      legionaryMarkByUnit,
    }
    localStorage.setItem(storageKey, JSON.stringify(payload))
  }, [
    storageKey,
    selectedUnitKeys,
    selectedEquipmentKeys,
    unitStates,
    deadUnits,
    woundsByUnit,
    detailsOpenByUnit,
    stanceByUnit,
    statusesByUnit,
    aplAdjustByUnit,
    legionaryMarkByUnit,
  ])

  useEffect(() => {
    const displayName = playerName || 'Player'
    syncStateRef.current = {
      name: displayName,
      killteamId,
      selectedUnits: selectedUnitKeys,
      selectedEquipment: selectedEquipmentKeys,
      unitStates,
      deadUnits,
      woundsByUnit,
      stanceByUnit,
      statusesByUnit,
      aplAdjustByUnit,
      legionaryMarkByUnit,
    }
  }, [
    playerName,
    killteamId,
    selectedUnitKeys,
    selectedEquipmentKeys,
    unitStates,
    deadUnits,
    woundsByUnit,
    stanceByUnit,
    statusesByUnit,
    aplAdjustByUnit,
    legionaryMarkByUnit,
  ])

  useEffect(() => {
    const displayName = playerName || 'Player'
    if (!roomCode || !displayName || !wsReady) return
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return

    const payload = {
      type: 'sync_state',
      code: roomCode,
      playerId,
      state: {
        name: displayName,
        killteamId,
        selectedUnits: selectedUnitKeys,
        selectedEquipment: selectedEquipmentKeys,
        unitStates,
        deadUnits,
        woundsByUnit,
        stanceByUnit,
        statusesByUnit,
        aplAdjustByUnit,
        legionaryMarkByUnit,
      },
    }

    const timeout = window.setTimeout(() => {
      socket.send(JSON.stringify(payload))
    }, 200)

    return () => window.clearTimeout(timeout)
  }, [
    roomCode,
    playerName,
    wsReady,
    killteamId,
    selectedUnitKeys,
    aplAdjustByUnit,
    legionaryMarkByUnit,
    selectedEquipmentKeys,
    unitStates,
    deadUnits,
    woundsByUnit,
    stanceByUnit,
    statusesByUnit,
  ])

  const orderedUnits = useMemo(() => {
    return [...visibleUnits].sort((a, b) => {
      const stateA = unitStates[a.key] ?? 'ready'
      const stateB = unitStates[b.key] ?? 'ready'
      const rankA = deadUnits[a.key]
        ? 2
        : stateA === 'expended'
          ? 1
          : 0
      const rankB = deadUnits[b.key]
        ? 2
        : stateB === 'expended'
          ? 1
          : 0
      if (rankA !== rankB) {
        return rankA - rankB
      }
      return a.index - b.index
    })
  }, [visibleUnits, unitStates, deadUnits])

  const cycleState = (key) => {
    setUnitStates((prev) => {
      const current = prev[key] ?? 'ready'
      const nextState =
        current === 'ready'
          ? 'active'
          : current === 'active'
            ? 'expended'
            : 'ready'
      return {
        ...prev,
        [key]: nextState,
      }
    })
  }

  const setDeadState = (key, isDead) => {
    setDeadUnits((prev) => ({
      ...prev,
      [key]: isDead,
    }))
  }

  const resetStates = () => {
    setUnitStates((prev) => {
      const next = { ...prev }
      visibleUnits.forEach((unit) => {
        next[unit.key] = 'ready'
      })
      return next
    })
  }

  return (
    <div className="app-shell">
      <header className="game-nav">
        <div className="game-nav-left">
          <div className="game-nav-menu">
            <button
              className="game-menu-button"
              type="button"
              aria-label="Open game menu"
              aria-expanded={menuOpen}
              aria-controls="game-menu-drawer"
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              <span className="game-menu-bar" />
              <span className="game-menu-bar" />
              <span className="game-menu-bar" />
            </button>
          </div>
          {timerStart ? (
            <div className="game-nav-timer">
              <span>{formatElapsed(timerNow - timerStart)}</span>
            </div>
          ) : null}
          {isMultiplayer ? (
            <button
              className="ghost-link opponent-toggle"
              type="button"
              onClick={() => {
                setOpponentDebug((prev) => ({
                  ...prev,
                  lastPanelOpenAt: Date.now(),
                }))
                setOpponentPanelOpen(true)
                requestOpponentState()
              }}
            >
              Opponent
            </button>
          ) : null}
        </div>
        <div className="game-nav-stats">
          <div className="game-nav-stat">
            <div className="game-nav-stat-controls">
              <span className="game-nav-stat-label">TP</span>
              <button
                type="button"
                className="game-nav-stat-button"
                onClick={() => setTpCount((prev) => Math.max(1, prev - 1))}
                aria-label="Decrease turning point"
              >
                −
              </button>
              <span className="game-nav-stat-value">{tpCount}</span>
              <button
                type="button"
                className="game-nav-stat-button"
                onClick={() => setTpCount((prev) => prev + 1)}
                aria-label="Increase turning point"
              >
                +
              </button>
            </div>
          </div>
          <div className="game-nav-stat">
            <div className="game-nav-stat-controls">
              <span className="game-nav-stat-label">CP</span>
              <button
                type="button"
                className="game-nav-stat-button"
                onClick={() => setCpCount((prev) => Math.max(0, prev - 1))}
                aria-label="Decrease command points"
              >
                −
              </button>
              <span className="game-nav-stat-value">{cpCount}</span>
              <button
                type="button"
                className="game-nav-stat-button"
                onClick={() => setCpCount((prev) => prev + 1)}
                aria-label="Increase command points"
              >
                +
              </button>
            </div>
          </div>
          <div className="game-nav-stat">
            <div className="game-nav-stat-controls">
              <span className="game-nav-stat-label">VP</span>
              <button
                type="button"
                className="game-nav-stat-button"
                onClick={() => setVpCount((prev) => Math.max(0, prev - 1))}
                aria-label="Decrease victory points"
              >
                −
              </button>
              <span className="game-nav-stat-value">{vpCount}</span>
              <button
                type="button"
                className="game-nav-stat-button"
                onClick={() => setVpCount((prev) => prev + 1)}
                aria-label="Increase victory points"
              >
                +
              </button>
            </div>
          </div>
          {SP_KILLTEAMS.has(killteamId) ? (
            <div className="game-nav-stat">
              <div className="game-nav-stat-controls">
                <span className="game-nav-stat-label">SP</span>
                <button
                  type="button"
                  className="game-nav-stat-button"
                  onClick={() => setSpCount((prev) => Math.max(0, prev - 1))}
                  aria-label="Decrease special points"
                >
                  −
                </button>
                <span className="game-nav-stat-value">{spCount}</span>
                <button
                  type="button"
                  className="game-nav-stat-button"
                  onClick={() => setSpCount((prev) => prev + 1)}
                  aria-label="Increase special points"
                >
                  +
                </button>
              </div>
            </div>
          ) : null}
        </div>
        <nav className="game-nav-links">
          <button className="ghost-link" type="button" onClick={resetStates}>
            Reset
          </button>
        </nav>
      </header>
      <div
        className={`game-menu-backdrop${menuOpen ? ' open' : ''}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden={!menuOpen}
      />
      <aside
        id="game-menu-drawer"
        className={`game-menu-drawer${menuOpen ? ' open' : ''}`}
        aria-hidden={!menuOpen}
      >
        <div className="game-menu-panel">
          <details className="game-menu-group">
            <summary className="game-menu-summary">Equipment</summary>
            <div className="game-menu-content">
              {selectedEquipment.length ? (
                <div className="game-menu-equipment">
                  {selectedEquipment.map((equipment) => {
                    const weaponRows = parseEquipmentWeaponEffects(
                      equipment.effects,
                    )
                    const descriptionText = weaponRows.length
                      ? stripEquipmentTable(equipment.description)
                      : equipment.description

                    return (
                      <details
                        className="game-menu-equipment-item"
                        key={equipment.eqId}
                      >
                        <summary className="game-menu-equipment-name">
                          {equipment.eqName}
                        </summary>
                        <div className="game-menu-equipment-rule">
                          {weaponRows.length ? (
                            <div className="game-weapon-table game-menu-weapon-table">
                              <div className="game-weapon-row game-weapon-header">
                                <span>NAME</span>
                                <span>ATK</span>
                                <span>HIT</span>
                                <span>DMG</span>
                                <span>WR</span>
                              </div>
                              {weaponRows.map((row) => (
                                <div className="game-weapon-row" key={row.key}>
                                  <span className="weapon-name">{row.name}</span>
                                  <span>{row.ATK}</span>
                                  <span>{row.HIT}</span>
                                  <span>{row.DMG}</span>
                                  <span className="weapon-rules">
                                    {parseRules(row.WR).map((rule, index) =>
                                      isRangeRule(rule) ? (
                                        <span
                                          className="weapon-rule"
                                          key={`${row.key}-rule-${index}`}
                                        >
                                          {rule}
                                        </span>
                                      ) : (
                                        <button
                                          key={`${row.key}-rule-${index}`}
                                          type="button"
                                          className="weapon-rule weapon-rule-button"
                                          onClick={() => setRuleModal(rule)}
                                        >
                                          {rule}
                                        </button>
                                      ),
                                    )}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : null}
                          {descriptionText ? (
                            <div className="game-menu-equipment-text">
                              {descriptionText.split('\n').map((line, lineIndex, lines) => (
                                <span key={`${equipment.eqId}-line-${lineIndex}`}>
                                  {renderRuleText(line, setRuleModal)}
                                  {lineIndex < lines.length - 1 ? <br /> : null}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </details>
                    )
                  })}
                </div>
              ) : (
                <div className="game-menu-empty">No equipment selected.</div>
              )}
            </div>
          </details>
          <details className="game-menu-group">
            <summary className="game-menu-summary">Tac Ops</summary>
            <div className="game-menu-content">Tac Ops panel</div>
          </details>
          <details className="game-menu-group">
            <summary className="game-menu-summary">Strat Ploys</summary>
            <div className="game-menu-content">
              {stratPloys.length ? (
                <div className="game-menu-ploys">
                  {stratPloys.map((ploy) => (
                    <details className="game-menu-ploy-item" key={ploy.ployId}>
                      <summary className="game-menu-ploy-name">
                        <span className="game-menu-ploy-title">
                          {ploy.ployName}
                        </span>
                        {formatCostLabel(ploy) ? (
                          <span className="cost-badge">
                            {formatCostLabel(ploy)}
                          </span>
                        ) : null}
                      </summary>
                      <div className="game-menu-ploy-description">
                        {String(ploy.description ?? '')
                          .split('\n')
                          .map((line, lineIndex, lines) => (
                            <span key={`${ploy.ployId}-line-${lineIndex}`}>
                              {renderRuleText(line, setRuleModal)}
                              {lineIndex < lines.length - 1 ? <br /> : null}
                            </span>
                          ))}
                      </div>
                    </details>
                  ))}
                </div>
              ) : (
                <div className="game-menu-empty">No strat ploys available.</div>
              )}
            </div>
          </details>
          <details className="game-menu-group">
            <summary className="game-menu-summary">Firefight Ploys</summary>
            <div className="game-menu-content">
              {firefightPloys.length ? (
                <div className="game-menu-ploys">
                  {firefightPloys.map((ploy) => (
                    <details className="game-menu-ploy-item" key={ploy.ployId}>
                      <summary className="game-menu-ploy-name">
                        <span className="game-menu-ploy-title">
                          {ploy.ployName}
                        </span>
                        {formatCostLabel(ploy) ? (
                          <span className="cost-badge">
                            {formatCostLabel(ploy)}
                          </span>
                        ) : null}
                      </summary>
                      <div className="game-menu-ploy-description">
                        {String(ploy.description ?? '')
                          .split('\n')
                          .map((line, lineIndex, lines) => (
                            <span key={`${ploy.ployId}-line-${lineIndex}`}>
                              {renderRuleText(line, setRuleModal)}
                              {lineIndex < lines.length - 1 ? <br /> : null}
                            </span>
                          ))}
                      </div>
                    </details>
                  ))}
                </div>
              ) : (
                <div className="game-menu-empty">No firefight ploys available.</div>
              )}
            </div>
          </details>
          <details className="game-menu-group">
            <summary className="game-menu-summary">Faction Rules</summary>
            <div className="game-menu-content">
              {factionRules.length ? (
                <div className="game-menu-ploys">
                  {factionRules.map((rule) => (
                    <details
                      className="game-menu-ploy-item"
                      key={rule.abilityId ?? rule.abilityName}
                    >
                      <summary className="game-menu-ploy-name">
                        <span className="game-menu-ploy-title">
                          {rule.abilityName}
                        </span>
                        {formatCostLabel(rule) ? (
                          <span className="cost-badge">
                            {formatCostLabel(rule)}
                          </span>
                        ) : null}
                      </summary>
                      <div className="game-menu-ploy-description">
                        {String(rule.description ?? '')
                          .split('\n')
                          .map((line, lineIndex, lines) => (
                            <span key={`${rule.abilityId ?? rule.abilityName}-line-${lineIndex}`}>
                              {renderRuleText(line, setRuleModal)}
                              {lineIndex < lines.length - 1 ? <br /> : null}
                            </span>
                          ))}
                      </div>
                    </details>
                  ))}
                </div>
              ) : (
                <div className="game-menu-empty">No faction rules available.</div>
              )}
            </div>
          </details>
        </div>
      </aside>
      {isMultiplayer ? (
        <OpponentPanel
          isOpen={opponentPanelOpen}
          onClose={() => setOpponentPanelOpen(false)}
          onRefresh={requestOpponentState}
          wsReady={wsReady}
          opponentRefreshAt={opponentRefreshAt}
          opponentRenderState={opponentRenderState}
          opponentKillteam={opponentKillteam}
          opponentAllUnits={opponentAllUnits}
          debugInfo={opponentDebug}
          roomCode={roomCode}
          playerId={playerId}
        />
      ) : null}
      <main className="app-content">
        <section className="page game-page">
          <div className="game-grid">
            {orderedUnits.length ? (
              orderedUnits.map(({ opType, instance, instanceCount, key }, index) => {
                const maxWounds = Number.parseInt(opType.WOUNDS, 10)
                const safeMax = Number.isNaN(maxWounds) ? 0 : maxWounds
                const currentWounds =
                  woundsByUnit[key] == null ? safeMax : woundsByUnit[key]
                const stance = stanceByUnit[key] ?? 'conceal'
                const selectedStatuses = statusesByUnit[key] ?? []
                const aplAdjustment = aplAdjustByUnit[key] ?? 0
                const isLegionary = isLegionaryUnit(opType)
                const legionaryMark = isLegionary
                  ? legionaryMarkByUnit[key] ?? null
                  : null
                const rowStart = index - (index % 2)
                const rowUnits = orderedUnits.slice(rowStart, rowStart + 2)

                return (
                  <UnitCard
                    key={key}
                    opType={opType}
                    instance={instance}
                    instanceCount={instanceCount}
                    currentWounds={currentWounds}
                    detailsOpen={detailsOpenByUnit[key] ?? false}
                    state={unitStates[key] ?? 'ready'}
                    onCycleState={() => cycleState(key)}
                    onDeadChange={(isDead) => setDeadState(key, isDead)}
                    onToggleDetails={() => {
                      const nextOpen = !(detailsOpenByUnit[key] ?? false)
                      setDetailsOpenByUnit((prev) => {
                        const next = { ...prev }
                        rowUnits.forEach((unit) => {
                          if (unit?.key) {
                            next[unit.key] = nextOpen
                          }
                        })
                        return next
                      })
                    }}
                    onWoundsChange={(nextWounds) =>
                      setWoundsByUnit((prev) => ({
                        ...prev,
                        [key]: nextWounds,
                      }))
                    }
                    aplAdjustment={aplAdjustment}
                    onAplAdjustChange={(nextValue) =>
                      setAplAdjustByUnit((prev) => ({
                        ...prev,
                        [key]: nextValue,
                      }))
                    }
                    legionaryMark={legionaryMark}
                    onLegionaryMarkChange={
                      isLegionary
                        ? (nextValue) =>
                            setLegionaryMarks(killteamId, (prev) => ({
                              ...prev,
                              [key]: nextValue,
                            }))
                        : undefined
                    }
                    stance={stance}
                    onStanceChange={(nextStance) =>
                      setStanceByUnit((prev) => ({
                        ...prev,
                        [key]: nextStance,
                      }))
                    }
                    selectedStatuses={selectedStatuses}
                    onStatusChange={(nextStatuses) =>
                      setStatusesByUnit((prev) => ({
                        ...prev,
                        [key]: nextStatuses,
                      }))
                    }
                  />
                )
              })
             ) : (
               <div className="empty-state">
                 No units selected yet. Choose units to start the game.
               </div>
             )}
           </div>
         </section>
       </main>
      {ruleModal ? (
        <div className="rule-modal" role="dialog" aria-modal="true">
          <div
            className="rule-modal-backdrop"
            onClick={() => setRuleModal(null)}
          />
          <div className="rule-modal-content">
            <div className="rule-modal-header">
              <h3>{ruleDetails?.name ?? ruleModal}</h3>
              <button
                type="button"
                className="rule-modal-close"
                onClick={() => setRuleModal(null)}
              >
                Close
              </button>
            </div>
            <div className="rule-modal-body">
              {ruleDetails?.description ? (
                ruleDetails.description
              ) : (
                <>
                  <p>Rule details were not found in the data.</p>
                  {ruleSuggestions.length ? (
                    <div className="rule-modal-suggestions">
                      <div className="rule-modal-suggestions-title">
                        Possible matches
                      </div>
                      <ul>
                        {ruleSuggestions.map((name) => (
                          <li key={name}>{name}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
     </div>
   )
}

export default Game
