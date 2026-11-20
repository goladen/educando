import React, { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { SENALES, CATEGORIAS_SENAL, senalDataURL, SENAL_POR_ID } from './senales';
import { TEMAS_TEST, generarTest, contarPorTema } from './preguntasTest';
import { crearMotor, FALTAS, calificar } from './motorConduccion';
import { guardarRegistroLocal } from '../utils/registrosLocales';
import { sonidoCorrecto, sonidoIncorrecto, sonidoFinal } from '../utils/sonidosFeedback';
import { validarNombre } from '../utils/filtroNombres';
import imgVolante from '../assets/volante.svg';
import { db } from '../firebase';
const CabinaMicrobit = lazy(() => import('./CabinaMicrobit.jsx'));
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';

// ─── Simulador de conducción: señales, test teórico y conducción urbana ───────
const C = {
    fondo: '#11161d', panel: '#1b222c', borde: 'rgba(255,255,255,0.1)', texto: '#eef2f6', suave: '#9aa8b8',
    amarillo: '#ffd600', azul: '#1e88e5', verde: '#00c853', rojo: '#ff5252', naranja: '#ffab40',
};
const FUENTE = "'Segoe UI', system-ui, sans-serif";
const COLOR_GRAVEDAD = { eliminatoria: C.rojo, deficiente: C.naranja, leve: '#ffe082' };
const NOMBRE_GRAVEDAD = { eliminatoria: 'Eliminatoria', deficiente: 'Deficiente', leve: 'Leve' };
const KEY_VOZ = 'pikt_conducir_voz';
const KEY_RATON = 'pikt_conducir_raton';
const KEY_CAMBIO = 'pikt_conducir_cambio';
const KEY_EMBRAGUE = 'pikt_conducir_embrague';
const KEY_INVERTIR_CABINA = 'pikt_cabina_invertir'; // mismo valor que en CabinaMicrobit.jsx

const leerLS = (k, def) => { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch { return def; } };
const guardarLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } };

function hablar(texto) {
    if (!leerLS(KEY_VOZ, true) || !window.speechSynthesis) return;
    try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(texto);
        u.lang = 'es-ES'; u.rate = 1.02;
        const voz = window.speechSynthesis.getVoices().find(v => /^es(-|_)ES/i.test(v.lang)) || window.speechSynthesis.getVoices().find(v => /^es/i.test(v.lang));
        if (voz) u.voice = voz;
        window.speechSynthesis.speak(u);
    } catch { /* */ }
}

const Boton = ({ children, onClick, color = C.azul, grande, disabled, estilo }) => (
    <button onClick={onClick} disabled={disabled} style={{
        padding: grande ? '14px 22px' : '9px 16px', borderRadius: 12, border: 'none', cursor: disabled ? 'default' : 'pointer',
        background: disabled ? '#3a434f' : color, color: color === C.amarillo ? '#111' : 'white', fontWeight: 700,
        fontSize: grande ? '1rem' : '0.88rem', fontFamily: FUENTE, opacity: disabled ? 0.6 : 1, ...estilo,
    }}>{children}</button>
);

const Cabecera = ({ titulo, onVolver, derecha }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: `1px solid ${C.borde}`, position: 'sticky', top: 0, background: C.fondo, zIndex: 5 }}>
        <button onClick={onVolver} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: C.texto, borderRadius: 10, padding: '8px 12px', cursor: 'pointer', fontWeight: 700 }}>← Volver</button>
        <h2 style={{ margin: 0, fontSize: '1.15rem', flex: 1 }}>{titulo}</h2>
        {derecha}
    </div>
);

