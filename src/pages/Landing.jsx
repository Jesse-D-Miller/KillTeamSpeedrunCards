import { Link } from 'react-router-dom'
import './Landing.css'

function Landing() {
  return (
    <div className="landing-shell">
      <Link className="landing-link" to="/multiplayer">
        <img
          className="landing-logo"
          src="/killteamSpeedrunLogo.png"
          alt="Kill Team Speedrun"
        />
      </Link>
    </div>
  )
}

export default Landing
