import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import WeaponChooser from '../WeaponChooser.jsx'

afterEach(cleanup)

const knife = { id: 'k', name: 'Throwing plasma knife', profile: '', atk: 4, hit: 3, dmg: { normal: 3, crit: 5 }, rules: { limited: 1, range: 6, special: [] }, wr: '' }
const blades = { id: 'b', name: 'Dual plasma knives', profile: '', atk: 4, hit: 3, dmg: { normal: 3, crit: 5 }, rules: { special: [] }, wr: '' }

describe('weapon chooser', () => {
  it('shows uses left for Limited weapons and blocks one that is used up', () => {
    const usesLeft = (weapon) => (weapon.rules.limited ? 0 : null)
    render(<WeaponChooser mode="shoot" operativeName="Bladekyn" weapons={[knife, blades]} selectedId={null} onChoose={() => {}} onClose={() => {}} usesLeft={usesLeft} />)
    expect(screen.getByText('Used up this battle')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Throwing plasma knife/ }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: /Dual plasma knives/ }).disabled).toBe(false)
  })

  it('lets the current choice stay picked, with its uses shown', () => {
    render(<WeaponChooser mode="shoot" operativeName="Bladekyn" weapons={[knife]} selectedId="k" onChoose={() => {}} onClose={() => {}} usesLeft={() => 1} />)
    expect(screen.getByText('1 use left this battle')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Throwing plasma knife/ }).disabled).toBe(false)
  })
})
