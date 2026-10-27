// Genera el JSON de una capa del visor (músculos, órganos…) a partir de:
//  - el JSON que escribe scripts/blender/anatomia_exportar.py en modo selección
//  - el archivo de selección (musculos_seleccion.json, organos_seleccion.json), que es la
//    fuente de verdad de nombre, zona, grupo y tipo: se pueden cambiar sin volver a Blender.
//
// Uso: node scripts/anatomia/generar_capa.mjs <export.json> <seleccion.json> <sistema> <salida.json>
//   p. ej. node scripts/anatomia/generar_capa.mjs organos_export.json scripts/anatomia/organos_seleccion.json organos public/anatomia/organos.json
import fs from 'fs';

const [exportRuta, selRuta, sistema, salida] = process.argv.slice(2);
if (!exportRuta || !selRuta || !sistema || !salida) {
    console.error('Uso: node scripts/anatomia/generar_capa.mjs <export.json> <seleccion.json> <sistema> <salida.json>');
    process.exit(1);
}

const ZONAS = {
    cabeza: 'Cabeza y cuello', columna: 'Columna vertebral', torax: 'Tórax', espalda: 'Espalda',
    abdomen: 'Abdomen', brazo: 'Hombro y brazo', pierna: 'Cadera y pierna',
};
const exp = JSON.parse(fs.readFileSync(exportRuta, 'utf8'));
const sel = JSON.parse(fs.readFileSync(selRuta, 'utf8'));
const SEL = Object.fromEntries((sel.piezas || sel.musculos).map(m => [m.id, m]));
const tipoDefecto = sistema === 'musculos' ? 'musculo' : 'organo';

// el id de la pieza conserva el lado (.r/.l): no se sobrescribe con el de la selección
const piezas = exp.piezas.map(p => ({ ...p, ...(SEL[p.en] || {}), id: p.id })).map(p => ({
    id: p.id, en: p.en, nombre: p.nombre, tecnico: '',
    lado: p.lado === 'r' ? 'derecho' : p.lado === 'l' ? 'izquierdo' : '',
    zona: p.zona, zonaNombre: ZONAS[p.zona] || p.zona, grupo: p.grupo, tipo: p.tipo || tipoDefecto,
    centro: p.centro, tam: p.tam,
}));
const sinSel = piezas.filter(p => !SEL[p.en]);
if (sinSel.length) console.warn('Sin entrada en la selección:', sinSel.map(p => p.id).join(', '));

const zonas = Object.entries(ZONAS).map(([id, nombre]) => ({ id, nombre, n: piezas.filter(p => p.zona === id).length })).filter(z => z.n);
const grupos = [...new Set(piezas.map(p => p.grupo))];
fs.writeFileSync(salida, JSON.stringify({ sistema, alto: exp.alto, zonas, grupos, piezas }));
console.log(`${piezas.length} piezas → ${salida}`);
console.log(zonas.map(z => `${z.nombre}: ${z.n}`).join(' | '));
console.log('Grupos:', grupos.join(' | '));
