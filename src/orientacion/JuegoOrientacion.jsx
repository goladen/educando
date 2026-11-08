import React, { useEffect, useMemo, useRef, useState } from 'react';
import MapaOrientacion, { SelectorCapa, MAGENTA } from './MapaOrientacion';
import { useGps, useBrujula, Brujula, RosaVientos } from './sensores';
import { distancia, indicacion, fmtGrados, pasosDe, fmtTiempo, normalizar, redondearM } from './geo';
import ModalEnviarResultado from '../components/retos/ModalEnviarResultado';
import { guardarRegistroLocal } from '../utils/registrosLocales';

export const MODOS = {
    cardinal: { emoji: '🧭', nombre: 'Puntos cardinales', desc: 'Sin mapa. Cada baliza se busca con indicaciones de Norte, Sur, Este u Oeste y la distancia en metros.' },
    rumbo: { emoji: '📐', nombre: 'Rumbo en grados', desc: 'Sin mapa. Cada tramo da el rumbo (0-360°) y la distancia; la brújula del móvil ayuda a orientarse.' },
    mapa: { emoji: '🗺️', nombre: 'Con mapa', desc: 'Las balizas aparecen en el mapa (satélite o callejero): orientación clásica.' },
};

const claveProgreso = (c) => `pikt_orient_prog_${c.id || c.titulo || 'local'}`;

