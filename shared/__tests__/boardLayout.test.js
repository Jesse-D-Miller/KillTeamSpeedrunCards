import { describe, expect, it } from 'vitest'
import { DEFAULT_BOARD_LAYOUTS, barBounds, boardLayoutFor, placePiece } from '../boardLayout.js'
import { createGame } from '../game.js'
import { ActionError, applyAction } from '../reducer.js'

const portrait = () => boardLayoutFor({}, 'A', 'portrait')

describe('side bar layout', () => {
  it('starts every piece at its default, and keeps the default size for saved spots', () => {
    expect(portrait()).toEqual(DEFAULT_BOARD_LAYOUTS.portrait)
    const layout = boardLayoutFor({ boardLayouts: { A: { portrait: { score: { x: 0.5, y: 0.5 } } } } }, 'A', 'portrait')
    expect(layout.score).toEqual({ ...DEFAULT_BOARD_LAYOUTS.portrait.score, x: 0.5, y: 0.5, z: 0 })
    expect(layout.turn).toEqual(DEFAULT_BOARD_LAYOUTS.portrait.turn)
  })

  it('snaps a drop to 1% and keeps the piece on the board', () => {
    const layout = portrait()
    // Dragged off the top-left corner and off the right edge.
    expect(placePiece(layout, 'id', { x: -0.3, y: -0.2 })).toEqual({ x: 0, y: 0 })
    const { w } = layout.id
    expect(placePiece(layout, 'id', { x: 2, y: 0 }).x).toBeCloseTo(1 - w, 3)
  })

  it('lets pieces overlap where they are dropped', () => {
    const layout = portrait()
    // Dropped right over the turning points tracker (on the 1% grid), it stays there.
    expect(placePiece(layout, 'score', { x: 0.06, y: 0.3 })).toEqual({ x: 0.06, y: 0.3 })
  })
})

describe('room past the bar', () => {
  // An 8" x 22" portrait bar; 1.6" of picture past it.
  const portraitBar = { width: 8, height: 22, margin: 1.6 }

  it('reaches past every edge but the one facing the mat', () => {
    // Map 1, left of the mat, upright: the mat is to its right.
    expect(barBounds({ ...portraitBar, rotation: 0, matSide: 'right' })).toEqual({ minX: -0.2, maxX: 1, minY: -1.6 / 22, maxY: 1 + 1.6 / 22 })
    // Map 1, right of the mat, turned 180 to face its player: the mat is its right too.
    expect(barBounds({ ...portraitBar, rotation: 180, matSide: 'left' }).maxX).toBe(1)
    // Map 2, a landscape bar left of the mat turned 90: the mat is its top.
    const landscape = barBounds({ width: 22, height: 8, rotation: 90, matSide: 'right', margin: 1.6 })
    expect(landscape.minY).toBe(0)
    expect(landscape.maxY).toBeCloseTo(1.2, 5)
    expect(landscape.minX).toBeCloseTo(-1.6 / 22, 5)
  })

  it('keeps a dropped piece within those bounds', () => {
    const layout = portrait()
    const bounds = barBounds({ ...portraitBar, rotation: 0, matSide: 'right' })
    expect(placePiece(layout, 'tacop', { x: -1, y: 0.5 }, bounds).x).toBe(-0.2)
    expect(placePiece(layout, 'tacop', { x: 2, y: 0.5 }, bounds).x).toBeCloseTo(1 - layout.tacop.w, 3)
    // Junk bounds from a device can't send a piece far off the bar.
    expect(placePiece(layout, 'tacop', { x: -9, y: 0.5 }, { minX: -9, maxX: 1, minY: 0, maxY: 1 }).x).toBe(-0.5)
  })
})

describe('board/layout actions', () => {
  it('saves a player’s drop for that board shape only, through a new game', () => {
    // A small nudge of the kill op, which snaps back onto the 1% grid.
    let state = applyAction(createGame(), { type: 'board/layout', shape: 'landscape', piece: 'kill', x: 0.452, y: 0.058 }, 'A')
    expect(state.settings.boardLayouts.A.landscape.kill).toMatchObject({ x: 0.45, y: 0.06 })
    expect(state.settings.boardLayouts.A.portrait).toBeUndefined()
    expect(state.settings.boardLayouts.B).toEqual({})
    state = applyAction(state, { type: 'game/reset' }, 'table')
    expect(state.settings.boardLayouts.A.landscape.kill).toMatchObject({ x: 0.45, y: 0.06 })
    state = applyAction(state, { type: 'board/resetLayout', shape: 'landscape' }, 'A')
    expect(state.settings.boardLayouts.A.landscape).toBeUndefined()
  })

  it('puts the piece moved last on top', () => {
    let state = applyAction(createGame(), { type: 'board/layout', shape: 'portrait', piece: 'score', x: 0.06, y: 0.3 }, 'A')
    state = applyAction(state, { type: 'board/layout', shape: 'portrait', piece: 'turn', x: 0.06, y: 0.32 }, 'A')
    const layout = boardLayoutFor(state.settings, 'A', 'portrait')
    expect(layout.turn.z).toBeGreaterThan(layout.score.z)
    state = applyAction(state, { type: 'board/layout', shape: 'portrait', piece: 'score', x: 0.06, y: 0.3 }, 'A')
    expect(boardLayoutFor(state.settings, 'A', 'portrait').score.z).toBeGreaterThan(layout.turn.z)
  })

  it('arranges only your own board, and only known pieces', () => {
    const state = applyAction(createGame(), { type: 'board/layout', seat: 'B', shape: 'portrait', piece: 'id', x: 0, y: 0 }, 'A')
    expect(state.settings.boardLayouts.A.portrait.id).toMatchObject({ x: 0, y: 0 })
    expect(state.settings.boardLayouts.B).toEqual({})
    expect(() => applyAction(createGame(), { type: 'board/layout', shape: 'portrait', piece: 'map', x: 0, y: 0 }, 'A')).toThrow(ActionError)
    expect(() => applyAction(createGame(), { type: 'board/layout', shape: 'round', piece: 'id', x: 0, y: 0 }, 'A')).toThrow(ActionError)
  })
})
