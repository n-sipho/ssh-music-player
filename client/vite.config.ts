import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

export default defineConfig({
  plugins: [
    react(),
  ],
  appType: 'spa',
  css: {
    postcss: {
      plugins: [tailwindcss(), autoprefixer()],
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/art': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/stream': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})