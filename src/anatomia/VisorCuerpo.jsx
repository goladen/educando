import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { fichaDe as fichaHueso, PREGUNTABLES } from './fichasEsqueleto';
import { FICHAS_MUSCULOS, PREGUNTABLES_MUSCULOS } from './fichasMusculos';
import { FICHAS_ORGANOS, PREGUNTABLES_ORGANOS } from './fichasOrganos';
import { MOVIMIENTOS } from './movimientos';
import { ModalEnviarCuerpo, ModalFichaCuerpo } from './EnvioYFicha';
import { guardarRegistroLocal } from '../utils/registrosLocales';
import { sonidoCorrecto, sonidoIncorrecto, sonidoFinal } from '../utils/sonidosFeedback';

// ─── Cuerpo humano 3D: esqueleto y músculos (capas) ─────────────────────────
// Modelo: atlas Z-Anatomy (CC BY-SA 4.0), a partir de BodyParts3D (DBCLS, CC BY-SA 2.1 JP),
// preparado con scripts/blender/anatomia_exportar.py + scripts/anatomia/generar_esqueleto.mjs.
// Cada hueso es una malla con el origen en su centro: se puede separar y girar sola.

const RUTA = '/anatomia/';
// Capas del cuerpo: cada una es un .glb + .json en public/anatomia (misma escala y origen)
export const CAPAS = [
    { id: 'esqueleto', nombre: 'Huesos', emoji: '🦴' },
    { id: 'musculos', nombre: 'Músculos', emoji: '💪' },
    { id: 'organos', nombre: 'Órganos', emoji: '🫀' },
];
const COLOR_CAPA = { esqueleto: '#e2e8f0', musculos: '#fb7185', organos: '#fbbf24' };
const PREGUNTAS_CAPA = { esqueleto: PREGUNTABLES, musculos: PREGUNTABLES_MUSCULOS, organos: PREGUNTABLES_ORGANOS };
const NOMBRE_CAPA = { esqueleto: 'huesos', musculos: 'músculos', organos: 'órganos' };
const ORDEN_ZONAS = ['cabeza', 'columna', 'torax', 'espalda', 'abdomen', 'brazo', 'mano', 'pierna', 'pie'];
const FICHA_MUSCULO_GENERICA = {
    que: 'Músculo esquelético: se une a los huesos mediante tendones.',
    funcion: 'Al contraerse tira de los huesos y produce el movimiento.',
    curiosidad: 'El cuerpo humano tiene más de 600 músculos esqueléticos.',
};
const FICHA_ORGANO_GENERICA = {
    que: 'Órgano del cuerpo humano.',
    funcion: 'Los órganos se agrupan en aparatos y sistemas que trabajan juntos para mantenernos vivos.',
    curiosidad: 'Cada órgano está formado por tejidos, y cada tejido por millones de células.',
};
const fichaDe = (p) => {
    if (p?.sistema === 'musculos') return FICHAS_MUSCULOS[p.en] || FICHA_MUSCULO_GENERICA;
    if (p?.sistema === 'organos') return FICHAS_ORGANOS[p.en] || FICHA_ORGANO_GENERICA;
    return fichaHueso(p);
};
const CENTRO_Y = 0.95;
const AZUL = '#38bdf8';
const N_PREGUNTAS = 10;

const COLOR_SEL = new THREE.Color(0x2563eb);
const COLOR_HOVER = new THREE.Color(0x1e3a8a);
const COLOR_OK = new THREE.Color(0x16a34a);
const COLOR_MAL = new THREE.Color(0xdc2626);
const COLOR_PISTA = new THREE.Color(0xf59e0b);
const COLOR_CONTRAE = new THREE.Color(0xef4444);
const COLOR_RELAJA = new THREE.Color(0x3b82f6);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

