import React, { useState } from 'react';
import { QrCode, X, Copy, Check, ExternalLink, Share2, Settings } from 'lucide-react';
import { crearEnlaceReto, enlaceAbsoluto } from '../utils/retoLink';

const qrUrl = (url, size = 420) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=1a1a2e&margin=8`;

/**
 * Modal para compartir un reto: genera el enlace que abre la herramienta con una
 * configuración fija (la misma para todos los participantes).
 *
 *  <ModalCompartirReto ruta="/calculo" config={cfg} resumen={['120 s', '1–50', '+ −']}
 *                      nombreJuego="Cálculo Mental" onClose={…} />
 */
export default function ModalCompartirReto({ ruta, config, urlFija = null, resumen = [], nombreJuego = 'el juego', onEditar, onClose }) {
    const [titulo, setTitulo] = useState('');
    const [copiado, setCopiado] = useState(false);
    const [verQR, setVerQR]     = useState(false);

    // urlFija: enlace ya construido (p. ej. /?r=ID de un recurso); si no, reto ?reto=…
    const url = urlFija ? enlaceAbsoluto(urlFija) : crearEnlaceReto(ruta, config, { titulo });

    const copiar = async () => {
        try { await navigator.clipboard.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 1800); }
        catch (_) { window.prompt('Copia el enlace:', url); }
    };
    const compartirNativo = async () => {
        try { if (navigator.share) { await navigator.share({ title: titulo || nombreJuego, url }); return; } } catch (_) { return; }
        copiar();
    };

    return (
        <div onClick={onClose} style={st.overlay}>
            <div onClick={e => e.stopPropagation()} style={st.panel}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.05rem' }}>🔗 Compartir esta configuración</span>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={22} /></button>
                </div>

                <p style={{ margin: '0 0 14px', color: '#64748b', fontSize: '0.88rem', lineHeight: 1.5 }}>
                    Quien abra este enlace jugará a <strong>{nombreJuego}</strong> con exactamente esta configuración:
                    no puede cambiarla, así que todos los participantes compiten en igualdad.
                </p>

                {resumen.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                        {resumen.map((r, i) => <span key={i} style={st.chip}>{r}</span>)}
                    </div>
                )}

                <div style={st.label}>{urlFija ? 'Título para el mensaje (opcional)' : 'Nombre del reto (opcional)'}</div>
                <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ej: Reto de cálculo de 2ºB" style={st.input} />

                <div style={st.label}>Enlace</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
                    <input readOnly value={url} onFocus={e => e.target.select()} style={{ ...st.input, marginBottom: 0, fontSize: '0.78rem', color: '#475569' }} />
                    <button onClick={copiar} style={{ ...st.btn, background: copiado ? '#27ae60' : '#1565C0', color: 'white', flexShrink: 0 }}>
                        {copiado ? <><Check size={15} /> Copiado</> : <><Copy size={15} /> Copiar</>}
                    </button>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => setVerQR(v => !v)} style={{ ...st.btn, ...st.btnSec }}><QrCode size={15} /> {verQR ? 'Ocultar QR' : 'Ver QR'}</button>
                    <button onClick={compartirNativo} style={{ ...st.btn, ...st.btnSec }}><Share2 size={15} /> Compartir</button>
                    <a href={url} target="_blank" rel="noreferrer" style={{ ...st.btn, ...st.btnSec, textDecoration: 'none' }}><ExternalLink size={15} /> Probar</a>
                    {onEditar && <button onClick={onEditar} style={{ ...st.btn, ...st.btnSec }}><Settings size={15} /> Cambiar configuración</button>}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                    <button onClick={() => window.open(`https://classroom.google.com/share?url=${encodeURIComponent(url)}`, '_blank')} style={{ ...st.btn, background: '#e3f2fd', color: '#1565C0' }}>🎓 Classroom</button>
                    <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`${titulo || nombreJuego}\n${url}`)}`, '_blank')} style={{ ...st.btn, background: '#e8f8ee', color: '#1e9e50' }}>💬 WhatsApp</button>
                    <button onClick={() => window.open(`mailto:?subject=${encodeURIComponent(titulo || nombreJuego)}&body=${encodeURIComponent(url)}`, '_blank')} style={{ ...st.btn, background: '#fdecea', color: '#c0392b' }}>📧 Correo</button>
                </div>

                {verQR && (
                    <img src={qrUrl(url)} alt="Código QR del reto"
                        style={{ display: 'block', margin: '16px auto 0', width: 'min(56vh, 70vw, 300px)', height: 'min(56vh, 70vw, 300px)', borderRadius: 14, border: '1px solid #e2e8f0' }} />
                )}
            </div>
        </div>
    );
}

const st = {
    overlay: { position: 'fixed', inset: 0, zIndex: 12000, background: 'rgba(8,12,24,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(4px)' },
    panel:   { background: 'white', borderRadius: 22, padding: '22px 24px', maxWidth: 520, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.45)', maxHeight: '90vh', overflowY: 'auto', fontFamily: "'Segoe UI', sans-serif" },
    label:   { fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 },
    input:   { padding: '9px 12px', borderRadius: 9, border: '1.5px solid #e2e8f0', fontSize: '0.88rem', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 12, background: 'white' },
    btn:     { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'inherit' },
    btnSec:  { background: 'white', color: '#1565C0', border: '1.5px solid #cdd6ea' },
    chip:    { background: '#eef4fb', color: '#1565C0', borderRadius: 20, padding: '4px 12px', fontSize: '0.78rem', fontWeight: 700 },
};
