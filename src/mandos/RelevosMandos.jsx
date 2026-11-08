// Mandos micro:bit «por relevos» en cualquier juego (generaliza lo del Ovni: useMandosOvni).
//
//   <MandosEnJuego clave="PONG" juego="Pong" tipo="ARKADE_MANDOS" nJug={2}
//       teclas={[MAPA_1, MAPA_2]}   // mando → teclas del juego (puente de teclado)
//       cursor                       // o bien: una mira por mando que se mueve inclinando y A = clic
//       onEvento={(i, ev, id) => …}  // o bien: eventos crudos (letras, número, abecedario…)
//       apiRef={ref} />             // ref.current.finPartida([puntos J1, puntos J2], {ganador})
//
// - Cada «hueco» (jugador i) lo maneja un mando: el primero que se mueve o el que se elija.
// - 🔄 Relevos: al acabar cada partida (finPartida) el hueco pasa al siguiente mando, así toda
//   la clase va jugando por turnos. El marcador guarda partidas y puntos de cada mando y se
//   puede guardar en los informes con el código del profesor.
// - Las placas son las de siempre (multifunción): modo V volante con v6+, F con v5.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMandosOvni, ElegirPiloto, PilotoEnJuego } from '../ovniMandos.jsx';
import ChipAntena from './ChipAntena.jsx';
import { BotonTutorialMandos } from './TutorialMandos.jsx';
import GuardarResultadosMandos from './GuardarResultadosMandos.jsx';

export const COLORES_HUECO = ['#22d3ee', '#f472b6', '#facc15', '#4ade80'];

const leer = (k, def) => { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch { return def; } };
const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

/* ───────────────────────── Teclado virtual ───────────────────────── */

const CODIGOS = { ' ': 'Space', Enter: 'Enter', Escape: 'Escape', Backspace: 'Backspace', Shift: 'ShiftLeft' };
const KEYCODES = { ' ': 32, Enter: 13, Escape: 27, Backspace: 8, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 };
const codeDe = (k) => CODIGOS[k] || (k.length === 1 ? (/[a-z]/i.test(k) ? 'Key' + k.toUpperCase() : /\d/.test(k) ? 'Digit' + k : k) : k);

/** Lanza un keydown/keyup sintético que reciben los listeners de window/document. */
export function pulsarTecla(tipo, key) {
    if (typeof document === 'undefined') return;
    const ev = new KeyboardEvent(tipo, { key, code: codeDe(key), bubbles: true, cancelable: true });
    const kc = KEYCODES[key] ?? (key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0);
    try {
        Object.defineProperty(ev, 'keyCode', { get: () => kc });
        Object.defineProperty(ev, 'which', { get: () => kc });
    } catch { /* navegador sin defineProperty en eventos */ }
    ev.piktMando = true;
    (document.activeElement || document.body || document).dispatchEvent(ev);
}
export const tocarTecla = (key, ms = 90) => { pulsarTecla('keydown', key); setTimeout(() => pulsarTecla('keyup', key), ms); };

const CADUCA_V = 1200;   // sin latido de inclinación → plano
const CADUCA_BOTON = 1300; // sin latido de un botón → suelto
const PULSO_F = 450;     // modo F (v5): cada inclinación = tecla pulsada este tiempo
const PULSO_AGITAR = 150;

/**
 * Puente mando → teclas. mapa: { I, D, F, T (inclinar izq/dcha/delante/detrás), A, B, L (logo), S (agitar),
 * repetir: ms o { tecla: ms } (vuelve a mandar keydown mientras se mantiene, p. ej. Tetris) }.
 */
