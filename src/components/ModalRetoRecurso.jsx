import React, { useEffect, useMemo, useState } from 'react';
import { X, Search, RefreshCw, ChevronLeft, Key } from 'lucide-react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import ModalCompartirReto from './ModalCompartirReto';
import { preguntasDeRecurso, categoriasDeRecurso } from '../utils/normalizarPreguntas';

const AZUL = '#1565C0';

// ─── Juegos que se juegan con un recurso del profesor ─────────────────────────
// El enlace es el deep-link de siempre (/?r=ID&h=HOJA&m=MODO, ver App.jsx), que
// abre GamePlayer con autoStart: el alumno juega directamente ese recurso, esa
// hoja y ese modo, y al terminar envía el resultado al profesor.
//   tipos: tipoJuego de los recursos que sirven · modos: variantes a elegir
//   sinHoja: el juego no usa la hoja del enlace
//   valido(r): filtro extra (juegos que aceptan recursos de cualquier tipo)
//   modoFijo: el modo (m=…) identifica al juego, no se elige
const MODOS_BURBUJAS = [
    { id: 'BURBUJAS', label: '🔵 Cazaburbujas' },
    { id: 'TEST', label: '📝 Test' },
    { id: 'PIKATRON', label: '⚡ Pikatron Run' },
    { id: 'PLATAFORMAS', label: '🕹️ Plataformas' },
];
const MODOS_PALABRA = [
    { id: 'WORDLE', label: '🟩 Wordle' },
    { id: 'SOPA', label: '🔍 Sopa de letras' },
    { id: 'AHORCADO', label: '🪢 Ahorcado' },
];

export const JUEGOS_RECURSO = {
    PASAPALABRA:  { label: 'Pasapalabra', tipos: ['PASAPALABRA'] },
    CAZABURBUJAS: { label: 'Burbujas', tipos: ['CAZABURBUJAS', 'PIKATRON'], modos: MODOS_BURBUJAS, modo: 'BURBUJAS' },
    PIKATRON:     { label: 'Pikatron', tipos: ['CAZABURBUJAS', 'PIKATRON'], modos: MODOS_BURBUJAS, modo: 'PIKATRON' },
    APAREJADOS:   { label: 'AparejaDOS', tipos: ['APAREJADOS'] },
    RULETA:       { label: 'Ruleta', tipos: ['RULETA'] },
    WORDLE:       { label: 'Wordle', tipos: ['WORDLE', 'SOPA'], modos: MODOS_PALABRA, modo: 'WORDLE', sinHoja: true },
    SOPA:         { label: 'Sopa de letras', tipos: ['WORDLE', 'SOPA'], modos: MODOS_PALABRA, modo: 'SOPA', sinHoja: true },
    AHORCADO:     { label: 'Ahorcado', tipos: ['WORDLE', 'SOPA'], modos: MODOS_PALABRA, modo: 'AHORCADO', sinHoja: true },
    CALAMAR:      { label: 'Luz roja · Luz verde', tipos: null, valido: (r) => preguntasDeRecurso(r).length > 0, modo: 'CALAMAR', modoFijo: true, sinHoja: true },
    MONEYBOARD:   { label: 'Money Board', tipos: null, valido: (r) => categoriasDeRecurso(r).length >= 2, modo: 'MONEYBOARD', modoFijo: true, sinHoja: true },
    BUNKER:       { label: 'Bunker', tipos: ['CAZABURBUJAS'], modo: 'BUNKER', modoFijo: true, sinHoja: true },
};

const limpiar = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export const rutaRecurso = (recursoId, { hoja, modo } = {}) => {
    const p = new URLSearchParams();
    p.set('r', recursoId);
    if (hoja && hoja !== 'General') p.set('h', hoja);
    if (modo) p.set('m', modo);
    return `/?${p.toString()}`;
};

/**
 * Compartir un juego con un recurso concreto ya elegido (hoja + modo).
 * Pasos: buscar recurso → ajustes → enlace (ModalCompartirReto con url fija).
 */
