// esculturaMotor.js — Motor de escultura por vóxeles para el Taller de Escultura 3D.
//
// La pieza es un CAMPO de densidad en una rejilla N³ (positivo = hay material,
// negativo = aire, la superficie es el nivel 0). Esculpir es modificar ese campo
// con la forma de la herramienta (restar, sumar, suavizar, aplanar). La superficie
// visible se reconstruye con «surface nets» por trozos de 16³ celdas y solo se
// rehacen los trozos que la herramienta ha tocado.
import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';

const CL = 3;              // tope del campo, en vóxeles
const C = 16;              // celdas por trozo de malla
const B = 16;              // muestras por lado de cada bloque de deshacer
const MAX_DESHACER = 25;

/* ═══════════════════ RUIDO (para el aspecto de los materiales) ═══════════════════ */

function hash3(x, y, z) {
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1440662683);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}
function ruido(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    let u = x - xi, v = y - yi, w = z - zi;
    u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v); w = w * w * (3 - 2 * w);
    const a = hash3(xi, yi, zi),         b = hash3(xi + 1, yi, zi);
    const c = hash3(xi, yi + 1, zi),     d = hash3(xi + 1, yi + 1, zi);
    const e = hash3(xi, yi, zi + 1),     f = hash3(xi + 1, yi, zi + 1);
    const g = hash3(xi, yi + 1, zi + 1), h = hash3(xi + 1, yi + 1, zi + 1);
    const x1 = a + (b - a) * u, x2 = c + (d - c) * u, x3 = e + (f - e) * u, x4 = g + (h - g) * u;
    const y1 = x1 + (x2 - x1) * v, y2 = x3 + (x4 - x3) * v;
    return y1 + (y2 - y1) * w;
}
const fbm = (x, y, z) => ruido(x, y, z) * 0.5 + ruido(x * 2.03, y * 2.03, z * 2.03) * 0.3 + ruido(x * 4.1, y * 4.1, z * 4.1) * 0.2;
const lin = c => Math.pow(c, 2.2);           // los colores de vértice van en espacio lineal
const mezcla = (a, b, t) => a + (b - a) * t;

/* ═══════════════════ MATERIALES ═══════════════════ */

export const MATERIALES = {
    MADERA: {
        nombre: 'Madera', emoji: '🪵', dureza: 1.6, rugosidad: 0.72, chispa: 0xc89a66,
        desc: 'Se talla con paciencia; al quitar capas aparecen los anillos del tronco.',
        color(x, y, z, out) {
            const n = fbm(x * 14, y * 3, z * 14);
            const r = Math.hypot(x, z) * 95 + n * 3.2;
            const anillo = Math.pow(0.5 + 0.5 * Math.sin(r * Math.PI * 2), 3);
            const veta = (ruido(x * 260, y * 9, z * 260) - 0.5) * 0.08;
            const t = anillo * 0.75 + veta;
            out[0] = lin(mezcla(0.86, 0.6, t)); out[1] = lin(mezcla(0.67, 0.4, t)); out[2] = lin(mezcla(0.45, 0.23, t));
        },
    },
    MARMOL: {
        nombre: 'Mármol', emoji: '🏛️', dureza: 3.0, rugosidad: 0.32, chispa: 0xeeeeee,
        desc: 'Muy duro: cada golpe quita poco. Tiene vetas grises en todo su interior.',
        color(x, y, z, out) {
            const s = Math.sin((x * 16 + y * 11 + z * 8 + fbm(x * 9, y * 9, z * 9) * 5.5) * Math.PI);
            const veta = Math.pow(1 - Math.abs(s), 9);
            const g = (ruido(x * 120, y * 120, z * 120) - 0.5) * 0.04;
            out[0] = lin(mezcla(0.93, 0.45, veta) + g); out[1] = lin(mezcla(0.92, 0.47, veta) + g); out[2] = lin(mezcla(0.9, 0.52, veta) + g);
        },
    },
    ARCILLA: {
        nombre: 'Arcilla', emoji: '🟤', dureza: 0.6, rugosidad: 0.88, chispa: 0xb0694a,
        desc: 'Blanda: se quita fácil y es el único material al que se le puede AÑADIR.',
        color(x, y, z, out) {
            const n = (fbm(x * 40, y * 40, z * 40) - 0.5) * 0.12;
            out[0] = lin(0.71 + n); out[1] = lin(0.43 + n * 0.8); out[2] = lin(0.31 + n * 0.6);
        },
    },
    JABON: {
        nombre: 'Jabón', emoji: '🧼', dureza: 0.35, rugosidad: 0.5, chispa: 0x9fdcc4,
        desc: 'El más blando de todos: ideal para practicar.',
        color(x, y, z, out) {
            const n = (ruido(x * 30, y * 30, z * 30) - 0.5) * 0.06;
            out[0] = lin(0.62 + n); out[1] = lin(0.86 + n); out[2] = lin(0.76 + n);
        },
    },
};

