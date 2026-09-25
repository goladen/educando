import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    ArrowLeft, Search, Play, Users, Trophy, Volume2, VolumeX, Settings, LogOut,
    Star, Maximize, Minimize, Pause, RotateCcw, Check, X, Eye, Plus, Minus, Edit3, Smartphone, Trash2,
} from 'lucide-react';
import { db } from './firebase';
import { collection, query, where, getDocs, doc, getDoc, addDoc } from 'firebase/firestore';
import { guardarRegistroLocal } from './utils/registrosLocales';
import { listarRecursosLocales, borrarRecursoLocal } from './utils/recursosLocales';
import { categoriasDeRecurso, esRespuestaCorrecta, barajar } from './utils/normalizarPreguntas';
import {
    sonidoCorrecto, sonidoIncorrecto, sonidoPasar, sonidoFinal,
    sonidoActivo, setSonidoActivo, despertarAudio,
    SONIDOS_ACIERTO, SONIDOS_FALLO, getSonidoAcierto, getSonidoFallo,
    setSonidoAcierto, setSonidoFallo,
} from './utils/sonidosFeedback';
import EditorMoneyBoard from './components/EditorMoneyBoard';
import { useEfectosPuntos, CapaEfectos, ESTILOS_EFECTO } from './components/EfectosPuntos';

/* =====================================================================
 *  MONEY BOARD  (tablero de categorías, estilo concurso por equipos)
 *  - Cada HOJA del recurso es una CATEGORÍA (columna).
 *  - Cada pregunta de la hoja es una casilla de 100, 200, 300, 400, 500.
 *  - Funciona con CUALQUIER recurso que tenga 2 o más hojas.
 *  - Dos modos: MODERADOR (el profe puntúa con ✓/✗) y AUTO (autocorrección).
 * ===================================================================== */

const TIPO_JUEGO = 'JEOPARDY';
const MAX_CATS = 6;
const MAX_FILAS = 5;

const AVATARES = ['🍊', '🍓', '🍌', '🍐', '🍎', '🥝', '🍇', '🍒', '🦊', '🐼', '🐙', '🚀'];
const COLORES = ['#e67e22', '#e74c3c', '#f1c40f', '#27ae60', '#e6317f', '#16a085', '#8e44ad', '#2980b9'];

const NOMBRES_DEFECTO = ['Equipo 1', 'Equipo 2', 'Equipo 3', 'Equipo 4', 'Equipo 5', 'Equipo 6'];

// ============================ ESTILOS BASE ===========================
const FUENTE = "'Segoe UI', Roboto, sans-serif";

const menuWrap = {
    position: 'fixed', inset: 0, zIndex: 9998, overflowY: 'auto',
    background: 'linear-gradient(160deg, #060b1c 0%, #0f1f4d 55%, #060b1c 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '20px 14px', fontFamily: FUENTE, boxSizing: 'border-box',
};

const tarjeta = {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: 22, padding: '24px 26px', width: '100%', maxWidth: 620,
    color: '#eaf1ff', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', boxSizing: 'border-box',
};

const btnAtras = {
    background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)',
    color: '#cfe0ff', borderRadius: 10, padding: '7px 13px', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', fontFamily: 'inherit',
};

const btnPrincipal = {
    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white', border: 'none',
    borderRadius: 14, padding: '15px 22px', fontSize: '1.05rem', fontWeight: 800,
    cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 8px 24px rgba(37,99,235,0.45)',
};

const btnSecundario = {
    background: 'rgba(255,255,255,0.12)', color: '#eaf1ff', border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: 14, padding: '13px 22px', fontSize: '0.98rem', fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit',
};

const inputEstilo = {
    padding: '10px 12px', borderRadius: 10, border: '1.5px solid rgba(255,255,255,0.16)',
    background: 'rgba(0,0,0,0.3)', color: '#eaf1ff', fontSize: '0.95rem',
    outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit',
};

const chip = (bg) => ({
    background: bg, color: 'white', borderRadius: 999, padding: '5px 13px',
    fontSize: '0.84rem', fontWeight: 700, display: 'inline-block',
});

// ============================ UTILIDADES =============================
const fmt = (n) => (n < 0 ? `-$${Math.abs(n)}` : `$${n}`);

/** Construye el tablero a partir de las categorías elegidas. */
function construirTablero(categorias, nFilas, valorBase, mezclar) {
    const cats = categorias.map((c) => {
        const ps = mezclar ? barajar(c.preguntas) : c.preguntas;
        const casillas = Array.from({ length: nFilas }, (_, f) => ({
            pregunta: ps[f] || null,
            valor: valorBase * (f + 1),
            jugada: false,
            doble: false,
        }));
        return { nombre: c.nombre, casillas };
    });

    // Una casilla al azar (nunca de la primera fila) se marca como "Pikt Doble".
    const candidatas = [];
    cats.forEach((c, ci) => c.casillas.forEach((cas, fi) => {
        if (cas.pregunta && fi > 0) candidatas.push([ci, fi]);
    }));
    if (candidatas.length) {
        const [ci, fi] = candidatas[Math.floor(Math.random() * candidatas.length)];
        cats[ci].casillas[fi].doble = true;
    }
    return cats;
}

/** Pregunta suelta que no se haya usado en el tablero, para la ronda final. */
function elegirPreguntaFinal(categorias, usadas = new Set()) {
    const libres = categorias.flatMap(c => c.preguntas).filter(p => !usadas.has(p.enunciado));
    const pool = libres.length ? libres : categorias.flatMap(c => c.preguntas);
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}

