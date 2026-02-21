import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getKillteamById } from '../data/ktData.js'
import { useSelection } from '../state/SelectionContext.jsx'
import './EquipmentSelection.css'

function EquipmentSelection() {
  const { killteamId } = useParams()
  const { selectedEquipmentByTeam, setSelectedEquipment } = useSelection()
  const [expandedEquipment, setExpandedEquipment] = useState(() => new Set())
  const didInitRef = useRef(new Set())
  const navigate = useNavigate()
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
    const defaultSelected = new Set(
      factionEquipment.map((equipment) => equipment.eqId),
    )
    setSelectedEquipment(killteamId, defaultSelected)
    didInitRef.current.add(killteamId)
  }, [killteamId, factionEquipment, setSelectedEquipment])

  const selectedEquipment = new Set(
    selectedEquipmentByTeam[killteamId] ?? [],
  )

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
              {factionEquipment.map((equipment) => (
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
                    <h3>{equipment.eqName}</h3>
                    <button
                      className="equipment-toggle"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        toggleExpanded(equipment.eqId)
                      }}
                      aria-expanded={expandedEquipment.has(equipment.eqId)}
                      aria-label={`Toggle ${equipment.eqName} details`}
                    >
                      v
                    </button>
                  </div>
                  <p className="equipment-description">
                    {equipment.description}
                  </p>
                </article>
              ))}
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
              {universalEquipment.map((equipment) => (
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
                    <h3>{equipment.eqName}</h3>
                    <button
                      className="equipment-toggle"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        toggleExpanded(equipment.eqId)
                      }}
                      aria-expanded={expandedEquipment.has(equipment.eqId)}
                      aria-label={`Toggle ${equipment.eqName} details`}
                    >
                      v
                    </button>
                  </div>
                  <p className="equipment-description">
                    {equipment.description}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <div className="equipment-footer">
            <button
              className="equipment-start-button"
              type="button"
              onClick={() => navigate(`/game/${killteamId}`)}
            >
              Start Game
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}

export default EquipmentSelection
