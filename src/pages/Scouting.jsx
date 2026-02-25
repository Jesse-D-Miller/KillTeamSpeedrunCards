import { Link } from 'react-router-dom'
import { useState } from 'react'
import './Scouting.css'

const scoutingCards = [1, 2, 3].map((index) => ({
  src: `/images/scouting/scouting-step-${String(index).padStart(2, '0')}.png`,
  label: `Scouting step ${index}`,
}))

function Scouting() {
  const [selectedIndex, setSelectedIndex] = useState(null)
  const [isLocked, setIsLocked] = useState(false)

  return (
    <div className="app-shell">
      <main className="app-content">
        <section className="page scouting">
          <div className="scouting-card">
            <h1>Scouting</h1>
            <p className="scouting-lede">Complete the scouting steps below.</p>
            <div className="scouting-grid">
              {scoutingCards.map((card, index) => {
                const isSelected = selectedIndex === index
                const isDimmed = isLocked && !isSelected

                return (
                  <button
                    className={`scouting-card-item${
                      isSelected ? ' is-selected' : ''
                    }${isDimmed ? ' is-dimmed' : ''}`}
                    key={card.src}
                    type="button"
                    onClick={() => {
                      if (!isLocked) setSelectedIndex(index)
                    }}
                    aria-pressed={isSelected}
                    disabled={isLocked && !isSelected}
                  >
                    <img src={card.src} alt={card.label} loading="lazy" />
                  </button>
                )
              })}
            </div>
            <div className="scouting-actions">
              {isLocked ? (
                <Link className="scouting-next" to="/select-primary-op">
                  Next: Select primary op
                </Link>
              ) : (
                <button
                  className={`scouting-next${
                    selectedIndex === null ? ' is-disabled' : ''
                  }`}
                  type="button"
                  onClick={() => {
                    if (selectedIndex !== null) setIsLocked(true)
                  }}
                  disabled={selectedIndex === null}
                >
                  Lock in
                </button>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default Scouting
