import { describe, expect, it } from 'vitest'
import { findPlayerForSyncInit } from '../roomUtils.js'

describe('findPlayerForSyncInit', () => {
  it('prefers a matching playerId', () => {
    const room = {
      players: new Map([
        [
          'player-1',
          { id: 'player-1', name: 'Host', socket: { id: 1 } },
        ],
      ]),
    }

    const player = findPlayerForSyncInit(room, {
      name: 'HOST',
      playerId: 'player-1',
    })

    expect(player?.id).toBe('player-1')
  })

  it('matches name case-insensitively when no id is provided', () => {
    const room = {
      players: new Map([
        [
          'player-2',
          { id: 'player-2', name: 'Guest', socket: { id: 2 } },
        ],
      ]),
    }

    const player = findPlayerForSyncInit(room, {
      name: 'gUeSt',
      playerId: '',
    })

    expect(player?.id).toBe('player-2')
  })
})
