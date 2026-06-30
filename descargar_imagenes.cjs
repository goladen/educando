/**
 * Descarga las imágenes de anatomía a public/assets/anatomia/
 *
 * Para cada elemento del dataset consulta la imagen principal del
 * artículo de Wikipedia (primero en español, luego en inglés) mediante
 * la API de MediaWiki, y la guarda con el nombre de archivo que indica
 * el propio JSON (campo imagenUrl).
 *
 *   node descargar_imagenes.js
 *
 * Es re-ejecutable: por defecto solo descarga las que faltan.
 * Usa --force para volver a descargar todas.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const FORCE = process.argv.includes('--force');

const dataset = require('./src/anatomia_avanzada_dataset.json');
const carpetaDestino = path.join(__dirname, 'public', 'assets', 'anatomia');

// Título del artículo de Wikipedia por id. { es, en }
// El término en español suele dar el mejor diagrama anatómico;
// el inglés es el plan B si el español no tiene imagen principal.
const TITULOS = {
  'org-01': { es: 'Cerebro', en: 'Human brain' },
  'org-02': { es: 'Corazón', en: 'Heart' },
  'org-03': { es: 'Pulmón', en: 'Lung' },
  'org-04': { es: 'Estómago', en: 'Stomach' },
  'org-05': { es: 'Hígado', en: 'Liver' },
  'org-06': { es: 'Páncreas', en: 'Pancreas' },
  'org-07': { es: 'Intestino delgado', en: 'Small intestine' },
  'org-08': { es: 'Intestino grueso', en: 'Large intestine' },
  'org-09': { es: 'Riñón', en: 'Kidney' },
  'org-10': { es: 'Vejiga urinaria', en: 'Urinary bladder' },
  'org-11': { es: 'Bazo', en: 'Spleen' },
  'org-12': { es: 'Vesícula biliar', en: 'Gallbladder' },
  'org-13': { es: 'Glándula tiroides', en: 'Thyroid' },
  'org-14': { es: 'Hipófisis', en: 'Pituitary gland' },
  'org-15': { es: 'Glándula suprarrenal', en: 'Adrenal gland' },
  'org-16': { es: 'Médula espinal', en: 'Spinal cord' },
  'org-17': { es: 'Laringe', en: 'Larynx' },
  'org-18': { es: 'Timo', en: 'Thymus' },

  'hue-01': { es: 'Cráneo', en: 'Skull' },
  'hue-02': { es: 'Mandíbula', en: 'Mandible' },
  'hue-03': { es: 'Clavícula', en: 'Clavicle' },
  'hue-04': { es: 'Esternón', en: 'Sternum' },
  'hue-05': { es: 'Columna vertebral', en: 'Vertebral column' },
  'hue-06': { es: 'Pelvis', en: 'Pelvis' },
  'hue-07': { es: 'Húmero', en: 'Humerus' },
  'hue-08': { es: 'Radio (hueso)', en: 'Radius (bone)' },
  'hue-09': { es: 'Cúbito', en: 'Ulna' },
  'hue-10': { es: 'Fémur', en: 'Femur' },
  'hue-11': { es: 'Tibia', en: 'Tibia' },
  'hue-12': { es: 'Peroné', en: 'Fibula' },
  'hue-13': { es: 'Escápula', en: 'Scapula' },
  'hue-14': { es: 'Hueso frontal', en: 'Frontal bone' },
  'hue-15': { es: 'Hueso occipital', en: 'Occipital bone' },
  'hue-16': { es: 'Hueso esfenoides', en: 'Sphenoid bone' },
  'hue-17': { es: 'Atlas (vértebra)', en: 'Atlas (anatomy)' },
  'hue-18': { es: 'Axis (vértebra)', en: 'Axis (anatomy)' },
  'hue-19': { es: 'Hueso sacro', en: 'Sacrum' },
  'hue-20': { es: 'Maxilar', en: 'Maxilla' },
  'hue-21': { es: 'Calcáneo', en: 'Calcaneus' },
  'hue-22': { es: 'Estribo (hueso)', en: 'Stapes' },

  'mus-01': { es: 'Músculo masetero', en: 'Masseter muscle' },
  'mus-02': { es: 'Músculo esternocleidomastoideo', en: 'Sternocleidomastoid muscle' },
  'mus-03': { es: 'Músculo deltoides', en: 'Deltoid muscle' },
  'mus-04': { es: 'Músculo pectoral mayor', en: 'Pectoralis major muscle' },
  'mus-05': { es: 'Bíceps braquial', en: 'Biceps' },
  'mus-06': { es: 'Tríceps braquial', en: 'Triceps brachii muscle' },
  'mus-07': { es: 'Músculo trapecio', en: 'Trapezius' },
  'mus-08': { es: 'Músculo dorsal ancho', en: 'Latissimus dorsi muscle' },
  'mus-09': { es: 'Músculo recto del abdomen', en: 'Rectus abdominis muscle' },
  'mus-10': { es: 'Glúteo mayor', en: 'Gluteus maximus muscle' },
  'mus-11': { es: 'Cuádriceps', en: 'Quadriceps' },
  'mus-12': { es: 'Isquiotibiales', en: 'Hamstring' },
  'mus-13': { es: 'Músculo gastrocnemio', en: 'Gastrocnemius muscle' },
  'mus-14': { es: 'Diafragma (anatomía)', en: 'Thoracic diaphragm' },
  'mus-15': { es: 'Músculo sartorio', en: 'Sartorius muscle' },
  'mus-16': { es: 'Músculo tibial anterior', en: 'Tibialis anterior muscle' },
  'mus-17': { es: 'Músculos romboides', en: 'Rhomboid muscles' },
  'mus-18': { es: 'Músculo psoas mayor', en: 'Psoas major muscle' },
  'mus-19': { es: 'Músculos intercostales', en: 'Intercostal muscle' },
  'mus-20': { es: 'Músculo sóleo', en: 'Soleus muscle' },
};

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'educando-anatomia/1.0 (uso educativo)' } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// Devuelve la URL de la imagen principal del artículo, o null.
async function buscarImagen(lang, titulo) {
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&redirects=1` +
    `&prop=pageimages&piprop=original&titles=${encodeURIComponent(titulo)}`;
  const json = await getJson(url);
  const pages = json && json.query && json.query.pages;
  if (!pages) return null;
  for (const k in pages) {
    if (pages[k].original && pages[k].original.source) return pages[k].original.source;
  }
  return null;
}

function descargar(url, destino) {
  return new Promise((resolve, reject) => {
    const archivo = fs.createWriteStream(destino);
    https.get(url, { headers: { 'User-Agent': 'educando-anatomia/1.0 (uso educativo)' } }, (res) => {
      if (res.statusCode !== 200) { archivo.close(); fs.unlink(destino, () => {}); return reject(`HTTP ${res.statusCode}`); }
      res.pipe(archivo);
      archivo.on('finish', () => archivo.close(() => resolve()));
    }).on('error', (err) => { fs.unlink(destino, () => {}); reject(err.message); });
  });
}

(async () => {
  fs.mkdirSync(carpetaDestino, { recursive: true });

  const fallidas = [];
  const animadas = [];

  for (const item of dataset) {
    const nombreArchivo = path.basename(item.imagenUrl); // p.ej. corazon.jpg
    const destino = path.join(carpetaDestino, nombreArchivo);
    if (!FORCE && fs.existsSync(destino) && fs.statSync(destino).size > 0) {
      console.log(`⏭️  Ya existe: ${nombreArchivo}`);
      continue;
    }
    const t = TITULOS[item.id];
    if (!t) { console.warn(`⚠️  Sin título mapeado para ${item.id} (${item.nombre})`); fallidas.push(item.nombre); continue; }

    try {
      let src = await buscarImagen('es', t.es);
      if (!src) src = await buscarImagen('en', t.en);
      if (!src) { console.error(`❌ Sin imagen: ${item.nombre}`); fallidas.push(item.nombre); continue; }

      await descargar(src, destino);
      const animada = /\.(gif|webp)(\?|$)/i.test(src);
      if (animada) animadas.push(`${item.nombre} (${path.basename(src.split('?')[0])})`);
      console.log(`✅ ${nombreArchivo}  ←  ${decodeURIComponent(src.split('/').pop())}`);
    } catch (e) {
      console.error(`❌ Falló ${item.nombre}: ${e}`);
      fallidas.push(item.nombre);
    }
  }

  console.log('\n──────── RESUMEN ────────');
  console.log(`Total: ${dataset.length}`);
  if (animadas.length) { console.log(`\n⚠️  Posible GIF/animación (revisar y sustituir):`); animadas.forEach((n) => console.log('   - ' + n)); }
  if (fallidas.length) { console.log(`\n❌ Sin descargar (revisar a mano):`); fallidas.forEach((n) => console.log('   - ' + n)); }
  else console.log('\n🎉 Todas descargadas.');
})();
