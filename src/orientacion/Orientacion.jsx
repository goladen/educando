import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import MapaOrientacion, { SelectorCapa, MAGENTA } from './MapaOrientacion';
import JuegoOrientacion, { MODOS } from './JuegoOrientacion';
import ImprimiblesOrientacion from './ImprimiblesOrientacion';
import { capturarPosicion, codigoAleatorio, codigoAcceso, tramosDe, longitudRecorrido, redondearM, fmtGrados } from './geo';
import { codificarReto, decodificarReto } from '../utils/retoLink';

const COL = 'carreras_orientacion';
const RUTA = '/orientacion';
const LS_BORR = 'pikt_orient_borradores';

const CONFIG_DEF = {
    modo: 'cardinal', formatoCardinal: 'componentes', radio: 10, validacion: 'gps_o_codigo',
    mostrarPosicion: false, ordenLibre: false, metaEnSalida: true, mostrarPasos: true, longPaso: 0.65,
    pistaCaliente: false, capa: 'satelite',
};

const nuevaCarrera = () => ({ titulo: '', descripcion: '', salida: null, balizas: [], config: { ...CONFIG_DEF }, localId: 'loc_' + Date.now() });
const nuevaBaliza = (lat, lng) => ({ id: 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), nombre: '', lat, lng, codigo: codigoAleatorio(3), pregunta: '', respuesta: '' });

// ── Enlaces ──
const r6 = (x) => Math.round(x * 1e6) / 1e6;
const compactar = (c) => ({
    t: c.titulo, d: c.descripcion || undefined, s: c.salida ? [r6(c.salida.lat), r6(c.salida.lng)] : null,
    b: c.balizas.map(b => [r6(b.lat), r6(b.lng), b.codigo, b.nombre || '', b.pregunta || '', b.respuesta || '']),
    c: c.config,
});
const expandir = (o) => ({
    titulo: o.t || '', descripcion: o.d || '', salida: o.s ? { lat: o.s[0], lng: o.s[1] } : null,
    balizas: (o.b || []).map((a, i) => ({ id: 'b' + i, lat: a[0], lng: a[1], codigo: a[2], nombre: a[3], pregunta: a[4], respuesta: a[5] })),
    config: { ...CONFIG_DEF, ...(o.c || {}) },
});
export const enlaceCarrera = (c) => c.id
    ? `${window.location.origin}${RUTA}?c=${c.id}`
    : `${window.location.origin}${RUTA}?oc=${codificarReto(compactar(c))}`;

const leerBorradores = () => { try { return JSON.parse(localStorage.getItem(LS_BORR) || '[]'); } catch (_) { return []; } };
const guardarBorrador = (c) => {
    try {
        const l = leerBorradores().filter(x => x.localId !== c.localId);
        localStorage.setItem(LS_BORR, JSON.stringify([{ ...c, fechaMod: Date.now() }, ...l].slice(0, 30)));
    } catch (_) {}
};
const borrarBorrador = (localId) => { try { localStorage.setItem(LS_BORR, JSON.stringify(leerBorradores().filter(x => x.localId !== localId))); } catch (_) {} };

