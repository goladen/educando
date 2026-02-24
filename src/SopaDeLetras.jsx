import React, { useState, useEffect, useRef } from 'react';

// --- PALABRAS MATEMÁTICAS DE PRUEBA ---
const PALABRAS_PRUEBA = [
    'SUMA', 'RESTA', 'DIVISION', 'FRACCION', 'DECIMAL',
    'ECUACION', 'GEOMETRIA', 'ALGEBRA', 'PORCENTAJE', 'ANGULO'
];

// --- DIRECCIONES POSIBLES (x, y) ---
const DIRECCIONES = [
    [1, 0], [-1, 0], [0, 1], [0, -1], // Horizontal y Vertical
    [1, 1], [-1, -1], [1, -1], [-1, 1]  // Diagonales
];

const COLORES = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22', '#1abc9c', '#e84393'];

export default function SopaDeLetras({
    palabras = PALABRAS_PRUEBA,
    mostrarLista = true,
    onTerminar = () => alert('¡Sopa completada!')
}) {
    const [grid, setGrid] = useState([]);
    const [palabrasActivas, setPalabrasActivas] = useState([]);
    const [palabrasEncontradas, setPalabrasEncontradas] = useState([]);
    const [trazosEncontrados, setTrazosEncontrados] = useState([]); // Guarda las celdas de las palabras acertadas
    const [seleccion, setSeleccion] = useState([]); // Celdas siendo arrastradas actualmente
    const [isDragging, setIsDragging] = useState(false);


    const [mostrarSolucion, setMostrarSolucion] = useState(false);
    const [solucionesCeldas, setSolucionesCeldas] = useState([]);

    const startCell = useRef(null);
    const gridRef = useRef(null);

    // --- 1. GENERADOR DE LA SOPA ---
    useEffect(() => {
        // 1. Mapeamos las palabras para no perder la original al limpiarla y ordenarlas
        const palabrasMapeadas = palabras.map(p => ({
            original: p,
            limpia: p.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
        })).sort((a, b) => b.limpia.length - a.limpia.length);

        const maxLength = palabrasMapeadas.length > 0 ? palabrasMapeadas[0].limpia.length : 0;
        const size = Math.max(10, maxLength +2);

        let tablero = Array(size).fill(null).map(() => Array(size).fill(''));
        let colocadasExitosamente = []; // <--- Lista de las que SÍ entran
        let nuevasSoluciones = [];
        const intentarColocar = (item) => {
            let colocada = false;
            let intentos = 0;
            while (!colocada && intentos < 2000) {
                intentos++;
                const dir = DIRECCIONES[Math.floor(Math.random() * DIRECCIONES.length)];
                const filaInicio = Math.floor(Math.random() * size);
                const colInicio = Math.floor(Math.random() * size);

                let cabe = true;
                for (let i = 0; i < item.limpia.length; i++) {
                    const f = filaInicio + (dir[0] * i);
                    const c = colInicio + (dir[1] * i);
                    if (f < 0 || f >= size || c < 0 || c >= size || (tablero[f][c] !== '' && tablero[f][c] !== item.limpia[i])) {
                        cabe = false;
                        break;
                    }
                }

                if (cabe) {
                    let celdasDePalabra = []; // <--- NUEVO
                    for (let i = 0; i < item.limpia.length; i++) {
                        const f = filaInicio + (dir[0] * i);
                        const c = colInicio + (dir[1] * i);
                        tablero[f][c] = item.limpia[i];
                        celdasDePalabra.push({ f, c }); // <--- NUEVO: Guardamos cada letra
                    }
                    colocada = true;
                    colocadasExitosamente.push(item.original);
                    // <--- NUEVO: Guardamos la palabra y sus celdas
                    nuevasSoluciones.push({ palabra: item.limpia, celdas: celdasDePalabra });
                }
            }
            if (!colocada) console.warn("Se quedó fuera por falta de espacio: ", item.original);
        };

        palabrasMapeadas.forEach(intentarColocar);

        // Rellenar huecos con letras aleatorias
        const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        for (let f = 0; f < size; f++) {
            for (let c = 0; c < size; c++) {
                if (tablero[f][c] === '') tablero[f][c] = letras[Math.floor(Math.random() * letras.length)];
            }
        }

        setGrid(tablero);
        setPalabrasActivas(colocadasExitosamente); // <--- Guardamos la lista definitiva en el estado
        setSolucionesCeldas(nuevasSoluciones);
    }, [palabras]);

    // --- NUEVO: Bloquear el scroll en móviles de forma segura ---
    useEffect(() => {
        const gridElement = gridRef.current;
        if (!gridElement) return;

        // Esta función bloquea el scroll nativo
        const preventScroll = (e) => e.preventDefault();

        // Le decimos al navegador que NO sea pasivo ({ passive: false })
        gridElement.addEventListener('touchmove', preventScroll, { passive: false });

        return () => gridElement.removeEventListener('touchmove', preventScroll);
    }, []);

    // --- 2. LÓGICA DE SELECCIÓN ---
    const getCeldasLinea = (f1, c1, f2, c2) => {
        const df = f2 - f1;
        const dc = c2 - c1;
        // Obligar a que sea línea recta o diagonal perfecta
        if (df !== 0 && dc !== 0 && Math.abs(df) !== Math.abs(dc)) return [];

        const pasos = Math.max(Math.abs(df), Math.abs(dc));
        const stepF = df === 0 ? 0 : df / pasos;
        const stepC = dc === 0 ? 0 : dc / pasos;

        let linea = [];
        for (let i = 0; i <= pasos; i++) {
            linea.push({ f: f1 + (stepF * i), c: c1 + (stepC * i) });
        }
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
        const nuevaLinea = getCeldasLinea(startCell.current.f, startCell.current.c, f, c);
        if (nuevaLinea.length > 0) setSeleccion(nuevaLinea);
    };

    const finalizarTrazo = () => {
        if (!isDragging) return;
        setIsDragging(false);

        if (seleccion.length > 1) {
            // Extraer la palabra formada
            const palabraSeleccionada = seleccion.map(celda => grid[celda.f][celda.c]).join('');
            const palabraInvertida = palabraSeleccionada.split('').reverse().join('');
            
            const palabrasLimpias = palabrasActivas.map(p => p.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase());
            const coincidencia = palabrasLimpias.find(p => p === palabraSeleccionada || p === palabraInvertida);

            if (coincidencia && !palabrasEncontradas.includes(coincidencia)) {
                // ¡ACIERTO!
                setPalabrasEncontradas([...palabrasEncontradas, coincidencia]);
                const color = COLORES[palabrasEncontradas.length % COLORES.length];
                setTrazosEncontrados([...trazosEncontrados, ...seleccion.map(s => ({ ...s, color }))]);

                // Comprobar victoria
                if (palabrasEncontradas.length + 1 === palabras.length) {
                    setTimeout(onTerminar, 500);
                }
            } else {
                // FALLO (Aquí meteremos la lógica de restar puntos después)
                // Reproducir sonido error, etc.
            }
        }
        setSeleccion([]);
        startCell.current = null;
    };

    // --- 3. LÓGICA TÁCTIL (MÓVILES) ---
    const handleTouchMove = (e) => {
        if (!isDragging || mostrarSolucion) return;
        // Prevenir scroll
       

        const touch = e.touches[0];
        const elemento = document.elementFromPoint(touch.clientX, touch.clientY);
        if (elemento && elemento.dataset.f && elemento.dataset.c) {
            moverTrazo(parseInt(elemento.dataset.f), parseInt(elemento.dataset.c));
        }
    };

    // --- RENDERIZADO ---
    const isCeldaSeleccionada = (f, c) => seleccion.some(s => s.f === f && s.c === c);
    const getTrazoEncontrado = (f, c) => trazosEncontrados.find(s => s.f === f && s.c === c);
    // --- NUEVO: Función para dar un color distinto a cada palabra no encontrada ---
    const getColorSolucion = (f, c) => {
        if (!mostrarSolucion) return null;

        // Buscamos a qué palabra pertenece esta celda
        const solucion = solucionesCeldas.find(sol =>
            !palabrasEncontradas.includes(sol.palabra) &&
            sol.celdas.some(celda => celda.f === f && celda.c === c)
        );

        if (solucion) {
            // Usamos la posición de la palabra para elegir uno de tus colores predefinidos
            const index = solucionesCeldas.indexOf(solucion);
            return COLORES[index % COLORES.length];
        }
        return null;
    };



    if (grid.length === 0) return <div>Generando sopa de letras...</div>;

    return (
        <div style={styles.container}>
            <h2 style={styles.title}>🔍 Encuentra las palabras</h2>

          
            {/* LISTA DE PALABRAS (Depende de la dificultad) */}
            {mostrarLista && (
                <div style={styles.wordList}>
                    {/* CORRECCIÓN: Mapeamos palabrasActivas */}
                    {palabrasActivas.map((p, i) => {
                        const limpia = p.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
                        const encontrada = palabrasEncontradas.includes(limpia);
                        return (
                            <span key={i} style={{
                                ...styles.wordBadge,
                                background: encontrada ? '#2ecc71' : 'rgba(255,255,255,0.2)',
                                textDecoration: encontrada ? 'line-through' : 'none',
                                opacity: encontrada ? 0.6 : 1
                            }}>
                                {p}
                            </span>
                        );
                    })}
                </div>
            )}

            {/* TABLERO */}
            <div
                ref={gridRef}
                style={{
                    ...styles.grid,
                    gridTemplateColumns: `repeat(${grid.length}, 1fr)`,
                }}
                onMouseLeave={finalizarTrazo}
                onMouseUp={finalizarTrazo}
                onTouchEnd={finalizarTrazo}
                onTouchMove={handleTouchMove} // Magia táctil
            >
                {grid.map((fila, f) =>
                    fila.map((letra, c) => {
                        const seleccionada = isCeldaSeleccionada(f, c);
                        const encontrada = getTrazoEncontrado(f, c);
                        const colorSolucion = getColorSolucion(f, c);

                        let bg = 'white';
                        let color = '#2c3e50';
                        if (seleccionada) { bg = '#3498db'; color = 'white'; }
                        else if (encontrada) { bg = encontrada.color; color = 'white'; }
                        else if (colorSolucion) { bg = colorSolucion; color = 'white'; } // <--- ACTUALIZADO
                        return (
                            <div
                                key={`${f}-${c}`}
                                data-f={f} data-c={c}
                                onMouseDown={() => iniciarTrazo(f, c)}
                                onMouseEnter={() => moverTrazo(f, c)}
                                onTouchStart={() => iniciarTrazo(f, c)}
                                style={{
                                    ...styles.cell,
                                    background: bg,
                                    color: color,
                                    transform: seleccionada ? 'scale(1.1)' : 'scale(1)'
                                }}
                            >
                                {letra}
                            </div>
                        );
                    })
                )}
            </div>

            <button
                onClick={() => setMostrarSolucion(true)}
                disabled={mostrarSolucion}
                style={{
                    marginTop: '20px',
                    padding: '12px 24px',
                    background: mostrarSolucion ? '#7f8c8d' : '#e74c3c',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: 'bold',
                    cursor: mostrarSolucion ? 'not-allowed' : 'pointer',
                    fontSize: '1rem',
                    boxShadow: mostrarSolucion ? 'none' : '0 4px 6px rgba(0,0,0,0.2)',
                    transition: 'all 0.2s'
                }}
            >
                {mostrarSolucion ? 'Juego Terminado' : '👀 Rendirse y Ver Solución'}
            </button>


            <style>{` body { touch-action: none; /* Crucial para que el móvil no haga scroll al jugar */ } `}</style>
        </div>
    );
}

