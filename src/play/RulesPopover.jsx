import { useMemo } from 'react'
import { getKillteamById, getRuleDescription } from '../data/ktData.js'
import { toOpTypeId } from '../rules/killOpCounts.js'
import { RuleText } from './RuleText.jsx'

// Every rule on an operative, opened from its action ring: its datacard's abilities and
// actions, the rules on its weapons spelled out, then its kill team's faction rules.
// Shown beside the token; datacards are public, so it works on the opponent's too.
//   token: the operative's board token; at: { x, y } screen point beside it.

// 'Prc1', '*Concealed Position', 'Rng 8"' -> rule names (ranges aren't rules to explain).
const weaponRuleNames = (opType) => {
  const names = new Set()
  ;(opType?.weapons ?? []).forEach((weapon) =>
    weapon.profiles.forEach((profile) =>
      String(profile.WR ?? '')
        .split(',')
        .map((part) => part.trim().replace(/^\*/, ''))
        .filter((part) => part && part !== '-' && !/^(rng|range)\b/i.test(part))
        .forEach((part) => names.add(part)),
    ),
  )
  return [...names]
}

const POPOVER_WIDTH = 380
// Its tallest (as in the CSS): 70% of the screen, at most 560px.
const popoverHeight = () => Math.min(window.innerHeight * 0.7, 560)
// The data marks some words **bold**; the popup shows them as plain text.
const plain = (text) => String(text ?? '').replace(/\*\*([^*]+)\*\*/g, '$1')

function RulesPopover({ token, game, at, onClose }) {
  const killteam = useMemo(() => getKillteamById(game.players[token.seat]?.killteamId), [game.players, token.seat])
  const opType = (killteam?.opTypes ?? []).find((candidate) => candidate.opTypeId === toOpTypeId(token.unitKey)) ?? null
  const abilities = (opType?.abilities ?? []).filter((ability) => !ability.isFactionRule)
  const faction = (opType?.abilities ?? []).filter((ability) => ability.isFactionRule)
  // A rule named only on a weapon (e.g. *Concealed Position) is one of its abilities.
  const weaponRules = weaponRuleNames(opType)
    .map((name) => ({ name, rule: getRuleDescription(name) ?? abilities.find((ability) => ability.abilityName.toLowerCase() === name.toLowerCase()) }))
    .filter(({ rule }) => rule)
  // Beside the token, kept on screen.
  const left = Math.min(Math.max(12, at.x + 60), window.innerWidth - POPOVER_WIDTH - 12)
  const top = Math.max(12, Math.min(at.y - 120, window.innerHeight - popoverHeight() - 12))

  return (
    <div className="rules-popover-backdrop" onClick={onClose}>
      <section
        className="rules-popover glass"
        role="dialog"
        aria-label={`${token.label || opType?.opTypeName || 'Operative'} rules`}
        style={{ left, top, width: POPOVER_WIDTH }}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="rules-popover-head">
          <div>
            <h3>{opType?.opTypeName ?? token.label}</h3>
            {token.label && token.label !== opType?.opTypeName ? <span className="muted">{token.label}</span> : null}
          </div>
          <button type="button" className="btn is-small" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="rules-popover-body">
          {!opType ? <p className="muted">No datacard found for this operative.</p> : null}
          {abilities.length ? (
            <section>
              <h4>Abilities</h4>
              {abilities.map((ability) => (
                <article key={ability.abilityId ?? ability.abilityName} className="rules-popover-rule">
                  <strong>
                    {ability.abilityName}
                    {ability.AP != null ? <span className="rules-popover-ap">{ability.AP}AP</span> : null}
                  </strong>
                  <RuleText text={plain(ability.description)} />
                </article>
              ))}
            </section>
          ) : null}
          {weaponRules.length ? (
            <section>
              <h4>Weapon rules</h4>
              {weaponRules.map(({ name, rule }) => (
                <article key={name} className="rules-popover-rule">
                  <strong>{rule.name ?? rule.abilityName ?? name}</strong>
                  <RuleText text={plain(rule.description)} />
                </article>
              ))}
            </section>
          ) : null}
          {faction.length ? (
            <section>
              <h4>Faction rules</h4>
              {faction.map((ability) => (
                <article key={ability.abilityId ?? ability.abilityName} className="rules-popover-rule">
                  <strong>{ability.abilityName}</strong>
                  <RuleText text={plain(ability.description)} />
                </article>
              ))}
            </section>
          ) : null}
        </div>
      </section>
    </div>
  )
}

export default RulesPopover
