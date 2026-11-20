// ─── Motor de Racing 3D (three.js, fuera de React) ───────────────────────────
// Carrera en coche o en moto contra 3-4 rivales con IA en tres circuitos
// (asfalto, tierra y ciudad). En cada checkpoint se pausa la carrera para que
// el jugador responda una pregunta: acierto = turbo, fallo = +5 s y frenazo.
// Reutiliza del simulador de conducción: texturas, cielo, coche y moto.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
    rng, texturaCanvas, ruido, texturaVentanas, texturaBajos, texturaAsfalto, texturaBaldosa,
    crearCielo, geometriasCoche, crearCoche, crearMoto,
} from '../conduccion/motorConduccion';
import { prepararCircuito, muestraCercana, muestraCercanaGlobal } from './circuitos';
import motorSrc from '../assets/Audio/carengine.mp3';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const yawDe = (tx, tz) => Math.atan2(-tx, -tz);
const difAng = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

// Física por tipo de vehículo y por superficie
const VEHICULO = {
    coche: { vmax: 33, acc: 10, freno: 22, atras: 7, L: 2.6, steer: 0.5, radios: [[1.15, 0.95], [-1.15, 0.95]] },
    moto: { vmax: 35, acc: 11.5, freno: 19, atras: 4, L: 1.45, steer: 0.45, radios: [[0.5, 0.5], [-0.5, 0.5]] },
};
const SUPERFICIE = {
    asfalto: { agarre: 9, aMax: 12.5, vmax: 1, roz: 0.35 },
    ciudad: { agarre: 9, aMax: 12, vmax: 1, roz: 0.35 },
    tierra: { agarre: 2.6, aMax: 8, vmax: 0.9, roz: 0.6 },
    fuera: { agarre: 2.2, aMax: 6, vmax: 0.45, roz: 2.4 },
};
const NOMBRES_IA = ['Ada', 'Turing', 'Hipatia', 'Newton', 'Curie', 'Gauss'];
const COLORES_IA = [0xe53935, 0x43a047, 0xfdd835, 0x8e24aa, 0xff6d00, 0x00acc1];

// ─── Texturas propias ────────────────────────────────────────────────────────
function texturaHierba(seco = false) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    ruido(x, 256, 256, seco ? '#8f9a52' : '#5f8f3e', 40, 16000, 2);
    for (let k = 0; k < 18; k++) { x.fillStyle = `rgba(${seco ? '120,100,50' : '40,80,30'},0.18)`; x.beginPath(); x.ellipse(Math.random() * 256, Math.random() * 256, 20 + Math.random() * 40, 10 + Math.random() * 25, Math.random() * 3, 0, Math.PI * 2); x.fill(); }
    const t = texturaCanvas(c, true); t.repeat.set(1 / 14, 1 / 14); return t;
}
function texturaTierra() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const x = c.getContext('2d');
    ruido(x, 256, 256, '#8a6038', 46, 18000, 2);
    // rodadas a lo largo (v)
    [70, 100, 156, 186].forEach(u => { x.fillStyle = 'rgba(60,38,20,0.35)'; x.fillRect(u - 7, 0, 14, 256); });
    for (let k = 0; k < 60; k++) { x.fillStyle = 'rgba(200,170,120,0.25)'; x.fillRect(Math.random() * 256, Math.random() * 256, 3, 3); }
    return texturaCanvas(c, true);
}
function texturaPiano() {
    const c = document.createElement('canvas'); c.width = 16; c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = '#e8e8e8'; x.fillRect(0, 0, 16, 64); x.fillStyle = '#d32f2f'; x.fillRect(0, 0, 16, 32);
    return texturaCanvas(c, true);
}
function texturaRayas(a, b, n = 2) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 16;
    const x = c.getContext('2d');
    for (let k = 0; k < n; k++) { x.fillStyle = k % 2 ? b : a; x.fillRect((k * 64) / n, 0, 64 / n, 16); }
    return texturaCanvas(c, true);
}
function texturaAjedrez() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 32;
    const x = c.getContext('2d');
    for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#fff'; x.fillRect(i * 8, j * 8, 8, 8); }
    return texturaCanvas(c);
}
function texturaCartel(numero, estado = 'pendiente') {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const x = c.getContext('2d');
    const fondo = estado === 'bien' ? '#2e7d32' : estado === 'mal' ? '#c62828' : '#1565c0';
    x.fillStyle = fondo; x.fillRect(0, 0, 512, 128);
    x.fillStyle = '#ffd600'; x.fillRect(0, 0, 512, 10); x.fillRect(0, 118, 512, 10);
    x.fillStyle = '#fff'; x.font = 'bold 70px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(estado === 'bien' ? '✔ TURBO' : estado === 'mal' ? '✘ +5 s' : `? PREGUNTA ${numero}`, 256, 68);
    return texturaCanvas(c);
}
function texturaHumo() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return texturaCanvas(c);
}

