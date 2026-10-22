// Ficha imprimible (PDF A4) de un bloque de «Uso de la calculadora», con las
// indicaciones de teclas de la Casio fx-82MS. Se captura con html2canvas por
// secciones ([data-bloque]) como en fichas/FichasImprimibles.jsx, porque jsPDF
// no tiene glifos para √ ² ⁻¹ ° ′ ″ π ⌟…
import React, { useMemo, useRef, useState } from 'react';
import { ChipsTeclas } from './Fx82MS';
import { formatear } from './respuestas';
import { urlCalculadora } from './appsCalculadora';

const ANCHO = 760; // px de la hoja (≈ A4 a 96 dpi menos márgenes)

const linea = (w = '100%') => <span style={{ display: 'inline-block', width: w, borderBottom: '1.5px solid #94a3b8', height: 18 }} />;

const solucionReto = (r) => `${typeof r.respuesta === 'string' ? r.respuesta : formatear(r.respuesta)}${r.unidad ? ` ${r.unidad}` : ''}`;

// ─── Contenido de la hoja
function Hoja({ bloque, retos, regs, teclas, soluciones, conTeclasClave }) {
    const color = bloque.color;
    const sec = { padding: '10px 4px', breakInside: 'avoid' };
    const caja = { border: `2px solid ${color}55`, borderRadius: 12, padding: '10px 14px', background: '#fff' };
    return (
        <div style={{ width: ANCHO, background: '#fff', color: '#0f172a', fontFamily: "'Segoe UI', Tahoma, sans-serif", fontSize: 14, lineHeight: 1.45 }}>
            <div data-bloque style={sec}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: `4px solid ${color}`, paddingBottom: 8 }}>
                    <span style={{ fontSize: 38 }}>{bloque.emoji}</span>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color, letterSpacing: 1 }}>USO DE LA CALCULADORA · CASIO fx-82MS</div>
                        <div style={{ fontSize: 24, fontWeight: 900 }}>{bloque.titulo}</div>
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', textAlign: 'right' }}>pikt.es<br />{urlCalculadora(bloque.id).replace(/^https?:\/\//, '')}</div>
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
                    <span style={{ flex: 3 }}>Nombre: {linea('75%')}</span>
                    <span style={{ flex: 1.3 }}>Curso: {linea('55%')}</span>
                    <span style={{ flex: 1.5 }}>Fecha: {linea('60%')}</span>
                </div>
                <p style={{ margin: '10px 0 0', color: '#334155' }}>
                    {bloque.descripcion} Resuelve cada situación con tu calculadora
                    {teclas === 'mostrar' ? ' siguiendo la secuencia de teclas indicada' : teclas === 'escribir' ? ' y apunta las teclas que has pulsado' : ''}.
                </p>
                {bloque.preparacion && (
                    <div style={{ marginTop: 8, padding: '6px 10px', background: '#fef9c3', borderRadius: 8, border: '1.5px solid #facc15' }}>
                        ⚙️ <b>Prepara la calculadora:</b> {bloque.preparacion}
                    </div>
                )}
            </div>

            {conTeclasClave && (
                <div data-bloque style={sec}>
                    <div style={{ ...caja, background: `${color}0d` }}>
                        <div style={{ fontWeight: 900, color, marginBottom: 6 }}>🎹 Teclas que vas a usar</div>
                        {bloque.teclasClave.map((t, i) => (
                            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '3px 0' }}>
                                <div style={{ minWidth: 150 }}><ChipsTeclas teclas={t.teclas} compacto /></div>
                                <div style={{ fontSize: 13 }}>{t.que}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {retos.length > 0 && (
                <div data-bloque style={{ ...sec, paddingBottom: 0 }}>
                    <div style={{ fontWeight: 900, fontSize: 17, color }}>🎯 Retos</div>
                </div>
            )}
            {retos.map((r, i) => (
                <div data-bloque key={r.id} style={sec}>
                    <div style={caja}>
                        <div style={{ fontWeight: 900 }}>{i + 1}. {r.titulo}</div>
                        <div style={{ margin: '4px 0 8px' }}>{r.situacion}</div>
                        {teclas === 'mostrar' && (
                            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                                <span style={{ fontSize: 12, fontWeight: 800, color: '#475569', minWidth: 52, paddingTop: 3 }}>Teclas:</span>
                                <ChipsTeclas teclas={r.teclas} compacto />
                            </div>
                        )}
                        {teclas === 'escribir' && (
                            <div style={{ marginBottom: 8 }}><span style={{ fontSize: 12, fontWeight: 800, color: '#475569' }}>Teclas que pulso: </span>{linea('80%')}<div style={{ marginTop: 6 }}>{linea()}</div></div>
                        )}
                        {soluciones ? (
                            <div style={{ background: '#dcfce7', borderRadius: 8, padding: '4px 10px' }}>
                                <b>Solución: {solucionReto(r)}</b>{r.pantalla ? <span style={{ fontFamily: '"Courier New", monospace', marginLeft: 10, color: '#334155' }}>Pantalla: {r.pantalla}</span> : null}
                                <div style={{ fontSize: 12.5, color: '#334155' }}>{r.explicacion}</div>
                            </div>
                        ) : (
                            <div>Resultado: {linea('40%')}{r.unidad ? <b style={{ marginLeft: 6 }}>{r.unidad}</b> : null}</div>
                        )}
                    </div>
                </div>
            ))}

            {regs.length > 0 && (
                <div data-bloque style={{ ...sec, paddingBottom: 0 }}>
                    <div style={{ fontWeight: 900, fontSize: 17, color }}>🔍 Descubre la regularidad</div>
                </div>
            )}
            {regs.map((g, i) => (
                <div data-bloque key={g.id} style={sec}>
                    <div style={caja}>
                        <div style={{ fontWeight: 900 }}>{String.fromCharCode(65 + i)}. {g.titulo}</div>
                        <div style={{ margin: '2px 0 8px', fontSize: 13.5 }}>{g.intro}</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                            <thead>
                                <tr style={{ background: `${color}14` }}>
                                    <th style={th}>Cálculo</th>
                                    {teclas !== 'ocultar' && <th style={th}>Teclas</th>}
                                    <th style={{ ...th, width: 150 }}>Resultado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {g.serie.map((s, j) => (
                                    <tr key={j}>
                                        <td style={{ ...td, fontWeight: 700, whiteSpace: 'nowrap' }}>{s.expr}</td>
                                        {teclas !== 'ocultar' && <td style={td}>{teclas === 'mostrar' ? <ChipsTeclas teclas={s.teclas} compacto /> : null}</td>}
                                        <td style={{ ...td, fontFamily: soluciones ? '"Courier New", monospace' : undefined, fontWeight: soluciones ? 700 : 400 }}>
                                            {soluciones ? (s.mostrar || formatear(s.valor)) : ''}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div style={{ marginTop: 8, fontWeight: 800 }}>🤔 {g.pregunta}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 18px', marginTop: 4 }}>
                            {g.opciones.map((o, j) => (
                                <span key={j} style={{ fontWeight: soluciones && j === g.correcta ? 900 : 400, color: soluciones && j === g.correcta ? '#15803d' : undefined }}>
                                    {soluciones && j === g.correcta ? '☑' : '☐'} {o}
                                </span>
                            ))}
                        </div>
                        {soluciones
                            ? <div style={{ marginTop: 6, fontSize: 12.5, background: '#dcfce7', borderRadius: 8, padding: '4px 10px' }}>{g.conclusion}</div>
                            : <div style={{ marginTop: 8 }}>¿Qué regularidad has descubierto? {linea('55%')}<div style={{ marginTop: 8 }}>{linea()}</div></div>}
                    </div>
                </div>
            ))}
        </div>
    );
}
const th = { textAlign: 'left', padding: '4px 8px', borderBottom: '1.5px solid #cbd5e1', fontSize: 12 };
const td = { padding: '5px 8px', borderBottom: '1px solid #e2e8f0', verticalAlign: 'middle', height: 26 };

async function generarPdf(nodo, nombre) {
    const [{ jsPDF }, html2canvas] = await Promise.all([import('jspdf'), import('html2canvas').then(m => m.default)]);
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210, H = 297, M = 12, ancho = W - 2 * M;
    let y = M;
    for (const b of nodo.querySelectorAll('[data-bloque]')) {
        const canvas = await html2canvas(b, { scale: 2, backgroundColor: '#ffffff', logging: false });
        const h = (canvas.height * ancho) / canvas.width;
        if (y + h > H - M && y > M) { pdf.addPage(); y = M; }
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', M, y, ancho, Math.min(h, H - 2 * M));
        y += h;
    }
    const total = pdf.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
        pdf.setPage(i); pdf.setFontSize(8); pdf.setTextColor(150);
        pdf.text(`${i} / ${total}`, W / 2, H - 5, { align: 'center' });
    }
    return { pdf, archivo: `${nombre.replace(/[^\wáéíóúñü -]/gi, '').trim().replace(/\s+/g, '_') || 'ficha'}.pdf` };
}

const opcionBtn = (activo, color) => ({
    padding: '6px 12px', borderRadius: 18, border: `2px solid ${activo ? color : '#cbd5e1'}`,
    background: activo ? color : '#fff', color: activo ? '#fff' : '#334155', fontWeight: 800, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
});

// ─── Modal con opciones, vista previa y descarga
export function ModalFichaCalculadora({ bloque, onClose }) {
    const todos = useMemo(() => [...bloque.retos, ...bloque.regularidades].map(x => x.id), [bloque]);
    const [sel, setSel] = useState(() => new Set(todos));
    const [teclas, setTeclas] = useState('mostrar');
    const [conTeclasClave, setConTeclasClave] = useState(true);
    const [estado, setEstado] = useState('');
    const refAlumno = useRef(null);
    const refSoluciones = useRef(null);

    const retos = bloque.retos.filter(r => sel.has(r.id));
    const regs = bloque.regularidades.filter(g => sel.has(g.id));
    const props = { bloque, retos, regs, teclas, conTeclasClave };
    const escala = Math.min(1, (Math.min(window.innerWidth - 24, 1100) - 52) / ANCHO);

    const descargar = async (soluciones) => {
        if (!retos.length && !regs.length) return;
        setEstado(soluciones ? 'Generando soluciones…' : 'Generando ficha…');
        try {
            const nodo = (soluciones ? refSoluciones : refAlumno).current;
            const { pdf, archivo } = await generarPdf(nodo, `Calculadora ${bloque.titulo}${soluciones ? ' soluciones' : ''}`);
            pdf.save(archivo);
            setEstado('');
        } catch (e) {
            console.error(e);
            setEstado('No se pudo generar el PDF. Inténtalo de nuevo.');
        }
    };

    const alternar = (id) => setSel(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100010, background: '#0009', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 1100, maxHeight: '94vh', overflow: 'auto', padding: 16, boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <b style={{ fontSize: 18 }}>📄 Ficha imprimible · {bloque.emoji} {bloque.titulo}</b>
                    <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#64748b' }}>✕</button>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 12 }}>
                    <div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', marginBottom: 4 }}>SECUENCIAS DE TECLAS</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button onClick={() => setTeclas('mostrar')} style={opcionBtn(teclas === 'mostrar', bloque.color)}>Mostrarlas</button>
                            <button onClick={() => setTeclas('escribir')} style={opcionBtn(teclas === 'escribir', bloque.color)}>Hueco para escribirlas</button>
                            <button onClick={() => setTeclas('ocultar')} style={opcionBtn(teclas === 'ocultar', bloque.color)}>No incluir</button>
                        </div>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, alignSelf: 'flex-end' }}>
                        <input type="checkbox" checked={conTeclasClave} onChange={e => setConTeclasClave(e.target.checked)} /> Cuadro «Teclas que vas a usar»
                    </label>
                </div>

                <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', marginBottom: 4 }}>EJERCICIOS ({sel.size}/{todos.length})</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    {[...bloque.retos.map(r => ['🎯', r]), ...bloque.regularidades.map(g => ['🔍', g])].map(([ic, x]) => (
                        <button key={x.id} onClick={() => alternar(x.id)} style={opcionBtn(sel.has(x.id), bloque.color)}>{ic} {x.titulo}</button>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
                    <button onClick={() => descargar(false)} disabled={!!estado || !sel.size} style={{ ...opcionBtn(true, bloque.color), padding: '10px 18px', fontSize: 15 }}>⬇️ Descargar ficha (PDF)</button>
                    <button onClick={() => descargar(true)} disabled={!!estado || !sel.size} style={{ ...opcionBtn(true, '#15803d'), padding: '10px 18px', fontSize: 15 }}>✅ Descargar soluciones (PDF)</button>
                    {estado && <span style={{ fontWeight: 700, color: '#475569' }}>{estado}</span>}
                </div>

                <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', marginBottom: 4 }}>VISTA PREVIA</div>
                <div style={{ background: '#e2e8f0', borderRadius: 12, padding: 10, overflow: 'hidden' }}>
                    <div style={{ zoom: escala, width: ANCHO, margin: '0 auto', boxShadow: '0 2px 10px #0002', padding: '8px 0' , background: '#fff' }}>
                        <Hoja {...props} soluciones={false} />
                    </div>
                </div>

                {/* Copias sin escalar para la captura */}
                <div style={{ position: 'fixed', left: -10000, top: 0, pointerEvents: 'none' }} aria-hidden>
                    <div ref={refAlumno}><Hoja {...props} soluciones={false} /></div>
                    <div ref={refSoluciones}><Hoja {...props} soluciones /></div>
                </div>
            </div>
        </div>
    );
}

// ─── Compartir un bloque o un ejercicio (enlace + QR)
const qrUrl = (url) => `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=0f766e&margin=8`;

export function ModalCompartirCalculadora({ url, titulo, onClose }) {
    const [copiado, setCopiado] = useState(false);
    const copiar = async () => {
        try { await navigator.clipboard.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 1800); } catch { window.prompt('Copia el enlace:', url); }
    };
    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100010, background: '#0009', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, padding: 20, maxWidth: 440, width: '100%', textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                    <b style={{ fontSize: 17, color: '#0f766e' }}>🔗 Compartir</b>
                    <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>✕</button>
                </div>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>{titulo}</div>
                <p style={{ margin: '0 0 10px', fontSize: 13, color: '#64748b' }}>Cualquiera con el enlace lo abre directamente, sin iniciar sesión.</p>
                <img src={qrUrl(url)} alt="Código QR" style={{ width: 'min(60vw, 220px)', height: 'min(60vw, 220px)', borderRadius: 12, border: '1px solid #e2e8f0' }} />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, background: '#f0fdfa', borderRadius: 12, padding: '8px 10px' }}>
                    <span style={{ flex: 1, fontSize: 12, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>{url}</span>
                    <button onClick={copiar} style={{ padding: '8px 12px', borderRadius: 10, border: 'none', background: copiado ? '#16a34a' : '#0f766e', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>{copiado ? '✅ Copiado' : '📋 Copiar'}</button>
                </div>
                {navigator.share && (
                    <button onClick={() => navigator.share({ title: titulo, url }).catch(() => {})} style={{ marginTop: 10, padding: '8px 16px', borderRadius: 18, border: '2px solid #0f766e', background: '#fff', color: '#0f766e', fontWeight: 800, cursor: 'pointer' }}>📤 Compartir</button>
                )}
            </div>
        </div>
    );
}
