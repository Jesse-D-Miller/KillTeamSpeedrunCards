import { useState } from 'react'
import { HERNKYN_YAEGIRS, STALWART_DEFENCE, STALWART_RANGE_IN, ployUses, tokenRadiusIn } from '../../shared/game.js'
import { distance } from '../../shared/geometry.js'
import { CONTROL_RANGE_IN, inEnemyControl } from '../../shared/movement.js'
import { usePlayer } from './usePlayer.js'

const gap = (a, b) => distance(a, b) - tokenRadiusIn(a) - tokenRadiusIn(b)

// Hernkyn Yaegirs' Stalwart Defence: when an enemy operative ends a move within control
// range of one of your Yaegirs, offer the ploy with the Yaegirs that could shoot it (within
// 6" of that one and not themselves within enemy control range; visibility isn't checked).
// Picking one spends the ploy and starts its free Shoot at that enemy (onShoot).
function StalwartPrompt({ onShoot }) {
  const { state: game, seat, me, act } = usePlayer()
  const yaegirs = game.phase === 'battle' && game.battle.firefightTp === game.battle.tp && me?.killteamId === HERNKYN_YAEGIRS
  const alive = (token) => token.unitKey && !game.players[token.seat]?.unitState?.[token.unitKey]?.dead
  const enemies = yaegirs ? game.tokens.filter((token) => token.seat && token.seat !== seat && alive(token)) : []
  // Where each enemy stood last time, to spot one that's just moved.
  const spots = Object.fromEntries(enemies.map((token) => [token.id, `${token.x},${token.y}`]))
  const [seen, setSeen] = useState(spots)
  const [offer, setOffer] = useState(null)
  const moved = enemies.filter((token) => seen[token.id] && seen[token.id] !== spots[token.id])
  if (Object.keys(spots).some((id) => seen[id] !== spots[id])) {
    setSeen(spots)
    const mine = game.tokens.filter((token) => token.seat === seat && alive(token))
    const engagement = moved
      .map((enemy) => ({ enemy, friend: mine.find((token) => gap(token, enemy) <= CONTROL_RANGE_IN) }))
      .find(({ friend }) => friend)
    if (engagement) setOffer({ enemyId: engagement.enemy.id, friendId: engagement.friend.id })
  }
  const enemy = offer && game.tokens.find((token) => token.id === offer.enemyId)
  const friend = offer && game.tokens.find((token) => token.id === offer.friendId)
  if (!enemy || !friend || !alive(enemy) || !alive(friend)) return null
  const shooters = game.tokens.filter(
    (token) =>
      token.seat === seat &&
      token.id !== friend.id &&
      alive(token) &&
      gap(token, friend) <= STALWART_RANGE_IN &&
      !inEnemyControl(game, token),
  )
  const blocked = ployUses(me, game.battle.tp, STALWART_DEFENCE) > 0 ? 'Already used this turning point' : me.cp < 1 ? 'Not enough CP' : null
  return (
    <div className="nokin-prompt glass" role="dialog" aria-label="Stalwart Defence">
      <strong>
        {enemy.label || 'An enemy'} moved into control range of {friend.label || 'your Yaegir'}.
      </strong>
      <span className="muted">
        Stalwart Defence · 1CP: a Yaegir within 6&quot; of it can shoot that enemy now (no grenades, Blast or x&quot; Devastating).
      </span>
      <div className="row">
        {blocked ? <span className="muted">{blocked}</span> : null}
        {!blocked && !shooters.length ? <span className="muted">No Yaegir can shoot it.</span> : null}
        {!blocked
          ? shooters.map((token) => (
              <button
                key={token.id}
                type="button"
                className="btn is-primary"
                onClick={() => {
                  act({ type: 'battle/firefightPloy', ployId: STALWART_DEFENCE, cost: 1 })
                  onShoot({ shooterId: token.id, targetId: enemy.id })
                  setOffer(null)
                }}
              >
                {token.label || token.unitKey}
              </button>
            ))
          : null}
        <button type="button" className="btn" onClick={() => setOffer(null)}>
          Not now
        </button>
      </div>
    </div>
  )
}

export default StalwartPrompt
