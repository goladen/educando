import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false, // usamos el manifest.json de /public
      workbox: {
        // Excluir MP3/audio (usan Range requests incompatibles con el SW cache)
        // Excluir archivos Unity (sin hash en nombre → SW sirve versiones viejas)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores: [
          '**/kartinged/**',
          '**/kartingedmulti/**',
          '**/racing3d/**',
          '**/*.mp3',
          '**/*.mp4',
          '**/*.ogg',
          '**/*.wav',
        ],
        navigateFallback: '/index.html',
        // Excluir rutas Unity del navigate fallback — sin esto el SW sirve
        // el index.html de React dentro del iframe de Unity
        navigateFallbackDenylist: [/^\/api/, /^\/kartinged/, /^\/kartingedmulti/, /^\/racing3d/],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        skipWaiting: true,
        clientsClaim: true,
        // No cachear audio (Range requests)
        runtimeCaching: [
          {
            urlPattern: /\.(?:mp3|mp4|ogg|wav)$/i,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
})
