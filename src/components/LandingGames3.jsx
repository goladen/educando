import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc, setDoc } from 'firebase/firestore';
import { Search, Key, Filter, Zap, Play, Home, ChevronDown, ChevronUp, Mail, Link2, Share2 } from 'lucide-react';
import GamePlayer from '../GamePlayer';
import KartingedGame from '../KartingedGame';
import KartingedMultiGame from '../KartingedMultiGame';
import RacingGame3D from '../RacingGame3D';
import ThinkHootGame from '../ThinkHootGame';
import RuletaGame from '../RuletaGame';
import MathLive from '../MathLive';
import OlympicLive from '../OlympicLive';
import QuestionSenderClient from '../QuestionSenderClient';
import PikatronRun from '../PikatronRun';
import TextWordleGame from '../TextWordleGame';
import MathWordleGame from '../MathWordleGame';
import SopaDeLetrasGame from '../SopaDeLetrasGame';
import SintaxisGame from '../SintaxisGamen2';
import Listening from '../ListeningGame'
import Geometrix from '../Geometrix';
import CalculoMental from '../CalculoMental'; 
import Ecuaciones from '../Ecuaciones';
import Funciones from '../Funciones';
import GeometriaAnalitica from '../Funciones2'
import Plataformas from '../Plataformas2';
import StoryCubes from '../StoryCubes';
import UserProfile from './UserProfile';
import MansionPitagoricaGame from '../MansionPitagoricaGame';

import EtiquetaMe from '../EtiquetaMe';
import OmninteractiveApp from '../OmninteractiveApp';
import OcaMatematicaDirect from '../OcaMatematica';
import DominoMatematicoDirect from '../dominofracciones';
import VideoQuizzApp from '../VideoQuizzApp';
import FuncionesEjecutivas from '../FuncionesEjecutivas';
import IrregularVerbsTest from '../IrregularVerbsTest';
import MusicApp from '../MusicApp';
import GeografiaApp from './GeografiaApp';
import BiologiaApp  from './BiologiaApp';
import HerramientasClase from '../GestionAula';
import AlgebraApp from '../Algebra';
import VistasDidricas from '../VistasDidricas';
import EstadisticaApp from '../Estadistica';
import SimuladorColisiones from '../Simuladores física/SimuladorColisiones';
import SimuladorPlanoInclinado from '../Simuladores física/SimuladorPlanoInclinado';
import SimuladorTiroParabolico from '../Simuladores física/SimuladorTiroParabolico';
import SimuladorCaidaLibre from '../Simuladores física/SimuladorCaidaLibre';
import SimuladorPendulo from '../Simuladores física/SimuladorPendulo';
import SimuladorLeyDeOhm from '../Simuladores física/SimuladorLeyDeOhm';
import RetosApp from '../Retos';
import SimuladorDados from '../Probabilidad';
import TrivialGame from '../Trivial';
import ExpresionArtEscri from '../ExpresionArtEscri';
import SimuladorOAOA from '../MatesOAOA';
import JuegoFeriaOAOA from '../FeriaMates';
import JuegoDivisibilidad from '../Divisibilidad';
import imgPasapalabra from '../assets/icono_pasapal.png'; // Revisa si es .png o .jpg
import imgBurbujas from '../assets/icono_burbujas.png';
import imgPikatron from '../assets/icono_pikatron.png';
import imgPikatron2 from '../assets/iconoPikatron2.png';
import imgEtiquetas from '../assets/icono_etiquetas.png';
import imgAparejados from '../assets/icono_aparejados.png';
import imgRuleta from '../assets/icono_ruleta.png';
import imgWordle from '../assets/icono_wordle.png';
import imgMathle from '../assets/icono_mathle.png';
import imgPilive from '../assets/icono_pilive.png';
import imgMathlive from '../assets/icono_mathlive.png';
import imgSopa from '../assets/icono_sopa.png';
import imgOlympic from '../assets/icono_olympic.png';


// ─── SOLAR SYSTEM APP ────────────────────────────────────────────────────────

const SS_BG = 'linear-gradient(135deg, #080818 0%, #0c1530 60%, #080818 100%)';

const SS_PLANETAS = [
    { id: 'Sol',      emoji: '☀️',  texto: 'El Sol es la estrella central de nuestro sistema solar. Con 1,4 millones de kilómetros de diámetro, en su interior cabrían más de un millón de Tierras. Su temperatura superficial alcanza los 5.500 grados Celsius.' },
    { id: 'Mercurio', emoji: '🪨',  texto: 'Mercurio es el planeta más pequeño y el más cercano al Sol. Carece de atmósfera, lo que provoca temperaturas extremas: 430 grados de día y -180 de noche. Un año en Mercurio dura solo 88 días terrestres.' },
    { id: 'Venus',    emoji: '🌫️', texto: 'Venus es el planeta más caliente, con 465 grados Celsius. Su densa atmósfera de CO₂ genera un efecto invernadero extremo. Un día en Venus dura más que su propio año.' },
    { id: 'Tierra',   emoji: '🌍',  texto: 'La Tierra es el único planeta conocido con vida. Su atmósfera protectora y el agua líquida la hacen única en el sistema solar. Orbita el Sol a 150 millones de kilómetros.' },
    { id: 'Luna',     emoji: '🌙',  texto: 'La Luna es el único satélite natural de la Tierra. Está a 384.400 km y tarda 27 días en orbitar nuestro planeta. Es el único lugar fuera de la Tierra donde el ser humano ha pisado.' },
    { id: 'Jupiter',  emoji: '🪐',  texto: 'Júpiter es el planeta más grande del sistema solar. La Gran Mancha Roja es una tormenta activa desde hace más de 350 años. Tiene 95 lunas conocidas.' },
    { id: 'Saturno',  emoji: '💫',  texto: 'Saturno es famoso por sus anillos de hielo y roca. Es tan poco denso que flotaría en el agua. Tiene más de 80 lunas conocidas y su día dura solo 10 horas.' },
    { id: 'Urano',    emoji: '🔵',  texto: 'Urano gira de lado con una inclinación de 98 grados, probablemente por una colisión gigante en el pasado. Es el planeta más frío, con -224 grados Celsius.' },
    { id: 'Neptuno',  emoji: '🌀',  texto: 'Neptuno posee los vientos más rápidos del sistema solar, superando los 2.100 km/h. Está a 4.500 millones de km del Sol y un año aquí dura 165 años terrestres.' },
];

const SS_LINKS = [
    { emoji: '🚀', titulo: 'NASA Solar System', desc: 'Exploración oficial de la NASA', url: 'https://solarsystem.nasa.gov/', bg: '#1e3a5f' },
    { emoji: '🌍', titulo: 'Solar System Scope', desc: 'Simulador 3D interactivo online', url: 'https://www.solarsystemscope.com/', bg: '#1a3a2a' },
    { emoji: '🔭', titulo: 'Stellarium Web', desc: 'Planetario virtual gratuito', url: 'https://stellarium-web.org/', bg: '#2a1a3a' },
    { emoji: '👁️', titulo: 'NASA Eyes', desc: 'Visualizador 3D de misiones NASA', url: 'https://eyes.nasa.gov/apps/solar-system/', bg: '#3a1a1a' },
    { emoji: '🪐', titulo: 'Universe Sandbox', desc: 'Simulador de física espacial', url: 'https://universesandbox.com/', bg: '#1a2a3a' },
    { emoji: '📡', titulo: 'Space.com', desc: 'Noticias y ciencia espacial', url: 'https://www.space.com/', bg: '#2a2a1a' },
];

function SsSection({ titulo, children }) {
    return (
        <div style={{ marginBottom: 24 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 700, color: '#CBD5E1' }}>{titulo}</h3>
            <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 16 }}>
                {children}
            </div>
        </div>
    );
}

