import './TacOpCard.css'

// An Approved Ops 2025 tac op as a text card (the pack has no card photos here).
// compact: the projector's panel version, name and scoring only.
function TacOpCard({ tacOp, compact = false, selected = false }) {
  if (!tacOp) return null
  return (
    <article className={`tacop-card${compact ? ' is-compact' : ''}${selected ? ' is-selected' : ''}`}>
      <header className="tacop-card-head">
        <span className="tacop-card-archetype">Tac op · {tacOp.archetype}</span>
        <h4 className="tacop-card-name">{tacOp.name}</h4>
      </header>
      {compact ? null : (
        <p className="tacop-card-reveal">
          <strong>Reveal:</strong> {tacOp.reveal}
        </p>
      )}
      {compact
        ? null
        : tacOp.rules.map((rule) => (
            <p key={rule} className="tacop-card-rule">
              {rule}
            </p>
          ))}
      {tacOp.action && !compact ? (
        <div className="tacop-card-action">
          <div className="tacop-card-action-head">
            <span>{tacOp.action.name}</span>
            <span className="tacop-card-ap">{tacOp.action.ap}AP</span>
          </div>
          <p>{tacOp.action.effect}</p>
          <p className="tacop-card-conditions">{tacOp.action.conditions}</p>
        </div>
      ) : null}
      <div className="tacop-card-vp">
        <span className="tacop-card-vp-title">Victory points</span>
        {tacOp.vp.map((line) => (
          <p key={line}>{line}</p>
        ))}
        {tacOp.cap ? <p className="tacop-card-cap">{tacOp.cap}</p> : null}
      </div>
    </article>
  )
}

export default TacOpCard
