# Pikt (pikt.es)

Plataforma educativa con juegos, herramientas de aula y recursos para profesores y alumnos.
Todo el texto de la interfaz está en **español**. Responder al usuario en español.

## Stack

- React + Vite (JSX, sin TypeScript). Firebase Auth + Firestore.
- Funciones serverless en `api/` (Vercel, ver `vercel.json`). Las claves (Gemini, Cloudinary, Google…) viven en el servidor: el cliente llama a `/api/...`, nunca a la API directa con clave.
- Sin router: el enrutado es manual en `src/App.jsx` (`rutaPublica`, `RUTAS_RESERVADAS`, `?r=` deep links) y en `checkURL()` de `src/components/LandingGames3.jsx` (`pushState` + `popstate`).
- Roles en `users/{uid}.role`: comparar siempre con `.toLowerCase()` (`'profesor'` / `'alumno'`).

## Reglas de trabajo (obligatorias)

- **No ejecutar builds** (`npm run build`, `vite build`): los hace el usuario. Revisar el código a mano o con scripts pequeños de Node.
- **No hay Python** en este equipo. Para scripts usar Node (`node -e` o `.mjs` en el scratchpad).
- Windows 11. La ruta del proyecto tiene **dos espacios** (`C:\Users\Asus  6\educando`): poner siempre las rutas entre comillas.
- Hacer cambios mínimos y no romper lo que funciona. Muchos juegos comparten utilidades: buscar si ya existe algo en `src/utils/` antes de crear otra versión.

## Añadir un juego o herramienta

- **Siempre con `React.lazy`** en `App.jsx`, `LandingGames3.jsx`, `GamePlayer.jsx`, `ProfesorDashboard.jsx` y `Login.jsx`. Un solo `import` estático mete su chunk (three, blockly…) en la carga inicial. El `import { lazy } from 'react'` va antes de cualquier `lazy(...)`.
- Cada tarjeta de LandingGames3 debe tener:
  1. Entrada en `GAME_INFO` con la misma clave que el `id` (la «i» de información).
  2. Registro local con `guardarRegistroLocal()` + tipo en `JUEGOS_REGISTRO_META` (`src/utils/registrosLocales.js`) para el icono Pi ×N.
  3. `shareable: true` y ruta pública en `App.jsx` (slug en `RUTAS_RESERVADAS`) para que funcione **con y sin login**.
- Si genera PDF, añadirlo al catálogo `ITEMS` de `src/centroPdf/CentroPdf.jsx`.
- SEO de rutas nuevas: `scripts/seo-games.mjs` + sitemap (el prerender corre en `npm run build`).

## Utilidades compartidas (reutilizar)

- Sonidos acierto/fallo: `src/utils/sonidosFeedback.js`
- Textos largos en juegos: `src/utils/encajeTexto.js` (perfiles por juego)
- Normalizar preguntas de recursos: `src/utils/normalizarPreguntas.js`
- Filtro de insultos en nombres: `src/utils/filtroNombres.js` (salas en vivo, rankings, envíos)
- Retos por enlace: `src/utils/retoLink.js` · Código corto de fichas: `src/utils/fichaCodigo.js`
- Traducción: `src/i18n/` (`useT()` / `<T>`). No traducir contenido que se compara con la respuesta (sopa de letras, ahorcado, verbos irregulares, fórmulas).

## Firestore

- Las reglas viven en `firebase-reglas/firestore.rules` (en `.gitignore`), que es la **fuente de verdad**. Consultarlo antes de afirmar qué está permitido. Se publican con `firebase deploy --only firestore:rules`.
- Colecciones nuevas o campos nuevos que se actualizan → revisar si hace falta regla (`hasOnly`, etc.) y avisar al usuario.
- Son datos reales de alumnos: no escribir ni borrar en producción para probar.

## Probar en el navegador

- Servidor local: `npm run dev` (lo arranca el usuario, o pedir permiso). Usar el navegador (Claude in Chrome) para comprobar visualmente cambios concretos y leer la consola, no para recorrer la web entera.
- Los juegos 3D (three.js, Unity WebGL) solo se pueden revisar por captura.
- Cuidado con los `window.confirm`/`alert` de la web (p. ej. aviso al guardar recursos, borrar): bloquean el navegador controlado. Avisar antes de pulsar esos botones.
- Probar con la cuenta del usuario sin crear ni borrar recursos reales; si hace falta, crear algo de prueba y avisar.

## Git

- Rama `main` despliega a producción. Mensajes de commit descriptivos en español (no «news»).
- Commit o push solo cuando el usuario lo pida.
