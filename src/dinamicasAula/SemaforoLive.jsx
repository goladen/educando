// «Luz roja, luz verde» con los móviles de los alumnos (sala en live_games, tipoJuego DINAMICA_SEMAFORO).
// - El proyector (host) crea la sala, marca la luz para todos y corrige solo las respuestas.
// - Cada alumno entra por QR (/?live=CODIGO), elige su equipo y responde SOLO con luz verde.
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../firebase';
import { doc, setDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { respuestaCorrecta, CREDITO } from './dinamicas';
import { nombreSeguro } from '../utils/filtroNombres';
import QRSalaBoton, { urlSalaEnVivo } from '../components/QRSalaBoton';
import * as S from './sonidos';

export const TIPO_SALA = 'DINAMICA_SEMAFORO';
const FUENTE = "'Fredoka', 'Nunito', 'Segoe UI', system-ui, sans-serif";

const codigoNuevo = () => {
    const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 5 }, () => letras[Math.floor(Math.random() * letras.length)]).join('');
};

// ─────────────────────────── Host (proyector) ───────────────────────────
export function useSalaSemaforo({ equipos, casillas }) {
    const [codigo, setCodigo] = useState(null);
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState('');
    const unsub = useRef(null);
    const codigoRef = useRef(null);

    const abrir = async () => {
        setError('');
        const c = codigoNuevo();
        try {
            await setDoc(doc(db, 'live_games', c), {
                codigo: c, tipoJuego: TIPO_SALA, estado: 'jugando', createdAt: serverTimestamp(),
                equipos: equipos.map(e => ({ nombre: e.nombre, emoji: e.emoji, color: e.color })),
                casillas, luz: 'espera', ronda: 0, reto: null, pos: equipos.map(() => 0), resultado: null, ganadores: [], jugadores: {},
            });
            codigoRef.current = c; setCodigo(c);
            unsub.current = onSnapshot(doc(db, 'live_games', c), s => setDatos(s.data() || null));
        } catch (e) { console.error('Sala semáforo:', e); setError('No se pudo crear la sala. ¿Hay conexión a Internet?'); }
    };

    const publicar = (campos) => {
        if (!codigoRef.current) return;
        updateDoc(doc(db, 'live_games', codigoRef.current), campos).catch(e => console.error('Sala semáforo:', e));
    };

    const cerrar = () => {
        if (unsub.current) { unsub.current(); unsub.current = null; }
        if (codigoRef.current) publicar({ estado: 'fin', luz: 'fin' });
        codigoRef.current = null; setCodigo(null); setDatos(null);
    };

    useEffect(() => () => {
        if (unsub.current) unsub.current();
        if (codigoRef.current) updateDoc(doc(db, 'live_games', codigoRef.current), { estado: 'fin', luz: 'fin' }).catch(() => {});
    }, []);

    const jugadores = useMemo(() => Object.entries(datos?.jugadores || {}).map(([id, j]) => ({ id, ...j })), [datos]);
    return { codigo, datos, jugadores, error, abrir, publicar, cerrar };
}

/** Respuestas de la ronda por equipo y corrección automática (mayoría de los que han respondido). */
export function corregirRonda(jugadores, ronda, solucion, nEquipos) {
    const porEquipo = Array.from({ length: nEquipos }, () => ({ miembros: 0, respuestas: 0, bien: 0, lista: [] }));
    jugadores.forEach(j => {
        const g = porEquipo[j.equipo]; if (!g) return;
        g.miembros += 1;
        const r = j.resp;
        if (r && r.ronda === ronda && r.luz === 'verde') {
            const ok = solucion ? respuestaCorrecta(r.texto, solucion) : null;
            g.respuestas += 1; if (ok) g.bien += 1;
            g.lista.push({ nombre: j.nombre, texto: r.texto, ok });
        }
    });
    const auto = {};
    porEquipo.forEach((g, i) => {
        if (!solucion || !g.miembros) return;
        auto[i] = g.respuestas > 0 && g.bien * 2 >= g.respuestas;
    });
    return { porEquipo, auto };
}

