import { usePlayer } from '../usePlayer.js'

const CHECKLIST = [
  ['Set up equipment', 'Alternate placing equipment one piece at a time, starting with the player with initiative.'],
  [
    'Deploy operatives',
    'Alternate placing a third of your kill team at a time (rounded up), starting with the player with initiative. Operatives go wholly within your drop zone with a Conceal order.',
  ],
]

// Approved Ops 2025 has no scouting step, and the primary op is chosen in secret
// during the first turning point, so deploying is all that happens here.
function DeployStep({ onOpenMap }) {
  const { state: game, seat } = usePlayer()
  const initiativeSeat = game.table.initiativeSeat
  const firstNote = initiativeSeat
    ? initiativeSeat === seat
      ? 'You have initiative, so you set up first.'
      : `${game.players[initiativeSeat].name} has initiative and sets up first.`
    : null

  return (
    <section className="step">
      <div className="step-block">
        <h3>Deploy</h3>
        {firstNote ? <p className="muted">{firstNote}</p> : null}
        <ul className="checklist">
          {CHECKLIST.map(([title, text]) => (
            <li key={title}>
              <strong>{title}</strong>
              <span className="muted">{text}</span>
            </li>
          ))}
        </ul>
        <button type="button" className="btn" onClick={onOpenMap}>
          Open map to place tokens
        </button>
      </div>
    </section>
  )
}

export default DeployStep
