// Motor three.js de La Mansión Pitagórica: escape room con el personaje Pi.
// Funciona en ordenador (teclado + ratón), móvil (joystick + botón de salto) y gafas VR
// (WebXR, Meta Quest: stick para andar, giro a saltos, teletransporte con A/X, linterna
// en la mano y gatillo para elegir). Con `jugadores: 2` es un modo dual colaborativo a
// pantalla partida: cada uno empieza en una zona de la casa y comparten pistas y vidas.
//
//   const motor = crearMansion(div, { escenarios: ['mansion'], preguntas, minimapa, modo, jugadores }, callbacks)
//   modo: 'pi' (por defecto: personaje Pi, cajas y conos de visión) | 'clasico' (1ª persona,
//   panel de pregunta en la puerta y enemigos que te persiguen si te ven; solo 1 jugador)
//   callbacks: onEstado(est), onPregunta(jugador, {enunciado, opciones, panel?} | null),
//              onCandado({len, pistas, jugador} | null), onAviso(texto, tipo, jugador),
//              onEvento(tipo, extra) ← para el narrador, onNivel(info), onFin(resultado)
//   motor.responder(i) (clásico) · motor.saltar(j) · motor.alternarVista() · motor.probarCodigo([..])
//   motor.cerrarModal() · motor.setJoystick(x, y, j) · motor.mirar(dx, dy) · motor.entrarVR(session)
//   motor.avisoVR(texto) · motor.destruir()
//
// Mecánicas (modo Pi):
//  · Delante de cada puerta salen 4 cajas (A-D): ponte debajo de la tuya y SALTA para darle.
//  · Los enemigos siguen siempre su ruta; si entras en su cono de visión, te atrapan.
//  · Las trampas del suelo solo se ven al iluminarlas con la linterna.
//  · Las pistas dan las cifras del candado que abre la salida del nivel.
// Rendimiento (Quest): geometría simple con texturas pintadas en canvas, muros/suelos
// instanciados, 2 luces por jugador (la suya y la linterna) y sin sombras reales.
import * as THREE from 'three';
import { ESCENARIOS } from './escenarios';
import { textura, texturaTexto, texturaBrillo, texturaRuna } from './texturas';
import { crearPersonajePi } from '../personajes/personajePi';
import { sonidoCorrecto, sonidoIncorrecto, sonidoActivo } from '../utils/sonidosFeedback';

const C = 3;          // lado de la celda (m)
const ALTO = 3;       // altura de las paredes
const OJOS = 1.6;
const R = 0.3;        // radio del jugador
const VEL = 3.4, VEL_VR = 2.2, GIRO = 2.4;
export const VIDAS = 5;
const DIST_CANDADO = 2.05;
const DIST_CAJAS = 3.6;          // las cajas salen al ponerse delante de la puerta (no al pasar por el lado)
const ALTURA_PI = 1.48;          // altura de la cabeza del personaje
const CAJA_Y = 2.05, CAJA = 0.6; // base y lado de las cajas de respuesta
const SALTO = 6.4, GRAV = 19;    // salto de ~1,1 m
const VISION = 4.8, MEDIO_ANGULO = 0.5; // cono de visión de los enemigos (m, rad)
const LETRAS = ['A', 'B', 'C', 'D'];
const COLORES_CAJA = ['#7c3aed', '#db2777', '#d97706', '#059669'];
// Jugador 1 morado con gorra amarilla, jugador 2 verde con gorra rosa
const ASPECTO = [{ color: 0x8b5cf6, colorGorra: 0xfacc15 }, { color: 0x10b981, colorGorra: 0xf472b6 }];
// Teclas: un jugador (← → giran, A/D de lado) o dual (J1 WASD + espacio/F, J2 flechas + Enter)
const CONTROLES = {
    solo: { adelante: ['KeyW', 'ArrowUp'], atras: ['KeyS', 'ArrowDown'], girarIzq: ['ArrowLeft', 'KeyQ'], girarDer: ['ArrowRight', 'KeyE'], ladoIzq: ['KeyA'], ladoDer: ['KeyD'], salto: ['Space'], correr: ['ShiftLeft'] },
    j1: { adelante: ['KeyW'], atras: ['KeyS'], girarIzq: ['KeyA'], girarDer: ['KeyD'], ladoIzq: ['KeyQ'], ladoDer: ['KeyE'], salto: ['Space', 'KeyF'], correr: ['ShiftLeft'] },
    j2: { adelante: ['ArrowUp'], atras: ['ArrowDown'], girarIzq: ['ArrowLeft'], girarDer: ['ArrowRight'], ladoIzq: [], ladoDer: [], salto: ['Enter', 'NumpadEnter', 'Numpad0', 'ShiftRight'], correr: [] },
};
const TECLAS_JUEGO = new Set(['Space', 'Enter', 'NumpadEnter', 'Numpad0', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export const OPCIONES_XR = { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] };
export const pedirSesionVR = () => navigator.xr.requestSession('immersive-vr', OPCIONES_XR);

// ── Sonidos sintetizados (sin ficheros) ──────────────────────────────────────
function audio() {
    try {
        if (!window.gameAudioCtx) window.gameAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const c = window.gameAudioCtx; if (c.state === 'suspended') c.resume();
        return c;
    } catch { return null; }
}
function nota(f0, f1, dur, tipo = 'sine', vol = 0.12, retraso = 0) {
    if (!sonidoActivo()) return;
    const c = audio(); if (!c) return;
    const t = c.currentTime + retraso, o = c.createOscillator(), g = c.createGain();
    o.type = tipo; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
}
const SON = {
    puerta: () => { nota(140, 70, 0.7, 'sawtooth', 0.05); nota(90, 60, 0.7, 'triangle', 0.08); },
    pista: () => [880, 1175, 1568].forEach((f, i) => nota(f, f, 0.18, 'triangle', 0.1, i * 0.09)),
    dano: () => { nota(320, 70, 0.45, 'square', 0.08); nota(160, 50, 0.5, 'sawtooth', 0.06); },
    candado: () => [523, 659, 784, 1046].forEach((f, i) => nota(f, f, 0.22, 'triangle', 0.12, i * 0.11)),
    error: () => { nota(220, 200, 0.16, 'square', 0.07); nota(170, 150, 0.22, 'square', 0.07, 0.16); },
    clic: () => nota(1400, 1000, 0.05, 'square', 0.04),
    salto: () => nota(300, 620, 0.16, 'square', 0.04),
    caja: () => { nota(520, 380, 0.09, 'square', 0.07); nota(780, 780, 0.08, 'triangle', 0.05, 0.05); },
    visto: (tipo) => tipo === 'dron' ? [1300, 900, 1300].forEach((f, i) => nota(f, f, 0.08, 'square', 0.05, i * 0.1))
        : tipo === 'momia' ? nota(110, 70, 1.0, 'sawtooth', 0.07) : nota(520, 260, 1.1, 'sine', 0.09),
    trampa: (tipo) => tipo === 'laser' ? nota(1800, 300, 0.35, 'sawtooth', 0.07) : tipo === 'fuego' ? nota(200, 60, 0.6, 'sawtooth', 0.09) : nota(900, 1600, 0.4, 'sine', 0.08),
    victoria: () => [523, 659, 784, 1046, 784, 1046].forEach((f, i) => nota(f, f, 0.25, 'triangle', 0.12, i * 0.12)),
};

const barajar = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const angDif = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
function lineas(g, txt, maxW) {
    const out = []; let cur = '';
    String(txt).split(/\s+/).forEach(w => { const t = cur ? cur + ' ' + w : w; if (cur && g.measureText(t).width > maxW) { out.push(cur); cur = w; } else cur = t; });
    if (cur) out.push(cur);
    return out;
}
/** Escribe texto en varias líneas dentro de una caja, bajando la letra si no cabe. */
function textoEnCaja(g, txt, x, y, w, h, { max = 52, min = 22, color = '#fff', peso = 'bold' } = {}) {
    let fs = max, ls;
    for (; ;) { g.font = `${peso} ${fs}px "Segoe UI", system-ui, sans-serif`; ls = lineas(g, txt, w); if ((ls.length * fs * 1.18 <= h) || fs <= min) break; fs -= 3; }
    const lh = fs * 1.18, y0 = y + h / 2 - (ls.length - 1) * lh / 2;
    g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
    ls.forEach((l, i) => g.fillText(l, x + w / 2, y0 + i * lh));
}
function cajaRedonda(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function lienzoTex(w, h, pintar) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    pintar(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.userData.propia = true;
    return t;
}
/** Cara de una caja de respuesta: letra grande y el texto de la respuesta. */
function texturaCaja(letra, texto, color) {
    return lienzoTex(512, 512, (g, W, H) => {
        g.fillStyle = color; g.fillRect(0, 0, W, H);
        g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 26; g.strokeRect(13, 13, W - 26, H - 26);
        g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 6; g.strokeRect(38, 38, W - 76, H - 76);
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.arc(W / 2, 118, 62, 0, 7); g.fill();
        g.fillStyle = '#fff'; g.font = 'bold 96px "Segoe UI", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(letra, W / 2, 122);
        textoEnCaja(g, texto, 52, 196, W - 104, 270, { max: 120, min: 30 });
    });
}
/** Cartel de la puerta: solo la pregunta (las respuestas están en las cajas). */
function texturaCartel(q) {
    return lienzoTex(1024, 420, (g, W, H) => {
        cajaRedonda(g, 6, 6, W - 12, H - 12, 34); g.fillStyle = 'rgba(12,6,28,0.93)'; g.fill();
        g.lineWidth = 6; g.strokeStyle = '#facc15'; g.stroke();
        textoEnCaja(g, q.enunciado, 40, 24, W - 80, H - 48, { max: 120, min: 26 });
    });
}

// ── Enemigos (modelos hechos con geometría simple; miran hacia +Z) ──────────
function crearEnemigo(tipo, esc) {
    const g = new THREE.Group(), partes = {};
    if (tipo === 'fantasma') {
        const mat = new THREE.MeshLambertMaterial({ color: 0xece8ff, emissive: 0x4a3a80, transparent: true, opacity: 0.82, side: THREE.DoubleSide });
        const cuerpo = new THREE.CylinderGeometry(0.42, 0.52, 0.95, 20, 3, true);
        const p = cuerpo.attributes.position;
        for (let i = 0; i < p.count; i++) if (p.getY(i) < -0.45) { const a = Math.atan2(p.getZ(i), p.getX(i)); p.setY(i, p.getY(i) + Math.sin(a * 7) * 0.09 - 0.04); }
        cuerpo.computeVertexNormals();
        const c = new THREE.Mesh(cuerpo, mat); c.position.y = 0.48; g.add(c);
        const cab = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat); cab.position.y = 0.95; g.add(cab);
        const matOjo = new THREE.MeshBasicMaterial({ color: 0x110022 });
        [-0.15, 0.15].forEach(x => { const o = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), matOjo); o.position.set(x, 1.05, 0.38); o.scale.z = 0.5; g.add(o); });
        const boca = new THREE.Mesh(new THREE.CircleGeometry(0.08, 14), matOjo); boca.position.set(0, 0.85, 0.42); boca.scale.y = 1.4; g.add(boca);
        partes.ojos = matOjo; partes.cuerpo = mat; g.userData.altura = 0.55;
    } else if (tipo === 'momia') {
        const mat = new THREE.MeshLambertMaterial({ map: textura('vendas') });
        const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 1.25, 12), mat); cuerpo.position.y = 0.72; g.add(cuerpo);
        const cab = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10), mat); cab.position.y = 1.52; g.add(cab);
        const brazos = new THREE.Group(); brazos.position.y = 1.18; g.add(brazos);
        [-0.22, 0.22].forEach(x => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.62), mat); b.position.set(x, 0, 0.3); brazos.add(b); });
        const matOjo = new THREE.MeshBasicMaterial({ color: 0xffd23a });
        [-0.09, 0.09].forEach(x => { const o = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), matOjo); o.position.set(x, 1.56, 0.21); g.add(o); });
        partes.brazos = brazos; partes.ojos = matOjo; g.userData.altura = 0;
    } else { // dron
        const mat = new THREE.MeshLambertMaterial({ color: 0x8a96a6, emissive: 0x101820 });
        const cuerpo = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 12), mat); cuerpo.position.y = 1.5; g.add(cuerpo);
        const anillo = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.035, 8, 32), new THREE.MeshBasicMaterial({ color: esc.colorDeco }));
        anillo.rotation.x = Math.PI / 2; anillo.position.y = 1.5; g.add(anillo);
        const matOjo = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
        const ojo = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), matOjo); ojo.position.set(0, 1.52, 0.27); g.add(ojo);
        partes.anillo = anillo; partes.ojos = matOjo; g.userData.altura = 0;
    }
    return { g, partes };
}
const COLOR_CONO = { fantasma: 0xc4b5fd, momia: 0xffc94a, dron: 0xff4040 };

