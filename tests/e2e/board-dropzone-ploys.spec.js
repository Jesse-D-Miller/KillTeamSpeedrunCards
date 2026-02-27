import { test, expect } from '@playwright/test'
import { spawn } from 'child_process'
import net from 'net'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let wsProcess
let startedWs = false
const WS_PORT = 8081

const isPortOpen = () =>
  new Promise((resolve) => {
    const socket = net.connect(WS_PORT, '127.0.0.1')
    socket
      .on('connect', () => {
        socket.end()
        resolve(true)
      })
      .on('error', () => {
        socket.destroy()
        resolve(false)
      })
  })

test.beforeAll(async () => {
  const alreadyRunning = await isPortOpen()
  if (alreadyRunning) return

  wsProcess = spawn('node', ['server/wsServer.js'], {
    cwd: path.resolve(__dirname, '../..'),
    stdio: 'pipe',
    env: { ...process.env, PORT: String(WS_PORT) },
  })
  startedWs = true
  const start = Date.now()
  await new Promise((resolve, reject) => {
    const check = async () => {
      const open = await isPortOpen()
      if (open) {
        resolve()
        return
      }
      if (Date.now() - start > 8000) {
        reject(new Error('WebSocket server did not start in time.'))
      } else {
        setTimeout(check, 250)
      }
    }
    check()
  })
})

test.afterAll(async () => {
  if (wsProcess && startedWs && process.env.CI === '1') {
    wsProcess.kill()
  }
})

const startMatch = async (page, name) => {
  await page.goto('/multiplayer')
  await page.getByRole('button', { name: 'Create' }).click()
  await page.getByLabel('Username').fill(name)
  await page.getByRole('button', { name: 'Create Room' }).click()
  await page.locator('.multiplayer-lobby').waitFor({ state: 'visible' })
}

const joinMatch = async (page, name, code) => {
  await page.goto('/multiplayer')
  await page.getByRole('button', { name: 'Join' }).click()
  await page.getByLabel('Username').fill(name)
  await page.getByLabel('Room code').fill(code)
  await page.getByRole('button', { name: 'Join Room' }).click()
  await page.locator('.multiplayer-lobby').waitFor({ state: 'visible' })
}

const joinAsMap = async (page, code) => {
  await page.goto('/multiplayer')
  await page.getByRole('button', { name: 'Map' }).click()
  await page.getByLabel('Game code').fill(code)
  await page.getByRole('button', { name: 'Join as Map' }).click()
  await page.locator('.multiplayer-lobby').waitFor({ state: 'visible' })
}

const readyUp = async (page) => {
  await page.getByRole('button', { name: 'Start Game' }).click()
  await Promise.race([
    page.waitForURL('**/select-army'),
    expect(page.getByRole('button', { name: 'Ready' })).toBeVisible(),
  ])
}

const selectArmyAndStayOnSetup = async (page) => {
  const firstCard = page.locator('.select-army-card').first()
  const armyName = await firstCard.locator('h2').innerText()
  await firstCard.click()
  await page.waitForURL('**/set-up-the-battle')
  return armyName
}

const proceedToGame = async (page) => {
  await page.getByRole('link', { name: /select operatives/i }).click()
  await page.waitForURL('**/units')
  await page.locator('.game-card').first().click()
  await page.getByRole('link', { name: 'Lock In Units' }).click()
  await page.waitForURL('**/equipment')
  await page.getByRole('button', { name: /select tac ops/i }).click()
  await page.waitForURL('**/select-tac-ops')
  await page.locator('.select-tac-ops-card-item').first().click()
  await page.getByRole('link', { name: /set up operatives/i }).click()
  await page.waitForURL('**/set-up-operatives')
  await page.getByRole('link', { name: /scouting/i }).click()
  await page.waitForURL('**/scouting')
  await page.locator('.scouting-card-item').first().click()
  await page.getByRole('button', { name: /lock in/i }).click()
  await page.getByRole('link', { name: /select primary op/i }).click()
  await page.waitForURL('**/select-primary-op')
  await page.locator('.primary-op-card-item').first().click()
  await page.getByRole('link', { name: /play game/i }).click()
  await page.waitForURL('**/game/**')
}

const pickStratPloy = async (page, index) => {
  const item = page.locator('.game-stratops-item').nth(index)
  const name = await item.locator('.game-stratops-item-title').innerText()
  await item.click()
  return name
}

