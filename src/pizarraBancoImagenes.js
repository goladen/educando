/*
 * Banco de imágenes para la Pizarra.
 * Reúne las imágenes de la web en categorías, listas para insertar y animar.
 *
 * - Assets de src/ → URLs resueltas por Vite con import.meta.glob (sin imports manuales).
 * - Assets de public/ → rutas directas servidas en /assets/...
 */

const bonito = (nombre) => nombre
  .replace(/[-_]+/g, ' ')
  .replace(/\.[^.]+$/, '')
  .replace(/\b\w/g, (c) => c.toUpperCase())
  .trim();

// Convierte el objeto {ruta: url} de import.meta.glob en [{nombre, url}]
function desdeGlob(mods) {
  return Object.entries(mods).map(([ruta, url]) => {
    const base = ruta.split('/').pop();
    return { nombre: bonito(base), url };
  }).sort((a, b) => a.nombre.localeCompare(b.nombre));
}

// ── Vehículos y personajes (Kenney) ─────────────────────────────────────────
const coches = import.meta.glob('./kenney_racing-pack/PNG/Cars/*.png', { eager: true, query: '?url', import: 'default' });
const motos = import.meta.glob('./kenney_racing-pack/PNG/Motorcycles/*.png', { eager: true, query: '?url', import: 'default' });
const personajes = import.meta.glob('./kenney_racing-pack/PNG/Characters/*.png', { eager: true, query: '?url', import: 'default' });
const objetos = import.meta.glob('./kenney_racing-pack/PNG/Objects/*.png', { eager: true, query: '?url', import: 'default' });

// ── Mascota Pi + iconos + varios ────────────────────────────────────────────
const pisYiconos = import.meta.glob(
  ['./assets/Pi-*.png', './assets/Piproyecto.gif', './assets/icono*.png', './assets/icono_*.png',
   './assets/Barco*.png', './assets/Bomberman.png', './assets/moneda.png', './assets/pikatron-sprite*.png'],
  { eager: true, query: '?url', import: 'default' });

// ── Sistema solar + monedas Euro ────────────────────────────────────────────
const solarTodo = import.meta.glob('./assets/solar/*.{png,jpg,jpeg,webp}', { eager: true, query: '?url', import: 'default' });
// milkyway.png es el fondo estrellado (no un planeta) → fuera del banco
const solar = Object.fromEntries(Object.entries(solarTodo).filter(([ruta]) => !/milkyway/i.test(ruta)));
const euros = import.meta.glob('./assets/Euros/*.{png,jpg,jpeg,webp}', { eager: true, query: '?url', import: 'default' });

// ── Anatomía (public/assets/anatomia) ───────────────────────────────────────
const ANATOMIA_NOMBRES = ['abdominales','atlas','axis','bazo','biceps','calcaneo','cerebro','clavicula','columna','corazon','craneo','cuadriceps','cubito','deltoides','diafragma','dorsal','escapula','esfenoides','esternocleidomastoideo','esternon','estomago','estribo','femur','frontal_hueso','gemelos','gluteo','higado','hipofisis','humero','intercostales','intestino_delgado','intestino_grueso','isquiotibiales','laringe','mandibula','masetero','maxilar','medula_espinal','occipital','pancreas','pectoral','pelvis','perone','psoas','pulmones','radio','rinones','romboides','sacro','sartorio','soleo','suprarrenales','tibia','tibial_anterior','timo','tiroides','trapecio','triceps','vejiga','vesicula'];
const anatomia = ANATOMIA_NOMBRES
  .map((n) => ({ nombre: bonito(n), url: `/assets/anatomia/${n}.jpg` }))
  .sort((a, b) => a.nombre.localeCompare(b.nombre));

export const BANCO_IMAGENES = [
  { id: 'coches', label: '🚗 Coches', items: desdeGlob(coches) },
  { id: 'motos', label: '🏍️ Motos', items: desdeGlob(motos) },
  { id: 'personajes', label: '🧍 Personajes', items: desdeGlob(personajes) },
  { id: 'objetos', label: '🚧 Objetos', items: desdeGlob(objetos) },
  { id: 'pi', label: '🐧 Pi e iconos', items: desdeGlob(pisYiconos) },
  { id: 'solar', label: '🪐 Sistema solar', items: desdeGlob(solar).map((it) => ({ ...it, esfera: true })) },
  { id: 'euros', label: '💶 Euros', items: desdeGlob(euros) },
  { id: 'anatomia', label: '🦴 Anatomía', items: anatomia },
].filter((c) => c.items.length > 0);
