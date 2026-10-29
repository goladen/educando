import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Trophy } from 'lucide-react';
import { sonidoCorrecto, sonidoIncorrecto, sonidoPasar, sonidoFinal, despertarAudio } from './utils/sonidosFeedback';
import { guardarRegistroLocal } from './utils/registrosLocales';
import {
    OPS_COLUMNA, NIVELES_COLUMNA, COMO_SE_HACE, generarColumna, construirColumna, corregirColumna,
    claveCelda, claveColumna, resultadoColumna, textoColumna,
} from './utils/calculoColumna';
import OperacionColumna from './components/OperacionColumna';

// ─────────────────────────────────────────────────────────────────────────────
//  🧱 OPERACIONES EN COLUMNA (modo de Cálculo Mental)
//  Sumas, restas, multiplicaciones y divisiones con el método clásico: el
//  alumno escribe cifra a cifra en las casillas (las llevadas son libres) y se
//  corrige casilla a casilla. Pista, ver solución y explicación del método.
//  El envío al profesor lo hace CalculoMental con su propio modal (onEnviar).
// ─────────────────────────────────────────────────────────────────────────────

const COLOR = '#E91E63';
const barajar = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

// Casillas de llevada en todas las columnas (si solo estuvieran donde hay llevada, sería una pista)
const conCasillasLlevada = (lay) => {
    const fila = lay.altos.findIndex(h => h < 1);
    if (fila < 0) return lay;
    const ocupadas = new Set(lay.celdas.filter(c => c.r === fila).map(c => c.c));
    const ultima = lay.anchos.length - 1;
    const extra = [];
    for (let c = 1; c < ultima; c++) if (lay.anchos[c] === 1 && !ocupadas.has(c)) extra.push({ r: fila, c, v: '', tipo: 'llevada', mas: lay.celdas.some(x => x.mas) });
    return { ...lay, celdas: [...lay.celdas, ...extra] };
};

const generarLista = (ops, nivel, n, decimales, exacta) => {
    const orden = barajar(Array.from({ length: n }, (_, i) => ops[i % ops.length]));
    const vistos = new Set(), lista = [];
    orden.forEach(op => {
        let d;
        for (let i = 0; i < 20; i++) { d = generarColumna(op, nivel, { decimales: decimales && (op === 'suma' || op === 'resta'), exacta }); if (!vistos.has(claveColumna(d))) break; }
        vistos.add(claveColumna(d));
        lista.push(d);
    });
    return lista;
};

