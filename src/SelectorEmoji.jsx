import React, { useState, useRef, useEffect } from 'react';

/**
 * Selector de emojis con catálogo y buscador en español.
 *
 * No usa el teclado del sistema: el catálogo está pensado para materias de
 * clase, así que lo que se busca ("hueso", "volcán", "romano") aparece rápido.
 */

export const CATALOGO_EMOJI = [
    {
        id: 'CUERPO', nombre: 'Cuerpo y salud', items: [
            ['🦴', 'hueso esqueleto huesos'], ['💀', 'craneo calavera esqueleto'], ['🫀', 'corazon organo'],
            ['🫁', 'pulmones respiracion organo'], ['🧠', 'cerebro nervioso'], ['🦷', 'diente dentadura'],
            ['👁️', 'ojo vista'], ['👂', 'oreja oido'], ['👃', 'nariz olfato'], ['👅', 'lengua gusto'],
            ['💪', 'musculo biceps musculatura'], ['🦵', 'pierna'], ['🦶', 'pie'], ['🖐️', 'mano dedos'],
            ['🩸', 'sangre'], ['🧬', 'adn genetica gen'], ['🦠', 'microbio virus bacteria celula'],
            ['🩺', 'medico salud estetoscopio'], ['💊', 'medicina pastilla'], ['🧑‍⚕️', 'medico enfermera sanitario'],
        ],
    },
    {
        id: 'NATURALEZA', nombre: 'Naturaleza y animales', items: [
            ['🌱', 'planta brote germinar'], ['🌳', 'arbol'], ['🌸', 'flor'], ['🍃', 'hoja hojas'],
            ['🌵', 'cactus desierto'], ['🍄', 'seta hongo'], ['🐝', 'abeja insecto'], ['🦋', 'mariposa insecto'],
            ['🐜', 'hormiga insecto'], ['🐟', 'pez peces'], ['🐢', 'tortuga reptil'], ['🐍', 'serpiente reptil'],
            ['🦎', 'lagarto reptil'], ['🐸', 'rana anfibio'], ['🦅', 'aguila ave pajaro'], ['🐺', 'lobo mamifero'],
            ['🐘', 'elefante mamifero'], ['🦒', 'jirafa'], ['🐬', 'delfin'], ['🦈', 'tiburon'],
            ['🦕', 'dinosaurio fosil'], ['🦖', 'dinosaurio trex fosil'], ['🐾', 'huellas animal'],
        ],
    },
    {
        id: 'CIENCIA', nombre: 'Ciencia', items: [
            ['🔬', 'microscopio laboratorio'], ['🔭', 'telescopio astronomia'], ['⚗️', 'quimica alambique'],
            ['🧪', 'probeta quimica laboratorio'], ['🧫', 'placa petri cultivo'], ['⚛️', 'atomo fisica nuclear'],
            ['🧲', 'iman magnetismo'], ['🔋', 'pila bateria electricidad'], ['💡', 'bombilla luz idea'],
            ['🌡️', 'termometro temperatura'], ['⚖️', 'balanza equilibrio peso'], ['🧊', 'hielo cubo solido'],
            ['🔥', 'fuego calor'], ['💧', 'agua gota'], ['💨', 'aire viento gas'],
        ],
    },
    {
        id: 'ESPACIO', nombre: 'Espacio y geografía', items: [
            ['🪐', 'planeta saturno'], ['🌍', 'tierra mundo mapa'], ['🌕', 'luna'], ['☀️', 'sol'],
            ['⭐', 'estrella'], ['🌠', 'cometa estrella fugaz'], ['🚀', 'cohete espacio'], ['🛰️', 'satelite'],
            ['🌋', 'volcan'], ['🏔️', 'montaña cordillera'], ['🏝️', 'isla'], ['🏜️', 'desierto'],
            ['🌊', 'mar ola oceano'], ['🗺️', 'mapa'], ['🧭', 'brujula orientacion'],
        ],
    },
    {
        id: 'HISTORIA', nombre: 'Historia y arte', items: [
            ['🏛️', 'templo griego romano columnas museo'], ['🗿', 'estatua moai escultura'],
            ['⚱️', 'anfora vasija urna'], ['🏺', 'vasija ceramica griega'], ['🗡️', 'espada arma'],
            ['🛡️', 'escudo'], ['🏰', 'castillo medieval'], ['👑', 'corona rey reina'],
            ['⛪', 'iglesia'], ['🕌', 'mezquita'], ['🗽', 'estatua libertad monumento'],
            ['🎭', 'teatro mascara'], ['🖼️', 'cuadro pintura arte'], ['🎨', 'pintura paleta arte'],
            ['🪕', 'instrumento musica'], ['📜', 'pergamino documento'],
        ],
    },
    {
        id: 'TECNO', nombre: 'Tecnología', items: [
            ['🤖', 'robot robotica'], ['⚙️', 'engranaje mecanica maquina'], ['🔧', 'herramienta llave'],
            ['🔩', 'tornillo tuerca'], ['🖥️', 'ordenador pantalla'], ['💻', 'portatil ordenador'],
            ['📱', 'movil telefono'], ['🎮', 'videojuego mando'], ['🕹️', 'joystick arcade'],
            ['🔌', 'enchufe corriente'], ['📡', 'antena señal'], ['🛠️', 'herramientas taller'],
            ['🚗', 'coche vehiculo'], ['✈️', 'avion'], ['🚂', 'tren'], ['⛵', 'barco vela'],
        ],
    },
    {
        id: 'ESCUELA', nombre: 'Escuela', items: [
            ['📐', 'geometria escuadra regla'], ['📏', 'regla medir'], ['📚', 'libros biblioteca'],
            ['✏️', 'lapiz escribir'], ['🧮', 'abaco calculo matematicas'], ['🔢', 'numeros'],
            ['🔤', 'letras abecedario'], ['🗣️', 'hablar idiomas'], ['🎓', 'graduacion estudiante'],
            ['🏫', 'colegio escuela'], ['📝', 'examen apuntes'], ['🧩', 'puzzle pieza'],
            ['🏆', 'trofeo premio'], ['🎯', 'diana objetivo reto'], ['⏱️', 'cronometro tiempo'],
        ],
    },
    {
        id: 'OBJETOS', nombre: 'Objetos y símbolos', items: [
            ['🧊', 'cubo modelo 3d'], ['📦', 'caja paquete'], ['🔑', 'llave'], ['🧱', 'ladrillo muro'],
            ['🪑', 'silla mueble'], ['🚪', 'puerta'], ['🪟', 'ventana'], ['💎', 'diamante mineral joya'],
            ['🪨', 'roca piedra mineral'], ['⛏️', 'pico mineria'], ['🧰', 'caja herramientas'],
            ['❤️', 'corazon rojo'], ['⭕', 'circulo'], ['🔺', 'triangulo'], ['🟦', 'cuadrado azul'],
        ],
    },
];

