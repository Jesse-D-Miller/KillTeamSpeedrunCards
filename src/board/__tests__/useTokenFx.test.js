import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTokenFx } from '../useTokenFx.js'

afterEach(() => vi.useRealTimers())

const op = (patch = {}) => ({ wounds: 8, injured: false, dead: false, order: 'conceal', counteract: null, lastHit: null, x: 1, cy: 1, r: 0.6, ...patch })
const kinds = (result, id) => (result.current[id] ?? []).map((effect) => effect.kind)

describe('token effects', () => {
  it('flashes a token that loses wounds and twirls one that regains them, then clears', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ ops }) => useTokenFx(ops), { initialProps: { ops: { t1: op(), t2: op() } } })
    expect(result.current).toEqual({})
    rerender({ ops: { t1: op({ wounds: 5 }), t2: op() } })
    expect(kinds(result, 't1')).toEqual(['hurt'])
    expect(result.current.t2).toBeUndefined()
    const firstKey = result.current.t1[0].key
    rerender({ ops: { t1: op({ wounds: 6 }), t2: op() } })
    expect(kinds(result, 't1')).toEqual(['heal'])
    expect(result.current.t1[0].key).not.toBe(firstKey)
    act(() => vi.advanceTimersByTime(1600))
    expect(result.current).toEqual({})
  })

  it('ignores operatives appearing for the first time', () => {
    const { result, rerender } = renderHook(({ ops }) => useTokenFx(ops), { initialProps: { ops: {} } })
    rerender({ ops: { t3: op() } })
    expect(result.current).toEqual({})
  })

  it('drips once when an operative becomes injured, alongside the hurt flash', () => {
    const { result, rerender } = renderHook(({ ops }) => useTokenFx(ops), { initialProps: { ops: { t1: op({ wounds: 5 }) } } })
    rerender({ ops: { t1: op({ wounds: 3, injured: true }) } })
    expect(kinds(result, 't1')).toEqual(['hurt', 'injured'])
    rerender({ ops: { t1: op({ wounds: 2, injured: true }) } })
    expect(kinds(result, 't1')).toEqual(['hurt'])
  })

  it('shatters an operative where it stood before it moved to the casualty area', () => {
    const { result, rerender } = renderHook(({ ops }) => useTokenFx(ops), { initialProps: { ops: { t1: op({ wounds: 1, x: 4, cy: 6 }) } } })
    rerender({ ops: { t1: op({ wounds: 0, dead: true, x: 29, cy: 1 }) } })
    expect(kinds(result, 't1')).toEqual(['shatter'])
    expect(result.current.t1[0]).toMatchObject({ x: 4, cy: 6 })
  })

  it('marks an order change, and a counteraction', () => {
    const { result, rerender } = renderHook(({ ops }) => useTokenFx(ops), { initialProps: { ops: { t1: op() } } })
    rerender({ ops: { t1: op({ order: 'engage' }) } })
    expect(kinds(result, 't1')).toEqual(['engage'])
    rerender({ ops: { t1: op({ order: 'conceal' }) } })
    expect(kinds(result, 't1')).toEqual(['conceal'])
    rerender({ ops: { t1: op({ counteract: 2 }) } })
    expect(kinds(result, 't1')).toEqual(['counteract'])
  })
})
