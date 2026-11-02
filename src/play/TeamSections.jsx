import { useState } from 'react'
import { BONDS_RANGE_IN, BONDS_THAT_BIND, COMMAND_REROLL, ployUses, tokenRadiusIn, turnState } from '../../shared/game.js'
import { distance } from '../../shared/geometry.js'
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

// Bonds That Bind (Yaegirs): used as one of your Yaegirs is activated, picking another
// ready Yaegir within 3" of it to activate straight after it (the turn order follows).
function BondsThatBind({ ploy }) {
  const { state: game, seat, me, act } = usePlayer()
  const [picking, setPicking] = useState(false)
  const cost = ploy.CP ?? 1
  const turn = turnState(game)
  const used = ployUses(me, game.battle.tp, ploy.ployId) > 0
  const first = turn.activeSeat === seat ? game.tokens.find((token) => token.seat === seat && token.unitKey === turn.activeUnitKey) : null
  const choices = first
    ? game.tokens.filter((token) => {
        const unit = me.unitState?.[token.unitKey]
        return (
          token.seat === seat &&
          token.unitKey &&
          token.id !== first.id &&
          !unit?.dead &&
          (unit?.activation ?? 'ready') === 'ready' &&
          distance(first, token) - tokenRadiusIn(first) - tokenRadiusIn(token) <= BONDS_RANGE_IN
        )
      })
    : []
  const chained = game.battle.chain?.seat === seat && game.battle.chain.tp === game.battle.tp ? game.battle.chain : null
  const nameOf = (unitKey) => game.tokens.find((token) => token.seat === seat && token.unitKey === unitKey)?.label || unitKey
  const stop = (handler) => (event) => {
    event.preventDefault()
    handler()
  }
  if (used) {
    return (
      <span className="ploy-use-group">
        {chained ? <span className="ploy-use-note">Next: {nameOf(chained.next)}</span> : null}
        <button
          type="button"
          className="ploy-use is-used"
          aria-pressed="true"
          onClick={stop(() => act({ type: 'battle/bondsThatBind', on: false, cost }))}
          aria-label={`${ploy.ployName}: used, tap to undo`}
        >
          Used ✓
        </button>
      </span>
    )
  }
  if (picking && first) {
    return (
      <span className="ploy-use-group is-picking" data-bonds-pick>
        {choices.map((token) => (
          <button
            key={token.id}
            type="button"
            className="ploy-use"
            onClick={stop(() => {
              act({ type: 'battle/bondsThatBind', tokenId: token.id, cost })
              setPicking(false)
            })}
          >
            {token.label || token.unitKey}
          </button>
        ))}
        <button type="button" className="ploy-use is-undo" onClick={stop(() => setPicking(false))}>
          Cancel
        </button>
      </span>
    )
  }
  const reason = !first ? 'Activate a Yaegir first' : !choices.length ? 'No ready Yaegir within 3"' : null
  return (
    <button
      type="button"
      className="ploy-use"
      disabled={Boolean(reason) || me.cp < cost}
      title={reason ?? undefined}
      onClick={stop(() => setPicking(true))}
      aria-label={`Use ${ploy.ployName}`}
    >
      {reason ?? `Use · ${cost}CP`}
    </button>
  )
}

// Play a firefight ploy from here (one used in a shot or fight is switched on in the
// stats drawer instead; both count the same use). Each is once per turning point,
// except Command Re-roll.
function PloyUse({ ploy }) {
  if (ploy.ployId === BONDS_THAT_BIND) return <BondsThatBind ploy={ploy} />
  return <PlainPloyUse ploy={ploy} />
}

function PlainPloyUse({ ploy }) {
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
  return (
    <div className="step-block">
      <h3>{title}</h3>
      {items.length ? null : <p className="muted">None.</p>}
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

// Your kill team's ops, equipment, ploys and faction rules, one section at a time: each
// opens from the map's tool drawer (see MapTab).

function useTeam() {
  const player = usePlayer()
  return { ...player, ploys: player.killteam?.ploys ?? [] }
}

const NO_TEAM = <p className="muted">Pick a kill team first.</p>

export function TeamOps() {
  const { state: game, me, killteam, act } = useTeam()
  if (!killteam) return NO_TEAM
  return (
    <div className="step-block">
      <h3>Ops</h3>
      <div className="ops-row">
        {me.tacOp && !isHidden(me.tacOp) ? (
          <figure>
            <TacOpCard tacOp={getTacOp(me.tacOp.id)} />
            {game.phase === 'battle' ? (
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
  )
}

export function TeamEquipment() {
  const { me, killteam } = useTeam()
  if (!killteam) return NO_TEAM
  const equipment = selectedEquipmentFor(killteam, me.equipment)
  return (
    <div className="step-block">
      <h3>Equipment</h3>
      {equipment.length ? null : <p className="muted">No equipment chosen.</p>}
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
  )
}

export function TeamFirefightPloys() {
  const { state: game, killteam, ploys } = useTeam()
  if (!killteam) return NO_TEAM
  return (
    <RuleList
      title="Firefight ploys"
      items={[...ploys.filter((ploy) => ploy.ployType === 'T' || ploy.ployType === 'F'), COMMAND_REROLL_PLOY]}
      nameOf={(ploy) => ploy.ployName}
      idOf={(ploy) => ploy.ployId}
      action={game.phase === 'battle' ? (ploy) => <PloyUse ploy={ploy} /> : null}
    />
  )
}

export function TeamStratPloys() {
  const { killteam, ploys } = useTeam()
  if (!killteam) return NO_TEAM
  return (
    <RuleList
      title="Strat ploys"
      items={ploys.filter((ploy) => ploy.ployType === 'S')}
      nameOf={(ploy) => ploy.ployName}
      idOf={(ploy) => ploy.ployId}
    />
  )
}

export function TeamFactionRules() {
  const { killteam } = useTeam()
  if (!killteam) return NO_TEAM
  // The same faction rule appears on every datacard: list it once.
  const seen = new Set()
  const factionRules = (killteam.opTypes ?? [])
    .flatMap((opType) => (opType.abilities ?? []).filter((ability) => ability.isFactionRule))
    .filter((ability) => {
      const key = `${ability.abilityName}::${ability.description}`.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  return (
    <RuleList
      title="Faction rules"
      items={factionRules}
      nameOf={(rule) => rule.abilityName}
      idOf={(rule) => rule.abilityId ?? rule.abilityName}
    />
  )
}
