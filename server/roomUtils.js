const normalizeName = (value) => String(value || '').trim().toLowerCase()

const findPlayerForSyncInit = (room, { name, playerId }) => {
  if (!room || !room.players) return null
  if (playerId && room.players.has(playerId)) {
    return room.players.get(playerId)
  }
  const normalized = normalizeName(name)
  if (!normalized) return null
  return (
    Array.from(room.players.values()).find(
      (candidate) => normalizeName(candidate.name) === normalized,
    ) || null
  )
}

export { findPlayerForSyncInit }
