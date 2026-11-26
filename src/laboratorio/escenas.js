// Motor 3D del Laboratorio de Física y Química (three.js).
// crearLaboratorio(contenedor) monta una mesa de laboratorio y carga la escena
// de un experimento (ESCENAS[id]). Cada escena es una función de (paso, p),
// donde p es el avance 0→1 de la animación del paso actual: así cualquier paso
// se puede dibujar en su estado final para capturarlo en la ficha PDF.
// 1 unidad ≈ 10 cm. La mesa está en y = 0.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// ───────────────────────── utilidades ─────────────────────────
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const lerp = (a, b, t) => a + (b - a) * t;
const suave = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
// avance suavizado de p dentro del tramo [a, b]
const tramo = (p, a, b) => suave((p - a) / (b - a));
const rnd = (i, k = 0) => { const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return s - Math.floor(s); };
const col = (c) => new THREE.Color(c);
const mezclaColor = (a, b, t) => col(a).lerp(col(b), clamp01(t));

let texDisco = null;
function discoTex() {
    if (texDisco) return texDisco;
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    texDisco = new THREE.CanvasTexture(cv);
    return texDisco;
}

// ───────────────────────── materiales ─────────────────────────
const M = {
    vidrio: (op = 0.2, color = 0xd6ecff) => new THREE.MeshStandardMaterial({ color, transparent: true, opacity: op, roughness: 0.04, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.6 }),
    liquido: (color, op = 0.72) => new THREE.MeshStandardMaterial({ color, transparent: true, opacity: op, roughness: 0.15, metalness: 0 }),
    solido: (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...extra }),
    metal: (color = 0xb8c0cc) => new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.9 }),
    brillo: (color) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }),
};
const sombra = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

// ───────────────────────── piezas ─────────────────────────
function malla(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; }

// Vaso cilíndrico de vidrio con líquido (setNivel, setColor)
function vaso({ r = 0.4, h = 1, color = 0xbfe3ff, op = 0.6, vidrioOp = 0.2, mitad = false } = {}) {
    const g = new THREE.Group();
    const pts = [[0, 0.001], [r, 0.001], [r, h], [r - 0.02, h], [r - 0.02, 0.04], [0, 0.04]].map(([x, y]) => new THREE.Vector2(x, y));
    const vid = new THREE.Mesh(new THREE.LatheGeometry(pts, 48, mitad ? Math.PI / 2 : 0, mitad ? Math.PI : Math.PI * 2), M.vidrio(vidrioOp));
    vid.renderOrder = 3; g.add(vid);
    const geo = new THREE.CylinderGeometry(r - 0.025, r - 0.025, 1, 48, 1, false, mitad ? Math.PI / 2 : 0, mitad ? Math.PI : Math.PI * 2); geo.translate(0, 0.5, 0);
    const liq = new THREE.Mesh(geo, M.liquido(color, op)); liq.position.y = 0.04; liq.renderOrder = 2; g.add(liq);
    const api = { grupo: g, vidrio: vid, liquido: liq, r, h };
    api.setNivel = (n) => { liq.visible = n > 0.005; liq.scale.y = Math.max(0.001, n); };
    api.setColor = (c) => liq.material.color.copy(col(c));
    api.setNivel(0);
    return api;
}

// Botella con cuello: cuerpo hasta hb y cuello de radio rn hasta ht
function botella({ R = 0.3, hb = 0.8, rn = 0.1, ht = 1.15, color = 0xbfe3ff, op = 0.6, vidrioOp = 0.22, vidrioColor, segmentos = 48 } = {}) {
    const g = new THREE.Group();
    // cuerpo subdividido en altura (la botella que se aplasta deforma sus vértices)
    const cuerpoPts = Array.from({ length: 14 }, (_, i) => [R, 0.06 + ((hb - 0.06) * (i + 1)) / 14]);
    const perfil = [[0, 0.001], [R * 0.92, 0.001], [R, 0.06], ...cuerpoPts, [rn + (R - rn) * 0.35, hb + (ht - hb) * 0.3], [rn, hb + (ht - hb) * 0.5], [rn, ht], [rn - 0.015, ht]];
    const geoV = new THREE.LatheGeometry(perfil.map(([x, y]) => new THREE.Vector2(x, y)), segmentos, 0, Math.PI * 2);
    const vid = new THREE.Mesh(geoV, M.vidrio(vidrioOp, vidrioColor)); vid.renderOrder = 3; g.add(vid);
    const cuerpo = new THREE.CylinderGeometry(R - 0.02, R - 0.02, 1, 40); cuerpo.translate(0, 0.5, 0);
    const cuello = new THREE.CylinderGeometry(rn - 0.015, rn - 0.015, 1, 24); cuello.translate(0, 0.5, 0);
    const mat = M.liquido(color, op);
    const l1 = new THREE.Mesh(cuerpo, mat); l1.position.y = 0.02; l1.renderOrder = 2;
    const l2 = new THREE.Mesh(cuello, mat); l2.position.y = hb; l2.renderOrder = 2;
    g.add(l1, l2);
    const api = { grupo: g, vidrio: vid, R, hb, rn, ht, mat };
    api.setNivel = (n) => {
        l1.visible = n > 0.01; l1.scale.y = Math.max(0.001, Math.min(n, hb) - 0.02);
        l2.visible = n > hb + 0.01; l2.scale.y = Math.max(0.001, n - hb);
    };
    api.setColor = (c) => mat.color.copy(col(c));
    api.setNivel(0);
    return api;
}

// Huevo (perfil de revolución, más ancho abajo)
function geoHuevo(w = 0.2, h = 0.27) {
    const pts = [];
    for (let i = 0; i <= 24; i++) {
        const t = (i / 24) * Math.PI;
        pts.push(new THREE.Vector2(Math.max(0.0001, Math.sin(t) * w * (1 + 0.13 * Math.cos(t))), -Math.cos(t) * h));
    }
    return new THREE.LatheGeometry(pts, 36);
}

// Vela con llama (setLlama 0..1)
function vela({ h = 0.4, r = 0.07 } = {}) {
    const g = new THREE.Group();
    g.add(sombra(malla(new THREE.CylinderGeometry(r, r, h, 24), M.solido(0xfaf3e0), 0, h / 2, 0)));
    g.add(malla(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 6), M.solido(0x222222), 0, h + 0.02, 0));
    const llama = new THREE.Group(); llama.position.y = h + 0.09;
    const ext = malla(new THREE.SphereGeometry(0.05, 16, 12), M.brillo(0xff9a2e)); ext.scale.set(1, 2.2, 1);
    const int = malla(new THREE.SphereGeometry(0.025, 12, 10), M.brillo(0xfff3b0), 0, -0.02, 0); int.scale.set(1, 2, 1);
    llama.add(ext, int); g.add(llama);
    const luz = new THREE.PointLight(0xffa040, 1.2, 3, 2); luz.position.y = h + 0.12; g.add(luz);
    const api = { grupo: g, punta: new THREE.Vector3(0, h + 0.1, 0) };
    api.setLlama = (s, t = 0) => {
        const f = s * (0.92 + 0.08 * Math.sin(t * 23) + 0.05 * Math.sin(t * 37));
        llama.visible = s > 0.02; llama.scale.set(Math.max(0.01, s), Math.max(0.01, f), Math.max(0.01, s));
        luz.intensity = 1.4 * s;
    };
    api.setLlama(1);
    return api;
}

// Llama suelta (algodón ardiendo, fuego del hornillo…)
function llamaSuelta(escala = 1) {
    const g = new THREE.Group();
    const ext = malla(new THREE.SphereGeometry(0.06 * escala, 14, 10), M.brillo(0xff7a1a)); ext.scale.set(1, 2, 1);
    const int = malla(new THREE.SphereGeometry(0.03 * escala, 12, 8), M.brillo(0xffe08a)); int.scale.set(1, 1.8, 1);
    const luz = new THREE.PointLight(0xff8a30, 1.5, 3, 2);
    g.add(ext, int, luz);
    g.set = (s, t = 0) => { const f = s * (0.9 + 0.1 * Math.sin(t * 19)); g.visible = s > 0.02; g.scale.set(Math.max(0.01, s), Math.max(0.01, f), Math.max(0.01, s)); luz.intensity = 1.6 * s; };
    return g;
}

// Partículas (burbujas, gas, vapor, sal…): actualizar(fn(i, s1, s2, s3) → [x,y,z] | null)
function particulas(n, { color = 0xffffff, tam = 0.04, op = 0.7, aditivo = false } = {}) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color, size: tam, transparent: true, opacity: op, depthWrite: false, map: discoTex(), sizeAttenuation: true, blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 5;
    pts.actualizar = (fn) => {
        for (let i = 0; i < n; i++) {
            const v = fn(i, rnd(i, 1), rnd(i, 2), rnd(i, 3));
            if (v) { pos[i * 3] = v[0]; pos[i * 3 + 1] = v[1]; pos[i * 3 + 2] = v[2]; } else { pos[i * 3] = 0; pos[i * 3 + 1] = -50; pos[i * 3 + 2] = 0; }
        }
        geo.attributes.position.needsUpdate = true;
    };
    pts.actualizar(() => null);
    return pts;
}

// Burbujas que suben dentro de un cilindro (cantidad 0..1)
function burbujas(n, { r, y0, y1, x = 0, z = 0, vel = 0.5, tam = 0.035 }) {
    const pts = particulas(n, { color: 0xffffff, tam, op: 0.75 });
    pts.mover = (t, cantidad, opc = {}) => {
        const rr = opc.r ?? r, a = opc.y0 ?? y0, b = opc.y1 ?? y1;
        pts.actualizar((i, s1, s2, s3) => {
            if (s3 > cantidad) return null;
            const u = (t * vel * (0.6 + s2) + s1) % 1;
            const ang = s1 * 40, rad = Math.sqrt(s2) * rr;
            return [x + Math.cos(ang) * rad + Math.sin(t * 3 + i) * 0.01, a + u * (b - a), z + Math.sin(ang) * rad];
        });
    };
    return pts;
}

// Vapor o humo que sube y se abre
function vapor(n, { x = 0, y = 0, z = 0, alto = 0.9, ancho = 0.25, color = 0xffffff, op = 0.35, vel = 0.25, tam = 0.16 } = {}) {
    const pts = particulas(n, { color, tam, op });
    pts.mover = (t, cantidad, base) => {
        const bx = base?.x ?? x, by = base?.y ?? y, bz = base?.z ?? z;
        pts.material.opacity = op * clamp01(cantidad);
        pts.actualizar((i, s1, s2, s3) => {
            if (s3 > cantidad * 1.2 + 0.05) return null;
            const u = (t * vel * (0.7 + s2 * 0.6) + s1) % 1;
            const a = s1 * 30 + t * 0.5;
            return [bx + Math.cos(a) * ancho * u * s2 + Math.sin(t + i) * 0.03 * u, by + u * alto, bz + Math.sin(a) * ancho * u * s2];
        });
    };
    return pts;
}

// Etiqueta de texto que siempre mira a la cámara (setTexto, setOpacidad)
function etiqueta(texto, { color = '#ffffff', fondo = 'rgba(15,23,42,0.82)', tam = 0.11, borde } = {}) {
    // Cada texto nuevo usa un canvas y una textura nuevos: en WebGL2 una textura ya subida no puede cambiar de tamaño
    const mat = new THREE.SpriteMaterial({ depthTest: false, transparent: true });
    const sp = new THREE.Sprite(mat); sp.renderOrder = 20;
    let actual = null;
    sp.setTexto = (t) => {
        if (t === actual) return; actual = t;
        const cv = document.createElement('canvas');
        const g0 = cv.getContext('2d'); g0.font = 'bold 44px "Segoe UI", Arial, sans-serif';
        const w = Math.ceil(g0.measureText(t).width) + 44;
        cv.width = w; cv.height = 70;
        const g = cv.getContext('2d');
        g.fillStyle = fondo; const rr = 18;
        g.beginPath(); g.moveTo(rr, 0); g.arcTo(w, 0, w, 70, rr); g.arcTo(w, 70, 0, 70, rr); g.arcTo(0, 70, 0, 0, rr); g.arcTo(0, 0, w, 0, rr); g.fill();
        if (borde) { g.strokeStyle = borde; g.lineWidth = 4; g.stroke(); }
        g.font = 'bold 44px "Segoe UI", Arial, sans-serif'; g.fillStyle = color; g.textBaseline = 'middle'; g.fillText(t, 22, 37);
        const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
        if (mat.map) mat.map.dispose();
        mat.map = tex; mat.needsUpdate = true;
        sp.scale.set(tam * w / 70, tam, 1);
    };
    sp.setOpacidad = (o) => { mat.opacity = clamp01(o); sp.visible = o > 0.02; };
    sp.setTexto(texto);
    return sp;
}

// Flecha de fuerza/presión
function flecha(color = 0x38bdf8) {
    const a = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 0.3, color, 0.08, 0.06);
    a.line.material.linewidth = 2;
    a.traverse((o) => { o.renderOrder = 15; if (o.material) { o.material.depthTest = false; o.material.transparent = true; } });
    a.poner = (origen, dir, largo) => {
        a.visible = largo > 0.02;
        a.position.copy(origen); a.setDirection(dir.clone().normalize());
        a.setLength(Math.max(0.03, largo), Math.min(0.09, largo * 0.4), Math.min(0.06, largo * 0.3));
    };
    return a;
}

