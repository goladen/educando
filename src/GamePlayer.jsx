import { useState } from 'react';
import { Home, Play } from 'lucide-react';

// ─── PANTALLA DE PRESENTACIÓN PREVIA ─────────────────────────────────────────
function toEmbedUrl(url) {
    if (!url) return '';
    let m = url.match(/youtube\.com\/watch\?(?:.*&)?v=([^&]+)/);
    if (m) return `https://www.youtube.com/embed/${m[1]}`;
    m = url.match(/youtu\.be\/([^?&]+)/);
    if (m) return `https://www.youtube.com/embed/${m[1]}`;
    m = url.match(/vimeo\.com\/(\d+)/);
    if (m) return `https://player.vimeo.com/video/${m[1]}`;
    return url;
}

function PantallaPresentacion({ presentacion, onEmpezar }) {
    return (
        <div style={{
            position: 'fixed', inset: 0,
            background: 'linear-gradient(160deg, #0f0c29 0%, #302b63 55%, #24243e 100%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            zIndex: 9998, padding: '24px 20px', overflowY: 'auto', fontFamily: 'Arial, sans-serif',
            boxSizing: 'border-box'
        }}>
            <div style={{ width: '100%', maxWidth: 580, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>

                {/* Título con animación */}
                <h1 style={{
                    color: 'white', margin: 0,
                    fontSize: 'clamp(1.6rem, 5vw, 2.8rem)',
                    textAlign: 'center', fontWeight: 900, lineHeight: 1.2,
                    textShadow: '0 0 40px rgba(255,255,255,0.22)',
                    animation: 'presTitle 0.7s cubic-bezier(0.34,1.56,0.64,1) both'
                }}>
                    {presentacion.titulo}
                </h1>

                {/* Vídeo o Imagen */}
                {presentacion.video && toEmbedUrl(presentacion.video) ? (
                    <div style={{
                        width: '100%', borderRadius: 18, overflow: 'hidden',
                        boxShadow: '0 24px 64px rgba(0,0,0,0.65)',
                        position: 'relative', paddingBottom: '56.25%', background: '#000',
                        animation: 'presFade 0.6s 0.2s ease both'
                    }}>
                        <iframe
                            src={toEmbedUrl(presentacion.video)}
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            title={presentacion.titulo}
                        />
                    </div>
                ) : presentacion.imagen ? (
                    <div style={{
                        width: '100%', borderRadius: 18, overflow: 'hidden',
                        boxShadow: '0 24px 64px rgba(0,0,0,0.65)',
                        animation: 'presFade 0.6s 0.2s ease both'
                    }}>
                        <img
                            src={presentacion.imagen}
                            alt={presentacion.titulo}
                            style={{
                                width: '100%', height: 'auto', display: 'block',
                                maxHeight: '42vh', objectFit: 'cover'
                            }}
                        />
                    </div>
                ) : null}

                {/* Descripción */}
                {presentacion.descripcion && (
                    <p style={{
                        color: 'rgba(255,255,255,0.88)', margin: 0,
                        fontSize: 'clamp(0.95rem, 2.5vw, 1.1rem)',
                        textAlign: 'center', lineHeight: 1.7,
                        animation: 'presFade 0.6s 0.35s ease both'
                    }}>
                        {presentacion.descripcion}
                    </p>
                )}

                {/* Botón Empezar */}
                <button
                    onClick={onEmpezar}
                    style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white', border: 'none', borderRadius: 50,
                        padding: '16px 52px', fontSize: '1.1rem', fontWeight: 800,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                        boxShadow: '0 8px 30px rgba(102,126,234,0.55)',
                        animation: 'presBtn 0.5s 0.5s ease both',
                        transition: 'transform 0.15s, box-shadow 0.15s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.06)'; e.currentTarget.style.boxShadow = '0 12px 36px rgba(102,126,234,0.7)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(102,126,234,0.55)'; }}
                >
                    <Play size={20} fill="white" /> ¡Empezar!
                </button>
            </div>

            <style>{`
                @keyframes presTitle {
                    from { transform: translateY(-40px) scale(0.88); opacity: 0; }
                    to   { transform: translateY(0) scale(1); opacity: 1; }
                }
                @keyframes presFade {
                    from { transform: translateY(18px); opacity: 0; }
                    to   { transform: translateY(0); opacity: 1; }
                }
                @keyframes presBtn {
                    from { transform: scale(0.75); opacity: 0; }
                    to   { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
import PasapalabraGame from './PasapalabraGame';
import CazaBurbujasGame from './CazaBurbujasGame';
import PikatronRun from './PikatronRun';
import Plataformas from './Plataformas2';
import AparejadosGame from './AparejadosGame';
import ThinkHootGame from './ThinkHootGame';
import RuletaGame from './RuletaGame';
import KartingedGame from './KartingedGame';
import IrregularVerbsTest from './IrregularVerbsTest';

export default function GamePlayer({ recurso, usuario, alTerminar, autoStart = false, hojaInicial = null, modoInicial = null }) {
    const tienePresentacion = !!(recurso.presentacion?.titulo);
    const [presentacionVista, setPresentacionVista] = useState(!tienePresentacion);

    // Botón de Salir al Inicio (Cierra el juego actual)
    const BotonCasa = () => (
        <button
            onClick={alTerminar}
            style={{
                position: 'fixed', top: '10px', left: '10px', zIndex: 9999,
                background: 'white', border: '2px solid #333', borderRadius: '50%',
                width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
            }}
            title="Volver al Inicio"
        >
            <Home size={24} color="#333" />
        </button>
    );

    if (!presentacionVista) return (
        <>
            <BotonCasa />
            <PantallaPresentacion
                presentacion={recurso.presentacion}
                onEmpezar={() => setPresentacionVista(true)}
            />
        </>
    );

    return (
        <>
            <BotonCasa />

            {recurso.tipoJuego === 'PASAPALABRA' && (
                <PasapalabraGame recurso={recurso} usuario={usuario} alTerminar={alTerminar} autoStart={autoStart} hojaInicial={hojaInicial}/>
            )}

            {(recurso.tipoJuego === 'CAZABURBUJAS' || recurso.tipoJuego === 'PIKATRON') && (() => {
                // Determinar modo: modoInicial del URL, o default según tipoJuego
                const modo = modoInicial || (recurso.tipoJuego === 'PIKATRON' ? 'PIKATRON' : 'BURBUJAS');
                if (modo === 'PIKATRON') {
                    return <PikatronRun recurso={recurso} usuario={usuario} onExit={alTerminar} autoStart={autoStart} hojaInicial={hojaInicial} />;
                }
                if (modo === 'PLATAFORMAS') {
                    return <Plataformas onExit={alTerminar} recursoInicial={recurso} hojaInicial={hojaInicial} />;
                }
                return <CazaBurbujasGame recurso={recurso} usuario={usuario} alTerminar={alTerminar}
                    autoStart={autoStart} hojaInicial={hojaInicial}
                    modoJuegoInicial={modo === 'TEST' ? 'Test' : 'Burbujas'} />;
            })()}

            {recurso.tipoJuego === 'APAREJADOS' && (
                <AparejadosGame recurso={recurso} usuario={usuario} alTerminar={alTerminar} />
            )}

            {recurso.tipoJuego === 'RULETA' && (
                <RuletaGame recurso={recurso} usuario={usuario} alTerminar={alTerminar} />
            )}

            {recurso.tipoJuego === 'THINKHOOT' && (
                <ThinkHootGame
                    isHost={false}
                    codigoSala={recurso.id}
                    usuario={usuario}
                    onExit={alTerminar}
                />
            )}

            {recurso.tipoJuego === 'KARTINGED' && (
                <KartingedGame alTerminar={alTerminar} />
            )}

            {recurso.tipoJuego === 'IRREGULAR_VERBS' && (
                <IrregularVerbsTest />
            )}
        </>
    );
}