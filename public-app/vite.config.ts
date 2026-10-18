import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Book an Appointment',
        short_name: 'Book',
        theme_color: '#f5f7f6',
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
