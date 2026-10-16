// ineCompartir.jsx — Ventana de compartir (enlace, QR, WhatsApp, Telegram, correo, Classroom) del Explorador INE.
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { D } from './ineGraficos';

const CARD = { background: D.card, borderRadius: 14, padding: 18, border: `1px solid ${D.border}` };

export default function ModalCompartir({ url, titulo, onClose }) {
    const [copiado, setCopiado] = useState(false);
    const texto = encodeURIComponent(`📊 ${titulo}\n${url}`);
    const copiar = () => { navigator.clipboard?.writeText(url).catch(() => {}); setCopiado(true); setTimeout(() => setCopiado(false), 2000); };
    const ops = [
        { l: copiado ? 'Copiado' : 'Copiar enlace', i: copiado ? '✅' : '🔗', a: copiar },
        { l: 'WhatsApp', i: '💬', a: () => window.open(`https://wa.me/?text=${texto}`, '_blank') },
        { l: 'Telegram', i: '✈️', a: () => window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(titulo)}`, '_blank') },
        { l: 'Correo', i: '📧', a: () => window.open(`mailto:?subject=${encodeURIComponent(titulo)}&body=${texto}`, '_blank') },
        { l: 'Google Classroom', i: '🎓', a: () => window.open(`https://classroom.google.com/share?url=${encodeURIComponent(url)}`, '_blank') },
    ];
    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9100, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ ...CARD, width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <b>Compartir: {titulo}</b>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: D.muted, cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                    <img alt="Código QR del enlace" width={110} height={110} style={{ borderRadius: 8, background: 'white', flexShrink: 0 }}
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=0d1117&margin=8`} />
                    <div style={{ fontSize: '0.75rem', color: D.muted, wordBreak: 'break-all', background: D.bg, borderRadius: 8, padding: '8px 10px', border: `1px solid ${D.border}` }}>{url}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {ops.map(o => (
                        <button key={o.l} onClick={o.a} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, border: `1px solid ${D.border}`, background: D.bg, color: D.text, cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600, textAlign: 'left' }}>
                            <span style={{ width: 22, textAlign: 'center' }}>{o.i}</span>{o.l}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
