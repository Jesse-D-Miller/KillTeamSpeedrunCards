import { describe, expect, it } from 'vitest'
import { DEFAULT_BOARD_LAYOUTS, boardLayoutFor, placePiece } from '../boardLayout.js'
import { createGame } from '../game.js'
import { ActionError, applyAction } from '../reducer.js'

const portrait = () => boardLayoutFor({}, 'A', 'portrait')

describe('side bar layout', () => {
  it('starts every piece at its default, and keeps the default size for saved spots', () => {
    expect(portrait()).toEqual(DEFAULT_BOARD_LAYOUTS.portrait)
    const layout = boardLayoutFor({ boardLayouts: { A: { portrait: { score: { x: 0.5, y: 0.5 } } } } }, 'A', 'portrait')
    expect(layout.score).toEqual({ ...DEFAULT_BOARD_LAYOUTS.portrait.score, x: 0.5, y: 0.5 })
    expect(layout.turn).toEqual(DEFAULT_BOARD_LAYOUTS.portrait.turn)
  })

  it('snaps a drop to 1% and keeps the piece on the board', () => {
    const layout = portrait()
    // Dragged off the top-left corner and off the right edge.
    expect(placePiece(layout, 'id', { x: -0.3, y: -0.2 })).toEqual({ x: 0, y: 0 })
    const { w } = layout.id
    expect(placePiece(layout, 'id', { x: 2, y: 0 }).x).toBeCloseTo(1 - w, 3)
  })

  it('nudges a dropped piece clear of the one it would cover', () => {
    const layout = portrait()
    // Dropping the score block onto the turning points tracker.
    const spot = placePiece(layout, 'score', { x: layout.turn.x, y: layout.turn.y })
    const moved = { ...layout.score, ...spot }
    const others = Object.entries(layout).filter(([piece]) => piece !== 'score')
    const overlapping = others.filter(
      ([, rect]) => moved.x < rect.x + rect.w && rect.x < moved.x + moved.w && moved.y < rect.y + rect.h && rect.y < moved.y + moved.h,
    )
    expect(overlapping.map(([piece]) => piece)).toEqual([])
  })
})

describe('crowded boards', () => {
  it('finds the nearest free spot even when straight moves are all blocked', () => {
    const layout = boardLayoutFor({}, 'A', 'landscape')
    // The score block dropped over the name and the turning points: moving only across
    // or only down can't clear both, but down and to the left can.
    const spot = placePiece(layout, 'score', { x: 0.14, y: 0.21 })
    const moved = { ...layout.score, ...spot }
    const covered = Object.entries(layout).filter(
      ([piece, rect]) =>
        piece !== 'score' && moved.x < rect.x + rect.w && rect.x < moved.x + moved.w && moved.y < rect.y + rect.h && rect.y < moved.y + moved.h,
    )
    expect(covered).toEqual([])
    expect(Math.hypot(spot.x - 0.14, spot.y - 0.21)).toBeLessThan(0.15)
  })
})

describe('board/layout actions', () => {
  it('saves a player’s drop for that board shape only, through a new game', () => {
    // A small nudge of the kill op, which snaps back onto the 1% grid.
    let state = applyAction(createGame(), { type: 'board/layout', shape: 'landscape', piece: 'kill', x: 0.452, y: 0.058 }, 'A')
    expect(state.settings.boardLayouts.A.landscape.kill).toEqual({ x: 0.45, y: 0.06 })
    expect(state.settings.boardLayouts.A.portrait).toBeUndefined()
    expect(state.settings.boardLayouts.B).toEqual({})
    state = applyAction(state, { type: 'game/reset' }, 'table')
    expect(state.settings.boardLayouts.A.landscape.kill).toEqual({ x: 0.45, y: 0.06 })
    state = applyAction(state, { type: 'board/resetLayout', shape: 'landscape' }, 'A')
    expect(state.settings.boardLayouts.A.landscape).toBeUndefined()
  })

  it('arranges only your own board, and only known pieces', () => {
    const state = applyAction(createGame(), { type: 'board/layout', seat: 'B', shape: 'portrait', piece: 'id', x: 0, y: 0 }, 'A')
    expect(state.settings.boardLayouts.A.portrait.id).toEqual({ x: 0, y: 0 })
    expect(state.settings.boardLayouts.B).toEqual({})
    expect(() => applyAction(createGame(), { type: 'board/layout', shape: 'portrait', piece: 'map', x: 0, y: 0 }, 'A')).toThrow(ActionError)
    expect(() => applyAction(createGame(), { type: 'board/layout', shape: 'round', piece: 'id', x: 0, y: 0 }, 'A')).toThrow(ActionError)
  })
})
