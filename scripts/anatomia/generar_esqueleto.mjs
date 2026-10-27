// Genera public/anatomia/esqueleto.json (datos de cada hueso en español) a partir de:
//  - el JSON que escribe scripts/blender/anatomia_exportar.py (piezas exportadas)
//  - TA2.csv de Z-Anatomy (Terminologia Anatomica con columna «Español»)
//
// Uso: node scripts/anatomia/generar_esqueleto.mjs <TA2.csv> <esqueleto_export.json> [salida.json]
//
// Nombre técnico = el de la terminología oficial. Nombre escolar = NOMBRE_ESCOLAR o,
// si no está, el técnico limpiado (sin «Diente », «Hueso X» → como en clase…).
import fs from 'fs';

const [csvRuta, exportRuta, salida = 'public/anatomia/esqueleto.json'] = process.argv.slice(2);
if (!csvRuta || !exportRuta) {
    console.error('Uso: node scripts/anatomia/generar_esqueleto.mjs <TA2.csv> <esqueleto_export.json> [salida.json]');
    process.exit(1);
}

// ── Terminología oficial (inglés → español) ──
const filas = fs.readFileSync(csvRuta, 'utf8').replace(/^﻿/, '').split(/\r?\n/)
    .map(l => l.trim().replace(/^"|"$/g, '').split(';')).filter(r => r.length > 4);
const cab = filas.find(r => r.includes('English'));
const iEn = cab.indexOf('English');
const iEs = cab.indexOf('Español');
const TA = new Map();
for (const r of filas) if (r !== cab && r[iEn]) { const k = r[iEn].toLowerCase().trim(); if (!TA.has(k)) TA.set(k, r[iEs].trim()); }
const ta = (en) => TA.get(en.toLowerCase()) || en;

// ── Nombres como se dicen en clase (corrigen además errores del CSV) ──
const NOMBRE_ESCOLAR = {
    'Malleus': 'Martillo', 'Incus': 'Yunque', 'Stapes': 'Estribo',
    'Femur': 'Fémur', 'Patella': 'Rótula', 'Talus': 'Astrágalo', 'Ulna': 'Cúbito', 'Fibula': 'Peroné',
    'Scapula': 'Escápula (omóplato)', 'Hip bone': 'Coxal (hueso de la cadera)', 'Sacrum': 'Sacro',
    'Maxilla': 'Maxilar superior', 'Mandible': 'Mandíbula', 'Zygomatic bone': 'Cigomático (pómulo)',
    'Inferior nasal concha bone': 'Cornete nasal inferior', 'Xiphoid process': 'Apófisis xifoides',
    'Hamate bone': 'Ganchoso', 'Capitate bone': 'Hueso grande', 'Lunate bone': 'Semilunar', 'Triquetrum bone': 'Piramidal',
    'Scaphoid bone': 'Escafoides', 'Trapezium bone': 'Trapecio (hueso de la muñeca)', 'Trapezoid bone': 'Trapezoide', 'Pisiform bone': 'Pisiforme',
    'Navicular bone': 'Navicular (escafoides del pie)', 'Cuboid bone': 'Cuboides',
    'Medial cuneiform bone': 'Cuña medial', 'Intermediate cuneiform bone': 'Cuña intermedia', 'Lateral cuneiform bone': 'Cuña lateral',
    'Anterior cells of ethmoid bone': 'Celdillas etmoidales anteriores', 'Middle cells of ethmoid bone': 'Celdillas etmoidales medias',
    'Posterior cells of ethmoid bone': 'Celdillas etmoidales posteriores',
    'Sinus of frontal bone': 'Seno frontal', 'Sinus of sphenoid bone': 'Seno esfenoidal',
    'Upper medial incisor': 'Incisivo central superior', 'Upper lateral incisor': 'Incisivo lateral superior',
    'Lower medial incisor': 'Incisivo central inferior', 'Lower lateral incisor': 'Incisivo lateral inferior',
    'Nasal septal cartilage': 'Cartílago del tabique nasal', 'Lateral process of nasal septal cartilage': 'Cartílago lateral de la nariz',
    'Thyroid cartilage': 'Cartílago tiroides (nuez)', 'Atlas (C1)': 'Atlas (vértebra C1)', 'Axis (C2)': 'Axis (vértebra C2)',
};

