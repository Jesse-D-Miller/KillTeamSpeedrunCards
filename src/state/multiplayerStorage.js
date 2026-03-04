const persistMultiplayerIdentity = (
  storage,
  sessionStorage,
  { code, name, playerId },
) => {
  if (!storage) return
  storage.setItem('kt-room-code', String(code || ''))
  storage.setItem('kt-player-name', String(name || '').trim())
  storage.setItem('kt-player-id', String(playerId || ''))
  if (sessionStorage) {
    sessionStorage.setItem('kt-room-code', String(code || ''))
    sessionStorage.setItem('kt-player-name', String(name || '').trim())
    sessionStorage.setItem('kt-player-id', String(playerId || ''))
  }
}

export { persistMultiplayerIdentity }
