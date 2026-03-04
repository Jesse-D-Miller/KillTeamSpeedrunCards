let sharedMapSocket = null

export const setSharedMapSocket = (socket) => {
  sharedMapSocket = socket || null
}

export const takeSharedMapSocket = () => {
  const socket = sharedMapSocket
  sharedMapSocket = null
  return socket
}

export const clearSharedMapSocket = () => {
  if (!sharedMapSocket) return
  try {
    sharedMapSocket.close()
  } catch {
    // noop
  }
  sharedMapSocket = null
}
