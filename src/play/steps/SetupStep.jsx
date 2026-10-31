import { useMemo, useState } from 'react'
import { getKillteamById, getKillteams } from '../../data/ktData.js'
import CritOpsCard from '../../components/CritOpsCard.jsx'
import BoardSvg from '../../board/BoardSvg.jsx'
import { CRIT_OPS, MAPS, arrangementsForMap, getCritOp } from '../../board/boardData.js'
import { seatColor } from '../../board/colors.js'
import { defaultUnitKeys, factionEquipmentIds } from '../../rules/roster.js'
import { usePlayer } from '../usePlayer.js'

// How complete each army's data/rules support is (was hard-coded in SelectArmy).
const ARMY_STATUS = {
  'VOT-HKY': 'ready',
  'TAU-VESP': 'ready',
  'CHAOS-LEG': 'partial',
  'ORK-KOM': 'partial',
  'IMP-INB': 'partial',
  'IMP-PHO': 'partial',
}

const layoutName = (arrangement) => arrangement.name.replace('Arrangement ', 'Layout ')

function KillteamPicker() {
  const { me, act } = usePlayer()
  const [query, setQuery] = useState('')
  const [browsing, setBrowsing] = useState(!me.killteamId)
  const killteams = useMemo(() => getKillteams(), [])
  const selected = getKillteamById(me.killteamId)

  const filtered = useMemo(() => {
    const lower = query.trim().toLowerCase()
    if (!lower) return killteams
    return killteams.filter((team) =>
      [team.killteamName, team.factionId, team.archetypes].filter(Boolean).some((field) => field.toLowerCase().includes(lower)),
    )
  }, [killteams, query])

  const choose = (killteamId) => {
    const killteam = getKillteamById(killteamId)
    act({
      type: 'setup/killteam',
      killteamId,
      units: defaultUnitKeys(killteam),
      // The team's own equipment starts picked (up to four options); players swap from there.
      equipment: factionEquipmentIds(killteam),
    })
    setBrowsing(false)
  }

  if (selected && !browsing) {
    return (
      <div className="chosen-row">
        <div>
          <div className="chosen-title">{selected.killteamName}</div>
          <div className="muted">{selected.archetypes}</div>
        </div>
        <button type="button" className="btn" onClick={() => setBrowsing(true)}>
          Change
        </button>
      </div>
    )
  }

  return (
    <>
      <input
        className="search"
        type="search"
        placeholder="Search kill teams"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="team-list">
        {filtered.map((team) => (
          <button
            key={team.killteamId}
            type="button"
            className={`team-row${team.killteamId === me.killteamId ? ' is-selected' : ''}`}
            onClick={() => choose(team.killteamId)}
          >
            <span className={`status-dot is-${ARMY_STATUS[team.killteamId] ?? 'none'}`} />
            <span className="team-row-name">{team.killteamName}</span>
            <span className="muted">{team.archetypes}</span>
          </button>
        ))}
      </div>
    </>
  )
}

