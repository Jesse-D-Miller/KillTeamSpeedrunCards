import { MAX_CATEGORY_VP, SCORE_CATEGORIES, primaryBonus, totalVp } from '../../../shared/game.js'

// Two stats with one focal point (VP), then each op's VP as a bar out of its
// maximum, so progress reads by length from across the table. The primary op stays
// hidden until results.
function ScoreBlock({ player, final }) {
  return (
    <section className="pb-section pb-score">
      <div className="pb-stats">
        <div className="pb-stat is-vp">
          <span className="pb-eyebrow">Victory points</span>
          <span className="pb-big-value">{totalVp(player, { withPrimary: final })}</span>
        </div>
        <div className="pb-stat is-cp">
          <span className="pb-eyebrow">Command</span>
          <span className="pb-big-value">{player.cp}</span>
        </div>
      </div>
      <ul className="pb-vp-bars">
        {SCORE_CATEGORIES.map(([key, label]) => {
          const value = player.score?.[key] ?? 0
          return (
            <li key={key}>
              <span className="pb-vp-label">{label.replace(' op', '')}</span>
              <span className="pb-vp-track" aria-hidden="true">
                {Array.from({ length: MAX_CATEGORY_VP }, (_, index) => (
                  <i key={index} className={index < value ? 'is-on' : ''} />
                ))}
              </span>
              <b className="pb-vp-value">{value}</b>
            </li>
          )
        })}
        <li className="is-primary">
          <span className="pb-vp-label">Primary</span>
          <span className="pb-vp-hidden">{final ? '' : 'revealed at end'}</span>
          <b className="pb-vp-value">{final ? `+${primaryBonus(player)}` : '?'}</b>
        </li>
      </ul>
    </section>
  )
}

export default ScoreBlock
