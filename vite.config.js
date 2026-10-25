import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const TABLE_SERVER = `localhost:${process.env.PORT || 3000}`

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Listen on the LAN so iPads can load the dev build.
    host: true,
    proxy: {
      '/ws': { target: `ws://${TABLE_SERVER}`, ws: true },
      '/api': { target: `http://${TABLE_SERVER}` },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
})
