// Motor three.js del Partido 3D de Fútbol Quizz: 3 jugadores + portero por equipo, en tiempo real.
// El alumno controla el equipo rojo (ataca hacia +x); el ordenador, el azul (ataca hacia -x).
// React solo maneja el HUD y las preguntas: el motor avisa por callbacks (cb()) y lee los mandos de `input`.
import * as THREE from 'three';

const L = 20;          // media longitud del campo (x)
const W = 13;          // media anchura del campo (z)
const GOAL_W = 2.6;    // media anchura de la portería
const GOAL_H = 2.1;
const GOAL_D = 1.5;    // fondo de la red
const BALL_R = 0.22;
const GRAV = 18;
const PR = 0.42;       // radio de un jugador (para separarlos)
const MURO_Z = W + 0.6;
const MURO_X = L + 0.25;
const VEL_BASE = 6.2;
const VEL_SPRINT = 8.4;

// Nivel del ordenador. vel = velocidad de crucero; presion = fracción del sprint al presionar al que lleva el balón
// (por debajo de 0,74 el alumno puede escaparse regateando sin esprintar); robo = intentos/s cuando está pegado;
// entrada = probabilidad/s de hacer una entrada; error = multiplicador del error de sus tiros.
const DIFICULTAD = {
    facil: { vel: 0.75, presion: 0.66, robo: 0.6, reaccion: 0.6, tiroDist: 9, portero: 4.0, parada: 0.6, entrada: 0.12, error: 2.2 },
    normal: { vel: 0.85, presion: 0.78, robo: 1.1, reaccion: 0.42, tiroDist: 12, portero: 4.8, parada: 0.78, entrada: 0.3, error: 1.6 },
    dificil: { vel: 0.95, presion: 0.95, robo: 2.2, reaccion: 0.22, tiroDist: 14, portero: 5.8, parada: 0.95, entrada: 0.7, error: 1.0 },
};
const PORTERO_ROJO = 5.2; // el portero del alumno no depende del nivel elegido

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const len = (x, z) => Math.hypot(x, z);

