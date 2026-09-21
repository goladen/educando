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
    despublicarModelo, guardarPuntosModelo, leerConjuntosEtiquetas,
    guardarConjuntoEtiquetas, borrarConjuntoEtiquetas,
    leerSalas, guardarSala, borrarSala, repartirEnSala,
} from './modelos3d';
import Sala3D from './Sala3D';
import SelectorEmoji from './SelectorEmoji';
import { guardarRegistroLocal } from './utils/registrosLocales';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';
import { db } from './firebase';
import { cloudinaryListo, subirModelo, subirModeloFirmado, esUrlCloudinary, MAX_MB } from './config/cloudinary';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

const ADMIN_EMAIL = 'goladen@gmail.com';

/* ===================================================================== */
/*  ESCENA 3D                                                            */
/* ===================================================================== */

/** Dibuja el marcador de un punto: un círculo con su número. */
function texturaMarcador(numero, color) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.beginPath(); g.arc(64, 64, 52, 0, Math.PI * 2);
    g.fillStyle = color; g.fill();
    g.lineWidth = 8; g.strokeStyle = '#ffffff'; g.stroke();
    if (numero != null) {
        g.fillStyle = '#0f172a';
        g.font = 'bold 62px system-ui, sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(String(numero), 64, 70);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

function EscenaModelo({ modelo, onVolver, esAdmin = false, onPuntosGuardados, etiquetasIniciales = null, usuarioActual = null }) {
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

    // Conjuntos de etiquetas: el del catálogo (admin) y los de cada profesor.
    const [conjuntos, setConjuntos]   = useState([]);
    const [activoId, setActivoId]     = useState(etiquetasIniciales || null);
    const [selector, setSelector]     = useState(false);

    // Puntos de interés y sus tres modos: ver, editar y reto.
    const [puntos, setPuntos]         = useState(() => modelo.puntos || []);
    const [modo, setModo]             = useState('VER');       // VER | EDITAR | RETO
    const [seleccionado, setSelec]    = useState(null);        // punto abierto en la ficha
    const [editando, setEditando]     = useState(null);        // punto en el formulario
    const [guardando, setGuardando]   = useState(false);
    const [mallas, setMallas]         = useState([]);          // nombres de malla del modelo
    const [reto, setReto]             = useState(null);        // { orden, i, aciertos, intentos, fallos, ultimo }
    const [mostrarEnvio, setEnvio]    = useState(false);

    // La escena se monta una sola vez; para que sus listeners usen siempre la
    // lógica actual (modo, reto…) se la pasamos por esta referencia.
    const alClicarRef = useRef(() => {});

    const uid = usuarioActual?.uid || null;
    const nombreUsuario = usuarioActual?.displayName || usuarioActual?.email || 'Profesor';

    /* ---------- carga de los conjuntos de etiquetas ---------- */
    const recargarConjuntos = useCallback(async () => {
        // El conjunto "base" son las etiquetas que el admin guarda en el propio
        // modelo; los demás vienen de la colección, uno por profesor.
        const base = (modelo.puntos?.length || esAdmin)
            ? [{ id: '__base__', base: true, titulo: 'Etiquetas del catálogo', autorNombre: 'pikt.es',
                 puntos: modelo.puntos || [], publico: true }]
            : [];
        let remotos = [];
        try {
            remotos = await leerConjuntosEtiquetas(modelo.url);
        } catch (e) {
            console.warn('[Visor3D] no se pudieron leer los conjuntos de etiquetas:', e);
        }
        // Cada profesor ve los públicos y siempre los suyos.
        const visibles = remotos.filter(c => c.publico !== false || c.autorUid === uid);
        const todos = [...base, ...visibles];
        setConjuntos(todos);
        return todos;
    }, [modelo.url, modelo.puntos, esAdmin, uid]);

    useEffect(() => {
        let vivo = true;
        recargarConjuntos().then(todos => {
            if (!vivo) return;
            // Elegido: el de la URL, si no el que tenga etiquetas, si no el primero.
            const preferido = todos.find(c => c.id === activoId)
                || todos.find(c => c.puntos?.length)
                || todos[0] || null;
            setActivoId(preferido?.id || null);
            setPuntos(preferido?.puntos || []);
        });
        return () => { vivo = false; };
    }, [recargarConjuntos]);   // eslint-disable-line react-hooks/exhaustive-deps

    const conjuntoActivo = conjuntos.find(c => c.id === activoId) || null;
    // Editar: el admin manda en el conjunto del catálogo; cada profesor, en el suyo.
    const puedeEditar = conjuntoActivo
        ? (conjuntoActivo.base ? esAdmin : (!!uid && (conjuntoActivo.autorUid === uid || esAdmin)))
        : false;

    const cambiarConjunto = (id) => {
        const c = conjuntos.find(x => x.id === id);
        setActivoId(id);
        setPuntos(c?.puntos || []);
        setSelec(null); setModo('VER'); setReto(null); setSelector(false);
    };

    /** Crea un conjunto nuevo para este profesor, vacío o copiando el actual. */
    const crearConjunto = async (copiar) => {
        if (!uid) { alert('Inicia sesión para crear tus propias etiquetas.'); return; }
        setSelector(false);
        setGuardando(true);
        try {
            const nuevo = await guardarConjuntoEtiquetas({
                modeloUrl: modelo.url,
                modeloNombre: modelo.nombre,
                titulo: `Etiquetas de ${nombreUsuario.split(' ')[0]}`,
                autorUid: uid,
                autorNombre: nombreUsuario,
                publico: true,
                puntos: copiar ? puntos : [],
            });
            setConjuntos(prev => [...prev, nuevo]);
            setActivoId(nuevo.id);
            setPuntos(nuevo.puntos);
            setModo('EDITAR');
        } catch (e) {
            alert('No se ha podido crear el conjunto: ' + e.message);
        } finally {
            setGuardando(false);
        }
    };

    const renombrarConjunto = async (titulo) => {
        if (!conjuntoActivo || conjuntoActivo.base) return;
        const actualizado = { ...conjuntoActivo, titulo, puntos };
        await guardarConjuntoEtiquetas(actualizado);
        setConjuntos(prev => prev.map(c => (c.id === actualizado.id ? actualizado : c)));
    };

    const eliminarConjunto = async () => {
        if (!conjuntoActivo || conjuntoActivo.base) return;
        if (!window.confirm(`¿Borrar el conjunto "${conjuntoActivo.titulo}" y todas sus etiquetas?`)) return;
        await borrarConjuntoEtiquetas(conjuntoActivo.id);
        const resto = conjuntos.filter(c => c.id !== conjuntoActivo.id);
        setConjuntos(resto);
        setActivoId(resto[0]?.id || null);
        setPuntos(resto[0]?.puntos || []);
        setModo('VER');
    };

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

        // Marcadores de los puntos de interés: cuelgan del pivote, así que
        // siguen al modelo cuando se gira, se escala o se agarra en VR.
        const marcadores = new THREE.Group();
        pivote.add(marcadores);

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
                //
                // El centrado va en la raíz y la escala en un grupo PADRE. Si se
                // hicieran las dos cosas sobre el mismo objeto, el modelo
                // quedaría desplazado centro*(k-1): no se nota cuando el origen
                // ya está en el centro, pero descoloca los que no lo están.
                const caja = new THREE.Box3().setFromObject(raiz);
                const tam = caja.getSize(new THREE.Vector3());
                const centro = caja.getCenter(new THREE.Vector3());
                const mayor = Math.max(tam.x, tam.y, tam.z) || 1;
                raiz.position.sub(centro);

                const escalador = new THREE.Group();
                escalador.scale.setScalar(1 / mayor);
                escalador.add(raiz);
                pivote.add(escalador);

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

                api.current = { camara, controles, materiales, mezclador, clipsGltf, colocarEnEscritorio, marcadores, pivote };
                setStats({ triangulos: Math.round(triangulos), materiales: materiales.size });

                // Mallas con nombre: en los modelos de anatomía cada músculo
                // suele ser una, y sirven para crear los puntos de golpe.
                // Hay que refrescar las matrices antes de medir: el grupo se
                // acaba de añadir y todavía no ha pasado por ningún render.
                pivote.updateMatrixWorld(true);
                const conNombre = [];
                raiz.traverse(o => {
                    if (!o.isMesh || !o.name || o.name.startsWith('Object_')) return;
                    const caja = new THREE.Box3().setFromObject(o);
                    if (caja.isEmpty()) return;
                    const c = caja.getCenter(new THREE.Vector3());
                    pivote.worldToLocal(c);
                    conNombre.push({ nombre: o.name.replace(/[_.]/g, ' ').trim(), pos: [c.x, c.y, c.z] });
                });
                setMallas(conNombre);
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
        // THREE.Timer sustituye a Clock, que quedó obsoleto en three 0.18x.
        const reloj = new THREE.Timer();
        renderer.setAnimationLoop(() => {
            reloj.update();
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

        /* ---- clic sobre el modelo o sobre un marcador ---- */
        // Se distingue clic de arrastre: al orbitar no debe dispararse nada.
        const rayo = new THREE.Raycaster();
        const puntero = new THREE.Vector2();
        let bajada = null;

        const alPulsar = (ev) => { bajada = { x: ev.clientX, y: ev.clientY, t: Date.now() }; };
        const alSoltar = (ev) => {
            if (!bajada) return;
            const movido = Math.hypot(ev.clientX - bajada.x, ev.clientY - bajada.y);
            const tardanza = Date.now() - bajada.t;
            bajada = null;
            if (movido > 6 || tardanza > 600) return;   // ha sido un arrastre

            const r = renderer.domElement.getBoundingClientRect();
            puntero.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
            puntero.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
            rayo.setFromCamera(puntero, camara);

            // Primero los marcadores: son pequeños y deben tener prioridad.
            const enMarcador = rayo.intersectObjects(marcadores.children, false)[0];
            if (enMarcador) {
                alClicarRef.current({ idPunto: enMarcador.object.userData.idPunto });
                return;
            }
            const enModelo = rayo.intersectObject(pivote, true)
                .find(i => i.object.isMesh);
            if (enModelo) {
                const local = pivote.worldToLocal(enModelo.point.clone());
                alClicarRef.current({ pos: [local.x, local.y, local.z] });
            } else {
                alClicarRef.current({ vacio: true });
            }
        };
        renderer.domElement.addEventListener('pointerdown', alPulsar);
        renderer.domElement.addEventListener('pointerup', alSoltar);

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
            renderer.domElement.removeEventListener('pointerdown', alPulsar);
            renderer.domElement.removeEventListener('pointerup', alSoltar);
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

    /* ---------- marcadores: se redibujan cuando cambian puntos o modo ---------- */
    useEffect(() => {
        const { marcadores } = api.current;
        if (!marcadores) return;

        // En el reto los marcadores van sin número, para que haya que saberlo.
        const enReto = modo === 'RETO';
        marcadores.clear();

        puntos.forEach((p, i) => {
            const acertado = enReto && reto?.resueltos?.includes(p.id);
            const color = acertado ? '#22c55e' : enReto ? '#facc15' : '#2dd4bf';
            const mat = new THREE.SpriteMaterial({
                map: texturaMarcador(enReto ? null : i + 1, color),
                depthTest: false, transparent: true,
            });
            const sp = new THREE.Sprite(mat);
            sp.position.set(p.pos[0], p.pos[1], p.pos[2]);
            sp.scale.setScalar(0.075);
            sp.renderOrder = 999;
            sp.userData.idPunto = p.id;
            marcadores.add(sp);
        });

        return () => {
            marcadores.children.forEach(s => { s.material.map?.dispose(); s.material.dispose(); });
        };
    }, [puntos, modo, reto?.resueltos, listo]);

    /* ---------- qué hacer al clicar, según el modo ---------- */
    useEffect(() => {
        alClicarRef.current = (info) => {
            // --- Reto: hay que acertar el marcador que toca ---
            if (modo === 'RETO' && reto && !reto.terminado) {
                if (!info.idPunto) return;
                const objetivo = reto.orden[reto.i];
                const acierto = info.idPunto === objetivo.id;
                setReto(r => {
                    const siguiente = r.i + 1;
                    return {
                        ...r,
                        i: siguiente,
                        aciertos: r.aciertos + (acierto ? 1 : 0),
                        intentos: r.intentos + 1,
                        resueltos: acierto ? [...r.resueltos, objetivo.id] : r.resueltos,
                        ultimo: { acierto, nombre: objetivo.nombre, info: objetivo.info },
                        terminado: siguiente >= r.orden.length,
                    };
                });
                return;
            }

            // --- Edición: clic en el modelo = punto nuevo ---
            if (modo === 'EDITAR') {
                if (info.idPunto) { setEditando(puntos.find(p => p.id === info.idPunto) || null); return; }
                if (info.pos) {
                    setEditando({ id: `p${Date.now().toString(36)}`, nombre: '', info: '', pos: info.pos, nuevo: true });
                }
                return;
            }

            // --- Ver: abrir la ficha del punto ---
            setSelec(info.idPunto ? puntos.find(p => p.id === info.idPunto) || null : null);
        };
    }, [modo, puntos, reto]);

    /* ---------- guardar los puntos ---------- */
    const guardarPuntos = useCallback(async (nuevos) => {
        setPuntos(nuevos);
        setGuardando(true);
        try {
            if (conjuntoActivo?.base) {
                // Conjunto del catálogo: vive dentro del documento del modelo.
                await guardarPuntosModelo(modelo, nuevos);
                onPuntosGuardados?.(nuevos);
            } else if (conjuntoActivo) {
                const actualizado = await guardarConjuntoEtiquetas({ ...conjuntoActivo, puntos: nuevos });
                setConjuntos(prev => prev.map(c => (c.id === actualizado.id ? actualizado : c)));
            }
        } catch (e) {
            console.warn('[Visor3D] no se pudieron guardar los puntos:', e);
            alert('No se han podido guardar las etiquetas: ' + e.message);
        } finally {
            setGuardando(false);
        }
    }, [modelo, conjuntoActivo, onPuntosGuardados]);

    const aplicarEdicion = (p) => {
        if (!p.nombre.trim()) return;
        const limpio = { id: p.id, nombre: p.nombre.trim(), info: (p.info || '').trim(), pos: p.pos };
        const existe = puntos.some(x => x.id === p.id);
        guardarPuntos(existe ? puntos.map(x => (x.id === p.id ? limpio : x)) : [...puntos, limpio]);
        setEditando(null);
    };

    const borrarPunto = (id) => {
        guardarPuntos(puntos.filter(p => p.id !== id));
        setEditando(null);
    };

    const generarDesdeMallas = () => {
        const nuevas = mallas
            .filter(m => !puntos.some(p => p.nombre.toLowerCase() === m.nombre.toLowerCase()))
            .slice(0, 60)
            .map((m, i) => ({ id: `m${Date.now().toString(36)}${i}`, nombre: m.nombre, info: '', pos: m.pos }));
        if (!nuevas.length) { alert('No hay mallas con nombre nuevas que añadir.'); return; }
        guardarPuntos([...puntos, ...nuevas]);
    };

    /* ---------- modo reto ---------- */
    const empezarReto = () => {
        const mezclado = [...puntos].sort(() => Math.random() - 0.5).slice(0, 10);
        setSelec(null);
        setReto({ orden: mezclado, i: 0, aciertos: 0, intentos: 0, resueltos: [], ultimo: null, terminado: false });
        setModo('RETO');
    };

    const salirDelReto = () => { setReto(null); setModo('VER'); };

    // Al acabar el reto se guarda el registro local (icono de Pi en la landing).
    useEffect(() => {
        if (!reto?.terminado) return;
        guardarRegistroLocal('VISOR_3D', {
            titulo: modelo.nombre,
            aciertos: reto.aciertos,
            intentos: reto.intentos,
            via: 'local',
        });
    }, [reto?.terminado]);   // eslint-disable-line react-hooks/exhaustive-deps

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
                        {puntos.length > 0 && modo !== 'RETO' && (
                            <button style={btn(false)} onClick={empezarReto}>🎯 Modo reto</button>
                        )}
                        {modo !== 'RETO' && (
                            <button style={btn(selector)} onClick={() => setSelector(s => !s)}>
                                🏷️ {conjuntoActivo ? conjuntoActivo.titulo.slice(0, 16) : 'Etiquetas'}
                            </button>
                        )}
                        {puedeEditar && modo !== 'RETO' && (
                            <button style={btn(modo === 'EDITAR')} onClick={() => { setModo(m => (m === 'EDITAR' ? 'VER' : 'EDITAR')); setSelec(null); }}>
                                ✏️ Editar
                            </button>
                        )}
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

            {listo && !enVR && modo === 'VER' && !seleccionado && (
                <div style={{ position: 'absolute', bottom: 12, right: 12, zIndex: 3, color: '#64748b', fontSize: '0.68rem', textAlign: 'right', pointerEvents: 'none' }}>
                    Arrastra para girar · rueda para acercar
                    {puntos.length > 0 && <><br />Pincha en los números para leer la etiqueta</>}
                </div>
            )}

            {/* Ficha de una etiqueta (modo ver) */}
            {seleccionado && modo === 'VER' && (
                <div style={{ position: 'absolute', right: 12, bottom: 12, zIndex: 4, width: 'min(330px, calc(100% - 24px))',
                    background: 'rgba(15,23,42,0.94)', color: '#e2e8f0', padding: '14px 16px', borderRadius: 14, backdropFilter: 'blur(6px)' }}>
                    <button onClick={() => setSelec(null)}
                        style={{ float: 'right', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}>✕</button>
                    <div style={{ fontWeight: 800, color: '#2dd4bf', fontSize: '1rem', marginBottom: 6 }}>
                        {puntos.findIndex(p => p.id === seleccionado.id) + 1}. {seleccionado.nombre}
                    </div>
                    {seleccionado.info
                        ? <div style={{ fontSize: '0.84rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{seleccionado.info}</div>
                        : <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>Sin información añadida.</div>}
                </div>
            )}

            {/* Selector de conjuntos de etiquetas */}
            {selector && !enVR && (
                <SelectorConjuntos
                    conjuntos={conjuntos} activoId={activoId} uid={uid} esAdmin={esAdmin}
                    modelo={modelo}
                    onElegir={cambiarConjunto}
                    onCrear={crearConjunto}
                    onRenombrar={renombrarConjunto}
                    onEliminar={eliminarConjunto}
                    onCerrar={() => setSelector(false)}
                />
            )}

            {/* Panel de edición de etiquetas */}
            {modo === 'EDITAR' && !enVR && (
                <PanelEtiquetas
                    puntos={puntos} mallas={mallas} guardando={guardando}
                    onEditar={setEditando} onBorrar={borrarPunto}
                    onGenerar={generarDesdeMallas} onCerrar={() => setModo('VER')}
                />
            )}

            {editando && (
                <FormularioEtiqueta
                    punto={editando}
                    onGuardar={aplicarEdicion}
                    onBorrar={() => borrarPunto(editando.id)}
                    onCancelar={() => setEditando(null)}
                />
            )}

            {/* Modo reto */}
            {modo === 'RETO' && reto && !enVR && (
                <PanelReto
                    reto={reto} modelo={modelo}
                    onSalir={salirDelReto}
                    onRepetir={empezarReto}
                    onEnviar={() => setEnvio(true)}
                />
            )}

            {mostrarEnvio && (
                <ModalEnviarProfe
                    datos={{ aciertos: reto?.aciertos || 0, intentos: reto?.intentos || 0, titulo: modelo.nombre }}
                    onClose={() => setEnvio(false)}
                />
            )}
        </div>
    );
}

/* ===================================================================== */
/*  ETIQUETAS: panel, formulario y modo reto                             */
/* ===================================================================== */

/** Elegir entre los juegos de etiquetas del modelo, o crear el propio. */
function SelectorConjuntos({ conjuntos, activoId, uid, esAdmin, modelo, onElegir, onCrear, onRenombrar, onEliminar, onCerrar }) {
    const [renombrando, setRenombrando] = useState(false);
    const [titulo, setTitulo] = useState('');
    const activo = conjuntos.find(c => c.id === activoId);
    const mio = activo && !activo.base && activo.autorUid === uid;

    const compartir = () => {
        const p = new URLSearchParams();
        p.set('modelo', modelo.url);
        if (modelo.nombre) p.set('nombre', modelo.nombre);
        if (activoId && activoId !== '__base__') p.set('etiquetas', activoId);
        const url = `${window.location.origin}/visor3d?${p.toString()}`;
        if (navigator.share) { navigator.share({ title: modelo.nombre, url }).catch(() => {}); return; }
        navigator.clipboard?.writeText(url).then(() => alert('Enlace copiado (incluye este juego de etiquetas).'));
    };

    return (
        <div style={{ position: 'absolute', right: 12, top: 60, zIndex: 5, width: 'min(300px, calc(100% - 24px))',
            background: 'rgba(15,23,42,0.95)', borderRadius: 14, padding: 12, backdropFilter: 'blur(6px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ flex: 1, color: '#2dd4bf', fontWeight: 800, fontSize: '0.88rem' }}>🏷️ Juegos de etiquetas</div>
                <button onClick={onCerrar} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 220, overflowY: 'auto', marginBottom: 10 }}>
                {conjuntos.length === 0 && (
                    <div style={{ color: '#64748b', fontSize: '0.78rem' }}>Este modelo aún no tiene etiquetas.</div>
                )}
                {conjuntos.map(c => {
                    const esActivo = c.id === activoId;
                    const esMio = !c.base && c.autorUid === uid;
                    return (
                        <button key={c.id} onClick={() => onElegir(c.id)}
                            style={{ textAlign: 'left', padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
                                border: esActivo ? '1px solid #2dd4bf' : '1px solid transparent',
                                background: esActivo ? 'rgba(45,212,191,0.14)' : 'rgba(255,255,255,0.06)' }}>
                            <div style={{ color: '#e2e8f0', fontSize: '0.82rem', fontWeight: 700 }}>
                                {c.titulo} {esMio && <span style={{ color: '#2dd4bf', fontSize: '0.68rem' }}>· tuyo</span>}
                            </div>
                            <div style={{ color: '#64748b', fontSize: '0.68rem' }}>
                                {c.puntos?.length || 0} etiquetas · {c.autorNombre || 'anónimo'}
                                {c.publico === false && ' · privado'}
                            </div>
                        </button>
                    );
                })}
            </div>

            {renombrando ? (
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    <input autoFocus value={titulo} onChange={e => setTitulo(e.target.value)}
                        placeholder="Nombre del conjunto"
                        style={{ flex: 1, padding: '7px 9px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', color: '#fff', fontSize: '0.8rem' }} />
                    <button onClick={() => { onRenombrar(titulo.trim() || activo.titulo); setRenombrando(false); }}
                        style={{ padding: '7px 11px', borderRadius: 9, border: 'none', background: '#2dd4bf', color: '#0f172a', fontWeight: 800, cursor: 'pointer', fontSize: '0.78rem' }}>OK</button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button onClick={() => onCrear(false)}
                        style={{ padding: '8px 10px', borderRadius: 10, border: 'none', background: '#2dd4bf', color: '#0f172a', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}>
                        ➕ Crear mis etiquetas
                    </button>
                    {conjuntos.some(c => c.puntos?.length) && (
                        <button onClick={() => onCrear(true)}
                            style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.18)', background: 'transparent', color: '#cbd5e1', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
                            ⧉ Copiar estas y adaptarlas
                        </button>
                    )}
                    <button onClick={compartir}
                        style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.18)', background: 'transparent', color: '#cbd5e1', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
                        🔗 Compartir con estas etiquetas
                    </button>
                    {(mio || (esAdmin && activo && !activo.base)) && (
                        <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => { setTitulo(activo.titulo); setRenombrando(true); }}
                                style={{ flex: 1, padding: '7px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#94a3b8', fontSize: '0.75rem', cursor: 'pointer' }}>✏️ Renombrar</button>
                            <button onClick={onEliminar}
                                style={{ padding: '7px 10px', borderRadius: 9, border: 'none', background: 'rgba(248,113,113,0.18)', color: '#fca5a5', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>🗑</button>
                        </div>
                    )}
                    {!uid && <div style={{ color: '#fbbf24', fontSize: '0.7rem', lineHeight: 1.4 }}>Inicia sesión para crear tus propias etiquetas.</div>}
                </div>
            )}
        </div>
    );
}

function PanelEtiquetas({ puntos, mallas, guardando, onEditar, onBorrar, onGenerar, onCerrar }) {
    const sinMallas = mallas.filter(m => !puntos.some(p => p.nombre.toLowerCase() === m.nombre.toLowerCase())).length;

    return (
        <div style={{ position: 'absolute', left: 12, top: 60, zIndex: 4, width: 'min(300px, calc(100% - 24px))', maxHeight: 'calc(100% - 140px)',
            background: 'rgba(15,23,42,0.93)', borderRadius: 14, padding: 12, backdropFilter: 'blur(6px)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ flex: 1, color: '#2dd4bf', fontWeight: 800, fontSize: '0.88rem' }}>🏷️ Etiquetas</div>
                {guardando && <span style={{ color: '#64748b', fontSize: '0.7rem', marginRight: 6 }}>guardando…</span>}
                <button onClick={onCerrar} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
            </div>

            <p style={{ color: '#94a3b8', fontSize: '0.74rem', margin: '0 0 10px', lineHeight: 1.5 }}>
                Pincha sobre el modelo para poner una etiqueta nueva, o sobre un número para editarla.
            </p>

            {sinMallas > 0 && (
                <button onClick={onGenerar}
                    style={{ padding: '8px 10px', borderRadius: 10, border: '1px dashed rgba(45,212,191,0.5)', background: 'transparent', color: '#2dd4bf', fontWeight: 700, fontSize: '0.76rem', cursor: 'pointer', marginBottom: 10 }}>
                    ✨ Crear {sinMallas} desde las piezas del modelo
                </button>
            )}

            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {puntos.length === 0 && <div style={{ color: '#64748b', fontSize: '0.78rem' }}>Todavía no hay etiquetas.</div>}
                {puntos.map((p, i) => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 9, padding: '7px 9px' }}>
                        <span style={{ background: '#2dd4bf', color: '#0f172a', width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: '#e2e8f0', fontSize: '0.8rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</div>
                            {!p.info && <div style={{ color: '#fbbf24', fontSize: '0.64rem' }}>sin información</div>}
                        </div>
                        <button onClick={() => onEditar(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '0.8rem' }}>✏️</button>
                        <button onClick={() => onBorrar(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', fontSize: '0.8rem' }}>🗑</button>
                    </div>
                ))}
            </div>
        </div>
    );
}

function FormularioEtiqueta({ punto, onGuardar, onBorrar, onCancelar }) {
    const [p, setP] = useState(punto);
    useEffect(() => { setP(punto); }, [punto]);

    const campo = { width: '100%', padding: '9px 11px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', color: '#fff', fontSize: '0.88rem', boxSizing: 'border-box', fontFamily: 'inherit' };
    const etiqueta = { color: '#94a3b8', fontSize: '0.73rem', fontWeight: 700, display: 'block', marginBottom: 4 };

    return (
        <div onClick={onCancelar} style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#1e293b', borderRadius: 16, padding: 22, width: '100%', maxWidth: 440 }}>
                <h3 style={{ color: '#fff', margin: '0 0 14px', fontSize: '1rem' }}>
                    {p.nuevo ? '🏷️ Nueva etiqueta' : '✏️ Editar etiqueta'}
                </h3>

                <div style={{ marginBottom: 12 }}>
                    <label style={etiqueta}>Etiqueta (lo que se ve al pinchar)</label>
                    <input autoFocus style={campo} value={p.nombre}
                        onChange={e => setP(prev => ({ ...prev, nombre: e.target.value }))}
                        placeholder="Bíceps braquial" />
                </div>

                <div>
                    <label style={etiqueta}>Información extra</label>
                    <textarea style={{ ...campo, minHeight: 110, resize: 'vertical' }} value={p.info || ''}
                        onChange={e => setP(prev => ({ ...prev, info: e.target.value }))}
                        placeholder="Flexiona el codo y supina el antebrazo. Se inserta en…" />
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                    <button onClick={() => onGuardar(p)} disabled={!p.nombre.trim()}
                        style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: p.nombre.trim() ? '#2dd4bf' : 'rgba(255,255,255,0.12)', color: p.nombre.trim() ? '#0f172a' : '#64748b', fontWeight: 800, cursor: p.nombre.trim() ? 'pointer' : 'default' }}>Guardar</button>
                    <button onClick={onCancelar}
                        style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#cbd5e1', fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
                    {!p.nuevo && (
                        <button onClick={onBorrar}
                            style={{ marginLeft: 'auto', padding: '10px 14px', borderRadius: 10, border: 'none', background: 'rgba(248,113,113,0.18)', color: '#fca5a5', fontWeight: 700, cursor: 'pointer' }}>🗑 Borrar</button>
                    )}
                </div>
            </div>
        </div>
    );
}

function PanelReto({ reto, modelo, onSalir, onRepetir, onEnviar }) {
    const { orden, i, aciertos, intentos, ultimo, terminado } = reto;
    const pct = intentos ? Math.round((aciertos / intentos) * 100) : 0;

    if (terminado) return (
        <div style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.85)', padding: 16 }}>
            <div style={{ background: '#1e293b', borderRadius: 18, padding: 26, textAlign: 'center', maxWidth: 380, width: '100%' }}>
                <div style={{ fontSize: '2.6rem' }}>{pct >= 80 ? '🏆' : pct >= 50 ? '👏' : '💪'}</div>
                <h3 style={{ color: '#fff', margin: '8px 0 4px' }}>{aciertos} de {intentos}</h3>
                <p style={{ color: '#94a3b8', fontSize: '0.86rem', margin: '0 0 18px' }}>{modelo.nombre} · {pct}% de aciertos</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    <button onClick={onEnviar} style={{ padding: '11px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#f1c40f,#e67e22)', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>📤 Enviar al profesor</button>
                    <button onClick={onRepetir} style={{ padding: '11px', borderRadius: 12, border: 'none', background: '#2dd4bf', color: '#0f172a', fontWeight: 800, cursor: 'pointer' }}>🔁 Otra vez</button>
                    <button onClick={onSalir} style={{ padding: '11px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#cbd5e1', fontWeight: 700, cursor: 'pointer' }}>Volver a explorar</button>
                </div>
            </div>
        </div>
    );

    return (
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: 12, zIndex: 4, width: 'min(420px, calc(100% - 24px))',
            background: 'rgba(15,23,42,0.93)', borderRadius: 14, padding: '12px 16px', backdropFilter: 'blur(6px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700 }}>{i + 1}/{orden.length}</span>
                <span style={{ flex: 1, color: '#22c55e', fontSize: '0.72rem', fontWeight: 700 }}>✓ {aciertos}</span>
                <button onClick={onSalir} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.95rem' }}>✕</button>
            </div>
            <div style={{ color: '#e2e8f0', fontSize: '0.95rem', fontWeight: 700 }}>
                ¿Dónde está <span style={{ color: '#2dd4bf' }}>{orden[i]?.nombre}</span>?
            </div>
            <div style={{ color: '#64748b', fontSize: '0.72rem', marginTop: 3 }}>Gira el modelo y pincha el marcador correcto.</div>
            {ultimo && (
                <div style={{ marginTop: 9, paddingTop: 9, borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '0.78rem', color: ultimo.acierto ? '#22c55e' : '#f87171' }}>
                    {ultimo.acierto ? '✅ ¡Bien!' : `❌ Ese no era: ${ultimo.nombre}`}
                    {ultimo.info && <div style={{ color: '#94a3b8', marginTop: 3, lineHeight: 1.5 }}>{ultimo.info}</div>}
                </div>
            )}
        </div>
    );
}

/** Envío del resultado del reto al profesor (colección informes_juegos). */
function ModalEnviarProfe({ datos, onClose }) {
    const [codigo, setCodigo] = useState('');
    const [nombre, setNombre] = useState('');
    const [curso, setCurso]   = useState('');
    const [enviando, setEnviando] = useState(false);
    const [enviado, setEnviado]   = useState(false);
    const [error, setError]       = useState('');

    const enviar = async () => {
        const code = codigo.trim().toUpperCase();
        if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
        if (!code)          { setError('Escribe el código del profesor.'); return; }
        setEnviando(true); setError('');
        try {
            const snap = await getDoc(doc(db, 'codigos_profesor', code));
            if (!snap.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
            const porcentaje = Math.round((datos.aciertos / Math.max(1, datos.intentos)) * 100);
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'VISOR_3D',
                modalidad: 'Individual',
                fecha: new Date(),
                codigoProfesor: code,
                modelo: datos.titulo || '',
                jugadores: [{
                    nombre: nombre.trim(),
                    curso: curso.trim(),
                    aciertos: datos.aciertos,
                    intentos: datos.intentos,
                    porcentaje,
                    modelo: datos.titulo || '',
                }],
            });
            guardarRegistroLocal('VISOR_3D', {
                titulo: datos.titulo, aciertos: datos.aciertos, intentos: datos.intentos,
                nombre: nombre.trim(), curso: curso.trim(), via: 'profesor',
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
                        <div style={{ color: '#aaa', fontSize: '0.88rem', marginTop: 8 }}>{datos.aciertos}/{datos.intentos} aciertos</div>
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
                            <button onClick={enviar} disabled={enviando} style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: enviando ? '#555' : 'linear-gradient(135deg,#3498db,#2980b9)', color: 'white', fontWeight: 700, cursor: enviando ? 'default' : 'pointer' }}>
                                {enviando ? 'Enviando…' : '📤 Enviar'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
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
    const [salas, setSalas]         = useState([]);
    const [salaActiva, setSalaActiva] = useState(null);
    const [pestana, setPestana]     = useState('MODELOS');   // MODELOS | SALAS
    // Juego de etiquetas indicado en el enlace compartido (?etiquetas=<id>).
    const [etiquetasUrl] = useState(() => {
        try { return new URLSearchParams(window.location.search).get('etiquetas'); } catch (_) { return null; }
    });

    // Firebase restaura la sesión de forma asíncrona: si se lee auth.currentUser
    // en el primer render (entrar directo a /visor3d o recargar) todavía es null
    // y el admin no se reconocería. Por eso escuchamos el cambio de sesión.
    const [usuarioAuth, setUsuarioAuth] = useState(() => auth.currentUser);
    useEffect(() => onAuthStateChanged(auth, setUsuarioAuth), []);

    const email = usuario?.email || usuarioAuth?.email || '';
    const esAdmin = email === ADMIN_EMAIL;

    const recargarPublicados = useCallback(() => {
        leerModelosPublicados({ soloVisibles: !esAdmin })
            .then(setPublicados)
            .catch(err => console.warn('[Visor3D] no se pudo leer el catálogo publicado:', err));
    }, [esAdmin]);

    useEffect(() => { recargarPublicados(); }, [recargarPublicados]);

    const recargarSalas = useCallback(() => {
        leerSalas()
            .then(s => setSalas(s.filter(x => x.publico !== false || x.autorUid === usuarioAuth?.uid)))
            .catch(err => console.warn('[Visor3D] no se pudieron leer las salas:', err));
    }, [usuarioAuth?.uid]);

    useEffect(() => { recargarSalas(); }, [recargarSalas]);

    // Sala indicada en el enlace: /visor3d?sala=<id>
    useEffect(() => {
        const id = new URLSearchParams(window.location.search).get('sala');
        if (!id || !salas.length || salaActiva) return;
        const s = salas.find(x => x.id === id);
        if (s) { setSalaActiva(s); setPestana('SALAS'); }
    }, [salas, salaActiva]);

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

    // Un enlace compartido solo lleva la URL del .glb, no las etiquetas. Cuando
    // llega el catálogo publicado, se las añadimos buscando por esa URL.
    useEffect(() => {
        if (!modelo || modelo.puntos || !publicados.length) return;
        const ficha = publicados.find(p => p.url === modelo.url);
        if (ficha?.puntos?.length) {
            setModelo(m => ({ ...m, id: ficha.id, publicado: true, puntos: ficha.puntos }));
        }
    }, [publicados, modelo?.url]);   // eslint-disable-line react-hooks/exhaustive-deps

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

    // Los modelos los publica el admin, pero cada profesor puede tener su
    // propio juego de etiquetas: eso se decide dentro de la escena.
    if (modelo) return (
        <EscenaModelo
            modelo={modelo}
            esAdmin={esAdmin}
            usuarioActual={usuarioAuth}
            etiquetasIniciales={etiquetasUrl}
            onPuntosGuardados={(p) => {
                setModelo(m => ({ ...m, puntos: p }));
                if (modelo.publicado) recargarPublicados();
                else setLocales(leerModelosLocales());
            }}
            onVolver={volverGaleria}
        />
    );

    if (salaActiva) return (
        <Sala3D
            sala={salaActiva}
            modelos={[...MODELOS_3D, ...publicados]}
            puedeEditar={!!usuarioAuth?.uid && salaActiva.autorUid === usuarioAuth.uid}
            onGuardar={async (s) => { const g = await guardarSala(s); setSalaActiva(g); recargarSalas(); }}
            onExaminar={(pieza) => {
                // Abrir esa pieza en el visor individual, con sus etiquetas.
                const ficha = publicados.find(p => p.url === pieza.url);
                setSalaActiva(null);
                setModelo(ficha || { url: pieza.url, nombre: pieza.nombre, emoji: pieza.emoji });
            }}
            onSalir={() => { setSalaActiva(null); window.history.pushState({}, '', '/visor3d'); }}
        />
    );

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
                <p style={{ color: '#94a3b8', textAlign: 'center', margin: '0 0 18px', fontSize: '0.92rem' }}>
                    Modelos para explorar girándolos, acercándolos… y con gafas de realidad virtual.
                </p>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 22 }}>
                    {[['MODELOS', '🧊 Modelos'], ['SALAS', '🏛️ Salas']].map(([id, txt]) => (
                        <button key={id} onClick={() => setPestana(id)}
                            style={{ padding: '8px 18px', borderRadius: 999, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '0.85rem',
                                background: pestana === id ? '#2dd4bf' : 'rgba(255,255,255,0.08)',
                                color: pestana === id ? '#0f172a' : '#94a3b8' }}>{txt}</button>
                    ))}
                </div>

                {pestana === 'SALAS' && (
                    <PanelSalas
                        salas={salas} modelos={[...MODELOS_3D, ...publicados]}
                        uid={usuarioAuth?.uid} nombreUsuario={usuarioAuth?.displayName || usuarioAuth?.email || 'Profesor'}
                        esAdmin={esAdmin}
                        onEntrar={(s) => { setSalaActiva(s); window.history.pushState({}, '', `/visor3d?sala=${s.id}`); }}
                        onCambio={recargarSalas}
                    />
                )}

                {pestana === 'MODELOS' && <>
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
                        onGuardar={async (m, alCatalogo) => {
                            if (alCatalogo) {
                                // Admin: va al catálogo de Firestore y lo ve todo el mundo.
                                try {
                                    await publicarModelo(m);
                                    recargarPublicados();
                                } catch (e) {
                                    alert('Se subió a Cloudinary, pero no se pudo publicar: ' + e.message
                                        + '\n\nQueda guardado en este navegador.');
                                    setLocales(guardarModeloLocal(m));
                                }
                            } else {
                                setLocales(guardarModeloLocal(m));
                            }
                            setForm(false);
                        }} />
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
                </>}
            </div>
        </div>
    );
}

/* ---------- salas: listado y creación ---------- */

function PanelSalas({ salas, modelos, uid, nombreUsuario, esAdmin, onEntrar, onCambio }) {
    const [creando, setCreando] = useState(false);
    const [titulo, setTitulo]   = useState('');
    const [emoji, setEmoji]     = useState('🏛️');
    const [elegidos, setElegidos] = useState([]);
    const [guardando, setGuardando] = useState(false);
    const [error, setError]     = useState(null);

    const alternar = (m) => setElegidos(prev =>
        prev.some(x => x.url === m.url) ? prev.filter(x => x.url !== m.url) : [...prev, m]);

    const crear = async () => {
        if (!uid) { setError('Inicia sesión para crear una sala.'); return; }
        if (!titulo.trim()) { setError('Ponle un nombre a la sala.'); return; }
        if (!elegidos.length) { setError('Elige al menos un modelo.'); return; }
        setGuardando(true); setError(null);
        try {
            const piezas = repartirEnSala(elegidos.map(m => ({
                url: m.url, nombre: m.nombre, emoji: m.emoji || '🧊',
                altura: m.escalaReal > 0 ? m.escalaReal : 1.6, pedestal: true, pos: [0, 0, 0], rotY: 0,
            })));
            await guardarSala({
                titulo: titulo.trim(), emoji, autorUid: uid, autorNombre: nombreUsuario,
                publico: true, piezas,
            });
            setCreando(false); setTitulo(''); setElegidos([]);
            onCambio();
        } catch (e) {
            setError(e.message);
        } finally {
            setGuardando(false);
        }
    };

    const eliminar = async (s) => {
        if (!window.confirm(`¿Borrar la sala "${s.titulo}"? Los modelos no se tocan.`)) return;
        try { await borrarSala(s.id); onCambio(); } catch (e) { alert(e.message); }
    };

    const campo = { width: '100%', padding: '9px 11px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', color: '#fff', fontSize: '0.86rem', boxSizing: 'border-box' };

    return (
        <div style={{ marginBottom: 26 }}>
            {salas.length === 0 && !creando && (
                <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 16, padding: 24, color: '#cbd5e1', textAlign: 'center', marginBottom: 18 }}>
                    <div style={{ fontSize: '2rem', marginBottom: 8 }}>🏛️</div>
                    <p style={{ margin: '0 0 6px', fontWeight: 700 }}>Todavía no hay salas</p>
                    <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.8 }}>
                        Una sala reúne varios modelos en un mismo espacio por el que se puede caminar, también con gafas VR.
                    </p>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14, marginBottom: 18 }}>
                {salas.map(s => (
                    <div key={s.id} onClick={() => onEntrar(s)}
                        style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 16, cursor: 'pointer', position: 'relative', border: '1px solid rgba(45,212,191,0.25)' }}>
                        {(esAdmin || s.autorUid === uid) && (
                            <button onClick={e => { e.stopPropagation(); eliminar(s); }}
                                style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, padding: '3px 7px', cursor: 'pointer', color: '#fca5a5', fontSize: '0.72rem' }}>🗑</button>
                        )}
                        <div style={{ fontSize: '2rem', textAlign: 'center' }}>{s.emoji || '🏛️'}</div>
                        <h3 style={{ margin: '6px 0 0', color: '#fff', fontSize: '0.95rem', textAlign: 'center' }}>{s.titulo}</h3>
                        <div style={{ color: '#2dd4bf', fontSize: '0.7rem', textAlign: 'center', marginTop: 4, fontWeight: 700 }}>
                            {s.piezas?.length || 0} modelo{(s.piezas?.length || 0) === 1 ? '' : 's'}
                        </div>
                        <div style={{ color: '#64748b', fontSize: '0.66rem', textAlign: 'center', marginTop: 2 }}>{s.autorNombre}</div>
                    </div>
                ))}
            </div>

            {creando ? (
                <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 20 }}>
                    <h3 style={{ color: '#fff', margin: '0 0 14px', fontSize: '1rem' }}>🏛️ Nueva sala</h3>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                        <input style={{ ...campo, flex: 1 }} value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Sala de Anatomía" />
                        <div style={{ width: 84 }}><SelectorEmoji valor={emoji} onCambio={setEmoji} titulo="Icono de la sala" /></div>
                    </div>

                    <div style={{ color: '#94a3b8', fontSize: '0.76rem', fontWeight: 700, marginBottom: 8 }}>
                        Modelos de la sala ({elegidos.length} elegidos · máximo 12)
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, maxHeight: 260, overflowY: 'auto', marginBottom: 6 }}>
                        {modelos.map((m, i) => {
                            const puesto = elegidos.some(x => x.url === m.url);
                            return (
                                <button key={m.url + i} onClick={() => alternar(m)}
                                    style={{ textAlign: 'left', padding: '9px 11px', borderRadius: 10, cursor: 'pointer',
                                        border: puesto ? '1px solid #2dd4bf' : '1px solid transparent',
                                        background: puesto ? 'rgba(45,212,191,0.15)' : 'rgba(255,255,255,0.06)' }}>
                                    <div style={{ color: '#e2e8f0', fontSize: '0.8rem', fontWeight: 600 }}>
                                        {puesto ? '✓ ' : ''}{m.emoji || '🧊'} {m.nombre}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                    {modelos.length === 0 && <div style={{ color: '#fbbf24', fontSize: '0.78rem' }}>Primero publica algún modelo en el catálogo.</div>}

                    {error && <p style={{ color: '#f87171', fontSize: '0.8rem', marginTop: 10 }}>⚠️ {error}</p>}

                    <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                        <button onClick={crear} disabled={guardando}
                            style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: '#2dd4bf', color: '#0f172a', fontWeight: 800, cursor: 'pointer' }}>
                            {guardando ? 'Creando…' : 'Crear sala'}
                        </button>
                        <button onClick={() => { setCreando(false); setError(null); }}
                            style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#cbd5e1', fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
                    </div>
                </div>
            ) : (
                <div style={{ textAlign: 'center' }}>
                    <button onClick={() => setCreando(true)}
                        style={{ padding: '12px 22px', borderRadius: 12, border: 'none', background: '#2dd4bf', color: '#0f172a', fontWeight: 800, cursor: 'pointer', fontSize: '0.95rem' }}>
                        ➕ Crear sala
                    </button>
                </div>
            )}
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
    const [publicId, setPublicId] = useState('');
    const [publicar, setPublicar] = useState(esAdmin);
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
            const { url: secure, publicId: pid } = await subida;
            setUrl(secure);
            setPublicId(pid || '');
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
            publicId,
        }, publicar && esAdmin);
    };

    // Trae nombre, autor y licencia de Sketchfab sin descargar el modelo:
    // útil cuando el archivo se ha optimizado y subido a mano.
    const traerFicha = async () => {
        if (!fuente.trim()) return;
        setError(null);
        try {
            const idToken = await auth.currentUser.getIdToken();
            const r = await fetch('/api/sketchfab', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
                body: JSON.stringify({ enlace: fuente.trim(), soloInfo: true }),
            });
            const data = await r.json();
            const f = data.ficha;
            if (!f) throw new Error(data?.error || 'No he podido leer los datos de ese modelo.');
            setNombre(prev => prev || f.nombre);
            setAutor(f.autor || '');
            setLic(f.licencia || '');
            setFuente(f.fuente || fuente);
            setDesc(prev => prev || f.descripcion || '');
        } catch (e) {
            setError(e.message);
        }
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
                <div><label style={etiqueta}>Icono</label><SelectorEmoji valor={emoji} onCambio={setEmoji} /></div>
                <div>
                    <label style={etiqueta}>Categoría</label>
                    <select style={campo} value={categoria} onChange={e => setCat(e.target.value)}>
                        {CATEGORIAS_3D.map(c => <option key={c.id} value={c.id} style={{ color: '#000' }}>{c.emoji} {c.nombre}</option>)}
                    </select>
                </div>
                <div><label style={etiqueta}>Tamaño real en VR (m, opcional)</label><input style={campo} value={escalaReal} onChange={e => setEscala(e.target.value)} placeholder="0.2" /></div>
                <div><label style={etiqueta}>Autor (atribución)</label><input style={campo} value={autor} onChange={e => setAutor(e.target.value)} placeholder="Autor del modelo" /></div>
                <div><label style={etiqueta}>Licencia</label><input style={campo} value={licencia} onChange={e => setLic(e.target.value)} /></div>
                <div style={{ gridColumn: '1 / -1' }}>
                    <label style={etiqueta}>Enlace de origen (Sketchfab)</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input style={campo} value={fuente} onChange={e => setFuente(e.target.value)} placeholder="https://skfb.ly/…" />
                        {esAdmin && (
                            <button onClick={traerFicha} disabled={!fuente.trim()} title="Rellenar autor y licencia desde Sketchfab"
                                style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid rgba(45,212,191,0.5)', background: 'transparent', color: '#2dd4bf', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                                ⬇️ Datos
                            </button>
                        )}
                    </div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}><label style={etiqueta}>Descripción para el alumno</label><input style={campo} value={descripcion} onChange={e => setDesc(e.target.value)} /></div>
            </div>

            {esAdmin && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#e2e8f0', fontSize: '0.82rem', marginTop: 14, cursor: 'pointer' }}>
                    <input type="checkbox" checked={publicar} onChange={e => setPublicar(e.target.checked)} />
                    Publicar en el catálogo (lo verán todos los usuarios)
                </label>
            )}

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

