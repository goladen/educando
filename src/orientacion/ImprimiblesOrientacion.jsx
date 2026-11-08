import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import MapaOrientacion, { SelectorCapa, MAGENTA } from './MapaOrientacion';
import { RosaVientos } from './sensores';
import { tramosDe, fmtGrados, pasosDe, longitudRecorrido, redondearM } from './geo';

const qr = (url, size = 220) => `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=111111&margin=6`;

const HOJAS = [
    { id: 'mapa', label: '🗺️ Mapa con balizas', desc: 'Para la versión con mapa: salida, balizas numeradas y, si quieres, las líneas del recorrido.' },
    { id: 'mudo', label: '📄 Mapa mudo', desc: 'Solo aparece la salida: el alumno dibuja el recorrido siguiendo las indicaciones.' },
    { id: 'cardinal', label: '🧭 Hoja de ruta · Norte/Sur/Este/Oeste', desc: 'Indicaciones de cada tramo con puntos cardinales y metros, y casillas para los códigos.' },
    { id: 'rumbo', label: '📐 Hoja de ruta · rumbos en grados', desc: 'Rumbo (0-360°), distancia y pasos de cada tramo, para usar con brújula.' },
    { id: 'control', label: '🎫 Tarjeta de control', desc: 'Casillas numeradas para anotar el código de cada baliza (para la versión con mapa).' },
    { id: 'balizas', label: '🚩 Balizas para colgar', desc: 'Una baliza por media hoja con número, código y pregunta. Recórtalas y colócalas.' },
    { id: 'solucion', label: '🔑 Solucionario del profesor', desc: 'Coordenadas, códigos, respuestas e indicaciones en los tres formatos.' },
];

const CSS = `
.orient-print-root{position:fixed;inset:0;z-index:13000;background:#e2e8f0;overflow-y:auto;font-family:'Segoe UI',system-ui,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.orient-hoja{width:210mm;min-height:297mm;box-sizing:border-box;padding:10mm;margin:14px auto;background:#fff;box-shadow:0 4px 18px rgba(0,0,0,.18);color:#111;position:relative}
.orient-hoja h2{margin:0 0 2mm;font-size:17pt}
.orient-tabla{width:100%;border-collapse:collapse;font-size:10.5pt}
.orient-tabla th,.orient-tabla td{border:1px solid #333;padding:2.2mm 2mm;text-align:left;vertical-align:middle}
.orient-tabla th{background:#f1f5f9;font-size:9.5pt}
.orient-casilla{display:inline-block;width:9mm;height:9mm;border:1.5px solid #111;margin-right:1.5mm;vertical-align:middle}
.orient-mitad{height:138mm;border-bottom:1px dashed #94a3b8;display:flex;align-items:center;gap:8mm;padding:4mm 2mm;box-sizing:border-box}
.orient-mitad:last-child{border-bottom:none}
@media print{
  @page{size:A4 portrait;margin:0}
  html,body{overflow:visible!important;height:auto!important;background:#fff!important}
  body>*:not(.orient-print-root){display:none!important}
  .orient-print-root{position:static!important;overflow:visible!important;background:#fff!important}
  .orient-noprint{display:none!important}
  .orient-hoja{margin:0!important;box-shadow:none!important;page-break-after:always;break-after:page;min-height:auto;height:297mm;overflow:hidden}
  .orient-hoja:last-child{page-break-after:auto;break-after:auto}
}`;

function Cabecera({ carrera, titulo, enlace, conAlumno = true }) {
    return (
        <div style={{ display: 'flex', gap: '5mm', alignItems: 'flex-start', marginBottom: '4mm' }}>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: '9pt', color: MAGENTA, fontWeight: 800, letterSpacing: 1 }}>CARRERA DE ORIENTACIÓN · PIKT</div>
                <h2>{carrera.titulo || 'Carrera de orientación'}</h2>
                <div style={{ fontSize: '11pt', fontWeight: 700, color: '#334155' }}>{titulo}</div>
                {conAlumno && (
                    <div style={{ marginTop: '3mm', fontSize: '10.5pt', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2mm 6mm' }}>
                        <div>Nombre: ______________________________</div><div>Curso: __________</div>
                        <div>Hora de salida: ________ Hora de llegada: ________</div><div>Tiempo: ________</div>
                    </div>
                )}
            </div>
            {enlace && (
                <div style={{ textAlign: 'center', fontSize: '7.5pt', color: '#475569' }}>
                    <img src={qr(enlace, 200)} alt="QR" style={{ width: '26mm', height: '26mm', display: 'block' }} />
                    Hazla con el móvil{carrera.id ? <><br /><b style={{ fontSize: '9pt', color: '#111' }}>{carrera.id}</b></> : null}
                </div>
            )}
        </div>
    );
}

