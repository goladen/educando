// ─────────────────────────────────────────────────────────────────────────────
//  🧩 Ficha mezclada (centro de PDF, bloque MIX): un solo PDF con varias partes
//    · 🎮 Preguntas de un recurso: formato (test, sopa, unir…), hojas y CUÁNTAS
//      preguntas usar (al azar o las primeras) → utils/pdfRecurso.js
//    · 📝 Ejercicios generados de cualquier tema de las fichas (Math World y
//      materias) con el mismo editor de las fichas (fichas/FichasImprimibles.jsx)
//  Al final, una hoja con las soluciones de todas las partes (generarPdfMix).
//  Los ejercicios se pintan fuera de pantalla y se capturan por bloques.
// ─────────────────────────────────────────────────────────────────────────────
import { forwardRef, useContext, useMemo, useRef, useState } from 'react';
import { FUENTES } from '../fichas/motorMathWorld';
import { MATERIAS_FICHAS, motorMateria } from '../fichas/motorMaterias';
import { crearMotorMultitema } from '../fichas/motorMultitema';
import { MotorCtx, EditorEjercicio, nuevoEjercicio, LETRAS, ESPACIOS } from '../fichas/FichasImprimibles';
import { formatosDisponibles, hojasDe, contarElementos, generarPdfMix } from '../utils/pdfRecurso';
import SelectorRecursoPdf, { ETIQUETA_JUEGO } from './SelectorRecursoPdf';

const ROSA = '#be185d';
const nuevaClave = () => Math.random().toString(36).slice(2, 9);

// Un motor con TODOS los temas: matemáticas + materias (Biología, Geografía, Lengua, Música)
let MOTOR = null;
const motorMix = () => {
    if (MOTOR) return MOTOR;
    const fuentes = { ...FUENTES };
    Object.keys(MATERIAS_FICHAS).forEach((m) => Object.assign(fuentes, motorMateria(m)?.fuentes || {}));
    MOTOR = crearMotorMultitema(fuentes, {
        nombre: 'Ficha mezclada', tituloFicha: 'Ficha mezclada', emoji: '🧩',
        ejercicioInicial: { fuente: 'calculo', tipo: 'combinadas', nivel: 2, n: 4 },
        ejercicioNuevo: { fuente: 'calculo', tipo: 'combinadas', nivel: 2, n: 4 },
    });
    return MOTOR;
};

// Qué se cuenta en cada formato
const UNIDAD = { SOPA: 'palabras', ANAGRAMA: 'palabras', UNIR: 'parejas', LINEA: 'acontecimientos', ETIQUETAS: 'etiquetas', ROSCO: 'definiciones' };
const CON_BARAJAR = ['TEST', 'RESPUESTA', 'UNIR', 'ANAGRAMA', 'RULETA'];
// La sopa de la ficha mezclada es una sola cuadrícula: como mucho 20 palabras
const totalParte = (recurso, formato, hojas) => {
    const n = contarElementos(recurso, formato, hojas).total;
    return formato === 'SOPA' ? Math.min(20, n) : n;
};
const sePuedeMezclar = (r) => !!r && r.tipoJuego !== 'LISTENING_RECURSO' && formatosDisponibles(r).length > 0;

// Espera a que carguen las imágenes de los ejercicios (banderas, fotos…) antes de capturarlos
const esperarImagenes = (nodo) => Promise.all([...(nodo?.querySelectorAll('img') || [])]
    .filter((img) => !img.complete)
    .map((img) => new Promise((res) => { img.onload = res; img.onerror = res; setTimeout(res, 8000); })));
const dosFrames = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));

