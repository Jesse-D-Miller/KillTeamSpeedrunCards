import { useEffect, useMemo, useRef, useState } from 'react'
import { distance, stepPath } from '../../shared/geometry.js'
import {
  BASE_SIZES_MM,
  DEFAULT_BASE_MM,
  baseRadiusIn,
  tokenRadiusIn,
  turnState,
} from '../../shared/game.js'
import { clampToBase, defaultShooterPoint } from '../../shared/targeting.js'
import BoardSvg from '../board/BoardSvg.jsx'
import { dragOverlays } from '../board/dragOverlays.js'
import { baseSizeMm } from '../data/baseSizes.js'
import { BOARD, getLayout, toSvgY } from '../board/boardData.js'
import { categoriesFor, radiusFor } from '../data/tokenCatalog.js'
import { maxWoundsFor, tokenLabelFor } from '../rules/roster.js'
import Drawer from './Drawer.jsx'
import FullscreenButton from './FullscreenButton.jsx'
import { SelectPanel, TokenFlyout, UnitsFlyout, WeaponFlyout } from './RailFlyouts.jsx'
import { meleeWeaponsFor, rangedWeaponsFor } from '../rules/weaponRules.js'
import AttackDrawer from './AttackDrawer.jsx'
import ToolIcon from './ToolIcon.jsx'
import { usePlayer } from './usePlayer.js'
import { useAttack } from './useAttack.js'

// The iPad is the controller: everything drawn here is streamed to the projector.
// One finger uses the active tool; two fingers pan/zoom the iPad view only.

const TOOLS = [
  ['move', 'Move'],
  ['measure', 'Measure'],
  ['los', 'Sightline'],
  ['attack', 'Shoot/Fight'],
  ['units', 'Units'],
  ['token', 'Token'],
  ['select', 'Select'],
  ['ping', 'Ping'],
]

// Tools in which tapping a token or marker selects it and dragging moves it.
// (Select only selects; it never moves anything.)
const DRAG_TOOLS = ['move', 'units', 'token']
// A little room around the mat (dead operatives aren't drawn on the iPad map).
const PAD = 0.5
// Before the battle a drag is measured in straight 1" legs along the route (like a
// battle move), but the operative lands exactly where it's dropped, part inches included.
const TRAIL_STEP = 1
const FULL_VIEW = { x: -PAD, y: -PAD, w: BOARD.width + PAD * 2, h: BOARD.height + PAD * 2 }
const ASPECT = FULL_VIEW.h / FULL_VIEW.w

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

// How close (in screen pixels) a finger must be to grab the ruler's end or line.
const GRAB_PX = 24

