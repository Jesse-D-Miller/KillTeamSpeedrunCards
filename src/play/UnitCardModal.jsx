import { useMemo } from 'react'
import { NEXT_ACTIVATION, createUnitState } from '../../shared/game.js'
import { isHidden } from '../../shared/views.js'
import UnitCard from '../components/UnitCard.jsx'
import { getKillteamById } from '../data/ktData.js'
import { buildRosterUnits, isLegionaryUnit } from '../rules/equipment.js'
import { toOpTypeId } from '../rules/killOpCounts.js'
import { expandUnits, maxWoundsFor } from '../rules/roster.js'
import { usePlayer } from './usePlayer.js'

// An operative's unit card, opened full size from its action ring on the map. Your own
// card works as on the Operatives tab; an opponent's is read-only, as on theirs.
//   token: the operative's board token.
function UnitCardModal({ token, onClose }) {
  const { state: game, seat, act } = usePlayer()
  const player = game.players[token.seat]
  const mine = token.seat === seat
  const killteam = useMemo(() => getKillteamById(player?.killteamId), [player?.killteamId])
  // The operative's roster entry (its loadout and equipment); failing that, just its
  // datacard, found from the unit key.
  const unit = useMemo(() => {
    if (!player || player.units.some(isHidden)) return null
    const fromRoster = buildRosterUnits({
      killteam,
      units: expandUnits(killteam),
      selectedKeys: player.units,
      weaponsByUnit: player.weapons,
      equipmentIds: player.equipment,
    }).find((candidate) => candidate.key === token.unitKey)
    if (fromRoster) return fromRoster
    const opType = (killteam?.opTypes ?? []).find((candidate) => candidate.opTypeId === toOpTypeId(token.unitKey))
    return opType ? { key: token.unitKey, opType } : null
  }, [killteam, player, token.unitKey])

  const unitState = unit ? { ...createUnitState(maxWoundsFor(unit.opType)), ...player.unitState?.[unit.key] } : null
  const update = (patch) => act({ type: 'unit/update', unitKey: unit.key, maxWounds: maxWoundsFor(unit.opType), patch })
  const legionary = unit && isLegionaryUnit(unit.opType)

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet unit-card-sheet" role="dialog" aria-modal="true" aria-label="Unit card" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-head">
          <h3>{token.label || 'Operative'}</h3>
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="sheet-body">
          {unit ? (
            <UnitCard
              opType={unit.opType}
              instance={unit.instance}
              instanceCount={unit.instanceCount}
              currentWounds={unitState.wounds}
              detailsOpen
              state={unitState.activation}
              stance={unitState.order}
              selectedStatuses={unitState.statuses}
              aplAdjustment={unitState.apl}
              assignedEquipment={unit.assignedEquipment}
              {...(mine
                ? {
                    onCycleState: () => update({ activation: NEXT_ACTIVATION[unitState.activation] }),
                    onWoundsChange: (wounds) => update({ wounds, dead: wounds === 0 }),
                    onDeadChange: (dead) => {
                      if (dead !== unitState.dead) update({ dead })
                    },
                    onStatusChange: (statuses) => update({ statuses }),
                    onAplAdjustChange: (apl) => update({ apl }),
                    legionaryMark: legionary ? unitState.mark : null,
                    onLegionaryMarkChange: legionary ? (mark) => update({ mark }) : undefined,
                  }
                : { readOnly: true })}
            />
          ) : (
            <p className="muted">This operative's card isn't available.</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default UnitCardModal
