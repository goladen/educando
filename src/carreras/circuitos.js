// ─── Circuitos de Racing 3D ──────────────────────────────────────────────────
// Cada circuito es un lazo cerrado. Se muestrea a distancias iguales (≈ 2 m) y de
// cada muestra se guarda: posición, tangente, normal (a la derecha), curvatura y
// distancia recorrida s. La muestra 0 es la línea de salida/meta.
import * as THREE from 'three';

export const CIRCUITOS = {
    asfalto: {
        id: 'asfalto', nombre: 'Circuito Pi', emoji: '🏁', superficie: 'asfalto',
        desc: 'Circuito de velocidad con piano en las curvas, gradas y boxes. Recta larga, horquilla y enlazadas.',
        ancho: 13, muro: 9, color: '#e53935',
        // puntos de control (x, z) en metros; se suavizan con Catmull-Rom
        puntos: [[0, 0], [170, 0], [235, 12], [262, 62], [240, 112], [182, 122], [140, 152], [152, 212], [112, 252], [40, 242], [2, 202], [-40, 232], [-112, 222], [-142, 160], [-100, 100], [-132, 42], [-92, 0]],
    },
    tierra: {
        id: 'tierra', nombre: 'Rally de tierra', emoji: '🌾', superficie: 'tierra',
        desc: 'Pista de tierra entre árboles y balas de paja. El coche derrapa: frena antes de las curvas.',
        ancho: 11, muro: 7, color: '#a1662f',
        puntos: [[0, 0], [95, -12], [158, 18], [176, 80], [132, 118], [154, 172], [112, 224], [40, 206], [18, 150], [-32, 172], [-96, 142], [-104, 80], [-62, 50], [-96, 8], [-52, -22]],
    },
    ciudad: {
        id: 'ciudad', nombre: 'Gran Premio urbano', emoji: '🏙️', superficie: 'ciudad',
        desc: 'Circuito por las calles de la ciudad del simulador: aceras, edificios, farolas y muros a los lados.',
        ancho: 12, muro: 0.3, color: '#1e88e5',
        // ciudad: esquinas en ángulo recto redondeadas (calles), no curvas suaves
        esquinas: [[210, 0], [210, 110], [130, 110], [130, 190], [210, 190], [210, 270], [-30, 270], [-30, 150], [40, 150], [40, 60], [-30, 60], [-30, 0]],
        radio: 16,
    },
};

/** Polígono con las esquinas redondeadas (arcos de radio r) → lista densa de puntos. */
function poligonoRedondeado(esq, r) {
    const out = [];
    const n = esq.length;
    for (let i = 0; i < n; i++) {
        const p0 = esq[(i - 1 + n) % n], p1 = esq[i], p2 = esq[(i + 1) % n];
        const a = new THREE.Vector2(p0[0] - p1[0], p0[1] - p1[1]).normalize();
        const b = new THREE.Vector2(p2[0] - p1[0], p2[1] - p1[1]).normalize();
        const ang = Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1));
        const d = r / Math.tan(ang / 2);           // distancia de la esquina a los puntos de tangencia
        const t1 = new THREE.Vector2(p1[0], p1[1]).addScaledVector(a, d);
        const t2 = new THREE.Vector2(p1[0], p1[1]).addScaledVector(b, d);
        const bis = a.clone().add(b).normalize();
        const centro = new THREE.Vector2(p1[0], p1[1]).addScaledVector(bis, r / Math.sin(ang / 2));
        let a1 = Math.atan2(t1.y - centro.y, t1.x - centro.x), a2 = Math.atan2(t2.y - centro.y, t2.x - centro.x);
        let da = a2 - a1; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
        for (let k = 0; k <= 8; k++) { const t = a1 + (da * k) / 8; out.push([centro.x + r * Math.cos(t), centro.y + r * Math.sin(t)]); }
    }
    return out;
}

const cache = {};
/** Muestras del circuito a ~2 m. Devuelve { def, muestras, L, N, ancho }. */
export function prepararCircuito(id) {
    if (cache[id]) return cache[id];
    const def = CIRCUITOS[id] || CIRCUITOS.asfalto;
    let pts;
    if (def.esquinas) {
        const densos = poligonoRedondeado(def.esquinas, def.radio);
        pts = densos.map(([x, z]) => new THREE.Vector3(x, 0, z));
    } else {
        pts = def.puntos.map(([x, z]) => new THREE.Vector3(x, 0, z));
    }
    const curva = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    const L0 = curva.getLength();
    const N = Math.round(L0 / 2);
    const esp = curva.getSpacedPoints(N); // N + 1 puntos, el último = el primero
    // Empezar en el punto más recto de la primera recta para que la salida no quede en curva
    const muestras = [];
    let s = 0;
    for (let i = 0; i < N; i++) {
        const p = esp[i], q = esp[(i + 1) % N];
        if (i > 0) s += p.distanceTo(esp[i - 1]);
        const t = new THREE.Vector3().subVectors(q, p).normalize();
        muestras.push({ x: p.x, z: p.z, tx: t.x, tz: t.z, nx: -t.z, nz: t.x, s, curv: 0 });
    }
    const L = s + esp[N - 1].distanceTo(esp[0]);
    // curvatura con signo (+ = gira a la derecha) usando el cambio de tangente en ±3 muestras
    for (let i = 0; i < N; i++) {
        const a = muestras[(i - 3 + N) % N], b = muestras[(i + 3) % N];
        const cruz = a.tx * b.tz - a.tz * b.tx, punto = a.tx * b.tx + a.tz * b.tz;
        muestras[i].curv = Math.atan2(cruz, punto) / Math.max(1, b.s - a.s + (b.s < a.s ? L : 0));
    }
    // La salida va en el punto más recto (menos curvatura acumulada en ±20 muestras) y algo antes de su final
    let mejor = 0, menor = Infinity;
    for (let i = 0; i < N; i++) { let c = 0; for (let k = -20; k <= 25; k++) c += Math.abs(muestras[(i + k + N) % N].curv); if (c < menor) { menor = c; mejor = i; } }
    const rot = muestras.slice(mejor).concat(muestras.slice(0, mejor));
    let acc = 0;
    rot.forEach((m, i) => { if (i > 0) acc += Math.hypot(m.x - rot[i - 1].x, m.z - rot[i - 1].z); m.s = acc; });
    const res = { def, muestras: rot, L, N, ancho: def.ancho };
    cache[id] = res;
    return res;
}

/** Índice de la muestra más cercana buscando cerca de una pista (idx previo). */
export function muestraCercana(C, x, z, idx, atras = 8, adelante = 25) {
    let mejor = idx, dMin = Infinity;
    for (let k = -atras; k <= adelante; k++) {
        const i = (idx + k + C.N) % C.N, m = C.muestras[i];
        const d = (m.x - x) ** 2 + (m.z - z) ** 2;
        if (d < dMin) { dMin = d; mejor = i; }
    }
    return mejor;
}

/** Búsqueda completa (al colocar o si el vehículo se pierde). */
export function muestraCercanaGlobal(C, x, z) {
    let mejor = 0, dMin = Infinity;
    for (let i = 0; i < C.N; i++) { const m = C.muestras[i], d = (m.x - x) ** 2 + (m.z - z) ** 2; if (d < dMin) { dMin = d; mejor = i; } }
    return mejor;
}
