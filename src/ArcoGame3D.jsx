import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { doc, getDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { validarNombre } from './utils/filtroNombres';
import { guardarRegistroLocal } from './utils/registrosLocales';
import { sonidoCorrecto, sonidoIncorrecto, sonidoFinal, sonidoActivo, setSonidoActivo } from './utils/sonidosFeedback';
import { categoriasDeRecurso, conOpcionesParaElegir, barajar } from './utils/normalizarPreguntas';
import { conRecursosPikt } from './bancoPreguntas/recursosPikt';
import HojasRecurso, { filtrarHojas, textoHojas } from './components/HojasRecurso';
import { ValoracionRecurso, OrdenRecursos, ordenarRecursos } from './components/ValoracionRecurso';
import { contarJugada } from './utils/valoracionRecursos';
import { leerCompeticionUrl, soloPrimitivos } from './utils/retoLink';
import ModalEnviarCompeticion from './components/ModalEnviarCompeticion';
import { AREAS_OVNI, BANCOS_OVNI, parsearCategorias, crearGeneradorPalabras } from './ovniBancos';
import { TIPOS_MATES, crearGeneradorMates } from './ovniMates';
import { crearArco, COLORES_OPCION, LETRAS } from './arco/motorArco';
import { cargarModelosGranja } from './ovniModelos';

// ─── Tiro con arco (three.js) ────────────────────────────────────────────────
// Campo de tiro al aire libre. Dos modos:
//   · Preguntas: 4 dianas con las respuestas A-D → clava la flecha en la correcta.
//   · Clases de palabras (como el Ovni): 8 dianas con palabras → acierta todas las de la categoría.
// Tensar, apuntar y soltar con física de la flecha (gravedad, aire y viento).
// Ratón/teclado, pantalla táctil y gafas VR (agarras la cuerda y tiras hacia atrás).

const FUENTE = "'Segoe UI', system-ui, sans-serif";
const VERDE = '#7cb342', ORO = '#ffca28', CREMA = '#fff8e1';
const LS_CFG = 'pikt_arco_cfg';
const LS_CUSTOM = 'pikt_arco_custom';
const EJEMPLO_CUSTOM = 'Sustantivos: mesa, perro, casa, libro, árbol, ciudad\nVerbos: correr, saltar, leer, comer, escribir, dormir\nAdjetivos: azul, rápido, alto, feliz, suave, fuerte';
const leerCfg = () => { try { return JSON.parse(localStorage.getItem(LS_CFG) || '{}') || {}; } catch { return {}; } };
const fondo = { position: 'fixed', inset: 0, zIndex: 9990, overflowY: 'auto', background: 'linear-gradient(170deg,#1b3a1f 0%,#2e5a2a 45%,#4f7f34 100%)', color: 'white', fontFamily: FUENTE };
const titulo = { fontSize: 'clamp(1.8rem,5vw,2.4rem)', fontWeight: 900, margin: '0 0 6px', color: CREMA, textShadow: '0 3px 14px rgba(0,0,0,0.45)' };
const boton = (bg, extra = {}) => ({ padding: '12px 22px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '1rem', color: 'white', background: bg, fontFamily: FUENTE, ...extra });
const chip = (activo, color = ORO) => ({ padding: '9px 14px', borderRadius: 10, border: `2px solid ${activo ? color : 'rgba(255,255,255,0.18)'}`, background: activo ? `${color}33` : 'rgba(255,255,255,0.07)', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: FUENTE, textAlign: 'left' });
const h4 = { margin: '18px 0 8px', color: ORO, fontSize: '0.85rem', letterSpacing: 1, textTransform: 'uppercase' };

// ─── Realidad virtual (WebXR): la sesión se pide dentro del clic ─────────────
const OPCIONES_XR = { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] };
function useVRSoportado() {
    const [ok, setOk] = useState(false);
    useEffect(() => {
        let vivo = true;
        if (typeof navigator !== 'undefined' && navigator.xr?.isSessionSupported) {
            navigator.xr.isSessionSupported('immersive-vr').then(r => { if (vivo) setOk(!!r); }).catch(() => { });
        }
        return () => { vivo = false; };
    }, []);
    return ok;
}
const pedirSesionVR = () => navigator.xr.requestSession('immersive-vr', OPCIONES_XR);
const esTactil = () => typeof window !== 'undefined' && (('ontouchstart' in window) || navigator.maxTouchPoints > 0);

/** Preguntas de elegir (A-D) del recurso y hojas elegidos. */
function preguntasPara(recurso, hoja) {
    const lista = filtrarHojas(categoriasDeRecurso(recurso), hoja).flatMap(c => c.preguntas);
    return barajar(conOpcionesParaElegir(lista).filter(p => p && p.tipo === 'MULTIPLE' && Array.isArray(p.opciones) && p.opciones.length >= 2))
        .map(p => ({ ...p, opciones: barajar(p.opciones.slice(0, 4).includes(p.correcta) ? p.opciones.slice(0, 4) : [p.correcta, ...p.opciones.filter(o => o !== p.correcta).slice(0, 3)]) }));
}

// ═══════════════════════════ COMPONENTE PRINCIPAL ═════════════════════════
export default function ArcoGame3D({ alTerminar, recurso: recursoInicial = null }) {
    const [pantalla, setPantalla] = useState(recursoInicial ? 'HOJA' : 'INICIO'); // INICIO | HOJA | CONFIG | JUEGO | FIN
    const [contenido, setContenido] = useState(null); // { modo, titulo, recursoId, hoja, preguntas | generar, rondasMax, config }
    const [partida, setPartida] = useState(null);
    const [resultado, setResultado] = useState(null);
    const vrSoportado = useVRSoportado();
    const salir = () => alTerminar && alTerminar();

    const elegirRecurso = (r, hoja) => {
        const preguntas = preguntasPara(r, hoja);
        if (!preguntas.length) { alert('Este recurso no tiene preguntas de elegir entre opciones.'); return; }
        setContenido({ modo: 'preguntas', titulo: r.titulo || 'Recurso', recursoId: r.esPikt ? null : r.id, hoja: textoHojas(hoja), preguntas });
        setPantalla('CONFIG');
    };

    const empezar = async (cfg, conVR) => {
        let xrSession = null;
        if (conVR) {
            try { xrSession = await pedirSesionVR(); } catch (e) { console.warn(e); alert('No se pudo abrir el modo de realidad virtual en este navegador.'); return; }
        }
        // cacería: los animales del Ovni (.glb); si no cargan, salen animales sencillos
        const modelos = cfg.escenario === 'caza' ? await cargarModelosGranja().catch(() => null) : null;
        const base = contenido.modo === 'preguntas'
            ? { preguntas: barajar(contenido.preguntas).slice(0, cfg.nPreguntas || contenido.preguntas.length) }
            : { generarRonda: contenido.crearGenerador(cfg.rondas), rondas: cfg.rondas };
        setPartida({ ...cfg, ...base, modelos, modo: contenido.modo, xrSession, k: Date.now() });
        setResultado(null);
        setPantalla('JUEGO');
    };

    const alFinal = (res) => {
        setResultado(res);
        setPantalla('FIN');
        if (res.ganado) sonidoFinal();
        guardarRegistroLocal('ARCO', {
            titulo: `Tiro con arco · ${contenido?.titulo || ''}`,
            aciertos: res.aciertos, intentos: res.aciertos + res.fallos,
            porcentaje: res.aciertos + res.fallos ? Math.round((res.aciertos / (res.aciertos + res.fallos)) * 100) : 0,
            puntuacion: res.puntos, via: 'juego',
        });
    };

    let vista = null;
    if (pantalla === 'INICIO') {
        vista = <PantallaInicio onSalir={salir} onRecurso={elegirRecurso}
            onPalabras={(c) => { setContenido({ modo: 'palabras', ...c }); setPantalla('CONFIG'); }} />;
    } else if (pantalla === 'HOJA' && recursoInicial) {
        vista = (
            <div style={{ ...fondo, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 20 }}>
                <div style={{ fontSize: '3rem' }}>🏹</div>
                <div style={{ width: '100%', maxWidth: 820 }}>
                    <HojasRecurso recurso={recursoInicial} color={VERDE} colores={COLORES_OPCION} bajar={false} textoContinuar="🏹 Continuar" onElegir={(h) => elegirRecurso(recursoInicial, h)} />
                </div>
                <button style={boton('rgba(255,255,255,0.12)')} onClick={salir}>← Salir</button>
            </div>
        );
    } else if (pantalla === 'CONFIG' && contenido) {
        vista = <PantallaConfig contenido={contenido} vrSoportado={vrSoportado} onVolver={() => setPantalla(recursoInicial ? 'HOJA' : 'INICIO')} onEmpezar={empezar} />;
    } else if (pantalla === 'JUEGO' && partida) {
        vista = <Juego key={partida.k} partida={partida} onFin={alFinal} onSalir={() => setPantalla('CONFIG')} />;
    } else if (pantalla === 'FIN' && resultado) {
        vista = <Resultados resultado={resultado} contenido={contenido} partida={partida} vrSoportado={vrSoportado}
            onOtra={(vr) => empezar(partida, vr)} onMenu={() => setPantalla('CONFIG')} onSalir={salir} />;
    }
    // Por encima de la cabecera fija de la portada (Login) y del anotador
    return <div style={{ position: 'fixed', inset: 0, zIndex: 9990 }}>{vista}</div>;
}

// ═══════════════════════════ INICIO: MODO Y CONTENIDO ══════════════════════
function PantallaInicio({ onSalir, onRecurso, onPalabras }) {
    const [modo, setModo] = useState(null);
    return (
        <div style={{ ...fondo, padding: '20px 16px 40px' }}>
            <div style={{ maxWidth: 920, margin: '0 auto' }}>
                <button onClick={onSalir} style={boton('rgba(255,255,255,0.12)', { padding: '8px 14px', fontSize: '0.85rem' })}>← Salir</button>
                <div style={{ textAlign: 'center', margin: '8px 0 18px' }}>
                    <div style={{ fontSize: '3.2rem' }}>🏹</div>
                    <h1 style={titulo}>Tiro con arco</h1>
                    <p style={{ color: '#dcedc8', margin: '0 auto', maxWidth: 640, lineHeight: 1.5 }}>
                        Tensa el arco, apunta y suelta. La flecha cae con la distancia y el viento la desvía: ¡clávala en la diana correcta!
                    </p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 14 }}>
                    {[
                        ['preguntas', '🎯', 'Preguntas de 4 respuestas', 'Cuatro dianas con las respuestas A, B, C y D. Dispara a la correcta.'],
                        ['palabras', '🏷️', 'Clases de palabras', 'Ocho dianas con palabras o números. Acierta todas las que pertenecen a la categoría (verbos, primos…).'],
                    ].map(([id, emoji, t, d]) => (
                        <button key={id} onClick={() => setModo(id)} style={{ ...chip(modo === id), padding: '18px 20px', borderRadius: 16 }}>
                            <div style={{ fontSize: '2rem' }}>{emoji}</div>
                            <div style={{ fontSize: '1.15rem', fontWeight: 900, margin: '4px 0' }}>{t}</div>
                            <div style={{ color: '#dcedc8', fontWeight: 500, fontSize: '0.88rem', lineHeight: 1.4 }}>{d}</div>
                        </button>
                    ))}
                </div>
                {modo === 'preguntas' && <ElegirRecurso onElegir={onRecurso} />}
                {modo === 'palabras' && <ElegirPalabras onElegir={onPalabras} />}
            </div>
        </div>
    );
}

