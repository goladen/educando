// Antes de empezar un juego con un recurso, avisa si hay preguntas demasiado largas para ese juego
// y deja elegir: jugar sin ellas (recomendado), jugar con todas o volver.
// Si todo cabe (o el juego no tiene perfil), no muestra nada y pasa el recurso tal cual.
import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PERFILES_JUEGO, revisarRecurso, recursoQueCabe } from '../utils/encajeTexto';

function Resolver({ valor, alResolver }) {
    useEffect(() => { alResolver(valor); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return null;
}

/**
 * Para los buscadores que hay dentro de algunos juegos: muestra el aviso (solo si hace falta)
 * y resuelve con el recurso a usar (filtrado o no), o con null si se pulsa «Volver».
 */
export function elegirEncaje(recurso, juego) {
    let rev = null;
    try { rev = revisarRecurso(recurso, juego); } catch { rev = null; }
    if (!rev || !rev.largas.length || typeof document === 'undefined') return Promise.resolve(recurso);
    return new Promise(resolve => {
        const div = document.createElement('div');
        document.body.appendChild(div);
        const root = createRoot(div);
        let hecho = false;
        const fin = (v) => {
            if (hecho) return; hecho = true;
            resolve(v);
            setTimeout(() => { root.unmount(); div.remove(); }, 0);
        };
        root.render(
            <ConAvisoEncaje recurso={recurso} juego={juego} onCancelar={() => fin(null)}>
                {(r) => <Resolver valor={r} alResolver={fin} />}
            </ConAvisoEncaje>
        );
    });
}

export default function ConAvisoEncaje({ recurso, juego, onCancelar, children }) {
    const revision = useMemo(() => {
        if (!recurso || !juego || recurso._encajeDecidido) return null;
        try { return revisarRecurso(recurso, juego); } catch { return null; }
    }, [recurso, juego]);
    const [decision, setDecision] = useState(null); // 'SIN' | 'TODAS'
    const [verLista, setVerLista] = useState(false);

    const hayLargas = !!(revision && revision.largas.length);
    const recursoFinal = useMemo(() => {
        // Mismo objeto entre renders: los juegos tienen efectos que dependen del recurso
        if (!hayLargas || !decision) return recurso;
        if (decision === 'TODAS') return { ...recurso, _encajeDecidido: true };
        try { return { ...recursoQueCabe(recurso, juego), _encajeDecidido: true }; } catch { return recurso; }
    }, [recurso, juego, hayLargas, decision]);

    if (!hayLargas || decision) return children(recursoFinal);

    const perfil = PERFILES_JUEGO[juego];
    const { total, largas } = revision;
    const todas = largas.length >= total;
    const quedan = total - largas.length;

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10050, background: 'rgba(8,12,24,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: 'system-ui, sans-serif' }}>
            <div style={{ background: '#fff', color: '#1e293b', borderRadius: 18, padding: '22px 22px 18px', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
                <div style={{ fontSize: '2rem', lineHeight: 1 }}>{perfil?.icono || '⚠️'}</div>
                <h2 style={{ margin: '8px 0 6px', fontSize: '1.2rem', color: '#b45309' }}>
                    Algunos textos son largos para {perfil?.nombre || 'este juego'}
                </h2>
                <p style={{ margin: '0 0 12px', fontSize: '0.95rem', lineHeight: 1.45, color: '#475569' }}>
                    {todas
                        ? <>Ninguna de las <b>{total}</b> preguntas cabe bien en este juego: las preguntas o las respuestas son demasiado largas para este formato y puede que no se lean enteras. Prueba con otro juego (Money Board o Luz roja suelen ir mejor con textos largos).</>
                        : <><b>{largas.length}</b> de {total} preguntas tienen la pregunta o alguna respuesta demasiado larga para este formato y puede que no se lean enteras.</>}
                </p>

                <button onClick={() => setVerLista(v => !v)}
                    style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: 0, fontSize: '0.88rem', fontWeight: 600, marginBottom: 8 }}>
                    {verLista ? '▾ Ocultar' : '▸ Ver'} las preguntas largas
                </button>
                {verLista && (
                    <ul style={{ margin: '0 0 12px', padding: '8px 10px 8px 26px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, maxHeight: 200, overflowY: 'auto', fontSize: '0.82rem', lineHeight: 1.4 }}>
                        {largas.slice(0, 60).map((l, i) => (
                            <li key={i} style={{ marginBottom: 6 }}>
                                <span style={{ color: '#64748b' }}>{l.hoja} · n.º {l.indice + 1}:</span> {l.texto.length > 90 ? l.texto.slice(0, 88) + '…' : l.texto}
                                <div style={{ color: '#b45309' }}>{l.problemas.join(' · ')}</div>
                            </li>
                        ))}
                        {largas.length > 60 && <li>… y {largas.length - 60} más</li>}
                    </ul>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                    {!todas && (
                        <button onClick={() => setDecision('SIN')}
                            style={{ padding: '12px 14px', borderRadius: 12, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 800, fontSize: '1rem', cursor: 'pointer' }}>
                            ✅ Jugar sin esas preguntas ({quedan})
                        </button>
                    )}
                    <button onClick={() => setDecision('TODAS')}
                        style={{ padding: '11px 14px', borderRadius: 12, border: '2px solid #cbd5e1', background: todas ? '#f59e0b' : '#fff', color: todas ? '#fff' : '#334155', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}>
                        {todas ? 'Jugar de todas formas' : `Jugar con todas (${total})`}
                    </button>
                    {onCancelar && (
                        <button onClick={onCancelar}
                            style={{ padding: '9px 14px', borderRadius: 12, border: 'none', background: 'transparent', color: '#64748b', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}>
                            ← Volver
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
