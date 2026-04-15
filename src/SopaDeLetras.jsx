import React, { useState, useEffect, useRef } from 'react';

const PALABRAS_PRUEBA = ['SUMA', 'RESTA', 'DIVISION', 'FRACCION', 'DECIMAL', 'ECUACION', 'ALGEBRA', 'ANGULO'];

const DIRS_NORMAL = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];
const DIRS_SIMPLE = [[1,0],[0,1]]; // solo derecha y abajo

const COLORES = ['#e74c3c','#3498db','#f1c40f','#2ecc71','#9b59b6','#e67e22','#1abc9c','#e84393'];
const COLOR_PISTA = '#f39c12';

const GRID_SIZE = 9;

export default function SopaDeLetras({
    palabras = PALABRAS_PRUEBA,
    mostrarLista = true,
    onTerminar = () => alert('¡Sopa completada!'),
    onPalabraEncontrada = null
}) {
    const [grid,                setGrid]                = useState([]);
    const [palabrasActivas,     setPalabrasActivas]     = useState([]);
    const [palabrasEncontradas, setPalabrasEncontradas] = useState([]);
    const [trazosEncontrados,   setTrazosEncontrados]   = useState([]);
    const [seleccion,           setSeleccion]           = useState([]);
    const [isDragging,          setIsDragging]          = useState(false);
    const [mostrarSolucion,     setMostrarSolucion]     = useState(false);
    const [solucionesCeldas,    setSolucionesCeldas]    = useState([]);
    const [modoSimple,          setModoSimple]          = useState(false);
    const [pistaActiva,         setPistaActiva]         = useState(false);

    const startCell = useRef(null);
    const gridRef   = useRef(null);

    // ── Generador ─────────────────────────────────────────────────────────────
    useEffect(() => {
        const direcciones = modoSimple ? DIRS_SIMPLE : DIRS_NORMAL;

        const mapeadas = palabras.map(p => ({
            original: p,
            limpia: p.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
        })).sort((a, b) => b.limpia.length - a.limpia.length);

        const size = GRID_SIZE;
        let tablero = Array(size).fill(null).map(() => Array(size).fill(''));
        let colocadas = [];
        let soluciones = [];

        const intentarColocar = (item) => {
            let colocada = false, intentos = 0;
            while (!colocada && intentos < 2000) {
                intentos++;
                const dir = direcciones[Math.floor(Math.random() * direcciones.length)];
                const fi  = Math.floor(Math.random() * size);
                const ci  = Math.floor(Math.random() * size);
                let cabe = true;
                for (let i = 0; i < item.limpia.length; i++) {
                    const f = fi + dir[0]*i, c = ci + dir[1]*i;
                    if (f < 0 || f >= size || c < 0 || c >= size ||
                        (tablero[f][c] !== '' && tablero[f][c] !== item.limpia[i])) {
                        cabe = false; break;
                    }
                }
                if (cabe) {
                    let celdas = [];
                    for (let i = 0; i < item.limpia.length; i++) {
                        const f = fi + dir[0]*i, c = ci + dir[1]*i;
                        tablero[f][c] = item.limpia[i];
                        celdas.push({ f, c });
                    }
                    colocada = true;
                    colocadas.push(item.original);
                    soluciones.push({ palabra: item.limpia, celdas });
                }
            }
            if (!colocada) console.warn('No cupo:', item.original);
        };

        mapeadas.forEach(intentarColocar);

        const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for (let f = 0; f < size; f++)
            for (let c = 0; c < size; c++)
                if (tablero[f][c] === '') tablero[f][c] = abc[Math.floor(Math.random() * 26)];

        setGrid(tablero);
        setPalabrasActivas(colocadas);
        setSolucionesCeldas(soluciones);
        setPalabrasEncontradas([]);
        setTrazosEncontrados([]);
        setSeleccion([]);
        setMostrarSolucion(false);
        setPistaActiva(false);
    }, [palabras, modoSimple]);

    // ── Bloquear scroll táctil ────────────────────────────────────────────────
    useEffect(() => {
        const el = gridRef.current;
        if (!el) return;
        const stop = e => e.preventDefault();
        el.addEventListener('touchmove', stop, { passive: false });
        return () => el.removeEventListener('touchmove', stop);
    }, []);

    // ── Selección ─────────────────────────────────────────────────────────────
    const getCeldasLinea = (f1, c1, f2, c2) => {
        const df = f2-f1, dc = c2-c1;
        if (df !== 0 && dc !== 0 && Math.abs(df) !== Math.abs(dc)) return [];
        const pasos = Math.max(Math.abs(df), Math.abs(dc));
        const sf = df===0 ? 0 : df/pasos;
        const sc = dc===0 ? 0 : dc/pasos;
        let linea = [];
        for (let i = 0; i <= pasos; i++) linea.push({ f: f1+sf*i, c: c1+sc*i });
        return linea;
    };

    const iniciarTrazo = (f, c) => {
        if (mostrarSolucion) return;
        setIsDragging(true);
        startCell.current = { f, c };
        setSeleccion([{ f, c }]);
    };

    const moverTrazo = (f, c) => {
        if (!isDragging || !startCell.current) return;
        const linea = getCeldasLinea(startCell.current.f, startCell.current.c, f, c);
        if (linea.length > 0) setSeleccion(linea);
    };

    const finalizarTrazo = () => {
        if (!isDragging) return;
        setIsDragging(false);
        if (seleccion.length > 1) {
            const sel = seleccion.map(s => grid[s.f][s.c]).join('');
            const inv = sel.split('').reverse().join('');
            const limpias = palabrasActivas.map(p => p.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase());
            const ok = limpias.find(p => p === sel || p === inv);
            if (ok && !palabrasEncontradas.includes(ok)) {
                const nuevas = [...palabrasEncontradas, ok];
                setPalabrasEncontradas(nuevas);
                const color = COLORES[palabrasEncontradas.length % COLORES.length];
                setTrazosEncontrados([...trazosEncontrados, ...seleccion.map(s => ({ ...s, color }))]);
                if (onPalabraEncontrada) onPalabraEncontrada();
                if (nuevas.length === palabrasActivas.length) setTimeout(onTerminar, 500);
            }
        }
        setSeleccion([]);
        startCell.current = null;
    };

    const handleTouchMove = (e) => {
        if (!isDragging || mostrarSolucion) return;
        const t = e.touches[0];
        const el = document.elementFromPoint(t.clientX, t.clientY);
        if (el?.dataset.f && el?.dataset.c)
            moverTrazo(parseInt(el.dataset.f), parseInt(el.dataset.c));
    };

    // ── Color de cada celda ───────────────────────────────────────────────────
    const isSel    = (f, c) => seleccion.some(s => s.f===f && s.c===c);
    const getTrazo = (f, c) => trazosEncontrados.find(s => s.f===f && s.c===c);

    const getColorSolucion = (f, c) => {
        if (!mostrarSolucion) return null;
        const sol = solucionesCeldas.find(s =>
            !palabrasEncontradas.includes(s.palabra) &&
            s.celdas.some(cd => cd.f===f && cd.c===c)
        );
        return sol ? COLORES[solucionesCeldas.indexOf(sol) % COLORES.length] : null;
    };

    const esPistaCelda = (f, c) => {
        if (!pistaActiva) return false;
        return solucionesCeldas.some(sol =>
            !palabrasEncontradas.includes(sol.palabra) &&
            sol.celdas[0].f === f && sol.celdas[0].c === c
        );
    };

    if (grid.length === 0) return <div style={{ color:'white', padding:20 }}>Generando sopa…</div>;

    return (
        <div style={st.container}>

            {/* ── Botones de modo ──────────────────────────────────────────── */}
            <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap', justifyContent:'center' }}>
                <button
                    onClick={() => setModoSimple(false)}
                    style={{ ...st.modeBtn,
                        background: !modoSimple ? '#3498db' : 'rgba(255,255,255,0.15)',
                        border: !modoSimple ? 'none' : '1.5px solid rgba(255,255,255,0.3)' }}
                >
                    ↕ Modo Normal
                </button>
                <button
                    onClick={() => setModoSimple(true)}
                    style={{ ...st.modeBtn,
                        background: modoSimple ? '#27ae60' : 'rgba(255,255,255,0.15)',
                        border: modoSimple ? 'none' : '1.5px solid rgba(255,255,255,0.3)' }}
                >
                    → Modo Simple
                </button>
            </div>

            {/* ── Lista de palabras ─────────────────────────────────────────── */}
            {mostrarLista && (
                <div style={st.wordList}>
                    {palabrasActivas.map((p, i) => {
                        const limpia = p.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
                        const enc = palabrasEncontradas.includes(limpia);
                        return (
                            <span key={i} style={{ ...st.badge,
                                background: enc ? '#2ecc71' : 'rgba(255,255,255,0.2)',
                                textDecoration: enc ? 'line-through' : 'none',
                                opacity: enc ? 0.6 : 1 }}>
                                {p}
                            </span>
                        );
                    })}
                </div>
            )}

            {/* ── Tablero ──────────────────────────────────────────────────── */}
            <div
                ref={gridRef}
                style={{ ...st.grid, gridTemplateColumns: `repeat(${grid.length}, 1fr)` }}
                onMouseLeave={finalizarTrazo}
                onMouseUp={finalizarTrazo}
                onTouchEnd={finalizarTrazo}
                onTouchMove={handleTouchMove}
            >
                {grid.map((fila, f) => fila.map((letra, c) => {
                    const sel      = isSel(f, c);
                    const trazo    = getTrazo(f, c);
                    const solColor = getColorSolucion(f, c);
                    const pista    = esPistaCelda(f, c);

                    let bg = 'white', color = '#2c3e50';
                    if (sel)      { bg = '#3498db';   color = 'white'; }
                    else if (trazo)   { bg = trazo.color; color = 'white'; }
                    else if (solColor){ bg = solColor;    color = 'white'; }
                    else if (pista)   { bg = COLOR_PISTA; color = 'white'; }

                    return (
                        <div
                            key={`${f}-${c}`}
                            data-f={f} data-c={c}
                            onMouseDown={() => iniciarTrazo(f, c)}
                            onMouseEnter={() => moverTrazo(f, c)}
                            onTouchStart={() => iniciarTrazo(f, c)}
                            style={{ ...st.cell, background:bg, color,
                                transform: sel ? 'scale(1.1)' : 'scale(1)' }}
                        >
                            {letra}
                        </div>
                    );
                }))}
            </div>

            {/* ── Botones inferiores ────────────────────────────────────────── */}
            <div style={{ display:'flex', gap:10, marginTop:18, flexWrap:'wrap', justifyContent:'center' }}>
                <button
                    onClick={() => setPistaActiva(v => !v)}
                    disabled={mostrarSolucion}
                    style={{ ...st.btn,
                        background: pistaActiva ? COLOR_PISTA : '#8e44ad',
                        opacity: mostrarSolucion ? 0.5 : 1,
                        cursor: mostrarSolucion ? 'not-allowed' : 'pointer' }}
                >
                    💡 {pistaActiva ? 'Ocultar pista' : 'Pista'}
                </button>
                <button
                    onClick={() => setMostrarSolucion(true)}
                    disabled={mostrarSolucion}
                    style={{ ...st.btn,
                        background: mostrarSolucion ? '#7f8c8d' : '#e74c3c',
                        cursor: mostrarSolucion ? 'not-allowed' : 'pointer' }}
                >
                    {mostrarSolucion ? 'Juego terminado' : '👀 Ver solución'}
                </button>
            </div>

            <style>{`body { touch-action: none; }`}</style>
        </div>
    );
}

