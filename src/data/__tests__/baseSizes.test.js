import { describe, expect, it } from 'vitest'
import ktData from '../kt24_v4.json'
import { BASE_SIZES_MM } from '../../../shared/game.js'
import { BASE_SIZE_OVERRIDES, baseSizeMm } from '../baseSizes.js'

const operatives = ktData.flatMap((team) => (team.opTypes ?? []).filter((opType) => opType.isOpType))
const byId = new Map(operatives.map((opType) => [opType.opTypeId, opType]))

describe('base sizes', () => {
  it('every correction targets a real operative', () => {
    const unknown = Object.keys(BASE_SIZE_OVERRIDES).filter((id) => !byId.has(id))
    expect(unknown).toEqual([])
  })

  it('every operative resolves to a standard Citadel base', () => {
    const odd = operatives
      .map((opType) => [opType.opTypeId, baseSizeMm(opType)])
      .filter(([, mm]) => !BASE_SIZES_MM.includes(mm))
    expect(odd).toEqual([])
  })

  it('prefers corrections, then the data, then 32mm', () => {
    expect(baseSizeMm(byId.get('ORK-KOM-GROT'))).toBe(25)
    expect(baseSizeMm(byId.get('ORK-KOM-BOY'))).toBe(32)
    expect(baseSizeMm(byId.get('VOT-HKY-WAR'))).toBe(28.5)
    expect(baseSizeMm(byId.get('TAU-XV26-MV15'))).toBe(28.5)
    expect(baseSizeMm({ opTypeId: 'NOPE' })).toBe(32)
  })
})
