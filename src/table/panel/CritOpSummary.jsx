// The shared crit op, set as panel-sized text so each player can read it facing them.
function CritOpSummary({ card }) {
  if (!card) return null
  const actions = card.missionActions ?? (card.missionAction ? [card.missionAction] : [])
  const victory = card.victoryPoints ?? {}
  const additional = card.additionalRules?.text
  return (
    <section className="pb-section pb-critop">
      <div className="pb-section-head">
        <h3>Crit op {card.opNumber}</h3>
        <span className="pb-critop-name">{card.opName}</span>
      </div>
      <div className="pb-critop-body">
        {actions.map((action) => (
          <div key={action.subtitle}>
            <div className="pb-action">
              <span className="pb-action-name">{action.subtitle}</span>
              {action.cost ? <span className="pb-cost">{action.cost}</span> : null}
            </div>
            <ul className="pb-rules">
              {(action.bullets ?? []).map((bullet, index) => (
                <li key={index} className={`is-${bullet.type || 'note'}`}>
                  {bullet.text}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <h4>Victory points</h4>
        {victory.text ? <p>{victory.text}</p> : null}
        <ul className="pb-rules">
          {(victory.bullets ?? []).map((text, index) => (
            <li key={index} className="is-vp">
              {text}
            </li>
          ))}
        </ul>
        {additional ? (
          <>
            <h4>Additional rules</h4>
            <p>{additional}</p>
          </>
        ) : null}
      </div>
    </section>
  )
}

export default CritOpSummary
