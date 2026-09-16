import React, { useState, useEffect, useRef } from 'react';
import { ArrowUp, ArrowDown, RotateCcw, Trophy, Volume2, VolumeX, Settings, CheckCircle } from 'lucide-react';
import Confetti from 'react-confetti';
import { guardarRegistroLocal } from './utils/registrosLocales';
import { sonidoCorrecto, sonidoIncorrecto, sonidoPasar, sonidoFinal, sonidoActivo, setSonidoActivo, despertarAudio } from './utils/sonidosFeedback';

// ─────────────────────────────────────────────────────────────────────────────
//  EL ASCENSOR — modelo visual para las operaciones con números enteros.
//  Modo LIBRE: el alumno decide cuánto sube o baja y ve la secuencia.
//  Modo RETOS: la app propone los movimientos encadenados y el alumno señala
//  en el edificio la planta a la que llega.
// ─────────────────────────────────────────────────────────────────────────────

const rInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const EDIFICIOS = [
    { id: 'PEQUE',  label: '🏠 Pequeño', pisos: 4, sotanos: 2 },
    { id: 'MEDIO',  label: '🏢 Mediano', pisos: 6, sotanos: 3 },
    { id: 'GRANDE', label: '🏙️ Grande',  pisos: 9, sotanos: 5 },
];

const nombrePlanta = (p) => (p === 0 ? 'PB' : p > 0 ? `${p}º` : `S${-p}`);
const nombreLargo = (p) => (p === 0 ? 'la planta baja' : p > 0 ? `la planta ${p}ª` : `el sótano ${-p}`);
const signo = (n) => (n > 0 ? `+${n}` : `${n}`);

// ─── Edificio con el ascensor ────────────────────────────────────────────────
const Edificio = ({ pisos, sotanos, piso, onElegir, seleccion, estado, isMobile }) => {
    const H = isMobile ? 34 : 42;                 // alto de cada planta
    const plantas = [];
    for (let p = pisos; p >= -sotanos; p--) plantas.push(p);
    const alturaTotal = plantas.length * H;
    const topDe = (p) => (pisos - p) * H;

    return (
        <div style={{ position: 'relative', width: '100%', maxWidth: 420, margin: '0 auto' }}>
            <div style={{ position: 'relative', height: alturaTotal, borderRadius: 14, overflow: 'hidden', border: '3px solid #34495e', background: 'linear-gradient(180deg,#eaf4fb 0%,#eaf4fb 100%)' }}>
                {/* Plantas */}
                {plantas.map(p => {
                    const bajoTierra = p < 0;
                    const esActual = p === piso;
                    const elegida = seleccion === p;
                    const fondo = elegida
                        ? (estado === 'ok' ? '#d4f5dd' : estado === 'revelado' ? '#d9e9ff' : estado === 'err' ? '#ffdcdc' : '#fff3cd')
                        : bajoTierra ? '#e2d9cf' : p === 0 ? '#f7f2e4' : '#f4fafe';
                    return (
                        <div key={p}
                            onClick={() => onElegir && onElegir(p)}
                            style={{
                                position: 'absolute', top: topDe(p), left: 0, right: 0, height: H,
                                display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px',
                                background: fondo,
                                borderTop: p === 0 ? '4px solid #6d4c41' : '1.5px solid rgba(52,73,94,0.28)',
                                cursor: onElegir ? 'pointer' : 'default',
                                boxSizing: 'border-box', transition: 'background 0.2s',
                            }}>
                            {/* Número de planta */}
                            <div style={{
                                width: isMobile ? 34 : 42, flexShrink: 0, textAlign: 'center',
                                fontWeight: 900, fontSize: isMobile ? '0.8rem' : '0.95rem',
                                color: p > 0 ? '#1565C0' : p === 0 ? '#6d4c41' : '#a1470b',
                            }}>{nombrePlanta(p)}</div>
                            {/* Valor entero */}
                            <div style={{
                                minWidth: isMobile ? 30 : 38, flexShrink: 0, textAlign: 'center',
                                fontWeight: 800, fontSize: isMobile ? '0.75rem' : '0.85rem',
                                color: p > 0 ? '#27ae60' : p === 0 ? '#7f8c8d' : '#e74c3c',
                            }}>{p > 0 ? `+${p}` : p}</div>
                            {/* Ventanas del piso */}
                            <div style={{ flex: 1, display: 'flex', gap: 5, alignItems: 'center', opacity: bajoTierra ? 0.35 : 1 }}>
                                {Array.from({ length: isMobile ? 2 : 3 }).map((_, i) => (
                                    <div key={i} style={{ flex: 1, height: H * 0.45, borderRadius: 3, background: bajoTierra ? '#cbbba6' : '#bfe0f5', border: '1.5px solid rgba(52,73,94,0.3)' }} />
                                ))}
                            </div>
                            {/* Hueco del ascensor */}
                            <div style={{ width: isMobile ? 46 : 56, flexShrink: 0, height: '100%', background: 'rgba(52,73,94,0.13)', borderLeft: '2px solid rgba(52,73,94,0.3)' }} />
                            {esActual && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, background: '#f1c40f' }} />}
                        </div>
                    );
                })}

                {/* Cabina del ascensor */}
                <div style={{
                    position: 'absolute', right: 8, width: isMobile ? 40 : 50, height: H - 6,
                    top: topDe(piso) + 3,
                    transition: 'top 0.75s cubic-bezier(0.45,0.05,0.35,1)',
                    background: 'linear-gradient(180deg,#ffd95e,#f0a500)',
                    border: '2.5px solid #7d5a00', borderRadius: 7,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: isMobile ? '1rem' : '1.2rem', zIndex: 3,
                    boxShadow: '0 3px 8px rgba(0,0,0,0.35)',
                }}>🧍</div>

            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#95a5a6', fontWeight: 700, marginTop: 4 }}>
                <span>🌳 La línea marrón es la calle (planta baja = 0)</span>
                <span>Sótanos = negativos</span>
            </div>
        </div>
    );
};

