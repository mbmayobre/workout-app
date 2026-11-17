/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Build configuration.
 *
 * Plugins:
 * - react:       JSX + fast refresh.
 * - tailwindcss: Tailwind v4 (configured in CSS, see src/index.css — there is
 *                no tailwind.config.js in v4).
 * - VitePWA:     generates the web app manifest and a service worker so the
 *                app can be installed to the home screen and opened offline.
 *
 * See docs/ARCHITECTURE.md for how these fit together.
 */
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'autoUpdate': when a new version is deployed, the service worker
      // downloads it in the background and it is used on the next app open.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Workout',
        short_name: 'Workout',
        description: 'Timer, set counter, workout plan, and progress tracking in one place.',
        // 'standalone' hides the browser address bar once installed.
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        background_color: '#0f1115',
        theme_color: '#0f1115',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Cache every built asset so the whole app works with no signal.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Single-page app: any unknown URL should load index.html.
        navigateFallback: '/index.html',
      },
    }),
  ],
  test: {
    // Unit tests cover pure logic only (shuffle, units, dates), so the fast
    // Node environment is enough — no browser simulation needed.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
