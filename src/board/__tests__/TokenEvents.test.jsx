import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import TokenEvents from '../TokenEvents.jsx'

const play = (kind) =>
  render(
    <svg>
      <TokenEvents tokenId="t1" color="#4aa3ff" effects={[{ kind, key: `t1-${kind}`, x: 2, cy: 3, r: 0.63 }]} />
    </svg>,
  ).container

describe('token events', () => {
  it('draws each event beside the operative it happened to', () => {
    expect(play('injured').querySelector('[data-event="injured"] .token-event-drop')).not.toBeNull()
    expect(play('shatter').querySelectorAll('[data-event="shatter"] .token-event-shard')).toHaveLength(6)
    expect(play('engage').querySelector('[data-event="engage"] .token-event-order-ring')).not.toBeNull()
    expect(play('counteract').querySelector('[data-event="counteract"] .token-event-bolt')).not.toBeNull()
    expect(play('counteract').querySelector('[data-event]').getAttribute('transform')).toBe('translate(2 3)')
  })

  it('draws nothing when nothing happened', () => {
    expect(play('unknown').querySelector('[data-event]')).toBeNull()
  })
})
