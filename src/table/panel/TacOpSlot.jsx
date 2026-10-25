import { isHidden } from '../../../shared/views.js'
import TacOpBack from '../../components/TacOpBack.jsx'
import TacOpCard from '../../components/TacOpCard.jsx'
import { getTacOp } from '../../data/tacOps.js'

// Face-down card back until the player reveals it, then the real card.
function TacOpSlot({ player, color }) {
  if (!player.tacOp) return null
  const hidden = isHidden(player.tacOp)
  return (
    <figure className="pb-tacop">
      {hidden ? (
        <TacOpBack color={color} className="pb-tacop-card" />
      ) : (
        <div className="pb-tacop-card pb-tacop-text">
          <TacOpCard tacOp={getTacOp(player.tacOp.id)} compact />
        </div>
      )}
      <figcaption>{hidden ? 'Tac op · hidden' : player.tacOp.label || 'Tac op'}</figcaption>
    </figure>
  )
}

export default TacOpSlot
