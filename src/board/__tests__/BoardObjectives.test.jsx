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

  it('shows Terror on an objective an enemy contests within 3" of a Phobos Reiver', () => {
    const base = createGame()
    const objective = getLayout(base.table.mapId, base.table.arrangementId).objectives[0]
    const game = (reiverX) => ({
      ...base,
      phase: 'battle',
      players: { ...base.players, A: { ...base.players.A, killteamId: 'IMP-PHO' }, B: { ...base.players.B, killteamId: 'TAU-VESP' } },
      tokens: [
        { id: 'r', seat: 'A', unitKey: 'IMP-PHO-RVRWAR-0', x: reiverX, y: objective.y, baseMm: 32 },
        { id: 'v', seat: 'B', unitKey: 'TAU-VESP-WAR-0', x: objective.x + 1, y: objective.y, baseMm: 28.5 },
      ],
    })
    expect(render(<BoardSvg game={game(objective.x + 3)} />).container.querySelector('[data-terror-for="A"]')).not.toBeNull()
    expect(render(<BoardSvg game={game(objective.x + 9)} />).container.querySelector('[data-terror-for="A"]')).toBeNull()
  })
})
