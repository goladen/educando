import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { Trophy, X } from 'lucide-react';

const norm = (s) => (s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Envío de una puntuación a una prueba concreta de una competición.
 * Se usa cuando el juego se ha abierto desde el enlace de una prueba
 * (?comp=…&cat=…): el resultado NO va a informes_juegos, solo a la competición.
 *
 * El alumno se identifica con su alias y su contraseña (4-8 caracteres). La
 * contraseña no se comprueba aquí (nadie puede leerlas): la validan las reglas
 * de Firestore al crear el documento en competiciones/{id}/resultados.
 */
export default function ModalEnviarCompeticion({ compId, catId, puntos, detalle = null, nombreJuego = '', tituloReto = '', onClose }) {
    const [participantes, setParticipantes] = useState(null);
    const [alias, setAlias]   = useState(() => { try { return localStorage.getItem('pikt_comp_alias') || ''; } catch (_) { return ''; } });
    const [clave, setClave]   = useState('');
    const [estado, setEstado] = useState('form'); // form | enviando | ok
    const [error, setError]   = useState('');

    useEffect(() => {
        getDocs(collection(db, 'competiciones', compId, 'participantes'))
            .then(s => setParticipantes(s.docs.map(d => ({ id: d.id, ...d.data() }))))
            .catch(() => setParticipantes([]));
    }, [compId]);

    const enviar = async () => {
        setError('');
        const a = alias.trim();
        if (!a) { setError('Escribe tu alias.'); return; }
        if (clave.trim().length < 4 || clave.trim().length > 8) { setError('La contraseña tiene entre 4 y 8 caracteres.'); return; }
        const p = (participantes || []).find(x => norm(x.alias) === norm(a) && x.estado !== 'pendiente');
        if (!p) { setError('Ese alias no está inscrito en la competición (o aún no lo han aceptado).'); return; }

        setEstado('enviando');
        try {
            await addDoc(collection(db, 'competiciones', compId, 'resultados'), {
                participanteId: p.id,
                alias: p.alias || a,
                catId,
                puntos: Number(puntos) || 0,
                detalle: detalle || null,
                juego: nombreJuego || null,
                reto: tituloReto || null,
                clave: clave.trim(),
                aplicado: false,
                fecha: serverTimestamp(),
            });
            try { localStorage.setItem('pikt_comp_alias', a); } catch (_) {}
            setEstado('ok');
        } catch (e) {
            setError(String(e.message || '').includes('permission')
                ? 'Alias o contraseña incorrectos.'
                : 'No se pudo enviar: ' + e.message);
            setEstado('form');
        }
    };

    return (
        <div style={st.overlay} onClick={onClose}>
            <div style={st.panel} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f1c40f', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Trophy size={18} /> Enviar a la competición
                    </h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.2rem' }}>✕</button>
                </div>

                {estado === 'ok' ? (
                    <div style={{ textAlign: 'center', padding: '14px 0' }}>
                        <div style={{ fontSize: '3rem' }}>🏆</div>
                        <div style={{ color: '#2ecc71', fontWeight: 700 }}>¡Resultado enviado!</div>
                        <div style={{ color: '#aaa', fontSize: '0.88rem', margin: '8px 0 16px' }}>{puntos} puntos en esta prueba.</div>
                        <button onClick={onClose} style={st.btnPri}>Cerrar</button>
                    </div>
                ) : (
                    <>
                        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 12px', marginBottom: 14 }}>
                            <div style={{ fontSize: '0.8rem', color: '#aaa' }}>{tituloReto || nombreJuego}</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f1c40f' }}>{puntos} puntos</div>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#aaa', marginBottom: 12 }}>
                            Tu puntuación irá <strong style={{ color: '#ddd' }}>solo a esta prueba de la competición</strong>. Identifícate con el alias y la contraseña que pusiste al inscribirte.
                        </div>

                        <div style={st.label}>Alias</div>
                        <input value={alias} onChange={e => setAlias(e.target.value)} placeholder="Tu alias en la competición" style={st.input} />

                        <div style={st.label}>Contraseña (4-8 caracteres)</div>
                        <input type="password" value={clave} maxLength={8} onChange={e => setClave(e.target.value)} placeholder="••••" style={st.input} />

                        {error && <div style={{ color: '#e74c3c', fontSize: '0.82rem', margin: '4px 0 8px' }}>{error}</div>}

                        <div style={{ display: 'flex', gap: 9, marginTop: 6 }}>
                            <button onClick={onClose} style={{ ...st.btnSec, flex: 1 }}>Cancelar</button>
                            <button onClick={enviar} disabled={estado === 'enviando' || participantes === null} style={{ ...st.btnPri, flex: 2 }}>
                                {estado === 'enviando' ? 'Enviando…' : '🏆 Enviar'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

const st = {
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 10050, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 16 },
    panel: { background: '#1e272e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, width: '100%', maxWidth: 380, padding: '24px 26px', color: 'white', fontFamily: "'Segoe UI', sans-serif", boxShadow: '0 30px 80px rgba(0,0,0,0.7)' },
    label: { fontSize: '0.74rem', fontWeight: 700, color: '#95a5a6', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 5 },
    input: { padding: '9px 12px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 12 },
    btnPri: { padding: '10px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#f39c12,#e67e22)', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.92rem' },
    btnSec: { padding: '10px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.92rem' },
};
