import { describe, expect, it } from 'vitest'
import { createGame, turnState } from '../game.js'
import { ActionError, applyAction } from '../reducer.js'

const run = (state, steps) =>
  steps.reduce((current, [action, actor]) => applyAction(current, action, actor), state)

const readySetup = () =>
  run(createGame(), [
    [{ type: 'phase/set', phase: 'setup' }, 'table'],
    [{ type: 'setup/killteam', killteamId: 'VOT-HKY' }, 'A'],
    [{ type: 'setup/killteam', killteamId: 'TAU-VESP' }, 'B'],
    [{ type: 'setup/rollOff', winner: 'A' }, 'table'],
    [{ type: 'setup/initiative', seat: 'A' }, 'A'],
    [{ type: 'setup/dropZone', zone: 'B' }, 'A'],
  ])

describe('applyAction', () => {
  it('rejects unknown actions', () => {
    expect(() => applyAction(createGame(), { type: 'nope' }, 'A')).toThrow(ActionError)
  })

  it('assigns the opposite drop zone to the opponent', () => {
    const state = readySetup()
    expect(state.table.dropZones).toEqual({ A: 'B', B: 'A' })
  })

  it('advances phase only when both seats are ready', () => {
    let state = readySetup()
    state = applyAction(state, { type: 'phase/ready' }, 'A')
    expect(state.phase).toBe('setup')
    expect(state.ready.A).toBe(true)
    state = applyAction(state, { type: 'phase/ready' }, 'B')
    expect(state.phase).toBe('muster')
    expect(state.ready).toEqual({ A: false, B: false })
  })

  it('blocks leaving setup without kill teams', () => {
    const state = applyAction(createGame(), { type: 'phase/set', phase: 'setup' }, 'table')
    const readyA = applyAction(state, { type: 'phase/ready' }, 'A')
    expect(() => applyAction(readyA, { type: 'phase/ready' }, 'B')).toThrow(/kill team/)
  })

  it('requires a seat when the table acts for a player', () => {
    expect(() => applyAction(createGame(), { type: 'player/rename', name: 'x' }, 'table')).toThrow(
      /seat/,
    )
    const state = applyAction(createGame(), { type: 'player/rename', name: 'Jesse', seat: 'B' }, 'table')
    expect(state.players.B.name).toBe('Jesse')
  })

  it('a seat cannot act for the other seat', () => {
    const state = applyAction(createGame(), { type: 'player/rename', name: 'Sneaky', seat: 'B' }, 'A')
    expect(state.players.A.name).toBe('Sneaky')
    expect(state.players.B.name).toBe('Player B')
  })

  it('starts with 2CP and gains 1CP in the first Ready step', () => {
    const state = createGame()
    expect(state.players.A.cp).toBe(2)
    expect(applyAction(state, { type: 'phase/set', phase: 'battle' }, 'table').players.A.cp).toBe(3)
  })

  it('charges and refunds CP for strat ploys', () => {
    let state = applyAction(createGame(), { type: 'phase/set', phase: 'battle' }, 'table')
    state = applyAction(state, { type: 'battle/togglePloy', ployId: 'p1' }, 'A')
    expect(state.players.A.cp).toBe(2)
    expect(state.players.A.ploysByTp[1]).toEqual(['p1'])
    state = applyAction(state, { type: 'battle/togglePloy', ployId: 'p1' }, 'A')
    expect(state.players.A.cp).toBe(3)
    expect(state.players.A.ploysByTp[1]).toEqual([])
  })

  it('refuses ploys without CP', () => {
    let state = createGame()
    state = applyAction(state, { type: 'battle/score', field: 'cp', delta: -2 }, 'A')
    expect(() => applyAction(state, { type: 'battle/togglePloy', ployId: 'p1' }, 'A')).toThrow(/CP/)
  })

  it('next TP readies units, adds CP and ends after TP4', () => {
    let state = applyAction(createGame(), { type: 'phase/set', phase: 'battle' }, 'table')
    state = applyAction(
      state,
      { type: 'unit/update', unitKey: 'u-0', maxWounds: 8, patch: { activation: 'expended' } },
      'A',
    )
    state = applyAction(state, { type: 'battle/nextTp' }, 'table')
    expect(state.battle.tp).toBe(2)
    expect(state.players.A.cp).toBe(4)
    expect(state.players.A.unitState['u-0']).toMatchObject({ activation: 'ready', wounds: 8 })
    state = run(state, [
      [{ type: 'battle/nextTp' }, 'table'],
      [{ type: 'battle/nextTp' }, 'table'],
    ])
    expect(state.battle.tp).toBe(4)
    state = applyAction(state, { type: 'battle/nextTp' }, 'table')
    expect(state.phase).toBe('results')
  })

  it('gives the extra CP to the player without initiative, from TP2', () => {
    let state = applyAction(createGame(), { type: 'phase/set', phase: 'battle' }, 'table')
    state = applyAction(state, { type: 'battle/rollOff', winner: 'A' }, 'table')
    state = applyAction(state, { type: 'battle/initiative', seat: 'A' }, 'table')
    expect([state.players.A.cp, state.players.B.cp]).toEqual([3, 3])
    state = applyAction(state, { type: 'battle/nextTp' }, 'table')
    state = applyAction(state, { type: 'battle/rollOff', winner: 'A' }, 'table')
    state = applyAction(state, { type: 'battle/initiative', seat: 'A' }, 'table')
    expect([state.players.A.cp, state.players.B.cp]).toEqual([4, 5])
    state = applyAction(state, { type: 'battle/initiative', seat: 'B' }, 'table')
    expect([state.players.A.cp, state.players.B.cp]).toEqual([5, 4])
    state = applyAction(state, { type: 'battle/initiative', seat: 'B' }, 'table')
    expect([state.players.A.cp, state.players.B.cp]).toEqual([5, 4])
  })

  it('sanitizes unit patches', () => {
    const state = applyAction(
      createGame(),
      { type: 'unit/update', unitKey: 'u-1', maxWounds: 10, patch: { wounds: '7', order: 'bogus', hacked: 1 } },
      'B',
    )
    const unit = state.players.B.unitState['u-1']
    expect(unit.wounds).toBe(7)
    expect(unit.order).toBe('conceal')
    expect(unit).not.toHaveProperty('hacked')
  })

  it('adds, moves and removes tokens', () => {
    let state = applyAction(createGame(), { type: 'token/add', x: 3, y: 4, label: 'Leader' }, 'A')
    const [token] = state.tokens
    expect(token).toMatchObject({ seat: 'A', x: 3, y: 4, label: 'Leader' })
    state = applyAction(state, { type: 'token/update', id: token.id, x: 10, y: 11, ring: 3 }, 'B')
    expect(state.tokens[0]).toMatchObject({ x: 10, y: 11, ring: 3 })
    state = applyAction(state, { type: 'token/remove', id: token.id }, 'A')
    expect(state.tokens).toEqual([])
  })

  it('reset keeps projector settings', () => {
    let state = applyAction(
      createGame(),
      { type: 'settings/update', patch: { showGrid: false, junk: 1 } },
      'table',
    )
    state = applyAction(state, { type: 'game/reset' }, 'table')
    expect(state.settings.showGrid).toBe(false)
    expect(state.settings).not.toHaveProperty('junk')
  })
})

