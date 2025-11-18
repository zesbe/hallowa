import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';
import { dynamicCSP } from './src/plugins/vite-plugin-csp';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  
  // ✨ BUILD OPTIMIZATION
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Pisahkan vendor React agar di-cache terpisah
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Pisahkan Supabase karena ukurannya besar
          'supabase': ['@supabase/supabase-js'],
          // Pisahkan UI components kalau pakai library besar
          // 'ui-vendor': ['lucide-react', '@radix-ui/react-dialog'] // sesuaikan dengan library yang kamu pakai
        }
      }
    },
    // Tingkatkan limit warning chunk size
    chunkSizeWarningLimit: 1000,
    // Minify dengan terser untuk hasil optimal
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: mode === 'production', // hapus console.log di production
        drop_debugger: mode === 'production'
      }
    },
    // Enable source map for better debugging and SEO audit
    sourcemap: true
  },
  
  plugins: [
    react(),
    dynamicCSP(), // 🔒 Dynamic CSP: strict in production, relaxed in dev
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null, // Don't inject registerSW.js - we handle it manually in index.html
      includeAssets: ['favicon.ico', 'robots.txt', 'icon-192.png', 'icon-512.png'],
      manifest: {
        id: '/hallowa-app-v2024', // ✨ UNIQUE ID - Force browser treat as new PWA
        name: 'HalloWa - WhatsApp Multi-Device Management Platform',
        short_name: 'HalloWa',
        description: 'Platform WhatsApp Bot Marketing profesional untuk kelola multiple devices, broadcast messages, chatbot automation dalam satu platform terpadu',
        theme_color: '#10b981',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        categories: ['business', 'productivity', 'social'],
        lang: 'id-ID',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/og-image.png',
            sizes: '1200x630',
            type: 'image/png',
            purpose: 'any'
          }
        ],
        screenshots: [
          {
            src: '/og-image.png',
            sizes: '1200x630',
            type: 'image/png',
            form_factor: 'wide',
            label: 'HalloWa Dashboard'
          }
        ],
        shortcuts: [
          {
            name: 'Dashboard',
            short_name: 'Dashboard',
            description: 'Lihat statistik dan overview',
            url: '/dashboard',
            icons: [{ src: '/icon-192.png', sizes: '192x192' }]
          },
          {
            name: 'Broadcast',
            short_name: 'Broadcast',
            description: 'Kirim pesan ke banyak kontak',
            url: '/broadcast',
            icons: [{ src: '/icon-192.png', sizes: '192x192' }]
          },
          {
            name: 'Devices',
            short_name: 'Devices',
            description: 'Kelola WhatsApp devices',
            url: '/devices',
            icons: [{ src: '/icon-192.png', sizes: '192x192' }]
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true, // ✨ Auto cleanup old caches
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: false // Disable PWA in development
      }
    })
  ].filter(Boolean),
  
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
