// ─── Motor del simulador de conducción (three.js, fuera de React) ────────────
// Ciudad en cuadrícula con calles de 30, avenidas de 50 y una calle residencial
// de 20; semáforos, STOP, ceda el paso, cruces sin señalizar (prioridad a la
// derecha), calles de sentido único, pasos de cebra con peatones y tráfico.
// Detecta las infracciones y las clasifica como en el examen práctico.
// Vistas: cabina (también en gafas VR con WebXR) y exterior; gafas de cartón
// con StereoEffect + giroscopio.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { StereoEffect } from 'three/examples/jsm/effects/StereoEffect.js';
import { senalCanvas } from './senales';

// ═══════════════════════════════ MAPA ═══════════════════════════════════════
export const N = 5, S = 64, ACERA = 3.2, CARRIL = 3.5;
const TIPO_V = ['calle', 'calle', 'avenida', 'calle', 'calle']; // líneas x = i·S
const TIPO_H = ['calle', 'calle', 'avenida', 'calle', 'calle']; // líneas z = j·S
const SENTIDO_V = { 1: 1 };   // x = 64: sentido único hacia el sur (+z)
const SENTIDO_H = { 3: -1 };  // z = 192: sentido único hacia el oeste (−x)
const halfV = i => (TIPO_V[i] === 'avenida' ? 2 * CARRIL : CARRIL);
const halfH = j => (TIPO_H[j] === 'avenida' ? 2 * CARRIL : CARRIL);
const X_MIN = -halfV(0), X_MAX = (N - 1) * S + halfV(N - 1);
const Z_MIN = -halfH(0), Z_MAX = (N - 1) * S + halfH(N - 1);

export const DIRS = { E: [1, 0], W: [-1, 0], S: [0, 1], N: [0, -1] };
export const OPUESTO = { E: 'W', W: 'E', N: 'S', S: 'N' };
export const A_DERECHA = { N: 'E', E: 'S', S: 'W', W: 'N' };
export const A_IZQUIERDA = { N: 'W', W: 'S', S: 'E', E: 'N' };
const derechaDe = d => { const [x, z] = DIRS[d]; return [-z, x]; };
const ejeDe = d => (d === 'E' || d === 'W' ? 'x' : 'z');
const signoDe = d => (d === 'E' || d === 'S' ? 1 : -1);
export const tipoGiro = (dIn, dOut) => (dIn === dOut ? 'recto' : A_DERECHA[dIn] === dOut ? 'derecha' : A_IZQUIERDA[dIn] === dOut ? 'izquierda' : 'cambio');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const ZEBRAS = new Set(['h_1_2', 'v_3_2', 'h_2_0', 'v_4_1', 'h_0_3', 'v_2_3', 'h_3_4', 'v_0_2', 'v_1_1']);
const COLEGIO = 'v_3_2';
const RESIDENCIAL = 'h_3_1';
const SEMAFOROS = new Set(['2_1', '3_2', '2_0', '2_4', '0_2', '4_2']);
const PROHIBIDOS = { '2_1': { E: ['derecha'] } };
// Glorieta en el cruce de las dos avenidas
export const GLORIETA = '2_2';
export const R_ISLA = 6, R_EXT = 14.5, R_ANILLO = 10.4;
const GX = 2 * S, GZ = 2 * S;
const ANG_BRAZO = { E: 0, N: 90, W: 180, S: 270 }; // ángulo (grados, norte arriba) de cada brazo visto desde el centro
const angDe = (x, z) => (Math.atan2(-(z - GZ), x - GX) * 180) / Math.PI;
/** Número de salida (1.ª, 2.ª…) contando en el sentido de giro desde el brazo de entrada. */
export function numeroSalida(c, dIn, dOut) {
    const ent = ANG_BRAZO[OPUESTO[dIn]];
    const rel = o => { const a = (ANG_BRAZO[o] - ent + 360) % 360; return a === 0 ? 360 : a; };
    return c.salidas.slice().sort((a, b) => rel(a) - rel(b)).indexOf(dOut) + 1;
}

function construirMapa() {
    const aristas = {};
    for (let j = 0; j < N; j++) for (let i = 0; i < N - 1; i++) {
        const id = `h_${i}_${j}`;
        aristas[id] = { id, eje: 'x', i, j, a: `${i}_${j}`, b: `${i + 1}_${j}`, half: halfH(j), tipo: TIPO_H[j], sentido: SENTIDO_H[j] || 0, centro: j * S, ini: i * S + halfV(i), fin: (i + 1) * S - halfV(i + 1) };
    }
    for (let i = 0; i < N; i++) for (let j = 0; j < N - 1; j++) {
        const id = `v_${i}_${j}`;
        aristas[id] = { id, eje: 'z', i, j, a: `${i}_${j}`, b: `${i}_${j + 1}`, half: halfV(i), tipo: TIPO_V[i], sentido: SENTIDO_V[i] || 0, centro: i * S, ini: j * S + halfH(j), fin: (j + 1) * S - halfH(j + 1) };
    }
    Object.values(aristas).forEach(e => {
        if (e.a === GLORIETA) e.ini = (e.eje === 'x' ? GX : GZ) + R_EXT;
        if (e.b === GLORIETA) e.fin = (e.eje === 'x' ? GX : GZ) - R_EXT;
        e.residencial = e.id === RESIDENCIAL;
        e.colegio = e.id === COLEGIO;
        e.limite = e.residencial ? 20 : e.tipo === 'avenida' ? 50 : 30;
        e.carril = e.tipo === 'avenida' ? CARRIL * 1.5 : CARRIL * 0.5;
        e.zebra = ZEBRAS.has(e.id) ? (e.ini + e.fin) / 2 : null;
    });

    const cruces = {};
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const key = `${i}_${j}`;
        cruces[key] = { key, i, j, x: i * S, z: j * S, hx: halfV(i), hz: halfH(j), control: {}, prohibidos: PROHIBIDOS[key] || {}, semaforo: SEMAFOROS.has(key), glorieta: key === GLORIETA, offset: (i * 7 + j * 11) % 29 };
    }
    const mapa = { aristas, cruces };
    Object.values(cruces).forEach(c => {
        c.brazos = Object.keys(DIRS).filter(d => aristaDesde(mapa, c.key, d));
        c.salidas = c.brazos.filter(d => permite(aristaDesde(mapa, c.key, d), d));
        c.entradas = Object.keys(DIRS).filter(d => { const e = aristaDesde(mapa, c.key, OPUESTO[d]); return e && permite(e, d); });
        const borde = c.i === 0 || c.i === N - 1 || c.j === 0 || c.j === N - 1;
        c.entradas.forEach(d => {
            let ctrl = 'derecha';
            if (c.glorieta) ctrl = 'glorieta';
            else if (c.semaforo) ctrl = 'semaforo';
            else if (c.brazos.length === 2) ctrl = 'libre';
            else if (c.key === '2_3') ctrl = ejeDe(d) === 'z' ? 'prioridad' : 'stop';
            else if (c.key === '1_2') ctrl = ejeDe(d) === 'x' ? 'prioridad' : 'ceda';
            else if (c.key === '3_3') ctrl = ejeDe(d) === 'z' ? 'stop' : 'prioridad';
            else if (c.key === '1_3') ctrl = ejeDe(d) === 'x' ? 'ceda' : 'prioridad';
            else if (borde && c.brazos.length === 3) {
                // T en el borde: el brazo perpendicular al borde cede el paso
                const vertical = c.i === 0 || c.i === N - 1;
                ctrl = (vertical ? ejeDe(d) === 'x' : ejeDe(d) === 'z') ? 'ceda' : 'prioridad';
            }
            c.control[d] = ctrl;
        });
    });
    return mapa;
}

function aristaDesde(mapa, key, d) {
    const [i, j] = key.split('_').map(Number);
    const id = d === 'E' ? `h_${i}_${j}` : d === 'W' ? `h_${i - 1}_${j}` : d === 'S' ? `v_${i}_${j}` : `v_${i}_${j - 1}`;
    return mapa.aristas[id] || null;
}
function permite(e, d) { return !!e && ejeDe(d) === e.eje && (e.sentido === 0 || e.sentido === signoDe(d)); }
const finDe = (e, d) => (signoDe(d) > 0 ? e.b : e.a);
const alongIni = (e, d) => (signoDe(d) > 0 ? e.ini : e.fin);
const alongFin = (e, d) => (signoDe(d) > 0 ? e.fin : e.ini);
function puntoEn(e, d, along, lat) {
    const r = derechaDe(d);
    return e.eje === 'x' ? [along, e.centro + r[1] * lat] : [e.centro + r[0] * lat, along];
}

export const MAPA = construirMapa();

// Pista cerrada del permiso de moto (al oeste de la ciudad). Se recorre hacia el norte (−z).
export const PISTA = { x0: -290, x1: -230, z0: 70, z1: 212, xc: -260, salida: 202,
    slalom: [188, 182, 176, 170, 164], pasillo: [152, 136], ancho: 0.62, puerta: 112, linea: 99 };

/** Qué hay en el punto (x, z): cruce, calle (con arista), acera o edificio. */
export function clasificar(x, z) {
    if (x >= PISTA.x0 && x <= PISTA.x1 && z >= PISTA.z0 && z <= PISTA.z1) return { tipo: 'pista' };
    const gd = Math.hypot(x - GX, z - GZ);
    if (gd < R_ISLA) return { tipo: 'isleta' };
    if (gd <= R_EXT) return { tipo: 'cruce', key: GLORIETA };
    const i = clamp(Math.round(x / S), 0, N - 1), j = clamp(Math.round(z / S), 0, N - 1);
    const dx = x - i * S, dz = z - j * S, hv = halfV(i), hh = halfH(j);
    const enV = Math.abs(dx) <= hv && z >= Z_MIN && z <= Z_MAX;
    const enH = Math.abs(dz) <= hh && x >= X_MIN && x <= X_MAX;
    if (enV && enH) return { tipo: 'cruce', key: `${i}_${j}` };
    if (enV) return { tipo: 'calle', arista: `v_${i}_${clamp(Math.floor(z / S), 0, N - 2)}` };
    if (enH) return { tipo: 'calle', arista: `h_${clamp(Math.floor(x / S), 0, N - 2)}_${j}` };
    const dV = z >= Z_MIN - ACERA && z <= Z_MAX + ACERA ? Math.abs(dx) - hv : Infinity;
    const dH = x >= X_MIN - ACERA && x <= X_MAX + ACERA ? Math.abs(dz) - hh : Infinity;
    return { tipo: Math.min(dV, dH) <= ACERA || gd < R_EXT + ACERA ? 'acera' : 'edificio' };
}

// ─── Semáforos ───────────────────────────────────────────────────────────────
const T_VERDE = 10, T_AMBAR = 3, T_ROJO_TODOS = 1.5, CICLO = 2 * (T_VERDE + T_AMBAR + T_ROJO_TODOS);
export function luz(c, d, t) {
    let f = (((t + c.offset) % CICLO) + CICLO) % CICLO;
    if (ejeDe(d) === 'z') f = (f + CICLO / 2) % CICLO;
    if (f < T_VERDE) return { estado: 'verde', desde: f };
    if (f < T_VERDE + T_AMBAR) return { estado: 'ambar', desde: f - T_VERDE };
    return { estado: 'rojo', desde: f - T_VERDE - T_AMBAR };
}

// ─── Faltas (como en el examen práctico) ─────────────────────────────────────
export const FALTAS = {
    SEMAFORO_ROJO:     { gravedad: 'eliminatoria', texto: 'Saltarse un semáforo en rojo', explicacion: 'Con el semáforo en rojo hay que detenerse antes de la línea de detención y esperar al verde.' },
    STOP:              { gravedad: 'eliminatoria', texto: 'No detenerse en un STOP', explicacion: 'En un STOP hay que parar del todo (0 km/h) antes de la línea, aunque no venga nadie.' },
    CEDA:              { gravedad: 'eliminatoria', texto: 'No ceder el paso', explicacion: 'Con STOP o ceda el paso tienen prioridad los vehículos que circulan por la otra vía.' },
    DERECHA:           { gravedad: 'eliminatoria', texto: 'No ceder el paso a quien venía por la derecha', explicacion: 'En un cruce sin señalizar tienen prioridad los vehículos que se acercan por tu derecha.' },
    SENTIDO_CONTRARIO: { gravedad: 'eliminatoria', texto: 'Circular en sentido contrario', explicacion: 'Has entrado en una calle de sentido único por donde está la señal de entrada prohibida (R-101).' },
    GIRO_PROHIBIDO:    { gravedad: 'eliminatoria', texto: 'Girar donde está prohibido', explicacion: 'Antes del cruce había una señal de giro prohibido (R-302 o R-303).' },
    PEATON:            { gravedad: 'eliminatoria', texto: 'No ceder el paso a un peatón', explicacion: 'En un paso de cebra los peatones que cruzan o van a cruzar tienen prioridad: hay que detenerse.' },
    ATROPELLO:         { gravedad: 'eliminatoria', texto: 'Atropellar a un peatón', explicacion: 'Velocidad adecuada y atención: los peatones son los usuarios más vulnerables.' },
    COLISION:          { gravedad: 'eliminatoria', texto: 'Chocar con otro vehículo', explicacion: 'Mantén la distancia de seguridad y respeta las prioridades de paso.' },
    CALADO:            { gravedad: 'leve',         texto: 'Calar el motor', explicacion: 'Con cambio manual, reduce de marcha al frenar y pon 1.ª o punto muerto (N) antes de pararte. Para salir, usa siempre la 1.ª.' },
    MARCHA_INADECUADA: { gravedad: 'leve',         texto: 'Circular con una marcha inadecuada', explicacion: 'Si el motor va muy revolucionado, sube de marcha; si va forzado (casi calándose), reduce. Así se conduce de forma segura y eficiente.' },
    CHOQUE_OBJETO:     { gravedad: 'eliminatoria', texto: 'Chocar contra un obstáculo', explicacion: 'Controla la trayectoria y la velocidad, sobre todo al girar.' },
    VELOCIDAD_GRAVE:   { gravedad: 'eliminatoria', texto: 'Exceso de velocidad grave', explicacion: 'Has superado en más de 20 km/h el límite de la vía.' },
    VELOCIDAD:         { gravedad: 'deficiente',   texto: 'Exceso de velocidad', explicacion: 'Calles de un carril por sentido: 30 km/h. Dos o más carriles por sentido: 50 km/h. Plataforma única o calle residencial: 20 km/h.' },
    SEMAFORO_AMBAR:    { gravedad: 'deficiente',   texto: 'Pasar en ámbar pudiendo parar', explicacion: 'El ámbar fijo obliga a detenerse, salvo que no puedas hacerlo con seguridad.' },
    CARRIL_CONTRARIO:  { gravedad: 'deficiente',   texto: 'Invadir el carril contrario', explicacion: 'Circula por tu carril, a la derecha de la línea central.' },
    ACERA:             { gravedad: 'deficiente',   texto: 'Subirse a la acera', explicacion: 'La acera es de los peatones. Gira con más amplitud y menos velocidad.' },
    CINTURON:          { gravedad: 'deficiente',   texto: 'Iniciar la marcha sin cinturón', explicacion: 'El cinturón es obligatorio en todas las vías, también en ciudad. Abróchalo antes de arrancar.' },
    GLORIETA:          { gravedad: 'eliminatoria', texto: 'No ceder el paso al entrar en la glorieta', explicacion: 'En las glorietas tienen prioridad los vehículos que ya circulan por ella (llegan por tu izquierda).' },
    SENTIDO_GLORIETA:  { gravedad: 'eliminatoria', texto: 'Circular en sentido contrario en la glorieta', explicacion: 'Hay que rodear la isleta central por la derecha, en sentido contrario a las agujas del reloj.' },
    INTERMITENTE_GLORIETA: { gravedad: 'leve',     texto: 'Salir de la glorieta sin el intermitente derecho', explicacion: 'Antes de abandonar la glorieta hay que señalizar la salida con el intermitente derecho.' },
    CASCO:             { gravedad: 'deficiente',   texto: 'Iniciar la marcha sin el casco abrochado', explicacion: 'El casco es obligatorio para el conductor y el pasajero en todas las vías, también en ciudad.' },
    CONO:              { gravedad: 'deficiente',   texto: 'Derribar un cono', explicacion: 'En la pista hay que completar los ejercicios sin tocar los conos.' },
    SLALOM:            { gravedad: 'deficiente',   texto: 'Saltarse un cono del slalom', explicacion: 'Hay que rodear los conos alternando el lado: uno por la izquierda, el siguiente por la derecha.' },
    PASILLO_SALIR:     { gravedad: 'deficiente',   texto: 'Salirse del pasillo', explicacion: 'El pasillo estrecho se recorre en línea recta sin pisar las líneas ni tocar los conos.' },
    PASILLO_RAPIDO:    { gravedad: 'deficiente',   texto: 'Pasillo demasiado deprisa', explicacion: 'Es un ejercicio de control a muy poca velocidad: tarda al menos 7 segundos en recorrerlo.' },
    FRENADA_LENTA:     { gravedad: 'deficiente',   texto: 'No alcanzar la velocidad en la frenada', explicacion: 'Hay que llegar a la puerta de conos a 30 km/h o más y entonces frenar.' },
    FRENADA_LINEA:     { gravedad: 'eliminatoria', texto: 'No detenerse antes de la línea de frenado', explicacion: 'Usa los dos frenos a la vez, con la moto recta, para detenerte antes de la línea.' },
    INTERMITENTE:      { gravedad: 'leve',         texto: 'Girar sin poner el intermitente', explicacion: 'Señaliza los giros con antelación para que los demás sepan lo que vas a hacer.' },
    INTERMITENTE_MAL:  { gravedad: 'leve',         texto: 'Intermitente del lado equivocado', explicacion: 'El intermitente debe indicar el lado hacia el que vas a girar.' },
};

/** Resultado del examen: 1 eliminatoria, 2 deficientes, 10 leves o 1 deficiente + 5 leves = NO APTO. */
export function calificar(faltas) {
    const c = { eliminatoria: 0, deficiente: 0, leve: 0 };
    faltas.forEach(f => { c[f.gravedad] = (c[f.gravedad] || 0) + 1; });
    const noApto = c.eliminatoria >= 1 || c.deficiente >= 2 || c.leve >= 10 || (c.deficiente >= 1 && c.leve >= 5);
    return { ...c, apto: !noApto };
}

// ─── Ruta del examen ─────────────────────────────────────────────────────────
function generarRuta(arista, d, nCruces, rnd = Math.random) {
    const pasos = [];
    let e = arista, dir = d;
    for (let k = 0; k < nCruces; k++) {
        const key = finDe(e, dir), c = MAPA.cruces[key];
        const ops = c.glorieta ? c.salidas.filter(o => o !== OPUESTO[dir] || rnd() < 0.3) : c.salidas.filter(o => o !== OPUESTO[dir] && !(c.prohibidos[dir] || []).includes(tipoGiro(dir, o)));
        if (!ops.length) break;
        const giros = ops.filter(o => o !== dir);
        const o = giros.length && (rnd() < 0.65 || !ops.includes(dir)) ? giros[Math.floor(rnd() * giros.length)] : (ops.includes(dir) ? dir : ops[0]);
        pasos.push({ key, dIn: dir, dOut: o, giro: c.glorieta ? 'glorieta' : tipoGiro(dir, o), salida: c.glorieta ? numeroSalida(c, dir, o) : null, control: c.control[dir] });
        e = aristaDesde(MAPA, key, o); dir = o;
    }
    return { pasos, destino: { arista: e.id, d: dir, along: (e.ini + e.fin) / 2 } };
}

const TEXTO_GIRO = { derecha: 'gire a la derecha', izquierda: 'gire a la izquierda', recto: 'continúe recto' };
const ORDINAL = ['', 'primera', 'segunda', 'tercera', 'cuarta'];
const textoPaso = (p) => (p.giro === 'glorieta' ? `En la glorieta, tome la ${ORDINAL[p.salida]} salida` : `En el próximo cruce, ${TEXTO_GIRO[p.giro]}`);

// ═══════════════════════════ UTILIDADES 3D ══════════════════════════════════
export function rng(semilla) {
    let a = semilla >>> 0;
    return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function texturaCanvas(canvas, repetir = false) {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    if (repetir) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    return t;
}

export function ruido(x, w, h, base, variacion, n = 4000, tam = 2) {
    x.fillStyle = base; x.fillRect(0, 0, w, h);
    for (let k = 0; k < n; k++) {
        const v = Math.floor((Math.random() - 0.5) * variacion);
        x.fillStyle = v > 0 ? `rgba(255,255,255,${v / 255})` : `rgba(0,0,0,${-v / 255})`;
        x.fillRect(Math.random() * w, Math.random() * h, tam, tam);
    }
}

/** Fachada: una ventana con marco, alféizar y reflejo (1 celda = 3,2 × 3,1 m). */
export function texturaVentanas() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    ruido(x, 128, 128, '#f1ede6', 26, 1500, 2);
    x.fillStyle = 'rgba(0,0,0,0.08)'; x.fillRect(0, 122, 128, 6); // línea de forjado
    x.fillStyle = '#d8d2c6'; x.fillRect(30, 26, 68, 70);
    const g = x.createLinearGradient(34, 30, 94, 92);
    g.addColorStop(0, '#9fb7cf'); g.addColorStop(0.45, '#4b6077'); g.addColorStop(1, '#2d3b4b');
    x.fillStyle = g; x.fillRect(34, 30, 60, 62);
    x.fillStyle = 'rgba(255,255,255,0.28)'; x.beginPath(); x.moveTo(34, 30); x.lineTo(60, 30); x.lineTo(34, 62); x.fill();
    x.fillStyle = '#e6e0d4'; x.fillRect(62, 30, 4, 62); x.fillRect(34, 58, 60, 3);
    x.fillStyle = '#b9b1a3'; x.fillRect(26, 96, 76, 6); // alféizar
    x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(26, 102, 76, 3);
    return texturaCanvas(c, true);
}

