import { useEffect } from 'react'

// The on-screen keyboard opens over the iPad screen instead of moving it. To show a
// focused field, Safari scrolls the page and slides the visible area up, and the play
// screen (fixed to the window) would go with it. So:
// - the page can't scroll (it has nothing to scroll anyway: the screen is fixed);
// - when Safari slides the visible area regardless, the screen moves back by as much.
// ref: the play screen's root element.
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
      element.style.transform = pan ? `translateY(${pan}px)` : ''
    }

    window.addEventListener('scroll', unscroll)
    viewport?.addEventListener('resize', holdStill)
    viewport?.addEventListener('scroll', holdStill)
    return () => {
      html.classList.remove('is-screen-locked')
      window.removeEventListener('scroll', unscroll)
      viewport?.removeEventListener('resize', holdStill)
      viewport?.removeEventListener('scroll', holdStill)
    }
  }, [ref])
}
