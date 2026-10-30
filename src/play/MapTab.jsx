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
import { MARKER_SIZES_MM, categoriesFor, radiusFor } from '../data/tokenCatalog.js'
import { maxWoundsFor, tokenLabelFor } from '../rules/roster.js'
import Drawer from './Drawer.jsx'
import FullscreenButton from './FullscreenButton.jsx'
import { TokenFlyout, UnitsFlyout } from './RailFlyouts.jsx'
import VantageMark from './VantageMark.jsx'
import { NextTpRailButton } from './NextTp.jsx'
import UnitCardModal from './UnitCardModal.jsx'
import WeaponChooser from './WeaponChooser.jsx'
import { meleeWeaponsFor, rangedWeaponsFor } from '../rules/weaponRules.js'
import AttackDrawer from './AttackDrawer.jsx'
import ToolIcon from './ToolIcon.jsx'
import { usePlayer } from './usePlayer.js'
import { useAttack } from './useAttack.js'

// The iPad is the controller: everything drawn here is streamed to the projector.
// One finger uses the active tool; two fingers pan/zoom the iPad view only.
// With no tool on: tap an operative for a ring of its actions, tap the map to ping,
// and drag anywhere to measure (from an operative's base if the drag starts on one;
// the operative stays put).

// Move, Measure, Sightline, Shoot and Fight are opened from an operative's action ring,
// not the rail (and with no tool on, a drag measures anyway and a tap pings).
const TOOLS = [
  ['units', 'Units'],
  ['token', 'Token'],
]

// Tools in which dragging a token or marker moves it.
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
// A finger that moves less than this (screen pixels) is a tap, not a drag.
const TAP_SLOP_PX = 8
// The action ring around a tapped operative: its smallest radius (it widens so its
// buttons never overlap), and its buttons (own: only for your own operatives).
const RADIAL_PX = 78
const radialReach = (count) => Math.max(RADIAL_PX, Math.ceil((count * 70) / (2 * Math.PI)))
// Room kept around the ring's centre so even a full ring stays on screen.
const RADIAL_ROOM = radialReach(10) + 36
// Range: the ring drawn around an operative, in inches (0 = none).
const RANGES = [0, 1, 2, 3, 6]
// Vantage: which floor of Vantage terrain an operative is on, and the height the rules
// use for it (inches up; see shared/targeting.js).
const FLOORS = [
  { height: 0, floor: 0, label: 'Ground' },
  { height: 2, floor: 1, label: '1st floor' },
  { height: 4, floor: 2, label: '2nd floor' },
]
// An opponent's operative offers only Ping and Unit card.
const RADIAL_ACTIONS = [
  { id: 'move', label: 'Move', icon: 'move', own: true },
  { id: 'measure', label: 'Measure', icon: 'measure', own: true },
  { id: 'los', label: 'Sightline', icon: 'los', own: true },
  { id: 'shoot', label: 'Shoot', icon: 'attack', own: true },
  { id: 'fight', label: 'Fight', icon: 'fight', own: true },
  { id: 'range', label: 'Range', icon: 'range', own: true },
  { id: 'vantage', label: 'Vantage', icon: 'vantage', own: true },
  { id: 'edit', label: 'Edit', icon: 'edit', own: true },
  { id: 'ping', label: 'Ping', icon: 'ping' },
  { id: 'card', label: 'Unit card', icon: 'card' },
]

