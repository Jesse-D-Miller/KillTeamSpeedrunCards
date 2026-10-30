import { expect, test } from '@playwright/test'

// Full table flow with three devices: projector + two iPads.
// Screenshots land in test-results/flow-*.png for eyeballing layouts.

const IPAD = { width: 1180, height: 820 }
const PROJECTOR = { width: 1920, height: 1080 }

const shot = (page, name) => page.screenshot({ path: `test-results/flow-${name}.png` })

// On the map, tabs are switched from the left rail's Tabs flyout; elsewhere from the tab bar.
const openTab = async (page, name) => {
  if (await page.locator('.tool-rail').isVisible()) {
    await page.getByRole('button', { name: 'Tabs', exact: true }).click()
    await page.locator('.tab-flyout button', { hasText: name }).click()
  } else {
    await page.locator('.play-tabs button', { hasText: name }).click()
  }
}

// Player boards must never spill text or graphics out of their boxes (or into their
// bottom padding, which scroll sizes don't count for flex columns).
const boardOverflows = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.pb-board .pb-section, .pb-board .pb-critop-body, .pb-board .pb-tacop')]
      .filter((el) => {
        if (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1) return true
        const last = el.lastElementChild
        if (!last || last.offsetParent !== el.offsetParent) return false
        const style = getComputedStyle(el)
        const limit = el.offsetTop + el.offsetHeight - parseFloat(style.borderBottomWidth) - parseFloat(style.paddingBottom)
        // Offsets are whole pixels (the same 2px tolerance as useBoardFit).
        return last.offsetTop + last.offsetHeight > limit + 2
      })
      .map((el) => `${el.closest('.pb-board').dataset.seat}:${el.className}`),
  )

const readyUp = async (...pages) => {
  for (const page of pages) {
    await page.locator('.play-header').getByRole('button', { name: /^(Ready|Waiting for)/ }).click()
  }
}

// Send actions straight to the table server as the projector (test setup).
const tableActions = (table, actions) =>
  table.evaluate(
    (list) =>
      new Promise((resolve) => {
        const socket = new WebSocket(`ws://${window.location.host}/ws`)
        socket.onopen = () => {
          socket.send(JSON.stringify({ type: 'hello', role: 'table' }))
          list.forEach((action) => socket.send(JSON.stringify({ type: 'action', action })))
          setTimeout(() => {
            socket.close()
            resolve()
          }, 300)
        }
      }),
    actions,
  )

const dragOnMap = async (page, from, to) => {
  const box = await page.locator('.map-stage svg').boundingBox()
  const at = (fx, fy) => [box.x + box.width * fx, box.y + box.height * fy]
  await page.mouse.move(...at(...from))
  await page.mouse.down()
  for (let step = 1; step <= 8; step += 1) {
    const t = step / 8
    await page.mouse.move(...at(from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t))
  }
  await page.mouse.up()
}

// Tap an operative on an iPad's map and pick one of its actions from the ring (using
// its ring if that's already open).
const ringAction = async (page, tokenId, action) => {
  const ring = page.locator(`.unit-radial[data-ring-for="${tokenId}"]`)
  if (!(await ring.count())) await page.locator(`.map-stage [data-token-id="${tokenId}"] .board-token-base`).click()
  await ring.getByRole('menuitem', { name: action, exact: true }).click()
}

// A spot on an iPad's mat with no token or marker under it (for taps on the empty map).
const emptySpotOf = async (page) => {
  const box = await page.locator('.map-stage .board-svg').boundingBox()
  return page.evaluate(({ x, y, width, height }) => {
    for (const [fx, fy] of [[0.5, 0.5], [0.5, 0.3], [0.5, 0.7], [0.62, 0.5], [0.4, 0.4], [0.6, 0.6], [0.75, 0.9]]) {
      const point = [x + width * fx, y + height * fy]
      const hit = document.elementFromPoint(...point)
      if (hit?.closest('.board-svg') && !hit.closest('.board-token, .board-marker, .unit-radial')) return point
    }
    return null
  }, box)
}