// ---------------------------------------------------------------------------
// Texturas generadas en canvas
// ---------------------------------------------------------------------------
function texturaCesped() {
    const c = document.createElement('canvas');
    c.width = 1536; c.height = 1024;
    const g = c.getContext('2d');
    const sx = c.width / (2 * (L + 3)), sz = c.height / (2 * (W + 3));
    const X = x => (x + L + 3) * sx, Z = z => (z + W + 3) * sz;
    g.fillStyle = '#3c8f3c'; g.fillRect(0, 0, c.width, c.height);
    const franjas = 14;
    for (let i = 0; i < franjas; i++) {
        const x0 = X(-L + (2 * L / franjas) * i), x1 = X(-L + (2 * L / franjas) * (i + 1));
        g.fillStyle = i % 2 ? '#3f9a3f' : '#47a947';
        g.fillRect(x0, Z(-W), x1 - x0 + 1, Z(W) - Z(-W));
    }
    g.strokeStyle = 'rgba(255,255,255,0.92)'; g.lineWidth = 5;
    g.strokeRect(X(-L), Z(-W), X(L) - X(-L), Z(W) - Z(-W));
    g.beginPath(); g.moveTo(X(0), Z(-W)); g.lineTo(X(0), Z(W)); g.stroke();
    g.beginPath(); g.ellipse(X(0), Z(0), 3.5 * sx, 3.5 * sz, 0, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'white';
    g.beginPath(); g.ellipse(X(0), Z(0), 0.25 * sx, 0.25 * sz, 0, 0, Math.PI * 2); g.fill();
    [-1, 1].forEach(s => {
        const xa = X(s * L), xb = X(s * (L - 5)), xc = X(s * (L - 1.8));
        g.strokeRect(Math.min(xa, xb), Z(-6.5), Math.abs(xb - xa), Z(6.5) - Z(-6.5));
        g.strokeRect(Math.min(xa, xc), Z(-3.6), Math.abs(xc - xa), Z(3.6) - Z(-3.6));
        g.beginPath(); g.ellipse(X(s * (L - 3.5)), Z(0), 0.2 * sx, 0.2 * sz, 0, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.ellipse(X(s * (L - 3.5)), Z(0), 3 * sx, 3 * sz, 0, s > 0 ? Math.PI * 0.62 : -Math.PI * 0.38, s > 0 ? Math.PI * 1.38 : Math.PI * 0.38); g.stroke();
    });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
}

function texturaBalon() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 128);
    g.fillStyle = '#1b1b1b';
    for (let j = 0; j < 3; j++) for (let i = 0; i < 6; i++) {
        const x = i * 256 / 6 + (j % 2) * 21, y = 22 + j * 42;
        g.beginPath();
        for (let k = 0; k < 5; k++) {
            const a = k / 5 * Math.PI * 2 - Math.PI / 2;
            g.lineTo(x + Math.cos(a) * 11, y + Math.sin(a) * 11);
        }
        g.closePath(); g.fill();
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

function texturaRed() {
    const c = document.createElement('canvas'); c.width = 32; c.height = 32;
    const g = c.getContext('2d');
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 2;
    g.strokeRect(0, 0, 32, 32);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
}

function texturaPublico() {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#2a2f3d'; g.fillRect(0, 0, 1024, 256);
    const cols = ['#ef4444', '#3b82f6', '#f1c40f', '#ffffff', '#22c55e', '#f97316', '#a855f7', '#e2e8f0', '#1e293b'];
    for (let y = 8; y < 256; y += 13) {
        for (let x = 4 + (y % 2) * 4; x < 1024; x += 9) {
            g.fillStyle = cols[(Math.random() * cols.length) | 0];
            g.fillRect(x - 3, y, 7, 6);
            g.fillStyle = ['#f1c27d', '#e0ac69', '#8d5524', '#c68642', '#ffdbac'][(Math.random() * 5) | 0];
            g.beginPath(); g.arc(x, y - 2, 3, 0, Math.PI * 2); g.fill();
        }
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

function texturaSombra() {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
}

// Plano con UV escaladas a su tamaño (para que la red tenga cuadros iguales en todas las caras)
function planoRed(w, h, mat) {
    const geo = new THREE.PlaneGeometry(w, h);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w * 4, uv.getY(i) * h * 4);
    return new THREE.Mesh(geo, mat);
}

// ---------------------------------------------------------------------------
// Jugador low-poly (mira hacia +x en su espacio local)
// ---------------------------------------------------------------------------
const PIELES = [0xf1c27d, 0xe0ac69, 0x8d5524, 0xc68642, 0xffdbac];
const PELOS = [0x2b1b0e, 0x111111, 0x6b3e1e, 0xd9b45a, 0x4a2c17];

function crearGeometriasJugador() {
    const pierna = new THREE.BoxGeometry(0.15, 0.6, 0.15); pierna.translate(0, -0.3, 0);
    const brazo = new THREE.BoxGeometry(0.11, 0.48, 0.11); brazo.translate(0, -0.24, 0);
    return {
        torso: new THREE.CapsuleGeometry(0.25, 0.42, 4, 10),
        short: new THREE.BoxGeometry(0.36, 0.24, 0.5),
        cabeza: new THREE.SphereGeometry(0.19, 14, 12),
        pelo: new THREE.SphereGeometry(0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
        ojo: new THREE.SphereGeometry(0.03, 6, 6),
        pierna, brazo,
        bota: new THREE.BoxGeometry(0.26, 0.09, 0.14),
    };
}

function crearMallaJugador(GEO, colores) {
    const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
    const matCam = lam(colores.camiseta), matShort = lam(colores.short), matPiel = lam(PIELES[(Math.random() * PIELES.length) | 0]);
    const matMedia = lam(colores.media), matBota = lam(0x161616), matPelo = lam(PELOS[(Math.random() * PELOS.length) | 0]), matOjo = lam(0x111111);

    const root = new THREE.Group();
    const cuerpo = new THREE.Group(); root.add(cuerpo);
    const torso = new THREE.Mesh(GEO.torso, matCam); torso.position.y = 1.1; cuerpo.add(torso);
    const short = new THREE.Mesh(GEO.short, matShort); short.position.y = 0.74; cuerpo.add(short);
    const cabeza = new THREE.Mesh(GEO.cabeza, matPiel); cabeza.position.y = 1.74; cuerpo.add(cabeza);
    const pelo = new THREE.Mesh(GEO.pelo, matPelo); pelo.position.set(-0.02, 1.77, 0); cuerpo.add(pelo);
    [-0.07, 0.07].forEach(z => { const o = new THREE.Mesh(GEO.ojo, matOjo); o.position.set(0.17, 1.76, z); cuerpo.add(o); });

    const pierna = (z) => {
        const piv = new THREE.Group(); piv.position.set(0, 0.68, z);
        const m = new THREE.Mesh(GEO.pierna, matMedia); piv.add(m);
        const b = new THREE.Mesh(GEO.bota, matBota); b.position.set(0.05, -0.62, 0); piv.add(b);
        cuerpo.add(piv); return piv;
    };
    const brazo = (z) => {
        const piv = new THREE.Group(); piv.position.set(0, 1.42, z);
        const m = new THREE.Mesh(GEO.brazo, matCam); piv.add(m);
        cuerpo.add(piv); return piv;
    };
    return {
        root, cuerpo,
        piernaI: pierna(-0.12), piernaD: pierna(0.12),
        brazoI: brazo(-0.33), brazoD: brazo(0.33),
    };
}

// ---------------------------------------------------------------------------
// Sonidos sintetizados (Web Audio)
// ---------------------------------------------------------------------------
function crearAudio() {
    let actx = null;
    const asegurar = () => {
        try {
            if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
            if (actx.state === 'suspended') actx.resume();
        } catch (e) { /* sin audio */ }
    };
    const patada = (fuerte) => {
        if (!actx) return;
        const t = actx.currentTime;
        const o = actx.createOscillator(), gn = actx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(fuerte ? 190 : 150, t);
        o.frequency.exponentialRampToValueAtTime(48, t + 0.13);
        gn.gain.setValueAtTime(fuerte ? 0.7 : 0.45, t);
        gn.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
        o.connect(gn).connect(actx.destination); o.start(t); o.stop(t + 0.18);
        if (fuerte) {
            const buf = actx.createBuffer(1, actx.sampleRate * 0.5, actx.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
            const src = actx.createBufferSource(); src.buffer = buf;
            const f = actx.createBiquadFilter(); f.type = 'bandpass';
            f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.45);
            const g2 = actx.createGain(); g2.gain.setValueAtTime(0.35, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
            src.connect(f).connect(g2).connect(actx.destination); src.start(t);
        }
    };
    const poste = () => {
        if (!actx) return;
        const t = actx.currentTime;
        const o = actx.createOscillator(), gn = actx.createGain();
        o.type = 'triangle'; o.frequency.setValueAtTime(880, t);
        gn.gain.setValueAtTime(0.35, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        o.connect(gn).connect(actx.destination); o.start(t); o.stop(t + 0.5);
    };
    const cerrar = () => { try { actx?.close(); } catch (e) { } };
    return { asegurar, patada, poste, cerrar };
}

// ---------------------------------------------------------------------------
// MOTOR
// ---------------------------------------------------------------------------
export function montarMotor({ host, dificultad = 'normal', input, cb }) {
    const dif = DIFICULTAD[dificultad] || DIFICULTAD.normal;
    const audio = crearAudio();

    // --- Render ---
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x86b9e8);
    scene.fog = new THREE.Fog(0x86b9e8, 70, 140);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 300);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x3a5a3a, 1.6));
    const sol = new THREE.DirectionalLight(0xffffff, 1.6);
    sol.position.set(-12, 30, 18); scene.add(sol);

    // --- Campo y estadio ---
    const suelo = new THREE.Mesh(new THREE.PlaneGeometry(140, 100), new THREE.MeshLambertMaterial({ color: 0x2f6e2f }));
    suelo.rotation.x = -Math.PI / 2; suelo.position.y = -0.02; scene.add(suelo);
    const cesped = new THREE.Mesh(new THREE.PlaneGeometry(2 * (L + 3), 2 * (W + 3)), new THREE.MeshLambertMaterial({ map: texturaCesped() }));
    cesped.rotation.x = -Math.PI / 2; scene.add(cesped);

    // Vallas publicitarias (laterales y de fondo, con hueco para la portería)
    const matValla = new THREE.MeshLambertMaterial({ color: 0x1e3a8a });
    const matValla2 = new THREE.MeshLambertMaterial({ color: 0xf1c40f });
    const valla = (w, x, z, rotY, mat) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, 0.12), mat);
        m.position.set(x, 0.35, z); m.rotation.y = rotY; scene.add(m);
    };
    valla(2 * MURO_X + 0.4, 0, -(MURO_Z + 0.08), 0, matValla);
    valla(2 * MURO_X + 0.4, 0, MURO_Z + 0.08, 0, matValla);
    [-1, 1].forEach(s => {
        const largo = MURO_Z - GOAL_W - 0.15;
        valla(largo, s * (MURO_X + 0.08), (GOAL_W + 0.15 + largo / 2), Math.PI / 2, matValla2);
        valla(largo, s * (MURO_X + 0.08), -(GOAL_W + 0.15 + largo / 2), Math.PI / 2, matValla2);
    });

    // Gradas con público
    const texPub = texturaPublico();
    const matPub = new THREE.MeshLambertMaterial({ map: texPub });
    const gradas = [];
    const grada = (w, x, z, rotY) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 8), matPub);
        m.position.set(x, 3.6, z); m.rotation.y = rotY; m.rotateX(-0.55);
        scene.add(m); gradas.push({ m, y0: m.position.y });
    };
    grada(2 * L + 18, 0, -(W + 5.5), 0);
    grada(2 * W + 16, -(L + 6), 0, Math.PI / 2);
    grada(2 * W + 16, L + 6, 0, -Math.PI / 2);

    // Porterías
    const texRed = texturaRed();
    const matRed = new THREE.MeshBasicMaterial({ map: texRed, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    const matPoste = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const redesFondo = {};
    [-1, 1].forEach(s => {
        const gPoste = new THREE.CylinderGeometry(0.07, 0.07, GOAL_H, 10);
        [-GOAL_W, GOAL_W].forEach(z => {
            const p = new THREE.Mesh(gPoste, matPoste); p.position.set(s * L, GOAL_H / 2, z); scene.add(p);
            const pb = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, GOAL_H, 6), matPoste); pb.position.set(s * (L + GOAL_D), GOAL_H / 2, z); scene.add(pb);
        });
        const lar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2 * GOAL_W + 0.14, 10), matPoste);
        lar.rotation.x = Math.PI / 2; lar.position.set(s * L, GOAL_H, 0); scene.add(lar);
        const fondo = planoRed(2 * GOAL_W, GOAL_H, matRed);
        fondo.rotation.y = Math.PI / 2; fondo.position.set(s * (L + GOAL_D), GOAL_H / 2, 0); scene.add(fondo);
        redesFondo[s > 0 ? 'red' : 'blue'] = { mesh: fondo, x0: s * (L + GOAL_D), s, t: 0 };
        [-GOAL_W, GOAL_W].forEach(z => {
            const lado = planoRed(GOAL_D, GOAL_H, matRed);
            lado.position.set(s * (L + GOAL_D / 2), GOAL_H / 2, z); scene.add(lado);
        });
        const techo = planoRed(GOAL_D, 2 * GOAL_W, matRed);
        techo.rotation.x = -Math.PI / 2; techo.position.set(s * (L + GOAL_D / 2), GOAL_H, 0); scene.add(techo);
    });

    // Sombras falsas
    const texSombra = texturaSombra();
    const matSombra = new THREE.MeshBasicMaterial({ map: texSombra, transparent: true, depthWrite: false });
    const geoSombra = new THREE.PlaneGeometry(1, 1);
    const crearSombra = (tam) => {
        const m = new THREE.Mesh(geoSombra, matSombra);
        m.rotation.x = -Math.PI / 2; m.position.y = 0.015; m.scale.set(tam, tam, 1); scene.add(m); return m;
    };

    // Balón
    const matBalon = new THREE.MeshLambertMaterial({ map: texturaBalon(), emissive: 0x000000 });
    const balonMesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 20, 14), matBalon);
    scene.add(balonMesh);
    const sombraBalon = crearSombra(0.6);

    // Estela del súper tiro
    const geoChispa = new THREE.SphereGeometry(0.17, 8, 6);
    const chispas = Array.from({ length: 34 }, () => {
        const m = new THREE.Mesh(geoChispa, new THREE.MeshBasicMaterial({ color: 0xff7a00, transparent: true, opacity: 0 }));
        m.visible = false; scene.add(m); return { m, vida: 0 };
    });
    let chispaIdx = 0;

    // Indicadores del jugador controlado
    const anillo = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.64, 28), new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.9, depthWrite: false }));
    anillo.rotation.x = -Math.PI / 2; anillo.position.y = 0.03; scene.add(anillo);
    const flecha = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.32, 10), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
    flecha.rotation.x = Math.PI; scene.add(flecha);
    const barra = new THREE.Group();
    const barraFondo = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.11), new THREE.MeshBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.7, depthTest: false }));
    const geoFill = new THREE.PlaneGeometry(0.86, 0.07); geoFill.translate(0.43, 0, 0);
    const barraFill = new THREE.Mesh(geoFill, new THREE.MeshBasicMaterial({ color: 0x22c55e, depthTest: false }));
    barraFill.position.set(-0.43, 0, 0.001);
    barraFondo.renderOrder = 10; barraFill.renderOrder = 11;
    barra.add(barraFondo, barraFill); scene.add(barra);

    // --- Jugadores ---
    const GEO = crearGeometriasJugador();
    const COLORES = {
        red: { camiseta: 0xe53935, short: 0xffffff, media: 0xe53935 },
        blue: { camiseta: 0x1e66d0, short: 0x0f1f3a, media: 0x1e66d0 },
        redGK: { camiseta: 0xf1c40f, short: 0x111111, media: 0xf1c40f },
        blueGK: { camiseta: 0x22c55e, short: 0x111111, media: 0x22c55e },
    };
    const ROLES = ['GK', 'DEF', 'IZQ', 'DER'];
    const todos = [];
    ['red', 'blue'].forEach(team => {
        ROLES.forEach(role => {
            const malla = crearMallaJugador(GEO, COLORES[role === 'GK' ? team + 'GK' : team]);
            scene.add(malla.root);
            todos.push({
                team, role, s: team === 'red' ? 1 : -1,
                x: 0, z: 0, vx: 0, vz: 0, tvx: 0, tvz: 0, face: 0,
                malla, sombra: crearSombra(1.1),
                stun: 0, kickCd: 0, protect: 0, slide: 0, dive: 0, diveDir: 0, hold: 0, patada: 0,
                aiT: 0, regateZ: 0, fase: Math.random() * 6, stamina: 1, carga: 0, cargando: false,
                receptor: 0, ultimoTiro: -1,
            });
        });
    });
    const equipo = (t) => todos.filter(p => p.team === t);
    const jugadoresCampo = (t) => todos.filter(p => p.team === t && p.role !== 'GK');
    const portero = (t) => todos.find(p => p.team === t && p.role === 'GK');
    const rivales = (t) => todos.filter(p => p.team !== t);

    const ball = { x: 0, y: BALL_R, z: 0, vx: 0, vy: 0, vz: 0, owner: null, superT: 0, shotId: 0, lastKicker: null, dentro: false };
    let controlado = todos.find(p => p.team === 'red' && p.role === 'IZQ');
    let estado = 'PARADO';      // PARADO | JUEGO | GOL
    let pausado = false;
    let tCelebra = 0, equipoGol = null;
    let turboT = 0;
    let shake = 0;
    let tiempo = 0;

    // --- Entrada (teclado + mandos táctiles de React) ---
    const teclas = new Set();
    const prevBtn = {};
    const escribiendo = (e) => {
        const t = e.target;
        return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    };
    const onKeyDown = (e) => {
        audio.asegurar();
        if (escribiendo(e)) return;
        const k = e.key.toLowerCase();
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
        teclas.add(k);
    };
    const onKeyUp = (e) => { teclas.delete(e.key.toLowerCase()); };
    const onBlur = () => teclas.clear();
    const onPointer = () => audio.asegurar();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('pointerdown', onPointer);

    const leerEntrada = () => {
        const t = (...ks) => ks.some(k => teclas.has(k));
        const kx = (t('d', 'arrowright') ? 1 : 0) - (t('a', 'arrowleft') ? 1 : 0);
        const kz = (t('s', 'arrowdown') ? 1 : 0) - (t('w', 'arrowup') ? 1 : 0);
        let mx = input.x || 0, mz = input.z || 0;
        if (len(mx, mz) < 0.1) { const l = len(kx, kz) || 1; mx = kx / l; mz = kz / l; }
        const btn = (nombre, ks) => {
            const ahora = !!input[nombre] || t(...ks);
            const antes = !!prevBtn[nombre];
            prevBtn[nombre] = ahora;
            return { down: ahora, pressed: ahora && !antes, released: !ahora && antes };
        };
        return {
            mx, mz,
            sprint: !!input.sprint || t('shift'),
            tiro: btn('tiro', ['k']),
            pase: btn('pase', ['j']),
            vaselina: btn('vaselina', ['l']),
            super: btn('super', [' ']),
            cambio: btn('cambio', ['e', 'q']),
        };
    };

    // ------------------------------------------------------------------
    // Acciones con el balón
    // ------------------------------------------------------------------
    function patear(p, vx, vy, vz, opts = {}) {
        ball.owner = null;
        ball.vx = vx; ball.vy = vy; ball.vz = vz;
        ball.lastKicker = p;
        ball.superT = opts.super ? 1.4 : 0;
        ball.shotId++;
        ball.receptor = opts.receptor || null;
        p.kickCd = 0.3; p.patada = 0.25; p.cargando = false; p.hold = 0;
        audio.patada(!!opts.super || len(vx, vz) > 22);
    }

    function cambiarControl(p) {
        if (!p || p === controlado || p.role === 'GK') return;
        controlado.cargando = false;
        controlado = p;
    }

    // Distancia del rival más cercano a un punto
    const rivalMasCerca = (team, x, z) => {
        let d = 1e9;
        for (const r of rivales(team)) d = Math.min(d, len(r.x - x, r.z - z));
        return d;
    };

    // Compañero al que pasar. `pref` = dirección deseada; `exigir` descarta los que quedan detrás de ella.
    function mejorCompanero(p, pref, exigir) {
        let best = null, bs = -1e9;
        for (const m of jugadoresCampo(p.team)) {
            if (m === p) continue;
            const dx = m.x - p.x, dz = m.z - p.z, d = len(dx, dz);
            if (d < 2.5 || d > 28) continue;
            const cos = (dx * pref.x + dz * pref.z) / d;
            if (exigir && cos < 0.15) continue;
            const libre = Math.min(6, rivalMasCerca(p.team, m.x, m.z));
            // ¿algún rival cerca de la línea de pase?
            let bloqueo = 0;
            for (const r of rivales(p.team)) {
                const t = clamp(((r.x - p.x) * dx + (r.z - p.z) * dz) / (d * d), 0, 1);
                if (len(p.x + dx * t - r.x, p.z + dz * t - r.z) < 0.9 && t > 0.1 && t < 0.95) bloqueo -= 3;
            }
            const sc = cos * (exigir ? 5 : 1.5) + libre * 0.8 + (m.x - p.x) * p.s * 0.12 - d * 0.04 + bloqueo;
            if (sc > bs) { bs = sc; best = m; }
        }
        return best;
    }

    function pase(p, pref, exigir) {
        const pl = len(pref.x, pref.z) || 1;
        pref = { x: pref.x / pl, z: pref.z / pl };
        const m = mejorCompanero(p, pref, exigir);
        if (!m) { patear(p, pref.x * 12, 0.4, pref.z * 12); return; }
        const tx = m.x + m.vx * 0.45, tz = m.z + m.vz * 0.45;
        const dx = tx - ball.x, dz = tz - ball.z, d = len(dx, dz) || 1;
        const v = clamp(7 + d * 0.85, 9, 21);
        patear(p, dx / d * v, 0.5, dz / d * v, { receptor: m });
        m.receptor = 1.6;
        if (p.team === 'red') cambiarControl(m);
    }

    function paseElevado(p, m, fallback) {
        const tx = m ? m.x + m.vx * 0.8 : fallback.x, tz = m ? m.z + m.vz * 0.8 : fallback.z;
        const dx = tx - ball.x, dz = tz - ball.z, d = len(dx, dz) || 1;
        const T = clamp(d / 13, 0.5, 1.4);
        patear(p, dx / T, (GRAV / 2) * T, dz / T, { receptor: m });
        if (m) { m.receptor = T + 0.8; if (p.team === 'red') cambiarControl(m); }
    }

    // Tiro a portería. aimZ = punto de la portería al que apunta; `libre` permite despejar si mira hacia atrás.
    function tiro(p, power, aimZ, libre) {
        const gx = p.s * L;
        const dg = len(gx - ball.x, -ball.z) || 1;
        const fx = Math.cos(p.face), fz = Math.sin(p.face);
        let dx, dz;
        if (libre && (fx * (gx - ball.x) + fz * (-ball.z)) / dg < -0.1) {
            dx = fx; dz = fz;
        } else {
            dx = gx - ball.x; dz = aimZ - ball.z;
            const l = len(dx, dz) || 1; dx /= l; dz /= l;
            const err = ((power > 0.85 ? (power - 0.85) * 0.5 : 0) + dg * 0.004) * rnd(-1, 1) * (p.team === 'blue' ? dif.error : 1);
            const c = Math.cos(err), s = Math.sin(err);
            [dx, dz] = [dx * c - dz * s, dx * s + dz * c];
        }
        const v = 13 + power * 15;
        let vy = 1.0 + power * 3.0 + (power > 0.92 ? rnd(0, 2.5) : 0);
        if (dg < 6) vy = Math.min(vy, 2.4);
        patear(p, dx * v, vy, dz * v, { tiro: true });
    }

    // Súper tiro: muy potente, pero NO es gol seguro. Apunta al palo contrario al portero con un error
    // que crece con la distancia (de lejos puede ir al poste o fuera) y la parada depende de la distancia (iaPortero).
    function superTiro(p) {
        const gk = portero(p.team === 'red' ? 'blue' : 'red');
        const gx = p.s * L;
        const dist = len(gx - ball.x, -ball.z);
        const err = rnd(-1, 1) * Math.min(1.6, 0.25 + dist * 0.045);
        const aimZ = (gk.z > 0 ? -1 : 1) * (GOAL_W - 0.55) + err;
        let dx = gx - ball.x, dz = aimZ - ball.z;
        const d = len(dx, dz) || 1; dx /= d; dz /= d;
        const v = dist > 16 ? 28 : 31;
        patear(p, dx * v, 1.4 + d * 0.025, dz * v, { super: true, tiro: true });
        ball.distTiro = dist;
        shake = 0.35;
        cb().onSuper?.();
    }

    function vaselina(p, mz, pref) {
        const gx = p.s * L;
        const dg = len(gx - ball.x, -ball.z) || 1;
        const fx = Math.cos(p.face), fz = Math.sin(p.face);
        const hacia = (fx * (gx - ball.x) + fz * (-ball.z)) / dg;
        if (dg < 20 && hacia > 0.3) {
            const aimZ = Math.abs(mz) > 0.3 ? Math.sign(mz) * (GOAL_W - 0.6) : rnd(-1, 1);
            const dx = gx - ball.x, dz = aimZ - ball.z, d = len(dx, dz) || 1;
            const T = clamp(d / 15, 0.55, 1.3);
            patear(p, dx / T, (1.4 + (GRAV / 2) * T * T) / T, dz / T, { tiro: true });
        } else {
            const m = mejorCompanero(p, pref, true);
            paseElevado(p, m, { x: ball.x + pref.x * 14, z: ball.z + pref.z * 14 });
        }
    }

    function entrada(p, dx, dz) {
        if (len(dx, dz) < 0.1) { dx = Math.cos(p.face); dz = Math.sin(p.face); }
        const l = len(dx, dz); dx /= l; dz /= l;
        p.face = Math.atan2(dz, dx);
        p.slide = 0.42;
        p.vx = dx * 10; p.vz = dz * 10;
        p.stamina = Math.max(0, p.stamina - 0.1);
    }

    function ganarBalon(p) {
        ball.owner = p;
        ball.receptor = null;
        ball.superT = 0;
        p.protect = p.team === 'red' ? 0.75 : 0.45; // el alumno tiene algo más de margen para controlar
        p.receptor = 0;
        if (p.team === 'red' && p.role !== 'GK') cambiarControl(p);
    }

    function atrapar(gk) {
        ball.owner = gk; ball.vx = ball.vy = ball.vz = 0;
        ball.superT = 0; ball.receptor = null;
        gk.hold = 1.0;
    }

    // ------------------------------------------------------------------
    // Control del humano
    // ------------------------------------------------------------------
    function humano(dt) {
        const h = controlado;
        const inp = leerEntrada();
        const mag = Math.min(1, len(inp.mx, inp.mz));
        let dirx = 0, dirz = 0;
        if (mag > 0.12) { const l = len(inp.mx, inp.mz); dirx = inp.mx / l; dirz = inp.mz / l; }
        const tiene = ball.owner === h;
        const sprint = inp.sprint && h.stamina > 0.05 && mag > 0.3;
        if (sprint) h.stamina = Math.max(0, h.stamina - dt * 0.32);
        else h.stamina = Math.min(1, h.stamina + dt * 0.18);
        let v = (sprint ? VEL_SPRINT : VEL_BASE) * (turboT > 0 ? 1.18 : 1) * (tiene ? 0.93 : 1);
        if (h.cargando) v *= 0.75;
        h.tvx = dirx * v * mag; h.tvz = dirz * v * mag;
        const pref = mag > 0.12 ? { x: dirx, z: dirz } : { x: Math.cos(h.face), z: Math.sin(h.face) };

        if (tiene) {
            if (inp.tiro.pressed) { h.cargando = true; h.carga = 0; }
            if (h.cargando) {
                h.carga += dt;
                if (!inp.tiro.down || h.carga > 1.1) {
                    const aimZ = Math.abs(inp.mz) > 0.3 ? Math.sign(inp.mz) * (GOAL_W - 0.45) : rnd(-0.9, 0.9);
                    tiro(h, clamp(h.carga / 0.9, 0.15, 1), aimZ, true);
                    h.cargando = false;
                }
            } else if (inp.super.pressed) {
                if (cb().usarCarga?.()) superTiro(h);
                else cb().onAviso?.('Responde preguntas para conseguir ⚡');
            } else if (inp.pase.pressed) pase(h, pref, mag > 0.12);
            else if (inp.vaselina.pressed) vaselina(h, inp.mz, pref);
        } else {
            h.cargando = false;
            if (inp.tiro.pressed && h.slide <= 0 && h.stun <= 0) entrada(h, dirx, dirz);
            if (inp.pase.pressed || inp.cambio.pressed) {
                // cambiar al rojo (de campo) más cercano al balón
                let mejor = null, md = 1e9;
                for (const p of jugadoresCampo('red')) {
                    if (p === h) continue;
                    const d = len(p.x - ball.x, p.z - ball.z);
                    if (d < md) { md = d; mejor = p; }
                }
                cambiarControl(mejor);
                cambioT = 0.8; // respeta el cambio manual un momento antes del automático
            }
            if (inp.super.pressed) cb().onAviso?.('El súper tiro se usa con el balón en los pies');
        }
    }

    // ------------------------------------------------------------------
    // IA
    // ------------------------------------------------------------------
    function irA(p, tx, tz, v) {
        const dx = tx - p.x, dz = tz - p.z, d = len(dx, dz);
        if (d < 0.25) { p.tvx = 0; p.tvz = 0; return; }
        const k = v * Math.min(1, d / 1.2);
        p.tvx = dx / d * k; p.tvz = dz / d * k;
    }

    function posFormacion(p, atacando) {
        const s = p.s, bx = ball.x, bz = ball.z;
        let x, z;
        if (p.role === 'DEF') { x = -s * 10 + bx * 0.5 + (atacando ? s * 4 : 0); z = bz * 0.35; }
        else {
            x = -s * 2 + bx * 0.6 + (atacando ? s * 7 : 0);
            z = (p.role === 'IZQ' ? -5.5 : 5.5) + bz * 0.3;
        }
        return { x: clamp(x, -L + 2, L - 2), z: clamp(z, -W + 1, W - 1) };
    }

    // ¿Es p el jugador de campo de su equipo más cercano al balón (opcionalmente sin contar a uno)?
    function rangoCercania(p, excluir) {
        const dp = len(p.x - ball.x, p.z - ball.z);
        let rango = 0;
        for (const m of jugadoresCampo(p.team)) {
            if (m === p || m === excluir) continue;
            if (len(m.x - ball.x, m.z - ball.z) < dp) rango++;
        }
        return rango;
    }

    function iaRojo(p) {
        const o = ball.owner;
        if (p.receptor > 0 && !o) { irA(p, ball.x + ball.vx * 0.12, ball.z + ball.vz * 0.12, VEL_SPRINT * 0.95); return; }
        if (!o) {
            const dYo = len(p.x - ball.x, p.z - ball.z), dH = len(controlado.x - ball.x, controlado.z - ball.z);
            if (rangoCercania(p, controlado) === 0 && dYo + 2 < dH) { irA(p, ball.x, ball.z, VEL_SPRINT * 0.9); return; }
            const f = posFormacion(p, ball.x > 0); irA(p, f.x, f.z, VEL_BASE * 0.9); return;
        }
        if (o.team === 'red') { const f = posFormacion(p, true); irA(p, f.x, f.z, VEL_BASE * 0.95); return; }
        // defendiendo
        if (rangoCercania(p, controlado) === 0 && len(p.x - ball.x, p.z - ball.z) < 9 && len(controlado.x - ball.x, controlado.z - ball.z) > 2.5) {
            irA(p, ball.x - p.s * 0.6, ball.z, VEL_BASE);
        } else {
            const f = posFormacion(p, false); irA(p, f.x, f.z, VEL_BASE * 0.9);
        }
    }

    function iaAzulConBalon(p, dt) {
        const s = p.s, gx = s * L;
        const dg = len(gx - p.x, -p.z);
        let near = null, nd = 1e9;
        for (const r of rivales(p.team)) { const d = len(r.x - p.x, r.z - p.z); if (d < nd) { nd = d; near = r; } }
        p.aiT -= dt;
        if (p.aiT <= 0) {
            p.aiT = dif.reaccion + rnd(0, 0.25);
            if (dg < dif.tiroDist && (dg < 7 || nd > 1.8 || Math.random() < 0.35)) {
                const gk = portero('red');
                const lado = (gk.z > 0 ? -1 : 1) * (Math.random() < 0.75 ? 1 : -1);
                tiro(p, rnd(0.55, 1), lado * rnd(0.6, GOAL_W - 0.4), false);
                return;
            }
            const delante = near && (near.x - p.x) * s > -0.3;
            if (nd < 2.2 && delante && Math.random() < 0.65) {
                const m = mejorCompanero(p, { x: s, z: 0 }, false);
                if (m) {
                    if (Math.random() < 0.3) paseElevado(p, m);
                    else pase(p, { x: (m.x - p.x), z: (m.z - p.z) }, false);
                    return;
                }
            }
            p.regateZ = rnd(-1, 1);
        }
        // regate hacia la portería esquivando rivales
        let dx = s, dz = -p.z * 0.08 + p.regateZ * 0.3;
        for (const r of rivales(p.team)) {
            const rx = p.x - r.x, rz = p.z - r.z, d = len(rx, rz);
            if (d < 3.5 && d > 0.01) { const w = (3.5 - d) / 3.5; dx += rx / d * w * 1.2; dz += rz / d * w * 1.8; }
        }
        if (Math.abs(p.z) > W - 1.5) dz -= Math.sign(p.z);
        const l = len(dx, dz) || 1;
        const v = VEL_BASE * dif.vel * 0.95;
        p.tvx = dx / l * v; p.tvz = dz / l * v;
    }

    function iaAzul(p, dt) {
        const o = ball.owner;
        const vMax = VEL_BASE * dif.vel, vSpr = VEL_SPRINT * dif.vel;
        if (o === p) { iaAzulConBalon(p, dt); return; }
        if (!o) {
            if (p.receptor > 0 || rangoCercania(p) === 0) irA(p, ball.x + ball.vx * 0.15, ball.z + ball.vz * 0.15, vSpr);
            else { const f = posFormacion(p, ball.x * p.s > 0); irA(p, f.x, f.z, vMax); }
            return;
        }
        if (o.team === 'blue') { const f = posFormacion(p, true); irA(p, f.x, f.z, vMax); return; }
        // el rojo tiene el balón
        const rango = rangoCercania(p);
        const d = len(p.x - ball.x, p.z - ball.z);
        if (rango === 0) {
            irA(p, ball.x - p.s * 0.4, ball.z, vSpr * dif.presion);
            if (d < 1.6 && p.slide <= 0 && p.stun <= 0 && Math.random() < dif.entrada * dt) entrada(p, ball.x - p.x, ball.z - p.z);
        } else if (rango === 1) {
            const gx = -p.s * L;
            irA(p, ball.x + (gx - ball.x) * 0.3, ball.z * 0.6, vMax);
        } else {
            const f = posFormacion(p, false); irA(p, f.x, f.z, vMax);
        }
    }

    function iaPortero(p, dt) {
        const own = -p.s * L;
        const linea = own + p.s * 0.7;
        const rival = ball.lastKicker && ball.lastKicker.team !== p.team;
        const vMax = (p.team === 'blue' ? dif.portero : PORTERO_ROJO) * (ball.superT > 0 && rival ? 0.7 : 1);
        p.face = p.s > 0 ? 0 : Math.PI;

        if (ball.owner === p) {
            p.tvx = p.tvz = 0;
            p.hold -= dt;
            if (p.hold <= 0) {
                const m = mejorCompanero(p, { x: p.s, z: 0 }, false);
                if (m && Math.random() < 0.5) paseElevado(p, m);
                else if (m) pase(p, { x: m.x - p.x, z: m.z - p.z }, false);
                else patear(p, p.s * 16, 6, rnd(-4, 4));
            }
            return;
        }

        let tx = linea, tz = clamp(ball.z * 0.4, -GOAL_W + 0.4, GOAL_W - 0.4);
        const libre = !ball.owner;
        const haciaMi = -ball.vx * p.s;
        if (libre && haciaMi > 3) {
            const t = (linea - ball.x) / ball.vx;
            if (t > 0 && t < 1.5) tz = clamp(ball.z + ball.vz * t, -GOAL_W - 0.5, GOAL_W + 0.5);
        }
        const enArea = Math.abs(ball.x - own) < 5 && Math.abs(ball.z) < 6;
        if (libre && enArea && len(ball.vx, ball.vz) < 7) { tx = ball.x; tz = ball.z; }
        else if (ball.owner && ball.owner.team !== p.team && Math.abs(ball.x - own) < 4.5 && Math.abs(ball.z) < 5) {
            tx = own + p.s * 1.5; tz = clamp(ball.z * 0.7, -GOAL_W, GOAL_W);
        }
        irA(p, tx, tz, vMax);

        // Paradas
        if (libre && p.kickCd <= 0) {
            const dBall = len(ball.x - p.x, ball.z - p.z);
            const alcance = 0.75 + (haciaMi > 6 ? 0.55 : 0);
            if (dBall < alcance && ball.y < 2.35) {
                const sp = Math.hypot(ball.vx, ball.vy, ball.vz);
                if (sp < 7) { atrapar(p); return; }
                if (ball.lastKicker !== p && ball.shotId !== p.ultimoTiro) {
                    p.ultimoTiro = ball.shotId;
                    // súper tiro: casi imparable a bocajarro (~15 %), bastante parable de lejos (hasta ~65 %)
                    const prob = ball.superT > 0 && rival
                        ? clamp(0.15 + ((ball.distTiro || 10) - 8) * 0.04, 0.15, 0.65) * (p.team === 'blue' ? dif.parada : 1)
                        : clamp(1.08 - sp / 40, 0.3, 0.92) * (p.team === 'blue' ? dif.parada : 1);
                    p.dive = 0.55; p.diveDir = Math.sign(ball.z - p.z) || 1;
                    if (Math.random() < prob) {
                        if (sp < 16) atrapar(p);
                        else {
                            ball.vx = p.s * rnd(5, 9); ball.vz = rnd(-6, 6); ball.vy = rnd(2, 5);
                            ball.lastKicker = p; ball.superT = 0; ball.shotId++; p.ultimoTiro = ball.shotId; p.kickCd = 0.5;
                            audio.patada(false);
                        }
                    }
                }
            }
        }
    }

    // ------------------------------------------------------------------
    // Física
    // ------------------------------------------------------------------
    function moverJugadores(dt) {
        for (const p of todos) {
            if (p.slide > 0) {
                const f = Math.exp(-2.5 * dt); p.vx *= f; p.vz *= f;
            } else if (p.stun > 0 || p.dive > 0.2) {
                const f = Math.exp(-8 * dt); p.vx *= f; p.vz *= f;
            } else {
                const k = Math.min(1, 10 * dt);
                p.vx += (p.tvx - p.vx) * k; p.vz += (p.tvz - p.vz) * k;
            }
            p.x += p.vx * dt; p.z += p.vz * dt;
            if (p.role === 'GK') {
                const own = -p.s * L;
                p.x = p.s > 0 ? clamp(p.x, own + 0.3, own + 5) : clamp(p.x, own - 5, own - 0.3);
                p.z = clamp(p.z, -7, 7);
            } else {
                p.x = clamp(p.x, -L + 0.2, L - 0.2);
                p.z = clamp(p.z, -W - 0.2, W + 0.2);
            }
            const sp = len(p.vx, p.vz);
            if (p.role !== 'GK' && p.slide <= 0 && sp > 0.4) {
                const obj = Math.atan2(p.vz, p.vx);
                let d = obj - p.face;
                d = Math.atan2(Math.sin(d), Math.cos(d));
                const rate = (p === controlado ? 14 : 10) * dt;
                p.face += clamp(d, -rate, rate);
            }
        }
        // separar jugadores solapados
        for (let i = 0; i < todos.length; i++) for (let j = i + 1; j < todos.length; j++) {
            const a = todos[i], b = todos[j];
            const dx = b.x - a.x, dz = b.z - a.z, d = len(dx, dz), min = PR * 2;
            if (d < min && d > 0.001) {
                const e = (min - d) / 2, nx = dx / d, nz = dz / d;
                a.x -= nx * e; a.z -= nz * e; b.x += nx * e; b.z += nz * e;
            }
        }
    }

    function fisicaBalon(dt) {
        if (ball.owner) return;
        ball.vy -= GRAV * dt;
        const drag = Math.exp(-0.08 * dt);
        ball.vx *= drag; ball.vz *= drag;
        ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.z += ball.vz * dt;
        if (ball.y < BALL_R) {
            ball.y = BALL_R;
            ball.vy = ball.vy < -1.2 ? -ball.vy * 0.5 : 0;
        }
        if (ball.y <= BALL_R + 0.01) { const f = Math.exp(-0.9 * dt); ball.vx *= f; ball.vz *= f; }
        if (ball.superT > 0) ball.superT -= dt;

        // bandas
        if (Math.abs(ball.z) > MURO_Z - BALL_R) { ball.z = Math.sign(ball.z) * (MURO_Z - BALL_R); ball.vz = -ball.vz * 0.6; }

        const ax = Math.abs(ball.x), sx = Math.sign(ball.x);
        const enBoca = Math.abs(ball.z) < GOAL_W - 0.05 && ball.y < GOAL_H - 0.05;
        if (!ball.dentro && ax > MURO_X - BALL_R) {
            if (enBoca) ball.dentro = true;
            else { ball.x = sx * (MURO_X - BALL_R); ball.vx = -ball.vx * 0.6; }
        }
        if (ball.dentro) {
            const fondo = L + GOAL_D - BALL_R;
            if (Math.abs(ball.x) > fondo) { ball.x = sx * fondo; ball.vx = -ball.vx * 0.15; }
            if (Math.abs(ball.z) > GOAL_W - BALL_R) { ball.z = Math.sign(ball.z) * (GOAL_W - BALL_R); ball.vz *= -0.2; }
            if (ball.y > GOAL_H - BALL_R) { ball.y = GOAL_H - BALL_R; ball.vy = -Math.abs(ball.vy) * 0.2; }
            const f = Math.exp(-3 * dt); ball.vx *= f; ball.vz *= f;
        }

        // postes y larguero
        const min = BALL_R + 0.07;
        for (const s of [-1, 1]) {
            if (ball.y < GOAL_H + 0.1) {
                for (const pz of [-GOAL_W, GOAL_W]) {
                    const dx = ball.x - s * L, dz = ball.z - pz, d = len(dx, dz);
                    if (d < min && d > 0.0001) {
                        const nx = dx / d, nz = dz / d;
                        ball.x = s * L + nx * min; ball.z = pz + nz * min;
                        const vn = ball.vx * nx + ball.vz * nz;
                        if (vn < 0) { ball.vx -= 1.7 * vn * nx; ball.vz -= 1.7 * vn * nz; if (vn < -4) audio.poste(); }
                    }
                }
            }
            if (Math.abs(ball.z) < GOAL_W) {
                const dx = ball.x - s * L, dy = ball.y - GOAL_H, d = len(dx, dy);
                if (d < min && d > 0.0001) {
                    const nx = dx / d, ny = dy / d;
                    ball.x = s * L + nx * min; ball.y = GOAL_H + ny * min;
                    const vn = ball.vx * nx + ball.vy * ny;
                    if (vn < 0) { ball.vx -= 1.7 * vn * nx; ball.vy -= 1.7 * vn * ny; if (vn < -4) audio.poste(); }
                }
            }
        }
    }

    function posesion(dt) {
        const o = ball.owner;
        if (o) {
            if (o.role === 'GK') {
                ball.x = o.x + Math.cos(o.face) * 0.4; ball.z = o.z; ball.y = 1.1;
                ball.vx = ball.vy = ball.vz = 0;
                return;
            }
            const fx = Math.cos(o.face), fz = Math.sin(o.face);
            const k = Math.min(1, 16 * dt);
            ball.x += (o.x + fx * 0.58 - ball.x) * k;
            ball.z += (o.z + fz * 0.58 - ball.z) * k;
            ball.y = BALL_R; ball.vx = o.vx; ball.vz = o.vz; ball.vy = 0;
            for (const p of rivales(o.team)) {
                if (p.stun > 0 && p.slide <= 0) continue;
                const d = len(p.x - ball.x, p.z - ball.z);
                if (p.slide > 0 && d < 0.95) {
                    o.stun = 0.7; o.kickCd = 0.6; o.cargando = false;
                    ball.owner = null;
                    ball.vx = p.vx * 0.55 + rnd(-1, 1); ball.vz = p.vz * 0.55 + rnd(-1, 1); ball.vy = 1;
                    ball.lastKicker = p; ball.shotId++;
                    p.kickCd = 0.1;
                    audio.patada(false);
                    return;
                }
                if (d < 0.7 && o.protect <= 0 && p.role !== 'GK') {
                    const rate = p === controlado ? 3.2 : (p.team === 'blue' ? dif.robo : 1.6);
                    if (Math.random() < rate * dt) {
                        o.stun = 0.35; o.kickCd = 0.4; o.cargando = false;
                        ganarBalon(p);
                        return;
                    }
                }
            }
            return;
        }
        // balón suelto
        let mejor = null, md = 1e9;
        for (const p of todos) {
            if (p.role === 'GK' || p.kickCd > 0 || (p.stun > 0 && p.slide <= 0)) continue;
            const d = len(p.x - ball.x, p.z - ball.z);
            if (d < 0.65 && ball.y < 0.95 && d < md) { mejor = p; md = d; }
        }
        if (mejor) {
            const sp = len(ball.vx, ball.vz);
            if (mejor.slide > 0) {
                ball.vx = mejor.vx * 0.9; ball.vz = mejor.vz * 0.9; mejor.kickCd = 0.2;
                ball.lastKicker = mejor;
            } else if (sp > 19 && ball.lastKicker && ball.lastKicker.team !== mejor.team) {
                ball.vx *= -0.3; ball.vz = ball.vz * 0.3 + rnd(-3, 3); ball.vy = 2;
                mejor.kickCd = 0.25; ball.superT = 0;
            } else ganarBalon(mejor);
            return;
        }
        // cabezazos
        for (const p of todos) {
            if (p.role === 'GK' || p.kickCd > 0 || p.stun > 0) continue;
            if (len(p.x - ball.x, p.z - ball.z) < 0.6 && ball.y > 1.0 && ball.y < 2.1) {
                const gx = p.s * L;
                let dx, dz;
                if (len(gx - p.x, p.z) < 14) { dx = gx - ball.x; dz = rnd(-1.5, 1.5) - ball.z; }
                else { dx = Math.cos(p.face); dz = Math.sin(p.face); }
                const l = len(dx, dz) || 1;
                patear(p, dx / l * 10, 1.5, dz / l * 10, { tiro: true });
                break;
            }
        }
    }

    function comprobarGol() {
        if (estado !== 'JUEGO') return;
        if (Math.abs(ball.x) > L + BALL_R && Math.abs(ball.z) < GOAL_W && ball.y < GOAL_H) {
            const team = ball.x > 0 ? 'red' : 'blue';
            estado = 'GOL'; equipoGol = team; tCelebra = 2.8;
            redesFondo[team].t = 1;
            for (const p of todos) { p.cargando = false; }
            cb().onGol?.(team);
        }
    }

    // Sin el balón (defendiendo o balón suelto), el control pasa solo al rojo de campo más cercano.
    // Margen de 1,2 m y espera de 0,35 s entre cambios para que no parpadee entre dos jugadores.
    let cambioT = 0;
    function autoCambio(dt) {
        cambioT -= dt;
        const o = ball.owner;
        if (o && o.team === 'red') return;
        if (cambioT > 0 || controlado.slide > 0) return;
        // balón en camino a un compañero tras un pase nuestro: no tocar
        if (!o && ball.receptor && ball.receptor.team === 'red' && ball.receptor.receptor > 0) return;
        const dC = len(controlado.x - ball.x, controlado.z - ball.z);
        let mejor = null, md = 1e9;
        for (const p of jugadoresCampo('red')) {
            if (p === controlado || p.stun > 0) continue;
            const d = len(p.x - ball.x, p.z - ball.z);
            if (d < md) { md = d; mejor = p; }
        }
        if (mejor && md + 1.2 < dC) { cambiarControl(mejor); cambioT = 0.35; }
    }

    function paso(dt) {
        tiempo += dt;
        turboT -= dt;
        autoCambio(dt);
        for (const p of todos) {
            p.stun -= dt; p.kickCd -= dt; p.protect -= dt; p.dive -= dt; p.patada -= dt; p.receptor -= dt;
            if (p.slide > 0) { p.slide -= dt; if (p.slide <= 0) p.stun = 0.3; }
        }
        humano(dt);
        for (const p of todos) {
            if (p === controlado) continue;
            if (p.role === 'GK') iaPortero(p, dt);
            else if (p.team === 'blue') iaAzul(p, dt);
            else iaRojo(p);
        }
        moverJugadores(dt);
        fisicaBalon(dt);
        posesion(dt);
        comprobarGol();
    }

    function celebrar(dt) {
        tiempo += dt;
        for (const p of todos) { p.tvx = 0; p.tvz = 0; p.slide = 0; p.stun = 0; }
        moverJugadores(dt);
        fisicaBalon(dt);
        tCelebra -= dt;
        if (tCelebra <= 0) {
            estado = 'PARADO';
            cb().onFinCelebracion?.(equipoGol);
        }
    }

    function prepararSaque(saca) {
        const base = { GK: [-L + 0.7, 0], DEF: [-9, 0], IZQ: [-3.5, -5], DER: [-3.5, 5] };
        for (const p of todos) {
            const [bx, bz] = base[p.role];
            p.x = bx * p.s; p.z = bz;
            if (p.team === saca && p.role === 'IZQ') { p.x = -p.s * 0.55; p.z = 0; }
            p.vx = p.vz = p.tvx = p.tvz = 0;
            p.face = p.s > 0 ? 0 : Math.PI;
            p.stun = p.kickCd = p.protect = p.slide = p.dive = p.hold = p.patada = p.receptor = 0;
            p.cargando = false; p.stamina = 1;
        }
        Object.assign(ball, { x: 0, y: BALL_R, z: 0, vx: 0, vy: 0, vz: 0, owner: null, superT: 0, lastKicker: null, dentro: false, receptor: null });
        ball.shotId++;
        controlado = todos.find(p => p.team === 'red' && p.role === 'IZQ');
        estado = 'PARADO';
        for (const k in prevBtn) prevBtn[k] = true; // evita que un botón mantenido dispare al empezar
    }

    // ------------------------------------------------------------------
    // Visuales
    // ------------------------------------------------------------------
    const cam = { x: 0, z: 0 };
    let aspecto = 1;
    const ajustarTam = () => {
        const w = host.clientWidth || 1, h = host.clientHeight || 1;
        aspecto = w / h;
        renderer.setSize(w, h, false);
        camera.aspect = aspecto;
        camera.fov = aspecto < 1 ? 58 : 45;
        camera.updateProjectionMatrix();
    };
    ajustarTam();
    const ro = new ResizeObserver(ajustarTam);
    ro.observe(host);

    const ejeTmp = new THREE.Vector3();
    function visuales(dt) {
        // jugadores
        for (const p of todos) {
            const m = p.malla;
            m.root.position.set(p.x, 0, p.z);
            m.root.rotation.y = -p.face;
            const sp = len(p.vx, p.vz);
            p.fase += dt * (4 + sp * 1.6);
            const amp = clamp(sp / 7, 0, 1) * 0.9;
            const sw = Math.sin(p.fase) * amp;
            m.piernaI.rotation.z = sw; m.piernaD.rotation.z = -sw;
            m.brazoI.rotation.z = -sw * 0.8; m.brazoD.rotation.z = sw * 0.8;
            m.brazoI.rotation.x = 0; m.brazoD.rotation.x = 0;
            if (p.patada > 0) m.piernaD.rotation.z = 1.3 * (p.patada / 0.25);
            if (p.cargando) m.piernaD.rotation.z = -0.9 * Math.min(1, p.carga / 0.9);
            m.cuerpo.rotation.set(0, 0, 0);
            m.cuerpo.position.y = 0;
            if (p.slide > 0) { m.cuerpo.rotation.z = 1.15; m.cuerpo.position.y = 0.18; m.piernaD.rotation.z = 0.9; }
            else if (p.dive > 0) {
                const k = Math.sin(clamp(p.dive / 0.55, 0, 1) * Math.PI);
                m.cuerpo.rotation.x = p.diveDir * Math.cos(p.face) * 1.3 * k;
                m.brazoI.rotation.x = 2.8; m.brazoD.rotation.x = -2.8;
            } else if (p.role === 'GK' && ball.owner === p) {
                m.brazoI.rotation.z = m.brazoD.rotation.z = 1.4;
            }
            if (estado === 'GOL' && p.team === equipoGol) {
                m.cuerpo.position.y = Math.abs(Math.sin(tiempo * 9 + p.fase)) * 0.45;
                m.brazoI.rotation.x = 2.8; m.brazoD.rotation.x = -2.8;
            }
            p.sombra.position.x = p.x; p.sombra.position.z = p.z;
        }
        // balón
        balonMesh.position.set(ball.x, ball.y, ball.z);
        const vb = len(ball.vx, ball.vz);
        if (vb > 0.05) {
            ejeTmp.set(ball.vz, 0, -ball.vx).normalize();
            balonMesh.rotateOnWorldAxis(ejeTmp, vb * dt / BALL_R);
        }
        sombraBalon.position.set(ball.x, 0.016, ball.z);
        const sh = clamp(1 - ball.y / 6, 0.3, 1);
        sombraBalon.scale.set(0.65 * sh, 0.65 * sh, 1);
        const enSuper = ball.superT > 0 && !ball.owner;
        matBalon.emissive.setHex(enSuper ? 0xff5a00 : 0x000000);
        if (enSuper && vb > 6 && !pausado) {
            const c = chispas[chispaIdx++ % chispas.length];
            c.vida = 0.38; c.m.visible = true;
            c.m.position.set(ball.x + rnd(-0.08, 0.08), ball.y + rnd(-0.08, 0.08), ball.z + rnd(-0.08, 0.08));
        }
        for (const c of chispas) {
            if (c.vida <= 0) { c.m.visible = false; continue; }
            if (!pausado) c.vida -= dt;
            const k = Math.max(0, c.vida / 0.38);
            c.m.scale.setScalar(0.3 + k);
            c.m.material.opacity = k * 0.9;
            c.m.material.color.setHex(k > 0.5 ? 0xffd000 : 0xff4d00);
        }
        // indicadores del controlado
        const h = controlado;
        anillo.position.set(h.x, 0.03, h.z);
        flecha.position.set(h.x, 2.35 + Math.sin(tiempo * 5) * 0.08, h.z);
        anillo.material.color.setHex(turboT > 0 ? 0x22d3ee : 0xfacc15);
        barra.position.set(h.x, 2.1, h.z);
        barra.quaternion.copy(camera.quaternion);
        if (h.cargando) {
            const pw = clamp(h.carga / 0.9, 0.05, 1);
            barraFill.scale.x = pw;
            barraFill.material.color.setHex(pw > 0.85 ? 0xef4444 : 0xfacc15);
        } else {
            barraFill.scale.x = Math.max(0.02, h.stamina);
            barraFill.material.color.setHex(h.stamina < 0.25 ? 0xf97316 : 0x22c55e);
        }
        // redes que se mueven tras el gol
        for (const k in redesFondo) {
            const r = redesFondo[k];
            if (r.t > 0) { r.t = Math.max(0, r.t - dt * 1.2); r.mesh.position.x = r.x0 + r.s * Math.sin(r.t * 20) * r.t * 0.35; }
        }
        // público saltando en los goles
        for (const g of gradas) g.m.position.y = g.y0 + (estado === 'GOL' ? Math.abs(Math.sin(tiempo * 10)) * 0.25 : 0);

        // cámara de retransmisión
        const vertical = aspecto < 1;
        const margen = vertical ? 4 : 9;
        const objX = clamp(ball.x * 0.9, -L + margen, L - margen);
        const objZ = clamp(ball.z * 0.35, -4, 4);
        const k = Math.min(1, 3 * dt);
        cam.x += (objX - cam.x) * k; cam.z += (objZ - cam.z) * k;
        let sx = 0, sy = 0;
        if (shake > 0) { shake -= dt; sx = rnd(-0.25, 0.25); sy = rnd(-0.25, 0.25); }
        const alto = vertical ? 25 : 16.5, dist = vertical ? 21 : 17.5;
        camera.position.set(cam.x + sx, alto + sy, cam.z + dist);
        camera.lookAt(cam.x, 0, cam.z - 1.5);
    }

    // ------------------------------------------------------------------
    // Bucle
    // ------------------------------------------------------------------
    let raf = 0;
    let last = performance.now();
    const frame = (now) => {
        raf = requestAnimationFrame(frame);
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (!pausado) {
            if (estado === 'JUEGO') { paso(dt / 2); paso(dt / 2); }
            else if (estado === 'GOL') celebrar(dt);
            else leerEntrada(); // mantiene al día los flancos de los botones
        }
        visuales(dt);
        renderer.render(scene, camera);
    };
    prepararSaque('red');
    raf = requestAnimationFrame(frame);

    return {
        prepararSaque,
        saque() { estado = 'JUEGO'; },
        pausar(v) { pausado = !!v; teclas.clear(); },
        turbo(seg) { turboT = seg; },
        enJuego() { return estado === 'JUEGO' && !pausado; },
        destroy() {
            cancelAnimationFrame(raf);
            ro.disconnect();
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('blur', onBlur);
            window.removeEventListener('pointerdown', onPointer);
            const texturas = new Set();
            scene.traverse(o => {
                if (o.geometry) o.geometry.dispose();
                const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
                mats.forEach(m => { if (m.map) texturas.add(m.map); m.dispose(); });
            });
            texturas.forEach(t => t.dispose());
            renderer.dispose();
            renderer.domElement.remove();
            audio.cerrar();
        },
    };
}
