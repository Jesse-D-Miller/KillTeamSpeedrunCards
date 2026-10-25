import { useCallback, useEffect, useState } from 'react'

// Full screen hides the browser's bars. Safari on iPad allows it; Chrome on iPad
// doesn't let pages go full screen, so callers fall back to Add to Home Screen help.
const fullscreenElement = () => document.fullscreenElement ?? document.webkitFullscreenElement ?? null

// Opened from the Home Screen: there are no browser bars to hide. (Element full
// screen also matches display-mode: fullscreen, so this is only checked on load.)
const isStandalone = () =>
  !fullscreenElement() &&
  (window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    window.navigator.standalone === true)

export const useFullscreen = () => {
  const [active, setActive] = useState(() => Boolean(fullscreenElement()))
  const [standalone] = useState(isStandalone)
  const supported = Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled)

  useEffect(() => {
    const onChange = () => setActive(Boolean(fullscreenElement()))
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
    }
  }, [])

  // Resolves true when the change happened; false when the browser refused
  // (some report support but silently ignore the request).
  const toggle = useCallback(async () => {
    const root = document.documentElement
    if (fullscreenElement()) {
      await Promise.resolve((document.exitFullscreen ?? document.webkitExitFullscreen)?.call(document)).catch(() => {})
      return true
    }
    const request = root.requestFullscreen ?? root.webkitRequestFullscreen
    const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms))
    try {
      // Some browsers never settle the request when they refuse it.
      await Promise.race([request?.call(root), wait(800)])
    } catch {
      return false
    }
    // Check straight away; only wait a moment longer if it hasn't happened yet.
    if (fullscreenElement()) return true
    await wait(200)
    return Boolean(fullscreenElement())
  }, [])

  return { supported, active, toggle, standalone }
}
