import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

// Register PWA service worker for public client app
if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/admin') && !window.location.pathname.startsWith('/amdin')) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateSW(true);
    },
    onOfflineReady() {
      console.log('[PWA] Mentalweg is cached and ready for offline use.');
    },
    onRegisterError(error) {
      console.warn('[PWA] Service worker registration error:', error);
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

