import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
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

const addWeaponRule = (wrValue, ruleLabel) => {
  if (!ruleLabel) return wrValue
  if (!wrValue || wrValue === '—') return ruleLabel
  const rules = wrValue
    .split(',')
    .map((rule) => rule.trim())
    .filter(Boolean)
  if (rules.some((rule) => rule.toLowerCase() === ruleLabel.toLowerCase())) {
    return wrValue
  }
  return `${wrValue}, ${ruleLabel}`
}

const formatCostLabel = (item) => {
  if (!item) return null
  if (item.AP != null) return `${item.AP}AP`
  if (item.CP != null) return `${item.CP}CP`
  return null
}

const isLegionaryUnit = (opType) =>
  /\bLEGIONARY\b/i.test(opType?.keywords ?? '')

const isPlasmaKnifeWeapon = (weapon) =>
  /plasma\s*knife/i.test(String(weapon?.wepName ?? ''))

const isFistsWeapon = (weapon) =>
  /^fists$/i.test(String(weapon?.wepName ?? '').trim())

const HERNKYN_BOLT_SHELL_IDS = new Set(['VOT-HKY-FSBS', 'VOT-HKY-SBS'])
const HERNKYN_KV_UNDERSUIT_IDS = new Set(['VOT-HKY-KVCU'])

const isHernkynBoltShellEquipment = (equipment) =>
  HERNKYN_BOLT_SHELL_IDS.has(String(equipment?.eqId ?? '')) ||
  /bolt\s*shell/i.test(String(equipment?.eqName ?? ''))

const isHernkynKvUndersuitEquipment = (equipment) =>
  HERNKYN_KV_UNDERSUIT_IDS.has(String(equipment?.eqId ?? '')) ||
  /kv[\s-]*ceramide\s*undersuit/i.test(String(equipment?.eqName ?? ''))

const unitHasBoltShotgun = (unit) =>
  (unit?.opType?.weapons ?? []).some((weapon) =>
    /bolt\s*shotgun/i.test(String(weapon?.wepName ?? '')),
  )

const KOMMANDO_EXCLUDED_OP_IDS = new Set(['ORK-KOM-GROT', 'ORK-KOM-SQUIG'])
const KOMMANDO_CHOPPAS_IDS = new Set(['ORK-KOM-CHP'])
const KOMMANDO_COLLAPSIBLE_STOCKS_IDS = new Set(['ORK-KOM-CS'])
const KOMMANDO_DYNAMITE_IDS = new Set(['ORK-KOM-DYN'])
const KOMMANDO_HARPOON_IDS = new Set(['ORK-KOM-HRP'])

const isKommandoExcludedUnit = (unit) =>
  KOMMANDO_EXCLUDED_OP_IDS.has(String(unit?.opType?.opTypeId ?? ''))

const unitHasSluggaOrShokka = (unit) =>
  (unit?.opType?.weapons ?? []).some((weapon) =>
    /slugga|shokka/i.test(String(weapon?.wepName ?? '')),
  )

const isKommandoChoppasEquipment = (equipment) =>
  KOMMANDO_CHOPPAS_IDS.has(String(equipment?.eqId ?? ''))

const isKommandoCollapsibleStocksEquipment = (equipment) =>
  KOMMANDO_COLLAPSIBLE_STOCKS_IDS.has(String(equipment?.eqId ?? ''))

const isKommandoDynamiteEquipment = (equipment) =>
  KOMMANDO_DYNAMITE_IDS.has(String(equipment?.eqId ?? ''))

const isKommandoHarpoonEquipment = (equipment) =>
  KOMMANDO_HARPOON_IDS.has(String(equipment?.eqId ?? ''))