export default function ModalRetoRecurso({ juegoId, onVolver, onClose }) {
    const juego = JUEGOS_RECURSO[juegoId];
    const uid = auth.currentUser?.uid || null;

    const [pestana, setPestana] = useState(uid ? 'MIOS' : 'PUBLICOS');
    const [cargando, setCargando] = useState(false);
    const [mios, setMios] = useState(null);
    const [publicos, setPublicos] = useState(null);
    const [texto, setTexto] = useState('');
    const [codigo, setCodigo] = useState('');
    const [errorCodigo, setErrorCodigo] = useState('');

    const [recurso, setRecurso] = useState(null);
    const [hoja, setHoja] = useState('General');
    const [modo, setModo] = useState(juego?.modo || null);
    const [paso, setPaso] = useState('BUSCAR'); // BUSCAR | AJUSTES | ENLACE

    const sirve = (r) => (!juego.tipos || juego.tipos.includes(r.tipoJuego)) && (!juego.valido || juego.valido(r));

    useEffect(() => {
        if (!juego) return;
        if (pestana === 'MIOS' && uid && mios === null) {
            setCargando(true);
            getDocs(query(collection(db, 'resources'), where('profesorUid', '==', uid)))
                .then(snap => setMios(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(sirve)))
                .catch(() => setMios([]))
                .finally(() => setCargando(false));
        }
        if (pestana === 'PUBLICOS' && publicos === null) {
            setCargando(true);
            getDocs(juego.tipos
                ? query(collection(db, 'resources'), where('tipoJuego', 'in', juego.tipos), limit(300))
                : query(collection(db, 'resources'), where('isPrivate', '==', false), limit(400)))
                .then(snap => setPublicos(snap.docs.map(d => ({ id: d.id, ...d.data() }))
                    .filter(r => r.isPrivate !== true && !(r.isFinished === false && r.config?.isFinished !== true) && sirve(r))))
                .catch(() => setPublicos([]))
                .finally(() => setCargando(false));
        }
    }, [pestana, uid]); // eslint-disable-line react-hooks/exhaustive-deps

    const lista = useMemo(() => {
        const base = (pestana === 'MIOS' ? mios : publicos) || [];
        const q = limpiar(texto.trim());
        const filtrada = q ? base.filter(r => limpiar(`${r.titulo} ${r.temas} ${r.profesorNombre}`).includes(q)) : base;
        return [...filtrada].sort((a, b) => (b.playCount || 0) - (a.playCount || 0)).slice(0, 80);
    }, [pestana, mios, publicos, texto]);

    const buscarCodigo = async () => {
        const code = codigo.trim().toUpperCase();
        if (!code) return;
        setErrorCodigo(''); setCargando(true);
        try {
            let snap = await getDocs(query(collection(db, 'resources'), where('accessCode', '==', code)));
            if (snap.empty) snap = await getDocs(query(collection(db, 'resources'), where('hojasCodes', 'array-contains', code)));
            if (snap.empty) { setErrorCodigo('Código no encontrado.'); return; }
            const r = { id: snap.docs[0].id, ...snap.docs[0].data() };
            if (!sirve(r)) { setErrorCodigo(`Ese recurso no es de ${juego.label}.`); return; }
            elegir(r);
        } catch (e) { setErrorCodigo('Error: ' + e.message); }
        finally { setCargando(false); }
    };

    const elegir = (r) => { setRecurso(r); setHoja('General'); setPaso('AJUSTES'); };

    if (!juego) return null;

    const hojas = (recurso?.hojas || []).map(h => h.nombreHoja).filter(Boolean);
    const modoLabel = juego.modos?.find(m => m.id === modo)?.label;

    if (paso === 'ENLACE' && recurso) return (
        <ModalCompartirReto
            urlFija={rutaRecurso(recurso.id, { hoja: juego.sinHoja ? null : hoja, modo })}
            nombreJuego={modoLabel && !juego.modoFijo ? modoLabel.replace(/^\S+\s/, '') : juego.label}
            resumen={[`📚 ${recurso.titulo}`, ...(!juego.sinHoja && hojas.length > 0 ? [`📄 ${hoja === 'General' ? 'Todas las hojas' : hoja}`] : []), ...(modoLabel ? [modoLabel] : [])]}
            onEditar={() => setPaso('AJUSTES')}
            onClose={onClose}
        />
    );

    return (
        <div style={st.overlay} onClick={onClose}>
            <div style={st.panel} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <button onClick={() => (paso === 'AJUSTES' ? setPaso('BUSCAR') : (onVolver || onClose)())} style={st.volver}>
                        <ChevronLeft size={18} /> {paso === 'AJUSTES' ? 'Otro recurso' : 'Volver'}
                    </button>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#95a5a6' }}><X size={20} /></button>
                </div>
                <div style={{ fontWeight: 800, color: '#2c3e50', fontSize: '1.05rem', margin: '4px 0 4px' }}>
                    ⚙️ {juego.label} con un recurso concreto
                </div>

                {paso === 'BUSCAR' && (<>
                    <p style={st.ayuda}>Elige el recurso. El alumno abrirá el enlace y jugará directamente, sin buscar ni configurar nada, y al terminar enviará el resultado al profesor.</p>

                    <div style={{ display: 'flex', gap: 6, background: '#f1f5f9', borderRadius: 12, padding: 4, marginBottom: 12 }}>
                        {uid && <button onClick={() => setPestana('MIOS')} style={st.tab(pestana === 'MIOS')}>Mis recursos</button>}
                        <button onClick={() => setPestana('PUBLICOS')} style={st.tab(pestana === 'PUBLICOS')}>Públicos</button>
                        <button onClick={() => setPestana('CODIGO')} style={st.tab(pestana === 'CODIGO')}><Key size={13} /> Código</button>
                    </div>

                    {pestana === 'CODIGO' ? (
                        <div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && buscarCodigo()}
                                    placeholder="Código de acceso del recurso" style={{ ...st.input, letterSpacing: 2, fontWeight: 700 }} />
                                <button onClick={buscarCodigo} style={st.btnPrim}>Buscar</button>
                            </div>
                            {errorCodigo && <div style={{ color: '#e74c3c', fontSize: '0.82rem', marginTop: 8 }}>⚠ {errorCodigo}</div>}
                        </div>
                    ) : (<>
                        <div style={{ position: 'relative', marginBottom: 10 }}>
                            <Search size={15} style={{ position: 'absolute', left: 11, top: 11, color: '#94a3b8' }} />
                            <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Buscar por título, tema o autor…" style={{ ...st.input, paddingLeft: 32 }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: '46vh', overflowY: 'auto' }}>
                            {cargando && <div style={{ textAlign: 'center', color: '#7f8c8d', padding: 20 }}><RefreshCw size={20} style={{ animation: 'spinRR 1s linear infinite' }} /></div>}
                            {!cargando && lista.length === 0 && <div style={{ textAlign: 'center', color: '#95a5a6', padding: 20, fontSize: '0.88rem' }}>
                                {pestana === 'MIOS' ? `No tienes recursos de ${juego.label}.` : 'No hay recursos que coincidan.'}
                            </div>}
                            {!cargando && lista.map(r => (
                                <button key={r.id} onClick={() => elegir(r)} style={st.recurso}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, color: '#2c3e50', fontSize: '0.92rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.titulo || 'Sin título'}</div>
                                        <div style={{ color: '#888', fontSize: '0.76rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {[r.temas, r.profesorNombre, (r.hojas?.length > 1 ? `${r.hojas.length} hojas` : null)].filter(Boolean).join(' · ')}
                                        </div>
                                    </div>
                                    <span style={{ color: AZUL, fontSize: '1.3rem' }}>›</span>
                                </button>
                            ))}
                        </div>
                    </>)}
                </>)}

                {paso === 'AJUSTES' && recurso && (<>
                    <div style={{ background: '#eef4fb', borderRadius: 12, padding: '10px 14px', margin: '10px 0 16px', color: AZUL, fontWeight: 700 }}>📚 {recurso.titulo}</div>

                    {juego.modos && (<>
                        <div style={st.label}>Modo de juego</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                            {juego.modos.map(m => <button key={m.id} onClick={() => setModo(m.id)} style={st.chip(modo === m.id)}>{m.label}</button>)}
                        </div>
                    </>)}

                    {!juego.sinHoja && hojas.length > 0 && (<>
                        <div style={st.label}>Hoja</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                            <button onClick={() => setHoja('General')} style={st.chip(hoja === 'General')}>🔀 Todas</button>
                            {hojas.map(h => <button key={h} onClick={() => setHoja(h)} style={st.chip(hoja === h)}>📄 {h}</button>)}
                        </div>
                    </>)}

                    <button onClick={() => setPaso('ENLACE')} style={{ ...st.btnPrim, width: '100%', padding: '12px' }}>🔗 Crear enlace</button>
                </>)}
                <style>{`@keyframes spinRR{100%{transform:rotate(360deg)}}`}</style>
            </div>
        </div>
    );
}

const st = {
    overlay: { position: 'fixed', inset: 0, zIndex: 9500, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
    panel: { background: 'white', borderRadius: 20, width: '100%', maxWidth: 500, padding: 22, boxShadow: '0 20px 50px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto', fontFamily: "'Segoe UI', sans-serif", boxSizing: 'border-box' },
    volver: { background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: 2, fontWeight: 700, fontSize: '0.85rem', padding: 0, fontFamily: 'inherit' },
    ayuda: { color: '#7f8c8d', fontSize: '0.85rem', margin: '0 0 14px', lineHeight: 1.5 },
    tab: (on) => ({ flex: 1, padding: '8px 6px', borderRadius: 9, border: 'none', background: on ? 'white' : 'transparent', boxShadow: on ? '0 1px 4px rgba(0,0,0,0.12)' : 'none', fontWeight: 700, fontSize: '0.8rem', color: on ? '#2c3e50' : '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontFamily: 'inherit' }),
    input: { padding: '9px 12px', borderRadius: 9, border: '1.5px solid #e2e8f0', fontSize: '0.88rem', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' },
    btnPrim: { padding: '9px 16px', borderRadius: 10, border: 'none', background: AZUL, color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', fontFamily: 'inherit', flexShrink: 0 },
    recurso: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', background: 'white', border: '1.5px solid #e2e8f0', borderRadius: 12, cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: 'inherit' },
    label: { fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 },
    chip: (on) => ({ padding: '7px 13px', borderRadius: 20, border: `1.5px solid ${on ? AZUL : '#cdd6ea'}`, background: on ? AZUL : 'white', color: on ? 'white' : '#334155', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit' }),
};
