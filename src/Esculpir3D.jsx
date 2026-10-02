// Esculpir3D.jsx — Taller de escultura 3D (escritorio + gafas WebXR / Meta Quest).
// Se talla una pieza (bloque, tronco, esfera…) de madera, mármol, arcilla o jabón con
// gubia, cincel, taladro, cepillo, lija o añadiendo arcilla. Tiene torno, deshacer,
// medida del volumen en vivo, retos de forma con puntuación (enviable al profesor)
// y exportación a STL para imprimir en 3D. El motor está en utils/esculturaMotor.js.
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';
import { db } from './firebase';
import { MotorEscultura, MATERIALES, FORMAS, HERRAMIENTAS, OBJETIVOS } from './utils/esculturaMotor';
import { crearSonidoTaller } from './utils/esculturaSonido';
import { guardarRegistroLocal } from './utils/registrosLocales';

const TAM = 0.30;            // lado de la pieza: 30 cm
const ALT0 = 1.05;           // altura del centro de la pieza (de pie)
const Z_PIEZA = -0.45;       // la peana queda 45 cm delante del jugador
const PUNTA = 0.12;          // distancia del mando a la punta de la herramienta
const R_MIN = 0.004, R_MAX = 0.06;
const PW = 1024, PH = 720;   // lienzo del panel VR

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const cm3 = v => `${(v * 1e6).toFixed(0)} cm³`;
const OBJ = id => OBJETIVOS.find(o => o.id === id);

/* ═══════════════════ MODELOS DE HERRAMIENTA (VR) ═══════════════════ */
// La punta de cada herramienta está en el origen y el mango se extiende hacia +z.

function crearHerramientasVR() {
    const madera = new THREE.MeshStandardMaterial({ color: 0x9c6b3f, roughness: 0.7 });
    const metal = new THREE.MeshStandardMaterial({ color: 0xc9d1d9, metalness: 0.85, roughness: 0.3 });
    const g = new THREE.Group();
    const mango = (z0 = 0.04, largo = 0.11) => {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.016, largo, 16), madera);
        m.rotation.x = Math.PI / 2; m.position.z = z0 + largo / 2;
        return m;
    };
    const nueva = (id, ...piezas) => { const h = new THREE.Group(); h.name = id; piezas.forEach(p => h.add(p)); h.visible = false; g.add(h); return h; };

    const cuchara = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.045, 14, 1, true, 0, Math.PI), metal);
    cuchara.material = metal.clone(); cuchara.material.side = THREE.DoubleSide;
    cuchara.rotation.x = Math.PI / 2; cuchara.position.z = 0.02;
    nueva('GUBIA', mango(), cuchara);

    const hoja = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.004, 0.045), metal); hoja.position.z = 0.02;
    nueva('CINCEL', mango(), hoja);

    const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.1, 18), new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 }));
    cuerpo.rotation.x = Math.PI / 2; cuerpo.position.z = 0.1;
    const empu = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.03), new THREE.MeshStandardMaterial({ color: 0x1f2937 }));
    empu.position.set(0, -0.05, 0.12);
    const broca = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.004, 0.05, 8), metal);
    broca.rotation.x = Math.PI / 2; broca.position.z = 0.025; broca.name = 'broca';
    nueva('TALADRO', cuerpo, empu, broca);

    const suela = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.05), metal); suela.position.z = 0.02;
    const lomo = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.045), madera); lomo.position.set(0, 0.02, 0.025);
    nueva('APLANAR', mango(0.05), suela, lomo);

    const taco = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.02, 0.045), new THREE.MeshStandardMaterial({ color: 0xd6b97b, roughness: 1 }));
    taco.position.z = 0.02;
    nueva('LIJA', mango(0.045), taco);

    const espatula = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.003, 0.045), new THREE.MeshStandardMaterial({ color: 0xe5c49a, roughness: 0.8 }));
    espatula.position.z = 0.02;
    const bolita = new THREE.Mesh(new THREE.SphereGeometry(0.012, 14, 10), new THREE.MeshStandardMaterial({ color: 0xb0694a, roughness: 0.9 }));
    bolita.position.set(0, 0.008, 0.005);
    nueva('ARCILLA', mango(), espatula, bolita);
    return g;
}

/* ═══════════════════ PANEL VR (lienzo) ═══════════════════ */

function botonesPanel() {
    const b = HERRAMIENTAS.map((h, i) => ({ id: 'H:' + h.id, x: 24 + (i % 3) * 332, y: 92 + Math.floor(i / 3) * 108, w: 312, h: 94, txt: `${h.emoji} ${h.nombre}` }));
    b.push({ id: 'R-', x: 24, y: 318, w: 96, h: 84, txt: '−' }, { id: 'R+', x: 404, y: 318, w: 96, h: 84, txt: '+' },
        { id: 'F-', x: 524, y: 318, w: 96, h: 84, txt: '−' }, { id: 'F+', x: 904, y: 318, w: 96, h: 84, txt: '+' });
    b.push({ id: 'TORNO', x: 24, y: 418, w: 312, h: 84 }, { id: 'UNDO', x: 356, y: 418, w: 312, h: 84, txt: '↩ Deshacer' },
        { id: 'REDO', x: 688, y: 418, w: 312, h: 84, txt: '↪ Rehacer' });
    b.push({ id: 'MAT', x: 24, y: 518, w: 312, h: 84 }, { id: 'OBJ', x: 356, y: 518, w: 312, h: 84 },
        { id: 'NUEVA', x: 688, y: 518, w: 312, h: 84, txt: '🆕 Nueva pieza' });
    return b;
}
const BOTONES_PANEL = botonesPanel();