function ElegirRecurso({ onElegir }) {
    const [recursos, setRecursos] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [sel, setSel] = useState(null);
    const [filtro, setFiltro] = useState('');
    const [orden, setOrden] = useState('jugados');
    useEffect(() => {
        (async () => {
            try {
                const snap = await getDocs(query(collection(db, 'resources'), where('tipoJuego', '==', 'CAZABURBUJAS'), where('isPrivate', '==', false)));
                setRecursos(await conRecursosPikt(snap.docs.map(d => ({ id: d.id, ...d.data() })), 'CAZABURBUJAS'));
            } catch (e) { console.error('Arco:', e); }
            setCargando(false);
        })();
    }, []);
    const filtrados = recursos.filter(r => !filtro || `${r.titulo} ${r.temas || ''} ${r.ciclo || ''}`.toLowerCase().includes(filtro.toLowerCase()));
    const lista = ordenarRecursos(filtrados, orden);
    return (
        <div style={{ marginTop: 22 }}>
            <input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="🔎 Buscar recurso, tema o curso…"
                style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '1.5px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '0.95rem', marginBottom: 12, boxSizing: 'border-box' }} />
            <OrdenRecursos valor={orden} onChange={setOrden} oscuro color={ORO} style={{ marginBottom: 12 }} />
            {cargando ? <p style={{ color: '#dcedc8' }}>Cargando recursos…</p> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10, maxHeight: '46vh', overflowY: 'auto', paddingRight: 4 }}>
                    {lista.length === 0 && <p style={{ color: '#dcedc8' }}>No hay recursos con ese filtro.</p>}
                    {lista.map(r => (
                        <div key={r.id} onClick={() => setSel(r)} style={{ background: sel?.id === r.id ? 'rgba(255,202,40,0.22)' : 'rgba(0,0,0,0.18)', border: `2px solid ${sel?.id === r.id ? ORO : 'rgba(255,255,255,0.12)'}`, borderRadius: 14, padding: '12px 14px', cursor: 'pointer' }}>
                            <div style={{ fontWeight: 700, marginBottom: 4 }}>{r.esPikt ? 'π ' : '📚 '}{r.titulo}</div>
                            <div style={{ color: '#dcedc8', fontSize: '0.78rem' }}>{r.temas || r.profesorNombre || ''}{r.ciclo ? ` · ${r.ciclo}` : ''} · {r.hojas?.length || 1} hoja(s)</div>
                            <ValoracionRecurso r={r} oscuro style={{ marginTop: 6 }} />
                        </div>
                    ))}
                </div>
            )}
            {sel && (
                <div style={{ marginTop: 16 }}>
                    <HojasRecurso key={sel.id} recurso={sel} color={VERDE} colores={COLORES_OPCION} textoContinuar="🏹 Continuar" onElegir={(h) => { contarJugada(sel); onElegir(sel, h); }} />
                </div>
            )}
        </div>
    );
}

