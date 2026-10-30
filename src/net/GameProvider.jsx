import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { applyAction } from '../../shared/reducer.js'
import { GameContext } from './gameContext.js'

// Single connection to the table server. The server owns the game; this mirrors the
// snapshot it last sent and forwards actions. Reconnects forever with backoff and
// immediately when an iPad wakes up.
//
// iPad Safari can drop a connection (sleep, switching apps, going full screen) and
// still report it open, so taps would vanish into it. This device checks the line
// itself: it pings every few seconds, and straight away on waking, and replaces a
// connection that stops answering. Actions wait in order until the server confirms
// them and are re-sent after a reconnect (the server ignores repeats); meanwhile the
// screen shows them applied, so a tap never waits on the network.

const EPHEMERAL_INTERVAL_MS = 33
// Other devices drop a preview they haven't heard about for this long (a device that
// vanished without clearing it), so whatever this device is showing is re-sent well
// within it, and again after reconnecting: it stays up exactly as long as it does here.
const EPHEMERAL_STALE_MS = 15000
const EPHEMERAL_KEEPALIVE_MS = 4000

const PING_MS = 4000
// No reply to a ping for this long: the connection is dead, whatever it says. Generous,
// so an iPad that's busy for a moment (a big redraw) isn't mistaken for a dead line.
const PONG_LIMIT_MS = 9000
// Just woke up: a working connection answers well within this.
const WAKE_PROBE_MS = 4000
const CONNECT_TIMEOUT_MS = 5000
// An action still unconfirmed after this long is given up on.
const ACTION_TIMEOUT_MS = 20000

// Ids for this page's actions, unique across reloads (crypto.randomUUID needs https).
const newSessionId = () => Math.random().toString(36).slice(2, 10)