// Everything else on the board (markers, tokens, blank bases) has a smaller ring.
const ITEM_ACTIONS = [
  { id: 'move', label: 'Move', icon: 'move' },
  { id: 'range', label: 'Range', icon: 'range' },
  { id: 'edit', label: 'Edit', icon: 'edit' },
  { id: 'ping', label: 'Ping', icon: 'ping' },
]
const MM_PER_IN = 25.4

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
  // null = no tool: tap an operative for its actions, tap the map to ping, drag to
  // measure, two fingers to pan and zoom.
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
  // The action ring: { tokenId (an operative, token or marker), menu, x, y (its centre
  // in map-stage pixels) }, or null.
  const [radial, setRadial] = useState(null)
  // The operative whose unit card is open (by token id), from the action ring.
  const [cardFor, setCardFor] = useState(null)
  const stageRef = useRef(null)
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
  // Operatives are only set up before the battle (core rules), so no Units tool after.
  const tools = TOOLS.filter(([id]) => id !== 'units' || game.phase !== 'battle')
  if (tool === 'units' && game.phase === 'battle') setTool(null)

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

  const ping = (point) => {
    publish({ tool: 'ping', ...point })
    window.setTimeout(() => {
      setOverlay((current) => (current?.tool === 'ping' ? null : current))
      sendEphemeral(null)
    }, 2500)
  }

  // Open the action ring around an operative (or a marker or token), kept fully on
  // screen and clear of the tool drawer on the left.
  const openRadial = (token) => {
    const svgRect = svgRef.current.getBoundingClientRect()
    const stageRect = stageRef.current.getBoundingClientRect()
    const railRect = stageRef.current.parentElement.querySelector('.tool-drawer')?.getBoundingClientRect()
    const railRight = railRect ? Math.max(0, railRect.right - stageRect.left) : 0
    const { scale, offX, offY } = viewMetrics(svgRect, viewRef.current)
    const room = RADIAL_ROOM
    setRadial({
      tokenId: token.id,
      menu: 'main',
      x: clamp(offX + (token.x - viewRef.current.x) * scale - stageRect.left, railRight + room, stageRect.width - room),
      y: clamp(offY + (toSvgY(token.y) - viewRef.current.y) * scale - stageRect.top, room, stageRect.height - room),
    })
  }

  // ---- two-finger pan/zoom ----
  const startPinch = () => {
    setRadial(null)
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

    // No tool: wait to see whether this is a tap or a drag (see moveTool / endTool).
    // A touch while the action ring is open closes it, unless it's on something else
    // with a ring (a tap there opens that one's ring).
    if (tool === null) {
      const token = target?.token?.unitKey ? target.token : null
      const item = target?.token ?? target?.marker ?? null
      if (radial) {
        setRadial(null)
        if (!item || item.id === radial.tokenId) {
          gestureRef.current = { type: 'dismiss' }
          return
        }
      }
      clearTool()
      gestureRef.current = { type: 'press', from: point, screen: { x: event.clientX, y: event.clientY }, token, item }
      return
    }

    // An armed token dropped on an operative rides on it.
    if (target?.token && tool === 'token' && pendingEntry?.kind === 'token' && target.token.unitKey) {
      placeEntry(pendingEntry, point, target.token)
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
        gestureRef.current = {
          type: 'drag-free',
          id: target.token.id,
          action: 'token/update',
          trail,
          origin,
          moved: false,
          screen: { x: event.clientX, y: event.clientY },
          ring: tool === 'move',
        }
        return
      }
      // Operative tokens follow the finger smoothly; their path locks in at each full inch. follows the finger smoothly; its path locks in at each full inch.
      // Dragging an operative that already moved this TP continues that movement.
      const path = target.token.lastMove?.path ?? [{ x: target.token.x, y: target.token.y }]
      gestureRef.current = {
        type: 'drag-token',
        id: target.token.id,
        path,
        start: path,
        moved: false,
        screen: { x: event.clientX, y: event.clientY },
        // With Move on, a tap (no drag) goes back to the operative's action ring.
        ring: tool === 'move',
      }
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
        screen: { x: event.clientX, y: event.clientY },
        ring: tool === 'move',
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
    if (['move', 'token', 'units'].includes(tool)) {
      setSelectedId(null)
      gestureRef.current = { type: 'pan', last: { x: event.clientX, y: event.clientY }, start: { x: event.clientX, y: event.clientY }, moved: false }
      return
    }
    // Measure is a free ruler: grab an end to stretch it, the middle to slide it, or
    // anywhere else to start a new one (from an operative's base if on one). Nothing
    // snaps. What a press does is only decided once it moves: a tap on an operative
    // opens its action ring instead, and a tap on the empty map ends measuring.
    if (tool === 'measure') {
      const line = overlay?.tool === 'measure' && overlay.points.length === 2 ? overlay.points : null
      const reach = GRAB_PX / viewMetrics(svgRef.current.getBoundingClientRect(), viewRef.current).scale
      const end = line ? [0, 1].find((index) => distance(line[index], point) <= reach) : undefined
      const token = target?.token?.unitKey ? target.token : null
      // A ruler just started from an operative's action ring: the first drag pulls it out.
      const pending =
        line && line[0].x === line[1].x && line[0].y === line[1].y && overlay.anchorId
          ? tokens.find((candidate) => candidate.id === overlay.anchorId)
          : null
      const anchor = pending ?? token
      let plan
      if (!pending && end !== undefined) plan = { type: 'measure-end', index: end }
      else if (!pending && line && distanceToSegment(point, line[0], line[1]) <= reach) plan = { type: 'measure-slide', grab: point, points: line }
      else plan = { type: 'measure-end', index: 1, anchor, initial: [anchor ? defaultShooterPoint(anchor, point) : point, point] }
      gestureRef.current = { type: 'measure-press', plan, token, screen: { x: event.clientX, y: event.clientY } }
      return
    }
    // Sightline (just the line-of-sight check) and Shoot/Fight (an attack with a
    // weapon), started from an operative's action ring: tap an enemy to target it. Drag
    // the white point to start the targeting lines from another part of the shooter's base.
    if (tool === 'los' || tool === 'attack') {
      const kind = tool === 'los' ? 'target' : 'attack'
      const current = overlay?.tool === kind ? overlay : null
      const shown = current?.mode === 'fight' ? null : shooterPointOf(current)
      const reach = GRAB_PX / viewMetrics(svgRef.current.getBoundingClientRect(), viewRef.current).scale
      const tapped = target?.token
      const alive = tapped?.unitKey && !game.players[tapped.seat]?.unitState?.[tapped.unitKey]?.dead
      const shooter = tokens.find((token) => token.id === current?.shooterId)
      // The white point sits on the shooter's base: dragging it moves where the lines
      // start; just tapping it is a tap on the shooter.
      if (shown && distance(shown, point) <= reach) {
        gestureRef.current = { type: 'target-point', screen: { x: event.clientX, y: event.clientY }, moved: false, shooterId: shooter?.id }
        return
      }
      // A tap on the shooter or another operative on its side opens that operative's
      // action ring (closing the tool); an enemy is the target; a tap off any operative
      // ends the tool.
      if (!alive) leaveTool()
      else if (!shooter || tapped.seat === shooter.seat) ringFor(tapped.id)
      else publish({ ...current, targetId: tapped.id })
      return
    }
  }

  const moveTool = (event) => {
    const gesture = gestureRef.current
    if (!gesture) return
    const point = toBoard(event.clientX, event.clientY)
    // A finger that hasn't gone past the tap slop yet is still a tap.
    const origin = gesture.screen ?? gesture.start
    if (origin && !gesture.moved && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) < TAP_SLOP_PX) return
    if (gesture.type === 'measure-press') {
      // It's a drag: carry out what the press was for.
      gestureRef.current = gesture.plan
      if (gesture.plan.initial) publish({ tool: 'measure', points: gesture.plan.initial })
      moveTool(event)
      return
    }
    if (gesture.type === 'press') {
      // A drag: measure. From an operative it starts at the edge of its base (distances
      // are measured from bases), and the operative doesn't move.
      const anchor = gesture.token
      gestureRef.current = { type: 'measure-end', index: 1, anchor }
      publish({ tool: 'measure', points: [anchor ? defaultShooterPoint(anchor, point) : gesture.from, point] })
      return
    }
    if (gesture.type === 'pan') {
      gesture.moved = true
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
        // Measuring from an operative: keep the start on its base edge, facing the end.
        if (gesture.anchor && gesture.index === 1) points[0] = defaultShooterPoint(gesture.anchor, point)
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
      gesture.moved = true
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
    // The white point tapped, not dragged: that's a tap on the shooter.
    if (gesture.type === 'target-point' && !gesture.moved && gesture.shooterId) {
      ringFor(gesture.shooterId)
      return
    }
    // Measure, and the finger didn't move: an operative's actions, or done measuring.
    if (gesture.type === 'measure-press') {
      if (gesture.token) ringFor(gesture.token.id)
      else leaveTool()
      return
    }
    // No tool, and the finger didn't move: something's actions, or a ping.
    if (gesture.type === 'press') {
      if (gesture.item) openRadial(gesture.item)
      else ping(gesture.from)
      return
    }
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
        if (!gesture.moved) {
          // A tap: with Move on, back to the operative's actions; otherwise (Token or
          // Units on) tapping your own ready operative activates it without moving.
          if (gesture.ring) ringFor(gesture.id)
          else activateByTap(gesture.id)
        }
      }
      sendEphemeral(overlay ?? null)
    }
    if (gesture.type === 'drag-free' && !gesture.moved && gesture.ring) ringFor(gesture.id)
    // A tap on the empty map with Move on: done moving, back to no tool.
    if (gesture.type === 'pan' && !gesture.moved && tool === 'move') leaveTool()
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
    setRadial(null)
    clearTool()
    setSelectedId(null)
    endPlacing()
    setWeaponMenuOpen(false)
    setTool(next === tool ? null : next)
  }

  // Back to no tool (from one opened by the action ring).
  const leaveTool = () => {
    clearTool()
    setSelectedId(null)
    endPlacing()
    setWeaponMenuOpen(false)
    setTool(null)
  }

  // An operative, token or marker by id.
  const itemById = (id) => tokens.find((token) => token.id === id) ?? game.markers.find((marker) => marker.id === id) ?? null

  // Leave the current tool and open the action ring on this operative (or marker or
  // token) instead.
  const ringFor = (id) => {
    const item = itemById(id)
    leaveTool()
    if (item) openRadial(item)
  }

  // A button in an operative's action ring: switch to that tool, already aimed at it.
  // Moving, shooting or fighting with your own ready operative in the Firefight phase
  // activates it.
  const runAction = (id, token) => {
    // Some open a second ring of choices instead.
    if (id === 'range' || id === 'vantage' || id === 'edit') {
      setRadial((current) => current && { ...current, menu: id })
      return
    }
    if (id === 'card') {
      setRadial(null)
      setCardFor(token.id)
      return
    }
    // Ping marks the operative on the projector; the tool stays as it is.
    if (id === 'ping') {
      setRadial(null)
      ping({ x: token.x, y: token.y })
      return
    }
    if (['move', 'shoot', 'fight'].includes(id)) activateByTap(token.id)
    setRadial(null)
    clearTool()
    endPlacing()
    setWeaponMenuOpen(false)
    setSelectedId(id === 'move' ? token.id : null)
    if (id === 'move') {
      setTool(id)
    } else if (id === 'measure') {
      setTool('measure')
      publish({ tool: 'measure', points: [{ x: token.x, y: token.y }, { x: token.x, y: token.y }], anchorId: token.id })
    } else if (id === 'los') {
      setTool('los')
      publish({ tool: 'target', shooterId: token.id, targetId: null, point: null })
    } else {
      setTool('attack')
      publish({ tool: 'attack', mode: id, shooterId: token.id, targetId: null, point: null, weaponId: null })
      setWeaponMenuOpen(true)
    }
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
  const detachMarker = (marker) => {
    const host = tokens.find((token) => token.id === marker?.attachedTo)
    if (!host) return
    act({
      type: 'marker/update',
      id: marker.id,
      x: clamp(host.x + tokenRadiusIn(host) + marker.radius + 0.1, 0, BOARD.width),
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

  // An attack's screens (the lines here and on the projector, the side bars and both
  // stats drawers) go once it's over: when the attacker's activation ends (it's marked
  // expended), or once another operative activates after its target was taken out.
  // These are changes, not states: a counteracting operative is already expended.
  const aiming = (tool === 'attack' || tool === 'los') && overlay?.shooterId ? overlay : null
  const unitOf = (id) => {
    const token = tokens.find((candidate) => candidate.id === id)
    return token?.unitKey ? game.players[token.seat]?.unitState?.[token.unitKey] ?? {} : null
  }
  const shooterActivation = aiming ? unitOf(aiming.shooterId)?.activation ?? 'ready' : null
  const targetDead = Boolean(aiming?.targetId && unitOf(aiming.targetId)?.dead)
  const othersActive = tokens
    .filter((token) => token.id !== aiming?.shooterId && unitOf(token.id)?.activation === 'active')
    .map((token) => token.id)
    .join(',')
  const lastAimRef = useRef(null)
  useEffect(() => {
    const before = lastAimRef.current
    lastAimRef.current = aiming ? { shooterId: aiming.shooterId, shooterActivation, othersActive } : null
    if (!aiming || before?.shooterId !== aiming.shooterId) return
    const activationEnded = before.shooterActivation !== 'expended' && shooterActivation === 'expended'
    const nextActivation = targetDead && othersActive && othersActive !== before.othersActive
    // The game moved on (server state), so this device's tool follows.
    if (activationEnded || nextActivation) leaveTool()
  })

  // Units and Token each pop a panel out beside their button.
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
  }
  const pressTool = { units: pressUnits, token: pressToken }
  // Shoot or Fight: the attacker's ranged or melee weapons, full screen. Cancel ends it.
  const weaponMenu =
    attacker && weaponMenuOpen ? (
      <WeaponChooser
        mode={overlay.mode}
        operativeName={attacker.label}
        weapons={overlay.mode === 'fight' ? meleeWeaponsFor(game, attacker) : rangedWeaponsFor(game, attacker)}
        selectedId={overlay.weaponId ?? null}
        onChoose={(weaponId) => {
          publish({ ...overlay, weaponId })
          setWeaponMenuOpen(false)
        }}
        onClose={leaveTool}
      />
    ) : null
  const radialToken = radial ? itemById(radial.tokenId) : null
  // What the ring is on: an operative, or a marker / token / blank base (which change
  // with marker/... or token/... actions).
  const radialIsMarker = Boolean(radialToken) && !tokens.includes(radialToken)
  const radialIsOperative = Boolean(radialToken?.unitKey) && !radialIsMarker
  const updateRadial = (patch) => act({ type: `${radialIsMarker ? 'marker' : 'token'}/update`, id: radialToken.id, ...patch })
  const cardToken = cardFor ? tokens.find((token) => token.id === cardFor && token.unitKey) ?? null : null
  // What the ring shows: the operative's actions, or one of its second rings of choices.
  //   [{ key, label, icon?, mark? (a graphic instead of the icon), text? (shown big
  //   instead of an icon and label), caption? (shown instead of the label), selected?, run }]
  const back = { key: 'back', label: 'Back', icon: 'back', run: () => setRadial((current) => ({ ...current, menu: 'main' })) }
  const ringItems = () => {
    if (!radialToken) return []
    if (radial.menu === 'range') {
      return [
        ...RANGES.map((inches) => ({
          key: `range-${inches}`,
          label: inches ? `${inches}" range` : 'No range',
          text: inches ? `${inches}"` : 'Off',
          selected: (radialToken.ring ?? 0) === inches,
          run: () => {
            updateRadial({ ring: inches })
            setRadial(null)
          },
        })),
        back,
      ]
    }
    if (radial.menu === 'vantage') {
      const height = game.players[radialToken.seat]?.unitState?.[radialToken.unitKey]?.vantage ?? 0
      return [
        ...FLOORS.map((floor) => ({
          key: `floor-${floor.height}`,
          label: floor.label,
          mark: <VantageMark floor={floor.floor} />,
          caption: floor.label,
          selected: height === floor.height,
          run: () => {
            act({
              type: 'unit/update',
              unitKey: radialToken.unitKey,
              maxWounds: maxWoundsOf(radialToken.id),
              patch: { vantage: floor.height },
            })
            setRadial(null)
          },
        })),
        back,
      ]
    }
    // Edit: the operative's name, base size and removal, each with its own ring (as in
    // the Select panel).
    const openMenu = (menu) => () => setRadial((current) => ({ ...current, menu }))
    if (radial.menu === 'edit') {
      return [
        { key: 'name', label: 'Name', icon: 'name', run: openMenu('name') },
        { key: 'base', label: radialIsOperative ? 'Base size' : 'Size', icon: 'base', run: openMenu('base') },
        // What Select used to offer for an operative that has moved.
        ...(radialIsOperative && radialToken.lastMove
          ? [
              {
                key: 'undo-step',
                label: 'Undo 1"',
                icon: 'back',
                run: () => {
                  act({ type: 'token/undoStep', id: radialToken.id })
                  setRadial(null)
                },
              },
              {
                key: 'undo-move',
                label: 'Undo move',
                icon: 'back',
                run: () => {
                  act({ type: 'token/undoMove', id: radialToken.id })
                  setRadial(null)
                },
              },
            ]
          : []),
        ...(radialToken.attachedTo
          ? [
              {
                key: 'detach',
                label: 'Detach',
                icon: 'back',
                run: () => {
                  detachMarker(radialToken)
                  setRadial(null)
                },
              },
            ]
          : []),
        { key: 'remove', label: 'Remove', icon: 'remove', run: openMenu('remove') },
        back,
      ]
    }
    const backToEdit = { ...back, run: openMenu('edit') }
    // Markers and tokens are discs sized in mm across.
    if (radial.menu === 'base' && radialIsMarker) {
      const current = radialToken.radius * 2 * MM_PER_IN
      return [
        ...MARKER_SIZES_MM.map((mm) => ({
          key: `size-${mm}`,
          label: `${mm}mm`,
          text: String(mm),
          selected: Math.abs(current - mm) < 0.05,
          run: () => {
            updateRadial({ radius: mm / MM_PER_IN / 2 })
            setRadial(null)
          },
        })),
        backToEdit,
      ]
    }
    if (radial.menu === 'base') {
      const current = radialToken.baseMm ?? DEFAULT_BASE_MM
      return [
        ...BASE_SIZES_MM.map((mm) => ({
          key: `base-${mm}`,
          label: `${mm}mm base`,
          text: String(mm),
          selected: current === mm,
          run: () => {
            updateRadial({ baseMm: mm })
            setRadial(null)
          },
        })),
        backToEdit,
      ]
    }
    if (radial.menu === 'remove') {
      return [
        {
          key: 'remove-yes',
          label: 'Remove',
          icon: 'remove',
          danger: true,
          run: () => {
            act({ type: `${radialIsMarker ? 'marker' : 'token'}/remove`, id: radialToken.id })
            setRadial(null)
          },
        },
        { ...backToEdit, key: 'remove-no', label: 'Keep' },
      ]
    }
    const actions = radialIsOperative ? RADIAL_ACTIONS.filter((action) => !action.own || radialToken.seat === seat) : ITEM_ACTIONS
    return actions.map((action) => ({
      key: action.id,
      label: action.label,
      icon: action.icon,
      run: () => runAction(action.id, radialToken),
    }))
  }
  const radialItems = radial?.menu === 'name' ? [] : ringItems()
  const reach = radialReach(radialItems.length)

  return (
    <section className="map-tab">
      <div className="map-stage" ref={stageRef}>
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
        {radialToken ? (
          <div
            className="unit-radial"
            data-ring-for={radialToken.id}
            data-menu={radial.menu}
            style={{ left: radial.x, top: radial.y }}
            role="menu"
            aria-label={`${radialToken.label || (radialIsOperative ? 'Operative' : 'Token')} actions`}
          >
            {radial.menu === 'name' ? (
              <form
                className="unit-radial-name glass"
                onSubmit={(event) => {
                  event.preventDefault()
                  const label = new FormData(event.currentTarget).get('label').trim()
                  // A renamed marker shows its new name rather than its short code.
                  if (label !== radialToken.label) updateRadial(radialIsMarker ? { label, short: '' } : { label })
                  setRadial(null)
                }}
              >
                <input name="label" defaultValue={radialToken.label} maxLength={24} aria-label="Name" autoFocus />
                <button type="submit" className="btn is-primary">
                  Done
                </button>
              </form>
            ) : null}
            {radialItems.map((item, index) => (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                className={`unit-radial-button glass${item.selected ? ' is-selected' : ''}${item.danger ? ' is-danger' : ''}`}
                style={{
                  left: reach * Math.cos(((-90 + (index * 360) / radialItems.length) * Math.PI) / 180),
                  top: reach * Math.sin(((-90 + (index * 360) / radialItems.length) * Math.PI) / 180),
                }}
                onClick={item.run}
                aria-label={item.label}
                aria-pressed={item.selected ?? undefined}
              >
                {item.mark ?? (item.text ? <span className="unit-radial-text">{item.text}</span> : <ToolIcon tool={item.icon} />)}
                {item.text ? null : <span>{item.caption ?? item.label}</span>}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {weaponMenu}
      {cardToken ? <UnitCardModal token={cardToken} onClose={() => setCardFor(null)} /> : null}
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
          {tools.map(([id, label]) => {
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
          {game.phase === 'battle' ? <NextTpRailButton /> : null}
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
