import { otherSeat, turnState } from '../../../shared/game.js'
import { getKillteamById } from '../../data/ktData.js'
import { getCritOp } from '../../board/boardData.js'
import { seatColor } from '../../board/colors.js'
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
function PlayerBoard({ game, seat, rotation, connected, widthPx, heightPx }) {
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
        className={`pb-board ${landscape ? 'is-landscape' : 'is-portrait'} ${inGame ? 'is-game' : 'is-setup'}`}
        style={{ ...size, '--seat-color': color, transform: `translate(-50%, -50%) rotate(${rotation}deg)` }}
        data-seat={seat}
      >
        <div className="pb-area-id">
          <IdentityBar
            player={player}
            killteam={killteam}
            connected={connected}
            hasInitiative={inGame && game.battle.initiativeByTp[tp] === seat}
            turnBadge={turnBadge}
          />
        </div>

        {inGame ? (
          <>
            <div className="pb-area-score">
              <ScoreBlock player={player} final={final} />
            </div>
            <div className="pb-area-turn">
              <TurnTracker player={player} tp={tp} final={final} />
            </div>
            <div className="pb-area-kill">
              <KillOpTrack enemy={enemy} />
            </div>
            <div className="pb-area-ploys">
              <PloyList player={player} killteam={killteam} tp={tp} />
            </div>
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

        <div className="pb-area-cards">
          <TacOpSlot player={player} color={color} />
          <CritOpSummary card={critOp} />
        </div>
      </div>
    </div>
  )
}

export default PlayerBoard
