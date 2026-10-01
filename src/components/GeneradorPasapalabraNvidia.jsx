import React, { useState } from 'react';
import { generarPasapalabraNvidia } from '../NvidiaGenerator';

// Formulario de generación de Pasapalabra con la IA de NVIDIA (solo admin).
const IDIOMAS = ['Español', 'Inglés', 'Francés', 'Catalán', 'Alemán', 'Italiano', 'Portugués'];
const NIVELES = ['1º-2º Primaria', '3º-4º Primaria', '5º-6º Primaria', '1º-2º ESO', '3º-4º ESO', 'Bachillerato', 'Adultos'];

export default function GeneradorPasapalabraNvidia({ onGenerado }) {
    const [abierto, setAbierto] = useState(false);
    const [tema, setTema] = useState('');
    const [idioma, setIdioma] = useState('Español');
    const [nivel, setNivel] = useState('5º-6º Primaria');
    const [num, setNum] = useState(20);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState('');

    const generar = async () => {
        if (!tema.trim()) { setError('Escribe una temática.'); return; }
        setCargando(true);
        setError('');
        try {
            const hojas = await generarPasapalabraNvidia({ tema: tema.trim(), idioma, nivel, numPreguntas: num });
            const obtenidas = hojas[0].preguntas.length;
            if (obtenidas < num) alert(`La IA generó ${obtenidas} preguntas válidas de ${num}. Puedes completar el resto en el editor.`);
            onGenerado(hojas, { tema: tema.trim(), idioma, nivel });
        } catch (e) {
            setError(e.message);
        }
        setCargando(false);
    };

    if (!abierto) {
        return (
            <button onClick={() => setAbierto(true)} style={{ ...s.btn, marginTop: 12, width: '100%', background: '#76b900' }}>
                ⚡ Generar con NVIDIA IA
            </button>
        );
    }

    return (
        <div style={{ marginTop: 16, padding: 14, border: '2px solid #76b900', borderRadius: 10, background: '#f6fbef' }}>
            <div style={{ fontWeight: 'bold', marginBottom: 10 }}>⚡ Generar rosco con NVIDIA IA</div>

            <label style={s.label}>Temática</label>
            <input value={tema} onChange={e => setTema(e.target.value)} style={s.input}
                placeholder="Ej: El sistema solar, animales vertebrados…" disabled={cargando} />

            <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                    <label style={s.label}>Idioma</label>
                    <select value={idioma} onChange={e => setIdioma(e.target.value)} style={s.input} disabled={cargando}>
                        {IDIOMAS.map(i => <option key={i}>{i}</option>)}
                    </select>
                </div>
                <div style={{ flex: 1 }}>
                    <label style={s.label}>Nivel</label>
                    <select value={nivel} onChange={e => setNivel(e.target.value)} style={s.input} disabled={cargando}>
                        {NIVELES.map(n => <option key={n}>{n}</option>)}
                    </select>
                </div>
            </div>

            <label style={s.label}>Número de preguntas: <b>{num}</b></label>
            <input type="range" min={15} max={25} value={num} onChange={e => setNum(Number(e.target.value))}
                style={{ width: '100%' }} disabled={cargando} />

            {error && <div style={{ color: '#c0392b', fontSize: 13, marginTop: 8 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button onClick={() => setAbierto(false)} style={{ ...s.btn, background: '#95a5a6' }} disabled={cargando}>Cancelar</button>
                <button onClick={generar} style={{ ...s.btn, flex: 1, background: '#76b900' }} disabled={cargando}>
                    {cargando ? 'Generando… (puede tardar ~30 s)' : 'Generar'}
                </button>
            </div>
        </div>
    );
}

const s = {
    btn: { padding: '10px 16px', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' },
    label: { display: 'block', fontSize: 12, fontWeight: 'bold', color: '#555', margin: '8px 0 4px' },
    input: { width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc', boxSizing: 'border-box' },
};
