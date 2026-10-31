import { Link, Outlet, Route, Routes } from 'react-router-dom'
import './play/play.css'
import { GameProvider } from './net/GameProvider.jsx'
import { seatColor } from './board/colors.js'
import HomeLogo from './HomeLogo.jsx'
import PlayPage from './play/PlayPage.jsx'
import StatsPage from './stats/StatsPage.jsx'
import TablePage from './table/TablePage.jsx'

function Home() {
  return (
    <div className="home">
      <HomeLogo />
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
      <Route path="/stats" element={<StatsPage />} />
    </Routes>
  )
}

export default App
