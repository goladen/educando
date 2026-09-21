import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';

/**
 * Sala 3D: varios modelos del catálogo en un mismo espacio por el que se
 * camina, también con gafas de realidad virtual.
 *
 * Los modelos se cargan uno a uno (no en paralelo) para no saturar la conexión
 * del aula y poder ir mostrando el progreso pieza a pieza.
 */

/**
 * Aplica a un soporte ya cargado la posición, giro, altura y pedestal de su
 * pieza. Se llama tanto al cargar como en cada ajuste del editor, así que los
 * cambios se ven al instante sin reconstruir la escena.
 */
function colocar(soporte, pieza) {
    const { escalador, ped, cartel, mayor, altoOriginal } = soporte.userData;
    const altura = pieza.altura || 1.6;
    const k = altura / mayor;
    const conPedestal = pieza.pedestal !== false;

    escalador.scale.setScalar(k);
    // El modelo está centrado en su origen: hay que subirlo media altura para
    // que apoye en el suelo (o encima del pedestal).
    escalador.position.y = (altoOriginal / 2) * k + (conPedestal ? 0.18 : 0);

    ped.visible = conPedestal;
    cartel.position.y = escalador.position.y + (altoOriginal / 2) * k + 0.35;

    soporte.position.set(pieza.pos?.[0] || 0, pieza.pos?.[1] || 0, pieza.pos?.[2] || 0);
    soporte.rotation.y = pieza.rotY || 0;
}

/** Cartel con el nombre de la pieza, dibujado en un canvas. */
function carteles(texto) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(15,23,42,0.85)';
    g.roundRect?.(0, 0, 512, 128, 24); g.fill();
    g.fillStyle = '#ffffff';
    g.font = 'bold 52px system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const t = texto.length > 22 ? texto.slice(0, 21) + '…' : texto;
    g.fillText(t, 256, 68);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

