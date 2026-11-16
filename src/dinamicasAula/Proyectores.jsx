// Escenas del proyector (PDI) para cada dinámica de aula: tiempos, turnos, equipos y contenido.
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { barajar, textoItem, respuestaCorrecta, SORPRESAS } from './dinamicas';
import * as S from './sonidos';
import { useSalaSemaforo, corregirRonda, PanelSalaHost } from './SemaforoLive';
import { parsearYouTube, useReproductorYouTube } from './youtube';

// ─────────────────────────── Utilidades comunes ───────────────────────────
export const bt = (bg, extra = {}) => ({
    background: bg, color: 'white', border: 'none', borderRadius: 16, padding: '12px 20px', fontWeight: 800,
    cursor: 'pointer', fontSize: '1.05rem', fontFamily: 'inherit', boxShadow: '0 4px 0 rgba(0,0,0,0.25)', ...extra,
});
const panel = (extra = {}) => ({ background: 'rgba(255,255,255,0.14)', borderRadius: 22, padding: 18, backdropFilter: 'blur(4px)', ...extra });
const fila = (extra = {}) => ({ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', ...extra });

const fmt = (s) => { s = Math.max(0, Math.ceil(s)); return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : String(s); };

// Cuenta atrás fiable (por reloj real) con tic-tac en los 3 últimos segundos.
export function useCuenta(onFin, { avisos = true } = {}) {
    const [total, setTotal] = useState(0);
    const [restante, setRestante] = useState(0);
    const [corriendo, setCorriendo] = useState(false);
    const [ciclo, setCiclo] = useState(0);
    const finAt = useRef(0); const ultimo = useRef(0); const resto = useRef(0);
    const finRef = useRef(onFin); finRef.current = onFin;

    useEffect(() => {
        if (!corriendo) return undefined;
        const id = setInterval(() => {
            const r = Math.max(0, (finAt.current - Date.now()) / 1000);
            const s = Math.ceil(r);
            if (avisos && s !== ultimo.current && s <= 3 && s > 0) S.tic();
            ultimo.current = s;
            setRestante(r);
            if (r <= 0) { clearInterval(id); setCorriendo(false); finRef.current?.(); }
        }, 100);
        return () => clearInterval(id);
    }, [corriendo, ciclo, avisos]);

    return {
        total, restante, corriendo,
        pausado: !corriendo && restante > 0,
        iniciar(seg) { setTotal(seg); setRestante(seg); finAt.current = Date.now() + seg * 1000; ultimo.current = Math.ceil(seg); setCorriendo(true); setCiclo(c => c + 1); },
        pausar() { resto.current = Math.max(0, (finAt.current - Date.now()) / 1000); setCorriendo(false); },
        reanudar() { if (resto.current <= 0) return; finAt.current = Date.now() + resto.current * 1000; setCorriendo(true); setCiclo(c => c + 1); },
        sumar(seg) { finAt.current += seg * 1000; resto.current += seg; setTotal(t => t + seg); setRestante(r => r + seg); },
        parar() { setCorriendo(false); setRestante(0); setTotal(0); resto.current = 0; },
    };
}

export function Reloj({ c, size = 200, color = '#fde047', etiqueta }) {
    const frac = c.total ? c.restante / c.total : 0;
    const L = 2 * Math.PI * 44;
    const urgente = c.total > 0 && c.restante > 0 && c.restante <= 5;
    return (
        <div className={urgente ? 'da-latido' : ''} style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
            <svg viewBox="0 0 100 100" width={size} height={size}>
                <circle cx="50" cy="50" r="44" fill="rgba(0,0,0,0.18)" stroke="rgba(255,255,255,0.22)" strokeWidth="8" />
                <circle cx="50" cy="50" r="44" fill="none" stroke={urgente ? '#f87171' : color} strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={L} strokeDashoffset={L * (1 - frac)} transform="rotate(-90 50 50)" style={{ transition: 'stroke-dashoffset 0.12s linear' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: size * 0.3, fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{c.total ? fmt(c.restante) : '—'}</div>
                {etiqueta && <div style={{ fontSize: Math.max(11, size * 0.075), fontWeight: 700, opacity: 0.85, marginTop: 4 }}>{etiqueta}</div>}
            </div>
        </div>
    );
}

function ControlesReloj({ c }) {
    if (!c.total) return null;
    return (
        <div style={fila()}>
            {c.corriendo
                ? <button onClick={c.pausar} style={bt('rgba(0,0,0,0.3)', { padding: '8px 14px', fontSize: '0.9rem' })}>⏸️ Pausa</button>
                : c.pausado && <button onClick={c.reanudar} style={bt('rgba(0,0,0,0.3)', { padding: '8px 14px', fontSize: '0.9rem' })}>▶️ Seguir</button>}
            {(c.corriendo || c.pausado) && <button onClick={() => c.sumar(15)} style={bt('rgba(0,0,0,0.3)', { padding: '8px 14px', fontSize: '0.9rem' })}>+15 s</button>}
        </div>
    );
}

function BarraTiempo({ c, color = '#fde047' }) {
    const frac = c.total ? c.restante / c.total : 0;
    return (
        <div style={{ width: '100%', height: 34, background: 'rgba(0,0,0,0.25)', borderRadius: 999, overflow: 'hidden', position: 'relative' }}>
            <div style={{ width: `${frac * 100}%`, height: '100%', background: frac < 0.15 ? '#f87171' : color, transition: 'width 0.12s linear', borderRadius: 999 }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.2rem', color: '#111827' }}>{c.total ? fmt(c.restante) : ''}</div>
        </div>
    );
}

export function Marcador({ equipos, puntos, setPuntos, turno = -1, unidad = 'pts' }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${equipos.length > 4 ? 120 : 150}px, 1fr))`, gap: 10, width: '100%' }}>
            {equipos.map((e, i) => (
                <div key={i} className={turno === i ? 'da-latido-suave' : ''} style={{
                    background: turno === i ? 'white' : 'rgba(255,255,255,0.88)', color: '#1f2937', borderRadius: 18, padding: '8px 10px',
                    border: `4px solid ${turno === i ? e.color : 'transparent'}`, textAlign: 'center', boxShadow: turno === i ? `0 0 0 4px ${e.color}55` : 'none',
                }}>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.emoji} {e.nombre}</div>
                    <div style={{ fontSize: '2rem', fontWeight: 900, color: e.color, lineHeight: 1.1 }}>{puntos[i] || 0}<span style={{ fontSize: '0.8rem', color: '#6b7280', marginLeft: 3 }}>{unidad}</span></div>
                    {setPuntos && (
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button onClick={() => setPuntos(p => p.map((v, k) => (k === i ? Math.max(0, (v || 0) - 1) : v)))} style={miniBt}>−</button>
                            <button onClick={() => setPuntos(p => p.map((v, k) => (k === i ? (v || 0) + 1 : v)))} style={miniBt}>+</button>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
const miniBt = { width: 30, height: 26, borderRadius: 8, border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer', fontWeight: 900, fontFamily: 'inherit' };

function Podio({ equipos, puntos, unidad = 'pts', titulo = '🏆 ¡Clasificación final!' }) {
    const orden = equipos.map((e, i) => ({ ...e, p: puntos[i] || 0 })).sort((a, b) => b.p - a.p);
    const medallas = ['🥇', '🥈', '🥉'];
    useEffect(() => { S.fanfarria(); }, []);
    return (
        <div className="da-pop" style={{ ...panel(), maxWidth: 640, margin: '0 auto', width: '100%' }}>
            <Confeti />
            <div style={{ fontSize: '2rem', fontWeight: 900, textAlign: 'center', marginBottom: 12 }}>{titulo}</div>
            {orden.map((e, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'white', color: '#1f2937', borderRadius: 16, padding: '10px 16px', marginBottom: 8, borderLeft: `10px solid ${e.color}` }}>
                    <span style={{ fontSize: '1.8rem', width: 40 }}>{medallas[i] || `${i + 1}º`}</span>
                    <span style={{ flex: 1, fontWeight: 800, fontSize: '1.3rem' }}>{e.emoji} {e.nombre}</span>
                    <span style={{ fontWeight: 900, fontSize: '1.6rem', color: e.color }}>{e.p} {unidad}</span>
                </div>
            ))}
        </div>
    );
}

export function Confeti({ n = 40 }) {
    const piezas = useMemo(() => Array.from({ length: n }, (_, i) => ({
        x: Math.random() * 100, d: Math.random() * 1.2, t: 2 + Math.random() * 2, e: ['🎉', '⭐', '✨', '🎊', '💥', '🌟'][i % 6],
    })), [n]);
    return (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 5 }}>
            {piezas.map((p, i) => <span key={i} className="da-caer" style={{ position: 'absolute', left: `${p.x}%`, top: -40, fontSize: 28, animationDelay: `${p.d}s`, animationDuration: `${p.t}s` }}>{p.e}</span>)}
        </div>
    );
}

const PUNTOS_DADO = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
export function Dado({ valor, rodando, size = 150, color = '#ffffff' }) {
    return (
        <div className={rodando ? 'da-rodar' : 'da-pop'} key={rodando ? 'r' : valor} style={{
            width: size, height: size, background: color, borderRadius: size * 0.18, boxShadow: '0 8px 0 rgba(0,0,0,0.25), inset 0 -6px 0 rgba(0,0,0,0.08)',
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(3, 1fr)', padding: size * 0.12, boxSizing: 'border-box', flexShrink: 0,
        }}>
            {Array.from({ length: 9 }, (_, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {(PUNTOS_DADO[valor] || []).includes(i) && <div style={{ width: size * 0.17, height: size * 0.17, borderRadius: '50%', background: '#1f2937' }} />}
                </div>
            ))}
        </div>
    );
}

function useDado() {
    const [valor, setValor] = useState(1);
    const [rodando, setRodando] = useState(false);
    const t = useRef([]);
    useEffect(() => () => t.current.forEach(clearTimeout), []);
    const lanzar = (alFin) => {
        if (rodando) return;
        setRodando(true); S.tirarDado();
        for (let i = 1; i <= 8; i++) t.current.push(setTimeout(() => setValor(1 + Math.floor(Math.random() * 6)), i * 90));
        t.current.push(setTimeout(() => {
            const v = 1 + Math.floor(Math.random() * 6);
            setValor(v); setRodando(false); S.pitido(); alFin?.(v);
        }, 900));
    };
    return { valor, rodando, lanzar };
}

const SinContenido = ({ tipo }) => (
    <div style={{ ...panel(), textAlign: 'center', fontSize: '1.2rem', maxWidth: 560, margin: '40px auto' }}>
        😅 No hay {tipo} para esta materia.<br />Sal del proyector y escríbelos en «Contenido».
    </div>
);

const Turno = ({ e }) => e ? (
    <div className="da-pop" key={e.nombre} style={{ background: e.color, borderRadius: 999, padding: '8px 22px', fontWeight: 900, fontSize: '1.4rem', boxShadow: '0 4px 0 rgba(0,0,0,0.25)' }}>
        Turno: {e.emoji} {e.nombre}
    </div>
) : null;

const Solucion = ({ r, ver, setVer }) => {
    if (!r) return null;
    return ver
        ? <div className="da-pop" style={{ background: '#fef9c3', color: '#713f12', borderRadius: 14, padding: '10px 18px', fontWeight: 900, fontSize: '1.4rem' }}>✅ {r.split('/').join('  ·  ')}</div>
        : <button onClick={() => setVer(true)} style={bt('rgba(0,0,0,0.3)')}>👁️ Ver solución</button>;
};

// ─────────────────────────── 1. Piedra, papel o tijera por niveles ───────────────────────────
const NIVELES = [
    { e: '🥚', n: 'Huevo', g: 'agachados' }, { e: '🐣', n: 'Pollito', g: 'de cuclillas' }, { e: '🐔', n: 'Gallina', g: 'aleteando' },
    { e: '🦖', n: 'Dinosaurio', g: 'con garras' }, { e: '🐉', n: 'Dragón', g: '¡campeones!' },
];
function ProyPiedra({ cfg, contenido }) {
    const nuevas = () => barajar(contenido).slice(0, 4).map(textoItem);
    const [preg, setPreg] = useState(nuevas);
    const [grito, setGrito] = useState(null);
    const [fin, setFin] = useState(false);
    const c = useCuenta(() => { S.alarma(); setFin(true); });
    const t = useRef([]);
    useEffect(() => () => t.current.forEach(clearTimeout), []);
    const gritar = () => {
        t.current.forEach(clearTimeout); t.current = [];
        [['Piedra ✊', 0], ['Papel ✋', 650], ['Tijera ✌️', 1300], ['¡YA!', 1950]].forEach(([txt, ms], i) => t.current.push(setTimeout(() => { setGrito(txt); i === 3 ? S.inicio() : S.pitido(); }, ms)));
        t.current.push(setTimeout(() => setGrito(null), 3100));
    };
    if (!contenido.length) return <SinContenido tipo="preguntas" />;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center' }}>
            <div style={fila({ gap: 18 })}>
                <Reloj c={c} size={150} etiqueta={fin ? '¡Tiempo!' : 'tiempo de juego'} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {!c.corriendo && !c.pausado && <button onClick={() => { S.inicio(); setFin(false); c.iniciar(cfg.minutos * 60); }} style={bt('#16a34a')}>▶️ {fin ? 'Otra partida' : 'Empezar'}</button>}
                    <button onClick={gritar} style={bt('#f97316')}>✊✋✌️ ¡Piedra, papel o tijera!</button>
                    <button onClick={() => { setPreg(nuevas()); S.magia(); }} style={bt('rgba(0,0,0,0.3)')}>🔀 Nuevas preguntas</button>
                    <ControlesReloj c={c} />
                </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, width: '100%' }}>
                {NIVELES.map((n, i) => (
                    <div key={i} style={{ ...panel({ padding: 14 }), background: i === 4 ? 'rgba(250,204,21,0.35)' : 'rgba(255,255,255,0.16)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: 8, left: 12, fontWeight: 900, opacity: 0.7 }}>Nivel {i + 1}</div>
                        <div style={{ fontSize: '3.6rem' }}>{n.e}</div>
                        <div style={{ fontWeight: 900, fontSize: '1.3rem' }}>{n.n}</div>
                        <div style={{ fontSize: '0.85rem', opacity: 0.85, marginBottom: 8 }}>({n.g})</div>
                        {i < 4
                            ? <div className="da-pop" key={preg[i]} style={{ background: 'white', color: '#1f2937', borderRadius: 14, padding: 10, fontWeight: 700, fontSize: '1.02rem', width: '100%', boxSizing: 'border-box', flex: 1 }}>{preg[i] || preg[0]}</div>
                            : <div style={{ fontWeight: 800, fontSize: '1rem' }}>🏆 ¡Sentaos y ayudad a vigilar!</div>}
                    </div>
                ))}
            </div>
            <div style={{ ...panel({ padding: '10px 18px' }), fontWeight: 700, textAlign: 'center' }}>Gana ➜ sube de nivel ⬆️ · Pierde ➜ busca otra pareja de su nivel 🔁 · Primero se habla, ¡luego se juega!</div>
            {grito && <div className="da-pop" key={grito} style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(4rem, 14vw, 11rem)', fontWeight: 900, textShadow: '0 8px 0 rgba(0,0,0,0.3)', zIndex: 20, pointerEvents: 'none' }}>{grito}</div>}
        </div>
    );
}

// ─────────────────────────── 2. Baila, para y habla ───────────────────────────
function ProyBaile({ cfg, contenido }) {
    const [fase, setFaseE] = useState('listo'); // listo | bailando | hablando | fin
    const [ronda, setRonda] = useState(0);
    // Música: 'pikt' (sintetizada), 'youtube' (enlace que PiKT reproduce y para) o 'propia' (PiKT solo avisa)
    const [fuente, setFuenteE] = useState(() => { try { return localStorage.getItem('da_baile_fuente_v1') || 'pikt'; } catch { return 'pikt'; } });
    const [enlace, setEnlaceE] = useState(() => { try { return localStorage.getItem('da_baile_yt_v1') || ''; } catch { return ''; } });
    const setFuente = (f) => { setFuenteE(f); try { localStorage.setItem('da_baile_fuente_v1', f); } catch { /* */ } };
    const setEnlace = (t) => { setEnlaceE(t); try { localStorage.setItem('da_baile_yt_v1', t); } catch { /* */ } };
    const yt = useMemo(() => parsearYouTube(enlace), [enlace]);
    const reproductor = useReproductorYouTube(fuente === 'youtube' ? yt : null, 'da-baile-yt');
    const propia = fuente === 'propia';
    const conYT = fuente === 'youtube';
    const orden = useMemo(() => barajar(contenido), [contenido]);
    const faseRef = useRef('listo'); const rondaRef = useRef(0);
    const musica = useRef(null);
    if (!musica.current) musica.current = S.crearMusica();
    useEffect(() => () => musica.current?.stop(), []);
    const setFase = f => { faseRef.current = f; setFaseE(f); };
    const ytRef = useRef(reproductor); ytRef.current = reproductor;
    const fuenteRef = useRef(fuente); fuenteRef.current = fuente;
    const sonar = () => { if (fuenteRef.current === 'pikt') musica.current.start(); else if (fuenteRef.current === 'youtube') ytRef.current.play(); };
    const callar = () => { musica.current.stop(); if (fuenteRef.current === 'youtube') ytRef.current.pause(); };

    const bailar = () => {
        const min = Math.min(cfg.bailarMin, cfg.bailarMax); const max = Math.max(cfg.bailarMin, cfg.bailarMax);
        setFase('bailando');
        sonar();
        c.iniciar(min + Math.random() * (max - min));
    };
    const c = useCuenta(() => {
        if (faseRef.current === 'bailando') {
            callar(); S.alarma(); setFase('hablando'); c.iniciar(cfg.hablar);
        } else if (faseRef.current === 'hablando') {
            S.finTiempo();
            if (rondaRef.current + 1 >= cfg.rondas) { setFase('fin'); return; }
            rondaRef.current += 1; setRonda(rondaRef.current);
            setTimeout(() => { if (faseRef.current === 'hablando') bailar(); }, 900);
        }
    }, { avisos: false });

    const pausar = () => { c.pausar(); callar(); };
    const seguir = () => { c.reanudar(); if (faseRef.current === 'bailando') sonar(); };
    const reiniciar = () => { c.parar(); callar(); rondaRef.current = 0; setRonda(0); setFase('listo'); };
    const ytNoListo = conYT && (!yt || !reproductor.listo || !!reproductor.error);
    if (!contenido.length) return <SinContenido tipo="preguntas" />;
    const pregunta = textoItem(orden[ronda % orden.length]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center', textAlign: 'center' }}>
            <div style={{ fontWeight: 900, fontSize: '1.3rem' }}>Ronda {Math.min(ronda + 1, cfg.rondas)} / {cfg.rondas}</div>
            {fase === 'listo' && (
                <div style={{ ...panel(), maxWidth: 640 }}>
                    <div style={{ fontSize: '4rem' }}>💃🕺</div>
                    <div style={{ fontSize: '1.2rem', marginBottom: 14 }}>Cuando pare la música, ¡busca pareja y habla!</div>
                    <div style={fila({ marginBottom: 14 })}>
                        <button onClick={() => setFuente('pikt')} style={bt(fuente === 'pikt' ? '#ec4899' : 'rgba(0,0,0,0.25)')}>🎵 Música de PiKT</button>
                        <button onClick={() => setFuente('youtube')} style={bt(conYT ? '#ec4899' : 'rgba(0,0,0,0.25)')}>▶️ Canción de YouTube</button>
                        <button onClick={() => setFuente('propia')} style={bt(propia ? '#ec4899' : 'rgba(0,0,0,0.25)')}>📻 Mi música (PiKT avisa)</button>
                    </div>
                    {conYT && (
                        <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                            <input value={enlace} onChange={e => setEnlace(e.target.value)} placeholder="Pega el enlace de YouTube (canción o lista)" data-nombres-grupo="no"
                                style={{ width: 'min(520px, 100%)', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 14, border: 'none', fontSize: '1rem', fontFamily: 'inherit', textAlign: 'center' }} />
                            <div style={{ fontSize: '0.88rem', opacity: 0.9 }}>
                                {!enlace.trim() ? 'PiKT pondrá y parará la canción sola en un momento al azar. Cada ronda sigue por donde se quedó.'
                                    : !yt ? '⚠️ Ese enlace no parece de YouTube.'
                                        : reproductor.error ? `⚠️ ${reproductor.error}`
                                            : reproductor.listo ? '✔ Canción lista (la ves abajo a la derecha). Ajusta el volumen del ordenador.' : 'Cargando el vídeo…'}
                            </div>
                        </div>
                    )}
                    <button onClick={() => { S.despertar(); bailar(); }} disabled={ytNoListo} style={bt(ytNoListo ? 'rgba(0,0,0,0.3)' : '#16a34a', { fontSize: '1.4rem', padding: '16px 30px', cursor: ytNoListo ? 'not-allowed' : 'pointer' })}>▶️ ¡Música!</button>
                </div>
            )}
            {fase === 'bailando' && (
                <div style={{ ...panel(), maxWidth: 700, width: '100%' }}>
                    <div className="da-bailar" style={{ fontSize: 'clamp(5rem, 16vw, 9rem)' }}>💃🕺💃</div>
                    <div style={{ fontSize: '2.4rem', fontWeight: 900 }}>{propia ? '📻 ¡Pon la música y a bailar!' : '🎶 ¡A bailar!'}</div>
                    {conYT && reproductor.error && <div style={{ marginTop: 6, fontWeight: 700, color: '#fecaca' }}>⚠️ {reproductor.error}</div>}
                    <div style={{ opacity: 0.8, marginTop: 6 }}>La música parará cuando menos lo esperéis…</div>
                </div>
            )}
            {fase === 'hablando' && (
                <div className="da-pop" style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', width: '100%' }}>
                    <div style={{ fontSize: 'clamp(1.8rem, 5vw, 3rem)', fontWeight: 900 }}>{propia ? '⏸️ ¡PARA LA MÚSICA!' : '🛑 ¡STOP!'} Busca pareja y habla</div>
                    <div style={{ background: 'white', color: '#1f2937', borderRadius: 26, padding: '26px 30px', fontSize: 'clamp(1.6rem, 4.5vw, 3rem)', fontWeight: 800, maxWidth: 1000, boxShadow: '0 10px 0 rgba(0,0,0,0.2)' }}>{pregunta}</div>
                    <Reloj c={c} size={150} etiqueta="para hablar" />
                </div>
            )}
            {fase === 'fin' && <div className="da-pop" style={{ ...panel(), fontSize: '2rem', fontWeight: 900 }}><Confeti />🎉 ¡Fin del baile! ¿Qué te ha contado tu última pareja?</div>}
            <div style={fila()}>
                {(fase === 'bailando' || fase === 'hablando') && (c.corriendo
                    ? <button onClick={pausar} style={bt('rgba(0,0,0,0.3)')}>⏸️ Pausa</button>
                    : <button onClick={seguir} style={bt('rgba(0,0,0,0.3)')}>▶️ Seguir</button>)}
                {fase === 'bailando' && <button onClick={() => { c.parar(); callar(); S.alarma(); setFase('hablando'); c.iniciar(cfg.hablar); }} style={bt('#dc2626')}>🛑 Parar ya</button>}
                {fase !== 'listo' && <button onClick={reiniciar} style={bt('rgba(0,0,0,0.3)')}>↺ Reiniciar</button>}
            </div>
            {/* Reproductor de YouTube: siempre montado (si no, se cortaría la canción) en una esquina */}
            {conYT && yt && (
                <div style={{ position: 'fixed', right: 14, bottom: 14, width: 'min(300px, 42vw)', aspectRatio: '16 / 9', zIndex: 20, borderRadius: 14, overflow: 'hidden', border: '3px solid rgba(255,255,255,0.7)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', background: '#000', opacity: fase === 'hablando' ? 0.55 : 1, transition: 'opacity 0.3s' }}>
                    <div id="da-baile-yt" style={{ width: '100%', height: '100%' }} />
                </div>
            )}
        </div>
    );
}

// ─────────────────────────── 3. Luz roja, luz verde ───────────────────────────
function Semaforo({ luz, size = 70 }) {
    const l = (col, on) => <div style={{ width: size, height: size, borderRadius: '50%', background: on ? col : '#374151', boxShadow: on ? `0 0 30px ${col}` : 'inset 0 4px 8px rgba(0,0,0,0.5)', transition: 'all 0.2s' }} />;
    return (
        <div style={{ background: '#111827', borderRadius: size * 0.4, padding: size * 0.15, display: 'flex', flexDirection: 'column', gap: size * 0.12, border: '4px solid #4b5563' }}>
            {l('#ef4444', luz === 'roja')}{l('#f59e0b', luz === 'espera')}{l('#22c55e', luz === 'verde')}
        </div>
    );
}
function ProySemaforo({ cfg, contenido, equipos, onStat }) {
    const orden = useMemo(() => barajar(contenido), [contenido]);
    const [pos, setPos] = useState(() => equipos.map(() => 0));
    const [luz, setLuz] = useState('espera'); // espera | verde | roja | fin
    const [idx, setIdx] = useState(0);
    const [ver, setVer] = useState(false);
    const [marca, setMarca] = useState({}); // marcas manuales del profe (mandan sobre las automáticas)
    const [verRespuestas, setVerRespuestas] = useState(true);
    const c = useCuenta(() => { S.alarma(); setLuz('roja'); });
    const sala = useSalaSemaforo({ equipos, casillas: cfg.casillas });
    const reto = orden.length ? orden[idx % orden.length] : null;

    // Con sala: la luz, el reto (sin la solución) y las posiciones llegan a los móviles
    const ganadoresIdx = equipos.map((_, i) => i).filter(i => pos[i] >= cfg.casillas);
    const enVivo = !!sala.codigo;
    useEffect(() => {
        if (!enVivo) return;
        sala.publicar({ luz, ronda: idx, reto: luz === 'verde' || luz === 'roja' ? textoItem(reto) : null, pos, ganadores: luz === 'fin' ? ganadoresIdx : [] });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enVivo, luz, idx, pos]);
    const correccion = useMemo(() => (enVivo ? corregirRonda(sala.jugadores, idx, reto?.r, equipos.length) : null), [enVivo, sala.jugadores, idx, reto, equipos.length]);
    const marcaFinal = { ...(luz === 'roja' && correccion ? correccion.auto : {}), ...marca };

    if (!orden.length) return <SinContenido tipo="retos" />;

    const verde = () => { S.inicio(); setMarca({}); setVer(false); setLuz('verde'); c.iniciar(cfg.segundos); };
    const aplicar = () => {
        const np = pos.map((p, i) => {
            if (marcaFinal[i] === true) { onStat(true); return p + 1; }
            if (marcaFinal[i] === false) { onStat(false); return cfg.castigo === 'inicio' ? 0 : cfg.castigo === 'uno' ? Math.max(0, p - 1) : p; }
            return p;
        });
        if (enVivo) sala.publicar({ resultado: { ronda: idx, marca: Object.fromEntries(Object.entries(marcaFinal).map(([k, v]) => [k, !!v])) } });
        setPos(np);
        if (Object.values(marcaFinal).some(Boolean)) S.acierto();
        if (np.some(p => p >= cfg.casillas)) { setLuz('fin'); return; }
        setIdx(i => i + 1); setLuz('espera');
    };
    const ganadores = ganadoresIdx.map(i => equipos[i]);
    const respondidas = correccion ? correccion.porEquipo.reduce((s, g) => s + g.respuestas, 0) : 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
            {luz === 'espera' && !enVivo && (
                <div style={{ ...panel({ padding: '10px 14px' }), display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <span style={{ fontWeight: 700 }}>📱 ¿Con móviles? Cada alumno entra con un QR, elige su equipo y PiKT corrige solo.</span>
                    <button onClick={sala.abrir} style={bt('#0ea5e9', { padding: '8px 16px', fontSize: '0.95rem' })}>📱 Jugar con móviles</button>
                    {sala.error && <span style={{ color: '#fecaca', fontWeight: 700 }}>{sala.error}</span>}
                </div>
            )}
            {enVivo && sala.datos && <PanelSalaHost sala={{ codigo: sala.codigo, jugadores: sala.jugadores }} equipos={equipos} compacto={luz !== 'espera' || idx > 0} />}
            <div style={fila({ gap: 22, alignItems: 'stretch' })}>
                <Semaforo luz={luz === 'fin' ? 'verde' : luz} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'center', alignItems: 'center', maxWidth: 760 }}>
                    {luz === 'espera' && <button onClick={verde} style={bt('#16a34a', { fontSize: '1.5rem', padding: '18px 32px' })}>🟢 ¡Luz verde!</button>}
                    {luz === 'verde' && (
                        <>
                            <div className="da-pop" style={{ background: 'white', color: '#1f2937', borderRadius: 22, padding: '18px 26px', fontSize: 'clamp(1.5rem, 4vw, 2.6rem)', fontWeight: 800, textAlign: 'center' }}>{textoItem(reto)}</div>
                            <div style={fila()}><Reloj c={c} size={120} /><button onClick={() => { c.parar(); S.alarma(); setLuz('roja'); }} style={bt('#dc2626')}>🔴 ¡Luz roja ya!</button></div>
                            {enVivo && <div style={{ fontWeight: 800, fontSize: '1.2rem' }}>📨 {respondidas} de {sala.jugadores.length} han respondido</div>}
                        </>
                    )}
                    {luz === 'roja' && (
                        <>
                            <div style={{ fontSize: '2.2rem', fontWeight: 900 }}>{enVivo ? '🔴 ¡LUZ ROJA! Móviles bloqueados' : '🔴 ¡LUZ ROJA! Levantad las pizarras'}</div>
                            <div style={{ background: 'white', color: '#1f2937', borderRadius: 18, padding: '10px 20px', fontSize: '1.3rem', fontWeight: 700 }}>{textoItem(reto)}</div>
                            <Solucion r={reto.r} ver={ver} setVer={setVer} />
                            <div style={fila()}>
                                {equipos.map((e, i) => {
                                    const g = correccion?.porEquipo[i];
                                    return (
                                        <div key={i} style={{ background: 'rgba(255,255,255,0.9)', color: '#1f2937', borderRadius: 14, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <b>{e.emoji} {e.nombre}</b>
                                            {g && g.miembros > 0 && <span style={{ fontSize: '0.8rem', color: '#4b5563', fontWeight: 700 }}>{reto.r ? `${g.bien}/${g.respuestas} ✔` : `${g.respuestas} resp.`}</span>}
                                            <button onClick={() => setMarca(m => ({ ...m, [i]: true }))} style={{ ...miniBt, width: 38, height: 32, background: marcaFinal[i] === true ? '#22c55e' : '#f9fafb' }}>✔</button>
                                            <button onClick={() => setMarca(m => ({ ...m, [i]: false }))} style={{ ...miniBt, width: 38, height: 32, background: marcaFinal[i] === false ? '#ef4444' : '#f9fafb' }}>✘</button>
                                        </div>
                                    );
                                })}
                            </div>
                            {enVivo && respondidas > 0 && (
                                <div style={{ ...panel({ padding: 10 }), width: '100%', boxSizing: 'border-box' }}>
                                    <button onClick={() => setVerRespuestas(v => !v)} style={{ background: 'none', border: 'none', color: 'white', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.95rem' }}>
                                        {verRespuestas ? '▾' : '▸'} Respuestas de los móviles {reto.r ? '(PiKT marca ✔/✘ por mayoría del equipo; puedes cambiarlo)' : '(marca tú ✔/✘)'}
                                    </button>
                                    {verRespuestas && (
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                                            {equipos.map((e, i) => correccion.porEquipo[i].lista.length > 0 && (
                                                <div key={i} style={{ background: 'rgba(255,255,255,0.92)', color: '#1f2937', borderRadius: 12, padding: '6px 10px', borderLeft: `6px solid ${e.color}`, fontSize: '0.85rem', maxWidth: 300 }}>
                                                    <b>{e.emoji} {e.nombre}</b>
                                                    {correccion.porEquipo[i].lista.map((r, k) => <div key={k}>{r.ok === true ? '✅' : r.ok === false ? '❌' : '•'} {r.nombre}: «{r.texto}»</div>)}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                            <button onClick={aplicar} style={bt('#2563eb')}>➡️ Mover fichas y seguir</button>
                        </>
                    )}
                    {luz === 'fin' && <div className="da-pop" style={{ ...panel(), fontSize: '2.2rem', fontWeight: 900, textAlign: 'center' }}><Confeti />🏁 ¡Meta! Ganan {ganadores.map(e => `${e.emoji} ${e.nombre}`).join(' y ')}</div>}
                </div>
            </div>
            <div style={{ ...panel({ padding: 12 }), width: '100%', boxSizing: 'border-box' }}>
                {equipos.map((e, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <div style={{ width: 140, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.emoji} {e.nombre}</div>
                        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${cfg.casillas + 1}, 1fr)`, gap: 4 }}>
                            {Array.from({ length: cfg.casillas + 1 }, (_, k) => (
                                <div key={k} style={{ height: 46, borderRadius: 10, background: k === cfg.casillas ? 'repeating-conic-gradient(#111 0 25%, #fff 0 50%) 0 0/16px 16px' : k === 0 ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.7rem' }}>
                                    {Math.min(pos[i], cfg.casillas) === k ? <span className="da-pop" key={pos[i]} style={{ background: e.color, borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid white' }}>{e.emoji}</span> : k === 0 ? <span style={{ fontSize: '0.7rem', fontWeight: 800 }}>SALIDA</span> : ''}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─────────────────────────── 4. Citas rápidas ───────────────────────────
function ProyCitas({ cfg, contenido, filas }) {
    const orden = useMemo(() => barajar(contenido), [contenido]);
    const [fase, setFaseE] = useState('listo'); // listo | cita | rotar | fin
    const [ronda, setRonda] = useState(0);
    const faseRef = useRef('listo'); const rondaRef = useRef(0); const aviso = useRef(false);
    const setFase = f => { faseRef.current = f; setFaseE(f); };
    const c = useCuenta(() => {
        if (faseRef.current === 'cita') {
            S.alarma();
            if (rondaRef.current + 1 >= cfg.rondas) { setFase('fin'); return; }
            setFase('rotar'); c.iniciar(cfg.cambio);
        } else if (faseRef.current === 'rotar') {
            rondaRef.current += 1; setRonda(rondaRef.current); aviso.current = false;
            S.inicio(); setFase('cita'); c.iniciar(cfg.ronda);
        }
    });
    useEffect(() => {
        if (fase === 'cita' && c.corriendo && c.restante <= 10 && c.restante > 9 && !aviso.current && cfg.ronda > 15) { aviso.current = true; S.pitido(); }
    }, [c.restante, c.corriendo, fase, cfg.ronda]);

    const parejas = useMemo(() => {
        if (!filas || filas.length < 2) return null;
        const n = Math.max(filas[0].length, filas[1].length);
        const A = Array.from({ length: n }, (_, i) => filas[0][i] || null);
        const B = Array.from({ length: n }, (_, i) => filas[1][i] || null);
        const r = fase === 'rotar' ? ronda + 1 : ronda;
        return A.map((a, i) => [a, B[((i - r) % n + n) % n]]);
    }, [filas, ronda, fase]);

    if (!orden.length) return <SinContenido tipo="preguntas" />;
    const pregunta = textoItem(orden[ronda % orden.length]);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', textAlign: 'center' }}>
            <div style={{ fontWeight: 900, fontSize: '1.3rem' }}>Cita {Math.min(ronda + 1, cfg.rondas)} / {cfg.rondas}</div>
            {fase === 'listo' && <button onClick={() => { S.despertar(); S.inicio(); aviso.current = false; setFase('cita'); c.iniciar(cfg.ronda); }} style={bt('#16a34a', { fontSize: '1.5rem', padding: '18px 32px' })}>▶️ ¡Empezar las citas!</button>}
            {fase === 'cita' && (
                <>
                    <div className="da-pop" key={ronda} style={{ background: 'white', color: '#1f2937', borderRadius: 26, padding: '24px 30px', fontSize: 'clamp(1.6rem, 4.5vw, 3rem)', fontWeight: 800, maxWidth: 1000, boxShadow: '0 10px 0 rgba(0,0,0,0.2)' }}>💬 {pregunta}</div>
                    <div style={{ width: 'min(900px, 100%)' }}><BarraTiempo c={c} /></div>
                    <div style={fila()}><ControlesReloj c={c} /><button onClick={() => c.iniciar(0.05)} style={bt('rgba(0,0,0,0.3)', { padding: '8px 14px', fontSize: '0.9rem' })}>⏭️ Rotar ya</button></div>
                </>
            )}
            {fase === 'rotar' && (
                <div className="da-pop" style={{ ...panel(), maxWidth: 800 }}>
                    <div className="da-deslizar" style={{ fontSize: '4rem' }}>➡️🪑➡️</div>
                    <div style={{ fontSize: 'clamp(2rem, 6vw, 3.6rem)', fontWeight: 900 }}>¡A ROTAR!</div>
                    <div style={{ fontSize: '1.3rem' }}>La fila B se mueve un puesto a la derecha</div>
                    <div style={{ width: 'min(600px, 100%)', margin: '14px auto 0' }}><BarraTiempo c={c} color="#93c5fd" /></div>
                </div>
            )}
            {fase === 'fin' && <div className="da-pop" style={{ ...panel(), fontSize: '2rem', fontWeight: 900 }}><Confeti />🎉 ¡Fin de las citas! Puesta en común: «Mi pareja me dijo que…»</div>}
            {parejas && fase !== 'fin' && (
                <div style={{ ...panel({ padding: 12 }), width: '100%', boxSizing: 'border-box' }}>
                    <div style={{ fontWeight: 800, marginBottom: 8 }}>{fase === 'rotar' ? '👀 Nuevas parejas' : 'Parejas de esta cita'} · Fila A ↔ Fila B</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 6 }}>
                        {parejas.map(([a, b], i) => (
                            <div key={i} style={{ background: 'rgba(255,255,255,0.9)', color: '#1f2937', borderRadius: 12, padding: '6px 10px', fontWeight: 700, fontSize: '0.95rem' }}>
                                <span style={{ color: '#dc2626' }}>{a || '🪑 descanso'}</span> ↔ <span style={{ color: '#2563eb' }}>{b || '🪑 descanso'}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {fase !== 'listo' && <button onClick={() => { c.parar(); rondaRef.current = 0; setRonda(0); setFase('listo'); }} style={bt('rgba(0,0,0,0.3)')}>↺ Reiniciar</button>}
        </div>
    );
}

// ─────────────────────────── 5. Mímica y frase ───────────────────────────
function ProyMimica({ cfg, contenido, equipos, onStat }) {
    const [mazo, setMazo] = useState(() => barajar(contenido.map(textoItem)));
    const [palabra, setPalabra] = useState('');
    const [turno, setTurno] = useState(0);
    const [puntos, setPuntos] = useState(() => equipos.map(() => 0));
    const [fase, setFaseE] = useState('dado'); // dado | carta | mimo | frase | fallo | hecho
    const [ver, setVer] = useState(false);
    const [ganados, setGanados] = useState(0);
    const faseRef = useRef('dado');
    const setFase = f => { faseRef.current = f; setFaseE(f); };
    const dado = useDado();
    const valor = Math.ceil(dado.valor / 2);
    const c = useCuenta(() => { S.finTiempo(); if (faseRef.current === 'mimo') { setFase('fallo'); onStat(false); } });
    if (!contenido.length) return <SinContenido tipo="palabras" />;

    const robar = () => {
        let m = mazo.length ? mazo : barajar(contenido.map(textoItem));
        setPalabra(m[0]); setMazo(m.slice(1)); setFase('carta');
    };
    const sumar = (n) => setPuntos(p => p.map((v, i) => (i === turno ? v + n : v)));
    const siguiente = () => { c.parar(); setVer(false); setTurno(t => (t + 1) % equipos.length); setFase('dado'); };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', textAlign: 'center' }}>
            <Turno e={equipos[turno]} />
            {fase === 'dado' && (
                <div style={fila({ gap: 24 })}>
                    <Dado valor={dado.valor} rodando={dado.rodando} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ ...panel({ padding: 12 }), fontWeight: 700 }}>⚀⚁ = 1 punto · ⚂⚃ = 2 puntos · ⚄⚅ = 3 puntos</div>
                        <button onClick={() => dado.lanzar(() => robar())} style={bt('#8b5cf6', { fontSize: '1.4rem' })}>🎲 Lanzar el dado</button>
                    </div>
                </div>
            )}
            {fase === 'carta' && (
                <div className="da-pop" style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>Os jugáis {valor} {valor === 1 ? 'punto' : 'puntos'} (¡{valor * 2} con la frase!)</div>
                    <button onPointerDown={() => setVer(true)} onPointerUp={() => setVer(false)} onPointerLeave={() => setVer(false)} onContextMenu={e => e.preventDefault()}
                        style={{ width: 'min(520px, 90vw)', height: 220, borderRadius: 26, border: '6px dashed white', background: ver ? 'white' : 'rgba(0,0,0,0.25)', color: ver ? '#6d28d9' : 'white', fontSize: ver ? 'clamp(2rem, 6vw, 3.4rem)' : '1.4rem', fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit', userSelect: 'none', touchAction: 'none' }}>
                        {ver ? palabra : '🃏 Solo el mimo: mantén pulsado para ver la palabra'}
                    </button>
                    <button onClick={() => { S.inicio(); setVer(false); setFase('mimo'); c.iniciar(cfg.mimo); }} style={bt('#16a34a', { fontSize: '1.3rem' })}>▶️ ¡Empieza la mímica!</button>
                </div>
            )}
            {fase === 'mimo' && (
                <div style={fila({ gap: 24 })}>
                    <div className="da-bailar" style={{ fontSize: '6rem' }}>🎭</div>
                    <Reloj c={c} size={170} etiqueta="mímica" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <button onClick={() => { c.parar(); S.acierto(); sumar(valor); setGanados(valor); setFase('frase'); c.iniciar(cfg.frase); }} style={bt('#16a34a')}>✔ ¡Lo han adivinado!</button>
                        <button onClick={() => { c.parar(); S.fallo(); onStat(false); setFase('fallo'); }} style={bt('#dc2626')}>✘ Se rinden</button>
                    </div>
                </div>
            )}
            {fase === 'frase' && (
                <div className="da-pop" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>+{valor} ✔ Ahora construid una frase correcta con…</div>
                    <div style={{ background: 'white', color: '#6d28d9', borderRadius: 24, padding: '16px 34px', fontSize: 'clamp(2rem, 6vw, 3.6rem)', fontWeight: 900 }}>{palabra}</div>
                    <div style={fila()}>
                        <Reloj c={c} size={130} etiqueta="frase" />
                        <button onClick={() => { c.parar(); S.acierto(); sumar(valor); setGanados(valor * 2); onStat(true); setFase('hecho'); }} style={bt('#16a34a')}>✔ Frase correcta (¡doble!)</button>
                        <button onClick={() => { c.parar(); onStat(false); setFase('hecho'); }} style={bt('#f59e0b')}>✘ Frase con errores</button>
                    </div>
                </div>
            )}
            {(fase === 'fallo' || fase === 'hecho') && (
                <div className="da-pop" style={{ ...panel(), minWidth: 300 }}>
                    <div style={{ fontSize: '1.2rem' }}>La palabra era</div>
                    <div style={{ fontSize: '2.6rem', fontWeight: 900 }}>{palabra}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, margin: '8px 0 14px' }}>{fase === 'fallo' ? '😅 0 puntos esta vez' : `🎉 +${ganados} puntos`}</div>
                    <button onClick={siguiente} style={bt('#2563eb')}>➡️ Siguiente equipo</button>
                </div>
            )}
            <Marcador equipos={equipos} puntos={puntos} setPuntos={setPuntos} turno={turno} />
        </div>
    );
}

// ─────────────────────────── 6. Kaboom ───────────────────────────
function ProyKaboom({ cfg, contenido, equipos, onStat }) {
    const crearBote = () => barajar([...contenido.map((x, i) => ({ id: `r${i}`, tipo: 'reto', p: textoItem(x), r: x.r || '' })), ...Array.from({ length: cfg.kabooms }, (_, i) => ({ id: `k${i}`, tipo: 'kaboom' }))]);
    const [bote, setBote] = useState(crearBote);
    const [manos, setManos] = useState(() => equipos.map(() => []));
    const [turno, setTurno] = useState(0);
    const [actual, setActual] = useState(null);
    const [fase, setFase] = useState('robar'); // robar | reto | kaboom | fin
    const [ver, setVer] = useState(false);
    const c = useCuenta(() => S.finTiempo());
    if (!contenido.length) return <SinContenido tipo="retos" />;

    const robar = () => {
        const i = Math.floor(Math.random() * bote.length);
        const p = bote[i]; const resto = bote.filter((_, k) => k !== i);
        setActual(p); setVer(false);
        if (p.tipo === 'kaboom') {
            S.explosion();
            setBote(barajar([...resto, p, ...manos[turno]]));
            setManos(m => m.map((x, k) => (k === turno ? [] : x)));
            setFase('kaboom');
        } else { setBote(resto); setFase('reto'); S.pitido(); c.iniciar(cfg.segundos); }
    };
    const resolver = (ok) => {
        c.parar(); onStat(ok);
        if (ok) { S.acierto(); setManos(m => m.map((x, k) => (k === turno ? [...x, actual] : x))); }
        else { S.fallo(); setBote(b => barajar([...b, actual])); }
        setFase('pasar');
    };
    const siguiente = () => {
        if (!bote.some(p => p.tipo === 'reto')) { setFase('fin'); return; }
        setTurno(t => (t + 1) % equipos.length); setActual(null); setFase('robar');
    };
    const quedan = bote.filter(p => p.tipo === 'reto').length;
    if (fase === 'fin') return <Podio equipos={equipos} puntos={manos.map(m => m.length)} unidad="palitos" />;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', textAlign: 'center' }}>
            <Turno e={equipos[turno]} />
            <div style={fila({ gap: 24 })}>
                <div style={{ position: 'relative', width: 150, height: 170 }}>
                    <div style={{ position: 'absolute', bottom: 0, left: 15, width: 120, height: 110, background: 'rgba(255,255,255,0.3)', borderRadius: '10px 10px 30px 30px', border: '4px solid white' }} />
                    {Array.from({ length: Math.min(bote.length, 14) }, (_, i) => (
                        <div key={i} style={{ position: 'absolute', bottom: 60, left: 30 + (i * 7) % 90, width: 10, height: 100, background: ['#fde047', '#fb923c', '#f472b6', '#60a5fa', '#4ade80'][i % 5], borderRadius: 5, transform: `rotate(${(i % 5 - 2) * 6}deg)`, transformOrigin: 'bottom' }} />
                    ))}
                    <div style={{ position: 'absolute', bottom: 30, width: '100%', fontWeight: 900, fontSize: '1.1rem' }}>{bote.length} palitos</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', maxWidth: 700 }}>
                    {fase === 'robar' && <button onClick={robar} style={bt('#f59e0b', { fontSize: '1.5rem', padding: '18px 30px' })}>🥢 Robar un palito</button>}
                    {fase === 'reto' && actual && (
                        <>
                            <div className="da-pop" style={{ background: '#fde047', color: '#1f2937', borderRadius: 18, padding: '18px 26px', fontSize: 'clamp(1.5rem, 4vw, 2.6rem)', fontWeight: 900, border: '6px solid white' }}>{actual.p}</div>
                            <div style={fila()}><Reloj c={c} size={110} /><Solucion r={actual.r} ver={ver} setVer={setVer} /></div>
                            <div style={fila()}>
                                <button onClick={() => resolver(true)} style={bt('#16a34a')}>✔ ¡Bien! Se lo quedan</button>
                                <button onClick={() => resolver(false)} style={bt('#dc2626')}>✘ Vuelve al bote</button>
                            </div>
                        </>
                    )}
                    {fase === 'kaboom' && (
                        <div className="da-explosion" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                            <div style={{ fontSize: 'clamp(5rem, 15vw, 9rem)', lineHeight: 1 }}>💥</div>
                            <div style={{ fontSize: 'clamp(2.5rem, 8vw, 5rem)', fontWeight: 900, color: '#fde047', textShadow: '0 6px 0 #b91c1c' }}>¡KABOOM!</div>
                            <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{equipos[turno].emoji} {equipos[turno].nombre} devuelve todos sus palitos al bote</div>
                            <button onClick={siguiente} style={bt('#2563eb')}>➡️ Siguiente equipo</button>
                        </div>
                    )}
                    {fase === 'pasar' && <button onClick={siguiente} style={bt('#2563eb', { fontSize: '1.3rem' })}>➡️ Siguiente equipo</button>}
                    <div style={{ opacity: 0.85, fontWeight: 700 }}>Quedan {quedan} retos y {bote.length - quedan} 💣 en el bote</div>
                </div>
            </div>
            <Marcador equipos={equipos} puntos={manos.map(m => m.length)} turno={turno} unidad="🥢" />
            <button onClick={() => setFase('fin')} style={bt('rgba(0,0,0,0.3)')}>🏁 Terminar partida</button>
        </div>
    );
}

// ─────────────────────────── 7. Reto de los 10 sobres ───────────────────────────
function ProySobres({ cfg, contenido, equipos, onStat }) {
    const retos = useMemo(() => contenido.slice(0, 10), [contenido]);
    const [prog, setProg] = useState(() => equipos.map(() => 0));
    const [tiempos, setTiempos] = useState(() => equipos.map(() => null));
    const [resp, setResp] = useState(() => equipos.map(() => ''));
    const [verReto, setVerReto] = useState({});
    const [error, setError] = useState(-1);
    const [inicio, setInicio] = useState(null);
    const [fin, setFin] = useState(false);
    const c = useCuenta(() => { S.alarma(); setFin(true); });
    if (!retos.length) return <SinContenido tipo="retos" />;
    const N = retos.length;

    const abrir = (i) => {
        S.magia(); onStat(true);
        const np = prog.map((p, k) => (k === i ? p + 1 : p));
        setProg(np); setResp(r => r.map((x, k) => (k === i ? '' : x)));
        if (np[i] >= N) { setTiempos(t => t.map((x, k) => (k === i ? Math.round((Date.now() - (inicio || Date.now())) / 1000) : x))); S.fanfarria(); }
        if (np.every(p => p >= N)) { c.parar(); setFin(true); }
    };
    const comprobar = (i) => {
        const reto = retos[prog[i]];
        if (respuestaCorrecta(resp[i], reto.r)) abrir(i);
        else { S.fallo(); onStat(false); setError(i); setTimeout(() => setError(-1), 600); }
    };
    const ranking = equipos.map((e, i) => ({ e, p: prog[i], t: tiempos[i] })).sort((a, b) => b.p - a.p || (a.t ?? 1e9) - (b.t ?? 1e9));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
            <div style={fila({ gap: 18 })}>
                <Reloj c={c} size={130} etiqueta={fin ? '¡Tiempo!' : 'reto'} />
                {!inicio && <button onClick={() => { S.inicio(); setInicio(Date.now()); c.iniciar(cfg.minutos * 60); }} style={bt('#16a34a', { fontSize: '1.4rem' })}>▶️ ¡Abrid el sobre 1!</button>}
                <ControlesReloj c={c} />
            </div>
            {fin && (
                <div className="da-pop" style={{ ...panel(), width: 'min(640px, 100%)' }}>
                    <Confeti />
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, textAlign: 'center', marginBottom: 8 }}>🏆 Clasificación</div>
                    {ranking.map(({ e, p, t }, k) => (
                        <div key={k} style={{ background: 'white', color: '#1f2937', borderRadius: 14, padding: '8px 14px', marginBottom: 6, display: 'flex', gap: 10, borderLeft: `8px solid ${e.color}`, fontWeight: 800 }}>
                            <span>{['🥇', '🥈', '🥉'][k] || `${k + 1}º`}</span><span style={{ flex: 1 }}>{e.emoji} {e.nombre}</span><span>{p}/{N} ✉️{t != null ? ` · ${fmt(t)}` : ''}</span>
                        </div>
                    ))}
                </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
                {equipos.map((e, i) => {
                    const hecho = prog[i] >= N; const reto = retos[prog[i]];
                    return (
                        <div key={i} className={error === i ? 'da-temblor' : ''} style={{ ...panel({ padding: 12 }), borderLeft: `10px solid ${e.color}` }}>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                                <div style={{ fontWeight: 900, fontSize: '1.2rem', minWidth: 140 }}>{e.emoji} {e.nombre}</div>
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 }}>
                                    {retos.map((_, k) => (
                                        <div key={k} title={`Sobre ${k + 1}`} style={{
                                            width: 46, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: k < prog[i] ? '1.3rem' : '0.95rem',
                                            background: k < prog[i] ? '#22c55e' : k === prog[i] ? '#fde047' : 'rgba(255,255,255,0.25)', color: k === prog[i] ? '#1f2937' : 'white',
                                            border: k === prog[i] ? '3px solid white' : 'none',
                                        }}>{k < prog[i] ? '📨' : k === prog[i] ? `✉️${k + 1}` : `🔒${k + 1}`}</div>
                                    ))}
                                </div>
                                {hecho ? <div style={{ fontWeight: 900, fontSize: '1.2rem' }}>🏆 ¡Completado! {tiempos[i] != null ? fmt(tiempos[i]) : ''}</div> : (
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                        {reto?.r && <input value={resp[i]} onChange={ev => setResp(r => r.map((x, k) => (k === i ? ev.target.value : x)))} onKeyDown={ev => { if (ev.key === 'Enter') comprobar(i); }}
                                            placeholder={`Respuesta sobre ${prog[i] + 1}`} style={{ padding: '9px 12px', borderRadius: 10, border: 'none', fontSize: '1rem', fontFamily: 'inherit', width: 190 }} />}
                                        {reto?.r && <button onClick={() => comprobar(i)} style={bt('#2563eb', { padding: '9px 14px', fontSize: '0.95rem' })}>Comprobar</button>}
                                        <button onClick={() => abrir(i)} title="Validar a mano" style={bt('#16a34a', { padding: '9px 12px', fontSize: '0.95rem' })}>✔</button>
                                        <button onClick={() => setVerReto(v => ({ ...v, [i]: !v[i] }))} style={bt('rgba(0,0,0,0.3)', { padding: '9px 12px', fontSize: '0.95rem' })}>👁️</button>
                                    </div>
                                )}
                            </div>
                            {verReto[i] && !hecho && <div style={{ marginTop: 8, background: 'white', color: '#1f2937', borderRadius: 12, padding: '8px 14px', fontWeight: 700, fontSize: '1.15rem' }}>✉️ {prog[i] + 1}. {textoItem(reto)}</div>}
                        </div>
                    );
                })}
            </div>
            {!fin && inicio && <button onClick={() => { c.parar(); setFin(true); }} style={bt('rgba(0,0,0,0.3)')}>🏁 Terminar</button>}
        </div>
    );
}

// ─────────────────────────── 8. La silla caliente ───────────────────────────
const COLORES_SILLA = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
function ProySilla({ cfg, contenido, extra, equipos, onStat }) {
    const [mazo, setMazo] = useState(() => barajar(contenido.map(textoItem)));
    const [idx, setIdx] = useState(0);
    const [turno, setTurno] = useState(0);
    const [puntos, setPuntos] = useState(() => equipos.map(() => 0));
    const [aciertos, setAciertos] = useState(0);
    const [fase, setFase] = useState('listo'); // listo | juego | fin
    const c = useCuenta(() => { S.alarma(); setFase('fin'); });
    if (!contenido.length) return <SinContenido tipo="palabras" />;
    const palabra = mazo[idx % mazo.length];
    const color = COLORES_SILLA[idx % COLORES_SILLA.length];
    const otra = () => { if (idx + 1 >= mazo.length) { setMazo(barajar(mazo)); setIdx(0); } else setIdx(i => i + 1); };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', textAlign: 'center' }}>
            <Turno e={equipos[turno]} />
            {fase === 'listo' && (
                <div style={{ ...panel(), maxWidth: 640 }}>
                    <div style={{ fontSize: '4rem' }}>🔥🪑</div>
                    <div style={{ fontSize: '1.3rem', marginBottom: 14 }}>Un miembro de <b>{equipos[turno].nombre}</b> se sienta de espaldas a la pantalla.</div>
                    <button onClick={() => { S.inicio(); setAciertos(0); setFase('juego'); c.iniciar(cfg.turno); }} style={bt('#16a34a', { fontSize: '1.4rem' })}>▶️ ¡Empezar!</button>
                </div>
            )}
            {fase === 'juego' && (
                <>
                    <div className="da-pop" key={idx} style={{ background: color, borderRadius: 30, padding: '30px 50px', fontSize: 'clamp(3rem, 12vw, 8rem)', fontWeight: 900, border: '8px solid white', boxShadow: '0 12px 0 rgba(0,0,0,0.25)', maxWidth: '95%', wordBreak: 'break-word', textShadow: '0 4px 0 rgba(0,0,0,0.2)' }}>{palabra}</div>
                    <div style={fila({ gap: 16 })}>
                        <Reloj c={c} size={130} etiqueta={`${aciertos} ✔`} />
                        <button onClick={() => { S.acierto(); onStat(true); setAciertos(a => a + 1); setPuntos(p => p.map((v, i) => (i === turno ? v + 1 : v))); otra(); }} style={bt('#16a34a', { fontSize: '1.4rem', padding: '16px 28px' })}>✔ ¡Acertada!</button>
                        <button onClick={() => { S.pitido(); otra(); }} style={bt('#f59e0b', { fontSize: '1.2rem' })}>⏭️ Pasar</button>
                        <ControlesReloj c={c} />
                    </div>
                </>
            )}
            {fase === 'fin' && (
                <div className="da-pop" style={{ ...panel(), minWidth: 300 }}>
                    <div style={{ fontSize: '2.2rem', fontWeight: 900 }}>⏰ ¡Tiempo!</div>
                    <div style={{ fontSize: '1.5rem', margin: '8px 0 14px' }}>{equipos[turno].emoji} {equipos[turno].nombre}: <b>{aciertos}</b> {aciertos === 1 ? 'palabra' : 'palabras'}</div>
                    <button onClick={() => { setTurno(t => (t + 1) % equipos.length); otra(); setFase('listo'); }} style={bt('#2563eb')}>➡️ Siguiente equipo</button>
                </div>
            )}
            {(extra.pistas || []).length > 0 && (
                <div style={{ ...panel({ padding: '10px 16px' }), display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
                    <b>💡 Pistas:</b>{extra.pistas.map((p, i) => <span key={i} style={{ background: 'white', color: '#1f2937', borderRadius: 999, padding: '5px 14px', fontWeight: 700 }}>{p}</span>)}
                    <span style={{ fontWeight: 800 }}>🚫 ¡Prohibido decir la palabra!</span>
                </div>
            )}
            <Marcador equipos={equipos} puntos={puntos} setPuntos={setPuntos} turno={turno} />
        </div>
    );
}

// ─────────────────────────── 9. Lanza y habla ───────────────────────────
function Rodillo({ titulo, opciones, valor, girando, color }) {
    const [vista, setVista] = useState(valor);
    useEffect(() => {
        if (!girando) { setVista(valor); return undefined; }
        const id = setInterval(() => setVista(opciones[Math.floor(Math.random() * opciones.length)]), 80);
        return () => clearInterval(id);
    }, [girando, valor, opciones]);
    return (
        <div style={{ background: 'white', color: '#1f2937', borderRadius: 18, padding: '10px 14px', minWidth: 180, flex: '1 1 180px', borderTop: `8px solid ${color}` }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color, textTransform: 'uppercase' }}>{titulo}</div>
            <div className={girando ? 'da-girar-texto' : 'da-pop'} key={girando ? 'g' : vista} style={{ fontSize: '1.6rem', fontWeight: 900, minHeight: 40 }}>{vista || '?'}</div>
        </div>
    );
}
function ProyDado({ cfg, contenido, extra, onStat }) {
    const dado = useDado();
    const [tirado, setTirado] = useState(false);
    const [modoRuleta, setModoRuleta] = useState(false);
    const [reel, setReel] = useState({ s: '', t: '', c: '' });
    const [girando, setGirando] = useState([false, false, false]);
    const c = useCuenta(() => S.finTiempo());
    const t = useRef([]);
    useEffect(() => () => t.current.forEach(clearTimeout), []);
    const piezas = extra.piezas;
    const est = contenido.map(textoItem);
    if (!est.length) return <SinContenido tipo="estructuras" />;

    const lanzar = () => { c.parar(); dado.lanzar(() => { setTirado(true); c.iniciar(cfg.hablar); }); };
    const girar = () => {
        const al = a => a[Math.floor(Math.random() * a.length)];
        c.parar(); setGirando([true, true, true]); S.tirarDado();
        const nuevo = { s: al(piezas.sujetos), t: al(piezas.tiempos), c: al(piezas.complementos) };
        setReel(nuevo);
        [700, 1100, 1500].forEach((ms, i) => t.current.push(setTimeout(() => { S.pitido(); setGirando(g => g.map((x, k) => (k === i ? false : x))); if (i === 2) c.iniciar(cfg.hablar); }, ms)));
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
            {piezas && (
                <div style={fila()}>
                    <button onClick={() => setModoRuleta(false)} style={bt(!modoRuleta ? '#14b8a6' : 'rgba(0,0,0,0.25)')}>🎲 Dado de estructuras</button>
                    <button onClick={() => setModoRuleta(true)} style={bt(modoRuleta ? '#14b8a6' : 'rgba(0,0,0,0.25)')}>🎰 Ruleta de frase</button>
                </div>
            )}
            {!modoRuleta ? (
                <div style={fila({ gap: 24, alignItems: 'flex-start' })}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
                        <Dado valor={dado.valor} rodando={dado.rodando} size={170} />
                        <button onClick={lanzar} disabled={dado.rodando} style={bt('#14b8a6', { fontSize: '1.4rem' })}>🎲 ¡Lanzar!</button>
                        {tirado && <Reloj c={c} size={120} etiqueta="para hablar" />}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 'min(620px, 100%)' }}>
                        {est.slice(0, 6).map((e, i) => {
                            const on = tirado && !dado.rodando && dado.valor === i + 1;
                            return (
                                <div key={i} className={on ? 'da-pop' : ''} style={{ display: 'flex', alignItems: 'center', gap: 12, background: on ? 'white' : 'rgba(255,255,255,0.16)', color: on ? '#0f766e' : 'white', borderRadius: 16, padding: on ? '14px 16px' : '8px 14px', fontWeight: on ? 900 : 700, fontSize: on ? '1.5rem' : '1.05rem', transition: 'all 0.2s' }}>
                                    <span style={{ background: on ? '#14b8a6' : 'rgba(0,0,0,0.25)', color: 'white', borderRadius: 10, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, flexShrink: 0 }}>{i + 1}</span>{e}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', width: 'min(900px, 100%)' }}>
                    <div style={fila({ width: '100%', alignItems: 'stretch' })}>
                        <Rodillo titulo="Sujeto" opciones={piezas.sujetos} valor={reel.s} girando={girando[0]} color="#ef4444" />
                        <Rodillo titulo="Tiempo verbal" opciones={piezas.tiempos} valor={reel.t} girando={girando[1]} color="#2563eb" />
                        <Rodillo titulo="Complemento" opciones={piezas.complementos} valor={reel.c} girando={girando[2]} color="#16a34a" />
                    </div>
                    <div style={fila()}>
                        <button onClick={girar} disabled={girando.some(Boolean)} style={bt('#14b8a6', { fontSize: '1.4rem' })}>🎰 ¡Girar!</button>
                        {reel.s && <Reloj c={c} size={110} etiqueta="para hablar" />}
                    </div>
                </div>
            )}
            <div style={fila()}>
                <button onClick={() => { S.acierto(); onStat(true); c.parar(); }} style={bt('#16a34a')}>✔ Frase correcta</button>
                <button onClick={() => { S.fallo(); onStat(false); c.parar(); }} style={bt('#dc2626')}>✘ Hay que mejorarla</button>
                <ControlesReloj c={c} />
            </div>
        </div>
    );
}

// ─────────────────────────── 10. Tablero sorpresa ───────────────────────────
const PESOS_SORPRESA = ['doble', 'robar', 'regalo', 'cambio', 'estrella', 'bomba', 'doble', 'robar', 'estrella'];
function ProyTablero({ cfg, contenido, equipos, onStat }) {
    // Con categorías (líneas «# Nombre», p. ej. importadas de Money Board): columnas por categoría y
    // valor creciente por fila (10, 20, 30…). Sin categorías: casillas numeradas con valores al azar.
    const [{ casillas, cats, nFilas }] = useState(() => {
        const nombres = [...new Set(contenido.map(r => r.c).filter(Boolean))].slice(0, 6);
        let retos;
        let filasMax = 0;
        if (nombres.length) {
            filasMax = Math.min(5, Math.max(...nombres.map(n => contenido.filter(r => r.c === n).length)));
            retos = nombres.flatMap((n, col) => contenido.filter(r => r.c === n).slice(0, filasMax).map((r, fila) => ({ ...r, col, fila })));
        } else retos = barajar(contenido).slice(0, cfg.casillas);
        const idx = barajar(retos.map((_, i) => i)).slice(0, Math.min(cfg.sorpresas, retos.length));
        return {
            cats: nombres.length ? nombres : null, nFilas: filasMax,
            casillas: retos.map((r, i) => ({
                p: textoItem(r), r: r.r || '', cat: r.c || null, col: r.col, fila: r.fila,
                valor: nombres.length ? (r.fila + 1) * 10 : [5, 10, 15, 20, 25][Math.floor(Math.random() * 5)],
                sorpresa: idx.includes(i) ? PESOS_SORPRESA[Math.floor(Math.random() * PESOS_SORPRESA.length)] : null,
            })),
        };
    });
    const [abiertas, setAbiertas] = useState({}); // i -> 'ok' | 'mal'
    const [puntos, setPuntos] = useState(() => equipos.map(() => 0));
    const [turno, setTurno] = useState(0);
    const [actual, setActual] = useState(-1);
    const [fase, setFase] = useState('elegir'); // elegir | reto | sorpresa | hecho | fin
    const [ver, setVer] = useState(false);
    const c = useCuenta(() => S.finTiempo());
    if (!casillas.length) return <SinContenido tipo="retos" />;
    const cas = casillas[actual];
    const sor = cas?.sorpresa ? SORPRESAS[cas.sorpresa] : null;
    const necesitaObjetivo = ['robar', 'regalo', 'cambio'].includes(cas?.sorpresa);

    const elegir = (i) => { if (abiertas[i] || fase !== 'elegir') return; S.pitido(); setActual(i); setVer(false); setFase('reto'); c.iniciar(cfg.segundos); };
    const resolver = (ok) => {
        c.parar(); onStat(ok);
        setAbiertas(a => ({ ...a, [actual]: ok ? 'ok' : 'mal' }));
        if (!ok) { S.fallo(); setFase('hecho'); return; }
        S.acierto();
        setPuntos(p => p.map((v, k) => (k === turno ? v + cas.valor : v)));
        if (cas.sorpresa) { setTimeout(() => (cas.sorpresa === 'bomba' ? S.explosion() : S.magia()), 350); setFase('sorpresa'); }
        else setFase('hecho');
    };
    const aplicar = (obj = -1) => {
        setPuntos(p => {
            const n = [...p];
            if (cas.sorpresa === 'doble') n[turno] *= 2;
            if (cas.sorpresa === 'estrella') n[turno] += 20;
            if (cas.sorpresa === 'bomba') n[turno] = 0;
            if (cas.sorpresa === 'robar' && obj >= 0) { const q = Math.min(10, n[obj]); n[obj] -= q; n[turno] += q; }
            if (cas.sorpresa === 'regalo' && obj >= 0) { const q = Math.min(10, n[turno]); n[turno] -= q; n[obj] += q; }
            if (cas.sorpresa === 'cambio' && obj >= 0) { [n[turno], n[obj]] = [n[obj], n[turno]]; }
            return n;
        });
        setFase('hecho');
    };
    const siguiente = () => {
        if (Object.keys(abiertas).length >= casillas.length) { setFase('fin'); return; }
        setTurno(t => (t + 1) % equipos.length); setActual(-1); setFase('elegir');
    };
    if (fase === 'fin') return <Podio equipos={equipos} puntos={puntos} />;
    const cols = casillas.length > 16 ? 6 : casillas.length > 9 ? 4 : 3;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
            <Turno e={equipos[turno]} />
            {fase === 'elegir' && (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cats ? cats.length : cols}, 1fr)`, gap: 10, width: cats ? 'min(1200px, 100%)' : 'min(900px, 100%)' }}>
                    {cats && cats.map((n, k) => (
                        <div key={`c${k}`} style={{ background: '#1e1b4b', border: '2px solid rgba(255,255,255,0.35)', borderRadius: 14, padding: '8px 6px', textAlign: 'center', fontWeight: 900, fontSize: 'clamp(0.8rem, 1.6vw, 1.15rem)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 50, wordBreak: 'break-word' }}>{n}</div>
                    ))}
                    {(cats
                        ? Array.from({ length: nFilas * cats.length }, (_, k) => casillas.findIndex(x => x.fila === Math.floor(k / cats.length) && x.col === k % cats.length))
                        : casillas.map((_, i) => i)
                    ).map((i, k) => {
                        if (i < 0) return <div key={`v${k}`} />;
                        const x = casillas[i];
                        return (
                            <button key={i} onClick={() => elegir(i)} disabled={!!abiertas[i]} style={{
                                height: 'clamp(60px, 11vh, 100px)', borderRadius: 18, border: 'none', fontFamily: 'inherit', fontWeight: 900, fontSize: '2rem',
                                cursor: abiertas[i] ? 'default' : 'pointer', color: abiertas[i] ? 'rgba(255,255,255,0.7)' : '#1f2937',
                                background: abiertas[i] ? (abiertas[i] === 'ok' ? 'rgba(34,197,94,0.45)' : 'rgba(0,0,0,0.25)') : ['#fde047', '#f9a8d4', '#93c5fd', '#86efac', '#fdba74', '#c4b5fd'][(cats ? x.col : i) % 6],
                                boxShadow: abiertas[i] ? 'none' : '0 6px 0 rgba(0,0,0,0.25)',
                            }}>{abiertas[i] ? (x.sorpresa && abiertas[i] === 'ok' ? SORPRESAS[x.sorpresa].emoji : abiertas[i] === 'ok' ? '✔' : '✘') : cats ? x.valor : i + 1}</button>
                        );
                    })}
                </div>
            )}
            {fase === 'reto' && cas && (
                <div className="da-pop" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', maxWidth: 900 }}>
                    <div style={{ fontWeight: 900, fontSize: '1.3rem' }}>{cas.cat ? `${cas.cat} · ${cas.valor} puntos` : `Casilla ${actual + 1} · ${cas.valor} puntos`}</div>
                    <div style={{ background: 'white', color: '#1f2937', borderRadius: 24, padding: '22px 30px', fontSize: 'clamp(1.6rem, 4.5vw, 3rem)', fontWeight: 800, textAlign: 'center' }}>{cas.p}</div>
                    <div style={fila()}><Reloj c={c} size={110} /><Solucion r={cas.r} ver={ver} setVer={setVer} /></div>
                    <div style={fila()}>
                        <button onClick={() => resolver(true)} style={bt('#16a34a')}>✔ Correcto</button>
                        <button onClick={() => resolver(false)} style={bt('#dc2626')}>✘ Incorrecto</button>
                    </div>
                </div>
            )}
            {fase === 'sorpresa' && sor && (
                <div className={cas.sorpresa === 'bomba' ? 'da-explosion' : 'da-pop'} style={{ ...panel(), textAlign: 'center', minWidth: 320 }}>
                    <div style={{ fontSize: '5rem', lineHeight: 1 }}>{sor.emoji}</div>
                    <div style={{ fontSize: '2.4rem', fontWeight: 900 }}>{sor.nombre}</div>
                    <div style={{ fontSize: '1.3rem', marginBottom: 14 }}>+{cas.valor} y además… {sor.texto}</div>
                    {necesitaObjetivo ? (
                        <div style={fila()}>
                            {equipos.map((e, i) => i !== turno && <button key={i} onClick={() => aplicar(i)} style={bt(e.color)}>{e.emoji} {e.nombre}</button>)}
                        </div>
                    ) : <button onClick={() => aplicar()} style={bt('#2563eb')}>Aplicar</button>}
                </div>
            )}
            {fase === 'hecho' && <button onClick={siguiente} style={bt('#2563eb', { fontSize: '1.3rem' })}>➡️ Siguiente equipo</button>}
            <Marcador equipos={equipos} puntos={puntos} setPuntos={setPuntos} turno={turno} />
            <div style={{ ...panel({ padding: '8px 14px' }), display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 700 }}>
                {Object.values(SORPRESAS).map(s => <span key={s.nombre}>{s.emoji} {s.nombre}</span>)}
            </div>
        </div>
    );
}

export const PROYECTORES = {
    piedra: ProyPiedra, baile: ProyBaile, semaforo: ProySemaforo, citas: ProyCitas, mimica: ProyMimica,
    kaboom: ProyKaboom, sobres: ProySobres, silla: ProySilla, dado: ProyDado, tablero: ProyTablero,
};
