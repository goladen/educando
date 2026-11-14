import React, { useEffect, useMemo, useState } from 'react';
import { CompeticionCuerda } from '../components/TironCuerdaEscena';
import { useMandoPregunta, LetraMando } from '../components/MandosCuerda';
import { sonidoCorrecto, sonidoIncorrecto } from '../utils/sonidosFeedback';
import { MAGNITUDES } from './magnitudes.js';
import { barajar, NIVELES } from './generadores.js';
import { generarEjercicio } from './Practica.jsx';

// ─────────────────────────────────────────────────────────────────────────────
//  TIRÓN DE CUERDA del cambio de unidades: dos equipos, 4 opciones (los
//  distractores son los errores típicos: ×10 en vez de ÷10, olvidar el +32…).
//  Se elige qué magnitudes se trabajan, el nivel y si son conversiones o problemas.
//  Con mandos micro:bit vota cada equipo (MandosCuerda).
// ─────────────────────────────────────────────────────────────────────────────

const conUnidad = (t, un) => (un ? `${t}${['°', "'", '"'].includes(un) ? '' : ' '}${un}` : t);

/** Ejercicio con 4 opciones (o null si no tiene suficientes distractores). */
function preguntaCuerda(cfg) {
    for (let i = 0; i < 25; i++) {
        const ap = generarEjercicio(cfg);
        if (!ap) continue;
        // la respuesta que se pregunta: la primera que tenga distractores (o la de opciones)
        const q = ap.r.find((x) => x.tipo !== 'opcion' && x.distractores?.length >= 3 && x.vTxt) || ap.r.find((x) => x.tipo === 'opcion');
        if (!q) continue;
        if (q.tipo === 'opcion') {
            return { ap, etiqueta: q.etiqueta || '', opciones: barajar(q.opciones.slice(0, 4)), correcta: q.v };
        }
        const correcta = conUnidad(q.vTxt, q.unidad);
        const otras = barajar(q.distractores).slice(0, 3).map((d) => conUnidad(d, q.unidad));
        return { ap, etiqueta: ap.r.length > 1 ? q.etiqueta || '' : '', opciones: barajar([correcta, ...otras]), correcta };
    }
    return null;
}

