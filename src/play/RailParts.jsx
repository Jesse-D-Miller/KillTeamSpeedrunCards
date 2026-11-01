import { useState } from 'react'
import { SCORE_CATEGORIES, musterBlocker, primaryBonus, primaryCategory, totalVp, tracksSp } from '../../shared/game.js'
import BoardArranger from './BoardArranger.jsx'
import Drawer from './Drawer.jsx'
import FullscreenButton from './FullscreenButton.jsx'
import { NextTpRailButton } from './NextTp.jsx'
import { TeamEquipment, TeamFactionRules, TeamFirefightPloys, TeamOps, TeamStratPloys } from './TeamSections.jsx'
import ToolIcon from './ToolIcon.jsx'
import { usePlayer } from './usePlayer.js'

// The left drawer is on every view (no bottom tabs, no top bar), in one column: the
// button that moves the game on (Ready, Next TP), your CP / VP / SP, the map's tools,
// your team's sections, My board and the views. Off the map, its map-only tools are
// greyed out.

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

// Adjusting CP, VP (by op) and SP, opened from their tiles in the drawer.
function ScoreSheet({ onClose }) {
  const { state: game, me, act } = usePlayer()
  const bonusCategory = primaryCategory(me)
  // The primary op is revealed, and its VP added, when the game ends.
  const final = game.phase === 'results'
  const score = (field) => (delta) => act({ type: 'battle/score', field, delta })
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Score" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-head">
          <h3>Victory points · {totalVp(me, { withPrimary: final })}</h3>
          <button type="button" className="btn is-primary" onClick={onClose}>
            Done
          </button>
        </div>
        <div className="sheet-body vp-sheet">
          {SCORE_CATEGORIES.map(([key, label]) => (
            <Counter key={key} label={label} value={me.score[key]} onChange={(delta) => act({ type: 'battle/vp', category: key, delta })} />
          ))}
          <p className="muted">
            {bonusCategory
              ? `Primary op: +${primaryBonus(me)} VP from ${SCORE_CATEGORIES.find(([key]) => key === bonusCategory)[1]}${final ? ', included' : ' (secret until the end)'}.`
              : 'No primary op chosen.'}
          </p>
          <Counter label="CP" value={me.cp} onChange={score('cp')} />
          {tracksSp(me.killteamId) ? <Counter label="SP" value={me.sp} onChange={score('sp')} /> : null}
        </div>
      </div>
    </div>
  )
}

// Top of the drawer in the battle: CP / VP / SP at a glance, in one tile; tapping it
// opens the sheet to adjust them.
export function RailStatus() {
  const { state: game, me } = usePlayer()
  const [adjusting, setAdjusting] = useState(false)
  if (game.phase !== 'battle' && game.phase !== 'results') return null
  const rows = [
    ['cp', 'CP', me.cp],
    ['vp', 'VP', totalVp(me, { withPrimary: game.phase === 'results' })],
    ...(tracksSp(me.killteamId) ? [['sp', 'SP', me.sp]] : []),
  ]
  return (
    <div className="rail-status">
      <button type="button" className="rail-scores" onClick={() => setAdjusting(true)} aria-label="Score VP, CP and SP">
        {rows.map(([id, label, value]) => (
          <span key={id} className="rail-score-row" data-score={id}>
            <span className="rail-score-label">{label}</span>
            <span className="rail-score-value">{value}</span>
          </span>
        ))}
      </button>
      {adjusting ? <ScoreSheet onClose={() => setAdjusting(false)} /> : null}
    </div>
  )
}

// The button that moves the game on: Ready (with what's still missing in Muster), or
// Next TP / End game in the battle; nothing at the results.
export function RailPhaseButton() {
  const { state: game, seat, opponent, opponentSeat, act } = usePlayer()
  if (game.phase === 'results') return null
  if (game.phase === 'battle') {
    return (
      <div className="rail-phase">
        <NextTpRailButton />
      </div>
    )
  }
  const ready = game.ready[seat]
  const blocked = game.phase === 'muster' && !ready ? musterBlocker(game.players[seat]) : null
  return (
    <div className="rail-phase">
      <button
        type="button"
        className={`rail-tool rail-phase-button ${ready ? 'is-selected' : 'is-primary'}`}
        onClick={() => act({ type: 'phase/ready', ready: !ready })}
        disabled={Boolean(blocked)}
      >
        <span>{blocked ?? (ready ? (game.ready[opponentSeat] ? 'Ready ✓' : `Waiting for ${opponent.name}`) : 'Ready')}</span>
      </button>
    </div>
  )
}

