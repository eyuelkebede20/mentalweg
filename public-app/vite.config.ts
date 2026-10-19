import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Mentalweg · Clinical Psychology Practice',
        short_name: 'Mentalweg',
        description: 'Confidential, compassionate in-person clinical psychology and therapeutic care in Addis Ababa, Ethiopia.',
        theme_color: '#1d332b',
        background_color: '#fbfaf8',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        categories: ['health', 'lifestyle', 'medical'],
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
            purpose: 'any'
          }
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/admin/, /^\/amdin/, /^\/api/, /^\/auth/, /^\/uploads/],
        runtimeCaching: [
          {
            urlPattern: ({ url }: { url: URL }) => url.pathname === '/api/public/config',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'mw-practice-config-cache',
              cacheableResponse: {
                statuses: [0, 200]
              },
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              }
            }
          },
          {
            urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith('/uploads/'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'mw-posters-cache',
              cacheableResponse: {
                statuses: [0, 200]
              },
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      '/admin': {
        target: 'http://localhost:5174',
        changeOrigin: true,
        ws: true,
      },
      '/amdin': {
        target: 'http://localhost:5174',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/amdin/, '/admin'),
      },
      '/api': 'http://localhost:3000',
      '/auth': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000'
    }
  }
})