export default function CalculoColumna({ isMobile, onSalir, onEnviar, usuario }) {
    const [fase, setFase] = useState('ELEGIR'); // ELEGIR | JUGANDO | FIN
    const [ops, setOps] = useState(['suma', 'resta', 'mult', 'div']);
    const [nivel, setNivel] = useState(1);
    const [decimales, setDecimales] = useState(false);
    const [exacta, setExacta] = useState(false);
    const [cuantos, setCuantos] = useState(6);
    const [lista, setLista] = useState([]);
    const [idx, setIdx] = useState(0);
    const [valores, setValores] = useState({});
    const [estados, setEstados] = useState({});
    const [sel, setSel] = useState(null);
    const [resuelto, setResuelto] = useState(null); // null | 'ok' | 'visto'
    const [ayudado, setAyudado] = useState(false); // ha fallado o pedido pista en este ejercicio
    const [feedback, setFeedback] = useState(null);
    const [verMetodo, setVerMetodo] = useState(false);
    const [stats, setStats] = useState({ aciertos: 0, fallos: 0, skips: 0, puntos: 0 });
    const [guardado, setGuardado] = useState(false);

    const datos = lista[idx];
    const lay = useMemo(() => (datos ? conCasillasLlevada(construirColumna(datos)) : null), [datos]);
    const editables = useMemo(() => (lay ? lay.celdas.filter(c => c.tipo === 'input' || c.tipo === 'llevada') : []), [lay]);
    const entradas = useMemo(() => (lay ? lay.celdas.filter(c => c.tipo === 'input').sort((a, b) => a.orden - b.orden) : []), [lay]);

    // Tamaño de casilla según el ancho disponible
    const ancho = typeof window !== 'undefined' ? Math.min(window.innerWidth, 640) - (isMobile ? 70 : 110) : 500;
    const celda = lay ? Math.max(24, Math.min(50, Math.floor(ancho / lay.anchos.reduce((s, w) => s + w, 0)))) : 40;

    const preparar = (d) => {
        const l = conCasillasLlevada(construirColumna(d));
        const primera = l.celdas.filter(c => c.tipo === 'input').sort((a, b) => a.orden - b.orden)[0];
        setValores({}); setEstados({}); setResuelto(null); setAyudado(false); setFeedback(null);
        setSel(primera ? claveCelda(primera) : null);
    };

    const empezar = () => {
        despertarAudio();
        const l = generarLista(ops, nivel, cuantos, decimales, exacta);
        setLista(l); setIdx(0); setGuardado(false); setVerMetodo(false);
        setStats({ aciertos: 0, fallos: 0, skips: 0, puntos: 0 });
        preparar(l[0]);
        setFase('JUGANDO');
    };

    const siguienteCasilla = useCallback((k) => {
        const cel = editables.find(c => claveCelda(c) === k);
        if (!cel) return k;
        if (cel.tipo === 'input') {
            const sig = entradas.find(c => c.orden === cel.orden + 1);
            return sig ? claveCelda(sig) : k;
        }
        const vacia = entradas.find(c => !valores[claveCelda(c)]);
        return vacia ? claveCelda(vacia) : k;
    }, [editables, entradas, valores]);

    const escribir = useCallback((dig) => {
        if (!sel || resuelto) return;
        setValores(v => ({ ...v, [sel]: dig }));
        setEstados(e => { const n = { ...e }; delete n[sel]; return n; });
        setSel(siguienteCasilla(sel));
    }, [sel, resuelto, siguienteCasilla]);

    const borrar = useCallback(() => {
        if (!sel || resuelto) return;
        if (valores[sel]) { setValores(v => { const n = { ...v }; delete n[sel]; return n; }); return; }
        const cel = entradas.find(c => claveCelda(c) === sel);
        const ant = cel && entradas.find(c => c.orden === cel.orden - 1);
        if (ant) { const k = claveCelda(ant); setSel(k); setValores(v => { const n = { ...v }; delete n[k]; return n; }); }
    }, [sel, resuelto, valores, entradas]);

    // Moverse con las flechas a la casilla más cercana en esa dirección
    const mover = useCallback((dr, dc) => {
        const cel = editables.find(c => claveCelda(c) === sel);
        if (!cel) return;
        const candidatas = editables.filter(c => (dc ? c.r === cel.r && Math.sign(c.c - cel.c) === dc : c.c === cel.c && Math.sign(c.r - cel.r) === dr));
        const mejor = candidatas.sort((a, b) => Math.abs(a.c - cel.c) + Math.abs(a.r - cel.r) - Math.abs(b.c - cel.c) - Math.abs(b.r - cel.r))[0];
        if (mejor) setSel(claveCelda(mejor));
    }, [editables, sel]);

    const comprobar = useCallback(() => {
        if (!lay || resuelto) return;
        const { estados: est, todoBien } = corregirColumna(lay, valores);
        setEstados(est);
        if (todoBien) {
            sonidoCorrecto();
            setStats(s => ({ ...s, aciertos: s.aciertos + (ayudado ? 0 : 1), puntos: s.puntos + (ayudado ? 5 : 10) }));
            setResuelto('ok'); setFeedback('CORRECT');
            setTimeout(() => setFeedback(null), 700);
        } else {
            sonidoIncorrecto();
            if (!ayudado) setStats(s => ({ ...s, fallos: s.fallos + 1 }));
            setAyudado(true); setFeedback('INCORRECT');
            setTimeout(() => setFeedback(null), 900);
            const primeraMal = entradas.find(c => est[claveCelda(c)] !== 'ok');
            if (primeraMal) setSel(claveCelda(primeraMal));
        }
    }, [lay, resuelto, valores, ayudado, entradas]);

    const pista = () => {
        if (resuelto) return;
        const { estados: est } = corregirColumna(lay, valores);
        const c = entradas.find(x => est[claveCelda(x)] !== 'ok');
        if (!c) { comprobar(); return; }
        const k = claveCelda(c);
        if (!ayudado) setStats(s => ({ ...s, fallos: s.fallos + 1 }));
        setAyudado(true);
        setValores(v => ({ ...v, [k]: c.v }));
        setEstados(e => ({ ...e, [k]: 'pista' }));
        setSel(siguienteCasilla(k));
    };

    const verSolucion = () => {
        if (resuelto) return;
        sonidoPasar();
        setStats(s => ({ ...s, skips: s.skips + 1, fallos: s.fallos + (ayudado ? 0 : 1) }));
        const v = {}, e = {};
        lay.celdas.forEach(c => { if ((c.tipo === 'input' || c.tipo === 'llevada') && c.v) { v[claveCelda(c)] = c.v; if (c.tipo === 'input') e[claveCelda(c)] = 'pista'; } });
        setValores(v); setEstados(e); setResuelto('visto'); setSel(null);
    };

    const siguiente = () => {
        if (idx + 1 >= lista.length) { sonidoFinal(); setFase('FIN'); return; }
        setIdx(i => i + 1); preparar(lista[idx + 1]);
    };

    // Teclado físico
    useEffect(() => {
        if (fase !== 'JUGANDO') return;
        const onKey = (e) => {
            if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
            if (/^[0-9]$/.test(e.key)) { e.preventDefault(); escribir(e.key); }
            else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); borrar(); }
            else if (e.key === 'Enter') { e.preventDefault(); if (resuelto) siguiente(); else comprobar(); }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); mover(0, -1); }
            else if (e.key === 'ArrowRight') { e.preventDefault(); mover(0, 1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); mover(-1, 0); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); mover(1, 0); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    const chip = (activo, c) => ({ padding: '8px 14px', borderRadius: 20, border: `2px solid ${c}`, background: activo ? c : 'white', color: activo ? 'white' : c, fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' });
    const card = { background: 'white', maxWidth: 640, margin: '10px auto', padding: '22px 20px', borderRadius: 20, boxShadow: '0 15px 35px rgba(0,0,0,0.1)', boxSizing: 'border-box' };
    const btnSec = (c) => ({ padding: '10px 14px', borderRadius: 14, border: `2px solid ${c}`, background: 'white', color: c, fontWeight: 800, cursor: 'pointer', fontSize: '0.9rem' });

    // ── Elegir ──
    if (fase === 'ELEGIR') {
        const hayDiv = ops.includes('div'), haySR = ops.includes('suma') || ops.includes('resta');
        return (
            <div style={{ ...card, textAlign: 'center' }}>
                <h2 style={{ color: COLOR, margin: '0 0 6px' }}>🧱 Operaciones en columna</h2>
                <p style={{ color: '#888', fontSize: '0.88rem', margin: '0 0 16px' }}>El método clásico, cifra a cifra: llevadas, productos parciales y la división con galera.</p>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
                    {Object.entries(OPS_COLUMNA).map(([k, o]) => {
                        const activo = ops.includes(k);
                        return (
                            <button key={k} onClick={() => setOps(p => (p.includes(k) ? (p.length > 1 ? p.filter(x => x !== k) : p) : [...p, k]))}
                                style={{ padding: '12px 8px', borderRadius: 14, border: `2px solid ${o.color}`, background: activo ? o.color : 'white', color: activo ? 'white' : o.color, fontWeight: 900, cursor: 'pointer', fontSize: '0.88rem' }}>
                                {o.label}
                            </button>
                        );
                    })}
                </div>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                    <span style={{ fontWeight: 800, color: '#555', fontSize: '0.85rem' }}>Nivel:</span>
                    {Object.entries(NIVELES_COLUMNA).map(([n, l]) => (
                        <button key={n} onClick={() => setNivel(Number(n))} style={{ ...chip(nivel === Number(n), '#7b1fa2'), display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.2 }}>
                            <span>{l.label}</span><span style={{ fontSize: '0.68rem', fontWeight: 700, opacity: 0.85 }}>{l.desc}</span>
                        </button>
                    ))}
                </div>
                {(haySR || hayDiv) && (
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                        {haySR && <button onClick={() => setDecimales(d => !d)} style={chip(decimales, '#16a085')}>{decimales ? '✓ ' : ''}Sumas y restas con decimales</button>}
                        {hayDiv && <button onClick={() => setExacta(x => !x)} style={chip(exacta, '#9b59b6')}>{exacta ? '✓ Divisiones exactas' : 'Divisiones con resto'}</button>}
                    </div>
                )}
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
                    <span style={{ fontWeight: 800, color: '#555', fontSize: '0.85rem' }}>Operaciones:</span>
                    {[4, 6, 8, 10].map(n => <button key={n} onClick={() => setCuantos(n)} style={chip(cuantos === n, '#009688')}>{n}</button>)}
                </div>
                <button onClick={empezar} style={{ padding: '14px 30px', borderRadius: 30, border: 'none', background: COLOR, color: 'white', fontWeight: 900, fontSize: '1.05rem', cursor: 'pointer', boxShadow: `0 5px 14px ${COLOR}55` }}>▶ Empezar</button>
                <div style={{ marginTop: 14 }}>
                    <button onClick={onSalir} style={{ padding: '10px 22px', borderRadius: 30, border: '2px solid #bdc3c7', background: 'white', color: '#7f8c8d', fontWeight: 800, cursor: 'pointer' }}>← Menú</button>
                </div>
            </div>
        );
    }

    // ── Resultados ──
    if (fase === 'FIN') {
        const intentos = stats.aciertos + stats.fallos;
        const btn = (bg) => ({ padding: '12px 22px', borderRadius: 30, border: 'none', background: bg, color: 'white', fontWeight: 800, cursor: 'pointer', width: '100%', maxWidth: 300 });
        return (
            <div style={{ ...card, maxWidth: 480, textAlign: 'center' }}>
                <Trophy size={64} color="#f1c40f" style={{ marginBottom: 10 }} />
                <h2 style={{ color: '#2c3e50', margin: '0 0 6px' }}>¡Operaciones terminadas!</h2>
                <div style={{ fontSize: '3rem', fontWeight: 900, color: COLOR }}>{stats.puntos}</div>
                <div style={{ color: '#7f8c8d', marginBottom: 14 }}>✅ {stats.aciertos} a la primera · ❌ {stats.fallos} · {Math.round((stats.aciertos / Math.max(1, intentos)) * 100)} %</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
                    <button onClick={empezar} style={btn(COLOR)}>🔁 Otras operaciones</button>
                    <button onClick={() => setFase('ELEGIR')} style={btn('#7f8c8d')}>⚙️ Cambiar opciones</button>
                    <button disabled={guardado} onClick={() => {
                        guardarRegistroLocal('CALCULO', { titulo: 'Cálculo Mental · En columna', aciertos: stats.aciertos, intentos, nombre: usuario?.nombre || usuario?.displayName || '', curso: '', via: 'local' });
                        setGuardado(true);
                    }} style={btn(guardado ? '#95a5a6' : '#16a085')}>{guardado ? '✅ Guardado' : '💾 Guardar en mis registros'}</button>
                    <button onClick={() => onEnviar({
                        ...stats,
                        config: {
                            operaciones: { suma: ops.includes('suma'), resta: ops.includes('resta'), multiplicacion: ops.includes('mult'), division: ops.includes('div'), columna: true },
                            tipos: { positivos: true, decimales }, minNum: null, maxNum: null, tiempo: null, numEjercicios: lista.length, nivel,
                        },
                    })} style={btn('linear-gradient(135deg,#27ae60,#2ecc71)')}>📤 Enviar al profesor</button>
                </div>
            </div>
        );
    }

    // ── Resolviendo ──
    const op = OPS_COLUMNA[datos.op];
    const res = resultadoColumna(datos);
    const borde = feedback === 'CORRECT' ? '#2ecc71' : feedback === 'INCORRECT' ? '#e74c3c' : 'transparent';
    const nMal = Object.values(estados).filter(e => e === 'mal').length, nVacio = Object.values(estados).filter(e => e === 'vacio').length;
    const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

    return (
        <div style={{ ...card, border: `4px solid ${borde}`, transition: 'border-color 0.2s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <span style={{ padding: '3px 12px', borderRadius: 20, background: op.color + '22', color: op.color, fontWeight: 800, fontSize: '0.78rem' }}>{op.label}</span>
                <span style={{ fontWeight: 800, color: COLOR, fontSize: '0.85rem' }}>Operación {idx + 1}/{lista.length} · 🏆 {stats.puntos}</span>
            </div>
            <div style={{ textAlign: 'center', fontWeight: 800, color: '#2c3e50', fontSize: isMobile ? '1rem' : '1.15rem', marginBottom: 12 }}>
                {datos.op === 'div' ? `Divide ${textoColumna(datos)}` : `Calcula ${textoColumna(datos)}`}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', overflowX: 'auto', padding: '10px 4px 14px', background: '#fafafa', borderRadius: 14, border: '1px solid #eee' }}>
                <OperacionColumna lay={lay} celda={celda} modo="interactivo" valores={valores} estados={estados} sel={sel} onSel={(k) => !resuelto && setSel(k)} />
            </div>
            <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#999', marginTop: 6 }}>
                Toca una casilla y escribe la cifra. Las casillas pequeñas <span style={{ color: '#1e88e5', fontWeight: 800 }}>azules</span> son para las llevadas (no se corrigen).
            </div>

            {!resuelto && (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, maxWidth: 360, margin: '12px auto 0' }}>
                        {teclas.map(t => (
                            <button key={t} onClick={() => escribir(t)} style={{ padding: '11px 0', borderRadius: 12, border: 'none', background: '#37474f', color: 'white', fontWeight: 900, fontSize: '1.2rem', cursor: 'pointer', boxShadow: '0 3px 0 #1c262b', touchAction: 'manipulation' }}>{t}</button>
                        ))}
                        <button onClick={borrar} style={{ gridColumn: 'span 2', padding: '11px 0', borderRadius: 12, border: 'none', background: '#90a4ae', color: 'white', fontWeight: 900, fontSize: '1.1rem', cursor: 'pointer', boxShadow: '0 3px 0 #607d8b', touchAction: 'manipulation' }}>⌫</button>
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14, flexWrap: 'wrap' }}>
                        <button onClick={comprobar} style={{ background: '#27ae60', color: 'white', border: 'none', borderRadius: 14, padding: '11px 20px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 0 #1e8449' }}>✅ Comprobar</button>
                        <button onClick={pista} style={btnSec('#1e88e5')}>💡 Pista</button>
                        <button onClick={verSolucion} style={btnSec('#e67e22')}>👀 Ver solución</button>
                    </div>
                    {(nMal > 0 || nVacio > 0) && (
                        <div style={{ textAlign: 'center', marginTop: 10, fontWeight: 800, fontSize: '0.88rem', color: '#e74c3c' }}>
                            {nMal > 0 && `❌ ${nMal} ${nMal === 1 ? 'casilla está mal' : 'casillas están mal'}`}{nMal > 0 && nVacio > 0 && ' · '}
                            {nVacio > 0 && <span style={{ color: '#e67e22' }}>{nVacio} sin rellenar</span>}
                        </div>
                    )}
                </>
            )}

            {resuelto && (
                <div style={{ marginTop: 14, background: resuelto === 'ok' ? '#e8f5e9' : '#fff8e1', borderRadius: 14, padding: '12px 14px', border: `2px solid ${resuelto === 'ok' ? '#a5d6a7' : '#ffe082'}`, textAlign: 'center' }}>
                    <div style={{ fontWeight: 900, color: resuelto === 'ok' ? '#27ae60' : '#e67e22', fontSize: '1.05rem' }}>
                        {resuelto === 'ok' ? (ayudado ? '✅ ¡Conseguido!' : '🌟 ¡Perfecto a la primera!') : '👀 Esta es la solución'}
                    </div>
                    <div style={{ marginTop: 6, fontWeight: 800, color: '#2c3e50' }}>
                        {datos.op === 'div'
                            ? <>Cociente <b style={{ color: COLOR }}>{res.cociente}</b> · Resto <b style={{ color: COLOR }}>{res.resto}</b><div style={{ fontSize: '0.82rem', color: '#7f8c8d', marginTop: 4 }}>Prueba: {datos.nums[1]} × {res.cociente} + {res.resto} = {datos.nums[0]}</div></>
                            : <>{textoColumna(datos)} = <b style={{ color: COLOR }}>{String(res).replace('.', ',')}</b></>}
                    </div>
                    <button onClick={siguiente} style={{ marginTop: 12, background: '#27ae60', color: 'white', border: 'none', borderRadius: 14, padding: '12px 26px', fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 0 #1e8449' }}>
                        {idx + 1 >= lista.length ? '🏁 Ver resultados' : 'Siguiente operación ›'}
                    </button>
                </div>
            )}

            <div style={{ marginTop: 14 }}>
                <button onClick={() => setVerMetodo(v => !v)} style={{ width: '100%', padding: '9px 12px', borderRadius: 12, border: '1.5px dashed #b39ddb', background: '#f6f2fb', color: '#5e35b1', fontWeight: 800, cursor: 'pointer', fontSize: '0.86rem' }}>
                    📘 ¿Cómo se hace? {verMetodo ? '▲' : '▼'}
                </button>
                {verMetodo && (
                    <ol style={{ margin: '8px 0 0', paddingLeft: 22, color: '#2c3e50', fontWeight: 600, fontSize: '0.88rem', lineHeight: 1.6, textAlign: 'left' }}>
                        {COMO_SE_HACE[datos.op].map((t, i) => <li key={i}>{t}</li>)}
                    </ol>
                )}
            </div>

            <div style={{ textAlign: 'center', marginTop: 14 }}>
                <button onClick={() => setFase('ELEGIR')} style={{ padding: '9px 20px', borderRadius: 30, border: '2px solid #bdc3c7', background: 'white', color: '#7f8c8d', fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem' }}>← Opciones</button>
            </div>
        </div>
    );
}
