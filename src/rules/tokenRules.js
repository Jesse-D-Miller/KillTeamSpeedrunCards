import { getKillteamById, getKillteams } from '../data/ktData.js'
import { getCritOp } from '../board/boardData.js'
import { catalogSource } from '../data/tokenCatalog.js'
import { TAC_OPS } from '../data/tacOps.js'

// What a marker or token on the board does, for the Rules button on its action ring:
// its universal equipment entry, the rules of its kill team that mention it, its crit
// op or tac op card, or a short note for the core rules' own tokens.
//   -> { title, rules: [{ name, ap?, text }] }

// The core rules' tokens and markers (Kill Team 2024 core rules, as summarised in
// docs/kill-team-rules.md).
const CORE_NOTES = {
  objective:
    'Objective marker (40mm). Operatives contest it while it’s within their control range; whoever has the higher total APL contesting it controls it. Pick Up Marker can’t take it unless a crit op says so.',
  'pick-up':
    'A marker an operative can carry. Pick Up Marker (1AP): take a marker you control; you now carry, contest and control it (not within enemy control range, or while already carrying one). Place Marker (1AP): put it down within control range (not in the same activation as Pick Up, except when incapacitated, when it’s free).',
  'apl-minus': 'APL −1 until its condition ends (e.g. Stunned: until the end of its next activation). An operative’s APL can only change by 1 either way.',
  'apl-plus': 'APL +1 until its condition ends. An operative’s APL can only change by 1 either way.',
  guard:
    'Close quarters killzones (Gallowdark, Tomb World): an operative on guard can, once per enemy activation, interrupt after an enemy action to Fight or Shoot for free (Hit −1 point-blank). It then can’t counteract that turning point.',
  marker: 'A plain marker for anything the rules ask you to mark.',
  counter: 'A counter for anything the rules ask you to count.',
  'blank-base': 'A stand-in base.',
}

const plain = (text) => String(text ?? '').replace(/\*\*([^*]+)\*\*/g, '$1').trim()
const mentions = (text, names) => names.some((name) => String(text ?? '').toLowerCase().includes(name))

// Rules of a kill team that name the token: abilities (once each), ploys, equipment.
const teamRulesFor = (killteam, names) => {
  const seen = new Set()
  const abilities = (killteam?.opTypes ?? [])
    .flatMap((opType) => opType.abilities ?? [])
    .filter((ability) => mentions(ability.abilityName, names) || mentions(ability.description, names))
    .filter((ability) => !seen.has(ability.abilityName) && seen.add(ability.abilityName))
    .map((ability) => ({ name: ability.abilityName, ap: ability.AP ?? null, text: plain(ability.description) }))
  const ploys = (killteam?.ploys ?? [])
    .filter((ploy) => mentions(ploy.ployName, names) || mentions(ploy.description, names))
    .map((ploy) => ({ name: `${ploy.ployName} (${ploy.ployType === 'S' ? 'strategy' : 'firefight'} ploy)`, text: plain(ploy.description) }))
  const equipment = (killteam?.equipments ?? [])
    .filter((item) => item.killteamId && (mentions(item.eqName, names) || mentions(item.description, names)))
    .map((item) => ({ name: `${item.eqName} (equipment)`, text: plain(item.description) }))
  return [...abilities, ...ploys, ...equipment]
}

const critOpRules = (critOpId) => {
  const card = getCritOp(critOpId)
  if (!card) return []
  return [
    ...(card.missionActions ?? []).map((action) => ({ name: action.subtitle, ap: Number.parseInt(action.cost, 10) || null, text: action.bullets.map((bullet) => bullet.text).join('\n') })),
    card.additionalRules?.text ? { name: 'Additional rules', text: card.additionalRules.text } : null,
    card.victoryPoints?.text ? { name: 'Victory points', text: card.victoryPoints.text } : null,
  ].filter(Boolean)
}

const tacOpRules = (tacOp) => [
  ...tacOp.rules.map((text, index) => ({ name: index ? '' : 'Rules', text })),
  tacOp.action ? { name: tacOp.action.name, ap: tacOp.action.ap, text: `${tacOp.action.effect}\n${tacOp.action.conditions}` } : null,
  ...tacOp.vp.map((text) => ({ name: 'Victory points', text })),
].filter(Boolean)

// viewer: the seat asking. A tac op stays secret from the other player until revealed.
export const tokenRules = (game, marker, viewer) => {
  const catalogId = String(marker.catalogId ?? '')
  const owner = game.players?.[marker.seat]
  const title = marker.label || catalogSource(catalogId)?.entry.name || 'Marker'
  if (catalogId.startsWith('tacop-')) {
    const tacOp = TAC_OPS.find((candidate) => candidate.tokens.some((entry) => `tacop-${entry.id}` === catalogId))
    if (!tacOp) return { title, rules: [] }
    const secret = marker.seat && marker.seat !== viewer && !owner?.tacOpRevealed
    return secret
      ? { title, rules: [{ name: 'Tac op', text: 'A token for your opponent’s tac op, which is still secret.' }] }
      : { title: `${title} · ${tacOp.name}`, rules: tacOpRules(tacOp) }
  }
  const found = catalogSource(catalogId)
  if (!found) return { title, rules: [] }
  const { entry, source } = found
  if (source === 'equipment') {
    const teams = [owner?.killteamId, ...Object.values(game.players ?? {}).map((player) => player.killteamId)]
      .filter(Boolean)
      .map(getKillteamById)
    // (Every team carries the universal entries; any team will do if the players' don't.)
    const anyTeam = () => getKillteams().map((summary) => getKillteamById(summary.killteamId))
    const lookIn = (list) => list.flatMap((killteam) => killteam?.equipments ?? []).find((candidate) => entry.eqIds?.includes(candidate.eqId))
    const item = lookIn(teams) ?? lookIn(anyTeam())
    return { title, rules: item ? [{ name: item.eqName, text: plain(item.description) }] : [] }
  }
  if (source === 'critOp') return { title, rules: critOpRules(found.critOpId) }
  if (source === 'faction') {
    // Its name, and what it's become (a flipped Minefield marker is a HY-Pex mine).
    const names = [...new Set([entry.name, marker.label].filter(Boolean).map((name) => name.toLowerCase()))]
    return { title, rules: teamRulesFor(getKillteamById(found.killteamId), names) }
  }
  return { title, rules: CORE_NOTES[entry.id] ? [{ name: entry.name, text: CORE_NOTES[entry.id] }] : [] }
}
