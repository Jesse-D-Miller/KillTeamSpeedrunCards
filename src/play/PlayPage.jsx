import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  MAX_TP,
  SCORE_CATEGORIES,
  SEATS,
  musterBlocker,
  primaryBonus,
  primaryCategory,
  readyUnitKeys,
  totalVp,
} from '../../shared/game.js'
import { seatColor } from '../board/colors.js'
import { GameProvider } from '../net/GameProvider.jsx'
import { useGame } from '../net/gameContext.js'
import MapTab from './MapTab.jsx'
import OpponentTab from './OpponentTab.jsx'
import { RuleProvider } from './RuleText.jsx'
import TeamTab from './TeamTab.jsx'
import BattleStep from './steps/BattleStep.jsx'
import DeployStep from './steps/DeployStep.jsx'
import LobbyStep from './steps/LobbyStep.jsx'
import MusterStep from './steps/MusterStep.jsx'
import ResultsStep from './steps/ResultsStep.jsx'
import SetupStep from './steps/SetupStep.jsx'
import FullscreenButton from './FullscreenButton.jsx'
import AttackDrawer from './AttackDrawer.jsx'
import { useKeyboardOverlay } from './useKeyboardOverlay.js'
import { usePlayer } from './usePlayer.js'
import { useAttack } from './useAttack.js'
import './play.css'

const SP_KILLTEAMS = new Set(['VOT-HKY', 'TAU-VESP'])

const PHASES = {
  lobby: { label: 'Lobby', main: 'Join', tabs: ['main'] },
  setup: { label: 'Set up the battle', main: 'Setup', tabs: ['main', 'map'] },
  muster: { label: 'Muster', main: 'Muster', tabs: ['main', 'team', 'map'] },
  deploy: { label: 'Deploy', main: 'Deploy', tabs: ['main', 'map', 'team', 'opponent'] },
  battle: { label: 'Battle', main: 'Operatives', tabs: ['main', 'map', 'team', 'opponent'] },
  results: { label: 'Results', main: 'Results', tabs: ['main', 'map', 'opponent'] },
}

const TAB_LABELS = { map: 'Map', team: 'Team & rules', opponent: 'Opponent' }

function Counter({ label, value, onChange }) {
  return (
    <div className="counter">
      <span className="counter-label">{label}</span>
      <button type="button" onClick={() => onChange(-1)} aria-label={`Decrease ${label}`}>
        −
      </button>
      <span className="counter-value">{value}</span>
      <button type="button" onClick={() => onChange(1)} aria-label={`Increase ${label}`}>
        +
      </button>
    </div>
  )
}

function VpSheet({ onClose }) {
  const { state: game, me, act } = usePlayer()
  const bonusCategory = primaryCategory(me)
  // The primary op is revealed, and its VP added, when the game ends.
  const final = game.phase === 'results'
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-head">
          <h3>Victory points · {totalVp(me, { withPrimary: final })}</h3>
          <button type="button" className="btn is-primary" onClick={onClose}>
            Done
          </button>
        </div>
        <div className="sheet-body vp-sheet">
          {SCORE_CATEGORIES.map(([key, label]) => (
            <Counter
              key={key}
              label={label}
              value={me.score[key]}
              onChange={(delta) => act({ type: 'battle/vp', category: key, delta })}
            />
          ))}
          <p className="muted">
            {bonusCategory
              ? `Primary op: +${primaryBonus(me)} VP from ${SCORE_CATEGORIES.find(([key]) => key === bonusCategory)[1]}${final ? ', included' : ' (secret until the end)'}.`
              : 'No primary op chosen.'}
          </p>
        </div>
      </div>
    </div>
  )
}

