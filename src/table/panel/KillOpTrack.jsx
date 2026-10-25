import { deriveDeadCount, deriveKillOpCount, killGrade } from '../../rules/killOpCounts.js'

const deadMap = (player) =>
  Object.fromEntries(Object.entries(player.unitState ?? {}).map(([key, unit]) => [key, unit.dead]))

// This player's kills against the enemy kill team, as kill grade progress.
function KillOpTrack({ enemy }) {
  const start = deriveKillOpCount(enemy.killteamId, enemy.units)
  const kills = deriveDeadCount(enemy.killteamId, deadMap(enemy))
  const progress = killGrade(start, kills)
  return (
    <section className="pb-section pb-killop">
      <div className="pb-section-head">
        <h3>Kill op</h3>
        {start ? (
          <span className="pb-kills">
            <b>{kills}</b> / {start} killed
          </span>
        ) : null}
      </div>
      {progress ? (
        <>
          <ol className="pb-steps pb-grades">
            {[1, 2, 3, 4, 5].map((grade) => (
              <li key={grade} className={grade <= progress.grade ? 'is-done' : ''}>
                {grade}
              </li>
            ))}
          </ol>
          <p className="pb-note">
            {progress.nextAt == null
              ? 'Maximum kill grade'
              : `${progress.nextAt - kills} more for grade ${progress.grade + 1}`}
          </p>
        </>
      ) : (
        <p className="pb-note">Starts once the enemy kill team is deployed.</p>
      )}
    </section>
  )
}

export default KillOpTrack
