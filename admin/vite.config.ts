import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/admin/',
  plugins: [
    react(),
    {
      name: 'admin-redirect-middleware',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url || '';
          if (url === '/' || url === '' || url.startsWith('/amdin')) {
            const target = url.replace(/^\/amdin/, '/admin') || '/admin/';
            res.writeHead(302, { Location: target.startsWith('/admin') ? target : '/admin/' });
            res.end();
            return;
          }
          next();
        });
      }
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Mentalweg · Clinical CMS',
        short_name: 'MW Admin',
        description: 'Clinical management portal: appointments, client records, and telebirr financial tracking.',
        theme_color: '#121816',
        background_color: '#121816',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/admin/',
        scope: '/admin/',
        icons: [
          {
            src: '/admin/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/admin/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/admin/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/admin/apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
            purpose: 'any'
          }
        ]
      },
      workbox: {
        navigateFallback: '/admin/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/auth/, /^\/uploads/]
      },
      devOptions: {
        enabled: true
      }
    })
  ],
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:3000',
      '/auth': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000'
    }
  }
})
