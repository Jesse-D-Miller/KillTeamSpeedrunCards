import { useState } from 'react'
import BoardArranger from './BoardArranger.jsx'
import Drawer from './Drawer.jsx'
import FullscreenButton from './FullscreenButton.jsx'
import { NextTpRailButton } from './NextTp.jsx'
import { TeamEquipment, TeamFactionRules, TeamFirefightPloys, TeamOps, TeamStratPloys } from './TeamSections.jsx'
import ToolIcon from './ToolIcon.jsx'
import { usePlayer } from './usePlayer.js'

// The left drawer is on every view (the bottom tabs are gone): the map's tools, your
// team's sections, Next TP, My board and the views themselves. Off the map, its
// map-only tools are greyed out.

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
  const { state: game } = usePlayer()
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
          {mapTools.map(([id, label]) => (
            <button key={id} type="button" className="rail-tool" disabled aria-label={`${label} (on the map)`}>
              <ToolIcon tool={id} />
              <span>{label}</span>
            </button>
          ))}
          <span className="rail-divider" />
          <TeamSectionButtons open={section} onToggle={setSection} />
          <span className="rail-divider" />
          {game.phase === 'battle' ? <NextTpRailButton /> : null}
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
