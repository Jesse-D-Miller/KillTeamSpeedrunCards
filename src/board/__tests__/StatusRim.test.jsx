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

  it('hazes an operative carrying a Poison token', () => {
    const withRiders = (riders) =>
      render(
        <svg>
          <StatusRim token={{ id: 't1' }} view={view} status={{ wounds: 8 }} maxWounds={8} riders={riders} />
        </svg>,
      ).container.querySelector('[data-status="poisoned"]')
    expect(withRiders([{ catalogId: 'chaos-pm-poison' }])).not.toBeNull()
    expect(withRiders([{ catalogId: 'apl-minus' }])).toBeNull()
    expect(withRiders([])).toBeNull()
  })

  it('sweeps a guard arc while a Guard token rides on it', () => {
    const guard = (riders) =>
      render(
        <svg>
          <StatusRim token={{ id: 't1' }} view={view} status={{ wounds: 8 }} maxWounds={8} riders={riders} />
        </svg>,
      ).container.querySelector('[data-status="guard"]')
    expect(guard([{ catalogId: 'guard' }])).not.toBeNull()
    expect(guard([{ catalogId: 'apl-plus' }])).toBeNull()
  })

  it("rings a marked legionary with its god's glyphs", () => {
    const mark = rim({ wounds: 8, mark: 'NURGLE' }).querySelector('[data-status="mark"]')
    expect(mark.getAttribute('data-mark')).toBe('NURGLE')
    expect(mark.querySelectorAll('.status-mark-glyph')).toHaveLength(6)
    expect(rim({ wounds: 8, mark: null }).querySelector('[data-status="mark"]')).toBeNull()
  })

  it('orbits a diamond round an operative carrying a mission marker', () => {
    const carrying = (riders) =>
      render(
        <svg>
          <StatusRim token={{ id: 't1' }} view={view} status={{ wounds: 8 }} maxWounds={8} riders={riders} />
        </svg>,
      ).container.querySelector('[data-status="carrying"]')
    expect(carrying([{ catalogId: 'pick-up' }])).not.toBeNull()
    expect(carrying([{ catalogId: 'orb' }])).not.toBeNull()
    expect(carrying([{ catalogId: 'guard' }])).toBeNull()
  })

  it('marks an operative held by an Omni-Scrambler', () => {
    const held = (scrambled) =>
      render(
        <svg>
          <StatusRim token={{ id: 't1' }} view={view} status={{ wounds: 8 }} maxWounds={8} scrambled={scrambled} />
        </svg>,
      ).container.querySelector('[data-status="scrambled"]')
    expect(held(true)).not.toBeNull()
    expect(held(false)).toBeNull()
  })

  it('counts a Resourceful +1 APL in the tag', () => {
    expect(rim({ wounds: 8, resourceful: 'apl' }).querySelector('[data-status="apl"]').textContent).toBe('▲+1')
    expect(rim({ wounds: 8, resourceful: 'heal' }).querySelector('[data-status="apl"]')).toBeNull()
  })

  it("hides APL changes on a Kommando that Shook It Off this turning point", () => {
    const tag = (tp) =>
      render(
        <svg>
          <StatusRim token={{ id: 't1' }} view={view} status={{ wounds: 8, apl: -1, shakeItOffTp: 2 }} maxWounds={8} tp={tp} />
        </svg>,
      ).container.querySelector('[data-status="apl"]')
    expect(tag(2)).toBeNull()
    expect(tag(3).textContent).toBe('▼−1')
  })
})
