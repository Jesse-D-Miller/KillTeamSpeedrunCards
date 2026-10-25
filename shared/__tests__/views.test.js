import { describe, expect, it } from 'vitest'
import { createGame } from '../game.js'
import { applyAction } from '../reducer.js'
import { viewFor } from '../views.js'

const TAC_OP = { id: 'scout-enemy-movement', label: 'Scout Enemy Movement' }
const PRIMARY = { category: 'killOp' }

const withSecrets = (phase) => {
  let state = createGame()
  state = applyAction(state, { type: 'phase/set', phase }, 'table')
  state = applyAction(state, { type: 'muster/units', units: ['X-1', 'X-2'] }, 'A')
  state = applyAction(state, { type: 'muster/toggleEquipment', eqId: 'EQ-1' }, 'A')
  state = applyAction(state, { type: 'muster/tacOp', tacOp: TAC_OP }, 'A')
  // The primary op is a secret gambit in turning point 1.
  if (phase === 'battle' || phase === 'results') {
    const battle = phase === 'results' ? applyAction(state, { type: 'phase/set', phase: 'battle' }, 'table') : state
    state = applyAction(battle, { type: 'battle/primaryOp', category: 'killOp' }, 'A')
    if (phase === 'results') state = applyAction(state, { type: 'phase/set', phase: 'results' }, 'table')
  }
  return state
}

const serialized = (value) => JSON.stringify(value)

describe('viewFor', () => {
  it('shows a seat its own secrets', () => {
    const view = viewFor(withSecrets('battle'), 'A')
    expect(view.players.A.tacOp).toEqual(TAC_OP)
    expect(view.players.A.primaryOp).toEqual(PRIMARY)
  })

  it.each(['B', 'table'])('hides secrets from %s', (role) => {
    const view = viewFor(withSecrets('battle'), role)
    const text = serialized(view)
    expect(text).not.toContain(TAC_OP.id)
    expect(view.players.A.tacOp).toEqual({ hidden: true })
    expect(view.players.A.primaryOp).toEqual({ hidden: true })
  })

  it('hides the roster from the opponent until muster is over', () => {
    const muster = viewFor(withSecrets('muster'), 'B')
    expect(serialized(muster)).not.toContain('X-1')
    expect(serialized(muster)).not.toContain('EQ-1')
    expect(muster.players.A.units).toHaveLength(2)

    const deploy = viewFor(withSecrets('deploy'), 'B')
    expect(deploy.players.A.units).toEqual(['X-1', 'X-2'])
  })

  it('reveals the tac op once the player reveals it', () => {
    const state = applyAction(withSecrets('battle'), { type: 'battle/revealTacOp' }, 'A')
    expect(viewFor(state, 'table').players.A.tacOp).toEqual(TAC_OP)
  })

  it('reveals everything at results', () => {
    const view = viewFor(withSecrets('results'), 'table')
    expect(view.players.A.tacOp).toEqual(TAC_OP)
    expect(view.players.A.primaryOp).toEqual(PRIMARY)
  })
})