describe('scoring', () => {
  it('caps each op at 6 VP and adds half the primary category at the end', async () => {
    const { totalVp, primaryBonus } = await import('../game.js')
    let state = createGame()
    for (let i = 0; i < 8; i += 1) state = applyAction(state, { type: 'battle/vp', category: 'killOp', delta: 1 }, 'A')
    state = applyAction(state, { type: 'battle/vp', category: 'critOp', delta: 3 }, 'A')
    state = applyAction(state, { type: 'phase/set', phase: 'battle' }, 'table')
    state = applyAction(state, { type: 'battle/primaryOp', category: 'killOp' }, 'A')
    const player = state.players.A
    expect(player.score.killOp).toBe(6)
    expect(totalVp(player)).toBe(9)
    expect(primaryBonus(player)).toBe(3)
    expect(totalVp(player, { withPrimary: true })).toBe(12)
  })
})

describe('killzone + crit op rolls', () => {
  it('rolls both automatically when setup starts', async () => {
    const { ARRANGEMENT_OPTIONS, CRIT_OP_IDS } = await import('../rolls.js')
    // Defaults are arr_01 / crit_ops_01, which are excluded, so 0.999 picks the last entries.
    const state = applyAction(createGame(), { type: 'phase/set', phase: 'setup' }, 'table', () => 0.999)
    const lastArrangement = ARRANGEMENT_OPTIONS[ARRANGEMENT_OPTIONS.length - 1]
    expect(state.table.arrangementId).toBe(lastArrangement.arrangementId)
    expect(state.table.mapId).toBe(lastArrangement.mapId)
    expect(state.table.critOpId).toBe(CRIT_OP_IDS[CRIT_OP_IDS.length - 1])
  })

  it('re-rolls always change the result and keep map + layout consistent', async () => {
    const { ARRANGEMENT_OPTIONS } = await import('../rolls.js')
    let state = applyAction(createGame(), { type: 'phase/set', phase: 'setup' }, 'table')
    for (let i = 0; i < 30; i += 1) {
      const before = state.table
      state = applyAction(state, { type: 'setup/rollKillzone' }, 'A')
      state = applyAction(state, { type: 'setup/rollCritOp' }, 'B')
      expect(state.table.arrangementId).not.toBe(before.arrangementId)
      expect(state.table.critOpId).not.toBe(before.critOpId)
      expect(ARRANGEMENT_OPTIONS).toContainEqual({
        mapId: state.table.mapId,
        arrangementId: state.table.arrangementId,
      })
    }
  })

  it('a killzone re-roll clears tokens and markers', () => {
    let state = applyAction(createGame(), { type: 'token/add', x: 1, y: 1 }, 'A')
    state = applyAction(state, { type: 'setup/rollKillzone' }, 'A')
    expect(state.tokens).toEqual([])
  })
})

