import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The dev server proxies API calls to the FastAPI backend so the browser only ever
// talks to one origin (no CORS setup needed during development).
// Override the target with VITE_PROXY_TARGET, e.g. when the API runs on another port.
const target = process.env.VITE_PROXY_TARGET || 'http://localhost:8000'
const proxy = {
  '/api': { target, changeOrigin: true },
  '/docs': { target, changeOrigin: true },
  '/redoc': { target, changeOrigin: true },
  '/openapi.json': { target, changeOrigin: true },
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: Number(process.env.VITE_PORT) || 5173,
    proxy,
  },
  preview: {
    port: 4173,
    proxy,
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 900,
  },
})
