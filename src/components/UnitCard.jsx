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

const adjustMoveBy = (value, delta) => {
  const numberValue = parseLeadingNumber(value)
  if (numberValue == null) return value
  const suffix = String(value).replace(String(numberValue), '')
  return `${numberValue + delta}${suffix}`
}

const adjustHit = (value) => {
  const match = String(value).match(/(\d+)\+/)
  if (!match) return value
  const parsed = Number.parseInt(match[1], 10)
  if (Number.isNaN(parsed)) return value
  return `${parsed + 1}+`
}

const addWeaponRule = (wrValue, ruleLabel) => {
  if (!ruleLabel) return wrValue
  if (!wrValue || wrValue === '—') return ruleLabel
  const rules = wrValue
    .split(',')
    .map((rule) => rule.trim())
    .filter(Boolean)
  if (rules.some((rule) => rule.toLowerCase() === ruleLabel.toLowerCase())) {
    return wrValue
  }
  return `${wrValue}, ${ruleLabel}`
}

const parseEquipmentWeaponEffects = (effects) => {
  if (!effects) return []
  return String(effects)
    .split(';')
    .map((entry) => entry.trim())
    .filter((entry) => entry.startsWith('ADDWEP:'))
    .map((entry, index) => {
      const parts = entry.replace('ADDWEP:', '').split('|')
      const [name, range, atk, hit, dmg, wr] = parts
      return {
        key: `${name ?? 'weapon'}-${index}`,
        name: name?.trim() || 'Weapon',
        range: range?.trim() || '',
        ATK: atk?.trim() || '—',
        HIT: hit?.trim() || '—',
        DMG: dmg?.trim() || '—',
        WR: wr?.trim() || '—',
      }
    })
}

const stripEquipmentTable = (description) => {
  if (!description) return ''
  const lines = String(description).split('\n')
  let inTable = false
  const result = []

  lines.forEach((line) => {
    if (line.includes('|**Name**|')) {
      inTable = true
      return
    }

    if (inTable) {
      if (!line.trim().startsWith('|')) {
        inTable = false
      } else {
        return
      }
    }

    result.push(line)
  })

  return result.join('\n').trim()
}

