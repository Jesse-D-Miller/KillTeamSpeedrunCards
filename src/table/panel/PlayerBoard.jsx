import { boardLayoutFor } from '../../../shared/boardLayout.js'
import { otherSeat, turnState } from '../../../shared/game.js'
import { getKillteamById } from '../../data/ktData.js'
import { getCritOp } from '../../board/boardData.js'
import { seatColor } from '../../board/colors.js'
import CombatBoard from './CombatBoard.jsx'
import CritOpSummary from './CritOpSummary.jsx'
import IdentityBar from './IdentityBar.jsx'
import KillOpTrack from './KillOpTrack.jsx'
import PhaseCard from './PhaseCard.jsx'
import PloyList from './PloyList.jsx'
import ScoreBlock from './ScoreBlock.jsx'
import SetupFacts from './SetupFacts.jsx'
import TacOpSlot from './TacOpSlot.jsx'
import TurnTracker from './TurnTracker.jsx'
import { useBoardFit } from './useBoardFit.js'
import './playerBoard.css'

// One player's board on the projector. Everything here is public information.
// The board is laid out upright (portrait 8"x22" on Map 1, landscape 22"x8" on Map 2)
// and then rotated to face its player.
//   widthPx/heightPx: the slot on the table plane; rotation: degrees toward the player.
//   combat: a shot or fight in progress (computeAttack); while this player is in it,
//   everything below their name swaps to their half of it.
// In the battle each piece sits where its player put it (see shared/boardLayout.js);
// layout overrides that while the player is dragging on their iPad, and upright skips
// the rotation there.
const pieceStyle = ({ x, y, w, h }) => ({ left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` })

function PlayerBoard({ game, seat, rotation, connected, widthPx, heightPx, combat = null, layout = null, upright = false }) {
  const player = game.players[seat]
  const enemy = game.players[otherSeat(seat)]
  const killteam = getKillteamById(player.killteamId)
  const critOp = game.phase === 'lobby' ? null : getCritOp(game.table.critOpId)
  const inGame = game.phase === 'battle' || game.phase === 'results'
  const final = game.phase === 'results'
  const tp = game.battle.tp
  const landscape = Math.abs(rotation) === 90
  const size = landscape ? { width: heightPx, height: widthPx } : { width: widthPx, height: heightPx }
  const color = seatColor(seat)
  const boardRef = useBoardFit()
  // Firefight phase: whose activation it is.
  const firefight = game.phase === 'battle' && game.battle.firefightTp === tp
  const turn = firefight ? turnState(game) : null
  const inCombat = Boolean(combat) && (combat.shooter.seat === seat || combat.target.seat === seat)
  const layoutClass = inCombat ? 'is-combat' : inGame ? 'is-game is-free' : 'is-setup'
  const pieces = layout ?? boardLayoutFor(game.settings, seat, landscape ? 'landscape' : 'portrait')
  // A piece of the arranged board (battle only); elsewhere the grid places it.
  const piece = (id, className, children) =>
    inGame && !inCombat ? (
      <div className={`pb-piece ${className}`} data-piece={id} style={pieceStyle(pieces[id])}>
        {children}
      </div>
    ) : (
      <div className={className}>{children}</div>
    )
  const turnBadge = !turn
    ? null
    : turn.activeSeat === seat
      ? 'activating'
      : turn.counteractSeat === seat
        ? 'counteract'
        : !turn.activeSeat && turn.nextSeat === seat
          ? 'next'
          : null

  return (
    <div className="pb-slot">
      <div
        ref={boardRef}
        className={`pb-board ${landscape ? 'is-landscape' : 'is-portrait'} ${layoutClass}`}
        style={{ ...size, '--seat-color': color, transform: `translate(-50%, -50%) rotate(${upright ? 0 : rotation}deg)` }}
        data-seat={seat}
      >
        {piece(
          'id',
          'pb-area-id',
          <IdentityBar
            player={player}
            killteam={killteam}
            connected={connected}
            hasInitiative={inGame && game.battle.initiativeByTp[tp] === seat}
            turnBadge={turnBadge}
            compact={inCombat}
          />,
        )}

        {inCombat ? (
          <div className="pb-area-combat">
            <CombatBoard combat={combat} seat={seat} player={player} />
          </div>
        ) : inGame ? (
          <>
            {piece('score', 'pb-area-score', <ScoreBlock player={player} final={final} />)}
            {piece('turn', 'pb-area-turn', <TurnTracker player={player} tp={tp} final={final} />)}
            {piece('kill', 'pb-area-kill', <KillOpTrack enemy={enemy} />)}
            {piece('ploys', 'pb-area-ploys', <PloyList player={player} killteam={killteam} tp={tp} />)}
            {piece('tacop', 'pb-area-tacop', <TacOpSlot player={player} color={color} />)}
            {piece('critop', 'pb-area-critop', <CritOpSummary card={critOp} />)}
          </>
        ) : (
          <>
            <div className="pb-area-facts">
              <SetupFacts game={game} seat={seat} />
            </div>
            <div className="pb-area-phase">
              <PhaseCard phase={game.phase} player={player} ready={game.ready[seat]} connected={connected} />
            </div>
          </>
        )}

        {inCombat || inGame ? null : (
          <div className="pb-area-cards">
            <TacOpSlot player={player} color={color} />
            <CritOpSummary card={critOp} />
          </div>
        )}
      </div>
    </div>
  )
}

export default PlayerBoard
