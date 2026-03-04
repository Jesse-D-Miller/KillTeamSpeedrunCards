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
    await page.locator('.game-stratops-backdrop').waitFor({ state: 'hidden' })
    return
  }
  const modalClose = page.locator('.game-stratops-close')
  if (await modalClose.isVisible()) {
    await modalClose.click()
    await page.locator('.game-stratops-backdrop').waitFor({ state: 'hidden' })
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

test('opponent refresh shows updated wounds and dead state', async ({ browser }) => {
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

  const guestSyncSeed = await guestPage.evaluate(() => {
    const roomCode =
      sessionStorage.getItem('kt-room-code') ||
      localStorage.getItem('kt-room-code') ||
      ''
    const playerId =
      sessionStorage.getItem('kt-player-id') ||
      localStorage.getItem('kt-player-id') ||
      ''
    const playerName =
      sessionStorage.getItem('kt-player-name') ||
      localStorage.getItem('kt-player-name') ||
      'Guest'
    const killteamId =
      window.location.pathname.split('/game/')[1] ||
      localStorage.getItem('kt-last-killteam') ||
      ''
    const selectionRaw = localStorage.getItem('kt-selection-state')
    const selectionParsed = selectionRaw ? JSON.parse(selectionRaw) : {}
    const selectedUnits = Array.isArray(selectionParsed?.selectedUnitsByTeam?.[killteamId])
      ? selectionParsed.selectedUnitsByTeam[killteamId]
      : []
    return { roomCode, playerId, playerName, killteamId, selectedUnits }
  })

  expect(guestSyncSeed.roomCode).toBeTruthy()
  expect(guestSyncSeed.playerId).toBeTruthy()
  expect(guestSyncSeed.killteamId).toBeTruthy()
  expect(guestSyncSeed.selectedUnits.length).toBeGreaterThan(0)

  await guestContext.close()

  await hostPage.evaluate(
    ({ wsPort, seed }) =>
      new Promise((resolve, reject) => {
        const deadUnits = Object.fromEntries(
          seed.selectedUnits.map((key) => [key, true]),
        )
        const woundsByUnit = Object.fromEntries(
          seed.selectedUnits.map((key) => [key, 0]),
        )

        const payloadState = {
          name: seed.playerName,
          playerId: seed.playerId,
          killteamId: seed.killteamId,
          selectedUnits: seed.selectedUnits,
          selectedEquipment: [],
          activeStratPloys: [],
          tpCount: 1,
          cpCount: 0,
          initiativeByTp: {},
          unitStates: {},
          deadUnits,
          woundsByUnit,
          stanceByUnit: {},
          statusesByUnit: {},
          aplAdjustByUnit: {},
          legionaryMarkByUnit: {},
        }

        const ws = new WebSocket(`ws://127.0.0.1:${wsPort}`)
        const cleanup = () => {
          try {
            ws.close()
          } catch {
            // noop
          }
        }
        const timeout = window.setTimeout(() => {
          cleanup()
          reject(new Error('Injected sync_state timed out'))
        }, 10000)

        ws.addEventListener('open', () => {
          ws.send(
            JSON.stringify({
              type: 'sync_init',
              code: seed.roomCode,
              name: seed.playerName,
              playerId: seed.playerId,
            }),
          )
          ws.send(
            JSON.stringify({
              type: 'sync_state',
              code: seed.roomCode,
              playerId: seed.playerId,
              state: payloadState,
            }),
          )
          window.setTimeout(() => {
            window.clearTimeout(timeout)
            cleanup()
            resolve()
          }, 300)
        })

        ws.addEventListener('error', () => {
          window.clearTimeout(timeout)
          cleanup()
          reject(new Error('Injected sync_state socket error'))
        })
      }),
    { wsPort: WS_PORT, seed: guestSyncSeed },
  )

  await hostPage.getByRole('button', { name: 'Opponent' }).click()
  const opponentPanel = hostPage.locator('.opponent-panel')
  await opponentPanel.waitFor({ state: 'visible' })
  await opponentPanel.getByRole('button', { name: 'Refresh' }).click()

  const opponentCard = opponentPanel.locator('.game-card').first()

  await expect(opponentCard).toBeVisible({ timeout: 15000 })
  await expect(opponentCard.locator('.state-pill')).toHaveText(/dead/i, {
    timeout: 15000,
  })
  await expect(opponentCard).toContainText(/0\/\d+/, {
    timeout: 15000,
  })

  await hostContext.close()
})

test('MAP username is blocked for normal create/join flow', async ({ page }) => {
  await page.goto('/multiplayer')

  await page.getByRole('button', { name: 'Create' }).click()
  await page.getByLabel('Username').fill('MAP')
  await page.getByRole('button', { name: 'Create Room' }).click()
  await expect(page.locator('.multiplayer-error')).toContainText(
    'Use the Map button to join as MAP.',
  )
  await expect(page.locator('.multiplayer-lobby')).toHaveCount(0)

  await page.getByRole('button', { name: 'Back' }).click()
  await page.getByRole('button', { name: 'Join' }).click()
  await page.getByLabel('Username').fill('MAP')
  await page.getByLabel('Room code').fill('ABC123')
  await page.getByRole('button', { name: 'Join Room' }).click()
  await expect(page.locator('.multiplayer-error')).toContainText(
    'Use the Map button to join as MAP.',
  )
  await expect(page.locator('.multiplayer-lobby')).toHaveCount(0)
})

test('map join does not become host', async ({ browser }) => {
  const hostContext = await browser.newContext()
  const mapContext = await browser.newContext()
  const hostPage = await hostContext.newPage()
  const mapPage = await mapContext.newPage()

  await startMatch(hostPage, 'Jesse')
  const roomCode = await hostPage.locator('.room-code').innerText()

  await mapPage.goto('/multiplayer')
  await mapPage.getByRole('button', { name: 'Map' }).click()
  await mapPage.getByLabel('Game code').fill(roomCode)
  await mapPage.getByRole('button', { name: 'Join as Map' }).click()
  await mapPage.locator('.multiplayer-lobby').waitFor({ state: 'visible' })

  const hostMetadata = await mapPage.evaluate((code) => {
    const playersRaw = localStorage.getItem(`kt-room-players-${code}`) || '[]'
    const players = JSON.parse(playersRaw)
    const hostId = localStorage.getItem(`kt-room-host-${code}`) || ''
    const hostPlayer = players.find((player) => player?.id === hostId) || null
    return {
      hostId,
      hostName: hostPlayer?.name || '',
    }
  }, roomCode)

  expect(hostMetadata.hostId).toBeTruthy()
  expect(hostMetadata.hostName).not.toBe('MAP')

  await hostContext.close()
  await mapContext.close()
})

test('host reassigns to non-map player when host disconnects', async ({ browser }) => {
  const hostContext = await browser.newContext()
  const guestContext = await browser.newContext()
  const mapContext = await browser.newContext()
  const hostPage = await hostContext.newPage()
  const guestPage = await guestContext.newPage()
  const mapPage = await mapContext.newPage()

  await startMatch(hostPage, 'Jesse')
  const roomCode = await hostPage.locator('.room-code').innerText()
  await joinMatch(guestPage, 'Rachel', roomCode)

  await mapPage.goto('/multiplayer')
  await mapPage.getByRole('button', { name: 'Map' }).click()
  await mapPage.getByLabel('Game code').fill(roomCode)
  await mapPage.getByRole('button', { name: 'Join as Map' }).click()
  await mapPage.locator('.multiplayer-lobby').waitFor({ state: 'visible' })

  await hostContext.close()

  await expect
    .poll(
      async () =>
        mapPage.evaluate((code) => {
          const playersRaw = localStorage.getItem(`kt-room-players-${code}`) || '[]'
          const players = JSON.parse(playersRaw)
          const hostId = localStorage.getItem(`kt-room-host-${code}`) || ''
          const hostPlayer = players.find((player) => player?.id === hostId) || null
          return {
            hostId,
            hostName: hostPlayer?.name || '',
          }
        }, roomCode),
      { timeout: 5000 },
    )
    .toEqual(
      expect.objectContaining({
        hostName: expect.not.stringMatching(/^MAP$/i),
      }),
    )

  await guestContext.close()
  await mapContext.close()
})
