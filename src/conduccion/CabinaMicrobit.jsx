// Panel de la cabina micro:bit del simulador: grabar las 3 placas (volante, intermitentes, marchas),
// grabar y conectar SU antena y comprobar que se oyen. Es independiente de los mandos de los juegos
// (otra antena, otro programa y otro canal): no cambia nada de los mandos.
import React, { useEffect, useRef, useState } from 'react';
import imgVolante from '../assets/volante.svg';
import { ROLES_CABINA, grabarCabina, escucharCabina, programaCabina, ajustarCabina, programaAntenaCabina, CANAL_CABINA_DEFECTO, ERROR_SIN_MICROPYTHON_CABINA,
    escucharEstadoCabina, conectarAntenaCabina, desconectarAntenaCabina, enviarCabina, soportaSerialCabina } from './cabinaMicrobit.js';

const C = { fondo: '#0f141b', panel: '#18202b', borde: '#2a3542', texto: '#eceff1', suave: '#9fb3c8', amarillo: '#ffd54f', verde: '#69f0ae', rojo: '#ff5252', azul: '#1565c0' };
export const KEY_INVERTIR_CABINA = 'pikt_cabina_invertir';
const leerLS = (k, def) => { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch { return def; } };
const guardarLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } };

const btn = (color = C.azul, extra = {}) => ({ background: color, color: 'white', border: 'none', borderRadius: 10, padding: '9px 14px', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem', ...extra });

// ── Prueba de una placa: vista grande en directo + ajuste ──
const MARCHAS_PRUEBA = ['R', 'N', '1', '2', '3', '4', '5'];
function PruebaPlaca({ rol, invertir, antenaOk, onCerrar }) {
    const r = ROLES_CABINA[rol];
    const [ev, setEv] = useState(null);
    const [ult, setUlt] = useState(0);
    const [inter, setInter] = useState('0');
    const [marcha, setMarcha] = useState('N');
    const [cinturon, setCinturon] = useState(false);
    const [maxPedal, setMaxPedal] = useState(0);
    const [aviso, setAviso] = useState('');
    const [, setTic] = useState(0);
    const marchaRef = useRef('N');
    useEffect(() => { const t = setInterval(() => setTic(x => x + 1), 250); return () => clearInterval(t); }, []);
    useEffect(() => escucharCabina((e) => {
        const quien = e.rol === 'C' ? 'M' : e.rol;
        if (quien !== rol) return;
        setEv(e); setUlt(Date.now());
        if (e.rol === 'I') setInter(x => { const n = x === e.lado ? '0' : e.lado; enviarCabina(`I:XJ,${n}`); return n; });
        if (e.rol === 'M') {
            const i = MARCHAS_PRUEBA.indexOf(marchaRef.current), n = MARCHAS_PRUEBA[Math.max(0, Math.min(MARCHAS_PRUEBA.length - 1, i + (e.cambio === '+' ? 1 : -1)))];
            marchaRef.current = n; setMarcha(n); enviarCabina(`I:XG,${n}`);
        }
        if (e.rol === 'C') setCinturon(c => !c);
        if (r.pedal) setMaxPedal(m => Math.max(m, e.valor));
    }), [rol]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { if (rol === 'M') enviarCabina('I:XG,N'); }, [rol]);
    const vivo = ult && Date.now() - ult < (rol === 'V' || r.pedal ? 1200 : 1e9);
    const ajustar = (paso, texto) => { ajustarCabina(rol, paso); setAviso(texto); setTimeout(() => setAviso(''), 3500); if (paso === 0) setMaxPedal(0); };
    const parpadeo = Math.floor(Date.now() / 400) % 2 === 0;
    const caja = { background: '#0b1016', borderRadius: 18, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 };
    const giro = ev?.rol === 'V' ? (invertir ? -1 : 1) * ev.giro : 0;
    const valor = r.pedal ? (ev?.valor || 0) : 0;
    const colorPedal = rol === 'A' ? '#43a047' : rol === 'F' ? '#e53935' : '#1e88e5';
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(5,8,12,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ width: '100%', maxWidth: 560, background: C.panel, border: `1px solid ${C.borde}`, borderRadius: 20, padding: 20, color: C.texto }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ margin: 0 }}>▶ Prueba: {r.emoji} {r.nombre}</h3>
                    <button style={btn('rgba(255,255,255,0.1)')} onClick={onCerrar}>✕ Cerrar</button>
                </div>
                {!antenaOk && <div style={{ background: '#4a3a12', borderRadius: 10, padding: 10, marginBottom: 10, fontSize: '0.88rem' }}>📡 Conecta la antena (arriba) para recibir la placa.</div>}
                <div style={{ fontSize: '0.85rem', color: vivo ? C.verde : C.suave, marginBottom: 10 }}>{vivo ? '● Recibiendo la placa' : ult ? '○ La placa ha dejado de enviar (¿pilas, canal, alcance?)' : '○ Esperando a la placa… enciéndela'}</div>

                {rol === 'V' && (
                    <div style={caja}>
                        <img src={imgVolante} alt='' style={{ width: 150, height: 150, transform: `rotate(${giro * 120}deg)`, transition: 'transform 0.1s' }} />
                        <div style={{ fontWeight: 900, fontSize: '1.3rem' }}>{giro === 0 ? 'Recto' : giro < 0 ? `⬅ Izquierda ${Math.round(-giro * 100)} %` : `Derecha ${Math.round(giro * 100)} % ➡`}</div>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <div style={{ padding: '10px 18px', borderRadius: 12, fontWeight: 800, background: ev?.acel ? '#2e7d32' : '#263238' }}>A · Acelerar</div>
                            <div style={{ padding: '10px 18px', borderRadius: 12, fontWeight: 800, background: ev?.freno ? '#c62828' : '#263238' }}>B · Frenar</div>
                        </div>
                        <div style={{ color: C.suave, fontSize: '0.84rem', textAlign: 'center' }}>Con la placa en horizontal (pantalla arriba), inclínala a la izquierda y a la derecha: el volante de la pantalla debe girar igual. Si va al revés, marca «Invertir el giro».</div>
                        <button style={btn('#00897b')} onClick={() => ajustar(0, 'Hecho: esa posición es ahora «recto».')}>🎯 Está recto: centrar</button>
                    </div>
                )}

                {r.pedal && (
                    <div style={caja}>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18 }}>
                            <div style={{ width: 90, height: 220, background: '#1d2733', borderRadius: 14, position: 'relative', overflow: 'hidden', border: '2px solid #37474f' }}>
                                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${valor * 100}%`, background: colorPedal, transition: 'height 0.08s' }} />
                                <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${maxPedal * 100}%`, borderTop: '2px dashed rgba(255,255,255,0.6)' }} title="Máximo alcanzado" />
                                {rol === 'E' && <><div style={{ position: 'absolute', left: 0, right: 0, bottom: '25%', height: '50%', background: 'rgba(255,213,79,0.12)', borderTop: '1px solid rgba(255,213,79,0.5)', borderBottom: '1px solid rgba(255,213,79,0.5)' }} /><div style={{ position: 'absolute', right: 4, bottom: 'calc(50% - 8px)', fontSize: '0.65rem', color: C.amarillo }}>mordida</div></>}
                            </div>
                            <div style={{ fontSize: '3rem', fontWeight: 900, minWidth: 120 }}>{Math.round(valor * 100)} %</div>
                        </div>
                        <div style={{ color: C.suave, fontSize: '0.86rem', lineHeight: 1.5, textAlign: 'center' }}>
                            Pisa el pedal poco a poco: la barra debe subir de 0 a 100 %. La línea discontinua marca hasta dónde has llegado.
                            {rol === 'E' && <><br />La franja amarilla es la <b style={{ color: C.amarillo }}>mordida</b> (25-75 %): ahí el coche empieza a moverse.</>}
                        </div>
                        <div style={{ fontWeight: 700, alignSelf: 'stretch' }}>Ajustar el pedal</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignSelf: 'stretch' }}>
                            <button style={btn('#455a64')} onClick={() => ajustar(0, 'Hecho: esa posición es ahora el pedal suelto (0 %).')}>1 · Suelto el pedal: 0 %</button>
                            <button style={btn(colorPedal)} onClick={() => ajustar(1, 'Hecho: esa posición es ahora el pedal a fondo (100 %). Se queda guardado en la placa.')}>2 · Lo piso a fondo: 100 %</button>
                        </div>
                    </div>
                )}

                {rol === 'I' && (
                    <div style={caja}>
                        <div style={{ display: 'flex', gap: 40, fontSize: '5rem', fontWeight: 900 }}>
                            <span style={{ color: inter === 'L' && parpadeo ? '#00e676' : '#263238' }}>⬅</span>
                            <span style={{ color: inter === 'R' && parpadeo ? '#00e676' : '#263238' }}>➡</span>
                        </div>
                        <div style={{ fontWeight: 800 }}>{inter === 'L' ? 'Intermitente izquierdo' : inter === 'R' ? 'Intermitente derecho' : 'Apagados'}</div>
                        <div style={{ color: C.suave, fontSize: '0.86rem', textAlign: 'center' }}>Pulsa A (izquierdo) y B (derecho). Otra pulsación lo apaga. La placa también debe mostrar la flecha.</div>
                    </div>
                )}

                {rol === 'M' && (
                    <div style={caja}>
                        <div style={{ display: 'flex', gap: 6 }}>
                            {MARCHAS_PRUEBA.map(g => <div key={g} style={{ width: 46, height: 56, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', fontWeight: 900, background: g === marcha ? (g === 'R' ? '#ef6c00' : '#1565c0') : '#263238', color: g === marcha ? 'white' : '#607d8b' }}>{g}</div>)}
                        </div>
                        <div style={{ color: C.suave, fontSize: '0.86rem', textAlign: 'center' }}>A baja de marcha y B sube: la marcha también debe salir en la pantalla de la placa.</div>
                        <div style={{ fontWeight: 700, color: cinturon ? C.verde : C.suave }}>{cinturon ? '🔒 Cinturón (logo)' : '🔓 Toca el logo (V2) para el cinturón'}</div>
                    </div>
                )}
                {aviso && <div style={{ marginTop: 12, background: '#1b3a2a', borderRadius: 10, padding: 10 }}>✅ {aviso}</div>}
                {(rol === 'V' || r.pedal) && !antenaOk && <div style={{ color: C.suave, fontSize: '0.8rem', marginTop: 8 }}>Los botones de ajuste necesitan la antena conectada. Sin antena, en la placa: {rol === 'V' ? 'toca el logo para centrar.' : 'A = suelto · B = a fondo.'}</div>}
            </div>
        </div>
    );
}

export default function CabinaMicrobit({ onVolver, onConducir }) {
    const [antena, setAntena] = useState({ conectada: false, antenaOk: false, canal: null });
    const [grupo, setGrupo] = useState(() => leerLS('pikt_cabina_canal', CANAL_CABINA_DEFECTO));
    const [ocupado, setOcupado] = useState(null); // texto de lo que se está haciendo
    const [mensaje, setMensaje] = useState(null); // { ok, texto }
    const [sinMicropython, setSinMicropython] = useState(false);
    const [invertir, setInvertir] = useState(() => leerLS(KEY_INVERTIR_CABINA, false));
    const [vivo, setVivo] = useState({}); // último evento de cada placa
    const [verCodigo, setVerCodigo] = useState(null);
    const [probando, setProbando] = useState(null);
    const tiempos = useRef({});
    const [, setTic] = useState(0);

    useEffect(() => escucharEstadoCabina((e) => { setAntena(e); if (e.canal != null) setGrupo(e.canal); }), []);
    useEffect(() => escucharCabina((ev) => {
        const rol = ev.rol === 'C' ? 'M' : ev.rol;
        tiempos.current[rol] = Date.now();
        setVivo(v => ({ ...v, [rol]: ev }));
    }), []);
    useEffect(() => { const t = setInterval(() => setTic(x => x + 1), 500); return () => clearInterval(t); }, []);

    const seOye = (rol) => tiempos.current[rol] && Date.now() - tiempos.current[rol] < (rol === 'V' || ROLES_CABINA[rol]?.pedal ? 1500 : 60000);

    const hacer = async (texto, fn) => {
        if (ocupado) return;
        setOcupado(texto); setMensaje(null);
        try { const r = await fn(); if (r) setMensaje({ ok: true, texto: r }); }
        catch (e) {
            if (e?.code === ERROR_SIN_MICROPYTHON_CABINA) setSinMicropython(true);
            setMensaje({ ok: false, texto: e?.message || String(e) });
        } finally { setOcupado(null); }
    };
    const grabarAntena = () => hacer('Grabando la antena…', async () => {
        guardarLS('pikt_cabina_canal', Number(grupo));
        const ok = await conectarAntenaCabina({ grabar: true, canal: Number(grupo) });
        return ok ? '📡 Antena grabada y conectada. Déjala enchufada al ordenador.' : 'Grabada, pero no contesta: desenchúfala, vuelve a enchufarla y pulsa «conectar» arriba.';
    });
    const grabar = (rol) => hacer(`Grabando ${ROLES_CABINA[rol].nombre.toLowerCase()}…`, async () => {
        const g = antena.canal ?? Number(grupo);
        await grabarCabina(rol, g);
        return `${ROLES_CABINA[rol].emoji} ${ROLES_CABINA[rol].nombre} grabada (canal ${g}). Desenchúfala, ponle las pilas y pruébala.`;
    });
    const conectar = () => hacer('Conectando la antena…', async () => {
        const ok = await conectarAntenaCabina({ grabar: false });
        if (!ok) { await desconectarAntenaCabina(); throw new Error('Esa placa no contesta como antena de la cabina. Grábala con «📡 Grabar y conectar antena».'); }
        return null;
    });
    const instalarMP = () => hacer('Instalando MicroPython…', async () => {
        if (antena.conectada) await desconectarAntenaCabina();
        const { flashearMicropython } = await import('../mandos/mandosMicrobit.js'); // solo el instalador de MicroPython
        await flashearMicropython((pct) => setOcupado(`Instalando MicroPython… ${Math.round(pct)} %`));
        setSinMicropython(false);
        return 'MicroPython instalado. Ahora vuelve a grabar la placa.';
    });

    const v = vivo.V;
    return (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '14px 16px 40px', color: C.texto }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={onVolver} style={btn('rgba(255,255,255,0.08)')}>← Volver</button>
                {antena.antenaOk
                    ? <span style={{ background: '#1b3a2a', color: C.verde, borderRadius: 20, padding: '6px 12px', fontWeight: 700, fontSize: '0.85rem' }}>📡 Antena de la cabina lista · canal {antena.canal} <button onClick={() => desconectarAntenaCabina()} style={{ marginLeft: 6, background: 'none', border: 'none', color: C.suave, cursor: 'pointer' }} title="Desconectar">✕</button></span>
                    : <button style={btn('#ef6c00')} disabled={!!ocupado || !soportaSerialCabina()} onClick={conectar}>🔌 Conectar antena de la cabina</button>}
            </div>
            <h2 style={{ color: C.amarillo, margin: '16px 0 4px' }}>🎮 Cabina con micro:bit</h2>
            <p style={{ color: C.suave, marginTop: 0, lineHeight: 1.55 }}>
                Conduce el simulador con <b style={{ color: C.texto }}>micro:bit</b>: una hace de volante (con A acelerar y B frenar), otra de intermitentes, otra de palanca de cambios y otra es la <b style={{ color: C.texto }}>antena</b> enchufada al ordenador. Si quieres, añade <b style={{ color: C.texto }}>3 pedales</b> (acelerador, freno y embrague), cada uno con su micro:bit: cuanto más se pisa, más se inclina la placa.
                Todo esto es <b style={{ color: C.texto }}>independiente de los mandos de los juegos</b>: la cabina tiene su propia antena, su programa y su canal de radio (por defecto el {CANAL_CABINA_DEFECTO}), así que no se mezcla con ellos. Usa placas distintas o, si grabas aquí una placa que era un mando, vuelve a grabarla como mando desde Programación y robótica cuando la necesites.
            </p>
            {!soportaSerialCabina() && <div style={{ background: '#4a1f1f', borderRadius: 12, padding: 12, marginBottom: 12 }}>⚠️ Para grabar y conectar las placas hace falta <b>Chrome o Edge en un ordenador</b>.</div>}

            {/* Paso 1: antena */}
            <div style={{ background: C.panel, border: `1px solid ${C.borde}`, borderRadius: 14, padding: 14, marginBottom: 12 }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>1 · 📡 Antena</div>
                <div style={{ color: C.suave, fontSize: '0.88rem', lineHeight: 1.5, marginBottom: 10 }}>
                    Una micro:bit enchufada por USB al ordenador, con el programa de antena de la cabina. La primera vez, enchúfala y pulsa «Grabar y conectar antena». Las siguientes veces basta con «🔌 Conectar antena de la cabina» (arriba).
                    {antena.antenaOk && <> Está en el <b style={{ color: C.verde }}>canal {antena.canal}</b>: las placas se grabarán en ese canal.</>}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ color: C.suave, fontSize: '0.85rem' }}>Canal de radio <input type="number" min={0} max={255} value={grupo} onChange={e => setGrupo(e.target.value)} disabled={antena.antenaOk}
                        style={{ width: 70, padding: 6, borderRadius: 8, border: `1px solid ${C.borde}`, background: '#0b1016', color: 'white' }} /></label>
                    <button style={btn('#00897b')} disabled={!!ocupado || !soportaSerialCabina()} onClick={grabarAntena}>📡 Grabar y conectar antena</button>
                    <button style={btn('rgba(255,255,255,0.08)')} title="Ver el código MicroPython de la antena" onClick={() => setVerCodigo(verCodigo === 'ANTENA' ? null : 'ANTENA')}>{'</>'}</button>
                </div>
            </div>

            {/* Paso 2: placas */}
            <div style={{ fontWeight: 800, margin: '16px 0 8px' }}>2 · Graba cada placa (conéctala por USB, una cada vez)</div>
            {[['Placas de mano', ([, r]) => !r.pedal], ['🦶 Pedales (opcionales)', ([, r]) => r.pedal]].map(([titulo, filtro]) => (<React.Fragment key={titulo}>
            <div style={{ color: C.suave, fontWeight: 700, fontSize: '0.88rem', margin: '10px 0 6px' }}>{titulo}</div>
            {titulo.includes('Pedales') && <div style={{ color: C.suave, fontSize: '0.84rem', lineHeight: 1.5, marginBottom: 8 }}>Pega cada micro:bit (con su portapilas) a una tabla con bisagra o a un pedal de madera, de modo que <b style={{ color: C.texto }}>se incline al pisarlo</b>. Da igual en qué posición la pegues: al encenderla toma el pedal suelto como «reposo»; luego pisa a fondo y pulsa <b style={{ color: C.texto }}>B</b> para guardar el recorrido. La pantalla de la placa muestra cuánto está pisado. Con pedales, el volante ya no necesita A y B (siguen funcionando).</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
                {Object.entries(ROLES_CABINA).filter(filtro).map(([rol, r]) => (
                    <div key={rol} style={{ background: C.panel, border: `2px solid ${seOye(rol) ? C.verde : C.borde}`, borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <b style={{ fontSize: '1.05rem' }}>{r.emoji} {r.nombre}</b>
                            <span style={{ fontSize: '0.78rem', color: seOye(rol) ? C.verde : C.suave }}>{seOye(rol) ? '● se oye' : '○ sin señal'}</span>
                        </div>
                        <div style={{ color: C.suave, fontSize: '0.84rem', lineHeight: 1.45, flex: 1 }}>{r.ayuda}</div>
                        {rol === 'V' && (
                            <div>
                                <div style={{ height: 14, background: '#0b1016', borderRadius: 7, position: 'relative', overflow: 'hidden' }}>
                                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 2, background: '#455a64' }} />
                                    {v && <div style={{ position: 'absolute', top: 2, bottom: 2, width: 10, borderRadius: 5, background: C.amarillo, left: `calc(${50 + (invertir ? -1 : 1) * v.giro * 48}% - 5px)` }} />}
                                </div>
                                <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: '0.8rem' }}>
                                    <span style={{ color: v?.acel ? C.verde : C.suave }}>A acelerar</span>
                                    <span style={{ color: v?.freno ? C.rojo : C.suave }}>B frenar</span>
                                </div>
                                <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.8rem', color: C.suave, marginTop: 6 }}>
                                    <input type="checkbox" checked={invertir} onChange={e => { setInvertir(e.target.checked); guardarLS(KEY_INVERTIR_CABINA, e.target.checked); }} /> Invertir el giro (si gira al revés)
                                </label>
                            </div>
                        )}
                        {r.pedal && (
                            <div style={{ height: 14, background: '#0b1016', borderRadius: 7, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${(vivo[rol]?.valor || 0) * 100}%`, background: rol === 'A' ? '#43a047' : rol === 'F' ? '#e53935' : '#1e88e5', transition: 'width 0.1s' }} />
                            </div>
                        )}
                        {rol === 'I' && <div style={{ fontSize: '0.85rem' }}>Última pulsación: <b>{vivo.I ? (vivo.I.lado === 'L' ? '⬅ izquierdo' : 'derecho ➡') : '—'}</b></div>}
                        {rol === 'M' && <div style={{ fontSize: '0.85rem' }}>Última pulsación: <b>{vivo.M ? (vivo.M.rol === 'C' ? '🔒 cinturón' : vivo.M.cambio === '+' ? '▲ subir' : '▼ bajar') : '—'}</b></div>}
                        <div style={{ display: 'flex', gap: 6 }}>
                            <button style={btn('#2e7d32', { flex: 1, whiteSpace: 'nowrap' })} onClick={() => setProbando(rol)}>▶ Probar</button>
                            <button style={btn('#6a1b9a', { flex: 1, whiteSpace: 'nowrap' })} disabled={!!ocupado} onClick={() => grabar(rol)}>⬇️ Grabar</button>
                            <button style={btn('rgba(255,255,255,0.08)')} title="Ver el código MicroPython" onClick={() => setVerCodigo(verCodigo === rol ? null : rol)}>{'</>'}</button>
                        </div>
                    </div>
                ))}
            </div>
            </React.Fragment>))}
            {probando && <PruebaPlaca rol={probando} invertir={invertir} antenaOk={antena.antenaOk} onCerrar={() => setProbando(null)} />}
            {verCodigo && (
                <div style={{ marginTop: 12 }}>
                    <div style={{ color: C.suave, fontSize: '0.82rem', marginBottom: 6 }}>También puedes copiarlo en python.microbit.org y pulsar «Send to micro:bit».</div>
                    <textarea readOnly value={verCodigo === 'ANTENA' ? programaAntenaCabina(antena.canal ?? Number(grupo)) : programaCabina(verCodigo, antena.canal ?? Number(grupo))} style={{ width: '100%', height: 240, background: '#0b1016', color: '#cfd8dc', border: `1px solid ${C.borde}`, borderRadius: 10, fontFamily: 'monospace', fontSize: '0.78rem', padding: 10, boxSizing: 'border-box' }} />
                </div>
            )}

            {ocupado && <div style={{ marginTop: 12, background: '#1c2a3a', borderRadius: 10, padding: 10 }}>⏳ {ocupado}</div>}
            {mensaje && <div style={{ marginTop: 12, background: mensaje.ok ? '#1b3a2a' : '#4a1f1f', borderRadius: 10, padding: 10, lineHeight: 1.45 }}>{mensaje.texto}</div>}
            {sinMicropython && <button style={btn('#ef6c00', { marginTop: 8 })} disabled={!!ocupado} onClick={instalarMP}>⚡ Instalar MicroPython en esa placa</button>}

            {/* Paso 3 */}
            <div style={{ background: C.panel, border: `1px solid ${C.borde}`, borderRadius: 14, padding: 14, marginTop: 16, lineHeight: 1.55 }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>3 · ¡A conducir!</div>
                <div style={{ color: C.suave, fontSize: '0.88rem' }}>
                    Con la antena conectada, entra en <b style={{ color: C.texto }}>Conducción libre</b> o en el <b style={{ color: C.texto }}>Examen práctico</b>: las placas funcionan solas (y el teclado sigue funcionando). Para practicar las marchas elige <b style={{ color: C.texto }}>⚙️ Cambio manual</b>: 1.ª para salir, sube con B y reduce con A antes de pararte o el motor se calará. Con el <b style={{ color: C.texto }}>pedal de embrague</b>, el simulador pasa solo a embrague de verdad: písalo a fondo para cambiar y suéltalo poco a poco al salir. Si el volante deja de enviar (pilas, alcance), el coche suelta acelerador y freno.
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    <button style={btn('#2e7d32')} onClick={() => onConducir('libre')}>🚗 Conducción libre</button>
                    <button style={btn('#fb8c00')} onClick={() => onConducir('examen')}>🎓 Examen práctico</button>
                </div>
            </div>
        </div>
    );
}