// ═══════════════════════════════ MENÚ ═══════════════════════════════════════
function Menu({ onElegir, onExit }) {
    const tarjetas = [
        { id: 'SENALES', emoji: '🚸', titulo: 'Aprende las señales', desc: `${SENALES.length} señales, semáforos y marcas viales explicadas, con qué hacer ante cada una.`, color: '#e53935' },
        { id: 'TEST_CONFIG', emoji: '📝', titulo: 'Test teórico', desc: 'Examen tipo DGT (30 preguntas, máximo 3 fallos) o práctica por temas con la explicación de cada respuesta.', color: '#1e88e5' },
        { id: 'SIM_LIBRE', emoji: '🚗', titulo: 'Conducción libre', desc: 'Circula por la ciudad con tráfico, semáforos, STOP, pasos de cebra y calles de sentido único. Te avisa de cada infracción.', color: '#43a047' },
        { id: 'PDF', emoji: '🖨️', titulo: 'Fichas en PDF', desc: 'Test teórico en papel con hoja de respuestas, o lámina de señales para identificar. Con soluciones explicadas.', color: '#8e24aa' },
        { id: 'CABINA', emoji: '🎮', titulo: 'Cabina con micro:bit', desc: 'Conduce con 4 micro:bit: volante con acelerador y freno, intermitentes, palanca de cambios y antena. Para jugar en clase de 3 en 3.', color: '#00897b' },
        { id: 'SIM_EXAMEN', emoji: '🎓', titulo: 'Examen práctico', desc: 'El examinador te indica la ruta por voz. Faltas eliminatorias, deficientes y leves: ¿APTO o NO APTO?', color: '#fb8c00' },
    ];
    return (
        <div style={{ maxWidth: 980, margin: '0 auto', padding: '18px 16px 40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <button onClick={onExit} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: C.texto, borderRadius: 10, padding: '8px 12px', cursor: 'pointer', fontWeight: 700 }}>← Salir</button>
            </div>
            <div style={{ textAlign: 'center', margin: '18px 0 26px' }}>
                <img src={imgVolante} alt="" style={{ width: 84, height: 84 }} />
                <h1 style={{ margin: '6px 0', fontSize: 'clamp(1.6rem, 5vw, 2.4rem)', color: C.amarillo }}>Simulador de conducción</h1>
                <p style={{ color: C.suave, margin: 0, maxWidth: 640, marginInline: 'auto', lineHeight: 1.5 }}>
                    Educación vial: aprende las señales, practica el test teórico (coche y moto) y conduce un coche o una moto en una ciudad 3D. Funciona en el ordenador, en el móvil y con gafas de realidad virtual.
                </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                {tarjetas.map(t => (
                    <button key={t.id} onClick={() => onElegir(t.id)} style={{
                        textAlign: 'left', background: C.panel, border: `1px solid ${C.borde}`, borderTop: `5px solid ${t.color}`, borderRadius: 16,
                        padding: '18px 16px', color: C.texto, cursor: 'pointer', fontFamily: FUENTE,
                    }}>
                        <div style={{ fontSize: '2.2rem' }}>{t.emoji}</div>
                        <div style={{ fontWeight: 800, fontSize: '1.08rem', margin: '6px 0' }}>{t.titulo}</div>
                        <div style={{ color: C.suave, fontSize: '0.86rem', lineHeight: 1.45 }}>{t.desc}</div>
                    </button>
                ))}
            </div>
            <div style={{ marginTop: 22, background: C.panel, border: `1px solid ${C.borde}`, borderRadius: 14, padding: '14px 16px', color: C.suave, fontSize: '0.86rem', lineHeight: 1.6 }}>
                <b style={{ color: C.texto }}>🥽 Modo inmersivo</b><br />
                · <b>Gafas VR</b> (Meta Quest, Pico…): abre esta página en el navegador de las gafas y pulsa «Gafas VR» dentro del simulador. Gatillo derecho = acelerar, gatillo izquierdo = frenar, joystick = volante.<br />
                · <b>Si te mareas:</b> conduce despacio, gira con suavidad, siéntate (no de pie) y descansa cada 10-15 minutos. Con gafas, el botón «🌫️ Confort» oscurece los bordes al girar.<br />
                · <b>Gafas de cartón</b> en el móvil: pantalla partida y miras girando la cabeza; inclina la cabeza para girar el volante y toca la pantalla para frenar (también se puede usar un mando bluetooth).<br />
                · <b>Ordenador:</b> W/↑ acelerar · S/↓/Espacio frenar · A/D ←/→ dirección · Q/E intermitentes · C cinturón / casco · R marcha atrás · T / G subir / bajar marcha y Shift embrague (cambio manual) · V cambiar vista · F campo de visión · <b>mueve el ratón hacia un borde de la pantalla para mirar a ese lado</b> (o mantén Z / X para echar un vistazo a la izquierda / derecha). También funciona con mando o volante USB.
            </div>
        </div>
    );
}

// ═══════════════════════════ CATÁLOGO DE SEÑALES ════════════════════════════
function CatalogoSenales({ onVolver, onTest }) {
    const [cat, setCat] = useState('TODAS');
    const [abierta, setAbierta] = useState(null);
    const lista = SENALES.filter(s => cat === 'TODAS' || s.categoria === cat);
    const catInfo = CATEGORIAS_SENAL.find(c => c.id === cat);
    return (
        <div>
            <Cabecera titulo="🚸 Señales de tráfico" onVolver={onVolver} derecha={<Boton onClick={onTest} color={C.amarillo}>📝 Ponte a prueba</Boton>} />
            <div style={{ maxWidth: 1100, margin: '0 auto', padding: 16 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                    {[{ id: 'TODAS', nombre: 'Todas', emoji: '✨', color: '#607d8b' }, ...CATEGORIAS_SENAL].map(c => (
                        <button key={c.id} onClick={() => setCat(c.id)} style={{
                            padding: '7px 13px', borderRadius: 20, border: `1.5px solid ${cat === c.id ? c.color : C.borde}`,
                            background: cat === c.id ? c.color : 'transparent', color: C.texto, cursor: 'pointer', fontWeight: 600, fontSize: '0.84rem',
                        }}>{c.emoji} {c.nombre}</button>
                    ))}
                </div>
                {catInfo && <p style={{ color: C.suave, fontSize: '0.88rem', marginTop: 0 }}>{catInfo.desc}</p>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
                    {lista.map(s => (
                        <button key={s.id} onClick={() => setAbierta(s)} style={{ background: C.panel, border: `1px solid ${C.borde}`, borderRadius: 14, padding: 12, cursor: 'pointer', color: C.texto, fontFamily: FUENTE }}>
                            <img src={senalDataURL(s.id, 200)} alt={s.nombre} style={{ width: 96, height: 96, objectFit: 'contain' }} />
                            <div style={{ fontSize: '0.72rem', color: C.amarillo, fontWeight: 700, marginTop: 4 }}>{s.codigo}</div>
                            <div style={{ fontSize: '0.84rem', fontWeight: 600, lineHeight: 1.3 }}>{s.nombre}</div>
                        </button>
                    ))}
                </div>
            </div>
            {abierta && (
                <div onClick={() => setAbierta(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: C.panel, borderRadius: 18, maxWidth: 440, width: '100%', padding: 22, textAlign: 'center', border: `1px solid ${C.borde}` }}>
                        <img src={senalDataURL(abierta.id, 320)} alt={abierta.nombre} style={{ width: 180, height: 180 }} />
                        <div style={{ color: C.amarillo, fontWeight: 800 }}>{abierta.codigo}</div>
                        <h3 style={{ margin: '4px 0 10px' }}>{abierta.nombre}</h3>
                        <p style={{ color: C.texto, lineHeight: 1.5, textAlign: 'left' }}>{abierta.descripcion}</p>
                        <div style={{ background: 'rgba(0,200,83,0.12)', border: '1px solid rgba(0,200,83,0.4)', borderRadius: 10, padding: '10px 12px', textAlign: 'left', fontSize: '0.92rem' }}>
                            <b>🚗 Qué hacer:</b> {abierta.accion}
                        </div>
                        <Boton onClick={() => setAbierta(null)} estilo={{ marginTop: 16 }}>Cerrar</Boton>
                    </div>
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════ TEST ═══════════════════════════════════════
function FichasPdf({ onVolver }) {
    const [tipo, setTipo] = useState('test');
    const [n, setN] = useState(20);
    const [temas, setTemas] = useState([]);
    const [cats, setCats] = useState([]);
    const [soluciones, setSoluciones] = useState(true);
    const [generando, setGenerando] = useState(false);
    const [error, setError] = useState('');
    const toggle = (lista, set, id) => set(lista.includes(id) ? lista.filter(x => x !== id) : [...lista, id]);
    const generar = async (ver) => {
        setGenerando(true); setError('');
        try {
            const { generarFichaConduccion } = await import('./fichaConduccion');
            const pdf = await generarFichaConduccion({ tipo, n, temas, categorias: cats, soluciones });
            const archivo = tipo === 'test' ? 'test-conducir.pdf' : 'senales-trafico.pdf';
            if (ver) { const url = pdf.output('bloburl'); if (!window.open(url, '_blank')) pdf.save(archivo); }
            else pdf.save(archivo);
        } catch (e) { setError('No se pudo generar el PDF: ' + e.message); }
        setGenerando(false);
    };
    const chip = (activo, onClick, txt) => (
        <button key={txt} onClick={onClick} style={{ padding: '7px 12px', borderRadius: 20, cursor: 'pointer', fontWeight: 600, fontSize: '0.84rem', border: `1.5px solid ${activo ? C.amarillo : C.borde}`, background: activo ? 'rgba(255,214,0,0.15)' : 'transparent', color: C.texto }}>{txt}</button>
    );
    const opcionesN = tipo === 'test' ? [10, 20, 30] : [8, 12, 16, SENALES.length];
    return (
        <div>
            <Cabecera titulo="🖨️ Fichas en PDF" onVolver={onVolver} />
            <div style={{ maxWidth: 680, margin: '0 auto', padding: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[['test', '📝 Test teórico', 'Preguntas de 3 opciones (con la imagen de la señal cuando la hay), hoja de respuestas y soluciones explicadas.'], ['senales', '🚸 Lámina de señales', 'Señales para escribir su nombre y qué debe hacer el conductor. Soluciones al final.']].map(([id, t, d]) => (
                        <button key={id} onClick={() => { setTipo(id); setN(id === 'test' ? 20 : 12); }} style={{ textAlign: 'left', padding: 14, borderRadius: 14, cursor: 'pointer', background: tipo === id ? 'rgba(142,36,170,0.2)' : C.panel, border: `2px solid ${tipo === id ? '#ab47bc' : C.borde}`, color: C.texto, fontFamily: FUENTE }}>
                            <div style={{ fontWeight: 800 }}>{t}</div>
                            <div style={{ color: C.suave, fontSize: '0.82rem', marginTop: 4 }}>{d}</div>
                        </button>
                    ))}
                </div>
                <h4 style={{ margin: '18px 0 8px' }}>{tipo === 'test' ? 'Temas' : 'Tipos de señales'} <span style={{ color: C.suave, fontWeight: 400 }}>{tipo === 'test' ? '(ninguno = examen mezclado tipo DGT)' : '(ninguno = todas)'}</span></h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {tipo === 'test'
                        ? TEMAS_TEST.map(t => chip(temas.includes(t.id), () => toggle(temas, setTemas, t.id), `${t.emoji} ${t.nombre}`))
                        : CATEGORIAS_SENAL.map(c => chip(cats.includes(c.id), () => toggle(cats, setCats, c.id), `${c.emoji} ${c.nombre}`))}
                </div>
                <h4 style={{ margin: '18px 0 8px' }}>{tipo === 'test' ? 'Número de preguntas' : 'Número de señales'}</h4>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {opcionesN.map(k => <Boton key={k} onClick={() => setN(k)} color={n === k ? C.azul : '#2c3540'}>{k === SENALES.length ? `Todas (${k})` : k}</Boton>)}
                </div>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 18, cursor: 'pointer' }}>
                    <input type="checkbox" checked={soluciones} onChange={e => setSoluciones(e.target.checked)} style={{ width: 18, height: 18 }} /> Añadir hoja de soluciones (para el profesor)
                </label>
                <p style={{ color: C.suave, fontSize: '0.82rem' }}>Cada vez que generas la ficha cambian las preguntas o las señales: puedes hacer una versión distinta para cada grupo.</p>
                {error && <div style={{ color: C.rojo }}>{error}</div>}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
                    <Boton grande color={C.amarillo} disabled={generando} onClick={() => generar(true)}>{generando ? 'Generando…' : '👁️ Ver PDF'}</Boton>
                    <Boton grande disabled={generando} onClick={() => generar(false)}>⬇️ Descargar</Boton>
                </div>
            </div>
        </div>
    );
}

function ConfigTest({ onVolver, onEmpezar, temaInicial }) {
    const [modo, setModo] = useState(temaInicial ? 'practica' : 'examen');
    const [temas, setTemas] = useState(temaInicial ? [temaInicial] : []);
    const [n, setN] = useState(20);
    const cuentas = useMemo(contarPorTema, []);
    const toggle = (id) => setTemas(t => (t.includes(id) ? t.filter(x => x !== id) : [...t, id]));
    return (
        <div>
            <Cabecera titulo="📝 Test teórico" onVolver={onVolver} />
            <div style={{ maxWidth: 680, margin: '0 auto', padding: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
                    {[['examen', '🚗 Examen permiso B', '30 preguntas · 30 min · aprobado con 3 fallos o menos.'], ['examen_moto', '🏍️ Examen moto (A2)', '30 preguntas con una parte específica de moto · 30 min · máx. 3 fallos.'], ['practica', '🧠 Práctica', 'Elige temas (también Moto). Ves la explicación de cada respuesta.']].map(([id, t, d]) => (
                        <button key={id} onClick={() => setModo(id)} style={{ textAlign: 'left', padding: 14, borderRadius: 14, cursor: 'pointer', background: modo === id ? 'rgba(30,136,229,0.18)' : C.panel, border: `2px solid ${modo === id ? C.azul : C.borde}`, color: C.texto, fontFamily: FUENTE }}>
                            <div style={{ fontWeight: 800 }}>{t}</div>
                            <div style={{ color: C.suave, fontSize: '0.82rem', marginTop: 4 }}>{d}</div>
                        </button>
                    ))}
                </div>
                {modo === 'practica' && (
                    <>
                        <h4 style={{ margin: '18px 0 8px' }}>Temas <span style={{ color: C.suave, fontWeight: 400 }}>(ninguno = todos)</span></h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {TEMAS_TEST.map(t => (
                                <button key={t.id} onClick={() => toggle(t.id)} style={{ padding: '8px 13px', borderRadius: 20, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', border: `1.5px solid ${temas.includes(t.id) ? C.amarillo : C.borde}`, background: temas.includes(t.id) ? 'rgba(255,214,0,0.15)' : 'transparent', color: C.texto }}>
                                    {t.emoji} {t.nombre} <span style={{ color: C.suave }}>({cuentas[t.id]})</span>
                                </button>
                            ))}
                        </div>
                        <h4 style={{ margin: '18px 0 8px' }}>Número de preguntas</h4>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {[10, 20, 30].map(k => <Boton key={k} onClick={() => setN(k)} color={n === k ? C.azul : '#2c3540'}>{k}</Boton>)}
                        </div>
                    </>
                )}
                <div style={{ marginTop: 24, textAlign: 'center' }}>
                    <Boton grande color={C.amarillo} onClick={() => onEmpezar({ modo, temas, n: modo !== 'practica' ? 30 : n })}>▶ Empezar</Boton>
                </div>
            </div>
        </div>
    );
}

function Test({ config, onVolver, onFin }) {
    const preguntas = useMemo(() => generarTest(config), [config]);
    const [idx, setIdx] = useState(0);
    const [resp, setResp] = useState({}); // idx → opción
    const [restante, setRestante] = useState(config.modo !== 'practica' ? 30 * 60 : null);
    const finRef = useRef(false);
    const p = preguntas[idx];
    const respondida = resp[idx] != null;
    const examen = config.modo !== 'practica';

    const terminar = (r = resp) => {
        if (finRef.current) return; finRef.current = true;
        const aciertos = preguntas.filter((q, i) => r[i] === q.correcta).length;
        sonidoFinal();
        onFin({ preguntas, respuestas: r, aciertos, total: preguntas.length, modo: config.modo });
    };
    useEffect(() => {
        if (restante == null) return;
        if (restante <= 0) { terminar(); return; }
        const t = setTimeout(() => setRestante(x => x - 1), 1000);
        return () => clearTimeout(t);
    }, [restante]); // eslint-disable-line react-hooks/exhaustive-deps

    const elegir = (o) => {
        if (respondida && !examen) return;
        const nuevo = { ...resp, [idx]: o };
        setResp(nuevo);
        if (!examen) { if (o === p.correcta) sonidoCorrecto(); else sonidoIncorrecto(); }
        else if (idx < preguntas.length - 1) setTimeout(() => setIdx(i => i + 1), 250);
    };
    const fallos = preguntas.filter((q, i) => resp[i] != null && resp[i] !== q.correcta).length;

    return (
        <div>
            <Cabecera titulo={config.modo === 'examen_moto' ? '🏍️ Examen teórico de moto' : examen ? '🎓 Examen teórico' : '🧠 Práctica'} onVolver={onVolver} derecha={
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 700, fontSize: '0.9rem' }}>
                    {restante != null && <span style={{ color: restante < 120 ? C.rojo : C.texto }}>⏱ {Math.floor(restante / 60)}:{String(restante % 60).padStart(2, '0')}</span>}
                    {!examen && <span style={{ color: fallos > 3 ? C.rojo : C.suave }}>✘ {fallos}</span>}
                </div>
            } />
            <div style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 14 }}>
                    {preguntas.map((q, i) => {
                        const r = resp[i];
                        const bg = r == null ? '#2c3540' : examen ? C.azul : r === q.correcta ? C.verde : C.rojo;
                        return <button key={i} onClick={() => setIdx(i)} style={{ width: 26, height: 26, borderRadius: 6, border: i === idx ? `2px solid ${C.amarillo}` : 'none', background: bg, color: 'white', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>{i + 1}</button>;
                    })}
                </div>
                <div style={{ background: C.panel, borderRadius: 16, padding: '18px 18px 20px', border: `1px solid ${C.borde}` }}>
                    <div style={{ color: C.suave, fontSize: '0.8rem', marginBottom: 6 }}>Pregunta {idx + 1} de {preguntas.length} · {TEMAS_TEST.find(t => t.id === p.tema)?.nombre}</div>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                        {p.senal && <img src={senalDataURL(p.senal, 240)} alt="señal" style={{ width: 130, height: 130, background: '#e8edf2', borderRadius: 12, padding: 6 }} />}
                        <h3 style={{ margin: 0, flex: 1, minWidth: 220, lineHeight: 1.4 }}>{p.pregunta}</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 16 }}>
                        {p.opciones.map((o, i) => {
                            const elegida = resp[idx] === i;
                            let bg = 'rgba(255,255,255,0.05)', bd = C.borde;
                            if (examen && elegida) { bg = 'rgba(30,136,229,0.25)'; bd = C.azul; }
                            if (!examen && respondida) {
                                if (i === p.correcta) { bg = 'rgba(0,200,83,0.2)'; bd = C.verde; }
                                else if (elegida) { bg = 'rgba(255,82,82,0.2)'; bd = C.rojo; }
                            }
                            return (
                                <button key={i} onClick={() => elegir(i)} style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 12, border: `2px solid ${bd}`, background: bg, color: C.texto, cursor: 'pointer', fontSize: '0.95rem', fontFamily: FUENTE, display: 'flex', gap: 10 }}>
                                    <b style={{ color: C.amarillo }}>{'abc'[i]})</b><span>{o}</span>
                                </button>
                            );
                        })}
                    </div>
                    {!examen && respondida && (
                        <div style={{ marginTop: 14, padding: '11px 13px', borderRadius: 10, background: resp[idx] === p.correcta ? 'rgba(0,200,83,0.12)' : 'rgba(255,82,82,0.12)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                            <b>{resp[idx] === p.correcta ? '✅ ¡Correcto!' : '❌ Incorrecto.'}</b> {p.explicacion}
                        </div>
                    )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, gap: 10 }}>
                    <Boton onClick={() => setIdx(i => Math.max(0, i - 1))} color="#2c3540" disabled={idx === 0}>← Anterior</Boton>
                    {idx < preguntas.length - 1
                        ? <Boton onClick={() => setIdx(i => i + 1)}>Siguiente →</Boton>
                        : <Boton color={C.amarillo} onClick={() => terminar()}>✔ Terminar y corregir</Boton>}
                </div>
                {examen && Object.keys(resp).length === preguntas.length && idx < preguntas.length - 1 && (
                    <div style={{ textAlign: 'center', marginTop: 12 }}><Boton color={C.amarillo} onClick={() => terminar()}>✔ Has respondido todo: corregir</Boton></div>
                )}
            </div>
        </div>
    );
}

function ResultadoTest({ res, onRepetir, onMenu }) {
    const fallos = res.total - res.aciertos;
    const esEx = res.modo !== 'practica';
    const apto = esEx ? fallos <= 3 : res.aciertos / res.total >= 0.9;
    const [envio, setEnvio] = useState(false);
    useEffect(() => {
        guardarRegistroLocal('CONDUCCION', { titulo: `Test teórico${res.modo === 'examen_moto' ? ' moto (examen)' : esEx ? ' (examen)' : ''}`, aciertos: res.aciertos, intentos: res.total, porcentaje: Math.round((res.aciertos / res.total) * 100), via: 'juego' });
    }, [res]);
    const falladas = res.preguntas.map((p, i) => ({ p, r: res.respuestas[i] })).filter(x => x.r !== x.p.correcta);
    return (
        <div>
            <Cabecera titulo="Resultado del test" onVolver={onMenu} />
            <div style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
                <div style={{ textAlign: 'center', background: C.panel, borderRadius: 18, padding: 22, border: `2px solid ${apto ? C.verde : C.rojo}` }}>
                    <div style={{ fontSize: '3rem' }}>{apto ? '🏆' : '📚'}</div>
                    <div style={{ fontSize: '2rem', fontWeight: 900, color: apto ? C.verde : C.rojo }}>{esEx ? (apto ? 'APTO' : 'NO APTO') : `${res.aciertos} / ${res.total}`}</div>
                    <div style={{ color: C.suave, marginTop: 6 }}>{res.aciertos} aciertos · {fallos} fallos {esEx && '(máximo 3 para aprobar)'}</div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 16 }}>
                        <Boton onClick={onRepetir}>🔁 Otro test</Boton>
                        <Boton color={C.amarillo} onClick={() => setEnvio(true)}>📤 Enviar al profesor</Boton>
                        <Boton color="#2c3540" onClick={onMenu}>Menú</Boton>
                    </div>
                </div>
                {falladas.length > 0 && <h3 style={{ marginTop: 22 }}>Repasa tus fallos</h3>}
                {falladas.map(({ p, r }, i) => (
                    <div key={i} style={{ background: C.panel, borderRadius: 14, padding: 14, marginBottom: 10, border: `1px solid ${C.borde}`, display: 'flex', gap: 12 }}>
                        {p.senal && <img src={senalDataURL(p.senal, 160)} alt="" style={{ width: 64, height: 64, flexShrink: 0, background: '#e8edf2', borderRadius: 8, padding: 3 }} />}
                        <div style={{ fontSize: '0.9rem', lineHeight: 1.45 }}>
                            <b>{p.pregunta}</b>
                            {r != null && <div style={{ color: C.rojo }}>✘ Tu respuesta: {p.opciones[r]}</div>}
                            {r == null && <div style={{ color: C.naranja }}>Sin responder</div>}
                            <div style={{ color: C.verde }}>✔ Correcta: {p.opciones[p.correcta]}</div>
                            <div style={{ color: C.suave, marginTop: 4 }}>{p.explicacion}</div>
                        </div>
                    </div>
                ))}
            </div>
            {envio && <ModalEnviarProfe onClose={() => setEnvio(false)} datos={{
                modalidad: res.modo === 'examen_moto' ? 'Test teórico moto (examen)' : esEx ? 'Test teórico (examen)' : 'Test teórico (práctica)',
                aciertos: res.aciertos, intentos: res.total, apto: esEx ? apto : null,
                fallosLista: falladas.slice(0, 40).map(({ p, r }) => ({ pregunta: p.pregunta.slice(0, 140), senal: p.senal || null, respuesta: r != null ? String(p.opciones[r]).slice(0, 140) : '', correcta: String(p.opciones[p.correcta]).slice(0, 140) })),
            }} />}
        </div>
    );
}

// ═══════════════════════════ SIMULADOR ═════════════════════════════════════
function ConfigSimulador({ modo, onVolver, onEmpezar }) {
    const [trafico, setTrafico] = useState('normal');
    const [peatones, setPeatones] = useState(true);
    const [camara, setCamara] = useState('cabina');
    const [vehiculo, setVehiculo] = useState('coche');
    const [prueba, setPrueba] = useState('ciudad');
    const [cambio, setCambioE] = useState(() => leerLS(KEY_CAMBIO, 'auto'));
    const setCambio = (v) => { setCambioE(v); guardarLS(KEY_CAMBIO, v); };
    const [embrague, setEmbragueE] = useState(() => leerLS(KEY_EMBRAGUE, 'auto'));
    const setEmbrague = (v) => { setEmbragueE(v); guardarLS(KEY_EMBRAGUE, v); };
    const pista = vehiculo === 'moto' && modo === 'examen' && prueba === 'pista';
    const Op = ({ val, set, opciones }) => (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {opciones.map(([v, t]) => <Boton key={String(v)} onClick={() => set(v)} color={val === v ? C.azul : '#2c3540'}>{t}</Boton>)}
        </div>
    );
    return (
        <div>
            <Cabecera titulo={modo === 'examen' ? '🎓 Examen práctico' : '🚗 Conducción libre'} onVolver={onVolver} />
            <div style={{ maxWidth: 680, margin: '0 auto', padding: 16, lineHeight: 1.5 }}>
                <h4 style={{ margin: '0 0 8px' }}>Vehículo</h4>
                <Op val={vehiculo} set={setVehiculo} opciones={[['coche', '🚗 Coche (permiso B)'], ['moto', '🏍️ Moto (permiso A2)']]} />
                {vehiculo === 'moto' && modo === 'examen' && (<>
                    <h4 style={{ margin: '16px 0 8px' }}>Prueba</h4>
                    <Op val={prueba} set={setPrueba} opciones={[['pista', '🚧 Pista de maniobras'], ['ciudad', '🏙️ Circulación en ciudad']]} />
                </>)}
                <h4 style={{ margin: '16px 0 8px' }}>Cambio de marchas</h4>
                <Op val={cambio} set={setCambio} opciones={[['auto', '🅰️ Automático (D / R)'], ['manual', '⚙️ Manual (1.ª-5.ª)']]} />
                {cambio === 'manual' && <div style={{ color: C.suave, fontSize: '0.84rem', marginTop: 6, lineHeight: 1.45 }}>Sales en punto muerto (N). <b style={{ color: C.texto }}>T</b> sube de marcha y <b style={{ color: C.texto }}>G</b> baja (R = marcha atrás, parado). Sal en 1.ª, sube cuando el cuentarrevoluciones se ponga naranja y reduce al frenar: si vas muy despacio en una marcha larga, el motor se cala. </div>}
                {cambio === 'manual' && (<>
                    <h4 style={{ margin: '14px 0 8px' }}>Embrague</h4>
                    <Op val={embrague} set={setEmbrague} opciones={[['auto', '🤖 Automático'], ['pedal', '🦶 Con pedal (Shift o micro:bit)']]} />
                    <div style={{ color: C.suave, fontSize: '0.84rem', marginTop: 6, lineHeight: 1.45 }}>
                        {embrague === 'pedal'
                            ? <>Mantén <b style={{ color: C.texto }}>Shift</b> (o el pedal de embrague) pisado para cambiar de marcha. Para salir: embrague a fondo, 1.ª, un poco de gas y suelta el embrague poco a poco. Si lo sueltas de golpe o te paras sin pisarlo, se cala.</>
                            : <>El embrague se pisa solo al cambiar. Si conectas el pedal de embrague micro:bit, se activa solo.</>}
                    </div>
                </>)}
                <div style={{ height: 14 }} />
                {pista ? (
                    <div style={{ background: C.panel, borderRadius: 14, padding: 14, border: `1px solid ${C.borde}`, color: C.suave, fontSize: '0.9rem' }}>
                        Circuito cerrado con 3 ejercicios (inspirados en la prueba de destreza del permiso de moto): <b style={{ color: C.texto }}>1) slalom</b> entre conos alternando el lado, <b style={{ color: C.texto }}>2) pasillo estrecho</b> a velocidad muy reducida (7 s o más, sin salirte) y <b style={{ color: C.texto }}>3) frenada</b>: pasa la puerta a 30 km/h o más y detente antes de la línea roja. Derribar un cono es una falta.
                    </div>
                ) : modo === 'examen' ? (
                    <div style={{ background: C.panel, borderRadius: 14, padding: 14, border: `1px solid ${C.borde}`, color: C.suave, fontSize: '0.9rem' }}>
                        El examinador te dirá por voz en qué cruces girar y qué salida tomar en la glorieta (también lo verás en el panel y en el mapa). Al final, detente junto a la acera en la <b style={{ color: C.verde }}>zona verde</b>.<br />
                        <b style={{ color: C.texto }}>NO APTO</b> con 1 falta eliminatoria, 2 deficientes, 10 leves o 1 deficiente + 5 leves (como en el examen real).
                    </div>
                ) : (
                    <div style={{ background: C.panel, borderRadius: 14, padding: 14, border: `1px solid ${C.borde}`, color: C.suave, fontSize: '0.9rem' }}>
                        Circula libremente. La ciudad tiene avenidas de 50, calles de 30, una calle residencial de 20, calles de sentido único, una glorieta, cruces sin señalizar (prioridad a la derecha), STOP, ceda el paso, semáforos y un colegio.
                    </div>
                )}
                {!pista && (<>
                <h4 style={{ margin: '16px 0 8px' }}>Tráfico</h4>
                <Op val={trafico} set={setTrafico} opciones={[['poco', '🚗 Poco'], ['normal', '🚗🚕 Normal'], ['mucho', '🚗🚕🚙 Mucho']]} />
                <h4 style={{ margin: '16px 0 8px' }}>Peatones</h4>
                <Op val={peatones} set={setPeatones} opciones={[[true, '🚶 Sí'], [false, 'No']]} />
                </>)}
                <h4 style={{ margin: '16px 0 8px' }}>Vista inicial</h4>
                <Op val={camara} set={setCamara} opciones={[['cabina', vehiculo === 'moto' ? '🪖 Desde el casco' : '🧑‍✈️ Desde el asiento'], ['exterior', '🎥 Por detrás']]} />
                <div style={{ marginTop: 24, textAlign: 'center' }}>
                    <Boton grande color={C.amarillo} onClick={() => onEmpezar({ modo: pista ? 'pista' : modo, trafico, peatones: pista ? false : peatones, camara, vehiculo, cambio, embrague })}>▶ Arrancar</Boton>
                </div>
            </div>
        </div>
    );
}

const esTactil = () => typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window);

