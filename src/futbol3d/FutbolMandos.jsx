// «Partido con mandos micro:bit» (Fútbol Quizz 3D): cada mando es un jugador de campo.
// Vestíbulo: los mandos se unen pulsando cualquier botón y el profe los reparte en dos equipos
// (clic en un jugador: sin equipo → rojo → azul) y les pone nombre.
// En el partido (modo V, como el ovni): inclinar mueve al jugador, A pasa al compañero más cercano
// a su izquierda (según hacia dónde mira), B al de su derecha y el logo (o agitar) chuta. Con antenas anteriores a la v8 se juega con
// los controles antiguos del modo F (A corre, B / logo giran, agitar tira, inclinar pasa).
// Si un rival alcanza al que lleva el balón, se para el partido y ambos responden una pregunta
// con su mando (A cambia la letra, B la envía; agitar no cuenta en el duelo): el primero que acierta se queda el balón.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { montarMotorMandos } from './motorFutbolMandos';
import {
    MODOS, LETRAS, VERSION_PROGRAMAS, VERSION_CANAL, setModoMandos, escucharMandos, escucharEstadoAntena,
    simularPulsacion, feedbackMando, dueloMando, finDuelosMandos,
} from '../mandos/mandosMicrobit.js';
import { GENERADORES, barajar } from '../mandos/QuizMandos.jsx';
import SelectorRecursoMandos, { hojasQuiz, ElegirHoja, preguntasDeHoja } from '../mandos/SelectorRecursoMandos.jsx';
import GuardarResultadosMandos from '../mandos/GuardarResultadosMandos.jsx';
import { despertarAudio } from '../utils/sonidosFeedback';
// Los mismos sonidos y la misma celebración final que la pizarra 2D de Fútbol Quizz
import { sonidoAcierto, sonidoFallo, sonidoGol, pitido, pitidoTriple, FondoCampeones, VideoCampeones } from './efectosFutbol';
import { BotonTutorialMandos } from '../mandos/TutorialMandos.jsx';
import ChipAntena from '../mandos/ChipAntena.jsx';

const LS_NOMBRES = 'pikt_mandos_nombres';
const SEG_DUELO = 15;
const SEG_PREPARA = 4; // «¡Preparados!»: se lee la pregunta y aún no se puede responder
// Pitido de «¡ya!» al abrir las respuestas del duelo
const sonidoAbrir = () => {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        [0, 0.12].forEach((t, i) => {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.frequency.value = i ? 1320 : 880;
            g.gain.setValueAtTime(0.25, ctx.currentTime + t);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.15);
            o.connect(g).connect(ctx.destination);
            o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.16);
        });
        setTimeout(() => ctx.close(), 600);
    } catch { /* sin audio */ }
};
const PAUSA_RESULTADO = 1800;
const EQUIPOS = { red: { l: 'Rojo', c: '#dc2626' }, blue: { l: 'Azul', c: '#2563eb' } };

const leerNombres = () => { try { return JSON.parse(localStorage.getItem(LS_NOMBRES) || '{}') || {}; } catch { return {}; } };
const guardarNombre = (id, nombre) => {
    try {
        const n = leerNombres();
        if (nombre.trim()) n[id] = nombre.trim(); else delete n[id];
        localStorage.setItem(LS_NOMBRES, JSON.stringify(n));
    } catch { /* sin almacenamiento */ }
};
const nombrePorDefecto = (id) => (id > 900 ? `Virtual ${id - 900}` : `Mando ${id}`);

// Botón de mando virtual que se puede mantener pulsado (envía pulsado/soltado y un latido)
function BotonVirtual({ id, accion, children }) {
    const t = useRef(null);
    const soltar = () => { if (t.current) { clearInterval(t.current); t.current = null; simularPulsacion(id, `F${accion}0`); } };
    useEffect(() => () => soltar(), []); // eslint-disable-line react-hooks/exhaustive-deps
    return (
        <button style={st.mini}
            onPointerDown={(e) => { e.preventDefault(); simularPulsacion(id, `F${accion}1`); t.current = setInterval(() => simularPulsacion(id, `F${accion}1`), 400); }}
            onPointerUp={soltar} onPointerLeave={soltar} onPointerCancel={soltar}>
            {children}
        </button>
    );
}

// Inclinación virtual (modo V): mientras se mantiene, repite la inclinación como el mando real
function InclinarVirtual({ id, d, x, y, children }) {
    const t = useRef(null);
    const soltar = () => { if (t.current) { clearInterval(t.current); t.current = null; simularPulsacion(id, 'FV0,0,0'); } };
    useEffect(() => () => soltar(), []); // eslint-disable-line react-hooks/exhaustive-deps
    const enviar = () => simularPulsacion(id, `FV${d},${x},${y}`);
    return (
        <button style={{ ...st.mini, background: '#1d4ed8' }} title="Inclinar: moverse"
            onPointerDown={(e) => { e.preventDefault(); enviar(); t.current = setInterval(enviar, 300); }}
            onPointerUp={soltar} onPointerLeave={soltar} onPointerCancel={soltar}>
            {children}
        </button>
    );
}

