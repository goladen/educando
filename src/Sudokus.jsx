import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Play, RefreshCw, CheckCircle, BrainCircuit, Lock, Grid3X3, Eraser, Edit3, Clock } from 'lucide-react';
import Confetti from 'react-confetti';

// ══════════════════════════════════════════════════════════════════════════════
// 1. CONECTA LOS PUNTOS (FLOW FREE) - INTACTO
// ══════════════════════════════════════════════════════════════════════════════

const LEVELS = [
    { id: 1, size: 5, dots: [{ r: 0, c: 0, color: '#e74c3c', id: 'red' }, { r: 4, c: 0, color: '#e74c3c', id: 'red' }, { r: 0, c: 4, color: '#3498db', id: 'blue' }, { r: 4, c: 3, color: '#3498db', id: 'blue' }, { r: 0, c: 3, color: '#2ecc71', id: 'green' }, { r: 3, c: 1, color: '#2ecc71', id: 'green' }, { r: 2, c: 3, color: '#f1c40f', id: 'yellow' }, { r: 4, c: 4, color: '#f1c40f', id: 'yellow' }] },
    { id: 2, size: 6, dots: [{ r: 0, c: 0, color: '#e74c3c', id: 'red' }, { r: 2, c: 2, color: '#e74c3c', id: 'red' }, { r: 0, c: 1, color: '#3498db', id: 'blue' }, { r: 5, c: 5, color: '#3498db', id: 'blue' }, { r: 1, c: 1, color: '#2ecc71', id: 'green' }, { r: 4, c: 1, color: '#2ecc71', id: 'green' }, { r: 2, c: 4, color: '#9b59b6', id: 'purple' }, { r: 5, c: 0, color: '#9b59b6', id: 'purple' }, { r: 3, c: 3, color: '#f1c40f', id: 'yellow' }, { r: 4, c: 4, color: '#f1c40f', id: 'yellow' }] },
    { id: 3, size: 6, dots: [{ r: 0, c: 0, color: '#e74c3c', id: 'red' }, { r: 4, c: 4, color: '#e74c3c', id: 'red' }, { r: 0, c: 5, color: '#3498db', id: 'blue' }, { r: 3, c: 2, color: '#3498db', id: 'blue' }, { r: 1, c: 0, color: '#2ecc71', id: 'green' }, { r: 5, c: 2, color: '#2ecc71', id: 'green' }, { r: 2, c: 2, color: '#f1c40f', id: 'yellow' }, { r: 5, c: 5, color: '#f1c40f', id: 'yellow' }, { r: 2, c: 4, color: '#e67e22', id: 'orange' }, { r: 4, c: 5, color: '#e67e22', id: 'orange' }] }
];

