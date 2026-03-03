const normalizeName = (value) => String(value || '').trim().toUpperCase()

const getRoomCode = () =>
  sessionStorage.getItem('kt-room-code') ||
  localStorage.getItem('kt-room-code') ||
  ''

const getPlayerId = () =>
  sessionStorage.getItem('kt-player-id') ||
  localStorage.getItem('kt-player-id') ||
  ''

const getPlayerName = () =>
  sessionStorage.getItem('kt-player-name') ||
  localStorage.getItem('kt-player-name') ||
  'Player'

const getGameId = () => localStorage.getItem('kt-game-id') || ''

const getRoomPlayers = (roomCode) => {
  if (!roomCode) return []
  try {
    const stored = localStorage.getItem(`kt-room-players-${roomCode}`)
    const parsed = stored ? JSON.parse(stored) : []
    return Array.isArray(parsed)
      ? parsed.filter(
          (player) => normalizeName(player?.name) !== 'MAP' && player?.id,
        )
      : []
  } catch (error) {
    console.warn('Failed to read room players for final results.', error)
    return []
  }
}

const getFinalResultStorageKeys = ({ roomCode, playerId, gameId }) => {
  const baseKey = `kt-room-player-final-results-${roomCode}-${playerId}`
  const gameKey = gameId ? `${baseKey}-${gameId}` : ''
  return { baseKey, gameKey }
}

const readFinalResult = ({ roomCode, playerId, gameId }) => {
  if (!roomCode || !playerId) return null
  const { baseKey, gameKey } = getFinalResultStorageKeys({
    roomCode,
    playerId,
    gameId,
  })
  const raw = (gameKey && localStorage.getItem(gameKey)) || localStorage.getItem(baseKey)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch (error) {
    console.warn('Failed to parse final results payload.', error)
    return null
  }
}

const writeFinalResult = ({ roomCode, playerId, gameId, result }) => {
  if (!roomCode || !playerId || !result) return
  const payload = JSON.stringify(result)
  const { baseKey, gameKey } = getFinalResultStorageKeys({
    roomCode,
    playerId,
    gameId,
  })
  localStorage.setItem(baseKey, payload)
  if (gameKey) {
    localStorage.setItem(gameKey, payload)
  }
}

export {
  getGameId,
  getPlayerId,
  getPlayerName,
  getRoomCode,
  getRoomPlayers,
  readFinalResult,
  writeFinalResult,
}