import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import mapsData from '../data/killzoneMaps.json'
import { getKillteamById } from '../data/ktData.js'
import terrainData from '../data/terrain.json'
import terrainPiecesData from '../data/terrainPieces.json'
import critOpsCardsData from '../data/critOpsCards.json'
import CritOpsCard from '../components/CritOpsCard'
import KillOp from '../components/KillOp'
import BoardSide from '../components/BoardSide'
import SightLine from '../components/SightLine'
import MovementMeasure from '../components/MovementMeasure'
import FieldOfVision from '../components/FieldOfVision'
import { resolveWsUrl } from '../state/wsUrl.js'
import { takeSharedMapSocket } from '../state/mapSocketBridge.js'
import { deriveDeadCount, deriveKillOpCount } from '../state/killOpCounts.js'
import './Board.css'

const HIDDEN_TAC_OP_SRC = '/images/tacOps/hidden-tac-op.png'
const OBJECTIVE_MARKER_RADIUS_IN = 20 / 25.4
const MAP_SOCKET_STALE_RESYNC_MS = 10000
const WS_STATE_LABELS = {
  0: 'CONNECTING',
  1: 'OPEN',
  2: 'CLOSING',
  3: 'CLOSED',
}
const MAP_RULE_ENTRIES = [
  {
    title: 'Vantage',
    bullets: [
      'VANTAGE 2" grants ACCURATE 1 when shooting against operatives with an Engage order.',
      'VANTAGE 4" grants ACCURATE 2 when shooting against operatives with an Engage order.',
      'Can target Concealed operatives in Light Cover (they still get cover saves).',
      'If the target is Concealed and in Cover, they may retain their cover save as a Critical Save, or retain 2 normal saves.',
    ],
  },
  {
    title: 'Obscured',
    bullets: [
      'An operative is obscured if there is intervening HEAVY terrain outside the target’s control range (1").',
      'The attacker must discard one success instead of retaining it.',
      'The attacker’s critical successes are retained as normal successes.',
    ],
  },
  {
    title: 'Assisted',
    bullets: [
      'For each additional friendly operative within control range of the target, improve HIT by 1.',
      'This only applies if that friendly operative is not within control range of another enemy.',
    ],
  },
  {
    title: 'Cover',
    bullets: [
      'In cover if terrain is within control range (1").',
      'Effect: +1 Cover Save.',
      'Not in cover if an enemy is within 2".',
      'Not in cover if, from the attacker’s perspective, a valid sightline can be drawn without crossing intervening terrain.',
    ],
  },
  {
    title: 'Condensed Stronghold',
    bullets: [
      'Applies to weapons with BLAST, TORRENT, and DEVASTATING X".',
      'The target must be in Stronghold terrain (A/B).',
      'The target must be on the killzone floor.',
      'Effect: the weapon gains LETHAL 5+.',
    ],
  },
  {
    title: 'Garrisoned Stronghold',
    bullets: [
      'The retaliating operative must be in a stronghold.',
      'The opposing operative must not be in a stronghold.',
      'Effect: the defender resolves attack dice first.',
    ],
  },
  {
    title: 'Door Fight',
    bullets: [
      'COST: 1AP.',
      'Action type: Fight action.',
      'Must be in contact with a door.',
      'Select a target within 2" of the door and on the other side.',
      'Treat operatives as within control range for the duration of the action.',
      'Cannot perform this action if within control range of an enemy operative.',
    ],
  },
]

