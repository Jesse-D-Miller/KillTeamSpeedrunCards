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
  if (wsProcess && startedWs) {
    wsProcess.kill()
  }
})

const startMatch = async (page, name) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Kill Team Speedrun' }).click()
  await page.getByRole('button', { name: 'Create' }).click()
  await page.getByLabel('Username').fill(name)
  await page.getByRole('button', { name: 'Create Room' }).click()
  await page.locator('.multiplayer-lobby').waitFor({ state: 'visible' })
}

const joinMatch = async (page, name, code) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Kill Team Speedrun' }).click()
  await page.getByRole('button', { name: 'Join' }).click()
  await page.getByLabel('Username').fill(name)
  await page.getByLabel('Room code').fill(code)
  await page.getByRole('button', { name: 'Join Room' }).click()
  await page.locator('.multiplayer-lobby').waitFor({ state: 'visible' })
}

const selectFirstTeamAndStart = async (page) => {
  await page.waitForURL('**/select-army')
  await page.locator('.select-army-card').first().click()
  await page.waitForURL('**/units')
  await page.locator('.unit-card').first().click()
  await page.getByRole('link', { name: 'Lock In Units' }).click()
  await page.waitForURL('**/equipment')
  await page.getByRole('button', { name: 'Start Game' }).click()
  await page.waitForURL('**/game/**')
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
  await expect(hostPage.getByRole('button', { name: 'Ready' })).toBeVisible()
  await expect(guestPage.getByRole('button', { name: 'Ready' })).toBeVisible()

  await selectFirstTeamAndStart(hostPage)
  await selectFirstTeamAndStart(guestPage)

  await guestPage.locator('.health-bar').first().click()
  await guestPage.waitForTimeout(300)

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
  await expect(opponentPanel.getByText('Guest')).toBeVisible({ timeout: 15000 })
  const opponentCards = opponentPanel.locator('.game-card')
  await expect(opponentCards.first()).toBeVisible({ timeout: 15000 })

  await hostContext.close()
  await guestContext.close()
})
