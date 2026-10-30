import { COMMAND_REROLL, ployUses } from '../../shared/game.js'
import { isHidden } from '../../shared/views.js'
import TacOpCard from '../components/TacOpCard.jsx'
import { primaryOpCard } from '../rules/cards.js'
import PrimaryOpCard from './PrimaryOpCard.jsx'
import { getTacOp } from '../data/tacOps.js'
import { formatCostLabel, parseEquipmentWeaponEffects, selectedEquipmentFor, stripEquipmentTable } from '../rules/equipment.js'
import { RuleText } from './RuleText.jsx'
import { usePlayer } from './usePlayer.js'

// The core firefight ploy every kill team has.
const COMMAND_REROLL_PLOY = {
  ployId: COMMAND_REROLL,
  ployName: 'Command Re-roll',
  description: 'Use this firefight ploy after rolling your attack or defence dice. You can re-roll one of those dice.',
}

// Play a firefight ploy from here (one used in a shot or fight is switched on in the
// stats drawer instead; both count the same use). Each is once per turning point,
// except Command Re-roll.
function PloyUse({ ploy }) {
  const { state: game, me, act } = usePlayer()
  const { tp } = game.battle
  const uses = ployUses(me, tp, ploy.ployId)
  const cost = ploy.CP ?? 1
  const repeatable = ploy.ployId === COMMAND_REROLL
  const use = (on) => act({ type: 'battle/firefightPloy', ployId: ploy.ployId, cost, on })
  // Inside the summary: don't open or close the rule as well.
  const press = (on) => (event) => {
    event.preventDefault()
    use(on)
  }
  if (uses && !repeatable) {
    return (
      <button type="button" className="ploy-use is-used" aria-pressed="true" onClick={press(false)} aria-label={`${ploy.ployName}: used, tap to undo`}>
        Used ✓
      </button>
    )
  }
  return (
    <span className="ploy-use-group">
      {uses ? (
        <button type="button" className="ploy-use is-undo" onClick={press(false)} aria-label={`Undo ${ploy.ployName}`}>
          ×{uses} · Undo
        </button>
      ) : null}
      <button type="button" className="ploy-use" disabled={me.cp < cost} onClick={press(true)} aria-label={`Use ${ploy.ployName}`}>
        Use · {cost}CP
      </button>
    </span>
  )
}

// action(item): an optional control shown with the item's name.
function RuleList({ title, items, nameOf, idOf, action = null }) {
  if (!items.length) return null
  return (
    <div className="step-block">
      <h3>{title}</h3>
      {items.map((item) => (
        <details key={idOf(item)} className="rule-item">
          <summary>
            <span>{nameOf(item)}</span>
            {action ? action(item) : formatCostLabel(item) ? <span className="cost">{formatCostLabel(item)}</span> : null}
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
        items={[...ploys.filter((ploy) => ploy.ployType === 'T' || ploy.ployType === 'F'), COMMAND_REROLL_PLOY]}
        nameOf={(ploy) => ploy.ployName}
        idOf={(ploy) => ploy.ployId}
        action={game.phase === 'battle' ? (ploy) => <PloyUse ploy={ploy} /> : null}
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
