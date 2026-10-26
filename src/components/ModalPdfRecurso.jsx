import { useMemo, useState } from 'react';
import { X, FileDown, RefreshCw, Printer } from 'lucide-react';
import { formatosDisponibles, generarPdfRecurso, hojasDe } from '../utils/pdfRecurso';
import { JUEGOS_RECURSO, rutaRecurso } from './ModalRetoRecurso';
import ModalPdfListening from './ModalPdfListening';

// Ficha en PDF de cualquier recurso del profesor: se entrega a los alumnos en papel
// y, al terminar, se juega en clase con el mismo recurso (QR + código en la cabecera).
// conSoluciones=false oculta la página de soluciones (recursos ajenos vistos por alumnos).
export default function ModalPdfRecurso({ recurso, onClose, conSoluciones = true }) {
    const formatos = useMemo(() => formatosDisponibles(recurso), [recurso]);
    const hojas = useMemo(() => hojasDe(recurso), [recurso]);
    // Juegos con los que se puede jugar este recurso después (mismo registro que «compartir con configuración»)
    const juegos = useMemo(() => Object.entries(JUEGOS_RECURSO)
        .filter(([, j]) => !j.coleccion && (!j.tipos || j.tipos.includes(recurso.tipoJuego)) && (!j.valido || j.valido(recurso)))
        .map(([id, j]) => ({ id, label: j.label, ruta: (j.enlace && j.enlace(recurso)) || rutaRecurso(recurso.id, { modo: j.modo }) }))
        // Primero el juego para el que se creó el recurso
        .sort((a, b) => (b.id === recurso.tipoJuego) - (a.id === recurso.tipoJuego)), [recurso]);

    const [formato, setFormato] = useState(formatos[0]?.id || null);
    const [selHojas, setSelHojas] = useState(() => hojas.map((_, i) => i));
    const [barajar, setBarajar] = useState(false);
    const [soluciones, setSoluciones] = useState(conSoluciones);
    const [dificil, setDificil] = useState(false);
    const [juegoId, setJuegoId] = useState(juegos[0]?.id || '');
    const [generando, setGenerando] = useState(null);

    if (recurso.tipoJuego === 'LISTENING_RECURSO') return <ModalPdfListening recurso={recurso} onClose={onClose} conSoluciones={conSoluciones} />;

    const juego = juegos.find(j => j.id === juegoId);
    const generar = async (modo) => {
        setGenerando(modo);
        // La pestaña se abre ya (gesto del usuario) para que no la bloquee el navegador
        const ventana = modo === 'IMPRIMIR' ? window.open('', '_blank') : null;
        try {
            const pdf = await generarPdfRecurso(recurso, {
                formato, hojas: selHojas, barajar, soluciones, dificil, descargar: modo === 'DESCARGAR',
                juego: juego && recurso.id ? { label: juego.label, url: `${window.location.origin}${juego.ruta}` } : null,
            });
            if (modo === 'IMPRIMIR') {
                const url = pdf.output('bloburl');
                if (ventana) ventana.location.href = url; else window.open(url, '_blank');
            }
        } catch (e) {
            ventana?.close();
            console.error(e);
            alert('No se pudo generar el PDF: ' + e.message);
        }
        setGenerando(null);
    };

    const opcion = (on) => ({
        padding: '10px 10px', borderRadius: 12, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
        border: `2px solid ${on ? '#6D28D9' : '#e4dcf5'}`, background: on ? '#f3edff' : 'white', color: '#2e1065',
    });
    const check = { display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.86rem', color: '#444', margin: '7px 0', cursor: 'pointer' };
    const etiqueta = { fontSize: '0.78rem', fontWeight: 700, color: '#64748b', margin: '12px 0 6px' };
    const conBarajar = ['TEST', 'RESPUESTA', 'UNIR', 'ANAGRAMA', 'RULETA'].includes(formato);
    const boton = (bg) => ({ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: bg, color: 'white', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: '0.9rem', opacity: generando ? 0.7 : 1 });

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 7000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }} onClick={onClose}>
            <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'Segoe UI', sans-serif" }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: 'linear-gradient(135deg,#6D28D9,#4c1d95)', color: 'white' }}>
                    <div>
                        <b>📄 Ficha en papel</b>
                        <div style={{ fontSize: '0.78rem', opacity: 0.85 }}>{recurso.titulo}</div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={20} /></button>
                </div>

                <div style={{ padding: '6px 18px 16px', overflowY: 'auto' }}>
                    {formatos.length === 0 ? (
                        <p style={{ color: '#c0392b', fontSize: '0.88rem' }}>Este recurso no tiene contenido que se pueda pasar a papel (preguntas, palabras, parejas o eventos).</p>
                    ) : (
                        <>
                            <div style={etiqueta}>Tipo de ficha</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
                                {formatos.map(f => (
                                    <button key={f.id} onClick={() => setFormato(f.id)} style={opcion(formato === f.id)}>
                                        <div style={{ fontWeight: 800, fontSize: '0.88rem' }}>{f.emoji} {f.label}</div>
                                        <div style={{ fontSize: '0.72rem', color: '#6b5b8a', marginTop: 3 }}>{f.desc}</div>
                                    </button>
                                ))}
                            </div>

                            {hojas.length > 1 && (
                                <>
                                    <div style={etiqueta}>Hojas incluidas</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {hojas.map((h, i) => {
                                            const on = selHojas.includes(i);
                                            return (
                                                <button key={i} onClick={() => setSelHojas(on ? selHojas.filter(x => x !== i) : [...selHojas, i].sort((a, b) => a - b))}
                                                    style={{ padding: '6px 12px', borderRadius: 20, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, border: `2px solid ${on ? '#6D28D9' : '#e2e8f0'}`, background: on ? '#6D28D9' : 'white', color: on ? 'white' : '#64748b' }}>
                                                    {h.nombreHoja || `Hoja ${i + 1}`}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </>
                            )}

                            <div style={etiqueta}>Opciones</div>
                            {conBarajar && <label style={check}><input type="checkbox" checked={barajar} onChange={e => setBarajar(e.target.checked)} /> Barajar el orden (cada descarga sale distinta)</label>}
                            {formato === 'SOPA' && <label style={check}><input type="checkbox" checked={dificil} onChange={e => setDificil(e.target.checked)} /> Más difícil: palabras también al revés</label>}
                            {conSoluciones && <label style={check}><input type="checkbox" checked={soluciones} onChange={e => setSoluciones(e.target.checked)} /> Añadir página de soluciones (para el profe)</label>}

                            <div style={etiqueta}>Después jugaremos en clase con…</div>
                            <select value={juegoId} onChange={e => setJuegoId(e.target.value)}
                                style={{ width: '100%', padding: '9px 10px', borderRadius: 10, border: '2px solid #e4dcf5', fontSize: '0.88rem', fontFamily: 'inherit' }}>
                                {juegos.map(j => <option key={j.id} value={j.id}>{j.label}</option>)}
                                <option value="">— No poner juego ni QR —</option>
                            </select>
                            <p style={{ fontSize: '0.74rem', color: '#94a3b8', margin: '6px 0 0' }}>
                                La ficha lleva en la cabecera un QR y el enlace para abrir ese juego con este mismo recurso
                                {recurso.accessCode ? ` (y el código ${recurso.accessCode})` : ''}: primero en papel, luego a jugar.
                            </p>

                            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                                <button onClick={() => generar('IMPRIMIR')} disabled={!!generando || !selHojas.length} style={boton('#0f766e')}>
                                    {generando === 'IMPRIMIR' ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Printer size={17} />} Ver e imprimir
                                </button>
                                <button onClick={() => generar('DESCARGAR')} disabled={!!generando || !selHojas.length} style={boton('#6D28D9')}>
                                    {generando === 'DESCARGAR' ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <FileDown size={17} />} Descargar PDF
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