// The server's snapshot with this device's unconfirmed actions applied on top.
const predict = (state, pending, actor) =>
  pending.reduce((current, { action }) => {
    try {
      const next = applyAction(current, action, actor, () => 0.5)
      // A phase change rolls dice and reveals what only the server knows: wait for it.
      return next.phase === current.phase ? next : current
    } catch {
      return current
    }
  }, state)

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
  // Actions sent but not yet confirmed, in order: [{ id, action }].
  const [pending, setPending] = useState([])
  const socketRef = useRef(null)
  // id -> { action, resolve, reject, timer }, in the order they were dispatched.
  const pendingRef = useRef(new Map())
  const sessionRef = useRef(newSessionId())
  const nextIdRef = useRef(1)
  const takeoverRef = useRef(false)
  const stoppedRef = useRef(false)
  const attemptRef = useRef(0)
  const reconnectRef = useRef(() => {})
  const ephemeralRef = useRef({ timer: null, payload: undefined, lastSent: 0 })
  const lastPingRef = useRef(0)
  // When the oldest unanswered ping went out (null: nothing unanswered).
  const awaitingRef = useRef(null)

  const settle = useCallback((id, failure) => {
    const entry = pendingRef.current.get(id)
    if (!entry) return
    pendingRef.current.delete(id)
    window.clearTimeout(entry.timer)
    setPending((current) => current.filter((item) => item.id !== id))
    if (failure) entry.reject(failure)
    else entry.resolve()
  }, [])

  // Drop a connection (closed, or not answering) and schedule the next attempt.
  const lose = useCallback((socket) => {
    if (socketRef.current !== socket) return
    socketRef.current = null
    window.clearTimeout(socket.openTimer)
    socket.close()
    setStatus((current) => (current === 'seat_taken' || current === 'released' ? current : 'offline'))
    if (stoppedRef.current) return
    const delay = Math.min(4000, 250 * 2 ** attemptRef.current)
    attemptRef.current += 1
    window.setTimeout(() => {
      if (socketRef.current === null) reconnectRef.current()
    }, delay)
  }, [])

  const ping = useCallback((socket) => {
    const now = Date.now()
    lastPingRef.current = now
    if (awaitingRef.current == null) awaitingRef.current = now
    socket.send(JSON.stringify({ type: 'ping' }))
  }, [])

  const connect = useCallback(() => {
    if (stoppedRef.current) return
    const existing = socketRef.current
    if (existing && existing.readyState <= WebSocket.OPEN) return

    const socket = new WebSocket(socketUrl())
    socketRef.current = socket
    awaitingRef.current = null
    socket.openTimer = window.setTimeout(() => {
      if (socket.readyState === WebSocket.CONNECTING) lose(socket)
    }, CONNECT_TIMEOUT_MS)

    socket.addEventListener('open', () => {
      window.clearTimeout(socket.openTimer)
      attemptRef.current = 0
      // First check after a full interval.
      lastPingRef.current = Date.now()
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
      if (socketRef.current !== socket) return
      // Any message shows the line works.
      awaitingRef.current = null
      const message = JSON.parse(event.data)
      switch (message.type) {
        case 'welcome':
          if (message.token) writeToken(seat, message.token)
          socket.welcomed = true
          setStatus('online')
          if (ephemeralRef.current.payload) socket.send(JSON.stringify({ type: 'ephemeral', payload: ephemeralRef.current.payload }))
          // Anything unconfirmed goes (again) in order; the server skips what it already has.
          pendingRef.current.forEach((entry, id) => socket.send(JSON.stringify({ type: 'action', id, action: entry.action })))
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
          // Confirmed in the same update that shows its result, so nothing flickers.
          if (message.ack != null) settle(message.ack)
          break
        case 'ephemeral':
          setEphemerals((current) => {
            const next = { ...current }
            if (message.payload == null) delete next[message.from]
            else next[message.from] = { ...message.payload, at: Date.now() }
            return next
          })
          break
        case 'ack':
          settle(message.id)
          break
        case 'error':
          settle(message.id, new Error(message.message))
          setError(message.message)
          break
        default:
      }
    })

    socket.addEventListener('close', () => lose(socket))
  }, [role, seat, settle, lose])

  useEffect(() => {
    reconnectRef.current = connect
    stoppedRef.current = false
    connect()
    // Waking up (unlocked, back from another app, out of full screen): connect now, or
    // check that the connection that looks open still answers.
    const wake = () => {
      if (document.visibilityState !== 'visible') return
      const socket = socketRef.current
      if (!socket) {
        attemptRef.current = 0
        connect()
        return
      }
      if (socket.readyState !== WebSocket.OPEN) return
      ping(socket)
      const asked = awaitingRef.current
      window.setTimeout(() => {
        // Still waiting on that ping (any message since would have cleared it).
        if (socketRef.current === socket && awaitingRef.current != null && awaitingRef.current <= asked) {
          attemptRef.current = 0
          lose(socket)
        }
      }, WAKE_PROBE_MS)
    }
    document.addEventListener('visibilitychange', wake)
    document.addEventListener('fullscreenchange', wake)
    document.addEventListener('webkitfullscreenchange', wake)
    window.addEventListener('online', wake)
    window.addEventListener('focus', wake)
    window.addEventListener('pageshow', wake)
    return () => {
      stoppedRef.current = true
      document.removeEventListener('visibilitychange', wake)
      document.removeEventListener('fullscreenchange', wake)
      document.removeEventListener('webkitfullscreenchange', wake)
      window.removeEventListener('online', wake)
      window.removeEventListener('focus', wake)
      window.removeEventListener('pageshow', wake)
      const socket = socketRef.current
      socketRef.current = null
      if (socket) {
        window.clearTimeout(socket.openTimer)
        socket.close()
      }
    }
  }, [connect, ping, lose])

  // Keep checking the line while it's open.
  useEffect(() => {
    const interval = window.setInterval(() => {
      const socket = socketRef.current
      if (!socket || socket.readyState !== WebSocket.OPEN) return
      const now = Date.now()
      if (awaitingRef.current != null && now - awaitingRef.current > PONG_LIMIT_MS) lose(socket)
      else if (now - lastPingRef.current >= PING_MS) ping(socket)
    }, 1000)
    return () => window.clearInterval(interval)
  }, [ping, lose])

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

  // Resolves when the server has applied the action; rejects if it refuses it, or if
  // the table can't be reached for a while. Shown applied straight away either way.
  const dispatch = useCallback(
    (action) =>
      new Promise((resolve, reject) => {
        const id = `${sessionRef.current}-${nextIdRef.current++}`
        const timer = window.setTimeout(() => {
          setError('Couldn’t reach the table. Check this iPad’s Wi-Fi.')
          settle(id, new Error('Not connected'))
        }, ACTION_TIMEOUT_MS)
        pendingRef.current.set(id, { action, resolve, reject, timer })
        setPending((current) => [...current, { id, action }])
        const socket = socketRef.current
        // Otherwise it goes when the connection is back (see 'welcome').
        if (socket?.welcomed && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'action', id, action }))
      }),
    [settle],
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

  useEffect(() => {
    const interval = window.setInterval(() => {
      const slot = ephemeralRef.current
      if (slot.payload && !slot.timer && Date.now() - slot.lastSent >= EPHEMERAL_KEEPALIVE_MS) {
        slot.lastSent = Date.now()
        sendRaw({ type: 'ephemeral', payload: slot.payload })
      }
    }, 1000)
    return () => window.clearInterval(interval)
  }, [sendRaw])

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

  const actor = role === 'table' ? 'table' : seat
  const shown = useMemo(() => (state && pending.length ? predict(state, pending, actor) : state), [state, pending, actor])

  const value = useMemo(
    () => ({
      role,
      seat,
      status,
      state: shown,
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
    [role, seat, status, shown, presence, error, ephemerals, dispatch, act, sendEphemeral, takeover, releaseSeat],
  )

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}
