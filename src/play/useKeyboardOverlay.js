import { useEffect } from 'react'

// The on-screen keyboard opens over the iPad screen instead of moving it. To show a
// focused field, Safari scrolls the page and slides the visible area up, and the play
// screen (fixed to the window) would go with it. So:
// - the page can't scroll (it has nothing to scroll anyway: the screen is fixed);
// - when Safari slides the visible area regardless, the screen moves back by as much.
// - once the keyboard closes, scrolling areas are rebuilt: Safari sometimes leaves one
//   that sat under the keyboard (or inside the moved screen) unable to scroll until the
//   page is reloaded.
// ref: the play screen's root element.

const isEditable = (element) =>
  element instanceof HTMLElement && (element.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName))

// Turning a scrolling area's overflow off and back on makes Safari rebuild it, keeping
// where it was scrolled to.
export const refreshScrollers = (root) => {
  if (!root) return
  const scrollers = [root, ...root.querySelectorAll('*')].filter((element) => {
    const { overflowY } = window.getComputedStyle(element)
    return overflowY === 'auto' || overflowY === 'scroll'
  })
  scrollers.forEach((element) => {
    const top = element.scrollTop
    element.style.overflowY = 'hidden'
    void element.offsetHeight
    element.style.overflowY = ''
    element.scrollTop = top
  })
}

export const useKeyboardOverlay = (ref) => {
  useEffect(() => {
    const html = document.documentElement
    html.classList.add('is-screen-locked')
    const viewport = window.visualViewport

    const unscroll = () => {
      if (window.scrollX || window.scrollY) window.scrollTo(0, 0)
    }
    const holdStill = () => {
      const element = ref.current
      if (!element) return
      // Zoomed in with a pinch: that pan is the player's own, leave it alone.
      const pan = viewport && Math.abs(viewport.scale - 1) < 0.01 ? Math.round(viewport.offsetTop) : 0
      const wasMoved = Boolean(element.style.transform)
      element.style.transform = pan ? `translateY(${pan}px)` : ''
      if (wasMoved && !pan) refreshScrollers(element)
    }
    // A text field losing focus is the keyboard closing (Safari doesn't always pan).
    let refreshTimer = null
    const keyboardClosed = (event) => {
      if (!isEditable(event.target)) return
      window.clearTimeout(refreshTimer)
      // After Safari has finished sliding the keyboard away.
      refreshTimer = window.setTimeout(() => {
        if (!isEditable(document.activeElement)) refreshScrollers(ref.current)
      }, 350)
    }

    window.addEventListener('scroll', unscroll)
    viewport?.addEventListener('resize', holdStill)
    viewport?.addEventListener('scroll', holdStill)
    document.addEventListener('focusout', keyboardClosed)
    return () => {
      window.clearTimeout(refreshTimer)
      document.removeEventListener('focusout', keyboardClosed)
      html.classList.remove('is-screen-locked')
      window.removeEventListener('scroll', unscroll)
      viewport?.removeEventListener('resize', holdStill)
      viewport?.removeEventListener('scroll', holdStill)
    }
  }, [ref])
}