// Your team, a section at a time (it opens beside the drawer).
const TEAM_SECTIONS = [
  { id: 'ops', label: 'Ops', Section: TeamOps },
  { id: 'equipment', label: 'Equipment', Section: TeamEquipment },
  { id: 'firefight', label: 'Firefight', title: 'Firefight ploys', Section: TeamFirefightPloys },
  { id: 'strat', label: 'Strat ploys', Section: TeamStratPloys },
  { id: 'faction', label: 'Faction', title: 'Faction rules', Section: TeamFactionRules },
]

const VIEW_ICONS = { main: 'roster', map: 'mapView', opponent: 'opponent' }

export function TeamSectionButtons({ open, onToggle }) {
  return TEAM_SECTIONS.map(({ id, label, title }) => (
    <button
      key={id}
      type="button"
      className={`rail-tool${open === id ? ' is-selected' : ''}`}
      onClick={() => onToggle(open === id ? null : id)}
      aria-label={title ?? label}
      aria-pressed={open === id}
    >
      <ToolIcon tool={id} />
      <span>{label}</span>
    </button>
  ))
}

export function TeamSectionPanel({ id, onClose }) {
  const section = TEAM_SECTIONS.find((candidate) => candidate.id === id)
  if (!section) return null
  return (
    <section className="team-panel" aria-label={section.title ?? section.label}>
      <button type="button" className="btn is-small team-panel-close" onClick={onClose} aria-label="Close">
        ✕
      </button>
      <section.Section />
    </section>
  )
}

// One button per view of this phase (Operatives / Map / Opponent...), the open one lit.
export function ViewButtons({ tabs, activeTab, tabLabel, onSelect }) {
  if (tabs.length < 2) return null
  return (
    <>
      <span className="rail-divider" />
      {tabs.map((id) => (
        <button
          key={id}
          type="button"
          className={`rail-tool rail-view${activeTab === id ? ' is-selected' : ''}`}
          onClick={() => onSelect(id)}
          aria-label={tabLabel(id)}
          aria-current={activeTab === id ? 'page' : undefined}
        >
          <ToolIcon tool={VIEW_ICONS[id] ?? 'tabs'} />
          <span>{tabLabel(id)}</span>
        </button>
      ))}
    </>
  )
}

// The drawer on the views other than the map: the map's own tools are there but
// greyed out, so the drawer looks the same everywhere.
//   mapTools: [[id, label]] of the map's tool buttons.
export function ViewRail({ tabs, activeTab, tabLabel, onSelect, mapTools }) {
  const [open, setOpen] = useState(true)
  const [section, setSection] = useState(null)
  const [arranging, setArranging] = useState(false)
  return (
    <>
      <Drawer
        side="left"
        open={open}
        onToggle={() => setOpen((value) => !value)}
        handle={<span aria-hidden="true">{open ? '‹' : '›'}</span>}
        label={open ? 'Hide tools' : 'Show tools'}
        className="tool-drawer view-rail"
      >
        <div className="tool-rail">
          <RailPhaseButton />
          <RailStatus />
          <span className="rail-divider" />
          {mapTools.map(([id, label]) => (
            <button key={id} type="button" className="rail-tool" disabled aria-label={`${label} (on the map)`}>
              <ToolIcon tool={id} />
              <span>{label}</span>
            </button>
          ))}
          <span className="rail-divider" />
          <TeamSectionButtons open={section} onToggle={setSection} />
          <span className="rail-divider" />
          <button type="button" className="rail-tool" onClick={() => setArranging(true)} aria-label="My board">
            <ToolIcon tool="board" />
            <span>My board</span>
          </button>
          <button type="button" className="rail-tool" disabled aria-label="Fit (on the map)">
            <ToolIcon tool="fit" />
            <span>Fit</span>
          </button>
          <FullscreenButton variant="rail" />
          <ViewButtons tabs={tabs} activeTab={activeTab} tabLabel={tabLabel} onSelect={onSelect} />
        </div>
        <TeamSectionPanel id={section} onClose={() => setSection(null)} />
      </Drawer>
      {arranging ? <BoardArranger onClose={() => setArranging(false)} /> : null}
    </>
  )
}
