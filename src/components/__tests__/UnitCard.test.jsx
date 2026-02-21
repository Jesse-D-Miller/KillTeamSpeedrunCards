import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import UnitCard from '../UnitCard.jsx'

describe('UnitCard readOnly', () => {
  it('hides interactive status controls', () => {
    const opType = {
      opTypeName: 'Test Operative',
      WOUNDS: '10',
      MOVE: '6\"',
      APL: '2',
      SAVE: '3+',
      weapons: [],
      abilities: [],
    }

    render(
      <UnitCard
        opType={opType}
        currentWounds={10}
        detailsOpen
        state="ready"
        stance="conceal"
        selectedStatuses={[]}
        readOnly
      />,
    )

    expect(screen.queryByLabelText('Add status effect')).toBeNull()
    const stancePill = screen.getByText('conceal')
    expect(stancePill.tagName.toLowerCase()).toBe('span')
  })
})
