import { useId, useMemo } from 'react'
import { SEATS, otherSeat, tokenRadiusIn } from '../../shared/game.js'
import { EDGE_ROTATION, casualtySlots, edgeCasualtyArea } from '../../shared/geometry.js'
import { getKillteamById } from '../data/ktData.js'
import { toOpTypeId } from '../rules/killOpCounts.js'
import { maxWoundsFor } from '../rules/roster.js'
import { BOARD, getLayout, toSvgY } from './boardData.js'
import { isInjured } from './health.js'
import { SKULL_PATH } from './icons.js'
import { NEUTRAL_COLOR, seatColor, zoneOwner } from './colors.js'
import MarkerDisc from './MarkerDisc.jsx'
import OrderTag from './OrderTag.jsx'
import Overlay, { MoveCount } from './Overlay.jsx'
import TokenLabel from './TokenLabel.jsx'
import './board.css'

// Objective markers are 40mm across (core rules); the ring shows the 1" control range from their edge.
const OBJECTIVE_RADIUS = 40 / 25.4 / 2
const H = BOARD.height
const W = BOARD.width

const pointsAttr = (points) => points.map((point) => `${point.x},${toSvgY(point.y)}`).join(' ')

function Zone({ rect, color, className }) {
  if (!rect) return null
  return (
    <rect
      className={className}
      x={rect.x}
      y={H - rect.y - rect.h}
      width={rect.w}
      height={rect.h}
      style={{ '--zone-color': color }}
    />
  )
}

function Grid() {
  const lines = []
  for (let x = 1; x < W; x += 1) {
    lines.push(<line key={`gx${x}`} x1={x} y1={0} x2={x} y2={H} className={x % 6 === 0 ? 'is-major' : ''} />)
  }
  for (let y = 1; y < H; y += 1) {
    lines.push(
      <line key={`gy${y}`} x1={0} y1={H - y} x2={W} y2={H - y} className={y % 6 === 0 ? 'is-major' : ''} />,
    )
  }
  return <g className="board-grid">{lines}</g>
}

// Tokens are positioned by the server; an in-progress drag (local or relayed) overrides it.
// A drag preview is the finger position, or (after release) the end of the locked path.
const previewPoint = (preview) =>
  preview?.x != null ? preview : preview?.path ? preview.path[preview.path.length - 1] : null


// Wound badge: a pill under the base, hidden at full health. Shows wounds as a
// fraction; amber when damaged, red with a soft glow once injured.
const BADGE_HEIGHT = 0.4
const BADGE_FONT = 0.27
const BADGE_CHAR = 0.17

function WoundBadge({ x, cy, r, maxWounds, wounds, glowFilter }) {
  if (wounds >= maxWounds) return null
  const text = `${wounds}/${maxWounds}`
  const injured = isInjured(maxWounds, wounds)
  const width = text.length * BADGE_CHAR + 0.28
  const top = cy + r + 0.06
  const pill = { x: x - width / 2, y: top, width, height: BADGE_HEIGHT, rx: BADGE_HEIGHT / 2 }
  return (
    <g className={`board-token-wounds ${injured ? 'is-injured' : 'is-damaged'}`}>
      {injured ? <rect className="board-token-wounds-glow" {...pill} filter={`url(#${glowFilter})`} /> : null}
      <rect className="board-token-wounds-pill" {...pill} />
      <text
        className="board-token-wounds-text"
        x={x}
        y={top + BADGE_HEIGHT / 2}
        textAnchor="middle"
        dominantBaseline="central"
        style={{ fontSize: BADGE_FONT }}
      >
        {text}
      </text>
    </g>
  )
}

// Where a token is drawn and what state it shows. status is the operative's unit
// state ({ activation, dead, wounds }) or null for blank tokens; dead operatives are
// drawn at their casualty spot.
const tokenView = (token, status, casualty, preview) => {
  const dead = Boolean(status?.dead)
  const point = previewPoint(preview) ?? (dead ? casualty : null)
  const activation = !dead && status ? status.activation : null
  return {
    dead,
    activation,
    x: point?.x ?? token.x,
    cy: toSvgY(point?.y ?? token.y),
    r: tokenRadiusIn(token),
    stateClass: `${dead ? ' is-dead' : ''}${activation ? ` is-${activation}` : ''}`,
  }
}

