import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getKillteams } from '../data/ktData.js'
import { resolveWsUrl } from '../state/wsUrl.js'
import './SelectArmy.css'

const WS_URL = resolveWsUrl()

const normalizeText = (value) => value?.replace(/\s+/g, ' ').trim() ?? ''

const truncate = (value, maxLength = 180) => {
  const cleaned = normalizeText(value)
  if (cleaned.length <= maxLength) return cleaned
  return `${cleaned.slice(0, maxLength).trim()}...`
}

function SelectArmy() {
  const [query, setQuery] = useState('')
  const killteams = useMemo(() => getKillteams(), [])

  const syncKillteamSelection = ({ roomCode, playerId, playerName, killteamId }) => {
    if (!roomCode || !playerId || !killteamId) return
    try {
      const selectionRaw = localStorage.getItem('kt-selection-state')
      const selection = selectionRaw ? JSON.parse(selectionRaw) : {}
      const selectedUnits = Array.isArray(selection?.selectedUnitsByTeam?.[killteamId])
        ? selection.selectedUnitsByTeam[killteamId]
        : []
      const socket = new WebSocket(WS_URL)
      socket.addEventListener('open', () => {
        socket.send(
          JSON.stringify({
            type: 'sync_init',
            code: roomCode,
            name: playerName || '',
            playerId,
          }),
        )
        socket.send(
          JSON.stringify({
            type: 'sync_state',
            code: roomCode,
            playerId,
            state: {
              name: playerName || '',
              playerId,
              killteamId,
              selectedUnits,
              selectedEquipment: [],
              activeStratPloys: [],
              unitStates: {},
              deadUnits: {},
              woundsByUnit: {},
              stanceByUnit: {},
              statusesByUnit: {},
              aplAdjustByUnit: {},
              legionaryMarkByUnit: {},
            },
          }),
        )
        window.setTimeout(() => {
          try {
            socket.close()
          } catch {
            // noop
          }
        }, 150)
      })
      socket.addEventListener('error', () => {
        try {
          socket.close()
        } catch {
          // noop
        }
      })
    } catch (error) {
      console.warn('Failed to sync killteam selection.', error)
    }
  }

  const handleSelectKillteam = (killteamId) => {
    try {
      const roomCode =
        sessionStorage.getItem('kt-room-code') ||
        localStorage.getItem('kt-room-code') ||
        ''
      const playerId =
        sessionStorage.getItem('kt-player-id') ||
        localStorage.getItem('kt-player-id') ||
        ''
      const playerName =
        sessionStorage.getItem('kt-player-name') ||
        localStorage.getItem('kt-player-name') ||
        ''
      const gameId = localStorage.getItem('kt-game-id') || ''
      localStorage.setItem('kt-last-killteam', killteamId)
      if (roomCode && playerId) {
        localStorage.setItem(
          `kt-room-player-killteam-${roomCode}-${playerId}`,
          killteamId,
        )
        if (playerName) {
          localStorage.setItem(
            `kt-room-player-name-${roomCode}-${playerId}`,
            String(playerName),
          )
        }
        if (gameId) {
          localStorage.setItem(
            `kt-room-player-killteam-${roomCode}-${playerId}-${gameId}`,
            killteamId,
          )
        }
        syncKillteamSelection({ roomCode, playerId, playerName, killteamId })
      }
    } catch (error) {
      console.warn('Failed to persist selected killteam.', error)
    }
  }

  const filteredKillteams = useMemo(() => {
    if (!query) return killteams
    const lower = query.toLowerCase()
    return killteams.filter((team) =>
      [
        team.killteamName,
        team.factionId,
        team.archetypes,
        team.description,
      ]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(lower)),
    )
  }, [killteams, query])

  return (
    <div className="app-shell">
      <main className="app-content">
        <section className="page select-army">
          <div className="select-army-header">
            <div>
              <p className="eyebrow">Select Army</p>
              <h1>Choose your kill team.</h1>
              <p className="lede">
                Search by name, faction, or archetype to jump straight in.
              </p>
            </div>
            <div className="select-army-search">
              <label htmlFor="army-search">Search armies</label>
              <input
                id="army-search"
                type="search"
                placeholder="e.g. Angels of Death"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>

          <div className="select-army-grid">
            {filteredKillteams.map((team) => {
              const statusClass =
                team.killteamId === 'VOT-HKY'
                  ? 'status-dot status-dot--green'
                  : team.killteamId === 'TAU-VESP'
                    ? 'status-dot status-dot--green'
                    : team.killteamId === 'CHAOS-LEG'
                      ? 'status-dot status-dot--yellow'
                      : team.killteamId === 'ORK-KOM'
                        ? 'status-dot status-dot--yellow'
                    : 'status-dot status-dot--red'
              const statusLabel =
                team.killteamId === 'VOT-HKY'
                  ? 'Army ready'
                  : team.killteamId === 'TAU-VESP'
                    ? 'Army ready'
                    : team.killteamId === 'CHAOS-LEG'
                      ? 'Army in progress'
                      : team.killteamId === 'ORK-KOM'
                        ? 'Army in progress'
                    : 'Army not started'

              return (
              <Link
                className="select-army-card"
                key={team.killteamId}
                to="/set-up-the-battle"
                state={{ killteamId: team.killteamId }}
                aria-label={`Select ${team.killteamName}`}
                onClick={() => handleSelectKillteam(team.killteamId)}
              >
                <div className="select-army-card-header">
                  <div>
                    <h2>{team.killteamName}</h2>
                    <div className="select-army-meta">
                      <span>{team.factionId}</span>
                      <span>·</span>
                      <span>{team.archetypes}</span>
                    </div>
                  </div>
                  <span className={statusClass} aria-label={statusLabel} />
                </div>
                <p className="select-army-description">
                  {truncate(team.description)}
                </p>
              </Link>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}

export default SelectArmy