async function pedirPermisoSensores() {
    try { if (typeof DeviceMotionEvent !== 'undefined' && DeviceMotionEvent.requestPermission) await DeviceMotionEvent.requestPermission(); } catch { /* */ }
    try { if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) await DeviceOrientationEvent.requestPermission(); } catch { /* */ }
}

function Conduccion({ config, onSalir, onFin }) {
    const contRef = useRef(null), mmRef = useRef(null), motorRef = useRef(null);
    const [est, setEst] = useState(null);
    const [avisos, setAvisos] = useState([]);
    const [vr, setVr] = useState(false);
    const [enVR, setEnVR] = useState(false);
    const [carton, setCarton] = useState(false);
    const [tactil, setTactil] = useState(esTactil());
    const [inclinar, setInclinar] = useState(false);
    const [invertir, setInvertir] = useState(false);
    const [voz, setVoz] = useState(leerLS(KEY_VOZ, true));
    const [raton, setRaton] = useState(leerLS(KEY_RATON, true));
    const [volante, setVolante] = useState(0);
    const [confort, setConfort] = useState(true);
    const [placas, setPlacas] = useState({});
    const terminado = useRef(false);
    const [vertical, setVertical] = useState(() => window.innerHeight > window.innerWidth);
    useEffect(() => { const f = () => setVertical(window.innerHeight > window.innerWidth); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);

    useEffect(() => {
        const ponerAviso = (a) => {
            const id = Math.random();
            setAvisos(l => [...l.slice(-2), { ...a, id }]);
            setTimeout(() => setAvisos(l => l.filter(x => x.id !== id)), a.falta ? 6000 : 3500);
        };
        const m = crearMotor(contRef.current, { ...config, minimapa: mmRef.current, mirarRaton: !esTactil() && leerLS(KEY_RATON, true) }, {
            onEstado: setEst,
            onFalta: (f) => { ponerAviso({ falta: true, ...f }); sonidoIncorrecto(); },
            onAviso: (t) => ponerAviso({ texto: t }),
            onVoz: hablar,
            onVR: setEnVR,
            onFinExamen: (r) => { if (terminado.current) return; terminado.current = true; setTimeout(() => onFin(r), 1800); },
        });
        motorRef.current = m;
        m.soportaVR().then(setVr);
        // Cabina micro:bit (si la antena está conectada, las placas funcionan solas)
        let cabina = null, vivo = true;
        import('./cabinaMicrobit.js').then(({ conectarCabinaMotor }) => {
            if (vivo) cabina = conectarCabinaMotor(m, { invertir: leerLS(KEY_INVERTIR_CABINA, false), onPlacas: setPlacas });
        }).catch(() => { /* sin cabina */ });
        return () => { vivo = false; cabina?.desconectar(); m.destruir(); motorRef.current = null; try { window.speechSynthesis?.cancel(); } catch { /* */ } };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const m = () => motorRef.current;
    const terminar = () => { if (terminado.current) return; terminado.current = true; onFin(m().resumen()); };
    const entrarCarton = async () => {
        await pedirPermisoSensores();
        try { await document.documentElement.requestFullscreen?.(); } catch { /* */ }
        try { await screen.orientation?.lock?.('landscape'); } catch { /* */ }
        m().setCarton(true); setCarton(true);
    };
    const salirCarton = () => {
        m().setCarton(false); setCarton(false);
        try { if (document.fullscreenElement) document.exitFullscreen(); } catch { /* */ }
    };
    const alternarInclinar = async () => {
        if (!inclinar) await pedirPermisoSensores();
        m().setInclinacion(!inclinar, invertir); setInclinar(!inclinar);
    };
    const alternarVoz = () => { guardarLS(KEY_VOZ, !voz); setVoz(!voz); if (voz) window.speechSynthesis?.cancel(); };

    // Volante táctil
    const volRef = useRef(null);
    const moverVolante = (ev) => {
        const r = volRef.current.getBoundingClientRect();
        const v = Math.max(-1, Math.min(1, ((ev.clientX - r.left) / r.width - 0.5) * 2.4));
        setVolante(v); m()?.setEntradaTactil({ steer: v });
    };
    const soltarVolante = () => { setVolante(0); m()?.setEntradaTactil({ steer: 0 }); };
    const pedal = (campo) => ({
        onPointerDown: (e) => { e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); m()?.setEntradaTactil({ [campo]: 1 }); },
        onPointerUp: () => m()?.setEntradaTactil({ [campo]: 0 }),
        onPointerCancel: () => m()?.setEntradaTactil({ [campo]: 0 }),
    });

    const btn = { background: 'rgba(15,20,28,0.78)', color: 'white', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 10, padding: '7px 10px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: FUENTE, backdropFilter: 'blur(4px)' };
    const ins = est?.instruccion;
    return (
        <div style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none', fontFamily: FUENTE }}>
            <div ref={contRef} style={{ position: 'absolute', inset: 0 }} />

            {carton ? (
                <div style={{ position: 'absolute', inset: 0, zIndex: 5 }}
                    onPointerDown={() => m()?.setEntradaTactil({ freno: 1 })}
                    onPointerUp={() => m()?.setEntradaTactil({ freno: 0 })}
                    onPointerCancel={() => m()?.setEntradaTactil({ freno: 0 })}>
                    <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8 }} onPointerDown={e => e.stopPropagation()}>
                        <button style={btn} onClick={salirCarton}>✕ Salir de las gafas</button>
                        <button style={btn} onClick={() => m().recentrar()}>🎯 Centrar</button>
                        <button style={{ ...btn, background: confort ? '#1565c0' : btn.background }} title="Oscurece los bordes al girar o frenar: reduce el mareo" onClick={() => { m().setConfort(!confort); setConfort(!confort); }}>🌫️ Confort</button>
                        <button style={btn} onClick={() => m().alternarCinturon()}>{est?.cinturon ? '🔒' : '🔓'} {est?.vehiculo === 'moto' ? 'Casco' : 'Cinturón'}</button>
                    </div>
                </div>
            ) : (
                <>
                    {/* HUD superior */}
                    <div style={{ position: 'absolute', top: 8, left: 8, right: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, zIndex: 5, pointerEvents: 'none' }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', pointerEvents: 'auto', maxWidth: '60%' }}>
                            <button style={btn} onClick={terminar}>⏹ Terminar</button>
                            <button style={btn} onClick={() => m().alternarCamara()}>🎥 {est?.vista === 'cabina' ? 'Vista exterior' : 'Vista asiento'}</button>
                            {est?.vista === 'cabina' && <button style={btn} title="Campo de visión (F)" onClick={() => m().cambiarCampo()}>🔭</button>}
                            {vr && <button style={{ ...btn, background: '#6a1b9a' }} onClick={() => m().entrarVR().catch(() => {})}>🥽 Gafas VR</button>}
                            {tactil && <button style={btn} onClick={entrarCarton}>👓 Gafas de cartón</button>}
                            {tactil && <button style={{ ...btn, background: inclinar ? '#1565c0' : btn.background }} onClick={alternarInclinar}>📱 Inclinar</button>}
                            {tactil && inclinar && <button style={btn} onClick={() => { m().setInclinacion(true, !invertir); setInvertir(!invertir); }}>⇄</button>}
                            <button style={btn} onClick={() => setTactil(t => !t)}>{tactil ? '⌨️' : '🕹️'}</button>
                            {!tactil && <button style={{ ...btn, background: raton ? '#1565c0' : btn.background }} title="Mirar a los lados moviendo el ratón hacia los bordes (también Z / X)" onClick={() => { guardarLS(KEY_RATON, !raton); m().setMirarRaton(!raton); setRaton(!raton); }}>🖱️ Mirar</button>}
                            <button style={btn} onClick={alternarVoz}>{voz ? '🔊' : '🔇'}</button>
                        </div>
                        <canvas ref={mmRef} width={170} height={170} style={{ width: 'min(170px, 28vw)', height: 'min(170px, 28vw)', borderRadius: 12, border: '2px solid rgba(255,255,255,0.25)', pointerEvents: 'none' }} />
                    </div>

                    {/* Velocidad + instrucción */}
                    {est && (
                        <div style={{ position: 'absolute', left: 10, bottom: tactil ? 150 : 14, zIndex: 5, display: 'flex', gap: 8, alignItems: 'flex-end', pointerEvents: 'none' }}>
                            <div style={{ background: 'rgba(10,14,20,0.8)', borderRadius: 14, padding: '8px 14px', color: 'white', textAlign: 'center', minWidth: 84 }}>
                                <div style={{ fontSize: '2rem', fontWeight: 900, color: est.limite && est.kmh > est.limite + 3 ? C.rojo : 'white', lineHeight: 1 }}>{est.kmh}</div>
                                <div style={{ fontSize: '0.7rem', color: C.suave }}>km/h · <b style={{ color: est.calado ? C.rojo : est.marcha === 'R' ? '#ffab40' : 'white', fontSize: '0.85rem' }}>{est.calado ? 'CALADO' : est.marcha}</b></div>
                                {est.embraguePedal && <div title="Embrague (Shift)" style={{ height: 5, background: '#263238', borderRadius: 3, marginTop: 3, overflow: 'hidden' }}><div style={{ height: '100%', width: `${(est.embrague || 0) * 100}%`, background: '#42a5f5' }} /></div>}
                                {est.consejoMarcha && <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#ffb000' }}>{est.consejoMarcha === 'subir' ? '▲ Sube (T)' : '▼ Reduce (G)'}</div>}
                                {Object.keys(placas).length > 0 && <div title="Placas micro:bit de la cabina" style={{ fontSize: '0.7rem', color: C.verde }}>🎮 {Object.keys(placas).map(k => ({ V: '🛞', I: '↔️', M: '⚙️', A: '🟩', F: '🟥', E: '🟦' }[k])).join('')}</div>}
                            </div>
                            {est.semaforo && (
                                <div title="Semáforo al que te acercas" style={{ background: '#111', borderRadius: 10, padding: '5px 6px', display: 'flex', flexDirection: 'column', gap: 4, border: '2px solid rgba(255,255,255,0.25)' }}>
                                    {['rojo', 'ambar', 'verde'].map(k => <div key={k} style={{ width: 15, height: 15, borderRadius: '50%', background: est.semaforo === k ? { rojo: '#ff3b30', ambar: '#ffb000', verde: '#00e676' }[k] : '#2a2a2a', boxShadow: est.semaforo === k ? `0 0 10px ${{ rojo: '#ff3b30', ambar: '#ffb000', verde: '#00e676' }[k]}` : 'none' }} />)}
                                </div>
                            )}
                            {est.limite && <img src={senalDataURL(est.limite === 20 ? 'R-301-20' : est.limite === 50 ? 'R-301-50' : 'R-301-30', 120)} alt="" style={{ width: 54, height: 54 }} />}
                            <div style={{ background: 'rgba(10,14,20,0.8)', borderRadius: 12, padding: '6px 10px', color: 'white', fontSize: '0.78rem', lineHeight: 1.5 }}>
                                <div style={{ color: est.cinturon ? C.verde : C.rojo, fontWeight: 700 }}>{est.vehiculo === 'moto' ? (est.cinturon ? '🪖 Casco' : '🔓 Sin casco (C)') : (est.cinturon ? '🔒 Cinturón' : '🔓 Sin cinturón (C)')}</div>
                                <div><span style={{ color: COLOR_GRAVEDAD.eliminatoria }}>E {est.faltas.eliminatoria}</span> · <span style={{ color: COLOR_GRAVEDAD.deficiente }}>D {est.faltas.deficiente}</span> · <span style={{ color: COLOR_GRAVEDAD.leve }}>L {est.faltas.leve}</span></div>
                            </div>
                        </div>
                    )}
                    {ins && ins.giro !== 'fin' && (
                        <div style={{ position: 'absolute', top: 62, left: '50%', transform: 'translateX(-50%)', zIndex: 5, background: 'rgba(21,101,192,0.92)', color: 'white', borderRadius: 14, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12, pointerEvents: 'none', maxWidth: '90vw' }}>
                            <span style={{ fontSize: '1.8rem' }}>{ins.giro === 'derecha' ? '↱' : ins.giro === 'izquierda' ? '↰' : ins.giro === 'recto' ? '↑' : ins.giro === 'glorieta' ? '🔄' : ins.giro === 'pista' ? '🚧' : '🅿️'}</span>
                            <div>
                                {ins.dist != null && <div style={{ fontWeight: 900, fontSize: '1.15rem' }}>{Math.round(ins.dist)} m</div>}
                                <div style={{ fontSize: '0.82rem' }}>{ins.texto}</div>
                            </div>
                        </div>
                    )}
                    {/* Avisos e infracciones */}
                    <div style={{ position: 'absolute', top: ins ? 130 : 62, left: '50%', transform: 'translateX(-50%)', zIndex: 6, display: 'flex', flexDirection: 'column', gap: 6, width: 'min(440px, 92vw)', pointerEvents: 'none' }}>
                        {avisos.map(a => (
                            <div key={a.id} style={{ background: a.falta ? 'rgba(25,10,10,0.9)' : 'rgba(10,20,30,0.85)', borderLeft: `5px solid ${a.falta ? COLOR_GRAVEDAD[a.gravedad] : C.azul}`, color: 'white', borderRadius: 10, padding: '8px 12px', fontSize: '0.86rem' }}>
                                {a.falta ? (<>
                                    <b style={{ color: COLOR_GRAVEDAD[a.gravedad] }}>Falta {NOMBRE_GRAVEDAD[a.gravedad].toLowerCase()}:</b> {a.texto}{a.extra ? ` (${a.extra})` : ''}
                                    <div style={{ color: '#cfd8dc', fontSize: '0.78rem', marginTop: 2 }}>{a.explicacion}</div>
                                </>) : a.texto}
                            </div>
                        ))}
                    </div>

                    {/* Controles táctiles */}
                    {tactil && (
                        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 140, zIndex: 5, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 10px 10px', gap: 10, touchAction: 'none' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, maxWidth: 360 }}>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <button style={{ ...btn, flex: 1, background: est?.intermitente === 'izq' ? '#2e7d32' : btn.background }} onClick={() => m().setIntermitente('izq')}>⬅ Interm.</button>
                                    <button style={{ ...btn, flex: 1, background: est?.cinturon ? '#2e7d32' : '#b71c1c' }} onClick={() => m().alternarCinturon()}>{est?.vehiculo === 'moto' ? '🪖' : est?.cinturon ? '🔒' : '🔓'}</button>
                                    {est?.cambio === 'manual' ? (<>
                                        <button style={{ ...btn, padding: '7px 8px' }} onClick={() => m().bajarMarcha()}>▼</button>
                                        <div style={{ ...btn, padding: '7px 8px', minWidth: 26, textAlign: 'center', background: est.calado ? '#b71c1c' : est.marcha === 'R' ? '#ef6c00' : btn.background }}>{est.marcha}</div>
                                        <button style={{ ...btn, padding: '7px 8px' }} onClick={() => m().subirMarcha()}>▲</button>
                                    </>) : <button style={{ ...btn, flex: 1, background: est?.marcha === 'R' ? '#ef6c00' : btn.background }} onClick={() => m().alternarMarcha()}>{est?.marcha === 'R' ? 'R' : 'D'}</button>}
                                    <button style={{ ...btn, flex: 1, background: est?.intermitente === 'der' ? '#2e7d32' : btn.background }} onClick={() => m().setIntermitente('der')}>Interm. ➡</button>
                                </div>
                                {!inclinar && (
                                    <div ref={volRef} onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); moverVolante(e); }} onPointerMove={(e) => { if (e.buttons || e.pointerType === 'touch') moverVolante(e); }} onPointerUp={soltarVolante} onPointerCancel={soltarVolante}
                                        style={{ height: 76, borderRadius: 38, background: 'rgba(15,20,28,0.7)', border: '2px solid rgba(255,255,255,0.2)', position: 'relative', touchAction: 'none' }}>
                                        <div style={{ position: 'absolute', top: '50%', left: `${50 + volante * 38}%`, transform: `translate(-50%,-50%) rotate(${volante * 120}deg)`, fontSize: '2.6rem', pointerEvents: 'none' }}>🛞</div>
                                        <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px', color: 'rgba(255,255,255,0.35)', fontSize: '1.4rem', pointerEvents: 'none' }}><span>◀</span><span>▶</span></div>
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: 10 }}>
                                {est?.embraguePedal && <div {...pedal('embrague')} style={{ width: 70, height: 100, borderRadius: 16, background: 'rgba(21,101,192,0.85)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.72rem', touchAction: 'none' }}>EMBRAGUE</div>}
                                <div {...pedal('freno')} style={{ width: 82, height: 110, borderRadius: 16, background: 'rgba(183,28,28,0.85)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', touchAction: 'none' }}>FRENO</div>
                                <div {...pedal('acel')} style={{ width: 70, height: 124, borderRadius: 16, background: 'rgba(27,94,32,0.85)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.78rem', touchAction: 'none', writingMode: 'vertical-rl' }}>ACELERAR</div>
                            </div>
                        </div>
                    )}
                    {tactil && vertical && <div style={{ position: 'absolute', top: '42%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 6, background: 'rgba(10,14,20,0.85)', color: 'white', borderRadius: 14, padding: '10px 16px', fontSize: '0.9rem', textAlign: 'center', pointerEvents: 'none' }}>🔄 Gira el móvil en horizontal<br /><span style={{ color: C.suave, fontSize: '0.8rem' }}>verás mucho mejor la calle</span></div>}
                    {enVR && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.2rem', zIndex: 7, background: 'rgba(0,0,0,0.6)' }}>🥽 Conduciendo con las gafas VR…</div>}
                </>
            )}
        </div>
    );
}

function ResultadoConduccion({ res, onRepetir, onMenu }) {
    const [envio, setEnvio] = useState(false);
    const examen = res.modo === 'examen' || res.modo === 'pista';
    const nombreModo = res.modo === 'pista' ? 'Pista de moto' : `${examen ? 'Examen práctico' : 'Conducción libre'}${res.vehiculo === 'moto' ? ' en moto' : ''}`;
    useEffect(() => {
        guardarRegistroLocal('CONDUCCION', {
            titulo: examen ? `${nombreModo} · ${res.apto && res.completado ? 'APTO' : 'NO APTO'}` : nombreModo,
            aciertos: examen ? (res.apto && res.completado ? 1 : 0) : Math.max(0, 10 - res.faltas.length), intentos: examen ? 1 : 10, via: 'juego',
        });
    }, [res, examen]);
    const grupos = ['eliminatoria', 'deficiente', 'leve'].map(g => ({ g, lista: res.faltas.filter(f => f.gravedad === g) }));
    const veredicto = !examen ? null : !res.completado ? (res.apto ? 'SIN TERMINAR' : 'NO APTO') : res.apto ? 'APTO' : 'NO APTO';
    const colorV = veredicto === 'APTO' ? C.verde : veredicto === 'SIN TERMINAR' ? C.naranja : C.rojo;
    return (
        <div>
            <Cabecera titulo={examen ? 'Resultado del examen práctico' : 'Resumen de la conducción'} onVolver={onMenu} />
            <div style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
                <div style={{ textAlign: 'center', background: C.panel, borderRadius: 18, padding: 22, border: `2px solid ${examen ? colorV : C.borde}` }}>
                    <div style={{ fontSize: '3rem' }}>{examen ? (veredicto === 'APTO' ? '🏆' : '🚧') : res.faltas.length ? '🚗' : '🌟'}</div>
                    {examen && <div style={{ fontSize: '2rem', fontWeight: 900, color: colorV }}>{veredicto}</div>}
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', margin: '12px 0', flexWrap: 'wrap' }}>
                        {grupos.map(({ g, lista }) => (
                            <div key={g} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '8px 14px', minWidth: 96 }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: COLOR_GRAVEDAD[g] }}>{lista.length}</div>
                                <div style={{ fontSize: '0.78rem', color: C.suave }}>{NOMBRE_GRAVEDAD[g]}{lista.length === 1 ? '' : 's'}</div>
                            </div>
                        ))}
                    </div>
                    <div style={{ color: C.suave, fontSize: '0.88rem' }}>
                        {res.recorrido} m recorridos · {Math.floor(res.tiempo / 60)} min {res.tiempo % 60} s
                        {examen && ` · ${res.modo === 'pista' ? 'pista' : 'ruta'} ${res.completado ? 'completada' : 'sin terminar'}`}
                    </div>
                    {!examen && res.faltas.length === 0 && <div style={{ color: C.verde, marginTop: 8, fontWeight: 700 }}>¡Sin ninguna infracción! Prueba ahora el examen práctico.</div>}
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 16 }}>
                        <Boton onClick={onRepetir}>🔁 Volver a conducir</Boton>
                        <Boton color={C.amarillo} onClick={() => setEnvio(true)}>📤 Enviar al profesor</Boton>
                        <Boton color="#2c3540" onClick={onMenu}>Menú</Boton>
                    </div>
                </div>
                {res.faltas.length > 0 && <h3 style={{ marginTop: 22 }}>Tus infracciones</h3>}
                {res.faltas.map((f, i) => (
                    <div key={i} style={{ background: C.panel, borderRadius: 12, padding: '10px 14px', marginBottom: 8, borderLeft: `5px solid ${COLOR_GRAVEDAD[f.gravedad]}`, fontSize: '0.9rem', lineHeight: 1.45 }}>
                        <b>{f.texto}</b> <span style={{ color: COLOR_GRAVEDAD[f.gravedad], fontSize: '0.78rem' }}>· {NOMBRE_GRAVEDAD[f.gravedad]}</span>
                        <span style={{ color: C.suave, fontSize: '0.78rem' }}> · min {Math.floor(f.t / 60)}:{String(f.t % 60).padStart(2, '0')}{f.extra ? ` · ${f.extra}` : ''}</span>
                        <div style={{ color: C.suave }}>{f.explicacion}</div>
                    </div>
                ))}
            </div>
            {envio && <ModalEnviarProfe onClose={() => setEnvio(false)} datos={{
                modalidad: nombreModo,
                aciertos: examen ? (res.apto && res.completado ? 1 : 0) : Math.max(0, 10 - res.faltas.length), intentos: examen ? 1 : 10,
                apto: examen ? (res.apto && res.completado) : null, completado: !!res.completado,
                eliminatorias: res.eliminatoria, deficientes: res.deficiente, leves: res.leve, recorrido: res.recorrido, tiempo: res.tiempo,
                faltasLista: res.faltas.slice(0, 50).map(f => ({ tipo: f.tipo, texto: f.texto, gravedad: f.gravedad, extra: String(f.extra || '').slice(0, 80), t: f.t })),
            }} />}
        </div>
    );
}

