import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, getDocs, collection, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import {
    Trophy, ArrowLeft, X, RefreshCw, Medal, UserPlus, Gamepad2, Video, ExternalLink, Share2, Wrench
} from 'lucide-react';
import { enlaceAbsoluto } from '../utils/retoLink';

const AZUL = '#1565C0';
const MEDALLAS = ['🥇', '🥈', '🥉'];
// En público cada participante se identifica por su alias, nunca por su nombre real.
export const aliasDe = (p) => (p?.alias || '').trim() || 'Sin alias';

function RankingLista({ filas }) {
    if (filas.length === 0) return <div style={s.vacio}>Sin participantes todavía.</div>;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filas.map((f, i) => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'white', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: i < 3 ? `4px solid ${['#f1c40f', '#bdc3c7', '#cd7f32'][i]}` : '4px solid #eef1f6' }}>
                    <span style={{ width: 28, textAlign: 'center', fontWeight: 800, color: '#7f8c8d' }}>{i < 3 ? MEDALLAS[i] : i + 1}</span>
                    <span style={{ flex: 1, fontWeight: 600, color: '#2c3e50' }}>{f.nombre}</span>
                    <span style={{ fontWeight: 800, color: AZUL, fontSize: '1.05rem' }}>{f.valor}</span>
                </div>
            ))}
        </div>
    );
}