const TIPO_VERTEBRA = { C: 'cervical', T: 'torácica', L: 'lumbar' };
const nombreEscolar = (en) => {
    if (NOMBRE_ESCOLAR[en]) return NOMBRE_ESCOLAR[en];
    const v = en.match(/^Vertebra ([CTL])(\d+)$/);
    if (v) return `Vértebra ${TIPO_VERTEBRA[v[1]]} ${v[1]}${v[2]}`;
    let n = ta(en).replace(/^Diente /, '').replace(/^Hueso ([A-ZÁÉÍÓÚ])/, (_, l) => l);
    n = n.replace(/^Hueso /, '').replace(/ hueso (metacarpiano|metatarsiano)/, ' $1');
    return n.charAt(0).toUpperCase() + n.slice(1);
};

// ── Zonas del cuerpo (para filtrar en el visor) ──
const ZONAS = [
    ['cabeza', 'Cabeza y cuello', g => ['Cranium', 'Extracranial bones of head', 'Auditory ossicles', 'Teeth', 'Nasal cartilages', 'Laryngeal cartilages'].some(x => g.includes(x))],
    ['columna', 'Columna vertebral', g => g.includes('Vertebral column')],
    ['torax', 'Tórax', g => g.includes('Thoracic skeleton')],
    ['mano', 'Mano', (g, en) => g.includes('Bones of upper limb') && /(of hand|metacarpal|Capitate|Hamate|Lunate|Pisiform|Scaphoid|Trapez|Triquetrum)/.test(en)],
    ['brazo', 'Hombro y brazo', g => g.includes('Bones of upper limb')],
    ['pie', 'Pie', (g, en) => g.includes('Bones of lower limb') && /(of foot|metatarsal|Talus|Calcaneus|Navicular|Cuboid|cuneiform)/.test(en)],
    ['pierna', 'Cadera y pierna', g => g.includes('Bones of lower limb')],
];
const zonaDe = (grupos, en) => ZONAS.find(([, , f]) => f(grupos, en)) || ['otros', 'Otros'];

// Grupo más concreto, con nombres de clase
const GRUPO_ESCOLAR = {
    'Bones of pectoral girdle': 'Cintura escapular', 'Bones of pelvic girdle': 'Cintura pélvica',
    'Bones of free part of upper limb': 'Brazo, antebrazo y mano', 'Bones of free part of lower limb': 'Muslo, pierna y pie',
    'Extracranial bones of head': 'Mandíbula e hioides', 'Cervical vertebrae': 'Vértebras cervicales',
    'Thoracic vertebrae': 'Vértebras torácicas', 'Bones of cranium': 'Huesos del cráneo y de la cara',
};
const grupoEscolar = (g) => GRUPO_ESCOLAR[g] || ta(g);

const exp = JSON.parse(fs.readFileSync(exportRuta, 'utf8'));
const piezas = exp.piezas.map(p => {
    const [zona, zonaNombre] = zonaDe(p.grupos, p.en);
    const concreto = p.grupos[p.grupos.length - 1] || '';
    return {
        id: p.id, en: p.en,
        nombre: nombreEscolar(p.en),
        tecnico: ta(p.en),
        lado: p.lado === 'r' ? 'derecho' : p.lado === 'l' ? 'izquierdo' : '',
        zona, zonaNombre,
        grupo: grupoEscolar(concreto),
        grupos: p.grupos.slice(1).map(grupoEscolar),
        centro: p.centro, tam: p.tam,
    };
});

const zonas = ZONAS.map(([id, nombre]) => ({ id, nombre, n: piezas.filter(p => p.zona === id).length }));
fs.mkdirSync(salida.replace(/[\\/][^\\/]+$/, ''), { recursive: true });
fs.writeFileSync(salida, JSON.stringify({ sistema: 'esqueleto', alto: exp.alto, zonas, piezas }));
console.log(`${piezas.length} piezas → ${salida}`);
console.log(zonas.map(z => `${z.nombre}: ${z.n}`).join(' | '));
const otros = piezas.filter(p => p.zona === 'otros');
if (otros.length) console.log('SIN ZONA:', otros.map(p => p.en).join(', '));