// =====================================================================
//  BUSCADOR DE RECURSOS  (solo recursos con 2+ categorías jugables)
// =====================================================================
function BuscadorRecursos({ onBack, onPick }) {
    const [busqueda, setBusqueda] = useState('');
    const [todos, setTodos] = useState([]);
    const [cargando, setCargando] = useState(true);

    // Tableros guardados en este aparato por quien no tenía sesión iniciada.
    const [locales, setLocales] = useState([]);
    useEffect(() => {
        setLocales(listarRecursosLocales()
            .map(r => ({ r, cats: categoriasDeRecurso(r) }))
            .filter(x => x.cats.length >= 2));
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const snap = await getDocs(query(collection(db, 'resources'), where('isPrivate', '==', false)));
                const docs = snap.docs.map(d => ({ ...d.data(), id: d.id }));
                const jugables = docs
                    .map(r => ({ r, cats: categoriasDeRecurso(r) }))
                    .filter(x => x.cats.length >= 2)
                    .sort((a, b) => (b.r.playCount || 0) - (a.r.playCount || 0));
                setTodos(jugables);
            } catch (e) { console.error('Buscador Money Board:', e); }
            setCargando(false);
        })();
    }, []);

    const q = busqueda.toLowerCase().trim();
    const resultados = !q ? todos : todos.filter(({ r, cats }) =>
        String(r.titulo || '').toLowerCase().includes(q) ||
        String(r.temas || '').toLowerCase().includes(q) ||
        cats.some(c => c.nombre.toLowerCase().includes(q))
    );

    return (
        <div style={menuWrap}>
            <div style={{ ...tarjeta, maxWidth: 580 }}>
                <button onClick={onBack} style={btnAtras}><ArrowLeft size={16} /> Atrás</button>
                <h2 style={{ color: '#f5c518', margin: '10px 0 6px', display: 'flex', alignItems: 'center', gap: 9, fontSize: '1.35rem' }}>
                    <Search size={21} /> Elegir recurso
                </h2>
                <p style={{ color: '#90a4c8', fontSize: '0.85rem', margin: '0 0 12px' }}>
                    Cada <b>hoja</b> del recurso será una categoría del tablero. Solo aparecen recursos con 2 o más hojas.
                </p>
                <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Título, tema, categoría…"
                    style={{ ...inputEstilo, marginBottom: 12 }} />

                {locales.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                        <div style={{ color: '#f0a44a', fontSize: '0.76rem', fontWeight: 800, letterSpacing: 1, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Smartphone size={13} /> EN ESTE DISPOSITIVO
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {locales.map(({ r, cats }) => (
                                <div key={r.id} style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
                                    <button onClick={() => onPick(r, cats)} style={{
                                        flex: 1, textAlign: 'left', padding: '12px 14px', borderRadius: 12,
                                        border: '1px solid rgba(240,164,74,0.4)', background: 'rgba(240,164,74,0.1)',
                                        color: '#eaf1ff', cursor: 'pointer', fontFamily: 'inherit',
                                    }}>
                                        <div style={{ fontWeight: 700 }}>{r.titulo || 'Sin título'}</div>
                                        <div style={{ fontSize: 11, color: '#c8a172', marginTop: 3 }}>
                                            Solo en este navegador · {cats.length} categorías · {cats.reduce((s, c) => s + c.preguntas.length, 0)} preguntas
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (!window.confirm(`¿Borrar «${r.titulo}» de este dispositivo? No se puede deshacer.`)) return;
                                            borrarRecursoLocal(r.id);
                                            setLocales(ls => ls.filter(x => x.r.id !== r.id));
                                        }}
                                        title="Borrar de este dispositivo"
                                        style={{ padding: '0 11px', borderRadius: 12, border: '1px solid rgba(231,76,60,0.35)', background: 'rgba(231,76,60,0.12)', color: '#ff8d80', cursor: 'pointer' }}>
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {cargando ? <p style={{ color: '#90a4c8', textAlign: 'center' }}>Cargando biblioteca…</p>
                        : resultados.length === 0 ? <p style={{ color: '#90a4c8', textAlign: 'center' }}>Sin recursos con 2 o más hojas.</p>
                            : resultados.map(({ r, cats }) => (
                                <button key={r.id} onClick={() => onPick(r, cats)} style={{
                                    textAlign: 'left', padding: '12px 14px', borderRadius: 12,
                                    border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)',
                                    color: '#eaf1ff', cursor: 'pointer', fontFamily: 'inherit',
                                }}>
                                    <div style={{ fontWeight: 700 }}>{r.titulo || 'Sin título'}</div>
                                    <div style={{ fontSize: 11, color: '#90a4c8', marginTop: 3 }}>
                                        {r.tipoJuego || 'Recurso'}{r.profesorNombre ? ` · ${r.profesorNombre}` : ''} · {cats.length} categorías · {cats.reduce((s, c) => s + c.preguntas.length, 0)} preguntas
                                    </div>
                                    <div style={{ fontSize: 11, color: '#5f7599', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {cats.map(c => c.nombre).join(' · ')}
                                    </div>
                                </button>
                            ))}
                </div>
            </div>
        </div>
    );
}

// =====================================================================
//  SELECTOR DE SONIDO (suena al elegir y con el botón de probar)
// =====================================================================
function SelectorSonido({ etiqueta, color, opciones, valor, onChange, onProbar }) {
    return (
        <label style={{ fontSize: '0.85rem', color: '#cfe0ff', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color }}>●</span> {etiqueta}:&nbsp;
            <select value={valor} onChange={e => { despertarAudio(); onChange(e.target.value); }}
                style={{ ...inputEstilo, width: 'auto', display: 'inline-block', padding: '7px 10px' }}>
                {opciones.map(s => <option key={s.id} value={s.id}>{s.emoji} {s.nombre}</option>)}
            </select>
            <button type="button" onClick={() => { despertarAudio(); onProbar(); }} title="Escuchar"
                style={{ ...btnAtras, padding: '7px 10px' }}>
                <Volume2 size={15} />
            </button>
        </label>
    );
}

// =====================================================================
//  CONFIGURACIÓN DE LA PARTIDA
// =====================================================================
function PantallaConfig({ titulo, categorias, onBack, onJugar }) {
    const [sel, setSel] = useState(() => categorias.slice(0, MAX_CATS).map((_, i) => i));
    const [nFilas, setNFilas] = useState(() => Math.min(MAX_FILAS, Math.max(...categorias.map(c => c.preguntas.length))));
    const [valorBase, setValorBase] = useState(100);
    const [mezclar, setMezclar] = useState(false);
    const [modo, setModo] = useState('MODERADOR');
    const [segundos, setSegundos] = useState(30);
    const [conFinal, setConFinal] = useState(true);
    const [efecto, setEfecto] = useState('MIX');
    const [sonidoOk, setSonidoOk] = useState(getSonidoAcierto);
    const [sonidoMal, setSonidoMal] = useState(getSonidoFallo);
    const [nEquipos, setNEquipos] = useState(4);
    const [equipos, setEquipos] = useState(() =>
        NOMBRES_DEFECTO.map((n, i) => ({ nombre: n, avatar: AVATARES[i], color: COLORES[i] }))
    );

    const toggleCat = (i) => setSel(s => s.includes(i) ? s.filter(x => x !== i) : (s.length >= MAX_CATS ? s : [...s, i]));
    const setEquipo = (i, campo, val) => setEquipos(e => e.map((x, j) => j === i ? { ...x, [campo]: val } : x));

    const jugar = () => {
        if (sel.length < 2) return alert('Elige al menos 2 categorías.');
        onJugar({
            categorias: sel.map(i => categorias[i]),
            nFilas, valorBase, mezclar, modo, segundos, conFinal, efecto, sonidoOk, sonidoMal,
            equipos: equipos.slice(0, nEquipos).map((e, i) => ({
                id: i, nombre: e.nombre.trim() || NOMBRES_DEFECTO[i],
                avatar: e.avatar, color: e.color, puntos: 0, aciertos: 0, fallos: 0,
            })),
        });
    };

    const secTitulo = { color: '#f5c518', fontWeight: 800, fontSize: '0.92rem', margin: '18px 0 8px' };

    return (
        <div style={{ ...menuWrap, alignItems: 'flex-start' }}>
            <div style={{ ...tarjeta, maxWidth: 680, margin: 'auto' }}>
                <button onClick={onBack} style={btnAtras}><ArrowLeft size={16} /> Atrás</button>
                <h2 style={{ color: 'white', margin: '10px 0 2px', fontSize: '1.4rem' }}>{titulo}</h2>
                <p style={{ color: '#90a4c8', fontSize: '0.85rem', margin: 0 }}>Prepara el tablero y los equipos.</p>

                {/* --- Categorías --- */}
                <div style={secTitulo}>1 · Categorías del tablero ({sel.length}/{MAX_CATS})</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {categorias.map((c, i) => {
                        const on = sel.includes(i);
                        return (
                            <button key={i} onClick={() => toggleCat(i)} style={{
                                padding: '9px 13px', borderRadius: 11, cursor: 'pointer', fontFamily: 'inherit',
                                border: on ? '2px solid #2563eb' : '1px solid rgba(255,255,255,0.15)',
                                background: on ? 'rgba(37,99,235,0.28)' : 'rgba(255,255,255,0.05)',
                                color: on ? 'white' : '#90a4c8', fontWeight: on ? 700 : 500, fontSize: '0.86rem',
                            }}>
                                {on && `${sel.indexOf(i) + 1}. `}{c.nombre}
                                <span style={{ color: '#5f7599', marginLeft: 6 }}>({c.preguntas.length})</span>
                            </button>
                        );
                    })}
                </div>

                {/* --- Tablero --- */}
                <div style={secTitulo}>2 · Tablero</div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.85rem', color: '#cfe0ff' }}>
                        Filas:&nbsp;
                        <select value={nFilas} onChange={e => setNFilas(Number(e.target.value))} style={{ ...inputEstilo, width: 'auto', display: 'inline-block', padding: '7px 10px' }}>
                            {[3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </label>
                    <label style={{ fontSize: '0.85rem', color: '#cfe0ff' }}>
                        Valor base:&nbsp;
                        <select value={valorBase} onChange={e => setValorBase(Number(e.target.value))} style={{ ...inputEstilo, width: 'auto', display: 'inline-block', padding: '7px 10px' }}>
                            {[10, 100, 200].map(n => <option key={n} value={n}>${n}</option>)}
                        </select>
                    </label>
                    <label style={{ fontSize: '0.85rem', color: '#cfe0ff', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="checkbox" checked={mezclar} onChange={e => setMezclar(e.target.checked)} /> Mezclar preguntas
                    </label>
                    <label style={{ fontSize: '0.85rem', color: '#cfe0ff', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="checkbox" checked={conFinal} onChange={e => setConFinal(e.target.checked)} /> Pregunta final con apuestas
                    </label>
                </div>

                {/* --- Modo --- */}
                <div style={secTitulo}>3 · Cómo se corrige</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {[
                        { id: 'MODERADOR', t: '👩‍🏫 Moderador', d: 'El profe muestra la respuesta y puntúa con ✓ / ✗. Vale para cualquier pregunta.' },
                        { id: 'AUTO', t: '🤖 Autocorrección', d: 'El equipo responde en pantalla y el juego corrige solo.' },
                    ].map(m => (
                        <button key={m.id} onClick={() => setModo(m.id)} style={{
                            flex: '1 1 240px', textAlign: 'left', padding: '12px 14px', borderRadius: 13, cursor: 'pointer',
                            border: modo === m.id ? '2px solid #2563eb' : '1px solid rgba(255,255,255,0.15)',
                            background: modo === m.id ? 'rgba(37,99,235,0.24)' : 'rgba(255,255,255,0.05)',
                            color: '#eaf1ff', fontFamily: 'inherit',
                        }}>
                            <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{m.t}</div>
                            <div style={{ fontSize: '0.78rem', color: '#90a4c8', marginTop: 3 }}>{m.d}</div>
                        </button>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10 }}>
                    <label style={{ fontSize: '0.85rem', color: '#cfe0ff' }}>
                        Tiempo por pregunta:&nbsp;
                        <select value={segundos} onChange={e => setSegundos(Number(e.target.value))} style={{ ...inputEstilo, width: 'auto', display: 'inline-block', padding: '7px 10px' }}>
                            {[0, 15, 20, 30, 45, 60, 90].map(n => <option key={n} value={n}>{n === 0 ? 'Sin tiempo' : `${n} s`}</option>)}
                        </select>
                    </label>
                    <label style={{ fontSize: '0.85rem', color: '#cfe0ff' }}>
                        Efecto al puntuar:&nbsp;
                        <select value={efecto} onChange={e => setEfecto(e.target.value)} style={{ ...inputEstilo, width: 'auto', display: 'inline-block', padding: '7px 10px' }}>
                            {ESTILOS_EFECTO.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
                        </select>
                    </label>
                </div>

                {/* Sonidos: se prueban desde aquí mismo */}
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10 }}>
                    <SelectorSonido
                        etiqueta="Sonido de acierto" color="#2ecc71" opciones={SONIDOS_ACIERTO} valor={sonidoOk}
                        onChange={(id) => { setSonidoOk(id); setSonidoAcierto(id); sonidoCorrecto(id, true); }}
                        onProbar={() => sonidoCorrecto(sonidoOk, true)}
                    />
                    <SelectorSonido
                        etiqueta="Sonido de fallo" color="#e74c3c" opciones={SONIDOS_FALLO} valor={sonidoMal}
                        onChange={(id) => { setSonidoMal(id); setSonidoFallo(id); sonidoIncorrecto(id, true); }}
                        onProbar={() => sonidoIncorrecto(sonidoMal, true)}
                    />
                </div>

                {/* --- Equipos --- */}
                <div style={secTitulo}>4 · Equipos</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <button onClick={() => setNEquipos(n => Math.max(2, n - 1))} style={{ ...btnAtras, padding: '6px 10px' }}><Minus size={15} /></button>
                    <b style={{ color: 'white', minWidth: 80, textAlign: 'center' }}>{nEquipos} equipos</b>
                    <button onClick={() => setNEquipos(n => Math.min(6, n + 1))} style={{ ...btnAtras, padding: '6px 10px' }}><Plus size={15} /></button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {equipos.slice(0, nEquipos).map((e, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <select value={e.avatar} onChange={ev => setEquipo(i, 'avatar', ev.target.value)}
                                style={{ ...inputEstilo, width: 68, padding: '8px 6px', fontSize: '1.3rem', textAlign: 'center' }}>
                                {AVATARES.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                            <input value={e.nombre} onChange={ev => setEquipo(i, 'nombre', ev.target.value)}
                                maxLength={22} style={{ ...inputEstilo, flex: 1 }} />
                            <div style={{ width: 26, height: 26, borderRadius: '50%', background: e.color, flexShrink: 0 }} />
                        </div>
                    ))}
                </div>

                <button onClick={jugar} style={{ ...btnPrincipal, width: '100%', marginTop: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
                    <Play size={20} fill="white" /> ¡Empezar partida!
                </button>
            </div>
        </div>
    );
}

// =====================================================================
//  MODAL DE PREGUNTA
// =====================================================================
function ModalPregunta({ casilla, categoria, modo, equipos, turno, segundos, origen, onPuntuar, onCerrar, sonido, sonidoOk, sonidoMal }) {
    const { pregunta, doble } = casilla;
    const valor = casilla.valor * (doble ? 2 : 1);

    const [revelada, setRevelada] = useState(false);
    const [respuesta, setRespuesta] = useState('');
    const [orden, setOrden] = useState([]);
    const [resultado, setResultado] = useState(null); // 'OK' | 'MAL' | 'TIEMPO'
    const [restante, setRestante] = useState(segundos);
    const [pausado, setPausado] = useState(false);
    const [puntuados, setPuntuados] = useState({});   // equipoId -> 'OK' | 'MAL'

    const bloquesMezclados = useMemo(
        () => (pregunta.tipo === 'ORDENAR' ? barajar(pregunta.bloques) : []),
        [pregunta]
    );

    // --- Temporizador ---
    useEffect(() => {
        if (!segundos || revelada || pausado) return;
        if (restante <= 0) { setRevelada(true); setResultado(r => r || 'TIEMPO'); if (sonido) sonidoPasar(); return; }
        const t = setTimeout(() => setRestante(r => r - 1), 1000);
        return () => clearTimeout(t);
    }, [restante, revelada, pausado, segundos, sonido]);

    const revelar = () => { setRevelada(true); if (sonido) sonidoPasar(); };

    // Al sumar puntos a un equipo el panel se cierra solo (tras ver el efecto).
    const cierreAuto = useRef(null);
    useEffect(() => () => clearTimeout(cierreAuto.current), []);
    const cerrarTrasAcierto = () => {
        clearTimeout(cierreAuto.current);
        cierreAuto.current = setTimeout(() => onCerrar(), 1000);
    };

    const comprobar = (dada, ev) => {
        const ok = esRespuestaCorrecta(pregunta, dada);
        setResultado(ok ? 'OK' : 'MAL');
        setRevelada(true);
        if (sonido) (ok ? sonidoCorrecto(sonidoOk) : sonidoIncorrecto(sonidoMal));
        onPuntuar(equipos[turno].id, ok ? valor : -valor, ok, ev);
        setPuntuados({ [equipos[turno].id]: ok ? 'OK' : 'MAL' });
        if (ok) cerrarTrasAcierto();
    };

    const puntuarEquipo = (eq, ok, ev) => {
        const previo = puntuados[eq.id];
        if (previo) return;                       // una sola vez por equipo y pregunta
        if (sonido) (ok ? sonidoCorrecto(sonidoOk) : sonidoIncorrecto(sonidoMal));
        onPuntuar(eq.id, ok ? valor : -valor, ok, ev);
        setPuntuados(p => ({ ...p, [eq.id]: ok ? 'OK' : 'MAL' }));
        if (!revelada && ok) setRevelada(true);
        // Acierto: se cierra y pasa el turno. Fallo: sigue abierta para que rebote a otro equipo.
        if (ok) cerrarTrasAcierto();
    };

    const equipoActivo = equipos[turno];

    return (
        <div style={{
            position: 'absolute', inset: 0, zIndex: 60, fontFamily: FUENTE,
            background: 'rgba(4,9,24,0.6)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 'clamp(6px, 1.2vw, 18px)', boxSizing: 'border-box',
            animation: 'pbFondo 0.22s ease both',
        }}>
            <div style={{
                width: '100%', maxWidth: 1180, maxHeight: '100%',
                display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
                padding: 'clamp(12px, 1.8vw, 24px)', borderRadius: 22, overflowY: 'auto',
                background: 'linear-gradient(160deg, #10224f 0%, #1a3a8f 58%, #10224f 100%)',
                border: '2px solid rgba(245,197,24,0.35)',
                boxShadow: '0 30px 90px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06) inset',
                transformOrigin: `${origen?.x ?? 50}% ${origen?.y ?? 50}%`,
                animation: 'pbSalto 0.42s cubic-bezier(0.22, 1.2, 0.36, 1) both',
            }}>
            {/* Cabecera */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={chip('rgba(255,255,255,0.14)')}>{categoria}</span>
                <span style={chip(doble ? '#8e44ad' : '#1d4ed8')}>{doble ? '⭐ PIKT DOBLE · ' : ''}{fmt(valor)}</span>
                {modo === 'AUTO' && <span style={chip(equipoActivo.color)}>{equipoActivo.avatar} {equipoActivo.nombre}</span>}
                <div style={{ flex: 1 }} />
                {!!segundos && !revelada && (
                    <>
                        <button onClick={() => setPausado(p => !p)} style={{ ...btnAtras, padding: '6px 10px' }}>
                            {pausado ? <Play size={16} /> : <Pause size={16} />}
                        </button>
                        <span style={{
                            fontSize: 'clamp(1.4rem, 4vw, 2.2rem)', fontWeight: 900,
                            color: restante <= 5 ? '#ff5252' : '#f5c518', minWidth: 62, textAlign: 'right',
                        }}>{restante}</span>
                    </>
                )}
                <button onClick={() => onCerrar()} style={{ ...btnAtras, padding: '7px 12px' }}><X size={16} /> Cerrar</button>
            </div>

            {/* Enunciado */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 22, padding: '14px 0', overflowY: 'auto' }}>
                <h2 style={{
                    color: 'white', textAlign: 'center', margin: 0, maxWidth: 1100,
                    fontSize: 'clamp(1.3rem, 3.6vw, 2.6rem)', fontWeight: 800, lineHeight: 1.3,
                }}>
                    {pregunta.tipo === 'RELLENAR'
                        ? <>{pregunta.bloques[0]} <span style={{ color: '#f5c518' }}>{revelada ? pregunta.correcta : '______'}</span> {pregunta.bloques[2]}</>
                        : pregunta.enunciado}
                </h2>

                {/* Opciones múltiples */}
                {pregunta.tipo === 'MULTIPLE' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, width: '100%', maxWidth: 900 }}>
                        {pregunta.opciones.map((op, i) => {
                            const esCorrecta = revelada && op === pregunta.correcta;
                            return (
                                <button key={i}
                                    onClick={(ev) => { if (modo === 'AUTO' && !revelada) comprobar(op, ev); }}
                                    disabled={modo === 'MODERADOR' || revelada}
                                    style={{
                                        padding: 'clamp(12px, 2vw, 20px)', borderRadius: 16, fontFamily: 'inherit',
                                        fontSize: 'clamp(0.95rem, 2vw, 1.3rem)', fontWeight: 700,
                                        border: esCorrecta ? '3px solid #2ecc71' : '2px solid rgba(255,255,255,0.2)',
                                        background: esCorrecta ? 'rgba(46,204,113,0.25)' : 'rgba(255,255,255,0.08)',
                                        color: 'white', cursor: (modo === 'AUTO' && !revelada) ? 'pointer' : 'default',
                                    }}>
                                    {op}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Ordenar */}
                {pregunta.tipo === 'ORDENAR' && (
                    <div style={{ width: '100%', maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
                        <div style={{ minHeight: 54, display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', padding: 10, borderRadius: 14, background: 'rgba(0,0,0,0.3)', width: '100%', boxSizing: 'border-box' }}>
                            {orden.length === 0 ? <span style={{ color: '#7f92b8' }}>Pulsa los bloques en orden…</span>
                                : orden.map((b, i) => (
                                    <span key={i} onClick={() => !revelada && setOrden(o => o.filter((_, j) => j !== i))}
                                        style={{ ...chip('#1d4ed8'), fontSize: '1.05rem', cursor: revelada ? 'default' : 'pointer' }}>{b}</span>
                                ))}
                        </div>
                        {!revelada && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                                {bloquesMezclados.filter(b => !orden.includes(b)).map((b, i) => (
                                    <button key={i} onClick={() => setOrden(o => [...o, b])}
                                        style={{ ...chip('rgba(255,255,255,0.14)'), fontSize: '1.05rem', cursor: 'pointer', border: 'none', fontFamily: 'inherit' }}>{b}</button>
                                ))}
                            </div>
                        )}
                        {revelada && <div style={{ color: '#2ecc71', fontSize: 'clamp(1rem,2.4vw,1.5rem)', fontWeight: 800 }}>✔ {pregunta.bloques.join(' ')}</div>}
                        {!revelada && modo === 'AUTO' && orden.length === pregunta.bloques.length && (
                            <button onClick={(ev) => comprobar(orden.join(' '), ev)} style={btnPrincipal}>Comprobar</button>
                        )}
                    </div>
                )}

                {/* Respuesta corta / rellenar */}
                {(pregunta.tipo === 'CORTA' || pregunta.tipo === 'RELLENAR') && (
                    <>
                        {modo === 'AUTO' && !revelada && (
                            <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 560 }}>
                                <input autoFocus value={respuesta} onChange={e => setRespuesta(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter' && respuesta.trim()) comprobar(respuesta, e); }}
                                    placeholder="Escribe la respuesta…"
                                    style={{ ...inputEstilo, fontSize: '1.15rem', padding: '14px 16px' }} />
                                <button onClick={(ev) => respuesta.trim() && comprobar(respuesta, ev)} style={btnPrincipal}>OK</button>
                            </div>
                        )}
                        {revelada && pregunta.tipo === 'CORTA' && (
                            <div style={{ color: '#2ecc71', fontSize: 'clamp(1.2rem,3vw,2rem)', fontWeight: 900 }}>✔ {pregunta.correcta}</div>
                        )}
                    </>
                )}

                {resultado && (
                    <div style={{ fontSize: 'clamp(1.1rem,2.6vw,1.6rem)', fontWeight: 800, color: resultado === 'OK' ? '#2ecc71' : '#ff5252' }}>
                        {resultado === 'OK' ? '¡Correcto!' : resultado === 'TIEMPO' ? '⏱ Se acabó el tiempo' : 'Incorrecto'}
                    </div>
                )}

                {!revelada && modo === 'MODERADOR' && (
                    <button onClick={revelar} style={{ ...btnSecundario, display: 'flex', alignItems: 'center', gap: 9 }}>
                        <Eye size={19} /> Mostrar respuesta
                    </button>
                )}
            </div>

            {/* Puntuación por equipos (modo moderador) */}
            {modo === 'MODERADOR' && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {equipos.map(eq => {
                        const p = puntuados[eq.id];
                        return (
                            <div key={eq.id} style={{
                                background: 'rgba(0,0,0,0.32)', borderRadius: 14, padding: '9px 12px',
                                border: `2px solid ${p === 'OK' ? '#2ecc71' : p === 'MAL' ? '#e74c3c' : 'rgba(255,255,255,0.12)'}`,
                                display: 'flex', alignItems: 'center', gap: 9, minWidth: 150,
                            }}>
                                <span style={{ fontSize: '1.5rem' }}>{eq.avatar}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ color: 'white', fontWeight: 700, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eq.nombre}</div>
                                    <div style={{ color: '#f5c518', fontWeight: 800, fontSize: '0.9rem' }}>{fmt(eq.puntos)}</div>
                                </div>
                                <button onClick={(ev) => puntuarEquipo(eq, true, ev)} disabled={!!p} title={`+${valor}`}
                                    style={{ background: p ? '#2c3e50' : '#1e9e57', border: 'none', borderRadius: 10, padding: '9px 11px', cursor: p ? 'default' : 'pointer', color: 'white' }}>
                                    <Check size={18} />
                                </button>
                                <button onClick={(ev) => puntuarEquipo(eq, false, ev)} disabled={!!p} title={`-${valor}`}
                                    style={{ background: p ? '#2c3e50' : '#c0392b', border: 'none', borderRadius: 10, padding: '9px 11px', cursor: p ? 'default' : 'pointer', color: 'white' }}>
                                    <X size={18} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {(revelada || modo === 'MODERADOR') && (
                <button onClick={() => onCerrar()} style={{ ...btnPrincipal, alignSelf: 'center', marginTop: 14, minWidth: 260 }}>
                    Volver al tablero
                </button>
            )}
            </div>

            <style>{`
                @keyframes pbFondo { from { opacity: 0; } to { opacity: 1; } }
                @keyframes pbSalto {
                    0%   { transform: scale(0.12) translateY(10px); opacity: 0; }
                    60%  { opacity: 1; }
                    100% { transform: scale(1) translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
}

// =====================================================================
//  RONDA FINAL CON APUESTAS
// =====================================================================
function RondaFinal({ pregunta, equipos, sonido, estilo = 'MIX', onTerminar }) {
    const efx = useEfectosPuntos();
    const [fase, setFase] = useState('APUESTAS');   // APUESTAS | PREGUNTA | RESULTADO
    const [apuestas, setApuestas] = useState(() => Object.fromEntries(equipos.map(e => [e.id, 0])));
    const [aciertos, setAciertos] = useState({});

    const maxApuesta = (e) => Math.max(0, e.puntos);

    const confirmar = () => {
        const finales = equipos.map(e => {
            const ok = aciertos[e.id];
            const delta = ok === true ? apuestas[e.id] : ok === false ? -apuestas[e.id] : 0;
            return { ...e, puntos: e.puntos + delta, aciertos: e.aciertos + (ok === true ? 1 : 0), fallos: e.fallos + (ok === false ? 1 : 0) };
        });
        if (sonido) sonidoFinal();
        onTerminar(finales);
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 10001, fontFamily: FUENTE, overflowY: 'auto',
            background: 'linear-gradient(160deg, #1a0b33 0%, #3b1568 60%, #1a0b33 100%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: 'clamp(14px, 3vw, 30px)', boxSizing: 'border-box', gap: 20,
        }}>
            <CapaEfectos efectos={efx.efectos} />
            <h1 style={{ color: '#f5c518', margin: 0, fontSize: 'clamp(1.6rem, 5vw, 3rem)', fontWeight: 900, textAlign: 'center' }}>
                ⭐ PREGUNTA FINAL
            </h1>

            {fase === 'APUESTAS' && (
                <>
                    <p style={{ color: '#d7c8f5', margin: 0, textAlign: 'center', fontSize: '1rem' }}>
                        Cada equipo apuesta parte de sus puntos. Si acierta los gana; si falla, los pierde.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 520 }}>
                        {equipos.map(e => (
                            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(0,0,0,0.3)', padding: '11px 14px', borderRadius: 14 }}>
                                <span style={{ fontSize: '1.7rem' }}>{e.avatar}</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ color: 'white', fontWeight: 700 }}>{e.nombre}</div>
                                    <div style={{ color: '#f5c518', fontSize: '0.85rem' }}>{fmt(e.puntos)} disponibles</div>
                                </div>
                                <input type="number" min={0} max={maxApuesta(e)} value={apuestas[e.id]}
                                    onChange={ev => setApuestas(a => ({ ...a, [e.id]: Math.max(0, Math.min(maxApuesta(e), Number(ev.target.value) || 0)) }))}
                                    style={{ ...inputEstilo, width: 120, textAlign: 'right', fontWeight: 800 }} />
                            </div>
                        ))}
                    </div>
                    <button onClick={() => setFase('PREGUNTA')} style={btnPrincipal}>Ver la pregunta</button>
                </>
            )}

            {fase !== 'APUESTAS' && (
                <>
                    <h2 style={{ color: 'white', textAlign: 'center', margin: 0, maxWidth: 1000, fontSize: 'clamp(1.2rem, 3.4vw, 2.3rem)', fontWeight: 800, lineHeight: 1.35 }}>
                        {pregunta.tipo === 'RELLENAR'
                            ? <>{pregunta.bloques[0]} <span style={{ color: '#f5c518' }}>{fase === 'RESULTADO' ? pregunta.correcta : '______'}</span> {pregunta.bloques[2]}</>
                            : pregunta.enunciado}
                    </h2>

                    {fase === 'RESULTADO' && pregunta.tipo !== 'RELLENAR' && (
                        <div style={{ color: '#2ecc71', fontWeight: 900, fontSize: 'clamp(1.2rem,3vw,2rem)', textAlign: 'center' }}>
                            ✔ {pregunta.tipo === 'ORDENAR' ? pregunta.bloques.join(' ') : pregunta.correcta}
                        </div>
                    )}

                    {fase === 'PREGUNTA' && (
                        <button onClick={() => setFase('RESULTADO')} style={{ ...btnSecundario, display: 'flex', alignItems: 'center', gap: 9 }}>
                            <Eye size={19} /> Mostrar respuesta
                        </button>
                    )}

                    {fase === 'RESULTADO' && (
                        <>
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                                {equipos.map(e => (
                                    <div key={e.id} style={{
                                        background: 'rgba(0,0,0,0.32)', borderRadius: 14, padding: '10px 13px',
                                        display: 'flex', alignItems: 'center', gap: 9, minWidth: 180,
                                        border: `2px solid ${aciertos[e.id] === true ? '#2ecc71' : aciertos[e.id] === false ? '#e74c3c' : 'rgba(255,255,255,0.12)'}`,
                                    }}>
                                        <span style={{ fontSize: '1.5rem' }}>{e.avatar}</span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ color: 'white', fontWeight: 700, fontSize: '0.84rem' }}>{e.nombre}</div>
                                            <div style={{ color: '#f5c518', fontSize: '0.82rem' }}>apuesta {fmt(apuestas[e.id])}</div>
                                        </div>
                                        <button onClick={(ev) => { setAciertos(a => ({ ...a, [e.id]: true })); efx.lanzarDesdeEvento(ev, { ok: true, texto: `+${fmt(apuestas[e.id])}`, estilo }); }}
                                            style={{ background: aciertos[e.id] === true ? '#2ecc71' : '#1e9e57', border: 'none', borderRadius: 10, padding: '9px 11px', cursor: 'pointer', color: 'white' }}><Check size={18} /></button>
                                        <button onClick={(ev) => { setAciertos(a => ({ ...a, [e.id]: false })); efx.lanzarDesdeEvento(ev, { ok: false, texto: `−${fmt(apuestas[e.id])}`, estilo }); }}
                                            style={{ background: aciertos[e.id] === false ? '#e74c3c' : '#c0392b', border: 'none', borderRadius: 10, padding: '9px 11px', cursor: 'pointer', color: 'white' }}><X size={18} /></button>
                                    </div>
                                ))}
                            </div>
                            <button onClick={confirmar} style={btnPrincipal}>🏆 Ver resultado final</button>
                        </>
                    )}
                </>
            )}
        </div>
    );
}

// =====================================================================
//  PANTALLA FINAL
// =====================================================================
function PantallaFin({ equipos, titulo, onEnviar, onGuardar, guardado, onReiniciar, onSalir }) {
    const orden = [...equipos].sort((a, b) => b.puntos - a.puntos);
    const medallas = ['🥇', '🥈', '🥉'];

    return (
        <div style={menuWrap}>
            <div style={{ ...tarjeta, maxWidth: 560, textAlign: 'center' }}>
                <div style={{ fontSize: 'clamp(3rem,12vw,5rem)' }}>🏆</div>
                <h2 style={{ margin: '4px 0 6px', color: '#f5c518', fontSize: 'clamp(1.5rem,5vw,2.3rem)' }}>¡{orden[0].nombre} gana!</h2>
                <p style={{ color: '#90a4c8', margin: '0 0 16px', fontSize: '0.9rem' }}>{titulo}</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' }}>
                    {orden.map((e, i) => (
                        <div key={e.id} style={{
                            display: 'flex', alignItems: 'center', gap: 11, padding: '10px 13px', borderRadius: 13,
                            background: i === 0 ? 'rgba(245,197,24,0.16)' : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${i === 0 ? 'rgba(245,197,24,0.5)' : 'rgba(255,255,255,0.1)'}`,
                        }}>
                            <span style={{ fontSize: '1.4rem', width: 30 }}>{medallas[i] || `#${i + 1}`}</span>
                            <span style={{ fontSize: '1.6rem' }}>{e.avatar}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ color: 'white', fontWeight: 700 }}>{e.nombre}</div>
                                <div style={{ color: '#90a4c8', fontSize: '0.78rem' }}>✔ {e.aciertos} · ✘ {e.fallos}</div>
                            </div>
                            <b style={{ color: '#f5c518', fontSize: '1.15rem' }}>{fmt(e.puntos)}</b>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 20 }}>
                    <button onClick={onEnviar} style={btnPrincipal}>📤 Enviar al profesor</button>
                    <button onClick={onGuardar} disabled={guardado}
                        style={{ ...btnSecundario, background: guardado ? '#1e6b45' : 'rgba(255,255,255,0.12)' }}>
                        {guardado ? '✅ Guardado en Mis registros' : '💾 Guardar en Mis registros'}
                    </button>
                    <button onClick={onReiniciar} style={btnSecundario}>🔁 Nueva partida</button>
                    <button onClick={onSalir} style={btnSecundario}>Salir</button>
                </div>
            </div>
        </div>
    );
}

// =====================================================================
//  MODAL ENVIAR AL PROFESOR
// =====================================================================
function ModalEnviarProfe({ datos, onClose }) {
    const [codigo, setCodigo] = useState('');
    const [curso, setCurso] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [enviado, setEnviado] = useState(false);
    const [error, setError] = useState('');

    const enviar = async () => {
        const code = codigo.trim().toUpperCase();
        if (!code) { setError('Escribe el código del profesor.'); return; }
        setEnviando(true); setError('');
        try {
            const snap = await getDoc(doc(db, 'codigos_profesor', code));
            if (!snap.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
            const total = datos.equipos.reduce((s, e) => s + e.aciertos + e.fallos, 0);
            const acertadasTotal = datos.equipos.reduce((s, e) => s + e.aciertos, 0);
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: TIPO_JUEGO,
                modalidad: 'Equipos',
                fecha: new Date(),
                codigoProfesor: code,
                recursoTitulo: datos.titulo || '',
                categorias: datos.categorias,
                jugadores: [...datos.equipos]
                    .sort((a, b) => b.puntos - a.puntos)
                    .map((e, i) => ({
                        nombre: e.nombre, curso: curso.trim(), equipo: e.nombre,
                        posicion: i + 1, puntos: e.puntos,
                        aciertos: e.aciertos, fallos: e.fallos,
                        intentos: e.aciertos + e.fallos,
                        porcentaje: (e.aciertos + e.fallos) > 0 ? Math.round((e.aciertos / (e.aciertos + e.fallos)) * 100) : 0,
                    })),
            });
            guardarRegistroLocal(TIPO_JUEGO, {
                titulo: datos.titulo, aciertos: acertadasTotal, intentos: total,
                porcentaje: total > 0 ? Math.round((acertadasTotal / total) * 100) : 0,
                nombre: datos.equipos.map(e => e.nombre).join(', ').slice(0, 60),
                curso: curso.trim(), via: 'profesor',
            });
            setEnviado(true);
        } catch (e) { setError('Error: ' + e.message); }
        setEnviando(false);
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10002, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 14 }}>
            <div style={{ ...tarjeta, maxWidth: 380 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f5c518' }}>📤 Enviar al profesor</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#90a4c8', fontSize: '1.2rem' }}>✕</button>
                </div>
                {enviado ? (
                    <div style={{ textAlign: 'center', padding: '18px 0' }}>
                        <div style={{ fontSize: '3rem' }}>✅</div>
                        <div style={{ color: '#2ecc71', fontWeight: 700 }}>¡Informe enviado!</div>
                        <button onClick={onClose} style={{ ...btnSecundario, marginTop: 16, padding: '9px 22px' }}>Cerrar</button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <p style={{ color: '#90a4c8', fontSize: '0.83rem', margin: 0 }}>
                            Se enviará la clasificación de los {datos.equipos.length} equipos.
                        </p>
                        <div>
                            <label style={{ fontSize: '0.78rem', color: '#90a4c8', fontWeight: 600, display: 'block', marginBottom: 4 }}>Curso / clase</label>
                            <input value={curso} onChange={e => setCurso(e.target.value)} placeholder="Ej: 3º ESO A" style={inputEstilo} />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.78rem', color: '#90a4c8', fontWeight: 600, display: 'block', marginBottom: 4 }}>Código del profesor</label>
                            <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="Ej: PROF01" maxLength={10}
                                style={{ ...inputEstilo, letterSpacing: 2, fontWeight: 700 }} />
                        </div>
                        {error && <div style={{ color: '#e74c3c', fontSize: '0.8rem' }}>⚠ {error}</div>}
                        <div style={{ display: 'flex', gap: 9, marginTop: 4 }}>
                            <button onClick={onClose} style={{ ...btnSecundario, flex: 1, padding: 10, fontSize: '0.9rem' }}>Cancelar</button>
                            <button onClick={enviar} disabled={enviando} style={{ ...btnPrincipal, flex: 2, padding: 10, fontSize: '0.9rem', background: enviando ? '#555' : btnPrincipal.background }}>
                                {enviando ? 'Enviando…' : '📤 Enviar'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// =====================================================================
//  CARTEL "TURNO DE …"  (aparece sobre el tablero al cerrar una pregunta)
// =====================================================================
function CartelTurno({ anuncio }) {
    const { equipo } = anuncio;
    return (
        <div style={{
            position: 'absolute', inset: 0, zIndex: 55, pointerEvents: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FUENTE,
        }}>
            <div style={{
                display: 'flex', alignItems: 'center', gap: 'clamp(10px, 2vw, 22px)',
                padding: 'clamp(12px, 2vw, 22px) clamp(20px, 3.5vw, 44px)', borderRadius: 999,
                background: 'rgba(6,11,28,0.9)', border: `3px solid ${equipo.color}`,
                boxShadow: `0 18px 60px rgba(0,0,0,0.6), 0 0 34px ${equipo.color}55`,
                animation: 'pbTurno 2.2s cubic-bezier(0.22, 1.2, 0.36, 1) both',
            }}>
                <span style={{ fontSize: 'clamp(2.2rem, 6vw, 4rem)' }}>{equipo.avatar}</span>
                <div>
                    <div style={{ color: '#90a4c8', fontSize: 'clamp(0.7rem, 1.5vw, 0.95rem)', fontWeight: 700, letterSpacing: 2 }}>
                        TURNO DE
                    </div>
                    <div style={{ color: 'white', fontSize: 'clamp(1.3rem, 3.6vw, 2.6rem)', fontWeight: 900, lineHeight: 1.1 }}>
                        {equipo.nombre}
                    </div>
                </div>
            </div>
            <style>{`
                @keyframes pbTurno {
                    0%   { transform: scale(0.5) translateY(26px); opacity: 0; }
                    12%  { transform: scale(1.06) translateY(0); opacity: 1; }
                    20%  { transform: scale(1) translateY(0); opacity: 1; }
                    82%  { transform: scale(1) translateY(0); opacity: 1; }
                    100% { transform: scale(0.94) translateY(-16px); opacity: 0; }
                }
            `}</style>
        </div>
    );
}

// =====================================================================
//  PARTIDA (tablero + equipos)
// =====================================================================
function Partida({ config, titulo, onSalir, onFin }) {
    const [tablero, setTablero] = useState(() => construirTablero(config.categorias, config.nFilas, config.valorBase, config.mezclar));
    const [equipos, setEquipos] = useState(config.equipos);
    const [turno, setTurno] = useState(0);
    const [abierta, setAbierta] = useState(null);        // { c, f, origen }
    const [anuncio, setAnuncio] = useState(null);        // { equipo, id }
    const [historial, setHistorial] = useState([]);      // pila de { equipoId, delta, ok }
    const [sonido, setSonido] = useState(sonidoActivo());
    const [pantallaCompleta, setPantallaCompleta] = useState(false);
    const [verRanking, setVerRanking] = useState(false);
    const [ajustes, setAjustes] = useState(false);
    const { efectos: efectosPuntos, lanzarDesdeEvento } = useEfectosPuntos();

    const libres = tablero.reduce((s, c) => s + c.casillas.filter(x => x.pregunta && !x.jugada).length, 0);

    // Enunciados que ya están en el tablero (para que la pregunta final no se repita).
    const usadasEnTablero = useCallback(
        () => new Set(tablero.flatMap(c => c.casillas.filter(x => x.pregunta).map(x => x.pregunta.enunciado))),
        [tablero]
    );

    // --- Pantalla completa ---
    const toggleFull = () => {
        try {
            if (!document.fullscreenElement) { document.documentElement.requestFullscreen(); setPantallaCompleta(true); }
            else { document.exitFullscreen(); setPantallaCompleta(false); }
        } catch { /* no soportado */ }
    };
    useEffect(() => {
        const h = () => setPantallaCompleta(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', h);
        return () => document.removeEventListener('fullscreenchange', h);
    }, []);

    const cambiarSonido = () => { const v = !sonido; setSonido(v); setSonidoActivo(v); };

    // El panel de pregunta "salta" desde la casilla pulsada: calculamos su centro
    // en % dentro del tablero para usarlo como transform-origin.
    const zonaTablero = useRef(null);

    const abrirCasilla = (c, f, ev) => {
        const cas = tablero[c].casillas[f];
        if (!cas.pregunta || cas.jugada) return;
        despertarAudio();
        setAnuncio(null);

        let origen = { x: 50, y: 50 };
        const zona = zonaTablero.current;
        const celda = ev?.currentTarget;
        if (zona && celda?.getBoundingClientRect) {
            const rz = zona.getBoundingClientRect();
            const rc = celda.getBoundingClientRect();
            if (rz.width && rz.height) {
                origen = {
                    x: Math.round(((rc.left + rc.width / 2) - rz.left) / rz.width * 100),
                    y: Math.round(((rc.top + rc.height / 2) - rz.top) / rz.height * 100),
                };
            }
        }
        setAbierta({ c, f, origen });
    };

    const puntuar = useCallback((equipoId, delta, ok, ev) => {
        setEquipos(es => es.map(e => e.id === equipoId
            ? { ...e, puntos: e.puntos + delta, aciertos: e.aciertos + (ok ? 1 : 0), fallos: e.fallos + (ok ? 0 : 1) }
            : e));
        setHistorial(h => [...h, { equipoId, delta, ok }]);
        lanzarDesdeEvento(ev, { ok, texto: `${delta > 0 ? '+' : '−'}${fmt(Math.abs(delta))}`, estilo: config.efecto || 'MIX' });
    }, [lanzarDesdeEvento, config.efecto]);

    const deshacer = () => {
        setHistorial(h => {
            if (!h.length) return h;
            const ult = h[h.length - 1];
            setEquipos(es => es.map(e => e.id === ult.equipoId
                ? { ...e, puntos: e.puntos - ult.delta, aciertos: e.aciertos - (ult.ok ? 1 : 0), fallos: e.fallos - (ult.ok ? 0 : 1) }
                : e));
            return h.slice(0, -1);
        });
    };

    const cerrarPregunta = () => {
        const { c, f } = abierta;
        setTablero(t => t.map((cat, ci) => ci !== c ? cat : {
            ...cat, casillas: cat.casillas.map((cas, fi) => fi !== f ? cas : { ...cas, jugada: true }),
        }));
        // El turno SIEMPRE salta al siguiente equipo por orden, acierte quien acierte:
        // si elige el 1 y responde bien el 3, el turno pasa igualmente al 2.
        // (El profe puede saltarse el orden con el botón "turno" de cada tarjeta.)
        pasarTurno((turno + 1) % equipos.length);
        setAbierta(null);
    };

    // Cartel "Turno de …" sobre el tablero al cambiar de turno.
    const anuncioTimer = useRef(null);
    const pasarTurno = (indice) => {
        const equipo = equipos[indice];
        if (!equipo) return;
        setTurno(indice);
        clearTimeout(anuncioTimer.current);
        setAnuncio({ equipo, id: Date.now() });
        anuncioTimer.current = setTimeout(() => setAnuncio(null), 2200);
    };
    useEffect(() => () => clearTimeout(anuncioTimer.current), []);

    // --- Fin del tablero ---
    useEffect(() => {
        if (libres === 0 && !abierta) onFin(equipos, false, usadasEnTablero());
    }, [libres, abierta, equipos, onFin, usadasEnTablero]);

    const ajustePuntos = (equipoId, delta, ev) => {
        setEquipos(es => es.map(e => e.id === equipoId ? { ...e, puntos: e.puntos + delta } : e));
        setHistorial(h => [...h, { equipoId, delta, ok: null }]);
        lanzarDesdeEvento(ev, {
            ok: delta > 0,
            texto: `${delta > 0 ? '+' : '−'}${fmt(Math.abs(delta))}`,
            estilo: config.efecto || 'MIX',
        });
    };

    const nCats = tablero.length;
    const iconoBarra = { background: 'transparent', border: 'none', color: '#8ea6d4', cursor: 'pointer', padding: '10px 0', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, fontSize: '0.58rem', fontFamily: 'inherit' };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9998, display: 'flex', fontFamily: FUENTE,
            background: 'linear-gradient(160deg, #060b1c 0%, #0a1330 100%)', color: 'white',
        }}>
            {/* ---------- BARRA LATERAL ---------- */}
            <div style={{
                width: 62, background: 'rgba(0,0,0,0.42)', borderRight: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 10, gap: 2, flexShrink: 0,
            }}>
                <button onClick={onSalir} style={iconoBarra}><LogOut size={20} /> Salir</button>
                <button onClick={() => onFin(equipos, true, usadasEnTablero())} style={iconoBarra} title="Ir a la pregunta final">
                    <Star size={20} /> Final
                </button>
                <button onClick={() => setVerRanking(v => !v)} style={{ ...iconoBarra, color: verRanking ? '#f5c518' : '#8ea6d4' }}>
                    <Trophy size={20} /> Ranking
                </button>
                <button onClick={cambiarSonido} style={iconoBarra}>
                    {sonido ? <Volume2 size={20} /> : <VolumeX size={20} />} Sonido
                </button>
                <button onClick={() => setAjustes(a => !a)} style={{ ...iconoBarra, color: ajustes ? '#f5c518' : '#8ea6d4' }}>
                    <Settings size={20} /> Ajustes
                </button>
                <div style={{ flex: 1 }} />
                <button onClick={deshacer} disabled={!historial.length}
                    style={{ ...iconoBarra, color: historial.length ? '#8ea6d4' : '#3c4a68', paddingBottom: 14 }}>
                    <RotateCcw size={20} /> Deshacer
                </button>
            </div>

            {/* ---------- COLUMNA PRINCIPAL ---------- */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                {/* Barra superior */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <h1 style={{ margin: 0, fontSize: 'clamp(0.95rem, 2vw, 1.3rem)', fontWeight: 800, color: '#f5c518', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {titulo}
                    </h1>
                    <div style={{ flex: 1 }} />
                    <span style={{ ...chip('rgba(255,255,255,0.1)'), fontSize: '0.78rem' }}>{libres} casillas</span>
                    <button onClick={toggleFull} style={{ ...btnAtras, padding: '7px 10px' }}>
                        {pantallaCompleta ? <Minimize size={17} /> : <Maximize size={17} />}
                    </button>
                </div>

                {/* Tablero */}
                <div ref={zonaTablero} style={{ flex: 1, padding: 'clamp(8px, 1.2vw, 16px)', minHeight: 0, position: 'relative' }}>
                    <div style={{
                        height: '100%', display: 'grid', gap: 'clamp(4px, 0.6vw, 9px)',
                        gridTemplateColumns: `repeat(${nCats}, minmax(0, 1fr))`,
                        gridTemplateRows: `auto repeat(${config.nFilas}, minmax(0, 1fr))`,
                    }}>
                        {tablero.map((cat, ci) => (
                            <div key={`h${ci}`} style={{
                                background: 'linear-gradient(180deg, #e8eefc, #c9d8f5)', color: '#0a1533',
                                borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                padding: '10px 6px', fontWeight: 900, textAlign: 'center', lineHeight: 1.15,
                                fontSize: 'clamp(0.6rem, 1.15vw, 1rem)', textTransform: 'uppercase',
                                gridColumn: ci + 1, gridRow: 1,
                            }}>
                                {cat.nombre}
                            </div>
                        ))}

                        {tablero.map((cat, ci) => cat.casillas.map((cas, fi) => {
                            const vacia = !cas.pregunta;
                            const jugada = cas.jugada;
                            return (
                                <button key={`${ci}-${fi}`} onClick={(ev) => abrirCasilla(ci, fi, ev)}
                                    disabled={vacia || jugada}
                                    style={{
                                        gridColumn: ci + 1, gridRow: fi + 2,
                                        border: 'none', borderRadius: 8, fontFamily: 'inherit', fontWeight: 900,
                                        fontSize: 'clamp(1rem, 2.8vw, 2.4rem)',
                                        color: jugada || vacia ? 'rgba(255,255,255,0.14)' : '#f5c518',
                                        background: vacia ? 'rgba(255,255,255,0.03)'
                                            : jugada ? 'linear-gradient(180deg, #0e1c3f, #0a1533)'
                                                : 'linear-gradient(180deg, #2563eb, #1638a8)',
                                        cursor: vacia || jugada ? 'default' : 'pointer',
                                        boxShadow: vacia || jugada ? 'none' : 'inset 0 -4px 0 rgba(0,0,0,0.25)',
                                        transition: 'transform 0.12s, filter 0.12s',
                                    }}
                                    onMouseEnter={e => { if (!vacia && !jugada) { e.currentTarget.style.filter = 'brightness(1.22)'; e.currentTarget.style.transform = 'scale(1.02)'; } }}
                                    onMouseLeave={e => { e.currentTarget.style.filter = 'none'; e.currentTarget.style.transform = 'scale(1)'; }}
                                >
                                    {vacia ? '—' : jugada ? '' : fmt(cas.valor)}
                                </button>
                            );
                        }))}
                    </div>

                    {abierta && (
                        <ModalPregunta
                            casilla={tablero[abierta.c].casillas[abierta.f]}
                            categoria={tablero[abierta.c].nombre}
                            modo={config.modo} equipos={equipos} turno={turno} segundos={config.segundos}
                            origen={abierta.origen}
                            sonido={sonido} sonidoOk={config.sonidoOk} sonidoMal={config.sonidoMal}
                            onPuntuar={puntuar} onCerrar={cerrarPregunta}
                        />
                    )}

                    {anuncio && <CartelTurno key={anuncio.id} anuncio={anuncio} />}
                </div>

                {/* Panel de equipos */}
                <div style={{
                    display: 'flex', gap: 8, padding: '8px clamp(8px, 1.2vw, 16px) 12px',
                    borderTop: '1px solid rgba(255,255,255,0.08)', overflowX: 'auto',
                }}>
                    {equipos.map((e, i) => {
                        const activo = i === turno;
                        return (
                            <div key={e.id} style={{
                                flex: '1 1 0', minWidth: 132, borderRadius: 14, padding: '7px 9px',
                                background: activo ? 'rgba(46,204,113,0.14)' : 'rgba(255,255,255,0.05)',
                                border: `2px solid ${activo ? '#2ecc71' : 'rgba(255,255,255,0.1)'}`,
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, position: 'relative',
                            }}>
                                {activo && (
                                    <span style={{
                                        position: 'absolute', top: -10, background: '#2ecc71', color: '#06331c',
                                        fontSize: '0.56rem', fontWeight: 900, padding: '2px 9px', borderRadius: 999, letterSpacing: 1,
                                    }}>ELIGE</span>
                                )}
                                <span style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)' }}>{e.avatar}</span>
                                <div style={{ fontWeight: 700, fontSize: '0.75rem', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.nombre}</div>
                                <div style={{ fontWeight: 900, fontSize: 'clamp(0.95rem, 2vw, 1.3rem)', color: e.puntos < 0 ? '#ff6b6b' : '#f5c518' }}>{fmt(e.puntos)}</div>
                                <div style={{ display: 'flex', gap: 5 }}>
                                    <button onClick={(ev) => ajustePuntos(e.id, config.valorBase, ev)} title={`+${config.valorBase}`}
                                        style={{ background: '#1e9e57', border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: 'white' }}><Plus size={13} /></button>
                                    <button onClick={() => pasarTurno(i)} title="Dar el turno a este equipo"
                                        style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, padding: '4px 9px', cursor: 'pointer', color: 'white', fontSize: '0.62rem', fontWeight: 700 }}>turno</button>
                                    <button onClick={(ev) => ajustePuntos(e.id, -config.valorBase, ev)} title={`-${config.valorBase}`}
                                        style={{ background: '#c0392b', border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: 'white' }}><Minus size={13} /></button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ---------- OVERLAYS ---------- */}
            <CapaEfectos efectos={efectosPuntos} />

            {verRanking && (
                <div onClick={() => setVerRanking(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                    <div onClick={e => e.stopPropagation()} style={{ ...tarjeta, maxWidth: 420 }}>
                        <h3 style={{ margin: '0 0 14px', color: '#f5c518', display: 'flex', alignItems: 'center', gap: 8 }}><Trophy size={20} /> Clasificación</h3>
                        {[...equipos].sort((a, b) => b.puntos - a.puntos).map((e, i) => (
                            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                                <span style={{ color: '#5f7599', width: 22 }}>#{i + 1}</span>
                                <span style={{ fontSize: '1.4rem' }}>{e.avatar}</span>
                                <span style={{ flex: 1 }}>{e.nombre}</span>
                                <b style={{ color: '#f5c518' }}>{fmt(e.puntos)}</b>
                            </div>
                        ))}
                        <button onClick={() => setVerRanking(false)} style={{ ...btnSecundario, width: '100%', marginTop: 14 }}>Cerrar</button>
                    </div>
                </div>
            )}

            {ajustes && (
                <div onClick={() => setAjustes(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                    <div onClick={e => e.stopPropagation()} style={{ ...tarjeta, maxWidth: 420 }}>
                        <h3 style={{ margin: '0 0 12px', color: '#f5c518' }}>⚙️ Ajustes de la partida</h3>
                        <div style={{ color: '#cfe0ff', fontSize: '0.88rem', lineHeight: 1.9 }}>
                            <div>Modo: <b>{config.modo === 'AUTO' ? 'Autocorrección' : 'Moderador'}</b></div>
                            <div>Tiempo por pregunta: <b>{config.segundos ? `${config.segundos} s` : 'sin tiempo'}</b></div>
                            <div>Sonido: <b>{sonido ? 'activado' : 'silenciado'}</b></div>
                            <div>
                                Acierto: <b>{(SONIDOS_ACIERTO.find(s => s.id === config.sonidoOk) || SONIDOS_ACIERTO[0]).nombre}</b>
                                {' · '}Fallo: <b>{(SONIDOS_FALLO.find(s => s.id === config.sonidoMal) || SONIDOS_FALLO[0]).nombre}</b>
                            </div>
                            <div>Casillas sin jugar: <b>{libres}</b></div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
                            <button onClick={() => { setAjustes(false); onFin(equipos, true, usadasEnTablero()); }} style={btnSecundario}>⭐ Saltar a la pregunta final</button>
                            <button onClick={() => { setAjustes(false); onSalir(); }} style={btnSecundario}>Salir sin guardar</button>
                            <button onClick={() => setAjustes(false)} style={btnSecundario}>Cerrar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// =====================================================================
//  COMPONENTE PRINCIPAL
// =====================================================================
export default function MoneyBoard({ recurso = null, usuario, onExit, autoStart = false }) {
    const [pantalla, setPantalla] = useState('MENU');
    const [categorias, setCategorias] = useState([]);
    const [titulo, setTitulo] = useState('');
    const [config, setConfig] = useState(null);
    const [equiposFin, setEquiposFin] = useState([]);
    const [modalEnviar, setModalEnviar] = useState(false);
    const [guardado, setGuardado] = useState(false);
    const [semilla, setSemilla] = useState(0);

    const preparar = useCallback((r, cats) => {
        const c = cats || categoriasDeRecurso(r);
        if (c.length < 2) {
            alert('Este recurso necesita al menos 2 hojas con preguntas para montar un tablero.');
            return false;
        }
        setCategorias(c);
        setTitulo(r.titulo || 'Tablero');
        return true;
    }, []);

    // Arranque directo desde un enlace con recurso
    useEffect(() => {
        if (!autoStart || !recurso) return;
        if (preparar(recurso)) setPantalla('CONFIG');
    }, [autoStart, recurso, preparar]);

    const terminarPartida = useCallback((equipos, saltarAFinal = false, usadas = null) => {
        if (config?.conFinal || saltarAFinal) {
            const pf = elegirPreguntaFinal(config.categorias, usadas || new Set());
            if (pf) { setEquiposFin(equipos); setConfig(c => ({ ...c, preguntaFinal: pf })); setPantalla('FINAL'); return; }
        }
        setEquiposFin(equipos);
        setPantalla('FIN');
    }, [config]);

    const guardarRegistro = () => {
        const total = equiposFin.reduce((s, e) => s + e.aciertos + e.fallos, 0);
        const ac = equiposFin.reduce((s, e) => s + e.aciertos, 0);
        guardarRegistroLocal(TIPO_JUEGO, {
            titulo, aciertos: ac, intentos: total,
            porcentaje: total > 0 ? Math.round((ac / total) * 100) : 0,
            nombre: [...equiposFin].sort((a, b) => b.puntos - a.puntos)[0]?.nombre || '',
            curso: '', via: 'local',
        });
        setGuardado(true);
    };

    // ------------------------- PANTALLAS -------------------------
    if (pantalla === 'BUSCADOR') {
        return <BuscadorRecursos onBack={() => setPantalla('MENU')}
            onPick={(r, cats) => { if (preparar(r, cats)) setPantalla('CONFIG'); }} />;
    }

    if (pantalla === 'EDITOR') {
        return <EditorMoneyBoard usuario={usuario}
            onBack={() => setPantalla('MENU')}
            onJugar={(r) => { if (preparar(r)) setPantalla('CONFIG'); }} />;
    }

    if (pantalla === 'CONFIG') {
        return <PantallaConfig titulo={titulo} categorias={categorias}
            onBack={() => setPantalla(autoStart ? 'MENU' : 'BUSCADOR')}
            onJugar={(c) => { setConfig(c); setGuardado(false); setSemilla(s => s + 1); setPantalla('JUEGO'); }} />;
    }

    if (pantalla === 'JUEGO') {
        return <Partida key={'p' + semilla} config={config} titulo={titulo}
            onSalir={() => setPantalla('MENU')} onFin={terminarPartida} />;
    }

    if (pantalla === 'FINAL') {
        return <RondaFinal pregunta={config.preguntaFinal} equipos={equiposFin} sonido={sonidoActivo()} estilo={config.efecto || 'MIX'}
            onTerminar={(finales) => { setEquiposFin(finales); setPantalla('FIN'); }} />;
    }

    if (pantalla === 'FIN') {
        return (
            <>
                <PantallaFin equipos={equiposFin} titulo={titulo}
                    onEnviar={() => setModalEnviar(true)}
                    onGuardar={guardarRegistro} guardado={guardado}
                    onReiniciar={() => { setGuardado(false); setPantalla('CONFIG'); }}
                    onSalir={() => setPantalla('MENU')} />
                {modalEnviar && (
                    <ModalEnviarProfe
                        datos={{ titulo, equipos: equiposFin, categorias: config.categorias.map(c => c.nombre) }}
                        onClose={() => setModalEnviar(false)} />
                )}
            </>
        );
    }

    // ------------------------- MENÚ -------------------------
    return (
        <div style={menuWrap}>
            <div style={{ ...tarjeta, maxWidth: 520, textAlign: 'center' }}>
                <div style={{ fontSize: 'clamp(3rem, 11vw, 4.6rem)' }}>💰</div>
                <h1 style={{ margin: '2px 0 4px', color: '#f5c518', fontSize: 'clamp(1.6rem, 6vw, 2.4rem)', fontWeight: 900 }}>Money Board</h1>
                <p style={{ color: '#90a4c8', margin: '0 0 22px', fontSize: '0.95rem', lineHeight: 1.6 }}>
                    Tablero de categorías por equipos. Cada <b>hoja</b> de un recurso es una categoría
                    y sus preguntas son las casillas de {fmt(100)} a {fmt(500)}.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <button onClick={() => setPantalla('BUSCADOR')} style={{ ...btnPrincipal, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
                        <Search size={20} /> Elegir un recurso
                    </button>
                    <button onClick={() => setPantalla('EDITOR')} style={{ ...btnSecundario, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
                        <Edit3 size={19} /> Crear mi tablero
                    </button>
                    {recurso && (
                        <button onClick={() => { if (preparar(recurso)) setPantalla('CONFIG'); }} style={btnSecundario}>
                            ▶️ Jugar «{recurso.titulo}»
                        </button>
                    )}
                    <button onClick={onExit} style={btnSecundario}>Salir</button>
                </div>
                <p style={{ color: '#5f7599', fontSize: '0.76rem', marginTop: 18, marginBottom: 0 }}>
                    <Users size={12} style={{ verticalAlign: -2 }} /> De 2 a 6 equipos · pizarra digital o proyector
                </p>
            </div>
        </div>
    );
}
