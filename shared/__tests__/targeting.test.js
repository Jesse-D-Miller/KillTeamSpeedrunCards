import { describe, expect, it } from 'vitest'
import { distance } from '../geometry.js'
import { analyseTarget, clampToBase, defaultShooterPoint, facingArc, glanceStatus, splashTargets } from '../targeting.js'

// 32mm bases (radius ~0.63"). Shooter A at x=2, target B at x=12, same row.
const op = (id, seat, x, y = 5, unitKey = id) => ({ id, seat, x, y, unitKey, baseMm: 32 })
// A wall across the lines at x. By default it spans every line; `half` walls only
// block the upper half of them.
const half = (id, type, x, featureId = id) => wall(id, type, x, featureId, 5, 7)
const wall = (id, type, x, featureId = id, y1 = 3, y2 = 7) => ({ id, featureId, type, start: { x, y: y1 }, end: { x, y: y2 } })
const players = (statuses = {}) => ({
  A: { unitState: statuses.A ?? {} },
  B: { unitState: statuses.B ?? {} },
})

const check = ({ walls = [], areas = [], status = {}, shooter = op('s', 'A', 2), target = op('t', 'B', 12), others = [], point, weapon = null, markers = [] } = {}) =>
  analyseTarget({
    weapon,
    markers,
    tokens: [shooter, target, ...others],
    players: players(status),
    walls,
    areas,
    shooter,
    target,
    point: point ?? defaultShooterPoint(shooter, target),
    maxWoundsOf: () => 8,
  })

const engage = (key) => ({ [key]: { order: 'engage' } })

describe('targeting lines', () => {
  it('run to the facing half of the target between the two tangent points', () => {
    const arc = facingArc({ x: 0, y: 0 }, { x: 10, y: 0 }, 1)
    expect(arc).toHaveLength(13)
    arc.forEach((point) => expect(distance(point, { x: 10, y: 0 })).toBeCloseTo(1, 6))
    expect(arc[6].x).toBeCloseTo(9, 6) // the middle sample faces the shooter
  })

  it('start at the shooter’s closest edge and stay inside its base', () => {
    const shooter = op('s', 'A', 2)
    expect(defaultShooterPoint(shooter, op('t', 'B', 12)).x).toBeCloseTo(2 + 16 / 25.4, 6)
    expect(distance(clampToBase(shooter, { x: 9, y: 5 }), shooter)).toBeCloseTo(16 / 25.4, 6)
  })
})

describe('cover and obscured', () => {
  it('is clear with nothing in the way', () => {
    const result = check({ status: { B: engage('t') } })
    expect(result).toMatchObject({ cover: false, obscured: false, valid: true })
    expect(glanceStatus(result)).toBe('valid')
  })

  it('gives cover for terrain within 1" of the target, Light or Heavy', () => {
    const light = check({ walls: [wall('w', 'light', 10.8)], status: { B: engage('t') } })
    expect(light).toMatchObject({ cover: true, obscured: false, valid: true })
    expect(light.targetChips).toContain('COVER · 1 AUTO SAVE')
    expect(check({ walls: [wall('w', 'heavy', 10.8)], status: { B: engage('t') } }).cover).toBe(true)
  })

  it('gives no cover within 2"', () => {
    const result = check({ target: op('t', 'B', 4.8), walls: [wall('w', 'light', 3.9)], status: { B: engage('t') } })
    expect(result.cover).toBe(false)
    expect(result.targetChips).toContain('WITHIN 2" · NO COVER')
  })

  it('is obscured by Heavy terrain (and doors) more than 1" from both operatives', () => {
    const heavy = check({ walls: [half('w', 'heavy', 7)], status: { B: engage('t') } })
    expect(heavy).toMatchObject({ obscured: true, cover: false, hidden: false, valid: true })
    expect(heavy.targetChips).toContain('OBSCURED · −1 SUCCESS · NO CRITS')
    expect(check({ walls: [half('w', 'door', 7)], status: { B: engage('t') } }).obscured).toBe(true)
    expect(check({ walls: [wall('w', 'light', 7)], status: { B: engage('t') } }).obscured).toBe(false)
  })

  it('is not obscured by Heavy terrain within 1" of the shooter', () => {
    expect(check({ walls: [wall('w', 'heavy', 3.2)], status: { B: engage('t') } }).obscured).toBe(false)
  })

  it('lets the defender choose when one feature would give both cover and obscured', () => {
    const sameFeature = check({
      walls: [half('a', 'heavy', 7, 'ruin'), half('b', 'heavy', 10.8, 'ruin')],
      status: { B: engage('t') },
    })
    expect(sameFeature.chooseOne).toBe(true)
    expect(sameFeature.targetChips).toEqual(['COVER OR OBSCURED · DEFENDER CHOOSES'])
    const twoFeatures = check({ walls: [half('a', 'heavy', 7), wall('b', 'light', 10.8)], status: { B: engage('t') } })
    expect(twoFeatures).toMatchObject({ chooseOne: false, cover: true, obscured: true })
  })
})