export default function FichaMix() {
    const motor = useMemo(motorMix, []);
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 700;
    const [titulo, setTitulo] = useState('Ficha de repaso');
    const [subtitulo, setSubtitulo] = useState('');
    const [partes, setPartes] = useState([]);
    const [soluciones, setSoluciones] = useState(true);
    const [espacio, setEspacio] = useState('normal');
    const [eligiendo, setEligiendo] = useState(false);
    const [generando, setGenerando] = useState(null);   // null | 'DESCARGAR' | 'IMPRIMIR'
    const [error, setError] = useState('');
    const nodos = useRef({});

    const cambiar = (key, cambios) => setPartes((ps) => ps.map((p) => (p.key === key ? { ...p, ...cambios } : p)));
    const mover = (i, d) => setPartes((ps) => {
        const j = i + d;
        if (j < 0 || j >= ps.length) return ps;
        const a = [...ps]; [a[i], a[j]] = [a[j], a[i]]; return a;
    });
    const borrar = (key) => setPartes((ps) => ps.filter((p) => p.key !== key));

    const anadirRecurso = (recurso) => {
        const formato = formatosDisponibles(recurso)[0]?.id;
        const hojas = hojasDe(recurso).map((_, i) => i);
        const total = totalParte(recurso, formato, hojas);
        setPartes((ps) => [...ps, {
            key: nuevaClave(), tipo: 'recurso', recurso, formato, hojas, titulo: recurso.titulo || 'Preguntas',
            max: Math.min(total, 10), aleatorio: true, barajar: false, dificil: false,
        }]);
        setEligiendo(false);
    };
    const anadirEjercicio = () => setPartes((ps) => [...ps, { key: nuevaClave(), tipo: 'ejercicio', ej: nuevoEjercicio(motor, motor.ejercicioNuevo) }]);

    const nElementos = partes.reduce((s, p) => s + (p.tipo === 'recurso' ? (p.max || 0) : (p.ej?.apartados?.length || 0)), 0);

    const generar = async (modo) => {
        if (!partes.length) return;
        setError('');
        const ventana = modo === 'IMPRIMIR' ? window.open('', '_blank') : null;
        setGenerando(modo);
        try {
            // Los ejercicios se pintan fuera de pantalla al pasar a «generando»: esperamos a que estén
            await dosFrames();
            await document.fonts?.ready;
            await Promise.all(Object.values(nodos.current).map(esperarImagenes));
            const pdf = await generarPdfMix({
                titulo, subtitulo, soluciones, descargar: modo === 'DESCARGAR',
                partes: partes.map((p) => (p.tipo === 'recurso'
                    ? { tipo: 'recurso', titulo: p.titulo, recurso: p.recurso, formato: p.formato, hojas: p.hojas, max: p.max, aleatorio: p.aleatorio, barajar: p.barajar, dificil: p.dificil }
                    : { tipo: 'html', titulo: p.ej.titulo, alumno: nodos.current[`${p.key}-a`], soluciones: nodos.current[`${p.key}-s`] })),
            });
            if (modo === 'IMPRIMIR') {
                const url = pdf.output('bloburl');
                if (ventana) ventana.location.href = url; else window.open(url, '_blank');
            }
        } catch (e) {
            ventana?.close();
            console.error(e);
            setError('No se ha podido crear el PDF: ' + e.message);
        }
        setGenerando(null);
    };

    if (eligiendo) {
        return (
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                    <button onClick={() => setEligiendo(false)} style={S.pestana}>← Volver a la ficha</button>
                    <b style={{ color: '#1e1b4b' }}>Elige el recurso del que sacar preguntas</b>
                </div>
                <SelectorRecursoPdf onElegir={anadirRecurso} filtro={sePuedeMezclar} textoBoton="Añadir a la ficha ›" />
            </div>
        );
    }

    return (
        <MotorCtx.Provider value={motor}>
            {/* Datos de la ficha */}
            <div style={{ ...S.tarjeta, marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <label style={S.campo}>
                        <span style={S.etiqueta}>Título</span>
                        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} style={S.input} placeholder="Ficha de repaso" />
                    </label>
                    <label style={S.campo}>
                        <span style={S.etiqueta}>Subtítulo (opcional)</span>
                        <input value={subtitulo} onChange={(e) => setSubtitulo(e.target.value)} style={S.input} placeholder="Ej.: 2.º ESO · Tema 3" />
                    </label>
                </div>
            </div>

            {partes.length === 0 && (
                <div style={{ textAlign: 'center', color: '#475569', margin: '10px 0 16px', lineHeight: 1.5 }}>
                    Añade las partes de la ficha en el orden que quieras. Por ejemplo: <b>10 preguntas</b> de tu Burbujas en test,
                    una <b>sopa de letras</b> con 8 palabras de tu Pasapalabra y <b>4 operaciones combinadas</b> generadas.
                </div>
            )}

            {/* Partes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {partes.map((p, i) => (p.tipo === 'recurso' ? (
                    <ParteRecurso key={p.key} parte={p} i={i} total={partes.length}
                        onChange={(c) => cambiar(p.key, c)} onMover={(d) => mover(i, d)} onBorrar={() => borrar(p.key)} />
                ) : (
                    <EditorEjercicio key={p.key} ej={p.ej} i={i} total={partes.length} isMobile={isMobile}
                        etiqueta={`Parte ${i + 1} · 📝 Ejercicios generados`}
                        onChange={(ej) => cambiar(p.key, { ej })} onMover={(d) => mover(i, d)} onBorrar={() => borrar(p.key)} />
                )))}
            </div>

            {/* Añadir */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10, margin: '14px 0' }}>
                <button onClick={() => setEligiendo(true)} style={{ ...S.anadir, borderColor: '#0e7490', color: '#0e7490' }}>
                    <span style={{ fontSize: '1.6rem' }}>🎮</span>
                    <span><b>➕ Preguntas de un recurso</b><br /><span style={S.sub}>Tuyo o público: test, sopa, unir, rosco… y cuántas preguntas</span></span>
                </button>
                <button onClick={anadirEjercicio} style={{ ...S.anadir, borderColor: '#7b1fa2', color: '#7b1fa2' }}>
                    <span style={{ fontSize: '1.6rem' }}>📝</span>
                    <span><b>➕ Ejercicios generados</b><br /><span style={S.sub}>Matemáticas, Lengua, Biología, Geografía, Música</span></span>
                </button>
            </div>

            {/* Descargar */}
            {partes.length > 0 && (
                <div style={{ ...S.tarjeta, position: 'sticky', bottom: 10, borderTop: `5px solid ${ROSA}`, boxShadow: '0 -4px 18px rgba(0,0,0,0.12)' }}>
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                        <b style={{ color: '#1e1b4b' }}>{partes.length} parte{partes.length === 1 ? '' : 's'} · {nElementos} preguntas y apartados</b>
                        <label style={S.check}><input type="checkbox" checked={soluciones} onChange={(e) => setSoluciones(e.target.checked)} /> Hoja de soluciones al final</label>
                        {partes.some((p) => p.tipo === 'ejercicio') && (
                            <span style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: '0.84rem', fontWeight: 700, color: '#475569' }}>
                                Espacio para responder:
                                {[['compacto', 'Poco'], ['normal', 'Normal'], ['amplio', 'Mucho']].map(([k, l]) => (
                                    <button key={k} onClick={() => setEspacio(k)} style={{ ...S.mini, ...(espacio === k ? { background: '#7b1fa2', color: 'white', borderColor: '#7b1fa2' } : {}) }}>{l}</button>
                                ))}
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <button onClick={() => generar('IMPRIMIR')} disabled={!!generando} style={{ ...S.btn, background: '#0f766e', opacity: generando ? 0.7 : 1 }}>
                            {generando === 'IMPRIMIR' ? 'Creando…' : '🖨️ Ver e imprimir'}
                        </button>
                        <button onClick={() => generar('DESCARGAR')} disabled={!!generando} style={{ ...S.btn, background: ROSA, opacity: generando ? 0.7 : 1 }}>
                            {generando === 'DESCARGAR' ? 'Creando…' : '⬇️ Descargar PDF'}
                        </button>
                    </div>
                    {error && <div style={{ color: '#b91c1c', fontWeight: 700, marginTop: 8 }}>{error}</div>}
                </div>
            )}

            {/* Ejercicios fuera de pantalla (solo mientras se genera el PDF) */}
            {generando && partes.filter((p) => p.tipo === 'ejercicio').map((p) => (
                <div key={p.key}>
                    <BloquesEjercicio ref={(el) => { nodos.current[`${p.key}-a`] = el; }} ej={p.ej} espacio={espacio} />
                    <BloquesEjercicio ref={(el) => { nodos.current[`${p.key}-s`] = el; }} ej={p.ej} soluciones />
                </div>
            ))}
        </MotorCtx.Provider>
    );
}

