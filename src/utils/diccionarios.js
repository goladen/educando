// Diccionarios comunes de los juegos de palabras (VaniLa, Wordle…) en es / ca / en / fr.
// Ficheros: public/diccionario/<idioma>.txt.gz (gzip, ~6 MB los 8 ficheros), generados con scripts/generar-diccionarios.mjs
// a partir de los Hunspell de LibreOffice (todas las formas flexionadas, con su tilde)
// y ordenados por frecuencia de uso. Formato: palabras conocidas (de más a menos usadas),
// una línea «#» y el resto de formas válidas.

export const IDIOMAS_PALABRAS = {
    es: {
        nombre: 'Español', bandera: '🇪🇸',
        // Vocal → variantes que se van ciclando al tocarla
        variantes: { a: ['a', 'á'], e: ['e', 'é'], i: ['i', 'í'], o: ['o', 'ó'], u: ['u', 'ú', 'ü'] },
        vocales: { a: 12.5, e: 13.7, i: 6.3, o: 8.7, u: 3.9 },
        consonantes: { s: 8, r: 6.9, n: 6.7, d: 5.9, l: 5, c: 4.7, t: 4.6, m: 3.2, p: 2.5, b: 1.4, g: 1, v: 0.9, y: 0.8, q: 0.5, h: 0.7, f: 0.7, z: 0.5, j: 0.4, ñ: 0.3, x: 0.2 },
    },
    ca: {
        nombre: 'Català', bandera: '🏴',
        variantes: { a: ['a', 'à'], e: ['e', 'è', 'é'], i: ['i', 'í', 'ï'], o: ['o', 'ò', 'ó'], u: ['u', 'ú', 'ü'], c: ['c', 'ç'], l: ['l', 'l·'] },
        vocales: { a: 12.5, e: 13.2, i: 7.5, o: 5.5, u: 4.2 },
        consonantes: { s: 8, t: 6.9, n: 6.8, r: 6.6, l: 5.8, c: 3.9, d: 3.9, m: 3.1, p: 2.7, g: 1.3, v: 1.3, b: 1.3, q: 0.8, f: 0.9, h: 0.6, x: 0.5, j: 0.4, z: 0.2 },
    },
    en: {
        nombre: 'English', bandera: '🇬🇧',
        variantes: {},
        vocales: { a: 8.2, e: 12.7, i: 7, o: 7.5, u: 2.8 },
        consonantes: { t: 9.1, n: 6.7, s: 6.3, h: 5, r: 6, d: 4.3, l: 4, c: 2.8, m: 2.4, w: 2, f: 2, g: 2, y: 1.8, p: 1.9, b: 1.5, v: 1, k: 0.8, j: 0.2, x: 0.2, q: 0.1, z: 0.1 },
    },
    fr: {
        nombre: 'Français', bandera: '🇫🇷',
        variantes: { a: ['a', 'à', 'â'], e: ['e', 'é', 'è', 'ê', 'ë'], i: ['i', 'î', 'ï'], o: ['o', 'ô'], u: ['u', 'ù', 'û', 'ü'], c: ['c', 'ç'], y: ['y', 'ÿ'] },
        vocales: { a: 7.6, e: 14.7, i: 7.5, o: 5.4, u: 6.3 },
        consonantes: { s: 7.9, t: 7.2, n: 7.1, r: 6.6, l: 5.5, d: 3.7, c: 3.3, m: 3, p: 3, v: 1.6, q: 0.9, f: 1.1, b: 0.9, g: 0.9, h: 0.7, j: 0.5, x: 0.4, y: 0.3, z: 0.2 },
    },
};
export const CODIGOS_IDIOMA = Object.keys(IDIOMAS_PALABRAS);