describe('wholly behind Heavy terrain (visibility stand-in)', () => {
  it('counts as not visible, so not a valid target', () => {
    const result = check({ walls: [wall('w', 'heavy', 7)], status: { B: engage('t') } })
    expect(result).toMatchObject({ hidden: true, valid: false })
    expect(result.reasons).toContain('Wholly behind Heavy terrain (not visible)')
    expect(result.targetChips).not.toContain('OBSCURED · −1 SUCCESS · NO CRITS')
    expect(glanceStatus(result)).toBe('invalid')
  })

  it('isn’t hidden by Light terrain, or by its own ruin when up on Vantage', () => {
    expect(check({ walls: [wall('w', 'light', 7)], status: { B: engage('t') } }).hidden).toBe(false)
    const ruin = { featureId: 'ruin', points: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 10 }, { x: 0, y: 10 }] }
    const up = check({ walls: [wall('w', 'heavy', 7, 'ruin')], areas: [ruin], status: { A: { s: { vantage: 2 } }, B: engage('t') } })
    expect(up.hidden).toBe(false)
  })
})

describe('scan picture', () => {
  it('marks where each line turns red', () => {
    const reds = (walls) => check({ walls, status: { B: engage('t') } }).lines.map((line) => line.redFrom)
    expect(reds([]).every((t) => t === 1)).toBe(true)
    const partly = reds([half('w', 'heavy', 7)])
    expect(partly.some((t) => t < 1)).toBe(true)
    expect(partly.some((t) => t === 1)).toBe(true)
    expect(reds([wall('w', 'heavy', 7)]).every((t) => t < 1)).toBe(true)
    // Light terrain never turns the scan red.
    expect(reds([wall('w', 'light', 7)]).every((t) => t === 1)).toBe(true)
  })
})

describe('valid targets and shooting', () => {
  it('a Conceal target in cover is not a valid target', () => {
    const result = check({ walls: [wall('w', 'light', 10.8)] })
    expect(result.valid).toBe(false)
    expect(result.reasons).toContain('Conceal order in cover')
    expect(glanceStatus(result)).toBe('invalid')
  })

  it('a target with a friendly operative in its control range is not valid', () => {
    const result = check({ others: [op('f', 'A', 13.5)], status: { B: engage('t') } })
    expect(result.reasons).toContain('A friendly operative is within its control range')
  })

  it('warns when the shooter is on Conceal or engaged, and when it is injured', () => {
    const result = check({ others: [op('e', 'B', 3.5)], status: { A: { s: { order: 'conceal', wounds: 3 } }, B: engage('t') } })
    expect(result.shooterChips).toEqual(
      expect.arrayContaining(['CONCEAL · CAN’T SHOOT (SILENT ONLY)', 'ENGAGED · CAN’T SHOOT', 'INJURED · HIT WORSE BY 1']),
    )
  })
})

describe('vantage', () => {
  it('gives Accurate 1 / 2 against lower Engage targets', () => {
    const two = check({ status: { A: { s: { order: 'engage', vantage: 2 } }, B: engage('t') } })
    expect(two.shooterChips).toContain('VANTAGE · ACCURATE 1')
    const four = check({ status: { A: { s: { order: 'engage', vantage: 4 } }, B: engage('t') } })
    expect(four.shooterChips).toContain('VANTAGE · ACCURATE 2')
  })

  it('a lower Conceal target cannot use Light cover, but keeps a better cover save', () => {
    const result = check({ walls: [wall('w', 'light', 10.8)], status: { A: { s: { vantage: 2 } } } })
    expect(result.valid).toBe(true)
    expect(result.targetChips).toContain('VANTAGE · COVER SAVE AS CRIT, OR +1 COVER SAVE')
  })

  it('ignores Heavy terrain of the feature the shooter stands on for obscuring', () => {
    const ruin = { featureId: 'ruin', points: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 10 }, { x: 0, y: 10 }] }
    const onRuin = check({
      walls: [wall('w', 'heavy', 7, 'ruin')],
      areas: [ruin],
      status: { A: { s: { vantage: 2 } }, B: engage('t') },
    })
    expect(onRuin.obscured).toBe(false)
  })
})