const buildKommandoAssignedEquipmentForUnit = ({ unit, selectedEquipment }) => {
  if (isKommandoExcludedUnit(unit)) return []
  return (selectedEquipment ?? []).filter((equipment) => {
    if (isKommandoChoppasEquipment(equipment)) return false
    if (isKommandoDynamiteEquipment(equipment)) return true
    if (isKommandoHarpoonEquipment(equipment)) return true
    if (isKommandoCollapsibleStocksEquipment(equipment)) {
      return unitHasSluggaOrShokka(unit)
    }
    return false
  })
}

const buildAssignedEquipmentForUnit = ({ unit, selectedEquipment, killteamId }) => {
  if (killteamId === 'VOT-HKY') {
    const hasBoltShotgun = unitHasBoltShotgun(unit)
    return (selectedEquipment ?? []).filter((equipment) => {
      if (isHernkynKvUndersuitEquipment(equipment)) return true
      if (isHernkynBoltShellEquipment(equipment)) return hasBoltShotgun
      return false
    })
  }

  if (killteamId === 'ORK-KOM') {
    return buildKommandoAssignedEquipmentForUnit({
      unit,
      selectedEquipment,
    })
  }

  return []
}

const buildEquipmentWeapon = (equipment, weaponEffect) => {
  const normalizedName = String(weaponEffect.name ?? 'weapon')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const wepId = `${equipment.eqId}-${normalizedName || 'weapon'}`
  return {
    wepId,
    wepName: weaponEffect.name || 'Plasma Knife',
    wepType: weaponEffect.range || 'M',
    profiles: [
      {
        wepprofileId: `${wepId}-0`,
        wepId,
        ATK: weaponEffect.ATK,
        HIT: weaponEffect.HIT,
        DMG: weaponEffect.DMG,
        WR: weaponEffect.WR,
      },
    ],
  }
}

const applyYaegirPlasmaKnifeEquipment = (weapons, equipmentWeapon) => {
  if (!equipmentWeapon) return weapons
  const sourceWeapons = Array.isArray(weapons) ? weapons : []
  const hasPlasmaKnife = sourceWeapons.some((weapon) => isPlasmaKnifeWeapon(weapon))

  if (hasPlasmaKnife) {
    return sourceWeapons.map((weapon) => {
      if (!isPlasmaKnifeWeapon(weapon)) return weapon
      const profiles = (weapon.profiles ?? []).map((profile) => ({
        ...profile,
        WR: addWeaponRule(profile.WR, 'Balanced'),
      }))
      return {
        ...weapon,
        profiles,
      }
    })
  }

  const fistsIndex = sourceWeapons.findIndex((weapon) => isFistsWeapon(weapon))
  if (fistsIndex >= 0) {
    return sourceWeapons.map((weapon, index) =>
      index === fistsIndex ? equipmentWeapon : weapon,
    )
  }

  return [...sourceWeapons, equipmentWeapon]
}

const applyKommandoChoppasEquipment = (weapons, equipmentWeapon) => {
  if (!equipmentWeapon) return weapons
  const sourceWeapons = Array.isArray(weapons) ? weapons : []
  return sourceWeapons.map((weapon) =>
    isFistsWeapon(weapon)
      ? {
          ...equipmentWeapon,
          wepId: `${equipmentWeapon.wepId}-${weapon.wepId ?? 'fists'}`,
          profiles: (equipmentWeapon.profiles ?? []).map((profile, profileIndex) => ({
            ...profile,
            wepprofileId: `${equipmentWeapon.wepId}-${weapon.wepId ?? 'fists'}-${profileIndex}`,
          })),
        }
      : weapon,
  )
}

const isKommandoCollapsibleStocksWeapon = (weapon) =>
  /slugga|shokka/i.test(String(weapon?.wepName ?? ''))

const removeRangeWeaponRule = (wrValue) => {
  if (!wrValue || wrValue === '—') return wrValue
  const remainingRules = String(wrValue)
    .split(',')
    .map((rule) => rule.trim())
    .filter((rule) => rule && !/^(rng|range)\b/i.test(rule))
  return remainingRules.length ? remainingRules.join(', ') : '—'
}

