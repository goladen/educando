// Guía dentro del panel de mandos: todos los juegos que se juegan con las micro:bit y las opciones
// comunes (relevos, quién juega, marcador, guardar…). Datos en ./juegosConMandos.js.
import { useState } from 'react';
import { JUEGOS_CON_MANDOS, OPCIONES_COMUNES, NOMBRE_MODO } from './juegosConMandos.js';

const st = {
    caja: { background: 'rgba(255,255,255,0.05)', border: '1px solid #334155', borderRadius: 14, marginTop: 18, overflow: 'hidden' },
    cabecera: (abierto) => ({ width: '100%', textAlign: 'left', background: abierto ? 'rgba(250,204,21,0.1)' : 'transparent', border: 'none', color: '#f8fafc', fontSize: 16, fontWeight: 800, padding: '14px 16px', cursor: 'pointer', fontFamily: 'inherit' }),
    cuerpo: { padding: '4px 16px 16px', color: '#e2e8f0', fontSize: 14, lineHeight: 1.5 },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 },
    tarjeta: { background: 'rgba(15,23,42,0.7)', border: '1px solid #334155', borderRadius: 12, padding: '10px 12px' },
    chip: { display: 'inline-block', fontSize: 11, fontWeight: 800, borderRadius: 999, padding: '2px 8px', marginRight: 4, marginTop: 4, background: 'rgba(250,204,21,0.15)', color: '#fde68a' },
    sub: { fontSize: 12, color: '#94a3b8' },
    h4: { margin: '14px 0 8px', fontSize: 14, color: '#fde68a', letterSpacing: 0.4 },
};

function Tarjeta({ j }) {
    return (
        <div style={st.tarjeta}>
            <div style={{ fontWeight: 800, color: '#fff' }}>{j.emoji} {j.nombre}</div>
            <div style={st.sub}>📍 {j.donde}</div>
            <div style={{ margin: '6px 0' }}>{j.como}</div>
            {j.modos.map((m) => <span key={m} style={st.chip}>{NOMBRE_MODO[m]}</span>)}
            <span style={{ ...st.chip, background: 'rgba(96,165,250,0.15)', color: '#bfdbfe' }}>👥 {j.jugadores}</span>
        </div>
    );
}

export default function GuiaJuegosMandos() {
    const [abierto, setAbierto] = useState(null); // 'juegos' | 'opciones'
    const alternar = (k) => setAbierto((a) => (a === k ? null : k));
    const deMandos = JUEGOS_CON_MANDOS.filter((j) => j.grupo === 'de mandos');
    const relevos = JUEGOS_CON_MANDOS.filter((j) => j.grupo === 'relevos');
    return (
        <>
            <section style={st.caja}>
                <button style={st.cabecera(abierto === 'juegos')} onClick={() => alternar('juegos')}>
                    {abierto === 'juegos' ? '▾' : '▸'} 📚 Todos los juegos con mandos ({JUEGOS_CON_MANDOS.length}) y cómo se juegan
                </button>
                {abierto === 'juegos' && (
                    <div style={st.cuerpo}>
                        <div style={st.h4}>🎮 JUEGOS PENSADOS PARA LOS MANDOS</div>
                        <div style={st.grid}>{deMandos.map((j) => <Tarjeta key={j.nombre} j={j} />)}</div>
                        <div style={st.h4}>🔄 JUEGOS DE SIEMPRE CON EL BOTÓN «🎮 MANDOS MICRO:BIT» (RELEVOS)</div>
                        <p style={{ margin: '0 0 10px' }}>Abre el juego como siempre y pulsa <b>🎮 Mandos micro:bit</b> abajo a la izquierda. Toda la clase puede jugar por turnos (relevos) y, en algunos, varios a la vez.</p>
                        <div style={st.grid}>{relevos.map((j) => <Tarjeta key={j.nombre} j={j} />)}</div>
                    </div>
                )}
            </section>
            <section style={st.caja}>
                <button style={st.cabecera(abierto === 'opciones')} onClick={() => alternar('opciones')}>
                    {abierto === 'opciones' ? '▾' : '▸'} ⚙️ Opciones comunes: quién juega, relevos, marcador y guardar resultados
                </button>
                {abierto === 'opciones' && (
                    <div style={st.cuerpo}>
                        <div style={st.grid}>
                            {OPCIONES_COMUNES.map((o) => (
                                <div key={o.t} style={st.tarjeta}>
                                    <div style={{ fontWeight: 800, color: '#fff', marginBottom: 4 }}>{o.t}</div>
                                    <div>{o.d}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </section>
        </>
    );
}
