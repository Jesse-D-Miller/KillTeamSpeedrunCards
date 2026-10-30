import { Link, Outlet, Route, Routes } from 'react-router-dom'
import './play/play.css'
import { GameProvider } from './net/GameProvider.jsx'
import { seatColor } from './board/colors.js'
import PlayPage from './play/PlayPage.jsx'
import TablePage from './table/TablePage.jsx'

function Home() {
  return (
    <div className="home">
      {/* A heartbeat glow behind the emblem, sending out a ring on every beat. */}
      <div className="home-logo">
        <span className="home-pulse" aria-hidden="true" />
        {[0, 1, 2].map((ring) => (
          <span key={ring} className="home-ring" style={{ '--ring': ring }} aria-hidden="true" />
        ))}
        <img src="/killteamSpeedrunLogo.png" alt="Kill Team Speedrun" />
      </div>
      <div className="home-choices">
        <Link className="home-choice" to="/table">
          <strong>Projector</strong>
          <span className="muted">Open on the table computer</span>
        </Link>
        {['A', 'B'].map((seat) => (
          <a key={seat} className="home-choice" href={`/play?seat=${seat}`} style={{ '--seat-color': seatColor(seat) }}>
            <strong>Player {seat}</strong>
            <span className="muted">Open on an iPad</span>
          </a>
        ))}
      </div>
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route
        path="/table"
        element={
          <GameProvider role="table">
            <Outlet />
          </GameProvider>
        }
      >
        <Route index element={<TablePage />} />
        <Route path="calibrate" element={<TablePage calibrating />} />
      </Route>
      <Route path="/play" element={<PlayPage />} />
    </Routes>
  )
}

export default App