test('projector + two iPads play through setup into battle', async ({ browser }) => {
  const tableContext = await browser.newContext({ viewport: PROJECTOR })
  const table = await tableContext.newPage()
  await table.goto('/table')
  await expect(table.locator('.join-overlay')).toBeVisible()
  await expect(table.locator('.join-qr')).toHaveCount(2)
  // The game clock waits for both iPads.
  await expect(table.locator('.table-clock')).toHaveCount(0)
  await shot(table, '01-join')

  const contextA = await browser.newContext({ viewport: IPAD, hasTouch: true })
  const contextB = await browser.newContext({ viewport: IPAD, hasTouch: true })
  const a = await contextA.newPage()
  const b = await contextB.newPage()
  await a.goto('/play?seat=A')
  await b.goto('/play?seat=B')

  await a.getByLabel('Your name').fill('Alice')
  await a.getByLabel('Your name').press('Enter')
  await b.getByLabel('Your name').fill('Bob')
  await b.getByLabel('Your name').press('Enter')
  await expect(table.locator('.join-seat-ok')).toHaveCount(2)
  await expect(table.locator('.table-clock')).toHaveAttribute('data-clock', 'running')
  await expect(table.locator('.table-clock')).toHaveText(/^\d+:\d\d$/)

  // The iPad header can hide the browser bars: it either goes full screen (Safari) or,
  // where the browser doesn't allow it, explains Add to Home Screen.
  await a.getByRole('button', { name: 'Full screen' }).click()
  const exitButton = a.getByRole('button', { name: 'Exit full screen' })
  const help = a.getByText('Add to Home Screen')
  await expect(exitButton.or(help)).toBeVisible()
  if (await exitButton.isVisible()) {
    await exitButton.click()
  } else {
    await a.getByRole('dialog').getByRole('button', { name: 'Close' }).click()
  }
  await expect(a.getByRole('button', { name: 'Full screen' })).toBeVisible()
  await expect(a.getByRole('dialog')).toHaveCount(0)
  await expect(table.locator('.pb-name', { hasText: 'Alice' })).toBeVisible()

  // A second device can't silently steal a seat.
  const intruder = await (await browser.newContext({ viewport: IPAD })).newPage()
  await intruder.goto('/play?seat=A')
  await expect(intruder.getByText('Seat A is in use on another device')).toBeVisible()

  // ---- setup ----
  await readyUp(a, b)
  await expect(a.getByText('1 · Your kill team')).toBeVisible()
  await expect(table.locator('.join-overlay')).toHaveCount(0)

  await a.getByPlaceholder('Search kill teams').fill('Hernkyn')
  await a.getByRole('button', { name: /Hernkyn Yaegirs/ }).click()
  await b.getByPlaceholder('Search kill teams').fill('Vespid')
  await b.getByRole('button', { name: /Vespid Stingwings/ }).click()
  await expect(b.getByText('Alice: Hernkyn Yaegirs')).toBeVisible()

  // Killzone and crit op arrive pre-rolled; a re-roll on one iPad shows up on the other.
  const killzone = a.locator('.roll-result').first()
  const critOp = a.locator('.roll-result').nth(1)
  const rolledKillzone = await killzone.textContent()
  const rolledCritOp = await critOp.textContent()
  await a.getByRole('button', { name: 'Re-roll' }).first().click()
  await a.getByRole('button', { name: 'Re-roll' }).nth(1).click()
  await expect(killzone).not.toHaveText(rolledKillzone)
  await expect(critOp).not.toHaveText(rolledCritOp)
  await expect(b.locator('.roll-result').first()).toHaveText(await killzone.textContent())
  await expect(b.locator('.roll-result').nth(1)).toHaveText(await critOp.textContent())

  // Pin Map 2 / Layout 04 manually so the rest of the run is deterministic.
  await a.getByText('Choose manually').first().click()
  await a.getByRole('button', { name: 'Map 2' }).click()
  await a.getByRole('button', { name: 'Layout 04' }).click()
  await expect(b.locator('.roll-result').first()).toHaveText('Map 2 · Layout 04')
  // Approved Ops 2025: the roll-off winner decides who has initiative; that player
  // picks the drop zone and the other gains the Re-roll initiative card.
  await a.getByRole('button', { name: 'I won' }).click()
  await expect(b.getByText('Alice decides who has initiative.')).toBeVisible()
  await a.getByRole('button', { name: 'I take initiative' }).click()
  await expect(b.getByText('You gain the Re-roll initiative card.')).toBeVisible()
  await expect(b.getByRole('button', { name: /Drop zone/ })).toHaveCount(0)
  await a.getByRole('button', { name: 'Drop zone A', exact: true }).click()
  await expect(b.getByText('You’re in drop zone B.').or(b.getByText("You're in drop zone B."))).toBeVisible()
  await shot(a, '02-setup-ipad')
  await shot(table, '03-setup-table')

  // ---- muster ----
  await readyUp(a, b)
  await expect(a.getByRole('button', { name: /Operatives/ })).toBeVisible()
  // Yaegirs default to every operative; Vespids start empty.
  await expect(a.locator('.unit-pick.is-selected')).toHaveCount(10)
  const picks = b.locator('.unit-pick')
  for (let index = 0; index < 6; index += 1) await picks.nth(index).locator('.unit-card, article, div').first().click({ position: { x: 20, y: 12 } })
  await expect(b.locator('.unit-pick.is-selected')).toHaveCount(6)
  // Up to four equipment options; nothing is pre-selected.
  await a.locator('.segmented button', { hasText: 'Equipment' }).click()
  await expect(a.getByText('0 of 4 equipment options chosen.', { exact: false })).toBeVisible()
  // Ready waits until operatives, equipment and a tac op are all picked, and says what's
  // still missing.
  const aliceHeader = a.locator('.play-header')
  await expect(aliceHeader.getByRole('button', { name: 'Pick your equipment' })).toBeDisabled()
  await a.locator('.equipment-toggle', { hasText: 'Ladders' }).click()
  await expect(aliceHeader.getByRole('button', { name: 'Pick a tac op' })).toBeDisabled()
  // Approved Ops 2025 tac ops are text cards, limited to the kill team's archetypes.
  await a.getByRole('button', { name: 'Tac op', exact: true }).click()
  await expect(a.locator('.tacop-pick').first()).toBeVisible()
  await a.locator('.tacop-pick').first().click()
  await expect(a.locator('.tacop-pick').first()).toHaveAttribute('aria-pressed', 'true')
  await expect(aliceHeader.getByRole('button', { name: 'Ready', exact: true })).toBeEnabled()
  // Bob picks his equipment and tac op too.
  await b.locator('.segmented button', { hasText: 'Equipment' }).click()
  await b.locator('.equipment-toggle', { hasText: 'Ladders' }).click()
  await b.getByRole('button', { name: 'Tac op', exact: true }).click()
  await b.locator('.tacop-pick').first().click()
  await shot(a, '04b-tacop-ipad')
  await shot(b, '04-muster-ipad')
  // The table only shows progress, never the tac op itself.
  await expect(table.locator('.tacop-card')).toHaveCount(0)

  // ---- deploy ----
  await readyUp(a, b)
  // Approved Ops 2025 has no scouting step.
  await expect(a.getByRole('heading', { name: 'Deploy' })).toBeVisible()
  await expect(a.getByText('You have initiative, so you set up first.')).toBeVisible()
  await expect(a.getByText(/Scouting/)).toHaveCount(0)
  await openTab(a, 'Map')
  // Units pops a list of names out of its button; no options drawer at the bottom.
  const unitsButton = a.getByRole('button', { name: 'Units', exact: true })
  await unitsButton.click()
  const unitsList = a.getByRole('navigation', { name: 'Place a unit' })
  await expect(unitsList.getByRole('button')).toHaveCount(11)
  await expect(a.locator('.options-drawer')).toHaveCount(0)
  await shot(a, '05u-units-flyout')
  // Picking a unit closes the list; tapping the map places it with − / + and its base size on the token.
  await unitsList.getByRole('button').first().click()
  await expect(unitsList).toHaveCount(0)
  await dragOnMap(a, [0.5, 0.5], [0.5, 0.5])
  await expect(table.locator('.board-token')).toHaveCount(1)
  await expect(a.locator('.base-sizer-size')).toHaveText('28.5')
  await shot(a, '05v-base-sizer')
  const placedRadius = () => table.locator('.board-token-base').first().getAttribute('r').then(Number)
  await a.getByRole('button', { name: 'Larger base' }).click()
  await expect.poll(placedRadius).toBeCloseTo(32 / 25.4 / 2, 3)
  await expect(a.locator('.base-sizer-size')).toHaveText('32')
  await a.getByRole('button', { name: 'Smaller base' }).click()
  await expect.poll(placedRadius).toBeCloseTo(28.5 / 25.4 / 2, 3)
  // Tapping Units again fixes that base size and opens the list for the next unit.
  await unitsButton.click()
  await expect(a.locator('.base-sizer')).toHaveCount(0)
  await expect(unitsList.getByRole('button')).toHaveCount(10)
  await unitsList.getByRole('button', { name: 'Place all in my drop zone' }).click()
  await expect(table.locator('.board-token')).toHaveCount(10)
  await expect(unitsList).toHaveCount(0)

  // Map mode: the board fills the iPad and the controls live in translucent drawers.
  const mat = await a.locator('.map-stage .board-mat').boundingBox()
  const screen = a.viewportSize()
  expect((mat.width * mat.height) / (screen.width * screen.height)).toBeGreaterThan(0.8)
  await a.getByRole('button', { name: 'Hide tools' }).click()
  await expect(a.locator('.tool-drawer')).toHaveClass(/is-closed/)
  await a.getByRole('button', { name: 'Show tools' }).click()
  await expect(a.locator('.tool-drawer')).toHaveClass(/is-open/)
  await shot(a, '05a-map-immersive')
  // Yaegirs are on 28.5mm bases, so the projected token radius is 28.5mm / 2 in inches.
  const radius = Number(await table.locator('.board-token-base').first().getAttribute('r'))
  expect(radius).toBeCloseTo(28.5 / 25.4 / 2, 3)

  // Before the battle, operatives drag freely (no 1" steps) and nothing stays on the board.
  // Move comes from the operative's action ring (with Units turned off).
  await unitsButton.click()
  await ringAction(a, await table.locator('.board-token').nth(1).getAttribute('data-token-id'), 'Move')
  // Tuck the tool drawer away so it doesn't cover the drop-zone column.
  await a.getByRole('button', { name: 'Hide tools' }).click()
  const stageBox = await a.locator('.map-stage svg').boundingBox()
  const [, , viewW, viewH] = (await a.locator('.map-stage svg').getAttribute('viewBox')).split(' ').map(Number)
  const pxPerInch = Math.min(stageBox.width / viewW, stageBox.height / viewH)
  const deployToken = table.locator('.board-token-base').nth(1)
  const deployCx = Number(await deployToken.getAttribute('cx'))
  const deployBox = await a.locator('.map-stage .board-token-base').nth(1).boundingBox()
  const dx = deployBox.x + deployBox.width / 2
  const dy = deployBox.y + deployBox.height / 2
  await a.mouse.move(dx, dy)
  await a.mouse.down()
  // Drag in an L: the measurement follows the route in straight 1" legs (2" across, then
  // 1" toward the finger, then the part inch left over) rather than one straight line (2.9").
  for (let i = 1; i <= 10; i += 1) await a.mouse.move(dx + (2.5 * pxPerInch * i) / 10, dy)
  for (let i = 1; i <= 10; i += 1) await a.mouse.move(dx + 2.5 * pxPerInch, dy + (1.5 * pxPerInch * i) / 10)
  await expect(table.locator('.overlay-measure .overlay-label')).toHaveText(/^3\.[3-8]"$/)
  await expect(a.locator('.map-stage .overlay-measure polyline')).toHaveAttribute('points', /(\S+\s+){3,}/)
  await shot(table, '05w-deploy-drag-path')
  // A moving operative shows its 1" range.
  await expect(table.locator('.board-token-ring')).toHaveCount(1)
  await a.mouse.up()
  // Lands where it was dropped (about 2.5" across), not snapped to a whole inch.
  await expect
    .poll(async () => Math.abs(Number(await deployToken.getAttribute('cx')) - deployCx - 2.5))
    .toBeLessThan(0.25)
  const deployMoved = Number(await deployToken.getAttribute('cx')) - deployCx
  expect(Math.abs(deployMoved - Math.round(deployMoved))).toBeGreaterThan(0.05)
  await expect(table.locator('.overlay-move')).toHaveCount(0)
  await expect(table.locator('.overlay-measure')).toHaveCount(0)

  await expect(table.locator('.board-token-ring')).toHaveCount(0)

  await a.getByRole('button', { name: 'Show tools' }).click()
  // Measure (from an operative's action ring) is a free ruler: nothing snaps, ends
  // stretch, the middle slides it. Its ruler starts at the operative's base.
  const deployId = await table.locator('.board-token').nth(1).getAttribute('data-token-id')
  await ringAction(a, deployId, 'Measure')
  const dragPx = async (from, to) => {
    await a.mouse.move(from.x, from.y)
    await a.mouse.down()
    for (let i = 1; i <= 8; i += 1) await a.mouse.move(from.x + ((to.x - from.x) * i) / 8, from.y + ((to.y - from.y) * i) / 8)
    await a.mouse.up()
  }
  const at = (fx, fy, dxIn = 0, dyIn = 0) => ({
    x: stageBox.x + stageBox.width * fx + dxIn * pxPerInch,
    y: stageBox.y + stageBox.height * fy + dyIn * pxPerInch,
  })
  const rulerLabel = table.locator('.overlay-measure .overlay-label')
  const inchesOf = async () => Number.parseFloat(await rulerLabel.textContent())
  // The first drag pulls the ruler out of the operative's base, wherever it starts.
  await dragPx(at(0.35, 0.3), at(0.35, 0.3, 1))
  await expect(table.locator('.overlay-measure')).toHaveCount(1)
  // Pressing away from that ruler starts a fresh one.
  await dragPx(at(0.35, 0.62), at(0.35, 0.62, 3))
  await expect.poll(inchesOf).toBeCloseTo(3, 0)
  // The start end-line's centre (it's drawn across the ruler).
  const startHandle = table.locator('.overlay-measure .overlay-end-line').first()
  const startX = async () => (Number(await startHandle.getAttribute('x1')) + Number(await startHandle.getAttribute('x2'))) / 2
  const startY = async () => (Number(await startHandle.getAttribute('y1')) + Number(await startHandle.getAttribute('y2'))) / 2
  const startCxBefore = await startX()
  const startCyBefore = await startY()
  // Stretch: drag the far end 2" further; the start stays put.
  await dragPx(at(0.35, 0.62, 3), at(0.35, 0.62, 5))
  await expect.poll(inchesOf).toBeCloseTo(5, 0)
  expect(await startX()).toBeCloseTo(startCxBefore, 1)
  // Slide: drag the middle down 1"; same length, both ends move.
  await dragPx(at(0.35, 0.62, 2.5), at(0.35, 0.62, 2.5, 1))
  await expect.poll(async () => (await startY()) - startCyBefore).toBeCloseTo(1, 0)
  await expect.poll(inchesOf).toBeCloseTo(5, 0)
  expect(await startX()).toBeCloseTo(startCxBefore, 1)
  await shot(a, '05-map-ipad')
  // Pressing elsewhere starts a fresh line instead of adding a bend.
  await dragPx(at(0.35, 0.3), at(0.35, 0.3, 1.5))
  await expect.poll(inchesOf).toBeCloseTo(1.5, 0)
  await expect(table.locator('.overlay-measure')).toHaveCount(1)
  // Left alone, the ruler stays on the projector as long as it's on the iPad (other
  // devices drop previews they haven't heard about for 15s, so the iPad keeps re-sending).
  await table.waitForTimeout(17000)
  await expect(table.locator('.overlay-measure')).toHaveCount(1)
  await shot(table, '06-map-table')
  // With Measure on, tapping an operative closes it (the ruler goes) and opens the
  // operative's action ring.
  await a.locator(`.map-stage [data-token-id="${deployId}"] .board-token-base`).click()
  await expect(a.locator('.unit-radial').getByRole('menuitem')).toHaveCount(10)
  await expect(table.locator('.overlay-measure')).toHaveCount(0)

  // Switching tools clears the measurement; no separate Clear button.
  await expect(a.getByRole('button', { name: 'Clear' })).toHaveCount(0)
  // Sightline: a sniper (Alice) and four of Bob's operatives around the ruins of
  // Map 2 / Layout 04: one in the open, one wholly behind ruin F's heavy wall (not
  // visible), one partly behind it (obscured), one just inside ruin B (Conceal, in cover).
  const tokenCount = await table.locator('.board-token').count()
  await tableActions(table, [
    // The sniper uses the Yaegir Gunner's datacard (its weapon has Blast profiles).
    { type: 'token/add', seat: 'A', label: 'Sniper', unitKey: 'VOT-HKY-GNR-0', x: 8, y: 8.5, baseMm: 32 },
    { type: 'token/add', seat: 'B', label: 'Open', unitKey: 'TEST-OPEN', x: 8, y: 4, baseMm: 32 },
    { type: 'token/add', seat: 'B', label: 'Behind', unitKey: 'TEST-BEHIND', x: 12.5, y: 5, baseMm: 32 },
    { type: 'token/add', seat: 'B', label: 'Inside', unitKey: 'TEST-INSIDE', x: 8, y: 12, baseMm: 32 },
    { type: 'token/add', seat: 'B', label: 'Edge', unitKey: 'TEST-EDGE', x: 14, y: 5, baseMm: 32 },
  ])
  await expect(table.locator('.board-token')).toHaveCount(tokenCount + 5)
  const [sniper, inOpen, behind, inside, edge] = (
    await table.locator('.board-token').evaluateAll((nodes) => nodes.map((node) => node.dataset.tokenId))
  ).slice(-5)
  const tapToken = (id) => a.locator(`.map-stage [data-token-id="${id}"] .board-token-base`).click()
  // Sightline from the sniper's action ring (a tap on it switches the open ring to it)
  // badges every enemy at a glance.
  await ringAction(a, sniper, 'Sightline')
  await expect(table.locator('.overlay-measure')).toHaveCount(0)
  await expect(table.locator(`[data-badge-for="${inOpen}"]`)).toHaveAttribute('data-status', 'valid')
  await expect(table.locator(`[data-badge-for="${behind}"]`)).toHaveAttribute('data-status', 'invalid')
  await expect(table.locator(`[data-badge-for="${edge}"]`)).toHaveAttribute('data-status', 'obscured')
  await expect(table.locator(`[data-badge-for="${inside}"]`)).toHaveAttribute('data-status', 'invalid')
  // Picking a target draws the beams and its roll effects. Partly behind Heavy
  // terrain: obscured.
  await tapToken(edge)
  await expect(table.locator('.target-scan.is-blocked').first()).toBeVisible()
  await expect(table.locator('.target-scan.is-clear')).toHaveCount(1)
  await expect(table.locator(`[data-chips-for="${edge}"]`)).toContainText('OBSCURED · −1 SUCCESS · NO CRITS')
  // Wholly behind it: treated as not visible, so not a valid target.
  await tapToken(behind)
  await expect(table.locator(`[data-chips-for="${behind}"]`)).toContainText(
    'NOT VALID · WHOLLY BEHIND HEAVY TERRAIN (NOT VISIBLE)',
  )
  await expect(table.locator(`[data-chips-for="${behind}"]`)).not.toContainText('OBSCURED')
  await shot(table, '07-los-table')
  await shot(a, '07a-los-ipad')
  await tapToken(inside)
  // Only green and red in the scan: no yellow, and no individual beams.
  await expect(table.locator('.target-scan:not(.is-clear):not(.is-blocked), .target-beam')).toHaveCount(0)
  await expect(table.locator(`[data-chips-for="${inside}"]`)).toContainText('NOT VALID · CONCEAL ORDER IN COVER')
  // The white point can be dragged around the shooter's base but never off it.
  const pointBox = await a.locator('.map-stage .target-point circle').last().boundingBox()
  const px = pointBox.x + pointBox.width / 2
  const py = pointBox.y + pointBox.height / 2
  await a.mouse.move(px, py)
  await a.mouse.down()
  for (let i = 1; i <= 8; i += 1) await a.mouse.move(px - (2 * pxPerInch * i) / 8, py)
  await a.mouse.up()
  const sniperBase = table.locator(`[data-token-id="${sniper}"] .board-token-base`)
  const pointOffset = async () =>
    Number(await table.locator('.target-point circle').last().getAttribute('cx')) - Number(await sniperBase.getAttribute('cx'))
  await expect.poll(pointOffset).toBeLessThan(-0.3)
  expect(Math.abs(await pointOffset())).toBeLessThanOrEqual(Number(await sniperBase.getAttribute('r')) + 0.001)
  // Sightline is just the line-of-sight check: no weapons.
  const weaponList = a.getByRole('dialog', { name: 'Choose a weapon' })
  await expect(weaponList).toHaveCount(0)
  // Tapping the shooter closes Sightline and opens its action ring.
  await tapToken(sniper)
  await expect(a.locator('.unit-radial').getByRole('menuitem')).toHaveCount(10)
  await expect(table.locator('.targeting')).toHaveCount(0)
  // Shoot/Fight: tap the shooter and its weapon list pops out, set to Shoot (no enemy
  // is within its control range). The switch shows its melee weapons instead.
  // Fight from the ring shows the melee weapons full screen; Cancel ends it.
  await ringAction(a, sniper, 'Fight')
  await expect(weaponList.locator('.weapon-card-name')).toHaveText([/Fists/])
  await weaponList.getByRole('button', { name: 'Cancel' }).click()
  await expect(weaponList).toHaveCount(0)
  // Shoot shows each ranged profile as a big card: its stats, and its rules as printed.
  await ringAction(a, sniper, 'Shoot')
  await expect(weaponList.locator('.weapon-card')).toHaveCount(3)
  const breaching = weaponList.locator('.weapon-card', { hasText: 'Breaching' })
  await expect(breaching.locator('.weapon-card-stat-value')).toHaveText(['5', '4+', '3/5'])
  await expect(breaching.locator('.weapon-card-chips li')).toContainText(['BLAST 2"', 'HEAVY · REPOSITION ONLY'])
  await expect(breaching.locator('.weapon-card-printed')).toContainText('Blast 2"')
  await shot(a, '07b-weapon-list')
  // Choosing closes the list. A Blast 2" profile rings the target and tags everyone it
  // would also hit.
  await breaching.getByRole('button', { name: /Breaching/ }).click()
  await expect(weaponList).toHaveCount(0)
  await tapToken(edge)
  await expect(table.locator('[data-area-ring="2"]')).toHaveCount(1)
  await expect(table.locator(`[data-splash-for="${behind}"]`)).toHaveAttribute('data-splash', 'blast')
  // The numbers stay off the play area: the shooter's side bar on the projector swaps
  // to the attack, and the iPad has them in a stats drawer.
  const aliceCombat = table.locator('.pb-board[data-seat="A"] [data-combat="attack"]')
  await expect(aliceCombat).toContainText('APM Launcher · Breaching')
  await expect(aliceCombat.locator('[data-rule-state]', { hasText: 'Blast 2"' })).toHaveCount(1)
  // Partly behind Heavy terrain: obscured, so no crits.
  await expect(aliceCombat.locator('[data-cell="crit"]')).toHaveAttribute('data-tone', 'worse')
  await expect(table.locator('.pb-board[data-seat="B"] [data-combat="defence"]')).toBeVisible()
  await expect(table.locator(`[data-chips-for="${sniper}"], [data-chips-for="${edge}"]`)).toHaveCount(0)
  await expect(a.getByRole('button', { name: 'Show the shot' })).toBeVisible()
  await shot(table, '07c-blast-table')
  // Smoke: the operative in the open, wholly inside a Smoke Grenade's 1", is obscured.
  await tableActions(table, [
    { type: 'marker/add', kind: 'marker', catalogId: 'smoke-grenade', label: 'Smoke Grenade', radius: 20 / 25.4 / 2, x: 8, y: 4 },
  ])
  await expect(table.locator(`[data-badge-for="${inOpen}"]`)).toHaveAttribute('data-status', 'obscured')
  const smokeId = await table.locator('[data-catalog-id="smoke-grenade"]').getAttribute('data-marker-id')
  await tableActions(table, [{ type: 'marker/remove', id: smokeId }])
  // Tapping the shooter ends Shoot/Fight and opens its action ring; the side bars go
  // back to normal.
  await tapToken(sniper)
  await expect(a.locator(`.unit-radial[data-ring-for="${sniper}"]`).getByRole('menuitem')).toHaveCount(10)
  await expect(table.locator('.targeting')).toHaveCount(0)
  await expect(table.locator('[data-combat]')).toHaveCount(0)
  // On Vantage (picked by floor from the action ring, and marked with a chevron per
  // floor): shooting down at an Engage target gives Accurate.
  await ringAction(a, sniper, 'Vantage')
  const ringA = a.locator(`.unit-radial[data-ring-for="${sniper}"]`)
  await expect(ringA.getByRole('menuitem')).toHaveText(['Ground', '1st floor', '2nd floor', 'Back'])
  await expect(ringA.getByRole('menuitem', { name: 'Ground' })).toHaveAttribute('aria-pressed', 'true')
  await a.waitForTimeout(250)
  await shot(a, '07v-vantage-ring')
  await ringA.getByRole('menuitem', { name: '1st floor' }).click()
  await expect(table.locator(`[data-vantage-for="${sniper}"]`)).toHaveAttribute('data-floor', '1')
  await expect(table.locator(`[data-vantage-for="${sniper}"] path`)).toHaveCount(1)
  await shot(table, '07w-vantage-table')
  await tableActions(table, [{ type: 'unit/update', seat: 'B', unitKey: 'TEST-OPEN', patch: { order: 'engage' } }])
  await ringAction(a, sniper, 'Sightline')
  await tapToken(inOpen)
  await expect(table.locator(`[data-chips-for="${sniper}"]`)).toContainText('VANTAGE · ACCURATE 1')
  // Edit, from the ring (Sightline ended first): name, base size and removal, each
  // with its own ring.
  await a.mouse.click(...(await emptySpotOf(a)))
  const editedBase = table.locator(`[data-token-id="${sniper}"] .board-token-base`)
  await ringAction(a, sniper, 'Edit')
  const editRing = a.locator(`.unit-radial[data-ring-for="${sniper}"]`)
  await expect(editRing.getByRole('menuitem')).toHaveText(['Name', 'Base size', 'Remove', 'Back'])
  await editRing.getByRole('menuitem', { name: 'Base size' }).click()
  await expect(editRing.getByRole('menuitem', { name: '32mm base' })).toHaveAttribute('aria-pressed', 'true')
  await editRing.getByRole('menuitem', { name: '40mm base' }).click()
  await expect.poll(async () => Number(await editedBase.getAttribute('r'))).toBeCloseTo(40 / 25.4 / 2, 3)
  await ringAction(a, sniper, 'Edit')
  await editRing.getByRole('menuitem', { name: 'Name' }).click()
  await editRing.getByRole('textbox', { name: 'Name' }).fill('Exposed')
  await shot(a, '07x-name-ring')
  await editRing.getByRole('textbox', { name: 'Name' }).press('Enter')
  await expect(table.locator('.board-token-name').filter({ hasText: 'Exposed' })).toHaveCount(1)
  await ringAction(a, sniper, 'Edit')
  await editRing.getByRole('menuitem', { name: 'Remove' }).click()
  await expect(editRing.getByRole('menuitem')).toHaveText(['Remove', 'Keep'])
  await editRing.getByRole('menuitem', { name: 'Remove' }).click()
  await expect(table.locator(`[data-token-id="${sniper}"]`)).toHaveCount(0)
  await tableActions(
    table,
    [
      ...[sniper, inOpen, behind, inside, edge].map((id) => ({ type: 'token/remove', id })),
      { type: 'unit/update', seat: 'A', unitKey: 'VOT-HKY-GNR-0', patch: { vantage: 0 } },
    ],
  )
  await expect(table.locator('.board-token')).toHaveCount(tokenCount)

  // The rail also holds Fit and the Tabs flyout; the map has no top status bar or hint.
  await expect(a.locator('.play-header')).toHaveCount(0)
  await expect(a.getByRole('button', { name: 'Fit', exact: true })).toBeVisible()
  // Full screen is in the map drawer too: it goes full screen, or explains Add to Home Screen.
  await a.locator('.tool-rail').getByRole('button', { name: 'Full screen' }).click()
  const railExit = a.locator('.tool-rail').getByRole('button', { name: 'Exit full screen' })
  await expect(railExit.or(a.getByText('Add to Home Screen'))).toBeVisible()
  if (await railExit.isVisible()) await railExit.click()
  else await a.getByRole('dialog').getByRole('button', { name: 'Close' }).click()
  await expect(a.locator('.tool-rail').getByRole('button', { name: 'Full screen' })).toBeVisible()
  await a.getByRole('button', { name: 'Tabs', exact: true }).click()
  await expect(a.locator('.tab-flyout')).toBeVisible()
  await shot(a, '07b-map-tab-flyout')
  await a.getByRole('button', { name: 'Tabs', exact: true }).click()
  await expect(a.locator('.tab-flyout')).toHaveCount(0)

  // ---- battle ----
  await openTab(a, 'Deploy')
  await readyUp(a, b)
  await expect(a.getByText('Turning point 1 · strategy phase')).toBeVisible()
  // Initiative roll-off every turning point: Bob holds the Re-roll card from setup.
  await expect(a.getByRole('button', { name: 'Start firefight' })).toBeDisabled()
  await expect(a.getByText('Both players gain 1CP in turning point 1.')).toBeVisible()
  await expect(b.locator('.init-card')).toHaveText([/Re-roll/])
  await expect(table.locator('.pb-board[data-seat="B"] .pb-init-card')).toHaveText(['Re-roll'])
  // Bob plays his Re-roll card and wins; the roll-off loser (Alice) gains the ±1 card.
  await b.locator('.init-card').first().click()
  await expect(b.locator('.init-card').first()).toHaveClass(/is-used/)
  await a.locator('.rolloff-option', { hasText: 'Bob' }).click()
  await expect(a.getByText('Bob decides who has initiative.')).toBeVisible()
  await expect(a.locator('.init-card')).toHaveText([/±1/])
  await b.getByRole('button', { name: 'Alice takes it' }).click()
  await expect(a.getByText('You have initiative.')).toBeVisible()
  // Turning point 1 also has each player's secret primary op.
  await expect(a.getByRole('button', { name: 'Start firefight' })).toBeDisabled()
  await a.locator('.card-pick').first().click()
  await shot(a, '08-strategy-ipad')
  await a.getByRole('button', { name: 'Start firefight' }).click()
  await expect(b.getByRole('button', { name: 'Start firefight' })).toBeDisabled()
  await b.locator('.card-pick').nth(1).click()
  await b.getByRole('button', { name: 'Start firefight' }).click()
  await a.getByLabel('Score VP').click()
  await a.getByLabel('Increase Crit op').click()
  await a.getByLabel('Increase Crit op').click()
  await a.getByRole('button', { name: 'Done' }).click()
  await expect(a.getByLabel('Score VP')).toContainText('2')
  // Alice's player board: VP/CP, turning point and one activation pip per operative.
  const aliceBoard = table.locator('.pb-board[data-seat="A"]')
  const bobBoard = table.locator('.pb-board[data-seat="B"]')
  await expect(aliceBoard.locator('.pb-big-value').first()).toHaveText('2')
  await expect(aliceBoard.locator('.pb-tp')).toHaveText('TP 1 / 4')
  await expect(aliceBoard.locator('.pb-pips .pb-pip')).toHaveCount(10)
  await expect(aliceBoard.locator('.pb-ready-count')).toContainText('10')
  await expect(bobBoard.locator('.pb-kills')).toContainText('0 / 10')

  // A firefight ploy played from the Team tab spends its CP and shows on the projector,
  // outlined, beside any strategy ploys; undoing it refunds the CP.
  const cpBeforePloy = Number(await aliceBoard.locator('.pb-stat.is-cp .pb-big-value').textContent())
  await a.getByRole('button', { name: 'Team & rules' }).click()
  await a.getByRole('button', { name: 'Use Command Re-roll' }).click()
  await expect(aliceBoard.locator('.pb-ploys [data-ploy="firefight"]')).toHaveText('Command Re-roll')
  await expect(aliceBoard.locator('.pb-stat.is-cp .pb-big-value')).toHaveText(String(cpBeforePloy - 1))
  await a.getByRole('button', { name: 'Undo Command Re-roll' }).click()
  await expect(aliceBoard.locator('.pb-ploys [data-ploy="firefight"]')).toHaveCount(0)
  await expect(aliceBoard.locator('.pb-stat.is-cp .pb-big-value')).toHaveText(String(cpBeforePloy))
  await a.getByRole('button', { name: 'Operatives' }).click()
  await shot(a, '09-battle-ipad')
  await shot(table, '10-battle-table')

  // In battle the Units tool is gone: operatives are only set up before the battle.
  await openTab(a, 'Map')
  await expect(a.getByRole('button', { name: 'Units', exact: true })).toHaveCount(0)
  // Everything else on the operatives comes from their action ring; the rail keeps the rest.
  await expect(a.locator('.tool-rail .rail-tool > span')).toHaveText(['Token', /to go$/, 'Fit', 'Full screen', 'Tabs'])
  // Next TP in the drawer waits until every operative has activated.
  await expect(a.getByRole('button', { name: /^Next TP \(\d+ operatives still to activate\)$/ })).toBeDisabled()
  // With no tool on, tapping an operative opens a ring of its actions; a touch
  // elsewhere closes it.
  const ring = a.locator('.unit-radial')
  const tokenOf = (id) => a.locator(`.map-stage [data-token-id="${id}"] .board-token-base`)
  const tokenIdsOf = (color) =>
    a.locator('.map-stage [data-token-id]').evaluateAll(
      (groups, wanted) => groups.filter((g) => g.style.getPropertyValue('--token-color') === wanted).map((g) => g.dataset.tokenId),
      color,
    )
  const [mineId] = await tokenIdsOf('#ff5a4e')
  await tokenOf(mineId).click()
  await expect(ring.getByRole('menuitem')).toHaveText(['Move', 'Measure', 'Sightline', 'Shoot', 'Fight', 'Range', 'Vantage', 'Edit', 'Ping', 'Unit card'])
  // (Once its buttons have finished popping out.)
  await a.waitForTimeout(250)
  await shot(a, '06r-action-ring-ipad')
  const emptySpot = await emptySpotOf(a)
  expect(emptySpot).not.toBeNull()
  await a.mouse.click(...emptySpot)
  await expect(ring).toHaveCount(0)
  // Tapping the empty map pings it on the projector.
  await a.mouse.click(...emptySpot)
  await expect(table.locator('.overlay-ping')).toHaveCount(1)
  // Dragging from an operative measures from its base edge, and the operative stays put.
  const mineCx = await table.locator(`[data-token-id="${mineId}"] .board-token-base`).getAttribute('cx')
  const mineBox = await tokenOf(mineId).boundingBox()
  const mineAt = { x: mineBox.x + mineBox.width / 2, y: mineBox.y + mineBox.height / 2 }
  await a.mouse.move(mineAt.x, mineAt.y)
  await a.mouse.down()
  for (let i = 1; i <= 10; i += 1) await a.mouse.move(mineAt.x + (3 * pxPerInch * i) / 10, mineAt.y)
  await a.mouse.up()
  const fromBase = 3 - Number(await table.locator(`[data-token-id="${mineId}"] .board-token-base`).getAttribute('r'))
  await expect
    .poll(async () => Number.parseFloat(await table.locator('.overlay-measure .overlay-label').textContent()))
    .toBeCloseTo(fromBase, 0)
  expect(await table.locator(`[data-token-id="${mineId}"] .board-token-base`).getAttribute('cx')).toBe(mineCx)
  // Shoot from the ring: the Shoot/Fight tool comes on with the weapon chooser open.
  await tokenOf(mineId).click()
  await ring.getByRole('menuitem', { name: 'Shoot' }).click()
  const chooser = a.getByRole('dialog', { name: 'Choose a weapon' })
  await expect(chooser).toBeVisible()
  await expect(table.locator('.overlay-measure')).toHaveCount(0)
  // Cancel ends it.
  await chooser.getByRole('button', { name: 'Cancel' }).click()
  await expect(chooser).toHaveCount(0)
  // Unit card (from the ring) opens the operative's full card; your own can be changed.
  await ringAction(a, mineId, 'Unit card')
  const cardSheet = a.getByRole('dialog', { name: 'Unit card' })
  await expect(cardSheet.locator('.game-card')).toHaveCount(1)
  await expect(cardSheet.getByLabel('Add status effect')).toHaveCount(1)
  await shot(a, '06u-unit-card-modal')
  await cardSheet.getByRole('button', { name: 'Close' }).click()
  await expect(cardSheet).toHaveCount(0)

  // In battle, drag an operative in an L: it moves in whole-inch steps, the path stays, and undo puts it back.
  await ringAction(a, 't1', 'Move')
  const tableToken = table.locator('.board-token-base').first()
  const startCx = await tableToken.getAttribute('cx')
  const tokenBox = await a.locator('.map-stage .board-token-base').first().boundingBox()
  const sx = tokenBox.x + tokenBox.width / 2
  const sy = tokenBox.y + tokenBox.height / 2
  await a.mouse.move(sx, sy)
  await a.mouse.down()
  for (let i = 1; i <= 20; i += 1) await a.mouse.move(sx + (4.3 * pxPerInch * i) / 20, sy)
  // Mid-drag the count sits in the middle of the token and goes up in 0.1" steps.
  await expect(table.locator('.overlay-move .move-count')).toHaveText(/^4\.\d"$/)
  await shot(a, '06a-move-count-ipad')
  for (let i = 1; i <= 20; i += 1) await a.mouse.move(sx + 4.3 * pxPerInch, sy + (3.3 * pxPerInch * i) / 20)
  await a.mouse.up()
  // Released, it snaps to the last whole inch and the count stays on the token.
  const moveLabel = table.locator('.move-count[data-count-for="t1"]')
  await expect(moveLabel).toHaveText(/^\d+\.0"$/)
  expect(Number.parseFloat(await moveLabel.textContent())).toBeGreaterThanOrEqual(6)
  await expect(tableToken).not.toHaveAttribute('cx', startCx)
  await shot(table, '06b-move-path-table')
  // Moving a ready operative in the Firefight phase activates it.
  await expect(table.locator('[data-token-id="t1"]')).toHaveClass(/is-active/)
  await expect(aliceBoard.locator('.pb-turn-badge')).toHaveText('Activating')
  // No activation banner or undo drawer on the iPad: the board itself shows the status.
  await expect(a.locator('.activation-pill')).toHaveCount(0)
  // The moved operative keeps a 1" range ring, drawn over every name and base.
  const movedId = await table.locator('.board-token').first().getAttribute('data-token-id')
  await expect(table.locator('.board-token-ring')).toHaveCount(1)
  await expect(table.locator('.board-token-ring')).toHaveAttribute('data-ring-for', movedId)
  const layering = await table.locator('.table-board').evaluate((svg) => {
    const follows = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
    const names = svg.querySelectorAll('.board-token-name')
    const bodies = svg.querySelectorAll('.board-token')
    const ring = svg.querySelector('.board-token-ring')
    return {
      namesUnderBases: follows(names[names.length - 1], bodies[0]),
      ringOnTop: follows(bodies[bodies.length - 1], ring),
    }
  })
  expect(layering).toEqual({ namesUnderBases: true, ringOnTop: true })
  await expect(a.locator('.options-drawer')).toHaveCount(0)
  await shot(a, '06c-map-after-move')
  const firstLeg = Number.parseFloat(await moveLabel.textContent())

  // Dragging the same operative again continues the movement from its original start.
  const movedBox = await a.locator('.map-stage .board-token-base').first().boundingBox()
  const mx = movedBox.x + movedBox.width / 2
  const my = movedBox.y + movedBox.height / 2
  await a.mouse.move(mx, my)
  await a.mouse.down()
  for (let i = 1; i <= 10; i += 1) await a.mouse.move(mx, my + (2.3 * pxPerInch * i) / 10)
  await a.mouse.up()
  await expect(moveLabel).toHaveText(`${firstLeg + 2}.0"`)
  await expect(table.locator('.overlay-move-start')).toHaveCount(1)

  // Tapping where the move started (with Move on) puts the operative back, ready again.
  await a.mouse.click(sx, sy)
  await expect(tableToken).toHaveAttribute('cx', startCx)
  await expect(table.locator('[data-token-id="t1"]')).not.toHaveClass(/is-active/)
  await expect(table.locator('.overlay-move')).toHaveCount(0)

  const dragDown = async (index, inches) => {
    const box = await a.locator('.map-stage .board-token-base').nth(index).boundingBox()
    const x0 = box.x + box.width / 2
    const y0 = box.y + box.height / 2
    await a.mouse.move(x0, y0)
    await a.mouse.down()
    for (let i = 1; i <= 10; i += 1) await a.mouse.move(x0, y0 + (inches * pxPerInch * i) / 10)
    await a.mouse.up()
  }
  // Back-tracking a move all the way to its start does the same. (Wait for the
  // iPad to show the reset first, so the test doesn't grab the old position.)
  await expect(a.locator('.map-stage .move-count[data-count-for="t1"]')).toHaveCount(0)
  await dragDown(0, 2.2)
  await expect(table.locator('[data-token-id="t1"]')).toHaveClass(/is-active/)
  // Wait for the iPad to show the settled move before grabbing the token again.
  await expect(a.locator('.map-stage .move-count[data-count-for="t1"]')).toHaveText('2.0"')
  await dragDown(0, -2.2)
  await expect(tableToken).toHaveAttribute('cx', startCx)
  await expect(table.locator('[data-token-id="t1"]')).not.toHaveClass(/is-active/)
  await expect(table.locator('.overlay-move')).toHaveCount(0)

  // Moving a second operative clears the first one's path: one path on the board at a time.
  await dragDown(0, 1.4)
  await expect(table.locator('.overlay-move.is-settled')).toHaveCount(1)
  await dragDown(1, 2.4)
  await expect(table.locator('.overlay-move.is-settled')).toHaveCount(1)
  await expect(table.locator('.move-count[data-count-for="t2"]')).toHaveText('2.0"')
  // The next operative to move expends the active one, flipping its order tag colour.
  await expect(table.locator('[data-token-id="t1"]')).toHaveClass(/is-expended/)
  await expect(table.locator('[data-order-for="t1"]')).toHaveAttribute('data-order-color', 'black')
  await expect(table.locator('[data-token-id="t2"]')).toHaveClass(/is-active/)
  await expect(aliceBoard.locator('.pb-turn-badge')).toHaveText('Activating')
  await shot(table, '06e-activation-table')

  // With Move on, tapping an operative goes back to its action ring (Move is off), and
  // tapping the empty map just ends moving.
  await tokenOf('t2').click()
  await expect(ring.getByRole('menuitem')).toHaveCount(10)
  await ring.getByRole('menuitem', { name: 'Move', exact: true }).click()
  await expect(ring).toHaveCount(0)
  await a.mouse.click(...emptySpot)
  await expect(table.locator('.overlay-ping')).toHaveCount(0)
  // (Now there's no tool, so the next tap pings.)
  await a.mouse.click(...emptySpot)
  await expect(table.locator('.overlay-ping')).toHaveCount(1)

  // Token pops out categories, then that category's tokens; picking one closes the list.
  const tokenButton = a.getByRole('button', { name: 'Token', exact: true })
  const tokenMenu = a.locator('.tool-rail .anchored-flyout')
  await expect(a.getByRole('button', { name: 'Marker', exact: true })).toHaveCount(0)
  await tokenButton.click()
  // Alice's (secret) tac op adds its own tokens: Plant Devices uses Device tokens.
  await expect(tokenMenu.locator('.flyout-category')).toHaveText([
    /Mission/,
    /Equipment/,
    /Hernkyn Yaegirs/,
    /Tac op · Plant Devices/,
    /Operative/,
    /General/,
  ])
  await tokenMenu.getByRole('button', { name: /Hernkyn Yaegirs/ }).click()
  await expect(tokenMenu.getByRole('button', { name: /Minefield/ })).toBeVisible()
  await shot(a, '07c-token-faction-list')
  await tokenMenu.getByRole('button', { name: '‹ Hernkyn Yaegirs' }).click()

  // Blank tokens drag freely: no 1" steps and no movement path.
  await tokenMenu.getByRole('button', { name: /General/ }).click()
  await tokenMenu.getByRole('button', { name: /Blank base/ }).click()
  await expect(tokenMenu).toHaveCount(0)
  await a.mouse.click(stageBox.x + stageBox.width / 2, stageBox.y + stageBox.height / 2)
  await expect(table.locator('.board-token')).toHaveCount(11)
  await expect(a.locator('.options-drawer')).toHaveCount(0)
  // With Token still on, it drags straight away.
  const blank = table.locator('.board-token-base').last()
  const blankCx = Number(await blank.getAttribute('cx'))
  const blankBox = await a.locator('.map-stage .board-token-base').last().boundingBox()
  const bx = blankBox.x + blankBox.width / 2
  const by = blankBox.y + blankBox.height / 2
  await a.mouse.move(bx, by)
  await a.mouse.down()
  for (let i = 1; i <= 10; i += 1) await a.mouse.move(bx + (1.5 * pxPerInch * i) / 10, by)
  await a.mouse.up()
  await expect.poll(async () => Number(await blank.getAttribute('cx')) - blankCx).toBeCloseTo(1.5, 1)
  // A free drag adds no path; the second operative's path from above is still the only one.
  await expect(table.locator('.overlay-move')).toHaveCount(1)

  // Every operative has a red Conceal order tag; tapping your own switches it to Engage.
  const theynTag = table.locator('[data-order-for="t1"]')
  await expect(table.locator('.board-order-tag')).toHaveCount(10)
  await expect(theynTag).toHaveAttribute('data-order', 'conceal')
  // Theyn was expended by the second move above, so his tag is already black.
  await expect(theynTag).toHaveAttribute('data-order-color', 'black')
  await a.locator('.map-stage [data-order-for="t1"]').click()
  await expect(theynTag).toHaveAttribute('data-order', 'engage')

  // Equipment markers go on the killzone with no options shown. (Token is still on, so
  // its button reopens the last list used.)
  await tokenButton.click()
  await tokenMenu.getByRole('button', { name: '‹ General' }).click()
  await tokenMenu.getByRole('button', { name: /Equipment/ }).click()
  await tokenMenu.getByRole('button', { name: /Ammo Cache/ }).click()
  await a.mouse.click(stageBox.x + stageBox.width * 0.55, stageBox.y + stageBox.height * 0.2)
  await expect(table.locator('[data-catalog-id="ammo-cache"]')).toHaveCount(1)
  await expect(table.locator('[data-catalog-id="ammo-cache"] .board-marker-label')).toHaveText('Ammo Cache')
  await expect(a.locator('.options-drawer')).toHaveCount(0)

  // An operative token dropped on an operative rides on it and follows it around.
  // With Token still on, its button reopens the last list used.
  await tokenButton.click()
  await tokenMenu.getByRole('button', { name: '‹ Equipment' }).click()
  await tokenMenu.getByRole('button', { name: /Operative/ }).click()
  await tokenMenu.getByRole('button', { name: /APL −1/ }).click()
  await a.locator('.map-stage [data-token-id="t1"] .board-token-base').click()
  const stun = table.locator('[data-catalog-id="apl-minus"]')
  await expect(stun).toHaveAttribute('data-attached-to', 't1')
  const stunCx = Number(await stun.locator('circle').getAttribute('cx'))
  // (Token is still on, which drags operatives too.)
  const theynBox = await a.locator('.map-stage [data-token-id="t1"] .board-token-base').boundingBox()
  const tx = theynBox.x + theynBox.width / 2
  const ty = theynBox.y + theynBox.height / 2
  await a.mouse.move(tx, ty)
  await a.mouse.down()
  for (let i = 1; i <= 10; i += 1) await a.mouse.move(tx + (2.2 * pxPerInch * i) / 10, ty)
  await a.mouse.up()
  await expect.poll(async () => Number(await stun.locator('circle').getAttribute('cx')) - stunCx).toBeCloseTo(2, 1)
  await shot(table, '07d-token-rides-operative')

  // On the projector Alice's pieces turn to read from Bob's seat (right edge, -90deg);
  // on her iPad they stay upright.
  await expect(table.locator('.board-token-name[data-facing="-90"]')).toHaveCount(10)
  await expect(theynTag).toHaveAttribute('data-facing', '-90')
  await expect(table.locator('[data-catalog-id="ammo-cache"] .board-marker-name')).toHaveAttribute('data-facing', '-90')
  await expect(stun.locator('.board-marker-name')).toHaveAttribute('data-facing', '-90')
  await expect(a.locator('.map-stage .board-token-name[data-facing="0"]')).toHaveCount(10)
  await expect(a.locator('.map-stage [data-order-for="t1"]')).toHaveAttribute('data-facing', '0')

  // Range, from the action ring, opens a second ring of distances; the one picked is
  // drawn round the operative until it's turned off. (Token off first: its button
  // reopens its list, then turns it off.)
  await tokenButton.click()
  await tokenButton.click()
  await ringAction(a, 't1', 'Range')
  await expect(ring.getByRole('menuitem')).toHaveText(['Off', '1"', '2"', '3"', '6"', 'Back'])
  await expect(ring.getByRole('menuitem', { name: 'No range' })).toHaveAttribute('aria-pressed', 'true')
  await a.waitForTimeout(250)
  await shot(a, '07r-range-ring')
  await ring.getByRole('menuitem', { name: '3" range' }).click()
  await expect(ring).toHaveCount(0)
  await expect(table.locator('[data-ring-for="t1"][data-ring="3"]')).toHaveCount(1)
  // Markers and tokens have a ring too: Move, Range, Edit (name, size, removal) and Ping.
  await a.locator('.map-stage [data-catalog-id="ammo-cache"] circle').first().click()
  const markerRing = a.locator('.unit-radial')
  await expect(markerRing.getByRole('menuitem')).toHaveText(['Move', 'Range', 'Edit', 'Ping'])
  await markerRing.getByRole('menuitem', { name: 'Edit' }).click()
  await expect(markerRing.getByRole('menuitem')).toHaveText(['Name', 'Size', 'Remove', 'Back'])
  await markerRing.getByRole('menuitem', { name: 'Back' }).click()
  await markerRing.getByRole('menuitem', { name: 'Ping' }).click()
  await expect(table.locator('.overlay-ping')).toHaveCount(1)
  await expect(markerRing).toHaveCount(0)

  // Edit (from the ring) changes anything on the board; the changes stay. Theyn has
  // moved this turning point, so his Edit ring can also undo that, as Select used to.
  await ringAction(a, 't1', 'Edit')
  const theynRing = a.locator('.unit-radial[data-ring-for="t1"]')
  await expect(theynRing.getByRole('menuitem')).toHaveText(['Name', 'Base size', 'Undo 1"', 'Undo move', 'Remove', 'Back'])
  await theynRing.getByRole('menuitem', { name: 'Name' }).click()
  await theynRing.getByRole('textbox', { name: 'Name' }).fill('Boss')
  await theynRing.getByRole('textbox', { name: 'Name' }).press('Enter')
  await expect(table.locator('.board-token-name').filter({ hasText: 'Boss' })).toHaveCount(1)
  const theynBase = table.locator('[data-token-id="t1"] .board-token-base')
  const theynR = Number(await theynBase.getAttribute('r'))
  await ringAction(a, 't1', 'Edit')
  await theynRing.getByRole('menuitem', { name: 'Base size' }).click()
  await theynRing.getByRole('menuitem', { name: '32mm base' }).click()
  await expect.poll(async () => Number(await theynBase.getAttribute('r'))).toBeGreaterThan(theynR)
  await ringAction(a, 't1', 'Edit')
  await theynRing.getByRole('menuitem', { name: 'Base size' }).click()
  await theynRing.getByRole('menuitem', { name: '28.5mm base' }).click()
  await expect.poll(async () => Number(await theynBase.getAttribute('r'))).toBeCloseTo(theynR, 3)
  await expect(table.locator('[data-ring-for="t1"][data-ring="3"]')).toHaveCount(1)
  // Markers resize too (they start at the official 20mm).
  await a.locator('.map-stage [data-catalog-id="ammo-cache"] circle').first().click()
  const cacheRing = a.locator('.unit-radial')
  await cacheRing.getByRole('menuitem', { name: 'Edit' }).click()
  await cacheRing.getByRole('menuitem', { name: 'Size' }).click()
  await expect(cacheRing.getByRole('menuitem', { name: '20mm' })).toHaveAttribute('aria-pressed', 'true')
  await cacheRing.getByRole('menuitem', { name: '25mm' }).click()
  await expect(table.locator('[data-catalog-id="ammo-cache"] circle')).toHaveAttribute('r', String(25 / 25.4 / 2))
  // Remove the blank base again (Remove asks to confirm).
  await a.locator('.map-stage .board-token:not(:has(.board-order-tag)) .board-token-base').last().click()
  await cacheRing.getByRole('menuitem', { name: 'Edit' }).click()
  await cacheRing.getByRole('menuitem', { name: 'Remove' }).click()
  await cacheRing.getByRole('menuitem', { name: 'Remove' }).click()
  await expect(table.locator('.board-token')).toHaveCount(10)

  // ---- shot card ----
  // Bob's Vespid Warrior has just moved (activating it) with Airborne Predators up,
  // and aims its neutron blaster at a Yaegir Warrior in the open.
  const aliceCp = Number(await aliceBoard.locator('.pb-stat.is-cp .pb-big-value').textContent())
  const bobCp = Number(await bobBoard.locator('.pb-stat.is-cp .pb-big-value').textContent())
  const beforeShot = await table.locator('.board-token').count()
  await tableActions(table, [
    { type: 'token/add', seat: 'B', label: 'Stinger', unitKey: 'TAU-VESP-WAR-9', maxWounds: 9, x: 8, y: 7.5, baseMm: 28.5, baseLocked: true },
    { type: 'token/add', seat: 'A', label: 'Mark', unitKey: 'VOT-HKY-WAR-9', maxWounds: 8, x: 8, y: 4, baseMm: 28.5, baseLocked: true },
    { type: 'unit/update', seat: 'B', unitKey: 'TAU-VESP-WAR-9', patch: { order: 'engage' } },
    { type: 'battle/togglePloy', seat: 'B', ployId: 'TAU-VESP-S-AP' },
  ])
  await expect(table.locator('.board-token')).toHaveCount(beforeShot + 2)
  const [stinger, mark] = (
    await table.locator('.board-token').evaluateAll((nodes) => nodes.map((node) => node.dataset.tokenId))
  ).slice(-2)
  await tableActions(table, [{ type: 'token/move', id: stinger, path: [{ x: 8, y: 7.5 }, { x: 8, y: 8.5 }] }])
  await expect(table.locator(`[data-token-id="${stinger}"]`)).toHaveClass(/is-active/)
  await openTab(b, 'Map')
  // An opponent's operative offers only Ping and Unit card in its ring.
  await b.locator(`.map-stage [data-token-id="${mark}"] .board-token-base`).click()
  await expect(b.locator('.unit-radial').getByRole('menuitem')).toHaveText(['Ping', 'Unit card'])
  // Ping from the ring marks that operative (even an opponent's) on the projector.
  await b.locator('.unit-radial').getByRole('menuitem', { name: 'Ping' }).click()
  await expect(b.locator('.unit-radial')).toHaveCount(0)
  const markX = Number(await table.locator(`[data-token-id="${mark}"] .board-token-base`).getAttribute('cx'))
  await expect.poll(async () => Number(await table.locator('.overlay-ping circle').first().getAttribute('cx'))).toBeCloseTo(markX, 2)
  // An opponent's unit card is read-only.
  await ringAction(b, mark, 'Unit card')
  const bobCard = b.getByRole('dialog', { name: 'Unit card' })
  await expect(bobCard.locator('.game-card')).toHaveCount(1)
  await expect(bobCard.getByLabel('Add status effect')).toHaveCount(0)
  await bobCard.getByRole('button', { name: 'Close' }).click()
  await ringAction(b, stinger, 'Shoot')
  await b.getByRole('dialog', { name: 'Choose a weapon' }).getByRole('button', { name: /Neutron Blaster/ }).click()
  await b.locator(`.map-stage [data-token-id="${mark}"] .board-token-base`).click()
  // The projector keeps the play area clear: Bob's side bar swaps to his attack and
  // Alice's to her defence. No distance or "check at the table" pills any more.
  const shotAttack = bobBoard.locator('[data-combat="attack"]')
  const shotDefence = aliceBoard.locator('[data-combat="defence"]')
  await expect(table.locator('.target-chip', { hasText: /AWAY|VISIBILITY/ })).toHaveCount(0)
  await expect(table.locator('.board-svg [data-combat], .board-svg .shot-card')).toHaveCount(0)
  // Neutron blaster 4 / 4+ / 3/3, Devastating 2. Warrior Instincts gives Accurate 1:
  // roll 3 and keep 1 without rolling.
  await expect(shotAttack.locator('[data-cell="dice"]')).toContainText('3 rolled + 1 auto')
  await expect(shotAttack.locator('[data-cell="dice"] [data-reason]')).toContainText(['Accurate 1 · Warrior Instincts'])
  await expect(shotAttack.locator('[data-cell="hit"]')).toContainText('4+')
  await expect(shotAttack.locator('[data-cell="dmg"]')).toContainText('3/3')
  await expect(shotAttack.locator('[data-cell="dmg"]')).toContainText('Devastating 2 per crit')
  // Strategy ploy and faction rule: Airborne Predators (Balanced) and Neutron Charge
  // (moved this turning point: Piercing 1, so the Yaegir rolls 2 dice, in red).
  await expect(bobBoard.locator('[data-modifier="TAU-VESP-S-AP"]')).toHaveAttribute('data-on', 'true')
  await expect(shotAttack.locator('[data-reroll]')).toHaveText(['↻ Balanced (1 die)'])
  await expect(shotDefence.locator('[data-cell="dice"]')).toHaveAttribute('data-tone', 'worse')
  await expect(shotDefence.locator('[data-cell="dice"]')).toContainText('2')
  // ...and says why, in a red pill: the weapon's Piercing 1, from Neutron Charge.
  const piercingPill = shotDefence.locator('[data-cell="dice"] [data-reason][data-tone="worse"]')
  await expect(piercingPill).toHaveText('▼ Piercing 1 · Neutron Charge')
  await expect(shotDefence.locator('[data-cell="save"]')).toContainText('4+')
  expect(await boardOverflows(table)).toEqual([])
  // Both iPads have a stats drawer on the right, closed until opened, with their own
  // half first.
  const bobDrawer = b.locator('.attack-drawer')
  const aliceDrawer = a.locator('.attack-drawer')
  await expect(bobDrawer).toHaveClass(/is-closed/)
  await expect(aliceDrawer).toHaveClass(/is-closed/)
  await b.getByRole('button', { name: 'Show the shot' }).click()
  await a.getByRole('button', { name: 'Show the incoming shot' }).click()
  await expect(bobDrawer.locator('[data-shot-half]').first()).toHaveAttribute('data-shot-half', 'attack')
  await expect(aliceDrawer.locator('.combat-matchup')).toHaveText('Vespid Warrior → Yaegir Warrior')
  await expect(aliceDrawer.locator('.combat-kind')).toHaveText('Incoming shot')
  await expect(aliceDrawer.locator('[data-shot-half]').first()).toHaveAttribute('data-shot-half', 'defence')
  await expect(aliceDrawer.locator('[data-shot-half="defence"] [data-cell="dice"] [data-reason][data-tone="worse"]')).toHaveText(
    '▼ Piercing 1 · Neutron Charge',
  )
  // Weapon rule pills in the drawer explain their rule when tapped.
  await bobDrawer.getByRole('button', { name: /^What is Devastating/ }).first().click()
  await expect(b.getByRole('dialog').getByRole('heading', { name: /Devastating/ })).toBeVisible()
  await b.getByRole('dialog').getByRole('button', { name: 'Close' }).click()
  // Alice records the hit from her drawer: the neutron blaster's 3, then heals 1.
  await expect(aliceDrawer.getByRole('button', { name: /Take \d+ damage/ })).toHaveCount(3)
  await aliceDrawer.getByRole('button', { name: 'Take 3 damage (normal hit)' }).click()
  await expect(shotDefence.locator('.pb-combat-wounds')).toHaveText('5/8 W')
  await aliceDrawer.getByRole('button', { name: 'Heal 1' }).click()
  await expect(shotDefence.locator('.pb-combat-wounds')).toHaveText('6/8 W')
  // Bob (shooting) has nothing coming back at him: just −1 / +1 for his own operative.
  await expect(bobDrawer.getByRole('button', { name: /Take \d+ damage \(/ })).toHaveCount(0)
  await shot(table, '07f-shot-sidebars-table')
  await shot(b, '07g-shot-drawer-attacker')
  // Alice uses Sturdy from her iPad: it spends her CP, and the attacker's crits become
  // normal successes (red on the projector and on Bob's iPad).
  const sturdy = aliceDrawer.locator('button[data-modifier="VOT-HKY-T-STRD"]')
  await expect(sturdy).toContainText('1CP')
  await sturdy.click()
  await expect(sturdy).toHaveAttribute('aria-pressed', 'true')
  await expect(shotDefence.locator('..').locator('.pb-combat-cp')).toHaveText(`${aliceCp - 1} CP`)
  await expect(shotAttack.locator('[data-cell="crit"]')).toHaveAttribute('data-tone', 'worse')
  await expect(bobDrawer.locator('[data-cell="crit"]')).toHaveClass(/is-worse/)
  // Bob can't touch Alice's modifiers.
  await expect(bobDrawer.locator('button[data-modifier="VOT-HKY-T-STRD"]')).toHaveCount(0)
  await shot(a, '07h-shot-drawer-defender')
  // Turning it off again in the same shot refunds it.
  await sturdy.click()
  await expect(aliceBoard.locator('.pb-combat-cp')).toHaveText(`${aliceCp} CP`)
  await expect(shotAttack.locator('[data-cell="crit"]')).toHaveAttribute('data-tone', 'same')
  // Done: once the Vespid's activation ends (expended), the shot's screens go: the side
  // bars go back and both drawers close.
  await tableActions(table, [{ type: 'unit/update', seat: 'B', unitKey: 'TAU-VESP-WAR-9', patch: { activation: 'expended' } }])
  await expect(table.locator('[data-combat]')).toHaveCount(0)
  await expect(bobDrawer).toHaveCount(0)
  await expect(aliceBoard.locator('.pb-stat.is-cp .pb-big-value')).toHaveText(String(aliceCp))
  await expect(aliceDrawer).toHaveCount(0)
  await tableActions(table, [
    { type: 'token/remove', id: stinger },
    { type: 'token/remove', id: mark },
    { type: 'battle/togglePloy', seat: 'B', ployId: 'TAU-VESP-S-AP' },
  ])
  await expect(bobBoard.locator('.pb-stat.is-cp .pb-big-value')).toHaveText(String(bobCp))
  await expect(table.locator('.board-token')).toHaveCount(beforeShot)

  // ---- fight ----
  // Bob's Vespid Warrior is in base contact with a Yaegir Warrior, and his Shadestrain
  // is also within its control range (an assist).
  await tableActions(table, [
    { type: 'token/add', seat: 'B', label: 'Biter', unitKey: 'TAU-VESP-WAR-8', maxWounds: 9, x: 8, y: 12, baseMm: 28.5, baseLocked: true },
    { type: 'token/add', seat: 'A', label: 'Brawler', unitKey: 'VOT-HKY-WAR-8', maxWounds: 8, x: 8, y: 10.8, baseMm: 28.5, baseLocked: true },
    { type: 'token/add', seat: 'B', label: 'Helper', unitKey: 'TAU-VESP-VSS-8', maxWounds: 9, x: 9.2, y: 10.8, baseMm: 28.5, baseLocked: true },
  ])
  await expect(table.locator('.board-token')).toHaveCount(beforeShot + 3)
  const [biter, brawler, helper] = (
    await table.locator('.board-token').evaluateAll((nodes) => nodes.map((node) => node.dataset.tokenId))
  ).slice(-3)
  // Fight from the ring: the list shows its melee weapons.
  await ringAction(b, biter, 'Fight')
  const bobWeapons = b.getByRole('dialog', { name: 'Choose a weapon' })
  await bobWeapons.getByRole('button', { name: /Claws/ }).click()
  await b.locator(`.map-stage [data-token-id="${brawler}"] .board-token-base`).click()
  await expect(table.locator('[data-fight-line]')).toHaveCount(1)
  await expect(table.locator(`[data-assist-for="${helper}"]`)).toHaveCount(1)
  // Claws 3 / 4+ / 3/4, one assist: Hit 3+ (green). Alice retaliates with her first
  // melee weapon until she picks another in her drawer.
  const fightAttack = bobBoard.locator('[data-combat="attack"]')
  const retaliation = aliceBoard.locator('[data-combat="defence"]')
  await expect(fightAttack.locator('h3')).toHaveText('Fight')
  await expect(fightAttack.locator('[data-cell="hit"]')).toHaveAttribute('data-tone', 'better')
  await expect(fightAttack.locator('[data-cell="hit"]')).toContainText('3+')
  await expect(fightAttack.locator('[data-cell="hit"] [data-reason][data-tone="better"]')).toHaveText('▲ Assist · Hit +1')
  await expect(retaliation.locator('h3')).toHaveText('Retaliate')
  await expect(retaliation).toContainText('Fists')
  await a.getByRole('button', { name: 'Show the incoming fight' }).click()
  await aliceDrawer.getByRole('group', { name: 'Retaliate with' }).getByRole('button', { name: 'Plasma Knife' }).click()
  await expect(retaliation).toContainText('Plasma Knife')
  await expect(retaliation.locator('[data-cell="dice"]')).toContainText('4')
  expect(await boardOverflows(table)).toEqual([])
  await shot(table, '07i-fight-sidebars-table')
  await shot(a, '07j-fight-drawer-defender')
  // Taken out, the Yaegir's fight stays up until another operative activates.
  await tableActions(table, [{ type: 'unit/update', seat: 'A', unitKey: 'VOT-HKY-WAR-8', patch: { dead: true } }])
  await expect(table.locator('[data-combat]')).not.toHaveCount(0)
  await tableActions(table, [{ type: 'unit/update', seat: 'B', unitKey: 'TAU-VESP-VSS-8', patch: { activation: 'active' } }])
  await expect(table.locator('[data-combat]')).toHaveCount(0)
  await tableActions(table, [{ type: 'unit/update', seat: 'A', unitKey: 'VOT-HKY-WAR-8', patch: { dead: false } }])
  // With the fight closed, the two stay marked as engaged (within control range) until
  // they move apart.
  await expect(table.locator(`[data-engaged="${biter}|${brawler}"]`)).toHaveCount(1)
  await expect(table.locator(`[data-engaged-ring="${brawler}"]`)).toHaveCount(1)
  await tableActions(table, [{ type: 'token/update', id: brawler, x: 14, y: 10.8 }])
  await expect(table.locator(`[data-engaged-ring="${brawler}"]`)).toHaveCount(0)
  await tableActions(table, [biter, brawler, helper].map((id) => ({ type: 'token/remove', id })))
  await expect(table.locator('.board-token')).toHaveCount(beforeShot)
  await openTab(b, 'Operatives')

  await openTab(a, 'Operatives')

  // Unit card state drives the projector token: active glows, expended dims, dead goes off the board.
  const theynCard = a.locator('.game-card', { hasText: 'Yeagir Theyn' })
  const theynToken = table.locator('[data-token-id="t1"]')
  // Theyn is expended; the status pill still works by hand (expended -> ready -> active).
  await theynCard.locator('button.state-pill').click()
  await expect(theynToken).not.toHaveClass(/is-expended/)
  await theynCard.locator('button.state-pill').click()
  await expect(theynToken).toHaveClass(/is-active/)
  await expect(theynToken.locator('.board-token-glow')).toHaveCount(1)
  await expect(aliceBoard.locator('.pb-pips .pb-pip.is-active')).toHaveCount(1)
  await expect(aliceBoard.locator('.pb-ready-count')).toContainText('8')
  await shot(table, '10b-active-glow')
  await theynCard.locator('button.state-pill').click()
  await expect(theynToken).toHaveClass(/is-expended/)
  // Expending swaps the order tag's colour.
  await expect(theynTag).toHaveAttribute('data-order-color', 'black')
  await expect(theynToken.locator('.board-token-glow')).toHaveCount(0)
  await expect(aliceBoard.locator('.pb-pips .pb-pip.is-expended')).toHaveCount(2)
  const bladeCard = a.locator('.game-card', { hasText: 'Bladekyn' })
  const bladeTag = table.locator('[data-order-for="t2"]')
  // Bladekyn was expended in TP1 when Theyn activated after it.
  await expect(bladeTag).toHaveAttribute('data-order-color', 'black')
  const healthBar = theynCard.locator('.health-bar')
  const barBox = await healthBar.boundingBox()
  const hit = () => healthBar.click({ position: { x: 2, y: barBox.height / 2 } })
  // Wound badge under the token: hidden at full health, n/total once damaged, red when injured.
  const badge = theynToken.locator('.board-token-wounds')
  await expect(badge).toHaveCount(0)
  await hit()
  await expect(badge).toHaveClass(/is-damaged/)
  await expect(badge).toHaveText('8/9')
  for (let i = 0; i < 4; i += 1) await hit()
  await expect(badge).toHaveClass(/is-injured/)
  await expect(badge).toHaveText('4/9')
  await expect(badge.locator('.board-token-wounds-glow')).toHaveCount(1)
  await shot(table, '10b2-injured-badge')
  for (let i = 0; i < 4; i += 1) await hit()
  await expect(badge).toHaveCount(0)
  await expect(theynToken).toHaveClass(/is-dead/)
  await expect(theynToken.locator('.board-token-skull')).toHaveCount(1)
  // Dead operatives lose their order tag, rings and riding tokens.
  await expect(theynTag).toHaveCount(0)
  await expect(stun).toHaveCount(0)
  await expect(table.locator('[data-ring-for="t1"]')).toHaveCount(0)
  // Map 2, drop zone A: Alice sits on the left, facing her panel (left of the mat).
  // Her left is the far (top) end, so the casualty sits above the mat, beside her panel.
  const deadBase = theynToken.locator('.board-token-base')
  expect(Number(await deadBase.getAttribute('cy'))).toBeLessThan(0)
  const deadCx = Number(await deadBase.getAttribute('cx'))
  expect(deadCx).toBeLessThan(-0.5)
  expect(deadCx).toBeGreaterThan(-8.5)
  await shot(table, '10c-dead-offboard')
  expect(await boardOverflows(table)).toEqual([])
  // Bob's board counts the kill against Alice's 10 starting operatives.
  await expect(aliceBoard.locator('.pb-pips .pb-pip.is-dead')).toHaveCount(1)
  await expect(bobBoard.locator('.pb-kills')).toContainText('1 / 10')
  // The iPad map leaves dead operatives out (the projector keeps them in the casualty row).
  await openTab(b, 'Map')
  const projectorTokens = await table.locator('.board-token').count()
  await expect(b.locator('.map-stage .board-token')).toHaveCount(projectorTokens - 1)
  await expect(b.locator('.map-stage [data-token-id="t1"]')).toHaveCount(0)
  await openTab(b, 'Operatives')

  // Next TP asks for confirmation and explains what happens; the turning point moves on
  // once both players have confirmed (and only once).
  await a.getByRole('button', { name: 'Next TP' }).click()
  await expect(a.getByRole('heading', { name: 'End turning point 1?' })).toBeVisible()
  await shot(a, '11-end-turn-ipad')
  await a.getByRole('button', { name: 'Ready for TP 2' }).click()
  await expect(a.getByRole('button', { name: /Waiting for Bob/ })).toBeVisible()
  await expect(b.locator('.play-phase')).toContainText('Turning point 1')
  await b.getByRole('button', { name: 'Next TP · Alice is ready' }).click()
  await b.getByRole('button', { name: 'Ready for TP 2' }).click()
  await expect(b.locator('.play-phase')).toContainText('Turning point 2')
  await expect(a.locator('.play-phase')).toContainText('Turning point 2')

  // TP2: both gain 1 CP (3 -> 4); the player WITHOUT initiative gains 2 instead.
  await expect(b.getByRole('button', { name: 'Start firefight' })).toBeDisabled()
  await b.locator('.rolloff-option', { hasText: 'Alice' }).click()
  await a.getByRole('button', { name: 'I take initiative' }).click()
  await expect(b.getByText('You have no initiative: 2CP instead of 1')).toBeVisible()
  await expect(a.getByText('Bob has no initiative: 2CP instead of 1')).toBeVisible()
  // Bob's played Re-roll card is gone; losing this roll-off earned him the ±2 card.
  await expect(b.locator('.init-card')).toHaveText([/±2/])
  await expect(bobBoard.locator('.pb-stat.is-cp .pb-big-value')).toHaveText('5')
  await expect(aliceBoard.locator('.pb-stat.is-cp .pb-big-value')).toHaveText('4')
  await shot(b, '12-strategy-tp2-ipad')

  // Order tag colours carry over the turning point: expended in TP1 (black) stays black,
  // and expending again in TP2 swaps it back to red.
  await expect(bladeTag).toHaveAttribute('data-order-color', 'black')
  await a.getByRole('button', { name: 'Start firefight' }).click()
  await bladeCard.locator('button.state-pill').click()
  await bladeCard.locator('button.state-pill').click()
  await expect(bladeTag).toHaveAttribute('data-order-color', 'red')

  // Reloading an iPad reclaims the seat and the game.
  await b.reload()
  await expect(b.locator('.play-name')).toHaveText('Bob')
  await expect(b.locator('.play-phase')).toContainText('Turning point 2')

  // Play out to the end: primary op is revealed and counted.
  for (const tp of [2, 3, 4]) {
    if (tp > 2) {
      await b.locator('.rolloff-option', { hasText: 'Bob' }).click()
      await b.getByRole('button', { name: 'I take initiative' }).click()
    }
    await b.getByRole('button', { name: 'Start firefight' }).click()
    // Alice's strategy sheet covers her header until she starts the firefight too.
    await expect(a.locator('.play-phase')).toContainText(`Turning point ${tp}`)
    const aliceFirefight = a.getByRole('button', { name: 'Start firefight' })
    if (await aliceFirefight.isVisible()) await aliceFirefight.click()
    for (const page of [a, b]) {
      await page.locator('.play-header').getByRole('button', { name: tp === 4 ? /^End game/ : /^Next TP/ }).click()
      await page.getByRole('button', { name: tp === 4 ? 'Ready to end' : `Ready for TP ${tp + 1}` }).click()
    }
  }
  await expect(a.getByRole('heading', { name: 'Alice wins' })).toBeVisible()
  // Each iPad's VP counter now includes its primary op, matching the projector:
  // Alice's primary is Crit op, where she scored 2, so 2 + 1.
  await expect(a.locator('.play-counters .counter.is-button .counter-value')).toHaveText('3')
  await expect(aliceBoard.locator('.pb-stat.is-vp .pb-big-value')).toHaveText('3')
  // The clock stops on the final time.
  await expect(table.locator('.table-clock')).toHaveAttribute('data-clock', 'final')
  await shot(a, '13-results-ipad')
  await shot(table, '14-results-table')

  // Map 1 puts players on the long edges, so the boards turn portrait (0deg / 180deg).
  await table.evaluate(
    () =>
      new Promise((resolve) => {
        const socket = new WebSocket(`ws://${window.location.host}/ws`)
        socket.onopen = () => {
          socket.send(JSON.stringify({ type: 'hello', role: 'table' }))
          socket.send(JSON.stringify({ type: 'action', action: { type: 'setup/map', mapId: 'map_01', arrangementId: 'arr_01' } }))
          setTimeout(resolve, 300)
        }
      }),
  )
  await expect(table.locator('.pb-board.is-portrait')).toHaveCount(2)
  // Map 1 seats A at the bottom and B at the top: A's names turn 180deg to face B, B's stay upright.
  await table.evaluate(
    () =>
      new Promise((resolve) => {
        const socket = new WebSocket(`ws://${window.location.host}/ws`)
        socket.onopen = () => {
          socket.send(JSON.stringify({ type: 'hello', role: 'table' }))
          socket.send(JSON.stringify({ type: 'action', action: { type: 'token/add', seat: 'A', label: 'Alpha', x: 10, y: 5 } }))
          socket.send(JSON.stringify({ type: 'action', action: { type: 'token/add', seat: 'B', label: 'Bravo', x: 20, y: 20 } }))
          setTimeout(resolve, 300)
        }
      }),
  )
  await expect(table.locator('.board-token-name', { hasText: 'Alpha' })).toHaveAttribute('data-facing', '180')
  await expect(table.locator('.board-token-name', { hasText: 'Bravo' })).toHaveAttribute('data-facing', '0')
  await shot(table, '15-portrait-boards')
  expect(await boardOverflows(table)).toEqual([])

  // Portrait side bars during a shot: the numbers become a ledger that uses the tall
  // bar, the text keeps its size, and nothing spills.
  await tableActions(table, [
    { type: 'token/add', seat: 'B', label: 'Gun', unitKey: 'TAU-VESP-WAR-7', maxWounds: 9, x: 12, y: 15, baseMm: 28.5, baseLocked: true },
    { type: 'token/add', seat: 'A', label: 'Prey', unitKey: 'VOT-HKY-WAR-7', maxWounds: 8, x: 12, y: 11, baseMm: 28.5, baseLocked: true },
    { type: 'unit/update', seat: 'B', unitKey: 'TAU-VESP-WAR-7', patch: { order: 'engage' } },
  ])
  const [gun, prey] = (await table.locator('.board-token').evaluateAll((nodes) => nodes.map((node) => node.dataset.tokenId))).slice(-2)
  await openTab(b, 'Map')
  await ringAction(b, gun, 'Shoot')
  await b.getByRole('dialog', { name: 'Choose a weapon' }).getByRole('button', { name: /Neutron Blaster/ }).click()
  await b.locator(`.map-stage [data-token-id="${prey}"] .board-token-base`).click()
  await expect(table.locator('.pb-board.is-portrait.is-combat')).toHaveCount(2)
  const tileLefts = await table
    .locator('.pb-board[data-seat="B"] [data-combat="attack"] [data-cell]')
    .evaluateAll((tiles) => tiles.map((tile) => tile.offsetLeft))
  expect(new Set(tileLefts).size).toBe(1)
  const fits = () =>
    table.locator('.pb-board').evaluateAll((boards) => boards.map((board) => Number(board.style.getPropertyValue('--fit') || 1)))
  await expect.poll(async () => Math.min(...(await fits()))).toBeGreaterThanOrEqual(0.8)
  expect(await boardOverflows(table)).toEqual([])
  await shot(table, '16-portrait-combat')
})

test('projector calibration warps the board and persists on the server', async ({ browser }) => {
  const context = await browser.newContext({ viewport: PROJECTOR })
  const page = await context.newPage()
  await page.goto('/table/calibrate')
  const handles = page.locator('.calibrate-handle')
  await expect(handles).toHaveCount(4)

  // Drag the top-left corner in to simulate keystone correction.
  const box = await handles.first().boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + 120, box.y + 80, { steps: 5 })
  await page.mouse.up()
  await page.keyboard.press('2')
  await page.keyboard.press('Shift+ArrowLeft')
  await shot(page, '11-calibrate')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page).toHaveURL(/\/table$/)

  // A fresh projector browser picks the calibration up from the server.
  const fresh = await (await browser.newContext({ viewport: PROJECTOR })).newPage()
  await fresh.goto('/table')
  await expect(fresh.locator('.table-plane')).toHaveAttribute('style', /matrix3d/)
  const transform = await fresh.locator('.table-plane').evaluate((element) => element.style.transform)
  const original = await page.locator('.table-plane').evaluate((element) => element.style.transform)
  expect(transform).toBe(original)
  await shot(fresh, '12-calibrated')
})
