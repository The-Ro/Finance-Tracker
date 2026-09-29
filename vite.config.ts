import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt', not 'autoUpdate': autoUpdate reloads every open tab as soon as
      // a new build activates, wiping half-typed forms. UpdateBanner asks first.
      registerType: 'prompt',
      includeAssets: ['favicon.png', 'favicon.ico', 'push-sw.js'],
      manifest: {
        name: 'LedgeEaze',
        short_name: 'LedgeEaze',
        description: 'Shared personal finance tracker',
        theme_color: '#5C1B2E',
        background_color: '#F4F4F7',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        // Long-press the installed icon for these.
        shortcuts: [
          { name: 'Add entry', short_name: 'Add', url: '/?add=entry', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Bills', url: '/bills', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Monthly review', short_name: 'Review', url: '/review', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
        ],
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        // Phone reminders: the push and notification-click handlers (public/push-sw.js).
        importScripts: ['push-sw.js'],
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
})
