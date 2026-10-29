import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { limpiar } from '../utils/normalizarPreguntas';
import { hojasDeRecurso, pruebaDeRecurso, MIN_PREGUNTAS_RECURSO, MODOS_CANDADO_RECURSO, codigoLimpio } from './recursosEscape';

/**
 *  Editor de pruebas con recursos de profes:
 *   · BuscadorRecursosEscape: biblioteca pública / mis recursos, con cuántas preguntas aprovechables tiene cada uno.
 *   · CuerpoPruebaRecurso: hojas elegidas, nombre de la sala y vista previa (se carga el recurso al cambiar las hojas).
 */

const cacheRecursos = new Map();   // id → recurso (para no volver a pedirlo)
async function cargarRecurso(id) {
    if (cacheRecursos.has(id)) return cacheRecursos.get(id);
    const s = await getDoc(doc(db, 'resources', id));
    if (!s.exists()) throw new Error('El recurso ya no existe.');
    const r = { id: s.id, ...s.data() };
    cacheRecursos.set(id, r);
    return r;
}

const campo = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '2px solid rgba(255,255,255,.2)', background: 'rgba(0,0,0,.35)', color: '#fff', fontFamily: 'inherit', fontSize: '.95rem', outline: 'none' };

export function BuscadorRecursosEscape({ usuario, onElegir, onCerrar }) {
    const [pestana, setPestana] = useState('PUBLICOS');
    const [lista, setLista] = useState(null);
    const [busqueda, setBusqueda] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        let vivo = true;
        setLista(null); setError('');
        (async () => {
            try {
                const q = pestana === 'MIOS'
                    ? query(collection(db, 'resources'), where('profesorUid', '==', usuario?.uid || '-'))
                    : query(collection(db, 'resources'), where('isPrivate', '==', false));
                const snap = await getDocs(q);
                const datos = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                    .filter(r => r.tipoJuego !== 'ESCAPE_HALLOWEEN')
                    .map(r => { cacheRecursos.set(r.id, r); const hojas = hojasDeRecurso(r); return { r, hojas, n: hojas.reduce((s, h) => s + h.n, 0) }; })
                    .filter(x => x.n >= MIN_PREGUNTAS_RECURSO)
                    .sort((a, b) => (b.r.playCount || 0) - (a.r.playCount || 0));
                if (vivo) setLista(datos);
            } catch (e) { if (vivo) { setError('No se pudo cargar: ' + e.message); setLista([]); } }
        })();
        return () => { vivo = false; };
    }, [pestana, usuario]);

    const q = limpiar(busqueda);
    const filtrados = useMemo(() => (lista || []).filter(({ r, hojas }) => !q
        || limpiar(r.titulo).includes(q) || limpiar(r.temas).includes(q) || limpiar(r.profesorNombre).includes(q)
        || hojas.some(h => limpiar(h.nombre).includes(q))).slice(0, 120), [lista, q]);

    return (
        <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, zIndex: 10050, background: 'rgba(5,0,12,.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
            <div onClick={e => e.stopPropagation()} className="eh-panel" style={{ width: 'min(680px, 100%)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', padding: 18, background: '#1a0b2e' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, flex: 1 }}>📚 Elegir un recurso</h3>
                    <button className={`eh-chip ${pestana === 'PUBLICOS' ? 'on' : ''}`} onClick={() => setPestana('PUBLICOS')}>🌍 De otros profes</button>
                    {usuario?.uid && <button className={`eh-chip ${pestana === 'MIOS' ? 'on' : ''}`} onClick={() => setPestana('MIOS')}>📂 Mis recursos</button>}
                    <button className="eh-btn2" onClick={onCerrar}>✕</button>
                </div>
                <input style={{ ...campo, marginTop: 10 }} value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por título, tema, hoja o autor…" autoFocus />
                <div style={{ fontSize: '.78rem', opacity: .65, margin: '6px 0' }}>Valen las preguntas de opción múltiple, respuesta corta y rellenar hueco (las de ordenar no).</div>
                <div style={{ overflowY: 'auto', display: 'grid', gap: 8, paddingRight: 4 }}>
                    {error && <div style={{ color: '#fca5a5' }}>{error}</div>}
                    {lista === null && <div>🕯️ Cargando recursos…</div>}
                    {lista && filtrados.length === 0 && <div style={{ opacity: .7 }}>No hay recursos compatibles{q ? ' con esa búsqueda' : ''}.</div>}
                    {filtrados.map(({ r, hojas, n }) => (
                        <button key={r.id} onClick={() => onElegir(r)} style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.05)', color: '#f5e9ff', cursor: 'pointer', fontFamily: 'inherit' }}>
                            <div style={{ fontWeight: 800 }}>{r.titulo || 'Sin título'}</div>
                            <div style={{ fontSize: '.78rem', opacity: .75, marginTop: 2 }}>
                                {r.profesorNombre ? `👤 ${r.profesorNombre} · ` : ''}{n} preguntas · {hojas.length} hoja{hojas.length === 1 ? '' : 's'}{r.temas ? ` · ${r.temas}` : ''}
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

/** Cuerpo de la tarjeta de una prueba con recurso. */
export function CuerpoPruebaRecurso({ prueba, onCambiar, onCambiarRecurso }) {
    const [hojas, setHojas] = useState(null);       // hojas del recurso (al cargarlo)
    const [error, setError] = useState('');
    useEffect(() => {
        let vivo = true;
        cargarRecurso(prueba.recursoId).then(r => { if (vivo) setHojas(hojasDeRecurso(r)); }).catch(e => vivo && setError(e.message));
        return () => { vivo = false; };
    }, [prueba.recursoId]);

    const sel = prueba.hojas;   // null = todas
    const alternar = async (nombre) => {
        try {
            const r = await cargarRecurso(prueba.recursoId);
            const todas = hojasDeRecurso(r).map(h => h.nombre);
            const actual = sel || todas;
            let nueva = actual.includes(nombre) ? actual.filter(h => h !== nombre) : [...actual, nombre];
            if (!nueva.length) return;
            if (nueva.length === todas.length) nueva = null;
            onCambiar(pruebaDeRecurso(r, nueva, { ...prueba }));
        } catch (e) { setError(e.message); }
    };
    const n = prueba.preguntas?.length || 0;
    return (
        <>
            <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(34,211,238,.1)', border: '1px solid rgba(34,211,238,.35)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800 }}>📚 {prueba.recursoTitulo}</div>
                        <div style={{ fontSize: '.78rem', opacity: .75 }}>{prueba.autor ? `De ${prueba.autor} · ` : ''}{n} preguntas copiadas en el escape room</div>
                    </div>
                    <button className="eh-btn2" onClick={onCambiarRecurso}>🔁 Cambiar recurso</button>
                </div>
                {error && <div style={{ color: '#fca5a5', fontSize: '.8rem', marginTop: 6 }}>⚠ {error} (se usan las preguntas ya copiadas)</div>}
                {hojas && hojas.length > 1 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                        <span style={{ fontSize: '.8rem', opacity: .8, alignSelf: 'center' }}>Hojas:</span>
                        {hojas.map(h => (
                            <button key={h.nombre} className={`eh-chip ${!sel || sel.includes(h.nombre) ? 'on' : ''}`} style={{ padding: '4px 9px', fontSize: '.78rem' }} onClick={() => alternar(h.nombre)}>
                                {h.nombre} ({h.n})
                            </button>
                        ))}
                    </div>
                )}
                {n > 0 && (
                    <div style={{ marginTop: 8, fontSize: '.8rem', opacity: .8 }}>
                        Ejemplos: {prueba.preguntas.slice(0, 3).map((q, i) => <div key={i}>· {q.texto}{q.detalle ? ` «${q.detalle}»` : ''} → <b>{q.opciones[q.correcta]}</b></div>)}
                    </div>
                )}
                {n < MIN_PREGUNTAS_RECURSO && <div style={{ color: '#fcd34d', fontSize: '.8rem', marginTop: 6 }}>⚠ Hacen falta al menos {MIN_PREGUNTAS_RECURSO} preguntas (elige más hojas).</div>}
            </div>
            <label style={{ fontWeight: 700, fontSize: '.82rem', opacity: .85, display: 'block', margin: '10px 0 4px' }}>Nombre de la sala (opcional)</label>
            <input style={campo} value={prueba.nombre || ''} maxLength={50} placeholder={prueba.recursoTitulo} onChange={e => onCambiar({ ...prueba, nombre: e.target.value })} />
            <ConfigCandadoRecurso prueba={prueba} onCambiar={onCambiar} />
        </>
    );
}

