import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Phone Scan',
        short_name: 'Phone Scan',
        description: 'Scan barcodes from your phone into a connected desktop input.',
        theme_color: '#f7fbff',
        background_color: '#f7fbff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/app-logo-icon.png',
            sizes: '1024x1024',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/pwa-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    port: 5174,
  },
})
