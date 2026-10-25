// Before the battle: what this phase is about and how far this player has got.
const PHASE_STEPS = {
  lobby: {
    title: 'Joining',
    text: 'Scan your QR code with an iPad and enter your name.',
  },
  setup: {
    title: 'Set up the battle',
    text: 'Pick kill teams. Roll off: the winner decides who has initiative, and that player picks a drop zone.',
  },
  muster: {
    title: 'Muster',
    text: 'Choose operatives, weapons and up to four equipment options, then a secret tac op.',
  },
  deploy: {
    title: 'Deploy',
    text: 'Alternate placing equipment, then a third of your team at a time, initiative first. Operatives start on Conceal.',
  },
}

const checklistFor = (phase, player, connected) => {
  if (phase === 'lobby') return [['iPad connected', connected]]
  if (phase === 'setup') return [['Kill team', Boolean(player.killteamId)]]
  if (phase === 'muster') {
    return [
      ['Operatives', player.units.length > 0],
      ['Equipment', player.equipment.length > 0],
      ['Tac op', Boolean(player.tacOp)],
    ]
  }
  return []
}

function PhaseCard({ phase, player, ready, connected }) {
  const step = PHASE_STEPS[phase]
  if (!step) return null
  return (
    <section className="pb-section pb-phase">
      <h3>{step.title}</h3>
      <p className="pb-phase-text">{step.text}</p>
      <ul className="pb-checklist">
        {checklistFor(phase, player, connected).map(([label, done]) => (
          <li key={label} className={done ? 'is-done' : ''}>
            {label}
          </li>
        ))}
      </ul>
      <div className={`pb-ready${ready ? ' is-ready' : ''}`}>{ready ? 'Ready ✓' : 'Not ready yet'}</div>
    </section>
  )
}

export default PhaseCard
