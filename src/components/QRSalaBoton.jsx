import React, { useState } from 'react';
import { QrCode, X, Copy, Check } from 'lucide-react';

// URL de entrada directa a una sesión en vivo: pikt.es/?live=CODIGO
export const urlSalaEnVivo = (codigo) =>
    `${window.location.origin}/?live=${encodeURIComponent(String(codigo || '').toUpperCase().trim())}`;

const qrUrl = (url, size, color = '1a1a2e') =>
    `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=${color}&margin=8`;

/**
 * Botón + modal para compartir por QR una sesión en vivo.
 * Los alumnos escanean y entran directos al juego (solo tienen que poner su nombre).
 */
export default function QRSalaBoton({ codigo, texto = 'Compartir QR', style = {} }) {
    const [abierto, setAbierto] = useState(false);
    const [copiado, setCopiado] = useState(false);
    if (!codigo) return null;

    const url = urlSalaEnVivo(codigo);

    const copiar = async () => {
        try {
            await navigator.clipboard.writeText(url);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 1800);
        } catch (e) {
            window.prompt('Copia el enlace:', url);
        }
    };

    return (
        <>
            <button onClick={() => setAbierto(true)} title="Compartir la sala por QR"
                style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px',
                    borderRadius: 12, border: '2px solid rgba(255,255,255,0.35)',
                    background: 'rgba(255,255,255,0.15)', color: 'white', fontWeight: 700,
                    fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit', ...style
                }}>
                <QrCode size={18} /> {texto}
            </button>

            {abierto && (
                <div onClick={() => setAbierto(false)}
                    style={{ position: 'fixed', inset: 0, zIndex: 12000, background: 'rgba(8,12,24,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(4px)' }}>
                    <div onClick={e => e.stopPropagation()}
                        style={{ background: 'white', borderRadius: 22, padding: '22px 24px', maxWidth: 520, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.45)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <span style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.05rem' }}>📱 Entrar escaneando</span>
                            <button onClick={() => setAbierto(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={22} /></button>
                        </div>

                        <p style={{ margin: '0 0 14px', color: '#64748b', fontSize: '0.88rem' }}>
                            Proyecta este QR: al escanearlo, tus alumnos entran directos a la sala.
                        </p>

                        <img src={qrUrl(url, 420)} alt={`Código QR para unirse a la sala ${codigo}`}
                            style={{ display: 'block', margin: '0 auto', width: 'min(62vh, 78vw, 340px)', height: 'min(62vh, 78vw, 340px)', borderRadius: 14, border: '1px solid #e2e8f0' }} />

                        <div style={{ margin: '14px 0 6px', fontSize: '0.78rem', color: '#94a3b8', fontWeight: 700, letterSpacing: 1 }}>CÓDIGO DE SALA</div>
                        <div style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: 8, color: '#1e293b', fontFamily: 'monospace' }}>{String(codigo).toUpperCase()}</div>

                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 16, background: '#f1f5f9', borderRadius: 12, padding: '8px 10px' }}>
                            <span style={{ flex: 1, fontSize: '0.8rem', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>{url}</span>
                            <button onClick={copiar}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: 'none', background: copiado ? '#16a34a' : '#3498db', color: 'white', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                                {copiado ? <><Check size={15} /> Copiado</> : <><Copy size={15} /> Copiar</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
