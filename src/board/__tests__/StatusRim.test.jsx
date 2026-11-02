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
})
