import { useState, useSyncExternalStore } from 'react'
import { createUnitState } from '../../shared/game.js'
import { maxWoundsFor } from '../rules/roster.js'

// Unit cards sit two to a row (one on a narrow screen, see .unit-grid). Opening a card's
// details opens its whole row, and it's the row that stays open: when an operative is
// expended or killed it drops down the list, closing, and the card that takes its place
// opens beside the other.

const NARROW = '(max-width: 720px)'
const subscribe = (onChange) => {
  const query = window.matchMedia?.(NARROW)
  query?.addEventListener?.('change', onChange)
  return () => query?.removeEventListener?.('change', onChange)
}
const columns = () => (window.matchMedia?.(NARROW).matches ? 1 : 2)

// resetKey: when it changes (a new turning point) every row closes.
export const useRowDetails = (resetKey) => {
  const perRow = useSyncExternalStore(subscribe, columns, () => 2)
  const [open, setOpen] = useState(() => new Set())
  const [lastKey, setLastKey] = useState(resetKey)
  if (lastKey !== resetKey) {
    setLastKey(resetKey)
    setOpen(new Set())
  }
  const rowOf = (index) => Math.floor(index / perRow)
  return {
    isOpen: (index) => open.has(rowOf(index)),
    toggle: (index) =>
      setOpen((current) => {
        const next = new Set(current)
        const row = rowOf(index)
        if (next.has(row)) next.delete(row)
        else next.add(row)
        return next
      }),
  }
}

// Ready operatives first, then expended, then dead; otherwise in roster order.
const rank = (unitState) => (unitState.dead ? 2 : unitState.activation === 'expended' ? 1 : 0)
export const byStatus = (roster, unitStates) => {
  const stateOf = (unit) => ({ ...createUnitState(maxWoundsFor(unit.opType)), ...unitStates?.[unit.key] })
  return [...roster].sort((a, b) => rank(stateOf(a)) - rank(stateOf(b)) || a.index - b.index)
}
