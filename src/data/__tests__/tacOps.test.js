import { describe, expect, it } from 'vitest'
import ktData from '../kt24_v4.json'
import { ARCHETYPES, TAC_OPS, archetypesFor, tacOpsFor } from '../tacOps.js'

describe('Approved Ops 2025 tac ops', () => {
  it('has three tac ops per archetype', () => {
    expect(TAC_OPS).toHaveLength(12)
    ARCHETYPES.forEach((archetype) => {
      expect(TAC_OPS.filter((tacOp) => tacOp.archetype === archetype)).toHaveLength(3)
    })
  })

  it('offers every kill team the tac ops of its archetypes', () => {
    ktData
      .filter((killteam) => killteam.archetypes)
      .forEach((killteam) => {
        const archetypes = archetypesFor(killteam)
        expect(archetypes.length).toBe(killteam.archetypes.split('/').length)
        expect(tacOpsFor(killteam)).toHaveLength(archetypes.length * 3)
      })
  })
})
