import { useEffect, useMemo, useState } from 'react'
import {
  getRuleDescription,
  getRuleSuggestions,
  tokenizeWeaponRuleText,
} from '../data/ktData'

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)
const parseLeadingNumber = (value) => {
  const match = String(value).match(/\d+/)
  if (!match) return null
  const parsed = Number.parseInt(match[0], 10)
  return Number.isNaN(parsed) ? null : parsed
}

const adjustMove = (value) => {
  const numberValue = parseLeadingNumber(value)
  if (numberValue == null) return value
  const suffix = String(value).replace(String(numberValue), '')
  return `${numberValue - 1}${suffix}`
}

const adjustHit = (value) => {
  const match = String(value).match(/(\d+)\+/)
  if (!match) return value
  const parsed = Number.parseInt(match[1], 10)
  if (Number.isNaN(parsed)) return value
  return `${parsed + 1}+`
}

function UnitCard({
  opType,
  instance,
  instanceCount,
  state,
  onCycleState,
  onDeadChange,
}) {
  const maxWounds = useMemo(() => {
    const parsed = Number.parseInt(opType.WOUNDS, 10)
    return Number.isNaN(parsed) ? 0 : parsed
  }, [opType.WOUNDS])
  const [currentWounds, setCurrentWounds] = useState(maxWounds)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [ruleModal, setRuleModal] = useState(null)
  const ruleDetails = useMemo(
    () => (ruleModal ? getRuleDescription(ruleModal) : null),
    [ruleModal],
  )
  const ruleSuggestions = useMemo(
    () => (ruleModal && !ruleDetails ? getRuleSuggestions(ruleModal, 3) : []),
    [ruleModal, ruleDetails],
  )

  const handleBarClick = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const isRight = event.clientX - rect.left > rect.width / 2
    setCurrentWounds((prev) =>
      clamp(prev + (isRight ? 1 : -1), 0, maxWounds),
    )
  }

  const healthPercent = maxWounds
    ? (currentWounds / maxWounds) * 100
    : 0
  const isCritical = maxWounds > 0 && currentWounds < maxWounds / 2
  const isDead = currentWounds === 0 && maxWounds > 0

  useEffect(() => {
    if (onDeadChange) {
      onDeadChange(isDead)
    }
  }, [isDead, onDeadChange])

  const weaponRows = (opType.weapons ?? []).flatMap((weapon) => {
    const profiles = weapon.profiles?.length ? weapon.profiles : [null]
    return profiles.map((profile, index) => ({
      key: `${weapon.wepId}-${profile?.wepprofileId ?? index}`,
      name: profile?.profileName
        ? `${weapon.wepName} (${profile.profileName})`
        : weapon.wepName,
      ATK: profile?.ATK ?? '—',
      HIT: profile?.HIT ?? '—',
      DMG: profile?.DMG ?? '—',
      WR: profile?.WR ?? '—',
    }))
  })

  const parseRules = (wrValue) => {
    if (!wrValue || wrValue === '—') return []
    return String(wrValue)
      .split(',')
      .map((rule) => rule.trim())
      .filter(Boolean)
  }

  const isRangeRule = (rule) => /^(Rng|Range)\b/i.test(rule)
  const abilities = (opType.abilities ?? []).filter(
    (ability) => !ability.isFactionRule,
  )
  const adjustedMove = isCritical ? adjustMove(opType.MOVE) : opType.MOVE
  return (
    <article
      className={`game-card${
        isDead ? ' is-dead' : state === 'expended' ? ' is-dimmed' : ''
      }`}
    >
      <div className="game-card-header">
        <div className="game-card-title">
          <button
            className="game-card-name"
            type="button"
            onClick={() => setDetailsOpen((prev) => !prev)}
            aria-expanded={detailsOpen}
          >
            {opType.opTypeName}
          </button>
          {instance ? (
            <span className="game-card-slot">
              {instance}/{instanceCount}
            </span>
          ) : null}
        </div>
        <div className="game-card-header-stats">
          <button
            className={`state-pill state-${isDead ? 'dead' : state}`}
            type="button"
            onClick={isDead ? undefined : onCycleState}
            aria-label={`Set ${opType.opTypeName} to ${
              isDead ? 'dead' : state
            }`}
            disabled={isDead}
          >
            {isDead ? 'dead' : state}
          </button>
          <div className="game-stat-pill">
            <span className="game-stat-label">MV</span>
            <span
              className={`game-stat-value${isCritical ? ' stat-critical' : ''}`}
            >
              {adjustedMove}
            </span>
          </div>
          <div className="game-stat-pill">
            <span className="game-stat-label">APL</span>
            <span className="game-stat-value">{opType.APL}</span>
          </div>
          <div className="game-stat-pill">
            <span className="game-stat-label">SV</span>
            <span className="game-stat-value">{opType.SAVE}</span>
          </div>
          <div className="game-stat-pill">
            <span className="game-stat-label">W</span>
            <span className="game-stat-value">
              {currentWounds}/{maxWounds}
            </span>
          </div>
        </div>
      </div>
      <div className="game-card-health">
        <div
          className="health-bar"
          style={{ '--segments': Math.max(maxWounds, 1) }}
          role="button"
          tabIndex={0}
          aria-label="Adjust wounds"
          onClick={handleBarClick}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
              event.preventDefault()
              setCurrentWounds((prev) => clamp(prev + 1, 0, maxWounds))
            }
            if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
              event.preventDefault()
              setCurrentWounds((prev) => clamp(prev - 1, 0, maxWounds))
            }
          }}
        >
          <div
            className={`health-bar-fill${isCritical ? ' critical' : ''}`}
            style={{ width: `${healthPercent}%` }}
          />
        </div>
      </div>
      <div className={`game-card-details${detailsOpen ? ' open' : ''}`}>
        <div className="game-weapon-table">
          <div className="game-weapon-row game-weapon-header">
            <span>NAME</span>
            <span>ATK</span>
            <span>HIT</span>
            <span>DMG</span>
            <span>WR</span>
          </div>
          {weaponRows.map((row) => (
            <div className="game-weapon-row" key={row.key}>
              <span className="weapon-name">{row.name}</span>
              <span>{row.ATK}</span>
              <span className={isCritical ? 'hit-critical' : ''}>
                {isCritical ? adjustHit(row.HIT) : row.HIT}
              </span>
              <span>{row.DMG}</span>
              <span className="weapon-rules">
                {parseRules(row.WR).map((rule, index) =>
                  isRangeRule(rule) ? (
                    <span className="weapon-rule" key={`${row.key}-rule-${index}`}>
                      {rule}
                    </span>
                  ) : (
                    <button
                      key={`${row.key}-rule-${index}`}
                      type="button"
                      className="weapon-rule weapon-rule-button"
                      onClick={() => setRuleModal(rule)}
                    >
                      {rule}
                    </button>
                  ),
                )}
              </span>
            </div>
          ))}
        </div>
        <div className="game-abilities">
          <div className="abilities-title">Rules</div>
          {abilities.length ? (
            abilities.map((ability) => (
              <details className="ability-row" key={ability.abilityId}>
                <summary className="ability-name">
                  {ability.abilityName}
                </summary>
                <div className="ability-description">
                  {String(ability.description ?? '')
                    .split('\n')
                    .map((line, lineIndex, lines) => (
                      <span key={`${ability.abilityId}-line-${lineIndex}`}>
                        {tokenizeWeaponRuleText(line).map((token, tokenIndex) =>
                          token.type === 'rule' && !isRangeRule(token.value) ? (
                            <button
                              key={`${ability.abilityId}-token-${lineIndex}-${tokenIndex}`}
                              type="button"
                              className="weapon-rule weapon-rule-button"
                              onClick={() => setRuleModal(token.ruleName)}
                            >
                              {token.value}
                            </button>
                          ) : (
                            <span key={`${ability.abilityId}-token-${lineIndex}-${tokenIndex}`}>
                              {token.value}
                            </span>
                          ),
                        )}
                        {lineIndex < lines.length - 1 ? <br /> : null}
                      </span>
                    ))}
                </div>
              </details>
            ))
          ) : (
            <div className="ability-empty">No special rules.</div>
          )}
        </div>
      </div>
      {ruleModal ? (
        <div className="rule-modal" role="dialog" aria-modal="true">
          <div
            className="rule-modal-backdrop"
            onClick={() => setRuleModal(null)}
          />
          <div className="rule-modal-content">
            <div className="rule-modal-header">
              <h3>{ruleDetails?.name ?? ruleModal}</h3>
              <button
                type="button"
                className="rule-modal-close"
                onClick={() => setRuleModal(null)}
              >
                Close
              </button>
            </div>
            <div className="rule-modal-body">
              {ruleDetails?.description ? (
                ruleDetails.description
              ) : (
                <>
                  <p>Rule details were not found in the data.</p>
                  {ruleSuggestions.length ? (
                    <div className="rule-modal-suggestions">
                      <div className="rule-modal-suggestions-title">
                        Possible matches
                      </div>
                      <ul>
                        {ruleSuggestions.map((name) => (
                          <li key={name}>{name}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </article>
  )
}

export default UnitCard
