import { describe, expect, it } from 'vitest'
import ktData from '../kt24_v4.json'
import factionTokens from '../factionTokens.json'
import { categoriesFor } from '../tokenCatalog.js'

const gameWith = ({ critOpId = 'crit_ops_01', killteamId = 'TAU-PF', equipment = [] } = {}) => ({
  table: { critOpId },
  players: { A: { killteamId, equipment } },
})

describe('token catalogue', () => {
  it('has a faction list for every kill team, with clean, unique names', () => {
    expect(Object.keys(factionTokens).sort()).toEqual(ktData.map((team) => team.killteamId).sort())
    Object.values(factionTokens).forEach((tokens) => {
      const names = tokens.map((token) => token.name)
      expect(new Set(names).size).toBe(names.length)
      names.forEach((name) => expect(name).not.toMatch(/^(The|A|That|Your|Ammo Cache|Mines?)\b/))
      tokens.forEach((token) => {
        expect(['marker', 'token']).toContain(token.kind)
        expect(token.short.length).toBeLessThanOrEqual(4)
      })
    })
  })

  it('shows the faction by name, and mission tokens for the rolled crit op only', () => {
    const categories = categoriesFor(gameWith({ critOpId: 'crit_ops_04' }), 'A')
    expect(categories.map((category) => category.id)).toEqual(['mission', 'equipment', 'faction', 'operative', 'general'])
    expect(categories[2].name).toBe('Pathfinders')
    expect(categories[2].entries.map((entry) => entry.name)).toContain('Markerlight')
    const mission = categories[0].entries.map((entry) => entry.name)
    expect(mission).toContain('Orb')
    expect(mission).not.toContain('Secured')
  })

  it('adds your tac op’s tokens once you have picked one', () => {
    const game = gameWith()
    game.players.A.tacOp = { id: 'dominate', label: 'Dominate' }
    const tacop = categoriesFor(game, 'A').find((category) => category.id === 'tacop')
    expect(tacop.name).toBe('Tac op · Dominate')
    expect(tacop.entries).toEqual([expect.objectContaining({ name: 'Dominate', kind: 'token' })])
  })

  it('lists equipment the player took first', () => {
    const [, equipment] = categoriesFor(gameWith({ equipment: ['UNIVERSAL-UE-LAD'] }), 'A')
    expect(equipment.entries[0]).toMatchObject({ name: 'Ladder', chosen: true })
  })
})
