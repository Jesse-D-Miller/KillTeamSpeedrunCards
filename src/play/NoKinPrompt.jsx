import { useState } from 'react'
import { HERNKYN_YAEGIRS, NO_KIN_LEFT_BEHIND, ployUses } from '../../shared/game.js'
import { usePlayer } from './usePlayer.js'

// Hernkyn Yaegirs: when one of your Yaegirs is incapacitated, offer No Kin Left Behind
// (move the Fallen Kin marker to where it fell) right away, on whichever screen is up.
function NoKinPrompt() {
  const { state: game, seat, me, act } = usePlayer()
  const yaegirs = game.phase === 'battle' && me?.killteamId === HERNKYN_YAEGIRS
  const deadIds = yaegirs
    ? game.tokens.filter((token) => token.seat === seat && token.unitKey && me.unitState?.[token.unitKey]?.dead).map((token) => token.id)
    : []
  const [seen, setSeen] = useState(deadIds)
  const [fallenId, setFallenId] = useState(null)
  const newlyDead = deadIds.filter((id) => !seen.includes(id))
  if (newlyDead.length || seen.length !== deadIds.length) {
    setSeen(deadIds)
    if (newlyDead.length) setFallenId(newlyDead.at(-1))
  }
  const fallen = fallenId && deadIds.includes(fallenId) ? game.tokens.find((token) => token.id === fallenId) : null
  if (!fallen) return null
  const used = ployUses(me, game.battle.tp, NO_KIN_LEFT_BEHIND) > 0
  const blocked = used ? 'Already used this turning point' : me.cp < 1 ? 'Not enough CP' : null
  return (
    <div className="nokin-prompt glass" role="dialog" aria-label="No Kin Left Behind">
      <strong>{fallen.label || 'Your Yaegir'} is down.</strong>
      <span className="muted">No Kin Left Behind: move your Fallen Kin marker to where it fell.</span>
      <div className="row">
        <button
          type="button"
          className="btn is-primary"
          disabled={Boolean(blocked)}
          onClick={() => {
            act({ type: 'battle/noKinLeftBehind', tokenId: fallen.id, cost: 1 })
            setFallenId(null)
          }}
        >
          {blocked ?? 'Use · 1CP'}
        </button>
        <button type="button" className="btn" onClick={() => setFallenId(null)}>
          Not now
        </button>
      </div>
    </div>
  )
}

export default NoKinPrompt
