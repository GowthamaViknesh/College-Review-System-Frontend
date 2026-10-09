import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss()],
    server: {
      // The browser only ever talks to the Vite dev server, which forwards /api to the backend.
      // Same origin for the browser means no CORS setup is needed during development.
      proxy: {
        '/api': { target: env.VITE_API_TARGET || 'http://localhost:5000', changeOrigin: true },
      },
    },
  }
})
