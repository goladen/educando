import React, { useState, useMemo, useEffect } from 'react';
import { db } from './firebase';
import { collection, doc, getDoc, getDocs, addDoc, query, where, orderBy, limit } from 'firebase/firestore';
import { Clock, ArrowLeft, Search, CheckCircle, RotateCcw, Info, X, Calendar } from 'lucide-react';
import { BIBLIOTECA_LINEAS_TIEMPO } from './BibliotecaLineasTiempo';

// ── Helpers de fecha (mismos criterios que el editor) ────────
const MESES = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const valorFecha = (ev) => {
    const a = parseInt(ev.anio, 10) || 0;
    const m = ev.fechaTipo === 'dia' ? (parseInt(ev.mes, 10) || 0) : 0;
    const d = ev.fechaTipo === 'dia' ? (parseInt(ev.dia, 10) || 0) : 0;
    return a * 10000 + m * 100 + d;
};
const fechaTexto = (ev) => {
    const a = parseInt(ev.anio, 10);
    if (isNaN(a)) return '—';
    const anioStr = a < 0 ? `${Math.abs(a)} a.C.` : `${a}`;
    if (ev.fechaTipo === 'dia' && ev.dia && ev.mes) return `${parseInt(ev.dia, 10)} ${MESES[parseInt(ev.mes, 10)] || '?'} ${anioStr}`;
    return anioStr;
};
const toEmbed = (url) => {
    if (!url) return '';
    let m = url.match(/youtube\.com\/watch\?(?:.*&)?v=([^&]+)/); if (m) return `https://www.youtube.com/embed/${m[1]}`;
    m = url.match(/youtu\.be\/([^?&]+)/); if (m) return `https://www.youtube.com/embed/${m[1]}`;
    m = url.match(/vimeo\.com\/(\d+)/); if (m) return `https://player.vimeo.com/video/${m[1]}`;
    return url;
};
// Miniatura de un vídeo de YouTube (Vimeo no expone thumbnail sin API → '')
const videoThumb = (url) => {
    if (!url) return '';
    let m = url.match(/youtube\.com\/watch\?(?:.*&)?v=([^&]+)/); if (m) return `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg`;
    m = url.match(/youtu\.be\/([^?&]+)/); if (m) return `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg`;
    return '';
};
const thumbDe = (ev) => ev.imagen || videoThumb(ev.video);
const esSoloVideo = (ev) => !ev.imagen && !!ev.video;
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clean = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

// ──────────────────────────────────────────────────────────
// COMPONENTE RAÍZ
// ──────────────────────────────────────────────────────────
export default function LineaTiempoGame({ onExit, recurso: recursoInicial = null }) {
    const tieneHojas = recursoInicial?.hojas?.length;
    const [pantalla, setPantalla] = useState(() => {
        if (!tieneHojas) return 'BUSQUEDA';
        if (recursoInicial.presentacion?.titulo) return 'PRESENTACION';
        return recursoInicial.hojas.length <= 1 ? 'JUGANDO' : 'ELECCION';
    });
    const [recursoActivo, setRecursoActivo] = useState(tieneHojas ? recursoInicial : null);
    const [hojaActiva, setHojaActiva] = useState(() => (tieneHojas && recursoInicial.hojas.length === 1) ? recursoInicial.hojas[0] : null);

    const volverBusqueda = () => { setPantalla('BUSQUEDA'); setRecursoActivo(null); setHojaActiva(null); };

    const elegirRecurso = (r) => {
        setRecursoActivo(r);
        if (r.presentacion?.titulo) { setPantalla('PRESENTACION'); return; }
        if ((r.hojas?.length || 0) <= 1) { setHojaActiva(r.hojas?.[0] || null); setPantalla('JUGANDO'); }
        else setPantalla('ELECCION');
    };
    const empezarTrasPres = () => {
        const r = recursoActivo;
        if ((r.hojas?.length || 0) <= 1) { setHojaActiva(r.hojas?.[0] || null); setPantalla('JUGANDO'); }
        else setPantalla('ELECCION');
    };
    const elegirHoja = (h) => { setHojaActiva(h ?? recursoActivo.hojas[Math.floor(Math.random() * recursoActivo.hojas.length)]); setPantalla('JUGANDO'); };

    if (pantalla === 'PRESENTACION' && recursoActivo?.presentacion?.titulo)
        return <PantallaPresentacion presentacion={recursoActivo.presentacion} onEmpezar={empezarTrasPres} onExit={onExit} />;

    if (pantalla === 'ELECCION')
        return <PantallaEleccion recurso={recursoActivo} onElegir={elegirHoja} onVolver={tieneHojas ? onExit : volverBusqueda} />;

    if (pantalla === 'JUGANDO' && hojaActiva)
        return <PantallaJuego recurso={recursoActivo} hoja={hojaActiva}
            onCambiarLinea={recursoActivo?.hojas?.length > 1 ? () => setPantalla('ELECCION') : null}
            onSalir={onExit} />;

    return <PantallaBusqueda onElegir={elegirRecurso} onExit={onExit} />;
}

