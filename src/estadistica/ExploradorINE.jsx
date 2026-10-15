// ExploradorINE.jsx — Datos reales del INE de cualquier municipio, dentro de Estadística.
// El buscador usa public/ine/municipios.json (scripts/generar-ine-municipios.mjs) y los datos se
// piden EN VIVO a la API JSON del INE (servicios.ine.es/wstempus, con CORS abierto):
//  · Padrón (DPOP): tabla nacional 29005 → evolución de la población del municipio por sexo.
//  · Padrón por provincia (tabla de cada provincia) → total provincial, ranking y municipios parecidos.
//  · Atlas de distribución de renta de los hogares (ADRH): renta, fuentes de ingreso, Gini e
//    indicadores demográficos (una tabla por provincia; se filtra con tv=19:<idINE>).
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, MapPin, ExternalLink, Table2, Copy, CheckCircle, LineChart as IconoLinea } from 'lucide-react';

const D = {
    bg:'#0d1117', card:'#161b22', border:'#30363d', dark2:'#21262d',
    text:'#e6edf3', muted:'#8b949e', accent:'#3498db',
    green2:'#2ecc71', red:'#e74c3c', gold:'#f39c12',
    // Series validadas (dataviz) sobre la superficie #161b22
    s1:'#3498db', s2:'#d9782d', grid:'#262c36',
};
const CARD = { background:D.card, borderRadius:14, padding:18, border:`1px solid ${D.border}` };
const BTN  = (bg,col='white') => ({ padding:'8px 16px', borderRadius:9, border:'none', background:bg, color:col, fontWeight:700, cursor:'pointer', fontSize:'0.85rem', display:'inline-flex', alignItems:'center', gap:6 });

const API = 'https://servicios.ine.es/wstempus/js/ES';
const cache = new Map();
const ine = (ruta) => {
    if (!cache.has(ruta)) {
        cache.set(ruta, fetch(`${API}/${ruta}`).then(r => {
            if (!r.ok) throw new Error(`INE ${r.status}`);
            return r.json();
        }).catch(e => { cache.delete(ruta); throw e; }));
    }
    return cache.get(ruta);
};

let indicePromesa = null;
const cargarIndice = () => (indicePromesa ||= fetch('/ine/municipios.json').then(r => {
    if (!r.ok) throw new Error('No se pudo cargar el índice de municipios');
    return r.json();
}).catch(e => { indicePromesa = null; throw e; }));

const normal = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const nf = (v, dec = 0) => v == null || isNaN(v) ? '—' : Number(v).toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const pct = (a, b) => b ? (a - b) / b * 100 : null;
const signo = v => v == null ? '—' : `${v > 0 ? '+' : ''}${nf(v, 1)} %`;

// Serie INE → [{anyo, valor}] ordenada por año (DATOS_TABLA viene descendente, DATOS_SERIE ascendente)
const puntos = (serie) => (serie?.Data || [])
    .filter(d => d.Valor != null && !d.Secreto)
    .map(d => ({ anyo: d.Anyo, valor: d.Valor }))
    .sort((a, b) => a.anyo - b.anyo);
const ultimo = (serie) => { const p = puntos(serie); return p[p.length - 1] || null; };
const buscarSerie = (lista, texto) => lista?.find(s => s.Nombre.includes(texto));