export function SolarSystemViewer({ onExit, recursoConfig }) {
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    const [pantalla, setPantalla] = React.useState('intro');
    const [toursBuscados, setToursBuscados] = React.useState(null);
    const [buscandoTours, setBuscandoTours] = React.useState(false);
    const [localShare, setLocalShare] = React.useState(null);
    const [showLandscapeHint, setShowLandscapeHint] = React.useState(
        () => isMobile && window.innerWidth <= window.innerHeight
    );
    const iframeRef = React.useRef(null);

    const [seleccion, setSeleccion] = React.useState(() => {
        if (recursoConfig?.planetas) {
            const map = {};
            recursoConfig.planetas.forEach(p => { map[p.nombre] = { activo: p.activo ?? true, texto: p.texto || '' }; });
            return map;
        }
        return Object.fromEntries(SS_PLANETAS.map(p => [p.id, { activo: true, texto: p.texto }]));
    });
    const [musica, setMusica] = React.useState(recursoConfig?.musicaUrl || 'https://www.youtube.com/watch?v=7GlsxNI4LVI');
    const [duracion, setDuracion] = React.useState(recursoConfig?.duracionEscena || 8);
    const [compActiva, setCompActiva] = React.useState(recursoConfig?.comparativa?.activa ?? true);
    const [compTexto, setCompTexto] = React.useState(recursoConfig?.comparativa?.texto || '');
    const [compDuracion, setCompDuracion] = React.useState(recursoConfig?.comparativa?.duracion || 14);

    React.useEffect(() => {
        if (recursoConfig) {
            lanzarPersonalizadoConConfig(recursoConfig);
        }
    }, []);

    React.useEffect(() => {
        if (pantalla !== 'playing') return;
        if (isMobile && document.documentElement.requestFullscreen)
            document.documentElement.requestFullscreen().catch(() => {});
        if (isMobile && screen.orientation?.lock)
            screen.orientation.lock('landscape').catch(() => {});
        const onResize = () => { if (window.innerWidth > window.innerHeight) setShowLandscapeHint(false); };
        window.addEventListener('resize', onResize);
        return () => {
            window.removeEventListener('resize', onResize);
            if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
            if (screen.orientation?.unlock) screen.orientation.unlock();
        };
    }, [pantalla]);

    const lanzarPersonalizadoConConfig = (config) => {
        localStorage.setItem('solarTourConfig', JSON.stringify(config));
        setPantalla('playing');
    };

    const lanzarDefault = () => {
        localStorage.removeItem('solarTourConfig');
        setPantalla('playing');
    };

    const lanzarPersonalizado = () => {
        const planetas = SS_PLANETAS
            .filter(p => seleccion[p.id]?.activo)
            .map(p => ({ nombre: p.id, texto: seleccion[p.id]?.texto || '' }));
        if (!planetas.length) return;
        localStorage.setItem('solarTourConfig', JSON.stringify({
            planetas,
            musicaUrl: musica,
            duracionEscena: duracion,
            comparativa: { activa: compActiva, texto: compTexto, duracion: compDuracion },
        }));
        setPantalla('playing');
    };

    const salirDeUnity = () => {
        localStorage.removeItem('solarTourConfig');
        setPantalla('outro');
    };

    const togglePlaneta = id => setSeleccion(prev => ({ ...prev, [id]: { ...prev[id], activo: !prev[id].activo } }));
    const setTexto = (id, texto) => setSeleccion(prev => ({ ...prev, [id]: { ...prev[id], texto } }));
    const nActivos = SS_PLANETAS.filter(p => seleccion[p.id]?.activo).length;

    const buscarTours = async () => {
        if (toursBuscados !== null) { setPantalla('buscar'); return; }
        setBuscandoTours(true);
        try {
            const q = query(collection(db, 'resources'), where('tipoJuego', '==', 'SOLAR_SYSTEM'));
            const snap = await getDocs(q);
            const docs = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(r => !r.isPrivate);
            setToursBuscados(docs);
        } catch (e) { console.error(e); setToursBuscados([]); }
        setBuscandoTours(false);
        setPantalla('buscar');
    };

    const lanzarTourGuardado = (r) => {
        if (r.tourConfig) {
            lanzarPersonalizadoConConfig(r.tourConfig);
        } else {
            lanzarDefault();
        }
    };

    const abrirShareModal = (url) => {
        if (navigator.share) {
            navigator.share({ title: 'Sistema Solar Interactivo', url }).catch(() => setLocalShare(url));
        } else {
            setLocalShare(url);
        }
    };

    const compartirConfig = () => {
        const planetas = Object.entries(seleccion).map(([nombre, v]) => ({ nombre, texto: v.texto || '', activo: v.activo ?? true }));
        const config = { planetas, musicaUrl: musica, duracionEscena: duracion, comparativa: { activa: compActiva, texto: compTexto, duracion: compDuracion } };
        const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(config))));
        const url = `${window.location.origin}${window.location.pathname}?juego=solar_system&tourconfig=${encoded}`;
        abrirShareModal(url);
    };

    // ── INTRO ─────────────────────────────────────────────────────────────────
    if (pantalla === 'intro') return (
        <>
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: SS_BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', overflow: 'auto', padding: '24px 16px' }}>
            <button onClick={onExit} style={{ position: 'absolute', top: 16, left: 16, background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontWeight: 'bold' }}>✕ Cerrar</button>
            <div style={{ maxWidth: 560, width: '100%', textAlign: 'center' }}>
                <div style={{ fontSize: 72, marginBottom: 8 }}>🌌</div>
                <h1 style={{ fontSize: 'clamp(1.6rem,4vw,2.4rem)', fontWeight: 800, margin: '0 0 12px', background: 'linear-gradient(90deg,#FCD34D,#3B82F6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Sistema Solar Interactivo
                </h1>
                <p style={{ fontSize: '1.05rem', color: '#94A3B8', marginBottom: 32, lineHeight: 1.6 }}>
                    Explora el sistema solar con un tour guiado, narración por voz y escenas comparativas de tamaño
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 36, textAlign: 'left' }}>
                    {[['🔭','Tour guiado con cámara orbital'],['🗣️','Narración por voz en cada planeta'],['📏','Escena comparativa de tamaños reales'],['🎵','Música de fondo personalizable']].map(([icon, txt], i) => (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 14, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <span style={{ fontSize: 22 }}>{icon}</span>
                            <span style={{ fontSize: '0.85rem', color: '#CBD5E1', lineHeight: 1.4 }}>{txt}</span>
                        </div>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button onClick={lanzarDefault} style={{ padding: '14px 28px', background: 'linear-gradient(135deg,#3B82F6,#2563EB)', color: 'white', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: '1rem', boxShadow: '0 4px 20px rgba(59,130,246,0.4)' }}>
                        🚀 Explorar ahora
                    </button>
                    <button onClick={buscarTours} disabled={buscandoTours} style={{ padding: '14px 28px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: '1rem' }}>
                        {buscandoTours ? '⏳ Buscando...' : '🔍 Buscar un tour'}
                    </button>
                    <button onClick={compartirConfig} style={{ padding: '14px 28px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                        🔗 Compartir tour
                    </button>
                </div>
            </div>
        </div>
        {localShare && <ShareModal url={localShare} titulo="Sistema Solar" onClose={() => setLocalShare(null)} />}
        </>
    );

    // ── BUSCAR TOUR ───────────────────────────────────────────────────────────
    if (pantalla === 'buscar') return (
        <>
        <div style={{ position:'fixed', inset:0, zIndex:9999, background:SS_BG, color:'white', overflowY:'auto' }}>
            <div style={{ maxWidth:700, margin:'0 auto', padding:'24px 16px 80px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:28 }}>
                    <button onClick={() => setPantalla('intro')} style={{ background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)', color:'white', borderRadius:8, padding:'8px 14px', cursor:'pointer', fontWeight:'bold' }}>← Volver</button>
                    <h2 style={{ margin:0, fontSize:'1.4rem', fontWeight:800 }}>🔍 Tours guardados por profesores</h2>
                </div>

                {buscandoTours && (
                    <div style={{ textAlign:'center', padding:60, color:'#94A3B8', fontSize:'1.1rem' }}>⏳ Cargando tours...</div>
                )}

                {!buscandoTours && toursBuscados?.length === 0 && (
                    <div style={{ textAlign:'center', padding:60, color:'#94A3B8' }}>
                        <div style={{ fontSize:48, marginBottom:12 }}>🪐</div>
                        <p>Todavía no hay tours publicados por profesores.</p>
                        <p style={{ fontSize:'0.9rem' }}>Los profesores pueden crear y publicar tours desde el Panel Docente.</p>
                    </div>
                )}

                {!buscandoTours && toursBuscados?.length > 0 && (
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:16 }}>
                        {toursBuscados.map(r => {
                            const planetas = r.tourConfig?.planetas?.filter(p => p.activo) || [];
                            return (
                                <div key={r.id} style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:16, padding:20, display:'flex', flexDirection:'column', gap:12 }}>
                                    <div>
                                        <div style={{ fontWeight:700, fontSize:'1.05rem', marginBottom:4 }}>{r.titulo || 'Tour sin título'}</div>
                                        {r.profesorNombre && <div style={{ fontSize:'0.8rem', color:'#94A3B8' }}>por {r.profesorNombre}</div>}
                                        {r.temas && <div style={{ fontSize:'0.8rem', color:'#64748B', marginTop:2 }}>{r.temas}</div>}
                                    </div>
                                    {planetas.length > 0 && (
                                        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                                            {planetas.map(p => (
                                                <span key={p.nombre} style={{ background:'rgba(59,130,246,0.2)', border:'1px solid rgba(59,130,246,0.3)', borderRadius:20, padding:'2px 10px', fontSize:'0.78rem' }}>
                                                    {p.nombre}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    <div style={{ display:'flex', gap:8, marginTop:'auto' }}>
                                        <button
                                            onClick={() => lanzarTourGuardado(r)}
                                            style={{ flex:1, padding:'10px', background:'linear-gradient(135deg,#3B82F6,#2563EB)', color:'white', border:'none', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:'0.9rem' }}
                                        >
                                            🚀 Lanzar tour
                                        </button>
                                        {r.tourConfig && (
                                            <button
                                                onClick={() => {
                                                    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(r.tourConfig))));
                                                    const url = `${window.location.origin}${window.location.pathname}?juego=solar_system&tourconfig=${encoded}`;
                                                    abrirShareModal(url);
                                                }}
                                                title="Compartir este tour"
                                                style={{ padding:'10px 14px', background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)', color:'white', borderRadius:10, cursor:'pointer', fontSize:'1rem' }}
                                            >
                                                🔗
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
        {localShare && <ShareModal url={localShare} titulo="Sistema Solar" onClose={() => setLocalShare(null)} />}
        </>
    );

    // ── CONFIG ────────────────────────────────────────────────────────────────
    if (pantalla === 'config') return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: SS_BG, color: 'white', overflowY: 'auto' }}>
            <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px 100px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
                    <button onClick={() => setPantalla('intro')} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' }}>← Volver</button>
                    <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>⚙️ Personalizar el Tour</h2>
                </div>

                <SsSection titulo="🎵 Música de fondo">
                    <label style={{ fontSize: '0.82rem', color: '#94A3B8', display: 'block', marginBottom: 6 }}>URL de YouTube o enlace directo a audio (MP3, OGG…)</label>
                    <input value={musica} onChange={e => setMusica(e.target.value)} placeholder="https://www.youtube.com/watch?v=..."
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.07)', color: 'white', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                </SsSection>

                <SsSection titulo="⏱️ Duración por planeta">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <input type="range" min={4} max={20} value={duracion} onChange={e => setDuracion(+e.target.value)} style={{ flex: 1, accentColor: '#3B82F6' }} />
                        <span style={{ minWidth: 50, textAlign: 'center', fontWeight: 700, fontSize: '1.1rem', color: '#FCD34D' }}>{duracion}s</span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '6px 0 0' }}>Tiempo de rotación orbital en torno a cada planeta</p>
                </SsSection>

                <SsSection titulo={`🪐 Planetas del tour (${nActivos} seleccionados)`}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {SS_PLANETAS.map(p => {
                            const act = !!seleccion[p.id]?.activo;
                            return (
                                <div key={p.id} style={{ background: act ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${act ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 10, overflow: 'hidden' }}>
                                    <div onClick={() => togglePlaneta(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer' }}>
                                        <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${act ? '#3B82F6' : 'rgba(255,255,255,0.3)'}`, background: act ? '#3B82F6' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}>
                                            {act && <span style={{ fontSize: 13, color: 'white' }}>✓</span>}
                                        </div>
                                        <span style={{ fontSize: 20 }}>{p.emoji}</span>
                                        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{p.id === 'Jupiter' ? 'Júpiter' : p.id}</span>
                                    </div>
                                    {act && (
                                        <div style={{ padding: '0 14px 12px' }}>
                                            <textarea value={seleccion[p.id]?.texto || ''} onChange={e => setTexto(p.id, e.target.value)}
                                                rows={3} placeholder="Texto de narración para este planeta..."
                                                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '0.85rem', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </SsSection>

                <SsSection titulo="📏 Escena comparativa de tamaños">
                    <div onClick={() => setCompActiva(!compActiva)} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: compActiva ? 14 : 0, cursor: 'pointer' }}>
                        <div style={{ width: 44, height: 24, borderRadius: 12, background: compActiva ? '#3B82F6' : 'rgba(255,255,255,0.2)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                            <div style={{ position: 'absolute', top: 2, left: compActiva ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
                        </div>
                        <span style={{ fontSize: '0.9rem', color: compActiva ? 'white' : '#64748B' }}>
                            {compActiva ? 'Activa — aparece al final del tour' : 'Desactivada'}
                        </span>
                    </div>
                    {compActiva && (<>
                        <textarea value={compTexto} onChange={e => setCompTexto(e.target.value)} rows={3}
                            placeholder="Narración personalizada (vacío = generada automáticamente)..."
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '0.85rem', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 12 }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <span style={{ fontSize: '0.85rem', color: '#94A3B8', whiteSpace: 'nowrap' }}>Duración:</span>
                            <input type="range" min={6} max={30} value={compDuracion} onChange={e => setCompDuracion(+e.target.value)} style={{ flex: 1, accentColor: '#F59E0B' }} />
                            <span style={{ minWidth: 50, textAlign: 'center', fontWeight: 700, color: '#FCD34D' }}>{compDuracion}s</span>
                        </div>
                    </>)}
                </SsSection>

                <div style={{ position: 'sticky', bottom: 0, padding: '12px 0 4px', background: 'linear-gradient(to top,#080818 75%,transparent)' }}>
                    <button onClick={lanzarPersonalizado} disabled={nActivos === 0}
                        style={{ width: '100%', padding: 15, background: nActivos > 0 ? 'linear-gradient(135deg,#3B82F6,#2563EB)' : 'rgba(255,255,255,0.1)', color: nActivos > 0 ? 'white' : '#64748B', border: 'none', borderRadius: 12, cursor: nActivos > 0 ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '1rem', boxShadow: nActivos > 0 ? '0 4px 20px rgba(59,130,246,0.4)' : 'none', transition: 'all 0.2s' }}>
                        {nActivos > 0 ? `🚀 Iniciar tour (${nActivos} planetas)` : 'Selecciona al menos un planeta'}
                    </button>
                </div>
            </div>
        </div>
    );

    // ── PLAYING ───────────────────────────────────────────────────────────────
    if (pantalla === 'playing') return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#000', display: 'flex', flexDirection: 'column' }}>
            {showLandscapeHint && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 10001, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', gap: 16 }}>
                    <div style={{ fontSize: 64 }}>📱↔️</div>
                    <p style={{ fontSize: '1.3rem', fontWeight: 'bold', textAlign: 'center', margin: 0 }}>Gira el dispositivo</p>
                    <p style={{ fontSize: '1rem', color: '#aaa', textAlign: 'center', margin: 0 }}>Para una mejor experiencia usa la vista horizontal</p>
                    <button onClick={() => setShowLandscapeHint(false)} style={{ marginTop: 8, padding: '10px 28px', background: '#3B82F6', color: 'white', border: 'none', borderRadius: 10, fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}>Continuar de todos modos</button>
                    <button onClick={salirDeUnity} style={{ background: 'transparent', color: '#aaa', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>Cancelar</button>
                </div>
            )}
            <button onClick={salirDeUnity} style={{ position: 'absolute', top: 10, left: 10, zIndex: 10000, background: 'rgba(0,0,0,0.7)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem' }}>
                ← Salir
            </button>
            <iframe ref={iframeRef} src="/SolarSystem/index.html" title="Sistema Solar"
                style={{ flex: 1, border: 'none', width: '100%', height: '100%' }} allow="fullscreen" />
        </div>
    );

    // ── OUTRO ─────────────────────────────────────────────────────────────────
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: SS_BG, color: 'white', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px 48px' }}>
            <div style={{ maxWidth: 640, width: '100%', textAlign: 'center' }}>
                <div style={{ fontSize: 64, marginBottom: 12 }}>🎉</div>
                <h2 style={{ fontSize: 'clamp(1.4rem,3vw,2rem)', fontWeight: 800, margin: '0 0 8px' }}>¡Exploración completada!</h2>
                <p style={{ color: '#94A3B8', marginBottom: 32, fontSize: '1rem' }}>Continúa descubriendo el universo con estos recursos</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(175px,1fr))', gap: 12, marginBottom: 36, textAlign: 'left' }}>
                    {SS_LINKS.map((l, i) => (
                        <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
                            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                            style={{ background: l.bg, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '16px 14px', textDecoration: 'none', color: 'white', display: 'flex', flexDirection: 'column', gap: 6, transition: 'transform 0.15s' }}>
                            <span style={{ fontSize: 28 }}>{l.emoji}</span>
                            <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{l.titulo}</span>
                            <span style={{ fontSize: '0.78rem', color: '#94A3B8', lineHeight: 1.3 }}>{l.desc}</span>
                        </a>
                    ))}
                </div>
                <button onClick={onExit} style={{ padding: '14px 32px', background: 'linear-gradient(135deg,#3B82F6,#2563EB)', color: 'white', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: '1rem', boxShadow: '0 4px 20px rgba(59,130,246,0.4)' }}>
                    🏠 Volver a herramientas
                </button>
            </div>
        </div>
    );
}

// --- CONFIGURACIÓN DE APLICACIONES Y COLORES ---
export const APPS = [
    { id: 'PASAPALABRA', name: 'Pasapalabra', desc: 'Adivina la palabra con cada letra del abecedario.', color: '#0A0E45', img: imgPasapalabra, shareable: true },
    { id: 'CAZABURBUJAS', name: 'Burbujas', desc: 'Explota la burbuja con la respuesta correcta.', color: '#de896e', img: imgBurbujas, shareable: true },
    { id: 'PIKATRON', name: 'Pikatron', desc: 'Juego tipo runner con preguntas.', color: '#2196F3', img: imgPikatron, shareable: true },
    {
        id: 'PIKATRON_2',
        name: 'Pikatron_2',
        desc: 'Salta y corre, acierta. Por plataformas',
        color: '#2196F3',
        img: imgPikatron2,
        isSpecial: false,
        shareable: true
    },
    {
        id: 'KARTINGED',
        name: 'Karting',
        desc: 'Carreras de karts con preguntas en los checkpoints.',
        color: '#FF6B00',
        emoji: '🚗',
        shareable: true
    },
    {
        id: 'RACING3D',
        name: 'Racing 3D',
        desc: 'Carreras 3D con preguntas en los checkpoints. 4 vueltas, 3 AI.',
        color: '#00C6FF',
        emoji: '🏁',
        shareable: true
    },
    {
        id: 'MANSION_PITAGORICA',
        name: 'Mansión Pitagórica',
        desc: 'Explora la mansión respondiendo preguntas de opción múltiple.',
        color: '#7c3aed',
        emoji: '🏛️',
        shareable: true
    },


{ id: 'APAREJADOS', name: 'AparejaDOS', desc: 'Encuentra las parejas correctas.', color: '#FF9800', img: imgAparejados, shareable: true },
    { id: 'RULETA', name: 'Ruleta', desc: 'Resuelve el panel oculto.', color: '#f1c40f', img: imgRuleta, shareable: true },
    { id: 'WORDLE', name: 'WordLe', desc: 'Adivina la palabra en 6 intentos.', color: '#2e7d32', img: imgWordle, shareable: true },
    { id: 'MATHLE', name: 'MathLe', desc: 'Adivina la ecuación matemática oculta.', color: '#1565C0', img: imgMathle, shareable: true },
    { id: 'THINKHOOT', name: 'PiLive', desc: 'Diviértete en vivo con tus compañeros.', color: '#9C27B0', img: imgPilive, isLive: true, shareable: true },
    { id: 'EAE', name: 'PictoTabú', desc: 'Dibuja o describe sin usar palabras tabú.', color: '#e67e22', emoji: '🎨✍️', img: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEg80nlTKknMfTBotTp1CGlbyfxwhJALm8EsZoOrxi3qKUZ5z8dgiezpsnVAh9UoCSvtA7FJ_0XifE0lN9_t8mAAQiH_nebCwjN5IwpvhjAi4JF-NcSEP0M972qoXd3HPtyjfzRWj-dZM9s/s1600/Captura+de+pantalla+2020-03-30+a+las+10.29.34.png', isLive: true, shareable: false },
    { id: 'MATHLIVE', name: 'MathLive', desc: 'Juega con las mates en tiempo real.', color: '#009688', img: imgMathlive, isLive: true, shareable: true },
    { id: 'OLYMPICLIVE', name: 'Olympic_Live', desc: 'Compite en minijuegos y cálculo.', color: '#D32F2F', img: imgOlympic, isLive: true, shareable: true },
    { id: 'SOPA', name: 'Sopa_letras', desc: 'Encuentra las palabras ocultas.', color: '#e67e22', img: imgSopa, shareable: true },
    {
        id: 'QUESTION_SENDER',
        name: 'Q-Sender',
        desc: 'Envía tus preguntas al profesor para crear un juego.',
        color: '#2c3e50',
        img: null,
        emoji: '📮',
        isSpecial: true,
        isHerramienta: true,
        shareable: true
    },
    {
        id: 'SINTAXIS',
        name: 'Sintaxis',
        desc: 'Analiza frases de distintos niveles.',
        color: '#3498db',
        emoji: '🖍️',
        isSpecial: false,
        isHerramienta: true,
        shareable: true
    },
    {
        id: 'LISTENING',
        name: 'Listening',
        desc: 'Escucha y completa.',
        color: '#3498db',
        emoji: '🙉​',
        isSpecial: false,
        isHerramienta: true,
        shareable: true
    },
    {
        id: 'IRREGULAR_VERBS',
        name:'Irregular_Verbs',
        desc: 'Test de verbos irregulares en inglés.',
        color: '#8B5CF6',
        emoji: '📚',
        isSpecial: false,
         isHerramienta: true,
        shareable: true
    },
    {
        id: 'MATH_WORLD_PORTAL',
        name: 'Math World',
        desc: 'Entra a la zona exclusiva de aplicaciones matemáticas.',
        color: '#009688',
        emoji: '🌍',
        isPortal: true,
        isHerramienta: true,
        shareable: true
    },
    // --- JUEGOS DE MATEMÁTICAS (Saldrán en la segunda pantalla) ---
    { id: 'GEOMETRIX', name: 'Geometrix', desc: 'Áreas, volúmenes y regla virtual.', color: '#009688', emoji: '📐', isMath: true, shareable: true },
    {
        id: 'CALCULO',
        name: 'Calculo',
        desc: 'Agilidad mental y operaciones con tiempo.',
        color: '#E91E63',
        emoji: '🧠',
        isMath: true,
        shareable: true
    },
    {
        id: 'ETIQUETAS',
        name: 'EtiquetaMe',
        desc: 'Identifica las partes de un diagrama poniendo las etiquetas correctas.',
        color: '#e74c3c',
        img: imgEtiquetas,
        isSpecial: false,
        isHerramienta: true,
        shareable: true
    },


    {
        id: 'ECUACIONES',
        name: 'Ecuaciones',
        desc: 'Despeja la X paso a paso.',
        color: '#3F51B5',
        emoji: '⚖️',
        isMath: true,
        shareable: true
    },
    { id: 'FUNCIONES', name: 'Funciones', desc: 'Características de funciones, Representación', color: '#4CAF50', emoji: '📈', isMath: true, shareable: true },
    { id: 'GEOMETRÍA_ANALÍTICA', name: 'Geometría_Analítica', desc: 'Rectas, parábolas y análisis gráfico.', color: '#4CAF50', emoji: '♐​', isMath: true, shareable: true },


    { id: 'POLINOMIOS',   name: 'Álgebra',      desc: 'Operaciones con polinomios.',              color: '#FF9800', emoji: '✖️', isMath: true, shareable: true },
    { id: 'ESTADISTICA',  name: 'Estadística',  desc: 'Tablas, parámetros y representación gráfica.', color: '#9C27B0', emoji: '📊', isMath: true, shareable: true },
    { id: 'PROBABILIDAD', name: 'Probabilidad', desc: 'Simulador de dados: tipos, múltiples dados y análisis de frecuencias.', color: '#f59e0b', emoji: '🎲', isMath: true, shareable: true },

    { id: 'STORYCUBES', name: 'Story Cubes', desc: 'Crea historias en equipo usando dados con imágenes.', color: '#8e44ad', emoji: '🎲', shareable: true },
    { id: 'RETOS', name: 'Retos', desc: 'Conecta puntos y puzzles de lógica.', color: '#f39c12', emoji: '🧩', shareable: true },
    { id: 'TRIVIAL', name: 'Trivial', desc: 'El clásico juego de preguntas por categorías para hasta 6 jugadores.', color: '#16213e', emoji: '🎯', shareable: true },

];

// --- FUNCIONES DE AYUDA PARA BÚSQUEDA INTELIGENTE ---

// Calcula la distancia de edición (cuántos cambios faltan para que sean iguales)
const levenshteinDistance = (s, t) => {
    if (!s.length) return t.length;
    if (!t.length) return s.length;
    const arr = [];
    for (let i = 0; i <= t.length; i++) {
        arr[i] = [i];
        for (let j = 1; j <= s.length; j++) {
            arr[i][j] =
                i === 0
                    ? j
                    : Math.min(
                        arr[i - 1][j] + 1,
                        arr[i][j - 1] + 1,
                        arr[i - 1][j - 1] + (s[j - 1] === t[i - 1] ? 0 : 1)
                    );
        }
    }
    return arr[t.length][s.length];
};

// Comprueba si hay coincidencia (Incluye: contiene, contenido en, o similitud > 80%)
const checkFuzzyMatch = (text, search) => {
    const t = cleanText(text);
    const s = cleanText(search);

    if (!t || !s) return false;

    // 1. Coincidencia exacta o contención (rápida)
    if (t.includes(s) || s.includes(t)) return true;

    // 2. Coincidencia difusa (80% de similitud)
    const distance = levenshteinDistance(t, s);
    const maxLength = Math.max(t.length, s.length);
    const similarity = 1 - distance / maxLength;

    return similarity >= 0.8; // Umbral del 80%
};



const FAKE_MATHLE = {
    id: 'fake-mathle',
    titulo: 'Desafío MathLe',
    tipoJuego: 'MATHLE',
    temas: 'Matemáticas',
    ciclo: 'Primaria, Secundaria, Bachillerato, Otros',
    profesorNombre: 'PiKT',
    poblacion: 'Global',
    pais: 'Global',
    accessCode: 'MATH',
    playCount: '+1000'
};
// Función Helper para detectar juegos en vivo y separar PiLive de Wordle
const esJuegoEnVivo = (r) => {
    if (r.tipoJuego === 'MATHLIVE' || r.tipoJuego === 'THINKHOOT' || r.tipoJuego === 'OLYMPICLIVE') return true;
    // Si es un PiLive antiguo (se guardaban como PRO pero NO son Wordle)
    if (r.tipo === 'PRO' && r.tipoJuego !== 'WORDLE' && r.tipoJuego !== 'MATHLIVE') return true;
    return false;
};

const getAppInfo = (tipoJuego) => {
    if (!tipoJuego) return { name: 'Recurso', color: '#999' };

    if (tipoJuego === 'CAZABURBUJAS' || tipoJuego === 'PIKATRON') {
        return { name: 'Burbujas/Pikatron', color: '#de896e' };
    }
    if (tipoJuego === 'WORDLE' || tipoJuego === 'SOPA') {
        return { name: 'Wordle / Sopa', color: '#4CAF50' };
    }


    const app = APPS.find(a => a.id === tipoJuego);
    if (app) return app;
    if (tipoJuego === 'PRO') return { name: 'PiLive', color: '#9C27B0' };
    if (tipoJuego === 'QUESTION_SENDER') return { name: 'Q-Sender', color: '#2c3e50' };
    if (tipoJuego === 'KARTINGED') return { name: 'Karting', color: '#FF6B00' };
    return { name: tipoJuego, color: '#999' };
};

// Función para limpiar textos (quitar tildes, mayúsculas y espacios extra)
const cleanText = (str) => {
    if (!str) return "";
    return String(str)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Quitar tildes
        .toLowerCase()
        .trim();
};

// ─── Modal de opciones para compartir ────────────────────────────────────────
function ShareModal({ url, titulo, onClose }) {
    const [copiado, setCopiado] = React.useState(false);

    const copiar = () => {
        navigator.clipboard.writeText(url).catch(() => {});
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
    };

    const texto = encodeURIComponent(`🔤 ${titulo}\n${url}`);

    const opciones = [
        { label: 'Copiar enlace',     icon: copiado ? '✅' : '🔗', color: '#2c3e50', bg: copiado ? '#e8f5e9' : '#f4f6f8', action: copiar },
        { label: 'WhatsApp',          icon: '💬', color: '#25D366', bg: '#e8f8ee',  action: () => window.open(`https://wa.me/?text=${texto}`, '_blank') },
        { label: 'Telegram',          icon: '✈️', color: '#0088cc', bg: '#e8f4fb',  action: () => window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(titulo)}`, '_blank') },
        { label: 'Correo',            icon: '📧', color: '#e74c3c', bg: '#fdecea',  action: () => window.open(`mailto:?subject=${encodeURIComponent(titulo)}&body=${texto}`, '_blank') },
        { label: 'Google Classroom',  icon: '🎓', color: '#1565C0', bg: '#e3f2fd',  action: () => window.open(`https://classroom.google.com/share?url=${encodeURIComponent(url)}`, '_blank') },
    ];

    return (
        <div style={{ position:'fixed', inset:0, zIndex:9000, background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={onClose}>
            <div style={{ background:'white', borderRadius:20, width:'100%', maxWidth:360, padding:24, boxShadow:'0 20px 50px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                    <h3 style={{ margin:0, color:'#2c3e50', fontSize:'1.05rem' }}>Compartir</h3>
                    <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#95a5a6', fontSize:'1.2rem', padding:4 }}>✕</button>
                </div>
                <div style={{ background:'#f4f6f8', borderRadius:10, padding:'8px 12px', fontSize:'0.75rem', color:'#7f8c8d', wordBreak:'break-all', marginBottom:16 }}>{url}</div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {opciones.map(op => (
                        <button key={op.label} onClick={op.action}
                            style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', borderRadius:12, border:`1.5px solid ${op.color}22`, background:op.bg, cursor:'pointer', textAlign:'left', fontSize:'0.93rem', fontWeight:600, color:op.color }}>
                            <span style={{ fontSize:'1.2rem', width:24, textAlign:'center' }}>{op.icon}</span>
                            {op.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function LandingGames({ onLoginRequest, onOpenQuestionSender, usuario = null }) {
    // --- AÑADE ESTA LÍNEA AQUÍ ---
    const [zonaActiva, setZonaActiva] = useState('MAIN');

    // --- AÑADE ESTE BLOQUE PARA ESCUCHAR LA URL ---
    useEffect(() => {
        const checkURL = () => {
            const path = window.location.pathname.toLowerCase().replace('/', '');
            // Detectar recurso compartido de Sopa de Letras (?sopa=ID)
            const params = new URLSearchParams(window.location.search);
            const sopaId = params.get('sopa');
            if (sopaId) {
                getDoc(doc(db, 'resources', sopaId)).then(snap => {
                    if (snap.exists()) setJuegoActivo({ id: snap.id, ...snap.data() });
                }).catch(console.error);
                return;
            }
            if (params.get('pizarra')) {
                setGestionAula(true);
                return;
            }
            const gestionParam = params.get('gestion');
            if (gestionParam) {
                setGestionAula(true);
                return;
            }
            // Física: rutas /fisica y /fisica/<slug>
            if (path === 'fisica') { setSimuladoresFisica(true); return; }
            if (path.startsWith('fisica/')) {
                const SLUG_MAP = { colisiones:'COLISIONES', planoinclinado:'PLANO_INCLINADO', tiroparabolico:'TIRO_PARABOLICO', caidalibre:'CAIDA_LIBRE', pendulo:'PENDULO', leydeohm:'LEY_OHM' };
                const key = SLUG_MAP[path.slice(7)];
                setSimuladoresFisica(true);
                if (key) setSimuladorFisicaActivo(key);
                return;
            }

            const juegoParam = params.get('juego');
            if (juegoParam) {
                if (juegoParam.toLowerCase() === 'fisica')         { setSimuladoresFisica(true); return; }
                if (juegoParam.toLowerCase() === 'geografia')      { setGeografiaApp(true);   return; }
                if (juegoParam.toLowerCase() === 'biologia')       { setBiologiaApp(true);    return; }
                if (juegoParam.toLowerCase() === 'vistas_didricas') { setVistasDidricas(true); return; }
                let tourConfig = null;
                const tcParam = params.get('tourconfig');
                if (tcParam) {
                    try { tourConfig = JSON.parse(atob(tcParam)); } catch {}
                }
                let verbInitialConfig = null;
                const vcParam = params.get('verbconfig');
                if (vcParam) {
                    try { verbInitialConfig = JSON.parse(decodeURIComponent(Array.from(atob(vcParam)).map(c=>('%'+('00'+c.charCodeAt(0).toString(16)).slice(-2))).join(''))); } catch {}
                }
                setJuegoActivo({ tipoJuego: juegoParam.toUpperCase(), tourConfig, verbInitialConfig });
                return;
            }
            const salaParam = params.get('sala');
            if (salaParam && /^\d{6}$/.test(salaParam)) {
                setPictoTabuInitCode(salaParam);
                setPictoTabuModal(true);
                return;
            }

            if (path === 'math_world') {
                setZonaActiva('MATH');
            } else if (path === '' || path === 'inicio') {
                setZonaActiva('MAIN');
            }
        };
        checkURL();
        window.addEventListener('popstate', checkURL);
        return () => window.removeEventListener('popstate', checkURL);
    }, []);



    const [modoBusqueda, setModoBusqueda] = useState('FILTROS');
    const [filtros, setFiltros] = useState({ tipoJuego: '', ciclo: '', tema: '', pais: '', region: '', poblacion: '', autor: '' });
    const [mostrarMasFiltros, setMostrarMasFiltros] = useState(false);
    const [codigo, setCodigo] = useState('');
    const [resultados, setResultados] = useState([]);
    const [buscando, setBuscando] = useState(false);

    const [juegoActivo, setJuegoActivo] = useState(null);
    const [shareModal, setShareModal] = useState(null); // { url, titulo }
    const [recursoParaElegir, setRecursoParaElegir] = useState(null);
    const [omninteractivo, setOmninteractivo] = useState(false);
    const [videoQuizz,     setVideoQuizz]     = useState(false);
    const [funcionesEjecutivas, setFuncionesEjecutivas] = useState(false);
    const [irregularVerbs,      setIrregularVerbs]      = useState(false);
    const [musicApp,            setMusicApp]            = useState(false);
    const [geografiaApp,        setGeografiaApp]        = useState(false);
    const [biologiaApp,         setBiologiaApp]         = useState(false);
    const [gestionAula,         setGestionAula]         = useState(() => { const p = new URLSearchParams(window.location.search); return !!(p.get('gestion') || p.get('pizarra')); });
    const [vistasDidricas,      setVistasDidricas]      = useState(false);
    const [simuladoresFisica,   setSimuladoresFisica]   = useState(false);
    const [simuladorFisicaActivo, setSimuladorFisicaActivo] = useState(null);

    // Estados alumno logueado
    const [vistaAlumno,    setVistaAlumno]    = useState('MAIN'); // 'MAIN' | 'RECORDS'
    const [records,        setRecords]        = useState([]);
    const [loadingRecords, setLoadingRecords] = useState(false);
    const [showPerfil,     setShowPerfil]     = useState(false);

    const cargarRecords = async () => {
        if (!usuario?.email) return;
        setLoadingRecords(true);
        try {
            const q = query(collection(db, 'ranking'), where('email', '==', usuario.email), orderBy('fecha', 'desc'));
            const snap = await getDocs(q);
            setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch(e) { console.error(e); }
        setLoadingRecords(false);
    };

    useEffect(() => {
        if (vistaAlumno === 'RECORDS') cargarRecords();
    }, [vistaAlumno]);

    const [subzonaMath, setSubzonaMath] = useState(null);

    // Estados Live Alumno
    const [liveModeAlumno, setLiveModeAlumno] = useState(false);
    const [joinLiveCode, setJoinLiveCode] = useState('');
    const [joinLiveName, setJoinLiveName] = useState('');
    const [isMathLiveAlumno, setIsMathLiveAlumno] = useState(false);
    const [joinLiveTipoJuego, setJoinLiveTipoJuego] = useState('');
    const [hostTipoJuego, setHostTipoJuego] = useState('');
    const [pictoTabuModal, setPictoTabuModal] = useState(false);
    const [pictoTabuInitCode, setPictoTabuInitCode] = useState('');
    const [joinLiveHostId, setJoinLiveHostId] = useState(null);
    // Estados Live Host (Presentador)
    const [liveModeHost, setLiveModeHost] = useState(false);
    const [hostRoomCode, setHostRoomCode] = useState('');
    const [isMathLiveHost, setIsMathLiveHost] = useState(false);

    const buscar = async () => {
        setBuscando(true);
        setResultados([]);
        const ref = collection(db, 'resources');

        try {
            if (modoBusqueda === 'CODIGO') {
                // ... (ESTA PARTE DEL CÓDIGO SE QUEDA IGUAL) ...
                const codigoLimpio = codigo.toUpperCase().trim();
                if (!codigoLimpio) { alert("Introduce un código."); setBuscando(false); return; }

                if (codigoLimpio.length === 6) {
                    const salaRef = doc(db, "live_games", codigoLimpio);
                    const salaSnap = await getDoc(salaRef);
                    if (salaSnap.exists()) {
                        const data = salaSnap.data();
                        const nombre = prompt("¡Sesión en vivo encontrada! Introduce tu nombre para entrar:");
                        if (nombre && nombre.trim() !== '') {
                            setJoinLiveCode(codigoLimpio);
                            setJoinLiveName(nombre.trim());
                            setJoinLiveTipoJuego(data.tipoJuego || '');
                            setIsMathLiveAlumno(data.config?.isMathLive === true || data.tipoJuego === 'MATHLIVE');
                            setLiveModeAlumno(true);
                        }
                    } else alert("No existe ninguna sesión en vivo con ese código.");
                    setBuscando(false);
                    return;
                }

                let q = query(ref, where("accessCode", "==", codigoLimpio));
                let snap = await getDocs(q);

                if (!snap.empty) {
                    const r = { ...snap.docs[0].data(), id: snap.docs[0].id };
                    setResultados([r]);
                } else {
                    const qSender = query(ref, where("hojasCodes", "array-contains", codigoLimpio));
                    const snapSender = await getDocs(qSender);
                    if (!snapSender.empty) {
                        // ¡ENCONTRADO!
                        // En lugar de llamar a una función externa, activamos el componente localmente
                        // Pasamos un objeto especial como 'juegoActivo' para que el render sepa qué mostrar
                        const recursoEncontrado = {
                            ...snapSender.docs[0].data(),
                            id: snapSender.docs[0].id,
                            tipoJuego: 'QUESTION_SENDER',
                            codigoInicial: codigoLimpio // ¡Pasamos el código que escribió el alumno!
                        };

                        setJuegoActivo(recursoEncontrado);
                        setBuscando(false);
                        return; // Cortamos aquí para que abra directo
                    }
                    else { alert("Código no encontrado."); }
                }

            } else {
                // --- BÚSQUEDA POR FILTROS MEJORADA ---
                const q = query(ref, orderBy("fechaCreacion", "desc"), limit(150));
                const snap = await getDocs(q);
                const raw = snap.docs.map(d => ({ ...d.data(), id: d.id }));

                const filtrados = raw.filter(r => {
                    if (r.tipoJuego === 'QUESTION_SENDER') return false;

                    const isTerminado = r.isFinished === true || r.config?.isFinished === true;
                    if (!isTerminado) return false;

                    // Filtro Tipo Juego
                    if (filtros.tipoJuego) {
                        if (filtros.tipoJuego === 'THINKHOOT') {
                            if (!esJuegoEnVivo(r) || r.tipoJuego === 'MATHLIVE') return false;
                        } else if (filtros.tipoJuego === 'CAZABURBUJAS') {
                            if (r.tipoJuego !== 'CAZABURBUJAS' && r.tipoJuego !== 'PIKATRON') return false;
                        } else if (filtros.tipoJuego === 'SOPA' || filtros.tipoJuego === 'WORDLE') {
                            if (r.tipoJuego !== 'SOPA' && r.tipoJuego !== 'WORDLE') return false;
                        } else {
                            if (r.tipoJuego !== filtros.tipoJuego) return false;
                        }
                    }

                    // --- NUEVA LÓGICA DE BÚSQUEDA DE TEMA ---
                    if (filtros.tema) {
                        const search = filtros.tema;

                        // 1. Buscar en Título
                        const matchTitulo = checkFuzzyMatch(r.titulo, search);
                        // 2. Buscar en Temas (campo texto)
                        const matchTemas = checkFuzzyMatch(r.temas, search);
                        // 3. Buscar en Nombres de Hojas (dentro del array)
                        const matchHojas = r.hojas && r.hojas.some(h => checkFuzzyMatch(h.nombreHoja, search));

                        // Si no coincide ninguno, descartamos
                        if (!matchTitulo && !matchTemas && !matchHojas) return false;
                    }
                    // ----------------------------------------

                    if (filtros.ciclo) {
                        const fc = cleanText(filtros.ciclo);
                        const matchC = Array.isArray(r.ciclo) ? r.ciclo.some(c => cleanText(c) === fc) : cleanText(r.ciclo) === fc;
                        const matchCfg = Array.isArray(r.config?.ciclo) ? r.config.ciclo.some(c => cleanText(c) === fc) : cleanText(r.config?.ciclo) === fc;
                        if (!matchC && !matchCfg) return false;
                    }
                    if (filtros.pais && !cleanText(r.pais).includes(cleanText(filtros.pais))) return false;
                    if (filtros.region && !cleanText(r.region).includes(cleanText(filtros.region))) return false;
                    if (filtros.poblacion && !cleanText(r.poblacion).includes(cleanText(filtros.poblacion))) return false;
                    if (filtros.autor && !cleanText(r.profesorNombre).includes(cleanText(filtros.autor))) return false;

                    return true;
                });

                const temaMate = cleanText(filtros.tema);
                const buscarMate = !temaMate || temaMate.includes('matematica') || temaMate.includes('mates') || temaMate.includes('calculo');
                const buscarJuego = !filtros.tipoJuego || filtros.tipoJuego === 'MATHLE';

                if (buscarMate && buscarJuego) {
                    filtrados.unshift(FAKE_MATHLE);
                }
                if (filtrados.length === 0) alert("No se encontraron recursos con esos filtros.");
                setResultados(filtrados);
            }
        } catch (e) { console.error(e); alert("Error en búsqueda."); }
        setBuscando(false);
    };
    const abrirJuego = (appId) => {


            // Si pinchan en el portal, cambiamos de pantalla y CREAMOS LA URL
        if (appId === 'MATH_WORLD_PORTAL') {
            setZonaActiva('MATH');
            window.history.pushState({}, '', '/math_world');
            return;
        }

        // Karting: lanzar directamente (la pantalla previa busca los recursos)
        if (appId === 'KARTINGED') {
            setJuegoActivo({ tipoJuego: 'KARTINGED' });
            return;
        }

        if (appId === 'KARTINGED_MULTI') {
            setJuegoActivo({ tipoJuego: 'KARTINGED_MULTI' });
            return;
        }

        if (appId === 'RACING3D') {
            setJuegoActivo({ tipoJuego: 'RACING3D' });
            return;
        }
        if (appId === 'MANSION_PITAGORICA') {
            setJuegoActivo({ tipoJuego: 'MANSION_PITAGORICA' });
            return;
        }

        if (appId === 'STORYCUBES') {
            setJuegoActivo({ tipoJuego: 'STORYCUBES' });
            return;
        }

        if (appId === 'RETOS') {
            setJuegoActivo({ tipoJuego: 'RETOS' });
            return;
        }

        if (appId === 'PROBABILIDAD') {
            setJuegoActivo({ tipoJuego: 'PROBABILIDAD' });
            return;
        }

        if (appId === 'EAE') {
            setPictoTabuModal(true);
            return;
        }

        if (appId === 'TRIVIAL') {
            window.history.pushState({}, '', '?juego=trivial');
            setJuegoActivo({ tipoJuego: 'TRIVIAL' });
            return;
        }

        const appInfo = APPS.find(a => a.id === appId);
        if (appInfo) {
            window.history.pushState({}, '', `/${appInfo.name.toLowerCase()}`);
            window.dispatchEvent(new Event('popstate'));
        }

        // Para apps de Math World (isMath), activar el juego directamente
        if (appInfo?.isMath) {
            setJuegoActivo({ tipoJuego: appId });
            return;
        }
    };

    const lanzarComoGestor = async (r, hojaForzada = null) => {
        if (!window.confirm("¿Quieres iniciar una sesión en vivo como presentador de este juego?")) return;
        try {
            const sala = Math.floor(100000 + Math.random() * 900000).toString();
            const limitePreguntas = parseInt(r.config?.numPreguntas) || 10;
            let pool = [];
            if (hojaForzada) {
                pool = hojaForzada.preguntas ? [...hojaForzada.preguntas] : [];
            } else if (r.hojas) {
                r.hojas.forEach(h => pool.push(...(h.preguntas || [])));
            }

            if (r.config?.aleatorio !== false) pool.sort(() => Math.random() - 0.5);

            if (!pool.length) return alert("El recurso no tiene preguntas válidas.");

            const pFin = pool.slice(0, limitePreguntas).map(p => {
                if (r.tipo !== 'PRO' && r.tipo !== 'OLYMPIC' && r.tipoJuego !== 'OLYMPICLIVE') {
                    return { ...p, q: p.pregunta, a: p.correcta || p.respuesta, tipo: (p.incorrectas?.length > 0) ? 'MULTIPLE' : 'SIMPLE', opcionesFijas: (p.incorrectas?.length > 0) ? [p.correcta || p.respuesta, ...p.incorrectas].sort(() => Math.random() - 0.5) : [] };
                }
                return p;
            });

            await setDoc(doc(db, "live_games", sala), {
                hostId: "host_invitado_" + Date.now(),
                recursoId: r.id || 'temp_id',
                recursoTitulo: r.titulo,
                hojaNombre: hojaForzada ? (hojaForzada.nombreHoja || hojaForzada.nombre || '') : '',
                profesorNombre: "Profe Invitado",
                config: r.config || {},
                preguntas: pFin,
                estado: 'LOBBY',
                indicePregunta: 0,
                jugadores: {},
                respuestasRonda: {},
                timestamp: new Date(),
                tipoJuego: r.tipoJuego
            });

            setHostRoomCode(sala);
            setIsMathLiveHost(r.config?.isMathLive === true || r.tipoJuego === 'MATHLIVE');
            setHostTipoJuego(r.tipoJuego);
            setLiveModeHost(true);
        } catch (error) {
            console.error("Error lanzando host:", error);
            alert("Hubo un error al crear la sala.");
        }
    };

    const procesarClickTarjeta = (r) => {
        if (esJuegoEnVivo(r)) lanzarComoGestor(r);
        else if (r.tipoJuego === 'CAZABURBUJAS' || r.tipoJuego === 'PIKATRON' || r.tipoJuego === 'WORDLE' || r.tipoJuego === 'SOPA') setRecursoParaElegir(r);
        else if (r.tipoJuego === 'ETIQUETAS') setJuegoActivo(r);
        else if (r.tipoJuego === 'KARTINGED') setJuegoActivo(r);
        else setJuegoActivo(r);
    };

    // --- RENDERIZADO DE JUEGOS A PANTALLA COMPLETA ---

    // 1. Host (Profesor/Gestor)
    if (liveModeHost && hostRoomCode) {
        const tempUser = usuario || { uid: "host_invitado_" + Date.now(), displayName: "Profe Invitado", email: null };
        // --- CORRECCIÓN: USAMOS EL ESTADO ---
        if (hostTipoJuego === 'OLYMPICLIVE') return <OlympicLive isHost={true} codigoSala={hostRoomCode} usuario={tempUser} onExit={() => setLiveModeHost(false)} />;
        // ------------------------------------

        if (isMathLiveHost) return <MathLive isHost={true} codigoSala={hostRoomCode} usuario={tempUser} onExit={() => setLiveModeHost(false)} />;
        if (hostTipoJuego === 'EAE') return <ExpresionArtEscri isHost={true} codigoSala={hostRoomCode} usuario={tempUser} onExit={() => setLiveModeHost(false)} />;
        return <ThinkHootGame isHost={true} codigoSala={hostRoomCode} usuario={tempUser} onExit={() => setLiveModeHost(false)} />;
    }
    if (liveModeAlumno) {
        // Usamos la verdad absoluta de la base de datos, o el de la app si no está
        const tipoFinal = (typeof joinLiveTipoJuego !== 'undefined' && joinLiveTipoJuego) ? joinLiveTipoJuego : (typeof appData !== 'undefined' ? appData.id : '');

        if (tipoFinal === 'OLYMPICLIVE') return <OlympicLive isHost={false} codigoSala={typeof joinCode !== 'undefined' ? joinCode : joinLiveCode} usuario={{ displayName: typeof joinName !== 'undefined' ? joinName : joinLiveName, email: null }} onExit={() => setLiveModeAlumno(false)} />;
        if (tipoFinal === 'MATHLIVE' || isMathLiveAlumno) return <MathLive isHost={false} codigoSala={typeof joinCode !== 'undefined' ? joinCode : joinLiveCode} usuario={{ displayName: typeof joinName !== 'undefined' ? joinName : joinLiveName, email: null }} onExit={() => setLiveModeAlumno(false)} />;
        if (tipoFinal === 'EAE') return <ExpresionArtEscri isHost={false} codigoSala={joinLiveCode} usuario={{ uid: joinLiveHostId || null, displayName: joinLiveName, email: null }} onExit={() => { setLiveModeAlumno(false); setJoinLiveHostId(null); }} />;

        return <ThinkHootGame isHost={false} codigoSala={typeof joinCode !== 'undefined' ? joinCode : joinLiveCode} usuario={{ displayName: typeof joinName !== 'undefined' ? joinName : joinLiveName, email: null }} onExit={() => setLiveModeAlumno(false)} />;
    }

    
    if (videoQuizz) return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, overflowY: 'auto' }}>
            <VideoQuizzApp onBack={() => setVideoQuizz(false)} />
        </div>
    );

    if (funcionesEjecutivas) return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, overflowY: 'auto' }}>
            <FuncionesEjecutivas onBack={() => setFuncionesEjecutivas(false)} />
        </div>
    );

    if (irregularVerbs) return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#0f0f1a', overflowY: 'auto' }}>
            <button onClick={() => setIrregularVerbs(false)} style={{ position: 'fixed', top: 14, left: 14, zIndex: 10000, background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}>
                ← Volver
            </button>
            <IrregularVerbsTest />
        </div>
    );

    if (musicApp || juegoActivo?.tipoJuego === 'MUSICA') return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, overflowY: 'auto' }}>
            <MusicApp onBack={() => { setMusicApp(false); setJuegoActivo(null); }} usuario={usuario} />
        </div>
    );

    if (geografiaApp) return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, overflowY: 'auto' }}>
            <GeografiaApp onBack={() => setGeografiaApp(false)} />
        </div>
    );

    if (biologiaApp) return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, overflowY: 'auto' }}>
            <BiologiaApp onBack={() => setBiologiaApp(false)} />
        </div>
    );

    if (gestionAula) return (
        <HerramientasClase onExit={() => setGestionAula(false)} />
    );

    if (vistasDidricas) return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, overflowY: 'auto' }}>
            <VistasDidricas onBack={() => setVistasDidricas(false)} />
        </div>
    );

    if (simuladoresFisica) {
        const SIMS = [
            { key: 'COLISIONES',      slug: 'colisiones',      label: 'Colisiones',       emoji: '💥', color: '#e74c3c', desc: 'Colisiones elásticas e inelásticas',  comp: SimuladorColisiones },
            { key: 'PLANO_INCLINADO', slug: 'planoinclinado',  label: 'Plano Inclinado',  emoji: '📐', color: '#3498db', desc: 'Fuerzas en planos inclinados',          comp: SimuladorPlanoInclinado },
            { key: 'TIRO_PARABOLICO', slug: 'tiroparabolico',  label: 'Tiro Parabólico',  emoji: '🏹', color: '#27ae60', desc: 'Movimiento parabólico de proyectiles', comp: SimuladorTiroParabolico },
            { key: 'CAIDA_LIBRE',     slug: 'caidalibre',      label: 'Caída Libre',      emoji: '⬇️', color: '#9b59b6', desc: 'Caída libre y gravedad',               comp: SimuladorCaidaLibre },
            { key: 'PENDULO',         slug: 'pendulo',         label: 'Péndulo',          emoji: '⏱️', color: '#f39c12', desc: 'Oscilaciones del péndulo simple',      comp: SimuladorPendulo },
            { key: 'LEY_OHM',         slug: 'leydeohm',        label: 'Ley de Ohm',       emoji: '⚡', color: '#1abc9c', desc: 'Circuitos y ley de Ohm',              comp: SimuladorLeyDeOhm },
        ];

        const volverAlMenu = () => { setSimuladorFisicaActivo(null); window.history.pushState({}, '', '/fisica'); };
        const volverAlInicio = () => { setSimuladoresFisica(false); window.history.pushState({}, '', '/'); };
        const abrirSim = (sim) => { setSimuladorFisicaActivo(sim.key); window.history.pushState({}, '', `/fisica/${sim.slug}`); };

        if (simuladorFisicaActivo) {
            const sim = SIMS.find(s => s.key === simuladorFisicaActivo);
            const Comp = sim?.comp;
            const simUrl = `${window.location.origin}/fisica/${sim?.slug}`;
            return (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999, overflowY: 'auto', background: '#0f0f1a' }}>
                    <div style={{ position: 'fixed', top: 12, left: 12, zIndex: 10001, display: 'flex', gap: 8 }}>
                        <button onClick={volverAlMenu} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, padding: '8px 16px', color: 'white', cursor: 'pointer', fontWeight: 700, backdropFilter: 'blur(6px)' }}>
                            ← Volver
                        </button>
                        <button onClick={() => setShareModal({ url: simUrl, titulo: sim?.label })} title={simUrl} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, padding: '8px 12px', color: 'white', cursor: 'pointer', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.85rem' }}>
                            <Share2 size={14}/> Compartir
                        </button>
                    </div>
                    {Comp && <Comp />}
                    {shareModal && <ShareModal url={shareModal.url} titulo={shareModal.titulo} onClose={() => setShareModal(null)} />}
                </div>
            );
        }

        return (
            <div style={{ position: 'fixed', inset: 0, zIndex: 9999, overflowY: 'auto', background: 'linear-gradient(135deg,#0f0f1a,#1a1a3e)', padding: '40px 20px' }}>
                <div style={{ maxWidth: 700, margin: '0 auto' }}>
                    <button onClick={volverAlInicio} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, padding: '8px 18px', color: 'white', cursor: 'pointer', fontWeight: 700, marginBottom: 30 }}>
                        ← Volver
                    </button>
                    <div style={{ textAlign: 'center', marginBottom: 36 }}>
                        <div style={{ fontSize: 64 }}>🔭</div>
                        <h1 style={{ color: 'white', fontSize: '2.2rem', margin: '8px 0 6px' }}>Simuladores de Física</h1>
                        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1rem' }}>Selecciona un simulador para empezar</p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 20 }}>
                        {SIMS.map(sim => {
                            const simUrl = `${window.location.origin}/fisica/${sim.slug}`;
                            return (
                                <div key={sim.key} style={{ position: 'relative' }}>
                                    <button
                                        onClick={e => { e.stopPropagation(); setShareModal({ url: simUrl, titulo: sim.label }); }}
                                        title={simUrl}
                                        style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 7, padding: '4px 7px', cursor: 'pointer', color: sim.color, display: 'flex', alignItems: 'center' }}
                                    >
                                        <Share2 size={13}/>
                                    </button>
                                    <div
                                        onClick={() => abrirSim(sim)}
                                        style={{ background: 'rgba(255,255,255,0.07)', border: `2px solid ${sim.color}55`, borderRadius: 16, padding: '28px 16px', textAlign: 'center', cursor: 'pointer', transition: 'transform 0.2s, background 0.2s', height: '100%', boxSizing: 'border-box' }}
                                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.background = `${sim.color}22`; }}
                                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
                                    >
                                        <div style={{ fontSize: 44, marginBottom: 10 }}>{sim.emoji}</div>
                                        <h3 style={{ color: sim.color, margin: '0 0 6px', fontSize: '1rem', fontWeight: 800 }}>{sim.label}</h3>
                                        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem', margin: 0 }}>{sim.desc}</p>
                                        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.7rem', margin: '8px 0 0', fontFamily: 'monospace' }}>pikt.es/fisica/{sim.slug}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                {shareModal && <ShareModal url={shareModal.url} titulo={shareModal.titulo} onClose={() => setShareModal(null)} />}
            </div>
        );
    }

    if (omninteractivo) return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#F8FAFC', overflowY: 'auto' }}>
            <OmninteractiveApp onBack={() => setOmninteractivo(false)} />
        </div>
    );

    // 3. Single Player
    if (juegoActivo) {
        if (juegoActivo.tipoJuego === 'QUESTION_SENDER') {
            return (
                <QuestionSenderClient
                    usuario={usuario}
                    onBack={() => setJuegoActivo(null)}
                    codigoInicial={juegoActivo.codigoInicial}
                />
            );
        }

        if (juegoActivo.tipoJuego === 'ETIQUETAS') return <EtiquetaMe recurso={juegoActivo} onExit={() => setJuegoActivo(null)} />;

        if (juegoActivo.tipoJuego === 'GEOMETRIX') return <Geometrix usuario={usuario} onExit={() => setJuegoActivo(null)} />;
        if (juegoActivo.tipoJuego === 'CALCULO') return <CalculoMental usuario={usuario} onExit={() => setJuegoActivo(null)} />;
        if (juegoActivo.tipoJuego === 'OCA') return <OcaMatematicaDirect onExit={() => setJuegoActivo(null)} />;
        if (juegoActivo.tipoJuego === 'DOMINO') return <DominoMatematicoDirect onExit={() => setJuegoActivo(null)} />;
        if (juegoActivo.tipoJuego === 'ECUACIONES') return <Ecuaciones usuario={usuario} onExit={() => setJuegoActivo(null)} />;
        if (juegoActivo.tipoJuego === 'FUNCIONES') return <Funciones onExit={() => setJuegoActivo(null)} />;
        if (juegoActivo.tipoJuego === 'GEOMETRÍA_ANALÍTICA') return <GeometriaAnalitica onExit={() => setJuegoActivo(null)} />;
        if (juegoActivo.tipoJuego === 'POLINOMIOS')  return <AlgebraApp      usuario={usuario} onExit={() => setJuegoActivo(null)} />;
        if (juegoActivo.tipoJuego === 'ESTADISTICA') return <EstadisticaApp  usuario={usuario} onExit={() => setJuegoActivo(null)} />;
        if (juegoActivo.tipoJuego === 'PROBABILIDAD') return <SimuladorDados onExit={() => setJuegoActivo(null)} />;
        if (juegoActivo.tipoJuego === 'MATES_OAOA') return (
            <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#f0faf9', overflowY: 'auto' }}>
                <button onClick={() => setJuegoActivo(null)} style={{ position: 'fixed', top: 14, left: 14, zIndex: 10000, background: '#009688', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}>← Volver</button>
                <SimuladorOAOA />
            </div>
        );
        if (juegoActivo.tipoJuego === 'FERIA_MATES') return (
            <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#fff8f0', overflowY: 'auto' }}>
                <button onClick={() => setJuegoActivo(null)} style={{ position: 'fixed', top: 14, left: 14, zIndex: 10000, background: '#e67e22', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}>← Volver</button>
                <JuegoFeriaOAOA primaria={!!juegoActivo.primaria} />
            </div>
        );
        if (juegoActivo.tipoJuego === 'DIVISIBILIDAD') return (
            <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#F3E5F5', overflowY: 'auto' }}>
                <button onClick={() => setJuegoActivo(null)} style={{ position: 'fixed', top: 14, left: 14, zIndex: 10000, background: '#7B1FA2', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}>← Volver</button>
                <JuegoDivisibilidad />
            </div>
        );

        if (juegoActivo.tipoJuego === 'SINTAXIS')    return <SintaxisGame  usuario={usuario} onExit={() => setJuegoActivo(null)} />;
        if (juegoActivo.tipoJuego === 'LISTENING')   return <Listening     usuario={usuario} onExit={() => setJuegoActivo(null)} />;
        if (juegoActivo.tipoJuego === 'STORYCUBES')  return <StoryCubes    usuario={usuario} onExit={() => setJuegoActivo(null)} />;
        if (juegoActivo.tipoJuego === 'RETOS')        return <RetosApp                        onExit={() => setJuegoActivo(null)} />;
        if (juegoActivo.tipoJuego === 'SOLAR_SYSTEM') return <SolarSystemViewer recursoConfig={juegoActivo.tourConfig || null} onExit={() => setJuegoActivo(null)} />;
        if (juegoActivo.tipoJuego === 'IRREGULAR_VERBS') return (
            <div style={{ position:'fixed', inset:0, zIndex:9999, background:'#0f0f1a', overflowY:'auto' }}>
                <button onClick={() => setJuegoActivo(null)} style={{ position:'fixed', top:14, left:14, zIndex:10000, background:'rgba(255,255,255,0.1)', color:'white', border:'none', borderRadius:8, padding:'8px 16px', cursor:'pointer', fontWeight:700, fontSize:'0.9rem' }}>← Volver</button>
                <IrregularVerbsTest initialConfig={juegoActivo.verbInitialConfig || null} />
            </div>
        );
        if (juegoActivo.tipoJuego === 'KARTINGED') return <KartingedGame usuario={usuario} alTerminar={() => setJuegoActivo(null)} />;
        if (juegoActivo.tipoJuego === 'KARTINGED_MULTI') return <KartingedMultiGame alTerminar={() => setJuegoActivo(null)} />;
        if (juegoActivo.tipoJuego === 'RACING3D') return <RacingGame3D usuario={usuario} alTerminar={() => setJuegoActivo(null)} />;
        if (juegoActivo.tipoJuego === 'MANSION_PITAGORICA') return <MansionPitagoricaGame alTerminar={() => setJuegoActivo(null)} />;
        if (juegoActivo.tipoJuego === 'TRIVIAL') {
            const salirTrivial = () => {
                window.history.pushState({}, '', window.location.pathname);
                setJuegoActivo(null);
            };
            if (juegoActivo.usarBuscador) {
                return <GamePlayer recurso={{ tipoJuego: 'TRIVIAL', ...juegoActivo }} usuario={usuario} alTerminar={salirTrivial} />;
            }
            return <TrivialGame
                onExit={salirTrivial}
                onBuscar={() => setJuegoActivo(prev => ({ ...prev, usarBuscador: true }))}
            />;
        }
        if (juegoActivo.modoEspecial === 'PIKATRON') return <PikatronRun recurso={juegoActivo} onExit={() => setJuegoActivo(null)} />;
        if (juegoActivo.modoEspecial === 'PLATAFORMAS') return <Plataformas onExit={() => setJuegoActivo(null)} recursoInicial={juegoActivo} />;
        if (juegoActivo.tipoJuego === 'RULETA') return <RuletaGame recurso={juegoActivo} usuario={usuario} alTerminar={() => setJuegoActivo(null)} />;

        if (juegoActivo.tipoJuego === 'MATHLE') return <MathWordleGame usuario={usuario} onExit={() => setJuegoActivo(null)} />;
        if (juegoActivo.modoEspecial === 'WORDLE' || (juegoActivo.tipoJuego === 'WORDLE' && !juegoActivo.modoEspecial)) return <TextWordleGame recursoInicial={juegoActivo} usuario={usuario} onExit={() => setJuegoActivo(null)} />;
        if (juegoActivo.modoEspecial === 'SOPA' || (juegoActivo.tipoJuego === 'SOPA' && !juegoActivo.modoEspecial)) return <SopaDeLetrasGame recurso={juegoActivo} usuario={usuario} onExit={() => setJuegoActivo(null)} />;

        return <GamePlayer recurso={juegoActivo} usuario={usuario} alTerminar={() => setJuegoActivo(null)} />;
    }

    // --- PANTALLA EXCLUSIVA MATH WORLD ---
    if (zonaActiva === 'MATH') {
        // Subvista: Primaria
        if (subzonaMath === 'PRIMARIA') {
            return (
                <div style={{ width: '100%', marginTop: '20px' }}>
                    <button onClick={() => setSubzonaMath(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#333', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '20px', fontWeight: 'bold' }}>
                        <Home size={20} /> Volver a Math World
                    </button>
                    <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                        <div style={{ fontSize: '70px', marginBottom: '10px' }}>🏫</div>
                        <h1 style={{ color: '#009688', fontSize: '3rem', margin: 0, textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>Primaria</h1>
                        <p style={{ color: '#666', fontSize: '1.2rem', marginTop: '10px' }}>Juegos de cálculo para primaria</p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '25px', maxWidth: '860px', margin: '0 auto', paddingBottom: '40px' }}>
                        <div
                            onClick={() => setJuegoActivo({ tipoJuego: 'MATES_OAOA' })}
                            style={{ background: '#E0F2F1', borderRadius: '20px', padding: '30px 20px', textAlign: 'center', cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,0,0,0.1)', transition: 'transform 0.2s', border: '3px solid #009688' }}
                            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            <div style={{ fontSize: '50px', marginBottom: '15px' }}>🧮</div>
                            <h3 style={{ margin: '0 0 10px 0', color: '#009688', fontSize: '1.4rem' }}>Método OAOA</h3>
                            <p style={{ margin: 0, color: '#666', fontSize: '0.95rem' }}>Aprende las 4 operaciones básicas paso a paso con algoritmos abiertos.</p>
                        </div>
                        <div
                            onClick={() => setJuegoActivo({ tipoJuego: 'FERIA_MATES', primaria: true })}
                            style={{ background: '#FFF3E0', borderRadius: '20px', padding: '30px 20px', textAlign: 'center', cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,0,0,0.1)', transition: 'transform 0.2s', border: '3px solid #e67e22' }}
                            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            <div style={{ fontSize: '50px', marginBottom: '15px' }}>🎡</div>
                            <h3 style={{ margin: '0 0 10px 0', color: '#e67e22', fontSize: '1.4rem' }}>Feria del Cálculo</h3>
                            <p style={{ margin: 0, color: '#666', fontSize: '0.95rem' }}>¡Supera operaciones al estilo OAOA antes de que se acabe el tiempo!</p>
                        </div>
                        <div
                            onClick={() => setJuegoActivo({ tipoJuego: 'DIVISIBILIDAD' })}
                            style={{ background: '#F3E5F5', borderRadius: '20px', padding: '30px 20px', textAlign: 'center', cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,0,0,0.1)', transition: 'transform 0.2s', border: '3px solid #7B1FA2' }}
                            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            <div style={{ fontSize: '50px', marginBottom: '15px' }}>🔢</div>
                            <h3 style={{ margin: '0 0 10px 0', color: '#7B1FA2', fontSize: '1.4rem' }}>Divisibilidad</h3>
                            <p style={{ margin: 0, color: '#666', fontSize: '0.95rem' }}>Primos, múltiplos, divisores y la criba de Eratóstenes.</p>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div style={{ width: '100%', marginTop: '20px' }}>
                {/* Botón Volver Modificado */}
                <button onClick={() => {
                    setZonaActiva('MAIN');
                    setSubzonaMath(null);
                    window.history.pushState({}, '', '/');
                    window.dispatchEvent(new Event('popstate'));
                }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#333', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '20px', fontWeight: 'bold' }}>
                    <Home size={20} /> Volver al Menú Principal
                </button>

                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <div style={{ fontSize: '70px', marginBottom: '10px' }}>🌍</div>
                    <h1 style={{ color: '#009688', fontSize: '3rem', margin: 0, textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>Math World</h1>
                    <p style={{ color: '#666', fontSize: '1.2rem', marginTop: '10px' }}>Tu ecosistema de herramientas matemáticas</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '25px', maxWidth: '900px', margin: '0 auto', paddingBottom: '40px' }}>
                    {/* Tarjeta Primaria */}
                    <div
                        onClick={() => setSubzonaMath('PRIMARIA')}
                        style={{ background: '#E8F5E9', borderRadius: '20px', padding: '30px 20px', textAlign: 'center', cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,0,0,0.1)', transition: 'transform 0.2s', border: '3px solid #4CAF50' }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        <div style={{ fontSize: '50px', marginBottom: '15px' }}>🏫</div>
                        <h3 style={{ margin: '0 0 10px 0', color: '#4CAF50', fontSize: '1.4rem' }}>Primaria</h3>
                        <p style={{ margin: 0, color: '#666', fontSize: '0.95rem' }}>Juegos de cálculo: Método OAOA y Feria del Cálculo.</p>
                    </div>

                    {APPS.filter(app => app.isMath).map(app => {
                        if (app.id === 'CALCULO') return (
                            <div key={app.id} style={{
                                background: '#E0F2F1', borderRadius: '20px', padding: '22px 18px',
                                boxShadow: '0 8px 20px rgba(0,0,0,0.1)', border: `3px solid ${app.color}`,
                                display: 'flex', flexDirection: 'column', gap: 10,
                            }}>
                                <div style={{ textAlign: 'center', marginBottom: 4 }}>
                                    <div style={{ fontSize: '44px', marginBottom: '8px' }}>🧠</div>
                                    <h3 style={{ margin: '0 0 6px 0', color: app.color, fontSize: '1.3rem' }}>Cálculo</h3>
                                    <p style={{ margin: 0, color: '#666', fontSize: '0.88rem' }}>{app.desc}</p>
                                </div>
                                <button
                                    onClick={() => abrirJuego('CALCULO')}
                                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
                                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                    style={{ border: 'none', borderRadius: 12, padding: '11px 0', cursor: 'pointer', fontWeight: 800, fontSize: '0.95rem', background: app.color, color: 'white', transition: 'transform 0.15s', boxShadow: `0 4px 12px ${app.color}55` }}>
                                    🧠 Cálculo Mental
                                </button>
                                <button
                                    onClick={() => setJuegoActivo({ tipoJuego: 'FERIA_MATES' })}
                                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
                                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                    style={{ border: 'none', borderRadius: 12, padding: '11px 0', cursor: 'pointer', fontWeight: 800, fontSize: '0.95rem', background: '#e67e22', color: 'white', transition: 'transform 0.15s', boxShadow: '0 4px 12px rgba(230,126,34,0.45)' }}>
                                    🎡 Feria del Cálculo
                                </button>
                            </div>
                        );
                        return (
                            <div
                                key={app.id}
                                onClick={() => {
                                    if (app.comingSoon) alert(`¡${app.name} está en desarrollo y llegará muy pronto! 🚀`);
                                    else abrirJuego(app.id);
                                }}
                                style={{
                                    background: app.comingSoon ? '#f8f9fa' : '#E0F2F1',
                                    borderRadius: '20px', padding: '30px 20px', textAlign: 'center',
                                    cursor: app.comingSoon ? 'not-allowed' : 'pointer',
                                    boxShadow: '0 8px 20px rgba(0,0,0,0.1)', transition: 'transform 0.2s',
                                    opacity: app.comingSoon ? 0.7 : 1, border: `3px solid ${app.comingSoon ? '#ddd' : app.color}`
                                }}
                            >
                                <div style={{ fontSize: '50px', marginBottom: '15px', filter: app.comingSoon ? 'grayscale(100%)' : 'none' }}>{app.emoji}</div>
                                <h3 style={{ margin: '0 0 10px 0', color: app.comingSoon ? '#7f8c8d' : app.color, fontSize: '1.4rem' }}>{app.name}</h3>
                                <p style={{ margin: 0, color: '#666', fontSize: '0.95rem' }}>{app.desc}</p>
                                {app.comingSoon && <span style={{ display: 'inline-block', marginTop: '15px', background: '#e0e0e0', color: '#555', padding: '5px 12px', borderRadius: '15px', fontSize: '0.8rem', fontWeight: 'bold' }}>Próximamente</span>}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }


    // Vista perfil
    if (showPerfil && usuario) return (
        <UserProfile usuario={usuario} onClose={() => setShowPerfil(false)} showSupport={false} />
    );

    // Vista récords
    if (usuario && vistaAlumno === 'RECORDS') {
        const fmtFecha = (f) => f?.toDate ? f.toDate().toLocaleDateString('es-ES') : (f ? new Date(f).toLocaleDateString('es-ES') : '—');
        const medalFor = (r) => {
            if (r._rank === 1 || r.rank === 1) return '🥇';
            if (r._rank === 2 || r.rank === 2) return '🥈';
            if (r._rank === 3 || r.rank === 3) return '🥉';
            return null;
        };
        return (
            <div style={{ width:'100%', padding:'20px', maxWidth:700, margin:'0 auto' }}>
                {showPerfil && <UserProfile usuario={usuario} onClose={() => setShowPerfil(false)} showSupport={false} />}
                <button onClick={() => setVistaAlumno('MAIN')} style={{ background:'none', border:'none', cursor:'pointer', color:'#2c3e50', fontWeight:'bold', marginBottom:16, display:'flex', alignItems:'center', gap:6 }}>
                    ← Volver
                </button>
                <h2 style={{ color:'#2c3e50', marginBottom:20 }}>📊 Mis Récords</h2>
                {loadingRecords ? (
                    <div style={{ textAlign:'center', padding:40, color:'#7f8c8d' }}>Cargando...</div>
                ) : records.length === 0 ? (
                    <div style={{ textAlign:'center', padding:40, color:'#7f8c8d' }}>No tienes récords todavía. ¡Juega para aparecer aquí!</div>
                ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                        {records.map((r, i) => {
                            const medal = medalFor(r);
                            const pts = r.aciertos ?? r.puntuacion ?? '—';
                            return (
                                <div key={r.id || i} style={{ display:'flex', alignItems:'center', gap:12, background:'white', borderRadius:12, padding:'12px 16px', boxShadow:'0 2px 8px rgba(0,0,0,0.07)' }}>
                                    <div style={{ fontSize:'1.5rem', minWidth:32, textAlign:'center' }}>{medal || '🎮'}</div>
                                    <div style={{ flex:1, minWidth:0 }}>
                                        <div style={{ fontWeight:700, color:'#2c3e50', fontSize:'0.95rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                            {r.recursoTitulo || r.titulo || 'Juego'}
                                        </div>
                                        <div style={{ fontSize:'0.78rem', color:'#7f8c8d' }}>{r.tipoJuego || r.juego || '—'} · {fmtFecha(r.fecha)}</div>
                                    </div>
                                    <div style={{ fontWeight:800, color:'#2c3e50', fontSize:'1.1rem' }}>{pts}</div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div style={{ width: '100%', marginTop: '20px' }}>

            {/* MODAL ELEGIR MODO BURBUJAS/PIKATRON */}
            {recursoParaElegir && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 5000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ background: 'white', padding: '30px', borderRadius: '20px', textAlign: 'center', maxWidth: '400px', width: '90%' }}>
                        <h2 style={{ color: '#2c3e50', margin: '0 0 20px 0' }}>🚀 ¡Elige tu aventura!</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {(recursoParaElegir.tipoJuego === 'CAZABURBUJAS' || recursoParaElegir.tipoJuego === 'PIKATRON') ? (
                                <>
                                    <button onClick={() => { setJuegoActivo({ ...recursoParaElegir, modoEspecial: 'CAZABURBUJAS' }); setRecursoParaElegir(null); }} style={{ padding: '15px', background: '#E91E63', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 'bold' }}>🔵 Cazaburbujas Clásico</button>
                                    <button onClick={() => { setJuegoActivo({ ...recursoParaElegir, modoEspecial: 'PIKATRON' }); setRecursoParaElegir(null); }} style={{ padding: '15px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 'bold' }}>⚡ Pikatron Run (Runner)</button>
                                    <button onClick={() => { setJuegoActivo({ ...recursoParaElegir, modoEspecial: 'PLATAFORMAS' }); setRecursoParaElegir(null); }} style={{ padding: '15px', background: '#8e44ad', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 'bold' }}>🕹️ Plataformas</button>
                                </>
                            ) : (
                                    <>
                                        {/* OPCIONES DE WORDLE Y SOPA */}
                                        <button onClick={() => { setJuegoActivo({ ...recursoParaElegir, modoEspecial: 'WORDLE' }); setRecursoParaElegir(null); }} style={{ padding: '15px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 'bold' }}>🟩 Wordle Clásico</button>
                                        <button onClick={() => { setJuegoActivo({ ...recursoParaElegir, modoEspecial: 'SOPA' }); setRecursoParaElegir(null); }} style={{ padding: '15px', background: '#FF9800', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 'bold' }}>🔍 Sopa de Letras</button>
                                    </>
                                )}
                            <button onClick={() => setRecursoParaElegir(null)} style={{ marginTop: '10px', background: 'transparent', border: 'none', color: '#999', cursor: 'pointer' }}>Cancelar</button>
                        </div>
                    </div>
                </div>
            )}

            {shareModal && <ShareModal url={shareModal.url} titulo={shareModal.titulo} onClose={() => setShareModal(null)} />}
            {showPerfil && usuario && <UserProfile usuario={usuario} onClose={() => setShowPerfil(false)} showSupport={false} />}
            {pictoTabuModal && <PictoTabuModal
                usuario={usuario}
                initialCode={pictoTabuInitCode}
                onClose={() => { setPictoTabuModal(false); setPictoTabuInitCode(''); }}
                onEnterRoom={(code, name, hostId) => {
                    setJoinLiveCode(code);
                    setJoinLiveName(name);
                    setJoinLiveHostId(hostId || null);
                    setJoinLiveTipoJuego('EAE');
                    setLiveModeAlumno(true);
                    setPictoTabuModal(false);
                    setPictoTabuInitCode('');
                }}
            />}

            {/* BARRA DE USUARIO LOGUEADO */}
            {usuario && (
                <div style={{ display:'flex', alignItems:'center', gap:10, background:'rgba(255,255,255,0.15)', backdropFilter:'blur(8px)', borderRadius:14, padding:'8px 16px', marginBottom:16, flexWrap:'wrap' }}>
                    {usuario.photoURL && <img src={usuario.photoURL} alt="avatar" style={{ width:34, height:34, borderRadius:'50%', border:'2px solid rgba(255,255,255,0.6)' }} />}
                    <span style={{ color:'white', fontWeight:700, fontSize:'0.9rem', flex:1 }}>{usuario.displayName}</span>
                    <button onClick={() => setVistaAlumno('RECORDS')}
                        style={{ background:'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,0.35)', color:'white', borderRadius:10, padding:'6px 14px', cursor:'pointer', fontWeight:600, fontSize:'0.82rem', display:'flex', alignItems:'center', gap:5 }}>
                        📊 Mis Récords
                    </button>
                    <button onClick={() => setShowPerfil(true)}
                        style={{ background:'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,0.35)', color:'white', borderRadius:10, padding:'6px 14px', cursor:'pointer', fontWeight:600, fontSize:'0.82rem', display:'flex', alignItems:'center', gap:5 }}>
                        👤 Mi Perfil
                    </button>
                </div>
            )}

            {/* BUSCADOR PRINCIPAL (MÁS ANCHO) */}
            <div style={{ background: 'rgba(255,255,255,0.95)', padding: '30px', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', marginBottom: '30px', maxWidth: '900px', margin: '0 auto 30px auto' }}>
                <h3 style={{ margin: '0 0 20px 0', color: '#333', textAlign: 'center' }}><Search size={20} style={{ verticalAlign: 'middle' }} /> Encuentra un Recurso</h3>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '20px' }}>
                    <button onClick={() => setModoBusqueda('FILTROS')} style={{ padding: '10px 20px', borderRadius: '20px', border: 'none', background: modoBusqueda === 'FILTROS' ? '#f1c40f' : '#eee', fontWeight: 'bold', cursor: 'pointer' }}><Filter size={16} /> Filtros</button>
                    <button onClick={() => setModoBusqueda('CODIGO')} style={{ padding: '10px 20px', borderRadius: '20px', border: 'none', background: modoBusqueda === 'CODIGO' ? '#f1c40f' : '#eee', fontWeight: 'bold', cursor: 'pointer' }}><Key size={16} /> Código</button>
                </div>

                {modoBusqueda === 'CODIGO' ? (
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '15px' }}>Si tienes un código de 6 números es una sesión en vivo. Si tiene 4 o 5 letras, es un juego.</p>
                        <input placeholder="Ej: A1B2C o 123456" value={codigo} onChange={e => setCodigo(e.target.value)} style={{ padding: '15px', fontSize: '1.5rem', textAlign: 'center', borderRadius: '10px', border: '2px solid #ddd', width: '100%', maxwidth:'250px', textTransform: 'uppercase', letterSpacing: '3px' }} maxLength={6} />
                    </div>
                ) : (
                        <div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                                <select style={styles.input} value={filtros.tipoJuego} onChange={e => setFiltros({ ...filtros, tipoJuego: e.target.value })}>
                                    <option value="">📂 Todos los Juegos</option>
                                    <option value="PASAPALABRA">Pasapalabra</option>
                                    <option value="CAZABURBUJAS">Burbujas/Pikatron</option>
                                    <option value="APAREJADOS">Aparejados</option>
                                    <option value="RULETA">La Ruleta</option>
                                    <option value="SOPA">Sopa de Letras</option>

                                    <option value="WORDLE">WordLe</option>
                                    <option value="THINKHOOT">📡 Live (En Vivo)</option>
                                </select>
                                <select style={styles.input} value={filtros.ciclo} onChange={e => setFiltros({ ...filtros, ciclo: e.target.value })}>
                                    <option value="">🎓 Cualquier Ciclo</option>
                                    <option value="Infantil">Infantil</option>
                                    <option value="Primaria">Primaria</option>
                                    <option value="Secundaria">Secundaria</option>
                                    <option value="Bachillerato">Bachillerato</option>
                                    <option value="FP">FP</option>
                                    <option value="Otros">Otros</option>
                                </select>
                                <input style={styles.input} placeholder="Tema (Ej: Mates...)" value={filtros.tema} onChange={e => setFiltros({ ...filtros, tema: e.target.value })} />
                            </div>

                            {/* BOTÓN MÁS FILTROS */}
                            <div style={{ textAlign: 'right', marginTop: '10px' }}>
                                <button onClick={() => setMostrarMasFiltros(!mostrarMasFiltros)} style={{ background: 'none', border: 'none', color: '#2196F3', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px', width: '100%' }}>
                                    {mostrarMasFiltros ? <ChevronUp size={16} /> : <ChevronDown size={16} />} {mostrarMasFiltros ? 'Menos filtros' : 'Más filtros (País, Autor...)'}
                                </button>
                            </div>

                            {mostrarMasFiltros && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginTop: '10px', padding: '15px', background: '#f5f5f5', borderRadius: '10px' }}>
                                    <input style={styles.input} placeholder="País" value={filtros.pais} onChange={e => setFiltros({ ...filtros, pais: e.target.value })} />
                                    <input style={styles.input} placeholder="Región/Provincia" value={filtros.region} onChange={e => setFiltros({ ...filtros, region: e.target.value })} />
                                    <input style={styles.input} placeholder="Localidad" value={filtros.poblacion} onChange={e => setFiltros({ ...filtros, poblacion: e.target.value })} />
                                    <input style={styles.input} placeholder="Nombre del Profesor" value={filtros.autor} onChange={e => setFiltros({ ...filtros, autor: e.target.value })} />
                                </div>
                            )}
                        </div>
                    )}

                <button onClick={buscar} disabled={buscando} style={{ background: '#2196F3', color: 'white', padding: '12px', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', width: '100%', marginTop: '15px', fontSize: '1.1rem' }}>
                    {buscando ? 'Buscando...' : 'Buscar'}
                </button>

                {/* RESULTADOS (2 COLUMNAS, SCROLL VERTICAL) */}
                {resultados.length > 0 && (
                    <div style={{ marginTop: '25px', borderTop: '2px dashed #eee', paddingTop: '20px' }}>
                        <h4 style={{ color: '#666', marginBottom: '15px' }}>Resultados ({resultados.length}):</h4>
                        <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '10px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px' }}>
                                {resultados.map(r => (
                                    <ResourceCard key={r.id} r={r} onClick={() => procesarClickTarjeta(r)} />
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* --- SECCIÓN 1: JUEGOS EN VIVO (TODA LA CLASE) --- */}
            <h2 style={{ color: '#f1c40f', textShadow: '0 2px 4px rgba(0,0,0,0.8)', textAlign: 'center', marginBottom: '20px', marginTop: '30px' }}>
                📡 Juegos para toda la clase (En Vivo)
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '40px', maxWidth: '700px', margin: '0 auto 40px auto' }}>
                {APPS.filter(app => app.isLive).map(app => (
                    <div key={app.id} onClick={() => abrirJuego(app.id)} style={{ background: '#fff', borderRadius: '20px', padding: '20px', textAlign: 'center', cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,0,0,0.3)', border: `4px solid ${app.color}`, transition: 'transform 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ width: '80px', height: '80px', marginBottom: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {app.img
                                ? <img src={app.img} alt={app.name} style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '15px' }} />
                                : <span style={{ fontSize: '52px', lineHeight: 1 }}>{app.emoji}</span>
                            }
                        </div>
                        <h3 style={{ margin: 0, color: app.color, fontSize: '1.4rem', fontWeight: 'bold' }}>{app.name}</h3>
                        <p style={{ margin: '10px 0 0 0', fontSize: '0.9rem', color: '#555', lineHeight: '1.3' }}>{app.desc}</p>
                    </div>
                ))}
            </div>

            {/* --- SECCIÓN 2: JUEGOS INDIVIDUALES / PEQUEÑOS GRUPOS --- */}
            <h2 style={{ color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.5)', textAlign: 'center', marginBottom: '20px', marginTop: '20px' }}>
                🕹️ Juegos de uno a tres jugadores
            </h2>





            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '15px', marginBottom: '40px' }}>
                {APPS.filter(app => !app.isLive && !app.isMath && !app.isHerramienta).map(app => (
                    <div key={app.id} style={{ position:'relative', background: '#ffffbf', borderRadius: '15px', padding: '15px', textAlign: 'center', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.2)', transition: 'transform 0.2s' }}
                        onClick={() => abrirJuego(app.id)}>
                        {app.shareable && (
                            <button
                                onClick={e => {
                                    e.stopPropagation();
                                    const url = `${window.location.origin}${window.location.pathname}?juego=${app.id.toLowerCase()}`;
                                    setShareModal({ url, titulo: app.name });
                                }}
                                title="Compartir"
                                style={{ position:'absolute', top:6, right:6, background:'rgba(255,255,255,0.8)', border:'none', borderRadius:6, padding:'3px 5px', cursor:'pointer', display:'flex', alignItems:'center', color: app.color }}
                            >
                                <Share2 size={13}/>
                            </button>
                        )}
                        <div style={{ width: '60px', height: '60px', margin: '0 auto 10px auto', background: 'transparent', borderRadius: '15px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white' }}>
                            {app.img ? (
                            <img src={app.img} alt={app.name} style={{ width: '60px', height: '60px', objectFit: 'contain', borderRadius: '15px' }} onError={(e) => e.target.style.display = 'none'} />
                            ) : (
                                    <span style={{ fontSize: '45px', lineHeight: '1' }}>{app.emoji}</span>
                                )}
                        </div>
                        <h4 style={{ margin: 0, color: '#333', fontSize: '0.9rem' }}>{app.name}</h4>
                    </div>
                ))}
            </div>
            {/* --- SECCIÓN: HERRAMIENTAS CLASE --- */}
            <h2 style={{ color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.5)', textAlign: 'center', marginBottom: '20px', marginTop: '30px' }}>
                🛠️ Herramientas Clase
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '15px', marginBottom: '40px', maxWidth: '900px', margin: '0 auto 40px auto' }}>
                {[
                    { id: 'SINTAXIS',        label: 'Sintaxis',        emoji: '🖍️',  color: '#3498db', action: () => setJuegoActivo({ tipoJuego: 'SINTAXIS' }), shareable: true },
                    { id: 'MATH_WORLD',      label: 'Math World',      emoji: '🌍',  color: '#009688', action: () => abrirJuego('MATH_WORLD_PORTAL'), shareable: true, shareUrl: `${window.location.origin}/math_world` },
                    { id: 'LISTENING',       label: 'Listening',       emoji: '🙉',  color: '#8E44AD', action: () => setJuegoActivo({ tipoJuego: 'LISTENING' }), shareable: true },
                    { id: 'ETIQUETAS',       label: 'EtiquetaMe',      img: imgEtiquetas, color: '#e74c3c', action: () => abrirJuego('ETIQUETAS'), shareable: true },
                    { id: 'QUESTION_SENDER', label: 'Q-Sender',        emoji: '📮',  color: '#2c3e50', action: () => setJuegoActivo({ tipoJuego: 'QUESTION_SENDER' }), shareable: true },
                    { id: 'OMNINTERACTIVE',  label: 'Omninteractive',  emoji: '📚',  color: '#6D28D9', action: () => setOmninteractivo(true), shareable: true },
                    { id: 'VIDEOQUIZZ',      label: 'VideoQuizz',      emoji: '🎬',  color: '#DC2626', action: () => setVideoQuizz(true), shareable: true },
                    { id: 'FUNCIONES_EJECUTIVAS', label: 'Funciones Ejecutivas', emoji: '🧠', color: '#FF5722', action: () => setFuncionesEjecutivas(true), shareable: true },
                    { id: 'IRREGULAR_VERBS',     label: 'Irregular Verbs',     emoji: '📝', color: '#0369a1', action: () => setIrregularVerbs(true), shareable: true },
                    { id: 'SOLAR_SYSTEM',        label: 'Sistema Solar',        emoji: '🪐', color: '#3B82F6', action: () => setJuegoActivo({ tipoJuego: 'SOLAR_SYSTEM' }), shareable: true },
                    { id: 'MUSICA',              label: 'Música',               emoji: '🎵', color: '#8b5cf6', action: () => setMusicApp(true), shareable: true },
                    { id: 'GEOGRAFIA',           label: 'Geografía',            emoji: '🌍', color: '#0d9488', action: () => setGeografiaApp(true), shareable: true },
                    { id: 'BIOLOGIA',            label: 'Biología',             emoji: '🔬', color: '#16a34a', action: () => setBiologiaApp(true),  shareable: true },
                    { id: 'GESTION_AULA', label: 'Gestión Aula', emoji: '🏫', color: '#e67e22', action: () => setGestionAula(true), shareable: true, shareUrl: `${window.location.origin}${window.location.pathname}?gestion=menu` },
                    { id: 'VISTAS_DIDRICAS', label: 'Vistas Diédricas', emoji: '📐', color: '#7c3aed', action: () => setVistasDidricas(true), shareable: true },
                    { id: 'SIMULADORES_FISICA', label: 'Física', emoji: '🔭', color: '#e74c3c', action: () => { setSimuladoresFisica(true); window.history.pushState({}, '', '/fisica'); }, shareable: true, shareUrl: `${window.location.origin}/fisica` },
                ].map(tool => (
                    <div key={tool.id} onClick={tool.action} style={{ background: '#ffffbf', borderRadius: '15px', padding: '15px', textAlign: 'center', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.2)', transition: 'transform 0.2s', border: `2px solid ${tool.color}20`, position: 'relative' }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                        {tool.shareable && (
                            <button
                                onClick={e => {
                                    e.stopPropagation();
                                    const url = tool.shareUrl || `${window.location.origin}${window.location.pathname}?juego=${tool.id.toLowerCase()}`;
                                    setShareModal({ url, titulo: tool.label });
                                }}
                                title="Compartir"
                                style={{ position:'absolute', top:6, right:6, background:'rgba(255,255,255,0.8)', border:'none', borderRadius:6, padding:'3px 5px', cursor:'pointer', display:'flex', alignItems:'center', color: tool.color }}
                            >
                                <Share2 size={13}/>
                            </button>
                        )}
                        <div style={{ width: '52px', height: '52px', margin: '0 auto 10px auto', display: 'flex', justifyContent: 'center', alignItems: 'center', background: `${tool.color}18`, borderRadius: '12px' }}>
                            {tool.img
                                ? <img src={tool.img} alt={tool.label} style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
                                : <span style={{ fontSize: '28px', lineHeight: 1 }}>{tool.emoji}</span>
                            }
                        </div>
                        <h4 style={{ margin: 0, color: tool.color, fontSize: '0.88rem', fontWeight: 700 }}>{tool.label}</h4>
                    </div>
                ))}
            </div>

            {/* ========================================= */}
            {/* FOOTER DE LICENCIA (PANTALLA PRINCIPAL) */}
            {/* ========================================= */}
            <div style={{ textAlign: 'center', padding: '20px', marginTop: '40px', fontSize: '0.85rem', color: '#fff', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                <a href="https://github.com/goladen/educando" target="_blank" rel="noopener noreferrer" style={{ color: '#f1c40f', fontWeight: 'bold', textDecoration: 'none' }}>Pikt.es</a>
                {' '}© 2025 by{' '}
                <a href="https://pikt.es" target="_blank" rel="noopener noreferrer" style={{ color: '#fff', textDecoration: 'none' }}>Pikt</a>
                {' '}is licensed under{' '}
                <a href="https://creativecommons.org/licenses/by-nc-nd/4.0/" target="_blank" rel="noopener noreferrer" style={{ color: '#fff', textDecoration: 'underline' }}>Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International</a>

                <span style={{ display: 'inline-flex', alignItems: 'center', marginLeft: '8px', gap: '3px', verticalAlign: 'middle', filter: 'invert(1)' /* Pone los iconos blancos */ }}>
                    <img src="https://mirrors.creativecommons.org/presskit/icons/cc.svg" alt="CC" style={{ width: '1.2em', height: '1.2em' }} />
                    <img src="https://mirrors.creativecommons.org/presskit/icons/by.svg" alt="BY" style={{ width: '1.2em', height: '1.2em' }} />
                    <img src="https://mirrors.creativecommons.org/presskit/icons/nc.svg" alt="NC" style={{ width: '1.2em', height: '1.2em' }} />
                    <img src="https://mirrors.creativecommons.org/presskit/icons/nd.svg" alt="ND" style={{ width: '1.2em', height: '1.2em' }} />
                </span>
            </div>

       
    
        </div>
    );
}

// TARJETA DE RECURSO IDENTIFICADA POR COLOR Y SIN DATOS DE PROFESOR
export const ResourceCard = ({ r, onClick }) => {
    const appInfo = getAppInfo(r.tipoJuego);
    const isLive = esJuegoEnVivo(r);
    const [mostrarOpciones, setMostrarOpciones] = useState(false);
    const [copiado, setCopiado] = useState(null);
    const esBurbujasPikatron = r.tipoJuego === 'CAZABURBUJAS' || r.tipoJuego === 'PIKATRON';
    const [modoEnlace, setModoEnlace] = useState(r.tipoJuego === 'PIKATRON' ? 'PIKATRON' : 'BURBUJAS');

    const hojas = ['General', ...(r.hojas?.map(h => h.nombreHoja).filter(Boolean) || [])];

    const copiarEnlace = (e, hoja) => {
        e.stopPropagation();
        let url = `${window.location.origin}/?r=${r.id}&h=${encodeURIComponent(hoja)}`;
        if (esBurbujasPikatron) url += `&m=${modoEnlace}`;
        navigator.clipboard.writeText(url).then(() => {
            setCopiado(hoja);
            setMostrarOpciones(false);
            setTimeout(() => setCopiado(null), 2500);
        });
    };

    const toggleOpciones = (e) => {
        e.stopPropagation();
        setMostrarOpciones(v => !v);
    };

    return (
        <div onClick={onClick} style={{ background: '#e3f2fd', padding: '15px', borderRadius: '12px', borderLeft: `6px solid ${appInfo.color}`, cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', height: '80%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid #eee', position: 'relative' }}>
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <h4 style={{ margin: 0, color: '#333', fontSize: '1.05rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }} title={r.titulo}>{r.titulo}</h4>
                    <span style={{ background: appInfo.color, color: 'white', padding: '3px 8px', borderRadius: '10px', fontSize: '0.65rem', fontWeight: 'bold' }}>{appInfo.name}</span>
                </div>

                <div style={{ fontSize: '0.85rem', color: '#555', background: '#f9f9f9', padding: '8px', borderRadius: '8px' }}>
                    <div style={{ marginBottom: '4px' }}><b>📚 Tema:</b> {r.temas || 'General'}</div>
                    <div style={{ marginBottom: '4px' }}><b>🎓 Ciclo:</b> {r.ciclo || r.config?.ciclo || 'Todos'}</div>
                    <div style={{ color: '#888', fontSize: '0.75rem', marginTop: '6px' }}>
                        <b>Niveles/Hojas:</b> {r.hojas?.map(h => h.nombreHoja).join(', ') || 'Nivel 1'}
                    </div>
                </div>
            </div>

            <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ background: '#eee', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', color: '#555' }}>
                    <Key size={12} style={{ verticalAlign: 'middle' }} /> {r.accessCode || '---'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {/* Botón enlace directo */}
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={toggleOpciones}
                            title="Copiar enlace directo"
                            style={{ background: copiado ? '#27ae60' : '#f0f4ff', border: `1.5px solid ${copiado ? '#27ae60' : '#c5cfe8'}`, borderRadius: 8, padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', fontWeight: 700, color: copiado ? 'white' : '#3d5afe', transition: 'all 0.2s' }}>
                            <Link2 size={13}/>
                            {copiado ? `✅ Copiado` : 'Enlace'}
                        </button>

                        {/* Dropdown de hojas */}
                        {mostrarOpciones && (
                            <div onClick={e => e.stopPropagation()}
                                style={{ position: 'absolute', bottom: '110%', right: 0, background: 'white', border: '1.5px solid #dce3f5', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 999, minWidth: 175, overflow: 'hidden' }}>
                                {esBurbujasPikatron && (
                                    <div style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0' }}>
                                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#888', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>Modo</div>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            {[['BURBUJAS', '🔵 Burbujas'], ['TEST', '📝 Test'], ['PIKATRON', '⚡ Pikatron'], ['PLATAFORMAS', '🕹️ Plat.']].map(([m, label]) => (
                                                <button key={m} onClick={e => { e.stopPropagation(); setModoEnlace(m); }}
                                                    style={{ flex: 1, padding: '4px 2px', border: `1.5px solid ${modoEnlace === m ? '#3d5afe' : '#ddd'}`, borderRadius: 6, background: modoEnlace === m ? '#f0f4ff' : 'white', fontSize: '0.62rem', cursor: 'pointer', fontWeight: modoEnlace === m ? 700 : 400, color: modoEnlace === m ? '#3d5afe' : '#555', whiteSpace: 'nowrap' }}>
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div style={{ padding: '7px 12px', fontSize: '0.7rem', fontWeight: 700, color: '#888', borderBottom: '1px solid #f0f0f0', textTransform: 'uppercase', letterSpacing: 1 }}>
                                    Elegir hoja
                                </div>
                                {hojas.map(hoja => (
                                    <button key={hoja} onClick={e => copiarEnlace(e, hoja)}
                                        style={{ display: 'block', width: '100%', padding: '9px 14px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', fontSize: '0.85rem', color: '#333', fontFamily: 'inherit' }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#f0f4ff'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                        🔗 {hoja}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    {isLive ? <Zap size={20} color={appInfo.color} style={{ opacity: 0.8 }} /> : <Play size={20} color={appInfo.color} style={{ opacity: 0.8 }} />}
                </div>
            </div>
        </div>
    );
};

// --- NUEVO COMPONENTE ENVOLTORIO PARA ENLACES DIRECTOS A Q-SENDER ---
const QuestionSenderWrapper = ({ onHome, initialJuegoActivo }) => {
    const [qsCode, setQsCode] = useState('');
    const [juegoActivo, setJuegoActivo] = useState(initialJuegoActivo);
    const [loadingMsg, setLoadingMsg] = useState('');

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const codeFromUrl = params.get('c'); // Detecta si la url es ?c=A1B2C
        if (codeFromUrl && !juegoActivo) {
            setQsCode(codeFromUrl.toUpperCase());
            abrirCliente(codeFromUrl.toUpperCase());
        }
    }, []);

    const abrirCliente = async (codeToUse) => {
        const targetCode = codeToUse || qsCode;
        if (!targetCode || targetCode.trim().length < 4) return alert("Introduce un código válido.");
        setLoadingMsg('Conectando...');

        const qSender = query(collection(db, 'resources'), where("hojasCodes", "array-contains", targetCode.toUpperCase().trim()));
        const snapSender = await getDocs(qSender);

        if (!snapSender.empty) {
            setJuegoActivo({
                ...snapSender.docs[0].data(),
                id: snapSender.docs[0].id,
                tipoJuego: 'QUESTION_SENDER',
                codigoInicial: targetCode.toUpperCase().trim()
            });
        } else {
            alert("Código de hoja no encontrado. Pídeselo a tu profesor.");
            if (window.location.search.includes('c=')) window.history.replaceState({}, '', '/q-sender');
        }
        setLoadingMsg('');
    };

    if (juegoActivo) {
        return <QuestionSenderClient usuario={null} onBack={() => { setJuegoActivo(null); window.history.replaceState({}, '', '/q-sender'); }} codigoInicial={juegoActivo.codigoInicial} />;
    }

    return (
        <div style={{ width: '100%', minHeight: '100vh', background: '#2c3e50', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
            <div style={{ background: 'white', padding: '40px', borderRadius: '20px', textAlign: 'center', maxWidth: '500px', width: '100%', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
                <div style={{ marginBottom: '20px', fontSize: '80px', lineHeight: '1' }}>📮</div>
                <h2 style={{ color: '#2c3e50', margin: '0 0 10px 0' }}>Buzón de Preguntas</h2>
                <p style={{ color: '#7f8c8d', marginBottom: '30px' }}>Introduce el código de tu grupo para enviar preguntas.</p>

                <input value={qsCode} onChange={e => setQsCode(e.target.value.toUpperCase())} placeholder="CÓDIGO (Ej: A1B2)" style={{ width: '100%', padding: '15px', fontSize: '1.5rem', textAlign: 'center', borderRadius: '10px', border: '2px solid #bdc3c7', marginBottom: '20px', letterSpacing: '3px', textTransform: 'uppercase', boxSizing: 'border-box' }} maxLength={5} />

                <button onClick={() => abrirCliente()} disabled={!!loadingMsg} style={{ width: '100%', padding: '15px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', marginBottom: '15px' }}>
                    {loadingMsg || 'ENTRAR'}
                </button>

                <button onClick={onHome} style={{ background: 'transparent', border: 'none', color: '#95a5a6', cursor: 'pointer', fontSize: '0.9rem', textDecoration: 'underline' }}>Volver al inicio</button>
            </div>
        </div>
    );
};




// PÁGINA ESPECÍFICA DEL JUEGO
export const SpecificGamePage = ({ appData, onHome, onLoginRequest }) => {
    const [tab, setTab] = useState(appData.isLive ? 'LIVE' : 'SEARCH');
    const [filtros, setFiltros] = useState({ tema: '', ciclo: '', pais: '', region: '', poblacion: '', autor: '' });
    const [mostrarMasFiltros, setMostrarMasFiltros] = useState(false);
    const [codigo, setCodigo] = useState('');
    const [resultados, setResultados] = useState([]);
const [entrando, setEntrando] = useState(false);
    // Live Alumno
    const [joinCode, setJoinCode] = useState('');
    const [joinName, setJoinName] = useState('');
    const [liveModeAlumno, setLiveModeAlumno] = useState(false);
    const [joinLiveTipoJuego, setJoinLiveTipoJuego] = useState('');
    // Gestor/Single Player
    const [liveModeHost, setLiveModeHost] = useState(false);
    const [hostRoomCode, setHostRoomCode] = useState('');
    const [juegoActivo, setJuegoActivo] = useState(null);
    const [recursoParaElegir, setRecursoParaElegir] = useState(null);
    const [selectorHojaRecurso, setSelectorHojaRecurso] = useState(null); // { recurso, hojas }
    // --- NUEVAS FUNCIONES DE SALIDA DIRECTA ---
    const handleExitGame = () => {
        if (appData.isMath) {
            window.history.pushState({}, '', '/math_world');
            window.dispatchEvent(new Event('popstate'));
        } else {
            setJuegoActivo(null);
        }
    };

    const handleVolverMenu = () => {
        if (appData.isMath) {
            window.history.pushState({}, '', '/math_world');
            window.dispatchEvent(new Event('popstate'));
        } else {
            onHome();
        }
    };

    if (juegoActivo) {
        // Usa handleExitGame en lugar de setJuegoActivo(null)
        if (appData.id === 'GEOMETRIX' || juegoActivo.tipoJuego === 'GEOMETRIX') return <Geometrix usuario={null} onExit={handleExitGame} />;
        if (appData.id === 'CALCULO' || juegoActivo.tipoJuego === 'CALCULO') return <CalculoMental usuario={null} onExit={handleExitGame} />;
        if (appData.id === 'ECUACIONES' || juegoActivo.tipoJuego === 'ECUACIONES') return <Ecuaciones onExit={handleExitGame} />;
        if (appData.id === 'FUNCIONES' || juegoActivo.tipoJuego === 'FUNCIONES') return <Funciones usuario={null} onExit={handleExitGame} />;
        if (appData.id === 'GEOMETRÍA_ANALÍTICA' || juegoActivo.tipoJuego === 'GEOMETRÍA_ANALÍTICA') return <GeometriaAnalitica usuario={null} onExit={handleExitGame} />;
        if (appData.id === 'POLINOMIOS'  || juegoActivo.tipoJuego === 'POLINOMIOS')  return <AlgebraApp     usuario={null} onExit={handleExitGame} />;
        if (appData.id === 'ESTADISTICA'  || juegoActivo.tipoJuego === 'ESTADISTICA')  return <EstadisticaApp  usuario={null} onExit={handleExitGame} />;
        if (appData.id === 'PROBABILIDAD' || juegoActivo.tipoJuego === 'PROBABILIDAD') return <SimuladorDados                    onExit={handleExitGame} />;
        if (appData.id === 'RETOS'        || juegoActivo.tipoJuego === 'RETOS')        return <RetosApp                          onExit={handleExitGame} />;

    }
    // --- NUEVO: ATAJO PARA JUEGOS CON MENÚ PROPIO ---
    if (appData.id === 'WORDLE') return <TextWordleGame usuario={null} onExit={onHome} />;
    if (appData.id === 'MATHLE') return <MathWordleGame usuario={null} onExit={onHome} />;
    if (appData.id === 'SOPA') return <SopaDeLetrasGame usuario={null} onExit={onHome} />;
    // --------


    if (appData.id === 'SINTAXIS') return <SintaxisGame usuario={null} onExit={onHome} />;
if (appData.id === 'LISTENING') return <Listening usuario={null} onExit={onHome} />;


if (appData.id === 'PIKATRON_2') return <Plataformas usuario={null} onExit={onHome} />;
    // --- NUEVO: USA handleExitGame PARA LOS DE MATES ---
    if (appData.id === 'GEOMETRIX') return <Geometrix usuario={null} onExit={handleExitGame} />;
    if (appData.id === 'CALCULO') return <CalculoMental usuario={null} onExit={handleExitGame} />;
    if (appData.id === 'ECUACIONES') return <Ecuaciones usuario={null} onExit={handleExitGame} />;
    if (appData.id === 'FUNCIONES') return <Funciones usuario={null} onExit={handleExitGame} />;
    if (appData.id === 'GEOMETRÍA_ANALÍTICA') return <GeometriaAnalitica usuario={null} onExit={handleExitGame} />;

    // ------------------------// ------------------------
    // --- CASO ESPECIAL: QUESTION SENDER ---
    // --- CASO ESPECIAL: QUESTION SENDER ---
    if (appData.id === 'QUESTION_SENDER') {
        return <QuestionSenderWrapper onHome={onHome} initialJuegoActivo={juegoActivo} />;
    }

    const buscarEspecífico = async () => {
        try {
            const ref = collection(db, 'resources');
            let filtrados = [];

            if (codigo) {
                const q = query(ref, where("accessCode", "==", codigo.toUpperCase().trim()));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    const data = snap.docs[0].data();
                    //const esEsteJuego = data.tipoJuego === appData.id;
                    let esEsteJuego = data.tipoJuego === appData.id;
                    if (appData.id === 'CAZABURBUJAS' || appData.id === 'PIKATRON') {
                        esEsteJuego = (data.tipoJuego === 'CAZABURBUJAS' || data.tipoJuego === 'PIKATRON');
                    }
                    else if (appData.id === 'SOPA' || appData.id === 'WORDLE') {
                        // MAGIA: Sopa y Wordle comparten los mismos recursos
                        esEsteJuego = (data.tipoJuego === 'SOPA' || data.tipoJuego === 'WORDLE');
                    }



                    const esPiLiveAntiguo = appData.id === 'THINKHOOT' && data.tipo === 'PRO' && data.tipoJuego !== 'WORDLE';

                    if (esEsteJuego || esPiLiveAntiguo) {
                        filtrados = [{ ...data, id: snap.docs[0].id }];
                    } else {
                        alert("Código no encontrado para este juego.");
                    }
                } else alert("Código no encontrado.");
            } else {
                const q = query(ref, limit(150));
                const snap = await getDocs(q);
                filtrados = snap.docs.map(d => ({ ...d.data(), id: d.id })).filter(r => {
                  //  const esEsteJuego = r.tipoJuego === appData.id;
                    let esEsteJuego = r.tipoJuego === appData.id;
                    if (appData.id === 'CAZABURBUJAS' || appData.id === 'PIKATRON') {
                        esEsteJuego = (r.tipoJuego === 'CAZABURBUJAS' || r.tipoJuego === 'PIKATRON');
                    }
                    else if (appData.id === 'SOPA' || appData.id === 'WORDLE') {
                        // MAGIA: Sopa y Wordle comparten los mismos recursos
                        esEsteJuego = (data.tipoJuego === 'SOPA' || data.tipoJuego === 'WORDLE');
                    }



                    const esPiLiveAntiguo = appData.id === 'THINKHOOT' && r.tipo === 'PRO' && r.tipoJuego !== 'WORDLE';

                    if (!esEsteJuego && !esPiLiveAntiguo) return false;
                    if (r.isFinished !== true && r.config?.isFinished !== true) return false;

                    if (filtros.tema && !cleanText(r.temas).includes(cleanText(filtros.tema)) && !cleanText(r.titulo).includes(cleanText(filtros.tema))) return false;
                    if (filtros.ciclo) {
                        const fc = cleanText(filtros.ciclo);
                        const matchC = Array.isArray(r.ciclo) ? r.ciclo.some(c => cleanText(c) === fc) : cleanText(r.ciclo) === fc;
                        if (!matchC) return false;
                    }

                    if (filtros.pais && !cleanText(r.pais).includes(cleanText(filtros.pais))) return false;
                    if (filtros.region && !cleanText(r.region).includes(cleanText(filtros.region))) return false;
                    if (filtros.poblacion && !cleanText(r.poblacion).includes(cleanText(filtros.poblacion))) return false;
                    if (filtros.autor && !cleanText(r.profesorNombre).includes(cleanText(filtros.autor))) return false;

                    return true;
                });
            }
            setResultados(filtrados);
        } catch (e) { console.error(e); }
    };

    const lanzarComoGestor = async (r, hojaForzada = null) => {
        if (!window.confirm("¿Quieres iniciar una sesión en vivo como presentador de este juego?")) return;
        try {
            const sala = Math.floor(100000 + Math.random() * 900000).toString();
            const limitePreguntas = parseInt(r.config?.numPreguntas) || 10;
            let pool = [];
            if (hojaForzada) {
                pool = hojaForzada.preguntas ? [...hojaForzada.preguntas] : [];
            } else if (r.hojas) {
                r.hojas.forEach(h => pool.push(...(h.preguntas || [])));
            }
            if (r.config?.aleatorio !== false) pool.sort(() => Math.random() - 0.5);

            const pFin = pool.slice(0, limitePreguntas).map(p => {
                // Protegemos los juegos PRO y OLYMPIC para que no destruya el tipo de pregunta
                // Añadimos también tipoJuego por si creaste el recurso antes de la actualización
                if (r.tipo !== 'PRO' && r.tipo !== 'OLYMPIC' && r.tipoJuego !== 'OLYMPICLIVE') {
                    return { ...p, q: p.pregunta, a: p.correcta || p.respuesta, tipo: (p.incorrectas?.length > 0) ? 'MULTIPLE' : 'SIMPLE', opcionesFijas: (p.incorrectas?.length > 0) ? [p.correcta || p.respuesta, ...p.incorrectas].sort(() => Math.random() - 0.5) : [] };
                }
                return p;
            });

            await setDoc(doc(db, "live_games", sala), {
                hostId: "host_invitado_" + Date.now(),
                recursoId: r.id || 'temp_id',
                recursoTitulo: r.titulo,
                hojaNombre: hojaForzada ? (hojaForzada.nombreHoja || hojaForzada.nombre || '') : '',
                profesorNombre: "Profe Invitado",
                config: r.config || {},
                preguntas: pFin,
                estado: 'LOBBY',
                indicePregunta: 0,
                jugadores: {},
                respuestasRonda: {},
                timestamp: new Date(),
                tipoJuego: r.tipoJuego
            });

            setHostRoomCode(sala);
            setLiveModeHost(true);
        } catch (error) { console.error(error); alert("Error al crear la sala."); }
    };

    const procesarClickTarjeta = (r) => {
        if (appData.isLive) {
            // Si el recurso tiene múltiples hojas, mostrar selector primero
            if (r.hojas && r.hojas.length > 1) {
                setSelectorHojaRecurso(r);
            } else {
                lanzarComoGestor(r);
            }
        } else if (r.tipoJuego === 'CAZABURBUJAS' || r.tipoJuego === 'WORDLE' || r.tipoJuego === 'SOPA') setRecursoParaElegir(r);
        else if (r.tipoJuego === 'ETIQUETAS') setJuegoActivo(r);
        else setJuegoActivo(r);
    };

    // --- RENDERIZADO PANTALLA COMPLETA ---
    // En móviles al usar position:fixed u ocupar 100vh se verá a pantalla completa
    if (liveModeHost && hostRoomCode) {
        if (appData.id === 'MATHLIVE') return <MathLive isHost={true} codigoSala={hostRoomCode} usuario={{ uid: "host", displayName: "Profe" }} onExit={() => setLiveModeHost(false)} />;
        return <ThinkHootGame isHost={true} codigoSala={hostRoomCode} usuario={{ uid: "host", displayName: "Profe" }} onExit={() => setLiveModeHost(false)} />;
    }

    if (liveModeAlumno) {
        // Usamos la verdad absoluta de la base de datos, o el de la app si no está
        const tipoFinal = (typeof joinLiveTipoJuego !== 'undefined' && joinLiveTipoJuego) ? joinLiveTipoJuego : (typeof appData !== 'undefined' ? appData.id : '');

        if (tipoFinal === 'OLYMPICLIVE') return <OlympicLive isHost={false} codigoSala={typeof joinCode !== 'undefined' ? joinCode : joinLiveCode} usuario={{ displayName: typeof joinName !== 'undefined' ? joinName : joinLiveName, email: null }} onExit={() => setLiveModeAlumno(false)} />;
        if (tipoFinal === 'MATHLIVE' || isMathLiveAlumno) return <MathLive isHost={false} codigoSala={typeof joinCode !== 'undefined' ? joinCode : joinLiveCode} usuario={{ displayName: typeof joinName !== 'undefined' ? joinName : joinLiveName, email: null }} onExit={() => setLiveModeAlumno(false)} />;

        return <ThinkHootGame isHost={false} codigoSala={typeof joinCode !== 'undefined' ? joinCode : joinLiveCode} usuario={{ displayName: typeof joinName !== 'undefined' ? joinName : joinLiveName, email: null }} onExit={() => setLiveModeAlumno(false)} />;
    }

    if (juegoActivo) {
        if (appData.id === 'PIKATRON' || juegoActivo.modoEspecial === 'PIKATRON') return <PikatronRun recurso={juegoActivo} onExit={() => setJuegoActivo(null)} />;
        if (appData.id === 'RULETA') return <RuletaGame recurso={juegoActivo} usuario={null} alTerminar={() => setJuegoActivo(null)} />;
        // --- AÑADIDO: Distinguir Wordle y Sopa ---
        if (appData.id === 'WORDLE' || juegoActivo.modoEspecial === 'WORDLE' || (juegoActivo.tipoJuego === 'WORDLE' && !juegoActivo.modoEspecial)) return <TextWordleGame recursoInicial={juegoActivo} usuario={null} onExit={() => setJuegoActivo(null)} />;
        if (appData.id === 'SOPA' || juegoActivo.modoEspecial === 'SOPA' || (juegoActivo.tipoJuego === 'SOPA' && !juegoActivo.modoEspecial)) return <SopaDeLetrasGame recursoInicial={juegoActivo} usuario={null} onExit={() => setJuegoActivo(null)} />;
        if (appData.id === 'ETIQUETAS' || juegoActivo.tipoJuego === 'ETIQUETAS')     return <EtiquetaMe recurso={juegoActivo} onExit={() => setJuegoActivo(null)} />;
        return <GamePlayer recurso={juegoActivo} usuario={null} alTerminar={() => setJuegoActivo(null)} />;
    }

    return (
        <div style={{ width: '100%', minHeight: '100vh', background: '#f0f2f5', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>

            {/* MODAL SELECTOR DE HOJA */}
            {selectorHojaRecurso && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 5000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ background: 'white', padding: '30px', borderRadius: '20px', textAlign: 'center', maxWidth: '440px', width: '90%' }}>
                        <h2 style={{ color: '#2c3e50', margin: '0 0 8px 0' }}>📋 Elige una hoja</h2>
                        <p style={{ color: '#7f8c8d', fontSize: '0.9rem', margin: '0 0 20px 0' }}>
                            <strong>{selectorHojaRecurso.titulo}</strong> tiene {selectorHojaRecurso.hojas.length} hojas.
                            Selecciona cuál quieres presentar o lanza todas.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: 300, overflowY: 'auto', marginBottom: 16 }}>
                            {selectorHojaRecurso.hojas.map((h, i) => (
                                <button key={i}
                                    onClick={() => { lanzarComoGestor(selectorHojaRecurso, h); setSelectorHojaRecurso(null); }}
                                    style={{ padding: '12px 16px', background: appData.color, color: 'white', border: 'none', borderRadius: '10px', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>📄 {h.nombreHoja || h.nombre || `Hoja ${i + 1}`}</span>
                                    <span style={{ opacity: 0.75, fontSize: '0.8rem' }}>{h.preguntas?.length || 0} preguntas</span>
                                </button>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={() => { lanzarComoGestor(selectorHojaRecurso, null); setSelectorHojaRecurso(null); }}
                                style={{ flex: 1, padding: '11px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                                🔀 Todas las hojas
                            </button>
                            <button onClick={() => setSelectorHojaRecurso(null)}
                                style={{ padding: '11px 16px', background: '#eee', border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#555' }}>
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL ELEGIR MODO BURBUJAS/PIKATRON */}
            {recursoParaElegir && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 5000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ background: 'white', padding: '30px', borderRadius: '20px', textAlign: 'center', maxWidth: '400px', width: '90%' }}>
                        <h2 style={{ color: '#2c3e50', margin: '0 0 20px 0' }}>🚀 ¡Elige tu aventura!</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {(recursoParaElegir.tipoJuego === 'CAZABURBUJAS' || recursoParaElegir.tipoJuego === 'PIKATRON') ? (
                                <>
                                    <button onClick={() => { setJuegoActivo({ ...recursoParaElegir, modoEspecial: 'CAZABURBUJAS' }); setRecursoParaElegir(null); }} style={{ padding: '15px', background: '#E91E63', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 'bold' }}>🔵 Cazaburbujas Clásico</button>
                                    <button onClick={() => { setJuegoActivo({ ...recursoParaElegir, modoEspecial: 'PIKATRON' }); setRecursoParaElegir(null); }} style={{ padding: '15px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 'bold' }}>⚡ Pikatron Run (Runner)</button>
                                    <button onClick={() => { setJuegoActivo({ ...recursoParaElegir, modoEspecial: 'PLATAFORMAS' }); setRecursoParaElegir(null); }} style={{ padding: '15px', background: '#8e44ad', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 'bold' }}>🕹️ Plataformas</button>
                                </>
                            ) : (
                                    <>
                                        {/* OPCIONES DE WORDLE Y SOPA */}
                                        <button onClick={() => { setJuegoActivo({ ...recursoParaElegir, modoEspecial: 'WORDLE' }); setRecursoParaElegir(null); }} style={{ padding: '15px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 'bold' }}>🟩 Wordle Clásico</button>
                                        <button onClick={() => { setJuegoActivo({ ...recursoParaElegir, modoEspecial: 'SOPA' }); setRecursoParaElegir(null); }} style={{ padding: '15px', background: '#FF9800', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 'bold' }}>🔍 Sopa de Letras</button>
                                    </>
                                )}
                            <button onClick={() => setRecursoParaElegir(null)} style={{ marginTop: '10px', background: 'transparent', border: 'none', color: '#999', cursor: 'pointer' }}>Cancelar</button>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ width: '100%', maxWidth: '900px', background: `color-mix(in srgb, ${appData.color}, white 60%)`, minHeight: '100vh', padding: '20px', boxShadow: '0 0 20px rgba(0,0,0,0.1)' }}>
                <button onClick={onHome} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'black', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '20px', fontWeight: 'bold' }}>
                    <Home size={20} /> Volver al Inicio
                </button>

                <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                    <div style={{ width: '80px', height: '80px', margin: '0 auto', background: 'transparent', borderRadius: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
                        <img src={appData.img} alt={appData.name} style={{ width: '100px', borderRadius:'15px' }} onError={(e) => e.target.style.display = 'none'} />
                    </div>
                    <h1 style={{ color: appData.color, margin: '15px 0 5px 0', fontSize: '2.5rem' }}>{appData.name}</h1>
                    <p style={{ color: appData.color, fontStyle: 'italic', fontSize: '1.1rem', marginBottom: '20px' }}>{appData.desc}</p>

                    {/* CONTENEDOR DE BOTONES */}
                    <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>

                        {/* BOTÓN EXCLUSIVO PARA JUGAR DIRECTO CON IA */}
                        {(appData.id === 'SINTAXIS' || appData.id === 'GEOMETRIX'|| appData.id === 'LISTENING') && (
                            <button
                                onClick={() => setJuegoActivo({ tipoJuego: appData.id, isIA: true })}
                                style={{
                                    background: 'white',
                                    color: appData.color,
                                    padding: '12px 30px',
                                    border: `2px solid white`,
                                    borderRadius: '30px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    fontSize: '1.1rem',
                                    boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                                    transition: 'all 0.2s',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '10px'
                                }}
                            >
                                {appData.id === 'SINTAXIS' ? '🤖 Jugar Directamente (IA)' : '📐 Jugar Modo Aleatorio'}
                            </button>
                        )}

                        <button
                            onClick={() => onLoginRequest && onLoginRequest()}
                            style={{
                                background: appData.color,
                                color: 'white',
                                padding: '12px 30px',
                                border: `2px solid ${appData.color}`,
                                borderRadius: '30px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                fontSize: '1.1rem',
                                boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                                transition: 'all 0.2s',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '10px'
                            }}
                        >
                            🚀 Únete para crear
                        </button>
                    </div>



                </div>

                {appData.isLive && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
                        <button onClick={() => setTab('LIVE')} style={{ padding: '10px 20px', border: 'none', borderRadius: '20px', background: tab === 'LIVE' ? appData.color : '#eee', color: tab === 'LIVE' ? 'white' : '#555', fontWeight: 'bold', cursor: 'pointer' }}>📡 Unirse en Vivo</button>
                        <button onClick={() => setTab('SEARCH')} style={{ padding: '10px 20px', border: 'none', borderRadius: '20px', background: tab === 'SEARCH' ? appData.color : '#eee', color: tab === 'SEARCH' ? 'white' : '#555', fontWeight: 'bold', cursor: 'pointer' }}>🔍 Buscar Juegos para Presentar</button>
                    </div>
                )}

                {tab === 'LIVE' && appData.isLive && (
                    <div style={{ background: '#f9f9f9', padding: '40px', borderRadius: '15px', textAlign: 'center', border: `2px solid ${appData.color}` }}>
                        <h3>Introduce el código de la sala</h3>
                        <input placeholder="Código de 6 números" value={joinCode} onChange={e => setJoinCode(e.target.value)} style={{ ...styles.input, width: '250px', display: 'block', margin: '15px auto', textAlign: 'center', fontSize: '1.5rem', letterSpacing: '2px' }} maxLength={6} />
                        <input placeholder="Tu Nombre" value={joinName} onChange={e => setJoinName(e.target.value)} style={{ ...styles.input, width: '250px', display: 'block', margin: '10px auto', textAlign: 'center', fontSize: '1.2rem' }} />

                        <button  disabled={entrando}
            onClick={async () => {
        if (joinCode.length === 6 && joinName) {
            setEntrando(true);
            const salaSnap = await getDoc(doc(db, "live_games", joinCode.toUpperCase().trim()));
            if (salaSnap.exists()) {
                setJoinLiveTipoJuego(salaSnap.data().tipoJuego || '');
                setLiveModeAlumno(true);
            } else {
                alert("Código incorrecto o sala no iniciada.");
                setEntrando(false);
            }
        } else alert("Introduce código y nombre.");
    }}
>
    {entrando ? 'Conectando...' : 'ENTRAR AL JUEGO'}
</button>
                    </div>
                )}

                {tab === 'SEARCH' && (
                    <div style={{ background: '#f5f5f5', padding: '30px', borderRadius: '15px' }}>
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                            <input placeholder="Tema o Título..." value={filtros.tema} onChange={e => setFiltros({ ...filtros, tema: e.target.value })} style={styles.input} />
                            <select value={filtros.ciclo} onChange={e => setFiltros({ ...filtros, ciclo: e.target.value })} style={styles.input}>
                                <option value="">Cualquier Ciclo</option>
                                <option value="Infantil">Primaria</option>
                                <option value="Primaria">Primaria</option>
                                <option value="Secundaria">Secundaria</option>
                                <option value="Bachillerato">Bachillerato</option>
                                <option value="FP">FP</option>
                                <option value="Otros">Otros</option>
                            </select>
                        </div>

                        <div style={{ textAlign: 'right', marginTop: '10px' }}>
                            <button onClick={() => setMostrarMasFiltros(!mostrarMasFiltros)} style={{ background: 'none', border: 'none', color: appData.color, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px', width: '100%', fontSize: '0.9rem' }}>
                                {mostrarMasFiltros ? <ChevronUp size={16} /> : <ChevronDown size={16} />} {mostrarMasFiltros ? 'Menos filtros' : 'Búsqueda avanzada y Código'}
                            </button>
                        </div>

                        {mostrarMasFiltros && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginTop: '15px', padding: '15px', background: '#ebebeb', borderRadius: '10px' }}>
                                <input style={styles.input} placeholder="CÓDIGO (4 o 5 letras)" value={codigo} onChange={e => setCodigo(e.target.value)} />
                                <input style={styles.input} placeholder="País" value={filtros.pais} onChange={e => setFiltros({ ...filtros, pais: e.target.value })} />
                                <input style={styles.input} placeholder="Región" value={filtros.region} onChange={e => setFiltros({ ...filtros, region: e.target.value })} />
                                <input style={styles.input} placeholder="Autor" value={filtros.autor} onChange={e => setFiltros({ ...filtros, autor: e.target.value })} />
                            </div>
                        )}

                        <button onClick={buscarEspecífico} style={{ background: appData.color, color: 'white', padding: '15px', width: '100%', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1.1rem', marginTop: '20px' }}>Buscar en {appData.name}</button>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px', marginTop: '25px' }}>
                            {resultados.map(r => <ResourceCard key={r.id} r={r} onClick={() => procesarClickTarjeta(r)} />)}
                        </div>
                    </div>
                )}

                {/* ========================================= */}
                {/* FOOTER DE LICENCIA (PANTALLA PRINCIPAL) */}
                {/* ========================================= */}
                <div style={{ textAlign: 'center', padding: '20px', marginTop: '40px', fontSize: '0.85rem', color: '#666', borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                    <a href="https://github.com/goladen/educando" target="_blank" rel="noopener noreferrer" style={{ color: '#2c3e50', fontWeight: 'bold', textDecoration: 'none' }}>Pikt.es</a>
                    {' '}© 2025 by{' '}
                    <a href="https://pikt.es" target="_blank" rel="noopener noreferrer" style={{ color: '#2c3e50', textDecoration: 'none' }}>Pikt</a>
                    {' '}is licensed under{' '}
                    <a href="https://creativecommons.org/licenses/by-nc-nd/4.0/" target="_blank" rel="noopener noreferrer" style={{ color: '#2c3e50', textDecoration: 'underline' }}>Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International</a>
                    <span style={{ display: 'inline-flex', alignItems: 'center', marginLeft: '8px', gap: '3px', verticalAlign: 'middle', filter: 'invert(1)' /* Pone los iconos blancos */ }}>
                        <img src="https://mirrors.creativecommons.org/presskit/icons/cc.svg" alt="CC" style={{ width: '1.2em', height: '1.2em' }} />
                        <img src="https://mirrors.creativecommons.org/presskit/icons/by.svg" alt="BY" style={{ width: '1.2em', height: '1.2em' }} />
                        <img src="https://mirrors.creativecommons.org/presskit/icons/nc.svg" alt="NC" style={{ width: '1.2em', height: '1.2em' }} />
                        <img src="https://mirrors.creativecommons.org/presskit/icons/nd.svg" alt="ND" style={{ width: '1.2em', height: '1.2em' }} />
                    </span>
                </div>

            </div>
    
        
            </div>
        


    );



}

// ─── PictoTabú Modal (crear/unirse) ─────────────────────────────────────────
function PictoTabuModal({ usuario, onClose, onEnterRoom, initialCode = '' }) {
    const [tab, setTab] = useState(initialCode ? 'UNIRSE' : 'CREAR');
    const [nombre, setNombre] = useState(usuario?.displayName || '');
    const [modo, setModo] = useState('MIXTO');
    const [tiempo, setTiempo] = useState(60);
    const [sinProfesor, setSinProfesor] = useState(true);
    const [creando, setCreando] = useState(false);
    const [salaCreada, setSalaCreada] = useState(null);
    const [joinCode, setJoinCode] = useState(initialCode);
    const [joinName, setJoinName] = useState(usuario?.displayName || '');
    const [joining, setJoining] = useState(false);
    // hostId fijo para esta sesión — se usará para identificar al creador como admin
    const [hostId] = useState(() => usuario?.uid || ('h_' + Math.random().toString(36).substring(2, 11)));

    const crearSala = async () => {
        if (sinProfesor && !nombre.trim()) return alert('Introduce tu nombre.');
        setCreando(true);
        try {
            const sala = Math.floor(100000 + Math.random() * 900000).toString();
            await setDoc(doc(db, 'live_games', sala), {
                hostId,
                estado: 'LOBBY',
                jugadores: {},
                mensajes: {},
                config: { tiempoRonda: tiempo },
                tipoJuego: 'EAE',
                modoJuego: modo,
                sinProfesor,
                anfitrionesUsados: [],
                palabrasUsadas: [],
                rondaActual: 0,
                timestamp: new Date(),
            });
            setSalaCreada(sala);
        } catch (e) { alert('Error: ' + e.message); }
        setCreando(false);
    };

    const entrarASalaCreada = () => {
        onEnterRoom(salaCreada, nombre.trim() || (usuario?.displayName || 'Anfitrión'), hostId);
    };

    const unirseSala = async () => {
        const code = joinCode.trim().toUpperCase();
        if (!code || !joinName.trim()) return alert('Introduce código y nombre.');
        setJoining(true);
        try {
            const snap = await getDoc(doc(db, 'live_games', code));
            if (!snap.exists()) { alert('Sala no encontrada.'); setJoining(false); return; }
            onEnterRoom(code, joinName.trim());
        } catch (e) { alert('Error: ' + e.message); }
        setJoining(false);
    };

    const roomUrl = salaCreada ? `${window.location.origin}?sala=${salaCreada}` : '';
    const qrUrl   = salaCreada
        ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(roomUrl)}&bgcolor=ffffff&color=1a1a2e&margin=6`
        : '';

    const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
    const box     = { background: '#1a1a2e', borderRadius: 20, padding: 28, width: '100%', maxWidth: 440, color: 'white', boxShadow: '0 20px 60px rgba(0,0,0,0.6)', position: 'relative', maxHeight: '90vh', overflowY: 'auto' };
    const tabBtn  = (t) => ({ flex: 1, padding: '10px', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: '1rem', background: tab === t ? '#e67e22' : 'rgba(255,255,255,0.1)', color: 'white', transition: 'all 0.2s' });
    const inp     = { width: '100%', padding: '12px 14px', borderRadius: 10, border: '2px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '1rem', boxSizing: 'border-box', outline: 'none' };
    const label   = { color: '#bdc3c7', fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, display: 'block' };
    const btn     = (bg) => ({ width: '100%', padding: '13px', border: 'none', borderRadius: 12, background: bg, color: 'white', fontWeight: 700, fontSize: '1.05rem', cursor: 'pointer', marginTop: 12 });

    return (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={box}>
                <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontWeight: 700, fontSize: '1rem' }}>✕</button>

                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    <div style={{ fontSize: '2.5rem' }}>🎨✍️</div>
                    <h2 style={{ margin: '8px 0 4px', fontFamily: 'Righteous, sans-serif', color: '#e67e22', fontSize: '1.6rem' }}>PictoTabú</h2>
                    <p style={{ color: '#95a5a6', margin: 0, fontSize: '0.88rem' }}>Pictionary + Tabú Multijugador</p>
                </div>

                <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                    <button style={tabBtn('CREAR')} onClick={() => setTab('CREAR')}>➕ Crear Sala</button>
                    <button style={tabBtn('UNIRSE')} onClick={() => setTab('UNIRSE')}>🚪 Unirse</button>
                </div>

                {/* ── TAB CREAR ── */}
                {tab === 'CREAR' && !salaCreada && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div>
                            <label style={label}>Tu nombre</label>
                            <input style={inp} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre (aparecerá en el juego)" />
                        </div>
                        <div>
                            <label style={label}>Modo de juego</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {[['MIXTO','🎲 Mixto'],['DIBUJAR','🎨 Solo Dibujo'],['DESCRIBIR','✍️ Solo Tabú']].map(([v,lbl]) => (
                                    <button key={v} onClick={() => setModo(v)} style={{ flex: 1, padding: '9px 4px', border: `2px solid ${modo === v ? '#e67e22' : 'rgba(255,255,255,0.15)'}`, borderRadius: 10, background: modo === v ? 'rgba(230,126,34,0.2)' : 'rgba(255,255,255,0.05)', color: modo === v ? '#e67e22' : '#ccc', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem' }}>{lbl}</button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label style={label}>Tiempo por turno</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {[45,60,90,120].map(t => (
                                    <button key={t} onClick={() => setTiempo(t)} style={{ flex: 1, padding: '9px 4px', border: `2px solid ${tiempo === t ? '#3498db' : 'rgba(255,255,255,0.15)'}`, borderRadius: 10, background: tiempo === t ? 'rgba(52,152,219,0.2)' : 'rgba(255,255,255,0.05)', color: tiempo === t ? '#3498db' : '#ccc', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>{t}s</button>
                                ))}
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '12px 14px' }}>
                            <input type="checkbox" id="sinProf" checked={sinProfesor} onChange={e => setSinProfesor(e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                            <label htmlFor="sinProf" style={{ cursor: 'pointer', color: 'white' }}>
                                <strong>Modo sin profesor</strong>
                                <div style={{ color: '#95a5a6', fontSize: '0.78rem', marginTop: 2 }}>El creador gestiona las rondas</div>
                            </label>
                        </div>
                        <button style={btn('#e67e22')} onClick={crearSala} disabled={creando}>
                            {creando ? '⏳ Creando...' : '🚀 Crear Sala'}
                        </button>
                    </div>
                )}

                {/* ── SALA CREADA ── */}
                {tab === 'CREAR' && salaCreada && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                        <div style={{ background: 'rgba(230,126,34,0.15)', border: '2px solid #e67e22', borderRadius: 16, padding: '16px 24px', textAlign: 'center', width: '100%' }}>
                            <div style={{ color: '#95a5a6', fontSize: '0.78rem', letterSpacing: 2, marginBottom: 4 }}>CÓDIGO DE SALA</div>
                            <div style={{ fontFamily: 'Righteous, sans-serif', fontSize: '3.5rem', color: '#e67e22', letterSpacing: 6 }}>{salaCreada}</div>
                        </div>
                        <div style={{ background: 'white', padding: 8, borderRadius: 12 }}>
                            <img src={qrUrl} alt="QR" style={{ width: 160, height: 160, display: 'block' }} />
                        </div>
                        <p style={{ color: '#bdc3c7', fontSize: '0.83rem', textAlign: 'center', margin: 0 }}>
                            Comparte el código o QR con los jugadores.<br />URL: <code style={{ color: '#f1c40f', fontSize: '0.75rem' }}>{roomUrl}</code>
                        </p>
                        {sinProfesor && (
                            <button style={btn('#2ecc71')} onClick={entrarASalaCreada}>
                                🎮 Entrar a jugar
                            </button>
                        )}
                        {!sinProfesor && (
                            <p style={{ color: '#95a5a6', fontSize: '0.82rem', textAlign: 'center', marginTop: 4 }}>
                                Muestra este código desde el dashboard de profesor para gestionar la partida.
                            </p>
                        )}
                        <button style={{ ...btn('rgba(255,255,255,0.1)'), marginTop: 0, border: '1px solid rgba(255,255,255,0.2)' }} onClick={() => setSalaCreada(null)}>
                            ← Crear otra sala
                        </button>
                    </div>
                )}

                {/* ── TAB UNIRSE ── */}
                {tab === 'UNIRSE' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div>
                            <label style={label}>Tu nombre</label>
                            <input style={inp} value={joinName} onChange={e => setJoinName(e.target.value)} placeholder="Tu nombre en el juego" />
                        </div>
                        <div>
                            <label style={label}>Código de sala (6 dígitos)</label>
                            <input style={{ ...inp, textAlign: 'center', fontSize: '1.8rem', letterSpacing: 6, fontFamily: 'Righteous, sans-serif' }} value={joinCode} onChange={e => setJoinCode(e.target.value.replace(/\D/g,'').substring(0,6))} placeholder="000000" maxLength={6} />
                        </div>
                        <button style={btn('#3498db')} onClick={unirseSala} disabled={joining || joinCode.length < 6 || !joinName.trim()}>
                            {joining ? '⏳ Conectando...' : '🚪 Entrar a la Sala'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

const styles = {
    input: { padding: '12px',width:'100%', borderRadius: '8px', border: '1px solid #ccc', outline: 'none', flex: 1, fontSize: '0.95rem' }
};