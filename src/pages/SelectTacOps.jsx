import { Link, useLocation } from 'react-router-dom'
import { useState } from 'react'
import kt24Data from '../data/kt24_v4.json'
import './SelectTacOps.css'

const archetypeToSlug = (name) => {
  const normalized = name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\s+/g, ' ')
    .trim()

  if (normalized === 'seek and destroy') return 'seek-destroy'
  if (normalized === 'recon') return 'recon'
  if (normalized === 'security') return 'security'
  if (normalized === 'infiltration') return 'infiltration'

  return normalized.replace(/[^a-z0-9]+/g, '-')
}

function SelectTacOps() {
  const location = useLocation()
  const killteamId = location.state?.killteamId
  const [selectedCardIndex, setSelectedCardIndex] = useState(null)
  const killteam = kt24Data.find((team) => team.killteamId === killteamId)
  const archetypes = killteam?.archetypes
    ? killteam.archetypes
        .split('/')
        .map((value) => value.trim())
        .filter(Boolean)
    : []
  const tacOpsCards = archetypes.flatMap((archetypeName) => {
    const slug = archetypeToSlug(archetypeName)
    if (!slug) return []

    return [1, 2, 3].map((index) => ({
      src: `/images/tacOps/tacop-${slug}-${String(index).padStart(2, '0')}.png`,
      label: archetypeName,
      index,
    }))
  })

  return (
    <div className="app-shell">
      <main className="app-content">
        <section className="page select-tac-ops">
          <div className="select-tac-ops-card">
            <h1>Select Tac Ops</h1>
            <p className="select-tac-ops-lede">
              Choose your Tac Ops for the battle.
            </p>
            {tacOpsCards.length ? (
              <div className="select-tac-ops-grid">
                {tacOpsCards.map((card, idx) => {
                  const isSelected = selectedCardIndex === idx

                  return (
                    <button
                      className={`select-tac-ops-card-item${
                        isSelected ? ' is-selected' : ''
                      }`}
                      key={`${card.src}-${idx}`}
                      type="button"
                      onClick={() => setSelectedCardIndex(idx)}
                      aria-pressed={isSelected}
                    >
                      <img
                        src={card.src}
                        alt={`${card.label} Tac Op ${card.index}`}
                        loading="lazy"
                      />
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="select-tac-ops-empty">
                No Tac Ops found for this kill team yet.
              </p>
            )}
            {killteamId ? (
              selectedCardIndex === null ? (
                <span className="select-tac-ops-next is-disabled">
                  Next: Start game
                </span>
              ) : (
                <Link
                  className="select-tac-ops-next"
                  to="/set-up-operatives"
                  state={{ killteamId }}
                >
                  Next: Set up operatives
                </Link>
              )
            ) : (
              <Link className="select-tac-ops-next" to="/select-army">
                Back to select army
              </Link>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

export default SelectTacOps