function crearPuente(getMapa, getInvertir) {
    const huecos = {}; // i → { fuentes: Map(fuente → {key, hasta}), abajo: Map(key → últimoEnvío) }
    const h = (i) => (huecos[i] ||= { fuentes: new Map(), abajo: new Map() });
    const sincronizar = (i) => {
        const s = h(i);
        const ahora = Date.now();
        const quiero = new Set();
        for (const [f, v] of s.fuentes) {
            if (v.hasta && v.hasta < ahora) s.fuentes.delete(f);
            else if (v.key) quiero.add(v.key);
        }
        for (const k of [...s.abajo.keys()]) if (!quiero.has(k)) { s.abajo.delete(k); pulsarTecla('keyup', k); }
        const r = getMapa(i)?.repetir;
        for (const k of quiero) {
            const rep = r && typeof r === 'object' ? r[k] : r;
            const ult = s.abajo.get(k);
            if (ult == null) { s.abajo.set(k, ahora); pulsarTecla('keydown', k); }
            else if (rep && ahora - ult >= rep) { s.abajo.set(k, ahora); pulsarTecla('keydown', k); }
        }
    };
    const invertirFT = (d) => (getInvertir() ? d.replace(/[FT]/g, (c) => (c === 'F' ? 'T' : 'F')) : d);
    const evento = (i, ev) => {
        const mapa = getMapa(i);
        if (!mapa || ev.tipo !== 'futbol') return;
        const s = h(i);
        const ahora = Date.now();
        if (ev.accion === 'V') {
            const dir = invertirFT(ev.dir || '');
            for (const d of ['I', 'D', 'F', 'T']) {
                if (dir.includes(d) && mapa[d]) s.fuentes.set('v' + d, { key: mapa[d], hasta: ahora + CADUCA_V });
                else s.fuentes.delete('v' + d);
            }
        } else if (ev.accion === 'P') {
            const d = invertirFT(ev.dir || '');
            if (mapa[d]) s.fuentes.set('p' + d, { key: mapa[d], hasta: ahora + PULSO_F });
        } else if (ev.accion === 'S') {
            if (mapa.S) s.fuentes.set('S', { key: mapa.S, hasta: ahora + PULSO_AGITAR });
        } else if (mapa[ev.accion]) {
            if (ev.on) s.fuentes.set('b' + ev.accion, { key: mapa[ev.accion], hasta: ahora + CADUCA_BOTON });
            else s.fuentes.delete('b' + ev.accion);
        }
        sincronizar(i);
    };
    const tick = () => Object.keys(huecos).forEach((i) => sincronizar(i));
    const soltar = (i) => { if (huecos[i]) { huecos[i].fuentes.clear(); sincronizar(i); } };
    const soltarTodo = () => Object.keys(huecos).forEach(soltar);
    return { evento, tick, soltar, soltarTodo };
}

/* ───────────────────────── Miras (cursor virtual) ───────────────────────── */

const VEL_MIRA = 700; // px/s con el mando del todo inclinado

