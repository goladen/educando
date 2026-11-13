// ─────────────────────────────────────────────────────────────────────────────
//  Ficha PDF de un simulador de Física o Química. Cada simulador tiene la suya
//  (contenido en «Simuladores física/fichasSimuladores.js»):
//    1. Lo que vamos a estudiar: objetivo, teoría y fórmulas clave
//    + captura de la animación tal como está en ese momento
//    2. Experimenta con el simulador: actividades guiadas
//    3. Test del propio simulador (PREGUNTAS_SIM)
//    4. Ejercicios propios (química: partículas, Lewis, ajuste de reacciones)
//    5. Problemas con ecuaciones del tema (solo Física y Química)
//  Hoja de soluciones opcional (con resolución paso a paso y solución gráfica).
//  «✏️ Previsualizar y editar»: la hoja se ve tal cual saldrá y se pueden editar sus
//  textos, quitar/regenerar ejercicios, cambiar cantidades y añadir problemas propios.
//  PDF con html2canvas por bloques (utils/pdfBloques.js).
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { plantillasPara, generarDesdePlantilla, TIPOS_ECU } from './problemasCiencias';
import { textoSoluciones, datosGrafica } from './ecuacionesAvanzadas';
import { MathText } from './UIEcuaciones';
import GraficaEcuacion from './GraficaEcuacion';
import { generarPdfBloques } from '../utils/pdfBloques';
import { capturarSimulacion } from '../utils/capturaSimulador';
import { FICHAS_SIM } from '../Simuladores física/fichasSimuladores';
import { usuarioRegistrado, cargarMisProblemas, guardarProblemas, borrarProblemaGuardado, aProblemaFicha } from './misProblemas';
import { BotonCompartirHoja } from './CompartirHoja';

// Módulo de cada simulador (ya está cargado si el simulador está abierto)
export const MODULOS = {
    CAIDA_LIBRE: () => import('../Simuladores física/SimuladorCaidaLibre'),
    PLANO_INCLINADO: () => import('../Simuladores física/SimuladorPlanoInclinado'),
    TIRO_PARABOLICO: () => import('../Simuladores física/SimuladorTiroParabolico'),
    PENDULO: () => import('../Simuladores física/SimuladorPendulo'),
    LEY_OHM: () => import('../Simuladores física/SimuladorLeyDeOhm'),
    GAY_LUSAC: () => import('../Simuladores física/GayLusac'),
    ATOMOS: () => import('../Simuladores física/SimuladorAtomos'),
    ECLIPSE: () => import('../Simuladores física/SimuladorEclipse'),
    SISTEMA_SOLAR: () => import('../Simuladores física/SimuladorSistemaSolar'),
    AJUSTES_REACCION: () => import('../Simuladores física/AjustesReacciones'),
};
// Los tests tienen formatos distintos según el simulador → { texto, opciones, correcta, explicacion }
export const normalizar = (q) => ({
    texto: q.text || q.q || '',
    opciones: q.options || q.opts || [],
    correcta: q.correct ?? q.ans ?? q.ok ?? 0,
    explicacion: q.exp || '',
});
const barajar = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const LETRAS = 'abcdefgh';

// Enunciado de un problema: el editado, el propio o el generado
const enunciadoProblema = (eq) => eq.enunciadoEd ?? eq.ast?.[0]?.v ?? '';

// Copia con un valor cambiado en una ruta: ponerEn(obj, ['test', 2, 'texto'], 'Hola')
function ponerEn(obj, ruta, valor) {
    if (!ruta.length) return valor;
    const [k, ...resto] = ruta;
    const copia = Array.isArray(obj) ? [...obj] : { ...obj };
    copia[k] = ponerEn(obj?.[k], resto, valor);
    return copia;
}

export function useModuloSimulador(simKey) {
    const [mod, setMod] = useState(null);
    useEffect(() => {
        let vivo = true;
        const cargar = MODULOS[simKey];
        if (!cargar) { setMod({}); return undefined; }
        cargar().then((m) => { if (vivo) setMod(m); }).catch(() => { if (vivo) setMod({}); });
        return () => { vivo = false; };
    }, [simKey]);
    return mod;
}

// Texto editable en la previsualización (en el PDF es texto normal)
function Editable({ v, ruta, ed, bloque = false, estilo }) {
    if (!ed) return <>{v}</>;
    const Tag = bloque ? 'div' : 'span';
    return (
        // key = valor: si el texto cambia desde fuera (🎲, ✕), el elemento se crea de nuevo y React no choca con lo escrito
        <Tag key={String(v ?? '')} contentEditable suppressContentEditableWarning
            onBlur={(e) => { const t = e.currentTarget.innerText.replace(/\n+$/, ''); if (t !== String(v ?? '')) ed.poner(ruta, t); }}
            style={{ outline: 'none', borderBottom: '1px dashed #60a5fa', background: '#eff6ff', borderRadius: 3, padding: '0 2px', cursor: 'text', minWidth: 20, display: bloque ? 'block' : 'inline', ...estilo }}
            title="Haz clic para editar">{v}</Tag>
    );
}
// Botoncitos de cada elemento (solo en la previsualización)
function Mandos({ ed, children }) {
    if (!ed) return null;
    return <span style={{ float: 'right', display: 'inline-flex', gap: 4, marginLeft: 6 }}>{children}</span>;
}
const btnMini = { border: '1px solid #cbd5e1', background: 'white', borderRadius: 6, padding: '1px 6px', cursor: 'pointer', fontSize: 12, lineHeight: 1.4 };

