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
      manifest: {
        name: 'Admin PWA',
        short_name: 'Admin',
        theme_color: '#2f6b5c',
        icons: [] // would need real icons
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