const suave = (k, dt) => 1 - Math.exp(-k * dt);
const barajar = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ─── Escena three.js (fuera de React) ────────────────────────────────────────
function crearVisor(contenedor, cb) {
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local-floor');
    contenedor.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';

    const escena = new THREE.Scene();
    escena.background = new THREE.Color(0x0f172a);
    // todo el cuerpo cuelga de este grupo: en realidad virtual se coloca delante del usuario
    const cuerpo = new THREE.Group();
    escena.add(cuerpo);
    const camara = new THREE.PerspectiveCamera(40, 1, 0.01, 50);
    camara.position.set(0, 1.05, 3.4);
    const controles = new OrbitControls(camara, renderer.domElement);
    controles.target.set(0, CENTRO_Y, 0);
    controles.enableDamping = true;
    controles.minDistance = 0.15;
    controles.maxDistance = 7;

    escena.add(new THREE.HemisphereLight(0xf8fafc, 0x334155, 1.3));
    const clave = new THREE.DirectionalLight(0xffffff, 2.2); clave.position.set(2, 4, 3); escena.add(clave);
    const contra = new THREE.DirectionalLight(0x93c5fd, 1.2); contra.position.set(-3, 2, -3); escena.add(contra);
    const frente = new THREE.DirectionalLight(0xffffff, 0.6); frente.position.set(0, 1, 5); escena.add(frente);

    // suelo: disco con degradado
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(56,189,248,0.35)'); g.addColorStop(0.6, 'rgba(56,189,248,0.08)'); g.addColorStop(1, 'rgba(56,189,248,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
    const texSuelo = new THREE.CanvasTexture(c);
    const suelo = new THREE.Mesh(new THREE.CircleGeometry(1.2, 48), new THREE.MeshBasicMaterial({ map: texSuelo, transparent: true, depthWrite: false }));
    suelo.rotation.x = -Math.PI / 2; suelo.position.y = 0.002;
    cuerpo.add(suelo);

    const mallas = [];
    const estado = {
        seleccion: null, hover: null, separadas: new Set(), zonas: null, despiece: 0,
        aislar: false, transparentar: true, flashes: new Map(), foco: null,
        capas: Object.fromEntries(CAPAS.map(c => [c.id, { visible: true, opacidad: 1 }])),
        aparatos: null,
        opacidadExtra: null, // Map id → opacidad máxima (p. ej. pulmones en el juego de órganos)
        mov: null, roles: null, // movimiento en curso y papel de cada músculo (contrae / relaja)
    };

    // ── Carga ──
    const draco = new DRACOLoader().setDecoderPath('/draco/');
    const loader = new GLTFLoader().setDRACOLoader(draco);
    const cargarCapa = (capa) => Promise.all([
        fetch(RUTA + capa.id + '.json').then(r => { if (!r.ok) throw new Error('No se encontró ' + capa.id + '.json'); return r.json(); }),
        loader.loadAsync(RUTA + capa.id + '.glb'),
    ]);
    Promise.all(CAPAS.map(cargarCapa)).then((cargadas) => {
        if (destruido) return;
        const resultado = [];
        cargadas.forEach(([datos, gltf], i) => {
        const capa = CAPAS[i].id;
        const porId = new Map();
        datos.piezas.forEach(p => {
            p.sistema = capa;
            porId.set(p.id, p);
            porId.set(THREE.PropertyBinding.sanitizeNodeName(p.id), p);
        });
        gltf.scene.traverse(o => {
            if (!o.isMesh) return;
            const pieza = porId.get(o.userData.name) || porId.get(o.name);
            if (!pieza) return;
            o.userData.capa = capa;
            o.material = o.material.clone(); // cada hueso con su material para resaltarlo
            o.material.transparent = true;
            o.userData.pieza = pieza;
            o.userData.base = { pos: o.position.clone(), quat: o.quaternion.clone(), escala: o.scale.x };
            o.userData.opacidad = 1;
            const t = pieza.tam; const maxDim = Math.max(t[0], t[1], t[2]);
            o.userData.escalaSeparada = THREE.MathUtils.clamp(0.28 / maxDim, 1, 6);
            mallas.push(o);
        });
        cuerpo.add(gltf.scene);
        resultado.push({ id: capa, ...datos });
        });
        cb.onCargado(resultado);
    }).catch(e => cb.onError(e));

    // ── Tamaño ──
    const redimensionar = () => {
        const w = contenedor.clientWidth || 1, h = contenedor.clientHeight || 1;
        renderer.setSize(w, h);
        camara.aspect = w / h;
        camara.fov = w / h < 0.8 ? 55 : 40;
        camara.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(redimensionar);
    ro.observe(contenedor);
    redimensionar();

    // ── Selección con el puntero (sin confundir con girar la cámara) ──
    const ray = new THREE.Raycaster();
    const puntero = new THREE.Vector2();
    let abajo = null;
    const tocar = (e) => {
        const r = renderer.domElement.getBoundingClientRect();
        puntero.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(puntero, camara);
        const visibles = mallas.filter(m => m.visible && m.userData.opacidad > 0.5);
        const hit = ray.intersectObjects(visibles, false)[0];
        return hit ? hit.object : null;
    };
    const alBajar = (e) => { abajo = { x: e.clientX, y: e.clientY }; };
    const alSubir = (e) => {
        if (!abajo) return;
        const movido = Math.hypot(e.clientX - abajo.x, e.clientY - abajo.y);
        abajo = null;
        if (movido > 6) return;
        cb.onToque(tocar(e)?.userData.pieza || null);
    };
    let ultimoHover = 0;
    const alMover = (e) => {
        if (e.pointerType !== 'mouse' || abajo) return;
        const ahora = performance.now();
        if (ahora - ultimoHover < 60) return;
        ultimoHover = ahora;
        const m = tocar(e);
        estado.hover = m;
        renderer.domElement.style.cursor = m ? 'pointer' : 'grab';
        cb.onHover(m?.userData.pieza || null);
    };
    renderer.domElement.addEventListener('pointerdown', alBajar);
    renderer.domElement.addEventListener('pointerup', alSubir);
    renderer.domElement.addEventListener('pointermove', alMover);
    controles.addEventListener('start', () => { estado.foco = null; });

    // ── Posición objetivo de cada hueso (despiece y separado) ──
    const v = new THREE.Vector3();
    const objetivo = (m) => {
        const base = m.userData.base;
        const p = m.userData.pieza;
        const pos = base.pos.clone();
        if (estado.despiece > 0) {
            // se aleja del eje del cuerpo; manos y pies se abren algo más
            const extra = p.zona === 'mano' || p.zona === 'pie' ? 1.5 : 1;
            v.set(p.centro[0] * 1.3 * extra, (p.centro[1] - CENTRO_Y) * 0.55, p.centro[2] * 1.6 + 0.02);
            pos.addScaledVector(v, estado.despiece);
        }
        let escala = base.escala;
        if (estado.separadas.has(p.id)) {
            // hacia delante y hacia fuera del cuerpo, más grande si es pequeño
            v.set(p.centro[0], 0, 0);
            if (Math.abs(v.x) < 0.05) v.x = 0.0001;
            v.normalize().multiplyScalar(0.45);
            pos.add(v); pos.z += 0.45;
            escala = base.escala * m.userData.escalaSeparada;
        }
        return { pos, escala };
    };

    const posicionMundo = (pieza) => {
        const m = mallas.find(x => x.userData.pieza.id === pieza.id);
        if (!m) return null;
        return objetivo(m).pos;
    };

    // ── Movimientos: huesos que giran en una articulación y músculos que se deforman ──
    const mallaDe = (id) => mallas.find(m => m.userData.pieza.id === id);
    // posiciones en el espacio del cuerpo (la pieza en su sitio, sin separar)
    const posOriginal = (m) => {
        if (!m.userData.posOriginal) {
            m.userData.posOriginal = m.geometry.attributes.position.array.slice();
            m.userData.normalOriginal = m.geometry.attributes.normal?.array.slice();
        }
        return m.userData.posOriginal;
    };
    const ctxPivote = {
        // media de los vértices en la banda más alta/baja de una pieza (p. ej. el extremo del húmero)
        extremo(id, lado, { banda = 0.02, preferir } = {}) {
            const m = mallaDe(id);
            if (!m) return new THREE.Vector3(0, CENTRO_Y, 0);
            const arr = posOriginal(m); const b = m.userData.base.pos;
            let ext = lado === 'max' ? -Infinity : Infinity;
            for (let i = 1; i < arr.length; i += 3) ext = lado === 'max' ? Math.max(ext, arr[i]) : Math.min(ext, arr[i]);
            let pts = [];
            for (let i = 0; i < arr.length; i += 3) {
                if (Math.abs(arr[i + 1] - ext) <= banda) pts.push(new THREE.Vector3(arr[i] + b.x, arr[i + 1] + b.y, arr[i + 2] + b.z));
            }
            if (preferir === 'medial') pts = pts.sort((u, w) => Math.abs(u.x) - Math.abs(w.x)).slice(0, Math.max(1, Math.round(pts.length * 0.4)));
            if (preferir === 'posterior') pts = pts.sort((u, w) => u.z - w.z).slice(0, Math.max(1, Math.round(pts.length * 0.4)));
            return pts.reduce((acc, v) => acc.add(v), new THREE.Vector3()).divideScalar(pts.length || 1);
        },
        centro(id) { const m = mallaDe(id); return m ? m.userData.base.pos.clone() : new THREE.Vector3(0, CENTRO_Y, 0); },
    };
    const restaurarGeometria = (m) => {
        const g = m.geometry;
        g.attributes.position.array.set(m.userData.posOriginal);
        g.attributes.position.needsUpdate = true;
        if (m.userData.normalOriginal && g.attributes.normal) { g.attributes.normal.array.set(m.userData.normalOriginal); g.attributes.normal.needsUpdate = true; }
        g.computeBoundingSphere();
    };
    const detenerMovimiento = () => {
        if (!estado.mov) return;
        estado.mov.deformados.forEach(d => restaurarGeometria(d.m));
        estado.mov = null;
        estado.roles = null;
    };
    const iniciarMovimiento = (def) => {
        detenerMovimiento();
        const pivote = def.pivote(ctxPivote);
        const eje = new THREE.Vector3(...def.eje).normalize();
        const rigidos = new Map();
        const deformados = [];
        mallas.forEach(m => {
            const factor = def.rigidos(m.userData.pieza) || 0;
            if (factor > 0) rigidos.set(m, factor);
        });
        // Nubes de puntos de los huesos que se mueven y de los huesos fijos cercanos a la
        // articulación: cada vértice de músculo sigue al hueso que tenga más cerca.
        const nube = (lista, maxTotal) => {
            const pts = [];
            lista.forEach(m => {
                const arr = posOriginal(m); const b = m.userData.base.pos;
                const n = arr.length / 3;
                const paso = Math.max(1, Math.floor(n / 90));
                for (let k = 0; k < n; k += paso) pts.push(arr[k * 3] + b.x, arr[k * 3 + 1] + b.y, arr[k * 3 + 2] + b.z);
            });
            // si hay demasiados puntos, se aclara la nube por igual
            const total = pts.length / 3;
            if (total <= maxTotal) return new Float32Array(pts);
            const salto = total / maxTotal; const out = [];
            for (let i = 0; i < maxTotal; i++) { const k = Math.floor(i * salto) * 3; out.push(pts[k], pts[k + 1], pts[k + 2]); }
            return new Float32Array(out);
        };
        const huesos = mallas.filter(m => m.userData.capa === 'esqueleto');
        const moviles = nube(huesos.filter(m => rigidos.get(m) === 1), 1400);
        const cercaDelPivote = (m) => {
            const arr = posOriginal(m); const b = m.userData.base.pos; const n = arr.length / 3;
            const paso = Math.max(1, Math.floor(n / 40));
            for (let k = 0; k < n; k += paso) {
                const dx = arr[k * 3] + b.x - pivote.x, dy = arr[k * 3 + 1] + b.y - pivote.y, dz = arr[k * 3 + 2] + b.z - pivote.z;
                if (dx * dx + dy * dy + dz * dz < 0.45 * 0.45) return true;
            }
            return false;
        };
        const fijos = nube(huesos.filter(m => !rigidos.has(m) && cercaDelPivote(m)), 1800);
        const distancia2 = (nubePts, x, y, z) => {
            let min = Infinity;
            for (let j = 0; j < nubePts.length; j += 3) {
                const dx = nubePts[j] - x, dy = nubePts[j + 1] - y, dz = nubePts[j + 2] - z;
                const d = dx * dx + dy * dy + dz * dz;
                if (d < min) min = d;
            }
            return min;
        };
        const transicion = def.deformar?.mezcla ?? 0.03;
        mallas.forEach(m => {
            const p = m.userData.pieza;
            if (rigidos.has(m) || !def.deformar || !def.deformar.filtro(p) || !moviles.length) return;
            const arr = posOriginal(m); const b = m.userData.base.pos;
            const pesos = new Float32Array(arr.length / 3);
            let alguno = false;
            for (let i = 0, k = 0; i < arr.length; i += 3, k++) {
                const x = arr[i] + b.x, y = arr[i + 1] + b.y, z = arr[i + 2] + b.z;
                const dM = Math.sqrt(distancia2(moviles, x, y, z));
                const dF = fijos.length ? Math.sqrt(distancia2(fijos, x, y, z)) : Infinity;
                // 1 si está claramente más cerca de un hueso que se mueve; transición suave en medio
                const w = smooth(-transicion, transicion, dF - dM);
                pesos[k] = w;
                if (w > 0.002) alguno = true;
            }
            if (alguno) deformados.push({ m, pesos });
        });
        estado.mov = { def, pivote, eje, rigidos, deformados, t: 0, f: 0, fase: null, reproducir: true, velocidad: 1, manual: null, cuadro: 0 };
        estado.foco = { objetivo: pivote.clone(), distancia: def.distancia, direccion: def.vista ? new THREE.Vector3(...def.vista).normalize() : null };
    };
    const qMov = new THREE.Quaternion();
    const qFactor = new THREE.Quaternion();
    const mRot = new THREE.Matrix3();
    const actualizarMovimiento = (dt) => {
        const mv = estado.mov;
        const { def } = mv;
        // fracción del recorrido (0 = inicio, 1 = final) y fase
        let f; let fase;
        if (mv.manual !== null) {
            f = mv.manual;
            fase = f > mv.f + 1e-4 ? 'ida' : f < mv.f - 1e-4 ? 'vuelta' : (mv.fase || 'ida');
        } else {
            if (mv.reproducir) mv.t += dt * mv.velocidad;
            const T = 2.2, P = 0.6, C = 2 * (T + P);
            const u = mv.t % C;
            if (u < T) { f = ease(u / T); fase = 'ida'; }
            else if (u < T + P) { f = 1; fase = 'ida'; }
            else if (u < 2 * T + P) { f = 1 - ease((u - T - P) / T); fase = 'vuelta'; }
            else { f = 0; fase = 'vuelta'; }
        }
        mv.f = f;
        if (fase !== mv.fase) {
            mv.fase = fase;
            const roles = new Map();
            def[fase].agonistas.forEach(id => roles.set(id, 'contrae'));
            def[fase].antagonistas.forEach(id => roles.set(id, 'relaja'));
            estado.roles = roles;
            cb.onFase?.(fase);
        }
        cb.onAvance?.(f);
        const angulo = THREE.MathUtils.lerp(def.rango[0], def.rango[1], f);
        qMov.setFromAxisAngle(mv.eje, angulo);
        // piezas rígidas: giran alrededor del pivote
        mv.rigidos.forEach((factor, m) => {
            const q = factor === 1 ? qMov : qFactor.setFromAxisAngle(mv.eje, angulo * factor);
            m.position.copy(m.userData.base.pos).sub(mv.pivote).applyQuaternion(q).add(mv.pivote);
            m.quaternion.copy(q).multiply(m.userData.base.quat);
        });
        // músculos que cruzan la articulación: cada vértice gira según su peso
        mRot.setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(qMov));
        const e = mRot.elements; const pv = mv.pivote;
        mv.cuadro++;
        mv.deformados.forEach(({ m, pesos }) => {
            const orig = m.userData.posOriginal; const arr = m.geometry.attributes.position.array; const b = m.userData.base.pos;
            for (let i = 0, k = 0; i < orig.length; i += 3, k++) {
                const w = pesos[k];
                if (w <= 0.002) { arr[i] = orig[i]; arr[i + 1] = orig[i + 1]; arr[i + 2] = orig[i + 2]; continue; }
                const x = orig[i] + b.x - pv.x, y = orig[i + 1] + b.y - pv.y, z = orig[i + 2] + b.z - pv.z;
                const rx = e[0] * x + e[3] * y + e[6] * z, ry = e[1] * x + e[4] * y + e[7] * z, rz = e[2] * x + e[5] * y + e[8] * z;
                arr[i] = orig[i] + w * (rx - x); arr[i + 1] = orig[i + 1] + w * (ry - y); arr[i + 2] = orig[i + 2] + w * (rz - z);
            }
            m.geometry.attributes.position.needsUpdate = true;
            if (mv.cuadro % 3 === 0) m.geometry.computeVertexNormals(); // la luz sigue a la deformación
        });
    };

    // ── Realidad virtual: mandos con rayo, joystick y panel de información ──
    const rayoVR = new THREE.Raycaster();
    const mRotVR = new THREE.Matrix4();
    const geoRayoVR = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
    const mandos = [0, 1].map(i => {
        const ctrl = renderer.xr.getController(i);
        const linea = new THREE.Line(geoRayoVR, new THREE.LineBasicMaterial({ color: 0x38bdf8 }));
        linea.scale.z = 3;
        ctrl.add(linea);
        escena.add(ctrl);
        const grip = renderer.xr.getControllerGrip(i);
        const mango = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.07, 6, 12), new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 }));
        mango.rotation.x = Math.PI / 2.4;
        grip.add(mango);
        escena.add(grip);
        const info = { ctrl, linea, gamepad: null };
        ctrl.addEventListener('connected', (e) => { info.gamepad = e.data.gamepad || null; });
        ctrl.addEventListener('disconnected', () => { info.gamepad = null; });
        ctrl.addEventListener('selectstart', () => { const m = piezaBajoMando(ctrl); cb.onToque(m?.userData.pieza || null); });
        ctrl.addEventListener('squeezestart', () => cb.onApretar?.());
        return info;
    });
    const piezaBajoMando = (ctrl) => {
        mRotVR.identity().extractRotation(ctrl.matrixWorld);
        rayoVR.ray.origin.setFromMatrixPosition(ctrl.matrixWorld);
        rayoVR.ray.direction.set(0, 0, -1).applyMatrix4(mRotVR);
        const visibles = mallas.filter(m => m.visible && m.userData.opacidad > 0.5);
        const hit = rayoVR.intersectObjects(visibles, false)[0];
        return hit ? { ...hit.object, userData: hit.object.userData, distancia: hit.distance, malla: hit.object } : null;
    };
    const actualizarVR = (dt) => {
        let hover = null;
        mandos.forEach(md => {
            const r = piezaBajoMando(md.ctrl);
            md.linea.scale.z = r ? r.distancia : 3;
            if (r && !hover) hover = r.malla;
            const ax = md.gamepad?.axes;
            if (!ax) return;
            const x = ax[2] ?? ax[0] ?? 0, y = ax[3] ?? ax[1] ?? 0;
            if (Math.abs(x) > 0.2) cuerpo.rotation.y += x * dt * 1.6;      // girar el cuerpo
            if (Math.abs(y) > 0.2) cuerpo.position.z = THREE.MathUtils.clamp(cuerpo.position.z + y * dt * 0.9, -4, -0.4); // acercar / alejar
        });
        estado.hover = hover;
    };
    // panel flotante (en VR no se ven los paneles HTML)
    const lienzoPanel = document.createElement('canvas');
    lienzoPanel.width = 1024; lienzoPanel.height = 560;
    const texPanel = new THREE.CanvasTexture(lienzoPanel);
    texPanel.colorSpace = THREE.SRGBColorSpace;
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.45), new THREE.MeshBasicMaterial({ map: texPanel, transparent: true }));
    panel.position.set(0.72, 1.4, 0.2);
    panel.rotation.y = -0.4;
    panel.visible = false;
    cuerpo.add(panel);
    const dibujarPanel = ({ titulo = '', lineas = [], color = '#38bdf8' } = {}) => {
        const ctx = lienzoPanel.getContext('2d');
        ctx.clearRect(0, 0, 1024, 560);
        ctx.fillStyle = 'rgba(15,23,42,0.93)';
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(4, 4, 1016, 552, 36) : ctx.rect(4, 4, 1016, 552); ctx.fill();
        ctx.strokeStyle = color; ctx.lineWidth = 6; ctx.stroke();
        ctx.fillStyle = color; ctx.font = 'bold 58px system-ui, sans-serif';
        ctx.fillText(titulo, 40, 90, 944);
        ctx.fillStyle = '#e2e8f0'; ctx.font = '36px system-ui, sans-serif';
        let yy = 160;
        lineas.forEach(texto => {
            const palabras = String(texto).split(' ');
            let linea = '';
            palabras.forEach(p => {
                const prueba = linea ? linea + ' ' + p : p;
                if (ctx.measureText(prueba).width > 944 && linea) { ctx.fillText(linea, 40, yy); yy += 46; linea = p; }
                else linea = prueba;
            });
            if (linea) { ctx.fillText(linea, 40, yy); yy += 46; }
            yy += 14;
        });
        texPanel.needsUpdate = true;
    };
    const alEmpezarVR = () => {
        cuerpo.position.set(0, 0, -1.3); cuerpo.rotation.set(0, 0, 0);
        panel.visible = true;
        estado.foco = null;
        cb.onVR?.(true);
    };
    const alTerminarVR = () => {
        cuerpo.position.set(0, 0, 0); cuerpo.rotation.set(0, 0, 0);
        panel.visible = false;
        mandos.forEach(md => { md.linea.scale.z = 3; });
        cb.onVR?.(false);
    };
    renderer.xr.addEventListener('sessionstart', alEmpezarVR);
    renderer.xr.addEventListener('sessionend', alTerminarVR);
    let quitarBotonVR = null;

    // ── Captura para la ficha PDF: fondo blanco, la capa elegida y el esqueleto tenue ──
    const capturarFicha = ({ capa, candidatos, max }) => {
        const W = 900, H = 1350;
        const r2 = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        r2.setPixelRatio(1); r2.setSize(W, H, false);
        r2.toneMapping = renderer.toneMapping; r2.toneMappingExposure = renderer.toneMappingExposure;
        const guardado = mallas.map(m => ({ m, visible: m.visible, opacidad: m.material.opacity, depth: m.material.depthWrite, emis: m.material.emissive.clone(), pos: m.position.clone(), quat: m.quaternion.clone(), esc: m.scale.x }));
        const fondoAntes = escena.background; const sueloAntes = suelo.visible;
        const cuerpoPos = cuerpo.position.clone(); const cuerpoRot = cuerpo.rotation.y;
        cuerpo.position.set(0, 0, 0); cuerpo.rotation.set(0, 0, 0); cuerpo.updateMatrixWorld(true);
        mallas.forEach(m => {
            const b = m.userData.base;
            m.position.copy(b.pos); m.quaternion.copy(b.quat); m.scale.setScalar(b.escala);
            const c = m.userData.capa;
            const principal = c === capa;
            m.visible = principal || (c === 'esqueleto' && capa !== 'esqueleto');
            m.material.opacity = principal ? 1 : 0.13;
            m.material.depthWrite = principal;
            m.material.emissive.setRGB(0, 0, 0);
            m.updateMatrixWorld(true);
        });
        escena.background = new THREE.Color(0xffffff); suelo.visible = false;
        // encuadre: caja de las piezas candidatas
        const ids = new Set(candidatos.map(p => p.id));
        const elegidas = mallas.filter(m => ids.has(m.userData.pieza.id));
        const caja = new THREE.Box3();
        elegidas.forEach(m => caja.expandByObject(m));
        const centro = caja.getCenter(new THREE.Vector3()); const tam = caja.getSize(new THREE.Vector3());
        const cam = new THREE.PerspectiveCamera(28, W / H, 0.01, 50);
        const tg = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
        const dist = Math.max(tam.y / (2 * tg), tam.x / (2 * tg * cam.aspect)) * 1.18 + tam.z / 2;
        cam.position.set(centro.x, centro.y, centro.z + dist);
        cam.lookAt(centro);
        cam.updateMatrixWorld(true);
        r2.render(escena, cam);
        const url = r2.domElement.toDataURL('image/jpeg', 0.88); // JPEG: el PDF pesa diez veces menos que con PNG
        // puntos numerados: centro de cada pieza, sin solaparse, dentro de la imagen y VISIBLE
        // (un rayo desde la cámara debe tocar primero esa pieza: nada de órganos escondidos)
        const puntos = [];
        const v = new THREE.Vector3();
        const rayoFicha = new THREE.Raycaster();
        const opacas = mallas.filter(m => m.visible && m.userData.capa === capa);
        for (const m of elegidas) {
            if (puntos.length >= max) break;
            const c3 = new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3());
            rayoFicha.set(cam.position, c3.clone().sub(cam.position).normalize());
            const primero = rayoFicha.intersectObjects(opacas, false)[0];
            if (!primero || primero.object !== m) continue;
            // el número va donde el rayo toca la superficie de la pieza
            v.copy(primero.point).project(cam);
            const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H;
            if (x < 30 || x > W - 30 || y < 30 || y > H - 30) continue;
            if (puntos.some(p => Math.hypot(p.x - x, p.y - y) < 46)) continue;
            puntos.push({ id: m.userData.pieza.id, x, y });
        }
        puntos.sort((a, b) => a.y - b.y || a.x - b.x);
        // restaurar
        guardado.forEach(g => {
            g.m.visible = g.visible; g.m.material.opacity = g.opacidad; g.m.material.depthWrite = g.depth;
            g.m.material.emissive.copy(g.emis); g.m.position.copy(g.pos); g.m.quaternion.copy(g.quat); g.m.scale.setScalar(g.esc);
        });
        escena.background = fondoAntes; suelo.visible = sueloAntes;
        cuerpo.position.copy(cuerpoPos); cuerpo.rotation.y = cuerpoRot;
        r2.dispose(); r2.forceContextLoss();
        return { url, ancho: W, alto: H, puntos };
    };

    // ── Bucle ──
    const reloj = new THREE.Timer();
    reloj.connect(document);
    let destruido = false;
    const bucle = (marca) => {
        if (destruido) return;
        reloj.update(marca);
        const dt = Math.min(reloj.getDelta(), 0.05);
        const t = reloj.getElapsed();
        const sel = estado.seleccion;
        if (estado.mov) actualizarMovimiento(dt);

        mallas.forEach(m => {
            const p = m.userData.pieza;
            const ob = objetivo(m);
            if (!estado.mov?.rigidos.has(m)) m.position.lerp(ob.pos, suave(7, dt));
            const e = THREE.MathUtils.lerp(m.scale.x, ob.escala, suave(7, dt));
            m.scale.setScalar(e);
            if (estado.separadas.has(p.id)) m.rotation.y += dt * 0.6;
            else if (!estado.mov?.rigidos.has(m)) m.quaternion.slerp(m.userData.base.quat, suave(6, dt));

            // visibilidad: zonas + aislar
            const capa = estado.capas[m.userData.capa];
            const destacada = (sel && sel.id === p.id) || estado.separadas.has(p.id);
            const enZona = (!estado.zonas || estado.zonas.has(p.zona))
                && (m.userData.capa !== 'organos' || !estado.aparatos || estado.aparatos.has(p.grupo));
            const aislada = estado.aislar && sel && !destacada;
            m.visible = (capa.visible || destacada) && enZona && !aislada;
            // transparencia: la de la capa y la del resto al seleccionar
            let opObj = destacada ? 1 : capa.opacidad;
            if (sel && estado.transparentar && !destacada) opObj = Math.min(opObj, 0.22);
            if (estado.opacidadExtra?.has(p.id)) opObj = Math.min(opObj, estado.opacidadExtra.get(p.id));
            m.userData.opacidad += (opObj - m.userData.opacidad) * suave(8, dt);
            m.material.opacity = m.userData.opacidad;
            m.material.depthWrite = m.userData.opacidad > 0.9;

            // color de resalte: destello (juego) > músculo que trabaja > selección > hover
            const fl = estado.flashes.get(p.id);
            const rol = estado.roles?.get(p.id);
            if (fl && fl.hasta > t) {
                m.material.emissive.copy(fl.color).multiplyScalar(0.5 + 0.5 * Math.abs(Math.sin(t * 8)));
            } else if (rol) {
                m.material.emissive.copy(rol === 'contrae' ? COLOR_CONTRAE : COLOR_RELAJA)
                    .multiplyScalar(rol === 'contrae' ? 0.5 + 0.25 * Math.sin(t * 6) : 0.35);
            } else if (sel && sel.id === p.id) {
                m.material.emissive.copy(COLOR_SEL).multiplyScalar(0.55 + 0.15 * Math.sin(t * 4));
            } else if (estado.hover === m) {
                m.material.emissive.copy(COLOR_HOVER);
            } else {
                m.material.emissive.setRGB(0, 0, 0);
            }
        });

        if (renderer.xr.isPresenting) actualizarVR(dt);
        // la cámara se acerca a lo seleccionado (hasta que el usuario la mueva)
        else if (estado.foco) {
            controles.target.lerp(estado.foco.objetivo, suave(4, dt));
            let dir = camara.position.clone().sub(controles.target);
            const d = dir.length();
            const nd = THREE.MathUtils.lerp(d, estado.foco.distancia, suave(3, dt));
            // con dirección fija (movimientos), la cámara además rodea al cuerpo hasta esa vista
            if (estado.foco.direccion) dir = dir.normalize().lerp(estado.foco.direccion, suave(2.5, dt));
            camara.position.copy(controles.target).add(dir.normalize().multiplyScalar(nd));
            const enVista = !estado.foco.direccion || dir.angleTo(estado.foco.direccion) < 0.02;
            if (controles.target.distanceTo(estado.foco.objetivo) < 0.002 && Math.abs(nd - estado.foco.distancia) < 0.01 && enVista) estado.foco = null;
        }
        if (!renderer.xr.isPresenting) controles.update();
        renderer.render(escena, camara);
    };
    renderer.setAnimationLoop(bucle);

    return {
        seleccionar(pieza, enfocar = true) {
            estado.seleccion = pieza;
            if (pieza && enfocar) {
                const pos = posicionMundo(pieza);
                const t = pieza.tam; const maxDim = Math.max(t[0], t[1], t[2]);
                if (pos) estado.foco = { objetivo: pos.clone(), distancia: THREE.MathUtils.clamp(maxDim * 5, 0.45, 2.6) };
            }
        },
        enfocar(pieza) {
            const pos = posicionMundo(pieza);
            const t = pieza.tam; const maxDim = Math.max(t[0], t[1], t[2]);
            if (pos) estado.foco = { objetivo: pos.clone(), distancia: THREE.MathUtils.clamp(maxDim * 6, 0.6, 2.6) };
        },
        separar(pieza, si) {
            if (si) estado.separadas.add(pieza.id); else estado.separadas.delete(pieza.id);
            if (estado.seleccion?.id === pieza.id) this.seleccionar(pieza);
        },
        devolverTodas() { estado.separadas.clear(); },
        setZonas(zonas) { estado.zonas = zonas; },
        setDespiece(v) { estado.despiece = v; },
        setAislar(v) { estado.aislar = v; },
        setTransparentar(v) { estado.transparentar = v; },
        setCapa(id, cambios) { Object.assign(estado.capas[id], cambios); },
        setAparatos(a) { estado.aparatos = a; },
        setOpacidadExtra(mapa) { estado.opacidadExtra = mapa; },
        iniciarMovimiento,
        detenerMovimiento,
        capturarFicha,
        panelVR: dibujarPanel,
        botonVR(contenedorBoton) {
            if (!navigator.xr?.isSessionSupported || !contenedorBoton) return;
            navigator.xr.isSessionSupported('immersive-vr').then(ok => {
                if (!ok || destruido) return;
                const btn = VRButton.createButton(renderer);
                Object.assign(btn.style, { position: 'static', transform: 'none', width: 'auto', margin: '0', borderRadius: '999px', fontSize: '0.82rem', padding: '6px 12px', opacity: '1' });
                contenedorBoton.appendChild(btn);
                quitarBotonVR = () => btn.remove();
            }).catch(() => {});
        },
        controlMovimiento(cambios) { if (estado.mov) Object.assign(estado.mov, cambios); },
        destello(pieza, tipo, segundos = 1.4) {
            const color = tipo === 'ok' ? COLOR_OK : tipo === 'mal' ? COLOR_MAL : COLOR_PISTA;
            estado.flashes.set(pieza.id, { color, hasta: reloj.getElapsed() + segundos });
        },
        vistaInicial() {
            estado.foco = { objetivo: new THREE.Vector3(0, CENTRO_Y, 0), distancia: 3.4 };
        },
        destruir() {
            detenerMovimiento();
            destruido = true;
            renderer.setAnimationLoop(null);
            quitarBotonVR?.();
            ro.disconnect();
            renderer.domElement.removeEventListener('pointerdown', alBajar);
            renderer.domElement.removeEventListener('pointerup', alSubir);
            renderer.domElement.removeEventListener('pointermove', alMover);
            controles.dispose();
            reloj.dispose();
            renderer.xr.removeEventListener('sessionstart', alEmpezarVR);
            renderer.xr.removeEventListener('sessionend', alTerminarVR);
            texPanel.dispose();
            escena.traverse(o => {
                if (o.geometry) o.geometry.dispose();
                if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
            });
            texSuelo.dispose();
            draco.dispose();
            renderer.dispose();
            if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
        },
    };
}