// ─── Hoja imprimible (760 px, fondo blanco) ──────────────────────────────────
// ed (opcional): { poner(ruta, valor), quitar(lista, i), regenerar(lista, i), anadirParrafo() } → modo edición
export const HojaFicha = React.forwardRef(function HojaFicha({ titulo, url, ficha, captura, teoria, actividades, test, ejercicios, tituloEjercicios, problemas, soluciones, grafica, ed, cabecera, area }, ref) {
    const bloque = { padding: '6px 4px' };
    const caja = { border: '1.5px solid #cbd5e1', borderRadius: 8, padding: '10px 12px' };
    const color = (ficha?.area || area) === 'Química' ? '#7c3aed' : '#0f766e';
    let nSec = 0; // secciones
    let n = 0;    // ejercicios (numeración continua)
    const seccion = (txt, sub) => (
        <div data-bloque style={{ ...bloque, fontWeight: 900, fontSize: 17, color, marginTop: 8, borderBottom: `2px solid ${color}33` }}>
            {++nSec}. {txt} {sub && <span style={{ fontWeight: 500, fontSize: 13, color: '#64748b' }}>{sub}</span>}
        </div>
    );
    const quitar = (lista, i) => ed && <button style={btnMini} title="Quitar" onClick={() => ed.quitar(lista, i)}>✕</button>;
    return (
        <div ref={ref} style={{ width: 760, background: 'white', color: '#1e293b', fontFamily: 'system-ui, Segoe UI, sans-serif', fontSize: 15, lineHeight: 1.45 }}>
            <div data-bloque style={{ ...bloque, paddingBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `3px solid ${color}`, paddingBottom: 6 }}>
                    <div>
                        <div style={{ fontSize: 12, color, fontWeight: 800, letterSpacing: 1 }}>{(ficha?.area || area || 'Física').toUpperCase()} · {cabecera || 'FICHA DEL SIMULADOR'}</div>
                        <div style={{ fontSize: 24, fontWeight: 900 }}><Editable v={titulo} ruta={['titulo']} ed={ed} /></div>
                    </div>
                    {url && <div style={{ fontSize: 11, color: '#64748b', textAlign: 'right' }}>Simulador:<br />{url}</div>}
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 13 }}>
                    <span style={{ flex: 3 }}>Nombre: ______________________________________</span>
                    <span style={{ flex: 1 }}>Curso: ________</span>
                    <span style={{ flex: 1 }}>Fecha: ________</span>
                </div>
            </div>

            {(teoria || captura) && ficha && (
                <>
                    {seccion('Lo que vamos a estudiar')}
                    <div data-bloque style={bloque}>
                        <div style={{ ...caja, background: `${color}0d`, borderColor: `${color}55` }}>
                            <div style={{ fontWeight: 800, marginBottom: 4 }}>🎯 <Editable v={ficha.objetivo} ruta={['objetivo']} ed={ed} /></div>
                            {teoria && ficha.teoria.map((p, i) => (
                                <div key={i} style={{ margin: '6px 0 0', fontSize: 14 }}>
                                    <Mandos ed={ed}>{quitar('teoria', i)}</Mandos>
                                    <Editable v={p} ruta={['teoria', i]} ed={ed} />
                                </div>
                            ))}
                            {teoria && ed && <button style={{ ...btnMini, marginTop: 6 }} onClick={() => ed.anadirParrafo()}>➕ Añadir párrafo</button>}
                        </div>
                    </div>
                    {teoria && ficha.formulas?.length > 0 && (
                        <div data-bloque style={bloque}>
                            <div style={{ fontWeight: 800, fontSize: 13, color: '#475569', marginBottom: 4 }}>FÓRMULAS CLAVE</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {ficha.formulas.map((f, i) => (
                                    <span key={i} style={{ border: `1.5px solid ${color}`, borderRadius: 8, padding: '4px 10px', fontWeight: 700, fontSize: 14, fontFamily: 'Cambria Math, Georgia, serif' }}>
                                        <Editable v={f} ruta={['formulas', i]} ed={ed} />{ed && <> {quitar('formulas', i)}</>}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                    {captura && (
                        <div data-bloque style={{ ...bloque, textAlign: 'center' }}>
                            <img src={captura} alt="" style={{ maxWidth: '100%', maxHeight: 330, border: '1.5px solid #cbd5e1', borderRadius: 8 }} />
                            <div style={{ fontSize: 11, color: '#64748b' }}>Captura del simulador «{titulo}» ({url})</div>
                        </div>
                    )}
                </>
            )}

            {actividades && ficha?.actividades?.length > 0 && (
                <>
                    {seccion('Experimenta con el simulador', '(abre el simulador y responde)')}
                    {ficha.actividades.map((a, i) => (
                        <div key={'a' + i} data-bloque style={bloque}>
                            <div style={caja}>
                                <Mandos ed={ed}>{quitar('actividades', i)}</Mandos>
                                <b>{++n}.</b> <Editable v={a.t} ruta={['actividades', i, 't']} ed={ed} />
                                <div style={{ borderBottom: '1px dotted #94a3b8', height: 26 }} />
                                <div style={{ borderBottom: '1px dotted #94a3b8', height: 26 }} />
                            </div>
                        </div>
                    ))}
                </>
            )}

            {test.length > 0 && seccion('Test', '(rodea la respuesta correcta)')}
            {test.map((q, i) => (
                <div key={'t' + i} data-bloque style={bloque}>
                    <div style={caja}>
                        <Mandos ed={ed}>{quitar('test', i)}</Mandos>
                        <div style={{ fontWeight: 700 }}>{++n}. <Editable v={q.texto} ruta={['test', i, 'texto']} ed={ed} /></div>
                        <div style={{ display: 'grid', gridTemplateColumns: q.opciones.some((o) => String(o).length > 32) ? '1fr' : '1fr 1fr', gap: '2px 18px', marginTop: 4 }}>
                            {q.opciones.map((o, j) => <div key={j}>{LETRAS[j]}) <Editable v={o} ruta={['test', i, 'opciones', j]} ed={ed} /></div>)}
                        </div>
                    </div>
                </div>
            ))}

            {ejercicios.length > 0 && seccion(tituloEjercicios || 'Ejercicios')}
            {ejercicios.map((e, i) => (
                <div key={'e' + i} data-bloque style={bloque}>
                    <div style={caja}>
                        <Mandos ed={ed}>
                            {ed?.puedeRegenerarEj && <button style={btnMini} title="Otro distinto" onClick={() => ed.regenerar('ejercicios', i)}>🎲</button>}
                            {quitar('ejercicios', i)}
                        </Mandos>
                        <b>{++n}.</b> <Editable v={e.enunciado} ruta={['ejercicios', i, 'enunciado']} ed={ed} />
                        {e.alto > 30 && <div style={{ height: e.alto }} />}
                    </div>
                </div>
            ))}

            {problemas.length > 0 && seccion('Problemas', '(plantea la ecuación y resuélvela)')}
            {problemas.map((eq, i) => (
                <div key={'p' + i} data-bloque style={bloque}>
                    <div style={{ ...caja, ...(ed && eq.propio ? { borderColor: '#f59e0b' } : {}) }}>
                        <Mandos ed={ed}>
                            {ed?.guardar && <button style={btnMini} title="Guardar en «Mis problemas»" onClick={() => ed.guardar(i)}>💾</button>}
                            {!eq.propio && <button style={btnMini} title="Otro problema con números nuevos" onClick={() => ed.regenerar('problemas', i)}>🎲</button>}
                            {quitar('problemas', i)}
                        </Mandos>
                        <div><b>{++n}.</b> <Editable v={enunciadoProblema(eq)} ruta={['problemas', i, 'enunciadoEd']} ed={ed} /></div>
                        {eq.tipoEcu && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Ecuación {eq.tipoEcu}</div>}
                        {ed && eq.propio && <div style={{ fontSize: 11, color: '#b45309', marginTop: 2 }}>Problema propio · su solución se edita en la hoja de soluciones</div>}
                        <div style={{ height: 150 }} />
                        <div style={{ textAlign: 'right', fontSize: 13 }}>Solución: ____________________</div>
                    </div>
                </div>
            ))}

            {soluciones && (() => {
                let k = 0;
                return (
                    <>
                        <div data-bloque data-pagina="1" style={{ ...bloque, borderBottom: '3px solid #c0392b', fontSize: 22, fontWeight: 900, color: '#c0392b' }}>
                            Soluciones · {titulo}
                        </div>
                        {actividades && ficha?.actividades?.length > 0 && (
                            <div data-bloque style={bloque}>
                                <div style={{ fontWeight: 900, color, marginBottom: 4 }}>Experimenta con el simulador</div>
                                {ficha.actividades.map((a, i) => <div key={i} style={{ fontSize: 13, marginBottom: 3 }}><b>{++k}.</b> <Editable v={a.s} ruta={['actividades', i, 's']} ed={ed} /></div>)}
                            </div>
                        )}
                        {test.length > 0 && (
                            <div data-bloque style={bloque}>
                                <div style={{ fontWeight: 900, color, marginBottom: 4 }}>Test</div>
                                {test.map((q, i) => (
                                    <div key={i} style={{ fontSize: 13, marginBottom: 3 }}>
                                        <b>{++k}. {LETRAS[q.correcta]})</b> {q.opciones[q.correcta]}{q.explicacion ? <span style={{ color: '#64748b' }}> — <Editable v={q.explicacion} ruta={['test', i, 'explicacion']} ed={ed} /></span> : null}
                                    </div>
                                ))}
                            </div>
                        )}
                        {ejercicios.length > 0 && (
                            <div data-bloque style={bloque}>
                                <div style={{ fontWeight: 900, color, marginBottom: 4 }}>{tituloEjercicios || 'Ejercicios'}</div>
                                {ejercicios.map((e, i) => <div key={i} style={{ fontSize: 13, marginBottom: 3 }}><b>{++k}.</b> <Editable v={e.solucion} ruta={['ejercicios', i, 'solucion']} ed={ed} /></div>)}
                            </div>
                        )}
                        {problemas.map((eq, i) => (
                            <div key={'s' + i} data-bloque style={bloque}>
                                <div style={{ ...caja, borderColor: '#f5b7b1' }}>
                                    {eq.propio ? (
                                        <div style={{ fontSize: 13.5 }}>
                                            <span style={{ fontWeight: 900, color: '#c0392b' }}>{++k}. </span>
                                            <Editable v={eq.solucionPropia} ruta={['problemas', i, 'solucionPropia']} ed={ed} bloque estilo={{ display: 'inline' }} />
                                            {eq.pasos?.length > 0 && (
                                                <ol style={{ margin: '4px 0 0', paddingLeft: 22, fontSize: 13.5, lineHeight: 1.8 }}>
                                                    {eq.pasos.map((p, j) => <li key={j}><MathText v={p} /></li>)}
                                                </ol>
                                            )}
                                        </div>
                                    ) : (
                                        <>
                                            <div style={{ fontWeight: 900, color: '#c0392b' }}>{++k}. {textoSoluciones(eq)}</div>
                                            <ol style={{ margin: '4px 0 0', paddingLeft: 22, fontSize: 13.5, lineHeight: 1.8 }}>
                                                {(eq.pasos || []).map((p, j) => <li key={j}><MathText v={p} /></li>)}
                                            </ol>
                                            {ed && eq.enunciadoEd != null && <div style={{ fontSize: 11, color: '#b45309' }}>Has cambiado el enunciado: si cambias los datos, revisa que la solución siga siendo válida.</div>}
                                            {grafica && !eq.sinGrafica && <div style={{ width: 340, marginTop: 4 }}><GraficaEcuacion datos={datosGrafica(eq)} /></div>}
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </>
                );
            })()}
        </div>
    );
});

// ─── «Mis problemas»: elegir problemas guardados para añadirlos a la ficha ──
function PanelMisProblemas({ lista, simKey, onCerrar, onAnadir, onBorrar }) {
    const [soloEste, setSoloEste] = useState(true);
    const [buscar, setBuscar] = useState('');
    const [sel, setSel] = useState(new Set());
    const n = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const visibles = (lista || []).filter((g) => (!soloEste || g.simKey === simKey) && (!buscar || n(`${g.enunciado} ${g.tema} ${g.simNombre}`).includes(n(buscar))));
    const alternar = (id) => setSel((s) => { const x = new Set(s); x.has(id) ? x.delete(id) : x.add(id); return x; });
    return (
        <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, zIndex: 10030, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 680, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', color: '#1e293b' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>📚 Mis problemas guardados</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="🔍 Buscar por palabras o tema" style={{ flex: 1, minWidth: 180, padding: '7px 10px', borderRadius: 9, border: '1.5px solid #cbd5e1' }} />
                        <label style={{ fontSize: '0.85rem' }}><input type="checkbox" checked={soloEste} onChange={(e) => setSoloEste(e.target.checked)} /> Solo de este simulador</label>
                    </div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
                    {!lista ? <div style={{ padding: 20, color: '#64748b' }}>Cargando…</div>
                        : !visibles.length ? <div style={{ padding: 20, color: '#64748b' }}>{lista.length ? 'No hay problemas con esos filtros.' : 'Todavía no has guardado ningún problema. Usa 💾 en un problema o la casilla «Guardar los problemas» al generar.'}</div>
                            : visibles.map((g) => (
                                <label key={g.id} style={{ display: 'flex', gap: 10, padding: '8px 10px', marginBottom: 5, border: '1px solid #e2e8f0', borderRadius: 10, background: sel.has(g.id) ? '#e0e7ff' : 'white', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={sel.has(g.id)} onChange={() => alternar(g.id)} style={{ marginTop: 3 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '0.9rem' }}>{g.enunciado}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{[g.simNombre, g.tema, g.propio ? 'propio' : ''].filter(Boolean).join(' · ')}{g.solucion ? ` · Solución: ${String(g.solucion).slice(0, 60)}` : ''}</div>
                                    </div>
                                    <button onClick={(e) => { e.preventDefault(); onBorrar(g); }} title="Borrar" style={{ ...btnMini, alignSelf: 'flex-start' }}>🗑</button>
                                </label>
                            ))}
                </div>
                <div style={{ padding: '12px 16px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={onCerrar} style={{ padding: '9px 14px', borderRadius: 10, border: 'none', background: '#f1f5f9', fontWeight: 700, cursor: 'pointer' }}>Cerrar</button>
                    <button disabled={!sel.size} onClick={() => onAnadir((lista || []).filter((g) => sel.has(g.id)))}
                        style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: sel.size ? '#4f46e5' : '#94a3b8', color: 'white', fontWeight: 800, cursor: sel.size ? 'pointer' : 'default' }}>
                        ➕ Añadir {sel.size || ''} a la ficha
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Modal de opciones ───────────────────────────────────────────────────────
export default function FichaSimulador({ simKey, simNombre, simUrl, onClose, obtenerRaiz }) {
    const ficha = FICHAS_SIM[simKey];
    const modulo = useModuloSimulador(simKey);
    const test = useMemo(() => (modulo?.PREGUNTAS_SIM || []).map(normalizar).filter((q) => q.texto && q.opciones.length), [modulo]);
    const plantillas = useMemo(() => plantillasPara({ sim: simKey }), [simKey]);
    const tiposDisp = useMemo(() => [...new Set(plantillas.map((p) => p.ecu))], [plantillas]);
    const ej = ficha?.ejercicios;
    const [teoria, setTeoria] = useState(true);
    const [conCaptura, setConCaptura] = useState(true);
    const [actividades, setActividades] = useState(true);
    const [nTest, setNTest] = useState(null);
    const [nEj, setNEj] = useState(ej?.defecto || 0);
    const [nProb, setNProb] = useState(ej ? 3 : 5);
    const [tipos, setTipos] = useState(null); // null = todos
    const [soluciones, setSoluciones] = useState(true);
    const [grafica, setGrafica] = useState(true);
    const [mezclar, setMezclar] = useState(true);
    const [datos, setDatos] = useState(null);
    const [borrador, setBorrador] = useState(null); // previsualización editable
    const registrado = usuarioRegistrado();
    const [guardarAlGenerar, setGuardarAlGenerar] = useState(false); // «Mis problemas»
    const [misProblemas, setMisProblemas] = useState(null);
    const [verMios, setVerMios] = useState(false);
    const metaSim = { simKey, simNombre, area: ficha?.area || 'Física' };
    const recargarMios = async () => { try { const l = await cargarMisProblemas(); setMisProblemas(l); return l; } catch (e) { console.error(e); setMisProblemas([]); return []; } };
    const guardarEnMios = async (lista) => {
        if (!registrado) { setEstado('Inicia sesión para guardar tus problemas.'); return; }
        try {
            const ya = misProblemas || await recargarMios();
            const k = await guardarProblemas(lista, metaSim, ya);
            setEstado(k ? `💾 ${k} problema${k > 1 ? 's' : ''} guardado${k > 1 ? 's' : ''} en «Mis problemas»` : 'Esos problemas ya estaban guardados');
            if (k) recargarMios();
        } catch (e) { console.error(e); setEstado('No se pudieron guardar los problemas'); }
    };
    const [estado, setEstado] = useState('');
    const hoja = useRef(null);
    const ventana = useRef(null);
    const maxTest = test.length;
    const nT = Math.min(nTest ?? 8, maxTest);
    const total = nT + nProb + (ej ? nEj : 0) + (actividades ? ficha?.actividades?.length || 0 : 0);

    // Problemas nuevos sin repetir plantilla mientras se pueda
    const nuevosProblemas = (cuantos, evitar = []) => {
        const pls = plantillas.filter((p) => !tipos || tipos.includes(p.ecu));
        const base = pls.length ? pls : plantillas;
        if (!base.length) return [];
        const out = [];
        let bolsa = barajar(base.filter((p) => !evitar.includes(p.id)));
        for (let i = 0; i < cuantos; i++) {
            if (!bolsa.length) bolsa = barajar(base);
            out.push(generarDesdePlantilla(bolsa.pop()));
        }
        return out;
    };

    // Contenido de la ficha (lo mismo para generar directamente o para previsualizar)
    const prepararContenido = async () => {
        const captura = conCaptura ? await capturarSimulacion(obtenerRaiz?.()) : null;
        return {
            titulo: simNombre,
            objetivo: ficha?.objetivo || '',
            teoria: [...(ficha?.teoria || [])],
            formulas: [...(ficha?.formulas || [])],
            actividades: (ficha?.actividades || []).map((a) => ({ ...a })),
            test: (mezclar ? barajar(test) : test).slice(0, nT),
            problemas: nuevosProblemas(nProb),
            ejercicios: ej ? ej.gen(nEj, modulo) : [],
            captura,
        };
    };

    const generar = async (descargar) => {
        // abrir la pestaña ANTES de esperar (si no, el navegador la bloquea)
        ventana.current = descargar ? null : window.open('', '_blank');
        setEstado(conCaptura ? '📸 Capturando la simulación…' : 'Generando el PDF…');
        const c = await prepararContenido();
        setEstado(conCaptura && !c.captura ? 'No se pudo capturar la animación (se genera sin ella)…' : 'Generando el PDF…');
        setDatos({ ...c, descargar, guardar: guardarAlGenerar && !!registrado });
    };

    const previsualizar = async () => {
        setEstado(conCaptura ? '📸 Capturando la simulación…' : 'Preparando la vista previa…');
        const c = await prepararContenido();
        setEstado(conCaptura && !c.captura ? 'No se pudo capturar la animación (la ficha irá sin ella)' : '');
        setBorrador(c);
    };

    // PDF desde la vista previa (con lo editado)
    const generarDesdeBorrador = (descargar) => {
        ventana.current = descargar ? null : window.open('', '_blank');
        setEstado('Generando el PDF…');
        setDatos({ ...borrador, descargar, guardar: guardarAlGenerar && !!registrado });
    };

    useEffect(() => {
        if (!datos) return undefined;
        let vivo = true;
        const t = setTimeout(async () => {
            try {
                const { pdf, archivo } = await generarPdfBloques(hoja.current, `Ficha ${datos.titulo || simNombre}`);
                if (!vivo) return;
                if (datos.descargar || !ventana.current) pdf.save(archivo);
                else ventana.current.location.href = URL.createObjectURL(pdf.output('blob'));
                setEstado('✅ Listo');
                if (datos.guardar && datos.problemas?.length) await guardarEnMios(datos.problemas);
            } catch (e) {
                console.error(e);
                ventana.current?.close();
                setEstado('No se pudo generar el PDF');
            }
            if (vivo) setDatos(null);
        }, 200);
        return () => { vivo = false; clearTimeout(t); };
    }, [datos, simNombre]);

    // ── Edición del borrador ──
    const ed = borrador && {
        puedeRegenerarEj: !!ej,
        poner: (ruta, v) => setBorrador((b) => ponerEn(b, ruta, v)),
        quitar: (lista, i) => setBorrador((b) => ({ ...b, [lista]: b[lista].filter((_, k) => k !== i) })),
        regenerar: (lista, i) => setBorrador((b) => {
            const nuevo = lista === 'problemas' ? nuevosProblemas(1, [b.problemas[i]?.plantilla])[0] : ej?.gen(1, modulo)?.[0];
            return nuevo ? ponerEn(b, [lista, i], nuevo) : b;
        }),
        anadirParrafo: () => setBorrador((b) => ({ ...b, teoria: [...b.teoria, 'Escribe aquí el nuevo párrafo…'] })),
        guardar: registrado ? (i) => guardarEnMios([borrador.problemas[i]]) : null,
    };
    const cambiarCantidad = (lista, delta) => setBorrador((b) => {
        const actual = b[lista];
        if (delta < 0) {
            // se quita el último generado (los problemas propios se quedan)
            const idx = lista === 'problemas' ? actual.map((p, k) => (p.propio ? -1 : k)).filter((k) => k >= 0).pop() : actual.length - 1;
            return idx == null || idx < 0 ? b : { ...b, [lista]: actual.filter((_, k) => k !== idx) };
        }
        if (lista === 'problemas') return { ...b, problemas: [...actual, ...nuevosProblemas(1, actual.map((p) => p.plantilla))] };
        if (lista === 'ejercicios') return { ...b, ejercicios: [...actual, ...(ej?.gen(1, modulo) || [])] };
        if (lista === 'test') {
            const usados = new Set(actual.map((q) => q.texto));
            const libre = barajar(test).find((q) => !usados.has(q.texto));
            return libre ? { ...b, test: [...actual, libre] } : b;
        }
        return b;
    });
    const anadirPropio = () => setBorrador((b) => ({
        ...b,
        problemas: [...b.problemas, { propio: true, enunciadoEd: 'Escribe aquí el enunciado de tu problema…', solucionPropia: 'Escribe aquí la solución (aparece en la hoja de soluciones).' }],
    }));

    const chip = (on, color = '#0f766e') => ({ padding: '6px 12px', borderRadius: 20, border: `2px solid ${color}`, background: on ? color : 'white', color: on ? 'white' : color, fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' });
    const numero = (v, set, max) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => set(Math.max(0, v - 1))} style={chip(false)}>−</button>
            <input type="number" min={0} max={max} value={v} onChange={(e) => set(Math.max(0, Math.min(max, parseInt(e.target.value, 10) || 0)))}
                style={{ width: 60, textAlign: 'center', fontSize: '1.1rem', fontWeight: 'bold', borderRadius: 8, border: '2px solid #cbd5e1', padding: 4 }} />
            <button onClick={() => set(Math.min(max, v + 1))} style={chip(false)}>+</button>
            <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>máx. {max}</span>
        </div>
    );
    const sec = { marginBottom: 14 };
    const tit = { fontWeight: 800, color: '#334155', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: 6 };
    const ocupado = !!datos || estado.startsWith('📸');

    // Hoja fuera de pantalla para el PDF (sin los controles de edición)
    const fichaDe = (c) => ficha && ({ ...ficha, objetivo: c.objetivo, teoria: c.teoria, formulas: c.formulas, actividades: c.actividades });
    const hojaPdf = datos && (
        <div style={{ position: 'fixed', left: -10000, top: 0 }} aria-hidden="true">
            <HojaFicha ref={hoja} titulo={datos.titulo || simNombre} url={simUrl} ficha={fichaDe(datos)} captura={datos.captura}
                teoria={teoria} actividades={actividades} test={datos.test} ejercicios={datos.ejercicios} tituloEjercicios={ej?.titulo}
                problemas={datos.problemas} soluciones={soluciones} grafica={grafica} />
        </div>
    );

    // ── Vista previa editable ──
    if (borrador) {
        const contador = (etq, lista, mostrar = true) => mostrar && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 20, padding: '3px 6px 3px 12px', fontSize: '0.85rem' }}>
                {etq}: <b>{borrador[lista].length}</b>
                <button onClick={() => cambiarCantidad(lista, -1)} style={{ ...btnMini, padding: '0 8px' }}>−</button>
                <button onClick={() => cambiarCantidad(lista, 1)} style={{ ...btnMini, padding: '0 8px' }}>+</button>
            </span>
        );
        return (
            <div style={{ position: 'fixed', inset: 0, zIndex: 10010, background: '#e2e8f0', display: 'flex', flexDirection: 'column' }}>
                <div style={{ background: '#0f172a', color: 'white', padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    <button onClick={() => { setBorrador(null); setEstado(''); }} style={{ ...btnMini, fontSize: 13, padding: '5px 10px' }}>← Opciones</button>
                    <b style={{ marginRight: 6 }}>✏️ Vista previa de la ficha</b>
                    {contador('Test', 'test', maxTest > 0)}
                    {contador(ej?.titulo ? 'Ejercicios' : '', 'ejercicios', !!ej)}
                    {contador('Problemas', 'problemas', plantillas.length > 0 || borrador.problemas.length > 0)}
                    <button onClick={anadirPropio} style={{ ...btnMini, fontSize: 13, padding: '5px 10px', background: '#fef3c7', borderColor: '#f59e0b' }}>➕ Añadir problema propio</button>
                    {registrado && <button onClick={() => { setVerMios(true); if (!misProblemas) recargarMios(); }} style={{ ...btnMini, fontSize: 13, padding: '5px 10px', background: '#e0e7ff', borderColor: '#6366f1' }}>📚 Mis problemas</button>}
                    {registrado && borrador.problemas.length > 0 && <button onClick={() => guardarEnMios(borrador.problemas)} style={{ ...btnMini, fontSize: 13, padding: '5px 10px' }}>💾 Guardar todos</button>}
                    <span style={{ flex: 1 }} />
                    <BotonCompartirHoja origen={simNombre} contenido={() => ({ titulo: borrador.titulo, area: ficha?.area || 'Física', test: borrador.test, ejercicios: borrador.ejercicios, problemas: borrador.problemas })} />
                    <button disabled={!!datos} onClick={() => generarDesdeBorrador(false)} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: '#0f766e', color: 'white', fontWeight: 800, cursor: 'pointer', opacity: datos ? 0.6 : 1 }}>👁️ Generar PDF</button>
                    <button disabled={!!datos} onClick={() => generarDesdeBorrador(true)} style={{ padding: '8px 14px', borderRadius: 10, border: '2px solid #5eead4', background: 'transparent', color: '#5eead4', fontWeight: 800, cursor: 'pointer', opacity: datos ? 0.6 : 1 }}>⬇️ Descargar</button>
                    <button onClick={onClose} style={{ ...btnMini, fontSize: 13, padding: '5px 10px' }}>Cerrar</button>
                </div>
                <div style={{ background: '#dbeafe', color: '#1e3a8a', fontSize: '0.82rem', padding: '6px 14px' }}>
                    Así saldrá el PDF. Haz clic en cualquier texto con fondo azul para cambiarlo. Con ✕ quitas un elemento y con 🎲 generas otro problema con números nuevos.
                    {estado && <b style={{ marginLeft: 8, color: estado.startsWith('No') ? '#c0392b' : '#0f766e' }}>{estado}</b>}
                </div>
                <div style={{ flex: 1, overflow: 'auto', padding: '18px 10px 40px' }}>
                    <div style={{ width: 760, margin: '0 auto', background: 'white', boxShadow: '0 6px 30px rgba(0,0,0,0.15)', padding: '18px 14px' }}>
                        <HojaFicha titulo={borrador.titulo} url={simUrl} ficha={fichaDe(borrador)} captura={borrador.captura}
                            teoria={teoria} actividades={actividades} test={borrador.test} ejercicios={borrador.ejercicios} tituloEjercicios={ej?.titulo}
                            problemas={borrador.problemas} soluciones={soluciones} grafica={grafica} ed={ed} />
                    </div>
                </div>
                {hojaPdf}
                {verMios && (
                    <PanelMisProblemas lista={misProblemas} simKey={simKey}
                        onCerrar={() => setVerMios(false)}
                        onAnadir={(gs) => { setBorrador((b) => ({ ...b, problemas: [...b.problemas, ...gs.map(aProblemaFicha)] })); setVerMios(false); }}
                        onBorrar={async (g) => { if (!window.confirm('¿Borrar este problema de «Mis problemas»?')) return; try { await borrarProblemaGuardado(g.id); setMisProblemas((l) => (l || []).filter((x) => x.id !== g.id)); } catch (e) { console.error(e); alert('No se pudo borrar.'); } }} />
                )}
            </div>
        );
    }

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10010, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 18, padding: '22px 22px 18px', width: '100%', maxWidth: 540, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.35)', color: '#1e293b' }}>
                <h2 style={{ margin: '0 0 4px', fontSize: '1.3rem' }}>🖨️ Ficha de {ficha?.area || 'Física'} · {simNombre}</h2>
                <p style={{ margin: '0 0 14px', color: '#64748b', fontSize: '0.85rem' }}>
                    {ficha?.objetivo} Elige qué incluir y cuántos ejercicios. Cada vez se generan problemas con números nuevos.
                </p>
                <div style={{ ...sec, display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.92rem' }}>
                    <div style={tit}>Para entender el simulador</div>
                    <label><input type="checkbox" checked={teoria} onChange={(e) => setTeoria(e.target.checked)} /> Explicación del fenómeno y fórmulas clave</label>
                    <label><input type="checkbox" checked={conCaptura} onChange={(e) => setConCaptura(e.target.checked)} /> 📸 Captura de la animación <span style={{ color: '#94a3b8' }}>(déjala antes como quieras que salga)</span></label>
                    {ficha?.actividades?.length > 0 && <label><input type="checkbox" checked={actividades} onChange={(e) => setActividades(e.target.checked)} /> {ficha.actividades.length} actividades guiadas con el simulador</label>}
                </div>
                <div style={sec}>
                    <div style={tit}>Preguntas tipo test del simulador</div>
                    {modulo === null ? <span style={{ color: '#94a3b8' }}>Cargando…</span> : maxTest ? numero(nT, setNTest, maxTest) : <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Este simulador no tiene test propio.</span>}
                </div>
                {ej && (
                    <div style={sec}>
                        <div style={tit}>{ej.titulo}</div>
                        {numero(nEj, setNEj, 30)}
                    </div>
                )}
                <div style={sec}>
                    <div style={tit}>Problemas con ecuaciones de {ficha?.area === 'Química' ? 'química' : 'física'}</div>
                    {numero(nProb, setNProb, 40)}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                        <button onClick={() => setTipos(null)} style={chip(!tipos, '#8e44ad')}>Todos</button>
                        {tiposDisp.map((k) => (
                            <button key={k} onClick={() => setTipos((t) => { const b = t || []; const n2 = b.includes(k) ? b.filter((x) => x !== k) : [...b, k]; return n2.length ? n2 : null; })}
                                style={chip(!!tipos?.includes(k), '#8e44ad')}>{TIPOS_ECU[k]}</button>
                        ))}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 6 }}>
                        Temas: {[...new Set(plantillas.filter((p) => !tipos || tipos.includes(p.ecu)).map((p) => p.tema))].join(' · ')}
                    </div>
                </div>
                <div style={{ ...sec, display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.92rem' }}>
                    <label><input type="checkbox" checked={mezclar} onChange={(e) => setMezclar(e.target.checked)} /> Preguntas del test en orden aleatorio</label>
                    <label><input type="checkbox" checked={soluciones} onChange={(e) => setSoluciones(e.target.checked)} /> Hoja de soluciones (actividades, test, ejercicios y problemas paso a paso)</label>
                    {soluciones && <label style={{ marginLeft: 22 }}><input type="checkbox" checked={grafica} onChange={(e) => setGrafica(e.target.checked)} /> Con la solución gráfica de cada problema</label>}
                    {registrado
                        ? <label><input type="checkbox" checked={guardarAlGenerar} onChange={(e) => setGuardarAlGenerar(e.target.checked)} /> 💾 Guardar los problemas en «Mis problemas» al generar <span style={{ color: '#94a3b8' }}>(para reutilizarlos en otras fichas)</span></label>
                        : <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>💾 Inicia sesión para poder guardar los problemas en tu colección.</span>}
                </div>
                {estado && <div style={{ textAlign: 'center', fontWeight: 'bold', color: estado.startsWith('No') ? '#c0392b' : '#0f766e', marginBottom: 8 }}>{estado}</div>}
                <button disabled={ocupado || modulo === null} onClick={previsualizar}
                    style={{ width: '100%', marginBottom: 8, padding: '12px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#2563eb,#7c3aed)', color: 'white', fontWeight: 800, cursor: 'pointer', opacity: ocupado || modulo === null ? 0.6 : 1 }}>
                    ✏️ Previsualizar y editar antes de generar
                </button>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button disabled={ocupado || total === 0} onClick={() => generar(false)} style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: '#0f766e', color: 'white', fontWeight: 800, cursor: 'pointer', opacity: ocupado || total === 0 ? 0.6 : 1 }}>👁️ Ver e imprimir</button>
                    <button disabled={ocupado || total === 0} onClick={() => generar(true)} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '2px solid #0f766e', background: 'white', color: '#0f766e', fontWeight: 800, cursor: 'pointer', opacity: ocupado || total === 0 ? 0.6 : 1 }}>⬇️ Descargar</button>
                    <button onClick={onClose} style={{ padding: '12px 16px', borderRadius: 12, border: 'none', background: '#f1f5f9', color: '#475569', fontWeight: 700, cursor: 'pointer' }}>Cerrar</button>
                </div>
            </div>
            {hojaPdf}
        </div>
    );
}
