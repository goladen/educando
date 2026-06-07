import React, { useState, useEffect, useCallback } from 'react';
import { mineClick, mineFlag, mineVictory, mineExplosion } from './sounds';
import { fmtScore } from './ranking';
import SaveForm from './SaveForm';
import FullscreenBtn from './FullscreenBtn';

const LEVELS = {
    Fácil:  { rows: 9,  cols: 9,  mines: 10 },
    Medio:  { rows: 16, cols: 16, mines: 40 },
    Difícil:{ rows: 16, cols: 30, mines: 99 },
};

const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const NUM_COLORS = ['','#4fc3f7','#81c784','#e57373','#7986cb','#f06292','#4dd0e1','#fff','#bdbdbd'];

function makeEmpty(rows, cols) {
    return Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => ({ isMine:false, isOpen:false, isFlagged:false, neighbors:0 }))
    );
}

function placeMines(board, rows, cols, mines, sr, sc) {
    let placed = 0;
    while (placed < mines) {
        const r = Math.floor(Math.random() * rows);
        const c = Math.floor(Math.random() * cols);
        if (!board[r][c].isMine && !(r === sr && c === sc)) {
            board[r][c].isMine = true;
            placed++;
        }
    }
    for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
            if (!board[r][c].isMine)
                board[r][c].neighbors = DIRS.reduce((acc, [dr, dc]) => {
                    const nr = r+dr, nc = c+dc;
                    return acc + (nr>=0&&nr<rows&&nc>=0&&nc<cols&&board[nr][nc].isMine ? 1 : 0);
                }, 0);
}

function floodFill(board, rows, cols, r, c) {
    const stack = [[r, c]];
    while (stack.length) {
        const [cr, cc] = stack.pop();
        if (board[cr][cc].isOpen || board[cr][cc].isFlagged) continue;
        board[cr][cc].isOpen = true;
        if (board[cr][cc].neighbors === 0)
            DIRS.forEach(([dr, dc]) => {
                const nr = cr+dr, nc = cc+dc;
                if (nr>=0&&nr<rows&&nc>=0&&nc<cols&&!board[nr][nc].isOpen) stack.push([nr, nc]);
            });
    }
}

