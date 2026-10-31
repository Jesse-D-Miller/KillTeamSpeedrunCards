import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { gameCount, leaderboard, prizes } from '../../shared/stats.js'
import { getKillteamById } from '../data/ktData.js'
import './stats.css'

// The secret stats page (tap the logo on the opening screen): a win-rate leaderboard
// and podium prizes from every game that reached the results. The games live on the
// table server in server/data/history.json, edited by hand when something needs fixing.

const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' }
const PLACE_NAMES = { 1: '1st', 2: '2nd', 3: '3rd' }

const formatDuration = (ms) => {
  if (ms < 60000) return '<1m'
  const minutes = Math.round(ms / 60000)
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m` : `${minutes}m`
}

const formatValue = (kind, value) => {
  if (kind === 'duration') return formatDuration(value)
  if (kind === 'vp') return `${value} VP`
  return String(value)
}

const teamName = (killteamId) => (killteamId ? getKillteamById(killteamId)?.killteamName ?? killteamId : '')

function Leaderboard({ rows }) {
  return (
    <section className="stats-section">
      <h2>Leaderboard</h2>
      <ol className="stats-board">
        {rows.map((row, index) => (
          <li key={row.key} className="stats-row" data-rank={index + 1}>
            <span className="stats-rank">{index + 1}</span>
            <span className="stats-who">
              <strong className="stats-name">{row.name}</strong>
              <span className="stats-team">{teamName(row.killteamId)}</span>
            </span>
            <span className="stats-rate">
              <strong>{Math.round(row.winRate * 100)}%</strong>
              <span>win rate</span>
            </span>
            <span className="stats-figures">
              <span>
                <strong>
                  {row.wins}–{row.losses}
                  {row.draws ? `–${row.draws}` : ''}
                </strong>
                {row.draws ? 'W–L–D' : 'W–L'}
              </span>
              <span>
                <strong>{row.avgVp.toFixed(1)}</strong>avg VP
              </span>
              <span>
                <strong>{row.games}</strong>
                {row.games === 1 ? 'game' : 'games'}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Prize({ prize }) {
  return (
    <article className="stats-prize" data-prize={prize.id}>
      <h3>
        {prize.title}
        {prize.note ? <span className="stats-note">{prize.note}</span> : null}
      </h3>
      {prize.places.length ? (
        <ol>
          {prize.places.map((row, index) => (
            <li key={`${row.name}-${index}`} data-place={row.place}>
              <span className="stats-medal" role="img" aria-label={PLACE_NAMES[row.place]}>
                {MEDALS[row.place]}
              </span>
              <span className="stats-prize-who">
                {row.name}
                {row.detail && prize.kind !== 'duration' ? <small>{row.detail}</small> : null}
              </span>
              <strong className="stats-prize-value">{formatValue(prize.kind, row.value)}</strong>
            </li>
          ))}
        </ol>
      ) : (
        <p className="stats-empty-prize">Up for grabs</p>
      )}
    </article>
  )
}

function StatsPage() {
  const [games, setGames] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    fetch('/api/stats', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(response.statusText))))
      .then((data) => live && setGames(Array.isArray(data) ? data : []))
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [])

  const count = games ? gameCount(games) : 0

  return (
    <div className="stats-page">
      <header className="stats-header">
        <Link to="/" className="stats-back" aria-label="Back">
          ←
        </Link>
        <h1>Hall of fame</h1>
        {games ? <span className="stats-count">{count === 1 ? '1 game' : `${count} games`}</span> : null}
      </header>
      {failed ? (
        <p className="stats-message">Stats are kept on the table server. Open this page from the table&apos;s address.</p>
      ) : !games ? (
        <p className="stats-message">Loading…</p>
      ) : !count ? (
        <p className="stats-message">No finished games yet. Every game that reaches the results is counted here.</p>
      ) : (
        <>
          <Leaderboard rows={leaderboard(games)} />
          <section className="stats-section">
            <h2>Prizes</h2>
            <div className="stats-prizes">
              {prizes(games).map((prize) => (
                <Prize key={prize.id} prize={prize} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

export default StatsPage