// Tokens are drawn in three passes across all tokens so overlaps read clearly:
// names at the bottom, then bases (with glow, skull and wound badge), then range rings.
// view.facing turns the name to read from the opponent's seat (see faceOpponent).
function TokenName({ token, view, labelId }) {
  if (!token.label) return null
  return (
    <g
      className={`board-token-name${view.stateClass}`}
      style={{ '--token-color': seatColor(token.seat) }}
      data-facing={view.facing}
      transform={view.facing ? `rotate(${view.facing} ${view.x} ${view.cy})` : undefined}
    >
      <TokenLabel id={labelId} x={view.x} cy={view.cy} r={view.r} text={token.label} />
    </g>
  )
}


// maxWounds: the operative's starting wounds, or null for blank tokens (no badge).
function TokenBody({ token, view, maxWounds, wounds, highlighted, onPointerDown, glowFilter }) {
  const { x, cy, r, dead } = view
  return (
    <g
      className={`board-token${view.stateClass}${highlighted ? ' is-highlighted' : ''}`}
      style={{ '--token-color': seatColor(token.seat) }}
      data-token-id={token.id}
      onPointerDown={onPointerDown ? (event) => onPointerDown(event, token) : undefined}
    >
      {view.activation === 'active' ? (
        <circle className="board-token-glow" cx={x} cy={cy} r={r + 0.12} filter={`url(#${glowFilter})`} />
      ) : null}
      <circle className="board-token-base" cx={x} cy={cy} r={r} />
      {dead ? (
        <path
          className="board-token-skull"
          d={SKULL_PATH}
          fillRule="evenodd"
          transform={`translate(${x} ${cy}) scale(${r * 0.92})`}
        />
      ) : null}
      {maxWounds && !dead ? (
        <g data-facing={view.facing} transform={view.facing ? `rotate(${view.facing} ${x} ${cy})` : undefined}>
          <WoundBadge x={x} cy={cy} r={r} maxWounds={maxWounds} wounds={wounds ?? maxWounds} glowFilter={glowFilter} />
        </g>
      ) : null}
    </g>
  )
}

// An operative that is moving, or holds the latest move, shows its 1" range. A ring
// picked with Select (token.ring) stays until changed. Both are measured from the base edge.
const MOVE_RING_IN = 1

function TokenRange({ token, view, moving }) {
  if (view.dead) return null
  const rings = new Set()
  if (token.ring > 0) rings.add(token.ring)
  if (moving && token.unitKey) rings.add(MOVE_RING_IN)
  return [...rings].map((ring) => (
    <circle
      key={ring}
      className="board-token-ring"
      style={{ '--token-color': seatColor(token.seat) }}
      data-ring-for={token.id}
      data-ring={ring}
      cx={view.x}
      cy={view.cy}
      r={view.r + ring}
    />
  ))
}

// Where things sit around a base (degrees, SVG y-down), clear of the name arc on top
// and the wound badge underneath: the order tag points to the bottom left, riding
// tokens start upper-right and go clockwise.
const ORDER_TAG_ANGLE = 135
const RIDER_START_ANGLE = -35
const RIDER_STEP_ANGLE = 36