function dibujarPanel(panel, st) {
    const { canvas, tex } = panel.userData;
    const g = canvas.getContext('2d');
    g.clearRect(0, 0, PW, PH);
    g.fillStyle = 'rgba(17,22,30,0.93)';
    g.beginPath(); g.roundRect(0, 0, PW, PH, 36); g.fill();
    g.fillStyle = '#ffd54f'; g.font = 'bold 44px system-ui, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText('🗿 Taller de escultura', 28, 48);
    const herr = HERRAMIENTAS.find(h => h.id === st.herr);
    g.fillStyle = '#9fb3c8'; g.font = '30px system-ui, sans-serif'; g.textAlign = 'right';
    g.fillText(`${MATERIALES[st.material].emoji} ${MATERIALES[st.material].nombre} · ${herr?.nombre || ''}`, PW - 28, 48);

    for (const b of BOTONES_PANEL) {
        let activo = false, txt = b.txt, apagado = false;
        if (b.id.startsWith('H:')) { activo = b.id === 'H:' + st.herr; apagado = b.id === 'H:ARCILLA' && st.material !== 'ARCILLA'; }
        if (b.id === 'TORNO') { activo = st.torno; txt = `⚙️ Torno: ${st.torno ? 'SÍ' : 'NO'}`; }
        if (b.id === 'MAT') txt = `${MATERIALES[st.material].emoji} Material ▸`;
        if (b.id === 'OBJ') { activo = st.verObjetivo && !!st.objetivo; apagado = !st.objetivo; txt = `👁 Silueta: ${st.verObjetivo ? 'SÍ' : 'NO'}`; }
        g.fillStyle = activo ? '#f59e0b' : st.hover === b.id ? '#334155' : '#1f2937';
        g.beginPath(); g.roundRect(b.x, b.y, b.w, b.h, 18); g.fill();
        if (st.hover === b.id) { g.strokeStyle = '#ffd54f'; g.lineWidth = 4; g.stroke(); }
        g.fillStyle = apagado ? '#5b6573' : activo ? '#111827' : '#e5e7eb';
        g.font = `bold ${b.w < 120 ? 54 : 34}px system-ui, sans-serif`; g.textAlign = 'center';
        g.fillText(txt, b.x + b.w / 2, b.y + b.h / 2 + 2);
    }
    g.fillStyle = '#e5e7eb'; g.font = 'bold 34px system-ui, sans-serif'; g.textAlign = 'center';
    g.fillText(`Tamaño ${(st.radio * 100).toFixed(1)} cm`, 262, 360);
    g.fillText(`Fuerza ${Math.round(st.fuerza * 100)}%`, 762, 360);
    const ret = st.vol0 ? Math.max(0, Math.round((1 - st.vol / st.vol0) * 100)) : 0;
    g.fillStyle = '#a7f3d0'; g.font = 'bold 32px system-ui, sans-serif';
    g.fillText(`Volumen ${cm3(st.vol)} · retirado ${ret}%`, PW / 2, 640);
    g.fillStyle = '#94a3b8'; g.font = '24px system-ui, sans-serif';
    g.fillText('Gatillo dcho: esculpir · A/B: herramienta · Agarre: girar la pieza · Stick izq: girar/subir · X/Y: deshacer/rehacer', PW / 2, 690);
    tex.needsUpdate = true;
}

/* ═══════════════════ COMPONENTE ═══════════════════ */