function ConectaPuntos({ levelData, onWin, onVolver }) {
    const [paths, setPaths] = useState({});
    const [activeColor, setActiveColor] = useState(null);
    const [isWon, setIsWon] = useState(false);
    const gridRef = useRef(null);

    useEffect(() => { setPaths({}); setIsWon(false); setActiveColor(null); }, [levelData]);

    const getDotAt = (r, c) => levelData.dots.find(d => d.r === r && d.c === c);
    const isAdjacent = (p1, p2) => Math.abs(p1.r - p2.r) + Math.abs(p1.c - p2.c) === 1;

    const handleStart = (r, c) => {
        if (isWon) return;
        const dot = getDotAt(r, c);
        let colorId = null;
        if (dot) { colorId = dot.id; setPaths(prev => ({ ...prev, [colorId]: [{ r, c }] })); } 
        else {
            Object.keys(paths).forEach(color => {
                const path = paths[color];
                const idx = path.findIndex(p => p.r === r && p.c === c);
                if (idx !== -1) { colorId = color; setPaths(prev => ({ ...prev, [colorId]: path.slice(0, idx + 1) })); }
            });
        }
        setActiveColor(colorId);
    };

    const handleMove = (clientX, clientY) => {
        if (!activeColor || isWon) return;
        const grid = gridRef.current; if (!grid) return;
        const rect = grid.getBoundingClientRect();
        const cellSize = rect.width / levelData.size;
        const x = clientX - rect.left, y = clientY - top;
        if (x < 0 || x >= rect.width || y < 0 || y >= rect.height) return;
        const c = Math.floor(x / cellSize), r = Math.floor(y / cellSize);

        setPaths(prev => {
            const path = prev[activeColor] || [];
            if (path.length === 0) return prev;
            const lastPos = path[path.length - 1];
            if (lastPos.r === r && lastPos.c === c) return prev;
            if (!isAdjacent(lastPos, { r, c })) return prev;
            const dot = getDotAt(r, c);
            if (dot && dot.id !== activeColor) return prev;
            const selfIdx = path.findIndex(p => p.r === r && p.c === c);
            if (selfIdx !== -1) return { ...prev, [activeColor]: path.slice(0, selfIdx + 1) };

            const nextPaths = { ...prev };
            Object.keys(nextPaths).forEach(color => {
                if (color !== activeColor) {
                    const otherPath = nextPaths[color];
                    const cutIdx = otherPath.findIndex(p => p.r === r && p.c === c);
                    if (cutIdx !== -1) nextPaths[color] = otherPath.slice(0, cutIdx);
                }
            });

            const nextPath = [...path, { r, c }];
            nextPaths[activeColor] = nextPath;
            if (dot && dot.id === activeColor && path.length > 0) {
                setTimeout(() => setActiveColor(null), 0);
                setTimeout(() => checkWinCondition(nextPaths), 50);
            }
            return nextPaths;
        });
    };

    const handleEnd = () => { setActiveColor(null); checkWinCondition(paths); };

    const checkWinCondition = (currentPaths) => {
        const allColorsConnected = levelData.dots.every(dot => {
            const path = currentPaths[dot.id];
            if (!path || path.length < 2) return false;
            const last = path[path.length - 1];
            const otherDot = levelData.dots.find(d => d.id === dot.id && (d.r !== dot.r || d.c !== dot.c));
            return last.r === otherDot.r && last.c === otherDot.c;
        });
        let filledCells = 0;
        Object.values(currentPaths).forEach(path => { filledCells += path.length; });
        if (allColorsConnected && filledCells === levelData.size * levelData.size) {
            setIsWon(true); if (onWin) setTimeout(onWin, 1500);
        }
    };

    const cellSizePct = 100 / levelData.size;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            {isWon && <Confetti recycle={false} numberOfPieces={300} />}
            <div style={{ display:'flex', justifyContent:'space-between', width:'100%', maxWidth: 400, marginBottom: 20, alignItems: 'center' }}>
                <button onClick={onVolver} style={st.btnSecundario}><ArrowLeft size={16}/> Volver</button>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'white' }}>Nivel {levelData.id}</div>
                <button onClick={() => setPaths({})} style={st.btnRefresh}><RefreshCw size={18}/></button>
            </div>
            <div 
                ref={gridRef} onMouseLeave={handleEnd} onMouseUp={handleEnd} onMouseMove={(e) => activeColor && handleMove(e.clientX, e.clientY)}
                onTouchMove={(e) => { e.preventDefault(); handleMove(e.touches[0].clientX, e.touches[0].clientY); }} onTouchEnd={handleEnd}
                style={{ position: 'relative', width: '100%', maxWidth: 450, aspectRatio: '1/1', background: '#1e272e', borderRadius: 12, border: '4px solid #34495e', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', overflow: 'hidden', touchAction: 'none' }}
            >
                <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: `repeat(${levelData.size}, 1fr)`, gridTemplateRows: `repeat(${levelData.size}, 1fr)` }}>
                    {Array.from({ length: levelData.size * levelData.size }).map((_, i) => <div key={i} style={{ border: '1px solid rgba(255,255,255,0.05)' }} />)}
                </div>
                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                    {Object.keys(paths).map(colorId => {
                        const path = paths[colorId];
                        if (path.length < 2) return null;
                        const dotColor = levelData.dots.find(d => d.id === colorId).color;
                        const pointsStr = path.map(p => `${(p.c + 0.5) * cellSizePct}% ${(p.r + 0.5) * cellSizePct}%`).join(', ');
                        return <polyline key={colorId} points={pointsStr} fill="none" stroke={dotColor} strokeWidth="15%" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 5px ${dotColor}88)` }} />;
                    })}
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: `repeat(${levelData.size}, 1fr)`, gridTemplateRows: `repeat(${levelData.size}, 1fr)` }}>
                    {Array.from({ length: levelData.size }).map((_, r) => 
                        Array.from({ length: levelData.size }).map((_, c) => {
                            const dot = getDotAt(r, c);
                            return (
                                <div key={`${r}-${c}`} onMouseDown={(e) => { e.preventDefault(); handleStart(r, c); }} onTouchStart={() => handleStart(r, c)} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                    {dot && <div style={{ width: '60%', height: '60%', borderRadius: '50%', background: dot.color, boxShadow: `inset 0 -3px 0 rgba(0,0,0,0.3), 0 0 10px ${dot.color}88`, position: 'relative', zIndex: 10 }} />}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
            {isWon && <div style={st.winBadge}><CheckCircle size={24} /> ¡Nivel Completado!</div>}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. SUDOKU PROFESIONAL (UX Avanzada, Notas, Teclado, Highlighting)
// ══════════════════════════════════════════════════════════════════════════════

const isValidSudokuPlacement = (board, r, c, num) => {
    for (let i = 0; i < 9; i++) {
        if (board[r][i] === num && i !== c) return false;
        if (board[i][c] === num && i !== r) return false;
    }
    const startR = Math.floor(r / 3) * 3;
    const startC = Math.floor(c / 3) * 3;
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            if (board[startR + i][startC + j] === num && (startR + i !== r || startC + j !== c)) return false;
        }
    }
    return true;
};

const solveSudoku = (board) => {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (board[r][c] === 0) {
                const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
                for (let n of nums) {
                    if (isValidSudokuPlacement(board, r, c, n)) {
                        board[r][c] = n;
                        if (solveSudoku(board)) return true;
                        board[r][c] = 0;
                    }
                }
                return false;
            }
        }
    }
    return true;
};

const generateSudoku = (difficulty) => {
    let board = Array(9).fill(0).map(() => Array(9).fill(0));
    solveSudoku(board);
    let initialBoard = board.map(row => [...row]);
    let cellsToRemove = difficulty === 'FÁCIL' ? 35 : difficulty === 'MEDIO' ? 45 : 55;
    while (cellsToRemove > 0) {
        let r = Math.floor(Math.random() * 9);
        let c = Math.floor(Math.random() * 9);
        if (initialBoard[r][c] !== 0) {
            initialBoard[r][c] = 0;
            cellsToRemove--;
        }
    }
    return { initial: initialBoard, full: board };
};

const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
};

function JuegoSudoku({ onVolver }) {
    const [difficulty, setDifficulty] = useState(null);
    const [board, setBoard] = useState([]);
    const [initialBoard, setInitialBoard] = useState([]);
    // Estado para "Notas" (pencil marks): Matriz 9x9 de Arrays con números del 1 al 9
    const [notes, setNotes] = useState([]);
    
    const [selectedCell, setSelectedCell] = useState({ r: null, c: null });
    const [notesMode, setNotesMode] = useState(false);
    const [isWon, setIsWon] = useState(false);
    const [seconds, setSeconds] = useState(0);

    // Temporizador
    useEffect(() => {
        let interval = null;
        if (difficulty && !isWon) {
            interval = setInterval(() => setSeconds(s => s + 1), 1000);
        }
        return () => clearInterval(interval);
    }, [difficulty, isWon]);

    const initGame = (diff) => {
        const { initial } = generateSudoku(diff);
        setInitialBoard(initial.map(row => [...row]));
        setBoard(initial.map(row => [...row]));
        setNotes(Array(9).fill(null).map(() => Array(9).fill([])));
        setDifficulty(diff);
        setIsWon(false);
        setSelectedCell({ r: 0, c: 0 });
        setSeconds(0);
        setNotesMode(false);
    };

    const checkWin = (currentBoard) => {
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (currentBoard[r][c] === 0 || !isValidSudokuPlacement(currentBoard, r, c, currentBoard[r][c])) {
                    return false;
                }
            }
        }
        return true;
    };

    // Eliminar número de las notas de la fila, columna y cuadrante
    const autoCleanNotes = (currentNotes, r, c, num) => {
        const newNotes = currentNotes.map(row => row.map(cell => [...cell]));
        // Limpiar fila y columna
        for (let i = 0; i < 9; i++) {
            newNotes[r][i] = newNotes[r][i].filter(n => n !== num);
            newNotes[i][c] = newNotes[i][c].filter(n => n !== num);
        }
        // Limpiar bloque 3x3
        const startR = Math.floor(r / 3) * 3;
        const startC = Math.floor(c / 3) * 3;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                newNotes[startR + i][startC + j] = newNotes[startR + i][startC + j].filter(n => n !== num);
            }
        }
        return newNotes;
    };

    const handleNumberClick = useCallback((num) => {
        if (isWon || selectedCell.r === null || selectedCell.c === null) return;
        if (initialBoard[selectedCell.r][selectedCell.c] !== 0) return;

        const { r, c } = selectedCell;

        if (num === 0) { // Borrador
            const newBoard = board.map(row => [...row]);
            newBoard[r][c] = 0;
            setBoard(newBoard);
            return;
        }

        if (notesMode) {
            // Lógica para añadir/quitar Nota
            const newNotes = notes.map(row => row.map(cell => [...cell]));
            const cellNotes = newNotes[r][c];
            if (cellNotes.includes(num)) {
                newNotes[r][c] = cellNotes.filter(n => n !== num);
            } else {
                newNotes[r][c] = [...cellNotes, num].sort();
            }
            setNotes(newNotes);
            
            // Si había un número puesto, lo quitamos porque estamos haciendo anotaciones
            if (board[r][c] !== 0) {
                const newBoard = board.map(row => [...row]);
                newBoard[r][c] = 0;
                setBoard(newBoard);
            }
        } else {
            // Poner Número definitivo
            const newBoard = board.map(row => [...row]);
            newBoard[r][c] = num;
            setBoard(newBoard);
            
            // Autolimpiar notas
            const cleanedNotes = autoCleanNotes(notes, r, c, num);
            setNotes(cleanedNotes);

            if (checkWin(newBoard)) setIsWon(true);
        }
    }, [isWon, selectedCell, initialBoard, notesMode, notes, board]);

    // Soporte para Teclado
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!difficulty || isWon) return;
            const { r, c } = selectedCell;

            // Navegación con flechas
            if (e.key === 'ArrowUp') setSelectedCell({ r: Math.max(0, r - 1), c });
            if (e.key === 'ArrowDown') setSelectedCell({ r: Math.min(8, r + 1), c });
            if (e.key === 'ArrowLeft') setSelectedCell({ r, c: Math.max(0, c - 1) });
            if (e.key === 'ArrowRight') setSelectedCell({ r, c: Math.min(8, c + 1) });

            // Números del 1 al 9
            if (e.key >= '1' && e.key <= '9') handleNumberClick(parseInt(e.key));
            
            // Borrar
            if (e.key === 'Backspace' || e.key === 'Delete') handleNumberClick(0);
            
            // Atajo para Notas (N)
            if (e.key.toLowerCase() === 'n') setNotesMode(prev => !prev);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [difficulty, isWon, selectedCell, handleNumberClick]);

    const hasConflict = (r, c, num) => {
        if (num === 0) return false;
        return !isValidSudokuPlacement(board, r, c, num);
    };

    if (!difficulty) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 400 }}>
                <div style={{ display:'flex', justifyContent:'flex-start', width:'100%', marginBottom: 30 }}>
                    <button onClick={onVolver} style={st.btnSecundario}><ArrowLeft size={16}/> Volver</button>
                </div>
                <Grid3X3 size={60} color="#3498db" style={{ marginBottom: 20 }} />
                <h2 style={{ color: 'white', marginBottom: 30 }}>Selecciona la Dificultad</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 15, width: '100%' }}>
                    <button onClick={() => initGame('FÁCIL')} style={{ ...st.btnLevel, background: '#2ecc71' }}>Sencillo</button>
                    <button onClick={() => initGame('MEDIO')} style={{ ...st.btnLevel, background: '#f39c12' }}>Medio</button>
                    <button onClick={() => initGame('DIFÍCIL')} style={{ ...st.btnLevel, background: '#e74c3c' }}>Difícil</button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            {isWon && <Confetti recycle={false} numberOfPieces={300} />}
            
            <div style={{ display:'flex', justifyContent:'space-between', width:'100%', maxWidth: 450, marginBottom: 15, alignItems: 'center' }}>
                <button onClick={() => setDifficulty(null)} style={st.btnSecundario}><ArrowLeft size={16}/> Atrás</button>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 'bold', color: 'white', letterSpacing: 1 }}>{difficulty}</div>
                    <div style={{ fontSize: '0.85rem', color: '#bdc3c7', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Clock size={12}/> {formatTime(seconds)}
                    </div>
                </div>
                <button onClick={() => initGame(difficulty)} style={st.btnRefresh}><RefreshCw size={18}/></button>
            </div>

            {/* TABLERO SUDOKU */}
            <div style={{ 
                display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', 
                width: '100%', maxWidth: 450, aspectRatio: '1/1', 
                background: '#2c3e50', border: '3px solid #1a252f', borderRadius: 8, overflow: 'hidden',
                boxShadow: '0 10px 30px rgba(0,0,0,0.4)', userSelect: 'none'
            }}>
                {board.map((row, r) => row.map((val, c) => {
                    const isInitial = initialBoard[r][c] !== 0;
                    const isSelected = selectedCell.r === r && selectedCell.c === c;
                    
                    // Lógica de Resaltado Inteligente
                    const isSameRowColBox = selectedCell.r !== null && (
                        selectedCell.r === r || 
                        selectedCell.c === c || 
                        (Math.floor(r/3) === Math.floor(selectedCell.r/3) && Math.floor(c/3) === Math.floor(selectedCell.c/3))
                    );
                    const selectedVal = selectedCell.r !== null ? board[selectedCell.r][selectedCell.c] : 0;
                    const isSameNumber = val !== 0 && selectedVal === val;
                    const conflict = !isInitial && hasConflict(r, c, val);

                    // Bordes gruesos para cuadrantes
                    let borderBottom = (r === 2 || r === 5) ? '3px solid #1a252f' : '1px solid #bdc3c7';
                    let borderRight = (c === 2 || c === 5) ? '3px solid #1a252f' : '1px solid #bdc3c7';

                    // Colores de Fondo Pro
                    let bgColor = 'white';
                    if (isSelected) bgColor = '#bbdefb'; // Azul selección
                    else if (isSameNumber) bgColor = '#aed6f1'; // Azul mismo número
                    else if (isSameRowColBox) bgColor = '#ebf5fb'; // Azul clarito fila/col
                    else if (isInitial) bgColor = '#f8f9fa'; // Gris clarito para fijos

                    // Color de Texto Pro
                    let textColor = isInitial ? '#2c3e50' : '#2980b9'; // Fijos oscuros, usuario azules
                    if (conflict) { bgColor = '#fadbd8'; textColor = '#c0392b'; } // Error en rojo

                    return (
                        <div 
                            key={`${r}-${c}`}
                            onClick={() => !isWon && setSelectedCell({ r, c })}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                                background: bgColor, color: textColor,
                                borderBottom, borderRight,
                                fontSize: 'clamp(1.2rem, 5vw, 1.8rem)', fontWeight: isInitial ? '900' : '600',
                                cursor: isWon ? 'default' : 'pointer',
                                transition: 'background 0.1s'
                            }}
                        >
                            {val !== 0 ? val : ''}

                            {/* Renderizar Notas (Pencil Marks) si la celda está vacía */}
                            {val === 0 && notes[r][c].length > 0 && (
                                <div style={{ 
                                    position: 'absolute', inset: 2, display: 'grid', 
                                    gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(3, 1fr)',
                                    pointerEvents: 'none'
                                }}>
                                    {[1,2,3,4,5,6,7,8,9].map(n => (
                                        <div key={n} style={{ 
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 'clamp(0.45rem, 2vw, 0.65rem)', color: '#7f8c8d', fontWeight: 'bold'
                                        }}>
                                            {notes[r][c].includes(n) ? n : ''}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                }))}
            </div>

            {/* CONTROLES PROFESIONALES (Notas, Borrador, Numpad) */}
            <div style={{ width: '100%', maxWidth: 450, marginTop: 25, display: 'flex', flexDirection: 'column', gap: 15 }}>
                
                {/* Botones de Acción */}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                    <button 
                        onClick={() => handleNumberClick(0)}
                        style={{ ...st.btnAction, flex: 1 }}
                    >
                        <Eraser size={20} /> Borrar
                    </button>
                    <button 
                        onClick={() => setNotesMode(!notesMode)}
                        style={{ ...st.btnAction, flex: 2, background: notesMode ? '#3498db' : '#34495e', color: 'white' }}
                    >
                        <Edit3 size={20} /> {notesMode ? 'Modo Notas: ACTIVO' : 'Modo Notas: OFF'}
                    </button>
                </div>

                {/* Teclado Numérico */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 6 }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                        <button 
                            key={num} 
                            onClick={() => handleNumberClick(num)}
                            style={st.btnNumpad}
                        >
                            {num}
                        </button>
                    ))}
                </div>
            </div>

            {isWon && (
                <div style={st.winBadge}>
                    <CheckCircle size={24} /> ¡Sudoku Completado en {formatTime(seconds)}!
                </div>
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. MENÚ PRINCIPAL DE RETOS
// ══════════════════════════════════════════════════════════════════════════════

export default function Retos({ onExit }) {
    const [activeGame, setActiveGame] = useState(null); 
    const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
    const [nivelesDesbloqueados, setNivelesDesbloqueados] = useState(1);

    const handleWinConecta = () => {
        if (currentLevelIdx < LEVELS.length - 1) {
            setNivelesDesbloqueados(prev => Math.max(prev, currentLevelIdx + 2));
            setCurrentLevelIdx(prev => prev + 1);
        } else {
            setTimeout(() => setActiveGame(null), 3000);
        }
    };

    if (activeGame === 'CONECTA') return <div style={st.containerGame}><ConectaPuntos levelData={LEVELS[currentLevelIdx]} onWin={handleWinConecta} onVolver={() => setActiveGame(null)} /></div>;
    if (activeGame === 'SUDOKU') return <div style={st.containerGame}><JuegoSudoku onVolver={() => setActiveGame(null)} /></div>;

    return (
        <div style={st.container}>
            <div style={st.header}>
                <button onClick={onExit} style={st.btnVolver}><ArrowLeft size={16}/> Salir al menú principal</button>
            </div>

            <div style={{ textAlign: 'center', marginBottom: 40 }}>
                <div style={{ background: '#f39c12', width: 80, height: 80, borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px', boxShadow: '0 10px 20px rgba(243, 156, 18, 0.3)' }}>
                    <BrainCircuit size={45} color="white" />
                </div>
                <h1 style={{ color: 'white', fontSize: '2.5rem', margin: '0 0 10px' }}>Sala de Retos</h1>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1.1rem', margin: 0 }}>Entrena tu lógica, visión espacial y resolución de problemas.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, width: '100%', maxWidth: 800 }}>
                
                {/* TARJETA 1: CONECTA LOS PUNTOS */}
                <div style={st.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 }}>
                        <div style={{ background: '#e74c3c', padding: 12, borderRadius: 14 }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: 20, fontSize: '0.8rem', color: 'white', fontWeight: 'bold' }}>Topología</div>
                    </div>
                    <h2 style={{ color: 'white', margin: '0 0 10px', fontSize: '1.5rem' }}>Conecta los Puntos</h2>
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: 20 }}>
                        Une los puntos del mismo color trazando tuberías sin que se crucen entre ellas. ¡Debes rellenar todo el tablero!
                    </p>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {LEVELS.map((lvl, idx) => (
                            <button 
                                key={lvl.id} disabled={idx + 1 > nivelesDesbloqueados} onClick={() => { setCurrentLevelIdx(idx); setActiveGame('CONECTA'); }}
                                style={{ 
                                    flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', fontWeight: 'bold', cursor: idx + 1 > nivelesDesbloqueados ? 'not-allowed' : 'pointer',
                                    background: idx + 1 <= nivelesDesbloqueados ? '#3498db' : 'rgba(255,255,255,0.1)',
                                    color: idx + 1 <= nivelesDesbloqueados ? 'white' : 'rgba(255,255,255,0.3)'
                                }}
                            >
                                {idx + 1 > nivelesDesbloqueados ? <Lock size={16} /> : `Nivel ${lvl.id}`}
                            </button>
                        ))}
                    </div>
                </div>

                {/* TARJETA 2: SUDOKU */}
                <div style={st.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 }}>
                        <div style={{ background: '#3498db', padding: 12, borderRadius: 14 }}>
                            <Grid3X3 size={24} color="white" />
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: 20, fontSize: '0.8rem', color: 'white', fontWeight: 'bold' }}>Lógica Numérica</div>
                    </div>
                    <h2 style={{ color: 'white', margin: '0 0 10px', fontSize: '1.5rem' }}>Sudoku Infinito</h2>
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: 20 }}>
                        El reto clásico por excelencia con UX Profesional: modo notas, teclado, y autolimpieza inteligente de celdas.
                    </p>
                    <button onClick={() => setActiveGame('SUDOKU')} style={{ width: '100%', padding: '12px', background: '#3498db', color: 'white', border: 'none', borderRadius: 10, fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <Play size={18} /> Jugar Sudoku
                    </button>
                </div>

            </div>
        </div>
    );
}

// ─── ESTILOS COMPARTIDOS ──────────────────────────────────────────────────────
const st = {
    container: { minHeight: '100vh', background: 'linear-gradient(135deg, #1e272e 0%, #2c3e50 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 20px', fontFamily: "'Segoe UI', Tahoma, sans-serif" },
    containerGame: { minHeight: '100vh', background: '#0f141d', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Segoe UI', Tahoma, sans-serif" },
    header: { width: '100%', maxWidth: 800, display: 'flex', justifyContent: 'flex-start', marginBottom: 20 },
    btnVolver: { background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '10px 15px', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 'bold', transition: 'background 0.2s' },
    btnSecundario: { background: 'transparent', border: '1.5px solid rgba(255,255,255,0.2)', color: 'white', padding: '8px 12px', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 'bold' },
    btnRefresh: { background: 'rgba(231, 76, 60, 0.2)', border: 'none', color: '#e74c3c', padding: '8px', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    card: { background: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 30, border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 15px 35px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' },
    winBadge: { marginTop: 25, background: '#27ae60', color: 'white', padding: '15px 30px', borderRadius: 30, fontSize: '1.2rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 10, animation: 'pop 0.5s' },
    btnLevel: { padding: '15px', border: 'none', borderRadius: 12, color: 'white', fontWeight: 'bold', fontSize: '1.2rem', cursor: 'pointer', boxShadow: '0 5px 15px rgba(0,0,0,0.2)' },
    btnNumpad: { background: '#ecf0f1', border: 'none', borderRadius: 8, color: '#2c3e50', fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 'bold', padding: '10px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', transition: 'transform 0.1s' },
    btnAction: { border: 'none', borderRadius: 10, padding: '12px 15px', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#ecf0f1', color: '#34495e', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }
};