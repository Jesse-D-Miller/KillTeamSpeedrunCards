import terrainData from '../src/data/terrain.json' with { type: 'json' }
import critOpsData from '../src/data/critOpsCards.json' with { type: 'json' }

// Everything that can be rolled during battle setup.

export const ARRANGEMENT_OPTIONS = (terrainData.arrangements ?? []).map((arrangement) => ({
  mapId: arrangement.mapId,
  arrangementId: arrangement.id,
}))

export const CRIT_OP_IDS = (critOpsData.cards ?? []).map((card) => card.id)

// Random entry from `list`, avoiding entries matching `isCurrent` so a re-roll always changes.
export const pickRandom = (list, isCurrent, random) => {
  const candidates = list.filter((entry) => !isCurrent(entry))
  const pool = candidates.length ? candidates : list
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]
}
