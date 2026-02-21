import { Link } from 'react-router-dom'
import './Landing.css'

function Landing() {
  const handleStart = () => {
    try {
      localStorage.setItem('kt-timer-start', String(Date.now()))
    } catch (error) {
      console.warn('Failed to start timer.', error)
    }
  }

  return (
    <div className="landing-shell">
      <Link className="landing-link" to="/select-army" onClick={handleStart}>
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
