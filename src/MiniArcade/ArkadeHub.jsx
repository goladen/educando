import React, { useState, useEffect } from 'react';
import Tetris from './Tetris';
import Buscaminas from './Buscaminas';
import Pong from './Pong';
import Arkanoid from './Arkanoid';
import Bomberman from './Bomberman';
import { getScoresMonthly, getScoresAllTime, fmtScore, fmtDate } from './ranking';

const MINI_GAMES = [
    {
        id: 'TETRIS', name: 'Tetris', emoji: '🟦',
        desc: 'Completa líneas antes de que los bloques lleguen arriba.',
        color: '#00f5ff', players: '1',
        keys: '← → Mover · ↑/Esp: Rotar · ↓ Bajar',
        ranking: [{ key: 'TETRIS', label: 'Puntos' }],
    },
    {
        id: 'BUSCAMINAS', name: 'Buscaminas', emoji: '💣',
        desc: 'Descubre todas las celdas sin pisar una mina.',
        color: '#30d158', players: '1',
        keys: 'Clic izq: revelar · Clic der / 🚩: bandera',
        ranking: [
            { key: 'BUSCAMINAS_Fácil',   label: 'Fácil'   },
            { key: 'BUSCAMINAS_Medio',   label: 'Medio'   },
            { key: 'BUSCAMINAS_Difícil', label: 'Difícil' },
        ],
    },
    {
        id: 'PONG', name: 'Cyber Pong', emoji: '🏓',
        desc: 'El clásico ping-pong. 1 jugador vs CPU o 2 jugadores.',
        color: '#00ffaa', players: '1–2',
        keys: 'P1: W/S · P2: ↑/↓ · Esp: sacar',
        ranking: null, // sin ranking (multijugador)
    },
    {
        id: 'ARKANOID', name: 'Cyber Break', emoji: '🧱',
        desc: 'Rompe todos los ladrillos sin dejar caer la bola.',
        color: '#ff4400', players: '1',
        keys: '← → Mover pala · Esp: lanzar',
        ranking: [{ key: 'ARKANOID', label: 'Puntos' }],
    },
    {
        id: 'BOMBERMAN', name: 'Bomberman', emoji: '💣',
        desc: 'Elimina a todos los enemigos con tus bombas. ¡No te explotes!',
        color: '#ffdd00', players: '1',
        keys: '← → ↑ ↓ Mover · X / Esp: bomba',
        ranking: [{ key: 'BOMBERMAN', label: 'Puntos' }],
    },
];

const COMPONENTS = { TETRIS: Tetris, BUSCAMINAS: Buscaminas, PONG: Pong, ARKANOID: Arkanoid, BOMBERMAN: Bomberman };

