import React, { useEffect, useState } from 'react';
import { MAGNITUDES, MAGNITUDES_CONTEXTO } from './magnitudes.js';
import { METODOS, NIVELES } from './generadores.js';
import { MAG_PROBLEMAS } from './problemasUnidades.js';
import ConversorVisual from './ConversorVisual.jsx';
import Practica from './Practica.jsx';
import TironUnidades from './TironUnidades.jsx';
import BotonFichas from '../components/BotonFichas';

// ─────────────────────────────────────────────────────────────────────────────
//  🔁 CAMBIO DE UNIDADES
//  Se abre desde Física y Química (/fisica/unidades), Geometrix y Primaria ›
//  Geometría (/primaria/geometria/unidades). `contexto` elige las magnitudes
//  y el nivel con los que arranca: 'fisica' | 'geometria' | 'primaria'.
//  · Aprende: escaleras, factores de conversión, termómetros, radianes…
//  · Practica: conversiones por saltos, con factores o libres
//  · Formas complejas · Problemas (pasar todo a la misma unidad)
//  · Tirón de cuerda · Invasión Pi (/invasores?mates=unidades&tipos=…)
//  · Fichas PDF (tema «unidades» de las fichas de Math World)
// ─────────────────────────────────────────────────────────────────────────────

const COLOR = '#0891b2';
const LS = 'pikt_unidades_cfg';
const leerCfg = () => { try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch { return null; } };

