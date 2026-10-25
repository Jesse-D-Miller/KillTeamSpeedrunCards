import { useMemo, useState } from 'react'
import { activePloyIds, createUnitState, totalVp } from '../../shared/game.js'
import { isHidden } from '../../shared/views.js'
import { getKillteamById } from '../data/ktData.js'
import UnitCard from '../components/UnitCard.jsx'
import { buildRosterUnits } from '../rules/equipment.js'
import { expandUnits, maxWoundsFor } from '../rules/roster.js'
import { usePlayer } from './usePlayer.js'

function OpponentTab() {
  const { state: game, opponent } = usePlayer()
  const [openByUnit, setOpenByUnit] = useState({})
  const killteam = useMemo(() => getKillteamById(opponent.killteamId), [opponent.killteamId])
  const rosterHidden = opponent.units.some(isHidden)
  const roster = useMemo(
    () =>
      rosterHidden
        ? []
        : buildRosterUnits({
            killteam,
            units: expandUnits(killteam),
            selectedKeys: opponent.units,
            weaponsByUnit: opponent.weapons,
            equipmentIds: opponent.equipment,
          }),
    [killteam, rosterHidden, opponent.units, opponent.weapons, opponent.equipment],
  )
  const ploys = (killteam?.ploys ?? []).filter((ploy) => activePloyIds(opponent, game.battle.tp).includes(ploy.ployId))

  return (
    <section className="step">
      <h2>{opponent.name}</h2>
      <p className="muted">
        {killteam?.killteamName ?? 'No kill team yet'} · {totalVp(opponent, { withPrimary: game.phase === 'results' })} VP · {opponent.cp} CP
      </p>
      {ploys.length ? (
        <p>
          Active strat ploys: <strong>{ploys.map((ploy) => ploy.ployName).join(', ')}</strong>
        </p>
      ) : null}
      {rosterHidden ? (
        <p className="muted">Operatives are revealed once mustering is done ({opponent.units.length} selected).</p>
      ) : null}
      <div className="unit-grid">
        {roster.map((unit) => {
          const unitState = { ...createUnitState(maxWoundsFor(unit.opType)), ...opponent.unitState[unit.key] }
          return (
            <UnitCard
              key={unit.key}
              opType={unit.opType}
              instance={unit.instance}
              instanceCount={unit.instanceCount}
              currentWounds={unitState.wounds}
              state={unitState.activation}
              stance={unitState.order}
              selectedStatuses={unitState.statuses}
              aplAdjustment={unitState.apl}
              assignedEquipment={unit.assignedEquipment}
              detailsOpen={Boolean(openByUnit[unit.key])}
              onToggleDetails={() => setOpenByUnit((current) => ({ ...current, [unit.key]: !current[unit.key] }))}
              readOnly
            />
          )
        })}
      </div>
    </section>
  )
}

export default OpponentTab
