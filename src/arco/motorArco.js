// ─── Tiro con arco: motor three.js (fuera de React) ─────────────────────────
// Campo de tiro al aire libre (prado, bosque, colinas y montañas). El jugador
// tensa el arco, apunta y suelta: la flecha vuela con gravedad, rozamiento del
// aire y viento, y se clava en las dianas, en los árboles o en el suelo.
//   · modo 'preguntas': 4 dianas (A-D) → hay que clavar la flecha en la correcta.
//   · modo 'palabras' : 8 dianas con palabras → clavar todas las de la categoría (como el Ovni).
// Funciona con ratón/teclado, pantalla táctil y gafas VR (WebXR): en VR se agarra
// la cuerda con la otra mano, se tira hacia atrás y se suelta el gatillo.
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { instanciarModelo, ponerClip } from '../ovniModelos';

export const COLORES_OPCION = ['#e53935', '#1e88e5', '#43a047', '#fbc02d'];
export const LETRAS = ['A', 'B', 'C', 'D'];
export const DISTANCIAS = { cerca: [8, 14], media: [12, 22], lejos: [18, 32] };
export const VIENTOS = { sin: 0, suave: 2.5, fuerte: 5.5 };
export const DISTANCIAS_PINES = [10, 20, 30, 40];

// Física (unidades: metros, segundos)
const G = 9.81;
const KD = 0.0011;   // rozamiento cuadrático del aire (una flecha pierde ~10 % de velocidad en 30 m)
const KW = 0.3;      // empuje lateral del viento por cada m/s
const V_MIN = 15, V_MAX = 60;  // velocidad de salida: poco tensado → cae enseguida; a tope ≈ 216 km/h
const SUB = 1 / 240; // subpaso de integración

// Arco y jugador
const OJO = 1.62;
const BAJO_OJO = 0.08;     // la flecha va bajo el ojo (anclaje en la barbilla)
const BRACE = 0.17;        // distancia cuerda-empuñadura en reposo
const RECORRIDO = 0.44;    // lo que retrocede la cuerda a tope (pantalla)
const LARGO = 0.8;         // flecha
const T_TENSAR = 0.95;     // segundos hasta tensar del todo (con teclado/ratón/táctil)
const MAX_CLAVADAS = 36;
const ESCALA_VR = 1.2;      // en las gafas el arco mide ~1,6 m de punta a punta

// Cacería: el jugador camina y las respuestas van sobre animales que pasean despacio
const CONGELAR_S = 4;        // al empezar a tensar, los animales se quedan quietos estos segundos
const VEL_JUGADOR = 3.6;
const VEL_ANIMAL = 0.55;     // fracción del paso normal del animal (despacio: fácil de acertar)
const LIM_X = 44, LIM_Z0 = -84, LIM_Z1 = 26;
// alto en metros (los .glb del Ovni miden 1 y se escalan) y velocidad de paseo
const TIPOS_ANIMAL = {
    vaca: { paseo: 0.8, alto: 2.0 }, oveja: { paseo: 0.9, alto: 1.5 }, cerdo: { paseo: 0.9, alto: 1.35 },
    caballo: { paseo: 1.1, alto: 2.5 }, llama: { paseo: 0.9, alto: 2.1 }, perro: { paseo: 1.1, alto: 1.15 },
};
const lerpAng = (a, b, t) => { const d = ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return a + d * t; };
const limitarA = (v, a, b) => Math.max(a, Math.min(b, v));
const VIDA_FLECHA = 7;

const velocidadDe = (t) => V_MIN + (V_MAX - V_MIN) * Math.pow(Math.min(1, Math.max(0, t)), 1.25);
const suave = (k, dt) => 1 - Math.exp(-k * dt);
const lerp = (a, b, t) => a + (b - a) * t;

function azarCon(semilla) {
    let s = semilla >>> 0;
    return () => {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const barajar = (arr, azar = Math.random) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(azar() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
};

/** Altura del terreno: el campo de tiro es casi llano y alrededor suben colinas. */
export function altura(x, z) {
    const ruido = Math.sin(x * 0.045) * Math.cos(z * 0.05) * 1.2 + Math.sin(x * 0.11 + z * 0.07) * 0.5 + Math.sin(x * 0.021 - z * 0.018) * 2.5;
    const dx = Math.max(0, Math.abs(x) - 20);
    const dz = Math.max(0, z - 12, -z - 46);
    const lejos = Math.hypot(dx, dz);
    const k = Math.min(1, lejos / 30);
    return ruido * (0.05 + 0.95 * k) + Math.max(0, lejos - 30) * 0.22 * k;
}

// ─── Texturas de canvas ──────────────────────────────────────────────────────
// roundRect no existe en navegadores antiguos (Safari < 16): rectángulo normal
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); };
}
function texturaDiana() {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const x = c.getContext('2d');
    const cols = ['#f4f1e8', '#f4f1e8', '#1d1d1d', '#1d1d1d', '#1e88e5', '#1e88e5', '#e53935', '#e53935', '#fdd835', '#fdd835'];
    for (let i = 0; i < 10; i++) {
        const r = 256 * (1 - i / 10) - 1;
        x.beginPath(); x.arc(256, 256, r, 0, Math.PI * 2);
        x.fillStyle = cols[i]; x.fill();
        x.lineWidth = 2; x.strokeStyle = (i === 3 || i === 4) ? '#cfcfcf' : '#2a2a2a'; x.stroke();
    }
    x.strokeStyle = '#333'; x.lineWidth = 1.5;
    x.beginPath(); x.moveTo(248, 256); x.lineTo(264, 256); x.moveTo(256, 248); x.lineTo(256, 264); x.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
}

function texturaPaja() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = '#c9a85a'; x.fillRect(0, 0, 256, 64);
    for (let i = 0; i < 420; i++) {
        x.strokeStyle = ['#b08d43', '#dcc07a', '#a07a35', '#e8d290'][i % 4];
        x.lineWidth = 1 + Math.random();
        const px = Math.random() * 256, py = Math.random() * 64;
        x.beginPath(); x.moveTo(px, py); x.lineTo(px + 6 + Math.random() * 18, py + (Math.random() - 0.5) * 5); x.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
}

function partirLineas(ctx, texto, ancho) {
    const palabras = String(texto).split(/\s+/);
    const lineas = [];
    let actual = '';
    palabras.forEach(p => {
        const prueba = actual ? `${actual} ${p}` : p;
        if (ctx.measureText(prueba).width > ancho && actual) { lineas.push(actual); actual = p; } else actual = prueba;
    });
    if (actual) lineas.push(actual);
    return lineas;
}

/** Cartel de madera con una letra de color (A-D) opcional y el texto ajustado a 1-3 líneas. */
function texturaCartel(texto, { letra = null, color = '#6d4c2f' } = {}) {
    const W = 1024, H = 340;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#6d4c2f';
    x.beginPath(); x.roundRect(0, 0, W, H, 36); x.fill();
    x.fillStyle = '#f6ead0';
    x.beginPath(); x.roundRect(16, 16, W - 32, H - 32, 26); x.fill();
    x.strokeStyle = color; x.lineWidth = 14;
    x.beginPath(); x.roundRect(16, 16, W - 32, H - 32, 26); x.stroke();
    let x0 = 60;
    if (letra) {
        x.fillStyle = color;
        x.beginPath(); x.arc(170, H / 2, 112, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#fff'; x.font = '900 150px system-ui, sans-serif';
        x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(letra, 170, H / 2 + 8);
        x0 = 310;
    }
    const ancho = W - x0 - 60;
    x.fillStyle = '#2b1d10'; x.textAlign = 'center'; x.textBaseline = 'middle';
    let tam = 130, lineas = [];
    for (; tam >= 34; tam -= 6) {
        x.font = `800 ${tam}px system-ui, sans-serif`;
        lineas = partirLineas(x, texto, ancho);
        const anchoMax = Math.max(...lineas.map(l => x.measureText(l).width));
        if (lineas.length * tam * 1.08 <= H - 60 && anchoMax <= ancho) break;
    }
    const cx = x0 + ancho / 2;
    lineas.forEach((l, i) => x.fillText(l, cx, H / 2 + (i - (lineas.length - 1) / 2) * tam * 1.08 + 4));
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return t;
}

function texturaTexto(texto, color = '#ffffff', borde = '#000000') {
    const c = document.createElement('canvas'); c.width = 768; c.height = 160;
    const x = c.getContext('2d');
    x.font = '900 104px system-ui, sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 16; x.strokeStyle = borde; x.strokeText(texto, 384, 84);
    x.fillStyle = color; x.fillText(texto, 384, 84);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

function texturaPunto() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
}

// ─── Modelos ─────────────────────────────────────────────────────────────────
/** Arco recurvo. Local: +Y arriba, la flecha sale hacia −Z y la cuerda queda en +Z. */
function crearArco3D() {
    const g = new THREE.Group();
    const madera = new THREE.MeshStandardMaterial({ color: 0x6b3f22, roughness: 0.5, metalness: 0.05 });
    const palaMat = new THREE.MeshStandardMaterial({ color: 0x23272b, roughness: 0.35, metalness: 0.3 });
    const cuero = new THREE.MeshStandardMaterial({ color: 0x2e1b10, roughness: 0.9 });
    const cuerdaMat = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.7 });

    const riser = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.36, 0.05), madera);
    g.add(riser);
    const empu = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.019, 0.11, 10), cuero);
    empu.position.set(0, -0.03, 0.012); g.add(empu);
    const repisa = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.006, 0.03), cuero);
    repisa.position.set(-0.022, 0.03, 0); g.add(repisa);

    // pala: tubo a lo largo de una curva recurva; pivote en el extremo del riser
    const curva = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.16, 0.035), new THREE.Vector3(0, 0.32, 0.095),
        new THREE.Vector3(0, 0.44, 0.15), new THREE.Vector3(0, 0.5, 0.165), new THREE.Vector3(0, 0.53, 0.14),
    ]);
    const palaGeo = new THREE.TubeGeometry(curva, 28, 0.011, 6, false);
    palaGeo.scale(1.7, 1, 1);
    const tipLocal = new THREE.Vector3(0, 0.505, 0.162);
    const palaSup = new THREE.Group(); palaSup.position.set(0, 0.175, 0);
    palaSup.add(new THREE.Mesh(palaGeo, palaMat));
    const palaInf = new THREE.Group(); palaInf.position.set(0, -0.175, 0); palaInf.rotation.z = Math.PI;
    palaInf.add(new THREE.Mesh(palaGeo, palaMat));
    g.add(palaSup, palaInf);

    // cuerda: dos cilindros (punta superior → culatín → punta inferior)
    const cuerdaGeo = new THREE.CylinderGeometry(0.0017, 0.0017, 1, 4); cuerdaGeo.translate(0, 0.5, 0);
    const cuerdaA = new THREE.Mesh(cuerdaGeo, cuerdaMat), cuerdaB = new THREE.Mesh(cuerdaGeo, cuerdaMat);
    g.add(cuerdaA, cuerdaB);

    const ARRIBA = new THREE.Vector3(0, 1, 0);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
    const orientar = (m, p, q) => {
        d.subVectors(q, p);
        const l = d.length() || 1e-4;
        m.position.copy(p); m.scale.set(1, l, 1);
        m.quaternion.setFromUnitVectors(ARRIBA, d.multiplyScalar(1 / l));
    };
    const culatin = new THREE.Vector3();
    let vibra = 0, tVibra = 0;
    g.userData = {
        // t = tensado 0..1; nockZ = posición del culatín (local)
        actualizar(t, nockZ, dt) {
            const flex = 0.24 * t;
            palaSup.rotation.x = flex;
            palaInf.rotation.x = -flex;
            palaSup.updateMatrix(); palaInf.updateMatrix();
            a.copy(tipLocal).applyMatrix4(palaSup.matrix);
            b.copy(tipLocal).applyMatrix4(palaInf.matrix);
            // tras el disparo la cuerda vibra unos instantes
            let z = nockZ;
            if (vibra > 0.001) { tVibra += dt; z = BRACE + Math.sin(tVibra * 70) * 0.03 * vibra; vibra *= Math.exp(-dt * 9); }
            culatin.set(-0.012, 0.032, Math.max(z, Math.min(a.z, b.z) - 0.002));
            orientar(cuerdaA, culatin, a);
            orientar(cuerdaB, culatin, b);
        },
        soltar() { vibra = 1; tVibra = 0; },
        culatin,
    };
    g.userData.actualizar(0, BRACE, 0);
    return g;
}

/** Flecha con la punta en el origen y el culatín en +Z (largo LARGO). */
function crearFlecha() {
    const g = new THREE.Group();
    const astil = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0042, LARGO - 0.04, 6).rotateX(Math.PI / 2).translate(0, 0, LARGO / 2 + 0.02),
        new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.6 }));
    const punta = new THREE.Mesh(new THREE.ConeGeometry(0.0075, 0.05, 8).rotateX(-Math.PI / 2).translate(0, 0, 0.025),
        new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.25, metalness: 0.9 }));
    const culatin = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.018, 6).rotateX(Math.PI / 2).translate(0, 0, LARGO - 0.006),
        new THREE.MeshStandardMaterial({ color: 0xff8f00, roughness: 0.5 }));
    g.add(astil, punta, culatin);
    // plumas: 3 aletas en el plano (y, z) giradas 120°
    const forma = new THREE.BufferGeometry();
    forma.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.004, LARGO - 0.03, 0, 0.004, LARGO - 0.13, 0, 0.021, LARGO - 0.05], 3));
    forma.computeVertexNormals();
    const plumaA = new THREE.MeshStandardMaterial({ color: 0xd32f2f, side: THREE.DoubleSide, roughness: 0.8 });
    const plumaB = new THREE.MeshStandardMaterial({ color: 0xfafafa, side: THREE.DoubleSide, roughness: 0.8 });
    for (let i = 0; i < 3; i++) {
        const p = new THREE.Mesh(forma, i === 0 ? plumaA : plumaB);
        p.rotation.z = (i * Math.PI * 2) / 3;
        g.add(p);
    }
    return g;
}

