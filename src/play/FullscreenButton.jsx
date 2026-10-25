import { useState } from 'react'
import ToolIcon from './ToolIcon.jsx'
import { useFullscreen } from './useFullscreen.js'

// Hides the browser bars where the browser allows it; otherwise explains how to
// install the app to the Home Screen, which always opens without bars.
//   variant: 'header' (small icon button) | 'rail' (map drawer tool button)
function FullscreenButton({ variant = 'header' }) {
  const { supported, active, toggle, standalone } = useFullscreen()
  const [helpOpen, setHelpOpen] = useState(false)
  if (standalone) return null
  const label = active ? 'Exit full screen' : 'Full screen'
  const onClick = async () => {
    if (!supported || !(await toggle())) setHelpOpen(true)
  }
  return (
    <>
      {variant === 'rail' ? (
        <button type="button" className={`rail-tool${active ? ' is-open' : ''}`} onClick={onClick} aria-label={label}>
          <ToolIcon tool={active ? 'exitFullscreen' : 'fullscreen'} />
          <span>{active ? 'Exit full' : 'Full screen'}</span>
        </button>
      ) : (
        <button type="button" className="btn is-small fullscreen-toggle" onClick={onClick} aria-label={label} title={label}>
          {active ? '⤡' : '⤢'}
        </button>
      )}
      {helpOpen ? (
        <div className="sheet-backdrop" onClick={() => setHelpOpen(false)}>
          <div className="sheet" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-head">
              <h3>Full screen</h3>
              <button type="button" className="btn" onClick={() => setHelpOpen(false)}>
                Close
              </button>
            </div>
            <div className="sheet-body">
              <p>This browser doesn't let pages hide its bars (Chrome on iPad can't).</p>
              <p>For a full-screen app with no bars at all:</p>
              <ol>
                <li>
                  Open <strong>{window.location.href}</strong> in Safari
                </li>
                <li>
                  Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>
                </li>
                <li>Open KT Speedrun from the Home Screen</li>
              </ol>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default FullscreenButton
