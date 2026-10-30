import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SEATS } from '../../shared/game.js'
import { computeHomography, toCssMatrix3d } from '../../shared/homography.js'
import { useGame } from '../net/gameContext.js'
import BoardSvg from '../board/BoardSvg.jsx'
import { getLayout } from '../board/boardData.js'
import { computeAttack } from '../rules/shooting/index.js'
import { dragOverlays } from '../board/dragOverlays.js'
import { BOARD } from '../board/boardData.js'
import { seatColor } from '../board/colors.js'
import QrCode from './QrCode.jsx'
import PlayerBoard from './panel/PlayerBoard.jsx'
import { CASUALTY_MARGIN_IN, PANEL_GAP_IN, casualtyAreasFor, panelLayout } from './panelLayout.js'
import { seatUrl, useJoinBase } from './useJoinUrl.js'
import { useLongAbsence } from './useLongAbsence.js'
import Calibrator from './Calibrator.jsx'
import './table.css'

// The projector view. Everything lives on one "table plane" measured in inches
// (PX px per inch) and is warped onto the real table with a homography, so the
// board lands at true scale and side panels sit beside the mat.

const PX = 48

const useWindowSize = () => {
  const [size, setSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }))
  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return size
}

const planeCorners = () => [
  { x: 0, y: 0 },
  { x: BOARD.width * PX, y: 0 },
  { x: BOARD.width * PX, y: BOARD.height * PX },
  { x: 0, y: BOARD.height * PX },
]

// Uncalibrated fallback: fit board (+ panels) centered in the window.
const defaultCorners = ({ width, height }, panelInches) => {
  const margin = panelInches > 0 ? CASUALTY_MARGIN_IN : 0
  const sideIn = panelInches > 0 ? panelInches + PANEL_GAP_IN + margin : 0
  const totalIn = BOARD.width + sideIn * 2
  const totalHeightIn = BOARD.height + margin * 2
  const scale = Math.min(width / totalIn, height / totalHeightIn) * 0.97
  const left = (width - totalIn * scale) / 2 + sideIn * scale
  const top = (height - BOARD.height * scale) / 2
  const right = left + BOARD.width * scale
  const bottom = top + BOARD.height * scale
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ]
}

const cornersToScreen = (normalized, size) =>
  normalized.map((corner) => ({ x: corner.x * size.width, y: corner.y * size.height }))