export const FORMAS = [
    { id: 'BLOQUE', nombre: 'Bloque', emoji: '🧱' },
    { id: 'TRONCO', nombre: 'Tronco (cilindro)', emoji: '🪵' },
    { id: 'ESFERA', nombre: 'Esfera', emoji: '⚪' },
    { id: 'BOLA',   nombre: 'Bola pequeña (para modelar)', emoji: '🟠' },
];

export const HERRAMIENTAS = [
    { id: 'GUBIA',   nombre: 'Gubia',          emoji: '🥄', desc: 'Vacía material en forma de cuchara.' },
    { id: 'CINCEL',  nombre: 'Cincel',         emoji: '🔨', desc: 'Golpes que arrancan lascas poco profundas.' },
    { id: 'TALADRO', nombre: 'Taladro',        emoji: '🪛', desc: 'Abre agujeros; mantén pulsado para ir más hondo.' },
    { id: 'APLANAR', nombre: 'Cepillo',        emoji: '🪚', desc: 'Aplana la superficie que tocas.' },
    { id: 'LIJA',    nombre: 'Lija',           emoji: '🧽', desc: 'Suaviza y redondea las aristas.' },
    { id: 'ARCILLA', nombre: 'Añadir arcilla', emoji: '🤏', desc: 'Pega material nuevo (solo en arcilla).' },
];

function sdfForma(forma, x, y, z, t) {
    if (forma === 'TRONCO') {
        const dx = Math.hypot(x, z) - t * 0.45, dy = Math.abs(y) - t / 2;
        return Math.min(Math.max(dx, dy), 0) + Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
    }
    if (forma === 'ESFERA') return Math.hypot(x, y, z) - t / 2;
    if (forma === 'BOLA') return Math.hypot(x, y + t * 0.28, z) - t * 0.2;
    const rr = t * 0.03, a = t / 2 - rr;
    const qx = Math.abs(x) - a, qy = Math.abs(y) - a, qz = Math.abs(z) - a;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - rr;
}

// 12 aristas de una celda: índices de esquina (bit0 = x, bit1 = y, bit2 = z)
const ARISTAS = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];

/* ═══════════════════ MOTOR ═══════════════════ */

