import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GameContext } from './gameContext.js'

// Single connection to the table server. The server owns the game; this just mirrors
// whatever snapshot it last sent and forwards actions. Reconnects forever with backoff
// and immediately when an iPad wakes up.

const EPHEMERAL_INTERVAL_MS = 33
const EPHEMERAL_STALE_MS = 15000

const tokenKey = (seat) => `kt-seat-token-${seat}`

const readToken = (seat) => {
  try {
    return localStorage.getItem(tokenKey(seat)) || null
  } catch {
    return null
  }
}

const writeToken = (seat, token) => {
  try {
    if (token) localStorage.setItem(tokenKey(seat), token)
    else localStorage.removeItem(tokenKey(seat))
  } catch {
    // private mode; seat will need a takeover after reload
  }
}

const socketUrl = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${protocol}://${window.location.host}/ws`
}

export function GameProvider({ role, seat = null, children }) {
  const [status, setStatus] = useState('connecting')
  const [state, setState] = useState(null)
  const [presence, setPresence] = useState(null)
  const [error, setError] = useState(null)
  const [ephemerals, setEphemerals] = useState({})
  const socketRef = useRef(null)
  const pendingRef = useRef(new Map())
  const nextIdRef = useRef(1)
  const takeoverRef = useRef(false)
  const stoppedRef = useRef(false)
  const attemptRef = useRef(0)
  const reconnectRef = useRef(() => {})
  const ephemeralRef = useRef({ timer: null, payload: undefined, lastSent: 0 })

  const connect = useCallback(() => {
    if (stoppedRef.current) return
    const existing = socketRef.current
    if (existing && existing.readyState <= WebSocket.OPEN) return

    const socket = new WebSocket(socketUrl())
    socketRef.current = socket

    socket.addEventListener('open', () => {
      attemptRef.current = 0
      socket.send(
        JSON.stringify(
          role === 'table'
            ? { type: 'hello', role: 'table' }
            : { type: 'hello', role: 'seat', seat, token: readToken(seat), takeover: takeoverRef.current },
        ),
      )
      takeoverRef.current = false
    })

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)
      switch (message.type) {
        case 'welcome':
          if (message.token) writeToken(seat, message.token)
          setStatus('online')
          break
        case 'seat_taken':
          setStatus('seat_taken')
          break
        case 'released':
          writeToken(seat, null)
          setStatus('released')
          break
        case 'state':
          setState(message.state)
          setPresence(message.presence)
          break
        case 'ephemeral':
          setEphemerals((current) => {
            const next = { ...current }
            if (message.payload == null) delete next[message.from]
            else next[message.from] = { ...message.payload, at: Date.now() }
            return next
          })
          break
        case 'ack': {
          const pending = pendingRef.current.get(message.id)
          pendingRef.current.delete(message.id)
          pending?.resolve()
          break
        }
        case 'error': {
          const pending = pendingRef.current.get(message.id)
          pendingRef.current.delete(message.id)
          pending?.reject(new Error(message.message))
          setError(message.message)
          break
        }
        default:
      }
    })

    socket.addEventListener('close', () => {
      if (socketRef.current !== socket) return
      socketRef.current = null
      pendingRef.current.forEach((pending) => pending.reject(new Error('Disconnected')))
      pendingRef.current.clear()
      setStatus((current) => (current === 'seat_taken' || current === 'released' ? current : 'offline'))
      if (stoppedRef.current) return
      const delay = Math.min(5000, 500 * 2 ** attemptRef.current)
      attemptRef.current += 1
      window.setTimeout(() => {
        if (socketRef.current === null) reconnectRef.current()
      }, delay)
    })
  }, [role, seat])

  useEffect(() => {
    reconnectRef.current = connect
    stoppedRef.current = false
    connect()
    const wake = () => {
      if (document.visibilityState === 'visible') connect()
    }
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('online', wake)
    window.addEventListener('focus', wake)
    return () => {
      stoppedRef.current = true
      document.removeEventListener('visibilitychange', wake)
      window.removeEventListener('online', wake)
      window.removeEventListener('focus', wake)
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [connect])

  // Drop previews from devices that went quiet without clearing them.
  useEffect(() => {
    const interval = window.setInterval(() => {
      setEphemerals((current) => {
        const now = Date.now()
        const entries = Object.entries(current).filter(([, value]) => now - value.at < EPHEMERAL_STALE_MS)
        return entries.length === Object.keys(current).length ? current : Object.fromEntries(entries)
      })
    }, 2000)
    return () => window.clearInterval(interval)
  }, [])

  const sendRaw = useCallback((payload) => {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return false
    socket.send(JSON.stringify(payload))
    return true
  }, [])

  const dispatch = useCallback(
    (action) =>
      new Promise((resolve, reject) => {
        const id = nextIdRef.current++
        if (!sendRaw({ type: 'action', id, action })) {
          setError('Not connected to the table.')
          reject(new Error('Not connected'))
          return
        }
        pendingRef.current.set(id, { resolve, reject })
      }),
    [sendRaw],
  )

  // Fire-and-forget dispatch for UI handlers that don't need the result.
  const act = useCallback(
    (action) => {
      dispatch(action).catch(() => {})
    },
    [dispatch],
  )

  // Throttled to ~30Hz; the latest payload always wins. `null` clears immediately.
  const sendEphemeral = useCallback(
    (payload) => {
      const slot = ephemeralRef.current
      slot.payload = payload
      const flush = () => {
        slot.timer = null
        slot.lastSent = Date.now()
        sendRaw({ type: 'ephemeral', payload: slot.payload })
      }
      if (payload === null) {
        window.clearTimeout(slot.timer)
        flush()
        return
      }
      if (slot.timer) return
      const wait = Math.max(0, EPHEMERAL_INTERVAL_MS - (Date.now() - slot.lastSent))
      slot.timer = window.setTimeout(flush, wait)
    },
    [sendRaw],
  )

  const takeover = useCallback(() => {
    takeoverRef.current = true
    setStatus('connecting')
    const socket = socketRef.current
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'hello', role: 'seat', seat, token: readToken(seat), takeover: true }))
      takeoverRef.current = false
    } else {
      connect()
    }
  }, [connect, seat])

  const releaseSeat = useCallback((target) => sendRaw({ type: 'release_seat', seat: target }), [sendRaw])

  const value = useMemo(
    () => ({
      role,
      seat,
      status,
      state,
      presence,
      error,
      clearError: () => setError(null),
      ephemerals,
      dispatch,
      act,
      sendEphemeral,
      takeover,
      releaseSeat,
    }),
    [role, seat, status, state, presence, error, ephemerals, dispatch, act, sendEphemeral, takeover, releaseSeat],
  )

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}