/** Cómo se abre la puerta de una sala con recurso. */
function ConfigCandadoRecurso({ prueba, onCambiar }) {
    const modo = prueba.candadoModo || 'RESPUESTAS';
    const set = (c) => onCambiar({ ...prueba, ...c });
    const cod = codigoLimpio(prueba.candadoCodigo);
    const unidad = /^\d+$/.test(cod) ? 'cifra' : 'letra';
    const pistas = prueba.candadoPistas || [];
    const etiqueta = { fontWeight: 700, fontSize: '.82rem', opacity: .85, display: 'block', margin: '10px 0 4px' };
    return (
        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 12, background: 'rgba(250,204,21,.08)', border: '1px solid rgba(250,204,21,.35)' }}>
            <div style={{ fontWeight: 800 }}>🔒 Candado de esta sala</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {MODOS_CANDADO_RECURSO.map(m => (
                    <button key={m.v} className={`eh-chip ${modo === m.v ? 'on' : ''}`} style={{ padding: '6px 10px', fontSize: '.82rem' }} title={m.d} onClick={() => set({ candadoModo: m.v })}>{m.l}</button>
                ))}
            </div>
            <div style={{ fontSize: '.78rem', opacity: .75, marginTop: 4 }}>{MODOS_CANDADO_RECURSO.find(m => m.v === modo)?.d}</div>

            {modo !== 'RESPUESTAS' && <>
                <label style={etiqueta}>🔐 Código que abre la puerta</label>
                <input style={{ ...campo, letterSpacing: 3, fontWeight: 800, textTransform: 'uppercase' }} value={prueba.candadoCodigo || ''} maxLength={14}
                    placeholder="Ej.: 4721 o MOMIA" onChange={e => set({ candadoCodigo: e.target.value })} />
                <div style={{ fontSize: '.72rem', opacity: .65, marginTop: 3 }}>Máx. 12 cifras o letras. Da igual mayúsculas y tildes.</div>
            </>}

            {modo === 'CIFRAS' && cod && (
                <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                    {[...cod].slice(0, 12).map((ch, k) => (
                        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ minWidth: 92, fontSize: '.8rem', fontWeight: 700 }}>{k + 1}.ª {unidad} <b style={{ color: '#fde047', fontSize: '1rem' }}>{ch}</b></span>
                            <input style={{ ...campo, padding: '8px 10px' }} value={pistas[k] || ''} maxLength={180}
                                placeholder={unidad === 'cifra' ? `Ej.: el número de patas de una araña menos ${Math.max(0, 8 - Number(ch))}` : 'Ej.: la primera letra del animal que aúlla a la luna'}
                                onChange={e => { const nuevas = [...pistas]; nuevas[k] = e.target.value; set({ candadoPistas: nuevas }); }} />
                        </div>
                    ))}
                    <div style={{ fontSize: '.72rem', opacity: .65 }}>En online, cada pista va a un móvil distinto; en la pizarra y en las fichas salen todas.</div>
                </div>
            )}

            {modo === 'PISTA' && <>
                <label style={etiqueta}>💡 Pista o acertijo para todo el candado</label>
                <textarea style={{ ...campo, minHeight: 64, resize: 'vertical' }} value={prueba.candadoPista || ''} maxLength={500}
                    placeholder="Ej.: Soy el año en que Colón llegó a América." onChange={e => set({ candadoPista: e.target.value })} />
            </>}
        </div>
    );
}

export { cargarRecurso, pruebaDeRecurso };
