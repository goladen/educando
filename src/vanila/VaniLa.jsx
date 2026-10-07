// VaniLa 🔤 — juego de letras tipo concurso: salen 9 letras y hay que formar todas las palabras
// posibles antes de que acabe el tiempo, ESCRIBIENDO BIEN LA TILDE (y la ç / l·l en catalán).
// Idiomas: español, catalán, inglés y francés (diccionarios comunes en utils/diccionarios.js).
//
//  · Solo: 1-5 rondas (30-120 s). Sorteo automático o «vocal / consonante».
//  · Duelo: dos jugadores en la misma pantalla con las MISMAS letras (cada uno su panel); las
//    letras cambian cada N segundos y cada punto sube a su escalador. Gana quien corona la cumbre.
//  · Tablero (Tablero.jsx): de 2 a 6 jugadores online, tipo Scrabble, cada uno con sus 9 letras.
import React, { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import { guardarRegistroLocal } from '../utils/registrosLocales';
import { despertarAudio, sonidoCorrecto, sonidoIncorrecto, sonidoFinal } from '../utils/sonidosFeedback';
import { IDIOMAS_PALABRAS, CODIGOS_IDIOMA, baseDe, barajar, sacarLetra, generarLetras, palabrasPosibles, validarPalabra, esVocalLetra } from '../utils/diccionarios';
import {
    T, FUENTE, COLORES_JUGADOR, movimientoReducido, useWindowSize, textos, variantesDe, conVariante,
    blip, sonidoFicha, sonidoRevelar, sonidoTic, sonidoCambio, sonidoPalabra, lanzarLetras, lanzarDesde,
    CapaLetras, ESTILOS_CSS, Boton, Opciones, Ficha, Reloj, BotonSonido, Pantalla, Cabecera, Tarjeta, Titulo,
    useDiccionario, ModalEnviarProfe,
} from './comun';

const TableroOnline = lazy(() => import('./Tablero'));

const COLOR_J = [T.cian, T.rosa];
const largo = (forma) => forma.replace(/·/g, '').length;
const llevaMarca = (forma, idioma) => forma.replace(/·/g, '') !== baseDe(forma, idioma);

const puntosDe = (forma, total, idioma) => {
    let p = largo(forma);
    if (llevaMarca(forma, idioma)) p += 2;   // premio por escribir bien la tilde / ç / l·l
    if (largo(forma) === total) p *= 2;      // ¡todas las letras!
    return p;
};

// ─── Panel de letras de un jugador: fichas + palabra en construcción + botones ─
// onEnviar(forma) → { ok, motivo?, puntos?, conocida? } (síncrono).
function PanelLetras({ letras, idioma, rondaKey, activo, onEnviar, ancho, teclado = false, color = T.cian }) {
    const tx = textos(idioma);
    const VAR = variantesDe(idioma);
    const [sel, setSel] = useState([]);         // [{ i, ac }] i = índice de la ficha
    const [orden, setOrden] = useState(() => letras.map((_, i) => i));
    const [aviso, setAviso] = useState(null);
    const [sacudir, setSacudir] = useState(0);
    const [brillar, setBrillar] = useState(0);
    const [animarEntrada, setAnimarEntrada] = useState(true);
    const palabraRef = useRef(null);

    useEffect(() => {
        setSel([]); setOrden(letras.map((_, i) => i)); setAviso(null); setAnimarEntrada(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rondaKey]);

    const usadas = useMemo(() => new Set(sel.map(s => s.i)), [sel]);
    const forma = sel.map(s => conVariante(idioma, letras[s.i], s.ac)).join('');
    const hayVariantes = Object.keys(VAR).length > 0;

    const porFila = ancho >= 620 ? letras.length : 5;
    const gap = ancho < 420 ? 6 : 10;
    const tam = Math.max(38, Math.min(84, Math.floor((ancho - gap * (porFila - 1)) / porFila)));
    const tamHueco = Math.max(28, Math.min(62, Math.floor((ancho - 4 * (letras.length - 1)) / letras.length)));

    const avisar = (texto, tipo) => setAviso({ texto, tipo, n: Date.now() });

    const pulsarFicha = useCallback((i, ac = 0) => {
        if (!activo || usadas.has(i)) return;
        setAnimarEntrada(false);
        sonidoFicha(sel.length);
        setSel(s => s.some(x => x.i === i) ? s : [...s, { i, ac }]);
        setAviso(null);
    }, [activo, usadas, sel.length]);

    const borrar = useCallback(() => { if (activo) setSel(s => s.slice(0, -1)); }, [activo]);
    const limpiar = useCallback(() => { if (activo) setSel([]); }, [activo]);
    const mezclar = useCallback(() => { setAnimarEntrada(false); setOrden(o => barajar(o)); blip(240, { dur: 0.18, tipo: 'sine', vol: 0.05, freqFin: 520 }); }, []);

    const cambiarVariante = (pos) => {
        if (!activo) return;
        setSel(s => s.map((x, k) => (k === pos && VAR[letras[x.i]]) ? { ...x, ac: (x.ac + 1) % VAR[letras[x.i]].length } : x));
        blip(900, { dur: 0.06, vol: 0.05 });
    };
    // Cambia la variante de la última letra que la admita (tecla ' o botón).
    const varianteUltima = useCallback((soloLetra) => {
        setSel(s => {
            for (let k = s.length - 1; k >= 0; k--) {
                const ch = letras[s[k].i];
                if (VAR[ch] && (!soloLetra || ch === soloLetra)) return s.map((x, j) => j === k ? { ...x, ac: (x.ac + 1) % VAR[ch].length } : x);
            }
            return s;
        });
    }, [letras, VAR]);

    const enviar = useCallback(() => {
        if (!activo || !sel.length) return;
        if (largo(forma) < 3) { avisar(tx.m.corta, 'mal'); setSacudir(Date.now()); sonidoIncorrecto(); return; }
        const r = onEnviar(forma);
        if (r.ok) {
            avisar(`+${r.puntos} ${forma.toUpperCase()}${r.conocida === false ? ' · ' + tx.pocoComun : ''}`, 'ok');
            setBrillar(Date.now());
            sonidoCorrecto(); sonidoPalabra(largo(forma));
            lanzarDesde(palabraRef.current, forma, color);
            setSel([]);
        } else {
            avisar(tx.m[r.motivo] || '✖', 'mal');
            setSacudir(Date.now());
            sonidoIncorrecto();
        }
    }, [activo, sel.length, forma, onEnviar, color, tx]);

    // Teclado (modo individual): letras (también á, ç…), ' o · tras la letra, Enter, Retroceso, Esc, Espacio.
    useEffect(() => {
        if (!teclado || !activo) return;
        const onKey = (e) => {
            if (e.target?.tagName === 'INPUT' || e.ctrlKey || e.metaKey || e.altKey) return;
            const k = e.key;
            if (k === 'Enter') { e.preventDefault(); enviar(); return; }
            if (k === 'Backspace') { e.preventDefault(); borrar(); return; }
            if (k === 'Escape') { limpiar(); return; }
            if (k === ' ') { e.preventDefault(); mezclar(); return; }
            if (k === "'" || k === '´' || k === '`') { e.preventDefault(); varianteUltima(); return; }
            if (k === '·' || k === '.') { e.preventDefault(); varianteUltima('l'); return; }
            if (k.length !== 1) return;
            const low = k.toLowerCase();
            const base = baseDe(low, idioma);
            if (base.length !== 1 || !letras.includes(base)) { if (/\p{L}/u.test(low)) setSacudir(Date.now()); return; }
            const libre = orden.find(i => letras[i] === base && !usadas.has(i));
            if (libre === undefined) { setSacudir(Date.now()); return; }
            pulsarFicha(libre, Math.max(0, (VAR[base] || []).indexOf(low)));
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [teclado, activo, enviar, borrar, limpiar, mezclar, varianteUltima, pulsarFicha, orden, letras, usadas, idioma, VAR]);

    return (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: ancho < 420 ? 10 : 14 }}>
            {/* Palabra en construcción */}
            <div ref={palabraRef} key={'s' + sacudir} className="nl-anim" style={{
                display: 'flex', gap: 4, justifyContent: 'center', minHeight: tamHueco * 1.15,
                animation: sacudir ? 'nlShake .4s' : undefined,
            }}>
                {letras.map((_, k) => {
                    const s = sel[k];
                    const ch = s ? conVariante(idioma, letras[s.i], s.ac) : null;
                    const conVar = s && VAR[letras[s.i]];
                    return (
                        <div key={k + '-' + (s ? s.i : 'x') + '-' + brillar} onClick={() => conVar && cambiarVariante(k)} className="nl-anim" style={{
                            width: tamHueco, height: tamHueco * 1.15, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: tamHueco * (ch && ch.length > 1 ? 0.42 : 0.55), fontWeight: 900, fontFamily: FUENTE, position: 'relative',
                            color: '#fff', cursor: conVar ? 'pointer' : 'default', userSelect: 'none',
                            border: s ? `2px solid ${s.ac ? T.ambar : color}` : `2px dashed rgba(255,255,255,0.12)`,
                            background: s ? (s.ac ? `${T.ambar}22` : `${color}1f`) : 'transparent',
                            boxShadow: s ? `0 0 12px ${s.ac ? T.ambar : color}55` : 'none',
                            animation: s ? 'nlPop .22s ease-out' : (brillar ? 'nlBrilla .7s' : undefined),
                        }}>
                            {ch ? ch.toUpperCase() : ''}
                            {conVar && !s.ac && <span style={{ position: 'absolute', top: -2, right: 3, fontSize: tamHueco * 0.28, color: T.ambar, opacity: 0.7 }}>´</span>}
                        </div>
                    );
                })}
            </div>

            <div style={{ minHeight: 24, textAlign: 'center' }}>
                {aviso && (
                    <span key={aviso.n} className="nl-anim" style={{
                        display: 'inline-block', padding: '4px 14px', borderRadius: 20, fontWeight: 800, fontSize: ancho < 420 ? '0.8rem' : '0.92rem',
                        color: aviso.tipo === 'ok' ? '#052e1c' : '#fff', background: aviso.tipo === 'ok' ? T.verde : `${T.rojo}cc`,
                        animation: 'nlPop .25s ease-out',
                    }}>{aviso.texto}</span>
                )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap, justifyContent: 'center', maxWidth: porFila * (tam + gap) }}>
                {orden.map((i, k) => (
                    <Ficha key={rondaKey + '-' + i} ch={letras[i]} idioma={idioma} tam={tam} usada={usadas.has(i)} disabled={!activo}
                        animar={animarEntrada} retraso={k * 0.13} onClick={() => pulsarFicha(i)} />
                ))}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Boton onClick={borrar} disabled={!activo || !sel.length} color={T.suave}>⌫</Boton>
                <Boton onClick={limpiar} disabled={!activo || !sel.length} color={T.suave}>✖</Boton>
                <Boton onClick={mezclar} disabled={!activo} color={T.lila}>🔀</Boton>
                {hayVariantes && <Boton onClick={() => varianteUltima()} disabled={!activo || !sel.some(s => VAR[letras[s.i]])} color={T.ambar}>{tx.tilde}</Boton>}
                <Boton onClick={enviar} disabled={!activo || !sel.length} color={color} relleno style={{ minWidth: 110 }}>{tx.enviar}</Boton>
            </div>
        </div>
    );
}

const ListaPalabras = ({ palabras, color = T.cian, compacta, vacio }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', maxHeight: compacta ? 92 : 220, overflowY: 'auto', padding: 2 }}>
        {palabras.length === 0 && <span style={{ color: T.suave, fontSize: '0.85rem' }}>{vacio}</span>}
        {[...palabras].reverse().map(p => (
            <span key={p.forma} className="nl-anim" style={{
                padding: compacta ? '3px 9px' : '5px 11px', borderRadius: 20, fontWeight: 800, fontSize: compacta ? '0.75rem' : '0.85rem',
                background: `${color}1c`, border: `1px solid ${color}66`, color: T.texto, animation: 'nlPop .3s ease-out',
            }}>{p.forma.toUpperCase()} <span style={{ color, marginLeft: 3 }}>+{p.puntos}</span></span>
        ))}
    </div>
);

// ─── Montaña del duelo ───────────────────────────────────────────────────────
const RUTA1 = [[34, 348], [100, 320], [58, 290], [112, 256], [70, 222], [122, 188], [104, 156], [134, 124], [130, 96], [146, 66], [150, 46]];
const RUTA2 = RUTA1.map(([x, y]) => [300 - x, y]);
const puntoEnRuta = (ruta, t) => {
    const seg = [];
    let total = 0;
    for (let k = 1; k < ruta.length; k++) { const d = Math.hypot(ruta[k][0] - ruta[k - 1][0], ruta[k][1] - ruta[k - 1][1]); seg.push(d); total += d; }
    let obj = Math.max(0, Math.min(1, t)) * total;
    for (let k = 0; k < seg.length; k++) {
        if (obj <= seg[k] || k === seg.length - 1) {
            const f = seg[k] ? Math.min(1, obj / seg[k]) : 0;
            const [x0, y0] = ruta[k], [x1, y1] = ruta[k + 1];
            return { x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f, dir: x1 >= x0 ? 1 : -1 };
        }
        obj -= seg[k];
    }
    return { x: ruta[ruta.length - 1][0], y: ruta[ruta.length - 1][1], dir: 1 };
};

// Valor que persigue suavemente a su objetivo (para que el escalador «camine»).
const useSuave = (objetivo) => {
    const [v, setV] = useState(objetivo);
    const vRef = useRef(objetivo);
    useEffect(() => {
        if (movimientoReducido()) { vRef.current = objetivo; setV(objetivo); return; }
        let raf;
        const paso = () => {
            const d = objetivo - vRef.current;
            if (Math.abs(d) < 0.001) { vRef.current = objetivo; setV(objetivo); return; }
            vRef.current += Math.sign(d) * Math.min(Math.abs(d), Math.max(0.0015, Math.abs(d) * 0.05));
            setV(vRef.current);
            raf = requestAnimationFrame(paso);
        };
        raf = requestAnimationFrame(paso);
        return () => cancelAnimationFrame(raf);
    }, [objetivo]);
    return [v, Math.abs(objetivo - v) > 0.002];
};

const Escalador = ({ ruta, progreso, color, nombre, puntos, ganador }) => {
    const [t, moviendo] = useSuave(progreso);
    const { x, y, dir } = puntoEnRuta(ruta, t);
    const piernaA = { transformOrigin: '0px -10px', animation: moviendo ? 'nlPiernaA .35s linear infinite' : undefined };
    const piernaB = { transformOrigin: '0px -10px', animation: moviendo ? 'nlPiernaB .35s linear infinite' : undefined };
    return (
        <g transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`}>
            <g transform={`scale(${dir * 1.15},1.15)`}>
                <ellipse cx={0} cy={1} rx={7} ry={2} fill="rgba(0,0,0,.35)" />
                <g style={piernaA}><line x1={0} y1={-10} x2={0} y2={0} stroke="#1e293b" strokeWidth={3.2} strokeLinecap="round" /></g>
                <g style={piernaB}><line x1={0} y1={-10} x2={0} y2={0} stroke="#334155" strokeWidth={3.2} strokeLinecap="round" /></g>
                <rect x={-8.5} y={-21} width={5.5} height={10} rx={2} fill="#b45309" />
                <rect x={-4} y={-21.5} width={8} height={12.5} rx={3.2} fill={color} />
                <line x1={2} y1={-17} x2={7} y2={-21} stroke="#fcd9b6" strokeWidth={2.4} strokeLinecap="round" />
                <line x1={7} y1={-27} x2={7} y2={-15} stroke="#cbd5e1" strokeWidth={1.4} />
                <path d="M7 -27 l4 1.5 l-4 1" fill="#cbd5e1" />
                <circle cx={0.5} cy={-25.5} r={4.3} fill="#fcd9b6" />
                <path d="M-4 -26 a4.5 4.5 0 0 1 9 0 z" fill={color} />
                <circle cx={2.5} cy={-25} r={0.8} fill="#0f172a" />
            </g>
            {ganador && <text y={-42} textAnchor="middle" fontSize={16}>🏆</text>}
            <text y={-33} textAnchor="middle" fontSize={9.5} fontWeight={900} fill={color} stroke="#0A0918" strokeWidth={3} paintOrder="stroke" fontFamily={FUENTE}>
                {nombre} · {puntos}
            </text>
        </g>
    );
};

function Montana({ jugadores, meta, ganador, alto }) {
    const estrellas = useMemo(() => Array.from({ length: 28 }, () => [Math.random() * 300, Math.random() * 170, Math.random() * 1.2 + 0.3]), []);
    const linea = r => r.map(([x, y], k) => `${k ? 'L' : 'M'}${x} ${y}`).join(' ');
    return (
        <svg viewBox="0 0 300 360" style={{ width: '100%', height: alto, display: 'block' }} preserveAspectRatio="xMidYMax meet">
            <defs>
                <linearGradient id="nlCielo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0b0a24" /><stop offset="1" stopColor="#2a1b5e" /></linearGradient>
                <linearGradient id="nlRoca" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4c3d8f" /><stop offset=".55" stopColor="#2d2560" /><stop offset="1" stopColor="#1a1640" /></linearGradient>
                <linearGradient id="nlLejos" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3b2f74" /><stop offset="1" stopColor="#221b4d" /></linearGradient>
            </defs>
            <rect width="300" height="360" rx="18" fill="url(#nlCielo)" />
            {estrellas.map(([x, y, r], k) => <circle key={k} cx={x} cy={y} r={r} fill="#fff" opacity={0.25 + (k % 4) * 0.15} />)}
            <circle cx={250} cy={52} r={16} fill="#fde68a" opacity={0.9} />
            <circle cx={244} cy={47} r={14} fill="url(#nlCielo)" opacity={0.85} />
            <path d="M-10 360 L60 210 L110 280 L170 190 L230 270 L270 220 L310 360 Z" fill="url(#nlLejos)" opacity={0.7} />
            <g className="nl-anim" style={{ animation: 'nlNube 26s linear infinite' }} opacity={0.18}>
                <ellipse cx={20} cy={150} rx={28} ry={8} fill="#fff" /><ellipse cx={40} cy={144} rx={18} ry={7} fill="#fff" />
            </g>
            <polygon points="0,360 150,40 300,360" fill="url(#nlRoca)" />
            <polygon points="150,40 300,360 220,360 175,170" fill="rgba(0,0,0,0.18)" />
            <polygon points="150,40 118,108 130,100 138,114 150,98 160,116 170,102 182,108" fill="#e0e7ff" />
            <path d={linea(RUTA1)} fill="none" stroke={COLOR_J[0]} strokeWidth={1.6} strokeDasharray="3 4" opacity={0.65} />
            <path d={linea(RUTA2)} fill="none" stroke={COLOR_J[1]} strokeWidth={1.6} strokeDasharray="3 4" opacity={0.65} />
            {[0.25, 0.5, 0.75].map(f => [RUTA1, RUTA2].map((r, j) => {
                const p = puntoEnRuta(r, f);
                return <g key={f + '-' + j}><circle cx={p.x} cy={p.y} r={2.6} fill={COLOR_J[j]} /><text x={p.x + (j ? 5 : -5)} y={p.y + 3} fontSize={7} fill={T.suave} textAnchor={j ? 'start' : 'end'} fontFamily={FUENTE}>{Math.round(meta * f)}</text></g>;
            }))}
            <line x1={150} y1={44} x2={150} y2={16} stroke="#e2e8f0" strokeWidth={1.6} />
            <g className="nl-anim" style={{ transformOrigin: '150px 17px', animation: 'nlBandera 1.2s ease-in-out infinite' }}>
                <path d="M150 17 L172 23 L150 29 Z" fill={ganador != null ? COLOR_J[ganador] : T.ambar} />
            </g>
            <text x={150} y={12} textAnchor="middle" fontSize={8} fontWeight={900} fill={T.ambar} fontFamily={FUENTE}>{meta}</text>
            {jugadores.map((j, k) => (
                <Escalador key={k} ruta={k ? RUTA2 : RUTA1} progreso={Math.min(1, j.puntos / meta)} color={COLOR_J[k]}
                    nombre={j.nombre} puntos={j.puntos} ganador={ganador === k} />
            ))}
        </svg>
    );
}

// ─── Menú ────────────────────────────────────────────────────────────────────
const CONF_INICIAL = { duracion: 60, rondas: 1, sorteo: 'auto', meta: 100, cambio: 40, nombre1: '', nombre2: '' };

function Menu({ idioma, setIdioma, onElegir, onExit, dicc, error, reintentar }) {
    const { w } = useWindowSize();
    const tx = textos(idioma);
    const [conf, setConf] = useState(() => {
        try { return { ...CONF_INICIAL, ...JSON.parse(localStorage.getItem('pikt_vanila') || '{}') }; }
        catch { return CONF_INICIAL; }
    });
    const [modo, setModo] = useState(null);
    const set = (k, v) => setConf(c => ({ ...c, [k]: v }));
    const jugar = (m) => {
        try { localStorage.setItem('pikt_vanila', JSON.stringify(conf)); } catch { /* sin almacenamiento */ }
        despertarAudio();
        onElegir(m, conf);
    };
    const inp = { padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${T.borde}`, background: 'rgba(255,255,255,0.06)', color: 'white', fontSize: '0.95rem', fontFamily: FUENTE, outline: 'none', width: '100%', boxSizing: 'border-box', fontWeight: 700 };
    const etq = { color: T.suave, fontWeight: 800, fontSize: '0.78rem', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, textAlign: 'center' };
    const tieneTildes = Object.keys(IDIOMAS_PALABRAS[idioma].variantes).length > 0;

    return (
        <Pantalla>
            <div style={{ position: 'fixed', top: 14, left: 14, right: 14, display: 'flex', justifyContent: 'space-between', zIndex: 2 }}>
                {onExit ? <Boton onClick={onExit} color={T.suave}>{tx.salir}</Boton> : <span />}
                <BotonSonido />
            </div>
            <div style={{ marginTop: 56 }}><Titulo tam={Math.min(64, (w - 60) / 7)} /></div>

            {/* Idioma de juego */}
            <div style={{ display: 'flex', gap: 8, marginTop: 22, flexWrap: 'wrap', justifyContent: 'center' }}>
                {CODIGOS_IDIOMA.map(l => (
                    <button key={l} className="nl-btn" onClick={() => setIdioma(l)} title={tx.idioma} style={{
                        padding: '7px 14px', borderRadius: 30, cursor: 'pointer', fontFamily: FUENTE, fontWeight: 800, fontSize: '0.88rem',
                        border: `2px solid ${idioma === l ? T.ambar : T.borde}`, background: idioma === l ? `${T.ambar}22` : 'rgba(255,255,255,0.04)',
                        color: idioma === l ? T.ambar : T.texto,
                    }}>{IDIOMAS_PALABRAS[l].bandera} {IDIOMAS_PALABRAS[l].nombre}</button>
                ))}
            </div>

            <p style={{ color: T.suave, maxWidth: 560, textAlign: 'center', lineHeight: 1.5, margin: '18px 0 24px', fontSize: '0.98rem' }}>
                {tx.sub}{tx.ojoTildes && <b style={{ color: T.ambar }}> {tx.ojoTildes}</b>} {tx.tocaVocal}
            </p>

            {!modo && (
                <>
                    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
                        {[
                            ['solo', '🎯', tx.solo, tx.soloDesc, T.cian],
                            ['duelo', '⛰️', tx.duelo, tx.dueloDesc, T.rosa],
                            ['tablero', '🧩', tx.tablero, tx.tableroDesc, T.ambar],
                        ].map(([id, emo, nom, desc, c]) => (
                            <button key={id} className="nl-btn" onClick={() => id === 'tablero' ? jugar('tablero') : setModo(id)} style={{
                                width: 250, padding: '22px 20px', borderRadius: 22, cursor: 'pointer', textAlign: 'left', fontFamily: FUENTE,
                                background: `linear-gradient(160deg, ${c}22, rgba(20,18,45,0.9))`, border: `2px solid ${c}`, color: T.texto,
                                boxShadow: `0 0 28px ${c}33`,
                            }}>
                                <div style={{ fontSize: '2.3rem' }}>{emo}</div>
                                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: c, margin: '6px 0' }}>{nom}</div>
                                <div style={{ color: T.suave, fontSize: '0.88rem', lineHeight: 1.45 }}>{desc}</div>
                            </button>
                        ))}
                    </div>
                    <a href="/wordle" className="nl-btn" style={{
                        marginTop: 22, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderRadius: 16, textDecoration: 'none',
                        border: '2px solid #538d4e', background: 'rgba(83,141,78,0.15)', color: T.texto, maxWidth: 520,
                    }}>
                        <span style={{ display: 'flex', gap: 3 }}>{['#538d4e', '#b59f3b', '#3a3a3c'].map(c => <span key={c} style={{ width: 16, height: 16, borderRadius: 3, background: c }} />)}</span>
                        <span><b style={{ color: '#7bd36f' }}>{tx.probarWordle}</b> <span style={{ color: T.suave, fontSize: '0.88rem' }}>{tx.wordleDesc}</span></span>
                        <span style={{ fontSize: '1.3rem' }}>›</span>
                    </a>
                </>
            )}

            {modo && (
                <Tarjeta style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div style={{ fontWeight: 900, fontSize: '1.2rem', textAlign: 'center', color: modo === 'solo' ? T.cian : T.rosa }}>
                        {modo === 'solo' ? `🎯 ${tx.partidaSolo}` : `⛰️ ${tx.partidaDuelo}`}
                    </div>
                    {modo === 'solo' ? (
                        <>
                            <div><div style={etq}>{tx.tiempoRonda}</div><Opciones valor={conf.duracion} onChange={v => set('duracion', v)} opciones={[[30, '30 s'], [60, '1 min'], [90, '1:30'], [120, '2 min']]} /></div>
                            <div><div style={etq}>{tx.rondas}</div><Opciones valor={conf.rondas} onChange={v => set('rondas', v)} opciones={[[1, '1'], [3, '3'], [5, '5']]} /></div>
                            <div><div style={etq}>{tx.sorteo}</div><Opciones valor={conf.sorteo} onChange={v => set('sorteo', v)} opciones={[['auto', tx.auto], ['manual', tx.manual]]} /></div>
                        </>
                    ) : (
                        <>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <div style={{ flex: 1 }}><div style={{ ...etq, color: T.cian }}>{tx.jugador} 1</div><input value={conf.nombre1} placeholder={`${tx.jugador} 1`} maxLength={14} onChange={e => set('nombre1', e.target.value)} style={{ ...inp, borderColor: `${T.cian}88` }} /></div>
                                <div style={{ flex: 1 }}><div style={{ ...etq, color: T.rosa }}>{tx.jugador} 2</div><input value={conf.nombre2} placeholder={`${tx.jugador} 2`} maxLength={14} onChange={e => set('nombre2', e.target.value)} style={{ ...inp, borderColor: `${T.rosa}88` }} /></div>
                            </div>
                            <div><div style={etq}>{tx.meta}</div><Opciones color={T.rosa} valor={conf.meta} onChange={v => set('meta', v)} opciones={[[50, '50'], [100, '100'], [150, '150'], [200, '200']]} /></div>
                            <div><div style={etq}>{tx.cambio}</div><Opciones color={T.rosa} valor={conf.cambio} onChange={v => set('cambio', v)} opciones={[[20, '20 s'], [30, '30 s'], [40, '40 s'], [60, '60 s'], [90, '90 s']]} /></div>
                        </>
                    )}
                    <div style={{ fontSize: '0.8rem', color: T.suave, textAlign: 'center', lineHeight: 1.5 }}>{tieneTildes ? tx.puntuacion : tx.puntuacionSinTilde}</div>
                    {error && (
                        <div style={{ color: T.rojo, textAlign: 'center', fontSize: '0.88rem' }}>
                            ⚠ {error} <button onClick={reintentar} style={{ marginLeft: 6, background: 'none', border: 'none', color: T.cian, cursor: 'pointer', fontWeight: 800 }}>{tx.reintentar}</button>
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                        <Boton onClick={() => setModo(null)} color={T.suave}>{tx.atras}</Boton>
                        <Boton onClick={() => jugar(modo)} disabled={!dicc} color={modo === 'solo' ? T.cian : T.rosa} relleno grande>
                            {dicc ? tx.jugar : tx.cargando}
                        </Boton>
                    </div>
                </Tarjeta>
            )}
        </Pantalla>
    );
}

// ─── Sorteo manual (vocal / consonante) ──────────────────────────────────────
function SorteoManual({ idioma, total = 9, onListo, ancho }) {
    const tx = textos(idioma);
    const [letras, setLetras] = useState([]);
    const nv = letras.filter(l => esVocalLetra(l, idioma)).length, nc = letras.length - nv;
    const quedan = total - letras.length;
    // Al menos 3 vocales y 3 consonantes, como mucho 5 vocales.
    const puedeV = quedan > 0 && nv < 5 && !(3 - nc >= quedan);
    const puedeC = quedan > 0 && !(3 - nv >= quedan);
    const pedir = (vocal) => {
        let nueva = sacarLetra(idioma, vocal, letras);
        if (!vocal && nueva === 'q' && !letras.includes('u')) nueva = sacarLetra(idioma, false, [...letras, 'q']);
        const sig = [...letras, nueva];
        blip(vocal ? 620 : 440, { dur: 0.14, vol: 0.07 });
        setLetras(sig);
        if (sig.length === total) setTimeout(() => onListo(sig), 700);
    };
    const tam = Math.max(34, Math.min(70, Math.floor((ancho - 8 * 8) / 9)));
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
            <div style={{ color: T.suave, fontWeight: 800, letterSpacing: 1 }}>{tx.pideMas(quedan)}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {Array.from({ length: total }, (_, k) => letras[k]
                    ? <Ficha key={k} ch={letras[k]} idioma={idioma} tam={tam} disabled />
                    : <div key={k} style={{ width: tam, height: tam * 1.12, borderRadius: Math.max(10, tam * 0.2), border: '2px dashed rgba(255,255,255,0.15)' }} />)}
            </div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Boton onClick={() => pedir(true)} disabled={!puedeV} color={T.cian} relleno grande>{tx.vocal}</Boton>
                <Boton onClick={() => pedir(false)} disabled={!puedeC} color={T.lila} relleno grande>{tx.consonante}</Boton>
            </div>
        </div>
    );
}

