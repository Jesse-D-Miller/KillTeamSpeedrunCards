import { Link, useLocation } from 'react-router-dom'
import './SetUpOperatives.css'

const checklistItems = [
  {
    title: 'Set up equipment',
    subtext: 'Alternate placing equipment ONE PIECE AT A TIME starting with the player with initiative.',
  },
  {
    title: 'Deploy operatives',
    subtext: 'Alternate placing units 1/3rd of your army at a time (rounded up). Start with the player with initiative. units must be placed wholely within your drop zone and given a conceal order',
  },
]

function SetUpOperatives() {
  const location = useLocation()
  const killteamId = location.state?.killteamId

  return (
    <div className="app-shell">
      <main className="app-content">
        <section className="page setup-operatives">
          <div className="setup-operatives-card">
            <h1>Set Up Operatives</h1>
            <p className="setup-operatives-lede">
              Check everything off before scouting.
            </p>
            <ul className="setup-operatives-list">
              {checklistItems.map((item) => (
                <li key={item.title} className="setup-operatives-item">
                  <input
                    type="checkbox"
                    aria-label={item.title}
                  />
                  <div className="setup-operatives-text">
                    <span className="setup-operatives-title">{item.title}</span>
                    <span className="setup-operatives-subtext">
                      {item.subtext}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            {killteamId ? (
              <Link
                className="setup-operatives-next"
                to="/scouting"
                state={{ killteamId }}
              >
                Next: Scouting
              </Link>
            ) : (
              <Link className="setup-operatives-next" to="/select-army">
                Back to select army
              </Link>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

export default SetUpOperatives
