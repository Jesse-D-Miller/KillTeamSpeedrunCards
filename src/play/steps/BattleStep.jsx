import { useMemo } from 'react'
import { HERNKYN_YAEGIRS, KOMMANDOS, NEXT_ACTIVATION, PHOBOS_STRIKE_TEAM, SSSSHHHH, SSSSHHHH_RANGE_IN, activePloyIds, aplBonus, aplChangesIgnored, createUnitState, initiativeBefore, otherSeat, tokenRadiusIn } from '../../../shared/game.js'
import { baseWithinRect } from '../../../shared/geometry.js'
import { concealedAndClear } from '../../../shared/movement.js'
import { getLayout } from '../../board/boardData.js'
import UnitCard from '../../components/UnitCard.jsx'
import { seatColor } from '../../board/colors.js'
import { formatCostLabel, isLegionaryUnit } from '../../rules/equipment.js'
import { PRIMARY_OP_CARDS } from '../../rules/cards.js'
import { cardDescription, cardLabel } from '../../rules/initiative.js'
import { maxWoundsFor } from '../../rules/roster.js'
import CardPicker from '../CardPicker.jsx'
import { RuleText } from '../RuleText.jsx'
import { usePlayer } from '../usePlayer.js'
import { byStatus, useRowDetails } from '../useRowDetails.js'
import TeamRolls from '../TeamRolls.jsx'



// The strategy phase as numbered steps (Approved Ops 2025): the initiative roll-off
// with initiative cards, the winner deciding who has initiative, the secret primary
// op in turning point 1, then strategic ploys. It covers whichever tab is open until
// both players have tapped Start firefight.
// Hernkyn Yaegirs' Dauntless Explorers, a strategic gambit in turning point 1: each
// Yaegir wholly within the drop zone can Reposition (on the map, with the sheet put aside),
// ending wholly within 4" of the drop zone.
function DauntlessGambit({ onAside }) {
  const { state: game, seat, me, act } = usePlayer()
  const drop = getLayout(game.table.mapId, game.table.arrangementId).zones[game.table.dropZones?.[seat]]?.drop ?? null
  const eligible = game.tokens.filter(
    (token) => token.seat === seat && token.unitKey && !me.unitState?.[token.unitKey]?.dead && baseWithinRect(token, tokenRadiusIn(token), drop),
  )
  const used = me.dauntless?.tp === game.battle.tp
  return (
    <section className="strategy-step strategy-gambit" data-gambit="dauntless">
      <h4>
        <span className="step-number">◆</span> Strategic gambit · Dauntless Explorers
      </h4>
      <p className="muted">
        Each friendly Yaegir wholly within your drop zone can immediately Reposition. Each that does must end wholly within 4&quot; of
        your drop zone.
      </p>
      {used ? (
        <div className="row">
          <button type="button" className="btn is-primary" onClick={onAside}>
            Reposition on the map ({me.dauntless.tokenIds.length})
          </button>
          <button type="button" className="btn" onClick={() => act({ type: 'battle/dauntless', on: false })}>
            Take back
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn"
          disabled={!eligible.length}
          onClick={() => act({ type: 'battle/dauntless', tokenIds: eligible.map((token) => token.id) })}
        >
          {eligible.length ? `Use · ${eligible.length} Yaegir${eligible.length === 1 ? '' : 's'} in your drop zone` : 'No Yaegirs wholly in your drop zone'}
        </button>
      )}
    </section>
  )
}

