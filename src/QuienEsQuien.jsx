// src/QuienEsQuien.jsx
// Herramienta "¿Quién es quién?" — dinámica para conocer a los alumnos.
//  Fase 1: formulario del alumno -> Firestore (colección clase_alumnos)
//  Fase 2: juego de "unir con líneas" por rondas (una por categoría)
//  Fase 3: panel del profesor (tabla + gestión de grupos + borrar todo)
//
// Ámbito de datos: cada registro lleva codigoProfesor + grupo.
//   - El profesor (panel) crea los grupos seleccionables -> quien_es_quien_config/{codigo}
//   - El alumno introduce el código y elige su grupo al rellenar el formulario.
//
// Compatible ratón + táctil (pointer events + elementFromPoint) y también
// modo "tocar nombre, tocar respuesta" para máxima accesibilidad.

import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { db, auth } from './firebase';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import {
    collection, addDoc, getDocs, deleteDoc, doc, setDoc, getDoc,
    onSnapshot, query, where, serverTimestamp,
} from 'firebase/firestore';
import { guardarRegistroLocal } from './utils/registrosLocales';

/* ============================ CONSTANTES ============================ */

const DEPORTES = [
    'Fútbol', 'Baloncesto', 'Tenis', 'Natación', 'Atletismo', 'Voleibol',
    'Balonmano', 'Ciclismo', 'Pádel', 'Gimnasia', 'Judo/Kárate', 'Danza/Baile',
    'Escalada', 'Patinaje', 'Rugby', 'Béisbol', 'Ninguno', 'Otro',
];

// Tipos de pregunta para los tests personalizados.
const TIPOS_PREGUNTA = [
    { tipo: 'corta', label: 'Respuesta corta', emoji: '✏️' },
    { tipo: 'cerrada', label: 'Opciones (cerrada)', emoji: '🔘' },
    { tipo: 'numerica', label: 'Numérica', emoji: '🔢' },
    { tipo: 'dibujo', label: 'Dibujo (lienzo)', emoji: '🎨' },
];
// Emojis sugeridos para el selector del editor.
const EMOJIS_SUGERIDOS = ['⚽', '🍕', '✈️', '🎬', '💬', '👨‍👩‍👧‍👦', '🎨', '🎵', '📚', '🐶', '🌍', '⭐', '🎮', '🏠', '❤️', '🔢', '🎂', '🚀', '🌈', '🍦'];

// Test por defecto: las preguntas clásicas de ¿Quién es quién?
const TEST_DEFAULT = {
    id: 'default',
    titulo: '¿Quién es quién?',
    preguntas: [
        { id: 'hermanos', tipo: 'numerica', texto: 'Nº de hermanos', emoji: '👨‍👩‍👧‍👦' },
        { id: 'deporte', tipo: 'cerrada', texto: 'Deporte favorito', emoji: '⚽', opciones: DEPORTES.filter((d) => d !== 'Otro'), permitirOtro: true },
        { id: 'comida', tipo: 'corta', texto: 'Comida favorita', emoji: '🍕' },
        { id: 'lugar', tipo: 'corta', texto: 'Lugar más lejano visitado', emoji: '✈️' },
        { id: 'pelicula', tipo: 'corta', texto: 'Película/Serie favorita', emoji: '🎬' },
        { id: 'frase', tipo: 'corta', texto: 'Una frase que me define', emoji: '💬' },
        { id: 'dibujo', tipo: 'dibujo', texto: 'Dibuja lo que quieras', emoji: '🎨' },
    ],
};

const norm = (v) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const upper = (v) => String(v ?? '').trim().toUpperCase();
const rid = () => Math.random().toString(36).slice(2, 10);
// Nombre completo a partir del registro (compatible con datos antiguos sin apellidos).
const nombreCompleto = (a) => `${a?.nombre || ''} ${a?.apellidos || ''}`.trim();
// Valor de la respuesta de un alumno a una pregunta (compat: datos antiguos con campos sueltos).
const valorResp = (a, pid) => {
    const v = a?.respuestas ? a.respuestas[pid] : undefined;
    return v != null ? v : a?.[pid];
};
const emojiPregunta = (p) => p?.emoji || (TIPOS_PREGUNTA.find((t) => t.tipo === p?.tipo)?.emoji) || '❓';
// testId de un alumno (docs antiguos sin testId → 'default').
const testIdDe = (a) => a?.testId || 'default';
// Carga los tests personalizados de un código + el test por defecto.
const cargarTests = async (cod) => {
    try {
        const snap = await getDocs(query(collection(db, 'quien_es_quien_tests'), where('codigoProfesor', '==', cod)));
        const custom = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((t) => Array.isArray(t.preguntas));
        return [TEST_DEFAULT, ...custom];
    } catch {
        return [TEST_DEFAULT];
    }
};

function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// Trocea en grupos de n; si el último queda con <2, lo fusiona con el anterior.
function trocear(arr, n) {
    if (!n || arr.length <= n) return [arr];
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    if (out.length > 1 && out[out.length - 1].length < 2) {
        const ult = out.pop();
        out[out.length - 1] = out[out.length - 1].concat(ult);
    }
    return out;
}

/* ---- Sonidos (Web Audio, sin ficheros) ---- */
let _actx = null;
const getACtx = () => {
    if (typeof window === 'undefined') return null;
    if (!_actx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) _actx = new AC();
    }
    if (_actx && _actx.state === 'suspended') _actx.resume();
    return _actx;
};
const beep = (freq, start, dur, type = 'sine', vol = 0.22) => {
    const ctx = getACtx();
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    o.connect(g); g.connect(ctx.destination);
    const t = ctx.currentTime + start;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.03);
};
const sonidoAcierto = () => { beep(660, 0, 0.15); beep(880, 0.12, 0.18); beep(1175, 0.26, 0.28); };
const sonidoFallo = () => { beep(210, 0, 0.22, 'square', 0.18); beep(150, 0.16, 0.3, 'square', 0.18); };

/* ---- Estilos de los efectos (corazones / rayos) ---- */
const ensureFxStyles = () => {
    if (typeof document === 'undefined' || document.getElementById('qeq-fx-styles')) return;
    const s = document.createElement('style');
    s.id = 'qeq-fx-styles';
    s.textContent = `
@keyframes qeqRise { 0%{transform:translateY(0) scale(.5) rotate(0);opacity:0} 15%{opacity:1} 100%{transform:translateY(-160px) scale(1.25) rotate(var(--r,0deg));opacity:0} }
@keyframes qeqBolt { 0%{transform:translateY(-24px) scale(.5);opacity:0} 20%{opacity:1} 55%{opacity:1} 100%{transform:translateY(46px) scale(1.35);opacity:0} }
@keyframes qeqPop { 0%{transform:scale(.4);opacity:0} 40%{transform:scale(1.15);opacity:1} 100%{transform:scale(1);opacity:1} }`;
    document.head.appendChild(s);
};

/* ============================ ESTILOS ============================ */

const COL = {
    bg1: '#4f8bf9', bg2: '#7c3aed',
    amarillo: '#ffd166', verde: '#06d6a0', rojo: '#ef476f',
    azul: '#118ab2', oscuro: '#073b4c',
};

const S = {
    wrap: {
        position: 'fixed', inset: 0, zIndex: 9999, overflowY: 'auto',
        background: `linear-gradient(135deg, ${COL.bg1} 0%, ${COL.bg2} 100%)`,
        fontFamily: "'Comic Sans MS', 'Segoe UI', sans-serif", color: COL.oscuro,
        padding: '0 0 60px 0',
    },
    header: {
        display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
        position: 'sticky', top: 0, zIndex: 20,
        background: 'rgba(7,59,76,0.25)', backdropFilter: 'blur(6px)',
    },
    back: {
        background: '#fff', border: 'none', borderRadius: 12, padding: '8px 14px',
        cursor: 'pointer', fontWeight: 800, fontSize: '0.95rem', color: COL.oscuro,
        boxShadow: '0 3px 0 rgba(0,0,0,0.2)',
    },
    title: { color: '#fff', margin: 0, fontSize: '1.4rem', textShadow: '0 2px 4px rgba(0,0,0,0.35)' },
    panel: {
        background: '#fff', borderRadius: 24, padding: '26px', maxWidth: 640,
        margin: '26px auto', boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
    },
    label: { display: 'block', fontWeight: 800, margin: '14px 0 6px', color: COL.azul },
    input: {
        width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 14,
        border: '2px solid #dbe4ec', fontSize: '1rem', fontFamily: 'inherit', outline: 'none',
    },
    btn: (bg) => ({
        background: bg, color: '#fff', border: 'none', borderRadius: 16,
        padding: '14px 22px', fontSize: '1.05rem', fontWeight: 800, cursor: 'pointer',
        boxShadow: `0 4px 0 rgba(0,0,0,0.25)`, fontFamily: 'inherit',
    }),
    card: (bg) => ({
        background: bg, color: '#fff', borderRadius: 22, padding: '26px 20px',
        cursor: 'pointer', textAlign: 'center', boxShadow: '0 8px 22px rgba(0,0,0,0.25)',
        transition: 'transform 0.15s', border: '4px solid rgba(255,255,255,0.35)',
    }),
};

/* ============================ COMPONENTE ============================ */

export default function QuienEsQuien({ usuario, onExit }) {
    // Deep-link desde el QR: ?code=CODIGO&test=ID → abre el formulario directo.
    const [dl] = useState(() => {
        const p = new URLSearchParams(window.location.search);
        return { code: p.get('code'), test: p.get('test') };
    });
    const [vista, setVista] = useState(dl.code ? 'FORM' : 'MENU'); // MENU | FORM | PLAY | PROFE

    return (
        <div style={S.wrap}>
            <div style={S.header}>
                <button style={S.back} onClick={() => (vista === 'MENU' ? onExit?.() : setVista('MENU'))}>
                    ← {vista === 'MENU' ? 'Salir' : 'Menú'}
                </button>
                <h1 style={S.title}>🕵️ ¿Quién es quién?</h1>
            </div>

            {vista === 'MENU' && <Menu setVista={setVista} />}
            {vista === 'FORM' && <Formulario initCode={dl.code} initTestId={dl.test} />}
            {vista === 'PLAY' && <Juego />}
            {vista === 'PROFE' && <PanelProfesor usuario={usuario} />}
        </div>
    );
}

/* ------------------------------- MENÚ ------------------------------- */

