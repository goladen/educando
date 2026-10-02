import { useState } from 'react';
import { X, FileDown, RefreshCw } from 'lucide-react';
import { generarPdfListening } from '../utils/pdfListening';

// Opciones de la ficha imprimible de un Listening del profesor
// conSoluciones=false oculta (y desactiva) la página de soluciones
export default function ModalPdfListening({ recurso, onClose, conSoluciones = true }) {
    const [modoHuecos, setModoHuecos] = useState('escribir');
    const [preguntas, setPreguntas] = useState(true);
    const [solucionario, setSolucionario] = useState(conSoluciones);
    const [codigo, setCodigo] = useState(true);
    const [generando, setGenerando] = useState(false);

    const nHuecos = recurso.huecos?.length || 0;
    const nPreg = recurso.preguntas?.length || 0;

    const generar = async () => {
        setGenerando(true);
        try {
            await generarPdfListening(recurso, { modoHuecos, preguntas, solucionario, codigo });
            onClose();
        } catch (e) {
            console.error(e);
            alert('No se pudo generar el PDF: ' + e.message);
        }
        setGenerando(false);
    };

    const opcion = (on) => ({
        flex: 1, padding: '12px 10px', borderRadius: 12, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
        border: `2px solid ${on ? '#8E44AD' : '#e2d6ea'}`, background: on ? '#f3e8fb' : 'white', color: '#3d1f4d',
    });
    const check = { display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.86rem', color: '#444', margin: '8px 0', cursor: 'pointer' };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 7000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }} onClick={onClose}>
            <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 440, overflow: 'hidden', fontFamily: "'Segoe UI', sans-serif" }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: 'linear-gradient(135deg,#8E44AD,#6c3483)', color: 'white' }}>
                    <b>📄 Ficha para imprimir</b>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={20} /></button>
                </div>
                <div style={{ padding: '16px 18px' }}>
                    {nHuecos > 0 && (
                        <>
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', marginBottom: 6 }}>En cada hueco el alumno…</div>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                                <button onClick={() => setModoHuecos('escribir')} style={opcion(modoHuecos === 'escribir')}>
                                    <div style={{ fontWeight: 800 }}>✍️ Escribe</div>
                                    <div style={{ fontSize: '0.74rem', color: '#7a6a85', marginTop: 3 }}>Raya en blanco para la palabra</div>
                                </button>
                                <button onClick={() => setModoHuecos('opciones')} style={opcion(modoHuecos === 'opciones')}>
                                    <div style={{ fontWeight: 800 }}>🔘 Elige</div>
                                    <div style={{ fontSize: '0.74rem', color: '#7a6a85', marginTop: 3 }}>Opciones a/b/c/d debajo del texto</div>
                                </button>
                            </div>
                        </>
                    )}
                    {nPreg > 0 && <label style={check}><input type="checkbox" checked={preguntas} onChange={e => setPreguntas(e.target.checked)} /> Incluir las {nPreg} preguntas de comprensión</label>}
                    {conSoluciones && <label style={check}><input type="checkbox" checked={solucionario} onChange={e => setSolucionario(e.target.checked)} /> Añadir página de soluciones y transcripción (para el profe)</label>}
                    {recurso.accessCode && <label style={check}><input type="checkbox" checked={codigo} onChange={e => setCodigo(e.target.checked)} /> Imprimir el código {recurso.accessCode} para escucharlo en casa</label>}
                    {nHuecos === 0 && nPreg === 0 && <div style={{ color: '#c0392b', fontSize: '0.84rem' }}>Este listening aún no tiene huecos ni preguntas.</div>}
                    <button onClick={generar} disabled={generando || (nHuecos === 0 && nPreg === 0)}
                        style={{ marginTop: 12, width: '100%', padding: 12, borderRadius: 10, border: 'none', background: '#8E44AD', color: 'white', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: '0.92rem', opacity: generando ? 0.7 : 1 }}>
                        {generando ? <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Generando…</> : <><FileDown size={17} /> Descargar PDF</>}
                    </button>
                    <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '10px 0 0' }}>Las opciones de cada hueco se barajan en cada descarga; la página de soluciones corresponde a esa misma ficha.</p>
                </div>
            </div>
        </div>
    );
}
