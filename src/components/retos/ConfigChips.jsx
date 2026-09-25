import React from 'react';

// Piezas compartidas por los editores de configuración de retos
// (Biología, Geografía, Sintaxis…): mismo aspecto que el resto de modales.
const AZUL = '#1565C0';

export const Chip = ({ active, onClick, children, color = AZUL, disabled }) => (
    <button onClick={disabled ? undefined : onClick} style={{
        padding: '8px 15px', borderRadius: 20, border: 'none', fontWeight: 700, fontSize: '0.86rem',
        background: active ? color : '#f0f0f0', color: active ? 'white' : (disabled ? '#bbb' : '#555'),
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, fontFamily: 'inherit',
    }}>{children}</button>
);

export const Seccion = ({ label, children }) => (
    <div style={{ marginBottom: 18 }}>
        <div style={{ fontWeight: 700, color: '#7f8c8d', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 9, textAlign: 'center' }}>{label}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>{children}</div>
    </div>
);

export const NumeroPreguntas = ({ valor, onChange, opciones = [5, 10, 15, 20], color = AZUL }) => {
    const otro = !opciones.includes(valor);
    return (
        <>
            {opciones.map(n => <Chip key={n} active={valor === n} onClick={() => onChange(n)} color={color}>{n}</Chip>)}
            <input type="number" min="1" max="50" placeholder="···" value={otro ? valor : ''}
                onChange={e => { const v = parseInt(e.target.value); if (v > 0) onChange(v); }}
                style={{ width: 54, padding: '7px 8px', borderRadius: 20, border: `2px solid ${otro ? color : '#ccc'}`, textAlign: 'center', fontSize: '0.9rem', outline: 'none', fontWeight: 'bold', color: '#333', fontFamily: 'inherit' }} />
        </>
    );
};

export const MarcoConfig = ({ titulo, textoAceptar = '✔ Usar esta configuración', onAceptar, onClose, children, color = AZUL }) => (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.62)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        onClick={onClose}>
        <div onClick={e => e.stopPropagation()}
            style={{ background: 'white', borderRadius: 20, padding: '26px 22px', maxWidth: 470, width: '100%', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.35)', fontFamily: "'Segoe UI', sans-serif" }}>
            <h2 style={{ margin: '0 0 18px', color: '#2c3e50', fontSize: '1.2rem', textAlign: 'center' }}>{titulo}</h2>
            {children}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 14 }}>
                <button onClick={onClose} style={{ padding: '12px 22px', background: '#f0f0f0', color: '#555', border: 'none', borderRadius: 30, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
                <button onClick={onAceptar} style={{ padding: '12px 24px', background: color, color: 'white', border: 'none', borderRadius: 30, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}>{textoAceptar}</button>
            </div>
        </div>
    </div>
);
