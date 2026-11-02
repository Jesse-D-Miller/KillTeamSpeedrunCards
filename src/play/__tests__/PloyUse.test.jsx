import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const act = vi.fn()
const game = {
  phase: 'battle',
  battle: { tp: 2, lastActivatedByTp: {}, initiativeByTp: { 2: 'A' } },
  tokens: [{ id: 't1', seat: 'A', unitKey: 'ORK-KOM-BOY-0', label: 'Boy', x: 2, y: 2 }],
  players: {
    A: { units: ['ORK-KOM-BOY-0'], cp: 3, unitState: { 'ORK-KOM-BOY-0': { activation: 'ready' } } },
    B: { units: [], unitState: {} },
  },
}
vi.mock('../usePlayer.js', () => ({ usePlayer: () => ({ state: game, seat: 'A', me: game.players.A, act }) }))
const { PloyUse } = await import('../TeamSections.jsx')

afterEach(cleanup)
const krump = { ployId: 'ORK-KOM-T-KE', ployName: "Krump 'Em", CP: 1 }

describe("Krump 'Em! from the team panel", () => {
  it('waits for the end of the Firefight phase', () => {
    render(<PloyUse ploy={krump} />)
    expect(screen.getByRole('button', { name: "Use Krump 'Em" }).disabled).toBe(true)
    expect(screen.getByText('At the end of the Firefight phase')).toBeTruthy()
  })

  it('then picks a Kommando, spends the ploy and asks the map for its free Fight', () => {
    game.players.A.unitState['ORK-KOM-BOY-0'].activation = 'expended'
    const heard = vi.fn()
    window.addEventListener('kt:free-attack', (event) => heard(event.detail))
    render(<PloyUse ploy={krump} />)
    fireEvent.click(screen.getByRole('button', { name: "Use Krump 'Em" }))
    fireEvent.click(screen.getByRole('button', { name: 'Boy' }))
    expect(act).toHaveBeenCalledWith({ type: 'battle/firefightPloy', ployId: 'ORK-KOM-T-KE', cost: 1 })
    expect(heard).toHaveBeenCalledWith({ mode: 'fight', shooterId: 't1', free: 'krump' })
  })
})
