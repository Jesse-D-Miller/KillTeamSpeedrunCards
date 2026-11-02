import { describe, expect, it } from 'vitest'
import { placementWarning } from '../equipment.js'

const territory = { x: 0, y: 0, w: 15, h: 22 }
const drop = { x: 0, y: 0, w: 6, h: 22 }
const mark = (catalogId, x, y, extra = {}) => ({ id: `${catalogId}-${x}-${y}`, catalogId, x, y, radius: 0.4, ...extra })
const door = { points: [{ x: 10, y: 10 }, { x: 11, y: 10 }, { x: 11, y: 10.2 }, { x: 10, y: 10.2 }] }

describe('equipment set-up checks', () => {
  it('keeps markers wholly within your territory', () => {
    expect(placementWarning({ marker: mark('ammo-cache', 5, 5), territory })).toBeNull()
    expect(placementWarning({ marker: mark('comms-device', 14.8, 5), territory })).toMatch(/territory/)
  })

  it('keeps Mines more than 2" from other markers, objectives and doors', () => {
    const mines = mark('mines', 5, 5)
    expect(placementWarning({ marker: mines, markers: [mines, mark('ammo-cache', 7, 5)], territory })).toMatch(/other markers/)
    expect(placementWarning({ marker: mines, objectives: [{ x: 5, y: 7.5, radius: 0.5 }], territory })).toMatch(/other markers/)
    expect(placementWarning({ marker: mark('mines', 10.5, 8), doors: [door], territory })).toMatch(/Accessible/)
    expect(placementWarning({ marker: mines, markers: [mark('ammo-cache', 9, 5)], doors: [door], territory })).toBeNull()
  })

  it('measures Razor Wire along its length', () => {
    // 4" long, upright: its ends at y 3 and 7.
    const wire = mark('razor-wire', 5, 5, { span: 4, angle: 90 })
    expect(placementWarning({ marker: wire, markers: [mark('ladder', 5, 9)], territory })).toMatch(/equipment terrain/)
    expect(placementWarning({ marker: wire, markers: [mark('ladder', 5, 10)], territory })).toBeNull()
    expect(placementWarning({ marker: mark('razor-wire', 5, 1, { span: 4, angle: 90 }), territory })).toMatch(/territory/)
  })

  it('keeps the Heavy Barricade within 4" of your drop zone, and Ladders more than 1" from doors', () => {
    expect(placementWarning({ marker: mark('heavy-barricade', 9.5, 5), drop })).toBeNull()
    expect(placementWarning({ marker: mark('heavy-barricade', 11, 5), drop })).toMatch(/drop zone/)
    expect(placementWarning({ marker: mark('ladder', 10.5, 11.5), doors: [door], territory })).toMatch(/doors/)
    expect(placementWarning({ marker: mark('ladder', 10.5, 12), doors: [door], territory })).toBeNull()
  })
})