function Board({
  dropZoneSelectionEnabled = false,
  onDropZoneSelect = null,
  selectedDropZone = null,
}) {
  const WS_URL = resolveWsUrl()
  const maps = mapsData?.maps ?? []
  const [selectedMapId, setSelectedMapId] = useState(maps[0]?.id || '')
  const activeMap = useMemo(
    () => maps.find((map) => map.id === selectedMapId) || maps[0],
    [maps, selectedMapId],
  )
  const board = mapsData?.meta?.board || { width: 30, height: 22 }
  const grid = mapsData?.renderDefaults?.grid || { enabled: false, cell: 1 }
  const arrangements = terrainData?.arrangements ?? []
  const terrainPieces = terrainPiecesData?.pieces ?? []
  const objectiveDefaultRadius =
    terrainData?.meta?.objective?.defaultRadius ?? 0.5
  const mapArrangements = useMemo(
    () => arrangements.filter((arr) => arr.mapId === activeMap?.id),
    [arrangements, activeMap?.id],
  )
  const critOpsCards = critOpsCardsData?.cards ?? []
  const [arrangementIndex, setArrangementIndex] = useState(0)
  const activeArrangement = mapArrangements[arrangementIndex] || null
  const hasRandomizedMapRef = useRef(false)
  const boardSurfaceRef = useRef(null)
  const boardFrameRef = useRef(null)
  const boardOverlayRef = useRef(null)
  const [toolMode, setToolMode] = useState('none')
  const [showMapTooltips, setShowMapTooltips] = useState(true)
  const [currentRuleIndex, setCurrentRuleIndex] = useState(0)
  const [selectedCardIndex, setSelectedCardIndex] = useState(0)
  const shouldRotateZones = activeMap?.id === 'map_02'
  const sourceWidth = shouldRotateZones ? board.height : board.width
  const sourceHeight = shouldRotateZones ? board.width : board.height
  const textureByMapIdRef = useRef(new Map())
  const [textureVersion, setTextureVersion] = useState(0)
  const boardTextureRef = useRef(null)
  const boardWindRef = useRef(null)
  const boardFogRef = useRef(null)
  const [showTextureWatermark, setShowTextureWatermark] = useState(false)
  const [toolWatermark, setToolWatermark] = useState('')
  const [storedDropZone, setStoredDropZone] = useState('')
  const [storedOpponentDropZone, setStoredOpponentDropZone] = useState('')
  const [playerStratPloys, setPlayerStratPloys] = useState([])
  const [opponentStratPloys, setOpponentStratPloys] = useState([])
  const [playerKillOpCount, setPlayerKillOpCount] = useState(null)
  const [opponentKillOpCount, setOpponentKillOpCount] = useState(null)
  const [playerDeadCount, setPlayerDeadCount] = useState(0)
  const [opponentDeadCount, setOpponentDeadCount] = useState(0)
  const [playerName, setPlayerName] = useState('Player')
  const [opponentName, setOpponentName] = useState('Opponent')
  const [playerArmyName, setPlayerArmyName] = useState('')
  const [opponentArmyName, setOpponentArmyName] = useState('')
  const [playerAssignedZone, setPlayerAssignedZone] = useState('')
  const [opponentAssignedZone, setOpponentAssignedZone] = useState('')
  const [playerTacOpCard, setPlayerTacOpCard] = useState(null)
  const [opponentTacOpCard, setOpponentTacOpCard] = useState(null)
  const [playerTacOpRevealed, setPlayerTacOpRevealed] = useState(false)
  const [opponentTacOpRevealed, setOpponentTacOpRevealed] = useState(false)
  const [syncDebug, setSyncDebug] = useState({
    enabled: false,
    roomCode: '',
    playerId: '',
    playerName: '',
    activeGameId: '',
    isMapUser: false,
    players: [],
    nonMapCount: 0,
    hostId: '',
    teamIds: {},
    assignedZones: {
      player: '',
      opponent: '',
    },
    storedZones: {
      player: '',
      opponent: '',
    },
    ploysByPlayerId: {},
    opponentCache: false,
    mapSocketState: 'n/a',
    mapSocketEpoch: 0,
    mapSocketLastType: '',
    mapSocketMessageCount: 0,
    mapSocketOpenedAt: 0,
    mapSocketClosedAt: 0,
    mapSocketLastAt: 0,
    mapSocketSyncInitAt: 0,
    mapSocketLastOutboundType: '',
    mapSocketOutboundCount: 0,
    mapSocketLastOutboundAt: 0,
    mapSocketRoomNotFoundCount: 0,
    mapSocketLastInstanceId: '',
    mapSocketErrorInstanceId: '',
    mapSocketBoundRoom: '',
    mapSocketBoundPlayerId: '',
    mapSocketError: '',
    updatedAt: 0,
  })
  const [syncDebugCopied, setSyncDebugCopied] = useState(false)
  const mapSocketRef = useRef(null)
  const [mapSocketEpoch, setMapSocketEpoch] = useState(0)
  const mapSyncPlayerName =
    sessionStorage.getItem('kt-player-name') ||
    localStorage.getItem('kt-player-name') ||
    ''
  const mapSyncRoomCode =
    sessionStorage.getItem('kt-room-code') ||
    localStorage.getItem('kt-room-code') ||
    ''
  const mapSyncPlayerId =
    sessionStorage.getItem('kt-player-id') ||
    localStorage.getItem('kt-player-id') ||
    ''
  const isMapSyncIdentity = mapSyncPlayerName.trim().toUpperCase() === 'MAP'
  const textureStyles = useMemo(
    () => [
      {
        label: 'Sand + Wind',
        base: '#3a2f1e',
        accent: 'rgba(230, 200, 150, 0.35)',
        noiseAlpha: 0.32,
        mode: 'wind',
        sand: true,
      },
      {
        label: 'City Rain',
        base: '#14181c',
        accent: 'rgba(120, 150, 170, 0.18)',
        noiseAlpha: 0.16,
        mode: 'rain',
      },
      {
        label: 'Foggy Compound',
        base: '#0f1310',
        accent: 'rgba(120, 150, 140, 0.1)',
        noiseAlpha: 0.22,
        mode: 'pulse',
        grass: true,
      },
    ],
    [],
  )
  const terrainPieceById = useMemo(
    () => new Map(terrainPieces.map((piece) => [piece.id, piece])),
    [terrainPieces],
  )

  const toPercent = (value, max) => `${(value / max) * 100}%`

  const totalRules = MAP_RULE_ENTRIES.length
  const currentRule = MAP_RULE_ENTRIES[currentRuleIndex] || MAP_RULE_ENTRIES[0]
  const previousRuleIndex =
    (currentRuleIndex - 1 + totalRules) % totalRules
  const nextRuleIndex = (currentRuleIndex + 1) % totalRules
  const previousRuleTitle = MAP_RULE_ENTRIES[previousRuleIndex]?.title || ''
  const nextRuleTitle = MAP_RULE_ENTRIES[nextRuleIndex]?.title || ''

  const goToPreviousRule = () => {
    setCurrentRuleIndex((prev) => (prev - 1 + totalRules) % totalRules)
  }

  const goToNextRule = () => {
    setCurrentRuleIndex((prev) => (prev + 1) % totalRules)
  }

  useEffect(() => {
    const readDropZone = () => {
      const stored = localStorage.getItem('kt-drop-zone') || ''
      setStoredDropZone((previous) => stored || previous)
      const opponentStored = localStorage.getItem('kt-drop-zone-opponent') || ''
      setStoredOpponentDropZone((previous) => opponentStored || previous)
    }
    readDropZone()
    const handleDropZoneUpdate = () => readDropZone()
    window.addEventListener('kt-dropzone-update', handleDropZoneUpdate)
    window.addEventListener('storage', handleDropZoneUpdate)
    return () => {
      window.removeEventListener('kt-dropzone-update', handleDropZoneUpdate)
      window.removeEventListener('storage', handleDropZoneUpdate)
    }
  }, [])

  useEffect(() => {
    const readSyncDebug = () => {
      try {
        const params = new URLSearchParams(window.location.search)
        const enabled =
          params.get('syncDebug') === '1' ||
          localStorage.getItem('kt-sync-debug') === '1'
        if (!enabled) {
          setSyncDebug((previous) => ({ ...previous, enabled: false }))
          return
        }
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
        const activeGameId = localStorage.getItem('kt-game-id') || ''
        const roomPlayersRaw = roomCode
          ? localStorage.getItem(`kt-room-players-${roomCode}`)
          : ''
        const roomPlayersParsed = roomPlayersRaw ? JSON.parse(roomPlayersRaw) : []
        const players = Array.isArray(roomPlayersParsed)
          ? roomPlayersParsed
              .filter((player) => player?.id)
              .map((player) => ({
                id: String(player.id),
                name: String(player.name || ''),
              }))
          : []
        const nonMapCount = players.filter(
          (player) => String(player?.name || '').trim().toUpperCase() !== 'MAP',
        ).length
        const teamIds = {}
        const ploysByPlayerId = {}
        players.forEach((player) => {
          const id = String(player.id || '').trim()
          if (!id) return
          teamIds[id] =
            (activeGameId &&
              localStorage.getItem(
                `kt-room-player-killteam-${roomCode}-${id}-${activeGameId}`,
              )) ||
            localStorage.getItem(`kt-room-player-killteam-${roomCode}-${id}`) ||
            ''
          const ploysRaw =
            (activeGameId &&
              localStorage.getItem(
                `kt-room-player-strat-ploys-${roomCode}-${id}-${activeGameId}`,
              )) ||
            localStorage.getItem(`kt-room-player-strat-ploys-${roomCode}-${id}`) ||
            '[]'
          const parsedPloys = JSON.parse(ploysRaw)
          ploysByPlayerId[id] = Array.isArray(parsedPloys) ? parsedPloys.length : 0
        })
        const assignmentsKey = roomCode
          ? `kt-drop-zone-assignments-${roomCode}`
          : 'kt-drop-zone-assignments'
        const assignmentsRaw = roomCode
          ? (activeGameId && localStorage.getItem(`${assignmentsKey}-${activeGameId}`)) ||
            localStorage.getItem(assignmentsKey)
          : localStorage.getItem(assignmentsKey)
        const assignments = assignmentsRaw ? JSON.parse(assignmentsRaw) : {}
        const playerAssignments =
          assignments?.playerAssignments &&
          typeof assignments.playerAssignments === 'object'
            ? assignments.playerAssignments
            : {}
        const opponentCache = Boolean(
          roomCode &&
            playerId &&
            localStorage.getItem(`kt-opponent-${roomCode}-${playerId}`),
        )
        const mapSocketErrorKey = roomCode ? `kt-map-socket-error-${roomCode}` : ''
        const mapSocketLastTypeKey = roomCode
          ? `kt-map-socket-last-type-${roomCode}`
          : ''
        const mapSocketMessageCountKey = roomCode
          ? `kt-map-socket-message-count-${roomCode}`
          : ''
        const mapSocketOpenedAtKey = roomCode
          ? `kt-map-socket-opened-at-${roomCode}`
          : ''
        const mapSocketClosedAtKey = roomCode
          ? `kt-map-socket-closed-at-${roomCode}`
          : ''
        const mapSocketLastAtKey = roomCode
          ? `kt-map-socket-last-at-${roomCode}`
          : ''
        const mapSocketSyncInitAtKey = roomCode
          ? `kt-map-socket-sync-init-at-${roomCode}`
          : ''
        const mapSocketLastOutboundTypeKey = roomCode
          ? `kt-map-socket-last-outbound-type-${roomCode}`
          : ''
        const mapSocketOutboundCountKey = roomCode
          ? `kt-map-socket-outbound-count-${roomCode}`
          : ''
        const mapSocketLastOutboundAtKey = roomCode
          ? `kt-map-socket-last-outbound-at-${roomCode}`
          : ''
        const mapSocketRoomNotFoundCountKey = roomCode
          ? `kt-map-socket-room-not-found-count-${roomCode}`
          : ''
        const mapSocketLastInstanceIdKey = roomCode
          ? `kt-map-socket-last-instance-id-${roomCode}`
          : ''
        const mapSocketErrorInstanceIdKey = roomCode
          ? `kt-map-socket-error-instance-id-${roomCode}`
          : ''
        let mapSocketError = mapSocketErrorKey
          ? localStorage.getItem(mapSocketErrorKey) || ''
          : ''
        if (
          roomCode &&
          nonMapCount > 0 &&
          mapSocketError === 'Map-only room payload rejected.'
        ) {
          localStorage.removeItem(mapSocketErrorKey)
          localStorage.removeItem('kt-map-socket-error')
          mapSocketError = ''
        }
        setSyncDebug({
          enabled: true,
          roomCode,
          playerId,
          playerName,
          activeGameId,
          isMapUser: playerName.trim().toUpperCase() === 'MAP',
          players,
          nonMapCount,
          hostId: roomCode ? localStorage.getItem(`kt-room-host-${roomCode}`) || '' : '',
          teamIds,
          assignedZones: {
            player:
              (playerAssignments.A === playerId && 'A') ||
              (playerAssignments.B === playerId && 'B') ||
              '',
            opponent:
              (playerAssignments.A && playerAssignments.A !== playerId && 'A') ||
              (playerAssignments.B && playerAssignments.B !== playerId && 'B') ||
              '',
          },
          storedZones: {
            player: localStorage.getItem('kt-drop-zone') || '',
            opponent: localStorage.getItem('kt-drop-zone-opponent') || '',
          },
          ploysByPlayerId,
          opponentCache,
          mapSocketState:
            mapSocketRef.current && mapSocketRef.current.readyState in WS_STATE_LABELS
              ? WS_STATE_LABELS[mapSocketRef.current.readyState]
              : 'n/a',
          mapSocketEpoch,
          mapSocketLastType: mapSocketLastTypeKey
            ? localStorage.getItem(mapSocketLastTypeKey) || ''
            : '',
          mapSocketMessageCount: Number(
            mapSocketMessageCountKey
              ? localStorage.getItem(mapSocketMessageCountKey) || '0'
              : '0',
          ),
          mapSocketOpenedAt: Number(
            mapSocketOpenedAtKey
              ? localStorage.getItem(mapSocketOpenedAtKey) || '0'
              : '0',
          ),
          mapSocketClosedAt: Number(
            mapSocketClosedAtKey
              ? localStorage.getItem(mapSocketClosedAtKey) || '0'
              : '0',
          ),
          mapSocketLastAt: Number(
            mapSocketLastAtKey
              ? localStorage.getItem(mapSocketLastAtKey) || '0'
              : '0',
          ),
          mapSocketSyncInitAt: Number(
            mapSocketSyncInitAtKey
              ? localStorage.getItem(mapSocketSyncInitAtKey) || '0'
              : '0',
          ),
          mapSocketLastOutboundType: mapSocketLastOutboundTypeKey
            ? localStorage.getItem(mapSocketLastOutboundTypeKey) || ''
            : '',
          mapSocketOutboundCount: Number(
            mapSocketOutboundCountKey
              ? localStorage.getItem(mapSocketOutboundCountKey) || '0'
              : '0',
          ),
          mapSocketLastOutboundAt: Number(
            mapSocketLastOutboundAtKey
              ? localStorage.getItem(mapSocketLastOutboundAtKey) || '0'
              : '0',
          ),
          mapSocketRoomNotFoundCount: Number(
            mapSocketRoomNotFoundCountKey
              ? localStorage.getItem(mapSocketRoomNotFoundCountKey) || '0'
              : '0',
          ),
          mapSocketLastInstanceId: mapSocketLastInstanceIdKey
            ? localStorage.getItem(mapSocketLastInstanceIdKey) || ''
            : '',
          mapSocketErrorInstanceId: mapSocketErrorInstanceIdKey
            ? localStorage.getItem(mapSocketErrorInstanceIdKey) || ''
            : '',
          mapSocketBoundRoom:
            String(mapSocketRef.current?.ktRoomCode || '').trim() || '',
          mapSocketBoundPlayerId:
            String(mapSocketRef.current?.ktPlayerId || '').trim() || '',
          mapSocketError,
          updatedAt: Date.now(),
        })
      } catch (error) {
        console.warn('Failed to read board sync debug data.', error)
      }
    }

    readSyncDebug()
    const interval = window.setInterval(readSyncDebug, 1000)
    window.addEventListener('storage', readSyncDebug)
    window.addEventListener('kt-strat-ploys-update', readSyncDebug)
    window.addEventListener('kt-killop-update', readSyncDebug)
    window.addEventListener('kt-dropzone-update', readSyncDebug)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('storage', readSyncDebug)
      window.removeEventListener('kt-strat-ploys-update', readSyncDebug)
      window.removeEventListener('kt-killop-update', readSyncDebug)
      window.removeEventListener('kt-dropzone-update', readSyncDebug)
    }
  }, [mapSocketEpoch])

  useEffect(() => {
    const readNames = () => {
      const storedPlayerName =
        sessionStorage.getItem('kt-player-name') ||
        localStorage.getItem('kt-player-name') ||
        ''
      const roomCode =
        sessionStorage.getItem('kt-room-code') ||
        localStorage.getItem('kt-room-code') ||
        ''
      const activeGameId = localStorage.getItem('kt-game-id') || ''
      const playerId =
        sessionStorage.getItem('kt-player-id') ||
        localStorage.getItem('kt-player-id') ||
        ''
      const normalizedPlayerName = storedPlayerName.trim()
      const isMapUser = normalizedPlayerName.toUpperCase() === 'MAP'
      let roomPlayers = []
      if (roomCode) {
        try {
          const storedPlayers = localStorage.getItem(
            `kt-room-players-${roomCode}`,
          )
          roomPlayers = storedPlayers ? JSON.parse(storedPlayers) : []
        } catch (error) {
          console.warn('Failed to read room players.', error)
        }
      }
      const nonMapPlayers = roomPlayers.filter(
        (player) => String(player?.name || '').trim().toUpperCase() !== 'MAP',
      )
      const resolvedPlayerId =
        playerId ||
        nonMapPlayers.find(
          (player) =>
            String(player?.name || '').trim() === normalizedPlayerName,
        )?.id ||
        ''
      const getArmyNameForPlayer = (id) => {
        if (!roomCode || !id) return ''
        const teamId =
          (activeGameId &&
            localStorage.getItem(
              `kt-room-player-killteam-${roomCode}-${id}-${activeGameId}`,
            )) ||
          localStorage.getItem(`kt-room-player-killteam-${roomCode}-${id}`)
        const team = teamId ? getKillteamById(teamId) : null
        return team?.killteamName || ''
      }
      if (isMapUser && nonMapPlayers.length) {
        const assignmentsKey = roomCode
          ? `kt-drop-zone-assignments-${roomCode}`
          : 'kt-drop-zone-assignments'
        const assignmentsStored = roomCode
          ? (activeGameId &&
              localStorage.getItem(`${assignmentsKey}-${activeGameId}`)) ||
            localStorage.getItem(assignmentsKey)
          : localStorage.getItem(assignmentsKey)
        const assignments = assignmentsStored ? JSON.parse(assignmentsStored) : null
        const playerAssignments =
          assignments?.playerAssignments &&
          typeof assignments.playerAssignments === 'object'
            ? assignments.playerAssignments
            : {}
        const zoneAPlayer = nonMapPlayers.find(
          (player) => player?.id && player.id === playerAssignments.A,
        )
        const zoneBPlayer = nonMapPlayers.find(
          (player) => player?.id && player.id === playerAssignments.B,
        )
        const primaryPlayer = zoneBPlayer || nonMapPlayers[0] || null
        const secondaryPlayer =
          zoneAPlayer ||
          nonMapPlayers.find((player) => player?.id && player.id !== primaryPlayer?.id) ||
          null
        const primaryName = primaryPlayer?.name || ''
        const secondaryName = secondaryPlayer?.name || ''
        if (primaryName) setPlayerName(primaryName)
        if (secondaryName) setOpponentName(secondaryName)
        const primaryArmy = getArmyNameForPlayer(primaryPlayer?.id)
        const secondaryArmy = getArmyNameForPlayer(secondaryPlayer?.id)
        if (primaryArmy) setPlayerArmyName(primaryArmy)
        if (secondaryArmy) setOpponentArmyName(secondaryArmy)
        if (primaryPlayer?.id && secondaryPlayer?.id) {
          setPlayerAssignedZone(
            playerAssignments.B === primaryPlayer.id ? 'B' : 'A',
          )
          setOpponentAssignedZone(
            playerAssignments.A === secondaryPlayer.id ? 'A' : 'B',
          )
        }
      } else {
        if (normalizedPlayerName) setPlayerName(normalizedPlayerName)
        if (roomCode && resolvedPlayerId) {
          const playerArmy = getArmyNameForPlayer(resolvedPlayerId)
          if (playerArmy) setPlayerArmyName(playerArmy)
        }
      }
      if (!roomCode || !resolvedPlayerId) {
        if (!isMapUser && nonMapPlayers.length) {
          const fallbackOpponent = nonMapPlayers.find(
            (player) => player?.name && player.name !== normalizedPlayerName,
          )
          if (fallbackOpponent?.name) setOpponentName(fallbackOpponent.name)
          const fallbackArmy = getArmyNameForPlayer(fallbackOpponent?.id)
          if (fallbackArmy) setOpponentArmyName(fallbackArmy)
        }
        return
      }
      const opponentStored = localStorage.getItem(
        `kt-opponent-${roomCode}-${resolvedPlayerId}`,
      )
      if (!opponentStored) {
        if (!isMapUser && nonMapPlayers.length) {
          const fallbackOpponent = nonMapPlayers.find(
            (player) => player?.name && player.name !== normalizedPlayerName,
          )
          if (fallbackOpponent?.name) setOpponentName(fallbackOpponent.name)
          const fallbackArmy = getArmyNameForPlayer(fallbackOpponent?.id)
          if (fallbackArmy) setOpponentArmyName(fallbackArmy)
        }
        return
      }
      try {
        const opponentParsed = JSON.parse(opponentStored)
        const incomingName = opponentParsed?.state?.name || ''
        if (incomingName) setOpponentName(incomingName)
        if (opponentParsed?.state?.killteamId) {
          const opponentTeam = getKillteamById(opponentParsed.state.killteamId)
          const opponentArmy = opponentTeam?.killteamName || ''
          if (opponentArmy) setOpponentArmyName(opponentArmy)
        }
      } catch (error) {
        console.warn('Failed to read opponent name.', error)
        if (!isMapUser && nonMapPlayers.length) {
          const fallbackOpponent = nonMapPlayers.find(
            (player) => player?.name && player.name !== normalizedPlayerName,
          )
          if (fallbackOpponent?.name) setOpponentName(fallbackOpponent.name)
          const fallbackArmy = getArmyNameForPlayer(fallbackOpponent?.id)
          if (fallbackArmy) setOpponentArmyName(fallbackArmy)
        }
      }
    }
    readNames()
    const handleNameUpdate = () => readNames()
    window.addEventListener('storage', handleNameUpdate)
    const interval = window.setInterval(readNames, 1200)
    return () => {
      window.removeEventListener('storage', handleNameUpdate)
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    const storedPlayerName = mapSyncPlayerName
    const isMapUser = isMapSyncIdentity
    const roomCode = mapSyncRoomCode
    const playerId = mapSyncPlayerId
    if (!isMapUser || !roomCode || !playerId) return undefined
    const existingSocket = mapSocketRef.current
    if (existingSocket) {
      const existingRoomCode = String(existingSocket.ktRoomCode || '').trim()
      const existingPlayerId = String(existingSocket.ktPlayerId || '').trim()
      const sameIdentity =
        existingRoomCode === roomCode &&
        existingPlayerId === playerId &&
        existingSocket.readyState !== WebSocket.CLOSED
      if (sameIdentity) return undefined
      try {
        existingSocket.close()
      } catch {
        // noop
      }
      mapSocketRef.current = null
    }

    const mapSocketErrorKey = `kt-map-socket-error-${roomCode}`
    const mapSocketLastTypeKey = `kt-map-socket-last-type-${roomCode}`
    const mapSocketMessageCountKey = `kt-map-socket-message-count-${roomCode}`
    const mapSocketOpenedAtKey = `kt-map-socket-opened-at-${roomCode}`
    const mapSocketClosedAtKey = `kt-map-socket-closed-at-${roomCode}`
    const mapSocketLastAtKey = `kt-map-socket-last-at-${roomCode}`
    const mapSocketSyncInitAtKey = `kt-map-socket-sync-init-at-${roomCode}`
    const mapSocketLastOutboundTypeKey =
      `kt-map-socket-last-outbound-type-${roomCode}`
    const mapSocketOutboundCountKey = `kt-map-socket-outbound-count-${roomCode}`
    const mapSocketLastOutboundAtKey = `kt-map-socket-last-outbound-at-${roomCode}`
    const mapSocketRoomNotFoundCountKey =
      `kt-map-socket-room-not-found-count-${roomCode}`
    const mapSocketLastInstanceIdKey =
      `kt-map-socket-last-instance-id-${roomCode}`
    const mapSocketErrorInstanceIdKey =
      `kt-map-socket-error-instance-id-${roomCode}`
    let reconnectTimer = null
    let isCleaningUp = false

    let socket = takeSharedMapSocket()
    if (socket) {
      const sharedRoomCode = String(socket.ktRoomCode || '').trim()
      const sharedPlayerId = String(socket.ktPlayerId || '').trim()
      const hasSameIdentity =
        sharedRoomCode === roomCode &&
        sharedPlayerId === playerId
      const isReusable =
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      if (!hasSameIdentity || !isReusable) {
        try {
          socket.close()
        } catch {
          // noop
        }
        socket = null
      }
    }
    if (!socket) {
      socket = new WebSocket(WS_URL)
      socket.ktRoomCode = roomCode
      socket.ktPlayerId = playerId
    }
    socket.ktRoomCode = roomCode
    socket.ktPlayerId = playerId
    mapSocketRef.current = socket

    const clearStaleMapRoom = (code) => {
      if (!code) return
      try {
        localStorage.removeItem(`kt-map-socket-error-${code}`)
        localStorage.removeItem('kt-map-socket-error')
        localStorage.removeItem(`kt-map-socket-last-type-${code}`)
        localStorage.removeItem(`kt-map-socket-message-count-${code}`)
        localStorage.removeItem(`kt-map-socket-opened-at-${code}`)
        localStorage.removeItem(`kt-map-socket-closed-at-${code}`)
        localStorage.removeItem(`kt-map-socket-last-at-${code}`)
        localStorage.removeItem(`kt-map-socket-sync-init-at-${code}`)
        localStorage.removeItem(`kt-map-socket-last-outbound-type-${code}`)
        localStorage.removeItem(`kt-map-socket-outbound-count-${code}`)
        localStorage.removeItem(`kt-map-socket-last-outbound-at-${code}`)
        localStorage.removeItem(`kt-map-socket-room-not-found-count-${code}`)
        localStorage.removeItem(`kt-map-socket-last-instance-id-${code}`)
        localStorage.removeItem(`kt-map-socket-error-instance-id-${code}`)
        localStorage.removeItem(`kt-room-players-${code}`)
        localStorage.removeItem(`kt-room-host-${code}`)
        localStorage.removeItem(`kt-drop-zone-assignments-${code}`)
        const keysToRemove = []
        for (let index = 0; index < localStorage.length; index += 1) {
          const key = localStorage.key(index)
          if (!key) continue
          if (
            key.startsWith(`kt-room-player-killteam-${code}-`) ||
            key.startsWith(`kt-room-player-strat-ploys-${code}-`) ||
            key.startsWith(`kt-room-player-selected-units-${code}-`) ||
            key.startsWith(`kt-room-player-dead-units-${code}-`) ||
            key.startsWith(`kt-room-player-tac-op-${code}-`) ||
            key.startsWith(`kt-opponent-${code}-`) ||
            key.startsWith(`kt-drop-zone-assignments-${code}-`)
          ) {
            keysToRemove.push(key)
          }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key))
      } catch (error) {
        console.warn('Failed to clear stale map room data.', error)
      }
    }

    const stampSocketMeta = (key, value) => {
      try {
        localStorage.setItem(key, String(value))
      } catch {
        // noop
      }
    }

    const markSocketMessage = (type) => {
      const now = Date.now()
      stampSocketMeta(mapSocketLastAtKey, now)
      if (type) stampSocketMeta(mapSocketLastTypeKey, type)
      let currentCount = 0
      try {
        currentCount = Number(localStorage.getItem(mapSocketMessageCountKey) || '0')
      } catch {
        currentCount = 0
      }
      stampSocketMeta(mapSocketMessageCountKey, currentCount + 1)
    }

    const sendSocketMessage = (type, payload) => {
      if (socket.readyState !== WebSocket.OPEN) return false
      stampSocketMeta(mapSocketLastOutboundTypeKey, type || 'unknown')
      stampSocketMeta(mapSocketLastOutboundAtKey, Date.now())
      let outboundCount = 0
      try {
        outboundCount = Number(localStorage.getItem(mapSocketOutboundCountKey) || '0')
      } catch {
        outboundCount = 0
      }
      stampSocketMeta(mapSocketOutboundCountKey, outboundCount + 1)
      socket.send(JSON.stringify(payload))
      return true
    }

    const sendSyncInit = () => {
      if (socket.readyState !== WebSocket.OPEN) return
      stampSocketMeta(mapSocketSyncInitAtKey, Date.now())
      sendSocketMessage('sync_init', {
        type: 'sync_init',
        code: roomCode,
        name: storedPlayerName || 'MAP',
        playerId,
        isMap: true,
      })
    }

    const maybeSendStaleResync = () => {
      const now = Date.now()
      let lastInboundAt = 0
      let lastSyncInitAt = 0
      try {
        lastInboundAt = Number(localStorage.getItem(mapSocketLastAtKey) || '0')
        lastSyncInitAt = Number(localStorage.getItem(mapSocketSyncInitAtKey) || '0')
      } catch {
        lastInboundAt = 0
        lastSyncInitAt = 0
      }
      const inboundIsStale = !lastInboundAt || now - lastInboundAt > MAP_SOCKET_STALE_RESYNC_MS
      const syncInitIsOld = !lastSyncInitAt || now - lastSyncInitAt > MAP_SOCKET_STALE_RESYNC_MS
      if (inboundIsStale && syncInitIsOld) {
        sendSyncInit()
        return true
      }
      return false
    }

    const requestAllPlayerStates = (players = []) => {
      if (socket.readyState !== WebSocket.OPEN) return
      const targets = (players || []).filter((candidate) => {
        const candidateId = String(candidate?.id || '').trim()
        const candidateName = String(candidate?.name || '').trim().toUpperCase()
        return candidateId && candidateId !== playerId && candidateName !== 'MAP'
      })
      targets.forEach((candidate) => {
        sendSocketMessage('request_player_state', {
          type: 'request_player_state',
          code: roomCode,
          requesterId: playerId,
          targetPlayerId: candidate.id,
        })
      })
    }

    const resolveEffectiveHostId = (hostId, players = []) => {
      const normalizedPlayers = Array.isArray(players) ? players : []
      const incomingHostId = String(hostId || '').trim()
      const incomingHost = normalizedPlayers.find(
        (player) => String(player?.id || '').trim() === incomingHostId,
      )
      const incomingHostName = String(incomingHost?.name || '').trim().toUpperCase()
      if (incomingHostId && incomingHostName !== 'MAP') {
        return incomingHostId
      }
      const fallback = normalizedPlayers.find(
        (player) => String(player?.name || '').trim().toUpperCase() !== 'MAP',
      )
      return String(fallback?.id || '').trim()
    }

    const handleMessage = (event) => {
      const message = JSON.parse(event.data)
      const incomingInstanceId = String(message?.instanceId || '').trim()
      if (incomingInstanceId) {
        stampSocketMeta(mapSocketLastInstanceIdKey, incomingInstanceId)
      }
      markSocketMessage(message?.type || 'unknown')
      const clearMapSocketError = () => {
        try {
          localStorage.removeItem(mapSocketErrorKey)
          localStorage.removeItem('kt-map-socket-error')
        } catch {
          // noop
        }
      }
      if (message.type === 'error') {
        try {
          const errorMessage = String(message.message || 'Unknown map socket error')
          localStorage.setItem(mapSocketErrorKey, errorMessage)
          if (incomingInstanceId) {
            localStorage.setItem(mapSocketErrorInstanceIdKey, incomingInstanceId)
          }
          if (errorMessage === 'Room not found.') {
            const roomPlayersRaw =
              localStorage.getItem(`kt-room-players-${roomCode}`) || '[]'
            const roomPlayers = JSON.parse(roomPlayersRaw)
            const nonMapCount = Array.isArray(roomPlayers)
              ? roomPlayers.filter(
                  (player) =>
                    String(player?.name || '').trim().toUpperCase() !== 'MAP',
                ).length
              : 0
            const roomNotFoundCount =
              Number(localStorage.getItem(mapSocketRoomNotFoundCountKey) || '0') + 1
            localStorage.setItem(
              mapSocketRoomNotFoundCountKey,
              String(roomNotFoundCount),
            )
            if (roomNotFoundCount >= 2 && nonMapCount > 0) {
              try {
                socket.close()
              } catch {
                // noop
              }
            }
            if (roomNotFoundCount >= 3 && nonMapCount === 0) {
              clearStaleMapRoom(roomCode)
            }
          }
        } catch {
          // noop
        }
        return
      }
      if (message.type === 'room_update') {
        try {
          if (Array.isArray(message.players)) {
            const nonMapCount = message.players.filter(
              (player) =>
                String(player?.name || '').trim().toUpperCase() !== 'MAP',
            ).length
            if (nonMapCount === 0) {
              localStorage.setItem(
                mapSocketErrorKey,
                'Map-only room payload rejected.',
              )
              return
            }
            clearMapSocketError()
            localStorage.removeItem(mapSocketRoomNotFoundCountKey)
            localStorage.setItem(
              `kt-room-players-${roomCode}`,
              JSON.stringify(message.players),
            )
            requestAllPlayerStates(message.players)
          }
          const effectiveHostId = resolveEffectiveHostId(
            message.hostId,
            message.players,
          )
          if (effectiveHostId) {
            localStorage.setItem(`kt-room-host-${roomCode}`, effectiveHostId)
          }
        } catch (error) {
          console.warn('Failed to persist map room update metadata.', error)
        }
        return
      }
      if (message.type === 'strat_ploys_update') {
        try {
          const incomingPlayerId = String(message.playerId || '').trim()
          if (!incomingPlayerId) return
          const incomingPloys = Array.isArray(message.ploys) ? message.ploys : []
          const activeGameId = localStorage.getItem('kt-game-id') || ''
          const baseKey = `kt-room-player-strat-ploys-${roomCode}-${incomingPlayerId}`
          localStorage.setItem(baseKey, JSON.stringify(incomingPloys))
          if (activeGameId) {
            localStorage.setItem(
              `${baseKey}-${activeGameId}`,
              JSON.stringify(incomingPloys),
            )
          }
          window.dispatchEvent(new CustomEvent('kt-strat-ploys-update'))
        } catch (error) {
          console.warn('Failed to persist map strat ploys update.', error)
        }
        return
      }
      if (message.type === 'sync_ready') {
        clearMapSocketError()
        try {
          if (Array.isArray(message.players)) {
            const nonMapCount = message.players.filter(
              (player) =>
                String(player?.name || '').trim().toUpperCase() !== 'MAP',
            ).length
            if (nonMapCount === 0) {
              localStorage.setItem(
                mapSocketErrorKey,
                'Map-only room payload rejected.',
              )
              return
            }
            clearMapSocketError()
            localStorage.removeItem(mapSocketRoomNotFoundCountKey)
            localStorage.setItem(
              `kt-room-players-${roomCode}`,
              JSON.stringify(message.players),
            )
          }
          const effectiveHostId = resolveEffectiveHostId(
            message.hostId,
            message.players,
          )
          if (effectiveHostId) {
            localStorage.setItem(`kt-room-host-${roomCode}`, effectiveHostId)
          }
        } catch (error) {
          console.warn('Failed to persist map sync room metadata.', error)
        }
        requestAllPlayerStates(message.players)
        return
      }
      if (message.type !== 'opponent_state') return
      const state = message.state
      const incomingPlayerId = state?.playerId || ''
      if (!incomingPlayerId) return
      try {
        const activeGameId = localStorage.getItem('kt-game-id') || ''
        if (state?.killteamId) {
          localStorage.setItem(
            `kt-room-player-killteam-${roomCode}-${incomingPlayerId}`,
            state.killteamId,
          )
          if (activeGameId) {
            localStorage.setItem(
              `kt-room-player-killteam-${roomCode}-${incomingPlayerId}-${activeGameId}`,
              state.killteamId,
            )
          }
        }
        const tacOpPayload = JSON.stringify({
          selectedTacOp: state?.selectedTacOp ?? null,
          revealed: Boolean(state?.tacOpRevealed),
        })
        const tacOpBaseKey = `kt-room-player-tac-op-${roomCode}-${incomingPlayerId}`
        localStorage.setItem(tacOpBaseKey, tacOpPayload)
        if (activeGameId) {
          localStorage.setItem(
            `${tacOpBaseKey}-${activeGameId}`,
            tacOpPayload,
          )
        }
        window.dispatchEvent(new CustomEvent('kt-tacop-reveal-update'))
        if (Array.isArray(state?.activeStratPloys)) {
          const baseKey =
            `kt-room-player-strat-ploys-${roomCode}-${incomingPlayerId}`
          localStorage.setItem(baseKey, JSON.stringify(state.activeStratPloys))
          if (activeGameId) {
            localStorage.setItem(
              `${baseKey}-${activeGameId}`,
              JSON.stringify(state.activeStratPloys),
            )
          }
          window.dispatchEvent(new CustomEvent('kt-strat-ploys-update'))
        }
        if (Array.isArray(state?.selectedUnits)) {
          const baseKey =
            `kt-room-player-selected-units-${roomCode}-${incomingPlayerId}`
          localStorage.setItem(baseKey, JSON.stringify(state.selectedUnits))
          if (activeGameId) {
            localStorage.setItem(
              `${baseKey}-${activeGameId}`,
              JSON.stringify(state.selectedUnits),
            )
          }
          window.dispatchEvent(new CustomEvent('kt-strat-ploys-update'))
        }
        if (state?.deadUnits && typeof state.deadUnits === 'object') {
          const baseKey =
            `kt-room-player-dead-units-${roomCode}-${incomingPlayerId}`
          localStorage.setItem(baseKey, JSON.stringify(state.deadUnits))
          if (activeGameId) {
            localStorage.setItem(
              `${baseKey}-${activeGameId}`,
              JSON.stringify(state.deadUnits),
            )
          }
          window.dispatchEvent(new CustomEvent('kt-strat-ploys-update'))
        }
      } catch (error) {
        console.warn('Failed to store map sync data.', error)
      }
    }

    socket.addEventListener('open', () => {
      stampSocketMeta(mapSocketOpenedAtKey, Date.now())
      stampSocketMeta(mapSocketMessageCountKey, 0)
      stampSocketMeta(mapSocketLastTypeKey, 'open')
      stampSocketMeta(mapSocketLastAtKey, Date.now())
      localStorage.removeItem(mapSocketRoomNotFoundCountKey)
      try {
        localStorage.removeItem(mapSocketErrorKey)
        localStorage.removeItem('kt-map-socket-error')
      } catch {
        // noop
      }
      sendSyncInit()
      const storedPlayers = localStorage.getItem(`kt-room-players-${roomCode}`)
      if (storedPlayers) {
        try {
          const parsedPlayers = JSON.parse(storedPlayers)
          requestAllPlayerStates(parsedPlayers)
        } catch {
          // noop
        }
      }
    })
    socket.addEventListener('message', handleMessage)

    const refreshInterval = window.setInterval(() => {
      try {
        if (socket.readyState !== WebSocket.OPEN) return
        maybeSendStaleResync()
        const storedPlayers = localStorage.getItem(`kt-room-players-${roomCode}`)
        if (!storedPlayers) {
          sendSyncInit()
          return
        }
        const parsedPlayers = JSON.parse(storedPlayers)
        if (!Array.isArray(parsedPlayers) || parsedPlayers.length === 0) {
          sendSyncInit()
          return
        }
        requestAllPlayerStates(parsedPlayers)
      } catch {
        // noop
      }
    }, 1200)

    socket.addEventListener('error', () => {
      try {
        localStorage.setItem(mapSocketErrorKey, 'Map socket connection failed.')
        stampSocketMeta(mapSocketLastTypeKey, 'error')
        stampSocketMeta(mapSocketLastAtKey, Date.now())
      } catch {
        // noop
      }
    })

    socket.addEventListener('close', () => {
      stampSocketMeta(mapSocketClosedAtKey, Date.now())
      stampSocketMeta(mapSocketLastTypeKey, 'close')
      stampSocketMeta(mapSocketLastAtKey, Date.now())
      mapSocketRef.current = null
      if (isCleaningUp) return
      reconnectTimer = window.setTimeout(() => {
        setMapSocketEpoch((current) => current + 1)
      }, 500)
    })

    return () => {
      isCleaningUp = true
      socket.removeEventListener('message', handleMessage)
      window.clearInterval(refreshInterval)
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer)
      }
      socket.close()
      mapSocketRef.current = null
    }
  }, [
    WS_URL,
    isMapSyncIdentity,
    mapSyncPlayerName,
    mapSyncRoomCode,
    mapSyncPlayerId,
    mapSocketEpoch,
  ])

  useEffect(() => {
    const readTacOps = () => {
      try {
        const parseSelectionTacOps = () => {
          const raw = localStorage.getItem('kt-selection-state')
          if (!raw) return {}
          const parsed = JSON.parse(raw)
          return parsed?.selectedTacOpsByTeam ?? {}
        }
        const parseRoomTacOp = (payload) => {
          if (!payload) return { selectedTacOp: null, revealed: false }
          const parsed = JSON.parse(payload)
          return {
            selectedTacOp: parsed?.selectedTacOp ?? null,
            revealed: Boolean(parsed?.revealed),
          }
        }
        const storedPlayerName =
          sessionStorage.getItem('kt-player-name') ||
          localStorage.getItem('kt-player-name') ||
          ''
        const roomCode =
          sessionStorage.getItem('kt-room-code') ||
          localStorage.getItem('kt-room-code') ||
          ''
        const activeGameId = localStorage.getItem('kt-game-id') || ''
        const playerId =
          sessionStorage.getItem('kt-player-id') ||
          localStorage.getItem('kt-player-id') ||
          ''
        const isMapUser = storedPlayerName.trim().toUpperCase() === 'MAP'
        const storedPlayers = roomCode
          ? localStorage.getItem(`kt-room-players-${roomCode}`)
          : ''
        const roomPlayers = storedPlayers ? JSON.parse(storedPlayers) : []
        const nonMapPlayers = roomPlayers.filter(
          (player) => String(player?.name || '').trim().toUpperCase() !== 'MAP',
        )
        const normalizedStoredName = String(storedPlayerName || '').trim()
        const resolvedPlayerId =
          playerId ||
          nonMapPlayers.find(
            (player) =>
              String(player?.name || '').trim() === normalizedStoredName,
          )?.id ||
          ''
        const assignmentsKey = roomCode
          ? `kt-drop-zone-assignments-${roomCode}`
          : 'kt-drop-zone-assignments'
        const assignmentsStored = roomCode
          ? (activeGameId &&
              localStorage.getItem(`${assignmentsKey}-${activeGameId}`)) ||
            localStorage.getItem(assignmentsKey)
          : localStorage.getItem(assignmentsKey)
        const assignments = assignmentsStored
          ? JSON.parse(assignmentsStored)
          : null
        const playerAssignments =
          assignments?.playerAssignments &&
          typeof assignments.playerAssignments === 'object'
            ? assignments.playerAssignments
            : {}
        const getAssignedPlayerId = (zone) => {
          const id = String(playerAssignments?.[zone] || '').trim()
          if (!id) return ''
          return nonMapPlayers.some((player) => player?.id === id) ? id : ''
        }
        const mapRightPlayerId = getAssignedPlayerId('B')
        const mapLeftPlayerId = getAssignedPlayerId('A')
        const fallbackFirstPlayerId = nonMapPlayers[0]?.id || ''
        const mapPrimaryPlayerId =
          mapRightPlayerId || mapLeftPlayerId || fallbackFirstPlayerId
        const mapSecondaryPlayerId =
          mapLeftPlayerId ||
          nonMapPlayers.find(
            (player) => player?.id && player.id !== mapPrimaryPlayerId,
          )?.id ||
          ''
        const getRoomTeamId = (id) => {
          if (!roomCode || !id) return ''
          return (
            (activeGameId &&
              localStorage.getItem(
                `kt-room-player-killteam-${roomCode}-${id}-${activeGameId}`,
              )) ||
            localStorage.getItem(`kt-room-player-killteam-${roomCode}-${id}`) ||
            ''
          )
        }
        const getRoomTacOp = (id) => {
          if (!roomCode || !id) return { selectedTacOp: null, revealed: false }
          const baseKey = `kt-room-player-tac-op-${roomCode}-${id}`
          const stored = activeGameId
            ? localStorage.getItem(`${baseKey}-${activeGameId}`) ||
              localStorage.getItem(baseKey)
            : localStorage.getItem(baseKey)
          return parseRoomTacOp(stored)
        }

        const playerRoomId = isMapUser ? nonMapPlayers[0]?.id : playerId
        const opponentRoomId = isMapUser
          ? nonMapPlayers[1]?.id
          : nonMapPlayers.find((player) => player?.id && player.id !== playerId)?.id

        const selectedTacOpsByTeam = parseSelectionTacOps()
        const playerTeamId = playerRoomId
          ? getRoomTeamId(playerRoomId)
          : localStorage.getItem('kt-last-killteam') || ''

        let resolvedPlayerTacOp =
          (playerTeamId && selectedTacOpsByTeam[playerTeamId]) || null
        let resolvedPlayerRevealed = playerTeamId
          ? localStorage.getItem(
              activeGameId
                ? `kt-tac-op-revealed-${playerTeamId}-${activeGameId}`
                : `kt-tac-op-revealed-${playerTeamId}`,
            ) === '1'
          : false

        if (roomCode && playerRoomId) {
          const roomPlayerTacOp = getRoomTacOp(playerRoomId)
          if (roomPlayerTacOp.selectedTacOp) {
            resolvedPlayerTacOp = roomPlayerTacOp.selectedTacOp
          }
          resolvedPlayerRevealed = roomPlayerTacOp.revealed
        }

        let resolvedOpponentTacOp = null
        let resolvedOpponentRevealed = false

        if (roomCode && playerId) {
          const scopedOpponentKey = activeGameId
            ? `kt-opponent-${roomCode}-${playerId}-${activeGameId}`
            : `kt-opponent-${roomCode}-${playerId}`
          const opponentStored = localStorage.getItem(scopedOpponentKey)
          if (opponentStored) {
            const opponentParsed = JSON.parse(opponentStored)
            resolvedOpponentTacOp = opponentParsed?.state?.selectedTacOp ?? null
            resolvedOpponentRevealed = Boolean(opponentParsed?.state?.tacOpRevealed)
          }
        }

        if (!resolvedOpponentTacOp && opponentRoomId) {
          const roomOpponentTacOp = getRoomTacOp(opponentRoomId)
          resolvedOpponentTacOp = roomOpponentTacOp.selectedTacOp
          resolvedOpponentRevealed = roomOpponentTacOp.revealed
        }

        setPlayerTacOpCard(resolvedPlayerTacOp)
        setOpponentTacOpCard(resolvedOpponentTacOp)
        setPlayerTacOpRevealed(resolvedPlayerRevealed)
        setOpponentTacOpRevealed(resolvedOpponentRevealed)
      } catch (error) {
        console.warn('Failed to read tac op reveal state.', error)
      }
    }

    readTacOps()
    const handleTacOpUpdate = () => readTacOps()
    window.addEventListener('storage', handleTacOpUpdate)
    window.addEventListener('kt-tacop-reveal-update', handleTacOpUpdate)
    return () => {
      window.removeEventListener('storage', handleTacOpUpdate)
      window.removeEventListener('kt-tacop-reveal-update', handleTacOpUpdate)
    }
  }, [])

  useEffect(() => {
    const readStratPloys = () => {
      try {
        const parsePloys = (payload) => {
          if (!payload) return []
          const parsed = JSON.parse(payload)
          return Array.isArray(parsed?.ploys) ? parsed.ploys : []
        }
        const parseRoomPloys = (payload) => {
          if (!payload) return []
          const parsed = JSON.parse(payload)
          return Array.isArray(parsed) ? parsed : []
        }
        const storedPlayerName =
          sessionStorage.getItem('kt-player-name') ||
          localStorage.getItem('kt-player-name') ||
          ''
        const roomCode =
          sessionStorage.getItem('kt-room-code') ||
          localStorage.getItem('kt-room-code') ||
          ''
        const activeGameId = localStorage.getItem('kt-game-id') || ''
        const playerId =
          sessionStorage.getItem('kt-player-id') ||
          localStorage.getItem('kt-player-id') ||
          ''
        const isMapUser = storedPlayerName.trim().toUpperCase() === 'MAP'
        const storedPlayers = roomCode
          ? localStorage.getItem(`kt-room-players-${roomCode}`)
          : ''
        const roomPlayers = storedPlayers ? JSON.parse(storedPlayers) : []
        const nonMapPlayers = roomPlayers.filter(
          (player) => String(player?.name || '').trim().toUpperCase() !== 'MAP',
        )
        const normalizedStoredName = String(storedPlayerName || '').trim()
        const resolvedPlayerId =
          playerId ||
          nonMapPlayers.find(
            (player) =>
              String(player?.name || '').trim() === normalizedStoredName,
          )?.id ||
          ''
        const assignmentsKey = roomCode
          ? `kt-drop-zone-assignments-${roomCode}`
          : 'kt-drop-zone-assignments'
        const assignmentsStored = roomCode
          ? (activeGameId &&
              localStorage.getItem(`${assignmentsKey}-${activeGameId}`)) ||
            localStorage.getItem(assignmentsKey)
          : localStorage.getItem(assignmentsKey)
        const assignments = assignmentsStored
          ? JSON.parse(assignmentsStored)
          : null
        const playerAssignments =
          assignments?.playerAssignments &&
          typeof assignments.playerAssignments === 'object'
            ? assignments.playerAssignments
            : {}
        const getAssignedPlayerId = (zone) => {
          const id = String(playerAssignments?.[zone] || '').trim()
          if (!id) return ''
          return nonMapPlayers.some((player) => player?.id === id) ? id : ''
        }
        const mapRightPlayerId = getAssignedPlayerId('B')
        const mapLeftPlayerId = getAssignedPlayerId('A')
        const fallbackFirstPlayerId = nonMapPlayers[0]?.id || ''
        const mapPrimaryPlayerId =
          mapRightPlayerId || mapLeftPlayerId || fallbackFirstPlayerId
        const mapSecondaryPlayerId =
          mapLeftPlayerId ||
          nonMapPlayers.find(
            (player) => player?.id && player.id !== mapPrimaryPlayerId,
          )?.id ||
          ''
        const getRoomTeamId = (id) => {
          if (!roomCode || !id) return ''
          return (
            (activeGameId &&
              localStorage.getItem(
                `kt-room-player-killteam-${roomCode}-${id}-${activeGameId}`,
              )) ||
            localStorage.getItem(`kt-room-player-killteam-${roomCode}-${id}`) ||
            ''
          )
        }
        const getRoomPloys = (id) => {
          if (!roomCode || !id) return []
          const baseKey = `kt-room-player-strat-ploys-${roomCode}-${id}`
          const stored = activeGameId
            ? localStorage.getItem(`${baseKey}-${activeGameId}`)
            : localStorage.getItem(baseKey)
          return parseRoomPloys(stored)
        }
        const playerPloysId = isMapUser
          ? mapPrimaryPlayerId
          : resolvedPlayerId
        const opponentPloysId = isMapUser
          ? mapSecondaryPlayerId
          : nonMapPlayers.find(
              (player) => player?.id && player.id !== resolvedPlayerId,
            )?.id
        const playerTeamId = playerPloysId
          ? getRoomTeamId(playerPloysId)
          : localStorage.getItem('kt-last-killteam') || ''
        let opponentTeamId = opponentPloysId ? getRoomTeamId(opponentPloysId) : ''
        let opponentPloys = []
        if (roomCode && resolvedPlayerId) {
          const opponentStored = localStorage.getItem(
            `kt-opponent-${roomCode}-${resolvedPlayerId}`,
          )
          if (opponentStored) {
            const opponentParsed = JSON.parse(opponentStored)
            opponentTeamId = opponentParsed?.state?.killteamId || ''
            opponentPloys = Array.isArray(opponentParsed?.state?.activeStratPloys)
              ? opponentParsed.state.activeStratPloys
              : []
          }
        }
        if (!opponentTeamId && opponentPloysId) {
          opponentTeamId = getRoomTeamId(opponentPloysId)
        }
        const resolveTeamZone = (teamId, fallbackPlayerId = '') => {
          if (!assignments) return ''
          if (teamId && assignments.A === teamId) return 'A'
          if (teamId && assignments.B === teamId) return 'B'
          if (fallbackPlayerId) {
            if (playerAssignments.A === fallbackPlayerId) return 'A'
            if (playerAssignments.B === fallbackPlayerId) return 'B'
          }
          return ''
        }
        const resolvedPlayerZone = resolveTeamZone(playerTeamId, playerPloysId)
        const resolvedOpponentZone = resolveTeamZone(opponentTeamId, opponentPloysId)
        if (resolvedPlayerZone) {
          setPlayerAssignedZone(resolvedPlayerZone)
        }
        if (resolvedOpponentZone) {
          setOpponentAssignedZone(resolvedOpponentZone)
        }
        const playerStored = playerTeamId
          ? activeGameId
            ? localStorage.getItem(
                `kt-strat-ploys-active-${playerTeamId}-${activeGameId}`,
              )
            : localStorage.getItem(`kt-strat-ploys-active-${playerTeamId}`)
          : ''
        const opponentStored = opponentTeamId
          ? activeGameId
            ? localStorage.getItem(
                `kt-strat-ploys-active-${opponentTeamId}-${activeGameId}`,
              )
            : localStorage.getItem(`kt-strat-ploys-active-${opponentTeamId}`)
          : ''
        const playerRoomPloys = playerPloysId ? getRoomPloys(playerPloysId) : []
        const opponentRoomPloys = opponentPloysId
          ? getRoomPloys(opponentPloysId)
          : []
        const resolvedPlayerPloys =
          playerRoomPloys.length ? playerRoomPloys : parsePloys(playerStored)
        const resolvedOpponentPloys =
          opponentPloys.length
            ? opponentPloys
            : opponentRoomPloys.length
              ? opponentRoomPloys
              : parsePloys(opponentStored)
        setPlayerStratPloys((previous) =>
          resolvedPlayerPloys.length ? resolvedPlayerPloys : previous,
        )
        setOpponentStratPloys((previous) =>
          resolvedOpponentPloys.length ? resolvedOpponentPloys : previous,
        )
      } catch (error) {
        console.warn('Failed to read strat ploys selection.', error)
      }
    }
    readStratPloys()
    const handleStratPloysUpdate = () => readStratPloys()
    window.addEventListener('kt-strat-ploys-update', handleStratPloysUpdate)
    window.addEventListener('storage', handleStratPloysUpdate)
    return () => {
      window.removeEventListener('kt-strat-ploys-update', handleStratPloysUpdate)
      window.removeEventListener('storage', handleStratPloysUpdate)
    }
  }, [])

  useEffect(() => {
    const readKillOpCounts = () => {
      try {
        const parseSelectionState = () => {
          const raw = localStorage.getItem('kt-selection-state')
          if (!raw) return {}
          const parsed = JSON.parse(raw)
          return parsed?.selectedUnitsByTeam ?? {}
        }
        const parseRoomSelectedUnits = (payload) => {
          if (!payload) return []
          const parsed = JSON.parse(payload)
          return Array.isArray(parsed) ? parsed : []
        }
        const parseRoomDeadUnits = (payload) => {
          if (!payload) return {}
          const parsed = JSON.parse(payload)
          return parsed && typeof parsed === 'object' ? parsed : {}
        }
        const pickLargestUnitList = (...lists) =>
          lists.reduce(
            (best, candidate) =>
              Array.isArray(candidate) && candidate.length > best.length
                ? candidate
                : best,
            [],
          )
        const storedPlayerName =
          sessionStorage.getItem('kt-player-name') ||
          localStorage.getItem('kt-player-name') ||
          ''
        const roomCode =
          sessionStorage.getItem('kt-room-code') ||
          localStorage.getItem('kt-room-code') ||
          ''
        const activeGameId = localStorage.getItem('kt-game-id') || ''
        const playerId =
          sessionStorage.getItem('kt-player-id') ||
          localStorage.getItem('kt-player-id') ||
          ''
        const isMapUser = storedPlayerName.trim().toUpperCase() === 'MAP'
        const storedPlayers = roomCode
          ? localStorage.getItem(`kt-room-players-${roomCode}`)
          : ''
        const roomPlayers = storedPlayers ? JSON.parse(storedPlayers) : []
        const nonMapPlayers = roomPlayers.filter(
          (player) => String(player?.name || '').trim().toUpperCase() !== 'MAP',
        )
        const normalizedStoredName = String(storedPlayerName || '').trim()
        const resolvedPlayerId =
          playerId ||
          nonMapPlayers.find(
            (player) =>
              String(player?.name || '').trim() === normalizedStoredName,
          )?.id ||
          ''
        const assignmentsKey = roomCode
          ? `kt-drop-zone-assignments-${roomCode}`
          : 'kt-drop-zone-assignments'
        const assignmentsStored = roomCode
          ? (activeGameId &&
              localStorage.getItem(`${assignmentsKey}-${activeGameId}`)) ||
            localStorage.getItem(assignmentsKey)
          : localStorage.getItem(assignmentsKey)
        const assignments = assignmentsStored
          ? JSON.parse(assignmentsStored)
          : null
        const playerAssignments =
          assignments?.playerAssignments &&
          typeof assignments.playerAssignments === 'object'
            ? assignments.playerAssignments
            : {}
        const getAssignedPlayerId = (zone) => {
          const id = String(playerAssignments?.[zone] || '').trim()
          if (!id) return ''
          return nonMapPlayers.some((player) => player?.id === id) ? id : ''
        }
        const mapRightPlayerId = getAssignedPlayerId('B')
        const mapLeftPlayerId = getAssignedPlayerId('A')
        const fallbackFirstPlayerId = nonMapPlayers[0]?.id || ''
        const mapPrimaryPlayerId =
          mapRightPlayerId || mapLeftPlayerId || fallbackFirstPlayerId
        const mapSecondaryPlayerId =
          mapLeftPlayerId ||
          nonMapPlayers.find(
            (player) => player?.id && player.id !== mapPrimaryPlayerId,
          )?.id ||
          ''
        const getRoomTeamId = (id) => {
          if (!roomCode || !id) return ''
          if (activeGameId) {
            return (
              localStorage.getItem(
                `kt-room-player-killteam-${roomCode}-${id}-${activeGameId}`,
              ) || ''
            )
          }
          return localStorage.getItem(`kt-room-player-killteam-${roomCode}-${id}`) || ''
        }
        const getRoomSelectedUnits = (id) => {
          if (!roomCode || !id) return []
          const baseKey = `kt-room-player-selected-units-${roomCode}-${id}`
          const stored = activeGameId
            ? localStorage.getItem(`${baseKey}-${activeGameId}`) ||
              localStorage.getItem(baseKey)
            : localStorage.getItem(baseKey)
          return parseRoomSelectedUnits(stored)
        }
        const getRoomDeadUnits = (id) => {
          if (!roomCode || !id) return {}
          const baseKey = `kt-room-player-dead-units-${roomCode}-${id}`
          const stored = activeGameId
            ? localStorage.getItem(`${baseKey}-${activeGameId}`) ||
              localStorage.getItem(baseKey)
            : localStorage.getItem(baseKey)
          return parseRoomDeadUnits(stored)
        }
        const getGameDeadUnits = (teamId) => {
          if (!teamId) return {}
          const gameKey = activeGameId
            ? `kt-game-${teamId}-${activeGameId}`
            : `kt-game-${teamId}`
          const stored = localStorage.getItem(gameKey)
          if (!stored) return {}
          const parsed = JSON.parse(stored)
          return parsed?.deadUnits && typeof parsed.deadUnits === 'object'
            ? parsed.deadUnits
            : {}
        }
        const getGameSelectedUnits = (teamId) => {
          if (!teamId) return []
          const gameKey = activeGameId
            ? `kt-game-${teamId}-${activeGameId}`
            : `kt-game-${teamId}`
          const stored = localStorage.getItem(gameKey)
          if (!stored) return []
          const parsed = JSON.parse(stored)
          return Array.isArray(parsed?.selectedUnits) ? parsed.selectedUnits : []
        }

        const playerRoomId = isMapUser
          ? mapPrimaryPlayerId
          : resolvedPlayerId
        const opponentRoomId = isMapUser
          ? mapSecondaryPlayerId
          : nonMapPlayers.find(
              (player) => player?.id && player.id !== resolvedPlayerId,
            )?.id

        const selectedUnitsByTeam = parseSelectionState()
        const playerTeamId = playerRoomId
          ? getRoomTeamId(playerRoomId)
          : localStorage.getItem('kt-last-killteam') || ''

        let opponentTeamId = opponentRoomId ? getRoomTeamId(opponentRoomId) : ''
        let opponentSelectedUnits = []
        let opponentDeadUnits = {}

        if (roomCode && resolvedPlayerId) {
          const scopedOpponentKey = activeGameId
            ? `kt-opponent-${roomCode}-${resolvedPlayerId}-${activeGameId}`
            : `kt-opponent-${roomCode}-${resolvedPlayerId}`
          const opponentStored = localStorage.getItem(scopedOpponentKey)
          if (opponentStored) {
            const opponentParsed = JSON.parse(opponentStored)
            opponentTeamId = opponentParsed?.state?.killteamId || opponentTeamId
            opponentSelectedUnits = Array.isArray(opponentParsed?.state?.selectedUnits)
              ? opponentParsed.state.selectedUnits
              : []
            opponentDeadUnits =
              opponentParsed?.state?.deadUnits &&
              typeof opponentParsed.state.deadUnits === 'object'
                ? opponentParsed.state.deadUnits
                : {}
          }
        }

        const roomPlayerSelectedUnits = roomCode
          ? getRoomSelectedUnits(playerRoomId)
          : []
        const selectionPlayerUnits =
          (playerTeamId && selectedUnitsByTeam[playerTeamId]) || []
        const gamePlayerSelectedUnits = getGameSelectedUnits(playerTeamId)
        const playerSelectedUnits = pickLargestUnitList(
          roomPlayerSelectedUnits,
          selectionPlayerUnits,
          gamePlayerSelectedUnits,
        )

        const roomOpponentSelectedUnits = getRoomSelectedUnits(opponentRoomId)
        const selectionOpponentUnits =
          (opponentTeamId && selectedUnitsByTeam[opponentTeamId]) || []
        const gameOpponentSelectedUnits = getGameSelectedUnits(opponentTeamId)
        const resolvedOpponentSelectedUnits = pickLargestUnitList(
          opponentSelectedUnits,
          roomOpponentSelectedUnits,
          selectionOpponentUnits,
          gameOpponentSelectedUnits,
        )
        const gamePlayerDeadUnits = getGameDeadUnits(playerTeamId)
        const playerDeadUnits = Object.keys(gamePlayerDeadUnits).length
          ? gamePlayerDeadUnits
          : getRoomDeadUnits(playerRoomId)
        const resolvedOpponentDeadUnits =
          Object.keys(opponentDeadUnits).length
            ? opponentDeadUnits
            : getRoomDeadUnits(opponentRoomId)

        if (playerTeamId) {
          setPlayerKillOpCount(
            deriveKillOpCount(playerTeamId, playerSelectedUnits),
          )
          setPlayerDeadCount(deriveDeadCount(playerTeamId, playerDeadUnits))
        }
        if (opponentTeamId) {
          setOpponentKillOpCount(
            deriveKillOpCount(opponentTeamId, resolvedOpponentSelectedUnits),
          )
          setOpponentDeadCount(
            deriveDeadCount(opponentTeamId, resolvedOpponentDeadUnits),
          )
        }
      } catch (error) {
        console.warn('Failed to read kill op counts.', error)
      }
    }
    readKillOpCounts()
    const handleSelectionUpdate = () => readKillOpCounts()
    window.addEventListener('storage', handleSelectionUpdate)
    window.addEventListener('kt-strat-ploys-update', handleSelectionUpdate)
    window.addEventListener('kt-killop-update', handleSelectionUpdate)
    return () => {
      window.removeEventListener('storage', handleSelectionUpdate)
      window.removeEventListener('kt-strat-ploys-update', handleSelectionUpdate)
      window.removeEventListener('kt-killop-update', handleSelectionUpdate)
    }
  }, [])

  useEffect(() => {
    if (toolMode === 'none') {
      setToolWatermark('')
      return
    }

    const label =
      toolMode === 'sight'
        ? 'Sight Line'
        : toolMode === 'measure'
          ? 'Movement Measure'
          : 'Field Of Vision'
    setToolWatermark(label)
    const timeoutId = window.setTimeout(() => {
      setToolWatermark('')
    }, 1200)
    return () => window.clearTimeout(timeoutId)
  }, [toolMode])

  const getZoneStyle = (zone) => {
    if (!zone) return null
    const rotated = shouldRotateZones
      ? {
          x: (zone.y / sourceHeight) * board.width,
          y: (zone.x / sourceWidth) * board.height,
          w: (zone.h / sourceHeight) * board.width,
          h: (zone.w / sourceWidth) * board.height,
        }
      : zone
    return {
      left: toPercent(rotated.x, board.width),
      bottom: toPercent(rotated.y, board.height),
      width: toPercent(rotated.w, board.width),
      height: toPercent(rotated.h, board.height),
    }
  }

  const renderZone = (zone, className) => {
    const style = getZoneStyle(zone)
    if (!style) return null
    return <div className={`board-zone ${className}`} style={style} />
  }

  const renderDropZoneOverlay = (
    zone,
    className,
    label,
    value,
    teamName,
    armyName,
  ) => {
    const style = getZoneStyle(zone)
    if (!style) return null
    const isSelected = selectedDropZone === value
    return (
      <div
        className={`board-dropzone-overlay ${className}${
          isSelected ? ' is-selected' : ''
        }${dropZoneSelectionEnabled ? ' is-clickable' : ''}`}
        style={style}
        onClick={
          dropZoneSelectionEnabled
            ? () => onDropZoneSelect?.(value)
            : undefined
        }
      >
        <div className="board-dropzone-overlay__text">
          <span className="board-dropzone-overlay__label">{label}</span>
          <span className="board-dropzone-overlay__name">
            {teamName
              ? `${teamName}${armyName ? ` - ${armyName}` : ''}`
              : 'OOPSIE, Jesse needs to fix this'}
          </span>
        </div>
      </div>
    )
  }

  const condensePloyRules = (ployName, description) => {
    const normalizedName = String(ployName || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
    const overrides = {
      'masterful bladework':
        '+1 ATK on MELEE (max 4) +balanced (+ceasless if balanced already)',
      'tough survivalists':
        'First time dice damages unit, per unit, per TP, halve damage (round up, min 2dmg)',
      'dakka dakka dakka':
        'Ranged: Punishing (if any crits, retain 1 failed as normal success).',
      'skulk about':
        'If shot while Conceal: auto retain 1 defense success (plus cover).',
      sssshhhh: 'If not a valid target OR Conceal + >6": free Dash (not TP1).',
      waaagh: 'Melee: Balanced (re-roll 1 attack die).',
      'just a scratch':
        'When normal damage inflicted on KOMMANDO (not Bomb Squig/Grot): ignore it.',
      'kunnin but brutal':
        'If Conceal + Charged and first strike is normal: treat it as a crit.',
      'krump em': 'End of Firefight: 1 KOMMANDO performs a free Fight.',
      'shake it off':
        'On activation or APL change: ignore APL changes until next TP.',
      'in position':
        'If concealed and in cover, cannot be selected as valid target (precedence over all other rules)',
    }
    if (overrides[normalizedName]) {
      return [overrides[normalizedName]]
    }
    if (!description) return []
    const fragments = description
      .split(/\r?\n|\.(?=\s)|;\s*/)
      .map((fragment) => fragment.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean)
    const ruleHint =
      /(\d|CP|AP|re[- ]?roll|dice|attack|defen[cs]e|weapon|within|inch|\+|\-)/i
    const selected = fragments.filter((fragment) => ruleHint.test(fragment))
    if (selected.length) return selected.slice(0, 2)
    return fragments.length ? fragments.slice(0, 1) : []
  }

  const renderStratPloys = (ploys) => (
    <div className="board-side__strat-ploys">
      <div className="board-side__strat-ploys-title">Strat Ploys</div>
      <div className="board-side__strat-ploys-list">
        {ploys.map((ploy) => (
          <div
            className="board-side__strat-ploys-item"
            key={ploy.id || ploy.name}
          >
            <div className="board-side__strat-ploys-text">
              <div className="board-side__strat-ploys-row">
                <span>{ploy.name}</span>
                {ploy.cost ? (
                  <span className="board-side__strat-ploys-cost">{ploy.cost}</span>
                ) : null}
              </div>
              {condensePloyRules(ploy.name, ploy.description).map((rule, index) => (
                <span
                  className="board-side__strat-ploys-rule"
                  key={`${ploy.id || ploy.name}-rule-${index}`}
                >
                  {rule}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  const renderTacOpCard = (tacOpCard, isRevealed) => {
    const revealedImageSrc =
      tacOpCard?.src ||
      tacOpCard?.imageSrc ||
      tacOpCard?.image ||
      tacOpCard?.cardSrc ||
      ''
    const hasTacCard = Boolean(revealedImageSrc)
    const revealedSrc = hasTacCard ? revealedImageSrc : HIDDEN_TAC_OP_SRC
    const revealedAltText = hasTacCard
      ? tacOpCard.label || 'Selected Tac Op'
      : 'Hidden Tac Op'
    return (
      <div className="board-side__tacop-shell">
        <div className={`board-side__tacop-card${isRevealed ? ' is-revealed' : ''}`}>
          <div className="board-side__tacop-flipper">
            <div className="board-side__tacop-face board-side__tacop-face--front">
              <img src={HIDDEN_TAC_OP_SRC} alt="Hidden Tac Op" loading="lazy" />
            </div>
            <div className="board-side__tacop-face board-side__tacop-face--back">
              <img src={revealedSrc} alt={revealedAltText} loading="lazy" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  const resolvedPlayerDropZone = playerAssignedZone || storedDropZone
  const resolvedOpponentDropZone = opponentAssignedZone || storedOpponentDropZone
  const playerSide = resolvedPlayerDropZone
    ? resolvedPlayerDropZone === 'B'
      ? 'right'
      : 'left'
    : ''
  const hasPloys = playerStratPloys.length || opponentStratPloys.length
  const leftStratPloys = playerSide
    ? playerSide === 'left'
      ? playerStratPloys
      : opponentStratPloys
    : hasPloys
      ? playerStratPloys
      : []
  const rightStratPloys = playerSide
    ? playerSide === 'left'
      ? opponentStratPloys
      : playerStratPloys
    : hasPloys
      ? opponentStratPloys
      : []
  const leftStratPloysContent = renderStratPloys(leftStratPloys)
  const rightStratPloysContent = renderStratPloys(rightStratPloys)
  const leftTacOpCard = playerSide
    ? playerSide === 'left'
      ? playerTacOpCard
      : opponentTacOpCard
    : playerTacOpCard
  const rightTacOpCard = playerSide
    ? playerSide === 'left'
      ? opponentTacOpCard
      : playerTacOpCard
    : opponentTacOpCard
  const leftTacOpRevealed = playerSide
    ? playerSide === 'left'
      ? playerTacOpRevealed
      : opponentTacOpRevealed
    : playerTacOpRevealed
  const rightTacOpRevealed = playerSide
    ? playerSide === 'left'
      ? opponentTacOpRevealed
      : playerTacOpRevealed
    : opponentTacOpRevealed
  const leftTacOpContent = renderTacOpCard(leftTacOpCard, leftTacOpRevealed)
  const rightTacOpContent = renderTacOpCard(rightTacOpCard, rightTacOpRevealed)
  const leftKillOpCount = playerSide
    ? playerSide === 'left'
      ? playerKillOpCount
      : opponentKillOpCount
    : playerKillOpCount
  const rightKillOpCount = playerSide
    ? playerSide === 'left'
      ? opponentKillOpCount
      : playerKillOpCount
    : opponentKillOpCount
  const leftKillOpHighlight = rightKillOpCount
  const rightKillOpHighlight = leftKillOpCount
  const leftDeadCount = playerSide
    ? playerSide === 'left'
      ? playerDeadCount
      : opponentDeadCount
    : playerDeadCount
  const rightDeadCount = playerSide
    ? playerSide === 'left'
      ? opponentDeadCount
      : playerDeadCount
    : opponentDeadCount
  const leftKillOpDeadCount = rightDeadCount
  const rightKillOpDeadCount = leftDeadCount

  useEffect(() => {
    if (!maps.length || hasRandomizedMapRef.current) return
    const randomMap = maps[Math.floor(Math.random() * maps.length)]
    setSelectedMapId(randomMap.id)
    hasRandomizedMapRef.current = true
  }, [maps])

  useEffect(() => {
    if (!maps.length) return
    let updated = false
    maps.forEach((map) => {
      if (!textureByMapIdRef.current.has(map.id)) {
        textureByMapIdRef.current.set(map.id, Math.floor(Math.random() * 3))
        updated = true
      }
    })
    if (updated) {
      setTextureVersion((prev) => prev + 1)
    }
  }, [maps])

  useEffect(() => {
    if (!mapArrangements.length) {
      setArrangementIndex(0)
      return
    }
    const randomIndex = Math.floor(
      Math.random() * mapArrangements.length,
    )
    setArrangementIndex(randomIndex)
  }, [activeMap?.id, mapArrangements.length])

  useEffect(() => {
    if (!critOpsCards.length) return
    const randomIndex = Math.floor(Math.random() * critOpsCards.length)
    setSelectedCardIndex(randomIndex)
  }, [critOpsCards.length])

  useLayoutEffect(() => {
    const surface = boardSurfaceRef.current
    const frame = boardFrameRef.current
    if (!surface || !frame) return

    const centerBoard = () => {
      const canScrollSurface =
        surface.scrollHeight > surface.clientHeight + 1 ||
        surface.scrollWidth > surface.clientWidth + 1
      if (canScrollSurface) {
        const surfaceRect = surface.getBoundingClientRect()
        const frameRect = frame.getBoundingClientRect()
        const rawLeft =
          surface.scrollLeft +
          (frameRect.left - surfaceRect.left) -
          (surface.clientWidth - frameRect.width) / 2
        const rawTop =
          surface.scrollTop +
          (frameRect.top - surfaceRect.top) -
          (surface.clientHeight - frameRect.height) / 2
        const maxScrollLeft = Math.max(0, surface.scrollWidth - surface.clientWidth)
        const maxScrollTop = Math.max(0, surface.scrollHeight - surface.clientHeight)
        const scrollLeft = Math.min(maxScrollLeft, Math.max(0, rawLeft))
        const scrollTop = Math.min(maxScrollTop, Math.max(0, rawTop))
        surface.scrollTo({
          left: scrollLeft,
          top: scrollTop,
          behavior: 'auto',
        })
        return
      }

      const rect = frame.getBoundingClientRect()
      const targetLeft =
        rect.left + window.scrollX + rect.width / 2 - window.innerWidth / 2
      const targetTop =
        rect.top + window.scrollY + rect.height / 2 - window.innerHeight / 2
      window.scrollTo({ left: targetLeft, top: targetTop, behavior: 'auto' })
    }

    const rafId = requestAnimationFrame(() =>
      requestAnimationFrame(centerBoard),
    )
    const timeoutIds = [
      window.setTimeout(centerBoard, 0),
      window.setTimeout(centerBoard, 150),
      window.setTimeout(centerBoard, 500),
    ]
    const handleResize = () => centerBoard()
    window.addEventListener('resize', handleResize)
    return () => {
      cancelAnimationFrame(rafId)
      timeoutIds.forEach((id) => window.clearTimeout(id))
      window.removeEventListener('resize', handleResize)
    }
  }, [activeMap?.id, arrangementIndex])

  const activeTextureIndex = useMemo(() => {
    if (!activeMap?.id) return 0
    return textureByMapIdRef.current.get(activeMap.id) ?? 0
  }, [activeMap?.id, textureVersion])

  const activeTexture =
    textureStyles[activeTextureIndex % textureStyles.length]
  useEffect(() => {
    if (!activeTexture?.label) return
    setShowTextureWatermark(true)
    const timeoutId = window.setTimeout(() => {
      setShowTextureWatermark(false)
    }, 10000)
    return () => window.clearTimeout(timeoutId)
  }, [activeMap?.id, activeTexture?.label])

  useEffect(() => {
    const canvas = boardTextureRef.current
    const windCanvas = boardWindRef.current
    const fogCanvas = boardFogRef.current
    const frame = boardFrameRef.current
    if (!canvas || !frame) return

    const context = canvas.getContext('2d')
    const windContext = windCanvas ? windCanvas.getContext('2d') : null
    const fogContext = fogCanvas ? fogCanvas.getContext('2d') : null
    if (!context) return

    const style = textureStyles[activeTextureIndex % textureStyles.length]
    const offscreen = document.createElement('canvas')
    const offscreenContext = offscreen.getContext('2d')
    const noiseCanvas = document.createElement('canvas')
    const noiseContext = noiseCanvas.getContext('2d')
    const effectState = {
      streaks: [],
      particles: [],
      drops: [],
      splashes: [],
      impacts: [],
      rainStreaks: [],
      fogClouds: [],
      fogCenter: { x: 0.5, y: 0.5 },
      rainAccumulator: 0,
      pulseOrigin: {
        x: 0.5,
        y: 0.5,
      },
    }
    let animationFrame = 0
    let lastTime = 0
    let width = 0
    let height = 0

    const createNoisePattern = () => {
      if (!noiseContext) return null
      const size = 128
      noiseCanvas.width = size
      noiseCanvas.height = size
      const image = noiseContext.createImageData(size, size)
      for (let i = 0; i < image.data.length; i += 4) {
        const shade = 90 + Math.floor(Math.random() * 80)
        image.data[i] = shade
        image.data[i + 1] = shade
        image.data[i + 2] = shade
        image.data[i + 3] = 255
      }
      noiseContext.putImageData(image, 0, 0)
      return offscreenContext?.createPattern(noiseCanvas, 'repeat') || null
    }

    const noisePattern = createNoisePattern()

    const buildBaseTexture = () => {
      if (!offscreenContext) return
      offscreen.width = width
      offscreen.height = height
      offscreenContext.clearRect(0, 0, width, height)
      offscreenContext.fillStyle = style.base
      offscreenContext.fillRect(0, 0, width, height)

      const gradient = offscreenContext.createLinearGradient(0, 0, width, height)
      gradient.addColorStop(0, style.sand ? 'rgba(255, 230, 170, 0.08)' : 'rgba(255, 255, 255, 0.05)')
      gradient.addColorStop(1, style.sand ? 'rgba(20, 12, 6, 0.45)' : 'rgba(0, 0, 0, 0.25)')
      offscreenContext.fillStyle = gradient
      offscreenContext.fillRect(0, 0, width, height)

      if (style.sand) {
        const duneGradient = offscreenContext.createRadialGradient(
          width * 0.2,
          height * 0.8,
          Math.max(width, height) * 0.1,
          width * 0.2,
          height * 0.8,
          Math.max(width, height) * 0.8,
        )
        duneGradient.addColorStop(0, 'rgba(255, 214, 150, 0.12)')
        duneGradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
        offscreenContext.fillStyle = duneGradient
        offscreenContext.fillRect(0, 0, width, height)

        const hazeGradient = offscreenContext.createLinearGradient(0, 0, width, 0)
        hazeGradient.addColorStop(0, 'rgba(255, 220, 170, 0.08)')
        hazeGradient.addColorStop(0.5, 'rgba(255, 210, 160, 0.04)')
        hazeGradient.addColorStop(1, 'rgba(255, 210, 160, 0.1)')
        offscreenContext.fillStyle = hazeGradient
        offscreenContext.fillRect(0, 0, width, height)


        offscreenContext.save()
        offscreenContext.lineWidth = Math.max(34, width * 0.045)
        offscreenContext.lineCap = 'round'
        for (let i = 0; i < 7; i += 1) {
          const baseY = (i / 6) * height + (-0.1 + Math.random() * 0.2) * height
          const amplitude = 10 + Math.random() * 22
          const stripeGradient = offscreenContext.createLinearGradient(
            -width * 0.1,
            0,
            width * 1.1,
            0,
          )
          stripeGradient.addColorStop(0, 'rgba(255, 215, 165, 0)')
          stripeGradient.addColorStop(0.2, 'rgba(255, 215, 165, 0.08)')
          stripeGradient.addColorStop(0.5, 'rgba(255, 215, 165, 0.12)')
          stripeGradient.addColorStop(0.8, 'rgba(255, 215, 165, 0.08)')
          stripeGradient.addColorStop(1, 'rgba(255, 215, 165, 0)')
          const yFade = 1 - Math.abs(baseY / height - 0.5) * 1.6
          offscreenContext.strokeStyle = stripeGradient
          offscreenContext.globalAlpha = Math.max(0.2, yFade) * 0.6
          offscreenContext.globalCompositeOperation = 'source-over'
          offscreenContext.beginPath()
          offscreenContext.moveTo(-width * 0.1, baseY)
          for (let x = 0; x <= width * 1.1; x += width / 7) {
            const y = baseY + Math.sin((x / width) * Math.PI * 2) * amplitude
            offscreenContext.lineTo(x, y)
          }
          offscreenContext.stroke()
          offscreenContext.globalAlpha = 1
        }
        offscreenContext.restore()
      }

      if (style.grass) {
        const fieldGradient = offscreenContext.createLinearGradient(0, 0, 0, height)
        fieldGradient.addColorStop(0, 'rgba(24, 70, 28, 0.85)')
        fieldGradient.addColorStop(1, 'rgba(10, 36, 16, 0.95)')
        offscreenContext.fillStyle = fieldGradient
        offscreenContext.fillRect(0, 0, width, height)

        for (let i = 0; i < 24; i += 1) {
          const patchX = Math.random() * width
          const patchY = Math.random() * height
          const patchRadius = 50 + Math.random() * 140
          const patchGradient = offscreenContext.createRadialGradient(
            patchX,
            patchY,
            patchRadius * 0.2,
            patchX,
            patchY,
            patchRadius,
          )
          patchGradient.addColorStop(0, 'rgba(28, 90, 36, 0.5)')
          patchGradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
          offscreenContext.fillStyle = patchGradient
          offscreenContext.beginPath()
          offscreenContext.arc(patchX, patchY, patchRadius, 0, Math.PI * 2)
          offscreenContext.fill()
        }

        if (activeArrangement?.terrain?.length) {
          const pieces = []
          const scaleX = width / board.width
          const scaleY = height / board.height
          const toCanvasPoint = (point) => ({
            x: point.x * scaleX,
            y: height - point.y * scaleY,
          })
          const getPiecePoints = (piece) => {
            if (piece?.areas?.length) {
              return piece.areas.flatMap((area) => area?.points ?? [])
            }
            if (piece?.area?.points?.length) return piece.area.points
            return []
          }

          activeArrangement.terrain.forEach((entry) => {
            const piece = entry?.pieceId
              ? terrainPieceById.get(entry.pieceId)
              : entry
            if (!piece) return
            const points = getPiecePoints(piece)
            if (!points.length) return
            const placement = entry?.placement || {}
            const rotation = placement.rotation || 0
            const radians = (rotation * Math.PI) / 180
            const cos = Math.cos(radians)
            const sin = Math.sin(radians)
            let minX = Number.POSITIVE_INFINITY
            let minY = Number.POSITIVE_INFINITY
            let maxX = Number.NEGATIVE_INFINITY
            let maxY = Number.NEGATIVE_INFINITY
            points.forEach(([x, y]) => {
              const rotatedX = x * cos - y * sin
              const rotatedY = x * sin + y * cos
              const worldX = rotatedX + (placement.x || 0)
              const worldY = rotatedY + (placement.y || 0)
              minX = Math.min(minX, worldX)
              minY = Math.min(minY, worldY)
              maxX = Math.max(maxX, worldX)
              maxY = Math.max(maxY, worldY)
            })
            if (!Number.isFinite(minX)) return
            const centerX = (minX + maxX) / 2
            const centerY = (minY + maxY) / 2
            pieces.push({
              x: centerX,
              y: centerY,
              halfW: Math.max(0.1, (maxX - minX) / 2),
              halfH: Math.max(0.1, (maxY - minY) / 2),
            })
          })

          const pathMargin = 1.8
          const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
          const getPieceAreas = (piece) => {
            if (piece?.areas?.length) return piece.areas
            if (piece?.area) return [piece.area]
            return []
          }
          const transformPoint = ([x, y], placement) => {
            const rotation = placement.rotation || 0
            if (!rotation) return { x: x + (placement.x || 0), y: y + (placement.y || 0) }
            const radians = (rotation * Math.PI) / 180
            const cos = Math.cos(radians)
            const sin = Math.sin(radians)
            const rotatedX = x * cos - y * sin
            const rotatedY = x * sin + y * cos
            return { x: rotatedX + (placement.x || 0), y: rotatedY + (placement.y || 0) }
          }
          const polygons = []
          activeArrangement.terrain.forEach((entry) => {
            const piece = entry?.pieceId
              ? terrainPieceById.get(entry.pieceId)
              : entry
            if (!piece) return
            const placement = entry?.placement || {}
            getPieceAreas(piece).forEach((area) => {
              const points = area?.points
              if (!Array.isArray(points) || !points.length) return
              polygons.push(points.map((point) => transformPoint(point, placement)))
            })
          })
          const pointInPoly = (point, poly) => {
            let inside = false
            for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
              const xi = poly[i].x
              const yi = poly[i].y
              const xj = poly[j].x
              const yj = poly[j].y
              const intersect =
                yi > point.y !== yj > point.y &&
                point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
              if (intersect) inside = !inside
            }
            return inside
          }
          const distToSegment = (point, a, b) => {
            const dx = b.x - a.x
            const dy = b.y - a.y
            if (!dx && !dy) return Math.hypot(point.x - a.x, point.y - a.y)
            const t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)
            const clamped = Math.max(0, Math.min(1, t))
            const projX = a.x + clamped * dx
            const projY = a.y + clamped * dy
            return Math.hypot(point.x - projX, point.y - projY)
          }
          const isBlocked = (point) => {
            for (let p = 0; p < polygons.length; p += 1) {
              const poly = polygons[p]
              if (pointInPoly(point, poly)) return true
              for (let i = 0; i < poly.length; i += 1) {
                const a = poly[i]
                const b = poly[(i + 1) % poly.length]
                if (distToSegment(point, a, b) <= pathMargin) return true
              }
            }
            return false
          }
          const cellSize = 0.1
          const gridWidth = Math.ceil(board.width / cellSize)
          const gridHeight = Math.ceil(board.height / cellSize)
          const toWorld = (gx, gy) => ({
            x: (gx + 0.5) * cellSize,
            y: (gy + 0.5) * cellSize,
          })
          const toGrid = (point) => ({
            gx: clamp(Math.floor(point.x / cellSize), 0, gridWidth - 1),
            gy: clamp(Math.floor(point.y / cellSize), 0, gridHeight - 1),
          })
          const blocked = Array.from({ length: gridHeight }, () =>
            Array.from({ length: gridWidth }, () => false),
          )
          for (let gy = 0; gy < gridHeight; gy += 1) {
            for (let gx = 0; gx < gridWidth; gx += 1) {
              if (isBlocked(toWorld(gx, gy))) blocked[gy][gx] = true
            }
          }
          const findNearestFree = (start) => {
            if (!blocked[start.gy][start.gx]) return start
            const maxRadius = Math.max(gridWidth, gridHeight)
            for (let r = 1; r < maxRadius; r += 1) {
              for (let dy = -r; dy <= r; dy += 1) {
                for (let dx = -r; dx <= r; dx += 1) {
                  const gx = start.gx + dx
                  const gy = start.gy + dy
                  if (gx < 0 || gy < 0 || gx >= gridWidth || gy >= gridHeight) continue
                  if (!blocked[gy][gx]) return { gx, gy }
                }
              }
            }
            return start
          }
          const aStar = (start, goal) => {
            const key = (node) => `${node.gx},${node.gy}`
            const open = [start]
            const cameFrom = new Map()
            const gScore = Array.from({ length: gridHeight }, () =>
              Array.from({ length: gridWidth }, () => Number.POSITIVE_INFINITY),
            )
            gScore[start.gy][start.gx] = 0
            const h = (node) => Math.hypot(node.gx - goal.gx, node.gy - goal.gy)
            const neighbors = [
              { gx: 1, gy: 0, cost: 1 },
              { gx: -1, gy: 0, cost: 1 },
              { gx: 0, gy: 1, cost: 1 },
              { gx: 0, gy: -1, cost: 1 },
              { gx: 1, gy: 1, cost: Math.SQRT2 },
              { gx: -1, gy: 1, cost: Math.SQRT2 },
              { gx: 1, gy: -1, cost: Math.SQRT2 },
              { gx: -1, gy: -1, cost: Math.SQRT2 },
            ]
            while (open.length) {
              let bestIndex = 0
              let bestF = gScore[open[0].gy][open[0].gx] + h(open[0])
              for (let i = 1; i < open.length; i += 1) {
                const node = open[i]
                const f = gScore[node.gy][node.gx] + h(node)
                if (f < bestF) {
                  bestF = f
                  bestIndex = i
                }
              }
              const current = open.splice(bestIndex, 1)[0]
              if (current.gx === goal.gx && current.gy === goal.gy) {
                const path = [current]
                let cursor = key(current)
                while (cameFrom.has(cursor)) {
                  const prev = cameFrom.get(cursor)
                  path.push(prev)
                  cursor = key(prev)
                }
                return path.reverse()
              }
              neighbors.forEach((neighbor) => {
                const nx = current.gx + neighbor.gx
                const ny = current.gy + neighbor.gy
                if (nx < 0 || ny < 0 || nx >= gridWidth || ny >= gridHeight) return
                if (blocked[ny][nx]) return
                const tentative = gScore[current.gy][current.gx] + neighbor.cost
                if (tentative < gScore[ny][nx]) {
                  gScore[ny][nx] = tentative
                  const next = { gx: nx, gy: ny }
                  cameFrom.set(key(next), current)
                  if (!open.some((node) => node.gx === nx && node.gy === ny)) {
                    open.push(next)
                  }
                }
              })
            }
            return null
          }
          const makePathPoints = () => {
            const attempts = 12
            for (let attempt = 0; attempt < attempts; attempt += 1) {
              const leftToRight = Math.random() < 0.5
              const start = leftToRight
                ? { x: 0.2, y: 2 + Math.random() * (board.height - 4) }
                : { x: 2 + Math.random() * (board.width - 4), y: 0.2 }
              const end = leftToRight
                ? { x: board.width - 0.2, y: 2 + Math.random() * (board.height - 4) }
                : { x: 2 + Math.random() * (board.width - 4), y: board.height - 0.2 }
              const startGrid = findNearestFree(toGrid(start))
              const endGrid = findNearestFree(toGrid(end))
              const path = aStar(startGrid, endGrid)
              if (!path) continue
              return path.map((node) => toWorld(node.gx, node.gy))
            }
            return []
          }

          const drawSoftPath = (ctx, points, widthPx, color, blur) => {
            if (points.length < 2) return
            ctx.save()
            ctx.lineCap = 'round'
            ctx.lineJoin = 'round'
            ctx.strokeStyle = color
            ctx.lineWidth = widthPx
            ctx.shadowColor = color
            ctx.shadowBlur = blur
            const canvasPoints = points.map((point) => toCanvasPoint(point))
            ctx.beginPath()
            ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y)
            for (let i = 1; i < canvasPoints.length; i += 1) {
              ctx.lineTo(canvasPoints[i].x, canvasPoints[i].y)
            }
            ctx.stroke()
            ctx.restore()
          }

          const baseWidth = (width / board.width) * 1.5
          for (let i = 0; i < 3; i += 1) {
            const pathPoints = makePathPoints()
            if (!pathPoints.length) continue
            drawSoftPath(
              offscreenContext,
              pathPoints,
              baseWidth,
              'rgba(95, 60, 35, 0.18)',
              baseWidth * 0.02,
            )
            drawSoftPath(
              offscreenContext,
              pathPoints,
              baseWidth * 0.6,
              'rgba(120, 85, 55, 0.45)',
              baseWidth * 0.01,
            )
            drawSoftPath(
              offscreenContext,
              pathPoints,
              baseWidth * 0.3,
              'rgba(120, 85, 55, 0.5)',
              0,
            )
          }
        }
      }

      if (style.mode === 'rain') {
        const puddleCanvas = document.createElement('canvas')
        const puddleContext = puddleCanvas.getContext('2d')
        if (puddleContext) {
          puddleCanvas.width = width
          puddleCanvas.height = height
          const puddleShapes = []
          const drawSmoothPuddle = (ctx, vertices) => {
            const first = vertices[0]
            const second = vertices[1] || first
            ctx.beginPath()
            ctx.moveTo((first.x + second.x) / 2, (first.y + second.y) / 2)
            for (let p = 1; p < vertices.length; p += 1) {
              const current = vertices[p]
              const next = vertices[(p + 1) % vertices.length]
              const midX = (current.x + next.x) / 2
              const midY = (current.y + next.y) / 2
              ctx.quadraticCurveTo(current.x, current.y, midX, midY)
            }
            ctx.closePath()
          }

          for (let i = 0; i < 24; i += 1) {
            const puddleX = Math.random() * width
            const puddleY = Math.random() * height
            const puddleW = 40 + Math.random() * 120
            const puddleH = 24 + Math.random() * 80
            const points = 8 + Math.floor(Math.random() * 6)
            const baseRadius = Math.min(puddleW, puddleH) * 0.5
            const angleOffset = Math.random() * Math.PI * 2
            const vertices = []
            for (let p = 0; p < points; p += 1) {
              const angle = angleOffset + (p / points) * Math.PI * 2
              const radiusJitter = 0.65 + Math.random() * 0.6
              const radiusX = baseRadius * (puddleW / Math.max(1, puddleH))
              const radiusY = baseRadius
              vertices.push({
                x: puddleX + Math.cos(angle) * radiusX * radiusJitter,
                y: puddleY + Math.sin(angle) * radiusY * radiusJitter,
              })
            }
            puddleShapes.push(vertices)
          }

          puddleContext.fillStyle = 'rgba(255, 255, 255, 1)'
          puddleShapes.forEach((vertices) => {
            drawSmoothPuddle(puddleContext, vertices)
            puddleContext.fill()
          })

          puddleContext.globalCompositeOperation = 'source-in'
          puddleContext.fillStyle = 'rgba(6, 10, 14, 0.6)'
          puddleContext.fillRect(0, 0, width, height)
          puddleContext.globalCompositeOperation = 'source-over'
          puddleContext.strokeStyle = 'rgba(4, 8, 12, 0.85)'
          puddleContext.lineWidth = 1.8
          puddleShapes.forEach((vertices) => {
            drawSmoothPuddle(puddleContext, vertices)
            puddleContext.stroke()
          })
          puddleContext.strokeStyle = 'rgba(90, 120, 140, 0.25)'
          puddleContext.lineWidth = 1
          puddleShapes.forEach((vertices) => {
            drawSmoothPuddle(puddleContext, vertices)
            puddleContext.stroke()
          })

          offscreenContext.drawImage(puddleCanvas, 0, 0)
        }
      }

      if (noisePattern) {
        offscreenContext.fillStyle = noisePattern
        offscreenContext.globalAlpha = style.noiseAlpha
        offscreenContext.fillRect(0, 0, width, height)
        offscreenContext.globalAlpha = 1
      }

      if (style.mode === 'rain') {
        for (let i = 0; i < 4; i += 1) {
          const patchX = Math.random() * width
          const patchY = Math.random() * height
          const patchRadius = 320 + Math.random() * 520
          const patchGradient = offscreenContext.createRadialGradient(
            patchX,
            patchY,
            patchRadius * 0.2,
            patchX,
            patchY,
            patchRadius,
          )
          patchGradient.addColorStop(0, 'rgba(10, 12, 14, 0.5)')
          patchGradient.addColorStop(1, 'rgba(4, 6, 8, 0)')
          offscreenContext.fillStyle = patchGradient
          offscreenContext.beginPath()
          offscreenContext.arc(patchX, patchY, patchRadius, 0, Math.PI * 2)
          offscreenContext.fill()
        }

        offscreenContext.save()
        const rubbleDots = []
        for (let i = 0; i < 60; i += 1) {
          const startX = Math.random() * width
          const startY = Math.random() * height
          const segments = 2 + Math.floor(Math.random() * 3)
          let currentX = startX
          let currentY = startY
          let angle = Math.random() * Math.PI * 2
          offscreenContext.beginPath()
          offscreenContext.moveTo(currentX, currentY)
          for (let s = 0; s < segments; s += 1) {
            const length = 4 + Math.random() * 10
            angle += (-0.35 + Math.random() * 0.7)
            currentX += Math.cos(angle) * length
            currentY += Math.sin(angle) * length
            offscreenContext.lineTo(currentX, currentY)

            if (Math.random() < 0.25) {
              const branchAngle = angle + (-0.8 + Math.random() * 1.6)
              const branchLength = 4 + Math.random() * 10
              offscreenContext.moveTo(currentX, currentY)
              offscreenContext.lineTo(
                currentX + Math.cos(branchAngle) * branchLength,
                currentY + Math.sin(branchAngle) * branchLength,
              )
              offscreenContext.moveTo(currentX, currentY)
            }

            if (Math.random() < 0.6) {
              const rubbleCount = 1 + Math.floor(Math.random() * 3)
              for (let r = 0; r < rubbleCount; r += 1) {
                rubbleDots.push({
                  x: currentX + (-6 + Math.random() * 12),
                  y: currentY + (-6 + Math.random() * 12),
                  size: 1 + Math.random() * 2.4,
                })
              }
            }
          }
          offscreenContext.strokeStyle = 'rgba(8, 10, 12, 0.5)'
          offscreenContext.lineWidth = 1 + Math.random() * 0.6
          offscreenContext.stroke()
        }
        offscreenContext.fillStyle = 'rgba(12, 14, 16, 0.55)'
        rubbleDots.forEach((dot) => {
          offscreenContext.fillRect(dot.x, dot.y, dot.size, dot.size)
        })

        offscreenContext.fillStyle = 'rgba(10, 12, 14, 0.65)'
        for (let i = 0; i < 16; i += 1) {
          const chunkX = Math.random() * width
          const chunkY = Math.random() * height
          const chunkW = 6 + Math.random() * 10
          const chunkH = 4 + Math.random() * 8
          offscreenContext.save()
          offscreenContext.translate(chunkX, chunkY)
          offscreenContext.rotate(Math.random() * Math.PI)
          offscreenContext.fillRect(-chunkW / 2, -chunkH / 2, chunkW, chunkH)
          offscreenContext.restore()
        }

        for (let i = 0; i < 6; i += 1) {
          const pileX = Math.random() * width
          const pileY = Math.random() * height
          const pileSize = 22 + Math.random() * 40
          const pileCount = 14 + Math.floor(Math.random() * 18)
          offscreenContext.fillStyle = 'rgba(8, 10, 12, 0.6)'
          for (let p = 0; p < pileCount; p += 1) {
            const offsetX = (-0.5 + Math.random()) * pileSize
            const offsetY = (-0.5 + Math.random()) * pileSize
            const chipW = 4 + Math.random() * 8
            const chipH = 3 + Math.random() * 6
            offscreenContext.save()
            offscreenContext.translate(pileX + offsetX, pileY + offsetY)
            offscreenContext.rotate(Math.random() * Math.PI)
            offscreenContext.fillRect(-chipW / 2, -chipH / 2, chipW, chipH)
            offscreenContext.restore()
          }
        }
        offscreenContext.restore()

      }

      for (let i = 0; i < 18; i += 1) {
        const blotchX = Math.random() * width
        const blotchY = Math.random() * height
        const blotchRadius = 40 + Math.random() * 120
        const blotchGradient = offscreenContext.createRadialGradient(
          blotchX,
          blotchY,
          blotchRadius * 0.2,
          blotchX,
          blotchY,
          blotchRadius,
        )
        blotchGradient.addColorStop(0, 'rgba(255, 255, 255, 0.02)')
        blotchGradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
        offscreenContext.fillStyle = blotchGradient
        offscreenContext.beginPath()
        offscreenContext.arc(blotchX, blotchY, blotchRadius, 0, Math.PI * 2)
        offscreenContext.fill()
      }


      if (style.sand) {
        offscreenContext.fillStyle = 'rgba(255, 224, 170, 0.14)'
        for (let i = 0; i < 320; i += 1) {
          const speckX = Math.random() * width
          const speckY = Math.random() * height
          const speckSize = Math.random() * 1.4
          offscreenContext.fillRect(speckX, speckY, speckSize, speckSize)
        }

        offscreenContext.fillStyle = 'rgba(70, 60, 45, 0.35)'
        for (let i = 0; i < 520; i += 1) {
          const rubbleX = Math.random() * width
          const rubbleY = Math.random() * height
          const rubbleSize = 1 + Math.random() * 2.6
          offscreenContext.fillRect(rubbleX, rubbleY, rubbleSize, rubbleSize)
        }

        offscreenContext.fillStyle = 'rgba(60, 50, 36, 0.45)'
        for (let i = 0; i < 80; i += 1) {
          const chunkX = Math.random() * width
          const chunkY = Math.random() * height
          const chunkW = 4 + Math.random() * 12
          const chunkH = 3 + Math.random() * 10
          offscreenContext.save()
          offscreenContext.translate(chunkX, chunkY)
          offscreenContext.rotate(Math.random() * Math.PI)
          offscreenContext.fillRect(-chunkW / 2, -chunkH / 2, chunkW, chunkH)
          offscreenContext.restore()
        }

        offscreenContext.fillStyle = 'rgba(54, 44, 32, 0.55)'
        for (let i = 0; i < 26; i += 1) {
          const boulderX = Math.random() * width
          const boulderY = Math.random() * height
          const boulderW = 14 + Math.random() * 26
          const boulderH = 10 + Math.random() * 22
          offscreenContext.save()
          offscreenContext.translate(boulderX, boulderY)
          offscreenContext.rotate(Math.random() * Math.PI)
          offscreenContext.fillRect(-boulderW / 2, -boulderH / 2, boulderW, boulderH)
          offscreenContext.restore()
        }

        for (let i = 0; i < 12; i += 1) {
          const pileX = Math.random() * width
          const pileY = Math.random() * height
          const pileSize = 36 + Math.random() * 60
          const pileCount = 24 + Math.floor(Math.random() * 30)
          offscreenContext.fillStyle = 'rgba(50, 42, 30, 0.6)'
          for (let p = 0; p < pileCount; p += 1) {
            const offsetX = (-0.5 + Math.random()) * pileSize
            const offsetY = (-0.5 + Math.random()) * pileSize
            const chipW = 6 + Math.random() * 14
            const chipH = 4 + Math.random() * 12
            offscreenContext.save()
            offscreenContext.translate(pileX + offsetX, pileY + offsetY)
            offscreenContext.rotate(Math.random() * Math.PI)
            offscreenContext.fillRect(-chipW / 2, -chipH / 2, chipW, chipH)
            offscreenContext.restore()
          }
        }
      }

      if (style.grass) {
        offscreenContext.fillStyle = 'rgba(40, 110, 46, 0.28)'
        for (let i = 0; i < 240; i += 1) {
          const bladeX = Math.random() * width
          const bladeY = Math.random() * height
          const bladeLength = 6 + Math.random() * 12
          offscreenContext.fillRect(bladeX, bladeY, 0.8, bladeLength)
        }
        offscreenContext.fillStyle = 'rgba(18, 60, 26, 0.18)'
        for (let i = 0; i < 40; i += 1) {
          const tuftX = Math.random() * width
          const tuftY = Math.random() * height
          const tuftW = 8 + Math.random() * 22
          const tuftH = 4 + Math.random() * 12
          offscreenContext.save()
          offscreenContext.translate(tuftX, tuftY)
          offscreenContext.rotate(Math.random() * Math.PI)
          offscreenContext.fillRect(-tuftW / 2, -tuftH / 2, tuftW, tuftH)
          offscreenContext.restore()
        }
      }
    }

    const getWindPoint = (streak, t) => {
      const clamped = Math.max(0, Math.min(1, t))
      const startX = -width * 2.2
      const spanX = width * 8.4
      const x = startX + spanX * clamped
      const y =
        streak.baseY +
        Math.sin(clamped * Math.PI * 2 * streak.curl + streak.phaseA) *
          streak.amplitude +
        Math.sin(clamped * Math.PI * 2 * streak.curl * 1.7 + streak.phaseB) *
          streak.amplitude * 0.35
      return { x, y }
    }

    const randomRange = (min, max) => min + Math.random() * (max - min)

    const buildEffectState = () => {
      const streakCount = style.sand ? 84 : 18
      const lengthBase = style.sand ? 160 : 80
      const lengthRange = style.sand ? 260 : 160
      const speedBase = style.sand ? 10 : 6
      const speedRange = style.sand ? 18 : 14
      const thicknessBase = style.sand ? 0.8 : 1
      const thicknessRange = style.sand ? 1.2 : 2
      effectState.streaks = Array.from({ length: streakCount }).map(() => {
        const baseY = Math.random() * height
        const amplitude = style.sand ? 22 + Math.random() * 42 : 6 + Math.random() * 14
        const curl = style.sand ? 1.6 + Math.random() * 2.2 : 0.8 + Math.random() * 1.2
        const phaseA = Math.random() * Math.PI * 2
        const phaseB = Math.random() * Math.PI * 2
        const grainCount = style.sand ? 6 + Math.floor(Math.random() * 6) : 0
        return {
          length: lengthBase + Math.random() * lengthRange,
          speed: speedBase + Math.random() * speedRange,
          thickness: thicknessBase + Math.random() * thicknessRange,
          baseY,
          amplitude,
          curl,
          phaseA,
          phaseB,
          progress: Math.random(),
          grainOffsets: Array.from({ length: grainCount }).map(() => ({
            tOffset: Math.random(),
            jitterX: -12 + Math.random() * 24,
            jitterY: -8 + Math.random() * 16,
            size: 0.8 + Math.random() * 1.8,
          })),
        }
      })
      effectState.particles = Array.from({ length: 24 }).map(() => ({
        x: Math.random() * width,
        y: height + Math.random() * height,
        vx: -8 + Math.random() * 16,
        vy: -22 - Math.random() * 20,
        life: Math.random() * 1,
      }))
      effectState.drops = Array.from({ length: 120 }).map(() => ({
        x: Math.random() * width,
        y: Math.random() * height,
        length: 14 + Math.random() * 26,
        speed: 420 + Math.random() * 380,
        thickness: 0.6 + Math.random() * 0.8,
        targetY: Math.random() * height,
        tilt: -0.6 + Math.random() * 1.2,
        drift: 0,
      }))
      effectState.splashes = []
      effectState.impacts = []
      effectState.rainStreaks = Array.from({ length: 160 }).map(() => ({
        x: Math.random() * width,
        y: Math.random() * height,
        length: 18 + Math.random() * 26,
        speed: 140 + Math.random() * 180,
        tilt: -1 + Math.random() * 2,
        targetY: Math.random() * height,
        alpha: 0.06 + Math.random() * 0.08,
      }))
      effectState.fogClouds = style.mode === 'pulse'
        ? Array.from({ length: 40 }).map(() => ({
            x: Math.random() * width,
            y: Math.random() * height,
            radius: 240 + Math.random() * 360,
            driftX: -5.5 + Math.random() * 11,
            driftY: -4.5 + Math.random() * 9,
            glow: 0.22 + Math.random() * 0.22,
            isDark: Math.random() < 0.2,
            billows: Array.from({ length: 3 }).map(() => ({
              angle: Math.random() * Math.PI * 2,
              offset: 0.12 + Math.random() * 0.22,
              radiusScale: 0.55 + Math.random() * 0.3,
            })),
            specks: Array.from({ length: 14 }).map(() => ({
              dx: -1 + Math.random() * 2,
              dy: -1 + Math.random() * 2,
              size: 2 + Math.random() * 5,
              alpha: 0.05 + Math.random() * 0.08,
            })),
          }))
        : []
      effectState.fogCenter = { x: width * 0.5, y: height * 0.5 }
      effectState.fogFade = {
        phase: 'fading-in',
        phaseStart: 0,
        phaseDuration: 90,
        nextFadeAllowedAt: 900,
      }
      effectState.rainAccumulator = 0
      effectState.pulseOrigin = {
        x: 0.25 + Math.random() * 0.5,
        y: 0.25 + Math.random() * 0.5,
      }
    }

    const getFogFadeFactor = (timeSeconds) => {
      if (!effectState.fogFade) {
        effectState.fogFade = {
          phase: 'fading-in',
          phaseStart: timeSeconds,
          phaseDuration: 90,
          nextFadeAllowedAt: timeSeconds + 900,
        }
      }
      const fade = effectState.fogFade
      const elapsed = timeSeconds - fade.phaseStart
      if (fade.phase === 'visible') {
        if (elapsed >= fade.phaseDuration && timeSeconds >= fade.nextFadeAllowedAt) {
          fade.phase = 'fading-out'
          fade.phaseStart = timeSeconds
          fade.phaseDuration = randomRange(60, 180)
        }
        return 1
      }
      if (fade.phase === 'fading-out') {
        const t = Math.min(1, elapsed / fade.phaseDuration)
        if (t >= 1) {
          fade.phase = 'hidden'
          fade.phaseStart = timeSeconds
          fade.phaseDuration = randomRange(20, 40)
        }
        return 1 - t
      }
      if (fade.phase === 'hidden') {
        if (elapsed >= fade.phaseDuration) {
          fade.phase = 'fading-in'
          fade.phaseStart = timeSeconds
          fade.phaseDuration = randomRange(30, 60)
        }
        return 0
      }
      if (fade.phase === 'fading-in') {
        const t = Math.min(1, elapsed / fade.phaseDuration)
        if (t >= 1) {
          fade.phase = 'visible'
          fade.phaseStart = timeSeconds
          fade.phaseDuration = randomRange(60, 180)
          fade.nextFadeAllowedAt = timeSeconds + 900
        }
        return t
      }
      return 1
    }

    const renderFog = (deltaSeconds, timeSeconds, ctx = context, fadeFactor = 1) => {
      if (!effectState.fogClouds.length) return
      const fogAlpha = 0.35 * fadeFactor
      let centerX = 0
      let centerY = 0
      effectState.fogClouds.forEach((cloud) => {
        cloud.x += cloud.driftX * deltaSeconds
        cloud.y += cloud.driftY * deltaSeconds
        if (cloud.x < -cloud.radius) cloud.x = width + cloud.radius
        if (cloud.x > width + cloud.radius) cloud.x = -cloud.radius
        if (cloud.y < -cloud.radius) cloud.y = height + cloud.radius
        if (cloud.y > height + cloud.radius) cloud.y = -cloud.radius
        centerX += cloud.x
        centerY += cloud.y
      })
      effectState.fogCenter = {
        x: centerX / effectState.fogClouds.length,
        y: centerY / effectState.fogClouds.length,
      }
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.globalAlpha = fogAlpha
      effectState.fogClouds.forEach((cloud) => {
        const gradient = ctx.createRadialGradient(
          cloud.x,
          cloud.y,
          cloud.radius * 0.1,
          cloud.x,
          cloud.y,
          cloud.radius,
        )
        if (cloud.isDark) {
          gradient.addColorStop(0, `rgba(5, 5, 5, ${cloud.glow * 1.2})`)
          gradient.addColorStop(1, 'rgba(5, 5, 5, 0.16)')
        } else {
          gradient.addColorStop(0, `rgba(35, 70, 140, ${cloud.glow * 0.4})`)
          gradient.addColorStop(1, 'rgba(35, 70, 140, 0.012)')
        }
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2)
        ctx.fill()

        if (cloud.billows) {
          cloud.billows.forEach((billow) => {
            const angle = billow.angle + timeSeconds * 0.08
            const offset = cloud.radius * billow.offset
            const bx = cloud.x + Math.cos(angle) * offset
            const by = cloud.y + Math.sin(angle) * offset
            const billowRadius = cloud.radius * billow.radiusScale
            const billowGradient = ctx.createRadialGradient(
              bx,
              by,
              billowRadius * 0.15,
              bx,
              by,
              billowRadius,
            )
            if (cloud.isDark) {
              billowGradient.addColorStop(0, `rgba(8, 8, 8, ${cloud.glow * 0.6})`)
              billowGradient.addColorStop(1, 'rgba(8, 8, 8, 0.05)')
            } else {
              billowGradient.addColorStop(0, `rgba(45, 85, 155, ${cloud.glow * 0.24})`)
              billowGradient.addColorStop(1, 'rgba(45, 85, 155, 0.01)')
            }
            ctx.fillStyle = billowGradient
            ctx.beginPath()
            ctx.arc(bx, by, billowRadius, 0, Math.PI * 2)
            ctx.fill()
          })
        }

        ctx.fillStyle = cloud.isDark
          ? 'rgba(55, 70, 65, 0.16)'
          : 'rgba(70, 110, 165, 0.06)'
        const groupAngle = timeSeconds * 1.8 + (cloud.x + cloud.y) * 0.002
        const groupRadius = cloud.radius * 0.08
        const groupX = cloud.x + Math.cos(groupAngle) * groupRadius
        const groupY = cloud.y + Math.sin(groupAngle) * groupRadius
        const swirlAngle = timeSeconds * 2.4 + (cloud.x - cloud.y) * 0.003
        cloud.specks.forEach((speck) => {
          const jitterX = Math.sin(timeSeconds + speck.dx * 12) * 6
          const jitterY = Math.cos(timeSeconds + speck.dy * 9) * 6
          ctx.globalAlpha = fogAlpha * speck.alpha * (cloud.isDark ? 0.7 : 1.1)
          ctx.beginPath()
          ctx.arc(
            cloud.x + jitterX + speck.dx * cloud.radius * 0.4,
            cloud.y + jitterY + speck.dy * cloud.radius * 0.4,
            speck.size,
            0,
            Math.PI * 2,
          )

          ctx.fill()
        })
        ctx.globalAlpha = fogAlpha
      })
      ctx.restore()
    }

    const renderWind = (deltaSeconds) => {
      const ctx = windContext || context
      ctx.save()
      const windStroke = style.sand
        ? 'rgba(220, 200, 160, 0.35)'
        : style.accent
      ctx.strokeStyle = windStroke
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.shadowColor = windStroke
      ctx.shadowBlur = style.sand ? 90 : 6
      ctx.globalAlpha = style.sand ? 0.03 : 1
      const sandGrain = 'rgba(225, 205, 160, 0.32)'
      ctx.fillStyle = sandGrain
      const speedFactor = style.sand ? 0.65 : 1
      const isSand = style.sand
      const buildWindPoints = (streak, startT, tipT, segments) => {
        const points = []
        const span = tipT - startT
        for (let i = 0; i <= segments; i += 1) {
          const t = startT + (span * i) / segments
          points.push(getWindPoint(streak, t))
        }
        return points
      }
      const drawWindCurve = (points) => {
        if (points.length < 2) return
        ctx.beginPath()
        ctx.moveTo(points[0].x, points[0].y)
        for (let i = 1; i < points.length; i += 1) {
          const prev = points[i - 1]
          const current = points[i]
          const midX = (prev.x + current.x) / 2
          const midY = (prev.y + current.y) / 2
          ctx.quadraticCurveTo(prev.x, prev.y, midX, midY)
        }
        const last = points[points.length - 1]
        ctx.lineTo(last.x, last.y)
      }
      effectState.streaks.forEach((streak) => {
        const progressDelta =
          (streak.speed * speedFactor * deltaSeconds) / (width * 0.55)
        streak.progress += progressDelta
        if (streak.progress > 1.2) {
          const baseY = Math.random() * height
          const amplitude = style.sand
            ? 22 + Math.random() * 42
            : 6 + Math.random() * 14
          const curl = style.sand ? 1.6 + Math.random() * 2.2 : 0.8 + Math.random() * 1.2
          const phaseA = Math.random() * Math.PI * 2
          const phaseB = Math.random() * Math.PI * 2
          streak.progress = -Math.random() * 0.2
          streak.baseY = baseY
          streak.amplitude = amplitude
          streak.curl = curl
          streak.phaseA = phaseA
          streak.phaseB = phaseB
          if (isSand) {
            const grainCount = 6 + Math.floor(Math.random() * 6)
            streak.grainOffsets = Array.from({ length: grainCount }).map(() => ({
              tOffset: Math.random(),
              jitterX: -12 + Math.random() * 24,
              jitterY: -8 + Math.random() * 16,
              size: 0.8 + Math.random() * 1.8,
            }))
          }
        }
        ctx.lineWidth = isSand ? streak.thickness * 7.2 : streak.thickness
        const tipT = Math.max(0, Math.min(1, streak.progress))
        const trailSpan = Math.max(
          0.05,
          Math.min(0.6, streak.length / (width * 1.6) + 0.25),
        )
        const startT = Math.max(0, tipT - trailSpan)
        const segments = isSand
          ? Math.max(36, Math.round(streak.length / 3))
          : Math.max(60, Math.round(streak.length / 1.6))
        const points = buildWindPoints(streak, startT, tipT, segments)
        const startPoint = points[0]
        const tip = points[points.length - 1]
        drawWindCurve(points)
        ctx.stroke()

        if (isSand) {
          ctx.save()
          ctx.globalAlpha = 0.18
          ctx.strokeStyle = 'rgba(235, 215, 175, 0.18)'
          ctx.lineWidth = streak.thickness * 2.2
          ctx.setLineDash([18, 26])
          drawWindCurve(points)
          ctx.stroke()
          ctx.setLineDash([])
          ctx.restore()
        }

        if (isSand) {
          ctx.save()
          ctx.globalAlpha = 0.3
          ctx.shadowBlur = 0
          ctx.fillStyle = 'rgba(235, 215, 175, 0.35)'
          for (let i = 0; i < points.length; i += 4) {
            const grain = points[i]
            const jitterX = -2 + Math.random() * 4
            const jitterY = -2 + Math.random() * 4
            const size = 0.6 + Math.random() * 1.2
            ctx.fillRect(grain.x + jitterX, grain.y + jitterY, size, size)
          }
          ctx.restore()
        }

        if (isSand) {
          ctx.save()
          ctx.globalAlpha = 0.25
          ctx.shadowColor = 'rgba(220, 200, 160, 0.35)'
          ctx.shadowBlur = 150
          ctx.lineWidth = streak.thickness * 12
          ctx.strokeStyle = 'rgba(210, 190, 150, 0.18)'
          drawWindCurve(points)
          ctx.stroke()
          ctx.restore()
        }

        if (isSand) {
          const span = Math.max(0.001, tipT - startT)
          ctx.save()
          ctx.globalAlpha = 0.5
          ctx.shadowColor = 'rgba(230, 210, 170, 0.4)'
          ctx.shadowBlur = 30
          streak.grainOffsets.forEach((grainOffset) => {
            const t = startT + grainOffset.tOffset * span
            const grain = getWindPoint(streak, t)
            ctx.fillRect(
              grain.x + grainOffset.jitterX,
              grain.y + grainOffset.jitterY,
              grainOffset.size,
              grainOffset.size,
            )
          })
          ctx.globalAlpha = 0.18
          ctx.shadowBlur = 44
          streak.grainOffsets.forEach((grainOffset) => {
            const t = startT + grainOffset.tOffset * span
            const grain = getWindPoint(streak, t)
            const size = grainOffset.size * 2.2
            ctx.fillRect(
              grain.x + grainOffset.jitterX * 1.6,
              grain.y + grainOffset.jitterY * 1.6,
              size,
              size,
            )
          })
          ctx.restore()
        }
      })
      ctx.globalAlpha = 1
      ctx.restore()
    }

    const renderSparks = (deltaSeconds) => {
      effectState.particles.forEach((particle) => {
        particle.x += particle.vx * deltaSeconds
        particle.y += particle.vy * deltaSeconds
        particle.life -= deltaSeconds * 0.6
        if (particle.y < -20 || particle.life <= 0) {
          particle.x = Math.random() * width
          particle.y = height + Math.random() * height * 0.4
          particle.vx = -12 + Math.random() * 24
          particle.vy = -22 - Math.random() * 26
          particle.life = 0.6 + Math.random() * 0.6
        }
        context.fillStyle = `rgba(255, 188, 120, ${0.08 + particle.life * 0.3})`
        context.beginPath()
        context.arc(particle.x, particle.y, 1.2 + particle.life * 1.6, 0, Math.PI * 2)
        context.fill()
      })
    }

    const renderRain = (deltaSeconds) => {
      const spawnRate = 160
      effectState.rainAccumulator += deltaSeconds * spawnRate
      while (effectState.rainAccumulator >= 1) {
        effectState.rainAccumulator -= 1
        effectState.impacts.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: 1 + Math.random() * 2,
          life: 0.6 + Math.random() * 0.4,
        })
      }

      context.strokeStyle = 'rgba(170, 190, 205, 0.3)'
      context.fillStyle = 'rgba(205, 235, 225, 0.22)'
      effectState.impacts = effectState.impacts.filter((impact) => {
        impact.life -= deltaSeconds * 2
        if (impact.life <= 0) return false
        const expansion = 1 - impact.life
        const rippleRadius = impact.radius + expansion * 6
        context.globalAlpha = impact.life
        context.beginPath()
        context.arc(impact.x, impact.y, rippleRadius, 0, Math.PI * 2)
        context.stroke()
        context.beginPath()
        context.arc(impact.x, impact.y, Math.max(0.3, impact.life * 1.1), 0, Math.PI * 2)
        context.fill()
        return true
      })
      context.globalAlpha = 1

      context.lineCap = 'round'
      effectState.rainStreaks.forEach((streak) => {
        streak.y += streak.speed * deltaSeconds
        streak.x += streak.tilt * streak.speed * deltaSeconds * 0.02
        if (streak.y >= streak.targetY) {
          effectState.impacts.push({
            x: streak.x,
            y: streak.targetY,
            radius: 1 + Math.random() * 2,
            life: 0.6 + Math.random() * 0.4,
          })
          streak.y = -Math.random() * height * 0.2
          streak.x = Math.random() * width
          streak.targetY = Math.random() * height
        }
        if (streak.x < -20 || streak.x > width + 20) {
          streak.x = Math.random() * width
        }
        context.strokeStyle = `rgba(190, 210, 225, ${streak.alpha})`
        context.lineWidth = 0.75
        context.beginPath()
        context.moveTo(streak.x, streak.y)
        context.lineTo(streak.x - streak.tilt, streak.y - streak.length)
        context.stroke()
      })

    }

    const renderPulse = (timeSeconds, ctx = context, fadeFactor = 1) => {
      const pulse = 0.2 + Math.sin(timeSeconds * 0.6) * 0.12
      const centerX = effectState.fogCenter?.x ?? width * effectState.pulseOrigin.x
      const centerY = effectState.fogCenter?.y ?? height * effectState.pulseOrigin.y
      const radius = Math.max(width, height) * 0.7
      const gradient = ctx.createRadialGradient(
        centerX,
        centerY,
        radius * 0.1,
        centerX,
        centerY,
        radius,
      )
      gradient.addColorStop(0, `rgba(40, 80, 150, ${pulse})`)
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.save()
      ctx.globalAlpha = 0.02 * fadeFactor
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    const drawFrame = (time) => {
      if (!width || !height) return
      const timeSeconds = time / 1000
      const deltaSeconds = lastTime ? (time - lastTime) / 1000 : 0
      lastTime = time

      context.clearRect(0, 0, width, height)
      if (windContext) {
        windContext.clearRect(0, 0, width, height)
      }
      if (fogContext) {
        fogContext.clearRect(0, 0, width, height)
      }
      if (offscreen.width && offscreen.height) {
        context.drawImage(offscreen, 0, 0, width, height)
      }

      if (style.mode === 'wind') {
        renderWind(deltaSeconds)
      }
      if (style.mode === 'sparks') {
        renderSparks(deltaSeconds)
      }
      if (style.mode === 'rain') {
        renderRain(deltaSeconds)
      }
      if (style.mode === 'pulse') {
        const targetContext = fogContext || context
        const fogFade = getFogFadeFactor(timeSeconds)
        renderFog(deltaSeconds, timeSeconds, targetContext, fogFade)
        renderPulse(timeSeconds, targetContext, fogFade)
      }

      animationFrame = requestAnimationFrame(drawFrame)
    }

    const resize = () => {
      const rect = frame.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      width = Math.max(1, rect.width)
      height = Math.max(1, rect.height)
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      if (windCanvas) {
        windCanvas.width = Math.floor(width * dpr)
        windCanvas.height = Math.floor(height * dpr)
        windCanvas.style.width = `${width}px`
        windCanvas.style.height = `${height}px`
      }
      if (fogCanvas) {
        fogCanvas.width = Math.floor(width * dpr)
        fogCanvas.height = Math.floor(height * dpr)
        fogCanvas.style.width = `${width}px`
        fogCanvas.style.height = `${height}px`
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (windContext) {
        windContext.setTransform(dpr, 0, 0, dpr, 0, 0)
      }
      if (fogContext) {
        fogContext.setTransform(dpr, 0, 0, dpr, 0, 0)
      }
      buildBaseTexture()
      buildEffectState()
    }

    resize()
    animationFrame = requestAnimationFrame(drawFrame)

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(frame)

    return () => {
      cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
    }
  }, [activeTextureIndex, activeMap?.id, textureStyles, arrangementIndex])

  const advanceArrangement = () => {
    if (!mapArrangements.length) return
    setArrangementIndex((prev) => (prev + 1) % mapArrangements.length)
  }

  const toggleToolMode = (mode) => {
    setToolMode((prev) => (prev === mode ? 'none' : mode))
  }

  const clearActiveTool = () => {
    window.dispatchEvent(new CustomEvent('kt-clear-tools'))
  }

  useEffect(() => {
    const isEditableTarget = (target) => {
      if (!target) return false
      if (target.isContentEditable) return true
      const tagName = target.tagName
      return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT'
    }

    const cycleOrder = ['none', 'sight', 'measure', 'fov']

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isEditableTarget(event.target)) {
        event.preventDefault()
        window.dispatchEvent(new CustomEvent('kt-clear-tools'))
        if (toolMode === 'measure' || toolMode === 'sight' || toolMode === 'fov') {
          return
        }
        setToolMode('none')
        return
      }
      if (
        event.code === 'Slash' &&
        !event.repeat &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !isEditableTarget(event.target)
      ) {
        event.preventDefault()
        setShowMapTooltips((prev) => !prev)
        return
      }
      if (
        !event.repeat &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !isEditableTarget(event.target) &&
        (event.code === 'Comma' || event.key === ',' || event.key === '<')
      ) {
        event.preventDefault()
        setCurrentRuleIndex((prev) => (prev - 1 + totalRules) % totalRules)
        return
      }
      if (
        !event.repeat &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !isEditableTarget(event.target) &&
        (event.code === 'Period' || event.key === '.' || event.key === '>')
      ) {
        event.preventDefault()
        setCurrentRuleIndex((prev) => (prev + 1) % totalRules)
        return
      }
      if (event.key !== 'Shift' || event.repeat || isEditableTarget(event.target)) {
        return
      }
      event.preventDefault()
      setToolMode((prev) => {
        const index = cycleOrder.indexOf(prev)
        const nextIndex = index >= 0 ? (index + 1) % cycleOrder.length : 1
        return cycleOrder[nextIndex]
      })
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toolMode, totalRules])

  const transformPoint = ([x, y], placement) => {
    const offsetX = placement?.x || 0
    const offsetY = placement?.y || 0
    const rotation = placement?.rotation || 0
    if (!rotation) return [x + offsetX, y + offsetY]
    const radians = (rotation * Math.PI) / 180
    const cos = Math.cos(radians)
    const sin = Math.sin(radians)
    const rotatedX = x * cos - y * sin
    const rotatedY = x * sin + y * cos
    return [rotatedX + offsetX, rotatedY + offsetY]
  }

  const renderPoints = (points, placement) =>
    points
      .map((point) => {
        const [x, y] = transformPoint(point, placement)
        return `${x},${y}`
      })
      .join(' ')

  const getPolygonCentroid = (points) => {
    if (!Array.isArray(points) || points.length < 3) return null
    let signedArea = 0
    let centroidX = 0
    let centroidY = 0

    for (let index = 0; index < points.length; index += 1) {
      const [x0, y0] = points[index]
      const [x1, y1] = points[(index + 1) % points.length]
      const cross = x0 * y1 - x1 * y0
      signedArea += cross
      centroidX += (x0 + x1) * cross
      centroidY += (y0 + y1) * cross
    }

    if (Math.abs(signedArea) < 1e-6) {
      const total = points.length
      const average = points.reduce(
        (accumulator, [x, y]) => {
          return { x: accumulator.x + x, y: accumulator.y + y }
        },
        { x: 0, y: 0 },
      )
      return { x: average.x / total, y: average.y / total }
    }

    const factor = 1 / (3 * signedArea)
    return {
      x: centroidX * factor,
      y: centroidY * factor,
    }
  }

  const getVantageText = (piece, areaIndex) => {
    const source = String(piece?.id || piece?.name || '')
    const match = source.match(/volkus_([A-D])$/i)
    if (!match) return null
    const letter = match[1].toUpperCase()
    if (letter === 'B' && areaIndex === 1) return 'VANTAGE 4"'
    return 'VANTAGE 2"'
  }

  const getPieceAreas = (piece) => {
    if (piece?.areas?.length) return piece.areas
    return piece?.area ? [piece.area] : []
  }

  const getPieceLabel = (piece) => {
    const source = piece?.name || piece?.id
    if (!source) return null
    const match = source.match(/volkus_([A-Za-z])$/)
    return match ? match[1].toUpperCase() : null
  }

  const resolveTerrainPiece = (entry) =>
    entry?.pieceId ? terrainPieceById.get(entry.pieceId) : entry

  const getWallClassName = (type) => {
    const normalized = ['heavy', 'light', 'door'].includes(type)
      ? type
      : 'heavy'
    return `board-wall board-wall-${normalized}`
  }

  const getSegmentType = (segment) =>
    Array.isArray(segment?.[0]) ? 'heavy' : segment?.type || 'heavy'

  const wallSegments = useMemo(() => {
    const segments = []
    ;(activeArrangement?.terrain ?? []).forEach((entry) => {
      const piece = resolveTerrainPiece(entry)
      if (!piece) return
      const placement = entry.placement
      ;(piece.walls?.segments ?? []).forEach((segment) => {
        const segmentType = getSegmentType(segment)
        if (!['heavy', 'door'].includes(segmentType)) return
        const segmentPoints = Array.isArray(segment?.[0])
          ? segment
          : segment?.segment
        if (!Array.isArray(segmentPoints)) return
        const [start, end] = segmentPoints
        const [x1, y1] = transformPoint(start, placement)
        const [x2, y2] = transformPoint(end, placement)
        segments.push({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 } })
      })
    })
    return segments
  }, [activeArrangement?.terrain])

  const selectedCritOpsCard = critOpsCards[selectedCardIndex] || null
  useEffect(() => {
    if (!selectedCritOpsCard?.opNumber) return
    const padded = String(selectedCritOpsCard.opNumber).padStart(2, '0')
    try {
      localStorage.setItem('kt-crit-op-src', `/images/critOps/critops_${padded}.png`)
      localStorage.setItem('kt-crit-op-label', `Crit Op ${selectedCritOpsCard.opNumber}`)
    } catch (error) {
      console.warn('Failed to store crit op selection.', error)
    }
  }, [selectedCritOpsCard])
  const toOpClass = (opNumber) => {
    if (!opNumber) return ''
    const padded = String(opNumber).padStart(2, '0')
    return ` is-op-${padded}`
  }

  const map1OpClass = toOpClass(selectedCritOpsCard?.opNumber)
  const map2OpClass = toOpClass(selectedCritOpsCard?.opNumber)
  const formatDebugTimestamp = (value) => {
    const parsed = Number(value || 0)
    if (!parsed) return 'n/a'
    return new Date(parsed).toLocaleTimeString()
  }
  const syncDebugLines = [
    `room: ${syncDebug.roomCode || 'n/a'}`,
    `playerId: ${syncDebug.playerId || 'n/a'}`,
    `name: ${syncDebug.playerName || 'n/a'}`,
    `gameId: ${syncDebug.activeGameId || 'n/a'}`,
    `isMap: ${syncDebug.isMapUser ? 'yes' : 'no'}`,
    `nonMapCount: ${syncDebug.nonMapCount}`,
    `hostId: ${syncDebug.hostId || 'n/a'}`,
    `players: ${syncDebug.players.length
      ? syncDebug.players
          .map((player) => `${player.name || 'unknown'}(${player.id.slice(0, 6)})`)
          .join(', ')
      : 'none'}`,
    `mapSocketState: ${syncDebug.mapSocketState || 'n/a'}`,
    `mapSocketEpoch: ${syncDebug.mapSocketEpoch}`,
    `mapSocketBoundRoom: ${syncDebug.mapSocketBoundRoom || 'n/a'}`,
    `mapSocketBoundPlayer: ${syncDebug.mapSocketBoundPlayerId || 'n/a'}`,
    `mapSocketLastType: ${syncDebug.mapSocketLastType || 'n/a'}`,
    `mapSocketMsgs: ${syncDebug.mapSocketMessageCount}`,
    `mapSocketRoomNotFoundCount: ${syncDebug.mapSocketRoomNotFoundCount}`,
    `mapSocketLastInstance: ${syncDebug.mapSocketLastInstanceId || 'n/a'}`,
    `mapSocketErrorInstance: ${syncDebug.mapSocketErrorInstanceId || 'n/a'}`,
    `mapSocketLastOutboundType: ${syncDebug.mapSocketLastOutboundType || 'n/a'}`,
    `mapSocketOutboundMsgs: ${syncDebug.mapSocketOutboundCount}`,
    `teams: ${Object.keys(syncDebug.teamIds).length
      ? Object.entries(syncDebug.teamIds)
          .map(([id, teamId]) => `${id.slice(0, 6)}:${teamId || '-'}`)
          .join(', ')
      : 'none'}`,
    `ploys: ${Object.keys(syncDebug.ploysByPlayerId).length
      ? Object.entries(syncDebug.ploysByPlayerId)
          .map(([id, count]) => `${id.slice(0, 6)}:${count}`)
          .join(', ')
      : 'none'}`,
    `zones stored: ${syncDebug.storedZones.player || '-'} / ${syncDebug.storedZones.opponent || '-'}`,
    `zones assigned: ${syncDebug.assignedZones.player || '-'} / ${syncDebug.assignedZones.opponent || '-'}`,
    `opponent cache: ${syncDebug.opponentCache ? 'yes' : 'no'}`,
    `mapSocketOpenedAt: ${formatDebugTimestamp(syncDebug.mapSocketOpenedAt)}`,
    `mapSocketLastAt: ${formatDebugTimestamp(syncDebug.mapSocketLastAt)}`,
    `mapSocketLastOutboundAt: ${formatDebugTimestamp(syncDebug.mapSocketLastOutboundAt)}`,
    `mapSocketClosedAt: ${formatDebugTimestamp(syncDebug.mapSocketClosedAt)}`,
    `mapSyncInitAt: ${formatDebugTimestamp(syncDebug.mapSocketSyncInitAt)}`,
    `mapSocketError: ${syncDebug.mapSocketError || 'n/a'}`,
    `updated: ${
      syncDebug.updatedAt
        ? new Date(syncDebug.updatedAt).toLocaleTimeString()
        : 'n/a'
    }`,
  ]
  const syncDebugText = syncDebugLines.join('\n')

  const handleCopySyncDebug = async () => {
    try {
      await navigator.clipboard.writeText(syncDebugText)
      setSyncDebugCopied(true)
      window.setTimeout(() => setSyncDebugCopied(false), 1500)
    } catch {
      setSyncDebugCopied(false)
    }
  }

  const handleToggleSyncDebug = () => {
    try {
      const nextEnabled = !syncDebug.enabled
      if (nextEnabled) {
        localStorage.setItem('kt-sync-debug', '1')
      } else {
        localStorage.removeItem('kt-sync-debug')
        const url = new URL(window.location.href)
        if (url.searchParams.get('syncDebug') === '1') {
          url.searchParams.delete('syncDebug')
          window.history.replaceState({}, '', url.toString())
        }
      }
      window.dispatchEvent(new StorageEvent('storage'))
      setSyncDebug((previous) => ({
        ...previous,
        enabled: nextEnabled,
        updatedAt: Date.now(),
      }))
    } catch (error) {
      console.warn('Failed to toggle sync debug mode.', error)
    }
  }

  return (
    <div className="board-view">
      <button
        type="button"
        className={`board-sync-debug-toggle${syncDebug.enabled ? ' is-active' : ''}`}
        onClick={handleToggleSyncDebug}
      >
        {syncDebug.enabled ? 'Debug On' : 'Debug'}
      </button>
      {syncDebug.enabled ? (
        <aside className="board-sync-debug" aria-live="polite">
          <div className="board-sync-debug__header">
            <div className="board-sync-debug__title">Sync Debug</div>
            <button
              type="button"
              className="board-sync-debug__copy"
              onClick={handleCopySyncDebug}
            >
              {syncDebugCopied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="board-sync-debug__text">{syncDebugText}</pre>
        </aside>
      ) : null}
      <div
        ref={boardSurfaceRef}
        className="board-surface"
        style={{ '--board-width': board.width, '--board-height': board.height }}
      >
        <div ref={boardFrameRef} className="board-frame">
          {showTextureWatermark ? (
            <div className="board-texture-watermark">
              {activeTexture?.label || 'Texture'}
            </div>
          ) : null}
          {toolWatermark ? (
            <div className="board-tool-watermark">{toolWatermark}</div>
          ) : null}
          {showMapTooltips ? (
            <div className="board-rules-nav">
              <button
                type="button"
                className="board-rules-nav__arrow board-rules-nav__arrow--prev"
                onClick={goToPreviousRule}
                aria-label={`Show previous rule: ${previousRuleTitle}`}
              >
                <span className="board-rules-nav__glyph">&lt;</span>
                <span className="board-rules-nav__label">{previousRuleTitle}</span>
              </button>
              <div className="board-rules-overlay">
                <div className="board-rules-overlay__section">
                  <div className="board-rules-overlay__item board-rules-overlay__item--list">
                    <strong>{currentRule.title}</strong>
                    <ul>
                      {(currentRule.bullets ?? []).map((bullet) => (
                        <li key={`${currentRule.title}-${bullet}`}>{bullet}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="board-rules-nav__arrow board-rules-nav__arrow--next"
                onClick={goToNextRule}
                aria-label={`Show next rule: ${nextRuleTitle}`}
              >
                <span className="board-rules-nav__glyph">&gt;</span>
                <span className="board-rules-nav__label">{nextRuleTitle}</span>
              </button>
            </div>
          ) : null}
          <canvas ref={boardTextureRef} className="board-texture-canvas" />
          <canvas ref={boardWindRef} className="board-wind-canvas" />
          <canvas ref={boardFogRef} className="board-fog-canvas" />
          {grid.enabled ? (
            <div
              className="board-grid"
              style={{ '--grid-cell': grid.cell }}
            />
          ) : null}
          {activeMap ? (
            <>
              {renderZone(activeMap.zones?.playerA?.territory, 'zone-a-territory')}
              {renderZone(activeMap.zones?.playerB?.territory, 'zone-b-territory')}
              {renderZone(activeMap.zones?.playerA?.dropZone, 'zone-a-drop')}
              {renderZone(activeMap.zones?.playerB?.dropZone, 'zone-b-drop')}
              {renderDropZoneOverlay(
                activeMap.zones?.playerA?.dropZone,
                `zone-a-drop-label${
                  activeMap?.id === 'map_02' ? ' is-rotate-90-reverse' : ''
                }`,
                'DROP ZONE A',
                'A',
                resolvedPlayerDropZone === 'A'
                  ? playerName
                  : resolvedOpponentDropZone === 'A'
                    ? opponentName
                    : '',
                resolvedPlayerDropZone === 'A'
                  ? playerArmyName
                  : resolvedOpponentDropZone === 'A'
                    ? opponentArmyName
                    : '',
              )}
              {renderDropZoneOverlay(
                activeMap.zones?.playerB?.dropZone,
                `zone-b-drop-label is-flipped${
                  activeMap?.id === 'map_02' ? ' is-rotate-90' : ''
                }`,
                'DROP ZONE B',
                'B',
                resolvedPlayerDropZone === 'B'
                  ? playerName
                  : resolvedOpponentDropZone === 'B'
                    ? opponentName
                    : '',
                resolvedPlayerDropZone === 'B'
                  ? playerArmyName
                  : resolvedOpponentDropZone === 'B'
                    ? opponentArmyName
                    : '',
              )}
            </>
          ) : null}
          <svg
            className="board-overlay"
            viewBox={`0 0 ${board.width} ${board.height}`}
            preserveAspectRatio="none"
            ref={boardOverlayRef}
          >
            <g transform={`scale(1,-1) translate(0, -${board.height})`}>
              <line
                className="board-centerline"
                x1={board.width / 2}
                y1={0}
                x2={board.width / 2}
                y2={board.height}
              />
              <line
                className="board-centerline"
                x1={0}
                y1={board.height / 2}
                x2={board.width}
                y2={board.height / 2}
              />
              {(activeArrangement?.objectives ?? []).map((objective) => {
                const radius = OBJECTIVE_MARKER_RADIUS_IN
                const outerMarkerRadius = radius + 1
                return (
                  <g key={objective.id} className="board-objective">
                    <circle
                      className="board-objective-range"
                      cx={objective.x}
                      cy={objective.y}
                      r={outerMarkerRadius}
                    />
                    <circle
                      className="board-objective-core"
                      cx={objective.x}
                      cy={objective.y}
                      r={radius}
                    />
                    <line
                      className="board-objective-slice"
                      x1={objective.x - radius}
                      y1={objective.y}
                      x2={objective.x + radius}
                      y2={objective.y}
                    />
                    <line
                      className="board-objective-slice"
                      x1={objective.x}
                      y1={objective.y - radius}
                      x2={objective.x}
                      y2={objective.y + radius}
                    />
                  </g>
                )
              })}
              {(activeArrangement?.terrain ?? []).map((entry) => {
                const piece = resolveTerrainPiece(entry)
                if (!piece) return null
                const placement = entry.placement
                const label = getPieceLabel(piece)
                const labelPosition = {
                  x: (placement?.x || 0) + 0.1,
                  y: (placement?.y || 0) + 0.45,
                }
                return (
                  <g className="board-terrain" key={entry.id || piece.id}>
                    {getPieceAreas(piece)
                      .filter((area) => area?.points?.length)
                      .map((area, areaIndex) => {
                        const centroid = getPolygonCentroid(area.points)
                        const vantageText = getVantageText(piece, areaIndex)
                        const transformedCentroid = centroid
                          ? transformPoint([centroid.x, centroid.y], placement)
                          : null
                        return (
                          <g key={`${entry.id || piece.id}-area-${areaIndex}`}>
                            <polygon
                              className="board-terrain-fill"
                              points={renderPoints(
                                area.points,
                                placement,
                              )}
                            />
                            {showMapTooltips && transformedCentroid && vantageText ? (
                              <text
                                className="board-terrain-vantage-label"
                                fontSize={0.26}
                                x={transformedCentroid[0]}
                                y={-transformedCentroid[1]}
                                transform="scale(1,-1)"
                                textAnchor="middle"
                                dominantBaseline="middle"
                              >
                                {vantageText}
                              </text>
                            ) : null}
                          </g>
                        )
                      })}
                    {showMapTooltips && label ? (
                      <text
                        className="board-terrain-label"
                        fontSize={0.375}
                        x={labelPosition.x}
                        y={-labelPosition.y}
                        transform="scale(1,-1)"
                      >
                        {label}
                      </text>
                    ) : null}
                  </g>
                )
              })}
              {['light', 'heavy', 'door'].map((wallType) =>
                (activeArrangement?.terrain ?? []).map((entry) => {
                  const piece = resolveTerrainPiece(entry)
                  if (!piece) return null
                  const placement = entry.placement
                  return (piece.walls?.segments ?? []).map(
                    (segment, index) => {
                      const segmentType = getSegmentType(segment)
                      if (segmentType !== wallType) return null
                      const segmentPoints = Array.isArray(segment?.[0])
                        ? segment
                        : segment?.segment
                      if (!Array.isArray(segmentPoints)) return null
                      const [start, end] = segmentPoints
                      const [x1, y1] = transformPoint(start, placement)
                      const [x2, y2] = transformPoint(end, placement)
                      return (
                        <line
                          key={`${entry.id || piece.id}-wall-${wallType}-${index}`}
                          className={getWallClassName(segmentType)}
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                        />
                      )
                    },
                  )
                }),
              )}
              <SightLine
                boardWidth={board.width}
                boardHeight={board.height}
                svgRef={boardOverlayRef}
                active={toolMode === 'sight'}
              />
              <FieldOfVision
                boardWidth={board.width}
                boardHeight={board.height}
                svgRef={boardOverlayRef}
                active={toolMode === 'fov'}
                wallSegments={wallSegments}
              />
              <MovementMeasure
                boardWidth={board.width}
                boardHeight={board.height}
                svgRef={boardOverlayRef}
                active={toolMode === 'measure'}
              />
            </g>
          </svg>
          {activeMap?.id === 'map_01' && selectedCritOpsCard ? (
            <>
              <BoardSide
                mapClass="is-map-01"
                side="is-left"
                cardClassName={`board-card-overlay is-bottom-left is-map-01${map1OpClass}`}
                killOpClassName="board-killop-overlay is-map-01 is-left"
                cardContent={<CritOpsCard card={selectedCritOpsCard} />}
                killOpContent={
                  <KillOp
                    highlightRow={leftKillOpHighlight}
                    deadCount={leftKillOpDeadCount}
                  />
                }
                killOpFirst
                tacContent={leftTacOpContent}
                catContent={leftStratPloysContent}
              />
              <BoardSide
                mapClass="is-map-01"
                side="is-right"
                cardClassName={`board-card-overlay is-top-right is-map-01${map1OpClass}`}
                killOpClassName="board-killop-overlay is-map-01 is-right"
                cardContent={<CritOpsCard card={selectedCritOpsCard} />}
                killOpContent={
                  <KillOp
                    highlightRow={rightKillOpHighlight}
                    deadCount={rightKillOpDeadCount}
                  />
                }
                killOpFirst
                swapCardAndTac
                tacContent={rightTacOpContent}
                catContent={rightStratPloysContent}
              />
            </>
          ) : activeMap?.id === 'map_02' && selectedCritOpsCard ? (
            <>
              <BoardSide
                mapClass="is-map-02"
                side="is-left"
                cardClassName={`board-card-overlay is-top-left is-map-02${map2OpClass}`}
                killOpClassName={`board-killop-overlay is-map-02 is-left${map2OpClass}`}
                cardContent={
                  <CritOpsCard
                    card={selectedCritOpsCard}
                    isTwoColumn
                    layoutVariant={
                      selectedCritOpsCard?.opNumber === 8
                        ? 'op8-wide'
                        : selectedCritOpsCard?.opNumber === 4
                          ? 'op4-left-narrow'
                          : selectedCritOpsCard?.opNumber === 6
                            ? 'op6-left-tuned'
                            : selectedCritOpsCard?.opNumber === 9
                              ? 'op9-split'
                          : ''
                    }
                  />
                }
                killOpContent={
                  <KillOp
                    highlightRow={leftKillOpHighlight}
                    deadCount={leftKillOpDeadCount}
                  />
                }
                killOpFirst
                tacContent={leftTacOpContent}
                catContent={leftStratPloysContent}
              />
              <BoardSide
                mapClass="is-map-02"
                side="is-right"
                cardClassName={`board-card-overlay is-bottom-right is-map-02${map2OpClass}`}
                killOpClassName={`board-killop-overlay is-map-02 is-right${map2OpClass}`}
                cardContent={
                  <CritOpsCard
                    card={selectedCritOpsCard}
                    isTwoColumn
                    layoutVariant={
                      selectedCritOpsCard?.opNumber === 8
                        ? 'op8-wide'
                        : selectedCritOpsCard?.opNumber === 4
                          ? 'op4-left-narrow'
                          : selectedCritOpsCard?.opNumber === 6
                            ? 'op6-left-tuned'
                            : selectedCritOpsCard?.opNumber === 9
                              ? 'op9-split'
                          : ''
                    }
                  />
                }
                killOpContent={
                  <KillOp
                    highlightRow={rightKillOpHighlight}
                    deadCount={rightKillOpDeadCount}
                  />
                }
                killOpFirst
                tacContent={rightTacOpContent}
                catContent={rightStratPloysContent}
              />
            </>
          ) : null}
          </div>
      </div>
    </div>
  )
}

export default Board