// ─── Tabla de ranking ─────────────────────────────────────────────────────────
function RankingTable({ rankKey, scores, color }) {
    const isTiempo = rankKey.startsWith('BUSCAMINAS');
    return (
        <div>
            {scores.length === 0 ? (
                <p style={{ color:'rgba(255,255,255,0.25)', fontSize:'0.75rem', margin:0 }}>Sin partidas guardadas aún.</p>
            ) : (
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.8rem' }}>
                    <thead>
                        <tr style={{ color:'rgba(255,255,255,0.35)' }}>
                            <th style={{ textAlign:'left', padding:'3px 6px', fontWeight:400 }}>#</th>
                            <th style={{ textAlign:'left', padding:'3px 6px', fontWeight:400 }}>Nombre</th>
                            <th style={{ textAlign:'right', padding:'3px 6px', fontWeight:400 }}>{isTiempo ? 'Tiempo' : 'Puntos'}</th>
                            <th style={{ textAlign:'right', padding:'3px 6px', fontWeight:400 }}>Fecha</th>
                        </tr>
                    </thead>
                    <tbody>
                        {scores.map((e, i) => (
                            <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent' }}>
                                <td style={{ padding:'4px 6px', color: i===0?'#ffd700': i===1?'#c0c0c0': i===2?'#cd7f32':'rgba(255,255,255,0.5)', fontWeight: i<3?700:400 }}>
                                    {i===0?'🥇': i===1?'🥈': i===2?'🥉': `${i+1}.`}
                                </td>
                                <td style={{ padding:'4px 6px', color:'white', fontWeight: i<3?600:400 }}>{e.n}</td>
                                <td style={{ padding:'4px 6px', color, textAlign:'right', fontWeight: i<3?700:400 }}>{fmtScore(rankKey, e.s)}</td>
                                <td style={{ padding:'4px 6px', color:'rgba(255,255,255,0.3)', textAlign:'right' }}>{fmtDate(e.t)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}

// ─── Mini top-3 por tarjeta (async) ──────────────────────────────────────────
function MiniRanking({ game }) {
    const [top, setTop] = useState([]);
    const key = game.ranking[0].key;
    useEffect(() => {
        getScoresMonthly(key).then(s => setTop(s.slice(0, 3)));
    }, [key]);
    if (top.length === 0) return null;
    return (
        <div style={{ marginTop:12, borderTop:`1px solid ${game.color}22`, paddingTop:10 }}>
            {top.map((e, i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:'0.68rem', color: i===0?'#ffd700':i===1?'#c0c0c0':'#cd7f32', marginBottom:2 }}>
                    <span>{i===0?'🥇':i===1?'🥈':'🥉'} {e.n}</span>
                    <span style={{ color:game.color }}>{fmtScore(key, e.s)}</span>
                </div>
            ))}
        </div>
    );
}

// ─── Modal de ranking ─────────────────────────────────────────────────────────
function RankingModal({ game, onClose }) {
    const [diffTab, setDiffTab] = useState(0);
    const [timeTab, setTimeTab] = useState(0); // 0=este mes, 1=todo el tiempo
    const [scores, setScores]   = useState([]);
    const [loading, setLoading] = useState(true);
    const rankDefs = game.ranking;
    const currentKey = rankDefs[diffTab].key;

    useEffect(() => {
        setLoading(true);
        setScores([]);
        const fn = timeTab === 0 ? getScoresMonthly : getScoresAllTime;
        fn(currentKey).then(s => { setScores(s); setLoading(false); });
    }, [currentKey, timeTab]);

    return (
        <div style={{
            position:'fixed', inset:0, zIndex:10000, background:'rgba(0,0,0,0.7)',
            display:'flex', alignItems:'center', justifyContent:'center',
        }} onClick={onClose}>
            <div onClick={e=>e.stopPropagation()} style={{
                background:'linear-gradient(135deg,#0d0d2b,#0a0a1a)',
                border:`1px solid ${game.color}55`,
                borderRadius:18, padding:24, minWidth:340, maxWidth:480, width:'90vw',
                maxHeight:'80vh', overflowY:'auto',
                boxShadow:`0 0 40px ${game.color}33`,
            }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                    <h3 style={{ margin:0, color:game.color, fontSize:'1.1rem', letterSpacing:3 }}>
                        🏆 {game.name.toUpperCase()}
                    </h3>
                    <button onClick={onClose} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.5)', fontSize:'1.3rem', cursor:'pointer', lineHeight:1 }}>✕</button>
                </div>

                {/* Difficulty tabs (Buscaminas only) */}
                {rankDefs.length > 1 && (
                    <div style={{ display:'flex', gap:6, marginBottom:10 }}>
                        {rankDefs.map((r, i) => (
                            <button key={r.key} onClick={()=>setDiffTab(i)} style={{
                                padding:'4px 12px', borderRadius:20, border:`1px solid ${game.color}${diffTab===i?'ff':'44'}`,
                                background: diffTab===i ? `${game.color}22` : 'transparent',
                                color: diffTab===i ? game.color : 'rgba(255,255,255,0.4)',
                                cursor:'pointer', fontSize:'0.78rem', fontWeight: diffTab===i?700:400,
                            }}>{r.label}</button>
                        ))}
                    </div>
                )}

                {/* Time range tabs */}
                <div style={{ display:'flex', gap:6, marginBottom:14 }}>
                    {['Este mes', 'Todo el tiempo'].map((label, i) => (
                        <button key={label} onClick={()=>setTimeTab(i)} style={{
                            padding:'4px 12px', borderRadius:20,
                            border:`1px solid rgba(255,255,255,${timeTab===i?'0.4':'0.12'})`,
                            background: timeTab===i ? 'rgba(255,255,255,0.1)' : 'transparent',
                            color: timeTab===i ? 'white' : 'rgba(255,255,255,0.35)',
                            cursor:'pointer', fontSize:'0.75rem', fontWeight: timeTab===i?700:400,
                        }}>{label}</button>
                    ))}
                </div>

                {loading
                    ? <p style={{ color:'rgba(255,255,255,0.3)', fontSize:'0.8rem', textAlign:'center', margin:'12px 0' }}>Cargando…</p>
                    : <RankingTable rankKey={currentKey} scores={scores} color={game.color} />
                }
            </div>
        </div>
    );
}

// ─── Selector de juego para panel split ──────────────────────────────────────
function MiniGameSelector({ onSelect }) {
    return (
        <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg,#0a0a1a,#0d0d2b)', padding: 20,
        }}>
            <p style={{ color:'rgba(255,255,255,0.4)', fontSize:'0.8rem', letterSpacing:2, marginBottom:16 }}>ELIGE UN JUEGO</p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10, width:'100%', maxWidth:300 }}>
                {MINI_GAMES.map(game => (
                    <button key={game.id} onClick={() => onSelect(game.id)} style={{
                        background:`${game.color}14`, border:`1px solid ${game.color}44`,
                        color:game.color, borderRadius:10, padding:'14px 8px',
                        cursor:'pointer', display:'flex', flexDirection:'column',
                        alignItems:'center', gap:6,
                    }}>
                        <span style={{ fontSize:'1.8rem', lineHeight:1 }}>{game.emoji}</span>
                        <span style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.7)', fontFamily:"'Courier New',monospace" }}>{game.name}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

// ─── Panel individual del split-screen ───────────────────────────────────────
function GamePanel({ panelId, focused, onFocus, panelWidth }) {
    const [gameId, setGameId] = useState(null);
    const Game = gameId ? COMPONENTS[gameId] : null;

    return (
        <div style={{
            flex: 1, position: 'relative', overflow: 'auto',
            borderRadius: 10,
            border: `2px solid ${focused ? '#bf5af2' : 'rgba(255,255,255,0.1)'}`,
            boxShadow: focused ? '0 0 20px rgba(191,90,242,0.25)' : 'none',
            transition: 'border-color 0.15s, box-shadow 0.15s',
        }} onClick={() => !focused && onFocus(panelId)}>

            {/* Chip de foco */}
            <div style={{
                position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)',
                zIndex: 10001, pointerEvents: 'none',
                background: focused ? 'rgba(191,90,242,0.9)' : 'rgba(0,0,0,0.75)',
                border: `1px solid ${focused ? '#bf5af2' : 'rgba(255,255,255,0.2)'}`,
                color: 'white', borderRadius: 20, padding: '2px 10px',
                fontSize: '0.6rem', letterSpacing: 1, whiteSpace: 'nowrap',
                fontFamily: "'Courier New',monospace",
            }}>
                {focused ? '⌨ TECLADO ACTIVO' : '· clic → activar teclado ·'}
            </div>

            {Game
                ? <Game contained panelId={panelId} containerWidth={panelWidth} onExit={() => setGameId(null)} />
                : <MiniGameSelector onSelect={setGameId} />
            }
        </div>
    );
}

// ─── Hub principal ────────────────────────────────────────────────────────────
export default function ArkadeHub({ onExit }) {
    const [active, setActive] = useState(null);
    const [rankingGame, setRankingGame] = useState(null);
    const [splitMode, setSplitMode] = useState(false);
    const [focusedPanel, setFocusedPanel] = useState('left');

    const isWide = window.innerWidth >= 900;
    const panelWidth = Math.floor((window.innerWidth - 28) / 2);

    useEffect(() => {
        window.__arkadePanel = splitMode ? focusedPanel : null;
        return () => { window.__arkadePanel = null; };
    }, [splitMode, focusedPanel]);

    // ── Modo juego individual ──
    if (active) {
        const Game = COMPONENTS[active];
        return <Game onExit={() => setActive(null)} />;
    }

    // ── Modo split-screen ──
    if (splitMode) {
        return (
            <div style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: '#050510', display: 'flex', flexDirection: 'column',
                fontFamily: "'Courier New', monospace",
            }}>
                {/* Barra superior */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '6px 12px', background: '#0a0a1a', flexShrink: 0,
                    borderBottom: '1px solid rgba(191,90,242,0.2)',
                }}>
                    <button onClick={() => setSplitMode(false)} style={{
                        background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
                        color: 'white', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontSize: '0.8rem',
                    }}>← Salir split</button>
                    <span style={{ color: '#bf5af2', letterSpacing: 3, fontSize: '0.85rem', flex: 1, textAlign: 'center' }}>
                        🕹️ SPLIT SCREEN
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.65rem' }}>
                        Clic en un panel para darle el foco del teclado
                    </span>
                </div>

                {/* Dos paneles */}
                <div style={{ flex: 1, display: 'flex', gap: 8, padding: 8, overflow: 'hidden' }}>
                    <GamePanel panelId="left"  focused={focusedPanel === 'left'}  onFocus={setFocusedPanel} panelWidth={panelWidth} />
                    <GamePanel panelId="right" focused={focusedPanel === 'right'} onFocus={setFocusedPanel} panelWidth={panelWidth} />
                </div>
            </div>
        );
    }

    // ── Vista normal ──
    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'linear-gradient(135deg, #0a0a1a 0%, #0d0d2b 60%, #0a0a1a 100%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            overflowY: 'auto', padding: '30px 20px',
            fontFamily: "'Courier New', monospace",
        }}>
            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:36, width:'100%', maxWidth:700 }}>
                <button onClick={onExit} style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.15)', color:'white', borderRadius:8, padding:'7px 16px', cursor:'pointer', fontSize:'0.85rem' }}>← Volver</button>
                <div style={{ flex:1, textAlign:'center' }}>
                    <h1 style={{ margin:0, color:'white', fontSize:'2rem', letterSpacing:6, textShadow:'0 0 30px rgba(191,90,242,0.8)' }}>
                        🕹️ ARKADE
                    </h1>
                    <p style={{ color:'rgba(255,255,255,0.3)', fontSize:'0.7rem', margin:'4px 0 0', letterSpacing:3 }}>MINI JUEGOS CLÁSICOS</p>
                </div>
                {isWide && (
                    <button onClick={() => setSplitMode(true)} style={{
                        background: 'rgba(191,90,242,0.15)', border: '1px solid rgba(191,90,242,0.5)',
                        color: '#bf5af2', borderRadius: 8, padding: '7px 14px',
                        cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap',
                    }}>⊟⊞ Split Screen</button>
                )}
            </div>

            {/* Games grid */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:20, width:'100%', maxWidth:700 }}>
                {MINI_GAMES.map(game => (
                    <div key={game.id}
                        onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-3px)';e.currentTarget.style.boxShadow=`0 8px 28px ${game.color}33`;}}
                        onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none';}}
                        style={{ background:'rgba(255,255,255,0.04)', border:`1px solid ${game.color}44`, borderRadius:16, padding:'20px 16px 16px', position:'relative', transition:'transform 0.15s, box-shadow 0.15s' }}>

                        {/* Trophy button */}
                        {game.ranking && (
                            <button onClick={()=>setRankingGame(game)} title="Ver ranking"
                                style={{ position:'absolute', top:10, right:10, background:`${game.color}18`, border:`1px solid ${game.color}44`, color:game.color, borderRadius:8, width:30, height:30, cursor:'pointer', fontSize:'0.85rem', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>
                                🏆
                            </button>
                        )}

                        {/* Card content */}
                        <div onClick={()=>setActive(game.id)} style={{ cursor:'pointer', textAlign:'center' }}>
                            <div style={{ fontSize:'2.8rem', marginBottom:10, lineHeight:1 }}>{game.emoji}</div>
                            <h3 style={{ margin:'0 0 6px', color:game.color, fontSize:'1rem', letterSpacing:2 }}>{game.name}</h3>
                            <p style={{ margin:'0 0 10px', color:'rgba(255,255,255,0.45)', fontSize:'0.75rem', lineHeight:1.5 }}>{game.desc}</p>
                            <span style={{ background:`${game.color}22`, color:game.color, borderRadius:20, padding:'2px 10px', fontSize:'0.6rem', letterSpacing:1 }}>
                                {game.players} jugador{game.players!=='1'?'es':''}
                            </span>
                            <p style={{ margin:'10px 0 0', color:'rgba(255,255,255,0.2)', fontSize:'0.6rem', lineHeight:1.6 }}>{game.keys}</p>
                        </div>

                        {/* Mini top-3 inline */}
                        {game.ranking && <MiniRanking game={game} />}
                    </div>
                ))}
            </div>

            {/* Ranking modal */}
            {rankingGame && <RankingModal game={rankingGame} onClose={()=>setRankingGame(null)} />}
        </div>
    );
}