function crearMiras(getInvertir, onClic) {
    const m = {}; // i → { x, y, vx, vy, t, a }
    const de = (i) => (m[i] ||= { x: window.innerWidth * (0.35 + 0.3 * (i % 2)), y: window.innerHeight * 0.55, vx: 0, vy: 0, t: 0, a: false });
    const clicEn = (i) => {
        const s = de(i);
        const el = document.elementFromPoint(s.x, s.y);
        if (!el) return;
        const base = { bubbles: true, cancelable: true, clientX: s.x, clientY: s.y, button: 0 };
        // piktMira = qué mando ha hecho el clic (los juegos con varios jugadores lo usan para repartir puntos)
        try { const pe = new PointerEvent('pointerdown', { ...base, pointerType: 'mouse', isPrimary: true }); pe.piktMira = i; el.dispatchEvent(pe); } catch { /* sin PointerEvent */ }
        el.dispatchEvent(new MouseEvent('mousedown', base));
        try { el.dispatchEvent(new PointerEvent('pointerup', { ...base, pointerType: 'mouse', isPrimary: true })); } catch { /* sin PointerEvent */ }
        el.dispatchEvent(new MouseEvent('mouseup', base));
        el.dispatchEvent(new MouseEvent('click', base));
        onClic?.(i, el, s.x, s.y);
    };
    const evento = (i, ev) => {
        if (ev.tipo !== 'futbol') return;
        const s = de(i);
        const ahora = Date.now();
        const inv = getInvertir() ? -1 : 1;
        if (ev.accion === 'V') {
            const d = ev.dir || '';
            if (ev.x != null && ev.y != null) { s.vx = ev.x / 100; s.vy = (-ev.y / 100) * inv; }
            else {
                s.vx = d.includes('D') ? 1 : d.includes('I') ? -1 : 0;
                s.vy = (d.includes('F') ? -1 : d.includes('T') ? 1 : 0) * inv;
            }
            s.t = ahora;
        } else if (ev.accion === 'P') {
            const d = ev.dir;
            const paso = 90;
            if (d === 'I') s.x -= paso; else if (d === 'D') s.x += paso;
            else if (d === 'F') s.y -= paso * inv; else if (d === 'T') s.y += paso * inv;
        } else if (ev.accion === 'S') clicEn(i);
        else if (ev.accion === 'A' || ev.accion === 'B') {
            if (ev.on && !s.a) clicEn(i); // solo el flanco de subida (el latido repite on)
            s.a = !!ev.on;
        }
    };
    const avanzar = (dt) => {
        const ahora = Date.now();
        for (const s of Object.values(m)) {
            if (ahora - s.t > CADUCA_V) { s.vx = 0; s.vy = 0; }
            s.x = Math.max(4, Math.min(window.innerWidth - 4, s.x + s.vx * VEL_MIRA * dt));
            s.y = Math.max(4, Math.min(window.innerHeight - 4, s.y + s.vy * VEL_MIRA * dt));
        }
    };
    return { m, evento, avanzar, de };
}

