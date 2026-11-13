import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { doc, getDoc, getDocs, setDoc, updateDoc, onSnapshot, collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import ComicCreator from './ComicCreator';
import ComicPagina, { DISPOSICIONES, numVinetas, svgAPng } from './ComicPagina';
import {
    nid, vinetaVacia, clave, normalizarComic, vistaPagina, decodificarPlantilla, comicDesdePlantilla,
    montarColaborativo, repartirVinetas, contarCompletar,
} from './modeloComic';
import { comicParaGuardar } from './ComicModales';

// Cómic en Control de Aula (ver ControlAula.jsx):
//   room.comic = { taskId, titulo, consigna, modo:'individual'|'colaborativo', base, plantilla?, asignacion, nombres,
//                  porAlumno, disposicion, state:'EDITING'|'FIN', codigoProfesor, profesorUid, startedAt }
//   control_rooms/{CODE}/comics/{sid} = { taskId, nombre, data (individual) | vinetas {"p-v": viñeta} (colaborativo), entregado, at }
// Los alumnos del colaborativo ven a sus compañeros cada POLL_MS (getDocs): así no se multiplican las lecturas.

const POLL_MS = 20000;
const GUARDAR_MS = 2500;
const limpio = (o) => JSON.parse(JSON.stringify(o));
const etiquetaClave = (k) => { const [p, v] = k.split('-').map(Number); return `Pág. ${p + 1} · viñeta ${v + 1}`; };

const lbl = { display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 5 };
const inp = { width: '100%', padding: '9px 11px', borderRadius: 10, border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '0.92rem', fontFamily: 'inherit' };
const btn = (bg, extra) => ({ background: bg, color: 'white', border: 'none', borderRadius: 10, padding: '9px 14px', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem', display: 'inline-flex', alignItems: 'center', gap: 6, ...extra });
const chip = (on) => ({ border: `2px solid ${on ? '#e84393' : '#e2e8f0'}`, background: on ? '#fdeef5' : 'white', color: on ? '#c2185b' : '#334155', borderRadius: 10, padding: '7px 11px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' });

function Mini({ comic, pag = 0, alto = 150, etiquetas }) {
    const id = 'ca' + useId().replace(/[^a-zA-Z0-9]/g, '');
    return <div style={{ height: alto }}><ComicPagina comic={vistaPagina(comic, pag)} idPrefijo={id} etiquetas={etiquetas} /></div>;
}

// ─── Formulario del profesor ─────────────────────────────────────────────────
export function FormComicAula({ onLanzar, numConectados = 0, codigoProfesor = null }) {
    const [titulo, setTitulo] = useState('');
    const [consigna, setConsigna] = useState('');
    const [modo, setModo] = useState('individual');
    const [origen, setOrigen] = useState('blanco');
    const [disposicion, setDisposicion] = useState('p4');
    const [porAlumno, setPorAlumno] = useState(1);
    const [enlace, setEnlace] = useState('');
    const [plantilla, setPlantilla] = useState(null);
    const [errorPl, setErrorPl] = useState('');

    useEffect(() => {
        setPlantilla(null); setErrorPl('');
        const m = enlace.match(/[?&]plantilla=([A-Za-z0-9_-]+)/);
        if (!m) { if (enlace.trim()) setErrorPl('Pega el enlace que da el botón «🎓 Plantilla» del Creador de cómics.'); return; }
        let vivo = true;
        decodificarPlantilla(m[1]).then((pl) => { if (vivo && pl?.comic) setPlantilla({ ...pl, comic: normalizarComic(pl.comic) }); else if (vivo) setErrorPl('El enlace no es válido.'); })
            .catch(() => vivo && setErrorPl('El enlace no es válido o está incompleto.'));
        return () => { vivo = false; };
    }, [enlace]);

    const listo = origen === 'blanco' || !!plantilla;
    const lanzar = () => {
        if (!listo) return;
        let base;
        if (origen === 'plantilla') base = comicDesdePlantilla(plantilla);
        else base = { id: nid(), titulo: titulo.trim() || 'Nuestro cómic', autor: '', mostrarTitulo: true, paginas: [{ disposicion, vinetas: Array.from({ length: numVinetas(disposicion) }, vinetaVacia) }] };
        base.titulo = titulo.trim() || (origen === 'plantilla' ? plantilla.titulo : '') || base.titulo || 'Cómic';
        onLanzar({
            titulo: base.titulo,
            consigna: consigna.trim() || (origen === 'plantilla' ? plantilla.consigna || '' : ''),
            modo, porAlumno, disposicion,
            base: limpio(base),
        });
    };

    return (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, marginBottom: 18 }}>
            <h3 style={{ margin: '0 0 4px', color: '#1e293b' }}>💬 Cómic</h3>
            <p style={{ margin: '0 0 12px', color: '#64748b', fontSize: '0.85rem' }}>
                Cada alumno hace su cómic, o toda la clase hace uno juntos repartiéndose las viñetas. Lo ves en directo y al final lo guardas en Informes.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <button onClick={() => setModo('individual')} style={chip(modo === 'individual')}>🧑 Cada uno el suyo</button>
                <button onClick={() => setModo('colaborativo')} style={chip(modo === 'colaborativo')}>👥 Uno entre toda la clase</button>
            </div>
            <label style={lbl}>Título</label>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={modo === 'colaborativo' ? 'Ej: La historia de nuestra clase' : 'Ej: Un día en la Edad Media'} style={inp} />
            <label style={{ ...lbl, marginTop: 10 }}>Consigna (opcional)</label>
            <textarea value={consigna} onChange={(e) => setConsigna(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }}
                placeholder={modo === 'colaborativo' ? 'Cada uno dibuja una escena del cuento, en orden…' : 'Cuenta en viñetas cómo funciona el ciclo del agua…'} />
            <label style={{ ...lbl, marginTop: 10 }}>Punto de partida</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <button onClick={() => setOrigen('blanco')} style={chip(origen === 'blanco')}>⬜ En blanco</button>
                <button onClick={() => setOrigen('plantilla')} style={chip(origen === 'plantilla')}>🎓 Mi plantilla</button>
            </div>
            {origen === 'blanco' ? <>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 6 }}>{modo === 'colaborativo' ? 'Distribución de cada página (se añaden páginas según los alumnos):' : 'Distribución de la primera página:'}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {DISPOSICIONES.map((d) => <button key={d.id} onClick={() => setDisposicion(d.id)} style={{ ...chip(disposicion === d.id), padding: '5px 9px', fontSize: '0.78rem' }}>{d.label}</button>)}
                </div>
            </> : <>
                <input value={enlace} onChange={(e) => setEnlace(e.target.value)} placeholder="Pega aquí el enlace de tu plantilla (…/comic?plantilla=…)" style={inp} />
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 5 }}>
                    Créala en el <a href="/comic" target="_blank" rel="noreferrer">Creador de cómics</a>: haz el cómic, marca los bocadillos «✏ Lo escribe el alumno» y pulsa «🎓 Plantilla».
                </div>
                {errorPl && <div style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: 6 }}>{errorPl}</div>}
                {plantilla && <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 10, background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: 8 }}>
                    <div style={{ width: 120 }}><Mini comic={plantilla.comic} alto={110} /></div>
                    <div style={{ fontSize: '0.84rem', color: '#334155' }}>
                        <b>{plantilla.titulo}</b><br />
                        {plantilla.comic.paginas.length} página(s) · {contarCompletar(plantilla.comic)} bocadillo(s) para completar{plantilla.bloquear ? ' · elementos bloqueados' : ''}
                    </div>
                </div>}
            </>}
            {modo === 'colaborativo' && <>
                <label style={{ ...lbl, marginTop: 12 }}>Viñetas por alumno</label>
                <div style={{ display: 'flex', gap: 8 }}>
                    {[1, 2, 3].map((n) => <button key={n} onClick={() => setPorAlumno(n)} style={chip(porAlumno === n)}>{n}</button>)}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 6 }}>
                    Se reparten por orden alfabético entre los {numConectados} conectados. Cada uno ve el cómic entero, pero solo toca sus viñetas; lo de los demás se actualiza cada 20 s.
                </div>
            </>}
            {!codigoProfesor && <div style={{ background: '#fef3c7', color: '#92400e', borderRadius: 10, padding: '8px 10px', fontSize: '0.8rem', marginTop: 12 }}>
                ⚠ No tienes código de profesor: podrás ver y descargar los cómics, pero no guardarlos en Informes.
            </div>}
            <button onClick={lanzar} disabled={!listo} style={{ ...btn(listo ? '#e84393' : '#cbd5e1'), marginTop: 14 }}>🚀 Lanzar el cómic a {numConectados} dispositivo{numConectados === 1 ? '' : 's'}</button>
        </div>
    );
}

