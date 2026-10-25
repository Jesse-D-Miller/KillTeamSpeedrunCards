// Approved Ops 2025 initiative cards: the Re-roll card (value 0) and the +N/-N
// cards the roll-off loser gains in turning points 1-3.
export const cardLabel = (card) => (card.value ? `±${card.value}` : 'Re-roll')

export const cardDescription = (card) =>
  card.value
    ? `Change your initiative roll by ${card.value} up or down (it can go above 6 or below 1).`
    : 'Re-roll your initiative roll. The new result replaces any changes already made.'
