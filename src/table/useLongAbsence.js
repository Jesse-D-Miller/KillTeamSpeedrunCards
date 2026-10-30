import { useEffect, useState } from 'react'
import { SEATS } from '../../shared/game.js'

// iPads drop off the Wi-Fi for a moment and come straight back (sleep, switching apps,
// a weak signal). Only a seat that has been gone this long counts as gone, so a blip
// never puts the join codes over a game in progress.
export const LONG_ABSENCE_MS = 15000

// The seats that have been disconnected for at least `delayMs`.
export const useLongAbsence = (presence, delayMs = LONG_ABSENCE_MS) => {
  const absent = presence ? SEATS.filter((seat) => !presence[seat]).join(',') : ''
  // Which absence the timer last finished for: a seat that came back and left again
  // waits out the full delay again.
  const [elapsedFor, setElapsedFor] = useState(null)
  const [lastAbsent, setLastAbsent] = useState(absent)
  if (lastAbsent !== absent) {
    setLastAbsent(absent)
    setElapsedFor(null)
  }

  useEffect(() => {
    if (!absent) return undefined
    const timer = window.setTimeout(() => setElapsedFor(absent), delayMs)
    return () => window.clearTimeout(timer)
  }, [absent, delayMs])

  return absent && elapsedFor === absent ? absent.split(',') : []
}