describe('weapon rules', () => {
  it('Range: a target further away is not valid', () => {
    expect(check({ status: { B: engage('t') }, weapon: { range: 6 } }).reasons).toContain('Out of range (Rng 6")')
    expect(check({ status: { B: engage('t') }, weapon: { range: 12 } }).valid).toBe(true)
  })

  it('Seek / Seek Light: a Conceal target behind terrain can be targeted, but keeps its cover save', () => {
    const behindLight = { walls: [wall('w', 'light', 10.8)] }
    expect(check(behindLight).valid).toBe(false)
    const seekLight = check({ ...behindLight, weapon: { seekLight: true } })
    expect(seekLight.valid).toBe(true)
    expect(seekLight.targetChips).toContain('COVER · 1 AUTO SAVE')
    expect(check({ walls: [wall('w', 'heavy', 10.8, 'w', 4, 7)], weapon: { seekLight: true } }).valid).toBe(false)
    expect(check({ walls: [half('w', 'heavy', 10.8)], weapon: { seek: true } }).valid).toBe(true)
  })

  it('Saturate: no cover save', () => {
    const result = check({ walls: [wall('w', 'light', 10.8)], status: { B: engage('t') }, weapon: { saturate: true } })
    expect(result.targetChips).toContain('COVER · NO SAVE (SATURATE)')
  })

  it('Silent: can shoot on Conceal', () => {
    const result = check({ status: { B: engage('t') }, weapon: { silent: true } })
    expect(result.shooterChips).toContain('SILENT · CAN SHOOT ON CONCEAL')
    expect(result.shooterWarnings).toEqual([])
  })

  it('Accurate from the weapon and Vantage counts as Accurate 2', () => {
    const result = check({ status: { A: { s: { order: 'engage', vantage: 2 } }, B: engage('t') }, weapon: { accurate: 1 } })
    expect(result.shooterChips).toContain('VANTAGE · ACCURATE 2')
    expect(check({ status: { B: engage('t') }, weapon: { accurate: 1 } }).shooterChips).toContain('ACCURATE 1')
  })
})

describe('smoke', () => {
  const smokeOn = (x, y) => ({ id: 'm', catalogId: 'smoke-grenade', x, y, radius: 20 / 25.4 / 2 })

  it('an operative wholly in smoke is obscured to shooters more than 2" away', () => {
    const result = check({ status: { B: engage('t') }, markers: [smokeOn(12, 5)], weapon: { piercing: 2 } })
    expect(result.obscured).toBe(true)
    expect(result.targetChips).toEqual(
      expect.arrayContaining(['SMOKE · OBSCURED · −1 SUCCESS · NO CRITS', 'SMOKE · PIERCING 2 → 1']),
    )
  })

  it('not when only partly in smoke, or the shooter is within 2"', () => {
    expect(check({ status: { B: engage('t') }, markers: [smokeOn(13.5, 5)] }).obscured).toBe(false)
    expect(check({ target: op('t', 'B', 4.8), status: { B: engage('t') }, markers: [smokeOn(4.8, 5)] }).obscured).toBe(false)
  })
})

describe('splash targets', () => {
  const shooter = op('s', 'A', 2)
  const target = op('t', 'B', 12)
  const splash = (others, weapon, status = {}) =>
    splashTargets({
      tokens: [shooter, target, ...others],
      players: players({ B: { t: { order: 'engage' }, ...status.B }, A: status.A }),
      walls: [],
      shooter,
      target,
      point: defaultShooterPoint(shooter, target),
      weapon,
    }).map(({ token, kind, friendly }) => `${token.id}:${kind}${friendly ? ':friendly' : ''}`)

  it('Blast catches every operative within x of the target, friendlies included', () => {
    expect(splash([op('e', 'B', 13.5), op('f', 'A', 12, 6.5), op('far', 'B', 18)], { blast: 2 })).toEqual([
      'e:blast',
      'f:blast:friendly',
    ])
  })

  it('Torrent only adds valid enemy targets that aren’t engaged with friendlies', () => {
    const caught = splash(
      [op('e', 'B', 13.5), op('engaged', 'B', 12, 6.8), op('buddy', 'A', 12, 8.1)],
      { torrent: 2 },
      { B: { e: { order: 'engage' }, engaged: { order: 'engage' } } },
    )
    expect(caught).toEqual(['e:torrent'])
  })

  it('x" Devastating and the Stun grenade catch everything within their distance', () => {
    expect(splash([op('e', 'B', 13.2)], { devastating: { distance: 1, damage: 3 } })).toEqual(['e:devastating'])
    expect(splash([op('e', 'B', 13.2), op('far', 'B', 14.5)], { stunArea: 1 })).toEqual(['e:stun'])
  })
})
