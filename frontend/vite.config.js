import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa';
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate', // Updates app automatically when new content is available
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'favicon.svg'],
      devOptions: {
        enabled: true
      },
      manifest: {
        name: 'DHARAA',
        short_name: 'DHARAA',
        description: 'IoT Dashboard for Farmers with AI Chatbot',
        theme_color: '#10B981',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-96x96.png',
            sizes: '96x96',
            type: 'image/png'
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'  
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
})
