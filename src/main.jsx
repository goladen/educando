import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import CargandoChunk from './components/CargandoChunk.jsx'
import { LanguageProvider } from './i18n/LanguageContext.jsx'

// When a new Service Worker takes control, reload the page so users get
// the latest bundles instead of the old cached version.
// Only when replacing an existing SW: on the first visit the SW claims the page
// (clientsClaim) and reloading there would throw away the modulepreloads already
// downloaded ("cross-world service worker resource mismatch" + "preloaded but not used").
if ('serviceWorker' in navigator) {
  let reloading = false;
  const habiaControlador = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (habiaControlador && !reloading) {
      reloading = true;
      window.location.reload();
    }
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LanguageProvider>
      <Suspense fallback={<CargandoChunk />}>
        <App />
      </Suspense>
    </LanguageProvider>
  </StrictMode>,
)
