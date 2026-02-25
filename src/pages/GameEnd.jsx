import { Link } from 'react-router-dom'
import './GameEnd.css'

function GameEnd() {
  return (
    <div className="app-shell">
      <main className="app-content">
        <section className="page game-end">
          <div className="game-end-card">
            <h1>Game End</h1>
            <p className="game-end-lede">Record final scores and wrap up.</p>
            <Link className="game-end-next" to="/select-army">
              Back to select army
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}

export default GameEnd
