// Laboratorio 3D de Física y Química (/fisica/laboratorio, ?exp=<id>).
// Lista de experimentos → vista 3D con los pasos animados, predicción antes de
// empezar, deslizadores en algunos experimentos y explicación al final.
// «🖨️ Imprimir pasos» genera una ficha PDF con una imagen 3D de cada paso
// (también un cuaderno con varios experimentos desde la lista).
import { useEffect, useMemo, useRef, useState } from 'react';
import { EXPERIMENTOS, experimentoPorId, FUENTE_LIBRO, URL_LIBRO } from './experimentos';
import { crearLaboratorio } from './escenas';
import { generarPdfBloques } from '../utils/pdfBloques';
import { sonidoCorrecto, sonidoIncorrecto } from '../utils/sonidosFeedback';

const AZUL = '#38bdf8';
const esMovil = () => typeof window !== 'undefined' && window.innerWidth <= 800;

function ponerExpEnUrl(id) {
    try {
        const url = new URL(window.location.href);
        if (id) url.searchParams.set('exp', id); else url.searchParams.delete('exp');
        window.history.replaceState(window.history.state, '', url.pathname + url.search);
    } catch { /* sin URL */ }
}

// Captura las imágenes 3D de los pasos de varios experimentos con un laboratorio oculto
function capturarPasos(ids) {
    const div = document.createElement('div');
    Object.assign(div.style, { position: 'fixed', left: '-10000px', top: '0', width: '720px', height: '450px' });
    document.body.appendChild(div);
    const lab = crearLaboratorio(div, { interactivo: false, ancho: 720, alto: 450 });
    const res = {};
    try {
        for (const id of ids) {
            const e = experimentoPorId(id); if (!e) continue;
            lab.cargar(id);
            res[id] = e.pasos.map((_, k) => lab.capturar(k, 0.82));
        }
    } finally { lab.destruir(); div.remove(); }
    return res;
}

// ───────────────────────── ficha imprimible ─────────────────────────
const lineas = (n, alto = 26) => Array.from({ length: n }, (_, i) => <div key={i} style={{ borderBottom: '1px solid #cbd5e1', height: alto }} />);

