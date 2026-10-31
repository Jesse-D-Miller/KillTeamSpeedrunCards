import { cleanup, render } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useKeyboardOverlay } from '../useKeyboardOverlay.js'

function Screen() {
  const ref = useRef(null)
  useKeyboardOverlay(ref)
  return (
    <div ref={ref} data-testid="screen">
      <div data-testid="list" style={{ overflowY: 'auto' }} />
      <input data-testid="name" />
    </div>
  )
}

// Records the overflow values a scrolling area goes through.
const watchOverflow = (element) => {
  const seen = []
  const style = element.style
  Object.defineProperty(style, 'overflowY', {
    configurable: true,
    get: () => style.getPropertyValue('overflow-y'),
    set: (value) => {
      seen.push(value)
      style.setProperty('overflow-y', value)
    },
  })
  return { seen }
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

  it('rebuilds scrolling areas once the keyboard pan ends, keeping their position', () => {
    const viewport = fakeViewport()
    vi.stubGlobal('visualViewport', viewport)
    const { getByTestId } = render(<Screen />)
    const list = getByTestId('list')
    const { seen } = watchOverflow(list)
    viewport.offsetTop = 180
    viewport.dispatchEvent(new Event('resize'))
    expect(seen).toEqual([])
    list.scrollTop = 120
    viewport.offsetTop = 0
    viewport.dispatchEvent(new Event('resize'))
    expect(seen).toEqual(['hidden', ''])
    expect(list.scrollTop).toBe(120)
  })

  it('rebuilds scrolling areas after a text field loses focus', () => {
    vi.useFakeTimers()
    const { getByTestId } = render(<Screen />)
    const { seen } = watchOverflow(getByTestId('list'))
    const field = getByTestId('name')
    field.focus()
    field.blur()
    expect(seen).toEqual([])
    vi.advanceTimersByTime(400)
    expect(seen).toEqual(['hidden', ''])
    vi.useRealTimers()
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