// ═══════════════════════════════ MOTOR ══════════════════════════════════════
export function crearCarrera(contenedor, opciones = {}, cb = {}) {
    const op = { circuito: 'asfalto', vehiculo: 'coche', rivales: 3, vueltas: 3, checkpoints: 4, sonido: true, ...opciones };
    const C = prepararCircuito(op.circuito);
    const def = C.def, W = C.ancho, H = W / 2;
    const sup = def.superficie === 'tierra' ? 'tierra' : def.superficie === 'ciudad' ? 'ciudad' : 'asfalto';
    const esMovil = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    const r = rng(1234 + op.circuito.length * 97);
    const aLimpiar = [];

    // 1 a 4 jugadores en pantalla partida. Con 3-4 se dibuja 3-4 veces la escena: sin sombras y a
    // resolución 1:1 para que siga fluido en el ordenador del aula.
    const nJug = clamp(Math.round(op.jugadores || 1), 1, 4);
    const ligero = nJug >= 3;
    // ── Renderer y escena ──
    const renderer = new THREE.WebGLRenderer({ antialias: !esMovil && !ligero, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ligero ? 1 : esMovil ? 1.5 : 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = !ligero; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const ancho = () => contenedor.clientWidth || window.innerWidth, alto = () => contenedor.clientHeight || window.innerHeight;
    renderer.setSize(ancho(), alto());
    renderer.domElement.style.display = 'block'; renderer.domElement.style.touchAction = 'none';
    contenedor.appendChild(renderer.domElement);
    const escena = new THREE.Scene();
    const HORIZONTE = sup === 'tierra' ? 0xe2dccb : 0xd4e6f2;
    escena.background = new THREE.Color(HORIZONTE);
    escena.fog = new THREE.Fog(HORIZONTE, 140, 520);
    const cielo = crearCielo(); escena.add(cielo);
    const camara = new THREE.PerspectiveCamera(62, ancho() / alto(), 0.1, 900);
    escena.add(new THREE.HemisphereLight(0xdfefff, 0x6e6a5c, 1.25));
    const sol = new THREE.DirectionalLight(0xfff1d6, 2.8);
    sol.castShadow = true; sol.shadow.mapSize.set(esMovil ? 1024 : 2048, esMovil ? 1024 : 2048);
    Object.assign(sol.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, near: 10, far: 350 });
    sol.shadow.bias = -0.0004; sol.shadow.normalBias = 0.04;
    const OFFSET_SOL = new THREE.Vector3(70, 120, 45);
    escena.add(sol, sol.target);
    const lambert = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });

    // ── Geometría a lo largo de la pista ──
    const M = C.muestras, N = C.N;
    const pos = (i, off) => { const m = M[(i + N) % N]; return [m.x + m.nx * off, m.z + m.nz * off]; };
    /** Cinta plana entre dos desplazamientos laterales (off0 < off1). mascara(i) decide qué tramos se dibujan. */
    function cinta(off0, off1, y, { uvAncho = 8, uvLargo = 8, mascara = null } = {}) {
        const p = [], uv = [], idx = [];
        let v = 0;
        for (let i = 0; i <= N; i++) {
            const m = M[i % N], s = i === N ? C.L : m.s;
            const [ax, az] = pos(i, off0), [bx, bz] = pos(i, off1);
            p.push(ax, y, az, bx, y, bz);
            uv.push(off0 / uvAncho, s / uvLargo, off1 / uvAncho, s / uvLargo);
            if (i < N && (!mascara || mascara(i))) { const a = v, b = v + 1, a1 = v + 2, b1 = v + 3; idx.push(a, b, a1, b, b1, a1); }
            v += 2;
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.setIndex(idx); g.computeVertexNormals();
        return g;
    }
    /** Muro vertical en un desplazamiento lateral. */
    function muro(off, y0, y1, { uvLargo = 4, mascara = null } = {}) {
        const p = [], uv = [], idx = [];
        let v = 0;
        for (let i = 0; i <= N; i++) {
            const s = i === N ? C.L : M[i % N].s, [x, z] = pos(i, off);
            p.push(x, y0, z, x, y1, z);
            uv.push(s / uvLargo, 0, s / uvLargo, 1);
            if (i < N && (!mascara || mascara(i))) idx.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
            v += 2;
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.setIndex(idx); g.computeVertexNormals();
        return g;
    }
    // Distancia a la pista (rejilla de 20 m para colocar decorado sin pisarla)
    const rejilla = new Map(), CEL = 20;
    M.forEach((m, i) => { const k = `${Math.floor(m.x / CEL)},${Math.floor(m.z / CEL)}`; if (!rejilla.has(k)) rejilla.set(k, []); rejilla.get(k).push(i); });
    function distPista(x, z) {
        const cx = Math.floor(x / CEL), cz = Math.floor(z / CEL);
        let d = Infinity;
        for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) (rejilla.get(`${cx + a},${cz + b}`) || []).forEach(i => { d = Math.min(d, Math.hypot(M[i].x - x, M[i].z - z)); });
        return d;
    }
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    M.forEach(m => { minX = Math.min(minX, m.x); maxX = Math.max(maxX, m.x); minZ = Math.min(minZ, m.z); maxZ = Math.max(maxZ, m.z); });
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;

    // ── Suelo ──
    {
        const tex = sup === 'ciudad' ? texturaAsfalto() : texturaHierba(sup === 'tierra');
        if (sup === 'ciudad') tex.repeat.set(1 / 9, 1 / 9);
        const g = new THREE.PlaneGeometry(1600, 1600); g.rotateX(-Math.PI / 2); g.translate(cx, -0.02, cz);
        const uv = g.attributes.uv, pp = g.attributes.position;
        for (let k = 0; k < uv.count; k++) uv.setXY(k, pp.getX(k), pp.getZ(k));
        const suelo = new THREE.Mesh(g, lambert(0xffffff, { map: tex })); suelo.receiveShadow = true; escena.add(suelo);
    }
    // ── Pista ──
    {
        const texPista = sup === 'tierra' ? texturaTierra() : texturaAsfalto();
        if (sup !== 'tierra') { texPista.repeat.set(1, 1); }
        const gp = cinta(-H, H, 0.01, { uvAncho: sup === 'tierra' ? W : 9, uvLargo: sup === 'tierra' ? 12 : 9 });
        const pista = new THREE.Mesh(gp, lambert(0xffffff, { map: texPista })); pista.receiveShadow = true; escena.add(pista);
        if (sup !== 'tierra') {
            // líneas blancas de borde
            const blanco = lambert(0xf2f2f2);
            [[-H + 0.35, -H + 0.55], [H - 0.55, H - 0.35]].forEach(([a, b]) => { const m = new THREE.Mesh(cinta(a, b, 0.02), blanco); m.receiveShadow = true; escena.add(m); });
            if (sup === 'ciudad') { // línea central discontinua
                const m = new THREE.Mesh(cinta(-0.08, 0.08, 0.02, { mascara: i => Math.floor(M[i].s / 3) % 2 === 0 }), blanco); escena.add(m);
            }
        }
        // pianos en las curvas (asfalto)
        if (sup === 'asfalto') {
            const curva = i => { for (let k = -6; k <= 6; k++) if (Math.abs(M[(i + k + N) % N].curv) > 0.012) return true; return false; };
            const tp = texturaPiano();
            const mat = lambert(0xffffff, { map: tp });
            [[-H - 1.3, -H], [H, H + 1.3]].forEach(([a, b]) => { const m = new THREE.Mesh(cinta(a, b, 0.03, { uvAncho: 2, uvLargo: 3, mascara: curva }), mat); m.receiveShadow = true; escena.add(m); });
            // escapatorias de grava en el exterior de las curvas
            const grava = lambert(0xd8c9a3, { map: (() => { const c = document.createElement('canvas'); c.width = c.height = 128; ruido(c.getContext('2d'), 128, 128, '#d2c19a', 50, 5000, 2); const t = texturaCanvas(c, true); return t; })() });
            const exterior = (lado) => i => { const cu = M[i].curv; return Math.abs(cu) > 0.01 && Math.sign(cu) === -lado; };
            [[-def.muro + 0.5, -H - 1.3, -1], [H + 1.3, def.muro - 0.5, 1]].forEach(([a, b, lado]) => { const m = new THREE.Mesh(cinta(a, b, 0.015, { uvAncho: 6, uvLargo: 6, mascara: exterior(lado) }), grava); m.receiveShadow = true; escena.add(m); });
        }
        // línea de meta (ajedrez)
        const meta = new THREE.Mesh(new THREE.PlaneGeometry(W, 1.6), lambert(0xffffff, { map: texturaAjedrez() }));
        meta.rotation.x = -Math.PI / 2; meta.rotation.z = -yawDe(M[0].tx, M[0].tz); meta.position.set(M[0].x, 0.03, M[0].z);
        // PlaneGeometry: ancho en x local; tras rotateX el plano yace en XZ y rotation.z gira en torno al eje vertical
        escena.add(meta);
    }
    // ── Muros, vallas y decorado según el circuito ──
    const decorado = new THREE.Group(); escena.add(decorado);
    const arboles = [];
    if (sup === 'asfalto') {
        const matArmco = lambert(0xffffff, { map: texturaRayas('#e0e0e0', '#c62828', 2), side: THREE.DoubleSide });
        matArmco.map.repeat.set(1, 1);
        [-def.muro, def.muro].forEach(off => { const m = new THREE.Mesh(muro(off, 0, 0.9, { uvLargo: 4 }), matArmco); m.castShadow = true; m.receiveShadow = true; escena.add(m); });
    } else if (sup === 'tierra') {
        // valla de madera: postes + 2 travesaños
        const madera = lambert(0x8d6e4a, { side: THREE.DoubleSide });
        [-def.muro, def.muro].forEach(off => {
            [0.45, 0.95].forEach(y => { const m = new THREE.Mesh(muro(off, y, y + 0.14), madera); m.castShadow = true; escena.add(m); });
            const postes = [];
            for (let i = 0; i < N; i += 2) postes.push(pos(i, off));
            const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.08, 1.3, 6), madera, postes.length);
            const mm = new THREE.Matrix4();
            postes.forEach(([x, z], k) => { mm.makeTranslation(x, 0.65, z); im.setMatrixAt(k, mm); });
            im.castShadow = true; escena.add(im);
        });
        // balas de paja en el exterior de las curvas
        const balas = [];
        for (let i = 0; i < N; i += 2) { const cu = M[i].curv; if (Math.abs(cu) > 0.012) balas.push(pos(i, -Math.sign(cu) * (H + 2.2))); }
        const tPaja = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; ruido(c.getContext('2d'), 64, 64, '#d9b45a', 60, 2500, 1); return texturaCanvas(c, true); })();
        const ib = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.75, 0.75, 1.1, 14), lambert(0xffffff, { map: tPaja }), balas.length);
        const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
        balas.forEach(([x, z], k) => { q.setFromEuler(e.set(Math.PI / 2, r() * 3, 0)); mm.compose(new THREE.Vector3(x, 0.75, z), q, new THREE.Vector3(1, 1, 1)); ib.setMatrixAt(k, mm); });
        ib.castShadow = true; escena.add(ib);
    } else {
        // ciudad: muros de hormigón rojo/blanco + aceras + edificios
        const matMuro = lambert(0xffffff, { map: texturaRayas('#f2f2f2', '#d32f2f', 2), side: THREE.DoubleSide });
        [-H - def.muro, H + def.muro].forEach(off => { const m = new THREE.Mesh(muro(off, 0, 1.0, { uvLargo: 3 }), matMuro); m.castShadow = true; m.receiveShadow = true; escena.add(m); });
        const baldosa = texturaBaldosa();
        [[-H - 4, -H - def.muro], [H + def.muro, H + 4]].forEach(([a, b]) => { const m = new THREE.Mesh(cinta(a, b, 0.15, { uvAncho: 1.6, uvLargo: 1.6 }), lambert(0xffffff, { map: baldosa })); m.receiveShadow = true; escena.add(m); });
    }

    // Edificios de la ciudad (como en el simulador) / árboles en el resto
    if (sup === 'ciudad') {
        const geos = [], geosBajos = [];
        const COLORES = [0xf4e3c1, 0xe8c4a0, 0xd9d4cc, 0xc7d6df, 0xe6b8a2, 0xf0efe8, 0xcfc1a5, 0xb9c9b0, 0xd7a98c, 0xe9dcc9];
        const caja = (w, h, d, celW, celH, color, techo = 0x8d8f93) => {
            const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
            const esc = [[d / celW, h / celH], [d / celW, h / celH], null, null, [w / celW, h / celH], [w / celW, h / celH]];
            const col = new THREE.Color(color), tc = new THREE.Color(techo), cols = new Float32Array(72);
            for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; if (!esc[f]) uv.setXY(i, 0.02, 0.02); else uv.setXY(i, uv.getX(i) * esc[f][0], uv.getY(i) * esc[f][1]); const c = esc[f] ? col : tc; cols.set([c.r, c.g, c.b], i * 3); }
            g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); return g;
        };
        [-1, 1].forEach(lado => {
            for (let i = 0; i < N; i += 9) {
                const m = M[i], prof = 12 + r() * 8, anchoE = 15 + r() * 5, hE = 10 + r() * 22;
                const off = lado * (H + 5 + prof / 2);
                const [x, z] = pos(i, off);
                if (distPista(x, z) < H + 4 + prof / 2 - 0.5) continue;
                const yaw = yawDe(m.tx, m.tz);
                const mat4 = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, 0, z);
                const g = caja(anchoE * 0.2 + prof * 0.8, hE - 3.6, anchoE, 3.2, 3.1, COLORES[Math.floor(r() * COLORES.length)]);
                g.translate(0, 3.6 + (hE - 3.6) / 2, 0); g.applyMatrix4(mat4); geos.push(g);
                const b = caja(anchoE * 0.2 + prof * 0.8 + 0.2, 3.6, anchoE + 0.2, 6, 3.6, 0xffffff, 0x777777);
                b.translate(0, 1.8, 0); b.applyMatrix4(mat4); geosBajos.push(b);
                if (r() < 0.6) { const [tx, tz] = pos(i + 4, lado * (H + 2.6)); arboles.push([tx, tz, 0.8 + r() * 0.4]); }
            }
        });
        const mE = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshLambertMaterial({ map: texturaVentanas(), vertexColors: true })); mE.castShadow = true; mE.receiveShadow = true; escena.add(mE);
        const mB = new THREE.Mesh(mergeGeometries(geosBajos), new THREE.MeshLambertMaterial({ map: texturaBajos(), vertexColors: true })); mB.receiveShadow = true; escena.add(mB);
        // farolas
        const farolas = [];
        for (let i = 0; i < N; i += 14) [-1, 1].forEach(lado => farolas.push([...pos(i, lado * (H + def.muro + 0.6)), yawDe(M[i].tx, M[i].tz) + (lado > 0 ? -Math.PI / 2 : Math.PI / 2)]));
        const poste = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.1, 6.5, 6), lambert(0x3c4248), farolas.length);
        const cabeza = new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, 0.14, 1.6), lambert(0xeeeeee, { emissive: 0x555555 }), farolas.length);
        const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
        farolas.forEach(([x, z, rot], k) => {
            q.setFromEuler(e.set(0, rot, 0));
            mm.compose(new THREE.Vector3(x, 3.25, z), q, new THREE.Vector3(1, 1, 1)); poste.setMatrixAt(k, mm);
            const fx = -Math.sin(rot), fz = -Math.cos(rot);
            mm.compose(new THREE.Vector3(x + fx * 0.8, 6.4, z + fz * 0.8), q, new THREE.Vector3(1, 1, 1)); cabeza.setMatrixAt(k, mm);
        });
        poste.castShadow = true; escena.add(poste, cabeza);
    } else {
        // árboles alrededor, sin pisar la pista ni las vallas
        const n = sup === 'tierra' ? 260 : 160;
        for (let k = 0; k < n * 3 && arboles.length < n; k++) {
            const x = minX - 70 + r() * (maxX - minX + 140), z = minZ - 70 + r() * (maxZ - minZ + 140);
            const d = distPista(x, z);
            if (d > def.muro + 4 && (sup === 'tierra' || d > def.muro + 14)) arboles.push([x, z, 0.8 + r() * 0.8]);
        }
    }
    if (arboles.length) {
        const n = arboles.length;
        const tronco = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.13, 0.2, 2.6, 6), lambert(0x6d4c41), n);
        const copaA = new THREE.InstancedMesh(sup === 'tierra' ? new THREE.ConeGeometry(1.7, 4, 7) : new THREE.IcosahedronGeometry(1.5, 1), lambert(0xffffff, { flatShading: true }), n);
        const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
        arboles.forEach(([x, z, s], k) => {
            mm.compose(new THREE.Vector3(x, 1.3 * s, z), q.identity(), new THREE.Vector3(s, s, s)); tronco.setMatrixAt(k, mm);
            q.setFromEuler(e.set(0, r() * 6, 0));
            mm.compose(new THREE.Vector3(x, (sup === 'tierra' ? 4.2 : 3.6) * s, z), q, new THREE.Vector3(s, s * 1.1, s)); copaA.setMatrixAt(k, mm);
            col.setHSL(sup === 'tierra' ? 0.3 + r() * 0.05 : 0.27 + r() * 0.07, 0.45 + r() * 0.15, 0.24 + r() * 0.08); copaA.setColorAt(k, col);
        });
        tronco.castShadow = true; copaA.castShadow = true; escena.add(tronco, copaA);
    }

    // Modelos de Kenney (gradas, boxes, carpas, banderas…) — se cargan aparte, no bloquean
    const cargador = new GLTFLoader();
    const modelos = {};
    const cargarModelo = (n) => modelos[n] || (modelos[n] = new Promise(res => cargador.load(`/modelos/carreras/${n}.glb`, g => { g.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); res(g.scene); }, undefined, () => res(null))));
    /** Coloca un modelo al lado de la pista (lado −1 izq / +1 der) mirando a la pista. */
    const ponerModelo = async (n, i, lado, off, { escala = 1, giro = 0 } = {}) => {
        const base = await cargarModelo(n);
        if (!base || destruido) return;
        const o = base.clone();
        const [x, z] = pos(i, lado * off), m = M[(i + N) % N];
        o.position.set(x, 0, z);
        o.rotation.y = Math.atan2(-m.nx * lado, -m.nz * lado) + giro; // su frente (+z) hacia la pista
        o.scale.setScalar(escala);
        decorado.add(o);
    };
    let destruido = false;
    {
        // pórtico de salida sobre la línea de meta
        ponerModelo('overheadLights', 0, 1, 0, { giro: Math.PI / 2 }).then(() => {});
        if (sup === 'asfalto') {
            [8, 14, 20].forEach((k, j) => ponerModelo(j === 1 ? 'grandStandCovered' : 'grandStand', N - k * 2, -1, def.muro + 6.5));
            [10, 16, 22, 28].forEach(k => ponerModelo('pitsGarage', k * 2, 1, def.muro + 7));
            ponerModelo('pitsOffice', 68, 1, def.muro + 7);
            ponerModelo('flagGreen', 6, -1, def.muro + 1.5); ponerModelo('flagRed', 12, -1, def.muro + 1.5);
            [Math.floor(N * 0.3), Math.floor(N * 0.55), Math.floor(N * 0.8)].forEach(i => ponerModelo('billboard', i, M[i].curv > 0 ? -1 : 1, def.muro + 4));
            ponerModelo('tentLong', Math.floor(N * 0.42), -1, def.muro + 10);
        } else if (sup === 'tierra') {
            ponerModelo('tent', 14, -1, def.muro + 6); ponerModelo('tent', 34, -1, def.muro + 6);
            ponerModelo('flagGreen', 6, -1, def.muro + 1.5); ponerModelo('flagRed', 6, 1, def.muro + 1.5);
            ponerModelo('grandStand', N - 30, 1, def.muro + 7);
            for (let i = 0; i < N; i += 37) ponerModelo('pylon', i, (i / 37) % 2 ? 1 : -1, H + 0.9, { escala: 0.6 });
        } else {
            ponerModelo('flagGreen', 4, -1, H + 3); ponerModelo('flagRed', 4, 1, H + 3);
            [Math.floor(N * 0.25), Math.floor(N * 0.6)].forEach(i => ponerModelo('billboard', i, 1, H + 3, { escala: 0.7 }));
        }
    }

    // ── Checkpoints (arcos con cartel) ──
    const nCP = clamp(op.checkpoints, 2, 6);
    const checkpoints = [];
    for (let k = 0; k < nCP; k++) {
        const s = (C.L * (k + 0.6)) / nCP;
        let i = 0; while (i < N - 1 && M[i].s < s) i++;
        const m = M[i];
        const g = new THREE.Group(); g.position.set(m.x, 0, m.z); g.rotation.y = yawDe(m.tx, m.tz);
        const matPoste = lambert(0x263238);
        [-1, 1].forEach(l => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 7.5, 10), matPoste); p.position.set(l * (H + 0.6), 3.75, 0); p.castShadow = true; g.add(p); });
        const tex = texturaCartel(k + 1);
        const matCartel = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, toneMapped: false });
        const cartel = new THREE.Mesh(new THREE.PlaneGeometry(W + 1.6, (W + 1.6) / 4), matCartel); cartel.position.set(0, 7.5 - (W + 1.6) / 8, 0); g.add(cartel);
        const brillo = new THREE.Mesh(new THREE.PlaneGeometry(W, 5), new THREE.MeshBasicMaterial({ color: 0x40c4ff, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false })); brillo.position.y = 2.5; g.add(brillo);
        escena.add(g);
        checkpoints.push({ k, s, i, grupo: g, matCartel, brillo, estado: 'pendiente' });
    }
    const marcarCheckpoint = (cp, estado) => {
        cp.estado = estado; const vieja = cp.matCartel.map; cp.matCartel.map = texturaCartel(cp.k + 1, estado); cp.matCartel.needsUpdate = true; vieja?.dispose();
        cp.brillo.material.color.setHex(estado === 'bien' ? 0x69f0ae : estado === 'mal' ? 0xff5252 : 0x40c4ff);
    };

    // ── Vehículos ──
    const cacheColor = new Map();
    const matsV = {
        geoCoche: geometriasCoche(),
        cristal: new THREE.MeshStandardMaterial({ color: 0x1d2732, metalness: 0.6, roughness: 0.15 }),
        rueda: lambert(0x141414), llanta: new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.8, roughness: 0.35 }),
        matricula: lambert(0xf5f5f5), faro: new THREE.MeshBasicMaterial({ color: 0xfff8e1 }), piloto: lambert(0x7a0d0d, { emissive: 0x3a0000 }),
        colorCoche: (c) => { if (!cacheColor.has(c)) cacheColor.set(c, new THREE.MeshStandardMaterial({ color: c, metalness: 0.35, roughness: 0.38 })); return cacheColor.get(c); },
    };
    const tipoV = op.vehiculo === 'moto' ? 'moto' : 'coche';
    const PV = VEHICULO[tipoV];
    const nRivales = clamp(op.rivales, 1, 5);
    const COLOR_JUG = [0x1565c0, 0xe91e63, 0x00c853, 0xff9100];
    // la IA no repite el color de ningún jugador (con 3-4 jugadores se quitan el verde y el naranja)
    const coloresIA = COLORES_IA.filter(c => !(nJug >= 3 && c === 0x43a047) && !(nJug >= 4 && c === 0xff6d00));
    const vehiculos = [];
    const total = nRivales + nJug;
    for (let k = 0; k < total; k++) {
        const jIdx = k - nRivales;                  // los jugadores salen los últimos
        const esJugador = jIdx >= 0;
        const color = esJugador ? COLOR_JUG[jIdx] : coloresIA[k % coloresIA.length];
        const grupo = tipoV === 'moto' ? crearMoto(matsV) : crearCoche(color, matsV);
        if (tipoV === 'moto') grupo.userData.cuerpo.children.forEach(c => { if (c.material === matsV.colorCoche(0xc62828)) c.material = matsV.colorCoche(color); });
        escena.add(grupo);
        const fila = Math.floor(k / 2), col = k % 2 ? 1 : -1;
        const iSalida = (N - 4 - fila * 5 + N) % N;      // detrás de la línea de meta
        const [x, z] = pos(iSalida, col * W * 0.22);
        const m = M[iSalida];
        const nombre = esJugador ? (nJug === 1 ? 'Tú' : (op.nombres?.[jIdx] || `Jugador ${jIdx + 1}`)) : NOMBRES_IA[k % NOMBRES_IA.length];
        vehiculos.push({
            k, esJugador, jIdx: esJugador ? jIdx : -1, nombre, color, grupo,
            x, z, yaw: yawDe(m.tx, m.tz), vF: 0, vL: 0, steer: 0, idx: iSalida, vuelta: -1, mitad: false,
            turbo: 0, lento: 0, terminado: false, tiempoFin: null, ladeo: 0, derrape: false, tDerrape: 0, ladoDerrape: 0, angDerrape: 0, marcaD: 0,
            ia: esJugador ? null : { habilidad: 0.8 + r() * 0.1, base: (r() - 0.5) * W * 0.4, fase: r() * 6, cpHechos: new Set() },
        });
    }
    const jugadores = vehiculos.filter(v => v.esJugador);
    jugadores.forEach(p => Object.assign(p, {
        res: { aciertos: 0, fallos: 0, penalizacion: 0, puntos: 0, preguntas: [] },
        cpSig: 0, esperando: null, vista: 'exterior', camIniciada: false, posCam: new THREE.Vector3(),
        camara: p.jIdx === 0 ? camara : new THREE.PerspectiveCamera(62, 1, 0.1, 900),
        tactil: { steer: 0, acel: 0, freno: 0, atras: 0 }, mando: { steer: 0, acel: 0, freno: 0, atras: 0 }, autoIA: false,
    }));
    const jug = jugadores[0];

    // ── Estado de la carrera ──
    let tiempo = 0, tiempoCarrera = 0, cuenta = 3.5, enCarrera = false, terminada = false;
    let pausado = false, preguntaActiva = null, reanudarEn = 0;
    const res = jug.res; // compatibilidad (1 jugador)
    let llegada = 0, cierreEn = null;

    // ── Entradas ──
    // 1 jugador: flechas o WASD, Espacio frena, ↓/S atrás.
    // 2 jugadores: J1 = WASD + Espacio · J2 = flechas + Enter / Shift derecho.
    const teclas = new Set(), codigos = new Set();
    const onKeyDown = (ev) => {
        const t = (ev.target?.tagName || '').toLowerCase(); if (t === 'input' || t === 'textarea') return;
        const k = ev.key.toLowerCase();
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'enter'].includes(k)) ev.preventDefault();
        teclas.add(k); codigos.add(ev.code);
        if (k === 'c' && !ev.repeat) alternarCamara();
        despertarAudio();
    };
    const onKeyUp = (ev) => { teclas.delete(ev.key.toLowerCase()); codigos.delete(ev.code); };
    const onBlur = () => { teclas.clear(); codigos.clear(); };
    window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp); window.addEventListener('blur', onBlur);
    aLimpiar.push(() => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', onBlur); });
    const prevBtn = {};
    function entradasJugador(p) {
        const T = (k) => (teclas.has(k) ? 1 : 0);
        let steer, acel, freno, atras;
        if (nJug === 1) {
            steer = Math.max(T('arrowright'), T('d')) - Math.max(T('arrowleft'), T('a'));
            acel = Math.max(T('arrowup'), T('w')); freno = T(' '); atras = Math.max(T('arrowdown'), T('s'));
        } else if (p.jIdx === 0) {
            steer = T('d') - T('a'); acel = T('w'); freno = T(' '); atras = T('s');
        } else if (p.jIdx >= 2) {
            steer = 0; acel = 0; freno = 0; atras = 0;
        } else {
            steer = T('arrowright') - T('arrowleft'); acel = T('arrowup'); atras = T('arrowdown');
            freno = codigos.has('Enter') || codigos.has('NumpadEnter') || codigos.has('ShiftRight') || codigos.has('ControlRight') ? 1 : 0;
        }
        steer += p.tactil.steer + p.mando.steer; acel = Math.max(acel, p.tactil.acel, p.mando.acel); freno = Math.max(freno, p.tactil.freno, p.mando.freno); atras = Math.max(atras, p.tactil.atras, p.mando.atras);
        const mandos = (navigator.getGamepads ? [...navigator.getGamepads()] : []).filter(g => g && g.connected);
        mandos.forEach((gp, i) => {
            if (nJug > 1 && i !== p.jIdx) return; // mando 1 → J1, mando 2 → J2…
            if (Math.abs(gp.axes[0] || 0) > 0.08) steer += gp.axes[0];
            acel = Math.max(acel, gp.buttons[7]?.value || 0, gp.buttons[0]?.pressed ? 1 : 0);
            atras = Math.max(atras, gp.buttons[6]?.value || 0);
            freno = Math.max(freno, gp.buttons[1]?.pressed ? 1 : 0);
            const b3 = !!gp.buttons[3]?.pressed; if (b3 && !prevBtn[gp.index]) alternarCamara(); prevBtn[gp.index] = b3;
        });
        return { steer: clamp(steer, -1, 1), acel, freno, atras };
    }

    // ── IA ──
    function entradasIA(v) {
        const ia = v.ia, m = M[v.idx];
        const vabs = Math.abs(v.vF);
        // punto objetivo por delante, con un desplazamiento lateral que cambia despacio (líneas distintas)
        const adel = Math.round((7 + vabs * 0.55) / 2);
        const iObj = (v.idx + adel) % N, mo = M[iObj];
        let off = clamp(ia.base + Math.sin(mo.s / 70 + ia.fase) * W * 0.18, -H + 1.6, H - 1.6);
        // adelantar: si hay alguien delante cerca en mi línea, me aparto
        for (const o of vehiculos) {
            if (o === v) continue;
            const dx = o.x - v.x, dz = o.z - v.z, fx = -Math.sin(v.yaw), fz = -Math.cos(v.yaw);
            const al = dx * fx + dz * fz, la = dx * -fz + dz * fx;
            if (al > 0 && al < 12 && Math.abs(la) < 2.4) { off = clamp(off + (la > 0 ? -3 : 3), -H + 1.4, H - 1.4); break; }
        }
        const tx = mo.x + mo.nx * off, tz = mo.z + mo.nz * off;
        const yawObj = Math.atan2(-(tx - v.x), -(tz - v.z));
        const err = difAng(yawObj, v.yaw);
        // velocidad: la curva más cerrada que viene en la distancia de frenado
        const S = SUPERFICIE[sup];
        let cMax = 0;
        const mirar = Math.round((12 + (vabs * vabs) / (2 * PV.freno * 0.7)) / 2);
        for (let k = 2; k < mirar; k += 2) cMax = Math.max(cMax, Math.abs(M[(v.idx + k) % N].curv));
        let goma = 1;
        const enJuego = jugadores.filter(p => !p.terminado);
        if (enJuego.length) { const dif = Math.max(...enJuego.map(progreso)) - progreso(v); goma = dif > 60 ? 1.07 : dif < -90 ? 0.93 : 1; }
        const vCurva = Math.sqrt((S.aMax * 0.85) / Math.max(cMax, 1e-4));
        const vObj = Math.min(PV.vmax * S.vmax * ia.habilidad * goma, vCurva) * (v.lento > 0 ? 0.7 : 1) * (v.turbo > 0 ? 1.15 : 1);
        return { steer: clamp(-err * 2.4, -1, 1), acel: vabs < vObj - 0.5 ? 1 : 0, freno: vabs > vObj + 1.5 ? 0.7 : 0, atras: 0, derrape: cMax > 0.03 && vabs > 12 };
    }
    const progreso = (v) => v.vuelta * C.L + M[v.idx].s;

    // ── Física ──
    function fisica(v, ent, dt) {
        const fx = -Math.sin(v.yaw), fz = -Math.cos(v.yaw);
        const m = M[v.idx];
        const lat = (v.x - m.x) * m.nx + (v.z - m.z) * m.nz;
        const fuera = Math.abs(lat) > H + (sup === 'asfalto' ? 1.3 : 0.3);
        const S = fuera && sup !== 'ciudad' ? SUPERFICIE.fuera : SUPERFICIE[sup];
        const vmax = PV.vmax * S.vmax * (v.turbo > 0 ? 1.32 : 1) * (v.lento > 0 ? 0.6 : 1);
        let { vF } = v;
        if (ent.acel > 0 && vF > -0.5) vF += ent.acel * PV.acc * (v.turbo > 0 ? 1.4 : 1) * (v.derrape && !v.ia ? 0.25 : 1) * Math.max(0, 1 - vF / vmax) * dt; // derrapando el motor apenas empuja
        if (ent.freno > 0) { const f = ent.freno * PV.freno * dt; vF = vF > 0 ? Math.max(0, vF - f) : Math.min(0, vF + f); }
        if (ent.atras > 0) {
            if (vF > 0.4) vF = Math.max(0, vF - ent.atras * PV.freno * dt); // primero frena
            else vF = Math.max(-PV.atras, vF - ent.atras * 5 * dt);        // y desde parado, marcha atrás
        }
        const roz = S.roz + 0.0015 * vF * vF;
        if (Math.abs(vF) > 0.02) vF -= Math.sign(vF) * roz * dt; else if (!ent.acel && !ent.atras) vF = 0;
        if (vF > vmax) vF = Math.max(vmax, vF - 12 * dt); // fuera de pista se frena hasta su límite
        // dirección limitada por la aceleración lateral (subviraje si vas muy deprisa)
        const maxSteer = PV.steer / (1 + Math.abs(vF) / 14);
        v.steer += clamp(ent.steer * maxSteer - v.steer, -3 * dt, 3 * dt);
        let yawRate = (vF / PV.L) * Math.tan(v.steer);
        // ── Derrape ── empieza al pedir más giro del que agarran las ruedas, al girar frenando
        //    (freno de mano) o, en tierra, antes; se sale soltando el volante o contravolanteando.
        const moto = tipoV === 'moto';
        const demanda = Math.abs(yawRate * vF);
        const giroFuerte = Math.abs(ent.steer) > 0.55;
        // la IA solo derrapa «de vista» (carrocería cruzada, humo y marcas): su trazada no cambia
        if (v.ia) {
            v.derrape = !!ent.derrape && Math.abs(ent.steer) > 0.35 && vF > 12;
            if (v.derrape) v.ladoDerrape = Math.sign(ent.steer);
        } else if (!v.derrape && !fuera && vF > (moto ? 13 : 10.5) && giroFuerte
            && (demanda > S.aMax * (moto ? 1.15 : 0.92) || ent.freno > 0 || ent.derrape || (sup === 'tierra' && vF > 12))) {
            v.derrape = true; v.tDerrape = 0; v.ladoDerrape = Math.sign(ent.steer);
        }
        if (v.derrape && !v.ia) {
            v.tDerrape += dt;
            const contra = Math.sign(ent.steer) === -v.ladoDerrape && Math.abs(ent.steer) > 0.3;
            if (vF < 7 || Math.abs(ent.steer) < 0.2 || contra || fuera) {
                // mini-turbo si el derrape ha durado
                if (v.tDerrape > 1 && !fuera) { v.turbo = Math.max(v.turbo, Math.min(1.8, 0.5 + v.tDerrape * 0.45)); if (v.esJugador) cb.onMiniTurbo?.(v.tDerrape, v.jIdx); }
                v.derrape = false;
            }
        }
        if (v.derrape && !v.ia) {
            // gira más cerrado de lo que permitiría el agarre; más volante hacia el mismo lado = más cerrado
            // en tierra se derrapa mejor que se agarra: el giro derrapando no depende de su poco agarre
            const limD = (Math.max(S.aMax, sup === 'tierra' ? 13 : 0) * (moto ? 1.65 : 1.75)) / Math.max(Math.abs(vF), 1);
            yawRate = v.ladoDerrape * limD * (0.55 + 0.45 * clamp(ent.steer * v.ladoDerrape, 0, 1));
            vF -= (moto ? 2 : 2.6) * dt; // el derrape frena
        } else {
            const lim = S.aMax / Math.max(Math.abs(vF), 1);
            yawRate = clamp(yawRate, -lim, lim);
        }
        v.yaw -= yawRate * dt;
        // deriva: la trasera se va hacia fuera de la curva (velocidad lateral) y el agarre la recupera
        const derrapeFisico = v.derrape && !v.ia;
        const agarre = derrapeFisico ? S.agarre * (moto ? 0.5 : 0.4) : S.agarre;
        const empuje = derrapeFisico ? (moto ? 0.14 : 0.28) : (1 - Math.min(1, agarre / 10)) * 0.9;
        v.vL -= yawRate * vF * dt * empuje;
        v.vL *= Math.exp(-agarre * dt);
        v.vL = clamp(v.vL, -Math.abs(vF) * 0.6, Math.abs(vF) * 0.6);
        v.angDerrape += ((v.derrape ? v.ladoDerrape * (moto ? 0.2 : 0.38) : 0) - v.angDerrape) * Math.min(1, dt * 6);
        v.vF = vF;
        const nfx = -Math.sin(v.yaw), nfz = -Math.cos(v.yaw), rx = -nfz, rz = nfx;
        v.x += (nfx * vF + rx * v.vL) * dt; v.z += (nfz * vF + rz * v.vL) * dt;
        // muros
        v.idx = muestraCercana(C, v.x, v.z, v.idx);
        const m2 = M[v.idx];
        const lat2 = (v.x - m2.x) * m2.nx + (v.z - m2.z) * m2.nz;
        const limite = (sup === 'ciudad' ? H + def.muro : def.muro) - (tipoV === 'moto' ? 0.45 : 0.9); // medio ancho del vehículo
        if (Math.abs(lat2) > limite) {
            const exceso = Math.abs(lat2) - limite, sg = Math.sign(lat2);
            v.x -= m2.nx * sg * exceso; v.z -= m2.nz * sg * exceso;
            const yawPista = yawDe(m2.tx, m2.tz);
            const d = difAng(yawPista, v.yaw);
            if (Math.abs(d) < Math.PI / 2) v.yaw += d * 0.35;  // se endereza contra el muro
            if (v.vF > 8) { v.vF *= 0.72; if (v.esJugador) cb.onChoque?.(false, v.jIdx); }
            v.vL *= -0.3;
        }
        v.fuera = fuera;
        v.lat = lat2;
        return { fx: nfx, fz: nfz };
    }
    function colisiones() {
        const R = PV.radios;
        for (let a = 0; a < vehiculos.length; a++) for (let b = a + 1; b < vehiculos.length; b++) {
            const A = vehiculos[a], B = vehiculos[b];
            if (Math.abs(A.x - B.x) > 6 || Math.abs(A.z - B.z) > 6) continue;
            const fa = [-Math.sin(A.yaw), -Math.cos(A.yaw)], fb = [-Math.sin(B.yaw), -Math.cos(B.yaw)];
            for (const [da, ra] of R) for (const [db, rb] of R) {
                const ax = A.x + fa[0] * da, az = A.z + fa[1] * da, bx = B.x + fb[0] * db, bz = B.z + fb[1] * db;
                const dx = bx - ax, dz = bz - az, d = Math.hypot(dx, dz), min = ra + rb;
                if (d > 0.001 && d < min) {
                    const empuje = (min - d) / 2, nx = dx / d, nz = dz / d;
                    A.x -= nx * empuje; A.z -= nz * empuje; B.x += nx * empuje; B.z += nz * empuje;
                    // el de detrás pierde algo de velocidad
                    const delante = (nx * fa[0] + nz * fa[1]) > 0 ? A : B;
                    delante.vF *= 0.985;
                    if (A.esJugador || B.esJugador) cb.onChoque?.(true);
                }
            }
        }
    }

    // ── Vueltas y checkpoints ──
    function actualizarVuelta(v, idxPrevio) {
        if (idxPrevio > N * 0.8 && v.idx < N * 0.2) {
            if (v.vuelta < 0 || v.mitad) { v.vuelta++; v.mitad = false; if (v.esJugador) nuevaVuelta(v); if (v.ia && !v.esJugador) v.ia.cpHechos.clear(); }
        } else if (idxPrevio < N * 0.2 && v.idx > N * 0.8 && v.vuelta >= 0) { v.vuelta--; v.mitad = true; }
        if (v.idx > N * 0.4 && v.idx < N * 0.6) v.mitad = true;
        if (v.vuelta >= op.vueltas && !v.terminado) {
            v.terminado = true; v.tiempoFin = tiempoCarrera; v.puesto = ++llegada;
            if (v.esJugador) finJugador(v);
        }
    }
    function nuevaVuelta(p) {
        p.cpSig = 0;
        if (nJug === 1) checkpoints.forEach(cp => marcarCheckpoint(cp, 'pendiente'));
        if (p.vuelta > 0 && p.vuelta < op.vueltas) cb.onVuelta?.(p.vuelta + 1, op.vueltas, p.jIdx);
    }
    function revisarCheckpoints(v, sPrevio) {
        if (v.vuelta < 0 || v.terminado) return;
        const s = M[v.idx].s;
        if (v.esJugador) {
            if (v.esperando) return;
            const cp = checkpoints[v.cpSig];
            if (cp && sPrevio < cp.s && s >= cp.s && s - sPrevio < 40) {
                v.cpSig++;
                if (nJug === 1) { pausado = true; preguntaActiva = cp; }
                else { v.esperando = cp; } // a 2 jugadores solo se para el que pregunta
                cb.onCheckpoint?.({ numero: cp.k + 1, total: nCP, vuelta: v.vuelta + 1, jugador: v.jIdx });
            }
        } else {
            checkpoints.forEach(cp => {
                if (!v.ia.cpHechos.has(cp.k) && sPrevio < cp.s && s >= cp.s && s - sPrevio < 40) {
                    v.ia.cpHechos.add(cp.k);
                    if (r() < 0.62) v.turbo = 2; else v.lento = 1.8; // la IA también «responde» (acierta algo más de la mitad)
                }
            });
        }
    }
    function finJugador(p) {
        p.res.puntos += [0, 300, 200, 100][p.puesto] || 0;
        // tras la meta conduce solo, despacio
        p.autoIA = true; p.ia = { habilidad: 0.55, base: 0, fase: 1, cpHechos: new Set() };
        cb.onJugadorMeta?.(p.jIdx, p.puesto);
        if (jugadores.every(q => q.terminado)) terminarCarrera();
        else if (cierreEn == null) cierreEn = 45; // el resto tiene 45 s
    }
    function resumenJugador(p, clasif) {
        const tiempoTotal = p.terminado ? p.tiempoFin + p.res.penalizacion : null;
        return {
            nombre: p.nombre, color: '#' + new THREE.Color(p.color).getHexString(), terminado: p.terminado,
            tiempo: tiempoTotal != null ? Math.round(tiempoTotal * 1000) / 1000 : null, tiempoCarrera: p.tiempoFin, penalizacion: p.res.penalizacion,
            tiempoFormateado: tiempoTotal != null ? formatoTiempo(tiempoTotal) : 'Sin terminar', posicion: clasif.indexOf(p) + 1,
            puntos: p.res.puntos, aciertos: p.res.aciertos, fallos: p.res.fallos, preguntas: p.res.preguntas,
        };
    }
    function terminarCarrera() {
        if (terminada) return;
        terminada = true;
        const clasif = clasificacion();
        const lista = jugadores.map(p => resumenJugador(p, clasif));
        setTimeout(() => cb.onMeta?.({
            ...lista[0], total, dosJugadores: nJug > 1, nJugadores: nJug, jugadores: lista,
            clasificacion: clasif.map(o => ({ nombre: o.nombre, color: '#' + new THREE.Color(o.color).getHexString(), esJugador: o.esJugador, tiempo: o.tiempoFin != null ? formatoTiempo(o.tiempoFin) : null })),
            circuito: def.nombre, vehiculo: tipoV, vueltas: op.vueltas,
        }), 1500);
    }
    function clasificacion() {
        return [...vehiculos].sort((a, b) => {
            if (a.terminado && b.terminado) return a.puesto - b.puesto;
            if (a.terminado) return -1; if (b.terminado) return 1;
            return progreso(b) - progreso(a);
        });
    }

    // ── Partículas (polvo en tierra / hierba) ──
    const NPART = 160;
    const partGeo = new THREE.BufferGeometry();
    const partPos = new Float32Array(NPART * 3).fill(-999), vidas = new Float32Array(NPART), velP = new Float32Array(NPART * 3);
    partGeo.setAttribute('position', new THREE.BufferAttribute(partPos, 3));
    const particulas = new THREE.Points(partGeo, new THREE.PointsMaterial({ map: texturaHumo(), size: 1.6, color: sup === 'tierra' ? 0xb08a5a : 0xcfc8b8, transparent: true, opacity: 0.55, depthWrite: false }));
    particulas.frustumCulled = false; escena.add(particulas);
    let partI = 0;
    function emitir(x, z) {
        const i = partI++ % NPART;
        partPos.set([x + (Math.random() - 0.5), 0.3, z + (Math.random() - 0.5)], i * 3);
        velP.set([(Math.random() - 0.5) * 1.5, 0.8 + Math.random(), (Math.random() - 0.5) * 1.5], i * 3);
        vidas[i] = 1.2;
    }
    const NHUMO = 220;
    const humoGeo = new THREE.BufferGeometry();
    const humoPos = new Float32Array(NHUMO * 3).fill(-999), humoVida = new Float32Array(NHUMO), humoVel = new Float32Array(NHUMO * 3);
    humoGeo.setAttribute('position', new THREE.BufferAttribute(humoPos, 3));
    const humo = new THREE.Points(humoGeo, new THREE.PointsMaterial({ map: texturaHumo(), size: 2.4, color: 0xe8e8e8, transparent: true, opacity: 0.5, depthWrite: false }));
    humo.frustumCulled = false; escena.add(humo);
    let humoI = 0;
    function emitirHumo(x, z, tierraSuelo) {
        if (tierraSuelo) { emitir(x, z); return; }
        const i = humoI++ % NHUMO;
        humoPos.set([x + (Math.random() - 0.5) * 0.4, 0.35, z + (Math.random() - 0.5) * 0.4], i * 3);
        humoVel.set([(Math.random() - 0.5) * 1.2, 0.6 + Math.random() * 0.8, (Math.random() - 0.5) * 1.2], i * 3);
        humoVida[i] = 1.4;
    }
    // marcas de neumático (cuadrados oscuros que se reciclan)
    const NMARCAS = 900;
    const marcas = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.26, 0.75).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: sup === 'tierra' ? 0x4a3020 : 0x111111, transparent: true, opacity: sup === 'tierra' ? 0.35 : 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), NMARCAS);
    marcas.frustumCulled = false; marcas.count = 0; escena.add(marcas);
    let marcaI = 0;
    const mMarca = new THREE.Matrix4(), qMarca = new THREE.Quaternion(), eMarca = new THREE.Euler(), uno = new THREE.Vector3(1, 1, 1), pMarca = new THREE.Vector3();
    function ponerMarca(x, z, yaw) {
        const i = marcaI++ % NMARCAS;
        qMarca.setFromEuler(eMarca.set(0, yaw, 0));
        mMarca.compose(pMarca.set(x, 0.025, z), qMarca, uno);
        marcas.setMatrixAt(i, mMarca);
        marcas.count = Math.min(NMARCAS, marcaI);
        marcas.instanceMatrix.needsUpdate = true;
    }
    function actualizarParticulas(dt) {
        for (let i = 0; i < NHUMO; i++) {
            if (humoVida[i] <= 0) continue;
            humoVida[i] -= dt;
            if (humoVida[i] <= 0) { humoPos[i * 3 + 1] = -999; continue; }
            humoPos[i * 3] += humoVel[i * 3] * dt; humoPos[i * 3 + 1] += humoVel[i * 3 + 1] * dt; humoPos[i * 3 + 2] += humoVel[i * 3 + 2] * dt;
        }
        humoGeo.attributes.position.needsUpdate = true;
        for (let i = 0; i < NPART; i++) {
            if (vidas[i] <= 0) continue;
            vidas[i] -= dt;
            if (vidas[i] <= 0) { partPos[i * 3 + 1] = -999; continue; }
            partPos[i * 3] += velP[i * 3] * dt; partPos[i * 3 + 1] += velP[i * 3 + 1] * dt; partPos[i * 3 + 2] += velP[i * 3 + 2] * dt;
        }
        partGeo.attributes.position.needsUpdate = true;
    }

    // ── Sonido ──
    const audio = { el: null, ctx: null, on: op.sonido !== false };
    function despertarAudio() {
        if (!audio.on) return;
        if (!audio.el) { try { audio.el = new Audio(motorSrc); audio.el.loop = true; audio.el.volume = 0.22; audio.el.preservesPitch = false; audio.el.mozPreservesPitch = false; } catch { /* */ } }
        if (!audio.ctx) { try { audio.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { /* */ } }
        audio.ctx?.resume?.();
    }
    function pitido(f, dur = 0.18, vol = 0.12) {
        if (!audio.ctx || !audio.on) return;
        const o = audio.ctx.createOscillator(), g = audio.ctx.createGain();
        o.type = 'square'; o.frequency.value = f; g.gain.value = vol;
        g.gain.exponentialRampToValueAtTime(0.0001, audio.ctx.currentTime + dur);
        o.connect(g); g.connect(audio.ctx.destination); o.start(); o.stop(audio.ctx.currentTime + dur);
    }
    let chirrido = null;
    function sonidoDerrape() {
        if (!audio.ctx || !audio.on) return;
        if (!chirrido) {
            const ctx = audio.ctx, buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = buf.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
            const filtro = ctx.createBiquadFilter(); filtro.type = 'bandpass'; filtro.frequency.value = sup === 'tierra' ? 500 : 1500; filtro.Q.value = sup === 'tierra' ? 0.8 : 6;
            const g = ctx.createGain(); g.gain.value = 0;
            src.connect(filtro); filtro.connect(g); g.connect(ctx.destination); src.start();
            chirrido = g;
        }
        const objetivo = !pausado && !terminada && jugadores.some(p => p.derrape && !p.autoIA && Math.abs(p.vF) > 6) ? (sup === 'tierra' ? 0.05 : 0.09) : 0;
        chirrido.gain.setTargetAtTime(objetivo, audio.ctx.currentTime, 0.06);
    }
    function sonidoMotor() {
        sonidoDerrape();
        if (!audio.el || !audio.on) return;
        if (pausado || terminada) { if (!audio.el.paused) audio.el.pause(); return; }
        if (audio.el.paused) audio.el.play().catch(() => {});
        audio.el.playbackRate = clamp(0.65 + (Math.max(...jugadores.map(p => Math.abs(p.vF))) / PV.vmax) * 1.3, 0.5, 2.2);
    }
    const onPointer = () => despertarAudio();
    window.addEventListener('pointerdown', onPointer);
    aLimpiar.push(() => { window.removeEventListener('pointerdown', onPointer); try { audio.el?.pause(); audio.ctx?.close(); } catch { /* */ } });

    // ── Cámaras (una por jugador) ──
    const mirar = new THREE.Vector3(), objCam = new THREE.Vector3();
    function alternarCamara() {
        jugadores.forEach(p => { p.vista = p.vista === 'exterior' ? 'cerca' : 'exterior'; p.grupo.userData.cabina.visible = p.vista === 'exterior'; p.camIniciada = false; });
    }
    function actualizarCamara(p, dt) {
        const cam = p.camara;
        const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
        const vel = Math.abs(p.vF);
        const fovObj = 62 + Math.min(10, vel * 0.25) + (p.turbo > 0 ? 8 : 0);
        cam.fov += (fovObj - cam.fov) * Math.min(1, dt * 3); cam.updateProjectionMatrix();
        if (p.vista === 'cerca') {
            const h = tipoV === 'moto' ? 1.55 : 1.3, adel = tipoV === 'moto' ? -0.2 : 0.4;
            cam.position.set(p.x - fx * adel, h, p.z - fz * adel);
            mirar.set(p.x + fx * 20, 0.9, p.z + fz * 20);
            cam.lookAt(mirar);
            return;
        }
        const dist = tipoV === 'moto' ? 5 : 6.8, alt = tipoV === 'moto' ? 2.2 : 2.7;
        // dirección de la cámara: mezcla del morro y de la velocidad real
        const vxr = fx * p.vF + -fz * p.vL, vzr = fz * p.vF + fx * p.vL, vn = Math.hypot(vxr, vzr);
        let cfx = fx, cfz = fz;
        if (vn > 3 && p.vF > 0) { cfx = fx * 0.4 + (vxr / vn) * 0.6; cfz = fz * 0.4 + (vzr / vn) * 0.6; const n = Math.hypot(cfx, cfz); cfx /= n; cfz /= n; }
        objCam.set(p.x - cfx * dist, alt, p.z - cfz * dist);
        if (!p.camIniciada) { p.posCam.copy(objCam); p.camIniciada = true; }
        p.posCam.lerp(objCam, 1 - Math.exp(-dt * 6));
        cam.position.copy(p.posCam);
        mirar.set(p.x + cfx * 6, 1.2, p.z + cfz * 6);
        cam.lookAt(mirar);
    }

    // ── Minimapa ──
    const mm = op.minimapa || null;
    let fondoMM = null, escMM = 1, oxMM = 0, ozMM = 0;
    if (mm) {
        fondoMM = document.createElement('canvas'); fondoMM.width = mm.width; fondoMM.height = mm.height;
        const c = fondoMM.getContext('2d');
        const span = Math.max(maxX - minX, maxZ - minZ) + 30;
        escMM = mm.width / span; oxMM = cx - span / 2; ozMM = cz - span / 2;
        c.fillStyle = 'rgba(15,20,28,0.85)'; c.fillRect(0, 0, mm.width, mm.height);
        c.strokeStyle = '#b0bec5'; c.lineWidth = Math.max(3, W * escMM); c.lineJoin = 'round';
        c.beginPath(); M.forEach((m, i) => { const X = (m.x - oxMM) * escMM, Z = (m.z - ozMM) * escMM; if (i) c.lineTo(X, Z); else c.moveTo(X, Z); }); c.closePath(); c.stroke();
        const m0 = M[0]; c.fillStyle = '#fff'; c.fillRect((m0.x - oxMM) * escMM - 3, (m0.z - ozMM) * escMM - 3, 6, 6);
    }
    function dibujarMinimapa() {
        if (!mm) return;
        const c = mm.getContext('2d');
        c.drawImage(fondoMM, 0, 0);
        checkpoints.forEach(cp => {
            const m = M[cp.i];
            c.fillStyle = cp.estado === 'bien' ? '#69f0ae' : cp.estado === 'mal' ? '#ff5252' : cp.k === jug.cpSig && nJug === 1 ? '#ffd600' : '#40c4ff';
            c.beginPath(); c.arc((m.x - oxMM) * escMM, (m.z - ozMM) * escMM, 4, 0, Math.PI * 2); c.fill();
        });
        vehiculos.forEach(v => {
            c.fillStyle = '#' + new THREE.Color(v.color).getHexString();
            c.beginPath(); c.arc((v.x - oxMM) * escMM, (v.z - ozMM) * escMM, v.esJugador ? 5.5 : 4, 0, Math.PI * 2); c.fill();
            if (v.esJugador) { c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); }
        });
    }

    // ── Bucle ──
    const formatoTiempo = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}.${String(Math.floor((t % 1) * 100)).padStart(2, '0')}`;
    let ultimaCuenta = 4;
    function simular(dt) {
        tiempo += dt;
        if (!enCarrera && !terminada) {
            cuenta -= dt;
            const n = Math.ceil(cuenta);
            if (n !== ultimaCuenta && n >= 0) { ultimaCuenta = n; if (n > 0 && n <= 3) pitido(440); if (n === 0) pitido(880, 0.4); }
            if (cuenta <= 0) { enCarrera = true; cb.onSalida?.(); }
        }
        const corriendo = enCarrera;
        if (corriendo && !terminada) tiempoCarrera += dt;
        if (cierreEn != null && !terminada) { cierreEn -= dt; if (cierreEn <= 0) terminarCarrera(); }
        vehiculos.forEach(v => {
            if (v.esperando) { v.vF = 0; v.vL = 0; v.derrape = false; return; } // respondiendo su pregunta: parado
            const ent = !corriendo ? { steer: 0, acel: 0, freno: 1, atras: 0 } : v.esJugador ? (terminada ? { steer: 0, acel: 0, freno: 0.6, atras: 0 } : v.ia ? entradasIA(v) : entradasJugador(v)) : (v.terminado ? { ...entradasIA(v), acel: 0.4 } : entradasIA(v));
            const idxPrevio = v.idx, sPrevio = M[v.idx].s;
            fisica(v, ent, dt);
            if (v.turbo > 0) v.turbo -= dt;
            if (v.lento > 0) v.lento -= dt;
            if (corriendo) { actualizarVuelta(v, idxPrevio); if (!pausado) revisarCheckpoints(v, sPrevio); }
            // derrape: humo de las ruedas traseras y marcas en el suelo
            if (v.derrape && Math.abs(v.vF) > 6) {
                const fx = -Math.sin(v.yaw), fz = -Math.cos(v.yaw), rx = -fz, rz = fx, atrasR = tipoV === 'moto' ? 0.7 : 1.35;
                const ancho2 = tipoV === 'moto' ? [0] : [-0.8, 0.8];
                ancho2.forEach(l => {
                    const x = v.x - fx * atrasR + rx * l, z = v.z - fz * atrasR + rz * l;
                    if (Math.random() < (sup === 'tierra' ? 0.8 : 0.55)) emitirHumo(x, z, sup === 'tierra');
                    v.marcaD += Math.abs(v.vF) * dt / ancho2.length;
                    if (v.marcaD > 0.35) { ponerMarca(x, z, Math.atan2(-(fx * v.vF + rx * v.vL), -(fz * v.vF + rz * v.vL))); }
                });
                if (v.marcaD > 0.35) v.marcaD = 0;
            }
            // polvo
            if ((sup === 'tierra' || v.fuera) && Math.abs(v.vF) > 6 && Math.random() < (sup === 'tierra' ? 0.7 : 0.35)) emitir(v.x + Math.sin(v.yaw) * 1.6, v.z + Math.cos(v.yaw) * 1.6);
        });
        colisiones();
        actualizarParticulas(dt);
        // colocar mallas
        vehiculos.forEach(v => {
            v.grupo.position.set(v.x, 0, v.z);
            if (tipoV === 'moto') {
                const curv = Math.tan(v.steer) / PV.L;
                v.ladeo += (clamp(Math.atan((v.vF * v.vF * curv) / 9.8), -0.8, 0.8) - v.ladeo) * Math.min(1, dt * 6);
                v.grupo.rotation.set(0, v.yaw - v.angDerrape, -v.ladeo, 'YXZ');
            } else v.grupo.rotation.set(0, v.yaw - v.angDerrape, 0);
        });
    }
    let acumEstado = 0;
    /** Rectángulos de cada vista: 1 jugador = toda la pantalla; 2 = lado a lado (horizontal) o arriba/abajo (vertical). */
    const vistas = () => {
        const w = ancho(), h = alto();
        if (nJug === 1) return [[0, 0, w, h]];
        if (nJug >= 3) {
            const w2 = Math.floor(w / 2), h2 = Math.floor(h / 2), arriba = h - h2;
            const r = [[0, h2, w2, arriba], [w - w2, h2, w2, arriba]];
            if (nJug === 3) r.push([0, 0, w, h2]); else r.push([0, 0, w2, h2], [w - w2, 0, w2, h2]);
            return r;
        }
        return w >= h ? [[0, 0, Math.floor(w / 2), h], [Math.ceil(w / 2), 0, Math.floor(w / 2), h]] : [[0, Math.ceil(h / 2), w, Math.floor(h / 2)], [0, 0, w, Math.floor(h / 2)]];
    };
    function estadoJugador(p, clasif) {
        return {
            nombre: p.nombre, color: '#' + new THREE.Color(p.color).getHexString(),
            vuelta: clamp(p.vuelta + 1, 1, op.vueltas), posicion: clasif.indexOf(p) + 1,
            tiempo: formatoTiempo(tiempoCarrera + p.res.penalizacion), kmh: Math.round(Math.abs(p.vF) * 3.6), atras: p.vF < -0.3,
            turbo: p.turbo > 0, lento: p.lento > 0, cp: Math.min(p.cpSig + 1, nCP), aciertos: p.res.aciertos, fallos: p.res.fallos, puntos: p.res.puntos,
            fuera: !!p.fuera, vista: p.vista, derrape: !!p.derrape && !p.autoIA, tDerrape: p.derrape ? Math.round(p.tDerrape * 10) / 10 : 0,
            terminado: p.terminado, puesto: p.puesto || null, esperando: !!p.esperando,
        };
    }
    function renderizar(dt) {
        checkpoints.forEach(cp => { if (cp.estado === 'pendiente') cp.brillo.material.opacity = 0.1 + 0.08 * Math.sin(tiempo * 4); });
        sonidoMotor();
        acumEstado += dt;
        if (acumEstado > 0.1) {
            acumEstado = 0;
            const clasif = clasificacion();
            const ests = jugadores.map(p => estadoJugador(p, clasif));
            cb.onEstado?.({
                ...ests[0], vueltas: op.vueltas, total, nCP, cuenta: enCarrera ? null : Math.ceil(cuenta),
                jugadores: ests, dosJugadores: nJug > 1, nJugadores: nJug, division: nJug >= 3 ? 'cuadrantes' : ancho() >= alto() ? 'vertical' : 'horizontal', cierre: cierreEn != null ? Math.ceil(cierreEn) : null,
                clasif: clasif.map(o => ({ nombre: o.nombre, esJugador: o.esJugador, color: '#' + new THREE.Color(o.color).getHexString() })),
            });
            dibujarMinimapa();
        }
        const rects = vistas();
        renderer.shadowMap.autoUpdate = nJug === 1;
        renderer.setScissorTest(nJug > 1);
        jugadores.forEach((p, i) => {
            actualizarCamara(p, dt);
            const [x, y, w, h] = rects[i];
            if (p.camara.aspect !== w / h) { p.camara.aspect = w / h; p.camara.updateProjectionMatrix(); }
            // sombras y cielo centrados en cada jugador
            sol.target.position.set(p.x, 0, p.z); sol.position.copy(sol.target.position).add(OFFSET_SOL);
            cielo.position.set(p.x, 0, p.z);
            if (nJug > 1) { if (!ligero) renderer.shadowMap.needsUpdate = true; renderer.setViewport(x, y, w, h); renderer.setScissor(x, y, w, h); }
            renderer.render(escena, p.camara);
        });
        if (nJug > 1) { renderer.setScissorTest(false); renderer.setViewport(0, 0, ancho(), alto()); }
    }
    const reloj = new THREE.Clock();
    renderer.setAnimationLoop(() => {
        const dt = Math.min(reloj.getDelta(), 0.05);
        if (reanudarEn > 0) { reanudarEn -= dt; if (reanudarEn <= 0) pausado = false; }
        if (!pausado) simular(dt);
        renderizar(dt);
    });

    // ── Redimensionar ──
    const onResize = () => { renderer.setSize(ancho(), alto()); }; // el aspecto de cada cámara se ajusta al dibujar
    const ro = new ResizeObserver(onResize); ro.observe(contenedor);
    aLimpiar.push(() => ro.disconnect());

    // ═══════════════ API ═══════════════
    return {
        /** Resultado de la pregunta del checkpoint: acierto = turbo; fallo = +5 s y frenazo. */
        responder(ok, detalle = {}, jIdx = 0) {
            const p = jugadores[jIdx] || jug;
            const cp = nJug === 1 ? preguntaActiva : p.esperando; if (!cp) return;
            if (nJug === 1) preguntaActiva = null; else p.esperando = null;
            p.res.preguntas.push({ checkpoint: cp.k + 1, vuelta: p.vuelta + 1, ok: !!ok, ...detalle });
            if (ok) { p.res.aciertos++; p.res.puntos += 100; p.turbo = 3.6; pitido(1200, 0.25, 0.1); }
            else { p.res.fallos++; p.res.penalizacion += 5; p.lento = 2; pitido(200, 0.35, 0.12); }
            if (nJug === 1) { marcarCheckpoint(cp, ok ? 'bien' : 'mal'); if (!ok) p.vF *= 0.55; reanudarEn = 0.6; }
        },
        setEntradaTactil(o, jIdx = 0) { Object.assign((jugadores[jIdx] || jug).tactil, o); },
        /** Mandos micro:bit (o cualquier mando externo): se suma al teclado y a la pantalla táctil. */
        setEntradaMando(o, jIdx = 0) { const p = jugadores[jIdx]; if (p) Object.assign(p.mando, o); },
        alternarCamara,
        pausar(b) { if (!preguntaActiva) pausado = !!b; reloj.getDelta(); },
        setSonido(on) { audio.on = !!on; if (!on) audio.el?.pause(); else despertarAudio(); },
        despertarAudio,
        destruir() {
            destruido = true;
            renderer.setAnimationLoop(null);
            aLimpiar.forEach(f => { try { f(); } catch { /* */ } });
            escena.traverse(o => {
                if (o.geometry) o.geometry.dispose();
                const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
                ms.forEach(m => { m.map?.dispose(); m.dispose(); });
            });
            renderer.dispose(); renderer.domElement.remove();
        },
        _depurar: () => ({ jug, jugadores, vehiculos, C, checkpoints, res, tactil: jug.tactil, estado: () => ({ enCarrera, terminada, pausado, tiempoCarrera }) }),
        /** Pruebas: el jugador conduce con la misma IA (habilidad h). */
        _autopiloto(h = 0.9, jIdx = 0) { jugadores[jIdx].ia = { habilidad: h, base: 0, fase: 1, cpHechos: new Set() }; },
        _paso(dt, n = 1) { for (let k = 0; k < n; k++) { if (reanudarEn > 0) { reanudarEn -= dt; if (reanudarEn <= 0) pausado = false; } if (!pausado) simular(dt); } },
        _render() { renderizar(0.016); },
    };
}

export { prepararCircuito };
