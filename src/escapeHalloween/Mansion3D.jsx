import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { crearAvatar3D, crearZombiJefe, liberar, etiquetaNombre } from './avatares3d';

/**
 *  Mansión 3D del escape room («casa de muñecas» abierta por delante):
 *   · una sala por prueba, en serpiente de abajo arriba (3 por planta), con su decoración y puerta;
 *   · los avatares de los alumnos esperan en el jardín, caminan/saltan a la sala activa,
 *     dan un brinco con cada acierto y bajan al sótano para la batalla;
 *   · el zombi duerme en el sótano y se levanta en la batalla final.
 *  Props: pruebas [{emoji, nombre, color, decor}], fase, salaIdx, abiertas [idx], jugadores {clave: {nombre, avatar, aciertos, golpes}},
 *         batalla {golpes, ataqueN, bloqueado}, alto (px).
 */

const W = 5, H = 3.2, D = 4.2;
const ESCALA_AVATAR = 0.62;

function distribucion(n) {
    const cols = Math.min(3, Math.max(1, n));
    const filas = Math.ceil(Math.max(1, n) / cols);
    const salas = [];
    for (let i = 0; i < cols * filas; i++) {
        const r = Math.floor(i / cols), k = i % cols;
        const c = r % 2 === 0 ? k : cols - 1 - k;
        salas.push({ x: (c - (cols - 1) / 2) * W, y: r * H, c });
    }
    return { cols, filas, salas: salas.slice(0, n), vacias: salas.slice(n), ancho: cols * W, alto: filas * H };
}

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
const brillo = (color, i = 1.5) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: i });
function caja(w, h, d, material, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); m.position.set(x, y, z); return m; }

function texturaCartel(emoji, nombre, color, numero) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#1a0b2e'; g.fillRect(0, 0, 512, 256);
    g.strokeStyle = color; g.lineWidth = 10; g.strokeRect(8, 8, 496, 240);
    g.font = '110px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(emoji, 95, 128);
    g.fillStyle = color; g.font = 'bold 34px system-ui, sans-serif'; g.textAlign = 'left';
    g.fillText(`Sala ${numero}`, 180, 60);
    g.fillStyle = '#f5e9ff'; g.font = 'bold 30px system-ui, sans-serif';
    const palabras = String(nombre).split(' '); let linea = '', y = 115;
    for (const p of palabras) {
        if (g.measureText(linea + p).width > 310) { g.fillText(linea, 180, y); y += 38; linea = ''; }
        linea += p + ' ';
    }
    g.fillText(linea, 180, y);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function spriteEmoji(emoji, tam = 1) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const g = c.getContext('2d'); g.font = '100px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(emoji, 64, 70);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
    s.scale.set(tam, tam, 1); return s;
}

function vela(x, y, z) {
    const g = new THREE.Group();
    g.add(caja(0.08, 0.25, 0.08, mat('#f5f5dc'), 0, 0.125, 0));
    const llama = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), brillo('#ffb020', 3));
    llama.position.y = 0.3; llama.scale.y = 1.6; g.add(llama);
    g.position.set(x, y, z); g.userData.llama = llama;
    return g;
}

