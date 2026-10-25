import { describe, expect, it } from 'vitest'
import { applyHomography, computeHomography } from '../homography.js'
import {
  isObscured,
  pathLength,
  resolveZoneRect,
  sightlineHits,
  zoneEdge,
} from '../geometry.js'

describe('homography', () => {
  it('maps the four source corners onto the destination quad', () => {
    const src = [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 22 },
      { x: 0, y: 22 },
    ]
    const dst = [
      { x: 110, y: 40 },
      { x: 1810, y: 70 },
      { x: 1760, y: 1050 },
      { x: 150, y: 1020 },
    ]
    const h = computeHomography(src, dst)
    src.forEach((point, index) => {
      const mapped = applyHomography(h, point)
      expect(mapped.x).toBeCloseTo(dst[index].x, 6)
      expect(mapped.y).toBeCloseTo(dst[index].y, 6)
    })
  })
})

describe('board geometry', () => {
  it('measures polyline length', () => {
    expect(pathLength([{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 3, y: 10 }])).toBe(11)
  })

  it('rotates map 2 zones into landscape', () => {
    const rect = resolveZoneRect({ x: 0, y: 24, w: 22, h: 6 }, 'map_02')
    expect(rect).toEqual({ x: 24, y: 0, w: 6, h: 22 })
    expect(zoneEdge(rect, { width: 30, height: 22 })).toBe('right')
    expect(zoneEdge({ x: 0, y: 19, w: 30, h: 3 }, { width: 30, height: 22 })).toBe('top')
  })

  it('flags heavy walls more than 1" from the target as obscuring', () => {
    const walls = [
      { id: 'near', type: 'heavy', start: { x: 9.5, y: -1 }, end: { x: 9.5, y: 1 } },
      { id: 'far', type: 'light', start: { x: 4, y: -1 }, end: { x: 4, y: 1 } },
    ]
    const from = { x: 0, y: 0 }
    const to = { x: 10, y: 0 }
    const hits = sightlineHits(from, to, walls)
    expect(hits.map((hit) => hit.wallId)).toEqual(['far', 'near'])
    expect(hits[1].fromTarget).toBeCloseTo(0.5)
    expect(isObscured(hits)).toBe(false)
    expect(isObscured(sightlineHits(from, to, [{ ...walls[1], type: 'heavy' }]))).toBe(true)
  })
})

describe('stepPath', async () => {
  const { stepPath, distance } = await import('../geometry.js')
  const origin = [{ x: 5, y: 5 }]

  it('advances in exact 1" steps toward the finger', () => {
    const path = stepPath(origin, { x: 8.4, y: 5 })
    expect(path).toHaveLength(4)
    path.slice(1).forEach((point, index) => expect(distance(path[index], point)).toBeCloseTo(1))
    expect(path[3].x).toBeCloseTo(8)
  })

  it('backs up when the finger returns toward the previous step', () => {
    const forward = stepPath(origin, { x: 8.4, y: 5 })
    expect(stepPath(forward, { x: 6.9, y: 5 })).toHaveLength(3)
  })

  it('keeps the corner of an L-shaped route', () => {
    let path = stepPath(origin, { x: 7.2, y: 5 })
    path = stepPath(path, { x: 7, y: 8.1 })
    expect(path[2]).toEqual({ x: 7, y: 5 })
    expect(path[path.length - 1].y).toBeCloseTo(8)
    expect(path).toHaveLength(6)
  })
})

describe('casualty slots', async () => {
  const { casualtySlots, edgeCasualtyArea, panelCasualtyArea } = await import('../geometry.js')
  const board = { width: 30, height: 22 }
  const dead = [
    { id: 't10', radius: 0.56 },
    { id: 't2', radius: 0.63 },
  ]

  it.each(['bottom', 'top', 'left', 'right'])('edge row sits just outside the %s edge', (edge) => {
    for (const { x, y } of casualtySlots(dead, edgeCasualtyArea(edge, board)).values()) {
      expect(x < 0 || y < 0 || x > board.width || y > board.height).toBe(true)
    }
  })

  it('orders tokens by id and spaces them so bases do not overlap', () => {
    const slots = casualtySlots(dead, edgeCasualtyArea('bottom', board))
    expect(slots.get('t2').x).toBeLessThan(slots.get('t10').x)
    expect(slots.get('t10').x - slots.get('t2').x).toBeGreaterThanOrEqual(0.63 * 2)
  })

  // Left panel spans x -8.5..-0.5, right panel 30.5..38.5.
  const left = { x0: -8.5, x1: -0.5 }
  const right = { x0: 30.5, x1: 38.5 }
  it.each([
    ['bottom player (0deg)', left, 0, ({ x }) => x < left.x0, (a, b) => a.y < b.y],
    ['top player (180deg)', right, 180, ({ x }) => x > right.x1, (a, b) => a.y > b.y],
    ['left player (90deg)', left, 90, ({ x, y }) => y > board.height && x >= left.x0 && x <= left.x1, (a, b) => a.x < b.x],
    ['right player (-90deg)', right, -90, ({ x, y }) => y < 0 && x >= right.x0 && x <= right.x1, (a, b) => a.x > b.x],
  ])('%s: on the player\'s left of their panel, starting at their end', (_, slot, rotation, onLeft, firstNearer) => {
    const slots = casualtySlots(dead, panelCasualtyArea(slot, rotation, board))
    for (const point of slots.values()) expect(onLeft(point)).toBe(true)
    expect(firstNearer(slots.get('t2'), slots.get('t10'))).toBe(true)
  })
})
