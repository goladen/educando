import React, { useState } from 'react';
import { Wrench, Table, FileQuestion, RefreshCw, BarChart2 } from 'lucide-react';

import InformesJuegos from './InformesJuegos';
import ToolExportarGoogleSheets from './ToolExportarGoogleSheets';
import ToolGeneradorGoogleForms from './ToolGeneradorGoogleForms'; // <--- IMPORTAR
import ToolConversorRecursos from './ToolConversorRecursos';
export default function TeacherTools({ usuario, googleToken }) {
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
                <div onClick={() => setHerramientaActiva('INFORMES')} style={cardStyle}>
                    <div style={{ background: '#e8f5e9', padding: '15px', borderRadius: '50%', marginBottom: '15px' }}>
                        <BarChart2 size={32} color="#27ae60" />
                    </div>
                    <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>Informes de Juegos</h3>
                    <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
                        Consulta los resultados enviados por tus alumnos y el ranking de tus recursos.
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