import { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import TrivialGame from './Trivial';
import CaidaEscalada from './Simuladores física/CaidaEscalada';
import WhoKnows from './WhoKnows';
import TrivialEnvioForm from './components/TrivialEnvioForm';

// ⚠️ ID del recurso del "Trivial de escalada" en Firebase (colección trivial_recursos).
// Sustituir por el ID real que te pase el usuario.
const CLIMBING_TRIVIAL_ID = 'ki0UtmWJ5nOiXLsBJ9Vb';

const CARDS = [
    { key: 'TRIVIAL',  emoji: '🧗', titulo: 'Trivial de escalada', desc: 'Preguntas por categorías sobre escalada, hasta 6 jugadores.', color: '#16213e' },
    { key: 'WHOKNOWS', emoji: '🧠', titulo: 'Who Knows?',          desc: 'Test cronometrado por categorías con ranking global.', color: '#22c55e' },
    { key: 'SEND',     emoji: '✉️', titulo: 'Send your question',  desc: 'Envía tus preguntas al banco de escalada para que el profe las revise.', color: '#f59e0b' },
    { key: 'SIM',      emoji: '🪂', titulo: 'Simulador de caída',   desc: 'Fuerzas de una caída deportiva según cuerda, factor y anclaje.', color: '#0ea5e9' },
];

// Obtiene el código de envío del recurso de escalada y abre el formulario de envío.
function EnvioEscalada({ onBack }) {
    const [estado, setEstado] = useState('cargando'); // cargando | listo | sincodigo
    const [codigo, setCodigo] = useState('');
    useEffect(() => {
        let cancel = false;
        (async () => {
            try {
                const snap = await getDoc(doc(db, 'trivial_recursos', CLIMBING_TRIVIAL_ID));
                const code = snap.exists() ? snap.data().codigoEnvio : null;
                if (cancel) return;
                if (code) { setCodigo(code); setEstado('listo'); } else setEstado('sincodigo');
            } catch { if (!cancel) setEstado('sincodigo'); }
        })();
        return () => { cancel = true; };
    }, []);

    if (estado === 'cargando') {
        return <div style={{ minHeight: '100vh', background: '#0f172a', color: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Cargando…</div>;
    }
    if (estado === 'sincodigo') {
        return (
            <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#0f172a,#1e3a5f)', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: 10 }}>✉️</div>
                <h2 style={{ margin: '0 0 8px' }}>Envío no disponible todavía</h2>
                <p style={{ color: '#94a3b8', maxWidth: 420, margin: '0 0 24px' }}>El profesor aún no ha activado el envío de preguntas para este Trivial. Debe generar un <strong>código de envío</strong> desde el editor del Trivial de escalada.</p>
                <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)', color: 'white', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', fontWeight: 700 }}>← Climbing</button>
            </div>
        );
    }
    return <TrivialEnvioForm codigoInicial={codigo} onBack={onBack} />;
}

export default function ClimbingHub({ onExit }) {
    const [vista, setVista] = useState('MENU'); // MENU | TRIVIAL | SIM

    const volverMenu = () => setVista('MENU');
    const cerrar = () => { if (onExit) onExit(); else { try { window.close(); } catch { /* noop */ } window.location.href = '/'; } };

    if (vista === 'TRIVIAL') {
        return <TrivialGame recursoIdInicial={CLIMBING_TRIVIAL_ID} onExit={volverMenu} />;
    }

    if (vista === 'WHOKNOWS') {
        return <WhoKnows onExit={volverMenu} />;
    }

    if (vista === 'SEND') {
        return <EnvioEscalada onBack={volverMenu} />;
    }

    if (vista === 'SIM') {
        return (
            <div style={{ position: 'relative', minHeight: '100vh' }}>
                <button onClick={volverMenu}
                    style={{ position: 'fixed', top: 12, left: 12, zIndex: 9999, background: 'rgba(15,23,42,0.85)', border: '1px solid #475569', color: '#e2e8f0', borderRadius: 10, padding: '8px 14px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', backdropFilter: 'blur(6px)' }}>
                    ← Climbing
                </button>
                <CaidaEscalada />
            </div>
        );
    }

    // ── MENÚ ──
    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #0b1220 0%, #0e2233 60%, #0a2a3a 100%)', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px', fontFamily: "'Segoe UI', sans-serif" }}>
            <div style={{ width: '100%', maxWidth: 720, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <button onClick={cerrar} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: '#cbd5e1', borderRadius: 10, padding: '7px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>← Volver</button>
            </div>

            <div style={{ textAlign: 'center', margin: '18px 0 34px' }}>
                <div style={{ fontSize: '3.4rem', lineHeight: 1 }}>🧗</div>
                <h1 style={{ margin: '10px 0 4px', fontSize: 'clamp(1.8rem,5vw,2.6rem)', fontWeight: 900, letterSpacing: 1 }}>Climbing</h1>
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '1rem' }}>Elige una actividad</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, width: '100%', maxWidth: 720 }}>
                {CARDS.map(c => (
                    <button key={c.key} onClick={() => setVista(c.key)}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `0 16px 40px ${c.color}66`; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.4)'; }}
                        style={{ background: 'rgba(255,255,255,0.05)', border: `2px solid ${c.color}`, borderRadius: 22, padding: '34px 22px', cursor: 'pointer', color: 'white', textAlign: 'center', transition: 'transform 0.18s, box-shadow 0.18s', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: '3.4rem', lineHeight: 1 }}>{c.emoji}</span>
                        <span style={{ fontSize: '1.35rem', fontWeight: 800 }}>{c.titulo}</span>
                        <span style={{ color: '#94a3b8', fontSize: '0.92rem', lineHeight: 1.4 }}>{c.desc}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
