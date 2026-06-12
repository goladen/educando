import { useState, lazy, Suspense } from 'react';
import { Wrench, Table, FileQuestion, RefreshCw, Camera, BarChart2, BookOpen, Tv2, Shield, Code2, Film } from 'lucide-react';
import VideoTimelineEditor from '../VideoTimelineEditor';

import ToolExportarGoogleSheets from './ToolExportarGoogleSheets';
import ToolGeneradorGoogleForms from './ToolGeneradorGoogleForms';
import ToolConversorRecursos from './ToolConversorRecursos';
import FotoARecurso from './FotoARecurso';
import FotoAOmni from './FotoAOmni';
import VideoAPre from './VideoAPresentacion';
import InformesJuegos from './InformesJuegos2';
import AdminRecursosUploader from './AdminRecursosUploader';
const MiniAppCreator = lazy(() => import('./MiniAppCreator'));

const ADMIN_EMAIL = 'goladen@gmail.com';

export default function TeacherTools({ usuario, googleToken, perfilProfesor, onOpenEditorOmni }) {
    const [herramientaActiva, setHerramientaActiva] = useState(null);
    const [showFotoOmni, setShowFotoOmni] = useState(false);
    const isAdmin = usuario?.email === ADMIN_EMAIL;

    if (herramientaActiva === 'SHEETS')         return <ToolExportarGoogleSheets usuario={usuario} googleToken={googleToken} onBack={() => setHerramientaActiva(null)} />;
    if (herramientaActiva === 'FORMS')          return <ToolGeneradorGoogleForms  usuario={usuario} googleToken={googleToken} onBack={() => setHerramientaActiva(null)} />;
    if (herramientaActiva === 'CONVERSOR')      return <ToolConversorRecursos     usuario={usuario} onBack={() => setHerramientaActiva(null)} />;
    if (herramientaActiva === 'INFORMES')       return <InformesJuegos usuario={usuario} />;
    if (herramientaActiva === 'VIDEO')          return <VideoAPre onBack={() => setHerramientaActiva(null)} usuario={usuario} />;
    if (herramientaActiva === 'ADMIN_UPLOADER') return <AdminRecursosUploader usuario={usuario} onBack={() => setHerramientaActiva(null)} />;
    if (herramientaActiva === 'MINIAPP') return (
        <div style={{ padding: '20px 16px' }}>
            <button onClick={() => setHerramientaActiva(null)}
                style={{ marginBottom: 20, padding: '7px 14px', borderRadius: 8, border: '1px solid #dde', background: 'white', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 5, color: '#555' }}>
                ← Volver a herramientas
            </button>
            <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Cargando editor…</div>}>
                <MiniAppCreator onAbrirViewer={id => window.open(`/?miniapp=${id}`, '_blank')} />
            </Suspense>
        </div>
    );

    if (herramientaActiva === 'VIDEO_EDITOR') return (
        <VideoTimelineEditor onBack={() => setHerramientaActiva(null)} />
    );

    if (herramientaActiva === 'FOTO') {
        return (
            <div style={{ padding: '20px 16px' }}>
                <button onClick={() => setHerramientaActiva(null)}
                    style={{ marginBottom: 20, padding: '7px 14px', borderRadius: 8, border: '1px solid #dde', background: 'white', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 5, color: '#555' }}>
                    ← Volver a herramientas
                </button>
                <FotoARecurso usuario={usuario} perfilProfesor={perfilProfesor} />
            </div>
        );
    }

    return (
        <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>

           
           
           
            {/* Foto → Omni: overlay modal */}
            {showFotoOmni && (
                <FotoAOmni
                    onClose={() => setShowFotoOmni(false)}
                    onResourceExtracted={recurso => {
                        setShowFotoOmni(false);
                        onOpenEditorOmni?.(recurso);
                    }}
                />
            )}
            

            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <h2 style={{ color: '#2c3e50', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <Wrench size={32} /> Herramientas del Profesor
                </h2>
                <p style={{ color: '#7f8c8d' }}>Utilidades para gestionar y exportar tus recursos educativos.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>

                <div onClick={() => setHerramientaActiva('SHEETS')} style={cardStyle}>
                    <div style={{ background: '#e3f2fd', padding: '15px', borderRadius: '50%', marginBottom: '15px' }}>
                        <Table size={32} color="#2196F3" />
                    </div>
                    <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>Google Sheets</h3>
                    <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
                        Convierte y sube tus juegos directamente a tu Google Drive.
                    </p>
                </div>

                <div onClick={() => setHerramientaActiva('FORMS')} style={cardStyle}>
                    <div style={{ background: '#ede7f6', padding: '15px', borderRadius: '50%', marginBottom: '15px' }}>
                        <FileQuestion size={32} color="#673AB7" />
                    </div>
                    <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>Generar Examen</h3>
                    <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
                        Crea un Google Form automático a partir de tus juegos.
                    </p>
                </div>

                <div onClick={() => setHerramientaActiva('CONVERSOR')} style={cardStyle}>
                    <div style={{ background: '#FFF3E0', padding: '15px', borderRadius: '50%', marginBottom: '15px' }}>
                        <RefreshCw size={32} color="#E65100" />
                    </div>
                    <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>Conversor Mágico</h3>
                    <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
                        Transforma un recurso de un juego a otro (Pasapalabra → Sopa de Letras, Quiz...).
                    </p>
                </div>

                {/* ── Foto → Recurso clásico (Pasapalabra, Aparejados…) ── */}
                <div onClick={() => setHerramientaActiva('FOTO')} style={cardStyle}>
                    <div style={{ background: '#FFF8E1', padding: '15px', borderRadius: '50%', marginBottom: '15px' }}>
                        <Camera size={32} color="#e67e22" />
                    </div>
                    <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>Foto → Recurso</h3>
                    <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
                        Fotografía un examen o ficha y la IA extrae las preguntas para Pasapalabra, Aparejados, Quiz...
                    </p>
                </div>

                {/* ── Foto → Recurso Omni (Omninteractive) ── */}
                <div onClick={() => setShowFotoOmni(true)} style={{ ...cardStyle, borderLeft: '4px solid #6D28D9' }}>
                    <div style={{ background: '#EDE9FE', padding: '15px', borderRadius: '50%', marginBottom: '15px' }}>
                        <BookOpen size={32} color="#6D28D9" />
                    </div>
                    <h3 style={{ margin: '0 0 10px 0', color: '#6D28D9' }}>Foto → Recurso Omni</h3>
                    <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
                        Fotografía una ficha de ejercicios y la IA la convierte en un recurso Omninteractive editable.
                    </p>
                </div>

                {/* ── Video → Presentación ── */}
                <div onClick={() => setHerramientaActiva('VIDEO')} style={{ ...cardStyle, borderLeft: '4px solid #DC2626' }}>
                    <div style={{ background: '#FEE2E2', padding: '15px', borderRadius: '50%', marginBottom: '15px' }}>
                        <Tv2 size={32} color="#DC2626" />
                    </div>
                    <h3 style={{ margin: '0 0 10px 0', color: '#DC2626' }}>Video → Presentaciones y Quizz</h3>
                    <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
                        Pega una URL de YouTube y la IA genera presentaciones y videoquizz.
                    </p>
                </div>

                <div onClick={() => setHerramientaActiva('INFORMES')} style={cardStyle}>
                    <div style={{ background: '#E8F5E9', padding: '15px', borderRadius: '50%', marginBottom: '15px' }}>
                        <BarChart2 size={32} color="#2e7d32" />
                    </div>
                    <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>Informes de Juegos</h3>
                    <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
                        Consulta los resultados que tus alumnos han enviado desde los juegos.
                    </p>
                </div>

                {/* ── Mini-App Creator ── */}
                <div onClick={() => setHerramientaActiva('MINIAPP')} style={{ ...cardStyle, borderLeft: '4px solid #6c63ff' }}>
                    <div style={{ background: '#ede9fe', padding: '15px', borderRadius: '50%', marginBottom: '15px' }}>
                        <Code2 size={32} color="#6c63ff" />
                    </div>
                    <h3 style={{ margin: '0 0 10px 0', color: '#6c63ff' }}>Crear Mini-App</h3>
                    <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
                        Diseña una aplicación interactiva con IA o código React y compártela con tus alumnos.
                    </p>
                </div>

                {/* ── Editor de Vídeo Interactivo ── */}
                <div onClick={() => setHerramientaActiva('VIDEO_EDITOR')} style={{ ...cardStyle, borderLeft: '4px solid #0891b2' }}>
                    <div style={{ background: '#cffafe', padding: '15px', borderRadius: '50%', marginBottom: '15px' }}>
                        <Film size={32} color="#0891b2" />
                    </div>
                    <h3 style={{ margin: '0 0 10px 0', color: '#0891b2' }}>Editor de Vídeo</h3>
                    <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
                        Crea tramos de reproducción, añade preguntas y pausas en una línea de tiempo visual.
                    </p>
                </div>

                {/* ── Admin: Cargador de recursos con IA (solo goladen@gmail.com) ── */}
                {isAdmin && (
                    <div onClick={() => setHerramientaActiva('ADMIN_UPLOADER')}
                        style={{ ...cardStyle, borderLeft: '4px solid #6D28D9', background: 'linear-gradient(135deg,#faf5ff,#ede9fe)' }}>
                        <div style={{ background: '#EDE9FE', padding: '15px', borderRadius: '50%', marginBottom: '15px' }}>
                            <Shield size={32} color="#6D28D9" />
                        </div>
                        <h3 style={{ margin: '0 0 10px 0', color: '#6D28D9' }}>Cargador IA (Admin)</h3>
                        <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
                            Genera preguntas con Gemini y súbelas directamente a Firebase como recursos listos para usar.
                        </p>
                    </div>
                )}

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
    border: '1px solid #eee',
};