function Miras({ miras, n, colores, etiquetas }) {
    const refs = useRef([]);
    useEffect(() => {
        let raf; let t0 = performance.now();
        const bucle = (t) => {
            miras.avanzar(Math.max(0, Math.min(0.05, (t - t0) / 1000))); t0 = t;
            for (let i = 0; i < n; i++) {
                const s = miras.de(i); const el = refs.current[i];
                if (el) el.style.transform = `translate(${s.x - 22}px, ${s.y - 22}px)`;
            }
            raf = requestAnimationFrame(bucle);
        };
        raf = requestAnimationFrame(bucle);
        return () => cancelAnimationFrame(raf);
    }, [miras, n]);
    return Array.from({ length: n }, (_, i) => (
        <div key={i} ref={(el) => { refs.current[i] = el; }} style={{ position: 'fixed', left: 0, top: 0, width: 44, height: 44, pointerEvents: 'none', zIndex: 2147483000 }}>
            <svg width="44" height="44" viewBox="0 0 44 44" style={{ filter: `drop-shadow(0 0 6px ${colores[i]})` }}>
                <circle cx="22" cy="22" r="15" fill="none" stroke={colores[i]} strokeWidth="3.5" />
                <circle cx="22" cy="22" r="3" fill={colores[i]} />
                {[[22, 0, 22, 9], [22, 35, 22, 44], [0, 22, 9, 22], [35, 22, 44, 22]].map((l, k) => <line key={k} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} stroke={colores[i]} strokeWidth="3" />)}
            </svg>
            {etiquetas[i] && <div style={{ position: 'absolute', top: 44, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', background: 'rgba(0,0,0,0.65)', color: colores[i], fontWeight: 800, fontSize: 12, padding: '1px 6px', borderRadius: 6 }}>{etiquetas[i]}</div>}
        </div>
    ));
}

/* ───────────────────────── Componente principal ───────────────────────── */

const st = {
    flot: { position: 'fixed', left: 10, bottom: 10, zIndex: 2147482000, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', maxWidth: 'calc(100vw - 20px)', fontFamily: 'system-ui, sans-serif' },
    boton: { background: 'rgba(10,15,36,0.85)', color: '#facc15', border: '1px solid #facc1588', borderRadius: 10, padding: '6px 11px', fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem' },
    fondo: { position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.72)', zIndex: 2147482500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: 'system-ui, sans-serif' },
    caja: { background: '#0f172a', color: '#e2e8f0', border: '1px solid #facc1566', borderRadius: 16, padding: 18, width: 'min(620px, 100%)', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 },
    input: { background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '4px 8px', fontSize: '0.85rem', width: 110 },
    th: { textAlign: 'left', padding: '4px 6px', color: '#fde68a', fontSize: '0.75rem' },
    td: { padding: '4px 6px', fontSize: '0.85rem', borderTop: '1px solid rgba(255,255,255,0.08)' },
};

const aceptaFutbolSiempre = (ev) => ev.tipo === 'futbol';

// Marcador y pilotos de cada juego durante la sesión (sobreviven a que el juego cambie de pantalla o se cierre)
const memoria = {};

export default function MandosEnJuego({
    clave, juego, tipo = 'ARCADE_MANDOS', nJug: nJugFijo = 1, maxJug = null, modo = null, acepta = null,
    teclas = null, cursor = false, onEvento = null, onClicMira = null, apiRef = null,
    controles = 'Inclina el mando para moverte; A (o agitar) para la acción.',
    tutorial = null, nombresHueco = null, colores = COLORES_HUECO, relevosPorDefecto = true,
    recursoTitulo = '', hoja = '', config = null, estiloFlot = null, pausado = false,
}) {
    const lsOn = `pikt_relevos_${clave}`;
    // maxJug: el profe elige en el panel cuántos juegan a la vez (1…maxJug)
    const [nElegido, setNElegido] = useState(() => Math.max(1, Math.min(maxJug || 1, Number(leer(`${lsOn}_n`, 1)) || 1)));
    const nJug = maxJug ? nElegido : nJugFijo;
    const [activos, setActivos] = useState(() => !!leer(lsOn, false));
    const [abierto, setAbierto] = useState(false);
    const [relevos, setRelevos] = useState(() => leer(`${lsOn}_turnos`, relevosPorDefecto));
    const [invertir, setInvertir] = useState(() => !!leer('pikt_relevos_invertir', false));
    const [marcador, setMarcadorEstado] = useState(() => memoria[clave]?.marcador || {}); // id → { partidas, puntos, mejor, aciertos, intentos }
    const setMarcador = useCallback((f) => setMarcadorEstado((m) => {
        const n = typeof f === 'function' ? f(m) : f;
        memoria[clave] = { ...memoria[clave], marcador: n };
        return n;
    }), [clave]);
    const [cartel, setCartel] = useState(null);
    const ctrl = useMandosOvni(activos, nJug, { modo, acepta: acepta || aceptaFutbolSiempre });
    // Si el juego pone un elemento a pantalla completa, los mandos se dibujan dentro de él (si no, no se verían)
    const [pantallaCompleta, setPantallaCompleta] = useState(() => (typeof document !== 'undefined' ? document.fullscreenElement : null));
    useEffect(() => {
        const f = () => setPantallaCompleta(document.fullscreenElement || null);
        document.addEventListener('fullscreenchange', f);
        return () => document.removeEventListener('fullscreenchange', f);
    }, []);

    // pilotos: se recuerdan y se recuperan al volver a montar el juego
    useEffect(() => {
        const p = memoria[clave]?.pilotos;
        if (p) p.forEach((id, i) => { if (id != null) ctrl.setPiloto(i, id); });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useEffect(() => { memoria[clave] = { ...memoria[clave], pilotos: ctrl.pilotos }; }, [clave, ctrl.pilotos]);

    const cambiarActivos = (v) => { setActivos(v); escribir(lsOn, v); if (v) setAbierto(true); };

    const ref = useRef({});
    ref.current = { teclas, invertir, onEvento, abierto, pausado, onClicMira, pilotos: ctrl.pilotos };
    const puente = useMemo(() => crearPuente((i) => ref.current.teclas?.[i], () => ref.current.invertir), []);
    const miras = useMemo(() => (typeof window === 'undefined' ? null : crearMiras(() => ref.current.invertir, (i, el, x, y) => ref.current.onClicMira?.(i, el, x, y))), []);

    useEffect(() => {
        if (!activos) return undefined;
        const t = setInterval(puente.tick, 100);
        ctrl.manejadorRef.current = (i, ev) => {
            const r = ref.current;
            if (r.abierto || r.pausado) return;
            if (r.teclas) puente.evento(i, ev);
            if (cursor && miras) miras.evento(i, ev);
            r.onEvento?.(i, ev, r.pilotos[i] ?? null);
        };
        return () => { clearInterval(t); ctrl.manejadorRef.current = null; puente.soltarTodo(); };
    }, [activos, cursor, ctrl.manejadorRef, puente, miras]);
    // al cambiar quién juega, se sueltan las teclas del anterior
    const pilotosAntes = useRef([]);
    useEffect(() => {
        ctrl.pilotos.forEach((id, i) => { if (pilotosAntes.current[i] != null && pilotosAntes.current[i] !== id) puente.soltar(i); });
        pilotosAntes.current = [...ctrl.pilotos];
    }, [ctrl.pilotos, puente]);
    useEffect(() => { if (abierto) puente.soltarTodo(); }, [abierto, puente]);

    const nombreHueco = (i) => nombresHueco?.[i] || (nJug > 1 ? `Jugador ${i + 1}` : 'Juega');

    const avisar = useCallback((pilotos) => {
        const txt = pilotos.slice(0, nJug).map((id, i) => `${nJug > 1 ? nombreHueco(i) + ': ' : ''}${ctrl.nombreDe(id) || 'el primer mando que se mueva'}`).join(' · ');
        setCartel({ txt, t: Date.now() });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nJug, ctrl.nombreDe]);
    useEffect(() => { if (!cartel) return undefined; const t = setTimeout(() => setCartel(null), 3500); return () => clearTimeout(t); }, [cartel]);

    const anotar = useCallback((i, d = {}) => {
        const id = ctrl.pilotos[i];
        if (id == null) return;
        setMarcador((m) => {
            const a = m[id] || { partidas: 0, puntos: 0, mejor: 0, aciertos: 0, intentos: 0 };
            return { ...m, [id]: { ...a, aciertos: a.aciertos + (d.aciertos || 0), intentos: a.intentos + (d.intentos || 0), puntos: a.puntos + (d.puntos || 0) } };
        });
    }, [ctrl.pilotos]);

    /** Fin de una partida: puntos por hueco y, opcional, quién ha ganado (índice). Con relevos pasa el mando. */
    const finPartida = useCallback((puntos = [], { ganador = null, aciertos = null, intentos = null } = {}) => {
        if (!activos) return;
        setMarcador((m) => {
            const n = { ...m };
            for (let i = 0; i < nJug; i++) {
                const id = ctrl.pilotos[i];
                if (id == null) continue;
                const a = n[id] || { partidas: 0, puntos: 0, mejor: 0, aciertos: 0, intentos: 0 };
                const p = Math.round(Number(puntos[i]) || 0);
                const ac = aciertos ? aciertos[i] || 0 : (ganador === i ? 1 : 0);
                const it = intentos ? intentos[i] || 0 : 1;
                n[id] = { partidas: a.partidas + 1, puntos: a.puntos + p, mejor: Math.max(a.mejor, p), aciertos: a.aciertos + ac, intentos: a.intentos + it };
            }
            return n;
        });
        if (relevos) setTimeout(() => avisar(ctrl.rotarPilotos()), 400);
    }, [activos, nJug, ctrl, relevos, avisar]);

    const pasarTurno = useCallback(() => avisar(ctrl.rotarPilotos()), [ctrl, avisar]);

    if (apiRef) apiRef.current = { nJug, activos, finPartida, anotar, pasarTurno, pilotoDe: (i) => ctrl.pilotos[i] ?? null, nombreDe: ctrl.nombreDe, nombreJugador: (i) => ctrl.nombreDe(ctrl.pilotos[i]), relevos };

    const ids = Object.keys(ctrl.vistos).map(Number).sort((a, b) => a - b);
    const filas = Object.entries(marcador).map(([id, r]) => ({ id: Number(id), nombre: ctrl.nombreDe(Number(id)), ...r })).sort((a, b) => b.puntos - a.puntos);
    const ahora = Date.now();
    const conAciertos = filas.some((f) => f.aciertos > 0);

    const contenido = (
        <>
            <div style={{ ...st.flot, ...estiloFlot }}>
                {!activos ? (
                    <button style={st.boton} onClick={() => cambiarActivos(true)} title="Jugar con los mandos micro:bit">🎮 Mandos micro:bit</button>
                ) : (
                    <>
                        <button style={st.boton} onClick={() => setAbierto(true)} title="Mandos, turnos y marcador">🎮⚙</button>
                        {Array.from({ length: nJug }, (_, i) => <PilotoEnJuego key={i} ctrl={ctrl} i={i} color={colores[i]} />)}
                        {relevos && <span style={{ ...st.boton, color: '#86efac', borderColor: '#86efac66', cursor: 'default' }}>🔄</span>}
                    </>
                )}
            </div>

            {activos && cursor && miras && <Miras miras={miras} n={nJug} colores={colores} etiquetas={Array.from({ length: nJug }, (_, i) => ctrl.nombreDe(ctrl.pilotos[i]))} />}

            {cartel && (
                <div style={{ position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)', zIndex: 2147482400, background: 'rgba(10,15,36,0.92)', border: '2px solid #facc15', color: '#fff', borderRadius: 14, padding: '10px 18px', fontWeight: 900, fontSize: '1.05rem', boxShadow: '0 0 24px #facc1566', textAlign: 'center', pointerEvents: 'none', maxWidth: '90vw' }}>
                    🎮 Le toca a… <span style={{ color: '#facc15' }}>{cartel.txt}</span>
                </div>
            )}

            {abierto && (
                <div style={st.fondo} onClick={(e) => { if (e.target === e.currentTarget) setAbierto(false); }}>
                    <div style={st.caja}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <b style={{ fontSize: '1.1rem', color: '#facc15', flex: 1 }}>🎮 Mandos micro:bit · {juego}</b>
                            <button style={{ ...st.boton, color: '#fff' }} onClick={() => setAbierto(false)}>✓ Jugar</button>
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                            <ChipAntena />
                            <BotonTutorialMandos inicial={tutorial || (ctrl.continuo ? 'ovni' : 'futbol')} texto="📖 Cómo se usa el mando" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', padding: '7px 12px' }} />
                        </div>
                        <div style={{ fontSize: '0.88rem' }}>{controles}</div>

                        <div>
                            <div style={{ fontSize: '0.78rem', color: '#fde68a', fontWeight: 800, marginBottom: 6 }}>MANDOS CONECTADOS</div>
                            {!ids.length ? <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Mueve, agita o pulsa cada mando para que aparezca aquí.</div> : (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {ids.map((id) => {
                                        const vivo = ahora - ctrl.vistos[id] < 4000;
                                        const hueco = ctrl.pilotos.slice(0, nJug).indexOf(id);
                                        return (
                                            <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(15,23,42,0.7)', border: `1px solid ${hueco >= 0 ? colores[hueco] : 'rgba(255,255,255,0.15)'}`, borderRadius: 10, padding: '5px 8px' }}>
                                                <span style={{ width: 9, height: 9, borderRadius: '50%', background: vivo ? '#4ade80' : '#475569' }} />
                                                <b style={{ fontSize: '0.85rem' }}>🎮 {id}</b>
                                                <input value={ctrl.nombres[id] || ''} onChange={(e) => ctrl.setNombre(id, e.target.value)} placeholder="Nombre" maxLength={20} style={st.input} />
                                                {hueco >= 0 && <span style={{ fontSize: '0.75rem', color: colores[hueco], fontWeight: 800 }}>● {nJug > 1 ? hueco + 1 : ''}</span>}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {maxJug > 1 && (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                                <b>👥 Juegan a la vez:</b>
                                {Array.from({ length: maxJug }, (_, k) => k + 1).map((k) => (
                                    <button key={k} onClick={() => { setNElegido(k); escribir(`${lsOn}_n`, k); }}
                                        style={{ ...st.boton, color: nJug === k ? '#0f172a' : '#fff', background: nJug === k ? '#facc15' : st.boton.background }}>{k === 1 ? '1 (relevos)' : `${k} a la vez`}</button>
                                ))}
                            </div>
                        )}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                            {Array.from({ length: nJug }, (_, i) => (
                                <label key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.85rem', color: colores[i], fontWeight: 700 }}>
                                    {nombreHueco(i)}: <ElegirPiloto ctrl={ctrl} i={i} color={colores[i]} />
                                </label>
                            ))}
                        </div>

                        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.85rem', cursor: 'pointer' }}>
                            <input type="checkbox" checked={relevos} onChange={(e) => { setRelevos(e.target.checked); escribir(`${lsOn}_turnos`, e.target.checked); }} />
                            🔄 Relevos: al acabar cada partida juega el siguiente mando
                        </label>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button style={{ ...st.boton, color: '#fff' }} onClick={() => { pasarTurno(); }}>⏭ Pasar el turno ahora</button>
                            {(teclas || cursor) && (
                                <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.8rem', color: '#cbd5e1', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={invertir} onChange={(e) => { setInvertir(e.target.checked); escribir('pikt_relevos_invertir', e.target.checked); }} />
                                    ↕ Invertir delante/detrás
                                </label>
                            )}
                        </div>

                        <div>
                            <div style={{ fontSize: '0.78rem', color: '#fde68a', fontWeight: 800, marginBottom: 6 }}>🏆 MARCADOR DE LA SESIÓN</div>
                            {!filas.length ? <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Aún no ha acabado ninguna partida con mandos.</div> : (
                                <>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead><tr><th style={st.th}>#</th><th style={st.th}>Mando</th><th style={st.th}>Partidas</th><th style={st.th}>Puntos</th><th style={st.th}>Mejor</th><th style={st.th}>✓</th></tr></thead>
                                        <tbody>
                                            {filas.map((f, k) => (
                                                <tr key={f.id}><td style={st.td}>{k + 1}</td><td style={st.td}>🎮 {f.nombre}</td><td style={st.td}>{f.partidas}</td><td style={st.td}><b>{f.puntos}</b></td><td style={st.td}>{f.mejor}</td><td style={st.td}>{conAciertos ? `${f.aciertos}/${f.intentos}` : '—'}</td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                                        <GuardarResultadosMandos tipo={tipo} juego={`${juego} con mandos`} recursoTitulo={recursoTitulo} hoja={hoja} config={config}
                                            jugadores={filas.map((f) => ({ id: f.id, nombre: f.nombre, aciertos: f.aciertos, intentos: f.intentos, puntos: f.puntos, extra: { partidas: f.partidas, mejor: f.mejor } }))} />
                                        <button style={{ ...st.boton, color: '#fca5a5', borderColor: '#fca5a566' }} onClick={() => setMarcador({})}>🗑 Borrar marcador</button>
                                    </div>
                                </>
                            )}
                        </div>

                        <button style={{ ...st.boton, color: '#94a3b8', borderColor: 'rgba(255,255,255,0.2)', alignSelf: 'flex-start' }} onClick={() => { cambiarActivos(false); setAbierto(false); }}>Apagar los mandos en este juego</button>
                    </div>
                </div>
            )}
        </>
    );
    const fs = pantallaCompleta && pantallaCompleta !== document.documentElement ? pantallaCompleta : null;
    return fs ? createPortal(contenido, fs) : contenido;
}

/* Mapas de teclas habituales */
export const FLECHAS = { I: 'ArrowLeft', D: 'ArrowRight', F: 'ArrowUp', T: 'ArrowDown' };
export const WASD = { I: 'a', D: 'd', F: 'w', T: 's' };
