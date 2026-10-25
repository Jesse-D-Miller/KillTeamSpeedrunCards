// Approved Ops 2025 tac ops (card pack v3, August 2026), three per archetype.
// Each player secretly picks one from their kill team's archetypes; it stays hidden
// until its reveal condition. See docs/kill-team-rules.md for sources and errata.
//   { id, archetype, name, reveal, rules: [text], action?: { name, ap, effect, conditions },
//     vp: [text], cap: text, tokens: [{ id, name, short, kind }] }

const NO_TP1_OR_ENGAGED = 'Not during the first turning point, or while within control range of an enemy operative.'

export const ARCHETYPES = ['Infiltration', 'Recon', 'Security', 'Seek & Destroy']

export const TAC_OPS = [
  // ---- Infiltration ----
  {
    id: 'plant-devices',
    archetype: 'Infiltration',
    name: 'Plant Devices',
    reveal: 'The first time a friendly operative performs the Plant Device action.',
    rules: [],
    action: {
      name: 'Plant Device',
      ap: 1,
      effect: 'One objective marker the active operative controls gains one of your Device tokens.',
      conditions: 'Not during the first turning point, while within control range of an enemy operative, or if that objective marker already has one of your Device tokens.',
    },
    vp: [
      'At the end of each turning point after the first: if your opponent’s objective marker has one of your Device tokens, 1VP; for each other objective marker enemy operatives contest that has one of your Device tokens, 1VP.',
    ],
    cap: 'Max 2VP per turning point.',
    tokens: [{ id: 'device', name: 'Device', short: 'DEV', kind: 'marker' }],
  },
  {
    id: 'steal-intelligence',
    archetype: 'Infiltration',
    name: 'Steal Intelligence',
    reveal: 'The first time an enemy operative is incapacitated.',
    rules: [
      'Whenever an enemy operative is incapacitated, before it’s removed, place one of your Intelligence mission markers within its control range.',
      'Friendly operatives can Pick Up your Intelligence markers, and can carry up to two of them (or one and one other marker).',
    ],
    vp: [
      'At the end of each turning point after the first, if any friendly operatives are carrying your Intelligence markers, 1VP.',
      'At the end of the battle, 1VP for each of your Intelligence markers friendly operatives are carrying.',
    ],
    tokens: [{ id: 'intelligence', name: 'Intelligence', short: 'INTL', kind: 'marker' }],
  },
  {
    id: 'track-enemy',
    archetype: 'Infiltration',
    name: 'Track Enemy',
    reveal: 'The first time you score VP from this op.',
    rules: [
      'An enemy operative is being tracked if it’s a valid target for a friendly operative within 6" of it. That friendly operative must have a Conceal order, cannot be a valid target for that enemy, and cannot be within control range of enemy operatives.',
    ],
    vp: [
      'At the end of each turning point after the first: one enemy tracked, 1VP (2VP in the fourth turning point); two or more tracked, 2VP.',
    ],
    cap: 'Max 2VP per turning point.',
    tokens: [{ id: 'tracked', name: 'Tracked', short: 'TRK', kind: 'token' }],
  },
  // ---- Recon ----
  {
    id: 'flank',
    archetype: 'Recon',
    name: 'Flank',
    reveal: 'As a STRATEGIC GAMBIT.',
    rules: [
      'Divide the killzone into left and right flanks with a line like the centreline that runs from the centre of each player’s killzone edge.',
      'An operative contests a flank while wholly within it and wholly within its opponent’s territory. Friendly operatives control a flank if the total APL of those contesting it is greater than the enemy’s.',
    ],
    vp: [
      'After you reveal this op, at the end of each turning point after the first, 1VP for each flank friendly operatives control. In the fourth turning point, 2VP instead for a flank you also controlled at the end of the third.',
    ],
    cap: 'Max 2VP per turning point.',
    tokens: [],
  },
  {
    id: 'retrieval',
    archetype: 'Recon',
    name: 'Retrieval',
    reveal: 'The first time you score VP from this op.',
    rules: [],
    action: {
      name: 'Retrieve',
      ap: 1,
      effect: 'If the active operative controls an objective marker friendly operatives haven’t searched, it’s now carrying one of your Retrieval mission markers and that objective marker has been searched. Friendly operatives can Pick Up your Retrieval markers.',
      conditions: 'Not during the first turning point, while within control range of an enemy operative, or if it’s already carrying a marker.',
    },
    vp: [
      'The first time each objective marker is searched by friendly operatives, 1VP.',
      'At the end of the battle, 1VP for each of your Retrieval markers friendly operatives are carrying.',
    ],
    tokens: [
      { id: 'retrieval', name: 'Retrieval', short: 'RTRV', kind: 'marker' },
      { id: 'searched', name: 'Searched', short: 'SRCH', kind: 'marker' },
    ],
  },
  {
    id: 'scout-enemy-movement',
    archetype: 'Recon',
    name: 'Scout Enemy Movement',
    reveal: 'The first time a friendly operative performs the Scout action.',
    rules: [],
    action: {
      name: 'Scout',
      ap: 1,
      effect: 'Select one ready enemy operative visible to and more than 6" from the active operative. It’s monitored until the Ready step of the next Strategy phase.',
      conditions: 'Not with an Engage order, during the first turning point, or while within control range of an enemy operative.',
    },
    vp: [
      'At the end of each turning point after the first, 1VP for each monitored enemy operative that’s visible to friendly operatives (not just the one that scouted it).',
    ],
    cap: 'Max 2VP per turning point.',
    tokens: [{ id: 'monitored', name: 'Monitored', short: 'MON', kind: 'token' }],
  },
  // ---- Security ----
  {
    id: 'plant-banner',
    archetype: 'Security',
    name: 'Plant Banner',
    reveal: 'When you perform the Plant Banner action.',
    rules: [],
    action: {
      name: 'Plant Banner',
      ap: 1,
      effect: 'Place your Banner mission marker within the active operative’s control range, wholly within your opponent’s territory and more than 5" from a neutral killzone edge. Any operative can Pick Up your Banner.',
      conditions: 'Not during the first turning point, while within control range of an enemy operative, or if a friendly operative has already performed this action during the battle.',
    },
    vp: [
      'At the end of each turning point after the first, if your Banner is wholly within your opponent’s territory and friendly operatives control it, 1VP; 2VP instead if no enemy operatives contest it. The Banner must be in the killzone, not carried.',
    ],
    tokens: [{ id: 'banner', name: 'Banner', short: 'BNR', kind: 'marker' }],
  },
  {
    id: 'martyrs',
    archetype: 'Security',
    name: 'Martyrs',
    reveal: 'The first time a friendly operative is incapacitated while contesting an objective marker.',
    rules: [
      'Whenever a friendly operative is incapacitated while contesting an objective marker, that marker gains one of your Martyr tokens (only the first time each operative is incapacitated).',
    ],
    vp: [
      'At the end of each turning point after the first, if friendly operatives contest an objective marker with your Martyr tokens, you can remove any of them: 1VP each, or 2VP each if friendly operatives also control that marker.',
    ],
    cap: 'Max 2VP per turning point.',
    tokens: [{ id: 'martyr', name: 'Martyr', short: 'MTYR', kind: 'marker' }],
  },
  {
    id: 'envoy',
    archetype: 'Security',
    name: 'Envoy',
    reveal: 'The first time you select an envoy.',
    rules: [
      'As a STRATEGIC GAMBIT in each turning point after the first, select one friendly operative to be your envoy until the Ready step of the next Strategy phase. It can’t be one you selected before, or one that’s ignored for the kill op.',
    ],
    vp: [
      'At the end of each turning point after the first, if your envoy is wholly within enemy territory and not within control range of enemy operatives, 1VP; 2VP instead if it also lost no wounds that turning point.',
    ],
    tokens: [{ id: 'envoy', name: 'Envoy', short: 'ENVY', kind: 'token' }],
  },
  // ---- Seek & Destroy ----
  {
    id: 'rout',
    archetype: 'Seek & Destroy',
    name: 'Rout',
    reveal: 'The first time you score VP from this op.',
    rules: [],
    vp: [
      'Whenever a friendly operative incapacitates an enemy operative while within 6" of your opponent’s drop zone, 1VP; 2VP instead if that enemy had a Wounds stat of 12 or more.',
    ],
    cap: 'Max 2VP per turning point.',
    tokens: [],
  },
  {
    id: 'sweep-and-clear',
    archetype: 'Seek & Destroy',
    name: 'Sweep & Clear',
    reveal: 'The first time an enemy operative is incapacitated while contesting an objective marker, or a friendly operative performs the Clear action.',
    rules: [
      'When an enemy operative that contests an objective marker is incapacitated, that marker is swept until the Ready step of the next Strategy phase.',
    ],
    action: {
      name: 'Clear',
      ap: 1,
      effect: 'An objective marker the active operative controls is cleared for the turning point.',
      conditions: NO_TP1_OR_ENGAGED,
    },
    vp: [
      'At the end of each turning point after the first, if the centre or your opponent’s objective marker is cleared and not contested by enemy operatives, 1VP; 2VP instead if it’s also swept.',
      'If friendly operatives control a swept objective marker, 1VP.',
    ],
    cap: 'Max 2VP per turning point.',
    tokens: [
      { id: 'swept', name: 'Swept', short: 'SWPT', kind: 'marker' },
      { id: 'cleared', name: 'Cleared', short: 'CLR', kind: 'marker' },
    ],
  },
  {
    id: 'dominate',
    archetype: 'Seek & Destroy',
    name: 'Dominate',
    reveal: 'The first time an enemy operative is incapacitated by a friendly operative.',
    rules: [
      'Each time a friendly operative incapacitates an enemy operative, it gains one of your Dominate tokens, or two if that enemy had a Wounds stat of 12 or more.',
    ],
    vp: [
      'At the end of the third and fourth turning points, remove Dominate tokens from friendly operatives that are in the killzone and not incapacitated: 1VP for each.',
    ],
    cap: 'Max 3VP per turning point.',
    tokens: [{ id: 'dominate', name: 'Dominate', short: 'DOM', kind: 'token' }],
  },
]

export const getTacOp = (id) => TAC_OPS.find((tacOp) => tacOp.id === id) ?? null

// The kill team data spells archetypes like "Seek & Destroy/Security".
const normalizeArchetype = (name) => name.toLowerCase().replace(/\band\b/g, '&').replace(/\s+/g, ' ').trim()

export const archetypesFor = (killteam) =>
  String(killteam?.archetypes ?? '')
    .split('/')
    .map((value) => ARCHETYPES.find((archetype) => normalizeArchetype(archetype) === normalizeArchetype(value)))
    .filter(Boolean)

export const tacOpsFor = (killteam) => {
  const allowed = new Set(archetypesFor(killteam))
  return TAC_OPS.filter((tacOp) => allowed.has(tacOp.archetype))
}
