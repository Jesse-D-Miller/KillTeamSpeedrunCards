import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const TABLE_SERVER = `localhost:${process.env.PORT || 3000}`

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // The kill team data (most of the app's size) and the libraries change rarely, so
        // they get their own files: after an app update the iPads re-download only the
        // small app file (the server marks built files cacheable for good).
        manualChunks(id) {
          if (id.includes('/src/data/') && id.endsWith('.json')) return 'data'
          if (id.includes('/node_modules/')) return 'vendor'
          return undefined
        },
      },
    },
    // The data file is big on purpose (all 50 kill teams); the server gzips it to ~1MB.
    chunkSizeWarningLimit: 8000,
  },
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