// ─── UI ──────────────────────────────────────────────────────────────────────
const boton = (activo, color = AZUL) => ({
    background: activo ? color : 'rgba(15,23,42,0.75)', color: activo ? '#0f172a' : '#e2e8f0',
    border: `1px solid ${activo ? color : 'rgba(148,163,184,0.35)'}`, borderRadius: 999,
    padding: '6px 12px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap',
});

// Junta las capas cargadas: todas las piezas y las zonas en el orden del cuerpo
const unirCapas = (capas) => {
    const piezas = capas.flatMap(c => c.piezas);
    const zonas = ORDEN_ZONAS.map(id => {
        const z = capas.flatMap(c => c.zonas).filter(x => x.id === id);
        return z.length ? { id, nombre: z[0].nombre, n: z.reduce((s, x) => s + x.n, 0) } : null;
    }).filter(Boolean);
    const aparatos = capas.find(c => c.id === 'organos')?.grupos || [];
    return { piezas, zonas, aparatos };
};

const nombreConLado = (p) => (p.lado ? `${p.nombre} · ${p.lado}` : p.nombre);

export default function VisorCuerpo({ onExit }) {
    const contRef = useRef(null);
    const visorRef = useRef(null);
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState('');
    const [sel, setSel] = useState(null);
    const [hover, setHover] = useState(null);
    const [separadas, setSeparadas] = useState(() => new Set());
    const [zonas, setZonas] = useState(null); // null = todas
    const [despiece, setDespiece] = useState(0);
    const [aislar, setAislar] = useState(false);
    const [transparentar, setTransparentar] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [capas, setCapas] = useState(() => Object.fromEntries(CAPAS.map(c => [c.id, { visible: true, opacidad: 1 }])));
    const [aparatos, setAparatos] = useState(null);
    // modo «Movimientos»
    const [movId, setMovId] = useState(MOVIMIENTOS[0].id);
    const [faseMov, setFaseMov] = useState(null);
    const [reproduciendo, setReproduciendo] = useState(true);
    const [velocidad, setVelocidad] = useState(1);
    const [manual, setManual] = useState(null);
    const [avance, setAvance] = useState(0);
    const avanceRef = useRef(0);
    const [verEnvio, setVerEnvio] = useState(false);
    const [verFicha, setVerFicha] = useState(false);
    const [enVR, setEnVR] = useState(false);
    const vrRef = useRef(null);
    const apretarRef = useRef(null);
    const [modo, setModo] = useState('explorar');
    const [quiz, setQuiz] = useState(null);
    const [aviso, setAviso] = useState(null);
    const [ancho, setAncho] = useState(() => window.innerWidth);
    const quizRef = useRef(null);
    quizRef.current = quiz;
    const modoRef = useRef(modo);
    modoRef.current = modo;

    useEffect(() => {
        const r = () => setAncho(window.innerWidth);
        window.addEventListener('resize', r);
        return () => window.removeEventListener('resize', r);
    }, []);

    useEffect(() => {
        const visor = crearVisor(contRef.current, {
            onCargado: (capas) => setDatos(unirCapas(capas)),
            onError: (e) => setError(e?.message || 'No se pudo cargar el modelo'),
            onHover: setHover,
            onToque: (pieza) => {
                if (modoRef.current === 'quiz') responderRef.current?.(pieza);
                else if (modoRef.current === 'explorar') elegir(pieza);
            },
            onFase: setFaseMov,
            onVR: setEnVR,
            onApretar: () => apretarRef.current?.(),
            onAvance: (f) => { avanceRef.current = f; },
        });
        visorRef.current = visor;
        visor.botonVR(vrRef.current);
        return () => { visor.destruir(); visorRef.current = null; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const elegir = (pieza) => {
        setSel(pieza);
        visorRef.current?.seleccionar(pieza);
    };

    // ── Modo «Movimientos» ──
    const movimiento = MOVIMIENTOS.find(m => m.id === movId);
    const entrarMovimientos = () => {
        if (!datos) return;
        setModo('movimiento'); setQuiz(null); setSel(null); visorRef.current?.seleccionar(null);
        setDespiece(0); setAislar(false); setZonas(null); setAparatos(null);
        visorRef.current?.devolverTodas(); setSeparadas(new Set());
        // huesos enteros y músculos algo transparentes para ver los dos a la vez
        setCapas(c => ({ ...c, esqueleto: { visible: true, opacidad: 1 }, musculos: { visible: true, opacidad: 0.75 }, organos: { ...c.organos, visible: false } }));
    };
    useEffect(() => {
        if (modo !== 'movimiento' || !datos || !movimiento) return undefined;
        visorRef.current?.iniciarMovimiento(movimiento);
        setFaseMov(null); setManual(null); setReproduciendo(true);
        return () => visorRef.current?.detenerMovimiento();
    }, [modo, movimiento, datos]);
    useEffect(() => { visorRef.current?.controlMovimiento({ reproducir: reproduciendo, velocidad, manual }); }, [reproduciendo, velocidad, manual, movimiento, modo]);
    useEffect(() => {
        if (modo !== 'movimiento') return undefined;
        const i = setInterval(() => setAvance(avanceRef.current), 120);
        return () => clearInterval(i);
    }, [modo]);
    // nombres de los músculos (si están los dos lados, se dice una vez)
    const nombresDe = (ids) => {
        if (!datos) return [];
        const vistos = new Map();
        ids.forEach(id => {
            const p = datos.piezas.find(x => x.id === id);
            if (!p) return;
            vistos.set(p.nombre, (vistos.get(p.nombre) || []).concat(p.lado || ''));
        });
        return [...vistos].map(([n, lados]) => (lados.length > 1 ? `${n} (los dos lados)` : lados[0] ? `${n} (${lados[0]})` : n));
    };

    // botón lateral del mando: separar / devolver la pieza seleccionada
    apretarRef.current = () => { if (sel && modo === 'explorar') separar(sel, !separadas.has(sel.id)); };
    // panel flotante en realidad virtual
    useEffect(() => {
        if (!enVR || !visorRef.current) return;
        let contenido;
        const objetivoVR = quiz && !quiz.fin ? datos?.piezas.find(p => p.en === quiz.preguntas[quiz.i] && p.sistema === quiz.capa) : null;
        if (modo === 'quiz' && quiz) {
            contenido = quiz.fin
                ? { titulo: `🏁 ${quiz.aciertos} de ${quiz.preguntas.length}`, lineas: ['Quita las gafas para enviar el resultado o pulsa «Otra vez».'], color: '#fbbf24' }
                : { titulo: `Toca: ${objetivoVR?.nombre || ''}`, lineas: [aviso?.texto || 'Apunta con el mando y pulsa el gatillo.'], color: '#fbbf24' };
        } else if (modo === 'quiz') {
            contenido = { titulo: '¿Dónde está?', lineas: ['Elige huesos, músculos u órganos en la pantalla.'], color: '#fbbf24' };
        } else if (modo === 'movimiento' && movimiento) {
            const fs = movimiento[faseMov || 'ida'];
            contenido = { titulo: `${movimiento.nombre}: ${fs.nombre}`, lineas: [`Se contraen: ${nombresDe(fs.agonistas).join(', ') || '—'}`, `Se relajan: ${nombresDe(fs.antagonistas).join(', ') || '—'}`], color: '#4ade80' };
        } else if (sel) {
            const fc = fichaDe(sel);
            contenido = { titulo: nombreConLado(sel), lineas: [fc.que, `Para qué sirve: ${fc.funcion}`] };
        } else {
            contenido = { titulo: 'Cuerpo humano 3D', lineas: ['Apunta a una pieza y pulsa el gatillo para ver qué es.', 'Botón lateral: separarla. Joystick: girar y acercar el cuerpo.'] };
        }
        visorRef.current.panelVR(contenido);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enVR, modo, sel, quiz, aviso, faseMov, movimiento, datos]);

    useEffect(() => { visorRef.current?.setZonas(zonas); }, [zonas]);
    useEffect(() => { visorRef.current?.setDespiece(despiece); }, [despiece]);
    useEffect(() => { visorRef.current?.setAislar(aislar); }, [aislar]);
    useEffect(() => { Object.entries(capas).forEach(([id, c]) => visorRef.current?.setCapa(id, c)); }, [capas, datos]);
    useEffect(() => { visorRef.current?.setAparatos(aparatos); }, [aparatos, datos]);
    const alternarAparato = (g) => setAparatos(a => {
        const n = new Set(a || []);
        if (n.has(g)) n.delete(g); else n.add(g);
        return n.size ? n : null;
    });
    const cambiarCapa = (id, cambios) => setCapas(c => ({ ...c, [id]: { ...c[id], ...cambios } }));
    useEffect(() => { visorRef.current?.setTransparentar(transparentar && modo === 'explorar'); }, [transparentar, modo]);

    const alternarZona = (id) => {
        setZonas(z => {
            const todas = datos.zonas.map(x => x.id);
            const actual = new Set(z || todas);
            if (z === null) return new Set([id]); // primera pulsación: solo esa zona
            if (actual.has(id)) actual.delete(id); else actual.add(id);
            return actual.size === 0 || actual.size === todas.length ? null : actual;
        });
    };

    const separar = (pieza, si) => {
        visorRef.current?.separar(pieza, si);
        setSeparadas(s => { const n = new Set(s); if (si) n.add(pieza.id); else n.delete(pieza.id); return n; });
    };

    const resultados = useMemo(() => {
        if (!datos || busqueda.trim().length < 2) return [];
        const q = busqueda.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        return datos.piezas.filter(p => norm(p.nombre).includes(q) || norm(p.tecnico).includes(q)).slice(0, 12);
    }, [busqueda, datos]);

    // ── Juego «¿Dónde está?» ──
    const empezarQuiz = (capa) => {
        const lista = PREGUNTAS_CAPA[capa];
        const disponibles = lista.filter(en => datos.piezas.some(p => p.en === en && p.sistema === capa));
        // huesos: se ocultan los músculos; músculos: se ven enteros encima de los huesos
        // huesos: solo esqueleto; músculos: enteros encima; órganos: esqueleto casi transparente (no se puede tocar)
        setCapas(c => ({
            ...c,
            esqueleto: { ...c.esqueleto, visible: true, opacidad: capa === 'organos' ? 0.18 : 1 },
            musculos: { ...c.musculos, visible: capa === 'musculos', opacidad: 1 },
            organos: { ...c.organos, visible: capa === 'organos', opacidad: 1 },
        }));
        setAparatos(null);
        const preguntas = barajar(disponibles).slice(0, N_PREGUNTAS);
        setModo('quiz'); setSel(null); visorRef.current?.seleccionar(null);
        setDespiece(0); setAislar(false); setZonas(null);
        visorRef.current?.devolverTodas(); setSeparadas(new Set());
        visorRef.current?.vistaInicial();
        setQuiz({ capa, preguntas, i: 0, aciertos: 0, fallos: 0, intentos: 0, fin: false, resultados: [], tocados: [] });
    };
    const objetivoQuiz = quiz && !quiz.fin ? datos?.piezas.find(p => p.en === quiz.preguntas[quiz.i] && p.sistema === quiz.capa) : null;
    // En el juego de órganos los pulmones tapan el corazón: se vuelven semitransparentes (y no se pueden
    // tocar) salvo cuando la pregunta es un pulmón.
    useEffect(() => {
        if (!datos || modo !== 'quiz' || quiz?.capa !== 'organos' || !objetivoQuiz) { visorRef.current?.setOpacidadExtra(null); return; }
        const pulmones = datos.piezas.filter(p => p.sistema === 'organos' && p.en.startsWith('pulmon_') && p.en !== objetivoQuiz.en);
        visorRef.current?.setOpacidadExtra(new Map(pulmones.map(p => [p.id, 0.3])));
    }, [datos, modo, quiz?.capa, objetivoQuiz]);

    const siguiente = (q, acierto) => {
        const n = { ...q, i: q.i + 1, intentos: 0, tocados: [], aciertos: q.aciertos + (acierto ? 1 : 0) };
        if (n.i >= q.preguntas.length) {
            n.fin = true;
            sonidoFinal();
            guardarRegistroLocal('CUERPO_HUMANO', { titulo: `Cuerpo humano 3D · ¿Dónde está? (${NOMBRE_CAPA[q.capa]})`, aciertos: n.aciertos, intentos: q.preguntas.length, via: 'juego' });
        }
        setQuiz(n);
    };
    const responderRef = useRef(null);
    responderRef.current = (pieza) => {
        const q = quizRef.current;
        if (!q || q.fin || !pieza) return;
        const objetivo = q.preguntas[q.i];
        const correctas = datos.piezas.filter(p => p.en === objetivo && p.sistema === q.capa);
        if (pieza.en === objetivo && pieza.sistema === q.capa) {
            sonidoCorrecto();
            visorRef.current?.destello(pieza, 'ok');
            setAviso({ tipo: 'ok', texto: `¡Sí! ${nombreConLado(pieza)}` });
            quizRef.current = { ...q, resultados: [...q.resultados, { pregunta: pieza.nombre, acierto: true, intentos: q.intentos + 1, tocados: q.tocados }] };
            setQuiz(quizRef.current);
            setTimeout(() => siguiente(quizRef.current, true), 900);
        } else {
            sonidoIncorrecto();
            visorRef.current?.destello(pieza, 'mal', 1);
            const intentos = q.intentos + 1;
            if (intentos >= 2) {
                correctas.forEach(p => visorRef.current?.destello(p, 'pista', 2.2));
                visorRef.current?.enfocar(correctas[0]);
                setAviso({ tipo: 'mal', texto: `Eso es: ${pieza.nombre}. Mira dónde está en naranja.` });
                quizRef.current = { ...q, intentos, fallos: q.fallos + 1, resultados: [...q.resultados, { pregunta: correctas[0]?.nombre, acierto: false, intentos, tocados: [...q.tocados, pieza.nombre] }] };
                setQuiz(quizRef.current);
                setTimeout(() => siguiente(quizRef.current, false), 2300);
            } else {
                setAviso({ tipo: 'mal', texto: `Eso es: ${pieza.nombre}. ¡Prueba otra vez!` });
                setQuiz({ ...q, intentos, fallos: q.fallos + 1, tocados: [...q.tocados, pieza.nombre] });
            }
        }
    };
    useEffect(() => {
        if (!aviso) return undefined;
        const t = setTimeout(() => setAviso(null), 2200);
        return () => clearTimeout(t);
    }, [aviso]);

    const ficha = sel ? fichaDe(sel) : null;
    const estrecho = ancho < 820;
    const separada = sel && separadas.has(sel.id);

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#0f172a', color: '#e2e8f0', fontFamily: 'system-ui, "Segoe UI", sans-serif', overflow: 'hidden' }}>
            <div ref={contRef} style={{ position: 'absolute', inset: 0 }} />

            {!datos && !error && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, pointerEvents: 'none' }}>
                    <div style={{ fontSize: 52 }}>🦴</div>
                    <div style={{ fontWeight: 700 }}>Cargando el cuerpo humano…</div>
                </div>
            )}
            {error && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: '#1e293b', padding: 20, borderRadius: 14, maxWidth: 360, textAlign: 'center' }}>
                        <div style={{ fontSize: 40 }}>⚠️</div>{error}
                        <div><button onClick={onExit} style={{ ...boton(true), marginTop: 12 }}>← Volver</button></div>
                    </div>
                </div>
            )}

            {/* Barra superior */}
            <div style={{ position: 'absolute', top: 10, left: 10, right: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', pointerEvents: 'none' }}>
                <button onClick={onExit} style={{ ...boton(false), pointerEvents: 'auto' }}>← Volver</button>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', marginRight: 6 }}>🦴 Cuerpo humano 3D</div>
                <div style={{ display: 'flex', gap: 6, pointerEvents: 'auto' }}>
                    <button onClick={() => { setModo('explorar'); setQuiz(null); }} style={boton(modo === 'explorar')}>🔍 Explorar</button>
                    <button onClick={() => { if (!datos) return; setModo('quiz'); setQuiz(null); setSel(null); visorRef.current?.seleccionar(null); }} style={boton(modo === 'quiz', '#fbbf24')}>❓ ¿Dónde está?</button>
                    <button onClick={entrarMovimientos} style={boton(modo === 'movimiento', '#4ade80')}>🏃 Movimientos</button>
                    <button onClick={() => datos && setVerFicha(true)} style={boton(false)}>🖨️ Ficha PDF</button>
                    <div ref={vrRef} style={{ display: 'inline-flex' }} />
                </div>
                {modo === 'explorar' && datos && (
                    <div style={{ position: 'relative', pointerEvents: 'auto', flex: estrecho ? '1 1 100%' : '0 1 260px' }}>
                        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar… (fémur, bíceps, hígado…)"
                            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 999, border: '1px solid rgba(148,163,184,0.4)', background: 'rgba(15,23,42,0.85)', color: '#fff', fontSize: '0.9rem' }} />
                        {resultados.length > 0 && (
                            <div style={{ position: 'absolute', top: '110%', left: 0, right: 0, background: '#1e293b', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', maxHeight: 300, overflowY: 'auto', zIndex: 5 }}>
                                {resultados.map(p => (
                                    <div key={p.id} onClick={() => { elegir(p); setBusqueda(''); }} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.88rem' }}>
                                        {nombreConLado(p)} <span style={{ color: '#64748b', fontSize: '0.75rem' }}>· {p.zonaNombre}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Zonas */}
            {datos && modo === 'explorar' && (
                <div style={{ position: 'absolute', top: estrecho ? 96 : 56, left: 10, right: estrecho ? 10 : 340, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button onClick={() => setZonas(null)} style={boton(zonas === null, '#a5b4fc')}>Todo</button>
                    {datos.zonas.map(z => (
                        <button key={z.id} onClick={() => alternarZona(z.id)} style={boton(zonas !== null && zonas.has(z.id), '#a5b4fc')}>{z.nombre}</button>
                    ))}
                    {capas.organos?.visible && datos.aparatos.length > 0 && (
                        <div style={{ flexBasis: '100%', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', color: '#fbbf24', fontWeight: 800 }}>🫀 Aparatos:</span>
                            {datos.aparatos.map(g => (
                                <button key={g} onClick={() => alternarAparato(g)} style={boton(aparatos !== null && aparatos.has(g), '#fbbf24')}>{g}</button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Pregunta del juego */}
            {modo === 'quiz' && datos && (
                <div style={{ position: 'absolute', top: estrecho ? 60 : 58, left: '50%', transform: 'translateX(-50%)', background: 'rgba(15,23,42,0.9)', border: '2px solid #fbbf24', borderRadius: 16, padding: '10px 18px', textAlign: 'center', minWidth: 260, maxWidth: '92vw' }}>
                    {!quiz ? (
                        <>
                            <div style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: 8 }}>¿Qué quieres buscar?</div>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                                <button onClick={() => empezarQuiz('esqueleto')} style={boton(true, '#fbbf24')}>🦴 Huesos</button>
                                <button onClick={() => empezarQuiz('musculos')} style={boton(true, '#fb7185')}>💪 Músculos</button>
                                <button onClick={() => empezarQuiz('organos')} style={boton(true, '#38bdf8')}>🫀 Órganos</button>
                            </div>
                        </>
                    ) : quiz.fin ? (
                        <>
                            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#fbbf24' }}>🏁 {quiz.aciertos} de {quiz.preguntas.length}</div>
                            <div style={{ fontSize: '0.85rem', color: '#cbd5e1', margin: '4px 0 8px' }}>{quiz.aciertos >= 8 ? `¡Eres un experto en ${NOMBRE_CAPA[quiz.capa]}!` : quiz.aciertos >= 5 ? '¡Bien! Repasa los que fallaste.' : 'Explora el cuerpo y vuelve a intentarlo.'}</div>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                                <button onClick={() => setVerEnvio(true)} style={boton(true, '#fbbf24')}>📤 Enviar al profesor</button>
                                <button onClick={() => empezarQuiz(quiz.capa)} style={boton(false)}>🔁 Otra vez</button>
                                <button onClick={() => setQuiz(null)} style={boton(false)}>🔀 Cambiar</button>
                                <button onClick={() => { setModo('explorar'); setQuiz(null); }} style={boton(false)}>🔍 Explorar</button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', letterSpacing: 1 }}>PREGUNTA {quiz.i + 1}/{quiz.preguntas.length} · ✓ {quiz.aciertos}</div>
                            <div style={{ fontSize: '1.35rem', fontWeight: 900 }}>Toca: <span style={{ color: '#fbbf24' }}>{objetivoQuiz?.nombre}</span></div>
                            {objetivoQuiz?.lado && <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Vale cualquiera de los dos lados</div>}
                        </>
                    )}
                </div>
            )}
            {aviso && (
                <div style={{ position: 'absolute', top: '42%', left: '50%', transform: 'translateX(-50%)', background: aviso.tipo === 'ok' ? 'rgba(22,101,52,0.92)' : 'rgba(153,27,27,0.92)', padding: '10px 18px', borderRadius: 12, fontWeight: 800, pointerEvents: 'none', maxWidth: '86vw', textAlign: 'center' }}>
                    {aviso.texto}
                </div>
            )}

            {/* Nombre al pasar el ratón */}
            {hover && modo === 'explorar' && !estrecho && (
                <div style={{ position: 'absolute', bottom: 70, left: '50%', transform: 'translateX(-50%)', background: 'rgba(15,23,42,0.85)', padding: '5px 12px', borderRadius: 999, fontSize: '0.85rem', pointerEvents: 'none' }}>
                    {nombreConLado(hover)}
                </div>
            )}

            {/* Ficha del hueso seleccionado */}
            {sel && ficha && modo === 'explorar' && (
                <div style={{
                    position: 'absolute', background: 'rgba(15,23,42,0.94)', border: '1px solid rgba(56,189,248,0.4)', boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                    ...(estrecho
                        ? { left: 8, right: 8, bottom: 8, maxHeight: '46vh', borderRadius: 16 }
                        : { top: 56, right: 12, width: 320, maxHeight: 'calc(100vh - 140px)', borderRadius: 16 }),
                    overflowY: 'auto', padding: '14px 16px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: AZUL }}>{sel.nombre}</div>
                            <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                                {sel.lado && <>Lado {sel.lado} del cuerpo · </>}{sel.grupo}
                            </div>
                            {sel.tecnico && sel.tecnico !== sel.nombre && <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Nombre técnico: {sel.tecnico}</div>}
                        </div>
                        <button onClick={() => { setSel(null); visorRef.current?.seleccionar(null); }} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '10px 0' }}>
                        <button onClick={() => separar(sel, !separada)} style={boton(separada, '#fbbf24')}>{separada ? '↩ Devolver a su sitio' : '✋ Separar del cuerpo'}</button>
                        <button onClick={() => setAislar(a => !a)} style={boton(aislar)}>{aislar ? '👁 Ver todo' : '🎯 Aislar'}</button>
                        <button onClick={() => setTransparentar(t => !t)} style={boton(transparentar)}>👻 Transparentar</button>
                    </div>
                    {[['¿Qué es?', ficha.que], ['¿Para qué sirve?', ficha.funcion], ['💡 Curiosidad', ficha.curiosidad]].map(([t, txt]) => (
                        <div key={t} style={{ marginBottom: 9 }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t}</div>
                            <div style={{ fontSize: '0.9rem', lineHeight: 1.45 }}>{txt}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modo «Movimientos» */}
            {modo === 'movimiento' && datos && movimiento && (() => {
                const fase = movimiento[faseMov || 'ida'];
                const contraen = nombresDe(fase.agonistas);
                const relajan = nombresDe(fase.antagonistas);
                return (
                    <>
                        <div style={{ position: 'absolute', top: estrecho ? 60 : 58, left: 10, display: 'flex', flexDirection: estrecho ? 'row' : 'column', gap: 6, flexWrap: 'wrap', maxWidth: estrecho ? 'calc(100% - 20px)' : 230 }}>
                            {MOVIMIENTOS.map(m => (
                                <button key={m.id} onClick={() => setMovId(m.id)} style={{ ...boton(movId === m.id, '#4ade80'), textAlign: 'left' }}>{m.emoji} {m.nombre}</button>
                            ))}
                        </div>
                        <div style={{
                            position: 'absolute', background: 'rgba(15,23,42,0.94)', border: '1px solid rgba(74,222,128,0.4)', borderRadius: 16, padding: '12px 14px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', overflowY: 'auto',
                            ...(estrecho ? { left: 8, right: 8, bottom: 8, maxHeight: '44vh' } : { top: 56, right: 12, width: 330, maxHeight: 'calc(100vh - 80px)' }),
                        }}>
                            <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#4ade80' }}>{movimiento.emoji} {movimiento.nombre}</div>
                            <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: 8 }}>🔩 {movimiento.articulacion}</div>
                            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                                {['ida', 'vuelta'].map(k => (
                                    <span key={k} style={{ flex: 1, textAlign: 'center', padding: '5px 6px', borderRadius: 10, fontSize: '0.8rem', fontWeight: 800, background: (faseMov || 'ida') === k ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.05)', color: (faseMov || 'ida') === k ? '#4ade80' : '#64748b', border: `1px solid ${(faseMov || 'ida') === k ? '#4ade80' : 'transparent'}` }}>
                                        {k === 'ida' ? '▶' : '◀'} {movimiento[k].nombre}
                                    </span>
                                ))}
                            </div>
                            <div style={{ fontSize: '0.88rem', lineHeight: 1.45 }}>
                                <div style={{ marginBottom: 6 }}><b style={{ color: '#f87171' }}>🔴 Se contraen:</b> {contraen.length ? contraen.join(', ') : '—'}</div>
                                <div style={{ marginBottom: 6 }}><b style={{ color: '#60a5fa' }}>🔵 Se relajan:</b> {relajan.length ? relajan.join(', ') : '—'}</div>
                                {fase.nota && <div style={{ marginBottom: 6, color: '#fde68a' }}>💡 {fase.nota}</div>}
                                <div style={{ color: '#cbd5e1' }}>🦴 {movimiento.huesosTexto}</div>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '8px 0 4px' }}>
                                Los músculos solo tiran: por eso trabajan por parejas. Mientras uno se contrae (agonista), el otro se relaja (antagonista).
                            </div>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                                <button onClick={() => { setManual(null); setReproduciendo(r => !r || manual !== null); }} style={boton(true, '#4ade80')}>{reproduciendo && manual === null ? '⏸ Pausa' : '▶ Mover'}</button>
                                <button onClick={() => setVelocidad(v => (v === 1 ? 0.45 : 1))} style={boton(velocidad !== 1)}>{velocidad === 1 ? '🐢 Lento' : '🐇 Normal'}</button>
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', fontWeight: 700, marginTop: 8 }}>
                                ✋ A mano
                                <input type="range" min="0" max="1" step="0.01" value={manual ?? avance} onChange={e => { setReproduciendo(false); setManual(Number(e.target.value)); }} style={{ flex: 1 }} />
                            </label>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                                {CAPAS.map(c => (
                                    <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                        <button onClick={() => cambiarCapa(c.id, { visible: !capas[c.id].visible })} style={boton(capas[c.id].visible, COLOR_CAPA[c.id])}>{c.emoji} {c.nombre}</button>
                                        {c.id === 'musculos' && capas.musculos.visible && (
                                            <input type="range" min="0.15" max="1" step="0.01" value={capas.musculos.opacidad} title="Transparencia de los músculos" onChange={e => cambiarCapa('musculos', { opacidad: Number(e.target.value) })} style={{ width: 64 }} />
                                        )}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </>
                );
            })()}

            {/* Controles inferiores */}
            {datos && modo === 'explorar' && !(estrecho && sel) && (
                <div style={{ position: 'absolute', left: 10, bottom: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', background: 'rgba(15,23,42,0.8)', padding: '8px 12px', borderRadius: 14 }}>
                    {CAPAS.map(c => (
                        <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <button onClick={() => cambiarCapa(c.id, { visible: !capas[c.id].visible })} style={boton(capas[c.id].visible, COLOR_CAPA[c.id])}>{c.emoji} {c.nombre}</button>
                            {c.id !== 'organos' && capas[c.id].visible && (
                                <input type="range" min="0.15" max="1" step="0.01" value={capas[c.id].opacidad} title={`Transparencia de ${NOMBRE_CAPA[c.id]}`}
                                    onChange={e => cambiarCapa(c.id, { opacidad: Number(e.target.value) })} style={{ width: 64 }} />
                            )}
                        </span>
                    ))}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', fontWeight: 700 }}>
                        🧩 Despiece
                        <input type="range" min="0" max="1" step="0.01" value={despiece} onChange={e => setDespiece(Number(e.target.value))} style={{ width: 120 }} />
                    </label>
                    {separadas.size > 0 && <button onClick={() => { visorRef.current?.devolverTodas(); setSeparadas(new Set()); }} style={boton(false)}>↩ Devolver todos ({separadas.size})</button>}
                    <button onClick={() => visorRef.current?.vistaInicial()} style={boton(false)}>🎥 Centrar</button>
                </div>
            )}

            {verEnvio && quiz && <ModalEnviarCuerpo quiz={quiz} onClose={() => setVerEnvio(false)} />}
            {verFicha && datos && <ModalFichaCuerpo datos={datos} fichaDe={fichaDe} capturar={(o) => visorRef.current.capturarFicha(o)} onClose={() => setVerFicha(false)} />}
            {enVR && (
                <div style={{ position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)', background: 'rgba(15,23,42,0.9)', padding: '8px 14px', borderRadius: 12, fontSize: '0.85rem' }}>
                    🥽 En realidad virtual · gatillo: tocar · botón lateral: separar · joystick: girar y acercar
                </div>
            )}

            <div style={{ position: 'absolute', right: 10, bottom: 6, fontSize: '0.62rem', color: '#64748b', textAlign: 'right', pointerEvents: 'auto', display: estrecho && sel ? 'none' : 'block' }}>
                Modelo: <a href="https://www.z-anatomy.com" target="_blank" rel="noreferrer" style={{ color: '#94a3b8' }}>Z-Anatomy</a> (CC BY-SA 4.0), basado en{' '}
                <a href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/" target="_blank" rel="noreferrer" style={{ color: '#94a3b8' }}>BodyParts3D</a> (DBCLS, CC BY-SA 2.1 JP)
            </div>
        </div>
    );
}
