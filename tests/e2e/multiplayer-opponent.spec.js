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
  const lobby = page.locator('.multiplayer-lobby')
  const error = page.locator('.multiplayer-error')
  await Promise.race([
    lobby.waitFor({ state: 'visible' }),
    error.waitFor({ state: 'visible' }),
  ])
  if (await error.isVisible()) {
    const errorMessage = await error.textContent()
    throw new Error(errorMessage || 'Multiplayer create failed.')
  }
}

const joinMatch = async (page, name, code) => {
  await page.goto('/multiplayer')
  await page.getByRole('button', { name: 'Join' }).click()
  await page.getByLabel('Username').fill(name)
  await page.getByLabel('Room code').fill(code)
  await page.getByRole('button', { name: 'Join Room' }).click()
  const lobby = page.locator('.multiplayer-lobby')
  const error = page.locator('.multiplayer-error')
  await Promise.race([
    lobby.waitFor({ state: 'visible' }),
    error.waitFor({ state: 'visible' }),
  ])
  if (await error.isVisible()) {
    const errorMessage = await error.textContent()
    throw new Error(errorMessage || 'Multiplayer join failed.')
  }
}

const selectFirstTeamAndStart = async (page) => {
  await page.waitForURL('**/select-army')
  await page.locator('.select-army-card').first().click()
  await page.waitForURL('**/set-up-the-battle')
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

const closeStratOpsModal = async (page) => {
  const startTpButton = page.getByRole('button', { name: 'Start TP' })
  if (await startTpButton.isVisible()) {
    await startTpButton.click()
  }
}

test('opponent view shows synced units', async ({ browser }) => {
  const hostContext = await browser.newContext()
  const guestContext = await browser.newContext()
  const hostPage = await hostContext.newPage()
  const guestPage = await guestContext.newPage()

  await startMatch(hostPage, 'Host')
  const roomCode = await hostPage.locator('.room-code').innerText()

  await joinMatch(guestPage, 'Guest', roomCode)

  await hostPage.getByRole('button', { name: 'Start Game' }).click()
  await guestPage.getByRole('button', { name: 'Start Game' }).click()
  await Promise.race([
    hostPage.waitForURL('**/select-army'),
    expect(hostPage.getByRole('button', { name: 'Ready' })).toBeVisible(),
  ])
  await Promise.race([
    guestPage.waitForURL('**/select-army'),
    expect(guestPage.getByRole('button', { name: 'Ready' })).toBeVisible(),
  ])
  await hostPage.waitForURL('**/select-army')
  await guestPage.waitForURL('**/select-army')

  await selectFirstTeamAndStart(hostPage)
  await selectFirstTeamAndStart(guestPage)

  await closeStratOpsModal(hostPage)
  await closeStratOpsModal(guestPage)

  await expect(
    hostPage.evaluate(() => localStorage.getItem('kt-room-code')),
  ).resolves.toBeTruthy()
  await expect(
    hostPage.evaluate(() => localStorage.getItem('kt-player-name')),
  ).resolves.toBeTruthy()
  await expect(
    guestPage.evaluate(() => localStorage.getItem('kt-player-name')),
  ).resolves.toBeTruthy()

  await hostPage.getByRole('button', { name: 'Opponent' }).click()
  await hostPage.locator('.opponent-panel').waitFor({ state: 'visible' })

  const opponentPanel = hostPage.locator('.opponent-panel')
  await expect(
    opponentPanel.getByRole('heading', { name: 'Guest' }),
  ).toBeVisible({ timeout: 15000 })
  const opponentCards = opponentPanel.locator('.game-card')
  await expect(opponentCards.first()).toBeVisible({ timeout: 15000 })

  await hostContext.close()
  await guestContext.close()
})
