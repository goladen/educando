// Buscador de recursos (Mis recursos / Públicos / código) del centro de PDF.
// Lo usan «🎮 Mis preguntas en papel» (CentroPdf.jsx) y la ficha mezclada (FichaMix.jsx).
import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { formatosDisponibles } from '../utils/pdfRecurso';
import { PLANTILLAS_PIKT } from '../etiquetame/plantillasPikt';

export const ETIQUETA_JUEGO = {
    PASAPALABRA: '🔤 Pasapalabra', CAZABURBUJAS: '🫧 Burbujas', PIKATRON: '🏃 Pikatron', PIKATRON_2: '🏃 Pikatron 2', APAREJADOS: '🃏 AparejaDOS',
    RULETA: '🎡 Ruleta', WORDLE: '🟩 Wordle', SOPA: '🔎 Sopa de letras', THINKHOOT: '⚡ PiLive', LINEA_TIEMPO: '🕰️ Línea del tiempo',
    ETIQUETAS: '🏷️ EtiquetaMe', LISTENING_RECURSO: '🎧 Listening', MONEYBOARD: '💰 Money Board', JEOPARDY: '💰 Money Board',
};

export const sinTildes = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// ¿Se puede pasar a papel? (el listening tiene su propia ficha)
export const tieneOpciones = (r) => !!r && (r.tipoJuego === 'LISTENING_RECURSO' || formatosDisponibles(r).length > 0);