// Forma base (la de las fichas): sin tildes, sin «·», ç→c, œ→oe. La ñ se conserva en español.
// Debe coincidir con baseDe() de scripts/generar-diccionarios.mjs
export const baseDe = (w, idioma = 'es') => {
    let s = w.toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/·/g, '');
    if (idioma === 'es') s = s.replace(/ñ/g, '\u0001');
    s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return s.replace(/\u0001/g, 'ñ');
};

// Normalización del Wordle: MAYÚSCULAS sin ningún diacrítico (la Ñ cuenta como N, igual que antes).
export const normalizarWordle = (w) => w.replace(/·/g, '').replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();

// Los ficheros se guardan ya comprimidos (.txt.gz) para que el repositorio pese poco.
// Si algún servidor lo entrega ya descomprimido (Content-Encoding: gzip), se nota en que
// faltan los bytes mágicos 1f 8b y se lee tal cual.
const leerTextoGz = async (url) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error('No se pudo cargar el diccionario');
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return new TextDecoder('utf-8').decode(bytes);
    if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador es demasiado antiguo para cargar el diccionario');
    const flujo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(flujo).text();
};

const promesas = {};
const descargar = (idioma) => {
    if (!promesas[idioma]) {
        promesas[idioma] = leerTextoGz(`/diccionario/${idioma}.txt.gz`)
            .then(txt => {
                const lineas = txt.split('\n');
                const corte = lineas.indexOf('#');
                return { conocidas: lineas.slice(0, corte < 0 ? lineas.length : corte), resto: corte < 0 ? [] : lineas.slice(corte + 1) };
            })
            .catch(e => { delete promesas[idioma]; throw e; });
    }
    return promesas[idioma];
};

// Diccionario para validar palabras con su grafía exacta (VaniLa).
//  formas:   Map base → { formas: [grafías válidas], conocida }
//  comunes:  bases conocidas, de más a menos frecuentes
const diccs = {};
export const cargarDiccionario = (idioma = 'es') => {
    if (!diccs[idioma]) {
        diccs[idioma] = descargar(idioma).then(({ conocidas, resto }) => {
            const formas = new Map();
            const comunes = [];
            const meter = (w, conocida) => {
                if (!w) return;
                const b = baseDe(w, idioma);
                let e = formas.get(b);
                if (!e) { formas.set(b, e = { formas: [], conocida: false }); }
                if (!e.formas.includes(w)) e.formas.push(w);
                if (conocida && !e.conocida) { e.conocida = true; comunes.push(b); }
            };
            conocidas.forEach(w => meter(w, true));
            resto.forEach(w => meter(w, false));
            return { idioma, formas, comunes, alfabeto: alfabetoDe(idioma) };
        }).catch(e => { delete diccs[idioma]; throw e; });
    }
    return diccs[idioma];
};

// Añade al diccionario las formas de 10-15 letras (solo las necesita el modo tablero).
const largasCargadas = {};
export const cargarLargas = (dicc) => {
    if (!largasCargadas[dicc.idioma]) {
        largasCargadas[dicc.idioma] = leerTextoGz(`/diccionario/${dicc.idioma}_largas.txt.gz`)
            .then(txt => {
                for (const w of txt.split('\n')) {
                    if (!w) continue;
                    const b = baseDe(w, dicc.idioma);
                    const e = dicc.formas.get(b);
                    if (!e) dicc.formas.set(b, { formas: [w], conocida: false });
                    else if (!e.formas.includes(w)) e.formas.push(w);
                }
                return dicc;
            })
            .catch(e => { delete largasCargadas[dicc.idioma]; throw e; });
    }
    return largasCargadas[dicc.idioma];
};

// Listas para el Wordle: todas las palabras válidas normalizadas y las conocidas por frecuencia.
export const cargarPalabrasWordle = async (idioma = 'es') => {
    const { conocidas, resto } = await descargar(idioma);
    const conocidasN = [];
    const vistas = new Set();
    for (const w of conocidas) { const n = normalizarWordle(w); if (!vistas.has(n)) { vistas.add(n); conocidasN.push(n); } }
    for (const w of resto) vistas.add(normalizarWordle(w));
    return { validas: vistas, conocidas: conocidasN };
};

