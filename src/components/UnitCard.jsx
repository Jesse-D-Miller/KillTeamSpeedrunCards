import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getRuleDescription,
  getRuleSuggestions,
  tokenizeWeaponRuleText,
} from '../data/ktData'
import statusEffectsData from '../data/statusEffects.json'
import './UnitCard.css'

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

const STATUS_OPTIONS = statusEffectsData?.statusEffects ?? []

function UnitCard({
  opType,
  instance,
  instanceCount,
  currentWounds,
  detailsOpen,
  state,
  onCycleState,
  onDeadChange,
  onToggleDetails,
  onWoundsChange,
  stance = 'conceal',
  onStanceChange,
  selectedStatuses = [],
  onStatusChange,
  readOnly = false,
}) {
  const maxWounds = useMemo(() => {
    const parsed = Number.parseInt(opType.WOUNDS, 10)
    return Number.isNaN(parsed) ? 0 : parsed
  }, [opType.WOUNDS])
  const [ruleModal, setRuleModal] = useState(null)
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [statusDetail, setStatusDetail] = useState(null)
  const onDeadChangeRef = useRef(onDeadChange)
  const ruleDetails = useMemo(
    () => (ruleModal ? getRuleDescription(ruleModal) : null),
    [ruleModal],
  )
  const ruleSuggestions = useMemo(
    () => (ruleModal && !ruleDetails ? getRuleSuggestions(ruleModal, 3) : []),
    [ruleModal, ruleDetails],
  )

  const setWounds = (nextValue) => {
    if (onWoundsChange) {
      onWoundsChange(clamp(nextValue, 0, maxWounds))
    }
  }

  const handleBarClick = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const isRight = event.clientX - rect.left > rect.width / 2
    setWounds(currentWounds + (isRight ? 1 : -1))
  }

  const healthPercent = maxWounds
    ? (currentWounds / maxWounds) * 100
    : 0
  const isCritical = maxWounds > 0 && currentWounds < maxWounds / 2
  const isDead = currentWounds === 0 && maxWounds > 0

  useEffect(() => {
    onDeadChangeRef.current = onDeadChange
  }, [onDeadChange])

  useEffect(() => {
    if (onDeadChangeRef.current) {
      onDeadChangeRef.current(isDead)
    }
  }, [isDead])

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
  const isInjured = isCritical
  const statusEffectsById = useMemo(
    () =>
      STATUS_OPTIONS.reduce((acc, status) => {
        acc[status.id] = status
        return acc
      }, {}),
    [],
  )
  const statusAplDelta = selectedStatuses.reduce((total, statusId) => {
    const effect = statusEffectsById[statusId]
    return total + (effect?.aplDelta ?? 0)
  }, 0)
  const baseApl = Number.parseInt(opType.APL, 10)
  const effectiveApl = Number.isNaN(baseApl)
    ? opType.APL
    : Math.max(0, baseApl + statusAplDelta)
  const isStunned = selectedStatuses.includes('stunned')
  const selectedStatusEffects = selectedStatuses
    .map((statusId) => statusEffectsById[statusId])
    .filter(Boolean)
  const injuredStatus = isInjured
    ? {
        id: 'injured',
        name: 'Injured',
        description: 'Injured applies automatically below half wounds.',
      }
    : null
  const showLeftDivider = Boolean(injuredStatus)
  const showRightDivider = Boolean(injuredStatus) && selectedStatusEffects.length > 0

  const toggleStatus = (status) => {
    if (!onStatusChange) return
    const next = selectedStatuses.includes(status)
      ? selectedStatuses.filter((item) => item !== status)
      : [...selectedStatuses, status]
    onStatusChange(next)
  }
  const isDetailsOpen = Boolean(detailsOpen)
  const canToggleDetails = Boolean(onToggleDetails)
  return (
    <article
      className={`game-card stance-${stance}${
        isDead ? ' is-dead' : state === 'expended' ? ' is-dimmed' : ''
      }`}
    >
      <div className="game-card-header">
        <div className="game-card-title">
          {canToggleDetails ? (
            <button
              className="game-card-name"
              type="button"
              onClick={onToggleDetails}
              aria-expanded={isDetailsOpen}
            >
              {opType.opTypeName}
            </button>
          ) : (
            <span className="game-card-name">{opType.opTypeName}</span>
          )}
          {instance ? (
            <span className="game-card-slot">
              {instance}/{instanceCount}
            </span>
          ) : null}
        </div>
        <div className="game-card-header-stats">
          {readOnly ? (
            <span className={`state-pill state-${isDead ? 'dead' : state}`}>
              {isDead ? 'dead' : state}
            </span>
          ) : (
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
          )}
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
            <span className={`game-stat-value${isStunned ? ' stat-stunned' : ''}`}>
              {effectiveApl}
            </span>
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
          role={readOnly ? undefined : 'button'}
          tabIndex={readOnly ? undefined : 0}
          aria-label={readOnly ? undefined : 'Adjust wounds'}
          onClick={readOnly ? undefined : handleBarClick}
          onKeyDown={
            readOnly
              ? undefined
              : (event) => {
                  if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
                    event.preventDefault()
                    setWounds(currentWounds + 1)
                  }
                  if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
                    event.preventDefault()
                    setWounds(currentWounds - 1)
                  }
                }
          }
        >
          <div
            className={`health-bar-fill${isCritical ? ' critical' : ''}`}
            style={{ width: `${healthPercent}%` }}
          />
        </div>
      </div>
      <div className={`game-card-details${isDetailsOpen ? ' open' : ''}`}>
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
      <div className="game-card-status">
        {readOnly ? (
          <span className={`stance-pill stance-${stance}`}>{stance}</span>
        ) : (
          <button
            type="button"
            className={`stance-pill stance-${stance}`}
            onClick={() =>
              onStanceChange?.(stance === 'engage' ? 'conceal' : 'engage')
            }
            aria-label={`Set stance to ${
              stance === 'engage' ? 'conceal' : 'engage'
            }`}
          >
            {stance}
          </button>
        )}
        <div className="status-pill-list">
          {showLeftDivider ? (
            <span className="status-divider" aria-hidden="true">
              |
            </span>
          ) : null}
          {injuredStatus ? (
            readOnly ? (
              <span className="status-pill injured" key={injuredStatus.id}>
                {injuredStatus.name}
              </span>
            ) : (
              <button
                type="button"
                className="status-pill injured"
                key={injuredStatus.id}
                onClick={() => setStatusDetail(injuredStatus)}
                aria-label={`View ${injuredStatus.name} details`}
              >
                {injuredStatus.name}
              </button>
            )
          ) : null}
          {showRightDivider ? (
            <span className="status-divider" aria-hidden="true">
              |
            </span>
          ) : null}
          {selectedStatusEffects.map((status) => (
            readOnly ? (
              <span
                className={`status-pill${
                  status.color === 'error'
                    ? ' status-error'
                    : status.color === 'warning'
                      ? ' status-warning'
                      : ''
                }`}
                key={status.id}
              >
                {status.name}
              </span>
            ) : (
              <button
                type="button"
                className={`status-pill${
                  status.color === 'error'
                    ? ' status-error'
                    : status.color === 'warning'
                      ? ' status-warning'
                      : ''
                }`}
                key={status.id}
                onClick={() => setStatusDetail(status)}
                aria-label={`View ${status.name} details`}
              >
                {status.name}
              </button>
            )
          ))}
        </div>
        {readOnly ? null : (
          <button
            type="button"
            className="status-add-button"
            aria-label="Add status effect"
            onClick={() => setStatusModalOpen(true)}
          >
            +
          </button>
        )}
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
      {!readOnly && statusModalOpen ? (
        <div className="status-modal" role="dialog" aria-modal="true">
          <div
            className="status-modal-backdrop"
            onClick={() => setStatusModalOpen(false)}
          />
          <div className="status-modal-content">
            <div className="status-modal-header">
              <h3>Status Effects</h3>
              <button
                type="button"
                className="status-modal-close"
                onClick={() => setStatusModalOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="status-modal-body">
              {STATUS_OPTIONS.map((status) => (
                <button
                  key={status.id}
                  type="button"
                  className={`status-option${
                    selectedStatuses.includes(status.id) ? ' selected' : ''
                  }`}
                  onClick={() => toggleStatus(status.id)}
                >
                  <span>{status.name}</span>
                  <span className="status-option-description">
                    {status.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {!readOnly && statusDetail ? (
        <div className="status-modal" role="dialog" aria-modal="true">
          <div
            className="status-modal-backdrop"
            onClick={() => setStatusDetail(null)}
          />
          <div className="status-modal-content">
            <div className="status-modal-header">
              <h3>{statusDetail.name}</h3>
              <button
                type="button"
                className="status-modal-close"
                onClick={() => setStatusDetail(null)}
              >
                Close
              </button>
            </div>
            <div className="status-modal-body status-detail-body">
              {statusDetail.description}
            </div>
          </div>
        </div>
      ) : null}
    </article>
  )
}

export default UnitCard