// onElegir(recurso) · filtro(recurso) → si se lista · textoBoton: lo que pone cada tarjeta
// pestanaInicial: 'MIOS' | 'PUBLICOS' | 'PIKT' (diagramas de EtiquetaMe hechos por PiKT) | 'CODIGO'
export default function SelectorRecursoPdf({ onElegir, filtro = tieneOpciones, textoBoton = 'Pasar a papel ›', pestanaInicial = null }) {
    const uid = auth.currentUser?.uid || null;
    const [pestana, setPestana] = useState(pestanaInicial || (uid ? 'MIOS' : 'PUBLICOS'));
    const [listas, setListas] = useState({ MIOS: null, PUBLICOS: null, PIKT: PLANTILLAS_PIKT.filter(filtro) });
    const [error, setError] = useState('');
    const [texto, setTexto] = useState('');
    const [codigo, setCodigo] = useState('');
    const [buscandoCodigo, setBuscandoCodigo] = useState(false);

    useEffect(() => {
        if (pestana === 'CODIGO' || listas[pestana] !== null) return undefined;
        let vivo = true;
        const q = pestana === 'MIOS'
            ? query(collection(db, 'resources'), where('profesorUid', '==', uid))
            : query(collection(db, 'resources'), where('isPrivate', '==', false));
        getDocs(q)
            .then((snap) => {
                if (!vivo) return;
                const docs = snap.docs.map((d) => ({ ...d.data(), id: d.id })).filter(filtro);
                if (pestana === 'PUBLICOS') docs.sort((a, b) => (b.playCount || 0) - (a.playCount || 0));
                setListas((p) => ({ ...p, [pestana]: docs }));
            })
            .catch((e) => { if (vivo) setError('No se han podido cargar los recursos: ' + e.message); });
        return () => { vivo = false; };
    }, [pestana, listas, uid, filtro]);

    const lista = useMemo(() => {
        const t = sinTildes(texto.trim());
        const base = listas[pestana] || [];
        return (t ? base.filter((r) => sinTildes(`${r.titulo} ${r.profesorNombre || ''} ${ETIQUETA_JUEGO[r.tipoJuego] || r.tipoJuego}`).includes(t)) : base).slice(0, 120);
    }, [listas, pestana, texto]);

    const buscarCodigo = async () => {
        const c = codigo.trim().toUpperCase();
        if (!c) return;
        setBuscandoCodigo(true); setError('');
        try {
            const snap = await getDocs(query(collection(db, 'resources'), where('accessCode', '==', c)));
            const r = snap.docs.map((d) => ({ ...d.data(), id: d.id }))[0];
            if (!r) setError('No hay ningún recurso con ese código.');
            else if (!filtro(r)) setError('Ese recurso no tiene preguntas que se puedan pasar a papel.');
            else onElegir(r);
        } catch (e) { setError('No se ha podido buscar: ' + e.message); }
        setBuscandoCodigo(false);
    };

    const pestanas = [uid && ['MIOS', '👤 Mis recursos'], ['PUBLICOS', '🌍 Públicos'], PLANTILLAS_PIKT.some(filtro) && ['PIKT', '📚 Diagramas PiKT'], ['CODIGO', '🔑 Tengo un código']].filter(Boolean);
    return (
        <div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 12 }}>
                {pestanas.map(([k, l]) => (
                    <button key={k} onClick={() => { setPestana(k); setError(''); }}
                        style={{ ...S.pestana, ...(pestana === k ? { background: '#0e7490', color: 'white', borderColor: '#0e7490' } : {}) }}>{l}</button>
                ))}
            </div>
            {!uid && <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.85rem', marginBottom: 10 }}>Inicia sesión para ver también tus propios recursos.</div>}

            {pestana === 'CODIGO' ? (
                <div style={{ ...S.tarjeta, maxWidth: 460, margin: '0 auto', textAlign: 'center' }}>
                    <div style={{ fontWeight: 800, color: '#0f172a' }}>Escribe el código del recurso</div>
                    <div style={{ color: '#64748b', fontSize: '0.85rem' }}>Es el código de acceso que aparece en la tarjeta del recurso.</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && buscarCodigo()} placeholder="Ej.: AB12CD"
                            style={{ flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 10, border: '2px solid #cbd5e1', fontSize: '1.1rem', fontWeight: 800, letterSpacing: 2, textAlign: 'center', fontFamily: 'inherit' }} />
                        <button onClick={buscarCodigo} disabled={buscandoCodigo || !codigo.trim()} style={{ ...S.btn, background: '#0e7490', width: 'auto', padding: '10px 16px' }}>{buscandoCodigo ? '…' : 'Buscar'}</button>
                    </div>
                </div>
            ) : (
                <>
                    <div style={S.buscador}>
                        <span>🔎</span>
                        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar por título, juego o profesor…"
                            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', fontSize: '0.98rem', background: 'transparent', fontFamily: 'inherit' }} />
                    </div>
                    {listas[pestana] === null && !error && <div style={{ textAlign: 'center', color: '#6D28D9', fontWeight: 800, padding: 30 }}>Cargando recursos…</div>}
                    {listas[pestana] && lista.length === 0 && (
                        <div style={{ textAlign: 'center', color: '#64748b', margin: 24 }}>
                            {pestana === 'MIOS' ? 'Todavía no tienes recursos con preguntas. Créalos en tu panel de profesor o usa uno público.' : 'No hay recursos con esa búsqueda.'}
                        </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 250px), 1fr))', gap: 10 }}>
                        {lista.map((r) => (
                            <button key={r.id} onClick={() => onElegir(r)} style={{ ...S.tarjeta, cursor: 'pointer', textAlign: 'left', border: '2px solid #e2e8f0', fontFamily: 'inherit' }}>
                                {r.esPlantillaPikt && r.hojas?.[0]?.imageUrl && <img src={r.hojas[0].imageUrl} alt="" style={{ width: '100%', height: 110, objectFit: 'contain', background: '#f8fafc', borderRadius: 8 }} />}
                                <span style={{ fontWeight: 900, color: '#0f172a' }}>{r.emoji ? `${r.emoji} ` : ''}{r.titulo || 'Sin título'}</span>
                                <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                    <span style={{ ...S.chip, background: '#cffafe', color: '#155e75' }}>{ETIQUETA_JUEGO[r.tipoJuego] || r.tipoJuego || 'Recurso'}</span>
                                    {pestana === 'PUBLICOS' && r.profesorNombre && <span style={S.chip}>👤 {r.profesorNombre}</span>}
                                    {r.nivel && <span style={S.chip}>🎓 {r.nivel}</span>}
                                </span>
                                <span style={{ color: '#0e7490', fontWeight: 800, fontSize: '0.85rem' }}>{textoBoton}</span>
                            </button>
                        ))}
                    </div>
                </>
            )}
            {error && <div style={{ color: '#b91c1c', fontWeight: 700, textAlign: 'center', margin: 14 }}>{error}</div>}
        </div>
    );
}

const S = {
    buscador: { display: 'flex', alignItems: 'center', gap: 8, background: 'white', borderRadius: 16, padding: '10px 14px', boxShadow: '0 3px 12px rgba(0,0,0,0.07)', border: '2px solid #ddd6fe', marginBottom: 16 },
    tarjeta: { display: 'flex', flexDirection: 'column', gap: 8, background: 'white', borderRadius: 14, padding: '14px 14px', boxShadow: '0 2px 10px rgba(0,0,0,0.07)', boxSizing: 'border-box' },
    chip: { fontSize: '0.72rem', padding: '2px 8px', borderRadius: 8, background: '#f1f5f9', color: '#475569', fontWeight: 700 },
    btn: { width: '100%', padding: '10px 12px', borderRadius: 12, border: 'none', color: 'white', fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.92rem' },
    pestana: { padding: '8px 14px', borderRadius: 20, border: '2px solid #cbd5e1', background: 'white', color: '#1e293b', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.88rem' },
};
