import { SEATS } from '../../shared/game.js'
import { panelCasualtyArea } from '../../shared/geometry.js'
import { BOARD, getLayout } from '../board/boardData.js'

// Player boards sit at the left and right ends of the mat, each turned to face its
// player. All values are in inches on the table plane.

export const PANEL_GAP_IN = 0.5
// Room around board + panels for the dead-operative rows beside each panel.
export const CASUALTY_MARGIN_IN = 1.6

const ROTATION_BY_EDGE = { bottom: 0, top: 180, left: 90, right: -90 }

// { left, right }: which seat each panel belongs to, its rotation toward that
// player, and its x range on the table.
export const panelLayout = (game, panelInches) => {
  const layout = getLayout(game.table.mapId, game.table.arrangementId)
  const edgeFor = (seat) => {
    const zone = game.table.dropZones[seat]
    return zone ? layout.zones[zone].edge : seat === 'A' ? 'bottom' : 'top'
  }
  const leftSeat = SEATS.find((seat) => ['left', 'bottom'].includes(edgeFor(seat))) ?? 'A'
  const rightSeat = leftSeat === 'A' ? 'B' : 'A'
  return {
    left: {
      seat: leftSeat,
      rotation: ROTATION_BY_EDGE[edgeFor(leftSeat)],
      slot: { x0: -(panelInches + PANEL_GAP_IN), x1: -PANEL_GAP_IN },
    },
    right: {
      seat: rightSeat,
      rotation: ROTATION_BY_EDGE[edgeFor(rightSeat)],
      slot: { x0: BOARD.width + PANEL_GAP_IN, x1: BOARD.width + PANEL_GAP_IN + panelInches },
    },
  }
}

// Dead operatives go to the left of each player's board, as that player sees it.
export const casualtyAreasFor = (panels) =>
  Object.fromEntries(
    ['left', 'right'].map((side) => [
      panels[side].seat,
      panelCasualtyArea(panels[side].slot, panels[side].rotation, BOARD),
    ]),
  )