export default function Orientacion({ onExit }) {
    const [usuario, setUsuario] = useState(auth.currentUser);
    const [vista, setVista] = useState('menu'); // menu | editor | jugar | prueba | cargando
    const [carrera, setCarrera] = useState(null);
    const [error, setError] = useState('');
    const [codigoUnir, setCodigoUnir] = useState('');

    useEffect(() => onAuthStateChanged(auth, setUsuario), []);

    const salir = () => { window.history.pushState({}, '', '/'); onExit?.(); };

    // Abrir desde enlace: ?c=CODIGO (Firestore) o ?oc=… (carrera dentro del enlace)
    useEffect(() => {
        const p = new URLSearchParams(window.location.search);
        const oc = p.get('oc'), c = p.get('c');
        if (oc) {
            const o = decodificarReto(oc);
            if (o && o.b) { setCarrera(expandir(o)); setVista('jugar'); } else setError('El enlace de la carrera no es válido.');
        } else if (c) cargarPorCodigo(c);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const cargarPorCodigo = async (cod) => {
        const code = String(cod || '').trim().toUpperCase();
        if (!code) return;
        setVista('cargando'); setError('');
        try {
            const s = await getDoc(doc(db, COL, code));
            if (!s.exists()) { setError(`No existe ninguna carrera con el código ${code}.`); setVista('menu'); return; }
            setCarrera({ ...s.data(), id: s.id, config: { ...CONFIG_DEF, ...(s.data().config || {}) } });
            setVista('jugar');
            window.history.replaceState({}, '', `${RUTA}?c=${code}`);
        } catch (e) { setError('No se pudo cargar la carrera: ' + e.message); setVista('menu'); }
    };

    const volverMenu = () => { setVista('menu'); setCarrera(null); window.history.replaceState({}, '', RUTA); };

    if (vista === 'jugar' && carrera) return <JuegoOrientacion carrera={carrera} onExit={volverMenu} />;
    if (vista === 'prueba' && carrera) return <JuegoOrientacion carrera={carrera} esPrueba onExit={() => setVista('editor')} />;
    if (vista === 'editor' && carrera) return (
        <Editor carrera={carrera} setCarrera={setCarrera} usuario={usuario} onProbar={() => setVista('prueba')} onSalir={volverMenu} />
    );

    return (
        <div style={fondo}>
            <div style={barra}>
                <button onClick={salir} style={btnBarra}>← Volver</button>
                <b style={{ fontSize: '1.1rem' }}>🚩 Carreras de orientación</b>
            </div>
            <div style={{ maxWidth: 980, margin: '0 auto', padding: '18px 16px 50px' }}>
                {vista === 'cargando' && <div style={{ ...card, textAlign: 'center' }}>Cargando carrera…</div>}
                {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 12, marginBottom: 14, fontWeight: 600 }}>⚠️ {error}</div>}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                    <div style={{ ...card, background: 'linear-gradient(135deg,#c026d3,#7c3aed)', color: 'white' }}>
                        <div style={{ fontSize: '2.4rem' }}>🏃</div>
                        <h2 style={{ margin: '4px 0 6px' }}>Soy alumno</h2>
                        <p style={{ margin: '0 0 12px', opacity: .9 }}>Escribe el código que te ha dado tu profesor o escanea su QR.</p>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input value={codigoUnir} onChange={e => setCodigoUnir(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && cargarPorCodigo(codigoUnir)}
                                placeholder="CÓDIGO" maxLength={8} style={{ ...inp, letterSpacing: 4, fontWeight: 900, textAlign: 'center', border: 'none' }} />
                            <button onClick={() => cargarPorCodigo(codigoUnir)} style={{ ...btn('#0f172a'), padding: '0 18px' }}>Entrar</button>
                        </div>
                    </div>
                    <div style={card}>
                        <div style={{ fontSize: '2.4rem' }}>🧑‍🏫</div>
                        <h2 style={{ margin: '4px 0 6px' }}>Soy profesor</h2>
                        <p style={{ margin: '0 0 12px', color: '#475569' }}>Coloca las balizas en el patio o en el parque con el GPS del móvil (o tocando el mapa) y genera las hojas para imprimir.</p>
                        <button onClick={() => { setCarrera(nuevaCarrera()); setVista('editor'); }} style={btn(MAGENTA)}>➕ Crear carrera nueva</button>
                        {!usuario && <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '8px 0 0' }}>Sin iniciar sesión se guarda en este dispositivo y se comparte con un enlace largo. Con sesión tendrás un código corto de 6 letras.</p>}
                    </div>
                </div>

                <h3 style={{ margin: '24px 0 10px' }}>Tres formas de jugar</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                    {Object.entries(MODOS).map(([k, m]) => (
                        <div key={k} style={{ ...card, padding: 16 }}>
                            <div style={{ fontSize: '1.8rem' }}>{m.emoji}</div>
                            <b>{m.nombre}</b>
                            <p style={{ margin: '4px 0 0', color: '#475569', fontSize: '0.88rem' }}>{m.desc}</p>
                        </div>
                    ))}
                </div>

                <MisCarreras usuario={usuario} onAbrir={(c) => { setCarrera(c); setVista('editor'); }} />
            </div>
        </div>
    );
}