export default function SelectorEmoji({ valor, onCambio, titulo = 'Icono' }) {
    const [abierto, setAbierto] = useState(false);
    const [busqueda, setBusqueda] = useState('');
    const [categoria, setCategoria] = useState(CATALOGO_EMOJI[0].id);
    const cajaRef = useRef(null);

    // Cerrar al pinchar fuera.
    useEffect(() => {
        if (!abierto) return;
        const fuera = (e) => { if (cajaRef.current && !cajaRef.current.contains(e.target)) setAbierto(false); };
        document.addEventListener('pointerdown', fuera);
        return () => document.removeEventListener('pointerdown', fuera);
    }, [abierto]);

    const q = busqueda.trim().toLowerCase();
    // Un mismo emoji puede estar en dos categorías (🧊 es "hielo" y "modelo 3d"),
    // así que al buscar hay que quedarse con una sola aparición.
    const mostrados = q
        ? [...new Map(
            CATALOGO_EMOJI.flatMap(c => c.items)
                .filter(([, claves]) => claves.includes(q) || claves.split(' ').some(k => k.startsWith(q)))
                .map(par => [par[0], par])
          ).values()]
        : (CATALOGO_EMOJI.find(c => c.id === categoria)?.items || []);

    return (
        <div ref={cajaRef} style={{ position: 'relative' }}>
            <button type="button" onClick={() => setAbierto(a => !a)} title={titulo}
                style={{ width: '100%', padding: '7px 11px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(255,255,255,0.07)', color: '#fff', fontSize: '1.3rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxSizing: 'border-box' }}>
                <span>{valor || '🧊'}</span>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>▾</span>
            </button>

            {abierto && (
                <div style={{ position: 'absolute', zIndex: 10010, top: 'calc(100% + 6px)', left: 0, width: 288,
                    background: '#1e293b', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 14, padding: 10,
                    boxShadow: '0 12px 32px rgba(0,0,0,0.45)' }}>
                    <input autoFocus value={busqueda} onChange={e => setBusqueda(e.target.value)}
                        placeholder="Buscar: hueso, volcán, romano…"
                        style={{ width: '100%', padding: '7px 10px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.15)',
                            background: 'rgba(255,255,255,0.07)', color: '#fff', fontSize: '0.82rem', boxSizing: 'border-box', marginBottom: 8 }} />

                    {!q && (
                        <div style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 8, paddingBottom: 3 }}>
                            {CATALOGO_EMOJI.map(c => (
                                <button key={c.id} type="button" onClick={() => setCategoria(c.id)} title={c.nombre}
                                    style={{ padding: '4px 9px', borderRadius: 999, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                                        fontSize: '0.68rem', fontWeight: 700,
                                        background: categoria === c.id ? '#2dd4bf' : 'rgba(255,255,255,0.08)',
                                        color: categoria === c.id ? '#0f172a' : '#94a3b8' }}>
                                    {c.items[0][0]} {c.nombre.split(' ')[0]}
                                </button>
                            ))}
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 2, maxHeight: 190, overflowY: 'auto' }}>
                        {mostrados.map(([e, claves]) => (
                            <button key={e} type="button" title={claves.split(' ')[0]}
                                onClick={() => { onCambio(e); setAbierto(false); setBusqueda(''); }}
                                style={{ padding: '5px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: '1.2rem',
                                    background: valor === e ? 'rgba(45,212,191,0.25)' : 'transparent' }}>
                                {e}
                            </button>
                        ))}
                    </div>

                    {mostrados.length === 0 && (
                        <div style={{ color: '#64748b', fontSize: '0.76rem', padding: '10px 4px' }}>
                            Nada con «{busqueda}». Prueba con otra palabra.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