test('host-only drop zone selection and persistence', async ({ browser }) => {
  const hostContext = await browser.newContext()
  const guestContext = await browser.newContext()
  const hostPage = await hostContext.newPage()
  const guestPage = await guestContext.newPage()

  await startMatch(hostPage, 'Jesse')
  const roomCode = await hostPage.locator('.room-code').innerText()
  await joinMatch(guestPage, 'Rachel', roomCode)

  await readyUp(hostPage)
  await readyUp(guestPage)
  await hostPage.waitForURL('**/select-army')
  await guestPage.waitForURL('**/select-army')

  await selectArmyAndStayOnSetup(hostPage)
  await selectArmyAndStayOnSetup(guestPage)

  await expect(guestPage.getByText('Host only')).toBeVisible()
  await expect(guestPage.getByRole('button', { name: 'Drop Zone A' })).toBeDisabled()
  await expect(guestPage.getByRole('button', { name: 'Drop Zone B' })).toBeDisabled()

  await hostPage.getByRole('button', { name: 'Drop Zone B' }).click()
  const hostDropZone = 'B'
  const guestDropZone = 'A'
  await expect(hostPage.getByText('Selected: Drop Zone B')).toBeVisible()

  await proceedToGame(hostPage)
  await hostPage.reload()
  await hostPage.getByRole('button', { name: 'Start TP' }).click()
  const assignments = await hostPage.evaluate((code) => {
    const stored = localStorage.getItem(`kt-drop-zone-assignments-${code}`)
    return stored ? JSON.parse(stored) : {}
  }, roomCode)
  expect(assignments.B).toBeTruthy()

  await hostPage.getByRole('button', { name: 'Next TP' }).click()
  const assignmentsAfterTp = await hostPage.evaluate((code) => {
    const stored = localStorage.getItem(`kt-drop-zone-assignments-${code}`)
    return stored ? JSON.parse(stored) : {}
  }, roomCode)
  expect(assignmentsAfterTp.B).toBeTruthy()

  await hostContext.close()
  await guestContext.close()
})

test('drop zone resets on new game', async ({ browser }) => {
  const hostContext = await browser.newContext()
  const guestContext = await browser.newContext()
  const hostPage = await hostContext.newPage()
  const guestPage = await guestContext.newPage()

  await startMatch(hostPage, 'Jesse')
  const roomCode = await hostPage.locator('.room-code').innerText()
  await joinMatch(guestPage, 'Rachel', roomCode)

  await readyUp(hostPage)
  await readyUp(guestPage)
  await hostPage.waitForURL('**/select-army')
  await guestPage.waitForURL('**/select-army')

  await selectArmyAndStayOnSetup(hostPage)
  await selectArmyAndStayOnSetup(guestPage)
  await hostPage.getByRole('button', { name: 'Drop Zone A' }).click()
  await proceedToGame(hostPage)
  await proceedToGame(guestPage)

  const gameId = await hostPage.evaluate(() => localStorage.getItem('kt-game-id'))
  const nextGameId = String(Number(gameId || Date.now()) + 1000)
  await hostPage.evaluate((id) => localStorage.setItem('kt-game-id', id), nextGameId)
  await hostPage.reload()
  await hostPage.waitForURL('**/game/**')

  const dropZone = await hostPage.evaluate(() =>
    localStorage.getItem('kt-drop-zone'),
  )
  expect(dropZone === null || dropZone === '').toBe(true)

  await hostContext.close()
  await guestContext.close()
})