function BoardSvg({
  game,
  overlays = [],
  previews = {},
  svgRef,
  viewBox,
  className = '',
  show,
  highlightTokenId = null,
  onTokenPointerDown,
  onMarkerPointerDown,
  // (event, token) when an operative's order tag is tapped; tags are display-only without it.
  onOrderTagPointerDown,
  casualtyAreas,
  // The iPad map leaves dead operatives off entirely; the projector shows them in
  // each player's casualty row.
  hideDead = false,
  // Projector: names, wound badges, order icons and marker text turn to read from
  // the opponent's seat (the owner's opponent's table edge).
  faceOpponent = false,
  children,
  ...svgProps
}) {
  const { table, tokens = [], markers = [], players, settings } = game
  // useId output contains characters that don't belong in a url(#id) fragment.
  const instanceId = `b${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const layout = useMemo(() => getLayout(table.mapId, table.arrangementId), [table.mapId, table.arrangementId])
  const flags = {
    grid: settings?.showGrid ?? true,
    terrain: settings?.showTerrain ?? true,
    zones: settings?.showZones ?? true,
    objectives: settings?.showObjectives ?? true,
    ...show,
  }

  const zoneColor = (zone) => {
    const owner = zoneOwner(table.dropZones, zone)
    return owner ? seatColor(owner) : NEUTRAL_COLOR
  }

  // Starting wounds per operative type, from each player's kill team data.
  const killteamIdA = players?.A?.killteamId
  const killteamIdB = players?.B?.killteamId
  const woundsByType = useMemo(() => {
    const byType = new Map()
    ;[killteamIdA, killteamIdB].forEach((killteamId) => {
      ;(getKillteamById(killteamId)?.opTypes ?? []).forEach((opType) => byType.set(opType.opTypeId, maxWoundsFor(opType)))
    })
    return byType
  }, [killteamIdA, killteamIdB])
  const maxWoundsOf = (token) => (token.unitKey ? woundsByType.get(toOpTypeId(token.unitKey)) ?? null : null)

  const statusFor = (token) =>
    (token.seat && token.unitKey && players?.[token.seat]?.unitState?.[token.unitKey]) || null

  // Each player's dead operatives line up in their casualty area: beside their side
  // panel on the projector (casualtyAreas), otherwise just off their drop-zone edge.
  const casualties = new Map()
  const edges = {}
  SEATS.forEach((seat) => {
    const zone = table.dropZones?.[seat]
    const edge = zone ? layout.zones[zone].edge : seat === 'A' ? 'bottom' : 'top'
    const area = casualtyAreas?.[seat] ?? edgeCasualtyArea(edge, BOARD)
    const dead = tokens
      .filter((token) => token.seat === seat && statusFor(token)?.dead)
      .map((token) => ({ id: token.id, radius: tokenRadiusIn(token) }))
    casualtySlots(dead, area).forEach((slot, id) => casualties.set(id, slot))
    edges[seat] = edge
  })
  // How far each player's pieces turn so their opponent can read them.
  const readAngle = Object.fromEntries(
    SEATS.map((seat) => [seat, faceOpponent ? EDGE_ROTATION[edges[otherSeat(seat)]] ?? 0 : 0]),
  )
  const facingOf = (seat) => readAngle[seat] ?? 0
  const glowFilter = `${instanceId}-glow`
  const tokenViews = tokens
    .map((token) => {
      const status = statusFor(token)
      const view = tokenView(token, status, casualties.get(token.id), previews[token.id])
      // Dead operatives keep their casualty-row layout.
      return { token, status, view: { ...view, facing: view.dead ? 0 : facingOf(token.seat) } }
    })
    .filter(({ view }) => !(hideDead && view.dead))
  const viewById = new Map(tokenViews.map((entry) => [entry.token.id, entry]))

  // Markers riding on an operative follow it (even mid-drag) in slots around its
  // edge; they're hidden while it's dead. A marker being dragged goes where it's dragged.
  const riderIndex = new Map()
  const markerViews = markers.flatMap((marker) => {
    const preview = previews[marker.id]
    if (marker.attachedTo && !previewPoint(preview)) {
      const host = viewById.get(marker.attachedTo)
      if (!host || host.view.dead) return []
      const index = riderIndex.get(marker.attachedTo) ?? 0
      riderIndex.set(marker.attachedTo, index + 1)
      const angle = ((RIDER_START_ANGLE + index * RIDER_STEP_ANGLE + host.view.facing) * Math.PI) / 180
      const distance = host.view.r + marker.radius * 0.35
      return [{
        marker,
        riding: true,
        x: host.view.x + Math.cos(angle) * distance,
        cy: host.view.cy + Math.sin(angle) * distance,
      }]
    }
    return [{ marker, riding: false, x: preview?.x ?? marker.x, cy: toSvgY(preview?.y ?? marker.y) }]
  })
  const renderMarker = ({ marker, x, cy, riding }) => (
    <MarkerDisc
      key={marker.id}
      marker={marker}
      x={x}
      cy={cy}
      riding={riding}
      facing={facingOf(marker.seat)}
      labelId={`${instanceId}-label-${marker.id}`}
      highlighted={marker.id === highlightTokenId}
      onPointerDown={onMarkerPointerDown ? (event) => onMarkerPointerDown(event, marker) : undefined}
    />
  )

  return (
    <svg
      ref={svgRef}
      className={`board-svg ${className}`}
      viewBox={viewBox ?? `0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      {...svgProps}
    >
      <defs>
        <filter id={glowFilter} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="0.1" />
        </filter>
      </defs>
      <rect className="board-mat" x={0} y={0} width={W} height={H} />

      {flags.zones
        ? ['A', 'B'].map((zone) => (
            <g key={zone}>
              <Zone rect={layout.zones[zone].territory} color={zoneColor(zone)} className="board-territory" />
              <Zone rect={layout.zones[zone].drop} color={zoneColor(zone)} className="board-dropzone" />
            </g>
          ))
        : null}

      {flags.grid ? <Grid /> : null}

      <line className="board-centerline" x1={W / 2} y1={0} x2={W / 2} y2={H} />
      <line className="board-centerline" x1={0} y1={H / 2} x2={W} y2={H / 2} />

      {flags.terrain ? (
        <g className="board-terrain">
          {layout.areas.map((area) => (
            <polygon key={area.id} className="board-terrain-area" points={pointsAttr(area.points)} />
          ))}
          {['light', 'heavy', 'door'].map((type) =>
            layout.walls
              .filter((wall) => wall.type === type)
              .map((wall) => (
                <line
                  key={wall.id}
                  className={`board-wall is-${type}`}
                  x1={wall.start.x}
                  y1={toSvgY(wall.start.y)}
                  x2={wall.end.x}
                  y2={toSvgY(wall.end.y)}
                />
              )),
          )}
          {layout.areas.map((area) =>
            area.centroid && area.vantage ? (
              <text
                key={`${area.id}-v`}
                className="board-vantage"
                x={area.centroid.x}
                y={toSvgY(area.centroid.y)}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {area.pieceLabel} · {area.vantage}&quot;
              </text>
            ) : null,
          )}
        </g>
      ) : null}

      {flags.objectives
        ? layout.objectives.map((objective) => {
            const cy = toSvgY(objective.y)
            return (
              <g key={objective.id} className="board-objective">
                <circle className="board-objective-range" cx={objective.x} cy={cy} r={OBJECTIVE_RADIUS + 1} />
                <circle className="board-objective-core" cx={objective.x} cy={cy} r={OBJECTIVE_RADIUS} />
                <path
                  className="board-objective-cross"
                  d={`M${objective.x - OBJECTIVE_RADIUS},${cy} H${objective.x + OBJECTIVE_RADIUS} M${objective.x},${cy - OBJECTIVE_RADIUS} V${cy + OBJECTIVE_RADIUS}`}
                />
              </g>
            )
          })
        : null}

      {tokens.map((token) =>
        token.lastMove && !previews[token.id] && !statusFor(token)?.dead ? (
          <Overlay
            key={`move-${token.id}`}
            owner={token.seat}
            payload={{ tool: 'move', path: token.lastMove.path, settled: true }}
            walls={layout.walls}
          />
        ) : null,
      )}

      {markerViews.filter((entry) => !entry.riding).map(renderMarker)}

      {tokenViews.map(({ token, view }) => (
        <TokenName key={token.id} token={token} view={view} labelId={`${instanceId}-label-${token.id}`} />
      ))}
      {tokenViews.map(({ token, view, status }) => (
        <TokenBody
          key={token.id}
          token={token}
          view={view}
          maxWounds={maxWoundsOf(token)}
          wounds={status?.wounds}
          glowFilter={glowFilter}
          highlighted={token.id === highlightTokenId}
          onPointerDown={onTokenPointerDown}
        />
      ))}
      {tokenViews.map(({ token, view, status }) => {
        if (!token.unitKey || view.dead) return null
        return (
          <OrderTag
            key={token.id}
            tokenId={token.id}
            cx={view.x}
            cy={view.cy}
            r={view.r}
            angle={ORDER_TAG_ANGLE + view.facing}
            iconRotation={view.facing}
            order={status?.order ?? 'conceal'}
            black={(status?.orderFlips ?? 0) % 2 === 1}
            onPointerDown={onOrderTagPointerDown ? (event) => onOrderTagPointerDown(event, token) : undefined}
          />
        )
      })}
      {markerViews.filter((entry) => entry.riding).map(renderMarker)}
      {tokenViews.map(({ token, view }) => (
        <TokenRange
          key={token.id}
          token={token}
          view={view}
          moving={Boolean(previews[token.id] || token.lastMove)}
        />
      ))}

      {markerViews.map(({ marker, x, cy }) =>
        marker.ring > 0 ? (
          <circle
            key={`ring-${marker.id}`}
            className="board-token-ring"
            style={{ '--token-color': seatColor(marker.seat) }}
            data-ring-for={marker.id}
            data-ring={marker.ring}
            cx={x}
            cy={cy}
            r={marker.radius + marker.ring}
          />
        ) : null,
      )}

      {/* A settled move's distance, in the middle of the operative that made it. */}
      {tokenViews.map(({ token, view }) =>
        token.lastMove && !previews[token.id] && !view.dead ? (
          <g key={`count-${token.id}`} className="board-overlay" style={{ '--overlay-color': seatColor(token.seat) }}>
            <MoveCount x={view.x} y={BOARD.height - view.cy} value={token.lastMove.inches} tokenId={token.id} />
          </g>
        ) : null,
      )}

      {overlays.map(({ owner, payload }) => (
        <Overlay key={owner} owner={owner} payload={payload} walls={layout.walls} />
      ))}

      {children}
    </svg>
  )
}

export default BoardSvg
