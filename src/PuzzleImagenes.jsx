import React, { useState, useRef, useEffect, useCallback } from 'react';
import { guardarRegistroLocal } from './utils/registrosLocales';

// Imágenes precargadas (assets del proyecto)
import piContento   from './assets/Pi-contento.png';
import piNeutro     from './assets/Pi-neutro.png';
import piEnfadado   from './assets/Pi-enfadado.png';
import fondoMarino  from './assets/FondoMarino.png';
import pantalla1    from './assets/pantalla1.jpeg';
import pantalla2    from './assets/pantalla2.jpeg';
import pantalla3    from './assets/pantalla3.jpeg';
import pantalla4    from './assets/pantalla4.jpeg';
import pantalla5    from './assets/pantalla5.jpeg';
import keystudio    from './assets/imagenkeystudio.jpg';
import barcoRojo    from './assets/BarcoRojo.png';
import barcoAzul    from './assets/BarcoAzul.png';
import bomberman    from './assets/Bomberman.png';
import lenguaSignos from './assets/lenguadesigno.jpg';
import iconoBurbujas from './assets/icono_burbujas.png';
import iconoOlympic from './assets/icono_olympic.png';
import iconoPasapal from './assets/icono_pasapal.png';
import iconoMathle  from './assets/icono_mathle.png';
import iconoWordle  from './assets/icono_wordle.png';
import iconoPikatron from './assets/icono_pikatron.png';

// ──────────────────────────────────────────────────────────────────────────────
// Puzzle de Imágenes — corta una foto en piezas rectangulares, las desordena y
// las recolocas intercambiándolas (tap-tap o arrastrando). 3 dificultades.
// ──────────────────────────────────────────────────────────────────────────────

const PUZZLES = [
    { id: 'pi-contento',  nombre: 'Pi Contento',     img: piContento },
    { id: 'pi-neutro',    nombre: 'Pi Neutro',       img: piNeutro },
    { id: 'pi-enfadado',  nombre: 'Pi Enfadado',     img: piEnfadado },
    { id: 'fondo-marino', nombre: 'Fondo Marino',    img: fondoMarino },
    { id: 'pantalla1',    nombre: 'Pantalla 1',      img: pantalla1 },
    { id: 'pantalla2',    nombre: 'Pantalla 2',      img: pantalla2 },
    { id: 'pantalla3',    nombre: 'Pantalla 3',      img: pantalla3 },
    { id: 'pantalla4',    nombre: 'Pantalla 4',      img: pantalla4 },
    { id: 'pantalla5',    nombre: 'Pantalla 5',      img: pantalla5 },
    { id: 'keystudio',    nombre: 'Keyestudio',      img: keystudio },
    { id: 'barco-rojo',   nombre: 'Barco Rojo',      img: barcoRojo },
    { id: 'barco-azul',   nombre: 'Barco Azul',      img: barcoAzul },
    { id: 'bomberman',    nombre: 'Bomberman',       img: bomberman },
    { id: 'lengua-signos',nombre: 'Lengua de Signos',img: lenguaSignos },
    { id: 'burbujas',     nombre: 'Caza Burbujas',   img: iconoBurbujas },
    { id: 'olympic',      nombre: 'Olympic',         img: iconoOlympic },
    { id: 'pasapalabra',  nombre: 'Pasapalabra',     img: iconoPasapal },
    { id: 'mathle',       nombre: 'Mathle',          img: iconoMathle },
    { id: 'wordle',       nombre: 'Wordle',          img: iconoWordle },
    { id: 'pikatron',     nombre: 'Pikatron',        img: iconoPikatron },
];

const DIFICULTADES = {
    facil:   { label: 'Sencillo',  cols: 3, rows: 2, emoji: '🟢' }, // 6 piezas
    medio:   { label: 'Medio',     cols: 4, rows: 3, emoji: '🟡' }, // 12 piezas
    dificil: { label: 'Complejo',  cols: 6, rows: 4, emoji: '🔴' }, // 24 piezas
};

// Mezcla un array (Fisher-Yates) garantizando que no quede ya resuelto
const mezclar = (n) => {
    const arr = Array.from({ length: n }, (_, i) => i);
    let intentos = 0;
    do {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        intentos++;
    } while (arr.every((v, i) => v === i) && intentos < 20);
    return arr;
};