// ─── Carga de todos los bloques de un municipio ───────────────────────────────
async function cargarMunicipio(m, prov) {
    const [idIne] = m;
    const tv = `tv=19:${idIne}`;
    const pedir = (tabla, nult) => tabla ? ine(`DATOS_TABLA/${tabla}?${tv}&nult=${nult}`) : Promise.resolve(null);

    const [padron, provTabla, renta, demo, gini, fuente] = await Promise.allSettled([
        ine(`DATOS_TABLA/29005?${tv}&nult=40`),
        prov?.padron ? ine(`DATOS_TABLA/${prov.padron}?nult=1`) : Promise.resolve(null),
        pedir(prov?.renta, 12), pedir(prov?.demo, 12), pedir(prov?.gini, 12), pedir(prov?.fuente, 1),
    ]);
    const ok = r => r.status === 'fulfilled' ? r.value : null;

    // Padrón del municipio: Total / Hombres / Mujeres
    const sp = ok(padron) || [];
    const serieTotal = sp.find(s => / Total\. Total habitantes/.test(s.Nombre)) || sp[0];
    const total = puntos(serieTotal);
    const hombres = puntos(sp.find(s => / Hombres\. /.test(s.Nombre)));
    const mujeres = puntos(sp.find(s => / Mujeres\. /.test(s.Nombre)));

    // Zona: provincia completa (último año) → ranking y municipios de tamaño parecido
    let zona = null;
    const st = ok(provTabla);
    if (st?.length) {
        const totales = st.filter(s => / Total\. Total habitantes/.test(s.Nombre));
        const [provSerie, ...muns] = totales;
        const lista = muns.map(s => ({ cod: s.COD, nombre: s.Nombre.split(/\. Total\. /)[0], valor: ultimo(s)?.valor }))
            .filter(x => x.valor != null && !/^Población en municipios/i.test(x.nombre)).sort((a, b) => b.valor - a.valor);
        const pos = lista.findIndex(x => x.cod === serieTotal?.COD);
        let historiaProv = [];
        try { historiaProv = puntos(await ine(`DATOS_SERIE/${provSerie.COD}?nult=40`)); } catch { /* opcional */ }
        zona = {
            total: ultimo(provSerie)?.valor, historia: historiaProv, lista, pos,
            nMunicipios: lista.length,
        };
    }

    const r = ok(renta), dm = ok(demo), g = ok(gini), f = ok(fuente);
    return {
        total, hombres, mujeres, zona,
        renta: r && {
            persona: puntos(buscarSerie(r, 'Renta neta media por persona')),
            hogar: puntos(buscarSerie(r, 'Renta neta media por hogar')),
            mediana: puntos(buscarSerie(r, 'Mediana de la renta por unidad de consumo')),
            brutaPersona: puntos(buscarSerie(r, 'Renta bruta media por persona')),
        },
        demo: dm && {
            edad: puntos(buscarSerie(dm, 'Edad media')),
            menores: puntos(buscarSerie(dm, 'menor de 18')),
            mayores: puntos(buscarSerie(dm, '65 y más')),
            hogar: puntos(buscarSerie(dm, 'Tamaño medio del hogar')),
            unipersonales: puntos(buscarSerie(dm, 'unipersonales')),
            espanola: puntos(buscarSerie(dm, 'población española')),
        },
        gini: g && {
            gini: puntos(buscarSerie(g, 'Gini')),
            p8020: puntos(buscarSerie(g, 'P80/P20')),
        },
        fuente: f && ['salario', 'pensiones', 'prestaciones por desempleo', 'otras prestaciones', 'otros ingresos']
            .map(k => ({ nombre: k[0].toUpperCase() + k.slice(1), valor: ultimo(buscarSerie(f, `Fuente de ingreso: ${k}.`))?.valor ?? null, anyo: ultimo(buscarSerie(f, `Fuente de ingreso: ${k}.`))?.anyo })),
        errores: [padron, provTabla, renta, demo, gini, fuente].filter(x => x.status === 'rejected').length,
    };
}