describe('token base sizes', () => {
  it('defaults to 32mm, keeps half-mm sizes and clamps junk', () => {
    let state = applyAction(createGame(), { type: 'token/add', x: 1, y: 1 }, 'A')
    state = applyAction(state, { type: 'token/add', x: 2, y: 2, baseMm: 28.5 }, 'A')
    state = applyAction(state, { type: 'token/add', x: 3, y: 3, baseMm: 999 }, 'A')
    expect(state.tokens.map((token) => token.baseMm)).toEqual([32, 28.5, 80])
    state = applyAction(state, { type: 'token/update', id: state.tokens[0].id, baseMm: 40 }, 'B')
    expect(state.tokens[0].baseMm).toBe(40)
  })

  it('a base size can still be changed after placement is finished', () => {
    let state = applyAction(createGame(), { type: 'token/add', x: 1, y: 1, baseMm: 28.5 }, 'A')
    expect(state.tokens[0].baseLocked).toBe(false)
    state = applyAction(state, { type: 'token/update', id: 't1', baseLocked: true }, 'A')
    state = applyAction(state, { type: 'token/update', id: 't1', baseMm: 40, ring: 3 }, 'A')
    expect(state.tokens[0]).toMatchObject({ baseMm: 40, baseLocked: true, ring: 3 })
  })
})

