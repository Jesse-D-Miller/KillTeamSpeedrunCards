import { useMemo } from 'react'
import { otherSeat } from '../../shared/game.js'
import { getKillteamById } from '../data/ktData.js'
import { buildRosterUnits } from '../rules/equipment.js'
import { expandUnits } from '../rules/roster.js'
import { useGame } from '../net/gameContext.js'

// Convenience view of "my" side of the game for the iPad screens.
export const usePlayer = () => {
  const game = useGame()
  const { state, seat } = game
  const me = state?.players?.[seat] ?? null
  const opponentSeat = otherSeat(seat)
  const opponent = state?.players?.[opponentSeat] ?? null

  const killteam = useMemo(() => getKillteamById(me?.killteamId), [me?.killteamId])
  const allUnits = useMemo(() => expandUnits(killteam), [killteam])
  const roster = useMemo(
    () =>
      buildRosterUnits({
        killteam,
        units: allUnits,
        selectedKeys: me?.units,
        weaponsByUnit: me?.weapons,
        equipmentIds: me?.equipment,
      }),
    [killteam, allUnits, me?.units, me?.weapons, me?.equipment],
  )

  return { ...game, me, opponent, opponentSeat, killteam, allUnits, roster }
}
