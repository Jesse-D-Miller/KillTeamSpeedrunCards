import { cleanup, render } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useKeyboardOverlay } from '../useKeyboardOverlay.js'

function Screen() {
  const ref = useRef(null)
  useKeyboardOverlay(ref)
  return <div ref={ref} data-testid="screen" />
}

// Safari's visual viewport: it shrinks and pans up when the keyboard opens.
const fakeViewport = () => Object.assign(new EventTarget(), { offsetTop: 0, scale: 1 })

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('useKeyboardOverlay', () => {
  it('locks the page while the play screen is up', () => {
    const { unmount } = render(<Screen />)
    expect(document.documentElement).toHaveClass('is-screen-locked')
    unmount()
    expect(document.documentElement).not.toHaveClass('is-screen-locked')
  })

  it('holds the screen still when the keyboard pans the view', () => {
    const viewport = fakeViewport()
    vi.stubGlobal('visualViewport', viewport)
    const { getByTestId } = render(<Screen />)
    viewport.offsetTop = 180
    viewport.dispatchEvent(new Event('resize'))
    expect(getByTestId('screen').style.transform).toBe('translateY(180px)')
    viewport.offsetTop = 0
    viewport.dispatchEvent(new Event('scroll'))
    expect(getByTestId('screen').style.transform).toBe('')
  })

  it('leaves a pinch-zoom pan alone', () => {
    const viewport = fakeViewport()
    vi.stubGlobal('visualViewport', viewport)
    const { getByTestId } = render(<Screen />)
    Object.assign(viewport, { offsetTop: 300, scale: 2 })
    viewport.dispatchEvent(new Event('scroll'))
    expect(getByTestId('screen').style.transform).toBe('')
  })
})