function ModalInscripcion({ comp, compId, onClose }) {
    const [nombre, setNombre] = useState('');
    const [alias, setAlias]   = useState('');
    const [clave, setClave]   = useState('');
    const [email, setEmail]   = useState('');
    const [extra, setExtra]   = useState('');
    const [estado, setEstado] = useState('form'); // form | enviando | ok
    const [error, setError]   = useState('');

    const enviar = async () => {
        if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
        if (!alias.trim())  { setError('Escribe un alias: es el nombre con el que aparecerás en la clasificación pública.'); return; }
        const cl = clave.trim();
        if (cl.length < 4 || cl.length > 8) { setError('La contraseña debe tener entre 4 y 8 caracteres.'); return; }
        setEstado('enviando'); setError('');
        try {
            // El alias identifica al participante al enviar resultados: no puede repetirse
            const ya = await getDocs(collection(db, 'competiciones', compId, 'participantes'));
            const norm = (x) => (x || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
            if (ya.docs.some(d => norm(d.data().alias) === norm(alias))) {
                setError('Ese alias ya está cogido en esta competición. Elige otro.'); setEstado('form'); return;
            }
            const ref = await addDoc(collection(db, 'competiciones', compId, 'participantes'), {
                nombre: nombre.trim(), alias: alias.trim(), email: email.trim(), extra: extra.trim(),
                estado: comp.inscripcion === 'auto' ? 'aceptada' : 'pendiente',
                origen: 'inscripcion', fecha: serverTimestamp(),
            });
            // La clave va en una colección aparte: nadie puede leerla salvo el organizador
            await setDoc(doc(db, 'competiciones', compId, 'claves', ref.id), {
                clave: cl, alias: alias.trim(), fecha: serverTimestamp(),
            });
            setEstado('ok');
        } catch (e) { setError('No se pudo enviar: ' + e.message); setEstado('form'); }
    };

    return (
        <div style={s.overlay} onClick={onClose}>
            <div style={{ ...s.panel, maxWidth: 440 }} onClick={e => e.stopPropagation()}>
                <div style={s.header}><div style={s.hTitle}><UserPlus size={19} color={AZUL} /> Inscripción</div><button onClick={onClose} style={s.closeBtn}><X size={18} /></button></div>
                {estado === 'ok' ? (
                    <div style={{ textAlign: 'center', padding: '10px 0' }}>
                        <div style={{ fontSize: 42 }}>✅</div>
                        <p style={{ color: '#2c3e50', fontWeight: 600 }}>{comp.inscripcion === 'auto' ? '¡Inscripción completada!' : 'Solicitud enviada. El organizador debe aceptarte.'}</p>
                        <button onClick={onClose} style={s.btnPrimary}>Cerrar</button>
                    </div>
                ) : (
                    <>
                        <div style={{ fontSize: '0.83rem', color: '#7f8c8d', marginBottom: 10 }}>
                            {comp.inscripcion === 'auto' ? 'Al enviar quedarás inscrito automáticamente.' : 'Tu solicitud quedará pendiente hasta que el organizador la acepte.'}
                        </div>
                        <div style={s.label}>Nombre</div>
                        <input autoFocus value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre y apellidos" style={s.input} />
                        <div style={s.label}>Alias público</div>
                        <input value={alias} onChange={e => setAlias(e.target.value)} placeholder="Ej: Águila 27" style={s.input} />
                        <div style={{ fontSize: '0.78rem', color: '#95a5a6', marginTop: -6, marginBottom: 10 }}>
                            En la clasificación pública solo se muestra tu alias; tu nombre lo ve únicamente el organizador.
                        </div>
                        <div style={s.label}>Contraseña (4-8 caracteres)</div>
                        <input type="text" value={clave} maxLength={8} onChange={e => setClave(e.target.value)} placeholder="Ej: pi2024" style={s.input} />
                        <div style={{ fontSize: '0.78rem', color: '#95a5a6', marginTop: -6, marginBottom: 10 }}>
                            La necesitarás para enviar tus puntuaciones de las pruebas. Apúntala: el organizador puede consultarla si la olvidas.
                        </div>
                        <div style={s.label}>Correo (opcional)</div>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" style={s.input} />
                        <div style={s.label}>Información adicional (opcional)</div>
                        <textarea value={extra} onChange={e => setExtra(e.target.value)} rows={2} placeholder="Curso, equipo, categoría…" style={{ ...s.input, resize: 'vertical' }} />
                        {error && <div style={{ color: '#e74c3c', fontSize: '0.82rem', marginBottom: 8 }}>{error}</div>}
                        <div style={s.btnRow}>
                            <button onClick={onClose} style={s.btnSec}>Cancelar</button>
                            <button onClick={enviar} disabled={estado === 'enviando'} style={s.btnPrimary}>{estado === 'enviando' ? 'Enviando…' : 'Inscribirme'}</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// ─── Bloque reutilizable: resultados de una competición (página de comunidad) ──
export function CompeticionResumenPublico({ comp, limite = 10 }) {
    const [parts, setParts] = useState([]);
    const [tab, setTab] = useState('general');

    useEffect(() => onSnapshot(collection(db, 'competiciones', comp.id, 'participantes'),
        sn => setParts(sn.docs.map(d => ({ id: d.id, ...d.data() }))), () => {}), [comp.id]);

    const categorias = comp.categorias || [];
    const puntos = comp.puntos || {};
    const aceptados = parts.filter(p => p.estado !== 'pendiente');
    const total = (pid) => categorias.reduce((a, c) => a + (Number(puntos[`${pid}_${c.id}`]) || 0), 0);
    const filas = [...aceptados]
        .map(p => ({ id: p.id, nombre: aliasDe(p), valor: tab === 'general' ? total(p.id) : (Number(puntos[`${p.id}_${tab}`]) || 0) }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, limite);

    return (
        <div style={{ background: 'white', borderRadius: 14, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                <Trophy size={20} color="#f39c12" />
                <h3 style={{ margin: 0, color: '#2c3e50', flex: 1, minWidth: 140 }}>{comp.nombre}</h3>
                <a href={`/competicion/${comp.id}`} target="_blank" rel="noreferrer" style={s.chipLink}>Ver competición <ExternalLink size={11} /></a>
            </div>
            {categorias.length > 0 && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 4 }}>
                    <button onClick={() => setTab('general')} style={chipTab(tab === 'general')}>🏆 General</button>
                    {categorias.map(c => <button key={c.id} onClick={() => setTab(c.id)} style={chipTab(tab === c.id)}>{c.titulo}</button>)}
                </div>
            )}
            {(() => {
                const cat = categorias.find(c => c.id === tab);
                return cat?.herramientaId ? (
                    <a href={enlaceAbsoluto(cat.herramientaRuta)} target="_blank" rel="noreferrer" style={{ ...s.chipLink, background: '#fce4ec', color: '#E91E63', marginBottom: 10 }}>
                        <Wrench size={14} /> Jugar: {cat.herramientaTitulo} <ExternalLink size={11} />
                    </a>
                ) : null;
            })()}
            <div style={{ fontSize: '0.78rem', color: '#95a5a6', marginBottom: 8 }}>Cada participante aparece con su alias.</div>
            <RankingLista filas={filas} />
            {aceptados.length > limite && <div style={{ fontSize: '0.78rem', color: '#95a5a6', marginTop: 8, textAlign: 'center' }}>y {aceptados.length - limite} participantes más…</div>}
        </div>
    );
}

export default function CompeticionPublica({ compId, onExit }) {
    const [comp, setComp] = useState(undefined);
    const [parts, setParts] = useState([]);
    const [tab, setTab] = useState('general');
    const [inscribir, setInscribir] = useState(false);
    // Enlace directo de inscripción (?inscribir=1): sirve aunque el organizador
    // haya ocultado el botón de la página pública
    const conEnlaceInscripcion = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('inscribir') === '1';

    useEffect(() => {
        getDoc(doc(db, 'competiciones', compId))
            .then(sn => setComp(sn.exists() ? { id: sn.id, ...sn.data() } : null))
            .catch(() => setComp(null));
    }, [compId]);
    useEffect(() => onSnapshot(collection(db, 'competiciones', compId, 'participantes'),
        sn => setParts(sn.docs.map(d => ({ id: d.id, ...d.data() }))), () => {}), [compId]);
    // Con el enlace de inscripción se abre el formulario directamente
    useEffect(() => {
        if (conEnlaceInscripcion && comp && (comp.inscripcion === 'auto' || comp.inscripcion === 'aprobacion')) setInscribir(true);
    }, [comp]); // eslint-disable-line react-hooks/exhaustive-deps

    const compartir = async () => {
        const url = window.location.href;
        try { if (navigator.share) { await navigator.share({ title: comp?.nombre, url }); return; } } catch (_) { return; }
        try { await navigator.clipboard.writeText(url); alert('Enlace copiado:\n' + url); } catch { window.prompt('Copia el enlace:', url); }
    };

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#fff7e6,#f5f8fc)', paddingTop: 60 }}>
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 52, background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', zIndex: 100 }}>
                <button onClick={onExit} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: AZUL, cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}><ArrowLeft size={18} /> Inicio</button>
                <div style={{ fontWeight: 800, color: '#2c3e50', display: 'flex', alignItems: 'center', gap: 8 }}><Trophy size={20} color="#f39c12" /> Competición</div>
            </div>

            <div style={{ maxWidth: 760, margin: '0 auto', padding: '16px 12px 40px' }}>
                {comp === undefined ? <div style={s.loader}><RefreshCw size={26} style={{ animation: 'spin 1s linear infinite' }} /></div>
                    : comp === null ? <div style={s.vacio}>Esta competición no existe o no está disponible.</div>
                        : (() => {
                            const categorias = comp.categorias || [];
                            const puntos = comp.puntos || {};
                            const aceptados = parts.filter(p => p.estado !== 'pendiente');
                            const total = (pid) => categorias.reduce((a, c) => a + (Number(puntos[`${pid}_${c.id}`]) || 0), 0);
                            // La inscripción está abierta, pero el organizador puede ocultar el
                            // botón de la página pública: entonces solo se ve con ?inscribir=1
                            const inscripcionAbierta = comp.inscripcion === 'auto' || comp.inscripcion === 'aprobacion';
                            const puedeInscribir = inscripcionAbierta && (comp.mostrarInscripcion !== false || conEnlaceInscripcion);
                            const catActiva = categorias.find(c => c.id === tab);
                            let filas;
                            if (tab === 'general') filas = [...aceptados].map(p => ({ id: p.id, nombre: aliasDe(p), valor: total(p.id) })).sort((a, b) => b.valor - a.valor);
                            else filas = [...aceptados].map(p => ({ id: p.id, nombre: aliasDe(p), valor: Number(puntos[`${p.id}_${tab}`]) || 0 })).sort((a, b) => b.valor - a.valor);
                            const yt = catActiva && (catActiva.videoUrl || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{11})/);

                            return (
                                <>
                                    <div style={{ background: 'white', borderRadius: 16, padding: '18px 20px', boxShadow: '0 2px 10px rgba(0,0,0,0.08)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                        <Trophy size={30} color="#f39c12" />
                                        <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#2c3e50', flex: 1, minWidth: 160 }}>{comp.nombre}</h1>
                                        <button onClick={compartir} style={s.btnSec}><Share2 size={15} /> Compartir</button>
                                        {puedeInscribir && <button onClick={() => setInscribir(true)} style={s.btnPrimary}><UserPlus size={15} /> Inscribirse</button>}
                                    </div>

                                    {/* Pestañas */}
                                    <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
                                        <button onClick={() => setTab('general')} style={chipTab(tab === 'general')}>🏆 General</button>
                                        {categorias.map(c => <button key={c.id} onClick={() => setTab(c.id)} style={chipTab(tab === c.id)}>{c.titulo}</button>)}
                                    </div>

                                    {/* Detalle de categoría */}
                                    {catActiva && (
                                        <div style={{ background: 'white', borderRadius: 14, padding: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 14 }}>
                                            {catActiva.fotoUrl && <img src={catActiva.fotoUrl} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 10, marginBottom: 10 }} />}
                                            {catActiva.descripcion && <p style={{ color: '#555', fontSize: '0.9rem', lineHeight: 1.5, margin: '0 0 8px', whiteSpace: 'pre-wrap' }}>{catActiva.descripcion}</p>}
                                            {yt && <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, margin: '10px 0', borderRadius: 10, overflow: 'hidden' }}><iframe title="vídeo" src={`https://www.youtube.com/embed/${yt[1]}`} allowFullScreen style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }} /></div>}
                                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                {catActiva.videoUrl && !yt && <a href={catActiva.videoUrl} target="_blank" rel="noreferrer" style={s.chipLink}><Video size={14} /> Ver vídeo <ExternalLink size={11} /></a>}
                                                {catActiva.recursoId && <a href={`/?r=${catActiva.recursoId}`} target="_blank" rel="noreferrer" style={s.chipLink}><Gamepad2 size={14} /> {catActiva.recursoTitulo || 'Jugar'} <ExternalLink size={11} /></a>}
                                                {catActiva.herramientaId && <a href={enlaceAbsoluto(catActiva.herramientaRuta)} target="_blank" rel="noreferrer" style={{ ...s.chipLink, background: '#fce4ec', color: '#E91E63' }}><Wrench size={14} /> Jugar: {catActiva.herramientaTitulo} <ExternalLink size={11} /></a>}
                                            </div>
                                            {catActiva.herramientaId && (catActiva.herramientaResumen || []).length > 0 && (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                                                    {catActiva.herramientaResumen.map((r, i) => <span key={i} style={{ background: '#f4f6f8', color: '#7f8c8d', borderRadius: 20, padding: '3px 10px', fontSize: '0.76rem', fontWeight: 600 }}>{r}</span>)}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <h2 style={{ color: '#2c3e50', fontSize: '1.05rem', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 8 }}><Medal size={18} color="#f39c12" /> {tab === 'general' ? 'Clasificación general' : 'Clasificación de la prueba'}</h2>
                                    <div style={{ fontSize: '0.78rem', color: '#95a5a6', margin: '-4px 0 10px' }}>Cada participante aparece con su alias.</div>
                                    <RankingLista filas={filas} />

                                    {inscribir && <ModalInscripcion comp={comp} compId={compId} onClose={() => setInscribir(false)} />}
                                </>
                            );
                        })()}
            </div>
            <style>{`@keyframes spin{100%{transform:rotate(360deg)}}`}</style>
        </div>
    );
}

const chipTab = (activo) => ({ padding: '8px 16px', borderRadius: 20, border: `1.5px solid ${activo ? AZUL : '#e0e4f0'}`, background: activo ? AZUL : 'white', color: activo ? 'white' : '#555', cursor: 'pointer', fontSize: '0.86rem', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 });

const s = {
    overlay: { position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
    panel: { background: 'white', borderRadius: 20, width: '100%', padding: 26, boxShadow: '0 20px 50px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
    hTitle: { fontWeight: 700, color: '#2c3e50', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 },
    closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#95a5a6', padding: 4 },
    label: { fontSize: '0.76rem', fontWeight: 700, color: '#7f8c8d', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6, marginTop: 4 },
    input: { padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e0e4f0', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 12, background: 'white' },
    btnRow: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 },
    btnPrimary: { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9, border: 'none', background: AZUL, color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.86rem' },
    btnSec: { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 9, border: '1.5px solid #e0e4f0', background: 'white', color: '#7f8c8d', fontWeight: 600, cursor: 'pointer', fontSize: '0.86rem' },
    vacio: { textAlign: 'center', padding: 30, color: '#95a5a6', fontSize: '0.9rem', background: 'white', borderRadius: 12 },
    loader: { textAlign: 'center', padding: 40, color: '#95a5a6' },
    chipLink: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.82rem', background: '#e8f0fe', color: AZUL, padding: '6px 12px', borderRadius: 20, textDecoration: 'none', fontWeight: 600 },
};
