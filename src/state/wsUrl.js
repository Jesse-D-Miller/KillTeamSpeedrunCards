const normalizeWsUrl = (value) => {
  if (!value) return ''
  if (value.startsWith('https://')) {
    return `wss://${value.slice('https://'.length)}`
  }
  if (value.startsWith('http://')) {
    return `ws://${value.slice('http://'.length)}`
  }
  return value
}

const resolveWsUrl = () => {
  const configured = normalizeWsUrl(import.meta.env.VITE_WS_URL || '')
  if (configured) return configured
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${protocol}://${window.location.hostname}:8080`
}

export { resolveWsUrl }
