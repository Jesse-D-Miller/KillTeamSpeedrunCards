import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { byStatus, useRowDetails } from '../useRowDetails.js'

describe('unit card rows', () => {
  it('opens and closes a whole row of two cards, and closes them all on a new turning point', () => {
    const { result, rerender } = renderHook(({ tp }) => useRowDetails(tp), { initialProps: { tp: 1 } })
    act(() => result.current.toggle(1))
    expect([0, 1, 2, 3].map((index) => result.current.isOpen(index))).toEqual([true, true, false, false])
    act(() => result.current.toggle(0))
    expect(result.current.isOpen(1)).toBe(false)
    act(() => result.current.toggle(2))
    rerender({ tp: 2 })
    expect(result.current.isOpen(2)).toBe(false)
  })

  it('orders ready operatives first, then expended, then dead', () => {
    const unit = (key, index) => ({ key, index, opType: { WOUNDS: 8 } })
    const roster = [unit('a', 0), unit('b', 1), unit('c', 2), unit('d', 3)]
    const order = byStatus(roster, { a: { activation: 'expended' }, b: { dead: true }, d: { activation: 'ready' } })
    expect(order.map((entry) => entry.key)).toEqual(['c', 'd', 'a', 'b'])
  })
})
