import { defineConfig } from '@playwright/test'

// Runs an isolated table server (own port + state file) so tests never touch a real game.
const WEB_PORT = 5199
const TABLE_PORT = 3199
const STATE_FILE = 'test-results/e2e-game.json'
const HISTORY_FILE = 'test-results/e2e-history.json'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120000,
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    headless: true,
  },
  webServer: {
    command: `rm -f ${STATE_FILE} ${HISTORY_FILE} && npx concurrently -k "vite --host 127.0.0.1 --port ${WEB_PORT} --strictPort" "node server/index.js"`,
    url: `http://127.0.0.1:${WEB_PORT}`,
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      PORT: String(TABLE_PORT),
      KT_STATE_FILE: STATE_FILE,
      KT_HISTORY_FILE: HISTORY_FILE,
      KT_SERVE_STATIC: '0',
    },
  },
})
