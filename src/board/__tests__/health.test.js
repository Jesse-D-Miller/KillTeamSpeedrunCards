import { describe, expect, it } from 'vitest'
import { isInjured } from '../health.js'

describe('isInjured', () => {
  it('is below half starting wounds', () => {
    expect(isInjured(9, 5)).toBe(false)
    expect(isInjured(9, 4)).toBe(true)
    expect(isInjured(8, 4)).toBe(false)
    expect(isInjured(8, 3)).toBe(true)
  })
})
