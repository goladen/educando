// MenuPublico.jsx — Menú hamburguesa de la portada pública.
// Se usa en Login (visitante sin sesión) y en la Vista Alumno del profesor.
// Los enlaces externos se abren aquí; las vistas internas se delegan con
// onNavegar('inicio' | 'populares' | 'paginas-profesores' | 'comunidades').
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Menu, X } from 'lucide-react';
import KofiBoton from './KofiBoton';

const OPCIONES = [
    { id: 'inicio',             label: '🏠 Inicio' },
    { id: 'populares',          label: '🔥 Los juegos más populares' },
    { id: 'paginas-profesores', label: '👨‍🏫 Páginas de profesores' },
    { id: 'comunidades',        label: '👥 Comunidades' },
    { id: 'que-hacer',          label: '❓ ¿Qué puedo hacer?' },
    { id: 'instagram',          label: '📸 Síguenos en Instagram' },
    { id: 'privacidad',         label: '🔒 Política de privacidad' },
];

const EXTERNOS = {
    'que-hacer':  '/guia-pikt-es.html',
    instagram:    'https://www.instagram.com/pikt314/',
    privacidad:   'https://www.pikt.es/politica.html',
};

export default function MenuPublico({ onNavegar, botonStyle, iconColor = 'white' }) {
    const [abierto, setAbierto] = useState(false);

    const elegir = (id) => {
        setAbierto(false);
        if (EXTERNOS[id]) window.open(EXTERNOS[id], '_blank');
        else onNavegar?.(id);
    };

    return (
        <>
            <button onClick={() => setAbierto(true)} aria-label="Abrir menú" style={{ ...s.boton, ...botonStyle }}>
                <Menu size={28} color={iconColor} />
            </button>
            {abierto && createPortal(
                <div style={s.overlay} onClick={() => setAbierto(false)}>
                    <div style={s.panel} onClick={(e) => e.stopPropagation()}>
                        <div style={s.cabecera}>
                            <h2 style={{ margin: 0 }}>Menú</h2>
                            <button onClick={() => setAbierto(false)} aria-label="Cerrar menú" style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={28} /></button>
                        </div>
                        <ul style={s.lista}>
                            {OPCIONES.map(o => (
                                <li key={o.id} style={s.item} onClick={() => elegir(o.id)}>{o.label}</li>
                            ))}
                        </ul>
                        <div style={{ padding: '20px', textAlign: 'center' }}>
                            <KofiBoton />
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}

const s = {
    boton:    { background: 'rgba(255, 255, 255, 0.2)', border: 'none', borderRadius: '8px', padding: '8px', cursor: 'pointer', backdropFilter: 'blur(5px)', pointerEvents: 'auto', display: 'flex' },
    overlay:  { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 10000, pointerEvents: 'auto' },
    panel:    { width: '80%', maxWidth: '300px', height: '100%', backgroundColor: 'white', display: 'flex', flexDirection: 'column', overflowY: 'auto' },
    cabecera: { display: 'flex', justifyContent: 'space-between', padding: '20px', borderBottom: '1px solid #eee', color: '#333' },
    lista:    { listStyle: 'none', padding: 0, margin: 0 },
    item:     { padding: '20px', borderBottom: '1px solid #eee', cursor: 'pointer', fontSize: '1.1rem', color: '#333' },
};