function HojaMapa({ carrera, capa, lineas, mudo, enlace, ajustarKey }) {
    const km = longitudRecorrido(carrera);
    return (
        <div className="orient-hoja">
            <Cabecera carrera={carrera} enlace={enlace} titulo={mudo ? 'Mapa mudo: dibuja tu recorrido' : `Mapa de la carrera · ${carrera.balizas.length} balizas · ${redondearM(km)} m${carrera.config?.ordenLibre ? ' · orden libre' : ''}`} conAlumno={mudo} />
            <div style={{ border: '2px solid #111' }}>
                <MapaOrientacion carrera={carrera} capa={capa} estatico verBalizas={!mudo} verLineas={!mudo && lineas} alto={mudo ? '222mm' : '236mm'} ancho="100%" ajustarKey={ajustarKey} grande />
            </div>
            <div style={{ display: 'flex', gap: '6mm', fontSize: '8.5pt', marginTop: '2mm', color: '#334155', alignItems: 'center', flexWrap: 'wrap' }}>
                <span><svg width="14" height="12"><polygon points="7,1 13,11 1,11" fill="none" stroke={MAGENTA} strokeWidth="2" /></svg> Salida</span>
                {!mudo && <span><svg width="14" height="14"><circle cx="7" cy="7" r="5" fill="none" stroke={MAGENTA} strokeWidth="2" /></svg> Baliza</span>}
                {carrera.config?.metaEnSalida && <span>◎ Meta en la salida</span>}
                <span>Norte arriba · escala abajo a la izquierda</span>
            </div>
        </div>
    );
}