// ─── Secuencia de movimientos (la «cuenta» en horizontal) ───────────────────
const Secuencia = ({ inicio, movimientos, isMobile }) => {
    if (!movimientos.length) return (
        <div style={{ fontSize: isMobile ? '1.1rem' : '1.3rem', fontWeight: 900, color: '#2c3e50' }}>
            Empiezas en <span style={{ color: '#1565C0' }}>{signo(inicio)}</span>
        </div>
    );
    const total = inicio + movimientos.reduce((s, m) => s + m, 0);
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', justifyContent: 'center', fontSize: isMobile ? '1rem' : '1.25rem', fontWeight: 900, color: '#2c3e50' }}>
            <span style={{ color: '#1565C0' }}>{signo(inicio)}</span>
            {movimientos.map((m, i) => (
                <span key={i} style={{ color: m > 0 ? '#27ae60' : '#e74c3c' }}>
                    {m > 0 ? '+' : '−'} {Math.abs(m)}
                </span>
            ))}
            <span>=</span>
            <span style={{ padding: '2px 12px', borderRadius: 20, background: total >= 0 ? '#e8f5e9' : '#fdecea', color: total >= 0 ? '#27ae60' : '#e74c3c' }}>{signo(total)}</span>
        </div>
    );
};

// ═════════════════════════════════════════════════════════════════════════════
export default function AscensorEnteros({ onExit }) {
    const [modo, setModo] = useState('LIBRE');            // LIBRE | RETOS
    const [edificio, setEdificio] = useState(EDIFICIOS[1]);
    const [sonido, setSonido] = useState(() => sonidoActivo());
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth <= 700);
    useEffect(() => {
        const r = () => setIsMobile(window.innerWidth <= 700);
        window.addEventListener('resize', r);
        return () => window.removeEventListener('resize', r);
    }, []);

    const { pisos, sotanos } = edificio;
    const dentro = (p) => p <= pisos && p >= -sotanos;

    // ── Estado común ──
    const [piso, setPiso] = useState(0);
    const [inicio, setInicio] = useState(0);
    const [movs, setMovs] = useState([]);

    // ── Modo libre ──
    const [cantidad, setCantidad] = useState(1);

    // ── Modo retos ──
    const [totalRondas, setTotalRondas] = useState(8);
    const [ronda, setRonda] = useState(0);
    const [delta, setDelta] = useState(null);             // movimiento propuesto
    const [seleccion, setSeleccion] = useState(null);
    const [estado, setEstado] = useState(null);           // null | 'ok' | 'err'
    const [intentos, setIntentos] = useState(0);
    const [aciertos, setAciertos] = useState(0);
    const [fallos, setFallos] = useState(0);
    const [puntos, setPuntos] = useState(0);
    const [fin, setFin] = useState(false);
    const [guardado, setGuardado] = useState(false);
    const timers = useRef([]);

    const limpiarTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
    useEffect(() => () => limpiarTimers(), []);

    // Genera un movimiento que no se salga del edificio
    const nuevoMovimiento = (desde) => {
        const opciones = [];
        for (let d = -Math.min(6, desde + sotanos); d <= Math.min(6, pisos - desde); d++) {
            if (d !== 0) opciones.push(d);
        }
        return opciones.length ? opciones[Math.floor(Math.random() * opciones.length)] : 0;
    };

    const reiniciar = (nuevoModo = modo, ed = edificio) => {
        limpiarTimers();
        const arranque = nuevoModo === 'RETOS' ? rInt(-ed.sotanos, ed.pisos) : 0;
        setPiso(arranque); setInicio(arranque); setMovs([]);
        setSeleccion(null); setEstado(null); setIntentos(0);
        setAciertos(0); setFallos(0); setPuntos(0); setRonda(0);
        setFin(false); setGuardado(false);
        if (nuevoModo === 'RETOS') {
            setRonda(1);
            setDelta(nuevoMovimiento(arranque));
        } else {
            setDelta(null);
        }
    };

    // Al cambiar de modo o de edificio, empezamos de cero
    useEffect(() => { reiniciar(modo, edificio); }, [modo, edificio]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { if (fin) sonidoFinal(); }, [fin]);

    // ── Acciones del modo libre ──
    const mover = (d) => {
        despertarAudio();
        const destino = piso + d;
        if (!dentro(destino)) return;
        setPiso(destino);
        setMovs(m => [...m, d]);
    };

    const clicPlantaLibre = (p) => {
        if (p === piso) return;
        mover(p - piso);
    };

    // ── Acciones del modo retos ──
    const clicPlantaReto = (p) => {
        if (estado === 'ok' || estado === 'revelado' || fin || delta == null) return;
        despertarAudio();
        const destino = piso + delta;
        setSeleccion(p);
        if (p === destino) {
            sonidoCorrecto();
            setEstado('ok');
            setAciertos(a => a + 1);
            setPuntos(v => v + (intentos === 0 ? 10 : 5));
            setMovs(m => [...m, delta]);
            timers.current.push(setTimeout(() => {
                setPiso(destino);
                setSeleccion(null); setEstado(null); setIntentos(0);
                if (ronda >= totalRondas) { setDelta(null); setFin(true); }
                else { setRonda(r => r + 1); setDelta(nuevoMovimiento(destino)); }
            }, 900));
        } else {
            sonidoIncorrecto();
            setEstado('err');
            setFallos(f => f + 1);
            setPuntos(v => Math.max(0, v - 3));
            const nuevosIntentos = intentos + 1;
            setIntentos(nuevosIntentos);
            if (nuevosIntentos >= 2) {
                // Segunda equivocación: se enseña la respuesta y se sigue
                timers.current.push(setTimeout(() => {
                    setSeleccion(destino); setEstado('revelado');
                    timers.current.push(setTimeout(() => {
                        setPiso(destino);
                        setMovs(m => [...m, delta]);
                        setSeleccion(null); setEstado(null); setIntentos(0);
                        if (ronda >= totalRondas) { setDelta(null); setFin(true); }
                        else { setRonda(r => r + 1); setDelta(nuevoMovimiento(destino)); }
                    }, 1200));
                }, 700));
            } else {
                timers.current.push(setTimeout(() => { setSeleccion(null); setEstado(null); }, 700));
            }
        }
    };

    const guardarLocal = () => {
        guardarRegistroLocal('CALCULO', {
            titulo: 'El Ascensor (enteros)',
            aciertos, intentos: aciertos + fallos,
            porcentaje: Math.round((aciertos / Math.max(1, aciertos + fallos)) * 100),
            nombre: '', curso: '', via: 'local',
        });
        setGuardado(true);
    };

    const destino = delta != null ? piso + delta : null;

    return (
        <div style={st.container}>
            {/* HEADER */}
            <div style={st.header}>
                <button onClick={() => (typeof onExit === 'function' ? onExit() : window.history.back())} style={st.btn}>
                    <RotateCcw size={16} /> Salir
                </button>
                <button onClick={() => { const n = !sonido; setSonido(setSonidoActivo(n)); if (n) { despertarAudio(); sonidoCorrecto(); } }}
                    style={st.btn} title={sonido ? 'Silenciar' : 'Activar sonido'}>
                    {sonido ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
                {modo === 'RETOS' && !fin && (
                    <div style={st.marcadores}>
                        <div style={{ ...st.chipMarcador, color: '#009688' }}>🔢 {ronda}/{totalRondas}</div>
                        <div style={{ ...st.chipMarcador, color: '#E91E63' }}><Trophy size={15} /> {puntos}</div>
                        <div style={{ ...st.chipMarcador, color: '#27ae60' }}>✅ {aciertos}</div>
                        <div style={{ ...st.chipMarcador, color: '#e74c3c' }}>❌ {fallos}</div>
                    </div>
                )}
            </div>

            <div style={{ maxWidth: 880, margin: '0 auto' }}>
                <h1 style={{ textAlign: 'center', color: '#2c3e50', fontSize: isMobile ? '1.5rem' : '2rem', margin: '0 0 4px' }}>🛗 El Ascensor</h1>
                <p style={{ textAlign: 'center', color: '#999', fontSize: '0.88rem', margin: '0 0 14px' }}>
                    Los pisos son positivos, los sótanos negativos. Subir es sumar y bajar es restar.
                </p>

                {/* Selector de modo */}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
                    {[{ id: 'LIBRE', label: '🕹️ Yo manejo el ascensor' }, { id: 'RETOS', label: '🎯 Adivina dónde llegas' }].map(m => (
                        <button key={m.id} onClick={() => setModo(m.id)}
                            style={{ padding: isMobile ? '9px 14px' : '11px 20px', borderRadius: 24, border: '2px solid #E91E63', cursor: 'pointer', fontWeight: 800, fontSize: isMobile ? '0.85rem' : '0.95rem', background: modo === m.id ? '#E91E63' : 'white', color: modo === m.id ? 'white' : '#E91E63', boxShadow: modo === m.id ? '0 4px 12px rgba(233,30,99,0.35)' : 'none', touchAction: 'manipulation' }}>
                            {m.label}
                        </button>
                    ))}
                </div>

                {/* Ajustes */}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
                    <Settings size={14} color="#95a5a6" />
                    {EDIFICIOS.map(e => (
                        <button key={e.id} onClick={() => setEdificio(e)}
                            style={{ ...st.chip, border: '2px solid #34495e', background: edificio.id === e.id ? '#34495e' : 'white', color: edificio.id === e.id ? 'white' : '#34495e' }}>
                            {e.label}
                        </button>
                    ))}
                    {modo === 'RETOS' && [5, 8, 12].map(n => (
                        <button key={n} onClick={() => { setTotalRondas(n); reiniciar('RETOS', edificio); }}
                            style={{ ...st.chip, border: '2px solid #009688', background: totalRondas === n ? '#009688' : 'white', color: totalRondas === n ? 'white' : '#009688' }}>
                            {n} movimientos
                        </button>
                    ))}
                    <button onClick={() => reiniciar()} style={{ ...st.chip, border: '2px solid #95a5a6', background: 'white', color: '#7f8c8d' }}>🔄 Reiniciar</button>
                </div>

                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexDirection: isMobile ? 'column' : 'row' }}>
                    {/* EDIFICIO */}
                    <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
                        <Edificio
                            pisos={pisos} sotanos={sotanos} piso={piso} isMobile={isMobile}
                            onElegir={fin ? null : (modo === 'LIBRE' ? clicPlantaLibre : clicPlantaReto)}
                            seleccion={seleccion} estado={estado}
                        />
                    </div>

                    {/* PANEL DERECHO */}
                    <div style={{ flex: 1, minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {/* Posición actual */}
                        <div style={{ ...st.tarjeta, textAlign: 'center' }}>
                            <div style={{ fontSize: '0.75rem', color: '#95a5a6', fontWeight: 800, textTransform: 'uppercase' }}>Estás en</div>
                            <div style={{ fontSize: isMobile ? '2.2rem' : '2.8rem', fontWeight: 900, color: piso > 0 ? '#27ae60' : piso === 0 ? '#6d4c41' : '#e74c3c' }}>
                                {signo(piso)}
                            </div>
                            <div style={{ color: '#7f8c8d', fontWeight: 700, fontSize: '0.9rem' }}>{nombreLargo(piso)}</div>
                        </div>

                        {modo === 'LIBRE' ? (
                            <div style={st.tarjeta}>
                                <div style={{ fontSize: '0.75rem', color: '#95a5a6', fontWeight: 800, textTransform: 'uppercase', textAlign: 'center', marginBottom: 8 }}>¿Cuántas plantas?</div>
                                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                                    {[1, 2, 3, 4, 5, 6].map(n => (
                                        <button key={n} onClick={() => setCantidad(n)}
                                            style={{ width: isMobile ? 40 : 46, height: isMobile ? 40 : 46, borderRadius: 12, border: '2px solid #1565C0', background: cantidad === n ? '#1565C0' : 'white', color: cantidad === n ? 'white' : '#1565C0', fontWeight: 900, fontSize: '1.05rem', cursor: 'pointer', touchAction: 'manipulation' }}>
                                            {n}
                                        </button>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <button onClick={() => mover(cantidad)} disabled={!dentro(piso + cantidad)}
                                        style={{ ...st.btnGrande, background: dentro(piso + cantidad) ? '#27ae60' : '#dfe6e9', boxShadow: dentro(piso + cantidad) ? '0 5px 0 #1e8449' : 'none', color: dentro(piso + cantidad) ? 'white' : '#b2bec3' }}>
                                        <ArrowUp size={20} /> Subir {cantidad}
                                    </button>
                                    <button onClick={() => mover(-cantidad)} disabled={!dentro(piso - cantidad)}
                                        style={{ ...st.btnGrande, background: dentro(piso - cantidad) ? '#e74c3c' : '#dfe6e9', boxShadow: dentro(piso - cantidad) ? '0 5px 0 #b03a2e' : 'none', color: dentro(piso - cantidad) ? 'white' : '#b2bec3' }}>
                                        <ArrowDown size={20} /> Bajar {cantidad}
                                    </button>
                                </div>
                                <div style={{ textAlign: 'center', fontSize: '0.76rem', color: '#95a5a6', marginTop: 8, fontWeight: 700 }}>
                                    También puedes tocar directamente una planta del edificio
                                </div>
                            </div>
                        ) : (
                            <div style={{ ...st.tarjeta, borderColor: estado === 'ok' ? '#27ae60' : estado === 'revelado' ? '#1565C0' : estado === 'err' ? '#e74c3c' : '#ecf0f1' }}>
                                {fin ? (
                                    <div style={{ textAlign: 'center' }}>
                                        {puntos >= 60 && <Confetti recycle={false} />}
                                        <div style={{ fontSize: '2.6rem' }}>🏆</div>
                                        <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#2c3e50' }}>¡Recorrido completado!</div>
                                        <div style={{ fontSize: '2.4rem', fontWeight: 900, color: '#E91E63', margin: '6px 0' }}>{puntos}</div>
                                        <div style={{ color: '#7f8c8d', fontWeight: 700, marginBottom: 12 }}>✅ {aciertos} aciertos · ❌ {fallos} fallos</div>
                                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                                            <button onClick={() => reiniciar('RETOS', edificio)} style={{ ...st.btnGrande, flex: 'none', padding: '11px 20px', background: '#E91E63', boxShadow: '0 5px 0 #ad1457', color: 'white' }}>
                                                <RotateCcw size={16} /> Otra vez
                                            </button>
                                            <button onClick={guardarLocal} disabled={guardado}
                                                style={{ ...st.btnGrande, flex: 'none', padding: '11px 20px', background: guardado ? '#bdc3c7' : '#2980b9', boxShadow: guardado ? 'none' : '0 5px 0 #1f618d', color: 'white' }}>
                                                {guardado ? <><CheckCircle size={16} /> Guardado</> : '💾 Guardar'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div style={{ fontSize: '0.75rem', color: '#95a5a6', fontWeight: 800, textTransform: 'uppercase', textAlign: 'center' }}>Movimiento {ronda} de {totalRondas}</div>
                                        <div style={{ textAlign: 'center', fontSize: isMobile ? '1.05rem' : '1.25rem', fontWeight: 800, color: '#2c3e50', margin: '10px 0 6px', lineHeight: 1.45 }}>
                                            Estás en <b style={{ color: '#1565C0' }}>{nombreLargo(piso)}</b> y{' '}
                                            {delta > 0
                                                ? <>subes <b style={{ color: '#27ae60' }}>{delta}</b> {delta === 1 ? 'planta' : 'plantas'}</>
                                                : <>bajas <b style={{ color: '#e74c3c' }}>{Math.abs(delta)}</b> {Math.abs(delta) === 1 ? 'planta' : 'plantas'}</>}
                                        </div>
                                        <div style={{ textAlign: 'center', fontSize: isMobile ? '1.2rem' : '1.4rem', fontWeight: 900, color: '#7f8c8d', marginBottom: 10 }}>
                                            {signo(piso)} {delta > 0 ? '+' : '−'} {Math.abs(delta)} = ?
                                        </div>
                                        <div style={{ textAlign: 'center', fontWeight: 800, fontSize: '0.92rem', color: estado === 'ok' ? '#27ae60' : estado === 'revelado' ? '#1565C0' : estado === 'err' ? '#e74c3c' : '#f39c12' }}>
                                            {estado === 'ok' ? `✅ ¡Correcto! Llegas a ${nombreLargo(destino)}`
                                                : estado === 'revelado' ? `👀 Era ${nombreLargo(destino)}: ${signo(piso)} ${delta > 0 ? '+' : '−'} ${Math.abs(delta)} = ${signo(destino)}`
                                                : estado === 'err' ? '❌ No es esa. Cuenta las plantas una a una'
                                                : '👆 Señala en el edificio la planta a la que llegas'}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Secuencia */}
                        <div style={{ ...st.tarjeta, textAlign: 'center' }}>
                            <div style={{ fontSize: '0.75rem', color: '#95a5a6', fontWeight: 800, textTransform: 'uppercase', marginBottom: 8 }}>La secuencia</div>
                            <Secuencia inicio={inicio} movimientos={movs} isMobile={isMobile} />
                            {movs.length > 0 && (
                                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center', marginTop: 10 }}>
                                    {movs.map((m, i) => (
                                        <span key={i} style={{ padding: '3px 9px', borderRadius: 20, fontWeight: 800, fontSize: '0.78rem', background: m > 0 ? '#e8f5e9' : '#fdecea', color: m > 0 ? '#27ae60' : '#e74c3c' }}>
                                            {m > 0 ? `▲ sube ${m}` : `▼ baja ${Math.abs(m)}`}
                                        </span>
                                    ))}
                                </div>
                            )}
                            {modo === 'LIBRE' && movs.length > 0 && (
                                <button onClick={() => { sonidoPasar(); setMovs([]); setInicio(piso); }}
                                    style={{ ...st.chip, border: '2px solid #95a5a6', background: 'white', color: '#7f8c8d', marginTop: 10 }}>
                                    🧹 Borrar la cuenta (seguir desde aquí)
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

const st = {
    container: { minHeight: '100vh', background: '#fce4ec', padding: '15px', fontFamily: "'Segoe UI', Tahoma, sans-serif", boxSizing: 'border-box' },
    header: { display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
    btn: { padding: '8px 16px', background: 'white', border: '1px solid #ccc', borderRadius: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 'bold', color: '#333', fontSize: '0.9rem' },
    marcadores: { display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 'auto' },
    chipMarcador: { display: 'flex', alignItems: 'center', gap: 5, background: 'white', padding: '6px 12px', borderRadius: 30, fontWeight: 'bold', fontSize: '0.9rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
    chip: { padding: '6px 12px', borderRadius: 20, cursor: 'pointer', fontWeight: 800, fontSize: '0.78rem', touchAction: 'manipulation' },
    tarjeta: { background: 'white', borderRadius: 16, padding: '14px 14px', boxShadow: '0 6px 18px rgba(0,0,0,0.08)', border: '2px solid #ecf0f1', boxSizing: 'border-box' },
    btnGrande: { flex: 1, padding: '14px 10px', border: 'none', borderRadius: 14, fontSize: '1rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, touchAction: 'manipulation' },
};
