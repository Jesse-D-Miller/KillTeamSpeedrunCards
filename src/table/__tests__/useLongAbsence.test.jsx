import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLongAbsence } from '../useLongAbsence.js'

const both = { A: true, B: true }
const withoutB = { A: true, B: false }

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('useLongAbsence', () => {
  it('ignores a short drop', () => {
    const { result, rerender } = renderHook(({ presence }) => useLongAbsence(presence), { initialProps: { presence: both } })
    rerender({ presence: withoutB })
    act(() => vi.advanceTimersByTime(10000))
    expect(result.current).toEqual([])
    rerender({ presence: both })
    act(() => vi.advanceTimersByTime(10000))
    expect(result.current).toEqual([])
  })

  it('reports a seat gone for 15 seconds, until it comes back', () => {
    const { result, rerender } = renderHook(({ presence }) => useLongAbsence(presence), { initialProps: { presence: withoutB } })
    act(() => vi.advanceTimersByTime(15000))
    expect(result.current).toEqual(['B'])
    rerender({ presence: both })
    expect(result.current).toEqual([])
  })

  it('waits the full time again after a seat returns and drops once more', () => {
    const { result, rerender } = renderHook(({ presence }) => useLongAbsence(presence), { initialProps: { presence: withoutB } })
    act(() => vi.advanceTimersByTime(15000))
    rerender({ presence: both })
    rerender({ presence: withoutB })
    expect(result.current).toEqual([])
    act(() => vi.advanceTimersByTime(15000))
    expect(result.current).toEqual(['B'])
  })
})
