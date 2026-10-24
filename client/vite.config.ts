import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

const API_TARGET = 'http://localhost:4000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // In development the browser talks only to Vite; Vite forwards GraphQL
    // (HTTP and WebSocket) to the Express server. In production Vercel rewrites
    // HTTP /graphql to the API (first-party cookies) and the subscription
    // socket connects to the API host directly.
    proxy: {
      // One endpoint for everything: HTTP queries/mutations and the
      // graphql-ws subscription socket.
      '/graphql': { target: API_TARGET, ws: true, changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    css: false,
  },
})