function decorar(grupo, decor, x, y, velas) {
    const zf = -D / 2 + 0.6;
    const mesa = (px) => { grupo.add(caja(1.4, 0.08, 0.7, mat('#4a2c17'), px, y + 0.8, zf)); [-0.6, 0.6].forEach(dx => [-0.28, 0.28].forEach(dz => grupo.add(caja(0.07, 0.8, 0.07, mat('#3b2212'), px + dx, y + 0.4, zf + dz)))); };
    const ox = x - W * 0.3;
    switch (decor) {
        case 'MATES': {
            mesa(ox);
            ['#22ff88', '#a3ff00', '#00e5ff'].forEach((c, i) => {
                const f = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), brillo(c, 1.2)); f.position.set(ox - 0.45 + i * 0.45, y + 0.98, zf); grupo.add(f);
                grupo.add(caja(0.06, 0.18, 0.06, mat('#cbd5e1', { transparent: true, opacity: 0.6 }), ox - 0.45 + i * 0.45, y + 1.15, zf));
            });
            break;
        }
        case 'GEOGRAFIA': {
            const globo = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 16), mat('#2563eb', { emissive: '#0c4a6e', emissiveIntensity: 0.4 }));
            globo.position.set(ox, y + 1.2, zf); grupo.add(globo);
            grupo.add(caja(0.08, 0.75, 0.08, mat('#a16207'), ox, y + 0.38, zf));
            grupo.add(caja(1.2, 2.2, 0.4, mat('#3b2212'), x + W * 0.05 - 0.2, y + 1.1, -D / 2 + 0.3));
            for (let i = 0; i < 12; i++) grupo.add(caja(0.08, 0.35, 0.3, mat(['#b91c1c', '#15803d', '#1d4ed8', '#a16207'][i % 4]), x + W * 0.05 - 0.7 + (i % 6) * 0.18, y + 0.55 + Math.floor(i / 6) * 0.7, -D / 2 + 0.35));
            break;
        }
        case 'BIOLOGIA': {
            mesa(ox);
            const tarro = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.4, 14), mat('#86efac', { transparent: true, opacity: 0.55, emissive: '#14532d', emissiveIntensity: 0.6 }));
            tarro.position.set(ox - 0.3, y + 1.04, zf); grupo.add(tarro);
            const craneo = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), mat('#f5f5f4')); craneo.position.set(ox + 0.35, y + 1.0, zf); grupo.add(craneo);
            [-0.06, 0.06].forEach(dx => grupo.add(caja(0.06, 0.06, 0.02, mat('#111'), ox + 0.35 + dx, y + 1.02, zf + 0.16)));
            break;
        }
        case 'HISTORIA': {
            ['#7c2d12', '#1e3a8a', '#365314'].forEach((c, i) => {
                grupo.add(caja(0.8, 1.0, 0.06, mat('#ca8a04', { metalness: 0.6, roughness: 0.4 }), ox - 0.9 + i * 0.95, y + 1.6, -D / 2 + 0.1));
                grupo.add(caja(0.62, 0.82, 0.02, mat(c), ox - 0.9 + i * 0.95, y + 1.6, -D / 2 + 0.14));
                const cara = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), mat('#f1c7a5')); cara.position.set(ox - 0.9 + i * 0.95, y + 1.68, -D / 2 + 0.17); grupo.add(cara);
            });
            break;
        }
        case 'LENGUA': {
            mesa(ox);
            for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 10), mat('#fef3c7')); r.rotation.z = Math.PI / 2; r.position.set(ox - 0.3 + i * 0.3, y + 0.9, zf + (i - 1) * 0.15); grupo.add(r); }
            break;
        }
        case 'INGLES': {
            const caldero = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65), mat('#111', { side: THREE.DoubleSide }));
            caldero.position.set(ox, y + 0.55, zf + 0.2); grupo.add(caldero);
            const pocion = new THREE.Mesh(new THREE.CircleGeometry(0.44, 20), brillo('#84cc16', 1.4)); pocion.rotation.x = -Math.PI / 2; pocion.position.set(ox, y + 0.78, zf + 0.2); grupo.add(pocion);
            const tela = new THREE.Mesh(new THREE.CircleGeometry(0.7, 8, 0, Math.PI / 2), mat('#e5e7eb', { wireframe: true }));
            tela.position.set(x - W / 2 + 0.1, y + H - 0.1, -D / 2 + 0.1); tela.rotation.z = -Math.PI / 2; grupo.add(tela);
            break;
        }
        default: { // MANUAL: baúl con candado
            grupo.add(caja(1.0, 0.55, 0.6, mat('#7c4a24'), ox, y + 0.28, zf + 0.1));
            const tapa = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.0, 14, 1, false, 0, Math.PI), mat('#8b5a2b'));
            tapa.rotation.z = Math.PI / 2; tapa.position.set(ox, y + 0.55, zf + 0.1); grupo.add(tapa);
            grupo.add(caja(0.16, 0.2, 0.05, brillo('#facc15', 0.6), ox, y + 0.5, zf + 0.42));
        }
    }
    const v1 = vela(x + W * 0.45 - 0.4, y, -D / 2 + 0.4), v2 = vela(x - W * 0.45 + 0.3, y, D / 2 - 0.5);
    grupo.add(v1, v2); velas.push(v1, v2);
}

