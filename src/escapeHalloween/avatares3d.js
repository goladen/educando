// ═══════════════════════════════════════════════════════════════════
//  AVATARES 3D DISFRAZADOS DE HALLOWEEN (three.js, todo con primitivas)
//  crearAvatar3D({ disfraz, color, accesorio }) → THREE.Group con los pies en y = 0
//  y una altura de ~1,8 unidades. group.userData.animar(t, andando) mueve brazos y piernas.
//  crearZombiJefe() → el zombi de la batalla final.
// ═══════════════════════════════════════════════════════════════════
import * as THREE from 'three';

export const DISFRACES = [
    { id: 'FANTASMA', nombre: 'Fantasma', emoji: '👻', color: '#f8fafc' },
    { id: 'VAMPIRO', nombre: 'Vampiro', emoji: '🧛', color: '#b91c1c' },
    { id: 'BRUJA', nombre: 'Bruja', emoji: '🧙‍♀️', color: '#7c3aed' },
    { id: 'CALABAZA', nombre: 'Calabaza', emoji: '🎃', color: '#16a34a' },
    { id: 'ESQUELETO', nombre: 'Esqueleto', emoji: '💀', color: '#111827' },
    { id: 'MOMIA', nombre: 'Momia', emoji: '🧻', color: '#e7dcc0' },
    { id: 'LOBO', nombre: 'Hombre lobo', emoji: '🐺', color: '#7c4a24' },
    { id: 'DIABLO', nombre: 'Diablillo', emoji: '😈', color: '#dc2626' },
    { id: 'FRANKENSTEIN', nombre: 'Frankenstein', emoji: '🧟‍♂️', color: '#334155' },
    { id: 'GATO', nombre: 'Gato negro', emoji: '🐈‍⬛', color: '#18181b' },
    { id: 'ZOMBI', nombre: 'Zombi', emoji: '🧟', color: '#4f6b3a' },
    { id: 'MAGO', nombre: 'Mago', emoji: '🧙‍♂️', color: '#1d4ed8' },
];
export const COLORES_DISFRAZ = ['#f8fafc', '#b91c1c', '#7c3aed', '#16a34a', '#ea580c', '#1d4ed8', '#db2777', '#111827', '#ca8a04', '#0d9488'];
export const ACCESORIOS = [
    { id: 'NINGUNO', nombre: 'Nada', emoji: '✋' },
    { id: 'CUBO', nombre: 'Cubo de caramelos', emoji: '🎃' },
    { id: 'ESCOBA', nombre: 'Escoba', emoji: '🧹' },
    { id: 'FAROL', nombre: 'Farol', emoji: '🏮' },
    { id: 'VARITA', nombre: 'Varita', emoji: '🪄' },
    { id: 'PIRULETA', nombre: 'Piruleta', emoji: '🍭' },
];
export const AVATAR_POR_DEFECTO = { disfraz: 'FANTASMA', color: null, accesorio: 'CUBO' };
export const disfrazDe = (id) => DISFRACES.find(d => d.id === id) || DISFRACES[0];

const PIEL = '#f1c7a5';
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...extra });
const brillo = (color, intensidad = 1.2) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensidad, roughness: 0.4 });

function malla(geo, material, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    return m;
}

/** Textura de vendas para la momia. */
let texVendas = null;
function texturaVendas() {
    if (texVendas) return texVendas;
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#e7dcc0'; g.fillRect(0, 0, 64, 64);
    for (let y = 0; y < 64; y += 8) {
        g.fillStyle = y % 16 ? '#d6c8a4' : '#f3ead5';
        g.save(); g.translate(0, y); g.rotate((Math.random() - 0.5) * 0.15); g.fillRect(-4, 0, 72, 5); g.restore();
    }
    texVendas = new THREE.CanvasTexture(c);
    texVendas.wrapS = texVendas.wrapT = THREE.RepeatWrapping;
    texVendas.repeat.set(2, 3);
    texVendas.colorSpace = THREE.SRGBColorSpace;
    return texVendas;
}