export class MotorEscultura {
    /** @param {{N?:number, tam?:number, material?:string, forma?:string}} opts  tam = lado de la pieza en metros */
    constructor(opts = {}) {
        this.tam = opts.tam || 0.3;
        this.material = opts.material || 'MADERA';
        this.grupo = new THREE.Group();
        this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: MATERIALES[this.material].rugosidad, metalness: 0 });
        this.mallas = new Map();
        this.sucios = new Set();
        this.reiniciar(opts.N || 96, opts.forma || 'BLOQUE');
    }

    reiniciar(N, forma) {
        for (const m of this.mallas.values()) { m.geometry.dispose(); this.grupo.remove(m); }
        this.mallas.clear();
        this.sucios.clear();
        this.N = N;
        this.forma = forma;
        this.L = this.tam * 1.3;                 // margen para poder añadir arcilla
        this.h = this.L / (N - 1);
        this.c = (N - 1) / 2;
        this.K = Math.ceil((N - 1) / C);
        this.nb = Math.ceil(N / B);
        const f = this.f = new Float32Array(N * N * N);
        const { h, c, tam } = this;
        for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
            const i = x + N * (y + N * z);
            if (x === 0 || y === 0 || z === 0 || x === N - 1 || y === N - 1 || z === N - 1) { f[i] = -CL; continue; }
            const d = sdfForma(forma, (x - c) * h, (y - c) * h, (z - c) * h, tam) / h;
            f[i] = Math.max(-CL, Math.min(CL, -d));
        }
        this.pilaDeshacer = [];
        this.pilaRehacer = [];
        this.trazo = null;
        this.vol0 = this.volumen();
        this.construirTodo();
    }

    setMaterial(id) {
        if (!MATERIALES[id]) return;
        this.material = id;
        this.mat.roughness = MATERIALES[id].rugosidad;
        this.construirTodo();
    }

    get dureza() { return MATERIALES[this.material].dureza; }

    /* ---------- muestreo del campo (coordenadas locales en metros) ---------- */

    muestra(px, py, pz) {
        const { N, f, h, c } = this;
        const lim = N - 1.001;
        const gx = Math.min(lim, Math.max(0, px / h + c));
        const gy = Math.min(lim, Math.max(0, py / h + c));
        const gz = Math.min(lim, Math.max(0, pz / h + c));
        const x = gx | 0, y = gy | 0, z = gz | 0;
        const u = gx - x, v = gy - y, w = gz - z;
        const NN = N * N, i = x + N * y + NN * z;
        const c00 = f[i] + (f[i + 1] - f[i]) * u;
        const c10 = f[i + N] + (f[i + N + 1] - f[i + N]) * u;
        const c01 = f[i + NN] + (f[i + NN + 1] - f[i + NN]) * u;
        const c11 = f[i + NN + N] + (f[i + NN + N + 1] - f[i + NN + N]) * u;
        const a = c00 + (c10 - c00) * v, b = c01 + (c11 - c01) * v;
        return a + (b - a) * w;
    }

    /** Normal hacia fuera (−∇f) en un punto local. */
    normal(p, out = new THREE.Vector3()) {
        const e = this.h;
        out.set(
            this.muestra(p.x - e, p.y, p.z) - this.muestra(p.x + e, p.y, p.z),
            this.muestra(p.x, p.y - e, p.z) - this.muestra(p.x, p.y + e, p.z),
            this.muestra(p.x, p.y, p.z - e) - this.muestra(p.x, p.y, p.z + e),
        );
        if (out.lengthSq() < 1e-10) out.set(0, 1, 0);
        return out.normalize();
    }

    /** Lanza un rayo (local) contra la superficie. Devuelve {punto, normal, t} o null. */
    rayo(o, d) {
        const half = this.c * this.h - this.h;
        let t0 = 0, t1 = Infinity;
        for (const k of ['x', 'y', 'z']) {
            if (Math.abs(d[k]) < 1e-9) { if (o[k] < -half || o[k] > half) return null; continue; }
            let a = (-half - o[k]) / d[k], b = (half - o[k]) / d[k];
            if (a > b) [a, b] = [b, a];
            t0 = Math.max(t0, a); t1 = Math.min(t1, b);
            if (t0 > t1) return null;
        }
        const paso = this.h * 0.6;
        let tPrev = t0;
        for (let t = t0; t <= t1; t += paso) {
            if (this.muestra(o.x + d.x * t, o.y + d.y * t, o.z + d.z * t) > 0) {
                let a = tPrev, b = t;
                for (let k = 0; k < 7; k++) {
                    const m = (a + b) / 2;
                    if (this.muestra(o.x + d.x * m, o.y + d.y * m, o.z + d.z * m) > 0) b = m; else a = m;
                }
                const punto = new THREE.Vector3(o.x + d.x * b, o.y + d.y * b, o.z + d.z * b);
                return { punto, normal: this.normal(punto), t: b };
            }
            tPrev = t;
        }
        return null;
    }

    volumen() {
        const f = this.f;
        let s = 0;
        for (let i = 0; i < f.length; i++) {
            const v = f[i] + 0.5;
            s += v <= 0 ? 0 : v >= 1 ? 1 : v;
        }
        return s * this.h ** 3;
    }

    /* ---------- deshacer / rehacer por bloques ---------- */

    _copiarBloque(bx, by, bz) {
        const { N, f } = this;
        const out = new Float32Array(B * B * B);
        for (let dz = 0; dz < B; dz++) {
            const z = bz * B + dz; if (z >= N) break;
            for (let dy = 0; dy < B; dy++) {
                const y = by * B + dy; if (y >= N) break;
                for (let dx = 0; dx < B; dx++) {
                    const x = bx * B + dx; if (x >= N) break;
                    out[dx + B * (dy + B * dz)] = f[x + N * (y + N * z)];
                }
            }
        }
        return out;
    }

    _restaurarBloque(bx, by, bz, dat) {
        const { N, f } = this;
        for (let dz = 0; dz < B; dz++) {
            const z = bz * B + dz; if (z >= N) break;
            for (let dy = 0; dy < B; dy++) {
                const y = by * B + dy; if (y >= N) break;
                for (let dx = 0; dx < B; dx++) {
                    const x = bx * B + dx; if (x >= N) break;
                    f[x + N * (y + N * z)] = dat[dx + B * (dy + B * dz)];
                }
            }
        }
        const x0 = bx * B, y0 = by * B, z0 = bz * B;
        this._marcar(x0, Math.min(N - 1, x0 + B - 1), y0, Math.min(N - 1, y0 + B - 1), z0, Math.min(N - 1, z0 + B - 1));
    }

    /** Copia el bloque de la muestra (x,y,z) la primera vez que el trazo actual lo modifica. */
    _guardar(x, y, z) {
        const bx = (x / B) | 0, by = (y / B) | 0, bz = (z / B) | 0;
        const k = bx + this.nb * (by + this.nb * bz);
        if (!this.trazo.has(k)) this.trazo.set(k, this._copiarBloque(bx, by, bz));
    }

    iniciarTrazo() { this.trazo = new Map(); }

    terminarTrazo() {
        if (this.trazo?.size) {
            this.pilaDeshacer.push(this.trazo);
            if (this.pilaDeshacer.length > MAX_DESHACER) this.pilaDeshacer.shift();
            this.pilaRehacer = [];
        }
        this.trazo = null;
    }

    _intercambiar(origen, destino) {
        const ent = origen.pop();
        if (!ent) return false;
        const nb = this.nb, inv = new Map();
        for (const [k, dat] of ent) {
            const bx = k % nb, by = Math.floor(k / nb) % nb, bz = Math.floor(k / (nb * nb));
            inv.set(k, this._copiarBloque(bx, by, bz));
            this._restaurarBloque(bx, by, bz, dat);
        }
        destino.push(inv);
        return true;
    }
    deshacer() { this.trazo = null; return this._intercambiar(this.pilaDeshacer, this.pilaRehacer); }
    rehacer()  { this.trazo = null; return this._intercambiar(this.pilaRehacer, this.pilaDeshacer); }

    /* ---------- herramientas ---------- */

    _caja(cx, cy, cz, ex, ey = ex, ez = ex) {
        const { N, h, c } = this;
        return [
            Math.max(1, Math.floor((cx - ex) / h + c)), Math.min(N - 2, Math.ceil((cx + ex) / h + c)),
            Math.max(1, Math.floor((cy - ey) / h + c)), Math.min(N - 2, Math.ceil((cy + ey) / h + c)),
            Math.max(1, Math.floor((cz - ez) / h + c)), Math.min(N - 2, Math.ceil((cz + ez) / h + c)),
        ];
    }

    /** Lleva el campo hacia min(f, sdf) (quitar) o max(f, −sdf) (añadir) con velocidad k. */
    _tallar(caja, sdf, k, sumar) {
        const [x0, x1, y0, y1, z0, z1] = caja;
        if (x0 > x1 || y0 > y1 || z0 > z1) return 0;
        const { N, h, c, f, trazo } = this;
        let cambio = 0;
        for (let z = z0; z <= z1; z++) {
            const pz = (z - c) * h;
            for (let y = y0; y <= y1; y++) {
                const py = (y - c) * h;
                let i = x0 + N * (y + N * z);
                for (let x = x0; x <= x1; x++, i++) {
                    const g = sdf((x - c) * h, py, pz) / h;
                    const v = f[i];
                    const obj = sumar ? Math.max(v, Math.min(CL, -g)) : Math.min(v, Math.max(-CL, g));
                    if (obj !== v) {
                        if (trazo) this._guardar(x, y, z);
                        const nv = v + (obj - v) * k;
                        f[i] = nv;
                        cambio += Math.abs(nv - v);
                    }
                }
            }
        }
        this._marcar(x0, x1, y0, y1, z0, z1);
        return cambio;
    }

    _suavizar(p, r, k) {
        const caja = this._caja(p.x, p.y, p.z, r);
        const [x0, x1, y0, y1, z0, z1] = caja;
        const { N, h, c, f, trazo } = this, NN = N * N;
        let cambio = 0;
        for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
            const d = Math.hypot((x - c) * h - p.x, (y - c) * h - p.y, (z - c) * h - p.z);
            if (d >= r) continue;
            const i = x + N * (y + N * z);
            const media = (f[i - 1] + f[i + 1] + f[i - N] + f[i + N] + f[i - NN] + f[i + NN]) / 6;
            const nv = f[i] + (media - f[i]) * k * (1 - d / r);
            if (nv === f[i]) continue;
            if (trazo) this._guardar(x, y, z);
            cambio += Math.abs(nv - f[i]);
            f[i] = nv;
        }
        this._marcar(x0, x1, y0, y1, z0, z1);
        return cambio;
    }

    /**
     * Aplica una herramienta. Coordenadas locales (metros).
     * @param {{tipo:string, p:THREE.Vector3, n?:THREE.Vector3, d?:THREE.Vector3, r:number, fuerza:number, torno?:boolean, vr?:boolean}} op
     *   p = punto de contacto · n = normal hacia fuera · d = dirección de la herramienta (hacia dentro)
     *   vr = la punta está donde el usuario la pone (sin desplazamientos automáticos)
     * @returns {number} cantidad de campo modificada (para sonido, vibración y virutas)
     */
    aplicar({ tipo, p, n, d, r, fuerza, torno = false, vr = false }) {
        const dur = this.dureza;
        const nn = n || new THREE.Vector3(0, 1, 0);
        const dd = d || nn.clone().negate();
        const kq = m => Math.min(1, Math.max(0.02, fuerza * m / dur));

        if (tipo === 'LIJA') return this._suavizar(p, r, Math.min(0.85, Math.max(0.05, fuerza * 0.8 / Math.sqrt(dur))));

        if (tipo === 'ARCILLA') {
            const cx = p.x + (vr ? 0 : nn.x * 0.15 * r), cy = p.y + (vr ? 0 : nn.y * 0.15 * r), cz = p.z + (vr ? 0 : nn.z * 0.15 * r);
            const ra = r * 0.75;
            return this._tallar(this._caja(cx, cy, cz, ra + 2 * this.h),
                (x, y, z) => Math.hypot(x - cx, y - cy, z - cz) - ra, Math.min(1, Math.max(0.05, fuerza * 0.6)), true);
        }

        // Torno: la pieza gira, así que el corte es de revolución alrededor del eje Y.
        if (torno && tipo !== 'TALADRO') {
            const rc = r * (tipo === 'CINCEL' ? 0.35 : tipo === 'APLANAR' ? 0.8 : 0.5);
            const r0 = Math.hypot(p.x, p.z) - (vr ? 0 : rc * 0.4);
            const yP = p.y, lado = this.c * this.h;
            return this._tallar(this._caja(0, yP, 0, lado, rc + 2 * this.h, lado), (x, y, z) => {
                const rad = Math.hypot(x, z);
                const dist = rad < r0 ? Math.hypot(rad - r0, y - yP) : Math.abs(y - yP);
                return dist - rc;
            }, kq(tipo === 'CINCEL' ? 1.4 : 1.0), false);
        }

        if (tipo === 'TALADRO') {
            const rb = r * 0.4, largo = r * (vr ? 0.3 : 0.7);
            const ax = p.x, ay = p.y, az = p.z;
            const bx = ax + dd.x * largo, by = ay + dd.y * largo, bz = az + dd.z * largo;
            const ex = (ax + bx) / 2, ey = (ay + by) / 2, ez = (az + bz) / 2;
            return this._tallar(this._caja(ex, ey, ez, largo / 2 + rb + 2 * this.h), (x, y, z) => {
                const px = x - ax, py = y - ay, pz = z - az;
                const t = Math.max(0, Math.min(largo, px * dd.x + py * dd.y + pz * dd.z));
                return Math.hypot(px - dd.x * t, py - dd.y * t, pz - dd.z * t) - rb;
            }, kq(1.3), false);
        }

        if (tipo === 'APLANAR') {
            const off = vr ? 0 : 0.12 * r;
            const qx = p.x - nn.x * off, qy = p.y - nn.y * off, qz = p.z - nn.z * off;
            return this._tallar(this._caja(p.x, p.y, p.z, r + 2 * this.h), (x, y, z) => Math.max(
                Math.hypot(x - p.x, y - p.y, z - p.z) - r,
                -((x - qx) * nn.x + (y - qy) * nn.y + (z - qz) * nn.z),
            ), kq(0.9), false);
        }

        // GUBIA (cuchara) y CINCEL (lasca poco profunda)
        const cincel = tipo === 'CINCEL';
        const rs = cincel ? r * 0.65 : r;
        const off = vr ? 0 : (cincel ? 0.2 * rs : -0.25 * rs);
        const cx = p.x + nn.x * off, cy = p.y + nn.y * off, cz = p.z + nn.z * off;
        return this._tallar(this._caja(cx, cy, cz, rs + 2 * this.h),
            (x, y, z) => Math.hypot(x - cx, y - cy, z - cz) - rs, kq(cincel ? 1.7 : 1.1), false);
    }

    /* ---------- mallado (surface nets por trozos) ---------- */

    _marcar(x0, x1, y0, y1, z0, z1) {
        const K = this.K;
        const r = (a, b) => [Math.max(0, Math.ceil(a / C) - 1), Math.min(K - 1, Math.floor((b + 1) / C))];
        const [ax, bx] = r(x0, x1), [ay, by] = r(y0, y1), [az, bz] = r(z0, z1);
        for (let z = az; z <= bz; z++) for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++)
            this.sucios.add(x + K * (y + K * z));
    }

    construirTodo() {
        const K = this.K;
        for (let i = 0; i < K * K * K; i++) this.sucios.add(i);
        this.actualizar(Infinity);
    }

    /** Reconstruye trozos pendientes durante como mucho `presupuestoMs`. */
    actualizar(presupuestoMs = 6) {
        if (!this.sucios.size) return;
        const t0 = performance.now(), K = this.K;
        for (const k of this.sucios) {
            this.sucios.delete(k);
            this._construirTrozo(k % K, Math.floor(k / K) % K, Math.floor(k / (K * K)), k);
            if (performance.now() - t0 > presupuestoMs) break;
        }
    }

    _construirTrozo(cx, cy, cz, clave) {
        const { N, f, h, c } = this;
        const NC = N - 1, NN = N * N;
        const x0 = cx * C, y0 = cy * C, z0 = cz * C;
        const x1 = Math.min(x0 + C, NC), y1 = Math.min(y0 + C, NC), z1 = Math.min(z0 + C, NC);
        const ex0 = Math.max(0, x0 - 1), ey0 = Math.max(0, y0 - 1), ez0 = Math.max(0, z0 - 1);
        const sx = x1 - ex0, sy = y1 - ey0;
        const mapa = new Int32Array(sx * sy * (z1 - ez0)).fill(-1);
        const pos = [], nor = [], col = [], ind = [];
        const v = new Float64Array(8);
        const colorFn = MATERIALES[this.material].color, tmp = [0, 0, 0];
        let nv = 0;

        for (let z = ez0; z < z1; z++) for (let y = ey0; y < y1; y++) for (let x = ex0; x < x1; x++) {
            const i0 = x + N * y + NN * z;
            v[0] = f[i0]; v[1] = f[i0 + 1]; v[2] = f[i0 + N]; v[3] = f[i0 + N + 1];
            v[4] = f[i0 + NN]; v[5] = f[i0 + NN + 1]; v[6] = f[i0 + NN + N]; v[7] = f[i0 + NN + N + 1];
            let mask = 0;
            for (let k = 0; k < 8; k++) if (v[k] > 0) mask |= 1 << k;
            if (mask === 0 || mask === 255) continue;
            let ax = 0, ay = 0, az = 0, n = 0;
            for (let e = 0; e < 12; e++) {
                const a = ARISTAS[e][0], b = ARISTAS[e][1];
                const va = v[a], vb = v[b];
                if ((va > 0) === (vb > 0)) continue;
                const t = va / (va - vb);
                ax += (a & 1) + ((b & 1) - (a & 1)) * t;
                ay += ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t;
                az += ((a >> 2) & 1) + (((b >> 2) & 1) - ((a >> 2) & 1)) * t;
                n++;
            }
            const lx = (x + ax / n - c) * h, ly = (y + ay / n - c) * h, lz = (z + az / n - c) * h;
            const gx = (v[1] - v[0]) + (v[3] - v[2]) + (v[5] - v[4]) + (v[7] - v[6]);
            const gy = (v[2] - v[0]) + (v[3] - v[1]) + (v[6] - v[4]) + (v[7] - v[5]);
            const gz = (v[4] - v[0]) + (v[5] - v[1]) + (v[6] - v[2]) + (v[7] - v[3]);
            const L = Math.hypot(gx, gy, gz) || 1;
            pos.push(lx, ly, lz);
            nor.push(-gx / L, -gy / L, -gz / L);
            colorFn(lx, ly, lz, tmp);
            col.push(tmp[0], tmp[1], tmp[2]);
            mapa[(x - ex0) + sx * ((y - ey0) + sy * (z - ez0))] = nv++;
        }

        const vieja = this.mallas.get(clave);
        if (nv === 0) {
            if (vieja) { vieja.geometry.dispose(); this.grupo.remove(vieja); this.mallas.delete(clave); }
            return;
        }

        const M = (x, y, z) => mapa[(x - ex0) + sx * ((y - ey0) + sy * (z - ez0))];
        // sentidoPositivo: los vértices dados ya giran con la normal hacia fuera
        const quad = (a, b, cc, d, sentidoPositivo) => {
            if (a < 0 || b < 0 || cc < 0 || d < 0) return;
            if (sentidoPositivo) ind.push(a, b, cc, a, cc, d); else ind.push(a, cc, b, a, d, cc);
        };
        for (let z = z0; z < z1; z++) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
            const i = x + N * y + NN * z;
            const dentro = f[i] > 0;
            // arista +x: celdas en el plano (y,z) → normal +x
            if (y > 0 && z > 0 && dentro !== (f[i + 1] > 0)) quad(M(x, y - 1, z - 1), M(x, y, z - 1), M(x, y, z), M(x, y - 1, z), dentro);
            // arista +y: celdas en el plano (x,z) → normal −y
            if (x > 0 && z > 0 && dentro !== (f[i + N] > 0)) quad(M(x - 1, y, z - 1), M(x, y, z - 1), M(x, y, z), M(x - 1, y, z), !dentro);
            // arista +z: celdas en el plano (x,y) → normal +z
            if (x > 0 && y > 0 && dentro !== (f[i + NN] > 0)) quad(M(x - 1, y - 1, z), M(x, y - 1, z), M(x, y, z), M(x - 1, y, z), dentro);
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        geo.setIndex(ind);
        geo.computeBoundingSphere();
        if (vieja) { vieja.geometry.dispose(); vieja.geometry = geo; }
        else {
            const m = new THREE.Mesh(geo, this.mat);
            this.mallas.set(clave, m);
            this.grupo.add(m);
        }
    }

    /* ---------- reto: comparar con una forma objetivo ---------- */

    /** @param {(x:number,y:number,z:number)=>boolean} dentro  test de pertenencia de la forma objetivo */
    comparar(dentro) {
        const { N, f, h, c } = this;
        let ambos = 0, soloPieza = 0, soloObj = 0;
        for (let z = 1; z < N - 1; z++) {
            const pz = (z - c) * h;
            for (let y = 1; y < N - 1; y++) {
                const py = (y - c) * h;
                let i = 1 + N * (y + N * z);
                for (let x = 1; x < N - 1; x++, i++) {
                    const p = f[i] > 0, o = dentro((x - c) * h, py, pz);
                    if (p && o) ambos++; else if (p) soloPieza++; else if (o) soloObj++;
                }
            }
        }
        const v = h ** 3;
        const union = ambos + soloPieza + soloObj;
        return {
            iou: union ? ambos / union : 0,
            sobrante: soloPieza * v,
            falta: soloObj * v,
            volObjetivo: (ambos + soloObj) * v,
            volPieza: (ambos + soloPieza) * v,
        };
    }

    /* ---------- exportar ---------- */

    /** STL binario en milímetros con Z hacia arriba (lo que esperan los programas de impresión 3D). */
    exportarSTL() {
        this.actualizar(Infinity);
        const raiz = new THREE.Group();
        for (const m of this.mallas.values()) raiz.add(new THREE.Mesh(m.geometry));
        raiz.scale.setScalar(1000);
        raiz.rotation.x = Math.PI / 2;
        raiz.updateMatrixWorld(true);
        return new Blob([new STLExporter().parse(raiz, { binary: true })], { type: 'model/stl' });
    }

    dispose() {
        for (const m of this.mallas.values()) m.geometry.dispose();
        this.mallas.clear();
        this.mat.dispose();
    }
}

