// Activation summary for a player's board: one pip per selected operative.
//   state: 'ready' | 'active' | 'expended' | 'dead'
export const activationSummary = (unitKeys, unitState) => {
  const pips = (unitKeys ?? [])
    .filter((key) => typeof key === 'string')
    .map((key) => {
      const unit = unitState?.[key]
      return { key, state: unit?.dead ? 'dead' : unit?.activation ?? 'ready' }
    })
  const count = (state) => pips.filter((pip) => pip.state === state).length
  return {
    pips,
    ready: count('ready'),
    active: count('active'),
    expended: count('expended'),
    dead: count('dead'),
  }
}