/** Cuerpo humanoide base. Devuelve las piezas para poder vestirlo. */
function cuerpoBase({ ropa, piel = PIEL, piernasColor = '#1f2937', zapatos = '#111' }) {
    const g = new THREE.Group();
    const mRopa = mat(ropa), mPiel = mat(piel), mPiernas = mat(piernasColor), mZap = mat(zapatos);

    const piernas = [-0.13, 0.13].map(x => {
        const p = new THREE.Group(); p.position.set(x, 0.62, 0);
        p.add(malla(new THREE.CylinderGeometry(0.1, 0.09, 0.56, 10), mPiernas, 0, -0.28, 0));
        p.add(malla(new THREE.BoxGeometry(0.16, 0.08, 0.24), mZap, 0, -0.58, 0.04));
        g.add(p); return p;
    });
    const torso = malla(new THREE.CylinderGeometry(0.25, 0.27, 0.62, 14), mRopa, 0, 0.93, 0);
    g.add(torso);
    const brazos = [-1, 1].map(s => {
        const b = new THREE.Group(); b.position.set(0.33 * s, 1.18, 0);
        b.add(malla(new THREE.CylinderGeometry(0.075, 0.07, 0.5, 8), mRopa, 0, -0.25, 0));
        const mano = malla(new THREE.SphereGeometry(0.08, 10, 8), mPiel, 0, -0.53, 0);
        b.add(mano); b.userData.mano = mano;
        g.add(b); return b;
    });
    const cabeza = new THREE.Group(); cabeza.position.set(0, 1.5, 0);
    const craneo = malla(new THREE.SphereGeometry(0.27, 18, 14), mPiel);
    cabeza.add(craneo);
    g.add(cabeza);
    return { g, piernas, brazos, torso, cabeza, craneo, mRopa, mPiel };
}

function ojos(cabeza, { color = '#111', r = 0.04, sep = 0.1, y = 0.03, z = 0.24, emisivo = false } = {}) {
    const m = emisivo ? brillo(color, 2) : mat(color);
    [-sep, sep].forEach(x => cabeza.add(malla(new THREE.SphereGeometry(r, 8, 8), m, x, y, z)));
}

function cono(r, h, color, segs = 12) { return new THREE.Mesh(new THREE.ConeGeometry(r, h, segs), mat(color)); }

function cola(color, grosor = 0.04) {
    const curva = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.1, -0.25), new THREE.Vector3(0, 0.1, -0.45), new THREE.Vector3(0, 0.35, -0.5),
    ]);
    return new THREE.Mesh(new THREE.TubeGeometry(curva, 16, grosor, 6), mat(color));
}

function accesorio(id) {
    const g = new THREE.Group();
    if (id === 'CUBO') {
        const cubo = malla(new THREE.SphereGeometry(0.14, 12, 10), brillo('#f97316', 0.35), 0, -0.14, 0.05);
        cubo.scale.set(1, 0.85, 1); g.add(cubo);
        g.add(malla(new THREE.TorusGeometry(0.1, 0.012, 6, 16, Math.PI), mat('#111'), 0, -0.04, 0.05));
        const cara = brillo('#fde047', 1.5);
        [-0.05, 0.05].forEach(x => g.add(malla(new THREE.SphereGeometry(0.022, 6, 6), cara, x, -0.1, 0.18)));
    } else if (id === 'ESCOBA') {
        g.add(malla(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 6), mat('#78350f'), 0, 0, 0.05));
        g.add(malla(new THREE.ConeGeometry(0.12, 0.3, 10), mat('#ca8a04'), 0, -0.68, 0.05));
    } else if (id === 'FAROL') {
        g.add(malla(new THREE.CylinderGeometry(0.004, 0.004, 0.12, 4), mat('#111'), 0, -0.08, 0.05));
        g.add(malla(new THREE.BoxGeometry(0.13, 0.17, 0.13), brillo('#fbbf24', 1.6), 0, -0.24, 0.05));
        g.add(malla(new THREE.ConeGeometry(0.1, 0.07, 4), mat('#111'), 0, -0.12, 0.05));
    } else if (id === 'VARITA') {
        const v = malla(new THREE.CylinderGeometry(0.012, 0.012, 0.4, 6), mat('#111'), 0, -0.1, 0.15); v.rotation.x = 1.2; g.add(v);
        g.add(malla(new THREE.OctahedronGeometry(0.05), brillo('#fde047', 2), 0, -0.02, 0.33));
    } else if (id === 'PIRULETA') {
        g.add(malla(new THREE.CylinderGeometry(0.01, 0.01, 0.3, 5), mat('#f8fafc'), 0, 0.08, 0.05));
        const d = malla(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 18), brillo('#ec4899', 0.4), 0, 0.28, 0.05); d.rotation.x = Math.PI / 2; g.add(d);
    }
    return g;
}

