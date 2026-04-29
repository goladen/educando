import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import piGif      from '../assets/Piproyecto.gif';
import piNeutro   from '../assets/Pi-neutro.png';
import piContento from '../assets/Pi-contento.png';

/**
 * PiTutorial
 *
 * Props:
 *   usuario    — Firebase Auth user
 *   tutorialId — ID único que se persiste en Firestore
 *   pasos      — [{ texto: string }, ...]
 *   inline     — true: el botón minimizado aparece en el flujo del DOM (para barras de botones)
 *                false (default): el botón minimizado es position:fixed (esquina inferior-derecha)
 */
export default function PiTutorial({ usuario, tutorialId, pasos = [], inline = false }) {
    const [estado, setEstado]           = useState('cargando');
    const [paso, setPaso]               = useState(0);
    const [textoMostrado, setTexto]     = useState('');
    const [escrituraDone, setDone]      = useState(false);
    const [expandiendo, setExpandiendo] = useState(false);
    const [panelPos, setPanelPos]       = useState(null); // { top, right } calculado por ref
    const triggerRef = useRef(null);
    const timerRef   = useRef(null);

    // ── Comprobar si ya fue visto ──────────────────────────────────────
    useEffect(() => {
        if (!usuario || !tutorialId) { setEstado('minimizado'); return; }
        getDoc(doc(db, 'users', usuario.uid))
            .then(snap => {
                const vistos = snap.data()?.tutorialesVistos || [];
                setEstado(vistos.includes(tutorialId) ? 'minimizado' : 'visible');
            })
            .catch(() => setEstado('minimizado'));
    }, [usuario, tutorialId]);

    // ── Máquina de escribir + TTS ──────────────────────────────────────
    useEffect(() => {
        if (estado !== 'visible') return;
        const textoCompleto = pasos[paso]?.texto || '';
        setTexto('');
        setDone(false);

        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
            const textoTTS = textoCompleto.replace(/\p{Emoji}/gu, '').replace(/\s+/g, ' ').trim();
            const utt  = new SpeechSynthesisUtterance(textoTTS);
            utt.lang   = 'es-ES';
            utt.rate   = 0.88;
            utt.pitch  = 1.05;
            window.speechSynthesis.speak(utt);
        }

        let i = 0;
        clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            i++;
            setTexto(textoCompleto.slice(0, i));
            if (i >= textoCompleto.length) {
                clearInterval(timerRef.current);
                setDone(true);
            }
        }, 22);

        return () => {
            clearInterval(timerRef.current);
            window.speechSynthesis?.cancel();
        };
    }, [estado, paso]);

    // ── Helpers ────────────────────────────────────────────────────────
    const marcarVisto = async () => {
        if (!usuario) return;
        try {
            const ref  = doc(db, 'users', usuario.uid);
            const snap = await getDoc(ref);
            const prev = snap.data()?.tutorialesVistos || [];
            if (!prev.includes(tutorialId))
                await setDoc(ref, { tutorialesVistos: [...prev, tutorialId] }, { merge: true });
        } catch (_) {}
    };

    const handleCerrar = () => {
        window.speechSynthesis?.cancel();
        setEstado('minimizado');
        marcarVisto();
    };

    const handleSiguiente = () => {
        window.speechSynthesis?.cancel();
        paso < pasos.length - 1 ? setPaso(p => p + 1) : handleCerrar();
    };

    const handleAbrir = () => {
        // Calcular posición del panel relativa al botón trigger (solo modo inline)
        if (inline && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setPanelPos({
                top:   rect.bottom + 10,
                right: window.innerWidth - rect.right,
            });
        }
        setExpandiendo(true);
        setTimeout(() => {
            setExpandiendo(false);
            setPaso(0);
            setEstado('visible');
        }, 420);
    };

    const handleSkip = () => {
        if (!escrituraDone) {
            clearInterval(timerRef.current);
            window.speechSynthesis?.cancel();
            setTexto(pasos[paso]?.texto || '');
            setDone(true);
        }
    };

    if (estado === 'cargando' || !pasos.length) return null;

    // Imagen del panel: GIF mientras escribe, Pi-contento cuando termina
    const piPanelSrc = (estado === 'visible' && !escrituraDone) ? piGif : piContento;

    // Posición del panel (fixed):
    // - inline=true: se calcula dinámicamente al abrir
    // - inline=false: esquina inferior-derecha por defecto
    const panelStyle = inline && panelPos
        ? { position: 'fixed', top: `${panelPos.top}px`, right: `${panelPos.right}px`, bottom: 'auto' }
        : { position: 'fixed', bottom: '20px', right: '16px', top: 'auto' };

    return (
        <>
            {/* ═══════════════════════════════════════
                PANEL ABIERTO (siempre position:fixed)
            ═══════════════════════════════════════ */}
            {estado === 'visible' && (
                <div className="pi-panel" style={{
                    ...panelStyle,
                    zIndex: 9999,
                    display: 'flex',
                    flexDirection: 'row',       // burbuja IZQUIERDA, Pi DERECHA
                    alignItems: 'flex-end',
                    gap: '8px',
                    animation: 'piSlideIn 0.35s cubic-bezier(0.34,1.56,0.64,1)',
                }}>
                    {/* Burbuja */}
                    <div className="pi-panel-bubble" onClick={handleSkip} style={{
                        background: '#fff',
                        borderRadius: '18px 18px 4px 18px', // esquina inferior-derecha apunta a Pi
                        padding: '14px 16px',
                        maxWidth: '295px',
                        minWidth: '190px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 0 0 2px rgba(99,102,241,0.1)',
                        cursor: escrituraDone ? 'default' : 'pointer',
                        position: 'relative',
                    }}>
                        <button
                            onClick={e => { e.stopPropagation(); handleCerrar(); }}
                            style={{ position:'absolute', top:'6px', right:'8px', background:'none', border:'none', cursor:'pointer', fontSize:'16px', color:'#9ca3af', lineHeight:1, padding:'2px 4px' }}
                        >×</button>

                        {pasos.length > 1 && (
                            <div style={{ fontSize:'10px', color:'#a5b4fc', fontWeight:700, marginBottom:'4px', letterSpacing:'0.06em' }}>
                                {paso + 1} / {pasos.length}
                            </div>
                        )}

                        <p style={{ margin:0, fontSize:'13px', lineHeight:'1.65', color:'#1f2937', paddingRight:'14px' }}>
                            {textoMostrado}
                            {!escrituraDone && (
                                <span style={{
                                    display:'inline-block', width:'2px', height:'13px',
                                    background:'#6366f1', marginLeft:'1px',
                                    verticalAlign:'text-bottom',
                                    animation:'piCursor 0.7s step-end infinite',
                                }} />
                            )}
                        </p>

                        {escrituraDone && (
                            <div style={{ display:'flex', justifyContent:'flex-end', gap:'6px', marginTop:'10px' }}>
                                {paso < pasos.length - 1 ? (
                                    <>
                                        <button onClick={handleCerrar}    style={btn.secondary}>Omitir</button>
                                        <button onClick={handleSiguiente} style={btn.primary}>Siguiente →</button>
                                    </>
                                ) : (
                                    <button onClick={handleCerrar} style={btn.primary}>¡Entendido! 👍</button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Pi (GIF animado o imagen estática según estado escritura) */}
                    <img
                        className="pi-mascot"
                        src={piPanelSrc}
                        alt="Pi"
                        style={{
                            width: '86px',
                            height: 'auto',
                            flexShrink: 0,
                            filter: 'drop-shadow(0 4px 14px rgba(99,102,241,0.35))',
                        }}
                    />
                </div>
            )}

            {/* ═══════════════════════════════════════
                BOTÓN MINIMIZADO
                · inline=true  → en el flujo del DOM
                · inline=false → position:fixed esquina inferior-derecha
            ═══════════════════════════════════════ */}
            {estado === 'minimizado' && (
                inline
                    /* ── Botón inline (dentro de una barra de botones) ── */
                    ? (
                        <button
                            ref={triggerRef}
                            onClick={handleAbrir}
                            title="Ayuda"
                            style={{
                                background: 'transparent',
                                border: 'none',
                                borderRadius: '50%',
                                width: '40px',
                                height: '40px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                boxShadow: 'none',
                                padding: 0,
                                overflow: 'visible',
                                animation: expandiendo ? 'piExpand 0.42s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
                                transformOrigin: 'center',
                                transition: 'transform 0.15s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.12)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)';    }}
                        >
                            <img src={piNeutro} alt="Ayuda" style={{ width:'42px', height:'42px', objectFit:'contain' }} />
                        </button>
                    )
                    /* ── Botón fixed (esquina inferior-derecha) ── */
                    : (
                        <button
                            onClick={handleAbrir}
                            title="Ayuda"
                            style={{
                                position: 'fixed', bottom: '20px', right: '16px', zIndex: 9999,
                                background: 'white',
                                border: 'none',
                                borderRadius: '50%',
                                width: '54px',
                                height: '54px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                boxShadow: '0 4px 14px rgba(99,102,241,0.28)',
                                padding: 0,
                                overflow: 'hidden',
                                animation: expandiendo ? 'piExpand 0.42s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
                                transformOrigin: 'bottom right',
                                transition: 'transform 0.15s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)';   }}
                        >
                            <img src={piNeutro} alt="Ayuda" style={{ width:'42px', height:'42px', objectFit:'contain' }} />
                        </button>
                    )
            )}

            <style>{`
                @keyframes piSlideIn {
                    from { transform: translateY(12px); opacity: 0; }
                    to   { transform: translateY(0);    opacity: 1; }
                }
                @keyframes piCursor {
                    0%, 100% { opacity: 1; }
                    50%      { opacity: 0; }
                }
                @keyframes piExpand {
                    0%   { transform: scale(1);   }
                    45%  { transform: scale(2.2); }
                    75%  { transform: scale(1.7); }
                    100% { transform: scale(1);   }
                }
                @media (max-width: 520px) {
                    .pi-panel {
                        left: 8px !important;
                        right: 8px !important;
                        bottom: 12px !important;
                        top: auto !important;
                        width: auto !important;
                    }
                    .pi-panel-bubble {
                        flex: 1 !important;
                        max-width: none !important;
                        min-width: 0 !important;
                    }
                    .pi-mascot {
                        width: 64px !important;
                    }
                }
            `}</style>
        </>
    );
}

const btn = {
    primary: {
        padding:'6px 14px', fontSize:'12px', fontWeight:600,
        color:'#fff', background:'#6366f1', border:'none',
        borderRadius:'8px', cursor:'pointer',
    },
    secondary: {
        padding:'6px 10px', fontSize:'12px',
        color:'#6b7280', background:'none',
        border:'1px solid #e5e7eb', borderRadius:'8px', cursor:'pointer',
    },
};
