import { describe, expect, it } from 'vitest'
import { persistMultiplayerIdentity } from '../multiplayerStorage.js'

describe('persistMultiplayerIdentity', () => {
  it('stores room code, trimmed name, and player id', () => {
    const store = new Map()
    const storage = {
      setItem: (key, value) => store.set(key, value),
    }

    persistMultiplayerIdentity(storage, {
      code: 'ABC123',
      name: '  Host  ',
      playerId: 'player-1',
    })

    expect(store.get('kt-room-code')).toBe('ABC123')
    expect(store.get('kt-player-name')).toBe('Host')
    expect(store.get('kt-player-id')).toBe('player-1')
  })
})
