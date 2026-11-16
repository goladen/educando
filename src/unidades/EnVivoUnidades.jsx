import React, { lazy, Suspense, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { MAGNITUDES } from './magnitudes.js';
import { NIVELES } from './generadores.js';
import { preguntaCuerda } from './TironUnidades.jsx';

// ─────────────────────────────────────────────────────────────────────────────
//  EN VIVO por código (como Pi Live): el profesor crea una sala con preguntas
//  de cambio de unidades de las magnitudes elegidas y los alumnos responden
//  desde sus dispositivos en pikt.es con el código (o el QR ?live=CÓDIGO).
//  Reutiliza el anfitrión/cliente de ThinkHootGame (sala en live_games con
//  preguntas tipo MULTIPLE: { q, a, tipo, opcionesFijas, tiempo }).
// ─────────────────────────────────────────────────────────────────────────────
const ThinkHootGame = lazy(() => import('../ThinkHootGame'));

const card = { background: 'white', borderRadius: 18, padding: '16px 18px', border: '1px solid #e2e8f0', boxShadow: '0 4px 14px rgba(15,23,42,0.06)' };
const chip = (on, c) => ({ padding: '7px 13px', borderRadius: 999, border: `2px solid ${c}`, background: on ? c : 'white', color: on ? 'white' : c, fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit' });

/** Preguntas de la sala (sin repetir enunciados). */
export function preguntasEnVivo({ mags, nivel, modo, n, tiempo }) {
    const out = [];
    const vistos = new Set();
    for (let i = 0; out.length < n && i < n * 20; i++) {
        const p = preguntaCuerda({ modo, mags, nivel, metodo: 'libre' });
        if (!p || vistos.has(p.ap.e)) continue;
        vistos.add(p.ap.e);
        const q = p.etiqueta ? `${p.ap.e} — Responde: ${p.etiqueta}` : p.ap.e;
        out.push({ q, pregunta: q, a: p.correcta, correcta: p.correcta, tipo: 'MULTIPLE', opcionesFijas: p.opciones, tiempo, solucion: p.ap.s });
    }
    return out;
}

export default function EnVivoUnidades({ magsIniciales, nivelInicial = 2, usuario = null, onSalir }) {
    const [mags, setMags] = useState(magsIniciales);
    const [nivel, setNivel] = useState(nivelInicial);
    const [modo, setModo] = useState('conv');
    const [n, setN] = useState(10);
    const [tiempo, setTiempo] = useState(30);
    const [sala, setSala] = useState(null);
    const [creando, setCreando] = useState(false);
    const alternar = (m) => setMags((x) => (x.includes(m) ? (x.length > 1 ? x.filter((y) => y !== m) : x) : [...x, m]));

    const crear = async () => {
        setCreando(true);
        try {
            const preguntas = preguntasEnVivo({ mags, nivel, modo, n, tiempo });
            if (!preguntas.length) { alert('No hay preguntas con estas opciones.'); setCreando(false); return; }
            const codigo = Math.floor(100000 + Math.random() * 900000).toString();
            const titulo = `Cambio de unidades: ${mags.map((m) => MAGNITUDES[m]?.nombre).join(', ')}`;
            await setDoc(doc(db, 'live_games', codigo), {
                hostId: usuario?.uid || `host_invitado_${Date.now()}`,
                recursoId: 'cambio_unidades',
                recursoTitulo: titulo.length > 90 ? `${titulo.slice(0, 87)}…` : titulo,
                hojaNombre: '',
                profesorNombre: usuario?.displayName || 'Profe',
                config: { tiempoPregunta: tiempo, numPreguntas: preguntas.length, puntosMax: 1000, puntosMin: 500, aleatorio: false },
                preguntas,
                estado: 'LOBBY',
                indicePregunta: 0,
                jugadores: {},
                respuestasRonda: {},
                timestamp: new Date(),
                tipoJuego: 'THINKHOOT',
            });
            setSala(codigo);
        } catch (e) {
            console.error(e);
            alert('No se pudo crear la sala. Comprueba la conexión.');
        }
        setCreando(false);
    };

    if (sala) {
        return (
            <div style={{ position: 'fixed', inset: 0, zIndex: 10020, overflowY: 'auto', background: '#0f172a' }}>
                <Suspense fallback={<div style={{ color: 'white', padding: 40, textAlign: 'center' }}>Cargando sala…</div>}>
                    <ThinkHootGame isHost codigoSala={sala} usuario={usuario || { uid: 'host', displayName: 'Profe' }} onExit={() => { setSala(null); onSalir?.(); }} />
                </Suspense>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 820, margin: '0 auto' }}>
            <div style={{ ...card, borderLeft: '6px solid #9333ea' }}>
                <h3 style={{ margin: '0 0 6px', color: '#9333ea' }}>📱 Partida en vivo por código</h3>
                <p style={{ margin: 0, color: '#334155', fontWeight: 600, lineHeight: 1.5 }}>
                    Se crea una sala con preguntas de cambio de unidades. Los alumnos entran en <b>pikt.es</b> con el código (o escaneando el QR) y responden desde su móvil, tablet u ordenador. Puntúa la rapidez y al final sale el ranking.
                </p>
            </div>
            <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                    <b style={{ color: '#334155' }}>Magnitudes</b>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                        {Object.values(MAGNITUDES).map((m) => <button key={m.id} onClick={() => alternar(m.id)} style={chip(mags.includes(m.id), m.color)}>{m.emoji} {m.nombre}</button>)}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <b style={{ color: '#334155' }}>Nivel:</b>
                    {NIVELES.map(([k, t]) => <button key={k} onClick={() => setNivel(k)} style={chip(nivel === k, '#0891b2')}>{t}</button>)}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <b style={{ color: '#334155' }}>Preguntas:</b>
                    {[['conv', '🔁 Conversiones'], ['problemas', '📝 Problemas'], ['mixto', '🎲 Mezcla']].map(([k, t]) => <button key={k} onClick={() => setModo(k)} style={chip(modo === k, '#7c3aed')}>{t}</button>)}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <b style={{ color: '#334155' }}>Número:</b>
                    {[5, 10, 15, 20].map((k) => <button key={k} onClick={() => setN(k)} style={chip(n === k, '#16a34a')}>{k}</button>)}
                    <b style={{ color: '#334155', marginLeft: 10 }}>Tiempo:</b>
                    {[20, 30, 45, 60, 90].map((k) => <button key={k} onClick={() => setTiempo(k)} style={chip(tiempo === k, '#ea580c')}>{k} s</button>)}
                </div>
                {modo !== 'conv' && <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>Para los problemas conviene dar más tiempo (60-90 s).</p>}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                    <button onClick={crear} disabled={creando} style={{ ...chip(true, '#9333ea'), padding: '12px 22px', fontSize: '1rem' }}>{creando ? 'Creando sala…' : '🔴 Crear sala en vivo'}</button>
                    <button onClick={onSalir} style={{ ...chip(false, '#64748b'), padding: '12px 22px', fontSize: '1rem' }}>← Menú</button>
                </div>
            </div>
        </div>
    );
}
