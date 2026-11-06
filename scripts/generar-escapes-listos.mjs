// Genera los escape rooms «listos para jugar» (modo pizarra + fichas) con sus preguntas congeladas
// → src/escapeHalloween/escapesListos.json
//
//   node scripts/generar-escapes-listos.mjs              (español → escapesListos.json)
//   node scripts/generar-escapes-listos.mjs --idioma=en  (inglés  → escapesListos.en.json; sin Historia ni Lengua, que no están traducidas)
//
// OJO: al regenerar cambian las preguntas, así que las fichas que ya se hayan impreso dejarán de coincidir.
// Usa esbuild para poder importar el motor (que tira de componentes .jsx de otras apps).
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

const raiz = path.resolve('.');
const tmpEntrada = path.join(raiz, 'scripts', '__entrada_listos.mjs');
const tmpSalida = path.join(raiz, 'scripts', '__listos_bundle.mjs');

fs.writeFileSync(tmpEntrada, `
import { generarPartidaFija } from '../src/escapeHalloween/partidaFija.js';
import { fijarIdiomaEscape } from '../src/escapeHalloween/i18n.js';
export { generarPartidaFija, fijarIdiomaEscape };
`);

const IDIOMA = (process.argv.find(a => a.startsWith('--idioma=')) || '').split('=')[1] === 'en' ? 'en' : 'es';

const LISTOS_ES = [
    { id: 'PRIMARIA', titulo: 'La mansión del zombi · Primaria', etapa: 'PRIMARIA', temas: { MATES: 'OPERACIONES', GEOGRAFIA: 'BANDERAS', BIOLOGIA: 'ORGANOS', HISTORIA: 'MIX', LENGUA: 'ORTOGRAFIA' } },
    { id: 'ESO', titulo: 'La mansión del zombi · ESO', etapa: 'ESO', temas: { MATES: 'MIX', GEOGRAFIA: 'MIX', BIOLOGIA: 'MIX', HISTORIA: 'MIX', LENGUA: 'MIX' } },
];
const LISTOS_EN = [
    { id: 'PRIMARIA', titulo: 'The zombie’s mansion · Primary', etapa: 'PRIMARIA', temas: [['MATES', 'OPERACIONES'], ['GEOGRAFIA', 'BANDERAS'], ['BIOLOGIA', 'ORGANOS'], ['INGLES', 'VOCAB'], ['MATES', 'TABLAS']] },
    { id: 'ESO', titulo: 'The zombie’s mansion · Secondary', etapa: 'ESO', temas: [['MATES', 'MIX'], ['GEOGRAFIA', 'MIX'], ['BIOLOGIA', 'MIX'], ['INGLES', 'PAST'], ['INGLES', 'PARTICIPLE']] },
];
const LISTOS = IDIOMA === 'en' ? LISTOS_EN : LISTOS_ES.map(l => ({ ...l, temas: Object.entries(l.temas) }));

try {
    await build({
        entryPoints: [tmpEntrada], bundle: true, platform: 'node', format: 'esm', outfile: tmpSalida, logLevel: 'error',
        loader: { '.js': 'jsx', '.jsx': 'jsx', '.png': 'empty', '.jpg': 'empty', '.svg': 'empty', '.css': 'empty', '.mp3': 'empty', '.gif': 'empty', '.webp': 'empty', '.wav': 'empty', '.ogg': 'empty', '.glb': 'empty' },
        external: ['firebase/*', 'three'],
        // los imports ?url de Vite (p. ej. el .hex de los mandos micro:bit) no hacen falta aquí
        plugins: [{ name: 'url-vacio', setup(b) { b.onResolve({ filter: /\?url$/ }, a => ({ path: a.path, namespace: 'vacio' })); b.onLoad({ filter: /.*/, namespace: 'vacio' }, () => ({ contents: 'export default ""', loader: 'js' })); } }],
        banner: { js: "import{createRequire}from'module';const require=createRequire(import.meta.url);globalThis.window={location:{origin:'x',pathname:'/'},addEventListener(){}};globalThis.localStorage={getItem(){return null},setItem(){}};" },
    });
    const { generarPartidaFija, fijarIdiomaEscape } = await import('file://' + tmpSalida.replace(/\\/g, '/'));
    fijarIdiomaEscape(IDIOMA);
    const salida = LISTOS.map(l => {
        const config = {
            modo: 'PAPEL', etapa: l.etapa, minutos: 30, ritmo: 5, zombi: 'NORMAL', nPreguntas: 5, nBatalla: 8,
            pruebas: l.temas.map(([materia, tema], i) => ({ id: `listo_${l.id.toLowerCase()}_${i + 1}`, tipo: 'MATERIA', materia, tema, nombre: '' })),
        };
        config.partida = generarPartidaFija(config, { nPreguntas: 5, nBatalla: 8 });
        return { id: l.id, titulo: l.titulo, config };
    });
    const destino = path.join(raiz, 'src', 'escapeHalloween', IDIOMA === 'en' ? 'escapesListos.en.json' : 'escapesListos.json');
    fs.writeFileSync(destino, JSON.stringify(salida, null, 1));
    console.log(`✅ ${salida.length} escape rooms listos → ${path.relative(raiz, destino)}`);
} finally {
    fs.rmSync(tmpEntrada, { force: true });
    fs.rmSync(tmpSalida, { force: true });
}