describe('Approved Ops 2025 initiative', () => {
  const setup = (winner, initiative) =>
    run(createGame(), [
      [{ type: 'phase/set', phase: 'setup' }, 'table'],
      [{ type: 'setup/rollOff', winner }, 'table'],
      [{ type: 'setup/initiative', seat: initiative }, winner],
    ])

  it('lets the roll-off winner give initiative away; the other player gets the Re-roll card', () => {
    const state = setup('A', 'B')
    expect(state.table.initiativeSeat).toBe('B')
    expect(state.players.A.initiativeCards).toEqual([{ id: 'reroll', value: 0, used: false }])
    expect(state.players.B.initiativeCards).toEqual([])
    expect(() => applyAction(setup('A', 'B'), { type: 'setup/initiative', seat: 'A' }, 'B')).toThrow(/winner decides/)
  })

  it('only the player with initiative picks the drop zone', () => {
    const state = setup('A', 'B')
    expect(() => applyAction(state, { type: 'setup/dropZone', zone: 'A' }, 'A')).toThrow(/initiative picks/)
    expect(applyAction(state, { type: 'setup/dropZone', zone: 'A' }, 'B').table.dropZones).toEqual({ A: 'B', B: 'A' })
  })

  it('gives the roll-off loser the +N/-N card each turning point except the fourth', () => {
    let state = applyAction(setup('A', 'A'), { type: 'phase/set', phase: 'battle' }, 'table')
    state = applyAction(state, { type: 'battle/rollOff', winner: 'A' }, 'table')
    expect(state.players.B.initiativeCards.map((card) => card.id)).toEqual(['reroll', 'tp1'])
    // Correcting the roll-off moves the card to the real loser.
    state = applyAction(state, { type: 'battle/rollOff', winner: 'B' }, 'table')
    expect(state.players.A.initiativeCards.map((card) => card.id)).toEqual(['tp1'])
    expect(state.players.B.initiativeCards.map((card) => card.id)).toEqual(['reroll'])
    expect(() => applyAction(state, { type: 'battle/initiative', seat: 'A' }, 'A')).toThrow(/winner decides/)
    state = applyAction(state, { type: 'battle/initiative', seat: 'B' }, 'B')
    state = run(state, [
      [{ type: 'battle/nextTp' }, 'table'],
      [{ type: 'battle/nextTp' }, 'table'],
      [{ type: 'battle/nextTp' }, 'table'],
      [{ type: 'battle/rollOff', winner: 'A' }, 'table'],
    ])
    expect(state.battle.tp).toBe(4)
    expect(state.players.B.initiativeCards.some((card) => card.id === 'tp4')).toBe(false)
  })

  it('a tie goes to the player who does not have initiative', () => {
    let state = applyAction(setup('A', 'A'), { type: 'phase/set', phase: 'battle' }, 'table')
    state = applyAction(state, { type: 'battle/rollOff', winner: 'tie' }, 'table')
    expect(state.battle.rollOffByTp[1]).toBe('B')
    state = applyAction(state, { type: 'battle/initiative', seat: 'B' }, 'B')
    state = applyAction(state, { type: 'battle/nextTp' }, 'table')
    state = applyAction(state, { type: 'battle/rollOff', winner: 'tie' }, 'table')
    expect(state.battle.rollOffByTp[2]).toBe('A')
  })

  it('discards played initiative cards at the next turning point', () => {
    let state = applyAction(setup('A', 'A'), { type: 'phase/set', phase: 'battle' }, 'table')
    state = applyAction(state, { type: 'battle/useInitiativeCard', id: 'reroll' }, 'B')
    expect(state.players.B.initiativeCards[0].used).toBe(true)
    state = applyAction(state, { type: 'battle/nextTp' }, 'table')
    expect(state.players.B.initiativeCards).toEqual([])
  })

  it('takes the primary op in turning point 1 only', () => {
    let state = applyAction(createGame(), { type: 'phase/set', phase: 'battle' }, 'table')
    state = applyAction(state, { type: 'battle/primaryOp', category: 'tacOp' }, 'A')
    expect(state.players.A.primaryOp).toEqual({ category: 'tacOp' })
    state = applyAction(state, { type: 'battle/nextTp' }, 'table')
    expect(() => applyAction(state, { type: 'battle/primaryOp', category: 'critOp' }, 'A')).toThrow(/first turning point/)
  })
})

describe('equipment', () => {
  const take = (state, eqId) => applyAction(state, { type: 'muster/toggleEquipment', eqId }, 'A')

  it('allows up to four options, counting a grenade pair as one', () => {
    let state = createGame()
    ;['UNIVERSAL-UE-AC', 'UNIVERSAL-UE-MN', 'UNIVERSAL-UE-UG-SMK', 'UNIVERSAL-UE-UG-STN', 'UNIVERSAL-UE-LAD'].forEach((eqId) => {
      state = take(state, eqId)
    })
    expect(state.players.A.equipment).toHaveLength(5)
    expect(() => take(state, 'UNIVERSAL-UE-RW')).toThrow('up to 4 equipment options')
    state = take(state, 'UNIVERSAL-UE-LAD')
    expect(take(state, 'UNIVERSAL-UE-RW').players.A.equipment).toContain('UNIVERSAL-UE-RW')
  })
})

describe('markers and tokens on operatives', () => {
  const withHost = () => applyAction(createGame(), { type: 'token/add', x: 5, y: 5, unitKey: 'u1' }, 'A')

  it('attaches a token to an operative, and moving it detaches it', () => {
    let state = applyAction(withHost(), { type: 'marker/add', kind: 'token', label: 'Stunned', attachedTo: 't1', x: 5, y: 5 }, 'A')
    expect(state.markers[0]).toMatchObject({ attachedTo: 't1', kind: 'token', ring: 0 })
    state = applyAction(state, { type: 'marker/update', id: 'm2', x: 9, y: 9 }, 'A')
    expect(state.markers[0]).toMatchObject({ attachedTo: null, x: 9, y: 9 })
    state = applyAction(state, { type: 'marker/update', id: 'm2', attachedTo: 't1', ring: 2 }, 'A')
    expect(state.markers[0]).toMatchObject({ attachedTo: 't1', ring: 2 })
    state = applyAction(state, { type: 'marker/update', id: 'm2', radius: 0.4 }, 'A')
    expect(state.markers[0]).toMatchObject({ radius: 0.4, attachedTo: 't1' })
    expect(() => applyAction(state, { type: 'marker/update', id: 'm2', attachedTo: 'nope' }, 'A')).toThrow('Token not found.')
  })

  it('removing an operative removes the tokens riding on it, but not free markers', () => {
    let state = applyAction(withHost(), { type: 'marker/add', kind: 'token', attachedTo: 't1' }, 'A')
    state = applyAction(state, { type: 'marker/add', kind: 'marker', x: 2, y: 2 }, 'A')
    state = applyAction(state, { type: 'token/remove', id: 't1' }, 'A')
    expect(state.markers.map((marker) => marker.id)).toEqual(['m3'])
  })
})

