// ─── Motor de «Pilota el avión» (three.js, fuera de React) ───────────────────
// Despegue desde un aeropuerto, circuito de aros entre valles, montañas y costa,
// puertas de pregunta (4 aros A-D: se responde pasando por el correcto) y aterrizaje.
// Pensado para varios pilotos: todo el estado del avión vive en `pilotos[]` y cada uno
// tiene su cámara y su vista (como Racing 3D). De momento la interfaz usa 1 piloto.
import * as THREE from 'three';
import { crearCielo } from '../conduccion/motorConduccion';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const difAng = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const suave = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ─── Terreno: función analítica (la colisión no necesita la malla) ──────────
function hash(i, j) { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); }
function ruidoValor(x, z) {
    const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j;
    const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
    return lerp(lerp(hash(i, j), hash(i + 1, j), u), lerp(hash(i, j + 1), hash(i + 1, j + 1), u), v);
}
function fbm(x, z) { let s = 0, a = 0.5, f = 1; for (let k = 0; k < 5; k++) { s += a * ruidoValor(x * f, z * f); f *= 2.03; a *= 0.5; } return s; }

export const MAPA = 7000;            // lado del mundo (m)
export const PISTA = { x: 0, z0: 620, z1: -620, ancho: 34, y: 8 }; // pista N-S (despegue hacia −z)
export const MESETA = 8;             // altura del aeropuerto
/** Altura del suelo en (x, z). Mar al este (y < 0), montañas al norte y al oeste, colinas en medio. */
export function altura(x, z) {
    const r = Math.hypot(x, z);
    let h = 70 * fbm(x / 700 + 13, z / 700 + 7) - 18;                 // colinas
    const sierra = Math.max(0, 1 - Math.abs(fbm(x / 1100 + 3, z / 1100 - 5) * 2 - 1)); // crestas
    const lejos = suave(1900, 3000, r);
    h += lejos * (120 + 520 * sierra * sierra);                           // montañas en el borde
    h -= suave(900, 2600, x) * 140;                                       // costa y mar al este
    // aeropuerto: meseta plana alrededor de la pista
    const llano = 1 - suave(0, 420, Math.max(0, Math.hypot(Math.max(Math.abs(x) - 70, 0), Math.max(Math.abs(z) - 760, 0))));
    return lerp(h, MESETA, llano);
}
// con margen: la hierba llana de los lados de la pista también vale para tomar tierra
const enPista = (x, z) => Math.abs(x - PISTA.x) < PISTA.ancho / 2 + 22 && z < PISTA.z0 + 40 && z > PISTA.z1 - 40;

// ─── Avión de bajo polígono (morro hacia −z) ────────────────────────────────
function crearAvion(color) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.25, flatShading: true });
    const blanco = new THREE.MeshStandardMaterial({ color: 0xf2f4f7, roughness: 0.5, metalness: 0.2, flatShading: true });
    const oscuro = new THREE.MeshStandardMaterial({ color: 0x263238, roughness: 0.6 });
    const cristal = new THREE.MeshStandardMaterial({ color: 0x9fd3ff, roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.75 });
    const fus = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.38, 8.2, 10), blanco); fus.rotation.x = Math.PI / 2; g.add(fus);
    const morro = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.6, 10), mat); morro.rotation.x = -Math.PI / 2; morro.position.z = -4.9; g.add(morro);
    const franja = new THREE.Mesh(new THREE.CylinderGeometry(0.77, 0.6, 3.2, 10), mat); franja.rotation.x = Math.PI / 2; franja.position.z = 0.6; g.add(franja);
    const cab = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), cristal); cab.scale.set(1, 0.9, 2.2); cab.position.set(0, 0.5, -1.6); g.add(cab);
    const ala = new THREE.Mesh(new THREE.BoxGeometry(12, 0.22, 1.9), mat); ala.position.set(0, -0.15, -0.9); g.add(ala);
    const puntas = new THREE.Mesh(new THREE.BoxGeometry(12.1, 0.24, 0.5), blanco); puntas.position.set(0, -0.14, -1.6); g.add(puntas);
    const est = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.16, 1.0), mat); est.position.set(0, 0.1, 3.7); g.add(est);
    const deriva = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.7, 1.3), mat); deriva.position.set(0, 0.95, 3.75); deriva.rotation.x = -0.35; g.add(deriva);
    // hélice
    const helice = new THREE.Group(); helice.position.z = -5.75;
    const buje = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), oscuro); helice.add(buje);
    const pala = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.9, 0.05), oscuro); helice.add(pala);
    const disco = new THREE.Mesh(new THREE.CircleGeometry(1.5, 24), new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.12, depthWrite: false }));
    helice.add(disco); g.add(helice);
    // tren de aterrizaje
    [[-1.2, -0.9], [1.2, -0.9], [0, 3.3]].forEach(([x, z], i) => {
        const pata = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 6), oscuro); pata.position.set(x, -0.9, z); g.add(pata);
        const rueda = new THREE.Mesh(new THREE.CylinderGeometry(i === 2 ? 0.22 : 0.32, i === 2 ? 0.22 : 0.32, 0.2, 10), oscuro); rueda.rotation.z = Math.PI / 2; rueda.position.set(x, -1.35, z); g.add(rueda);
    });
    // luces de las alas (rojo izquierda, verde derecha)
    const luz = (c, x) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 4), new THREE.MeshBasicMaterial({ color: c })); m.position.set(x, -0.12, -0.9); g.add(m); };
    luz(0xff1744, -6.05); luz(0x00e676, 6.05);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.userData = { helice, disco };
    return g;
}

// ─── Aros ────────────────────────────────────────────────────────────────────
export const COLORES_OPCION = ['#e53935', '#1e88e5', '#43a047', '#fbc02d'];
const LETRAS = ['A', 'B', 'C', 'D'];
function texturaCartel(letra, texto, color) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = color; x.beginPath(); x.roundRect(6, 6, 500, 244, 36); x.fill();
    x.lineWidth = 10; x.strokeStyle = '#fff'; x.stroke();
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = 'bold 120px Arial'; x.fillText(letra, 256, texto ? 92 : 128);
    if (texto) {
        let t = String(texto); x.font = 'bold 46px Arial';
        while (x.measureText(t).width > 470 && t.length > 3) t = t.slice(0, -2);
        if (t !== String(texto)) t = t.trimEnd() + '…';
        x.fillText(t, 256, 196);
    }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}

/**
 * crearVuelo(contenedor, opciones, cb)
 *   opciones: { preguntas: [{enunciado, opciones[4], correcta(texto)}], nPreguntas, arosEntre, pilotos: 1|2,
 *               nombres, invertir (↑ = picar, como un avión de verdad), sonido }
 *   cb: onEstado(est), onPregunta({jugador, pregunta}), onRespuesta({jugador, ok, dada, correcta, pregunta}),
 *       onAro({jugador, total}), onChoque({jugador}), onAviso({jugador, texto}), onFin(resumen)
 */
