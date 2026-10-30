import { cardLabel } from '../../rules/initiative.js'

const TURN_LABELS = { activating: 'Activating', next: 'Up next', counteract: 'Counteract' }

// Name, team, connection and initiative, plus any initiative cards the player is
// holding (Approved Ops 2025; cards are public once gained). The initiative and turn
// tags sit on their own row under the name, so the name gets the bar's full width.
// turnBadge: 'activating' | 'next' | 'counteract' | null, during the Firefight phase.
// compact: just who it is (during a shot or fight, when the name needs the room).
function IdentityBar({ player, killteam, connected, hasInitiative, turnBadge = null, compact = false }) {
  const cards = compact ? [] : (player.initiativeCards ?? []).filter((card) => !card.used)
  const initiative = hasInitiative && !compact
  const turn = turnBadge && !compact ? turnBadge : null
  return (
    <header className="pb-identity">
      <span className={`pb-dot${connected ? ' is-online' : ''}`} title={connected ? 'iPad connected' : 'iPad offline'} />
      <div className="pb-identity-text">
        <div className="pb-name">{player.name}</div>
        <div className="pb-team">{killteam?.killteamName ?? 'Choosing a kill team…'}</div>
        {initiative || turn || cards.length ? (
          <div className="pb-identity-tags">
            {initiative ? <span className="pb-initiative">Initiative</span> : null}
            {turn ? <span className={`pb-turn-badge is-${turn}`}>{TURN_LABELS[turn]}</span> : null}
            {cards.length ? (
              <div className="pb-init-cards" aria-label="Initiative cards">
                {cards.map((card) => (
                  <span key={card.id} className="pb-init-card">
                    {cardLabel(card)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  )
}

export default IdentityBar
