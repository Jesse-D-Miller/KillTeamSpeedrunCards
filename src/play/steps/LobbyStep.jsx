import { useState } from 'react'
import { usePlayer } from '../usePlayer.js'

function LobbyStep() {
  const { me, opponent, presence, opponentSeat, act } = usePlayer()
  const [name, setName] = useState(me.name)

  const commit = () => {
    if (name.trim() && name.trim() !== me.name) act({ type: 'player/rename', name })
  }

  return (
    <section className="step">
      <h2>Welcome to the table</h2>
      <label className="field">
        <span>Your name</span>
        <input
          value={name}
          maxLength={24}
          onChange={(event) => setName(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
          autoComplete="off"
        />
      </label>
      <p className="muted">
        {presence?.[opponentSeat]
          ? `${opponent.name} is connected. Tap Ready when you're set.`
          : 'Waiting for the other player to scan their QR code…'}
      </p>
    </section>
  )
}

export default LobbyStep
