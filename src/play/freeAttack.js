// A free Shoot or Fight action started from outside the map (e.g. a firefight ploy in the
// team panel): the map listens and opens the Shoot/Fight tool for it.
//   detail: { mode: 'shoot' | 'fight', shooterId, targetId?, free }
export const FREE_ATTACK_EVENT = 'kt:free-attack'

export const requestFreeAttack = (detail) => window.dispatchEvent(new CustomEvent(FREE_ATTACK_EVENT, { detail }))
