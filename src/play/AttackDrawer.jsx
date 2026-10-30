import { useState } from 'react'
import CombatPanel from './CombatPanel.jsx'
import Drawer from './Drawer.jsx'
import ToolIcon from './ToolIcon.jsx'

// The stats drawer on the right edge of an iPad, while one of my operatives is in a
// shot or fight. Each new attack starts with it closed; its handle says which, with a
// dot until it's been opened for that attack.
function AttackDrawer({ attack, seat, toggle, pickWeapon, setWounds }) {
  const [openKey, setOpenKey] = useState(null)
  const [seenKeys, setSeenKeys] = useState(() => new Set())
  if (!attack) return null
  const open = openKey === attack.key
  const fight = attack.mode === 'fight'
  const incoming = attack.target.seat === seat
  const fresh = !seenKeys.has(attack.key)
  const label = `${incoming ? 'Incoming ' : ''}${fight ? 'fight' : 'shot'}`
  return (
    <Drawer
      side="right"
      open={open}
      onToggle={() => {
        setOpenKey(open ? null : attack.key)
        setSeenKeys((keys) => new Set(keys).add(attack.key))
      }}
      handle={
        <span className="attack-handle">
          {fresh && !open ? <span className="attack-handle-dot" aria-hidden="true" /> : null}
          <ToolIcon tool="attack" />
          <span>{fight ? 'Fight' : 'Shot'}</span>
        </span>
      }
      label={open ? `Hide the ${label}` : `Show the ${label}`}
      className="attack-drawer"
    >
      <CombatPanel attack={attack} seat={seat} onToggle={toggle} onPickWeapon={pickWeapon} onWounds={setWounds} />
    </Drawer>
  )
}

export default AttackDrawer
