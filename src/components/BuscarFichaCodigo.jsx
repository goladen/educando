// Casilla «🎟️ Código de la ficha» para las pantallas de elegir recurso de cada juego.
// El alumno escribe el código impreso en la ficha PDF (FXXXXXX, utils/fichaCodigo.js) y se abre
// el juego con esas preguntas en ese orden (vía /?fc=, que resuelve App.jsx). Sin escanear el QR.
import { useState } from 'react';
import { esCodigoFicha, leerCodigoFicha } from '../utils/fichaCodigo';

const limpio = (c) => String(c ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export default function BuscarFichaCodigo({ oscuro = false, style }) {
    const [codigo, setCodigo] = useState('');
    const [estado, setEstado] = useState(''); // '' | 'buscando' | mensaje de error

    const abrir = async () => {
        const c = limpio(codigo);
        if (!esCodigoFicha(c)) { setEstado('El código de la ficha empieza por F y tiene 7 caracteres (ej.: FK7P3QX).'); return; }
        setEstado('buscando');
        try {
            const f = await leerCodigoFicha(c);
            if (!f) { setEstado('No existe ninguna ficha con ese código. Revisa las letras.'); return; }
            window.location.href = `/?fc=${c}`;
        } catch (e) {
            console.error(e);
            setEstado('No se pudo buscar la ficha. Comprueba la conexión.');
        }
    };

    const texto = oscuro ? '#e2e8f0' : '#334155';
    return (
        <div style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 12,
            background: oscuro ? 'rgba(255,255,255,0.07)' : '#f5f3ff', border: `1.5px dashed ${oscuro ? 'rgba(196,181,253,0.55)' : '#c4b5fd'}`,
            fontFamily: 'inherit', ...style,
        }}>
            <span style={{ fontWeight: 800, fontSize: '0.88rem', color: oscuro ? '#c4b5fd' : '#6d28d9', whiteSpace: 'nowrap' }}>🎟️ ¿Tienes una ficha en papel?</span>
            <input
                value={codigo}
                onChange={e => { setCodigo(e.target.value.toUpperCase()); if (estado && estado !== 'buscando') setEstado(''); }}
                onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); abrir(); } }}
                placeholder="CÓDIGO (F…)"
                maxLength={9}
                aria-label="Código de la ficha"
                style={{
                    flex: '1 1 120px', minWidth: 110, padding: '8px 10px', borderRadius: 9, fontSize: '1rem', fontWeight: 800,
                    letterSpacing: 3, textTransform: 'uppercase', textAlign: 'center', boxSizing: 'border-box',
                    border: `2px solid ${oscuro ? 'rgba(255,255,255,0.25)' : '#ddd6fe'}`,
                    background: oscuro ? 'rgba(15,23,42,0.6)' : 'white', color: oscuro ? 'white' : '#1e1b4b', fontFamily: 'inherit',
                }}
            />
            <button type="button" onClick={abrir} disabled={estado === 'buscando'}
                style={{ padding: '8px 14px', borderRadius: 9, border: 'none', background: '#6d28d9', color: 'white', fontWeight: 800, cursor: 'pointer', fontSize: '0.88rem', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                {estado === 'buscando' ? '⏳' : 'Jugar la ficha'}
            </button>
            {estado && estado !== 'buscando' && <div style={{ flex: '1 1 100%', fontSize: '0.8rem', color: oscuro ? '#fca5a5' : '#b91c1c' }}>{estado}</div>}
            {!estado && <div style={{ flex: '1 1 100%', fontSize: '0.74rem', color: texto, opacity: 0.75 }}>Escribe el código impreso junto al QR: salen las mismas preguntas y en el mismo orden.</div>}
        </div>
    );
}
