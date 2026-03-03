import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import OpponentPanel from '../OpponentPanel.jsx'

afterEach(() => {
  cleanup()
})

vi.mock('../UnitCard.jsx', () => ({
  default: ({ opType, currentWounds }) => (
    <div
      data-testid="opponent-unit-card"
      data-unit={opType?.opTypeName || 'unknown'}
      data-wounds={String(currentWounds)}
    />
  ),
}))

const baseProps = {
  isOpen: true,
  onClose: () => {},
  onRefresh: () => {},
  wsReady: true,
  opponentRefreshAt: null,
  opponentRenderState: {
    name: 'Guest',
    selectedUnits: [],
    deadUnits: {},
    woundsByUnit: {},
    aplAdjustByUnit: {},
    legionaryMarkByUnit: {},
    unitStates: {},
    stanceByUnit: {},
    statusesByUnit: {},
  },
  opponentKillteam: { killteamName: 'Kommandos' },
  opponentAllUnits: [],
  debugInfo: {},
  roomCode: 'ABC123',
  playerId: 'player-1',
}

describe('OpponentPanel', () => {
  it('renders only opponent selected units when selected set is present', () => {
    const opponentAllUnits = [
      {
        key: 'ORK-KOM-NOB-1',
        opType: { opTypeName: 'Kommando Boss Nob', WOUNDS: '14', keywords: '' },
        instance: 1,
        instanceCount: 1,
      },
      {
        key: 'ORK-KOM-BOY-1',
        opType: { opTypeName: 'Kommando Boy', WOUNDS: '10', keywords: '' },
        instance: 1,
        instanceCount: 1,
      },
    ]

    render(
      <OpponentPanel
        {...baseProps}
        opponentAllUnits={opponentAllUnits}
        opponentRenderState={{
          ...baseProps.opponentRenderState,
          selectedUnits: ['ORK-KOM-BOY-1'],
        }}
      />,
    )

    const cards = screen.getAllByTestId('opponent-unit-card')
    expect(cards).toHaveLength(1)
    expect(cards[0]).toHaveAttribute('data-unit', 'Kommando Boy')
  })

  it('forces displayed wounds to 0 for dead-marked units', () => {
    const opponentAllUnits = [
      {
        key: 'ORK-KOM-NOB-1',
        opType: { opTypeName: 'Kommando Boss Nob', WOUNDS: '14', keywords: '' },
        instance: 1,
        instanceCount: 1,
      },
    ]

    render(
      <OpponentPanel
        {...baseProps}
        opponentAllUnits={opponentAllUnits}
        opponentRenderState={{
          ...baseProps.opponentRenderState,
          selectedUnits: ['ORK-KOM-NOB-1'],
          woundsByUnit: { 'ORK-KOM-NOB-1': 8 },
          deadUnits: { 'ORK-KOM-NOB-1': true },
        }}
      />,
    )

    const card = screen.getByTestId('opponent-unit-card')
    expect(card).toHaveAttribute('data-wounds', '0')
  })
})