/** Bajos comerciales: escaparates con toldo (1 celda = 6 × 3,6 m). */
export function texturaBajos() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 160;
    const x = c.getContext('2d');
    ruido(x, 256, 160, '#7c7368', 30, 1500, 2);
    const toldos = ['#c62828', '#1565c0', '#2e7d32', '#f9a825', '#6d4c41', '#00838f'];
    const col = toldos[Math.floor(Math.random() * toldos.length)];
    const g = x.createLinearGradient(0, 50, 0, 160);
    g.addColorStop(0, '#2f3f4f'); g.addColorStop(1, '#8aa1b5');
    x.fillStyle = g; x.fillRect(16, 52, 150, 108);
    x.fillStyle = 'rgba(255,240,200,0.35)'; x.fillRect(20, 60, 142, 30); // luz interior
    x.fillStyle = '#3e2f22'; x.fillRect(186, 58, 50, 102); // puerta
    x.fillStyle = '#9e8f7a'; x.fillRect(190, 62, 42, 92);
    x.fillStyle = col; x.fillRect(8, 14, 240, 28);
    for (let k = 0; k < 12; k++) { x.fillStyle = k % 2 ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0)'; x.fillRect(8 + k * 20, 14, 20, 28); }
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(8, 42, 240, 6);
    return texturaCanvas(c, true);
}

