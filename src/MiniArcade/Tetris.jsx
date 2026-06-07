import React, { useState, useEffect, useCallback, useRef } from 'react';
import { tetrisRotate, tetrisLock, tetrisClear, tetrisTetris, tetrisMusicStart, tetrisMusicStop } from './sounds';
import SaveForm from './SaveForm';
import FullscreenBtn from './FullscreenBtn';

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const TICK_INTERVAL = 800;

const TETROMINOES = {
    I: { shape: [[1,1,1,1]], color: '#00f5ff' },
    O: { shape: [[1,1],[1,1]], color: '#ffd700' },
    T: { shape: [[0,1,0],[1,1,1]], color: '#bf5af2' },
    S: { shape: [[0,1,1],[1,1,0]], color: '#30d158' },
    Z: { shape: [[1,1,0],[0,1,1]], color: '#ff453a' },
    J: { shape: [[1,0,0],[1,1,1]], color: '#0a84ff' },
    L: { shape: [[0,0,1],[1,1,1]], color: '#ff9f0a' },
};

const KEYS = Object.keys(TETROMINOES);

function emptyBoard() {
    return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));
}

function randomPiece() {
    const key = KEYS[Math.floor(Math.random() * KEYS.length)];
    return { type: key, shape: TETROMINOES[key].shape, color: TETROMINOES[key].color, x: 3, y: 0 };
}

function rotate(shape) {
    const rows = shape.length, cols = shape[0].length;
    return Array.from({ length: cols }, (_, c) =>
        Array.from({ length: rows }, (_, r) => shape[rows - 1 - r][c])
    );
}

function fits(board, piece, dx = 0, dy = 0, newShape = null) {
    const s = newShape || piece.shape;
    for (let r = 0; r < s.length; r++) {
        for (let c = 0; c < s[r].length; c++) {
            if (!s[r][c]) continue;
            const nx = piece.x + c + dx;
            const ny = piece.y + r + dy;
            if (nx < 0 || nx >= BOARD_WIDTH || ny >= BOARD_HEIGHT) return false;
            if (ny >= 0 && board[ny][nx]) return false;
        }
    }
    return true;
}

function merge(board, piece) {
    const b = board.map(r => [...r]);
    piece.shape.forEach((row, r) => {
        row.forEach((cell, c) => {
            if (cell) {
                const ny = piece.y + r, nx = piece.x + c;
                if (ny >= 0) b[ny][nx] = piece.color;
            }
        });
    });
    return b;
}

function clearLines(board) {
    const remaining = board.filter(row => row.some(c => !c));
    const cleared = BOARD_HEIGHT - remaining.length;
    const empty = Array.from({ length: cleared }, () => Array(BOARD_WIDTH).fill(null));
    return { board: [...empty, ...remaining], cleared };
}

const SCORE_TABLE = [0, 100, 300, 500, 800];
function calcScore(cleared, level) {
    return (SCORE_TABLE[cleared] || 0) * (level + 1);
}