function ElegirPalabras({ onElegir }) {
    const [area, setArea] = useState('LENGUA');
    const [bancoId, setBancoId] = useState(() => BANCOS_OVNI.find(b => b.area === 'LENGUA')?.id || 'custom');
    const [tiposMates, setTiposMates] = useState(() => TIPOS_MATES.map(t => t.id));
    const [nivelMates, setNivelMates] = useState('primaria');
    const [texto, setTexto] = useState(() => { try { return localStorage.getItem(LS_CUSTOM) || localStorage.getItem('pikt_ovni_custom') || EJEMPLO_CUSTOM; } catch { return EJEMPLO_CUSTOM; } });
    const custom = bancoId === 'custom', numeros = bancoId === 'numeros';
    const cats = custom ? parsearCategorias(texto) : null;
    const banco = BANCOS_OVNI.find(b => b.id === bancoId);
    const puede = custom ? !!cats : numeros ? tiposMates.length > 0 : !!banco?.categorias;
    const elegirArea = (id) => { setArea(id); setBancoId(id === 'MATEMATICAS' ? 'numeros' : (BANCOS_OVNI.find(b => b.area === id)?.id || 'custom')); };
    const continuar = () => {
        if (!puede) return;
        if (custom) { try { localStorage.setItem(LS_CUSTOM, texto); } catch { /* */ } }
        const categorias = numeros ? null : custom ? cats : banco.categorias;
        onElegir({
            titulo: numeros ? `Números (${nivelMates === 'eso' ? 'ESO' : 'Primaria'})` : custom ? 'Mis categorías' : banco.nombre,
            recursoId: null, hoja: 'General',
            crearGenerador: (n) => (numeros ? crearGeneradorMates(tiposMates, nivelMates) : crearGeneradorPalabras(categorias, n)),
            config: {
                origen: numeros ? 'numeros' : custom ? 'propias' : 'banco',
                materia: custom ? 'Propias' : (AREAS_OVNI.find(a => a.id === area)?.label || ''),
                ...(numeros ? { nivel: nivelMates, tipos: TIPOS_MATES.filter(t => tiposMates.includes(t.id)).map(t => t.nombre) } : { categorias: Object.keys(categorias || {}) }),
            },
        });
    };
    return (
        <div style={{ marginTop: 22 }}>
            <div style={h4}>Materia</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {AREAS_OVNI.map(a => (
                    <button key={a.id} onClick={() => elegirArea(a.id)} style={{ ...chip(area === a.id && !custom, a.color), padding: '7px 12px', fontSize: '0.88rem', ...(area === a.id && !custom ? { background: a.color } : {}) }}>{a.emoji} {a.label}</button>
                ))}
                <button onClick={() => setBancoId('custom')} style={{ ...chip(custom, VERDE), padding: '7px 12px', fontSize: '0.88rem' }}>✏️ Mis categorías</button>
            </div>
            {!custom && (<>
                <div style={h4}>Contenido</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10 }}>
                    {area === 'MATEMATICAS' && (
                        <button onClick={() => setBancoId('numeros')} style={chip(numeros)}>
                            🔢 Números (generador)
                            <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#dcedc8', marginTop: 4 }}>Primos, divisores, múltiplos, fracciones, potencias…</div>
                        </button>
                    )}
                    {BANCOS_OVNI.filter(b => b.area === area && b.categorias).map(b => (
                        <button key={b.id} onClick={() => setBancoId(b.id)} style={chip(bancoId === b.id)}>
                            {b.emoji} {b.nombre}
                            <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#dcedc8', marginTop: 4 }}>{Object.keys(b.categorias).join(' · ')}</div>
                        </button>
                    ))}
                </div>
            </>)}
            {custom && (
                <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: '0.85rem', color: '#dcedc8', marginBottom: 6 }}>Una categoría por línea: <code style={{ color: ORO }}>Categoría: palabra, palabra, palabra</code> (mínimo 2 categorías con 2 palabras).</div>
                    <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={6}
                        style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.3)', color: '#fff', border: `1px solid ${cats ? VERDE : '#ef9a9a'}`, borderRadius: 10, padding: 10, fontSize: '0.95rem', fontFamily: 'inherit' }} />
                    {!cats && <div style={{ color: '#ffcdd2', fontSize: '0.85rem' }}>Faltan categorías: necesitas al menos 2 con 2 palabras cada una.</div>}
                </div>
            )}
            {numeros && (
                <div style={{ marginTop: 12, background: 'rgba(0,0,0,0.18)', borderRadius: 12, padding: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 8 }}>
                        {TIPOS_MATES.map(t => (
                            <button key={t.id} onClick={() => setTiposMates(ts => (ts.includes(t.id) ? ts.filter(x => x !== t.id) : [...ts, t.id]))} style={{ ...chip(tiposMates.includes(t.id)), padding: '8px 10px' }}>
                                {tiposMates.includes(t.id) ? '☑' : '☐'} {t.emoji} {t.nombre}
                            </button>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                        {[['primaria', '🎒 Primaria'], ['eso', '🎓 ESO']].map(([id, t]) => <button key={id} onClick={() => setNivelMates(id)} style={chip(nivelMates === id)}>{t}</button>)}
                    </div>
                </div>
            )}
            <div style={{ textAlign: 'center', marginTop: 22 }}>
                <button disabled={!puede} onClick={continuar} style={boton(puede ? 'linear-gradient(135deg,#7cb342,#33691e)' : 'rgba(255,255,255,0.15)', { fontSize: '1.1rem', padding: '13px 30px', cursor: puede ? 'pointer' : 'not-allowed' })}>🏹 Continuar</button>
            </div>
        </div>
    );
}

// ═══════════════════════════ CONFIGURACIÓN ═════════════════════════════════
function PantallaConfig({ contenido, vrSoportado, onVolver, onEmpezar }) {
    const g = leerCfg();
    const preguntas = contenido.modo === 'preguntas';
    const nDisp = preguntas ? contenido.preguntas.length : 0;
    const [nPreguntas, setNPreguntas] = useState(Math.min(g.nPreguntas || 10, nDisp || 10));
    const [rondas, setRondas] = useState(g.rondas || 5);
    const [distancia, setDistancia] = useState(g.distancia || 'media');
    const [ayuda, setAyuda] = useState(g.ayuda || 'trayectoria');
    const [viento, setViento] = useState(g.viento || 'sin');
    const [movil, setMovil] = useState(!!g.movil);
    const [vidas, setVidas] = useState(g.vidas ?? 3);
    const [manoArco, setManoArco] = useState(g.manoArco || 'left');
    const [escenario, setEscenario] = useState(g.escenario === 'caza' ? 'caza' : 'campo');
    const caza = escenario === 'caza';
    useEffect(() => { if (caza) cargarModelosGranja().catch(() => { }); }, [caza]); // se van descargando mientras se configura
    const Op = ({ val, set, ops }) => (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ops.map(([v, t]) => <button key={String(v)} onClick={() => set(v)} style={{ ...chip(val === v), textAlign: 'center' }}>{t}</button>)}
        </div>
    );
    const cfg = () => {
        const c = { nPreguntas: Math.min(nPreguntas, nDisp), rondas, distancia, ayuda: caza ? 'trayectoria' : ayuda, viento, movil, vidas, manoArco, escenario };
        try { localStorage.setItem(LS_CFG, JSON.stringify(c)); } catch { /* */ }
        return c;
    };
    const opcionesN = [5, 10, 15, 20].filter(n => n < nDisp);
    return (
        <div style={{ ...fondo, padding: '20px 16px 40px' }}>
            <div style={{ maxWidth: 780, margin: '0 auto' }}>
                <button onClick={onVolver} style={boton('rgba(255,255,255,0.12)', { padding: '8px 14px', fontSize: '0.85rem' })}>← Contenido</button>
                <h1 style={{ ...titulo, marginTop: 14 }}>Prepara la tirada</h1>
                <p style={{ color: '#dcedc8', margin: 0 }}>
                    {preguntas ? '🎯 ' : '🏷️ '}{contenido.titulo}{contenido.hoja && contenido.hoja !== 'General' ? ` · ${contenido.hoja}` : ''}{preguntas ? ` · ${nDisp} preguntas` : ''}
                </p>

                <div style={h4}>Escenario</div>
                <Op val={escenario} set={setEscenario} ops={[['campo', '🎯 Campo de tiro (dianas)'], ['caza', '🐄 Cacería (te mueves entre animales)']]} />
                <div style={{ color: '#dcedc8', fontSize: '0.82rem', marginTop: 6 }}>
                    {caza
                        ? 'Caminas por el prado y las respuestas van sobre animales que pasean despacio. Al empezar a tensar, verás la trayectoria de la flecha y los animales se quedarán quietos 4 segundos.'
                        : 'Tiras desde el puesto de tiro a dianas con las respuestas.'}
                </div>

                {preguntas ? (<>
                    <div style={h4}>Preguntas</div>
                    <Op val={Math.min(nPreguntas, nDisp)} set={setNPreguntas} ops={[...opcionesN.map(n => [n, String(n)]), [nDisp, `Todas (${nDisp})`]]} />
                </>) : (<>
                    <div style={h4}>Rondas</div>
                    <Op val={rondas} set={setRondas} ops={[[3, '3'], [5, '5'], [8, '8']]} />
                </>)}

                <div style={h4}>Distancia de las dianas</div>
                <Op val={distancia} set={setDistancia} ops={[['cerca', '🟢 Cerca (8-14 m)'], ['media', '🟡 Media (12-22 m)'], ['lejos', '🔴 Lejos (18-32 m)']]} />

                {!caza && (<>
                <div style={h4}>Ayuda para apuntar</div>
                <Op val={ayuda} set={setAyuda} ops={[['trayectoria', '〰️ Ver la trayectoria'], ['pines', '📍 Mira con pines'], ['ninguna', '🎯 Sin ayuda (realista)']]} />
                <div style={{ color: '#dcedc8', fontSize: '0.82rem', marginTop: 6 }}>
                    {ayuda === 'trayectoria' && 'Mientras tensas se dibuja el camino que hará la flecha y dónde caerá.'}
                    {ayuda === 'pines' && 'Como la mira de un arco de verdad: con el arco tensado a tope, pon el pin de 10, 20 o 30 m sobre la diana según lo lejos que esté.'}
                    {ayuda === 'ninguna' && 'Solo la cruz: tendrás que apuntar por encima de las dianas lejanas, porque la flecha cae.'}
                </div>

                <div style={h4}>Dianas</div>
                <Op val={movil} set={setMovil} ops={[[false, '🧱 Quietas'], [true, '↔️ En movimiento']]} />
                </>)}

                <div style={h4}>Viento</div>
                <Op val={viento} set={setViento} ops={[['sin', '🍃 Sin viento'], ['suave', '💨 Suave'], ['fuerte', '🌬️ Fuerte']]} />

                <div style={h4}>Vidas</div>
                <Op val={vidas} set={setVidas} ops={[[3, '❤️❤️❤️ 3'], [5, '5'], [0, '∞ Sin límite']]} />

                <div style={h4}>Mano del arco (para las gafas VR)</div>
                <Op val={manoArco} set={setManoArco} ops={[['left', '🫲 Izquierda (diestros)'], ['right', '🫱 Derecha (zurdos)']]} />

                <div style={{ marginTop: 20, background: 'rgba(0,0,0,0.22)', borderRadius: 14, padding: '12px 16px', lineHeight: 1.6, fontSize: '0.9rem', color: '#f1f8e9' }}>
                    <b style={{ color: ORO }}>Cómo se tira</b><br />
                    🖱️ <b>Ratón:</b> mantén pulsado el botón izquierdo para tensar, mueve el ratón para apuntar y suelta para disparar. Clic derecho = soltar sin disparar. <b>Mayús</b> = contener la respiración (el pulso tiembla menos).<br />
                    ⌨️ <b>Teclado:</b> flechas o WASD para apuntar, <b>Espacio</b> mantenido para tensar.<br />
                    👆 <b>Táctil:</b> arrastra el dedo para apuntar y mantén el botón 🏹 para tensar; mientras lo mantienes puedes deslizarlo para afinar.<br />
                    🐄 <b>Cacería:</b> en el ordenador, <b>W/S</b> o <b>↑/↓</b> para andar, <b>A/D</b> o <b>←/→</b> para girar, y el ratón sube o baja la mira. En pantallas táctiles usa el joystick 🕹️ y arrastra para mirar; en VR, la palanca del mando. Los animales están repartidos por el campo: búscalos con el radar de arriba a la izquierda.<br />
                    🕶️ <b>Gafas VR:</b> el arco va en una mano; acerca la otra a la cuerda, aprieta el gatillo, tira hacia atrás hasta la cara y suelta el gatillo. ¡Notarás la tensión en el mando!<br />
                    <span style={{ color: '#c5e1a5' }}>Cuanto más tenses, más rápida y recta irá la flecha. Si mantienes el arco tensado mucho rato, el brazo empieza a temblar.</span>
                </div>

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 22 }}>
                    <button onClick={() => onEmpezar(cfg(), false)} style={boton('linear-gradient(135deg,#7cb342,#33691e)', { fontSize: '1.2rem', padding: '14px 34px' })}>🏹 ¡A tirar!</button>
                    {vrSoportado && <button onClick={() => onEmpezar(cfg(), true)} style={boton('linear-gradient(135deg,#26a69a,#00695c)', { fontSize: '1.2rem', padding: '14px 28px' })}>🕶️ Con gafas VR</button>}
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════ JUEGO ═════════════════════════════════════════
function Juego({ partida, onFin, onSalir }) {
    const contRef = useRef(null), tensionRef = useRef(null), alientoRef = useRef(null), motorRef = useRef(null), radarRef = useRef(null), congeladoRef = useRef(null);
    const caza = partida.escenario === 'caza';
    const [ronda, setRonda] = useState(null);
    const [estado, setEstado] = useState({ vidas: 3, vidasMax: 3, puntos: 0, ronda: 0, total: 1 });
    const [viento, setViento] = useState({ vel: 0, x: 0, z: 0 });
    const [pines, setPines] = useState([]);
    const [aviso, setAviso] = useState(null);
    const [sonido, setSonido] = useState(sonidoActivo());
    const [enVR, setEnVR] = useState(!!partida.xrSession);
    const [tensando, setTensando] = useState(false);
    const [tactil] = useState(esTactil);
    const [conRaton] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: fine)').matches);
    const avisoT = useRef(null);
    const onFinRef = useRef(onFin); onFinRef.current = onFin;

    const mostrarAviso = (a, ms = 1800) => { clearTimeout(avisoT.current); setAviso(a); avisoT.current = setTimeout(() => setAviso(null), ms); };

    useEffect(() => {
        const motor = crearArco(contRef.current, {
            ...partida, sonido: sonidoActivo(),
            dom: { tension: tensionRef.current, aliento: alientoRef.current, radar: radarRef.current, congelado: congeladoRef.current },
        }, {
            onRonda: (r) => { setRonda(r); setAviso(null); },
            onEstado: setEstado,
            onViento: setViento,
            onPines: setPines,
            onVR: setEnVR,
            onImpacto: (i) => {
                if (i.ok) { sonidoCorrecto(); mostrarAviso({ ok: true, txt: i.anillo === 10 ? `¡DIANA! +${i.puntos}` : `¡Correcto! +${i.puntos}` }); }
                else { sonidoIncorrecto(); mostrarAviso({ ok: false, txt: i.correcta ? `✗ Era: ${i.correcta}` : `✗ «${i.texto}» no es${i.explicacion ? ` (${i.explicacion})` : ''}` }, 2600); }
                if (i.quedan !== undefined) setRonda(r => (r ? { ...r, quedan: i.quedan } : r));
            },
            onFin: (res) => onFinRef.current(res),
        });
        motorRef.current = motor;
        return () => { clearTimeout(avisoT.current); motor.destruir(); motorRef.current = null; };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const m = () => motorRef.current;
    const pantallaCompleta = () => {
        const el = document.documentElement;
        if (document.fullscreenElement) document.exitFullscreen?.(); else el.requestFullscreen?.().catch(() => { });
    };
    // Botón de tensar (táctil): mantener = tensar; deslizar = afinar la puntería
    const arrastre = useRef(null);
    const btnDown = (e) => { e.preventDefault(); e.stopPropagation(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* */ } arrastre.current = { x: e.clientX, y: e.clientY, id: e.pointerId }; m()?.tensar(true); setTensando(true); };
    const btnMove = (e) => { const a = arrastre.current; if (!a || a.id !== e.pointerId) return; m()?.mirar(e.clientX - a.x, e.clientY - a.y); a.x = e.clientX; a.y = e.clientY; };
    const btnUp = (e) => { if (!arrastre.current || arrastre.current.id !== e.pointerId) return; arrastre.current = null; m()?.tensar(false); setTensando(false); };

    const preguntas = partida.modo === 'preguntas';
    const angViento = Math.atan2(viento.x, -viento.z); // 0 = hacia las dianas
    const vidasTxt = Number.isFinite(estado.vidas) ? '❤️'.repeat(Math.max(0, estado.vidas)) + '🤍'.repeat(Math.max(0, (estado.vidasMax || 0) - estado.vidas)) : '∞';
    const caja = { background: 'rgba(10,20,12,0.62)', backdropFilter: 'blur(4px)', borderRadius: 14, color: 'white', fontFamily: FUENTE };

    return (
        <div style={{ position: 'fixed', inset: 0, background: '#000', userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none' }}>
            <div ref={contRef} style={{ position: 'absolute', inset: 0 }} />

            {/* Enunciado */}
            {ronda && (
                <div style={{ ...caja, position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', width: 'min(760px, calc(100% - 180px))', minWidth: 260, padding: '8px 14px', textAlign: 'center', pointerEvents: 'none' }}>
                    <div style={{ fontSize: '0.75rem', color: '#c5e1a5', fontWeight: 700 }}>{preguntas ? 'Pregunta' : 'Ronda'} {ronda.indice + 1}/{ronda.total}</div>
                    {preguntas ? (<>
                        <div style={{ fontWeight: 800, fontSize: 'clamp(0.95rem,2.4vw,1.3rem)', margin: '2px 0 6px', lineHeight: 1.25 }}>{ronda.enunciado}</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                            {ronda.opciones.map((o, i) => (
                                <span key={i} style={{ background: COLORES_OPCION[i], borderRadius: 8, padding: '3px 9px', fontWeight: 700, fontSize: 'clamp(0.75rem,1.8vw,0.92rem)' }}>{LETRAS[i]} · {o}</span>
                            ))}
                        </div>
                    </>) : (
                        <div style={{ fontWeight: 900, fontSize: 'clamp(1.05rem,2.8vw,1.5rem)' }}>
                            Dispara a: <span style={{ color: ORO }}>{String(ronda.objetivo).toUpperCase()}</span>
                            <span style={{ fontSize: '0.8rem', color: '#c5e1a5', marginLeft: 10 }}>quedan {Math.max(0, ronda.quedan ?? 0)}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Marcador */}
            <div style={{ ...caja, position: 'absolute', top: 10, left: 10, padding: '6px 10px', fontSize: '0.9rem', pointerEvents: 'none' }}>
                <div>{vidasTxt}</div>
                <div style={{ fontWeight: 900, fontSize: '1.15rem', color: ORO }}>{estado.puntos} <span style={{ fontSize: '0.7rem', color: '#c5e1a5' }}>pts</span></div>
                <div style={{ fontSize: '0.72rem', color: '#c5e1a5' }}>🏹 {estado.disparos || 0} flechas</div>
            </div>
            {caza && !enVR && <canvas ref={radarRef} width={112} height={112} title="Radar: animales a tu alrededor (delante = arriba)" style={{ position: 'absolute', top: 104, left: 10, width: 112, height: 112, pointerEvents: 'none' }} />}
            {caza && <div ref={congeladoRef} style={{ display: 'none', position: 'absolute', top: 132, left: '50%', transform: 'translateX(-50%)', padding: '6px 14px', borderRadius: 12, background: 'rgba(2,119,189,0.75)', color: 'white', fontWeight: 900, fontFamily: FUENTE, pointerEvents: 'none' }} />}

            {/* Botones arriba a la derecha + viento */}
            <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                    <button title="Sonido" onClick={() => { const v = setSonidoActivo(!sonido); setSonido(v); m()?.setSonido(v); }} style={{ ...caja, border: 'none', width: 38, height: 38, cursor: 'pointer', fontSize: '1rem' }}>{sonido ? '🔊' : '🔇'}</button>
                    <button title="Pantalla completa" onClick={pantallaCompleta} style={{ ...caja, border: 'none', width: 38, height: 38, cursor: 'pointer', fontSize: '1rem' }}>⛶</button>
                    <button title="Salir" onClick={onSalir} style={{ ...caja, border: 'none', width: 38, height: 38, cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                </div>
                <div style={{ ...caja, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'none' }}>
                    <span style={{ fontSize: '0.75rem', color: '#c5e1a5' }}>Viento</span>
                    {viento.vel > 0.05 ? (<>
                        <span style={{ display: 'inline-block', transform: `rotate(${angViento}rad)`, fontSize: '1.3rem', lineHeight: 1 }}>⬆</span>
                        <b>{viento.vel.toFixed(1)} m/s</b>
                    </>) : <b>0</b>}
                </div>
            </div>

            {/* Mira (con pines opcionales) */}
            {!enVR && (
                <div style={{ position: 'absolute', left: '50%', top: '50%', pointerEvents: 'none' }}>
                    <div style={{ position: 'absolute', left: -11, top: -1, width: 22, height: 2, background: 'rgba(255,255,255,0.85)', boxShadow: '0 0 3px #000' }} />
                    <div style={{ position: 'absolute', left: -1, top: -11, width: 2, height: 22, background: 'rgba(255,255,255,0.85)', boxShadow: '0 0 3px #000' }} />
                    {partida.ayuda === 'pines' && pines.map((p, i) => (
                        <div key={p.d} style={{ position: 'absolute', left: 14 + i * 30, top: p.px - 6, display: 'flex', alignItems: 'center', gap: 3 }}>
                            <div style={{ position: 'absolute', right: '100%', top: 5, width: 10 + i * 30, height: 1, background: 'rgba(255,255,255,0.45)' }} />
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.d === 10 ? '#66bb6a' : p.d === 20 ? '#ffca28' : p.d === 30 ? '#ef5350' : '#ab47bc', border: '1px solid #000' }} />
                            <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', textShadow: '0 0 3px #000' }}>{p.d}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Barras de tensión y respiración */}
            {!enVR && (
                <div style={{ position: 'absolute', bottom: tactil ? 18 : 30, left: '50%', transform: 'translateX(-50%)', width: 'min(320px, 50vw)', pointerEvents: 'none' }}>
                    <div style={{ fontSize: 11, color: '#fff', textShadow: '0 0 3px #000', marginBottom: 2 }}>Tensión</div>
                    <div style={{ height: 10, borderRadius: 6, background: 'rgba(0,0,0,0.45)', overflow: 'hidden' }}>
                        <div ref={tensionRef} style={{ height: '100%', background: 'linear-gradient(90deg,#9ccc65,#ffca28,#ef5350)', transformOrigin: 'left', transform: 'scaleX(0)' }} />
                    </div>
                    <div style={{ marginTop: 5, opacity: 0.35 }}>
                        <div style={{ height: 5, borderRadius: 4, background: 'rgba(0,0,0,0.45)', overflow: 'hidden' }}>
                            <div ref={alientoRef} style={{ height: '100%', background: '#4fc3f7', transformOrigin: 'left' }} />
                        </div>
                    </div>
                </div>
            )}
            {!enVR && conRaton && (
                <div style={{ position: 'absolute', bottom: tactil ? 124 : 6, left: '50%', transform: 'translateX(-50%)', fontSize: 11, color: 'rgba(255,255,255,0.85)', textShadow: '0 0 3px #000', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
                    {caza ? 'W/S ↑/↓ = andar · A/D ←/→ = girar · ratón = subir/bajar la mira · ' : ''}Mantén clic o Espacio = tensar · {caza ? '' : 'mueve el ratón = apuntar · '}suelta = disparar · Mayús = respirar hondo · clic derecho = cancelar · Esc = soltar el ratón
                </div>
            )}

            {/* Controles táctiles */}
            {!enVR && tactil && caza && <Joystick onMover={(x, y) => m()?.mover(x, y)} />}
            {!enVR && tactil && (<>
                <button onPointerDown={btnDown} onPointerMove={btnMove} onPointerUp={btnUp} onPointerCancel={btnUp}
                    style={{ position: 'absolute', right: 18, bottom: 18, width: 96, height: 96, borderRadius: '50%', border: `3px solid ${tensando ? ORO : 'rgba(255,255,255,0.7)'}`, background: tensando ? 'rgba(255,202,40,0.35)' : 'rgba(0,0,0,0.35)', color: 'white', fontSize: '2.2rem', touchAction: 'none' }}>🏹</button>
                <button onPointerDown={(e) => { e.stopPropagation(); m()?.aguantar(true); }} onPointerUp={() => m()?.aguantar(false)} onPointerCancel={() => m()?.aguantar(false)} onPointerLeave={() => m()?.aguantar(false)}
                    style={{ position: 'absolute', right: 128, bottom: 26, width: 60, height: 60, borderRadius: '50%', border: '2px solid rgba(79,195,247,0.8)', background: 'rgba(0,0,0,0.35)', color: 'white', fontSize: '1.4rem', touchAction: 'none' }} title="Contener la respiración">🫁</button>
                {tensando && <button onPointerDown={(e) => { e.stopPropagation(); m()?.cancelar(); }}
                    style={{ position: 'absolute', right: 30, bottom: 128, borderRadius: 10, border: 'none', padding: '6px 10px', background: 'rgba(0,0,0,0.5)', color: 'white', fontSize: '0.8rem' }}>✕ No disparar</button>}
            </>)}

            {/* Avisos */}
            {aviso && (
                <div style={{ position: 'absolute', top: '22%', left: '50%', transform: 'translateX(-50%)', padding: '10px 20px', borderRadius: 14, fontWeight: 900, fontSize: 'clamp(1rem,3vw,1.5rem)', background: aviso.ok ? 'rgba(46,125,50,0.88)' : 'rgba(183,28,28,0.88)', color: 'white', pointerEvents: 'none', textAlign: 'center', maxWidth: '86%' }}>{aviso.txt}</div>
            )}
            {enVR && (
                <div style={{ ...caja, position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', padding: '10px 16px' }}>🕶️ Jugando con las gafas de realidad virtual…</div>
            )}
        </div>
    );
}

// Joystick táctil para andar en la cacería (x derecha, y delante)
function Joystick({ onMover }) {
    const ref = useRef(null), id = useRef(null);
    const [k, setK] = useState({ x: 0, y: 0 });
    const calc = (e) => {
        const r = ref.current.getBoundingClientRect();
        let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        const l = Math.hypot(x, y);
        if (l > 1) { x /= l; y /= l; }
        setK({ x, y });
        onMover(x, -y);
    };
    const fin = (e) => { if (id.current !== e.pointerId) return; id.current = null; setK({ x: 0, y: 0 }); onMover(0, 0); };
    return (
        <div ref={ref}
            onPointerDown={(e) => { e.stopPropagation(); id.current = e.pointerId; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* */ } calc(e); }}
            onPointerMove={(e) => { if (id.current === e.pointerId) calc(e); }}
            onPointerUp={fin} onPointerCancel={fin}
            style={{ position: 'absolute', left: 18, bottom: 18, width: 120, height: 120, borderRadius: '50%', background: 'rgba(0,0,0,0.3)', border: '2px solid rgba(255,255,255,0.55)', touchAction: 'none' }}>
            <div style={{ position: 'absolute', left: 60 + k.x * 40 - 24, top: 60 + k.y * 40 - 24, width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.6)', pointerEvents: 'none' }} />
        </div>
    );
}

// ═══════════════════════════ RESULTADOS ════════════════════════════════════
function Resultados({ resultado: r, contenido, partida, vrSoportado, onOtra, onMenu, onSalir }) {
    const [verEnvio, setVerEnvio] = useState(false);
    const intentos = r.aciertos + r.fallos;
    const precision = r.disparos ? Math.round((r.enDiana / r.disparos) * 100) : 0;
    const repaso = r.modo === 'preguntas'
        ? r.falladas.map(f => ({ a: f.enunciado, b: `Era «${f.correcta}» (disparaste a «${f.elegida}»)` }))
        : r.fallosLista.map(f => ({ a: f.palabra, b: `${f.explicacion || 'no era de la categoría'} · buscabas ${f.buscabas}` }));
    return (
        <div style={{ ...fondo, padding: '28px 16px 40px' }}>
            <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
                <div style={{ fontSize: '3.6rem' }}>{r.ganado ? '🏆' : '🏹'}</div>
                <h1 style={titulo}>{r.ganado ? '¡Prueba superada!' : 'Sin vidas'}</h1>
                <p style={{ color: '#dcedc8', margin: '0 0 16px' }}>{contenido?.titulo}{r.modo === 'preguntas' ? ` · ${r.completadas}/${r.total} preguntas` : ` · ${r.completadas}/${r.total} rondas`}</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginBottom: 18 }}>
                    {[['Puntos', r.puntos, ORO], ['Aciertos', `✓ ${r.aciertos}`, '#aed581'], ['Fallos', `✗ ${r.fallos}`, '#ef9a9a'], ['Flechas', r.disparos, '#fff'], ['En diana', `${precision} %`, '#81d4fa'], ['Centros (10)', r.centros, '#ffe082']].map(([t, v, c]) => (
                        <div key={t} style={{ background: 'rgba(0,0,0,0.22)', borderRadius: 14, padding: '10px 8px' }}>
                            <div style={{ fontSize: '0.75rem', color: '#c5e1a5' }}>{t}</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: c }}>{v}</div>
                        </div>
                    ))}
                </div>
                {repaso.length > 0 && (
                    <div style={{ textAlign: 'left', background: 'rgba(0,0,0,0.22)', borderRadius: 14, padding: '12px 16px', marginBottom: 18 }}>
                        <div style={{ fontWeight: 800, marginBottom: 8, color: '#ffcdd2' }}>Para repasar</div>
                        {repaso.map((f, i) => (
                            <div key={i} style={{ padding: '5px 0', borderTop: i ? '1px solid rgba(255,255,255,0.1)' : 'none', fontSize: '0.92rem' }}>
                                <b style={{ color: CREMA }}>{f.a}</b><br /><span style={{ color: '#dcedc8' }}>{f.b}</span>
                            </div>
                        ))}
                    </div>
                )}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button onClick={() => setVerEnvio(true)} style={boton('linear-gradient(135deg,#ffca28,#f57f17)', { color: '#2b1d10' })}>📤 Enviar al profesor</button>
                    <button onClick={() => onOtra(false)} style={boton('linear-gradient(135deg,#7cb342,#33691e)')}>🔁 Otra vez</button>
                    {vrSoportado && <button onClick={() => onOtra(true)} style={boton('linear-gradient(135deg,#26a69a,#00695c)')}>🕶️ Otra vez con VR</button>}
                    <button onClick={onMenu} style={boton('rgba(255,255,255,0.14)')}>⚙️ Cambiar ajustes</button>
                    <button onClick={onSalir} style={boton('rgba(255,255,255,0.08)')}>← Salir</button>
                </div>
                <div style={{ color: '#c5e1a5', fontSize: '0.8rem', marginTop: 12 }}>{partida?.escenario === 'caza' ? '🐄 Cacería' : '🎯 Campo de tiro'} · {intentos} {partida?.escenario === 'caza' ? 'animales' : 'dianas'} elegidos · distancia {partida?.distancia} · viento {partida?.viento}</div>
            </div>
            {verEnvio && <ModalEnviarProfe resultado={r} contenido={contenido} partida={partida} onClose={() => setVerEnvio(false)} />}
        </div>
    );
}

// ═══════════════════════════ ENVIAR AL PROFESOR ════════════════════════════
// Enlace de competición (&comp=…&cat=…): la puntuación va a esa prueba, no al profesor
function ModalEnviarProfe(p) {
    const comp = leerCompeticionUrl();
    if (comp) return <ModalEnviarCompeticion compId={comp.compId} catId={comp.catId} puntos={Number(p.resultado?.puntos) || 0}
        detalle={soloPrimitivos({ aciertos: p.resultado?.aciertos, fallos: p.resultado?.fallos, disparos: p.resultado?.disparos })} nombreJuego="Tiro con arco" tituloReto={comp.titulo} onClose={p.onClose} />;
    return <ModalEnviarProfeBase {...p} />;
}

function ModalEnviarProfeBase({ resultado: r, contenido, partida, onClose }) {
    const [nombre, setNombre] = useState('');
    const [curso, setCurso] = useState('');
    const [codigo, setCodigo] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [enviado, setEnviado] = useState(false);
    const [error, setError] = useState('');
    const intentos = r.aciertos + r.fallos;
    const enviar = async () => {
        const code = codigo.trim().toUpperCase();
        if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
        const v = validarNombre(nombre);
        if (!v.ok) { setError(v.mensaje); return; }
        if (!code) { setError('Escribe el código del profesor.'); return; }
        setEnviando(true); setError('');
        try {
            const cod = await getDoc(doc(db, 'codigos_profesor', code));
            if (!cod.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
            const porcentaje = r.modo === 'preguntas'
                ? (r.total ? Math.round((r.aciertos / r.total) * 100) : 0)
                : (intentos ? Math.round((r.aciertos / intentos) * 100) : 0);
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'ARCO', modalidad: r.modo === 'preguntas' ? 'Individual · preguntas' : 'Individual · clases de palabras', fecha: new Date(),
                recursoId: contenido?.recursoId || null, recursoTitulo: contenido?.titulo || '', hoja: contenido?.hoja || 'General', codigoProfesor: code,
                config: { modo: r.modo, escenario: partida?.escenario || 'campo', distancia: partida?.distancia, ayuda: partida?.ayuda, viento: partida?.viento, movil: !!partida?.movil, vidas: partida?.vidas ?? 3, vr: !!r.vr, ...(contenido?.config || {}) },
                jugadores: [{
                    nombre: nombre.trim(), curso: curso.trim(), hoja: contenido?.hoja || 'General',
                    aciertos: r.aciertos, fallos: r.fallos, intentos, total: r.total, porcentaje,
                    puntuacion: r.puntos, completado: !!r.ganado, disparos: r.disparos, centros: r.centros,
                }],
                fallosLista: r.modo === 'preguntas'
                    ? r.falladas.map(f => ({ pregunta: f.enunciado, correcta: f.correcta, respuesta: f.elegida }))
                    : r.fallosLista,
                ...(r.modo === 'palabras' ? { aciertosLista: r.aciertosLista } : {}),
            });
            guardarRegistroLocal('ARCO', { titulo: `Tiro con arco · ${contenido?.titulo || ''}`, aciertos: r.aciertos, intentos, porcentaje, puntuacion: r.puntos, nombre: nombre.trim(), curso: curso.trim(), via: 'profesor' });
            setEnviado(true);
        } catch (e) { setError('Error: ' + e.message); }
        setEnviando(false);
    };
    const inp = { padding: '9px 12px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' };
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
            <div style={{ background: '#1f2e1d', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, width: '100%', maxWidth: 380, padding: '24px 26px', color: 'white', fontFamily: FUENTE }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: ORO }}>📤 Enviar al profesor</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.2rem' }}>✕</button>
                </div>
                {enviado ? (
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                        <div style={{ fontSize: '3rem' }}>✅</div>
                        <div style={{ color: '#aed581', fontWeight: 800 }}>¡Informe enviado!</div>
                        <div style={{ marginTop: 6, color: '#ccc', fontSize: '0.9rem' }}>{r.aciertos} aciertos · {r.puntos} puntos</div>
                        <button onClick={onClose} style={{ ...boton('rgba(255,255,255,0.12)'), marginTop: 14 }}>Cerrar</button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre y apellido" maxLength={40} style={inp} />
                        <input value={curso} onChange={e => setCurso(e.target.value)} placeholder="Curso (ej: 2º ESO B)" maxLength={20} style={inp} />
                        <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="Código del profesor" maxLength={10} style={{ ...inp, letterSpacing: 2, fontWeight: 700 }} />
                        {error && <div style={{ color: '#ef9a9a', fontSize: '0.82rem' }}>⚠ {error}</div>}
                        <div style={{ display: 'flex', gap: 9, marginTop: 4 }}>
                            <button onClick={onClose} style={{ ...boton('transparent', { border: '1px solid rgba(255,255,255,0.25)' }), flex: 1 }}>Cancelar</button>
                            <button onClick={enviar} disabled={enviando} style={{ ...boton(enviando ? '#555' : 'linear-gradient(135deg,#7cb342,#33691e)'), flex: 2 }}>{enviando ? 'Enviando…' : '📤 Enviar'}</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