function SetupStep() {
  const { state: game, seat, opponent, opponentSeat, act } = usePlayer()
  const { table } = game
  const arrangements = arrangementsForMap(table.mapId)
  const critOp = getCritOp(table.critOpId)
  const opponentTeam = getKillteamById(opponent.killteamId)
  const myZone = table.dropZones[seat]
  const nameOf = (candidate) => game.players[candidate].name
  const mapName = MAPS.find((map) => map.id === table.mapId)?.name ?? 'Map'
  const arrangement = arrangements.find((candidate) => candidate.id === table.arrangementId)
  const arrangementName = arrangement ? layoutName(arrangement) : ''

  return (
    <section className="step">
      <div className="step-block">
        <h3>1 · Your kill team</h3>
        <KillteamPicker />
        <p className="muted">
          {opponent.name}: {opponentTeam ? opponentTeam.killteamName : 'choosing…'}
        </p>
      </div>

      <div className="step-block">
        <h3>2 · Killzone</h3>
        <div className="roll-row">
          <span className="roll-result">
            {mapName} · {arrangementName}
          </span>
          <button type="button" className="btn" onClick={() => act({ type: 'setup/rollKillzone' })}>
            Re-roll
          </button>
        </div>
        <div className="board-preview">
          <BoardSvg game={game} show={{ grid: false }} />
        </div>
        <details className="manual-pick">
          <summary>Choose manually</summary>
          <div className="segmented">
            {MAPS.map((map) => (
              <button
                key={map.id}
                type="button"
                className={map.id === table.mapId ? 'is-selected' : ''}
                onClick={() => act({ type: 'setup/map', mapId: map.id, arrangementId: arrangementsForMap(map.id)[0]?.id })}
              >
                {map.name}
              </button>
            ))}
          </div>
          <div className="segmented">
            {arrangements.map((arrangement) => (
              <button
                key={arrangement.id}
                type="button"
                className={arrangement.id === table.arrangementId ? 'is-selected' : ''}
                onClick={() => act({ type: 'setup/map', mapId: table.mapId, arrangementId: arrangement.id })}
              >
                {layoutName(arrangement)}
              </button>
            ))}
          </div>
        </details>
      </div>

      <div className="step-block">
        <h3>3 · Crit op</h3>
        <div className="roll-row">
          <span className="roll-result">{critOp ? `${critOp.opNumber} · ${critOp.opName}` : '—'}</span>
          <button type="button" className="btn" onClick={() => act({ type: 'setup/rollCritOp' })}>
            Re-roll
          </button>
        </div>
        {critOp ? (
          <div className="critop-preview">
            <CritOpsCard card={critOp} />
          </div>
        ) : null}
        <details className="manual-pick">
          <summary>Choose manually</summary>
          <div className="segmented is-wrap">
            {CRIT_OPS.map((card) => (
              <button
                key={card.id}
                type="button"
                className={card.id === table.critOpId ? 'is-selected' : ''}
                onClick={() => act({ type: 'setup/critOp', critOpId: card.id })}
              >
                {card.opNumber} · {card.opName}
              </button>
            ))}
          </div>
        </details>
      </div>

      <div className="step-block">
        <h3>4 · Roll off: who won?</h3>
        <div className="segmented">
          {[seat, opponentSeat].map((candidate) => (
            <button
              key={candidate}
              type="button"
              className={table.rollOffWinner === candidate ? 'is-selected' : ''}
              style={{ '--seat-color': seatColor(candidate) }}
              onClick={() => act({ type: 'setup/rollOff', winner: candidate })}
            >
              {candidate === seat ? 'I won' : `${nameOf(candidate)} won`}
            </button>
          ))}
        </div>
      </div>

      <div className="step-block">
        <h3>5 · Initiative</h3>
        {!table.rollOffWinner ? (
          <p className="muted">Roll off first.</p>
        ) : table.rollOffWinner === seat ? (
          <>
            <p className="muted">You won the roll-off: decide who has initiative. They pick the drop zone and set up first; the other player gets the Re-roll initiative card.</p>
            <div className="segmented">
              {[seat, opponentSeat].map((candidate) => (
                <button
                  key={candidate}
                  type="button"
                  className={table.initiativeSeat === candidate ? 'is-selected' : ''}
                  style={{ '--seat-color': seatColor(candidate) }}
                  onClick={() => act({ type: 'setup/initiative', seat: candidate })}
                >
                  {candidate === seat ? 'I take initiative' : `${nameOf(candidate)} takes initiative`}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="muted">
            {table.initiativeSeat
              ? `${table.initiativeSeat === seat ? 'You have' : `${nameOf(table.initiativeSeat)} has`} initiative.`
              : `${nameOf(table.rollOffWinner)} decides who has initiative.`}
          </p>
        )}
        {table.initiativeSeat && table.initiativeSeat !== seat ? (
          <p className="muted">You gain the Re-roll initiative card.</p>
        ) : null}
      </div>

      <div className="step-block">
        <h3>6 · Drop zone</h3>
        {!table.initiativeSeat ? (
          <p className="muted">Decide initiative first.</p>
        ) : table.initiativeSeat === seat ? (
          <>
            <p className="muted">You have initiative: pick your drop zone.</p>
            <div className="segmented">
              {['A', 'B'].map((zone) => (
                <button
                  key={zone}
                  type="button"
                  className={myZone === zone ? 'is-selected' : ''}
                  onClick={() => act({ type: 'setup/dropZone', zone })}
                >
                  {myZone === zone ? `Drop zone ${zone} (mine)` : `Drop zone ${zone}`}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="muted">
            {myZone ? `You're in drop zone ${myZone}.` : `${nameOf(table.initiativeSeat)} picks the drop zone.`}
          </p>
        )}
      </div>
    </section>
  )
}

export default SetupStep
