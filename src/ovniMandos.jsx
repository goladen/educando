// Mandos micro:bit en Ovni Abducción: qué mandos hay, sus nombres y quién pilota cada nave.
//
// - Con programas v6 (modo V «volante») el ovni se mueve mientras el mando sigue inclinado.
//   Con placas v5 se usa el modo F de fútbol: cada inclinación da un empujón (motor.impulso).
// - Los nombres de los mandos son los mismos que en el resto de juegos (pikt_mandos_nombres).
// - Pilotos: un id de mando por nave o null = automático (lo coge el primer mando que se mueva
//   durante la partida). Se pueden cambiar en el menú, en mitad de la partida o por turnos.
import { useEffect, useRef, useState } from 'react';
import { MODOS, VERSION_VOLANTE, setModoMandos, escucharMandos, escucharEstadoAntena } from './mandos/mandosMicrobit.js';
import ChipAntena from './mandos/ChipAntena.jsx';
import { BotonTutorialMandos } from './mandos/TutorialMandos.jsx';

const LS_NOMBRES = 'pikt_mandos_nombres';
const leerNombres = () => { try { return JSON.parse(localStorage.getItem(LS_NOMBRES) || '{}') || {}; } catch { return {}; } };

// señal de que el alumno quiere jugar (soltar un botón o volver a plano no cuentan)
const esIntencion = (ev) => (ev.accion === 'V' ? !!ev.dir : ev.accion === 'P' || ev.accion === 'S' || ev.on === true);

export function useMandosOvni(activos, nJug) {
    const [vistos, setVistos] = useState({}); // id → última señal (ms)
    const vistosRef = useRef({});
    const [nombres, setNombres] = useState(leerNombres);
    const [pilotos, setPilotosEstado] = useState([null, null]);
    const pilotosRef = useRef([null, null]);
    const manejadorRef = useRef(null); // (idx, ev) → lo pone el juego mientras está en marcha
    const nJugRef = useRef(nJug);
    nJugRef.current = nJug;
    const [version, setVersion] = useState(0);

    const setPilotos = (n) => { pilotosRef.current = n; setPilotosEstado(n); };
    const setPiloto = (i, id) => {
        const n = [...pilotosRef.current];
        const otro = n.indexOf(id);
        if (id != null && otro >= 0 && otro !== i) n[otro] = n[i]; // si la otra nave lo tenía, se intercambian
        n[i] = id;
        setPilotos(n);
    };
    const nombreDe = (id) => (id == null ? null : nombres[id]?.trim() || `Mando ${id}`);
    const setNombre = (id, txt) => setNombres(ns => {
        const n = { ...ns, [id]: txt };
        try { localStorage.setItem(LS_NOMBRES, JSON.stringify(n)); } catch { /* sin localStorage */ }
        return n;
    });

    // siguiente mando (por número) para la nave i, sin quitarle el suyo a la otra nave
    const siguienteDe = (n, i) => {
        const ids = Object.keys(vistosRef.current).map(Number).sort((a, b) => a - b);
        const libres = ids.filter(id => !n.some((p, k) => k !== i && k < nJugRef.current && p === id));
        if (!libres.length) return n[i];
        return n[i] == null ? libres[0] : (libres.find(id => id > n[i]) ?? libres[0]);
    };
    const siguientePiloto = (i) => { const n = [...pilotosRef.current]; n[i] = siguienteDe(n, i); setPilotos(n); return n; };
    const rotarPilotos = () => {
        const n = [...pilotosRef.current];
        for (let i = 0; i < nJugRef.current; i++) n[i] = siguienteDe(n, i);
        setPilotos(n);
        return n;
    };

    useEffect(() => {
        if (!activos) return undefined;
        return escucharEstadoAntena(e => setVersion(e.antenaOk ? e.version : 0));
    }, [activos]);
    const continuo = version >= VERSION_VOLANTE;

    useEffect(() => {
        if (!activos) return undefined;
        setModoMandos(continuo ? MODOS.VOLANTE : MODOS.FUTBOL);
        return () => setModoMandos(MODOS.LETRAS);
    }, [activos, continuo]);

    useEffect(() => {
        if (!activos) return undefined;
        return escucharMandos((ev) => {
            if (ev.tipo !== 'futbol') return;
            const ahora = Date.now();
            const antes = vistosRef.current[ev.id];
            vistosRef.current = { ...vistosRef.current, [ev.id]: ahora };
            if (!antes || ahora - antes > 1000) setVistos(vistosRef.current);
            const juego = manejadorRef.current;
            if (!juego) return;
            const activas = pilotosRef.current.slice(0, nJugRef.current);
            let idx = activas.indexOf(ev.id);
            if (idx < 0) {
                const hueco = activas.indexOf(null);
                if (hueco < 0 || !esIntencion(ev)) return;
                const n = [...pilotosRef.current];
                n[hueco] = ev.id;
                setPilotos(n);
                idx = hueco;
            }
            juego(idx, ev);
        });
    }, [activos]);

    return { vistos, nombres, nombreDe, setNombre, pilotos, setPiloto, siguientePiloto, rotarPilotos, manejadorRef, continuo, version };
}

