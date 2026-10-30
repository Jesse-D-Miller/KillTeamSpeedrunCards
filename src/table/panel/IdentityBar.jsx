import { cardLabel } from '../../rules/initiative.js'

const TURN_LABELS = { activating: 'Activating', next: 'Up next', counteract: 'Counteract' }

// Name, team, connection and initiative, plus any initiative cards the player is
// holding (Approved Ops 2025; cards are public once gained).
// turnBadge: 'activating' | 'next' | 'counteract' | null, during the Firefight phase.
// compact: just who it is (during a shot or fight, when the name needs the room).
function IdentityBar({ player, killteam, connected, hasInitiative, turnBadge = null, compact = false }) {
  const cards = compact ? [] : (player.initiativeCards ?? []).filter((card) => !card.used)
  return (
    <header className="pb-identity">
      <span className={`pb-dot${connected ? ' is-online' : ''}`} title={connected ? 'iPad connected' : 'iPad offline'} />
      <div className="pb-identity-text">
        <div className="pb-name">{player.name}</div>
        <div className="pb-team">{killteam?.killteamName ?? 'Choosing a kill team…'}</div>
      </div>
      {cards.length ? (
        <div className="pb-init-cards" aria-label="Initiative cards">
          {cards.map((card) => (
            <span key={card.id} className="pb-init-card">
              {cardLabel(card)}
            </span>
          ))}
        </div>
      ) : null}
      {turnBadge && !compact ? <span className={`pb-turn-badge is-${turnBadge}`}>{TURN_LABELS[turnBadge]}</span> : null}
      {hasInitiative && !compact ? <span className="pb-initiative">Initiative</span> : null}
    </header>
  )
}

export default IdentityBar
