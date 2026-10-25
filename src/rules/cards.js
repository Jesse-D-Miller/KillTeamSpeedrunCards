// Primary op card images in public/images (unchanged in Approved Ops 2025).
// Approved Ops 2025 tac ops are text cards from src/data/tacOps.js, and the
// scouting step no longer exists.

const pad = (value) => String(value).padStart(2, '0')

export const PRIMARY_OP_CARDS = [
  ['critOp', 'Crit op'],
  ['killOp', 'Kill op'],
  ['tacOp', 'Tac op'],
].map(([category, label], index) => ({
  category,
  label,
  src: `/images/primaryOp/primary-op-${pad(index + 1)}.png`,
}))

export const primaryOpCard = (primaryOp) =>
  PRIMARY_OP_CARDS.find((card) => card.category === primaryOp?.category) ?? null