function construirCasa(pruebas) {
    const grupo = new THREE.Group();
    const L = distribucion(pruebas.length);
    const puertas = [], velas = [], candados = [];
    const paredLat = mat('#22123a'), madera = mat('#3b2416'), suelo = mat('#4a2c17');

    pruebas.forEach((info, i) => {
        const { x, y, c } = L.salas[i];
        const tinte = new THREE.Color('#2a1840').lerp(new THREE.Color(info.color || '#ff8c1a'), 0.18);
        grupo.add(caja(W, 0.16, D, suelo, x, y - 0.08, 0));
        grupo.add(caja(W, H, 0.15, mat(tinte), x, y + H / 2, -D / 2));
        grupo.add(caja(W, 0.9, 0.05, madera, x, y + 0.45, -D / 2 + 0.1));
        grupo.add(caja(0.15, H, D, paredLat, x - W / 2, y + H / 2, 0));
        if (c === L.cols - 1 || i === pruebas.length - 1) grupo.add(caja(0.15, H, D, paredLat, x + W / 2, y + H / 2, 0));
        grupo.add(caja(W, 0.22, 0.22, madera, x, y + H - 0.11, D / 2 - 0.1));
        // cartel
        const cartel = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.05), new THREE.MeshBasicMaterial({ map: texturaCartel(info.emoji, info.nombre, info.color || '#ff8c1a', i + 1) }));
        cartel.position.set(x - W * 0.12, y + 2.3, -D / 2 + 0.09); grupo.add(cartel);
        // puerta con bisagra
        const px = x + W * 0.3;
        grupo.add(caja(1.15, 2.15, 0.1, madera, px, y + 1.07, -D / 2 + 0.06));
        grupo.add(caja(0.95, 2.0, 0.04, brillo('#ffd27a', 1.1), px, y + 1.0, -D / 2 + 0.09));
        const bisagra = new THREE.Group(); bisagra.position.set(px - 0.47, y, -D / 2 + 0.13);
        const hoja = caja(0.94, 1.98, 0.07, mat('#5a3818'), 0.47, 0.99, 0);
        hoja.add(caja(0.08, 0.08, 0.06, brillo('#facc15', 0.5), 0.33, 0, 0.05));
        bisagra.add(hoja); grupo.add(bisagra); puertas.push(bisagra);
        const candado = spriteEmoji('🔒', 0.7); candado.position.set(px, y + 2.45, -D / 2 + 0.4); candado.visible = false;
        grupo.add(candado); candados.push(candado);
        decorar(grupo, info.decor, x, y, velas);
    });
    // desvanes cerrados en los huecos de la última planta
    L.vacias.forEach(({ x, y, c }) => {
        grupo.add(caja(W, 0.16, D, suelo, x, y - 0.08, 0));
        grupo.add(caja(W, H, 0.15, mat('#1a1028'), x, y + H / 2, -D / 2));
        grupo.add(caja(0.15, H, D, paredLat, x - W / 2, y + H / 2, 0));
        if (c === L.cols - 1) grupo.add(caja(0.15, H, D, paredLat, x + W / 2, y + H / 2, 0));
        grupo.add(caja(W, H, 0.1, mat('#2b1a12'), x, y + H / 2, D / 2 - 0.05));
        for (let k = 0; k < 4; k++) grupo.add(caja(W - 0.2, 0.18, 0.12, madera, x, y + 0.5 + k * 0.7, D / 2 + 0.03));
        const ventana = new THREE.Mesh(new THREE.CircleGeometry(0.35, 16), brillo('#ffb347', 1.2)); ventana.position.set(x, y + 2.2, D / 2 + 0.1); grupo.add(ventana);
    });
    // techo de la última planta
    const topY = L.alto;
    grupo.add(caja(L.ancho + 0.3, 0.2, D + 0.3, madera, 0, topY, 0));
    const forma = new THREE.Shape(); forma.moveTo(-L.ancho / 2 - 0.6, 0); forma.lineTo(L.ancho / 2 + 0.6, 0); forma.lineTo(0, 2.4); forma.closePath();
    const tejado = new THREE.Mesh(new THREE.ExtrudeGeometry(forma, { depth: D + 0.8, bevelEnabled: false }), mat('#1c1324'));
    tejado.position.set(0, topY + 0.1, -D / 2 - 0.4); grupo.add(tejado);
    grupo.add(caja(0.6, 1.4, 0.6, mat('#3f2a2a'), L.ancho * 0.28, topY + 1.6, -0.6));
    const ventanaTecho = new THREE.Mesh(new THREE.CircleGeometry(0.4, 20), brillo('#ffb347', 1.6)); ventanaTecho.position.set(0, topY + 1.0, D / 2 + 0.41); grupo.add(ventanaTecho);
    // sótano
    const piedra = mat('#2d2a33');
    grupo.add(caja(L.ancho, 0.16, D, piedra, 0, -H - 0.08, 0));
    grupo.add(caja(L.ancho, H, 0.15, mat('#231f29'), 0, -H / 2, -D / 2));
    grupo.add(caja(0.15, H, D, piedra, -L.ancho / 2, -H / 2, 0));
    grupo.add(caja(0.15, H, D, piedra, L.ancho / 2, -H / 2, 0));
    grupo.add(caja(L.ancho, 0.22, 0.22, madera, 0, -0.11, D / 2 - 0.1));
    [-1, 1].forEach(s => { const a = vela(s * (L.ancho / 2 - 0.6), -H + 1.3, -D / 2 + 0.3); a.scale.set(1.6, 1.6, 1.6); grupo.add(a); velas.push(a); });
    const ataud = caja(1.0, 0.35, 2.3, mat('#3b2212'), 0.9, -H + 0.18, 0.2); grupo.add(ataud);
    return { grupo, puertas, velas, candados, L };
}