export default function Tetris({ onExit }) {
    const [board, setBoard] = useState(emptyBoard());
    const [piece, setPiece] = useState(() => randomPiece());
    const [next, setNext] = useState(() => randomPiece());
    const [score, setScore] = useState(0);
    const [lines, setLines] = useState(0);
    const [level, setLevel] = useState(0);
    const [gameOver, setGameOver] = useState(false);
    const [paused, setPaused] = useState(false);
    const [started, setStarted] = useState(false);
    const [muted, setMuted] = useState(false);
    const mutedRef = useRef(false);
    mutedRef.current = muted;
    const [showSave, setShowSave] = useState(false);

    const boardRef = useRef(board);
    const pieceRef = useRef(piece);
    const pausedRef = useRef(paused);
    const gameOverRef = useRef(gameOver);
    boardRef.current = board;
    pieceRef.current = piece;
    pausedRef.current = paused;
    gameOverRef.current = gameOver;

    const lockPiece = useCallback((currentBoard, currentPiece, currentNext, currentScore, currentLines, currentLevel) => {
        const merged = merge(currentBoard, currentPiece);
        const { board: cleared, cleared: count } = clearLines(merged);
        const newLines = currentLines + count;
        const newLevel = Math.floor(newLines / 10);
        const newScore = currentScore + calcScore(count, currentLevel);
        const newPiece = { ...currentNext, x: 3, y: 0 };
        const nextNext = randomPiece();

        if (!mutedRef.current) {
            if (count === 4) tetrisTetris();
            else if (count > 0) tetrisClear();
            else tetrisLock();
        }

        if (!fits(cleared, newPiece)) {
            setBoard(cleared);
            setGameOver(true);
            tetrisMusicStop();
            return;
        }
        setBoard(cleared);
        setPiece(newPiece);
        setNext(nextNext);
        setScore(newScore);
        setLines(newLines);
        setLevel(newLevel);
    }, []);

    const moveDown = useCallback(() => {
        if (pausedRef.current || gameOverRef.current) return;
        const p = pieceRef.current;
        const b = boardRef.current;
        if (fits(b, p, 0, 1)) {
            setPiece(prev => ({ ...prev, y: prev.y + 1 }));
        } else {
            lockPiece(b, p, next, score, lines, level);
        }
    }, [next, score, lines, level, lockPiece]);

    // Gravity tick
    useEffect(() => {
        if (!started || gameOver) return;
        const interval = Math.max(100, TICK_INTERVAL - level * 70);
        const id = setInterval(() => { if (!pausedRef.current) moveDown(); }, interval);
        return () => clearInterval(id);
    }, [started, gameOver, level, moveDown]);

    // Keyboard
    useEffect(() => {
        const handler = (e) => {
            if (!started || gameOverRef.current) return;
            if (e.key === 'Escape') { setPaused(p => !p); return; }
            if (pausedRef.current) return;

            const p = pieceRef.current;
            const b = boardRef.current;

            if (e.key === 'ArrowLeft' && fits(b, p, -1, 0)) {
                e.preventDefault();
                setPiece(prev => ({ ...prev, x: prev.x - 1 }));
            } else if (e.key === 'ArrowRight' && fits(b, p, 1, 0)) {
                e.preventDefault();
                setPiece(prev => ({ ...prev, x: prev.x + 1 }));
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                moveDown();
            } else if (e.key === 'ArrowUp' || e.key === 'x' || e.key === 'X' || e.key === ' ') {
                e.preventDefault();
                const rotated = rotate(p.shape);
                if (fits(b, p, 0, 0, rotated)) { setPiece(prev => ({ ...prev, shape: rotated })); if (!mutedRef.current) tetrisRotate(); }
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [started, moveDown, next, score, lines, level, lockPiece]);

    function restart() {
        const p = randomPiece();
        const n = randomPiece();
        setBoard(emptyBoard());
        setPiece(p);
        setNext(n);
        setScore(0);
        setLines(0);
        setLevel(0);
        setGameOver(false);
        setPaused(false);
        setStarted(true);
        setShowSave(false);
        if (!mutedRef.current) tetrisMusicStart();
    }

    // Ghost piece
    function ghostY() {
        let gy = piece.y;
        while (fits(board, { ...piece, y: gy + 1 })) gy++;
        return gy;
    }

    const ghost = started && !gameOver ? ghostY() : piece.y;

    // Render board cells
    const displayBoard = started ? merge(board, piece) : board;

    // Draw ghost on display
    const withGhost = displayBoard.map(r => [...r]);
    if (started && !gameOver) {
        piece.shape.forEach((row, r) => {
            row.forEach((cell, c) => {
                if (!cell) return;
                const ny = ghost + r, nx = piece.x + c;
                if (ny >= 0 && ny < BOARD_HEIGHT && nx >= 0 && nx < BOARD_WIDTH && !withGhost[ny][nx]) {
                    withGhost[ny][nx] = 'ghost';
                }
            });
        });
    }

    const CELL = 28;
    const boardPx = BOARD_WIDTH * CELL;
    const boardHPx = BOARD_HEIGHT * CELL;

    function NextPreview() {
        const s = next.shape;
        const rows = s.length, cols = s[0].length;
        const C = 22;
        return (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, ${C}px)`, gap: 2, margin: '0 auto' }}>
                {s.flatMap((row, r) => row.map((cell, c) => (
                    <div key={`${r}-${c}`} style={{
                        width: C, height: C, borderRadius: 3,
                        background: cell ? next.color : 'rgba(255,255,255,0.04)',
                        boxShadow: cell ? `0 0 6px ${next.color}88` : 'none',
                    }} />
                )))}
            </div>
        );
    }

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'linear-gradient(135deg, #0a0a1a 0%, #0d1b2a 100%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Courier New', monospace",
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                <button onClick={() => { tetrisMusicStop(); onExit(); }} style={{
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                    color: 'white', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: '0.85rem',
                }}>← Arkade</button>
                <h2 style={{ color: '#00f5ff', margin: 0, fontSize: '1.6rem', letterSpacing: 4, textShadow: '0 0 20px #00f5ff88' }}>
                    TETRIS
                </h2>
                <button onClick={() => {
                    const next = !muted;
                    setMuted(next);
                    if (next) tetrisMusicStop();
                    else if (started && !gameOver && !paused) tetrisMusicStart();
                }} style={{
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                    color: 'white', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: '1rem',
                }}>{muted ? '🔇' : '🔊'}</button>
                <FullscreenBtn />
            </div>

            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                {/* Board */}
                <div style={{
                    position: 'relative', width: boardPx, height: boardHPx,
                    border: '2px solid rgba(0,245,255,0.3)',
                    boxShadow: '0 0 30px rgba(0,245,255,0.1)',
                    background: 'rgba(0,0,0,0.6)',
                }}>
                    {withGhost.map((row, r) => row.map((cell, c) => (
                        <div key={`${r}-${c}`} style={{
                            position: 'absolute',
                            left: c * CELL + 1, top: r * CELL + 1,
                            width: CELL - 2, height: CELL - 2,
                            borderRadius: 3,
                            background: cell === 'ghost'
                                ? 'rgba(255,255,255,0.07)'
                                : cell
                                    ? cell
                                    : 'transparent',
                            boxShadow: cell && cell !== 'ghost' ? `inset 0 0 6px rgba(255,255,255,0.2), 0 0 4px ${cell}44` : 'none',
                            border: cell === 'ghost' ? '1px dashed rgba(255,255,255,0.15)' : 'none',
                        }} />
                    )))}

                    {/* Grid lines */}
                    {!started && (
                        <div style={{
                            position: 'absolute', inset: 0, display: 'flex',
                            flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(0,0,0,0.7)',
                        }}>
                            <div style={{ color: '#00f5ff', fontSize: '1rem', marginBottom: 16, letterSpacing: 2 }}>
                                PRESIONA INICIO
                            </div>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', textAlign: 'center', lineHeight: 1.8 }}>
                                ← → Mover · ↑/Esp: Rotar<br />↓ Bajar rápido
                            </div>
                        </div>
                    )}

                    {paused && started && !gameOver && (
                        <div style={{
                            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(0,0,0,0.75)',
                        }}>
                            <span style={{ color: '#ffd700', fontSize: '1.4rem', letterSpacing: 4 }}>PAUSA</span>
                        </div>
                    )}

                    {gameOver && (
                        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.88)', padding:16 }}>
                            <div style={{ color:'#ff453a', fontSize:'1.4rem', letterSpacing:3, marginBottom:4 }}>GAME OVER</div>
                            <div style={{ color:'#ffd700', fontSize:'1.1rem', marginBottom:12 }}>Puntos: {score.toLocaleString()}</div>
                            {!showSave ? (
                                <button onClick={()=>setShowSave(true)} style={{ background:'rgba(0,245,255,0.15)', color:'#00f5ff', border:'1px solid #00f5ff44', borderRadius:7, padding:'6px 16px', cursor:'pointer', fontSize:'0.82rem', marginBottom:10 }}>
                                    📋 Guardar puntuación
                                </button>
                            ) : (
                                <SaveForm gameKey="TETRIS" score={score} accentColor="#00f5ff" onDone={()=>setShowSave(false)} />
                            )}
                            <button onClick={restart} style={{ marginTop:10, background:'#00f5ff', color:'#000', border:'none', borderRadius:8, padding:'7px 18px', cursor:'pointer', fontWeight:700, fontSize:'0.85rem' }}>Reiniciar</button>
                        </div>
                    )}
                </div>

                {/* Side panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: 110 }}>
                    <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,245,255,0.2)', borderRadius: 10, padding: '10px 12px' }}>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', letterSpacing: 2, marginBottom: 4 }}>PUNTOS</div>
                        <div style={{ color: '#ffd700', fontSize: '1.1rem', fontWeight: 700 }}>{score}</div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,245,255,0.2)', borderRadius: 10, padding: '10px 12px' }}>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', letterSpacing: 2, marginBottom: 4 }}>LÍNEAS</div>
                        <div style={{ color: '#30d158', fontSize: '1.1rem', fontWeight: 700 }}>{lines}</div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,245,255,0.2)', borderRadius: 10, padding: '10px 12px' }}>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', letterSpacing: 2, marginBottom: 4 }}>NIVEL</div>
                        <div style={{ color: '#bf5af2', fontSize: '1.1rem', fontWeight: 700 }}>{level}</div>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,245,255,0.2)', borderRadius: 10, padding: '10px 12px' }}>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', letterSpacing: 2, marginBottom: 8 }}>SIGUIENTE</div>
                        <NextPreview />
                    </div>

                    {!started ? (
                        <button onClick={restart} style={{
                            background: 'linear-gradient(135deg, #00f5ff, #0a84ff)', color: '#000', border: 'none',
                            borderRadius: 8, padding: '10px 8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem',
                        }}>INICIAR</button>
                    ) : (
                        <button onClick={() => {
                            const next = !paused;
                            setPaused(next);
                            if (!muted) { if (next) tetrisMusicStop(); else tetrisMusicStart(); }
                        }} style={{
                            background: paused ? 'rgba(0,245,255,0.15)' : 'rgba(255,255,255,0.08)',
                            color: paused ? '#00f5ff' : 'white', border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: 8, padding: '8px', cursor: 'pointer', fontSize: '0.8rem',
                        }}>{paused ? '▶ Continuar' : '⏸ Pausa'}</button>
                    )}
                </div>
            </div>

            {/* Mobile controls */}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                {[
                    { label: '↺', action: () => { const r = rotate(pieceRef.current.shape); if (fits(boardRef.current, pieceRef.current, 0, 0, r)) { setPiece(p => ({ ...p, shape: r })); if (!mutedRef.current) tetrisRotate(); } } },
                    { label: '←', action: () => { if (fits(boardRef.current, pieceRef.current, -1, 0)) setPiece(p => ({ ...p, x: p.x - 1 })); } },
                    { label: '↓', action: moveDown },
                    { label: '→', action: () => { if (fits(boardRef.current, pieceRef.current, 1, 0)) setPiece(p => ({ ...p, x: p.x + 1 })); } },
                    { label: '⬇', action: () => { const p = pieceRef.current; const b = boardRef.current; let ny = p.y; while (fits(b, { ...p, y: ny + 1 })) ny++; lockPiece(b, { ...p, y: ny }, next, score, lines, level); } },
                ].map(btn => (
                    <button key={btn.label} onPointerDown={btn.action} style={{
                        background: 'rgba(0,245,255,0.1)', border: '1px solid rgba(0,245,255,0.3)',
                        color: '#00f5ff', borderRadius: 8, width: 44, height: 44, cursor: 'pointer',
                        fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        touchAction: 'manipulation',
                    }}>{btn.label}</button>
                ))}
            </div>
        </div>
    );
}
