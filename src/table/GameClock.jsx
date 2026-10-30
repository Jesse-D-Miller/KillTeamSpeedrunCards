import { useEffect, useState } from 'react'
import { formatClock } from './formatClock.js'

// The speedrun clock, quietly in the corner by the menu. It runs from the moment both
// iPads first joined and freezes on the final time at the results.
function GameClock({ clock }) {
  const [now, setNow] = useState(() => Date.now())
  const running = Boolean(clock?.startedAt && !clock.endedAt)

  useEffect(() => {
    if (!running) return undefined
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [running])

  if (!clock?.startedAt) return null
  const elapsed = (clock.endedAt ?? now) - clock.startedAt
  return (
    <div className={`table-clock${running ? '' : ' is-final'}`} data-clock={running ? 'running' : 'final'} aria-label="Game time">
      {formatClock(elapsed)}
    </div>
  )
}

export default GameClock