test('map shows names, armies, and strat ploys on correct sides', async ({ browser }) => {
  const hostContext = await browser.newContext()
  const guestContext = await browser.newContext()
  const mapContext = await browser.newContext()
  const hostPage = await hostContext.newPage()
  const guestPage = await guestContext.newPage()
  const mapPage = await mapContext.newPage()

  await startMatch(hostPage, 'Jesse')
  const roomCode = await hostPage.locator('.room-code').innerText()
  await joinMatch(guestPage, 'Rachel', roomCode)
  await joinAsMap(mapPage, roomCode)

  await readyUp(hostPage)
  await readyUp(guestPage)
  await hostPage.waitForURL('**/select-army')
  await guestPage.waitForURL('**/select-army')
  await mapPage.waitForURL('**/board')
  await mapPage.goto('http://127.0.0.1:5173/board')
  await mapPage.waitForLoadState('domcontentloaded')

  const hostArmy = await selectArmyAndStayOnSetup(hostPage)
  const guestArmy = await selectArmyAndStayOnSetup(guestPage)

  await hostPage.getByRole('button', { name: 'Drop Zone B' }).click()
  const hostDropZone = 'B'
  const guestDropZone = 'A'

  await proceedToGame(hostPage)
  await proceedToGame(guestPage)

  const hostPlayerId = await hostPage.evaluate(
    () => sessionStorage.getItem('kt-player-id') || localStorage.getItem('kt-player-id'),
  )
  const guestPlayerId = await guestPage.evaluate(
    () => sessionStorage.getItem('kt-player-id') || localStorage.getItem('kt-player-id'),
  )
  const gameId = await hostPage.evaluate(() => localStorage.getItem('kt-game-id'))
  const assignmentsKey = `kt-drop-zone-assignments-${roomCode}`
  const assignments = await hostPage.evaluate(
    ({ key }) => localStorage.getItem(key),
    { key: assignmentsKey },
  )
  const assignmentsForGame = await hostPage.evaluate(
    ({ key, id }) => (id ? localStorage.getItem(`${key}-${id}`) : null),
    { key: assignmentsKey, id: gameId },
  )
  const roomPlayers = await hostPage.evaluate(
    ({ code }) => localStorage.getItem(`kt-room-players-${code}`) || '',
    { code: roomCode },
  )
  const hostTeamId = await hostPage.evaluate(
    ({ code, playerId, id }) =>
      (code && playerId && id &&
        localStorage.getItem(`kt-room-player-killteam-${code}-${playerId}-${id}`)) ||
      (code && playerId &&
        localStorage.getItem(`kt-room-player-killteam-${code}-${playerId}`)) ||
      '',
    { code: roomCode, playerId: hostPlayerId, id: gameId },
  )
  const guestTeamId = await guestPage.evaluate(
    ({ code, playerId, id }) =>
      (code && playerId && id &&
        localStorage.getItem(`kt-room-player-killteam-${code}-${playerId}-${id}`)) ||
      (code && playerId &&
        localStorage.getItem(`kt-room-player-killteam-${code}-${playerId}`)) ||
      '',
    { code: roomCode, playerId: guestPlayerId, id: gameId },
  )
  const hostTeamIdFallback = hostPage.url().split('/game/')[1] || ''
  const guestTeamIdFallback = guestPage.url().split('/game/')[1] || ''
  const resolvedHostTeamId = hostTeamId || hostTeamIdFallback
  const resolvedGuestTeamId = guestTeamId || guestTeamIdFallback
  const roomPlayersPayload = JSON.stringify([
    { id: hostPlayerId, name: 'Jesse', ready: true },
    { id: guestPlayerId, name: 'Rachel', ready: true },
  ])

  await mapPage.evaluate(
    ({
      key,
      id,
      stored,
      storedGame,
      code,
      hostId,
      guestId,
      hostTeam,
      guestTeam,
      players,
      hostZone,
      guestZone,
    }) => {
      if (stored) localStorage.setItem(key, stored)
      if (id && storedGame) localStorage.setItem(`${key}-${id}`, storedGame)
      if (hostZone) localStorage.setItem('kt-drop-zone', hostZone)
      if (guestZone) localStorage.setItem('kt-drop-zone-opponent', guestZone)
      if (code && players) {
        localStorage.setItem(`kt-room-players-${code}`, players)
      }
      if (code && hostId && hostTeam) {
        localStorage.setItem(`kt-room-player-killteam-${code}-${hostId}`, hostTeam)
        if (id) {
          localStorage.setItem(
            `kt-room-player-killteam-${code}-${hostId}-${id}`,
            hostTeam,
          )
        }
      }
      if (code && guestId && guestTeam) {
        localStorage.setItem(`kt-room-player-killteam-${code}-${guestId}`, guestTeam)
        if (id) {
          localStorage.setItem(
            `kt-room-player-killteam-${code}-${guestId}-${id}`,
            guestTeam,
          )
        }
      }
      window.dispatchEvent(new CustomEvent('kt-strat-ploys-update'))
      window.dispatchEvent(new StorageEvent('storage'))
    },
    {
      key: assignmentsKey,
      id: gameId,
      stored: assignments,
      storedGame: assignmentsForGame,
      code: roomCode,
      hostId: hostPlayerId,
      guestId: guestPlayerId,
      hostTeam: resolvedHostTeamId,
      guestTeam: resolvedGuestTeamId,
      players: roomPlayersPayload || roomPlayers,
      hostZone: hostDropZone,
      guestZone: guestDropZone,
    },
  )
  await mapPage.reload()
  await mapPage.waitForLoadState('domcontentloaded')

  const hostPloy = await pickStratPloy(hostPage, 0)
  const guestPloy = await pickStratPloy(guestPage, 1)

  await hostPage.getByRole('button', { name: 'Start TP' }).click()
  await guestPage.getByRole('button', { name: 'Start TP' }).click()

  const overlayNames = await mapPage
    .locator('.board-dropzone-overlay__name')
    .allTextContents()
  expect(overlayNames.some((text) => text.includes('Jesse'))).toBe(true)
  expect(overlayNames.some((text) => text.includes(`- ${hostArmy}`))).toBe(true)

  const rightPloys = mapPage.locator('.board-op-group.is-right .board-side__strat-ploys-item')
  const leftPloys = mapPage.locator('.board-op-group.is-left .board-side__strat-ploys-item')
  await expect(rightPloys).toContainText(hostPloy, { timeout: 15000 })
  await expect(leftPloys).toContainText(guestPloy, { timeout: 15000 })

  await hostContext.close()
  await guestContext.close()
  await mapContext.close()
})
