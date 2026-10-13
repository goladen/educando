// Genera los escape rooms «listos para jugar» (modo pizarra + fichas) con sus preguntas congeladas
// → src/escapeHalloween/escapesListos.json
//
//   node scripts/generar-escapes-listos.mjs
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
export { generarPartidaFija };
`);

const LISTOS = [
    { id: 'PRIMARIA', titulo: 'La mansión del zombi · Primaria', etapa: 'PRIMARIA', temas: { MATES: 'OPERACIONES', GEOGRAFIA: 'BANDERAS', BIOLOGIA: 'ORGANOS', HISTORIA: 'MIX', LENGUA: 'ORTOGRAFIA' } },
    { id: 'ESO', titulo: 'La mansión del zombi · ESO', etapa: 'ESO', temas: { MATES: 'MIX', GEOGRAFIA: 'MIX', BIOLOGIA: 'MIX', HISTORIA: 'MIX', LENGUA: 'MIX' } },
];

try {
    await build({
        entryPoints: [tmpEntrada], bundle: true, platform: 'node', format: 'esm', outfile: tmpSalida, logLevel: 'error',
        loader: { '.js': 'jsx', '.jsx': 'jsx', '.png': 'empty', '.jpg': 'empty', '.svg': 'empty', '.css': 'empty', '.mp3': 'empty', '.gif': 'empty', '.webp': 'empty', '.wav': 'empty', '.ogg': 'empty', '.glb': 'empty' },
        external: ['firebase/*', 'three'],
        banner: { js: "import{createRequire}from'module';const require=createRequire(import.meta.url);globalThis.window={location:{origin:'x',pathname:'/'},addEventListener(){}};globalThis.localStorage={getItem(){return null},setItem(){}};" },
    });
    const { generarPartidaFija } = await import('file://' + tmpSalida.replace(/\\/g, '/'));
    const salida = LISTOS.map(l => {
        const config = {
            modo: 'PAPEL', etapa: l.etapa, minutos: 30, ritmo: 5, zombi: 'NORMAL', nPreguntas: 5, nBatalla: 8,
            pruebas: Object.entries(l.temas).map(([materia, tema], i) => ({ id: `listo_${l.id.toLowerCase()}_${i + 1}`, tipo: 'MATERIA', materia, tema, nombre: '' })),
        };
        config.partida = generarPartidaFija(config, { nPreguntas: 5, nBatalla: 8 });
        return { id: l.id, titulo: l.titulo, config };
    });
    const destino = path.join(raiz, 'src', 'escapeHalloween', 'escapesListos.json');
    fs.writeFileSync(destino, JSON.stringify(salida, null, 1));
    console.log(`✅ ${salida.length} escape rooms listos → ${path.relative(raiz, destino)}`);
} finally {
    fs.rmSync(tmpEntrada, { force: true });
    fs.rmSync(tmpSalida, { force: true });
}