export default function Buscaminas({ onExit }) {
    const [levelKey, setLevelKey] = useState('Fácil');
    const { rows, cols, mines } = LEVELS[levelKey];

    const [board, setBoard] = useState(() => makeEmpty(rows, cols));
    const [status, setStatus] = useState('idle');
    const [flags, setFlags] = useState(0);
    const [time, setTime] = useState(0);
    const [flagMode, setFlagMode] = useState(false);
    const [showSave, setShowSave] = useState(false);

    useEffect(() => {
        setBoard(makeEmpty(rows, cols));
        setStatus('idle');
        setFlags(0);
        setTime(0);
        setFlagMode(false);
        setShowSave(false);
    }, [levelKey, rows, cols]);

    useEffect(() => {
        if (status !== 'playing') return;
        const id = setInterval(() => setTime(t => t + 1), 1000);
        return () => clearInterval(id);
    }, [status]);

    const revealCell = useCallback((r, c) => {
        setBoard(prev => {
            if (status === 'won' || status === 'lost') return prev;
            if (prev[r][c].isOpen || prev[r][c].isFlagged) return prev;

            const b = prev.map(row => row.map(cell => ({ ...cell })));

            if (status === 'idle') {
                placeMines(b, rows, cols, mines, r, c);
                setStatus('playing');
            }

            if (b[r][c].isMine) {
                b.forEach(row => row.forEach(cell => { if (cell.isMine) cell.isOpen = true; }));
                mineExplosion();
                setStatus('lost');
                return b;
            }

            mineClick();
            floodFill(b, rows, cols, r, c);

            const safe = rows * cols - mines;
            const opened = b.flat().filter(cell => cell.isOpen && !cell.isMine).length;
            if (opened === safe) { mineVictory(); setStatus('won'); }

            return b;
        });
    }, [status, rows, cols, mines]);

    const toggleFlag = useCallback((e, r, c) => {
        e.preventDefault();
        if (status === 'won' || status === 'lost') return;
        setBoard(prev => {
            if (prev[r][c].isOpen) return prev;
            if (!prev[r][c].isFlagged && flags >= mines) return prev;
            const b = prev.map(row => row.map(cell => ({ ...cell })));
            b[r][c].isFlagged = !b[r][c].isFlagged;
            mineFlag();
            setFlags(f => b[r][c].isFlagged ? f + 1 : f - 1);
            return b;
        });
    }, [status, flags, mines]);

    function reset() {
        setBoard(makeEmpty(rows, cols));
        setStatus('idle');
        setFlags(0);
        setTime(0);
        setFlagMode(false);
        setShowSave(false);
    }

    const CELL = Math.min(36, Math.floor((Math.min(window.innerWidth - 40, 600)) / cols));

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'linear-gradient(135deg, #0a0a1a 0%, #0d1b2a 100%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            overflowY: 'auto', padding: '16px 12px',
            fontFamily: "'Courier New', monospace",
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, width: '100%', maxWidth: 700 }}>
                <button onClick={onExit} style={{
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
                    color: 'white', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: '0.85rem', whiteSpace: 'nowrap',
                }}>← Arkade</button>
                <h2 style={{ color: '#30d158', margin: 0, flex: 1, textAlign: 'center', fontSize: '1.4rem', letterSpacing: 4, textShadow: '0 0 20px #30d15888' }}>
                    BUSCAMINAS
                </h2>
                <FullscreenBtn />
            </div>

            {/* Level selector */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {Object.keys(LEVELS).map(k => (
                    <button key={k} onClick={() => setLevelKey(k)} style={{
                        background: levelKey === k ? '#30d158' : 'rgba(255,255,255,0.06)',
                        color: levelKey === k ? '#000' : 'rgba(255,255,255,0.6)',
                        border: `1px solid ${levelKey === k ? '#30d158' : 'rgba(255,255,255,0.15)'}`,
                        borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700,
                    }}>{k}</button>
                ))}
            </div>

            {/* Status bar */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(48,209,88,0.3)',
                borderRadius: 10, padding: '8px 20px', marginBottom: 12,
                width: '100%', maxWidth: Math.max(cols * CELL + 8, 300), boxSizing: 'border-box',
            }}>
                <span style={{ color: '#ff453a', fontSize: '1.1rem', fontWeight: 700 }}>🚩 {mines - flags}</span>
                <button onClick={reset} style={{ background: 'none', border: 'none', fontSize: '1.6rem', cursor: 'pointer' }}>
                    {status === 'won' ? '😎' : status === 'lost' ? '😵' : '🙂'}
                </button>
                <span style={{ color: '#ffd700', fontSize: '1.1rem', fontWeight: 700 }}>⏱ {time}s</span>
            </div>

            {/* Board */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${cols}, ${CELL}px)`,
                gap: 2,
                background: 'rgba(48,209,88,0.1)',
                padding: 4, borderRadius: 8,
                border: '1px solid rgba(48,209,88,0.2)',
            }}>
                {board.map((row, r) => row.map((cell, c) => (
                    <button key={`${r}-${c}`}
                        onClick={e => flagMode ? toggleFlag(e, r, c) : revealCell(r, c)}
                        onContextMenu={e => toggleFlag(e, r, c)}
                        style={{
                            width: CELL, height: CELL,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: CELL > 28 ? '1rem' : '0.75rem', fontWeight: 700,
                            border: 'none', cursor: 'pointer', padding: 0, borderRadius: 3,
                            background: cell.isOpen
                                ? (cell.isMine ? '#ff453a' : 'rgba(255,255,255,0.08)')
                                : 'rgba(255,255,255,0.12)',
                            color: NUM_COLORS[cell.neighbors] || 'white',
                            boxShadow: !cell.isOpen
                                ? 'inset 1px 1px 0 rgba(255,255,255,0.2), inset -1px -1px 0 rgba(0,0,0,0.3)'
                                : 'none',
                        }}
                    >
                        {cell.isOpen
                            ? (cell.isMine ? '💣' : (cell.neighbors > 0 ? cell.neighbors : ''))
                            : (cell.isFlagged ? '🚩' : '')}
                    </button>
                )))}
            </div>

            {(status === 'won' || status === 'lost') && (
                <div style={{ marginTop: 16, textAlign: 'center' }}>
                    <p style={{ color: status === 'won' ? '#30d158' : '#ff453a', fontSize: '1.3rem', fontWeight: 700, margin: '0 0 10px' }}>
                        {status === 'won' ? `¡Ganaste en ${fmtScore(`BUSCAMINAS_${levelKey}`, time)}! 🎉` : '¡Boom! 💥'}
                    </p>
                    {status === 'won' && (
                        showSave
                            ? <SaveForm gameKey={`BUSCAMINAS_${levelKey}`} score={time} accentColor="#30d158" onDone={() => setShowSave(false)} />
                            : <button onClick={() => setShowSave(true)} style={{ background:'rgba(48,209,88,0.15)', color:'#30d158', border:'1px solid rgba(48,209,88,0.4)', borderRadius:7, padding:'6px 16px', cursor:'pointer', fontSize:'0.82rem', marginBottom:10 }}>📋 Guardar tiempo</button>
                    )}
                    <button onClick={reset} style={{
                        background: '#30d158', color: '#000', border: 'none', borderRadius: 8,
                        padding: '8px 22px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem',
                        display: 'block', margin: '10px auto 0',
                    }}>Reiniciar</button>
                </div>
            )}

            {/* Flag mode toggle — útil en móvil donde no hay clic derecho */}
            <button
                onClick={() => setFlagMode(f => !f)}
                style={{
                    marginTop: 18,
                    padding: '12px 28px',
                    fontSize: '1.3rem',
                    fontWeight: 700,
                    borderRadius: 12,
                    border: `2px solid ${flagMode ? '#ff453a' : 'rgba(255,255,255,0.2)'}`,
                    background: flagMode ? 'rgba(255,69,58,0.2)' : 'rgba(255,255,255,0.06)',
                    color: flagMode ? '#ff453a' : 'rgba(255,255,255,0.5)',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 10,
                    boxShadow: flagMode ? '0 0 16px rgba(255,69,58,0.4)' : 'none',
                    transition: 'all 0.15s',
                }}
            >
                🚩 {flagMode ? 'Modo bandera ACTIVO' : 'Poner bandera'}
            </button>

            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.7rem', marginTop: 10 }}>
                Clic izquierdo: revelar · Clic derecho / botón 🚩: bandera
            </p>
        </div>
    );
}
