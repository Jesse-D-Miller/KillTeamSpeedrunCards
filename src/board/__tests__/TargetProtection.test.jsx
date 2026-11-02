import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TargetProtection } from '../TargetingOverlay.jsx'

const token = { id: 't1', x: 5, y: 5, baseMm: 32 }
const states = (state) =>
  [...render(
    <svg>
      <TargetProtection token={token} state={state} />
    </svg>,
  ).container.querySelectorAll('[data-target-state]')].map((el) => el.getAttribute('data-target-state'))

describe("a shot's target", () => {
  it('shows a shield in cover and fog when obscured, nothing in the open', () => {
    expect(states({ cover: true, obscured: false })).toEqual(['cover'])
    expect(states({ cover: false, obscured: true })).toEqual(['obscured'])
    expect(states({ cover: true, obscured: true })).toEqual(['obscured', 'cover'])
    expect(states({ cover: false, obscured: false })).toEqual([])
  })
})