function HojaExperimento({ e, imgs, explicacion, primera }) {
    const caja = { border: '2px solid #e2e8f0', borderRadius: 12, padding: '12px 16px', marginBottom: 10 };
    const h2 = { margin: '0 0 8px', fontSize: 17, color: e.color, fontWeight: 800 };
    return (
        <>
            <div data-bloque data-pagina={primera ? undefined : '1'} style={{ paddingBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, borderBottom: `4px solid ${e.color}`, paddingBottom: 10, marginBottom: 10 }}>
                    <div style={{ fontSize: 46 }}>{e.emoji}</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: e.color, textTransform: 'uppercase', letterSpacing: 1 }}>Laboratorio de {e.area} · {e.concepto}</div>
                        <div style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', lineHeight: 1.15 }}>{e.titulo}</div>
                        <div style={{ fontSize: 12.5, color: '#475569', marginTop: 3 }}>Nivel: {e.nivel} · Duración: {e.duracion}</div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#334155', marginBottom: 10 }}>
                    <div style={{ flex: 2 }}>Nombre: <span style={{ display: 'inline-block', width: 260, borderBottom: '1px solid #94a3b8' }} /></div>
                    <div style={{ flex: 1 }}>Curso: <span style={{ display: 'inline-block', width: 80, borderBottom: '1px solid #94a3b8' }} /></div>
                    <div style={{ flex: 1 }}>Fecha: <span style={{ display: 'inline-block', width: 90, borderBottom: '1px solid #94a3b8' }} /></div>
                </div>
                <div style={{ ...caja, background: '#f8fafc' }}><b>🎯 Objetivo:</b> {e.objetivo}</div>
            </div>
            <div data-bloque style={{ display: 'flex', gap: 10, marginBottom: 0 }}>
                <div style={{ ...caja, flex: 1.4 }}>
                    <div style={h2}>🧰 Materiales</div>
                    {e.materiales.map((m, i) => <div key={i} style={{ fontSize: 13.5, margin: '3px 0' }}>☐ {m}</div>)}
                </div>
                {e.seguridad && <div style={{ ...caja, flex: 1, background: '#fff7ed', borderColor: '#fdba74' }}>
                    <div style={{ ...h2, color: '#c2410c' }}>⚠️ Seguridad</div>
                    <div style={{ fontSize: 13.5 }}>{e.seguridad}</div>
                </div>}
            </div>
            <div data-bloque style={caja}>
                <div style={h2}>🤔 Hipótesis: antes de empezar</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{e.prediccion.pregunta}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 13.5 }}>
                    {e.prediccion.opciones.map((o, i) => <div key={i}>☐ {o}</div>)}
                </div>
                <div style={{ fontSize: 13, marginTop: 8, color: '#475569' }}>¿Por qué lo crees?</div>
                {lineas(2)}
            </div>
            <div data-bloque style={{ margin: '4px 0 6px' }}><div style={h2}>🧪 Procedimiento paso a paso</div></div>
            {e.pasos.map((p, k) => (
                <div key={k} data-bloque style={{ display: 'flex', gap: 12, alignItems: 'stretch', border: '2px solid #e2e8f0', borderRadius: 12, padding: 8, marginBottom: 8 }}>
                    {imgs?.[k] && <img src={imgs[k]} alt="" style={{ width: 300, height: 188, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                            <div style={{ background: e.color, color: '#fff', fontWeight: 900, borderRadius: 999, minWidth: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{k + 1}</div>
                            <div style={{ fontSize: 14, lineHeight: 1.4, color: '#0f172a' }}>{p.t}</div>
                        </div>
                        <div style={{ marginTop: 'auto', fontSize: 12, color: '#64748b', paddingTop: 6 }}>👀 Observo:</div>
                        {lineas(2, 22)}
                    </div>
                </div>
            ))}
            <div data-bloque style={caja}>
                <div style={h2}>💡 ¿Por qué pasa?</div>
                {explicacion
                    ? e.explicacion.map((t, i) => <p key={i} style={{ fontSize: 13.5, lineHeight: 1.45, margin: '4px 0' }}>{t}</p>)
                    : <>{<div style={{ fontSize: 13, color: '#475569' }}>Explica con tus palabras lo que ha ocurrido. ¿Se cumplió tu hipótesis?</div>}{lineas(4)}</>}
            </div>
            <div data-bloque style={caja}>
                <div style={h2}>✏️ Preguntas</div>
                {e.preguntas.map((q, i) => (
                    <div key={i} style={{ marginBottom: 6 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{i + 1}. {q}</div>
                        {lineas(2, 22)}
                    </div>
                ))}
                {explicacion && <div style={{ fontSize: 12.5, color: '#166534', marginTop: 6 }}>✅ Hipótesis correcta: <b>{e.prediccion.opciones[e.prediccion.ok]}</b>. {e.prediccion.porQue}</div>}
            </div>
            <div data-bloque style={{ fontSize: 10.5, color: '#94a3b8', textAlign: 'center', padding: '4px 0 10px' }}>
                Adaptado de {FUENTE_LIBRO}, pág. {e.pagina}. Versión interactiva en 3D: pikt.es/fisica/laboratorio?exp={e.id}
            </div>
        </>
    );
}

function ModalImprimir({ ids, onClose }) {
    const [explicacion, setExplicacion] = useState(false);
    const [imagenes, setImagenes] = useState(true);
    const [estado, setEstado] = useState(null); // null | 'capturando' | 'pdf' | 'error'
    const [datos, setDatos] = useState(null);
    const hoja = useRef(null);
    const exps = ids.map(experimentoPorId).filter(Boolean);

    const generar = () => {
        setEstado('capturando');
        // dejar que se pinte el «Preparando…» antes de las capturas (bloquean un momento)
        setTimeout(() => {
            try {
                const imgs = imagenes ? capturarPasos(exps.map((e) => e.id)) : {};
                setDatos({ imgs }); setEstado('pdf');
            } catch (err) { console.error(err); setEstado('error'); }
        }, 60);
    };
    useEffect(() => {
        if (estado !== 'pdf' || !hoja.current) return;
        let vivo = true;
        (async () => {
            try {
                const nombre = exps.length === 1 ? `Experimento ${exps[0].titulo}` : 'Cuaderno de laboratorio';
                const { pdf, archivo } = await generarPdfBloques(hoja.current, nombre);
                if (!vivo) return;
                pdf.save(archivo);
                onClose();
            } catch (err) { console.error(err); if (vivo) setEstado('error'); }
        })();
        return () => { vivo = false; };
    }, [estado]); // eslint-disable-line react-hooks/exhaustive-deps

    const btn = { border: 'none', borderRadius: 10, padding: '10px 18px', fontWeight: 800, cursor: 'pointer', fontSize: 15 };
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10050, background: 'rgba(2,6,23,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={estado ? undefined : onClose}>
            <div onClick={(ev) => ev.stopPropagation()} style={{ background: '#fff', color: '#0f172a', borderRadius: 18, padding: 24, width: 'min(460px, 100%)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
                <h2 style={{ margin: '0 0 6px', fontSize: 21 }}>🖨️ {exps.length === 1 ? 'Imprimir los pasos' : `Cuaderno de laboratorio (${exps.length})`}</h2>
                <p style={{ margin: '0 0 14px', color: '#475569', fontSize: 14 }}>
                    {exps.length === 1 ? exps[0].titulo : exps.map((e) => e.titulo).join(' · ')}
                </p>
                <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', margin: '8px 0', cursor: 'pointer' }}>
                    <input type="checkbox" checked={imagenes} onChange={(e) => setImagenes(e.target.checked)} style={{ width: 18, height: 18, marginTop: 2 }} />
                    <span><b>Imagen 3D de cada paso</b><br /><span style={{ fontSize: 13, color: '#64748b' }}>Captura del laboratorio al final de cada paso.</span></span>
                </label>
                <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', margin: '8px 0', cursor: 'pointer' }}>
                    <input type="checkbox" checked={explicacion} onChange={(e) => setExplicacion(e.target.checked)} style={{ width: 18, height: 18, marginTop: 2 }} />
                    <span><b>Incluir la explicación y la hipótesis correcta</b><br /><span style={{ fontSize: 13, color: '#64748b' }}>Sin marcar, el alumnado tiene líneas para explicarlo con sus palabras.</span></span>
                </label>
                <p style={{ fontSize: 12.5, color: '#64748b', margin: '10px 0 16px' }}>Cada ficha incluye objetivo, materiales, seguridad, hipótesis, pasos con espacio para observar, explicación y preguntas.</p>
                {estado === 'error' && <p style={{ color: '#dc2626', fontWeight: 700 }}>No se pudo generar el PDF. Inténtalo de nuevo.</p>}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button onClick={onClose} disabled={estado === 'capturando' || estado === 'pdf'} style={{ ...btn, background: '#e2e8f0', color: '#0f172a' }}>Cancelar</button>
                    <button onClick={generar} disabled={estado === 'capturando' || estado === 'pdf'} style={{ ...btn, background: '#0f766e', color: '#fff' }}>
                        {estado === 'capturando' ? '📸 Preparando imágenes…' : estado === 'pdf' ? '📄 Creando PDF…' : '📄 Descargar PDF'}
                    </button>
                </div>
            </div>
            {estado === 'pdf' && datos && (
                <div style={{ position: 'fixed', left: -10000, top: 0 }}>
                    <div ref={hoja} style={{ width: 794, background: '#fff', fontFamily: "'Segoe UI', Arial, sans-serif", color: '#0f172a', padding: 4 }}>
                        {exps.map((e, i) => <HojaExperimento key={e.id} e={e} imgs={datos.imgs[e.id]} explicacion={explicacion} primera={i === 0} />)}
                    </div>
                </div>
            )}
        </div>
    );
}

// ───────────────────────── vista de un experimento ─────────────────────────
function VistaExperimento({ e, onVolver, onImprimir }) {
    const contRef = useRef(null);
    const labRef = useRef(null);
    const [paso, setPaso] = useState(0);
    const [auto, setAuto] = useState(false);
    const [pred, setPred] = useState(null); // índice elegido
    const [verExplicacion, setVerExplicacion] = useState(false);
    const [params, setParams] = useState({});
    const [movil, setMovil] = useState(esMovil());
    const [verMateriales, setVerMateriales] = useState(!esMovil());
    const autoRef = useRef(false);
    const ultimo = e.pasos.length - 1;

    useEffect(() => {
        const r = () => setMovil(esMovil());
        window.addEventListener('resize', r); return () => window.removeEventListener('resize', r);
    }, []);

    useEffect(() => {
        let lab;
        try {
            lab = crearLaboratorio(contRef.current);
            lab.cargar(e.id);
            lab.irAPaso(0);
            labRef.current = lab;
            lab.alAcabarPaso((k) => {
                if (!autoRef.current) return;
                if (k < ultimo) setTimeout(() => { if (autoRef.current) { setPaso(k + 1); lab.irAPaso(k + 1); } }, 900);
                else { autoRef.current = false; setAuto(false); setVerExplicacion(true); }
            });
        } catch (err) { console.error('[Laboratorio] WebGL', err); }
        return () => { labRef.current = null; lab?.destruir(); };
    }, [e.id, ultimo]);

    const ir = (k) => {
        const n = Math.max(0, Math.min(ultimo, k));
        setPaso(n); labRef.current?.irAPaso(n);
        if (n === ultimo) setTimeout(() => setVerExplicacion(true), 1500);
    };
    const toggleAuto = () => {
        const nuevo = !auto; setAuto(nuevo); autoRef.current = nuevo;
        if (nuevo) { if (paso >= ultimo) ir(0); else labRef.current?.repetir(); }
    };
    const cambiarParam = (k, v) => { setParams((p) => ({ ...p, [k]: v })); labRef.current?.setParam(k, v); };
    const elegir = (i) => {
        if (pred !== null) return;
        setPred(i);
        if (i === e.prediccion.ok) sonidoCorrecto(); else sonidoIncorrecto();
    };

    const btn = (bg, extra = {}) => ({ background: bg, color: '#fff', border: 'none', borderRadius: 10, padding: '9px 14px', fontWeight: 800, cursor: 'pointer', fontSize: 14, ...extra });
    const panel = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 14, marginBottom: 12 };

    return (
        <div style={{ minHeight: '100vh', paddingTop: 58, boxSizing: 'border-box', color: '#e2e8f0', fontFamily: "'Segoe UI', Tahoma, sans-serif" }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '0 16px 10px' }}>
                <button onClick={onVolver} style={btn('rgba(255,255,255,0.12)')}>← Experimentos</button>
                <div style={{ fontSize: 30 }}>{e.emoji}</div>
                <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontSize: 12, color: e.color, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>{e.area} · {e.concepto}</div>
                    <h1 style={{ margin: 0, fontSize: movil ? 20 : 25, color: '#fff' }}>{e.titulo}</h1>
                </div>
                <button onClick={onImprimir} style={btn('#0f766e')}>🖨️ Imprimir pasos</button>
            </div>

            <div style={{ display: 'flex', flexDirection: movil ? 'column' : 'row', gap: 14, padding: '0 16px 20px' }}>
                {/* escena 3D */}
                <div style={{ flex: movil ? 'none' : 1.7, position: 'relative' }}>
                    <div ref={contRef} style={{ width: '100%', height: movil ? '52vh' : 'calc(100vh - 150px)', minHeight: 320, borderRadius: 16, overflow: 'hidden', background: '#1c2638', touchAction: 'none' }} />
                    <div style={{ position: 'absolute', left: 12, right: 12, bottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <button onClick={() => ir(paso - 1)} disabled={paso === 0} style={btn('rgba(15,23,42,0.85)', { opacity: paso === 0 ? 0.4 : 1 })}>◀</button>
                        <button onClick={() => labRef.current?.repetir()} style={btn('rgba(15,23,42,0.85)')} title="Repetir la animación de este paso">🔁</button>
                        <button onClick={toggleAuto} style={btn(auto ? '#dc2626' : '#2563eb')}>{auto ? '⏸ Parar' : '▶ Ver todo'}</button>
                        <button onClick={() => ir(paso + 1)} disabled={paso === ultimo} style={btn(e.color, { opacity: paso === ultimo ? 0.4 : 1 })}>Siguiente ▶</button>
                        <button onClick={() => labRef.current?.reencuadrar()} style={btn('rgba(15,23,42,0.85)')} title="Volver a centrar la cámara">🎯</button>
                        <span style={{ marginLeft: 'auto', background: 'rgba(15,23,42,0.85)', borderRadius: 10, padding: '7px 12px', fontWeight: 800 }}>Paso {paso + 1} / {ultimo + 1}</span>
                    </div>
                    <div style={{ position: 'absolute', top: 10, left: 12, fontSize: 12, color: 'rgba(255,255,255,0.55)', background: 'rgba(15,23,42,0.6)', padding: '4px 9px', borderRadius: 8 }}>
                        🖱️ Arrastra para girar · rueda o pellizco para acercar
                    </div>
                </div>

                {/* panel lateral */}
                <div style={{ flex: movil ? 'none' : 1, maxHeight: movil ? 'none' : 'calc(100vh - 150px)', overflowY: 'auto' }}>
                    <div style={{ ...panel, borderColor: pred === null ? '#facc15' : 'rgba(255,255,255,0.1)' }}>
                        <div style={{ fontWeight: 800, color: '#fde68a', marginBottom: 6 }}>🤔 Antes de empezar: ¿qué crees que pasará?</div>
                        <div style={{ fontSize: 14.5, marginBottom: 8 }}>{e.prediccion.pregunta}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                            {e.prediccion.opciones.map((o, i) => {
                                const ok = pred !== null && i === e.prediccion.ok, mal = pred === i && i !== e.prediccion.ok;
                                return (
                                    <button key={i} onClick={() => elegir(i)} style={{ textAlign: 'left', padding: '8px 10px', borderRadius: 10, border: `2px solid ${ok ? '#22c55e' : mal ? '#ef4444' : 'rgba(255,255,255,0.15)'}`, background: ok ? 'rgba(34,197,94,0.2)' : mal ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)', color: '#fff', cursor: pred === null ? 'pointer' : 'default', fontSize: 13.5 }}>{o}</button>
                                );
                            })}
                        </div>
                        {pred !== null && <div style={{ marginTop: 8, fontSize: 13.5, color: pred === e.prediccion.ok ? '#86efac' : '#fca5a5' }}>
                            {pred === e.prediccion.ok ? '✅ ¡Bien pensado! ' : '❌ No exactamente. '}Haz el experimento y compruébalo.
                        </div>}
                    </div>

                    <div style={panel}>
                        <div style={{ fontWeight: 800, color: AZUL, marginBottom: 8 }}>🧪 Pasos</div>
                        {e.pasos.map((p, k) => (
                            <div key={k} onClick={() => ir(k)} style={{ display: 'flex', gap: 10, padding: '8px 8px', borderRadius: 10, cursor: 'pointer', marginBottom: 4, background: k === paso ? `${e.color}33` : 'transparent', border: `1px solid ${k === paso ? e.color : 'transparent'}`, opacity: k > paso ? 0.6 : 1 }}>
                                <div style={{ background: k <= paso ? e.color : 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 900, borderRadius: 999, minWidth: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{k < paso ? '✓' : k + 1}</div>
                                <div style={{ fontSize: 14, lineHeight: 1.4 }}>{p.t}</div>
                            </div>
                        ))}
                        {(e.controles || []).filter((c) => paso >= (c.desdePaso ?? 0)).map((c) => (
                            <div key={c.k} style={{ marginTop: 10, background: 'rgba(56,189,248,0.1)', borderRadius: 10, padding: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14 }}>
                                    <span>{c.label}</span><span style={{ color: AZUL }}>{params[c.k] ?? c.defecto} {c.unidad}</span>
                                </div>
                                <input type="range" min={c.min} max={c.max} step={c.paso} value={params[c.k] ?? c.defecto} onChange={(ev) => cambiarParam(c.k, Number(ev.target.value))} style={{ width: '100%', accentColor: e.color }} />
                            </div>
                        ))}
                    </div>

                    <div style={panel}>
                        <div onClick={() => setVerMateriales((v) => !v)} style={{ fontWeight: 800, color: '#a7f3d0', cursor: 'pointer' }}>🧰 Materiales {verMateriales ? '▾' : '▸'}</div>
                        {verMateriales && <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 14, lineHeight: 1.5 }}>{e.materiales.map((m, i) => <li key={i}>{m}</li>)}</ul>}
                        {e.seguridad && <div style={{ marginTop: 10, background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.4)', borderRadius: 10, padding: '8px 10px', fontSize: 13.5 }}>⚠️ {e.seguridad}</div>}
                    </div>

                    <div style={panel}>
                        {!verExplicacion
                            ? <button onClick={() => setVerExplicacion(true)} style={btn('#7c3aed', { width: '100%' })}>💡 ¿Por qué pasa?</button>
                            : <>
                                <div style={{ fontWeight: 800, color: '#c4b5fd', marginBottom: 6 }}>💡 ¿Por qué pasa?</div>
                                {e.explicacion.map((t, i) => <p key={i} style={{ fontSize: 14, lineHeight: 1.5, margin: '6px 0' }}>{t}</p>)}
                                <div style={{ fontSize: 13, color: '#86efac', marginTop: 6 }}>Respuesta a la predicción: <b>{e.prediccion.opciones[e.prediccion.ok]}</b>. {e.prediccion.porQue}</div>
                            </>}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)', padding: '0 4px' }}>
                        Adaptado de <a href={URL_LIBRO} target="_blank" rel="noreferrer" style={{ color: 'rgba(255,255,255,0.6)' }}>{FUENTE_LIBRO}</a>, pág. {e.pagina}. Nivel orientativo: {e.nivel}.
                    </div>
                </div>
            </div>
        </div>
    );
}

// ───────────────────────── lista ─────────────────────────
export default function LaboratorioExperimentos() {
    const inicial = useMemo(() => { try { return experimentoPorId(new URLSearchParams(window.location.search).get('exp'))?.id || null; } catch { return null; } }, []);
    const [activo, setActivo] = useState(inicial);
    const [filtro, setFiltro] = useState('Todos');
    const [cuaderno, setCuaderno] = useState([]);
    const [imprimir, setImprimir] = useState(null); // lista de ids

    const abrir = (id) => { setActivo(id); ponerExpEnUrl(id); window.scrollTo(0, 0); };
    const exp = activo ? experimentoPorId(activo) : null;

    if (exp) return (
        <>
            <VistaExperimento key={exp.id} e={exp} onVolver={() => abrir(null)} onImprimir={() => setImprimir([exp.id])} />
            {imprimir && <ModalImprimir ids={imprimir} onClose={() => setImprimir(null)} />}
        </>
    );

    const lista = EXPERIMENTOS.filter((e) => filtro === 'Todos' || e.area === filtro);
    const marcar = (id) => setCuaderno((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
    const chip = (activoChip) => ({ border: 'none', borderRadius: 999, padding: '8px 16px', fontWeight: 800, cursor: 'pointer', fontSize: 14, background: activoChip ? '#38bdf8' : 'rgba(255,255,255,0.1)', color: activoChip ? '#0f172a' : '#fff' });

    return (
        <div style={{ minHeight: '100vh', padding: '64px 16px 40px', boxSizing: 'border-box', background: 'linear-gradient(135deg,#0f0f1a,#132238)', color: '#e2e8f0', fontFamily: "'Segoe UI', Tahoma, sans-serif" }}>
            <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: 22 }}>
                    <div style={{ fontSize: 58 }}>🧪</div>
                    <h1 style={{ color: '#fff', margin: '4px 0 6px', fontSize: 'clamp(1.6rem, 4vw, 2.3rem)' }}>Laboratorio 3D de Física y Química</h1>
                    <p style={{ color: 'rgba(255,255,255,0.65)', margin: '0 auto', maxWidth: 640 }}>
                        Experimentos sencillos y llamativos para hacer en clase o en casa. Míralos paso a paso en 3D, haz tu predicción y descarga la ficha con los pasos para hacerlos de verdad.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
                    {['Todos', 'Química', 'Física'].map((a) => <button key={a} onClick={() => setFiltro(a)} style={chip(filtro === a)}>{a === 'Química' ? '⚗️ ' : a === 'Física' ? '🧲 ' : ''}{a}</button>)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
                    {lista.map((e) => {
                        const enCuaderno = cuaderno.includes(e.id);
                        return (
                            <div key={e.id} style={{ position: 'relative', background: 'rgba(255,255,255,0.06)', border: `2px solid ${e.color}55`, borderRadius: 16, padding: '18px 16px 14px', cursor: 'pointer', transition: 'transform .2s, background .2s' }}
                                onClick={() => abrir(e.id)}
                                onMouseEnter={(ev) => { ev.currentTarget.style.transform = 'translateY(-4px)'; ev.currentTarget.style.background = `${e.color}22`; }}
                                onMouseLeave={(ev) => { ev.currentTarget.style.transform = 'none'; ev.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}>
                                <label onClick={(ev) => ev.stopPropagation()} title="Añadir al cuaderno de laboratorio (PDF con varios experimentos)" style={{ position: 'absolute', top: 10, right: 10, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={enCuaderno} onChange={() => marcar(e.id)} style={{ width: 17, height: 17, accentColor: e.color }} />🖨️
                                </label>
                                <div style={{ fontSize: 42 }}>{e.emoji}</div>
                                <div style={{ fontSize: 11.5, fontWeight: 800, color: e.color, textTransform: 'uppercase', letterSpacing: 1, marginTop: 6 }}>{e.area}</div>
                                <h3 style={{ color: '#fff', margin: '2px 0 6px', fontSize: '1.08rem' }}>{e.titulo}</h3>
                                <p style={{ margin: 0, fontSize: 13.5, color: 'rgba(255,255,255,0.65)' }}>{e.concepto}</p>
                                <p style={{ margin: '8px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{e.nivel} · ⏱ {e.duracion} · {e.pasos.length} pasos</p>
                            </div>
                        );
                    })}
                </div>
                <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 26 }}>
                    Experimentos adaptados de <a href={URL_LIBRO} target="_blank" rel="noreferrer" style={{ color: 'rgba(255,255,255,0.6)' }}>{FUENTE_LIBRO}</a>.
                </p>
            </div>
            {cuaderno.length > 0 && (
                <div style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 10002, display: 'flex', gap: 8, background: '#0f172a', border: '1px solid #334155', borderRadius: 14, padding: 8, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                    <button onClick={() => setImprimir(cuaderno)} style={{ background: '#0f766e', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontWeight: 800, cursor: 'pointer' }}>🖨️ Cuaderno de laboratorio ({cuaderno.length})</button>
                    <button onClick={() => setCuaderno([])} style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 12px', cursor: 'pointer' }}>✕</button>
                </div>
            )}
            {imprimir && <ModalImprimir ids={imprimir} onClose={() => setImprimir(null)} />}
        </div>
    );
}