function PanelUnidades({ equipo, aplicar, bloqueado, cfg, isMobile }) {
    const [p, setP] = useState(() => preguntaCuerda(cfg));
    const [estado, setEstado] = useState(null);
    const acento = equipo === 1 ? '#3b82f6' : '#ef4444';
    useEffect(() => { setP(preguntaCuerda(cfg)); setEstado(null); }, [cfg]);

    const responder = (op) => {
        if (estado || bloqueado || !p) return;
        const ok = op === p.correcta;
        (ok ? sonidoCorrecto : sonidoIncorrecto)();
        setEstado(ok ? 'ok' : 'err');
        aplicar(ok);
        setTimeout(() => { setP(preguntaCuerda(cfg)); setEstado(null); }, ok ? 800 : 1700);
    };
    const { conMandos } = useMandoPregunta({
        clave: p?.opciones, n: p?.opciones.length || 0, elegir: (i) => responder(p.opciones[i]),
        activa: !!p && !estado && !bloqueado, correcta: p ? p.opciones.indexOf(p.correcta) : -1,
    });
    if (!p) return <div style={{ padding: 20, textAlign: 'center' }}>No hay ejercicios con estas opciones.</div>;
    const mag = MAGNITUDES[p.ap.mag || p.ap.v?.mag];
    return (
        <div style={{ border: `3px solid ${estado === 'ok' ? '#16a34a' : estado === 'err' ? '#dc2626' : `${acento}66`}`, background: estado === 'ok' ? '#f0fdf4' : estado === 'err' ? '#fef2f2' : 'white', borderRadius: 16, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 10, transition: 'all 0.2s' }}>
            <div style={{ textAlign: 'center', fontWeight: 900, color: acento, fontSize: '0.85rem' }}>
                {equipo === 1 ? '🔵 Equipo 1' : '🔴 Equipo 2'}{mag ? <span style={{ color: mag.color }}> · {mag.emoji} {mag.nombre}</span> : null}
            </div>
            <div style={{ textAlign: p.ap.largo ? 'left' : 'center', fontWeight: 800, color: '#0f172a', fontSize: p.ap.largo ? (isMobile ? '0.9rem' : '1rem') : (isMobile ? '1.35rem' : '1.6rem'), lineHeight: 1.45, minHeight: 50 }}>
                {p.ap.e}
                {p.etiqueta && <div style={{ fontSize: '0.85rem', color: '#7c3aed', marginTop: 4 }}>Responde: {p.etiqueta}</div>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                {p.opciones.map((op, i) => (
                    <button key={op + i} onClick={() => responder(op)} disabled={!!estado || bloqueado}
                        style={{ padding: isMobile ? '10px 4px' : '13px 6px', borderRadius: 12, border: `2px solid ${estado && op === p.correcta ? '#16a34a' : `${acento}55`}`, background: estado && op === p.correcta ? '#dcfce7' : 'white', cursor: (estado || bloqueado) ? 'default' : 'pointer', fontWeight: 900, fontSize: isMobile ? '1rem' : '1.12rem', color: '#0f172a', boxShadow: '0 3px 0 rgba(0,0,0,0.12)', touchAction: 'manipulation', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        {conMandos && <LetraMando i={i} />}{op}
                    </button>
                ))}
            </div>
            {estado === 'ok' && <div style={{ textAlign: 'center', color: '#16a34a', fontWeight: 900 }}>✅ ¡Tirad fuerte!</div>}
            {estado === 'err' && <div style={{ textAlign: 'center', color: '#dc2626', fontWeight: 800, fontSize: '0.88rem' }}>❌ {p.ap.s}</div>}
        </div>
    );
}

const chip = (on, c) => ({ padding: '4px 10px', borderRadius: 20, cursor: 'pointer', fontWeight: 800, fontSize: '0.74rem', border: `2px solid ${c}`, background: on ? c : 'white', color: on ? 'white' : c, fontFamily: 'inherit' });

export default function TironUnidades({ magsIniciales, nivelInicial = 2, onSalir, isMobile }) {
    const [mags, setMags] = useState(magsIniciales);
    const [nivel, setNivel] = useState(nivelInicial);
    const [modo, setModo] = useState('conv');
    const cfg = useMemo(() => ({ modo, mags, nivel, metodo: 'libre' }), [modo, mags, nivel]);
    const alternar = (m) => setMags((x) => (x.includes(m) ? (x.length > 1 ? x.filter((y) => y !== m) : x) : [...x, m]));
    return (
        <CompeticionCuerda metaInicial={5} onSalir={onSalir} isMobile={isMobile} nombre="Cambio de unidades"
            configExtra={(
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                    <div style={{ display: 'flex', gap: 5, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span>Magnitudes:</span>
                        {Object.values(MAGNITUDES).map((m) => <button key={m.id} onClick={() => alternar(m.id)} style={chip(mags.includes(m.id), m.color)}>{m.emoji} {m.nombre}</button>)}
                    </div>
                    <div style={{ display: 'flex', gap: 5, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span>Nivel:</span>
                        {NIVELES.map(([n, t]) => <button key={n} onClick={() => setNivel(n)} style={chip(nivel === n, '#0891b2')}>{t}</button>)}
                        <span style={{ marginLeft: 8 }}>Tipo:</span>
                        {[['conv', '🔁 Conversiones'], ['problemas', '📝 Problemas'], ['mixto', '🎲 Mezcla']].map(([k, t]) => <button key={k} onClick={() => setModo(k)} style={chip(modo === k, '#7c3aed')}>{t}</button>)}
                    </div>
                </div>
            )}
            renderPanel={(equipo, { key, aplicar, bloqueado }) => (
                <PanelUnidades key={`${key}-${modo}-${nivel}-${mags.join('')}`} equipo={equipo} aplicar={aplicar} bloqueado={bloqueado} cfg={cfg} isMobile={isMobile} />
            )}
        />
    );
}