/** Avatar disfrazado. */
export function crearAvatar3D(avatar = AVATAR_POR_DEFECTO) {
    const def = disfrazDe(avatar?.disfraz);
    const color = avatar?.color || def.color;
    let flota = false;
    let b;

    switch (def.id) {
        case 'FANTASMA': {
            b = cuerpoBase({ ropa: color, piel: color, piernasColor: color, zapatos: color });
            b.piernas.forEach(p => { p.visible = false; });
            b.torso.visible = false;
            const geo = new THREE.CylinderGeometry(0.32, 0.5, 1.15, 24, 1, true);
            const pos = geo.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                if (pos.getY(i) < 0) { const a = Math.atan2(pos.getZ(i), pos.getX(i)); pos.setY(i, pos.getY(i) + Math.sin(a * 7) * 0.06); }
            }
            geo.computeVertexNormals();
            const sabana = malla(geo, mat(color, { side: THREE.DoubleSide, transparent: true, opacity: 0.93 }), 0, 0.95, 0);
            b.g.add(sabana);
            b.craneo.scale.set(1.2, 1.15, 1.2);
            b.craneo.material = mat(color, { transparent: true, opacity: 0.95 });
            ojos(b.cabeza, { r: 0.055, sep: 0.11, z: 0.28 });
            b.cabeza.add(malla(new THREE.SphereGeometry(0.045, 8, 8), mat('#111'), 0, -0.1, 0.3));
            b.brazos.forEach(a => { a.children[0].material = mat(color); a.userData.mano.material = mat(color); });
            flota = true;
            break;
        }
        case 'VAMPIRO': {
            b = cuerpoBase({ ropa: '#111827', piel: '#e9e1f0' });
            b.torso.add(malla(new THREE.ConeGeometry(0.12, 0.3, 3), mat('#f8fafc'), 0, 0.15, 0.22));
            const capa = malla(new THREE.CylinderGeometry(0.34, 0.55, 1.2, 18, 1, true, Math.PI * 0.55, Math.PI * 0.9), mat(color, { side: THREE.DoubleSide }), 0, 0.72, 0);
            b.g.add(capa);
            const cuello = malla(new THREE.CylinderGeometry(0.36, 0.3, 0.25, 16, 1, true, Math.PI * 0.6, Math.PI * 0.8), mat('#111', { side: THREE.DoubleSide }), 0, 1.33, 0);
            b.g.add(cuello);
            const pelo = malla(new THREE.SphereGeometry(0.285, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), mat('#0a0a0a'), 0, 0.02, -0.01);
            b.cabeza.add(pelo);
            ojos(b.cabeza, { color: '#b91c1c', emisivo: true, r: 0.035 });
            [-0.04, 0.04].forEach(x => { const c = cono(0.015, 0.05, '#fff', 5); c.rotation.x = Math.PI; c.position.set(x, -0.14, 0.24); b.cabeza.add(c); });
            break;
        }
        case 'BRUJA': {
            b = cuerpoBase({ ropa: color, piel: '#b5d99c', piernasColor: '#16a34a' });
            const vestido = cono(0.45, 0.95, color, 18); vestido.position.set(0, 0.5, 0); b.g.add(vestido);
            const ala = malla(new THREE.CylinderGeometry(0.46, 0.46, 0.03, 20), mat('#111'), 0, 0.2, 0); b.cabeza.add(ala);
            const sombrero = cono(0.24, 0.6, '#111', 14); sombrero.position.set(0, 0.5, -0.02); sombrero.rotation.x = -0.15; b.cabeza.add(sombrero);
            { const cinta = malla(new THREE.TorusGeometry(0.235, 0.025, 6, 20), brillo('#a855f7', 0.5), 0, 0.24, 0); cinta.rotation.x = Math.PI / 2; b.cabeza.add(cinta); }
            [-1, 1].forEach(s => { const m = malla(new THREE.BoxGeometry(0.08, 0.4, 0.1), mat('#ea580c'), 0.24 * s, -0.12, -0.04); b.cabeza.add(m); });
            ojos(b.cabeza);
            { const nariz = malla(new THREE.ConeGeometry(0.04, 0.14, 6), mat('#8fbf6f'), 0, -0.04, 0.3); nariz.rotation.x = Math.PI / 2; b.cabeza.add(nariz); }
            break;
        }
        case 'CALABAZA': {
            b = cuerpoBase({ ropa: color });
            b.craneo.visible = false;
            const mCal = brillo('#f97316', 0.18);
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2;
                const gajo = malla(new THREE.SphereGeometry(0.2, 12, 10), mCal, Math.cos(a) * 0.13, 0.02, Math.sin(a) * 0.13);
                gajo.scale.set(1, 0.95, 1); b.cabeza.add(gajo);
            }
            b.cabeza.add(malla(new THREE.CylinderGeometry(0.03, 0.04, 0.12, 6), mat('#3f6212'), 0, 0.24, 0));
            const fuego = brillo('#fde047', 2.2);
            [-0.1, 0.1].forEach(x => { const o = cono(0.05, 0.07, '#000', 3); o.material = fuego; o.position.set(x, 0.06, 0.31); o.rotation.x = Math.PI / 2; b.cabeza.add(o); });
            const boca = malla(new THREE.BoxGeometry(0.22, 0.05, 0.02), fuego, 0, -0.09, 0.31); b.cabeza.add(boca);
            b.cabeza.scale.set(1.25, 1.1, 1.25);
            break;
        }
        case 'ESQUELETO': {
            b = cuerpoBase({ ropa: color, piel: '#f5f5f4', piernasColor: color, zapatos: color });
            const hueso = mat('#f5f5f4');
            for (let i = 0; i < 4; i++) b.torso.add(malla(new THREE.BoxGeometry(0.36, 0.035, 0.02), hueso, 0, 0.18 - i * 0.1, 0.25));
            b.torso.add(malla(new THREE.BoxGeometry(0.04, 0.45, 0.02), hueso, 0, 0.02, 0.26));
            b.piernas.forEach(p => p.add(malla(new THREE.BoxGeometry(0.04, 0.5, 0.02), hueso, 0, -0.28, 0.1)));
            b.brazos.forEach(a => a.add(malla(new THREE.BoxGeometry(0.035, 0.45, 0.02), hueso, 0, -0.25, 0.08)));
            [-0.1, 0.1].forEach(x => b.cabeza.add(malla(new THREE.SphereGeometry(0.075, 10, 8), mat('#111'), x, 0.03, 0.21)));
            b.cabeza.add(malla(new THREE.ConeGeometry(0.03, 0.06, 3), mat('#111'), 0, -0.06, 0.26));
            for (let i = -2; i <= 2; i++) b.cabeza.add(malla(new THREE.BoxGeometry(0.025, 0.05, 0.02), mat('#111'), i * 0.04, -0.15, 0.22));
            break;
        }
        case 'MOMIA': {
            const t = texturaVendas();
            b = cuerpoBase({ ropa: color, piel: color, piernasColor: color, zapatos: '#a8a29e' });
            b.g.traverse(o => { if (o.isMesh) o.material = new THREE.MeshStandardMaterial({ map: t, color, roughness: 0.9 }); });
            b.cabeza.add(malla(new THREE.SphereGeometry(0.06, 10, 8), brillo('#fef08a', 1.5), 0.09, 0.04, 0.22));
            b.cabeza.add(malla(new THREE.BoxGeometry(0.08, 0.02, 0.02), mat('#111'), -0.09, 0.05, 0.26));
            break;
        }
        case 'LOBO': {
            b = cuerpoBase({ ropa: '#1e3a8a', piel: color, piernasColor: '#374151' });
            b.brazos.forEach(a => { a.children[0].material = mat(color); });
            [-1, 1].forEach(s => { const o = cono(0.08, 0.2, color, 4); o.position.set(0.16 * s, 0.26, 0); b.cabeza.add(o); });
            const hocico = malla(new THREE.BoxGeometry(0.2, 0.14, 0.2), mat('#a16207'), 0, -0.07, 0.24); b.cabeza.add(hocico);
            b.cabeza.add(malla(new THREE.SphereGeometry(0.04, 8, 8), mat('#111'), 0, -0.02, 0.35));
            ojos(b.cabeza, { color: '#facc15', emisivo: true, r: 0.035, y: 0.08 });
            const c = cola(color, 0.06); c.position.set(0, 0.7, -0.22); b.g.add(c);
            break;
        }
        case 'DIABLO': {
            b = cuerpoBase({ ropa: color, piel: '#fca5a5', piernasColor: color });
            [-1, 1].forEach(s => { const h = cono(0.05, 0.2, '#fef3c7', 8); h.position.set(0.12 * s, 0.27, 0.02); h.rotation.z = -0.4 * s; b.cabeza.add(h); });
            ojos(b.cabeza);
            const c = cola(color, 0.025); c.position.set(0, 0.7, -0.22); b.g.add(c);
            const punta = cono(0.06, 0.12, color, 4); punta.position.set(0, 1.08, -0.72); b.g.add(punta);
            break;
        }
        case 'FRANKENSTEIN': {
            b = cuerpoBase({ ropa: color, piel: '#86b36b' });
            b.cabeza.add(malla(new THREE.BoxGeometry(0.5, 0.14, 0.5), mat('#111'), 0, 0.22, 0));
            [-1, 1].forEach(s => { const p = malla(new THREE.CylinderGeometry(0.035, 0.035, 0.14, 8), mat('#9ca3af', { metalness: 0.8, roughness: 0.3 }), 0.3 * s, -0.12, 0); p.rotation.z = Math.PI / 2; b.cabeza.add(p); });
            ojos(b.cabeza);
            b.cabeza.add(malla(new THREE.BoxGeometry(0.16, 0.02, 0.02), mat('#14532d'), 0, -0.12, 0.25));
            b.cabeza.scale.set(1, 1.12, 1);
            break;
        }
        case 'GATO': {
            b = cuerpoBase({ ropa: color, piel: color, piernasColor: color, zapatos: color });
            [-1, 1].forEach(s => { const o = cono(0.09, 0.2, color, 3); o.position.set(0.15 * s, 0.25, 0); b.cabeza.add(o); });
            ojos(b.cabeza, { color: '#a3e635', emisivo: true, r: 0.05, sep: 0.1 });
            b.cabeza.add(malla(new THREE.SphereGeometry(0.03, 6, 6), mat('#f9a8d4'), 0, -0.05, 0.27));
            [-1, 1].forEach(s => [0, 1].forEach(k => { const bi = malla(new THREE.BoxGeometry(0.18, 0.006, 0.006), mat('#e5e7eb'), 0.12 * s, -0.06 - k * 0.03, 0.24); bi.rotation.z = (k ? -0.15 : 0.15) * s; b.cabeza.add(bi); }));
            const c = cola(color, 0.035); c.position.set(0, 0.62, -0.22); b.g.add(c);
            break;
        }
        case 'ZOMBI': {
            b = cuerpoBase({ ropa: color, piel: '#9cc47c', piernasColor: '#3b2f2f' });
            b.brazos.forEach(a => { a.rotation.x = -1.3; });
            ojos(b.cabeza, { color: '#ef4444', emisivo: true, r: 0.035 });
            b.cabeza.add(malla(new THREE.BoxGeometry(0.14, 0.03, 0.02), mat('#3f0d0d'), 0, -0.12, 0.25));
            break;
        }
        case 'MAGO':
        default: {
            b = cuerpoBase({ ropa: color, piel: PIEL });
            const tunica = cono(0.42, 0.95, color, 18); tunica.position.set(0, 0.5, 0); b.g.add(tunica);
            const s = cono(0.25, 0.65, color, 14); s.position.set(0, 0.5, 0); b.cabeza.add(s);
            for (let i = 0; i < 3; i++) b.cabeza.add(malla(new THREE.OctahedronGeometry(0.035), brillo('#fde047', 1.5), Math.cos(i * 2) * 0.15, 0.35 + i * 0.1, Math.sin(i * 2) * 0.15 + 0.08));
            { const barba = malla(new THREE.ConeGeometry(0.16, 0.35, 10), mat('#e5e7eb'), 0, -0.25, 0.14); barba.rotation.x = Math.PI; b.cabeza.add(barba); }
            ojos(b.cabeza);
            break;
        }
    }

    // Accesorio en la mano derecha
    const acc = accesorio(avatar?.accesorio || 'NINGUNO');
    acc.position.copy(b.brazos[1].userData.mano.position);
    b.brazos[1].add(acc);

    const grupo = b.g;
    const zombiArms = def.id === 'ZOMBI';
    grupo.userData.animar = (t, andando, fase = 0) => {
        const k = t * 7 + fase;
        const amp = andando ? 0.6 : 0;
        b.piernas[0].rotation.x = Math.sin(k) * amp;
        b.piernas[1].rotation.x = -Math.sin(k) * amp;
        if (!zombiArms) {
            b.brazos[0].rotation.x = -Math.sin(k) * amp * 0.8;
            b.brazos[1].rotation.x = Math.sin(k) * amp * 0.8 - (andando ? 0 : 0.25);
        }
        b.cabeza.rotation.z = Math.sin(t * 1.3 + fase) * 0.05;
    };
    grupo.userData.flota = flota;
    grupo.userData.brazos = b.brazos;
    return grupo;
}