// ── Parte «preguntas de un recurso» ─────────────────────────────────────────
function ParteRecurso({ parte, i, total, onChange, onMover, onBorrar }) {
    const { recurso, formato, hojas, max } = parte;
    const formatos = useMemo(() => formatosDisponibles(recurso), [recurso]);
    const todas = useMemo(() => hojasDe(recurso), [recurso]);
    const disponibles = useMemo(() => totalParte(recurso, formato, hojas), [recurso, formato, hojas]);
    const unidad = UNIDAD[formato] || 'preguntas';

    // Al cambiar formato u hojas, el número se ajusta a lo que hay (y si estaba «todas», sigue en todas)
    const conNuevoTotal = (cambios) => {
        const f = cambios.formato ?? formato, h = cambios.hojas ?? hojas;
        const nuevoTotal = totalParte(recurso, f, h);
        const nMax = max >= disponibles ? nuevoTotal : Math.min(max, nuevoTotal);
        onChange({ ...cambios, max: Math.max(nuevoTotal ? 1 : 0, nMax) });
    };
    const fijarMax = (n) => onChange({ max: Math.max(1, Math.min(disponibles, Number(n) || 1)) });

    return (
        <div style={{ ...S.tarjeta, borderLeft: '6px solid #0e7490' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 900, color: '#0e7490', fontSize: '1.05rem' }}>Parte {i + 1} · 🎮 {ETIQUETA_JUEGO[recurso.tipoJuego] || 'Recurso'}</span>
                <span style={{ flex: 1 }} />
                <button onClick={() => onMover(-1)} disabled={i === 0} style={{ ...S.icono, opacity: i === 0 ? 0.35 : 1 }} title="Subir">↑</button>
                <button onClick={() => onMover(1)} disabled={i === total - 1} style={{ ...S.icono, opacity: i === total - 1 ? 0.35 : 1 }} title="Bajar">↓</button>
                <button onClick={onBorrar} style={{ ...S.icono, color: '#e74c3c' }} title="Quitar esta parte">✕</button>
            </div>

            <label style={{ ...S.campo, flex: 'none' }}>
                <span style={S.etiqueta}>Título de la parte</span>
                <input value={parte.titulo} onChange={(e) => onChange({ titulo: e.target.value })} style={S.input} />
            </label>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Recurso: <b>{recurso.titulo || 'Sin título'}</b>{recurso.profesorNombre ? ` · ${recurso.profesorNombre}` : ''}</div>

            <div>
                <div style={S.etiqueta}>Formato</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {formatos.map((f) => (
                        <button key={f.id} title={f.desc} onClick={() => f.id !== formato && conNuevoTotal({ formato: f.id })}
                            style={{ ...S.chip, ...(formato === f.id ? { background: '#0e7490', color: 'white', borderColor: '#0e7490' } : {}) }}>{f.emoji} {f.label}</button>
                    ))}
                </div>
            </div>

            {todas.length > 1 && (
                <div>
                    <div style={S.etiqueta}>Hojas</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {todas.map((h, k) => {
                            const on = hojas.includes(k);
                            return (
                                <button key={k} onClick={() => {
                                    const nuevas = on ? hojas.filter((x) => x !== k) : [...hojas, k].sort((a, b) => a - b);
                                    if (nuevas.length) conNuevoTotal({ hojas: nuevas });
                                }} style={{ ...S.chip, ...(on ? { background: '#0e7490', color: 'white', borderColor: '#0e7490' } : {}) }}>
                                    {h.nombreHoja || `Hoja ${k + 1}`}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {disponibles > 0 ? (
                <div style={{ background: '#ecfeff', borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, color: '#155e75' }}>¿Cuántas {unidad}?</span>
                        <button onClick={() => fijarMax(max - 1)} disabled={max <= 1} style={S.icono}>−</button>
                        <input type="number" min={1} max={disponibles} value={max} onChange={(e) => fijarMax(e.target.value)}
                            style={{ ...S.input, width: 64, textAlign: 'center', fontWeight: 900, fontSize: '1.05rem', padding: '6px 4px' }} />
                        <button onClick={() => fijarMax(max + 1)} disabled={max >= disponibles} style={S.icono}>+</button>
                        <span style={{ color: '#475569', fontWeight: 700 }}>de {disponibles}</span>
                        <button onClick={() => fijarMax(disponibles)} style={{ ...S.mini, marginLeft: 'auto' }}>Todas</button>
                    </div>
                    <input type="range" min={1} max={disponibles} value={max} onChange={(e) => fijarMax(e.target.value)} style={{ width: '100%', accentColor: '#0e7490' }} />
                    {max < disponibles && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', fontSize: '0.84rem' }}>
                            <span style={{ fontWeight: 700, color: '#475569' }}>¿Cuáles?</span>
                            {[[true, '🎲 Al azar'], [false, '⬇️ Las primeras']].map(([v, l]) => (
                                <button key={l} onClick={() => onChange({ aleatorio: v })}
                                    style={{ ...S.mini, ...(parte.aleatorio === v ? { background: '#0e7490', color: 'white', borderColor: '#0e7490' } : {}) }}>{l}</button>
                            ))}
                            {todas.length > 1 && hojas.length > 1 && <span style={{ color: '#64748b' }}>(se reparten entre las hojas elegidas)</span>}
                        </div>
                    )}
                </div>
            ) : (
                <div style={{ color: '#b45309', fontWeight: 700, fontSize: '0.86rem' }}>Con este formato y estas hojas no hay nada que poner. Prueba otro formato.</div>
            )}

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                {CON_BARAJAR.includes(formato) && (
                    <label style={S.check}><input type="checkbox" checked={!!parte.barajar} onChange={(e) => onChange({ barajar: e.target.checked })} /> Barajar el orden</label>
                )}
                {formato === 'SOPA' && (
                    <label style={S.check}><input type="checkbox" checked={!!parte.dificil} onChange={(e) => onChange({ dificil: e.target.checked })} /> Sopa difícil (palabras al revés)</label>
                )}
            </div>
        </div>
    );
}

// ── Ejercicio generado, pintado fuera de pantalla por bloques [data-bloque] ──
// (misma maquetación que la hoja de las fichas, sin cabecera)
const BloquesEjercicio = forwardRef(function BloquesEjercicio({ ej, soluciones = false, espacio = 'normal' }, ref) {
    const motor = useContext(MotorCtx);
    const { cols, alto } = motor.layout(ej);
    const factor = ESPACIOS[espacio] || 1;
    const filas = [];
    for (let i = 0; i < ej.apartados.length; i += cols) filas.push(ej.apartados.slice(i, i + cols).map((ap, k) => ({ ap, idx: i + k })));
    return (
        <div ref={ref} style={{ position: 'fixed', left: -12000, top: 0, width: 760, background: 'white', fontFamily: "'Segoe UI', Tahoma, sans-serif", color: '#2c3e50' }}>
            {filas.map((fila, fi) => (
                <div key={fi} data-bloque="fila" style={{ padding: '4px 4px 8px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 14 }}>
                        {fila.map(({ ap, idx }) => (
                            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <div style={{ display: 'flex', alignItems: motor.esTexto(ap) ? 'flex-start' : 'center', gap: 8 }}>
                                    <b style={{ fontSize: 15, color: '#7b1fa2' }}>{LETRAS[idx]})</b>
                                    <div style={{ flex: 1, minWidth: 0 }}><motor.Enunciado ap={ap} size={motor.sizeHoja ? motor.sizeHoja(ap) : '1.3rem'} /></div>
                                </div>
                                {soluciones
                                    ? <div style={{ paddingLeft: 22 }}><motor.Solucion ap={ap} size="1.2rem" /></div>
                                    : <div style={{ height: Math.round(alto * factor) }} />}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
});

const S = {
    tarjeta: { display: 'flex', flexDirection: 'column', gap: 10, background: 'white', borderRadius: 14, padding: '14px 14px', boxShadow: '0 2px 10px rgba(0,0,0,0.07)', boxSizing: 'border-box' },
    campo: { display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 240px', minWidth: 0 },
    etiqueta: { fontSize: '0.78rem', fontWeight: 800, color: '#64748b', marginBottom: 4 },
    input: { padding: '9px 11px', borderRadius: 10, border: '2px solid #e2e8f0', fontSize: '0.95rem', fontFamily: 'inherit', boxSizing: 'border-box', minWidth: 0 },
    chip: { padding: '6px 11px', borderRadius: 18, border: '2px solid #cbd5e1', background: 'white', color: '#334155', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' },
    mini: { padding: '4px 10px', borderRadius: 14, border: '2px solid #cbd5e1', background: 'white', color: '#334155', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' },
    icono: { width: 32, height: 32, borderRadius: 10, border: '1px solid #ddd', background: 'white', cursor: 'pointer', fontWeight: 900 },
    check: { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.86rem', fontWeight: 700, color: '#334155', cursor: 'pointer' },
    anadir: { display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', padding: '14px 16px', borderRadius: 16, border: '2px dashed', background: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.95rem' },
    sub: { fontSize: '0.8rem', color: '#64748b', fontWeight: 600 },
    btn: { flex: 1, padding: '11px 12px', borderRadius: 12, border: 'none', color: 'white', fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.92rem' },
    pestana: { padding: '8px 14px', borderRadius: 20, border: '2px solid #cbd5e1', background: 'white', color: '#1e293b', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.88rem' },
};
