import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { Search, MapPin, User, Globe, Play, Share2, Users, Gamepad2, Key } from 'lucide-react';
import GamePlayer from '../GamePlayer';
import ThinkHootGame from '../ThinkHootGame';
import RuletaGame from '../RuletaGame';

// --- ESTILOS ---
const styles = {
    container: { width: '100%', marginTop: '30px', paddingBottom: '50px' },
    sectionTitle: { color: 'white', fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '20px', textAlign: 'center', textShadow: '0 2px 4px rgba(0,0,0,0.3)' },

    card: { background: 'rgba(255, 255, 255, 0.95)', padding: '25px', borderRadius: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', marginBottom: '30px', width: '100%', boxSizing: 'border-box' },

    tabContainer: { display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'center' },
    tabButton: (active) => ({ padding: '10px 25px', borderRadius: '20px', border: 'none', background: active ? '#f1c40f' : '#eee', color: active ? '#333' : '#777', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s', display: 'flex', alignItems: 'center', gap: '5px' }),

    inputGroup: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '15px' },
    input: { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '0.9rem', boxSizing: 'border-box' },
    searchButton: { width: '100%', padding: '12px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem', marginTop: '10px' },

    liveSection: { background: 'linear-gradient(135deg, #8e44ad, #9b59b6)', padding: '20px', borderRadius: '20px', color: 'white', textAlign: 'center', marginBottom: '30px', boxShadow: '0 10px 20px rgba(142, 68, 173, 0.4)' },

    // GRID PARA TOP GAMES
    gridList: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '15px'
    },

    // LISTA VERTICAL (Para Resultados de Búsqueda)
    verticalList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
        width: '100%'
    },

    resourceCard: (color) => ({ background: 'white', padding: '15px', borderRadius: '12px', cursor: 'pointer', borderLeft: `6px solid ${color}`, position: 'relative', transition: 'transform 0.2s', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }),

    codeBadge: { background: '#f8f9fa', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #dee2e6', color: '#333', display: 'inline-flex', alignItems: 'center', gap: '5px' }
};

const getColor = (t) => {
    if (!t) return '#999';
    const map = { PASAPALABRA: '#3F51B5', THINKHOOT: '#9C27B0', APAREJADOS: '#FF9800', CAZABURBUJAS: '#E91E63', RULETA: '#f1c40f' };
    return map[t.toUpperCase()] || '#555';
};

const cleanText = (text) => text ? text.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : "";

export default function LandingGames({ onLoginRequest }) {
    // ESTADOS
    const [modoBusqueda, setModoBusqueda] = useState('FILTROS');
    const [filtros, setFiltros] = useState({ profesor: '', pais: '', region: '', tema: '' });
    const [codigo, setCodigo] = useState('');
    const [resultados, setResultados] = useState([]);
    const [buscando, setBuscando] = useState(false);

    const [juegoActivo, setJuegoActivo] = useState(null);
    const [joinLiveCode, setJoinLiveCode] = useState('');
    const [joinLiveName, setJoinLiveName] = useState('');
    const [liveMode, setLiveMode] = useState(false);

    const [topGames, setTopGames] = useState([]);

    // --- CARGAR TOP 4 (Uno de cada tipo, SOLO TERMINADOS) ---
    useEffect(() => {
        const loadTopGames = async () => {
            try {
                const types = ['PASAPALABRA', 'CAZABURBUJAS', 'APAREJADOS', 'RULETA'];
                const topList = [];

                for (const type of types) {
                    // Pedimos los 10 más populares de ese tipo
                    const q = query(
                        collection(db, 'resources'),
                        where('tipoJuego', '==', type),
                        orderBy('playCount', 'desc'),
                        limit(10)
                    );

                    const snap = await getDocs(q);

                    // Buscamos el primero que esté REALMENTE terminado
                    const primerTerminado = snap.docs.find(doc => {
                        const d = doc.data();
                        return d.isFinished === true || d.config?.isFinished === true;
                    });

                    if (primerTerminado) {
                        topList.push({ id: primerTerminado.id, ...primerTerminado.data() });
                    }
                }
                setTopGames(topList);
            } catch (e) { console.warn("Error cargando top games:", e); }
        };
        loadTopGames();
    }, []);

    // --- LÓGICA DE BÚSQUEDA ---
    const buscar = async () => {
        setBuscando(true); setResultados([]);
        const ref = collection(db, 'resources');
        try {
            if (modoBusqueda === 'CODIGO') {
                if (!codigo.trim()) { alert("Escribe un código."); setBuscando(false); return; }
                const q = query(ref, where("accessCode", "==", codigo.toUpperCase().trim()));
                const snap = await getDocs(q);
                if (snap.empty) alert("Código no encontrado.");
                else {
                    const docs = snap.docs.map(d => ({ ...d.data(), id: d.id }));
                    const r = docs[0];
                    const allowed = ['PASAPALABRA', 'CAZABURBUJAS', 'APAREJADOS', 'RULETA', 'THINKHOOT'];

                    if (!allowed.includes(r.tipoJuego)) {
                        alert("Tipo de juego no disponible.");
                        setBuscando(false);
                        return;
                    }

                    if (r.tipoJuego === 'THINKHOOT') {
                        alert("Código de sala en vivo. Úsalo en 'Jugar en Vivo'.");
                        setJoinLiveCode(codigo.toUpperCase());
                    } else {
                        // VALIDACIÓN ESTRICTA DE TERMINADO
                        if (r.isFinished === true || r.config?.isFinished === true) {
                            setResultados(docs);
                        } else {
                            alert("Este recurso aún no está terminado.");
                        }
                    }
                }
            } else {
                // Búsqueda por filtros
                const q = query(ref, orderBy("fechaCreacion", "desc"), limit(50));
                const snap = await getDocs(q);
                const raw = snap.docs.map(d => ({ ...d.data(), id: d.id }));

                const filtrados = raw.filter(r => {
                    const f = filtros;

                    const allowedTypes = ['PASAPALABRA', 'CAZABURBUJAS', 'APAREJADOS', 'RULETA'];
                    if (!allowedTypes.includes(r.tipoJuego)) return false;

                    // FILTRO DE "TERMINADO" OBLIGATORIO
                    const isTerminado = r.isFinished === true || r.config?.isFinished === true;
                    if (!isTerminado) return false;

                    const check = (d, v) => !v || cleanText(d).includes(cleanText(v));
                    const checkTema = () => !f.tema || cleanText(r.titulo).includes(cleanText(f.tema)) || (r.temas && cleanText(r.temas).includes(cleanText(f.tema)));

                    return check(r.profesorNombre, f.profesor) && check(r.pais, f.pais) && check(r.region, f.region) && checkTema();
                });

                if (filtrados.length === 0) alert("No se encontraron recursos terminados con esos filtros.");
                setResultados(filtrados);
            }
        } catch (e) { console.error(e); alert("Error en la búsqueda."); }
        setBuscando(false);
    };

    const compartir = (e, r) => {
        e.stopPropagation();
        const texto = `¡Juega a ${r.titulo} en PiKT! Código: ${r.accessCode}`;
        if (navigator.share) navigator.share({ title: r.titulo, text: texto, url: window.location.href }).catch(() => { });
        else { navigator.clipboard.writeText(texto); alert("¡Código copiado!"); }
    };

    if (liveMode) return <ThinkHootGame isHost={false} codigoSala={joinLiveCode} usuario={{ displayName: joinLiveName || "Invitado", email: null }} onExit={() => setLiveMode(false)} />;

    if (juegoActivo) {
        if (juegoActivo.tipoJuego === 'RULETA') return <RuletaGame recurso={juegoActivo} usuario={null} alTerminar={() => setJuegoActivo(null)} />;
        return <GamePlayer recurso={juegoActivo} usuario={null} alTerminar={() => setJuegoActivo(null)} />;
    }

    return (
        <div style={styles.container}>

            {/* BUSCADOR */}
            <div style={styles.card}>
                <h3 style={{ color: '#333', textAlign: 'center', margin: '0 0 20px 0' }}>🔍 Encuentra un Juego</h3>
                <div style={styles.tabContainer}>
                    <button style={styles.tabButton(modoBusqueda === 'FILTROS')} onClick={() => setModoBusqueda('FILTROS')}><Search size={16} /> Filtros</button>
                    <button style={styles.tabButton(modoBusqueda === 'CODIGO')} onClick={() => setModoBusqueda('CODIGO')}><Key size={16} /> Código</button>
                </div>

                {modoBusqueda === 'CODIGO' ? (
                    <div style={{ textAlign: 'center' }}>
                        <input placeholder="Ej: A1B2C" value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} style={{ ...styles.input, textAlign: 'center', fontSize: '1.5rem', letterSpacing: '5px', textTransform: 'uppercase', width: '200px' }} maxLength={5} />
                    </div>
                ) : (
                        <div style={styles.inputGroup}>
                            <input style={styles.input} placeholder="Tema (Ej: Mates)" value={filtros.tema} onChange={e => setFiltros({ ...filtros, tema: e.target.value })} />
                            <input style={styles.input} placeholder="Profesor" value={filtros.profesor} onChange={e => setFiltros({ ...filtros, profesor: e.target.value })} />
                            <input style={styles.input} placeholder="País" value={filtros.pais} onChange={e => setFiltros({ ...filtros, pais: e.target.value })} />
                            <input style={styles.input} placeholder="Región" value={filtros.region} onChange={e => setFiltros({ ...filtros, region: e.target.value })} />
                        </div>
                    )}

                <button style={styles.searchButton} onClick={buscar} disabled={buscando}>{buscando ? 'BUSCANDO...' : 'Busca un juego'}</button>

                {/* RESULTADOS DE BÚSQUEDA - LISTA VERTICAL */}
                {resultados.length > 0 && (
                    <div style={{ marginTop: '25px' }}>
                        <h4 style={{ color: '#666', marginBottom: '10px' }}>Resultados ({resultados.length}):</h4>
                        <div style={styles.verticalList}>
                            {resultados.map(r => (
                                <ResourceCard key={r.id} r={r} onClick={() => setJuegoActivo(r)} onShare={(e) => compartir(e, r)} />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* SECCIÓN JUGAR EN VIVO */}
            <div style={styles.liveSection}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                    <Gamepad2 size={32} />
                    <h2 style={{ margin: 0 }}>JUGAR EN VIVO</h2>
                </div>
                <p style={{ marginBottom: '15px' }}>¿Tienes un código de sala para <b>ThinkHoot</b>?</p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <input placeholder="Código Sala" value={joinLiveCode} onChange={e => setJoinLiveCode(e.target.value)} style={{ ...styles.input, width: '140px', textAlign: 'center' }} />
                    <input placeholder="Tu Nombre" value={joinLiveName} onChange={e => setJoinLiveName(e.target.value)} style={{ ...styles.input, width: '180px', textAlign: 'center' }} />
                    <button onClick={() => { if (joinLiveCode && joinLiveName) setLiveMode(true); else alert("Rellena código y nombre"); }} style={{ ...styles.searchButton, width: 'auto', marginTop: 0, background: '#f1c40f', color: '#333' }}>UNIRSE</button>
                </div>
            </div>

            {/* TOP RECURSOS - GRID FIJO */}
            <h2 style={styles.sectionTitle}>🔥 Los Más Populares</h2>
            {topGames.length > 0 ? (
                <div style={styles.gridList}>
                    {topGames.map(r => (
                        <ResourceCard key={r.id} r={r} onClick={() => setJuegoActivo(r)} onShare={(e) => compartir(e, r)} />
                    ))}
                </div>
            ) : (
                    <p style={{ textAlign: 'center', color: 'white', opacity: 0.7 }}>No hay juegos destacados terminados en este momento.</p>
                )}

        </div>
    );
}

// Subcomponente Tarjeta
const ResourceCard = ({ r, onClick, onShare }) => (
    <div style={styles.resourceCard(getColor(r.tipoJuego))} onClick={onClick}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
                <h4 style={{ margin: '0 0 5px 0', color: '#333', fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '220px' }} title={r.titulo}>{r.titulo}</h4>
                <div style={styles.codeBadge}>
                    <Key size={12} /> {r.accessCode || '----'}
                </div>
            </div>
            <button onClick={onShare} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#777' }} title="Compartir">
                <Share2 size={18} />
            </button>
        </div>

        <div style={{ marginTop: '10px', fontSize: '0.85rem', color: '#666' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><User size={12} /> {r.profesorNombre}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px' }}><MapPin size={12} /> {r.poblacion}, {r.pais}</div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px' }}>
            <div style={{ background: getColor(r.tipoJuego), color: 'white', padding: '3px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 'bold' }}>{r.tipoJuego}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}><Users size={14} /> {r.playCount || 0}</div>
        </div>

        <div style={{ position: 'absolute', bottom: '15px', right: '15px', opacity: 0.1 }}>
            <Play size={40} color={getColor(r.tipoJuego)} fill={getColor(r.tipoJuego)} />
        </div>
    </div>
);