import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EndTurnSheet } from '../NextTp.jsx'

afterEach(cleanup)

describe('EndTurnSheet', () => {
  it('confirms with one tap from the header', () => {
    const onConfirm = vi.fn()
    render(<EndTurnSheet tp={1} onCancel={() => {}} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ready for TP 2' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('asks for a second tap from the map drawer', () => {
    const onConfirm = vi.fn()
    render(<EndTurnSheet tp={2} double onCancel={() => {}} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ready for TP 3' }))
    expect(onConfirm).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Tap again to confirm' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('says when the opponent is already waiting', () => {
    render(<EndTurnSheet tp={4} waiting="Bob" onCancel={() => {}} onConfirm={() => {}} />)
    expect(screen.getByText('Bob is ready: confirming moves on straight away.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ready to end' })).toBeInTheDocument()
  })
})