function construirExterior(scene, L) {
    const cesped = mat('#16241a');
    const plano = (w, d, x, z) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), cesped); p.rotation.x = -Math.PI / 2; p.position.set(x, 0, z); scene.add(p); };
    plano(120, 60, 0, D / 2 + 30);
    plano(120, 60, 0, -D / 2 - 30);
    plano(60, D, -(L.ancho / 2 + 30), 0);
    plano(60, D, L.ancho / 2 + 30, 0);
    // camino
    const camino = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 14), mat('#3a3326')); camino.rotation.x = -Math.PI / 2; camino.position.set(0, 0.01, D / 2 + 7); scene.add(camino);
    const lapida = mat('#6b6f7a');
    const sitios = [[-1, 3], [-1, 6], [-1, 9.5], [1, 4], [1, 7.5], [1, 11]];
    sitios.forEach(([s, z], i) => {
        const x = s * (L.ancho / 2 + 1.5 + (i % 2) * 1.2);
        const t = new THREE.Group();
        t.add(caja(0.8, 0.9, 0.18, lapida, 0, 0.45, 0));
        const arco = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.18, 16), lapida); arco.rotation.x = Math.PI / 2; arco.position.y = 0.9; t.add(arco);
        t.position.set(x, 0, D / 2 + z); t.rotation.y = (Math.random() - 0.5) * 0.4; t.rotation.z = (Math.random() - 0.5) * 0.15; scene.add(t);
    });
    const naranja = new THREE.MeshStandardMaterial({ color: '#f97316', emissive: '#c2410c', emissiveIntensity: 0.5 });
    const caraMat = brillo('#fde047', 2.5);
    const calabazas = [];
    [[-1.6, 2], [1.6, 2], [-1.6, 5], [1.6, 5], [-1.6, 8], [1.6, 8]].forEach(([x, z]) => {
        const g = new THREE.Group();
        const cuerpo = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), naranja); cuerpo.scale.set(1.2, 0.9, 1.2); cuerpo.position.y = 0.27; g.add(cuerpo);
        [-0.1, 0.1].forEach(dx => { const o = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.08, 3), caraMat); o.rotation.x = Math.PI / 2; o.position.set(dx, 0.32, 0.34); g.add(o); });
        g.add(caja(0.2, 0.05, 0.02, caraMat, 0, 0.2, 0.35));
        g.position.set(x, 0, D / 2 + z); g.rotation.y = x < 0 ? 0.4 : -0.4; scene.add(g); calabazas.push(g);
    });
    // árboles secos
    const tronco = mat('#2b1d14');
    [[-1, 13, 1.3], [1, 14, 1.1], [-1, -6, 1.6]].forEach(([s, z, e]) => {
        const g = new THREE.Group();
        const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.3, 4, 7), tronco); tr.position.y = 2; g.add(tr);
        [[0.8, 3, 0.9], [-0.7, 2.6, -0.8], [0.5, 3.6, 0.4]].forEach(([dx, y, r]) => { const r1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.09, 1.6, 5), tronco); r1.position.set(dx * 0.6, y, 0); r1.rotation.z = r; g.add(r1); });
        g.position.set(s * (L.ancho / 2 + 6), 0, z); g.scale.setScalar(e); scene.add(g);
    });
    // luna y estrellas
    const luna = new THREE.Mesh(new THREE.SphereGeometry(3, 24, 16), new THREE.MeshBasicMaterial({ color: '#fff3c4' }));
    luna.position.set(-28, 26, -45); scene.add(luna);
    const est = new THREE.BufferGeometry(); const pts = [];
    for (let i = 0; i < 600; i++) { const r = 90, a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI * 0.45; pts.push(Math.cos(a) * Math.cos(b) * r, Math.sin(b) * r + 5, Math.sin(a) * Math.cos(b) * r); }
    est.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    scene.add(new THREE.Points(est, new THREE.PointsMaterial({ color: '#ffffff', size: 0.35, sizeAttenuation: true, fog: false })));
    return { calabazas };
}

