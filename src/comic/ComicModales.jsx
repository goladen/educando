import { useEffect, useId, useState } from 'react';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import ComicPagina from './ComicPagina';
import { vistaPagina, codificarPlantilla, prepararPlantilla, contarCompletar } from './modeloComic';

// Modales del Creador de cómics: enviar al profesor, mis cómics y crear plantilla.

const oscuro = {
    fondo: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 10001, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 16 },
    caja: { background: '#1e272e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, width: '100%', maxWidth: 400, padding: '24px 26px', color: 'white', maxHeight: '92vh', overflowY: 'auto' },
    inp: { padding: '9px 12px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' },
    lab: { fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 },
};

// Datos del cómic listos para Firestore (sin undefined).
export function comicParaGuardar(comic) {
    return JSON.parse(JSON.stringify({
        titulo: comic.titulo || 'Mi cómic', autor: comic.autor || '', mostrarTitulo: !!comic.mostrarTitulo,
        paginas: comic.paginas, ...(comic.plantilla ? { plantilla: comic.plantilla } : {}),
    }));
}
export const totalVinetas = (comic, numV) => comic.paginas.reduce((n, p) => n + numV(p.disposicion), 0);

export function ModalEnviarProfe({ comic, nVinetas, onClose, onEnviado }) {
    const [codigo, setCodigo] = useState('');
    const [nombre, setNombre] = useState(comic.autor || '');
    const [curso, setCurso] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [enviado, setEnviado] = useState(false);
    const [error, setError] = useState('');

    const enviar = async () => {
        const code = codigo.trim().toUpperCase();
        if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
        if (!code) { setError('Escribe el código del profesor.'); return; }
        setEnviando(true); setError('');
        try {
            const snap = await getDoc(doc(db, 'codigos_profesor', code));
            if (!snap.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
            const datos = comicParaGuardar(comic);
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'COMIC', modalidad: 'Individual', fecha: new Date(), codigoProfesor: code,
                titulo: datos.titulo, comic: datos,
                ...(comic.plantilla ? { reto: comic.plantilla.titulo } : {}),
                jugadores: [{ nombre: nombre.trim(), curso: curso.trim(), aciertos: nVinetas, intentos: nVinetas, porcentaje: 100, vinetas: nVinetas, paginas: comic.paginas.length }],
            });
            onEnviado?.(nombre.trim(), curso.trim());
            setEnviado(true);
        } catch (e) { setError('Error: ' + e.message); }
        setEnviando(false);
    };

    return (
        <div style={oscuro.fondo}>
            <div style={oscuro.caja}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f1c40f' }}>📤 Enviar el cómic al profesor</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.2rem' }}>✕</button>
                </div>
                {enviado ? (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{ fontSize: '3rem' }}>✅</div>
                        <div style={{ color: '#2ecc71', fontWeight: 700 }}>¡Cómic enviado!</div>
                        <button onClick={onClose} style={{ marginTop: 16, padding: '9px 22px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', color: 'white' }}>Cerrar</button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div><label style={oscuro.lab}>Nombre y apellido</label><input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre completo" style={oscuro.inp} /></div>
                        <div><label style={oscuro.lab}>Curso</label><input value={curso} onChange={(e) => setCurso(e.target.value)} placeholder="Ej: 5º Primaria A" style={oscuro.inp} /></div>
                        <div><label style={oscuro.lab}>Código del profesor</label><input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="Ej: PROF01" maxLength={10} style={{ ...oscuro.inp, letterSpacing: 2, fontWeight: 700 }} /></div>
                        {error && <div style={{ color: '#e74c3c', fontSize: '0.8rem' }}>⚠ {error}</div>}
                        <div style={{ display: 'flex', gap: 9, marginTop: 4 }}>
                            <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', cursor: 'pointer', color: 'white' }}>Cancelar</button>
                            <button onClick={enviar} disabled={enviando} style={{ flex: 2, padding: 10, borderRadius: 10, border: 'none', background: enviando ? '#555' : 'linear-gradient(135deg,#3498db,#2980b9)', color: 'white', fontWeight: 700, cursor: enviando ? 'default' : 'pointer' }}>
                                {enviando ? 'Enviando…' : '📤 Enviar'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function Miniatura({ comic }) {
    const id = 'm' + useId().replace(/[^a-zA-Z0-9]/g, '');
    return <ComicPagina comic={vistaPagina(comic, 0)} idPrefijo={id} />;
}

export function ModalMisComics({ lista, actualId, onAbrir, onBorrar, onDuplicar, onClose }) {
    const [confirmar, setConfirmar] = useState(null);
    const bt = (fondo, color, extra) => ({ border: 'none', borderRadius: 7, padding: 5, background: fondo, color, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, ...extra });
    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10001, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 18, width: '100%', maxWidth: 820, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid #eee' }}>
                    <b style={{ fontSize: '1.05rem' }}>📚 Mis cómics <span style={{ color: '#999', fontWeight: 500, fontSize: '0.85rem' }}>(guardados en este dispositivo)</span></b>
                    <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#999' }}>✕</button>
                </div>
                <div style={{ overflowY: 'auto', padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: 14 }}>
                    {lista.map((c) => (
                        <div key={c.id} style={{ border: c.id === actualId ? '3px solid #0984e3' : '2px solid #eee', borderRadius: 12, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div onClick={() => onAbrir(c)} style={{ height: 170, cursor: 'pointer', background: '#f5f6fa', borderRadius: 8, overflow: 'hidden' }}><Miniatura comic={c} /></div>
                            <div style={{ fontWeight: 700, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.titulo || 'Sin título'}</div>
                            <div style={{ fontSize: '0.7rem', color: '#999' }}>
                                {c.paginas.length > 1 ? `${c.paginas.length} páginas · ` : ''}{new Date(c.modificado || 0).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                            </div>
                            {confirmar === c.id ? (
                                <div style={{ display: 'flex', gap: 4 }}>
                                    <button onClick={() => { onBorrar(c.id); setConfirmar(null); }} style={bt('#e74c3c', 'white', { flex: 1 })}>Borrar</button>
                                    <button onClick={() => setConfirmar(null)} style={bt('white', '#333', { flex: 1, border: '1px solid #ddd' })}>No</button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', gap: 4 }}>
                                    <button onClick={() => onAbrir(c)} style={bt('#0984e3', 'white', { flex: 2 })}>Abrir</button>
                                    <button onClick={() => onDuplicar(c)} title="Duplicar" style={bt('white', '#333', { flex: 1, border: '1px solid #ddd' })}>⧉</button>
                                    <button onClick={() => setConfirmar(c.id)} title="Borrar" style={bt('#fdecea', '#333', { flex: 1, border: '1px solid #fdd' })}>🗑</button>
                                </div>
                            )}
                        </div>
                    ))}
                    {!lista.length && <div style={{ color: '#999' }}>Todavía no hay cómics guardados.</div>}
                </div>
            </div>
        </div>
    );
}

// El profe convierte el cómic actual en plantilla y obtiene un enlace (?plantilla=…).
export function ModalPlantilla({ comic, onClose }) {
    const [consigna, setConsigna] = useState('');
    const [bloquear, setBloquear] = useState(true);
    const [url, setUrl] = useState('');
    const [copiado, setCopiado] = useState(false);
    const nCompletar = contarCompletar(comic);

    useEffect(() => { setUrl(''); setCopiado(false); }, [consigna, bloquear]);

    const crear = async () => {
        const cod = await codificarPlantilla(prepararPlantilla(comic, { consigna, bloquear }));
        setUrl(`${window.location.origin}/comic?plantilla=${cod}`);
    };
    const copiar = async () => {
        try { await navigator.clipboard.writeText(url); setCopiado(true); } catch { /* nada */ }
    };

    return (
        <div style={oscuro.fondo}>
            <div style={{ ...oscuro.caja, maxWidth: 480 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f1c40f' }}>🎓 Usar este cómic como plantilla</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.2rem' }}>✕</button>
                </div>
                <p style={{ fontSize: '0.84rem', color: '#ccc', margin: '0 0 12px', lineHeight: 1.45 }}>
                    Tus alumnos abrirán una copia de este cómic. Los bocadillos marcados con <b style={{ color: '#fab1a0' }}>✏ «Lo escribe el alumno»</b> les llegan vacíos,
                    con tu texto como pista. Para marcarlos, selecciona un bocadillo y activa esa opción.
                </p>
                <div style={{ background: nCompletar ? 'rgba(46,204,113,0.15)' : 'rgba(241,196,15,0.15)', borderRadius: 10, padding: '8px 12px', fontSize: '0.84rem', marginBottom: 12 }}>
                    {nCompletar ? `✔ ${nCompletar} bocadillo${nCompletar === 1 ? '' : 's'} para completar` : '⚠ No hay bocadillos para completar: el alumno recibirá el cómic tal cual para seguirlo o modificarlo.'}
                </div>
                <label style={oscuro.lab}>Consigna para el alumno (opcional)</label>
                <textarea value={consigna} onChange={(e) => setConsigna(e.target.value)} rows={3} placeholder="Completa el diálogo: ¿qué le contesta Ana a su abuelo?" style={{ ...oscuro.inp, resize: 'vertical' }} />
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: '0.85rem', marginTop: 10, cursor: 'pointer' }}>
                    <input type="checkbox" checked={bloquear} onChange={(e) => setBloquear(e.target.checked)} style={{ marginTop: 3 }} />
                    <span>Bloquear lo que he puesto yo (el alumno no puede moverlo ni borrarlo, pero sí añadir cosas nuevas)</span>
                </label>
                {!url ? (
                    <button onClick={crear} style={{ marginTop: 14, width: '100%', padding: 11, borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#f1c40f,#e67e22)', color: 'white', fontWeight: 800, cursor: 'pointer' }}>🔗 Crear el enlace</button>
                ) : (
                    <div style={{ marginTop: 14 }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <input readOnly value={url} onFocus={(e) => e.target.select()} style={{ ...oscuro.inp, fontSize: '0.75rem' }} />
                            <button onClick={copiar} style={{ padding: '8px 12px', borderRadius: 9, border: 'none', background: copiado ? '#27ae60' : '#0984e3', color: 'white', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>{copiado ? '✔ Copiado' : 'Copiar'}</button>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                            <a href={url} target="_blank" rel="noreferrer" style={{ color: '#74b9ff', fontSize: '0.84rem' }}>👁 Probar como alumno</a>
                            {url.length < 1800 && <span style={{ fontSize: '0.84rem', color: '#aaa' }}>· el enlace cabe en un QR</span>}
                        </div>
                        {url.length < 1800 && <div style={{ background: 'white', borderRadius: 12, padding: 8, width: 'fit-content', margin: '10px auto 0' }}>
                            <img alt="QR de la plantilla" width="180" height="180" src={`https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(url)}&margin=6`} style={{ display: 'block' }} />
                        </div>}
                        <p style={{ fontSize: '0.78rem', color: '#aaa', margin: '10px 0 0', lineHeight: 1.4 }}>
                            Compártelo por Classroom o por correo. También puedes pegarlo en <b>Control de Aula → Cómic</b> para lanzarlo a toda la clase.
                            El enlace lleva el cómic dentro: si cambias la plantilla, crea un enlace nuevo.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
