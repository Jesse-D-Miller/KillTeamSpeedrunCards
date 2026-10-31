import { useLayoutEffect, useRef } from 'react'

// Shrinks a player board's text until nothing overflows its box.
//  --fit on the board scales every size; the crit op body has its own --crit-fit
//  on top, so one long mission doesn't shrink the whole board.
// Scroll sizes miss content that spills into a flex column's bottom padding (Chrome
// doesn't count that padding), so the last child is also checked against the padding
// edge. Offsets are layout values, unaffected by the board's rotation; they're whole
// pixels, hence the 2px tolerance.
const spillsIntoPadding = (el) => {
  const last = el.lastElementChild
  if (!last || last.offsetParent !== el.offsetParent) return false
  const style = getComputedStyle(el)
  const limit = el.offsetTop + el.offsetHeight - Number.parseFloat(style.borderBottomWidth) - Number.parseFloat(style.paddingBottom)
  return last.offsetTop + last.offsetHeight > limit + 2
}

export const overflows = (elements) =>
  elements.some(
    (el) => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1 || spillsIntoPadding(el),
  )

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
      // On the arranged battle board each piece is a fixed box too (the crit op has its own fit).
      const sections = [...board.querySelectorAll('.pb-section:not(.pb-critop), .pb-tacop, .pb-piece:not([data-piece="critop"])')]
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
