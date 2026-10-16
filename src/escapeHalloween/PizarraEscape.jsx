import React, { useState, useEffect, useRef, useMemo } from 'react';
import { infoPrueba, compruebaCandado, normalizar } from './bancoEscape';
import { LETRAS, candadoParaPapel } from './partidaFija';
import { DISFRACES, ACCESORIOS } from './avatares3d';
import Mansion3D, { AvatarPreview3D } from './Mansion3D';
import { descargarPdfEscape } from './FichasEscape';
import { crearAudio, Ambiente, Confeti, Zombi, Corazones, BarraVidaZombi, MapaMansion, mmss, useNarrador, idNarracionFase, Subtitulo } from './comunes';
import {
    MODOS, setModoMandos, escucharMandos, escucharEstadoAntena, conectarAntena, feedbackMando, nuevaPreguntaMandos, simularPulsacion,
} from '../mandos/mandosMicrobit.js';

/**
 *  MODO PIZARRA (sin móviles): el profe proyecta y los alumnos anotan en sus fichas de papel.
 *  Usa la partida fija (config.partida) → las preguntas y candados son los mismos que en el cuadernillo y la hoja de respuestas.
 *  Flujo: INTRO → por sala RETOS (pregunta a pregunta, «Mostrar respuesta») → CANDADO (el profe escribe el código que dice la clase)
 *         → ABIERTA → BATALLA (el profe marca si la clase acierta: golpe; o falla: mordisco) → VICTORIA / DERROTA.
 *
 *  Modo MANDOS (config.modo === 'MANDOS', ../mandos): cada alumno responde A-D con su micro:bit. Los avatares son los mandos que se
 *  unen (pulsando B). Se corrige cuando han respondido todos o el profe pulsa «Corregir»: en las salas, si
 *  acierta menos de la mitad se pierde tiempo; en la batalla, si acierta al menos la mitad hay golpe.
 *  En el CANDADO cada mando escribe su propio intento carácter a carácter (modo número si el código es numérico,
 *  modo abecedario si no; A+B envía cada carácter). Cada carácter se comprueba al llegar: si no encaja con el
 *  principio de ninguna solución, el intento de ese mando se borra (carita triste y ESPERA_MANDO ms sin poder
 *  probar). Quien completa el código abre la puerta y su avatar se destaca (crece en la mansión + tarjeta).
 *  Los nombres de los mandos se pueden cambiar en el vestíbulo (se guardan en pikt_mandos_nombres).
 */

const PENAL = 15;          // segundos que resta un código incorrecto
const PENAL_PREGUNTA = 10; // segundos que resta pulsar una respuesta incorrecta
const LS_NOMBRES_MANDOS = 'pikt_mandos_nombres';
const ESPERA_MANDO = 3000; // tras un carácter incorrecto, ese mando espera antes de volver a probar

const leerNombresMandos = () => { try { return JSON.parse(localStorage.getItem(LS_NOMBRES_MANDOS) || '{}') || {}; } catch { return {}; } };
const guardarNombreMando = (id, nombre) => {
    try {
        const n = leerNombresMandos();
        if (nombre.trim()) n[id] = nombre.trim(); else delete n[id];
        localStorage.setItem(LS_NOMBRES_MANDOS, JSON.stringify(n));
    } catch { /* sin almacenamiento */ }
};
const nombreMando = (id, nombres) => nombres[id] || (id > 900 ? `Virtual ${id - 900}` : `Mando ${id}`);
const jugadorMando = (id, nombres) => ({
    nombre: nombreMando(id, nombres), mando: id, aciertos: 0, puntos: 0,
    avatar: { disfraz: DISFRACES[(id * 5 + 3) % DISFRACES.length].id, color: null, accesorio: ACCESORIOS[1 + (id % (ACCESORIOS.length - 1))].id },
});

function claseFicticia(n = 7) {
    const j = {};
    for (let i = 0; i < n; i++) {
        j[`c${i}`] = {
            nombre: '', sinEtiqueta: true, aciertos: 0,
            avatar: { disfraz: DISFRACES[(i * 5 + 3) % DISFRACES.length].id, color: null, accesorio: ACCESORIOS[1 + (i % (ACCESORIOS.length - 1))].id },
        };
    }
    return j;
}

