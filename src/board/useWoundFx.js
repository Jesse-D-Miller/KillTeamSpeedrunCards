import { useEffect, useState } from 'react'

// Which operatives just lost or regained wounds, for a short effect on their token: a
// red flash when hurt, green leaves when healed.
//   woundsById: { [tokenId]: wounds } now. Returns { [tokenId]: { kind, key } }.

const FX_MS = { hurt: 900, heal: 1500 }

export const useWoundFx = (woundsById) => {
  const [previous, setPrevious] = useState(woundsById)
  const [effects, setEffects] = useState({})
  // Counts changes, so a repeated effect restarts with a new key.
  const [serial, setSerial] = useState(0)
  const changed = Object.keys(woundsById).some((id) => woundsById[id] !== previous[id])
  if (changed) {
    const next = { ...effects }
    Object.entries(woundsById).forEach(([id, wounds]) => {
      const before = previous[id]
      if (before == null || wounds == null || wounds === before) return
      next[id] = { kind: wounds < before ? 'hurt' : 'heal', key: `${id}-${serial}` }
    })
    setPrevious(woundsById)
    setEffects(next)
    setSerial(serial + 1)
  }

  // Each effect clears itself once it has played.
  useEffect(() => {
    const timers = Object.entries(effects).map(([id, effect]) =>
      window.setTimeout(
        () => setEffects((current) => (current[id]?.key === effect.key ? Object.fromEntries(Object.entries(current).filter(([other]) => other !== id)) : current)),
        FX_MS[effect.kind],
      ),
    )
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [effects])

  return effects
}