function HojaRuta({ carrera, tipo, enlace }) {
    const tramos = tramosDe(carrera);
    const cfg = carrera.config || {};
    const conPreg = carrera.balizas.some(b => b.pregunta);
    const longPaso = cfg.longPaso || 0.65;
    const cardinal = tipo === 'cardinal';
    return (
        <div className="orient-hoja">
            <Cabecera carrera={carrera} enlace={enlace} titulo={cardinal ? 'Hoja de ruta · puntos cardinales y distancias' : 'Hoja de ruta · rumbos con brújula'} />
            <div style={{ display: 'flex', gap: '5mm', alignItems: 'center', marginBottom: '3mm', fontSize: '9.5pt', color: '#334155' }}>
                {cardinal ? <RosaVientos tam={92} /> : (
                    <svg width="92" height="92" viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r="56" fill="#fff" stroke="#111" />
                        {Array.from({ length: 36 }, (_, i) => <line key={i} x1="60" y1="5" x2="60" y2={i % 9 === 0 ? 16 : 11} stroke="#111" transform={`rotate(${i * 10} 60 60)`} />)}
                        {[['0°', 0], ['90°', 90], ['180°', 180], ['270°', 270]].map(([t, g]) => {
                            const a = (g - 90) * Math.PI / 180;
                            return <text key={t} x={60 + Math.cos(a) * 34} y={63 + Math.sin(a) * 34} textAnchor="middle" fontSize="11" fontWeight="800">{t}</text>;
                        })}
                        <polygon points="60,22 66,60 54,60" fill="#dc2626" /><polygon points="60,98 66,60 54,60" fill="#64748b" />
                    </svg>
                )}
                <div style={{ flex: 1, lineHeight: 1.45 }}>
                    {cardinal ? (
                        <>Empieza en la <b>salida</b>. Cada fila te dice cuántos metros andar y hacia dónde.
                            Cuando encuentres la baliza, copia su <b>código</b> en la casilla{conPreg ? ' y responde a su pregunta' : ''}.
                            {cfg.mostrarPasos !== false && <> Un paso normal mide unos <b>{Math.round(longPaso * 100)} cm</b>.</>}</>
                    ) : (
                        <>Gira la brújula hasta el <b>rumbo</b> indicado (0° = Norte, 90° = Este, 180° = Sur, 270° = Oeste),
                            alinea la aguja con el Norte y camina recto la distancia. Copia el <b>código</b> de cada baliza{conPreg ? ' y responde a su pregunta' : ''}.
                            {cfg.mostrarPasos !== false && <> Paso ≈ <b>{Math.round(longPaso * 100)} cm</b>.</>}</>
                    )}
                </div>
            </div>
            <table className="orient-tabla">
                <thead>
                    <tr>
                        <th style={{ width: '18mm' }}>Tramo</th>
                        {cardinal ? <th>Indicación</th> : <><th style={{ width: '22mm' }}>Rumbo</th><th style={{ width: '22mm' }}>Distancia</th></>}
                        {cfg.mostrarPasos !== false && <th style={{ width: '17mm' }}>Pasos</th>}
                        <th style={{ width: '33mm' }}>Código</th>
                        {conPreg && <th style={{ width: '48mm' }}>Respuesta</th>}
                    </tr>
                </thead>
                <tbody>
                    {tramos.map((t, i) => (
                        <tr key={i}>
                            <td style={{ fontWeight: 800, fontSize: '9pt' }}>{t.desde.esSalida ? '▲' : t.desde.num} → {t.hasta.esMeta ? '◎' : t.hasta.num}</td>
                            {cardinal
                                ? <td style={{ fontWeight: 700 }}>{cfg.formatoCardinal === 'rosa8' ? t.ind.rosa8 : t.ind.componentes}</td>
                                : <><td style={{ fontWeight: 900, fontSize: '13pt' }}>{fmtGrados(t.ind.rumbo)}</td><td style={{ fontWeight: 700 }}>{t.ind.distancia} m</td></>}
                            {cfg.mostrarPasos !== false && <td>≈ {pasosDe(t.ind.distancia, longPaso)}</td>}
                            <td>{t.hasta.esMeta ? <i style={{ fontSize: '9pt' }}>Meta</i> : <><span className="orient-casilla" /><span className="orient-casilla" /><span className="orient-casilla" /></>}</td>
                            {conPreg && <td style={{ fontSize: '8.5pt' }}>{!t.hasta.esMeta && t.hasta.pregunta ? '' : <span style={{ color: '#94a3b8' }}>—</span>}</td>}
                        </tr>
                    ))}
                </tbody>
            </table>
            {!cardinal && <div style={{ fontSize: '8pt', color: '#64748b', marginTop: '2mm' }}>Rumbos respecto al norte geográfico (en España la declinación magnética es de menos de 2°, se puede despreciar).</div>}
        </div>
    );
}

function HojaControl({ carrera, enlace }) {
    const conPreg = carrera.balizas.some(b => b.pregunta);
    const n = carrera.balizas.length;
    return (
        <div className="orient-hoja">
            <Cabecera carrera={carrera} enlace={enlace} titulo={`Tarjeta de control · ${n} balizas${carrera.config?.ordenLibre ? ' (en cualquier orden)' : ''}`} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3mm' }}>
                {carrera.balizas.map((b, i) => (
                    <div key={b.id} style={{ border: '2px solid #111', borderRadius: '2mm', padding: '2.5mm', minHeight: conPreg ? '36mm' : '24mm' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '18pt', fontWeight: 900, color: MAGENTA }}>{i + 1}</span>
                            <span><span className="orient-casilla" /><span className="orient-casilla" /><span className="orient-casilla" /></span>
                        </div>
                        {conPreg && b.pregunta && <div style={{ marginTop: '2mm', fontSize: '8.5pt', borderTop: '1px dashed #94a3b8', paddingTop: '1.5mm', color: '#475569' }}>Respuesta:<br />________________</div>}
                    </div>
                ))}
            </div>
        </div>
    );
}

