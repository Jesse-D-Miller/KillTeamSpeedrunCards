import { useCallback, useMemo } from 'react'
import { getLayout } from '../board/boardData.js'
import { computeAttack } from '../rules/shooting/index.js'
import { usePlayer } from './usePlayer.js'

// An attack (Shoot/Fight tool) another device is aiming at one of my operatives.
const incomingPayload = (ephemerals, tokens, seat) =>
  Object.values(ephemerals).find(
    (payload) =>
      payload?.tool === 'attack' &&
      payload.weaponId &&
      payload.targetId &&
      tokens.find((token) => token.id === payload.targetId)?.seat === seat,
  ) ?? null

// The attack for this iPad's stats drawer: my own (own: the Shoot/Fight tool's payload)
// once it has a target and a weapon, otherwise one aimed at my operative.
//   toggle(modifier): turn one of my modifiers on or off (spending or refunding its CP).
//   pickWeapon(id): my retaliation weapon, when I'm the one being fought.
export const useAttack = (own = null) => {
  const { state: game, seat, ephemerals, act } = usePlayer()
  const layout = getLayout(game.table.mapId, game.table.arrangementId)
  const mine = own?.tool === 'attack' && own.weaponId && own.targetId ? own : null
  const payload = mine ?? incomingPayload(ephemerals, game.tokens ?? [], seat)
  const attack = useMemo(() => (payload ? computeAttack({ game, layout, payload }) : null), [game, layout, payload])
  const toggle = useCallback(
    (modifier) =>
      attack &&
      act({ type: 'shot/toggle', key: attack.key, id: modifier.id, on: !modifier.on, cost: modifier.cost, limit: modifier.limit }),
    [act, attack],
  )
  const pickWeapon = useCallback((weaponId) => attack && act({ type: 'shot/weapon', key: attack.key, weaponId }), [act, attack])
  return { attack, seat, toggle, pickWeapon }
}
