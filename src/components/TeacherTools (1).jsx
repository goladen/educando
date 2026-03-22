import React, { useState } from 'react';
import { Wrench, Table, FileQuestion, RefreshCw, Camera } from 'lucide-react';

import ToolExportarGoogleSheets from './ToolExportarGoogleSheets';
import ToolGeneradorGoogleForms from './ToolGeneradorGoogleForms'; // <--- IMPORTAR
import ToolConversorRecursos from './ToolConversorRecursos';
import FotoARecurso from './FotoARecurso';
export default function TeacherTools({ usuario, googleToken, perfilProfesor }) {
    const [herramientaActiva, setHerramientaActiva] = useState(null);

    // --- RENDERIZADO DE LA HERRAMIENTA ACTIVA ---
    if (herramientaActiva === 'SHEETS') {
        return <ToolExportarGoogleSheets usuario={usuario} googleToken={googleToken} onBack={() => setHerramientaActiva(null)} />;
    }

    if (herramientaActiva === 'FORMS') { // <--- NUEVA CONDICIÓN
        return <ToolGeneradorGoogleForms usuario={usuario} googleToken={googleToken} onBack={() => setHerramientaActiva(null)} />;
    }

    if (herramientaActiva === 'CONVERSOR') {
        return <ToolConversorRecursos usuario={usuario} onBack={() => setHerramientaActiva(null)} />;
    }

    if (herramientaActiva === 'FOTO') {
        return (
            <div style={{ padding: '20px 16px' }}>
                <button onClick={() => setHerramientaActiva(null)} style={{ marginBottom: 20, padding: '7px 14px', borderRadius: 8, border: '1px solid #dde', background: 'white', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 5, color: '#555' }}>
                    ← Volver a herramientas
                </button>
                <FotoARecurso usuario={usuario} perfilProfesor={perfilProfesor} />
            </div>
        );
    }

    // --- MENÚ PRINCIPAL DE HERRAMIENTAS ---
    return (
        <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>

            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <h2 style={{ color: '#2c3e50', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <Wrench size={32} /> Herramientas del Profesor
                </h2>
                <p style={{ color: '#7f8c8d' }}>Utilidades para gestionar y exportar tus recursos educativos.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>

                {/* TARJETA 1: GOOGLE SHEETS */}
                <div onClick={() => setHerramientaActiva('SHEETS')} style={cardStyle}>
                    <div style={{ background: '#e3f2fd', padding: '15px', borderRadius: '50%', marginBottom: '15px' }}>
                        <Table size={32} color="#2196F3" />
                    </div>
                    <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>Google Sheets</h3>
                    <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
                        Convierte y sube tus juegos directamente a tu Google Drive.
                    </p>
                </div>

                {/* TARJETA 2: GOOGLE FORMS (NUEVA) */}
                <div onClick={() => setHerramientaActiva('FORMS')} style={cardStyle}>
                    <div style={{ background: '#ede7f6', padding: '15px', borderRadius: '50%', marginBottom: '15px' }}>
                        <FileQuestion size={32} color="#673AB7" />
                    </div>
                    <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>Generar Examen</h3>
                    <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
                        Crea un Google Form (Cuestionario) automático a partir de tus juegos.
                    </p>
                </div>


                {/* TARJETA NUEVA: CONVERSOR MÁGICO */}
                <div onClick={() => setHerramientaActiva('CONVERSOR')} style={cardStyle}>
                    <div style={{ background: '#FFF3E0', padding: '15px', borderRadius: '50%', marginBottom: '15px' }}>
                        <RefreshCw size={32} color="#E65100" />
                    </div>
                    <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>Conversor Mágico</h3>
                    <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
                        Transforma un recurso de un juego a otro (Ej: Pasa de Pasapalabra a Sopa de Letras o a Quiz).
                    </p>
                </div>


                {/* TARJETA 3: PRÓXIMAMENTE */}
                <div style={{ ...cardStyle, opacity: 0.6, cursor: 'default' }}>
                    <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '50%', marginBottom: '15px' }}>
                        <Wrench size={32} color="#bdc3c7" />
                    </div>
                <div onClick={() => setHerramientaActiva('FOTO')} style={cardStyle}>
                    <Camera size={30} color="#e67e22" />
                    <h3 style={{ margin: '10px 0 5px 0', color: '#2c3e50' }}>Foto → Recurso</h3>
                    <p style={{ margin: 0, color: '#7f8c8d', fontSize: '14px' }}>
                        Fotografía un examen o ficha y la IA extrae las preguntas automáticamente
                    </p>
                </div>
                    <h3 style={{ margin: '0 0 10px 0', color: '#7f8c8d' }}>Próximamente...</h3>
                    <p style={{ margin: 0, color: '#999', fontSize: '0.9rem' }}>
                        Generador de informes y gestión de alumnos.
                    </p>
                </div>

            </div>
        </div>
    );
}

const cardStyle = {
    background: 'white',
    borderRadius: '15px',
    padding: '30px',
    textAlign: 'center',
    boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
    cursor: 'pointer',
    transition: 'transform 0.2s, boxShadow 0.2s',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    border: '1px solid #eee'
};