const COLOR_MANDOS = '#facc15';
const st = {
    select: { background: '#0f172a', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, padding: '6px 8px', fontSize: '0.85rem', maxWidth: '100%' },
    input: { background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '4px 8px', fontSize: '0.85rem', width: 120 },
};

/** Desplegable «quién pilota la nave i». */
export function ElegirPiloto({ ctrl, i, color, auto = true, onElegido }) {
    const ids = Object.keys(ctrl.vistos).map(Number).sort((a, b) => a - b);
    const actual = ctrl.pilotos[i];
    if (actual != null && !ids.includes(actual)) ids.push(actual);
    return (
        <select value={actual ?? ''} onChange={e => { ctrl.setPiloto(i, e.target.value === '' ? null : Number(e.target.value)); onElegido?.(); }}
            style={{ ...st.select, borderColor: color || st.select.border }}>
            {auto && <option value="">✨ Automático (el primero que se mueva)</option>}
            {ids.map(id => <option key={id} value={id}>🎮 {ctrl.nombreDe(id)}{ctrl.nombres[id]?.trim() ? ` (${id})` : ''}</option>)}
        </select>
    );
}

/** Panel del menú: antena, mandos detectados con su nombre, pilotos y opciones. */
export function PanelMandosOvni({ ctrl, duo, colores, invertir, onInvertir, turnos, onTurnos }) {
    const [, setTick] = useState(0); // para apagar el punto verde de los mandos que dejan de moverse
    useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 2000); return () => clearInterval(t); }, []);
    const ids = Object.keys(ctrl.vistos).map(Number).sort((a, b) => a - b);
    const ahora = Date.now();
    return (
        <div style={{ marginTop: 14, border: `1px solid ${COLOR_MANDOS}66`, background: 'rgba(250,204,21,0.06)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <ChipAntena />
                <BotonTutorialMandos inicial={ctrl.continuo ? 'ovni' : 'futbol'} texto="📖 Cómo se usa el mando" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', padding: '7px 12px' }} />
            </div>

            <div style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>
                {ctrl.continuo
                    ? <>Mientras el mando esté <b>inclinado</b>, el ovni avanza hacia ese lado (también en diagonal); ponlo plano para pararlo. <b>Agita</b> o pulsa <b>A</b> para abducir.</>
                    : <><b>Inclina</b> el mando y el ovni da un empujón hacia ese lado (ponlo plano e inclina otra vez para seguir). <b>Agita</b> o pulsa <b>A</b> para abducir.</>}
            </div>
            {ctrl.version > 0 && !ctrl.continuo && (
                <div style={{ fontSize: '0.8rem', color: '#fde68a', background: 'rgba(250,204,21,0.1)', borderRadius: 8, padding: '6px 10px' }}>
                    💡 Para que el ovni siga moviéndose <b>mientras</b> el mando está inclinado, regraba la antena y los mandos con la versión nueva (v{VERSION_VOLANTE}) en Programación y robótica → 🎮 Mandos micro:bit.
                </div>
            )}

            <div>
                <div style={{ fontSize: '0.78rem', color: '#fde68a', fontWeight: 800, letterSpacing: 0.5, marginBottom: 6 }}>MANDOS CONECTADOS</div>
                {!ids.length ? (
                    <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Mueve o agita cada mando para que aparezca aquí.</div>
                ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {ids.map(id => {
                            const vivo = ahora - ctrl.vistos[id] < 4000;
                            const nave = ctrl.pilotos.slice(0, duo ? 2 : 1).indexOf(id);
                            return (
                                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(15,23,42,0.7)', border: `1px solid ${nave >= 0 ? colores[nave] : 'rgba(255,255,255,0.15)'}`, borderRadius: 10, padding: '5px 8px' }}>
                                    <span title={vivo ? 'Se está moviendo' : 'Sin señal hace un rato'} style={{ width: 9, height: 9, borderRadius: '50%', background: vivo ? '#4ade80' : '#475569', boxShadow: vivo ? '0 0 8px #4ade80' : 'none' }} />
                                    <b style={{ color: '#fff', fontSize: '0.85rem' }}>🎮 {id}</b>
                                    <input value={ctrl.nombres[id] || ''} onChange={e => ctrl.setNombre(id, e.target.value)} placeholder="Nombre" maxLength={20} style={st.input} />
                                    {nave >= 0 && <span style={{ fontSize: '0.75rem', color: colores[nave], fontWeight: 800 }}>🛸{duo ? nave + 1 : ''}</span>}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                {(duo ? [0, 1] : [0]).map(i => (
                    <label key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.85rem', color: duo ? colores[i] : '#e2e8f0', fontWeight: 700 }}>
                        {duo ? `🛸 Nave ${i + 1}:` : '🛸 Pilota:'}
                        <ElegirPiloto ctrl={ctrl} i={i} color={duo ? colores[i] : undefined} />
                    </label>
                ))}
            </div>

            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.82rem', color: '#cbd5e1', cursor: 'pointer' }}>
                <input type="checkbox" checked={turnos} onChange={e => onTurnos(e.target.checked)} />
                🔄 Turnos: en cada ronda pilota el siguiente mando
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.82rem', color: '#cbd5e1', cursor: 'pointer' }}>
                <input type="checkbox" checked={invertir} onChange={e => onInvertir(e.target.checked)} />
                ↕ Invertir delante/detrás (si al inclinar hacia delante el ovni va hacia atrás)
            </label>
        </div>
    );
}

/** En la partida: quién pilota la nave i + cambiarlo (desplegable o ⏭ siguiente). */
export function PilotoEnJuego({ ctrl, i, color }) {
    const [abierto, setAbierto] = useState(false);
    const nombre = ctrl.nombreDe(ctrl.pilotos[i]);
    return (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', pointerEvents: 'auto' }}>
            {abierto ? (
                <ElegirPiloto ctrl={ctrl} i={i} color={color} onElegido={() => setAbierto(false)} />
            ) : (
                <button onClick={() => setAbierto(true)} title="Cambiar quién pilota"
                    style={{ background: 'rgba(10,15,36,0.8)', color, border: `1px solid ${color}`, borderRadius: 8, padding: '5px 10px', fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem' }}>
                    🎮 {nombre || 'Mueve un mando'} ▾
                </button>
            )}
            <button onClick={() => { ctrl.siguientePiloto(i); setAbierto(false); }} title="Pasar el mando al siguiente"
                style={{ background: 'rgba(10,15,36,0.8)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, padding: '5px 8px', cursor: 'pointer', fontSize: '0.85rem' }}>⏭</button>
            {abierto && <button onClick={() => setAbierto(false)} style={{ background: 'transparent', color: '#94a3b8', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>✓</button>}
        </div>
    );
}
