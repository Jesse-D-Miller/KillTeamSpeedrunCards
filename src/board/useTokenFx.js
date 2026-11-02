import { useEffect, useState } from 'react'

// One-off effects on operatives when something just happened to them: hurt (a red
// flash, or a white starburst for a critical hit), healed (green leaves), newly injured
// (a red drip), taken out (the rim shatters where it stood), order changed (a ring out
// for Engage, a fade for Conceal) and counteracting (a flicker).
//   snapshots: { [tokenId]: { wounds, injured, dead, order, counteract, lastHit, x, cy, r } }
//   now. Returns { [tokenId]: [{ kind, key, x, cy, r }] }; each effect clears itself.

export const FX_MS = { hurt: 900, crit: 1000, heal: 1500, injured: 1300, shatter: 1000, engage: 900, conceal: 700, counteract: 800 }

const eventsBetween = (before, now) => {
  const events = []
  if (before.wounds != null && now.wounds != null && now.wounds !== before.wounds && !now.dead) {
    events.push(now.wounds > before.wounds ? 'heal' : now.lastHit === 'crit' ? 'crit' : 'hurt')
  }
  if (now.injured && !before.injured && !now.dead) events.push('injured')
  if (now.dead && !before.dead) events.push('shatter')
  if (before.order && now.order && now.order !== before.order && !now.dead) events.push(now.order)
  if (now.counteract != null && now.counteract !== before.counteract) events.push('counteract')
  return events
}

export const useTokenFx = (snapshots) => {
  const [previous, setPrevious] = useState(snapshots)
  const [effects, setEffects] = useState({})
  // Counts changes, so a repeated effect restarts with a new key.
  const [serial, setSerial] = useState(0)
  const ids = Object.keys(snapshots)
  const changed = ids.some((id) => {
    const a = previous[id]
    const b = snapshots[id]
    return a && (a.wounds !== b.wounds || a.dead !== b.dead || a.order !== b.order || a.counteract !== b.counteract)
  })
  if (changed) {
    const next = { ...effects }
    ids.forEach((id) => {
      const before = previous[id]
      if (!before) return
      const kinds = eventsBetween(before, snapshots[id])
      if (!kinds.length) return
      // A shattering operative has already moved to the casualty area: play it where it stood.
      const at = (kind) => (kind === 'shatter' ? before : snapshots[id])
      next[id] = kinds.map((kind) => ({ kind, key: `${id}-${kind}-${serial}`, x: at(kind).x, cy: at(kind).cy, r: at(kind).r }))
    })
    setPrevious(snapshots)
    setEffects(next)
    setSerial(serial + 1)
  } else if (ids.some((id) => !previous[id] || previous[id].x !== snapshots[id].x || previous[id].cy !== snapshots[id].cy)) {
    // New operatives just start being watched; moves are remembered so a shatter plays
    // where the operative last stood.
    setPrevious(snapshots)
  }

  // Each batch clears itself once its longest effect has played.
  useEffect(() => {
    const timers = Object.entries(effects).map(([id, list]) =>
      window.setTimeout(
        () => setEffects((current) => (current[id] === list ? Object.fromEntries(Object.entries(current).filter(([other]) => other !== id)) : current)),
        Math.max(...list.map((effect) => FX_MS[effect.kind] ?? 1000)),
      ),
    )
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [effects])

  return effects
}
