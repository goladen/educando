// Profesor: guardar una ficha generada como hoja interactiva y compartirla con los alumnos
// (enlace /?hojafq=ID, QR, WhatsApp, Classroom). Y la lista de «Mis hojas».
import { useEffect, useState } from 'react';
import { guardarHojaInteractiva, misHojas, borrarHoja, urlHoja } from './hojasInteractivas';
import { usuarioRegistrado } from './misProblemas';

const btn = (bg, color = 'white') => ({ padding: '8px 14px', borderRadius: 10, border: 'none', background: bg, color, fontWeight: 800, cursor: 'pointer', fontSize: '0.88rem' });

/** Botón «Guardar y compartir». contenido(): { titulo, area, test, ejercicios, problemas } */
export function BotonCompartirHoja({ contenido, origen, estilo }) {
    const [guardando, setGuardando] = useState(false);
    const [hecho, setHecho] = useState(null); // { id, codigoProfesor }
    const registrado = usuarioRegistrado();
    const guardar = async () => {
        if (!registrado) { alert('Inicia sesión para guardar la hoja y compartirla con tus alumnos.'); return; }
        const c = contenido();
        if (!(c.test?.length || c.problemas?.length || c.ejercicios?.length)) { alert('La hoja no tiene preguntas ni problemas.'); return; }
        setGuardando(true);
        try { setHecho(await guardarHojaInteractiva({ ...c, origen })); }
        catch (e) { console.error(e); alert(e.message || 'No se pudo guardar la hoja.'); }
        setGuardando(false);
    };
    return (
        <>
            <button onClick={guardar} disabled={guardando} title="Los alumnos la responden en el móvil u ordenador y te envían el resultado a Informes"
                style={{ ...btn('linear-gradient(135deg,#f59e0b,#d97706)'), ...estilo }}>
                {guardando ? 'Guardando…' : '🔗 Guardar y compartir con alumnos'}
            </button>
            {hecho && <ModalEnlaceHoja id={hecho.id} titulo={contenido().titulo} sinCodigo={!hecho.codigoProfesor} onClose={() => setHecho(null)} />}
        </>
    );
}

export function ModalEnlaceHoja({ id, titulo, sinCodigo, onClose }) {
    const url = urlHoja(id);
    const [copiado, setCopiado] = useState(false);
    const copiar = async () => { try { await navigator.clipboard.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { window.prompt('Copia el enlace:', url); } };
    const texto = `${titulo}: responde la hoja y envíame el resultado → ${url}`;
    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 10070, background: 'rgba(15,23,42,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14, fontFamily: 'system-ui, sans-serif' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'white', color: '#0f172a', borderRadius: 18, width: '100%', maxWidth: 440, padding: '20px 22px', textAlign: 'center' }}>
                <div style={{ fontSize: '2.2rem' }}>🔗</div>
                <h3 style={{ margin: '4px 0 6px' }}>Hoja guardada</h3>
                <p style={{ margin: '0 0 10px', color: '#475569', fontSize: '0.88rem' }}>Comparte este enlace con tus alumnos. La responden en el navegador, se corrige al momento y te envían el resultado: lo verás en <b>Informes de juegos</b> («🧪 Hoja de Física y Química»).</p>
                {sinCodigo && <div style={{ background: '#fef3c7', color: '#92400e', borderRadius: 10, padding: '8px 10px', fontSize: '0.82rem', marginBottom: 10 }}>Aún no tienes <b>código de profesor</b>: créalo en Informes de juegos y dáselo a tus alumnos para que te lleguen los resultados.</div>}
                <div style={{ display: 'flex', gap: 6 }}>
                    <input readOnly value={url} onFocus={e => e.target.select()} style={{ flex: 1, padding: '8px 10px', borderRadius: 9, border: '1.5px solid #cbd5e1', fontSize: '0.85rem' }} />
                    <button onClick={copiar} style={btn('#2563eb')}>{copiado ? '✅' : 'Copiar'}</button>
                </div>
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}`} alt="QR" width={180} height={180} style={{ margin: '12px auto 6px', display: 'block' }} />
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginTop: 6 }}>
                    <a href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer" style={{ ...btn('#16a34a'), textDecoration: 'none' }}>WhatsApp</a>
                    <a href={`https://classroom.google.com/share?url=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer" style={{ ...btn('#0f766e'), textDecoration: 'none' }}>Classroom</a>
                    <a href={url} target="_blank" rel="noreferrer" style={{ ...btn('#64748b'), textDecoration: 'none' }}>👁 Probar</a>
                    <button onClick={onClose} style={btn('#e2e8f0', '#334155')}>Cerrar</button>
                </div>
            </div>
        </div>
    );
}

/** Lista de las hojas guardadas por el profe (para volver a compartirlas o borrarlas). */
export function MisHojasInteractivas({ oscuro = true }) {
    const [lista, setLista] = useState(null);
    const [abierta, setAbierta] = useState(null);
    const registrado = usuarioRegistrado();
    useEffect(() => { misHojas().then(setLista).catch(e => { console.error(e); setLista([]); }); }, []);
    const colorTexto = oscuro ? '#e2e8f0' : '#0f172a';
    if (!registrado) return <div style={{ color: colorTexto, opacity: 0.7 }}>Inicia sesión para ver tus hojas compartidas.</div>;
    if (!lista) return <div style={{ color: colorTexto, opacity: 0.7 }}>Cargando…</div>;
    if (!lista.length) return <div style={{ color: colorTexto, opacity: 0.7 }}>Todavía no has compartido ninguna hoja. Genera una ficha, previsualízala y pulsa «🔗 Guardar y compartir con alumnos».</div>;
    const fecha = (t) => (t?.toDate ? t.toDate().toLocaleDateString('es-ES') : '');
    return (
        <div style={{ display: 'grid', gap: 8 }}>
            {lista.map(h => (
                <div key={h.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '10px 14px', borderRadius: 12, background: oscuro ? 'rgba(255,255,255,0.06)' : 'white', border: `1px solid ${oscuro ? 'rgba(255,255,255,0.14)' : '#e2e8f0'}`, color: colorTexto }}>
                    <span style={{ fontSize: 20 }}>{h.area === 'Química' ? '🧪' : '⚛️'}</span>
                    <div style={{ flex: 1, minWidth: 180 }}>
                        <b>{h.titulo}</b>
                        <div style={{ fontSize: '0.78rem', opacity: 0.7 }}>{fecha(h.creadoEn)} · {(h.test || []).length} test · {(h.problemas || []).length + (h.ejercicios || []).length} problemas{h.origen ? ` · ${h.origen}` : ''}</div>
                    </div>
                    <button onClick={() => setAbierta(h)} style={btn('#d97706')}>🔗 Compartir</button>
                    <button onClick={async () => { if (!window.confirm('¿Borrar esta hoja? El enlace dejará de funcionar (los informes recibidos se conservan).')) return; try { await borrarHoja(h.id); setLista(l => l.filter(x => x.id !== h.id)); } catch (e) { alert('No se pudo borrar.'); } }} style={btn('rgba(220,38,38,0.85)')}>🗑</button>
                </div>
            ))}
            {abierta && <ModalEnlaceHoja id={abierta.id} titulo={abierta.titulo} sinCodigo={!abierta.codigoProfesor} onClose={() => setAbierta(null)} />}
        </div>
    );
}
