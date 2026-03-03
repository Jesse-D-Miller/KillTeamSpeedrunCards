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
const HIDDEN_TAC_OP_SRC = '/images/tacOps/hidden-tac-op.png'

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

const proceedToGame = async (page) => {
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

const revealTacOp = async (page) => {
  const startTpButton = page.getByRole('button', { name: 'Start TP' })
  if (await startTpButton.isVisible()) {
    await startTpButton.click()
  }

  const openMenuButton = page.getByRole('button', { name: 'Open game menu' })
  await expect(openMenuButton).toBeVisible({ timeout: 10000 })
  await openMenuButton.click()

  const tacOpSummary = page.getByText('Tac Op / Primary Op')
  await expect(tacOpSummary).toBeVisible({ timeout: 10000 })
  await tacOpSummary.click()

  const revealButton = page.getByRole('button', { name: 'Reveal Tac Op' })
  await expect(revealButton).toBeVisible({ timeout: 10000 })
  await revealButton.click()
  await expect(page.getByRole('button', { name: 'Hide Tac Op' })).toBeVisible()
}

test('board reveal flip shows selected Tac Op image for both sides', async ({ browser }) => {
  const hostContext = await browser.newContext()
  const guestContext = await browser.newContext()
  const mapContext = await browser.newContext()
  const hostPage = await hostContext.newPage()
  const guestPage = await guestContext.newPage()
  const mapPage = await mapContext.newPage()

  await startMatch(hostPage, 'Host')
  const roomCode = await hostPage.locator('.room-code').innerText()

  await joinMatch(guestPage, 'Guest', roomCode)
  await joinAsMap(mapPage, roomCode)

  await readyUp(hostPage)
  await readyUp(guestPage)

  await proceedToGame(hostPage)
  await proceedToGame(guestPage)

  await revealTacOp(hostPage)
  await revealTacOp(guestPage)

  await mapPage.goto('/board')
  await mapPage.waitForLoadState('domcontentloaded')

  await expect(
    mapPage.locator('.board-side__tacop-card.is-revealed'),
  ).toHaveCount(2, { timeout: 15000 })

  await expect
    .poll(async () => {
      return mapPage.evaluate((hiddenSrc) => {
        const backImages = Array.from(
          document.querySelectorAll(
            '.board-side__tacop-card.is-revealed .board-side__tacop-face--back img',
          ),
        ).map((img) => img.getAttribute('src') || '')

        if (backImages.length !== 2) return false

        return backImages.every(
          (src) => src && src !== hiddenSrc && src.includes('/images/tacOps/tacop-'),
        )
      }, HIDDEN_TAC_OP_SRC)
    }, {
      timeout: 15000,
    })
    .toBe(true)

  await hostContext.close()
  await guestContext.close()
  await mapContext.close()
})