function Bandera({ tam = 120 }) {
    return (
        <svg width={tam} height={tam} viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
            <rect x="2" y="2" width="96" height="96" fill="#fff" stroke="#111" strokeWidth="2" />
            <polygon points="98,2 98,98 2,98" fill="#f97316" />
        </svg>
    );
}

function HojasBalizas({ carrera }) {
    const pares = [];
    for (let i = 0; i < carrera.balizas.length; i += 2) pares.push(carrera.balizas.slice(i, i + 2));
    return pares.map((par, p) => (
        <div className="orient-hoja" key={p} style={{ padding: '6mm 10mm' }}>
            {par.map((b, k) => {
                const num = p * 2 + k + 1;
                return (
                    <div className="orient-mitad" key={b.id}>
                        <Bandera tam={190} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '10pt', color: '#64748b', fontWeight: 800, letterSpacing: 1 }}>BALIZA</div>
                            <div style={{ fontSize: '86pt', lineHeight: 1, fontWeight: 900, color: MAGENTA }}>{num}</div>
                            <div style={{ fontSize: '11pt', color: '#334155', marginTop: '2mm' }}>Código</div>
                            <div style={{ fontSize: '40pt', fontWeight: 900, letterSpacing: '4mm', fontFamily: 'Consolas, monospace' }}>{b.codigo}</div>
                            {b.pregunta && <div style={{ marginTop: '3mm', fontSize: '13pt', fontWeight: 700, border: '2px solid #111', borderRadius: '2mm', padding: '2.5mm', overflowWrap: 'anywhere' }}>❓ {b.pregunta}</div>}
                            <div style={{ fontSize: '8pt', color: '#94a3b8', marginTop: '2mm' }}>{carrera.titulo}</div>
                        </div>
                    </div>
                );
            })}
        </div>
    ));
}