// ═══════════════════════════ ENVIAR AL PROFESOR ════════════════════════════
function ModalEnviarProfe({ datos, onClose }) {
    const [codigo, setCodigo] = useState('');
    const [nombre, setNombre] = useState('');
    const [curso, setCurso] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [enviado, setEnviado] = useState(false);
    const [error, setError] = useState('');
    const inp = { padding: '9px 12px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' };
    const enviar = async () => {
        const code = codigo.trim().toUpperCase();
        const v = validarNombre(nombre);
        if (!v.ok) { setError(v.mensaje); return; }
        if (!code) { setError('Escribe el código del profesor.'); return; }
        setEnviando(true); setError('');
        try {
            const snap = await getDoc(doc(db, 'codigos_profesor', code));
            if (!snap.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
            const { modalidad, ...resto } = datos;
            const porcentaje = Math.round((datos.aciertos / Math.max(1, datos.intentos)) * 100);
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'CONDUCCION', modalidad, fecha: new Date(), codigoProfesor: code, recursoTitulo: `Conducción · ${modalidad}`,
                jugadores: [{ nombre: nombre.trim(), curso: curso.trim(), porcentaje, ...resto }],
            });
            guardarRegistroLocal('CONDUCCION', { titulo: `Conducción · ${modalidad}`, aciertos: datos.aciertos, intentos: datos.intentos, porcentaje, nombre: nombre.trim(), curso: curso.trim(), via: 'profesor' });
            setEnviado(true);
        } catch (e) { setError('Error: ' + e.message); }
        setEnviando(false);
    };
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 10001, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 14 }}>
            <div style={{ background: '#1b222c', border: '1px solid rgba(255,214,0,0.35)', borderRadius: 20, width: '100%', maxWidth: 400, padding: '22px 24px', color: 'white', fontFamily: FUENTE }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: C.amarillo }}>📤 Enviar al profesor</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.2rem' }}>✕</button>
                </div>
                {enviado ? (
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                        <div style={{ fontSize: '3rem' }}>✅</div>
                        <div style={{ color: C.verde, fontWeight: 700 }}>¡Informe enviado!</div>
                        <Boton onClick={onClose} color="#2c3540" estilo={{ marginTop: 14 }}>Cerrar</Boton>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre y apellido" style={inp} />
                        <input value={curso} onChange={e => setCurso(e.target.value)} placeholder="Curso (ej. 4º ESO B)" style={inp} />
                        <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="Código del profesor" maxLength={10} style={{ ...inp, letterSpacing: 2, fontWeight: 700 }} />
                        {error && <div style={{ color: C.rojo, fontSize: '0.82rem' }}>⚠ {error}</div>}
                        <Boton onClick={enviar} disabled={enviando} color={C.azul}>{enviando ? 'Enviando…' : '📤 Enviar'}</Boton>
                    </div>
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════ RAÍZ ══════════════════════════════════════
export default function SimuladorConduccion({ onExit }) {
    const [pantalla, setPantalla] = useState('MENU');
    const [cfgTest, setCfgTest] = useState(null);
    const [temaTest, setTemaTest] = useState(null);
    const [resTest, setResTest] = useState(null);
    const [cfgSim, setCfgSim] = useState(null);
    const [modoSim, setModoSim] = useState('libre');
    const [resSim, setResSim] = useState(null);
    const [claveSim, setClaveSim] = useState(0);

    const elegir = (id) => {
        if (id === 'SIM_LIBRE') { setModoSim('libre'); setPantalla('SIM_CONFIG'); return; }
        if (id === 'SIM_EXAMEN') { setModoSim('examen'); setPantalla('SIM_CONFIG'); return; }
        if (id === 'TEST_CONFIG') setTemaTest(null);
        setPantalla(id);
    };
    const contenedor = (hijo) => (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: C.fondo, color: C.texto, overflowY: 'auto', fontFamily: FUENTE }}>{hijo}</div>
    );

    if (pantalla === 'SIM' && cfgSim) {
        return <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}><Conduccion key={claveSim} config={cfgSim} onSalir={() => setPantalla('MENU')} onFin={(r) => { setResSim(r); setPantalla('SIM_FIN'); }} /></div>;
    }
    if (pantalla === 'CABINA') return contenedor(<Suspense fallback={<div style={{ padding: 30 }}>Cargando…</div>}><CabinaMicrobit onVolver={() => setPantalla('MENU')} onConducir={(modo) => { setModoSim(modo); setPantalla('SIM_CONFIG'); }} /></Suspense>);
    if (pantalla === 'PDF') return contenedor(<FichasPdf onVolver={() => setPantalla('MENU')} />);
    if (pantalla === 'SENALES') return contenedor(<CatalogoSenales onVolver={() => setPantalla('MENU')} onTest={() => { setTemaTest('senales'); setPantalla('TEST_CONFIG'); }} />);
    if (pantalla === 'TEST_CONFIG') return contenedor(<ConfigTest key={temaTest || 'x'} temaInicial={temaTest} onVolver={() => setPantalla('MENU')} onEmpezar={(c) => { setCfgTest({ ...c, _t: Date.now() }); setPantalla('TEST'); }} />);
    if (pantalla === 'TEST' && cfgTest) return contenedor(<Test config={cfgTest} onVolver={() => setPantalla('TEST_CONFIG')} onFin={(r) => { setResTest(r); setPantalla('TEST_FIN'); }} />);
    if (pantalla === 'TEST_FIN' && resTest) return contenedor(<ResultadoTest res={resTest} onRepetir={() => setPantalla('TEST_CONFIG')} onMenu={() => setPantalla('MENU')} />);
    if (pantalla === 'SIM_CONFIG') return contenedor(<ConfigSimulador modo={modoSim} onVolver={() => setPantalla('MENU')} onEmpezar={(c) => { setCfgSim(c); setClaveSim(k => k + 1); setPantalla('SIM'); }} />);
    if (pantalla === 'SIM_FIN' && resSim) return contenedor(<ResultadoConduccion res={resSim} onRepetir={() => { setClaveSim(k => k + 1); setPantalla('SIM'); }} onMenu={() => setPantalla('MENU')} />);
    return contenedor(<Menu onElegir={elegir} onExit={onExit} />);
}

export { FALTAS, calificar, SENAL_POR_ID };
