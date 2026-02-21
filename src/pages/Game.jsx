import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getKillteamById } from '../data/ktData.js'
import { useSelection } from '../state/SelectionContext.jsx'
import UnitCard from '../components/UnitCard.jsx'
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

function Game() {
  const { killteamId } = useParams()
  const { selectedUnitsByTeam } = useSelection()
  const [unitStates, setUnitStates] = useState({})
  const [deadUnits, setDeadUnits] = useState({})
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

  const selectedUnits = new Set(selectedUnitsByTeam[killteamId] ?? [])
  const visibleUnits = expandedUnits
    .map((unit, index) => ({
      ...unit,
      key: `${unit.opType.opTypeId}-${unit.instance ?? 0}`,
      index,
    }))
    .filter((unit) => selectedUnits.has(unit.key))

  useEffect(() => {
    if (!killteamId || visibleUnits.length === 0) return
    setUnitStates((prev) => {
      const next = { ...prev }
      visibleUnits.forEach((unit) => {
        if (!next[unit.key]) {
          next[unit.key] = 'ready'
        }
      })
      return next
    })
  }, [killteamId, visibleUnits])

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
        <div className="game-nav-brand">
          <div className="game-nav-title">Kill Team Speedrun</div>
          <div className="game-nav-subtitle">{killteam.killteamName}</div>
        </div>
        <nav className="game-nav-links">
          <Link className="ghost-link" to={`/select-army/${killteamId}/units`}>
            Edit units
          </Link>
          <Link className="ghost-link" to="/select-army">
            Change army
          </Link>
          <button className="ghost-link" type="button" onClick={resetStates}>
            Reset
          </button>
        </nav>
      </header>
      <main className="app-content">
        <section className="page game-page">
          <div className="game-grid">
            {orderedUnits.length ? (
              orderedUnits.map(({ opType, instance, instanceCount, key }) => (
                <UnitCard
                  key={key}
                  opType={opType}
                  instance={instance}
                  instanceCount={instanceCount}
                  state={unitStates[key] ?? 'ready'}
                  onCycleState={() => cycleState(key)}
                  onDeadChange={(isDead) => setDeadState(key, isDead)}
                />
              ))
             ) : (
               <div className="empty-state">
                 No units selected yet. Choose units to start the game.
               </div>
             )}
           </div>
         </section>
       </main>
     </div>
   )
}

export default Game