export function texturaAsfalto() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    ruido(x, 256, 256, '#4a4d52', 34, 14000, 2);
    for (let k = 0; k < 10; k++) { // manchas y parches
        x.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.06})`;
        x.beginPath(); x.ellipse(Math.random() * 256, Math.random() * 256, 10 + Math.random() * 40, 6 + Math.random() * 20, Math.random() * 3, 0, Math.PI * 2); x.fill();
    }
    const t = texturaCanvas(c, true);
    t.repeat.set(1 / 9, 1 / 9);
    return t;
}

export function texturaBaldosa() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    ruido(x, 128, 128, '#c3bdb1', 22, 2500, 2);
    x.strokeStyle = 'rgba(80,70,60,0.35)'; x.lineWidth = 2;
    for (let k = 0; k <= 128; k += 32) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k, 128); x.moveTo(0, k); x.lineTo(128, k); x.stroke(); }
    return texturaCanvas(c, true);
}

export function texturaTextoSuelo(texto) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#f2f2f2'; x.font = 'bold 120px Arial Narrow, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.save(); x.translate(128, 64); x.scale(1, 1.0); x.fillText(texto, 0, 6); x.restore();
    return texturaCanvas(c);
}

/** Cielo degradado (esfera con shader) */
export function crearCielo() {
    const mat = new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: { arriba: { value: new THREE.Color(0x3d7fcf) }, horizonte: { value: new THREE.Color(0xd4e6f2) } },
        vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'uniform vec3 arriba; uniform vec3 horizonte; varying vec3 vP; void main(){ float h = clamp(vP.y, 0.0, 1.0); gl_FragColor = vec4(mix(horizonte, arriba, pow(h, 0.55)), 1.0); }',
    });
    const m = new THREE.Mesh(new THREE.SphereGeometry(600, 24, 12), mat);
    m.renderOrder = -1;
    return m;
}

/** Geometría extruida a partir de un perfil lateral (x = longitudinal, delante = +x). */
export function perfil(pts, ancho, bisel = 0.05) {
    const s = new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b)));
    const g = new THREE.ExtrudeGeometry(s, { depth: ancho - 2 * bisel, bevelEnabled: true, bevelThickness: bisel, bevelSize: bisel, bevelSegments: 2, curveSegments: 4 });
    g.rotateY(Math.PI / 2);       // x → −z (delante), extrusión → +x
    g.translate(-(ancho - 2 * bisel) / 2, 0, 0);
    g.computeVertexNormals();
    return g;
}

export function geometriasCoche() {
    const cuerpo = perfil([[-2.12, 0.3], [2.1, 0.3], [2.16, 0.55], [2.1, 0.72], [1.95, 0.8], [0.95, 0.93], [-1.75, 0.96], [-2.08, 0.9], [-2.16, 0.6]], 1.78, 0.07);
    const cristal = perfil([[0.92, 0.92], [0.05, 1.38], [-1.05, 1.39], [-1.72, 0.95]], 1.56, 0.03);
    const techo = perfil([[0.1, 1.36], [-1.0, 1.37], [-1.0, 1.42], [0.08, 1.41]], 1.44, 0.02);
    const ruedas = [], llantas = [];
    [[-0.8, -1.35], [0.8, -1.35], [-0.8, 1.3], [0.8, 1.3]].forEach(([x, z]) => {
        const c = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 16); c.rotateZ(Math.PI / 2); c.translate(x, 0.33, z); ruedas.push(c);
        const l = new THREE.CylinderGeometry(0.19, 0.19, 0.25, 10); l.rotateZ(Math.PI / 2); l.translate(x * 1.01, 0.33, z); llantas.push(l);
    });
    const faro = (x, z, w = 0.36, h = 0.13) => { const b = new THREE.BoxGeometry(w, h, 0.06); b.translate(x, 0.68, z); return b; };
    return {
        cuerpo, cristal, techo,
        ruedas: mergeGeometries(ruedas), llantas: mergeGeometries(llantas),
        faros: mergeGeometries([faro(-0.6, -2.21), faro(0.6, -2.21)]),
        pilotos: mergeGeometries([faro(-0.62, 2.21, 0.34, 0.12), faro(0.62, 2.21, 0.34, 0.12)]),
        capo: perfil([[0.97, 0.55], [2.1, 0.55], [2.16, 0.6], [2.1, 0.72], [1.95, 0.8], [0.97, 0.9]], 1.78, 0.07),
        matricula: (() => { const b = new THREE.BoxGeometry(0.52, 0.12, 0.02); b.translate(0, 0.5, 2.24); return b; })(),
    };
}

const COLOR_LUZ = { rojo: ['#ff3b30', '#2a0b0b'], ambar: ['#ffb000', '#2a2008'], verde: ['#00e676', '#082a16'] };
function texturaSemaforo(estado) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 352;
    const x = c.getContext('2d');
    x.fillStyle = '#0d0d0d'; x.fillRect(0, 0, 128, 352);
    ['rojo', 'ambar', 'verde'].forEach((k, i) => {
        const cy = 60 + i * 116, [on, off] = COLOR_LUZ[k];
        x.beginPath(); x.arc(64, cy, 52, 0, Math.PI * 2); x.fillStyle = '#000'; x.fill();
        if (estado === k) {
            const g = x.createRadialGradient(64, cy, 2, 64, cy, 50);
            g.addColorStop(0, '#ffffff'); g.addColorStop(0.25, on); g.addColorStop(1, on);
            x.fillStyle = g;
        } else x.fillStyle = off;
        x.beginPath(); x.arc(64, cy, 47, 0, Math.PI * 2); x.fill();
        if (estado !== k) { x.fillStyle = 'rgba(255,255,255,0.06)'; x.beginPath(); x.arc(52, cy - 14, 16, 0, Math.PI * 2); x.fill(); }
    });
    return texturaCanvas(c);
}

/** Halo de luz (sprite aditivo) para ver de lejos qué lámpara está encendida. */
function texturaHalo() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, 'rgba(255,255,255,0.75)'); g.addColorStop(0.5, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return texturaCanvas(c);
}

function texturaRotulo(textoRotulo, fondo = '#1b5e20') {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = fondo; x.fillRect(0, 0, 512, 128);
    x.fillStyle = '#fff'; x.font = 'bold 72px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(textoRotulo, 256, 68);
    return texturaCanvas(c);
}

/** Caja con UV escaladas a metros (para que las ventanas tengan siempre el mismo tamaño). */
function cajaEdificio(w, h, d, color) {
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv;
    // Orden de caras de BoxGeometry: px, nx, py, ny, pz, nz (4 vértices cada una)
    const escalas = [[d / 3.2, h / 3.1], [d / 3.2, h / 3.1], null, null, [w / 3.2, h / 3.1], [w / 3.2, h / 3.1]];
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
        const idx = f * 4 + k;
        if (!escalas[f]) uv.setXY(idx, 0.03, 0.03); // tejado liso
        else uv.setXY(idx, uv.getX(idx) * escalas[f][0], uv.getY(idx) * escalas[f][1]);
    }
    const col = new THREE.Color(color), roof = new THREE.Color(0x8d8f93);
    const colores = new Float32Array(24 * 3);
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
        const cc = f === 2 || f === 3 ? roof : col;
        colores.set([cc.r, cc.g, cc.b], (f * 4 + k) * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colores, 3));
    return g;
}

export const COLORES_COCHE = [0xc62828, 0x1565c0, 0xf9a825, 0xeeeeee, 0x37474f, 0x2e7d32, 0x6a1b9a, 0xef6c00, 0x90a4ae, 0x212121];

export function crearCoche(color, mats, sombras = true) {
    const g = new THREE.Group();
    const G = mats.geoCoche;
    const pintura = mats.colorCoche(color);
    const cuerpo = new THREE.Mesh(G.cuerpo, pintura); g.add(cuerpo);
    const cabina = new THREE.Group(); g.add(cabina);
    cabina.add(new THREE.Mesh(G.cristal, mats.cristal), new THREE.Mesh(G.techo, pintura));
    g.add(new THREE.Mesh(G.ruedas, mats.rueda), new THREE.Mesh(G.llantas, mats.llanta));
    const faros = new THREE.Mesh(G.faros, mats.faro);
    g.add(faros, new THREE.Mesh(G.matricula, mats.matricula));
    const detras = new THREE.Mesh(G.pilotos, mats.piloto); g.add(detras);
    if (sombras) g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.userData = { cuerpo, cabina, detras, faros };
    return g;
}

/** Moto naked con su piloto (delante = −z). cabina = piloto (se oculta en la vista desde el casco). */
export function crearMoto(mats) {
    const g = new THREE.Group();
    const pintura = mats.colorCoche(0xc62828), oscuro = new THREE.MeshLambertMaterial({ color: 0x2b2e33 });
    const cuerpo = new THREE.Group(); g.add(cuerpo);
    const palo = (p0, p1, r, mat) => {
        const a = new THREE.Vector3(...p0), b = new THREE.Vector3(...p1);
        const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 8), mat);
        m.position.copy(a).add(b).multiplyScalar(0.5);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
        return m;
    };
    [-0.72, 0.72].forEach(z => {
        const rueda = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.075, 10, 26), mats.rueda); rueda.rotation.y = Math.PI / 2; rueda.position.set(0, 0.335, z); cuerpo.add(rueda);
        const llanta = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 16), mats.llanta); llanta.rotation.z = Math.PI / 2; llanta.position.set(0, 0.335, z); cuerpo.add(llanta);
    });
    cuerpo.add(new THREE.Mesh(perfil([[-0.8, 0.66], [-0.3, 0.6], [0.3, 0.62], [0.58, 0.8], [0.52, 1.0], [0.2, 1.04], [-0.1, 0.92], [-0.8, 0.88]], 0.36, 0.04), pintura));
    cuerpo.add(new THREE.Mesh(perfil([[-0.86, 0.88], [-0.1, 0.92], [-0.05, 0.98], [-0.86, 0.96]], 0.3, 0.03), mats.rueda)); // asiento
    const motor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.5), oscuro); motor.position.set(0, 0.5, -0.05); cuerpo.add(motor);
    [-1, 1].forEach(s => cuerpo.add(palo([s * 0.09, 0.335, -0.72], [s * 0.09, 1.05, -0.5], 0.03, mats.llanta))); // horquilla
    cuerpo.add(palo([0, 0.335, 0.72], [0, 0.62, 0.0], 0.035, oscuro)); // basculante
    cuerpo.add(palo([0.16, 0.38, 0.1], [0.18, 0.62, 0.78], 0.05, mats.llanta)); // escape
    const faros = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.07, 14), mats.faro); faros.rotation.x = Math.PI / 2; faros.position.set(0, 0.98, -0.66); g.add(faros);
    const detras = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.04), mats.piloto); detras.position.set(0, 0.92, 0.88); g.add(detras);
    const mat = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.02), mats.matricula); mat.position.set(0, 0.78, 0.9); cuerpo.add(mat);
    // piloto
    const piloto = new THREE.Group(); g.add(piloto);
    const chaqueta = new THREE.MeshLambertMaterial({ color: 0x263238 }), pantalon = new THREE.MeshLambertMaterial({ color: 0x37474f });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.58, 0.26), chaqueta); torso.position.set(0, 1.3, 0.02); torso.rotation.x = -0.4; piloto.add(torso);
    const casco = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), mats.colorCoche(0xf5f5f5)); casco.position.set(0, 1.68, -0.12); piloto.add(casco);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.06), mats.cristal); visor.position.set(0, 1.69, -0.26); piloto.add(visor);
    [-1, 1].forEach(s => {
        piloto.add(palo([s * 0.2, 1.5, -0.08], [s * 0.31, 1.1, -0.5], 0.05, chaqueta));   // brazo
        piloto.add(palo([s * 0.14, 0.98, 0.1], [s * 0.21, 0.85, -0.28], 0.07, pantalon)); // muslo
        piloto.add(palo([s * 0.21, 0.85, -0.28], [s * 0.22, 0.42, -0.08], 0.055, pantalon)); // pierna
    });
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.userData = { cuerpo, cabina: piloto, detras, faros };
    return g;
}

function crearPersona(r, mats) {
    const g = new THREE.Group();
    const camiseta = mats.ropa(Math.floor(r() * 8)), pantalon = mats.pantalon(Math.floor(r() * 4));
    const torso = new THREE.Mesh(mats.geoTorso, camiseta); torso.position.y = 1.17; g.add(torso);
    const cabeza = new THREE.Mesh(mats.geoCabeza, mats.piel(Math.floor(r() * 4))); cabeza.position.y = 1.6; g.add(cabeza);
    const piernas = [-0.11, 0.11].map(x => {
        const p = new THREE.Group(); p.position.set(x, 0.86, 0);
        const m = new THREE.Mesh(mats.geoPierna, pantalon); m.position.y = -0.43; p.add(m);
        g.add(p); return p;
    });
    const esc = 0.85 + r() * 0.25;
    g.scale.setScalar(esc);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.userData = { piernas, fase: r() * 6 };
    return g;
}

function solapan(a, b) {
    const dx = b.x - a.x, dz = b.z - a.z;
    const ejes = [[a.fx, a.fz], [a.rx, a.rz], [b.fx, b.fz], [b.rx, b.rz]];
    for (const [ax, az] of ejes) {
        const ra = a.hl * Math.abs(a.fx * ax + a.fz * az) + a.hw * Math.abs(a.rx * ax + a.rz * az);
        const rb = b.hl * Math.abs(b.fx * ax + b.fz * az) + b.hw * Math.abs(b.rx * ax + b.rz * az);
        if (Math.abs(dx * ax + dz * az) > ra + rb) return false;
    }
    return true;
}
function caja(x, z, yaw, hl = 2.15, hw = 0.92) {
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    return { x, z, fx, fz, rx: -fz, rz: fx, hl, hw };
}
const yawDe = (tx, tz) => Math.atan2(-tx, -tz);

// ═══════════════════════════════ MOTOR ══════════════════════════════════════
// Cambio manual: velocidades (km/h) de cada marcha. min = por debajo se cala; baja = por debajo va
// forzado; max = corte de inyección. fuerza = empuje relativo (las cortas empujan más).
export const MARCHAS = ['R', 'N', '1', '2', '3', '4', '5'];
const TABLA_MARCHAS = {
    1: { min: 0, baja: 0, max: 28, fuerza: 1.25, freno: 1.0 },
    2: { min: 3, baja: 11, max: 48, fuerza: 0.95, freno: 0.7 },
    3: { min: 12, baja: 22, max: 70, fuerza: 0.72, freno: 0.5 },
    4: { min: 20, baja: 33, max: 95, fuerza: 0.55, freno: 0.36 },
    5: { min: 28, baja: 43, max: 130, fuerza: 0.42, freno: 0.26 },
};

export function crearMotor(contenedor, opciones = {}, cb = {}) {
    const op = { modo: 'libre', trafico: 'normal', peatones: true, camara: 'cabina', ...opciones };
    const esMovil = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    const aLimpiar = [];
    const r = rng(20261119);

    // ── Renderer, escena y cámara ──
    const renderer = new THREE.WebGLRenderer({ antialias: !esMovil, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, esMovil ? 1.5 : 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local');
    const ancho = () => contenedor.clientWidth || window.innerWidth, alto = () => contenedor.clientHeight || window.innerHeight;
    renderer.setSize(ancho(), alto());
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    contenedor.appendChild(renderer.domElement);
    const estereo = new StereoEffect(renderer);
    estereo.setEyeSeparation(0.064);

    const escena = new THREE.Scene();
    const HORIZONTE = 0xd4e6f2;
    escena.background = new THREE.Color(HORIZONTE);
    escena.fog = new THREE.Fog(HORIZONTE, 110, 360);
    const cielo = crearCielo(); escena.add(cielo);
    const camara = new THREE.PerspectiveCamera(63, ancho() / alto(), 0.05, 800);
    escena.add(new THREE.HemisphereLight(0xdfefff, 0x6e6a5c, 1.25));
    const sol = new THREE.DirectionalLight(0xfff1d6, 2.8);
    sol.castShadow = true;
    sol.shadow.mapSize.set(esMovil ? 1024 : 2048, esMovil ? 1024 : 2048);
    Object.assign(sol.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 10, far: 320 });
    sol.shadow.bias = -0.0004; sol.shadow.normalBias = 0.04;
    const OFFSET_SOL = new THREE.Vector3(70, 120, 45);
    escena.add(sol, sol.target);

    // ── Materiales y geometrías compartidas ──
    const lambert = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
    const estandar = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, ...extra });
    const cacheColor = new Map();
    const cacheRopa = [0xe53935, 0x1e88e5, 0x43a047, 0xfdd835, 0x8e24aa, 0xff7043, 0x26c6da, 0xf5f5f5].map(c => lambert(c));
    const cachePantalon = [0x263238, 0x3949ab, 0x5d4037, 0x616161].map(c => lambert(c));
    const cachePiel = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524].map(c => lambert(c));
    const mats = {
        geoCoche: geometriasCoche(),
        cristal: estandar(0x1d2732, { metalness: 0.6, roughness: 0.15 }),
        rueda: lambert(0x141414),
        llanta: estandar(0xb8bcc2, { metalness: 0.8, roughness: 0.35 }),
        matricula: lambert(0xf5f5f5),
        faro: new THREE.MeshBasicMaterial({ color: 0xfff8e1 }),
        piloto: lambert(0x7a0d0d, { emissive: 0x3a0000 }),
        colorCoche: (c) => { if (!cacheColor.has(c)) cacheColor.set(c, estandar(c, { metalness: 0.35, roughness: 0.38 })); return cacheColor.get(c); },
        geoTorso: new THREE.BoxGeometry(0.44, 0.6, 0.26),
        geoCabeza: new THREE.SphereGeometry(0.13, 12, 10),
        geoPierna: new THREE.BoxGeometry(0.15, 0.86, 0.17),
        ropa: i => cacheRopa[i], pantalon: i => cachePantalon[i], piel: i => cachePiel[i],
    };

    // UV en coordenadas del mundo (texturas que no se estiran)
    const uvMundo = (g, esc) => {
        const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
        for (let k = 0; k < p.count; k++) {
            const nx = Math.abs(n.getX(k)), ny = Math.abs(n.getY(k));
            const [u, v] = ny > 0.5 ? [p.getX(k), p.getZ(k)] : nx > 0.5 ? [p.getZ(k), p.getY(k)] : [p.getX(k), p.getY(k)];
            uv.setXY(k, u / esc, v / esc);
        }
        return g;
    };
    const cajaEn = (x0, x1, y0, y1, z0, z1) => { const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return g; };
    /** Caja con UV escaladas (su × sv celdas por metro) y color por vértice; tejado liso. */
    const cajaCeldas = (w, h, d, celdaW, celdaH, color, colorTecho = 0x8d8f93) => {
        const g = new THREE.BoxGeometry(w, h, d);
        const uv = g.attributes.uv;
        const esc = [[d / celdaW, h / celdaH], [d / celdaW, h / celdaH], null, null, [w / celdaW, h / celdaH], [w / celdaW, h / celdaH]];
        const col = new THREE.Color(color), tc = new THREE.Color(colorTecho), colores = new Float32Array(72);
        for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
            const i = f * 4 + k;
            if (!esc[f]) uv.setXY(i, 0.02, 0.02); else uv.setXY(i, uv.getX(i) * esc[f][0], uv.getY(i) * esc[f][1]);
            const c = esc[f] ? col : tc; colores.set([c.r, c.g, c.b], i * 3);
        }
        g.setAttribute('color', new THREE.BufferAttribute(colores, 3));
        return g;
    };

    // ═══════════════ CIUDAD ═══════════════
    const ciudad = new THREE.Group(); escena.add(ciudad);
    const cx = ((N - 1) * S) / 2;
    {
        const cesped = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), lambert(0x6f9a4e));
        cesped.rotation.x = -Math.PI / 2; cesped.position.set(cx, -0.4, cx); ciudad.add(cesped);
        const geo = new THREE.PlaneGeometry(X_MAX - X_MIN + 8, Z_MAX - Z_MIN + 8);
        geo.rotateX(-Math.PI / 2); geo.translate(cx, 0, cx); uvMundo(geo, 1);
        const asfalto = new THREE.Mesh(geo, lambert(0xffffff, { map: texturaAsfalto() }));
        asfalto.receiveShadow = true; ciudad.add(asfalto);
    }

    // Bloques: acera + edificios / parque / colegio
    const geosEdificios = [], geosBajos = [], geosAcera = [], geosHierba = [], arboles = [], farolas = [], caminantesRutas = [];
    const COLORES_FACHADA = [0xf4e3c1, 0xe8c4a0, 0xd9d4cc, 0xc7d6df, 0xe6b8a2, 0xf0efe8, 0xcfc1a5, 0xb9c9b0, 0xd7a98c, 0xe9dcc9];
    const BAJOS = 3.6;
    function edificio(x, z, w, d, h, color, conBajos) {
        const g = cajaCeldas(w, h - (conBajos ? BAJOS : 0), d, 3.2, 3.1, color);
        g.translate(x, (conBajos ? BAJOS : 0) + (h - (conBajos ? BAJOS : 0)) / 2, z);
        geosEdificios.push(g);
        if (conBajos) { const b = cajaCeldas(w + 0.2, BAJOS, d + 0.2, 6, BAJOS, 0xffffff, 0x777777); b.translate(x, BAJOS / 2, z); geosBajos.push(b); }
        // cornisa
        const c = cajaCeldas(w + 0.5, 0.45, d + 0.5, 100, 100, 0xa59d90, 0x77736c); c.translate(x, h + 0.2, z); geosBajos.push(c);
    }
    const matBaldosa = lambert(0xffffff, { map: texturaBaldosa() });
    const distRect = (x0, x1, z0, z1) => Math.hypot(Math.max(x0 - GX, 0, GX - x1), Math.max(z0 - GZ, 0, GZ - z1));
    const RECORTE = R_EXT + ACERA;
    /** Losa de acera con la esquina cortada por la glorieta (arco de radio R_EXT). */
    function losaRecortada(x0, x1, z0, z1) {
        const esq = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
        let k = 0; esq.forEach((p, i) => { if (Math.hypot(p[0] - GX, p[1] - GZ) < Math.hypot(esq[k][0] - GX, esq[k][1] - GZ)) k = i; });
        const corte = (p, q) => { // punto de pq a distancia R_EXT del centro (p dentro, q fuera)
            let a = 0, b = 1;
            for (let it = 0; it < 30; it++) { const m = (a + b) / 2, x = p[0] + (q[0] - p[0]) * m, z = p[1] + (q[1] - p[1]) * m; if (Math.hypot(x - GX, z - GZ) < R_EXT) a = m; else b = m; }
            return [p[0] + (q[0] - p[0]) * a, p[1] + (q[1] - p[1]) * a];
        };
        const prev = esq[(k + 3) % 4], sig = esq[(k + 1) % 4];
        const pa = corte(esq[k], prev), pb = corte(esq[k], sig);
        let a0 = Math.atan2(pa[1] - GZ, pa[0] - GX), a1 = Math.atan2(pb[1] - GZ, pb[0] - GX);
        let da = a1 - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
        // orden: sig → (resto) → prev → pa → arco → pb
        const orden = [sig, esq[(k + 2) % 4], prev, pa];
        for (let i = 1; i < 16; i++) { const a = a0 + (da * i) / 16; orden.push([GX + R_EXT * Math.cos(a), GZ + R_EXT * Math.sin(a)]); }
        orden.push(pb);
        const forma = new THREE.Shape(orden.map(([x, z]) => new THREE.Vector2(x, z)));
        const g = new THREE.ExtrudeGeometry(forma, { depth: 0.15, bevelEnabled: false });
        g.rotateX(Math.PI / 2); g.translate(0, 0.15, 0);
        uvMundo(g, 1.6);
        const m = new THREE.Mesh(g, matBaldosa); m.receiveShadow = true; ciudad.add(m);
    }
    function bloque(x0, x1, z0, z1, tipo = 'edificios', exterior = false) {
        const recortado = distRect(x0, x1, z0, z1) < R_EXT;
        if (recortado) losaRecortada(x0, x1, z0, z1);
        else geosAcera.push(uvMundo(cajaEn(x0, x1, 0, 0.15, z0, z1), 1.6));
        const lejos = (x, z, m) => Math.hypot(x - GX, z - GZ) > RECORTE + m;
        const ix0 = x0 + ACERA, ix1 = x1 - ACERA, iz0 = z0 + ACERA, iz1 = z1 - ACERA;
        if (!exterior) {
            // árboles junto al bordillo, cada ~12 m, lejos de las esquinas; farolas cada ~24 m
            const lados = [[x0, z0, x0, z1, 1, 0], [x1, z0, x1, z1, -1, 0], [x0, z0, x1, z0, 0, 1], [x0, z1, x1, z1, 0, -1]];
            lados.forEach(([ax, az, bx, bz, nx, nz]) => {
                const L = Math.hypot(bx - ax, bz - az);
                for (let s = 9; s < L - 9; s += 12) {
                    if (r() < 0.25) continue;
                    const tx = ax + ((bx - ax) * s) / L + nx * 2.3, tz = az + ((bz - az) * s) / L + nz * 2.3;
                    if (lejos(tx, tz, -1.5)) arboles.push([tx, tz, 0.8 + r() * 0.5]);
                }
                for (let s = 15; s < L - 12; s += 24) { const fx = ax + ((bx - ax) * s) / L + nx * 0.45, fz = az + ((bz - az) * s) / L + nz * 0.45; if (lejos(fx, fz, -1)) farolas.push([fx, fz, Math.atan2(nx, nz)]); }
            });
            if (!recortado) caminantesRutas.push([x0 + 1.4, x1 - 1.4, z0 + 1.4, z1 - 1.4]);
        }
        if (tipo === 'parque') {
            geosHierba.push(uvMundo(cajaEn(ix0, ix1, 0, 0.22, iz0, iz1), 4));
            for (let k = 0; k < 16; k++) arboles.push([ix0 + 3 + r() * (ix1 - ix0 - 6), iz0 + 3 + r() * (iz1 - iz0 - 6), 1 + r() * 0.7]);
            return;
        }
        if (tipo === 'colegio') {
            const w = ix1 - ix0 - 10;
            const ged = cajaCeldas(w, 7.5, 16, 3.2, 3.1, 0xd98c5f);
            ged.translate((ix0 + ix1) / 2 + 5, 3.75, (iz0 + iz1) / 2);
            geosEdificios.push(ged);
            const patio = new THREE.Mesh(uvMundo(cajaEn(ix0, ix0 + 9, 0, 0.18, iz0, iz1), 3), lambert(0xc8a46b)); patio.receiveShadow = true; ciudad.add(patio);
            const valla = new THREE.Mesh(cajaEn(ix0 - 0.05, ix0 + 0.05, 0.15, 1.4, iz0, iz1), lambert(0x2e7d32, { transparent: true, opacity: 0.55 })); ciudad.add(valla);
            const rot = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.75), new THREE.MeshBasicMaterial({ map: texturaRotulo('COLEGIO', '#b23c17') }));
            rot.position.set(ix0 + 9.9, 5.8, (iz0 + iz1) / 2); rot.rotation.y = -Math.PI / 2; ciudad.add(rot);
            return;
        }
        const nx = Math.max(1, Math.round((ix1 - ix0) / 17)), nz = Math.max(1, Math.round((iz1 - iz0) / 17));
        const lw = (ix1 - ix0) / nx, ld = (iz1 - iz0) / nz;
        for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) {
            const h = exterior ? 10 + r() * 16 : 10 + r() * 24;
            if (recortado && distRect(ix0 + lw * a, ix0 + lw * (a + 1), iz0 + ld * b, iz0 + ld * (b + 1)) < RECORTE + 1) {
                // en la esquina de la glorieta: plaza con árboles en vez de edificio
                for (let t = 0; t < 3; t++) { const tx = ix0 + lw * (a + 0.2 + r() * 0.6), tz = iz0 + ld * (b + 0.2 + r() * 0.6); if (lejos(tx, tz, 1.5)) arboles.push([tx, tz, 0.9 + r() * 0.5]); }
                continue;
            }
            edificio(ix0 + lw * (a + 0.5), iz0 + ld * (b + 0.5), lw - 0.4, ld - 0.4, Math.round(h / 3.1) * 3.1 + BAJOS * 0.2, COLORES_FACHADA[Math.floor(r() * COLORES_FACHADA.length)], true);
        }
    }
    for (let bi = 0; bi < N - 1; bi++) for (let bj = 0; bj < N - 1; bj++) {
        const tipo = bi === 3 && bj === 2 ? 'colegio' : (bi === 0 && bj === 3) ? 'parque' : 'edificios';
        bloque(bi * S + halfV(bi), (bi + 1) * S - halfV(bi + 1), bj * S + halfH(bj), (bj + 1) * S - halfH(bj + 1), tipo);
    }
    const F = 27;
    {
        const bord = new THREE.Mesh(new THREE.CylinderGeometry(R_ISLA, R_ISLA, 0.25, 56), lambert(0xc9c4b8)); bord.position.set(GX, 0.125, GZ); bord.receiveShadow = true; ciudad.add(bord);
        const cesp = new THREE.Mesh(new THREE.CylinderGeometry(R_ISLA - 0.4, R_ISLA - 0.4, 0.3, 56), lambert(0x5f9d43)); cesp.position.set(GX, 0.15, GZ); cesp.receiveShadow = true; ciudad.add(cesp);
        const base = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.7, 1.2, 8), lambert(0xb0a99a)); base.position.set(GX, 0.9, GZ); ciudad.add(base);
        const pilar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 4.5, 8), lambert(0xd8d0bf)); pilar.position.set(GX, 3.6, GZ); pilar.castShadow = true; ciudad.add(pilar);
        const bola = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 12), new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.8, roughness: 0.3 })); bola.position.set(GX, 6.3, GZ); bola.castShadow = true; ciudad.add(bola);
        [45, 165, 285].forEach(a => { const rr = (a * Math.PI) / 180; arboles.push([GX + Math.cos(rr) * 3.7, GZ + Math.sin(rr) * 3.7, 0.75]); });
    }
    bloque(X_MIN - F, X_MIN, Z_MIN - F, Z_MAX + F, 'edificios', true);
    bloque(X_MAX, X_MAX + F, Z_MIN - F, Z_MAX + F, 'edificios', true);
    bloque(X_MIN, X_MAX, Z_MIN - F, Z_MIN, 'edificios', true);
    bloque(X_MIN, X_MAX, Z_MAX, Z_MAX + F, 'edificios', true);
    {
        const fusion = (lista, mat, sombra = true) => {
            const geo = mergeGeometries(lista); lista.forEach(g => g.dispose());
            const m = new THREE.Mesh(geo, mat); m.castShadow = sombra; m.receiveShadow = true; ciudad.add(m); return m;
        };
        fusion(geosEdificios, new THREE.MeshLambertMaterial({ map: texturaVentanas(), vertexColors: true }));
        fusion(geosBajos, new THREE.MeshLambertMaterial({ map: texturaBajos(), vertexColors: true }));
        fusion(geosAcera, matBaldosa, false);
        if (geosHierba.length) fusion(geosHierba, lambert(0x5f9d43), false);
    }
    {
        const n = arboles.length;
        const tronco = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.11, 0.17, 2.6, 6), lambert(0x6d4c41), n);
        const copaA = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.45, 1), lambert(0xffffff, { flatShading: true }), n);
        const copaB = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.0, 1), lambert(0xffffff, { flatShading: true }), n);
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color(), eu = new THREE.Euler();
        arboles.forEach(([x, z, s], k) => {
            m.compose(v.set(x, 1.4, z), q.identity(), sc.set(1, s, 1)); tronco.setMatrixAt(k, m);
            q.setFromEuler(eu.set(0, r() * 6, 0));
            m.compose(v.set(x, 2.5 + 1.5 * s, z), q, sc.set(s, s * 1.1, s)); copaA.setMatrixAt(k, m);
            m.compose(v.set(x + 0.5 * s, 3.4 + 1.6 * s, z - 0.3 * s), q, sc.set(s, s, s)); copaB.setMatrixAt(k, m);
            col.setHSL(0.27 + r() * 0.07, 0.45 + r() * 0.15, 0.27 + r() * 0.08);
            copaA.setColorAt(k, col); copaB.setColorAt(k, col.offsetHSL(0, 0, 0.05));
        });
        [tronco, copaA, copaB].forEach(o => { o.castShadow = true; });
        ciudad.add(tronco, copaA, copaB);
        // farolas
        const nf = farolas.length;
        const poste = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.09, 6.2, 6), lambert(0x3c4248), nf);
        const brazo = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.08, 1.5), lambert(0x3c4248), nf);
        const lamp = new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, 0.12, 0.6), lambert(0xeeeeee, { emissive: 0x555555 }), nf);
        farolas.forEach(([x, z, rot], k) => {
            q.setFromEuler(eu.set(0, rot, 0));
            const fx = -Math.sin(rot), fz = -Math.cos(rot);
            m.compose(v.set(x, 3.1, z), q, sc.set(1, 1, 1)); poste.setMatrixAt(k, m);
            m.compose(v.set(x + fx * 0.7, 6.1, z + fz * 0.7), q, sc.set(1, 1, 1)); brazo.setMatrixAt(k, m);
            m.compose(v.set(x + fx * 1.35, 6.0, z + fz * 1.35), q, sc.set(1, 1, 1)); lamp.setMatrixAt(k, m);
        });
        poste.castShadow = true;
        ciudad.add(poste, brazo, lamp);
    }

    // ── Marcas viales (instanciadas, todas alineadas con los ejes) ──
    const marcas = [];
    const marca = (e, a0, a1, l0, l1) => {
        const lo = Math.min(l0, l1), hi = Math.max(l0, l1), al = Math.min(a0, a1), ah = Math.max(a0, a1);
        if (e.eje === 'x') marcas.push([(al + ah) / 2, e.centro + (lo + hi) / 2, ah - al, hi - lo]);
        else marcas.push([e.centro + (lo + hi) / 2, (al + ah) / 2, hi - lo, ah - al]);
    };
    const discontinua = (e, lat, ancho, trazo, hueco, margen) => {
        for (let a = e.ini + margen; a < e.fin - margen - trazo; a += trazo + hueco) marca(e, a, a + trazo, lat - ancho / 2, lat + ancho / 2);
    };
    const residenciales = [], textosSuelo = [];
    Object.values(MAPA.aristas).forEach(e => {
        if (e.residencial) { residenciales.push(e); return; }
        if (e.tipo === 'avenida') {
            marca(e, e.ini, e.fin, -0.27, -0.15); marca(e, e.ini, e.fin, 0.15, 0.27);
            [-CARRIL, CARRIL].forEach(l => { discontinua(e, l, 0.14, 3, 4.5, 10); marca(e, e.ini, e.ini + 9, l - 0.07, l + 0.07); marca(e, e.fin - 9, e.fin, l - 0.07, l + 0.07); });
        } else if (e.sentido === 0) {
            discontinua(e, 0, 0.13, 3, 3, 8);
            marca(e, e.ini, e.ini + 8, -0.065, 0.065); marca(e, e.fin - 8, e.fin, -0.065, 0.065);
        } else {
            discontinua(e, 0, 0.12, 1.5, 1.5, 3);
        }
        if (e.zebra != null) for (let l = -e.half + 0.55; l < e.half - 0.3; l += 1.0) marca(e, e.zebra - 1.5, e.zebra + 1.5, l - 0.25, l + 0.25);
        // líneas de detención / ceda al final de cada sentido
        ['E', 'W', 'S', 'N'].filter(d => permite(e, d)).forEach(d => {
            const c = MAPA.cruces[finDe(e, d)], ctrl = c.control[d], sg = signoDe(d);
            const af = alongFin(e, d), r0 = e.sentido === 0 ? 0 : -e.half;
            const lado = (l0, l1) => { const rr = derechaDe(d), k = e.eje === 'x' ? rr[1] : rr[0]; return [l0 * k, l1 * k]; };
            if (ctrl === 'stop' || ctrl === 'semaforo') { const [l0, l1] = lado(r0, e.half); marca(e, af - sg * 0.9, af - sg * 0.4, l0, l1); }
            if (ctrl === 'stop') { const [x, z] = puntoEn(e, d, af - sg * 4.2, e.sentido === 0 ? e.half / 2 : 0); textosSuelo.push(['STOP', x, z, yawDe(...DIRS[d])]); }
            else if (ctrl === 'ceda' || ctrl === 'glorieta') { for (let l = r0 + 0.2; l < e.half - 0.3; l += 1.0) { const [l0, l1] = lado(l, l + 0.55); marca(e, af - sg * 0.8, af - sg * 0.45, l0, l1); } }
        });
    });
    {
        const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
        const im = new THREE.InstancedMesh(geo, lambert(0xe9e9e4), marcas.length);
        im.receiveShadow = true;
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
        marcas.forEach(([x, z, sx, sz], k) => { m.compose(v.set(x, 0.02, z), q, sc.set(sx, 1, sz)); im.setMatrixAt(k, m); });
        ciudad.add(im);
        const texStop = texturaTextoSuelo('STOP');
        const geoT = new THREE.PlaneGeometry(1.7, 2.8); geoT.rotateX(-Math.PI / 2);
        textosSuelo.forEach(([, x, z, rot]) => {
            const t = new THREE.Mesh(geoT, lambert(0xffffff, { map: texStop, transparent: true, depthWrite: false }));
            t.position.set(x, 0.025, z); t.rotation.y = rot; t.receiveShadow = true; ciudad.add(t);
        });
        residenciales.forEach(e => {
            const L = e.fin - e.ini, W = e.half * 2;
            const p = new THREE.Mesh(new THREE.PlaneGeometry(e.eje === 'x' ? L : W, e.eje === 'x' ? W : L), lambert(0xc4a47c));
            p.rotation.x = -Math.PI / 2;
            p.position.set(e.eje === 'x' ? (e.ini + e.fin) / 2 : e.centro, 0.012, e.eje === 'x' ? e.centro : (e.ini + e.fin) / 2);
            ciudad.add(p);
        });
    }

    // ── Señales verticales (instanciadas por tipo) ──
    const senales = []; // [id, x, z, rotY]
    const ponerSenal = (id, e, d, along, lat, alto = 2.3) => {
        const [x, z] = puntoEn(e, d, along, lat), [dx, dz] = DIRS[d];
        senales.push([id, x, z, Math.atan2(-dx, -dz), alto]);
    };
    const semaforosPos = []; // {c, d, x, z, rotY}
    Object.values(MAPA.aristas).forEach(e => {
        ['E', 'W', 'S', 'N'].filter(d => ejeDe(d) === e.eje).forEach(d => {
            const sg = signoDe(d), a0 = alongIni(e, d), af = alongFin(e, d), lat = e.half + 0.9;
            if (!permite(e, d)) {
                // Calle de sentido único vista desde la entrada prohibida
                ponerSenal('R-101', e, d, a0 + sg * 1.2, lat);
                ponerSenal('R-101', e, d, a0 + sg * 1.2, -lat);
                return;
            }
            ponerSenal(e.residencial ? 'S-28' : `R-301-${e.limite}`, e, d, a0 + sg * 6, lat);
            if (e.zebra != null) {
                ponerSenal(e.colegio ? 'P-21' : 'P-20', e, d, a0 + sg * 13, lat);
                ponerSenal('S-13', e, d, e.zebra - sg * 2, lat);
            }
            const c = MAPA.cruces[finDe(e, d)], ctrl = c.control[d];
            if (ctrl === 'stop') ponerSenal('R-2', e, d, af - sg * 2.5, lat);
            if (ctrl === 'ceda') ponerSenal('R-1', e, d, af - sg * 2.5, lat);
            if (ctrl === 'glorieta') { ponerSenal('R-1', e, d, af - sg * 2.5, lat, 2.35); ponerSenal('R-402', e, d, af - sg * 2.5, lat, 1.5); ponerSenal('P-4', e, d, af - sg * 22, lat); }
            if (ctrl === 'semaforo') { const [x, z] = puntoEn(e, d, af - sg * 0.6, e.half + 0.7), [dx, dz] = DIRS[d]; semaforosPos.push({ c, d, x, z, rotY: Math.atan2(-dx, -dz) });
                // repetidor al otro lado del cruce, a la izquierda (desde el asiento el cercano queda alto)
                const eOut = aristaDesde(MAPA, c.key, d);
                const ext = ejeDe(d) === 'x' ? c.hx : c.hz;
                const [rx, rz] = eOut ? puntoEn(eOut, d, alongIni(eOut, d) + sg * 0.8, -(eOut.half + 0.7)) : puntoEn(e, d, af + sg * (2 * ext + 1.2), -e.half * 0.6);
                semaforosPos.push({ c, d, x: rx, z: rz, rotY: Math.atan2(-dx, -dz), alto: 2.9 });
            }
            (c.prohibidos[d] || []).forEach(g => ponerSenal(g === 'derecha' ? 'R-302' : 'R-303', e, d, af - sg * 9, lat));
        });
    });
    const texturasSenal = new Map();
    {
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), uno = new THREE.Vector3(1, 1, 1), eY = new THREE.Euler();
        const poste = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.045, 0.045, 2.3, 6), lambert(0x9aa0a6), senales.length);
        poste.castShadow = true;
        senales.forEach(([, x, z], k) => { m.compose(v.set(x, 1.15, z), q.identity(), uno); poste.setMatrixAt(k, m); });
        ciudad.add(poste);
        const porId = {};
        senales.forEach(sd => { (porId[sd[0]] = porId[sd[0]] || []).push(sd); });
        Object.entries(porId).forEach(([id, lista]) => {
            const tex = texturaCanvas(senalCanvas(id, 256));
            texturasSenal.set(id, tex);
            const tam = id.startsWith('P-') || id === 'R-1' ? 0.95 : 0.78;
            const geo = new THREE.PlaneGeometry(tam, tam);
            const frente = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, emissive: 0x222222 }), lista.length);
            const dorso = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ map: tex, color: 0x000000, emissive: 0x75797e, alphaTest: 0.5, side: THREE.BackSide }), lista.length);
            lista.forEach(([, x, z, rotY, alto], k) => {
                q.setFromEuler(eY.set(0, rotY, 0));
                const [nx, nz] = [Math.sin(rotY), Math.cos(rotY)];
                m.compose(v.set(x + nx * 0.06, alto, z + nz * 0.06), q, uno);
                frente.setMatrixAt(k, m); dorso.setMatrixAt(k, m);
            });
            ciudad.add(frente, dorso);
        });
    }

    // ── Semáforos ──
    const texSem = { rojo: texturaSemaforo('rojo'), ambar: texturaSemaforo('ambar'), verde: texturaSemaforo('verde') };
    const matsSemaforo = {}; // key|eje → material
    const colorHaloSem = { rojo: 0xff2a1a, ambar: 0xffa000, verde: 0x00ff70 }, yLamparaSem = { rojo: 0.4, ambar: 0, verde: -0.4 };
    {
        const matPoste = lambert(0x37474f), matCaja = lambert(0x1c1c1c);
        // Cabeza grande (lámparas de ~30 cm), viseras y halo; en el poste cercano, repetidor a la altura de los ojos
        const ALTO_CAJA = 1.32, SEP = 0.4; // separación entre lámparas
        const geoPoste = new THREE.CylinderGeometry(0.07, 0.07, 3.3, 8), geoCaja = new THREE.BoxGeometry(0.5, ALTO_CAJA, 0.3), geoLuz = new THREE.PlaneGeometry(0.44, 1.21);
        const geoVisera = mergeGeometries([SEP, 0, -SEP].map(y => { const b = new THREE.BoxGeometry(0.4, 0.03, 0.26); b.translate(0, y + 0.19, 0); return b; }));
        const geoRep = new THREE.BoxGeometry(0.2, 0.52, 0.14), geoLuzRep = new THREE.PlaneGeometry(0.17, 0.468);
        const texHalo = texturaHalo(), geoHalo = new THREE.PlaneGeometry(1, 1); // plano: solo se ve de frente, no desde la otra calle
        const colorHalo = { rojo: 0xff2a1a, ambar: 0xffa000, verde: 0x00ff70 };
        const yLampara = { rojo: SEP, ambar: 0, verde: -SEP };
        semaforosPos.forEach(({ c, d, x, z, rotY, alto = 3.55 }) => {
            const k = `${c.key}|${ejeDe(d)}`;
            if (!matsSemaforo[k]) matsSemaforo[k] = {
                mat: new THREE.MeshBasicMaterial({ map: texSem.rojo, toneMapped: false }),
                halo: new THREE.MeshBasicMaterial({ map: texHalo, color: colorHalo.rojo, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, fog: false, side: THREE.FrontSide }),
                halos: [], c, d, estado: 'rojo',
            };
            const o = matsSemaforo[k];
            const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY;
            const p = new THREE.Mesh(geoPoste, matPoste); p.scale.y = alto / 3.55; p.position.y = 1.65 * alto / 3.55; p.castShadow = true; g.add(p);
            const cj = new THREE.Mesh(geoCaja, matCaja); cj.position.set(0, alto, 0); cj.castShadow = true; g.add(cj);
            const lz = new THREE.Mesh(geoLuz, o.mat); lz.position.set(0, alto, 0.155); g.add(lz);
            const visera = new THREE.Mesh(geoVisera, matCaja); visera.position.set(0, alto + 0.02, 0.3); g.add(visera);
            const halo = new THREE.Mesh(geoHalo, o.halo); halo.scale.set(1.1, 1.1, 1); halo.position.set(0, alto + yLampara.rojo, 0.2); g.add(halo);
            o.halos.push({ halo, alto, escala: 1 });
            if (alto > 3) {
                // repetidor pequeño a la altura de los ojos, para verlo parado en la línea de detención
                const rep = new THREE.Mesh(geoRep, matCaja); rep.position.set(-0.13, 2.0, 0.02); g.add(rep);
                const lr = new THREE.Mesh(geoLuzRep, o.mat); lr.position.set(-0.13, 2.0, 0.092); g.add(lr);
                const hr = new THREE.Mesh(geoHalo, o.halo); hr.scale.set(0.42, 0.42, 1); hr.position.set(-0.13, 2.0 + yLampara.rojo * 0.39, 0.12); g.add(hr);
                o.halos.push({ halo: hr, alto: 2.0, escala: 0.39 });
            }
            ciudad.add(g);
        });
    }
    const actualizarSemaforos = (t) => {
        Object.values(matsSemaforo).forEach(o => {
            const e = luz(o.c, o.d, t).estado;
            if (e !== o.estado) {
                o.estado = e; o.mat.map = texSem[e]; o.mat.needsUpdate = true;
                o.halo.color.setHex(colorHaloSem[e]);
                o.halos.forEach(h => { h.halo.position.y = h.alto + yLamparaSem[e] * h.escala; });
            }
        });
    };

    // ── Pista de maniobras (moto) ──
    const conos = [];
    {
        const P = PISTA, w = P.x1 - P.x0, d = P.z1 - P.z0;
        const texP = texturaAsfalto(); texP.repeat.set(w / 9, d / 9);
        const suelo = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lambert(0xc8c8c8, { map: texP }));
        suelo.rotation.x = -Math.PI / 2; suelo.position.set((P.x0 + P.x1) / 2, 0.01, (P.z0 + P.z1) / 2); suelo.receiveShadow = true; ciudad.add(suelo);
        const muro = lambert(0xd0ccc4), rojo = lambert(0xc62828);
        [[P.x0, P.x1, P.z0 - 0.5, P.z0], [P.x0, P.x1, P.z1, P.z1 + 0.5], [P.x0 - 0.5, P.x0, P.z0, P.z1], [P.x1, P.x1 + 0.5, P.z0, P.z1]].forEach(([a, b, c, e], i) => {
            const m = new THREE.Mesh(cajaEn(a, b, 0, 0.6, c, e), i % 2 ? rojo : muro); m.castShadow = true; ciudad.add(m);
        });
        const blanco = lambert(0xf2f2f2);
        const raya = (x0, x1, z0, z1) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), blanco); m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, 0.025, (z0 + z1) / 2); ciudad.add(m); };
        raya(P.xc - 3, P.xc + 3, P.salida - 0.15, P.salida + 0.15);                       // salida
        [-1, 1].forEach(sg => raya(P.xc + sg * P.ancho - 0.05, P.xc + sg * P.ancho + 0.05, P.pasillo[1], P.pasillo[0])); // pasillo
        const lineaFrenado = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.5), rojo); lineaFrenado.rotation.x = -Math.PI / 2; lineaFrenado.position.set(P.xc, 0.026, P.linea); ciudad.add(lineaFrenado);
        raya(P.xc - 3, P.xc + 3, P.puerta - 0.1, P.puerta + 0.1);
        [['1', P.slalom[0] + 7], ['2', P.pasillo[0] + 5], ['3', P.puerta + 9]].forEach(([t, z]) => {
            const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2.6), lambert(0xffffff, { map: texturaTextoSuelo(t), transparent: true, depthWrite: false }));
            m.rotation.x = -Math.PI / 2; m.position.set(P.xc - 2.5, 0.027, z); ciudad.add(m);
        });
        const geoCono = new THREE.ConeGeometry(0.17, 0.5, 14), matCono = lambert(0xff6d00), geoBanda = new THREE.CylinderGeometry(0.105, 0.125, 0.08, 14), matBanda = lambert(0xffffff);
        const cono = (x, z, tipo) => {
            const g = new THREE.Group(); g.position.set(x, 0.25, z);
            const c = new THREE.Mesh(geoCono, matCono); c.castShadow = true; g.add(c);
            const bnd = new THREE.Mesh(geoBanda, matBanda); bnd.position.y = 0.02; g.add(bnd);
            ciudad.add(g); conos.push({ x, z, g, caido: false, tipo });
        };
        P.slalom.forEach(z => cono(P.xc, z, 'slalom'));
        for (let z = P.pasillo[1]; z <= P.pasillo[0] + 0.01; z += 1.6) [-1, 1].forEach(sg => cono(P.xc + sg * (P.ancho + 0.15), z, 'pasillo'));
        [-1, 1].forEach(sg => cono(P.xc + sg * 1.6, P.puerta, 'puerta'));
        [-1, 1].forEach(sg => cono(P.xc + sg * 3.2, P.linea, 'linea'));
    }

    // ── Coches aparcados (calles de sentido único, lado izquierdo) ──
    const aparcados = [];
    Object.values(MAPA.aristas).filter(e => e.sentido !== 0).forEach(e => {
        const d = e.eje === 'x' ? (e.sentido > 0 ? 'E' : 'W') : (e.sentido > 0 ? 'S' : 'N');
        for (let a = e.ini + 7; a < e.fin - 7; a += 6.2) {
            if (e.zebra != null && Math.abs(a - e.zebra) < 6) continue;
            if (r() < 0.3) continue;
            const [x, z] = puntoEn(e, d, a, -CARRIL * 0.5 - 0.15), [dx, dz] = DIRS[d];
            const coche = crearCoche(COLORES_COCHE[Math.floor(r() * COLORES_COCHE.length)], mats);
            const yaw = yawDe(dx, dz);
            coche.position.set(x, 0, z); coche.rotation.y = yaw;
            ciudad.add(coche);
            aparcados.push(caja(x, z, yaw));
        }
    });

    // ═══════════════ VEHÍCULO DEL JUGADOR (coche o moto) ═══════════════
    const esMoto = op.vehiculo === 'moto';
    const manual = op.cambio === 'manual';
    // Embrague con pedal (Shift, botón táctil o micro:bit). Si no, el embrague es automático.
    let embraguePedal = manual && op.embrague === 'pedal';
    const escalaMarcha = esMoto ? 1.12 : 1; // la moto estira algo más cada marcha
    const datoMarcha = (g) => { const t = TABLA_MARCHAS[g]; return t && { ...t, min: t.min * escalaMarcha, baja: t.baja * escalaMarcha, max: t.max * escalaMarcha }; };
    const motorM = { rpm: 800, embrague: 0, tPisado: 0, tRpmBajas: 0, calado: false, calados: 0, tBajo: 0, tAlto: 0, tForzado: 0, multaAlto: false, multaForzado: false };
    const HL = esMoto ? 1.05 : 2.15, HW = esMoto ? 0.4 : 0.92; // medio largo / medio ancho para choques
    const jugGrupo = esMoto ? crearMoto(mats) : crearCoche(0x0d47a1, mats);
    escena.add(jugGrupo);
    const matFreno = lambert(0x7a0d0d, { emissive: 0x3a0000 });
    const matFrenoIA = lambert(0x7a0d0d, { emissive: 0xff1a1a });
    jugGrupo.userData.detras.material = matFreno;
    const matInter = new THREE.MeshBasicMaterial({ color: 0xffa000 });
    const intermitentes = { izq: [], der: [] };
    (esMoto
        ? [[-0.2, -0.66, 'izq', 0.95], [0.2, -0.66, 'der', 0.95], [-0.14, 0.9, 'izq', 0.9], [0.14, 0.9, 'der', 0.9]]
        : [[-0.78, -2.17, 'izq', 0.84], [0.78, -2.17, 'der', 0.84], [-0.78, 2.19, 'izq', 0.84], [0.78, 2.19, 'der', 0.84]]
    ).forEach(([x, z, lado, y]) => {
        const t = esMoto ? 0.07 : 0.1;
        const b = new THREE.Mesh(new THREE.BoxGeometry(esMoto ? 0.08 : 0.16, t, t), matInter); b.position.set(x, y, z); b.visible = false;
        jugGrupo.add(b); intermitentes[lado].push(b);
    });
    const matSalpicadero = lambert(0x26292e), matPlastico = lambert(0x3a3e45), matTecho = lambert(0xd8d2c4, { emissive: 0x7a7468 });
    const barra = (p0, p1, g, mat) => {
        const a = new THREE.Vector3(...p0), b = new THREE.Vector3(...p1);
        const m = new THREE.Mesh(new THREE.BoxGeometry(g, g, a.distanceTo(b)), mat);
        m.position.copy(a).add(b).multiplyScalar(0.5); m.lookAt(b); return m;
    };
    // Interior (solo en la vista desde el asiento)
    const interior = new THREE.Group(); jugGrupo.add(interior);
    // volante (coche) o manillar (moto)
    const volante = new THREE.Group();
    let soportesEspejo;
    if (!esMoto) {
        // Retrovisores exteriores (carcasa)
        soportesEspejo = [-1, 1].map(s => {
            const g = new THREE.Group(); g.position.set(s * 1.0, 1.02, -0.62); g.rotation.y = -s * 0.5; jugGrupo.add(g);
            const carcasa = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.15, 0.09), mats.colorCoche(0x0d47a1));
            carcasa.position.z = -0.05; carcasa.castShadow = true; g.add(carcasa);
            return g;
        });
        { const c = new THREE.Mesh(mats.geoCoche.capo, mats.colorCoche(0x0d47a1)); interior.add(c); }
        const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); interior.add(m); return m; };
        add(new THREE.BoxGeometry(1.62, 0.24, 0.5), matSalpicadero, 0, 0.86, -0.72);          // salpicadero
        add(new THREE.BoxGeometry(1.6, 0.05, 0.3), matPlastico, 0, 0.995, -0.85);             // borde bajo el parabrisas
        add(new THREE.BoxGeometry(0.44, 0.08, 0.2), matSalpicadero, -0.37, 1.0, -0.56);       // visera del cuadro
        add(new THREE.BoxGeometry(1.56, 0.02, 2.4), matSalpicadero, 0, 0.965, 0.55);         // suelo / asientos (tapa la carrocería)
        add(new THREE.BoxGeometry(1.5, 0.03, 1.2), matTecho, 0, 1.415, 0.57);                 // techo
        [-1, 1].forEach(s => {
            add(new THREE.BoxGeometry(0.06, 0.12, 1.9), matPlastico, s * 0.78, 0.96, 0.25);    // marco de la puerta
            add(new THREE.BoxGeometry(0.04, 0.42, 1.7), matSalpicadero, s * 0.8, 0.74, 0.3); // panel de la puerta
            interior.add(barra([s * 0.75, 0.99, -0.95], [s * 0.69, 1.39, -0.04], 0.065, matSalpicadero)); // pilar A
        });
        add(new THREE.BoxGeometry(0.02, 0.07, 0.02), matPlastico, 0, 1.335, -0.2);          // soporte del retrovisor
        volante.position.set(-0.37, 0.9, -0.14); volante.rotation.x = -0.45;
        const negro = lambert(0x161616);
        volante.add(new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.021, 10, 36), negro));
        [0, 2.1, -2.1].forEach(a => { const rad = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.03, 0.015), lambert(0x2b2b2b)); rad.position.set(Math.cos(a - Math.PI / 2) * 0.09, Math.sin(a - Math.PI / 2) * 0.09, 0); rad.rotation.z = a - Math.PI / 2; volante.add(rad); });
        const centro = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.045, 16), lambert(0x2b2b2b)); centro.rotation.x = Math.PI / 2; volante.add(centro);
        const columna = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.32, 10), negro); columna.rotation.x = Math.PI / 2; columna.position.z = -0.17; volante.add(columna);
        interior.add(volante);
    } else {
        // Manillar: gira con la dirección y lleva los retrovisores (visible en las dos vistas)
        volante.position.set(0, 1.07, -0.52); volante.rotation.x = 0.25;
        jugGrupo.add(volante);
        const negro = lambert(0x1a1a1a);
        volante.add(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.032, 0.032), matPlastico));
        [-1, 1].forEach(s => {
            const puno = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.12, 10), negro); puno.rotation.z = Math.PI / 2; puno.position.x = s * 0.33; volante.add(puno);
            const maneta = barra([s * 0.22, 0.01, -0.02], [s * 0.36, 0.0, -0.07], 0.012, matPlastico); volante.add(maneta);
            volante.add(barra([s * 0.25, 0, 0], [s * 0.3, 0.2, 0.04], 0.012, matPlastico)); // vástago del espejo
        });
        const tija = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 10), matPlastico); tija.position.y = -0.06; volante.add(tija);
        soportesEspejo = [-1, 1].map(s => {
            const g = new THREE.Group(); g.position.set(s * 0.3, 0.21, 0.04); g.rotation.y = -s * 0.25; volante.add(g);
            const carcasa = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.085, 0.03), negro); carcasa.position.z = -0.018; g.add(carcasa);
            return g;
        });
    }
    // Pantalla (velocidad, navegación y avisos; también se ve en las gafas VR)
    const lienzoPanel = document.createElement('canvas'); lienzoPanel.width = 640; lienzoPanel.height = 260;
    const texPanel = texturaCanvas(lienzoPanel);
    const panel = new THREE.Mesh(esMoto ? new THREE.PlaneGeometry(0.24, 0.0975) : new THREE.PlaneGeometry(0.34, 0.138), new THREE.MeshBasicMaterial({ map: texPanel, toneMapped: false }));
    if (esMoto) { panel.position.set(0, 1.13, -0.43); panel.rotation.set(-0.75, 0, 0); }
    else { panel.position.set(0.06, 1.05, -0.56); panel.rotation.set(-0.28, -0.22, 0); }
    interior.add(panel);
    // Espejos que reflejan de verdad (render a textura)
    const espejos = [];
    const CAPA_ESPEJO = 3;
    camara.layers.enable(CAPA_ESPEJO);
    const crearEspejo = (w, h, res, padre, pos, rot, camPos, camRotY, fov) => {
        const rt = new THREE.WebGLRenderTarget(res, Math.round(res * h / w));
        rt.texture.colorSpace = THREE.SRGBColorSpace;
        rt.texture.repeat.x = -1; rt.texture.offset.x = 1; // imagen especular
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: rt.texture, toneMapped: false }));
        const marco = new THREE.Mesh(new THREE.BoxGeometry(w + 0.025, h + 0.025, 0.025), matPlastico);
        marco.position.set(...pos); marco.rotation.set(...rot); padre.add(marco);
        m.position.set(0, 0, 0.014); marco.add(m);
        m.layers.set(CAPA_ESPEJO); // las cámaras de los espejos no se ven a sí mismas (evita el bucle de realimentación)
        const cam = new THREE.PerspectiveCamera(fov, w / h, 0.9, 260);
        cam.position.set(...camPos); cam.rotation.y = camRotY; jugGrupo.add(cam);
        espejos.push({ rt, cam });
    };
    if (esMoto) {
        crearEspejo(0.11, 0.07, esMovil ? 128 : 192, soportesEspejo[0], [0, 0, 0], [0, 0, 0], [-0.4, 1.3, -0.3], Math.PI - 0.12, 32);
        crearEspejo(0.11, 0.07, esMovil ? 128 : 192, soportesEspejo[1], [0, 0, 0], [0, 0, 0], [0.4, 1.3, -0.3], Math.PI + 0.12, 32);
    } else {
        crearEspejo(0.25, 0.07, esMovil ? 192 : 320, interior, [0, 1.29, -0.2], [0.08, 0.5, 0], [0, 1.35, 0.6], Math.PI, 24);
        crearEspejo(0.18, 0.12, esMovil ? 128 : 192, soportesEspejo[0], [0, 0, 0.0], [0, 0, 0], [-1.0, 1.05, -0.45], Math.PI - 0.12, 30);
    }
    let frameEspejo = 0;
    // Cabeza del conductor (la cámara cuelga de aquí; en VR el visor la mueve)
    const cabeza = new THREE.Group();
    if (esMoto) cabeza.position.set(0, 1.47, 0.3); else cabeza.position.set(-0.37, 1.22, 0.38);
    jugGrupo.add(cabeza);

    // Marcador del destino (examen)
    const destinoMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 2.5, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0x00e676, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    destinoMesh.visible = false; escena.add(destinoMesh);

    // ═══════════════ ESTADO ═══════════════
    const inicio = { arista: MAPA.aristas.h_1_1, d: 'E' };
    const [px0, pz0] = puntoEn(inicio.arista, 'E', inicio.arista.ini + 9, CARRIL * 0.5);
    const jug = {
        x: px0, z: pz0, yaw: yawDe(1, 0), v: 0, steer: 0, marcha: manual ? 'N' : 'D', cinturon: false, intermitente: null,
        recorrido: 0, tramo: null, cruce: null, paradoStop: null, enAcera: false,
    };
    let tiempo = 0, pausado = false, vista = op.camara, enVR = false, carton = false;
    const faltas = [];
    const ultimaFalta = {};
    let mensajePanel = null; // { texto, color, hasta }
    const examen = op.modo === 'examen' ? { pasos: [], k: 0, destino: null, anunciado: -1, terminado: false } : null;
    const pista = op.modo === 'pista' ? { fase: 'slalom', cono: 0, lado: null, tPasillo: null, salioPasillo: false, terminado: false, prevZ: PISTA.salida } : null;
    if (pista) { jug.x = PISTA.xc; jug.z = PISTA.salida + 2; jug.yaw = 0; }

    const falta = (tipo, extra = '') => {
        if (examen?.terminado || pista?.terminado) return;
        if (ultimaFalta[tipo] != null && tiempo - ultimaFalta[tipo] < 4) return;
        ultimaFalta[tipo] = tiempo;
        const def = FALTAS[tipo];
        const f = { tipo, ...def, extra, t: Math.round(tiempo), kmh: Math.round(Math.abs(jug.v) * 3.6) };
        faltas.push(f);
        mensajePanel = { texto: def.texto, color: def.gravedad === 'leve' ? '#ffd54f' : def.gravedad === 'deficiente' ? '#ffab40' : '#ff5252', hasta: tiempo + 4 };
        cb.onFalta?.(f);
    };
    const aviso = (texto, voz = false) => {
        mensajePanel = { texto, color: '#80d8ff', hasta: tiempo + 4 };
        cb.onAviso?.(texto);
        if (voz) cb.onVoz?.(texto);
    };

    // ═══════════════ TRÁFICO ═══════════════
    const ia = [];
    let ultimoClaxon = -99;
    function elegirSalida(key, d) {
        const c = MAPA.cruces[key];
        if (c.glorieta) { const o = c.salidas.filter(x => x !== OPUESTO[d]); return Math.random() < 0.1 ? OPUESTO[d] : o[Math.floor(Math.random() * o.length)]; }
        let ops = c.salidas.filter(o => o !== OPUESTO[d] && !(c.prohibidos[d] || []).includes(tipoGiro(d, o)));
        if (!ops.length) ops = c.salidas;
        if (ops.includes(d) && Math.random() < 0.45) return d;
        return ops[Math.floor(Math.random() * ops.length)];
    }
    function piezaRecta(e, d) {
        const a0 = alongIni(e, d), a1 = alongFin(e, d), fin = finDe(e, d);
        return { tipo: 'recta', e, d, a0, p0: puntoEn(e, d, a0, e.carril), p1: puntoEn(e, d, a1, e.carril), len: Math.abs(a1 - a0), fin, salida: elegirSalida(fin, d), zebraS: e.zebra != null ? Math.abs(e.zebra - a0) : null };
    }
    /** Recorrido por la glorieta: entrada → arco en sentido antihorario → salida. */
    function piezaGlorieta(key, dIn, dOut) {
        const eIn = aristaDesde(MAPA, key, OPUESTO[dIn]), eOut = aristaDesde(MAPA, key, dOut);
        const p0 = puntoEn(eIn, dIn, alongFin(eIn, dIn), eIn.carril), p1 = puntoEn(eOut, dOut, alongIni(eOut, dOut), eOut.carril);
        const rad = Math.PI / 180;
        const a0 = (ANG_BRAZO[OPUESTO[dIn]] + 32) * rad; let a1 = (ANG_BRAZO[dOut] - 32) * rad;
        while (a1 <= a0) a1 += 2 * Math.PI;
        const pts = [p0];
        const n = Math.max(3, Math.ceil((a1 - a0) / 0.15));
        for (let k = 0; k <= n; k++) { const a = a0 + ((a1 - a0) * k) / n; pts.push([GX + R_ANILLO * Math.cos(a), GZ - R_ANILLO * Math.sin(a)]); }
        pts.push(p1);
        const acum = [0];
        for (let k = 1; k < pts.length; k++) acum.push(acum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
        return { tipo: 'poli', key, dIn, dOut, giro: tipoGiro(dIn, dOut), pts, acum, len: acum[acum.length - 1] };
    }
    function piezaCurva(key, dIn, dOut) {
        if (MAPA.cruces[key].glorieta) return piezaGlorieta(key, dIn, dOut);
        const eIn = aristaDesde(MAPA, key, OPUESTO[dIn]), eOut = aristaDesde(MAPA, key, dOut);
        const p0 = puntoEn(eIn, dIn, alongFin(eIn, dIn), eIn.carril), p1 = puntoEn(eOut, dOut, alongIni(eOut, dOut), eOut.carril);
        const giro = tipoGiro(dIn, dOut);
        const c = giro === 'recto' || giro === 'cambio' ? [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2] : (ejeDe(dIn) === 'x' ? [p1[0], p0[1]] : [p0[0], p1[1]]);
        let len = 0, prev = p0;
        for (let k = 1; k <= 12; k++) { const p = bezier(p0, c, p1, k / 12); len += Math.hypot(p[0] - prev[0], p[1] - prev[1]); prev = p; }
        return { tipo: 'curva', key, dIn, dOut, giro, p0, c, p1, len: Math.max(len, 0.5) };
    }
    const bezier = (a, c, b, t) => { const u = 1 - t; return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]; };
    const bezierTan = (a, c, b, t) => { const u = 1 - t; return [2 * u * (c[0] - a[0]) + 2 * t * (b[0] - c[0]), 2 * u * (c[1] - a[1]) + 2 * t * (b[1] - c[1])]; };

    function colocarIA(car) {
        const p = car.pieza;
        let x, z, tx, tz;
        if (p.tipo === 'recta') {
            const t = clamp(car.s / p.len, 0, 1);
            x = p.p0[0] + (p.p1[0] - p.p0[0]) * t; z = p.p0[1] + (p.p1[1] - p.p0[1]) * t;
            [tx, tz] = DIRS[p.d];
            car.aprox = { key: p.fin, d: p.d, dist: p.len - car.s };
            car.enCruce = null;
        } else if (p.tipo === 'poli') {
            const s = clamp(car.s, 0, p.len);
            let k = 1; while (k < p.acum.length - 1 && p.acum[k] < s) k++;
            const a = p.pts[k - 1], b = p.pts[k], L = (p.acum[k] - p.acum[k - 1]) || 1, t = (s - p.acum[k - 1]) / L;
            x = a[0] + (b[0] - a[0]) * t; z = a[1] + (b[1] - a[1]) * t;
            tx = (b[0] - a[0]) / L; tz = (b[1] - a[1]) / L;
            car.aprox = null; car.enCruce = p.key; car.dIn = p.dIn;
        } else {
            const t = clamp(car.s / p.len, 0, 1);
            [x, z] = bezier(p.p0, p.c, p.p1, t); [tx, tz] = bezierTan(p.p0, p.c, p.p1, t);
            const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
            car.aprox = null; car.enCruce = p.key; car.dIn = p.dIn;
        }
        car.x = x; car.z = z; car.fx = tx; car.fz = tz; car.yaw = yawDe(tx, tz);
        car.grupo.position.set(x, 0, z); car.grupo.rotation.y = car.yaw;
    }
    function crearIA() {
        const lista = Object.values(MAPA.aristas);
        for (let intento = 0; intento < 60; intento++) {
            const e = lista[Math.floor(Math.random() * lista.length)];
            const dirs = ['E', 'W', 'S', 'N'].filter(d => permite(e, d));
            if (!dirs.length) continue;
            const d = dirs[Math.floor(Math.random() * dirs.length)];
            const pieza = piezaRecta(e, d);
            const s = 4 + Math.random() * Math.max(1, pieza.len - 12);
            const [x, z] = [pieza.p0[0] + (pieza.p1[0] - pieza.p0[0]) * (s / pieza.len), pieza.p0[1] + (pieza.p1[1] - pieza.p0[1]) * (s / pieza.len)];
            if (Math.hypot(x - jug.x, z - jug.z) < 30) continue;
            if (ia.some(o => Math.hypot(o.x - x, o.z - z) < 12)) continue;
            const grupo = crearCoche(COLORES_COCHE[Math.floor(Math.random() * COLORES_COCHE.length)], mats);
            escena.add(grupo);
            const car = { grupo, pieza, s, v: 0, vFactor: 0.78 + Math.random() * 0.2, stopHecho: false, tStop: 0, tEspera: 0, bloqueo: 0, x, z };
            colocarIA(car);
            ia.push(car);
            return;
        }
    }
    const nIA = op.modo === 'pista' ? 0 : ({ poco: 6, normal: 12, mucho: 20 }[op.trafico] ?? 12);
    for (let k = 0; k < nIA; k++) crearIA();

    /** Estado del jugador visto por la IA (aproximación a un cruce o dentro). */
    function infoJugador() {
        let aprox = null;
        if (jug.tramo && !jug.cruce) {
            const e = MAPA.aristas[jug.tramo.arista], d = jug.tramo.d;
            if (permite(e, d)) {
                const along = e.eje === 'x' ? jug.x : jug.z;
                aprox = { key: finDe(e, d), d, dist: (alongFin(e, d) - along) * signoDe(d) };
            }
        }
        return { esJugador: true, x: jug.x, z: jug.z, v: Math.abs(jug.v), aprox, enCruce: jug.cruce?.key || null, dIn: jug.cruce?.dIn };
    }

    /** ¿Hay alguien con prioridad sobre quien entra en c por dIn? estricto = también cuenta a los que ya están dentro. */
    function hayConflicto(c, dIn, yo, otros, estricto) {
        const ctrl = c.control[dIn];
        for (const o of otros) {
            if (o === yo) continue;
            if (o.enCruce === c.key) {
                if (estricto && o.dIn !== dIn) return true;
                continue;
            }
            const a = o.aprox;
            if (!a || a.key !== c.key || a.d === dIn || a.dist > 24 || a.dist < -1) continue;
            if (o.v < 1.2 && a.dist > 4) continue; // está parado esperando
            if (ctrl === 'derecha') { if (a.d === A_IZQUIERDA[dIn]) return true; }
            else { const oc = c.control[a.d]; if (oc === 'prioridad' || oc === 'libre' || oc === 'derecha') return true; }
        }
        return false;
    }
    /** ¿Viene alguien por el anillo (por la izquierda) hacia el punto de entrada? */
    function conflictoGlorieta(c, dIn, yo, otros, vMin, estricto = true) {
        const ent = ANG_BRAZO[OPUESTO[dIn]];
        for (const o of otros) {
            if (o === yo || o.enCruce !== c.key || o.v < vMin) continue;
            const diff = ((((ent - angDe(o.x, o.z)) % 360) + 540) % 360) - 180;
            if (estricto ? (diff > -18 && diff < 100) : (diff > 5 && diff < 80)) return true;
        }
        return false;
    }
    const ocupadoOtroEje = (c, d, yo, otros) => otros.some(o => o !== yo && o.enCruce === c.key && o.dIn && ejeDe(o.dIn) !== ejeDe(d));
    const velParada = (dist) => (dist <= 0 ? 0 : Math.sqrt(2 * 3.2 * dist));

    function huecoDelante(car, otros) {
        let gap = 99; car.delante = null;
        for (const o of otros) {
            if (o === car) continue;
            const rx = o.x - car.x, rz = o.z - car.z;
            const al = rx * car.fx + rz * car.fz;
            if (al <= 0 || al > 32) continue;
            const lat = Math.abs(rx * -car.fz + rz * car.fx);
            if (lat < 2.1 && al - 4.6 < gap) { gap = al - 4.6; car.delante = o; }
        }
        return gap;
    }

    function actualizarIA(car, dt, otros) {
        const p = car.pieza;
        let obj = (p.tipo === 'recta' ? p.e.limite : 30) / 3.6 * car.vFactor;
        if (p.tipo === 'curva' && p.giro !== 'recto') obj = Math.min(obj, 4.6);
        if (p.tipo === 'poli') obj = Math.min(obj, 6.5);
        const gap = huecoDelante(car, otros);
        car.motivo = '';
        if (gap < 40) { obj = Math.min(obj, Math.max(0, (gap - 2) * 0.7)); if (gap < 4) car.motivo = 'hueco'; }
        if (p.tipo === 'recta') {
            const dist = p.len - car.s;
            if (dist < 36) {
                const c = MAPA.cruces[p.fin], ctrl = c.control[p.d];
                let parar = false;
                if (ctrl === 'semaforo') {
                    const l = luz(c, p.d, tiempo);
                    if (l.estado === 'rojo') parar = true;
                    else if (l.estado === 'ambar' && dist - 3 > (car.v * car.v) / (2 * 4)) parar = true;
                    else if (dist < 9) parar = ocupadoOtroEje(c, p.d, car, otros);
                } else {
                    if (ctrl === 'stop' && !car.stopHecho) {
                        parar = true;
                        if (dist < 5 && car.v < 0.4) { car.tStop += dt; if (car.tStop > 1.1) car.stopHecho = true; }
                    }
                    if (!parar && (ctrl === 'stop' || ctrl === 'ceda' || ctrl === 'derecha') && dist < 14) {
                        if (hayConflicto(c, p.d, car, otros, true)) { car.tEspera += dt; parar = car.tEspera < 7; }
                    }
                    if (ctrl === 'glorieta' && dist < 14) {
                        if (conflictoGlorieta(c, p.d, car, otros, 0.3)) { car.tEspera += dt; parar = car.tEspera < 9; } else car.tEspera = 0;
                    }
                    if (!parar && dist < 9 && ctrl !== 'glorieta') parar = ocupadoOtroEje(c, p.d, car, otros);
                }
                if (parar) { obj = Math.min(obj, velParada(dist - 3.2)); car.motivo = car.motivo || ('cruce:' + ctrl); }
            }
            if (p.zebraS != null) {
                const dz = p.zebraS - car.s;
                // si ya está encima de la cebra no se detiene en medio
                if (dz > 3 && dz < 26 && zebraOcupada(p.e.id)) { obj = Math.min(obj, velParada(dz - 4.6)); car.motivo = car.motivo || 'zebra'; }
            }
        }
        if (car.bloqueo > 0) { car.bloqueo -= dt; obj = 0; }
        // Claxon si el jugador está parado delante sin motivo (sin semáforo ni STOP cerca)
        if (car.delante?.esJugador && gap < 6 && car.v < 0.2 && Math.abs(jug.v) < 0.2 && !(car.delante.aprox && car.delante.aprox.dist < 12)) {
            car.tPitar = (car.tPitar || 0) + dt;
            if (car.tPitar > 7 && tiempo - ultimoClaxon > 9) { ultimoClaxon = tiempo; car.tPitar = 0; claxon(); aviso('¡Te pitan! Estás bloqueando el tráfico'); }
        } else car.tPitar = 0;
        const acc = clamp((obj - car.v) * 1.9, -8, 2.5);
        car.v = Math.max(0, car.v + acc * dt);
        car.s += car.v * dt;
        while (car.s >= car.pieza.len) {
            car.s -= car.pieza.len;
            const q = car.pieza;
            car.pieza = q.tipo === 'recta' ? piezaCurva(q.fin, q.d, q.salida) : piezaRecta(aristaDesde(MAPA, q.key, q.dOut), q.dOut);
            car.stopHecho = false; car.tStop = 0; car.tEspera = 0;
        }
        colocarIA(car);
        car.grupo.userData.detras.material = acc < -1.5 || car.v < 0.2 ? matFrenoIA : mats.piloto;
    }

    // ═══════════════ PEATONES ═══════════════
    const peatones = [];
    const caminantes = [];
    const zebras = {}; // aristaId → lista de peatones
    if (op.peatones) {
        Object.values(MAPA.aristas).filter(e => e.zebra != null).forEach(e => {
            zebras[e.id] = [1, -1].map(lado => {
                const g = crearPersona(r, mats); escena.add(g);
                const p = { g, e, lado, lat: lado * (e.half + 1.0), estado: 'ausente', t: Math.random() * 18, jitter: 0, destino: 0, caido: 0 };
                g.visible = false;
                peatones.push(p); return p;
            });
        });
        const nCam = esMovil ? 12 : 20;
        for (let k = 0; k < nCam; k++) {
            const ruta = caminantesRutas[Math.floor(r() * caminantesRutas.length)];
            const g = crearPersona(r, mats); escena.add(g);
            const [x0, x1, z0, z1] = ruta, per = 2 * (x1 - x0 + z1 - z0);
            caminantes.push({ g, ruta, per, u: r() * per, vel: (1.1 + r() * 0.5) * (r() < 0.5 ? 1 : -1), caido: 0 });
        }
    }
    function zebraOcupada(id) { return (zebras[id] || []).some(p => p.estado === 'aviso' || p.estado === 'cruza'); }
    function vehiculosHaciaZebra(e) {
        // ¿algún vehículo se acerca demasiado deprisa para que el peatón empiece a cruzar?
        const vs = [];
        ia.forEach(c => { if (c.pieza.tipo === 'recta' && c.pieza.e === e && c.pieza.zebraS != null) vs.push({ dz: c.pieza.zebraS - c.s, v: c.v }); });
        if (jug.tramo && jug.tramo.arista === e.id) {
            const along = e.eje === 'x' ? jug.x : jug.z;
            vs.push({ dz: (e.zebra - along) * signoDe(jug.tramo.d), v: Math.abs(jug.v) });
        }
        // Solo esperan a los vehículos que se mueven y ya no podrían frenar; los parados les están cediendo el paso
        return vs.some(o => o.v > 1.2 && o.dz > -2.5 && o.dz < o.v * 2.4 + 7);
    }
    function colocarPeaton(p) {
        const e = p.e;
        const [x, z] = e.eje === 'x' ? [e.zebra + p.jitter, e.centro + p.lat] : [e.centro + p.lat, e.zebra + p.jitter];
        p.x = x; p.z = z; p.g.position.set(x, Math.abs(p.lat) > e.half ? 0.15 : 0, z);
    }
    function actualizarPeatones(dt) {
        peatones.forEach(p => {
            const e = p.e, ud = p.g.userData;
            if (p.caido > 0) { p.caido -= dt; if (p.caido <= 0) { p.g.rotation.x = 0; p.estado = 'ausente'; p.t = 10 + Math.random() * 20; p.g.visible = false; p.x = null; } else colocarPeaton(p); return; }
            let andando = false, mirarCalle = true;
            if (p.estado === 'ausente') {
                // nadie en este paso de cebra; al rato llega otra persona por la acera
                p.t -= dt;
                if (p.t <= 0) {
                    p.lado = Math.random() < 0.5 ? 1 : -1; p.lat = p.lado * (e.half + 1.0);
                    p.jitter = (Math.random() < 0.5 ? -1 : 1) * (9 + Math.random() * 6);
                    p.destino = (Math.random() - 0.5) * 1.2;
                    p.g.children[0].material = mats.ropa(Math.floor(Math.random() * 8));
                    p.g.scale.setScalar(0.85 + Math.random() * 0.25);
                    p.g.visible = true; p.estado = 'llega';
                } else return;
            }
            if (p.estado === 'llega' || p.estado === 'se_va') {
                const sentido = Math.sign(p.destino - p.jitter) || 1;
                p.jitter += sentido * 1.3 * dt; andando = true; mirarCalle = false;
                const dir = sentido; // a lo largo de la calle
                p.g.rotation.y = e.eje === 'x' ? Math.atan2(dir, 0) : Math.atan2(0, dir);
                if ((p.destino - p.jitter) * sentido <= 0) {
                    if (p.estado === 'llega') { p.estado = 'espera'; p.t = 0.5 + Math.random() * 2; }
                    else { p.estado = 'ausente'; p.t = 15 + Math.random() * 30; p.g.visible = false; p.x = null; return; }
                }
            }
            else if (p.estado === 'espera') { p.t -= dt; if (p.t <= 0) { p.estado = 'aviso'; p.t = 1.3; p.lat = p.lado * (e.half + 0.35); } }
            else if (p.estado === 'aviso') { p.t -= dt; if (p.t <= 0 && !vehiculosHaciaZebra(e)) p.estado = 'cruza'; }
            else if (p.estado === 'cruza') {
                p.lat -= p.lado * 1.35 * dt; andando = true;
                // ya ha cruzado: sigue su camino por la otra acera y se marcha
                if (p.lado * p.lat < -(e.half + 0.9)) { p.lado = -p.lado; p.lat = p.lado * (e.half + 1.0); p.estado = 'se_va'; p.destino = p.jitter + (Math.random() < 0.5 ? -1 : 1) * (10 + Math.random() * 5); }
            }
            colocarPeaton(p);
            // mira hacia la calzada (cuando espera o cruza)
            if (mirarCalle) { const haciaX = e.eje === 'x' ? 0 : -p.lado, haciaZ = e.eje === 'x' ? -p.lado : 0; p.g.rotation.y = Math.atan2(haciaX, haciaZ); }
            ud.fase += dt * (andando ? 7 : 0);
            ud.piernas[0].rotation.x = andando ? Math.sin(ud.fase) * 0.5 : 0; ud.piernas[1].rotation.x = -ud.piernas[0].rotation.x;
        });
        caminantes.forEach(c => {
            const ud = c.g.userData;
            if (c.caido > 0) { c.caido -= dt; if (c.caido <= 0) c.g.rotation.x = 0; return; }
            c.u = (((c.u + c.vel * dt) % c.per) + c.per) % c.per;
            const [x0, x1, z0, z1] = c.ruta, w = x1 - x0, d = z1 - z0;
            let x, z, mx, mz, u = c.u;
            if (u < w) { x = x0 + u; z = z0; mx = 1; mz = 0; }
            else if ((u -= w) < d) { x = x1; z = z0 + u; mx = 0; mz = 1; }
            else if ((u -= d) < w) { x = x1 - u; z = z1; mx = -1; mz = 0; }
            else { u -= w; x = x0; z = z1 - u; mx = 0; mz = -1; }
            if (c.vel < 0) { mx = -mx; mz = -mz; }
            c.x = x; c.z = z;
            c.g.position.set(x, 0.15, z); c.g.rotation.y = Math.atan2(mx, mz);
            ud.fase += dt * 6.5;
            ud.piernas[0].rotation.x = Math.sin(ud.fase) * 0.45; ud.piernas[1].rotation.x = -ud.piernas[0].rotation.x;
        });
    }

    // ═══════════════ EXAMEN ═══════════════
    function nuevaRuta(n, motivo) {
        if (!examen || !jug.tramo) return;
        const e = MAPA.aristas[jug.tramo.arista];
        if (!permite(e, jug.tramo.d)) return;
        const ruta = generarRuta(e, jug.tramo.d, n);
        examen.pasos = ruta.pasos; examen.k = 0; examen.destino = ruta.destino; examen.anunciado = -1;
        const de = MAPA.aristas[ruta.destino.arista];
        const [x, z] = puntoEn(de, ruta.destino.d, ruta.destino.along, de.half - 1.4);
        destinoMesh.position.set(x, 1.25, z); destinoMesh.visible = true;
        if (motivo) aviso(motivo, true);
    }
    function textoInstruccion() {
        if (pista) return { giro: 'pista', texto: TEXTO_PISTA[pista.fase], dist: null };
        if (!examen) return null;
        if (examen.terminado) return { giro: 'fin', texto: 'Examen terminado', dist: 0 };
        const paso = examen.pasos[examen.k];
        if (!paso) return { giro: 'parar', texto: 'Detén el coche en la zona verde, junto a la acera', dist: distanciaDestino() };
        let dist = null;
        if (jug.tramo && !jug.cruce) {
            const e = MAPA.aristas[jug.tramo.arista];
            if (finDe(e, jug.tramo.d) === paso.key) dist = Math.max(0, (alongFin(e, jug.tramo.d) - (e.eje === 'x' ? jug.x : jug.z)) * signoDe(jug.tramo.d));
        }
        return { giro: paso.giro, salida: paso.salida, texto: textoPaso(paso), dist, quedan: examen.pasos.length - examen.k };
    }
    function distanciaDestino() {
        if (!examen?.destino) return null;
        const de = MAPA.aristas[examen.destino.arista];
        const [x, z] = puntoEn(de, examen.destino.d, examen.destino.along, de.half - 1.4);
        return Math.round(Math.hypot(x - jug.x, z - jug.z));
    }
    function revisarExamen() {
        if (!examen || examen.terminado) return;
        const paso = examen.pasos[examen.k];
        const ins = textoInstruccion();
        if (paso && ins.dist != null && ins.dist < 60 && examen.anunciado !== examen.k) {
            examen.anunciado = examen.k;
            cb.onVoz?.(`${textoPaso(paso)}.`);
        }
        if (!paso && examen.destino && jug.tramo && jug.tramo.arista === examen.destino.arista && !jug.cruce) {
            if (examen.anunciado !== 'fin') { examen.anunciado = 'fin'; cb.onVoz?.('Detenga el vehículo a la derecha, en la zona verde.'); }
            const de = MAPA.aristas[examen.destino.arista];
            const along = de.eje === 'x' ? jug.x : jug.z;
            if (Math.abs(along - examen.destino.along) < 7 && Math.abs(jug.v) < 0.15) {
                examen.terminado = true;
                destinoMesh.visible = false;
                const res = calificar(faltas);
                cb.onVoz?.(res.apto ? 'Fin del examen. Resultado: apto. ¡Enhorabuena!' : 'Fin del examen. Resultado: no apto.');
                cb.onFinExamen?.(resumen());
            }
        }
    }

    // ═══════════════ SEGUIMIENTO DEL JUGADOR (infracciones) ═══════════════
    const dirEnEje = (eje) => {
        const fx = -Math.sin(jug.yaw), fz = -Math.cos(jug.yaw);
        return eje === 'x' ? (fx >= 0 ? 'E' : 'W') : (fz >= 0 ? 'S' : 'N');
    };
    function entrarCruce(key) {
        const c = MAPA.cruces[key];
        const dIn = jug.tramo ? jug.tramo.d : dirEnEje(Math.abs(Math.sin(jug.yaw)) > 0.7 ? 'x' : 'z');
        jug.cruce = { key, dIn };
        if (jug.marcha === 'R' || !c.entradas.includes(dIn)) { jug.paradoStop = null; return; }
        const ctrl = c.control[dIn];
        if (ctrl === 'semaforo') {
            const l = luz(c, dIn, tiempo), v = Math.abs(jug.v);
            if (l.estado === 'rojo' && l.desde > 0.4) falta('SEMAFORO_ROJO');
            else if (l.estado === 'ambar') { const necesaria = v * 0.8 + (v * v) / (2 * 5.5); if (v * l.desde > necesaria + 1.5) falta('SEMAFORO_AMBAR'); }
        }
        if (ctrl === 'stop' && jug.paradoStop !== key) falta('STOP');
        if (ctrl === 'glorieta' && conflictoGlorieta(c, dIn, null, ia, 1.5, false)) falta('GLORIETA');
        if ((ctrl === 'stop' || ctrl === 'ceda' || ctrl === 'derecha') && hayConflicto(c, dIn, null, ia, false)) falta(ctrl === 'derecha' ? 'DERECHA' : 'CEDA');
        jug.paradoStop = null;
    }
    function salirCruce(aristaId) {
        const e = MAPA.aristas[aristaId], c = MAPA.cruces[jug.cruce.key];
        const dOut = dirEnEje(e.eje), dIn = jug.cruce.dIn;
        const giro = tipoGiro(dIn, dOut);
        if (c.glorieta) {
            if (jug.marcha !== 'R') { if (jug.intermitente !== 'der') falta('INTERMITENTE_GLORIETA'); setIntermitente(null); }
        } else if (jug.marcha !== 'R' && (giro === 'derecha' || giro === 'izquierda')) {
            const lado = giro === 'derecha' ? 'der' : 'izq';
            if (!jug.intermitente) falta('INTERMITENTE');
            else if (jug.intermitente !== lado) falta('INTERMITENTE_MAL');
            setIntermitente(null);
            if ((c.prohibidos[dIn] || []).includes(giro)) falta('GIRO_PROHIBIDO');
        }
        if (examen && !examen.terminado) {
            const paso = examen.pasos[examen.k];
            if (paso && paso.key === c.key) {
                if (paso.dOut === dOut) { examen.k++; }
                else { examen.desvio = true; }
            } else if (!paso && examen.destino) {
                examen.desvio = true; // se ha pasado el destino
            }
        }
        jug.cruce = null;
    }
    const TEXTO_PISTA = {
        slalom: 'Ejercicio 1: slalom. Rodea los conos alternando el lado.',
        pasillo: 'Ejercicio 2: pasillo estrecho muy despacio (7 s o más), sin salirte.',
        frenada: 'Ejercicio 3: acelera, pasa la puerta a 30 km/h o más y frena antes de la línea roja.',
        frenando: 'Frena con los dos frenos antes de la línea roja.',
        fin: 'Pista terminada',
    };
    function terminarPista() {
        pista.fase = 'fin'; pista.terminado = true;
        const res = calificar(faltas);
        cb.onVoz?.(res.apto ? 'Pista superada. Resultado: apto.' : 'Fin de la pista. Resultado: no apto.');
        setTimeout(() => cb.onFinExamen?.(resumen()), 400);
    }
    function revisarPista(dt) {
        if (!pista || pista.terminado) return;
        const P = PISTA, z = jug.z, z0 = pista.prevZ;
        const cruza = (linea) => z0 > linea && z <= linea;
        // conos derribados
        const fx = -Math.sin(jug.yaw), fz = -Math.cos(jug.yaw);
        conos.forEach(c => {
            if (c.caido) return;
            const rx = c.x - jug.x, rz = c.z - jug.z;
            if (Math.abs(rx) > 3 || Math.abs(rz) > 3) return;
            const al = rx * fx + rz * fz, la = rx * -fz + rz * fx;
            if (Math.abs(al) < HL + 0.1 && Math.abs(la) < HW + 0.08) { c.caido = true; c.g.rotation.z = Math.PI / 2; c.g.position.y = 0.17; falta('CONO'); }
        });
        if (pista.fase === 'slalom') {
            const cz = P.slalom[pista.cono];
            if (cruza(cz)) {
                const lado = jug.x < P.xc ? 'izq' : 'der';
                if (pista.lado === lado) falta('SLALOM');
                pista.lado = lado; pista.cono++;
                if (pista.cono >= P.slalom.length) { pista.fase = 'pasillo'; cb.onVoz?.('Muy bien. Ahora, el pasillo estrecho a velocidad reducida.'); }
            }
        } else if (pista.fase === 'pasillo') {
            if (cruza(P.pasillo[0])) pista.tPasillo = tiempo;
            if (pista.tPasillo != null && z < P.pasillo[0] && z > P.pasillo[1] && Math.abs(jug.x - P.xc) > P.ancho && !pista.salioPasillo) { pista.salioPasillo = true; falta('PASILLO_SALIR'); }
            if (cruza(P.pasillo[1])) {
                if (pista.tPasillo == null || tiempo - pista.tPasillo < 7) falta('PASILLO_RAPIDO', pista.tPasillo == null ? '' : `${(tiempo - pista.tPasillo).toFixed(1)} s`);
                pista.fase = 'frenada'; cb.onVoz?.('Ahora, la frenada. Pase la puerta a treinta kilómetros por hora o más y deténgase antes de la línea roja.');
            }
        } else if (pista.fase === 'frenada') {
            if (cruza(P.puerta)) { const kmh = Math.abs(jug.v) * 3.6; if (kmh < 28) falta('FRENADA_LENTA', `${Math.round(kmh)} km/h`); pista.fase = 'frenando'; }
        } else if (pista.fase === 'frenando') {
            if (cruza(P.linea)) { falta('FRENADA_LINEA'); terminarPista(); }
            else if (Math.abs(jug.v) < 0.1) terminarPista();
        }
        pista.prevZ = z;
    }
    function seguimiento(dt) {
        const zona = clasificar(jug.x, jug.z);
        if (zona.tipo === 'pista') { jug.enAcera = false; revisarPista(dt); return; }
        const kmh = Math.abs(jug.v) * 3.6;
        jug.enAcera = zona.tipo === 'acera';
        if (jug.enAcera && kmh > 2) falta('ACERA');
        if (zona.tipo === 'cruce') {
            if (!jug.cruce || jug.cruce.key !== zona.key) { if (jug.cruce) jug.cruce = null; entrarCruce(zona.key); }
            if (zona.key === GLORIETA && jug.marcha !== 'R') {
                // sentido de giro: positivo = antihorario (correcto)
                const rx = jug.x - GX, rz = -(jug.z - GZ), vx = -Math.sin(jug.yaw) * jug.v, vz = Math.cos(jug.yaw) * jug.v;
                const w = rx * vz - rz * vx;
                if (w < -2.5 && Math.hypot(rx, rz) > R_ISLA + 1) { jug.cruce.tContra = (jug.cruce.tContra || 0) + dt; if (jug.cruce.tContra > 0.8 && !jug.cruce.multaContra) { jug.cruce.multaContra = true; falta('SENTIDO_GLORIETA'); } }
                else if (jug.cruce) jug.cruce.tContra = 0;
            }
            return;
        }
        if (zona.tipo !== 'calle') return;
        if (jug.cruce) salirCruce(zona.arista);
        const e = MAPA.aristas[zona.arista];
        const d = dirEnEje(e.eje);
        const along = e.eje === 'x' ? jug.x : jug.z;
        if (!jug.tramo || jug.tramo.arista !== e.id || jug.tramo.d !== d) {
            jug.tramo = { arista: e.id, d, tVel: 0, tVelG: 0, multaVel: false, multaVelG: false, tCarril: 0, prevAlong: along, contrario: !permite(e, d), multaContrario: false };
            if (examen && !examen.terminado) {
                const paso = examen.pasos[examen.k];
                const llegaA = finDe(e, d);
                if (examen.desvio || (paso && paso.key !== llegaA) || (!paso && examen.destino && examen.destino.arista !== e.id)) {
                    examen.desvio = false;
                    nuevaRuta(Math.max(2, examen.pasos.length - examen.k), 'Te has desviado. El examinador te indica una ruta nueva.');
                }
            }
        }
        const t = jug.tramo;
        // sentido contrario (calle de sentido único recorrida al revés, hacia delante)
        if (t.contrario && !t.multaContrario && jug.marcha !== 'R' && Math.abs(jug.v) > 0.6) { t.multaContrario = true; falta('SENTIDO_CONTRARIO'); }
        // velocidad
        const lim = e.limite;
        if (kmh > lim + 20) { t.tVelG += dt; if (t.tVelG > 1 && !t.multaVelG) { t.multaVelG = true; falta('VELOCIDAD_GRAVE', `${Math.round(kmh)} km/h en una vía de ${lim}`); } }
        else if (kmh > lim + 3) { t.tVel += dt; if (t.tVel > 1.5 && !t.multaVel) { t.multaVel = true; falta('VELOCIDAD', `${Math.round(kmh)} km/h en una vía de ${lim}`); } }
        // carril contrario (solo doble sentido, lejos de los cruces)
        const rr = derechaDe(d);
        const lat = e.eje === 'x' ? (jug.z - e.centro) * rr[1] : (jug.x - e.centro) * rr[0];
        const dIni = Math.abs(along - alongIni(e, d)), dFin = Math.abs(alongFin(e, d) - along);
        if (e.sentido === 0 && !e.residencial && lat < -0.3 && dIni > 5 && dFin > 3 && kmh > 3) {
            t.tCarril += dt; if (t.tCarril > 1.2) { t.tCarril = -6; falta('CARRIL_CONTRARIO'); }
        } else if (t.tCarril > 0) t.tCarril = 0; else t.tCarril = Math.min(0, t.tCarril + dt);
        // STOP: ¿se ha detenido del todo cerca de la línea?
        if (permite(e, d)) {
            const c = MAPA.cruces[finDe(e, d)];
            if (c.control[d] === 'stop' && dFin < 13 && kmh < 1.2) jug.paradoStop = c.key;
        }
        // paso de cebra: el morro cruza la cebra con un peatón en la calzada
        if (e.zebra != null && permite(e, d)) {
            const sg = signoDe(d), morro = along + sg * 2.1, morroPrev = t.prevAlong + sg * 2.1;
            if ((morroPrev - e.zebra) * (morro - e.zebra) <= 0 && morro !== morroPrev) {
                if ((zebras[e.id] || []).some(p => p.estado === 'cruza' && Math.abs(p.lat) < e.half + 0.2)) falta('PEATON');
            }
        }
        t.prevAlong = along;
    }

    // ═══════════════ ENTRADAS ═══════════════
    const teclas = new Set();
    const tactil = { steer: 0, acel: 0, freno: 0, embrague: 0 };
    const externa = { steer: 0, acel: 0, freno: 0, embrague: 0 }; // micro:bit u otros mandos externos
    let inclinacion = { activa: false, invertir: false, valor: 0 };
    const orient = { alpha: null, beta: 0, gamma: 0, alpha0: null };
    const prevBotones = {};
    const flanco = (id, pulsado) => { const antes = prevBotones[id]; prevBotones[id] = pulsado; return pulsado && !antes; };

    const onKeyDown = (ev) => {
        const tag = (ev.target?.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;
        const k = ev.key.toLowerCase();
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) ev.preventDefault();
        if (ev.repeat) return;
        teclas.add(k);
        if (k === 'z') mirada.teclaYaw = 1.4;
        if (k === 'x') mirada.teclaYaw = -1.4;
        if (k === 'q') setIntermitente(jug.intermitente === 'izq' ? null : 'izq');
        if (k === 'e') setIntermitente(jug.intermitente === 'der' ? null : 'der');
        if (k === 'c') alternarCinturon();
        if (k === 'r') alternarMarcha();
        if (k === 't' || k === '+' || k === 'pageup') subirMarcha();
        if (k === 'g' || k === '-' || k === 'pagedown') bajarMarcha();
        if (k === 'v') alternarCamara();
        if (k === 'f') cambiarCampo();
    };
    const onKeyUp = (ev) => { const k = ev.key.toLowerCase(); teclas.delete(k); if ((k === 'z' && mirada.teclaYaw > 0) || (k === 'x' && mirada.teclaYaw < 0)) mirada.teclaYaw = 0; };
    const onBlur = () => teclas.clear();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    aLimpiar.push(() => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', onBlur); });

    // Mirar alrededor con el ratón, como girar la cabeza:
    // · modo «ratón» (por defecto en el ordenador): llevar el puntero hacia un lado de la pantalla gira la
    //   cabeza hacia ese lado (zona muerta en el centro para conducir mirando al frente);
    // · arrastrando con el botón pulsado (si el modo ratón está apagado);
    // · Z / X: vistazo rápido a la izquierda / derecha mientras se mantiene pulsada.
    const mirada = { yaw: 0, pitch: 0, objYaw: 0, objPitch: 0, teclaYaw: 0, arrastrando: false, px: 0, py: 0, raton: op.mirarRaton ?? !esMovil };
    const zonaMuerta = (v, dz) => Math.sign(v) * Math.max(0, Math.abs(v) - dz) / (1 - dz);
    const onPDown = (ev) => { if (ev.pointerType === 'mouse' && !mirada.raton) { mirada.arrastrando = true; mirada.px = ev.clientX; mirada.py = ev.clientY; } };
    const onPMove = (ev) => {
        if (ev.pointerType && ev.pointerType !== 'mouse') return;
        if (mirada.arrastrando) {
            mirada.objYaw = clamp(mirada.objYaw - (ev.clientX - mirada.px) * 0.005, -1.6, 1.6);
            mirada.objPitch = clamp(mirada.objPitch - (ev.clientY - mirada.py) * 0.004, -0.6, 0.5);
            mirada.px = ev.clientX; mirada.py = ev.clientY;
            return;
        }
        if (!mirada.raton) return;
        if (ev.target !== renderer.domElement) { mirada.objYaw = 0; mirada.objPitch = 0; return; } // encima de un botón: mirar al frente
        const rc = renderer.domElement.getBoundingClientRect();
        const nx = ((ev.clientX - rc.left) / rc.width) * 2 - 1, ny = ((ev.clientY - rc.top) / rc.height) * 2 - 1;
        mirada.objYaw = -zonaMuerta(clamp(nx, -1, 1), 0.22) * 1.5;   // hasta ~86° a cada lado
        mirada.objPitch = -zonaMuerta(clamp(ny, -1, 1), 0.35) * 0.45;
    };
    const onPUp = () => { mirada.arrastrando = false; };
    const onDbl = () => { mirada.objYaw = 0; mirada.objPitch = 0; };
    const onSalir = (ev) => { if (!ev.relatedTarget) { mirada.objYaw = 0; mirada.objPitch = 0; } };
    renderer.domElement.addEventListener('pointerdown', onPDown);
    window.addEventListener('pointermove', onPMove);
    window.addEventListener('pointerup', onPUp);
    document.addEventListener('mouseout', onSalir);
    renderer.domElement.addEventListener('dblclick', onDbl);
    aLimpiar.push(() => { window.removeEventListener('pointermove', onPMove); window.removeEventListener('pointerup', onPUp); document.removeEventListener('mouseout', onSalir); });
    const actualizarMirada = (dt) => {
        const oy = mirada.teclaYaw || mirada.objYaw, op2 = mirada.teclaYaw ? 0 : mirada.objPitch;
        const k = Math.min(1, dt * 7);
        mirada.yaw += (oy - mirada.yaw) * k;
        mirada.pitch += (op2 - mirada.pitch) * k;
    };

    const onMotion = (ev) => {
        const g = ev.accelerationIncludingGravity; if (!g) return;
        const ang = (screen.orientation && screen.orientation.angle) ?? window.orientation ?? 0;
        let v = 0;
        if (ang === 90) v = g.y; else if (ang === -90 || ang === 270) v = -g.y; else v = -g.x;
        if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) v = -v;
        inclinacion.valor = clamp(v / 5.5, -1, 1);
    };
    const onOrient = (ev) => {
        if (ev.alpha == null) return;
        if (orient.alpha0 == null) orient.alpha0 = ev.alpha;
        orient.alpha = ev.alpha; orient.beta = ev.beta; orient.gamma = ev.gamma;
    };
    let motionActivo = false, orientActivo = false;
    const activarMotion = (on) => {
        if (on && !motionActivo) { window.addEventListener('devicemotion', onMotion); motionActivo = true; }
        if (!on && motionActivo && !inclinacion.activa && !carton) { window.removeEventListener('devicemotion', onMotion); motionActivo = false; }
    };
    const activarOrient = (on) => {
        if (on && !orientActivo) { orient.alpha0 = null; window.addEventListener('deviceorientation', onOrient); orientActivo = true; }
        if (!on && orientActivo) { window.removeEventListener('deviceorientation', onOrient); orientActivo = false; }
    };
    aLimpiar.push(() => { window.removeEventListener('devicemotion', onMotion); window.removeEventListener('deviceorientation', onOrient); });

    function leerMandos() {
        const out = { steer: 0, acel: 0, freno: 0, activo: false };
        // Mandos de las gafas VR
        const ses = renderer.xr.getSession?.();
        if (ses) {
            for (const src of ses.inputSources) {
                const gp = src.gamepad; if (!gp) continue;
                const h = src.handedness;
                const ax = gp.axes.length >= 4 ? gp.axes[2] : (gp.axes[0] || 0);
                const gat = gp.buttons[0]?.value || 0, apr = gp.buttons[1]?.value || 0;
                if (h === 'left') { if (Math.abs(ax) > 0.08) out.steer += ax; out.freno = Math.max(out.freno, gat, apr); if (flanco('xl4', gp.buttons[4]?.pressed)) setIntermitente(jug.intermitente === 'izq' ? null : 'izq'); if (flanco('xl5', gp.buttons[5]?.pressed)) setIntermitente(jug.intermitente === 'der' ? null : 'der'); }
                else { if (Math.abs(ax) > 0.08) out.steer += ax; out.acel = Math.max(out.acel, gat); out.freno = Math.max(out.freno, apr); if (flanco('xr4', gp.buttons[4]?.pressed)) alternarCinturon(); if (flanco('xr5', gp.buttons[5]?.pressed)) alternarMarcha(); }
                out.activo = true;
            }
        }
        // Mandos de consola / volantes USB (Gamepad API)
        const gps = navigator.getGamepads ? navigator.getGamepads() : [];
        for (const gp of gps) {
            if (!gp || !gp.connected || gp.mapping === 'xr-standard') continue;
            const st = Math.abs(gp.axes[0] || 0) > 0.07 ? gp.axes[0] : 0;
            const rt = gp.buttons[7]?.value || 0, lt = gp.buttons[6]?.value || 0;
            if (st || rt > 0.02 || lt > 0.02) out.activo = true;
            out.steer += st; out.acel = Math.max(out.acel, rt, gp.buttons[0]?.pressed ? 1 : 0); out.freno = Math.max(out.freno, lt);
            const id = gp.index;
            if (flanco(`g${id}4`, gp.buttons[4]?.pressed)) setIntermitente(jug.intermitente === 'izq' ? null : 'izq');
            if (flanco(`g${id}5`, gp.buttons[5]?.pressed)) setIntermitente(jug.intermitente === 'der' ? null : 'der');
            if (flanco(`g${id}3`, gp.buttons[3]?.pressed)) alternarCinturon();
            if (flanco(`g${id}1`, gp.buttons[1]?.pressed)) alternarMarcha();
            if (flanco(`g${id}12`, gp.buttons[12]?.pressed)) subirMarcha();
            if (flanco(`g${id}13`, gp.buttons[13]?.pressed)) bajarMarcha();
            if (flanco(`g${id}2`, gp.buttons[2]?.pressed)) alternarCamara();
        }
        return out;
    }

    function entradas() {
        const izq = teclas.has('a') || teclas.has('arrowleft'), der = teclas.has('d') || teclas.has('arrowright');
        const m = leerMandos();
        let steer = (der ? 1 : 0) - (izq ? 1 : 0) + tactil.steer + externa.steer + m.steer;
        if ((inclinacion.activa || carton) && motionActivo) steer += (inclinacion.invertir ? -1 : 1) * (Math.abs(inclinacion.valor) < 0.06 ? 0 : inclinacion.valor);
        let acel = Math.max(teclas.has('w') || teclas.has('arrowup') ? 1 : 0, tactil.acel, externa.acel, m.acel);
        const freno = Math.max(teclas.has('s') || teclas.has('arrowdown') || teclas.has(' ') ? 1 : 0, tactil.freno, externa.freno, m.freno);
        // Gafas de cartón sin mando: avanza solo hasta el límite; tocar la pantalla = frenar
        if (carton && !m.activo && freno === 0) {
            const tramoE = jug.tramo ? MAPA.aristas[jug.tramo.arista] : null;
            const objetivo = ((tramoE ? tramoE.limite : 30) - 4) / 3.6;
            acel = jug.cinturon ? clamp((objetivo - jug.v) * 0.6, 0, 0.7) : 0;
        }
        const embrague = Math.max(teclas.has('shift') ? 1 : 0, tactil.embrague || 0, externa.embrague || 0);
        return { steer: clamp(steer, -1, 1), acel: clamp(acel, 0, 1), freno: clamp(freno, 0, 1), embrague: clamp(embrague, 0, 1) };
    }

    // ═══════════════ FÍSICA ═══════════════
    const L_EJES = esMoto ? 1.45 : 2.6;
    let ladeo = 0;
    let suavSteer = 0;
    function esquinasLibres(x, z, yaw) {
        const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = -fz, rz = fx;
        for (const [a, b] of [[HL - 0.05, HW - 0.04], [HL - 0.05, -(HW - 0.04)], [-(HL - 0.05), HW - 0.04], [-(HL - 0.05), -(HW - 0.04)]]) {
            const t = clasificar(x + fx * a + rx * b, z + fz * a + rz * b).tipo;
            if (t === 'edificio' || t === 'isleta') return false;
        }
        return true;
    }
    // Cambio manual (sin pedal de embrague: se embraga solo al cambiar). Devuelve la aceleración del motor.
    // Con pedal: e = cuánto está pisado (0 suelto · 1 a fondo). Mordida entre 25 % y 75 %.
    const acopleEmbrague = (e) => clamp((0.75 - e) / 0.5, 0, 1);
    function empujePedal(dt, ent) {
        const kmh = Math.max(0, jug.v) * 3.6, g = jug.marcha, e = ent.embrague;
        motorM.embrague = e;
        motorM.tPisado = e > 0.6 ? motorM.tPisado + dt : 0;
        const rpmLibre = 800 + ent.acel * 4200;
        if (motorM.calado) {
            motorM.rpm = 0;
            // arrancar: en punto muerto o con el embrague pisado, acelerando o tras 0,8 s pisado
            if ((g === 'N' || e > 0.6) && (ent.acel > 0 || motorM.tPisado > 0.8)) { motorM.calado = false; motorM.rpm = 900; motorM.tRpmBajas = 0; aviso('Motor arrancado'); }
            return 0;
        }
        const k = g === 'N' ? 0 : acopleEmbrague(e);
        if (g === 'R') {
            const rpmR = Math.abs(jug.v) / 4.2 * 4000;
            motorM.rpm = rpmLibre - k * Math.max(0, rpmLibre - rpmR) * 0.9;
            if (k > 0 && motorM.rpm < 450) motorM.tRpmBajas += dt; else motorM.tRpmBajas = 0;
            if (motorM.tRpmBajas > 0.4) return calar();
            return -k * (0.35 + ent.acel * 0.65) * 2.2;
        }
        if (k === 0) { // desembragado o en N: el motor gira libre
            motorM.rpm += (rpmLibre - motorM.rpm) * Math.min(1, dt * 4);
            motorM.tRpmBajas = 0; motorM.tAlto = 0; motorM.tForzado = 0;
            return 0;
        }
        const d = datoMarcha(g), rel = kmh / d.max, rpmRueda = rel * 6400;
        let acc = 0;
        if (rpmLibre >= rpmRueda) { // el motor empuja (patinando si k < 1)
            motorM.rpm = rpmLibre - k * (rpmLibre - rpmRueda) * (k >= 1 ? 1 : 0.9);
            const forzado = kmh < d.baja;
            let par = 1;
            if (forzado) par = 0.3 + 0.7 * clamp((kmh - d.min) / Math.max(1, d.baja - d.min), 0, 1);
            if (rel > 0.85) par *= clamp(1 - (rel - 0.85) / 0.15, 0, 1);
            const tiron = k < 1 ? Math.max(par, 0.6) : par; // al patinar, el embrague arrastra aunque el motor vaya bajo
            acc = k * (0.35 + ent.acel * 0.65) * (esMoto ? 5 : 3.6) * d.fuerza * tiron;
            if (ent.acel === 0 && k >= 1 && rel > 0.12) acc = -0.9 * d.freno * clamp(rel, 0.2, 1); // sin gas: retención
        } else { // la rueda arrastra al motor: freno motor
            motorM.rpm = rpmLibre + k * (rpmRueda - rpmLibre);
            acc = jug.v > 0.3 ? -0.9 * d.freno * clamp(rel, 0.2, 1) * k : 0;
        }
        motorM.rpm = clamp(motorM.rpm, 0, 6500);
        // calado: el motor baja de vueltas con el embrague soltado
        if (motorM.rpm < 450) motorM.tRpmBajas += dt; else motorM.tRpmBajas = 0;
        if (motorM.tRpmBajas > 0.4) return calar();
        // marcha inadecuada (como sin pedal)
        if (rel >= 0.97 && ent.acel > 0 && k >= 1) { motorM.tAlto += dt; if (motorM.tAlto > 4 && !motorM.multaAlto) { motorM.multaAlto = true; aviso('Motor muy revolucionado: sube de marcha'); falta('MARCHA_INADECUADA', 'motor muy revolucionado'); } }
        else { motorM.tAlto = 0; if (rel < 0.8) motorM.multaAlto = false; }
        return acc;
    }
    function calar() {
        motorM.calado = true; motorM.tRpmBajas = 0; motorM.tBajo = 0; motorM.rpm = 0;
        aviso(embraguePedal ? 'Se ha calado el motor: pisa el embrague (o pon N) y acelera para arrancar' : 'Se ha calado el motor: pon 1.ª o N y acelera para arrancar');
        if (++motorM.calados > 1) falta('CALADO'); // el primero solo se avisa
        return 0;
    }
    function empujeManual(dt, ent) {
        if (embraguePedal) return empujePedal(dt, ent);
        const kmh = Math.max(0, jug.v) * 3.6, g = jug.marcha;
        if (motorM.calado) {
            motorM.rpm = 0;
            // vuelve a arrancar en punto muerto, 1.ª o R al acelerar
            if ((g === 'N' || g === '1' || g === 'R') && ent.acel > 0) { motorM.calado = false; motorM.rpm = 900; aviso('Motor arrancado'); }
            return 0;
        }
        if (g === 'R') { motorM.rpm = 800 + Math.abs(jug.v) / 4.2 * 3000 + ent.acel * 600; return -ent.acel * 2.2; }
        if (g === 'N') {
            motorM.rpm += ((800 + ent.acel * 4200) - motorM.rpm) * Math.min(1, dt * 4);
            motorM.tBajo = 0; motorM.tAlto = 0;
            return 0;
        }
        const d = datoMarcha(g), rel = kmh / d.max;
        motorM.rpm = 800 + clamp(rel, 0, 1) * 5600;
        // calado: demasiado despacio para esta marcha
        if (kmh < d.min) {
            motorM.tBajo += dt;
            if (motorM.tBajo > 0.7) {
                motorM.calado = true; motorM.tBajo = 0; motorM.rpm = 0;
                aviso(`Se ha calado el motor: pon 1.ª o N y acelera para arrancar`);
                if (++motorM.calados > 1) falta('CALADO'); // el primero solo se avisa
                return 0;
            }
        } else motorM.tBajo = 0;
        // marcha inadecuada: mucho rato en el corte o muy forzado acelerando
        if (rel >= 0.97 && ent.acel > 0) { motorM.tAlto += dt; if (motorM.tAlto > 4 && !motorM.multaAlto) { motorM.multaAlto = true; aviso('Motor muy revolucionado: sube de marcha'); falta('MARCHA_INADECUADA', 'motor muy revolucionado'); } }
        else { motorM.tAlto = 0; if (rel < 0.8) motorM.multaAlto = false; }
        const forzado = kmh < d.baja;
        if (forzado && ent.acel > 0.3) { motorM.tForzado += dt; if (motorM.tForzado > 3 && !motorM.multaForzado) { motorM.multaForzado = true; aviso('El motor va forzado: reduce de marcha'); falta('MARCHA_INADECUADA', 'motor forzado'); } }
        else { motorM.tForzado = 0; if (!forzado) motorM.multaForzado = false; }
        let par = 1;
        if (forzado) par = 0.3 + 0.7 * clamp((kmh - d.min) / Math.max(1, d.baja - d.min), 0, 1);
        if (rel > 0.85) par *= clamp(1 - (rel - 0.85) / 0.15, 0, 1); // corte de inyección
        let acc = ent.acel * (esMoto ? 5 : 3.6) * d.fuerza * par;
        if (ent.acel === 0 && jug.v > 0.3) acc -= 0.9 * d.freno * clamp(rel, 0.2, 1); // freno motor
        return acc;
    }
    function fisica(dt, ent) {
        suavSteer += clamp(ent.steer - suavSteer, -4 * dt, 4 * dt);
        const vabs = Math.abs(jug.v);
        const maxSteer = esMoto ? 0.55 / (1 + vabs / 7) : 0.6 / (1 + vabs / 10);
        jug.steer += clamp(suavSteer * maxSteer - jug.steer, -2.4 * dt, 2.4 * dt);
        let a = 0;
        if (manual) a += empujeManual(dt, ent);
        else if (ent.acel > 0) a += jug.marcha === 'R' ? -ent.acel * 2.2 : ent.acel * (esMoto ? 5 : 3.6) * (1 - Math.max(0, jug.v) / 40);
        if (ent.freno > 0 && vabs > 0.01) a -= Math.sign(jug.v) * ent.freno * 9;
        const roz = (jug.enAcera ? 2.2 : 0.32) + 0.0011 * jug.v * jug.v;
        if (vabs > 0.01) a -= Math.sign(jug.v) * roz;
        const v0 = jug.v;
        jug.v += a * dt;
        if (v0 !== 0 && Math.sign(jug.v) !== Math.sign(v0) && !(ent.acel > 0 && ((jug.marcha === 'R') === (jug.v < 0)))) jug.v = 0;
        if (jug.marcha !== 'R') jug.v = Math.max(0, jug.v); else jug.v = clamp(jug.v, -4.2, 0);
        if (Math.abs(jug.v) < 0.03 && (ent.acel === 0 || motorM.calado || jug.marcha === 'N' || (embraguePedal && ent.embrague > 0.75))) jug.v = 0;

        jug.yaw -= (jug.v / L_EJES) * Math.tan(jug.steer) * dt;
        const fx = -Math.sin(jug.yaw), fz = -Math.cos(jug.yaw);
        const nx = jug.x + fx * jug.v * dt, nz = jug.z + fz * jug.v * dt;
        const px = jug.x, pz = jug.z;
        if (esquinasLibres(nx, nz, jug.yaw)) { jug.x = nx; jug.z = nz; }
        else { if (Math.abs(jug.v) > 1.5) falta('CHOQUE_OBJETO'); jug.v = 0; }
        // coches
        const yo = caja(jug.x, jug.z, jug.yaw, HL, HW);
        let choque = null;
        for (const c of ia) { if (Math.abs(c.x - jug.x) < 6 && Math.abs(c.z - jug.z) < 6 && solapan(yo, caja(c.x, c.z, c.yaw))) { choque = c; break; } }
        const choqueAparcado = !choque && aparcados.some(b => Math.abs(b.x - jug.x) < 6 && Math.abs(b.z - jug.z) < 6 && solapan(yo, b));
        if (choque || choqueAparcado) {
            if (Math.abs(jug.v) > 0.8 || (choque && choque.v > 0.8)) falta(choque ? 'COLISION' : 'CHOQUE_OBJETO');
            jug.x = px; jug.z = pz; jug.v = 0;
            if (choque) { choque.v = 0; choque.bloqueo = 2.5; }
        }
        // peatones
        const todos = [...peatones, ...caminantes];
        for (const p of todos) {
            if (p.caido > 0 || p.x == null) continue;
            const rx = p.x - jug.x, rz = p.z - jug.z;
            if (Math.abs(rx) > 4 || Math.abs(rz) > 4) continue;
            const al = rx * fx + rz * fz, la = rx * -fz + rz * fx;
            if (Math.abs(al) < HL + 0.3 && Math.abs(la) < HW + 0.28) {
                if (Math.abs(jug.v) > 0.6) { falta('ATROPELLO'); p.caido = 4; p.g.rotation.x = -Math.PI / 2; jug.v *= 0.3; }
                else { jug.x = px; jug.z = pz; jug.v = 0; }
            }
        }
        const dist = Math.hypot(jug.x - px, jug.z - pz);
        jug.recorrido += dist;
        if (!jug.cinturon && jug.recorrido > 3 && !ultimaFalta.CINTURON && !ultimaFalta.CASCO) falta(esMoto ? 'CASCO' : 'CINTURON');
    }

    // ═══════════════ CÁMARAS ═══════════════
    const posExt = new THREE.Vector3(), mirarExt = new THREE.Vector3();
    let extIniciada = false;
    // Campo de visión horizontal ≈ 95° (como un conductor real), sin pasarse en vertical
    const CAMPOS = [95, 110, 80];
    let campo = 0;
    const fovCabina = () => clamp(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(CAMPOS[campo] / 2)) / camara.aspect)), 45, 95);
    function aplicarVista() {
        const cabina = vista === 'cabina' || enVR || carton;
        interior.visible = cabina;
        jugGrupo.userData.cabina.visible = !cabina;
        jugGrupo.userData.cuerpo.visible = !cabina || esMoto;
        jugGrupo.userData.faros.visible = !cabina;
        if (cabina) { if (camara.parent !== cabeza) { cabeza.add(camara); } camara.position.set(0, 0, 0); camara.rotation.set(0, 0, 0); camara.fov = fovCabina(); }
        else { if (camara.parent !== escena) escena.add(camara); extIniciada = false; camara.fov = 58; }
        camara.updateProjectionMatrix();
    }
    aplicarVista();
    const zee = new THREE.Vector3(0, 0, 1), eul = new THREE.Euler(), q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
    function actualizarCamara(dt) {
        if (enVR) return;
        if (carton && orient.alpha != null) {
            const ang = THREE.MathUtils.degToRad((screen.orientation && screen.orientation.angle) ?? window.orientation ?? 0);
            eul.set(THREE.MathUtils.degToRad(orient.beta), THREE.MathUtils.degToRad(orient.alpha - orient.alpha0), -THREE.MathUtils.degToRad(orient.gamma), 'YXZ');
            camara.quaternion.setFromEuler(eul); camara.quaternion.multiply(q1); camara.quaternion.multiply(q0.setFromAxisAngle(zee, -ang));
            return;
        }
        actualizarMirada(dt);
        if (vista === 'cabina') { camara.rotation.set(mirada.pitch, mirada.yaw, 0, 'YXZ'); return; }
        // exterior: el ratón hace girar la cámara alrededor del coche
        const fx = -Math.sin(jug.yaw), fz = -Math.cos(jug.yaw);
        const ox = -Math.sin(jug.yaw + mirada.yaw * 1.4), oz = -Math.cos(jug.yaw + mirada.yaw * 1.4);
        const dist = esMoto ? 4.8 : 7.2, alt = esMoto ? 2.2 : 2.9;
        const objetivo = new THREE.Vector3(jug.x - ox * dist, alt - mirada.pitch * 4, jug.z - oz * dist);
        if (!extIniciada) { posExt.copy(objetivo); extIniciada = true; }
        posExt.lerp(objetivo, 1 - Math.exp(-dt * 5));
        camara.position.copy(posExt);
        mirarExt.set(jug.x + fx * 6 * (1 - Math.min(1, Math.abs(mirada.yaw))), 1.4, jug.z + fz * 6 * (1 - Math.min(1, Math.abs(mirada.yaw))));
        camara.lookAt(mirarExt);
    }

    // ═══════════════ PANEL DEL SALPICADERO ═══════════════
    const ctxPanel = lienzoPanel.getContext('2d');
    let ultimoPanel = '';
    function dibujarFlecha(c, giro, x, y, t) {
        c.save(); c.translate(x, y); c.strokeStyle = '#fff'; c.fillStyle = '#fff'; c.lineWidth = t * 0.18; c.lineJoin = 'round';
        const pts = giro === 'derecha' ? [[-t * 0.3, t * 0.5], [-t * 0.3, -t * 0.1], [t * 0.35, -t * 0.1]] : giro === 'izquierda' ? [[t * 0.3, t * 0.5], [t * 0.3, -t * 0.1], [-t * 0.35, -t * 0.1]] : [[0, t * 0.5], [0, -t * 0.4]];
        c.beginPath(); pts.forEach(([a, b], i) => (i ? c.lineTo(a, b) : c.moveTo(a, b))); c.stroke();
        const [ax, ay] = pts[pts.length - 2], [bx, by] = pts[pts.length - 1], an = Math.atan2(by - ay, bx - ax);
        c.beginPath(); c.moveTo(bx + Math.cos(an) * t * 0.18, by + Math.sin(an) * t * 0.18);
        c.lineTo(bx + Math.cos(an + 2.3) * t * 0.28, by + Math.sin(an + 2.3) * t * 0.28); c.lineTo(bx + Math.cos(an - 2.3) * t * 0.28, by + Math.sin(an - 2.3) * t * 0.28); c.fill();
        c.restore();
    }
    function dibujarPanel(est) {
        const parpadeo = Math.floor(tiempo * 2.5) % 2 === 0;
        const clave = JSON.stringify([est.semaforo, est.kmh, est.limite, est.marcha, est.rpm, est.calado, est.cinturon, est.intermitente && parpadeo, est.instruccion?.texto, est.instruccion?.dist && Math.round(est.instruccion.dist / 5), mensajePanel?.texto, est.faltas]);
        if (clave === ultimoPanel) return;
        ultimoPanel = clave;
        const c = ctxPanel, W = 640, H = 260;
        c.fillStyle = '#0b0f14'; c.fillRect(0, 0, W, H);
        c.strokeStyle = '#2a3542'; c.lineWidth = 4; c.strokeRect(2, 2, W - 4, H - 4);
        const exceso = est.limite && est.kmh > est.limite + 3;
        c.fillStyle = exceso ? '#ff5252' : '#fff'; c.font = 'bold 96px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(String(est.kmh), 110, 100);
        c.fillStyle = '#9fb3c8'; c.font = 'bold 24px Arial'; c.fillText('km/h', 110, 160);
        if (est.limite) {
            c.beginPath(); c.arc(245, 92, 46, 0, Math.PI * 2); c.fillStyle = '#d32f2f'; c.fill();
            c.beginPath(); c.arc(245, 92, 36, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill();
            c.fillStyle = '#111'; c.font = 'bold 36px Arial'; c.fillText(String(est.limite), 245, 95);
        }
        c.font = 'bold 30px Arial'; c.fillStyle = est.marcha === 'R' ? '#ffab40' : est.marcha === 'N' ? '#9fb3c8' : '#69f0ae'; c.fillText(est.marcha, 245, 170);
        if (est.cambio === 'manual') { // cuentarrevoluciones
            const fr = clamp(est.rpm / 6400, 0, 1);
            c.fillStyle = '#1d2733'; c.fillRect(24, 238, 312, 12);
            c.fillStyle = est.calado ? '#7a2020' : fr > 0.85 ? '#ff5252' : fr > 0.65 ? '#ffb000' : '#42a5f5'; c.fillRect(24, 238, 312 * fr, 12);
            if (est.calado) { c.fillStyle = '#ff5252'; c.font = 'bold 18px Arial'; c.fillText('CALADO', 180, 245); }
        }
        if (est.semaforo) { // ayuda: color del semáforo al que te acercas
            c.fillStyle = '#111'; c.fillRect(296, 30, 44, 118);
            ['rojo', 'ambar', 'verde'].forEach((k, i) => { c.beginPath(); c.arc(318, 52 + i * 37, 15, 0, Math.PI * 2); c.fillStyle = est.semaforo === k ? { rojo: '#ff3b30', ambar: '#ffb000', verde: '#00e676' }[k] : '#2a2a2a'; c.fill(); });
        }
        c.font = 'bold 20px Arial'; c.fillStyle = est.cinturon ? '#69f0ae' : (parpadeo ? '#ff5252' : '#7a2020');
        c.fillText(esMoto ? (est.cinturon ? 'CASCO ✓' : 'CASCO') : (est.cinturon ? 'CINTURÓN ✓' : 'CINTURÓN'), 140, 212);
        // intermitentes
        ['izq', 'der'].forEach((lado, i) => {
            const on = est.intermitente === lado && parpadeo;
            c.fillStyle = on ? '#00e676' : '#1d3326';
            const x = i ? 300 : 24, s = i ? 1 : -1;
            c.beginPath(); c.moveTo(x + s * 28, 212); c.lineTo(x, 196); c.lineTo(x, 228); c.closePath(); c.fill();
        });
        // derecha: navegación / mensajes
        c.textAlign = 'left';
        if (est.instruccion && est.instruccion.giro === 'pista') {
            c.fillStyle = '#e65100'; c.fillRect(360, 18, 262, 150);
            c.fillStyle = '#fff'; c.font = 'bold 22px Arial';
            const pal = est.instruccion.texto.split(' '); let lin = '', y = 48;
            pal.forEach(p => { const t = lin ? lin + ' ' + p : p; if (c.measureText(t).width > 240) { c.fillText(lin, 372, y); y += 27; lin = p; } else lin = t; });
            if (lin) c.fillText(lin, 372, y);
        } else if (est.instruccion) {
            c.fillStyle = '#1565c0'; c.fillRect(360, 18, 262, 150);
            if (['derecha', 'izquierda', 'recto'].includes(est.instruccion.giro)) dibujarFlecha(c, est.instruccion.giro, 420, 90, 90);
            else if (est.instruccion.giro === 'glorieta') {
                c.strokeStyle = '#fff'; c.lineWidth = 9; c.beginPath(); c.arc(420, 92, 30, 0.6, Math.PI * 2 - 0.2); c.stroke();
                c.fillStyle = '#fff'; c.font = 'bold 40px Arial'; c.textAlign = 'center'; c.fillText(String(est.instruccion.salida || ''), 420, 106); c.textAlign = 'left';
            }
            else { c.fillStyle = '#00e676'; c.font = 'bold 60px Arial'; c.fillText('P', 400, 92); }
            c.fillStyle = '#fff'; c.font = 'bold 36px Arial';
            if (est.instruccion.dist != null) c.fillText(`${Math.round(est.instruccion.dist)} m`, 486, 70);
            c.font = '20px Arial'; c.fillStyle = '#e3f2fd';
            const tx = est.instruccion.giro === 'glorieta' ? `Glorieta: ${est.instruccion.salida}ª salida` : est.instruccion.giro === 'parar' ? 'Para a la derecha' : est.instruccion.giro === 'derecha' ? 'Gira a la derecha' : est.instruccion.giro === 'izquierda' ? 'Gira a la izquierda' : est.instruccion.giro === 'fin' ? 'Examen terminado' : 'Sigue recto';
            c.fillText(tx, 480, 118);
        } else {
            c.fillStyle = '#9fb3c8'; c.font = 'bold 22px Arial'; c.fillText('CONDUCCIÓN LIBRE', 372, 60);
        }
        c.font = 'bold 20px Arial';
        c.fillStyle = '#ff8a80'; c.fillText(`E ${est.faltas.eliminatoria}`, 372, 198);
        c.fillStyle = '#ffcc80'; c.fillText(`D ${est.faltas.deficiente}`, 452, 198);
        c.fillStyle = '#fff59d'; c.fillText(`L ${est.faltas.leve}`, 532, 198);
        if (mensajePanel && mensajePanel.hasta > tiempo) {
            c.fillStyle = mensajePanel.color; c.font = 'bold 22px Arial';
            const t = mensajePanel.texto.length > 34 ? mensajePanel.texto.slice(0, 33) + '…' : mensajePanel.texto;
            c.fillText(t, 360, 240);
        }
        texPanel.needsUpdate = true;
    }

    // ═══════════════ MINIMAPA ═══════════════
    const mm = op.minimapa || null;
    let fondoMM = null;
    const MM_MIN = X_MIN - 10, MM_TAM = X_MAX - X_MIN + 20;
    function prepararMinimapa() {
        if (!mm) return;
        fondoMM = document.createElement('canvas'); fondoMM.width = mm.width; fondoMM.height = mm.height;
        const c = fondoMM.getContext('2d'), k = mm.width / MM_TAM;
        c.fillStyle = 'rgba(30,38,48,0.92)'; c.fillRect(0, 0, mm.width, mm.height);
        c.fillStyle = '#8a929c';
        Object.values(MAPA.aristas).forEach(e => {
            const [x0, x1, z0, z1] = e.eje === 'x' ? [e.ini, e.fin, e.centro - e.half, e.centro + e.half] : [e.centro - e.half, e.centro + e.half, e.ini, e.fin];
            c.fillStyle = e.residencial ? '#c4a47c' : e.sentido ? '#6f8fa8' : '#8a929c';
            c.fillRect((x0 - MM_MIN) * k, (z0 - MM_MIN) * k, (x1 - x0) * k, (z1 - z0) * k);
        });
        c.fillStyle = '#8a929c'; c.beginPath(); c.arc((GX - MM_MIN) * k, (GZ - MM_MIN) * k, R_EXT * k, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#5f9d43'; c.beginPath(); c.arc((GX - MM_MIN) * k, (GZ - MM_MIN) * k, R_ISLA * k, 0, Math.PI * 2); c.fill();
        Object.values(MAPA.cruces).forEach(cr => {
            if (cr.glorieta) return;
            c.fillStyle = cr.semaforo ? '#a5d6a7' : '#8a929c';
            c.fillRect((cr.x - cr.hx - MM_MIN) * k, (cr.z - cr.hz - MM_MIN) * k, cr.hx * 2 * k, cr.hz * 2 * k);
        });
    }
    prepararMinimapa();
    function dibujarMinimapa() {
        if (!mm || !fondoMM) return;
        const c = mm.getContext('2d'), k = mm.width / MM_TAM;
        const P = (x, z) => [(x - MM_MIN) * k, (z - MM_MIN) * k];
        c.drawImage(fondoMM, 0, 0);
        if (examen && !examen.terminado && examen.destino) {
            c.strokeStyle = '#ffd600'; c.lineWidth = 3; c.lineJoin = 'round';
            c.beginPath(); c.moveTo(...P(jug.x, jug.z));
            examen.pasos.slice(examen.k).forEach(p => { const cr = MAPA.cruces[p.key]; c.lineTo(...P(cr.x, cr.z)); });
            const de = MAPA.aristas[examen.destino.arista];
            const [dx, dz] = puntoEn(de, examen.destino.d, examen.destino.along, 0);
            c.lineTo(...P(dx, dz)); c.stroke();
            c.fillStyle = '#00e676'; c.beginPath(); c.arc(...P(dx, dz), 5, 0, Math.PI * 2); c.fill();
        }
        c.fillStyle = '#eceff1';
        ia.forEach(o => { const [x, z] = P(o.x, o.z); c.fillRect(x - 1.5, z - 1.5, 3, 3); });
        const [x, z] = P(jug.x, jug.z);
        c.save(); c.translate(x, z); c.rotate(-jug.yaw);
        c.fillStyle = '#ff1744'; c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 5); c.lineTo(-5, 5); c.closePath(); c.fill();
        c.restore();
    }

    const reloj = new THREE.Clock();
    let acumEstado = 0, ultimoInter = 0;
    /** Semáforo al que te acercas (a menos de 60 m): para la ayuda del panel. */
    function semaforoProximo() {
        if (!jug.tramo || jug.cruce) return null;
        const e = MAPA.aristas[jug.tramo.arista], d = jug.tramo.d;
        if (!permite(e, d)) return null;
        const c = MAPA.cruces[finDe(e, d)];
        if (c.control[d] !== 'semaforo') return null;
        const dist = (alongFin(e, d) - (e.eje === 'x' ? jug.x : jug.z)) * signoDe(d);
        return dist > -1 && dist < 60 ? luz(c, d, tiempo).estado : null;
    }
    function estadoActual() {
        const e = jug.tramo ? MAPA.aristas[jug.tramo.arista] : null;
        const cal = calificar(faltas);
        return {
            kmh: Math.round(Math.abs(jug.v) * 3.6), limite: e ? e.limite : null, marcha: jug.marcha, cinturon: jug.cinturon,
            cambio: manual ? 'manual' : 'auto', rpm: manual ? Math.round(motorM.rpm / 100) * 100 : null, calado: motorM.calado, consejoMarcha: manual ? consejoMarcha() : null,
            embraguePedal, embrague: embraguePedal ? Math.round(motorM.embrague * 10) / 10 : null,
            intermitente: jug.intermitente, instruccion: textoInstruccion(), faltas: { eliminatoria: cal.eliminatoria, deficiente: cal.deficiente, leve: cal.leve },
            vista, enVR, carton, recorrido: Math.round(jug.recorrido), tiempo: Math.round(tiempo), vehiculo: esMoto ? 'moto' : 'coche', semaforo: semaforoProximo(),
        };
    }

    // ═══════════════ SONIDO (motor + intermitente) ═══════════════
    const audio = { ctx: null, on: op.sonido !== false };
    function iniciarAudio() {
        if (audio.ctx || !audio.on) return;
        try {
            const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
            const ctx = new AC();
            const filtro = ctx.createBiquadFilter(); filtro.type = 'lowpass'; filtro.frequency.value = 520; filtro.Q.value = 2;
            const gan = ctx.createGain(); gan.gain.value = 0;
            const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
            const o2 = ctx.createOscillator(); o2.type = 'square';
            const g2 = ctx.createGain(); g2.gain.value = 0.35;
            o1.connect(filtro); o2.connect(g2); g2.connect(filtro); filtro.connect(gan); gan.connect(ctx.destination);
            o1.start(); o2.start();
            Object.assign(audio, { ctx, o1, o2, gan, filtro });
        } catch { /* sin audio */ }
    }
    function sonidoMotor(acel) {
        if (!audio.ctx || !audio.on) return;
        const kmh = Math.abs(jug.v) * 3.6;
        const cambios = [0, 18, 34, 52, 75];
        let marcha = 0; while (marcha < cambios.length - 1 && kmh > cambios[marcha + 1]) marcha++;
        const tramo = (kmh - cambios[marcha]) / ((cambios[marcha + 1] || 110) - cambios[marcha]);
        const rpm = manual ? Math.max(motorM.rpm * 0.62, 500) : 850 + clamp(tramo, 0, 1) * 2600 + acel * 400;
        if (manual && motorM.calado) { audio.gan.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.05); return; }
        const f = (rpm / 60) * (esMoto ? 1.6 : 2); // coche: 4 cilindros; moto: más aguda
        const t = audio.ctx.currentTime;
        audio.o1.frequency.setTargetAtTime(f, t, 0.08);
        audio.o2.frequency.setTargetAtTime(f / 2, t, 0.08);
        audio.filtro.frequency.setTargetAtTime(380 + acel * 700 + kmh * 6, t, 0.1);
        audio.gan.gain.setTargetAtTime(pausado ? 0 : 0.035 + acel * 0.05, t, 0.1);
    }
    function tic() {
        if (!audio.ctx) return;
        const ctx = audio.ctx, o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'square'; o.frequency.value = 1800; g.gain.value = 0.05;
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.04);
        o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.05);
    }
    function claxon() {
        if (!audio.ctx || !audio.on) return;
        const ctx = audio.ctx, g = ctx.createGain(); g.gain.value = 0.06; g.connect(ctx.destination);
        [415, 523].forEach(f => { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f; o.connect(g); o.start(); o.stop(ctx.currentTime + 0.45); });
        g.gain.setTargetAtTime(0, ctx.currentTime + 0.4, 0.03);
    }
    const despertarAudio = () => { iniciarAudio(); audio.ctx?.resume?.(); };
    window.addEventListener('keydown', despertarAudio);
    window.addEventListener('pointerdown', despertarAudio);
    aLimpiar.push(() => { window.removeEventListener('keydown', despertarAudio); window.removeEventListener('pointerdown', despertarAudio); try { audio.ctx?.close(); } catch { /* */ } });

    // ═══════════════ BUCLE ═══════════════
    let cabeceo = 0, vAnterior = 0;
    function simular(dt) {
        tiempo += dt;
        const ent = entradas();
        fisica(dt, ent);
        seguimiento(dt);
        const otros = [...ia, infoJugador()];
        ia.forEach(c => actualizarIA(c, dt, otros));
        actualizarPeatones(dt);
        actualizarSemaforos(tiempo);
        revisarExamen();
        // inercia: el coche cabecea al frenar y acelerar
        const acc = (jug.v - vAnterior) / Math.max(dt, 1e-3); vAnterior = jug.v;
        cabeceo += (clamp(acc, -9, 4) * 0.0045 - cabeceo) * Math.min(1, dt * 6);
        jugGrupo.position.set(jug.x, 0, jug.z); if (esMoto) { const curv = Math.tan(jug.steer) / L_EJES; ladeo += (clamp(Math.atan((jug.v * jug.v * curv) / 9.8), -0.75, 0.75) - ladeo) * Math.min(1, dt * 5); }
        jugGrupo.rotation.set(enVR ? 0 : cabeceo, jug.yaw, esMoto && !enVR ? -ladeo : 0, 'YXZ');
        if (esMoto) volante.rotation.y = -jug.steer * 1.3; else volante.rotation.z = -jug.steer * 4;
        matFreno.emissive.setHex(ent.freno > 0.1 ? 0xff1a1a : 0x3a0000);
        const fase = Math.floor(tiempo * 2.5), on = !!jug.intermitente && fase % 2 === 0;
        intermitentes.izq.forEach(b => { b.visible = on && jug.intermitente === 'izq'; });
        intermitentes.der.forEach(b => { b.visible = on && jug.intermitente === 'der'; });
        if (jug.intermitente && fase !== ultimoInter) { ultimoInter = fase; tic(); cb.onTic?.(); }
        if (examen && destinoMesh.visible) destinoMesh.rotation.y += dt;
        sonidoMotor(ent.acel);
    }
    function renderizar(dt) {
        actualizarCamara(dt);
        // sol y cielo siguen al coche (sombras nítidas cerca)
        sol.target.position.set(jug.x, 0, jug.z); sol.position.copy(sol.target.position).add(OFFSET_SOL);
        cielo.position.set(jug.x, 0, jug.z);
        // espejos (cada 2 fotogramas, solo en cabina)
        if (op.espejos !== false && interior.visible && (++frameEspejo % (esMovil ? 3 : 2) === 0)) {
            const xr = renderer.xr.enabled; renderer.xr.enabled = false;
            const sombras = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false;
            espejos.forEach(({ rt, cam }) => { renderer.setRenderTarget(rt); renderer.render(escena, cam); });
            renderer.setRenderTarget(null); renderer.xr.enabled = xr; renderer.shadowMap.autoUpdate = sombras;
        }
        acumEstado += dt;
        if (acumEstado > 0.12) {
            acumEstado = 0;
            const est = estadoActual();
            dibujarPanel(est);
            dibujarMinimapa();
            cb.onEstado?.(est);
        }
        if (carton && !enVR) estereo.render(escena, camara);
        else renderer.render(escena, camara);
    }
    function tick() {
        const dt = Math.min(reloj.getDelta(), 0.05);
        if (!pausado) simular(dt);
        renderizar(dt);
    }
    renderer.setAnimationLoop(tick);

    // Arranque del examen
    jug.tramo = { arista: inicio.arista.id, d: 'E', tVel: 0, tVelG: 0, multaVel: false, multaVelG: false, tCarril: 0, prevAlong: px0 };
    if (pista) {
        jug.tramo = null;
        setTimeout(() => cb.onVoz?.('Prueba de pista. Abróchese el casco. Primer ejercicio: slalom entre los conos.'), 600);
    } else if (examen) {
        nuevaRuta(7);
        setTimeout(() => cb.onVoz?.('Buenos días. Abróchese el cinturón y, cuando esté preparado, inicie la marcha y siga mis indicaciones.'), 600);
    } else {
        aviso(esMoto ? 'Abróchate el casco (C) antes de arrancar' : 'Abróchate el cinturón (C) antes de arrancar');
    }

    // ── Redimensionar ──
    const onResize = () => {
        if (renderer.xr.isPresenting) return;
        const w = ancho(), h = alto();
        camara.aspect = w / h; if (camara.parent === cabeza) camara.fov = fovCabina(); camara.updateProjectionMatrix();
        renderer.setSize(w, h); estereo.setSize(w, h);
    };
    const ro = new ResizeObserver(onResize); ro.observe(contenedor);
    window.addEventListener('orientationchange', onResize);
    aLimpiar.push(() => { ro.disconnect(); window.removeEventListener('orientationchange', onResize); });

    // ── XR ──
    const onXRStart = () => { enVR = true; aplicarVista(); cb.onVR?.(true); };
    const onXREnd = () => { enVR = false; aplicarVista(); onResize(); cb.onVR?.(false); };
    renderer.xr.addEventListener('sessionstart', onXRStart);
    renderer.xr.addEventListener('sessionend', onXREnd);
    aLimpiar.push(() => { renderer.xr.removeEventListener('sessionstart', onXRStart); renderer.xr.removeEventListener('sessionend', onXREnd); });

    // ═══════════════ API ═══════════════
    function setIntermitente(lado) { jug.intermitente = lado; }
    function alternarCinturon() {
        jug.cinturon = !jug.cinturon;
        aviso(esMoto ? (jug.cinturon ? 'Casco abrochado' : 'Te has quitado el casco') : (jug.cinturon ? 'Cinturón abrochado' : 'Te has quitado el cinturón'));
        if (!jug.cinturon && Math.abs(jug.v) > 0.5) falta(esMoto ? 'CASCO' : 'CINTURON');
    }
    const NOMBRE_MARCHA = { R: 'Marcha atrás (R)', N: 'Punto muerto (N)', D: 'Marcha adelante (D)', 1: '1.ª', 2: '2.ª', 3: '3.ª', 4: '4.ª', 5: '5.ª' };
    function ponerMarcha(g) {
        if (g === jug.marcha) return;
        if (g === 'R' && Math.abs(jug.v) > 0.4) { aviso(`Detén ${esMoto ? 'la moto' : 'el coche'} antes de meter la marcha atrás`); return; }
        if (jug.marcha === 'R' && g !== 'N' && jug.v < -0.4) { aviso(`Detén ${esMoto ? 'la moto' : 'el coche'} antes de cambiar de marcha`); return; }
        if (!manual && Math.abs(jug.v) > 0.4) { aviso(`Detén ${esMoto ? 'la moto' : 'el coche'} antes de cambiar de marcha`); return; }
        if (embraguePedal && !motorM.calado && motorM.embrague < 0.6) { aviso('¡Crrr! Pisa el embrague a fondo para cambiar de marcha'); return; }
        const d = datoMarcha(g);
        if (d && jug.v * 3.6 > d.max * 1.03) { aviso(`Vas demasiado rápido para meter la ${NOMBRE_MARCHA[g]}`); return; }
        jug.marcha = g;
        motorM.tBajo = 0; motorM.tAlto = 0; motorM.tForzado = 0;
        aviso(NOMBRE_MARCHA[g]);
        cb.onEstado?.(estadoActual());
    }
    function alternarMarcha() {
        if (manual) ponerMarcha(jug.marcha === 'R' ? 'N' : 'R');
        else ponerMarcha(jug.marcha === 'D' ? 'R' : 'D');
    }
    function subirMarcha() {
        if (!manual) { ponerMarcha('D'); return; }
        const i = MARCHAS.indexOf(jug.marcha);
        if (i < MARCHAS.length - 1) ponerMarcha(MARCHAS[i + 1]);
    }
    function bajarMarcha() {
        if (!manual) { ponerMarcha('R'); return; }
        const i = MARCHAS.indexOf(jug.marcha);
        if (i > 0) ponerMarcha(MARCHAS[i - 1]);
    }
    // Consejo para el panel: 'subir' | 'bajar' | null
    function consejoMarcha() {
        const d = datoMarcha(jug.marcha); if (!d || motorM.calado) return null;
        const kmh = Math.max(0, jug.v) * 3.6;
        if (kmh > d.max * 0.9 && jug.marcha !== '5') return 'subir';
        if (kmh < d.baja && jug.marcha !== '1' && jug.v > 0.3) return 'bajar';
        return null;
    }
    function cambiarCampo() {
        campo = (campo + 1) % CAMPOS.length;
        if (camara.parent === cabeza) { camara.fov = fovCabina(); camara.updateProjectionMatrix(); }
        aviso(`Campo de visión: ${CAMPOS[campo]}°`);
    }
    function alternarCamara() { vista = vista === 'cabina' ? 'exterior' : 'cabina'; mirada.objYaw = 0; mirada.objPitch = 0; aplicarVista(); cb.onEstado?.(estadoActual()); }
    function resumen() {
        const cal = calificar(faltas);
        return {
            modo: op.modo, faltas: faltas.slice(), ...cal, recorrido: Math.round(jug.recorrido), tiempo: Math.round(tiempo),
            completado: !!examen?.terminado || !!pista?.terminado, vehiculo: esMoto ? 'moto' : 'coche', crucesHechos: examen ? examen.k : null, crucesTotal: examen ? examen.pasos.length : null,
        };
    }

    return {
        setEntradaTactil(o) { Object.assign(tactil, o); },
        setCamara(m) { vista = m; aplicarVista(); },
        alternarCamara, alternarCinturon, alternarMarcha, subirMarcha, bajarMarcha, ponerMarcha, cambiarCampo,
        setEntradaExterna(o) { Object.assign(externa, o); },
        setEmbraguePedal(on) { if (!manual) return false; if (embraguePedal !== !!on) { embraguePedal = !!on; aviso(on ? 'Embrague con pedal activado' : 'Embrague automático'); } return true; },
        setIntermitente(l) { setIntermitente(jug.intermitente === l ? null : l); },
        async soportaVR() { try { return !!(navigator.xr && await navigator.xr.isSessionSupported('immersive-vr')); } catch { return false; } },
        async entrarVR() {
            const ses = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
            await renderer.xr.setSession(ses);
        },
        salirVR() { renderer.xr.getSession?.()?.end(); },
        setCarton(on) { carton = !!on; activarOrient(carton); activarMotion(carton); aplicarVista(); onResize(); },
        setInclinacion(on, invertir = false) { inclinacion.activa = !!on; inclinacion.invertir = !!invertir; activarMotion(on); },
        recentrar() { orient.alpha0 = orient.alpha; mirada.objYaw = 0; mirada.objPitch = 0; },
        setMirarRaton(on) { mirada.raton = !!on; mirada.objYaw = 0; mirada.objPitch = 0; },
        pausar(b) { pausado = !!b; reloj.getDelta(); },
        resumen,
        estado: estadoActual,
        destruir() {
            renderer.setAnimationLoop(null);
            try { renderer.xr.getSession?.()?.end(); } catch { /* */ }
            aLimpiar.forEach(f => { try { f(); } catch { /* */ } });
            escena.traverse(o => {
                if (o.geometry) o.geometry.dispose();
                const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
                ms.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
            });
            Object.values(texSem).forEach(t => t.dispose());
            texturasSenal.forEach(t => t.dispose());
            renderer.dispose();
            renderer.domElement.remove();
        },
        setSonido(on) { audio.on = !!on; if (audio.gan) audio.gan.gain.value = 0; if (!on && audio.ctx) audio.ctx.suspend(); else if (on) despertarAudio(); },
        _depurar: () => ({ jug, motorM, ia, peatones, faltas, examen, MAPA, tactil, tiempo: () => tiempo, escena, camara, jugGrupo }),
        _paso(dt, n = 1) { for (let k = 0; k < n; k++) simular(dt); },
        _render() { renderizar(0.016); },
    };
}