// ─── Modo individual ─────────────────────────────────────────────────────────
const PASO_REVELAR = 0.13;

function JuegoSolo({ conf, dicc, onMenu }) {
    const idioma = dicc.idioma;
    const tx = textos(idioma);
    const { w } = useWindowSize();
    const [ronda, setRonda] = useState(1);
    const [letras, setLetras] = useState([]);
    const [fase, setFase] = useState(conf.sorteo === 'manual' ? 'sorteo' : 'revelando'); // sorteo|revelando|jugando|resumen|final
    const [restante, setRestante] = useState(conf.duracion);
    const [palabrasRonda, setPalabrasRonda] = useState([]);
    const [stats, setStats] = useState({ palabras: [], intentos: 0, aciertos: 0, fallosTilde: [], noExisten: 0, puntos: 0, masLarga: '' });
    const [mostrarEnvio, setMostrarEnvio] = useState(false);
    const finRef = useRef(0);
    const ultimoSeg = useRef(null);
    const guardado = useRef(false);
    const timeoutRef = useRef(null);
    useEffect(() => () => clearTimeout(timeoutRef.current), []);

    const empezarReloj = useCallback(() => {
        finRef.current = Date.now() + conf.duracion * 1000;
        setRestante(conf.duracion);
        setFase('jugando');
    }, [conf.duracion]);

    const revelar = useCallback((ls) => {
        setLetras(ls);
        setPalabrasRonda([]);
        setFase('revelando');
        sonidoRevelar(ls.length, PASO_REVELAR);
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(empezarReloj, (ls.length * PASO_REVELAR + 0.8) * 1000);
    }, [empezarReloj]);

    useEffect(() => {
        if (conf.sorteo === 'manual') { setLetras([]); setFase('sorteo'); }
        else revelar(generarLetras(dicc));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ronda]);

    useEffect(() => {
        if (fase !== 'jugando') return;
        const iv = setInterval(() => {
            const r = Math.max(0, (finRef.current - Date.now()) / 1000);
            setRestante(r);
            const s = Math.ceil(r);
            if (s !== ultimoSeg.current) { ultimoSeg.current = s; if (s <= 5 && s > 0) sonidoTic(true); else if (s <= 10 && s > 0) sonidoTic(false); }
            if (r <= 0) { clearInterval(iv); sonidoFinal(); setFase('resumen'); }
        }, 100);
        return () => clearInterval(iv);
    }, [fase]);

    const onEnviar = useCallback((forma) => {
        if (palabrasRonda.some(p => p.forma === forma)) return { ok: false, motivo: 'repetida' };
        const r = validarPalabra(dicc, forma);
        if (r.ok) {
            const puntos = puntosDe(forma, letras.length, idioma);
            const p = { forma, puntos, ronda };
            setPalabrasRonda(l => [...l, p]);
            setStats(s => ({ ...s, palabras: [...s.palabras, p], intentos: s.intentos + 1, aciertos: s.aciertos + 1, puntos: s.puntos + puntos, masLarga: largo(forma) > largo(s.masLarga) ? forma : s.masLarga }));
            return { ok: true, puntos, conocida: r.conocida };
        }
        setStats(s => ({
            ...s, intentos: s.intentos + 1,
            noExisten: s.noExisten + (r.motivo === 'noexiste' ? 1 : 0),
            fallosTilde: r.correctas ? [...s.fallosTilde, { escrita: forma, correcta: r.correctas.join(' / '), ronda }] : s.fallosTilde,
        }));
        return r;
    }, [palabrasRonda, dicc, letras.length, ronda, idioma]);

    const soluciones = useMemo(() => {
        if (fase !== 'resumen' || !letras.length) return [];
        return palabrasPosibles(dicc, letras)
            .map(b => dicc.formas.get(b).formas[0])
            .sort((a, b) => largo(b) - largo(a) || a.localeCompare(b, idioma));
    }, [fase, letras, dicc, idioma]);

    const ultima = ronda >= conf.rondas;
    useEffect(() => {
        if (fase === 'final' && !guardado.current) {
            guardado.current = true;
            guardarRegistroLocal('VANILA', {
                titulo: `VaniLa · ${IDIOMAS_PALABRAS[idioma].nombre} · ${conf.rondas} × ${conf.duracion}s · ${stats.puntos} pts`,
                aciertos: stats.aciertos, intentos: stats.intentos,
                porcentaje: Math.round((stats.aciertos / Math.max(1, stats.intentos)) * 100), via: 'juego',
            });
            lanzarLetras(window.innerWidth / 2, window.innerHeight * 0.4, 'VANILA', null);
        }
    }, [fase, conf.rondas, conf.duracion, stats, idioma]);

    const ancho = Math.min(w - 32, 860);
    const tildesRonda = stats.fallosTilde.filter(f => f.ronda === ronda);
    const encontradas = new Set(palabrasRonda.map(p => baseDe(p.forma, idioma)));

    return (
        <Pantalla centrar={false}>
            <Cabecera
                izquierda={<Boton onClick={onMenu} color={T.suave}>{tx.menu}</Boton>}
                centro={<div style={{ fontWeight: 900, letterSpacing: 2, color: T.suave, fontSize: '0.85rem' }}>{tx.ronda} {ronda}/{conf.rondas} · {IDIOMAS_PALABRAS[idioma].bandera}</div>}
                derecha={<div style={{ fontWeight: 900, fontSize: '1.25rem', color: T.ambar, textShadow: `0 0 12px ${T.ambar}` }}>⭐ {stats.puntos}</div>}
            />

            {fase === 'sorteo' && <div style={{ marginTop: '8vh' }}><SorteoManual idioma={idioma} ancho={ancho} onListo={revelar} /></div>}

            {(fase === 'revelando' || fase === 'jugando') && letras.length > 0 && (
                <div style={{ width: ancho, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginTop: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                        <Reloj restante={fase === 'jugando' ? restante : conf.duracion} total={conf.duracion} tam={w < 500 ? 76 : 96} etiqueta={tx.seg} />
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: '0.75rem', color: T.suave, fontWeight: 800, letterSpacing: 1 }}>{tx.palabras}</div>
                            <div style={{ fontSize: '2rem', fontWeight: 900, color: T.cian }}>{palabrasRonda.length}</div>
                        </div>
                    </div>
                    <Tarjeta style={{ width: '100%', boxSizing: 'border-box', padding: w < 500 ? 14 : 22 }}>
                        <PanelLetras letras={letras} idioma={idioma} rondaKey={ronda + '-' + letras.join('')} activo={fase === 'jugando'} onEnviar={onEnviar}
                            ancho={ancho - (w < 500 ? 28 : 44)} teclado color={T.cian} />
                    </Tarjeta>
                    <ListaPalabras palabras={palabrasRonda} vacio={tx.sinPalabras} />
                    {w > 700 && <div style={{ color: T.suave, fontSize: '0.78rem' }}>{tx.teclado}</div>}
                </div>
            )}

            {fase === 'resumen' && (
                <Tarjeta style={{ width: '100%', maxWidth: 760, marginTop: 10, boxSizing: 'border-box' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '2.4rem' }}>⏰</div>
                        <div style={{ fontWeight: 900, fontSize: '1.5rem' }}>{tx.tiempo}</div>
                        <div style={{ color: T.suave, marginTop: 4 }}>{tx.resumen(palabrasRonda.length, palabrasRonda.reduce((a, p) => a + p.puntos, 0))}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', margin: '16px 0' }}>
                        {letras.map((l, i) => <Ficha key={i} ch={l} idioma={idioma} tam={Math.min(44, (ancho - 100) / 9)} disabled animar={false} />)}
                    </div>
                    <ListaPalabras palabras={palabrasRonda} vacio={tx.sinPalabras} />
                    {soluciones.length > 0 && (
                        <div style={{ marginTop: 18 }}>
                            <div style={{ color: T.ambar, fontWeight: 800, fontSize: '0.85rem', letterSpacing: 1, textAlign: 'center', marginBottom: 8 }}>
                                🏔️ {tx.masLargaPosible(soluciones[0].toUpperCase(), largo(soluciones[0]))}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                                {soluciones.slice(0, 14).map(s => {
                                    const ya = encontradas.has(baseDe(s, idioma));
                                    return <span key={s} style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 700, background: ya ? `${T.verde}22` : 'rgba(255,255,255,0.05)', border: `1px solid ${ya ? T.verde : T.borde}`, color: ya ? T.verde : T.texto }}>{ya ? '✓ ' : ''}{s.toUpperCase()}</span>;
                                })}
                            </div>
                            <div style={{ color: T.suave, fontSize: '0.78rem', textAlign: 'center', marginTop: 6 }}>{tx.habia(soluciones.length)}</div>
                        </div>
                    )}
                    {tildesRonda.length > 0 && (
                        <div style={{ marginTop: 16, textAlign: 'center' }}>
                            <div style={{ color: T.rojo, fontWeight: 800, fontSize: '0.85rem', marginBottom: 6 }}>{tx.repasar}</div>
                            {tildesRonda.slice(-6).map((f, k) => <div key={k} style={{ fontSize: '0.88rem' }}><s style={{ color: T.suave }}>{f.escrita}</s> → <b style={{ color: T.verde }}>{f.correcta}</b></div>)}
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
                        <Boton grande relleno onClick={() => ultima ? setFase('final') : setRonda(r => r + 1)}>{ultima ? tx.verResultado : tx.siguiente(ronda + 1)}</Boton>
                    </div>
                </Tarjeta>
            )}

            {fase === 'final' && (
                <Tarjeta style={{ width: '100%', maxWidth: 560, marginTop: '6vh', textAlign: 'center', boxSizing: 'border-box' }}>
                    <div style={{ fontSize: '3rem' }}>🏆</div>
                    <div style={{ fontSize: '3.2rem', fontWeight: 900, color: T.ambar, textShadow: `0 0 24px ${T.ambar}` }}>{stats.puntos}</div>
                    <div style={{ color: T.suave, fontWeight: 800, letterSpacing: 2, fontSize: '0.8rem' }}>{tx.puntos}</div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 26, margin: '18px 0', flexWrap: 'wrap' }}>
                        {[[tx.palabrasL, stats.aciertos, T.cian], [tx.acierto, `${Math.round((stats.aciertos / Math.max(1, stats.intentos)) * 100)}%`, T.verde], [tx.masLarga, stats.masLarga.toUpperCase() || '—', T.lila], [tx.fallosTilde, stats.fallosTilde.length, T.rojo]].map(([n, v, c]) => (
                            <div key={n}><div style={{ fontSize: '1.4rem', fontWeight: 900, color: c }}>{v}</div><div style={{ fontSize: '0.75rem', color: T.suave, fontWeight: 700 }}>{n}</div></div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <Boton onClick={() => setMostrarEnvio(true)} color={T.ambar} relleno>{tx.enviarProfe}</Boton>
                        <Boton onClick={onMenu} color={T.suave}>{tx.menuSolo}</Boton>
                    </div>
                </Tarjeta>
            )}

            {mostrarEnvio && (
                <ModalEnviarProfe idioma={idioma} onClose={() => setMostrarEnvio(false)} datos={{
                    ...stats, modo: 'Solo', idioma, rondas: conf.rondas, duracion: conf.duracion,
                    palabras: stats.palabras.map(p => p.forma),
                    fallosTilde: stats.fallosTilde.map(({ escrita, correcta }) => ({ escrita, correcta })),
                }} />
            )}
        </Pantalla>
    );
}

// ─── Duelo ───────────────────────────────────────────────────────────────────
const jugadorNuevo = (nombre) => ({ nombre, puntos: 0, palabras: [], todas: [], intentos: 0, aciertos: 0, fallosTilde: 0 });

function JuegoDuelo({ conf, dicc, onMenu }) {
    const idioma = dicc.idioma;
    const tx = textos(idioma);
    const { w, h } = useWindowSize();
    const [partida, setPartida] = useState(1);
    const [ronda, setRonda] = useState(1);
    const [letras, setLetras] = useState([]);
    const [fase, setFase] = useState('revelando'); // revelando | jugando | fin
    const [restante, setRestante] = useState(conf.cambio);
    const [jugadores, setJugadores] = useState(() => [jugadorNuevo(conf.nombre1 || `${tx.jugador} 1`), jugadorNuevo(conf.nombre2 || `${tx.jugador} 2`)]);
    const [ganador, setGanador] = useState(null);
    const [banner, setBanner] = useState(null);
    const jugRef = useRef(jugadores);
    jugRef.current = jugadores;
    const finRef = useRef(0);
    const ultimoSeg = useRef(null);
    const timeoutRef = useRef(null);

    const nuevaRonda = useCallback((primera) => {
        const ls = generarLetras(dicc);
        setLetras(ls);
        setJugadores(js => js.map(j => ({ ...j, palabras: [] })));
        setFase('revelando');
        if (primera) sonidoRevelar(ls.length, PASO_REVELAR);
        else { sonidoCambio(); setBanner({ texto: tx.nuevasLetras, n: Date.now() }); }
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            finRef.current = Date.now() + conf.cambio * 1000;
            setRestante(conf.cambio);
            setFase('jugando');
        }, (ls.length * PASO_REVELAR + 0.6) * 1000);
    }, [dicc, conf.cambio, tx]);

    useEffect(() => { nuevaRonda(ronda === 1); }, [ronda, partida, nuevaRonda]);
    useEffect(() => () => clearTimeout(timeoutRef.current), []);

    useEffect(() => {
        if (fase !== 'jugando') return;
        const iv = setInterval(() => {
            const r = Math.max(0, (finRef.current - Date.now()) / 1000);
            setRestante(r);
            const s = Math.ceil(r);
            if (s !== ultimoSeg.current) { ultimoSeg.current = s; if (s <= 3 && s > 0) sonidoTic(true); }
            if (r <= 0) { clearInterval(iv); setRonda(x => x + 1); }
        }, 100);
        return () => clearInterval(iv);
    }, [fase]);

    // ¿Alguien ha llegado a la cumbre?
    useEffect(() => {
        if (ganador != null) return;
        const k = jugadores.findIndex(j => j.puntos >= conf.meta);
        if (k < 0) return;
        setGanador(k);
        setFase('fin');
        clearTimeout(timeoutRef.current);
        sonidoFinal();
        lanzarLetras(window.innerWidth / 2, window.innerHeight * 0.45, 'VANILA', COLOR_J[k]);
        jugadores.forEach(j => guardarRegistroLocal('VANILA', {
            titulo: `VaniLa · Duelo ${jugadores[0].nombre} vs ${jugadores[1].nombre} · ${j.nombre} ${j.puntos} pts`,
            aciertos: j.aciertos, intentos: j.intentos, porcentaje: Math.round((j.aciertos / Math.max(1, j.intentos)) * 100),
            nombre: j.nombre, via: 'juego',
        }));
    }, [jugadores, conf.meta, ganador]);

    const enviarDe = (k) => (forma) => {
        const j = jugRef.current[k];
        if (j.palabras.some(p => p.forma === forma)) return { ok: false, motivo: 'repetida' };
        const r = validarPalabra(dicc, forma);
        if (r.ok) {
            const puntos = puntosDe(forma, letras.length, idioma);
            setJugadores(js => js.map((x, i) => i !== k ? x : {
                ...x, puntos: x.puntos + puntos, palabras: [...x.palabras, { forma, puntos }], todas: [...x.todas, forma],
                intentos: x.intentos + 1, aciertos: x.aciertos + 1,
            }));
            return { ok: true, puntos, conocida: r.conocida };
        }
        setJugadores(js => js.map((x, i) => i !== k ? x : { ...x, intentos: x.intentos + 1, fallosTilde: x.fallosTilde + (r.correctas ? 1 : 0) }));
        return r;
    };

    const revancha = () => {
        setJugadores(js => js.map(j => jugadorNuevo(j.nombre)));
        setGanador(null);
        setRonda(1);
        setPartida(p => p + 1);
    };

    // tres: J1 | montaña | J2 · dos: montaña arriba y J1 | J2 · uno: todo en columna (móvil)
    const disposicion = w >= 980 ? 'tres' : w >= 640 ? 'dos' : 'uno';
    const ancho = disposicion === 'tres';
    const anchoPanel = ancho ? Math.floor((w - 32 - 300 - 32) / 2) : disposicion === 'dos' ? Math.floor((w - 32 - 16) / 2) : w - 32;
    const anchoTablero = anchoPanel - 28;
    const altoMontana = ancho ? Math.min(h - 120, 560) : Math.min(disposicion === 'dos' ? 230 : 260, h * 0.3);

    const panel = (k) => {
        const j = jugadores[k];
        const c = COLOR_J[k];
        return (
            <Tarjeta key={'p' + k} style={{ width: anchoPanel, boxSizing: 'border-box', padding: 14, border: `2px solid ${c}55`, boxShadow: ganador === k ? `0 0 40px ${c}` : `0 0 24px ${c}1a` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ fontWeight: 900, color: c, fontSize: '1.05rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k ? '🧗‍♀️' : '🧗'} {j.nombre}</div>
                    <div style={{ fontWeight: 900, fontSize: '1.4rem', color: c, textShadow: `0 0 10px ${c}` }}>{j.puntos}<span style={{ fontSize: '0.75rem', color: T.suave }}> / {conf.meta}</span></div>
                </div>
                <div style={{ height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.08)', marginBottom: 12, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, (j.puntos / conf.meta) * 100)}%`, background: c, boxShadow: `0 0 10px ${c}`, transition: 'width .5s' }} />
                </div>
                <PanelLetras letras={letras} idioma={idioma} rondaKey={partida + '-' + ronda + '-' + letras.join('')} activo={fase === 'jugando'} onEnviar={enviarDe(k)} ancho={anchoTablero} color={c} />
                <div style={{ marginTop: 10 }}><ListaPalabras palabras={j.palabras} color={c} compacta vacio={tx.sinPalabras} /></div>
            </Tarjeta>
        );
    };

    const reloj = <Reloj restante={fase === 'jugando' ? restante : conf.cambio} total={conf.cambio} tam={ancho ? 84 : 64} etiqueta={tx.cambioL} />;

    return (
        <Pantalla centrar={false}>
            <Cabecera
                izquierda={<Boton onClick={onMenu} color={T.suave}>{tx.menu}</Boton>}
                centro={<div style={{ fontWeight: 900, letterSpacing: 2, color: T.suave, fontSize: '0.85rem' }}>⛰️ {tx.duelo2} #{ronda} · {IDIOMAS_PALABRAS[idioma].bandera}</div>}
            />
            {letras.length > 0 && (
                <div style={{ display: 'flex', flexDirection: ancho ? 'row' : 'column', gap: 16, alignItems: ancho ? 'flex-start' : 'center', justifyContent: 'center', width: '100%' }}>
                    {ancho && panel(0)}
                    <div style={{ width: ancho ? 300 : Math.min(w - 32, 420), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, position: ancho ? 'sticky' : 'static', top: 10 }}>
                        <div style={{ position: 'relative', width: '100%' }}>
                            <Montana jugadores={jugadores} meta={conf.meta} ganador={ganador} alto={altoMontana} />
                            <div style={{ position: 'absolute', top: 8, left: 8 }}>{reloj}</div>
                        </div>
                    </div>
                    {disposicion === 'uno' && panel(0)}
                    {disposicion !== 'dos' && panel(1)}
                    {disposicion === 'dos' && <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>{panel(0)}{panel(1)}</div>}
                </div>
            )}

            {banner && fase !== 'fin' && (
                <div key={banner.n} className="nl-anim" style={{
                    position: 'fixed', left: '50%', top: '42%', zIndex: 200, pointerEvents: 'none', padding: '16px 34px', borderRadius: 20,
                    fontWeight: 900, fontSize: 'clamp(1.3rem, 4vw, 2.2rem)', color: '#0A0918', background: T.ambar, boxShadow: `0 0 50px ${T.ambar}`,
                    animation: 'nlBanner 1.6s ease-out forwards', whiteSpace: 'nowrap',
                }}>{banner.texto}</div>
            )}

            {fase === 'fin' && ganador != null && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 250, background: 'rgba(5,4,15,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                    <Tarjeta style={{ maxWidth: 480, width: '100%', textAlign: 'center', border: `2px solid ${COLOR_J[ganador]}`, boxShadow: `0 0 60px ${COLOR_J[ganador]}66`, animation: 'nlPop .4s ease-out' }}>
                        <div style={{ fontSize: '3rem' }}>🏔️</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 900, color: COLOR_J[ganador] }}>{tx.corona(jugadores[ganador].nombre)}</div>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 30, margin: '18px 0' }}>
                            {jugadores.map((j, k) => (
                                <div key={k}>
                                    <div style={{ fontWeight: 900, fontSize: '1.8rem', color: COLOR_J[k] }}>{j.puntos}</div>
                                    <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>{j.nombre}</div>
                                    <div style={{ fontSize: '0.75rem', color: T.suave }}>{j.aciertos} {tx.masPalabras} · {j.fallosTilde} {tx.fallos}</div>
                                    <div style={{ fontSize: '0.75rem', color: T.suave }}>{tx.masLarga}: {(j.todas.reduce((m, x) => largo(x) > largo(m) ? x : m, '') || '—').toUpperCase()}</div>
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                            <Boton onClick={revancha} color={COLOR_J[ganador]} relleno grande>{tx.revancha}</Boton>
                            <Boton onClick={onMenu} color={T.suave} grande>{tx.menuSolo}</Boton>
                        </div>
                    </Tarjeta>
                </div>
            )}
        </Pantalla>
    );
}

// ─── Raíz ────────────────────────────────────────────────────────────────────
const idiomaInicial = () => {
    try {
        const p = new URLSearchParams(window.location.search).get('idioma');
        if (p && IDIOMAS_PALABRAS[p.toLowerCase()]) return p.toLowerCase();
        const g = localStorage.getItem('pikt_vanila_idioma');
        if (g && IDIOMAS_PALABRAS[g]) return g;
    } catch { /* sin almacenamiento */ }
    return 'es';
};
const salaInicial = () => { try { return new URLSearchParams(window.location.search).get('tablero') || null; } catch { return null; } };

export default function VaniLa({ onExit }) {
    const [idioma, setIdiomaState] = useState(idiomaInicial);
    const setIdioma = (l) => { setIdiomaState(l); try { localStorage.setItem('pikt_vanila_idioma', l); } catch { /* sin almacenamiento */ } };
    const { dicc, error, reintentar } = useDiccionario(idioma);
    const [sala] = useState(salaInicial);
    const [juego, setJuego] = useState(() => sala ? { modo: 'tablero', n: 1 } : null); // { modo, conf, n }
    const alMenu = () => setJuego(null);

    let pantalla;
    if (juego?.modo === 'tablero') pantalla = (
        <Suspense fallback={<Pantalla><div style={{ color: T.suave }}>…</div></Pantalla>}>
            <TableroOnline key={juego.n} idiomaInicial={idioma} codigoInicial={juego.n === 1 ? sala : null} onMenu={alMenu} />
        </Suspense>
    );
    else if (juego && dicc && juego.modo === 'solo') pantalla = <JuegoSolo key={juego.n} conf={juego.conf} dicc={dicc} onMenu={alMenu} />;
    else if (juego && dicc && juego.modo === 'duelo') pantalla = <JuegoDuelo key={juego.n} conf={juego.conf} dicc={dicc} onMenu={alMenu} />;
    else pantalla = <Menu idioma={idioma} setIdioma={setIdioma} dicc={dicc} error={error} reintentar={reintentar} onExit={onExit} onElegir={(modo, conf) => setJuego({ modo, conf, n: Date.now() })} />;

    return (
        <>
            <style>{ESTILOS_CSS}</style>
            {pantalla}
            <CapaLetras />
        </>
    );
}