export default function JuegoOrientacion({ carrera, onExit, esPrueba = false }) {
    const cfg = carrera.config || {};
    const modo = cfg.modo || 'cardinal';
    const radio = cfg.radio || 10;
    const usaGps = cfg.validacion !== 'codigo';
    const usaCodigo = cfg.validacion !== 'gps';
    const balizas = carrera.balizas || [];
    const ordenLibre = modo === 'mapa' && !!cfg.ordenLibre;
    const longPaso = cfg.longPaso || 0.65;

    const [fase, setFase] = useState('inicio');
    const [nombre, setNombre] = useState('');
    const [inicio, setInicio] = useState(null);
    const [fin, setFin] = useState(null);
    const [encontradas, setEncontradas] = useState({}); // id → { t, via, respuesta, correcta }
    const [saltadas, setSaltadas] = useState([]);
    const [pregunta, setPregunta] = useState(null); // baliza pendiente de responder
    const [respuesta, setRespuesta] = useState('');
    const [codigo, setCodigo] = useState('');
    const [aviso, setAviso] = useState('');
    const [capa, setCapa] = useState(cfg.capa || 'satelite');
    const [ahora, setAhora] = useState(Date.now());
    const [enviar, setEnviar] = useState(false);
    const [guardado, setGuardado] = useState(false);
    const [simulada, setSimulada] = useState(null);
    const [progresoGuardado] = useState(() => { try { return JSON.parse(localStorage.getItem(claveProgreso(carrera)) || 'null'); } catch (_) { return null; } });

    const enCarrera = fase === 'carrera';
    const gps = useGps(enCarrera && usaGps);
    const pos = simulada || gps.pos;
    const brujula = useBrujula();

    // Reloj y bloqueo de pantalla mientras se corre
    useEffect(() => {
        if (!enCarrera) return;
        const t = setInterval(() => setAhora(Date.now()), 1000);
        let lock = null;
        navigator.wakeLock?.request?.('screen').then(l => { lock = l; }).catch(() => {});
        return () => { clearInterval(t); lock?.release?.().catch(() => {}); };
    }, [enCarrera]);

    // Guardar progreso por si se recarga la página o se bloquea el móvil
    useEffect(() => {
        if (!enCarrera) return;
        try { localStorage.setItem(claveProgreso(carrera), JSON.stringify({ nombre, inicio, encontradas, saltadas })); } catch (_) {}
    }, [enCarrera, nombre, inicio, encontradas, saltadas]); // eslint-disable-line react-hooks/exhaustive-deps

    const hechas = (id) => !!encontradas[id] || saltadas.includes(id);
    const pendientes = balizas.filter(b => !hechas(b.id));
    const idxActual = balizas.findIndex(b => !hechas(b.id));
    const objetivoBaliza = ordenLibre ? null : (idxActual >= 0 ? balizas[idxActual] : null);
    const haciaMeta = !ordenLibre && idxActual < 0 && cfg.metaEnSalida && carrera.salida;
    const objetivo = objetivoBaliza || (haciaMeta ? { ...carrera.salida, id: '__meta', esMeta: true } : null);

    // Punto de partida del tramo actual: la última baliza anterior (encontrada o saltada) o la salida
    const origen = useMemo(() => {
        if (!objetivo) return null;
        const i = objetivo.esMeta ? balizas.length : balizas.findIndex(b => b.id === objetivo.id);
        return i > 0 ? { ...balizas[i - 1], num: i } : (carrera.salida ? { ...carrera.salida, esSalida: true } : null);
    }, [objetivo?.id]); // eslint-disable-line react-hooks/exhaustive-deps
    const ind = origen && objetivo ? indicacion(origen, objetivo) : null;
    const idsEncontradas = useMemo(() => new Set(Object.keys(encontradas)), [encontradas]);

    const terminar = () => { setFin(Date.now()); setFase('fin'); try { localStorage.removeItem(claveProgreso(carrera)); } catch (_) {} };

    const marcar = (b, via) => {
        if (hechas(b.id)) return;
        if (b.pregunta) { setPregunta({ b, via }); setRespuesta(''); return; }
        registrar(b, via, null);
    };
    const registrar = (b, via, resp) => {
        const correcta = resp == null ? null : (!b.respuesta || normalizar(resp) === normalizar(b.respuesta));
        setEncontradas(e => ({ ...e, [b.id]: { t: Date.now(), via, respuesta: resp, correcta } }));
        setAviso(`🎉 ¡Baliza ${balizas.findIndex(x => x.id === b.id) + 1} encontrada!`);
        setCodigo(''); setPregunta(null);
        if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
        setTimeout(() => setAviso(''), 3500);
    };

    // ¿Se ha terminado?
    useEffect(() => {
        if (!enCarrera) return;
        if (!pendientes.length && !haciaMeta && !pregunta) terminar();
    }, [pendientes.length, haciaMeta, enCarrera, pregunta]); // eslint-disable-line react-hooks/exhaustive-deps

    // Detección automática por GPS
    const prevDist = useRef(null);
    const [tendencia, setTendencia] = useState(null);
    const dentro = (p, b) => p && distancia(p, b) <= radio + Math.min(p.precision || 0, 12) * 0.5 && (p.precision || 0) <= 35;
    useEffect(() => {
        if (!enCarrera || !usaGps || !pos || pregunta) return;
        if (objetivo?.esMeta) { if (dentro(pos, objetivo)) terminar(); return; }
        const candidatas = ordenLibre ? pendientes : (objetivoBaliza ? [objetivoBaliza] : []);
        const b = candidatas.find(x => dentro(pos, x));
        if (b) marcar(b, 'gps');
        // frío / caliente
        if (cfg.pistaCaliente && objetivo) {
            const d = distancia(pos, objetivo);
            if (prevDist.current != null && Math.abs(d - prevDist.current) > 3) { setTendencia(d < prevDist.current ? 'cerca' : 'lejos'); prevDist.current = d; }
            else if (prevDist.current == null) prevDist.current = d;
        }
    }, [pos]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { prevDist.current = null; setTendencia(null); }, [objetivo?.id]);

    const comprobarCodigo = () => {
        const c = codigo.trim().toUpperCase();
        if (!c) return;
        const lista = ordenLibre ? pendientes : (objetivoBaliza ? [objetivoBaliza] : []);
        const b = lista.find(x => x.codigo.toUpperCase() === c);
        if (b) marcar(b, 'codigo');
        else {
            const otra = balizas.find(x => x.codigo.toUpperCase() === c);
            setAviso(otra ? `⚠️ Ese código es de la baliza ${balizas.indexOf(otra) + 1}, no de la que buscas.` : '❌ Código incorrecto.');
            setTimeout(() => setAviso(''), 3500);
        }
    };

    const saltar = () => {
        if (!objetivoBaliza) return;
        if (!window.confirm('¿Saltar esta baliza? Contará como no encontrada.')) return;
        setSaltadas(s => [...s, objetivoBaliza.id]);
    };

    const empezar = (continuar) => {
        if (continuar && progresoGuardado) {
            setNombre(progresoGuardado.nombre || ''); setInicio(progresoGuardado.inicio || Date.now());
            setEncontradas(progresoGuardado.encontradas || {}); setSaltadas(progresoGuardado.saltadas || []);
        } else { setInicio(Date.now()); setEncontradas({}); setSaltadas([]); }
        setFase('carrera');
    };

    const nEnc = Object.keys(encontradas).length;
    const conPreg = balizas.filter(b => b.pregunta && b.respuesta);
    const nPregOk = Object.values(encontradas).filter(e => e.correcta === true).length;
    const tiempo = (fin || ahora) - (inicio || ahora);

    const datosInforme = {
        puntos: nEnc * 10 + nPregOk * 5,
        aciertos: nEnc, intentos: balizas.length,
        porcentaje: balizas.length ? Math.round(nEnc / balizas.length * 100) : 0,
        tiempo: fmtTiempo(tiempo), tiempoSeg: Math.round(tiempo / 1000),
        distanciaRecorrida: Math.round(gps.recorrido),
        preguntasAcertadas: nPregOk, preguntasTotal: conPreg.length,
        carrera: carrera.titulo || 'Carrera', modo: MODOS[modo].nombre,
        saltadas: saltadas.length,
    };

    // ─────────────────────────── Pantallas ───────────────────────────
    if (fase === 'inicio') return (
        <Marco onExit={onExit} titulo={carrera.titulo}>
            <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {esPrueba && <div style={{ background: '#fef3c7', color: '#92400e', padding: '10px 14px', borderRadius: 12, fontWeight: 600, fontSize: '0.88rem' }}>🧪 Modo prueba del profesor: podrás simular que llegas a cada baliza.</div>}
                <div style={tarjeta}>
                    <div style={{ fontSize: '2.6rem' }}>{MODOS[modo].emoji}</div>
                    <h2 style={{ margin: '4px 0' }}>{MODOS[modo].nombre}</h2>
                    <p style={{ color: '#475569', margin: 0 }}>{MODOS[modo].desc}</p>
                    {carrera.descripcion && <p style={{ color: '#0f172a', fontWeight: 600 }}>{carrera.descripcion}</p>}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 10 }}>
                        <Chip>🚩 {balizas.length} balizas</Chip>
                        {ordenLibre && <Chip>🔀 Orden libre</Chip>}
                        {usaGps && <Chip>📍 Se valida con GPS ({radio} m)</Chip>}
                        {usaCodigo && <Chip>🔤 Código de la baliza</Chip>}
                        {cfg.metaEnSalida && <Chip>◎ Se vuelve a la salida</Chip>}
                    </div>
                </div>
                <div style={tarjeta}>
                    <label style={{ fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>Tu nombre (o el de tu equipo)</label>
                    <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Escribe tu nombre" style={inp} />
                    <ul style={{ textAlign: 'left', color: '#475569', fontSize: '0.88rem', lineHeight: 1.5, paddingLeft: 18 }}>
                        <li>Ve a la <b>salida</b> antes de empezar.</li>
                        {usaGps && <li>Permite el acceso a la <b>ubicación</b> y mantén la pantalla encendida.</li>}
                        {modo !== 'mapa' && <li>Busca <b>el Norte</b> con la brújula del móvil o con el sol.</li>}
                        {usaCodigo && <li>En cada baliza encontrarás un <b>código</b> de 3 letras.</li>}
                    </ul>
                    <button onClick={() => empezar(false)} disabled={!nombre.trim()} style={{ ...btnG, opacity: nombre.trim() ? 1 : 0.5 }}>▶️ ¡Empezar la carrera!</button>
                    {progresoGuardado && progresoGuardado.inicio && (
                        <button onClick={() => empezar(true)} style={{ ...btnG, background: '#0ea5e9', marginTop: 8 }}>⏯️ Continuar la carrera de {progresoGuardado.nombre || 'antes'}</button>
                    )}
                </div>
            </div>
        </Marco>
    );

    if (fase === 'fin') return (
        <Marco onExit={onExit} titulo={carrera.titulo}>
            <div style={{ maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={tarjeta}>
                    <div style={{ fontSize: '3.2rem' }}>{nEnc === balizas.length ? '🏆' : '🏁'}</div>
                    <h2 style={{ margin: '4px 0' }}>¡Carrera terminada, {nombre}!</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginTop: 12 }}>
                        <Dato v={`${nEnc}/${balizas.length}`} l="balizas" />
                        <Dato v={fmtTiempo(tiempo)} l="tiempo" />
                        {usaGps && gps.recorrido > 0 && <Dato v={`${Math.round(gps.recorrido)} m`} l="recorridos" />}
                        {conPreg.length > 0 && <Dato v={`${nPregOk}/${conPreg.length}`} l="preguntas" />}
                    </div>
                </div>
                <div style={{ ...tarjeta, textAlign: 'left' }}>
                    <b>Parciales</b>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8, fontSize: '0.88rem' }}>
                        <tbody>
                            {balizas.map((b, i) => {
                                const e = encontradas[b.id];
                                const prev = i === 0 ? inicio : (encontradas[balizas[i - 1].id]?.t || null);
                                return (
                                    <tr key={b.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                        <td style={{ padding: 6, fontWeight: 800, color: MAGENTA }}>{i + 1}</td>
                                        <td style={{ padding: 6 }}>{e ? (e.via === 'gps' ? '📍 GPS' : e.via === 'sim' ? '🧪' : '🔤 código') : '⏭️ saltada'}</td>
                                        <td style={{ padding: 6 }}>{e ? fmtTiempo(e.t - inicio) : '—'}{e && prev && !ordenLibre ? <span style={{ color: '#94a3b8' }}> (+{fmtTiempo(e.t - prev)})</span> : null}</td>
                                        <td style={{ padding: 6 }}>{e?.correcta === true ? '✅' : e?.correcta === false ? `❌ ${b.respuesta}` : ''}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button onClick={() => setEnviar(true)} style={{ ...btnG, flex: 1 }}>📤 Enviar al profesor</button>
                    <button disabled={guardado} onClick={() => {
                        guardarRegistroLocal('ORIENTACION', { titulo: carrera.titulo || 'Orientación', aciertos: nEnc, intentos: balizas.length, porcentaje: datosInforme.porcentaje, nombre, via: 'local' });
                        setGuardado(true);
                    }} style={{ ...btnG, flex: 1, background: guardado ? '#94a3b8' : '#0ea5e9' }}>{guardado ? '✓ Guardado' : '💾 Guardar en mi dispositivo'}</button>
                </div>
                <button onClick={() => { setFase('inicio'); setFin(null); }} style={{ ...btnG, background: '#64748b' }}>🔁 Repetir</button>
            </div>
            {enviar && <ModalEnviarResultado tipo="ORIENTACION" nombreJuego={`Orientación · ${carrera.titulo || ''}`} datos={{ ...datosInforme }} onClose={() => setEnviar(false)} />}
        </Marco>
    );

    // ── Carrera en marcha ──
    const dist = pos && objetivo ? distancia(pos, objetivo) : null;
    const numObj = objetivo?.esMeta ? '◎' : objetivo ? balizas.findIndex(b => b.id === objetivo.id) + 1 : null;
    return (
        <Marco onExit={() => { if (window.confirm('¿Salir de la carrera? Podrás continuarla luego.')) onExit(); }} titulo={carrera.titulo}
            derecha={<span style={{ fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>⏱️ {fmtTiempo(tiempo)} · {nEnc}/{balizas.length}</span>}>
            <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {usaGps && <EstadoGps gps={gps} simulada={!!simulada} />}
                {aviso && <div style={{ background: aviso.startsWith('🎉') ? '#dcfce7' : '#fee2e2', color: aviso.startsWith('🎉') ? '#166534' : '#991b1b', padding: '12px 14px', borderRadius: 12, fontWeight: 800, textAlign: 'center' }}>{aviso}</div>}

                {modo === 'mapa' ? (
                    <div style={{ ...tarjeta, padding: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
                            <b>{ordenLibre ? `Encuentra las ${balizas.length} balizas en el orden que quieras` : objetivo?.esMeta ? 'Vuelve a la meta ◎' : `Busca la baliza ${numObj}`}</b>
                            <SelectorCapa capa={capa} onCapa={setCapa} compacto />
                        </div>
                        <MapaOrientacion carrera={carrera} capa={capa} verLineas={!ordenLibre} alto="58vh" ajustarKey="ini"
                            encontradas={idsEncontradas} activa={objetivo?.id}
                            posicion={cfg.mostrarPosicion || simulada ? pos : null}
                            onClickMapa={esPrueba ? (lat, lng) => setSimulada({ lat, lng, precision: 5 }) : undefined} />
                        {esPrueba && <div style={{ fontSize: '0.78rem', color: '#92400e', marginTop: 6 }}>🧪 Toca el mapa para simular tu posición.</div>}
                    </div>
                ) : objetivo && ind && (
                    <div style={{ ...tarjeta, padding: '18px 16px' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#64748b', letterSpacing: 1 }}>
                            {origen?.esSalida ? 'DESDE LA SALIDA' : `DESDE LA BALIZA ${origen?.num}`} → {objetivo.esMeta ? 'META' : `BALIZA ${numObj}`}
                        </div>
                        {modo === 'cardinal' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'center', margin: '10px 0' }}>
                                <RosaVientos tam={96} resaltar={cfg.formatoCardinal === 'rosa8' ? [ind.dir8.abr] : ind.partes.map(p => p.abr)} />
                                <div style={{ textAlign: 'left' }}>
                                    {cfg.formatoCardinal === 'rosa8' ? (
                                        <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#0f172a', lineHeight: 1.15 }}>{ind.distancia} m<br /><span style={{ color: MAGENTA }}>hacia el {ind.dir8.nombre}</span></div>
                                    ) : ind.partes.map((p, i) => (
                                        <div key={i} style={{ fontSize: '1.55rem', fontWeight: 900, color: '#0f172a', lineHeight: 1.25 }}>
                                            {i > 0 && <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 700 }}>y luego </span>}
                                            {p.m} m <span style={{ color: MAGENTA }}>al {p.dir}</span>
                                        </div>
                                    ))}
                                    {cfg.mostrarPasos !== false && <div style={{ color: '#64748b', fontWeight: 600, marginTop: 4 }}>≈ {pasosDe(ind.distancia, longPaso)} pasos en total</div>}
                                </div>
                            </div>
                        ) : (
                            <div style={{ margin: '8px 0 4px' }}>
                                <div style={{ fontSize: '2.6rem', fontWeight: 900, color: MAGENTA, lineHeight: 1 }}>{fmtGrados(ind.rumbo)}</div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{ind.distancia} m{cfg.mostrarPasos !== false ? <span style={{ color: '#64748b', fontSize: '1rem' }}> · ≈ {pasosDe(ind.distancia, longPaso)} pasos</span> : null}</div>
                            </div>
                        )}
                        <Brujula rumbo={brujula.rumbo} objetivo={modo === 'rumbo' ? ind.rumbo : null} necesitaPermiso={brujula.necesitaPermiso} pedirPermiso={brujula.pedirPermiso} tam={modo === 'rumbo' ? 220 : 170} />
                        {cfg.pistaCaliente && tendencia && <div style={{ marginTop: 8, fontWeight: 800, fontSize: '1.1rem', color: tendencia === 'cerca' ? '#dc2626' : '#2563eb' }}>{tendencia === 'cerca' ? '🔥 ¡Te acercas!' : '❄️ Te alejas…'}</div>}
                    </div>
                )}

                {esPrueba && objetivo && modo !== 'mapa' && (
                    <button onClick={() => setSimulada({ lat: objetivo.lat, lng: objetivo.lng, precision: 4 })} style={{ ...btnG, background: '#f59e0b' }}>🧪 Simular que llego a {objetivo.esMeta ? 'la meta' : `la baliza ${numObj}`}</button>
                )}
                {esPrueba && dist != null && <div style={{ textAlign: 'center', color: '#92400e', fontSize: '0.8rem' }}>🧪 Distancia real al objetivo: {redondearM(dist)} m</div>}

                {usaCodigo && !objetivo?.esMeta && (
                    <div style={{ ...tarjeta, padding: 14 }}>
                        <div style={{ fontWeight: 700, color: '#334155', marginBottom: 8 }}>🔤 ¿Has encontrado la baliza? Escribe su código</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && comprobarCodigo()}
                                maxLength={6} placeholder="ABC" style={{ ...inp, letterSpacing: 6, fontWeight: 900, fontSize: '1.3rem', textAlign: 'center', fontFamily: 'Consolas, monospace' }} />
                            <button onClick={comprobarCodigo} style={{ ...btnG, width: 'auto', padding: '0 20px' }}>OK</button>
                        </div>
                    </div>
                )}
                {objetivo?.esMeta && !usaGps && <button onClick={terminar} style={btnG}>🏁 He llegado a la meta</button>}
                {objetivo?.esMeta && usaGps && <button onClick={terminar} style={{ ...btnG, background: '#64748b' }}>🏁 Terminar ya (sin llegar a la meta)</button>}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {balizas.map((b, i) => (
                        <span key={b.id} style={{
                            width: 34, height: 34, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900,
                            border: `3px solid ${encontradas[b.id] ? '#16a34a' : saltadas.includes(b.id) ? '#94a3b8' : MAGENTA}`,
                            background: encontradas[b.id] ? '#16a34a' : objetivo?.id === b.id ? '#fdf4ff' : 'white',
                            color: encontradas[b.id] ? 'white' : saltadas.includes(b.id) ? '#94a3b8' : MAGENTA,
                        }}>{saltadas.includes(b.id) ? '–' : i + 1}</span>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {!ordenLibre && objetivoBaliza && <button onClick={saltar} style={{ ...btnG, background: '#e2e8f0', color: '#334155', flex: 1 }}>⏭️ Saltar baliza</button>}
                    <button onClick={() => { if (window.confirm('¿Terminar la carrera ahora?')) terminar(); }} style={{ ...btnG, background: '#e2e8f0', color: '#334155', flex: 1 }}>🏁 Terminar</button>
                </div>
            </div>

            {pregunta && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 12000, background: 'rgba(8,12,24,.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                    <div style={{ ...tarjeta, maxWidth: 420, width: '100%' }}>
                        <div style={{ fontSize: '2.4rem' }}>🚩</div>
                        <h3 style={{ margin: '4px 0 10px' }}>¡Baliza {balizas.findIndex(x => x.id === pregunta.b.id) + 1} encontrada! Responde:</h3>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 12 }}>{pregunta.b.pregunta}</div>
                        <input autoFocus value={respuesta} onChange={e => setRespuesta(e.target.value)} onKeyDown={e => e.key === 'Enter' && respuesta.trim() && registrar(pregunta.b, pregunta.via, respuesta.trim())} placeholder="Tu respuesta" style={inp} />
                        <button disabled={!respuesta.trim()} onClick={() => registrar(pregunta.b, pregunta.via, respuesta.trim())} style={{ ...btnG, marginTop: 10, opacity: respuesta.trim() ? 1 : 0.5 }}>Responder y seguir</button>
                    </div>
                </div>
            )}
        </Marco>
    );
}

function EstadoGps({ gps, simulada }) {
    if (simulada) return <div style={{ ...chipGps, background: '#fef3c7', color: '#92400e' }}>🧪 Posición simulada</div>;
    if (gps.error) return <div style={{ ...chipGps, background: '#fee2e2', color: '#991b1b' }}>📍 {gps.error}</div>;
    if (!gps.pos) return <div style={{ ...chipGps, background: '#f1f5f9', color: '#475569' }}>📍 Buscando señal GPS…</div>;
    const p = gps.pos.precision;
    const [bg, c, t] = p <= 8 ? ['#dcfce7', '#166534', 'excelente'] : p <= 20 ? ['#fef9c3', '#854d0e', 'aceptable'] : ['#fee2e2', '#991b1b', 'mala: sal a cielo abierto'];
    return <div style={{ ...chipGps, background: bg, color: c }}>📍 GPS {t} (±{p} m)</div>;
}

function Marco({ children, onExit, titulo, derecha }) {
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, overflowY: 'auto', background: 'linear-gradient(160deg,#fdf4ff,#ecfeff)', fontFamily: "'Segoe UI', system-ui, sans-serif", color: '#0f172a' }}>
            <div style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(6px)', borderBottom: '1px solid #e2e8f0' }}>
                <button onClick={onExit} style={{ border: 'none', background: '#f1f5f9', borderRadius: 10, padding: '7px 12px', fontWeight: 800, cursor: 'pointer' }}>←</button>
                <b style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🚩 {titulo || 'Orientación'}</b>
                {derecha}
            </div>
            <div style={{ padding: '16px 16px 40px' }}>{children}</div>
        </div>
    );
}

const Chip = ({ children }) => <span style={{ background: '#f1f5f9', borderRadius: 99, padding: '5px 11px', fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>{children}</span>;
const Dato = ({ v, l }) => <div style={{ background: '#f8fafc', borderRadius: 12, padding: '10px 6px' }}><div style={{ fontSize: '1.5rem', fontWeight: 900, color: MAGENTA }}>{v}</div><div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700 }}>{l}</div></div>;
const tarjeta = { background: 'white', borderRadius: 18, padding: 20, boxShadow: '0 6px 24px rgba(15,23,42,.08)', textAlign: 'center' };
const inp = { width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 11, border: '2px solid #e2e8f0', fontSize: '1rem', outline: 'none', fontFamily: 'inherit' };
const btnG = { width: '100%', padding: '13px 16px', borderRadius: 13, border: 'none', background: MAGENTA, color: 'white', fontWeight: 800, fontSize: '1rem', cursor: 'pointer' };
const chipGps = { padding: '8px 12px', borderRadius: 10, fontWeight: 700, fontSize: '0.85rem', textAlign: 'center' };