// unactivated: how many living operatives on each side are still ready.
function EndTurnSheet({ tp, unactivated = 0, onCancel, onConfirm }) {
  const last = tp >= MAX_TP
  return (
    <div className="sheet-backdrop" onClick={onCancel}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-head">
          <h3>{last ? 'End the game?' : `End turning point ${tp}?`}</h3>
        </div>
        <div className="sheet-body">
          {unactivated ? (
            <p className="end-turn-warning">
              {unactivated} operative{unactivated === 1 ? ' hasn’t' : 's haven’t'} activated yet this turning point.
            </p>
          ) : null}
          {last ? (
            <p>This ends turning point {tp} and goes to final scoring.</p>
          ) : (
            <ul className="end-turn-list">
              <li>Both players gain 1 CP</li>
              <li>All operatives become ready</li>
              <li>Then roll off for initiative in turning point {tp + 1}</li>
            </ul>
          )}
          <div className="row end-turn-actions">
            <button type="button" className="btn" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className="btn is-primary" onClick={onConfirm}>
              {last ? 'End game' : `Start TP ${tp + 1}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PhaseAction() {
  const { state: game, seat, opponent, opponentSeat, act } = usePlayer()
  const [confirming, setConfirming] = useState(false)
  const tp = game.battle.tp

  if (game.phase === 'results') return null
  if (game.phase === 'battle') {
    return (
      <>
        <button type="button" className="btn is-primary" onClick={() => setConfirming(true)}>
          {tp >= MAX_TP ? 'End game' : 'Next TP'}
        </button>
        {confirming ? (
          <EndTurnSheet
            tp={tp}
            unactivated={SEATS.reduce((sum, candidate) => sum + readyUnitKeys(game.players[candidate]).length, 0)}
            onCancel={() => setConfirming(false)}
            onConfirm={() => {
              setConfirming(false)
              // fromTp: if both players confirm, the turning point only advances once.
              act({ type: 'battle/nextTp', fromTp: tp })
            }}
          />
        ) : null}
      </>
    )
  }
  const ready = game.ready[seat]
  // Mustering: Ready waits until operatives, equipment and a tac op are picked, and says
  // what's still missing.
  const blocked = game.phase === 'muster' && !ready ? musterBlocker(game.players[seat]) : null
  return (
    <button
      type="button"
      className={`btn ${ready ? 'is-ready' : 'is-primary'}`}
      onClick={() => act({ type: 'phase/ready', ready: !ready })}
      disabled={Boolean(blocked)}
    >
      {blocked ?? (ready ? (game.ready[opponentSeat] ? 'Ready ✓' : `Waiting for ${opponent.name}`) : 'Ready')}
    </button>
  )
}

function Header() {
  const { state: game, seat, me, killteam, status, act } = usePlayer()
  const [vpOpen, setVpOpen] = useState(false)
  const inBattle = game.phase === 'battle'
  const score = (field) => (delta) => act({ type: 'battle/score', field, delta })
  return (
    <header className="play-header" style={{ '--seat-color': seatColor(seat) }}>
      <div className="play-identity">
        <span className={`conn-dot is-${status}`} title={status} />
        <div>
          <div className="play-name">{me.name}</div>
          <div className="play-phase">
            {inBattle ? `Turning point ${game.battle.tp}` : PHASES[game.phase]?.label}
            {killteam ? ` · ${killteam.killteamName}` : ''}
          </div>
        </div>
      </div>
      {inBattle || game.phase === 'results' ? (
        <div className="play-counters">
          <Counter label="CP" value={me.cp} onChange={score('cp')} />
          <button type="button" className="counter is-button" onClick={() => setVpOpen(true)} aria-label="Score VP">
            <span className="counter-label">VP</span>
            <span className="counter-value">{totalVp(me, { withPrimary: game.phase === 'results' })}</span>
          </button>
          {SP_KILLTEAMS.has(me.killteamId) ? <Counter label="SP" value={me.sp} onChange={score('sp')} /> : null}
        </div>
      ) : null}
      <PhaseAction />
      <FullscreenButton />
      {vpOpen ? <VpSheet onClose={() => setVpOpen(false)} /> : null}
    </header>
  )
}

function TabBar({ tabs, activeTab, mainLabel, onSelect }) {
  return (
    <nav className="play-tabs">
      {tabs.map((id) => (
        <button key={id} type="button" className={id === activeTab ? 'is-selected' : ''} onClick={() => onSelect(id)}>
          {id === 'main' ? mainLabel : TAB_LABELS[id]}
        </button>
      ))}
    </nav>
  )
}

function MainStep({ onOpenMap }) {
  const { state: game } = useGame()
  switch (game.phase) {
    case 'setup':
      return <SetupStep />
    case 'muster':
      return <MusterStep />
    case 'deploy':
      return <DeployStep onOpenMap={onOpenMap} />
    case 'battle':
      return <BattleStep />
    case 'results':
      return <ResultsStep />
    default:
      return <LobbyStep />
  }
}

function ErrorToast() {
  const { error, clearError } = useGame()
  useEffect(() => {
    if (!error) return undefined
    const timeout = window.setTimeout(clearError, 3500)
    return () => window.clearTimeout(timeout)
  }, [error, clearError])
  if (!error) return null
  return (
    <button type="button" className="toast" onClick={clearError}>
      {error}
    </button>
  )
}

// The stats drawer for an attack on one of my operatives, over whichever tab is open
// (the map has its own, which also shows my own attacks).
function IncomingAttack() {
  return <AttackDrawer {...useAttack()} />
}

function SeatScreen() {
  const { status, state, seat, takeover } = useGame()
  const [tab, setTab] = useState('main')
  const rootRef = useRef(null)
  useKeyboardOverlay(rootRef)

  if (status === 'seat_taken') {
    return (
      <div className="play-center">
        <h2>Seat {seat} is in use on another device</h2>
        <p className="muted">If that was your iPad (or it's gone to sleep for good), take the seat over here.</p>
        <button type="button" className="btn is-primary" onClick={takeover}>
          Use this iPad for seat {seat}
        </button>
        <Link to="/" className="btn">
          Back
        </Link>
      </div>
    )
  }
  if (status === 'released') {
    return (
      <div className="play-center">
        <h2>This iPad was disconnected from seat {seat}</h2>
        <button type="button" className="btn is-primary" onClick={takeover}>
          Rejoin seat {seat}
        </button>
      </div>
    )
  }
  if (!state) {
    return (
      <div className="play-center">
        <h2>Connecting to the table…</h2>
        <p className="muted">Make sure this iPad is on the same Wi-Fi as the projector computer.</p>
      </div>
    )
  }

  const phase = PHASES[state.phase] ?? PHASES.lobby
  const activeTab = phase.tabs.includes(tab) ? tab : 'main'
  // The map fills the whole screen; its own left drawer holds tools and tab switching.
  const immersive = activeTab === 'map'
  const tabLabel = (id) => (id === 'main' ? phase.main : TAB_LABELS[id])

  return (
    <RuleProvider>
      <div ref={rootRef} className={`play-root${immersive ? ' is-immersive' : ''}`} style={{ '--seat-color': seatColor(seat) }}>
        {immersive ? null : <Header />}
        {status !== 'online' ? (
          <div className="play-offline" role="status">
            Reconnecting to the table…
          </div>
        ) : null}
        <main className={`play-main${immersive ? ' is-map' : ''}`}>
          {activeTab === 'main' ? <MainStep onOpenMap={() => setTab('map')} /> : null}
          {activeTab === 'map' ? <MapTab tabs={phase.tabs} tabLabel={tabLabel} onSelectTab={setTab} /> : null}
          {activeTab === 'team' ? <TeamTab /> : null}
          {activeTab === 'opponent' ? <OpponentTab /> : null}
        </main>
        {!immersive && phase.tabs.length > 1 ? (
          <TabBar tabs={phase.tabs} activeTab={activeTab} mainLabel={phase.main} onSelect={setTab} />
        ) : null}
        {activeTab !== 'map' ? <IncomingAttack /> : null}
        <ErrorToast />
      </div>
    </RuleProvider>
  )
}

function PlayPage() {
  const seat = new URLSearchParams(window.location.search).get('seat')?.toUpperCase()
  if (seat !== 'A' && seat !== 'B') {
    return (
      <div className="play-center">
        <h2>Which seat?</h2>
        <div className="row">
          {['A', 'B'].map((candidate) => (
            <a key={candidate} className="btn is-primary" href={`/play?seat=${candidate}`} style={{ '--seat-color': seatColor(candidate) }}>
              Player {candidate}
            </a>
          ))}
        </div>
      </div>
    )
  }
  return (
    <GameProvider role="seat" seat={seat}>
      <SeatScreen />
    </GameProvider>
  )
}

export default PlayPage
