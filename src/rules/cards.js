// The primary op cards (unchanged in Approved Ops 2025), drawn by
// src/play/PrimaryOpCard.jsx. Approved Ops 2025 tac ops are text cards from
// src/data/tacOps.js, and the scouting step no longer exists.

export const PRIMARY_OP_CARDS = [
  ['critOp', 'Crit op'],
  ['killOp', 'Kill op'],
  ['tacOp', 'Tac op'],
].map(([category, label]) => ({ category, label }))

export const primaryOpCard = (primaryOp) =>
  PRIMARY_OP_CARDS.find((card) => card.category === primaryOp?.category) ?? null
