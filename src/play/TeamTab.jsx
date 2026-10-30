import { isHidden } from '../../shared/views.js'
import TacOpCard from '../components/TacOpCard.jsx'
import { primaryOpCard } from '../rules/cards.js'
import PrimaryOpCard from './PrimaryOpCard.jsx'
import { getTacOp } from '../data/tacOps.js'
import { formatCostLabel, parseEquipmentWeaponEffects, selectedEquipmentFor, stripEquipmentTable } from '../rules/equipment.js'
import { RuleText } from './RuleText.jsx'
import { usePlayer } from './usePlayer.js'

function RuleList({ title, items, nameOf, idOf }) {
  if (!items.length) return null
  return (
    <div className="step-block">
      <h3>{title}</h3>
      {items.map((item) => (
        <details key={idOf(item)} className="rule-item">
          <summary>
            <span>{nameOf(item)}</span>
            {formatCostLabel(item) ? <span className="cost">{formatCostLabel(item)}</span> : null}
          </summary>
          <div className="rule-item-body">
            <RuleText text={item.description} />
          </div>
        </details>
      ))}
    </div>
  )
}

function TeamTab() {
  const { state: game, me, killteam, act } = usePlayer()
  if (!killteam) return <section className="step muted">Pick a kill team first.</section>

  const equipment = selectedEquipmentFor(killteam, me.equipment)
  const ploys = killteam.ploys ?? []
  const seen = new Set()
  const factionRules = (killteam.opTypes ?? [])
    .flatMap((opType) => (opType.abilities ?? []).filter((ability) => ability.isFactionRule))
    .filter((ability) => {
      const key = `${ability.abilityName}::${ability.description}`.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  const inBattle = game.phase === 'battle'

  return (
    <section className="step">
      <div className="step-block">
        <h3>Ops</h3>
        <div className="ops-row">
          {me.tacOp && !isHidden(me.tacOp) ? (
            <figure>
              <TacOpCard tacOp={getTacOp(me.tacOp.id)} />
              {inBattle ? (
                <button
                  type="button"
                  className={`btn${me.tacOpRevealed ? '' : ' is-primary'}`}
                  onClick={() => act({ type: 'battle/revealTacOp', revealed: !me.tacOpRevealed })}
                >
                  {me.tacOpRevealed ? 'Hide tac op' : 'Reveal tac op on table'}
                </button>
              ) : null}
            </figure>
          ) : (
            <p className="muted">No tac op chosen.</p>
          )}
          {primaryOpCard(me.primaryOp) ? (
            <figure>
              <PrimaryOpCard category={me.primaryOp.category} />
            </figure>
          ) : null}
        </div>
      </div>

      {equipment.length ? (
        <div className="step-block">
          <h3>Equipment</h3>
          {equipment.map((item) => {
            const rows = parseEquipmentWeaponEffects(item.effects)
            return (
              <details key={item.eqId} className="rule-item">
                <summary>{item.eqName}</summary>
                <div className="rule-item-body">
                  {rows.map((row) => (
                    <div key={row.key} className="muted">
                      {row.name}: ATK {row.ATK} · HIT {row.HIT} · DMG {row.DMG} · <RuleText text={row.WR} />
                    </div>
                  ))}
                  <RuleText text={rows.length ? stripEquipmentTable(item.description) : item.description} />
                </div>
              </details>
            )
          })}
        </div>
      ) : null}

      <RuleList
        title="Firefight ploys"
        items={ploys.filter((ploy) => ploy.ployType === 'T' || ploy.ployType === 'F')}
        nameOf={(ploy) => ploy.ployName}
        idOf={(ploy) => ploy.ployId}
      />
      <RuleList
        title="Strat ploys"
        items={ploys.filter((ploy) => ploy.ployType === 'S')}
        nameOf={(ploy) => ploy.ployName}
        idOf={(ploy) => ploy.ployId}
      />
      <RuleList
        title="Faction rules"
        items={factionRules}
        nameOf={(rule) => rule.abilityName}
        idOf={(rule) => rule.abilityId ?? rule.abilityName}
      />
    </section>
  )
}

export default TeamTab