export default function Mansion3D(props) {
    const contRef = useRef(null);
    const propsRef = useRef(props);
    propsRef.current = props;
    const firma = JSON.stringify((props.pruebas || []).map(p => [p.emoji, p.nombre, p.color, p.decor]));

    useEffect(() => {
        const cont = contRef.current; if (!cont) return;
        let renderer;
        try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch { return; }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        cont.appendChild(renderer.domElement);
        renderer.domElement.style.display = 'block';

        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#120726');
        scene.fog = new THREE.FogExp2('#1a0b2e', 0.022);
        const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 300);

        scene.add(new THREE.HemisphereLight('#8f7cff', '#1a1030', 1.3));
        const lunaLuz = new THREE.DirectionalLight('#b8c4ff', 1.1); lunaLuz.position.set(-12, 20, 18); scene.add(lunaLuz);
        const luzSala = new THREE.PointLight('#ffb060', 30, 11, 1.3); scene.add(luzSala);
        const luzSotano = new THREE.PointLight('#ff2a1a', 0, 14, 1.2); scene.add(luzSotano);

        const pruebas = propsRef.current.pruebas || [];
        const casa = construirCasa(pruebas);
        scene.add(casa.grupo);
        const L = casa.L;
        const ext = construirExterior(scene, L);
        luzSotano.position.set(0, -H + 2.4, 0.8);

        const zombi = crearZombiJefe();
        zombi.scale.setScalar(1.45);
        const zBase = new THREE.Vector3(0, -H, -0.9);
        zombi.position.copy(zBase); scene.add(zombi);
        const zMats = zombi.userData.materiales.map(m => ({ m, e: m.emissive.clone(), i: m.emissiveIntensity }));

        const escudo = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.06, 8, 40), brillo('#60a5fa', 2.5));
        escudo.position.set(0, -H + 1.1, 0.4); escudo.visible = false; scene.add(escudo);

        // ── avatares ──
        const avatares = new Map();
        let jugRef = null;
        const sincronizar = (jugadores) => {
            const vistos = new Set();
            Object.entries(jugadores || {}).forEach(([k, j]) => {
                vistos.add(k);
                const firmaAv = JSON.stringify(j.avatar || {}) + '|' + (j.nombre || k);
                let a = avatares.get(k);
                if (a && a.firma === firmaAv) { a.puntos = (j.aciertos || 0) + (j.golpes || 0); return; }
                const pos = a ? a.raiz.position.clone() : new THREE.Vector3((Math.random() - 0.5) * 4, 0, D / 2 + 9 + Math.random() * 2);
                if (a) { scene.remove(a.raiz); liberar(a.raiz); }
                const raiz = new THREE.Group();
                const cuerpo = crearAvatar3D(j.avatar);
                cuerpo.scale.setScalar(ESCALA_AVATAR);
                raiz.add(cuerpo);
                const et = etiquetaNombre(j.nombre || k); et.position.y = 1.95 * ESCALA_AVATAR + 0.3; raiz.add(et);
                raiz.position.copy(pos); scene.add(raiz);
                const puntos = (j.aciertos || 0) + (j.golpes || 0);
                avatares.set(k, { raiz, cuerpo, firma: firmaAv, desde: pos.clone(), hacia: pos.clone(), t: 1, dur: 1, salto: 0, puntos, puntosVistos: puntos, fase: Math.random() * 6 });
            });
            [...avatares.keys()].forEach(k => { if (!vistos.has(k)) { const a = avatares.get(k); scene.remove(a.raiz); liberar(a.raiz); avatares.delete(k); } });
        };

        const zona = (fase, salaIdx) => {
            if (['BATALLA', 'VICTORIA', 'DERROTA'].includes(fase)) return { cx: 0, y: -H, z0: 0.6, z1: D / 2 - 0.3, ancho: Math.min(L.ancho - 1, 9), cara: Math.PI };
            if (['RETOS', 'CANDADO', 'ABIERTA'].includes(fase) && L.salas[salaIdx]) {
                const s = L.salas[salaIdx]; return { cx: s.x, y: s.y, z0: -D / 2 + 1.3, z1: D / 2 - 0.35, ancho: W - 0.9, cara: 0 };
            }
            return { cx: 0, y: 0, z0: D / 2 + 1.6, z1: D / 2 + 5.5, ancho: Math.min(9, L.ancho), cara: 0 };
        };
        const huecos = (n, z) => {
            const cols = Math.max(1, Math.ceil(Math.sqrt(n * (z.ancho / Math.max(0.5, z.z1 - z.z0)))));
            const filas = Math.ceil(n / cols);
            const dx = z.ancho / cols, dz = (z.z1 - z.z0) / Math.max(1, filas);
            return Array.from({ length: n }, (_, i) => new THREE.Vector3(z.cx - z.ancho / 2 + dx * (i % cols + 0.5), z.y, z.z0 + dz * (Math.floor(i / cols) + 0.5)));
        };

        let ultimaZona = '';
        let golpesPrev = null, ataquePrev = null, hitT = 0, embiste = 0, temblor = 0, escudoT = 0;
        const camPos = new THREE.Vector3(0, L.alto / 2 + 2, 16), camMira = new THREE.Vector3(0, L.alto / 2, 0);
        camera.position.copy(camPos);

        const ajustar = () => {
            const w = cont.clientWidth || 300, h = cont.clientHeight || 200;
            renderer.setSize(w, h, false);
            renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
            camera.aspect = w / h; camera.updateProjectionMatrix();
        };
        ajustar();
        const ro = new ResizeObserver(ajustar); ro.observe(cont);

        const reloj = new THREE.Clock();
        let raf = 0;
        const bucle = () => {
            raf = requestAnimationFrame(bucle);
            const dt = Math.min(0.05, reloj.getDelta()), t = reloj.elapsedTime;
            const p = propsRef.current;
            const fase = p.fase || 'LOBBY', salaIdx = p.salaIdx ?? 0;
            if (p.jugadores !== jugRef) { jugRef = p.jugadores; sincronizar(p.jugadores); }

            // destino de los avatares
            const z = zona(fase, salaIdx);
            const claveZona = `${fase === 'CANDADO' || fase === 'ABIERTA' ? 'RETOS' : fase}-${salaIdx}-${avatares.size}`;
            const lista = [...avatares.keys()].sort();
            if (claveZona !== ultimaZona) {
                ultimaZona = claveZona;
                const hs = huecos(lista.length, z);
                lista.forEach((k, i) => {
                    const a = avatares.get(k);
                    const dest = hs[i];
                    if (a.hacia.distanceTo(dest) < 0.01) return;
                    a.desde = a.raiz.position.clone(); a.desde.y = a.hacia.y; a.hacia = dest; a.t = 0;
                    a.dur = Math.max(0.8, a.desde.distanceTo(dest) / 3.2) + Math.random() * 0.4;
                });
            }
            const pelea = ['BATALLA', 'VICTORIA', 'DERROTA'].includes(fase);
            avatares.forEach(a => {
                if (a.puntos > a.puntosVistos) { a.salto = 1; a.puntosVistos = a.puntos; }
                let andando = false;
                if (a.t < 1) {
                    a.t = Math.min(1, a.t + dt / a.dur);
                    const e = a.t < 0.5 ? 2 * a.t * a.t : 1 - Math.pow(-2 * a.t + 2, 2) / 2;
                    const d = a.desde.distanceTo(a.hacia);
                    a.raiz.position.lerpVectors(a.desde, a.hacia, e);
                    a.raiz.position.y += Math.sin(a.t * Math.PI) * Math.min(2.8, d * 0.25);
                    const dir = a.hacia.clone().sub(a.desde);
                    if (dir.lengthSq() > 0.01) a.cuerpo.rotation.y = Math.atan2(dir.x, dir.z);
                    andando = true;
                } else {
                    a.raiz.position.copy(a.hacia);
                    const cara = z.cara;
                    a.cuerpo.rotation.y += (cara - a.cuerpo.rotation.y) * Math.min(1, dt * 4);
                }
                if (a.salto > 0) { a.salto = Math.max(0, a.salto - dt * 2.4); a.raiz.position.y += Math.sin((1 - a.salto) * Math.PI) * 0.45; }
                if (fase === 'VICTORIA') a.raiz.position.y += Math.abs(Math.sin(t * 5 + a.fase)) * 0.35;
                if (a.cuerpo.userData.flota) a.raiz.position.y += 0.12 + Math.sin(t * 2 + a.fase) * 0.06;
                const tumbado = fase === 'DERROTA' ? -Math.PI / 2 : 0;
                a.cuerpo.rotation.x += (tumbado - a.cuerpo.rotation.x) * Math.min(1, dt * 3);
                a.cuerpo.userData.animar?.(t, andando || (pelea && fase === 'BATALLA' && a.salto > 0), a.fase);
            });

            // puertas y candados
            const abiertas = p.abiertas || [];
            casa.puertas.forEach((b, i) => { const obj = abiertas.includes(i) ? -1.7 : 0; b.rotation.y += (obj - b.rotation.y) * Math.min(1, dt * 2.5); });
            casa.candados.forEach((c, i) => { c.visible = fase === 'CANDADO' && i === salaIdx; if (c.visible) c.scale.setScalar(0.7 + Math.sin(t * 5) * 0.08); });
            casa.velas.forEach((v, i) => { v.userData.llama.scale.set(1, 1.5 + Math.sin(t * 12 + i) * 0.25, 1); });
            ext.calabazas.forEach((c, i) => { c.children[0].material.emissiveIntensity = 0.45 + Math.sin(t * 3 + i) * 0.15; });

            // luz de la sala activa
            const sAct = L.salas[salaIdx];
            const enSala = ['RETOS', 'CANDADO', 'ABIERTA'].includes(fase) && sAct;
            const objLuz = enSala ? new THREE.Vector3(sAct.x, sAct.y + 2.4, 0.6) : pelea ? new THREE.Vector3(0, -H + 2.6, 1) : new THREE.Vector3(0, 2.5, D / 2 + 3);
            luzSala.position.lerp(objLuz, Math.min(1, dt * 2));
            luzSala.intensity = (fase === 'ABIERTA' ? 45 : 28) + Math.sin(t * 9) * 3 + Math.sin(t * 23) * 2;
            luzSotano.intensity += ((pelea ? 30 : 4) + (pelea ? Math.sin(t * 7) * 6 : 0) - luzSotano.intensity) * Math.min(1, dt * 2);

            // zombi
            const golpes = p.batalla?.golpes ?? 0, ataqueN = p.batalla?.ataqueN ?? 0;
            if (golpesPrev === null) golpesPrev = golpes;
            if (ataquePrev === null) ataquePrev = ataqueN;
            if (golpes > golpesPrev) hitT = 0.3;
            golpesPrev = golpes;
            if (ataqueN !== ataquePrev) { embiste = 1; if (p.batalla?.bloqueado) escudoT = 1; else temblor = 0.6; ataquePrev = ataqueN; }
            const dormido = !pelea;
            const objRotX = dormido ? -Math.PI / 2 : fase === 'VICTORIA' ? Math.PI / 2.2 : 0;
            zombi.rotation.x += (objRotX - zombi.rotation.x) * Math.min(1, dt * (fase === 'VICTORIA' ? 1.5 : 2.5));
            const objY = dormido ? zBase.y + 0.45 : fase === 'VICTORIA' ? zBase.y - 0.2 : zBase.y + (fase === 'DERROTA' ? Math.abs(Math.sin(t * 6)) * 0.3 : 0);
            zombi.position.y += (objY - zombi.position.y) * Math.min(1, dt * 3);
            zombi.position.x += ((dormido ? 0.9 : 0) - zombi.position.x) * Math.min(1, dt * 2.5);
            const objZ = dormido ? 1.45 : zBase.z;
            if (embiste > 0) { embiste = Math.max(0, embiste - dt * 1.4); zombi.position.z = objZ + Math.sin((1 - embiste) * Math.PI) * 1.4; }
            else zombi.position.z += (objZ - zombi.position.z) * Math.min(1, dt * 2.5);
            if (fase === 'BATALLA' || fase === 'DERROTA') zombi.userData.animar(t, embiste > 0);
            hitT = Math.max(0, hitT - dt);
            zMats.forEach(({ m, e, i }) => { if (hitT > 0) { m.emissive.set('#ff2020'); m.emissiveIntensity = 1.2; } else { m.emissive.copy(e); m.emissiveIntensity = i; } });
            if (hitT > 0) zombi.position.x += Math.sin(t * 80) * 0.06;
            escudoT = Math.max(0, escudoT - dt * 1.2);
            escudo.visible = escudoT > 0; escudo.scale.setScalar(1 + (1 - escudoT) * 0.6); escudo.material.opacity = escudoT;

            // cámara
            let objCam, objMira;
            if (enSala) { objMira = new THREE.Vector3(sAct.x, sAct.y + 1.3, -0.3); objCam = new THREE.Vector3(sAct.x + Math.sin(t * 0.25) * 0.8, sAct.y + 2.5, D / 2 + 5.8); }
            else if (pelea) { objMira = new THREE.Vector3(0, -H + 1.2, -0.3); objCam = new THREE.Vector3(Math.sin(t * 0.3) * 1.2, -H + 2.0, D / 2 + 6.2); }
            else { const dist = Math.max(13, L.ancho * 1.25 + L.alto * 0.9); objMira = new THREE.Vector3(0, L.alto * 0.45, D / 2 + 1); objCam = new THREE.Vector3(Math.sin(t * 0.15) * 3, L.alto * 0.55 + 2.2, D / 2 + dist); }
            const k = Math.min(1, dt * 1.6);
            camPos.lerp(objCam, k); camMira.lerp(objMira, k);
            camera.position.copy(camPos);
            if (temblor > 0) { temblor = Math.max(0, temblor - dt); camera.position.x += (Math.random() - 0.5) * temblor * 0.5; camera.position.y += (Math.random() - 0.5) * temblor * 0.5; }
            camera.lookAt(camMira);
            renderer.render(scene, camera);
        };
        bucle();

        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            avatares.forEach(a => liberar(a.raiz));
            scene.traverse(o => {
                if (o.geometry) o.geometry.dispose();
                if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.map?.dispose(); m.dispose(); });
            });
            renderer.dispose();
            renderer.domElement.remove();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [firma]);

    return <div ref={contRef} style={{ width: '100%', height: props.alto || 420, borderRadius: 18, overflow: 'hidden', position: 'relative', background: '#120726' }} />;
}

