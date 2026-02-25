import { Link, useLocation } from 'react-router-dom'
import './SetUpBattle.css'

const checklistItems = [
  'Select Kill Teams',
  'Determine killzone, set up terrain, specify terrain types',
  'Determine Crit Op',
  'Roll off - winner decides initiative',
  'Play with initiative selects Drop Zone',
]

function SetUpBattle() {
  const location = useLocation()
  const killteamId = location.state?.killteamId

  return (
    <div className="app-shell">
      <main className="app-content">
        <section className="page setup-battle">
          <div className="setup-battle-card">
            <h1>Set Up the Battle</h1>
            <p className="setup-battle-lede">
              Check everything off before selecting operatives.
            </p>
            <ul className="setup-battle-list">
              {checklistItems.map((item, index) => (
                <li key={item} className="setup-battle-item">
                  <input
                    type="checkbox"
                    aria-label={item}
                    defaultChecked={index < 3}
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            {killteamId ? (
              <Link
                className="setup-battle-next"
                to={`/select-army/${killteamId}/units`}
              >
                Next: Select operatives
              </Link>
            ) : (
              <Link className="setup-battle-next" to="/select-army">
                Back to select army
              </Link>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

export default SetUpBattle