const st = {
    container: {
        display:'flex', flexDirection:'column', alignItems:'center',
        background:'#2c3e50', padding:'20px', paddingBottom:'40px',
        marginBottom:'30px', borderRadius:'20px', color:'white',
        fontFamily:'Roboto, sans-serif', maxWidth:'100%', overflow:'hidden'
    },
    modeBtn: {
        padding:'8px 18px', borderRadius:20, fontWeight:'bold', color:'white',
        cursor:'pointer', fontSize:'0.88rem', transition:'all 0.2s'
    },
    wordList: {
        display:'flex', flexWrap:'wrap', gap:'10px', justifyContent:'center',
        marginBottom:'16px', width:'100%', maxWidth:'600px'
    },
    badge: {
        padding:'8px 15px', borderRadius:'20px', fontWeight:'bold',
        fontSize:'0.9rem', transition:'all 0.3s'
    },
    grid: {
        display:'grid', gap:'3px', background:'#bdc3c7', padding:'4px',
        borderRadius:'10px', touchAction:'none', userSelect:'none',
        maxWidth:'460px', width:'100%', aspectRatio:'1/1'
    },
    cell: {
        display:'flex', justifyContent:'center', alignItems:'center',
        fontWeight:'bold', fontSize:'clamp(0.9rem, 4.5vw, 1.4rem)',
        borderRadius:'4px', cursor:'pointer', transition:'all 0.1s',
        userSelect:'none', aspectRatio:'1/1'
    },
    btn: {
        padding:'11px 22px', color:'white', border:'none', borderRadius:'10px',
        fontWeight:'bold', fontSize:'0.95rem',
        boxShadow:'0 4px 6px rgba(0,0,0,0.2)', transition:'all 0.2s'
    }
};