export default function Sala3D({ sala, onSalir, onExaminar, puedeEditar = false, onGuardar }) {
    const contRef  = useRef(null);
    const vrBtnRef = useRef(null);
    const api      = useRef({});
    const alClicarRef = useRef(() => {});

    // Cada pieza lleva un identificador estable para poder sincronizar la
    // escena con el estado de React sin depender del orden del array.
    const conPid = (lista) => (lista || []).map((p, i) => ({ ...p, pid: p.pid || `${i}_${Math.random().toString(36).slice(2, 8)}` }));

    const [cargando, setCargando]   = useState({ hechas: 0, total: (sala.piezas || []).length });
    const [errores, setErrores]     = useState([]);
    const [seleccion, setSeleccion] = useState(null);   // índice de pieza
    const [enVR, setEnVR]           = useState(false);
    const [editar, setEditar]       = useState(false);
    const [piezas, setPiezas]       = useState(() => conPid(sala.piezas));
    const piezasRef = useRef(piezas);
    useEffect(() => { piezasRef.current = piezas; }, [piezas]);
    const [guardando, setGuardando] = useState(false);
    const [aviso, setAviso]         = useState(null);

    /* ---------- escena ---------- */
    useEffect(() => {
        const cont = contRef.current;
        if (!cont) return;

        let vivo = true;
        const aLimpiar = [];

        const escena = new THREE.Scene();
        escena.background = new THREE.Color(0x0b1220);
        escena.fog = new THREE.Fog(0x0b1220, 14, 34);

        const camara = new THREE.PerspectiveCamera(60, cont.clientWidth / cont.clientHeight, 0.05, 120);
        camara.position.set(0, 1.6, 4.2);

        const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(cont.clientWidth, cont.clientHeight);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.xr.enabled = true;
        cont.appendChild(renderer.domElement);

        const pmrem = new THREE.PMREMGenerator(renderer);
        const entorno = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        escena.environment = entorno;

        escena.add(new THREE.HemisphereLight(0xcfe4ff, 0x1a2430, 1.0));
        const sol = new THREE.DirectionalLight(0xffffff, 1.4);
        sol.position.set(5, 9, 4);
        escena.add(sol);

        // Rig del visitante: en VR la cámara cuelga de aquí y se teletransporta.
        const visitante = new THREE.Group();
        visitante.add(camara);
        escena.add(visitante);

        // Suelo de la sala.
        const suelo = new THREE.Mesh(
            new THREE.CircleGeometry(16, 64),
            new THREE.MeshStandardMaterial({ color: 0x16212e, roughness: 0.95 })
        );
        suelo.rotation.x = -Math.PI / 2;
        suelo.name = 'suelo';
        escena.add(suelo);
        escena.add(new THREE.GridHelper(32, 32, 0x24485c, 0x1a2c3a));

        const grupoPiezas = new THREE.Group();
        escena.add(grupoPiezas);

        // Aro que señala la pieza seleccionada mientras se coloca.
        const marcaSel = new THREE.Mesh(
            new THREE.RingGeometry(0.52, 0.62, 32),
            new THREE.MeshBasicMaterial({ color: 0x2dd4bf, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
        );
        marcaSel.rotation.x = -Math.PI / 2;
        marcaSel.position.y = 0.02;
        marcaSel.visible = false;
        escena.add(marcaSel);

        const controles = new OrbitControls(camara, renderer.domElement);
        controles.enableDamping = true;
        controles.dampingFactor = 0.08;
        controles.target.set(0, 1.1, 0);
        controles.maxPolarAngle = Math.PI / 2 - 0.03;
        controles.minDistance = 0.6;
        controles.maxDistance = 24;
        controles.update();

        /* ---- mandos VR: rayo + teletransporte ---- */
        const geoRayo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
        const mandos = [];
        const marcaTP = new THREE.Mesh(
            new THREE.RingGeometry(0.18, 0.24, 24),
            new THREE.MeshBasicMaterial({ color: 0x2dd4bf, side: THREE.DoubleSide })
        );
        marcaTP.rotation.x = -Math.PI / 2;
        marcaTP.visible = false;
        escena.add(marcaTP);

        for (let i = 0; i < 2; i++) {
            const c = renderer.xr.getController(i);
            const linea = new THREE.Line(geoRayo, new THREE.LineBasicMaterial({ color: 0x2dd4bf }));
            linea.scale.z = 6;
            c.add(linea);
            visitante.add(c);
            const grip = renderer.xr.getControllerGrip(i);
            const cuerpo = new THREE.Mesh(
                new THREE.CapsuleGeometry(0.022, 0.07, 6, 12),
                new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 })
            );
            cuerpo.rotation.x = Math.PI / 2.4;
            grip.add(cuerpo);
            visitante.add(grip);

            const info = { ctrl: c, gamepad: null };
            c.addEventListener('connected', ev => { info.gamepad = ev.data.gamepad || null; });
            c.addEventListener('disconnected', () => { info.gamepad = null; });
            c.addEventListener('selectstart', () => {
                // Apuntar al suelo teletransporta; apuntar a una pieza la abre.
                const m = new THREE.Matrix4().identity().extractRotation(c.matrixWorld);
                const rc = new THREE.Raycaster();
                rc.ray.origin.setFromMatrixPosition(c.matrixWorld);
                rc.ray.direction.set(0, 0, -1).applyMatrix4(m);
                const enPieza = rc.intersectObject(grupoPiezas, true)[0];
                if (enPieza) {
                    const raiz = buscarRaiz(enPieza.object);
                    if (raiz) { alClicarRef.current({ pid: raiz.userData.pid }); return; }
                }
                const enSuelo = rc.intersectObject(suelo)[0];
                if (enSuelo) {
                    visitante.position.x = enSuelo.point.x;
                    visitante.position.z = enSuelo.point.z;
                }
            });
            mandos.push(info);
        }

        const buscarRaiz = (obj) => {
            let o = obj;
            while (o && o.userData.pid === undefined) o = o.parent;
            return o;
        };

        /* ---- carga de las piezas, una a una ---- */
        const draco = new DRACOLoader().setDecoderPath('/draco/');
        const ktx2  = new KTX2Loader().setTranscoderPath('/basis/').detectSupport(renderer);
        const loader = new GLTFLoader();
        loader.setDRACOLoader(draco);
        loader.setKTX2Loader(ktx2);
        loader.setMeshoptDecoder(MeshoptDecoder);
        loader.setCrossOrigin('anonymous');

        const cargarPieza = (pieza) => new Promise((resolve) => {
            loader.load(pieza.url, (gltf) => {
                if (!vivo) return resolve();
                const raiz = gltf.scene || gltf.scenes[0];

                // Jerarquía en tres niveles para poder ajustarlo todo en vivo:
                //   soporte  → posición en la sala y giro
                //   escalador→ tamaño (altura en metros)
                //   raiz     → el modelo, centrado en su propio origen
                // Centrar DENTRO del escalador (y no moviendo la raíz ya escalada)
                // es lo que evita que el modelo quede descentrado cuando su
                // origen está lejos de su centro geométrico.
                const caja = new THREE.Box3().setFromObject(raiz);
                const tam = caja.getSize(new THREE.Vector3());
                const centro = caja.getCenter(new THREE.Vector3());
                const mayor = Math.max(tam.x, tam.y, tam.z) || 1;
                raiz.position.sub(centro);

                const escalador = new THREE.Group();
                escalador.add(raiz);

                const soporte = new THREE.Group();
                soporte.add(escalador);

                const ped = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.42, 0.5, 0.18, 24),
                    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 })
                );
                ped.position.y = 0.09;
                soporte.add(ped);

                const cartel = new THREE.Sprite(new THREE.SpriteMaterial({ map: carteles(pieza.nombre || 'Modelo'), transparent: true }));
                cartel.scale.set(0.9, 0.225, 1);
                soporte.add(cartel);

                soporte.userData = { pid: pieza.pid, escalador, ped, cartel, mayor, altoOriginal: tam.y };
                colocar(soporte, pieza);
                grupoPiezas.add(soporte);
                setCargando(c => ({ ...c, hechas: c.hechas + 1 }));
                resolve();
            }, undefined, () => {
                if (!vivo) return resolve();
                setErrores(e => [...e, pieza.nombre || pieza.url]);
                setCargando(c => ({ ...c, hechas: c.hechas + 1 }));
                resolve();
            });
        });

        (async () => {
            for (const p of piezasRef.current) {
                if (!vivo) break;
                await cargarPieza(p);
            }
        })();

        api.current = { escena, camara, renderer, controles, grupoPiezas, visitante, suelo, cargarPieza, marcaSel };

        /* ---- clic de ratón ---- */
        const rayoRaton = new THREE.Raycaster();
        const puntero = new THREE.Vector2();
        let bajada = null;
        const alPulsar = (ev) => { bajada = { x: ev.clientX, y: ev.clientY, t: Date.now() }; };
        const alSoltar = (ev) => {
            if (!bajada) return;
            const movido = Math.hypot(ev.clientX - bajada.x, ev.clientY - bajada.y);
            const tardanza = Date.now() - bajada.t;
            bajada = null;
            if (movido > 6 || tardanza > 600) return;

            const r = renderer.domElement.getBoundingClientRect();
            puntero.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
            puntero.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
            rayoRaton.setFromCamera(puntero, camara);

            const enPieza = rayoRaton.intersectObject(grupoPiezas, true)[0];
            if (enPieza) {
                const raiz = buscarRaiz(enPieza.object);
                if (raiz) { alClicarRef.current({ pid: raiz.userData.pid }); return; }
            }
            const enSuelo = rayoRaton.intersectObject(suelo)[0];
            alClicarRef.current(enSuelo ? { suelo: [enSuelo.point.x, 0, enSuelo.point.z] } : { vacio: true });
        };
        renderer.domElement.addEventListener('pointerdown', alPulsar);
        renderer.domElement.addEventListener('pointerup', alSoltar);

        /* ---- caminar con el teclado ---- */
        const teclas = new Set();
        const alBajarTecla = (e) => { if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return; teclas.add(e.key.toLowerCase()); };
        const alSubirTecla = (e) => teclas.delete(e.key.toLowerCase());
        window.addEventListener('keydown', alBajarTecla);
        window.addEventListener('keyup', alSubirTecla);

        const adelante = new THREE.Vector3(), lado = new THREE.Vector3();
        const moverConTeclado = (dt) => {
            const w = teclas.has('w') || teclas.has('arrowup');
            const s = teclas.has('s') || teclas.has('arrowdown');
            const a = teclas.has('a') || teclas.has('arrowleft');
            const d = teclas.has('d') || teclas.has('arrowright');
            if (!(w || s || a || d)) return;
            camara.getWorldDirection(adelante);
            adelante.y = 0; adelante.normalize();
            lado.crossVectors(adelante, camara.up).normalize();
            const v = 3.2 * dt;
            const mov = new THREE.Vector3();
            if (w) mov.add(adelante); if (s) mov.sub(adelante);
            if (d) mov.add(lado);     if (a) mov.sub(lado);
            if (mov.lengthSq() === 0) return;
            mov.normalize().multiplyScalar(v);
            camara.position.add(mov);
            controles.target.add(mov);
        };

        /* ---- bucle ---- */
        const reloj = new THREE.Timer();
        renderer.setAnimationLoop(() => {
            reloj.update();
            const dt = Math.min(reloj.getDelta(), 0.1);

            if (renderer.xr.isPresenting) {
                // Joystick: avanzar mirando y girar.
                mandos.forEach(m => {
                    const ax = m.gamepad?.axes;
                    if (!ax) return;
                    const y = ax[3] ?? ax[1] ?? 0;
                    const x = ax[2] ?? ax[0] ?? 0;
                    if (Math.abs(y) > 0.15) {
                        const dir = new THREE.Vector3();
                        camara.getWorldDirection(dir); dir.y = 0; dir.normalize();
                        visitante.position.addScaledVector(dir, -y * dt * 2.4);
                    }
                    if (Math.abs(x) > 0.3) visitante.rotation.y -= x * dt * 1.4;
                });
            } else {
                moverConTeclado(dt);
                controles.update();
            }
            renderer.render(escena, camara);
        });

        /* ---- VR ---- */
        if (navigator.xr?.isSessionSupported) {
            navigator.xr.isSessionSupported('immersive-vr').then(ok => {
                if (!vivo || !ok || !vrBtnRef.current) return;
                const btn = VRButton.createButton(renderer);
                Object.assign(btn.style, { position: 'static', transform: 'none', width: '100%', margin: 0, borderRadius: '10px', fontSize: '0.8rem', padding: '9px 10px' });
                vrBtnRef.current.appendChild(btn);
                aLimpiar.push(() => btn.remove());
            }).catch(() => {});
        }
        const onXRStart = () => { setEnVR(true); visitante.position.set(0, 0, 3); };
        const onXREnd   = () => setEnVR(false);
        renderer.xr.addEventListener('sessionstart', onXRStart);
        renderer.xr.addEventListener('sessionend', onXREnd);

        const onResize = () => {
            if (renderer.xr.isPresenting || !contRef.current) return;
            const w = contRef.current.clientWidth, h = contRef.current.clientHeight;
            if (!w || !h) return;
            camara.aspect = w / h; camara.updateProjectionMatrix(); renderer.setSize(w, h);
        };
        window.addEventListener('resize', onResize);
        const ro = new ResizeObserver(onResize);
        ro.observe(cont);

        return () => {
            vivo = false;
            renderer.setAnimationLoop(null);
            renderer.xr.removeEventListener('sessionstart', onXRStart);
            renderer.xr.removeEventListener('sessionend', onXREnd);
            window.removeEventListener('resize', onResize);
            window.removeEventListener('keydown', alBajarTecla);
            window.removeEventListener('keyup', alSubirTecla);
            renderer.domElement.removeEventListener('pointerdown', alPulsar);
            renderer.domElement.removeEventListener('pointerup', alSoltar);
            ro.disconnect();
            aLimpiar.forEach(f => { try { f(); } catch (_) {} });
            controles.dispose();
            escena.traverse(o => {
                if (o.isMesh || o.isSprite) {
                    o.geometry?.dispose?.();
                    (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
                        if (!m) return;
                        Object.values(m).forEach(v => { if (v?.isTexture) v.dispose(); });
                        m.dispose?.();
                    });
                }
            });
            entorno.dispose(); pmrem.dispose();
            draco.dispose(); ktx2.dispose();
            renderer.dispose();
            if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
            api.current = {};
        };
    }, [sala.id]);   // eslint-disable-line react-hooks/exhaustive-deps

    /* ---------- los cambios se ven al instante en la sala ---------- */
    useEffect(() => {
        const { grupoPiezas } = api.current;
        if (!grupoPiezas) return;

        // Quitar de la escena las piezas que ya no están.
        const vivos = new Set(piezas.map(p => p.pid));
        [...grupoPiezas.children].forEach(s => {
            if (!vivos.has(s.userData.pid)) grupoPiezas.remove(s);
        });

        // Y aplicar a las demás su colocación actual.
        piezas.forEach(p => {
            const s = grupoPiezas.children.find(c => c.userData.pid === p.pid);
            if (s) colocar(s, p);
        });
    }, [piezas]);

    /* ---------- aro bajo la pieza seleccionada ---------- */
    useEffect(() => {
        const { marcaSel, grupoPiezas } = api.current;
        if (!marcaSel) return;
        const p = seleccion != null ? piezas[seleccion] : null;
        const visible = !!(p && editar);
        marcaSel.visible = visible;
        if (visible) marcaSel.position.set(p.pos?.[0] || 0, 0.02, p.pos?.[2] || 0);
        // eslint-disable-next-line no-unused-expressions
        grupoPiezas;
    }, [seleccion, editar, piezas]);

    /* ---------- clic según el modo ---------- */
    useEffect(() => {
        alClicarRef.current = (info) => {
            if (editar && info.suelo && seleccion != null) {
                // Recolocar la pieza seleccionada donde se ha pinchado.
                mover(seleccion, { pos: info.suelo });
                return;
            }
            if (info.pid != null) {
                const i = piezasRef.current.findIndex(p => p.pid === info.pid);
                if (i >= 0) setSeleccion(i);
                return;
            }
            if (!editar) setSeleccion(null);
        };
    });   // sin deps: siempre la versión actual

    /* ---------- edición ---------- */
    // Los cambios se reflejan en la escena al instante (efecto de arriba);
    // el aviso solo recuerda que aún no se han guardado en Firestore.
    const aplicar = (nuevas) => {
        setPiezas(nuevas);
        setAviso('Cambios sin guardar');
    };

    const mover = (i, cambios) => aplicar(piezas.map((p, j) => (j === i ? { ...p, ...cambios } : p)));
    const quitar = (i) => { aplicar(piezas.filter((_, j) => j !== i)); setSeleccion(null); };

    const guardar = async () => {
        setGuardando(true);
        try {
            await onGuardar({ ...sala, piezas });
            setAviso('Guardado ✓');
            setTimeout(() => setAviso(null), 2500);
        } catch (e) {
            setAviso('Error: ' + e.message);
        } finally {
            setGuardando(false);
        }
    };

    const pieza = seleccion != null ? piezas[seleccion] : null;
    const progreso = cargando.total ? Math.round((cargando.hechas / cargando.total) * 100) : 100;
    const btn = (activo) => ({
        padding: '8px 10px', borderRadius: 10, border: 'none', cursor: 'pointer',
        background: activo ? '#2dd4bf' : 'rgba(255,255,255,0.12)',
        color: activo ? '#0f172a' : '#e2e8f0', fontWeight: 700, fontSize: '0.8rem',
        width: '100%', textAlign: 'left',
    });

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#0b1220' }}>
            <div ref={contRef} style={{ position: 'absolute', inset: 0 }} />

            <button onClick={onSalir}
                style={{ position: 'absolute', top: 12, left: 12, zIndex: 3, padding: '9px 14px', borderRadius: 10, border: 'none', background: 'rgba(15,23,42,0.85)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                ← Salir
            </button>

            <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 3, color: '#e2e8f0', fontWeight: 800, fontSize: '0.95rem', textShadow: '0 2px 6px rgba(0,0,0,0.6)' }}>
                {sala.emoji} {sala.titulo}
            </div>

            {/* Carga */}
            {progreso < 100 && (
                <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', zIndex: 4, textAlign: 'center', color: '#e2e8f0', pointerEvents: 'none' }}>
                    <div style={{ fontSize: '2rem' }}>🏛️</div>
                    <div style={{ fontWeight: 700, marginTop: 6 }}>Montando la sala… {cargando.hechas}/{cargando.total}</div>
                    <div style={{ width: 220, height: 6, background: 'rgba(255,255,255,0.15)', borderRadius: 4, margin: '10px auto 0', overflow: 'hidden' }}>
                        <div style={{ width: `${progreso}%`, height: '100%', background: '#2dd4bf', transition: 'width .3s' }} />
                    </div>
                </div>
            )}

            {errores.length > 0 && (
                <div style={{ position: 'absolute', bottom: 12, left: 12, zIndex: 4, background: 'rgba(248,113,113,0.15)', border: '1px solid #f87171', color: '#fecaca', padding: '8px 12px', borderRadius: 10, fontSize: '0.76rem' }}>
                    ⚠️ No se pudieron cargar: {errores.join(', ')}
                </div>
            )}

            {/* Controles */}
            {!enVR && (
                <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 3, width: 190, display: 'flex', flexDirection: 'column', gap: 7,
                    background: 'rgba(15,23,42,0.88)', padding: 10, borderRadius: 14, backdropFilter: 'blur(6px)' }}>
                    <div style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700 }}>SALA</div>
                    <div ref={vrBtnRef} />
                    {puedeEditar && (
                        <button style={btn(editar)} onClick={() => { setEditar(v => !v); setSeleccion(null); }}>
                            ✏️ Colocar piezas
                        </button>
                    )}
                    {editar && (
                        <button style={{ ...btn(false), background: '#2dd4bf', color: '#0f172a', opacity: guardando ? 0.6 : 1 }}
                            onClick={guardar} disabled={guardando}>
                            {guardando ? '💾 Guardando…' : '💾 Guardar sala'}
                        </button>
                    )}
                    {aviso && <div style={{ color: aviso.startsWith('Error') ? '#f87171' : '#2dd4bf', fontSize: '0.7rem' }}>{aviso}</div>}
                    <div style={{ color: '#64748b', fontSize: '0.66rem', lineHeight: 1.5, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 6 }}>
                        WASD para caminar<br />Arrastra para mirar<br />Pincha una pieza para verla
                    </div>
                </div>
            )}

            {/* Ficha de la pieza seleccionada */}
            {pieza && !enVR && (
                <div style={{ position: 'absolute', left: 12, bottom: 12, zIndex: 4, width: 'min(330px, calc(100% - 24px))',
                    background: 'rgba(15,23,42,0.94)', color: '#e2e8f0', padding: '14px 16px', borderRadius: 14, backdropFilter: 'blur(6px)' }}>
                    <button onClick={() => setSeleccion(null)}
                        style={{ float: 'right', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
                    <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 8 }}>{pieza.emoji} {pieza.nombre}</div>

                    {!editar ? (
                        <button onClick={() => onExaminar(pieza)}
                            style={{ padding: '9px 14px', borderRadius: 10, border: 'none', background: '#2dd4bf', color: '#0f172a', fontWeight: 800, cursor: 'pointer', fontSize: '0.84rem' }}>
                            🔍 Examinar de cerca
                        </button>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ color: '#94a3b8', fontSize: '0.72rem' }}>Pincha en el suelo para moverla aquí.</div>
                            <label style={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 700 }}>
                                Altura: {(pieza.altura || 1.6).toFixed(1)} m
                                <input type="range" min="0.2" max="4" step="0.1" value={pieza.altura || 1.6}
                                    onChange={e => mover(seleccion, { altura: Number(e.target.value) })}
                                    style={{ width: '100%' }} />
                            </label>
                            <label style={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 700 }}>
                                Giro: {Math.round((pieza.rotY || 0) * 180 / Math.PI)}°
                                <input type="range" min="0" max="6.28" step="0.05" value={pieza.rotY || 0}
                                    onChange={e => mover(seleccion, { rotY: Number(e.target.value) })}
                                    style={{ width: '100%' }} />
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#cbd5e1', fontSize: '0.78rem', cursor: 'pointer' }}>
                                <input type="checkbox" checked={pieza.pedestal !== false}
                                    onChange={e => mover(seleccion, { pedestal: e.target.checked })} />
                                Sobre pedestal
                            </label>
                            <button onClick={() => quitar(seleccion)}
                                style={{ padding: '8px', borderRadius: 10, border: 'none', background: 'rgba(248,113,113,0.18)', color: '#fca5a5', fontWeight: 700, cursor: 'pointer', fontSize: '0.78rem' }}>
                                🗑 Quitar de la sala
                            </button>
                        </div>
                    )}
                </div>
            )}

            {editar && !pieza && (
                <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 4,
                    background: 'rgba(45,212,191,0.12)', border: '1px solid rgba(45,212,191,0.4)', color: '#99f6e4', padding: '8px 14px', borderRadius: 10, fontSize: '0.78rem' }}>
                    Pincha una pieza para moverla, girarla o cambiar su tamaño.
                </div>
            )}
        </div>
    );
}