describe('order tag colour', () => {
  it('flips when an operative is expended, undoes, and survives the next turning point', () => {
    const expend = (state, activation) =>
      applyAction(state, { type: 'unit/update', unitKey: 'u1', maxWounds: 8, patch: { activation } }, 'A')
    let state = expend(createGame(), 'active')
    expect(state.players.A.unitState.u1.orderFlips).toBe(0)
    state = expend(state, 'expended')
    expect(state.players.A.unitState.u1.orderFlips).toBe(1)
    state = expend(state, 'ready')
    expect(state.players.A.unitState.u1.orderFlips).toBe(0)
    state = expend(expend(state, 'expended'), 'expended')
    expect(state.players.A.unitState.u1.orderFlips).toBe(1)
    state = applyAction(state, { type: 'unit/update', unitKey: 'u1', patch: { order: 'engage' } }, 'A')
    expect(state.players.A.unitState.u1).toMatchObject({ order: 'engage', orderFlips: 1 })
  })
})

describe('token movement', () => {
  const path = [
    { x: 2, y: 2 },
    { x: 3, y: 2 },
    { x: 4, y: 2 },
    { x: 4, y: 3 },
  ]
  const withToken = () => applyAction(createGame(), { type: 'token/add', x: 2, y: 2 }, 'A')
  const moved = () => applyAction(withToken(), { type: 'token/move', id: 't1', path }, 'A')

  it('moves along the path and remembers it', () => {
    const state = moved()
    expect(state.tokens[0]).toMatchObject({ x: 4, y: 3 })
    expect(state.tokens[0].lastMove).toEqual({ from: { x: 2, y: 2 }, path, inches: 3, prevMovedTp: null })
  })

  it('a second drag continues the same movement from its original start', () => {
    const state = applyAction(moved(), { type: 'token/move', id: 't1', path: [...path, { x: 4, y: 4 }] }, 'A')
    expect(state.tokens[0]).toMatchObject({ x: 4, y: 4 })
    expect(state.tokens[0].lastMove.from).toEqual({ x: 2, y: 2 })
    expect(state.tokens[0].lastMove.inches).toBe(4)
  })

  it('dragging all the way back cancels the movement', () => {
    const state = applyAction(moved(), { type: 'token/move', id: 't1', path: [path[0]] }, 'A')
    expect(state.tokens[0]).toMatchObject({ x: 2, y: 2, lastMove: null })
  })

  it('undo step removes one inch at a time', () => {
    let state = applyAction(moved(), { type: 'token/undoStep', id: 't1' }, 'A')
    expect(state.tokens[0]).toMatchObject({ x: 4, y: 2 })
    expect(state.tokens[0].lastMove.inches).toBe(2)
    state = applyAction(state, { type: 'token/undoStep', id: 't1' }, 'A')
    state = applyAction(state, { type: 'token/undoStep', id: 't1' }, 'A')
    expect(state.tokens[0]).toMatchObject({ x: 2, y: 2, lastMove: null })
  })

  it('undo move puts the token back and clears the path', () => {
    const state = applyAction(moved(), { type: 'token/undoMove', id: 't1' }, 'A')
    expect(state.tokens[0]).toMatchObject({ x: 2, y: 2, lastMove: null })
    expect(() => applyAction(state, { type: 'token/undoMove', id: 't1' }, 'A')).toThrow(/undo/)
  })

  it('the next TP starts a fresh movement', () => {
    let state = applyAction(withToken(), { type: 'phase/set', phase: 'battle' }, 'table')
    state = applyAction(state, { type: 'token/move', id: 't1', path }, 'A')
    state = applyAction(state, { type: 'battle/nextTp' }, 'table')
    expect(state.tokens[0].lastMove).toBeNull()
    state = applyAction(state, { type: 'token/move', id: 't1', path: [{ x: 4, y: 3 }, { x: 5, y: 3 }] }, 'A')
    expect(state.tokens[0].lastMove.from).toEqual({ x: 4, y: 3 })
  })

  it('moving another operative clears the previous one\'s path', () => {
    let state = applyAction(moved(), { type: 'token/add', x: 10, y: 10 }, 'A')
    state = applyAction(state, { type: 'token/move', id: 't2', path: [{ x: 10, y: 10 }, { x: 11, y: 10 }] }, 'A')
    expect(state.tokens[0].lastMove).toBeNull()
    expect(state.tokens[0]).toMatchObject({ x: 4, y: 3 })
    expect(state.tokens[1].lastMove.inches).toBe(1)
    state = applyAction(state, { type: 'token/undoMove', id: 't2' }, 'A')
    expect(state.tokens[1]).toMatchObject({ x: 10, y: 10, lastMove: null })
  })

  it('caps long paths', () => {
    const long = Array.from({ length: 500 }, (_, i) => ({ x: i * 0.01, y: 1 }))
    const state = applyAction(withToken(), { type: 'token/move', id: 't1', path: long }, 'A')
    expect(state.tokens[0].lastMove.path).toHaveLength(200)
  })
})

