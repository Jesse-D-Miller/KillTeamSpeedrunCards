// Order rules on datacards. Bomb Squigs are Stoopid: "In the Firefight phase,
// whenever you determine this operative's order, you cannot select Conceal."
const NO_CONCEAL = /whenever you determine this operative['’]s order, you cannot select Conceal/i

export const engageOnlyInBattle = (opType) => (opType?.abilities ?? []).some((ability) => NO_CONCEAL.test(ability.description ?? ''))

// Kommando Grots are Sneaky Zoggers: "This operative cannot have an Engage order."
const NO_ENGAGE = /this operative cannot have an Engage order/i

export const concealOnly = (opType) => (opType?.abilities ?? []).some((ability) => NO_ENGAGE.test(ability.description ?? ''))

// Charging needs an Engage order (core rules), unless a rule says the operative "can
// perform the Charge action while it has a Conceal order": its own ability (e.g. Yaegir
// Bladekyn's Stalker) or its kill team's faction rule (Kommandos' Throat Slittas), minding
// the faction rule's "(excluding X)" (Bomb Squigs).
const CHARGE_ON_CONCEAL = /can perform the Charge action while it has a Conceal order/i
const keywordsOf = (opType) => String(opType?.keywords ?? '').toUpperCase().split(/\s*,\s*/)
const excludes = (text, opType) => {
  const excluded = String(text).match(/\(excluding ([^)]+)\)/i)?.[1]
  return Boolean(excluded) && excluded.toUpperCase().split(/\s*(?:,|\band\b|\bor\b)\s*/).some((keyword) => keywordsOf(opType).includes(keyword.trim()))
}
export const chargeOnConceal = (opType) =>
  (opType?.abilities ?? []).some((ability) => CHARGE_ON_CONCEAL.test(ability.description ?? '') && !excludes(ability.description, opType))
