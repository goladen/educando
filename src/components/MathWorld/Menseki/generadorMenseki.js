// Generador de retos Menseki al azar.
// 1) Se crea una cuadrícula de columnas (anchos) y filas (altos) con números enteros
//    y se parte en rectángulos (alguna vez se juntan dos celdas).
// 2) Un resolvedor por propagación deduce medidas con reglas que un alumno puede seguir:
//      · área ÷ lado = el otro lado          · lado × lado = área
//      · medidas que se suman o se restan     · áreas que se juntan o se restan
// 3) Se parte de muchos datos y se van quitando mientras el reto siga teniendo solución.
//    Así queda un reto mínimo, con la explicación paso a paso y una pista.
// Devuelve un objeto con el mismo formato que MENSEKI_BASE.

const LETRAS = 'ABCDEFGHIJKLMNOP';

const PERFILES = {
    primaria: {
        1: { tam: [[2, 2]], val: [2, 9], pasos: [2, 3], fusion: 0 },
        2: { tam: [[2, 2], [3, 2], [2, 3]], val: [2, 9], pasos: [3, 4], fusion: 0.3 },
        3: { tam: [[2, 2], [3, 2], [2, 3]], val: [2, 10], pasos: [4, 6], fusion: 0.4 },
    },
    secundaria: {
        1: { tam: [[2, 2], [3, 2], [2, 3]], val: [2, 12], pasos: [3, 4], fusion: 0.3 },
        2: { tam: [[3, 2], [2, 3], [3, 3]], val: [2, 12], pasos: [5, 6], fusion: 0.4 },
        3: { tam: [[3, 3], [4, 2], [2, 4]], val: [2, 12], pasos: [7, 11], fusion: 0.5 },
    },
};

const azar = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const elegir = (arr) => arr[Math.floor(Math.random() * arr.length)];
const barajar = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ─── Figura ─────────────────────────────────────────────────────────────────
function crearFigura(nc, nr, val, probFusion) {
    const W = Array.from({ length: nc }, () => azar(val[0], val[1]));
    const H = Array.from({ length: nr }, () => azar(val[0], val[1]));
    const celdas = [];
    for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) celdas.push({ c0: c, c1: c + 1, r0: r, r1: r + 1 });
    let rects = celdas;
    // Como mucho una fusión de dos celdas vecinas (la línea sigue viéndose en otra fila/columna).
    if (Math.random() < probFusion && (nc > 1 || nr > 1)) {
        const opciones = [];
        for (const a of celdas) for (const b of celdas) {
            if (a.c1 === b.c0 && a.r0 === b.r0 && nr > 1) opciones.push([a, b, { c0: a.c0, c1: b.c1, r0: a.r0, r1: a.r1 }]);
            if (a.r1 === b.r0 && a.c0 === b.c0 && nc > 1) opciones.push([a, b, { c0: a.c0, c1: a.c1, r0: a.r0, r1: b.r1 }]);
        }
        if (opciones.length) {
            const [a, b, m] = elegir(opciones);
            rects = [...celdas.filter(x => x !== a && x !== b), m];
        }
    }
    rects = rects
        .sort((p, q) => p.r0 - q.r0 || p.c0 - q.c0)
        .map((r, i) => ({ ...r, id: LETRAS[i] }));
    return { W, H, nc, nr, rects };
}

const suma = (arr, a, b) => arr.slice(a, b).reduce((s, x) => s + x, 0);
const kReg = (c0, c1, r0, r1) => `A:${c0},${c1},${r0},${r1}`;

