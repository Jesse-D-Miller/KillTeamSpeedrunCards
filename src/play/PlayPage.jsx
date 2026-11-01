import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { seatColor } from '../board/colors.js'
import { GameProvider } from '../net/GameProvider.jsx'
import { useGame } from '../net/gameContext.js'
import MapTab from './MapTab.jsx'
import OpponentTab from './OpponentTab.jsx'
import { RuleProvider } from './RuleText.jsx'
import BattleStep, { StrategySheet } from './steps/BattleStep.jsx'
import { ViewRail } from './RailParts.jsx'
import DeployStep from './steps/DeployStep.jsx'
import LobbyStep from './steps/LobbyStep.jsx'
import MusterStep from './steps/MusterStep.jsx'
import ResultsStep from './steps/ResultsStep.jsx'
import SetupStep from './steps/SetupStep.jsx'
import AttackDrawer from './AttackDrawer.jsx'
import { useKeyboardOverlay } from './useKeyboardOverlay.js'
import { useAttack } from './useAttack.js'
import './play.css'

const PHASES = {
  lobby: { label: 'Lobby', main: 'Join', tabs: ['main'] },
  setup: { label: 'Set up the battle', main: 'Setup', tabs: ['main', 'map'] },
  muster: { label: 'Muster', main: 'Muster', tabs: ['main', 'map'] },
  deploy: { label: 'Deploy', main: 'Deploy', tabs: ['main', 'map', 'opponent'] },
  battle: { label: 'Battle', main: 'Operatives', tabs: ['main', 'map', 'opponent'] },
  results: { label: 'Results', main: 'Results', tabs: ['main', 'map', 'opponent'] },
}

// Your team's ops, equipment, ploys and rules are in the map's tool drawer.
const TAB_LABELS = { map: 'Map', opponent: 'Opponent' }

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
  // The game ending opens the results, whichever tab was showing.
  const phaseNow = state?.phase
  const [lastPhase, setLastPhase] = useState(phaseNow)
  if (lastPhase !== phaseNow) {
    setLastPhase(phaseNow)
    if (phaseNow === 'results') setTab('main')
  }

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
      <div
        ref={rootRef}
        className={`play-root${immersive ? ' is-immersive' : ''}${!immersive ? ' has-rail' : ''}`}
        style={{ '--seat-color': seatColor(seat) }}
      >
        {status !== 'online' ? (
          <div className="play-offline" role="status">
            Reconnecting to the table…
          </div>
        ) : null}
        <main className={`play-main${immersive ? ' is-map' : ''}`}>
          {activeTab === 'main' ? <MainStep onOpenMap={() => setTab('map')} /> : null}
          {activeTab === 'map' ? <MapTab tabs={phase.tabs} tabLabel={tabLabel} onSelectTab={setTab} /> : null}
          {activeTab === 'opponent' ? <OpponentTab /> : null}
        </main>
        {/* Off the map the left drawer is there too (no top bar, no bottom tabs); its map
            tools are greyed. */}
        {!immersive ? (
          <ViewRail
            tabs={phase.tabs}
            activeTab={activeTab}
            tabLabel={tabLabel}
            onSelect={setTab}
            mapTools={state.phase === 'battle' ? [['token', 'Token']] : [['units', 'Units'], ['token', 'Token']]}
          />
        ) : null}
        {activeTab !== 'map' ? <IncomingAttack /> : null}
        {/* The strategy phase covers every tab until both players start the firefight. */}
        {state.phase === 'battle' && state.battle.firefightTp !== state.battle.tp ? <StrategySheet /> : null}
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