export function crearVuelo(contenedor, opciones = {}, cb = {}) {
    const op = { nPreguntas: 6, arosEntre: 2, pilotos: 1, invertir: false, sonido: true, ...opciones };
    const esMovil = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    const nPil = clamp(op.pilotos || 1, 1, 2);
    const aLimpiar = [];

    // ── Renderer y escena ──
    const renderer = new THREE.WebGLRenderer({ antialias: !esMovil, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, esMovil ? 1.5 : 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = !esMovil; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const ancho = () => contenedor.clientWidth || window.innerWidth, alto = () => contenedor.clientHeight || window.innerHeight;
    renderer.setSize(ancho(), alto());
    renderer.domElement.style.display = 'block'; renderer.domElement.style.touchAction = 'none';
    contenedor.appendChild(renderer.domElement);
    const escena = new THREE.Scene();
    const HORIZONTE = 0xcfe3f1;
    escena.background = new THREE.Color(HORIZONTE);
    escena.fog = new THREE.Fog(HORIZONTE, 900, 4200);
    const cielo = crearCielo(); cielo.scale.setScalar(6); escena.add(cielo);
    escena.add(new THREE.HemisphereLight(0xdcecff, 0x55603a, 1.0));
    const sol = new THREE.DirectionalLight(0xfff1d6, 2.0);
    const OFFSET_SOL = new THREE.Vector3(300, 500, 200);
    sol.castShadow = true; sol.shadow.mapSize.set(1024, 1024);
    Object.assign(sol.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 10, far: 1500 });
    sol.shadow.bias = -0.0005;
    escena.add(sol, sol.target);

    // ── Terreno ──
    const SEG = esMovil ? 150 : 220;
    const geoT = new THREE.PlaneGeometry(MAPA, MAPA, SEG, SEG); geoT.rotateX(-Math.PI / 2);
    const pos = geoT.attributes.position, cols = new Float32Array(pos.count * 3);
    const cArena = new THREE.Color(0xd9c58f), cHierba = new THREE.Color(0x5f8f3e), cHierba2 = new THREE.Color(0x7aa34a), cRoca = new THREE.Color(0x7b7468), cNieve = new THREE.Color(0xf4f6f8), cTmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i), h = altura(x, z);
        pos.setY(i, h);
        const n = ruidoValor(x / 60, z / 60);
        if (h < 3) cTmp.copy(cArena);
        else if (h < 160) cTmp.copy(cHierba).lerp(cHierba2, n);
        else if (h < 380) cTmp.copy(cHierba).lerp(cRoca, clamp((h - 160) / 140, 0, 1));
        else cTmp.copy(cRoca).lerp(cNieve, clamp((h - 380) / 80, 0, 1));
        cols[i * 3] = cTmp.r; cols[i * 3 + 1] = cTmp.g; cols[i * 3 + 2] = cTmp.b;
    }
    geoT.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geoT.computeVertexNormals();
    const terreno = new THREE.Mesh(geoT, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }));
    terreno.receiveShadow = true; escena.add(terreno);
    const mar = new THREE.Mesh(new THREE.PlaneGeometry(MAPA * 3, MAPA * 3), new THREE.MeshStandardMaterial({ color: 0x2f74b5, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.92 }));
    mar.rotation.x = -Math.PI / 2; mar.position.y = 0; escena.add(mar);

    // ── Aeropuerto ──
    const cPista = document.createElement('canvas'); cPista.width = 64; cPista.height = 1024;
    { const x = cPista.getContext('2d'); x.fillStyle = '#3b3f45'; x.fillRect(0, 0, 64, 1024); x.fillStyle = '#fff';
      for (let k = 0; k < 1024; k += 48) x.fillRect(30, k, 4, 24);
      x.fillRect(2, 0, 3, 1024); x.fillRect(59, 0, 3, 1024);
      for (let k = 0; k < 6; k++) { x.fillRect(8 + k * 8, 8, 4, 22); x.fillRect(8 + k * 8, 994, 4, 22); } }
    const texPista = new THREE.CanvasTexture(cPista); texPista.colorSpace = THREE.SRGBColorSpace; texPista.anisotropy = 8;
    const largoPista = PISTA.z0 - PISTA.z1;
    const pista = new THREE.Mesh(new THREE.PlaneGeometry(PISTA.ancho, largoPista), new THREE.MeshStandardMaterial({ map: texPista, roughness: 0.9 }));
    pista.rotation.x = -Math.PI / 2; pista.position.set(PISTA.x, MESETA + 0.05, (PISTA.z0 + PISTA.z1) / 2); pista.receiveShadow = true; escena.add(pista);
    const torre = new THREE.Group();
    { const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 18, 8), new THREE.MeshStandardMaterial({ color: 0xeceff1 })); base.position.y = 9; torre.add(base);
      const cab = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 3.2, 4, 8), new THREE.MeshStandardMaterial({ color: 0x4fc3f7, metalness: 0.5, roughness: 0.2 })); cab.position.y = 20; torre.add(cab);
      const techo = new THREE.Mesh(new THREE.ConeGeometry(4.6, 2, 8), new THREE.MeshStandardMaterial({ color: 0xb71c1c })); techo.position.y = 23; torre.add(techo); }
    torre.position.set(70, MESETA, 120); escena.add(torre);
    const hangar = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 36, 16, 1, false, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0x90a4ae, metalness: 0.4, roughness: 0.5 }));
    hangar.rotation.z = Math.PI / 2; hangar.rotation.y = Math.PI / 2; hangar.position.set(80, MESETA, -40); escena.add(hangar);
    // luces de aproximación
    const matLuzPista = new THREE.MeshBasicMaterial({ color: 0xfff59d });
    const luzPista = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 6, 4), matLuzPista, 140);
    { let k = 0; const m = new THREE.Matrix4();
      for (let z = PISTA.z1; z <= PISTA.z0 && k < 100; z += 25) { for (const s of [-1, 1]) { m.makeTranslation(PISTA.x + s * (PISTA.ancho / 2 + 1.5), MESETA + 0.4, z); luzPista.setMatrixAt(k++, m); } }
      for (let d = 30; d <= 200 && k < 138; d += 20) { m.makeTranslation(PISTA.x, MESETA + 0.6, PISTA.z1 - d); luzPista.setMatrixAt(k++, m); m.makeTranslation(PISTA.x, MESETA + 0.6, PISTA.z0 + d); luzPista.setMatrixAt(k++, m); }
      luzPista.count = k; }
    escena.add(luzPista);

    // ── Árboles, casas y nubes ──
    const azar = (() => { let s = 98765; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
    {
        const N = esMovil ? 900 : 1800;
        const copa = new THREE.InstancedMesh(new THREE.ConeGeometry(4, 11, 6), new THREE.MeshStandardMaterial({ color: 0x2f6b2f, flatShading: true }), N);
        const tronco = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.7, 3, 5), new THREE.MeshStandardMaterial({ color: 0x5d4037 }), N);
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
        let k = 0;
        for (let i = 0; i < N * 4 && k < N; i++) {
            const x = (azar() - 0.5) * MAPA * 0.85, z = (azar() - 0.5) * MAPA * 0.85, h = altura(x, z);
            if (h < 4 || h > 260 || (Math.abs(x) < 140 && Math.abs(z) < 900)) continue;
            if (fbm(x / 400, z / 400) < 0.45) continue; // bosques en manchas
            const e = 0.7 + azar() * 0.9;
            s.set(e, e, e); p.set(x, h + 8 * e, z); m.compose(p, q, s); copa.setMatrixAt(k, m);
            p.set(x, h + 1.5 * e, z); m.compose(p, q, s); tronco.setMatrixAt(k, m); k++;
        }
        copa.count = tronco.count = k; copa.castShadow = true;
        escena.add(copa, tronco);
        // pueblo junto al aeropuerto
        const NC = 70;
        const casa = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xf5e6c8 }), NC);
        const tejado = new THREE.InstancedMesh(new THREE.ConeGeometry(0.75, 0.6, 4), new THREE.MeshStandardMaterial({ color: 0xb5482f, flatShading: true }), NC);
        k = 0;
        for (let i = 0; i < 400 && k < NC; i++) {
            const x = -260 - azar() * 360, z = -200 + azar() * 700, h = altura(x, z);
            if (h < 3) continue;
            const w = 8 + azar() * 8, a = 6 + azar() * 6, d = 8 + azar() * 6;
            q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), azar() < 0.5 ? 0 : Math.PI / 2);
            s.set(w, a, d); p.set(x, h + a / 2, z); m.compose(p, q, s); casa.setMatrixAt(k, m);
            const q2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4).premultiply(q);
            s.set(w * 1.05, a * 0.9, d * 1.05); p.set(x, h + a + a * 0.27, z); m.compose(p, q2, s); tejado.setMatrixAt(k, m); k++;
        }
        casa.count = tejado.count = k; casa.castShadow = true;
        escena.add(casa, tejado);
        // nubes (sprites)
        const cN = document.createElement('canvas'); cN.width = cN.height = 128;
        const xN = cN.getContext('2d');
        for (let i = 0; i < 9; i++) { const gx = 30 + Math.random() * 68, gy = 50 + Math.random() * 30, r = 22 + Math.random() * 18; const gr = xN.createRadialGradient(gx, gy, 0, gx, gy, r); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); xN.fillStyle = gr; xN.fillRect(0, 0, 128, 128); }
        const texN = new THREE.CanvasTexture(cN);
        const matN = new THREE.SpriteMaterial({ map: texN, transparent: true, depthWrite: false, opacity: 0.9 });
        for (let i = 0; i < 70; i++) {
            const sp = new THREE.Sprite(matN); const e = 120 + azar() * 220;
            sp.scale.set(e, e * 0.55, 1); sp.position.set((azar() - 0.5) * MAPA * 0.9, 380 + azar() * 260, (azar() - 0.5) * MAPA * 0.9);
            escena.add(sp);
        }
    }

    // ── Recorrido: aros y puertas de pregunta ──
    // Bucle alrededor del aeropuerto que acaba alineado con la pista para aterrizar (hacia −z).
    const ctrl = [
        [0, 90, -1000], [-500, 150, -1900], [-1600, 200, -1700], [-2100, 230, -600], [-1900, 220, 700],
        [-1100, 180, 1700], [200, 160, 2300], [1400, 150, 1500], [1700, 120, 200], [1200, 110, -1200],
        [300, 140, -2200], [-300, 130, -2400] /* vuelta al norte */,
    ];
    // tras el último punto el avión da la vuelta hacia el sur para la aproximación final
    // a un 82 % del tamaño original: más lejos de la sierra del borde del mapa (había choques al girar tras los aros del noroeste)
    const curva = new THREE.CatmullRomCurve3(ctrl.map(([x, y, z]) => new THREE.Vector3(x * 0.82, y, z * 0.82)), false, 'centripetal');
    const preguntas = (op.preguntas || []).filter(p => p && Array.isArray(p.opciones) && p.opciones.length >= 2).slice(0, 40);
    const nPreg = Math.min(op.nPreguntas, preguntas.length);
    const entre = clamp(op.arosEntre, 1, 4);
    const totalPuntos = nPreg > 0 ? nPreg * (entre + 1) : 10;
    const puertas = []; // { tipo:'aro'|'pregunta'|'final', c:Vector3, n:Vector3(dirección), der:Vector3, radio, pregunta?, grupo }
    // altura segura de un aro: por encima de todo el terreno en el radio de giro (al girar tras el aro el avión se pasa unos cientos de metros)
    const alturaSegura = (x, z) => { let m = altura(x, z); for (const r of [120, 260, 400, 520]) for (let k = 0; k < 12; k++) { const an = k * Math.PI / 6; m = Math.max(m, altura(x + Math.cos(an) * r, z + Math.sin(an) * r)); } return Math.max(m, 0) + 75; };
    for (let k = 0; k < totalPuntos; k++) {
        const u = (k + 1) / (totalPuntos + 1);
        const c = curva.getPointAt(u), t = curva.getTangentAt(u);
        c.y = Math.max(c.y, alturaSegura(c.x, c.z));
        const n = new THREE.Vector3(t.x, 0, t.z).normalize();
        const esPreg = nPreg > 0 && (k + 1) % (entre + 1) === 0;
        puertas.push({ tipo: esPreg ? 'pregunta' : 'aro', c, n, der: new THREE.Vector3(-n.z, 0, n.x), radio: esPreg ? 13 : 16, pregunta: esPreg ? preguntas[puertas.filter(p => p.tipo === 'pregunta').length] : null, k });
    }
    // Tramos seguros: el avión va casi en línea recta de un aro al siguiente, así que entre dos aros
    // seguidos no puede quedar una montaña (con pocos aros, muy separados, pasaba y había choques).
    for (let vuelta = 0; vuelta < 3; vuelta++) {
        for (let k = 0; k < puertas.length; k++) {
            const a = k === 0 ? new THREE.Vector3(PISTA.x, MESETA + 40, PISTA.z1) : puertas[k - 1].c, b = puertas[k].c;
            let maxT = 0;
            for (let t = 0.04; t < 1; t += 0.04) maxT = Math.max(maxT, altura(lerp(a.x, b.x, t), lerp(a.z, b.z, t)));
            const minimo = maxT + 70;
            if (b.y < minimo) b.y = minimo;
            if (k > 0 && a.y < minimo) a.y = minimo;
        }
    }
    // aproximación final: el circuito acaba al norte → se aterriza hacia el sur (+z), entrando por el umbral norte
    // Aproximación: se puede aterrizar por cualquiera de las dos cabeceras (la que quede más cerca al acabar
    // el circuito). Los aros azules de cada lado son solo una guía para alinearse: no hay que pasar por ellos.
    const guiasAprox = [];
    for (const lado of [-1, 1]) { // −1 = cabecera norte (se aterriza hacia el sur), 1 = cabecera sur
        const umbral = lado < 0 ? PISTA.z1 : PISTA.z0;
        [[900, 60, 26], [420, 30, 22]].forEach(([d, h, r]) => {
            const z = umbral + lado * d;
            guiasAprox.push({ c: new THREE.Vector3(PISTA.x, Math.max(MESETA + h, altura(PISTA.x, z) + 40), z), radio: r });
        });
    }
    const SEP = 34; // separación entre los 4 aros de una puerta de pregunta
    const matAro = new THREE.MeshStandardMaterial({ color: 0xffc400, emissive: 0xff9800, emissiveIntensity: 0.6, roughness: 0.4 });
    const matAroHecho = new THREE.MeshStandardMaterial({ color: 0x69f0ae, emissive: 0x00c853, emissiveIntensity: 0.5, transparent: true, opacity: 0.35 });
    const matAroFallo = new THREE.MeshStandardMaterial({ color: 0x90a4ae, transparent: true, opacity: 0.25 });
    const matFinal = new THREE.MeshStandardMaterial({ color: 0x40c4ff, emissive: 0x0091ea, emissiveIntensity: 0.6 });
    const geoAro = new THREE.TorusGeometry(1, 0.09, 8, 40);
    const opcionesDe = (p) => p.opciones.slice(0, 4);
    puertas.forEach(pu => {
        const grupo = new THREE.Group();
        grupo.position.copy(pu.c);
        grupo.lookAt(pu.c.clone().add(pu.n));
        if (pu.tipo === 'pregunta') {
            pu.aros = opcionesDe(pu.pregunta).map((txt, i, arr) => {
                const off = (i - (arr.length - 1) / 2) * SEP;
                const col = new THREE.Color(COLORES_OPCION[i]);
                const m = new THREE.Mesh(geoAro, new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.55, roughness: 0.4 }));
                m.scale.setScalar(pu.radio); m.position.set(-off, 0, 0); // el grupo mira hacia +n: su +x es la izquierda del piloto
                grupo.add(m);
                const cartel = new THREE.Mesh(new THREE.PlaneGeometry(22, 11), new THREE.MeshBasicMaterial({ map: texturaCartel(LETRAS[i], txt, COLORES_OPCION[i]), transparent: true, side: THREE.DoubleSide }));
                cartel.position.set(-off, pu.radio + 8, 0); cartel.rotation.y = Math.PI; grupo.add(cartel);
                return { mesh: m, off, texto: txt };
            });
        } else {
            const m = new THREE.Mesh(geoAro, pu.tipo === 'final' ? matFinal : matAro); m.scale.setScalar(pu.radio); grupo.add(m); pu.mesh = m;
        }
        escena.add(grupo); pu.grupo = grupo;
    });
    guiasAprox.forEach(g => {
        const m = new THREE.Mesh(geoAro, matFinal); m.scale.setScalar(g.radio); m.position.copy(g.c); escena.add(m);
    });
    // flecha 3D que señala el siguiente objetivo (delante del avión)
    const flecha = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.6, 4), new THREE.MeshBasicMaterial({ color: 0xffd600, transparent: true, opacity: 0.9, depthTest: false }));
    flecha.renderOrder = 10; escena.add(flecha);

    // ── Pilotos ──
    const COLORES_PIL = [0x1565c0, 0xe91e63];
    const pilotos = Array.from({ length: nPil }, (_, i) => {
        const avion = crearAvion(COLORES_PIL[i]); escena.add(avion);
        const x = PISTA.x + (nPil === 1 ? 0 : (i ? 8 : -8)), z = PISTA.z0 - 60 - i * 40;
        return {
            i, nombre: op.nombres?.[i] || (nPil === 1 ? 'Tú' : `Piloto ${i + 1}`), color: COLORES_PIL[i], avion,
            x, y: MESETA + 1.75, z, yaw: 0, pitch: 0, banco: 0, v: 0, motor: 0.0, suelo: true,
            sig: 0, aros: 0, arosFallados: 0, aciertos: 0, fallos: 0, penal: 0, puntos: 0, choques: 0, turbo: 0, inmune: 0,
            preguntas: [], ultimoSeguro: null, fase: 'despegue', aterrizaje: null, terminado: false, tiempoFin: null,
            camara: new THREE.PerspectiveCamera(62, 1, 0.5, 9000), vista: 'exterior', camPos: new THREE.Vector3(), camIni: false,
            tactil: { cabeceo: 0, alabeo: 0, motor: null, freno: 0 }, mando: { cabeceo: 0, alabeo: 0, motor: 0, freno: 0 }, prevLado: null, preguntaAvisada: -1, choqueT: 0, perdida: false,
        };
    });

    // ── Entradas ──
    // 1 piloto: ↑↓ cabeceo, ←→ alabeo (también WASD), W/S o Shift/Ctrl potencia. Con «invertir», ↑ = picar.
    // (2 pilotos, más adelante: P1 = WASD + Q/E potencia, P2 = flechas + RePág/AvPág.)
    const teclas = new Set();
    const onKeyDown = (ev) => {
        const t = (ev.target?.tagName || '').toLowerCase(); if (t === 'input' || t === 'textarea') return;
        const k = ev.key.toLowerCase();
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'pageup', 'pagedown', 'enter', '+', '-'].includes(k)) ev.preventDefault();
        teclas.add(k);
        if (k === 'c' && !ev.repeat) alternarCamara();
        despertarAudio();
    };
    const onKeyUp = (ev) => teclas.delete(ev.key.toLowerCase());
    const onBlur = () => teclas.clear();
    window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp); window.addEventListener('blur', onBlur);
    aLimpiar.push(() => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', onBlur); });
    function entradas(p, dt) {
        const T = (k) => (teclas.has(k) ? 1 : 0);
        let cab = 0, ala = 0, mot = 0, freno = 0;
        if (nPil === 1) {
            cab = Math.max(T('arrowup'), 0) - T('arrowdown'); ala = Math.max(T('arrowright'), T('d')) - Math.max(T('arrowleft'), T('a'));
            mot = Math.max(T('w'), T('shift'), T('pageup')) - Math.max(T('s'), T('control'), T('pagedown')); freno = T(' ');
        } else if (p.i === 0) {
            cab = T('w') - T('s'); ala = T('d') - T('a'); mot = T('q') - T('e'); freno = T(' ');
        } else {
            cab = T('arrowup') - T('arrowdown'); ala = T('arrowright') - T('arrowleft'); mot = Math.max(T('pageup'), T('+')) - Math.max(T('pagedown'), T('-')); freno = T('enter');
        }
        if (op.invertir) cab = -cab;
        cab += p.tactil.cabeceo + p.mando.cabeceo; ala += p.tactil.alabeo + p.mando.alabeo; freno = Math.max(freno, p.tactil.freno, p.mando.freno);
        mot += p.mando.motor; // A / B del micro:bit: subir o bajar la potencia mientras se mantienen
        const mandos = (navigator.getGamepads ? [...navigator.getGamepads()] : []).filter(g => g && g.connected);
        mandos.forEach((gp, i) => {
            if (nPil > 1 && i !== p.i) return;
            const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
            if (Math.abs(ax) > 0.08) ala += ax;
            if (Math.abs(ay) > 0.08) cab += (op.invertir ? 1 : -1) * ay;
            mot += (gp.buttons[7]?.value || 0) - (gp.buttons[6]?.value || 0);
            freno = Math.max(freno, gp.buttons[1]?.pressed ? 1 : 0);
        });
        p.motor = p.fase === 'rodando' ? 0 : (p.tactil.motor != null && !p.mando.motor) ? p.tactil.motor : clamp(p.motor + mot * 0.6 * dt, 0, 1);
        return { cab: clamp(cab, -1, 1), ala: clamp(ala, -1, 1), freno };
    }

    // ── Estado de la partida ──
    let tiempo = 0, tiempoVuelo = 0, terminada = false, pausado = false, cierreEn = null;
    const avisar = (p, texto) => cb.onAviso?.({ jugador: p.i, texto });
    const fwd = (p) => new THREE.Vector3(-Math.sin(p.yaw) * Math.cos(p.pitch), Math.sin(p.pitch), -Math.cos(p.yaw) * Math.cos(p.pitch));

    // ── Física (arcade) ──
    const VMIN = 24, VMAX = 92, VDESPEGUE = 30;
    function fisica(p, dt) {
        if (p.terminado && p.fase !== 'rodando') return;
        if (p.choqueT > 0) { p.choqueT -= dt; if (p.choqueT <= 0) reaparecer(p); return; }
        const ent = entradas(p, dt);
        p.inmune = Math.max(0, p.inmune - dt);
        const suelo = altura(p.x, p.z);
        if (p.suelo) {
            // rodando por la pista: el alabeo hace de dirección y el motor empuja
            const empuje = p.motor * 16 - (ent.freno ? 14 : 0) - 0.5 - 0.004 * p.v * p.v;
            p.v = Math.max(0, p.v + empuje * dt);
            p.yaw -= ent.ala * 0.5 * dt * clamp(p.v / 8, 0, 1);
            p.banco = lerp(p.banco, 0, Math.min(1, dt * 6));
            const quiere = ent.cab > 0.2 && p.v > VDESPEGUE;
            p.pitch = quiere ? Math.min(p.pitch + 0.5 * dt, 0.25) : lerp(p.pitch, 0, Math.min(1, dt * 4));
            const f = fwd(p);
            p.x += f.x * p.v * dt; p.z += f.z * p.v * dt;
            p.y = suelo + 1.75 + (quiere ? Math.max(0, f.y * p.v * dt * 4) : 0);
            if (quiere && p.pitch > 0.12) { p.suelo = false; p.y = suelo + 2.4; if (p.fase === 'despegue') { p.fase = 'vuelo'; avisar(p, '🛫 ¡Despegue!'); } }
            if (!enPista(p.x, p.z) && p.v > 6 && suelo < MESETA - 2) choque(p, 'Te has salido de la pista');
            if (p.fase === 'rodando' && !p.terminado) {
                p.motor = 0; p.tRodando = (p.tRodando || 0) + dt;
                p.v = Math.max(0, p.v - 6 * dt); // frenos automáticos
                if (p.v < 2.5 || p.tRodando > 10) terminarPiloto(p);
            }
            return;
        }
        // en el aire
        const vmaxT = VMAX * (p.turbo > 0 ? 1.25 : 1);
        p.turbo = Math.max(0, p.turbo - dt);
        const objetivo = VMIN + 8 + p.motor * (vmaxT - VMIN - 8);
        p.v += ((objetivo - p.v) * 0.35 - 9.8 * Math.sin(p.pitch) * 0.55 - (ent.freno ? 10 : 0)) * dt;
        p.v = clamp(p.v, 8, vmaxT + 20);
        // mandos: alabeo con vuelta suave a nivel, cabeceo limitado (sin rizos: más fácil de pilotar)
        p.banco = clamp(p.banco + ent.ala * 1.9 * dt, -1.25, 1.25);
        if (Math.abs(ent.ala) < 0.1) p.banco = lerp(p.banco, 0, Math.min(1, dt * 1.1));
        const autoridad = clamp((p.v - 12) / 24, 0.2, 1);
        p.pitch = clamp(p.pitch + ent.cab * 0.95 * autoridad * dt, -1.2, 1.2);
        if (Math.abs(ent.cab) < 0.1) p.pitch = lerp(p.pitch, p.pitch * 0.85, Math.min(1, dt * 0.8));
        // pérdida: poca velocidad → el morro cae
        p.perdida = p.v < VMIN;
        if (p.perdida) p.pitch = Math.max(-0.9, p.pitch - (VMIN - p.v) * 0.05 * dt - 0.3 * dt);
        // viraje por inclinación (coordinado)
        p.yaw -= Math.sin(p.banco) * (9.8 * 1.6 / Math.max(p.v, 20)) * dt;
        const f = fwd(p);
        p.x += f.x * p.v * dt; p.y += f.y * p.v * dt; p.z += f.z * p.v * dt;
        // límites del mundo: el avión gira solo hacia el centro
        const LIM = MAPA / 2 - 300;
        if (Math.abs(p.x) > LIM || Math.abs(p.z) > LIM) {
            const haciaCentro = Math.atan2(p.x, p.z); // yaw que apunta al origen
            p.yaw += difAng(haciaCentro, p.yaw) * Math.min(1, dt * 0.8);
            if (Math.floor(tiempo * 2) % 6 === 0) avisar(p, '↩️ Vuelve a la zona de vuelo');
        }
        if (p.y > 1400) { p.y = 1400; p.pitch = Math.min(p.pitch, 0); }
        // contacto con el suelo o el agua
        const tope = Math.max(suelo, 0);
        if (p.y <= tope + 1.75) {
            const vs = f.y * p.v;
            const pistaOk = enPista(p.x, p.z) && suelo > 1;
            if (pistaOk && vs > -5.5 && Math.abs(p.banco) < 0.35 && p.pitch > -0.2) {
                p.suelo = true; p.y = suelo + 1.75; p.pitch = 0;
                if (p.fase === 'aterrizar') {
                    p.fase = 'rodando';
                    p.aterrizaje = vs > -2.2 ? 'perfecto' : vs > -4 ? 'bueno' : 'duro';
                    const bonus = { perfecto: 500, bueno: 300, duro: 120 }[p.aterrizaje];
                    p.puntos += bonus;
                    avisar(p, p.aterrizaje === 'perfecto' ? `🛬 ¡Aterrizaje perfecto! +${bonus}` : p.aterrizaje === 'bueno' ? `🛬 ¡Buen aterrizaje! +${bonus}` : `🛬 Aterrizaje un poco duro +${bonus}`);
                } else if (p.fase === 'vuelo') avisar(p, 'Has tocado la pista: ¡vuelve a despegar!');
            } else if (p.inmune <= 0) choque(p, tope === 0 && suelo < 0 ? 'Has caído al agua' : pistaOk ? 'Aterrizaje demasiado brusco' : 'Te has estrellado');
            else { p.y = tope + 1.8; p.pitch = Math.max(p.pitch, 0.15); }
        }
    }
    function choque(p, motivo) {
        if (p.choqueT > 0) return;
        p.choques++; p.penal += 10; p.choqueT = 2.2; p.v = 0;
        explosion(p.x, Math.max(p.y, altura(p.x, p.z) + 1), p.z);
        p.avion.visible = false;
        avisar(p, `💥 ${motivo} · +10 s`);
        cb.onChoque?.({ jugador: p.i, motivo });
    }
    function reaparecer(p) {
        // aterrizando: en la línea de aproximación de su cabecera, mirando a la pista y despacio
        if (p.fase === 'aterrizar' || p.sig >= puertas.length) {
            const lado = p.ladoAprox ?? -1, umbral = lado < 0 ? PISTA.z1 : PISTA.z0, z = umbral + lado * 1000;
            Object.assign(p, { x: PISTA.x, y: Math.max(MESETA + 70, altura(PISTA.x, z) + 50), z, yaw: lado < 0 ? Math.PI : 0, pitch: -0.04, banco: 0, v: 45, motor: 0.3, suelo: false, inmune: 2.5, camIni: false });
            if (p.fase === 'vuelo') p.fase = 'aterrizar';
            p.avion.visible = true;
            return;
        }
        // vuelve en el aire, antes del siguiente objetivo y mirando hacia él
        const pu = puertas[Math.min(p.sig, puertas.length - 1)];
        const prev = p.sig > 0 ? puertas[p.sig - 1].c : new THREE.Vector3(PISTA.x, MESETA + 60, PISTA.z1 - 200);
        const dir = pu.c.clone().sub(prev); const largo = dir.length(); dir.normalize();
        const ini = largo > 500 ? pu.c.clone().addScaledVector(dir, -380) : prev.clone().addScaledVector(dir, 40);
        ini.y = Math.max(ini.y, alturaSegura(ini.x, ini.z));
        Object.assign(p, { x: ini.x, y: ini.y, z: ini.z, yaw: Math.atan2(-dir.x, -dir.z), pitch: 0, banco: 0, v: 52, suelo: false, inmune: 2.5, camIni: false });
        if (p.fase === 'despegue') p.fase = 'vuelo';
        p.avion.visible = true;
    }

    // ── Paso por los aros ──
    function comprobarPuertas(p, antes) {
        if (p.sig >= puertas.length || p.choqueT > 0) return;
        const pu = puertas[p.sig];
        const ahora = new THREE.Vector3(p.x, p.y, p.z);
        const lado = (v) => v.clone().sub(pu.c).dot(pu.n);
        const la = lado(antes), lb = lado(ahora);
        if (!(la < 0 && lb >= 0)) return;
        // punto de cruce con el plano de la puerta
        const t = la / (la - lb), cruce = antes.clone().lerp(ahora, t);
        const rel = cruce.clone().sub(pu.c);
        const lat = rel.dot(pu.der), vert = rel.y;
        if (Math.hypot(lat, vert) > 900) return; // muy, muy lejos (otra parte del mapa): no cuenta
        if (pu.tipo === 'pregunta') {
            let elegido = -1;
            pu.aros.forEach((a, i) => { if (Math.hypot(lat - a.off, vert) < pu.radio + 2) elegido = i; });
            const preg = pu.pregunta, dada = elegido >= 0 ? pu.aros[elegido].texto : null;
            const ok = dada != null && String(dada) === String(preg.correcta);
            if (ok) {
                p.aciertos++; p.puntos += 250; p.turbo = 3.5; avisar(p, '✅ ¡Correcto! TURBO 🚀');
                // delante del avión (el aro ya queda detrás): se ven al seguir volando
                const f0 = fwd(p); f0.y = 0; f0.normalize();
                fuegosArtificiales(new THREE.Vector3(p.x, p.y, p.z).addScaledVector(f0, 190), 7);
            }
            else { p.fallos++; p.penal += 5; avisar(p, dada == null ? `❌ No has pasado por ningún aro · era ${preg.correcta} · +5 s` : `❌ Era: ${preg.correcta} · +5 s`); }
            if (nPil === 1) pu.aros.forEach(a => { a.mesh.material = String(a.texto) === String(preg.correcta) ? matAroHecho : matAroFallo; });
            p.preguntas.push({ enunciado: preg.enunciado, dada: dada ?? '', correcta: preg.correcta, ok });
            cb.onRespuesta?.({ jugador: p.i, ok, dada, correcta: preg.correcta, pregunta: preg });
        } else {
            const dentro = Math.hypot(lat, vert) < pu.radio + 1.5;
            if (dentro) { p.aros++; p.puntos += 50; if (pu.mesh && nPil === 1) pu.mesh.material = matAroHecho; }
            else { p.arosFallados++; if (pu.mesh && nPil === 1) pu.mesh.material = matAroFallo; }
            cb.onAro?.({ jugador: p.i, dentro, hechos: p.aros, total: puertas.filter(x => x.tipo !== 'pregunta').length });
        }
        p.ultimoSeguro = pu.c.clone();
        p.sig++;
        if (p.sig >= puertas.length && p.fase === 'vuelo') { p.fase = 'aterrizar'; p.tAterrizar = 120; p.ladoAprox = p.z < 0 ? -1 : 1; avisar(p, '🛬 ¡Ahora aterriza en la pista! Baja la potencia y desciende suave'); }
    }

    // ── Efectos: fuegos artificiales (acierto) ──
    const fuegos = [];
    const COLORES_FUEGO = [0xff1744, 0xffd600, 0x00e5ff, 0x76ff03, 0xff4081, 0xff9100, 0xd500f9, 0x2979ff];
    // chispa redonda con núcleo blanco y halo de color (de día, la mezcla aditiva lo quemaba todo a blanco)
    const texChispa = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.95)'); g.addColorStop(0.5, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t; })();
    function fuegosArtificiales(centro, n = 6) {
        for (let k = 0; k < n; k++) {
            const N = 90, posArr = new Float32Array(N * 3), vel = [];
            const c = centro.clone().add(new THREE.Vector3((Math.random() - 0.5) * 70, 15 + Math.random() * 45, (Math.random() - 0.5) * 40));
            for (let i = 0; i < N; i++) {
                posArr.set([c.x, c.y, c.z], i * 3);
                const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u), sp = 22 + Math.random() * 10;
                vel.push(new THREE.Vector3(r * Math.cos(a) * sp, u * sp, r * Math.sin(a) * sp));
            }
            const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
            const mat = new THREE.PointsMaterial({ color: COLORES_FUEGO[(k + Math.floor(Math.random() * 8)) % 8], map: texChispa, size: 5, transparent: true, opacity: 1, depthWrite: false, fog: false });
            const pts = new THREE.Points(geo, mat); pts.visible = false; escena.add(pts);
            fuegos.push({ pts, vel, retardo: k * 0.22, vida: 2.2 });
        }
        cb.onFuegos?.(n);
    }
    function actualizarFuegos(dt) {
        for (let i = fuegos.length - 1; i >= 0; i--) {
            const fu = fuegos[i];
            if (fu.retardo > 0) { fu.retardo -= dt; if (fu.retardo <= 0) { fu.pts.visible = true; cb.onEstallido?.(); } continue; }
            fu.vida -= dt;
            const arr = fu.pts.geometry.attributes.position.array;
            fu.vel.forEach((v, j) => { v.y -= 9 * dt; v.multiplyScalar(1 - 1.4 * dt); arr[j * 3] += v.x * dt; arr[j * 3 + 1] += v.y * dt; arr[j * 3 + 2] += v.z * dt; });
            fu.pts.geometry.attributes.position.needsUpdate = true;
            fu.pts.material.opacity = Math.max(0, fu.vida / 2.2);
            fu.pts.material.size = 5 + (2.2 - fu.vida) * 1.2;
            if (fu.vida <= 0) { escena.remove(fu.pts); fu.pts.geometry.dispose(); fu.pts.material.dispose(); fuegos.splice(i, 1); }
        }
    }

    // ── Efectos: explosión ──
    const chispas = [];
    const geoChispa = new THREE.SphereGeometry(1, 6, 4);
    function explosion(x, y, z) {
        for (let i = 0; i < 26; i++) {
            const m = new THREE.Mesh(geoChispa, new THREE.MeshBasicMaterial({ color: i % 3 ? 0xff9100 : 0x424242, transparent: true }));
            m.position.set(x, y, z); m.scale.setScalar(1 + Math.random() * 2.5);
            escena.add(m);
            chispas.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 30, Math.random() * 25, (Math.random() - 0.5) * 30), vida: 1.6 });
        }
    }
    function efectos(dt) {
        for (let i = chispas.length - 1; i >= 0; i--) {
            const c = chispas[i]; c.vida -= dt; c.v.y -= 15 * dt;
            c.m.position.addScaledVector(c.v, dt); c.m.material.opacity = Math.max(0, c.vida / 1.6);
            if (c.vida <= 0) { escena.remove(c.m); c.m.material.dispose(); chispas.splice(i, 1); }
        }
    }

    // ── Final ──
    function terminarPiloto(p) {
        if (p.terminado) return;
        p.terminado = true; p.tiempoFin = tiempoVuelo;
        avisar(p, '🏁 ¡Vuelo completado!');
        if (pilotos.every(q => q.terminado)) terminar();
        else if (cierreEn == null) { cierreEn = 90; pilotos.forEach(q => { if (!q.terminado) avisar(q, `⏱️ ${p.nombre} ha terminado: tienes 90 s`); }); }
    }
    function resumenDe(p) {
        const total = (p.tiempoFin ?? tiempoVuelo) + p.penal;
        const nAros = puertas.filter(x => x.tipo !== 'pregunta').length;
        return {
            nombre: p.nombre, color: '#' + new THREE.Color(p.color).getHexString(),
            aciertos: p.aciertos, fallos: p.fallos, aros: p.aros, arosTotal: nAros, choques: p.choques, penalizacion: p.penal,
            aterrizaje: p.aterrizaje, puntos: Math.max(0, p.puntos + Math.round(Math.max(0, 600 - total) * 2)),
            tiempo: total, tiempoFormateado: formato(total), preguntas: p.preguntas,
        };
    }
    function terminar() {
        if (terminada) return;
        terminada = true;
        setTimeout(() => cb.onFin?.({ ...resumenDe(pilotos[0]), pilotos: pilotos.map(resumenDe), nPreguntas: nPreg }), 1600);
    }
    const formato = (s) => { const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r.toFixed(1).padStart(4, '0')}`; };
    /** Abandonar el aterrizaje: si el jugador no consigue aterrizar, puede terminar igualmente. */
    function rendirse() { pilotos.forEach(p => { if (!p.terminado) { p.aterrizaje = p.fase === 'aterrizar' ? 'sin aterrizar' : p.aterrizaje; terminarPiloto(p); } }); }

    // ── Cámaras ──
    const tmp = new THREE.Vector3();
    function actualizarCamara(p, dt) {
        const cam = p.camara, f = fwd(p);
        if (p.vista === 'cabina') {
            cam.position.set(p.x, p.y, p.z).addScaledVector(f, 1.2); cam.position.y += 1.05;
            cam.rotation.set(p.pitch, p.yaw, -p.banco * 0.9, 'YXZ');
            cam.fov = 70; cam.updateProjectionMatrix();
            return;
        }
        const atras = p.suelo ? 20 : 24, arriba = p.suelo ? 6 : 7;
        tmp.set(p.x, p.y, p.z).addScaledVector(new THREE.Vector3(-Math.sin(p.yaw), 0, -Math.cos(p.yaw)), -atras).add(new THREE.Vector3(0, arriba - Math.sin(p.pitch) * 8, 0));
        if (!p.camIni) { p.camPos.copy(tmp); p.camIni = true; }
        p.camPos.lerp(tmp, Math.min(1, dt * 4));
        const minY = Math.max(altura(p.camPos.x, p.camPos.z), 0) + 2.5;
        if (p.camPos.y < minY) p.camPos.y = minY;
        cam.position.copy(p.camPos);
        cam.up.set(0, 1, 0);
        cam.lookAt(tmp.set(p.x, p.y, p.z).addScaledVector(f, 30));
        cam.rotateZ(-p.banco * 0.35);
        const fov = 62 + (p.turbo > 0 ? 10 : 0) + clamp((p.v - 50) / 6, 0, 6);
        if (Math.abs(cam.fov - fov) > 0.2) { cam.fov = lerp(cam.fov, fov, Math.min(1, dt * 3)); cam.updateProjectionMatrix(); }
    }
    function alternarCamara(i = 0) { const p = pilotos[i]; if (!p) return; p.vista = p.vista === 'cabina' ? 'exterior' : 'cabina'; p.camIni = false; }

    // ── Sonido: zumbido de motor sintetizado ──
    const audio = { ctx: null, on: op.sonido !== false };
    function despertarAudio() {
        if (!audio.on) return;
        try {
            if (!audio.ctx) {
                const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
                const ctx = new AC(), o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), fil = ctx.createBiquadFilter();
                o1.type = 'sawtooth'; o2.type = 'square'; fil.type = 'lowpass'; fil.frequency.value = 700; g.gain.value = 0;
                o1.connect(fil); o2.connect(fil); fil.connect(g); g.connect(ctx.destination); o1.start(); o2.start();
                Object.assign(audio, { ctx, o1, o2, g, fil });
            }
            audio.ctx.resume?.();
        } catch { /* sin audio */ }
    }
    function sonido() {
        if (!audio.ctx) return;
        const p = pilotos[0], t = audio.ctx.currentTime;
        const rpm = p.choqueT > 0 || p.terminado ? 0 : 0.25 + p.motor * 0.75;
        audio.o1.frequency.setTargetAtTime(38 + rpm * 70, t, 0.1);
        audio.o2.frequency.setTargetAtTime(76 + rpm * 140, t, 0.1);
        audio.g.gain.setTargetAtTime(pausado || !audio.on ? 0 : 0.025 + rpm * 0.04, t, 0.15);
    }
    const onPointer = () => despertarAudio();
    window.addEventListener('pointerdown', onPointer);
    aLimpiar.push(() => { window.removeEventListener('pointerdown', onPointer); try { audio.ctx?.close(); } catch { /* */ } });

    // ── Minimapa ──
    const mm = op.minimapa?.getContext?.('2d');
    function dibujarMinimapa() {
        if (!mm) return;
        const W = mm.canvas.width, esc = W / MAPA;
        const X = (x) => W / 2 + x * esc, Z = (z) => W / 2 + z * esc;
        mm.clearRect(0, 0, W, W);
        mm.fillStyle = 'rgba(15,30,20,0.75)'; mm.beginPath(); mm.arc(W / 2, W / 2, W / 2 - 1, 0, Math.PI * 2); mm.fill();
        mm.save(); mm.beginPath(); mm.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2); mm.clip();
        mm.fillStyle = 'rgba(47,116,181,0.8)'; mm.fillRect(X(1300), 0, W, W);
        mm.strokeStyle = '#cfd8dc'; mm.lineWidth = 3; mm.beginPath(); mm.moveTo(X(PISTA.x), Z(PISTA.z0)); mm.lineTo(X(PISTA.x), Z(PISTA.z1)); mm.stroke();
        const p0 = pilotos[0];
        puertas.forEach((pu, k) => {
            mm.fillStyle = k < p0.sig ? 'rgba(105,240,174,0.5)' : pu.tipo === 'pregunta' ? '#ffd600' : pu.tipo === 'final' ? '#40c4ff' : '#ffab40';
            const r = k === p0.sig ? 5 : pu.tipo === 'pregunta' ? 4 : 2.5;
            mm.beginPath(); mm.arc(X(pu.c.x), Z(pu.c.z), r, 0, Math.PI * 2); mm.fill();
            if (k === p0.sig) { mm.strokeStyle = '#fff'; mm.lineWidth = 2; mm.stroke(); }
        });
        pilotos.forEach(p => {
            mm.save(); mm.translate(X(p.x), Z(p.z)); mm.rotate(-p.yaw);
            mm.fillStyle = '#' + new THREE.Color(p.color).getHexString(); mm.strokeStyle = '#fff'; mm.lineWidth = 1.5;
            mm.beginPath(); mm.moveTo(0, -7); mm.lineTo(5, 5); mm.lineTo(0, 2); mm.lineTo(-5, 5); mm.closePath(); mm.fill(); mm.stroke();
            mm.restore();
        });
        mm.restore();
    }

    // ── Estado para la interfaz ──
    function objetivoDe(p) {
        if (p.fase === 'rodando') return new THREE.Vector3(PISTA.x, MESETA, p.ladoAprox < 0 ? PISTA.z0 : PISTA.z1);
        if (p.fase === 'aterrizar') {
            const lado = p.ladoAprox ?? (p.z < 0 ? -1 : 1), umbral = lado < 0 ? PISTA.z1 : PISTA.z0;
            const fuera = lado < 0 ? p.z < umbral - 450 : p.z > umbral + 450; // aún lejos: a la línea de aproximación
            return fuera ? new THREE.Vector3(PISTA.x, MESETA + 45, umbral + lado * 450) : new THREE.Vector3(PISTA.x, MESETA, umbral - lado * 150);
        }
        const pu = puertas[p.sig]; return pu ? pu.c : null;
    }
    function estadoPiloto(p) {
        const obj = objetivoDe(p), f = fwd(p);
        let rumbo = 0, elev = 0, dist = null;
        if (obj) {
            const d = obj.clone().sub(new THREE.Vector3(p.x, p.y, p.z)); dist = d.length();
            rumbo = difAng(Math.atan2(-d.x, -d.z), p.yaw);
            elev = Math.atan2(d.y, Math.hypot(d.x, d.z)) - p.pitch;
        }
        const pu = puertas[p.sig];
        const preg = pu?.tipo === 'pregunta' && dist != null && dist < 1100 ? { enunciado: pu.pregunta.enunciado, opciones: pu.aros.map(a => a.texto), senal: pu.pregunta.senal || null, dist: Math.round(dist), k: p.sig } : null;
        const suelo = altura(p.x, p.z);
        return {
            nombre: p.nombre, color: '#' + new THREE.Color(p.color).getHexString(),
            kmh: Math.round(p.v * 3.6), altitud: Math.round(Math.max(0, p.y - Math.max(suelo, 0) - 1.75)), altMar: Math.round(p.y),
            motor: Math.round(p.motor * 100), cabeceo: p.pitch, alabeo: p.banco, vs: Math.round(f.y * p.v * 10) / 10,
            perdida: p.perdida && !p.suelo, suelo: p.suelo, fase: p.fase, turbo: p.turbo > 0, choque: p.choqueT > 0,
            rumbo, elev, dist: dist != null ? Math.round(dist) : null,
            hechas: p.sig, totalPuertas: puertas.length, aciertos: p.aciertos, fallos: p.fallos, aros: p.aros, puntos: p.puntos,
            tiempo: formato((p.tiempoFin ?? tiempoVuelo) + p.penal), penal: p.penal, cierre: cierreEn != null && !p.terminado ? Math.ceil(cierreEn) : null, pregunta: preg, terminado: p.terminado, aterrizaje: p.aterrizaje,
            tAterrizar: p.fase === 'aterrizar' ? Math.max(0, Math.ceil(p.tAterrizar)) : null,
            alineado: p.fase === 'aterrizar' ? { lat: Math.round((p.x - PISTA.x) * ((p.ladoAprox ?? -1) < 0 ? -1 : 1)), distPista: Math.round((p.ladoAprox ?? -1) < 0 ? PISTA.z1 - p.z : p.z - PISTA.z0), alturaPista: Math.round(p.y - MESETA) } : null,
            vista: p.vista,
        };
    }

    // ── Bucle ──
    const reloj = new THREE.Clock();
    let acumEstado = 0;
    function simular(dt) {
        tiempo += dt;
        if (!terminada) tiempoVuelo += dt;
        if (cierreEn != null && !terminada) {
            cierreEn -= dt;
            if (cierreEn <= 0) pilotos.forEach(q => { if (!q.terminado) { if (q.fase !== 'rodando') q.aterrizaje = 'sin terminar'; terminarPiloto(q); } });
        }
        pilotos.forEach(p => {
            const antes = new THREE.Vector3(p.x, p.y, p.z);
            if (p.fase === 'aterrizar' && !p.terminado) {
                p.tAterrizar -= dt;
                if (p.tAterrizar <= 0) { p.aterrizaje = 'sin aterrizar'; avisar(p, '⏱️ Se acabó el tiempo para aterrizar'); terminarPiloto(p); }
            }
            fisica(p, dt);
            if (!p.suelo) comprobarPuertas(p, antes);
            // pregunta a la vista (para avisar a la interfaz una vez)
            const pu = puertas[p.sig];
            if (pu?.tipo === 'pregunta' && p.preguntaAvisada !== p.sig && pu.c.distanceTo(new THREE.Vector3(p.x, p.y, p.z)) < 1100) { p.preguntaAvisada = p.sig; cb.onPregunta?.({ jugador: p.i, pregunta: pu.pregunta }); }
        });
        efectos(dt);
        actualizarFuegos(dt);
    }
    const vistas = () => {
        const w = ancho(), h = alto();
        if (nPil === 1) return [[0, 0, w, h]];
        return w >= h ? [[0, 0, Math.floor(w / 2), h], [Math.ceil(w / 2), 0, Math.floor(w / 2), h]] : [[0, Math.ceil(h / 2), w, Math.floor(h / 2)], [0, 0, w, Math.floor(h / 2)]];
    };
    function renderizar(dt) {
        pilotos.forEach(p => {
            p.avion.position.set(p.x, p.y, p.z);
            p.avion.rotation.set(p.pitch, p.yaw, -p.banco, 'YXZ');
            p.avion.userData.helice.rotation.z += (8 + p.motor * 50) * dt;
        });
        acumEstado += dt;
        if (acumEstado > 0.1) {
            acumEstado = 0;
            const ests = pilotos.map(estadoPiloto);
            cb.onEstado?.({ ...ests[0], pilotos: ests, nPilotos: nPil, terminada });
            dibujarMinimapa();
        }
        sonido();
        const rects = vistas();
        renderer.shadowMap.autoUpdate = nPil === 1;
        renderer.setScissorTest(nPil > 1);
        pilotos.forEach((p, i) => {
            actualizarCamara(p, dt);
            pilotos.forEach(q => { q.avion.visible = q.choqueT <= 0 && !(q === p && p.vista === 'cabina'); });
            const [x, y, w, h] = rects[i];
            if (p.camara.aspect !== w / h) { p.camara.aspect = w / h; p.camara.updateProjectionMatrix(); }
            sol.target.position.set(p.x, Math.max(altura(p.x, p.z), 0), p.z); sol.position.copy(sol.target.position).add(OFFSET_SOL);
            cielo.position.copy(p.camara.position);
            // flecha guía delante del avión
            const obj = objetivoDe(p);
            if (obj && !p.terminado && p.choqueT <= 0) {
                const f = fwd(p);
                flecha.visible = true;
                flecha.position.set(p.x, p.y, p.z).addScaledVector(f, p.vista === 'cabina' ? 14 : 18); flecha.position.y += p.vista === 'cabina' ? -1.5 : 4.5;
                const dir = obj.clone().sub(flecha.position).normalize();
                flecha.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
                flecha.scale.setScalar(p.vista === 'cabina' ? 0.5 : 1);
            } else flecha.visible = false;
            if (nPil > 1) { renderer.shadowMap.needsUpdate = true; renderer.setViewport(x, y, w, h); renderer.setScissor(x, y, w, h); }
            renderer.render(escena, p.camara);
        });
        if (nPil > 1) { renderer.setScissorTest(false); renderer.setViewport(0, 0, ancho(), alto()); }
    }
    renderer.setAnimationLoop(() => {
        const dt = Math.min(reloj.getDelta(), 0.05);
        if (!pausado) simular(dt);
        renderizar(dt);
    });
    const onResize = () => renderer.setSize(ancho(), alto());
    const ro = new ResizeObserver(onResize); ro.observe(contenedor);
    aLimpiar.push(() => ro.disconnect());

    // ═══════════════ API ═══════════════
    return {
        /** Entrada táctil: { cabeceo, alabeo } de −1 a 1, motor 0-1 (null = teclado), freno 0/1. */
        setEntradaTactil(o, i = 0) { if (pilotos[i]) Object.assign(pilotos[i].tactil, o); },
        /** Mandos micro:bit: { cabeceo, alabeo } de −1 a 1, motor = −1 / 0 / 1 (bajar / nada / subir la potencia), freno 0/1. */
        setEntradaMando(o, i = 0) { if (pilotos[i]) Object.assign(pilotos[i].mando, o); },
        alternarCamara, rendirse, despertarAudio,
        pausar(b) { pausado = !!b; reloj.getDelta(); },
        setSonido(on) { audio.on = !!on; if (!on && audio.g) audio.g.gain.value = 0; else despertarAudio(); },
        setInvertir(b) { op.invertir = !!b; },
        destruir() {
            renderer.setAnimationLoop(null);
            aLimpiar.forEach(f => { try { f(); } catch { /* */ } });
            escena.traverse(o => {
                if (o.geometry) o.geometry.dispose();
                const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
                ms.forEach(m => { m.map?.dispose(); m.dispose(); });
            });
            renderer.dispose(); renderer.domElement.remove();
        },
        _depurar: () => ({ pilotos, puertas, estado: () => ({ terminada, tiempoVuelo }), altura }),
        _paso(dt, n = 1) { for (let k = 0; k < n; k++) simular(dt); },
        _render() { renderizar(0.016); },
    };
}
