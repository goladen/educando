// ExploradorINE.jsx — Datos reales del INE de municipios, provincias, comunidades y España.
// Se abre desde Estadística (/estadistica?ine=…) y desde Geografía (/?juego=geografia&ine=…).
// · Un lugar  → ficha completa (población, superficie y densidad, edades, renta, zona…).
// · Dos lugares → comparativa (tabla, barras pareadas, evolución indexada, pirámides).
// La selección vive en la URL (?ine=m22125,p50) para poder compartirla. Datos: ./ineDatos.js
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, ExternalLink, Table2, Copy, CheckCircle, Share2, Scale, ArrowLeftRight, LineChart as IconoLinea } from 'lucide-react';
import { cargarIndice, buscarLugares, cargarLugar, leerClavesUrl, escribirClavesUrl, nombreNatural, TIPOS, tipoDe } from './ineDatos';
import { D, nf, GraficoLineas, BarrasH, Piramide, BarrasPareadas } from './ineGraficos';

const CARD = { background: D.card, borderRadius: 14, padding: 18, border: `1px solid ${D.border}` };
const BTN = (bg, col = 'white') => ({ padding: '8px 14px', borderRadius: 9, border: 'none', background: bg, color: col, fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: 6 });
const COLORES = [D.s1, D.s2];

const pct = (a, b) => b ? (a - b) / b * 100 : null;
const signo = (v, dec = 1, suf = ' %') => v == null || isNaN(v) ? '—' : `${v > 0 ? '+' : ''}${nf(v, dec)}${suf}`;
const ult = s => s?.[s.length - 1] || null;

// Indicadores comparables de una ficha (cualquier tipo de lugar)
function indicadores(f) {
    const p = ult(f.total), h = ult(f.hombres), m = ult(f.mujeres);
    const hace10 = f.total.find(x => x.anyo === p?.anyo - 10);
    return {
        pob: p, area: f.area,
        densidad: p && f.area ? p.valor / f.area : null,
        pctMujeres: h && m ? m.valor / (h.valor + m.valor) * 100 : null,
        var10: p && hace10 ? { valor: pct(p.valor, hace10.valor), desde: hace10.anyo, hasta: p.anyo } : null,
        edadMedia: f.edades?.edadMedia ?? null, menores: f.edades?.menores ?? null, mayores: f.edades?.mayores ?? null, anyoEdades: f.edades?.anyo,
        espanola: f.espanola?.valor ?? null, fechaEspanola: f.espanola?.fecha,
        renta: ult(f.renta?.persona), gini: ult(f.gini?.gini), hogar: f.hogar?.tam ?? null,
    };
}

// Lugares «contenedores» con los que tiene sentido comparar rápidamente
function contenedores(idx, clave) {
    const t = tipoDe(clave), out = [];
    // Las comunidades uniprovinciales (Madrid, Asturias, Murcia…) dan casi lo mismo que su provincia
    const conCcaa = c => c && idx.ccaa[c]?.nProv > 1 && out.push({ clave: `c${c}`, txt: `su comunidad (${nombreNatural(idx.ccaa[c].n)})` });
    if (t === 'm') {
        const p = clave.slice(1, 3);
        out.push({ clave: `p${p}`, txt: `su provincia (${nombreNatural(idx.prov[p].n)})` });
        conCcaa(idx.prov[p].ccaa);
    }
    if (t === 'p') conCcaa(idx.prov[clave.slice(1)].ccaa);
    if (t !== 'es') out.push({ clave: 'es', txt: 'España' });
    return out;
}

// ─── Piezas de interfaz ──────────────────────────────────────────────────────
function Tile({ titulo, valor, detalle, color }) {
    return (
        <div style={{ ...CARD, padding: '12px 14px' }}>
            <div style={{ fontSize: '0.72rem', color: D.muted, fontWeight: 600, marginBottom: 4 }}>{titulo}</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: color || D.text, fontVariantNumeric: 'tabular-nums' }}>{valor}</div>
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