// ══════════════════════════════════════════════════════════════════════════════
export function crearMansion(contenedor, opciones = {}, cb = {}) {
    const escenarios = (opciones.escenarios || ['mansion']).filter(id => ESCENARIOS[id]);
    const bancoPreguntas = (opciones.preguntas || []).filter(p => p && p.enunciado && Array.isArray(p.opciones) && p.opciones.length >= 2);
    const minimapa = opciones.minimapa || null;
    const clasico = opciones.modo === 'clasico';
    const dual = !clasico && opciones.jugadores === 2;
    const emit = (nombre, ...a) => { try { cb[nombre]?.(...a); } catch (e) { console.error('[Mansion]', nombre, e); } };

    let killed = false;
    const limpiezas = [];
    const on = (el, ev, fn, o) => { el.addEventListener(ev, fn, o); limpiezas.push(() => el.removeEventListener(ev, fn, o)); };

    // ── Renderer y escena ──
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dual ? 1.5 : 1.75));
    renderer.setSize(contenedor.clientWidth || innerWidth, contenedor.clientHeight || innerHeight);
    renderer.xr.enabled = !dual;
    renderer.xr.setReferenceSpaceType('local-floor');
    const lienzo = renderer.domElement;
    lienzo.style.display = 'block'; lienzo.style.touchAction = 'none';
    contenedor.appendChild(lienzo);

    const scene = new THREE.Scene();
    const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 0.5); scene.add(hemi);
    const aspecto = () => ((contenedor.clientWidth || innerWidth) / (dual ? 2 : 1)) / (contenedor.clientHeight || innerHeight);

    // ── Jugadores ──
    // rig = jugador: en pantalla está en los pies del personaje; en VR es el origen del espacio de las gafas
    function crearJugador(i) {
        const camera = new THREE.PerspectiveCamera(72, aspecto(), 0.05, 90);
        camera.rotation.order = 'YXZ'; camera.position.set(0, OJOS, 0);
        const rig = new THREE.Group(); rig.add(camera); scene.add(rig);
        const pi = crearPersonajePi({ ...ASPECTO[i], linterna: true });
        scene.add(pi.grupo);
        const tinte = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0, side: THREE.BackSide, depthTest: false, depthWrite: false, toneMapped: false, fog: false }));
        tinte.renderOrder = 30; tinte.visible = false; camera.add(tinte);
        return {
            i, rig, camera, pi, tinte, tinteA: 0,
            luz: new THREE.PointLight(0xffffff, 7, 14, 1),
            linterna: new THREE.SpotLight(0xffffff, 26, 24, 0.42, 0.5, 1.1),
            yaw: 0, pitch: 0, py: 0, vy: 0, enSuelo: true, velAndar: 0,
            checkpoint: new THREE.Vector3(), puertaActiva: null, invulnerable: 0, enSalida: false,
            joy: { x: 0, y: 0 }, controles: dual ? (i ? CONTROLES.j2 : CONTROLES.j1) : CONTROLES.solo,
        };
    }
    const jugadores = dual ? [crearJugador(0), crearJugador(1)] : [crearJugador(0)];
    const J0 = jugadores[0];
    const rig = J0.rig, camera = J0.camera;        // (VR: solo el jugador 1)
    let tercera = opciones.tercera ?? !clasico;
    if (dual) tercera = true;

    const onResize = () => {
        if (renderer.xr.isPresenting) return;
        const w = contenedor.clientWidth || innerWidth, h = contenedor.clientHeight || innerHeight;
        jugadores.forEach(J => { J.camera.aspect = aspecto(); J.camera.updateProjectionMatrix(); });
        renderer.setSize(w, h);
    };
    on(window, 'resize', onResize);

    // ── Estado de la partida ──
    let nivelIdx = 0, esc = null, mapa = null, grupoNivel = null;
    let vidas = VIDAS + (dual ? 1 : 0), puntos = 0, aciertos = 0, fallos = 0, tiempo = 0, nivelesSuperados = 0;
    const maxVidas = vidas;
    let puertas = [], candado = null, salida = null, pistas = [], trampas = [], enemigos = [], decos = [];
    let codigo = [], pistasHalladas = [];
    const puertaEn = new Map();
    let vistas = new Set();
    let modal = null;            // { tipo:'candado', valores, jugador } | modo clásico: { tipo:'pregunta', puerta, pregunta }
    let fin = false, transicion = 0, avisoSalida = 0, candadoAvisado = false;
    let colaPreguntas = [];
    const sigPregunta = () => { if (!colaPreguntas.length) colaPreguntas = barajar(bancoPreguntas); return colaPreguntas.shift(); };
    const nombreJ = (J) => dual ? (J.i ? 'Jugador 2' : 'Jugador 1') : '';

    const celda = (x, z) => (mapa && mapa[z] && mapa[z][x]) || '#';
    const aCelda = (v) => Math.round(v / C);
    const clave = (x, z) => x + ',' + z;
    function solida(cx, cz) {
        if (celda(cx, cz) === '#') return true;
        const p = puertaEn.get(clave(cx, cz));
        return !!(p && !p.abierta);
    }
    function libre(x, z, r = R) {
        for (const dx of [-r, r]) for (const dz of [-r, r]) if (solida(aCelda(x + dx), aCelda(z + dz))) return false;
        return true;
    }
    function lineaVista(ax, az, bx, bz) {
        const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.4);
        for (let i = 1; i < n; i++) { const t = i / n; if (solida(aCelda(ax + (bx - ax) * t), aCelda(az + (bz - az) * t))) return false; }
        return true;
    }
    function bfs(desde, hasta) {
        const [sx, sz] = desde, [tx, tz] = hasta;
        if (sx === tx && sz === tz) return [];
        const prev = new Map([[clave(sx, sz), null]]), cola = [[sx, sz]];
        while (cola.length) {
            const [x, z] = cola.shift();
            for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = x + dx, nz = z + dz, k = clave(nx, nz);
                if (prev.has(k) || solida(nx, nz)) continue;
                prev.set(k, [x, z]);
                if (nx === tx && nz === tz) {
                    const camino = []; let c = [nx, nz];
                    while (c && !(c[0] === sx && c[1] === sz)) { camino.unshift(c); c = prev.get(clave(c[0], c[1])); }
                    return camino;
                }
                cola.push([nx, nz]);
            }
        }
        return null;
    }

    const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpQ = new THREE.Quaternion();
    /** Posición del jugador (x, z del suelo; y = altura de los ojos). En VR, la cabeza real. */
    const posJ = (J, out = new THREE.Vector3()) => {
        if (J === J0 && renderer.xr.isPresenting) camera.getWorldPosition(out);
        else out.set(J.rig.position.x, J.rig.position.y + OJOS, J.rig.position.z);
        return out;
    };
    const cabeza = new THREE.Vector3();
    const posCabeza = () => posJ(J0, cabeza);

    function liberar(obj) {
        obj.traverse(o => {
            if (o.geometry) o.geometry.dispose();
            const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
            ms.forEach(m => { if (m.map && m.map.userData.propia) m.map.dispose(); m.dispose(); });
        });
    }
    const texPropia = (t) => { t.userData.propia = true; return t; };

    // Linterna y luz de cada jugador: en la cámara (1ª persona), en el personaje (3ª) o en el mando (VR)
    function montarLuces(J) {
        if (J === J0 && renderer.xr.isPresenting) return;
        if (tercera) {
            J.pi.grupo.add(J.luz); J.luz.position.set(0, 2.3, -1.2); // detrás y arriba: ilumina lo que ve la cámara
            J.pi.grupo.add(J.linterna); J.pi.grupo.add(J.linterna.target);
            J.linterna.position.set(0.55, 0.95, 0.25); J.linterna.target.position.set(0.35, 0, 4.5);
        } else {
            J.camera.add(J.luz); J.luz.position.set(0, 0.1, 0);
            J.camera.add(J.linterna); J.camera.add(J.linterna.target);
            J.linterna.position.set(0.12, -0.12, 0); J.linterna.target.position.set(0, -0.3, -1);
        }
    }
    jugadores.forEach(montarLuces);

    // ── Construcción de un nivel ─────────────────────────────────────────────
    function construirNivel(i) {
        if (grupoNivel) { scene.remove(grupoNivel); liberar(grupoNivel); }
        nivelIdx = i; esc = ESCENARIOS[escenarios[i]]; mapa = esc.mapa;
        grupoNivel = new THREE.Group(); scene.add(grupoNivel);
        puertas = []; pistas = []; trampas = []; enemigos = []; decos = []; puertaEn.clear(); candado = null; salida = null; vistas = new Set();
        candadoAvisado = false;
        jugadores.forEach(J => { J.puertaActiva = null; J.enSalida = false; emit('onPregunta', J.i, null); });
        let semilla = 11 + i * 97; const rnd = () => { semilla = (semilla * 16807) % 2147483647; return (semilla - 1) / 2147483646; };

        scene.fog = new THREE.FogExp2(esc.colorNiebla, esc.niebla * 0.8);
        scene.background = new THREE.Color(esc.colorNiebla);
        hemi.color.setHex(esc.cielo); hemi.groundColor.setHex(esc.tierra); hemi.intensity = esc.luzAmbiente * 2.4;
        jugadores.forEach(J => { J.luz.color.setHex(esc.colorJugador); J.linterna.color.setHex(esc.colorLinterna); });

        const H = mapa.length, W = mapa[0].length;
        const muros = [], suelos = [];
        let inicio = [1, 1];
        for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
            const ch = celda(x, z);
            if (ch === '#') {
                let visible = false;
                for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (celda(x + dx, z + dz) !== '#') visible = true;
                if (visible) muros.push([x, z]);
                continue;
            }
            suelos.push([x, z]);
            if (ch === 'S') inicio = [x, z];
            if (ch === 'D' || ch === 'L') crearPuerta(x, z, ch === 'L');
            if (ch === 'E') crearSalida(x, z);
            if (ch === 'T') crearTrampa(x, z);
            if (/[1-9]/.test(ch)) crearPista(x, z, +ch - 1);
        }
        const m4 = new THREE.Matrix4();
        const imMuros = new THREE.InstancedMesh(new THREE.BoxGeometry(C, ALTO, C), new THREE.MeshLambertMaterial({ map: textura(esc.paredes) }), muros.length);
        muros.forEach(([x, z], k) => imMuros.setMatrixAt(k, m4.makeTranslation(x * C, ALTO / 2, z * C)));
        grupoNivel.add(imMuros);
        const imSuelo = new THREE.InstancedMesh(new THREE.PlaneGeometry(C, C).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: textura(esc.suelo) }), suelos.length);
        const imTecho = new THREE.InstancedMesh(new THREE.PlaneGeometry(C, C).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ map: textura(esc.techo) }), suelos.length);
        suelos.forEach(([x, z], k) => { imSuelo.setMatrixAt(k, m4.makeTranslation(x * C, 0, z * C)); imTecho.setMatrixAt(k, m4.makeTranslation(x * C, ALTO, z * C)); });
        grupoNivel.add(imSuelo, imTecho);

        crearDecoracion(rnd);
        esc.rutas.forEach((ruta, k) => crearEnemigoEn(ruta, k)); // después de las puertas: las rutas no las cruzan

        // Código del candado: una cifra por pista
        codigo = pistas.map(() => Math.floor(Math.random() * 10));
        pistasHalladas = pistas.map(() => null);

        // Colocar a cada jugador en su inicio, mirando hacia la primera celda libre
        const inicios = [inicio, dual && esc.inicio2 ? esc.inicio2 : inicio];
        jugadores.forEach(J => {
            const [sx, sz] = inicios[J.i];
            const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
            const d = dirs.find(([dx, dz]) => celda(sx + dx, sz + dz) !== '#') || [0, 1];
            J.yaw = Math.atan2(-d[0], -d[1]); J.pitch = 0;
            if (J === J0 && renderer.xr.isPresenting) { rig.rotation.y = J.yaw; rig.updateMatrixWorld(true); }
            colocarJugador(J, sx * C, sz * C);
            J.checkpoint.set(sx * C, 0, sz * C);
        });
        marcarVistas();
        emit('onNivel', { idx: i, total: escenarios.length, id: esc.id, nombre: esc.nombre, emoji: esc.emoji, enemigo: esc.nombreEnemigo, trampa: esc.nombreTrampa, peligros: esc.peligros });
        emit('onEvento', 'inicio', { id: esc.id, idx: i, dual });
        emitirEstado();
    }

    function colocarJugador(J, x, z) {
        J.py = 0; J.vy = 0; J.enSuelo = true;
        if (J === J0 && renderer.xr.isPresenting) {
            const h = posCabeza();
            rig.position.x += x - h.x; rig.position.z += z - h.z;
        } else {
            J.rig.position.set(x, 0, z); J.rig.rotation.set(0, 0, 0);
        }
    }

    function crearPuerta(x, z, esCandado) {
        const horizontal = celda(x - 1, z) === '#' && celda(x + 1, z) === '#';
        const g = new THREE.Group(); g.position.set(x * C, 0, z * C); if (!horizontal) g.rotation.y = Math.PI / 2;
        const marcoMat = new THREE.MeshLambertMaterial({ color: esc.id === 'nave' ? 0x2a3442 : esc.id === 'piramide' ? 0x5a4020 : 0x2a1608 });
        const viga = new THREE.Mesh(new THREE.BoxGeometry(C, 0.25, 0.4), marcoMat); viga.position.y = ALTO - 0.12; g.add(viga);
        [-1, 1].forEach(s => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.2, ALTO, 0.4), marcoMat); p.position.set(s * (C / 2 - 0.1), ALTO / 2, 0); g.add(p); });
        const hoja = new THREE.Group(); g.add(hoja);
        const tabla = new THREE.Mesh(new THREE.BoxGeometry(C - 0.4, ALTO - 0.25, 0.16), new THREE.MeshLambertMaterial({ map: textura(esc.puerta) }));
        tabla.position.y = (ALTO - 0.25) / 2; hoja.add(tabla);
        let arco = null;
        if (esCandado) {
            const oro = new THREE.MeshLambertMaterial({ color: 0xe0a82a, emissive: 0x4a3000 });
            arco = new THREE.Group();
            [-1, 1].forEach(s => {
                const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.48, 0.16), oro); cuerpo.position.set(0, 1.35, s * 0.17); hoja.add(cuerpo);
                const ojo = new THREE.Mesh(new THREE.CircleGeometry(0.06, 12), new THREE.MeshBasicMaterial({ color: 0x1a1000 })); ojo.position.set(0, 1.33, s * 0.256); if (s < 0) ojo.rotation.y = Math.PI; hoja.add(ojo);
                const asa = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.045, 8, 18, Math.PI), oro); asa.position.set(0, 1.59, s * 0.17); arco.add(asa);
            });
            hoja.add(arco);
        }
        // Cartel «?» (o «🔒») a ambos lados, se mueve con la hoja
        const tex = texPropia(texturaTexto(esCandado ? '🔒' : '?', { color: esCandado ? '#ffd76a' : esc.colorAcento, fuente: 'bold 96px "Segoe UI Emoji", "Segoe UI", sans-serif' }));
        const matCartel = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
        const carteles = [-1, 1].map(s => { const c = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), matCartel); c.position.set(0, esCandado ? 2.15 : 1.75, s * 0.09); if (s < 0) c.rotation.y = Math.PI; hoja.add(c); return c; });
        grupoNivel.add(g);
        const p = { x, z, g, hoja, arco, carteles, horizontal, abierta: false, anim: 0, esCandado, cd: 0, cx: x * C, cz: z * C, pregunta: null, cajas: null, grupoCajas: null, lado: 1, tCajas: 0, usuarios: new Set() };
        puertaEn.set(clave(x, z), p);
        if (esCandado) candado = p; else puertas.push(p);
    }

    function crearSalida(x, z) {
        const g = new THREE.Group(); g.position.set(x * C, 0, z * C);
        const col = new THREE.Color(esc.colorAcento);
        const haz = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, ALTO, 24, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        haz.position.y = ALTO / 2; g.add(haz);
        const aro = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.06, 8, 40), new THREE.MeshBasicMaterial({ color: col }));
        aro.rotation.x = Math.PI / 2; aro.position.y = 0.05; g.add(aro);
        const brillo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaBrillo(), color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
        brillo.scale.setScalar(2.2); brillo.position.y = 1.3; g.add(brillo);
        const cartel = new THREE.Sprite(new THREE.SpriteMaterial({ map: texPropia(texturaTexto('🚪', { fuente: 'bold 90px "Segoe UI Emoji", sans-serif' })), transparent: true, depthWrite: false }));
        cartel.scale.setScalar(0.7); cartel.position.y = 1.3; g.add(cartel);
        grupoNivel.add(g);
        salida = { x, z, g, haz, aro, cx: x * C, cz: z * C };
    }

    function crearTrampa(x, z) {
        const tipo = esc.trampa;
        const g = new THREE.Group(); g.position.set(x * C, 0, z * C);
        const runa = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: texturaRuna(tipo), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
        runa.position.y = 0.02; g.add(runa);
        const color = tipo === 'laser' ? 0xff2a2a : tipo === 'fuego' ? 0xff7a1a : 0xfff0a0;
        const matRayo = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
        const rayo = new THREE.Group(); rayo.visible = false; g.add(rayo);
        if (tipo === 'laser') {
            [0.4, 0.9, 1.4, 1.9].forEach((y, k) => { const b = new THREE.Mesh(new THREE.BoxGeometry(C, 0.04, 0.04), matRayo); b.position.y = y; b.rotation.y = k % 2 ? 0.5 : -0.5; rayo.add(b); });
        } else {
            const cono = new THREE.Mesh(new THREE.CylinderGeometry(tipo === 'fuego' ? 0.3 : 0.25, 1.05, ALTO, 20, 1, true), matRayo);
            cono.position.y = ALTO / 2; rayo.add(cono);
        }
        grupoNivel.add(g);
        trampas.push({ x, z, g, runa, rayo, matRayo, revelada: 0, cd: 0, flash: 0, cx: x * C, cz: z * C });
    }

    function crearPista(x, z, idx) {
        const g = new THREE.Group(); g.position.set(x * C, 1.15, z * C);
        const col = new THREE.Color(esc.colorAcento);
        let geo;
        if (esc.pista === 'libro') geo = new THREE.BoxGeometry(0.42, 0.1, 0.32);
        else if (esc.pista === 'escarabajo') { geo = new THREE.SphereGeometry(0.2, 14, 10); geo.scale(1, 0.55, 1.35); }
        else geo = new THREE.BoxGeometry(0.4, 0.05, 0.3);
        const obj = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: col, emissive: col.clone().multiplyScalar(0.55) }));
        g.add(obj);
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaBrillo(), color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
        halo.scale.setScalar(1.3); g.add(halo);
        const num = new THREE.Sprite(new THREE.SpriteMaterial({ map: texPropia(texturaTexto(String(idx + 1) + 'ª', { color: '#fff', fuente: 'bold 64px "Segoe UI", sans-serif' })), transparent: true, depthWrite: false }));
        num.scale.setScalar(0.42); num.position.y = 0.42; g.add(num);
        grupoNivel.add(g);
        pistas.push({ idx, x, z, g, obj, cogida: false, cx: x * C, cz: z * C, fase: Math.random() * 6 });
    }

    function crearDecoracion(rnd) {
        const brillo = texturaBrillo();
        const col = new THREE.Color(esc.colorDeco);
        const matSoporte = new THREE.MeshLambertMaterial({ color: esc.deco === 'tira' ? 0x2a3442 : 0x3a2412 });
        const matTira = new THREE.MeshBasicMaterial({ color: col });
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        mapa.forEach((fila, z) => [...fila].forEach((ch, x) => {
            if (ch !== '.') return;
            dirs.forEach(([dx, dz]) => {
                if (celda(x + dx, z + dz) !== '#' || rnd() > 0.2) return;
                const px = x * C + dx * (C / 2 - 0.06), pz = z * C + dz * (C / 2 - 0.06);
                if (esc.deco === 'tira') {
                    const t = new THREE.Mesh(new THREE.BoxGeometry(dx ? 0.04 : 2.4, 0.06, dz ? 0.04 : 2.4), matTira);
                    t.position.set(px, 0.32, pz); grupoNivel.add(t);
                    const t2 = t.clone(); t2.position.y = 2.7; grupoNivel.add(t2);
                } else {
                    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, esc.deco === 'vela' ? 0.22 : 0.4, 8), esc.deco === 'vela' ? new THREE.MeshLambertMaterial({ color: 0xeee6d0, emissive: 0x333022 }) : matSoporte);
                    s.position.set(px - dx * 0.12, 1.9, pz - dz * 0.12); grupoNivel.add(s);
                    const llama = new THREE.Sprite(new THREE.SpriteMaterial({ map: brillo, color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
                    llama.position.set(px - dx * 0.12, esc.deco === 'vela' ? 2.1 : 2.2, pz - dz * 0.12);
                    llama.scale.setScalar(esc.deco === 'vela' ? 0.35 : 0.6);
                    grupoNivel.add(llama);
                    decos.push({ llama, base: llama.scale.x, f: rnd() * 10 });
                }
            });
        }));
    }

    // Enemigo: recorrido FIJO precalculado celda a celda entre sus puntos de ruta (modo Pi)
    function crearEnemigoEn(ruta, k) {
        const { g, partes } = crearEnemigo(esc.enemigo, esc);
        const puntosRuta = []; // { x, z, pausa }
        for (let i = 0; i < ruta.length; i++) {
            const a = ruta[i], b = ruta[(i + 1) % ruta.length];
            puntosRuta.push({ x: a[0] * C, z: a[1] * C, pausa: true });
            (bfs(a, b) || []).slice(0, -1).forEach(([x, z]) => puntosRuta.push({ x: x * C, z: z * C, pausa: false }));
        }
        g.position.set(ruta[0][0] * C, 0, ruta[0][1] * C);
        const sig = puntosRuta[1 % puntosRuta.length];
        g.rotation.y = Math.atan2(sig.x - g.position.x, sig.z - g.position.z);
        grupoNivel.add(g);
        // Cono de visión pintado en el suelo
        const cono = new THREE.Mesh(
            new THREE.CircleGeometry(VISION, 28, -Math.PI / 2 - MEDIO_ANGULO, MEDIO_ANGULO * 2).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({ color: COLOR_CONO[esc.enemigo], transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
        cono.position.y = 0.035; cono.visible = !clasico; grupoNivel.add(cono);
        enemigos.push({ g, partes, ruta, puntos: puntosRuta, idx: 1 % puntosRuta.length, espera: 0.6 + k * 0.3, fase: k * 1.7, cono, alarma: 0,
            wp: 1 % ruta.length, camino: [], tRecalc: k * 0.1, modo: 'ronda', perder: 0 }); // wp…perder: modo clásico
    }

    // ── Cajas de respuesta delante de la puerta (modo Pi) ────────────────────
    function quitarCajas(p) {
        if (p.grupoCajas) { grupoNivel.remove(p.grupoCajas); liberar(p.grupoCajas); }
        p.grupoCajas = null; p.cajas = null;
        if (!p.abierta) p.carteles.forEach(c => { c.visible = true; });
    }
    function ponerCajas(p) {
        quitarCajas(p);
        const q = p.pregunta, ops = q.opciones.slice(0, 4);
        const g = new THREE.Group(); grupoNivel.add(g); p.grupoCajas = g;
        const N = p.horizontal ? [0, 1] : [1, 0], s = p.lado;
        const A = [N[1] * s, -N[0] * s]; // derecha del jugador mirando a la puerta: la A queda a su izquierda
        const sep = ops.length >= 4 ? 0.7 : 0.9;
        const geo = new THREE.BoxGeometry(CAJA, CAJA, CAJA);
        p.cajas = ops.map((o, i) => {
            const off = (i - (ops.length - 1) / 2) * sep;
            const mat = new THREE.MeshBasicMaterial({ map: texturaCaja(LETRAS[i], o, COLORES_CAJA[i]) });
            const mesh = new THREE.Mesh(i ? geo.clone() : geo, mat);
            const x = p.cx + A[0] * off + N[0] * s * 1.75, z = p.cz + A[1] * off + N[1] * s * 1.75;
            mesh.position.set(x, CAJA_Y + CAJA / 2, z);
            g.add(mesh);
            return { mesh, i, x, z, bote: 0 };
        });
        // Cartel con la pregunta en la cara de la puerta que mira al jugador
        const cartel = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.3 * 420 / 1024), new THREE.MeshBasicMaterial({ map: texturaCartel(q), transparent: true }));
        cartel.position.set(p.cx + N[0] * s * 0.13, 1.3, p.cz + N[1] * s * 0.13);
        cartel.rotation.y = p.horizontal ? (s > 0 ? 0 : Math.PI) : (s > 0 ? Math.PI / 2 : -Math.PI / 2);
        g.add(cartel);
        p.carteles.forEach(c => { c.visible = false; });
    }
    function activarPuerta(J, p, h) {
        if (J.puertaActiva && J.puertaActiva !== p) desactivarPuerta(J);
        J.puertaActiva = p;
        p.usuarios.add(J.i);
        if (!p.pregunta) p.pregunta = sigPregunta();
        if (!p.pregunta) { p.abierta = true; SON.puerta(); J.puertaActiva = null; return; } // sin preguntas: se abre sin más
        if (!p.cajas) { p.lado = Math.sign(p.horizontal ? h.z - p.cz : h.x - p.cx) || 1; ponerCajas(p); }
        emit('onPregunta', J.i, { enunciado: p.pregunta.enunciado, opciones: p.pregunta.opciones.slice(0, 4) });
    }
    function desactivarPuerta(J) {
        const p = J.puertaActiva;
        if (!p) return;
        p.usuarios.delete(J.i);
        if (!p.usuarios.size) quitarCajas(p); // en dual, solo si el otro no la está usando
        J.puertaActiva = null;
        emit('onPregunta', J.i, null);
    }
    function golpearCaja(J, caja) {
        const p = J.puertaActiva;
        if (!p || p.tCajas > 0 || fin) return;
        caja.bote = 1; SON.caja();
        const q = p.pregunta, ok = q.opciones[caja.i] === q.correcta;
        if (ok) {
            aciertos++; puntos += 100;
            caja.mesh.material.color.setHex(0x9dffb8);
            p.abierta = true; SON.puerta(); sonidoCorrecto(); J.pi.celebrar();
            J.checkpoint.set(J.rig.position.x, 0, J.rig.position.z);
            aviso(`✅ ¡Correcto! La puerta se abre`, 'ok', J);
            emit('onEvento', 'puerta', { jugador: J.i });
            vibrarTodo(0.4, 80);
            p.tCajas = 0.8; // quitar las cajas al terminar el bote
            jugadores.forEach(K => { if (K.puertaActiva === p) emit('onPregunta', K.i, null); });
        } else {
            fallos++; sonidoIncorrecto(); J.pi.susto();
            caja.mesh.material.color.setHex(0xff6b6b);
            p.pregunta = sigPregunta();
            p.tCajas = 1.4; // luego salen cajas nuevas con otra pregunta
            emit('onEvento', 'fallo', { jugador: J.i });
            danar(J, `❌ Era «${q.correcta}». ¡Se activa una trampa!`, false);
        }
        emitirEstado();
    }

    // ── Estado hacia React ───────────────────────────────────────────────────
    function emitirEstado() {
        emit('onEstado', {
            vidas, maxVidas, puntos, aciertos, fallos,
            pistas: pistasHalladas.slice(), nivel: nivelIdx + 1, totalNiveles: escenarios.length,
            escenario: esc ? { id: esc.id, nombre: esc.nombre, emoji: esc.emoji, enemigo: esc.nombreEnemigo, trampa: esc.nombreTrampa, acento: esc.colorAcento } : null,
            puertasAbiertas: puertas.filter(p => p.abierta).length, puertasTotal: puertas.length,
            candadoAbierto: !!candado?.abierta, vr: renderer.xr.isPresenting, tercera, dual,
            enSalida: jugadores.map(J => J.enSalida),
        });
        hudSucio = true;
    }
    let toastTexto = '', toastHasta = 0;
    function aviso(texto, tipo = 'info', J = null) {
        const quien = J && dual ? `${J.i ? '🟢' : '🟣'} ${nombreJ(J)}: ` : '';
        emit('onAviso', quien + texto, tipo, J ? J.i : null);
        toastTexto = quien + texto; toastHasta = performance.now() + 3200; toastSucio = true;
    }

    // ── Candado, pistas, daño ────────────────────────────────────────────────
    function salirPunteroBloqueado() { if (document.pointerLockElement === lienzo) try { document.exitPointerLock(); } catch { } }
    function empujarAtras(J, cx, cz, dist = 0.5) {
        const h = posJ(J, tmpV2);
        tmpV.set(h.x - cx, 0, h.z - cz); if (tmpV.lengthSq() < 1e-4) return; tmpV.normalize().multiplyScalar(dist);
        intentarMover(J, tmpV.x, tmpV.z);
    }
    // Modo clásico: la pregunta sale en un panel al llegar a la puerta (el juego se para)
    function abrirPregunta(p) {
        const q = sigPregunta();
        if (!q) { p.abierta = true; SON.puerta(); return; }
        modal = { tipo: 'pregunta', puerta: p, pregunta: q, hover: -1, jugador: 0 };
        teclas.clear(); J0.joy.x = J0.joy.y = 0; salirPunteroBloqueado();
        emit('onPregunta', 0, { enunciado: q.enunciado, opciones: q.opciones.slice(0, 4), panel: true });
        abrirPanelVR();
    }
    function responder(i) {
        if (!modal || modal.tipo !== 'pregunta' || fin) return;
        const { pregunta: q, puerta: p } = modal;
        const ok = q.opciones[i] === q.correcta;
        cerrarModal(true);
        if (ok) {
            aciertos++; puntos += 100;
            p.abierta = true; SON.puerta(); sonidoCorrecto();
            const h = posCabeza(); J0.checkpoint.set(h.x, 0, h.z);
            aviso('✅ ¡Correcto! La puerta se abre', 'ok');
            emit('onEvento', 'puerta', { jugador: 0 });
            vibrarTodo(0.4, 80);
        } else {
            fallos++; sonidoIncorrecto();
            p.cd = 1.6; empujarAtras(J0, p.cx, p.cz, 0.6);
            emit('onEvento', 'fallo', { jugador: 0 });
            danar(J0, `❌ Era «${q.correcta}». ¡Se activa una trampa!`, false);
        }
        emitirEstado();
    }
    function abrirCandado(J) {
        modal = { tipo: 'candado', valores: codigo.map(() => 0), hover: -1, jugador: J.i };
        if (!dual) { teclas.clear(); J.joy.x = J.joy.y = 0; salirPunteroBloqueado(); }
        emit('onCandado', { len: codigo.length, pistas: pistasHalladas.slice(), jugador: J.i });
        if (!candadoAvisado) { candadoAvisado = true; emit('onEvento', 'candado', { jugador: J.i }); }
        abrirPanelVR();
    }
    function probarCodigo(vals) {
        if (!modal || modal.tipo !== 'candado' || fin) return false;
        const J = jugadores[modal.jugador] || J0;
        if (vals.map(Number).join('') === codigo.join('')) {
            cerrarModal(true);
            candado.abierta = true; puntos += 300; SON.candado(); sonidoCorrecto(); J.pi.celebrar();
            aviso(dual ? '🔓 ¡Candado abierto! Id los dos a la salida' : '🔓 ¡Candado abierto! Corre hacia la salida', 'ok', J);
            emit('onEvento', 'candado_abierto', { jugador: J.i });
            vibrarTodo(0.6, 150);
            emitirEstado();
            return true;
        }
        puntos = Math.max(0, puntos - 20); SON.error();
        aviso(pistasHalladas.some(d => d === null) ? '🔒 Código incorrecto. Os faltan pistas por encontrar' : '🔒 Código incorrecto', 'mal', J);
        emit('onEvento', 'candado_error', { jugador: J.i });
        emitirEstado();
        return false;
    }
    function cerrarModal(silencioso = false) {
        if (!modal) return;
        const m = modal; modal = null;
        const J = jugadores[m.jugador] || J0;
        if (m.tipo === 'pregunta') { emit('onPregunta', 0, null); if (!silencioso) { m.puerta.cd = 1.2; empujarAtras(J0, m.puerta.cx, m.puerta.cz, 0.4); } }
        else { emit('onCandado', null); if (candado && !candado.abierta) { candado.cd = 1.2; if (!silencioso) empujarAtras(J, candado.cx, candado.cz, 0.4); } }
        cerrarPanelVR();
    }
    function cogerPista(J, p) {
        p.cogida = true; p.g.visible = false;
        pistasHalladas[p.idx] = codigo[p.idx]; puntos += 50; SON.pista();
        const faltan = pistasHalladas.filter(d => d === null).length;
        aviso(`📜 Pista: la ${p.idx + 1}ª cifra del candado es ${codigo[p.idx]}${faltan ? ` · faltan ${faltan}` : ' · ¡ya tenéis el código!'}`, 'pista', J);
        emit('onEvento', faltan ? 'pista' : 'pistas_todas', { jugador: J.i });
        vibrarTodo(0.3, 60);
        emitirEstado();
    }
    function danar(J, motivo, reubicar) {
        if (J.invulnerable > 0 || fin || transicion > 0) return;
        vidas--; J.invulnerable = 2.5; SON.dano(); J.tinte.material.color.setHex(0xff2020); J.tinteA = 0.55; vibrarTodo(1, 220);
        aviso(motivo, 'mal', J);
        if (reubicar) {
            desactivarPuerta(J);
            colocarJugador(J, J.checkpoint.x, J.checkpoint.z);
            // en solitario los enemigos vuelven al principio de su ruta; en dual el otro sigue jugando
            if (!dual) enemigos.forEach(e => { e.g.position.set(e.puntos[0].x, 0, e.puntos[0].z); e.idx = 1 % e.puntos.length; e.espera = 1; e.wp = 1 % e.ruta.length; e.modo = 'ronda'; e.camino = []; });
        }
        if (vidas === 1) emit('onEvento', 'ultima_vida', { jugador: J.i });
        emitirEstado();
        if (vidas <= 0) terminar(false);
    }
    function terminar(completado) {
        if (fin) return;
        fin = true; cerrarModal(true); jugadores.forEach(desactivarPuerta);
        if (completado) { SON.victoria(); jugadores.forEach(J => J.pi.celebrar()); }
        emit('onEvento', completado ? 'victoria' : 'derrota', {});
        const res = { puntos, aciertos, fallos, completado, niveles: nivelesSuperados, totalNiveles: escenarios.length, tiempo: Math.round(tiempo), vidas, escenarios: escenarios.slice(), jugadores: jugadores.length };
        setTimeout(() => {
            if (killed) return;
            const s = renderer.xr.getSession();
            if (s) s.end().catch(() => { });
            emit('onFin', res);
        }, completado ? 3200 : 3000);
    }
    function nivelSuperado() {
        nivelesSuperados++;
        puntos += 200 + vidas * 20;
        SON.victoria(); jugadores.forEach(J => J.pi.celebrar());
        if (nivelIdx + 1 >= escenarios.length) { aviso(`🏆 ¡Habéis escapado de ${esc.nombre.toLowerCase()}!`, 'ok'); emitirEstado(); terminar(true); return; }
        const sig = ESCENARIOS[escenarios[nivelIdx + 1]];
        aviso(`🏆 ¡Nivel superado! Siguiente: ${sig.emoji} ${sig.nombre}`, 'ok');
        emit('onEvento', 'nivel', {});
        transicion = 2.6;
        emitirEstado();
    }

    // ── Controles en pantalla (ordenador / móvil) ────────────────────────────
    const teclas = new Set();
    const pulsada = (lista) => lista.some(c => teclas.has(c));
    function saltar(j = 0) {
        const J = jugadores[j];
        if (!J || !J.enSuelo || fin || transicion > 0 || (J === J0 && renderer.xr.isPresenting)) return;
        if (modal && (!dual || modal.jugador === j)) return;
        J.vy = SALTO; J.enSuelo = false; SON.salto(); audio();
    }
    function alternarVista() {
        if (renderer.xr.isPresenting || dual) return;
        tercera = !tercera; montarLuces(J0);
        emitirEstado();
    }
    on(window, 'keydown', (e) => {
        if (killed) return;
        if (modal && (!dual || e.key === 'Escape')) {
            if (modal.tipo === 'pregunta' && /^[1-4]$/.test(e.key)) { const i = +e.key - 1; if (i < modal.pregunta.opciones.length) responder(i); }
            if (e.key === 'Escape') cerrarModal();
            return;
        }
        if (e.code === 'KeyV' && !e.repeat && !dual) { alternarVista(); return; }
        jugadores.forEach(J => { if (!e.repeat && J.controles.salto.includes(e.code)) saltar(J.i); });
        teclas.add(e.code);
        if (TECLAS_JUEGO.has(e.code)) e.preventDefault();
    });
    on(window, 'keyup', (e) => teclas.delete(e.code));
    on(window, 'blur', () => teclas.clear());
    const esTactil = window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;
    on(lienzo, 'click', () => {
        audio();
        if (!dual && !esTactil && !modal && !fin && !renderer.xr.isPresenting && document.pointerLockElement !== lienzo) {
            try { const r = lienzo.requestPointerLock(); if (r && r.catch) r.catch(() => { }); } catch { }
        }
    });
    on(document, 'mousemove', (e) => {
        if (document.pointerLockElement !== lienzo || modal) return;
        J0.yaw -= e.movementX * 0.0022; J0.pitch -= e.movementY * 0.0022;
        J0.pitch = Math.max(-1.2, Math.min(1.2, J0.pitch));
    });
    on(document, 'pointerlockchange', () => emit('onPunteroBloqueado', document.pointerLockElement === lienzo));

    function intentarMover(J, dx, dz) {
        const h = posJ(J, tmpV2);
        let x = h.x, z = h.z;
        if (libre(x + dx, z)) { J.rig.position.x += dx; x += dx; }
        if (libre(x, z + dz)) { J.rig.position.z += dz; }
    }

    // Cámara en tercera persona: siempre a la misma distancia detrás del personaje (si queda dentro
    // de una pared no pasa nada: las caras de dentro no se pintan y se sigue viendo al personaje)
    function camaraTercera(J) {
        const elev = Math.max(0.12, Math.min(0.6, 0.34 - J.pitch * 0.5));
        const dist = 3.4, objY = 1.35;
        const hd = dist * Math.cos(elev);
        const camY = Math.min(ALTO - 0.15, J.py + objY + dist * Math.sin(elev));
        J.camera.position.set(Math.sin(J.yaw) * hd, camY - J.py, Math.cos(J.yaw) * hd);
        J.camera.rotation.set(-Math.atan2(camY - (J.py + objY), hd), J.yaw, 0);
        J.pi.grupo.visible = true;
    }

    // ── Realidad virtual (solo con un jugador) ───────────────────────────────
    const UP = new THREE.Vector3(0, 1, 0);
    const PW = 1024, PH = 640;
    const panelCanvas = document.createElement('canvas'); panelCanvas.width = PW; panelCanvas.height = PH;
    const pctx = panelCanvas.getContext('2d');
    const panelTex = new THREE.CanvasTexture(panelCanvas); panelTex.colorSpace = THREE.SRGBColorSpace; panelTex.minFilter = THREE.LinearFilter;
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6 * PH / PW), new THREE.MeshBasicMaterial({ map: panelTex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false }));
    panel.renderOrder = 20; panel.visible = false; scene.add(panel);
    let botones = [];

    // Panel VR: candado y, en el modo clásico, las preguntas (en modo Pi se apunta a las cajas)
    function dibujarPanel() {
        const g = pctx; g.clearRect(0, 0, PW, PH);
        cajaRedonda(g, 6, 6, PW - 12, PH - 12, 36); g.fillStyle = 'rgba(12,6,28,0.94)'; g.fill();
        g.lineWidth = 6; g.strokeStyle = esc.colorAcento; g.stroke();
        botones = [];
        const boton = (x, y, w, h, texto, accion, { fondo = 'rgba(255,255,255,0.1)', max = 40 } = {}) => {
            const i = botones.length, hov = modal && modal.hover === i;
            cajaRedonda(g, x, y, w, h, 20); g.fillStyle = hov ? esc.colorAcento : fondo; g.fill();
            g.lineWidth = 3; g.strokeStyle = hov ? '#fff' : 'rgba(255,255,255,0.25)'; g.stroke();
            textoEnCaja(g, texto, x + 14, y + 8, w - 28, h - 16, { max, min: 18 });
            botones.push({ x, y, w, h, accion });
        };
        if (!modal) return;
        if (modal.tipo === 'pregunta') {
            const q = modal.pregunta;
            textoEnCaja(g, q.enunciado, 50, 40, PW - 100, 210, { max: 54, min: 24 });
            q.opciones.slice(0, 4).forEach((o, i) => {
                const c = i % 2, r = Math.floor(i / 2);
                boton(40 + c * 482, 270 + r * 160, 462, 145, `${LETRAS[i]}) ${o}`, () => responder(i), { fondo: COLORES_CAJA[i] + 'aa' });
            });
            boton(PW - 150, 18, 120, 56, 'Salir ✕', () => cerrarModal(), { max: 26 });
            panelTex.needsUpdate = true;
            return;
        }
        textoEnCaja(g, '🔒 Introduce el código del candado', 40, 24, PW - 80, 80, { max: 44 });
        const pist = pistasHalladas.map(d => d === null ? '?' : d).join(' · ');
        textoEnCaja(g, `Pistas encontradas: ${pist}`, 40, 100, PW - 80, 50, { max: 32, peso: 'normal', color: '#ffd76a' });
        const n = modal.valores.length, w = 150, gap = 40, x0 = (PW - (n * w + (n - 1) * gap)) / 2;
        modal.valores.forEach((v, k) => {
            const x = x0 + k * (w + gap);
            boton(x, 165, w, 90, '▲', () => { modal.valores[k] = (modal.valores[k] + 1) % 10; SON.clic(); panelSucio = true; }, { max: 48 });
            cajaRedonda(g, x, 265, w, 120, 16); g.fillStyle = '#000'; g.fill(); g.strokeStyle = '#ffd76a'; g.lineWidth = 4; g.stroke();
            g.font = 'bold 90px "Segoe UI", sans-serif'; g.fillStyle = '#ffd76a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(v), x + w / 2, 330);
            boton(x, 395, w, 90, '▼', () => { modal.valores[k] = (modal.valores[k] + 9) % 10; SON.clic(); panelSucio = true; }, { max: 48 });
        });
        boton(PW / 2 - 330, 515, 400, 95, '🔓 Abrir', () => { if (!probarCodigo(modal.valores)) panelSucio = true; }, { fondo: '#059669' });
        boton(PW / 2 + 90, 515, 240, 95, 'Salir ✕', () => cerrarModal());
        panelTex.needsUpdate = true;
    }
    let panelSucio = false;
    function abrirPanelVR() {
        if (!renderer.xr.isPresenting) return;
        const h = posCabeza();
        camera.getWorldDirection(tmpV); tmpV.y = 0; if (tmpV.lengthSq() < 1e-4) tmpV.set(0, 0, -1); tmpV.normalize();
        panel.position.set(h.x + tmpV.x * 1.35, h.y - 0.15, h.z + tmpV.z * 1.35);
        panel.lookAt(h.x, h.y - 0.15, h.z);
        panel.visible = true; panelSucio = true;
    }
    function cerrarPanelVR() { panel.visible = false; }

    // Muñeca izquierda: vidas, pistas y puntos
    const hudCanvas = document.createElement('canvas'); hudCanvas.width = 512; hudCanvas.height = 256;
    const hctx = hudCanvas.getContext('2d');
    const hudTex = new THREE.CanvasTexture(hudCanvas); hudTex.colorSpace = THREE.SRGBColorSpace;
    const hudVR = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.1), new THREE.MeshBasicMaterial({ map: hudTex, transparent: true, depthWrite: false, toneMapped: false, fog: false }));
    hudVR.position.set(0, 0.06, 0.05); hudVR.rotation.x = -1.0; hudVR.renderOrder = 18;
    let hudSucio = true;
    function dibujarHUD() {
        const g = hctx; g.clearRect(0, 0, 512, 256);
        cajaRedonda(g, 4, 4, 504, 248, 30); g.fillStyle = 'rgba(10,6,24,0.9)'; g.fill(); g.lineWidth = 5; g.strokeStyle = esc ? esc.colorAcento : '#a855f7'; g.stroke();
        g.textAlign = 'left'; g.textBaseline = 'middle';
        g.font = '52px "Segoe UI Emoji", sans-serif'; g.fillStyle = '#ff4d6d';
        g.fillText('❤'.repeat(Math.max(0, vidas)) + '♡'.repeat(Math.max(0, maxVidas - vidas)), 28, 66);
        g.font = 'bold 50px "Segoe UI", sans-serif'; g.fillStyle = '#ffd76a';
        g.fillText('🔒 ' + pistasHalladas.map(d => d === null ? '?' : d).join(' '), 28, 140);
        g.fillStyle = '#fff'; g.font = 'bold 40px "Segoe UI", sans-serif';
        g.fillText(`${puntos} pts · Nivel ${nivelIdx + 1}/${escenarios.length}`, 28, 210);
        hudTex.needsUpdate = true;
    }
    // Avisos y frases del narrador: cartel delante de los ojos durante unos segundos
    const toastCanvas = document.createElement('canvas'); toastCanvas.width = 1024; toastCanvas.height = 160;
    const tctx = toastCanvas.getContext('2d');
    const toastTex = new THREE.CanvasTexture(toastCanvas); toastTex.colorSpace = THREE.SRGBColorSpace;
    const toastVR = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1 * 160 / 1024), new THREE.MeshBasicMaterial({ map: toastTex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false }));
    toastVR.position.set(0, -0.32, -1.3); toastVR.renderOrder = 25; toastVR.visible = false; camera.add(toastVR);
    let toastSucio = false;
    function dibujarToast() {
        const g = tctx; g.clearRect(0, 0, 1024, 160);
        cajaRedonda(g, 4, 4, 1016, 152, 40); g.fillStyle = 'rgba(10,6,24,0.88)'; g.fill();
        textoEnCaja(g, toastTexto, 30, 10, 964, 140, { max: 48, min: 22 });
        toastTex.needsUpdate = true;
    }

    // Mandos
    let manoActiva = null;
    const laser = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, toneMapped: false, fog: false }));
    laser.visible = false;
    const marcaTP = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.34, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x40ff90, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false, fog: false }));
    marcaTP.visible = false; scene.add(marcaTP);
    const arcoTP = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 20 }, () => new THREE.Vector3())), new THREE.LineBasicMaterial({ color: 0x40ff90, toneMapped: false, fog: false }));
    arcoTP.visible = false; arcoTP.frustumCulled = false; scene.add(arcoTP);
    const raycaster = new THREE.Raycaster();

    function vibrar(c, fuerza, ms) {
        const gp = c && c.userData.gamepad; if (!gp) return;
        try {
            if (gp.hapticActuators && gp.hapticActuators[0]) gp.hapticActuators[0].pulse(fuerza, ms);
            else if (gp.vibrationActuator) gp.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: fuerza, weakMagnitude: fuerza });
        } catch { }
    }
    function vibrarTodo(f, ms) { if (renderer.xr.isPresenting) manos.forEach(m => vibrar(m, f, ms)); }
    function rayoMando(c) {
        c.updateMatrixWorld();
        tmpV.setFromMatrixPosition(c.matrixWorld);
        c.getWorldQuaternion(tmpQ);
        tmpV2.set(0, 0, -1).applyQuaternion(tmpQ);
        raycaster.set(tmpV, tmpV2);
        return raycaster;
    }
    function botonApuntado(c) {
        if (!panel.visible || !c) return -1;
        const hit = rayoMando(c).intersectObject(panel)[0];
        if (!hit || !hit.uv) return -1;
        const px = hit.uv.x * PW, py2 = (1 - hit.uv.y) * PH;
        return botones.findIndex(b => px >= b.x && px <= b.x + b.w && py2 >= b.y && py2 <= b.y + b.h);
    }
    function cajaApuntada(c) {
        const p = J0.puertaActiva;
        if (!c || !p || !p.cajas) return null;
        const hit = rayoMando(c).intersectObjects(p.cajas.map(k => k.mesh))[0];
        return hit ? { caja: p.cajas.find(k => k.mesh === hit.object), dist: hit.distance } : null;
    }
    function usarLinternaEn(c) {
        c.add(J0.linterna); c.add(J0.linterna.target);
        J0.linterna.position.set(0, 0, -0.05); J0.linterna.target.position.set(0, 0, -1);
    }
    const manos = dual ? [] : [0, 1].map(i => {
        const c = renderer.xr.getController(i);
        const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.16, 10).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x3a3a44 }));
        cuerpo.position.z = 0.05; c.add(cuerpo);
        c.addEventListener('connected', (e) => {
            c.userData.conectado = true; c.userData.gamepad = e.data.gamepad || null; c.userData.hand = e.data.handedness;
            if (e.data.handedness === 'right' || !manoActiva) { manoActiva = c; if (renderer.xr.isPresenting) usarLinternaEn(c); c.add(laser); }
            if (e.data.handedness === 'left') c.add(hudVR);
        });
        c.addEventListener('disconnected', () => { c.userData.conectado = false; c.userData.gamepad = null; });
        c.addEventListener('selectstart', () => {
            audio();
            if (manoActiva !== c) { manoActiva = c; c.add(laser); }
            if (modal) {
                const b = botonApuntado(c);
                if (b >= 0) { SON.clic(); vibrar(c, 0.3, 30); botones[b].accion(); }
            } else {
                const k = cajaApuntada(c);
                if (k) { vibrar(c, 0.4, 40); golpearCaja(J0, k.caja); }
            }
        });
        c.addEventListener('squeezestart', () => { if (renderer.xr.isPresenting) { usarLinternaEn(c); vibrar(c, 0.2, 40); } }); // la linterna cambia de mano
        rig.add(c);
        return c;
    });

    let giroListo = true;
    const tp = { mano: null, valido: false, punto: new THREE.Vector3() };
    function controlesVR(dt) {
        let mx = 0, my = 0, gx = 0;
        manos.forEach(m => {
            const gp = m.userData.gamepad; if (!gp || !gp.axes) return;
            const ax = gp.axes.length >= 4 ? gp.axes[2] : (gp.axes[0] || 0);
            const ay = gp.axes.length >= 4 ? gp.axes[3] : (gp.axes[1] || 0);
            if (m.userData.hand === 'left') { mx = ax; my = ay; } else gx = ax;
            // A/X (botón 4) mantenido: apuntar teletransporte
            const boton = gp.buttons && gp.buttons[4] && gp.buttons[4].pressed;
            if (boton && !modal && (!tp.mano || tp.mano === m)) { tp.mano = m; apuntarTP(m); }
            else if (!boton && tp.mano === m) { soltarTP(); }
        });
        if (modal) return;
        // giro a saltos de 45° alrededor de la cabeza
        if (Math.abs(gx) < 0.3) giroListo = true;
        else if (giroListo && Math.abs(gx) > 0.7) {
            giroListo = false;
            const ang = gx > 0 ? -Math.PI / 4 : Math.PI / 4, h = posCabeza();
            tmpV.set(rig.position.x - h.x, 0, rig.position.z - h.z).applyAxisAngle(UP, ang);
            rig.position.x = h.x + tmpV.x; rig.position.z = h.z + tmpV.z;
            rig.rotation.y += ang;
        }
        if (Math.hypot(mx, my) < 0.15) return;
        camera.getWorldDirection(tmpV); tmpV.y = 0; if (tmpV.lengthSq() < 1e-4) return; tmpV.normalize();
        const dx = (tmpV.x * -my + -tmpV.z * mx) * VEL_VR * dt, dz = (tmpV.z * -my + tmpV.x * mx) * VEL_VR * dt;
        intentarMover(J0, dx, dz);
    }
    function apuntarTP(m) {
        const r = rayoMando(m), o = r.ray.origin, d = r.ray.direction;
        const pts = arcoTP.geometry.attributes.position;
        // parábola sencilla: velocidad 7 m/s en la dirección del mando
        let x = o.x, y = o.y, z = o.z, vx = d.x * 7, vyy = d.y * 7, vz = d.z * 7, aterriza = false;
        for (let i = 0; i < 20; i++) {
            pts.setXYZ(i, x, y, z);
            if (!aterriza) {
                const nx = x + vx * 0.06, ny = y + vyy * 0.06, nz = z + vz * 0.06;
                vyy -= 9.8 * 0.06;
                if (ny <= 0) { const t = y / (y - ny); x += (nx - x) * t; z += (nz - z) * t; y = 0; aterriza = true; }
                else if (solida(aCelda(nx), aCelda(nz))) { aterriza = true; }
                else { x = nx; y = ny; z = nz; }
            }
        }
        pts.needsUpdate = true;
        const h = posCabeza();
        tp.valido = y === 0 && libre(x, z) && Math.hypot(x - h.x, z - h.z) < 9 && lineaVista(h.x, h.z, x, z);
        tp.punto.set(x, 0.02, z);
        marcaTP.position.copy(tp.punto); marcaTP.visible = arcoTP.visible = true;
        const col = tp.valido ? 0x40ff90 : 0xff5050; marcaTP.material.color.setHex(col); arcoTP.material.color.setHex(col);
    }
    function soltarTP() {
        if (tp.valido) { const h = posCabeza(); rig.position.x += tp.punto.x - h.x; rig.position.z += tp.punto.z - h.z; nota(500, 900, 0.12, 'sine', 0.05); }
        tp.mano = null; tp.valido = false; marcaTP.visible = arcoTP.visible = false;
    }

    function modoVR(activo) {
        if (activo) {
            renderer.xr.setFoveation(1);
            J0.py = 0; J0.vy = 0; J0.enSuelo = true;
            rig.position.y = 0; rig.rotation.y = J0.yaw; camera.rotation.set(0, 0, 0);
            J0.pi.grupo.visible = false;
            camera.add(J0.luz); J0.luz.position.set(0, 0.1, 0);
            if (manoActiva) usarLinternaEn(manoActiva); else { camera.add(J0.linterna); camera.add(J0.linterna.target); }
            if (modal) abrirPanelVR();
            hudSucio = true;
        } else {
            camera.getWorldDirection(tmpV);
            J0.yaw = Math.atan2(-tmpV.x, -tmpV.z); J0.pitch = 0;
            const h = posCabeza();
            rig.position.set(h.x, 0, h.z); rig.rotation.set(0, 0, 0);
            camera.position.set(0, OJOS, 0);
            montarLuces(J0);
            panel.visible = false; marcaTP.visible = arcoTP.visible = false; toastVR.visible = false; J0.tinteA = 0; laser.visible = false;
            onResize();
        }
        emitirEstado();
    }
    const onXRStart = () => modoVR(true), onXREnd = () => modoVR(false);
    renderer.xr.addEventListener('sessionstart', onXRStart);
    renderer.xr.addEventListener('sessionend', onXREnd);
    limpiezas.push(() => { renderer.xr.removeEventListener('sessionstart', onXRStart); renderer.xr.removeEventListener('sessionend', onXREnd); });
    async function entrarVR(session) {
        if (dual) { try { session.end(); } catch { } return; }
        try { await renderer.xr.setSession(session); }
        catch {
            try { renderer.xr.setReferenceSpaceType('local'); await renderer.xr.setSession(session); rig.position.y = OJOS; }
            catch (e2) { console.error('WebXR', e2); try { session.end(); } catch { } }
        }
    }

    // ── Minimapa (solo lo explorado, por cualquiera de los jugadores) ────────
    function marcarVistas() {
        jugadores.forEach(J => {
            const h = posJ(J, tmpV2), cx = aCelda(h.x), cz = aCelda(h.z);
            for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
                const x = cx + dx, z = cz + dz;
                if (celda(x, z) === '#' || !lineaVista(h.x, h.z, x * C, z * C)) continue;
                // suelo a la vista + sus paredes y puertas vecinas
                for (let vz = -1; vz <= 1; vz++) for (let vx = -1; vx <= 1; vx++) {
                    const k = clave(x + vx, z + vz);
                    if (!vistas.has(k) && ((vx === 0 && vz === 0) || celda(x + vx, z + vz) === '#' || puertaEn.has(k))) vistas.add(k);
                }
            }
        });
    }
    function dibujarMinimapa() {
        if (!minimapa || !mapa) return;
        const g = minimapa.getContext('2d'), H = mapa.length, W = mapa[0].length;
        const t = Math.floor(Math.min(minimapa.width / W, minimapa.height / H));
        g.clearRect(0, 0, minimapa.width, minimapa.height);
        for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
            if (!vistas.has(clave(x, z))) continue;
            const ch = celda(x, z), p = puertaEn.get(clave(x, z));
            g.fillStyle = ch === '#' ? 'rgba(255,255,255,0.55)' : p ? (p.abierta ? '#22c55e' : p.esCandado ? '#facc15' : '#ef4444') : ch === 'E' ? esc.colorAcento : 'rgba(255,255,255,0.12)';
            g.fillRect(x * t, z * t, t - 1, t - 1);
        }
        pistas.forEach(p => { if (!p.cogida && vistas.has(clave(p.x, p.z))) { g.fillStyle = '#facc15'; g.beginPath(); g.arc(p.x * t + t / 2, p.z * t + t / 2, t * 0.3, 0, 7); g.fill(); } });
        trampas.forEach(tr => { if (tr.revelada > 0.5) { g.fillStyle = '#fb7185'; g.fillRect(tr.x * t + t * 0.3, tr.z * t + t * 0.3, t * 0.4, t * 0.4); } });
        jugadores.forEach(J => {
            const h = posJ(J, tmpV2);
            let a;
            if (J === J0 && renderer.xr.isPresenting) { camera.getWorldDirection(tmpV); a = Math.atan2(tmpV.z, tmpV.x); } else a = Math.atan2(-Math.cos(J.yaw), -Math.sin(J.yaw));
            const px = (h.x / C + 0.5) * t, pz = (h.z / C + 0.5) * t;
            g.fillStyle = dual ? (J.i ? '#34d399' : '#c084fc') : '#38bdf8'; g.beginPath();
            g.moveTo(px + Math.cos(a) * t * 0.6, pz + Math.sin(a) * t * 0.6);
            g.lineTo(px + Math.cos(a + 2.4) * t * 0.45, pz + Math.sin(a + 2.4) * t * 0.45);
            g.lineTo(px + Math.cos(a - 2.4) * t * 0.45, pz + Math.sin(a - 2.4) * t * 0.45);
            g.closePath(); g.fill();
        });
    }

    // ── Movimiento de un jugador en pantalla ─────────────────────────────────
    function moverJugador(J, dt, t) {
        J.velAndar = 0;
        const bloqueado = fin || transicion > 0 || (modal && (!dual || modal.jugador === J.i));
        if (!bloqueado) {
            const k = J.controles;
            // Joystick táctil: en modo Pi, hacia los lados GIRA (como las flechas); en clásico mueve de lado
            let ix = clasico ? J.joy.x : 0, iy = J.joy.y;
            if (!clasico && Math.abs(J.joy.x) > 0.15) J.yaw -= J.joy.x * GIRO * dt;
            if (pulsada(k.adelante)) iy -= 1;
            if (pulsada(k.atras)) iy += 1;
            if (pulsada(k.ladoIzq)) ix -= 1;
            if (pulsada(k.ladoDer)) ix += 1;
            if (pulsada(k.girarIzq)) J.yaw += GIRO * dt;
            if (pulsada(k.girarDer)) J.yaw -= GIRO * dt;
            const m = Math.hypot(ix, iy); if (m > 1) { ix /= m; iy /= m; }
            if (m > 0.05) {
                const v = VEL * (pulsada(k.correr) ? 1.45 : 1);
                const fx = -Math.sin(J.yaw), fz = -Math.cos(J.yaw), rx = Math.cos(J.yaw), rz = -Math.sin(J.yaw);
                intentarMover(J, (rx * ix + fx * -iy) * v * dt, (rz * ix + fz * -iy) * v * dt);
                J.velAndar = v * Math.min(1, m);
            }
        }
        // Salto y gravedad
        if (!J.enSuelo) {
            J.vy -= GRAV * dt; J.py += J.vy * dt;
            if (J.py <= 0) { J.py = 0; J.vy = 0; J.enSuelo = true; }
        }
        J.rig.position.y = J.py;
        // ¿Golpe de cabeza contra una caja?
        const p = J.puertaActiva;
        if (J.vy > 0 && p && p.cajas && J.py + ALTURA_PI >= CAJA_Y - 0.03) {
            const c = p.cajas.find(c => Math.abs(J.rig.position.x - c.x) < CAJA / 2 + 0.06 && Math.abs(J.rig.position.z - c.z) < CAJA / 2 + 0.06);
            if (c) { J.vy = -1.5; J.py = CAJA_Y - ALTURA_PI; golpearCaja(J, c); }
        }
        J.pi.grupo.position.set(J.rig.position.x, J.py, J.rig.position.z);
        // el personaje mira siempre hacia donde mira la cámara: la cámara queda a su espalda
        J.pi.grupo.rotation.y = J.yaw + Math.PI;
        J.pi.animar(dt, { velocidad: J.velAndar, enAire: !J.enSuelo, alturaSuelo: 0 });
        if (tercera) camaraTercera(J);
        else {
            J.pi.grupo.visible = false;
            J.camera.position.set(0, OJOS + (J.velAndar > 0 && J.enSuelo ? Math.sin(t * 9) * 0.03 : 0), 0);
            J.camera.rotation.set(J.pitch, J.yaw, 0);
        }
    }

    // Interacciones de un jugador con puertas, cajas, candado, pistas, trampas y salida
    function interacciones(J, dt) {
        if (fin || transicion > 0 || !esc) return;
        if (modal && (!dual || modal.jugador === J.i)) return;
        const h = posJ(J, tmpV2);
        if (clasico) {
            for (const p of puertas) {
                if (!p.abierta && p.cd <= 0 && Math.hypot(h.x - p.cx, h.z - p.cz) < DIST_CANDADO) { abrirPregunta(p); return; }
            }
        } else {
            // Cajas: aparecen al ponerse delante de una puerta cerrada
            let cerca = null, dCerca = Infinity;
            puertas.forEach(p => {
                if (p.abierta) return;
                const d = Math.hypot(h.x - p.cx, h.z - p.cz);
                const lateral = Math.abs(p.horizontal ? h.x - p.cx : h.z - p.cz); // delante de la puerta, no al pasar por el lado
                if (d < dCerca && lateral < 1.6) { dCerca = d; cerca = p; }
            });
            const p = J.puertaActiva;
            if (p) {
                if (p.abierta) { if (p.tCajas <= 0) { p.usuarios.delete(J.i); if (!p.usuarios.size) quitarCajas(p); J.puertaActiva = null; } }
                else if (Math.hypot(h.x - p.cx, h.z - p.cz) > DIST_CAJAS + 2.5) desactivarPuerta(J);
                // tras un fallo: cajas nuevas con la siguiente pregunta
                else if (p.cajas && p.tCajas <= 0 && p.cajas.some(c => c.mesh.material.color.getHex() !== 0xffffff)) {
                    ponerCajas(p);
                    jugadores.forEach(K => { if (K.puertaActiva === p) emit('onPregunta', K.i, { enunciado: p.pregunta.enunciado, opciones: p.pregunta.opciones.slice(0, 4) }); });
                }
            }
            if (cerca && dCerca < DIST_CAJAS && cerca !== J.puertaActiva && cerca.tCajas <= 0) activarPuerta(J, cerca, h);
        }
        // Candado
        if (!modal && candado && !candado.abierta && candado.cd <= 0 && Math.hypot(h.x - candado.cx, h.z - candado.cz) < DIST_CANDADO) abrirCandado(J);
        pistas.forEach(p => { if (!p.cogida && Math.hypot(h.x - p.cx, h.z - p.cz) < 1.2) cogerPista(J, p); });
        trampas.forEach(tr => {
            if (tr.cd <= 0 && J.enSuelo && Math.hypot(h.x - tr.cx, h.z - tr.cz) < 1.0) {
                tr.cd = 2.5; tr.revelada = 1; tr.flash = 1; SON.trampa(esc.trampa);
                empujarAtras(J, tr.cx, tr.cz, 0.9);
                emit('onEvento', 'trampa', { jugador: J.i });
                danar(J, `⚠️ ¡Has pisado ${esc.trampa === 'laser' ? 'un' : 'una'} ${esc.nombreTrampa}! Usa la linterna para descubrirlas`, false);
            }
        });
        // Salida: en dual tienen que llegar los dos
        J.enSalida = !!(salida && candado?.abierta && Math.hypot(h.x - salida.cx, h.z - salida.cz) < 1.5);
    }

    // ── Bucle ────────────────────────────────────────────────────────────────
    let tAnterior = performance.now(), tMapa = 0, tSeg = 0;
    const dirLuz = new THREE.Vector3(), posLuz = new THREE.Vector3(), tam = new THREE.Vector2();
    function frame() {
        if (killed) return;
        const ahora = performance.now();
        const dt = Math.min(0.05, (ahora - tAnterior) / 1000); tAnterior = ahora;
        const vr = renderer.xr.isPresenting;
        const t = ahora / 1000;

        if (!fin && transicion <= 0) tiempo += dt;
        jugadores.forEach(J => {
            J.invulnerable = Math.max(0, J.invulnerable - dt);
            if (dual && modal && modal.jugador === J.i) J.invulnerable = Math.max(J.invulnerable, 0.3); // mientras escribe el código no le ven
        });

        // Transición entre niveles: fundido a negro y nivel nuevo
        if (transicion > 0) {
            transicion -= dt;
            jugadores.forEach(J => { J.tinte.material.color.setHex(0x000000); J.tinteA = Math.min(1, (2.6 - transicion) / 1.3); });
            if (transicion <= 0) { construirNivel(nivelIdx + 1); jugadores.forEach(J => { J.tinteA = 1; }); }
        }

        // Movimiento
        if (vr) controlesVR(dt);
        jugadores.forEach(J => { if (!(J === J0 && vr)) moverJugador(J, dt, t); });

        // Interacciones
        puertas.forEach(p => { p.tCajas = Math.max(0, p.tCajas - dt); p.cd = Math.max(0, p.cd - dt); });
        if (candado) candado.cd = Math.max(0, candado.cd - dt);
        trampas.forEach(tr => { tr.cd = Math.max(0, tr.cd - dt); });
        jugadores.forEach(J => interacciones(J, dt));
        if (!fin && transicion <= 0 && salida && candado?.abierta) {
            const dentro = jugadores.filter(J => J.enSalida).length;
            if (dentro === jugadores.length) nivelSuperado();
            else if (dentro > 0 && (avisoSalida -= dt) <= 0) {
                avisoSalida = 6;
                const J = jugadores.find(K => K.enSalida);
                aviso('🚪 ¡Ya estoy en la salida! Falta mi compañero', 'info', J);
                emit('onEvento', 'esperar', { jugador: J.i });
                emitirEstado();
            }
        }

        // Cajas: bote al golpearlas y flotar suave
        puertas.forEach(p => { if (p.cajas) p.cajas.forEach(c => {
            c.bote = Math.max(0, c.bote - dt * 4);
            c.mesh.position.y = CAJA_Y + CAJA / 2 + Math.sin(c.bote * Math.PI) * 0.18 + Math.sin(t * 2 + c.i) * 0.02;
        }); });

        // Linternas: revelan las trampas que iluminan
        jugadores.forEach(J => {
            J.linterna.getWorldPosition(posLuz);
            J.linterna.target.getWorldPosition(dirLuz); dirLuz.sub(posLuz).normalize();
            trampas.forEach(tr => {
                if (tr.revelada >= 1) return;
                tmpV.set(tr.cx - posLuz.x, -posLuz.y, tr.cz - posLuz.z);
                const d = tmpV.length();
                if (d < 9 && tmpV.normalize().dot(dirLuz) > 0.92) tr.revelada = Math.min(1, tr.revelada + dt * 1.6);
            });
        });
        trampas.forEach(tr => {
            tr.runa.material.opacity = Math.min(0.9, tr.revelada) * (0.75 + 0.25 * Math.sin(t * 4 + tr.cx));
            if (tr.flash > 0) {
                tr.flash = Math.max(0, tr.flash - dt * 1.4);
                tr.rayo.visible = true; tr.matRayo.opacity = 0.75 * tr.flash;
            } else tr.rayo.visible = false;
        });

        // Puertas (suben hacia el techo) y candado
        [...puertas, candado].forEach(p => {
            if (!p || !p.abierta || p.anim >= 1) return;
            p.anim = Math.min(1, p.anim + dt * (p.esCandado ? 0.6 : 0.9));
            if (p.arco) p.arco.position.y = Math.min(0.15, p.anim * 0.6);
            const k = p.esCandado ? Math.max(0, (p.anim - 0.25) / 0.75) : p.anim;
            p.hoja.position.y = (ALTO - 0.1) * (k * k * (3 - 2 * k));
        });

        // Pistas, salida y decoración
        pistas.forEach(p => { if (!p.cogida) { p.g.position.y = 1.15 + Math.sin(t * 2 + p.fase) * 0.1; p.obj.rotation.y += dt * 1.4; } });
        if (salida) { salida.aro.scale.setScalar(1 + Math.sin(t * 3) * 0.06); salida.haz.material.opacity = candado?.abierta ? 0.28 + Math.sin(t * 4) * 0.08 : 0.06; }
        decos.forEach(d => d.llama.scale.setScalar(d.base * (0.85 + 0.15 * Math.sin(t * 13 + d.f) + 0.08 * Math.sin(t * 29 + d.f * 2))));

        // Enemigos (en solitario se paran mientras escribes el código; en dual el otro sigue jugando)
        if (esc) (clasico ? actualizarEnemigosCaza : actualizarEnemigos)(dt, t, fin || transicion > 0 || (modal != null && !dual));

        // Minimapa y casillas vistas
        tMapa -= dt;
        if (tMapa <= 0) { tMapa = 0.2; marcarVistas(); dibujarMinimapa(); }
        tSeg -= dt; if (tSeg <= 0) { tSeg = 1; emit('onTiempo', Math.round(tiempo)); }

        // VR: panel, muñeca, avisos, tintes
        if (vr) {
            const h = posCabeza();
            let hitDist = 0;
            if (modal && panel.visible) {
                const b = botonApuntado(manoActiva);
                if (b !== modal.hover) { modal.hover = b; panelSucio = true; }
                const hit = manoActiva ? rayoMando(manoActiva).intersectObject(panel)[0] : null;
                hitDist = hit ? hit.distance : 3;
            } else if (J0.puertaActiva && J0.puertaActiva.cajas) {
                const k = cajaApuntada(manoActiva);
                hitDist = k ? k.dist : 4;
                J0.puertaActiva.cajas.forEach(c => c.mesh.scale.setScalar(k && k.caja === c ? 1.12 : 1));
            }
            laser.visible = hitDist > 0; laser.scale.z = hitDist || 1;
            if (panelSucio && modal) { dibujarPanel(); panelSucio = false; }
            if (hudSucio) { dibujarHUD(); hudSucio = false; }
            if (toastSucio) { dibujarToast(); toastSucio = false; }
            toastVR.visible = !!toastTexto && ahora < toastHasta;
            if (transicion <= 0) {
                const dentroPared = !libre(h.x, h.z, 0.12);
                if (dentroPared) { J0.tinte.material.color.setHex(0x000000); J0.tinteA = Math.max(J0.tinteA, 0.92); }
                else J0.tinteA = Math.max(0, J0.tinteA - dt * 2);
            }
        } else if (transicion <= 0) jugadores.forEach(J => { J.tinteA = Math.max(0, J.tinteA - dt * 2); });
        jugadores.forEach(J => { J.tinte.material.opacity = J.tinteA; J.tinte.visible = J.tinteA > 0.01; });

        // Pintar: una vista o pantalla partida (izquierda jugador 1, derecha jugador 2)
        if (dual) {
            renderer.getSize(tam);
            const w = Math.floor(tam.x / 2), hgt = tam.y;
            renderer.setScissorTest(true);
            jugadores.forEach(J => {
                renderer.setViewport(J.i * w, 0, w, hgt); renderer.setScissor(J.i * w, 0, w, hgt);
                renderer.render(scene, J.camera);
            });
            renderer.setScissorTest(false);
        } else renderer.render(scene, camera);
    }

    // Enemigos (modo Pi): recorrido fijo, parada en cada punto de ruta y cono de visión
    function actualizarEnemigos(dt, t, pausa) {
        enemigos.forEach(e => {
            const pos = e.g.position;
            if (!pausa) {
                const obj = e.puntos[e.idx];
                if (e.espera > 0) {
                    e.espera -= dt;
                    // durante la parada se gira poco a poco hacia el siguiente tramo
                    const ang = Math.atan2(obj.x - pos.x, obj.z - pos.z);
                    if (Math.hypot(obj.x - pos.x, obj.z - pos.z) > 0.05) e.g.rotation.y += angDif(ang, e.g.rotation.y) * Math.min(1, dt * 2.5);
                } else {
                    const dx = obj.x - pos.x, dz = obj.z - pos.z, d = Math.hypot(dx, dz);
                    const v = esc.velocidadEnemigo * 0.6 * dt;
                    if (d <= v) {
                        pos.x = obj.x; pos.z = obj.z;
                        if (obj.pausa) e.espera = 1.1;
                        e.idx = (e.idx + 1) % e.puntos.length;
                    } else {
                        pos.x += dx / d * v; pos.z += dz / d * v;
                        e.g.rotation.y += angDif(Math.atan2(dx, dz), e.g.rotation.y) * Math.min(1, dt * 6);
                    }
                }
            }
            // Animación por tipo
            const alerta = e.alarma > 0;
            e.alarma = Math.max(0, e.alarma - dt);
            e.g.position.y = e.g.userData.altura + (esc.enemigo === 'momia' ? 0 : Math.sin(t * 2.2 + e.fase) * 0.12);
            if (esc.enemigo === 'fantasma') { e.partes.cuerpo.opacity = 0.62 + 0.2 * Math.sin(t * 3 + e.fase); e.partes.ojos.color.setHex(alerta ? 0xff1a1a : 0x110022); }
            else if (esc.enemigo === 'momia') { if (!pausa && e.espera <= 0) { e.g.rotation.z = Math.sin(t * 5 + e.fase) * 0.06; e.partes.brazos.rotation.x = Math.sin(t * 5 + e.fase) * 0.12 - 0.05; } e.partes.ojos.color.setHex(alerta ? 0xff3a1a : 0xffd23a); }
            else { e.partes.anillo.rotation.z += dt * (alerta ? 8 : 2); }
            // Cono de visión en el suelo
            e.cono.position.set(pos.x, 0.035, pos.z);
            e.cono.rotation.y = e.g.rotation.y;
            e.cono.material.color.setHex(alerta ? 0xff2020 : COLOR_CONO[esc.enemigo]);
            e.cono.material.opacity = alerta ? 0.35 : 0.16 + 0.04 * Math.sin(t * 3 + e.fase);
            if (pausa) return;
            // ¿Ve a alguien? (dentro del cono y sin paredes ni puertas en medio) o le toca
            jugadores.forEach(J => {
                if (J.invulnerable > 0) return;
                const h = posJ(J, tmpV2);
                const dx = h.x - pos.x, dz = h.z - pos.z, d = Math.hypot(dx, dz);
                const enCono = d < VISION && Math.abs(angDif(Math.atan2(dx, dz), e.g.rotation.y)) < MEDIO_ANGULO && lineaVista(pos.x, pos.z, h.x, h.z);
                if (enCono || d < 0.8) {
                    e.alarma = 1.2; SON.visto(esc.enemigo); J.pi.susto();
                    const quien = esc.enemigo === 'momia' ? 'una momia' : esc.enemigo === 'dron' ? 'un dron' : 'un fantasma';
                    emit('onEvento', 'visto', { jugador: J.i });
                    danar(J, `👁️ ¡Te ha visto ${quien}! Evita su cono de luz. Vuelves a la última puerta`, true);
                }
            });
        });
    }

    // Enemigos (modo clásico, un jugador): patrullan su ruta y, si te ven, te persiguen
    function actualizarEnemigosCaza(dt, t, pausa) {
        const h = posCabeza();
        const pc = [aCelda(h.x), aCelda(h.z)];
        enemigos.forEach(e => {
            const pos = e.g.position, ec = [aCelda(pos.x), aCelda(pos.z)];
            e.tRecalc -= dt;
            if (e.tRecalc <= 0) {
                e.tRecalc = 0.35;
                const d = Math.hypot(h.x - pos.x, h.z - pos.z);
                const ve = !pausa && d < 7.5 && lineaVista(pos.x, pos.z, h.x, h.z);
                if (ve) {
                    if (e.modo !== 'caza') { e.modo = 'caza'; SON.visto(esc.enemigo); emit('onEvento', 'visto', { jugador: 0 }); if (d < 6) vibrarTodo(0.2, 60); }
                    e.perder = 2.5;
                } else if (e.modo === 'caza') { e.perder -= 0.35; if (e.perder <= 0) e.modo = 'ronda'; }
                if (e.modo === 'ronda') {
                    const w = e.ruta[e.wp];
                    if (ec[0] === w[0] && ec[1] === w[1] && Math.hypot(pos.x - w[0] * C, pos.z - w[1] * C) < 0.3) e.wp = (e.wp + 1) % e.ruta.length;
                    e.camino = bfs(ec, e.ruta[e.wp]) || [];
                } else e.camino = bfs(ec, pc) || [];
            }
            if (pausa) { e.g.position.y = e.g.userData.altura + Math.sin(t * 2 + e.fase) * 0.08; return; }
            let tx, tz;
            if (e.modo === 'caza' && ec[0] === pc[0] && ec[1] === pc[1]) { tx = h.x; tz = h.z; }
            else if (e.camino.length) {
                const [cx, cz] = e.camino[0]; tx = cx * C; tz = cz * C;
                if (Math.hypot(tx - pos.x, tz - pos.z) < 0.12) e.camino.shift();
            } else if (e.modo === 'ronda') { const w = e.ruta[e.wp]; tx = w[0] * C; tz = w[1] * C; }
            if (tx !== undefined) {
                const dx = tx - pos.x, dz = tz - pos.z, d = Math.hypot(dx, dz);
                if (d > 0.01) {
                    const v = Math.min(d, esc.velocidadEnemigo * (e.modo === 'caza' ? 1 : 0.55) * dt);
                    pos.x += dx / d * v; pos.z += dz / d * v;
                    e.g.rotation.y += angDif(Math.atan2(dx, dz), e.g.rotation.y) * Math.min(1, dt * 8);
                }
            }
            const caza = e.modo === 'caza';
            e.g.position.y = e.g.userData.altura + (esc.enemigo === 'momia' ? 0 : Math.sin(t * 2.2 + e.fase) * 0.12);
            if (esc.enemigo === 'fantasma') { e.partes.cuerpo.opacity = 0.62 + 0.2 * Math.sin(t * 3 + e.fase); e.partes.ojos.color.setHex(caza ? 0xff1a1a : 0x110022); }
            else if (esc.enemigo === 'momia') { e.g.rotation.z = Math.sin(t * 5 + e.fase) * 0.06; e.partes.brazos.rotation.x = Math.sin(t * 5 + e.fase) * 0.12 - 0.05; e.partes.ojos.color.setHex(caza ? 0xff3a1a : 0xffd23a); }
            else { e.partes.anillo.rotation.z += dt * (caza ? 6 : 2); }
            if (Math.hypot(h.x - pos.x, h.z - pos.z) < 0.8 && J0.invulnerable <= 0) {
                danar(J0, `👻 ¡Te ha atrapado ${esc.enemigo === 'momia' ? 'una momia' : esc.enemigo === 'dron' ? 'un dron' : 'un fantasma'}! Vuelves a la última puerta`, true);
            }
        });
    }

    // ── Arranque ─────────────────────────────────────────────────────────────
    construirNivel(0);
    renderer.setAnimationLoop(frame);
    if (opciones.xrSession) entrarVR(opciones.xrSession);

    return {
        responder,
        saltar,
        alternarVista,
        probarCodigo,
        cerrarModal: () => cerrarModal(false),
        setJoystick(x, y, j = 0) { const J = jugadores[j]; if (J) { J.joy.x = x; J.joy.y = y; } },
        mirar(dx, dy) { J0.yaw -= dx * 0.005; J0.pitch = Math.max(-1.2, Math.min(1.2, J0.pitch - dy * 0.005)); },
        entrarVR,
        /** Muestra un texto en el cartel de las gafas (frases del narrador). */
        avisoVR(texto) { toastTexto = texto; toastHasta = performance.now() + 4500; toastSucio = true; },
        get enVR() { return renderer.xr.isPresenting; },
        // Solo pruebas: avanza n fotogramas de 1/30 s (el navegador automatizado apenas pinta)
        _frames(n = 1) { for (let i = 0; i < n && !killed; i++) { tAnterior = performance.now() - 33; frame(); } },
        _yaw(v, j = 0) { jugadores[j].yaw = v; },
        _ir(cx, cz, j = 0) { colocarJugador(jugadores[j], cx * C, cz * C); },
        _info() {
            return {
                jugadores: jugadores.map(J => { const h = posJ(J); return { x: +(h.x / C).toFixed(2), z: +(h.z / C).toFixed(2), py: +J.py.toFixed(2), yaw: +J.yaw.toFixed(2), puerta: J.puertaActiva && [J.puertaActiva.x, J.puertaActiva.z], enSalida: J.enSalida }; }),
                modal: modal && modal.tipo, vidas, codigo: codigo.join(''), pistas: pistasHalladas.join(''),
                cajas: J0.puertaActiva?.cajas?.map(c => [+(c.x / C).toFixed(2), +(c.z / C).toFixed(2)]), correcta: J0.puertaActiva?.pregunta && J0.puertaActiva.pregunta.opciones.indexOf(J0.puertaActiva.pregunta.correcta),
                enemigos: enemigos.map(e => [+(e.g.position.x / C).toFixed(1), +(e.g.position.z / C).toFixed(1), clasico ? e.modo : 'ruta']),
            };
        },
        destruir() {
            killed = true;
            renderer.setAnimationLoop(null);
            salirPunteroBloqueado();
            limpiezas.forEach(f => { try { f(); } catch { } });
            const s = renderer.xr.getSession();
            const liberarTodo = () => {
                if (grupoNivel) liberar(grupoNivel);
                [panel, hudVR, toastVR, marcaTP, arcoTP, laser].forEach(liberar);
                manos.forEach(liberar);
                jugadores.forEach(J => { liberar(J.tinte); J.pi.dispose(); });
                panelTex.dispose(); hudTex.dispose(); toastTex.dispose();
                renderer.dispose();
                lienzo.remove();
            };
            if (s) { s.end().catch(() => { }).finally(liberarTodo); } else liberarTodo();
        },
    };
}