const STATUS_OPTIONS = statusEffectsData?.statusEffects ?? []
const LEGIONARY_MARKS = [
  {
    id: 'KHORNE',
    label: 'KHORNE',
    dataLabel: 'Khorne',
    className: 'mark-khorne',
  },
  {
    id: 'NURGLE',
    label: 'NURGLE',
    dataLabel: 'Nurgle',
    className: 'mark-nurgle',
  },
  {
    id: 'SLAANESH',
    label: 'SLAANESH',
    dataLabel: 'Slaanesh',
    className: 'mark-slaanesh',
  },
  {
    id: 'TZEENTCH',
    label: 'TZEENTCH',
    dataLabel: 'Tzeentch',
    className: 'mark-tzeentch',
  },
  {
    id: 'UNDIVIDED',
    label: 'UNDIVIDED',
    dataLabel: 'Undivided',
    className: 'mark-undivided',
  },
]
const LEGIONARY_SELECT_MARK = {
  label: 'Select Mark',
  className: 'mark-unset',
}

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
  aplAdjustment = 0,
  onAplAdjustChange,
  legionaryMark,
  onLegionaryMarkChange,
  weaponSelection,
  onWeaponSelectionChange,
  assignedEquipment = [],
  collapseSignal = 0,
  readOnly = false,
}) {
  const maxWounds = useMemo(() => {
    const parsed = Number.parseInt(opType.WOUNDS, 10)
    return Number.isNaN(parsed) ? 0 : parsed
  }, [opType.WOUNDS])
  const [ruleModal, setRuleModal] = useState(null)
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [statusDetail, setStatusDetail] = useState(null)
  const [aplModalOpen, setAplModalOpen] = useState(false)
  const [markModalOpen, setMarkModalOpen] = useState(false)
  const cardRef = useRef(null)
  const onDeadChangeRef = useRef(onDeadChange)
  const ruleDetails = useMemo(() => {
    if (!ruleModal) return null
    if (typeof ruleModal === 'object') return ruleModal
    return getRuleDescription(ruleModal)
  }, [ruleModal])
  const ruleSuggestions = useMemo(
    () =>
      ruleModal && typeof ruleModal === 'string' && !ruleDetails
        ? getRuleSuggestions(ruleModal, 3)
        : [],
    [ruleModal, ruleDetails],
  )

  const setWounds = (nextValue) => {
    if (onWoundsChange) {
      onWoundsChange(clamp(nextValue, 0, maxWounds))
    }
  }

  const handleBarClick = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const clickOffset = event.clientX - rect.left
    const clickPercent = rect.width ? (clickOffset / rect.width) * 100 : 0
    const isFilled = clickPercent <= healthPercent
    setWounds(currentWounds + (isFilled ? -1 : 1))
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

  useEffect(() => {
    setRuleModal(null)
    setStatusModalOpen(false)
    setStatusDetail(null)
    setAplModalOpen(false)
    setMarkModalOpen(false)
    if (cardRef.current) {
      cardRef.current.querySelectorAll('details[open]').forEach((element) => {
        element.open = false
      })
    }
  }, [collapseSignal])

  const weaponRows = (opType.weapons ?? []).flatMap((weapon, weaponIndex) => {
    const profiles = weapon.profiles?.length ? weapon.profiles : [null]
    const weaponKey =
      weapon.wepId ?? `${weapon.wepName ?? 'weapon'}-${weaponIndex}`
    return profiles.map((profile, index) => ({
      key: `${weapon.wepId}-${profile?.wepprofileId ?? index}`,
      weaponKey,
      name: profile?.profileName
        ? `${weapon.wepName} (${profile.profileName})`
        : weapon.wepName,
      wepType: weapon.wepType,
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

  const formatCostLabel = (item) => {
    if (!item) return null
    if (item.AP != null) return `${item.AP}AP`
    if (item.CP != null) return `${item.CP}CP`
    return null
  }

  const isRangeRule = (rule) => /^(Rng|Range)\b/i.test(rule)
  const abilities = (opType.abilities ?? []).filter(
    (ability) => !ability.isFactionRule,
  )
  const isSlaaneshMark = legionaryMark === 'SLAANESH'
  const baseMoveValue = opType.MOVE
  const baseMoveNumber = parseLeadingNumber(baseMoveValue)
  const moveDelta = (isSlaaneshMark ? 1 : 0) + (isCritical ? -1 : 0)
  const adjustedMove = moveDelta ? adjustMoveBy(baseMoveValue, moveDelta) : baseMoveValue
  const adjustedMoveNumber = parseLeadingNumber(adjustedMove)
  const isMoveBoosted =
    baseMoveNumber != null &&
    adjustedMoveNumber != null &&
    adjustedMoveNumber > baseMoveNumber
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
  const hasNumericApl = !Number.isNaN(baseApl)
  const effectiveApl = hasNumericApl
    ? Math.max(0, baseApl + statusAplDelta + aplAdjustment)
    : opType.APL
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
  const isLegionary = /\bLEGIONARY\b/i.test(opType?.keywords ?? '')
  const legionaryMeta = legionaryMark
    ? LEGIONARY_MARKS.find((mark) => mark.id === legionaryMark)
    : null
  const legionaryDisplay = legionaryMeta ?? LEGIONARY_SELECT_MARK
  const isKhorneMark = legionaryMark === 'KHORNE'
  const isTzeentchMark = legionaryMark === 'TZEENTCH'
  const legionaryOption = useMemo(() => {
    if (!isLegionary || !legionaryMeta?.dataLabel) return null
    const options = opType?.options ?? []
    return (
      options.find((option) =>
        String(option.optionName || '')
          .toLowerCase()
          .startsWith(`${legionaryMeta.dataLabel.toLowerCase()} -`),
      ) || null
    )
  }, [isLegionary, legionaryMeta, opType?.options])

  const toggleStatus = (status) => {
    if (!onStatusChange) return
    const next = selectedStatuses.includes(status)
      ? selectedStatuses.filter((item) => item !== status)
      : [...selectedStatuses, status]
    onStatusChange(next)
  }
  const isDetailsOpen = Boolean(detailsOpen)
  const canToggleDetails = Boolean(onToggleDetails)
  const weaponChecklistEnabled =
    Array.isArray(weaponSelection) && typeof onWeaponSelectionChange === 'function'
  const selectedWeaponSet = weaponChecklistEnabled
    ? new Set(weaponSelection)
    : new Set()
  const canAdjustApl = Boolean(onAplAdjustChange) && !readOnly && hasNumericApl
  const aplDeltaClass =
    aplAdjustment > 0 ? ' apl-up' : aplAdjustment < 0 ? ' apl-down' : ''
  const adjustApl = (delta) => {
    if (!onAplAdjustChange) return
    onAplAdjustChange(aplAdjustment + delta)
  }
  const openLegionaryRule = () => {
    if (legionaryOption?.description) {
      setRuleModal({
        name: legionaryOption.optionName || legionaryDisplay.label,
        description: legionaryOption.description,
      })
      return
    }
    setRuleModal(legionaryDisplay.label)
  }
  const handleLegionaryPillClick = (event) => {
    if (!legionaryMeta && !readOnly) {
      setMarkModalOpen(true)
      return
    }
    if (legionaryMeta) {
      openLegionaryRule()
    }
  }
  const handleMarkSelect = (markId) => {
    if (!onLegionaryMarkChange || legionaryMeta) return
    onLegionaryMarkChange(markId)
    setMarkModalOpen(false)
  }
  return (
    <article
      ref={cardRef}
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
              className={`game-stat-value${
                isMoveBoosted ? ' stat-boosted' : isCritical ? ' stat-critical' : ''
              }`}
            >
              {adjustedMove}
            </span>
          </div>
          <div className="game-stat-pill">
            <span className="game-stat-label">APL</span>
            {canAdjustApl ? (
              <button
                type="button"
                className={`game-stat-value apl-button${aplDeltaClass}${
                  isStunned ? ' stat-stunned' : ''
                }`}
                onClick={() => setAplModalOpen(true)}
                aria-label="Adjust APL"
              >
                {effectiveApl}
              </button>
            ) : (
              <span
                className={`game-stat-value${aplDeltaClass}${
                  isStunned ? ' stat-stunned' : ''
                }`}
              >
                {effectiveApl}
              </span>
            )}
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
          <div
            className={`game-weapon-row game-weapon-header${
              weaponChecklistEnabled ? ' game-weapon-row--checklist' : ''
            }`}
          >
            {weaponChecklistEnabled ? <span /> : null}
            <span>NAME</span>
            <span>ATK</span>
            <span>HIT</span>
            <span>DMG</span>
            <span>WR</span>
          </div>
          {weaponRows.map((row) => (
            <div
              className={`game-weapon-row${
                weaponChecklistEnabled ? ' game-weapon-row--checklist' : ''
              }`}
              key={row.key}
            >
              {weaponChecklistEnabled ? (
                <label className="weapon-check">
                  <input
                    type="checkbox"
                    checked={selectedWeaponSet.has(row.weaponKey)}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => {
                      event.stopPropagation()
                      const next = new Set(selectedWeaponSet)
                      if (next.has(row.weaponKey)) {
                        next.delete(row.weaponKey)
                      } else {
                        next.add(row.weaponKey)
                      }
                      onWeaponSelectionChange(Array.from(next))
                    }}
                  />
                </label>
              ) : null}
              <span className="weapon-name">{row.name}</span>
              <span>{row.ATK}</span>
              <span className={isCritical ? 'hit-critical' : ''}>
                {isCritical ? adjustHit(row.HIT) : row.HIT}
              </span>
              <span>{row.DMG}</span>
              {(() => {
                const effectiveWR =
                  (isKhorneMark && row.wepType === 'M') ||
                  (isTzeentchMark && row.wepType === 'R')
                    ? addWeaponRule(row.WR, 'Severe')
                    : row.WR
                const hasSevereOriginal = parseRules(row.WR).some(
                  (rule) => rule.toLowerCase() === 'severe',
                )
                return (
                  <span className="weapon-rules">
                    {parseRules(effectiveWR).map((rule, index) => {
                      const isSevereRule = rule.toLowerCase() === 'severe'
                      const isInjectedSevere = isSevereRule && !hasSevereOriginal
                      const isKhorneInjected =
                        isInjectedSevere && isKhorneMark && row.wepType === 'M'
                      const isTzeentchInjected =
                        isInjectedSevere && isTzeentchMark && row.wepType === 'R'
                      const injectedClass = isKhorneInjected
                        ? ' weapon-rule-khorne-added'
                        : isTzeentchInjected
                          ? ' weapon-rule-tzeentch-added'
                          : ''
                      const ruleClass = `weapon-rule${injectedClass}`
                      const buttonClass = `weapon-rule weapon-rule-button${injectedClass}`
                      return isRangeRule(rule) ? (
                        <span className={ruleClass} key={`${row.key}-rule-${index}`}>
                          {rule}
                        </span>
                      ) : (
                        <button
                          key={`${row.key}-rule-${index}`}
                          type="button"
                          className={buttonClass}
                          onClick={() => setRuleModal(rule)}
                        >
                          {rule}
                        </button>
                      )
                    })}
                  </span>
                )
              })()}
            </div>
          ))}
        </div>
        <div className="game-abilities">
          <div className="abilities-title">Rules</div>
          {abilities.length ? (
            abilities.map((ability) => (
              <details className="ability-row" key={ability.abilityId}>
                <summary className="ability-name">
                  <span className="ability-title">{ability.abilityName}</span>
                  {formatCostLabel(ability) ? (
                    <span className="cost-badge">
                      {formatCostLabel(ability)}
                    </span>
                  ) : null}
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
        <div className="game-abilities">
          <div className="abilities-title">Equipment</div>
          {assignedEquipment.length ? (
            assignedEquipment.map((equipment) => {
              const equipmentWeaponRows = parseEquipmentWeaponEffects(equipment.effects)
              const descriptionText = stripEquipmentTable(equipment.description)
              return (
                <details className="ability-row" key={equipment.eqId}>
                  <summary className="ability-name">
                    <span className="ability-title">{equipment.eqName}</span>
                  </summary>
                  <div className="ability-description">
                    {equipmentWeaponRows.length ? (
                      <div className="game-weapon-table">
                        <div className="game-weapon-row game-weapon-header">
                          <span>NAME</span>
                          <span>ATK</span>
                          <span>HIT</span>
                          <span>DMG</span>
                          <span>WR</span>
                        </div>
                        {equipmentWeaponRows.map((row) => (
                          <div className="game-weapon-row" key={`${equipment.eqId}-${row.key}`}>
                            <span className="weapon-name">{row.name}</span>
                            <span>{row.ATK}</span>
                            <span>{row.HIT}</span>
                            <span>{row.DMG}</span>
                            <span className="weapon-rules">
                              {parseRules(row.WR).map((rule, index) =>
                                isRangeRule(rule) ? (
                                  <span className="weapon-rule" key={`${equipment.eqId}-${row.key}-rule-${index}`}>
                                    {rule}
                                  </span>
                                ) : (
                                  <button
                                    key={`${equipment.eqId}-${row.key}-rule-${index}`}
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
                    ) : null}
                    {descriptionText
                      ? descriptionText.split('\n').map((line, lineIndex, lines) => (
                          <span key={`${equipment.eqId}-line-${lineIndex}`}>
                            {tokenizeWeaponRuleText(line).map((token, tokenIndex) =>
                              token.type === 'rule' && !isRangeRule(token.value) ? (
                                <button
                                  key={`${equipment.eqId}-token-${lineIndex}-${tokenIndex}`}
                                  type="button"
                                  className="weapon-rule weapon-rule-button"
                                  onClick={() => setRuleModal(token.ruleName)}
                                >
                                  {token.value}
                                </button>
                              ) : (
                                <span key={`${equipment.eqId}-token-${lineIndex}-${tokenIndex}`}>
                                  {token.value}
                                </span>
                              ),
                            )}
                            {lineIndex < lines.length - 1 ? <br /> : null}
                          </span>
                        ))
                      : null}
                  </div>
                </details>
              )
            })
          ) : (
            <div className="ability-empty">No equipment assigned.</div>
          )}
        </div>
      </div>
      <div className="game-card-status">
        {isLegionary ? (
          readOnly ? (
            <span
              className={`legionary-pill ${legionaryDisplay.className}`}
              aria-label={`Legionary mark ${legionaryDisplay.label}`}
            >
              {legionaryDisplay.label}
            </span>
          ) : (
            <button
              type="button"
              className={`legionary-pill ${legionaryDisplay.className}`}
              onClick={handleLegionaryPillClick}
              aria-label={`Legionary mark ${legionaryDisplay.label}`}
            >
              {legionaryDisplay.label}
            </button>
          )
        ) : null}
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
              <h3>
                {ruleDetails?.name ??
                  (typeof ruleModal === 'string' ? ruleModal : '')}
              </h3>
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
      {markModalOpen ? (
        <div className="mark-modal" role="dialog" aria-modal="true">
          <div
            className="mark-modal-backdrop"
            onClick={() => setMarkModalOpen(false)}
          />
          <div className="mark-modal-content">
            <div className="mark-modal-header">
              <h3>Select Mark</h3>
              <button
                type="button"
                className="mark-modal-close"
                onClick={() => setMarkModalOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="mark-modal-body">
              {LEGIONARY_MARKS.map((mark) => (
                <button
                  key={mark.id}
                  type="button"
                  className={`legionary-pill ${mark.className}`}
                  onClick={() => handleMarkSelect(mark.id)}
                >
                  {mark.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {aplModalOpen ? (
        <div className="apl-modal" role="dialog" aria-modal="true">
          <div
            className="apl-modal-backdrop"
            onClick={() => setAplModalOpen(false)}
          />
          <div className="apl-modal-content">
            <div className="apl-modal-header">
              <h3>Adjust APL</h3>
              <button
                type="button"
                className="apl-modal-close"
                onClick={() => setAplModalOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="apl-modal-body">
              <button
                type="button"
                className="apl-adjust-button"
                onClick={() => adjustApl(-1)}
              >
                -1
              </button>
              <span className="apl-adjust-value">{aplAdjustment}</span>
              <button
                type="button"
                className="apl-adjust-button"
                onClick={() => adjustApl(1)}
              >
                +1
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  )
}

export default UnitCard
