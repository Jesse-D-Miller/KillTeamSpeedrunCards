import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const player = { killteamId: 'VOT-HKY', ploysByTp: { 1: ['VOT-HKY-S-TS'] }, unitState: { 'VOT-HKY-WAR-0': { wounds: 8 } } }
vi.mock('../usePlayer.js', () => ({ usePlayer: () => ({ state: { battle: { tp: 1 }, players: { A: player } } }) }))
const { WoundControls } = await import('../CombatPanel.jsx')

afterEach(cleanup)

const operative = { name: 'Warrior', wounds: 8, maxWounds: 8, token: { seat: 'A', unitKey: 'VOT-HKY-WAR-0' } }

describe('stats drawer wound controls', () => {
  it('offers Tough Survivalists halved hits for a Yaegir yet to take damage this turning point', () => {
    const onWounds = vi.fn()
    render(<WoundControls operative={operative} incoming={{ normal: 3, crit: 5 }} onWounds={onWounds} />)
    expect(screen.getByRole('button', { name: 'Take 2 damage (normal hit, halved from 3)' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Take 3 damage (critical hit, halved from 5)' }))
    expect(onWounds).toHaveBeenCalledWith(operative, 5, 'crit')
  })

  it('stops offering them once it has taken damage this turning point', () => {
    player.unitState['VOT-HKY-WAR-0'].damagedTp = 1
    render(<WoundControls operative={operative} incoming={{ normal: 3, crit: 5 }} onWounds={vi.fn()} />)
    expect(screen.queryByRole('group', { name: 'Tough Survivalists' })).toBeNull()
  })
})
