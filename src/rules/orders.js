// Order rules on datacards. Bomb Squigs are Stoopid: "In the Firefight phase,
// whenever you determine this operative's order, you cannot select Conceal."
const NO_CONCEAL = /whenever you determine this operative['’]s order, you cannot select Conceal/i

export const engageOnlyInBattle = (opType) => (opType?.abilities ?? []).some((ability) => NO_CONCEAL.test(ability.description ?? ''))
