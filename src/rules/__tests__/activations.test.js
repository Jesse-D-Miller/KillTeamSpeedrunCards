import { describe, expect, it } from 'vitest'
import { activationSummary } from '../activations.js'

describe('activationSummary', () => {
  it('reads each operative state, treating untouched ones as ready', () => {
    const summary = activationSummary(['a-0', 'b-0', 'c-0', 'd-0'], {
      'a-0': { activation: 'active' },
      'b-0': { activation: 'expended' },
      'c-0': { activation: 'ready', dead: true },
    })
    expect(summary.pips.map((pip) => pip.state)).toEqual(['active', 'expended', 'dead', 'ready'])
    expect(summary).toMatchObject({ ready: 1, active: 1, expended: 1, dead: 1 })
  })

  it('ignores hidden roster entries', () => {
    expect(activationSummary([{ hidden: true }], {}).pips).toEqual([])
  })
})