/* ═══════════════════ RETOS: FORMAS OBJETIVO ═══════════════════ */
// Todas apoyadas en la base de la pieza (y = −tam/2). t = tam.

const cm3 = v => `${(v * 1e6).toFixed(0)} cm³`;
const cm = v => `${(v * 100).toFixed(1)} cm`;

export const OBJETIVOS = [
    {
        id: 'CUBO', nombre: 'Cubo', emoji: '🧊', forma: 'BLOQUE',
        dentro: t => { const a = 0.62 * t, yb = -t / 2; return (x, y, z) => Math.abs(x) <= a / 2 && Math.abs(z) <= a / 2 && y >= yb && y <= yb + a; },
        fantasma: t => { const a = 0.62 * t; const g = new THREE.BoxGeometry(a, a, a); g.translate(0, -t / 2 + a / 2, 0); return [g]; },
        formula: t => { const a = 0.62 * t; return [`a = ${cm(a)}`, 'V = a³', `V = ${cm3(a ** 3)}`]; },
    },
    {
        id: 'CILINDRO', nombre: 'Cilindro', emoji: '🥫', forma: 'TRONCO', torno: true,
        dentro: t => { const r = 0.3 * t, H = 0.9 * t, yb = -t / 2; return (x, y, z) => y >= yb && y <= yb + H && x * x + z * z <= r * r; },
        fantasma: t => { const r = 0.3 * t, H = 0.9 * t; const g = new THREE.CylinderGeometry(r, r, H, 48); g.translate(0, -t / 2 + H / 2, 0); return [g]; },
        formula: t => { const r = 0.3 * t, H = 0.9 * t; return [`r = ${cm(r)} · h = ${cm(H)}`, 'V = π·r²·h', `V = ${cm3(Math.PI * r * r * H)}`]; },
    },
    {
        id: 'CONO', nombre: 'Cono', emoji: '🍦', forma: 'TRONCO', torno: true,
        dentro: t => { const r = 0.42 * t, H = 0.9 * t, yb = -t / 2; return (x, y, z) => y >= yb && y <= yb + H && Math.hypot(x, z) <= r * (1 - (y - yb) / H); },
        fantasma: t => { const r = 0.42 * t, H = 0.9 * t; const g = new THREE.CylinderGeometry(0, r, H, 48); g.translate(0, -t / 2 + H / 2, 0); return [g]; },
        formula: t => { const r = 0.42 * t, H = 0.9 * t; return [`r = ${cm(r)} · h = ${cm(H)}`, 'V = (π·r²·h)/3', `V = ${cm3(Math.PI * r * r * H / 3)}`]; },
    },
    {
        id: 'PIRAMIDE', nombre: 'Pirámide cuadrada', emoji: '🔺', forma: 'BLOQUE',
        dentro: t => { const l = 0.8 * t, H = 0.9 * t, yb = -t / 2; return (x, y, z) => y >= yb && y <= yb + H && Math.max(Math.abs(x), Math.abs(z)) <= (l / 2) * (1 - (y - yb) / H); },
        fantasma: t => { const l = 0.8 * t, H = 0.9 * t; const g = new THREE.CylinderGeometry(0, l / Math.SQRT2, H, 4); g.rotateY(Math.PI / 4); g.translate(0, -t / 2 + H / 2, 0); return [g]; },
        formula: t => { const l = 0.8 * t, H = 0.9 * t; return [`lado = ${cm(l)} · h = ${cm(H)}`, 'V = (l²·h)/3', `V = ${cm3(l * l * H / 3)}`]; },
    },
    {
        id: 'ESFERA', nombre: 'Esfera', emoji: '⚽', forma: 'BLOQUE',
        dentro: t => { const r = 0.45 * t; return (x, y, z) => x * x + y * y + z * z <= r * r; },
        fantasma: t => [new THREE.SphereGeometry(0.45 * t, 40, 28)],
        formula: t => { const r = 0.45 * t; return [`r = ${cm(r)}`, 'V = (4/3)·π·r³', `V = ${cm3(4 / 3 * Math.PI * r ** 3)}`]; },
    },
    {
        id: 'PEON', nombre: 'Peón de ajedrez', emoji: '♟️', forma: 'TRONCO', torno: true,
        dentro: t => {
            const yb = -t / 2;
            return (x, y, z) => {
                const rad = Math.hypot(x, z), q = y - yb;
                if (q < 0) return false;
                if (q <= 0.12 * t) return rad <= 0.36 * t;                                   // base
                if (q <= 0.6 * t) return rad <= mezcla(0.24 * t, 0.1 * t, (q - 0.12 * t) / (0.48 * t)); // cuerpo
                if (q <= 0.66 * t) return rad <= 0.18 * t;                                   // collarín
                return Math.hypot(rad, q - 0.81 * t) <= 0.17 * t;                            // cabeza
            };
        },
        fantasma: t => {
            const yb = -t / 2;
            const base = new THREE.CylinderGeometry(0.36 * t, 0.36 * t, 0.12 * t, 48); base.translate(0, yb + 0.06 * t, 0);
            const cuerpo = new THREE.CylinderGeometry(0.1 * t, 0.24 * t, 0.48 * t, 48); cuerpo.translate(0, yb + 0.36 * t, 0);
            const collar = new THREE.CylinderGeometry(0.18 * t, 0.18 * t, 0.06 * t, 48); collar.translate(0, yb + 0.63 * t, 0);
            const cabeza = new THREE.SphereGeometry(0.17 * t, 36, 24); cabeza.translate(0, yb + 0.81 * t, 0);
            return [base, cuerpo, collar, cabeza];
        },
        formula: () => ['Cuerpo de revolución:', 'cilindro + tronco de cono', '+ cilindro + esfera'],
    },
];