// Línea (rayos de luz)
function linea(color, puntos = 2) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(puntos * 3), 3));
    const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, depthTest: false }));
    l.renderOrder = 16; l.frustumCulled = false;
    l.poner = (...vs) => { const p = geo.attributes.position.array; vs.forEach((v, i) => { p[i * 3] = v.x; p[i * 3 + 1] = v.y; p[i * 3 + 2] = v.z; }); geo.attributes.position.needsUpdate = true; geo.setDrawRange(0, vs.length); };
    l.setOpacidad = (o) => { l.material.opacity = clamp01(o); l.visible = o > 0.02; };
    return l;
}

// Hornillo con fuego
function hornillo(x, z = 0) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    g.add(sombra(malla(new THREE.CylinderGeometry(0.42, 0.45, 0.12, 32), M.solido(0x2b2f36), 0, 0.06, 0)));
    g.add(malla(new THREE.TorusGeometry(0.22, 0.02, 8, 32), M.metal(0x555b66), 0, 0.13, 0)).rotation.x = Math.PI / 2;
    const fuego = new THREE.Group(); fuego.position.y = 0.14;
    for (let i = 0; i < 8; i++) {
        const f = malla(new THREE.ConeGeometry(0.03, 0.09, 8), M.brillo(i % 2 ? 0x3b82f6 : 0x60a5fa));
        const a = (i / 8) * Math.PI * 2; f.position.set(Math.cos(a) * 0.2, 0.04, Math.sin(a) * 0.2); fuego.add(f);
    }
    const luz = new THREE.PointLight(0x6aa8ff, 0.6, 1.5, 2); luz.position.y = 0.2; fuego.add(luz);
    g.add(fuego);
    return { grupo: g, setFuego: (s, t) => { fuego.visible = s > 0.02; fuego.scale.set(1, Math.max(0.01, s * (0.9 + 0.1 * Math.sin(t * 20))), 1); } };
}

// Cazo/olla metálica con líquido
function olla({ r = 0.36, h = 0.36, color = 0xbfe3ff } = {}) {
    const g = new THREE.Group();
    const pts = [[0, 0], [r, 0], [r, h], [r - 0.02, h], [r - 0.02, 0.02], [0, 0.02]].map(([x, y]) => new THREE.Vector2(x, y));
    g.add(sombra(new THREE.Mesh(new THREE.LatheGeometry(pts, 40), new THREE.MeshStandardMaterial({ color: 0xaab2bd, metalness: 0.85, roughness: 0.3, side: THREE.DoubleSide }))));
    const mango = malla(new THREE.BoxGeometry(0.5, 0.04, 0.07), M.solido(0x1f2937), r + 0.24, h - 0.05, 0); g.add(mango);
    const liq = malla(new THREE.CylinderGeometry(r - 0.03, r - 0.03, 0.02, 40), M.liquido(color, 0.9), 0, 0.02, 0); g.add(liq);
    return { grupo: g, liquido: liq, h, setNivel: (n) => { liq.visible = n > 0.01; liq.position.y = 0.02 + n; }, setColor: (c) => liq.material.color.copy(col(c)) };
}

// Cuentagotas (gota que cae: setGota(0..1) entre y0 e y1)
function cuentagotas(colorGota = 0x7b3fa0) {
    const g = new THREE.Group();
    g.add(malla(new THREE.CylinderGeometry(0.03, 0.012, 0.28, 16), M.vidrio(0.45), 0, 0.14, 0));
    g.add(malla(new THREE.SphereGeometry(0.045, 16, 12), M.solido(0xdc2626), 0, 0.31, 0));
    const gota = malla(new THREE.SphereGeometry(0.022, 12, 10), M.liquido(colorGota, 0.95)); gota.scale.y = 1.3; g.add(gota);
    g.gota = gota;
    return g;
}

// Etiqueta de paso «Día 2», reloj…
const todos = (grupo, fn) => grupo.traverse((o) => { if (o.isMesh) fn(o); });

// ───────────────────────── ESCENAS ─────────────────────────
// Cada escena: crear() → { grupo, camara: {pos, mira}, camaraPaso?(paso) → {pos, mira}, dur?: [s por paso], update({ f, paso, p, t, dt, params, captura }) }
// f(k): avance del paso k (0 si aún no ha llegado, 1 si ya pasó).

