// Prerender por juego — se ejecuta DESPUÉS de `vite build`.
// Genera dist/<slug>/index.html a partir del dist/index.html construido, con:
//   - <title>, meta description y etiquetas og/twitter propias del juego
//   - <link rel="canonical"> propio
//   - contenido VISIBLE dentro de #root (H1 + descripción + etiquetas + enlaces internos)
//
// No hidrata: el SPA usa createRoot(), que reemplaza el contenido de #root al montar.
// Por eso este HTML solo lo ven los bots y los usuarios mientras carga el JS.
//
// Vercel sirve el archivo estático (dist/<slug>/index.html) antes de aplicar el rewrite
// catch-all a /index.html, así que NO hay que tocar vercel.json.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAMES } from './seo-games.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
// PRERENDER_DIST permite apuntar a otra carpeta para tests; por defecto usa ./dist.
const DIST = process.env.PRERENDER_DIST
  ? resolve(process.env.PRERENDER_DIST)
  : resolve(__dirname, '..', 'dist');
const SRC_HTML = resolve(DIST, 'index.html');
const SITE = 'https://www.pikt.es';
const OG_IMAGE = `${SITE}/og-image.png`;

if (!existsSync(SRC_HTML)) {
  console.error('[prerender] No existe dist/index.html. Ejecuta antes "vite build".');
  process.exit(1);
}

// Escapes
const attr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const html = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const base = readFileSync(SRC_HTML, 'utf8');

// Reemplaza el valor content="" de una meta identificada por su atributo (name/property).
function setMeta(doc, kind, key, value) {
  const re = new RegExp(`(<meta\\s+${kind}="${key}"\\s+content=")[^"]*(")`, 'i');
  return doc.match(re) ? doc.replace(re, `$1${attr(value)}$2`) : doc;
}

function bodyFor(game) {
  const others = GAMES.filter((g) => g.slug !== game.slug).slice(0, 8);
  const chip = (t) =>
    `<span style="display:inline-block;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.35);border-radius:999px;padding:6px 16px;font-size:15px;font-weight:700;">${html(t)}</span>`;
  const chips = [game.nivel, game.materia, 'Gratis', 'Sin registro', 'Listo para proyectar']
    .filter(Boolean)
    .map(chip)
    .join('');
  const links = others
    .map((o) => `<a href="/${o.slug}" style="color:#e8e6ff;text-decoration:underline;">${html(o.h1)}</a>`)
    .join(' · ');

  return `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;background:linear-gradient(135deg,#6c63ff 0%,${attr(game.color || '#7c3aed')} 100%);font-family:'Segoe UI',Arial,sans-serif;color:#fff;">
        <div style="max-width:760px;width:100%;text-align:center;">
          <div style="font-size:64px;line-height:1;margin-bottom:12px;">${game.emoji || '🎮'}</div>
          <h1 style="font-size:42px;margin:0 0 14px;font-weight:800;">${html(game.h1)}</h1>
          <p style="font-size:20px;line-height:1.5;opacity:.96;margin:0 auto 20px;max-width:600px;">${html(game.desc)}</p>
          <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:26px;">${chips}</div>
          <div style="font-size:16px;opacity:.9;margin-bottom:28px;">Cargando PiKT… si el juego no aparece, activa JavaScript en tu navegador.</div>
          <nav style="font-size:15px;line-height:2.1;opacity:.95;">
            <div style="font-weight:700;margin-bottom:4px;">Más juegos educativos gratis:</div>
            ${links} · <a href="/guia-pikt-es.html" style="color:#ffd83d;text-decoration:underline;">Guía completa de PiKT</a>
          </nav>
        </div>
      </div>`;
}

let count = 0;
for (const game of GAMES) {
  const url = `${SITE}/${game.slug}`;
  let doc = base;

  // <head>
  doc = doc.replace(/<title>[\s\S]*?<\/title>/i, `<title>${html(game.title)}</title>`);
  doc = setMeta(doc, 'name', 'description', game.desc);
  doc = setMeta(doc, 'property', 'og:url', url);
  doc = setMeta(doc, 'property', 'og:title', game.title);
  doc = setMeta(doc, 'property', 'og:description', game.desc);
  doc = setMeta(doc, 'property', 'og:image', OG_IMAGE);
  doc = setMeta(doc, 'name', 'twitter:title', game.title);
  doc = setMeta(doc, 'name', 'twitter:description', game.desc);
  // canonical (lo insertamos justo antes de </head>; el SPA no lo duplica)
  if (!/rel="canonical"/i.test(doc)) {
    doc = doc.replace('</head>', `    <link rel="canonical" href="${attr(url)}" />\n</head>`);
  } else {
    doc = doc.replace(/(<link\s+rel="canonical"\s+href=")[^"]*(")/i, `$1${attr(url)}$2`);
  }

  // #root -> contenido visible del juego (reemplaza el noscript de la home)
  const start = doc.indexOf('<div id="root">');
  const end = doc.indexOf('</div>', start);
  if (start === -1 || end === -1) {
    console.error('[prerender] No se encontró <div id="root"> en dist/index.html. Abortando.');
    process.exit(1);
  }
  doc = doc.slice(0, start) + '<div id="root">' + bodyFor(game) + '\n    ' + doc.slice(end);

  const outDir = resolve(DIST, game.slug);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, 'index.html'), doc, 'utf8');
  count++;
}

console.log(`[prerender] Generadas ${count} páginas por juego en dist/<slug>/index.html`);
