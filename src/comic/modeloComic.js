// Modelo de datos del Creador de cómics (compartido por el editor, los informes y Control de Aula).
//
// Cómic:   { id, titulo, autor, mostrarTitulo, paginas: [{ disposicion, vinetas: [Viñeta] }], plantilla?, modificado }
// Viñeta:  { fondo, color, els: [Elemento] }
// Clave de viñeta: "p-v" (página-viñeta), p. ej. "0-2".
// Los cómics antiguos ({ disposicion, vinetas }) se convierten con normalizarComic.

export const nid = () => Math.random().toString(36).slice(2, 9);
export const vinetaVacia = () => ({ fondo: 'liso', color: '#ffffff', els: [] });
export const clave = (p, v) => `${p}-${v}`;

export function normalizarComic(c) {
    if (!c || typeof c !== 'object') return null;
    const paginas = Array.isArray(c.paginas) && c.paginas.length
        ? c.paginas.map((p) => ({ disposicion: p.disposicion || 'p4', vinetas: Array.isArray(p.vinetas) ? p.vinetas : [] }))
        : [{ disposicion: c.disposicion || 'p4', vinetas: Array.isArray(c.vinetas) ? c.vinetas : [] }];
    const { disposicion, vinetas, ...resto } = c; // eslint-disable-line no-unused-vars
    return { titulo: '', autor: '', mostrarTitulo: true, ...resto, id: c.id || nid(), paginas };
}

// Lo que dibuja ComicPagina para una página concreta (el título solo en la primera).
export function vistaPagina(comic, p) {
    const pag = comic.paginas[p] || comic.paginas[0];
    return {
        titulo: comic.titulo, autor: comic.autor,
        mostrarTitulo: p === 0 && !!comic.mostrarTitulo,
        disposicion: pag.disposicion, vinetas: pag.vinetas,
    };
}

// ─── Plantillas por enlace (?plantilla=…): JSON comprimido en la URL, sin Firestore ───
function aBase64Url(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function deBase64Url(txt) {
    const b = atob(txt.replace(/-/g, '+').replace(/_/g, '/'));
    const out = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
    return out;
}
async function transformar(bytes, stream) {
    const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
    return new Uint8Array(await res.arrayBuffer());
}

// "z" + deflate si el navegador lo permite; si no, "j" + JSON en base64.
export async function codificarPlantilla(obj) {
    const json = new TextEncoder().encode(JSON.stringify(obj));
    if (typeof CompressionStream !== 'undefined') {
        try { return 'z' + aBase64Url(await transformar(json, new CompressionStream('deflate-raw'))); } catch { /* sigue */ }
    }
    return 'j' + aBase64Url(json);
}
export async function decodificarPlantilla(txt) {
    if (!txt || txt.length < 2) return null;
    const bytes = deBase64Url(txt.slice(1));
    const datos = txt[0] === 'z' ? await transformar(bytes, new DecompressionStream('deflate-raw')) : bytes;
    return JSON.parse(new TextDecoder().decode(datos));
}

// Plantilla = { v:1, titulo, consigna, bloquear, comic }. Los bocadillos con `completar`
// guardan como texto la pista que verá el alumno.
export function prepararPlantilla(comic, { consigna, bloquear }) {
    const limpio = JSON.parse(JSON.stringify(normalizarComic(comic)));
    delete limpio.id; delete limpio.modificado; delete limpio.plantilla;
    limpio.paginas.forEach((p) => p.vinetas.forEach((v) => v.els.forEach((e) => { delete e.fijo; delete e.pista; })));
    return { v: 1, titulo: comic.titulo || 'Cómic', consigna: consigna || '', bloquear: !!bloquear, comic: limpio };
}

// Cómic del alumno a partir de una plantilla.
export function comicDesdePlantilla(pl) {
    const c = normalizarComic(JSON.parse(JSON.stringify(pl.comic || {})));
    c.id = nid();
    c.plantilla = { titulo: pl.titulo || c.titulo || 'Plantilla', consigna: pl.consigna || '' };
    c.paginas.forEach((p) => p.vinetas.forEach((v) => v.els.forEach((e) => {
        e.id = e.id || nid();
        if (pl.bloquear) e.fijo = true;
        if (e.tipo === 'bocadillo' && e.completar) { e.pista = e.texto || ''; e.texto = ''; }
    })));
    return c;
}

export const contarCompletar = (comic) => comic.paginas.reduce((n, p) => n + p.vinetas.reduce((m, v) => m + v.els.filter((e) => e.tipo === 'bocadillo' && e.completar).length, 0), 0);

// ─── Cómic colaborativo (Control de Aula) ───
// base: cómic de la tarea; asignacion: { sid: ["p-v", …] }; alumnos: docs de students con .comic.vinetas
export function montarColaborativo(base, asignacion, alumnos, taskId) {
    const c = normalizarComic(JSON.parse(JSON.stringify(base)));
    const duenoDe = {};
    Object.entries(asignacion || {}).forEach(([sid, ks]) => (ks || []).forEach((k) => { duenoDe[k] = sid; }));
    const porId = {};
    (alumnos || []).forEach((a) => { if (a.comic?.taskId === taskId) porId[a.id] = a.comic.vinetas || {}; });
    c.paginas.forEach((p, pi) => {
        p.vinetas = p.vinetas.map((v, vi) => {
            const k = clave(pi, vi);
            const sid = duenoDe[k];
            return sid && porId[sid]?.[k] ? porId[sid][k] : v;
        });
    });
    return c;
}

// Reparte las viñetas libres entre los alumnos sin ninguna (por orden). Si faltan, añade páginas.
export function repartirVinetas(base, asignacion, idsAlumnos, { porAlumno = 1, disposicionNueva = 'p4' } = {}) {
    const numV = (d) => ({ p1: 1, p2h: 2, p2: 2, p3: 3, p4: 4, p4z: 4, p5: 5, p6: 6, t3: 3, t4: 4 }[d] || 4);
    const comic = normalizarComic(JSON.parse(JSON.stringify(base)));
    const asig = { ...(asignacion || {}) };
    const ocupadas = new Set(Object.values(asig).flat());
    const libres = [];
    const recalcularLibres = () => {
        libres.length = 0;
        comic.paginas.forEach((p, pi) => { for (let vi = 0; vi < numV(p.disposicion); vi++) if (!ocupadas.has(clave(pi, vi))) libres.push(clave(pi, vi)); });
    };
    recalcularLibres();
    for (const sid of idsAlumnos) {
        if ((asig[sid] || []).length) continue;
        const mias = [];
        for (let i = 0; i < porAlumno; i++) {
            if (!libres.length) {
                comic.paginas.push({ disposicion: disposicionNueva, vinetas: Array.from({ length: numV(disposicionNueva) }, vinetaVacia) });
                recalcularLibres();
            }
            const k = libres.shift();
            ocupadas.add(k);
            mias.push(k);
        }
        asig[sid] = mias;
    }
    comic.paginas.forEach((p) => { while (p.vinetas.length < numV(p.disposicion)) p.vinetas.push(vinetaVacia()); });
    return { comic, asignacion: asig };
}