// ─── Letras ──────────────────────────────────────────────────────────────────
const alfabetoDe = (idioma) => {
    const c = IDIOMAS_PALABRAS[idioma];
    return Object.keys(c.vocales).concat(Object.keys(c.consonantes));
};
const contar = (s, pos) => {
    const c = new Uint8Array(pos.size);
    for (const ch of s) { const i = pos.get(ch); if (i !== undefined) c[i]++; }
    return c;
};

export const esVocalLetra = (ch, idioma = 'es') => ch in IDIOMAS_PALABRAS[idioma].vocales;

// Bases conocidas que se pueden formar con las letras (array de letras base).
export const palabrasPosibles = (dicc, letras) => {
    const pos = new Map(dicc.alfabeto.map((c, i) => [c, i]));
    const disp = contar(letras, pos);
    const tmp = new Uint8Array(pos.size);
    const res = [];
    fuera: for (const b of dicc.comunes) {
        if (b.length > letras.length) continue;
        tmp.fill(0);
        for (let k = 0; k < b.length; k++) {
            const i = pos.get(b[k]);
            if (i === undefined || ++tmp[i] > disp[i]) continue fuera;
        }
        res.push(b);
    }
    return res;
};

// Validación con grafía exacta → { ok, conocida } | { ok:false, motivo:'noexiste'|'faltatilde'|'tildemal', correctas }
export const validarPalabra = (dicc, forma) => {
    const b = baseDe(forma, dicc.idioma);
    const e = dicc.formas.get(b);
    if (!e) return { ok: false, motivo: 'noexiste' };
    // œ/æ no se pueden formar con fichas: «coeur» vale por «cœur».
    if (e.formas.some(f => f === forma || f.replace(/œ/g, 'oe').replace(/æ/g, 'ae') === forma)) return { ok: true, conocida: e.conocida };
    return { ok: false, motivo: forma !== b ? 'tildemal' : 'faltatilde', correctas: e.formas };
};

export const barajar = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
};

// Saca una letra al azar según la frecuencia del idioma (máx. 2 iguales, 1 si es escasa).
export const sacarLetra = (idioma, vocal, actuales = []) => {
    const pesos = vocal ? IDIOMAS_PALABRAS[idioma].vocales : IDIOMAS_PALABRAS[idioma].consonantes;
    const ok = Object.entries(pesos).filter(([l, p]) => {
        const n = actuales.filter(x => x === l).length;
        return n < 2 && !(p < 1.2 && n >= 1);
    });
    let r = Math.random() * ok.reduce((a, [, p]) => a + p, 0);
    for (const [l, p] of ok) { r -= p; if (r <= 0) return l; }
    return ok[ok.length - 1][0];
};

// Sortea n letras (3-4 vocales en 9) comprobando con el diccionario que den juego.
export const generarLetras = (dicc, n = 9) => {
    let mejor = null;
    const idioma = dicc.idioma;
    for (let intento = 0; intento < 30; intento++) {
        const nv = Math.max(2, Math.round(n * (Math.random() < 0.55 ? 4 : 3) / 9));
        const letras = [];
        for (let i = 0; i < nv; i++) letras.push(sacarLetra(idioma, true, letras));
        for (let i = nv; i < n; i++) letras.push(sacarLetra(idioma, false, letras));
        if (letras.includes('q') && !letras.includes('u')) continue;
        const pos = palabrasPosibles(dicc, letras);
        const larga = pos.reduce((m, b) => Math.max(m, b.length), 0);
        const calidad = Math.min(pos.length, 80) + larga * 6;
        if (pos.length >= 30 && larga >= Math.min(6, n - 2)) return barajar(letras);
        if (!mejor || calidad > mejor.calidad) mejor = { letras, calidad };
    }
    return barajar(mejor.letras);
};
