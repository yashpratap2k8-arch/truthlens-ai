import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The dev server forwards /api requests to the FastAPI backend.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
})
