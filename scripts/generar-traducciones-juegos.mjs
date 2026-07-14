// Genera src/i18n/staticTranslations.games.js traduciendo UNA sola vez los
// textos largos de GAME_INFO y las descripciones de tarjetas de
// LandingGames3.jsx. Ejecutar:
//
//   node scripts/generar-traducciones-juegos.mjs
//
// NO necesita la clave de Gemini: usa tu proxy ya desplegado (que tiene la clave
// en el servidor). Se puede cambiar con la variable PIKT_PROXY:
//   PIKT_PROXY=https://www.pikt.es/api/gemini node scripts/generar-traducciones-juegos.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const FUENTE = join(ROOT, 'src', 'components', 'LandingGames3.jsx');
const SALIDA = join(ROOT, 'src', 'i18n', 'staticTranslations.games.js');

const PROXY = process.env.PIKT_PROXY || 'https://www.pikt.es/api/gemini';
const IDIOMAS = { en: 'English', ca: 'Catalan/Valencian', fr: 'French' };
const MODELO = 'gemini-2.5-flash';
const LOTE = 40; // strings por petición

// ── Extracción de strings del fuente ─────────────────────────────────────────
function unescape(s) { return s.replace(/\\'/g, "'").replace(/\\\\/g, '\\'); }

function extraerStrings(codigo) {
    const set = new Set();
    // Campos de texto largo (GAME_INFO) + desc de tarjetas
    const reCampo = /\b(?:descripcion|tipoPreguntas|biblioteca|multiplayer|desc):\s*'((?:[^'\\]|\\.)*)'/g;
    let m;
    while ((m = reCampo.exec(codigo))) {
        const v = unescape(m[1]).trim();
        if (v) set.add(v);
    }
    // Items de materias / etapas
    const reArr = /\b(?:materias|etapas):\s*\[([^\]]*)\]/g;
    while ((m = reArr.exec(codigo))) {
        const items = m[1].match(/'((?:[^'\\]|\\.)*)'/g) || [];
        for (const it of items) {
            const v = unescape(it.slice(1, -1)).trim();
            if (v) set.add(v);
        }
    }
    return [...set];
}

// ── Traducción por lotes ─────────────────────────────────────────────────────
async function traducirLote(textos, idiomaNombre) {
    const entrada = {};
    textos.forEach((t, i) => { entrada[i] = t; });
    const prompt = `You are a professional translator for an educational web app for children.
Translate the VALUES of the following JSON object from Spanish to ${idiomaNombre}.
Rules:
- Keep the SAME keys and the SAME number of entries.
- Keep any emojis, {placeholders}, numbers and line breaks exactly as they are.
- Do NOT translate proper nouns, brand names or code (e.g. "pikt.es", "Pi", "Micro:bit", "Arduino", "PiLive").
- Respond ONLY with the translated JSON object, no markdown, no comments.

${JSON.stringify(entrada)}`;

    // Llama al proxy desplegado (/api/gemini), que guarda la clave en servidor.
    const res = await fetch(PROXY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: MODELO,
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2 },
        }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || data?.error || `Proxy ${res.status}`);
    const raw = (data?.candidates?.[0]?.content?.parts?.[0]?.text || '')
        .replace(/```json/gi, '').replace(/```/g, '').trim();
    const obj = JSON.parse(raw);
    return textos.map((original, i) => (typeof obj[i] === 'string' && obj[i].trim()) ? obj[i] : original);
}

async function traducirTodo(textos, idiomaNombre) {
    const salida = {};
    for (let i = 0; i < textos.length; i += LOTE) {
        const chunk = textos.slice(i, i + LOTE);
        process.stdout.write(`   ${idiomaNombre}: ${i + chunk.length}/${textos.length}\r`);
        const trad = await traducirLote(chunk, idiomaNombre);
        chunk.forEach((orig, j) => { salida[orig] = trad[j]; });
    }
    console.log('');
    return salida;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    const codigo = readFileSync(FUENTE, 'utf8');
    const textos = extraerStrings(codigo);
    console.log(`📖 ${textos.length} textos únicos extraídos de LandingGames3.jsx`);
    console.log(`🔌 Usando proxy: ${PROXY}`);

    const dict = {};
    for (const [cod, nombre] of Object.entries(IDIOMAS)) {
        console.log(`🌐 Traduciendo a ${nombre}…`);
        dict[cod] = await traducirTodo(textos, nombre);
    }

    const banner = `// GENERADO automáticamente por scripts/generar-traducciones-juegos.mjs\n// No editar a mano: se regenera. ${new Date().toISOString()}\n`;
    writeFileSync(SALIDA, `${banner}export const STATIC_TRANSLATIONS_GAMES = ${JSON.stringify(dict, null, 2)};\n`, 'utf8');
    console.log(`✅ Escrito ${SALIDA}`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
