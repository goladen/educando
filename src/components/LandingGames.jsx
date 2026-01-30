import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { Play, Lock, Users, Gamepad2 } from 'lucide-react';
import PasapalabraGuest from '../PasapalabraGuest';
import CazaBurbujasGuest from '../CazaBurbujasGuest';

export default function LandingGames({ onLoginRequest }) {
    const [listaJuegos, setListaJuegos] = useState([]);
    const [juegoActivo, setJuegoActivo] = useState(null);
    const [recursoElegido, setRecursoElegido] = useState(null);

    useEffect(() => {
        const cargarJuegos = async () => {
            const ref = collection(db, "resources");

            // Función auxiliar para buscar el MEJOR recurso de un tipo
            const obtenerMejorRecurso = async (tipo) => {
                try {
                    const q = query(
                        ref,
                        where("tipoJuego", "==", tipo),
                        where("isPrivate", "==", false),
                        orderBy("playCount", "desc"), // El más jugado primero
                        limit(1)
                    );
                    const snap = await getDocs(q);

                    if (!snap.empty) {
                        const data = snap.docs[0].data();
                        return { ...data, id: snap.docs[0].id, existe: true };
                    }
                } catch (e) {
                    console.error(`Error buscando ${tipo}`, e);
                }
                // Si no hay recurso público, devolvemos un objeto "Placeholder"
                // IMPORTANTE: 'existe: false' hará que salga bloqueado
                return {
                    id: `bloqueado-${tipo}`,
                    titulo: getNombreJuego(tipo),
                    tipoJuego: tipo,
                    existe: false,
                    profesorNombre: 'LearnJoy'
                };
            };

            // Ejecutamos las consultas en PARALELO para que sea rápido
            // EL ORDEN AQUÍ DEFINE EL ORDEN EN PANTALLA
            const [pasa, caza, think, ruleta, apare, sender] = await Promise.all([
                obtenerMejorRecurso('PASAPALABRA'),
                obtenerMejorRecurso('CAZABURBUJAS'),
                obtenerMejorRecurso('THINKHOOT'),
                obtenerMejorRecurso('RULETA'),
                obtenerMejorRecurso('APAREJADOS'),
                obtenerMejorRecurso('QUESTION_SENDER')
            ]);

            setListaJuegos([pasa, caza, think, ruleta, apare, sender]);
        };

        cargarJuegos();
    }, []);

    const jugar = (r) => {
        // 1. Verificamos si es uno de los juegos permitidos para invitados
        const esTipoPermitido = r.tipoJuego === 'PASAPALABRA' || r.tipoJuego === 'CAZABURBUJAS';

        if (esTipoPermitido) {
            if (r.existe) {
                // Si hay recurso y es permitido -> JUGAR
                setRecursoElegido(r);
                setJuegoActivo(r.tipoJuego);
            } else {
                // Es permitido pero no hay recurso creado -> AVISO
                alert("Aún no hay recursos públicos creados para este juego. ¡Regístrate y crea el primero!");
            }
        } else {
            // No es permitido -> AVISO DE REGISTRO
            alert(`🔒 ${getNombreJuego(r.tipoJuego)} solo está disponible para usuarios registrados. ¡Únete a la comunidad!`);
        }
    };

    // Renderizado del juego activo (Modo Invitado)
    if (juegoActivo === 'PASAPALABRA') return <PasapalabraGuest recurso={recursoElegido} onBack={() => setJuegoActivo(null)} onLoginRequest={onLoginRequest} />;
    if (juegoActivo === 'CAZABURBUJAS') return <CazaBurbujasGuest recurso={recursoElegido} onBack={() => setJuegoActivo(null)} onLoginRequest={onLoginRequest} />;

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h2 style={{ color: 'white', marginBottom: '5px', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>🎮 Prueba nuestros juegos</h2>
                <p style={{ color: '#ddd', fontSize: '0.9rem' }}>Sin registros. Juega y aprende.</p>
            </div>

            <div style={styles.scrollContainer}>
                {listaJuegos.map((r, index) => {
                    // LÓGICA DE VISUALIZACIÓN
                    // Es jugable si es Pasa o Caza Y ADEMÁS existe el recurso
                    const esTipoAbierto = r.tipoJuego === 'PASAPALABRA' || r.tipoJuego === 'CAZABURBUJAS';
                    const estaDisponible = esTipoAbierto && r.existe;

                    return (
                        <div key={r.id || index} onClick={() => jugar(r)} style={styles.card}>
                            {/* Icono del juego */}
                            <div style={{ ...styles.iconBox, background: getColor(r.tipoJuego) }}>
                                {getIcono(r.tipoJuego)}
                            </div>

                            {/* Textos */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <h4 style={styles.cardTitle}>{r.titulo}</h4>
                                <div style={styles.cardMeta}>
                                    <span style={{ color: estaDisponible ? '#aeea00' : '#bbb', fontWeight: 'bold' }}>
                                        {getNombreJuego(r.tipoJuego)}
                                    </span>
                                    {r.existe && r.playCount > 0 && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                            <Users size={10} /> {r.playCount}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Botón de Acción (Play o Candado) */}
                            <div style={styles.actionIcon}>
                                {estaDisponible ? <Play size={24} fill="white" /> : <Lock size={20} color="#ccc" />}
                            </div>

                            {/* Etiqueta solo para los bloqueados (o no disponibles) */}
                            {!estaDisponible && <div style={styles.lockedOverlay}>Solo Miembros</div>}
                        </div>
                    );
                })}
            </div>

            {/* Efecto de desvanecimiento abajo */}
            <div style={styles.fadeBottom}></div>
        </div>
    );
}

// --- UTILIDADES ---
const getColor = (t) => {
    if (t === 'PASAPALABRA') return '#3F51B5';
    if (t === 'CAZABURBUJAS') return '#E91E63';
    if (t === 'THINKHOOT') return '#9C27B0';
    if (t === 'RULETA') return '#f1c40f';
    if (t === 'APAREJADOS') return '#FF9800';
    return '#2c3e50';
};

const getIcono = (t) => {
    if (t === 'PASAPALABRA') return '🅰️';
    if (t === 'CAZABURBUJAS') return '🫧';
    if (t === 'THINKHOOT') return '🦉';
    if (t === 'RULETA') return '🎡';
    if (t === 'APAREJADOS') return '🃏';
    return '🎮';
};

const getNombreJuego = (t) => {
    if (t === 'PASAPALABRA') return 'Pasapalabra';
    if (t === 'CAZABURBUJAS') return 'CazaBurbujas';
    if (t === 'THINKHOOT') return 'ThinkHoot';
    if (t === 'RULETA') return 'La Ruleta';
    if (t === 'APAREJADOS') return 'Aparejados';
    if (t === 'QUESTION_SENDER') return 'Question Sender';
    return t;
}

const styles = {
    container: { marginTop: '30px', width: '100%', maxWidth: '500px', position: 'relative' },
    header: { textAlign: 'center', marginBottom: '20px' },
    scrollContainer: {
        maxHeight: '350px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        paddingRight: '5px',
        paddingBottom: '20px'
    },
    card: {
        background: 'rgba(255,255,255,0.15)',
        borderRadius: '16px',
        padding: '12px 15px',
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        cursor: 'pointer',
        transition: 'transform 0.2s, background 0.2s',
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.1)'
    },
    iconBox: {
        width: '45px', height: '45px', borderRadius: '12px',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        fontSize: '1.5rem',
        boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
    },
    cardTitle: { margin: 0, color: 'white', fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    cardMeta: { display: 'flex', justifyContent: 'space-between', color: '#bbb', fontSize: '0.8rem', marginTop: '4px' },
    actionIcon: { color: 'white', opacity: 0.9 },
    lockedOverlay: {
        position: 'absolute', top: 0, right: 0,
        background: '#333', color: '#aaa',
        fontSize: '0.6rem', fontWeight: 'bold',
        padding: '3px 8px', borderBottomLeftRadius: '8px'
    },
    fadeBottom: {
        position: 'absolute', bottom: 0, left: 0, width: '100%', height: '40px',
        background: 'linear-gradient(to top, #764ba2 0%, transparent 100%)', // Ajustado al color de tu login
        pointerEvents: 'none',
        borderBottomLeftRadius: '24px',
        borderBottomRightRadius: '24px'
    }
};