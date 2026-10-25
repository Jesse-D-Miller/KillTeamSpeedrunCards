import { useState } from 'react'
import { MAX_EQUIPMENT_OPTIONS, equipmentOptionCount } from '../../../shared/game.js'
import UnitCard from '../../components/UnitCard.jsx'
import { parseEquipmentWeaponEffects, stripEquipmentTable } from '../../rules/equipment.js'
import { maxWoundsFor, weaponKeyFor } from '../../rules/roster.js'
import TacOpCard from '../../components/TacOpCard.jsx'
import { archetypesFor, tacOpsFor } from '../../data/tacOps.js'
import { RuleText } from '../RuleText.jsx'
import { usePlayer } from '../usePlayer.js'

function Operatives() {
  const { me, allUnits, act } = usePlayer()
  const selected = new Set(me.units)
  return (
    <>
      <p className="muted">
        {selected.size} selected · tap a card to add or remove it, tap weapons to choose loadout.
      </p>
      <div className="unit-grid">
        {allUnits.map((unit) => {
          const weaponKeys = (unit.opType.weapons ?? []).map(weaponKeyFor)
          const stored = me.weapons[unit.key]
          const isSelected = selected.has(unit.key)
          return (
            <div
              key={unit.key}
              className={`unit-pick${isSelected ? ' is-selected' : ''}`}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              onClick={() => act({ type: 'muster/toggleUnit', unitKey: unit.key })}
            >
              <UnitCard
                opType={unit.opType}
                instance={unit.instance}
                instanceCount={unit.instanceCount}
                currentWounds={maxWoundsFor(unit.opType)}
                detailsOpen
                state="ready"
                stance="conceal"
                readOnly
                weaponSelection={Array.isArray(stored) ? stored : weaponKeys}
                onWeaponSelectionChange={(weapons) => act({ type: 'muster/weapons', unitKey: unit.key, weapons })}
              />
            </div>
          )
        })}
      </div>
    </>
  )
}

function EquipmentCard({ equipment, selected, disabled = false, onToggle }) {
  const [open, setOpen] = useState(false)
  const rows = parseEquipmentWeaponEffects(equipment.effects)
  const description = rows.length ? stripEquipmentTable(equipment.description) : equipment.description
  return (
    <article className={`equipment-item${selected ? ' is-selected' : ''}`}>
      <div className="equipment-head">
        <button
          type="button"
          className="equipment-toggle"
          onClick={onToggle}
          aria-pressed={selected}
          disabled={disabled}
        >
          <span className="check">{selected ? '✓' : ''}</span>
          {equipment.eqName}
        </button>
        <button type="button" className="btn is-small" onClick={() => setOpen((value) => !value)}>
          {open ? 'Hide' : 'Rules'}
        </button>
      </div>
      {open ? (
        <div className="equipment-body">
          {rows.length ? (
            <table className="weapon-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>ATK</th>
                  <th>HIT</th>
                  <th>DMG</th>
                  <th>WR</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key}>
                    <td>{row.name}</td>
                    <td>{row.ATK}</td>
                    <td>{row.HIT}</td>
                    <td>{row.DMG}</td>
                    <td>
                      <RuleText text={row.WR} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          <RuleText text={description} />
        </div>
      ) : null}
    </article>
  )
}

// Up to four options in total, faction and universal together (Approved Ops).
function Equipment() {
  const { me, killteam, act } = usePlayer()
  const equipments = killteam?.equipments ?? []
  const used = equipmentOptionCount(me.equipment)
  const isFull = used >= MAX_EQUIPMENT_OPTIONS
  const groups = [
    ['Faction equipment', equipments.filter((equipment) => equipment.killteamId === killteam.killteamId)],
    ['Universal equipment', equipments.filter((equipment) => equipment.killteamId == null)],
  ]
  // A pick that wouldn't add a new option (the second grenade of a pair) is always allowed.
  const canAdd = (eqId) => equipmentOptionCount([...me.equipment, eqId]) <= MAX_EQUIPMENT_OPTIONS
  return (
    <>
      <p className={`muted equipment-count${isFull ? ' is-full' : ''}`}>
        {used} of {MAX_EQUIPMENT_OPTIONS} equipment options chosen. Each option can only be taken once.
      </p>
      {groups.map(([title, items]) => (
        <div key={title} className="step-block">
          <h3>{title}</h3>
          {items.map((equipment) => {
            const selected = me.equipment.includes(equipment.eqId)
            return (
              <EquipmentCard
                key={equipment.eqId}
                equipment={equipment}
                selected={selected}
                disabled={!selected && !canAdd(equipment.eqId)}
                onToggle={() => act({ type: 'muster/toggleEquipment', eqId: equipment.eqId })}
              />
            )
          })}
        </div>
      ))}
    </>
  )
}

// Approved Ops 2025: pick one tac op, in secret, from your kill team's archetypes.
function TacOp() {
  const { me, killteam, act } = usePlayer()
  const tacOps = tacOpsFor(killteam)
  if (!tacOps.length) return <p className="muted">No tac ops found for this kill team yet.</p>
  return (
    <>
      <p className="muted">
        Secret: only you can see this until its reveal condition. Your archetypes: {archetypesFor(killteam).join(', ')}.
      </p>
      <div className="tacop-picker">
        {tacOps.map((tacOp) => {
          const selected = me.tacOp?.id === tacOp.id
          return (
            <button
              key={tacOp.id}
              type="button"
              className="tacop-pick"
              aria-pressed={selected}
              onClick={() => act({ type: 'muster/tacOp', tacOp: { id: tacOp.id, label: tacOp.name } })}
            >
              <TacOpCard tacOp={tacOp} selected={selected} />
            </button>
          )
        })}
      </div>
    </>
  )
}

const TABS = [
  ['operatives', 'Operatives', Operatives],
  ['equipment', 'Equipment', Equipment],
  ['tacop', 'Tac op', TacOp],
]

function MusterStep() {
  const { me, killteam } = usePlayer()
  const [tab, setTab] = useState('operatives')
  if (!killteam) return <section className="step">Pick a kill team first.</section>
  // Equipment is optional (up to four), so that tab is never blocking.
  const done = { operatives: me.units.length > 0, equipment: true, tacop: Boolean(me.tacOp) }
  const Active = TABS.find(([id]) => id === tab)[2]
  return (
    <section className="step">
      <div className="segmented is-sticky">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" className={id === tab ? 'is-selected' : ''} onClick={() => setTab(id)}>
            {done[id] ? '✓ ' : ''}
            {label}
          </button>
        ))}
      </div>
      <Active />
    </section>
  )
}

export default MusterStep
