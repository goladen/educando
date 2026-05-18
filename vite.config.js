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
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-three': ['three'],
          'vendor-react': ['react', 'react-dom'],
          'vendor-firebase': ['firebase/app', 'firebase/firestore', 'firebase/auth', 'firebase/storage'],
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