// Regiones que son unión exacta de rectángulos dibujados (ninguno queda cortado).
function regionesValidas(fig) {
    const res = [];
    for (let c0 = 0; c0 < fig.nc; c0++) for (let c1 = c0 + 1; c1 <= fig.nc; c1++)
        for (let r0 = 0; r0 < fig.nr; r0++) for (let r1 = r0 + 1; r1 <= fig.nr; r1++) {
            const dentro = [];
            let ok = true;
            for (const R of fig.rects) {
                const solapa = R.c0 < c1 && R.c1 > c0 && R.r0 < r1 && R.r1 > r0;
                if (!solapa) continue;
                const contenido = R.c0 >= c0 && R.c1 <= c1 && R.r0 >= r0 && R.r1 <= r1;
                if (!contenido) { ok = false; break; }
                dentro.push(R.id);
            }
            if (ok) res.push({ c0, c1, r0, r1, key: kReg(c0, c1, r0, r1), ids: dentro });
        }
    return res;
}

// ─── Nombres para la explicación ────────────────────────────────────────────
function nombreIntervalo(q, fig) {
    const [tipo, rango] = q.split(':');
    const [a, b] = rango.split(',').map(Number);
    const n = tipo === 'w' ? fig.nc : fig.nr;
    if (tipo === 'w') {
        if (a === 0 && b === n) return 'ancho total';
        if (b - a === 1) return `ancho de la columna ${a + 1}`;
        return `ancho de las columnas ${a + 1} a ${b}`;
    }
    if (a === 0 && b === n) return 'alto total';
    if (b - a === 1) return `alto de la fila ${a + 1}`;
    return `alto de las filas ${a + 1} a ${b}`;
}
const nombreRegion = (reg) => reg.ids.join(' + ');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ─── Resolvedor ─────────────────────────────────────────────────────────────
// datos: Map nombre → valor. Devuelve Map nombre → { val, texto, pista, deps }.
function resolver(fig, regiones, datos, objetivo = null) {
    const K = new Map();
    for (const [q, v] of datos) K.set(q, { val: v, deps: [], dato: true });
    const regPorKey = new Map(regiones.map(r => [r.key, r]));
    const anadir = (q, val, deps, texto, pista) => {
        if (K.has(q)) return false;
        if (!Number.isInteger(val) || val <= 0) return false;
        K.set(q, { val, deps, texto, pista });
        return true;
    };
    const v = (q) => K.get(q)?.val;
    // Por prioridad: primero lo directo (área ÷ lado, lado × lado), luego sumar/restar
    // medidas y por último juntar/restar áreas. Una deducción cada vez, para que la
    // explicación siga el camino más natural.
    const porTamano = [...regiones].sort((x, y) => x.ids.length - y.ids.length);
    const directo = () => {
        for (const R of porTamano) {
            const qa = R.key, qw = `w:${R.c0},${R.c1}`, qh = `h:${R.r0},${R.r1}`;
            const [A, w, h] = [v(qa), v(qw), v(qh)];
            const nom = nombreRegion(R);
            const quien = R.ids.length > 1 ? 'los rectángulos ' + nom + ' juntos' : 'el rectángulo ' + nom;
            if (A != null && w != null && h == null && A % w === 0 &&
                anadir(qh, A / w, [qa, qw], `${cap(nombreIntervalo(qh, fig))} = ${A} ÷ ${w} = ${A / w} cm (${nom})`, `Fíjate en ${quien}: conoces su área y su ancho.`)) return true;
            if (A != null && h != null && w == null && A % h === 0 &&
                anadir(qw, A / h, [qa, qh], `${cap(nombreIntervalo(qw, fig))} = ${A} ÷ ${h} = ${A / h} cm (${nom})`, `Fíjate en ${quien}: conoces su área y su alto.`)) return true;
            if (A == null && w != null && h != null &&
                anadir(qa, w * h, [qw, qh], `Área de ${nom} = ${w} × ${h} = ${w * h} cm²`, `Ya puedes saber los dos lados de ${nom}.`)) return true;
        }
        return false;
    };
    const medidas = () => {
        for (const [t, n] of [['w', fig.nc], ['h', fig.nr]]) {
            for (let a = 0; a < n; a++) for (let b = a + 2; b <= n; b++) for (let c = a + 1; c < b; c++) {
                const T = `${t}:${a},${b}`, P = `${t}:${a},${c}`, Q = `${t}:${c},${b}`;
                const [vt, vp, vq] = [v(T), v(P), v(Q)];
                if (vt == null && vp != null && vq != null &&
                    anadir(T, vp + vq, [P, Q], `${cap(nombreIntervalo(T, fig))} = ${vp} + ${vq} = ${vp + vq} cm`, 'Suma dos medidas que ya conoces en el mismo lado.')) return true;
                if (vt != null && vp != null && vq == null &&
                    anadir(Q, vt - vp, [T, P], `${cap(nombreIntervalo(Q, fig))} = ${vt} − ${vp} = ${vt - vp} cm`, 'Resta a la medida total la parte que ya conoces.')) return true;
                if (vt != null && vq != null && vp == null &&
                    anadir(P, vt - vq, [T, Q], `${cap(nombreIntervalo(P, fig))} = ${vt} − ${vq} = ${vt - vq} cm`, 'Resta a la medida total la parte que ya conoces.')) return true;
            }
        }
        return false;
    };
    const areas = () => {
        for (const R of porTamano) {
            const qa = R.key, nom = nombreRegion(R);
            const cortes = [];
            for (let c = R.c0 + 1; c < R.c1; c++) cortes.push([kReg(R.c0, c, R.r0, R.r1), kReg(c, R.c1, R.r0, R.r1)]);
            for (let r = R.r0 + 1; r < R.r1; r++) cortes.push([kReg(R.c0, R.c1, R.r0, r), kReg(R.c0, R.c1, r, R.r1)]);
            for (const [p, q] of cortes) {
                const rp = regPorKey.get(p), rq = regPorKey.get(q);
                if (!rp || !rq) continue;
                const [vT, vP, vQ] = [v(qa), v(p), v(q)];
                if (vT == null && vP != null && vQ != null &&
                    anadir(qa, vP + vQ, [p, q], `Área de ${nom} = ${vP} + ${vQ} = ${vP + vQ} cm²`, `Junta ${nombreRegion(rp)} y ${nombreRegion(rq)} en un solo rectángulo.`)) return true;
                if (vT != null && vP != null && vQ == null &&
                    anadir(q, vT - vP, [qa, p], `Área de ${nombreRegion(rq)} = ${vT} − ${vP} = ${vT - vP} cm²`, `Al área de ${nom} réstale la parte que ya conoces.`)) return true;
                if (vT != null && vQ != null && vP == null &&
                    anadir(p, vT - vQ, [qa, q], `Área de ${nombreRegion(rp)} = ${vT} − ${vQ} = ${vT - vQ} cm²`, `Al área de ${nom} réstale la parte que ya conoces.`)) return true;
            }
        }
        return false;
    };
    for (let vueltas = 0; vueltas < 400; vueltas++) {
        if (objetivo && K.has(objetivo)) break;
        if (!(directo() || medidas() || areas())) break;
    }
    return K;
}

