import { COMMAND_REROLL, activePloyIds, ployUses } from '../../../shared/game.js'
import { formatCostLabel } from '../../rules/equipment.js'

// Every ploy the player has used this turning point: strategy ploys (filled) and
// firefight ploys (outlined, with how many times when Command Re-roll goes again),
// whether played from the Team tab or in a shot or fight.
function PloyList({ player, killteam, tp }) {
  const ploys = killteam?.ploys ?? []
  const strategy = ploys.filter((ploy) => activePloyIds(player, tp).includes(ploy.ployId))
  const firefight = [
    ...ploys.filter((ploy) => ploy.ployType !== 'S'),
    { ployId: COMMAND_REROLL, ployName: 'Command Re-roll' },
  ]
    .map((ploy) => ({ ...ploy, uses: ployUses(player, tp, ploy.ployId) }))
    .filter((ploy) => ploy.uses > 0)
  return (
    <section className="pb-section pb-ploys">
      <h3>Ploys this TP</h3>
      {strategy.length || firefight.length ? (
        <ul className="pb-chips">
          {strategy.map((ploy) => (
            <li key={ploy.ployId} data-ploy="strategy">
              {ploy.ployName}
              {formatCostLabel(ploy) ? <span className="pb-cost">{formatCostLabel(ploy)}</span> : null}
            </li>
          ))}
          {firefight.map((ploy) => (
            <li key={ploy.ployId} className="is-firefight" data-ploy="firefight">
              {ploy.ployName}
              {ploy.uses > 1 ? <span className="pb-cost">×{ploy.uses}</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="pb-note">None used</p>
      )}
    </section>
  )
}

export default PloyList