function HojaSolucion({ carrera, enlace }) {
    const tramos = tramosDe(carrera);
    const c = carrera.config || {};
    return (
        <div className="orient-hoja">
            <Cabecera carrera={carrera} enlace={enlace} conAlumno={false} titulo={`Solucionario del profesor · recorrido total ≈ ${redondearM(longitudRecorrido(carrera))} m · radio de validación ${c.radio || 10} m`} />
            <table className="orient-tabla" style={{ fontSize: '9pt' }}>
                <thead><tr><th>#</th><th>Nombre / lugar</th><th>Latitud</th><th>Longitud</th><th>Código</th><th>Pregunta → respuesta</th></tr></thead>
                <tbody>
                    {carrera.salida && <tr><td>▲</td><td>Salida{c.metaEnSalida ? ' y meta' : ''}</td><td>{carrera.salida.lat.toFixed(6)}</td><td>{carrera.salida.lng.toFixed(6)}</td><td>—</td><td>—</td></tr>}
                    {carrera.balizas.map((b, i) => (
                        <tr key={b.id}><td style={{ fontWeight: 800 }}>{i + 1}</td><td>{b.nombre || '—'}</td><td>{b.lat.toFixed(6)}</td><td>{b.lng.toFixed(6)}</td>
                            <td style={{ fontWeight: 900, fontFamily: 'Consolas, monospace' }}>{b.codigo}</td>
                            <td>{b.pregunta ? <>{b.pregunta} → <b>{b.respuesta || '(libre)'}</b></> : '—'}</td></tr>
                    ))}
                </tbody>
            </table>
            <h3 style={{ fontSize: '12pt', margin: '5mm 0 2mm' }}>Indicaciones de cada tramo</h3>
            <table className="orient-tabla" style={{ fontSize: '9pt' }}>
                <thead><tr><th>Tramo</th><th>N/S + E/O</th><th>8 direcciones</th><th>Rumbo</th><th>Distancia</th></tr></thead>
                <tbody>
                    {tramos.map((t, i) => (
                        <tr key={i}><td style={{ fontWeight: 800 }}>{t.desde.esSalida ? '▲' : t.desde.num} → {t.hasta.esMeta ? '◎' : t.hasta.num}</td>
                            <td>{t.ind.componentes}</td><td>{t.ind.dir8.nombre}</td><td>{fmtGrados(t.ind.rumbo)}</td><td>{t.ind.distancia} m</td></tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default function ImprimiblesOrientacion({ carrera, enlace, onClose }) {
    const [sel, setSel] = useState(() => new Set(['mapa', 'cardinal', 'balizas']));
    const [capa, setCapa] = useState(carrera.config?.capa || 'satelite');
    const [lineas, setLineas] = useState(!carrera.config?.ordenLibre);
    const [conQr, setConQr] = useState(!!enlace);
    const ajustarKey = useMemo(() => capa + (lineas ? 1 : 0) + Date.now(), [capa, lineas]);
    const lnk = conQr ? enlace : null;
    const toggle = (id) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const vacia = !carrera.balizas?.length;

    return createPortal(
        <div className="orient-print-root">
            <style>{CSS}</style>
            <div className="orient-noprint" style={{ position: 'sticky', top: 0, zIndex: 5, background: '#0f172a', color: 'white', padding: '10px 14px', boxShadow: '0 4px 14px rgba(0,0,0,.3)' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', maxWidth: 1100, margin: '0 auto' }}>
                    <button onClick={onClose} style={btn('#334155')}>← Volver</button>
                    <b style={{ fontSize: '1.05rem' }}>🖨️ Imprimibles</b>
                    <div style={{ flex: 1 }} />
                    <SelectorCapa capa={capa} onCapa={setCapa} compacto />
                    <label style={chk}><input type="checkbox" checked={lineas} onChange={e => setLineas(e.target.checked)} /> Líneas del recorrido</label>
                    {enlace && <label style={chk}><input type="checkbox" checked={conQr} onChange={e => setConQr(e.target.checked)} /> QR para el móvil</label>}
                    <button onClick={() => window.print()} disabled={!sel.size || vacia} style={btn('#c026d3')}>🖨️ Imprimir / PDF</button>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 1100, margin: '8px auto 0' }}>
                    {HOJAS.map(h => (
                        <button key={h.id} title={h.desc} onClick={() => toggle(h.id)} style={{
                            ...btn(sel.has(h.id) ? '#16a34a' : '#1e293b'), border: '1px solid #475569', fontWeight: 600, fontSize: '0.8rem',
                        }}>{sel.has(h.id) ? '✓ ' : ''}{h.label}</button>
                    ))}
                </div>
                <div style={{ maxWidth: 1100, margin: '6px auto 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                    Consejo: en el diálogo de impresión elige «Guardar como PDF», tamaño A4 y activa «Gráficos de fondo». Espera a que el mapa termine de cargar antes de imprimir.
                </div>
            </div>
            {vacia ? <div className="orient-noprint" style={{ textAlign: 'center', padding: 60, color: '#475569' }}>Añade al menos una baliza para generar los imprimibles.</div> : (
                <div>
                    {sel.has('mapa') && <HojaMapa carrera={carrera} capa={capa} lineas={lineas} enlace={lnk} ajustarKey={ajustarKey} />}
                    {sel.has('mudo') && <HojaMapa carrera={carrera} capa={capa} mudo enlace={lnk} ajustarKey={ajustarKey + 'm'} />}
                    {sel.has('cardinal') && <HojaRuta carrera={carrera} tipo="cardinal" enlace={lnk} />}
                    {sel.has('rumbo') && <HojaRuta carrera={carrera} tipo="rumbo" enlace={lnk} />}
                    {sel.has('control') && <HojaControl carrera={carrera} enlace={lnk} />}
                    {sel.has('balizas') && <HojasBalizas carrera={carrera} />}
                    {sel.has('solucion') && <HojaSolucion carrera={carrera} enlace={lnk} />}
                </div>
            )}
        </div>,
        document.body,
    );
}

const btn = (bg) => ({ padding: '8px 13px', borderRadius: 10, border: 'none', background: bg, color: 'white', fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem' });
const chk = { display: 'flex', gap: 5, alignItems: 'center', fontSize: '0.82rem', cursor: 'pointer' };