const Rejilla = ({ children, min = 150 }) => (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill,minmax(${min}px,1fr))`, gap: 10, marginBottom: 14 }}>{children}</div>
);

function Pestanas({ valor, opciones, onCambio }) {
    return (
        <div style={{ display: 'flex', gap: 4, background: D.bg, borderRadius: 8, padding: 3, border: `1px solid ${D.border}`, flexWrap: 'wrap' }}>
            {opciones.map(([k, l]) => (
                <button key={k} onClick={() => onCambio(k)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, background: valor === k ? D.accent : 'transparent', color: valor === k ? 'white' : D.muted }}>{l}</button>
            ))}
        </div>
    );
}

const Chip = ({ clave }) => {
    const t = TIPOS[tipoDe(clave)];
    return <span style={{ fontSize: '0.68rem', fontWeight: 700, color: D.muted, border: `1px solid ${D.border}`, borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap' }}>{t.emoji} {t.nombre}</span>;
};

// ─── Actividades con datos reales ────────────────────────────────────────────
function Actividades({ acts, titulo = '✏️ Calcula con datos reales' }) {
    const [resp, setResp] = useState({});
    const [ver, setVer] = useState({});
    if (!acts.length) return null;
    const correcta = (a) => {
        const v = parseFloat(String(resp[a.id] ?? '').replace(/\./g, '').replace(',', '.'));
        const v2 = parseFloat(String(resp[a.id] ?? '').replace(',', '.'));
        const ok = x => !isNaN(x) && Math.abs(x - a.sol) <= Math.max(Math.abs(a.sol) * 0.01, 0.6 * Math.pow(10, -a.dec));
        if (isNaN(v) && isNaN(v2)) return null;
        return ok(v2) || ok(v); // admite «1.234,5» y «1234.5»
    };
    return (
        <Seccion titulo={titulo}>
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
                                    style={{ width: 150, padding: '7px 10px', borderRadius: 8, border: `1px solid ${D.border}`, background: D.card, color: D.text, outline: 'none' }} />
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

function actividadesFicha(f) {
    const acts = [], n = f.nat, t = f.total, I = indicadores(f);
    if (t.length >= 11) {
        const a = t[t.length - 1], b = t[t.length - 11];
        acts.push({ id: 'var', texto: `La población de ${n} era ${nf(b.valor)} habitantes en ${b.anyo} y ${nf(a.valor)} en ${a.anyo}. ¿Cuál ha sido la variación porcentual? (en %, con 1 decimal)`, sol: pct(a.valor, b.valor), dec: 1 });
    }
    if (I.pob && f.area) acts.push({ id: 'dens', texto: `${n} tiene ${nf(I.pob.valor)} habitantes y una superficie de ${nf(f.area, 2)} km². Calcula su densidad de población (hab/km², 1 decimal).`, sol: I.densidad, dec: 1 });
    if (t.length >= 5) {
        const u5 = t.slice(-5);
        acts.push({ id: 'media', texto: `Calcula la media de la población de los años ${u5[0].anyo}–${u5[4].anyo}: ${u5.map(p => nf(p.valor)).join(' · ')}`, sol: u5.reduce((s, p) => s + p.valor, 0) / 5, dec: 1 });
    }
    const h = ult(f.hombres), m = ult(f.mujeres);
    if (h && m) acts.push({ id: 'muj', texto: `En ${m.anyo} había ${nf(h.valor)} hombres y ${nf(m.valor)} mujeres. ¿Qué porcentaje de la población son mujeres?`, sol: I.pctMujeres, dec: 1 });
    if (f.zona?.total && I.pob) acts.push({ id: 'prov', texto: `La provincia tiene ${nf(f.zona.total)} habitantes. ¿Qué porcentaje de la población provincial vive en ${n}? (${nf(I.pob.valor)} hab.)`, sol: I.pob.valor / f.zona.total * 100, dec: 2 });
    const rp = ult(f.renta?.persona), rh = ult(f.renta?.hogar);
    if (rp && rh) acts.push({ id: 'hogar', texto: `En ${rp.anyo} la renta neta media era ${nf(rp.valor)} € por persona y ${nf(rh.valor)} € por hogar. ¿Cuántas personas viven, de media, en cada hogar? (1 decimal)`, sol: rh.valor / rp.valor, dec: 1 });
    if (f.hijos?.lista?.length >= 2 && I.pob) {
        const h1 = f.hijos.lista[0];
        acts.push({ id: 'hijo', texto: `${nombreNatural(h1.nombre)} tiene ${nf(h1.valor)} habitantes y ${n} ${nf(I.pob.valor)}. ¿Qué porcentaje del total representa ${nombreNatural(h1.nombre)}? (2 decimales)`, sol: h1.valor / I.pob.valor * 100, dec: 2 });
    }
    return acts;
}

function actividadesComparativa(fa, fb) {
    const A = indicadores(fa), B = indicadores(fb), na = fa.nat, nb = fb.nat, acts = [];
    if (A.pob && B.pob) acts.push({ id: 'dif', texto: `${na} tiene ${nf(A.pob.valor)} habitantes y ${nb} ${nf(B.pob.valor)}. ¿Cuántos habitantes de diferencia hay entre los dos?`, sol: Math.abs(A.pob.valor - B.pob.valor), dec: 0 });
    if (A.densidad && B.densidad) {
        const [mx, mn, nmx, nmn] = A.densidad >= B.densidad ? [A.densidad, B.densidad, na, nb] : [B.densidad, A.densidad, nb, na];
        acts.push({ id: 'ratio', texto: `La densidad de ${nmx} es ${nf(mx, 1)} hab/km² y la de ${nmn} ${nf(mn, 1)} hab/km². ¿Cuántas veces mayor es la densidad de ${nmx}? (1 decimal)`, sol: mx / mn, dec: 1 });
    }
    if (B.pob && fb.area) acts.push({ id: 'densB', texto: `Calcula la densidad de ${nb}: ${nf(B.pob.valor)} habitantes en ${nf(fb.area, 2)} km² (hab/km², 1 decimal).`, sol: B.densidad, dec: 1 });
    if (A.edadMedia != null && B.edadMedia != null) acts.push({ id: 'edad', texto: `La edad media en ${na} es ${nf(A.edadMedia, 1)} años y en ${nb} ${nf(B.edadMedia, 1)}. ¿Cuántos años de diferencia hay? (1 decimal)`, sol: Math.abs(A.edadMedia - B.edadMedia), dec: 1 });
    if (A.var10 && B.var10) acts.push({ id: 'var', texto: `Entre ${A.var10.desde} y ${A.var10.hasta}, ${na} varió un ${nf(A.var10.valor, 1)} % y ${nb} un ${nf(B.var10.valor, 1)} %. ¿Cuántos puntos porcentuales de diferencia hay? (1 decimal)`, sol: Math.abs(A.var10.valor - B.var10.valor), dec: 1 });
    return acts;
}

// ─── Compartir ───────────────────────────────────────────────────────────────
function ModalCompartir({ url, titulo, onClose }) {
    const [copiado, setCopiado] = useState(false);
    const texto = encodeURIComponent(`📊 ${titulo}\n${url}`);
    const copiar = () => { navigator.clipboard?.writeText(url).catch(() => {}); setCopiado(true); setTimeout(() => setCopiado(false), 2000); };
    const ops = [
        { l: copiado ? 'Copiado' : 'Copiar enlace', i: copiado ? '✅' : '🔗', a: copiar },
        { l: 'WhatsApp', i: '💬', a: () => window.open(`https://wa.me/?text=${texto}`, '_blank') },
        { l: 'Telegram', i: '✈️', a: () => window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(titulo)}`, '_blank') },
        { l: 'Correo', i: '📧', a: () => window.open(`mailto:?subject=${encodeURIComponent(titulo)}&body=${texto}`, '_blank') },
        { l: 'Google Classroom', i: '🎓', a: () => window.open(`https://classroom.google.com/share?url=${encodeURIComponent(url)}`, '_blank') },
    ];
    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9100, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ ...CARD, width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <b>Compartir: {titulo}</b>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: D.muted, cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                    <img alt="Código QR del enlace" width={110} height={110} style={{ borderRadius: 8, background: 'white', flexShrink: 0 }}
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=0d1117&margin=8`} />
                    <div style={{ fontSize: '0.75rem', color: D.muted, wordBreak: 'break-all', background: D.bg, borderRadius: 8, padding: '8px 10px', border: `1px solid ${D.border}` }}>{url}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {ops.map(o => (
                        <button key={o.l} onClick={o.a} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, border: `1px solid ${D.border}`, background: D.bg, color: D.text, cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600, textAlign: 'left' }}>
                            <span style={{ width: 22, textAlign: 'center' }}>{o.i}</span>{o.l}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Ficha de un lugar ───────────────────────────────────────────────────────
function Ficha({ f, idx, onElegir, onComparar }) {
    const [modoEvol, setModoEvol] = useState('abs');
    const [verTabla, setVerTabla] = useState(false);
    const [verTodos, setVerTodos] = useState(false);
    const [copiado, setCopiado] = useState(false);
    const I = indicadores(f);
    const primero = f.total[0], prev = f.total[f.total.length - 2];
    const zona = f.zona;
    const acts = useMemo(() => actividadesFicha(f), [f]);

    const vecinos = useMemo(() => {
        if (!zona || zona.pos < 0) return [];
        const a = Math.max(0, zona.pos - 5), b = Math.min(zona.lista.length, zona.pos + 6);
        return zona.lista.slice(a, b).map((x, i) => ({ ...x, puesto: a + i + 1 }));
    }, [zona]);

    const indexada = (serie, base) => {
        const b = serie.find(p => p.anyo === base)?.valor;
        return b ? serie.filter(p => p.anyo >= base).map(p => ({ anyo: p.anyo, valor: p.valor / b * 100 })) : [];
    };
    const anyoBase = zona?.historia?.length ? Math.max(f.total[0].anyo, zona.historia[0].anyo) : null;

    const copiarCSV = () => {
        const filas = [['Año', 'Total', 'Hombres', 'Mujeres']];
        for (const p of f.total) filas.push([p.anyo, p.valor, f.hombres.find(h => h.anyo === p.anyo)?.valor ?? '', f.mujeres.find(h => h.anyo === p.anyo)?.valor ?? '']);
        navigator.clipboard?.writeText(filas.map(x => x.join(';')).join('\n')).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1800); });
    };

    const hijos = f.hijos;
    const listaHijos = hijos ? (verTodos ? hijos.lista : hijos.lista.slice(0, 10)) : [];
    const sumaHijos = hijos?.lista.reduce((s, x) => s + x.valor, 0);

    return (
        <>
            {/* Cabecera */}
            <div style={{ ...CARD, borderLeft: `4px solid ${D.accent}`, marginBottom: 14, display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Chip clave={f.clave} />
                        {f.tipo === 'm' && <span style={{ fontSize: '0.7rem', color: D.muted }}>Código INE {f.clave.slice(1)}</span>}
                    </div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, margin: '4px 0 2px' }}>{f.nat}</div>
                    <div style={{ color: D.muted, fontSize: '0.88rem' }}>{f.sub}</div>
                </div>
                {I.pob && (
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{nf(I.pob.valor)}</div>
                        <div style={{ fontSize: '0.78rem', color: D.muted, marginTop: 4 }}>habitantes a 1 de enero de {I.pob.anyo}
                            {prev && <> · <span style={{ color: I.pob.valor >= prev.valor ? D.green2 : D.red }}>{signo(pct(I.pob.valor, prev.valor))}</span> vs {prev.anyo}</>}
                        </div>
                    </div>
                )}
            </div>

            {/* Comparar rápido */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: '0.78rem', color: D.muted, marginRight: 2 }}><Scale size={13} style={{ verticalAlign: -2 }} /> Comparar con:</span>
                {contenedores(idx, f.clave).map(c => (
                    <button key={c.clave} onClick={() => onComparar(c.clave)} style={{ ...BTN(D.dark2, D.text), padding: '5px 10px', fontWeight: 600, border: `1px solid ${D.border}` }}>{c.txt}</button>
                ))}
                <button onClick={() => onComparar(null)} style={{ ...BTN('transparent', D.accent), padding: '5px 10px', border: `1px dashed ${D.accent}` }}>otro lugar…</button>
            </div>

            {/* Indicadores clave */}
            <Rejilla>
                {f.area && <Tile titulo="Superficie" valor={`${nf(f.area, f.area < 100 ? 2 : 0)} km²`} detalle="Eurostat · LAU 2024" />}
                {I.densidad != null && <Tile titulo="Densidad de población" valor={`${nf(I.densidad, I.densidad < 100 ? 1 : 0)} hab/km²`} detalle="habitantes por kilómetro cuadrado" />}
                {I.pctMujeres != null && <Tile titulo="Mujeres" valor={`${nf(I.pctMujeres, 1)} %`} detalle={`${nf(ult(f.mujeres).valor)} mujeres · ${nf(ult(f.hombres).valor)} hombres`} />}
                {primero && I.pob && <Tile titulo={`Variación desde ${primero.anyo}`} valor={signo(pct(I.pob.valor, primero.valor))} color={I.pob.valor >= primero.valor ? D.green2 : D.red} detalle={`${nf(primero.valor)} → ${nf(I.pob.valor)}`} />}
                {zona?.pos >= 0 && <Tile titulo={`Puesto en su provincia`} valor={`${zona.pos + 1}.º de ${nf(zona.nMunicipios)}`} detalle={`${nf(I.pob.valor / zona.total * 100, 2)} % de la provincia`} />}
                {f.tipo !== 'm' && f.nMun > 1 && <Tile titulo="Municipios" valor={nf(f.nMun)} detalle={f.tipo === 'es' ? `${f.nProv} provincias · ${f.nCcaa} comunidades y ciudades autónomas` : f.nProv > 1 ? `${f.nProv} provincias` : null} />}
                {I.edadMedia != null && <Tile titulo="Edad media" valor={`${nf(I.edadMedia, 1)} años`} detalle={`Dato de ${I.anyoEdades}`} />}
                {I.espanola != null && <Tile titulo="Población española" valor={`${nf(I.espanola, 1)} %`} detalle={`Extranjera: ${nf(100 - I.espanola, 1)} % · ${f.espanola.fecha}`} />}
                {I.renta && <Tile titulo="Renta neta / persona" valor={`${nf(I.renta.valor)} €`} detalle={`Dato de ${I.renta.anyo}`} />}
                {I.gini && <Tile titulo="Índice de Gini" valor={nf(I.gini.valor, 1)} detalle="0 = igualdad total · 100 = máxima desigualdad" />}
            </Rejilla>

            {/* Evolución */}
            <Seccion titulo={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><IconoLinea size={16} color={D.accent} /> Evolución de la población</span>}
                extra={<Pestanas valor={modoEvol} onCambio={setModoEvol} opciones={[['abs', 'Total'], ['sexo', 'Por sexo'], ...(anyoBase ? [['indice', 'Vs. provincia']] : [])]} />}>
                {modoEvol === 'abs' && <GraficoLineas series={[{ nombre: 'Habitantes', color: D.s1, puntos: f.total }]} unidad=" hab." />}
                {modoEvol === 'sexo' && <GraficoLineas series={[{ nombre: 'Hombres', color: D.s1, puntos: f.hombres }, { nombre: 'Mujeres', color: D.s2, puntos: f.mujeres }]} />}
                {modoEvol === 'indice' && anyoBase && (
                    <>
                        <div style={{ fontSize: '0.78rem', color: D.muted, marginBottom: 6 }}>Índice con base {anyoBase} = 100: compara cuánto ha crecido o menguado cada uno aunque tengan tamaños muy distintos.</div>
                        <GraficoLineas formato={v => nf(v, 1)} series={[
                            { nombre: f.nat, color: D.s1, puntos: indexada(f.total, anyoBase) },
                            { nombre: 'Su provincia', color: D.s2, puntos: indexada(zona.historia, anyoBase) },
                        ]} />
                    </>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button onClick={() => setVerTabla(v => !v)} style={BTN(D.dark2, D.text)}><Table2 size={14} />{verTabla ? 'Ocultar tabla' : 'Ver tabla'}</button>
                    <button onClick={copiarCSV} style={BTN(D.dark2, D.text)}>{copiado ? <><CheckCircle size={14} color={D.green2} />Copiado</> : <><Copy size={14} />Copiar datos (hoja de cálculo)</>}</button>
                    <span style={{ fontSize: '0.72rem', color: D.muted }}>Fuente: {f.fuentePob}</span>
                </div>
                {verTabla && (
                    <div style={{ overflowX: 'auto', marginTop: 10, maxHeight: 320, overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', fontVariantNumeric: 'tabular-nums' }}>
                            <thead><tr>{['Año', 'Total', 'Hombres', 'Mujeres', 'Variación'].map(c => <th key={c} style={{ position: 'sticky', top: 0, background: D.dark2, padding: '6px 10px', textAlign: c === 'Año' ? 'left' : 'right', color: D.muted }}>{c}</th>)}</tr></thead>
                            <tbody>
                                {[...f.total].reverse().map((p, i, arr) => (
                                    <tr key={p.anyo} style={{ borderBottom: `1px solid ${D.border}` }}>
                                        <td style={{ padding: '5px 10px' }}>{p.anyo}</td>
                                        <td style={{ padding: '5px 10px', textAlign: 'right' }}>{nf(p.valor)}</td>
                                        <td style={{ padding: '5px 10px', textAlign: 'right' }}>{nf(f.hombres.find(x => x.anyo === p.anyo)?.valor)}</td>
                                        <td style={{ padding: '5px 10px', textAlign: 'right' }}>{nf(f.mujeres.find(x => x.anyo === p.anyo)?.valor)}</td>
                                        <td style={{ padding: '5px 10px', textAlign: 'right', color: D.muted }}>{arr[i + 1] ? signo(pct(p.valor, arr[i + 1].valor)) : ''}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Seccion>

            {/* Pirámide (provincias, comunidades, España) */}
            {f.edades?.piramide && (
                <Seccion titulo={`👪 Pirámide de población (${f.edades.anyo})`}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 18, alignItems: 'start' }}>
                        <Piramide datos={f.edades.piramide} />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <Tile titulo="Menores de 18 años" valor={`${nf(f.edades.menores, 1)} %`} />
                            <Tile titulo="65 años o más" valor={`${nf(f.edades.mayores, 1)} %`} />
                            <Tile titulo="Edad media" valor={`${nf(f.edades.edadMedia, 1)} años`} />
                            <Tile titulo="Mayores por cada menor" valor={nf(f.edades.mayores / f.edades.menores, 2)} detalle="índice de envejecimiento ÷ 100" />
                        </div>
                    </div>
                </Seccion>
            )}

            {/* Hogares y edades (municipios, Atlas de renta) */}
            {f.tipo === 'm' && f.edades && (
                <Seccion titulo="👪 Hogares y edades">
                    <Rejilla>
                        <Tile titulo="Menores de 18 años" valor={`${nf(f.edades.menores, 1)} %`} />
                        <Tile titulo="65 años o más" valor={`${nf(f.edades.mayores, 1)} %`} />
                        {f.hogar && <Tile titulo="Personas por hogar" valor={nf(f.hogar.tam, 1)} />}
                        {f.hogar?.unipersonales != null && <Tile titulo="Hogares de una persona" valor={`${nf(f.hogar.unipersonales, 1)} %`} />}
                    </Rejilla>
                    <div style={{ fontSize: '0.72rem', color: D.muted }}>Datos de {f.edades.anyo} (Atlas de distribución de renta de los hogares). El INE no publica la pirámide completa por municipio.</div>
                </Seccion>
            )}

            {/* Zona (municipios) */}
            {zona && (
                <Seccion titulo={`📍 La zona: provincia de ${nombreNatural(idx.prov[f.clave.slice(1, 3)].n)}`}>
                    <Rejilla>
                        <Tile titulo="Habitantes de la provincia" valor={nf(zona.total)} detalle="Padrón" />
                        <Tile titulo="Municipios" valor={nf(zona.nMunicipios)} />
                        <Tile titulo="Media por municipio" valor={nf(zona.total / zona.nMunicipios)} detalle="habitantes" />
                        <Tile titulo="Mediana por municipio" valor={nf(zona.lista[Math.floor(zona.lista.length / 2)]?.valor)} detalle="¿por qué es tan distinta de la media?" />
                    </Rejilla>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 18 }}>
                        <div>
                            <div style={{ fontSize: '0.8rem', color: D.muted, marginBottom: 8 }}>Los 5 municipios más poblados</div>
                            <BarrasH filas={zona.lista.slice(0, 5)} destacar={zona.lista[zona.pos]?.nombre} onElegir={onElegir} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.8rem', color: D.muted, marginBottom: 8 }}>Municipios de tamaño parecido (pulsa uno para verlo)</div>
                            {vecinos.map(v => {
                                const yo = v.cod === zona.lista[zona.pos]?.cod;
                                return (
                                    <button key={v.cod} disabled={yo || !v.clave} onClick={() => onElegir(v.clave)}
                                        style={{ display: 'grid', gridTemplateColumns: '38px 1fr auto', gap: 8, width: '100%', padding: '5px 8px', borderRadius: 6, border: 'none', background: yo ? D.dark2 : 'transparent', color: yo ? D.text : D.muted, fontWeight: yo ? 700 : 400, cursor: yo ? 'default' : 'pointer', textAlign: 'left', fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>
                                        <span>{v.puesto}.º</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.nombre}</span><span style={{ color: D.text }}>{nf(v.valor)}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </Seccion>
            )}

            {/* Hijos (provincias, comunidades, España) */}
            {hijos?.lista?.length > 1 && (
                <Seccion titulo={`📍 ${hijos.titulo}`} extra={hijos.lista.length > 10 && <button onClick={() => setVerTodos(v => !v)} style={BTN(D.dark2, D.text)}>{verTodos ? 'Ver solo 10' : `Ver los ${hijos.lista.length}`}</button>}>
                    {f.tipo === 'p' && (
                        <Rejilla>
                            <Tile titulo="Media por municipio" valor={nf(sumaHijos / hijos.lista.length)} detalle="habitantes" />
                            <Tile titulo="Mediana por municipio" valor={nf(hijos.lista[Math.floor(hijos.lista.length / 2)].valor)} detalle="¿por qué es tan distinta de la media?" />
                            <Tile titulo="Municipios de menos de 1.000 hab." valor={`${nf(hijos.lista.filter(x => x.valor < 1000).length)}`} detalle={`${nf(hijos.lista.filter(x => x.valor < 1000).length / hijos.lista.length * 100, 1)} % de los municipios`} />
                            <Tile titulo={`Vive en ${nombreNatural(hijos.lista[0].nombre)}`} valor={`${nf(hijos.lista[0].valor / sumaHijos * 100, 1)} %`} detalle="de la población de la provincia" />
                        </Rejilla>
                    )}
                    <BarrasH filas={listaHijos.map(x => ({ ...x, nombre: nombreNatural(x.nombre) }))} onElegir={onElegir} />
                    <div style={{ fontSize: '0.72rem', color: D.muted, marginTop: 8 }}>Pulsa un nombre para ver su ficha. Fuente: {hijos.fuente === 'Padrón' ? 'Padrón municipal' : 'Estadística Continua de Población'}.</div>
                </Seccion>
            )}

            {/* Renta (municipios) */}
            {f.renta?.persona?.length > 0 && (
                <Seccion titulo="💶 Renta de los hogares">
                    <GraficoLineas formato={v => `${nf(v)} €`} series={[
                        { nombre: 'Renta neta media por persona', color: D.s1, puntos: f.renta.persona },
                        { nombre: 'Mediana por unidad de consumo', color: D.s2, puntos: f.renta.mediana },
                    ]} />
                    {f.fuente?.some(x => x.valor != null) && (
                        <div style={{ marginTop: 16 }}>
                            <div style={{ fontSize: '0.8rem', color: D.muted, marginBottom: 8 }}>¿De dónde vienen los ingresos? (% de la renta bruta, {f.fuente.find(x => x.anyo)?.anyo})</div>
                            <BarrasH filas={f.fuente} formato={v => `${nf(v, 1)} %`} />
                            {f.fuente.some(x => x.valor == null) && <div style={{ fontSize: '0.72rem', color: D.muted, marginTop: 6 }}>«—»: el INE no publica el dato en municipios pequeños (secreto estadístico).</div>}
                        </div>
                    )}
                    {I.gini && (
                        <div style={{ fontSize: '0.8rem', color: D.muted, marginTop: 14, lineHeight: 1.6 }}>
                            <b style={{ color: D.text }}>Desigualdad:</b> índice de Gini {nf(I.gini.valor, 1)}
                            {ult(f.gini.p8020) && <> · ratio P80/P20 {nf(ult(f.gini.p8020).valor, 1)} (el 20 % más rico ingresa {nf(ult(f.gini.p8020).valor, 1)} veces más que el 20 % más pobre)</>}.
                        </div>
                    )}
                </Seccion>
            )}
            {f.tipo !== 'm' && (
                <div style={{ fontSize: '0.75rem', color: D.muted, marginBottom: 14 }}>ℹ️ La renta y el índice de Gini del Atlas de renta del INE solo se publican por municipio: búscalos en la ficha de cada municipio.</div>
            )}

            <Actividades key={f.clave} acts={acts} />
            {f.errores > 0 && <div style={{ fontSize: '0.78rem', color: D.gold, marginBottom: 10 }}>⚠ Algunos bloques no se pudieron descargar del INE; vuelve a abrir el lugar para reintentarlo.</div>}
        </>
    );
}

// ─── Comparativa de dos lugares ──────────────────────────────────────────────
function Comparativa({ fa, fb, onCambiar, onQuitar, onVer, onIntercambiar }) {
    const [modo, setModo] = useState('indice');
    const A = indicadores(fa), B = indicadores(fb);
    const nombres = [fa.nat, fb.nat];
    const acts = useMemo(() => actividadesComparativa(fa, fb), [fa, fb]);

    const base = Math.max(fa.total[0]?.anyo, fb.total[0]?.anyo);
    const indexada = s => { const b = s.find(p => p.anyo === base)?.valor; return b ? s.filter(p => p.anyo >= base).map(p => ({ anyo: p.anyo, valor: p.valor / b * 100 })) : []; };

    const veces = (a, b) => a && b ? (a >= b ? `×${nf(a / b, a / b < 10 ? 2 : 0)}` : `÷${nf(b / a, b / a < 10 ? 2 : 0)}`) : '—';
    const pp = (a, b, dec = 1, suf = ' p.p.') => a != null && b != null ? signo(a - b, dec, suf) : '—';
    const filas = [
        ['Población', A.pob && `${nf(A.pob.valor)}`, B.pob && `${nf(B.pob.valor)}`, veces(A.pob?.valor, B.pob?.valor), `1 ene ${A.pob?.anyo}${B.pob?.anyo !== A.pob?.anyo ? ` / ${B.pob?.anyo}` : ''}`],
        ['Superficie', A.area && `${nf(A.area, A.area < 100 ? 2 : 0)} km²`, B.area && `${nf(B.area, B.area < 100 ? 2 : 0)} km²`, veces(A.area, B.area)],
        ['Densidad', A.densidad != null && `${nf(A.densidad, 1)} hab/km²`, B.densidad != null && `${nf(B.densidad, 1)} hab/km²`, veces(A.densidad, B.densidad)],
        ['Mujeres', A.pctMujeres != null && `${nf(A.pctMujeres, 1)} %`, B.pctMujeres != null && `${nf(B.pctMujeres, 1)} %`, pp(A.pctMujeres, B.pctMujeres)],
        ['Variación en 10 años', A.var10 && signo(A.var10.valor), B.var10 && signo(B.var10.valor), pp(A.var10?.valor, B.var10?.valor), A.var10 && `${A.var10.desde}–${A.var10.hasta}`],
        ['Edad media', A.edadMedia != null && `${nf(A.edadMedia, 1)} años`, B.edadMedia != null && `${nf(B.edadMedia, 1)} años`, pp(A.edadMedia, B.edadMedia, 1, ' años'), [A.anyoEdades, B.anyoEdades].filter(Boolean).join(' / ')],
        ['Menores de 18', A.menores != null && `${nf(A.menores, 1)} %`, B.menores != null && `${nf(B.menores, 1)} %`, pp(A.menores, B.menores)],
        ['65 años o más', A.mayores != null && `${nf(A.mayores, 1)} %`, B.mayores != null && `${nf(B.mayores, 1)} %`, pp(A.mayores, B.mayores)],
        ['Población española', A.espanola != null && `${nf(A.espanola, 1)} %`, B.espanola != null && `${nf(B.espanola, 1)} %`, pp(A.espanola, B.espanola), [fa.espanola?.fecha, fb.espanola?.fecha].filter(Boolean).join(' / ')],
        ['Renta neta / persona', A.renta && `${nf(A.renta.valor)} €`, B.renta && `${nf(B.renta.valor)} €`, veces(A.renta?.valor, B.renta?.valor), A.renta && `${A.renta.anyo} · solo municipios`],
        ['Índice de Gini', A.gini && nf(A.gini.valor, 1), B.gini && nf(B.gini.valor, 1), pp(A.gini?.valor, B.gini?.valor, 1, '')],
        ['Personas por hogar', A.hogar != null && nf(A.hogar, 1), B.hogar != null && nf(B.hogar, 1), pp(A.hogar, B.hogar, 1, '')],
    ].filter(r => r[1] || r[2]);

    const pares = [
        ['Densidad (hab/km²)', A.densidad, B.densidad, v => nf(v, 1)],
        ['Mujeres (%)', A.pctMujeres, B.pctMujeres, v => `${nf(v, 1)} %`],
        ['Edad media (años)', A.edadMedia, B.edadMedia, v => nf(v, 1)],
        ['Menores de 18 (%)', A.menores, B.menores, v => `${nf(v, 1)} %`],
        ['65 años o más (%)', A.mayores, B.mayores, v => `${nf(v, 1)} %`],
        ['Población española (%)', A.espanola, B.espanola, v => `${nf(v, 1)} %`],
        ['Renta neta por persona (€)', A.renta?.valor, B.renta?.valor, v => `${nf(v)} €`],
    ].filter(r => r[1] != null && r[2] != null).map(([nombre, a, b, formato]) => ({ nombre, a, b, formato }));

    const pirA = fa.edades?.piramide, pirB = fb.edades?.piramide;
    const maxPir = pirA && pirB ? Math.max(...[...pirA, ...pirB].flatMap(g => [g.h, g.m])) : null;
    const mezclaFuentes = fa.fuentePob !== fb.fuentePob;

    return (
        <>
            {/* Cabeceras A / B */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 10, marginBottom: 14, position: 'relative' }}>
                {[fa, fb].map((f, i) => (
                    <div key={f.clave} style={{ ...CARD, borderTop: `4px solid ${COLORES[i]}`, padding: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                            <div style={{ minWidth: 0 }}>
                                <Chip clave={f.clave} />
                                <div style={{ fontSize: '1.25rem', fontWeight: 800, margin: '4px 0 2px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.nat}</div>
                                <div style={{ fontSize: '0.78rem', color: D.muted }}>{f.sub}</div>
                            </div>
                            <button onClick={() => onQuitar(i)} title="Quitar de la comparación" style={{ background: 'none', border: 'none', color: D.muted, cursor: 'pointer', display: 'flex', padding: 2 }}><X size={16} /></button>
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                            <button onClick={() => onCambiar(i)} style={{ ...BTN(D.dark2, D.text), padding: '5px 10px' }}><Search size={12} />Cambiar</button>
                            <button onClick={() => onVer(i)} style={{ ...BTN(D.dark2, D.text), padding: '5px 10px' }}>Ver ficha completa</button>
                        </div>
                    </div>
                ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: -6, marginBottom: 10 }}>
                <button onClick={onIntercambiar} style={{ ...BTN('transparent', D.muted), padding: '4px 10px', fontWeight: 600 }}><ArrowLeftRight size={13} />Intercambiar</button>
            </div>

            {/* Tabla comparativa */}
            <Seccion titulo="⚖️ Cara a cara">
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', fontVariantNumeric: 'tabular-nums', minWidth: 460 }}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '6px 8px', color: D.muted, fontWeight: 600 }}>Indicador</th>
                                {nombres.map((n, i) => (
                                    <th key={i} style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700 }}>
                                        <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: COLORES[i], marginRight: 6 }} />{n}
                                    </th>
                                ))}
                                <th style={{ textAlign: 'right', padding: '6px 8px', color: D.muted, fontWeight: 600 }} title="Primero respecto al segundo">Diferencia</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filas.map(([nombre, a, b, dif, nota]) => (
                                <tr key={nombre} style={{ borderTop: `1px solid ${D.border}` }}>
                                    <td style={{ padding: '7px 8px', color: D.muted }}>{nombre}{nota && <div style={{ fontSize: '0.68rem' }}>{nota}</div>}</td>
                                    <td style={{ padding: '7px 8px', textAlign: 'right' }}>{a || '—'}</td>
                                    <td style={{ padding: '7px 8px', textAlign: 'right' }}>{b || '—'}</td>
                                    <td style={{ padding: '7px 8px', textAlign: 'right', color: D.muted }}>{dif}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div style={{ fontSize: '0.7rem', color: D.muted, marginTop: 8, lineHeight: 1.5 }}>
                    «×» indica cuántas veces es mayor el primero; «÷», cuántas veces es menor. «p.p.» son puntos porcentuales.
                    {mezclaFuentes && <> La población de los municipios procede del Padrón y la de provincias, comunidades y España de la Estadística Continua de Población; las edades municipales son del Atlas de renta.</>}
                </div>
            </Seccion>

            {/* Evolución */}
            <Seccion titulo={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><IconoLinea size={16} color={D.accent} /> Evolución de la población</span>}
                extra={<Pestanas valor={modo} onCambio={setModo} opciones={[['indice', `Índice (${base} = 100)`], ['abs', 'Habitantes']]} />}>
                {modo === 'indice'
                    ? <>
                        <div style={{ fontSize: '0.78rem', color: D.muted, marginBottom: 6 }}>Cada línea vale 100 en {base}: así se compara el ritmo de crecimiento aunque los tamaños sean muy distintos.</div>
                        <GraficoLineas formato={v => nf(v, 1)} series={[{ nombre: nombres[0], color: COLORES[0], puntos: indexada(fa.total) }, { nombre: nombres[1], color: COLORES[1], puntos: indexada(fb.total) }]} />
                    </>
                    : <GraficoLineas unidad=" hab." series={[{ nombre: nombres[0], color: COLORES[0], puntos: fa.total.filter(p => p.anyo >= base) }, { nombre: nombres[1], color: COLORES[1], puntos: fb.total.filter(p => p.anyo >= base) }]} />}
            </Seccion>

            {/* Indicadores relativos */}
            {pares.length > 0 && (
                <Seccion titulo="📊 Indicador a indicador">
                    <BarrasPareadas filas={pares} nombres={nombres} />
                </Seccion>
            )}

            {/* Pirámides */}
            {(pirA || pirB) && (
                <Seccion titulo="👪 Pirámides de población">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 18 }}>
                        {[[fa, pirA, 0], [fb, pirB, 1]].map(([f, pir, i]) => pir
                            ? <Piramide key={f.clave} datos={pir} colores={[COLORES[i], COLORES[i]]} max={maxPir} titulo={`${f.nat} (${f.edades.anyo})`} />
                            : <div key={f.clave} style={{ fontSize: '0.8rem', color: D.muted, alignSelf: 'center', textAlign: 'center' }}>{f.nat}: el INE no publica la pirámide completa por municipio.</div>)}
                    </div>
                    {maxPir && <div style={{ fontSize: '0.72rem', color: D.muted, marginTop: 6, textAlign: 'center' }}>Las dos pirámides usan la misma escala (% de su población).</div>}
                </Seccion>
            )}

            <Actividades key={`${fa.clave}-${fb.clave}`} acts={acts} titulo="✏️ Calcula comparando" />
        </>
    );
}

// ─── Componente principal ────────────────────────────────────────────────────
// rutaCompartir(claves) → URL absoluta para compartir esa selección
export default function ExploradorINE({ onClose, rutaCompartir }) {
    const [idx, setIdx] = useState(null);
    const [errorIndice, setErrorIndice] = useState('');
    const [claves, setClaves] = useState(() => leerClavesUrl());
    const [fichas, setFichas] = useState({});          // clave → ficha | { error }
    const [q, setQ] = useState('');
    const [foco, setFoco] = useState(0);
    const [abierto, setAbierto] = useState(false);
    const [destino, setDestino] = useState(null);      // null: nueva búsqueda · 0/1: cambiar A/B · 'B': añadir para comparar
    const [compartir, setCompartir] = useState(false);
    const inputRef = useRef(null);
    const contRef = useRef(null);

    useEffect(() => { cargarIndice().then(setIdx).catch(e => setErrorIndice(e.message)); }, []);

    // La selección se refleja en la URL y se cargan las fichas que falten
    useEffect(() => {
        escribirClavesUrl(claves);
        contRef.current?.scrollTo?.({ top: 0 });
        if (!idx) return;
        for (const c of claves) {
            if (fichas[c]) continue;
            if (!idx.porClave.has(c)) { setFichas(s => ({ ...s, [c]: { error: 'Ese lugar no existe en el índice del INE (puede que el enlace esté mal copiado).' } })); continue; }
            setFichas(s => ({ ...s, [c]: { cargando: true } }));
            cargarLugar(idx, c)
                .then(f => setFichas(s => ({ ...s, [c]: f })))
                .catch(e => setFichas(s => ({ ...s, [c]: { error: e.message === 'Failed to fetch' ? 'No se pudo conectar con el INE. Revisa la conexión o inténtalo más tarde.' : e.message } })));
        }
    }, [claves, idx]); // eslint-disable-line react-hooks/exhaustive-deps

    const cerrar = () => { escribirClavesUrl([]); onClose?.(); };

    const resultados = useMemo(() => buscarLugares(idx, q), [idx, q]);

    const elegir = (clave) => {
        setQ(''); setAbierto(false);
        setClaves(cs => {
            if (destino === 'B' && cs[0] && cs[0] !== clave) return [cs[0], clave];
            if ((destino === 0 || destino === 1) && cs.length === 2) {
                const n = [...cs]; n[destino] = clave;
                return n[0] === n[1] ? [clave] : n;
            }
            return [clave];
        });
        setDestino(null);
    };
    const pedirBusqueda = (d) => { setDestino(d); setQ(''); setTimeout(() => { inputRef.current?.focus(); setAbierto(true); }, 30); };
    const comparar = (clave) => clave ? setClaves(cs => [cs[0], clave]) : pedirBusqueda('B');

    const fa = fichas[claves[0]], fb = fichas[claves[1]];
    const nombreDe = c => nombreNatural(idx?.porClave.get(c)?.nombre || '');
    const tituloCompartir = claves.length === 2 ? `${nombreDe(claves[0])} vs ${nombreDe(claves[1])} · datos del INE` : `${nombreDe(claves[0])} · datos del INE`;
    const placeholder = !idx ? 'Cargando lugares…'
        : destino === 'B' ? `¿Con qué quieres comparar ${nombreDe(claves[0])}?`
        : destino === 0 || destino === 1 ? `Cambiar ${nombreDe(claves[destino])} por…`
        : `Busca un municipio, provincia o comunidad… (p. ej. Jaca, Huesca, Aragón)`;

    const estado = (f) => !f || f.cargando
        ? <div style={{ ...CARD, textAlign: 'center', color: D.muted, padding: 30, marginBottom: 14 }}><div style={{ fontSize: 30, marginBottom: 6 }}>⏳</div>Consultando al INE…</div>
        : f.error ? <div style={{ ...CARD, color: D.red, borderColor: D.red, marginBottom: 14 }}>{f.error}</div> : null;

    return (
        <div ref={contRef} style={{ position: 'fixed', inset: 0, zIndex: 9000, background: D.bg, color: D.text, overflowY: 'auto', fontFamily: "'Segoe UI',sans-serif" }}>
            {/* Cabecera */}
            <div style={{ position: 'sticky', top: 0, zIndex: 5, padding: '10px 16px', background: D.card, borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={cerrar} style={{ background: 'transparent', border: `1px solid ${D.border}`, color: D.muted, padding: '6px 12px', borderRadius: 7, cursor: 'pointer' }}>← Volver</button>
                <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>🇪🇸 Datos reales del INE</span>
                <span style={{ flex: 1 }} />
                {claves.length > 0 && rutaCompartir && (
                    <button onClick={() => setCompartir(true)} style={BTN(D.accent)}><Share2 size={14} />{claves.length === 2 ? 'Compartir comparativa' : 'Compartir'}</button>
                )}
            </div>

            <div style={{ maxWidth: 980, margin: '0 auto', padding: '18px 16px 40px', boxSizing: 'border-box' }}>
                {/* Buscador */}
                <div style={{ position: 'relative', marginBottom: 18 }}>
                    {destino != null && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: D.accent, marginBottom: 6 }}>
                            <span><Scale size={13} style={{ verticalAlign: -2 }} /> {destino === 'B' ? 'Elige el segundo lugar para la comparativa' : 'Elige el lugar que lo sustituye'}</span>
                            <button onClick={() => setDestino(null)} style={{ background: 'none', border: 'none', color: D.muted, cursor: 'pointer', fontSize: '0.8rem' }}>Cancelar</button>
                        </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: D.card, border: `2px solid ${destino != null || (abierto && resultados.length) ? D.accent : D.border}`, borderRadius: 12, padding: '10px 14px' }}>
                        <Search size={18} color={D.muted} />
                        <input ref={inputRef} autoFocus={!claves.length} value={q} placeholder={placeholder} disabled={!idx}
                            onChange={e => { setQ(e.target.value); setAbierto(true); setFoco(0); }}
                            onFocus={() => setAbierto(true)}
                            onBlur={() => setTimeout(() => setAbierto(false), 150)}
                            onKeyDown={e => {
                                if (e.key === 'ArrowDown') { e.preventDefault(); setFoco(f => Math.min(f + 1, resultados.length - 1)); }
                                else if (e.key === 'ArrowUp') { e.preventDefault(); setFoco(f => Math.max(f - 1, 0)); }
                                else if (e.key === 'Enter' && resultados[foco]) elegir(resultados[foco].clave);
                                else if (e.key === 'Escape') { setAbierto(false); setDestino(null); }
                            }}
                            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: D.text, fontSize: '1rem', minWidth: 0 }} />
                        {q && <button onClick={() => setQ('')} style={{ background: 'none', border: 'none', color: D.muted, cursor: 'pointer', display: 'flex' }}><X size={16} /></button>}
                    </div>
                    {abierto && resultados.length > 0 && (
                        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: D.card, border: `1px solid ${D.border}`, borderRadius: 12, overflow: 'hidden', zIndex: 10, boxShadow: '0 12px 40px rgba(0,0,0,0.5)', maxHeight: 400, overflowY: 'auto' }}>
                            {resultados.map((l, i) => (
                                <button key={l.clave} onMouseDown={e => { e.preventDefault(); elegir(l.clave); }} onMouseEnter={() => setFoco(i)}
                                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, width: '100%', padding: '9px 14px', border: 'none', borderBottom: `1px solid ${D.border}`, background: i === foco ? D.dark2 : 'transparent', color: D.text, cursor: 'pointer', textAlign: 'left', fontSize: '0.92rem' }}>
                                    <span style={{ minWidth: 0 }}>
                                        <span style={{ marginRight: 8 }}>{TIPOS[tipoDe(l.clave)].emoji}</span>{l.nat}
                                        <span style={{ display: 'block', color: D.muted, fontSize: '0.74rem', marginLeft: 26 }}>{l.sub}</span>
                                    </span>
                                    <span style={{ color: D.muted, fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{TIPOS[tipoDe(l.clave)].nombre}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    {abierto && q.trim().length >= 2 && idx && !resultados.length && (
                        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, ...CARD, padding: 12, color: D.muted, fontSize: '0.85rem', zIndex: 10 }}>No hay ningún lugar con ese nombre.</div>
                    )}
                </div>
                {errorIndice && <div style={{ color: D.red, marginBottom: 12 }}>{errorIndice}</div>}

                {/* Estado inicial */}
                {!claves.length && (
                    <div style={{ ...CARD, textAlign: 'center', padding: '32px 20px' }}>
                        <div style={{ fontSize: 46, marginBottom: 8 }}>🏘️ ⚖️ 🗺️</div>
                        <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 6 }}>Busca un municipio, una provincia o una comunidad autónoma</div>
                        <div style={{ color: D.muted, fontSize: '0.88rem', lineHeight: 1.6, maxWidth: 600, margin: '0 auto 16px' }}>
                            Verás su población y cómo ha cambiado, la superficie y la densidad, hombres y mujeres, edades, renta y desigualdad.
                            Después puedes <b style={{ color: D.text }}>compararlo con otro lugar</b> y compartir el enlace. Todo se descarga en directo del Instituto Nacional de Estadística.
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                            {[['es', 'España'], ['c13', 'Comunidad de Madrid'], ['p42', 'Soria'], ['m28079', 'Madrid (ciudad)']].map(([c, n]) => (
                                <button key={c} onClick={() => setClaves([c])} disabled={!idx} style={{ ...BTN(D.dark2, D.text), border: `1px solid ${D.border}` }}>{TIPOS[tipoDe(c)].emoji} {n}</button>
                            ))}
                            <button onClick={() => setClaves(['p42', 'p28'])} disabled={!idx} style={{ ...BTN(D.dark2, D.text), border: `1px solid ${D.border}` }}>⚖️ Soria vs Madrid</button>
                        </div>
                    </div>
                )}

                {claves.length === 1 && (estado(fa) || <Ficha key={claves[0]} f={fa} idx={idx} onElegir={c => setClaves([c])} onComparar={comparar} />)}

                {claves.length === 2 && (
                    estado(fa) || estado(fb) || (
                        <Comparativa fa={fa} fb={fb}
                            onCambiar={i => pedirBusqueda(i)}
                            onQuitar={i => setClaves(cs => cs.filter((_, k) => k !== i))}
                            onVer={i => setClaves([claves[i]])}
                            onIntercambiar={() => setClaves(cs => [cs[1], cs[0]])} />
                    )
                )}

                <div style={{ fontSize: '0.72rem', color: D.muted, marginTop: 18, lineHeight: 1.6, textAlign: 'center' }}>
                    Fuentes: <a href="https://www.ine.es" target="_blank" rel="noreferrer" style={{ color: D.accent }}>Instituto Nacional de Estadística <ExternalLink size={10} /></a> —
                    Padrón municipal, Estadística Continua de Población y Atlas de distribución de renta de los hogares.
                    Superficies: <a href="https://ec.europa.eu/eurostat/web/gisco/geodata/statistical-units/local-administrative-units" target="_blank" rel="noreferrer" style={{ color: D.accent }}>Eurostat GISCO (LAU 2024)</a>.
                </div>
            </div>

            {compartir && rutaCompartir && <ModalCompartir url={rutaCompartir(claves)} titulo={tituloCompartir} onClose={() => setCompartir(false)} />}
        </div>
    );
}