// ─── Gráfico de líneas con cruceta y tooltip ──────────────────────────────────
function GraficoLineas({ series, formato = v => nf(v), alto = 220, unidad = '' }) {
    const ref = useRef(null);
    const [hover, setHover] = useState(null);
    const W = 640, H = alto, M = { t: 14, r: 16, b: 26, l: 64 };
    const todos = series.flatMap(s => s.puntos);
    if (!todos.length) return <div style={{ color: D.muted, fontSize: '0.85rem', padding: 20 }}>Sin datos disponibles.</div>;
    const anyos = [...new Set(todos.map(p => p.anyo))].sort((a, b) => a - b);
    const x0 = anyos[0], x1 = anyos[anyos.length - 1];
    let y0 = Math.min(...todos.map(p => p.valor)), y1 = Math.max(...todos.map(p => p.valor));
    const marg = (y1 - y0) * 0.1 || Math.abs(y1) * 0.1 || 1;
    y0 -= marg; y1 += marg;
    const X = a => M.l + (x1 === x0 ? 0.5 : (a - x0) / (x1 - x0)) * (W - M.l - M.r);
    const Y = v => M.t + (1 - (v - y0) / (y1 - y0)) * (H - M.t - M.b);
    const ticksY = Array.from({ length: 4 }, (_, i) => y0 + (y1 - y0) * (i + 0.5) / 4);
    const pasoX = Math.max(1, Math.ceil(anyos.length / 7));

    const mover = (e) => {
        const r = ref.current.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width * W;
        let mejor = anyos[0];
        for (const a of anyos) if (Math.abs(X(a) - px) < Math.abs(X(mejor) - px)) mejor = a;
        setHover({ anyo: mejor, left: X(mejor) / W * 100 });
    };

    return (
        <div style={{ position: 'relative' }}>
            <svg ref={ref} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'pan-y' }}
                onMouseMove={mover} onMouseLeave={() => setHover(null)} onTouchStart={e => mover(e.touches[0])} onTouchMove={e => mover(e.touches[0])}
                role="img" aria-label={series.map(s => s.nombre).join(', ')}>
                {ticksY.map((v, i) => (
                    <g key={i}>
                        <line x1={M.l} x2={W - M.r} y1={Y(v)} y2={Y(v)} stroke={D.grid} strokeWidth={1} />
                        <text x={M.l - 8} y={Y(v) + 4} textAnchor="end" fontSize={11} fill={D.muted}>{formato(v)}</text>
                    </g>
                ))}
                {anyos.filter((_, i) => i % pasoX === 0 || i === anyos.length - 1).map(a => (
                    <text key={a} x={X(a)} y={H - 6} textAnchor="middle" fontSize={11} fill={D.muted}>{a}</text>
                ))}
                {series.map(s => s.puntos.length > 0 && (
                    <path key={s.nombre} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
                        d={s.puntos.map((p, i) => `${i ? 'L' : 'M'}${X(p.anyo)},${Y(p.valor)}`).join(' ')} />
                ))}
                {hover && <line x1={X(hover.anyo)} x2={X(hover.anyo)} y1={M.t} y2={H - M.b} stroke={D.muted} strokeWidth={1} strokeDasharray="3 3" />}
                {hover && series.map(s => {
                    const p = s.puntos.find(q => q.anyo === hover.anyo);
                    return p && <circle key={s.nombre} cx={X(p.anyo)} cy={Y(p.valor)} r={4.5} fill={s.color} stroke={D.card} strokeWidth={2} />;
                })}
                <rect x={M.l} y={M.t} width={W - M.l - M.r} height={H - M.t - M.b} fill="transparent" />
            </svg>
            {hover && (
                <div style={{ position: 'absolute', top: 4, left: `${hover.left}%`, transform: `translateX(${hover.left > 60 ? 'calc(-100% - 10px)' : '10px'})`,
                    background: D.dark2, border: `1px solid ${D.border}`, borderRadius: 8, padding: '6px 10px', fontSize: '0.78rem', pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 2 }}>
                    <div style={{ fontWeight: 700, marginBottom: 2, color: D.text }}>{hover.anyo}</div>
                    {series.map(s => {
                        const p = s.puntos.find(q => q.anyo === hover.anyo);
                        return p && <div key={s.nombre} style={{ display: 'flex', alignItems: 'center', gap: 6, color: D.text }}>
                            <span style={{ width: 10, height: 3, borderRadius: 2, background: s.color }} />
                            <span style={{ color: D.muted }}>{s.nombre}:</span> {formato(p.valor)}{unidad}
                        </div>;
                    })}
                </div>
            )}
            {series.length > 1 && (
                <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                    {series.map(s => (
                        <span key={s.nombre} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: D.muted }}>
                            <span style={{ width: 14, height: 3, borderRadius: 2, background: s.color }} />{s.nombre}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

// Barras horizontales (fuentes de ingreso, municipios de la zona…)
function BarrasH({ filas, formato = v => nf(v), destacar }) {
    const max = Math.max(...filas.map(f => f.valor || 0), 1);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filas.map(f => (
                <div key={f.nombre} title={`${f.nombre}: ${f.valor == null ? 'dato no disponible (secreto estadístico)' : formato(f.valor)}`}
                    style={{ display: 'grid', gridTemplateColumns: 'minmax(90px,38%) 1fr auto', alignItems: 'center', gap: 8, fontSize: '0.8rem' }}>
                    <span style={{ color: f.nombre === destacar ? D.text : D.muted, fontWeight: f.nombre === destacar ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.nombre}</span>
                    <div style={{ height: 12, background: D.dark2, borderRadius: 4 }}>
                        {f.valor != null && <div style={{ width: `${f.valor / max * 100}%`, height: '100%', borderRadius: 4, background: f.nombre === destacar ? D.s2 : D.s1, minWidth: 2 }} />}
                    </div>
                    <span style={{ color: D.text, minWidth: 54, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{f.valor == null ? '—' : formato(f.valor)}</span>
                </div>
            ))}
        </div>
    );
}

function Tile({ titulo, valor, detalle, color }) {
    return (
        <div style={{ ...CARD, padding: '12px 14px' }}>
            <div style={{ fontSize: '0.72rem', color: D.muted, fontWeight: 600, marginBottom: 4 }}>{titulo}</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: color || D.text, fontVariantNumeric: 'tabular-nums' }}>{valor}</div>
            {detalle && <div style={{ fontSize: '0.72rem', color: D.muted, marginTop: 2 }}>{detalle}</div>}
        </div>
    );
}

const Seccion = ({ titulo, extra, children }) => (
    <div style={{ ...CARD, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{titulo}</div>
            {extra}
        </div>
        {children}
    </div>
);

// ─── Actividades con los datos reales ─────────────────────────────────────────
function generarActividades(nombre, d) {
    const acts = [];
    const t = d.total;
    if (t.length >= 2) {
        const a = t[t.length - 1], b = t[Math.max(0, t.length - 11)];
        acts.push({ id: 'var', texto: `La población de ${nombre} era ${nf(b.valor)} habitantes en ${b.anyo} y ${nf(a.valor)} en ${a.anyo}. ¿Cuál ha sido la variación porcentual? (en %, con 1 decimal)`, sol: pct(a.valor, b.valor), dec: 1 });
    }
    if (t.length >= 5) {
        const ult = t.slice(-5);
        acts.push({ id: 'media', texto: `Calcula la media de la población de los años ${ult[0].anyo}–${ult[4].anyo}: ${ult.map(p => nf(p.valor)).join(' · ')}`, sol: ult.reduce((s, p) => s + p.valor, 0) / 5, dec: 1 });
    }
    const h = d.hombres[d.hombres.length - 1], m = d.mujeres[d.mujeres.length - 1];
    if (h && m) acts.push({ id: 'muj', texto: `En ${m.anyo} había ${nf(h.valor)} hombres y ${nf(m.valor)} mujeres. ¿Qué porcentaje de la población son mujeres?`, sol: m.valor / (h.valor + m.valor) * 100, dec: 1 });
    if (d.zona?.total && t.length) {
        const a = t[t.length - 1];
        acts.push({ id: 'prov', texto: `La provincia tiene ${nf(d.zona.total)} habitantes. ¿Qué porcentaje de la población provincial vive en ${nombre}? (${nf(a.valor)} hab.)`, sol: a.valor / d.zona.total * 100, dec: 2 });
    }
    const rp = d.renta?.persona?.at(-1), rh = d.renta?.hogar?.at(-1);
    if (rp && rh) acts.push({ id: 'hogar', texto: `En ${rp.anyo} la renta neta media era ${nf(rp.valor)} € por persona y ${nf(rh.valor)} € por hogar. ¿Cuántas personas viven, de media, en cada hogar? (1 decimal)`, sol: rh.valor / rp.valor, dec: 1 });
    return acts;
}

function Actividades({ nombre, datos }) {
    const acts = useMemo(() => generarActividades(nombre, datos), [nombre, datos]);
    const [resp, setResp] = useState({});
    const [ver, setVer] = useState({});
    if (!acts.length) return null;
    const correcta = (a) => {
        const v = parseFloat(String(resp[a.id] ?? '').replace(',', '.'));
        if (isNaN(v)) return null;
        const tol = Math.max(Math.abs(a.sol) * 0.01, 0.6 * Math.pow(10, -a.dec));
        return Math.abs(v - a.sol) <= tol;
    };
    return (
        <Seccion titulo="✏️ Calcula con datos reales">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {acts.map((a, i) => {
                    const ok = ver[a.id] ? correcta(a) : null;
                    return (
                        <div key={a.id} style={{ background: D.bg, border: `1px solid ${ok === true ? D.green2 : ok === false ? D.red : D.border}`, borderRadius: 10, padding: 12 }}>
                            <div style={{ fontSize: '0.86rem', lineHeight: 1.5, marginBottom: 8 }}><b>{i + 1}.</b> {a.texto}</div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                <input value={resp[a.id] ?? ''} inputMode="decimal" placeholder="Tu respuesta"
                                    onChange={e => { setResp(r => ({ ...r, [a.id]: e.target.value })); setVer(v => ({ ...v, [a.id]: false })); }}
                                    onKeyDown={e => e.key === 'Enter' && setVer(v => ({ ...v, [a.id]: true }))}
                                    style={{ width: 140, padding: '7px 10px', borderRadius: 8, border: `1px solid ${D.border}`, background: D.card, color: D.text, outline: 'none' }} />
                                <button onClick={() => setVer(v => ({ ...v, [a.id]: true }))} style={BTN(D.accent)}>Comprobar</button>
                                {ok === true && <span style={{ color: D.green2, fontWeight: 700, fontSize: '0.85rem' }}>✓ ¡Correcto!</span>}
                                {ok === false && <span style={{ color: D.red, fontSize: '0.85rem' }}>✗ Solución: {nf(a.sol, a.dec)}</span>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </Seccion>
    );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ExploradorINE({ onClose }) {
    const [indice, setIndice] = useState(null);
    const [errorIndice, setErrorIndice] = useState('');
    const [q, setQ] = useState('');
    const [foco, setFoco] = useState(0);
    const [abierto, setAbierto] = useState(false);
    const [sel, setSel] = useState(null);        // [idIne, codigo, nombre]
    const [datos, setDatos] = useState(null);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState('');
    const [modoEvol, setModoEvol] = useState('abs'); // abs | indice | sexo
    const [verTabla, setVerTabla] = useState(false);
    const [copiado, setCopiado] = useState(false);
    const peticion = useRef(0);

    useEffect(() => { cargarIndice().then(setIndice).catch(e => setErrorIndice(e.message)); }, []);

    const buscables = useMemo(() => indice?.mun.map(m => ({ m, n: normal(m[2]) })) || [], [indice]);
    const resultados = useMemo(() => {
        const t = normal(q.trim());
        if (t.length < 2) return [];
        const empieza = [], contiene = [];
        for (const b of buscables) {
            // «Coruña, A» / «Rozas de Madrid, Las»: también se encuentra escribiendo «A Coruña», «Las Rozas»
            const alt = b.n.includes(', ') ? b.n.replace(/^(.*), (\S+)$/, '$2 $1') : b.n;
            if (b.n.startsWith(t) || alt.startsWith(t) || b.n.split(/[\s/-]+/).some(w => w.startsWith(t))) empieza.push(b.m);
            else if (b.n.includes(t) || alt.includes(t)) contiene.push(b.m);
            if (empieza.length >= 15) break;
        }
        return [...empieza, ...contiene].slice(0, 15);
    }, [q, buscables]);

    const provDe = (m) => indice?.prov[m[1].slice(0, 2)];

    const elegir = async (m) => {
        const id = ++peticion.current;
        setSel(m); setQ(''); setAbierto(false); setDatos(null); setError(''); setCargando(true); setVerTabla(false);
        try {
            const d = await cargarMunicipio(m, provDe(m));
            if (id !== peticion.current) return;
            if (!d.total.length) throw new Error('El INE no ha devuelto datos de población para este municipio.');
            setDatos(d);
        } catch (e) {
            if (id === peticion.current) setError(e.message === 'Failed to fetch' ? 'No se pudo conectar con el INE. Revisa la conexión o inténtalo más tarde.' : e.message);
        }
        if (id === peticion.current) setCargando(false);
    };

    const elegirPorNombre = (nombre) => {
        const n = normal(nombre);
        const m = indice?.mun.find(x => normal(x[2]) === n && x[1].slice(0, 2) === sel?.[1].slice(0, 2));
        if (m) elegir(m); else { setQ(nombre); setAbierto(true); }
    };

    const copiarCSV = () => {
        const filas = [['Año', 'Total', 'Hombres', 'Mujeres']];
        for (const p of datos.total) filas.push([p.anyo, p.valor, datos.hombres.find(h => h.anyo === p.anyo)?.valor ?? '', datos.mujeres.find(h => h.anyo === p.anyo)?.valor ?? '']);
        navigator.clipboard?.writeText(filas.map(f => f.join(';')).join('\n')).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1800); });
    };

    const prov = sel && provDe(sel);
    const ult = datos?.total.at(-1);
    const prev = datos?.total.at(-2);
    const primero = datos?.total[0];
    const h = datos?.hombres.at(-1), mu = datos?.mujeres.at(-1);
    const zona = datos?.zona;

    // Municipios de tamaño parecido en la provincia (5 por encima y 5 por debajo)
    const vecinos = useMemo(() => {
        if (!zona || zona.pos < 0) return [];
        const a = Math.max(0, zona.pos - 5), b = Math.min(zona.lista.length, zona.pos + 6);
        return zona.lista.slice(a, b).map((x, i) => ({ ...x, puesto: a + i + 1 }));
    }, [zona]);

    // Evolución indexada (año base = 100) para comparar municipio y provincia en un mismo eje
    const indexada = (serie, base) => {
        const b = serie.find(p => p.anyo === base)?.valor;
        return b ? serie.filter(p => p.anyo >= base).map(p => ({ anyo: p.anyo, valor: p.valor / b * 100 })) : [];
    };
    const anyoBase = datos && zona?.historia?.length ? Math.max(datos.total[0].anyo, zona.historia[0].anyo) : null;

    const ultV = (s) => s?.at(-1);
    const tileUlt = (s, dec, suf = '') => { const p = ultV(s); return p ? `${nf(p.valor, dec)}${suf}` : '—'; };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: D.bg, color: D.text, overflowY: 'auto', fontFamily: "'Segoe UI',sans-serif" }}>
            {/* Cabecera */}
            <div style={{ position: 'sticky', top: 0, zIndex: 5, padding: '12px 16px', background: D.card, borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={onClose} style={{ background: 'transparent', border: `1px solid ${D.border}`, color: D.muted, padding: '6px 12px', borderRadius: 7, cursor: 'pointer' }}>← Volver</button>
                <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>🇪🇸 Datos reales del INE</span>
                <span style={{ fontSize: '0.75rem', color: D.muted }}>Explora tu municipio y su provincia</span>
            </div>

            <div style={{ maxWidth: 980, margin: '0 auto', padding: '18px 16px 40px', boxSizing: 'border-box' }}>
                {/* Buscador */}
                <div style={{ position: 'relative', marginBottom: 18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: D.card, border: `2px solid ${abierto && resultados.length ? D.accent : D.border}`, borderRadius: 12, padding: '10px 14px' }}>
                        <Search size={18} color={D.muted} />
                        <input autoFocus value={q} placeholder={indice ? `Busca entre ${nf(indice.mun.length)} municipios… (p. ej. Huesca, Jaca, Las Rozas)` : 'Cargando municipios…'}
                            disabled={!indice}
                            onChange={e => { setQ(e.target.value); setAbierto(true); setFoco(0); }}
                            onFocus={() => setAbierto(true)}
                            onBlur={() => setTimeout(() => setAbierto(false), 150)}
                            onKeyDown={e => {
                                if (e.key === 'ArrowDown') { e.preventDefault(); setFoco(f => Math.min(f + 1, resultados.length - 1)); }
                                else if (e.key === 'ArrowUp') { e.preventDefault(); setFoco(f => Math.max(f - 1, 0)); }
                                else if (e.key === 'Enter' && resultados[foco]) elegir(resultados[foco]);
                                else if (e.key === 'Escape') setAbierto(false);
                            }}
                            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: D.text, fontSize: '1rem', minWidth: 0 }} />
                        {q && <button onClick={() => setQ('')} style={{ background: 'none', border: 'none', color: D.muted, cursor: 'pointer', display: 'flex' }}><X size={16} /></button>}
                    </div>
                    {abierto && resultados.length > 0 && (
                        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: D.card, border: `1px solid ${D.border}`, borderRadius: 12, overflow: 'hidden', zIndex: 10, boxShadow: '0 12px 40px rgba(0,0,0,0.5)', maxHeight: 380, overflowY: 'auto' }}>
                            {resultados.map((m, i) => (
                                <button key={m[0]} onMouseDown={e => { e.preventDefault(); elegir(m); }} onMouseEnter={() => setFoco(i)}
                                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', border: 'none', borderBottom: `1px solid ${D.border}`, background: i === foco ? D.dark2 : 'transparent', color: D.text, cursor: 'pointer', textAlign: 'left', fontSize: '0.92rem' }}>
                                    <span><MapPin size={13} color={D.accent} style={{ marginRight: 6, verticalAlign: -2 }} />{m[2]}</span>
                                    <span style={{ color: D.muted, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{provDe(m)?.n}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    {abierto && q.trim().length >= 2 && indice && !resultados.length && (
                        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, ...CARD, padding: 12, color: D.muted, fontSize: '0.85rem', zIndex: 10 }}>No hay ningún municipio con ese nombre.</div>
                    )}
                </div>
                {errorIndice && <div style={{ color: D.red, marginBottom: 12 }}>{errorIndice}</div>}

                {/* Estado inicial */}
                {!sel && (
                    <div style={{ ...CARD, textAlign: 'center', padding: '36px 20px' }}>
                        <div style={{ fontSize: 46, marginBottom: 8 }}>🏘️</div>
                        <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 6 }}>Escribe el nombre de una población</div>
                        <div style={{ color: D.muted, fontSize: '0.88rem', lineHeight: 1.6, maxWidth: 560, margin: '0 auto' }}>
                            Verás su evolución de población desde 1996, hombres y mujeres, edad media, renta de los hogares, desigualdad (Gini)
                            y cómo se sitúa dentro de su provincia. Todo se descarga en directo del Instituto Nacional de Estadística.
                        </div>
                    </div>
                )}

                {sel && (
                    <>
                        {/* Ficha */}
                        <div style={{ ...CARD, borderLeft: `4px solid ${D.accent}`, marginBottom: 14, display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                            <div>
                                <div style={{ fontSize: '0.72rem', color: D.muted, fontWeight: 700, letterSpacing: 0.5 }}>MUNICIPIO · CÓDIGO INE {sel[1]}</div>
                                <div style={{ fontSize: '1.6rem', fontWeight: 800, margin: '2px 0' }}>{sel[2]}</div>
                                <div style={{ color: D.muted, fontSize: '0.88rem' }}>{prov?.n}{prov?.ccaa && prov.ccaa !== prov.n ? ` · ${prov.ccaa}` : ''}</div>
                            </div>
                            {ult && (
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '2rem', fontWeight: 800, color: D.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{nf(ult.valor)}</div>
                                    <div style={{ fontSize: '0.78rem', color: D.muted, marginTop: 4 }}>habitantes a 1 de enero de {ult.anyo}
                                        {prev && <> · <span style={{ color: ult.valor >= prev.valor ? D.green2 : D.red }}>{signo(pct(ult.valor, prev.valor))}</span> vs {prev.anyo}</>}
                                    </div>
                                </div>
                            )}
                        </div>

                        {cargando && (
                            <div style={{ ...CARD, textAlign: 'center', color: D.muted, padding: 30 }}>
                                <div style={{ fontSize: 30, marginBottom: 6 }}>⏳</div>Consultando al INE…
                            </div>
                        )}
                        {error && <div style={{ ...CARD, color: D.red, borderColor: D.red }}>{error}</div>}

                        {datos && (
                            <>
                                {/* Indicadores clave */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10, marginBottom: 14 }}>
                                    {h && mu && <Tile titulo="Mujeres" valor={nf(mu.valor)} detalle={`${nf(mu.valor / (h.valor + mu.valor) * 100, 1)} % · ${nf(h.valor)} hombres`} />}
                                    {primero && ult && <Tile titulo={`Variación desde ${primero.anyo}`} valor={signo(pct(ult.valor, primero.valor))} color={ult.valor >= primero.valor ? D.green2 : D.red} detalle={`${nf(primero.valor)} → ${nf(ult.valor)}`} />}
                                    {zona?.pos >= 0 && <Tile titulo={`Puesto en ${prov?.n}`} valor={`${zona.pos + 1}.º de ${nf(zona.nMunicipios)}`} detalle={`${nf(ult.valor / zona.total * 100, 2)} % de la provincia`} />}
                                    {datos.demo?.edad?.length > 0 && <Tile titulo="Edad media" valor={tileUlt(datos.demo.edad, 1, ' años')} detalle={`Dato de ${ultV(datos.demo.edad).anyo}`} />}
                                    {datos.renta?.persona?.length > 0 && <Tile titulo="Renta neta / persona" valor={tileUlt(datos.renta.persona, 0, ' €')} detalle={`Por hogar: ${tileUlt(datos.renta.hogar, 0, ' €')}`} />}
                                    {datos.gini?.gini?.length > 0 && <Tile titulo="Índice de Gini" valor={tileUlt(datos.gini.gini, 1)} detalle="0 = igualdad total · 100 = máxima desigualdad" />}
                                </div>

                                {/* Evolución de la población */}
                                <Seccion titulo={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><IconoLinea size={16} color={D.accent} /> Evolución de la población</span>}
                                    extra={
                                        <div style={{ display: 'flex', gap: 4, background: D.bg, borderRadius: 8, padding: 3, border: `1px solid ${D.border}` }}>
                                            {[['abs', 'Total'], ['sexo', 'Por sexo'], ...(anyoBase ? [['indice', 'Vs. provincia']] : [])].map(([k, l]) => (
                                                <button key={k} onClick={() => setModoEvol(k)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, background: modoEvol === k ? D.accent : 'transparent', color: modoEvol === k ? 'white' : D.muted }}>{l}</button>
                                            ))}
                                        </div>
                                    }>
                                    {modoEvol === 'abs' && <GraficoLineas series={[{ nombre: 'Habitantes', color: D.s1, puntos: datos.total }]} unidad=" hab." />}
                                    {modoEvol === 'sexo' && <GraficoLineas series={[{ nombre: 'Hombres', color: D.s1, puntos: datos.hombres }, { nombre: 'Mujeres', color: D.s2, puntos: datos.mujeres }]} />}
                                    {modoEvol === 'indice' && anyoBase && (
                                        <>
                                            <div style={{ fontSize: '0.78rem', color: D.muted, marginBottom: 6 }}>Índice con base {anyoBase} = 100: compara cuánto ha crecido o menguado cada uno, aunque tengan tamaños muy distintos.</div>
                                            <GraficoLineas formato={v => nf(v, 1)} series={[
                                                { nombre: sel[2], color: D.s1, puntos: indexada(datos.total, anyoBase) },
                                                { nombre: `Provincia de ${prov?.n}`, color: D.s2, puntos: indexada(zona.historia, anyoBase) },
                                            ]} />
                                        </>
                                    )}
                                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                                        <button onClick={() => setVerTabla(v => !v)} style={BTN(D.dark2, D.text)}><Table2 size={14} />{verTabla ? 'Ocultar tabla' : 'Ver tabla'}</button>
                                        <button onClick={copiarCSV} style={BTN(D.dark2, D.text)}>{copiado ? <><CheckCircle size={14} color={D.green2} />Copiado</> : <><Copy size={14} />Copiar datos (hoja de cálculo)</>}</button>
                                    </div>
                                    {verTabla && (
                                        <div style={{ overflowX: 'auto', marginTop: 10, maxHeight: 320, overflowY: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', fontVariantNumeric: 'tabular-nums' }}>
                                                <thead><tr>{['Año', 'Total', 'Hombres', 'Mujeres', 'Variación'].map(c => <th key={c} style={{ position: 'sticky', top: 0, background: D.dark2, padding: '6px 10px', textAlign: c === 'Año' ? 'left' : 'right', color: D.muted }}>{c}</th>)}</tr></thead>
                                                <tbody>
                                                    {[...datos.total].reverse().map((p, i, arr) => (
                                                        <tr key={p.anyo} style={{ borderBottom: `1px solid ${D.border}` }}>
                                                            <td style={{ padding: '5px 10px' }}>{p.anyo}</td>
                                                            <td style={{ padding: '5px 10px', textAlign: 'right' }}>{nf(p.valor)}</td>
                                                            <td style={{ padding: '5px 10px', textAlign: 'right' }}>{nf(datos.hombres.find(x => x.anyo === p.anyo)?.valor)}</td>
                                                            <td style={{ padding: '5px 10px', textAlign: 'right' }}>{nf(datos.mujeres.find(x => x.anyo === p.anyo)?.valor)}</td>
                                                            <td style={{ padding: '5px 10px', textAlign: 'right', color: D.muted }}>{arr[i + 1] ? signo(pct(p.valor, arr[i + 1].valor)) : ''}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </Seccion>

                                {/* Zona: provincia */}
                                {zona && (
                                    <Seccion titulo={`📍 La zona: provincia de ${prov?.n}`}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10, marginBottom: 14 }}>
                                            <Tile titulo="Habitantes de la provincia" valor={nf(zona.total)} />
                                            <Tile titulo="Municipios" valor={nf(zona.nMunicipios)} />
                                            <Tile titulo="Media por municipio" valor={nf(zona.total / zona.nMunicipios)} detalle="habitantes" />
                                            <Tile titulo="Mediana por municipio" valor={nf(zona.lista[Math.floor(zona.lista.length / 2)]?.valor)} detalle="¿por qué es tan distinta de la media?" />
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 18 }}>
                                            <div>
                                                <div style={{ fontSize: '0.8rem', color: D.muted, marginBottom: 8 }}>Los 5 municipios más poblados</div>
                                                <BarrasH filas={zona.lista.slice(0, 5)} destacar={zona.lista[zona.pos]?.nombre} />
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.8rem', color: D.muted, marginBottom: 8 }}>Municipios de tamaño parecido (pulsa uno para verlo)</div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                    {vecinos.map(v => {
                                                        const yo = v.cod === zona.lista[zona.pos]?.cod;
                                                        return (
                                                            <button key={v.cod} disabled={yo} onClick={() => elegirPorNombre(v.nombre)}
                                                                style={{ display: 'grid', gridTemplateColumns: '38px 1fr auto', gap: 8, padding: '5px 8px', borderRadius: 6, border: 'none', background: yo ? D.dark2 : 'transparent', color: yo ? D.text : D.muted, fontWeight: yo ? 700 : 400, cursor: yo ? 'default' : 'pointer', textAlign: 'left', fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>
                                                                <span>{v.puesto}.º</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.nombre}</span><span style={{ color: D.text }}>{nf(v.valor)}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </Seccion>
                                )}

                                {/* Demografía (Atlas de renta) */}
                                {datos.demo && (
                                    <Seccion titulo="👪 Hogares y edades">
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10 }}>
                                            <Tile titulo="Menores de 18 años" valor={tileUlt(datos.demo.menores, 1, ' %')} />
                                            <Tile titulo="65 años o más" valor={tileUlt(datos.demo.mayores, 1, ' %')} />
                                            <Tile titulo="Población española" valor={tileUlt(datos.demo.espanola, 1, ' %')} />
                                            <Tile titulo="Personas por hogar" valor={tileUlt(datos.demo.hogar, 1)} />
                                            <Tile titulo="Hogares de una persona" valor={tileUlt(datos.demo.unipersonales, 1, ' %')} />
                                        </div>
                                        {ultV(datos.demo.edad) && <div style={{ fontSize: '0.72rem', color: D.muted, marginTop: 8 }}>Datos de {ultV(datos.demo.edad).anyo} (Atlas de distribución de renta de los hogares).</div>}
                                    </Seccion>
                                )}

                                {/* Renta */}
                                {datos.renta?.persona?.length > 0 && (
                                    <Seccion titulo="💶 Renta de los hogares">
                                        <GraficoLineas formato={v => `${nf(v)} €`} series={[
                                            { nombre: 'Renta neta media por persona', color: D.s1, puntos: datos.renta.persona },
                                            { nombre: 'Mediana por unidad de consumo', color: D.s2, puntos: datos.renta.mediana },
                                        ]} />
                                        {datos.fuente?.some(f => f.valor != null) && (
                                            <div style={{ marginTop: 16 }}>
                                                <div style={{ fontSize: '0.8rem', color: D.muted, marginBottom: 8 }}>¿De dónde vienen los ingresos? (% de la renta bruta, {datos.fuente.find(f => f.anyo)?.anyo})</div>
                                                <BarrasH filas={datos.fuente} formato={v => `${nf(v, 1)} %`} />
                                                {datos.fuente.some(f => f.valor == null) && <div style={{ fontSize: '0.72rem', color: D.muted, marginTop: 6 }}>«—»: el INE no publica el dato en municipios pequeños (secreto estadístico).</div>}
                                            </div>
                                        )}
                                        {datos.gini?.gini?.length > 0 && (
                                            <div style={{ fontSize: '0.8rem', color: D.muted, marginTop: 14, lineHeight: 1.6 }}>
                                                <b style={{ color: D.text }}>Desigualdad:</b> índice de Gini {tileUlt(datos.gini.gini, 1)}
                                                {ultV(datos.gini.p8020) && <> · ratio P80/P20 {tileUlt(datos.gini.p8020, 1)} (el 20 % más rico ingresa {tileUlt(datos.gini.p8020, 1)} veces más que el 20 % más pobre)</>}.
                                            </div>
                                        )}
                                    </Seccion>
                                )}

                                <Actividades nombre={sel[2]} datos={datos} />

                                {datos.errores > 0 && <div style={{ fontSize: '0.78rem', color: D.gold, marginBottom: 10 }}>⚠ Algunos bloques no se pudieron descargar del INE; vuelve a buscar el municipio para reintentarlo.</div>}
                            </>
                        )}
                    </>
                )}

                <div style={{ fontSize: '0.72rem', color: D.muted, marginTop: 18, lineHeight: 1.6, textAlign: 'center' }}>
                    Fuente: <a href="https://www.ine.es" target="_blank" rel="noreferrer" style={{ color: D.accent }}>Instituto Nacional de Estadística <ExternalLink size={10} /></a> —
                    Cifras oficiales de población (Padrón municipal) y Atlas de distribución de renta de los hogares.
                </div>
            </div>
        </div>
    );
}