/** El zombi jefe de la batalla final (grande, con la ropa rota y los ojos rojos). */
export function crearZombiJefe() {
    const b = cuerpoBase({ ropa: '#4c3a6b', piel: '#8fbf6f', piernasColor: '#3b2f2f', zapatos: '#1c1917' });
    b.brazos.forEach(a => { a.rotation.x = -1.35; });
    b.craneo.scale.set(1.1, 1.05, 1);
    ojos(b.cabeza, { color: '#ff1a1a', emisivo: true, r: 0.05, sep: 0.11 });
    const boca = malla(new THREE.BoxGeometry(0.18, 0.06, 0.03), mat('#2b0a0a'), 0, -0.13, 0.25); b.cabeza.add(boca);
    for (let i = -2; i <= 2; i++) b.cabeza.add(malla(new THREE.BoxGeometry(0.022, 0.035, 0.02), mat('#fffbe6'), i * 0.035, -0.11, 0.265));
    b.cabeza.add(malla(new THREE.SphereGeometry(0.09, 8, 8), mat('#5b8a3c'), -0.15, 0.12, 0.14));
    for (let i = 0; i < 5; i++) { const h = malla(new THREE.CylinderGeometry(0.01, 0.01, 0.15, 4), mat('#2b1d12'), (i - 2) * 0.08, 0.3, -0.02); h.rotation.z = (i - 2) * 0.25; b.cabeza.add(h); }
    for (let i = 0; i < 6; i++) { const j = malla(new THREE.BoxGeometry(0.08, 0.12, 0.02), mat('#1a0b2e'), Math.cos(i) * 0.2, 0.65 - (i % 2) * 0.03, 0.23); j.rotation.z = i; b.g.add(j); }
    b.g.userData.animar = (t, andando) => {
        const amp = andando ? 0.5 : 0.08;
        b.piernas[0].rotation.x = Math.sin(t * 3) * amp;
        b.piernas[1].rotation.x = -Math.sin(t * 3) * amp;
        b.brazos[0].rotation.x = -1.35 + Math.sin(t * 2.2) * 0.12;
        b.brazos[1].rotation.x = -1.35 + Math.cos(t * 2.2) * 0.12;
        b.cabeza.rotation.z = Math.sin(t * 1.1) * 0.15;
        b.g.rotation.z = Math.sin(t * 1.1) * 0.04;
    };
    b.g.userData.materiales = [];
    b.g.traverse(o => { if (o.isMesh && o.material?.emissive) b.g.userData.materiales.push(o.material); });
    return b.g;
}

/** Libera geometrías y materiales de un objeto. */
export function liberar(obj) {
    obj?.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map && m.map !== texVendas) m.map.dispose(); m.dispose(); });
    });
}

/** Etiqueta con el nombre (sprite). */
export function etiquetaNombre(texto, color = '#ffffff') {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    g.font = 'bold 30px system-ui, sans-serif';
    const w = Math.min(250, g.measureText(texto).width + 28);
    g.fillStyle = 'rgba(20,8,38,.78)';
    g.beginPath(); g.roundRect?.((256 - w) / 2, 8, w, 46, 18); if (!g.roundRect) g.rect((256 - w) / 2, 8, w, 46); g.fill();
    g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(texto.length > 14 ? texto.slice(0, 13) + '…' : texto, 128, 32);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
    s.scale.set(1.3, 0.33, 1);
    return s;
}