describe('semi-automatic activations', () => {
  // Alice (A) has three operatives (t1, t2, t4), Bob (B) one (t3). A has initiative in TP1.
  const battle = ({ firefight = true } = {}) => {
    let state = run(createGame(), [
      [{ type: 'muster/units', units: ['a1', 'a2', 'a3'] }, 'A'],
      [{ type: 'muster/units', units: ['b1'] }, 'B'],
      [{ type: 'token/add', x: 2, y: 2, unitKey: 'a1', maxWounds: 8 }, 'A'],
      [{ type: 'token/add', x: 4, y: 2, unitKey: 'a2', maxWounds: 8 }, 'A'],
      [{ type: 'token/add', x: 6, y: 20, unitKey: 'b1', maxWounds: 9 }, 'B'],
      [{ type: 'token/add', x: 8, y: 2, unitKey: 'a3', maxWounds: 8 }, 'A'],
      [{ type: 'phase/set', phase: 'battle' }, 'table'],
      [{ type: 'battle/rollOff', winner: 'A' }, 'table'],
      [{ type: 'battle/initiative', seat: 'A' }, 'table'],
    ])
    if (firefight) state = applyAction(state, { type: 'battle/startFirefight' }, 'A')
    return state
  }
  const move = (state, id, actor, to = 3) =>
    applyAction(state, { type: 'token/move', id, path: [{ x: 0, y: 0 }, { x: to, y: to }] }, actor)
  const unit = (state, seat, key) => state.players[seat].unitState[key]

  it('moving a ready operative activates it, with its wounds seeded', () => {
    const state = move(battle(), 't1', 'A')
    expect(unit(state, 'A', 'a1')).toMatchObject({ activation: 'active', wounds: 8, orderFlips: 0 })
    expect(turnState(state)).toMatchObject({ activeSeat: 'A', activeUnitKey: 'a1' })
  })

  it('the next operative to move (either player) expends the active one and flips its tag', () => {
    let state = move(battle(), 't1', 'A')
    state = move(state, 't3', 'B')
    expect(unit(state, 'A', 'a1')).toMatchObject({ activation: 'expended', orderFlips: 1 })
    expect(unit(state, 'B', 'b1').activation).toBe('active')
    // Moving the active operative again (e.g. Dash after Reposition) changes nothing.
    expect(move(state, 't3', 'B', 5).players).toEqual(move(state, 't3', 'B', 5).players)
    expect(unit(move(state, 't3', 'B', 5), 'B', 'b1').activation).toBe('active')
  })

  it('does nothing before the Firefight phase starts (but the move still counts as moving)', () => {
    const state = move(battle({ firefight: false }), 't1', 'A')
    expect(unit(state, 'A', 'a1')).toMatchObject({ activation: 'ready', movedTp: 1 })
    expect(turnState(state).activeSeat).toBeNull()
  })

  it('remembers the turning point an operative last moved in, and undoing the move forgets it', () => {
    let state = move(battle(), 't1', 'A')
    expect(unit(state, 'A', 'a1').movedTp).toBe(1)
    state = applyAction(state, { type: 'token/undoMove', id: 't1' }, 'A')
    expect(unit(state, 'A', 'a1').movedTp).toBeNull()
    // Back-tracking to the start forgets it too.
    state = move(state, 't1', 'A')
    state = applyAction(state, { type: 'token/move', id: 't1', path: [{ x: 2, y: 2 }] }, 'A')
    expect(unit(state, 'A', 'a1').movedTp).toBeNull()
  })

  it('an earlier move this turning point still counts after a later one is undone', () => {
    let state = move(battle({ firefight: false }), 't1', 'A')
    // Another operative moves (so t1's path is cleared), then t1 moves again and undoes it.
    state = move(state, 't2', 'A')
    state = applyAction(state, { type: 'battle/startFirefight' }, 'A')
    state = move(state, 't1', 'A', 5)
    state = applyAction(state, { type: 'token/undoMove', id: 't1' }, 'A')
    expect(unit(state, 'A', 'a1').movedTp).toBe(1)
  })

  it('undoing the move reverts the activation and the operative it expended', () => {
    let state = move(battle(), 't1', 'A')
    state = move(state, 't3', 'B')
    state = applyAction(state, { type: 'token/undoMove', id: 't3' }, 'B')
    expect(unit(state, 'B', 'b1').activation).toBe('ready')
    expect(unit(state, 'A', 'a1')).toMatchObject({ activation: 'active', orderFlips: 0 })
  })

  it('back-tracking to the start resets the operative to where it was, and ready', () => {
    let state = move(battle(), 't1', 'A')
    state = move(state, 't3', 'B')
    // Bob drags back to where he started: his path is just the start point again.
    state = applyAction(state, { type: 'token/move', id: 't3', path: [{ x: 6, y: 20 }] }, 'B')
    expect(state.tokens.find((token) => token.id === 't3')).toMatchObject({ x: 6, y: 20, lastMove: null })
    expect(unit(state, 'B', 'b1').activation).toBe('ready')
    expect(unit(state, 'A', 'a1').activation).toBe('active')
  })

  it('activating by hand or ending the activation expends the active operative', () => {
    let state = move(battle(), 't1', 'A')
    state = applyAction(state, { type: 'unit/update', unitKey: 'b1', maxWounds: 9, patch: { activation: 'active' } }, 'B')
    expect(unit(state, 'A', 'a1').activation).toBe('expended')
    state = applyAction(state, { type: 'battle/endActivation' }, 'B')
    expect(unit(state, 'B', 'b1').activation).toBe('expended')
    expect(turnState(state)).toMatchObject({ activeSeat: null, nextSeat: 'A' })
  })

  it('works out whose turn it is and when a counteract is available', () => {
    let state = battle()
    expect(turnState(state).nextSeat).toBe('A')
    state = applyAction(move(state, 't1', 'A'), { type: 'battle/endActivation' }, 'A')
    expect(turnState(state).nextSeat).toBe('B')
    state = applyAction(move(state, 't3', 'B'), { type: 'battle/endActivation' }, 'B')
    state = applyAction(state, { type: 'unit/update', unitKey: 'b1', patch: { order: 'engage' } }, 'B')
    // Bob has nothing ready, so Alice goes again; it's her turn, so no counteract yet.
    expect(turnState(state)).toMatchObject({ nextSeat: 'A', counteractSeat: null })
    // After Alice's activation it would be Bob's turn: he can counteract instead.
    state = applyAction(move(state, 't2', 'A'), { type: 'battle/endActivation' }, 'A')
    expect(turnState(state)).toMatchObject({ nextSeat: 'A', counteractSeat: 'B' })
  })

  it('moving an expended Engage operative is its counteraction, once per turning point', () => {
    let state = applyAction(move(battle(), 't1', 'A'), { type: 'battle/endActivation' }, 'A')
    state = applyAction(move(state, 't3', 'B'), { type: 'battle/endActivation' }, 'B')
    state = applyAction(state, { type: 'unit/update', unitKey: 'b1', patch: { order: 'engage' } }, 'B')
    state = move(state, 't2', 'A')
    state = move(state, 't3', 'B', 4)
    expect(unit(state, 'A', 'a2').activation).toBe('expended')
    expect(unit(state, 'B', 'b1')).toMatchObject({ activation: 'expended', counteractedTp: 1 })
    expect(turnState(state).counteractSeat).toBe(null)
  })

  it('a Conceal operative cannot counteract, so moving it changes nothing', () => {
    let state = applyAction(move(battle(), 't1', 'A'), { type: 'battle/endActivation' }, 'A')
    state = applyAction(move(state, 't3', 'B'), { type: 'battle/endActivation' }, 'B')
    state = move(state, 't3', 'B', 4)
    expect(unit(state, 'B', 'b1').counteractedTp).toBeUndefined()
  })
})