function MandosVirtuales({ ids, volante }) {
    if (volante) return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ids.map(id => (
                <div key={id} style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ width: 34, fontSize: 12, color: '#94a3b8' }}>V{id - 900}</span>
                    {[['I', -80, 0, '◀'], ['F', 0, -80, '▲'], ['T', 0, 80, '▼'], ['D', 80, 0, '▶']].map(([d, x, y, f]) => (
                        <InclinarVirtual key={d} id={id} d={d} x={x} y={y}>{f}</InclinarVirtual>
                    ))}
                    <BotonVirtual id={id} accion="A">A ⇠</BotonVirtual>
                    <BotonVirtual id={id} accion="B">⇢ B</BotonVirtual>
                    <BotonVirtual id={id} accion="L">⚽ logo</BotonVirtual>
                </div>
            ))}
        </div>
    );
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ids.map(id => (
                <div key={id} style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ width: 34, fontSize: 12, color: '#94a3b8' }}>V{id - 900}</span>
                    <BotonVirtual id={id} accion="L">⟲</BotonVirtual>
                    <BotonVirtual id={id} accion="A">⬆ A</BotonVirtual>
                    <BotonVirtual id={id} accion="B">⟳</BotonVirtual>
                    <button style={{ ...st.mini, background: '#b91c1c' }} onClick={() => simularPulsacion(id, 'FS')}>⚽ Agitar</button>
                    {[['I', '◀'], ['F', '▲'], ['T', '▼'], ['D', '▶']].map(([d, f]) => (
                        <button key={d} style={{ ...st.mini, background: '#1d4ed8' }} title="Inclinar: pase" onClick={() => simularPulsacion(id, 'FP' + d)}>{f}</button>
                    ))}
                </div>
            ))}
        </div>
    );
}