const applyKommandoCollapsibleStocksEquipment = (weapons, isSelected) => {
  if (!isSelected) return weapons
  const sourceWeapons = Array.isArray(weapons) ? weapons : []
  return sourceWeapons.map((weapon) => {
    if (!isKommandoCollapsibleStocksWeapon(weapon)) return weapon
    return {
      ...weapon,
      profiles: (weapon.profiles ?? []).map((profile) => ({
        ...profile,
        WR: removeRangeWeaponRule(profile.WR),
      })),
    }
  })
}

function Game() {
  const navigate = useNavigate()
  const { killteamId } = useParams()
  const {
    selectedUnitsByTeam,
    selectedEquipmentByTeam,
    selectedWeaponsByTeam,
    selectedTacOpsByTeam,
    selectedPrimaryOpsByTeam,
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
  const [collapseSignal, setCollapseSignal] = useState(0)
  const [gameId, setGameId] = useState('')
  const [timerStart, setTimerStart] = useState(null)
  const [timerNow, setTimerNow] = useState(Date.now())
  const [menuOpen, setMenuOpen] = useState(false)
  const [ruleModal, setRuleModal] = useState(null)
  const [isTacOpRevealed, setIsTacOpRevealed] = useState(false)
  const [tpCount, setTpCount] = useState(1)
  const [cpCount, setCpCount] = useState(2)
  const [vpCount, setVpCount] = useState(0)
  const [spCount, setSpCount] = useState(0)
  const [stratOpsModalOpen, setStratOpsModalOpen] = useState(true)
  const [stratOpsByTp, setStratOpsByTp] = useState({})
  const [initiativeByTp, setInitiativeByTp] = useState({})
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
    () => {
      if (!roomCode || !playerId) return null
      const activeGameId = gameId || localStorage.getItem('kt-game-id') || ''
      return activeGameId
        ? `kt-opponent-${roomCode}-${playerId}-${activeGameId}`
        : `kt-opponent-${roomCode}-${playerId}`
    },
    [roomCode, playerId, gameId],
  )
  const selectedTacOp = killteamId ? selectedTacOpsByTeam[killteamId] : null
  const selectedPrimaryOp = killteamId
    ? selectedPrimaryOpsByTeam[killteamId]
    : null
  const ruleDetails = useMemo(
    () => (ruleModal ? getRuleDescription(ruleModal) : null),
    [ruleModal],
  )
  const ruleSuggestions = useMemo(
    () => (ruleModal && !ruleDetails ? getRuleSuggestions(ruleModal, 3) : []),
    [ruleModal, ruleDetails],
  )
  const menuDrawerRef = useRef(null)

  useEffect(() => {
    if (!killteamId) return
    try {
      localStorage.setItem('kt-last-killteam', killteamId)
    } catch (error) {
      console.warn('Failed to store last killteam.', error)
    }
  }, [killteamId])

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
  useEffect(() => {
    if (menuOpen || !menuDrawerRef.current) return
    menuDrawerRef.current
      .querySelectorAll('details[open]')
      .forEach((element) => {
        element.open = false
      })
  }, [menuOpen])

  const isRangeRule = (rule) => /^(Rng|Range)\b/i.test(rule)

  const renderRuleText = (text, onRuleClick) =>
    tokenizeWeaponRuleText(text).map((token, tokenIndex) =>
      token.type === 'rule' && !isRangeRule(token.value) ? (
        <button
          key={`rule-token-${tokenIndex}`}
          type="button"
          className="weapon-rule weapon-rule-button"
          onClick={(event) => {
            event.stopPropagation()
            onRuleClick(token.ruleName)
          }}
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
  const storageKey = useMemo(() => {
    if (!killteamId) return null
    return gameId ? `kt-game-${killteamId}-${gameId}` : `kt-game-${killteamId}`
  }, [killteamId, gameId])
  const tacOpRevealStorageKey = useMemo(() => {
    if (!killteamId) return null
    return gameId
      ? `kt-tac-op-revealed-${killteamId}-${gameId}`
      : `kt-tac-op-revealed-${killteamId}`
  }, [killteamId, gameId])

  useEffect(() => {
    if (!killteamId) return
    try {
      const storedGameId = localStorage.getItem('kt-game-id') || ''
      setGameId(storedGameId)
    } catch (error) {
      console.warn('Failed to read game id.', error)
      setGameId('')
    }
  }, [killteamId])

  useEffect(() => {
    if (!tacOpRevealStorageKey) {
      setIsTacOpRevealed(false)
      return
    }
    try {
      const stored = localStorage.getItem(tacOpRevealStorageKey)
      setIsTacOpRevealed(stored === '1')
    } catch (error) {
      console.warn('Failed to read tac op reveal state.', error)
      setIsTacOpRevealed(false)
    }
  }, [tacOpRevealStorageKey])

  useEffect(() => {
    if (!killteamId || !gameId) return
    const resetKey = `kt-game-last-${killteamId}`
    const lastGameId = localStorage.getItem(resetKey) || ''
    if (lastGameId === gameId) return
    setUnitStates({})
    setDeadUnits({})
    setWoundsByUnit({})
    setDetailsOpenByUnit({})
    setStanceByUnit({})
    setStatusesByUnit({})
    setAplAdjustByUnit({})
    setTpCount(1)
    setCpCount(2)
    setVpCount(0)
    setSpCount(0)
    setStratOpsByTp({})
    setInitiativeByTp({})
    setIsTacOpRevealed(false)
    setMenuOpen(false)
    setOpponentPanelOpen(false)
    setLegionaryMarks(killteamId, {})
    if (storageKey) {
      localStorage.removeItem(storageKey)
    }
    localStorage.removeItem(`kt-strat-ploys-active-${killteamId}`)
    const stratPloyPrefix = `kt-strat-ploys-active-${killteamId}-`
    const stratPloyKeysToRemove = []
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (key && key.startsWith(stratPloyPrefix)) {
        stratPloyKeysToRemove.push(key)
      }
    }
    stratPloyKeysToRemove.forEach((key) => localStorage.removeItem(key))
    localStorage.removeItem('kt-drop-zone')
    localStorage.removeItem('kt-drop-zone-opponent')
    window.dispatchEvent(new CustomEvent('kt-dropzone-update'))
    window.dispatchEvent(new CustomEvent('kt-strat-ploys-update'))
    hasHydratedRef.current = false
    hydratedKillteamRef.current = null
    localStorage.setItem(resetKey, gameId)
  }, [killteamId, gameId, setLegionaryMarks, storageKey])

  useEffect(() => {
    if (!tacOpRevealStorageKey) return
    try {
      localStorage.setItem(tacOpRevealStorageKey, isTacOpRevealed ? '1' : '0')
      if (roomCode && playerId) {
        const payload = JSON.stringify({
          selectedTacOp,
          revealed: isTacOpRevealed,
        })
        const baseKey = `kt-room-player-tac-op-${roomCode}-${playerId}`
        localStorage.setItem(baseKey, payload)
        const activeGameId = gameId || localStorage.getItem('kt-game-id') || ''
        if (activeGameId) {
          localStorage.setItem(`${baseKey}-${activeGameId}`, payload)
        }
      }
      window.dispatchEvent(new CustomEvent('kt-tacop-reveal-update'))
    } catch (error) {
      console.warn('Failed to persist tac op reveal state.', error)
    }
  }, [
    tacOpRevealStorageKey,
    isTacOpRevealed,
    roomCode,
    playerId,
    selectedTacOp,
    gameId,
  ])

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
    if (!roomCode || !playerId || !killteamId) return
    try {
      const activeGameId = gameId || localStorage.getItem('kt-game-id') || ''
      if (activeGameId) {
        localStorage.setItem(
          `kt-room-player-killteam-${roomCode}-${playerId}-${activeGameId}`,
          killteamId,
        )
      }
      localStorage.setItem(
        `kt-room-player-killteam-${roomCode}-${playerId}`,
        killteamId,
      )
      if (playerName) {
        localStorage.setItem(
          `kt-room-player-name-${roomCode}-${playerId}`,
          playerName,
        )
      }
    } catch (error) {
      console.warn('Failed to persist room player killteam.', error)
    }
  }, [roomCode, playerId, killteamId, playerName, gameId])

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
  const selectedWeaponsByUnit = selectedWeaponsByTeam[killteamId] ?? {}
  const selectedUnits = new Set(selectedUnitKeys)
  const selectedEquipmentIds = new Set(selectedEquipmentKeys)
  const selectedEquipment = useMemo(
    () =>
      (killteam.equipments ?? []).filter((equipment) =>
        selectedEquipmentIds.has(equipment.eqId),
      ),
    [killteam, selectedEquipmentIds],
  )
  const yaegirPlasmaKnifeEquipmentWeapon = useMemo(() => {
    if (killteamId !== 'VOT-HKY') return null
    for (const equipment of selectedEquipment) {
      const weaponRows = parseEquipmentWeaponEffects(equipment.effects)
      const plasmaKnifeRow = weaponRows.find((row) =>
        /plasma\s*knife/i.test(String(row.name ?? '')),
      )
      if (!plasmaKnifeRow) continue
      return buildEquipmentWeapon(equipment, plasmaKnifeRow)
    }
    return null
  }, [killteamId, selectedEquipment])
  const kommandoChoppasEquipmentWeapon = useMemo(() => {
    if (killteamId !== 'ORK-KOM') return null
    const choppasEquipment = selectedEquipment.find(
      (equipment) => String(equipment.eqId ?? '') === 'ORK-KOM-CHP',
    )
    if (!choppasEquipment) return null
    const weaponRows = parseEquipmentWeaponEffects(choppasEquipment.effects)
    const choppaRow = weaponRows.find((row) => /choppa/i.test(String(row.name ?? '')))
    if (!choppaRow) return null
    return buildEquipmentWeapon(choppasEquipment, choppaRow)
  }, [killteamId, selectedEquipment])
  const isKommandoCollapsibleStocksSelected = useMemo(() => {
    if (killteamId !== 'ORK-KOM') return false
    return selectedEquipment.some((equipment) =>
      isKommandoCollapsibleStocksEquipment(equipment),
    )
  }, [killteamId, selectedEquipment])
  const getStratOpsForTp = (tp, teamId) =>
    stratOpsByTp[tp]?.[teamId] ?? []
  const ploys = killteam.ploys ?? []
  const stratPloys = ploys.filter((ploy) => ploy.ployType === 'S')
  const firefightPloys = ploys.filter(
    (ploy) => ploy.ployType === 'T' || ploy.ployType === 'F',
  )
  const activeStratPloys = useMemo(() => {
    if (!killteamId) return []
    const selectedIds = getStratOpsForTp(tpCount, killteamId)
    return stratPloys
      .filter((ploy) => selectedIds.includes(ploy.ployId))
      .map((ploy) => ({
        id: ploy.ployId,
        name: ploy.ployName,
        cost: formatCostLabel(ploy),
        description: String(ploy.description ?? ''),
      }))
  }, [killteamId, tpCount, stratPloys, stratOpsByTp])
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
    .map((unit) => {
      const selection = selectedWeaponsByUnit[unit.key]
      const selectedSet = Array.isArray(selection) ? new Set(selection) : null
      const baseWeapons = selectedSet
        ? (unit.opType.weapons ?? []).filter(
            (weapon, weaponIndex) =>
              selectedSet.has(
                weapon.wepId ?? `${weapon.wepName ?? 'weapon'}-${weaponIndex}`,
              ),
          )
        : (unit.opType.weapons ?? [])
      const equipmentAdjustedWeapons =
        killteamId === 'VOT-HKY'
          ? applyYaegirPlasmaKnifeEquipment(
              baseWeapons,
              yaegirPlasmaKnifeEquipmentWeapon,
            )
          : killteamId === 'ORK-KOM'
            ? applyKommandoCollapsibleStocksEquipment(
                applyKommandoChoppasEquipment(
                  baseWeapons,
                  kommandoChoppasEquipmentWeapon,
                ),
                isKommandoCollapsibleStocksSelected,
              )
            : baseWeapons
      return {
        ...unit,
        opType: {
          ...unit.opType,
          weapons: equipmentAdjustedWeapons,
        },
        assignedEquipment: buildAssignedEquipmentForUnit({
          unit,
          selectedEquipment,
          killteamId,
        }),
      }
    })
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
      if (parsed.tpCount != null) {
        setTpCount(Math.max(1, Number(parsed.tpCount) || 1))
      }
      if (parsed.cpCount != null) {
        setCpCount(Math.max(0, Number(parsed.cpCount) || 0))
      }
      setInitiativeByTp(parsed.initiativeByTp ?? {})
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
      tpCount,
      cpCount,
      initiativeByTp,
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
    tpCount,
    cpCount,
    initiativeByTp,
    legionaryMarkByUnit,
  ])

  useEffect(() => {
    const displayName = playerName || 'Player'
    syncStateRef.current = {
      name: displayName,
      playerId,
      killteamId,
      selectedTacOp,
      tacOpRevealed: isTacOpRevealed,
      selectedUnits: selectedUnitKeys,
      selectedEquipment: selectedEquipmentKeys,
      activeStratPloys,
      tpCount,
      cpCount,
      initiativeByTp,
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
    playerId,
    killteamId,
    selectedTacOp,
    isTacOpRevealed,
    selectedUnitKeys,
    selectedEquipmentKeys,
    activeStratPloys,
    tpCount,
    cpCount,
    initiativeByTp,
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
        playerId,
        killteamId,
        selectedTacOp,
        tacOpRevealed: isTacOpRevealed,
        selectedUnits: selectedUnitKeys,
        selectedEquipment: selectedEquipmentKeys,
        activeStratPloys,
        tpCount,
        cpCount,
        initiativeByTp,
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
    playerId,
    killteamId,
    selectedTacOp,
    isTacOpRevealed,
    selectedUnitKeys,
    aplAdjustByUnit,
    legionaryMarkByUnit,
    selectedEquipmentKeys,
    activeStratPloys,
    tpCount,
    cpCount,
    initiativeByTp,
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

  const handleNextTp = () => {
    resetStates()
    setDetailsOpenByUnit({})
    setRuleModal(null)
    setCollapseSignal((prev) => prev + 1)
    if (menuDrawerRef.current) {
      menuDrawerRef.current
        .querySelectorAll('details[open]')
        .forEach((element) => {
          element.open = false
        })
    }
    setMenuOpen(false)
    setTpCount((prev) => prev + 1)
  }

  const toggleStratOp = (tp, teamId, ployId) => {
    if (!teamId) return
    const isAlreadySelected = getStratOpsForTp(tp, teamId).includes(ployId)
    if (!isAlreadySelected && cpCount <= 0) return

    setStratOpsByTp((prev) => {
      const tpEntry = prev[tp] ?? {}
      const current = tpEntry[teamId] ?? []
      const next = current.includes(ployId)
        ? current.filter((id) => id !== ployId)
        : [...current, ployId]
      return {
        ...prev,
        [tp]: {
          ...tpEntry,
          [teamId]: next,
        },
      }
    })

    setCpCount((prevCp) =>
      isAlreadySelected ? prevCp + 1 : Math.max(0, prevCp - 1),
    )
  }

  const prevTpRef = useRef(tpCount)
  const initModalRef = useRef(false)
  useEffect(() => {
    if (!initModalRef.current) {
      initModalRef.current = true
      setStratOpsModalOpen(true)
      prevTpRef.current = tpCount
      return
    }
    if (tpCount > prevTpRef.current) {
      setStratOpsModalOpen(true)
      setCpCount((prev) => prev + 1)
    }
    prevTpRef.current = tpCount
  }, [tpCount])

  const hasInitiative = Boolean(initiativeByTp[tpCount])
  const initiativeBonusEnabled = tpCount > 1

  const toggleInitiative = () => {
    if (!initiativeBonusEnabled) return
    const currentlyChecked = Boolean(initiativeByTp[tpCount])

    setInitiativeByTp((prev) => ({
      ...prev,
      [tpCount]: !currentlyChecked,
    }))

    setCpCount((prev) =>
      currentlyChecked ? Math.max(0, prev - 1) : prev + 1,
    )
  }

  useEffect(() => {
    if (!killteamId) return
    try {
      const activeGameId = gameId || localStorage.getItem('kt-game-id') || ''
      const payload = JSON.stringify({ tp: tpCount, ploys: activeStratPloys })
      localStorage.setItem(`kt-strat-ploys-active-${killteamId}`, payload)
      if (activeGameId) {
        localStorage.setItem(
          `kt-strat-ploys-active-${killteamId}-${activeGameId}`,
          payload,
        )
      }
      if (roomCode && playerId) {
        const roomKey = `kt-room-player-strat-ploys-${roomCode}-${playerId}`
        localStorage.setItem(roomKey, JSON.stringify(activeStratPloys))
        if (activeGameId) {
          const roomGameKey = `${roomKey}-${activeGameId}`
          localStorage.setItem(roomGameKey, JSON.stringify(activeStratPloys))
        }
      }
      window.dispatchEvent(new CustomEvent('kt-strat-ploys-update'))
    } catch (error) {
      console.warn('Failed to store strat ploys selection.', error)
    }
  }, [killteamId, tpCount, activeStratPloys, roomCode, playerId, gameId])

  const handleNextAction = () => {
    if (tpCount >= 4) {
      navigate('/game-end')
      return
    }
    handleNextTp()
  }

  const closeMenu = () => {
    if (menuDrawerRef.current) {
      menuDrawerRef.current
        .querySelectorAll('details[open]')
        .forEach((element) => {
          element.open = false
        })
    }
    setMenuOpen(false)
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
          <button
            className="ghost-link"
            type="button"
            onClick={handleNextAction}
          >
            {tpCount >= 4 ? 'END GAME' : 'Next TP'}
          </button>
        </nav>
      </header>
      <div
        className={`game-menu-backdrop${menuOpen ? ' open' : ''}`}
        onClick={closeMenu}
        aria-hidden={!menuOpen}
      />
      <aside
        id="game-menu-drawer"
        className={`game-menu-drawer${menuOpen ? ' open' : ''}`}
        aria-hidden={!menuOpen}
        ref={menuDrawerRef}
      >
        <button
          className="game-menu-close"
          type="button"
          aria-label="Close game menu"
          onClick={closeMenu}
        >
          ×
        </button>
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
            <summary className="game-menu-summary">Tac Op / Primary Op</summary>
            <div className="game-menu-content">
              {selectedTacOp?.src ? (
                <div className="game-menu-tacop-actions">
                  <button
                    type="button"
                    className="game-menu-tacop-toggle"
                    onClick={() => setIsTacOpRevealed((prev) => !prev)}
                  >
                    {isTacOpRevealed ? 'Hide Tac Op' : 'Reveal Tac Op'}
                  </button>
                </div>
              ) : null}
              {selectedTacOp?.src || selectedPrimaryOp?.src ? (
                <div className="game-menu-tacop-grid">
                  {selectedTacOp?.src ? (
                    <div className="game-menu-tacop">
                      <img
                        src={selectedTacOp.src}
                        alt={selectedTacOp.label || 'Selected Tac Op'}
                        loading="lazy"
                      />
                    </div>
                  ) : null}
                  {selectedPrimaryOp?.src ? (
                    <div className="game-menu-tacop">
                      <img
                        src={selectedPrimaryOp.src}
                        alt={selectedPrimaryOp.label || 'Selected Primary Op'}
                        loading="lazy"
                      />
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="game-menu-empty">
                  No Tac Op or Primary Op selected yet.
                </div>
              )}
            </div>
          </details>
          <details className="game-menu-group">
            <summary className="game-menu-summary">Strat Ploys</summary>
            <div className="game-menu-content">
              {stratPloys.length ? (
                <div className="game-menu-ploys">
                  {stratPloys.map((ploy) => (
                    <details
                      className={`game-menu-ploy-item${
                        getStratOpsForTp(tpCount, killteamId).includes(ploy.ployId)
                          ? ' is-selected'
                          : ''
                      }`}
                      key={ploy.ployId}
                    >
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
      {stratOpsModalOpen ? (
        <div className="game-stratops-backdrop">
          <div className="game-stratops-modal">
            <div className="game-stratops-header">
              <h2>Turning Point {tpCount}: Strat Ops</h2>
              <div className="game-stratops-header-actions">
                <div className="game-nav-stat-controls game-stratops-cp-controls">
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
                <label className="game-stratops-initiative">
                  <input
                    type="checkbox"
                    checked={hasInitiative}
                    disabled={!initiativeBonusEnabled}
                    onChange={toggleInitiative}
                  />
                  <span>Initiative {initiativeBonusEnabled ? '(+1 CP)' : '(TP2+)'}</span>
                </label>
                <button
                  type="button"
                  className="game-stratops-close"
                  onClick={() => setStratOpsModalOpen(false)}
                >
                  Start TP
                </button>
              </div>
            </div>
            <div className="game-stratops-columns">
              <section className="game-stratops-column">
                <h3>{killteam?.killteamName || 'Team A'}</h3>
                <div className="game-stratops-list">
                  {stratPloys.length ? (
                    stratPloys.map((ploy) => {
                      const isSelected = getStratOpsForTp(tpCount, killteamId).includes(
                        ploy.ployId,
                      )
                      const isUnavailable = !isSelected && cpCount <= 0

                      return (
                      <div
                        key={ploy.ployId}
                        role="button"
                        tabIndex={0}
                        className={`game-stratops-item${
                          isSelected ? ' is-selected' : ''
                        }${
                          isUnavailable ? ' is-unavailable' : ''
                        }`}
                        onClick={() => {
                          if (isUnavailable) return
                          toggleStratOp(tpCount, killteamId, ploy.ployId)
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            if (isUnavailable) return
                            toggleStratOp(tpCount, killteamId, ploy.ployId)
                          }
                        }}
                      >
                        <div className="game-stratops-item-header">
                          <span className="game-stratops-item-title">
                            {ploy.ployName}
                          </span>
                          {formatCostLabel(ploy) ? (
                            <span className="cost-badge">{formatCostLabel(ploy)}</span>
                          ) : null}
                        </div>
                        <div className="game-stratops-item-body">
                          {String(ploy.description ?? '')
                            .split('\n')
                            .map((line, lineIndex, lines) => (
                              <span key={`${ploy.ployId}-modal-${lineIndex}`}>
                                {renderRuleText(line, setRuleModal)}
                                {lineIndex < lines.length - 1 ? <br /> : null}
                              </span>
                            ))}
                        </div>
                      </div>
                    )})
                  ) : (
                    <div className="game-stratops-empty">No strat ploys.</div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}
      <main className="app-content">
        <section className="page game-page">
          <div className="game-grid">
            {orderedUnits.length ? (
              orderedUnits.map(({ opType, instance, instanceCount, key, assignedEquipment }, index) => {
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
                    assignedEquipment={assignedEquipment ?? []}
                    onStanceChange={(nextStance) =>
                      setStanceByUnit((prev) => ({
                        ...prev,
                        [key]: nextStance,
                      }))
                    }
                    selectedStatuses={selectedStatuses}
                    collapseSignal={collapseSignal}
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