// Pasos necesarios para llegar al objetivo (en orden de deducción).
function pasosHasta(K, objetivo) {
    const orden = [...K.keys()];
    const pos = new Map(orden.map((q, i) => [q, i]));
    const usados = new Set();
    const pila = [objetivo];
    while (pila.length) {
        const q = pila.pop();
        if (usados.has(q)) continue;
        const e = K.get(q);
        if (!e || e.dato) continue;
        usados.add(q);
        pila.push(...e.deps);
    }
    return [...usados].sort((a, b) => pos.get(a) - pos.get(b)).map(q => K.get(q));
}

// ─── Datos visibles: áreas y cotas posibles ─────────────────────────────────
function cotasPosibles(fig) {
    const res = [];
    const lineaVisible = (t, k, borde) => {
        // ¿la línea de cuadrícula k aparece en el borde (fila 0 / última, col 0 / última)?
        if (t === 'w') {
            if (k === 0 || k === fig.nc) return true;
            const fila = borde === 'top' ? 0 : fig.nr - 1;
            return !fig.rects.some(R => R.r0 <= fila && R.r1 > fila && R.c0 < k && R.c1 > k);
        }
        if (k === 0 || k === fig.nr) return true;
        const col = borde === 'left' ? 0 : fig.nc - 1;
        return !fig.rects.some(R => R.c0 <= col && R.c1 > col && R.r0 < k && R.r1 > k);
    };
    for (const [t, n, bordes] of [['w', fig.nc, ['top', 'bottom']], ['h', fig.nr, ['left', 'right']]]) {
        const intervalos = [];
        for (let a = 0; a < n; a++) intervalos.push([a, a + 1]);
        if (n > 1) intervalos.push([0, n]);
        for (const [a, b] of intervalos) {
            const lado = barajar(bordes).find(bd => lineaVisible(t, a, bd) && lineaVisible(t, b, bd));
            if (lado) res.push({ q: `${t}:${a},${b}`, t, a, b, lado });
        }
    }
    return res;
}

