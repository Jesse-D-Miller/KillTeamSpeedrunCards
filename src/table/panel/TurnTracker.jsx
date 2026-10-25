import { MAX_TP } from '../../../shared/game.js'
import { activationSummary } from '../../rules/activations.js'

// Order the pips so each state forms its own group (proximity), most urgent first.
const STATE_ORDER = ['active', 'ready', 'expended', 'dead']

function TurnTracker({ player, tp, final }) {
  const summary = activationSummary(player.units, player.unitState)
  const pips = [...summary.pips].sort((a, b) => STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state))
  const legend = [
    ['active', summary.active],
    ['expended', summary.expended],
    ['dead', summary.dead],
  ].filter(([, count]) => count > 0)

  return (
    <section className="pb-section pb-turn">
      <div className="pb-section-head">
        <h3 className="pb-tp">{final ? 'Final' : `TP ${tp} / ${MAX_TP}`}</h3>
      </div>
      {/* Same step style as the kill grade track. */}
      <ol className="pb-steps pb-tp-track">
        {Array.from({ length: MAX_TP }, (_, index) => index + 1).map((step) => (
          <li key={step} className={final || step < tp ? 'is-done' : step === tp ? 'is-current' : ''}>
            {step}
          </li>
        ))}
      </ol>

      {final ? null : (
        <div className="pb-ready-hero">
          <span className="pb-ready-count">
            <b>{summary.ready}</b>
            <span>ready to activate</span>
          </span>
        </div>
      )}

      <div className="pb-pips" aria-label={`${summary.ready} ready, ${summary.expended} expended, ${summary.dead} dead`}>
        {pips.map((pip) => (
          <span key={pip.key} className={`pb-pip is-${pip.state}`} />
        ))}
      </div>
      {legend.length ? (
        <ul className="pb-legend">
          {legend.map(([state, count]) => (
            <li key={state}>
              <span className={`pb-pip is-${state} is-mini`} />
              {count} {state}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

export default TurnTracker
