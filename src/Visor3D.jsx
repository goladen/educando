import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import {
    MODELOS_3D, CATEGORIAS_3D, leerModelosLocales, guardarModeloLocal,
    borrarModeloLocal, validarUrlModelo, leerModelosPublicados, publicarModelo,
    despublicarModelo,
} from './modelos3d';
import { cloudinaryListo, subirModelo, subirModeloFirmado, esUrlCloudinary, MAX_MB } from './config/cloudinary';
import { auth } from './firebase';

const ADMIN_EMAIL = 'goladen@gmail.com';

/* ===================================================================== */
/*  ESCENA 3D                                                            */
/* ===================================================================== */

function EscenaModelo({ modelo, onVolver }) {
    const contRef  = useRef(null);
    const vrBtnRef = useRef(null);
    const api      = useRef({});

    const [progreso, setProgreso]     = useState(0);
    const [error, setError]           = useState(null);
    const [listo, setListo]           = useState(false);
    const [stats, setStats]           = useState(null);
    const [clips, setClips]           = useState([]);
    const [clipActivo, setClipActivo] = useState(-1);
    const [autoRotar, setAutoRotar]   = useState(true);
    const [wireframe, setWireframe]   = useState(false);
    const [enVR, setEnVR]             = useState(false);
    const [panel, setPanel]           = useState(true);

    /* ---------- montaje de la escena ---------- */
    useEffect(() => {
        const cont = contRef.current;
        if (!cont) return;

        let vivo = true;
        const aLimpiar = [];

        const escena = new THREE.Scene();
        escena.background = new THREE.Color(0x101820);

        const camara = new THREE.PerspectiveCamera(50, cont.clientWidth / cont.clientHeight, 0.01, 200);
        camara.position.set(0, 0.25, 2.2);

        const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(cont.clientWidth, cont.clientHeight);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;
        renderer.xr.enabled = true;
        cont.appendChild(renderer.domElement);

        // Iluminación basada en imagen: sin esto los materiales PBR de Sketchfab
        // se ven planos y apagados.
        const pmrem = new THREE.PMREMGenerator(renderer);
        const entorno = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        escena.environment = entorno;

        escena.add(new THREE.HemisphereLight(0xcfe4ff, 0x20262e, 0.9));
        const sol = new THREE.DirectionalLight(0xffffff, 1.6);
        sol.position.set(3, 6, 4);
        escena.add(sol);
        const relleno = new THREE.DirectionalLight(0xffffff, 0.5);
        relleno.position.set(-4, 2, -3);
        escena.add(relleno);

        // Rig del jugador: en VR la cámara cuelga de aquí (igual que en la Sala de Geometría).
        const jugador = new THREE.Group();
        jugador.add(camara);
        escena.add(jugador);

        // Rejilla de suelo: solo en VR, da referencia espacial y evita mareo.
        const rejilla = new THREE.GridHelper(12, 24, 0x2dd4bf, 0x1e3a4a);
        rejilla.visible = false;
        escena.add(rejilla);

        // Pivote: contiene el modelo ya centrado y normalizado a 1 unidad.
        const pivote = new THREE.Group();
        escena.add(pivote);

        const controles = new OrbitControls(camara, renderer.domElement);
        controles.enableDamping = true;
        controles.dampingFactor = 0.08;
        controles.target.set(0, 0, 0);
        controles.minDistance = 0.3;
        controles.maxDistance = 20;
        controles.autoRotate = true;
        controles.autoRotateSpeed = 1.6;
        controles.update();

        let escalaVR = 1;

        const colocarEnVR = () => {
            pivote.position.set(0, 1.15, -0.75);
            pivote.quaternion.identity();
            pivote.scale.setScalar(escalaVR);
        };
        const colocarEnEscritorio = () => {
            pivote.position.set(0, 0, 0);
            pivote.quaternion.identity();
            pivote.scale.setScalar(1);
        };

        /* ---- mandos VR ---- */
        let escalaBase = null;   // referencia al agarrar con las dos manos
        const mTmp = new THREE.Matrix4();
        const vA = new THREE.Vector3(), vB = new THREE.Vector3();

        const geoRayo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
        const mandos = [];
        for (let i = 0; i < 2; i++) {
            const c = renderer.xr.getController(i);
            const rayo = new THREE.Line(geoRayo, new THREE.LineBasicMaterial({ color: 0x2dd4bf }));
            rayo.scale.z = 3;
            c.add(rayo);
            jugador.add(c);

            const grip = renderer.xr.getControllerGrip(i);
            const cuerpo = new THREE.Mesh(
                new THREE.CapsuleGeometry(0.022, 0.07, 6, 12),
                new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 })
            );
            cuerpo.rotation.x = Math.PI / 2.4;
            grip.add(cuerpo);
            jugador.add(grip);

            const info = { ctrl: c, gamepad: null, agarrando: false, offset: new THREE.Matrix4() };
            c.addEventListener('connected', (ev) => { info.gamepad = ev.data.gamepad || null; });
            c.addEventListener('disconnected', () => { info.gamepad = null; info.agarrando = false; });
            c.addEventListener('selectstart', () => {
                info.agarrando = true;
                // offset = mando⁻¹ · pivote → al mover el mando, el modelo lo sigue
                info.offset.copy(c.matrixWorld).invert().multiply(pivote.matrixWorld);
                escalaBase = null;
            });
            c.addEventListener('selectend', () => { info.agarrando = false; escalaBase = null; });
            c.addEventListener('squeezestart', () => { colocarEnVR(); });
            mandos.push(info);
        }

        /* ---- carga del modelo ---- */
        let mezclador = null;
        let clipsGltf = [];
        const materiales = new Set();

        const draco = new DRACOLoader().setDecoderPath('/draco/');
        const ktx2  = new KTX2Loader().setTranscoderPath('/basis/').detectSupport(renderer);
        const loader = new GLTFLoader();
        loader.setDRACOLoader(draco);
        loader.setKTX2Loader(ktx2);
        loader.setMeshoptDecoder(MeshoptDecoder);
        loader.setCrossOrigin('anonymous');

        loader.load(
            modelo.url,
            (gltf) => {
                if (!vivo) return;
                const raiz = gltf.scene || gltf.scenes[0];

                // Centrar en su propio origen y normalizar: los modelos de
                // Sketchfab vienen en escalas y orígenes muy dispares.
                const caja = new THREE.Box3().setFromObject(raiz);
                const tam = caja.getSize(new THREE.Vector3());
                const centro = caja.getCenter(new THREE.Vector3());
                const mayor = Math.max(tam.x, tam.y, tam.z) || 1;
                raiz.position.sub(centro);
                raiz.scale.multiplyScalar(1 / mayor);
                pivote.add(raiz);

                // En VR el modelo mide lo que diga escalaReal (o 1 m de lado mayor).
                escalaVR = modelo.escalaReal > 0 ? modelo.escalaReal : 1;

                let triangulos = 0;
                raiz.traverse(o => {
                    if (!o.isMesh) return;
                    o.frustumCulled = false;
                    const g = o.geometry;
                    if (g?.index) triangulos += g.index.count / 3;
                    else if (g?.attributes?.position) triangulos += g.attributes.position.count / 3;
                    (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m && materiales.add(m));
                });

                clipsGltf = gltf.animations || [];
                if (clipsGltf.length) {
                    mezclador = new THREE.AnimationMixer(raiz);
                    setClips(clipsGltf.map((c, i) => c.name || `animación ${i + 1}`));
                }

                colocarEnEscritorio();
                camara.position.set(0, 0.25, 2.2);
                controles.target.set(0, 0, 0);
                controles.update();

                api.current = { camara, controles, materiales, mezclador, clipsGltf, colocarEnEscritorio };
                setStats({ triangulos: Math.round(triangulos), materiales: materiales.size });
                setListo(true);
            },
            (ev) => {
                if (!vivo || !ev.lengthComputable) return;
                setProgreso(Math.round((ev.loaded / ev.total) * 100));
            },
            (err) => {
                if (!vivo) return;
                console.error('[Visor3D]', err);
                setError(
                    esUrlCloudinary(modelo.url)
                        ? 'No se pudo cargar el modelo desde Cloudinary. Comprueba que se subió como tipo «raw» y que la URL es la secure_url que devolvió la subida.'
                        : 'No se pudo cargar el modelo. Causas típicas: el servidor no permite CORS, la URL no apunta a un .glb/.gltf directo, o el archivo está dañado.'
                );
            }
        );

        /* ---- bucle de render ---- */
        const reloj = new THREE.Clock();
        renderer.setAnimationLoop(() => {
            const dt = reloj.getDelta();
            if (mezclador) mezclador.update(dt);

            if (renderer.xr.isPresenting) {
                const agarrando = mandos.filter(m => m.agarrando);
                if (agarrando.length === 2) {
                    // Dos manos: la distancia entre mandos escala el modelo.
                    agarrando[0].ctrl.getWorldPosition(vA);
                    agarrando[1].ctrl.getWorldPosition(vB);
                    const dist = vA.distanceTo(vB);
                    if (!escalaBase) escalaBase = { dist, escala: pivote.scale.x };
                    else if (escalaBase.dist > 0.01) {
                        pivote.scale.setScalar(THREE.MathUtils.clamp((dist / escalaBase.dist) * escalaBase.escala, 0.05, 20));
                    }
                } else if (agarrando.length === 1) {
                    escalaBase = null;
                    mTmp.copy(agarrando[0].ctrl.matrixWorld).multiply(agarrando[0].offset);
                    mTmp.decompose(pivote.position, pivote.quaternion, pivote.scale);
                } else {
                    escalaBase = null;
                    // Joystick: acercar/alejar y girar sin moverse del sitio.
                    mandos.forEach(m => {
                        const ax = m.gamepad?.axes;
                        if (!ax) return;
                        const y = ax[3] ?? ax[1] ?? 0;
                        const x = ax[2] ?? ax[0] ?? 0;
                        if (Math.abs(y) > 0.15) pivote.position.z += y * dt * 0.9;
                        if (Math.abs(x) > 0.15) pivote.rotation.y += x * dt * 1.6;
                    });
                }
            } else {
                controles.update();
            }

            renderer.render(escena, camara);
        });

        /* ---- botón de VR (solo si el visor lo soporta) ---- */
        if (navigator.xr?.isSessionSupported) {
            navigator.xr.isSessionSupported('immersive-vr').then(ok => {
                if (!vivo || !ok || !vrBtnRef.current) return;
                const btn = VRButton.createButton(renderer);
                Object.assign(btn.style, {
                    position: 'static', transform: 'none', width: '100%', margin: '0',
                    borderRadius: '10px', fontSize: '0.8rem', padding: '8px 10px',
                });
                vrBtnRef.current.appendChild(btn);
                aLimpiar.push(() => btn.remove());
            }).catch(() => {});
        }
        const onXRStart = () => { setEnVR(true); rejilla.visible = true; colocarEnVR(); };
        const onXREnd   = () => { setEnVR(false); rejilla.visible = false; colocarEnEscritorio(); };
        renderer.xr.addEventListener('sessionstart', onXRStart);
        renderer.xr.addEventListener('sessionend', onXREnd);

        /* ---- resize ---- */
        const onResize = () => {
            if (renderer.xr.isPresenting || !contRef.current) return;
            const w = contRef.current.clientWidth, h = contRef.current.clientHeight;
            if (!w || !h) return;
            camara.aspect = w / h;
            camara.updateProjectionMatrix();
            renderer.setSize(w, h);
        };
        window.addEventListener('resize', onResize);
        const ro = new ResizeObserver(onResize);
        ro.observe(cont);

        /* ---- limpieza ---- */
        return () => {
            vivo = false;
            renderer.setAnimationLoop(null);
            renderer.xr.removeEventListener('sessionstart', onXRStart);
            renderer.xr.removeEventListener('sessionend', onXREnd);
            window.removeEventListener('resize', onResize);
            ro.disconnect();
            aLimpiar.forEach(f => { try { f(); } catch (_) {} });
            controles.dispose();
            escena.traverse(o => {
                if (!o.isMesh) return;
                o.geometry?.dispose?.();
                (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
                    if (!m) return;
                    Object.values(m).forEach(v => { if (v?.isTexture) v.dispose(); });
                    m.dispose?.();
                });
            });
            entorno.dispose();
            pmrem.dispose();
            draco.dispose();
            ktx2.dispose();
            renderer.dispose();
            if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
            api.current = {};
        };
    }, [modelo.url, modelo.escalaReal]);

    /* ---------- controles del panel ---------- */
    useEffect(() => {
        if (api.current.controles) api.current.controles.autoRotate = autoRotar;
    }, [autoRotar, listo]);

    useEffect(() => {
        const mats = api.current.materiales;
        if (!mats) return;
        mats.forEach(m => { if ('wireframe' in m) m.wireframe = wireframe; });
    }, [wireframe, listo]);

    useEffect(() => {
        const { mezclador, clipsGltf } = api.current;
        if (!mezclador || !clipsGltf?.length) return;
        mezclador.stopAllAction();
        if (clipActivo >= 0 && clipsGltf[clipActivo]) mezclador.clipAction(clipsGltf[clipActivo]).reset().play();
    }, [clipActivo, listo]);

    const resetCamara = () => {
        const { camara, controles, colocarEnEscritorio } = api.current;
        if (!camara || !controles) return;
        colocarEnEscritorio?.();
        camara.position.set(0, 0.25, 2.2);
        controles.target.set(0, 0, 0);
        controles.update();
    };

    const btn = (activo) => ({
        padding: '8px 10px', borderRadius: 10, border: 'none', cursor: 'pointer',
        background: activo ? '#2dd4bf' : 'rgba(255,255,255,0.12)',
        color: activo ? '#0f172a' : '#e2e8f0',
        fontWeight: 700, fontSize: '0.8rem', width: '100%', textAlign: 'left',
    });

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#101820' }}>
            <div ref={contRef} style={{ position: 'absolute', inset: 0 }} />

            <button onClick={onVolver}
                style={{ position: 'absolute', top: 12, left: 12, zIndex: 3, padding: '9px 14px', borderRadius: 10, border: 'none', background: 'rgba(15,23,42,0.85)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                ← Volver
            </button>

            {!listo && !error && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#e2e8f0', gap: 14, pointerEvents: 'none' }}>
                    <div style={{ fontSize: '2.4rem' }}>🧊</div>
                    <div style={{ fontWeight: 700 }}>Cargando {modelo.nombre}…</div>
                    <div style={{ width: 220, height: 7, background: 'rgba(255,255,255,0.15)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${progreso}%`, height: '100%', background: '#2dd4bf', transition: 'width 0.2s' }} />
                    </div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{progreso}%</div>
                </div>
            )}

            {error && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                    <div style={{ background: '#1e293b', color: '#e2e8f0', padding: 24, borderRadius: 16, maxWidth: 480, textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', marginBottom: 10 }}>⚠️</div>
                        <p style={{ margin: '0 0 14px', lineHeight: 1.5 }}>{error}</p>
                        <code style={{ display: 'block', fontSize: '0.72rem', opacity: 0.6, wordBreak: 'break-all', marginBottom: 14 }}>{modelo.url}</code>
                        <button onClick={onVolver} style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: '#2dd4bf', color: '#0f172a', fontWeight: 700, cursor: 'pointer' }}>Volver a la galería</button>
                    </div>
                </div>
            )}

            {listo && !enVR && (
                <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 3, width: 190, display: 'flex', flexDirection: 'column', gap: 7,
                    background: 'rgba(15,23,42,0.88)', padding: 10, borderRadius: 14, backdropFilter: 'blur(6px)' }}>
                    <div onClick={() => setPanel(p => !p)} style={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
                        <span>CONTROLES</span><span>{panel ? '▾' : '▸'}</span>
                    </div>
                    {panel && <>
                        <button style={btn(autoRotar)} onClick={() => setAutoRotar(v => !v)}>🔄 Girar solo</button>
                        <button style={btn(wireframe)} onClick={() => setWireframe(v => !v)}>🕸️ Malla</button>
                        <button style={btn(false)} onClick={resetCamara}>🎯 Centrar</button>
                        {clips.length > 0 && (
                            <select value={clipActivo} onChange={e => setClipActivo(Number(e.target.value))}
                                style={{ padding: '7px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.12)', color: '#e2e8f0', fontSize: '0.78rem', fontWeight: 700 }}>
                                <option value={-1} style={{ color: '#000' }}>⏸ Sin animación</option>
                                {clips.map((c, i) => <option key={i} value={i} style={{ color: '#000' }}>▶ {c}</option>)}
                            </select>
                        )}
                        <div ref={vrBtnRef} style={{ marginTop: 2 }} />
                        {stats && (
                            <div style={{ color: '#64748b', fontSize: '0.66rem', lineHeight: 1.5, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 6 }}>
                                {stats.triangulos.toLocaleString('es-ES')} triángulos<br />{stats.materiales} materiales
                            </div>
                        )}
                    </>}
                </div>
            )}

            {/* Ficha del modelo con la atribución (obligatoria en licencias CC BY) */}
            {listo && !enVR && (
                <div style={{ position: 'absolute', left: 12, bottom: 12, zIndex: 3, maxWidth: 'min(420px, calc(100% - 24px))',
                    background: 'rgba(15,23,42,0.88)', color: '#e2e8f0', padding: '10px 14px', borderRadius: 14, backdropFilter: 'blur(6px)' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{modelo.emoji || '🧊'} {modelo.nombre}</div>
                    {modelo.descripcion && <div style={{ fontSize: '0.78rem', opacity: 0.85, marginTop: 3 }}>{modelo.descripcion}</div>}
                    {(modelo.autor || modelo.licencia) && (
                        <div style={{ fontSize: '0.68rem', opacity: 0.6, marginTop: 6 }}>
                            {modelo.autor && <>por {modelo.autor} </>}
                            {modelo.licencia && <>· {modelo.licencia} </>}
                            {modelo.fuente && <a href={modelo.fuente} target="_blank" rel="noopener noreferrer" style={{ color: '#2dd4bf' }}>fuente</a>}
                        </div>
                    )}
                </div>
            )}

            {listo && !enVR && (
                <div style={{ position: 'absolute', bottom: 12, right: 12, zIndex: 3, color: '#64748b', fontSize: '0.68rem', textAlign: 'right', pointerEvents: 'none' }}>
                    Arrastra para girar · rueda para acercar<br />dos dedos para mover
                </div>
            )}
        </div>
    );
}

/* ===================================================================== */
/*  GALERÍA + ALTA DE MODELOS                                            */
/* ===================================================================== */

/** Construye el enlace público de un modelo: /visor3d?modelo=…&nombre=… */
function enlaceDe(m) {
    const p = new URLSearchParams();
    p.set('modelo', m.url);
    if (m.nombre) p.set('nombre', m.nombre);
    if (m.autor) p.set('autor', m.autor);
    if (m.licencia) p.set('licencia', m.licencia);
    if (m.fuente) p.set('fuente', m.fuente);
    if (m.escalaReal) p.set('escala', String(m.escalaReal));
    return p.toString();
}

export default function Visor3D({ onExit, modeloInicial = null, usuario = null }) {
    const [modelo, setModelo]       = useState(modeloInicial);
    const [locales, setLocales]     = useState(() => leerModelosLocales());
    const [publicados, setPublicados] = useState([]);
    const [form, setForm]           = useState(false);
    const [admin, setAdmin]         = useState(false);
    const [copiado, setCopiado]     = useState(false);

    const email = usuario?.email || auth.currentUser?.email || '';
    const esAdmin = email === ADMIN_EMAIL;

    const recargarPublicados = useCallback(() => {
        leerModelosPublicados({ soloVisibles: !esAdmin })
            .then(setPublicados)
            .catch(err => console.warn('[Visor3D] no se pudo leer el catálogo publicado:', err));
    }, [esAdmin]);

    useEffect(() => { recargarPublicados(); }, [recargarPublicados]);

    // Modelo compartido por URL: /visor3d?modelo=<url>&nombre=…
    useEffect(() => {
        if (modeloInicial) return;
        const p = new URLSearchParams(window.location.search);
        const url = p.get('modelo');
        if (!url || validarUrlModelo(url)) return;
        setModelo({
            url,
            nombre: p.get('nombre') || 'Modelo compartido',
            emoji: '🧊',
            autor: p.get('autor') || '',
            licencia: p.get('licencia') || '',
            fuente: p.get('fuente') || '',
            escalaReal: Number(p.get('escala')) || 0,
        });
    }, [modeloInicial]);

    const abrir = (m) => {
        setModelo(m);
        window.history.pushState({}, '', `/visor3d?${enlaceDe(m)}`);
    };

    const volverGaleria = () => {
        setModelo(null);
        window.history.pushState({}, '', '/visor3d');
    };

    const compartir = (m) => {
        const url = `${window.location.origin}/visor3d?${enlaceDe(m)}`;
        if (navigator.share) { navigator.share({ title: m.nombre, url }).catch(() => {}); return; }
        navigator.clipboard?.writeText(url).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000); });
    };

    if (modelo) return <EscenaModelo modelo={modelo} onVolver={volverGaleria} />;

    if (admin) return (
        <PanelAdminCloudinary
            publicados={publicados}
            onCerrar={() => { setAdmin(false); recargarPublicados(); }}
            onCambio={recargarPublicados}
            onVer={abrir}
        />
    );

    const todos = [...MODELOS_3D, ...publicados, ...locales];

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'linear-gradient(160deg,#0f172a,#134e4a)', overflowY: 'auto', padding: '56px 16px 40px' }}>
            <button onClick={onExit}
                style={{ position: 'fixed', top: 12, left: 12, zIndex: 3, padding: '9px 14px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.92)', color: '#0f172a', fontWeight: 700, cursor: 'pointer' }}>
                ← Volver
            </button>

            <div style={{ maxWidth: 1000, margin: '0 auto' }}>
                <h1 style={{ color: '#fff', textAlign: 'center', margin: '0 0 6px', fontSize: 'clamp(1.5rem,4vw,2.2rem)' }}>🧊 Visor 3D</h1>
                <p style={{ color: '#94a3b8', textAlign: 'center', margin: '0 0 26px', fontSize: '0.92rem' }}>
                    Modelos para explorar girándolos, acercándolos… y con gafas de realidad virtual.
                </p>

                {todos.length === 0 && !form && (
                    <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 16, padding: 24, color: '#cbd5e1', textAlign: 'center', marginBottom: 20 }}>
                        <div style={{ fontSize: '2rem', marginBottom: 8 }}>📦</div>
                        <p style={{ margin: '0 0 6px', fontWeight: 700 }}>Todavía no hay modelos</p>
                        <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.8 }}>Añade el primero con el botón de abajo.</p>
                    </div>
                )}

                {todos.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 26 }}>
                        {todos.map((m, i) => {
                            const cat = CATEGORIAS_3D.find(c => c.id === m.categoria) || CATEGORIAS_3D[CATEGORIAS_3D.length - 1];
                            return (
                                <div key={m.url + i} onClick={() => abrir(m)}
                                    style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 16, cursor: 'pointer', position: 'relative', border: `1px solid ${cat.color}44` }}>
                                    <button onClick={e => { e.stopPropagation(); compartir(m); }} title="Compartir modelo"
                                        style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, padding: '3px 7px', cursor: 'pointer', color: '#cbd5e1', fontSize: '0.72rem' }}>🔗</button>
                                    {m.local && (
                                        <button onClick={e => { e.stopPropagation(); if (window.confirm(`¿Quitar "${m.nombre}" de la galería?`)) setLocales(borrarModeloLocal(m.url)); }} title="Quitar"
                                            style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, padding: '3px 7px', cursor: 'pointer', color: '#cbd5e1', fontSize: '0.72rem' }}>🗑</button>
                                    )}
                                    {m.publicado && m.visible === false && (
                                        <div style={{ position: 'absolute', bottom: 6, right: 8, color: '#fbbf24', fontSize: '0.62rem', fontWeight: 700 }} title="Publicado pero oculto: los demás usuarios no lo ven">🙈 oculto</div>
                                    )}
                                    <div style={{ fontSize: '2.2rem', textAlign: 'center', marginBottom: 8 }}>{m.emoji || cat.emoji}</div>
                                    <h3 style={{ margin: 0, color: '#fff', fontSize: '0.92rem', textAlign: 'center' }}>{m.nombre}</h3>
                                    <div style={{ color: cat.color, fontSize: '0.68rem', textAlign: 'center', marginTop: 4, fontWeight: 700 }}>{cat.nombre}</div>
                                    {m.autor && <div style={{ color: '#64748b', fontSize: '0.64rem', textAlign: 'center', marginTop: 4 }}>{m.autor}</div>}
                                </div>
                            );
                        })}
                    </div>
                )}

                {copiado && <p style={{ color: '#2dd4bf', textAlign: 'center', fontSize: '0.85rem' }}>✅ Enlace copiado</p>}

                {form
                    ? <FormularioModelo
                        esAdmin={esAdmin}
                        onCancelar={() => setForm(false)}
                        onGuardar={(m) => { setLocales(guardarModeloLocal(m)); setForm(false); }} />
                    : <div style={{ textAlign: 'center', display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button onClick={() => setForm(true)}
                            style={{ padding: '12px 22px', borderRadius: 12, border: 'none', background: '#2dd4bf', color: '#0f172a', fontWeight: 800, cursor: 'pointer', fontSize: '0.95rem' }}>
                            ➕ Añadir modelo
                        </button>
                        {esAdmin && (
                            <button onClick={() => setAdmin(true)}
                                style={{ padding: '12px 22px', borderRadius: 12, border: '1px solid #2dd4bf', background: 'transparent', color: '#2dd4bf', fontWeight: 800, cursor: 'pointer', fontSize: '0.95rem' }}>
                                ☁️ Mis assets de Cloudinary
                            </button>
                        )}
                    </div>}

                <AyudaSketchfab />
            </div>
        </div>
    );
}