function aVisual(fig) {
    // Columnas/filas más grandes se dibujan algo más anchas (2 o 3 unidades), sin escala real.
    const escala = (arr) => {
        const orden = [...arr].sort((a, b) => a - b);
        const mediana = orden[Math.floor(orden.length / 2)];
        return arr.map(x => (x > mediana ? 3 : 2));
    };
    const vw = escala(fig.W), vh = escala(fig.H);
    const X = [0]; vw.forEach(x => X.push(X[X.length - 1] + x));
    const Y = [0]; vh.forEach(y => Y.push(Y[Y.length - 1] + y));
    return { X, Y };
}

let contador = 0;

/**
 * Genera un reto nuevo.
 * @param {'primaria'|'secundaria'} nivel
 * @param {1|2|3} dificultad  1 fácil · 2 media · 3 difícil
 */
export function generarRetoMenseki(nivel = 'primaria', dificultad = 2) {
    const perfil = (PERFILES[nivel] || PERFILES.primaria)[dificultad] || PERFILES.primaria[2];
    let mejor = null;
    for (let intento = 0; intento < 300; intento++) {
        const [nc, nr] = elegir(perfil.tam);
        const fig = crearFigura(nc, nr, perfil.val, perfil.fusion);
        const regiones = regionesValidas(fig);
        const cotas = cotasPosibles(fig);
        const areaDe = (R) => (suma(fig.W, R.c0, R.c1)) * (suma(fig.H, R.r0, R.r1));
        const valorDe = (q) => {
            const [t, rango] = q.split(':');
            const [a, b] = rango.split(',').map(Number);
            return suma(t === 'w' ? fig.W : fig.H, a, b);
        };

        // Objetivo: el área de un rectángulo (más frecuente) o una medida.
        const buscaArea = Math.random() < 0.7 || !cotas.length;
        let objetivo, rectObjetivo = null, cotaObjetivo = null;
        if (buscaArea) {
            rectObjetivo = elegir(fig.rects);
            objetivo = kReg(rectObjetivo.c0, rectObjetivo.c1, rectObjetivo.r0, rectObjetivo.r1);
        } else {
            cotaObjetivo = elegir(cotas);
            objetivo = cotaObjetivo.q;
        }

        // Datos de partida: todas las áreas (menos la buscada) y todas las cotas (menos la buscada).
        let datosAreas = fig.rects.filter(R => R !== rectObjetivo).map(R => ({ tipo: 'area', R, q: kReg(R.c0, R.c1, R.r0, R.r1), val: areaDe(R) }));
        let datosCotas = cotas.filter(c => c !== cotaObjetivo).map(c => ({ tipo: 'cota', c, q: c.q, val: valorDe(c.q) }));
        const mapa = (lista) => new Map(lista.map(d => [d.q, d.val]));
        const resuelve = (lista) => resolver(fig, regiones, mapa(lista), objetivo).has(objetivo);
        let lista = [...datosAreas, ...datosCotas];
        if (!resuelve(lista)) continue;
        // Quitar datos mientras siga habiendo solución. Se dejan al menos la mitad de las
        // áreas a la vista para que no quede una figura casi en blanco.
        const minAreas = Math.ceil(fig.rects.length / 2);
        for (const d of barajar([...datosCotas, ...datosAreas])) {
            const sin = lista.filter(x => x !== d);
            if (d.tipo === 'area' && sin.filter(x => x.tipo === 'area').length < minAreas) continue;
            if (resuelve(sin)) lista = sin;
        }
        const K = resolver(fig, regiones, mapa(lista), objetivo);
        const pasos = pasosHasta(K, objetivo);
        const n = pasos.length;
        const [pmin, pmax] = perfil.pasos;
        const puntua = Math.abs(n - (pmin + pmax) / 2);
        if (!mejor || puntua < mejor.puntua) mejor = { fig, lista, pasos, objetivo, rectObjetivo, cotaObjetivo, valorDe, areaDe, puntua };
        if (n >= pmin && n <= pmax) break;
    }
    if (!mejor) return null;

    const { fig, lista, pasos, rectObjetivo, cotaObjetivo, valorDe, areaDe } = mejor;
    const { X, Y } = aVisual(fig);
    const conocidas = new Set(lista.filter(d => d.tipo === 'area').map(d => d.R.id));
    const rects = fig.rects.map(R => ({
        id: R.id, x: X[R.c0], y: Y[R.r0], w: X[R.c1] - X[R.c0], h: Y[R.r1] - Y[R.r0],
        area: R === rectObjetivo ? '?' : conocidas.has(R.id) ? areaDe(R) : null,
    }));
    const cotaVisual = (c, valor) => {
        if (c.t === 'w') {
            const y = c.lado === 'top' ? 0 : Y[fig.nr];
            return { lado: c.lado, desde: [X[c.a], y], hasta: [X[c.b], y], valor };
        }
        const x = c.lado === 'left' ? 0 : X[fig.nc];
        return { lado: c.lado, desde: [x, Y[c.a]], hasta: [x, Y[c.b]], valor };
    };
    const cotas = lista.filter(d => d.tipo === 'cota').map(d => cotaVisual(d.c, d.val));
    if (cotaObjetivo) cotas.push(cotaVisual(cotaObjetivo, '?'));

    const solucion = rectObjetivo ? areaDe(rectObjetivo) : valorDe(cotaObjetivo.q);
    const nPasos = pasos.length;
    const estrellas = nPasos <= 2 ? 1 : nPasos <= 3 ? 2 : nPasos <= 5 ? 3 : nPasos <= 7 ? 4 : 5;
    contador++;
    return {
        id: `gen-${Date.now().toString(36)}-${contador}`,
        nivel,
        generado: true,
        dificultad: estrellas,
        titulo: 'Reto generado',
        rects,
        cotas,
        solucion,
        unidad: rectObjetivo ? 'cm²' : 'cm',
        pista: pasos[0]?.pista || 'Busca un rectángulo del que conozcas el área y un lado.',
        explicacion: pasos.map(p => p.texto).join('. ') + '.',
    };
}

// Varios a la vez (para la ficha PDF), sin repetir figura exacta.
export function generarVariosMenseki(n, nivel, dificultad) {
    const res = [];
    const vistos = new Set();
    for (let i = 0; i < n * 4 && res.length < n; i++) {
        const r = generarRetoMenseki(nivel, dificultad);
        if (!r) continue;
        const firma = JSON.stringify([r.rects.map(x => [x.x, x.y, x.w, x.h, x.area]), r.cotas.map(c => c.valor)]);
        if (vistos.has(firma)) continue;
        vistos.add(firma);
        res.push(r);
    }
    return res;
}