function crearMano(color = 0x3b2414) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
    const palma = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.085, 0.045), mat);
    g.add(palma);
    for (let i = 0; i < 3; i++) {
        const dedo = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.035, 2, 6), mat);
        dedo.rotation.x = Math.PI / 2;
        dedo.position.set(-0.024 + i * 0.024, -0.03 + i * 0.008, -0.03);
        g.add(dedo);
    }
    return g;
}

// ─── Motor ───────────────────────────────────────────────────────────────────
/**
 * @param {HTMLElement} cont
 * @param {object} op  { modo:'preguntas'|'palabras', preguntas[{enunciado,correcta,opciones}], generarRonda(i), rondas,
 *                       vidas (0 = sin límite), distancia, viento, movil, ayuda:'trayectoria'|'pines'|'ninguna',
 *                       manoArco:'left'|'right', sonido, xrSession, dom:{tension, aliento} }
 * @param {object} cb  onRonda, onEstado, onImpacto, onViento, onPines, onFin, onAviso, onVR
 */
export function crearArco(cont, op, cb = {}) {
    const tactil = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    const pocaMemoria = (navigator.deviceMemory && navigator.deviceMemory <= 4) || (tactil && Math.min(screen.width, screen.height) < 900);
    const calidad = pocaMemoria ? 0 : 1;
    const azar = azarCon(Date.now() & 0xffff);
    const enCaza = op.escenario === 'caza';
    const escenario = azarCon(20261125); // el bosque siempre igual

    // ── Renderer, escena, cámara ──
    const renderer = new THREE.WebGLRenderer({ antialias: !pocaMemoria, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, calidad ? 2 : 1.5));
    renderer.setSize(cont.clientWidth || 800, cont.clientHeight || 600);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.62;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.xr.enabled = true;
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none;';
    cont.appendChild(renderer.domElement);

    const escena = new THREE.Scene();
    const COLOR_NIEBLA = new THREE.Color(0xc4d6e2);
    escena.fog = new THREE.Fog(COLOR_NIEBLA, 90, 560);
    const camara = new THREE.PerspectiveCamera(72, (cont.clientWidth || 800) / (cont.clientHeight || 600), 0.02, 3000);
    const rig = new THREE.Group();
    rig.position.set(0, altura(0, 0), 0);
    rig.add(camara);
    camara.position.set(0, OJO, 0);
    escena.add(rig);

    const recursos = []; // geometrías/materiales/texturas a liberar
    const guarda = (x) => { recursos.push(x); return x; };

    // ── Cielo y luces ──
    const dirSol = new THREE.Vector3(0.42, 0.6, 0.68).normalize();
    const cielo = new Sky();
    cielo.scale.setScalar(4500);
    const uc = cielo.material.uniforms;
    uc.turbidity.value = 4; uc.rayleigh.value = 1.3; uc.mieCoefficient.value = 0.004; uc.mieDirectionalG.value = 0.85;
    uc.sunPosition.value.copy(dirSol);
    if (uc.cloudCoverage) { uc.cloudCoverage.value = 0.45; uc.cloudDensity.value = 0.5; uc.cloudScale.value = 0.00025; uc.cloudSpeed.value = 0.00012; }
    escena.add(cielo);

    const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x5b7a34, 1.25);
    escena.add(hemi);
    const sol = new THREE.DirectionalLight(0xfff1d6, 3.2);
    sol.position.copy(dirSol).multiplyScalar(90).add(new THREE.Vector3(0, 0, -18));
    sol.target.position.set(0, 0, -18);
    sol.castShadow = true;
    sol.shadow.mapSize.set(calidad ? 2048 : 1024, calidad ? 2048 : 1024);
    Object.assign(sol.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 10, far: 220 });
    sol.shadow.bias = -0.0004; sol.shadow.normalBias = 0.03;
    escena.add(sol, sol.target);

    // ── Terreno ──
    const terrenoGeo = guarda(new THREE.PlaneGeometry(640, 640, calidad ? 200 : 140, calidad ? 200 : 140));
    terrenoGeo.rotateX(-Math.PI / 2);
    {
        const pos = terrenoGeo.attributes.position;
        const col = new Float32Array(pos.count * 3);
        const c = new THREE.Color(), c1 = new THREE.Color(0x4f8a32), c2 = new THREE.Color(0x77a843), roca = new THREE.Color(0x857f6a);
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i), z = pos.getZ(i);
            const h = altura(x, z);
            pos.setY(i, h);
            const n = 0.5 + 0.5 * Math.sin(x * 0.13 + Math.cos(z * 0.09) * 2) * Math.cos(z * 0.11 - x * 0.03);
            c.copy(c1).lerp(c2, n);
            const enCampo = Math.abs(x) < 20 && z < 12 && z > -46;
            if (enCampo) c.multiplyScalar(Math.floor((z + 200) / 3) % 2 ? 0.95 : 1.05); // césped segado a franjas
            if (h > 26) c.lerp(roca, Math.min(1, (h - 26) / 18));
            col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
        }
        terrenoGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        terrenoGeo.computeVertexNormals();
    }
    const terreno = new THREE.Mesh(terrenoGeo, guarda(new THREE.MeshLambertMaterial({ vertexColors: true })));
    terreno.receiveShadow = true;
    escena.add(terreno);

    // ── Montañas lejanas (la niebla les da el tono azulado) ──
    {
        const geos = [];
        for (let i = 0; i < 22; i++) {
            const ang = (i / 22) * Math.PI * 2 + escenario() * 0.2;
            const r = 360 + escenario() * 90;
            const alto = 70 + escenario() * 120;
            const gm = new THREE.ConeGeometry(60 + escenario() * 70, alto, 7, 1);
            gm.translate(Math.cos(ang) * r, alto / 2 - 6, Math.sin(ang) * r);
            geos.push(gm);
        }
        const montes = mergeGeometries(geos);
        geos.forEach(x => x.dispose());
        escena.add(new THREE.Mesh(guarda(montes), guarda(new THREE.MeshLambertMaterial({ color: 0x5f7d8f, flatShading: true }))));
    }

    // ── Hierba con viento (instanciada) ──
    const uTiempo = { value: 0 }, uViento = { value: 0 };
    {
        const hoja = new THREE.BufferGeometry();
        hoja.setAttribute('position', new THREE.Float32BufferAttribute([-0.035, 0, 0, 0.035, 0, 0, -0.02, 0.5, 0, 0.02, 0.5, 0, 0, 1, 0], 3));
        hoja.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
        hoja.setAttribute('color', new THREE.Float32BufferAttribute([0.55, 0.6, 0.5, 0.55, 0.6, 0.5, 0.85, 0.9, 0.8, 0.85, 0.9, 0.8, 1.1, 1.1, 1], 3));
        hoja.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 2, 1, 0, 2, 3, 1, 4, 3, 2]); // dos caras con la normal hacia arriba (sin DoubleSide, que la invierte)
        guarda(hoja);
        const mat = guarda(new THREE.MeshLambertMaterial({ vertexColors: true }));
        mat.onBeforeCompile = (sh) => {
            sh.uniforms.uTiempo = uTiempo; sh.uniforms.uViento = uViento;
            sh.vertexShader = 'uniform float uTiempo;\nuniform float uViento;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
                vec4 baseW = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
                float k = position.y * position.y;
                float ola = sin(uTiempo * 1.7 + baseW.x * 0.3 + baseW.z * 0.22) + 0.5 * sin(uTiempo * 3.3 + baseW.x * 0.9);
                transformed.x += ola * k * (0.07 + 0.035 * uViento);
                transformed.z += cos(uTiempo * 1.3 + baseW.z * 0.31) * k * 0.05;`);
        };
        const n = calidad ? 16000 : 6000;
        const hierba = new THREE.InstancedMesh(hoja, mat, n);
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color(), e = new THREE.Euler();
        for (let i = 0; i < n; i++) {
            let x, z;
            do { x = (escenario() - 0.5) * 84; z = 22 - escenario() * 92; } while (Math.abs(x) < 1.6 && Math.abs(z) < 1.2);
            p.set(x, altura(x, z), z);
            e.set((escenario() - 0.5) * 0.3, escenario() * Math.PI, (escenario() - 0.5) * 0.3);
            q.setFromEuler(e);
            const alto = 0.18 + escenario() * 0.34;
            s.set(0.8 + escenario() * 0.6, alto, 1);
            m.compose(p, q, s);
            hierba.setMatrixAt(i, m);
            c.setHSL(0.24 + escenario() * 0.06, 0.45 + escenario() * 0.2, 0.32 + escenario() * 0.14);
            hierba.setColorAt(i, c);
        }
        hierba.receiveShadow = true;
        hierba.frustumCulled = false;
        escena.add(hierba);

        // flores
        const nf = calidad ? 700 : 300;
        const flor = guarda(new THREE.IcosahedronGeometry(0.045, 0));
        const flores = new THREE.InstancedMesh(flor, guarda(new THREE.MeshLambertMaterial()), nf);
        const tonos = [0xffffff, 0xfff176, 0xce93d8, 0xffab91, 0x90caf9];
        for (let i = 0; i < nf; i++) {
            const x = (escenario() - 0.5) * 80, z = 20 - escenario() * 90;
            m.compose(p.set(x, altura(x, z) + 0.18 + escenario() * 0.15, z), q.identity(), s.setScalar(0.7 + escenario() * 0.8));
            flores.setMatrixAt(i, m);
            flores.setColorAt(i, c.setHex(tonos[Math.floor(escenario() * tonos.length)]));
        }
        escena.add(flores);
    }

    // ── Árboles, arbustos y rocas ──
    const troncos = []; // colisionadores { x, z, r, y0, y1 }
    {
        const troncoGeo = guarda(new THREE.CylinderGeometry(0.16, 0.26, 1, 7).translate(0, 0.5, 0));
        const conos = [[1.0, 1.5, 0.75], [0.8, 1.3, 1.45], [0.55, 1.1, 2.1]].map(([r, h, y]) => new THREE.ConeGeometry(r, h, 8).translate(0, y, 0));
        const pinoGeo = guarda(mergeGeometries(conos));
        conos.forEach(x => x.dispose());
        const bolas = [[0, 0.9, 0, 1], [0.6, 0.6, 0.2, 0.7], [-0.55, 0.65, -0.15, 0.72], [0.1, 1.45, 0.1, 0.65]].map(([x, y, z, r]) => {
            const gb = new THREE.IcosahedronGeometry(r, 1);
            const pos = gb.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
                const j = 1 + 0.14 * Math.sin(vx * 7.1 + vy * 3.3) * Math.cos(vz * 5.7 - vy * 2.1);
                pos.setXYZ(i, vx * j, vy * j, vz * j);
            }
            return gb.translate(x, y, z);
        });
        const frondaGeo = guarda(mergeGeometries(bolas));
        bolas.forEach(x => x.dispose());
        frondaGeo.computeVertexNormals();

        const matTronco = guarda(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }));
        const matHoja = guarda(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }));
        const nArb = calidad ? 260 : 150;
        const lista = [];
        for (let i = 0; i < nArb * 4 && lista.length < nArb; i++) {
            const ang = escenario() * Math.PI * 2;
            const r = 26 + Math.pow(escenario(), 0.7) * 150;
            const x = Math.cos(ang) * r, z = Math.sin(ang) * r - 16;
            if (Math.abs(x) < 21 && z > -52 && z < 16) continue;     // el campo de tiro despejado
            if (lista.some(a => Math.hypot(a.x - x, a.z - z) < 3.2)) continue;
            lista.push({ x, z, pino: escenario() < 0.55, s: 0.8 + escenario() * 0.9, rot: escenario() * 6.28 });
        }
        // algunos árboles sueltos en los laterales del campo (se pueden clavar flechas)
        [[-17, -8], [16, -20], [-15, -33], [18, -41], [-19, -45], [13, 6], [-12, 9]].forEach(([x, z]) => lista.push({ x, z, pino: escenario() < 0.4, s: 0.9 + escenario() * 0.5, rot: escenario() * 6.28 }));

        const nPinos = lista.filter(a => a.pino).length;
        const mTronco = new THREE.InstancedMesh(troncoGeo, matTronco, lista.length);
        const mPino = new THREE.InstancedMesh(pinoGeo, matHoja, Math.max(1, nPinos));
        const mFronda = new THREE.InstancedMesh(frondaGeo, matHoja, Math.max(1, lista.length - nPinos));
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
        let ip = 0, iff = 0;
        lista.forEach((a, i) => {
            const y = altura(a.x, a.z) - 0.15;
            q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a.rot);
            const altoTronco = a.pino ? 1.6 * a.s : 2.4 * a.s;
            const grosor = a.pino ? 0.9 * a.s : 1.15 * a.s;
            mTronco.setMatrixAt(i, m.compose(p.set(a.x, y, a.z), q, s.set(grosor, altoTronco + (a.pino ? 2.2 * a.s : 0.8), grosor)));
            mTronco.setColorAt(i, c.setHSL(0.07 + escenario() * 0.03, 0.35, 0.2 + escenario() * 0.08));
            if (a.pino) {
                const e = 2.3 * a.s;
                mPino.setMatrixAt(ip, m.compose(p.set(a.x, y + altoTronco * 0.55, a.z), q, s.set(e, e * 1.25, e)));
                mPino.setColorAt(ip++, c.setHSL(0.33 + escenario() * 0.05, 0.42, 0.17 + escenario() * 0.08));
            } else {
                const e = 1.9 * a.s;
                mFronda.setMatrixAt(iff, m.compose(p.set(a.x, y + altoTronco * 0.85, a.z), q, s.set(e, e * 0.95, e)));
                const otono = escenario() < 0.08;
                mFronda.setColorAt(iff++, otono ? c.setHSL(0.1, 0.6, 0.38) : c.setHSL(0.25 + escenario() * 0.07, 0.48, 0.26 + escenario() * 0.1));
            }
            if (Math.hypot(a.x, a.z + 18) < 80) troncos.push({ x: a.x, z: a.z, r: 0.24 * grosor, y0: y, y1: y + altoTronco + (a.pino ? 1.5 * a.s : 0) });
        });
        mPino.count = ip; mFronda.count = iff;
        [mTronco, mPino, mFronda].forEach(x => { x.castShadow = true; x.receiveShadow = true; escena.add(x); });

        // arbustos
        const nArbus = calidad ? 110 : 60;
        const arbusto = new THREE.InstancedMesh(guarda(new THREE.IcosahedronGeometry(0.7, 1)), matHoja, nArbus);
        for (let i = 0; i < nArbus; i++) {
            let x, z;
            do { x = (escenario() - 0.5) * 120; z = 30 - escenario() * 120; } while (Math.abs(x) < 19 && z > -50 && z < 14);
            arbusto.setMatrixAt(i, m.compose(p.set(x, altura(x, z) + 0.1, z), q.identity(), s.set(0.8 + escenario(), 0.5 + escenario() * 0.5, 0.8 + escenario())));
            arbusto.setColorAt(i, c.setHSL(0.27 + escenario() * 0.06, 0.45, 0.22 + escenario() * 0.1));
        }
        arbusto.castShadow = true;
        escena.add(arbusto);

        // rocas
        const nRocas = 40;
        const rocas = new THREE.InstancedMesh(guarda(new THREE.DodecahedronGeometry(0.5, 0)), guarda(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true })), nRocas);
        for (let i = 0; i < nRocas; i++) {
            const x = (escenario() - 0.5) * 110, z = 25 - escenario() * 110;
            if (Math.abs(x) < 3 && z > -50) { rocas.setMatrixAt(i, m.compose(p.set(0, -50, 0), q, s.setScalar(0.01))); continue; }
            const e = 0.3 + escenario() * 1.1;
            q.setFromEuler(new THREE.Euler(escenario(), escenario() * 6, escenario()));
            rocas.setMatrixAt(i, m.compose(p.set(x, altura(x, z) + e * 0.15, z), q, s.set(e * 1.3, e * 0.7, e)));
            rocas.setColorAt(i, c.setHSL(0.1, 0.06, 0.42 + escenario() * 0.15));
        }
        rocas.castShadow = true; rocas.receiveShadow = true;
        escena.add(rocas);
    }

    // ── Puesto de tiro: tarima, carcaj y bandera ──
    const matMadera = guarda(new THREE.MeshStandardMaterial({ color: 0x8b6a43, roughness: 0.9 }));
    {
        const tarima = new THREE.Group();
        for (let i = 0; i < 6; i++) {
            const tabla = new THREE.Mesh(guarda(new THREE.BoxGeometry(3.2, 0.06, 0.26)), matMadera);
            tabla.position.set(0, 0.03, -0.75 + i * 0.29);
            tabla.receiveShadow = true;
            tarima.add(tabla);
        }
        tarima.position.set(0, altura(0, 0), 0.1);
        escena.add(tarima);
        // carcaj de suelo con flechas
        const carcaj = new THREE.Group();
        const tubo = new THREE.Mesh(guarda(new THREE.CylinderGeometry(0.06, 0.05, 0.55, 10, 1, true)), guarda(new THREE.MeshStandardMaterial({ color: 0x5d3a1a, roughness: 0.8, side: THREE.DoubleSide })));
        tubo.position.y = 0.6; carcaj.add(tubo);
        const pata = new THREE.Mesh(guarda(new THREE.CylinderGeometry(0.012, 0.012, 0.6, 5)), guarda(new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6 })));
        pata.position.y = 0.3; carcaj.add(pata);
        for (let i = 0; i < 6; i++) {
            const f = crearFlecha();
            f.rotation.x = -Math.PI / 2 + (i % 3 - 1) * 0.06;
            f.position.set(Math.cos(i * 1.2) * 0.025, 0.36, Math.sin(i * 1.2) * 0.025);
            carcaj.add(f);
        }
        carcaj.position.set(0.95, altura(0, 0) + 0.06, 0.25);
        carcaj.traverse(o => { if (o.isMesh) o.castShadow = true; });
        escena.add(carcaj);
    }
    // bandera que marca el viento
    const bandera = (() => {
        const g = new THREE.Group();
        const mastil = new THREE.Mesh(guarda(new THREE.CylinderGeometry(0.04, 0.05, 6, 8)), guarda(new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.4, roughness: 0.4 })));
        mastil.position.y = 3; mastil.castShadow = true; g.add(mastil);
        const telaGeo = guarda(new THREE.PlaneGeometry(1.6, 0.95, 14, 6));
        telaGeo.translate(0.8, 0, 0);
        const tela = new THREE.Mesh(telaGeo, guarda(new THREE.MeshStandardMaterial({ color: 0xff7043, side: THREE.DoubleSide, roughness: 0.8 })));
        tela.position.y = 5.4; tela.castShadow = true;
        const soporte = new THREE.Group(); soporte.add(tela); g.add(soporte);
        const base = telaGeo.attributes.position.array.slice();
        g.position.set(-9, altura(-9, -14), -14);
        escena.add(g);
        return { soporte, telaGeo, base };
    })();

    // ── Pájaros ──
    const pajaros = [];
    {
        const ala = guarda(new THREE.BufferGeometry());
        ala.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.12, 0, 0, 0.12, 0.6, 0, 0], 3));
        ala.computeVertexNormals();
        const matP = guarda(new THREE.MeshBasicMaterial({ color: 0x222222, side: THREE.DoubleSide }));
        for (let i = 0; i < 7; i++) {
            const g = new THREE.Group();
            const izq = new THREE.Mesh(ala, matP), der = new THREE.Mesh(ala, matP);
            der.scale.x = -1;
            g.add(izq, der);
            escena.add(g);
            g.scale.setScalar(2.2);
            pajaros.push({ g, izq, der, r: 30 + escenario() * 50, h: 22 + escenario() * 25, v: 0.08 + escenario() * 0.08, f: escenario() * 6, cx: (escenario() - 0.5) * 60, cz: -40 - escenario() * 60 });
        }
    }

    // ── Recursos compartidos de las dianas ──
    const texDiana = guarda(texturaDiana());
    const texPaja = guarda(texturaPaja());
    const matPaja = guarda(new THREE.MeshStandardMaterial({ map: texPaja, roughness: 1 }));
    const matPata = guarda(new THREE.MeshStandardMaterial({ color: 0x6d4c2f, roughness: 0.9 }));
    const geoPata = guarda(new THREE.CylinderGeometry(0.035, 0.045, 1, 6).translate(0, 0.5, 0));
    const texPunto = guarda(texturaPunto());

    // ── Arco, flecha cargada y manos ──
    const arco = crearArco3D();
    const flechaCargada = crearFlecha();
    arco.add(flechaCargada);
    const manoCuerda = crearMano();
    arco.add(manoCuerda);
    const manoArco = crearMano(0x3b2414);
    manoArco.scale.setScalar(0.9);
    manoArco.position.set(0.012, -0.03, 0.02);
    arco.add(manoArco);
    camara.add(arco);
    const plantillaFlecha = crearFlecha();

    // ── Ayuda: trayectoria prevista ──
    const N_TRAY = 90;
    const trayGeo = guarda(new THREE.BufferGeometry());
    trayGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_TRAY * 3), 3));
    const trayectoria = new THREE.Points(trayGeo, guarda(new THREE.PointsMaterial({ size: 7, sizeAttenuation: false, map: texPunto, transparent: true, depthWrite: false, color: 0xfff8e1, opacity: 0.95 })));
    trayectoria.frustumCulled = false; trayectoria.visible = false;
    escena.add(trayectoria);
    const marcaImpacto = new THREE.Mesh(guarda(new THREE.RingGeometry(0.07, 0.11, 24)), guarda(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide })));
    marcaImpacto.renderOrder = 10; marcaImpacto.visible = false;
    escena.add(marcaImpacto);

    // ── Panel para las gafas VR ──
    const panelVR = (() => {
        const c = document.createElement('canvas'); c.width = 1024; c.height = 600;
        const tex = guarda(new THREE.CanvasTexture(c)); tex.colorSpace = THREE.SRGBColorSpace;
        const malla = new THREE.Mesh(guarda(new THREE.PlaneGeometry(3.4, 2.0)), guarda(new THREE.MeshBasicMaterial({ map: tex, transparent: true })));
        malla.position.set(0, 3.1, -8);
        malla.visible = false;
        escena.add(malla);
        return { c, tex, malla };
    })();

    // ── Estado ──
    const modo = op.modo === 'palabras' ? 'palabras' : 'preguntas';
    const totalRondas = modo === 'preguntas' ? (op.preguntas || []).length : (op.rondas || 5);
    const vidasMax = op.vidas ?? 3;
    const juego = {
        fase: 'inicio', ronda: -1, vidas: vidasMax || Infinity, puntos: 0, aciertos: 0, fallos: 0, disparos: 0,
        centros: 0, enDiana: 0, disparosRonda: 0, falladas: [], acertadas: [], fallosLista: [], aciertosLista: [], datos: null, reloj: 0, terminado: false,
    };
    let dianas = [];
    const voladoras = [];   // flechas en el aire
    const clavadas = [];    // flechas quietas
    const efectos = [];     // partículas, textos flotantes…
    const viento = new THREE.Vector3();
    let sonidoOn = op.sonido !== false;

    // entrada
    let yaw = 0, pitch = 0.03;
    let tensando = false, tension = 0, tLleno = 0, alzado = 0, recarga = 0;
    let aguantar = false, aliento = 1, ahogo = 0;
    const teclas = new Set();
    let congelado = 0, congelUsado = false, tPaso = 0, pasoT = 0, cuadro = 0;
    const mov = { x: 0, y: 0 }; // joystick táctil (x derecha, y delante)
    let vr = null; // estado de las gafas

    // ── Audio (WebAudio, sin archivos) ──
    const audio = (() => {
        let ctx = null, master = null, ruido = null, vientoGain = null;
        try {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
            master = ctx.createGain(); master.gain.value = sonidoOn ? 0.8 : 0; master.connect(ctx.destination);
            ruido = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
            const d = ruido.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            // viento ambiente
            const src = ctx.createBufferSource(); src.buffer = ruido; src.loop = true;
            const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
            vientoGain = ctx.createGain(); vientoGain.gain.value = 0.05;
            src.connect(f); f.connect(vientoGain); vientoGain.connect(master); src.start();
        } catch { ctx = null; }
        const rafaga = ({ dur, f, f2, q = 1, tipo = 'bandpass', g = 0.3, ataque = 0.004, pan = 0 }) => {
            if (!ctx) return;
            const t0 = ctx.currentTime;
            const src = ctx.createBufferSource(); src.buffer = ruido;
            const fl = ctx.createBiquadFilter(); fl.type = tipo; fl.frequency.setValueAtTime(f, t0); fl.Q.value = q;
            if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
            const ga = ctx.createGain(); ga.gain.setValueAtTime(0.0001, t0); ga.gain.exponentialRampToValueAtTime(g, t0 + ataque); ga.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
            let fin = ga;
            if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; ga.connect(p); fin = p; }
            src.connect(fl); fl.connect(ga); fin.connect(master);
            src.start(t0, Math.random() * 1.5); src.stop(t0 + dur + 0.05);
        };
        const tono = ({ f, f2, dur, g = 0.2, tipo = 'sine', t = 0, pan = 0 }) => {
            if (!ctx) return;
            const t0 = ctx.currentTime + t;
            const o = ctx.createOscillator(); o.type = tipo; o.frequency.setValueAtTime(f, t0);
            if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
            const ga = ctx.createGain(); ga.gain.setValueAtTime(0.0001, t0); ga.gain.exponentialRampToValueAtTime(g, t0 + 0.005); ga.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
            let fin = ga;
            if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; ga.connect(p); fin = p; }
            o.connect(ga); fin.connect(master);
            o.start(t0); o.stop(t0 + dur + 0.05);
        };
        return {
            ctx: () => ctx,
            reanudar() { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => { }); },
            volumen(on) { if (master) master.gain.value = on ? 0.8 : 0; },
            viento(v) { if (vientoGain) vientoGain.gain.value = 0.04 + v * 0.012; },
            crujido(t) { rafaga({ dur: 0.05, f: 500 + 900 * t, q: 7, g: 0.05 + 0.1 * t }); },
            disparo(t) {
                tono({ f: 150, f2: 55, dur: 0.28, g: 0.12 + 0.3 * t, tipo: 'triangle' });
                rafaga({ dur: 0.07, f: 2600, tipo: 'highpass', g: 0.18 });
                rafaga({ dur: 0.55, f: 1500, f2: 420, q: 3, g: 0.05 + 0.12 * t, ataque: 0.02 });
            },
            diana(pan) { rafaga({ dur: 0.14, f: 300, tipo: 'lowpass', g: 0.7, pan }); tono({ f: 100, f2: 45, dur: 0.16, g: 0.35, pan }); },
            madera(pan) { tono({ f: 520, f2: 320, dur: 0.07, g: 0.22, tipo: 'square', pan }); rafaga({ dur: 0.06, f: 1900, q: 4, g: 0.35, pan }); },
            suelo(pan) { rafaga({ dur: 0.1, f: 240, tipo: 'lowpass', g: 0.25, pan }); },
            hielo() { tono({ f: 1800, f2: 2600, dur: 0.35, g: 0.06 }); tono({ f: 2400, f2: 3400, dur: 0.4, g: 0.04, t: 0.07 }); rafaga({ dur: 0.3, f: 6000, tipo: 'highpass', g: 0.05 }); },
            paso() { rafaga({ dur: 0.09, f: 350 + Math.random() * 250, tipo: 'lowpass', g: 0.12 }); },
            caida() { rafaga({ dur: 0.35, f: 180, tipo: 'lowpass', g: 0.35, ataque: 0.05 }); },
            pajaro() {
                const pan = Math.random() * 1.6 - 0.8, base = 2600 + Math.random() * 1600, n = 2 + Math.floor(Math.random() * 4);
                for (let i = 0; i < n; i++) tono({ f: base * (1 + 0.15 * Math.sin(i)), f2: base * 1.25, dur: 0.07, g: 0.025, t: i * 0.11, pan });
            },
            cerrar() { try { ctx?.close(); } catch { /* */ } },
        };
    })();
    let proximoPajaro = 2 + Math.random() * 4;

    // ── Utilidades de juego ──
    const emitirEstado = () => cb.onEstado?.({ vidas: juego.vidas, vidasMax, puntos: juego.puntos, ronda: juego.ronda, total: totalRondas, aciertos: juego.aciertos, fallos: juego.fallos, disparos: juego.disparos });

    const textoFlotante = (texto, pos, color = '#ffffff') => {
        const tex = texturaTexto(texto, color);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
        sp.renderOrder = 20;
        const d = Math.max(4, pos.distanceTo(camara.getWorldPosition(new THREE.Vector3())));
        sp.scale.set(0.09 * d, 0.019 * d, 1);
        sp.position.copy(pos);
        escena.add(sp);
        efectos.push({ tipo: 'texto', obj: sp, t: 0, dur: 1.6, y0: pos.y, d });
    };

    const confeti = (pos, colores) => {
        const n = 70;
        const geo = new THREE.BufferGeometry();
        const p = new Float32Array(n * 3), col = new Float32Array(n * 3), vel = [];
        const c = new THREE.Color();
        for (let i = 0; i < n; i++) {
            p[i * 3] = pos.x; p[i * 3 + 1] = pos.y; p[i * 3 + 2] = pos.z;
            vel.push(new THREE.Vector3((Math.random() - 0.5) * 6, 2 + Math.random() * 5, (Math.random() - 0.5) * 6));
            c.set(colores[i % colores.length]);
            col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.16, vertexColors: true, map: texPunto, transparent: true, depthWrite: false }));
        pts.frustumCulled = false;
        escena.add(pts);
        efectos.push({ tipo: 'confeti', obj: pts, vel, t: 0, dur: 1.8 });
    };

    // ── Dianas ──
    function crearDiana({ x, z, radio, texto, letra, color, correcta, idx, movil }) {
        const grupo = new THREE.Group();
        const yBase = altura(x, z);
        const hCentro = 1.25 + radio * 0.4;
        const cuerpo = new THREE.Group(); // lo que se cae (pivota en el suelo)
        grupo.add(cuerpo);
        // trípode
        [[-0.55, 0.12, 0.22], [0.55, 0.12, -0.22], [0, -0.45, 0]].forEach(([px, pz, rz]) => {
            const pata = new THREE.Mesh(geoPata, matPata);
            pata.scale.set(1, hCentro + radio * 0.6, 1);
            pata.position.set(px * radio, 0, pz);
            pata.rotation.set(pz < 0 ? -0.18 : 0.12, 0, rz);
            pata.castShadow = true;
            cuerpo.add(pata);
        });
        // bala de paja + cara
        const caraG = new THREE.Group();
        caraG.position.set(0, hCentro, 0);
        caraG.rotation.x = -0.06;
        cuerpo.add(caraG);
        const paja = new THREE.Mesh(guarda(new THREE.CylinderGeometry(radio * 1.16, radio * 1.16, 0.34, 28).rotateX(Math.PI / 2)), matPaja);
        paja.castShadow = true; paja.receiveShadow = true;
        caraG.add(paja);
        const matCara = new THREE.MeshStandardMaterial({ map: texDiana, roughness: 0.85, emissive: 0x000000 });
        const cara = new THREE.Mesh(guarda(new THREE.CircleGeometry(radio, 48)), matCara);
        cara.position.z = 0.172;
        caraG.add(cara);
        // cartel encima
        const texCartel = texturaCartel(texto, { letra, color });
        const esc = Math.max(1, Math.hypot(x, z) / 15);
        const anchoC = (letra ? 1.9 : 1.9) * esc, altoC = anchoC * 340 / 1024;
        const cartel = new THREE.Mesh(guarda(new THREE.PlaneGeometry(anchoC, altoC)), new THREE.MeshStandardMaterial({ map: texCartel, roughness: 0.9 }));
        cartel.position.set(0, hCentro + radio * 1.16 + 0.12 + altoC / 2, 0.05);
        cuerpo.add(cartel);
        const postes = new THREE.Mesh(guarda(new THREE.BoxGeometry(anchoC * 0.9, 0.05, 0.04)), matPata);
        postes.position.set(0, hCentro + radio * 1.16 + 0.1, 0.02);
        cuerpo.add(postes);
        grupo.position.set(x, yBase - 4, z);
        grupo.rotation.y = Math.atan2(-x, -z); // +Z local mirando al puesto de tiro
        escena.add(grupo);
        return {
            grupo, cuerpo, caraG, cara, matCara, cartel, texCartel, radio, correcta, texto, idx, x0: x, z0: z, yBase,
            fase: 'subiendo', t: -idx * 0.12, caida: 0, eliminada: false,
            movil: movil ? { amp: 1.2 + azar() * 1.6, vel: 0.45 + azar() * 0.5, f: azar() * 6.28 } : null,
            centro: new THREE.Vector3(), normal: new THREE.Vector3(), brillo: null,
        };
    }

    // ── Cacería: animales del Ovni con la respuesta encima ──
    const geoAnillo = guarda(new THREE.RingGeometry(0.85, 1.12, 32).rotateX(-Math.PI / 2));
    function crearAnimalSimple(alto) {
        const g = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.08, 0.25, 0.5 + azar() * 0.3), roughness: 0.9 });
        const caja = (w, h, l, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w * alto, h * alto, l * alto), mat); m.position.set(x * alto, y * alto, z * alto); m.castShadow = true; g.add(m); };
        caja(0.5, 0.42, 0.85, 0, 0.55, 0);
        caja(0.3, 0.3, 0.32, 0, 0.82, 0.5);
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => caja(0.1, 0.36, 0.1, sx * 0.17, 0.18, sz * 0.3));
        return g;
    }
    function crearAnimal({ x, z, texto, letra, color, correcta, idx }) {
        const tipos = Object.keys(op.modelos || {}).filter(t => TIPOS_ANIMAL[t]);
        const tipo = tipos.length ? tipos[Math.floor(azar() * tipos.length)] : 'oveja';
        const T = TIPOS_ANIMAL[tipo];
        const grupo = new THREE.Group();
        let modelo = null;
        if (op.modelos?.[tipo]) { modelo = instanciarModelo(op.modelos[tipo], T.alto); grupo.add(modelo.obj); ponerClip(modelo, 'Idle', 0); }
        else grupo.add(crearAnimalSimple(T.alto));
        const texCartel = texturaCartel(texto, { letra, color });
        const cartel = new THREE.Sprite(new THREE.SpriteMaterial({ map: texCartel, depthWrite: false }));
        cartel.renderOrder = 5;
        grupo.add(cartel);
        const anillo = new THREE.Mesh(geoAnillo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
        anillo.scale.setScalar(Math.max(0.9, T.alto * 0.6));
        anillo.position.y = 0.06;
        grupo.add(anillo);
        const pos = new THREE.Vector3(x, 0, z);
        const rumbo = azar() * Math.PI * 2;
        grupo.position.set(x, altura(x, z), z);
        grupo.rotation.y = rumbo;
        grupo.scale.setScalar(0.001);
        escena.add(grupo);
        return {
            animal: true, tipo, T, modelo, grupo, cartel, texCartel, anillo, correcta, texto, idx, x0: x,
            fase: 'subiendo', t: -idx * 0.1, eliminada: false, brillo: null,
            pos, casa: pos.clone(), destino: pos.clone(), rumbo, pausa: 1 + azar() * 2, subida: 0,
            radio: Math.max(0.75, T.alto * 0.5), centro: new THREE.Vector3(x, altura(x, z) + T.alto * 0.55, z), normal: new THREE.Vector3(0, 0, 1),
        };
    }
    /** Dentro del campo y fuera de los troncos (jugador y animales). */
    function limitar(p, r) {
        p.x = limitarA(p.x, -LIM_X, LIM_X);
        p.z = limitarA(p.z, LIM_Z0, LIM_Z1);
        for (const tr of troncos) {
            const dx = p.x - tr.x, dz = p.z - tr.z, d2 = dx * dx + dz * dz, m = tr.r + r;
            if (d2 < m * m && d2 > 1e-8) { const d = Math.sqrt(d2); p.x = tr.x + (dx / d) * m; p.z = tr.z + (dz / d) * m; }
        }
    }
    const _cam = new THREE.Vector3(), _dirM = new THREE.Vector3();
    /** Hacia dónde mira el jugador (ángulo como yaw: 0 = hacia −Z). */
    function yawMundo() {
        if (!vr) return yaw;
        camara.getWorldDirection(_dirM);
        return Math.atan2(-_dirM.x, -_dirM.z);
    }
    /** Mueve y anima un animal. Devuelve true cuando ya se puede quitar. */
    function actualizarAnimal(d, dt) {
        const g = d.grupo, T = d.T;
        const activo = (d.fase === 'lista' || d.fase === 'subiendo') && !d.eliminada;
        const quieto = congelado > 0;
        let vel = 0;
        if (d.fase === 'subiendo') {
            const k = Math.min(1, Math.max(0, d.t / 0.6));
            const c1 = 1.70158;
            g.scale.setScalar(Math.max(0.001, 1 + (c1 + 1) * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2)));
            if (k >= 1) { d.fase = 'lista'; g.scale.setScalar(1); }
        } else if (d.fase === 'cayendo' || d.fase === 'bajando') {
            // atrapado (sube girando entre destellos) o fin de ronda (se encoge)
            const dur = d.fase === 'cayendo' ? 1.0 : 0.5;
            const k = Math.min(1, Math.max(0, d.t / dur));
            g.scale.setScalar(Math.max(0.001, 1 - k * k));
            if (d.fase === 'cayendo') { d.subida = k * 1.8; d.rumbo += dt * 9; }
            if (k >= 1) return true;
        }
        if (activo && !quieto) {
            const jx = rig.position.x - d.pos.x, jz = rig.position.z - d.pos.z, dj = Math.hypot(jx, jz);
            if (dj < 4.5 && !d.apartando && dj > 0.01) { d.destino.set(d.pos.x - (jx / dj) * 6, 0, d.pos.z - (jz / dj) * 6); limitar(d.destino, 0.8); d.pausa = 0; d.apartando = true; }
            if (d.pausa > 0) d.pausa -= dt;
            else {
                const dx = d.destino.x - d.pos.x, dz = d.destino.z - d.pos.z, dist = Math.hypot(dx, dz);
                if (dist < 0.4) {
                    d.pausa = 1.5 + azar() * 3; d.apartando = false;
                    const a = azar() * Math.PI * 2, r = 2 + azar() * 5;
                    d.destino.set(d.casa.x + Math.cos(a) * r, 0, d.casa.z + Math.sin(a) * r);
                    limitar(d.destino, 0.8);
                } else {
                    d.rumbo = lerpAng(d.rumbo, Math.atan2(dx, dz), suave(2.2, dt));
                    vel = T.paseo * VEL_ANIMAL;
                    d.pos.x += Math.sin(d.rumbo) * vel * dt;
                    d.pos.z += Math.cos(d.rumbo) * vel * dt;
                    const antes = d.pos.x + d.pos.z;
                    limitar(d.pos, 0.6);
                    if (Math.abs(antes - d.pos.x - d.pos.z) > 1e-3) d.pausa = 0.01, d.destino.copy(d.casa); // chocó con un árbol: vuelve
                }
            }
        }
        d.x0 = d.pos.x - rig.position.x;
        g.position.set(d.pos.x, altura(d.pos.x, d.pos.z) + d.subida, d.pos.z);
        g.rotation.y = d.rumbo;
        if (d.modelo) {
            ponerClip(d.modelo, d.fase === 'cayendo' ? 'Jump' : vel > 0.05 ? 'WalkSlow' : 'Idle', 0.3);
            d.modelo.mixer.update(quieto && activo ? 0 : dt); // congelados: la animación también se para
        }
        // cartel: más grande cuanto más lejos, para que se lea siempre
        camara.getWorldPosition(_cam);
        const esc = limitarA(_cam.distanceTo(g.position) / 11, 1, 2.6);
        const w = 1.9 * esc, h = (w * 340) / 1024;
        d.cartel.scale.set(w, h, 1);
        d.cartel.position.y = T.alto + 0.3 + h / 2;
        // aro en el suelo: verde/rojo al acertar/fallar, azul mientras están congelados
        const m = d.anillo.material;
        if (d.brillo) {
            d.brillo.t += dt;
            m.color.setHex(d.brillo.color);
            m.opacity = d.brillo.pulso ? 0.55 + 0.4 * Math.sin(d.brillo.t * 8) : Math.max(0, 0.9 - d.brillo.t * 0.6);
        } else { m.color.setHex(0x81d4fa); m.opacity = quieto && activo ? 0.55 : 0; }
        d.centro.set(d.pos.x, g.position.y + T.alto * 0.55 * g.scale.x, d.pos.z);
        return false;
    }
    /** Corte del segmento p0→p1 con una esfera: t ∈ [0,1] o null. */
    function segEsfera(p0, p1, c, r) {
        const dx = p1.x - p0.x, dy = p1.y - p0.y, dz = p1.z - p0.z;
        const fx = p0.x - c.x, fy = p0.y - c.y, fz = p0.z - c.z;
        const a = dx * dx + dy * dy + dz * dz, b = 2 * (fx * dx + fy * dy + fz * dz), cc = fx * fx + fy * fy + fz * fz - r * r;
        if (cc < 0) return 0;
        const disc = b * b - 4 * a * cc;
        if (disc < 0 || a < 1e-12) return null;
        const t = (-b - Math.sqrt(disc)) / (2 * a);
        return t >= 0 && t <= 1 ? t : null;
    }
    const crearBlanco = (a) => (enCaza ? crearAnimal(a) : crearDiana(a));

    function quitarDiana(d) {
        d.grupo.removeFromParent();
        if (d.animal) {
            d.texCartel.dispose(); d.cartel.material.dispose(); d.anillo.material.dispose();
            if (d.modelo) { d.modelo.mixer.stopAllAction(); d.modelo.mixer.uncacheRoot(d.modelo.obj); }
            else d.grupo.children[0].traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
            return;
        }
        d.matCara.dispose(); d.texCartel.dispose(); d.cartel.material.dispose();
        for (let i = clavadas.length - 1; i >= 0; i--) if (clavadas[i].diana === d) clavadas.splice(i, 1);
    }

    // En abanico (por ángulos) para que ninguna diana tape a otra ni a su cartel
    function posicionesDianas(n, rango) {
        const [dMin, dMax] = rango;
        const out = [];
        const sitio = (ang, d) => ({ x: Math.sin(ang) * d, z: -Math.cos(ang) * d });
        if (n <= 4) {
            const ds = barajar([0, 1, 2, 3].slice(0, n).map(i => dMin + (dMax - dMin) * (i + azar() * 0.8) / n), azar);
            const paso = 0.3;
            for (let i = 0; i < n; i++) out.push(sitio((i - (n - 1) / 2) * paso + (azar() - 0.5) * 0.05, ds[i]));
        } else {
            // dos filas: la de atrás ocupa los huecos de la de delante
            const mitad = Math.ceil(n / 2);
            const paso = 0.27;
            for (let i = 0; i < n; i++) {
                const fila = i < mitad ? 0 : 1, k = fila ? i - mitad : i, nf = fila ? n - mitad : mitad;
                const d = fila ? dMin + (dMax - dMin) * (0.7 + azar() * 0.3) : dMin + (dMax - dMin) * azar() * 0.3;
                // fila de atrás con tantas como la de delante: se abre hacia los lados (±1, ±2 pasos)
                const abrir = fila && nf === mitad ? (k >= nf / 2 ? paso / 2 : -paso / 2) : 0;
                const ang = (k - (nf - 1) / 2) * paso + abrir + (azar() - 0.5) * 0.03;
                out.push(sitio(ang, d));
            }
        }
        return out;
    }

    // En la cacería, los animales se reparten por todo el campo (alrededor del jugador, separados entre sí):
    // hay que buscarlos girando y andando, con ayuda del radar
    function posicionesCaza(n) {
        const px = rig.position.x, pz = rig.position.z, out = [];
        const dentro = (p) => Math.abs(p.x) <= LIM_X - 3 && p.z >= LIM_Z0 + 3 && p.z <= LIM_Z1 - 3;
        const a0 = azar() * Math.PI * 2;
        for (let i = 0; i < n; i++) {
            let mejor = null, mejorSep = -1;
            for (let t = 0; t < 40; t++) {
                // cada animal en su sector (para que queden a todos lados) con algo de azar
                const ang = a0 + (i + 0.15 + azar() * 0.7) * (Math.PI * 2 / n);
                const d = 13 + azar() * 27;
                const p = { x: px + Math.sin(ang) * d, z: pz - Math.cos(ang) * d };
                if (!dentro(p)) { p.x = limitarA(p.x, -LIM_X + 3, LIM_X - 3); p.z = limitarA(p.z, LIM_Z0 + 3, LIM_Z1 - 3); }
                if (Math.hypot(p.x - px, p.z - pz) < 10) continue;
                const sep = out.reduce((m, q) => Math.min(m, Math.hypot(p.x - q.x, p.z - q.z)), 99);
                if (sep > mejorSep) { mejor = p; mejorSep = sep; }
                if (sep >= 12) break;
            }
            if (!mejor) mejor = { x: limitarA(px + 15, -LIM_X + 3, LIM_X - 3), z: limitarA(pz - 15, LIM_Z0 + 3, LIM_Z1 - 3) };
            limitar(mejor, 1.2);
            out.push(mejor);
        }
        return out;
    }

    function posicionesRonda(n, rango) {
        return enCaza ? posicionesCaza(n) : posicionesDianas(n, rango);
    }

    // ── Rondas ──
    function prepararRonda() {
        juego.ronda++;
        juego.disparosRonda = 0;
        dianas.forEach(d => { if (d.fase !== 'fuera') { d.fase = 'bajando'; d.t = 0; } });
        const rango = DISTANCIAS[op.distancia] || DISTANCIAS.media;
        let nuevas = [];
        if (modo === 'preguntas') {
            const q = op.preguntas[juego.ronda];
            const ops = q.opciones.slice(0, 4);
            const pos = posicionesRonda(ops.length, rango);
            nuevas = ops.map((texto, i) => crearBlanco({ ...pos[i], radio: 0.62 + (Math.hypot(pos[i].x, pos[i].z) - 8) * 0.012, texto, letra: LETRAS[i], color: COLORES_OPCION[i], correcta: texto === q.correcta, idx: i, movil: !!op.movil }));
            juego.datos = { enunciado: q.enunciado, correcta: q.correcta, opciones: ops };
            cb.onRonda?.({ modo, indice: juego.ronda, total: totalRondas, enunciado: q.enunciado, opciones: ops });
        } else {
            const r = op.generarRonda(juego.ronda) || { objetivo: '?', items: [] };
            let items = r.items.slice(0, 8);
            if (!items.some(it => it.correcta)) items = [...r.items.filter(it => it.correcta).slice(0, 1), ...items].slice(0, 8);
            items = barajar(items, azar);
            const pos = posicionesRonda(items.length, rango);
            nuevas = items.map((it, i) => {
                const d = crearBlanco({ ...pos[i], radio: 0.46 + (Math.hypot(pos[i].x, pos[i].z) - 8) * 0.01, texto: it.texto, letra: null, color: '#6d4c2f', correcta: !!it.correcta, idx: i, movil: !!op.movil && i % 2 === 1 });
                d.explicacion = it.explicacion;
                return d;
            });
            juego.datos = { objetivo: r.objetivo, quedan: nuevas.filter(d => d.correcta).length };
            cb.onRonda?.({ modo, indice: juego.ronda, total: totalRondas, objetivo: r.objetivo, quedan: juego.datos.quedan });
        }
        dianas = [...dianas, ...nuevas];
        // viento de la ronda
        const fuerza = VIENTOS[op.viento] || 0;
        if (fuerza) {
            const ang = azar() * Math.PI * 2;
            const v = fuerza * (0.55 + azar() * 0.45);
            viento.set(Math.cos(ang) * v, 0, Math.sin(ang) * v);
        } else viento.set(0, 0, 0);
        uViento.value = viento.length();
        audio.viento(viento.length());
        cb.onViento?.({ x: viento.x, z: viento.z, vel: viento.length() });
        juego.fase = 'apuntando';
        emitirEstado();
        pintarPanelVR();
    }

    function terminar(ganado) {
        if (juego.terminado) return;
        juego.terminado = true;
        juego.fase = 'fin';
        tensando = false;
        const res = {
            modo, ganado, puntos: juego.puntos, aciertos: juego.aciertos, fallos: juego.fallos, disparos: juego.disparos,
            centros: juego.centros, enDiana: juego.enDiana, total: totalRondas, completadas: Math.min(totalRondas, juego.ronda + (ganado ? 1 : 0)),
            falladas: juego.falladas, acertadas: juego.acertadas, fallosLista: juego.fallosLista, aciertosLista: juego.aciertosLista,
            vr: !!vr,
        };
        pintarPanelVR(ganado ? '¡Prueba superada!' : 'Fin de la partida', 'Quítate las gafas para ver el resultado');
        setTimeout(() => {
            if (vr) { try { renderer.xr.getSession()?.end(); } catch { /* */ } }
            cb.onFin?.(res);
        }, vr ? 3500 : 1400);
    }

    function alImpactar(d, anillo, punto) {
        if (juego.fase !== 'apuntando' || d.eliminada || d.fase !== 'lista') return;
        juego.enDiana++;
        if (anillo === 10) juego.centros++;
        const pan = Math.max(-1, Math.min(1, d.x0 / 15));
        if (modo === 'preguntas') {
            if (d.correcta) {
                const extra = juego.disparosRonda === 1 ? 30 : 0;
                const pts = 100 + anillo * 10 + extra;
                juego.puntos += pts; juego.aciertos++;
                juego.acertadas.push({ enunciado: juego.datos.enunciado, correcta: juego.datos.correcta, flechas: juego.disparosRonda });
                d.eliminada = true; d.brillo = { color: 0x43a047, t: 0 };
                setTimeout(() => { d.fase = 'cayendo'; d.t = 0; audio.caida(); }, 450);
                confeti(punto, ['#ffd54f', '#66bb6a', '#29b6f6', '#ef5350', '#ffffff']);
                textoFlotante(anillo === 10 ? `¡DIANA! +${pts}` : `+${pts}`, punto.clone().add(new THREE.Vector3(0, 0.7, 0)), '#b9f6ca');
                cb.onImpacto?.({ ok: true, puntos: pts, anillo, texto: d.texto });
                juego.fase = 'resuelto';
                pintarPanelVR('¡Correcto!');
                setTimeout(siguiente, 2000);
            } else {
                juego.fallos++;
                juego.vidas--;
                juego.falladas.push({ enunciado: juego.datos.enunciado, correcta: juego.datos.correcta, elegida: d.texto });
                d.eliminada = true; d.brillo = { color: 0xe53935, t: 0 };
                const buena = dianas.find(x => x.correcta && !x.eliminada && x.fase === 'lista');
                if (buena) buena.brillo = { color: 0x43a047, t: 0, pulso: true };
                textoFlotante('✗', punto.clone().add(new THREE.Vector3(0, 0.6, 0)), '#ff8a80');
                cb.onImpacto?.({ ok: false, anillo, texto: d.texto, correcta: juego.datos.correcta });
                juego.fase = 'resuelto';
                pintarPanelVR(`Era: ${juego.datos.correcta}`);
                emitirEstado();
                setTimeout(() => (juego.vidas <= 0 ? terminar(false) : siguiente()), 2600);
            }
        } else {
            d.eliminada = true;
            if (d.correcta) {
                const pts = 50 + anillo * 5;
                juego.puntos += pts; juego.aciertos++;
                juego.aciertosLista.push(d.texto);
                d.brillo = { color: 0x43a047, t: 0 };
                setTimeout(() => { d.fase = 'cayendo'; d.t = 0; audio.caida(); }, 350);
                confeti(punto, ['#ffd54f', '#66bb6a', '#29b6f6', '#ffffff']);
                textoFlotante(anillo === 10 ? `¡DIANA! +${pts}` : `+${pts}`, punto.clone().add(new THREE.Vector3(0, 0.6, 0)), '#b9f6ca');
                juego.datos.quedan--;
                cb.onImpacto?.({ ok: true, puntos: pts, anillo, texto: d.texto, quedan: juego.datos.quedan });
                if (juego.datos.quedan <= 0) {
                    juego.fase = 'resuelto';
                    pintarPanelVR('¡Ronda completada!');
                    setTimeout(siguiente, 1900);
                } else pintarPanelVR();
            } else {
                juego.fallos++;
                juego.vidas--;
                juego.fallosLista.push({ palabra: d.texto, explicacion: d.explicacion || '', buscabas: juego.datos.objetivo });
                d.brillo = { color: 0xe53935, t: 0 };
                setTimeout(() => { d.fase = 'cayendo'; d.t = 0; }, 700);
                textoFlotante('✗', punto.clone().add(new THREE.Vector3(0, 0.6, 0)), '#ff8a80');
                cb.onImpacto?.({ ok: false, anillo, texto: d.texto, explicacion: d.explicacion });
                pintarPanelVR(`✗ ${d.texto}`);
                if (juego.vidas <= 0) { juego.fase = 'resuelto'; setTimeout(() => terminar(false), 1600); }
            }
        }
        emitirEstado();
    }

    function siguiente() {
        if (juego.terminado) return;
        if (juego.ronda + 1 >= totalRondas) terminar(true);
        else prepararRonda();
    }

    // ── Colisiones ──
    const _h = new THREE.Vector3(), _l = new THREE.Vector3(), _d = new THREE.Vector3();
    /** Primer choque en el segmento p0→p1 (o null). */
    function colision(p0, p1, conDianas = true) {
        let mejor = null;
        if (conDianas) {
            for (const d of dianas) {
                if (d.fase === 'fuera' || d.fase === 'bajando') continue;
                if (d.animal) {
                    if (d.fase === 'cayendo') continue;
                    const t = segEsfera(p0, p1, d.centro, d.radio);
                    if (t !== null && (!mejor || t < mejor.t)) {
                        // distancia de la línea de vuelo al centro del animal → «anillo»
                        const dir = new THREE.Vector3().subVectors(p1, p0).normalize();
                        const ac = new THREE.Vector3().subVectors(d.centro, p0);
                        const r = ac.addScaledVector(dir, -ac.dot(dir)).length();
                        mejor = { tipo: 'animal', diana: d, t, punto: new THREE.Vector3().lerpVectors(p0, p1, t), r };
                    }
                    continue;
                }
                const s0 = _d.subVectors(p0, d.centro).dot(d.normal);
                const s1 = _l.subVectors(p1, d.centro).dot(d.normal);
                if (s0 >= 0 && s1 < 0) {
                    const t = s0 / (s0 - s1);
                    _h.lerpVectors(p0, p1, t);
                    const r = _h.distanceTo(d.centro);
                    if (r <= d.radio * 1.16 && (!mejor || t < mejor.t)) mejor = { tipo: 'diana', diana: d, t, punto: _h.clone(), r };
                }
            }
        }
        if (mejor) return mejor;
        for (const tr of troncos) {
            const dx = p1.x - tr.x, dz = p1.z - tr.z;
            if (dx * dx + dz * dz < tr.r * tr.r && p1.y > tr.y0 && p1.y < tr.y1) return { tipo: 'arbol', t: 1, punto: p1.clone() };
        }
        const h1 = altura(p1.x, p1.z);
        if (p1.y <= h1) {
            const h0 = altura(p0.x, p0.z);
            const a = p0.y - h0, b = p1.y - h1;
            const t = a > 0 ? a / (a - b) : 0;
            return { tipo: 'suelo', t, punto: new THREE.Vector3().lerpVectors(p0, p1, t) };
        }
        return null;
    }

    function pasoFisico(pos, vel, h) {
        const v = vel.length();
        vel.x += (-KD * v * vel.x + KW * viento.x) * h;
        vel.y += (-G - KD * v * vel.y) * h;
        vel.z += (-KD * v * vel.z + KW * viento.z) * h;
        pos.addScaledVector(vel, h);
    }

    // ── Disparo ──
    const _o = new THREE.Vector3(), _f = new THREE.Vector3(), _q = new THREE.Quaternion();
    const ATRAS = new THREE.Vector3(0, 0, 1);
    function disparar(t) {
        if (juego.fase !== 'apuntando') return;
        juego.disparos++; juego.disparosRonda++;
        // posición y dirección de la flecha cargada
        flechaCargada.getWorldPosition(_o);
        flechaCargada.getWorldQuaternion(_q);
        _f.set(0, 0, -1).applyQuaternion(_q).normalize();
        if (!vr) _f.set(0, 0, -1).applyQuaternion(camara.getWorldQuaternion(_q)).normalize(); // apunta a la cruz
        const obj = plantillaFlecha.clone();
        obj.position.copy(_o);
        escena.add(obj);
        const trailGeo = new THREE.BufferGeometry();
        trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(20 * 3).fill(0), 3));
        const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 }));
        trail.frustumCulled = false;
        for (let i = 0; i < 20; i++) trailGeo.attributes.position.setXYZ(i, _o.x, _o.y, _o.z);
        escena.add(trail);
        voladoras.push({ obj, pos: _o.clone(), vel: _f.clone().multiplyScalar(velocidadDe(t)), t: 0, giro: azar() * 6, trail, trailGeo });
        audio.disparo(t);
        arco.userData.soltar();
        flechaCargada.visible = false;
        recarga = 0.55;
        emitirEstado();
    }

    function clavar(f, choque) {
        // a un animal la flecha no se le clava: desaparece entre destellos
        if (choque.tipo === 'animal') {
            const d = choque.diana;
            f.obj.removeFromParent();
            confeti(choque.punto, ['#ffffff', '#fff59d', '#b3e5fc']);
            audio.diana(Math.max(-1, Math.min(1, d.x0 / 15)));
            alImpactar(d, Math.max(1, 10 - Math.floor((choque.r / d.radio) * 10)), choque.punto);
            efectos.push({ tipo: 'estela', obj: f.trail, geo: f.trailGeo, t: 0, dur: 0.5 });
            return;
        }
        const dir = _d.copy(f.vel).normalize();
        const hundir = choque.tipo === 'diana' ? 0.14 + Math.min(0.12, f.vel.length() / 500) : choque.tipo === 'arbol' ? 0.08 : 0.22;
        f.obj.position.copy(choque.punto).addScaledVector(dir, hundir);
        f.obj.quaternion.setFromUnitVectors(ATRAS, _l.copy(dir).negate());
        const entrada = { obj: f.obj, diana: null, vibra: 1, t: 0, qBase: null };
        if (choque.tipo === 'diana') {
            const d = choque.diana;
            d.caraG.attach(f.obj);
            entrada.diana = d;
            const anillo = choque.r < d.radio ? Math.max(1, 10 - Math.floor((choque.r / d.radio) * 10)) : 0;
            audio.diana(Math.max(-1, Math.min(1, d.x0 / 15)));
            alImpactar(d, anillo, choque.punto);
        } else if (choque.tipo === 'arbol') {
            audio.madera(Math.max(-1, Math.min(1, choque.punto.x / 15)));
        } else {
            audio.suelo(Math.max(-1, Math.min(1, choque.punto.x / 15)));
            entrada.vibra = 0.4;
        }
        entrada.qBase = f.obj.quaternion.clone();
        clavadas.push(entrada);
        while (clavadas.length > MAX_CLAVADAS) clavadas.shift().obj.removeFromParent();
        f.trail.userData.fade = 1;
        efectos.push({ tipo: 'estela', obj: f.trail, geo: f.trailGeo, t: 0, dur: 0.5 });
    }

    // ── Trayectoria prevista (ayuda) ──
    const _tp = new THREE.Vector3(), _tv = new THREE.Vector3(), _tp0 = new THREE.Vector3();
    function dibujarTrayectoria(t) {
        flechaCargada.getWorldPosition(_tp);
        if (vr) { flechaCargada.getWorldQuaternion(_q); _tv.set(0, 0, -1).applyQuaternion(_q); }
        else _tv.set(0, 0, -1).applyQuaternion(camara.getWorldQuaternion(_q));
        _tv.normalize().multiplyScalar(velocidadDe(t));
        const arr = trayGeo.attributes.position.array;
        let n = 0, choque = null;
        for (let i = 0; i < N_TRAY && !choque; i++) {
            for (let k = 0; k < 6 && !choque; k++) {
                _tp0.copy(_tp);
                pasoFisico(_tp, _tv, 1 / 150);
                choque = colision(_tp0, _tp);
            }
            const p = choque ? choque.punto : _tp;
            arr[n * 3] = p.x; arr[n * 3 + 1] = p.y; arr[n * 3 + 2] = p.z; n++;
        }
        trayGeo.setDrawRange(1, Math.max(0, n - 1));
        trayGeo.attributes.position.needsUpdate = true;
        trayectoria.visible = true;
        if (choque) {
            marcaImpacto.visible = true;
            marcaImpacto.position.copy(choque.punto);
            marcaImpacto.scale.setScalar(limitarA(choque.punto.distanceTo(camara.getWorldPosition(_h)) / 7, 1, 4)); // visible también de lejos
            if (choque.tipo === 'diana') { marcaImpacto.position.addScaledVector(choque.diana.normal, 0.01); marcaImpacto.lookAt(_h.copy(choque.punto).add(choque.diana.normal)); }
            else if (choque.tipo === 'animal') { camara.getWorldPosition(_h); marcaImpacto.lookAt(_h); }
            else { marcaImpacto.position.y += 0.03; marcaImpacto.rotation.set(-Math.PI / 2, 0, 0); }
            marcaImpacto.material.color.set(choque.tipo === 'diana' || choque.tipo === 'animal' ? 0xffeb3b : 0xffffff);
        } else marcaImpacto.visible = false;
    }

    // ── Pines de la mira (a tope de tensión) ──
    function calcularPines() {
        const fov = THREE.MathUtils.degToRad(camara.fov);
        const alto = cont.clientHeight || 600;
        const res = DISTANCIAS_PINES.map(dist => {
            const alturaEn = (th) => {
                const p = new THREE.Vector3(0, -BAJO_OJO, 0), v = new THREE.Vector3(0, Math.sin(th), -Math.cos(th)).multiplyScalar(V_MAX);
                const vSin = viento.clone(); viento.set(0, 0, 0);
                let guard = 0;
                while (p.z > -dist && guard++ < 4000) pasoFisico(p, v, SUB);
                viento.copy(vSin);
                return p.y;
            };
            let lo = 0, hi = 0.35;
            for (let i = 0; i < 22; i++) { const mid = (lo + hi) / 2; if (alturaEn(mid) < 0) lo = mid; else hi = mid; }
            const th = (lo + hi) / 2;
            return { d: dist, px: (Math.tan(th) / Math.tan(fov / 2)) * (alto / 2) };
        });
        cb.onPines?.(res);
    }

    // ── Panel VR ──
    let msgPanel = '';
    function pintarPanelVR(msg, sub) {
        if (msg !== undefined) msgPanel = msg;
        if (!vr && !panelVR.malla.visible) return;
        const { c, tex } = panelVR;
        const x = c.getContext('2d');
        x.clearRect(0, 0, c.width, c.height);
        x.fillStyle = 'rgba(16,28,20,0.82)';
        x.beginPath(); x.roundRect(0, 0, c.width, c.height, 40); x.fill();
        x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillStyle = '#c8e6c9'; x.font = '700 34px system-ui, sans-serif';
        const vidas = Number.isFinite(juego.vidas) ? '❤'.repeat(Math.max(0, juego.vidas)) + '♡'.repeat(Math.max(0, vidasMax - juego.vidas)) : '∞';
        x.fillText(`${modo === 'preguntas' ? 'Pregunta' : 'Ronda'} ${Math.max(1, juego.ronda + 1)}/${totalRondas}   ·   ${juego.puntos} puntos   ·   ${vidas}`, 512, 46);
        x.fillStyle = '#fff';
        if (sub) {
            x.font = '900 70px system-ui, sans-serif'; x.fillText(msg || '', 512, 260);
            x.font = '600 38px system-ui, sans-serif'; x.fillStyle = '#c8e6c9'; x.fillText(sub, 512, 360);
        } else if (modo === 'preguntas' && juego.datos) {
            let tam = 56; x.font = `800 ${tam}px system-ui, sans-serif`;
            let lineas = partirLineas(x, juego.datos.enunciado, 940);
            while (lineas.length > 3 && tam > 30) { tam -= 4; x.font = `800 ${tam}px system-ui, sans-serif`; lineas = partirLineas(x, juego.datos.enunciado, 940); }
            lineas.slice(0, 4).forEach((l, i) => x.fillText(l, 512, 140 + i * tam * 1.1));
            juego.datos.opciones.forEach((o, i) => {
                const cx = i % 2 ? 768 : 256, cy = 410 + Math.floor(i / 2) * 82;
                x.fillStyle = COLORES_OPCION[i];
                x.beginPath(); x.roundRect(cx - 240, cy - 34, 480, 68, 18); x.fill();
                x.fillStyle = '#fff'; x.font = '800 34px system-ui, sans-serif';
                const t = `${LETRAS[i]}  ${o}`;
                x.fillText(t.length > 26 ? t.slice(0, 25) + '…' : t, cx, cy + 2);
            });
        } else if (juego.datos) {
            x.font = '700 44px system-ui, sans-serif'; x.fillStyle = '#c8e6c9'; x.fillText('Dispara a:', 512, 160);
            x.font = '900 78px system-ui, sans-serif'; x.fillStyle = '#ffeb3b'; x.fillText(String(juego.datos.objetivo).toUpperCase(), 512, 260);
            x.font = '700 40px system-ui, sans-serif'; x.fillStyle = '#fff'; x.fillText(`Quedan ${Math.max(0, juego.datos.quedan)}`, 512, 360);
        }
        if (msgPanel && !sub) { x.font = '900 52px system-ui, sans-serif'; x.fillStyle = msgPanel.startsWith('¡') ? '#b9f6ca' : '#ff8a80'; x.fillText(msgPanel, 512, 545); }
        tex.needsUpdate = true;
    }

    // ── Realidad virtual ──
    function iniciarVR(sesion) {
        renderer.xr.setReferenceSpaceType('local-floor');
        renderer.xr.setSession(sesion).catch(e => console.warn('XR', e));
        camara.remove(arco);
        escena.add(arco);
        arco.scale.setScalar(ESCALA_VR);
        const ctrls = [0, 1].map(i => {
            const ray = renderer.xr.getController(i);
            const grip = renderer.xr.getControllerGrip(i);
            rig.add(ray, grip);
            const c = { i, ray, grip, fuente: null, mano: null, apretado: { select: false, squeeze: false } };
            ray.addEventListener('connected', (e) => { c.fuente = e.data; c.mano = e.data.handedness; });
            ray.addEventListener('disconnected', () => { c.fuente = null; c.mano = null; });
            ['select', 'squeeze'].forEach(b => {
                ray.addEventListener(`${b}start`, () => { c.apretado[b] = true; audio.reanudar(); if (vr) vrPulsar(c, b); });
                ray.addEventListener(`${b}end`, () => { c.apretado[b] = false; if (vr) vrSoltar(c, b); });
            });
            return c;
        });
        const guante = crearMano();
        escena.add(guante);
        vr = { ctrls, guante, agarre: null, maxVisto: 0.55, ultHaptic: 0, tHaptic: 0 };
        panelVR.malla.visible = true;
        manoArco.visible = false; manoCuerda.visible = false;
        pintarPanelVR();
        sesion.addEventListener('end', () => {
            if (!vr) return;
            vr.ctrls.forEach(c => { c.ray.removeFromParent(); c.grip.removeFromParent(); });
            vr.guante.removeFromParent();
            vr = null;
            escena.remove(arco); camara.add(arco); arco.scale.setScalar(1);
            manoArco.visible = true; manoCuerda.visible = true;
            panelVR.malla.visible = false;
            camara.position.set(0, OJO, 0);
            yaw += rig.rotation.y; rig.rotation.y = 0;
            cb.onVR?.(false);
        });
        cb.onVR?.(true);
    }
    const vrManoArco = () => {
        const quiere = op.manoArco === 'right' ? 'right' : 'left';
        return vr.ctrls.find(c => c.mano === quiere) || vr.ctrls.find(c => c.mano && c.mano !== (quiere === 'left' ? 'right' : 'left')) || vr.ctrls[0];
    };
    const vrManoCuerda = () => { const a = vrManoArco(); return vr.ctrls.find(c => c !== a); };
    const _pa = new THREE.Vector3(), _pc = new THREE.Vector3(), _up = new THREE.Vector3(), _fw = new THREE.Vector3(), _x = new THREE.Vector3(), _m = new THREE.Matrix4();
    function haptic(c, fuerza, ms) {
        try { c?.fuente?.gamepad?.hapticActuators?.[0]?.pulse?.(Math.min(1, fuerza), ms); } catch { /* */ }
    }
    function vrPulsar(c, boton) {
        if (c !== vrManoCuerda() || vr.agarre || juego.fase !== 'apuntando' || recarga > 0) return;
        c.grip.getWorldPosition(_pc);
        const nock = arco.localToWorld(_pa.set(0, 0, BRACE));
        const centro = arco.getWorldPosition(_x);
        if (_pc.distanceTo(nock) < 0.24 || _pc.distanceTo(centro) < 0.32) {
            vr.agarre = { c, boton };
            tensando = true;
            haptic(c, 0.4, 30);
        }
    }
    function vrSoltar(c, boton) {
        if (!vr.agarre || vr.agarre.c !== c || vr.agarre.boton !== boton) return;
        vr.agarre = null;
        tensando = false;
        if (tension > 0.12) {
            disparar(tension);
            haptic(c, 0.9, 40);
            haptic(vrManoArco(), 1, 90);
        }
        tension = 0;
    }
    const _fw2 = new THREE.Vector3(), _obj = new THREE.Vector3();
    const ejes = (c) => { const a = c?.fuente?.gamepad?.axes || []; return [a[2] || 0, a[3] || 0]; };
    function actualizarVR(dt) {
        const ca = vrManoArco(), cc = vrManoCuerda();
        if (!ca) return;
        // cacería: andar con la palanca del mando del arco, girar a saltos con la otra; el panel sigue al jugador
        if (enCaza) {
            const [mx, my] = ejes(ca), [tx] = ejes(cc);
            camara.getWorldDirection(_fw2); _fw2.y = 0; _fw2.normalize();
            if (Math.hypot(mx, my) > 0.15) {
                const v = VEL_JUGADOR * (vr.agarre ? 0.35 : 1) * dt;
                rig.position.x += (-_fw2.z * mx - _fw2.x * my) * v;
                rig.position.z += (_fw2.x * mx - _fw2.z * my) * v;
                limitar(rig.position, 0.5);
                rig.position.y = altura(rig.position.x, rig.position.z);
            }
            if (Math.abs(tx) > 0.7 && !vr.girado) { rig.rotation.y -= Math.sign(tx) * Math.PI / 4; vr.girado = true; }
            else if (Math.abs(tx) < 0.3) vr.girado = false;
            camara.getWorldPosition(_cam);
            _obj.copy(_cam).addScaledVector(_fw2, 6); _obj.y = _cam.y + 1.2;
            panelVR.malla.position.lerp(_obj, suave(1.5, dt));
            panelVR.malla.lookAt(_cam);
        }
        ca.grip.getWorldPosition(_pa);
        cc?.grip.getWorldPosition(_pc);
        // «arriba» del arco = arriba del mando (rayo), sin componente hacia delante
        _up.set(0, 1, 0).applyQuaternion(ca.ray.getWorldQuaternion(_q));
        if (vr.agarre && cc) {
            _fw.subVectors(_pa, _pc);
            const dist = _fw.length();
            _fw.normalize();
            vr.maxVisto = Math.max(vr.maxVisto, dist);
            const tope = Math.min(0.68, Math.max(0.45, vr.maxVisto * 0.92));
            const nueva = Math.min(1, Math.max(0, (dist - BRACE * ESCALA_VR) / (tope - BRACE * ESCALA_VR)));
            vr.nock = Math.min(BRACE + RECORRIDO, Math.max(BRACE, dist / ESCALA_VR));
            // vibración: un «clic» por cada tramo de tensado y un temblor a tope
            if (nueva - vr.ultHaptic > 0.06) { haptic(cc, 0.12 + 0.5 * nueva, 14); haptic(ca, 0.05 + 0.2 * nueva, 10); audio.crujido(nueva); vr.ultHaptic = nueva; }
            if (nueva < vr.ultHaptic - 0.1) vr.ultHaptic = nueva;
            vr.tHaptic += dt;
            if (nueva > 0.97 && vr.tHaptic > 0.22) { haptic(cc, 0.25, 30); vr.tHaptic = 0; }
            tension = nueva;
        } else {
            _fw.set(0, 0, -1).applyQuaternion(ca.ray.getWorldQuaternion(_q));
        }
        _up.addScaledVector(_fw, -_up.dot(_fw));
        if (_up.lengthSq() < 1e-4) _up.set(0, 1, 0).addScaledVector(_fw, -_fw.y);
        _up.normalize();
        _x.crossVectors(_up, _fw.clone().negate()).normalize();
        _m.makeBasis(_x, _up, _fw.clone().negate());
        arco.quaternion.setFromRotationMatrix(_m);
        arco.position.copy(_pa);
        // guante en la mano de la cuerda
        if (cc) {
            vr.guante.position.copy(_pc);
            cc.grip.getWorldQuaternion(vr.guante.quaternion);
        }
    }

    // ── Entrada: ratón, táctil y teclado ──
    const sens = () => (tensando ? 0.55 : 1) * (camara.fov / 72);
    const mirar = (dx, dy, k) => {
        yaw -= dx * k * sens();
        pitch -= dy * k * sens();
        if (!enCaza) yaw = Math.max(-1.25, Math.min(1.25, yaw));
        pitch = Math.max(-0.5, Math.min(0.7, pitch));
    };
    const tocando = new Map();
    let ratonPulsado = false;
    const el = renderer.domElement;
    const onDown = (e) => {
        audio.reanudar();
        if (vr) return;
        if (e.pointerType === 'mouse') {
            if (e.button === 2) { cancelar(); return; }
            if (e.button !== 0) return;
            ratonPulsado = true;
            if (op.capturarRaton !== false && document.pointerLockElement !== el && el.requestPointerLock) { try { const r = el.requestPointerLock(); r?.catch?.(() => { }); } catch { /* */ } }
            api.tensar(true);
        } else {
            tocando.set(e.pointerId, { x: e.clientX, y: e.clientY });
            try { el.setPointerCapture(e.pointerId); } catch { /* */ }
        }
    };
    const onMove = (e) => {
        if (vr) return;
        if (e.pointerType === 'mouse') {
            if (document.pointerLockElement === el || ratonPulsado) mirar(enCaza ? 0 : (e.movementX || 0), e.movementY || 0, 0.0021); // cacería: el ratón solo sube/baja la mira, las teclas giran
        } else if (tocando.has(e.pointerId)) {
            const p = tocando.get(e.pointerId);
            mirar(e.clientX - p.x, e.clientY - p.y, 0.0042);
            p.x = e.clientX; p.y = e.clientY;
        }
    };
    const onUp = (e) => {
        if (e.pointerType === 'mouse') { if (e.button === 0 && ratonPulsado) { ratonPulsado = false; api.tensar(false); } }
        else tocando.delete(e.pointerId);
    };
    const onMenu = (e) => e.preventDefault();
    const onKey = (e) => {
        const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        if (e.type === 'keydown') {
            if (e.target && /input|textarea/i.test(e.target.tagName)) return;
            if (k === ' ') { e.preventDefault(); if (!e.repeat) api.tensar(true); return; }
            if (k === 'Shift') { aguantar = true; return; }
            if (k === 'Escape' || k === 'c' || k === 'x') { cancelar(); return; }
            if (k.startsWith('Arrow') || 'wasd'.includes(k)) { e.preventDefault(); teclas.add(k); }
        } else {
            if (k === ' ') { api.tensar(false); return; }
            if (k === 'Shift') { aguantar = false; return; }
            teclas.delete(k);
        }
    };
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    el.addEventListener('contextmenu', onMenu);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);

    function cancelar() {
        if (!tensando && tension <= 0) return;
        tensando = false;
        tension = 0; tLleno = 0;
        trayectoria.visible = false; marcaImpacto.visible = false;
    }

    // ── Bucle ──
    const reloj = new THREE.Clock();
    const poseReposo = { p: new THREE.Vector3(0.13, -0.36, -0.66), r: new THREE.Euler(0.32, 0.05, -0.34) }; // «preparado»: arco bajado, sin tapar el campo
    const poseApunta = { p: new THREE.Vector3(0.05, -(BAJO_OJO + 0.032), -0.7), r: new THREE.Euler(0, 0, -0.13) }; // arco a la derecha de la línea de mira y con la punta inclinada (canteo)
    const _e = new THREE.Euler();
    let tCrujido = 0, fovBase = 72;

    function actualizarFov() {
        const asp = (cont.clientWidth || 800) / (cont.clientHeight || 600);
        fovBase = asp < 1 ? 88 : asp < 1.4 ? 78 : 72;
    }
    actualizarFov();

    function moverJugador(dt) {
        let mx = mov.x, mz = mov.y;
        if (teclas.has('w') || teclas.has('ArrowUp')) mz += 1;
        if (teclas.has('s') || teclas.has('ArrowDown')) mz -= 1;
        const l = Math.hypot(mx, mz);
        if (l > 1) { mx /= l; mz /= l; }
        const anda = l > 0.05;
        if (anda) {
            const v = VEL_JUGADOR * (tensando || tension > 0.05 ? 0.35 : 1);
            const sy = Math.sin(yaw), cy = Math.cos(yaw);
            // delante = (−sin yaw, −cos yaw) · derecha = (cos yaw, −sin yaw)
            rig.position.x += (cy * mx - sy * mz) * v * dt;
            rig.position.z += (-sy * mx - cy * mz) * v * dt;
            limitar(rig.position, 0.5);
            pasoT += dt * 8.5 * Math.min(1, l);
            tPaso -= dt;
            if (tPaso <= 0) { audio.paso(); tPaso = tensando ? 0.7 : 0.42; }
        }
        rig.position.y = altura(rig.position.x, rig.position.z);
        camara.position.y = OJO + (anda ? Math.abs(Math.sin(pasoT)) * 0.035 : 0);
    }

    function dibujarRadar() {
        const c = op.dom.radar, x = c.getContext('2d'), W = c.width, R = W / 2 - 3, esc = R / 40;
        x.clearRect(0, 0, W, W);
        x.fillStyle = 'rgba(10,25,12,0.55)'; x.beginPath(); x.arc(W / 2, W / 2, R, 0, 7); x.fill();
        x.strokeStyle = 'rgba(255,255,255,0.3)'; x.lineWidth = 1; x.beginPath(); x.arc(W / 2, W / 2, R * 0.5, 0, 7); x.stroke();
        const th = yawMundo(), c0 = Math.cos(th), s0 = Math.sin(th);
        for (const d of dianas) {
            if (!d.animal || d.fase === 'bajando' || d.fase === 'cayendo' || d.fase === 'fuera') continue;
            const dx = d.pos.x - rig.position.x, dz = d.pos.z - rig.position.z;
            let px = (dx * c0 - dz * s0) * esc, py = (dx * s0 + dz * c0) * esc; // delante hacia arriba
            const l = Math.hypot(px, py);
            if (l > R - 4) { px *= (R - 4) / l; py *= (R - 4) / l; }
            x.fillStyle = d.eliminada ? 'rgba(255,255,255,0.35)' : congelado > 0 ? '#81d4fa' : modo === 'preguntas' ? COLORES_OPCION[d.idx] : '#ffca28';
            x.beginPath(); x.arc(W / 2 + px, W / 2 + py, 4.5, 0, 7); x.fill();
        }
        x.fillStyle = '#fff';
        x.beginPath(); x.moveTo(W / 2, W / 2 - 7); x.lineTo(W / 2 - 5, W / 2 + 5); x.lineTo(W / 2 + 5, W / 2 + 5); x.closePath(); x.fill();
    }

    let dtForzado = null, sinRender = false; // pruebas automáticas
    function bucle() {
        const dt = dtForzado ?? Math.min(0.05, reloj.getDelta());
        juego.reloj += dt;
        const T = juego.reloj;
        uTiempo.value = T;
        if (uc.time) uc.time.value = T;

        // tensado (ratón / táctil / teclado)
        if (recarga > 0) {
            recarga -= dt;
            if (recarga <= 0) flechaCargada.visible = true;
        }
        const puede = juego.fase === 'apuntando' && recarga <= 0;
        if (!vr) {
            if (tensando && puede) {
                const antes = tension;
                tension = Math.min(1, tension + (dt / T_TENSAR) * (1.25 - 0.5 * tension));
                tCrujido += tension - antes;
                if (tCrujido > 0.08) { audio.crujido(tension); tCrujido = 0; }
            } else if (!tensando && tension > 0) {
                tension = Math.max(0, tension - dt * 3);
            }
        }
        if (tension > 0.97) tLleno += dt; else tLleno = 0;

        // cacería: al empezar a tensar, los animales se quedan quietos unos segundos (una vez por tirada)
        if (enCaza) {
            if (tensando && puede && !congelUsado) { congelado = CONGELAR_S; congelUsado = true; audio.hielo(); }
            if (!tensando && tension === 0 && congelado === 0) congelUsado = false;
            if (congelado > 0) congelado = Math.max(0, congelado - dt);
            const elC = op.dom?.congelado;
            if (elC) {
                const txt = congelado > 0 ? `❄️ Quietos ${congelado.toFixed(1)} s` : '';
                if (elC.textContent !== txt) elC.textContent = txt;
                elC.style.display = congelado > 0 ? 'block' : 'none';
            }
        }

        // respiración y temblor
        let amp = 0.0022 + Math.min(0.026, Math.max(0, tLleno - 2.4) * 0.007);
        if (aguantar && aliento > 0 && tension > 0.3) {
            amp *= 0.18; aliento -= dt * 0.42;
            if (aliento <= 0) { aliento = 0; ahogo = 2.2; }
        } else aliento = Math.min(1, aliento + dt * 0.2);
        if (ahogo > 0) { ahogo -= dt; amp *= 2.4; }
        amp *= tension;
        const swayY = amp * (0.6 * Math.sin(T * 1.31) + 0.3 * Math.sin(T * 2.73 + 1.1) + 0.15 * Math.sin(T * 5.9 + 2));
        const swayP = amp * (0.5 * Math.sin(T * 1.07 + 2.2) + 0.35 * Math.sin(T * 0.42) + 0.15 * Math.sin(T * 6.3));

        if (!vr) {
            // teclado: girar
            // en la cacería: W/S y ↑/↓ andan, A/D y ←/→ giran al jugador (el ratón sube/baja la mira)
            const kv = 0.9 * dt * (tensando ? 0.4 : 1) * (enCaza ? 1.6 : 1);
            if (teclas.has('ArrowLeft') || teclas.has('a')) yaw += kv;
            if (teclas.has('ArrowRight') || teclas.has('d')) yaw -= kv;
            if (!enCaza) {
                if (teclas.has('ArrowUp') || teclas.has('w')) pitch += kv * 0.7;
                if (teclas.has('ArrowDown') || teclas.has('s')) pitch -= kv * 0.7;
            }
            if (!enCaza) yaw = Math.max(-1.25, Math.min(1.25, yaw));
            pitch = Math.max(-0.5, Math.min(0.7, pitch));
            if (enCaza) moverJugador(dt);
            camara.rotation.set(pitch + swayP, yaw + swayY, 0, 'YXZ');
            const fov = fovBase - 9 * tension;
            if (Math.abs(camara.fov - fov) > 0.01) { camara.fov = fov; camara.updateProjectionMatrix(); }
            // postura del arco
            alzado += ((tensando || tension > 0.02 || recarga > 0 ? 1 : 0) - alzado) * suave(7, dt);
            arco.position.lerpVectors(poseReposo.p, poseApunta.p, alzado);
            _e.set(lerp(poseReposo.r.x, poseApunta.r.x, alzado), lerp(poseReposo.r.y, poseApunta.r.y, alzado), lerp(poseReposo.r.z, poseApunta.r.z, alzado));
            arco.rotation.copy(_e);
            if (recarga > 0) arco.position.z += Math.sin(Math.min(1, (0.55 - recarga) / 0.2) * Math.PI) * 0.03; // retroceso
        } else actualizarVR(dt);

        // cuerda, flecha cargada y mano
        const nockZ = vr?.agarre ? vr.nock : BRACE + tension * RECORRIDO;
        arco.userData.actualizar(tension, nockZ, dt);
        flechaCargada.position.set(-0.024, 0.032, nockZ - LARGO);
        manoCuerda.position.set(-0.012, -0.02, nockZ + 0.035);
        manoCuerda.visible = !vr && (tension > 0.01 || tensando);
        if (op.dom?.tension) op.dom.tension.style.transform = `scaleX(${tension.toFixed(3)})`;
        if (op.dom?.aliento) { op.dom.aliento.style.transform = `scaleX(${aliento.toFixed(3)})`; op.dom.aliento.parentElement.style.opacity = tension > 0.3 ? 1 : 0.35; }

        // ayuda de trayectoria
        if ((op.ayuda === 'trayectoria' || enCaza) && tension > 0.05 && puede && flechaCargada.visible) dibujarTrayectoria(tension);
        else { trayectoria.visible = false; marcaImpacto.visible = false; }

        // dianas
        for (let i = dianas.length - 1; i >= 0; i--) {
            const d = dianas[i];
            d.t += dt;
            if (d.animal) { if (actualizarAnimal(d, dt)) { d.fase = 'fuera'; quitarDiana(d); dianas.splice(i, 1); } continue; }
            const g = d.grupo;
            if (d.fase === 'subiendo') {
                const k = Math.min(1, Math.max(0, d.t / 0.9));
                g.position.y = d.yBase - 4 * Math.pow(1 - k, 3);
                if (k >= 1) d.fase = 'lista';
            } else if (d.fase === 'cayendo') {
                const k = Math.min(1, d.t / 0.7);
                d.cuerpo.rotation.x = -(Math.PI / 2 - 0.08) * k * k;
                if (k >= 1 && d.t > 1.6) { d.fase = 'hundiendo'; d.t = 0; }
            } else if (d.fase === 'hundiendo' || d.fase === 'bajando') {
                g.position.y -= dt * (d.fase === 'bajando' ? 6 : 1.5);
                if (g.position.y < d.yBase - 4.5) { d.fase = 'fuera'; quitarDiana(d); dianas.splice(i, 1); continue; }
            }
            if (d.movil && (d.fase === 'lista' || d.fase === 'subiendo') && !d.eliminada) {
                g.position.x = d.x0 + Math.sin(T * d.movil.vel + d.movil.f) * d.movil.amp;
            }
            if (d.brillo) {
                d.brillo.t += dt;
                const k = d.brillo.pulso ? 0.35 + 0.35 * Math.sin(d.brillo.t * 8) : Math.max(0, 0.7 - d.brillo.t * 0.5);
                d.matCara.emissive.setHex(d.brillo.color).multiplyScalar(k);
            }
            g.updateMatrixWorld();
            d.caraG.getWorldPosition(d.centro);
            d.normal.set(0, 0, 1).applyQuaternion(d.caraG.getWorldQuaternion(_q)).normalize();
            d.centro.addScaledVector(d.normal, 0.172);
        }

        if (enCaza && op.dom?.radar && ++cuadro % 3 === 0) dibujarRadar();

        // flechas en vuelo
        for (let i = voladoras.length - 1; i >= 0; i--) {
            const f = voladoras[i];
            f.t += dt;
            let resto = dt, choque = null;
            const p0 = new THREE.Vector3();
            while (resto > 1e-6 && !choque) {
                const h = Math.min(resto, SUB);
                resto -= h;
                p0.copy(f.pos);
                pasoFisico(f.pos, f.vel, h);
                choque = colision(p0, f.pos);
            }
            _d.copy(f.vel).normalize();
            f.obj.position.copy(choque ? choque.punto : f.pos);
            // orientación según la velocidad + giro de las plumas + oscilación de salida (paradoja del arquero)
            f.obj.quaternion.setFromUnitVectors(ATRAS, _l.copy(_d).negate());
            f.giro += dt * 18;
            const osc = 0.035 * Math.exp(-f.t * 7) * Math.sin(f.t * 55);
            f.obj.rotateZ(f.giro); f.obj.rotateX(osc);
            // estela
            const a = f.trailGeo.attributes.position;
            for (let k = a.count - 1; k > 0; k--) a.setXYZ(k, a.getX(k - 1), a.getY(k - 1), a.getZ(k - 1));
            a.setXYZ(0, f.obj.position.x, f.obj.position.y, f.obj.position.z);
            a.needsUpdate = true;
            if (choque) { clavar(f, choque); voladoras.splice(i, 1); }
            else if (f.t > VIDA_FLECHA || f.pos.y < -20) { f.obj.removeFromParent(); f.trail.removeFromParent(); f.trailGeo.dispose(); f.trail.material.dispose(); voladoras.splice(i, 1); }
        }

        // flechas clavadas: vibran al clavarse
        for (const c of clavadas) {
            if (c.vibra > 0.01) {
                c.t += dt; c.vibra *= Math.exp(-dt * 5);
                c.obj.quaternion.copy(c.qBase);
                c.obj.rotateX(Math.sin(c.t * 48) * 0.05 * c.vibra);
                c.obj.rotateY(Math.cos(c.t * 41) * 0.03 * c.vibra);
            }
        }

        // efectos
        for (let i = efectos.length - 1; i >= 0; i--) {
            const e = efectos[i];
            e.t += dt;
            const k = e.t / e.dur;
            if (e.tipo === 'texto') {
                e.obj.position.y = e.y0 + k * 0.9;
                e.obj.material.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
            } else if (e.tipo === 'confeti') {
                const p = e.obj.geometry.attributes.position;
                e.vel.forEach((v, j) => {
                    v.y -= 9 * dt; v.multiplyScalar(1 - dt * 1.4);
                    p.setXYZ(j, p.getX(j) + v.x * dt, p.getY(j) + v.y * dt, p.getZ(j) + v.z * dt);
                });
                p.needsUpdate = true;
                e.obj.material.opacity = 1 - k * k;
            } else if (e.tipo === 'estela') {
                e.obj.material.opacity = 0.45 * (1 - k);
            }
            if (k >= 1) {
                e.obj.removeFromParent();
                if (!e.obj.isSprite) e.obj.geometry?.dispose?.();
                e.obj.material?.map?.dispose?.();
                e.obj.material?.dispose?.();
                efectos.splice(i, 1);
            }
        }

        // bandera al viento
        {
            const v = viento.length();
            const ang = Math.atan2(-viento.z, viento.x);
            bandera.soporte.rotation.y += ((v > 0.1 ? ang : 0.6) - bandera.soporte.rotation.y) * suave(2, dt);
            const pos = bandera.telaGeo.attributes.position, base = bandera.base;
            const caida = v > 0.1 ? Math.max(0, 1 - v / 5) : 1;
            for (let i = 0; i < pos.count; i++) {
                const bx = base[i * 3], by = base[i * 3 + 1];
                const k = bx / 1.6;
                const ola = Math.sin(T * (4 + v) - bx * 3.2) * 0.12 * k * (0.4 + v * 0.15);
                pos.setXYZ(i, bx * (1 - caida * 0.55), by - caida * k * 0.6, ola + caida * k * 0.15);
            }
            pos.needsUpdate = true;
            bandera.telaGeo.computeVertexNormals();
        }

        // pájaros
        for (const p of pajaros) {
            p.f += dt * p.v;
            const x = p.cx + Math.cos(p.f) * p.r, z = p.cz + Math.sin(p.f) * p.r;
            p.g.position.set(x, p.h + Math.sin(p.f * 3) * 2, z);
            p.g.rotation.y = -p.f;
            const aleteo = Math.sin(T * 9 + p.r) * 0.6;
            p.izq.rotation.z = aleteo; p.der.rotation.z = -aleteo;
        }
        proximoPajaro -= dt;
        if (proximoPajaro < 0) { audio.pajaro(); proximoPajaro = 3 + Math.random() * 7; }

        if (!sinRender) renderer.render(escena, camara);
    }

    // ── Redimensionar ──
    const ro = new ResizeObserver(() => {
        const w = cont.clientWidth, h = cont.clientHeight;
        if (!w || !h || renderer.xr.isPresenting) return;
        renderer.setSize(w, h);
        camara.aspect = w / h;
        actualizarFov();
        camara.fov = fovBase;
        camara.updateProjectionMatrix();
        calcularPines();
    });
    ro.observe(cont);

    // ── API ──
    const api = {
        tensar(on) {
            audio.reanudar();
            if (vr) return;
            if (on) { if (juego.fase === 'apuntando') tensando = true; return; }
            if (!tensando) return;
            tensando = false;
            if (tension > 0.12 && juego.fase === 'apuntando' && recarga <= 0) disparar(tension);
            tension = 0; tLleno = 0;
        },
        cancelar,
        aguantar(on) { aguantar = !!on; },
        mirar(dx, dy) { mirar(dx, dy, 0.0042); },
        mover(x, y) { mov.x = x; mov.y = y; },
        setSonido(on) { sonidoOn = !!on; audio.volumen(sonidoOn); },
        entrarVR(sesion) { if (!vr) iniciarVR(sesion); },
        rendirse() { terminar(false); },
        destruir() {
            juego.terminado = true;
            renderer.setAnimationLoop(null);
            ro.disconnect();
            try { renderer.xr.getSession()?.end(); } catch { /* */ }
            el.removeEventListener('pointerdown', onDown);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
            el.removeEventListener('contextmenu', onMenu);
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('keyup', onKey);
            if (document.pointerLockElement === el) { try { document.exitPointerLock(); } catch { /* */ } }
            audio.cerrar();
            dianas.forEach(d => d.modelo?.mixer.stopAllAction());
            escena.traverse(o => {
                if (o.userData?.compartido) return; // mallas de los .glb del Ovni: se comparten entre partidas
                if (o.geometry) o.geometry.dispose();
                if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.map?.dispose?.(); m.dispose(); });
            });
            recursos.forEach(r => r.dispose?.());
            renderer.dispose();
            renderer.domElement.remove();
        },
        // pruebas sin navegador visible
        _depurar: () => ({ juego, dianas, voladoras, clavadas, tension, yaw, pitch, viento, arco, escena }),
        _apuntar(y, p) { yaw = y; pitch = p; },
        _disparar(t = 1) { tension = t; disparar(t); tension = 0; },
        _paso(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) { dtForzado = dt; sinRender = i < n - 1; bucle(); } dtForzado = null; sinRender = false; },
    };

    // arranque
    prepararRonda();
    calcularPines();
    if (op.xrSession) iniciarVR(op.xrSession);
    renderer.setAnimationLoop(bucle);
    return api;
}
