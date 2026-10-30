import { seatColor } from '../board/colors.js'
import {
  FIGHT_RESOLVE,
  TONE_ARROW,
  badgeOf,
  canToggle,
  groupModifiers,
  modifierIcon,
  operativeOf,
  profileOf,
  roleOf,
  statTiles,
  statusOf,
  weaponOf,
  weaponProfileText,
} from '../rules/shooting/display.js'
import { weaponLabel } from '../rules/weaponRules.js'

// A shot or fight on an iPad (the stats drawer). Laid out to be read top-down:
// the matchup and whether it can happen, then my side, then theirs. Each side shows its
// outcome numbers first (largest), each with the reasons it changed right underneath
// (▲ green helps whoever rolls it, ▼ red hurts), then its rules, then what I can switch
// on. A firefight ploy spends its CP when switched on and refunds it when switched off
// in the same attack. The projector's side bars follow along.

export function Reason({ reason }) {
  return (
    <li className={`combat-reason is-${reason.tone}`} data-reason data-tone={reason.tone}>
      <span aria-hidden="true">{TONE_ARROW[reason.tone]}</span> {reason.text}
    </li>
  )
}

function Tile({ tile }) {
  const changed = tile.tone === 'better' || tile.tone === 'worse'
  return (
    <div className={`combat-tile is-${tile.tone}`} data-cell={tile.cell} data-tone={tile.tone}>
      <span className="combat-tile-label">{tile.label}</span>
      <span className="combat-tile-value">
        {Array.isArray(tile.value)
          ? tile.value.map((part, index) => (
              <span key={index} className={`is-${part.tone}`}>
                {part.text}
              </span>
            ))
          : tile.value}
        {changed ? (
          <span className="combat-tile-arrow" aria-label={tile.tone === 'better' ? 'better' : 'worse'}>
            {TONE_ARROW[tile.tone]}
          </span>
        ) : null}
      </span>
      {tile.was || tile.hint ? (
        <span className="combat-tile-meta">{[tile.was ? `was ${tile.was}` : null, tile.hint].filter(Boolean).join(' · ')}</span>
      ) : null}
      {tile.reasons.length ? (
        <ul className="combat-reasons">
          {tile.reasons.map((reason) => (
            <Reason key={reason.text} reason={reason} />
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function ModifierRow({ modifier }) {
  return (
    <li className={`combat-mod is-${modifier.mode}${modifier.on ? ' is-on' : ''}${modifier.tone ? ` is-${modifier.tone}` : ''}`} data-modifier={modifier.id}>
      <span className="combat-mod-icon" aria-hidden="true">
        {modifierIcon(modifier)}
      </span>
      <span className="combat-mod-text">
        <strong>{modifier.name}</strong> {modifier.text}
      </span>
    </li>
  )
}

// One of my own switches: a full-width row (easy to hit) with a real switch.
function OptionSwitch({ modifier, seat, onToggle }) {
  const enabled = canToggle(modifier, seat)
  const badge = badgeOf(modifier)
  return (
    <button
      type="button"
      className={`combat-option${modifier.on ? ' is-on' : ''}`}
      aria-pressed={modifier.on}
      disabled={!enabled}
      data-modifier={modifier.id}
      onClick={() => onToggle(modifier)}
    >
      <span className="combat-switch" aria-hidden="true" />
      <span className="combat-option-text">
        <strong>{modifier.name}</strong>
        <span>
          {modifier.text}
          {modifier.generic && modifier.mode === 'toggle' ? ' · check its conditions' : ''}
        </span>
      </span>
      {badge ? <span className={`combat-cost${modifier.used ? ' is-used' : ''}`}>{badge}</span> : null}
    </button>
  )
}

function Modifiers({ modifiers, seat, onToggle }) {
  const { warnings, applied, options, reminders } = groupModifiers(modifiers, seat)
  return (
    <>
      {warnings.length ? (
        <ul className="combat-warnings">
          {warnings.map((modifier) => (
            <ModifierRow key={modifier.id} modifier={modifier} />
          ))}
        </ul>
      ) : null}
      {applied.length ? (
        <div className="combat-group">
          <h4>In effect</h4>
          <ul className="combat-mods">
            {applied.map((modifier) => (
              <ModifierRow key={modifier.id} modifier={modifier} />
            ))}
          </ul>
        </div>
      ) : null}
      {options.length ? (
        <div className="combat-group">
          <h4>Your options</h4>
          <div className="combat-options">
            {options.map((modifier) => (
              <OptionSwitch key={modifier.id} modifier={modifier} seat={seat} onToggle={onToggle} />
            ))}
          </div>
        </div>
      ) : null}
      {reminders.length ? (
        <details className="combat-group combat-reminders">
          <summary>
            {reminders.length} reminder{reminders.length === 1 ? '' : 's'}
          </summary>
          <ul className="combat-mods">
            {reminders.map((modifier) => (
              <ModifierRow key={modifier.id} modifier={modifier} />
            ))}
          </ul>
        </details>
      ) : null}
    </>
  )
}

// Damage and healing for my own operative: −1 / +1, and quick buttons for a normal
// and a critical hit from the opponent's current profile (after any damage changes).
//   incoming: { normal, crit } damage the opponent deals it in this attack, or null.
function WoundControls({ operative, incoming, onWounds }) {
  const take = (damage) => onWounds(operative, operative.wounds - damage)
  return (
    <div className="combat-wound-controls" role="group" aria-label={`${operative.name} wounds`}>
      <button type="button" onClick={() => take(1)} disabled={operative.wounds <= 0} aria-label="Take 1 damage">
        −1
      </button>
      {incoming
        ? [
            ['Hit', incoming.normal],
            ['Crit', incoming.crit],
          ].map(([kind, damage]) => (
            <button
              key={kind}
              type="button"
              className="is-hit"
              onClick={() => take(damage)}
              disabled={operative.wounds <= 0}
              aria-label={`Take ${damage} damage (${kind === 'Hit' ? 'normal' : 'critical'} hit)`}
            >
              −{damage} <span>{kind}</span>
            </button>
          ))
        : null}
      <button
        type="button"
        onClick={() => take(-1)}
        disabled={operative.wounds >= operative.maxWounds}
        aria-label="Heal 1"
      >
        +1
      </button>
    </div>
  )
}

function Side({ combat, side, seat, onToggle, onPickWeapon, onWounds }) {
  const operative = operativeOf(combat, side)
  const weapon = weaponOf(combat, side)
  const profile = profileOf(combat, side)
  const mine = operative.seat === seat
  const fight = combat.mode === 'fight'
  const showRules = side === 'attack' || fight
  const woundsLeft = operative.maxWounds ? Math.max(0, operative.wounds) / operative.maxWounds : null
  // What the other side's weapon deals this operative: the shot's attacker, or in a fight
  // whoever it's fighting.
  const theirs = side === 'attack' ? (fight ? combat.retaliation : null) : combat.attack
  const incoming = theirs ? { normal: theirs.dmg.normal.value, crit: theirs.dmg.crit.value } : null
  return (
    <section
      className={`combat-side${mine ? ' is-mine' : ''}`}
      style={{ '--side': seatColor(operative.seat) }}
      aria-label={roleOf(combat, side)}
      data-shot-half={side}
    >
      <header className="combat-side-head">
        <span className="combat-role">
          {roleOf(combat, side)}
          {mine ? <span className="combat-you">You</span> : null}
        </span>
        <h3>{operative.name}</h3>
        {woundsLeft != null ? (
          <span className="combat-wounds" title="Wounds">
            <span className="combat-wounds-bar">
              <span style={{ width: `${woundsLeft * 100}%` }} className={operative.injured ? 'is-injured' : ''} />
            </span>
            {operative.wounds}/{operative.maxWounds} W
          </span>
        ) : null}
      </header>
      {mine && operative.maxWounds && onWounds ? <WoundControls operative={operative} incoming={incoming} onWounds={onWounds} /> : null}
      {weapon ? (
        <p className="combat-weapon">
          <strong>{weaponLabel(weapon)}</strong>
          <span>{weaponProfileText(weapon)}</span>
        </p>
      ) : null}
      {side === 'defence' && fight && mine && combat.defenderWeapons.length > 1 ? (
        <div className="combat-picker" role="group" aria-label="Retaliate with">
          {combat.defenderWeapons.map((option) => (
            <button
              key={option.id}
              type="button"
              className={option.id === combat.defenderWeapon?.id ? 'is-selected' : ''}
              aria-pressed={option.id === combat.defenderWeapon?.id}
              onClick={() => onPickWeapon(option.id)}
            >
              {weaponLabel(option)}
            </button>
          ))}
        </div>
      ) : null}
      {profile ? (
        <div className="combat-tiles">
          {statTiles(combat, side).map((tile) => (
            <Tile key={tile.cell} tile={tile} />
          ))}
        </div>
      ) : null}
      {profile?.rerolls.length || (showRules && profile?.rules.length) ? (
        <ul className="combat-rules">
          {profile.rerolls.map((entry) => (
            <li key={`r-${entry.text}`} className={entry.added ? 'is-added' : 'is-base'} data-reroll>
              ↻ {entry.text}
              {entry.by ? <em> · {entry.by}</em> : null}
            </li>
          ))}
          {showRules
            ? profile.rules.map((rule) => (
                <li key={rule.key} className={`is-${rule.state}`} data-rule-state={rule.state}>
                  {rule.text}
                  {rule.by ? <em> · {rule.by}</em> : null}
                </li>
              ))
            : null}
        </ul>
      ) : null}
      <Modifiers modifiers={combat.modifiers[side]} seat={seat} onToggle={onToggle} />
    </section>
  )
}

function CombatPanel({ attack: combat, seat, onToggle, onPickWeapon, onWounds }) {
  // My own side first.
  const sides = combat.target.seat === seat ? ['defence', 'attack'] : ['attack', 'defence']
  const status = statusOf(combat)
  const incoming = combat.target.seat === seat
  return (
    <div className="combat" data-mode={combat.mode}>
      <header className="combat-summary">
        <span className="combat-kind">
          {incoming ? 'Incoming ' : ''}
          {combat.mode === 'fight' ? 'fight' : 'shot'}
        </span>
        <p className="combat-matchup">
          {combat.shooter.name} <span aria-label="attacks">→</span> {combat.target.name}
        </p>
        <p className={`combat-status ${status.ok ? 'is-ok' : 'is-bad'}`} data-status={status.ok ? 'ok' : 'bad'}>
          <span aria-hidden="true">{status.ok ? '✓' : '✕'}</span> {status.ok ? status.text : `${combat.mode === 'fight' ? 'Can’t fight' : 'Not a valid target'}: ${status.text}`}
        </p>
      </header>
      {sides.map((side) => (
        <Side key={side} combat={combat} side={side} seat={seat} onToggle={onToggle} onPickWeapon={onPickWeapon} onWounds={onWounds} />
      ))}
      {combat.mode === 'fight' ? <p className="combat-footnote">{FIGHT_RESOLVE}</p> : null}
    </div>
  )
}

export default CombatPanel
