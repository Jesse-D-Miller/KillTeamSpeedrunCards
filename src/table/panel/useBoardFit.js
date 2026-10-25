import { useLayoutEffect, useRef } from 'react'

// Shrinks a player board's text until nothing overflows its box.
//  --fit on the board scales every size; the crit op body has its own --crit-fit
//  on top, so one long mission doesn't shrink the whole board.
const overflows = (elements) => elements.some((el) => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)

const fitVariable = (target, name, elements) => {
  target.style.setProperty(name, '1')
  if (!overflows(elements)) return
  let lo = 0.45
  let hi = 1
  for (let step = 0; step < 8; step += 1) {
    const mid = (lo + hi) / 2
    target.style.setProperty(name, String(mid))
    if (overflows(elements)) hi = mid
    else lo = mid
  }
  target.style.setProperty(name, String(lo))
}

export const useBoardFit = () => {
  const ref = useRef(null)

  useLayoutEffect(() => {
    const board = ref.current
    if (!board) return undefined
    const fit = () => {
      const sections = [...board.querySelectorAll('.pb-section:not(.pb-critop), .pb-tacop')]
      fitVariable(board, '--fit', sections)
      const critBody = board.querySelector('.pb-critop-body')
      if (critBody) fitVariable(board, '--crit-fit', [critBody])
    }
    fit()
    // Web fonts change text metrics once they arrive.
    document.fonts?.ready?.then(fit)
    const observer = new ResizeObserver(fit)
    observer.observe(board)
    return () => observer.disconnect()
  })

  return ref
}
