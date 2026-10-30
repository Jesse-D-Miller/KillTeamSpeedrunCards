import { useEffect, useMemo, useState } from 'react'
import { activePloyIds, createUnitState, initiativeBefore, otherSeat } from '../../../shared/game.js'
import UnitCard from '../../components/UnitCard.jsx'
import { seatColor } from '../../board/colors.js'
import { formatCostLabel, isLegionaryUnit } from '../../rules/equipment.js'
import { PRIMARY_OP_CARDS, primaryOpCard } from '../../rules/cards.js'
import { cardDescription, cardLabel } from '../../rules/initiative.js'
import { maxWoundsFor } from '../../rules/roster.js'
import CardPicker from '../CardPicker.jsx'
import { RuleText } from '../RuleText.jsx'
import { usePlayer } from '../usePlayer.js'

const NEXT_ACTIVATION = { ready: 'active', active: 'expended', expended: 'ready' }

const rank = (unitState) => (unitState.dead ? 2 : unitState.activation === 'expended' ? 1 : 0)

// The strategy phase as numbered steps (Approved Ops 2025): the initiative roll-off
// with initiative cards, the winner deciding who has initiative, the secret primary
// op in turning point 1, then strategic ploys.
export function StrategySheet({ onClose }) {
  const { state: game, seat, opponentSeat, me, killteam, act } = usePlayer()
  const { tp, initiativeByTp, rollOffByTp } = game.battle
  const stratPloys = (killteam?.ploys ?? []).filter((ploy) => ploy.ployType === 'S')
  const active = activePloyIds(me, tp)
  const initiative = initiativeByTp[tp] ?? null
  const winner = rollOffByTp?.[tp] ?? null
  const holder = initiativeBefore(game, tp)
  const nameOf = (candidate) => (candidate === seat ? 'You' : game.players[candidate].name)
  const cards = me.initiativeCards ?? []
  const needsPrimary = tp === 1 && !me.primaryOp
  const bonusNote =
    tp === 1
      ? 'Both players gain 1CP in turning point 1.'
      : initiative
        ? `${nameOf(otherSeat(initiative))} ${otherSeat(initiative) === seat ? 'have' : 'has'} no initiative: 2CP instead of 1`
        : 'The player without initiative gains 2CP instead of 1.'

  return (
    <div className="sheet-backdrop">
      <div className="sheet is-wide strategy-sheet" role="dialog" aria-modal="true">
        <div className="sheet-head">
          <h3>Turning point {tp} · strategy phase</h3>
        </div>
        <div className="sheet-body">
          <section className="strategy-step">
            <h4>
              <span className="step-number">1</span> Initiative roll-off
            </h4>
            <p className="muted">
              Both roll a D6 (don’t re-roll ties). Starting with whoever is losing, take turns playing an initiative card or
              passing. A tie goes to {holder ? (otherSeat(holder) === seat ? 'you' : game.players[otherSeat(holder)].name) : 'the player without initiative'}.
            </p>
            {cards.length ? (
              <div className="init-cards">
                {cards.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    className={`init-card${card.used ? ' is-used' : ''}`}
                    aria-pressed={card.used}
                    title={cardDescription(card)}
                    onClick={() => act({ type: 'battle/useInitiativeCard', id: card.id, used: !card.used })}
                  >
                    <strong>{cardLabel(card)}</strong>
                    <span>{card.used ? 'Played · tap to undo' : 'Tap to play'}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted">You have no initiative cards.</p>
            )}
            <h5 className="strategy-sub">Who won the roll-off?</h5>
            <div className="initiative-choice">
              {[seat, opponentSeat].map((candidate) => (
                <button
                  key={candidate}
                  type="button"
                  className={`initiative-option rolloff-option${winner === candidate ? ' is-selected' : ''}`}
                  style={{ '--seat-color': seatColor(candidate) }}
                  onClick={() => act({ type: 'battle/rollOff', winner: candidate })}
                  aria-pressed={winner === candidate}
                >
                  {game.players[candidate].name}
                </button>
              ))}
              <button type="button" className="initiative-option rolloff-option" onClick={() => act({ type: 'battle/rollOff', winner: 'tie' })}>
                Tie
              </button>
            </div>
            {winner && tp < 4 ? (
              <p className="muted">
                {nameOf(otherSeat(winner))} {otherSeat(winner) === seat ? 'gain' : 'gains'} the ±{tp} initiative card.
              </p>
            ) : null}
            {winner ? (
              winner === seat ? (
                <>
                  <h5 className="strategy-sub">You won: who has initiative?</h5>
                  <div className="initiative-choice">
                    {[seat, opponentSeat].map((candidate) => (
                      <button
                        key={candidate}
                        type="button"
                        className={`initiative-option${initiative === candidate ? ' is-selected' : ''}`}
                        style={{ '--seat-color': seatColor(candidate) }}
                        onClick={() => act({ type: 'battle/initiative', seat: candidate })}
                        aria-pressed={initiative === candidate}
                      >
                        {candidate === seat ? 'I take initiative' : `${game.players[candidate].name} takes it`}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="muted">
                  {initiative
                    ? `${initiative === seat ? 'You have' : `${game.players[initiative].name} has`} initiative.`
                    : `${game.players[winner].name} decides who has initiative.`}
                </p>
              )
            ) : null}
            <p className={`bonus-note${initiative && tp > 1 ? ' is-set' : ''}`}>{bonusNote}</p>
          </section>

          {tp === 1 ? (
            <section className={`strategy-step${initiative ? '' : ' is-locked'}`}>
              <h4>
                <span className="step-number">2</span> Primary op (secret)
              </h4>
              <p className="muted">
                Pick the op you’ll score extra VP from: half of what you score from it, rounded up. It stays hidden until the end of the battle.
              </p>
              <CardPicker
                cards={PRIMARY_OP_CARDS}
                selectedSrc={primaryOpCard(me.primaryOp)?.src}
                onPick={(card) => act({ type: 'battle/primaryOp', category: card.category })}
                disabled={!initiative}
              />
            </section>
          ) : null}

          <section className={`strategy-step${initiative ? '' : ' is-locked'}`}>
            <h4>
              <span className="step-number">{tp === 1 ? 3 : 2}</span> Strategic ploys
              <span className="strategy-cp">{me.cp} CP</span>
            </h4>
            {initiative ? null : <p className="muted">Decide initiative first.</p>}
            <div className="ploy-list">
              {stratPloys.map((ploy) => {
                const isActive = active.includes(ploy.ployId)
                const unavailable = !initiative || (!isActive && me.cp <= 0)
                return (
                  <button
                    key={ploy.ployId}
                    type="button"
                    className={`ploy${isActive ? ' is-selected' : ''}${unavailable ? ' is-unavailable' : ''}`}
                    disabled={!initiative}
                    onClick={() => !unavailable && act({ type: 'battle/togglePloy', ployId: ploy.ployId })}
                  >
                    <div className="ploy-head">
                      <strong>{ploy.ployName}</strong>
                      {formatCostLabel(ploy) ? <span className="cost">{formatCostLabel(ploy)}</span> : null}
                    </div>
                    <div className="ploy-body">
                      <RuleText text={ploy.description} />
                    </div>
                  </button>
                )
              })}
              {!stratPloys.length ? <p className="muted">No strat ploys for this kill team.</p> : null}
            </div>
          </section>
        </div>
        <div className="sheet-foot">
          {needsPrimary && initiative ? <span className="muted">Pick your primary op first.</span> : null}
          <button type="button" className="btn is-primary" onClick={onClose} disabled={!initiative || needsPrimary}>
            Start firefight
          </button>
        </div>
      </div>
    </div>
  )
}

// Remember which turning point this iPad already started, so switching tabs or
// reloading doesn't reopen the strategy phase.
const STRATEGY_KEY = 'kt-strategy-started'

const readStarted = () => {
  try {
    return sessionStorage.getItem(STRATEGY_KEY)
  } catch {
    return null
  }
}

const writeStarted = (value) => {
  try {
    sessionStorage.setItem(STRATEGY_KEY, value)
  } catch {
    // private mode: the sheet may reopen after a reload
  }
}

function BattleStep() {
  const { state: game, me, roster, act } = usePlayer()
  const tp = game.battle.tp
  const [openByUnit, setOpenByUnit] = useState({})
  const turnKey = `${game.battle.startedAt}:${tp}`
  const [startedKey, setStartedKey] = useState(readStarted)
  const [strategyOpen, setStrategyOpen] = useState(false)
  // The strategy phase opens by itself at the start of every turning point.
  const showStrategy = strategyOpen || startedKey !== turnKey

  // Starting the Firefight phase also tells the server, so moves start activating.
  const startTurn = () => {
    act({ type: 'battle/startFirefight' })
    setStartedKey(turnKey)
    writeStarted(turnKey)
    setStrategyOpen(false)
  }

  // If this iPad already closed the strategy sheet (e.g. before a reload or an app
  // update), make sure the server knows the Firefight phase has started.
  const firefightTp = game.battle.firefightTp
  useEffect(() => {
    if (!showStrategy && firefightTp !== tp) act({ type: 'battle/startFirefight' })
  }, [showStrategy, firefightTp, tp, act])

  useEffect(() => {
    setOpenByUnit({})
  }, [tp])

  // Unit state seeded by a move may not know its wounds yet: fall back to the defaults.
  const unitStateFor = (unit) => ({ ...createUnitState(maxWoundsFor(unit.opType)), ...me.unitState[unit.key] })

  const ordered = useMemo(
    () => [...roster].sort((a, b) => rank(unitStateFor(a)) - rank(unitStateFor(b)) || a.index - b.index),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roster, me.unitState],
  )

  const update = (unit, patch) =>
    act({ type: 'unit/update', unitKey: unit.key, maxWounds: maxWoundsFor(unit.opType), patch })

  return (
    <section className="step">
      {showStrategy ? <StrategySheet onClose={startTurn} /> : null}
      <div className="unit-grid">
        {ordered.map((unit) => {
          const unitState = unitStateFor(unit)
          return (
            <UnitCard
              key={unit.key}
              opType={unit.opType}
              instance={unit.instance}
              instanceCount={unit.instanceCount}
              currentWounds={unitState.wounds}
              detailsOpen={Boolean(openByUnit[unit.key])}
              onToggleDetails={() => setOpenByUnit((current) => ({ ...current, [unit.key]: !current[unit.key] }))}
              state={unitState.activation}
              onCycleState={() => update(unit, { activation: NEXT_ACTIVATION[unitState.activation] })}
              onWoundsChange={(wounds) => update(unit, { wounds, dead: wounds === 0 })}
              onDeadChange={(dead) => {
                if (dead !== unitState.dead) update(unit, { dead })
              }}
              stance={unitState.order}
              selectedStatuses={unitState.statuses}
              onStatusChange={(statuses) => update(unit, { statuses })}
              aplAdjustment={unitState.apl}
              onAplAdjustChange={(apl) => update(unit, { apl })}
              legionaryMark={isLegionaryUnit(unit.opType) ? unitState.mark : null}
              onLegionaryMarkChange={isLegionaryUnit(unit.opType) ? (mark) => update(unit, { mark }) : undefined}
              assignedEquipment={unit.assignedEquipment}
              collapseSignal={tp}
            />
          )
        })}
      </div>
      <button type="button" className="btn" onClick={() => setStrategyOpen(true)}>
        Strategy phase / ploys
      </button>
    </section>
  )
}

export default BattleStep