// Phobos Omni-Scrambler, a strategic gambit while a friendly Infiltrator is in the
// killzone: one enemy operative can't be activated in this Firefight phase until enough
// of the enemy's others have gone (the server keeps count; the board marks it).
function OmniScramblerGambit() {
  const { state: game, seat, me, act } = usePlayer()
  const infiltrators = game.tokens.filter((token) => token.seat === seat && /-INF[A-Z]*-/.test(token.unitKey ?? '') && !me.unitState?.[token.unitKey]?.dead)
  if (!infiltrators.length) return null
  const enemies = game.tokens.filter((token) => token.seat && token.seat !== seat && token.unitKey && !game.players[token.seat]?.unitState?.[token.unitKey]?.dead)
  const target = enemies.find((token) => game.players[token.seat]?.unitState?.[token.unitKey]?.scrambledTp === game.battle.tp)
  return (
    <section className="strategy-step strategy-gambit" data-gambit="omni-scrambler">
      <h4>
        <span className="step-number">◆</span> Strategic gambit · Omni-Scrambler
      </h4>
      <p className="muted">
        One enemy operative visible to a friendly Infiltrator, or within 6&quot; of your Voxbreaker, can&apos;t be activated or act this
        Firefight phase until your opponent has activated {infiltrators.length} other operative{infiltrators.length === 1 ? '' : 's'}, or it&apos;s
        their last.
      </p>
      {me.scramblerTp === game.battle.tp ? (
        <p>Scrambled: {target?.label || 'an enemy operative'}</p>
      ) : (
        <div className="row">
          {enemies.map((token) => (
            <button key={token.id} type="button" className="btn" onClick={() => act({ type: 'battle/omniScrambler', targetId: token.id })}>
              {token.label || token.unitKey}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

// Kommandos' SSSSHHHH! once picked (from TP2): the Kommandos it lets Dash right away, and
// the sheet can be put aside to Dash them on the map.
function SsssshhhhDashes({ onAside }) {
  const { state: game, seat } = usePlayer()
  const eligible = concealedAndClear(game, seat, SSSSHHHH_RANGE_IN)
  return (
    <section className="strategy-step strategy-gambit" data-ploy-moves="ssssshhhh">
      <h4>
        <span className="step-number">◆</span> SSSSHHHH! · free Dashes
      </h4>
      <p className="muted">
        Each Kommando on a Conceal order more than 6&quot; from enemy operatives ({eligible.length ? eligible.map((token) => token.label || token.unitKey).join(', ') : 'none right now'}),
        or not a valid target for any enemy, can Dash now.
      </p>
      <button type="button" className="btn is-primary" onClick={onAside}>
        Dash on the map
      </button>
    </section>
  )
}

export function StrategySheet({ onAside }) {
  const { state: game, seat, opponentSeat, opponent, me, killteam, act } = usePlayer()
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
          <TeamRolls />
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
                selected={me.primaryOp?.category}
                onPick={(card) => act({ type: 'battle/primaryOp', category: card.category })}
                disabled={!initiative}
              />
            </section>
          ) : null}

          {tp === 1 && me.killteamId === HERNKYN_YAEGIRS ? <DauntlessGambit onAside={onAside} /> : null}
          {me.killteamId === PHOBOS_STRIKE_TEAM ? <OmniScramblerGambit /> : null}
          {tp > 1 && me.killteamId === KOMMANDOS && active.includes(SSSSHHHH) ? <SsssshhhhDashes onAside={onAside} /> : null}

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
          {game.battle.firefightReady?.[seat] ? (
            <button
              type="button"
              className="btn is-ready"
              onClick={() => act({ type: 'battle/startFirefight', ready: false })}
              aria-label={`Waiting for ${opponent.name} (tap to take back)`}
            >
              Waiting for {opponent.name}
            </button>
          ) : (
            <button
              type="button"
              className="btn is-primary"
              onClick={() => act({ type: 'battle/startFirefight' })}
              disabled={!initiative || needsPrimary}
              aria-label="Start firefight"
            >
              {game.battle.firefightReady?.[opponentSeat] ? `Start firefight · ${opponent.name} is ready` : 'Start firefight'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function BattleStep() {
  const { state: game, me, roster, act } = usePlayer()
  const tp = game.battle.tp
  const details = useRowDetails(tp)

  // Unit state seeded by a move may not know its wounds yet: fall back to the defaults.
  const unitStateFor = (unit) => ({ ...createUnitState(maxWoundsFor(unit.opType)), ...me.unitState[unit.key] })

  const ordered = useMemo(() => byStatus(roster, me.unitState), [roster, me.unitState])

  const update = (unit, patch) =>
    act({ type: 'unit/update', unitKey: unit.key, maxWounds: maxWoundsFor(unit.opType), patch })

  return (
    <section className="step">
      <div className="unit-grid">
        {ordered.map((unit, index) => {
          const unitState = unitStateFor(unit)
          return (
            <UnitCard
              key={unit.key}
              opType={unit.opType}
              instance={unit.instance}
              instanceCount={unit.instanceCount}
              currentWounds={unitState.wounds}
              detailsOpen={details.isOpen(index)}
              onToggleDetails={() => details.toggle(index)}
              state={unitState.activation}
              onCycleState={() => update(unit, { activation: NEXT_ACTIVATION[unitState.activation] })}
              onWoundsChange={(wounds) => update(unit, { wounds, dead: wounds === 0 })}
              onDeadChange={(dead) => {
                if (dead !== unitState.dead) update(unit, { dead })
              }}
              stance={unitState.order}
              selectedStatuses={unitState.statuses}
              aplAdjustment={unitState.apl}
              aplBonus={aplBonus(unitState)}
              aplLocked={aplChangesIgnored(unitState, game.battle.tp)}
              onAplAdjustChange={(apl) => update(unit, { apl })}
              legionaryMark={isLegionaryUnit(unit.opType) ? unitState.mark : null}
              onLegionaryMarkChange={isLegionaryUnit(unit.opType) ? (mark) => update(unit, { mark }) : undefined}
              assignedEquipment={unit.assignedEquipment}
              collapseSignal={tp}
            />
          )
        })}
      </div>
    </section>
  )
}

export default BattleStep