const styles = {
    container: {
        display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#2c3e50', padding: '20px',
        paddingBottom: '40px',
        marginBottom: '30px',

        borderRadius: '20px', color: 'white', fontFamily: 'Roboto, sans-serif', maxWidth: '100%', overflow: 'hidden'
    },
    title: { color: '#f1c40f', margin: '0 0 20px 0' },
    wordList: { display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', marginBottom: '20px', width: '100%', maxWidth: '600px' },
    wordBadge: { padding: '8px 15px', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.9rem', transition: 'all 0.3s' },

    // CORRECCIÓN MÓVIL: Reducimos gap y ajustamos anchos
    grid: {
        display: 'grid', gap: '2px', background: '#bdc3c7', padding: '3px',
        borderRadius: '8px', touchAction: 'none', userSelect: 'none',
        maxWidth: '500px', width: '100%', aspectRatio: '1/1'
    },


    // CORRECCIÓN MÓVIL: La fuente usa clamp para adaptarse mágicamente al tamaño de la celda
    cell: {
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        fontWeight: 'bold', fontSize: 'clamp(0.7rem, 4vw, 1.2rem)',
        borderRadius: '3px', cursor: 'pointer', transition: 'all 0.1s',
        userSelect: 'none', aspectRatio: '1/1'
    }
};