function MisCarreras({ usuario, onAbrir }) {
    const [nube, setNube] = useState([]);
    const [locales, setLocales] = useState(leerBorradores);
    const [cargando, setCargando] = useState(false);
    useEffect(() => {
        if (!usuario?.uid) { setNube([]); return; }
        setCargando(true);
        getDocs(query(collection(db, COL), where('profesorUid', '==', usuario.uid)))
            .then(s => setNube(s.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => (b.fechaMod || 0) - (a.fechaMod || 0))))
            .catch(() => {}).finally(() => setCargando(false));
    }, [usuario?.uid]);
    const borrar = async (c) => {
        if (!window.confirm(`¿Borrar la carrera «${c.titulo || 'sin título'}»?`)) return;
        if (c.id) { await deleteDoc(doc(db, COL, c.id)); setNube(n => n.filter(x => x.id !== c.id)); }
        else { borrarBorrador(c.localId); setLocales(leerBorradores()); }
    };
    const lista = [...nube, ...locales.filter(l => !l.id)];
    if (!lista.length && !cargando) return null;
    return (
        <>
            <h3 style={{ margin: '24px 0 10px' }}>Mis carreras</h3>
            {cargando && <div style={{ color: '#64748b' }}>Cargando…</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
                {lista.map(c => (
                    <div key={c.id || c.localId} style={{ ...card, padding: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                            <b>{MODOS[c.config?.modo]?.emoji} {c.titulo || 'Sin título'}</b>
                            {c.id ? <span style={{ fontFamily: 'Consolas, monospace', fontWeight: 900, color: MAGENTA }}>{c.id}</span> : <span style={{ fontSize: '0.72rem', color: '#64748b' }}>📱 en este dispositivo</span>}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#64748b', margin: '4px 0 10px' }}>🚩 {c.balizas?.length || 0} balizas · {redondearM(longitudRecorrido(c))} m</div>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => onAbrir({ ...c, config: { ...CONFIG_DEF, ...(c.config || {}) } })} style={{ ...btn('#0f172a'), flex: 1, padding: '8px' }}>✏️ Abrir</button>
                            <button onClick={() => borrar(c)} style={{ ...btn('#fee2e2'), color: '#991b1b', padding: '8px 12px' }}>🗑️</button>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}

// ─────────────────────────────── Editor ───────────────────────────────
function Editor({ carrera, setCarrera, usuario, onProbar, onSalir }) {
    const [capa, setCapa] = useState(carrera.config?.capa || 'satelite');
    const [modoToque, setModoToque] = useState(carrera.salida ? 'baliza' : 'salida');
    const [captura, setCaptura] = useState(null); // { tipo, n, precision } | { error }
    const [guardando, setGuardando] = useState(false);
    const [msg, setMsg] = useState('');
    const [compartir, setCompartir] = useState(false);
    const [imprimir, setImprimir] = useState(false);
    const [ajustar, setAjustar] = useState(1);
    const [abierta, setAbierta] = useState(null);
    const [centro] = useState(() => carrera.salida ? [carrera.salida.lat, carrera.salida.lng] : null);

    const cfg = carrera.config;
    const set = (patch) => setCarrera(c => ({ ...c, ...patch }));
    const setCfg = (patch) => setCarrera(c => ({ ...c, config: { ...c.config, ...patch } }));
    const setBaliza = (i, patch) => setCarrera(c => ({ ...c, balizas: c.balizas.map((b, k) => k === i ? { ...b, ...patch } : b) }));
    const tramos = useMemo(() => tramosDe(carrera), [carrera]);

    // Centrar el mapa en la ubicación del profe al crear
    const [mapa, setMapa] = useState(null);
    useEffect(() => {
        if (!mapa || carrera.salida || carrera.balizas.length || !navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition((p) => mapa.setView([p.coords.latitude, p.coords.longitude], 18), () => {}, { enableHighAccuracy: true, timeout: 8000 });
    }, [mapa]); // eslint-disable-line react-hooks/exhaustive-deps

    const anadirEn = (tipo, lat, lng) => {
        if (tipo === 'salida') { set({ salida: { lat, lng } }); setModoToque('baliza'); }
        else setCarrera(c => ({ ...c, balizas: [...c.balizas, nuevaBaliza(lat, lng)] }));
    };

    const capturar = async (tipo) => {
        setCaptura({ tipo, n: 0, precision: null });
        try {
            const r = await capturarPosicion({ ms: 6000, onProgreso: (p) => setCaptura({ tipo, n: p.n, precision: p.precision }) });
            anadirEn(tipo, r.lat, r.lng);
            mapa?.setView([r.lat, r.lng], Math.max(mapa.getZoom(), 18));
            setCaptura({ tipo, hecho: true, precision: r.precision });
            setTimeout(() => setCaptura(null), 1800);
        } catch (e) { setCaptura({ tipo, error: e.message }); }
    };

    const mover = (i, d) => setCarrera(c => {
        const b = [...c.balizas]; const j = i + d;
        if (j < 0 || j >= b.length) return c;
        [b[i], b[j]] = [b[j], b[i]];
        return { ...c, balizas: b };
    });

    const guardar = async () => {
        setMsg('');
        if (!carrera.balizas.length) { setMsg('⚠️ Añade al menos una baliza.'); return null; }
        const datos = { ...carrera, config: { ...cfg, capa } };
        if (!usuario?.uid) { guardarBorrador(datos); setMsg('💾 Guardada en este dispositivo.'); return datos; }
        setGuardando(true);
        try {
            let id = carrera.id;
            if (!id) {
                for (let k = 0; k < 6 && !id; k++) { const c = codigoAcceso(); const s = await getDoc(doc(db, COL, c)); if (!s.exists()) id = c; }
                if (!id) throw new Error('No se pudo generar un código.');
            }
            const { id: _x, localId, ...resto } = datos;
            await setDoc(doc(db, COL, id), {
                ...resto, profesorUid: usuario.uid, autor: usuario.displayName || usuario.email || '',
                fechaMod: Date.now(), fechaCreacion: carrera.fechaCreacion || Date.now(),
            });
            if (localId) borrarBorrador(localId);
            const nueva = { ...datos, id, localId: undefined };
            setCarrera(nueva);
            setMsg(`✅ Guardada. Código para los alumnos: ${id}`);
            return nueva;
        } catch (e) { setMsg('❌ Error al guardar: ' + e.message); return null; }
        finally { setGuardando(false); }
    };

    const abrirCompartir = async () => { const c = await guardar(); if (c) setCompartir(true); };

    const km = longitudRecorrido(carrera);

    return (
        <div style={fondo}>
            <div style={{ ...barra, flexWrap: 'wrap' }}>
                <button onClick={() => { if (window.confirm('¿Salir del editor? Lo que no hayas guardado se perderá.')) onSalir(); }} style={btnBarra}>←</button>
                <input value={carrera.titulo} onChange={e => set({ titulo: e.target.value })} placeholder="Título de la carrera" style={{ ...inp, flex: '1 1 200px', padding: '8px 12px', fontWeight: 800 }} />
                <button onClick={guardar} disabled={guardando} style={btn('#0f172a')}>{guardando ? '…' : '💾 Guardar'}</button>
                <button onClick={abrirCompartir} style={btn('#0ea5e9')}>🔗 Compartir</button>
                <button onClick={() => setImprimir(true)} disabled={!carrera.balizas.length} style={btn('#16a34a')}>🖨️ Imprimibles</button>
                <button onClick={onProbar} disabled={!carrera.balizas.length} style={btn('#f59e0b')}>🧪 Probar</button>
            </div>
            {msg && <div style={{ maxWidth: 1200, margin: '10px auto 0', padding: '0 16px' }}><div style={{ background: '#f1f5f9', padding: '9px 14px', borderRadius: 10, fontWeight: 700 }}>{msg}</div></div>}

            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '14px 16px 50px', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {/* ── Mapa ── */}
                <div style={{ flex: '1 1 480px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ ...card, padding: 12 }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                            <button onClick={() => capturar('salida')} disabled={!!captura && !captura.error && !captura.hecho} style={{ ...btn('#7c3aed'), flex: '1 1 150px' }}>📍 Salida donde estoy</button>
                            <button onClick={() => capturar('baliza')} disabled={!!captura && !captura.error && !captura.hecho} style={{ ...btn(MAGENTA), flex: '1 1 150px' }}>📍 Baliza donde estoy</button>
                        </div>
                        {captura && (
                            <div style={{ marginBottom: 10, padding: '9px 12px', borderRadius: 10, fontWeight: 700, fontSize: '0.88rem',
                                background: captura.error ? '#fee2e2' : captura.hecho ? '#dcfce7' : '#eff6ff', color: captura.error ? '#991b1b' : captura.hecho ? '#166534' : '#1e40af' }}>
                                {captura.error ? `⚠️ ${captura.error}`
                                    : captura.hecho ? `✅ ${captura.tipo === 'salida' ? 'Salida' : 'Baliza'} colocada (precisión ±${captura.precision} m)`
                                        : `🛰️ Midiendo posición… quédate quieto (${captura.n} lecturas${captura.precision ? `, ±${captura.precision} m` : ''})`}
                                {captura.error && <button onClick={() => setCaptura(null)} style={{ marginLeft: 8, border: 'none', background: 'none', cursor: 'pointer' }}>✕</button>}
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                            <span style={{ fontSize: '0.82rem', color: '#475569', fontWeight: 700 }}>Tocar el mapa añade:</span>
                            {[['salida', '▲ Salida'], ['baliza', '◯ Baliza'], ['nada', '✋ Nada']].map(([k, l]) => (
                                <button key={k} onClick={() => setModoToque(k)} style={{ ...chip, background: modoToque === k ? '#0f172a' : '#f1f5f9', color: modoToque === k ? 'white' : '#334155' }}>{l}</button>
                            ))}
                            <div style={{ flex: 1 }} />
                            <SelectorCapa capa={capa} onCapa={setCapa} compacto />
                            <button onClick={() => setAjustar(a => a + 1)} title="Encuadrar la carrera" style={chip}>⤢</button>
                        </div>
                        <MapaOrientacion carrera={carrera} capa={capa} editable verLineas={!cfg.ordenLibre} alto="min(62vh, 560px)" ajustarKey={ajustar} centroInicial={centro} onMapa={setMapa}
                            onClickMapa={(lat, lng) => modoToque !== 'nada' && anadirEn(modoToque, lat, lng)}
                            onMoverBaliza={(i, lat, lng) => setBaliza(i, { lat, lng })}
                            onMoverSalida={(lat, lng) => set({ salida: { lat, lng } })}
                            onClickBaliza={(i) => setAbierta(carrera.balizas[i]?.id)} />
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 6 }}>
                            Arrastra los marcadores para ajustarlos. Con el móvil, ve a cada sitio y pulsa «Baliza donde estoy»: se hace la media de 6 segundos de GPS.
                            {' '}Recorrido: <b>{redondearM(km)} m</b>.
                        </div>
                    </div>

                    {tramos.length > 0 && (
                        <div style={{ ...card, padding: 12 }}>
                            <b>Indicaciones que verá el alumno</b>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginTop: 6 }}>
                                    <thead><tr style={{ color: '#64748b', textAlign: 'left' }}><th style={th}>Tramo</th><th style={th}>N/S + E/O</th><th style={th}>8 direcciones</th><th style={th}>Rumbo</th></tr></thead>
                                    <tbody>
                                        {tramos.map((t, i) => (
                                            <tr key={i} style={{ borderTop: '1px solid #e2e8f0' }}>
                                                <td style={td}><b>{t.desde.esSalida ? '▲' : t.desde.num} → {t.hasta.esMeta ? '◎' : t.hasta.num}</b></td>
                                                <td style={td}>{t.ind.componentes}</td><td style={td}>{t.ind.rosa8}</td><td style={td}>{fmtGrados(t.ind.rumbo)} · {t.ind.distancia} m</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Panel derecho ── */}
                <div style={{ flex: '1 1 340px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ ...card, padding: 14 }}>
                        <b>Cómo se juega</b>
                        <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                            {Object.entries(MODOS).map(([k, m]) => (
                                <label key={k} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 10, cursor: 'pointer', border: `2px solid ${cfg.modo === k ? MAGENTA : '#e2e8f0'}`, background: cfg.modo === k ? '#fdf4ff' : 'white' }}>
                                    <input type="radio" checked={cfg.modo === k} onChange={() => setCfg({ modo: k })} style={{ marginTop: 3 }} />
                                    <span><b>{m.emoji} {m.nombre}</b><br /><span style={{ fontSize: '0.78rem', color: '#64748b' }}>{m.desc}</span></span>
                                </label>
                            ))}
                        </div>
                        {cfg.modo === 'cardinal' && (
                            <Fila label="Formato">
                                <select value={cfg.formatoCardinal} onChange={e => setCfg({ formatoCardinal: e.target.value })} style={sel}>
                                    <option value="componentes">«20 m al Norte y luego 15 m al Este»</option>
                                    <option value="rosa8">«25 m hacia el Noreste» (8 direcciones)</option>
                                </select>
                            </Fila>
                        )}
                        {cfg.modo === 'mapa' && <>
                            <Check v={cfg.ordenLibre} on={(v) => setCfg({ ordenLibre: v })}>Orden libre (score): las balizas se pueden hacer en cualquier orden</Check>
                            <Check v={cfg.mostrarPosicion} on={(v) => setCfg({ mostrarPosicion: v })}>Mostrar la posición del alumno en el mapa (más fácil)</Check>
                        </>}
                        <Fila label="Validar la baliza con">
                            <select value={cfg.validacion} onChange={e => setCfg({ validacion: e.target.value })} style={sel}>
                                <option value="gps_o_codigo">GPS automático o código</option>
                                <option value="gps">Solo GPS</option>
                                <option value="codigo">Solo el código impreso (sin GPS)</option>
                            </select>
                        </Fila>
                        {cfg.validacion !== 'codigo' && (
                            <Fila label={`Radio de llegada: ${cfg.radio} m`}>
                                <input type="range" min={5} max={30} value={cfg.radio} onChange={e => setCfg({ radio: +e.target.value })} style={{ width: '100%' }} />
                            </Fila>
                        )}
                        <Check v={cfg.metaEnSalida} on={(v) => setCfg({ metaEnSalida: v })}>Al final se vuelve a la salida (meta = salida)</Check>
                        <Check v={cfg.mostrarPasos} on={(v) => setCfg({ mostrarPasos: v })}>Mostrar la distancia también en pasos</Check>
                        {cfg.mostrarPasos && (
                            <Fila label={`Longitud del paso: ${Math.round(cfg.longPaso * 100)} cm`}>
                                <input type="range" min={40} max={90} value={Math.round(cfg.longPaso * 100)} onChange={e => setCfg({ longPaso: +e.target.value / 100 })} style={{ width: '100%' }} />
                            </Fila>
                        )}
                        {cfg.modo !== 'mapa' && cfg.validacion !== 'codigo' && <Check v={cfg.pistaCaliente} on={(v) => setCfg({ pistaCaliente: v })}>Pista «frío / caliente» con el GPS</Check>}
                        <Fila label="Descripción para el alumno (opcional)">
                            <textarea value={carrera.descripcion} onChange={e => set({ descripcion: e.target.value })} rows={2} style={{ ...inp, fontSize: '0.88rem', resize: 'vertical' }} />
                        </Fila>
                    </div>

                    <div style={{ ...card, padding: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <b>Balizas ({carrera.balizas.length})</b>
                            {carrera.salida ? <span style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 700 }}>▲ Salida colocada</span> : <span style={{ fontSize: '0.78rem', color: '#b45309', fontWeight: 700 }}>▲ Falta la salida</span>}
                        </div>
                        {!carrera.balizas.length && <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Toca el mapa o usa «Baliza donde estoy».</p>}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                            {carrera.balizas.map((b, i) => (
                                <div key={b.id} style={{ border: `2px solid ${abierta === b.id ? MAGENTA : '#e2e8f0'}`, borderRadius: 12, padding: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ width: 28, height: 28, borderRadius: '50%', border: `3px solid ${MAGENTA}`, color: MAGENTA, fontWeight: 900, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                                        <input value={b.nombre} onChange={e => setBaliza(i, { nombre: e.target.value })} placeholder="Lugar (solo lo ve el profe)" style={{ ...inp, padding: '6px 9px', fontSize: '0.85rem' }} />
                                        <span title="Código impreso en la baliza" style={{ fontFamily: 'Consolas, monospace', fontWeight: 900, letterSpacing: 2 }}>{b.codigo}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                                        <button onClick={() => setAbierta(abierta === b.id ? null : b.id)} style={chip}>{b.pregunta ? '❓ Pregunta ✓' : '❓ Pregunta'}</button>
                                        <button onClick={() => mapa?.setView([b.lat, b.lng], 19)} style={chip}>🔍</button>
                                        <button onClick={() => mover(i, -1)} disabled={i === 0} style={chip}>↑</button>
                                        <button onClick={() => mover(i, 1)} disabled={i === carrera.balizas.length - 1} style={chip}>↓</button>
                                        <button onClick={() => setBaliza(i, { codigo: codigoAleatorio(3) })} style={chip} title="Otro código">🎲</button>
                                        <button onClick={() => setCarrera(c => ({ ...c, balizas: c.balizas.filter((_, k) => k !== i) }))} style={{ ...chip, color: '#b91c1c' }}>🗑️</button>
                                    </div>
                                    {abierta === b.id && (
                                        <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                                            <input value={b.pregunta} onChange={e => setBaliza(i, { pregunta: e.target.value })} placeholder="Pregunta que aparece al encontrarla (opcional)" style={{ ...inp, padding: '7px 10px', fontSize: '0.85rem' }} />
                                            <input value={b.respuesta} onChange={e => setBaliza(i, { respuesta: e.target.value })} placeholder="Respuesta correcta (vacío = respuesta libre)" style={{ ...inp, padding: '7px 10px', fontSize: '0.85rem' }} />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {compartir && <ModalCompartir carrera={carrera} onClose={() => setCompartir(false)} />}
            {imprimir && <ImprimiblesOrientacion carrera={{ ...carrera, config: { ...cfg, capa } }} enlace={carrera.id || carrera.balizas.length <= 12 ? enlaceCarrera(carrera) : null} onClose={() => setImprimir(false)} />}
        </div>
    );
}

function ModalCompartir({ carrera, onClose }) {
    const url = enlaceCarrera(carrera);
    const [copiado, setCopiado] = useState(false);
    const largo = url.length > 900;
    const copiar = () => { navigator.clipboard?.writeText(url).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1600); }); };
    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 12000, background: 'rgba(8,12,24,.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ ...card, maxWidth: 420, width: '100%', textAlign: 'center' }}>
                <h3 style={{ marginTop: 0 }}>🔗 Compartir con los alumnos</h3>
                {carrera.id && <div style={{ fontSize: '2.2rem', fontWeight: 900, letterSpacing: 6, color: MAGENTA, fontFamily: 'Consolas, monospace' }}>{carrera.id}</div>}
                {carrera.id && <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: 8 }}>Código para escribir en pikt.es/orientacion</div>}
                {!largo && <img alt="QR" src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(url)}&margin=8`} style={{ width: 220, height: 220 }} />}
                {largo && <p style={{ color: '#b45309', fontSize: '0.85rem' }}>El enlace es demasiado largo para un QR. Inicia sesión y guarda la carrera para tener un código corto.</p>}
                {!carrera.id && <p style={{ fontSize: '0.8rem', color: '#64748b' }}>La carrera viaja dentro del enlace (sin sesión). Si la cambias, vuelve a compartirla.</p>}
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <input readOnly value={url} onFocus={e => e.target.select()} style={{ ...inp, fontSize: '0.75rem' }} />
                    <button onClick={copiar} style={btn('#0f172a')}>{copiado ? '✓' : 'Copiar'}</button>
                </div>
                {navigator.share && <button onClick={() => navigator.share({ title: carrera.titulo || 'Carrera de orientación', url }).catch(() => {})} style={{ ...btn('#0ea5e9'), width: '100%', marginTop: 8 }}>📲 Compartir…</button>}
                <button onClick={onClose} style={{ ...btn('#e2e8f0'), color: '#334155', width: '100%', marginTop: 8 }}>Cerrar</button>
            </div>
        </div>
    );
}

const Fila = ({ label, children }) => <div style={{ marginTop: 10 }}><div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>{label}</div>{children}</div>;
const Check = ({ v, on, children }) => <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 10, fontSize: '0.86rem', cursor: 'pointer' }}><input type="checkbox" checked={!!v} onChange={e => on(e.target.checked)} style={{ marginTop: 3 }} />{children}</label>;

const fondo = { position: 'fixed', inset: 0, zIndex: 9999, overflowY: 'auto', background: 'linear-gradient(160deg,#fdf4ff,#ecfeff)', fontFamily: "'Segoe UI', system-ui, sans-serif", color: '#0f172a' };
const barra = { position: 'sticky', top: 0, zIndex: 1000, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'rgba(255,255,255,.94)', backdropFilter: 'blur(6px)', borderBottom: '1px solid #e2e8f0' };
const btnBarra = { border: 'none', background: '#f1f5f9', borderRadius: 10, padding: '8px 12px', fontWeight: 800, cursor: 'pointer' };
const card = { background: 'white', borderRadius: 18, padding: 20, boxShadow: '0 6px 24px rgba(15,23,42,.08)' };
const inp = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '2px solid #e2e8f0', fontSize: '0.95rem', outline: 'none', fontFamily: 'inherit' };
const sel = { ...inp, padding: '8px 10px', fontSize: '0.85rem' };
const btn = (bg) => ({ padding: '9px 14px', borderRadius: 11, border: 'none', background: bg, color: 'white', fontWeight: 800, cursor: 'pointer', fontSize: '0.88rem' });
const chip = { border: 'none', background: '#f1f5f9', borderRadius: 8, padding: '5px 9px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem', color: '#334155' };
const th = { padding: '5px 6px' };
const td = { padding: '5px 6px' };
