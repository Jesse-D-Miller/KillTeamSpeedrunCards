import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useWoundFx } from '../useWoundFx.js'

afterEach(() => vi.useRealTimers())

describe('wound effects', () => {
  it('flashes a token that loses wounds and twirls one that regains them, then clears', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ wounds }) => useWoundFx(wounds), { initialProps: { wounds: { t1: 8, t2: 8 } } })
    expect(result.current).toEqual({})
    rerender({ wounds: { t1: 5, t2: 8 } })
    expect(result.current.t1.kind).toBe('hurt')
    expect(result.current.t2).toBeUndefined()
    const firstKey = result.current.t1.key
    rerender({ wounds: { t1: 6, t2: 8 } })
    expect(result.current.t1.kind).toBe('heal')
    expect(result.current.t1.key).not.toBe(firstKey)
    act(() => vi.advanceTimersByTime(1600))
    expect(result.current).toEqual({})
  })

  it('ignores operatives appearing for the first time', () => {
    const { result, rerender } = renderHook(({ wounds }) => useWoundFx(wounds), { initialProps: { wounds: {} } })
    rerender({ wounds: { t3: 8 } })
    expect(result.current).toEqual({})
  })
})
