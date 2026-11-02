import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import StatusRim from '../StatusRim.jsx'

const view = { x: 5, cy: 5, r: 0.63, facing: 0 }
const rim = (status, maxWounds = 8) =>
  render(
    <svg>
      <StatusRim token={{ id: 't1' }} view={view} status={status} maxWounds={maxWounds} />
    </svg>,
  ).container

describe('status rim', () => {
  it('cracks the rim of an injured operative only', () => {
    expect(rim({ wounds: 3 }).querySelector('[data-status="injured"]')).not.toBeNull()
    expect(rim({ wounds: 4 }).querySelector('[data-status="injured"]')).toBeNull()
    expect(rim({ wounds: 8 }).querySelector('[data-status="injured"]')).toBeNull()
  })

  it('circles sparks round a stunned operative', () => {
    expect(rim({ wounds: 8, statuses: ['stunned'] }).querySelectorAll('[data-status="stunned"] .status-spark')).toHaveLength(3)
    expect(rim({ wounds: 8, statuses: [] }).querySelector('[data-status="stunned"]')).toBeNull()
  })

  it('tags a changed APL, counting Stunned as −1', () => {
    const tag = (status) => rim({ wounds: 8, ...status }).querySelector('[data-status="apl"]')
    expect(tag({ apl: 1 }).getAttribute('data-apl')).toBe('1')
    expect(tag({ apl: 1 }).textContent).toBe('▲+1')
    expect(tag({ statuses: ['stunned'] }).textContent).toBe('▼−1')
    expect(tag({ apl: 1, statuses: ['stunned'] })).toBeNull()
    expect(tag({})).toBeNull()
  })
})
