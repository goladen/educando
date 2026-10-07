// Genera los diccionarios comunes de juegos de palabras (VaniLa, Wordle…):
//   public/diccionario/{es,ca,en,fr}.txt.gz  (+ <idioma>_largas.txt.gz)
//
// Se guardan YA COMPRIMIDOS (gzip -9): el repositorio pasa de ~21 MB a ~6 MB y el navegador
// los descomprime con DecompressionStream (ver src/utils/diccionarios.js).
//
//   node scripts/generar-diccionarios.mjs            (los cuatro)
//   node scripts/generar-diccionarios.mjs ca fr      (solo esos)
//
// Fuentes:
//  · Diccionarios Hunspell de LibreOffice (RLA-ES, Softcatalà, SCOWL en_US+en_GB, Grammalecte)
//    expandidos con hunspell-reader → TODAS las formas flexionadas con su grafía correcta (tildes, ç, l·l…).
//  · FrequencyWords (subtítulos OpenSubtitles 2018) → orden de uso.
//
// Formato del fichero: una forma por línea, en minúscula y con tildes.
//  1) Primero las palabras «conocidas», de más a menos frecuentes (sirven para sortear letras,
//     mostrar soluciones y elegir la palabra secreta del Wordle).
//  2) Una línea «#».
//  3) El resto de formas válidas (poco frecuentes), en orden alfabético.
// Formas de 2 a 9 letras (sin contar el punto volado «·»). Las de 10 a 15 letras van aparte en
// public/diccionario/<idioma>_largas.txt.gz (alfabético), que solo descarga el modo tablero de VaniLa.
import fs from 'node:fs';
import zlib from 'node:zlib';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { execSync } from 'node:child_process';

const LO = 'https://raw.githubusercontent.com/LibreOffice/dictionaries/master';
const FW = 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018';
const IDIOMAS = {
    es: { dics: ['es/es_ES'], letras: /^[a-zñáéíóúü]+$/ },
    ca: { dics: ['ca/dictionaries/ca'], letras: /^[a-zçàèéíïòóúü·]+$/ },
    // en: SCOWL es pequeño; se completa con la lista amplia tipo Scrabble de an-array-of-english-words.
    en: { dics: ['en/en_US', 'en/en_GB'], letras: /^[a-z]+$/, extra: 'https://cdn.jsdelivr.net/npm/an-array-of-english-words/index.json' },
    fr: { dics: ['fr_FR/dictionaries/fr'], letras: /^[a-zàâçéèêëîïôûùüÿœæ]+$/ },
};
const MAX_CONOCIDAS = 45000;   // tope de palabras «conocidas» por idioma
const MIN_FREC = 4;            // apariciones mínimas para ser «conocida»

// Debe coincidir con baseDe() de src/utils/diccionarios.js
const baseDe = (w, idioma) => {
    let s = w.toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/·/g, '');
    if (idioma === 'es') s = s.replace(/ñ/g, '\u0001');
    s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return s.replace(/\u0001/g, 'ñ');
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dicc-'));
const bajar = async (url, destino) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    fs.writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
};
const leerLineas = async (fichero, fn) => {
    const rl = readline.createInterface({ input: fs.createReadStream(fichero, 'utf8'), crlfDelay: Infinity });
    for await (const l of rl) fn(l);
};

const pedidos = process.argv.slice(2).filter(l => IDIOMAS[l]);
for (const idioma of (pedidos.length ? pedidos : Object.keys(IDIOMAS))) {
    const cfg = IDIOMAS[idioma];
    console.log(`\n== ${idioma}`);
    const formas = new Set();
    const largas = new Set();
    for (const d of cfg.dics) {
        const nombre = path.join(tmp, d.replace(/\//g, '_'));
        await bajar(`${LO}/${d}.dic`, nombre + '.dic');
        await bajar(`${LO}/${d}.aff`, nombre + '.aff');
        console.log('Expandiendo', d, '…');
        execSync(`npx -y hunspell-reader words -u -o "${nombre}.txt" "${nombre}.dic"`, { stdio: 'ignore' });
        await leerLineas(nombre + '.txt', (l) => {
            const w = l.trim();
            // Solo minúsculas (fuera nombres propios, siglas y abreviaturas)
            if (!w || w !== w.toLowerCase() || !cfg.letras.test(w)) return;
            const n = w.replace(/·/g, '').replace(/[œæ]/g, 'xx').length;
            if (n < 2 || n > 15) return;
            if (w.includes('·') && !/l·l/.test(w)) return;
            if (n <= 9) formas.add(w); else largas.add(w);
        });
    }
    if (cfg.extra) {
        const lista = await fetch(cfg.extra).then(r => r.json());
        for (const w of lista) if (cfg.letras.test(w) && w.length >= 2 && w.length <= 15) (w.length <= 9 ? formas : largas).add(w);
    }
    console.log('Formas válidas:', formas.size);

    // Frecuencias por forma base
    const frecPath = path.join(tmp, `frec_${idioma}.txt`);
    await bajar(`${FW}/${idioma}/${idioma}_full.txt`, frecPath);
    const frec = new Map();
    await leerLineas(frecPath, (l) => {
        const [w, c] = l.trim().split(' ');
        if (!w || !formas.has(w)) return;
        frec.set(w, (frec.get(w) || 0) + Number(c));
    });

    const conocidas = [...frec.entries()].filter(([, c]) => c >= MIN_FREC)
        .sort((a, b) => b[1] - a[1]).slice(0, MAX_CONOCIDAS).map(([w]) => w);
    const setConocidas = new Set(conocidas);
    const resto = [...formas].filter(w => !setConocidas.has(w)).sort();

    const gz = (texto) => zlib.gzipSync(Buffer.from(texto, 'utf8'), { level: 9 });
    const mb = (p) => (fs.statSync(p).size / 1e6).toFixed(2);
    const salida = path.resolve(`public/diccionario/${idioma}.txt.gz`);
    fs.mkdirSync(path.dirname(salida), { recursive: true });
    fs.writeFileSync(salida, gz([...conocidas, '#', ...resto].join('\n')));
    const salidaLargas = path.resolve(`public/diccionario/${idioma}_largas.txt.gz`);
    fs.writeFileSync(salidaLargas, gz([...largas].sort().join('\n')));
    // Restos del formato antiguo sin comprimir
    for (const viejo of [`${idioma}.txt`, `${idioma}_largas.txt`]) fs.rmSync(path.resolve('public/diccionario', viejo), { force: true });
    console.log(`Escrito ${salidaLargas}: ${largas.size} formas de 10-15 letras (${mb(salidaLargas)} MB comprimido)`);
    console.log(`Escrito ${salida}: ${conocidas.length} conocidas + ${resto.length} poco frecuentes (${mb(salida)} MB comprimido)`);
}
fs.rmSync(tmp, { recursive: true, force: true });
