import './drawer.css'

// A translucent drawer pinned to one edge of the screen. When closed it slides away,
// leaving only its handle visible at that edge.
//   side: 'left' | 'top' | 'bottom'
function Drawer({ side, open, onToggle, handle, label, className = '', children }) {
  return (
    <div className={`drawer is-${side}${open ? ' is-open' : ' is-closed'} ${className}`}>
      <div className="drawer-panel glass" aria-hidden={!open} inert={!open ? '' : undefined}>
        {children}
      </div>
      <button
        type="button"
        className="drawer-handle glass"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={label}
      >
        {handle}
      </button>
    </div>
  )
}

export default Drawer
