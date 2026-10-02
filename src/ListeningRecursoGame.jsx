import React, { useState, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { db } from './firebase';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { ArrowLeft, Headphones, Search, CheckCircle, XCircle, Send, ChevronRight, Pencil, Plus, FileDown } from 'lucide-react';
import {
    ListeningPlayer, TranscriptView, ModalEnviarProfe, parsearTranscript, dividirEnFrases, cleanText, AUDIO_DURACION_EST,
} from './ListeningGame';
import { TIPO_LISTENING_RECURSO, IDIOMAS_CREAR, getIdiomaCrear, construirItem, contarPalabras } from './listeningCrear';

const EditorListening = lazy(() => import('./components/EditorListening'));
const ModalPdfListening = lazy(() => import('./components/ModalPdfListening'));

// ─── Listening creado por un profesor (tipoJuego LISTENING_RECURSO) ──────────
// Sin `recurso` abre el buscador (código / tema / mis listenings).
// Flujo: INICIO → parte 1 → parte 2 → RESULTADO. El orden de las partes
// (preguntas de comprensión y texto con huecos) lo elige el profesor.

const fondo = { minHeight: '100vh', background: 'linear-gradient(135deg,#1a1a2e,#16213e)', fontFamily: "'Segoe UI',sans-serif", color: 'white' };
const btnVolver = { background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 10, padding: '8px 14px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.88rem', fontFamily: 'inherit' };
const btnPrincipal = { flex: 1, padding: 13, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#8E44AD,#6c3483)', color: 'white', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 };

function Cabecera({ titulo, subtitulo, onBack, extra }) {
    return (
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
            {onBack && <button onClick={onBack} style={btnVolver}><ArrowLeft size={16} /> Volver</button>}
            <Headphones size={26} color="#bb8fce" />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titulo}</div>
                {subtitulo && <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem' }}>{subtitulo}</div>}
            </div>
            {extra}
        </div>
    );
}

// ─── Buscador ─────────────────────────────────────────────────────────────────
function PantallaBuscar({ usuario, onElegir, onEditar, onCrear, onExit }) {
    const [pestana, setPestana] = useState('TEMA');
    const [codigo, setCodigo] = useState('');
    const [tema, setTema] = useState('');
    const [idioma, setIdioma] = useState('');
    const [resultados, setResultados] = useState(null);
    const [buscando, setBuscando] = useState(false);
    const [error, setError] = useState('');
    const [pdf, setPdf] = useState(null);      // recurso del que sacar la ficha

    const buscar = async (modo = pestana) => {
        setBuscando(true); setError(''); setResultados(null);
        const ref = collection(db, 'resources');
        try {
            if (modo === 'CODIGO') {
                const limpio = codigo.toUpperCase().trim();
                if (!limpio) { setError('Escribe el código.'); setBuscando(false); return; }
                const snap = await getDocs(query(ref, where('accessCode', '==', limpio)));
                const r = snap.docs.map(d => ({ ...d.data(), id: d.id })).find(x => x.tipoJuego === TIPO_LISTENING_RECURSO);
                if (!r) setError(snap.empty ? 'Código no encontrado.' : 'Ese código no es de un listening.');
                else { onElegir(r); return; }
            } else if (modo === 'MIOS') {
                const snap = await getDocs(query(ref, where('profesorUid', '==', usuario.uid), where('tipoJuego', '==', TIPO_LISTENING_RECURSO)));
                setResultados(snap.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => (b.actualizadoEn || 0) - (a.actualizadoEn || 0)));
            } else {
                const snap = await getDocs(query(ref, where('tipoJuego', '==', TIPO_LISTENING_RECURSO), limit(300)));
                const t = cleanText(tema);
                setResultados(snap.docs.map(d => ({ ...d.data(), id: d.id }))
                    .filter(r => r.isFinished === true)
                    .filter(r => !idioma || r.idioma === idioma)
                    .filter(r => !t || cleanText(r.titulo).includes(t) || cleanText(r.temas).includes(t)));
            }
        } catch (e) { console.error(e); setError('Error en la búsqueda: ' + e.message); }
        setBuscando(false);
    };

    const cambiarPestana = (p) => { setPestana(p); setResultados(null); setError(''); if (p === 'MIOS') buscar('MIOS'); };
    const inp = { padding: '10px 14px', borderRadius: 10, border: '2px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: 'white', outline: 'none', fontSize: '0.9rem', fontFamily: 'inherit' };
    const pestanas = [['TEMA', '🔎 Buscar'], ['CODIGO', '🔑 Código'], ...(usuario?.uid ? [['MIOS', '🧑‍🏫 Mis listenings']] : [])];

    return (
        <div style={fondo}>
            <Cabecera titulo="Listenings de profesores" subtitulo="Audios con preguntas y huecos creados por docentes" onBack={onExit}
                extra={usuario?.uid && <button onClick={onCrear} style={{ ...btnVolver, background: '#8E44AD' }}><Plus size={16} /> Crear</button>} />
            <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 16px 40px' }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                    {pestanas.map(([id, lbl]) => (
                        <button key={id} onClick={() => cambiarPestana(id)} style={{ padding: '8px 16px', borderRadius: 20, border: `2px solid ${pestana === id ? '#8E44AD' : 'rgba(255,255,255,0.15)'}`, background: pestana === id ? '#8E44AD' : 'transparent', color: 'white', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit', fontSize: '0.85rem' }}>{lbl}</button>
                    ))}
                </div>

                {pestana === 'CODIGO' && (
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && buscar()} placeholder="Código del profesor (ej. ABCDE)" style={{ ...inp, flex: 1, letterSpacing: 2, fontWeight: 700 }} />
                        <button onClick={() => buscar()} style={{ ...btnPrincipal, flex: 'none', padding: '0 20px' }}>{buscando ? '…' : 'Entrar'}</button>
                    </div>
                )}
                {pestana === 'TEMA' && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <select value={idioma} onChange={e => setIdioma(e.target.value)} style={{ ...inp, background: '#232342' }}>
                            <option value="">🌍 Todos los idiomas</option>
                            {Object.entries(IDIOMAS_CREAR).map(([id, i]) => <option key={id} value={id}>{i.flag} {i.label}</option>)}
                        </select>
                        <input value={tema} onChange={e => setTema(e.target.value)} onKeyDown={e => e.key === 'Enter' && buscar()} placeholder="Tema o título (opcional)" style={{ ...inp, flex: 1, minWidth: 160 }} />
                        <button onClick={() => buscar()} style={{ ...btnPrincipal, flex: 'none', padding: '0 20px' }}><Search size={16} /> {buscando ? '…' : 'Buscar'}</button>
                    </div>
                )}

                {error && <div style={{ marginTop: 14, color: '#f1948a', fontSize: '0.88rem' }}>⚠ {error}</div>}
                {buscando && pestana === 'MIOS' && <div style={{ marginTop: 14, color: 'rgba(255,255,255,0.5)' }}>Cargando…</div>}
                {resultados && resultados.length === 0 && (
                    <div style={{ marginTop: 20, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
                        {pestana === 'MIOS' ? 'Aún no has creado ningún listening.' : 'No hay listenings con esos criterios.'}
                    </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10, marginTop: 16 }}>
                    {(resultados || []).map(r => {
                        const idi = getIdiomaCrear(r.idioma);
                        return (
                            <div key={r.id} style={{ padding: '14px', borderRadius: 14, border: '1.5px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <div style={{ fontSize: '0.75rem', color: '#bb8fce', fontWeight: 700 }}>{idi.flag} {idi.label} · {r.nivel || '—'}</div>
                                <div style={{ fontWeight: 700 }}>{r.titulo || 'Sin título'}</div>
                                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)' }}>
                                    {r.huecos?.length || 0} huecos · {r.preguntas?.length || 0} preguntas{r.profesorNombre ? ` · ${r.profesorNombre}` : ''}
                                    {pestana === 'MIOS' && <> · {r.isFinished ? '✅ publicado' : '📝 borrador'} · 🔑 {r.accessCode}</>}
                                </div>
                                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                                    <button onClick={() => onElegir(r)} style={{ ...btnPrincipal, padding: '8px', fontSize: '0.82rem' }}>▶ Jugar</button>
                                    {pestana === 'MIOS' && <button onClick={() => onEditar(r)} style={{ ...btnVolver, padding: '8px 12px' }}><Pencil size={14} /> Editar</button>}
                                    {pestana === 'MIOS' && <button onClick={() => setPdf(r)} title="Ficha PDF para imprimir" style={{ ...btnVolver, padding: '8px 10px' }}><FileDown size={14} /></button>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            {pdf && <Suspense fallback={null}><ModalPdfListening recurso={pdf} onClose={() => setPdf(null)} /></Suspense>}
        </div>
    );
}

// ─── Parte: preguntas de comprensión ─────────────────────────────────────────
function PartePreguntas({ preguntas, respuestas, setRespuestas, comprobado }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {preguntas.map((p, i) => (
                <div key={p.id || i} style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 14, padding: '14px 16px' }}>
                    <div style={{ fontWeight: 700, marginBottom: 10 }}>{i + 1}. {p.enunciado}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {p.opciones.map((o, k) => {
                            const elegida = respuestas[i] === k;
                            const esCorrecta = p.correcta === k;
                            let bg = elegida ? 'rgba(142,68,173,0.45)' : 'rgba(255,255,255,0.05)';
                            let borde = elegida ? '#bb8fce' : 'rgba(255,255,255,0.15)';
                            if (comprobado && esCorrecta) { bg = 'rgba(39,174,96,0.35)'; borde = '#27ae60'; }
                            else if (comprobado && elegida) { bg = 'rgba(231,76,60,0.35)'; borde = '#e74c3c'; }
                            return (
                                <button key={k} disabled={comprobado} onClick={() => setRespuestas(r => ({ ...r, [i]: k }))}
                                    style={{ textAlign: 'left', padding: '9px 12px', borderRadius: 10, border: `2px solid ${borde}`, background: bg, color: 'white', cursor: comprobado ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <b style={{ opacity: 0.6 }}>{String.fromCharCode(65 + k)}</b> {o}
                                    {comprobado && esCorrecta && <CheckCircle size={16} style={{ marginLeft: 'auto' }} />}
                                    {comprobado && elegida && !esCorrecta && <XCircle size={16} style={{ marginLeft: 'auto' }} />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Juego ────────────────────────────────────────────────────────────────────
function JugarListening({ recurso, onBack, usuario = null }) {
    const item = useMemo(() => construirItem(recurso), [recurso]);
    const idi = getIdiomaCrear(recurso.idioma);
    const preguntas = (recurso.preguntas || []).filter(p => p.enunciado && p.opciones?.length >= 2);
    const hayHuecos = item.gaps.length > 0;
    const partes = (recurso.ordenPartes === 'huecos' ? ['HUECOS', 'PREGUNTAS'] : ['PREGUNTAS', 'HUECOS'])
        .filter(p => p === 'HUECOS' ? hayHuecos : preguntas.length > 0);

    const [fase, setFase] = useState('INICIO');         // INICIO | 0 | 1 | RESULTADO
    const [modo, setModo] = useState('multiple');
    const [respHuecos, setRespHuecos] = useState({});
    const [respPreg, setRespPreg] = useState({});
    const [comprobados, setComprobados] = useState({}); // { HUECOS: true, PREGUNTAS: true }
    const [frasesReveladas, setFrasesReveladas] = useState(1);
    const [mostrarEnvio, setMostrarEnvio] = useState(false);
    const [mostrarPdf, setMostrarPdf] = useState(false);
    const audioRef = useRef(null);

    const segmentos = useMemo(() => parsearTranscript(item.gappedTranscript, item.gaps), [item]);
    const frases = useMemo(() => dividirEnFrases(segmentos), [segmentos]);

    // El texto aparece al ritmo del audio: reparto proporcional a las palabras
    const onTimeUpdate = useCallback((t) => {
        const dur = item.audioUrl ? (audioRef.current?.duration || recurso.audioDuracion || AUDIO_DURACION_EST) : AUDIO_DURACION_EST;
        const pal = frases.map(f => f.reduce((a, s) => a + (s.type === 'text' ? contarPalabras(s.text) : 1), 0));
        const total = pal.reduce((a, b) => a + b, 0) || 1;
        let acc = 0, idx = 0;
        for (let i = 0; i < pal.length; i++) { if ((acc / total) * dur <= t) idx = i; acc += pal[i]; }
        setFrasesReveladas(prev => Math.max(prev, Math.min(idx + 2, frases.length + 1)));
    }, [frases, item.audioUrl, recurso.audioDuracion]);

    const aciertosHuecos = item.gaps.filter(g => cleanText(respHuecos[g.gap_number]) === cleanText(g.answer)).length;
    const aciertosPreg = preguntas.filter((p, i) => respPreg[i] === p.correcta).length;
    const aciertos = (comprobados.HUECOS ? aciertosHuecos : 0) + (comprobados.PREGUNTAS ? aciertosPreg : 0);
    const total = (hayHuecos ? item.gaps.length : 0) + preguntas.length;
    const pct = total ? Math.round(aciertos / total * 100) : 0;

    const player = (
        <div style={{ marginBottom: 16 }}>
            <ListeningPlayer item={item} lang={idi.lang} onTimeUpdate={onTimeUpdate} controlRef={audioRef} />
        </div>
    );

    if (partes.length === 0) return (
        <div style={fondo}>
            <Cabecera titulo={recurso.titulo} onBack={onBack} />
            <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>Este listening aún no tiene huecos ni preguntas.</div>
        </div>
    );

    // ── Pantalla de inicio ──
    if (fase === 'INICIO') return (
        <div style={fondo}>
            <Cabecera titulo={recurso.titulo} subtitulo={`${idi.flag} ${idi.label} · ${recurso.nivel || ''}${recurso.profesorNombre ? ' · ' + recurso.profesorNombre : ''}`} onBack={onBack} />
            <div style={{ maxWidth: 480, margin: '0 auto', padding: '30px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: '16px 18px', lineHeight: 1.7, fontSize: '0.92rem' }}>
                    {partes.map((p, i) => (
                        <div key={p}><b>Parte {i + 1}:</b> {p === 'PREGUNTAS'
                            ? `${preguntas.length} preguntas de comprensión${i === 0 ? ' (solo con el audio)' : ''}`
                            : `completa ${item.gaps.length} huecos del texto mientras escuchas`}</div>
                    ))}
                </div>
                {hayHuecos && (
                    <>
                        <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.55)' }}>¿Cómo quieres completar los huecos?</div>
                        {[['multiple', '🔘', 'Elegir entre opciones'], ['write', '✍️', 'Escribir la palabra']].map(([id, e, lbl]) => (
                            <button key={id} onClick={() => setModo(id)} style={{ padding: '14px 16px', borderRadius: 14, border: `2px solid ${modo === id ? '#bb8fce' : 'rgba(255,255,255,0.15)'}`, background: modo === id ? 'rgba(142,68,173,0.3)' : 'transparent', color: 'white', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', fontWeight: 700, display: 'flex', gap: 10, alignItems: 'center' }}>
                                <span style={{ fontSize: '1.4rem' }}>{e}</span>{lbl}
                            </button>
                        ))}
                    </>
                )}
                <button onClick={() => setFase(0)} style={{ ...btnPrincipal, marginTop: 8 }}>Empezar <ChevronRight size={18} /></button>
                <button onClick={() => setMostrarPdf(true)} style={{ ...btnPrincipal, background: 'transparent', border: '1.5px solid rgba(255,255,255,0.25)' }}>
                    <FileDown size={17} /> Ficha PDF para imprimir
                </button>
            </div>
            {/* Soluciones solo con sesión iniciada: así un alumno no se descarga las respuestas */}
            {mostrarPdf && <Suspense fallback={null}><ModalPdfListening recurso={recurso} conSoluciones={!!usuario?.uid} onClose={() => setMostrarPdf(false)} /></Suspense>}
        </div>
    );

    // ── Resultado final ──
    if (fase === 'RESULTADO') return (
        <div style={fondo}>
            <Cabecera titulo={recurso.titulo} onBack={onBack} />
            <div style={{ maxWidth: 480, margin: '0 auto', padding: '30px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem' }}>{pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '💪'}</div>
                <div style={{ fontSize: '2.4rem', fontWeight: 900, color: pct >= 80 ? '#2ecc71' : pct >= 50 ? '#f39c12' : '#e74c3c' }}>{pct}%</div>
                <div style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 20 }}>{aciertos} de {total} correctas</div>
                <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: '12px 16px', textAlign: 'left', marginBottom: 20, fontSize: '0.9rem', lineHeight: 1.8 }}>
                    {preguntas.length > 0 && <div>❓ Comprensión: <b>{aciertosPreg}/{preguntas.length}</b></div>}
                    {hayHuecos && <div>🕳️ Huecos: <b>{aciertosHuecos}/{item.gaps.length}</b> ({modo === 'write' ? 'escritos' : 'opción múltiple'})</div>}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={onBack} style={{ ...btnPrincipal, background: 'transparent', border: '1.5px solid rgba(255,255,255,0.25)' }}>← Otro listening</button>
                    <button onClick={() => setMostrarEnvio(true)} style={{ ...btnPrincipal, background: 'linear-gradient(135deg,#27ae60,#2ecc71)' }}><Send size={16} /> Enviar al profe</button>
                </div>
            </div>
            {mostrarEnvio && (
                <ModalEnviarProfe
                    datos={{ aciertos, total, porcentaje: pct, tema: recurso.titulo, modo: `${modo}${preguntas.length ? ' + preguntas' : ''}`, modalidad: 'Recurso del profesor' }}
                    onClose={() => setMostrarEnvio(false)} />
            )}
        </div>
    );

    // ── Partes ──
    const parte = partes[fase];
    const hecho = !!comprobados[parte];
    const siguiente = () => {
        if (fase + 1 < partes.length) { setFase(fase + 1); window.scrollTo(0, 0); }
        else setFase('RESULTADO');
    };
    const comprobar = () => {
        if (parte === 'PREGUNTAS' && Object.keys(respPreg).length < preguntas.length
            && !window.confirm('Te quedan preguntas sin contestar. ¿Comprobar igualmente?')) return;
        if (parte === 'HUECOS') setFrasesReveladas(frases.length + 1);
        setComprobados(c => ({ ...c, [parte]: true }));
    };

    return (
        <div style={fondo}>
            <Cabecera titulo={recurso.titulo} subtitulo={`Parte ${fase + 1} de ${partes.length} · ${parte === 'PREGUNTAS' ? 'Comprensión' : 'Completa el texto'}`} onBack={onBack} />
            <div style={{ maxWidth: 760, margin: '0 auto', padding: '16px 16px 40px' }}>
                {player}
                {parte === 'HUECOS' ? (
                    <>
                        {!hecho && (
                            <div style={{ background: 'rgba(142,68,173,0.18)', border: '1px solid rgba(187,143,206,0.35)', borderRadius: 10, padding: '10px 14px', color: 'rgba(255,255,255,0.75)', fontSize: '0.82rem', marginBottom: 14 }}>
                                🎧 Escucha y completa los huecos. El texto aparece a medida que avanza el audio.
                                <button onClick={() => setFrasesReveladas(frases.length + 1)} style={{ marginLeft: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#d2b4de', fontSize: '0.8rem', textDecoration: 'underline' }}>Ver todo el texto</button>
                            </div>
                        )}
                        <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 16, padding: '22px 20px', marginBottom: 16, minHeight: 160 }}>
                            <TranscriptView segmentos={segmentos} modo={modo} respuestas={respHuecos}
                                onRespuesta={(num, val) => setRespHuecos(prev => ({ ...prev, [num]: val }))}
                                frasesReveladas={frasesReveladas} comprobado={hecho} totalFrases={frases.length} />
                        </div>
                        {hecho && <div style={{ marginBottom: 14, fontWeight: 700 }}>🕳️ {aciertosHuecos}/{item.gaps.length} huecos correctos</div>}
                    </>
                ) : (
                    <>
                        <PartePreguntas preguntas={preguntas} respuestas={respPreg} setRespuestas={setRespPreg} comprobado={hecho} />
                        {hecho && <div style={{ margin: '14px 0', fontWeight: 700 }}>❓ {aciertosPreg}/{preguntas.length} preguntas correctas</div>}
                    </>
                )}
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                    {!hecho
                        ? <button onClick={comprobar} style={btnPrincipal}><CheckCircle size={18} /> Comprobar</button>
                        : <button onClick={siguiente} style={btnPrincipal}>{fase + 1 < partes.length ? 'Siguiente parte' : 'Ver resultado'} <ChevronRight size={18} /></button>}
                </div>
            </div>
        </div>
    );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ListeningRecursoGame({ recurso: recursoInicial = null, usuario = null, onExit }) {
    const [recurso, setRecurso] = useState(recursoInicial?.texto ? recursoInicial : null);
    const [editando, setEditando] = useState(null);   // datos del editor abierto

    const volver = () => { if (recursoInicial?.texto) onExit?.(); else setRecurso(null); };

    if (editando) return (
        <Suspense fallback={<div style={fondo} />}>
            <EditorListening datos={editando} setDatos={setEditando} usuario={usuario} onClose={() => setEditando(null)} />
        </Suspense>
    );
    if (recurso) return <JugarListening key={recurso.id} recurso={recurso} usuario={usuario} onBack={volver} />;
    return (
        <PantallaBuscar usuario={usuario} onExit={onExit}
            onElegir={setRecurso}
            onEditar={r => setEditando(r)}
            onCrear={async () => {
                const { recursoListeningVacio } = await import('./components/EditorListening');
                setEditando(recursoListeningVacio(usuario));
            }} />
    );
}
