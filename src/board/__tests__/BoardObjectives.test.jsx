import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createGame } from '../../../shared/game.js'
import { getLayout } from '../boardData.js'
import BoardSvg from '../BoardSvg.jsx'

describe('board objectives', () => {
  it('tags the objective a Breacher locked down (Lock It Down) while that operative lives', () => {
    const base = createGame()
    const objective = getLayout(base.table.mapId, base.table.arrangementId).objectives[0]
    const game = (dead) => ({
      ...base,
      players: {
        ...base.players,
        A: { ...base.players.A, lockItDown: { unitKey: 'IMP-INB-ARM-0', objectiveId: objective.id }, unitState: { 'IMP-INB-ARM-0': { dead } } },
      },
    })
    expect(render(<BoardSvg game={game(false)} />).container.querySelector('[data-lock-for="A"]').textContent).toBe('+1 APL')
    expect(render(<BoardSvg game={game(true)} />).container.querySelector('[data-lock-for="A"]')).toBeNull()
  })
})
