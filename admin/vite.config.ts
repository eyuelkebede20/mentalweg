import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/admin/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Admin PWA',
        short_name: 'Admin',
        theme_color: '#2f6b5c',
        icons: [] // would need real icons
      }
    })
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/auth': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000'
    }
  }
})
