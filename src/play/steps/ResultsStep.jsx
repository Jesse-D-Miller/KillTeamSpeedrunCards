import { useState } from 'react'
import { SCORE_CATEGORIES, SEATS, primaryBonus, primaryCategory, totalVp } from '../../../shared/game.js'
import { isHidden } from '../../../shared/views.js'
import TacOpCard from '../../components/TacOpCard.jsx'
import { getKillteamById } from '../../data/ktData.js'
import { getTacOp } from '../../data/tacOps.js'
import { primaryOpCard } from '../../rules/cards.js'
import PrimaryOpCard from '../PrimaryOpCard.jsx'
import { seatColor } from '../../board/colors.js'
import { usePlayer } from '../usePlayer.js'

const formatDuration = (ms) => {
  if (!ms || ms < 0) return '—'
  const minutes = Math.round(ms / 60000)
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`
}

function ResultsStep() {
  const { state: game, act } = usePlayer()
  const [confirm, setConfirm] = useState(false)
  const [a, b] = SEATS.map((seat) => totalVp(game.players[seat], { withPrimary: true }))
  const winner = a === b ? null : a > b ? 'A' : 'B'

  return (
    <section className="step">
      <h2>{winner ? `${game.players[winner].name} wins` : 'Draw'}</h2>
      <p className="muted">Battle time {formatDuration(game.battle.endedAt - game.battle.startedAt)}</p>
      <div className="results-grid">
        {SEATS.map((seat) => {
          const player = game.players[seat]
          return (
            <div key={seat} className="results-card" style={{ '--seat-color': seatColor(seat) }}>
              <div className="results-name">{player.name}</div>
              <div className="muted">{getKillteamById(player.killteamId)?.killteamName}</div>
              <div className="results-vp">{totalVp(player, { withPrimary: true })} VP</div>
              <table className="results-breakdown">
                <tbody>
                  {SCORE_CATEGORIES.map(([key, label]) => (
                    <tr key={key}>
                      <td>{label}</td>
                      <td>{player.score[key]}</td>
                    </tr>
                  ))}
                  <tr>
                    <td>Primary op{primaryCategory(player) ? ` (½ ${SCORE_CATEGORIES.find(([key]) => key === primaryCategory(player))[1]})` : ''}</td>
                    <td>+{primaryBonus(player)}</td>
                  </tr>
                </tbody>
              </table>
              <div className="results-cards">
                {player.tacOp && !isHidden(player.tacOp) ? <TacOpCard tacOp={getTacOp(player.tacOp.id)} compact /> : null}
                {primaryOpCard(player.primaryOp) ? (
                  <PrimaryOpCard category={player.primaryOp.category} />
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
      <div className="row">
        <button type="button" className="btn" onClick={() => act({ type: 'phase/set', phase: 'battle' })}>
          Back to battle
        </button>
        {confirm ? (
          <button type="button" className="btn is-danger" onClick={() => act({ type: 'game/reset' })}>
            Tap again to start a new game
          </button>
        ) : (
          <button type="button" className="btn is-primary" onClick={() => setConfirm(true)}>
            New game
          </button>
        )}
      </div>
    </section>
  )
}

export default ResultsStep
