import { describe, expect, it } from 'vitest'
import { distance, stepPath } from '../geometry.js'
import { bendToward, capPath, moveLimit, moveStat, moveWarning } from '../movement.js'

const length = (path) => path.slice(1).reduce((sum, point, index) => sum + distance(path[index], point), 0)
const straight = (steps) => Array.from({ length: steps + 1 }, (_, x) => ({ x, y: 0 }))

describe('move limits', () => {
  it('gives each move action its distance, with 2" less Move when injured', () => {
    expect(moveStat('6"')).toBe(6)
    expect(moveLimit('reposition', 6)).toBe(6)
    expect(moveLimit('fallBack', 6)).toBe(6)
    expect(moveLimit('charge', 6)).toBe(8)
    expect(moveLimit('dash', 6)).toBe(3)
    expect(moveLimit('reposition', 6, true)).toBe(4)
    expect(moveLimit('charge', 6, true)).toBe(6)
    // Dash isn't based on Move.
    expect(moveLimit('dash', 6, true)).toBe(3)
    expect(moveLimit(null, 6)).toBe(Infinity)
  })

  it('caps the new part of a path at the limit', () => {
    expect(capPath(straight(10), 1, 3)).toHaveLength(4)
    // A second move keeps the first one's route and adds its own steps.
    expect(capPath(straight(10), 4, 3)).toHaveLength(7)
    expect(capPath(straight(10), 1, Infinity)).toHaveLength(11)
  })

  it('never steps back into an earlier move', () => {
    // The finger walks back along the route to where it all started.
    const walkBack = (keep) => [2, 1, 0].reduce((path, x) => stepPath(path, { x, y: 0 }, 1, keep), straight(3))
    // Without an earlier move the steps come off; with one, its route stays and going
    // back the way it came is new movement.
    expect(walkBack(1)).toHaveLength(1)
    expect(walkBack(4).slice(0, 4)).toEqual(straight(3))
    expect(walkBack(4).length).toBeGreaterThan(4)
  })
})

describe('bending a path toward the finger', () => {
  it('swings the route round without making it longer, keeping its start', () => {
    const path = straight(6)
    const bent = bendToward(path, { x: 0, y: 6 })
    expect(bent[0]).toEqual({ x: 0, y: 0 })
    expect(length(bent)).toBeCloseTo(6, 5)
    // Repeated pulls end up pointing at the finger.
    let route = path
    for (let pull = 0; pull < 40; pull += 1) route = bendToward(route, { x: 0, y: 20 })
    expect(route.at(-1).x).toBeCloseTo(0, 1)
    expect(route.at(-1).y).toBeCloseTo(6, 1)
  })

  it('leaves an earlier move alone', () => {
    const path = straight(6)
    const bent = bendToward(path, { x: 3, y: 5 }, 4)
    expect(bent.slice(0, 4)).toEqual(path.slice(0, 4))
    expect(length(bent)).toBeCloseTo(6, 5)
  })
})

describe('end-of-move warnings', () => {
  const radius = () => 0.5
  const enemy = { x: 10, y: 0 }
  it('wants a Charge to end within 1" of an enemy', () => {
    expect(moveWarning({ kind: 'charge', mover: { x: 8.5, y: 0 }, enemies: [enemy], radius })).toBeNull()
    expect(moveWarning({ kind: 'charge', mover: { x: 7, y: 0 }, enemies: [enemy], radius })).toMatch(/Charge must end/)
  })

  it('keeps Moves and Dashes out of enemy control range', () => {
    expect(moveWarning({ kind: 'dash', mover: { x: 8.5, y: 0 }, enemies: [enemy], radius })).toMatch(/Dash can't end/)
    expect(moveWarning({ kind: 'reposition', mover: { x: 5, y: 0 }, enemies: [enemy], radius })).toBeNull()
  })

  it('checks a Fall Back starts engaged and ends clear', () => {
    const start = { x: 8.5, y: 0 }
    expect(moveWarning({ kind: 'fallBack', mover: { x: 5, y: 0 }, start, enemies: [enemy], radius })).toBeNull()
    expect(moveWarning({ kind: 'fallBack', mover: { x: 5, y: 0 }, start: { x: 2, y: 0 }, enemies: [enemy], radius })).toMatch(/Fall Back is for/)
    expect(moveWarning({ kind: 'fallBack', mover: { x: 8.6, y: 0 }, start, enemies: [enemy], radius })).toMatch(/can’t end/)
  })

  it('says nothing for a free move', () => {
    expect(moveWarning({ kind: null, mover: { x: 8.5, y: 0 }, enemies: [enemy], radius })).toBeNull()
  })
})
