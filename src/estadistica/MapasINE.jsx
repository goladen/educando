// MapasINE.jsx — Mapas temáticos de España (provincias o comunidades) con datos del INE.
//  · Ver: mapa coloreado por intervalos + leyenda + tabla; título editable; ficha PDF (resuelta,
//    para colorear o ambas); compartir por enlace (?inemapa=dens.p.5.q.azul).
//  · Jugar: el alumno pinta cada territorio con el color de la leyenda que le corresponde
//    (con o sin la tabla de datos) y comprueba cuántos acierta. Enlace directo: …?inemapa=…​.j
// Datos y clasificación: ./ineMapas.js · PDF: ./fichaMapaPdf.js
import React, { useState, useEffect, useMemo } from 'react';
import { FileDown, Gamepad2, Share2, Table2, Eraser, CheckCircle, RotateCcw, Eye, EyeOff, Map as IconoMapa, Timer } from 'lucide-react';
import { nombreNatural, escribirParamUrl } from './ineDatos';
import { INDICADORES, indicadorPorId, unidadCorta, cargarMapa, cargarIndicador, territorios, METODOS, cortes, claseDe, PALETAS, coloresClases, etiquetasClases, mapaAQuery, DEFAULT_MAPA } from './ineMapas';
import { D, nf } from './ineGraficos';
import ModalCompartir from './ineCompartir';

const CARD = { background: D.card, borderRadius: 14, padding: 16, border: `1px solid ${D.border}` };
const BTN = (bg, col = 'white') => ({ padding: '8px 14px', borderRadius: 9, border: 'none', background: bg, color: col, fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: 6 });
const ETQ = { fontSize: '0.72rem', color: D.muted, fontWeight: 700, marginBottom: 6, letterSpacing: 0.3 };
const SIN_COLOR = '#2d3540';
const PEQUEÑO = 60; // área (px² del viewBox) por debajo de la cual se dibuja un círculo clicable (Ceuta, Melilla)

// ─── Mapa SVG interactivo ────────────────────────────────────────────────────
function MapaSVG({ mapa, nivel, fills, marcas, hover, onHover, onClick }) {
    const geo = nivel === 'c' ? mapa.ccaa : mapa.prov;
    const c = mapa.canarias;
    const destacados = Object.keys(geo).filter(cod => cod === hover || marcas?.[cod]);
    return (
        <svg viewBox={`0 0 ${mapa.w} ${mapa.h}`} style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'manipulation' }}
            onMouseLeave={() => onHover?.(null)} role="img" aria-label="Mapa de España">
            <rect x={c.x} y={c.y} width={c.w} height={c.h} fill="none" stroke={D.border} strokeWidth={1.5} rx={4} />
            {Object.entries(geo).map(([cod, g]) => (
                <g key={cod} onMouseEnter={() => onHover?.(cod)} onClick={() => onClick?.(cod)} style={{ cursor: onClick ? 'pointer' : 'default' }}>
                    <path d={g.d} fill={fills[cod] || SIN_COLOR} stroke={D.bg} strokeWidth={1.1} strokeLinejoin="round" />
                    {g.a < PEQUEÑO && <circle cx={g.lx} cy={g.ly} r={12} fill={fills[cod] || SIN_COLOR} stroke={D.text} strokeWidth={1.5} />}
                </g>
            ))}
            {/* Contornos encima: territorio señalado y marcas de corrección */}
            {destacados.map(cod => {
                const g = geo[cod], m = marcas?.[cod];
                const color = m === 'mal' ? '#ff5a5f' : m === 'ok' ? D.green2 : '#ffffff';
                return (
                    <g key={`o${cod}`} pointerEvents="none">
                        <path d={g.d} fill="none" stroke={color} strokeWidth={m ? 3 : 2.5} strokeLinejoin="round" />
                        {g.a < PEQUEÑO && <circle cx={g.lx} cy={g.ly} r={12} fill="none" stroke={color} strokeWidth={3} />}
                        {m && <text x={g.a < PEQUEÑO ? g.lx + 18 : g.lx} y={g.ly + 7} fontSize={22} fontWeight={900} textAnchor="middle" fill={color} stroke={D.bg} strokeWidth={4} paintOrder="stroke">{m === 'ok' ? '✓' : '✗'}</text>}
                    </g>
                );
            })}
        </svg>
    );
}

