import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Plugin que emula /api/gemini en desarrollo (equivalente a la Vercel function)
function geminiDevPlugin() {
  return {
    name: 'gemini-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/gemini', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(200); res.end(); return;
        }
        if (req.method !== 'POST') {
          res.writeHead(405); res.end('Method not allowed'); return;
        }
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'GEMINI_API_KEY no configurada en .env.local' }));
          return;
        }
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const { model = 'gemini-2.0-flash', contents, generationConfig } = JSON.parse(body);
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const payload = { contents };
            if (generationConfig) payload.generationConfig = generationConfig;
            const upstream = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            const data = await upstream.json();
            res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
          } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  build: {
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/three'))    return 'vendor-three';
          if (id.includes('/node_modules/react-dom') || id.includes('/node_modules/react/') ||
              id.includes('/node_modules/react-confetti') || id.includes('/node_modules/canvas-confetti') ||
              id.includes('/node_modules/tween-functions')) return 'vendor-react';
          if (id.includes('/node_modules/firebase')) return 'vendor-firebase';
          if (id.includes('/node_modules/react-live') || id.includes('/node_modules/prism-react-renderer') || id.includes('/node_modules/@uiw')) return 'vendor-react-live';
          // lucide-react — usado por todos los chunks de juegos, vendor propio para
          // evitar que quede embebido en games-live y genere dep circular.
          if (id.includes('/node_modules/lucide-react')) return 'vendor-icons';
          // MotoMiniJuego importa CazaBurbujasGame (games-misc) → incluirlo en
          // games-misc rompe la dependencia circular games-live ↔ games-misc.
          if (id.includes('MotoMiniJuego')) return 'games-misc';
          // firebase.js local — usado por todos los chunks de juegos.
          // Ponerlo en shared-core evita que games-live lo absorba y cree dep circular.
          if ((id.includes('src/firebase') || id.includes('src\\firebase')) && !id.includes('node_modules')) return 'shared-core';
          // Assets compartidos (audio, imágenes Pi) — usados tanto por games-live
          // como por games-misc. Ponerlos en shared-assets evita que games-live los
          // absorba y genere una dependencia circular con games-misc.
          if (id.match(/[/\\]assets[/\\].*\.(mp3|ogg|wav|png|jpg|jpeg|gif|svg|webp)$/i)) return 'shared-assets';
          // Juegos en vivo (pesados)
          if (id.includes('ThinkHootGame') || id.includes('MathLive') || id.includes('OlympicLive')) return 'games-live';
          // Juegos de plataformas / runner
          if (id.includes('PikatronRun') || id.includes('Plataformas')) return 'games-platform';
          // Juegos de geometría / matemáticas
          if (id.includes('Geometrix') || id.includes('Ecuaciones')) return 'games-math';
          // Juegos varios
          if (id.includes('OmninteractiveApp') || id.includes('VideoQuizzApp') || id.includes('CazaBurbujasGame') || id.includes('RuletaGame')) return 'games-misc';
        },
      },
    },
  },
  plugins: [
    geminiDevPlugin(),
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
        navigateFallbackDenylist: [/^\/api/, /^\/kartinged/, /^\/kartingedmulti/, /^\/racing3d/, /^\/pikt-viewer\.html/],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
})
