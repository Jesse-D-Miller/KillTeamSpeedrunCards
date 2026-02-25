import { Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useSelection } from '../state/SelectionContext.jsx'
import './SelectPrimaryOp.css'

const primaryOpCards = [1, 2, 3].map((index) => ({
  src: `/images/primaryOp/primary-op-${String(index).padStart(2, '0')}.png`,
  label: `Primary op ${index}`,
}))

function SelectPrimaryOp() {
  const location = useLocation()
  const killteamId = location.state?.killteamId
  const [selectedIndex, setSelectedIndex] = useState(null)
  const { selectedPrimaryOpsByTeam, setSelectedPrimaryOp } = useSelection()
  const selectedPrimaryOp = killteamId
    ? selectedPrimaryOpsByTeam[killteamId]
    : null

  useEffect(() => {
    if (!selectedPrimaryOp?.src) return
    const matchIndex = primaryOpCards.findIndex(
      (card) => card.src === selectedPrimaryOp.src,
    )
    if (matchIndex >= 0) {
      setSelectedIndex(matchIndex)
    }
  }, [selectedPrimaryOp])

  return (
    <div className="app-shell">
      <main className="app-content">
        <section className="page primary-op">
          <div className="primary-op-card">
            <h1>Select Primary Op</h1>
            <p className="primary-op-lede">Choose your primary op.</p>
            <div className="primary-op-grid">
              {primaryOpCards.map((card, index) => {
                const isSelected = selectedIndex === index

                return (
                  <button
                    className={`primary-op-card-item${
                      isSelected ? ' is-selected' : ''
                    }`}
                    key={card.src}
                    type="button"
                    onClick={() => {
                      setSelectedIndex(index)
                      if (killteamId) {
                        setSelectedPrimaryOp(killteamId, card)
                        try {
                          localStorage.setItem(
                            'kt-selected-primaryop',
                            JSON.stringify({
                              ...card,
                              killteamId,
                            }),
                          )
                          localStorage.setItem('kt-last-killteam', killteamId)
                        } catch (error) {
                          console.warn('Failed to store primary op.', error)
                        }
                      }
                    }}
                    aria-pressed={isSelected}
                  >
                    <img src={card.src} alt={card.label} loading="lazy" />
                  </button>
                )
              })}
            </div>
            <div className="primary-op-actions">
              {killteamId ? (
                <Link
                  className={`primary-op-start${
                    selectedIndex === null ? ' is-disabled' : ''
                  }`}
                  to={`/game/${killteamId}`}
                  aria-disabled={selectedIndex === null}
                  tabIndex={selectedIndex === null ? -1 : 0}
                >
                  Play game
                </Link>
              ) : (
                <span className="primary-op-start is-disabled">Play game</span>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default SelectPrimaryOp