/** Vista previa giratoria de un avatar (editor de disfraces del alumno). */
export function AvatarPreview3D({ avatar, size = 220 }) {
    const contRef = useRef(null);
    const estado = useRef(null);
    useEffect(() => {
        const cont = contRef.current; if (!cont) return;
        let renderer;
        try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { return; }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.setSize(size, size);
        cont.appendChild(renderer.domElement);
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
        camera.position.set(0, 1.15, 4.2); camera.lookAt(0, 0.95, 0);
        scene.add(new THREE.HemisphereLight('#c4b5fd', '#2e1065', 1.6));
        const d = new THREE.DirectionalLight('#ffffff', 1.6); d.position.set(2, 4, 3); scene.add(d);
        const luzN = new THREE.PointLight('#ff8c1a', 6, 6); luzN.position.set(-1.5, 0.6, 1.5); scene.add(luzN);
        const peana = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.12, 32), new THREE.MeshStandardMaterial({ color: '#3b1d5e' }));
        peana.position.y = -0.06; scene.add(peana);
        const st = { renderer, scene, camera, modelo: null, raf: 0 };
        estado.current = st;
        const reloj = new THREE.Clock();
        const bucle = () => {
            st.raf = requestAnimationFrame(bucle);
            const t = reloj.getElapsedTime();
            if (st.modelo) {
                st.modelo.rotation.y = Math.sin(t * 0.8) * 0.9;
                st.modelo.position.y = st.modelo.userData.flota ? 0.12 + Math.sin(t * 2) * 0.06 : 0;
                st.modelo.userData.animar?.(t, false, 0);
            }
            renderer.render(scene, camera);
        };
        bucle();
        return () => {
            cancelAnimationFrame(st.raf);
            if (st.modelo) liberar(st.modelo);
            liberar(peana);
            renderer.dispose(); renderer.domElement.remove();
            estado.current = null;
        };
    }, [size]);

    const firma = JSON.stringify(avatar || {});
    useEffect(() => {
        const st = estado.current; if (!st) return;
        if (st.modelo) { st.scene.remove(st.modelo); liberar(st.modelo); }
        st.modelo = crearAvatar3D(avatar);
        st.scene.add(st.modelo);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [firma, size]);

    return <div ref={contRef} style={{ width: size, height: size, margin: '0 auto' }} />;
}