export const ESCENAS = {
    // ── 🧯 Extintor
    extintor: () => {
        const grupo = new THREE.Group();
        const piv = new THREE.Group(); piv.position.set(-0.7, 0.4, 0); grupo.add(piv);
        const bot = botella({ R: 0.26, hb: 0.75, rn: 0.09, ht: 1.05, color: 0xfff2cf, op: 0.55 }); bot.grupo.position.y = -0.4; piv.add(bot.grupo);
        const corcho = malla(new THREE.CylinderGeometry(0.095, 0.085, 0.12, 20), M.solido(0xb07a45), 0, 1.07, 0); bot.grupo.add(corcho);
        const pajita = malla(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 10), M.solido(0xf43f5e), 0, 1.25, 0); bot.grupo.add(pajita);
        const bolsa = malla(new THREE.SphereGeometry(0.07, 16, 12), M.solido(0xf8fafc)); bot.grupo.add(bolsa);
        const hilo = linea(0xe2e8f0); bot.grupo.add(hilo);
        const dedo = malla(new THREE.SphereGeometry(0.05, 14, 10), M.solido(0xf1c27d), 0, 1.52, 0); bot.grupo.add(dedo);
        const burb = burbujas(70, { r: 0.2, y0: 0.05, y1: 0.4, vel: 0.9 }); bot.grupo.add(burb);
        const v = vela(); v.grupo.position.set(0.95, 0, 0); grupo.add(v.grupo);
        const gas = particulas(110, { color: 0xe2e8f0, tam: 0.13, op: 0.6 }); grupo.add(gas);
        const humo = vapor(40, { x: 0.95, y: 0.5, color: 0x94a3b8, op: 0.45, alto: 0.8, ancho: 0.12, tam: 0.1 }); grupo.add(humo);
        const eCO2 = etiqueta('CO₂', { color: '#e2e8f0' }); grupo.add(eCO2);
        const eVin = etiqueta('Vinagre', { tam: 0.08 }); eVin.position.set(-0.32, 0.12, 0.3); grupo.add(eVin);
        const eBic = etiqueta('Bicarbonato', { tam: 0.08 }); grupo.add(eBic);
        return {
            grupo, camara: { pos: [0.2, 1.5, 3.1], mira: [0.15, 0.6, 0] }, dur: [2.5, 3.5, 3, 3],
            update({ f, t }) {
                const cae = tramo(f(1), 0.15, 0.45);
                bolsa.position.set(0, lerp(0.55, 0.1, cae), 0);
                hilo.poner(new THREE.Vector3(0.03, 1.02, 0), bolsa.position.clone().add(new THREE.Vector3(0, 0.06, 0)));
                eBic.position.set(-0.35, 0.4 + 0.4 * (1 - cae), 0.3); eBic.setOpacidad(1 - f(2));
                eVin.setOpacidad(1 - f(2));
                const agita = f(1) > 0 && f(1) < 1 ? Math.sin(f(1) * 45) * 0.18 * (1 - f(1)) : 0;
                const incl = suave(f(2));
                piv.rotation.z = agita - 1.05 * incl;
                piv.position.set(lerp(-0.7, -0.45, incl), lerp(0.4, 0.55, incl), 0);
                dedo.visible = f(1) > 0 && f(2) < 0.3;
                const reac = f(1) > 0.3 ? (1 - 0.6 * f(3)) : 0;
                bot.setNivel(0.22 + 0.13 * reac);
                bot.setColor(mezclaColor(0xfff2cf, 0xffffff, reac * 0.5));
                burb.mover(t, reac, { y1: 0.22 + 0.13 * reac });
                // gas desde la punta de la pajita hacia la llama (el CO₂ cae)
                grupo.updateMatrixWorld(true); const tip = new THREE.Vector3(0, 0.25, 0); pajita.localToWorld(tip);
                grupo.worldToLocal(tip);
                const fl = new THREE.Vector3(0.95, 0.5, 0);
                const flujo = f(2) > 0.55 ? (1 - 0.7 * tramo(f(3), 0.6, 1)) : 0;
                gas.actualizar((i, s1, s2, s3) => {
                    if (s3 > flujo) return null;
                    const u = (t * 0.6 + s1) % 1;
                    const pnt = tip.clone().lerp(fl, u); pnt.y -= 0.25 * u * u; pnt.x += (s2 - 0.5) * 0.15 * u; pnt.z += (s3 - 0.5) * 0.2 * u;
                    return [pnt.x, pnt.y, pnt.z];
                });
                eCO2.position.copy(tip.clone().lerp(fl, 0.45)).add(new THREE.Vector3(0, 0.22, 0)); eCO2.setOpacidad(flujo);
                const apaga = tramo(f(3), 0.15, 0.55);
                v.setLlama(1 - apaga, t);
                humo.mover(t, f(3) > 0.5 ? 1 - tramo(f(3), 0.9, 1) * 0.5 : 0);
            },
        };
    },

    // ── 🚀 Cohete
    cohete: () => {
        const grupo = new THREE.Group();
        const bot = botella({ R: 0.33, hb: 0.95, rn: 0.11, ht: 1.35, color: 0xf5f0d8, op: 0.5 }); grupo.add(bot.grupo);
        const rollo = malla(new THREE.CylinderGeometry(0.05, 0.05, 0.26, 16), M.solido(0xffffff)); grupo.add(rollo);
        const tapon = new THREE.Group(); grupo.add(tapon);
        tapon.add(malla(new THREE.CylinderGeometry(0.12, 0.1, 0.16, 20), M.solido(0xb07a45)));
        const cintas = [];
        [0xef4444, 0x22c55e, 0x3b82f6, 0xeab308].forEach((c, i) => {
            const cm = malla(new THREE.PlaneGeometry(0.05, 0.5), new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide }));
            const a = (i / 4) * Math.PI * 2; cm.position.set(Math.cos(a) * 0.1, -0.28, Math.sin(a) * 0.1); cm.rotation.y = -a;
            tapon.add(cm); cintas.push(cm);
        });
        const burb = burbujas(90, { r: 0.26, y0: 0.05, y1: 0.4, vel: 1 }); grupo.add(burb);
        const chorro = particulas(80, { color: 0xffffff, tam: 0.06, op: 0.7 }); grupo.add(chorro);
        const flechas = [0, 1, 2, 3, 4].map(() => { const a = flecha(0xf87171); grupo.add(a); return a; });
        const eP = etiqueta('Presión ↑', { color: '#fecaca' }); eP.position.set(0.75, 1.1, 0); grupo.add(eP);
        return {
            grupo, camara: { pos: [0, 1.6, 3.6], mira: [0, 0.8, 0] }, dur: [2, 3, 2, 4, 3.5],
            camaraPaso: (paso) => (paso >= 4 ? { pos: [0, 2.6, 6.4], mira: [0, 2.2, 0] } : null),
            update({ f, t }) {
                bot.setNivel(0.38 * tramo(f(0), 0, 0.8));
                // rollito de papel
                const a = tramo(f(1), 0, 0.45), b = tramo(f(1), 0.45, 1);
                if (f(1) < 0.45) { rollo.position.set(lerp(0.8, 0, a), lerp(0.13, 1.6, a), 0); rollo.rotation.z = lerp(Math.PI / 2, 0, a); }
                else { rollo.position.set(0, lerp(1.6, 0.1, b * b), 0); rollo.rotation.z = lerp(0, Math.PI / 2 * 0.9, tramo(f(1), 0.85, 1)); }
                // tapón
                const c = tramo(f(2), 0, 1);
                const vuela = tramo(f(4), 0.08, 0.7);
                const vu = tramo(f(4), 0.08, 1);
                if (f(2) < 1) { tapon.position.set(lerp(-0.9, 0, c), lerp(0.08, 1.4, c), 0); tapon.rotation.set(lerp(Math.PI / 2, 0, c), 0, 0); }
                else { tapon.position.set(1.5 * vu, Math.max(0.1, 1.4 + 8 * vu - 9.4 * vu * vu), 0); tapon.rotation.set(0, vu * 9, vu * 2.5); }
                cintas.forEach((cm, i) => { cm.rotation.x = Math.sin(t * 8 + i) * 0.25 * vuela * (1 - vu); });
                // reacción
                const reac = f(3) > 0.1 ? 1 - 0.6 * f(4) : 0;
                burb.mover(t, reac, { y1: 0.38 + 0.05 * reac });
                const presion = f(3) * (1 - tramo(f(4), 0.05, 0.15));
                bot.grupo.position.x = presion > 0.6 ? Math.sin(t * 60) * 0.008 * presion : 0;
                bot.grupo.position.y = -0.06 * tramo(f(4), 0.05, 0.12) * (1 - tramo(f(4), 0.12, 0.4));
                flechas.forEach((fl, i) => {
                    const ang = (i / 5) * Math.PI * 2;
                    const dir = i === 4 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
                    const org = i === 4 ? new THREE.Vector3(0, 0.75, 0) : new THREE.Vector3(0, 0.65, 0);
                    fl.poner(org, dir, 0.32 * presion);
                });
                eP.setOpacidad(presion);
                const sale = f(4) > 0.08 ? 1 - tramo(f(4), 0.3, 0.8) : 0;
                chorro.actualizar((i, s1, s2, s3) => {
                    if (s3 > sale) return null;
                    const u = (t * 1.2 + s1) % 1;
                    return [(s2 - 0.5) * 0.6 * u, 1.38 + u * 1.6 - u * u * 0.6, (s1 - 0.5) * 0.6 * u];
                });
            },
        };
    },

    // ── 🌈 Líquidos en capas
    capas: () => {
        const grupo = new THREE.Group();
        const r = 0.3, H = 1.6;
        const vid = malla(new THREE.LatheGeometry([[0, 0.001], [r, 0.001], [r, H], [r - 0.02, H], [r - 0.02, 0.03], [0, 0.03]].map(([x, y]) => new THREE.Vector2(x, y)), 48), M.vidrio(0.2));
        vid.renderOrder = 3; grupo.add(vid);
        const capa = (c, op) => { const g = new THREE.CylinderGeometry(r - 0.025, r - 0.025, 1, 40); g.translate(0, 0.5, 0); const m = malla(g, M.liquido(c, op)); m.renderOrder = 2; grupo.add(m); return m; };
        const glic = capa(0xd9c8ff, 0.6), agua = capa(0x4ea3f0, 0.75), aceite = capa(0xf2c230, 0.75), mezcla = capa(0xc9b98a, 0.85);
        const chorro = malla(new THREE.CylinderGeometry(0.025, 0.025, 1, 10), M.liquido(0x4ea3f0, 0.8)); chorro.geometry.translate(0, 0.5, 0); grupo.add(chorro);
        const gotasG = particulas(30, { color: 0xd9c8ff, tam: 0.07, op: 0.9 }); grupo.add(gotasG);
        const gotasC = particulas(3, { color: 0xe11d48, tam: 0.07, op: 1 }); grupo.add(gotasC);
        const eA = etiqueta('Agua · 1,00 g/cm³', { tam: 0.085, color: '#bae6fd' }); grupo.add(eA);
        const eO = etiqueta('Aceite · 0,92 g/cm³', { tam: 0.085, color: '#fde68a' }); grupo.add(eO);
        const eG = etiqueta('Glicerina · 1,26 g/cm³', { tam: 0.085, color: '#ddd6fe' }); grupo.add(eG);
        const tapa = malla(new THREE.CylinderGeometry(r + 0.01, r + 0.01, 0.06, 32), M.solido(0x2563eb), 0, H + 0.03, 0); grupo.add(tapa);
        const base = 0.03, L = 0.36;
        return {
            grupo, camara: { pos: [0.7, 1.3, 3.1], mira: [0.35, 0.75, 0] }, dur: [2.5, 2.5, 3, 3.5, 5],
            update({ f, t }) {
                const hA = L * f(0), hO = L * f(1), hG = L * tramo(f(2), 0.35, 1);
                glic.position.y = base; glic.scale.y = Math.max(0.001, hG); glic.visible = hG > 0.005;
                agua.position.y = base + hG; agua.scale.y = Math.max(0.001, hA); agua.visible = hA > 0.005;
                aceite.position.y = base + hG + hA; aceite.scale.y = Math.max(0.001, hO); aceite.visible = hO > 0.005;
                const top = base + hG + hA + hO;
                // chorro del líquido que se vierte
                const vert = [0, 1].find((k) => f(k) > 0 && f(k) < 1);
                chorro.visible = vert !== undefined;
                if (chorro.visible) { chorro.material.color.copy(col(vert === 0 ? 0x4ea3f0 : 0xf2c230)); chorro.position.y = top; chorro.scale.y = 2.1 - top; }
                // glicerina: gotas que atraviesan las capas
                const fg = f(2) > 0 && f(2) < 1 ? 1 : 0;
                gotasG.actualizar((i, s1, s2) => { if (!fg) return null; const u = (t * 0.7 + s1) % 1; return [(s2 - 0.5) * 0.15, lerp(2.0, base + hG, u), (s1 - 0.5) * 0.15]; });
                // colorante: gotas rojas lentas en el aceite y se disuelven en el agua
                const pc = f(3);
                gotasC.actualizar((i) => {
                    if (pc <= 0 || pc >= 1) return null;
                    const u = clamp01(pc * 1.5 - i * 0.15);
                    const y = u < 0.3 ? lerp(1.9, top, u / 0.3) : u < 0.7 ? lerp(top, base + hG + hA, (u - 0.3) / 0.4) : base + hG + hA - (u - 0.7) * 0.6;
                    return u >= 0.95 ? null : [(i - 1) * 0.08, y, 0];
                });
                const tinte = tramo(pc, 0.6, 1);
                agua.material.color.copy(mezclaColor(0x4ea3f0, 0xe0245e, tinte));
                // agitar y reposar
                const fm = f(4);
                const mez = fm <= 0 ? 0 : fm < 0.3 ? tramo(fm, 0, 0.3) : 1 - tramo(fm, 0.35, 1);
                grupo.rotation.z = fm > 0 && fm < 0.32 ? Math.sin(fm * 60) * 0.2 : 0;
                tapa.visible = f(4) > 0;
                mezcla.position.y = base; mezcla.scale.y = Math.max(0.001, top - base); mezcla.visible = mez > 0.02;
                mezcla.material.opacity = 0.9 * mez;
                mezcla.material.color.copy(mezclaColor(0xd9c8ff, 0xff9fb0, tinte * 0.6).lerp(col(0xf2c230), 0.35));
                const op = 1 - mez;
                eG.position.set(0.85, base + hG / 2, 0); eG.setOpacidad(hG > 0.05 ? op : 0);
                eA.position.set(0.8, base + hG + hA / 2, 0); eA.setOpacidad(hA > 0.05 ? op : 0);
                eO.position.set(0.82, base + hG + hA + hO / 2, 0); eO.setOpacidad(hO > 0.05 ? op : 0);
            },
        };
    },

    // ── 🥬 Lombarda
    lombarda: () => {
        const grupo = new THREE.Group();
        const horn = hornillo(-1.7); grupo.add(horn.grupo);
        const ol = olla({ color: 0x6b2a8f }); ol.grupo.position.set(-1.7, 0.13, 0); grupo.add(ol.grupo);
        const hojas = particulas(25, { color: 0x7e22ce, tam: 0.12, op: 0.95 }); grupo.add(hojas);
        const vap = vapor(40, { x: -1.7, y: 0.5, ancho: 0.3 }); grupo.add(vap);
        const frasco = vaso({ r: 0.2, h: 0.6, color: 0x6b2a8f, op: 0.85 }); frasco.grupo.position.set(-0.95, 0, 0.1); grupo.add(frasco.grupo);
        const chorroOl = malla(new THREE.CylinderGeometry(0.02, 0.02, 1, 8), M.liquido(0x6b2a8f, 0.9)); grupo.add(chorroOl);
        const SUST = [
            { n: 'Vinagre', ph: 'pH ≈ 3', c0: 0xfffbea, c1: 0xdc1f4f, paso: 2 },
            { n: 'Limón', ph: 'pH ≈ 2', c0: 0xfff6b0, c1: 0xff3d77, paso: 2 },
            { n: 'Agua', ph: 'pH = 7', c0: 0xe8f4ff, c1: 0x7b3fa0, paso: 3 },
            { n: 'Bicarbonato', ph: 'pH ≈ 8,5', c0: 0xf4f4f4, c1: 0x2b7fa8, paso: 4 },
            { n: 'Detergente', ph: 'pH ≈ 10', c0: 0xe2f5dc, c1: 0x22a447, paso: 4 },
        ];
        const vasos = SUST.map((s, i) => {
            const v = vaso({ r: 0.2, h: 0.5, color: s.c0, op: 0.75 }); v.grupo.position.set(-0.3 + i * 0.55, 0, 0.1); v.setNivel(0.28); grupo.add(v.grupo);
            const e = etiqueta(s.n, { tam: 0.075 }); e.position.set(-0.3 + i * 0.55, 0.62, 0.1); grupo.add(e);
            const eph = etiqueta(s.ph, { tam: 0.07, color: '#fde68a' }); eph.position.set(-0.3 + i * 0.55, 0.76, 0.1); grupo.add(eph);
            const cg = cuentagotas(0x6b2a8f); cg.position.set(-0.3 + i * 0.55, 0.85, 0.1); grupo.add(cg);
            return { v, eph, cg, s };
        });
        // escala de pH
        const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
        const g = cv.getContext('2d'); const gr = g.createLinearGradient(0, 0, 512, 0);
        ['#dc1f4f', '#ff3d77', '#b04aa8', '#7b3fa0', '#3b5fb0', '#2b7fa8', '#22a447', '#c5d92b'].forEach((c, i, a) => gr.addColorStop(i / (a.length - 1), c));
        g.fillStyle = gr; g.fillRect(0, 0, 512, 40); g.fillStyle = '#fff'; g.font = 'bold 20px Arial';
        [0, 2, 4, 6, 7, 8, 10, 12, 14].forEach((n) => g.fillText(String(n), (n / 14) * 492 + 4, 60));
        const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
        const escala = malla(new THREE.PlaneGeometry(2.6, 0.32), new THREE.MeshBasicMaterial({ map: tx, transparent: true }), 0.8, 1.35, -0.6); grupo.add(escala);
        const eEsc = etiqueta('ÁCIDO  ←  pH  →  BÁSICO', { tam: 0.09 }); eEsc.position.set(0.8, 1.62, -0.6); grupo.add(eEsc);
        return {
            grupo, camara: { pos: [0, 1.9, 4.3], mira: [0.1, 0.5, 0] }, dur: [3, 3, 3, 2.5, 3.5],
            update({ f, t }) {
                horn.setFuego(1 - f(1), t);
                ol.setNivel(0.28 * (1 - 0.8 * tramo(f(1), 0.2, 0.9)));
                ol.setColor(mezclaColor(0x9fd2ff, 0x6b2a8f, tramo(f(0), 0, 0.8)));
                vap.mover(t, tramo(f(0), 0.2, 0.6) * (1 - f(1)));
                hojas.actualizar((i, s1, s2) => (f(1) > 0.2 ? null : [-1.7 + (s1 - 0.5) * 0.5, 0.13 + 0.06 + 0.28 * (1 - 0.8 * tramo(f(1), 0.2, 0.9)) + Math.sin(t * 2 + i) * 0.01, (s2 - 0.5) * 0.5]));
                // colar al frasco: la olla se inclina
                const inc = f(1) > 0 && f(1) < 1 ? Math.sin(Math.PI * f(1)) : 0;
                ol.grupo.position.set(lerp(-1.7, -1.2, inc), 0.13 + 0.6 * inc, 0);
                ol.grupo.rotation.z = -1.0 * inc;
                chorroOl.visible = f(1) > 0.2 && f(1) < 0.9;
                chorroOl.position.set(-0.95, 0.45, 0.1); chorroOl.scale.y = 0.5;
                frasco.setNivel(0.45 * tramo(f(1), 0.2, 0.9) * (1 - 0.25 * f(4)));
                horn.grupo.visible = true;
                escala.visible = f(4) > 0.5; escala.material.opacity = tramo(f(4), 0.5, 1); eEsc.setOpacidad(tramo(f(4), 0.5, 1));
                vasos.forEach(({ v, eph, cg, s }, i) => {
                    const k = s.paso; const orden = k === 2 ? i : k === 4 ? i - 3 : 0; const n = k === 3 ? 1 : 2;
                    const a = orden / n, b = (orden + 1) / n;
                    const loc = clamp01((f(k) - a) / (b - a));
                    cg.visible = loc > 0 && loc < 1;
                    cg.gota.position.y = loc < 0.5 ? -0.02 : lerp(-0.02, -0.6, tramo(loc, 0.5, 0.8));
                    cg.gota.visible = loc < 0.8;
                    const c = tramo(loc, 0.75, 1);
                    v.setColor(mezclaColor(s.c0, s.c1, c)); v.liquido.material.opacity = 0.75 + 0.15 * c;
                    eph.setOpacidad(c);
                });
            },
        };
    },

    // ── 🥚 Huevo transparente
    huevoTransparente: () => {
        const grupo = new THREE.Group();
        const v = vaso({ r: 0.42, h: 1.0, color: 0xfff7dc, op: 0.45 }); grupo.add(v.grupo);
        const huevo = new THREE.Group(); grupo.add(huevo);
        const matCasc = new THREE.MeshStandardMaterial({ color: 0xf3e2c7, roughness: 0.7, transparent: true, opacity: 1 });
        const casc = sombra(malla(geoHuevo(0.2, 0.27), matCasc)); huevo.add(casc);
        const yema = malla(new THREE.SphereGeometry(0.1, 24, 16), M.solido(0xf59e0b, { roughness: 0.35 }), 0, -0.04, 0); huevo.add(yema);
        const burb = particulas(80, { color: 0xffffff, tam: 0.03, op: 0.85 }); grupo.add(burb);
        const sedimento = malla(new THREE.CylinderGeometry(0.3, 0.38, 0.03, 32), M.solido(0xf5f5f4), 0, 0.055, 0); grupo.add(sedimento);
        const plato = sombra(malla(new THREE.CylinderGeometry(0.4, 0.3, 0.05, 32), M.solido(0xffffff, { roughness: 0.2 }), 1.1, 0.025, 0)); grupo.add(plato);
        const eDia = etiqueta('Día 1', { color: '#fde68a' }); eDia.position.set(-0.75, 1.15, 0); grupo.add(eDia);
        const eCO2 = etiqueta('burbujas de CO₂', { tam: 0.08 }); eCO2.position.set(0.75, 0.7, 0); grupo.add(eCO2);
        return {
            grupo, camara: { pos: [0.4, 1.3, 2.9], mira: [0.3, 0.45, 0] }, dur: [2, 3, 5, 3],
            update({ f, t }) {
                const yR = 0.04 + 0.27 * 0.98;
                if (f(3) > 0) {
                    const s = suave(f(3));
                    huevo.position.set(lerp(0, 1.1, s), lerp(yR, 0.3, s) + Math.sin(Math.PI * s) * 0.9, 0);
                } else huevo.position.set(0, lerp(1.6, yR, suave(f(0))), 0);
                const nivel = 0.75 * tramo(f(1), 0, 0.8);
                v.setNivel(nivel);
                const dias = f(2);
                v.setColor(mezclaColor(0xfff7dc, 0xf1ead0, Math.sin(Math.PI * dias) * 0.8));
                // la cáscara desaparece: el huevo se vuelve translúcido y algo más grande (ósmosis)
                const disuelve = tramo(dias, 0.05, 0.95);
                matCasc.opacity = lerp(1, 0.32, disuelve); matCasc.depthWrite = disuelve < 0.3;
                matCasc.color.copy(mezclaColor(0xf3e2c7, 0xfff4d0, disuelve));
                matCasc.roughness = lerp(0.7, 0.15, disuelve);
                huevo.scale.setScalar(1 + 0.12 * disuelve);
                eDia.setTexto(`Día ${Math.max(1, Math.ceil(dias * 3))}`); eDia.setOpacidad(f(2) > 0 && f(3) < 0.5 ? 1 : 0);
                sedimento.visible = dias > 0.2; sedimento.scale.set(1, 1, 1);
                const cant = f(1) > 0.4 && f(3) === 0 ? 1 - 0.8 * dias : 0;
                eCO2.setOpacidad(f(1) > 0.4 && f(2) < 0.4 ? 1 : 0);
                const c = huevo.position;
                burb.actualizar((i, s1, s2, s3) => {
                    if (s3 > cant) return null;
                    const u = (t * 0.35 * (0.5 + s2) + s1) % 1;
                    const th = s1 * Math.PI * 2, ph = s2 * Math.PI;
                    const rr = 0.22 * huevo.scale.x;
                    const sx = c.x + Math.sin(ph) * Math.cos(th) * rr, sz = c.z + Math.sin(ph) * Math.sin(th) * rr, sy = c.y - Math.cos(ph) * 0.27 * huevo.scale.y;
                    const y = Math.min(sy + u * 0.8, 0.04 + nivel - 0.02);
                    return [sx, y, sz];
                });
            },
        };
    },

    // ── 🍋 Tinta de limón
    tintaLimon: () => {
        const grupo = new THREE.Group();
        const cv = document.createElement('canvas'); cv.width = 768; cv.height = 512;
        const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
        const papel = sombra(malla(new THREE.PlaneGeometry(1.5, 1.0), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.9 }), 0, 0.005, 0)); papel.rotation.x = -Math.PI / 2; grupo.add(papel);
        const MSG = ['¡LA CIENCIA', 'MOLA!'];
        let clave = '';
        const dibujar = (escrito, humedo, revelado) => {
            const k = `${escrito.toFixed(2)}|${humedo.toFixed(2)}|${revelado.toFixed(2)}`; if (k === clave) return; clave = k;
            const g = cv.getContext('2d');
            g.fillStyle = '#fbf8ef'; g.fillRect(0, 0, 768, 512);
            g.strokeStyle = 'rgba(147,197,253,0.35)'; g.lineWidth = 2; for (let y = 60; y < 512; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(768, y); g.stroke(); }
            g.font = 'bold 110px "Comic Sans MS", "Segoe UI", sans-serif'; g.textAlign = 'center';
            const dib = (color, clipX) => { g.save(); g.beginPath(); g.rect(0, 0, clipX, 512); g.clip(); g.fillStyle = color; g.fillText(MSG[0], 384, 220); g.fillText(MSG[1], 384, 360); g.restore(); };
            if (humedo > 0) dib(`rgba(214,196,92,${0.55 * humedo})`, escrito * 768);
            if (revelado > 0) dib(`rgba(120,62,18,${0.95})`, revelado * 768);
            tx.needsUpdate = true;
        };
        const limon = new THREE.Group(); grupo.add(limon);
        const mitadL = malla(new THREE.SphereGeometry(0.16, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.solido(0xfacc15)); mitadL.rotation.x = Math.PI; limon.add(mitadL);
        limon.add(malla(new THREE.CircleGeometry(0.155, 24), M.solido(0xfef08a))).rotation.x = -Math.PI / 2;
        const vasoZ = vaso({ r: 0.16, h: 0.35, color: 0xfff3a6, op: 0.8 }); vasoZ.grupo.position.set(-1.1, 0, 0.3); grupo.add(vasoZ.grupo);
        const pincel = new THREE.Group(); grupo.add(pincel);
        const mango = malla(new THREE.CylinderGeometry(0.015, 0.012, 0.45, 10), M.solido(0xb45309), 0, 0.27, 0); pincel.add(mango);
        pincel.add(malla(new THREE.ConeGeometry(0.02, 0.07, 10), M.solido(0x3f3f46), 0, 0.02, 0)).rotation.x = Math.PI;
        const plancha = new THREE.Group(); grupo.add(plancha);
        const baseP = new THREE.Shape(); baseP.moveTo(-0.22, -0.13); baseP.lineTo(0.15, -0.13); baseP.quadraticCurveTo(0.32, 0, 0.15, 0.13); baseP.lineTo(-0.22, 0.13); baseP.lineTo(-0.22, -0.13);
        const cuerpoP = malla(new THREE.ExtrudeGeometry(baseP, { depth: 0.12, bevelEnabled: false }), M.solido(0x38bdf8, { roughness: 0.3 })); cuerpoP.rotation.x = -Math.PI / 2; plancha.add(cuerpoP);
        plancha.add(malla(new THREE.BoxGeometry(0.28, 0.04, 0.05), M.solido(0x1e293b), -0.04, 0.2, 0));
        const calor = particulas(30, { color: 0xffb070, tam: 0.06, op: 0.4, aditivo: true }); grupo.add(calor);
        const eCalor = etiqueta('calor', { tam: 0.08, color: '#fdba74' }); grupo.add(eCalor);
        return {
            grupo, camara: { pos: [0, 2.0, 1.9], mira: [0, 0, 0.05] }, dur: [2.5, 4, 2.5, 4],
            update({ f, t }) {
                const ex = f(0);
                limon.position.set(-1.1, 0.42 + 0.1 * Math.abs(Math.sin(ex * Math.PI * 3)) * (ex < 1 ? 1 : 0), 0.3);
                limon.rotation.y = ex * 6; limon.visible = f(1) === 0 || f(1) < 0.1;
                vasoZ.setNivel(0.2 * tramo(ex, 0, 0.9));
                const esc = tramo(f(1), 0.05, 0.95);
                const humedo = f(1) > 0 ? 1 - tramo(f(2), 0, 0.9) : 0;
                const rev = tramo(f(3), 0.1, 0.95);
                dibujar(esc, humedo, rev);
                pincel.visible = f(1) > 0 && f(1) < 1;
                const fila = esc < 0.5 ? 0 : 1, u = (esc % 0.5) * 2;
                pincel.position.set(lerp(-0.55, 0.55, u), 0.01, fila === 0 ? -0.08 : 0.2);
                pincel.rotation.z = -0.4 + Math.sin(t * 20) * 0.1;
                plancha.visible = f(3) > 0 && f(3) < 1;
                const px = lerp(-0.95, 0.95, rev);
                plancha.position.set(px, 0.06, 0.02);
                calor.actualizar((i, s1, s2, s3) => (plancha.visible && s3 < 0.8 ? [px + (s1 - 0.5) * 0.4, 0.1 + ((t * 0.5 + s2) % 1) * 0.4, (s3 - 0.5) * 0.3] : null));
                eCalor.position.set(px, 0.55, 0); eCalor.setOpacidad(plancha.visible ? 1 : 0);
            },
        };
    },

    // ── 🖍️ Cromatografía
    cromatografia: () => {
        const grupo = new THREE.Group();
        const v = vaso({ r: 0.32, h: 1.05, color: 0xe0f2fe, op: 0.45 }); grupo.add(v.grupo);
        const cv = document.createElement('canvas'); cv.width = 128; cv.height = 512;
        const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
        const L = 1.12, Wt = 0.26;
        const tira = new THREE.Group(); grupo.add(tira);
        const plano = malla(new THREE.PlaneGeometry(Wt, L), new THREE.MeshStandardMaterial({ map: tx, side: THREE.DoubleSide, roughness: 0.95 }), 0, -L / 2, 0); tira.add(plano);
        const boli = malla(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 12), M.solido(0x1d4ed8)); boli.rotation.z = Math.PI / 2; grupo.add(boli);
        const rotu = new THREE.Group(); grupo.add(rotu);
        rotu.add(malla(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 12), M.solido(0x111827), 0, 0.17, 0));
        rotu.add(malla(new THREE.ConeGeometry(0.03, 0.05, 12), M.solido(0x000000), 0, 0.0, 0)).rotation.x = Math.PI;
        const yMancha = 0.2; // distancia desde el extremo inferior (2 cm)
        const BANDAS = [{ c: [250, 204, 21], k: 0.88 }, { c: [236, 72, 153], k: 0.62 }, { c: [37, 99, 235], k: 0.38 }, { c: [20, 184, 166], k: 0.2 }];
        let clave = '';
        const dibujar = (mancha, frente, sep) => {
            const k = `${mancha.toFixed(2)}|${frente.toFixed(3)}|${sep.toFixed(3)}`; if (k === clave) return; clave = k;
            const g = cv.getContext('2d'); const pxY = (d) => 512 - (d / L) * 512;
            g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 512);
            if (frente > 0) { g.fillStyle = 'rgba(186,215,240,0.55)'; g.fillRect(0, pxY(frente), 128, 512 - pxY(frente)); }
            if (mancha > 0) {
                const negro = 1 - sep;
                if (negro > 0) { g.fillStyle = `rgba(15,15,20,${0.95 * negro * mancha})`; g.beginPath(); g.ellipse(64, pxY(yMancha), 18 * mancha + 1, 12 * mancha + 1, 0, 0, Math.PI * 2); g.fill(); }
                if (sep > 0) BANDAS.forEach((b) => {
                    const y = yMancha + (frente - yMancha) * b.k * sep;
                    const gr = g.createLinearGradient(0, pxY(y) - 26, 0, pxY(y) + 26);
                    gr.addColorStop(0, `rgba(${b.c},0)`); gr.addColorStop(0.5, `rgba(${b.c},${Math.min(1, sep * 1.5)})`); gr.addColorStop(1, `rgba(${b.c},0)`);
                    g.fillStyle = gr; g.fillRect(14, pxY(y) - 30, 100, 60);
                });
            }
            tx.needsUpdate = true;
        };
        return {
            grupo, camara: { pos: [0.45, 1.45, 2.6], mira: [0.3, 0.45, 0] }, dur: [3, 3, 4, 6],
            update({ f }) {
                const cuelga = suave(f(1));
                // tira tumbada en la mesa → colgada del boli dentro del vaso
                tira.position.set(lerp(0.75, 0, cuelga), lerp(0.006, 1.13, cuelga), lerp(-0.6, 0, cuelga));
                tira.rotation.x = lerp(-Math.PI / 2, 0, cuelga);
                boli.position.set(lerp(0.75, 0, cuelga), lerp(0.03, 1.15, cuelga), lerp(-0.67, 0, cuelga));
                boli.visible = f(1) > 0;
                v.setNivel(0.1 * tramo(f(1), 0.5, 1));
                const mancha = tramo(f(0), 0.2, 0.9);
                rotu.visible = f(0) > 0 && f(0) < 1;
                rotu.position.set(0.75 + Math.sin(f(0) * 30) * 0.03, 0.01, -0.6 + L - yMancha + Math.cos(f(0) * 30) * 0.02); rotu.rotation.x = 0.2;
                const frente = f(2) > 0 ? lerp(0.09, yMancha + 0.06, tramo(f(2), 0, 1)) + (f(3) > 0 ? lerp(0, 0.95 - yMancha - 0.06, tramo(f(3), 0, 1)) : 0) : 0;
                const sep = tramo(f(3), 0.05, 1);
                dibujar(mancha, frente, sep);
            },
        };
    },

    // ── 🍳 Huevo frito en frío
    huevoFrito: () => {
        const grupo = new THREE.Group();
        const plato = sombra(malla(new THREE.CylinderGeometry(0.65, 0.5, 0.06, 48), M.solido(0x3b82c4, { roughness: 0.25 }), 0, 0.03, 0)); grupo.add(plato);
        // clara: disco irregular
        const forma = new THREE.Shape();
        for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI * 2; const rr = 0.4 * (1 + 0.12 * Math.sin(a * 3) + 0.06 * Math.sin(a * 5 + 1)); const x = Math.cos(a) * rr, y = Math.sin(a) * rr; if (i === 0) forma.moveTo(x, y); else forma.lineTo(x, y); }
        const geoClara = new THREE.ExtrudeGeometry(forma, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.02, bevelSegments: 3 });
        const matClara = new THREE.MeshStandardMaterial({ color: 0xfffbe6, transparent: true, opacity: 0.35, roughness: 0.05 });
        const clara = malla(geoClara, matClara, 0, 0.065, 0); clara.rotation.x = -Math.PI / 2; grupo.add(clara);
        const matBlanca = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0, roughness: 0.6 });
        const blanca = malla(geoClara, matBlanca, 0, 0.066, 0); blanca.rotation.x = -Math.PI / 2; blanca.scale.z = 1.05; grupo.add(blanca);
        const yema = malla(new THREE.SphereGeometry(0.13, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2), M.solido(0xf59e0b, { roughness: 0.25 }), 0.05, 0.09, 0.02); grupo.add(yema);
        const huevo = sombra(malla(geoHuevo(0.2, 0.27), M.solido(0xe9cfa8))); grupo.add(huevo);
        const geoMedia = new THREE.SphereGeometry(0.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
        const cA = malla(geoMedia, M.solido(0xe9cfa8, { side: THREE.DoubleSide })), cB = malla(geoMedia, M.solido(0xe9cfa8, { side: THREE.DoubleSide }));
        cA.userData.lado = -1; cB.userData.lado = 1; grupo.add(cA, cB);
        const frasco = new THREE.Group(); grupo.add(frasco);
        frasco.add(malla(new THREE.CylinderGeometry(0.12, 0.12, 0.4, 24), M.vidrio(0.4, 0xbfe3ff), 0, 0.2, 0));
        frasco.add(malla(new THREE.CylinderGeometry(0.115, 0.115, 0.3, 24), M.liquido(0xe0f2fe, 0.5), 0, 0.17, 0));
        frasco.add(malla(new THREE.CylinderGeometry(0.04, 0.05, 0.1, 16), M.solido(0xffffff), 0, 0.44, 0));
        const eAlc = etiqueta('Alcohol', { tam: 0.07 }); eAlc.position.y = 0.62; frasco.add(eAlc);
        const chorro = particulas(40, { color: 0xe0f2fe, tam: 0.04, op: 0.8 }); grupo.add(chorro);
        const eT = etiqueta('⏱ 0 min', { color: '#fde68a' }); eT.position.set(-0.75, 0.75, 0); grupo.add(eT);
        return {
            grupo, camara: { pos: [0, 1.5, 1.8], mira: [0, 0.1, 0] }, dur: [3, 3, 3, 4],
            update({ f, t }) {
                const c = f(0);
                // huevo baja, se casca y las cáscaras se apartan
                huevo.visible = c < 0.4;
                huevo.position.set(0, lerp(0.9, 0.35, tramo(c, 0, 0.35)), 0); huevo.rotation.z = Math.PI / 2;
                const abre = tramo(c, 0.35, 0.8);
                [cA, cB].forEach((m) => { m.visible = c >= 0.4 && c < 1; m.position.set(m.userData.lado * (0.1 + abre * 0.5), 0.35 + abre * 0.2, 0); m.rotation.z = m.userData.lado * (Math.PI / 2 + abre * 0.9); m.scale.set(1, 1.3, 1); });
                const sale = tramo(c, 0.4, 1);
                clara.visible = yema.visible = c > 0.4;
                clara.scale.set(lerp(0.3, 1, sale), lerp(0.3, 1, sale), 1);
                yema.position.y = lerp(0.3, 0.09, sale);
                // alcohol
                const a = f(1);
                frasco.visible = a > 0 && a < 1;
                frasco.position.set(0.45, 0.35, 0); frasco.rotation.z = lerp(0, 2.0, tramo(a, 0, 0.3)) * (1 - tramo(a, 0.85, 1));
                chorro.actualizar((i, s1, s2) => (a > 0.25 && a < 0.85 ? [0.12 + (s1 - 0.5) * 0.4 * ((t + s2) % 1), 0.45 - ((t * 1.5 + s1) % 1) * 0.38, (s2 - 0.5) * 0.4] : null));
                matClara.opacity = 0.35 + 0.1 * a; matClara.roughness = a > 0 ? 0.02 : 0.05;
                // desnaturalización: la clara se vuelve blanca y opaca
                const w = 0.45 * tramo(f(2), 0, 1) + 0.55 * tramo(f(3), 0, 1);
                matBlanca.opacity = w; blanca.visible = w > 0.01;
                const min = Math.round(f(2) * 5 + f(3) * 55);
                eT.setTexto(`⏱ ${min} min`); eT.setOpacidad(f(2) > 0 ? 1 : 0);
            },
        };
    },

    // ── 🍾 Huevo y botella
    huevoBotella: () => {
        const grupo = new THREE.Group();
        const perfil = [[0, 0.001], [0.36, 0.001], [0.38, 0.05], [0.38, 0.8], [0.2, 0.98], [0.105, 1.06], [0.1, 1.2], [0.12, 1.21], [0.11, 1.23]];
        const frasco = malla(new THREE.LatheGeometry(perfil.map(([x, y]) => new THREE.Vector2(x, y)), 48), M.vidrio(0.22)); frasco.renderOrder = 3; grupo.add(frasco);
        const huevo = sombra(malla(geoHuevo(0.15, 0.2), M.solido(0xfbf7ea, { roughness: 0.35 }))); grupo.add(huevo);
        const algodon = new THREE.Group(); grupo.add(algodon);
        algodon.add(malla(new THREE.IcosahedronGeometry(0.05, 1), M.solido(0xffffff)));
        const fuego = llamaSuelta(1); fuego.position.y = 0.07; algodon.add(fuego);
        const pinzas = new THREE.Group(); grupo.add(pinzas);
        [-1, 1].forEach((s) => { const b = malla(new THREE.BoxGeometry(0.015, 0.6, 0.03), M.metal()); b.position.set(s * 0.03, 0.3, 0); b.rotation.z = -s * 0.06; pinzas.add(b); });
        const humo = vapor(40, { color: 0x94a3b8, op: 0.3, alto: 0.6, ancho: 0.3, tam: 0.14, vel: 0.15 }); grupo.add(humo);
        const fl = [0, 1, 2, 3, 4].map(() => { const a = flecha(0x38bdf8); grupo.add(a); return a; });
        const flInt = flecha(0xf87171); grupo.add(flInt);
        const eAtm = etiqueta('Presión atmosférica', { color: '#7dd3fc', tam: 0.09 }); eAtm.position.set(0.7, 1.75, 0); grupo.add(eAtm);
        const eInt = etiqueta('Presión dentro ↓', { color: '#fca5a5', tam: 0.09 }); eInt.position.set(0.75, 0.55, 0); grupo.add(eInt);
        const yBoca = 1.37, mesaX = 0.85;
        return {
            grupo, camara: { pos: [0.45, 1.55, 3.4], mira: [0.25, 0.9, 0] }, dur: [3, 3, 3, 3, 3],
            update({ f, t, paso }) {
                // huevo
                let hx = mesaX, hy = 0.2, sx = 1, sy = 1;
                if (paso === 0) { const ida = tramo(f(0), 0, 0.35), vuelta = tramo(f(0), 0.7, 1); const k = ida * (1 - vuelta); hx = lerp(mesaX, 0, k); hy = lerp(0.2, yBoca, k) + Math.sin(Math.PI * k) * 0.25 * (vuelta > 0 ? 1 : 1); }
                if (paso >= 2) { const k = paso === 2 ? suave(f(2)) : 1; hx = lerp(mesaX, 0, k); hy = lerp(0.2, yBoca, k) + Math.sin(Math.PI * k) * 0.3; }
                if (paso === 3) hy = yBoca - 0.02 - 0.03 * Math.sin(f(3) * Math.PI);
                if (paso >= 4) {
                    const e = f(4);
                    if (e < 0.55) { const k = tramo(e, 0, 0.55); hy = lerp(yBoca - 0.05, 0.95, k); const dentro = Math.sin(Math.PI * k); sx = 1 - 0.32 * dentro; sy = 1 + 0.35 * dentro; }
                    else { const k = tramo(e, 0.55, 0.9); hy = lerp(0.95, 0.2, k * k) + (e > 0.9 ? Math.sin((e - 0.9) * 30) * 0.02 * (1 - e) * 10 : 0); }
                }
                huevo.position.set(hx, hy, 0); huevo.scale.set(sx, sy, sx);
                // algodón en llamas
                const ent = suave(f(1));
                algodon.visible = f(1) > 0;
                algodon.position.set(0, f(1) < 1 ? lerp(1.9, 0.35, ent) : 0.06, 0);
                const llama = f(1) > 0 ? 1 - tramo(f(2), 0.4, 1) : 0;
                fuego.set(llama * (algodon.position.y < 0.4 ? 1.4 : 1), t);
                pinzas.visible = f(1) > 0 && f(1) < 1;
                pinzas.position.set(0, algodon.position.y + 0.03, 0);
                humo.mover(t, f(2) > 0.5 ? 1 - 0.7 * f(4) : 0, { x: 0, y: 0.1, z: 0 });
                // presiones
                const pr = f(3) * (1 - tramo(f(4), 0.5, 0.8));
                fl.forEach((a, i) => {
                    const d = new THREE.Vector3(Math.sin((i - 2) * 0.55), -Math.cos((i - 2) * 0.55), 0);
                    a.poner(new THREE.Vector3(huevo.position.x - d.x * 0.5, huevo.position.y - d.y * 0.42, 0.05), d, 0.28 * pr);
                });
                flInt.poner(new THREE.Vector3(0, 0.75, 0.05), new THREE.Vector3(0, 1, 0), 0.4 * pr * (1 - 0.7 * tramo(f(3), 0, 1)));
                eAtm.setOpacidad(pr); eInt.setOpacidad(pr);
            },
        };
    },

    // ── 🧴 Botella que se aplasta
    botellaAplasta: () => {
        const grupo = new THREE.Group();
        const horn = hornillo(-1.1); grupo.add(horn.grupo);
        const cazo = olla({ r: 0.3, h: 0.3, color: 0xbfe3ff }); grupo.add(cazo.grupo);
        const vapC = vapor(40, { ancho: 0.25 }); grupo.add(vapC);
        const B = botella({ R: 0.27, hb: 0.95, rn: 0.08, ht: 1.25, color: 0xbfe3ff, op: 0.7, vidrioOp: 0.32, vidrioColor: 0xbde4ff, segmentos: 64 });
        B.grupo.position.set(0.45, 0, 0); grupo.add(B.grupo);
        const pos = B.vidrio.geometry.attributes.position; const orig = pos.array.slice();
        const tapon = malla(new THREE.CylinderGeometry(0.095, 0.095, 0.08, 20), M.solido(0x2563eb)); B.grupo.add(tapon);
        const chorro = malla(new THREE.CylinderGeometry(0.03, 0.03, 1, 8), M.liquido(0xbfe3ff, 0.8)); chorro.geometry.translate(0, 0.5, 0); grupo.add(chorro);
        const vapB = vapor(25, { ancho: 0.1, alto: 0.5 }); grupo.add(vapB);
        const fl = Array.from({ length: 6 }, () => { const a = flecha(0x38bdf8); grupo.add(a); return a; });
        const eT = etiqueta('Aire dentro: 80 °C', { color: '#fca5a5', tam: 0.09 }); eT.position.set(1.25, 1.35, 0); grupo.add(eT);
        const eP = etiqueta('Presión atmosférica', { color: '#7dd3fc', tam: 0.09 }); eP.position.set(1.25, 0.3, 0); grupo.add(eP);
        let ultimoC = -1;
        const aplastar = (c) => {
            if (Math.abs(c - ultimoC) < 0.002) return; ultimoC = c;
            for (let i = 0; i < pos.count; i++) {
                const x = orig[i * 3], y = orig[i * 3 + 1], z = orig[i * 3 + 2];
                const mask = suave((y - 0.08) / 0.15) * (1 - suave((y - 0.8) / 0.15));
                const th = Math.atan2(z, x);
                const k = 1 - c * mask * 0.55 * (0.65 + 0.35 * Math.sin(3 * th + y * 5));
                pos.array[i * 3] = x * k; pos.array[i * 3 + 2] = z * k * (1 - c * mask * 0.15);
            }
            pos.needsUpdate = true; B.vidrio.geometry.computeVertexNormals();
        };
        return {
            grupo, camara: { pos: [0, 1.6, 3.4], mira: [0, 0.6, 0] }, dur: [3, 3.5, 3, 5],
            update({ f, t }) {
                horn.setFuego(1 - tramo(f(1), 0, 0.2), t);
                const vierte = f(1) > 0 && f(1) < 1 ? Math.sin(Math.PI * tramo(f(1), 0, 0.7)) : 0;
                cazo.grupo.position.set(lerp(-1.1, 0.0, vierte), 0.13 + lerp(0, 1.05, vierte), 0); cazo.grupo.rotation.z = -1.3 * vierte;
                cazo.setNivel(0.2 * (1 - 0.7 * tramo(f(1), 0.15, 0.6)));
                vapC.mover(t, tramo(f(0), 0.3, 1) * (1 - f(1)), { x: cazo.grupo.position.x, y: cazo.grupo.position.y + 0.3, z: 0 });
                chorro.visible = vierte > 0.6; chorro.position.set(0.45, 0.1, 0); chorro.scale.y = 1.05;
                // nivel de agua caliente en la botella; luego se vacía (botella inclinada)
                const vac = f(2);
                const inclina = Math.sin(Math.PI * tramo(vac, 0, 0.6));
                B.grupo.rotation.z = 2.4 * inclina;
                B.grupo.position.y = 0.6 * inclina;
                B.setNivel(0.7 * tramo(f(1), 0.15, 0.6) * (1 - tramo(vac, 0.15, 0.5)));
                const caliente = f(1) > 0.15 ? 1 - tramo(f(3), 0, 0.9) : 0;
                B.vidrio.material.color.copy(mezclaColor(0xbde4ff, 0xffb4a2, caliente * 0.6));
                vapB.mover(t, f(1) > 0.4 && f(2) < 0.7 ? 1 : 0, { x: 0.45, y: 1.25, z: 0 });
                tapon.visible = vac > 0.7; tapon.position.y = lerp(1.6, 1.27, tramo(vac, 0.7, 0.95));
                const c = tramo(f(3), 0.1, 1);
                aplastar(c);
                const pa = f(3) > 0 ? 1 : 0;
                fl.forEach((a, i) => {
                    const ang = (i / 6) * Math.PI * 2 + 0.3;
                    const y = 0.3 + (i % 3) * 0.22;
                    const d = new THREE.Vector3(-Math.cos(ang), 0, -Math.sin(ang));
                    a.poner(new THREE.Vector3(0.45 + Math.cos(ang) * 0.62, y, Math.sin(ang) * 0.62), d, 0.3 * pa);
                });
                const temp = Math.round(lerp(80, 20, tramo(f(3), 0, 0.9)) / 5) * 5;
                eT.setTexto(`Aire dentro: ${temp} °C`); eT.setOpacidad(f(2) > 0.7 ? 1 : 0);
                eP.setOpacidad(pa);
            },
        };
    },

    // ── 🧪 Ludión
    ludion: () => {
        const grupo = new THREE.Group();
        const B = botella({ R: 0.32, hb: 1.45, rn: 0.1, ht: 1.85, color: 0x9fd8ff, op: 0.45, vidrioOp: 0.25 });
        grupo.add(B.grupo);
        const tapon = malla(new THREE.CylinderGeometry(0.11, 0.11, 0.1, 20), M.solido(0x16a34a), 0, 1.88, 0); grupo.add(tapon);
        const lud = new THREE.Group(); grupo.add(lud);
        lud.add(malla(new THREE.CylinderGeometry(0.04, 0.04, 0.34, 16, 1, true), M.vidrio(0.5, 0xffffff)));
        lud.add(malla(new THREE.SphereGeometry(0.04, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.vidrio(0.5, 0xffffff), 0, 0.17, 0));
        const lastre = malla(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 12), M.metal(0x6b7280), 0, -0.11, 0); lud.add(lastre);
        const aire = malla(new THREE.CylinderGeometry(0.034, 0.034, 1, 14), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, roughness: 0.1, emissive: 0x334155 })); aire.geometry.translate(0, -0.5, 0); aire.position.y = 0.19; lud.add(aire);
        const aguaL = malla(new THREE.CylinderGeometry(0.034, 0.034, 1, 14), M.liquido(0x5bb8ff, 0.8)); aguaL.geometry.translate(0, 0.5, 0); aguaL.position.y = -0.06; lud.add(aguaL);
        const manos = [-1, 1].map((s) => { const m = malla(new THREE.SphereGeometry(0.17, 20, 14), M.solido(0xf1c27d)); m.scale.set(0.6, 1.3, 1); grupo.add(m); m.userData.s = s; return m; });
        const fl = [-1, 1].map(() => { const a = flecha(0xf87171); grupo.add(a); return a; });
        const eP = etiqueta('Presión ↑ → el aire se comprime', { color: '#fecaca', tam: 0.08 }); eP.position.set(0, 2.15, 0); grupo.add(eP);
        let y = 1.55;
        return {
            grupo, camara: { pos: [0.4, 1.35, 4.3], mira: [0.1, 1.05, 0] }, dur: [3, 3, 4, 4],
            update({ f, paso, dt, params, captura }) {
                const prep = f(0);
                lastre.position.y = lerp(0.35, -0.11, tramo(prep, 0.2, 0.8));
                B.setNivel(1.8 * tramo(f(1), 0, 0.6));
                tapon.visible = f(1) > 0.9;
                let s;
                if (paso >= 2 && params.apretar != null) s = params.apretar / 100;
                else s = paso === 2 ? tramo(f(2), 0, 0.4) : paso >= 3 ? 1 - tramo(f(3), 0, 0.3) : 0;
                // el aire del ludión se comprime con la presión
                const hAire = lerp(0.2, 0.08, s);
                aire.scale.y = hAire; aguaL.scale.y = Math.max(0.001, 0.25 - hAire);
                B.grupo.scale.set(1 - 0.12 * s, 1, 1 - 0.05 * s);
                manos.forEach((m) => { m.visible = s > 0.02; m.position.set(m.userData.s * (0.32 * (1 - 0.12 * s) + 0.1), 0.8, 0); });
                fl.forEach((a, i) => { const sg = i ? 1 : -1; a.poner(new THREE.Vector3(sg * 0.6, 1.0, 0.05), new THREE.Vector3(-sg, 0, 0), 0.25 * s); });
                eP.setOpacidad(s > 0.3 ? 1 : 0);
                // posición: fuera de la botella (paso 0) → arriba → baja si s > 0.5
                if (paso === 0 || (paso === 1 && f(1) < 0.6)) {
                    const k = paso === 0 ? 0 : tramo(f(1), 0.2, 0.6);
                    lud.position.set(lerp(0.9, 0, k), lerp(0.23, 2.1, Math.sin(Math.PI / 2 * k)), 0); lud.rotation.z = lerp(Math.PI / 2, 0, k);
                    y = 1.55; if (paso === 0) { lud.position.set(0.9, 0.05, 0); lud.rotation.z = Math.PI / 2; }
                } else {
                    lud.rotation.z = 0;
                    const objetivo = s > 0.5 ? 0.26 : 1.55;
                    if (captura) y = objetivo; else { const v = 1.2 * dt; y += Math.max(-v, Math.min(v, objetivo - y)); }
                    lud.position.set(0, y, 0);
                }
            },
        };
    },

    // ── 🧂 ¿Flota o se hunde?
    flota: () => {
        const grupo = new THREE.Group();
        const X = [-0.95, 0, 0.95];
        const V = X.map((x) => { const v = vaso({ r: 0.36, h: 1.0, color: 0xb9e2ff, op: 0.45 }); v.grupo.position.x = x; grupo.add(v.grupo); return v; });
        const H = X.map((x) => { const h = sombra(malla(geoHuevo(0.15, 0.2), M.solido(0xe8c9a0))); h.position.set(x, 1.6, 0); grupo.add(h); return h; });
        const sal = particulas(60, { color: 0xffffff, tam: 0.035, op: 0.95 }); grupo.add(sal);
        const cuchara = new THREE.Group(); grupo.add(cuchara);
        cuchara.add(malla(new THREE.CylinderGeometry(0.012, 0.012, 0.8, 8), M.metal(), 0, 0.4, 0));
        cuchara.add(malla(new THREE.SphereGeometry(0.05, 12, 8), M.metal())).scale.set(1, 0.4, 1.4);
        const eV = ['Agua', 'Agua con sal', 'Tercer vaso'].map((t, i) => { const e = etiqueta(t, { tam: 0.08 }); e.position.set(X[i], 1.15, 0); grupo.add(e); return e; });
        const eRho = etiqueta('ρ = 1,00 g/cm³', { color: '#a5f3fc', tam: 0.085 }); eRho.position.set(X[2], 1.3, 0); grupo.add(eRho);
        const P = X.map(() => { const a = flecha(0xf87171); grupo.add(a); return a; });
        const E = X.map(() => { const a = flecha(0x4ade80); grupo.add(a); return a; });
        const eF = etiqueta('Empuje ↑   Peso ↓', { tam: 0.08 }); eF.position.set(0, 1.45, 0); grupo.add(eF);
        const nivel = 0.78, yFondo = 0.04 + 0.2 * 0.98, yFlota = 0.04 + nivel - 0.08;
        let yC = yFondo;
        return {
            grupo, camara: { pos: [0, 1.5, 3.4], mira: [0, 0.55, 0] }, dur: [2.5, 4, 2.5, 2.5, 3],
            update({ f, t, dt, params, captura, paso }) {
                V[0].setNivel(nivel * tramo(f(0), 0, 1)); V[1].setNivel(nivel * tramo(f(0), 0, 1));
                V[2].setNivel(paso >= 4 ? nivel : 0); V[2].grupo.visible = paso >= 4; eV[2].setOpacidad(paso >= 4 ? 1 : 0);
                // sal en el vaso 2
                const s = f(1);
                cuchara.visible = s > 0 && s < 1;
                cuchara.position.set(X[1] + (s > 0.5 ? Math.cos(t * 9) * 0.15 : 0), s > 0.5 ? 0.3 : 1.2, s > 0.5 ? Math.sin(t * 9) * 0.15 : 0);
                cuchara.rotation.z = s > 0.5 ? 0.25 : 0;
                sal.actualizar((i, s1, s2) => (s > 0.05 && s < 0.55 ? [X[1] + (s1 - 0.5) * 0.15, 1.15 - ((t * 0.8 + s2) % 1) * 0.6, (s2 - 0.5) * 0.15] : null));
                V[1].setColor(mezclaColor(0xb9e2ff, 0xe5f1f8, Math.sin(Math.PI * tramo(s, 0.4, 1)) * 0.9 + (s >= 1 ? 0.25 : 0)));
                // huevos A y B
                const caer = (k, yFin) => (f(k) > 0 ? lerp(1.6, yFin, tramo(f(k), 0, 0.7)) + (f(k) > 0.7 ? Math.sin((f(k) - 0.7) * 25) * 0.03 * (1 - f(k)) : 0) : 1.6);
                H[0].visible = f(2) > 0; H[0].position.y = caer(2, yFondo);
                H[1].visible = f(3) > 0; H[1].position.y = caer(3, yFlota);
                // tercer vaso: densidad según la sal
                H[2].visible = paso >= 4;
                const c = params.sal ?? 45;
                const rho = 1 + 0.0007 * c;
                const objetivo = rho < 1.026 ? yFondo : rho > 1.034 ? yFlota : lerp(yFondo + 0.1, yFlota - 0.1, (rho - 1.026) / 0.008);
                if (paso >= 4) {
                    if (captura || f(4) < 0.7) yC = lerp(1.6, objetivo, tramo(f(4), 0, 0.7));
                    else { const v = 0.6 * dt; yC += Math.max(-v, Math.min(v, objetivo - yC)); }
                    H[2].position.y = yC;
                }
                eRho.setTexto(`ρ agua = ${rho.toFixed(2).replace('.', ',')} g/cm³`); eRho.setOpacidad(paso >= 4 ? 1 : 0);
                V[2].setColor(mezclaColor(0xb9e2ff, 0xe5f1f8, c / 350));
                // fuerzas
                const fuerzas = (i, emp, vis) => {
                    const h = H[i].position;
                    P[i].poner(new THREE.Vector3(h.x + 0.24, h.y, 0.1), new THREE.Vector3(0, -1, 0), vis ? 0.25 : 0);
                    E[i].poner(new THREE.Vector3(h.x + 0.3, h.y, 0.1), new THREE.Vector3(0, 1, 0), vis ? 0.25 * emp : 0);
                };
                fuerzas(0, 0.97, f(2) >= 1);
                fuerzas(1, 1, f(3) >= 1);
                const emp2 = Math.abs(yC - yFlota) < 0.01 ? 1 : Math.min(1.25, rho / 1.03);
                fuerzas(2, emp2, paso >= 4 && f(4) >= 0.7);
                eF.setOpacidad(f(2) >= 1 ? 1 : 0);
            },
        };
    },

    // ── 🪙 Moneda (refracción) — vista en corte
    moneda: () => {
        const grupo = new THREE.Group();
        const R = 0.45, Hm = 0.55, n = 1.33;
        const perfil = [[0, 0.001], [R, 0.001], [R, Hm], [R - 0.04, Hm], [R - 0.04, 0.03], [0, 0.03]].map(([x, y]) => new THREE.Vector2(x, y));
        const taza = sombra(malla(new THREE.LatheGeometry(perfil, 48, Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ color: 0xe76f51, roughness: 0.45, side: THREE.DoubleSide })));
        grupo.add(taza);
        // borde cercano en corte (para ver qué tapa)
        const corte = malla(new THREE.BoxGeometry(0.04, Hm, 0.02), M.solido(0xb4533a), R - 0.02, Hm / 2, 0); grupo.add(corte);
        const corte2 = corte.clone(); corte2.position.x = -R + 0.02; grupo.add(corte2);
        const geoA = new THREE.CylinderGeometry(R - 0.045, R - 0.045, 1, 40, 1, false, Math.PI / 2, Math.PI); geoA.translate(0, 0.5, 0);
        const agua = malla(geoA, M.liquido(0x7cc4ff, 0.45), 0, 0.03, 0); agua.renderOrder = 2; grupo.add(agua);
        const moneda = malla(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 32), M.metal(0xd4a017), -0.2, 0.04, 0); grupo.add(moneda);
        const fantasma = malla(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 32), new THREE.MeshStandardMaterial({ color: 0xfacc15, transparent: true, opacity: 0.45, emissive: 0x6b4f00 })); grupo.add(fantasma);
        const ojo = etiqueta('👁', { fondo: 'rgba(255,255,255,0.9)', tam: 0.2, color: '#0f172a' }); grupo.add(ojo);
        const rayoRecto = linea(0xef4444, 2); grupo.add(rayoRecto);
        const rayoAgua = linea(0x22c55e, 3); grupo.add(rayoAgua);
        const rayoVirtual = linea(0xfacc15, 2); rayoVirtual.material.opacity = 0.6; grupo.add(rayoVirtual);
        const eVe = etiqueta('', { tam: 0.09 }); eVe.position.set(1.2, 1.95, 0); grupo.add(eVe);
        const eImg = etiqueta('imagen (parece más arriba)', { tam: 0.07, color: '#fde68a' }); grupo.add(eImg);
        const xc = -0.2, yc = 0.05, xe = 2.0;
        const resolver = (h, ye) => {
            const fn = (xs) => Math.sin(Math.atan2(xe - xs, ye - h)) - n * Math.sin(Math.atan2(xs - xc, h - yc));
            let a = xc, b = R; for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (fn(a) * fn(m) <= 0) b = m; else a = m; }
            return (a + b) / 2;
        };
        return {
            grupo, camara: { pos: [0.9, 1.4, 4.2], mira: [0.8, 0.95, 0] }, dur: [2.5, 3, 4, 3],
            update({ f }) {
                const ye = lerp(2.3, 1.5, tramo(f(1), 0, 1));
                ojo.position.set(xe, ye, 0);
                const nivel = 0.5 * tramo(f(2), 0, 1);
                agua.visible = nivel > 0.01; agua.scale.y = Math.max(0.001, nivel);
                const C = new THREE.Vector3(xc, yc, 0), E = new THREE.Vector3(xe, ye, 0);
                // rayo recto: ¿lo tapa el borde?
                const yBorde = yc + (ye - yc) * (R - xc) / (xe - xc);
                const tapado = yBorde < Hm;
                if (nivel < 0.06) {
                    rayoAgua.setOpacidad(0); fantasma.visible = false; eImg.setOpacidad(0);
                    rayoRecto.setOpacidad(1);
                    rayoRecto.material.color.set(tapado ? 0xef4444 : 0x22c55e);
                    rayoRecto.poner(C, tapado ? new THREE.Vector3(R, yBorde, 0) : E);
                    eVe.setTexto(tapado ? '✗ El borde tapa la moneda' : '✓ Ves la moneda');
                } else {
                    const xs = resolver(nivel + 0.03, ye);
                    const S = new THREE.Vector3(xs, nivel + 0.03, 0);
                    const yEnBorde = S.y + (ye - S.y) * (R - xs) / (xe - xs);
                    const ve = yEnBorde > Hm;
                    rayoRecto.setOpacidad(0.35); rayoRecto.material.color.set(0xef4444); rayoRecto.poner(C, new THREE.Vector3(R, yBorde, 0));
                    rayoAgua.setOpacidad(1); rayoAgua.material.color.set(ve ? 0x22c55e : 0xf97316);
                    rayoAgua.poner(C, S, ve ? E : new THREE.Vector3(R, yEnBorde, 0));
                    // imagen virtual: prolongación del rayo que llega al ojo hasta la vertical de la moneda
                    const dir = S.clone().sub(E).normalize();
                    const k = (xc - E.x) / dir.x; const V = E.clone().add(dir.multiplyScalar(k));
                    fantasma.visible = ve && f(3) > 0; fantasma.position.set(xc, V.y, 0);
                    rayoVirtual.setOpacidad(ve && f(3) > 0 ? 0.7 : 0); rayoVirtual.poner(S, V);
                    eImg.position.set(xc - 0.1, V.y + 0.18, 0); eImg.setOpacidad(ve && f(3) > 0 ? 1 : 0);
                    eVe.setTexto(ve ? '✓ ¡La luz se desvía y la ves!' : 'Llenando…');
                }
            },
        };
    },

    // ── ⚡ El agua y el peine
    peine: () => {
        const grupo = new THREE.Group();
        const fregadero = sombra(malla(new THREE.BoxGeometry(1.6, 0.15, 1.0), M.metal(0x9aa4b1), 0, 0.075, 0)); grupo.add(fregadero);
        const grifo = new THREE.Group(); grupo.add(grifo);
        grifo.add(sombra(malla(new THREE.CylinderGeometry(0.05, 0.06, 1.7, 16), M.metal(), 0, 0.85, -0.45)));
        const caño = malla(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 16), M.metal(), 0, 1.72, -0.22); caño.rotation.x = Math.PI / 2; grifo.add(caño);
        grifo.add(malla(new THREE.CylinderGeometry(0.045, 0.035, 0.08, 16), M.metal(), 0, 1.68, 0));
        const lana = new THREE.Group(); lana.position.set(-1.25, 0.12, 0.2); grupo.add(lana);
        for (let i = 0; i < 18; i++) { const b = malla(new THREE.SphereGeometry(0.09, 10, 8), M.solido(0xdc2626, { roughness: 1 })); b.position.set((i % 6) * 0.1 - 0.25, 0, Math.floor(i / 6) * 0.1 - 0.1); b.scale.y = 0.6; lana.add(b); }
        const peine = new THREE.Group(); grupo.add(peine);
        peine.add(malla(new THREE.BoxGeometry(0.5, 0.06, 0.02), M.solido(0x111827, { roughness: 0.3 }), 0, 0.03, 0));
        for (let i = 0; i < 20; i++) peine.add(malla(new THREE.BoxGeometry(0.012, 0.09, 0.015), M.solido(0x111827, { roughness: 0.3 }), -0.235 + i * 0.0247, -0.045, 0));
        const cargas = Array.from({ length: 6 }, (_, i) => { const e = etiqueta('−', { fondo: 'rgba(37,99,235,0.9)', tam: 0.07 }); e.position.set(-0.2 + i * 0.08, 0.12, 0.03); peine.add(e); return e; });
        const cargasAgua = Array.from({ length: 4 }, () => { const e = etiqueta('+', { fondo: 'rgba(220,38,38,0.9)', tam: 0.06 }); grupo.add(e); return e; });
        const geoTubo = { actual: null };
        const matAgua = new THREE.MeshStandardMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.7, roughness: 0.05 });
        const chorro = new THREE.Mesh(new THREE.BufferGeometry(), matAgua); grupo.add(chorro);
        const gotas = particulas(50, { color: 0xdbeafe, tam: 0.03, op: 0.9 }); grupo.add(gotas);
        const yT = 1.64, yF = 0.16;
        const dx = (y, bend) => { const u = clamp01((yT - y) / (yT - yF)); return bend * 0.5 * Math.pow(u, 1.6); };
        let ultimoBend = -1;
        const tubo = (bend, caudal) => {
            const k = `${bend.toFixed(3)}|${caudal.toFixed(2)}`; if (k === ultimoBend) return; ultimoBend = k;
            const pts = []; for (let i = 0; i <= 30; i++) { const y = lerp(yT, yF, i / 30); pts.push(new THREE.Vector3(dx(y, bend), y, 0)); }
            if (geoTubo.actual) geoTubo.actual.dispose();
            geoTubo.actual = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.018 * caudal + 0.001, 8, false);
            chorro.geometry = geoTubo.actual;
        };
        return {
            grupo, camara: { pos: [-0.2, 1.3, 2.9], mira: [-0.2, 0.9, 0] }, dur: [2, 4, 3.5],
            update({ f, t }) {
                const caudal = tramo(f(0), 0, 0.6);
                const frota = f(1);
                // peine: frotando en la lana → junto al chorro
                const acerca = suave(f(2));
                if (f(2) === 0) {
                    peine.position.set(-1.25 + (frota > 0 && frota < 1 ? Math.sin(frota * 50) * 0.18 : 0), 0.26, 0.2); peine.rotation.set(Math.PI / 2, 0, 0);
                } else {
                    peine.position.set(lerp(-1.25, 0.34, acerca), lerp(0.26, 0.9, acerca), lerp(0.2, 0, acerca)); peine.rotation.set(lerp(Math.PI / 2, 0, acerca), 0, lerp(0, -Math.PI / 2, acerca));
                }
                const nCargas = Math.round(6 * tramo(frota, 0.1, 0.9));
                cargas.forEach((e, i) => e.setOpacidad(i < nCargas ? 1 : 0));
                const bend = tramo(f(2), 0.4, 1);
                chorro.visible = caudal > 0.02;
                tubo(bend, caudal);
                gotas.actualizar((i, s1, s2, s3) => {
                    if (caudal < 0.5 || s3 > 0.7) return null;
                    const y = lerp(yT, yF, (t * 1.6 + s1) % 1);
                    return [dx(y, bend) + (s2 - 0.5) * 0.02, y, (s3 - 0.5) * 0.02];
                });
                cargasAgua.forEach((e, i) => { const y = 0.98 - i * 0.07; e.position.set(dx(y, bend) + 0.06, y, 0.05); e.setOpacidad(bend > 0.3 ? 1 : 0); });
            },
        };
    },

    // ── 📍 Aguja que flota (tensión superficial)
    aguja: () => {
        const grupo = new THREE.Group();
        const R = 0.8, hv = 0.35, nivel = 0.27;
        const vid = malla(new THREE.LatheGeometry([[0, 0.001], [R, 0.001], [R, hv], [R - 0.02, hv], [R - 0.02, 0.03], [0, 0.03]].map(([x, y]) => new THREE.Vector2(x, y)), 64), M.vidrio(0.22)); vid.renderOrder = 3; grupo.add(vid);
        const cuerpo = malla(new THREE.CylinderGeometry(R - 0.025, R - 0.025, nivel - 0.03, 64, 1, true), M.liquido(0x9fd8ff, 0.4), 0, 0.03 + (nivel - 0.03) / 2, 0); cuerpo.renderOrder = 2; grupo.add(cuerpo);
        const geoSup = new THREE.PlaneGeometry(2 * (R - 0.025), 2 * (R - 0.025), 80, 80); geoSup.rotateX(-Math.PI / 2);
        const sp = geoSup.attributes.position; const base = sp.array.slice();
        for (let i = 0; i < sp.count; i++) { const x = base[i * 3], z = base[i * 3 + 2]; const d = Math.hypot(x, z); if (d > R - 0.025) { const k = (R - 0.025) / d; base[i * 3] = x * k; base[i * 3 + 2] = z * k; } }
        sp.array.set(base); sp.needsUpdate = true;
        const sup = malla(geoSup, new THREE.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.55, roughness: 0.02, metalness: 0.1, envMapIntensity: 2 }), 0, nivel, 0); sup.renderOrder = 4; grupo.add(sup);
        const papel = malla(new THREE.PlaneGeometry(0.4, 0.4), new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 1, transparent: true })); papel.rotation.x = -Math.PI / 2; grupo.add(papel);
        const alfiler = new THREE.Group(); grupo.add(alfiler);
        const cuerpoA = malla(new THREE.CylinderGeometry(0.006, 0.006, 0.36, 8), M.metal(0xd1d5db)); cuerpoA.rotation.z = Math.PI / 2; alfiler.add(cuerpoA);
        alfiler.add(malla(new THREE.SphereGeometry(0.018, 12, 8), M.metal(0x9ca3af), -0.18, 0, 0));
        const palillo = malla(new THREE.CylinderGeometry(0.008, 0.008, 0.6, 8), M.solido(0xd6a86b)); grupo.add(palillo);
        const cg = cuentagotas(0xfde68a); cg.position.set(0.45, 0.7, 0.2); grupo.add(cg);
        const eT = etiqueta('tensión superficial', { color: '#bae6fd', tam: 0.07 }); eT.position.set(0, nivel + 0.25, 0); grupo.add(eT);
        const eJ = etiqueta('jabón', { tam: 0.07, color: '#fde68a' }); eJ.position.set(0.45, 1.05, 0.2); grupo.add(eJ);
        let ultimaHondura = -1;
        const hoyuelo = (h) => {
            if (Math.abs(h - ultimaHondura) < 0.0005) return; ultimaHondura = h;
            for (let i = 0; i < sp.count; i++) {
                const x = base[i * 3], z = base[i * 3 + 2];
                const dxl = Math.max(0, Math.abs(x) - 0.18); const d2 = dxl * dxl + z * z;
                sp.array[i * 3 + 1] = -h * Math.exp(-d2 / 0.0025);
            }
            sp.needsUpdate = true; geoSup.computeVertexNormals();
        };
        return {
            grupo, camara: { pos: [0.3, 1.2, 1.8], mira: [0, 0.25, 0] }, dur: [2, 2, 4, 3, 3.5],
            camaraPaso: (paso) => (paso === 3 ? { pos: [0.25, 0.48, 0.75], mira: [0, nivel, 0] } : null),
            update({ f }) {
                papel.position.set(0, lerp(0.9, nivel + 0.004, suave(f(0))), 0);
                const hunde = tramo(f(2), 0.3, 1);
                papel.position.y = f(2) > 0 ? lerp(nivel + 0.004, 0.05, hunde) : papel.position.y;
                papel.rotation.y = hunde * 0.6; papel.material.color.copy(mezclaColor(0xffffff, 0xcbd5e1, tramo(f(2), 0, 0.3)));
                papel.material.opacity = 1 - 0.3 * hunde;
                const pon = suave(f(1));
                const jab = f(4); const cae = tramo(jab, 0.45, 0.9);
                alfiler.visible = f(1) > 0;
                const hondo = f(2) >= 1 && cae < 0.05 ? 0.012 * (f(3) > 0 ? 1.4 : 1) : 0;
                alfiler.position.set(0, f(1) < 1 ? lerp(0.8, nivel + 0.01, pon) : lerp(nivel + 0.004 - hondo, 0.045, cae), 0);
                alfiler.rotation.z = cae * 0.3;
                palillo.visible = f(2) > 0 && f(2) < 1;
                palillo.position.set(0.22 + Math.sin(f(2) * 20) * 0.03, nivel + 0.27 - 0.05 * hunde, 0.18); palillo.rotation.z = 0.5;
                hoyuelo(hondo);
                eT.setOpacidad(f(3) > 0 && jab < 0.4 ? 1 : 0);
                cg.visible = jab > 0 && jab < 1; eJ.setOpacidad(cg.visible ? 1 : 0);
                cg.gota.position.y = lerp(-0.02, nivel - 0.7, tramo(jab, 0.1, 0.4)); cg.gota.visible = jab < 0.4;
            },
        };
    },

    // ── 🌀 Huevo crudo o cocido
    huevoCrudo: () => {
        const grupo = new THREE.Group();
        const mk = (x, colorPunto) => {
            const piv = new THREE.Group(); piv.position.set(x, 0.2, 0); grupo.add(piv);
            const inc = new THREE.Group(); piv.add(inc);
            const h = sombra(malla(geoHuevo(0.2, 0.27), M.solido(0xf3e2c7))); h.rotation.z = Math.PI / 2; inc.add(h);
            const punto = malla(new THREE.SphereGeometry(0.035, 12, 8), M.solido(colorPunto), 0.12, 0.17, 0); inc.add(punto);
            return { piv, inc };
        };
        const A = mk(-0.6, 0xef4444), B = mk(0.6, 0x3b82f6);
        const eA = etiqueta('Huevo A', { tam: 0.1 }); eA.position.set(-0.6, 0.7, 0); grupo.add(eA);
        const eB = etiqueta('Huevo B', { tam: 0.1 }); eB.position.set(0.6, 0.7, 0); grupo.add(eB);
        const dedo = malla(new THREE.CapsuleGeometry(0.05, 0.3, 6, 12), M.solido(0xf1c27d)); grupo.add(dedo);
        const dedo2 = dedo.clone(); grupo.add(dedo2);
        const D = 5; // segundos simulados por paso
        // ángulos (deterministas): cocido rápido y uniforme; crudo lento y bailando
        const angCocido1 = (s) => 14 * s - 0.4 * s * s;
        const angCrudo1 = (s) => 5 * s - 0.25 * s * s + 0.7 * Math.sin(s * 3.3);
        return {
            grupo, camara: { pos: [0, 1.4, 2.4], mira: [0, 0.2, 0] }, dur: [1.5, D, D],
            update({ f, t }) {
                let aA = 0, aB = 0, wobA = 0;
                if (f(1) > 0) { const s = f(1) * D; aB = angCocido1(s); aA = angCrudo1(s); wobA = 0.12 * Math.sin(s * 7); }
                if (f(2) > 0) {
                    const s = f(2) * D; const fin1A = angCrudo1(D), fin1B = angCocido1(D);
                    // 0–1,2 s sigue girando; 1,2–2,2 s dedo; después el crudo vuelve a girar
                    const s1 = Math.min(s, 1.2);
                    aB = fin1B + 9 * s1; aA = fin1A + 3 * s1 + 0.5 * Math.sin(s1 * 3);
                    if (s > 2.2) { const r = s - 2.2; aA += 2.5 * r - 0.35 * r * r * (r < 3.5 ? 1 : 1); wobA = 0.08 * Math.sin(r * 6) * Math.max(0, 1 - r / 3); }
                    const bajo = s > 1.2 && s < 2.2;
                    [dedo, dedo2].forEach((d, i) => { d.visible = s > 0.8 && s < 2.6; d.position.set(i ? 0.6 : -0.6, bajo ? 0.52 : 0.8, 0.05); });
                } else { dedo.visible = dedo2.visible = false; }
                A.piv.rotation.y = aA; B.piv.rotation.y = aB; A.inc.rotation.x = wobA;
                const revela = f(2) > 0.85;
                eA.setTexto(revela ? 'A: crudo' : 'Huevo A'); eB.setTexto(revela ? 'B: cocido' : 'Huevo B');
                void t;
            },
        };
    },
};