/** Panel del proyector: QR, código y alumnos conectados por equipo. */
export function PanelSalaHost({ sala, equipos, compacto }) {
    const porEquipo = equipos.map((_, i) => sala.jugadores.filter(j => j.equipo === i));
    const sinEquipo = sala.jugadores.length - porEquipo.flat().length;
    return (
        <div style={{ background: 'rgba(255,255,255,0.14)', borderRadius: 22, padding: 14, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', width: '100%', boxSizing: 'border-box' }}>
            {!compacto && (
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=6&data=${encodeURIComponent(urlSalaEnVivo(sala.codigo))}`} alt="QR de la sala"
                    style={{ width: 150, height: 150, borderRadius: 14, background: 'white' }} />
            )}
            <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, opacity: 0.85 }}>📱 Entrad en pikt.es con el código</div>
                <div style={{ fontSize: compacto ? '1.8rem' : '2.8rem', fontWeight: 900, letterSpacing: 6, lineHeight: 1.1 }}>{sala.codigo}</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{sala.jugadores.length} conectados</div>
                <QRSalaBoton codigo={sala.codigo} texto="QR grande" style={{ marginTop: 6 }} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: '1 1 300px', justifyContent: 'center' }}>
                {equipos.map((e, i) => (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.92)', color: '#1f2937', borderRadius: 14, padding: '6px 10px', borderTop: `5px solid ${e.color}`, minWidth: 110, maxWidth: 220 }}>
                        <div style={{ fontWeight: 800 }}>{e.emoji} {e.nombre} · {porEquipo[i].length}</div>
                        {!compacto && <div style={{ fontSize: '0.78rem', color: '#4b5563' }}>{porEquipo[i].map(j => j.nombre).join(', ') || '—'}</div>}
                    </div>
                ))}
                {sinEquipo > 0 && <div style={{ fontSize: '0.8rem', opacity: 0.85, alignSelf: 'center' }}>{sinEquipo} eligiendo equipo…</div>}
            </div>
        </div>
    );
}

// ─────────────────────────── Alumno (móvil) ───────────────────────────
const idAlumno = (codigo) => {
    const k = `da_live_${codigo}`;
    try {
        let id = sessionStorage.getItem(k);
        if (!id) { id = `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`; sessionStorage.setItem(k, id); }
        return id;
    } catch { return `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`; }
};

const FONDOS = { espera: 'linear-gradient(160deg, #f59e0b, #b45309)', verde: 'linear-gradient(160deg, #22c55e, #15803d)', roja: 'linear-gradient(160deg, #ef4444, #991b1b)', fin: 'linear-gradient(160deg, #8b5cf6, #4c1d95)' };
const botonA = (bg, extra = {}) => ({ background: bg, color: 'white', border: 'none', borderRadius: 16, padding: '14px 20px', fontWeight: 800, fontSize: '1.15rem', fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 4px 0 rgba(0,0,0,0.25)', ...extra });

export default function SemaforoAlumno({ codigoSala, usuario, onExit }) {
    const codigo = String(codigoSala || '').toUpperCase().trim();
    const id = useMemo(() => idAlumno(codigo), [codigo]);
    const nombre = nombreSeguro(usuario?.displayName, 'Alumno/a').slice(0, 30);
    const [sala, setSala] = useState(undefined);
    const [texto, setTexto] = useState('');
    const [enviando, setEnviando] = useState(false);
    const luzPrevia = useRef(null);

    useEffect(() => {
        const ref = doc(db, 'live_games', codigo);
        const u = onSnapshot(ref, s => setSala(s.exists() ? s.data() : null), () => setSala(null));
        return () => u();
    }, [codigo]);

    // Fuente y avisos al cambiar la luz
    useEffect(() => {
        if (!document.getElementById('da-fredoka')) {
            const l = document.createElement('link'); l.id = 'da-fredoka'; l.rel = 'stylesheet';
            l.href = 'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap';
            document.head.appendChild(l);
        }
    }, []);
    const luz = sala?.luz;
    const ronda = sala?.ronda;
    useEffect(() => {
        if (!luz || luzPrevia.current === luz) return;
        if (luzPrevia.current) {
            if (luz === 'verde') { S.inicio(); setTexto(''); try { navigator.vibrate?.(120); } catch { /* */ } }
            if (luz === 'roja') { S.alarma(); try { navigator.vibrate?.([200, 80, 200]); } catch { /* */ } }
        }
        luzPrevia.current = luz;
    }, [luz]);

    const yo = sala?.jugadores?.[id];
    const equipos = sala?.equipos || [];
    const miEquipo = yo && equipos[yo.equipo];

    const elegirEquipo = (i) => {
        S.despertar();
        updateDoc(doc(db, 'live_games', codigo), { [`jugadores.${id}`]: { nombre, equipo: i } }).catch(e => console.error(e));
    };
    const enviar = async () => {
        const t = texto.trim();
        if (!t || luz !== 'verde') return;
        setEnviando(true);
        try { await updateDoc(doc(db, 'live_games', codigo), { [`jugadores.${id}.resp`]: { ronda, texto: t.slice(0, 200), luz: 'verde' } }); S.pitido(); } catch (e) { console.error(e); }
        setEnviando(false);
    };

    const contenedor = (fondo, hijos) => (
        <div style={{ position: 'fixed', inset: 0, zIndex: 12000, overflowY: 'auto', background: fondo, color: 'white', fontFamily: FUENTE, display: 'flex', flexDirection: 'column', transition: 'background 0.3s' }}>
            <style>{'@keyframes da-pop { 0% { transform: scale(0.6); opacity: 0; } 70% { transform: scale(1.06); } 100% { transform: scale(1); opacity: 1; } } .da-pop { animation: da-pop 0.4s ease-out both; }'}</style>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px' }}>
                <button onClick={onExit} style={{ ...botonA('rgba(0,0,0,0.25)'), padding: '8px 12px', fontSize: '0.9rem', boxShadow: 'none' }}>← Salir</button>
                <div style={{ flex: 1, fontWeight: 800 }}>🚦 Luz roja, luz verde</div>
                {miEquipo && <div style={{ background: miEquipo.color, borderRadius: 999, padding: '4px 12px', fontWeight: 800, border: '2px solid white' }}>{miEquipo.emoji} {miEquipo.nombre}</div>}
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '10px 18px 30px', textAlign: 'center', maxWidth: 560, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
                {hijos}
            </div>
            <div style={{ textAlign: 'center', fontSize: '0.75rem', opacity: 0.8, paddingBottom: 10 }}>PiKT · {CREDITO}</div>
        </div>
    );

    if (sala === undefined) return contenedor(FONDOS.espera, <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>Conectando con la sala {codigo}…</div>);
    if (sala === null || sala.tipoJuego !== TIPO_SALA) return contenedor(FONDOS.fin, <><div style={{ fontSize: '3rem' }}>😕</div><div style={{ fontSize: '1.3rem', fontWeight: 700 }}>No encuentro la sala {codigo}.</div><button onClick={onExit} style={botonA('rgba(0,0,0,0.3)')}>Volver</button></>);

    // 1) Elegir equipo
    if (!yo) {
        return contenedor(FONDOS.fin, (
            <>
                <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>¡Hola, {nombre}! 👋</div>
                <div style={{ fontSize: '1.05rem' }}>¿En qué equipo estás?</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, width: '100%' }}>
                    {equipos.map((e, i) => <button key={i} onClick={() => elegirEquipo(i)} style={botonA(e.color, { border: '3px solid white', fontSize: '1.1rem' })}>{e.emoji}<br />{e.nombre}</button>)}
                </div>
            </>
        ));
    }

    const pos = sala.pos || [];
    const pista = miEquipo && (
        <div style={{ width: '100%', background: 'rgba(0,0,0,0.2)', borderRadius: 16, padding: 10, boxSizing: 'border-box' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 6 }}>Vuestra carrera: casilla {Math.min(pos[yo.equipo] || 0, sala.casillas)} de {sala.casillas} 🏁</div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${sala.casillas + 1}, 1fr)`, gap: 3 }}>
                {Array.from({ length: sala.casillas + 1 }, (_, k) => (
                    <div key={k} style={{ height: 22, borderRadius: 6, background: k <= (pos[yo.equipo] || 0) ? miEquipo.color : 'rgba(255,255,255,0.3)', border: k === sala.casillas ? '2px dashed white' : 'none' }} />
                ))}
            </div>
        </div>
    );

    // 2) Fin
    if (luz === 'fin' || sala.estado === 'fin') {
        const ganan = (sala.ganadores || []).map(i => equipos[i]).filter(Boolean);
        const ganoYo = (sala.ganadores || []).includes(yo.equipo);
        return contenedor(FONDOS.fin, (
            <>
                <div style={{ fontSize: '4rem' }}>{ganoYo ? '🏆' : '🏁'}</div>
                <div style={{ fontSize: '1.7rem', fontWeight: 800 }}>{ganan.length ? (ganoYo ? '¡Vuestro equipo ha ganado!' : `Ganan ${ganan.map(e => `${e.emoji} ${e.nombre}`).join(' y ')}`) : 'La partida ha terminado'}</div>
                {pista}
                <button onClick={onExit} style={botonA('rgba(0,0,0,0.3)')}>Salir</button>
            </>
        ));
    }

    const miResp = yo.resp && yo.resp.ronda === ronda ? yo.resp.texto : null;
    const resultado = sala.resultado && sala.resultado.ronda === ronda - 1 ? sala.resultado.marca?.[yo.equipo] : undefined;

    // 3) Luz verde: responder
    if (luz === 'verde') {
        return contenedor(FONDOS.verde, (
            <>
                <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>🟢 ¡LUZ VERDE! Responde</div>
                <div style={{ background: 'white', color: '#1f2937', borderRadius: 20, padding: '16px 18px', fontSize: 'clamp(1.2rem, 5vw, 1.7rem)', fontWeight: 800, width: '100%', boxSizing: 'border-box' }}>{sala.reto}</div>
                <input value={texto} onChange={e => setTexto(e.target.value)} onKeyDown={e => e.key === 'Enter' && enviar()} autoFocus maxLength={200} placeholder="Tu respuesta…"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '14px 16px', borderRadius: 16, border: 'none', fontSize: '1.3rem', fontFamily: 'inherit', textAlign: 'center' }} />
                <button onClick={enviar} disabled={enviando || !texto.trim()} style={botonA('#1e3a8a', { width: '100%', opacity: texto.trim() ? 1 : 0.6 })}>{miResp ? '🔁 Cambiar respuesta' : '📨 Enviar'}</button>
                {miResp && <div style={{ fontWeight: 700 }}>✔ Enviada: «{miResp}». Puedes cambiarla hasta la luz roja.</div>}
                {pista}
            </>
        ));
    }

    // 4) Luz roja: quietos
    if (luz === 'roja') {
        return contenedor(FONDOS.roja, (
            <>
                <div style={{ fontSize: '5rem', lineHeight: 1 }}>✋</div>
                <div style={{ fontSize: '2rem', fontWeight: 900 }}>¡LUZ ROJA! ¡Quietos!</div>
                <div style={{ fontSize: '1.1rem' }}>{miResp ? <>Tu respuesta: <b>«{miResp}»</b></> : 'No has enviado respuesta a tiempo 😬'}</div>
                <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 16, padding: '10px 14px', fontWeight: 700 }}>{sala.reto}</div>
                <div style={{ opacity: 0.9 }}>Mira la pizarra: el profe está corrigiendo…</div>
                {pista}
            </>
        ));
    }

    // 5) Espera (entre rondas)
    return contenedor(FONDOS.espera, (
        <>
            {resultado !== undefined && (
                <div className="da-pop" style={{ background: resultado ? '#16a34a' : '#991b1b', borderRadius: 20, padding: '14px 18px', fontSize: '1.4rem', fontWeight: 900, border: '3px solid white' }}>
                    {resultado ? '✔ ¡Bien! Vuestro equipo avanza' : '✘ Esta vez no… ¡a por la siguiente!'}
                </div>
            )}
            <div style={{ fontSize: '4rem', lineHeight: 1 }}>🚦</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>Prepárate…</div>
            <div style={{ fontSize: '1.05rem' }}>Cuando se encienda la <b>luz verde</b> aparecerá el reto aquí. ¡Con luz roja no se puede responder!</div>
            {pista}
        </>
    ));
}