/* ---------- formulario de alta ---------- */

function FormularioModelo({ onGuardar, onCancelar, esAdmin = false }) {
    const [nombre, setNombre]     = useState('');
    const [url, setUrl]           = useState('');
    const [emoji, setEmoji]       = useState('🧊');
    const [categoria, setCat]     = useState('OTROS');
    const [autor, setAutor]       = useState('');
    const [licencia, setLic]      = useState('CC BY 4.0');
    const [fuente, setFuente]     = useState('');
    const [descripcion, setDesc]  = useState('');
    const [escalaReal, setEscala] = useState('');
    const [subiendo, setSubiendo] = useState(false);
    const [progreso, setProg]     = useState(0);
    const [error, setError]       = useState(null);

    const onArchivo = useCallback(async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setError(null); setSubiendo(true); setProg(0);
        try {
            // El admin sube firmado (el servidor firma con el api_secret);
            // los demás, con el preset unsigned si está configurado.
            const subida = esAdmin
                ? subirModeloFirmado(file, { idToken: await auth.currentUser.getIdToken(), onProgress: setProg })
                : subirModelo(file, { onProgress: setProg });
            const { url: secure } = await subida;
            setUrl(secure);
            setNombre(prev => prev || file.name.replace(/\.(glb|gltf)$/i, ''));
        } catch (err) {
            setError(err.message);
        } finally {
            setSubiendo(false);
            e.target.value = '';
        }
    }, [esAdmin]);

    const guardar = () => {
        const fallo = validarUrlModelo(url);
        if (fallo) { setError(fallo); return; }
        if (!nombre.trim()) { setError('Ponle un nombre al modelo.'); return; }
        onGuardar({
            id: `local_${Date.now()}`, nombre: nombre.trim(), url: url.trim(), emoji: emoji || '🧊',
            categoria, autor: autor.trim(), licencia: licencia.trim(), fuente: fuente.trim(),
            descripcion: descripcion.trim(), escalaReal: Number(escalaReal) || 0,
        });
    };

    const campo = { width: '100%', padding: '9px 11px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', color: '#fff', fontSize: '0.86rem', boxSizing: 'border-box' };
    const etiqueta = { color: '#94a3b8', fontSize: '0.73rem', fontWeight: 700, display: 'block', marginBottom: 4 };

    return (
        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 20, marginBottom: 20 }}>
            <h3 style={{ color: '#fff', margin: '0 0 14px', fontSize: '1rem' }}>➕ Añadir modelo</h3>

            {(esAdmin || cloudinaryListo()) ? (
                <div style={{ marginBottom: 14 }}>
                    <label style={etiqueta}>
                        Subir archivo a Cloudinary (.glb, máx. {MAX_MB} MB){esAdmin && ' · subida firmada'}
                    </label>
                    <input type="file" accept=".glb,.gltf" onChange={onArchivo} disabled={subiendo} style={{ ...campo, padding: 8 }} />
                    {subiendo && (
                        <div style={{ marginTop: 8 }}>
                            <div style={{ height: 6, background: 'rgba(255,255,255,0.12)', borderRadius: 4, overflow: 'hidden' }}>
                                <div style={{ width: `${progreso}%`, height: '100%', background: '#2dd4bf', transition: 'width 0.2s' }} />
                            </div>
                            <div style={{ color: '#94a3b8', fontSize: '0.72rem', marginTop: 4 }}>Subiendo… {progreso}%</div>
                        </div>
                    )}
                </div>
            ) : (
                <p style={{ color: '#fbbf24', fontSize: '0.75rem', margin: '0 0 14px', lineHeight: 1.5 }}>
                    ℹ️ La subida directa solo está disponible para el administrador. Puedes pegar la URL de un modelo ya subido (.glb o .gltf).
                </p>
            )}

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                    <label style={etiqueta}>URL del modelo (.glb / .gltf)</label>
                    <input style={campo} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://res.cloudinary.com/…/raw/upload/…/modelo.glb" />
                </div>
                <div><label style={etiqueta}>Nombre</label><input style={campo} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Cráneo humano" /></div>
                <div><label style={etiqueta}>Emoji</label><input style={campo} value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={4} /></div>
                <div>
                    <label style={etiqueta}>Categoría</label>
                    <select style={campo} value={categoria} onChange={e => setCat(e.target.value)}>
                        {CATEGORIAS_3D.map(c => <option key={c.id} value={c.id} style={{ color: '#000' }}>{c.emoji} {c.nombre}</option>)}
                    </select>
                </div>
                <div><label style={etiqueta}>Tamaño real en VR (m, opcional)</label><input style={campo} value={escalaReal} onChange={e => setEscala(e.target.value)} placeholder="0.2" /></div>
                <div><label style={etiqueta}>Autor (atribución)</label><input style={campo} value={autor} onChange={e => setAutor(e.target.value)} placeholder="Autor del modelo" /></div>
                <div><label style={etiqueta}>Licencia</label><input style={campo} value={licencia} onChange={e => setLic(e.target.value)} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={etiqueta}>Enlace de origen (Sketchfab)</label><input style={campo} value={fuente} onChange={e => setFuente(e.target.value)} placeholder="https://sketchfab.com/3d-models/…" /></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={etiqueta}>Descripción para el alumno</label><input style={campo} value={descripcion} onChange={e => setDesc(e.target.value)} /></div>
            </div>

            {error && <p style={{ color: '#f87171', fontSize: '0.8rem', marginTop: 12 }}>⚠️ {error}</p>}

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button onClick={guardar} disabled={subiendo}
                    style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: '#2dd4bf', color: '#0f172a', fontWeight: 800, cursor: 'pointer' }}>Guardar</button>
                <button onClick={onCancelar}
                    style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#cbd5e1', fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
            </div>
        </div>
    );
}