// ──────────────────────────────────────────────────────────
// PANTALLA 1 — BUSCADOR
// ──────────────────────────────────────────────────────────
function PantallaBusqueda({ onElegir, onExit }) {
    const [modo, setModo] = useState('FILTROS');
    const [codigo, setCodigo] = useState('');
    const [tema, setTema] = useState('');
    const [buscando, setBuscando] = useState(false);
    const [resultados, setResultados] = useState([]);
    const [buscado, setBuscado] = useState(false);

    const buscar = async () => {
        setBuscando(true); setBuscado(true);
        const ref = collection(db, 'resources');
        try {
            if (modo === 'CODIGO') {
                const limpio = codigo.toUpperCase().trim();
                if (!limpio) { alert('Introduce un código.'); setBuscando(false); return; }
                const snap = await getDocs(query(ref, where('accessCode', '==', limpio)));
                if (!snap.empty) {
                    const r = { ...snap.docs[0].data(), id: snap.docs[0].id };
                    if (r.tipoJuego !== 'LINEA_TIEMPO') { alert('Ese código no es una línea del tiempo.'); setResultados([]); }
                    else setResultados([r]);
                } else { alert('Código no encontrado.'); setResultados([]); }
            } else {
                const snap = await getDocs(query(ref, where('tipoJuego', '==', 'LINEA_TIEMPO'), limit(200)));
                let raw = snap.docs.map(d => ({ ...d.data(), id: d.id })).filter(r => r.isFinished === true);
                if (tema) raw = raw.filter(r => clean(r.titulo).includes(clean(tema)) || clean(r.temas).includes(clean(tema)));
                if (raw.length === 0) alert('No se encontraron líneas del tiempo con esos criterios.');
                setResultados(raw);
            }
        } catch (e) { console.error(e); alert('Error en la búsqueda. ' + e.message); }
        setBuscando(false);
    };

    return (
        <div style={s.pagina}>
            <div style={s.headerBusqueda}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={s.logoIcon}><Clock size={26} color="white" /></div>
                    <div>
                        <div style={{ fontWeight: 900, fontSize: '1.3rem', color: 'white' }}>Línea del Tiempo</div>
                        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>Ordena los eventos en la historia</div>
                    </div>
                </div>
                {onExit && <button onClick={onExit} style={s.btnSalir}><ArrowLeft size={16} /> Salir</button>}
            </div>

            <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px' }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    {[['FILTROS', '🔎 Buscar'], ['CODIGO', '🔑 Código']].map(([k, l]) => (
                        <button key={k} onClick={() => setModo(k)} style={{ flex: 1, padding: '11px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, background: modo === k ? 'white' : 'rgba(255,255,255,0.12)', color: modo === k ? '#1f5f86' : 'white' }}>{l}</button>
                    ))}
                </div>

                <div style={s.card}>
                    {modo === 'CODIGO' ? (
                        <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && buscar()} placeholder="Código del recurso" maxLength={8} style={{ ...s.input, letterSpacing: 3, fontWeight: 800, textAlign: 'center' }} />
                    ) : (
                        <input value={tema} onChange={e => setTema(e.target.value)} onKeyDown={e => e.key === 'Enter' && buscar()} placeholder="Tema o título (opcional)" style={s.input} />
                    )}
                    <button onClick={buscar} disabled={buscando} style={s.btnBuscar}>
                        <Search size={18} /> {buscando ? 'Buscando...' : 'Buscar'}
                    </button>
                </div>

                <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {resultados.map(r => (
                        <div key={r.id} onClick={() => onElegir(r)} style={s.resultCard}>
                            <div style={s.resultIcon}><Clock size={22} color="white" /></div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 800, color: '#1f2937' }}>{r.titulo}</div>
                                <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                                    {r.profesorNombre ? `${r.profesorNombre} · ` : ''}{(r.hojas?.length || 0)} línea(s) · {(r.hojas || []).reduce((n, h) => n + (h.eventos?.length || 0), 0)} eventos
                                </div>
                            </div>
                            <span style={{ color: '#2980b9', fontWeight: 800 }}>▶</span>
                        </div>
                    ))}
                    {buscado && !buscando && resultados.length === 0 && (
                        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)', padding: 20 }}>Sin resultados.</div>
                    )}
                </div>

                {/* Biblioteca de líneas del tiempo predefinidas */}
                {resultados.length === 0 && (
                    <div style={{ marginTop: 26 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'white', fontWeight: 800, fontSize: '1rem', marginBottom: 12 }}>
                            📚 Biblioteca de líneas del tiempo
                        </div>
                        <div style={s.bibGrid}>
                            {BIBLIOTECA_LINEAS_TIEMPO.map(t => (
                                <div key={t.id} onClick={() => onElegir(t)} style={s.bibCard}>
                                    <div style={{ position: 'relative', height: 96, background: '#dde6f0' }}>
                                        {t.imagen && <img src={t.imagen} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none'; }} />}
                                        <span style={s.bibTema}>{t.tema}</span>
                                    </div>
                                    <div style={{ padding: '10px 12px' }}>
                                        <div style={{ fontWeight: 800, color: '#1f2937', fontSize: '0.92rem' }}>{t.titulo}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#6b7280', margin: '3px 0 6px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.descripcion}</div>
                                        <div style={{ fontSize: '0.72rem', color: '#2980b9', fontWeight: 700 }}>{t.hojas[0].eventos.length} eventos · ▶ Jugar</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────────────
// PANTALLA PRESENTACIÓN
// ──────────────────────────────────────────────────────────
function PantallaPresentacion({ presentacion, onEmpezar, onExit }) {
    const video = presentacion.video && toEmbed(presentacion.video);
    return (
        <div style={s.presOverlay}>
            {onExit && <button onClick={onExit} style={s.presBack}>←</button>}
            <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
                <h1 style={{ color: 'white', margin: 0, fontSize: 'clamp(1.6rem,5vw,2.6rem)', textAlign: 'center', fontWeight: 900 }}>{presentacion.titulo}</h1>
                {video ? (
                    <div style={{ width: '100%', borderRadius: 18, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.6)', position: 'relative', paddingBottom: '56.25%', background: '#000' }}>
                        <iframe src={video} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title={presentacion.titulo} />
                    </div>
                ) : presentacion.imagen ? (
                    <div style={{ width: '100%', borderRadius: 18, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
                        <img src={presentacion.imagen} alt="" style={{ width: '100%', display: 'block', maxHeight: '42vh', objectFit: 'cover' }} />
                    </div>
                ) : null}
                {presentacion.descripcion && <p style={{ color: 'rgba(255,255,255,0.88)', margin: 0, fontSize: 'clamp(0.95rem,2.5vw,1.1rem)', textAlign: 'center', lineHeight: 1.7 }}>{presentacion.descripcion}</p>}
                <button onClick={onEmpezar} style={s.presBtn}>▶ ¡Empezar!</button>
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────────────
// PANTALLA ELECCIÓN DE LÍNEA
// ──────────────────────────────────────────────────────────
function PantallaEleccion({ recurso, onElegir, onVolver }) {
    return (
        <div style={s.pagina}>
            <div style={s.headerBusqueda}>
                <div style={{ fontWeight: 900, fontSize: '1.2rem', color: 'white' }}>{recurso.titulo}</div>
                {onVolver && <button onClick={onVolver} style={s.btnSalir}><ArrowLeft size={16} /> Volver</button>}
            </div>
            <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px' }}>
                <p style={{ color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginBottom: 16 }}>Elige una línea del tiempo:</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {recurso.hojas.map((h, i) => (
                        <div key={i} onClick={() => onElegir(h)} style={s.resultCard}>
                            <div style={s.resultIcon}><Clock size={22} color="white" /></div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 800, color: '#1f2937' }}>{h.nombreHoja}</div>
                                <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{(h.eventos?.length || 0)} eventos · {h.mostrarFechas ? 'con fecha' : 'ordenar'}</div>
                            </div>
                            <span style={{ color: '#2980b9', fontWeight: 800 }}>▶</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────────────
// PANTALLA DE JUEGO (arrastrar y soltar)
// ──────────────────────────────────────────────────────────
function PantallaJuego({ recurso, hoja, onCambiarLinea, onSalir }) {
    const mostrarFechas = hoja.mostrarFechas !== false;
    // Orden correcto (por fecha)
    const ordenados = useMemo(() => (hoja.eventos || []).slice().sort((a, b) => valorFecha(a) - valorFecha(b)), [hoja]);
    const nSlots = ordenados.length;

    // Espaciado proporcional al tiempo entre eventos (solo con fechas visibles y >2 eventos)
    const vals = useMemo(() => ordenados.map(valorFecha), [ordenados]);
    const proporcional = mostrarFechas && nSlots > 2;
    const spanFechas = (vals[vals.length - 1] - vals[0]) || 1;
    const gapPx = (i) => 12 + Math.round(((vals[i] - vals[i - 1]) / spanFechas) * 300); // hueco antes del slot i

    // placements[i] = eventId colocado en el slot i (o null)
    const [placements, setPlacements] = useState(() => Array(nSlots).fill(null));
    const [pool, setPool] = useState(() => shuffle(ordenados.map(e => e.id)));
    const [selectedId, setSelectedId] = useState(null);
    const [comprobado, setComprobado] = useState(false);   // resultados de la última comprobación
    const [resultadoSlots, setResultadoSlots] = useState([]); // bool[] por slot
    const [intentos, setIntentos] = useState(0);
    const [ganado, setGanado] = useState(false);
    const [detalle, setDetalle] = useState(null);   // evento mostrado en modal info
    const [mostrarEnvio, setMostrarEnvio] = useState(false);
    const [fechasEscritas, setFechasEscritas] = useState({}); // { [eventId]: { anio, mes, dia } } — modo sin fecha

    const evById = useMemo(() => Object.fromEntries(ordenados.map(e => [e.id, e])), [ordenados]);

    // ¿La fecha que el alumno escribió coincide con la real del evento? (solo modo sin fecha)
    const fechaEscritaOk = (ev) => {
        if (!ev) return false;
        const w = fechasEscritas[ev.id] || {};
        const anioOk = w.anio !== undefined && w.anio !== '' && parseInt(w.anio, 10) === parseInt(ev.anio, 10);
        if (ev.fechaTipo === 'dia') return anioOk && parseInt(w.mes, 10) === parseInt(ev.mes, 10) && parseInt(w.dia, 10) === parseInt(ev.dia, 10);
        return anioOk;
    };
    const setFecha = (evId, campo, val) => {
        setComprobado(false); // el cartel no se recalcula hasta pulsar «Comprobar» de nuevo
        setFechasEscritas(f => ({ ...f, [evId]: { ...(f[evId] || {}), [campo]: val } }));
    };

    const reiniciar = () => {
        setPlacements(Array(nSlots).fill(null));
        setPool(shuffle(ordenados.map(e => e.id)));
        setSelectedId(null); setComprobado(false); setResultadoSlots([]); setGanado(false); setFechasEscritas({});
    };

    // Colocar un evento en un slot
    const colocar = (slotIdx, eventId) => {
        if (eventId == null) return;
        setComprobado(false);
        setPlacements(prev => {
            const next = [...prev];
            // Si el evento ya estaba en otro slot, vaciarlo
            const prevIdx = next.indexOf(eventId);
            if (prevIdx !== -1) next[prevIdx] = null;
            // Si el slot estaba ocupado, ese evento vuelve al pool
            const desplazado = next[slotIdx];
            next[slotIdx] = eventId;
            setPool(p => {
                let np = p.filter(id => id !== eventId);
                if (desplazado && desplazado !== eventId && !next.includes(desplazado)) np = [...np, desplazado];
                return np;
            });
            return next;
        });
        setSelectedId(null);
    };
    // Sacar un evento de un slot → vuelve al pool
    const sacar = (slotIdx) => {
        setComprobado(false);
        setPlacements(prev => {
            const ev = prev[slotIdx];
            if (!ev) return prev;
            const next = [...prev]; next[slotIdx] = null;
            setPool(p => p.includes(ev) ? p : [...p, ev]);
            return next;
        });
    };

    const onSlotClick = (slotIdx) => {
        if (placements[slotIdx]) { sacar(slotIdx); return; }
        if (selectedId != null) colocar(slotIdx, selectedId);
    };

    const comprobar = () => {
        const res = placements.map((id, i) => {
            if (id == null || id !== ordenados[i].id) return false;       // posición correcta
            if (!mostrarFechas && !fechaEscritaOk(evById[id])) return false; // y fecha escrita correcta
            return true;
        });
        setResultadoSlots(res); setComprobado(true);
        setIntentos(n => n + 1);
        if (res.every(Boolean) && placements.every(p => p != null)) setGanado(true);
    };

    const todoColocado = placements.every(p => p != null);
    const aciertos = resultadoSlots.filter(Boolean).length;

    // Drag & drop nativo (escritorio)
    const onDragStart = (e, id) => { e.dataTransfer.setData('text/plain', id); setSelectedId(id); };
    const onDropSlot = (e, slotIdx) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) colocar(slotIdx, id); };
    const onDropPool = (e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) { const idx = placements.indexOf(id); if (idx !== -1) sacar(idx); } };

    return (
        <div style={s.juegoPagina}>
            {/* Header */}
            <div style={s.juegoHeader}>
                <button onClick={onSalir} style={s.btnSalir}><ArrowLeft size={16} /> Salir</button>
                <div style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 900, color: 'white', fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recurso.titulo}</div>
                    <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)' }}>{hoja.nombreHoja} · {mostrarFechas ? 'arrastra cada evento a su fecha' : 'ordénalos y escribe la fecha de cada uno'}</div>
                </div>
                <button onClick={reiniciar} style={s.btnSalir} title="Reiniciar"><RotateCcw size={16} /></button>
            </div>

            {/* Línea del tiempo (slots) */}
            <div style={s.timelineWrap}>
                <div style={s.timelineLine} />
                <div style={{ ...s.slotsRow, gap: proporcional ? 0 : 12 }}>
                    {ordenados.map((evCorrecto, i) => {
                        const id = placements[i];
                        const ev = id ? evById[id] : null;
                        // La tarjeta es verde si la POSICIÓN es correcta (aunque falle la fecha escrita)
                        const ok = comprobado && id != null && id === ordenados[i].id;
                        const bad = comprobado && id != null && id !== ordenados[i].id;
                        // Posición correcta del evento colocado → pista "antes / después"
                        const posReal = id ? ordenados.findIndex(e => e.id === id) : -1;
                        const posMal = comprobado && id != null && posReal !== i;
                        const fechaMal = comprobado && id != null && !mostrarFechas && posReal === i && !fechaEscritaOk(ev);
                        // Dirección de la fecha real respecto a la escrita
                        const w = ev ? (fechasEscritas[ev.id] || {}) : {};
                        const typedVal = (parseInt(w.anio, 10) || 0) * 10000 + (ev && ev.fechaTipo === 'dia' ? (parseInt(w.mes, 10) || 0) * 100 + (parseInt(w.dia, 10) || 0) : 0);
                        const fechaAntes = ev && valorFecha(ev) < typedVal;
                        return (
                            <React.Fragment key={i}>
                                {proporcional && i > 0 && <div style={{ width: gapPx(i), flexShrink: 0, alignSelf: 'stretch' }} />}
                            <div style={s.slotCol}>
                                <div style={{ ...s.slotLabel, background: mostrarFechas ? '#1f5f86' : '#475569' }}>
                                    {mostrarFechas ? fechaTexto(evCorrecto) : `${i + 1}º`}
                                </div>
                                <div style={s.slotConnector} />
                                <div
                                    onClick={() => onSlotClick(i)}
                                    onDragOver={e => e.preventDefault()}
                                    onDrop={e => onDropSlot(e, i)}
                                    style={{
                                        ...s.slot,
                                        borderColor: ok ? '#27ae60' : bad ? '#e74c3c' : ev ? '#2980b9' : (selectedId ? '#2980b9' : '#cbd5e1'),
                                        background: ok ? '#eafaf1' : bad ? '#fdecea' : ev ? 'white' : '#f8fafc',
                                        cursor: ev || selectedId ? 'pointer' : 'default',
                                    }}>
                                    {ev ? (
                                        <div
                                            draggable
                                            onDragStart={e => { e.stopPropagation(); onDragStart(e, ev.id); }}
                                            style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: 4, boxSizing: 'border-box' }}>
                                            {thumbDe(ev) ? (
                                                <div style={{ position: 'relative', width: '100%' }}>
                                                    <img src={thumbDe(ev)} alt="" style={s.slotImg} onError={e => { e.target.style.display = 'none'; }} />
                                                    {esSoloVideo(ev) && <span style={s.playBadge}>▶</span>}
                                                </div>
                                            ) : esSoloVideo(ev) ? (
                                                <div style={{ ...s.slotImg, background: '#1f2937', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: 'white', fontSize: 18 }}>▶</span></div>
                                            ) : null}
                                            {ev.video && <button onClick={e => { e.stopPropagation(); setDetalle(ev); }} onPointerDown={e => e.stopPropagation()} style={s.slotPlayBtn} title="Ver vídeo">▶</button>}
                                            <span style={s.slotTitulo}>{ev.titulo}</span>
                                            {ok && <CheckCircle size={16} color="#27ae60" />}
                                            {posMal && (
                                                <span style={s.hint}>{posReal < i ? '◀ va antes' : 'va después ▶'}</span>
                                            )}
                                        </div>
                                    ) : (
                                        <span style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 700 }}>⬇ Suelta aquí</span>
                                    )}
                                </div>
                                {/* Modo sin fecha → el alumno escribe la fecha */}
                                {!mostrarFechas && ev && (
                                    <div style={{ display: 'flex', gap: 4, marginTop: 6, justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
                                        {ev.fechaTipo === 'dia' && (<>
                                            <input type="number" value={(fechasEscritas[ev.id] || {}).dia || ''} onChange={e => setFecha(ev.id, 'dia', e.target.value)} placeholder="DD" style={s.fechaInput} />
                                            <input type="number" value={(fechasEscritas[ev.id] || {}).mes || ''} onChange={e => setFecha(ev.id, 'mes', e.target.value)} placeholder="MM" style={s.fechaInput} />
                                        </>)}
                                        <input type="number" value={(fechasEscritas[ev.id] || {}).anio || ''} onChange={e => setFecha(ev.id, 'anio', e.target.value)} placeholder="Año"
                                            style={{ ...s.fechaInput, width: 64, borderColor: comprobado ? (fechaEscritaOk(ev) ? '#27ae60' : '#e74c3c') : '#cbd5e1' }} />
                                        {fechaMal && <span style={s.fechaHint}>{fechaAntes ? '◀ antes' : 'después ▶'}</span>}
                                    </div>
                                )}
                            </div>
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

            {/* Banco de eventos */}
            <div style={s.poolWrap} onDragOver={e => e.preventDefault()} onDrop={onDropPool}>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Eventos</div>
                <div style={s.poolRow}>
                    {pool.length === 0 && <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Todos colocados. Pulsa «Comprobar».</span>}
                    {pool.map(id => {
                        const ev = evById[id];
                        const sel = selectedId === id;
                        return (
                            <div key={id}
                                draggable
                                onDragStart={e => onDragStart(e, id)}
                                onClick={() => setSelectedId(sel ? null : id)}
                                style={{ ...s.poolCard, borderColor: sel ? '#2980b9' : '#e2e8f0', boxShadow: sel ? '0 0 0 3px rgba(41,128,185,0.25)' : '0 1px 4px rgba(0,0,0,0.08)', transform: sel ? 'translateY(-2px)' : 'none' }}>
                                {thumbDe(ev) ? (
                                    <div style={{ position: 'relative' }}>
                                        <img src={thumbDe(ev)} alt="" style={s.poolImg} onError={e => { e.target.style.display = 'none'; }} />
                                        {esSoloVideo(ev) && <span style={s.playBadge}>▶</span>}
                                    </div>
                                ) : esSoloVideo(ev) ? (
                                    <div onClick={e => { e.stopPropagation(); setDetalle(ev); }} style={{ ...s.poolImg, background: '#1f2937', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><span style={{ color: 'white', fontSize: 22 }}>▶</span></div>
                                ) : null}
                                <span style={s.poolTitulo}>{ev.titulo}</span>
                                {(ev.descripcion || ev.video || ev.imagen) && (
                                    <button onClick={e => { e.stopPropagation(); setDetalle(ev); }} style={s.infoBtn} title={ev.video ? 'Ver vídeo' : 'Ver detalle'}>{ev.video ? '▶' : <Info size={14} />}</button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Barra inferior */}
            <div style={s.barraInferior}>
                {comprobado && !ganado && (
                    <span style={{ fontWeight: 800, color: aciertos === nSlots ? '#27ae60' : '#e67e22' }}>
                        {aciertos}/{nSlots} correctos
                    </span>
                )}
                <button onClick={comprobar} disabled={!todoColocado} style={{ ...s.btnComprobar, opacity: todoColocado ? 1 : 0.5, cursor: todoColocado ? 'pointer' : 'not-allowed' }}>
                    <CheckCircle size={18} /> Comprobar
                </button>
            </div>

            {/* Modal info de evento */}
            {detalle && <ModalEvento ev={detalle} onClose={() => setDetalle(null)} />}

            {/* Pantalla de victoria */}
            {ganado && (
                <div style={s.winOverlay}>
                    <div style={s.winCard}>
                        <div style={{ fontSize: '3.2rem' }}>🎉</div>
                        <h2 style={{ margin: '6px 0', color: '#1f5f86' }}>¡Línea completada!</h2>
                        <p style={{ color: '#64748b', margin: 0 }}>Has ordenado los {nSlots} eventos correctamente.</p>
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '4px 0 14px' }}>Intentos de comprobación: {intentos}</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, width: '100%' }}>
                            <button onClick={() => setMostrarEnvio(true)} style={s.winBtnEnviar}>📤 Enviar al profesor</button>
                            <button onClick={reiniciar} style={s.winBtnSec}><RotateCcw size={16} /> Jugar de nuevo</button>
                            {onCambiarLinea && <button onClick={onCambiarLinea} style={s.winBtnSec}>Otra línea</button>}
                            <button onClick={onSalir} style={s.winBtnSec}>Salir</button>
                        </div>
                    </div>
                </div>
            )}

            {mostrarEnvio && (
                <ModalEnviarProfe
                    datos={{ recursoId: recurso.id, recursoTitulo: recurso.titulo, hoja: hoja.nombreHoja, aciertos: nSlots, total: nSlots, intentos, nota: Math.round((nSlots / Math.max(1, intentos)) * 100) / 100 }}
                    onClose={() => setMostrarEnvio(false)}
                />
            )}
        </div>
    );
}

// ── Modal de detalle de evento ──────────────────────────────
function ModalEvento({ ev, onClose }) {
    const video = ev.video && toEmbed(ev.video);
    return (
        <div style={s.modalOverlay} onClick={onClose}>
            <div style={s.modalEvento} onClick={e => e.stopPropagation()}>
                <button onClick={onClose} style={s.modalClose}><X size={18} /></button>
                <h3 style={{ margin: '0 0 10px', color: '#1f2937', paddingRight: 30 }}>{ev.titulo}</h3>
                {video ? (
                    <div style={{ position: 'relative', paddingBottom: '56.25%', borderRadius: 10, overflow: 'hidden', background: '#000', marginBottom: 10 }}>
                        <iframe src={video} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title={ev.titulo} />
                    </div>
                ) : ev.imagen ? (
                    <img src={ev.imagen} alt="" style={{ width: '100%', borderRadius: 10, maxHeight: 240, objectFit: 'cover', marginBottom: 10 }} onError={e => { e.target.style.display = 'none'; }} />
                ) : null}
                {ev.descripcion && <p style={{ color: '#475569', lineHeight: 1.6, margin: 0 }}>{ev.descripcion}</p>}
            </div>
        </div>
    );
}

// ── Modal enviar al profesor ────────────────────────────────
function ModalEnviarProfe({ datos, onClose }) {
    const [codigo, setCodigo] = useState('');
    const [nombre, setNombre] = useState('');
    const [curso, setCurso] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [enviado, setEnviado] = useState(false);
    const [error, setError] = useState('');

    const enviar = async () => {
        const code = codigo.trim().toUpperCase();
        if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
        if (!code) { setError('Escribe el código del profesor.'); return; }
        setEnviando(true); setError('');
        try {
            const codigoDoc = await getDoc(doc(db, 'codigos_profesor', code));
            if (!codigoDoc.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'LINEA_TIEMPO', modalidad: 'Individual', fecha: new Date(),
                recursoId: datos.recursoId, recursoTitulo: datos.recursoTitulo, hoja: datos.hoja,
                codigoProfesor: code,
                jugadores: [{ nombre: nombre.trim(), curso: curso.trim(), aciertos: datos.aciertos, total: datos.total, intentos: datos.intentos, porcentaje: 100 }],
            });
            setEnviado(true);
        } catch (e) { setError('Error: ' + e.message); }
        setEnviando(false);
    };
    const inp = { padding: '9px 12px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 11000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 14 }}>
            <div style={{ background: '#1e272e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, width: '100%', maxWidth: 380, padding: '26px 28px', color: 'white', fontFamily: "'Segoe UI',sans-serif" }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f1c40f' }}>📤 Enviar al profesor</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.2rem' }}>✕</button>
                </div>
                {enviado ? (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{ fontSize: '3rem' }}>✅</div>
                        <div style={{ color: '#2ecc71', fontWeight: 700 }}>¡Informe enviado!</div>
                        <div style={{ color: '#aaa', fontSize: '0.88rem', marginTop: 8 }}>{datos.total} eventos · {datos.intentos} intento(s)</div>
                        <button onClick={onClose} style={{ marginTop: 16, padding: '9px 22px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', color: 'white' }}>Cerrar</button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div><label style={s.envLabel}>Nombre y apellido</label><input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre completo" style={inp} /></div>
                        <div><label style={s.envLabel}>Curso</label><input value={curso} onChange={e => setCurso(e.target.value)} placeholder="Ej: 3º ESO A" style={inp} /></div>
                        <div><label style={s.envLabel}>Código del profesor</label><input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="Ej: PROF01" maxLength={10} style={{ ...inp, letterSpacing: 2, fontWeight: 700 }} /></div>
                        {error && <div style={{ color: '#e74c3c', fontSize: '0.8rem' }}>⚠ {error}</div>}
                        <div style={{ display: 'flex', gap: 9, marginTop: 4 }}>
                            <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', cursor: 'pointer', color: 'white' }}>Cancelar</button>
                            <button onClick={enviar} disabled={enviando} style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: enviando ? '#555' : 'linear-gradient(135deg,#3498db,#2980b9)', color: 'white', fontWeight: 700, cursor: enviando ? 'default' : 'pointer' }}>{enviando ? 'Enviando…' : '📤 Enviar'}</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── ESTILOS ─────────────────────────────────────────────────
const FONDO = 'linear-gradient(160deg,#1f5f86 0%,#2980b9 55%,#34495e 100%)';
const s = {
    pagina: { position: 'fixed', inset: 0, zIndex: 9000, background: FONDO, overflowY: 'auto', fontFamily: "'Segoe UI',sans-serif" },
    headerBusqueda: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'rgba(0,0,0,0.15)' },
    logoIcon: { width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    btnSalir: { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', borderRadius: 10, padding: '8px 14px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' },
    card: { background: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 },
    input: { width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12, border: 'none', fontSize: '1rem', outline: 'none' },
    btnBuscar: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', borderRadius: 12, border: 'none', background: 'white', color: '#1f5f86', fontWeight: 800, fontSize: '1rem', cursor: 'pointer' },
    resultCard: { display: 'flex', alignItems: 'center', gap: 12, background: 'white', borderRadius: 14, padding: '12px 14px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' },
    resultIcon: { width: 42, height: 42, borderRadius: 11, background: 'linear-gradient(135deg,#2980b9,#1f5f86)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    bibGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12 },
    bibCard: { background: 'white', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' },
    bibTema: { position: 'absolute', top: 6, left: 6, background: 'rgba(31,95,134,0.9)', color: 'white', fontSize: '0.66rem', fontWeight: 800, padding: '2px 8px', borderRadius: 10 },

    presOverlay: { position: 'fixed', inset: 0, zIndex: 9500, background: 'linear-gradient(160deg,#0f2027 0%,#203a43 55%,#2c5364 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 20px', overflowY: 'auto', boxSizing: 'border-box' },
    presBack: { position: 'fixed', top: 14, left: 14, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', borderRadius: 10, width: 42, height: 42, cursor: 'pointer', fontSize: 20, zIndex: 10 },
    presBtn: { background: 'linear-gradient(135deg,#2980b9,#1f5f86)', color: 'white', border: 'none', borderRadius: 50, padding: '16px 52px', fontSize: '1.1rem', fontWeight: 800, cursor: 'pointer' },

    juegoPagina: { position: 'fixed', inset: 0, zIndex: 9000, background: '#eef2f7', display: 'flex', flexDirection: 'column', fontFamily: "'Segoe UI',sans-serif" },
    juegoHeader: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'linear-gradient(135deg,#2980b9,#1f5f86)', flexShrink: 0 },

    timelineWrap: { position: 'relative', padding: '22px 14px 10px', overflowX: 'auto', flexShrink: 0 },
    timelineLine: { position: 'absolute', left: 14, right: 14, top: 60, height: 4, background: 'linear-gradient(90deg,#2980b9,#94a3b8)', borderRadius: 2 },
    slotsRow: { display: 'flex', gap: 12, position: 'relative', minWidth: 'min-content' },
    slotCol: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, minWidth: 120 },
    slotLabel: { color: 'white', fontWeight: 800, fontSize: '0.78rem', padding: '5px 10px', borderRadius: 16, whiteSpace: 'nowrap', textAlign: 'center', zIndex: 2 },
    slotConnector: { width: 3, height: 14, background: '#94a3b8' },
    slot: { width: 120, height: 120, borderRadius: 14, border: '2.5px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', transition: 'all 0.15s', boxSizing: 'border-box' },
    slotImg: { width: '100%', height: 56, objectFit: 'cover', borderRadius: 8 },
    playBadge: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'rgba(0,0,0,0.6)', color: 'white', width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, pointerEvents: 'none' },
    slotPlayBtn: { position: 'absolute', top: 3, right: 3, background: 'rgba(31,95,134,0.9)', border: 'none', color: 'white', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 10 },
    slotTitulo: { fontSize: '0.74rem', fontWeight: 700, color: '#1f2937', lineHeight: 1.15, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
    hint: { background: '#e67e22', color: 'white', fontSize: '0.66rem', fontWeight: 800, padding: '2px 7px', borderRadius: 10, whiteSpace: 'nowrap' },
    fechaInput: { width: 44, boxSizing: 'border-box', padding: '5px 4px', borderRadius: 7, border: '2px solid #cbd5e1', fontSize: '0.8rem', textAlign: 'center', outline: 'none', fontWeight: 700 },
    fechaHint: { display: 'inline-flex', alignItems: 'center', background: '#e74c3c', color: 'white', fontSize: '0.66rem', fontWeight: 800, padding: '3px 7px', borderRadius: 10, whiteSpace: 'nowrap', alignSelf: 'center' },

    poolWrap: { flex: 1, overflowY: 'auto', padding: '12px 14px', background: 'white', borderTop: '1px solid #e2e8f0', margin: '6px 0 0' },
    poolRow: { display: 'flex', flexWrap: 'wrap', gap: 10 },
    poolCard: { position: 'relative', width: 132, background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: 12, padding: 8, cursor: 'grab', display: 'flex', flexDirection: 'column', gap: 6, transition: 'all 0.15s', userSelect: 'none' },
    poolImg: { width: '100%', height: 64, objectFit: 'cover', borderRadius: 8 },
    poolTitulo: { fontSize: '0.8rem', fontWeight: 700, color: '#1f2937', lineHeight: 1.2 },
    infoBtn: { position: 'absolute', top: 5, right: 5, background: 'rgba(31,95,134,0.85)', border: 'none', color: 'white', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },

    barraInferior: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 14, padding: '10px 16px', background: 'white', borderTop: '1px solid #e2e8f0', flexShrink: 0 },
    btnComprobar: { display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#27ae60,#1e8449)', color: 'white', border: 'none', borderRadius: 12, padding: '12px 26px', fontWeight: 800, fontSize: '0.95rem' },

    modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
    modalEvento: { position: 'relative', background: 'white', borderRadius: 16, width: '100%', maxWidth: 440, padding: 20, maxHeight: '88vh', overflowY: 'auto' },
    modalClose: { position: 'absolute', top: 12, right: 12, background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },

    winOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
    winCard: { background: 'white', borderRadius: 20, padding: '28px 26px', width: '100%', maxWidth: 360, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' },
    winBtnEnviar: { padding: '12px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#f1c40f,#e67e22)', color: 'white', fontWeight: 800, cursor: 'pointer', fontSize: '0.95rem' },
    winBtnSec: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '11px', borderRadius: 12, border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontWeight: 700, cursor: 'pointer' },

    envLabel: { fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 },
};