// ───────────────────────── motor ─────────────────────────
export function crearLaboratorio(contenedor, { interactivo = true, ancho, alto } = {}) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: !interactivo });
    renderer.setPixelRatio(interactivo ? Math.min(window.devicePixelRatio || 1, 2) : 1);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    contenedor.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1c2638);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env; scene.environmentIntensity = 0.55;

    const camara = new THREE.PerspectiveCamera(40, 1, 0.05, 60);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x3b4252, 1.1));
    const sol = new THREE.DirectionalLight(0xffffff, 2.2); sol.position.set(2.5, 5, 3.5); sol.castShadow = true;
    sol.shadow.mapSize.set(1024, 1024); Object.assign(sol.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 15 }); sol.shadow.bias = -0.0005;
    scene.add(sol);

    // mesa de laboratorio y pared con azulejos
    const mesa = new THREE.Mesh(new THREE.BoxGeometry(7, 0.2, 3.4), new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 }));
    mesa.position.set(0, -0.1, 0); mesa.receiveShadow = true; scene.add(mesa);
    const borde = new THREE.Mesh(new THREE.BoxGeometry(7.05, 0.04, 3.45), new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 })); borde.position.y = -0.21; scene.add(borde);
    const cvP = document.createElement('canvas'); cvP.width = cvP.height = 128;
    const gp = cvP.getContext('2d'); gp.fillStyle = '#e2e8f0'; gp.fillRect(0, 0, 128, 128); gp.strokeStyle = '#cbd5e1'; gp.lineWidth = 4; gp.strokeRect(0, 0, 128, 128);
    const txP = new THREE.CanvasTexture(cvP); txP.wrapS = txP.wrapT = THREE.RepeatWrapping; txP.repeat.set(14, 6); txP.colorSpace = THREE.SRGBColorSpace;
    const pared = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), new THREE.MeshStandardMaterial({ map: txP, roughness: 0.8, color: 0x8da2bb }));
    pared.position.set(0, 2.6, -1.75); pared.receiveShadow = true; scene.add(pared);

    let controles = null;
    if (interactivo) {
        controles = new OrbitControls(camara, renderer.domElement);
        controles.enableDamping = true; controles.dampingFactor = 0.08;
        controles.minDistance = 0.4; controles.maxDistance = 9; controles.maxPolarAngle = Math.PI * 0.49;
        controles.addEventListener('start', () => { tweenCam = null; });
    }

    let inst = null, paso = 0, p = 1, dur = 3, params = {}, t = 0, tweenCam = null, alAcabar = null;
    let antes = 0;
    const f = (k) => (paso > k ? 1 : paso < k ? 0 : p);

    const tamaño = () => {
        const w = ancho || contenedor.clientWidth || 800, h = alto || contenedor.clientHeight || 500;
        renderer.setSize(w, h, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
        camara.aspect = w / h; camara.updateProjectionMatrix();
    };
    tamaño();
    const ro = interactivo && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(tamaño) : null;
    if (ro) ro.observe(contenedor);

    const liberar = (obj) => obj.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        mats.forEach((m) => { if (m.map && m.map !== texDisco) m.map.dispose(); m.dispose(); });
    });

    const ponerCamara = (c) => { camara.position.set(...c.pos); if (controles) controles.target.set(...c.mira); camara.lookAt(...c.mira); };
    const camaraDe = (k) => (inst?.camaraPaso?.(k)) || inst?.camara;

    const api = {
        cargar(id) {
            if (inst) { scene.remove(inst.grupo); liberar(inst.grupo); }
            const crear = ESCENAS[id]; if (!crear) { inst = null; return; }
            inst = crear();
            todos(inst.grupo, (m) => { if (!m.material?.transparent) { m.castShadow = true; m.receiveShadow = true; } });
            scene.add(inst.grupo);
            paso = 0; p = 0; dur = inst.dur?.[0] ?? 3; params = {}; tweenCam = null;
            ponerCamara(inst.camara);
            inst.update({ f, paso, p, t, dt: 0, params, captura: true });
        },
        irAPaso(k, { animar = true } = {}) {
            if (!inst) return;
            const antes = camaraDe(paso);
            paso = k; p = animar ? 0 : 1; dur = inst.dur?.[k] ?? 3;
            const c = camaraDe(k);
            if (c && c !== antes) tweenCam = { de: { pos: camara.position.clone(), mira: controles ? controles.target.clone() : new THREE.Vector3(...c.mira) }, a: c, u: 0 };
        },
        repetir() { p = 0; },
        get paso() { return paso; },
        get avance() { return p; },
        setParam(k, v) { params = { ...params, [k]: v }; },
        alAcabarPaso(fn) { alAcabar = fn; },
        reencuadrar() { if (inst) { tweenCam = null; ponerCamara(camaraDe(paso)); } },
        // Dibuja el paso k en su estado final y devuelve la imagen (JPEG)
        capturar(k, calidad = 0.85) {
            if (!inst) return null;
            const guardado = { paso, p, pos: camara.position.clone(), mira: controles?.target.clone() };
            paso = k; p = 1;
            inst.update({ f, paso, p, t: 1.3 + k * 0.37, dt: 0, params, captura: true });
            ponerCamara(camaraDe(k));
            renderer.render(scene, camara);
            const url = renderer.domElement.toDataURL('image/jpeg', calidad);
            paso = guardado.paso; p = guardado.p;
            camara.position.copy(guardado.pos); if (controles && guardado.mira) controles.target.copy(guardado.mira);
            return url;
        },
        destruir() {
            cancelAnimationFrame(raf); ro?.disconnect(); controles?.dispose();
            if (inst) liberar(inst.grupo);
            liberar(scene); env.dispose(); pmrem.dispose(); renderer.dispose();
            renderer.domElement.remove();
        },
    };

    let raf = 0;
    const bucle = () => {
        raf = requestAnimationFrame(bucle);
        const ahora = performance.now(); const dt = antes ? Math.min(0.05, (ahora - antes) / 1000) : 0; antes = ahora; t += dt;
        if (inst) {
            if (p < 1) { p = Math.min(1, p + dt / dur); if (p >= 1 && alAcabar) alAcabar(paso); }
            inst.update({ f, paso, p, t, dt, params, captura: false });
        }
        if (tweenCam) {
            tweenCam.u = Math.min(1, tweenCam.u + dt / 1.4); const u = suave(tweenCam.u);
            camara.position.lerpVectors(tweenCam.de.pos, new THREE.Vector3(...tweenCam.a.pos), u);
            const m = tweenCam.de.mira.clone().lerp(new THREE.Vector3(...tweenCam.a.mira), u);
            if (controles) controles.target.copy(m); camara.lookAt(m);
            if (tweenCam.u >= 1) tweenCam = null;
        }
        controles?.update();
        renderer.render(scene, camara);
    };
    if (interactivo) bucle();
    return api;
}
