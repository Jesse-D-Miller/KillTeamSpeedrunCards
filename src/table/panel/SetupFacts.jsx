import { MAPS, arrangementsForMap } from '../../board/boardData.js'

// Public battle setup before the game: where and how this player is deploying.
function SetupFacts({ game, seat }) {
  const { table, players } = game
  const map = MAPS.find((candidate) => candidate.id === table.mapId)
  const layout = arrangementsForMap(table.mapId).find((candidate) => candidate.id === table.arrangementId)
  const zone = table.dropZones[seat]
  const initiative = table.initiativeSeat
  const winner = table.rollOffWinner
  const initiativeText = initiative
    ? initiative === seat
      ? 'Has initiative'
      : `${players[initiative].name} has it`
    : winner
      ? `${players[winner].name} won the roll-off`
      : 'Roll off'
  const facts = [
    ['Killzone', [map?.name, layout?.name.replace('Arrangement ', 'Layout ')].filter(Boolean).join(' · ')],
    ['Drop zone', zone ? `Zone ${zone}` : 'Not picked yet'],
    ['Initiative', initiativeText],
  ]
  return (
    <section className="pb-section pb-facts">
      <dl>
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export default SetupFacts