describe('shot cards', () => {
  const battle = () =>
    run(createGame(), [
      [{ type: 'phase/set', phase: 'battle' }, 'table'],
    ])
  const toggle = (state, actor, patch) => applyAction(state, { type: 'shot/toggle', key: 't1|t2', ...patch }, actor)

  it('keeps each player’s toggles for the shot', () => {
    let state = toggle(battle(), 'A', { id: 'ammo-cache', on: true })
    state = toggle(state, 'B', { id: 'portable-barricade', on: true })
    expect(state.battle.shots['t1|t2'].toggles).toEqual({ A: { 'ammo-cache': true }, B: { 'portable-barricade': true } })
    state = toggle(state, 'A', { id: 'ammo-cache', on: false })
    expect(state.battle.shots['t1|t2'].toggles.A).toEqual({ 'ammo-cache': false })
  })

  it('a firefight ploy spends its CP once per turning point, and turning it off in the same shot refunds it', () => {
    const start = battle()
    const cp = start.players.B.cp
    let state = toggle(start, 'B', { id: 'VOT-HKY-T-STRD', on: true, cost: 1, limit: 1 })
    expect(state.players.B.cp).toBe(cp - 1)
    expect(state.players.B.usesByTp[1]).toEqual({ 'VOT-HKY-T-STRD': 1 })
    // Already used this turning point: another shot can't use it again.
    expect(() =>
      applyAction(state, { type: 'shot/toggle', key: 't3|t4', id: 'VOT-HKY-T-STRD', on: true, cost: 1, limit: 1 }, 'B'),
    ).toThrow(/Already used/)
    state = toggle(state, 'B', { id: 'VOT-HKY-T-STRD', on: false, cost: 1, limit: 1 })
    expect(state.players.B.cp).toBe(cp)
    expect(state.players.B.usesByTp[1]).toEqual({ 'VOT-HKY-T-STRD': 0 })
  })

  it('needs enough CP, and the battle phase, to spend it', () => {
    const broke = run(battle(), [[{ type: 'battle/score', field: 'cp', delta: -10 }, 'B']])
    expect(() => toggle(broke, 'B', { id: 'ploy', on: true, cost: 1, limit: 1 })).toThrow(/Not enough CP/)
    expect(() => toggle(createGame(), 'B', { id: 'ploy', on: true, cost: 1, limit: 1 })).toThrow(/Not available/)
    // Free toggles work in any phase.
    expect(toggle(createGame(), 'B', { id: 'note', on: true }).battle.shots['t1|t2'].toggles.B).toEqual({ note: true })
  })

  it('equipment limited to twice per turning point counts its uses', () => {
    let state = toggle(battle(), 'A', { id: 'VOT-HKY-SBS', on: true, limit: 2 })
    state = applyAction(state, { type: 'shot/toggle', key: 't1|t5', id: 'VOT-HKY-SBS', on: true, limit: 2 }, 'A')
    expect(state.players.A.usesByTp[1]['VOT-HKY-SBS']).toBe(2)
    expect(() =>
      applyAction(state, { type: 'shot/toggle', key: 't1|t6', id: 'VOT-HKY-SBS', on: true, limit: 2 }, 'A'),
    ).toThrow(/2 times/)
  })

  it('a fight’s defender picks their retaliation weapon, kept alongside their toggles', () => {
    let state = applyAction(battle(), { type: 'shot/toggle', key: 'fight|t1|t2', id: 'ploy', on: true }, 'B')
    state = applyAction(state, { type: 'shot/weapon', key: 'fight|t1|t2', weaponId: 'claws' }, 'B')
    expect(state.battle.shots['fight|t1|t2']).toMatchObject({ weapons: { B: 'claws' }, toggles: { B: { ploy: true } } })
  })

  it('only the latest shots are kept, and a new turning point clears them', () => {
    let state = battle()
    for (let index = 0; index < 15; index += 1) {
      state = applyAction(state, { type: 'shot/toggle', key: `t1|x${index}`, id: 'm', on: true }, 'A')
    }
    expect(Object.keys(state.battle.shots)).toHaveLength(12)
    expect(Object.keys(state.battle.shots).at(-1)).toBe('t1|x14')
    state = applyAction(state, { type: 'battle/nextTp', fromTp: 1 }, 'A')
    expect(state.battle.shots).toEqual({})
  })
})
