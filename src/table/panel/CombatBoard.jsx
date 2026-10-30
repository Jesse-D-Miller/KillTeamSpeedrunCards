import {
  TONE_ARROW,
  groupModifiers,
  modifierIcon,
  operativeOf,
  profileOf,
  roleOf,
  statTiles,
  statusOf,
  weaponOf,
  weaponProfileText,
} from '../../rules/shooting/display.js'
import { weaponLabel } from '../../rules/weaponRules.js'

// A player's side bar during a shot or fight (it takes over from the score, turn, ploy
// and mission sections): their half of the attack, turned to face them. Built to be read
// across the table: the outcome numbers are the largest thing on it, each with up to
// three reasons it changed (▲ green helps whoever rolls it, ▼ red hurts). Only what's in
// effect is listed; the options still on offer are on the players' iPads.

const MAX_REASONS = 3

function Tile({ tile }) {
  const changed = tile.tone === 'better' || tile.tone === 'worse'
  const shown = tile.reasons.slice(0, MAX_REASONS)
  const more = tile.reasons.length - shown.length
  return (
    <div className={`pb-combat-tile is-${tile.tone}`} data-cell={tile.cell} data-tone={tile.tone}>
      <span className="pb-combat-label">{tile.label}</span>
      <span className="pb-combat-value">
        {Array.isArray(tile.value)
          ? tile.value.map((part, index) => (
              <span key={index} className={`is-${part.tone}`}>
                {part.text}
              </span>
            ))
          : tile.value}
        {changed ? <span className="pb-combat-arrow">{TONE_ARROW[tile.tone]}</span> : null}
      </span>
      {tile.was || tile.hint ? (
        <span className="pb-combat-meta">{[tile.was ? `was ${tile.was}` : null, tile.hint].filter(Boolean).join(' · ')}</span>
      ) : null}
      {shown.length ? (
        <ul className="pb-combat-reasons">
          {shown.map((reason) => (
            <li key={reason.text} className={`is-${reason.tone}`} data-reason data-tone={reason.tone}>
              {TONE_ARROW[reason.tone]} {reason.text}
            </li>
          ))}
          {more ? <li className="is-info">+{more} more</li> : null}
        </ul>
      ) : null}
    </div>
  )
}

// combat: computeAttack(...) for the attack in progress; seat: whose side bar this is.
function CombatBoard({ combat, seat, player }) {
  const side = combat.shooter.seat === seat ? 'attack' : 'defence'
  const operative = operativeOf(combat, side)
  const weapon = weaponOf(combat, side)
  const profile = profileOf(combat, side)
  const status = statusOf(combat)
  const showRules = side === 'attack' || combat.mode === 'fight'
  // Nobody switches anything on the projector: everything in effect is "applied".
  const { warnings, applied } = groupModifiers(combat.modifiers[side], null)
  const inPlay = [...warnings, ...applied]
  return (
    <>
      <section className="pb-section pb-combat" data-combat={side}>
        <header className="pb-combat-band">
          <h3 className="pb-combat-role">{roleOf(combat, side)}</h3>
          <span className="pb-combat-cp">{player.cp} CP</span>
        </header>
        <div className="pb-combat-who">
          <span className="pb-combat-name">{operative.name}</span>
          {operative.maxWounds ? (
            <span className="pb-combat-wounds">
              {operative.wounds}/{operative.maxWounds} W
            </span>
          ) : null}
        </div>
        {weapon ? (
          <div className="pb-combat-weapon">
            <strong>{weaponLabel(weapon)}</strong> <span>{weaponProfileText(weapon)}</span>
          </div>
        ) : null}
        {!status.ok ? (
          <p className="pb-combat-status is-bad">
            ✕ {combat.mode === 'fight' ? 'Can’t fight' : 'Not a valid target'}: {status.text}
          </p>
        ) : null}
        {profile ? (
          <div className="pb-combat-tiles">
            {statTiles(combat, side).map((tile) => (
              <Tile key={tile.cell} tile={tile} />
            ))}
          </div>
        ) : null}
        {profile?.rerolls.length || (showRules && profile?.rules.length) ? (
          <ul className="pb-combat-rules">
            {profile.rerolls.map((entry) => (
              <li key={`r-${entry.text}`} className={entry.added ? 'is-added' : 'is-base'} data-reroll>
                ↻ {entry.text}
              </li>
            ))}
            {showRules
              ? profile.rules.map((rule) => (
                  <li key={rule.key} className={`is-${rule.state}`} data-rule-state={rule.state}>
                    {rule.text}
                  </li>
                ))
              : null}
          </ul>
        ) : null}
      </section>
      {inPlay.length ? (
        <section className="pb-section pb-combat-mods" data-combat-mods={side}>
          <h3>In effect</h3>
          <ul>
            {inPlay.map((modifier) => (
              <li
                key={`${modifier.owner}-${modifier.id}`}
                className={`is-${modifier.mode}${modifier.on ? ' is-on' : ''}${modifier.tone ? ` is-${modifier.tone}` : ''}`}
                data-modifier={modifier.id}
                data-on={modifier.on ? 'true' : 'false'}
              >
                <span className="pb-combat-icon">{modifierIcon(modifier)}</span>
                <span>
                  <strong>{modifier.name}</strong> {modifier.text}
                </span>
                {modifier.cost ? <span className="pb-cost">{modifier.cost}CP</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  )
}

export default CombatBoard
