import { useMemo } from 'react'
import { tokenRules } from '../rules/tokenRules.js'
import { RuleText } from './RuleText.jsx'

// What a marker or token does, opened from its action ring and shown beside it.
//   marker: the board marker; at: { x, y } screen point beside it; viewer: this seat.
const POPOVER_WIDTH = 380
// Its tallest (as in the CSS): 70% of the screen, at most 560px.
const popoverHeight = () => Math.min(window.innerHeight * 0.7, 560)

function TokenRules({ marker, game, viewer, at, onClose }) {
  const { title, rules } = useMemo(() => tokenRules(game, marker, viewer), [game, marker, viewer])
  const left = Math.min(Math.max(12, at.x + 60), window.innerWidth - POPOVER_WIDTH - 12)
  const top = Math.max(12, Math.min(at.y - 120, window.innerHeight - popoverHeight() - 12))
  return (
    <div className="rules-popover-backdrop" onClick={onClose}>
      <section
        className="rules-popover glass"
        role="dialog"
        aria-label={`${title} rules`}
        style={{ left, top, width: POPOVER_WIDTH }}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="rules-popover-head">
          <h3>{title}</h3>
          <button type="button" className="btn is-small" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="rules-popover-body">
          {rules.length ? (
            rules.map((rule, index) => (
              <article key={`${rule.name}-${index}`} className="rules-popover-rule">
                {rule.name ? (
                  <strong>
                    {rule.name}
                    {rule.ap != null ? <span className="rules-popover-ap">{rule.ap}AP</span> : null}
                  </strong>
                ) : null}
                <RuleText text={rule.text} />
              </article>
            ))
          ) : (
            <p className="muted">No rules found for this token.</p>
          )}
        </div>
      </section>
    </div>
  )
}

export default TokenRules
