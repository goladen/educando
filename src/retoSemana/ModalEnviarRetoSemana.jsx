import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { doc, getDoc, collection, query, where, getCountFromServer } from 'firebase/firestore';
import { validarNombre } from '../utils/filtroNombres';
import { guardarRegistroLocal } from '../utils/registrosLocales';
import {
    COL_RETOS, RUTA_RETO_SEMANA, enviarPuntuacionReto, estadoReto, idAlias,
    aliasGuardado, claveGuardada, recordarJugador,
} from './retoSemanaDatos';

/**
 * Envío de la puntuación al «Reto de la semana». Lo abre ModalEnviarCompeticion
 * cuando el juego se lanzó con &comp=semana&cat=<idReto>, así que lo usan sin
 * cambios todos los juegos que ya saben enviar a una competición.
 *
 * Sin login: el jugador elige un alias y una contraseña (4-8) la primera vez.
 * Con ellos puede volver a jugar y mejorar su marca (cuenta la mejor) y, si gana,
 * demostrar que es él al reclamar el premio.
 */
export default function ModalEnviarRetoSemana({ retoId, puntos, detalle = null, nombreJuego = '', tituloReto = '', onClose }) {
    const [reto, setReto] = useState(null);
    const [alias, setAlias] = useState(aliasGuardado);
    const [clave, setClave] = useState(claveGuardada);
    const [recordar, setRecordar] = useState(true);
    const [estado, setEstado] = useState('form'); // form | enviando | ok
    const [error, setError] = useState('');
    const [res, setRes] = useState(null);

    useEffect(() => {
        getDoc(doc(db, COL_RETOS, retoId)).then(s => setReto(s.exists() ? s.data() : false)).catch(() => setReto(false));
    }, [retoId]);

    const cerrado = reto && estadoReto(reto) !== 'activo';
    const pts = Math.max(0, Math.round(Number(puntos) || 0));

    const enviar = async () => {
        setError('');
        const a = alias.trim();
        const v = validarNombre(a);
        if (!v.ok) { setError(v.mensaje === 'Escribe tu nombre.' ? 'Escribe tu alias.' : 'Ese alias no está permitido. Elige otro, por favor.'); return; }
        if (idAlias(a).length < 2) { setError('El alias necesita al menos 2 letras o números.'); return; }
        const c = clave.trim();
        if (c.length < 4 || c.length > 8) { setError('La contraseña tiene entre 4 y 8 caracteres.'); return; }

        setEstado('enviando');
        try {
            const r = await enviarPuntuacionReto(retoId, {
                alias: a, clave: c, puntos: pts, detalle,
                juego: nombreJuego || reto?.herramientaTitulo || null,
                uid: auth.currentUser?.uid || null,
            });
            recordarJugador(a, recordar ? c : '');
            guardarRegistroLocal('RETO_SEMANA', { titulo: reto?.titulo || tituloReto || 'Reto de la semana', aciertos: pts, intentos: 0, porcentaje: 0, nombre: a, via: 'reto semanal' });
            let puesto = null;
            try {
                const n = await getCountFromServer(query(collection(db, COL_RETOS, retoId, 'ranking'), where('mejor', '>', r.mejor)));
                puesto = n.data().count + 1;
            } catch (_) {}
            setRes({ ...r, puesto });
            setEstado('ok');
        } catch (e) {
            const msg = {
                clave: 'Ese alias ya lo usa otra persona o la contraseña no es la tuya. Si es la primera vez que juegas, elige otro alias.',
                descalificado: 'Este alias ha sido retirado del ranking.',
                cerrado: 'Este reto ya no admite puntuaciones.',
                alias: 'El alias necesita al menos 2 letras o números.',
            }[e.code] || ('No se pudo enviar: ' + e.message);
            setError(msg);
            setEstado('form');
        }
    };

    const irRanking = () => { window.location.href = `${RUTA_RETO_SEMANA}?id=${encodeURIComponent(retoId)}`; };

    return (
        <div style={st.overlay} onClick={onClose}>
            <div style={st.panel} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#ff9f43' }}>🔥 Reto de la semana</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.2rem' }}>✕</button>
                </div>

                {reto === false ? (
                    <div style={{ color: '#e74c3c', fontSize: '0.9rem', padding: '10px 0' }}>Este reto ya no existe.</div>
                ) : estado === 'ok' ? (
                    <div style={{ textAlign: 'center', padding: '8px 0' }}>
                        <div style={{ fontSize: '3rem' }}>{res.mejorado ? '🏆' : '💪'}</div>
                        <div style={{ color: '#2ecc71', fontWeight: 800, fontSize: '1.05rem' }}>
                            {res.nuevo ? '¡Ya estás en el ranking!' : res.mejorado ? '¡Nueva mejor marca!' : 'Partida guardada'}
                        </div>
                        <div style={{ color: '#ccc', fontSize: '0.9rem', margin: '10px 0 4px' }}>
                            Esta partida: <b>{pts}</b> · Tu mejor: <b style={{ color: '#f1c40f' }}>{res.mejor}</b>
                        </div>
                        {res.puesto && <div style={{ color: '#ff9f43', fontWeight: 800, fontSize: '1.3rem', margin: '6px 0' }}>Vas {res.puesto}º</div>}
                        <div style={{ color: '#95a5a6', fontSize: '0.8rem', margin: '8px 0 16px' }}>Puedes volver a jugar todas las veces que quieras: cuenta tu mejor puntuación.</div>
                        <div style={{ display: 'flex', gap: 9 }}>
                            <button onClick={onClose} style={{ ...st.btnSec, flex: 1 }}>Cerrar</button>
                            <button onClick={irRanking} style={{ ...st.btnPri, flex: 2 }}>📊 Ver el ranking</button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 12px', marginBottom: 14 }}>
                            <div style={{ fontSize: '0.8rem', color: '#aaa' }}>{reto?.titulo || tituloReto || nombreJuego}</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f1c40f' }}>{pts} puntos</div>
                        </div>

                        {cerrado ? (
                            <div style={{ color: '#e74c3c', fontSize: '0.88rem', marginBottom: 12 }}>
                                {estadoReto(reto) === 'proximo' ? 'Este reto todavía no ha empezado.' : 'Este reto ya ha terminado: no admite más puntuaciones.'}
                            </div>
                        ) : (
                            <div style={{ fontSize: '0.82rem', color: '#aaa', marginBottom: 12, lineHeight: 1.45 }}>
                                Elige un <b style={{ color: '#ddd' }}>alias</b> (no hace falta tu nombre real) y una <b style={{ color: '#ddd' }}>contraseña</b>. Úsalos siempre igual: cuenta tu mejor puntuación y, si ganas, te los pediremos para darte el premio.
                            </div>
                        )}

                        <div style={st.label}>Alias</div>
                        <input value={alias} maxLength={24} onChange={e => setAlias(e.target.value)} placeholder="Ej: PiMaster23" style={st.input} disabled={cerrado} />

                        <div style={st.label}>Contraseña (4-8 caracteres)</div>
                        <input type="password" value={clave} maxLength={8} onChange={e => setClave(e.target.value)} placeholder="••••" style={st.input} disabled={cerrado} />

                        <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.8rem', color: '#aaa', marginBottom: 12, cursor: 'pointer' }}>
                            <input type="checkbox" checked={recordar} onChange={e => setRecordar(e.target.checked)} />
                            Recordar la contraseña en este dispositivo
                        </label>

                        {error && <div style={{ color: '#e74c3c', fontSize: '0.82rem', margin: '4px 0 8px', lineHeight: 1.4 }}>{error}</div>}

                        <div style={{ display: 'flex', gap: 9, marginTop: 6 }}>
                            <button onClick={onClose} style={{ ...st.btnSec, flex: 1 }}>Cancelar</button>
                            <button onClick={enviar} disabled={estado === 'enviando' || reto === null || cerrado} style={{ ...st.btnPri, flex: 2, opacity: cerrado ? 0.5 : 1 }}>
                                {estado === 'enviando' ? 'Enviando…' : '🔥 Enviar puntuación'}
                            </button>
                        </div>
                        <button onClick={irRanking} style={{ background: 'none', border: 'none', color: '#95a5a6', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.8rem', marginTop: 12, width: '100%', fontFamily: 'inherit' }}>Ver el ranking</button>
                    </>
                )}
            </div>
        </div>
    );
}

const st = {
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 10050, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 16 },
    panel: { background: '#1e272e', border: '1px solid rgba(255,159,67,0.35)', borderRadius: 20, width: '100%', maxWidth: 390, padding: '24px 26px', color: 'white', fontFamily: "'Segoe UI', sans-serif", boxShadow: '0 30px 80px rgba(0,0,0,0.7)', boxSizing: 'border-box' },
    label: { fontSize: '0.74rem', fontWeight: 700, color: '#95a5a6', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 5 },
    input: { padding: '9px 12px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 12 },
    btnPri: { padding: '10px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#ff9f43,#ee5a24)', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.92rem' },
    btnSec: { padding: '10px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.92rem' },
};
