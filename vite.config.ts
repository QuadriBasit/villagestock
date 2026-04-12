import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'VillageStock',
        short_name: 'VillageStock',
        description: 'Inventory management for electronics retailers',
        theme_color: '#09090b',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Only cache read-only REST traffic; never intercept auth, functions, or non-GET.
            urlPattern: ({ url, request }) =>
              request.method === 'GET' &&
              /\.supabase\.co$/i.test(url.hostname) &&
              url.pathname.startsWith('/rest/v1/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5174,
    strictPort: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react-router') || id.includes('@remix-run')) return 'router';
          if (id.includes('@supabase')) return 'supabase';
          if (id.includes('recharts')) return 'charts';
          if (id.includes('html5-qrcode')) return 'scanner';
          if (id.includes('html2canvas') || id.includes('jspdf')) return 'export';
          if (id.includes('react-day-picker')) return 'calendar';
          if (id.includes('@radix-ui')) return 'radix';
          return 'vendor';
        },
      },
    },
  },
})
