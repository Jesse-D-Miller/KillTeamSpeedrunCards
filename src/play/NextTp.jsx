import { useState } from 'react'
import { createPortal } from 'react-dom'
import { MAX_TP, SEATS, readyUnitKeys } from '../../shared/game.js'
import ToolIcon from './ToolIcon.jsx'
import { usePlayer } from './usePlayer.js'

// Ending a turning point: both players confirm it (battle/readyNextTp), and it moves
// on once the second does.

// unactivated: how many living operatives on each side are still ready.
// waiting: the opponent's name if they've already confirmed, else null.
// double: the confirm button needs a second tap (the map drawer's Next TP).
export function EndTurnSheet({ tp, unactivated = 0, waiting = null, double = false, onCancel, onConfirm }) {
  const last = tp >= MAX_TP
  const [armed, setArmed] = useState(false)
  // Drawn on the page itself, so it's centred on the screen even when opened from the
  // map's drawer (which would otherwise hold it).
  return createPortal(
    <div className="sheet-backdrop" onClick={onCancel}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-head">
          <h3>{last ? 'End the game?' : `End turning point ${tp}?`}</h3>
        </div>
        <div className="sheet-body">
          {unactivated ? (
            <p className="end-turn-warning">
              {unactivated} operative{unactivated === 1 ? ' hasn’t' : 's haven’t'} activated yet this turning point.
            </p>
          ) : null}
          <p className="muted">
            {waiting
              ? `${waiting} is ready: confirming moves on straight away.`
              : 'The turning point moves on once both players have confirmed.'}
          </p>
          {last ? (
            <p>This ends turning point {tp} and goes to final scoring.</p>
          ) : (
            <ul className="end-turn-list">
              <li>Both players gain 1 CP</li>
              <li>All operatives become ready</li>
              <li>Then roll off for initiative in turning point {tp + 1}</li>
            </ul>
          )}
          <div className="row end-turn-actions">
            <button type="button" className="btn" onClick={onCancel}>
              Cancel
            </button>
            <button
              type="button"
              className="btn is-primary"
              onClick={() => (double && !armed ? setArmed(true) : onConfirm())}
            >
              {double && armed ? 'Tap again to confirm' : last ? 'Ready to end' : `Ready for TP ${tp + 1}`}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// Next TP (End game in turning point 4) at the top of the drawer. It shows how many
// operatives still haven't activated; ending the turning point with some left asks for
// a second tap. Until the opponent confirms too, tapping it again takes mine back.
export function NextTpRailButton() {
  const { state: game, seat, opponent, opponentSeat, act } = usePlayer()
  const [confirmingTp, setConfirmingTp] = useState(null)
  const tp = game.battle.tp
  const tpReady = game.battle.tpReady ?? {}
  const unactivated = SEATS.reduce((sum, candidate) => sum + readyUnitKeys(game.players[candidate]).length, 0)
  const label = tp >= MAX_TP ? 'End game' : 'Next TP'
  if (tpReady[seat]) {
    return (
      <button
        type="button"
        className="rail-tool rail-phase-button is-selected"
        onClick={() => act({ type: 'battle/readyNextTp', fromTp: tp, ready: false })}
        aria-label={`Waiting for ${opponent.name} (tap to take back)`}
      >
        <ToolIcon tool="nextTp" />
        <span>Waiting for {opponent.name}</span>
      </button>
    )
  }
  return (
    <>
      <button
        type="button"
        className="rail-tool rail-phase-button is-primary"
        onClick={() => setConfirmingTp(tp)}
        aria-label={tpReady[opponentSeat] ? `${label} · ${opponent.name} is ready` : label}
      >
        <ToolIcon tool="nextTp" />
        <span>{tpReady[opponentSeat] ? `${label} · ${opponent.name} is ready` : label}</span>
        {unactivated ? <small className="rail-tool-note">{unactivated} left to activate</small> : null}
      </button>
      {confirmingTp === tp ? (
        <EndTurnSheet
          tp={tp}
          unactivated={unactivated}
          waiting={tpReady[opponentSeat] ? opponent.name : null}
          double={unactivated > 0}
          onCancel={() => setConfirmingTp(null)}
          onConfirm={() => {
            setConfirmingTp(null)
            act({ type: 'battle/readyNextTp', fromTp: tp })
          }}
        />
      ) : null}
    </>
  )
}