/* ---------- panel de administración: assets de Cloudinary ---------- */

/** Llama a /api/cloudinary firmando con el idToken de Firebase del admin. */
async function apiCloudinary(accion, extra = {}) {
    const user = auth.currentUser;
    if (!user) throw new Error('Necesitas iniciar sesión.');
    const idToken = await user.getIdToken();
    const r = await fetch('/api/cloudinary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ accion, ...extra }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error || `Error ${r.status}`);
    return data;
}

/** Trae un modelo de Sketchfab a Cloudinary en un solo paso. */
function ImportadorSketchfab({ onImportado }) {
    const [enlace, setEnlace] = useState('');
    const [fase, setFase]     = useState(null);   // texto del paso en curso
    const [error, setError]   = useState(null);
    const [aviso, setAviso]   = useState(null);

    const importar = async () => {
        if (!enlace.trim()) return;
        setError(null); setAviso(null);
        setFase('Buscando el modelo en Sketchfab…');
        try {
            const user = auth.currentUser;
            if (!user) throw new Error('Necesitas iniciar sesión.');
            const idToken = await user.getIdToken();

            setFase('Descargando, empaquetando en .glb y subiendo a Cloudinary… (puede tardar un minuto)');
            const r = await fetch('/api/sketchfab', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
                body: JSON.stringify({ enlace: enlace.trim() }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data?.error || `Error ${r.status}`);

            setEnlace('');
            setAviso(`✅ «${data.ficha.nombre}» importado (${data.origen?.glbMB} MB). Revisa su ficha y publícalo.`);
            onImportado(data.ficha);
        } catch (e) {
            setError(e.message);
        } finally {
            setFase(null);
        }
    };

    return (
        <div style={{ background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.3)', borderRadius: 14, padding: 16, marginBottom: 18 }}>
            <div style={{ color: '#2dd4bf', fontWeight: 800, fontSize: '0.92rem', marginBottom: 4 }}>⬇️ Importar desde Sketchfab</div>
            <p style={{ color: '#94a3b8', fontSize: '0.76rem', margin: '0 0 10px', lineHeight: 1.5 }}>
                Pega el enlace del modelo (vale el corto, <code>skfb.ly/…</code>). Se descarga, se convierte a .glb,
                se sube a tu Cloudinary y se rellena la atribución sola.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input value={enlace} onChange={e => setEnlace(e.target.value)} disabled={!!fase}
                    onKeyDown={e => { if (e.key === 'Enter') importar(); }}
                    placeholder="https://skfb.ly/66Wsn"
                    style={{ flex: 1, minWidth: 220, padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', color: '#fff', fontSize: '0.86rem' }} />
                <button onClick={importar} disabled={!!fase || !enlace.trim()}
                    style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: fase ? 'rgba(255,255,255,0.12)' : '#2dd4bf', color: fase ? '#94a3b8' : '#0f172a', fontWeight: 800, cursor: fase ? 'default' : 'pointer', fontSize: '0.86rem' }}>
                    {fase ? '⏳' : 'Importar'}
                </button>
            </div>
            {fase  && <p style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: 8 }}>{fase}</p>}
            {aviso && <p style={{ color: '#2dd4bf', fontSize: '0.8rem', marginTop: 8 }}>{aviso}</p>}
            {error && <p style={{ color: '#f87171', fontSize: '0.8rem', marginTop: 8, lineHeight: 1.5 }}>⚠️ {error}</p>}
        </div>
    );
}

function PanelAdminCloudinary({ publicados, onCerrar, onCambio, onVer }) {
    const [assets, setAssets]   = useState([]);
    const [cargando, setCarga]  = useState(true);
    const [error, setError]     = useState(null);
    const [uso, setUso]         = useState(null);
    const [editando, setEdit]   = useState(null);   // asset en edición
    const [carpeta, setCarpeta] = useState('modelos3d');

    const cargar = useCallback(async (prefijo = carpeta) => {
        setCarga(true); setError(null);
        try {
            const { assets } = await apiCloudinary('listar', { carpeta: prefijo });
            setAssets(assets);
            apiCloudinary('uso').then(setUso).catch(() => {});
        } catch (e) {
            setError(e.message);
        } finally {
            setCarga(false);
        }
    }, [carpeta]);

    useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Cruce entre lo que hay en Cloudinary y lo que está publicado en Firestore.
    const fichaDe = (asset) => publicados.find(p => p.publicId === asset.publicId || p.url === asset.url) || null;

    const alternarVisible = async (asset, ficha) => {
        try {
            await publicarModelo({ ...ficha, visible: ficha.visible === false });
            onCambio();
        } catch (e) { setError(e.message); }
    };

    const quitar = async (ficha) => {
        if (!window.confirm(`¿Quitar "${ficha.nombre}" del catálogo? El archivo seguirá en Cloudinary.`)) return;
        try { await despublicarModelo(ficha.id); onCambio(); } catch (e) { setError(e.message); }
    };

    const st = {
        fila: { display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', background: 'rgba(255,255,255,0.06)', borderRadius: 12, marginBottom: 8, flexWrap: 'wrap' },
        btn:  { padding: '6px 11px', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.76rem' },
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'linear-gradient(160deg,#0f172a,#134e4a)', overflowY: 'auto', padding: '56px 16px 40px' }}>
            <button onClick={onCerrar}
                style={{ position: 'fixed', top: 12, left: 12, zIndex: 3, padding: '9px 14px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.92)', color: '#0f172a', fontWeight: 700, cursor: 'pointer' }}>
                ← Galería
            </button>

            <div style={{ maxWidth: 900, margin: '0 auto' }}>
                <h2 style={{ color: '#fff', textAlign: 'center', margin: '0 0 4px' }}>☁️ Assets de Cloudinary</h2>
                <p style={{ color: '#94a3b8', textAlign: 'center', fontSize: '0.86rem', margin: '0 0 8px' }}>
                    Todo lo que tienes subido. Publica los que quieras que vean los demás usuarios de pikt.es.
                </p>
                {uso?.creditos && (
                    <p style={{ color: '#64748b', textAlign: 'center', fontSize: '0.74rem', margin: '0 0 18px' }}>
                        Plan: {Number(uso.creditos.usage || 0).toFixed(2)} de {uso.creditos.limit} créditos usados
                        {uso.almacenamiento?.usage != null && <> · {(uso.almacenamiento.usage / 1073741824).toFixed(2)} GB almacenados</>}
                    </p>
                )}

                <ImportadorSketchfab onImportado={(ficha) => { cargar(carpeta); setEdit(ficha); }} />

                <div style={{ display: 'flex', gap: 8, marginBottom: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <input value={carpeta} onChange={e => setCarpeta(e.target.value)} placeholder="carpeta (prefijo)"
                        style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', color: '#fff', fontSize: '0.84rem' }} />
                    <button onClick={() => cargar(carpeta)} style={{ ...st.btn, background: '#2dd4bf', color: '#0f172a', padding: '8px 16px' }}>🔄 Recargar</button>
                </div>

                {error && (
                    <div style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid #f87171', color: '#fecaca', padding: 14, borderRadius: 12, marginBottom: 16, fontSize: '0.84rem', lineHeight: 1.5 }}>
                        ⚠️ {error}
                        <div style={{ opacity: 0.75, marginTop: 6, fontSize: '0.78rem' }}>
                            Comprueba que en Vercel están <code>VITE_CLOUDINARY_CLOUD</code>, <code>CLOUDINARY_API_KEY</code> y <code>CLOUDINARY_API_SECRET</code>.
                        </div>
                    </div>
                )}

                {cargando && <p style={{ color: '#94a3b8', textAlign: 'center' }}>Cargando assets…</p>}

                {!cargando && !error && assets.length === 0 && (
                    <p style={{ color: '#94a3b8', textAlign: 'center', fontSize: '0.88rem', lineHeight: 1.6 }}>
                        No hay archivos .glb/.gltf en la carpeta «{carpeta}».<br />
                        Recuerda que deben estar subidos como tipo <b>raw</b>. Prueba a dejar la carpeta vacía para listar todo.
                    </p>
                )}

                {assets.map(a => {
                    const ficha = fichaDe(a);
                    return (
                        <div key={a.publicId} style={st.fila}>
                            <div style={{ fontSize: '1.5rem' }}>{ficha?.emoji || '🧊'}</div>
                            <div style={{ flex: 1, minWidth: 180 }}>
                                <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.88rem' }}>
                                    {ficha?.nombre || a.publicId.split('/').pop()}
                                </div>
                                <div style={{ color: '#64748b', fontSize: '0.68rem', wordBreak: 'break-all' }}>
                                    {a.publicId} · {(a.bytes / 1048576).toFixed(1)} MB
                                    {a.bytes > 8 * 1048576 && <span style={{ color: '#fbbf24' }}> · pesado, conviene optimizarlo</span>}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                <button onClick={() => onVer({ ...(ficha || {}), url: a.url, nombre: ficha?.nombre || a.publicId.split('/').pop() })}
                                    style={{ ...st.btn, background: 'rgba(255,255,255,0.12)', color: '#e2e8f0' }}>👁 Ver</button>

                                {ficha ? (<>
                                    <button onClick={() => alternarVisible(a, ficha)}
                                        style={{ ...st.btn, background: ficha.visible === false ? 'rgba(251,191,36,0.2)' : '#2dd4bf', color: ficha.visible === false ? '#fbbf24' : '#0f172a' }}>
                                        {ficha.visible === false ? '🙈 Oculto' : '👀 Visible'}
                                    </button>
                                    <button onClick={() => setEdit({ ...ficha, url: a.url, publicId: a.publicId })}
                                        style={{ ...st.btn, background: 'rgba(255,255,255,0.12)', color: '#e2e8f0' }}>✏️</button>
                                    <button onClick={() => quitar(ficha)}
                                        style={{ ...st.btn, background: 'rgba(248,113,113,0.18)', color: '#fca5a5' }}>🗑</button>
                                </>) : (
                                    <button onClick={() => setEdit({ url: a.url, publicId: a.publicId, nombre: a.publicId.split('/').pop().replace(/\.(glb|gltf)$/i, ''), emoji: '🧊', categoria: 'OTROS', licencia: 'CC BY 4.0', visible: true })}
                                        style={{ ...st.btn, background: '#2dd4bf', color: '#0f172a' }}>➕ Publicar</button>
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* Fichas publicadas cuyo archivo ya no aparece en esta carpeta */}
                {publicados.filter(p => !assets.some(a => a.publicId === p.publicId || a.url === p.url)).map(p => (
                    <div key={p.id} style={{ ...st.fila, opacity: 0.7 }}>
                        <div style={{ fontSize: '1.5rem' }}>{p.emoji}</div>
                        <div style={{ flex: 1, minWidth: 180 }}>
                            <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.88rem' }}>{p.nombre}</div>
                            <div style={{ color: '#fbbf24', fontSize: '0.68rem' }}>publicado, pero su archivo no está en esta carpeta</div>
                        </div>
                        <button onClick={() => quitar(p)} style={{ ...st.btn, background: 'rgba(248,113,113,0.18)', color: '#fca5a5' }}>🗑</button>
                    </div>
                ))}
            </div>

            {editando && (
                <FichaPublicacion
                    modelo={editando}
                    onCancelar={() => setEdit(null)}
                    onGuardar={async (m) => {
                        try { await publicarModelo(m); setEdit(null); onCambio(); }
                        catch (e) { setError(e.message); setEdit(null); }
                    }}
                />
            )}
        </div>
    );
}

/** Modal con la ficha que verán los alumnos (nombre, categoría, atribución…). */
function FichaPublicacion({ modelo, onGuardar, onCancelar }) {
    const [m, setM] = useState(modelo);
    const set = (k) => (e) => setM(prev => ({ ...prev, [k]: e.target.value }));

    const campo = { width: '100%', padding: '9px 11px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', color: '#fff', fontSize: '0.86rem', boxSizing: 'border-box' };
    const etiqueta = { color: '#94a3b8', fontSize: '0.73rem', fontWeight: 700, display: 'block', marginBottom: 4 };

    return (
        <div onClick={onCancelar} style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#1e293b', borderRadius: 16, padding: 22, maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
                <h3 style={{ color: '#fff', margin: '0 0 4px', fontSize: '1rem' }}>Ficha del modelo</h3>
                <p style={{ color: '#64748b', fontSize: '0.74rem', margin: '0 0 16px', wordBreak: 'break-all' }}>{m.publicId}</p>

                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                    <div><label style={etiqueta}>Nombre</label><input style={campo} value={m.nombre || ''} onChange={set('nombre')} /></div>
                    <div><label style={etiqueta}>Emoji</label><input style={campo} value={m.emoji || ''} onChange={set('emoji')} maxLength={4} /></div>
                    <div>
                        <label style={etiqueta}>Categoría</label>
                        <select style={campo} value={m.categoria || 'OTROS'} onChange={set('categoria')}>
                            {CATEGORIAS_3D.map(c => <option key={c.id} value={c.id} style={{ color: '#000' }}>{c.emoji} {c.nombre}</option>)}
                        </select>
                    </div>
                    <div><label style={etiqueta}>Tamaño real en VR (m)</label><input style={campo} value={m.escalaReal || ''} onChange={set('escalaReal')} placeholder="0.2" /></div>
                    <div><label style={etiqueta}>Autor (atribución)</label><input style={campo} value={m.autor || ''} onChange={set('autor')} /></div>
                    <div><label style={etiqueta}>Licencia</label><input style={campo} value={m.licencia || ''} onChange={set('licencia')} /></div>
                    <div style={{ gridColumn: '1 / -1' }}><label style={etiqueta}>Enlace de origen</label><input style={campo} value={m.fuente || ''} onChange={set('fuente')} /></div>
                    <div style={{ gridColumn: '1 / -1' }}><label style={etiqueta}>Descripción</label><input style={campo} value={m.descripcion || ''} onChange={set('descripcion')} /></div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#e2e8f0', fontSize: '0.84rem', marginTop: 14, cursor: 'pointer' }}>
                    <input type="checkbox" checked={m.visible !== false} onChange={e => setM(prev => ({ ...prev, visible: e.target.checked }))} />
                    Visible para los demás usuarios de pikt.es
                </label>

                <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                    <button onClick={() => onGuardar(m)} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: '#2dd4bf', color: '#0f172a', fontWeight: 800, cursor: 'pointer' }}>Publicar</button>
                    <button onClick={onCancelar} style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#cbd5e1', fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
                </div>
            </div>
        </div>
    );
}

/* ---------- guía rápida ---------- */

function AyudaSketchfab() {
    const [abierto, setAbierto] = useState(false);
    return (
        <div style={{ marginTop: 26, background: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 16 }}>
            <div onClick={() => setAbierto(a => !a)} style={{ color: '#2dd4bf', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
                {abierto ? '▾' : '▸'} ¿Cómo traigo un modelo de Sketchfab?
            </div>
            {abierto && (
                <ol style={{ color: '#cbd5e1', fontSize: '0.84rem', lineHeight: 1.8, marginTop: 10, paddingLeft: 20 }}>
                    <li>En Sketchfab filtra por <b>Downloadable</b> y licencia <b>CC</b>.</li>
                    <li>Pulsa <b>Download 3D model</b> y elige <b>Autoconverted format → glTF</b> (o <b>.glb</b> si aparece). No sirven ni el <i>Original format</i> ni el <i>USDZ</i>.</li>
                    <li>Si bajaste un .zip con <code>scene.gltf</code>, conviértelo a un único archivo:<br />
                        <code style={{ fontSize: '0.78rem', color: '#2dd4bf' }}>npx @gltf-transform/cli copy scene.gltf modelo.glb</code></li>
                    <li>Optimízalo antes de subirlo (los de Sketchfab suelen pesar 20–80&nbsp;MB):<br />
                        <code style={{ fontSize: '0.78rem', color: '#2dd4bf' }}>npx @gltf-transform/cli optimize modelo.glb final.glb --texture-size 1024 --compress draco</code></li>
                    <li>Súbelo con «Añadir modelo» y <b>copia el autor y la licencia</b>: casi todos son CC BY y exigen citar al autor.</li>
                </ol>
            )}
        </div>
    );
}
