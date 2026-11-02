import { describe, expect, it } from 'vitest'
import { tokenRules } from '../tokenRules.js'

const game = (extra = {}) => ({
  players: { A: { killteamId: 'VOT-HKY', tacOpRevealed: false }, B: { killteamId: 'TAU-VESP' } },
  ...extra,
})
const names = (result) => result.rules.map((rule) => rule.name)

describe('token rules', () => {
  it('finds the kill team rules that name a faction token, as it is now', () => {
    const minefield = { id: 'm1', seat: 'A', catalogId: 'vot-hky-minefield', label: 'HY-Pex mine' }
    expect(names(tokenRules(game(), minefield, 'B'))).toEqual(expect.arrayContaining(['Hy-Pex Mine', 'Minefield']))
  })

  it('gives universal equipment its entry', () => {
    const cache = tokenRules(game(), { id: 'm2', seat: 'A', catalogId: 'ammo-cache', label: 'Ammo Cache' }, 'A')
    expect(cache.rules[0].text).toMatch(/Ammo Resupply/i)
  })

  it('gives a crit op token its card, and core tokens a note', () => {
    expect(names(tokenRules(game(), { id: 'm3', catalogId: 'orb', label: 'Orb' }, 'A'))).toContain('MOVE ORB')
    expect(tokenRules(game(), { id: 'm4', catalogId: 'objective', label: 'Objective' }, 'A').rules[0].text).toMatch(/total APL/)
  })

  it('keeps an unrevealed tac op secret from the other player', () => {
    const device = { id: 'm5', seat: 'A', catalogId: 'tacop-device', label: 'Device' }
    expect(tokenRules(game(), device, 'A').title).toMatch(/Plant Devices/)
    expect(tokenRules(game(), device, 'B').rules[0].text).toMatch(/secret/)
  })
})