export default function Esculpir3D({ onExit }) {
    const contRef = useRef(null);
    const motorRef = useRef(null);
    const api = useRef({});
    const sonidoRef = useRef(null);

    const [herr, setHerr] = useState('GUBIA');
    const [radio, setRadio] = useState(0.018);
    const [fuerza, setFuerza] = useState(0.5);
    const [torno, setTorno] = useState(false);
    const [material, setMaterial] = useState('MADERA');
    const [forma, setForma] = useState('BLOQUE');
    const [resol, setResol] = useState(96);
    const [objetivo, setObjetivo] = useState(null);
    const [verObjetivo, setVerObjetivo] = useState(true);
    const [reto, setReto] = useState(null);                 // { id, inicio }
    const [stats, setStats] = useState({ vol: 0, vol0: 0, nd: 0, nr: 0 });
    const [sonido, setSonido] = useState(() => { try { return localStorage.getItem('pikt_sonido') !== 'off'; } catch { return true; } });
    const [vrDisponible, setVrDisponible] = useState(null);
    const [resultado, setResultado] = useState(null);
    const [enviar, setEnviar] = useState(false);
    const [ayuda, setAyuda] = useState(false);
    const [estrecho, setEstrecho] = useState(() => window.innerWidth < 820);

    const cfg = useRef({});
    cfg.current = { herr, radio, fuerza, torno, material, forma, resol, objetivo, verObjetivo, sonido };

    useEffect(() => {
        const r = () => setEstrecho(window.innerWidth < 820);
        window.addEventListener('resize', r);
        return () => window.removeEventListener('resize', r);
    }, []);

    /* ---------- escena ---------- */
    useEffect(() => {
        const cont = contRef.current;
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(cont.clientWidth, cont.clientHeight);
        renderer.xr.enabled = true;
        const canvas = renderer.domElement;
        canvas.style.display = 'block';
        canvas.style.touchAction = 'none';
        cont.appendChild(canvas);

        const escena = new THREE.Scene();
        escena.background = new THREE.Color(0x1b2129);
        const camara = new THREE.PerspectiveCamera(45, cont.clientWidth / cont.clientHeight, 0.01, 60);
        camara.position.set(0.42, 1.38, Z_PIEZA + 0.62);
        const jugador = new THREE.Group();
        jugador.add(camara);
        escena.add(jugador);

        escena.add(new THREE.HemisphereLight(0xffffff, 0x3b4252, 0.9));
        const sol = new THREE.DirectionalLight(0xffffff, 1.7); sol.position.set(1.4, 3, 1.2); escena.add(sol);
        const relleno = new THREE.DirectionalLight(0xbcd4ff, 0.55); relleno.position.set(-2, 1.4, -1); escena.add(relleno);

        const suelo = new THREE.Mesh(new THREE.CircleGeometry(5, 64), new THREE.MeshStandardMaterial({ color: 0x2a3038, roughness: 1 }));
        suelo.rotation.x = -Math.PI / 2;
        escena.add(suelo);
        const rejilla = new THREE.GridHelper(10, 40, 0x3c4654, 0x30363f);
        rejilla.position.y = 0.001;
        escena.add(rejilla);

        // peana: soporte (posición) → orient (agarre) → giro (torno) → pieza
        const soporte = new THREE.Group(); soporte.position.set(0, ALT0, Z_PIEZA); escena.add(soporte);
        const orient = new THREE.Group(); soporte.add(orient);
        const giro = new THREE.Group(); orient.add(giro);

        const c0 = cfg.current;
        const motor = new MotorEscultura({ N: c0.resol, tam: TAM, material: c0.material, forma: c0.forma });
        motorRef.current = motor;
        giro.add(motor.grupo);

        const plato = new THREE.Mesh(new THREE.CylinderGeometry(TAM * 0.75, TAM * 0.75, 0.025, 56),
            new THREE.MeshStandardMaterial({ color: 0x8d99a6, metalness: 0.6, roughness: 0.35 }));
        plato.position.y = -TAM / 2 - 0.0145;
        giro.add(plato);
        const marca = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.004, 0.014), new THREE.MeshStandardMaterial({ color: 0xffb300 }));
        marca.position.set(TAM * 0.68, -TAM / 2 - 0.0005, 0);
        giro.add(marca);
        const columna = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 1, 32), new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.7 }));
        escena.add(columna);
        const colocarColumna = () => {
            const tope = soporte.position.y - TAM / 2 - 0.027;
            columna.scale.y = Math.max(0.05, tope);
            columna.position.set(0, tope / 2, Z_PIEZA);
        };
        colocarColumna();

        // silueta del reto
        const fantasma = new THREE.Group();
        giro.add(fantasma);
        const matFantasma = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.22, depthWrite: false });
        const matAlambre = new THREE.MeshBasicMaterial({ color: 0x00e5ff, wireframe: true, transparent: true, opacity: 0.16, depthWrite: false, depthTest: false });

        // indicador del pincel (escritorio)
        const pincel = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14),
            new THREE.MeshBasicMaterial({ color: 0xffe082, wireframe: true, transparent: true, opacity: 0.35, depthWrite: false }));
        pincel.visible = false;
        escena.add(pincel);

        /* ---- virutas ---- */
        const MAXV = 350;
        const virutasMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.85 }), MAXV);
        virutasMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        virutasMesh.count = 0;
        virutasMesh.frustumCulled = false;
        escena.add(virutasMesh);
        const virutas = [];
        const mtx = new THREE.Matrix4(), qv = new THREE.Quaternion(), ev = new THREE.Euler(), sv = new THREE.Vector3();
        function lanzarVirutas(pW, nW, n) {
            virutasMesh.material.color.setHex(MATERIALES[cfg.current.material].chispa);
            for (let k = 0; k < n; k++) {
                if (virutas.length >= MAXV) virutas.shift();
                const v = nW.clone().multiplyScalar(0.4 + Math.random() * 0.9)
                    .add(new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.6, Math.random() - 0.5).multiplyScalar(0.9));
                virutas.push({ p: pW.clone(), v, r: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
                    w: new THREE.Vector3(Math.random() * 20 - 10, Math.random() * 20 - 10, Math.random() * 20 - 10),
                    s: 0.003 + Math.random() * 0.005, vida: 1.2 + Math.random() * 0.8 });
            }
        }
        function tickVirutas(dt) {
            for (let i = virutas.length - 1; i >= 0; i--) {
                const q = virutas[i];
                q.vida -= dt;
                if (q.vida <= 0) { virutas.splice(i, 1); continue; }
                if (q.p.y > q.s / 2) {
                    q.v.y -= 9.8 * dt;
                    q.p.addScaledVector(q.v, dt);
                    q.r.addScaledVector(q.w, dt);
                    if (q.p.y <= q.s / 2) { q.p.y = q.s / 2; q.v.set(0, 0, 0); }
                }
            }
            for (let i = 0; i < virutas.length; i++) {
                const q = virutas[i];
                qv.setFromEuler(ev.set(q.r.x, q.r.y, q.r.z));
                sv.set(q.s, q.s * 0.45, q.s * 0.8).multiplyScalar(Math.min(1, q.vida * 2));
                virutasMesh.setMatrixAt(i, mtx.compose(q.p, qv, sv));
            }
            virutasMesh.count = virutas.length;
            virutasMesh.instanceMatrix.needsUpdate = true;
        }

        const son = crearSonidoTaller();
        son.setActivo(c0.sonido);
        sonidoRef.current = son;

        const refrescar = () => setStats({ vol: motor.volumen(), vol0: motor.vol0, nd: motor.pilaDeshacer.length, nr: motor.pilaRehacer.length });

        /** Aplica la herramienta actual en un punto LOCAL de la pieza. */
        function aplicarEn(pL, nL, dL, vr, factor) {
            const c = cfg.current;
            const cambio = motor.aplicar({ tipo: c.herr, p: pL, n: nL, d: dL, r: c.radio, fuerza: c.fuerza * factor, torno: c.torno, vr });
            if (cambio > 0.05) {
                if (c.sonido) son.actividad(c.herr, cambio, motor.dureza);
                if (c.herr !== 'LIJA' && c.herr !== 'ARCILLA') {
                    const pW = giro.localToWorld(pL.clone());
                    const nW = nL.clone().transformDirection(giro.matrixWorld);
                    lanzarVirutas(pW, nW, Math.min(c.herr === 'CINCEL' ? 10 : 4, Math.ceil(cambio / 25)));
                }
            }
            return cambio;
        }

        const invGiro = new THREE.Matrix4();
        function rayoPieza(oW, dW) {
            soporte.updateMatrixWorld(true);
            invGiro.copy(giro.matrixWorld).invert();
            const o = oW.clone().applyMatrix4(invGiro);
            const d = dW.clone().transformDirection(invGiro);
            const hit = motor.rayo(o, d);
            if (!hit) return null;
            hit.dir = d;
            hit.mundo = hit.punto.clone().applyMatrix4(giro.matrixWorld);
            return hit;
        }

        /* ---- escritorio ---- */
        const controles = new OrbitControls(camara, canvas);
        controles.target.set(0, ALT0, Z_PIEZA);
        controles.enableDamping = true;
        controles.minDistance = 0.25;
        controles.maxDistance = 3;
        controles.update();

        const ptr = { abajo: false, dentro: false, ultimo: null, tUlt: 0 };
        const ndc = new THREE.Vector2();
        const rc = new THREE.Raycaster();
        const setNdc = e => {
            const r = canvas.getBoundingClientRect();
            ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        };
        const golpe = () => { rc.setFromCamera(ndc, camara); return rayoPieza(rc.ray.origin, rc.ray.direction); };

        // En fase de captura: así se decide antes que OrbitControls si el clic esculpe o gira la cámara.
        const onDown = e => {
            if (e.target !== canvas || renderer.xr.isPresenting) return;
            setNdc(e); ptr.dentro = true;
            if (e.button !== 0) return;
            if (!golpe()) return;
            controles.enabled = false;
            ptr.abajo = true; ptr.ultimo = null; ptr.tUlt = 0;
            motor.iniciarTrazo();
            try { canvas.setPointerCapture(e.pointerId); } catch { /* */ }
        };
        const onMove = e => { if (e.target !== canvas && !ptr.abajo) return; setNdc(e); ptr.dentro = true; };
        const onUp = () => {
            if (!ptr.abajo) return;
            ptr.abajo = false;
            motor.terminarTrazo();
            controles.enabled = true;
            refrescar();
        };
        const onLeave = () => { ptr.dentro = false; };
        cont.addEventListener('pointerdown', onDown, true);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
        canvas.addEventListener('pointerleave', onLeave);

        function tickEscritorio() {
            pincel.visible = false;
            if (!ptr.dentro && !ptr.abajo) return;
            const c = cfg.current;
            const hit = golpe();
            if (!hit) return;
            pincel.visible = true;
            pincel.position.copy(hit.mundo);
            pincel.scale.setScalar(c.radio);
            pincel.material.color.setHex(ptr.abajo ? 0xff7043 : 0xffe082);
            if (!ptr.abajo) return;
            const ahora = performance.now();
            const sep = ptr.ultimo ? hit.punto.distanceTo(ptr.ultimo) : Infinity;
            const dtMs = ahora - ptr.tUlt;
            const toca = c.herr === 'CINCEL'
                ? (sep >= c.radio * 0.6 && dtMs >= 90) || dtMs >= 220
                : sep >= c.radio * 0.35 || dtMs >= (c.torno ? 70 : 45);
            if (!toca) return;
            aplicarEn(hit.punto, hit.normal, hit.dir, false, 1);
            ptr.ultimo = hit.punto.clone();
            ptr.tUlt = ahora;
        }

        /* ---- panel VR ---- */
        const lienzo = document.createElement('canvas');
        lienzo.width = PW; lienzo.height = PH;
        const texPanel = new THREE.CanvasTexture(lienzo);
        texPanel.colorSpace = THREE.SRGBColorSpace;
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62 * PH / PW), new THREE.MeshBasicMaterial({ map: texPanel, transparent: true }));
        panel.position.set(-0.52, 1.22, Z_PIEZA + 0.12);
        panel.lookAt(0, 1.3, 0.15);
        panel.visible = false;
        panel.userData = { canvas: lienzo, tex: texPanel, st: null };
        escena.add(panel);
        const redibujarPanel = (st) => {
            panel.userData.st = { ...(panel.userData.st || {}), ...st };
            dibujarPanel(panel, panel.userData.st);
        };

        const MATS = Object.keys(MATERIALES);
        function accionPanel(id) {
            const c = cfg.current;
            if (id.startsWith('H:')) { const h = id.slice(2); if (h !== 'ARCILLA' || c.material === 'ARCILLA') setHerr(h); }
            else if (id === 'R-') setRadio(r => clamp(r / 1.25, R_MIN, R_MAX));
            else if (id === 'R+') setRadio(r => clamp(r * 1.25, R_MIN, R_MAX));
            else if (id === 'F-') setFuerza(f => clamp(Math.round((f - 0.1) * 10) / 10, 0.1, 1));
            else if (id === 'F+') setFuerza(f => clamp(Math.round((f + 0.1) * 10) / 10, 0.1, 1));
            else if (id === 'TORNO') setTorno(t => !t);
            else if (id === 'UNDO') api.current.deshacer();
            else if (id === 'REDO') api.current.rehacer();
            else if (id === 'MAT') setMaterial(MATS[(MATS.indexOf(c.material) + 1) % MATS.length]);
            else if (id === 'OBJ') { if (c.objetivo) setVerObjetivo(v => !v); }
            else if (id === 'NUEVA') api.current.nuevaPieza();
        }

        /* ---- mandos VR ---- */
        const geoRayo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
        const mandos = [];
        for (let i = 0; i < 2; i++) {
            const ctrl = renderer.xr.getController(i);
            const rayo = new THREE.Line(geoRayo, new THREE.LineBasicMaterial({ color: 0x00e5ff }));
            ctrl.add(rayo);
            const punta = new THREE.Object3D(); punta.position.z = -PUNTA; ctrl.add(punta);
            const herrs = crearHerramientasVR(); punta.add(herrs);
            const esfera = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12),
                new THREE.MeshBasicMaterial({ color: 0xffe082, wireframe: true, transparent: true, opacity: 0.4, depthWrite: false }));
            punta.add(esfera);
            jugador.add(ctrl);
            const grip = renderer.xr.getControllerGrip(i);
            const cuerpo = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.07, 6, 12), new THREE.MeshStandardMaterial({ color: 0x2b3b4d, roughness: 0.6 }));
            cuerpo.rotation.x = Math.PI / 2.4;
            grip.add(cuerpo);
            jugador.add(grip);
            const info = { ctrl, rayo, punta, herrs, esfera, mano: null, gamepad: null, gatillo: false, enPanel: false, trazo: false, acum: 0, agarre: null, prev: [], hoverId: null };
            ctrl.addEventListener('connected', ev => { info.mano = ev.data.handedness; info.gamepad = ev.data.gamepad || null; });
            ctrl.addEventListener('disconnected', () => { info.mano = null; info.gamepad = null; });
            ctrl.addEventListener('selectstart', () => {
                if (info.hoverId) { info.enPanel = true; accionPanel(info.hoverId); }
                else info.gatillo = true;
            });
            ctrl.addEventListener('selectend', () => {
                info.gatillo = false; info.enPanel = false; info.acum = 0;
                if (info.trazo) { motor.terminarTrazo(); info.trazo = false; refrescar(); }
            });
            ctrl.addEventListener('squeezestart', () => {
                const q = new THREE.Quaternion(); ctrl.getWorldQuaternion(q);
                info.agarre = { q0inv: q.invert(), qo: orient.quaternion.clone() };
            });
            ctrl.addEventListener('squeezeend', () => { info.agarre = null; });
            mandos.push(info);
        }

        const rcVR = new THREE.Raycaster();
        const vA = new THREE.Vector3(), vB = new THREE.Vector3(), qA = new THREE.Quaternion(), qY = new THREE.Quaternion();
        const EJE_Y = new THREE.Vector3(0, 1, 0);
        let hoverPanel = null, ultRadio = 0;
        const herrIds = HERRAMIENTAS.map(h => h.id);
        const cambiarHerr = paso => {
            const c = cfg.current;
            let i = herrIds.indexOf(c.herr);
            do { i = (i + paso + herrIds.length) % herrIds.length; } while (herrIds[i] === 'ARCILLA' && c.material !== 'ARCILLA');
            setHerr(herrIds[i]);
        };
        const vibrar = (m, fuerzaV, ms) => {
            const gp = m.gamepad;
            const act = gp?.hapticActuators?.[0];
            if (act?.pulse) act.pulse(fuerzaV, ms);
            else gp?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: fuerzaV, weakMagnitude: fuerzaV });
        };

        function tickVR(dt) {
            const c = cfg.current;
            const conectados = mandos.filter(m => m.mano);
            const der = conectados.find(m => m.mano === 'right') || conectados[0];
            const izq = conectados.find(m => m !== der);

            let nuevoHover = null;
            for (const m of mandos) {
                const esHerr = m === der;
                m.herrs.visible = esHerr;
                m.esfera.visible = esHerr;
                if (esHerr) m.herrs.children.forEach(h => { h.visible = h.name === c.herr; });

                // rayo contra el panel
                m.ctrl.getWorldPosition(vA);
                vB.set(0, 0, -1).transformDirection(m.ctrl.matrixWorld);
                rcVR.set(vA, vB);
                const hit = m.mano ? rcVR.intersectObject(panel)[0] : null;
                m.hoverId = null;
                if (hit?.uv) {
                    const x = hit.uv.x * PW, y = (1 - hit.uv.y) * PH;
                    const b = BOTONES_PANEL.find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
                    m.hoverId = b?.id || null;
                    if (m.hoverId) nuevoHover = m.hoverId;
                }
                m.rayo.visible = !!m.mano && (!esHerr || !!hit);
                m.rayo.scale.z = hit ? hit.distance : 1.2;

                // agarrar y girar la pieza
                if (m.agarre) {
                    m.ctrl.getWorldQuaternion(qA);
                    orient.quaternion.copy(qA.multiply(m.agarre.q0inv)).multiply(m.agarre.qo);
                }

                // botones (flanco de subida)
                const bs = m.gamepad?.buttons || [];
                const flanco = i => !!bs[i]?.pressed && !m.prev[i];
                if (esHerr) {
                    if (flanco(4)) cambiarHerr(1);
                    if (flanco(5)) cambiarHerr(-1);
                } else {
                    if (flanco(4)) api.current.deshacer();
                    if (flanco(5)) api.current.rehacer();
                    if (flanco(3)) orient.quaternion.identity();
                }
                m.prev = bs.map(b => b.pressed);
            }
            if (nuevoHover !== hoverPanel) { hoverPanel = nuevoHover; redibujarPanel({ hover: hoverPanel }); }

            // stick izquierdo: girar la pieza y subir/bajar la peana
            const ax = izq?.gamepad?.axes || [];
            if (Math.abs(ax[2] || 0) > 0.15) orient.quaternion.premultiply(qY.setFromAxisAngle(EJE_Y, ax[2] * dt * 2));
            if (Math.abs(ax[3] || 0) > 0.25) {
                soporte.position.y = clamp(soporte.position.y - ax[3] * dt * 0.4, 0.55, 1.6);
                colocarColumna();
            }

            if (!der) return;
            // stick derecho: tamaño de la herramienta
            const ay = der.gamepad?.axes?.[3] || 0;
            if (Math.abs(ay) > 0.2) {
                c.radio = clamp(c.radio * (1 - ay * dt * 1.2), R_MIN, R_MAX);
                const ahora = performance.now();
                if (ahora - ultRadio > 120) { ultRadio = ahora; setRadio(c.radio); }
            }
            der.esfera.scale.setScalar(c.radio);
            if (c.herr === 'TALADRO' && der.gatillo) {
                const broca = der.herrs.getObjectByName('broca');
                if (broca) broca.rotation.y += dt * 40;
            }

            soporte.updateMatrixWorld(true);
            der.punta.getWorldPosition(vA);
            const pL = giro.worldToLocal(vA.clone());
            const val = motor.muestra(pL.x, pL.y, pL.z);
            der.esfera.material.color.setHex(val > -Math.min(2.9, c.radio / motor.h) ? 0x66ff99 : 0xffe082);

            if (!der.gatillo || der.enPanel) return;
            if (!der.trazo) { motor.iniciarTrazo(); der.trazo = true; }
            der.acum += dt;
            const intervalo = c.herr === 'CINCEL' ? 0.1 : c.torno ? 0.08 : 0.035;
            if (der.acum < intervalo) return;
            const factor = c.herr === 'CINCEL' ? 1 : Math.min(1, der.acum * 12) * 0.6;
            der.acum = 0;
            invGiro.copy(giro.matrixWorld).invert();
            const dL = new THREE.Vector3(0, 0, -1).transformDirection(der.ctrl.matrixWorld).transformDirection(invGiro);
            const cambio = aplicarEn(pL, motor.normal(pL), dL, true, factor);
            if (cambio > 0.05) vibrar(der, Math.min(1, 0.15 + (cambio / 80) * (0.5 + motor.dureza * 0.25)), c.herr === 'CINCEL' ? 40 : 25);
        }

        /* ---- bucle ---- */
        const reloj = new THREE.Clock();
        renderer.setAnimationLoop(() => {
            const dt = Math.min(reloj.getDelta(), 0.05);
            if (cfg.current.torno) giro.rotation.y += dt * 7;
            const vr = renderer.xr.isPresenting;
            panel.visible = vr;
            if (vr) { pincel.visible = false; tickVR(dt); }
            else { tickEscritorio(); controles.update(); }
            tickVirutas(dt);
            motor.actualizar(vr ? 4 : 8);
            renderer.render(escena, camara);
        });

        const alRedimensionar = () => {
            if (!cont.clientWidth || renderer.xr.isPresenting) return;
            camara.aspect = cont.clientWidth / cont.clientHeight;
            camara.updateProjectionMatrix();
            renderer.setSize(cont.clientWidth, cont.clientHeight);
        };
        const ro = new ResizeObserver(alRedimensionar);
        ro.observe(cont);

        let btnVR = null;
        if (navigator.xr?.isSessionSupported) {
            navigator.xr.isSessionSupported('immersive-vr').then(ok => {
                setVrDisponible(ok);
                if (ok && contRef.current) {
                    btnVR = VRButton.createButton(renderer);
                    Object.assign(btnVR.style, { position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 20 });
                    cont.appendChild(btnVR);
                }
            }).catch(() => setVrDisponible(false));
        } else setVrDisponible(false);

        api.current = {
            nuevaPieza(formaN = cfg.current.forma, N = cfg.current.resol) {
                motor.reiniciar(N, formaN);
                orient.quaternion.identity();
                giro.rotation.y = 0;
                virutas.length = 0;
                refrescar();
            },
            deshacer() { if (motor.deshacer()) refrescar(); },
            rehacer() { if (motor.rehacer()) refrescar(); },
            enderezar() { orient.quaternion.identity(); },
            exportar() {
                const url = URL.createObjectURL(motor.exportarSTL());
                const a = document.createElement('a');
                a.href = url; a.download = 'escultura.stl';
                document.body.appendChild(a); a.click(); a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 2000);
            },
            comparar: dentro => motor.comparar(dentro),
            redibujarPanel,
            fantasma(id) {
                fantasma.children.slice().forEach(m => { fantasma.remove(m); if (!m.userData.compartida) m.geometry.dispose(); });
                const o = OBJ(id);
                if (!o) return;
                for (const geo of o.fantasma(TAM)) {
                    const solido = new THREE.Mesh(geo, matFantasma); solido.renderOrder = 2;
                    const alambre = new THREE.Mesh(geo, matAlambre); alambre.renderOrder = 3; alambre.userData.compartida = true;
                    fantasma.add(solido, alambre);
                }
            },
            verFantasma(b) { fantasma.visible = b; },
        };
        refrescar();

        return () => {
            renderer.setAnimationLoop(null);
            renderer.xr.getSession?.()?.end?.().catch?.(() => {});
            ro.disconnect();
            cont.removeEventListener('pointerdown', onDown, true);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
            canvas.removeEventListener('pointerleave', onLeave);
            if (btnVR?.parentNode) btnVR.parentNode.removeChild(btnVR);
            controles.dispose();
            son.dispose();
            motor.dispose();
            escena.traverse(o => {
                if (o.geometry) o.geometry.dispose();
                if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(mt => { mt.map?.dispose?.(); mt.dispose(); });
            });
            renderer.dispose();
            if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
            motorRef.current = null;
            api.current = {};
        };
    }, []);

    /* ---------- sincronización estado ↔ escena ---------- */
    useEffect(() => {
        const m = motorRef.current;
        if (m && m.material !== material) m.setMaterial(material);
        if (material !== 'ARCILLA' && herr === 'ARCILLA') setHerr('GUBIA');
    }, [material]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { sonidoRef.current?.torno(torno && sonido); }, [torno, sonido]);
    useEffect(() => {
        sonidoRef.current?.setActivo(sonido);
        try { localStorage.setItem('pikt_sonido', sonido ? 'on' : 'off'); } catch { /* */ }
    }, [sonido]);
    useEffect(() => { api.current.fantasma?.(objetivo); }, [objetivo]);
    useEffect(() => { api.current.verFantasma?.(!!objetivo && verObjetivo); }, [objetivo, verObjetivo]);
    useEffect(() => {
        api.current.redibujarPanel?.({ herr, radio, fuerza, torno, material, objetivo, verObjetivo, vol: stats.vol, vol0: stats.vol0 });
    }, [herr, radio, fuerza, torno, material, objetivo, verObjetivo, stats]);

    // atajos de teclado
    useEffect(() => {
        const k = e => {
            if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
            const n = parseInt(e.key, 10);
            if (n >= 1 && n <= HERRAMIENTAS.length) {
                const h = HERRAMIENTAS[n - 1].id;
                if (h !== 'ARCILLA' || cfg.current.material === 'ARCILLA') setHerr(h);
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? api.current.rehacer?.() : api.current.deshacer?.(); }
            else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); api.current.rehacer?.(); }
            else if (e.key === '[') setRadio(r => clamp(r / 1.15, R_MIN, R_MAX));
            else if (e.key === ']') setRadio(r => clamp(r * 1.15, R_MIN, R_MAX));
            else if (e.key.toLowerCase() === 't') setTorno(t => !t);
        };
        window.addEventListener('keydown', k);
        return () => window.removeEventListener('keydown', k);
    }, []);

    /* ---------- acciones ---------- */
    const modificada = stats.nd > 0 || Math.abs(stats.vol - stats.vol0) > 1e-7;
    const confirmarPerder = () => !modificada || window.confirm('¿Empezar una pieza nueva? Se perderá la escultura actual.');

    const elegirForma = f => {
        if (f === forma && !modificada) return;
        if (!confirmarPerder()) return;
        setForma(f);
        api.current.nuevaPieza?.(f, resol);
    };
    const elegirResol = n => {
        if (n === resol || !confirmarPerder()) return;
        setResol(n);
        api.current.nuevaPieza?.(forma, n);
    };
    const empezarReto = id => {
        if (!confirmarPerder()) return;
        const o = OBJ(id);
        setObjetivo(id);
        setVerObjetivo(true);
        setForma(o.forma);
        setTorno(false);
        setReto({ id, inicio: Date.now() });
        api.current.nuevaPieza?.(o.forma, resol);
    };
    const cancelarReto = () => { setReto(null); setObjetivo(null); };
    const terminarReto = () => {
        const o = OBJ(reto.id);
        const r = api.current.comparar(o.dentro(TAM));
        const score = Math.round(r.iou * 100);
        const tiempo = Math.round((Date.now() - reto.inicio) / 1000);
        setResultado({ ...r, score, tiempo, obj: o, material });
        guardarRegistroLocal('ESCULPIR_3D', {
            titulo: `${o.nombre} (${MATERIALES[material].nombre})`,
            aciertos: score, intentos: 100, porcentaje: score, via: 'local',
        });
    };

    /* ---------- interfaz ---------- */
    const H = HERRAMIENTAS.find(h => h.id === herr);
    const retirado = stats.vol0 ? Math.max(0, (1 - stats.vol / stats.vol0) * 100) : 0;
    const o = reto ? OBJ(reto.id) : null;

    const sec = { background: '#171d25', border: '1px solid #262f3b', borderRadius: 14, padding: '12px 12px 14px', marginBottom: 10 };
    const tit = { fontSize: '0.72rem', fontWeight: 800, letterSpacing: 1, color: '#8aa0b6', textTransform: 'uppercase', margin: '0 0 8px' };
    const chip = (on, dis) => ({
        padding: '8px 6px', borderRadius: 10, cursor: dis ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontWeight: 700,
        border: on ? '2px solid #f59e0b' : '1px solid #2f3a48', background: on ? '#3a2a0c' : '#1d2530',
        color: dis ? '#5b6573' : '#e5e7eb', opacity: dis ? 0.6 : 1, textAlign: 'center', lineHeight: 1.25,
    });
    const btn = (bg = '#263241') => ({ padding: '9px 10px', borderRadius: 10, border: 'none', background: bg, color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.84rem' });

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: estrecho ? 'column' : 'row', background: '#0f1318', color: '#e8edf2', fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif' }}>
            <aside style={{ width: estrecho ? '100%' : 330, height: estrecho ? '46vh' : '100%', overflowY: 'auto', order: estrecho ? 2 : 1, padding: 12, boxSizing: 'border-box', borderRight: estrecho ? 'none' : '1px solid #222a35', borderTop: estrecho ? '1px solid #222a35' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <button onClick={onExit} style={btn()}>← Volver</button>
                    <div style={{ fontWeight: 900, fontSize: '1.08rem' }}>🗿 Taller de escultura</div>
                </div>

                {/* Reto */}
                <div style={{ ...sec, borderColor: reto ? '#0e7490' : '#262f3b' }}>
                    <div style={tit}>🎯 Reto de forma</div>
                    {!reto ? (
                        <>
                            <div style={{ fontSize: '0.78rem', color: '#9fb3c8', marginBottom: 8 }}>Talla la pieza hasta que coincida con la silueta azul. Al terminar se calcula el parecido.</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                                {OBJETIVOS.map(ob => (
                                    <button key={ob.id} onClick={() => empezarReto(ob.id)} style={chip(false)}>
                                        <div style={{ fontSize: '1.3rem' }}>{ob.emoji}</div>{ob.nombre}
                                    </button>
                                ))}
                            </div>
                        </>
                    ) : (
                        <>
                            <div style={{ fontWeight: 800, marginBottom: 6 }}>{o.emoji} {o.nombre}</div>
                            <div style={{ background: '#0b1a22', borderRadius: 10, padding: '8px 10px', fontSize: '0.8rem', color: '#a5f3fc', fontFamily: 'ui-monospace, monospace', marginBottom: 8 }}>
                                {o.formula(TAM).map((l, i) => <div key={i}>{l}</div>)}
                            </div>
                            {o.torno && <div style={{ fontSize: '0.78rem', color: '#fcd34d', marginBottom: 8 }}>💡 Es un cuerpo de revolución: enciende el torno ⚙️.</div>}
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem', marginBottom: 10, cursor: 'pointer' }}>
                                <input type="checkbox" checked={verObjetivo} onChange={e => setVerObjetivo(e.target.checked)} /> Ver la silueta
                            </label>
                            <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={terminarReto} style={{ ...btn('#0e9f6e'), flex: 2 }}>✅ Terminar y puntuar</button>
                                <button onClick={cancelarReto} style={{ ...btn(), flex: 1 }}>Salir</button>
                            </div>
                        </>
                    )}
                </div>

                {/* Herramientas */}
                <div style={sec}>
                    <div style={tit}>Herramienta</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                        {HERRAMIENTAS.map((h, i) => {
                            const dis = h.id === 'ARCILLA' && material !== 'ARCILLA';
                            return (
                                <button key={h.id} disabled={dis} title={`${h.desc} (tecla ${i + 1})`} onClick={() => setHerr(h.id)} style={chip(herr === h.id, dis)}>
                                    <div style={{ fontSize: '1.3rem' }}>{h.emoji}</div>{h.nombre}
                                </button>
                            );
                        })}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#9fb3c8', marginTop: 8, minHeight: 18 }}>{H?.desc}</div>
                    <div style={{ marginTop: 10, fontSize: '0.82rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tamaño</span><b>{(radio * 100).toFixed(1)} cm</b></div>
                        <input type="range" min={R_MIN * 100} max={R_MAX * 100} step={0.1} value={radio * 100} onChange={e => setRadio(+e.target.value / 100)} style={{ width: '100%', accentColor: '#f59e0b' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}><span>Fuerza</span><b>{Math.round(fuerza * 100)}%</b></div>
                        <input type="range" min={10} max={100} step={5} value={fuerza * 100} onChange={e => setFuerza(+e.target.value / 100)} style={{ width: '100%', accentColor: '#f59e0b' }} />
                    </div>
                    <button onClick={() => setTorno(t => !t)} style={{ ...btn(torno ? '#b45309' : '#263241'), width: '100%', marginTop: 8 }}>
                        ⚙️ Torno: {torno ? 'encendido' : 'apagado'} <span style={{ opacity: 0.6, fontWeight: 400 }}>(T)</span>
                    </button>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        <button onClick={() => api.current.deshacer?.()} disabled={!stats.nd} style={{ ...btn(), flex: 1, opacity: stats.nd ? 1 : 0.45 }}>↩ Deshacer</button>
                        <button onClick={() => api.current.rehacer?.()} disabled={!stats.nr} style={{ ...btn(), flex: 1, opacity: stats.nr ? 1 : 0.45 }}>↪ Rehacer</button>
                        <button onClick={() => api.current.enderezar?.()} title="Volver a poner la pieza derecha" style={btn()}>🧭</button>
                    </div>
                </div>

                {/* Medidas */}
                <div style={sec}>
                    <div style={tit}>📏 Medidas</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: '0.8rem' }}>
                        <div style={{ background: '#1d2530', borderRadius: 10, padding: 8 }}>Volumen<br /><b style={{ fontSize: '1rem', color: '#a7f3d0' }}>{cm3(stats.vol)}</b></div>
                        <div style={{ background: '#1d2530', borderRadius: 10, padding: 8 }}>Retirado<br /><b style={{ fontSize: '1rem', color: '#fcd34d' }}>{retirado.toFixed(1)}%</b></div>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#7b8da1', marginTop: 6 }}>Pieza inicial: {cm3(stats.vol0)} · lado {TAM * 100} cm</div>
                </div>

                {/* Pieza */}
                <div style={sec}>
                    <div style={tit}>Pieza</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 8 }}>
                        {Object.entries(MATERIALES).map(([id, m]) => (
                            <button key={id} title={m.desc} onClick={() => setMaterial(id)} style={chip(material === id)}>
                                <div style={{ fontSize: '1.2rem' }}>{m.emoji}</div>{m.nombre}
                            </button>
                        ))}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#9fb3c8', marginBottom: 8 }}>{MATERIALES[material].desc}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 6, marginBottom: 8 }}>
                        {FORMAS.map(f => (
                            <button key={f.id} onClick={() => elegirForma(f.id)} style={chip(forma === f.id)}>{f.emoji} {f.nombre}</button>
                        ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem' }}>
                        Detalle:
                        {[[64, 'Rápido'], [96, 'Normal'], [128, 'Alto']].map(([n, t]) => (
                            <button key={n} onClick={() => elegirResol(n)} style={{ ...chip(resol === n), padding: '5px 8px' }}>{t}</button>
                        ))}
                    </div>
                    <button onClick={() => { if (confirmarPerder()) api.current.nuevaPieza?.(); }} style={{ ...btn(), width: '100%', marginTop: 8 }}>🆕 Empezar de nuevo</button>
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button onClick={() => api.current.exportar?.()} style={{ ...btn('#4338ca'), flex: 1 }}>🖨️ Exportar STL</button>
                    <button onClick={() => setSonido(s => !s)} style={btn()}>{sonido ? '🔊' : '🔇'}</button>
                    <button onClick={() => setAyuda(a => !a)} style={btn()}>❓</button>
                </div>
            </aside>

            <main ref={contRef} style={{ flex: 1, position: 'relative', order: estrecho ? 1 : 2, minHeight: 0, overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 10, left: 10, right: 10, zIndex: 5, display: 'flex', gap: 8, flexWrap: 'wrap', pointerEvents: 'none' }}>
                    <span style={{ background: 'rgba(15,19,24,0.75)', padding: '6px 10px', borderRadius: 20, fontSize: '0.78rem' }}>
                        {H?.emoji} {H?.nombre} · {MATERIALES[material].emoji} {MATERIALES[material].nombre}{torno ? ' · ⚙️ torno' : ''}
                    </span>
                    {vrDisponible === false && (
                        <span style={{ background: 'rgba(15,19,24,0.75)', padding: '6px 10px', borderRadius: 20, fontSize: '0.78rem', color: '#9fb3c8' }}>
                            🥽 Ábrelo en el navegador de unas gafas VR para esculpir en inmersivo
                        </span>
                    )}
                </div>
                {ayuda && (
                    <div style={{ position: 'absolute', bottom: 70, left: 10, right: 10, maxWidth: 520, zIndex: 6, background: 'rgba(15,19,24,0.94)', border: '1px solid #2f3a48', borderRadius: 14, padding: '12px 14px', fontSize: '0.8rem', lineHeight: 1.55 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>🖱️ Ordenador / tableta</b><button onClick={() => setAyuda(false)} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer' }}>✕</button></div>
                        Arrastra <b>sobre la pieza</b> para esculpir; fuera de ella, para girar la cámara. Rueda o pellizco = zoom; botón derecho = desplazar.<br />
                        Teclas: <b>1–6</b> herramientas · <b>[ ]</b> tamaño · <b>T</b> torno · <b>Ctrl+Z / Ctrl+Y</b> deshacer / rehacer.
                        <div style={{ marginTop: 8 }}><b>🥽 Gafas VR</b></div>
                        <b>Gatillo derecho</b>: usar la herramienta (la esfera se pone verde al tocar) · <b>A / B</b>: cambiar herramienta · <b>stick derecho</b>: tamaño.<br />
                        <b>Agarre</b> (cualquier mano): coger y girar la pieza · <b>stick izquierdo</b>: girarla y subir o bajar la peana · <b>X / Y</b>: deshacer / rehacer.<br />
                        Apunta al panel flotante y pulsa el gatillo para cambiar material, torno o herramienta.
                    </div>
                )}
            </main>

            {resultado && (
                <ResultadoReto r={resultado} onCerrar={() => setResultado(null)} onEnviar={() => setEnviar(true)}
                    onOtro={() => { setResultado(null); cancelarReto(); }} />
            )}
            {enviar && resultado && <ModalEnviarProfe datos={resultado} onClose={() => setEnviar(false)} />}
        </div>
    );
}

/* ═══════════════════ RESULTADO DEL RETO ═══════════════════ */

function ResultadoReto({ r, onCerrar, onEnviar, onOtro }) {
    const color = r.score >= 85 ? '#22c55e' : r.score >= 70 ? '#84cc16' : r.score >= 50 ? '#f59e0b' : '#ef4444';
    const frase = r.score >= 85 ? '¡Obra maestra!' : r.score >= 70 ? '¡Muy bien tallado!' : r.score >= 50 ? 'Buen trabajo, se puede afinar' : 'Sigue practicando';
    const fila = (a, b) => <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #263241' }}><span style={{ color: '#9fb3c8' }}>{a}</span><b>{b}</b></div>;
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: '#151b23', border: '1px solid #2f3a48', borderRadius: 20, width: '100%', maxWidth: 400, padding: 22, color: 'white' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2.4rem' }}>{r.obj.emoji}</div>
                    <div style={{ fontWeight: 800 }}>{r.obj.nombre} · {MATERIALES[r.material].nombre}</div>
                    <div style={{ fontSize: '3.2rem', fontWeight: 900, color, lineHeight: 1.1, marginTop: 6 }}>{r.score}%</div>
                    <div style={{ color, fontWeight: 700, marginBottom: 12 }}>{frase}</div>
                </div>
                <div style={{ fontSize: '0.86rem' }}>
                    {fila('Volumen objetivo', `≈ ${cm3(r.volObjetivo)}`)}
                    {fila('Volumen de tu pieza', `≈ ${cm3(r.volPieza)}`)}
                    {fila('Material que sobra', cm3(r.sobrante))}
                    {fila('Material quitado de más', cm3(r.falta))}
                    {fila('Tiempo', `${Math.floor(r.tiempo / 60)} min ${r.tiempo % 60} s`)}
                </div>
                <div style={{ fontSize: '0.74rem', color: '#7b8da1', marginTop: 8 }}>
                    La nota es el parecido entre las dos formas: volumen común ÷ volumen total ocupado por ambas.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
                    <button onClick={onEnviar} style={{ padding: 11, borderRadius: 11, border: 'none', background: 'linear-gradient(135deg,#3498db,#2980b9)', color: 'white', fontWeight: 800, cursor: 'pointer' }}>📤 Enviar al profesor</button>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={onCerrar} style={{ flex: 1, padding: 10, borderRadius: 11, border: '1px solid #2f3a48', background: 'transparent', color: 'white', cursor: 'pointer' }}>Seguir tallando</button>
                        <button onClick={onOtro} style={{ flex: 1, padding: 10, borderRadius: 11, border: 'none', background: '#263241', color: 'white', cursor: 'pointer', fontWeight: 700 }}>Otro reto</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════ ENVIAR AL PROFESOR ═══════════════════ */

function ModalEnviarProfe({ datos, onClose }) {
    const [codigo, setCodigo] = useState('');
    const [nombre, setNombre] = useState('');
    const [curso, setCurso] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [enviado, setEnviado] = useState(false);
    const [error, setError] = useState('');

    const enviarInforme = async () => {
        const code = codigo.trim().toUpperCase();
        if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
        if (!code) { setError('Escribe el código del profesor.'); return; }
        setEnviando(true); setError('');
        try {
            const snap = await getDoc(doc(db, 'codigos_profesor', code));
            if (!snap.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
            const material = MATERIALES[datos.material].nombre;
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'ESCULPIR_3D',
                modalidad: 'Individual',
                fecha: new Date(),
                codigoProfesor: code,
                objetivo: datos.obj.nombre,
                material,
                jugadores: [{
                    nombre: nombre.trim(),
                    curso: curso.trim(),
                    aciertos: datos.score,
                    intentos: 100,
                    porcentaje: datos.score,
                    objetivo: datos.obj.nombre,
                    material,
                    sobranteCm3: Math.round(datos.sobrante * 1e6),
                    faltaCm3: Math.round(datos.falta * 1e6),
                    tiempo: datos.tiempo,
                }],
            });
            setEnviado(true);
        } catch (e) { setError('Error: ' + e.message); }
        setEnviando(false);
    };

    const inp = { padding: '9px 12px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' };
    const lab = { fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 10002, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
            <div style={{ background: '#1e272e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, width: '100%', maxWidth: 380, padding: '26px 28px', color: 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f1c40f' }}>📤 Enviar al profesor</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.2rem' }}>✕</button>
                </div>
                {enviado ? (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{ fontSize: '3rem' }}>✅</div>
                        <div style={{ color: '#2ecc71', fontWeight: 700 }}>¡Informe enviado!</div>
                        <div style={{ color: '#aaa', fontSize: '0.88rem', marginTop: 8 }}>{datos.obj.nombre}: {datos.score}% de parecido</div>
                        <button onClick={onClose} style={{ marginTop: 16, padding: '9px 22px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', color: 'white' }}>Cerrar</button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div><label style={lab}>Nombre y apellido</label>
                            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre completo" style={inp} /></div>
                        <div><label style={lab}>Curso</label>
                            <input value={curso} onChange={e => setCurso(e.target.value)} placeholder="Ej: 3º ESO B" style={inp} /></div>
                        <div><label style={lab}>Código del profesor</label>
                            <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="Ej: PROF01" maxLength={10} style={{ ...inp, letterSpacing: 2, fontWeight: 700 }} /></div>
                        {error && <div style={{ color: '#e74c3c', fontSize: '0.8rem' }}>⚠ {error}</div>}
                        <div style={{ display: 'flex', gap: 9, marginTop: 4 }}>
                            <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', cursor: 'pointer', color: 'white' }}>Cancelar</button>
                            <button onClick={enviarInforme} disabled={enviando} style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: enviando ? '#555' : 'linear-gradient(135deg,#3498db,#2980b9)', color: 'white', fontWeight: 700, cursor: enviando ? 'default' : 'pointer' }}>
                                {enviando ? 'Enviando…' : '📤 Enviar'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