// Datos que el profe guarda en room.comic al lanzar (el reparto se hace con los conectados).
export function prepararTareaComic(config, conectados) {
    const t = { ...config, asignacion: {}, nombres: {} };
    if (config.modo === 'colaborativo') {
        const orden = [...conectados].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        const r = repartirVinetas(config.base, {}, orden.map((a) => a.id), { porAlumno: config.porAlumno, disposicionNueva: config.disposicion });
        t.base = limpio(r.comic);
        t.asignacion = r.asignacion;
        orden.forEach((a) => { t.nombres[a.id] = a.name || 'Alumno'; });
    }
    return t;
}

function etiquetasDe(tarea, pag, miId) {
    const comic = normalizarComic(tarea.base);
    const n = numVinetas(comic.paginas[pag]?.disposicion);
    const duenio = {};
    Object.entries(tarea.asignacion || {}).forEach(([sid, ks]) => ks.forEach((k) => { duenio[k] = sid; }));
    const out = {};
    for (let i = 0; i < n; i++) {
        const sid = duenio[clave(pag, i)];
        if (sid) out[i] = sid === miId ? 'Tú' : (tarea.nombres?.[sid] || 'Alumno');
    }
    return out;
}

// ─── Panel del profesor ──────────────────────────────────────────────────────
export function PanelComicProfesor({ tarea, alumnos, codigo, roomRef, esConectado, onCerrar }) {
    const [docs, setDocs] = useState([]);
    const [verId, setVerId] = useState(null);
    const [pag, setPag] = useState(0);
    const [guardando, setGuardando] = useState(false);
    const [mensaje, setMensaje] = useState('');
    const svgRef = useRef(null);
    const colab = tarea.modo === 'colaborativo';
    const fin = tarea.state === 'FIN';

    useEffect(() => onSnapshot(collection(db, 'control_rooms', codigo, 'comics'), (snap) => {
        setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((d) => d.taskId === tarea.taskId));
    }), [codigo, tarea.taskId]);

    const porId = useMemo(() => Object.fromEntries(docs.map((d) => [d.id, d])), [docs]);
    const nombreDe = (id) => alumnos.find((a) => a.id === id)?.name || porId[id]?.nombre || tarea.nombres?.[id] || 'Alumno';
    const montado = useMemo(() => (colab ? montarColaborativo(tarea.base, tarea.asignacion, docs.map((d) => ({ id: d.id, comic: d })), tarea.taskId) : null), [colab, tarea, docs]);

    const avisar = (t) => { setMensaje(t); setTimeout(() => setMensaje(''), 4000); };
    const terminar = async () => {
        if (!window.confirm('¿Terminar? Los alumnos ya no podrán editar y se entregará lo que tengan.')) return;
        try { await updateDoc(roomRef, { 'comic.state': 'FIN' }); } catch (e) { console.error(e); }
    };
    const reanudar = async () => { try { await updateDoc(roomRef, { 'comic.state': 'EDITING' }); } catch (e) { console.error(e); } };
    const reabrir = async (id) => { try { await setDoc(doc(db, 'control_rooms', codigo, 'comics', id), { entregado: false }, { merge: true }); } catch (e) { console.error(e); } };

    const sinAsignar = colab ? alumnos.filter((a) => esConectado(a) && !(tarea.asignacion?.[a.id] || []).length) : [];
    const darVinetas = async () => {
        const r = repartirVinetas(tarea.base, tarea.asignacion, sinAsignar.map((a) => a.id), { porAlumno: tarea.porAlumno || 1, disposicionNueva: tarea.disposicion || 'p4' });
        const nombres = { ...(tarea.nombres || {}) };
        sinAsignar.forEach((a) => { nombres[a.id] = a.name || 'Alumno'; });
        try { await updateDoc(roomRef, { 'comic.base': limpio(r.comic), 'comic.asignacion': r.asignacion, 'comic.nombres': nombres }); } catch (e) { console.error(e); }
    };

    const guardarInformes = async () => {
        if (!tarea.codigoProfesor) { avisar('⚠ Necesitas un código de profesor para guardar en Informes.'); return; }
        setGuardando(true);
        try {
            const comun = { tipo: 'COMIC', fecha: new Date(), codigoProfesor: tarea.codigoProfesor, sala: codigo, reto: tarea.titulo };
            if (colab) {
                const ids = Object.keys(tarea.asignacion || {});
                const n = Object.values(tarea.asignacion || {}).flat().length;
                await addDoc(collection(db, 'informes_juegos'), {
                    ...comun, modalidad: 'Grupo', titulo: tarea.titulo, comic: comicParaGuardar({ ...montado, titulo: tarea.titulo }),
                    jugadores: ids.map((id) => ({ nombre: nombreDe(id), aciertos: (tarea.asignacion[id] || []).length, intentos: (tarea.asignacion[id] || []).length, porcentaje: 100, vinetas: n })),
                });
                avisar('💾 Cómic de la clase guardado en Informes');
            } else {
                const conDatos = docs.filter((d) => d.data);
                for (const d of conDatos) {
                    const c = normalizarComic(d.data);
                    const n = c.paginas.reduce((s, p) => s + numVinetas(p.disposicion), 0);
                    await addDoc(collection(db, 'informes_juegos'), {
                        ...comun, modalidad: 'Individual', titulo: c.titulo || tarea.titulo, comic: comicParaGuardar(c),
                        jugadores: [{ nombre: nombreDe(d.id), aciertos: n, intentos: n, porcentaje: 100, vinetas: n, paginas: c.paginas.length, entregado: !!d.entregado }],
                    });
                }
                avisar(`💾 ${conDatos.length} cómic(s) guardados en Informes`);
            }
            await updateDoc(roomRef, { 'comic.guardadoAt': Date.now() });
        } catch (e) { avisar('⚠ ' + e.message); }
        setGuardando(false);
    };

    const descargar = async () => {
        if (!svgRef.current) return;
        try {
            const blob = await svgAPng(svgRef.current, 2);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `comic-${codigo}-${verId ? nombreDe(verId) : 'clase'}-pag${pag + 1}.png`.replace(/\s+/g, '-');
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 4000);
        } catch (e) { avisar('⚠ ' + e.message); }
    };

    const caja = { background: '#fdf2f8', border: '1px solid #fbcfe8', borderRadius: 14, padding: 16, marginBottom: 18 };
    const cabecera = (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <h3 style={{ margin: 0, color: '#9d174d' }}>💬 {tarea.titulo} <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>· {colab ? 'uno entre toda la clase' : 'cada uno el suyo'}{fin ? ' · terminado' : ''}</span></h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {!fin ? <button onClick={terminar} style={btn('#dc2626')}>🏁 Terminar y recoger</button> : <button onClick={reanudar} style={btn('#64748b')}>↩ Dejar seguir editando</button>}
                <button onClick={guardarInformes} disabled={guardando} style={btn('#16a34a')}>{guardando ? 'Guardando…' : '💾 Guardar en Informes'}</button>
                <button onClick={() => window.confirm('¿Cerrar el cómic? Guarda antes en Informes o descarga lo que quieras conservar.') && onCerrar()} style={btn('#475569')}>✖ Cerrar</button>
            </div>
        </div>
    );

    if (colab) {
        const comic = montado;
        const nPag = comic.paginas.length;
        const p = Math.min(pag, nPag - 1);
        const asignados = Object.keys(tarea.asignacion || {});
        return (
            <div style={caja}>
                {cabecera}
                {tarea.consigna && <div style={{ fontSize: '0.88rem', color: '#831843', marginBottom: 10 }}>🎓 {tarea.consigna}</div>}
                {mensaje && <div style={{ background: 'white', borderRadius: 10, padding: '8px 12px', marginBottom: 10, fontWeight: 700 }}>{mensaje}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px,100%), 1fr))', gap: 14 }}>
                    <div style={{ background: 'white', borderRadius: 12, padding: 10, gridColumn: 'span 2', minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                            {comic.paginas.map((_, i) => <button key={i} onClick={() => setPag(i)} style={{ ...chip(i === p), padding: '4px 10px' }}>Pág. {i + 1}</button>)}
                            <div style={{ flex: 1 }} />
                            <button onClick={descargar} style={btn('#0984e3', { padding: '6px 10px' })}>🖼️ PNG</button>
                        </div>
                        <div style={{ height: 'min(70vh, 640px)' }}>
                            <ComicPagina comic={vistaPagina(comic, p)} svgRef={svgRef} idPrefijo={`pcp${p}`} etiquetas={etiquetasDe(tarea, p)} />
                        </div>
                    </div>
                    <div style={{ background: 'white', borderRadius: 12, padding: 10, minWidth: 0 }}>
                        <b style={{ fontSize: '0.9rem' }}>Reparto ({asignados.length})</b>
                        {sinAsignar.length > 0 && <button onClick={darVinetas} style={{ ...btn('#e84393'), width: '100%', justifyContent: 'center', margin: '8px 0' }}>➕ Dar viñeta a {sinAsignar.length} nuevo{sinAsignar.length === 1 ? '' : 's'}</button>}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, maxHeight: 520, overflowY: 'auto' }}>
                            {asignados.map((id) => {
                                const ks = tarea.asignacion[id] || [];
                                const d = porId[id];
                                const nEls = ks.reduce((s, k) => s + (d?.vinetas?.[k]?.els?.length || 0), 0);
                                return <div key={id} style={{ border: '1px solid #f1f5f9', borderRadius: 9, padding: '6px 9px', fontSize: '0.84rem', cursor: 'pointer' }}
                                    onClick={() => setPag(Number(ks[0]?.split('-')[0] || 0))}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                                        <b>{nombreDe(id)}</b>
                                        <span style={{ color: nEls ? '#16a34a' : '#94a3b8', fontWeight: 700 }}>{d?.entregado ? '✅' : nEls ? `✏ ${nEls}` : '⏳'}</span>
                                    </div>
                                    <div style={{ color: '#64748b', fontSize: '0.76rem' }}>{ks.map(etiquetaClave).join(' · ')}</div>
                                </div>;
                            })}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Individual
    const lista = [...new Set([...alumnos.map((a) => a.id), ...docs.map((d) => d.id)])];
    const visto = verId ? porId[verId] : null;
    const comicVisto = visto?.data ? normalizarComic(visto.data) : null;
    const entregados = docs.filter((d) => d.entregado).length;
    return (
        <div style={caja}>
            {cabecera}
            {tarea.consigna && <div style={{ fontSize: '0.88rem', color: '#831843', marginBottom: 10 }}>🎓 {tarea.consigna}</div>}
            <div style={{ fontSize: '0.85rem', color: '#9d174d', fontWeight: 700, marginBottom: 10 }}>{entregados}/{lista.length} entregados</div>
            {mensaje && <div style={{ background: 'white', borderRadius: 10, padding: '8px 12px', marginBottom: 10, fontWeight: 700 }}>{mensaje}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
                {lista.map((id) => {
                    const d = porId[id];
                    const c = d?.data ? normalizarComic(d.data) : null;
                    return <div key={id} onClick={() => c && (setVerId(id), setPag(0))} style={{ background: 'white', borderRadius: 12, padding: 8, cursor: c ? 'pointer' : 'default', border: d?.entregado ? '2px solid #86efac' : '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', marginBottom: 6, gap: 4 }}>
                            <b style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombreDe(id)}</b>
                            <span style={{ fontWeight: 700, color: d?.entregado ? '#16a34a' : '#94a3b8', whiteSpace: 'nowrap' }}>{d?.entregado ? '✅' : c ? '✏' : '⏳'}{c && c.paginas.length > 1 ? ` ${c.paginas.length}p` : ''}</span>
                        </div>
                        {c ? <MiniMemo comic={c} at={d.at} /> : <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', fontSize: '0.8rem' }}>Sin empezar</div>}
                    </div>;
                })}
            </div>
            {comicVisto && (
                <div onClick={() => setVerId(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.88)', zIndex: 10050, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 14, gap: 10 }}>
                    <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
                        <b style={{ color: 'white' }}>{nombreDe(verId)}</b>
                        {comicVisto.paginas.length > 1 && comicVisto.paginas.map((_, i) => <button key={i} onClick={() => setPag(i)} style={{ ...chip(i === pag), padding: '4px 10px' }}>Pág. {i + 1}</button>)}
                        <button onClick={descargar} style={btn('#0984e3')}>🖼️ PNG</button>
                        {visto.entregado && <button onClick={() => reabrir(verId)} style={btn('#f59e0b')}>↩ Reabrir entrega</button>}
                        <button onClick={() => setVerId(null)} style={btn('rgba(255,255,255,0.2)')}>✕ Cerrar</button>
                    </div>
                    <div onClick={(e) => e.stopPropagation()} style={{ flex: 1, width: '100%', maxWidth: 1000, minHeight: 0 }}>
                        <ComicPagina comic={vistaPagina(comicVisto, Math.min(pag, comicVisto.paginas.length - 1))} svgRef={svgRef} idPrefijo={`pci${pag}`} />
                    </div>
                </div>
            )}
        </div>
    );
}

// Miniatura que solo se redibuja cuando cambia el cómic del alumno.
function MiniMemo({ comic, at }) {
    return useMemo(() => <Mini comic={comic} alto={130} />, [at]); // eslint-disable-line react-hooks/exhaustive-deps
}

// ─── Vista del alumno ────────────────────────────────────────────────────────
export function ComicAlumnoAula({ tarea, codigo, studentId, nombre }) {
    const colab = tarea.modo === 'colaborativo';
    const fin = tarea.state === 'FIN';
    const refDoc = useMemo(() => doc(db, 'control_rooms', codigo, 'comics', studentId), [codigo, studentId]);
    const [inicial, setInicial] = useState(null);
    const [entregado, setEntregado] = useState(false);
    const [otros, setOtros] = useState([]);
    const [estadoGuardado, setEstadoGuardado] = useState('');
    const pendiente = useRef(null);
    const timer = useRef(null);
    const entregadoRef = useRef(false);

    // Mis viñetas (colaborativo) con identidad estable.
    const misClaves = JSON.stringify(tarea.asignacion?.[studentId] || []);
    const editables = useMemo(() => new Set(JSON.parse(misClaves)), [misClaves]);

    // Cargar lo que ya tenía (recarga de página) o empezar.
    useEffect(() => {
        let vivo = true;
        getDoc(refDoc).then((s) => {
            if (!vivo) return;
            const d = s.exists() ? s.data() : null;
            const mio = d?.taskId === tarea.taskId ? d : null;
            if (!colab) {
                const base = mio?.data ? normalizarComic(mio.data) : { ...normalizarComic(limpio(tarea.base)), id: nid(), autor: nombre };
                setInicial(base);
            } else setInicial(true);
            if (mio?.entregado) { setEntregado(true); entregadoRef.current = true; }
            if (colab && mio) setOtros((o) => [...o.filter((x) => x.id !== studentId), { id: studentId, comic: mio }]);
        }).catch(() => vivo && setInicial(colab ? true : normalizarComic(limpio(tarea.base))));
        return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refDoc, tarea.taskId]);

    // El profe puede reabrir la entrega.
    useEffect(() => onSnapshot(refDoc, (s) => {
        const d = s.data();
        if (d?.taskId !== tarea.taskId) return;
        entregadoRef.current = !!d.entregado;
        setEntregado(!!d.entregado);
    }), [refDoc, tarea.taskId]);

    // Colaborativo: compañeros cada 20 s (y al volver a la pestaña).
    const traerOtros = useCallback(async () => {
        try {
            const snap = await getDocs(collection(db, 'control_rooms', codigo, 'comics'));
            setOtros(snap.docs.map((d) => ({ id: d.id, comic: d.data() })));
        } catch { /* nada */ }
    }, [codigo]);
    useEffect(() => {
        if (!colab) return;
        traerOtros();
        const id = setInterval(traerOtros, POLL_MS);
        const alVolver = () => { if (document.visibilityState === 'visible') traerOtros(); };
        document.addEventListener('visibilitychange', alVolver);
        return () => { clearInterval(id); document.removeEventListener('visibilitychange', alVolver); };
    }, [colab, traerOtros]);

    const escribir = useCallback(async (datos, extra = {}) => {
        setEstadoGuardado('Guardando…');
        try {
            await setDoc(refDoc, limpio({ taskId: tarea.taskId, nombre, at: Date.now(), entregado: entregadoRef.current, ...datos, ...extra }));
            setEstadoGuardado('✔ Guardado');
        } catch { setEstadoGuardado('⚠ Sin conexión: se reintentará'); }
    }, [refDoc, tarea.taskId, nombre]);

    const datosDe = useCallback((comic) => {
        if (!colab) return { data: { ...comic, paginas: comic.paginas } };
        const vinetas = {};
        editables.forEach((k) => { const [p, v] = k.split('-').map(Number); const vv = comic.paginas[p]?.vinetas[v]; if (vv) vinetas[k] = vv; });
        return { vinetas };
    }, [colab, editables]);

    const onCambio = useCallback((comic) => {
        pendiente.current = comic;
        clearTimeout(timer.current);
        timer.current = setTimeout(() => { if (pendiente.current) escribir(datosDe(pendiente.current)); pendiente.current = null; }, GUARDAR_MS);
    }, [escribir, datosDe]);

    const ultimo = useRef(null);
    const onCambioConUltimo = useCallback((c) => { ultimo.current = c; onCambio(c); }, [onCambio]);
    const entregar = useCallback(async () => {
        clearTimeout(timer.current);
        pendiente.current = null;
        entregadoRef.current = true;
        setEntregado(true);
        const c = ultimo.current || (colab ? null : inicial);
        if (c) await escribir(datosDe(c), { entregado: true });
        else await setDoc(refDoc, { taskId: tarea.taskId, nombre, entregado: true, at: Date.now() }, { merge: true }).catch(() => {});
    }, [colab, inicial, escribir, datosDe, refDoc, tarea.taskId, nombre]);

    // Al terminar el profe: se entrega lo que haya.
    useEffect(() => { if (fin && !entregadoRef.current && inicial) entregar(); }, [fin, inicial, entregar]);
    useEffect(() => () => {
        clearTimeout(timer.current);
        if (pendiente.current) escribir(datosDe(pendiente.current));
    }, [escribir, datosDe]);

    const externo = useMemo(() => (colab ? montarColaborativo(tarea.base, tarea.asignacion, otros, tarea.taskId) : null), [colab, tarea.base, tarea.asignacion, tarea.taskId, otros]);
    const etiquetas = useMemo(() => {
        if (!colab) return null;
        const comic = normalizarComic(tarea.base);
        const out = {};
        comic.paginas.forEach((_, p) => { const e = etiquetasDe(tarea, p, studentId); Object.entries(e).forEach(([v, t]) => { out[clave(p, Number(v))] = t; }); });
        return out;
    }, [colab, tarea, studentId]);

    if (!inicial) return <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>Cargando el cómic…</div>;

    const soloLectura = entregado || fin || (colab && !editables.size);
    let aviso = estadoGuardado;
    if (colab) {
        aviso = editables.size
            ? `Tus viñetas: ${[...editables].map(etiquetaClave).join(' · ')}. Lo de tus compañeros se actualiza cada 20 s. ${estadoGuardado}`
            : 'Todavía no tienes viñeta: espera a que tu profe te dé una.';
    }
    if (entregado) aviso = fin ? '🏁 Tu profe ha terminado el cómic.' : '✅ Entregado. Si tu profe lo reabre podrás seguir editando.';

    return (
        <ComicCreator
            key={tarea.taskId + misClaves}
            aula={{
                incrustado: true, titulo: tarea.titulo, consigna: tarea.consigna,
                inicial: colab ? null : inicial, editables: colab ? editables : null, externo, etiquetas,
                onCambio: onCambioConUltimo, soloLectura, aviso,
                onEntregar: entregar, textoEntregar: colab ? 'He terminado' : 'Entregar',
            }}
        />
    );
}