export default function PuzzleImagenes({ onExit }) {
    const [puzzle, setPuzzle]   = useState(null);     // objeto de PUZZLES
    const [dif, setDif]         = useState(null);     // clave de DIFICULTADES
    const [order, setOrder]     = useState([]);       // order[celda] = pieza original
    const [selected, setSelected] = useState(null);   // celda seleccionada (tap)
    const [moves, setMoves]     = useState(0);
    const [solved, setSolved]   = useState(false);
    const [drag, setDrag]       = useState(null);     // { from, x, y } durante el arrastre
    const [segundos, setSegundos] = useState(0);      // tiempo transcurrido

    const boardRef = useRef(null);
    const pointerStart = useRef(null);
    const inicioRef = useRef(null);   // marca de tiempo de inicio de la partida
    const guardadoRef = useRef(false); // evita guardar el registro dos veces

    const cfg = dif ? DIFICULTADES[dif] : null;
    const N = cfg ? cfg.cols * cfg.rows : 0;

    const arrancarTiempo = () => { inicioRef.current = Date.now(); guardadoRef.current = false; setSegundos(0); };

    const iniciar = (p, d) => {
        setPuzzle(p); setDif(d);
        setOrder(mezclar(DIFICULTADES[d].cols * DIFICULTADES[d].rows));
        setSelected(null); setMoves(0); setSolved(false); setDrag(null);
        arrancarTiempo();
    };

    const mezclarDeNuevo = () => {
        setOrder(mezclar(N)); setSelected(null); setMoves(0); setSolved(false);
        arrancarTiempo();
    };

    // Cronómetro: avanza cada segundo mientras se juega
    useEffect(() => {
        if (!puzzle || !dif || solved) return;
        const t = setInterval(() => {
            if (inicioRef.current) setSegundos(Math.floor((Date.now() - inicioRef.current) / 1000));
        }, 1000);
        return () => clearInterval(t);
    }, [puzzle, dif, solved]);

    const fmtTiempo = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

    // Al completar, guarda el registro local (movimientos + tiempo)
    useEffect(() => {
        if (!solved || guardadoRef.current || !puzzle || !cfg) return;
        guardadoRef.current = true;
        const total = inicioRef.current ? Math.floor((Date.now() - inicioRef.current) / 1000) : segundos;
        setSegundos(total);
        guardarRegistroLocal('PUZZLE_IMAGENES', {
            // Movimientos y tiempo van en el título (el esquema no tiene campos propios)
            titulo: `${puzzle.nombre} · ${cfg.label} · 🔀 ${moves} mov · ⏱ ${fmtTiempo(total)}`,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [solved]);

    const volverMenu = () => { setPuzzle(null); setDif(null); setOrder([]); };

    // Intercambia las piezas de dos celdas
    const swap = useCallback((a, b) => {
        if (a === b || a == null || b == null) return;
        setOrder(prev => {
            const next = [...prev];
            [next[a], next[b]] = [next[b], next[a]];
            if (next.every((v, i) => v === i)) setSolved(true);
            return next;
        });
        setMoves(m => m + 1);
    }, []);

    // ── Detección de la celda bajo un punto de la pantalla (para soltar) ───────
    const celdaEnPunto = (x, y) => {
        const el = document.elementFromPoint(x, y);
        if (!el) return null;
        const cell = el.closest('[data-cell]');
        if (!cell || !boardRef.current?.contains(cell)) return null;
        return Number(cell.getAttribute('data-cell'));
    };

    // ── Arrastre con pointer events (funciona en ratón y táctil) ───────────────
    const onPointerDown = (e, idx) => {
        if (solved) return;
        pointerStart.current = { idx, x: e.clientX, y: e.clientY, moved: false };
    };

    useEffect(() => {
        const onMove = (e) => {
            const ps = pointerStart.current;
            if (!ps) return;
            const dx = e.clientX - ps.x, dy = e.clientY - ps.y;
            if (!ps.moved && Math.hypot(dx, dy) < 8) return; // umbral para distinguir tap de arrastre
            ps.moved = true;
            setDrag({ from: ps.idx, x: e.clientX, y: e.clientY });
        };
        const onUp = (e) => {
            const ps = pointerStart.current;
            pointerStart.current = null;
            if (!ps) return;
            if (ps.moved) {
                const target = celdaEnPunto(e.clientX, e.clientY);
                if (target != null && target !== ps.idx) swap(ps.idx, target);
                setDrag(null);
            } else {
                // Tap: seleccionar y, con el segundo tap, intercambiar
                setSelected(prev => {
                    if (prev == null) return ps.idx;
                    if (prev === ps.idx) return null;
                    swap(prev, ps.idx);
                    return null;
                });
            }
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
        };
    }, [swap, solved]);

    // Degradado de color que se reparte por todo el tablero. En imágenes con
    // transparencia, las zonas vacías muestran un tono distinto según su posición,
    // así cada pieza es identificable (en imágenes opacas queda oculto).
    const GRADIENTE = 'linear-gradient(135deg, #f6d365 0%, #fda085 25%, #84fab0 50%, #8fd3f4 75%, #d4a5ff 100%)';

    // Estilo del trozo de imagen para una pieza original concreta
    const estiloPieza = (pieza) => {
        const pc = pieza % cfg.cols;
        const pr = Math.floor(pieza / cfg.cols);
        const posX = cfg.cols > 1 ? (pc / (cfg.cols - 1)) * 100 : 0;
        const posY = cfg.rows > 1 ? (pr / (cfg.rows - 1)) * 100 : 0;
        const size = `${cfg.cols * 100}% ${cfg.rows * 100}%`;
        const pos = `${posX}% ${posY}%`;
        return {
            // La foto va encima; el degradado debajo asoma por las zonas transparentes
            backgroundImage: `url(${puzzle.img}), ${GRADIENTE}`,
            backgroundSize: `${size}, ${size}`,
            backgroundPosition: `${pos}, ${pos}`,
            backgroundRepeat: 'no-repeat, no-repeat',
        };
    };

    // ── PANTALLA 1: elegir puzzle ──────────────────────────────────────────────
    if (!puzzle) {
        return (
            <Pantalla onExit={onExit} titulo="🧩 Puzzle de Imágenes" subtitulo="Elige una imagen para montar el puzzle">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 14 }}>
                    {PUZZLES.map(p => (
                        <button key={p.id} onClick={() => setPuzzle(p)}
                            style={{ background: '#fff', border: '2px solid #e0e0e0', borderRadius: 14, padding: 8, cursor: 'pointer', boxShadow: '0 3px 10px rgba(0,0,0,0.08)', transition: 'transform .15s' }}
                            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                            <div style={{ aspectRatio: '1', background: `#f4f6f8 url(${p.img}) center/contain no-repeat`, borderRadius: 10 }} />
                            <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700, color: '#2c3e50' }}>{p.nombre}</div>
                        </button>
                    ))}
                </div>
            </Pantalla>
        );
    }

    // ── PANTALLA 2: elegir dificultad ──────────────────────────────────────────
    if (!dif) {
        return (
            <Pantalla onExit={() => setPuzzle(null)} volverLabel="← Cambiar imagen" titulo={`🧩 ${puzzle.nombre}`} subtitulo="Elige la dificultad">
                <div style={{ maxWidth: 360, margin: '0 auto 24px', borderRadius: 16, overflow: 'hidden', boxShadow: '0 6px 20px rgba(0,0,0,0.15)' }}>
                    <img src={puzzle.img} alt={puzzle.nombre} style={{ width: '100%', display: 'block', background: '#f4f6f8' }} />
                </div>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {Object.entries(DIFICULTADES).map(([k, d]) => (
                        <button key={k} onClick={() => iniciar(puzzle, k)}
                            style={{ background: '#fff', border: '3px solid #3498db', borderRadius: 16, padding: '18px 26px', cursor: 'pointer', minWidth: 130, boxShadow: '0 4px 14px rgba(52,152,219,0.2)' }}>
                            <div style={{ fontSize: 30 }}>{d.emoji}</div>
                            <div style={{ fontWeight: 800, color: '#2c3e50', fontSize: 18 }}>{d.label}</div>
                            <div style={{ color: '#7f8c8d', fontSize: 13 }}>{d.cols * d.rows} piezas · {d.cols}×{d.rows}</div>
                        </button>
                    ))}
                </div>
            </Pantalla>
        );
    }

    // ── PANTALLA 3: tablero del puzzle ─────────────────────────────────────────
    return (
        <Pantalla onExit={volverMenu} volverLabel="← Salir"
            titulo={`🧩 ${puzzle.nombre} · ${cfg.label}`}
            subtitulo={solved ? '🎉 ¡Puzzle completado!' : 'Toca dos piezas para intercambiarlas, o arrástralas'}>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                <span style={{ background: '#ecf0f1', borderRadius: 20, padding: '6px 14px', fontWeight: 700, color: '#2c3e50' }}>🔀 {moves}</span>
                <span style={{ background: '#ecf0f1', borderRadius: 20, padding: '6px 14px', fontWeight: 700, color: '#2c3e50' }}>⏱ {fmtTiempo(segundos)}</span>
                <button onClick={mezclarDeNuevo} style={botonAccion('#e67e22')}>🔀 Mezclar</button>
                <button onClick={() => setDif(null)} style={botonAccion('#7f8c8d')}>🎚️ Dificultad</button>
                {/* Miniatura de referencia */}
                <div title="Imagen objetivo" style={{ width: 54, height: 54, borderRadius: 8, border: '2px solid #bdc3c7', background: `#f4f6f8 url(${puzzle.img}) center/contain no-repeat` }} />
            </div>

            <div
                ref={boardRef}
                style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${cfg.cols}, 1fr)`,
                    gap: 'clamp(3px, 1.2vw, 7px)',
                    width: 'min(94vw, 560px)',
                    aspectRatio: `${cfg.cols} / ${cfg.rows}`,
                    margin: '0 auto',
                    touchAction: 'none',
                    background: '#dfe6e9',
                    padding: 'clamp(3px, 1.2vw, 7px)',
                    borderRadius: 12,
                }}
            >
                {order.map((pieza, celda) => {
                    const enSitio = pieza === celda;
                    const isSel = selected === celda;
                    const isDragging = drag?.from === celda;
                    return (
                        <div key={celda}
                            data-cell={celda}
                            onPointerDown={(e) => onPointerDown(e, celda)}
                            style={{
                                ...estiloPieza(pieza),
                                aspectRatio: '1',
                                borderRadius: 8,
                                cursor: solved ? 'default' : 'pointer',
                                boxShadow: isSel ? '0 0 0 4px #f1c40f, 0 4px 12px rgba(0,0,0,0.3)' : '0 2px 5px rgba(0,0,0,0.25)',
                                outline: solved && enSitio ? '2px solid #2ecc71' : 'none',
                                opacity: isDragging ? 0.3 : 1,
                                transform: isSel ? 'scale(1.04)' : 'none',
                                transition: 'transform .1s, box-shadow .1s',
                                userSelect: 'none',
                            }}
                        />
                    );
                })}
            </div>

            {/* Pieza flotante mientras se arrastra */}
            {drag && (
                <div style={{
                    position: 'fixed', left: drag.x, top: drag.y, transform: 'translate(-50%, -50%)',
                    width: `min(${94 / cfg.cols}vw, ${560 / cfg.cols}px)`, aspectRatio: '1',
                    ...estiloPieza(order[drag.from]),
                    borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', pointerEvents: 'none', zIndex: 10001, opacity: 0.95,
                }} />
            )}

            {solved && (
                <div style={{ textAlign: 'center', marginTop: 20 }}>
                    <div style={{ fontSize: 40 }}>🎉🏆🎉</div>
                    <p style={{ color: '#27ae60', fontWeight: 800, fontSize: 20, margin: '6px 0 14px' }}>¡Completado en {moves} movimientos y {fmtTiempo(segundos)}!</p>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button onClick={mezclarDeNuevo} style={botonAccion('#27ae60')}>🔁 Jugar otra vez</button>
                        <button onClick={volverMenu} style={botonAccion('#3498db')}>🧩 Otro puzzle</button>
                    </div>
                </div>
            )}
        </Pantalla>
    );
}

// ── Layout común (fondo + cabecera + botón salir) ──────────────────────────────
function Pantalla({ children, onExit, volverLabel = '← Volver', titulo, subtitulo }) {
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, overflowY: 'auto', background: 'linear-gradient(135deg, #74b9ff, #a29bfe)', fontFamily: "'Segoe UI', Tahoma, sans-serif" }}>
            <button onClick={onExit} style={{ position: 'fixed', top: 12, left: 12, zIndex: 10000, background: 'rgba(255,255,255,0.92)', color: '#2c3e50', border: 'none', borderRadius: 10, padding: '8px 16px', cursor: 'pointer', fontWeight: 700, fontSize: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>{volverLabel}</button>
            <div style={{ maxWidth: 760, margin: '0 auto', padding: '60px 16px 40px' }}>
                <h1 style={{ textAlign: 'center', color: '#fff', textShadow: '0 2px 6px rgba(0,0,0,0.3)', margin: '0 0 4px', fontSize: 'clamp(1.4rem, 5vw, 2.2rem)' }}>{titulo}</h1>
                {subtitulo && <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.95)', margin: '0 0 24px', fontSize: 'clamp(0.9rem, 3vw, 1.05rem)' }}>{subtitulo}</p>}
                {children}
            </div>
        </div>
    );
}

const botonAccion = (bg) => ({ background: bg, color: '#fff', border: 'none', borderRadius: 10, padding: '9px 16px', cursor: 'pointer', fontWeight: 700, fontSize: 14, boxShadow: '0 3px 8px rgba(0,0,0,0.2)' });