function JoinOverlay({ game, presence }) {
  const base = useJoinBase()
  return (
    <div className="join-overlay">
      <h1>Kill Team</h1>
      <p>Scan with an iPad to take a seat</p>
      <div className="join-seats">
        {SEATS.map((seat) => {
          const online = presence?.[seat]
          return (
            <div key={seat} className="join-seat" style={{ '--seat-color': seatColor(seat) }}>
              <div className="join-seat-title">{online ? game.players[seat].name : `Player ${seat}`}</div>
              {online ? (
                <div className="join-seat-ok">Connected</div>
              ) : (
                <>
                  <QrCode text={seatUrl(base, seat)} size={220} className="join-qr" />
                  <div className="join-url">{seatUrl(base, seat)}</div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TableMenu({ game, onClose, onCalibrate }) {
  const { act, releaseSeat } = useGame()
  const [confirmReset, setConfirmReset] = useState(false)
  const toggles = [
    ['showGrid', 'Grid'],
    ['showTerrain', 'Terrain outlines'],
    ['showZones', 'Zones'],
    ['showObjectives', 'Objectives'],
    ['showPanels', 'Side panels'],
  ]
  return (
    <div className="table-menu">
      <div className="table-menu-head">
        <strong>Table</strong>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
      {toggles.map(([key, label]) => (
        <label key={key} className="table-menu-toggle">
          <input
            type="checkbox"
            checked={Boolean(game.settings[key])}
            onChange={(event) => act({ type: 'settings/update', patch: { [key]: event.target.checked } })}
          />
          {label}
        </label>
      ))}
      <label className="table-menu-toggle">
        Panel width
        <input
          type="range"
          min={5}
          max={12}
          step={0.5}
          value={game.settings.panelInches}
          onChange={(event) => act({ type: 'settings/update', patch: { panelInches: Number(event.target.value) } })}
        />
        {game.settings.panelInches}&quot;
      </label>
      <button type="button" onClick={onCalibrate}>
        Calibrate projector
      </button>
      {SEATS.map((seat) => (
        <button key={seat} type="button" onClick={() => releaseSeat(seat)}>
          Free seat {seat}
        </button>
      ))}
      {confirmReset ? (
        <button
          type="button"
          className="is-danger"
          onClick={() => {
            act({ type: 'game/reset' })
            setConfirmReset(false)
          }}
        >
          Tap again: start a new game
        </button>
      ) : (
        <button type="button" onClick={() => setConfirmReset(true)}>
          New game
        </button>
      )}
    </div>
  )
}

function TablePage({ calibrating = false }) {
  const { state: game, presence, status, ephemerals, act } = useGame()
  const longGone = useLongAbsence(presence)
  const navigate = useNavigate()
  const size = useWindowSize()
  const [menuOpen, setMenuOpen] = useState(false)
  const [draftCorners, setDraftCorners] = useState(null)

  const settings = game?.settings
  const panelInches = settings?.showPanels ? settings.panelInches : 0
  const savedCorners = settings?.calibration ? cornersToScreen(settings.calibration, size) : null
  const corners = draftCorners ?? savedCorners ?? defaultCorners(size, panelInches)

  const transform = useMemo(() => {
    const h = computeHomography(planeCorners(), corners)
    return h ? toCssMatrix3d(h) : 'none'
  }, [corners])

  useEffect(() => {
    if (!calibrating) setDraftCorners(null)
    else setDraftCorners((current) => current ?? savedCorners ?? defaultCorners(size, panelInches))
    // Only re-seed when entering calibration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calibrating])

  if (!game) {
    return (
      <div className="table-root">
        <div className="table-status">{status === 'offline' ? 'Reconnecting to table server…' : 'Connecting…'}</div>
      </div>
    )
  }

  const overlays = Object.entries(ephemerals)
    .filter(([, payload]) => payload.tool !== 'drag')
    .map(([owner, payload]) => ({ owner, payload }))
  const previews = {}
  Object.entries(ephemerals).forEach(([owner, payload]) => {
    if (payload.tool === 'drag') {
      previews[payload.id] = payload
      dragOverlays(payload).forEach((overlay) => overlays.push({ owner, payload: overlay }))
    }
  })

  // A shot or fight being set up on an iPad: the two players' side bars show it.
  const attackPayload = Object.values(ephemerals).find(
    (payload) => payload.tool === 'attack' && payload.weaponId && payload.targetId,
  )
  const combat = attackPayload
    ? computeAttack({ game, layout: getLayout(game.table.mapId, game.table.arrangementId), payload: attackPayload })
    : null

  const panels = panelLayout(game, panelInches)
  const showPanels = panelInches > 0 && !calibrating
  const casualtyAreas = showPanels ? casualtyAreasFor(panels) : undefined
  // Mid-game, the join codes come back only for an iPad that's been gone a while.
  const showJoin = !calibrating && (game.phase === 'lobby' || longGone.length > 0)
  const panelWidth = panelInches * PX

  return (
    <div className="table-root">
      <div
        className="table-plane"
        style={{ width: BOARD.width * PX, height: BOARD.height * PX, transform }}
      >
        <BoardSvg
          game={game}
          faceOpponent
          overlays={overlays}
          previews={previews}
          className="table-board"
          show={calibrating ? { grid: true } : undefined}
          casualtyAreas={casualtyAreas}
        />
        {calibrating ? <Calibrator.Pattern /> : null}
        {showPanels
          ? ['left', 'right'].map((side) => (
              <div
                key={side}
                className={`table-panel-slot is-${side}`}
                style={{ width: panelWidth, height: BOARD.height * PX, left: panels[side].slot.x0 * PX }}
              >
                <PlayerBoard
                  game={game}
                  seat={panels[side].seat}
                  rotation={panels[side].rotation}
                  connected={Boolean(presence?.[panels[side].seat])}
                  widthPx={panelWidth}
                  heightPx={BOARD.height * PX}
                  combat={combat}
                />
              </div>
            ))
          : null}
      </div>

      {showJoin ? <JoinOverlay game={game} presence={presence} /> : null}

      {calibrating ? (
        <Calibrator
          corners={corners}
          onChange={setDraftCorners}
          onSave={() => {
            act({
              type: 'settings/update',
              patch: {
                calibration: corners.map((corner) => ({ x: corner.x / size.width, y: corner.y / size.height })),
              },
            })
            navigate('/table')
          }}
          onReset={() => {
            act({ type: 'settings/update', patch: { calibration: null } })
            setDraftCorners(defaultCorners(size, panelInches))
          }}
          onCancel={() => navigate('/table')}
        />
      ) : null}

      {status !== 'online' ? <div className="table-offline">Reconnecting…</div> : null}

      {!calibrating ? (
        <button type="button" className="table-menu-button" onClick={() => setMenuOpen((open) => !open)}>
          ☰
        </button>
      ) : null}
      {menuOpen && !calibrating ? (
        <TableMenu
          game={game}
          onClose={() => setMenuOpen(false)}
          onCalibrate={() => {
            setMenuOpen(false)
            navigate('/table/calibrate')
          }}
        />
      ) : null}
    </div>
  )
}

export default TablePage