function Menu({ setVista }) {
    const cards = [
        { v: 'FORM', bg: COL.verde, emoji: '✍️', t: 'Soy alumno', d: 'Rellena tus datos para el juego.' },
        { v: 'PLAY', bg: COL.amarillo, emoji: '🎮', t: 'Jugar', d: 'Adivina quién dijo cada cosa uniendo con líneas.' },
        { v: 'PROFE', bg: COL.azul, emoji: '👨‍🏫', t: 'Panel del profesor', d: 'Ver datos, crear grupos y gestionar.' },
    ];
    return (
        <div style={{ ...S.panel, background: 'transparent', boxShadow: 'none', maxWidth: 760 }}>
            <p style={{ color: '#fff', textAlign: 'center', fontSize: '1.15rem', marginTop: 0, textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                ¡Conoce mejor a tus compañeros! Rellena tus datos y luego juega a adivinar quién es quién.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginTop: 24 }}>
                {cards.map((c) => (
                    <div key={c.v}
                        style={{ ...S.card(c.bg), color: c.bg === COL.amarillo ? COL.oscuro : '#fff' }}
                        onClick={() => setVista(c.v)}
                        onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-6px)')}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}>
                        <div style={{ fontSize: '3rem' }}>{c.emoji}</div>
                        <h2 style={{ margin: '8px 0 6px' }}>{c.t}</h2>
                        <p style={{ margin: 0, opacity: 0.9, fontSize: '0.95rem' }}>{c.d}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ============================ FASE 1: FORMULARIO ============================ */

// Lienzo de dibujo (ratón + táctil). Llama onChange(base64) al soltar y al borrar.
function LienzoDibujo({ onChange }) {
    const canvasRef = useRef(null);
    const dibujando = useRef(false);
    const [color, setColor] = useState('#073b4c');
    const COLORES = ['#073b4c', '#ef476f', '#118ab2', '#06d6a0', '#ffd166', '#7c3aed', '#000000', 'ERASER'];

    const fondoBlanco = useCallback(() => {
        const c = canvasRef.current; if (!c) return;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, c.width, c.height);
    }, []);

    useEffect(() => { fondoBlanco(); }, [fondoBlanco]);

    const pos = (e) => {
        const c = canvasRef.current;
        const r = c.getBoundingClientRect();
        return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
    };
    const start = (e) => {
        e.preventDefault();
        dibujando.current = true;
        const ctx = canvasRef.current.getContext('2d');
        const p = pos(e);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
    };
    const move = (e) => {
        if (!dibujando.current) return;
        e.preventDefault();
        const ctx = canvasRef.current.getContext('2d');
        const p = pos(e);
        ctx.strokeStyle = color === 'ERASER' ? '#ffffff' : color;
        ctx.lineWidth = color === 'ERASER' ? 22 : 4;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
    };
    const end = () => {
        if (!dibujando.current) return;
        dibujando.current = false;
        onChange(canvasRef.current.toDataURL('image/jpeg', 0.5));
    };
    const borrar = () => { fondoBlanco(); onChange(''); };

    return (
        <div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
                {COLORES.map((c) => (
                    <button key={c} type="button" onClick={() => setColor(c)} title={c === 'ERASER' ? 'Borrador' : c}
                        style={{
                            width: 28, height: 28, borderRadius: '50%', cursor: 'pointer',
                            border: color === c ? '3px solid #073b4c' : '2px solid #cbd5e1',
                            background: c === 'ERASER' ? '#fff' : c,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                        }}>{c === 'ERASER' ? '🧽' : ''}</button>
                ))}
                <button type="button" onClick={borrar} style={{ ...S.btn('#94a3b8'), padding: '6px 12px', marginLeft: 'auto' }}>🗑️ Limpiar</button>
            </div>
            <canvas ref={canvasRef} width={320} height={240}
                style={{ width: '100%', maxWidth: 360, aspectRatio: '320 / 240', background: '#fff', border: '3px solid #cbd5e1', borderRadius: 14, touchAction: 'none', cursor: 'crosshair' }}
                onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end} />
        </div>
    );
}

// Campo de una pregunta (según su tipo) para el formulario del alumno.
function PreguntaCampo({ p, valor, otro, onValor, onOtro }) {
    if (p.tipo === 'numerica') {
        return <input style={S.input} type="number" value={valor} onChange={(e) => onValor(e.target.value)} placeholder="0" />;
    }
    if (p.tipo === 'dibujo') {
        return <LienzoDibujo onChange={onValor} />;
    }
    if (p.tipo === 'cerrada') {
        return (
            <>
                <select style={S.input} value={valor} onChange={(e) => onValor(e.target.value)}>
                    <option value="">— Elige —</option>
                    {(p.opciones || []).map((o) => <option key={o} value={o}>{o}</option>)}
                    {p.permitirOtro && <option value="__OTRO__">Otro…</option>}
                </select>
                {valor === '__OTRO__' && (
                    <input style={{ ...S.input, marginTop: 8 }} value={otro || ''} onChange={(e) => onOtro(e.target.value)} placeholder="¿Cuál?" />
                )}
            </>
        );
    }
    // corta
    return <input style={S.input} value={valor} onChange={(e) => onValor(e.target.value)} placeholder="Escribe tu respuesta" maxLength={140} />;
}

function Formulario({ initCode, initTestId } = {}) {
    const [paso, setPaso] = useState('CODIGO'); // CODIGO | TEST | FORM | OK
    const [codigo, setCodigo] = useState(initCode ? upper(initCode) : '');
    const [grupos, setGrupos] = useState([]);
    const [tests, setTests] = useState([TEST_DEFAULT]);
    const [test, setTest] = useState(null);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState('');

    const [nombre, setNombre] = useState('');
    const [apellidos, setApellidos] = useState('');
    const [grupo, setGrupo] = useState('');
    const [resp, setResp] = useState({});   // { pid: valor }
    const [otros, setOtros] = useState({}); // { pid: texto "Otro" }
    const [ultimoNombre, setUltimoNombre] = useState('');
    const [formKey, setFormKey] = useState(0); // fuerza remontar campos (p.ej. lienzo) al limpiar

    const entrarCon = async (codRaw, preTestId) => {
        const cod = upper(codRaw);
        if (!cod) { setError('Escribe el código de tu profesor.'); return; }
        setCargando(true); setError('');
        try {
            const cfg = await getDoc(doc(db, 'quien_es_quien_config', cod));
            const gs = cfg.exists() && Array.isArray(cfg.data().grupos) ? cfg.data().grupos : [];
            setGrupos(gs);
            setGrupo(gs.length ? gs[0] : '');
            const ts = await cargarTests(cod);
            setTests(ts);
            setCodigo(cod);
            const pre = preTestId && ts.find((t) => t.id === preTestId);
            if (pre) { setTest(pre); setResp({}); setOtros({}); setFormKey((k) => k + 1); setPaso('FORM'); }
            else if (ts.length > 1) { setPaso('TEST'); }
            else { setTest(ts[0]); setPaso('FORM'); }
        } catch {
            setError('No se pudo conectar. Inténtalo de nuevo.');
        } finally {
            setCargando(false);
        }
    };
    const entrar = () => entrarCon(codigo);

    // Deep-link: si viene código en la URL (QR), entra directo al test.
    useEffect(() => {
        if (initCode) entrarCon(initCode, initTestId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const elegirTest = (t) => { setTest(t); setResp({}); setOtros({}); setError(''); setFormKey((k) => k + 1); setPaso('FORM'); };

    const limpiar = () => { setNombre(''); setApellidos(''); setResp({}); setOtros({}); setFormKey((k) => k + 1); };

    const enviar = async () => {
        if (!nombre.trim()) { setError('Pon tu nombre.'); return; }
        if (!apellidos.trim()) { setError('Pon tus apellidos.'); return; }
        if (!grupo.trim()) { setError('Indica tu grupo/clase.'); return; }
        const respuestas = {};
        for (const p of test.preguntas) {
            let v = resp[p.id] ?? '';
            if (p.tipo === 'cerrada' && v === '__OTRO__') v = (otros[p.id] || '').trim();
            if (p.tipo === 'numerica') {
                if (v === '' || v === null) { setError(`Responde: ${p.texto}`); return; }
                v = Number(v);
            } else {
                v = String(v).trim();
                if (!v) { setError(`Responde: ${p.texto}`); return; }
            }
            respuestas[p.id] = v;
        }
        setCargando(true); setError('');
        try {
            await addDoc(collection(db, 'clase_alumnos'), {
                codigoProfesor: upper(codigo),
                testId: test.id,
                grupo: grupo.trim(),
                nombre: nombre.trim(),
                apellidos: apellidos.trim(),
                respuestas,
                createdAt: serverTimestamp(),
            });
            setUltimoNombre(`${nombre.trim()} ${apellidos.trim()}`);
            limpiar();
            setPaso('OK');
        } catch {
            setError('No se pudo guardar. Revisa tu conexión.');
        } finally {
            setCargando(false);
        }
    };

    if (paso === 'CODIGO') {
        return (
            <div style={S.panel}>
                <h2 style={{ marginTop: 0, color: COL.verde }}>✍️ Rellena tus datos</h2>
                <p>Introduce el <b>código de tu profesor</b> para empezar.</p>
                <label style={S.label}>Código del profesor</label>
                <input style={{ ...S.input, textTransform: 'uppercase', letterSpacing: 2, fontWeight: 800 }}
                    value={codigo} onChange={(e) => setCodigo(e.target.value)}
                    placeholder="Ej: AB12" onKeyDown={(e) => e.key === 'Enter' && entrar()} />
                {error && <p style={{ color: COL.rojo, fontWeight: 700 }}>{error}</p>}
                <button style={{ ...S.btn(COL.verde), marginTop: 20, width: '100%' }} disabled={cargando} onClick={entrar}>
                    {cargando ? 'Cargando…' : 'Continuar →'}
                </button>
            </div>
        );
    }

    if (paso === 'TEST') {
        return (
            <div style={S.panel}>
                <h2 style={{ marginTop: 0, color: COL.verde }}>📝 Elige el test</h2>
                <p>Tu profesor ha preparado varios tests. Elige cuál vas a rellenar:</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {tests.map((t) => (
                        <button key={t.id} onClick={() => elegirTest(t)}
                            style={{ ...S.btn(COL.azul), width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>{t.titulo}</span>
                            <span style={{ opacity: 0.85, fontSize: '0.85rem' }}>{t.preguntas.length} preguntas →</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    if (paso === 'OK') {
        return (
            <div style={{ ...S.panel, textAlign: 'center' }}>
                <div style={{ fontSize: '4rem' }}>🎉</div>
                <h2 style={{ color: COL.verde }}>¡Datos guardados!</h2>
                <p>Gracias, <b>{ultimoNombre}</b>. Ya formas parte del juego.</p>
                <button style={{ ...S.btn(COL.azul), marginTop: 16 }} onClick={() => { limpiar(); setPaso('FORM'); }}>
                    Añadir otro alumno
                </button>
            </div>
        );
    }

    // paso FORM
    return (
        <div style={S.panel}>
            <h2 style={{ marginTop: 0, color: COL.verde }}>✍️ {test?.titulo || 'Mis datos'}</h2>

            <label style={S.label}>Grupo / clase</label>
            {grupos && grupos.length > 0 ? (
                <select style={S.input} value={grupo} onChange={(e) => setGrupo(e.target.value)}>
                    {grupos.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
            ) : (
                <input style={S.input} value={grupo} onChange={(e) => setGrupo(e.target.value)} placeholder="Ej: 1ºA (pregunta a tu profe)" />
            )}

            <label style={S.label}>Nombre</label>
            <input style={S.input} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Ana" />

            <label style={S.label}>Apellidos</label>
            <input style={S.input} value={apellidos} onChange={(e) => setApellidos(e.target.value)} placeholder="Ej: García López" />

            {(test?.preguntas || []).map((p) => (
                <div key={p.id + '_' + formKey}>
                    <label style={S.label}>{emojiPregunta(p)} {p.texto}</label>
                    <PreguntaCampo p={p} valor={resp[p.id] ?? ''} otro={otros[p.id]}
                        onValor={(v) => setResp((s) => ({ ...s, [p.id]: v }))}
                        onOtro={(v) => setOtros((s) => ({ ...s, [p.id]: v }))} />
                </div>
            ))}

            {error && <p style={{ color: COL.rojo, fontWeight: 700 }}>{error}</p>}
            <button style={{ ...S.btn(COL.verde), marginTop: 20, width: '100%' }} disabled={cargando} onClick={enviar}>
                {cargando ? 'Guardando…' : '💾 Guardar mis datos'}
            </button>
        </div>
    );
}

/* ============================ FASE 2: JUEGO ============================ */

function Juego() {
    const [fase, setFase] = useState('SETUP'); // SETUP | IDENT | JUGANDO | FIN
    const [codigo, setCodigo] = useState('');
    const [grupos, setGrupos] = useState([]);
    const [grupoSel, setGrupoSel] = useState('');
    const [alumnos, setAlumnos] = useState([]);
    const [tests, setTests] = useState([TEST_DEFAULT]);
    const [testSel, setTestSel] = useState('default');
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState('');

    const [rondas, setRondas] = useState([]);   // categorías jugables ya preparadas
    const [ri, setRi] = useState(0);            // índice de ronda
    const [scores, setScores] = useState([]);   // aciertos por ronda

    // Identificación del jugador y envío del resultado
    const [nombreJugador, setNombreJugador] = useState('');
    const [enviado, setEnviado] = useState(null); // null | 'ok' | 'error'

    const cargar = async () => {
        const cod = upper(codigo);
        if (!cod) { setError('Introduce el código del profesor.'); return; }
        setCargando(true); setError('');
        try {
            const cfg = await getDoc(doc(db, 'quien_es_quien_config', cod));
            const gs = cfg.exists() && Array.isArray(cfg.data().grupos) ? cfg.data().grupos : [];
            setGrupos(gs);
            const snap = await getDocs(query(collection(db, 'clase_alumnos'), where('codigoProfesor', '==', cod)));
            const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setAlumnos(lista);
            const ts = await cargarTests(cod);
            setTests(ts);
            // Test por defecto: el primero que tenga alumnos, o 'default'.
            const conAlumnos = ts.find((t) => lista.some((a) => testIdDe(a) === t.id));
            setTestSel((conAlumnos || ts[0]).id);
            // Grupos disponibles: los del profesor o, si no hay, los deducidos de los alumnos.
            const dispo = gs.length ? gs : [...new Set(lista.map((a) => a.grupo).filter(Boolean))];
            setGrupoSel(dispo[0] || '');
            setFase('IDENT');
        } catch {
            setError('No se pudieron cargar los alumnos.');
        } finally {
            setCargando(false);
        }
    };

    const testActivo = tests.find((t) => t.id === testSel) || TEST_DEFAULT;
    const gruposDisponibles = grupos.length ? grupos : [...new Set(alumnos.map((a) => a.grupo).filter(Boolean))];
    const filtrados = alumnos.filter((a) => a.grupo === grupoSel && testIdDe(a) === testSel);

    const empezar = () => {
        if (!nombreJugador.trim()) { setError('Escribe tu nombre.'); return; }
        if (!grupoSel) { setError('Elige tu grupo.'); return; }
        if (filtrados.length < 2) { setError('Se necesitan al menos 2 alumnos en este test y grupo para jugar.'); return; }
        const activas = testActivo.preguntas.filter((p) => filtrados.some((a) => String(valorResp(a, p.id) ?? '').trim() !== ''));
        if (activas.length === 0) { setError('Este grupo no tiene datos suficientes para jugar.'); return; }
        setError('');
        setRondas(activas);
        setScores([]);
        setRi(0);
        setEnviado(null);
        setFase('JUGANDO');
    };

    const enviarResultado = async (total, posibles, s) => {
        try {
            await addDoc(collection(db, 'quien_es_quien_resultados'), {
                codigoProfesor: upper(codigo),
                testId: testSel,
                testTitulo: testActivo.titulo,
                grupo: grupoSel,
                nombre: nombreJugador.trim(),
                aciertos: total,
                posibles,
                porcentaje: posibles ? Math.round((total / posibles) * 100) : 0,
                rondas: rondas.map((r, i) => ({ pid: r.id, label: r.texto, aciertos: s[i] ?? 0, total: filtrados.length })),
                createdAt: serverTimestamp(),
            });
            setEnviado('ok');
        } catch {
            setEnviado('error');
        }
    };

    const finRonda = (aciertos) => {
        const s = [...scores, aciertos];
        setScores(s);
        if (ri + 1 >= rondas.length) {
            const total = s.reduce((a, b) => a + b, 0);
            const posibles = rondas.length * filtrados.length;
            guardarRegistroLocal('QUIEN_ES_QUIEN', {
                titulo: `${testActivo.titulo} · ${grupoSel}`,
                aciertos: total, intentos: posibles,
                porcentaje: posibles ? Math.round((total / posibles) * 100) : 0,
                nombre: nombreJugador.trim(), curso: grupoSel, via: 'juego',
            });
            setFase('FIN');
            enviarResultado(total, posibles, s);
        } else {
            setRi(ri + 1);
        }
    };

    /* ---- SETUP ---- */
    if (fase === 'SETUP') {
        return (
            <div style={S.panel}>
                <h2 style={{ marginTop: 0, color: COL.azul }}>🎮 Jugar</h2>
                <p>Introduce el <b>código del profesor</b> para cargar a los alumnos.</p>
                <input style={{ ...S.input, textTransform: 'uppercase', letterSpacing: 2, fontWeight: 800 }}
                    value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ej: AB12"
                    onKeyDown={(e) => e.key === 'Enter' && cargar()} />
                {error && <p style={{ color: COL.rojo, fontWeight: 700 }}>{error}</p>}
                <button style={{ ...S.btn(COL.azul), marginTop: 18, width: '100%' }} disabled={cargando} onClick={cargar}>
                    {cargando ? 'Cargando…' : 'Cargar alumnos →'}
                </button>
            </div>
        );
    }

    /* ---- IDENT (nombre + grupo del jugador) ---- */
    if (fase === 'IDENT') {
        return (
            <div style={S.panel}>
                <h2 style={{ marginTop: 0, color: COL.azul }}>🙋 ¿Quién juega?</h2>
                <p>Escribe tu <b>nombre</b> y elige tu <b>grupo</b>. Al terminar, tu resultado se enviará a tu profesor.</p>

                {tests.length > 1 && (
                    <>
                        <label style={S.label}>Test</label>
                        <select style={S.input} value={testSel} onChange={(e) => setTestSel(e.target.value)}>
                            {tests.map((t) => (
                                <option key={t.id} value={t.id}>{t.titulo} ({alumnos.filter((a) => testIdDe(a) === t.id).length} alumnos)</option>
                            ))}
                        </select>
                    </>
                )}

                <label style={S.label}>Tu nombre</label>
                <input style={S.input} value={nombreJugador} onChange={(e) => setNombreJugador(e.target.value)}
                    placeholder="Ej: Ana García" />

                <label style={S.label}>Tu grupo</label>
                {gruposDisponibles.length > 0 ? (
                    <select style={S.input} value={grupoSel} onChange={(e) => setGrupoSel(e.target.value)}>
                        {gruposDisponibles.map((g) => (
                            <option key={g} value={g}>{g} ({alumnos.filter((a) => a.grupo === g).length} alumnos)</option>
                        ))}
                    </select>
                ) : (
                    <input style={S.input} value={grupoSel} onChange={(e) => setGrupoSel(e.target.value)} placeholder="Ej: 1ºA" />
                )}

                <p style={{ marginTop: 16, color: '#555' }}>
                    Jugadores en este grupo: <b>{filtrados.length}</b>
                </p>
                {error && <p style={{ color: COL.rojo, fontWeight: 700 }}>{error}</p>}
                <button style={{ ...S.btn(COL.verde), marginTop: 8, width: '100%' }} onClick={empezar}>▶️ ¡Empezar!</button>
            </div>
        );
    }

    /* ---- FIN ---- */
    if (fase === 'FIN') {
        const total = scores.reduce((a, b) => a + b, 0);
        const posibles = rondas.length * filtrados.length;
        const pct = posibles ? Math.round((total / posibles) * 100) : 0;
        return (
            <div style={{ ...S.panel, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                <FinFx pct={pct} />
                <div style={{ fontSize: '4rem' }}>{pct >= 70 ? '🏆' : pct >= 40 ? '👏' : '💪'}</div>
                <h2 style={{ color: COL.azul }}>¡Fin, {nombreJugador.trim()}!</h2>
                <p style={{ fontSize: '1.5rem', fontWeight: 800 }}>{total} / {posibles} aciertos ({pct}%)</p>
                <div style={{ maxWidth: 360, margin: '10px auto', textAlign: 'left' }}>
                    {rondas.map((r, i) => (
                        <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderBottom: '1px solid #eee' }}>
                            <span>{emojiPregunta(r)} {r.texto}</span>
                            <b>{scores[i] ?? 0} / {filtrados.length}</b>
                        </div>
                    ))}
                </div>
                <p style={{ marginTop: 12, fontWeight: 700, color: enviado === 'ok' ? COL.verde : (enviado === 'error' ? COL.rojo : '#777') }}>
                    {enviado === 'ok' && '✅ Resultado enviado a tu profesor.'}
                    {enviado === 'error' && '⚠️ No se pudo enviar el resultado. Revisa la conexión.'}
                    {enviado === null && 'Enviando resultado…'}
                </p>
                <button style={{ ...S.btn(COL.verde), marginTop: 8 }} onClick={() => { setNombreJugador(''); setFase('IDENT'); }}>🔁 Otro jugador</button>
            </div>
        );
    }

    /* ---- JUGANDO ---- */
    return (
        <Ronda
            key={ri}
            pregunta={rondas[ri]}
            alumnos={filtrados}
            ronda={ri + 1}
            totalRondas={rondas.length}
            onFin={finRonda}
        />
    );
}

/* ---- Efecto de la pantalla final (lluvia según %) ---- */
function FinFx({ pct }) {
    const [parts, setParts] = useState([]);
    useEffect(() => {
        ensureFxStyles();
        const bien = pct >= 50;
        if (bien) sonidoAcierto(); else setTimeout(sonidoFallo, 0);
        const corazones = ['❤️', '💚', '💛', '💖', '💗', '⭐', '🎉'];
        const n = bien ? 22 : 8;
        const ps = Array.from({ length: n }, (_, i) => ({
            id: i,
            emoji: bien ? corazones[i % corazones.length] : '⚡',
            type: bien ? 'rise' : 'bolt',
            left: 2 + Math.random() * 94,
            delay: Math.random() * 0.9,
            rot: (Math.random() * 60 - 30) + 'deg',
        }));
        setParts(ps);
        const t = setTimeout(() => setParts([]), 2600);
        return () => clearTimeout(t);
    }, [pct]);
    if (!parts.length) return null;
    return (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 5 }}>
            {parts.map((p) => (
                <span key={p.id} style={{
                    position: 'absolute', left: `${p.left}%`,
                    bottom: p.type === 'rise' ? '8%' : 'auto', top: p.type === 'bolt' ? '4%' : 'auto',
                    fontSize: '1.8rem', willChange: 'transform, opacity',
                    animation: `${p.type === 'rise' ? 'qeqRise' : 'qeqBolt'} 2.2s ease-out ${p.delay}s forwards`,
                    '--r': p.rot,
                }}>{p.emoji}</span>
            ))}
        </div>
    );
}

/* ---------------------- UNA RONDA (trocea en tandas en móvil) ---------------------- */

function Ronda({ pregunta, alumnos, ronda, totalRondas, onFin }) {
    // En móvil se juega en tandas de 6 (con las respuestas solo de esos 6).
    const [chunks] = useState(() => {
        const movil = typeof window !== 'undefined' && window.innerWidth <= 640;
        return trocear(alumnos, movil ? 6 : 0);
    });
    const [bi, setBi] = useState(0);
    const acc = useRef(0);
    const [resumen, setResumen] = useState(null); // resumen entre tandas
    const varias = chunks.length > 1;

    const last = bi >= chunks.length - 1;
    const labelFinal = ronda >= totalRondas ? '🏁 Ver resultado' : 'Siguiente ronda →';
    const botonLabel = !varias ? labelFinal : 'Ver resumen →';

    const onContinuar = (ac) => {
        acc.current += ac;
        if (!varias) { onFin(acc.current); return; }
        setResumen({ tanda: bi + 1, ac, total: (chunks[bi] || []).length, accTotal: acc.current, last });
    };

    const seguir = () => {
        const wasLast = resumen.last;
        setResumen(null);
        if (wasLast) onFin(acc.current);
        else setBi((b) => b + 1);
    };

    if (resumen) {
        const perfecto = resumen.ac === resumen.total;
        return (
            <div style={{ ...S.panel, textAlign: 'center', maxWidth: 460 }}>
                <div style={{ fontSize: '3rem' }}>{perfecto ? '🌟' : resumen.ac > 0 ? '👍' : '🔁'}</div>
                <h2 style={{ color: COL.azul, margin: '4px 0' }}>Grupo {resumen.tanda} de {chunks.length}</h2>
                <p style={{ fontSize: '1.6rem', fontWeight: 800, margin: '6px 0' }}>
                    <span style={{ color: perfecto ? COL.verde : COL.oscuro }}>{resumen.ac} / {resumen.total}</span> aciertos {perfecto ? '✅' : ''}
                </p>
                <p style={{ color: '#555', margin: 0 }}>Llevas <b>{resumen.accTotal}</b> aciertos en esta ronda.</p>
                <button style={{ ...S.btn(COL.verde), marginTop: 18, width: '100%' }} onClick={seguir}>
                    {resumen.last ? labelFinal : 'Siguiente grupo →'}
                </button>
            </div>
        );
    }

    return (
        <Tanda key={bi} pregunta={pregunta} alumnos={chunks[bi] || []}
            ronda={ronda} totalRondas={totalRondas}
            tanda={bi + 1} totalTandas={chunks.length}
            botonLabel={botonLabel} onContinuar={onContinuar} />
    );
}

/* ---------------------- UNA TANDA (tablero de unir con líneas) ---------------------- */

function Tanda({ pregunta, alumnos, ronda, totalRondas, tanda, totalTandas, botonLabel, onContinuar }) {
    const esDibujo = pregunta.tipo === 'dibujo';
    // Alumnos con su clave normalizada de respuesta.
    const jugadores = alumnos.map((a) => ({
        id: a.id,
        nombre: nombreCompleto(a),
        key: norm(valorResp(a, pregunta.id)),
        raw: String(valorResp(a, pregunta.id) ?? '').trim(),
    }));

    // Respuestas únicas (agrupa repetidos). label = primer valor no vacío.
    const respuestas = useRef(null);
    if (!respuestas.current) {
        const map = new Map();
        jugadores.forEach((j) => {
            if (!map.has(j.key)) map.set(j.key, j.raw || '—');
        });
        respuestas.current = shuffle(Array.from(map, ([key, label]) => ({ key, label })));
    }
    const answers = respuestas.current;

    const [conns, setConns] = useState({});      // studentId -> answerKey
    const [sel, setSel] = useState(null);        // nombre seleccionado (modo tocar-tocar)
    const [checked, setChecked] = useState(false);
    const [drag, setDrag] = useState(null);      // { studentId, x, y } línea temporal
    const [fx, setFx] = useState([]);            // partículas de corazones/rayos
    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 640);

    useEffect(() => {
        ensureFxStyles();
        const h = () => setIsMobile(window.innerWidth <= 640);
        window.addEventListener('resize', h);
        return () => window.removeEventListener('resize', h);
    }, []);

    const containerRef = useRef(null);
    const nameRefs = useRef({});
    const ansRefs = useRef({});
    const dragRef = useRef(null);
    const suppress = useRef(false);
    const [pos, setPos] = useState({ names: {}, ans: {} });

    const medir = useCallback(() => {
        const c = containerRef.current;
        if (!c) return;
        const cr = c.getBoundingClientRect();
        const names = {}, ans = {};
        Object.entries(nameRefs.current).forEach(([id, el]) => {
            if (el) { const r = el.getBoundingClientRect(); names[id] = { x: r.right - cr.left, y: r.top - cr.top + r.height / 2 }; }
        });
        Object.entries(ansRefs.current).forEach(([k, el]) => {
            if (el) { const r = el.getBoundingClientRect(); ans[k] = { x: r.left - cr.left, y: r.top - cr.top + r.height / 2 }; }
        });
        setPos({ names, ans });
    }, []);

    useLayoutEffect(() => { medir(); }, [medir, pregunta, conns, checked]);
    useEffect(() => {
        window.addEventListener('resize', medir);
        return () => window.removeEventListener('resize', medir);
    }, [medir]);

    const connect = (studentId, key) => {
        if (checked) return;
        setConns((c) => ({ ...c, [studentId]: key }));
    };

    // Drag con pointer events (ratón + táctil)
    const startDrag = (e, id) => {
        if (checked) return;
        e.preventDefault();
        const cr = containerRef.current.getBoundingClientRect();
        dragRef.current = { studentId: id, moved: false, sx: e.clientX, sy: e.clientY };
        setDrag({ studentId: id, x: e.clientX - cr.left, y: e.clientY - cr.top });
    };
    useEffect(() => {
        const move = (e) => {
            const d = dragRef.current;
            if (!d) return;
            if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6) d.moved = true;
            const cr = containerRef.current.getBoundingClientRect();
            setDrag((prev) => (prev ? { ...prev, x: e.clientX - cr.left, y: e.clientY - cr.top } : prev));
        };
        const up = (e) => {
            const d = dragRef.current;
            dragRef.current = null;
            setDrag(null);
            if (!d) return;
            if (d.moved) {
                suppress.current = true;
                setTimeout(() => { suppress.current = false; }, 30);
                const el = document.elementFromPoint(e.clientX, e.clientY);
                const ansEl = el && el.closest ? el.closest('[data-answer]') : null;
                if (ansEl) connect(d.studentId, ansEl.getAttribute('data-answer'));
                setSel(null);
            }
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    }, [checked]);

    const clickNombre = (id) => {
        if (suppress.current || checked) return;
        setSel((s) => (s === id ? null : id));
    };
    const clickRespuesta = (key) => {
        if (suppress.current || checked) return;
        if (sel) { connect(sel, key); setSel(null); }
    };

    const esCorrecta = (j) => conns[j.id] === j.key;
    const aciertos = jugadores.filter((j) => conns[j.id] === j.key).length;

    const comprobar = () => {
        setChecked(true);
        setSel(null);
        medir();

        const errores = jugadores.length - aciertos;
        // Sonido: arpegio si hay aciertos, zumbido si hay fallos.
        if (aciertos > 0) sonidoAcierto();
        if (errores > 0) setTimeout(sonidoFallo, aciertos > 0 ? 420 : 0);

        // Partículas: un corazón por acierto, un rayo por fallo (+ extra si es perfecto).
        const corazones = ['❤️', '💚', '💛', '💖', '💗'];
        const parts = [];
        for (let i = 0; i < aciertos; i++) parts.push({ id: 'h' + i, emoji: corazones[i % corazones.length], type: 'rise' });
        if (errores === 0) for (let i = 0; i < 4; i++) parts.push({ id: 'hx' + i, emoji: corazones[i % corazones.length], type: 'rise' });
        for (let i = 0; i < errores; i++) parts.push({ id: 'b' + i, emoji: '⚡', type: 'bolt' });
        parts.forEach((p) => {
            p.left = 4 + Math.random() * 90;
            p.delay = Math.random() * 0.45;
            p.rot = (Math.random() * 60 - 30) + 'deg';
        });
        setFx(parts);
        setTimeout(() => setFx([]), 1800);
    };

    const btnPad = isMobile ? '10px 8px' : '12px 14px';
    const btnFont = isMobile ? '0.82rem' : '0.98rem';
    const colGap = isMobile ? 7 : 10;
    const imgMax = isMobile ? 96 : 140;

    // Numeración para reforzar el emparejamiento (útil en móvil, con líneas cruzadas).
    const nameNum = {};
    jugadores.forEach((j, i) => { nameNum[j.id] = i + 1; });
    const ansNums = {}; // answerKey -> [{ num, sid }]
    Object.entries(conns).forEach(([sid, key]) => { (ansNums[key] = ansNums[key] || []).push({ num: nameNum[sid], sid }); });
    const colorDe = (sid) => checked ? (conns[sid] === jugadores.find((j) => j.id === sid)?.key ? COL.verde : COL.rojo) : COL.azul;
    const nombreSel = sel ? jugadores.find((j) => j.id === sel)?.nombre : null;

    const Badge = ({ n, bg }) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 20, height: 20, padding: '0 5px', borderRadius: 10, background: bg, color: '#fff', fontWeight: 800, fontSize: '0.72rem', flexShrink: 0 }}>{n}</span>
    );

    return (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: isMobile ? '0 8px' : '0 14px' }}>
            <div style={{ textAlign: 'center', color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.35)' }}>
                <div style={{ opacity: 0.85, fontWeight: 700, fontSize: isMobile ? '0.85rem' : '1rem' }}>
                    Ronda {ronda} / {totalRondas}{totalTandas > 1 ? ` · Grupo ${tanda}/${totalTandas}` : ''}
                </div>
                <h2 style={{ margin: '4px 0 2px', fontSize: isMobile ? '1.25rem' : '1.6rem' }}>{emojiPregunta(pregunta)} {pregunta.texto}</h2>
                <p style={{ margin: 0, opacity: 0.9, fontSize: isMobile ? '0.82rem' : '0.95rem', padding: '0 6px' }}>
                    {checked ? '¡Comprobado!' : (isMobile ? 'Toca un nombre y luego su respuesta.' : 'Une cada nombre con su respuesta (arrastra o toca nombre y luego respuesta).')}
                </p>
            </div>

            {/* Banner de ayuda cuando hay un nombre seleccionado (tocar-tocar) */}
            {!checked && nombreSel && (
                <div style={{ position: 'sticky', top: 6, zIndex: 30, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
                    background: COL.amarillo, color: COL.oscuro, borderRadius: 12, padding: '8px 12px', margin: '8px auto 0', maxWidth: 520,
                    fontWeight: 800, boxShadow: '0 4px 12px rgba(0,0,0,0.25)' }}>
                    👉 Ahora toca la respuesta de <span style={{ textDecoration: 'underline' }}>{nombreSel}</span>
                    <button onClick={() => setSel(null)} style={{ marginLeft: 4, background: 'rgba(0,0,0,0.12)', border: 'none', borderRadius: 8, padding: '2px 8px', cursor: 'pointer', fontWeight: 800 }}>✕</button>
                </div>
            )}

            <div ref={containerRef} onScroll={medir}
                style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', gap: isMobile ? 10 : 20,
                    background: 'rgba(255,255,255,0.95)', borderRadius: 20, padding: isMobile ? '14px 10px' : '20px', margin: '16px 0',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.25)', touchAction: 'none' }}>

                {/* Capa de efectos (corazones / rayos) */}
                {fx.length > 0 && (
                    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 20 }}>
                        {fx.map((p) => (
                            <span key={p.id} style={{
                                position: 'absolute', left: `${p.left}%`,
                                bottom: p.type === 'rise' ? '18%' : 'auto', top: p.type === 'bolt' ? '8%' : 'auto',
                                fontSize: isMobile ? '1.5rem' : '2rem', willChange: 'transform, opacity',
                                animation: `${p.type === 'rise' ? 'qeqRise' : 'qeqBolt'} 1.5s ease-out ${p.delay}s forwards`,
                                '--r': p.rot,
                            }}>{p.emoji}</span>
                        ))}
                    </div>
                )}

                {/* SVG de líneas (no captura pointer para no bloquear botones) */}
                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }}>
                    {Object.entries(conns).map(([sid, key]) => {
                        const a = pos.names[sid], b = pos.ans[key];
                        if (!a || !b) return null;
                        const j = jugadores.find((x) => x.id === sid);
                        const color = !checked ? COL.azul : (j && esCorrecta(j) ? COL.verde : COL.rojo);
                        return <line key={sid} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={4} strokeLinecap="round" opacity={0.85} />;
                    })}
                    {drag && pos.names[drag.studentId] && (
                        <line x1={pos.names[drag.studentId].x} y1={pos.names[drag.studentId].y} x2={drag.x} y2={drag.y}
                            stroke={COL.amarillo} strokeWidth={4} strokeDasharray="6 6" strokeLinecap="round" />
                    )}
                </svg>

                {/* Columna nombres */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: colGap, flex: 1, minWidth: 0, zIndex: 6 }}>
                    {jugadores.map((j) => {
                        const activo = sel === j.id;
                        const done = conns[j.id] != null;
                        const bordeColor = checked ? (esCorrecta(j) ? COL.verde : COL.rojo) : (activo ? COL.amarillo : (done ? COL.azul : '#cbd5e1'));
                        return (
                            <button key={j.id} ref={(el) => (nameRefs.current[j.id] = el)}
                                data-name={j.id}
                                onPointerDown={(e) => startDrag(e, j.id)}
                                onClick={() => clickNombre(j.id)}
                                style={{
                                    padding: btnPad, borderRadius: 14, border: `3px solid ${bordeColor}`,
                                    background: activo ? '#fff7e0' : (checked && esCorrecta(j) ? '#eafaf3' : checked ? '#fdeef1' : '#fff'),
                                    fontWeight: 800, cursor: 'pointer', lineHeight: 1.15, minHeight: 44,
                                    textAlign: 'left', fontFamily: 'inherit', fontSize: btnFont, color: COL.oscuro,
                                    boxShadow: activo ? `0 0 0 3px ${COL.amarillo}55` : 'none', touchAction: 'none',
                                    wordBreak: 'break-word', display: 'flex', alignItems: 'center', gap: 8,
                                }}>
                                <Badge n={nameNum[j.id]} bg={done || checked ? colorDe(j.id) : '#cbd5e1'} />
                                <span style={{ flex: 1 }}>{checked && (esCorrecta(j) ? '✅ ' : '❌ ')}{j.nombre}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Columna respuestas */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: colGap, flex: 1, minWidth: 0, zIndex: 6 }}>
                    {answers.map((r) => {
                        const nums = (ansNums[r.key] || []);
                        const seleccionable = sel != null && !checked;
                        return (
                            <button key={r.key} ref={(el) => (ansRefs.current[r.key] = el)}
                                data-answer={r.key}
                                onClick={() => clickRespuesta(r.key)}
                                style={{
                                    padding: esDibujo ? 6 : btnPad, borderRadius: 14,
                                    border: `3px solid ${seleccionable ? COL.amarillo : '#cbd5e1'}`,
                                    background: seleccionable ? '#fffdf3' : '#f0f9ff', fontWeight: 700, cursor: 'pointer', lineHeight: 1.15,
                                    fontFamily: 'inherit', fontSize: btnFont, color: COL.oscuro, minHeight: 44,
                                    wordBreak: 'break-word', display: 'flex', alignItems: 'center', gap: 8,
                                }}>
                                {/* Badges de los nombres conectados a esta respuesta */}
                                <span style={{ display: 'flex', flexWrap: 'wrap', gap: 3, flexShrink: 0 }}>
                                    {nums.map((x) => <Badge key={x.sid} n={x.num} bg={colorDe(x.sid)} />)}
                                </span>
                                <span style={{ flex: 1, textAlign: 'right' }}>
                                    {esDibujo
                                        ? <img src={r.label} alt="dibujo" onLoad={medir} style={{ width: '100%', maxWidth: imgMax, borderRadius: 8, display: 'block', margin: '0 0 0 auto', background: '#fff' }} />
                                        : r.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
                {!checked ? (
                    <>
                        <button style={S.btn('#94a3b8')} onClick={() => { setConns({}); setSel(null); }}>🧹 Reiniciar</button>
                        <button style={S.btn(COL.verde)} disabled={Object.keys(conns).length === 0} onClick={comprobar}>✅ Comprobar</button>
                    </>
                ) : (
                    <>
                        <div style={{
                            background: aciertos === jugadores.length ? COL.verde : '#fff',
                            color: aciertos === jugadores.length ? '#fff' : COL.oscuro,
                            borderRadius: 14, padding: '12px 20px', fontWeight: 800,
                            animation: 'qeqPop 0.4s ease-out',
                        }}>
                            {aciertos === jugadores.length ? '🎉 ' : ''}Aciertos: {aciertos} / {jugadores.length}
                        </div>
                        <button style={S.btn(COL.azul)} onClick={() => onContinuar(aciertos)}>
                            {botonLabel}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

/* ============================ FASE 3: PANEL PROFESOR ============================ */

function PanelProfesor({ usuario }) {
    // El panel SOLO es accesible con cuenta iniciada; usa el código de la propia
    // cuenta (users/{uid}.codigoProfesor), no un código tecleado.
    const [codigo, setCodigo] = useState('');
    const [estado, setEstado] = useState('CARGANDO'); // CARGANDO | NO_LOGIN | SIN_CODIGO | LISTO
    const [alumnos, setAlumnos] = useState([]);
    const [grupos, setGrupos] = useState([]);
    const [resultados, setResultados] = useState([]);
    const [tests, setTests] = useState([]);          // solo personalizados (Firestore)
    const [testSel, setTestSel] = useState('default');
    const [nuevoGrupo, setNuevoGrupo] = useState('');
    const [filtroGrupo, setFiltroGrupo] = useState('__TODOS__');
    const [seccion, setSeccion] = useState('DATOS'); // DATOS | RESULTADOS | TESTS
    const [ayuda, setAyuda] = useState(false);
    const [qrTest, setQrTest] = useState(null); // test cuyo QR se muestra
    const [error, setError] = useState('');
    // Alta de código de profesor (si la cuenta aún no tiene uno)
    const [codeInput, setCodeInput] = useState('');
    const [savingCode, setSavingCode] = useState(false);
    // Login propio: si no llega `usuario` (p.ej. ruta pública), escuchamos Firebase Auth.
    const [authUser, setAuthUser] = useState(null);
    const [logueando, setLogueando] = useState(false);
    const user = usuario || authUser;
    const unsubAlu = useRef(null);
    const unsubCfg = useRef(null);
    const unsubRes = useRef(null);
    const unsubTests = useRef(null);

    useEffect(() => onAuthStateChanged(auth, (u) => setAuthUser(u || null)), []);

    const login = async () => {
        setLogueando(true); setError('');
        try {
            await signInWithPopup(auth, new GoogleAuthProvider());
            // onAuthStateChanged actualizará `user` y el efecto abrirá el panel.
        } catch {
            setError('No se pudo iniciar sesión con Google.');
        } finally {
            setLogueando(false);
        }
    };

    const iniciarListeners = useCallback((cod) => {
        unsubAlu.current?.(); unsubCfg.current?.(); unsubRes.current?.(); unsubTests.current?.();
        unsubCfg.current = onSnapshot(doc(db, 'quien_es_quien_config', cod), (s) => {
            setGrupos(s.exists() && Array.isArray(s.data().grupos) ? s.data().grupos : []);
        });
        unsubTests.current = onSnapshot(query(collection(db, 'quien_es_quien_tests'), where('codigoProfesor', '==', cod)), (snap) => {
            setTests(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((t) => Array.isArray(t.preguntas)));
        }, () => {});
        unsubAlu.current = onSnapshot(query(collection(db, 'clase_alumnos'), where('codigoProfesor', '==', cod)), (snap) => {
            setAlumnos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }, () => setError('Error al leer los datos.'));
        unsubRes.current = onSnapshot(query(collection(db, 'quien_es_quien_resultados'), where('codigoProfesor', '==', cod)), (snap) => {
            const rs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            rs.sort((a, b) => {
                const fa = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
                const fb = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
                return fb - fa;
            });
            setResultados(rs);
        }, () => {});
    }, []);

    // Exigir login y cargar el código de la cuenta (reacciona a login/logout).
    const uid = user?.uid;
    useEffect(() => {
        let vivo = true;
        (async () => {
            if (!uid) { setEstado('NO_LOGIN'); return; }
            setEstado('CARGANDO');
            try {
                const snap = await getDoc(doc(db, 'users', uid));
                const data = snap.exists() ? snap.data() : {};
                if (!vivo) return;
                if (data.codigoProfesor) {
                    const cod = upper(data.codigoProfesor);
                    setCodigo(cod);
                    iniciarListeners(cod);
                    setEstado('LISTO');
                } else {
                    // Sugerir código a partir del uid; el profesor lo confirma/edita.
                    setCodeInput(uid.substring(0, 6).toUpperCase());
                    setEstado('SIN_CODIGO');
                }
            } catch {
                if (vivo) { setError('No se pudo cargar tu perfil.'); setEstado('SIN_CODIGO'); }
            }
        })();
        return () => { vivo = false; unsubAlu.current?.(); unsubCfg.current?.(); unsubRes.current?.(); unsubTests.current?.(); };
    }, [uid, iniciarListeners]);

    // Tests disponibles (por defecto + personalizados) y test activo.
    const testsTodos = [TEST_DEFAULT, ...tests];
    const testActivo = testsTodos.find((t) => t.id === testSel) || TEST_DEFAULT;
    const enTest = (a) => testIdDe(a) === testSel;
    const alumnosTest = alumnos.filter(enTest);
    const filtrados = filtroGrupo === '__TODOS__' ? alumnosTest : alumnosTest.filter((a) => a.grupo === filtroGrupo);
    const resTest = resultados.filter((r) => (r.testId || 'default') === testSel);
    const resFiltrados = filtroGrupo === '__TODOS__' ? resTest : resTest.filter((r) => r.grupo === filtroGrupo);

    // ── CRUD de tests personalizados ──
    const [editTest, setEditTest] = useState(null); // objeto test en edición (o null)
    const nuevoTest = () => setEditTest({ id: '', titulo: '', preguntas: [] });
    const editarTest = (t) => setEditTest(JSON.parse(JSON.stringify(t)));
    const guardarTest = async (t) => {
        const titulo = (t.titulo || '').trim();
        if (!titulo) { setError('El test necesita un título.'); return; }
        if (!t.preguntas.length) { setError('Añade al menos una pregunta.'); return; }
        for (const p of t.preguntas) {
            if (!(p.texto || '').trim()) { setError('Todas las preguntas necesitan enunciado.'); return; }
            if (p.tipo === 'cerrada' && (!p.opciones || p.opciones.filter((o) => o.trim()).length < 2)) { setError(`La pregunta "${p.texto}" necesita al menos 2 opciones.`); return; }
        }
        const id = t.id || rid();
        const preguntas = t.preguntas.map((p) => ({
            id: p.id || rid(), tipo: p.tipo, texto: p.texto.trim(),
            emoji: (p.emoji || '').trim(),
            ...(p.tipo === 'cerrada' ? { opciones: p.opciones.map((o) => o.trim()).filter(Boolean), permitirOtro: p.permitirOtro !== false } : {}),
        }));
        setError('');
        try {
            await setDoc(doc(db, 'quien_es_quien_tests', id), {
                id, codigoProfesor: upper(codigo), titulo, preguntas,
                updatedAt: serverTimestamp(),
            }, { merge: true });
            setEditTest(null);
        } catch (e) {
            setError('Error al guardar el test: ' + (e?.message || ''));
        }
    };
    const borrarTest = async (t) => {
        if (!window.confirm(`¿Borrar el test "${t.titulo}"? (No borra los alumnos ya registrados.)`)) return;
        await deleteDoc(doc(db, 'quien_es_quien_tests', t.id));
        if (testSel === t.id) setTestSel('default');
    };

    // Crea/reserva el código de profesor de esta cuenta (patrón de InformesJuegos).
    const crearCodigo = async () => {
        const nuevo = codeInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (!nuevo || nuevo.length < 3) { setError('El código debe tener al menos 3 caracteres (letras/números).'); return; }
        setSavingCode(true); setError('');
        try {
            const existe = await getDoc(doc(db, 'codigos_profesor', nuevo));
            if (existe.exists() && existe.data().uid !== user.uid) {
                setError(`El código "${nuevo}" ya está en uso. Elige otro.`);
                setSavingCode(false); return;
            }
            await setDoc(doc(db, 'codigos_profesor', nuevo), { uid: user.uid });
            await setDoc(doc(db, 'users', user.uid), { codigoProfesor: nuevo }, { merge: true });
            setCodigo(nuevo);
            iniciarListeners(nuevo);
            setEstado('LISTO');
        } catch (e) {
            setError('Error al guardar el código: ' + (e?.message || ''));
        } finally {
            setSavingCode(false);
        }
    };

    const guardarGrupos = async (nuevos) => {
        await setDoc(doc(db, 'quien_es_quien_config', upper(codigo)), { grupos: nuevos, updatedAt: serverTimestamp() }, { merge: true });
    };
    const addGrupo = async () => {
        const g = nuevoGrupo.trim();
        if (!g || grupos.includes(g)) { setNuevoGrupo(''); return; }
        await guardarGrupos([...grupos, g]);
        setNuevoGrupo('');
    };
    const delGrupo = async (g) => { await guardarGrupos(grupos.filter((x) => x !== g)); };

    const borrarAlumno = async (id) => {
        if (!window.confirm('¿Borrar este alumno?')) return;
        await deleteDoc(doc(db, 'clase_alumnos', id));
    };
    const borrarTodos = async () => {
        const lista = filtrados;
        if (lista.length === 0) return;
        const txt = filtroGrupo === '__TODOS__'
            ? `¿BORRAR TODOS los ${lista.length} alumnos del test "${testActivo.titulo}"? Esta acción no se puede deshacer.`
            : `¿Borrar los ${lista.length} alumnos del grupo "${filtroGrupo}" (test "${testActivo.titulo}")?`;
        if (!window.confirm(txt)) return;
        await Promise.all(lista.map((a) => deleteDoc(doc(db, 'clase_alumnos', a.id))));
    };

    const borrarResultado = async (id) => {
        if (!window.confirm('¿Borrar este resultado?')) return;
        await deleteDoc(doc(db, 'quien_es_quien_resultados', id));
    };
    const borrarResultados = async () => {
        const lista = resFiltrados;
        if (lista.length === 0) return;
        if (!window.confirm(`¿Borrar ${lista.length} resultado(s)${filtroGrupo === '__TODOS__' ? '' : ` del grupo "${filtroGrupo}"`}?`)) return;
        await Promise.all(lista.map((r) => deleteDoc(doc(db, 'quien_es_quien_resultados', r.id))));
    };

    // Crea un grupo de notas (grupos_profesor) con estos alumnos. Solo Nombre y Grupo
    // (la columna "Grupo" se rellena con el grupo del test). La hoja se crea SIN columnas
    // de calificación: el profesor añadirá ahí sus columnas de exámenes. El grupo queda
    // conectado a Agrupaciones / Plano de clase (que leen de grupos_profesor).
    const [msgGrupo, setMsgGrupo] = useState('');
    const crearGrupoNotas = async () => {
        if (!user?.uid) { setMsgGrupo('Debes iniciar sesión.'); return; }
        const lista = filtrados;
        if (lista.length === 0) { setMsgGrupo('No hay alumnos que añadir.'); return; }
        const nombreGrupo = filtroGrupo === '__TODOS__' ? testActivo.titulo : filtroGrupo;
        if (!window.confirm(`Se creará el grupo de notas "${nombreGrupo}" con ${lista.length} alumnos. Lo verás en la pestaña Grupos y podrás añadir columnas de exámenes y hacer agrupaciones. ¿Continuar?`)) return;
        try {
            const alumnosGP = lista
                .map((a) => ({ id: rid(), nombre: nombreCompleto(a), grupo: a.grupo || '' }))
                .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
            const gid = rid();
            await setDoc(doc(db, 'grupos_profesor', gid), {
                id: gid,
                profesorUid: user.uid,
                nombre: nombreGrupo,
                alumnos: alumnosGP,
                hojas: [{ id: rid(), nombre: '1ª Evaluación', columnas: [], celdas: {} }],
                fechaCreacion: serverTimestamp(),
            });
            setMsgGrupo(`✅ Grupo "${nombreGrupo}" creado en la pestaña Grupos.`);
        } catch (e) {
            setMsgGrupo('⚠️ Error al crear el grupo: ' + (e?.message || ''));
        }
    };

    // Botón "?" de ayuda (arriba a la derecha del panel) + modal.
    const ayudaUI = (
        <>
            <button onClick={() => setAyuda(true)} title="¿Cómo funciona?"
                style={{ position: 'absolute', top: 10, right: 10, width: 34, height: 34, borderRadius: '50%', border: 'none',
                    background: COL.azul, color: '#fff', fontWeight: 900, fontSize: '1.1rem', cursor: 'pointer', boxShadow: '0 3px 8px rgba(0,0,0,0.25)', zIndex: 5 }}>?</button>
            {ayuda && <AyudaProfesor onClose={() => setAyuda(false)} />}
        </>
    );

    if (estado === 'CARGANDO') {
        return <div style={{ ...S.panel, textAlign: 'center' }}><p style={{ fontSize: '1.1rem' }}>Cargando tu panel…</p></div>;
    }

    if (estado === 'NO_LOGIN') {
        return (
            <div style={{ ...S.panel, textAlign: 'center', position: 'relative' }}>
                {ayudaUI}
                <div style={{ fontSize: '3rem' }}>🔒</div>
                <h2 style={{ color: COL.azul }}>Panel del profesor</h2>
                <p>El panel de gestión es solo para profesores. <b>Inicia sesión con tu cuenta</b> y se abrirá tu panel de ¿Quién es quién?</p>
                <button style={{ ...S.btn(COL.azul), marginTop: 8, width: '100%', maxWidth: 340, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
                    disabled={logueando} onClick={login}>
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" onError={(e) => (e.target.style.display = 'none')} style={{ width: 20, height: 20, background: '#fff', borderRadius: 3 }} />
                    {logueando ? 'Conectando…' : 'Iniciar sesión con Google'}
                </button>
                {error && <p style={{ color: COL.rojo, fontWeight: 700 }}>{error}</p>}
                <p style={{ color: '#777', fontSize: '0.9rem', marginTop: 14 }}>
                    Los alumnos no necesitan cuenta: pueden rellenar el formulario y jugar con tu código.
                </p>
            </div>
        );
    }

    if (estado === 'SIN_CODIGO') {
        return (
            <div style={{ ...S.panel, position: 'relative' }}>
                {ayudaUI}
                <h2 style={{ marginTop: 0, color: COL.azul }}>👨‍🏫 Crea tu código de profesor</h2>
                <p>Este será el código que tus alumnos usarán para enviar sus datos y jugar. Queda ligado a tu cuenta.</p>
                <label style={S.label}>Tu código</label>
                <input style={{ ...S.input, textTransform: 'uppercase', letterSpacing: 2, fontWeight: 800 }}
                    value={codeInput} onChange={(e) => setCodeInput(e.target.value)} placeholder="Ej: CLASE1A"
                    onKeyDown={(e) => e.key === 'Enter' && crearCodigo()} />
                {error && <p style={{ color: COL.rojo, fontWeight: 700 }}>{error}</p>}
                <button style={{ ...S.btn(COL.azul), marginTop: 16, width: '100%' }} disabled={savingCode} onClick={crearCodigo}>
                    {savingCode ? 'Guardando…' : 'Guardar y entrar →'}
                </button>
            </div>
        );
    }

    return (
        <div style={{ ...S.panel, maxWidth: 1100, position: 'relative' }}>
            {ayudaUI}
            {qrTest && <QrModal test={qrTest} codigo={codigo} onClose={() => setQrTest(null)} />}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10, paddingRight: 40 }}>
                <h2 style={{ margin: 0, color: COL.azul }}>👨‍🏫 Panel — código {upper(codigo)}</h2>
                {user && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: '#555' }}>
                        <span>Sesión: <b>{user.displayName || user.email}</b></span>
                        <button onClick={() => signOut(auth)} title="Cerrar sesión"
                            style={{ ...S.btn('#94a3b8'), padding: '6px 12px' }}>Cerrar sesión</button>
                    </div>
                )}
            </div>

            {/* Gestión de grupos */}
            <div style={{ background: '#f0f9ff', borderRadius: 16, padding: 16, marginBottom: 18 }}>
                <h3 style={{ margin: '0 0 10px' }}>📁 Grupos / clases</h3>
                <p style={{ marginTop: 0, color: '#555', fontSize: '0.9rem' }}>
                    Crea los grupos que tus alumnos podrán elegir en el formulario.
                </p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <input style={{ ...S.input, flex: 1 }} value={nuevoGrupo} onChange={(e) => setNuevoGrupo(e.target.value)}
                        placeholder="Nombre del grupo (ej: 1ºA)" onKeyDown={(e) => e.key === 'Enter' && addGrupo()} />
                    <button style={S.btn(COL.verde)} onClick={addGrupo}>+ Añadir</button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {grupos.length === 0 && <span style={{ color: '#888' }}>Aún no hay grupos.</span>}
                    {grupos.map((g) => (
                        <span key={g} style={{ background: COL.azul, color: '#fff', borderRadius: 20, padding: '6px 12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            {g}
                            <button onClick={() => delGrupo(g)} title="Eliminar grupo"
                                style={{ background: 'rgba(255,255,255,0.3)', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', color: '#fff', fontWeight: 900, lineHeight: 1 }}>×</button>
                        </span>
                    ))}
                </div>
            </div>

            {/* Pestañas Datos / Resultados / Tests */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                {[
                    { k: 'DATOS', t: `📋 Datos de alumnos (${alumnosTest.length})` },
                    { k: 'RESULTADOS', t: `🏆 Resultados (${resTest.length})` },
                    { k: 'TESTS', t: `📝 Mis tests (${tests.length})` },
                ].map((tb) => (
                    <button key={tb.k} onClick={() => setSeccion(tb.k)}
                        style={{
                            border: 'none', borderRadius: '12px 12px 0 0', padding: '10px 16px', cursor: 'pointer',
                            fontWeight: 800, fontFamily: 'inherit', fontSize: '0.95rem',
                            background: seccion === tb.k ? COL.azul : '#e2e8f0', color: seccion === tb.k ? '#fff' : '#555',
                        }}>{tb.t}</button>
                ))}
            </div>

            {/* Filtro de test + grupo (Datos / Resultados) */}
            {seccion !== 'TESTS' && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
                    <select style={{ ...S.input, width: 'auto' }} value={testSel} onChange={(e) => setTestSel(e.target.value)}>
                        {testsTodos.map((t) => <option key={t.id} value={t.id}>📝 {t.titulo}</option>)}
                    </select>
                    <select style={{ ...S.input, width: 'auto' }} value={filtroGrupo} onChange={(e) => setFiltroGrupo(e.target.value)}>
                        <option value="__TODOS__">Todos los grupos</option>
                        {grupos.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <div style={{ flex: 1 }} />
                    <button style={{ ...S.btn('#0f766e'), padding: '10px 14px' }} onClick={() => setQrTest(testActivo)} title="QR de acceso directo para rezagados">📱 QR del test</button>
                    {seccion === 'DATOS' ? (
                        <>
                            <button style={{ ...S.btn(COL.verde), padding: '10px 16px' }} onClick={crearGrupoNotas} title="Crea un grupo en la Tabla de notas con estos alumnos">📊 Crear grupo de notas</button>
                            <button style={{ ...S.btn(COL.rojo), padding: '10px 16px' }} onClick={borrarTodos}>🗑️ Borrar {filtroGrupo === '__TODOS__' ? 'todos' : 'grupo'}</button>
                        </>
                    ) : (
                        <button style={{ ...S.btn(COL.rojo), padding: '10px 16px' }} onClick={borrarResultados}>🗑️ Borrar resultados {filtroGrupo === '__TODOS__' ? '' : 'del grupo'}</button>
                    )}
                </div>
            )}

            {/* Mensaje de creación de grupo de notas */}
            {seccion === 'DATOS' && msgGrupo && (
                <p style={{ margin: '0 0 12px', fontWeight: 700, color: msgGrupo.startsWith('✅') ? COL.verde : COL.rojo }}>{msgGrupo}</p>
            )}

            {/* Sección DATOS — columnas según el test activo */}
            {seccion === 'DATOS' && (
                <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.88rem', minWidth: 600 }}>
                        <thead>
                            <tr style={{ background: COL.oscuro, color: '#fff' }}>
                                <th style={thS}>Nombre</th>
                                <th style={thS}>Apellidos</th>
                                <th style={thS}>Grupo</th>
                                {testActivo.preguntas.map((p) => <th key={p.id} style={thS}>{p.texto}</th>)}
                                <th style={thS}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtrados.length === 0 && (
                                <tr><td colSpan={testActivo.preguntas.length + 4} style={{ padding: 20, textAlign: 'center', color: '#888' }}>Todavía no hay alumnos en este test. Comparte tu código para que rellenen el formulario.</td></tr>
                            )}
                            {filtrados.map((a, i) => (
                                <tr key={a.id} style={{ background: i % 2 ? '#f8fafc' : '#fff' }}>
                                    <td style={tdS}><b>{a.nombre}</b></td>
                                    <td style={tdS}>{a.apellidos || ''}</td>
                                    <td style={tdS}>{a.grupo}</td>
                                    {testActivo.preguntas.map((p) => {
                                        const v = valorResp(a, p.id);
                                        return (
                                            <td key={p.id} style={{ ...tdS, maxWidth: 220 }}>
                                                {p.tipo === 'dibujo' && typeof v === 'string' && v.startsWith('data:')
                                                    ? <a href={v} target="_blank" rel="noreferrer"><img src={v} alt="dibujo" style={{ width: 70, height: 52, objectFit: 'cover', borderRadius: 6, border: '1px solid #ddd', background: '#fff' }} /></a>
                                                    : String(v ?? '')}
                                            </td>
                                        );
                                    })}
                                    <td style={tdS}>
                                        <button onClick={() => borrarAlumno(a.id)} title="Borrar alumno"
                                            style={{ background: COL.rojo, color: '#fff', border: 'none', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', fontWeight: 800 }}>×</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Sección RESULTADOS */}
            {seccion === 'RESULTADOS' && (
                <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.88rem', minWidth: 620 }}>
                        <thead>
                            <tr style={{ background: COL.oscuro, color: '#fff' }}>
                                {['Jugador', 'Grupo', 'Aciertos', '%', 'Detalle por ronda', 'Fecha', ''].map((h) => (
                                    <th key={h} style={{ padding: '10px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {resFiltrados.length === 0 && (
                                <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: '#888' }}>Aún no hay resultados{filtroGrupo === '__TODOS__' ? '' : ` en el grupo "${filtroGrupo}"`}. Los alumnos juegan y se envían aquí.</td></tr>
                            )}
                            {resFiltrados.map((r, i) => (
                                <tr key={r.id} style={{ background: i % 2 ? '#f8fafc' : '#fff' }}>
                                    <td style={tdS}><b>{r.nombre}</b></td>
                                    <td style={tdS}>{r.grupo}</td>
                                    <td style={tdS}>{r.aciertos} / {r.posibles}</td>
                                    <td style={tdS}><b style={{ color: (r.porcentaje ?? 0) >= 50 ? COL.verde : COL.rojo }}>{r.porcentaje ?? 0}%</b></td>
                                    <td style={{ ...tdS, maxWidth: 260, fontSize: '0.8rem', color: '#555' }}>
                                        {Array.isArray(r.rondas) ? r.rondas.map((x) => `${x.label}: ${x.aciertos}/${x.total}`).join(' · ') : '—'}
                                    </td>
                                    <td style={{ ...tdS, whiteSpace: 'nowrap' }}>{r.createdAt?.toDate ? r.createdAt.toDate().toLocaleString() : '—'}</td>
                                    <td style={tdS}>
                                        <button onClick={() => borrarResultado(r.id)} title="Borrar resultado"
                                            style={{ background: COL.rojo, color: '#fff', border: 'none', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', fontWeight: 800 }}>×</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Sección TESTS — gestión de tests personalizados */}
            {seccion === 'TESTS' && !editTest && (
                <div>
                    <p style={{ color: '#555' }}>
                        Crea tus propios tests. Siempre se piden <b>nombre, apellidos y grupo</b>; tú añades las preguntas
                        (respuesta corta, opciones o numérica). El test por defecto no se puede editar.
                    </p>
                    <button style={{ ...S.btn(COL.verde), marginBottom: 14 }} onClick={nuevoTest}>➕ Crear test nuevo</button>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {testsTodos.map((t) => {
                            const propio = t.id !== 'default';
                            const nAl = alumnos.filter((a) => testIdDe(a) === t.id).length;
                            return (
                                <div key={t.id} style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1, minWidth: 180 }}>
                                        <b>📝 {t.titulo}</b> {!propio && <span style={{ color: '#999', fontSize: '0.8rem' }}>(por defecto)</span>}
                                        <div style={{ color: '#777', fontSize: '0.82rem' }}>{t.preguntas.length} preguntas · {nAl} alumnos</div>
                                    </div>
                                    <button style={{ ...S.btn('#0f766e'), padding: '8px 12px' }} onClick={() => setQrTest(t)}>📱 QR</button>
                                    {propio && <button style={{ ...S.btn(COL.azul), padding: '8px 12px' }} onClick={() => editarTest(t)}>✏️ Editar</button>}
                                    {propio && <button style={{ ...S.btn(COL.rojo), padding: '8px 12px' }} onClick={() => borrarTest(t)}>🗑️</button>}
                                </div>
                            );
                        })}
                    </div>
                    {error && <p style={{ color: COL.rojo, fontWeight: 700 }}>{error}</p>}
                </div>
            )}
            {seccion === 'TESTS' && editTest && (
                <EditorTest test={editTest} setTest={setEditTest} onGuardar={guardarTest} onCancelar={() => { setEditTest(null); setError(''); }} error={error} />
            )}
        </div>
    );
}

const tdS = { padding: '8px', borderBottom: '1px solid #eef2f7', verticalAlign: 'top' };
const thS = { padding: '10px 8px', textAlign: 'left', whiteSpace: 'nowrap' };

/* ---------------------- VISTA PREVIA DEL TEST (interactiva, sin guardar) ---------------------- */
function VistaPreviaTest({ test, onClose }) {
    const [resp, setResp] = useState({});
    const [otros, setOtros] = useState({});
    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(7,59,76,0.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '20px 12px' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ ...S.panel, margin: '10px auto', maxWidth: 560, width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ background: COL.amarillo, color: COL.oscuro, borderRadius: 20, padding: '3px 12px', fontWeight: 800, fontSize: '0.8rem' }}>👁 VISTA PREVIA</span>
                    <button onClick={onClose} style={{ ...S.btn('#94a3b8'), padding: '6px 12px' }}>✕ Cerrar</button>
                </div>
                <h2 style={{ marginTop: 8, color: COL.verde }}>✍️ {test.titulo || '(sin título)'}</h2>
                <p style={{ color: '#777', fontSize: '0.85rem', marginTop: 0 }}>Así lo verá el alumno. Aquí no se guarda nada.</p>

                <label style={S.label}>Grupo / clase</label>
                <input style={S.input} disabled placeholder="(lo elegirá el alumno)" />
                <label style={S.label}>Nombre</label>
                <input style={S.input} disabled placeholder="(nombre del alumno)" />
                <label style={S.label}>Apellidos</label>
                <input style={S.input} disabled placeholder="(apellidos del alumno)" />

                {(test.preguntas || []).map((p) => (
                    <div key={p.id}>
                        <label style={S.label}>{emojiPregunta(p)} {p.texto || '(sin enunciado)'}</label>
                        <PreguntaCampo p={p} valor={resp[p.id] ?? ''} otro={otros[p.id]}
                            onValor={(v) => setResp((s) => ({ ...s, [p.id]: v }))}
                            onOtro={(v) => setOtros((s) => ({ ...s, [p.id]: v }))} />
                    </div>
                ))}
                {(!test.preguntas || test.preguntas.length === 0) && (
                    <p style={{ color: '#999', textAlign: 'center', padding: 20 }}>Este test todavía no tiene preguntas.</p>
                )}
                <button style={{ ...S.btn(COL.verde), marginTop: 20, width: '100%' }} disabled>💾 Guardar mis datos (desactivado en vista previa)</button>
            </div>
        </div>
    );
}

/* ---------------------- EDITOR DE TEST PERSONALIZADO ---------------------- */
function EditorTest({ test, setTest, onGuardar, onCancelar, error }) {
    const [preview, setPreview] = useState(false);
    const upd = (changes) => setTest((t) => ({ ...t, ...changes }));
    const updPreg = (idx, changes) => setTest((t) => ({ ...t, preguntas: t.preguntas.map((p, i) => i === idx ? { ...p, ...changes } : p) }));
    const addPreg = () => setTest((t) => ({ ...t, preguntas: [...t.preguntas, { id: rid(), tipo: 'corta', texto: '', opciones: [], permitirOtro: true }] }));
    const delPreg = (idx) => setTest((t) => ({ ...t, preguntas: t.preguntas.filter((_, i) => i !== idx) }));
    const movePreg = (idx, dir) => setTest((t) => {
        const arr = [...t.preguntas]; const j = idx + dir;
        if (j < 0 || j >= arr.length) return t;
        [arr[idx], arr[j]] = [arr[j], arr[idx]];
        return { ...t, preguntas: arr };
    });

    return (
        <div>
            <h3 style={{ marginTop: 0 }}>{test.id ? '✏️ Editar test' : '➕ Nuevo test'}</h3>
            <label style={S.label}>Título del test</label>
            <input style={S.input} value={test.titulo} onChange={(e) => upd({ titulo: e.target.value })} placeholder="Ej: Nos conocemos mejor" />

            <div style={{ margin: '16px 0 6px', fontWeight: 800, color: COL.azul }}>Preguntas</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {test.preguntas.map((p, idx) => (
                    <div key={p.id} style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, background: '#f8fafc' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 800 }}>#{idx + 1}</span>
                            <select style={{ ...S.input, width: 'auto', padding: '8px 10px' }} value={p.tipo} onChange={(e) => updPreg(idx, { tipo: e.target.value })}>
                                {TIPOS_PREGUNTA.map((tp) => <option key={tp.tipo} value={tp.tipo}>{tp.emoji} {tp.label}</option>)}
                            </select>
                            <div style={{ flex: 1 }} />
                            <button style={{ ...S.btn('#94a3b8'), padding: '6px 10px' }} onClick={() => movePreg(idx, -1)} disabled={idx === 0}>↑</button>
                            <button style={{ ...S.btn('#94a3b8'), padding: '6px 10px' }} onClick={() => movePreg(idx, 1)} disabled={idx === test.preguntas.length - 1}>↓</button>
                            <button style={{ ...S.btn(COL.rojo), padding: '6px 10px' }} onClick={() => delPreg(idx)}>🗑️</button>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input style={{ ...S.input, width: 64, textAlign: 'center', fontSize: '1.3rem', flexShrink: 0 }}
                                value={p.emoji || ''} onChange={(e) => updPreg(idx, { emoji: e.target.value })}
                                placeholder={emojiPregunta(p)} title="Emoji de la pregunta" maxLength={4} />
                            <input style={{ ...S.input, flex: 1 }} value={p.texto} onChange={(e) => updPreg(idx, { texto: e.target.value })} placeholder="Enunciado de la pregunta" />
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                            {EMOJIS_SUGERIDOS.map((em) => (
                                <button key={em} type="button" onClick={() => updPreg(idx, { emoji: em })}
                                    style={{ border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: '1.05rem', padding: '2px 5px', lineHeight: 1 }}>{em}</button>
                            ))}
                        </div>
                        {p.tipo === 'dibujo' && (
                            <p style={{ margin: '8px 0 0', fontSize: '0.82rem', color: '#777' }}>🎨 El alumno dibujará en un lienzo; en el juego habrá que unir cada nombre con su dibujo.</p>
                        )}
                        {p.tipo === 'cerrada' && (
                            <div style={{ marginTop: 8 }}>
                                <label style={{ ...S.label, marginTop: 6 }}>Opciones (una por línea)</label>
                                <textarea style={{ ...S.input, minHeight: 80, resize: 'vertical' }}
                                    value={(p.opciones || []).join('\n')}
                                    onChange={(e) => updPreg(idx, { opciones: e.target.value.split('\n') })}
                                    placeholder={'Opción 1\nOpción 2\nOpción 3'} />
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontWeight: 700, color: '#555' }}>
                                    <input type="checkbox" checked={p.permitirOtro !== false} onChange={(e) => updPreg(idx, { permitirOtro: e.target.checked })} />
                                    Permitir opción "Otro…"
                                </label>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            <button style={{ ...S.btn(COL.azul), marginTop: 12 }} onClick={addPreg}>➕ Añadir pregunta</button>

            {error && <p style={{ color: COL.rojo, fontWeight: 700 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
                <button style={{ ...S.btn('#94a3b8'), flex: 1 }} onClick={onCancelar}>Cancelar</button>
                <button style={{ ...S.btn(COL.azul), flex: 1 }} disabled={!test.preguntas.length} onClick={() => setPreview(true)}>👁 Vista previa</button>
                <button style={{ ...S.btn(COL.verde), flex: 2 }} onClick={() => onGuardar(test)}>💾 Guardar test</button>
            </div>

            {preview && <VistaPreviaTest test={test} onClose={() => setPreview(false)} />}
        </div>
    );
}

/* ---------------------- QR DE ACCESO DIRECTO A UN TEST ---------------------- */
function QrModal({ test, codigo, onClose }) {
    const [copiado, setCopiado] = useState(false);
    const url = `${window.location.origin}/quienesquien?code=${encodeURIComponent(upper(codigo))}&test=${encodeURIComponent(test.id)}`;
    const qrSrc = (size) => `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=073b4c&margin=8`;

    const copiar = async () => {
        try { await navigator.clipboard.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }
        catch { /* algunos navegadores bloquean clipboard sin https */ }
    };
    const imprimir = () => {
        const w = window.open('', '_blank');
        if (!w) return;
        w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>QR · ${test.titulo}</title>
<style>body{font-family:Arial,sans-serif;text-align:center;padding:40px;color:#073b4c}h1{margin:0 0 6px}p{color:#555}img{margin:20px auto;display:block}.cod{font-size:1.4rem;font-weight:800;letter-spacing:2px}</style></head>
<body><h1>${test.titulo}</h1><p>Escanea para rellenar el test directamente</p>
<img src="${qrSrc(300)}" width="300" height="300" alt="QR"/>
<p>o entra en <b>${window.location.host}/quienesquien</b><br>con el código <span class="cod">${upper(codigo)}</span></p>
<script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script></body></html>`);
        w.document.close();
    };

    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100001, background: 'rgba(7,59,76,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ ...S.panel, maxWidth: 420, width: '100%', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, color: COL.azul, fontSize: '1.2rem' }}>📱 {test.titulo}</h2>
                    <button onClick={onClose} style={{ ...S.btn('#94a3b8'), padding: '6px 12px' }}>✕</button>
                </div>
                <p style={{ color: '#555', margin: '8px 0' }}>Los alumnos escanean este QR y entran <b>directamente al test</b>, sin poner el código.</p>
                <img src={qrSrc(220)} width={220} height={220} alt="QR del test" style={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff' }} />
                <div style={{ wordBreak: 'break-all', fontSize: '0.75rem', color: '#777', margin: '10px 0' }}>{url}</div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button style={{ ...S.btn(COL.verde), padding: '10px 14px' }} onClick={copiar}>{copiado ? '✅ Copiado' : '🔗 Copiar enlace'}</button>
                    <button style={{ ...S.btn(COL.azul), padding: '10px 14px' }} onClick={imprimir}>🖨️ Imprimir</button>
                </div>
            </div>
        </div>
    );
}

/* ---------------------- AYUDA PARA EL PROFESOR ---------------------- */
function AyudaProfesor({ onClose }) {
    const pasos = [
        { e: '🔑', t: 'Inicia sesión', d: 'Entra con tu cuenta de Google. El panel es solo para profesores; los alumnos no necesitan cuenta.' },
        { e: '🆔', t: 'Crea tu código', d: 'La primera vez eliges tu código de profesor (ej: CLASE1A). Queda ligado a tu cuenta y es el que compartirás con tus alumnos.' },
        { e: '📁', t: 'Crea grupos (opcional)', d: 'En el panel puedes crear los grupos/clases (1ºA, 1ºB…) que tus alumnos elegirán al rellenar el test.' },
        { e: '📝', t: 'Crea tus tests (opcional)', d: 'En la pestaña "Mis tests" haces tests a medida con preguntas de respuesta corta, opciones, numérica o dibujo. También existe el test estándar "¿Quién es quién?".' },
        { e: '📣', t: 'Comparte tu código', d: 'Diles a tus alumnos que entren en pikt.es/quienesquien → "Soy alumno", pongan tu código, elijan su grupo y rellenen el test (nombre, apellidos y respuestas).' },
        { e: '🎮', t: 'A jugar', d: 'En "Jugar" cada alumno une con líneas cada compañero con su respuesta. Al terminar, su resultado te llega a la pestaña "Resultados".' },
        { e: '📊', t: 'Datos y notas', d: 'En "Datos" ves y gestionas las respuestas por grupo, y con "Crear grupo de notas" pasas la clase a la Tabla de notas (Grupos/Agrupaciones/Plano) para calificar.' },
    ];
    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100001, background: 'rgba(7,59,76,0.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '20px 12px' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ ...S.panel, maxWidth: 560, width: '100%', margin: '10px auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, color: COL.azul }}>❓ Guía rápida del profesor</h2>
                    <button onClick={onClose} style={{ ...S.btn('#94a3b8'), padding: '6px 12px' }}>✕</button>
                </div>
                <p style={{ color: '#555', marginTop: 8 }}>Con <b>¿Quién es quién?</b> tus alumnos se conocen mejor: rellenan un test y luego juegan a adivinar quién dijo cada cosa.</p>
                <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {pasos.map((p, i) => (
                        <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: '#f8fafc', borderRadius: 12, padding: '10px 12px' }}>
                            <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>{p.e}</span>
                            <div>
                                <b style={{ color: COL.oscuro }}>{i + 1}. {p.t}</b>
                                <div style={{ color: '#555', fontSize: '0.9rem', marginTop: 2 }}>{p.d}</div>
                            </div>
                        </li>
                    ))}
                </ol>
                <button style={{ ...S.btn(COL.verde), marginTop: 18, width: '100%' }} onClick={onClose}>¡Entendido!</button>
            </div>
        </div>
    );
}

// Panel del profesor para incrustar en otras herramientas (p. ej. InformesJuegos2).
export function QuienEsQuienPanel({ usuario }) {
    return <PanelProfesor usuario={usuario} />;
}
