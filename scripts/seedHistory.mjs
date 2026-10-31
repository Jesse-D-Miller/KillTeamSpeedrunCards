// Writes 100 made-up games for trying out the stats page, in the same shape the table
// server saves (see server/history.js). Ten players, each with a favourite kill team
// and a second choice, and a skill that tilts their results.
//
//   npm run seed:stats             writes server/data/history.sample.json
//   npm run dev:stats-sample       runs the app with the stats page reading it
//
// It never touches the real history.json. A fixed seed gives the same games every run.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const OUT = resolve(process.argv[2] ?? 'server/data/history.sample.json')
const GAMES = 100

let seed = 2026
const random = () => {
  seed = (seed * 9301 + 49297) % 233280
  return seed / 233280
}
const pick = (list) => list[Math.floor(random() * list.length)]
const between = (low, high) => low + random() * (high - low)

// skill: how often they turn an op into VP. activity: how often they're at the table.
const PLAYERS = [
  { name: 'Jesse', main: 'VOT-HKY', second: 'ORK-KOM', skill: 0.72, activity: 1.6 },
  { name: 'Sam', main: 'TAU-VESP', second: 'TAU-PF', skill: 0.6, activity: 1.4 },
  { name: 'Alex', main: 'IMP-AOD', second: 'IMP-SCT', skill: 0.66, activity: 1.1 },
  { name: 'Morgan', main: 'CHAOS-LEG', second: 'CHAOS-NC', skill: 0.55, activity: 1.2 },
  { name: 'Riley', main: 'AEL-HOTA', second: 'AEL-COR', skill: 0.7, activity: 0.8 },
  { name: 'Casey', main: 'NEC-HIER', second: 'NEC-CAN', skill: 0.48, activity: 1 },
  { name: 'Jordan', main: 'TYR-RAV', second: 'TYR-WB', skill: 0.52, activity: 0.9 },
  { name: 'Taylor', main: 'IMP-KAS', second: 'IMP-DKK', skill: 0.44, activity: 0.7 },
  { name: 'Quinn', main: 'ORK-WK', second: 'ORK-KOM', skill: 0.58, activity: 0.6 },
  { name: 'Drew', main: 'SPEC-NPO', second: 'CHAOS-CULT', skill: 0.4, activity: 0.5 },
]
const OTHER_TEAMS = ['IMP-BC', 'AEL-BOK', 'CHAOS-BLD', 'IMP-DW', 'VOT-HKS', 'IMP-NOV', 'IMP-PHO', 'IMP-SANC', 'TAU-XV26']
const TAC_OPS = ['plant-devices', 'steal-intelligence', 'track-enemy', 'flank', 'retrieval', 'scout-enemy-movement', 'plant-banner', 'martyrs', 'envoy', 'rout', 'sweep-and-clear']
const CATEGORIES = ['critOp', 'killOp', 'tacOp']

const weightedPlayer = (except) => {
  const pool = PLAYERS.filter((player) => player !== except)
  let roll = random() * pool.reduce((sum, player) => sum + player.activity, 0)
  return pool.find((player) => (roll -= player.activity) < 0) ?? pool[pool.length - 1]
}

// Mostly their favourite, sometimes their second team, now and then something new.
const teamFor = (player) => {
  const roll = random()
  if (roll < 0.62) return player.main
  if (roll < 0.87) return player.second
  return pick(OTHER_TEAMS)
}

// Each op is scored over the game's turning points: up to 6 VP, more often for the
// stronger player.
const opScore = (edge) => {
  let vp = 0
  for (let chance = 0; chance < 6; chance += 1) if (random() < edge) vp += 1
  return vp
}

const side = (player, opponent) => {
  const edge = Math.min(0.9, Math.max(0.1, 0.45 + (player.skill - opponent.skill) * 0.45 + between(-0.18, 0.18)))
  const score = Object.fromEntries(CATEGORIES.map((category) => [category, opScore(edge)]))
  const primaryOp = pick(CATEGORIES)
  const primaryBonus = Math.ceil(score[primaryOp] / 2)
  return {
    name: player.name,
    killteamId: teamFor(player),
    vp: score.critOp + score.killOp + score.tacOp + primaryBonus,
    score,
    primaryOp,
    primaryBonus,
    tacOp: pick(TAC_OPS),
    // Kill op VP follow kills, so kills track it with some noise.
    kills: Math.max(0, Math.round(score.killOp * 1.2 + between(-1, 2))),
    lost: 0,
  }
}

// About four games a week over the last six months, in the evening.
const now = Date.UTC(2026, 9, 31, 22)
const games = Array.from({ length: GAMES }, (_, index) => {
  const a = weightedPlayer()
  const b = weightedPlayer(a)
  const A = side(a, b)
  const B = side(b, a)
  A.lost = B.kills
  B.lost = A.kills
  const durationMs = Math.round(between(62, 155) * 60000)
  const battleMs = durationMs - Math.round(between(9, 22) * 60000)
  const endedAt = now - (GAMES - index) * between(1.4, 2.2) * 86400000
  return {
    id: String(Math.round(endedAt - battleMs)),
    endedAt: new Date(endedAt).toISOString(),
    durationMs,
    battleMs,
    mapId: pick(['map_01', 'map_02']),
    winner: A.vp === B.vp ? null : A.vp > B.vp ? 'A' : 'B',
    players: { A, B },
  }
})

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, `${JSON.stringify(games, null, 2)}\n`)
console.log(`Wrote ${games.length} sample games to ${OUT}`)