function Leyenda({ items, sel, onSel, titulo }) {
    return (
        <div>
            {titulo && <div style={ETQ}>{titulo}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {items.map((l, i) => {
                    const activa = sel === i;
                    const Tag = onSel ? 'button' : 'div';
                    return (
                        <Tag key={i} onClick={onSel ? () => onSel(i) : undefined}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: onSel ? '7px 10px' : '3px 0', borderRadius: 9, border: onSel ? `2px solid ${activa ? D.text : D.border}` : 'none', background: onSel ? (activa ? D.dark2 : 'transparent') : 'transparent', color: D.text, cursor: onSel ? 'pointer' : 'default', textAlign: 'left', fontSize: '0.82rem', width: '100%' }}>
                            <span style={{ width: 26, height: 16, borderRadius: 4, background: l.color, border: `1px solid ${D.border}`, flexShrink: 0 }} />
                            <span style={{ flex: 1, fontVariantNumeric: 'tabular-nums' }}>{l.etiqueta}</span>
                            {l.n != null && <span style={{ color: D.muted, fontSize: '0.74rem' }}>{l.n}</span>}
                        </Tag>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Juego: pinta el mapa según la leyenda ───────────────────────────────────
function JuegoMapa({ mapa, nivel, terr, valores, b, leyenda, valorTxt, titulo, onSalir }) {
    const [pintado, setPintado] = useState({});      // cod → índice de clase
    const [sel, setSel] = useState(0);              // clase elegida o 'borrar'
    const [conDatos, setConDatos] = useState(true);
    const [marcas, setMarcas] = useState(null);     // cod → 'ok' | 'mal'
    const [verSol, setVerSol] = useState(false);
    const [hover, setHover] = useState(null);
    const [inicio, setInicio] = useState(() => Date.now());
    const [fin, setFin] = useState(null);
    const [, tic] = useState(0);
    useEffect(() => { if (fin) return; const t = setInterval(() => tic(x => x + 1), 1000); return () => clearInterval(t); }, [fin]);

    const conValor = terr.filter(t => valores[t.cod] != null);
    const solucion = useMemo(() => Object.fromEntries(terr.filter(t => valores[t.cod] != null).map(t => [t.cod, claseDe(valores[t.cod], b)])), [terr, valores, b]);
    const nPintados = conValor.filter(t => pintado[t.cod] != null).length;
    const aciertos = marcas ? Object.values(marcas).filter(m => m === 'ok').length : 0;
    const fallos = marcas ? Object.values(marcas).filter(m => m === 'mal').length : 0;
    const seg = Math.round(((fin || Date.now()) - inicio) / 1000);
    const reloj = `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;
    const nombreDe = cod => terr.find(t => t.cod === cod)?.nombre;

    const pintar = (cod) => {
        if (valores[cod] == null || verSol) return;
        setPintado(p => { const n = { ...p }; if (sel === 'borrar') delete n[cod]; else n[cod] = sel; return n; });
        if (marcas?.[cod]) setMarcas(m => { const n = { ...m }; delete n[cod]; return n; });
    };
    // Solo se marcan las pintadas (✓ / ✗); las que faltan se cuentan aparte para no llenar el mapa de cruces
    const comprobar = () => {
        const m = Object.fromEntries(conValor.filter(t => pintado[t.cod] != null).map(t => [t.cod, pintado[t.cod] === solucion[t.cod] ? 'ok' : 'mal']));
        setMarcas(m);
        if (conValor.every(t => m[t.cod] === 'ok')) setFin(Date.now());
    };
    const corregirFallos = () => {
        setPintado(p => Object.fromEntries(Object.entries(p).filter(([cod]) => marcas?.[cod] === 'ok')));
        setMarcas(m => Object.fromEntries(Object.entries(m || {}).filter(([, v]) => v === 'ok')));
    };
    const reiniciar = () => { setPintado({}); setMarcas(null); setVerSol(false); setFin(null); setInicio(Date.now()); };

    const fills = verSol
        ? Object.fromEntries(Object.entries(solucion).map(([cod, ci]) => [cod, leyenda[ci].color]))
        : Object.fromEntries(Object.entries(pintado).map(([cod, ci]) => [cod, leyenda[ci].color]));
    const terrNombre = nivel === 'c' ? 'comunidades' : 'provincias';
    const todoBien = marcas && aciertos === conValor.length;

    return (
        <div>
            <div style={{ ...CARD, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div>
                    <div style={{ fontSize: '0.72rem', color: D.gold, fontWeight: 800, letterSpacing: 0.5 }}>🎮 PINTA EL MAPA</div>
                    <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{titulo}</div>
                    <div style={{ fontSize: '0.8rem', color: D.muted }}>Elige un color de la leyenda y pulsa cada {nivel === 'c' ? 'comunidad' : 'provincia'} del mapa (o su fila en la tabla) para pintarla.</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.85rem', color: D.muted, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Timer size={14} />{reloj}</span>
                    <span style={{ fontSize: '0.85rem', color: D.text, fontWeight: 700 }}>{nPintados}/{conValor.length} pintadas</span>
                    <button onClick={onSalir} style={BTN(D.dark2, D.text)}><IconoMapa size={14} />Volver al mapa</button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div style={{ flex: '3 1 420px', minWidth: 0 }}>
                    <div style={{ ...CARD, padding: 10 }}>
                        <MapaSVG mapa={mapa} nivel={nivel} fills={fills} marcas={verSol ? null : marcas} hover={hover} onHover={setHover} onClick={pintar} />
                        <div style={{ minHeight: 22, textAlign: 'center', fontSize: '0.85rem', marginTop: 4 }}>
                            {hover ? <><b>{nombreDe(hover)}</b>{conDatos && valores[hover] != null && <> · {valorTxt(valores[hover])}</>}{marcas?.[hover] === 'mal' && !verSol && <span style={{ color: '#ff5a5f' }}> · ✗ color equivocado</span>}</>
                                : <span style={{ color: D.muted }}>Pasa el ratón o el dedo por el mapa para ver el nombre</span>}
                        </div>
                    </div>

                    {/* Resultado */}
                    {marcas && (
                        <div style={{ ...CARD, marginTop: 12, borderColor: todoBien ? D.green2 : D.gold, textAlign: 'center' }}>
                            <div style={{ fontSize: todoBien ? '1.4rem' : '1.15rem', fontWeight: 800, color: todoBien ? D.green2 : D.text }}>
                                {todoBien ? `🏆 ¡Mapa perfecto en ${reloj}!` : `${aciertos} de ${conValor.length} ${terrNombre} bien coloreadas (${Math.round(aciertos / conValor.length * 100)} %)`}
                            </div>
                            {!todoBien && (
                                <div style={{ fontSize: '0.8rem', color: D.muted, margin: '4px 0 10px' }}>
                                    <span style={{ color: D.green2 }}>✓ {aciertos} bien</span> · <span style={{ color: '#ff5a5f' }}>✗ {fallos} con un color que no corresponde a su dato</span>
                                    {conValor.length - nPintados > 0 && <> · {conValor.length - nPintados} sin pintar</>}
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                                {!todoBien && <button onClick={corregirFallos} style={BTN(D.accent)}><Eraser size={14} />Borrar los fallos y seguir</button>}
                                {!todoBien && <button onClick={() => setVerSol(v => !v)} style={BTN(D.dark2, D.text)}>{verSol ? <><EyeOff size={14} />Ocultar solución</> : <><Eye size={14} />Ver solución</>}</button>}
                                <button onClick={reiniciar} style={BTN(D.dark2, D.text)}><RotateCcw size={14} />Empezar de nuevo</button>
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ flex: '1 1 260px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={CARD}>
                        <Leyenda titulo="LEYENDA · ELIGE UN COLOR" items={leyenda.map(l => ({ ...l, n: null }))} sel={sel} onSel={setSel} />
                        <button onClick={() => setSel('borrar')} style={{ ...BTN(sel === 'borrar' ? D.dark2 : 'transparent', D.text), width: '100%', marginTop: 6, border: `2px solid ${sel === 'borrar' ? D.text : D.border}` }}><Eraser size={14} />Goma de borrar</button>
                        <button onClick={comprobar} disabled={!nPintados} style={{ ...BTN(D.green2, '#0d1117'), width: '100%', marginTop: 10, justifyContent: 'center', opacity: nPintados ? 1 : 0.5 }}><CheckCircle size={15} />Comprobar</button>
                    </div>
                    <div style={CARD}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <div style={ETQ}>{conDatos ? 'DATOS' : 'SIN DATOS: ¡USA LO QUE SABES!'}</div>
                            <button onClick={() => setConDatos(v => !v)} style={{ ...BTN('transparent', D.accent), padding: '2px 6px', fontSize: '0.74rem' }}>{conDatos ? 'Ocultar datos' : 'Mostrar datos'}</button>
                        </div>
                        <div style={{ maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {conValor.map(t => {
                                const ci = verSol ? solucion[t.cod] : pintado[t.cod];
                                const m = !verSol && marcas?.[t.cod];
                                return (
                                    <button key={t.cod} onClick={() => pintar(t.cod)} onMouseEnter={() => setHover(t.cod)}
                                        style={{ display: 'grid', gridTemplateColumns: '18px 1fr auto 14px', alignItems: 'center', gap: 8, padding: '4px 6px', borderRadius: 6, border: 'none', background: hover === t.cod ? D.dark2 : 'transparent', color: D.text, cursor: 'pointer', textAlign: 'left', fontSize: '0.8rem' }}>
                                        <span style={{ width: 16, height: 12, borderRadius: 3, background: ci != null ? leyenda[ci].color : 'transparent', border: `1px solid ${D.border}` }} />
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.nombre}</span>
                                        <span style={{ color: D.muted, fontVariantNumeric: 'tabular-nums' }}>{conDatos ? valorTxt(valores[t.cod]) : ''}</span>
                                        <span style={{ color: m === 'ok' ? D.green2 : '#ff5a5f', fontWeight: 900 }}>{m === 'ok' ? '✓' : m === 'mal' ? '✗' : ''}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function MapasINE({ idx, inicial, rutaCompartir }) {
    const [cfg, setCfg] = useState(() => ({ ...DEFAULT_MAPA, ...(inicial || {}) }));
    const [vista, setVista] = useState(inicial?.juego ? 'juego' : 'mapa');
    const [mapa, setMapa] = useState(null);
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState('');
    const [hover, setHover] = useState(null);
    const [verTabla, setVerTabla] = useState(false);
    const [menuPdf, setMenuPdf] = useState(false);
    const [pdfEnCurso, setPdfEnCurso] = useState(false);
    const [compartir, setCompartir] = useState(null); // 'mapa' | 'juego'

    const ind = indicadorPorId(cfg.ind);
    const set = (k, v) => setCfg(c => ({ ...c, [k]: v }));
    const cambiarIndicador = (id) => {
        const n = indicadorPorId(id);
        setCfg(c => ({
            ...c, ind: id, titulo: '',
            metodo: n.met || (c.metodo === 'q' && indicadorPorId(c.ind).met ? 'r' : c.metodo),
            paleta: n.tipo === 'div' ? 'div' : c.paleta === 'div' ? 'azul' : c.paleta,
        }));
    };

    useEffect(() => { cargarMapa().then(setMapa).catch(e => setError(e.message)); }, []);
    useEffect(() => {
        let vivo = true;
        setDatos(null); setError('');
        cargarIndicador(idx, cfg.nivel, cfg.ind)
            .then(d => vivo && setDatos(d))
            .catch(e => vivo && setError(e.message === 'Failed to fetch' ? 'No se pudo conectar con el INE. Revisa la conexión o inténtalo más tarde.' : e.message));
        return () => { vivo = false; };
    }, [idx, cfg.nivel, cfg.ind]);
    useEffect(() => { escribirParamUrl('inemapa', mapaAQuery({ ...cfg, juego: vista === 'juego' }).slice('inemapa='.length)); }, [cfg, vista]);

    // Territorios en orden alfabético (numeración de la ficha y tabla del juego)
    const terr = useMemo(() => territorios(idx, cfg.nivel)
        .map(t => ({ ...t, nombre: nombreNatural(t.nombre) }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')), [idx, cfg.nivel]);

    const valores = datos?.valores || {};
    const b = useMemo(() => datos ? cortes(Object.values(datos.valores), cfg.k, cfg.metodo, ind.tipo === 'div', ind.dec) : [], [datos, cfg.k, cfg.metodo, ind]);
    const colores = useMemo(() => coloresClases(b, cfg.paleta), [b, cfg.paleta]);
    const etiquetas = useMemo(() => etiquetasClases(b, ind.dec), [b, ind]);
    const conteo = useMemo(() => { const n = Array(Math.max(b.length - 1, 0)).fill(0); Object.values(valores).forEach(v => { const c = claseDe(v, b); if (c >= 0) n[c]++; }); return n; }, [valores, b]);
    const leyenda = etiquetas.map((e, i) => ({ color: colores[i], etiqueta: e, n: conteo[i] }));
    const fills = useMemo(() => Object.fromEntries(Object.entries(valores).map(([cod, v]) => [cod, colores[claseDe(v, b)]])), [valores, colores, b]);

    const suf = ['%', '‰'].includes(unidadCorta(ind)) ? ` ${unidadCorta(ind)}` : '';
    const valorTxt = v => v == null ? '—' : `${nf(v, ind.dec)}${suf}`;
    const nivelTxt = cfg.nivel === 'p' ? 'provincias' : 'comunidades autónomas';
    const fecha = datos?.periodo || datos?.anyo || '';
    const tituloDef = `${ind.nombre} por ${nivelTxt}${fecha ? ` (${fecha})` : ''}`;
    const titulo = cfg.titulo.trim() || tituloDef;
    const metodoTxt = METODOS.find(m => m.id === cfg.metodo)?.nombre;
    const subtitulo = `${ind.unidad[0].toUpperCase()}${ind.unidad.slice(1)} · ${b.length - 1} clases (${metodoTxt.toLowerCase()})${datos?.anyo ? ` · datos de ${datos.anyo}` : ''}`;

    const hacerPdf = async (tipo) => {
        setMenuPdf(false); setPdfEnCurso(true);
        try {
            const { generarFichaMapa } = await import('./fichaMapaPdf');
            await generarFichaMapa({
                titulo, subtitulo, fuente: ind.fuente.replace(/·/g, '-'), nivel: cfg.nivel, mapa, fills,
                espana: datos.espana != null ? valorTxt(datos.espana) : null,
                leyenda, filas: terr.filter(t => valores[t.cod] != null).map(t => ({ cod: t.cod, nombre: t.nombre, valorTxt: valorTxt(valores[t.cod]) })),
            }, tipo);
        } catch (e) { setError(`No se pudo crear el PDF: ${e.message}`); }
        setPdfEnCurso(false);
    };

    const listo = mapa && datos && b.length > 1;

    if (vista === 'juego' && listo) return (
        <>
            <JuegoMapa key={`${cfg.nivel}${cfg.ind}${b.join()}`} mapa={mapa} nivel={cfg.nivel} terr={terr} valores={valores} b={b} leyenda={leyenda}
                valorTxt={valorTxt} titulo={titulo} onSalir={() => setVista('mapa')} />
            {rutaCompartir && <div style={{ textAlign: 'center', marginTop: 12 }}><button onClick={() => setCompartir('juego')} style={BTN(D.dark2, D.text)}><Share2 size={14} />Compartir este juego</button></div>}
            {compartir && <ModalCompartir url={rutaCompartir(mapaAQuery({ ...cfg, juego: compartir === 'juego' }))} titulo={`${compartir === 'juego' ? 'Juego: ' : ''}${titulo}`} onClose={() => setCompartir(null)} />}
        </>
    );

    const ranking = terr.filter(t => valores[t.cod] != null).sort((x, y) => valores[y.cod] - valores[x.cod]);

    return (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/* Configuración */}
            <div style={{ ...CARD, flex: '1 1 250px', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                    <div style={ETQ}>NIVEL</div>
                    <div style={{ display: 'flex', gap: 4, background: D.bg, borderRadius: 8, padding: 3, border: `1px solid ${D.border}` }}>
                        {[['p', 'Provincias'], ['c', 'Comunidades']].map(([k, l]) => (
                            <button key={k} onClick={() => set('nivel', k)} style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, background: cfg.nivel === k ? D.accent : 'transparent', color: cfg.nivel === k ? 'white' : D.muted }}>{l}</button>
                        ))}
                    </div>
                </div>
                <div>
                    <div style={ETQ}>¿QUÉ QUIERES REPRESENTAR?</div>
                    <select value={cfg.ind} onChange={e => cambiarIndicador(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${D.border}`, background: D.bg, color: D.text, fontSize: '0.85rem' }}>
                        {[...new Set(INDICADORES.map(i => i.grupo))].map(g => (
                            <optgroup key={g} label={g}>
                                {INDICADORES.filter(i => i.grupo === g).map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
                            </optgroup>
                        ))}
                    </select>
                    <div style={{ fontSize: '0.72rem', color: D.muted, marginTop: 4 }}>{ind.unidad}</div>
                </div>
                <div>
                    <div style={ETQ}>NÚMERO DE COLORES</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                        {[2, 3, 4, 5, 6].map(k => (
                            <button key={k} onClick={() => set('k', k)} style={{ flex: 1, padding: '6px 0', borderRadius: 7, border: `1px solid ${cfg.k === k ? D.accent : D.border}`, background: cfg.k === k ? D.accent : 'transparent', color: cfg.k === k ? 'white' : D.text, fontWeight: 700, cursor: 'pointer' }}>{k}</button>
                        ))}
                    </div>
                </div>
                <div>
                    <div style={ETQ}>CÓMO SE HACEN LOS INTERVALOS</div>
                    <select value={cfg.metodo} onChange={e => set('metodo', e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${D.border}`, background: D.bg, color: D.text, fontSize: '0.85rem' }}>
                        {METODOS.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                    </select>
                    <div style={{ fontSize: '0.72rem', color: D.muted, marginTop: 4 }}>{METODOS.find(m => m.id === cfg.metodo)?.ayuda}{b.length && b.length - 1 < cfg.k ? ` · con estos datos salen ${b.length - 1} clases` : ''}</div>
                </div>
                <div>
                    <div style={ETQ}>COLORES</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(88px,1fr))', gap: 6 }}>
                        {Object.entries(PALETAS).map(([k, p]) => {
                            const muestra = p.div ? [...p.neg.slice().reverse(), ...p.pos] : p.c;
                            return (
                                <button key={k} onClick={() => set('paleta', k)} title={p.nombre}
                                    style={{ padding: 4, borderRadius: 7, border: `2px solid ${cfg.paleta === k ? D.text : D.border}`, background: 'transparent', cursor: 'pointer' }}>
                                    <div style={{ display: 'flex', height: 12, borderRadius: 3, overflow: 'hidden' }}>{muestra.map(c => <span key={c} style={{ flex: 1, background: c }} />)}</div>
                                    <div style={{ fontSize: '0.68rem', color: D.muted, marginTop: 3 }}>{p.nombre}</div>
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div>
                    <div style={ETQ}>TÍTULO DEL MAPA</div>
                    <input value={cfg.titulo} onChange={e => set('titulo', e.target.value)} placeholder={tituloDef}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: `1px solid ${D.border}`, background: D.bg, color: D.text, fontSize: '0.85rem' }} />
                </div>
            </div>

            {/* Mapa */}
            <div style={{ flex: '3 1 440px', minWidth: 0 }}>
                <div style={{ ...CARD, padding: 12 }}>
                    <div style={{ fontWeight: 800, fontSize: '1.1rem', textAlign: 'center' }}>{titulo}</div>
                    <div style={{ fontSize: '0.76rem', color: D.muted, textAlign: 'center', marginBottom: 8 }}>{subtitulo}</div>
                    {error && <div style={{ color: D.red, textAlign: 'center', padding: 20 }}>{error}</div>}
                    {!listo && !error && <div style={{ color: D.muted, textAlign: 'center', padding: 60 }}>⏳ Cargando datos del INE…</div>}
                    {listo && (
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                            <div style={{ flex: '3 1 320px', minWidth: 0 }}>
                                <MapaSVG mapa={mapa} nivel={cfg.nivel} fills={fills} hover={hover} onHover={setHover} onClick={setHover} />
                            </div>
                            <div style={{ flex: '1 1 180px' }}>
                                <Leyenda titulo="LEYENDA" items={leyenda} />
                                {datos.espana != null && <div style={{ fontSize: '0.78rem', color: D.muted, marginTop: 8 }}>🇪🇸 España: <b style={{ color: D.text }}>{valorTxt(datos.espana)}</b></div>}
                            </div>
                        </div>
                    )}
                    <div style={{ minHeight: 22, textAlign: 'center', fontSize: '0.86rem', marginTop: 6 }}>
                        {hover && listo ? <><b>{terr.find(t => t.cod === hover)?.nombre}</b>: {valorTxt(valores[hover])}
                            {valores[hover] != null && <span style={{ color: D.muted }}> · puesto {ranking.findIndex(t => t.cod === hover) + 1}.º de {ranking.length}</span>}</>
                            : <span style={{ color: D.muted }}>Pasa el ratón (o toca) un territorio para ver su dato</span>}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: D.muted, textAlign: 'center' }}>Fuente: {ind.fuente}</div>
                </div>

                {/* Acciones */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, position: 'relative' }}>
                    <button disabled={!listo} onClick={() => setVista('juego')} style={{ ...BTN(D.gold, '#111'), opacity: listo ? 1 : 0.5 }}><Gamepad2 size={15} />Jugar: pinta el mapa</button>
                    <button disabled={!listo || pdfEnCurso} onClick={() => setMenuPdf(v => !v)} style={{ ...BTN(D.accent), opacity: listo ? 1 : 0.5 }}><FileDown size={15} />{pdfEnCurso ? 'Creando PDF…' : 'Ficha PDF'}</button>
                    <button onClick={() => setVerTabla(v => !v)} style={BTN(D.dark2, D.text)}><Table2 size={14} />{verTabla ? 'Ocultar tabla' : 'Tabla de datos'}</button>
                    {rutaCompartir && <button onClick={() => setCompartir('mapa')} style={BTN(D.dark2, D.text)}><Share2 size={14} />Compartir</button>}
                    {menuPdf && (
                        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 5, ...CARD, padding: 8, boxShadow: '0 12px 40px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 280 }}>
                            {[['ambas', '📝 + ✅ Para colorear + solución', 'Ficha del alumno y, en otra página, el mapa resuelto'],
                              ['colorear', '📝 Solo la ficha para colorear', 'Mapa en blanco numerado, leyenda y tabla de datos'],
                              ['resuelto', '✅ Solo el mapa resuelto', 'Mapa coloreado con título y leyenda']].map(([t, l, d]) => (
                                <button key={t} onClick={() => hacerPdf(t)} style={{ textAlign: 'left', padding: '8px 10px', borderRadius: 8, border: 'none', background: 'transparent', color: D.text, cursor: 'pointer' }}
                                    onMouseEnter={e => e.currentTarget.style.background = D.dark2} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{l}</div>
                                    <div style={{ fontSize: '0.72rem', color: D.muted }}>{d}</div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {verTabla && listo && (
                    <div style={{ ...CARD, marginTop: 12, overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', fontVariantNumeric: 'tabular-nums' }}>
                            <thead><tr>{['Puesto', cfg.nivel === 'p' ? 'Provincia' : 'Comunidad', ind.nombre, 'Color'].map(c => <th key={c} style={{ textAlign: c === 'Puesto' || c === ind.nombre ? 'right' : 'left', padding: '6px 8px', color: D.muted, background: D.dark2 }}>{c}</th>)}</tr></thead>
                            <tbody>
                                {ranking.map((t, i) => (
                                    <tr key={t.cod} onMouseEnter={() => setHover(t.cod)} style={{ borderTop: `1px solid ${D.border}`, background: hover === t.cod ? D.dark2 : 'transparent' }}>
                                        <td style={{ padding: '5px 8px', textAlign: 'right', color: D.muted }}>{i + 1}</td>
                                        <td style={{ padding: '5px 8px' }}>{t.nombre}</td>
                                        <td style={{ padding: '5px 8px', textAlign: 'right' }}>{valorTxt(valores[t.cod])}</td>
                                        <td style={{ padding: '5px 8px' }}><span style={{ display: 'inline-block', width: 22, height: 12, borderRadius: 3, background: fills[t.cod], border: `1px solid ${D.border}` }} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {compartir && rutaCompartir && <ModalCompartir url={rutaCompartir(mapaAQuery({ ...cfg, juego: compartir === 'juego' }))} titulo={titulo} onClose={() => setCompartir(null)} />}
        </div>
    );
}
