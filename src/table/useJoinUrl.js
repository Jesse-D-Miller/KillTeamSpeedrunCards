import { useEffect, useState } from 'react'

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

// iPads can't reach "localhost", so when the projector browser is opened locally,
// ask the server for its LAN address and build the join link from that.
export const useJoinBase = () => {
  const { protocol, hostname, host, port } = window.location
  const [base, setBase] = useState(LOOPBACK.has(hostname) ? null : `${protocol}//${host}`)

  useEffect(() => {
    if (!LOOPBACK.has(hostname)) return
    let cancelled = false
    fetch('/api/info')
      .then((response) => response.json())
      .then((info) => {
        const address = info.addresses?.[0]
        if (!cancelled) setBase(address ? `${protocol}//${address}${port ? `:${port}` : ''}` : `${protocol}//${host}`)
      })
      .catch(() => {
        if (!cancelled) setBase(`${protocol}//${host}`)
      })
    return () => {
      cancelled = true
    }
  }, [protocol, hostname, host, port])

  return base
}

export const seatUrl = (base, seat) => (base ? `${base}/play?seat=${seat}` : '')