export default function FutbolMandos({ onExit }) {
    const [fase, setFase] = useState('EQUIPOS'); // EQUIPOS | JUEGO | FIN
    const [jugadores, setJugadores] = useState({}); // id → { id, nombre, team: null | 'red' | 'blue' }
    const [nombreEquipo, setNombreEquipo] = useState({ red: 'Equipo Rojo', blue: 'Equipo Azul' });
    const [golesParaGanar, setGolesParaGanar] = useState(3);
    const [minutos, setMinutos] = useState(10);
    const [fuente, setFuente] = useState('tablas');
    const [recurso, setRecurso] = useState(null);
    const [hojaSel, setHojaSel] = useState(-1); // -1 = todas las hojas
    const [antena, setAntena] = useState({ antenaOk: false, version: 0 });
    const [virtuales, setVirtuales] = useState(false);

    const [marcador, setMarcador] = useState({ red: 0, blue: 0 });
    const [stats, setStats] = useState({}); // id → { goles, duelos }
    const [aviso, setAviso] = useState('');
    const [duelo, setDuelo] = useState(null); // { a, b, q, fin, resp: {id: letra}, ganador, cerrado }
    const [restante, setRestante] = useState(0);
    const [pausa, setPausa] = useState(false);

    const hostRef = useRef(null);
    const motorRef = useRef(null);
    const faseRef = useRef(fase); faseRef.current = fase;
    const jugRef = useRef(jugadores); jugRef.current = jugadores;
    const dueloRef = useRef(duelo); dueloRef.current = duelo;
    const marcadorRef = useRef(marcador); marcadorRef.current = marcador;
    const colaRef = useRef([]);
    const finRef = useRef(0);
    const timers = useRef([]);
    const luego = (fn, ms) => timers.current.push(setTimeout(fn, ms));
    // Las órdenes de duelo van por radio sin confirmación: «fin de duelo» se manda 3 veces por si se pierde una
    const cerrarDuelosMandos = () => { finDuelosMandos(); luego(finDuelosMandos, 400); luego(finDuelosMandos, 900); };

    // Volante (inclinar = moverse) con antena v8+ o sin antena (mandos virtuales); si no, controles antiguos
    const volante = !antena.antenaOk || antena.version >= VERSION_CANAL;
    const volanteRef = useRef(volante); volanteRef.current = volante;

    useEffect(() => escucharEstadoAntena(setAntena), []);
    useEffect(() => () => { finDuelosMandos(); setModoMandos(MODOS.LETRAS); timers.current.forEach(clearTimeout); }, []);
    useEffect(() => {
        setModoMandos(volante ? MODOS.VOLANTE : MODOS.FUTBOL);
        motorRef.current?.setControl(volante ? 'V' : 'F');
    }, [volante]);


    // ── Preguntas ──
    const hojasRecurso = recurso ? hojasQuiz(recurso) : [];
    const preguntasRecurso = preguntasDeHoja(hojasRecurso, hojaSel);
    const siguientePregunta = () => {
        if (fuente === 'recurso' && preguntasRecurso.length) {
            if (!colaRef.current.length) colaRef.current = barajar(preguntasRecurso);
            const p = colaRef.current.shift();
            const orden = barajar(p.opciones.map((_, i) => i));
            return { texto: p.texto, opciones: orden.map(i => p.opciones[i]), correcta: orden.indexOf(p.correcta) };
        }
        return GENERADORES[fuente === 'sumas' ? 'sumas' : 'tablas']();
    };

    // ── Duelo ──
    const cerrarDuelo = useCallback((ganador) => {
        const d = dueloRef.current;
        if (!d || d.cerrado) return;
        Object.entries(d.resp).forEach(([id, l]) => { if (Number(id) < 900) feedbackMando(Number(id), LETRAS.indexOf(l) === d.q.correcta); });
        // Para el informe: cada duelo cuenta como una pregunta para los dos jugadores
        setStats(s => {
            const sig = { ...s };
            [d.a, d.b].forEach(id => {
                const ok = LETRAS.indexOf(d.resp[id]) === d.q.correcta;
                sig[id] = { ...(sig[id] || {}), jugados: (sig[id]?.jugados || 0) + 1, aciertos: (sig[id]?.aciertos || 0) + (ok ? 1 : 0) };
            });
            return sig;
        });
        if (ganador) { sonidoAcierto(); setStats(s => ({ ...s, [ganador]: { ...(s[ganador] || {}), duelos: (s[ganador]?.duelos || 0) + 1 } })); }
        else sonidoFallo();
        setDuelo({ ...d, ganador, cerrado: true });
        cerrarDuelosMandos();
        luego(() => {
            setDuelo(null);
            motorRef.current?.resolverDuelo(ganador);
        }, PAUSA_RESULTADO);
    }, []);

    // Reloj del duelo
    useEffect(() => {
        if (!duelo || duelo.cerrado) return undefined;
        const t = setInterval(() => {
            const d = dueloRef.current;
            if (!d || d.cerrado) return;
            const ahora = Date.now();
            if (ahora >= d.fin) { cerrarDuelo(null); return; }
            // Pasado el «¡Preparados!», los mandos entran en modo pregunta (antes no se puede responder)
            if (!d.abierto && ahora >= d.abre) {
                d.abierto = true;
                d.ultQ = ahora;
                [d.a, d.b].forEach(id => { if (id < 900) dueloMando(id); });
                sonidoAbrir();
            } else if (d.abierto && ahora - (d.ultQ || 0) >= 1000) {
                // Se repite cada segundo al que aún no ha respondido: si un mensaje se pierde, su mando se
                // quedaría en modo juego sin poder responder (el mando ignora la orden si ya está en duelo)
                d.ultQ = ahora;
                [d.a, d.b].forEach(id => { if (id < 900 && !d.resp[id]) dueloMando(id); });
            }
            setDuelo(x => (x ? { ...x } : x));
        }, 250);
        return () => clearInterval(t);
    }, [duelo?.a, duelo?.cerrado, cerrarDuelo]); // eslint-disable-line react-hooks/exhaustive-deps

    const responderDuelo = (id, letra) => {
        const d = dueloRef.current;
        if (!d || d.cerrado || !d.abierto || (id !== d.a && id !== d.b) || d.resp[id]) return;
        const resp = { ...d.resp, [id]: letra };
        const nuevo = { ...d, resp };
        dueloRef.current = nuevo;
        setDuelo(nuevo);
        if (LETRAS.indexOf(letra) === d.q.correcta) cerrarDuelo(id);
        else if (resp[d.a] && resp[d.b]) cerrarDuelo(null);
    };

    // ── Pulsaciones ──
    useEffect(() => escucharMandos((ev) => {
        const f = faseRef.current;
        if (ev.tipo === 'letra') { if (f === 'JUEGO') responderDuelo(ev.id, ev.letra); return; }
        if (ev.tipo !== 'futbol') return;
        if (!jugRef.current[ev.id] && f !== 'FIN') {
            const nombre = leerNombres()[ev.id] || nombrePorDefecto(ev.id);
            setJugadores(j => (j[ev.id] ? j : { ...j, [ev.id]: { id: ev.id, nombre, team: null } }));
            return;
        }
        if (f === 'JUEGO' && jugRef.current[ev.id]?.team) motorRef.current?.evento(ev);
    }), []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Motor ──
    const callbacks = useRef({});
    callbacks.current = {
        onDuelo: ({ conBalon, rival }) => {
            // Primero SEG_PREPARA s para leer la pregunta y soltar el mando; los mandos aún no responden
            const abre = Date.now() + SEG_PREPARA * 1000;
            const d = { a: conBalon, b: rival, q: siguientePregunta(), abre, abierto: false, fin: abre + SEG_DUELO * 1000, resp: {}, ganador: null, cerrado: false };
            dueloRef.current = d;
            setDuelo(d);
            pitido(); // el árbitro para el partido
        },
        onGol: (team, goleador) => {
            sonidoGol();
            setMarcador(m => ({ ...m, [team]: m[team] + 1 }));
            if (goleador != null) setStats(s => ({ ...s, [goleador]: { ...(s[goleador] || {}), goles: (s[goleador]?.goles || 0) + 1 } }));
            setAviso(`⚽ ¡GOOOL del ${nombreEquipo[team]}!${goleador != null ? ` (${jugRef.current[goleador]?.nombre || ''})` : ''}`);
        },
        onFinCelebracion: (team) => {
            setAviso('');
            if (marcadorRef.current[team] >= golesParaGanar) { terminar(); return; }
            saqueCon(team === 'red' ? 'blue' : 'red');
        },
    };

    const saqueCon = (equipo) => {
        const m = motorRef.current; if (!m) return;
        m.prepararSaque(equipo);
        setAviso(`Saca el ${nombreEquipo[equipo]}… ¡preparados!`);
        luego(() => { if (faseRef.current === 'JUEGO') { setAviso(''); pitido(); m.saque(); } }, 2200);
    };

    const terminar = () => {
        cerrarDuelosMandos();
        setDuelo(null);
        setFase('FIN');
        pitidoTriple(); // final del partido
    };

    // Montar el motor al entrar en el partido
    useEffect(() => {
        if (fase !== 'JUEGO' || !hostRef.current) return undefined;
        const m = montarMotorMandos({ host: hostRef.current, cb: () => callbacks.current });
        motorRef.current = m;
        m.setControl(volanteRef.current ? 'V' : 'F');
        m.ponerJugadores(Object.values(jugRef.current).filter(j => j.team));
        pitidoTriple(); // empieza el partido
        saqueCon('red');
        return () => { m.destroy(); motorRef.current = null; };
    }, [fase]); // eslint-disable-line react-hooks/exhaustive-deps

    // Nombres o equipos cambiados durante el partido
    useEffect(() => { motorRef.current?.ponerJugadores(Object.values(jugadores).filter(j => j.team)); }, [jugadores]);
    useEffect(() => { motorRef.current?.pausar(pausa || !!duelo); }, [pausa, duelo]);

    // Reloj del partido
    useEffect(() => {
        if (fase !== 'JUEGO' || !minutos) return undefined;
        const t = setInterval(() => {
            if (pausa || dueloRef.current) { finRef.current += 500; return; }
            const q = Math.max(0, Math.ceil((finRef.current - Date.now()) / 1000));
            setRestante(q);
            if (q <= 0) terminar();
        }, 500);
        return () => clearInterval(t);
    }, [fase, minutos, pausa]); // eslint-disable-line react-hooks/exhaustive-deps

    const empezar = () => {
        const conEquipo = Object.values(jugadores).filter(j => j.team);
        if (!conEquipo.length) { alert('Pon al menos un jugador en un equipo (pulsa sobre su nombre).'); return; }
        if (fuente === 'recurso' && !preguntasRecurso.length) { alert('Elige un recurso con preguntas de opción múltiple.'); return; }
        despertarAudio();
        colaRef.current = [];
        setMarcador({ red: 0, blue: 0 });
        setStats({});
        setDuelo(null);
        setPausa(false);
        finRef.current = Date.now() + minutos * 60000;
        setRestante(minutos * 60);
        setFase('JUEGO');
    };

    // ── Vestíbulo: equipos ──
    const cambiarEquipo = (id) => setJugadores(j => ({ ...j, [id]: { ...j[id], team: j[id].team === null ? 'red' : j[id].team === 'red' ? 'blue' : null } }));
    const renombrar = (id, txt) => { setJugadores(j => ({ ...j, [id]: { ...j[id], nombre: txt } })); guardarNombre(id, txt); };
    const repartir = () => setJugadores(j => {
        const ids = barajar(Object.keys(j));
        return Object.fromEntries(ids.map((id, i) => [id, { ...j[id], team: i % 2 ? 'blue' : 'red' }]));
    });
    const lista = Object.values(jugadores).sort((a, b) => a.id - b.id);
    const columna = (team) => lista.filter(j => j.team === team);
    const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

    const chipJugador = (j) => (
        <div key={j.id} style={{ ...st.chip, borderColor: j.team ? EQUIPOS[j.team].c : '#475569' }}>
            <button style={st.chipEquipo(j.team)} title="Cambiar de equipo" onClick={() => cambiarEquipo(j.id)}>{j.id > 900 ? `V${j.id - 900}` : j.id}</button>
            <input value={j.nombre} onChange={e => renombrar(j.id, e.target.value)} onBlur={e => { if (!e.target.value.trim()) renombrar(j.id, nombrePorDefecto(j.id)); }} style={st.chipInput} />
        </div>
    );

    if (fase === 'EQUIPOS') {
        return (
            <div style={st.raiz}>
                <header style={st.cab}>
                    <button style={st.btnSec} onClick={onExit}>← Volver</button>
                    <h2 style={{ margin: 0, flex: 1 }}>⚽ Partido con mandos micro:bit</h2>
                    <ChipAntena />
                </header>
                <div style={st.scroll}>
                    {antena.antenaOk && antena.version < VERSION_PROGRAMAS && <p style={st.aviso}>⚠️ La antena tiene un programa antiguo: graba de nuevo la antena y los mandos (Programación y robótica → Mandos micro:bit) para jugar con los controles nuevos (inclinar para moverse). Mientras tanto se juega con los antiguos.</p>}
                    <div style={st.panel}>
                        <p style={{ margin: '0 0 8px', lineHeight: 1.5 }}>
                            {volante ? (
                                <>Cada mando es un jugador: <b>inclina el mando</b> para correr hacia ese lado de la pantalla (más inclinado, más rápido) ·
                                {' '}<b>A</b> pasa al compañero más cercano a la <b>izquierda</b> de hacia donde mira tu jugador · <b>B</b>, al de la <b>derecha</b> · <b>toca el logo</b> (o agita) para <b>chutar</b>.
                                {' '}Sin balón, A, B o el logo dan una arrancada.</>
                            ) : (
                                <>Cada mando es un jugador: <b>A</b> (mantener) corre · <b>B</b> gira a la derecha · <b>tocar el logo</b> gira a la izquierda ·
                                {' '}<b>agitar</b> tira a puerta (sin balón, arrancada) · <b>inclinar</b> pasa a un compañero de ese lado.</>
                            )}
                            Si un rival alcanza al que lleva el balón, ¡duelo de preguntas! El primero que acierta se queda el balón.
                        </p>
                        <p style={{ margin: 0, color: '#fde68a', fontWeight: 700 }}>🎮 Pulsad cualquier botón del mando para uniros. Pulsa el número de cada jugador para cambiarlo de equipo.</p>
                        <div style={{ marginTop: 10 }}><BotonTutorialMandos inicial="futbol" texto="📖 ¿Cómo se juega con el mando? (tutorial)" style={{ background: '#15803d', fontSize: 16, padding: '10px 18px' }} /></div>
                    </div>

                    <div style={st.columnas}>
                        {[null, 'red', 'blue'].map(team => (
                            <div key={String(team)} style={{ ...st.columna, borderColor: team ? EQUIPOS[team].c : '#334155' }}>
                                {team
                                    ? <input value={nombreEquipo[team]} onChange={e => setNombreEquipo(n => ({ ...n, [team]: e.target.value }))} style={{ ...st.tituloEquipo, color: EQUIPOS[team].c }} />
                                    : <div style={{ fontWeight: 800, marginBottom: 8 }}>Sin equipo</div>}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {(team ? columna(team) : lista.filter(j => !j.team)).map(chipJugador)}
                                    {!(team ? columna(team) : lista.filter(j => !j.team)).length && <div style={{ color: '#64748b', fontSize: 13 }}>—</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ ...st.fila, marginTop: 10 }}>
                        <button style={st.btnSec} onClick={repartir} disabled={!lista.length}>🎲 Repartir al azar</button>
                        <button style={st.btnSec} onClick={() => setJugadores({})} disabled={!lista.length}>🧹 Vaciar</button>
                        <button style={st.btnSec} onClick={() => setVirtuales(v => !v)}>🧪 Mandos virtuales</button>
                    </div>
                    {virtuales && <div style={{ ...st.panel, marginTop: 10 }}><MandosVirtuales ids={[901, 902, 903, 904]} volante={volante} /></div>}

                    <div style={{ ...st.panel, marginTop: 14 }}>
                        <div style={st.fila}>
                            <b>🏆 Goles para ganar:</b>
                            {[1, 2, 3, 5].map(n => <button key={n} style={st.opcion(golesParaGanar === n)} onClick={() => setGolesParaGanar(n)}>{n}</button>)}
                            <b style={{ marginLeft: 12 }}>⏱ Duración:</b>
                            {[[5, '5 min'], [10, '10 min'], [15, '15 min'], [0, 'Sin límite']].map(([v, t]) => <button key={v} style={st.opcion(minutos === v)} onClick={() => setMinutos(v)}>{t}</button>)}
                        </div>
                        <div style={{ ...st.fila, marginTop: 12 }}>
                            <b>❓ Preguntas de los duelos:</b>
                            {[['tablas', '✖️ Tablas'], ['sumas', '➕ Sumas y restas'], ['recurso', '📚 Recurso']].map(([k, t]) => <button key={k} style={st.opcion(fuente === k)} onClick={() => setFuente(k)}>{t}</button>)}
                        </div>
                        {fuente === 'recurso' && <>
                            <SelectorRecursoMandos seleccionado={recurso} onPick={(r) => { setRecurso(r); setHojaSel(-1); colaRef.current = []; }} />
                            {recurso && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 8 }}>
                                <b style={{ color: '#facc15' }}>✔ {recurso.titulo || 'Sin título'}</b>
                                <ElegirHoja hojas={hojasRecurso} valor={hojaSel} onChange={(h) => { setHojaSel(h); colaRef.current = []; }} />
                                <span style={{ color: '#facc15', fontWeight: 700 }}>{preguntasRecurso.length} preguntas</span>
                            </div>}
                        </>}
                    </div>
                    <button style={st.btnGrande} onClick={empezar}>⚽ ¡Al campo!</button>
                </div>
            </div>
        );
    }

    if (fase === 'FIN') {
        const ganador = marcador.red === marcador.blue ? null : marcador.red > marcador.blue ? 'red' : 'blue';
        const filas = Object.values(jugadores).filter(j => j.team).map(j => ({ ...j, goles: stats[j.id]?.goles || 0, duelos: stats[j.id]?.duelos || 0 }))
            .sort((a, b) => b.goles - a.goles || b.duelos - a.duelos);
        const color = ganador ? EQUIPOS[ganador].c : '#f1c40f';
        const totalEquipo = (team) => filas.filter(j => j.team === team).reduce((s, j) => s + j.duelos, 0);
        return (
            <div style={{ ...st.raiz, background: 'radial-gradient(circle at 50% 30%, #1e293b 0%, #0b1220 100%)' }}>
                <FondoCampeones color={color} />
                <div style={{ ...st.scroll, position: 'relative', zIndex: 2, maxWidth: 640 }}>
                    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                        <div style={{ fontSize: '3.5rem', animation: 'fqLatido 1s ease infinite' }}>{ganador ? '🏆' : '🤝'}</div>
                        <h1 style={{ margin: 0, color, fontSize: 'clamp(1.6rem, 6vw, 2.6rem)', fontWeight: 900, textShadow: '0 2px 14px rgba(0,0,0,0.6)' }}>
                            {ganador ? `¡${nombreEquipo[ganador]} CAMPEÓN!` : '¡Empate!'}
                        </h1>
                        {ganador && <VideoCampeones id="fm-champ-yt" />}
                        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                            {['red', 'blue'].map(team => (
                                <div key={team} style={{ flex: 1, minWidth: 130, background: team === ganador ? `${EQUIPOS[team].c}22` : 'rgba(255,255,255,0.05)', border: `2px solid ${team === ganador ? EQUIPOS[team].c : 'rgba(255,255,255,0.12)'}`, borderRadius: 14, padding: '12px 14px' }}>
                                    <div style={{ fontWeight: 800, color: EQUIPOS[team].c, marginBottom: 4 }}>{team === ganador ? '🏆 ' : ''}{nombreEquipo[team]}</div>
                                    <div style={{ fontSize: '2.2rem', fontWeight: 900, lineHeight: 1 }}>{marcador[team]}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: 6 }}>⚽ goles · 🧠 {totalEquipo(team)} duelos ganados</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div style={{ ...st.panel, marginTop: 14 }}>
                        <h3 style={{ marginTop: 0 }}>⭐ Jugadores</h3>
                        {filas.map(j => (
                            <div key={j.id} style={st.filaRank}>
                                <span style={{ ...st.punto, background: EQUIPOS[j.team].c }} />
                                <span style={{ flex: 1 }}>{j.nombre}</span>
                                <span>⚽ {j.goles}</span>
                                <span style={{ marginLeft: 14 }}>🧠 {j.duelos} duelos</span>
                            </div>
                        ))}
                    </div>
                    <div style={{ ...st.fila, justifyContent: 'center', marginTop: 16 }}>
                        <GuardarResultadosMandos
                            tipo="FUTBOL_MANDOS"
                            juego="Fútbol 3D con mandos"
                            recursoTitulo={fuente === 'recurso' ? recurso?.titulo || 'Recurso' : fuente === 'sumas' ? 'Sumas y restas' : 'Tablas de multiplicar'}
                            hoja={fuente === 'recurso' && hojaSel >= 0 ? hojasRecurso[hojaSel]?.nombre || '' : ''}
                            config={{ marcador: `${marcador.red}-${marcador.blue}` }}
                            jugadores={filas.map(j => ({
                                id: j.id, nombre: j.nombre, aciertos: stats[j.id]?.aciertos || 0, intentos: stats[j.id]?.jugados || 0,
                                extra: { goles: j.goles, duelosGanados: j.duelos, equipo: nombreEquipo[j.team] || j.team },
                            }))}
                        />
                        <button style={st.btnGrande} onClick={() => setFase('EQUIPOS')}>🔁 Otro partido</button>
                        <button style={st.btnSec} onClick={onExit}>← Salir</button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Partido ──
    const dA = duelo && jugadores[duelo.a], dB = duelo && jugadores[duelo.b];
    const quedaDuelo = duelo && !duelo.cerrado ? Math.max(0, Math.ceil((duelo.fin - Date.now()) / 1000)) : 0;
    const preparando = duelo && !duelo.cerrado && !duelo.abierto;
    const quedaPrepara = preparando ? Math.max(1, Math.ceil((duelo.abre - Date.now()) / 1000)) : 0;
    const estadoDuelista = (id) => {
        if (!duelo) return '';
        if (duelo.cerrado && duelo.ganador === id) return '🏆 ¡Se queda el balón!';
        if (preparando) return '✋ suelta el mando y lee';
        const r = duelo.resp[id];
        if (!r) return duelo.cerrado ? '—' : '⏳ pensando…';
        if (!duelo.cerrado) return '✅ ha respondido';
        return LETRAS.indexOf(r) === duelo.q.correcta ? `✔ ${r}` : `✘ ${r}`;
    };
    return (
        <div style={{ ...st.raiz, background: '#0f172a' }}>
            <div style={st.hud}>
                <button style={st.btnSec} onClick={() => { if (window.confirm('¿Terminar el partido?')) terminar(); }}>⏹</button>
                <div style={st.marcador}>
                    <span style={{ color: '#fecaca' }}>{nombreEquipo.red}</span>
                    <b style={{ ...st.goles, background: EQUIPOS.red.c }}>{marcador.red}</b>
                    <b style={{ ...st.goles, background: EQUIPOS.blue.c }}>{marcador.blue}</b>
                    <span style={{ color: '#bfdbfe' }}>{nombreEquipo.blue}</span>
                </div>
                {minutos > 0 && <span style={{ fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>⏱ {mmss(restante)}</span>}
                <button style={st.btnSec} onClick={() => setPausa(p => !p)}>{pausa ? '▶' : '⏸'}</button>
                <ChipAntena />
                <button style={st.btnSec} onClick={() => setVirtuales(v => !v)}>🧪</button>
                <BotonTutorialMandos inicial="futbol" texto="📖" style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.25)', padding: '7px 12px' }} />
            </div>
            <div ref={hostRef} style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                {aviso && <div style={st.aviso3d}>{aviso}</div>}
                {pausa && <div style={st.aviso3d}>⏸ Pausa</div>}
                {duelo && (
                    <div style={st.duelo}>
                        <div style={{ textAlign: 'center', fontWeight: 900, color: '#fde68a', fontSize: 'clamp(16px,2vw,22px)' }}>⚔️ ¡DUELO! {!duelo.cerrado && !preparando && `· ⏱ ${quedaDuelo}`}</div>
                        {preparando && (
                            <div style={st.preparados}>
                                ✋ ¡Preparados! Soltad el mando y leed la pregunta… <b style={{ fontSize: '1.4em', color: '#fff' }}>{quedaPrepara}</b>
                            </div>
                        )}
                        {duelo.abierto && !duelo.cerrado && Date.now() - duelo.abre < 1500 && (
                            <div style={{ ...st.preparados, background: '#16a34a', color: '#fff' }}>🟢 ¡YA! Elegid la letra con A y enviadla con B</div>
                        )}
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', margin: '6px 0' }}>
                            {[[duelo.a, dA], [duelo.b, dB]].map(([id, j]) => (
                                <div key={id} style={{ ...st.duelista, borderColor: j?.team ? EQUIPOS[j.team].c : '#fff', background: duelo.ganador === id ? 'rgba(34,197,94,.35)' : 'rgba(15,23,42,.8)' }}>
                                    <b>{j?.nombre || nombrePorDefecto(id)}</b>
                                    <span style={{ fontSize: 14 }}>{estadoDuelista(id)}</span>
                                    {id > 900 && duelo.abierto && !duelo.cerrado && !duelo.resp[id] && (
                                        <span style={{ display: 'flex', gap: 3 }}>{duelo.q.opciones.map((_, i) => <button key={i} style={st.mini} onClick={() => responderDuelo(id, LETRAS[i])}>{LETRAS[i]}</button>)}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div style={st.preguntaDuelo}>{duelo.q.texto}</div>
                        <div style={st.opcionesDuelo}>
                            {duelo.q.opciones.map((o, i) => (
                                <div key={i} style={{ ...st.opcionDuelo, opacity: duelo.cerrado && i !== duelo.q.correcta ? 0.35 : 1, borderColor: duelo.cerrado && i === duelo.q.correcta ? '#4ade80' : 'transparent' }}>
                                    <b style={st.letra}>{LETRAS[i]}</b> {o}
                                </div>
                            ))}
                        </div>
                        <div style={{ textAlign: 'center', fontSize: 13, color: '#cbd5e1', marginTop: 6 }}>Con el mando: A cambia la letra · B la envía · el primero que acierta se queda el balón</div>
                    </div>
                )}
                {virtuales && (
                    <div style={st.virtualesJuego}>
                        <MandosVirtuales ids={Object.values(jugadores).filter(j => j.team && j.id > 900).map(j => j.id)} volante={volante} />
                        {!Object.values(jugadores).some(j => j.team && j.id > 900) && <span style={{ fontSize: 12 }}>No hay mandos virtuales en ningún equipo.</span>}
                    </div>
                )}
            </div>
        </div>
    );
}

const st = {
    raiz: { position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', background: 'linear-gradient(160deg,#064e3b 0%,#0f172a 70%)', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif' },
    cab: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: 'rgba(0,0,0,.35)', flexWrap: 'wrap' },
    scroll: { flex: 1, overflow: 'auto', padding: 16, maxWidth: 1100, width: '100%', margin: '0 auto', boxSizing: 'border-box' },
    panel: { background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 16, padding: 16 },
    aviso: { color: '#fde68a', fontWeight: 700, margin: '0 0 10px' },
    pill: { color: '#fff', fontWeight: 800, fontSize: 13, padding: '5px 12px', borderRadius: 99 },
    fila: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
    columnas: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12, marginTop: 14 },
    columna: { background: 'rgba(15,23,42,.6)', border: '2px solid', borderRadius: 16, padding: 12, minHeight: 120 },
    tituloEquipo: { width: '100%', boxSizing: 'border-box', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,.2)', fontWeight: 900, fontSize: 18, marginBottom: 8, fontFamily: 'inherit' },
    chip: { display: 'flex', alignItems: 'center', gap: 6, border: '2px solid', borderRadius: 99, padding: 3, background: 'rgba(0,0,0,.25)' },
    chipEquipo: (team) => ({ minWidth: 40, height: 30, borderRadius: 99, border: 'none', background: team ? EQUIPOS[team].c : '#475569', color: '#fff', fontWeight: 900, cursor: 'pointer' }),
    chipInput: { flex: 1, minWidth: 0, background: 'transparent', border: 'none', color: '#fff', fontWeight: 700, fontSize: 15, fontFamily: 'inherit' },
    opcion: (on) => ({ padding: '7px 13px', borderRadius: 10, border: on ? '2px solid #facc15' : '1px solid rgba(255,255,255,.25)', background: on ? 'rgba(250,204,21,.2)' : 'transparent', color: '#fff', fontWeight: 800, cursor: 'pointer' }),
    btnSec: { background: 'rgba(255,255,255,.1)', color: '#fff', border: '1px solid rgba(255,255,255,.25)', borderRadius: 10, padding: '7px 12px', fontWeight: 700, cursor: 'pointer' },
    btnGrande: { marginTop: 16, background: 'linear-gradient(180deg,#22c55e,#15803d)', color: '#fff', border: 'none', borderRadius: 14, padding: '14px 30px', fontSize: 19, fontWeight: 900, cursor: 'pointer' },
    mini: { padding: '5px 9px', borderRadius: 8, border: 'none', background: '#334155', color: '#fff', fontWeight: 800, cursor: 'pointer', touchAction: 'none' },
    hud: { display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', background: 'rgba(0,0,0,.6)', flexWrap: 'wrap', zIndex: 2 },
    marcador: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontWeight: 800, fontSize: 'clamp(14px,1.8vw,20px)' },
    goles: { minWidth: 44, textAlign: 'center', padding: '2px 10px', borderRadius: 10, fontSize: 'clamp(20px,2.6vw,30px)', color: '#fff' },
    aviso3d: { position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 3, background: 'rgba(0,0,0,.7)', padding: '10px 22px', borderRadius: 14, fontSize: 'clamp(18px,2.6vw,32px)', fontWeight: 900, pointerEvents: 'none', textAlign: 'center' },
    preparados: { textAlign: 'center', fontWeight: 900, fontSize: 'clamp(15px,1.8vw,20px)', color: '#1e293b', background: '#facc15', borderRadius: 10, padding: '6px 10px', margin: '6px auto 0', maxWidth: 620 },
    duelo: { position: 'absolute', left: '50%', bottom: 16, transform: 'translateX(-50%)', width: 'min(900px, calc(100% - 24px))', zIndex: 4, background: 'rgba(15,23,42,.92)', border: '2px solid #facc15', borderRadius: 18, padding: '12px 16px', boxSizing: 'border-box' },
    duelista: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, border: '3px solid', borderRadius: 14, padding: '6px 14px', minWidth: 170 },
    preguntaDuelo: { textAlign: 'center', fontSize: 'clamp(22px,3vw,38px)', fontWeight: 900, margin: '4px 0 8px' },
    opcionesDuelo: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 8 },
    opcionDuelo: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 12, background: 'rgba(91,33,182,.6)', border: '3px solid', fontWeight: 800, fontSize: 'clamp(16px,2vw,24px)' },
    letra: { width: 32, height: 32, borderRadius: 99, background: '#facc15', color: '#1e293b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    virtualesJuego: { position: 'absolute', right: 10, top: 10, zIndex: 3, background: 'rgba(15,23,42,.88)', padding: 10, borderRadius: 12, maxWidth: 'calc(100% - 20px)' },
    filaRank: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 4px', borderBottom: '1px solid rgba(255,255,255,.12)' },
    punto: { width: 14, height: 14, borderRadius: 99, flexShrink: 0 },
};
