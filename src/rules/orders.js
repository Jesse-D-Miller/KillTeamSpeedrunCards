// Order rules on datacards. Bomb Squigs are Stoopid: "In the Firefight phase,
// whenever you determine this operative's order, you cannot select Conceal."
const NO_CONCEAL = /whenever you determine this operative['’]s order, you cannot select Conceal/i

export const engageOnlyInBattle = (opType) => (opType?.abilities ?? []).some((ability) => NO_CONCEAL.test(ability.description ?? ''))

// Kommando Grots are Sneaky Zoggers: "This operative cannot have an Engage order."
const NO_ENGAGE = /this operative cannot have an Engage order/i

export const concealOnly = (opType) => (opType?.abilities ?? []).some((ability) => NO_ENGAGE.test(ability.description ?? ''))