/**
 * Borrado definitivo de un modelo: el archivo en Cloudinary, su ficha del
 * catálogo y los juegos de etiquetas que dependían de él (quedarían huérfanos).
 * Es irreversible, así que se pide escribir BORRAR.
 */
function ConfirmarBorrado({ asset, ficha, onHecho, onCancelar }) {
    const [conjuntos, setConjuntos] = useState(null);
    const [texto, setTexto] = useState('');
    const [borrando, setBorrando] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        leerConjuntosEtiquetas(asset.url)
            .then(setConjuntos)
            .catch(() => setConjuntos([]));
    }, [asset.url]);

    const borrar = async () => {
        setBorrando(true); setError(null);
        try {
            // 1) El archivo en Cloudinary.
            await apiCloudinary('borrar', { publicId: asset.publicId });
            // 2) Los juegos de etiquetas que apuntaban a él.
            for (const c of conjuntos || []) {
                try { await borrarConjuntoEtiquetas(c.id); } catch (_) {}
            }
            // 3) Su ficha del catálogo.
            if (ficha?.id) { try { await despublicarModelo(ficha.id); } catch (_) {} }
            onHecho();
        } catch (e) {
            setError(e.message);
            setBorrando(false);
        }
    };

    const nombre = ficha?.nombre || asset.publicId.split('/').pop();
    const listo = texto.trim().toUpperCase() === 'BORRAR' && conjuntos !== null && !borrando;

    return (
        <div onClick={borrando ? undefined : onCancelar}
            style={{ position: 'fixed', inset: 0, zIndex: 10003, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#1e293b', borderRadius: 16, padding: 24, width: '100%', maxWidth: 440 }}>
                <h3 style={{ color: '#f87171', margin: '0 0 6px', fontSize: '1.05rem' }}>🗑 Borrar «{nombre}»</h3>
                <p style={{ color: '#94a3b8', fontSize: '0.84rem', margin: '0 0 14px', lineHeight: 1.6 }}>
                    Esto <b style={{ color: '#fca5a5' }}>no se puede deshacer</b>. Se borrará:
                </p>

                <ul style={{ color: '#cbd5e1', fontSize: '0.82rem', lineHeight: 1.8, margin: '0 0 14px', paddingLeft: 20 }}>
                    <li>El archivo <code style={{ fontSize: '0.76rem' }}>{asset.publicId}</code> de Cloudinary ({(asset.bytes / 1048576).toFixed(1)} MB)</li>
                    {ficha && <li>Su ficha del catálogo (dejará de verse en pikt.es)</li>}
                    {conjuntos === null
                        ? <li style={{ opacity: 0.6 }}>Comprobando juegos de etiquetas…</li>
                        : conjuntos.length > 0
                            ? <li style={{ color: '#fbbf24' }}>
                                <b>{conjuntos.length} juego{conjuntos.length > 1 ? 's' : ''} de etiquetas</b>
                                {conjuntos.some(c => c.autorNombre) && <> de: {[...new Set(conjuntos.map(c => c.autorNombre).filter(Boolean))].join(', ')}</>}
                              </li>
                            : <li style={{ opacity: 0.6 }}>No tiene juegos de etiquetas</li>}
                </ul>

                {conjuntos?.length > 0 && (
                    <p style={{ color: '#fbbf24', fontSize: '0.78rem', margin: '0 0 12px', lineHeight: 1.5 }}>
                        ⚠️ Hay etiquetas hechas por otros profesores. Sin el modelo no sirven de nada, pero perderán ese trabajo.
                    </p>
                )}

                <label style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: 5 }}>
                    Escribe BORRAR para confirmar
                </label>
                <input value={texto} onChange={e => setTexto(e.target.value)} disabled={borrando}
                    style={{ width: '100%', padding: '9px 11px', borderRadius: 10, border: '1px solid rgba(248,113,113,0.4)', background: 'rgba(255,255,255,0.07)', color: '#fff', fontSize: '0.9rem', letterSpacing: 2, fontWeight: 700, boxSizing: 'border-box' }} />

                {error && <p style={{ color: '#f87171', fontSize: '0.8rem', marginTop: 10 }}>⚠️ {error}</p>}

                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                    <button onClick={borrar} disabled={!listo}
                        style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: listo ? '#ef4444' : 'rgba(255,255,255,0.1)', color: listo ? '#fff' : '#64748b', fontWeight: 800, cursor: listo ? 'pointer' : 'default' }}>
                        {borrando ? 'Borrando…' : 'Borrar definitivamente'}
                    </button>
                    <button onClick={onCancelar} disabled={borrando}
                        style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#cbd5e1', fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
                </div>
            </div>
        </div>
    );
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
    const [borrando, setBorrando] = useState(null); // asset pendiente de borrar
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
                                    <button onClick={() => quitar(ficha)} title="Quitarlo del catálogo (el archivo se conserva en Cloudinary)"
                                        style={{ ...st.btn, background: 'rgba(255,255,255,0.12)', color: '#cbd5e1' }}>👁‍🗨 Retirar</button>
                                </>) : (
                                    <button onClick={() => setEdit({ url: a.url, publicId: a.publicId, nombre: a.publicId.split('/').pop().replace(/\.(glb|gltf)$/i, ''), emoji: '🧊', categoria: 'OTROS', licencia: 'CC BY 4.0', visible: true })}
                                        style={{ ...st.btn, background: '#2dd4bf', color: '#0f172a' }}>➕ Publicar</button>
                                )}
                                <button onClick={() => setBorrando({ asset: a, ficha })} title="Borrar el archivo de Cloudinary (definitivo)"
                                    style={{ ...st.btn, background: 'rgba(248,113,113,0.18)', color: '#fca5a5' }}>🗑</button>
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

            {borrando && (
                <ConfirmarBorrado
                    asset={borrando.asset} ficha={borrando.ficha}
                    onCancelar={() => setBorrando(null)}
                    onHecho={() => { setBorrando(null); cargar(carpeta); onCambio(); }}
                />
            )}

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
                    <div><label style={etiqueta}>Icono</label><SelectorEmoji valor={m.emoji || '🧊'} onCambio={v => setM(prev => ({ ...prev, emoji: v }))} /></div>
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