function PreguntaGrande({ q, etiqueta, revelada, falladas = [], onElegir, conteo }) {
    if (!q) return null;
    return (
        <div className="eh-aparece" key={etiqueta}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                <div style={{ padding: '6px 14px', borderRadius: 20, background: '#5b21b6', fontWeight: 900, fontSize: '1.3rem' }}>{etiqueta}</div>
                <div style={{ fontWeight: 800, fontSize: 'clamp(1.2rem,2.2vw,1.9rem)', lineHeight: 1.25 }}>{q.texto}</div>
            </div>
            {q.detalle && <div style={{ textAlign: 'center', margin: '8px 0 14px', padding: '12px 16px', borderRadius: 14, background: 'rgba(0,0,0,.35)', fontSize: q.grande ? 'clamp(2rem,4.5vw,3.6rem)' : 'clamp(1.1rem,2vw,1.6rem)', fontWeight: q.grande ? 900 : 600 }}>{q.detalle}</div>}
            {q.frase && <div style={{ textAlign: 'center', margin: '8px 0 14px', padding: '12px 16px', borderRadius: 14, background: 'rgba(0,0,0,.35)', fontSize: 'clamp(1.2rem,2.2vw,1.8rem)', lineHeight: 1.6 }}>{q.frase.tokens.map((t, i) => <span key={i} style={i === q.frase.resaltar ? { background: '#ff8c1a', color: '#1a0700', borderRadius: 6, padding: '0 6px', fontWeight: 900 } : null}>{t} </span>)}</div>}
            {q.img && <div style={{ textAlign: 'center', margin: '6px 0 12px' }}><img src={q.img} alt="" style={{ maxHeight: '22vh', maxWidth: '100%', borderRadius: 12, background: '#fff', border: '3px solid rgba(255,255,255,.3)' }} /></div>}
            <div style={{ display: 'grid', gridTemplateColumns: q.opciones.every(o => String(o).length < 22) ? '1fr 1fr' : '1fr', gap: 12 }}>
                {q.opciones.map((o, i) => {
                    const ok = revelada && i === q.correcta;
                    const mal = falladas.includes(i);
                    const activa = !!onElegir && !revelada && !mal;
                    return (
                        <button key={i} disabled={!activa} onClick={() => activa && onElegir(i)} title={activa ? 'Elegir esta respuesta' : undefined} style={{
                            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 16, fontWeight: 800, fontSize: 'clamp(1.1rem,2vw,1.7rem)',
                            fontFamily: 'inherit', color: '#fff', textAlign: 'left', cursor: activa ? 'pointer' : 'default',
                            background: ok ? '#15803d' : mal ? '#7f1d1d' : revelada ? 'rgba(70,30,110,.35)' : 'rgba(70,30,110,.75)',
                            border: `3px solid ${ok ? '#4ade80' : mal ? '#f87171' : 'rgba(255,255,255,.18)'}`,
                            opacity: (revelada && !ok) || mal ? 0.6 : 1, transition: 'background .3s, opacity .3s',
                        }}>
                            <span style={{ width: 44, height: 44, borderRadius: '50%', background: ok ? '#4ade80' : mal ? '#f87171' : '#ff8c1a', color: '#1a0700', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, flexShrink: 0 }}>{mal ? '✘' : LETRAS[i]}</span>
                            <span style={{ flex: 1 }}>{o}</span>
                            {revelada && conteo && <span title="Mandos que eligieron esta respuesta" style={{ padding: '2px 12px', borderRadius: 99, background: 'rgba(0,0,0,.35)', fontSize: '1.1rem' }}>🎮 {conteo[i] || 0}</span>}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export default function PizarraEscape({ config, titulo = '', onSalir }) {
    const partida = config.partida;
    const pruebas = config.pruebas;
    const audioRef = useRef(null);
    if (!audioRef.current) audioRef.current = crearAudio();
    const audio = audioRef.current;
    const [sonido, setSonido] = useState(true);
    useEffect(() => { audio.silencio(!sonido); }, [sonido, audio]);
    useEffect(() => () => audio.cerrar(), [audio]);
    // Música de fondo (solo en la pantalla proyectada): suena con el botón 🔊. El navegador exige un clic antes de sonar.
    useEffect(() => {
        const f = () => audio.desbloquear();
        window.addEventListener('pointerdown', f);
        return () => window.removeEventListener('pointerdown', f);
    }, [audio]);

    const [fase, setFase] = useState('LOBBY');
    const [salaIdx, setSalaIdx] = useState(0);
    const [qIdx, setQIdx] = useState(0);
    const [revelada, setRevelada] = useState(false);
    const [amuletos, setAmuletos] = useState([]);
    const [tiempoFin, setTiempoFin] = useState(null);
    const [penal, setPenal] = useState(0);
    const [pausa, setPausa] = useState(null);           // ms en que se pausó el reloj
    const [codigoTxt, setCodigoTxt] = useState('');
    const [msg, setMsg] = useState('');
    const [batalla, setBatalla] = useState(null);
    const mandos = config.modo === 'MANDOS';
    const [jugadores, setJugadores] = useState(() => (mandos ? {} : claseFicticia()));
    const [flash, setFlash] = useState(null);
    const [zEstado, setZEstado] = useState('idle');
    const [ahora, setAhora] = useState(Date.now());
    const [descargando, setDescargando] = useState('');
    const [falladas, setFalladas] = useState([]);
    const [aviso, setAviso] = useState('');
    const resolviendo = useRef(false);
    const [usar3D, setUsar3D] = useState(() => { try { return localStorage.getItem('pikt_escape_3d') !== '0'; } catch { return true; } });
    const cambiar3D = () => setUsar3D(v => { try { localStorage.setItem('pikt_escape_3d', v ? '0' : '1'); } catch { /* */ } return !v; });
    const transicion = useRef(false);

    // ── Mandos micro:bit ──
    const [antena, setAntena] = useState({ antenaOk: false });
    const [respM, setRespM] = useState({});          // id de mando → letra (primera respuesta de la pregunta actual)
    const [verVirtuales, setVerVirtuales] = useState(false);
    const [msgAntena, setMsgAntena] = useState('');
    const mandosRef = useRef(false);
    mandosRef.current = mandos;
    const aceptaRef = useRef(false);
    const faseRef = useRef(fase);
    faseRef.current = fase;
    useEffect(() => escucharEstadoAntena(setAntena), []);
    const [intentos, setIntentos] = useState({});   // candado: id de mando → caracteres enviados
    const intentosRef = useRef({});
    const esperaM = useRef({});                       // id de mando → hasta cuándo no puede probar
    const manejarCandadoRef = useRef(null);
    const [abridor, setAbridor] = useState(null);     // { clave, nombre, avatar } del mando que ha abierto el candado
    const quitarDestacado = () => {
        setAbridor(null);
        setJugadores(j => (Object.values(j).some(x => x.destacado) ? Object.fromEntries(Object.entries(j).map(([k, v]) => [k, { ...v, destacado: false }])) : j));
    };
    const renombrar = (clave, txt) => {
        setJugadores(j => (j[clave] ? { ...j, [clave]: { ...j[clave], nombre: txt } } : j));
        const id = Number(clave.slice(1));
        guardarNombreMando(id, txt);
    };
    useEffect(() => () => setModoMandos(MODOS.LETRAS), []);
    const conectar = async () => {
        setMsgAntena('Elige la micro:bit antena…');
        try {
            const ok = await conectarAntena({ grabar: false });
            setMsgAntena(ok ? '' : '⚠️ Esa placa no responde como antena. Grábala en Programación y robótica → Mandos micro:bit.');
        } catch (e) { setMsgAntena('❌ ' + (e?.message || e)); }
    };
    useEffect(() => escucharMandos((ev) => {
        const { id, tipo, letra } = ev;
        if (!mandosRef.current) return;
        if (tipo === 'numero' || tipo === 'texto') { manejarCandadoRef.current?.(ev); return; }
        if (tipo !== 'letra') return;
        const f = faseRef.current;
        if (!['LOBBY', 'INTRO', 'RETOS', 'BATALLA'].includes(f) && !aceptaRef.current) return;
        const clave = `m${id}`;
        setJugadores(j => (j[clave] ? j : { ...j, [clave]: jugadorMando(id, leerNombresMandos()) }));
        if (aceptaRef.current) setRespM(r => (r[id] ? r : { ...r, [id]: letra }));
    }), []);

    useEffect(() => { const id = setInterval(() => setAhora(Date.now()), 1000); return () => clearInterval(id); }, []);

    useEffect(() => {
        audio.musica(sonido && fase !== 'VICTORIA', fase === 'BATALLA' ? 'batalla' : 'suspense');
    }, [sonido, fase, audio]);

    // Narrador
    const narrador = useNarrador(audio, sonido);
    useEffect(() => {
        const id = idNarracionFase(fase, salaIdx, pruebas.length, batalla?.agotado);
        if (id) narrador.decir(id, fase === 'VICTORIA' ? 1600 : fase === 'INTRO' ? 900 : 350);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fase, salaIdx]);
    const finalDicho = useRef(false);
    useEffect(() => {
        if (fase !== 'BATALLA' || !batalla) { finalDicho.current = false; return; }
        const vida = batalla.hpMax - batalla.golpes;
        if (!finalDicho.current && vida > 0 && vida <= Math.max(1, Math.ceil(batalla.hpMax * 0.15))) { finalDicho.current = true; narrador.decir('golpe_final'); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [batalla?.golpes, fase]);

    const infos = useMemo(() => pruebas.map((p, i) => infoPrueba(p, i, pruebas)), [pruebas]);
    const info = infos[salaIdx] || infos[0];
    const pp = partida.pruebas[salaIdx];
    const cand = candadoParaPapel(pp?.candado);
    const enSalas = ['RETOS', 'CANDADO', 'ABIERTA'].includes(fase);
    const enPelea = ['BATALLA', 'VICTORIA', 'DERROTA'].includes(fase);
    const restante = tiempoFin ? tiempoFin - penal * 1000 - (pausa ?? ahora) : config.minutos * 60000;
    const abiertas = pruebas.map((p, i) => (amuletos.includes(p.id) ? i : -1)).filter(i => i >= 0);
    const saltan = () => setJugadores(j => Object.fromEntries(Object.entries(j).map(([k, v]) => [k, { ...v, aciertos: (v.aciertos || 0) + 1 }])));

    const irASala = (i) => {
        quitarDestacado();
        setSalaIdx(i); setQIdx(0); setRevelada(false); setCodigoTxt(''); setMsg('');
        if (!tiempoFin) setTiempoFin(Date.now() + config.minutos * 60000);
        if (!partida.pruebas[i]?.preguntas.length) { setFase('CANDADO'); audio.campana(); } else setFase('RETOS');
    };

    const empezarBatalla = (agotado = false) => {
        const base = Math.max(3, Math.round(partida.batalla.length * 0.6));
        const vidas = 3 + amuletos.length;
        quitarDestacado();
        setBatalla({ hpMax: Math.round(base * (agotado ? 1.5 : 1)), golpes: 0, vidas, vidasMax: vidas, q: 0, agotado, ataqueN: 0, bloqueado: false });
        setRevelada(false); setFase('BATALLA'); audio.rugido();
    };

    const siguienteSala = () => { if (salaIdx >= pruebas.length - 1) empezarBatalla(false); else irASala(salaIdx + 1); };

    // Tiempo agotado → el zombi despierta antes
    useEffect(() => {
        if (enSalas && tiempoFin && restante <= 0 && !transicion.current && pausa == null) { transicion.current = true; empezarBatalla(true); }
        if (!enSalas) transicion.current = false;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ahora, enSalas]);

    const abrirPuerta = (quien = '') => {
        setAmuletos(a => (a.includes(pruebas[salaIdx].id) ? a : [...a, pruebas[salaIdx].id]));
        setMsg(quien); setFase('ABIERTA'); audio.puerta(); saltan();
    };
    // ── Candado con mandos: cada mando escribe su intento carácter a carácter ──
    const largoCandado = cand ? (cand.longitud || Math.max(1, ...(cand.soluciones || []).map(x => normalizar(x).length))) : 0;
    const candNumerico = cand?.tipo === 'numero';
    useEffect(() => {
        if (!mandos) return;
        intentosRef.current = {}; esperaM.current = {}; setIntentos({});
        setModoMandos(fase === 'CANDADO' ? (candNumerico ? MODOS.NUMERO : MODOS.TEXTO) : MODOS.LETRAS);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mandos, fase, salaIdx]);
    manejarCandadoRef.current = ({ id, tipo, numero, caracter }) => {
        if (fase !== 'CANDADO' || !cand) return;
        if ((esperaM.current[id] || 0) > Date.now()) { if (id < 900) feedbackMando(id, false); return; }
        const trozo = tipo === 'numero' ? (numero >= 0 ? String(numero) : '') : String(caracter || '').toLowerCase();
        if (!trozo) return;
        const clave = `m${id}`;
        const nombre = jugadores[clave]?.nombre || nombreMando(id, leerNombresMandos());
        if (!jugadores[clave]) setJugadores(j => (j[clave] ? j : { ...j, [clave]: jugadorMando(id, leerNombresMandos()) }));
        const intento = (intentosRef.current[id] || '') + trozo;
        if (compruebaCandado(cand, intento)) {
            if (id < 900) feedbackMando(id, true);
            setJugadores(j => (j[clave]
                ? Object.fromEntries(Object.entries(j).map(([k, v]) => [k, k === clave ? { ...v, puntos: (v.puntos || 0) + 1, destacado: true } : { ...v, destacado: false }]))
                : j));
            setAbridor({ clave, nombre, avatar: (jugadores[clave] || jugadorMando(id, leerNombresMandos())).avatar });
            intentosRef.current = {}; setIntentos({});
            abrirPuerta(`🎮 ${nombre}`);
            return;
        }
        // ¿Sigue encajando con el principio de alguna solución? Si no, el intento de este mando se borra.
        const soluciones = (cand.soluciones || []).map(normalizar).filter(Boolean);
        const encaja = soluciones.length ? soluciones.some(sol => sol.startsWith(intento)) : intento.length < largoCandado;
        if (!encaja) {
            if (id < 900) feedbackMando(id, false);
            esperaM.current[id] = Date.now() + ESPERA_MANDO;
            const resto = { ...intentosRef.current };
            delete resto[id];
            intentosRef.current = resto;
            audio.fallo();
            setMsg(`❌ ${nombre}: ese carácter no es. ¡Vuelve a empezar!`);
        } else intentosRef.current = { ...intentosRef.current, [id]: intento };
        setIntentos(intentosRef.current);
    };

    const probarCodigo = () => {
        if (!codigoTxt.trim() || !cand) return;
        if (compruebaCandado(cand, codigoTxt)) abrirPuerta('');
        else { audio.fallo(); narrador.decir('candado_error'); setPenal(p => p + PENAL); setMsg(`❌ ¡Código incorrecto! −${PENAL} s`); setCodigoTxt(''); }
    };

    // Nueva pregunta → se limpian las respuestas marcadas
    useEffect(() => {
        setFalladas([]); setAviso(''); resolviendo.current = false; setRespM({});
        if (mandosRef.current && (fase === 'RETOS' || fase === 'BATALLA')) nuevaPreguntaMandos();
    }, [qIdx, salaIdx, fase, batalla?.q]);
    const avisar = (t) => { setAviso(t); setTimeout(() => setAviso(a => (a === t ? '' : a)), 1800); };

    // Mandos: se aceptan respuestas mientras la pregunta está abierta.
    aceptaRef.current = mandos && (fase === 'RETOS' || fase === 'BATALLA') && !revelada && !resolviendo.current;
    const nJugM = mandos ? Object.keys(jugadores).length : 0;
    const nRespM = Object.keys(respM).length;
    const preguntaActual = () => {
        if (fase === 'RETOS') return partida.pruebas[salaIdx]?.preguntas[qIdx];
        if (fase === 'BATALLA' && batalla && partida.batalla.length) return partida.batalla[batalla.q % partida.batalla.length];
        return null;
    };
    // Cuenta aciertos, avisa a cada mando y hace saltar a los avatares que han acertado.
    const corregirMandos = (q) => {
        const acertantes = Object.entries(respM).filter(([, l]) => LETRAS.indexOf(l) === q.correcta).map(([id]) => Number(id));
        Object.entries(respM).forEach(([id, l]) => { if (Number(id) < 900) feedbackMando(Number(id), LETRAS.indexOf(l) === q.correcta); });
        setJugadores(j => {
            const sig = { ...j };
            acertantes.forEach(id => { const k = `m${id}`; if (sig[k]) sig[k] = { ...sig[k], aciertos: (sig[k].aciertos || 0) + 1, puntos: (sig[k].puntos || 0) + 1 }; });
            return sig;
        });
        return { bien: acertantes.length, total: Math.max(nJugM, nRespM) };
    };
    const corregirSalaMandos = () => {
        const q = preguntaActual(); if (!q || revelada) return;
        const { bien, total } = corregirMandos(q);
        setRevelada(true);
        if (total && bien * 2 < total) {
            setPenal(p => p + PENAL_PREGUNTA); audio.fallo(); setFlash('rojo'); setTimeout(() => setFlash(null), 700);
            avisar(`✘ Solo ${bien} de ${total} aciertos: −${PENAL_PREGUNTA} s`);
        } else { audio.acierto(); avisar(`✔ ${bien} de ${total} aciertos`); }
    };
    const corregirBatallaMandos = () => {
        const q = preguntaActual(); if (!q || resolviendo.current) return;
        resolviendo.current = true;
        const { bien, total } = corregirMandos(q);
        const ok = total > 0 && bien * 2 >= total;
        setRevelada(true);
        avisar(ok ? `✔ ${bien} de ${total}: ¡golpe!` : `✘ Solo ${bien} de ${total}: ¡muerde!`);
        if (ok) audio.acierto(); else audio.fallo();
        setTimeout(() => resultadoBatalla(ok), 1600);
    };
    // Si ya han respondido todos los mandos, se corrige sola.
    useEffect(() => {
        if (!aceptaRef.current || !nJugM || nRespM < nJugM) return undefined;
        const t = setTimeout(() => (fase === 'BATALLA' ? corregirBatallaMandos() : corregirSalaMandos()), 800);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nRespM, nJugM, fase, revelada]);
    const conteoM = (q) => (mandos && q ? q.opciones.map((_, i) => Object.values(respM).filter(l => LETRAS.indexOf(l) === i).length) : undefined);
    const rankingM = Object.values(jugadores).filter(j => j.mando).sort((a, b) => (b.puntos || 0) - (a.puntos || 0));

    // Clic en una respuesta durante las salas: incorrecta = consume tiempo; correcta = se muestra
    const elegirSala = (i, q) => {
        if (i === q.correcta) { setRevelada(true); audio.acierto(); avisar('✔ ¡Correcto!'); return; }
        setFalladas(f => [...f, i]); setPenal(p => p + PENAL_PREGUNTA); audio.fallo();
        setFlash('rojo'); setTimeout(() => setFlash(null), 700);
        avisar(`✘ ¡Incorrecto! −${PENAL_PREGUNTA} s`);
    };
    // Clic en una respuesta en la batalla: decide directamente golpe o mordisco
    const elegirBatalla = (i, q) => {
        if (resolviendo.current) return;
        resolviendo.current = true;
        const ok = i === q.correcta;
        if (!ok) setFalladas([i]);
        setRevelada(true);
        if (ok) audio.acierto(); else audio.fallo();
        setTimeout(() => resultadoBatalla(ok), 1100);
    };

    const resultadoBatalla = (acierto) => {
        const b = batalla; if (!b) return;
        setRevelada(false);
        if (acierto) {
            const golpes = b.golpes + 1;
            setBatalla({ ...b, golpes, q: b.q + 1 });
            audio.golpe(); saltan();
            setZEstado('golpe'); setTimeout(() => setZEstado('idle'), 350);
            if (golpes >= b.hpMax) setTimeout(() => { setFase('VICTORIA'); setZEstado('muerto'); audio.victoria(); }, 400);
            return;
        }
        const vidas = b.vidas - 1;
        setBatalla({ ...b, vidas, q: b.q + 1, ataqueN: b.ataqueN + 1 });
        audio.rugido(); setFlash('rojo'); setTimeout(() => setFlash(null), 900);
        setZEstado('ataque'); setTimeout(() => setZEstado('idle'), 900);
        if (vidas <= 0) setTimeout(() => { setFase('DERROTA'); setZEstado('victoria'); audio.derrota(); }, 500);
    };

    const pdf = async (tipo, soluciones) => {
        setDescargando(tipo + soluciones);
        try { await descargarPdfEscape(tipo, { config, titulo, soluciones }); }
        catch (e) { alert('No se pudo crear el PDF: ' + e.message); }
        setDescargando('');
    };

    // ── panel derecho por fase ──
    let panel = null, banda = null;
    const pct = pp?.preguntas.length ? Math.min(100, ((qIdx + (revelada ? 1 : 0)) / pp.preguntas.length) * 100) : 0;
    const cabSala = (
        <div>
            <div style={{ fontWeight: 800, color: info.color, textTransform: 'uppercase', letterSpacing: 2, fontSize: '.8rem' }}>Sala {salaIdx + 1} de {pruebas.length} · {info.materia}</div>
            <div className="eh-titulo" style={{ fontSize: 'clamp(1.4rem,2.6vw,2.2rem)' }}>{info.emoji} {info.nombre}</div>
        </div>
    );

    if (fase === 'LOBBY') {
        panel = <>
            <h1 className="eh-titulo" style={{ fontSize: 'clamp(2rem,4vw,3.2rem)' }}>La mansión del zombi</h1>
            {!mandos && <>
            <div style={{ fontWeight: 800, color: '#ffb347' }}>📽️ Modo pizarra · fichas en papel</div>
            <p style={{ lineHeight: 1.5, margin: 0 }}>Reparte a cada alumno la <b>hoja de respuestas</b> (o el <b>cuadernillo</b>). Las preguntas que salen aquí son las mismas que las de las fichas.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[['CUADERNILLO', false, '📘 Cuadernillo'], ['HOJA', false, '📝 Hoja de respuestas'], ['CUADERNILLO', true, '✅ Cuadernillo con soluciones'], ['HOJA', true, '✅ Plantilla de corrección']].map(([t, s, l]) => (
                    <button key={t + s} className="eh-btn2" disabled={!!descargando} onClick={() => pdf(t, s)}>{descargando === t + s ? '⏳ Creando PDF…' : l}</button>
                ))}
            </div>
            </>}
            {mandos && (
            <div style={{ padding: '10px 12px', borderRadius: 14, background: 'rgba(0,0,0,.3)', border: '2px solid rgba(255,255,255,.12)' }}>
                    <div style={{ fontWeight: 800, color: '#ffb347' }}>🎮 Modo mandos micro:bit</div>
                    <p style={{ margin: '8px 0', lineHeight: 1.4, opacity: .9 }}>Cada alumno responde con su mando (A cambia la letra, B la envía). <b>Pulsad B para uniros</b>: aparecerá vuestro avatar en la mansión.</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        {antena.antenaOk
                            ? <span style={{ color: '#4ade80', fontWeight: 800 }}>📡 Antena lista</span>
                            : <button className="eh-btn2" onClick={conectar}>🔌 Conectar antena</button>}
                        <span style={{ fontWeight: 800 }}>{nJugM} {nJugM === 1 ? 'mando unido' : 'mandos unidos'}</span>
                    </div>
                    {msgAntena && <div style={{ marginTop: 6, color: '#fca5a5', fontWeight: 700 }}>{msgAntena}</div>}
                    {nJugM > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                        {Object.entries(jugadores).map(([k, j]) => (
                            <label key={k} title="Escribe el nombre del alumno" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 4px 3px 10px', borderRadius: 99, background: '#5b21b6', fontWeight: 700, fontSize: '.9rem' }}>
                                🎮 {j.mando > 900 ? `V${j.mando - 900}` : j.mando}
                                <input value={j.nombre} onChange={e => renombrar(k, e.target.value)} onBlur={e => { if (!e.target.value.trim()) renombrar(k, nombreMando(j.mando, {})); }}
                                    style={{ width: 110, border: 'none', borderRadius: 99, padding: '3px 8px', background: 'rgba(0,0,0,.35)', color: '#fff', fontWeight: 700, fontFamily: 'inherit' }} />
                            </label>
                        ))}
                    </div>}
            </div>
            )}
            <MapaMansion pruebas={pruebas} salaIdx={-1} fase="LOBBY" />
            <button className="eh-btn" style={{ fontSize: '1.2rem' }} disabled={mandos && nJugM === 0} onClick={() => { audio.desbloquear(); audio.puertaCerrada(); setFase('INTRO'); }}>🕯️ Empezar{mandos && nJugM === 0 ? ' (espera a que se una algún mando)' : ''}</button>
        </>;
    } else if (fase === 'INTRO') {
        panel = <>
            <h1 className="eh-titulo" style={{ fontSize: 'clamp(1.8rem,3.6vw,3rem)' }}>¡La puerta se ha cerrado!</h1>
            <p style={{ fontSize: 'clamp(1.1rem,1.8vw,1.5rem)', lineHeight: 1.5, margin: 0 }}>Es la noche de Halloween… <b>¡CLAC!</b> En el sótano, un <b>zombi</b> está a punto de despertar.</p>
            <p style={{ fontSize: 'clamp(1rem,1.6vw,1.3rem)', lineHeight: 1.5, margin: 0, opacity: .9 }}>Superad las <b>{pruebas.length} salas</b>: {mandos ? 'contestad con vuestro mando' : 'contestad en vuestra ficha'} y abrid cada candado. Cada puerta da un <b>amuleto</b> (una vida más). Tenéis <b>{config.minutos} minutos</b>.</p>
            <button className="eh-btn" style={{ fontSize: '1.2rem' }} onClick={() => irASala(0)}>🚪 Abrir la primera puerta</button>
        </>;
    } else if (fase === 'RETOS' && pp) {
        const q = pp.preguntas[qIdx];
        const ultima = qIdx >= pp.preguntas.length - 1;
        panel = <>
            {cabSala}
            <PreguntaGrande q={q} etiqueta={`${salaIdx + 1}.${qIdx + 1}`} revelada={revelada} falladas={falladas} onElegir={mandos ? undefined : (i) => elegirSala(i, q)} conteo={conteoM(q)} />
            {mandos && !revelada && <div style={{ textAlign: 'center', fontWeight: 800, fontSize: '1.2rem' }}>🎮 {nRespM} de {nJugM} han respondido</div>}
            {aviso && <div className="eh-aparece" style={{ textAlign: 'center', fontWeight: 900, fontSize: '1.3rem', color: aviso.startsWith('✔') ? '#4ade80' : '#fca5a5' }}>{aviso}</div>}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 'auto' }}>
                {qIdx > 0 && !mandos && <button className="eh-btn2" onClick={() => { setQIdx(i => i - 1); setRevelada(false); }}>◀ Anterior</button>}
                {!revelada
                    ? mandos
                        ? <button className="eh-btn" onClick={corregirSalaMandos}>✅ Corregir ({nRespM}/{nJugM})</button>
                        : <button className="eh-btn" onClick={() => { setRevelada(true); audio.acierto(); }}>👁 Mostrar respuesta</button>
                    : ultima
                        ? <button className="eh-btn" onClick={() => { setFase('CANDADO'); audio.campana(); if (!mandos) saltan(); }}>🔒 ¡Al candado!</button>
                        : <button className="eh-btn" onClick={() => { setQIdx(i => i + 1); setRevelada(false); if (!mandos) saltan(); }}>▶ Siguiente pregunta</button>}
            </div>
        </>;
        banda = (
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '1.15rem', marginBottom: 6 }}>
                    <span>🕯️ Energía de la puerta</span><span>Pregunta {qIdx + 1} de {pp.preguntas.length} · cada fallo −{PENAL_PREGUNTA} s</span>
                </div>
                <div className="eh-barra" style={{ height: 30, borderRadius: 15 }}><div style={{ width: `${pct}%` }} /></div>
            </div>
        );
    } else if (fase === 'CANDADO' && cand) {
        panel = <>
            {cabSala}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span className="eh-latido" style={{ fontSize: '2.2rem' }}>🔒</span><h2 style={{ margin: 0, color: '#ffde59', fontSize: 'clamp(1.3rem,2.2vw,1.8rem)' }}>{cand.titulo}</h2></div>
            <p style={{ fontSize: 'clamp(1rem,1.5vw,1.3rem)', lineHeight: 1.4, margin: 0, whiteSpace: 'pre-wrap' }}>{cand.instruccion}</p>
            {cand.imagen && <img src={cand.imagen} alt="" style={{ maxWidth: '100%', maxHeight: '18vh', borderRadius: 12, alignSelf: 'center' }} />}
            {cand.pistas?.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: cand.pistas.length > 1 ? 'repeat(auto-fit,minmax(220px,1fr))' : '1fr', gap: 8 }}>
                    {cand.pistas.map((p, i) => (
                        <div key={i} className="eh-aparece" style={{ padding: '8px 12px', borderRadius: 14, background: 'rgba(255,222,89,.14)', border: '2px solid rgba(255,222,89,.5)', fontSize: 'clamp(.95rem,1.4vw,1.2rem)', fontWeight: 700, display: 'flex', gap: 12, alignItems: 'center' }}>
                            <span style={{ minWidth: 32, height: 32, borderRadius: '50%', background: '#ff8c1a', color: '#1a0700', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>{cand.pistas.length > 1 ? i + 1 : '💡'}</span>
                            <span>{p.texto} {p.img && <img src={p.img} alt="" style={{ height: 48, borderRadius: 6, background: '#fff', verticalAlign: 'middle' }} />}</span>
                        </div>
                    ))}
                </div>
            )}
            {mandos && (
                <div style={{ padding: '10px 12px', borderRadius: 14, background: 'rgba(124,58,237,.22)', border: '2px solid rgba(167,139,250,.6)' }}>
                    <div style={{ fontWeight: 800, fontSize: 'clamp(1rem,1.5vw,1.25rem)', lineHeight: 1.4 }}>
                        🎮 Con el mando, {candNumerico
                            ? <>marca cada <b>cifra</b> con A (−) y B (+) y envíala con <b>A + B</b>.</>
                            : <>busca cada <b>letra</b> con A (◀) y B (▶) y envíala con <b>A + B</b>.</>}
                        {' '}Código de <b>{largoCandado}</b> {candNumerico ? 'cifras' : 'caracteres'}. Si un carácter no es, ese mando vuelve a empezar.
                    </div>
                    {Object.keys(intentos).length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                            {Object.entries(intentos).map(([id, t]) => (
                                <span key={id} style={{ padding: '3px 10px', borderRadius: 99, background: '#5b21b6', fontWeight: 700, fontSize: '.95rem', letterSpacing: 2 }}>
                                    {jugadores[`m${id}`]?.nombre || `Mando ${id}`} {'●'.repeat(t.length)}{'○'.repeat(Math.max(0, largoCandado - t.length))}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                <input className="eh-input" value={codigoTxt} onChange={e => setCodigoTxt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') probarCodigo(); }}
                    placeholder={cand.longitud ? `${cand.longitud} ${cand.tipo === 'numero' ? 'cifras' : 'caracteres'}` : 'Código que dice la clase'} />
                <button className="eh-btn" onClick={probarCodigo}>🗝️ Probar</button>
            </div>
            {msg && <div style={{ color: '#fca5a5', fontWeight: 800, textAlign: 'center' }}>{msg}</div>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="eh-btn2" onClick={() => abrirPuerta('El profe')}>🔓 Abrir sin código</button>
            </div>
        </>;
        banda = <div style={{ fontWeight: 900, fontSize: '1.2rem', textAlign: 'center' }}>🔒 {cand.titulo} · cada código incorrecto resta {PENAL} s</div>;
    } else if (fase === 'ABIERTA') {
        panel = <>
            {cabSala}
            <h2 style={{ fontSize: 'clamp(1.8rem,3.4vw,2.8rem)', margin: 0, color: '#4ade80' }}>¡Puerta abierta!</h2>
            {abridor && (
                <div className="eh-aparece" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', borderRadius: 18, background: 'radial-gradient(circle at 20% 50%, rgba(255,222,89,.35), rgba(91,33,182,.35))', border: '3px solid #ffde59', boxShadow: '0 0 30px rgba(255,222,89,.45)' }}>
                    <div style={{ flexShrink: 0 }}><AvatarPreview3D avatar={abridor.avatar} size={150} /></div>
                    <div>
                        <div style={{ fontSize: 'clamp(1rem,1.6vw,1.3rem)', fontWeight: 800, color: '#ffde59' }}>🗝️ ¡Ha abierto el candado!</div>
                        <div className="eh-titulo" style={{ fontSize: 'clamp(1.8rem,3.4vw,2.8rem)' }}>{abridor.nombre}</div>
                    </div>
                </div>
            )}
            {cand?.solucionVisible && <p style={{ fontSize: '1.3rem', margin: 0 }}>🗝️ El código era: <b style={{ color: '#ffde59' }}>{cand.solucionVisible}</b></p>}
            <p style={{ fontSize: '1.2rem', margin: 0 }}>Amuleto: <span style={{ fontSize: '2rem' }}>{info.amuleto.emoji}</span> <b>{info.amuleto.nombre}</b> (+1 vida)</p>
            <MapaMansion pruebas={pruebas} salaIdx={salaIdx} amuletos={amuletos} fase={fase} />
            <button className="eh-btn" style={{ fontSize: '1.15rem', marginTop: 'auto' }} onClick={siguienteSala}>{salaIdx >= pruebas.length - 1 ? '⚔️ ¡Al sótano a por el zombi!' : '🚪 Siguiente sala'}</button>
        </>;
        banda = <div style={{ fontWeight: 900, fontSize: '1.25rem', textAlign: 'center', color: '#4ade80' }}>🚪 ¡Puerta abierta! {info.amuleto.emoji} {info.amuleto.nombre}</div>;
    } else if (enPelea && batalla) {
        const lista = partida.batalla;
        const q = lista.length ? lista[batalla.q % lista.length] : null;
        const repaso = batalla.q >= lista.length;
        const hp = batalla.hpMax - batalla.golpes;
        if (fase === 'BATALLA') {
            panel = <>
                <h1 className="eh-titulo" style={{ fontSize: 'clamp(1.6rem,3vw,2.6rem)' }}>¡Batalla final!</h1>
                {batalla.agotado && <div style={{ color: '#fca5a5', fontWeight: 800 }}>⏰ Se acabó el tiempo: el zombi tiene un 50 % más de vida.</div>}
                <PreguntaGrande q={q} etiqueta={`Z${(batalla.q % Math.max(1, lista.length)) + 1}${repaso ? ' (repaso)' : ''}`} revelada={revelada} falladas={falladas} onElegir={mandos ? undefined : (i) => elegirBatalla(i, q)} conteo={conteoM(q)} />
                {mandos && !revelada && <div style={{ textAlign: 'center', fontWeight: 800, fontSize: '1.2rem' }}>🎮 {nRespM} de {nJugM} han respondido · si acierta la mitad, ¡golpe!</div>}
                {aviso && <div className="eh-aparece" style={{ textAlign: 'center', fontWeight: 900, fontSize: '1.3rem', color: aviso.startsWith('✔') ? '#4ade80' : '#fca5a5' }}>{aviso}</div>}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 'auto' }}>
                    {mandos
                        ? (!revelada && <button className="eh-btn" onClick={corregirBatallaMandos}>✅ Corregir ({nRespM}/{nJugM})</button>)
                        : !revelada
                        ? <button className="eh-btn" onClick={() => setRevelada(true)}>👁 Mostrar respuesta</button>
                        : resolviendo.current ? null : <>
                            <button className="eh-btn" style={{ background: 'linear-gradient(180deg,#4ade80,#16a34a)' }} onClick={() => resultadoBatalla(true)}>✔ ¡Acertamos! Golpe</button>
                            <button className="eh-btn" style={{ background: 'linear-gradient(180deg,#f87171,#b91c1c)', color: '#fff' }} onClick={() => resultadoBatalla(false)}>✘ Fallamos: ¡muerde!</button>
                        </>}
                </div>
            </>;
        } else {
            panel = <>
                <h1 className="eh-titulo" style={{ fontSize: 'clamp(2rem,4vw,3.4rem)', color: fase === 'VICTORIA' ? '#4ade80' : '#ef4444' }}>{fase === 'VICTORIA' ? '¡Habéis escapado!' : '¡El zombi os ha atrapado!'}</h1>
                {fase === 'VICTORIA' ? <p style={{ fontSize: '1.4rem' }}>El zombi ha caído y la puerta se abre. ¡Feliz Halloween! 🎃</p>
                    : <>
                        <p style={{ fontSize: '1.2rem' }}>Pero está herido… ¡le quedan {hp} puntos de vida!</p>
                        <button className="eh-btn" onClick={() => { setBatalla(b => ({ ...b, vidas: b.vidasMax })); setRevelada(false); setFase('BATALLA'); setZEstado('idle'); audio.rugido(); }}>🔁 ¡Revancha!</button>
                    </>}
                {mandos && rankingM.length > 0 && (
                    <div>
                        <h3 style={{ margin: '6px 0', color: '#ffde59' }}>🎮 Aciertos con los mandos</h3>
                        {rankingM.map((j, i) => (
                            <div key={j.mando} style={{ display: 'flex', gap: 10, padding: '4px 2px', borderBottom: '1px solid rgba(255,255,255,.12)', fontSize: i < 3 ? '1.2rem' : '1rem', fontWeight: 700 }}>
                                <span style={{ width: 40 }}>{['🥇', '🥈', '🥉'][i] || `${i + 1}º`}</span>
                                <span style={{ flex: 1 }}>{j.nombre}</span>
                                <b>{j.puntos || 0}</b>
                            </div>
                        ))}
                    </div>
                )}
            </>;
        }
        banda = (
            <div>
                <BarraVidaZombi hp={hp} hpMax={batalla.hpMax} />
                <div style={{ marginTop: 6 }}><Corazones vidas={batalla.vidas} max={batalla.vidasMax} /></div>
            </div>
        );
    }

    return (
        <div className="eh-root eh-3d" style={fase === 'VICTORIA' ? { background: 'radial-gradient(ellipse at 50% 0%, #5e3b1d 0%, #2e1a0b 50%, #0f0703 100%)' } : undefined}>
            <Ambiente ligero />
            {flash && <div className="eh-flash-rojo" />}
            {(fase === 'VICTORIA' || (fase === 'ABIERTA' && abridor)) && <Confeti />}
            <Subtitulo texto={narrador.subtitulo} />
            <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', flexWrap: 'wrap', background: 'rgba(0,0,0,.35)' }}>
                <button className="eh-btn2" onClick={onSalir}>← Salir</button>
                <div style={{ fontWeight: 900 }}>📽️ {titulo || 'Escape Room de Halloween'}</div>
                <div style={{ flex: 1 }} />
                {tiempoFin && enSalas && (
                    <>
                        <div style={{ fontWeight: 900, fontSize: '1.7rem', color: restante < 120000 ? '#ef4444' : '#ffde59', fontVariantNumeric: 'tabular-nums' }} className={restante < 60000 && pausa == null ? 'eh-latido' : ''}>⏳ {mmss(restante)}</div>
                        <button className="eh-btn2" onClick={() => { if (pausa == null) setPausa(Date.now()); else { setTiempoFin(t => t + (Date.now() - pausa)); setPausa(null); } }}>{pausa == null ? '⏸' : '▶'}</button>
                        <button className="eh-btn2" onClick={() => setTiempoFin(t => t + 5 * 60000)}>➕ 5 min</button>
                        <button className="eh-btn2" onClick={siguienteSala}>⏭ Saltar sala</button>
                    </>
                )}
                {mandos && <button className="eh-btn2" onClick={() => setVerVirtuales(v => !v)} title="Mandos virtuales para probar sin placas">🧪</button>}
                <button className="eh-btn2" onClick={cambiar3D} title="Mostrar u ocultar la mansión 3D">{usar3D ? '🏚️ 3D' : '🖼️ 2D'}</button>
                <button className="eh-btn2" onClick={() => setSonido(s => !s)} title={sonido ? 'Silenciar sonido y música' : 'Activar sonido y música'}>{sonido ? '🔊' : '🔇'}</button>
            </div>
            {mandos && verVirtuales && (
                <div style={{ position: 'relative', zIndex: 3, display: 'flex', gap: 14, flexWrap: 'wrap', padding: '6px 16px', background: 'rgba(0,0,0,.5)' }}>
                    {[901, 902, 903].map(id => (
                        <div key={id} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <span style={{ fontSize: '.85rem', opacity: .8 }}>🧪 V{id - 900}</span>
                            {fase === 'CANDADO'
                                ? <form style={{ display: 'flex', gap: 4 }} onSubmit={e => {
                                    e.preventDefault();
                                    const txt = normalizar(e.currentTarget.elements.c.value).toUpperCase();
                                    [...txt].forEach(c => simularPulsacion(id, candNumerico ? 'N' + c : 'T' + c));
                                    e.currentTarget.reset();
                                }}>
                                    <input name="c" className="eh-input" style={{ width: 110, padding: '4px 8px' }} placeholder={candNumerico ? 'cifras' : 'letras'} />
                                    <button className="eh-btn2" style={{ padding: '4px 10px' }}>Enviar</button>
                                </form>
                                : LETRAS.slice(0, 4).map(l => <button key={l} className="eh-btn2" style={{ padding: '4px 10px' }} onClick={() => simularPulsacion(id, l)}>{l}</button>)}
                        </div>
                    ))}
                </div>
            )}
            <div className="eh-layout3d" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.25fr)' }}>
                <div className="eh-escena3d">
                    {usar3D
                        ? <Mansion3D pruebas={infos} fase={fase} salaIdx={salaIdx} abiertas={abiertas} jugadores={jugadores}
                            batalla={batalla ? { golpes: batalla.golpes, ataqueN: batalla.ataqueN, bloqueado: false } : null} alto="100%" />
                        : <div className="eh-panel" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '6rem' }}>
                            {enPelea ? <Zombi estado={zEstado} size={260} /> : <span className="eh-flota">{fase === 'LOBBY' || fase === 'INTRO' ? '🏚️' : info.emoji}</span>}
                        </div>}
                    {banda && <div className="eh-banda">{banda}</div>}
                </div>
                <div className="eh-panel eh-lateral" style={{ gap: 14 }}>{panel}</div>
            </div>
        </div>
    );
}
