// src/ControlAula.jsx
//
// Herramienta "Control de Aula": orquestación de juegos en tiempo real.
//   - TeacherControlPanel: panel del profesor. Crea/cierra sala, ve la presencia de los
//     alumnos en tiempo real (foco/desconexión), y LANZA PARTIDAS PUNTUABLES: elige un
//     recurso propio + modo de juego, se abre a la vez en todos los dispositivos conectados,
//     recoge las puntuaciones y muestra un ranking. Después puede elegir otro juego.
//     También conserva un lanzador de actividades web (iframe) para rutas no puntuables.
//   - StudentJoinView: vista del alumno. Entra por código, rastrea foco vía usePresenceRoom,
//     y cuando el profe lanza una partida la juega en modoOlimpico enviando su puntuación.
//
// Usa Firestore (mismo stack que el resto del proyecto). Los juegos puntuables comparten el
// contrato modoOlimpico + tiempoOlimpico + hojaOlimpica + onOlimpicoFinish(puntuacion).

import React, { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { db, auth } from './firebase';
import {
    doc, setDoc, updateDoc, onSnapshot, collection, getDoc, getDocs,
    query, where, serverTimestamp, deleteField,
} from 'firebase/firestore';
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { Radio, Rocket, Bell, Link as LinkIcon, LogIn, Trophy, Gamepad2 } from 'lucide-react';
import usePresenceRoom, { ESTADO } from './hooks/usePresenceRoom';

// Juegos puntuables cargados bajo demanda (comparten el contrato modoOlimpico).
const PasapalabraGame  = lazy(() => import('./PasapalabraGame'));
const CazaBurbujasGame = lazy(() => import('./CazaBurbujasGame'));
const PikatronRun      = lazy(() => import('./PikatronRun'));
const AparejadosGame   = lazy(() => import('./AparejadosGame'));
const SopaDeLetrasGame = lazy(() => import('./SopaDeLetrasGame'));
const TextWordleGame   = lazy(() => import('./TextWordleGame'));
const KartingedGame    = lazy(() => import('./KartingedGame'));

// ─────────────────────────────────────────────────────────────────────────────
// Mapa recurso → modos de juego puntuables disponibles.
// La clave es el `tipoJuego` guardado en el recurso; los modos son los juegos que
// saben reproducir ese recurso y reportan puntuación (onOlimpicoFinish).
// ─────────────────────────────────────────────────────────────────────────────
export const MODOS_POR_TIPO = {
    CAZABURBUJAS: [
        { modo: 'BURBUJAS', label: 'Burbujas',  emoji: '🫧' },
        { modo: 'PIKATRON', label: 'Pikatron',  emoji: '🏃' },
        { modo: 'KARTINGED', label: 'Karting',  emoji: '🏎️' },
    ],
    WORDLE: [
        { modo: 'WORDLE', label: 'WordLe',          emoji: '🟩' },
        { modo: 'SOPA',   label: 'Sopa de letras',  emoji: '🔡' },
    ],
    PASAPALABRA: [
        { modo: 'PASAPALABRA', label: 'Pasapalabra', emoji: '🔤' },
    ],
    APAREJADOS: [
        { modo: 'APAREJADOS', label: 'AparejaDOS', emoji: '🃏' },
    ],
};
export const TIPOS_PUNTUABLES = Object.keys(MODOS_POR_TIPO);
const MODOS_SIN_HOJA = new Set(['APAREJADOS']); // no usan selección de hoja

// Actividades por materia (rutas públicas → se abren sin login en el iframe del alumno).
// Agrupadas por materia para el lanzador. No dan ranking; para puntuación usa un recurso
// en "Lanzar partida puntuable" o lanza cualquier recurso con el deep-link ?r=ID.
export const CATALOGO_JUEGOS = [
    // Ciencias / Biología
    { label: 'Partes de la planta',  emoji: '🌱',  url: '/partes_planta',      materia: 'Ciencias' },
    { label: 'Sistema Solar 3D',     emoji: '🪐',  url: '/sistema_solar',      materia: 'Ciencias' },
    // Geografía / Historia
    { label: 'Imperios',             emoji: '🏛️',  url: '/imperios',           materia: 'Geo/Historia' },
    { label: '¿Quién es quién?',     emoji: '🕵️',  url: '/quienesquien',       materia: 'Geo/Historia' },
    // Lengua / Idiomas
    { label: 'Verbos irregulares',   emoji: '🇬🇧', url: '/irregular_verbs',    materia: 'Idiomas' },
    { label: 'EtiquetaMe',           emoji: '🏷️',  url: '/etiquetame',         materia: 'Lengua' },
    // Lógica / Mates
    { label: 'Retos',                emoji: '🧩',  url: '/retos',              materia: 'Lógica' },
    { label: 'Conecta los puntos',   emoji: '✏️',  url: '/conectapuntos',      materia: 'Lógica' },
    { label: 'Sudoku',               emoji: '🔢',  url: '/sudoku',             materia: 'Lógica' },
    { label: 'Funciones ejecutivas', emoji: '🧠',  url: '/funcionesejecutivas',materia: 'Lógica' },
    // Educación física / Otros
    { label: 'Escalada',             emoji: '🧗',  url: '/escalada',           materia: 'Ed. Física' },
    { label: 'Who Knows?',           emoji: '❓',  url: '/whoknows',           materia: 'Ed. Física' },
    { label: 'Karting',              emoji: '🏎️',  url: '/karting_track',      materia: 'Otros' },
    { label: 'Arkade',               emoji: '🕹️',  url: '/arkade',             materia: 'Otros' },
];

const CODIGO_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const generarCodigo = (n = 5) =>
    Array.from({ length: n }, () => CODIGO_CHARS[Math.floor(Math.random() * CODIGO_CHARS.length)]).join('');

const DESCONEXION_MS = 15000;

const absoluteUrl = (url) => {
    if (/^https?:\/\//i.test(url)) return url;
    return `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
};

// ═════════════════════════════════════════════════════════════════════════════
// RUNNER: renderiza el juego puntuable correcto en modoOlimpico.
// ═════════════════════════════════════════════════════════════════════════════
export function JuegoOlimpicoRunner({ modo, recurso, hoja, tiempo, usuario, onFinish, onExit }) {
    const common = {
        recurso,
        usuario,
        modoOlimpico: true,
        tiempoOlimpico: tiempo,
        hojaOlimpica: hoja || 'General',
        onOlimpicoFinish: onFinish,
        alTerminar: onExit,   // algunos juegos usan alTerminar
        onExit,               // otros usan onExit
    };
    let Comp = null, extra = {};
    switch (modo) {
        case 'PASAPALABRA': Comp = PasapalabraGame; break;
        case 'BURBUJAS':    Comp = CazaBurbujasGame; extra = { modoJuegoInicial: 'Burbujas' }; break;
        case 'PIKATRON':    Comp = PikatronRun; break;
        case 'APAREJADOS':  Comp = AparejadosGame; break;
        case 'SOPA':        Comp = SopaDeLetrasGame; break;
        case 'WORDLE':      Comp = TextWordleGame; break;
        case 'KARTINGED':   Comp = KartingedGame; break;
        default: return <div style={{ color: 'white', padding: 40, textAlign: 'center' }}>Juego no soportado.</div>;
    }
    return (
        <Suspense fallback={<div style={{ color: 'white', padding: 40, textAlign: 'center' }}>Cargando juego…</div>}>
            <Comp {...common} {...extra} />
        </Suspense>
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// PANEL DEL PROFESOR
// ═════════════════════════════════════════════════════════════════════════════
export function TeacherControlPanel() {
    const [user, setUser] = useState(() => auth.currentUser);
    const [loginError, setLoginError] = useState('');
    const [codigo] = useState(() => generarCodigo());
    const [alumnos, setAlumnos] = useState([]);
    const [salaAbierta, setSalaAbierta] = useState(false);
    const [room, setRoom] = useState(null);
    const [urlManual, setUrlManual] = useState('');
    const [qrGrande, setQrGrande] = useState(false);
    const [toasts, setToasts] = useState([]);
    const [, forceTick] = useState(0);

    // Recursos puntuables del profesor + selección de lanzamiento.
    const [recursos, setRecursos] = useState([]);
    const [cargandoRec, setCargandoRec] = useState(false);
    const [recursoSel, setRecursoSel] = useState(null);
    const [modoSel, setModoSel] = useState(null);
    const [hojaSel, setHojaSel] = useState('General');
    const [tiempoSel, setTiempoSel] = useState(60);

    const prevFocusCounts = useRef({});
    const primeraCargaAlumnos = useRef(true);

    const roomRef = useMemo(() => doc(db, 'control_rooms', codigo), [codigo]);
    const game = room?.game || null;

    // Sesión del profesor (crear sala requiere estar autenticado — regla request.auth != null).
    useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), []);

    const iniciarSesion = async () => {
        setLoginError('');
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
        } catch (e) {
            setLoginError('No se pudo iniciar sesión. Inténtalo de nuevo.');
        }
    };

    // Crear la sala + suscripciones (solo con profesor autenticado).
    useEffect(() => {
        if (!user) return;
        let vivo = true;
        (async () => {
            try {
                await setDoc(roomRef, {
                    code: codigo,
                    ownerUid: user?.uid || null,
                    createdAt: serverTimestamp(),
                    active: true,
                    currentRoute: null,
                    currentLabel: null,
                    game: null,
                }, { merge: true });
                if (vivo) setSalaAbierta(true);
            } catch (e) { console.error('No se pudo crear la sala', e); }
        })();

        const unsubRoom = onSnapshot(roomRef, (snap) => {
            if (snap.exists()) setRoom({ id: snap.id, ...snap.data() });
        });

        const unsubAlumnos = onSnapshot(collection(db, 'control_rooms', codigo, 'students'), (snap) => {
            const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            if (!primeraCargaAlumnos.current) {
                lista.forEach((a) => {
                    const prev = prevFocusCounts.current[a.id] ?? 0;
                    const now = a.focusLostCount ?? 0;
                    if (now > prev) lanzarToast(`⚠️ ${a.name || 'Alumno'} ha salido de la pestaña`);
                });
            }
            lista.forEach((a) => { prevFocusCounts.current[a.id] = a.focusLostCount ?? 0; });
            primeraCargaAlumnos.current = false;
            setAlumnos(lista.sort((x, y) => (x.name || '').localeCompare(y.name || '')));
        });

        return () => {
            vivo = false;
            unsubRoom();
            unsubAlumnos();
            updateDoc(roomRef, { active: false }).catch(() => {});
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [codigo, user]);

    // Cargar recursos puntuables del profesor.
    useEffect(() => {
        const uid = user?.uid;
        if (!uid) return;
        setCargandoRec(true);
        getDocs(query(collection(db, 'resources'), where('profesorUid', '==', uid)))
            .then((snap) => {
                const list = snap.docs
                    .map((d) => ({ id: d.id, ...d.data() }))
                    .filter((r) => TIPOS_PUNTUABLES.includes(r.tipoJuego))
                    .sort((a, b) => (a.titulo || '').localeCompare(b.titulo || ''));
                setRecursos(list);
            })
            .catch((e) => console.error('Cargando recursos', e))
            .finally(() => setCargandoRec(false));
    }, [user]);

    useEffect(() => {
        const id = setInterval(() => forceTick((t) => t + 1), 3000);
        return () => clearInterval(id);
    }, []);

    const lanzarToast = (msg) => {
        const id = Date.now() + Math.random();
        setToasts((t) => [...t, { id, msg }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
    };

    const estadoEfectivo = (a) => {
        const stale = a.lastSeenMs && (Date.now() - a.lastSeenMs > DESCONEXION_MS);
        if (a.estado === ESTADO.DESCONECTADO || stale) return ESTADO.DESCONECTADO;
        return a.estado || ESTADO.ACTIVO;
    };

    // Al elegir un recurso, preselecciona el primer modo y hoja disponibles.
    const elegirRecurso = (r) => {
        setRecursoSel(r);
        const modos = MODOS_POR_TIPO[r.tipoJuego] || [];
        setModoSel(modos[0]?.modo || null);
        const hojas = (r.hojas || []).map((h) => h.nombreHoja).filter(Boolean);
        setHojaSel(hojas[0] || 'General');
    };

    const lanzarPartida = async () => {
        if (!recursoSel || !modoSel) return;
        const launchId = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        try {
            await updateDoc(roomRef, {
                currentRoute: null, currentLabel: null,
                game: {
                    launchId, modo: modoSel,
                    recursoId: recursoSel.id,
                    recursoTitulo: recursoSel.titulo || 'Juego',
                    hoja: MODOS_SIN_HOJA.has(modoSel) ? null : hojaSel,
                    tiempo: tiempoSel,
                    state: 'PLAYING',
                    startedAt: Date.now(),
                    ranking: null,
                },
            });
        } catch (e) { console.error(e); }
    };

    const rankingActual = () => (alumnos || [])
        .filter((a) => a.lastScore && game && a.lastScore.launchId === game.launchId)
        .map((a) => ({ name: a.name || 'Alumno', puntuacion: a.lastScore.puntuacion || 0 }))
        .sort((x, y) => y.puntuacion - x.puntuacion);

    const terminarPartida = async () => {
        if (!game) return;
        try {
            await updateDoc(roomRef, { 'game.state': 'FIN', 'game.ranking': rankingActual() });
        } catch (e) { console.error(e); }
    };

    const elegirOtroJuego = async () => {
        try { await updateDoc(roomRef, { game: deleteField() }); } catch (e) { console.error(e); }
    };

    // Lanzador de actividad web (iframe, no puntuable).
    const lanzarWeb = async (url, label) => {
        if (!url) return;
        try {
            await updateDoc(roomRef, {
                game: deleteField(),
                currentRoute: absoluteUrl(url), currentLabel: label || url,
            });
        } catch (e) { console.error(e); }
    };
    const detenerWeb = async () => {
        try { await updateDoc(roomRef, { currentRoute: null, currentLabel: null }); } catch (e) { console.error(e); }
    };

    const joinUrl = `${window.location.origin}/?aula=${codigo}`;
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(joinUrl)}&bgcolor=ffffff&color=1e3a8a&margin=8`;
    const totalIncidencias = alumnos.reduce((s, a) => s + (a.focusLostCount || 0), 0);
    const conectados = alumnos.filter((a) => estadoEfectivo(a) !== ESTADO.DESCONECTADO);
    const jugando = game && game.state === 'PLAYING';
    const jugadoresPartida = game ? alumnos.filter((a) => a.lastScore?.launchId === game.launchId) : [];

    const modosDisponibles = recursoSel ? (MODOS_POR_TIPO[recursoSel.tipoJuego] || []) : [];

    const badge = (est) => {
        const map = {
            [ESTADO.ACTIVO]:       { c: '#16a34a', bg: '#dcfce7', txt: '🟢 Activo' },
            [ESTADO.DESENFOCADO]:  { c: '#b45309', bg: '#fef3c7', txt: '🟡 Desenfocado' },
            [ESTADO.DESCONECTADO]: { c: '#6b7280', bg: '#f3f4f6', txt: '⚫ Desconectado' },
        };
        const s = map[est] || map[ESTADO.ACTIVO];
        return <span style={{ background: s.bg, color: s.c, borderRadius: 20, padding: '3px 10px', fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{s.txt}</span>;
    };

    // Sin sesión: no se puede crear la sala (regla request.auth != null) → pedir login.
    if (!user) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', textAlign: 'center', padding: 24, fontFamily: "'Segoe UI', sans-serif" }}>
                <Radio size={44} color="#4f46e5" style={{ marginBottom: 12 }} />
                <h2 style={{ color: '#1e293b', margin: '0 0 6px' }}>Control de Aula</h2>
                <p style={{ color: '#64748b', maxWidth: 380, margin: '0 0 20px' }}>
                    Para crear una sala necesitas iniciar sesión como profesor. Tus alumnos entrarán sin cuenta con el código o el QR.
                </p>
                <button onClick={iniciarSesion}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: '#4f46e5', color: 'white', border: 'none', borderRadius: 12, padding: '13px 26px', cursor: 'pointer', fontWeight: 800, fontSize: '1rem' }}>
                    <LogIn size={18} /> Iniciar sesión con Google
                </button>
                {loginError && <div style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: 12 }}>{loginError}</div>}
            </div>
        );
    }

    return (
        <div style={{ fontFamily: "'Segoe UI', sans-serif" }}>
            {/* Encabezado sala */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg,#1e3a8a,#4f46e5)', color: 'white', borderRadius: 16, padding: '16px 20px', marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <Radio size={30} />
                    <div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.85 }}>Código de sala</div>
                        <div style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: 4 }}>{codigo}</div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
                            <code style={{ background: 'rgba(255,255,255,0.15)', padding: '4px 8px', borderRadius: 8, fontSize: '0.78rem' }}>{joinUrl}</code>
                            <button onClick={() => navigator.clipboard?.writeText(joinUrl)} style={{ background: 'white', color: '#4f46e5', border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <LinkIcon size={14} /> Copiar
                            </button>
                        </div>
                    </div>
                </div>
                {/* QR de acceso: los alumnos escanean para entrar directamente */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div style={{ background: 'white', padding: 8, borderRadius: 12, boxShadow: '0 4px 14px rgba(0,0,0,0.25)' }}>
                        <img
                            src={qrSrc}
                            alt={`Código QR para unirse a la sala ${codigo}`}
                            width={148} height={148}
                            style={{ display: 'block', width: 148, height: 148 }}
                        />
                    </div>
                    <span style={{ fontSize: '0.78rem', opacity: 0.9, display: 'flex', alignItems: 'center', gap: 4 }}>
                        📷 Escanea para entrar
                    </span>
                    <button
                        onClick={() => setQrGrande(true)}
                        style={{ background: 'rgba(255,255,255,0.18)', border: 'none', color: 'white', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>
                        🔍 Ampliar
                    </button>
                </div>
            </div>

            {/* QR ampliado para proyectar */}
            {qrGrande && (
                <div onClick={() => setQrGrande(false)}
                    style={{ position: 'fixed', inset: 0, zIndex: 10002, background: 'rgba(15,23,42,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, cursor: 'pointer', padding: 20 }}>
                    <div style={{ fontSize: '1.2rem', color: 'white', fontWeight: 700 }}>Únete a la sala</div>
                    <div style={{ fontSize: '3rem', color: 'white', fontWeight: 900, letterSpacing: 8 }}>{codigo}</div>
                    <div style={{ background: 'white', padding: 18, borderRadius: 18 }}>
                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(joinUrl)}&bgcolor=ffffff&color=1e3a8a&margin=10`}
                            alt="Código QR grande" style={{ display: 'block', width: 'min(70vh, 78vw)', height: 'min(70vh, 78vw)' }} />
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.95rem' }}>{joinUrl}</div>
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem' }}>(toca para cerrar)</div>
                </div>
            )}

            {/* Resumen */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
                <ResumenCard color="#2563eb" label="Conectados" valor={conectados.length} />
                <ResumenCard color="#f59e0b" label="Incidencias de foco" valor={totalIncidencias} icon={<Bell size={16} />} />
                <ResumenCard color="#059669" label="Estado sala" valor={salaAbierta ? 'Abierta' : '…'} />
                {game && <ResumenCard color="#7c3aed" label="Partida" valor={`${game.recursoTitulo} · ${game.modo}`} />}
            </div>

            {/* ── ZONA DE PARTIDA PUNTUABLE ── */}
            {game ? (
                <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 14, padding: 16, marginBottom: 18 }}>
                    {game.state === 'FIN' ? (
                        <>
                            <h3 style={{ margin: '0 0 12px', color: '#5b21b6', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Trophy size={22} color="#f59e0b" /> Ranking — {game.recursoTitulo}
                            </h3>
                            <RankingList ranking={game.ranking || []} />
                            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                                <button onClick={elegirOtroJuego} style={btnStyle('#7c3aed')}>🎮 Elegir otro juego</button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                                <h3 style={{ margin: 0, color: '#5b21b6', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Gamepad2 size={22} /> Partida en curso: {game.recursoTitulo}
                                </h3>
                                <span style={{ fontSize: '0.85rem', color: '#6d28d9', fontWeight: 700 }}>
                                    {jugadoresPartida.length}/{conectados.length} han terminado
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                                {conectados.length === 0 && <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No hay alumnos conectados.</div>}
                                {conectados.map((a) => {
                                    const s = a.lastScore?.launchId === game.launchId ? a.lastScore.puntuacion : null;
                                    return (
                                        <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', background: 'white', borderRadius: 8, padding: '7px 12px', fontSize: '0.9rem' }}>
                                            <span style={{ fontWeight: 600, color: '#334155' }}>{a.name || 'Alumno'}</span>
                                            <span style={{ fontWeight: 800, color: s == null ? '#94a3b8' : '#16a34a' }}>{s == null ? '⏳ jugando…' : `${s} pts`}</span>
                                        </div>
                                    );
                                })}
                            </div>
                            <button onClick={terminarPartida} style={btnStyle('#dc2626')}>🏁 Terminar partida y ver ranking</button>
                        </>
                    )}
                </div>
            ) : (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, marginBottom: 18 }}>
                    <h3 style={{ margin: '0 0 12px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Gamepad2 size={20} color="#7c3aed" /> Lanzar partida puntuable
                    </h3>
                    {cargandoRec ? (
                        <div style={{ color: '#94a3b8' }}>Cargando tus recursos…</div>
                    ) : recursos.length === 0 ? (
                        <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                            No tienes recursos de Burbujas, Pasapalabra, AparejaDOS o Wordle. Créalos desde tu panel docente.
                        </div>
                    ) : (
                        <>
                            <label style={lblStyle}>1. Elige un recurso</label>
                            <select value={recursoSel?.id || ''} onChange={(e) => { const r = recursos.find((x) => x.id === e.target.value); if (r) elegirRecurso(r); }} style={selStyle}>
                                <option value="" disabled>— Selecciona —</option>
                                {recursos.map((r) => <option key={r.id} value={r.id}>{r.titulo} ({r.tipoJuego})</option>)}
                            </select>

                            {recursoSel && (
                                <>
                                    <label style={lblStyleTop}>2. Modo de juego</label>
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        {modosDisponibles.map((m) => (
                                            <button key={m.modo} onClick={() => setModoSel(m.modo)}
                                                style={{ ...chipStyle, ...(modoSel === m.modo ? chipActive : {}) }}>
                                                <span style={{ fontSize: 18 }}>{m.emoji}</span> {m.label}
                                            </button>
                                        ))}
                                    </div>

                                    {!MODOS_SIN_HOJA.has(modoSel) && (recursoSel.hojas || []).length > 0 && (
                                        <>
                                            <label style={lblStyleTop}>3. Hoja / nivel</label>
                                            <select value={hojaSel} onChange={(e) => setHojaSel(e.target.value)} style={selStyle}>
                                                {(recursoSel.hojas || []).map((h, i) => <option key={i} value={h.nombreHoja}>{h.nombreHoja}</option>)}
                                            </select>
                                        </>
                                    )}

                                    <label style={lblStyleTop}>{MODOS_SIN_HOJA.has(modoSel) ? '3' : '4'}. Tiempo por partida</label>
                                    <select value={tiempoSel} onChange={(e) => setTiempoSel(Number(e.target.value))} style={selStyle}>
                                        {[30, 60, 90, 120, 180].map((t) => <option key={t} value={t}>{t} segundos</option>)}
                                    </select>

                                    <button onClick={lanzarPartida} style={{ ...btnStyle('#7c3aed'), marginTop: 14 }}>
                                        <Rocket size={16} /> Lanzar a los {conectados.length} dispositivos
                                    </button>
                                </>
                            )}
                        </>
                    )}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px,100%),1fr))', gap: 18 }}>
                {/* Lista de alumnos */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: 16 }}>
                    <h3 style={{ margin: '0 0 12px', color: '#1e293b' }}>Alumnos en la sala ({alumnos.length})</h3>
                    {alumnos.length === 0 ? (
                        <div style={{ color: '#94a3b8', textAlign: 'center', padding: '30px 0', fontSize: '0.9rem' }}>
                            Esperando alumnos… Comparte el código <b>{codigo}</b>.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
                            {alumnos.map((a) => {
                                const est = estadoEfectivo(a);
                                return (
                                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: 'white', border: `1px solid ${est === ESTADO.DESENFOCADO ? '#fbbf24' : '#e2e8f0'}`, borderRadius: 10, padding: '9px 12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                            <span style={{ fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name || 'Alumno'}</span>
                                            {(a.focusLostCount || 0) > 0 && (
                                                <span title="Veces que ha perdido el foco" style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 20, padding: '1px 8px', fontSize: '0.72rem', fontWeight: 800 }}>×{a.focusLostCount}</span>
                                            )}
                                        </div>
                                        {badge(est)}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Lanzador de actividades por materia (sin ranking) */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: 16 }}>
                    <h3 style={{ margin: '0 0 12px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Rocket size={20} color="#0ea5e9" /> Actividades por materia
                    </h3>
                    {room?.currentRoute && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: '#e0f2fe', borderRadius: 10, padding: '8px 12px', marginBottom: 12 }}>
                            <span style={{ fontSize: '0.85rem', color: '#0369a1', fontWeight: 700 }}>▶ {room.currentLabel}</span>
                            <button onClick={detenerWeb} style={{ background: '#0ea5e9', color: 'white', border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>Detener</button>
                        </div>
                    )}
                    {[...new Set(CATALOGO_JUEGOS.map((j) => j.materia))].map((mat) => (
                        <div key={mat} style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>{mat}</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 8 }}>
                                {CATALOGO_JUEGOS.filter((j) => j.materia === mat).map((j) => (
                                    <button key={j.url} onClick={() => lanzarWeb(j.url, j.label)}
                                        style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '9px 8px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ fontSize: 18 }}>{j.emoji}</span>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', lineHeight: 1.2 }}>{j.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                    <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: 10, marginTop: 4 }}>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: 6 }}>
                            Lanza cualquier recurso de tu biblioteca por su deep-link (<code>/?r=IDRECURSO</code>) — sirve para juegos de cualquier materia:
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <input value={urlManual} onChange={(e) => setUrlManual(e.target.value)} placeholder="/?r=abc123 o https://…"
                                style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.85rem' }} />
                            <button onClick={() => { if (urlManual.trim()) { lanzarWeb(urlManual.trim(), 'Actividad'); setUrlManual(''); } }}
                                style={{ background: '#0ea5e9', color: 'white', border: 'none', borderRadius: 8, padding: '0 14px', cursor: 'pointer', fontWeight: 700 }}>Lanzar</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Toasts */}
            <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', gap: 8, zIndex: 10001, alignItems: 'center' }}>
                {toasts.map((t) => (
                    <div key={t.id} style={{ background: '#7f1d1d', color: 'white', padding: '10px 18px', borderRadius: 12, boxShadow: '0 6px 20px rgba(0,0,0,0.3)', fontSize: '0.9rem', fontWeight: 600, animation: 'ca-fade .25s ease' }}>{t.msg}</div>
                ))}
            </div>
            <style>{`@keyframes ca-fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
        </div>
    );
}

// ── estilos reutilizables ──
const selStyle = { width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' };
const lblStyle = { display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 5 };
const lblStyleTop = { display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', margin: '12px 0 6px' };
const chipStyle = { display: 'flex', alignItems: 'center', gap: 6, background: 'white', border: '1px solid #cbd5e1', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', fontWeight: 700, color: '#334155', fontSize: '0.85rem' };
const chipActive = { background: '#7c3aed', color: 'white', borderColor: '#7c3aed' };
const btnStyle = (bg) => ({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: bg, color: 'white', border: 'none', borderRadius: 12, padding: '12px 20px', cursor: 'pointer', fontWeight: 800, fontSize: '0.95rem' });

function ResumenCard({ color, label, valor, icon }) {
    return (
        <div style={{ background: 'white', border: `1px solid #e2e8f0`, borderLeft: `4px solid ${color}`, borderRadius: 12, padding: '10px 16px', minWidth: 130, flex: '1 1 auto' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>{icon}{label}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color }}>{valor}</div>
        </div>
    );
}

function RankingList({ ranking, miNombre }) {
    const medalla = (i) => ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
    if (!ranking.length) return <div style={{ color: '#94a3b8', padding: '10px 0' }}>Nadie ha enviado puntuación.</div>;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ranking.map((r, i) => {
                const yo = miNombre && r.name === miNombre;
                return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: yo ? '#ede9fe' : 'white', border: `1px solid ${i === 0 ? '#f59e0b' : '#e5e7eb'}`, borderRadius: 10, padding: '9px 14px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, color: '#1e293b' }}>
                            <span style={{ fontSize: '1.1rem', minWidth: 26 }}>{medalla(i)}</span> {r.name}{yo ? ' (tú)' : ''}
                        </span>
                        <span style={{ fontWeight: 800, color: '#7c3aed' }}>{r.puntuacion} pts</span>
                    </div>
                );
            })}
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// VISTA DEL ALUMNO
// ═════════════════════════════════════════════════════════════════════════════
export function StudentJoinView({ codigoInicial = '', onExit }) {
    const [codigo, setCodigo] = useState((codigoInicial || '').toUpperCase());
    const [nombre, setNombre] = useState(() => localStorage.getItem('control_aula_nombre') || '');
    const [entrado, setEntrado] = useState(false);
    const [error, setError] = useState('');
    const [comprobando, setComprobando] = useState(false);

    const [recursoData, setRecursoData] = useState(null);   // recurso del juego lanzado
    const [finishedLaunch, setFinishedLaunch] = useState(null); // launchId ya jugado por mí

    const studentId = useRef(
        localStorage.getItem('control_aula_sid') ||
        (() => { const id = 'stu_' + Math.random().toString(36).slice(2, 10); localStorage.setItem('control_aula_sid', id); return id; })()
    ).current;

    const { estado, focusLostCount, room, connected } = usePresenceRoom({
        roomCode: entrado ? codigo : null,
        studentId,
        name: nombre,
        enabled: entrado,
    });

    const game = room?.game || null;

    // Cargar el recurso cuando cambia la partida lanzada.
    useEffect(() => {
        if (!game?.recursoId) { setRecursoData(null); return; }
        let vivo = true;
        getDoc(doc(db, 'resources', game.recursoId))
            .then((snap) => { if (vivo && snap.exists()) setRecursoData({ id: snap.id, ...snap.data() }); })
            .catch(() => {});
        return () => { vivo = false; };
    }, [game?.recursoId, game?.launchId]);

    const enviarPuntuacion = async (puntuacion) => {
        if (!game) return;
        setFinishedLaunch(game.launchId);
        try {
            await setDoc(doc(db, 'control_rooms', codigo, 'students', studentId),
                { lastScore: { launchId: game.launchId, puntuacion: Number(puntuacion) || 0, at: Date.now() } },
                { merge: true });
        } catch (e) { console.error(e); }
    };

    const entrar = async () => {
        setError('');
        if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
        if (!codigo.trim()) { setError('Escribe el código de la sala.'); return; }
        setComprobando(true);
        try {
            const snap = await getDoc(doc(db, 'control_rooms', codigo.trim().toUpperCase()));
            if (!snap.exists() || snap.data().active === false) {
                setError('La sala no existe o está cerrada.'); setComprobando(false); return;
            }
            localStorage.setItem('control_aula_nombre', nombre.trim());
            setCodigo(codigo.trim().toUpperCase());
            setEntrado(true);
        } catch (e) { setError('Error de conexión. Inténtalo de nuevo.'); }
        setComprobando(false);
    };

    // ── Formulario de entrada ──
    if (!entrado) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg,#0f172a,#1e3a8a)', padding: 20, fontFamily: "'Segoe UI', sans-serif" }}>
                <div style={{ background: 'white', borderRadius: 20, padding: 30, width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
                    <div style={{ textAlign: 'center', marginBottom: 20 }}>
                        <div style={{ fontSize: 44 }}>🎓</div>
                        <h1 style={{ margin: '6px 0', color: '#1e293b', fontSize: '1.5rem' }}>Unirse a la clase</h1>
                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>Entra con el código que te dé tu profe.</p>
                    </div>
                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>Tu nombre</label>
                    <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Lucía"
                        style={{ width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid #cbd5e1', margin: '5px 0 14px', boxSizing: 'border-box', fontSize: '1rem' }} />
                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>Código de sala</label>
                    <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="ABC12" maxLength={6}
                        onKeyDown={(e) => e.key === 'Enter' && entrar()}
                        style={{ width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid #cbd5e1', margin: '5px 0 14px', boxSizing: 'border-box', fontSize: '1.3rem', letterSpacing: 4, textAlign: 'center', fontWeight: 800 }} />
                    {error && <div style={{ color: '#dc2626', fontSize: '0.85rem', marginBottom: 10 }}>{error}</div>}
                    <button onClick={entrar} disabled={comprobando}
                        style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: '#4f46e5', color: 'white', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <LogIn size={18} /> {comprobando ? 'Entrando…' : 'Entrar'}
                    </button>
                    {onExit && <button onClick={onExit} style={{ width: '100%', marginTop: 10, background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem' }}>Cancelar</button>}
                </div>
            </div>
        );
    }

    // ── Sala activa ──
    const desenfocado = estado === ESTADO.DESENFOCADO;
    const jugandoAhora = game && game.state === 'PLAYING' && finishedLaunch !== game.launchId;
    const recursoListo = recursoData && game && recursoData.id === game.recursoId;

    return (
        <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', flexDirection: 'column', fontFamily: "'Segoe UI', sans-serif" }}>
            {/* Barra superior */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 14px', background: 'rgba(255,255,255,0.06)', color: 'white', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 700 }}>👋 {nombre}</span>
                    <span style={{ fontSize: '0.78rem', opacity: 0.8 }}>Sala {codigo}</span>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: connected ? '#22c55e' : '#f59e0b', display: 'inline-block' }} title={connected ? 'Conectado' : 'Conectando…'} />
                    {focusLostCount > 0 && <span style={{ fontSize: '0.75rem', color: '#fca5a5' }}>Salidas: {focusLostCount}</span>}
                </div>
                <button onClick={() => { setEntrado(false); onExit?.(); }} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: '0.82rem' }}>Salir</button>
            </div>

            {/* Contenido */}
            <div style={{ flex: 1, position: 'relative' }}>
                {/* 1) Partida puntuable en curso y aún no la he terminado → jugar */}
                {jugandoAhora ? (
                    recursoListo ? (
                        <div style={{ position: 'absolute', inset: 0, overflow: 'auto' }}>
                            <JuegoOlimpicoRunner
                                key={game.launchId}
                                modo={game.modo}
                                recurso={recursoData}
                                hoja={game.hoja}
                                tiempo={game.tiempo}
                                usuario={{ displayName: nombre, uid: studentId }}
                                onFinish={enviarPuntuacion}
                                onExit={() => enviarPuntuacion(0)}
                            />
                        </div>
                    ) : (
                        <CentroMsg emoji="🎮" titulo="Preparando el juego…" sub={game.recursoTitulo} />
                    )
                /* 2) Ranking final */
                ) : game && game.state === 'FIN' ? (
                    <div style={{ position: 'absolute', inset: 0, overflow: 'auto', padding: 20, color: 'white' }}>
                        <h2 style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                            <Trophy color="#f59e0b" /> Ranking — {game.recursoTitulo}
                        </h2>
                        <div style={{ maxWidth: 460, margin: '16px auto' }}>
                            <RankingList ranking={game.ranking || []} miNombre={nombre} />
                        </div>
                        <p style={{ textAlign: 'center', opacity: 0.7 }}>Espera a que tu profe elija el siguiente juego…</p>
                    </div>
                /* 3) Ya terminé mi partida, esperando al resto */
                ) : game && game.state === 'PLAYING' && finishedLaunch === game.launchId ? (
                    <CentroMsg emoji="✅" titulo="¡Has terminado!" sub="Esperando a que acabe el resto de la clase…" />
                /* 4) Actividad web (iframe) */
                ) : room?.currentRoute ? (
                    <iframe key={room.currentRoute} title="actividad" src={room.currentRoute}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} />
                /* 5) Sala de espera */
                ) : (
                    <CentroMsg emoji="⏳" titulo="¡Estás dentro!" sub="Espera a que tu profe lance una actividad." />
                )}

                {desenfocado && (
                    <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', background: '#b45309', color: 'white', padding: '10px 20px', borderRadius: 30, fontWeight: 700, boxShadow: '0 6px 20px rgba(0,0,0,0.35)', zIndex: 50, display: 'flex', alignItems: 'center', gap: 8 }}>
                        👀 ¡Vuelve a la pestaña de clase!
                    </div>
                )}
            </div>
        </div>
    );
}

function CentroMsg({ emoji, titulo, sub }) {
    return (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', textAlign: 'center', padding: 20 }}>
            <div style={{ fontSize: 60, marginBottom: 16 }}>{emoji}</div>
            <h2 style={{ margin: 0 }}>{titulo}</h2>
            {sub && <p style={{ opacity: 0.8 }}>{sub}</p>}
        </div>
    );
}

export default StudentJoinView;
