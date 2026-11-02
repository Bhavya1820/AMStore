import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The API runs on :3000. Proxying /api keeps everything same-origin in development,
// which is what lets the httpOnly refresh-token cookie (SameSite=Strict) work.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
