import { activePloyIds } from '../../../shared/game.js'
import { formatCostLabel } from '../../rules/equipment.js'

function PloyList({ player, killteam, tp }) {
  const ploys = (killteam?.ploys ?? []).filter((ploy) => activePloyIds(player, tp).includes(ploy.ployId))
  return (
    <section className="pb-section pb-ploys">
      <h3>Strat ploys this TP</h3>
      {ploys.length ? (
        <ul className="pb-chips">
          {ploys.map((ploy) => (
            <li key={ploy.ployId}>
              {ploy.ployName}
              {formatCostLabel(ploy) ? <span className="pb-cost">{formatCostLabel(ploy)}</span> : null}
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