const distanceToSegment = (point, a, b) => {
  const lengthSq = (b.x - a.x) ** 2 + (b.y - a.y) ** 2
  const t = lengthSq ? clamp(((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / lengthSq, 0, 1) : 0
  return distance(point, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
}

// Pixel <-> viewBox mapping for preserveAspectRatio="xMidYMid meet".
const viewMetrics = (rect, view) => {
  const scale = Math.min(rect.width / view.w, rect.height / view.h)
  return {
    scale,
    offX: rect.left + (rect.width - view.w * scale) / 2,
    offY: rect.top + (rect.height - view.h * scale) / 2,
  }
}

// − / + beside a just-placed operative to pick its base size, with the size in
// the middle of the base. Drawn in board inches inside the map SVG.
function BaseSizer({ token, onStep }) {
  const r = tokenRadiusIn(token)
  const cy = toSvgY(token.y)
  const buttonR = 0.42
  const gap = r + 0.25 + buttonR
  const index = BASE_SIZES_MM.indexOf(token.baseMm)
  const buttons = [
    { direction: -1, x: token.x - gap, label: 'Smaller base', glyph: 'M-0.18,0 H0.18', disabled: index === 0 },
    {
      direction: 1,
      x: token.x + gap,
      label: 'Larger base',
      glyph: 'M-0.18,0 H0.18 M0,-0.18 V0.18',
      disabled: index === BASE_SIZES_MM.length - 1,
    },
  ]
  return (
    <g className="base-sizer">
      <text className="base-sizer-size" x={token.x} y={cy} textAnchor="middle" dominantBaseline="central">
        {token.baseMm}
      </text>
      {buttons.map(({ direction, x, label, glyph, disabled }) => (
        <g
          key={direction}
          className={`base-sizer-button${disabled ? ' is-disabled' : ''}`}
          role="button"
          aria-label={label}
          aria-disabled={disabled}
          onPointerDown={(event) => {
            event.stopPropagation()
            if (!disabled) onStep(direction)
          }}
        >
          <circle cx={x} cy={cy} r={buttonR} />
          <path d={glyph} transform={`translate(${x} ${cy})`} />
        </g>
      ))}
    </g>
  )
}

// tabs / tabLabel / onSelectTab: the phase's tabs, so the rail can switch away from the map.
function MapTab({ tabs = [], tabLabel = (id) => id, onSelectTab = () => {} }) {
  const { state: game, seat, killteam, roster, ephemerals, act, sendEphemeral } = usePlayer()
  const svgRef = useRef(null)
  const [view, setView] = useState(FULL_VIEW)
  // null = no tool: drag pans, pinch zooms, nothing on the board is touched.
  const [tool, setTool] = useState(null)
  const [tabsOpen, setTabsOpen] = useState(false)
  const [overlay, setOverlay] = useState(null)
  const [dragPreview, setDragPreview] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  // Units tool: the pop-out list, the unit waiting to be placed, and the placed
  // unit whose base size is still being set (by unit key).
  const [unitsOpen, setUnitsOpen] = useState(false)
  const [pendingUnit, setPendingUnit] = useState(null)
  const [editingKey, setEditingKey] = useState(null)
  // Token tool: which list is popped out ('categories', a category id, or null),
  // the last category used, and the catalogue entry waiting to be placed.
  const [tokenMenu, setTokenMenu] = useState(null)
  // Shoot/Fight: the weapon list pops out when an attacker is picked and closes on a choice.
  const [weaponMenuOpen, setWeaponMenuOpen] = useState(false)
  const [lastCategory, setLastCategory] = useState('categories')
  const [pendingEntry, setPendingEntry] = useState(null)
  const [railOpen, setRailOpen] = useState(true)
  const pointersRef = useRef(new Map())
  const gestureRef = useRef(null)
  const viewRef = useRef(view)

  useEffect(() => {
    viewRef.current = view
  }, [view])

  // Clear our preview on the projector when leaving the map.
  useEffect(() => () => sendEphemeral(null), [sendEphemeral])

  const layout = getLayout(game.table.mapId, game.table.arrangementId)
  const tokens = game.tokens
  const selected = tokens.find((token) => token.id === selectedId) ?? null
  const selectedMarker = game.markers.find((marker) => marker.id === selectedId) ?? null
  const selectedItem = selected
    ? { type: 'token', value: selected }
    : selectedMarker
      ? { type: 'marker', value: selectedMarker }
      : null
  const categories = categoriesFor(game, seat)
  const placedUnitKeys = new Set(tokens.filter((token) => token.seat === seat).map((token) => token.unitKey))
  const unplaced = roster.filter((unit) => !placedUnitKeys.has(unit.key))
  const activeUnit = unplaced.find((unit) => unit.key === pendingUnit?.key) ?? null
  const editing = editingKey
    ? tokens.find((token) => token.seat === seat && token.unitKey === editingKey) ?? null
    : null
  // 1" stepped moves with lasting paths only once the battle has started.
  const steppedMoves = game.phase === 'battle'
  // Firefight phase: moving (or tapping) an operative activates it.
  const firefight = game.phase === 'battle' && game.battle.firefightTp === game.battle.tp
  const turn = turnState(game)

  const publish = (payload) => {
    setOverlay(payload)
    sendEphemeral(payload)
  }

  const toBoard = (clientX, clientY) => {
    const rect = svgRef.current.getBoundingClientRect()
    const { scale, offX, offY } = viewMetrics(rect, viewRef.current)
    const svgX = viewRef.current.x + (clientX - offX) / scale
    const svgY = viewRef.current.y + (clientY - offY) / scale
    return { x: clamp(svgX, 0, BOARD.width), y: clamp(BOARD.height - svgY, 0, BOARD.height) }
  }

  // Sightline: where the shooter's targeting lines currently start (absolute), if shown.
  const shooterPointOf = (payload) => {
    const shooter = tokens.find((token) => token.id === payload?.shooterId)
    if (!shooter) return null
    if (payload.point) return { x: shooter.x + payload.point.dx, y: shooter.y + payload.point.dy }
    const target = tokens.find((token) => token.id === payload.targetId)
    return target ? defaultShooterPoint(shooter, target) : null
  }

  // The living operative whose base is under this point, if any.
  const operativeAt = (point) =>
    tokens.find(
      (token) =>
        token.unitKey &&
        !game.players[token.seat]?.unitState?.[token.unitKey]?.dead &&
        distance(token, point) <= tokenRadiusIn(token),
    ) ?? null

  const placeEntry = (entry, point, host = null) => {
    if (entry.kind === 'base') {
      act({ type: 'token/add', ...point, label: '', unitKey: null, baseMm: DEFAULT_BASE_MM, baseLocked: true })
    } else {
      act({
        type: 'marker/add',
        kind: entry.kind,
        catalogId: entry.id,
        label: entry.name,
        short: entry.short,
        radius: radiusFor(entry),
        ring: entry.ring ?? 0,
        ...(host ? { x: host.x, y: host.y, attachedTo: host.id } : point),
      })
    }
    setPendingEntry(null)
  }

  // ---- two-finger pan/zoom ----
  const startPinch = () => {
    const [a, b] = Array.from(pointersRef.current.values())
    const rect = svgRef.current.getBoundingClientRect()
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    const { scale, offX, offY } = viewMetrics(rect, viewRef.current)
    gestureRef.current = {
      type: 'pinch',
      startDist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      startView: viewRef.current,
      anchor: { x: viewRef.current.x + (mid.x - offX) / scale, y: viewRef.current.y + (mid.y - offY) / scale },
    }
  }

  const updatePinch = () => {
    const gesture = gestureRef.current
    const [a, b] = Array.from(pointersRef.current.values())
    const rect = svgRef.current.getBoundingClientRect()
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1
    const w = clamp((gesture.startView.w * gesture.startDist) / dist, 5, FULL_VIEW.w)
    const next = { w, h: w * ASPECT, x: 0, y: 0 }
    const { scale, offX, offY } = viewMetrics(rect, { ...next, x: 0, y: 0 })
    next.x = gesture.anchor.x - (mid.x - offX) / scale
    next.y = gesture.anchor.y - (mid.y - offY) / scale
    next.x = clamp(next.x, FULL_VIEW.x, FULL_VIEW.x + FULL_VIEW.w - next.w)
    next.y = clamp(next.y, FULL_VIEW.y, FULL_VIEW.y + FULL_VIEW.h - next.h)
    setView(next)
  }

  // ---- single-finger tools ----
  const beginTool = (event, target) => {
    const point = toBoard(event.clientX, event.clientY)

    // An armed token dropped on an operative rides on it.
    if (target?.token && tool === 'token' && pendingEntry?.kind === 'token' && target.token.unitKey) {
      placeEntry(pendingEntry, point, target.token)
      return
    }
    if (tool === 'select' && (target?.token || target?.marker)) {
      setSelectedId((target.token ?? target.marker).id)
      return
    }
    if (target?.token && DRAG_TOOLS.includes(tool)) {
      setSelectedId(target.token.id)
      // Blank tokens drag freely with no measurement. Before the battle starts,
      // operatives also drag freely (deployment), measured along the path dragged.
      if (!target.token.unitKey || !steppedMoves) {
        const trail = target.token.unitKey ? [{ x: target.token.x, y: target.token.y }] : null
        // A blank token is measured in a straight line from where it started.
        const origin = trail ? null : { x: target.token.x, y: target.token.y }
        gestureRef.current = { type: 'drag-free', id: target.token.id, action: 'token/update', trail, origin, moved: false }
        return
      }
      // Operative tokens follow the finger smoothly; their path locks in at each full inch. follows the finger smoothly; its path locks in at each full inch.
      // Dragging an operative that already moved this TP continues that movement.
      const path = target.token.lastMove?.path ?? [{ x: target.token.x, y: target.token.y }]
      gestureRef.current = { type: 'drag-token', id: target.token.id, path, start: path, moved: false }
      return
    }
    if (target?.marker && DRAG_TOOLS.includes(tool)) {
      setSelectedId(target.marker.id)
      gestureRef.current = {
        type: 'drag-free',
        id: target.marker.id,
        action: 'marker/update',
        // Tokens dropped on an operative attach to it.
        attachable: target.marker.kind === 'token',
        origin: { x: target.marker.x, y: target.marker.y },
        moved: false,
      }
      return
    }

    if (tool === 'token' && pendingEntry) {
      placeEntry(pendingEntry, point)
      return
    }
    if (tool === 'units' && activeUnit && !editingKey) {
      act({
        type: 'token/add',
        ...point,
        label: tokenLabelFor(killteam, activeUnit),
        unitKey: activeUnit.key,
        baseMm: baseSizeMm(activeUnit.opType),
        maxWounds: maxWoundsFor(activeUnit.opType),
        baseLocked: false,
      })
      setPendingUnit(null)
      setEditingKey(activeUnit.key)
      return
    }
    // With Move on, tapping where your operative's move started puts it back there
    // (and makes it ready again).
    if (tool === 'move') {
      const origin = tokens.find(
        (token) =>
          token.seat === seat &&
          token.lastMove &&
          distance(token.lastMove.from, point) <= Math.max(0.5, tokenRadiusIn(token)),
      )
      if (origin) {
        // Drop the brief post-drag hold so the operative isn't drawn where it was.
        setDragPreview(null)
        act({ type: 'token/undoMove', id: origin.id })
        return
      }
    }
    // Otherwise a drag on the empty map pans it (and drops any selection).
    if (['move', 'select', 'token', 'units'].includes(tool) || tool === null) {
      setSelectedId(null)
      gestureRef.current = { type: 'pan', last: { x: event.clientX, y: event.clientY } }
      return
    }
    // Measure is a free ruler: grab an end to stretch it, the middle to slide it,
    // or anywhere else to start a new one. Nothing snaps.
    if (tool === 'measure') {
      const line = overlay?.tool === 'measure' && overlay.points.length === 2 ? overlay.points : null
      const reach = GRAB_PX / viewMetrics(svgRef.current.getBoundingClientRect(), viewRef.current).scale
      const end = line ? [0, 1].find((index) => distance(line[index], point) <= reach) : undefined
      if (end !== undefined) {
        gestureRef.current = { type: 'measure-end', index: end }
        return
      }
      if (line && distanceToSegment(point, line[0], line[1]) <= reach) {
        gestureRef.current = { type: 'measure-slide', grab: point, points: line }
        return
      }
      gestureRef.current = { type: 'measure-end', index: 1 }
      publish({ tool: 'measure', points: [point, point] })
      return
    }
    // Sightline (just the line-of-sight check) and Shoot/Fight (an attack with a
    // weapon): tap an operative, then an enemy. Drag the white point to start the
    // targeting lines from another part of the shooter's base.
    if (tool === 'los' || tool === 'attack') {
      const kind = tool === 'los' ? 'target' : 'attack'
      const current = overlay?.tool === kind ? overlay : null
      const shown = current?.mode === 'fight' ? null : shooterPointOf(current)
      const reach = GRAB_PX / viewMetrics(svgRef.current.getBoundingClientRect(), viewRef.current).scale
      if (shown && distance(shown, point) <= reach) {
        gestureRef.current = { type: 'target-point' }
        return
      }
      const tapped = target?.token
      const alive = tapped?.unitKey && !game.players[tapped.seat]?.unitState?.[tapped.unitKey]?.dead
      if (!alive || tapped.id === current?.shooterId) {
        clearTool()
        setWeaponMenuOpen(false)
        return
      }
      const shooter = tokens.find((token) => token.id === current?.shooterId)
      if (shooter && tapped.seat !== shooter.seat) {
        publish({ ...current, targetId: tapped.id })
      } else if (kind === 'target') {
        publish({ tool: 'target', shooterId: tapped.id, targetId: null, point: null })
      } else {
        // A new attacker: pick its weapon first. It's a fight if an enemy is already
        // within its control range (the switch in the list changes it).
        const engaged = tokens.some(
          (enemy) =>
            enemy.unitKey &&
            enemy.seat &&
            enemy.seat !== tapped.seat &&
            !game.players[enemy.seat]?.unitState?.[enemy.unitKey]?.dead &&
            distance(enemy, tapped) - tokenRadiusIn(enemy) - tokenRadiusIn(tapped) <= 1,
        )
        publish({ tool: 'attack', mode: engaged ? 'fight' : 'shoot', shooterId: tapped.id, targetId: null, point: null, weaponId: null })
        setWeaponMenuOpen(true)
      }
      return
    }
    if (tool === 'ping') {
      publish({ tool: 'ping', ...point })
      window.setTimeout(() => {
        setOverlay((current) => (current?.tool === 'ping' ? null : current))
        sendEphemeral(null)
      }, 2500)
      return
    }
  }

  const moveTool = (event) => {
    const gesture = gestureRef.current
    if (!gesture) return
    const point = toBoard(event.clientX, event.clientY)
    if (gesture.type === 'pan') {
      const rect = svgRef.current.getBoundingClientRect()
      const { scale } = viewMetrics(rect, viewRef.current)
      const dx = (event.clientX - gesture.last.x) / scale
      const dy = (event.clientY - gesture.last.y) / scale
      gesture.last = { x: event.clientX, y: event.clientY }
      setView((current) => ({
        ...current,
        x: clamp(current.x - dx, FULL_VIEW.x, FULL_VIEW.x + FULL_VIEW.w - current.w),
        y: clamp(current.y - dy, FULL_VIEW.y, FULL_VIEW.y + FULL_VIEW.h - current.h),
      }))
    } else if (gesture.type === 'drag-token') {
      gesture.moved = true
      gesture.path = stepPath(gesture.path, point)
      const preview = { id: gesture.id, path: gesture.path, x: point.x, y: point.y }
      setDragPreview(preview)
      sendEphemeral({ tool: 'drag', ...preview })
    } else if (gesture.type === 'drag-free') {
      gesture.moved = true
      gesture.point = point
      if (gesture.trail) gesture.trail = stepPath(gesture.trail, point, TRAIL_STEP)
      const preview = { id: gesture.id, ...point, trail: gesture.trail, origin: gesture.origin }
      setDragPreview(preview)
      sendEphemeral({ tool: 'drag', ...preview })
    } else if (gesture.type === 'measure-end') {
      setOverlay((current) => {
        if (current?.tool !== 'measure') return current
        const points = current.points.map((end, index) => (index === gesture.index ? point : end))
        const next = { tool: 'measure', points }
        sendEphemeral(next)
        return next
      })
    } else if (gesture.type === 'measure-slide') {
      // Slide both ends by the finger's movement, keeping the whole ruler on the mat.
      const [a, b] = gesture.points
      const dx = clamp(point.x - gesture.grab.x, -Math.min(a.x, b.x), BOARD.width - Math.max(a.x, b.x))
      const dy = clamp(point.y - gesture.grab.y, -Math.min(a.y, b.y), BOARD.height - Math.max(a.y, b.y))
      publish({ tool: 'measure', points: gesture.points.map((end) => ({ x: end.x + dx, y: end.y + dy })) })
    } else if (gesture.type === 'target-point') {
      const shooter = tokens.find((token) => token.id === overlay?.shooterId)
      if (!shooter) return
      const inside = clampToBase(shooter, point)
      publish({ ...overlay, point: { dx: inside.x - shooter.x, dy: inside.y - shooter.y } })
    }
  }

  // Starting wounds of one of my operatives, so the server can seed its unit state.
  const maxWoundsOf = (tokenId) => {
    const token = tokens.find((candidate) => candidate.id === tokenId)
    const unit = token?.seat === seat ? roster.find((candidate) => candidate.key === token.unitKey) : null
    return unit ? maxWoundsFor(unit.opType) : undefined
  }

  const activateByTap = (tokenId) => {
    const token = tokens.find((candidate) => candidate.id === tokenId)
    if (!firefight || !token?.unitKey || token.seat !== seat || turn.activeSeat === seat) return
    const status = game.players[seat].unitState?.[token.unitKey]
    if (status?.dead || (status?.activation ?? 'ready') !== 'ready') return
    act({ type: 'unit/update', unitKey: token.unitKey, maxWounds: maxWoundsOf(tokenId), patch: { activation: 'active' } })
  }

  const endTool = () => {
    const gesture = gestureRef.current
    gestureRef.current = null
    if (!gesture) return
    if (gesture.type === 'drag-token') {
      const changed =
        gesture.path.length !== gesture.start.length || gesture.path.at(-1) !== gesture.start.at(-1)
      if (gesture.moved && changed) {
        act({ type: 'token/move', id: gesture.id, path: gesture.path, maxWounds: maxWoundsOf(gesture.id) })
        // Snap to the last locked inch, and hold that until the server echoes it.
        setDragPreview({ id: gesture.id, path: gesture.path })
        window.setTimeout(() => setDragPreview(null), 400)
      } else {
        setDragPreview(null)
        // Tapping your own ready operative activates it without moving (e.g. to shoot).
        if (!gesture.moved) activateByTap(gesture.id)
      }
      sendEphemeral(overlay ?? null)
    }
    if (gesture.type === 'drag-free' && gesture.moved) {
      const host = gesture.attachable ? operativeAt(gesture.point) : null
      act(
        host
          ? { type: gesture.action, id: gesture.id, x: host.x, y: host.y, attachedTo: host.id }
          : { type: gesture.action, id: gesture.id, ...gesture.point },
      )
      sendEphemeral(overlay ?? null)
      setDragPreview((current) => current && { id: current.id, x: current.x, y: current.y })
      window.setTimeout(() => setDragPreview(null), 400)
    }
  }

  const onPointerDown = (event, target = null) => {
    event.stopPropagation()
    svgRef.current.setPointerCapture?.(event.pointerId)
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointersRef.current.size === 2) {
      // Second finger: abandon the tool gesture and zoom instead.
      if (gestureRef.current?.type === 'drag-token' || gestureRef.current?.type === 'drag-free') {
        setDragPreview(null)
        sendEphemeral(overlay ?? null)
      }
      startPinch()
      return
    }
    if (pointersRef.current.size === 1) beginTool(event, target)
  }

  const onPointerMove = (event) => {
    if (!pointersRef.current.has(event.pointerId)) return
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (gestureRef.current?.type === 'pinch') {
      if (pointersRef.current.size === 2) updatePinch()
      return
    }
    moveTool(event)
  }

  const onPointerUp = (event) => {
    pointersRef.current.delete(event.pointerId)
    if (gestureRef.current?.type === 'pinch') {
      if (pointersRef.current.size < 2) gestureRef.current = null
      return
    }
    endTool()
  }

  const clearTool = () => {
    setOverlay(null)
    sendEphemeral(null)
  }

  // Tapping a tool turns it on; tapping it again turns it off. Either way any
  // measurement or sightline is cleared and the selection dropped.
  const selectTool = (next) => {
    clearTool()
    setSelectedId(null)
    endPlacing()
    setWeaponMenuOpen(false)
    setTool(next === tool ? null : next)
  }

  // The Shoot/Fight button reopens the weapon list for the current attacker; with the
  // list open (or no attacker), it turns the tool off.
  const pressAttack = () => {
    if (tool === 'attack' && attacker && !weaponMenuOpen) setWeaponMenuOpen(true)
    else selectTool('attack')
  }

  // Fix the base size of the unit just placed; from now on it can only be moved.
  const lockToken = (token) => {
    if (token && !token.baseLocked) act({ type: 'token/update', id: token.id, baseLocked: true })
  }

  const endPlacing = () => {
    lockToken(editing)
    setEditingKey(null)
    setPendingUnit(null)
    setUnitsOpen(false)
    setTokenMenu(null)
    setPendingEntry(null)
  }

  // Leaving the map mid-placement still locks the base size.
  const lockOnLeaveRef = useRef(null)
  lockOnLeaveRef.current = () => lockToken(editing)
  useEffect(() => () => lockOnLeaveRef.current?.(), [])

  // The Units button: opens the list; with a unit just placed, locks its base and
  // opens the list for the next one; with the list open, turns the tool off.
  const pressUnits = () => {
    if (tool !== 'units') {
      selectTool('units')
      setUnitsOpen(true)
      return
    }
    if (editingKey && unplaced.length) {
      lockToken(editing)
      setEditingKey(null)
      setSelectedId(null)
      setUnitsOpen(true)
      return
    }
    if (pendingUnit && !unitsOpen) {
      setPendingUnit(null)
      setUnitsOpen(true)
      return
    }
    selectTool('units')
  }

  const chooseUnit = (unit) => {
    setPendingUnit(unit)
    setUnitsOpen(false)
  }

  // The Token button: opens the categories; after picking or placing, reopens the
  // last list used; with a list open, turns the tool off.
  const pressToken = () => {
    if (tool !== 'token') {
      selectTool('token')
      setTokenMenu('categories')
      return
    }
    if (tokenMenu) {
      selectTool('token')
      return
    }
    setPendingEntry(null)
    setTokenMenu(lastCategory)
  }

  const openCategory = (menu) => {
    setTokenMenu(menu)
    setLastCategory(menu)
  }

  const chooseEntry = (entry) => {
    setPendingEntry(entry)
    setTokenMenu(null)
  }

  // Tapping your own operative's order tag switches Engage / Conceal.
  const toggleOrder = (event, token) => {
    event.stopPropagation()
    if (token.seat !== seat) return
    const unit = roster.find((candidate) => candidate.key === token.unitKey)
    const order = game.players[seat].unitState?.[token.unitKey]?.order ?? 'conceal'
    act({
      type: 'unit/update',
      unitKey: token.unitKey,
      maxWounds: maxWoundsFor(unit?.opType),
      patch: { order: order === 'engage' ? 'conceal' : 'engage' },
    })
  }

  // Detaching a riding token sets it down just beside its operative.
  const detachSelected = () => {
    const host = tokens.find((token) => token.id === selectedMarker?.attachedTo)
    if (!host) return
    act({
      type: 'marker/update',
      id: selectedMarker.id,
      x: clamp(host.x + tokenRadiusIn(host) + selectedMarker.radius + 0.1, 0, BOARD.width),
      y: host.y,
    })
  }

  const stepBase = (token, direction) => {
    const current = BASE_SIZES_MM.indexOf(token.baseMm ?? DEFAULT_BASE_MM)
    const index =
      current === -1
        ? direction > 0
          ? BASE_SIZES_MM.findIndex((mm) => mm > token.baseMm)
          : BASE_SIZES_MM.findLastIndex((mm) => mm < token.baseMm)
        : current + direction
    const baseMm = BASE_SIZES_MM[index]
    if (baseMm != null) act({ type: 'token/update', id: token.id, baseMm })
  }

  // Lay unplaced operatives out in a grid inside my drop zone, ready to drag.
  // Their bases come from the data and are fixed straight away.
  const placeAll = () => {
    endPlacing()
    const zone = game.table.dropZones[seat]
    const rect = zone ? layout.zones[zone].drop : { x: 1, y: 1, w: BOARD.width - 2, h: 3 }
    const widestBase = Math.max(DEFAULT_BASE_MM, ...unplaced.map((unit) => baseSizeMm(unit.opType)))
    const spacing = Math.max(1.7, baseRadiusIn(widestBase) * 2 + 0.6)
    const columns = Math.max(1, Math.floor(rect.w / spacing))
    const rows = Math.max(1, Math.floor(rect.h / spacing))
    const perRow = rect.w >= rect.h ? columns : Math.min(columns, Math.ceil(unplaced.length / rows))
    unplaced.forEach((unit, index) => {
      const column = index % perRow
      const row = Math.floor(index / perRow)
      act({
        type: 'token/add',
        x: rect.x + spacing * (column + 0.5),
        y: rect.y + rect.h - spacing * (row + 0.5),
        label: tokenLabelFor(killteam, unit),
        unitKey: unit.key,
        baseMm: baseSizeMm(unit.opType),
        maxWounds: maxWoundsFor(unit.opType),
        baseLocked: true,
      })
    })
  }

  const remoteOverlays = Object.entries(ephemerals).flatMap(([owner, payload]) =>
    payload.tool === 'drag'
      ? dragOverlays(payload).map((overlay) => ({ owner, payload: overlay }))
      : [{ owner, payload }],
  )
  const previews = useMemo(() => {
    const next = {}
    Object.values(ephemerals).forEach((payload) => {
      if (payload.tool === 'drag') next[payload.id] = payload
    })
    if (dragPreview) next[dragPreview.id] = dragPreview
    return next
  }, [ephemerals, dragPreview])
  const overlays = [...remoteOverlays, ...(overlay ? [{ owner: seat, payload: overlay }] : [])]
  if (dragPreview) dragOverlays(dragPreview).forEach((overlay) => overlays.push({ owner: seat, payload: overlay }))

  const attacker =
    tool === 'attack' && overlay?.tool === 'attack' ? tokens.find((token) => token.id === overlay.shooterId) ?? null : null
  // The stats drawer: my attack once it has a target and weapon, or one aimed at my operative.
  const attack = useAttack(tool === 'attack' ? overlay : null)

  // Units, Token and Select each pop a panel out beside their button.
  const flyouts = {
    units: unitsOpen ? (
      <UnitsFlyout
        unplaced={unplaced}
        labelFor={(unit) => tokenLabelFor(killteam, unit)}
        onChoose={chooseUnit}
        onPlaceAll={placeAll}
      />
    ) : null,
    token: tokenMenu ? (
      <TokenFlyout categories={categories} menu={tokenMenu} onOpenCategory={openCategory} onChoose={chooseEntry} />
    ) : null,
    select:
      tool === 'select' && selectedItem ? (
        <SelectPanel
          item={selectedItem}
          act={act}
          onRemoved={() => setSelectedId(null)}
          onDetach={detachSelected}
          vantage={
            selected?.unitKey && selected.seat === seat
              ? game.players[seat].unitState?.[selected.unitKey]?.vantage ?? 0
              : null
          }
          onVantage={(vantage) =>
            act({ type: 'unit/update', unitKey: selected.unitKey, maxWounds: maxWoundsOf(selected.id), patch: { vantage } })
          }
        />
      ) : null,
    // Shoot/Fight: the switch, then the attacker's ranged or melee weapons.
    attack:
      attacker && weaponMenuOpen ? (
        <WeaponFlyout
          mode={overlay.mode}
          onMode={(mode) => publish({ ...overlay, mode, weaponId: null })}
          weapons={overlay.mode === 'fight' ? meleeWeaponsFor(game, attacker) : rangedWeaponsFor(game, attacker)}
          selectedId={overlay.weaponId ?? null}
          onChoose={(weaponId) => {
            publish({ ...overlay, weaponId })
            setWeaponMenuOpen(false)
          }}
        />
      ) : null,
  }
  const pressTool = { units: pressUnits, token: pressToken, attack: pressAttack }

  return (
    <section className="map-tab">
      <div className="map-stage">
        <BoardSvg
          game={game}
          hideDead
          svgRef={svgRef}
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          overlays={overlays}
          previews={previews}
          highlightTokenId={selectedId}
          show={{ grid: true, terrain: true, zones: true, objectives: true }}
          onPointerDown={(event) => onPointerDown(event)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onTokenPointerDown={(event, token) => onPointerDown(event, { token })}
          onMarkerPointerDown={(event, marker) => onPointerDown(event, { marker })}
          onOrderTagPointerDown={toggleOrder}
        >
          {editing && !previews[editing.id] ? (
            <BaseSizer token={editing} onStep={(direction) => stepBase(editing, direction)} />
          ) : null}
        </BoardSvg>
      </div>
      <AttackDrawer {...attack} />

      <Drawer
        side="left"
        open={railOpen}
        onToggle={() => setRailOpen((open) => !open)}
        handle={<span aria-hidden="true">{railOpen ? '‹' : '›'}</span>}
        label={railOpen ? 'Hide tools' : 'Show tools'}
        className="tool-drawer"
      >
        <div className="tool-rail">
          {TOOLS.map(([id, label]) => {
            const button = (
              <button
                key={id}
                type="button"
                className={`rail-tool${tool === id ? ' is-selected' : ''}`}
                onClick={() => (pressTool[id] ? pressTool[id]() : selectTool(id))}
                aria-label={label}
                aria-pressed={tool === id}
                aria-expanded={id in flyouts ? Boolean(flyouts[id]) : undefined}
              >
                <ToolIcon tool={id} />
                <span>{label}</span>
              </button>
            )
            if (!(id in flyouts)) return button
            return (
              <div key={id} className="rail-anchor">
                {button}
                {flyouts[id]}
              </div>
            )
          })}
          <span className="rail-divider" />
          <button type="button" className="rail-tool" onClick={() => setView(FULL_VIEW)} aria-label="Fit">
            <ToolIcon tool="fit" />
            <span>Fit</span>
          </button>
          <FullscreenButton variant="rail" />
          {tabs.length > 1 ? (
            <button
              type="button"
              className={`rail-tool${tabsOpen ? ' is-open' : ''}`}
              onClick={() => setTabsOpen((open) => !open)}
              aria-label="Tabs"
              aria-expanded={tabsOpen}
            >
              <ToolIcon tool="tabs" />
              <span>Tabs</span>
            </button>
          ) : null}
        </div>
        {tabsOpen ? (
          <nav className="rail-flyout tab-flyout glass" aria-label="Switch tab">
            {tabs.map((id) => (
              <button
                key={id}
                type="button"
                className={id === 'map' ? 'is-selected' : ''}
                onClick={() => {
                  setTabsOpen(false)
                  if (id !== 'map') onSelectTab(id)
                }}
              >
                {tabLabel(id)}
              </button>
            ))}
          </nav>
        ) : null}
      </Drawer>

    </section>
  )
}

export default MapTab