const chip = (on, c) => ({ padding: '7px 13px', borderRadius: 999, border: `2px solid ${c}`, background: on ? c : 'white', color: on ? 'white' : c, fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit' });

function Tarjeta({ emoji, titulo, texto, color, onClick }) {
    return (
        <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 16px', borderRadius: 18, border: `2px solid ${color}`, background: 'white', cursor: 'pointer', textAlign: 'left', boxShadow: '0 5px 16px rgba(15,23,42,0.07)', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}>
            <span style={{ fontSize: '2.2rem', background: `${color}18`, borderRadius: 14, width: 58, height: 58, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{emoji}</span>
            <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontWeight: 900, color, fontSize: '1.05rem' }}>{titulo}</span>
                <span style={{ display: 'block', color: '#64748b', fontSize: '0.85rem', fontWeight: 600, marginTop: 2 }}>{texto}</span>
            </span>
        </button>
    );
}

export default function CambioUnidades({ onExit, contexto = 'fisica', vistaInicial = 'menu' }) {
    const previo = leerCfg();
    const nivelCtx = contexto === 'primaria' ? 1 : contexto === 'geometria' ? 1 : 2;
    const [vista, setVista] = useState(vistaInicial);
    const [nivel, setNivel] = useState(previo?.[contexto]?.nivel || nivelCtx);
    const [mags, setMags] = useState(() => (previo?.[contexto]?.mags?.filter((m) => MAGNITUDES[m]).length ? previo[contexto].mags.filter((m) => MAGNITUDES[m]) : (MAGNITUDES_CONTEXTO[contexto] || MAGNITUDES_CONTEXTO.fisica).slice(0, contexto === 'fisica' ? 6 : 4)));
    const [metodo, setMetodo] = useState(previo?.[contexto]?.metodo || (contexto === 'primaria' ? 'saltos' : 'libre'));
    const [n, setN] = useState(10);
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth <= 700);

    useEffect(() => {
        const r = () => setIsMobile(window.innerWidth <= 700);
        window.addEventListener('resize', r);
        return () => window.removeEventListener('resize', r);
    }, []);
    useEffect(() => {
        try { localStorage.setItem(LS, JSON.stringify({ ...(leerCfg() || {}), [contexto]: { nivel, mags, metodo } })); } catch { /* sin localStorage */ }
    }, [contexto, nivel, mags, metodo]);

    const alternar = (m) => setMags((x) => (x.includes(m) ? (x.length > 1 ? x.filter((y) => y !== m) : x) : [...x, m]));
    const ordenMags = [...new Set([...(MAGNITUDES_CONTEXTO[contexto] || []), ...Object.keys(MAGNITUDES)])];
    const magsProblemas = mags.filter((m) => MAG_PROBLEMAS.includes(m));

    const abrirInvasores = () => {
        const url = `/invasores?mates=unidades&nivel=${nivel}&tipos=${mags.join(',')}`;
        window.location.assign(url);
    };

    const fondo = { minHeight: '100vh', background: 'linear-gradient(180deg,#ecfeff 0%,#f8fafc 260px)', padding: isMobile ? '12px 10px 40px' : '20px 20px 50px', boxSizing: 'border-box', fontFamily: "'Segoe UI', Tahoma, sans-serif", color: '#0f172a' };
    const contenedor = { maxWidth: 980, margin: '0 auto' };
    const volverMenu = () => setVista('menu');

    const Cabecera = ({ titulo, sub }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <button onClick={vista === 'menu' ? onExit : volverMenu} style={{ padding: '8px 16px', borderRadius: 999, border: '1.5px solid #cbd5e1', background: 'white', fontWeight: 800, cursor: 'pointer', color: '#334155', fontFamily: 'inherit' }}>← {vista === 'menu' ? 'Volver' : 'Menú'}</button>
            <div style={{ flex: 1, minWidth: 200 }}>
                <h1 style={{ margin: 0, fontSize: isMobile ? '1.4rem' : '1.8rem', color: COLOR }}>{titulo}</h1>
                {sub && <div style={{ color: '#64748b', fontWeight: 600, fontSize: '0.9rem' }}>{sub}</div>}
            </div>
        </div>
    );

    // ── Selector común de magnitudes / nivel / método ──
    const Opciones = ({ conMetodo = true, soloProblemas = false }) => (
        <div style={{ background: 'white', borderRadius: 18, padding: '14px 16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 14px rgba(15,23,42,0.06)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
                <div style={{ fontWeight: 900, color: '#334155', marginBottom: 6 }}>¿Qué magnitudes trabajamos?</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {ordenMags.filter((m) => !soloProblemas || MAG_PROBLEMAS.includes(m)).map((m) => (
                        <button key={m} onClick={() => alternar(m)} style={chip(mags.includes(m), MAGNITUDES[m].color)}>{MAGNITUDES[m].emoji} {MAGNITUDES[m].nombre}</button>
                    ))}
                </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <b style={{ color: '#334155' }}>Nivel:</b>
                {NIVELES.map(([k, t]) => <button key={k} onClick={() => setNivel(k)} style={chip(nivel === k, COLOR)}>{t}</button>)}
            </div>
            {conMetodo && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <b style={{ color: '#334155' }}>Método:</b>
                    {METODOS.map(([k, t]) => <button key={k} onClick={() => setMetodo(k)} style={chip(metodo === k, '#7c3aed')}>{t}</button>)}
                </div>
            )}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <b style={{ color: '#334155' }}>Ejercicios:</b>
                {[5, 10, 15, 20].map((k) => <button key={k} onClick={() => setN(k)} style={chip(n === k, '#16a34a')}>{k}</button>)}
            </div>
        </div>
    );

    if (vista === 'aprende') return (
        <div style={fondo}><div style={contenedor}>
            <Cabecera titulo="📖 Aprende a cambiar de unidades" sub="Elige una magnitud, prueba valores y compara el método de los saltos con el de los factores de conversión" />
            <ConversorVisual magnitudes={ordenMags} magInicial={mags[0]} nivel={nivel} />
        </div></div>
    );

    if (['practica', 'complejas', 'problemas'].includes(vista)) {
        const modo = vista === 'practica' ? 'conv' : vista;
        const magsUsar = vista === 'problemas' ? (magsProblemas.length ? magsProblemas : MAG_PROBLEMAS) : mags;
        return (
            <div style={fondo}><div style={contenedor}>
                <Practica key={`${modo}-${nivel}-${metodo}-${n}-${magsUsar.join('')}`} modo={modo} cfg={{ mags: magsUsar, nivel, metodo, n }} onSalir={volverMenu} />
            </div></div>
        );
    }

    if (vista === 'tiron') return (
        <div style={fondo}><div style={{ ...contenedor, maxWidth: 1200 }}>
            <Cabecera titulo="🪢 Tirón de cuerda · Cambio de unidades" />
            <TironUnidades magsIniciales={mags} nivelInicial={nivel} onSalir={volverMenu} isMobile={isMobile} />
        </div></div>
    );

    // ── MENÚ ──
    return (
        <div style={fondo}><div style={contenedor}>
            <Cabecera titulo="🔁 Cambio de unidades" sub="Longitud, masa, capacidad, superficie, volumen, tiempo, ángulos, temperatura, velocidad, densidad, presión, energía…" />
            <Opciones />
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 12, marginTop: 14 }}>
                <Tarjeta emoji="📖" color="#0891b2" titulo="Aprende" texto="Escalera de unidades, factores de conversión, termómetros °C/K/°F, grados ↔ radianes y tablas de equivalencias." onClick={() => setVista('aprende')} />
                <Tarjeta emoji="✏️" color="#2563eb" titulo="Practica conversiones" texto={`${n} ejercicios con el método «${METODOS.find(([k]) => k === metodo)?.[1].replace(/^\S+\s/, '')}», con pistas y explicación dibujada.`} onClick={() => setVista('practica')} />
                <Tarjeta emoji="📝" color="#7c3aed" titulo="Problemas" texto="Una misma magnitud en distintas unidades: hay que pasarlo todo a la misma unidad para poder operar." onClick={() => setVista('problemas')} />
                <Tarjeta emoji="🧩" color="#0d9488" titulo="Formas complejas e incomplejas" texto="3 km 5 hm 20 m = … m · 8 130 s = … h … min … s · grados, minutos y segundos." onClick={() => setVista('complejas')} />
                <Tarjeta emoji="🪢" color="#ea580c" titulo="Tirón de cuerda por equipos" texto="Dos equipos compiten eligiendo la conversión correcta. También con mandos micro:bit." onClick={() => setVista('tiron')} />
                <Tarjeta emoji="👾" color="#16a34a" titulo="Invasión Pi" texto="El arcade de marcianitos con las magnitudes y el nivel elegidos arriba." onClick={abrirInvasores} />
            </div>
            <div style={{ marginTop: 14 }}>
                <BotonFichas tema="unidades" color={COLOR} texto="🖨️ Fichas PDF de cambio de unidades" subtexto="Con la escalera dibujada, con factores de conversión o el ejercicio típico; problemas y soluciones paso a paso" />
            </div>
        </div></div>
    );
}
