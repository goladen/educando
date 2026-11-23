// 🃏 PiLive con tarjetas (tipo Plickers): la pizarra muestra la pregunta y los alumnos,
// sin ningún dispositivo, levantan su tarjeta impresa con la letra elegida arriba.
// La webcam (o la cámara del portátil) las lee: el número dice quién es y el giro, qué
// responde. Se puede cambiar de respuesta hasta que el profe corrige (cuenta la última).
// Todo en el navegador: no se sube ninguna imagen.
//
// props: recurso (PiLive u otro recurso de preguntas; si falta, se elige uno), onExit
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CamaraTarjetas from './CamaraTarjetas.jsx';
import { crearEstabilizador, LETRAS_TARJETA, MAX_TARJETAS } from './detectorTarjetas.js';
import { barajar } from '../utils/normalizarPreguntas';
import { hojasTarjetas } from './preguntasTarjetas.js';

export { hojasTarjetas };
import { despertarAudio, sonidoFinal } from '../utils/sonidosFeedback';
import { BotonGrupoDispositivo } from '../components/GruposDispositivo';
import { nombresGrupoActivo } from '../utils/gruposDispositivo';
import GuardarResultadosMandos from '../mandos/GuardarResultadosMandos.jsx';
import { crearSesionEscaner, escucharSesion, actualizarSesion, cerrarSesion, urlEscaner } from './escanerRemoto.js';

const ImprimirTarjetas = lazy(() => import('./ImprimirTarjetas.jsx'));
const SelectorRecursoMandos = lazy(() => import('../mandos/SelectorRecursoMandos.jsx'));

const COLORES = ['#ef4444', '#3b82f6', '#f59e0b', '#22c55e'];
const LS_NOMBRES = 'pikt_tarjetas_nombres';
const LS_NUM = 'pikt_tarjetas_num';
const leerLS = (k, def) => { try { const v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); } catch { return def; } };
const guardarLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

export default function QuizTarjetas({ recurso: recursoInicial = null, onExit }) {
  const [fase, setFase] = useState('config'); // config | lobby | pregunta | resultado | final
  const [recurso, setRecurso] = useState(recursoInicial);
  const [hojaSel, setHojaSel] = useState(-1);
  const [ordenRecurso, setOrdenRecurso] = useState(false);
  const [numPreguntas, setNumPreguntas] = useState(10);
  const [tiempo, setTiempo] = useState(0); // 0 = sin límite: el profe corrige cuando quiere
  const [numTarjetas, setNumTarjetas] = useState(() => leerLS(LS_NUM, 0) || Math.min(MAX_TARJETAS, nombresGrupoActivo().length || 30));
  const [nombres, setNombres] = useState(() => leerLS(LS_NOMBRES, {}));
  const [ocultarLetras, setOcultarLetras] = useState(true);
  const [camGrande, setCamGrande] = useState(false);
  const [verImprimir, setVerImprimir] = useState(false);
  const [simulador, setSimulador] = useState(false);
  // 📱 Móvil como cámara
  const [codigoMovil, setCodigoMovil] = useState('');
  const [verMovil, setVerMovil] = useState(false);
  const [creandoMovil, setCreandoMovil] = useState(false);
  const [errorMovil, setErrorMovil] = useState('');
  const [movilOk, setMovilOk] = useState(false);
  const [usarCamaraPc, setUsarCamaraPc] = useState(true);

  const [preguntas, setPreguntas] = useState([]);
  const [indice, setIndice] = useState(0);
  const [presentes, setPresentes] = useState({}); // tarjeta → true
  const [respuestas, setRespuestas] = useState({}); // tarjeta → letra (la última leída)
  const [historial, setHistorial] = useState([]); // [{ correcta, respuestas }]
  const [restante, setRestante] = useState(0);

  const faseRef = useRef(fase);
  faseRef.current = fase;
  const preguntaRef = useRef(null);
  const estabRef = useRef(crearEstabilizador(3));
  const inicioRef = useRef(0);

  const pregunta = preguntas[indice];
  preguntaRef.current = pregunta;
  const nombre = useCallback((t) => String(nombres[t] || '').trim() || `Tarjeta ${t}`, [nombres]);

  useEffect(() => guardarLS(LS_NOMBRES, nombres), [nombres]);
  useEffect(() => guardarLS(LS_NUM, numTarjetas), [numTarjetas]);
  useEffect(() => { if (recursoInicial) setRecurso(recursoInicial); }, [recursoInicial]);

  const hojas = useMemo(() => hojasTarjetas(recurso), [recurso]);
  const disponibles = hojaSel < 0 ? hojas.flatMap((h) => h.preguntas) : hojas[hojaSel]?.preguntas || [];
  useEffect(() => { setNumPreguntas((n) => Math.min(Math.max(1, n), Math.max(1, disponibles.length))); }, [disponibles.length]);

  // Lecturas confirmadas (misma letra 3 fotogramas seguidos)
  const registrar = useCallback((lecturas) => {
    if (!lecturas.length) return;
    const f = faseRef.current;
    if (f !== 'lobby' && f !== 'pregunta') return;
    setPresentes((prev) => (lecturas.every((l) => prev[l.tarjeta]) ? prev : { ...prev, ...Object.fromEntries(lecturas.map((l) => [l.tarjeta, true])) }));
    if (f === 'pregunta') {
      const p = preguntaRef.current;
      const validas = lecturas.filter((l) => p && LETRAS_TARJETA.indexOf(l.letra) < p.opciones.length);
      if (validas.length) setRespuestas((prev) => {
        let cambia = false;
        const sig = { ...prev };
        for (const l of validas) if (sig[l.tarjeta] !== l.letra) { sig[l.tarjeta] = l.letra; cambia = true; }
        return cambia ? sig : prev;
      });
    }
  }, []);

  const onDetecciones = useCallback((dets) => registrar(estabRef.current.actualizar(dets)), [registrar]);

  // ── 📱 Móvil como cámara (sesión en live_games) ──
  const rondaActual = fase === 'lobby' ? 0 : indice + 1;
  const rondaRef = useRef(rondaActual);
  rondaRef.current = rondaActual;
  const accionesRef = useRef({});
  const ultimaOrdenRef = useRef(null);
  const movilVistoRef = useRef({ valor: null, en: 0 });

  const activarMovil = async () => {
    setVerMovil(true);
    if (codigoMovil) return;
    setCreandoMovil(true);
    setErrorMovil('');
    try {
      const c = await crearSesionEscaner({ maxTarjeta: numTarjetas, total: preguntas.length, indice: 0, nOpciones: 4 });
      setCodigoMovil(c);
      setUsarCamaraPc(false);
    } catch {
      setErrorMovil('No se pudo crear la sesión. ¿Hay conexión a internet?');
    }
    setCreandoMovil(false);
  };

  useEffect(() => {
    if (!codigoMovil) return undefined;
    const quitar = escucharSesion(codigoMovil, (d) => {
      if (!d) return;
      // Latido del móvil, medido con el reloj de este ordenador
      if (d.movil && d.movil !== movilVistoRef.current.valor) movilVistoRef.current = { valor: d.movil, en: Date.now() };
      // Lecturas de la ronda actual
      const lecturas = Object.entries(d.lecturas || {})
        .filter(([, v]) => v && v.r === rondaRef.current && LETRAS_TARJETA.includes(v.l))
        .map(([t, v]) => ({ tarjeta: Number(t), letra: v.l }))
        .filter((l) => l.tarjeta >= 1 && l.tarjeta <= MAX_TARJETAS);
      registrar(lecturas);
      // Botones del móvil (la primera vez solo se apunta la orden que hubiera)
      const o = d.orden;
      if (ultimaOrdenRef.current === null) { ultimaOrdenRef.current = o?.t || 0; return; }
      if (o?.t && o.t !== ultimaOrdenRef.current) {
        ultimaOrdenRef.current = o.t;
        accionesRef.current[o.tipo]?.();
      }
    });
    const t = setInterval(() => setMovilOk(Date.now() - movilVistoRef.current.en < 15000), 2000);
    return () => { quitar(); clearInterval(t); };
  }, [codigoMovil, registrar]);

  // Al salir se borra la sesión
  const codigoMovilRef = useRef('');
  codigoMovilRef.current = codigoMovil;
  useEffect(() => () => { if (codigoMovilRef.current) cerrarSesion(codigoMovilRef.current); }, []);

  // La pizarra le cuenta al móvil en qué punto está (y vacía las lecturas al cambiar de ronda)
  const rondaEnviadaRef = useRef(null);
  useEffect(() => {
    if (!codigoMovil) return;
    const datos = {
      fase, ronda: rondaActual, maxTarjeta: numTarjetas, indice, total: preguntas.length,
      nOpciones: pregunta?.opciones?.length || 4,
      texto: fase === 'pregunta' || fase === 'resultado' ? String(pregunta?.texto || '').slice(0, 160) : '',
    };
    if (rondaEnviadaRef.current !== rondaActual) { datos.lecturas = {}; rondaEnviadaRef.current = rondaActual; }
    actualizarSesion(codigoMovil, datos);
  }, [codigoMovil, fase, rondaActual, numTarjetas, indice, preguntas.length, pregunta]);

  const etiqueta = useCallback((d) => {
    const f = faseRef.current;
    const quien = String(nombres[d.tarjeta] || '').trim() || `#${d.tarjeta}`;
    if (f === 'pregunta') {
      const p = preguntaRef.current;
      const fuera = p && LETRAS_TARJETA.indexOf(d.letra) >= p.opciones.length;
      if (fuera) return { texto: `${quien} · ✗ ${d.letra}?`, color: '#f87171' };
      return { texto: ocultarLetras ? `${quien} ✓` : `${quien} · ${d.letra}`, color: d.dudosa ? '#facc15' : '#22c55e' };
    }
    return { texto: quien, color: '#38bdf8' };
  }, [nombres, ocultarLetras]);

  const abrirSala = () => {
    if (!disponibles.length) { alert('Este recurso no tiene preguntas de opción múltiple (de 2 a 4 respuestas).'); return; }
    // Se rebarajan las opciones (salvo las fijas, como Verdadero / Falso)
    const mezcladas = disponibles.map((p) => {
      if (p.fijas) return p;
      const orden = barajar(p.opciones.map((_, i) => i));
      return { ...p, opciones: orden.map((i) => p.opciones[i]), correcta: orden.indexOf(p.correcta) };
    });
    despertarAudio();
    setPreguntas((ordenRecurso ? mezcladas : barajar(mezcladas)).slice(0, numPreguntas));
    setHistorial([]);
    setPresentes({});
    estabRef.current.reiniciar();
    setFase('lobby');
  };

  const lanzarPregunta = (i) => {
    setIndice(i);
    setRespuestas({});
    estabRef.current.reiniciar();
    inicioRef.current = Date.now();
    setRestante(tiempo);
    setFase('pregunta');
  };

  const corregir = useCallback(() => {
    if (faseRef.current !== 'pregunta') return;
    setHistorial((h) => {
      const sig = [...h];
      sig[indice] = { correcta: preguntaRef.current?.correcta ?? -1, respuestas: { ...respuestas } };
      return sig;
    });
    setFase('resultado');
  }, [indice, respuestas]);

  // Cuenta atrás (si hay tiempo límite)
  useEffect(() => {
    if (fase !== 'pregunta' || !tiempo) return undefined;
    const t = setInterval(() => {
      const quedan = Math.max(0, tiempo - (Date.now() - inicioRef.current) / 1000);
      setRestante(quedan);
      if (quedan <= 0) corregir();
    }, 250);
    return () => clearInterval(t);
  }, [fase, tiempo, corregir]);

  const siguiente = () => (indice + 1 < preguntas.length ? lanzarPregunta(indice + 1) : setFase('final'));
  useEffect(() => { if (fase === 'final') sonidoFinal(); }, [fase]);

  const jugadores = useMemo(() => Object.keys(presentes).map(Number).sort((a, b) => a - b), [presentes]);
  const resumen = useMemo(() => jugadores.map((t) => {
    let aciertos = 0, respondidas = 0;
    historial.forEach((h) => {
      if (!h) return;
      const l = h.respuestas[t];
      if (l) { respondidas++; if (LETRAS_TARJETA.indexOf(l) === h.correcta) aciertos++; }
    });
    return { tarjeta: t, aciertos, respondidas };
  }).sort((a, b) => b.aciertos - a.aciertos || a.tarjeta - b.tarjeta), [jugadores, historial]);

  const nRespuestas = Object.keys(respuestas).length;

  // Botones del móvil → mismas acciones que en la pizarra
  accionesRef.current = {
    empezar: () => { if (faseRef.current === 'lobby') lanzarPregunta(0); },
    corregir: () => { if (faseRef.current === 'pregunta') corregir(); },
    siguiente: () => { if (faseRef.current === 'resultado') siguiente(); },
  };
  // Recuento para el móvil (agrupado: como mucho una escritura cada 0,6 s)
  useEffect(() => {
    if (!codigoMovil) return undefined;
    const t = setTimeout(() => actualizarSesion(codigoMovil, { respondidas: nRespuestas, presentes: jugadores.length }), 600);
    return () => clearTimeout(t);
  }, [codigoMovil, nRespuestas, jugadores.length]);
  const reparto = pregunta ? pregunta.opciones.map((_, i) => Object.values(respuestas).filter((l) => LETRAS_TARJETA.indexOf(l) === i).length) : [];
  const camaraActiva = fase === 'lobby' || fase === 'pregunta';
  // Tarjeta 1 = primer alumno del grupo, tarjeta 2 = el segundo…
  const usarGrupo = (g) => {
    const alumnos = (g?.alumnos || []).slice(0, MAX_TARJETAS);
    if (!alumnos.length) return;
    setNombres(Object.fromEntries(alumnos.map((a, i) => [i + 1, a])));
    setNumTarjetas(alumnos.length);
  };

  return (
    <div style={st.wrapper}>
      <header style={st.header}>
        <button onClick={onExit} style={st.backBtn}>← Volver</button>
        <h2 style={st.title}>🃏 PiLive con tarjetas{recurso?.titulo ? ` · ${recurso.titulo}` : ''}</h2>
        {(fase === 'pregunta' || fase === 'resultado') && <span style={st.contador}>{indice + 1}/{preguntas.length}</span>}
        <button style={{ ...st.btnSec, borderColor: codigoMovil ? (movilOk ? '#22c55e' : '#f59e0b') : '#475569' }} onClick={activarMovil}>
          📱 {codigoMovil ? (movilOk ? 'Móvil conectado' : `Móvil · ${codigoMovil}`) : 'Usar el móvil como cámara'}
        </button>
        <button style={st.btnSec} onClick={() => setVerImprimir(true)}>🖨️ Imprimir tarjetas</button>
      </header>

      <div style={st.scroll}>
        {fase === 'config' && (
          <div style={st.panel}>
            <div style={st.explica}>
              <b>Sin móviles ni tablets:</b> cada alumno tiene una tarjeta impresa con su número. Para responder la levanta
              con la letra elegida <b>arriba</b> y tú enfocas la clase con la cámara del ordenador. ¿Aún no tienes las
              tarjetas? <button style={st.enlace} onClick={() => setVerImprimir(true)}>Imprímelas aquí</button> (una vez para todo el curso).
              <br />¿No hay webcam en el aula? <button style={st.enlace} onClick={activarMovil}>📱 Usa tu móvil como cámara</button>: escaneas
              el QR y recorres la clase con él (también puedes corregir y pasar de pregunta desde el móvil).
            </div>

            {!recursoInicial && (
              <>
                <h3 style={st.h3}>Preguntas</h3>
                <Suspense fallback={<p style={st.ayuda}>Cargando recursos…</p>}>
                  <SelectorRecursoMandos seleccionado={recurso} onPick={(r) => { setRecurso(r); setHojaSel(-1); }} />
                </Suspense>
              </>
            )}

            {recurso && (
              <div style={{ ...st.fila, marginTop: 12 }}>
                <b style={{ color: '#facc15' }}>✔ {recurso.titulo || 'Sin título'}</b>
                {hojas.length > 1 && (
                  <select value={hojaSel} onChange={(e) => setHojaSel(Number(e.target.value))} style={st.select}>
                    <option value={-1}>Todas las hojas</option>
                    {hojas.map((h, i) => <option key={i} value={i}>{h.nombre} ({h.preguntas.length})</option>)}
                  </select>
                )}
                <label style={st.check}><input type="checkbox" checked={ordenRecurso} onChange={(e) => setOrdenRecurso(e.target.checked)} /> En el orden del recurso</label>
                <span style={st.ayuda}>{disponibles.length} preguntas con 2-4 opciones (las de escribir, ordenar o dibujar se saltan)</span>
              </div>
            )}

            <div style={{ ...st.fila, marginTop: 14 }}>
              <label style={st.label}>Nº de preguntas
                <select value={numPreguntas} onChange={(e) => setNumPreguntas(Number(e.target.value))} style={st.select}>
                  {[...new Set([5, 8, 10, 15, 20, 30, 50, disponibles.length])].filter((n) => n > 0 && n <= Math.max(1, disponibles.length)).sort((a, b) => a - b).map((n) => (
                    <option key={n} value={n}>{n === disponibles.length ? `${n} (todas)` : n}</option>
                  ))}
                </select>
              </label>
              <label style={st.label}>Tiempo por pregunta
                <select value={tiempo} onChange={(e) => setTiempo(Number(e.target.value))} style={st.select}>
                  <option value={0}>Sin límite (corriges tú)</option>
                  {[20, 30, 45, 60, 90, 120].map((n) => <option key={n} value={n}>{n} s</option>)}
                </select>
              </label>
              <label style={st.label}>Tarjetas en clase
                <input type="number" min={1} max={MAX_TARJETAS} value={numTarjetas} onChange={(e) => setNumTarjetas(Math.max(1, Math.min(MAX_TARJETAS, Number(e.target.value) || 1)))} style={{ ...st.select, width: 90 }} />
              </label>
            </div>
            <label style={{ ...st.check, marginTop: 12 }}>
              <input type="checkbox" checked={ocultarLetras} onChange={(e) => setOcultarLetras(e.target.checked)} />
              En la imagen de la cámara, no enseñar qué letra ha elegido cada uno (para que no se copien)
            </label>
            <button style={st.btnGrande} onClick={abrirSala} disabled={!recurso}>Abrir sala →</button>
          </div>
        )}

        {fase === 'lobby' && (
          <div style={st.columnas}>
            <div style={{ ...st.panel, flex: 1.4, minWidth: 280 }}>
              <h3 style={{ ...st.h3, fontSize: 24, textAlign: 'center' }}>Levantad vuestra tarjeta para pasar lista</h3>
              <p style={{ ...st.ayuda, textAlign: 'center' }}>Da igual la letra. Escribe aquí el nombre de cada tarjeta (se recuerda en este ordenador).</p>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                <BotonGrupoDispositivo onUsar={usarGrupo} />
              </div>
              <div style={st.jugGrid}>
                {Array.from({ length: numTarjetas }, (_, i) => i + 1).map((t) => (
                  <div key={t} style={{ ...st.jugCard, borderColor: presentes[t] ? '#22c55e' : '#334155', background: presentes[t] ? 'rgba(34,197,94,0.12)' : st.jugCard.background }}>
                    <span style={{ ...st.jugNum, color: presentes[t] ? '#86efac' : '#facc15' }}>{t}</span>
                    <input data-nombres-grupo="si" value={nombres[t] || ''} placeholder={`Nombre ${t}`}
                      onChange={(e) => setNombres((p) => ({ ...p, [t]: e.target.value }))} style={st.jugInput} />
                    {presentes[t] && <span title="Tarjeta vista">✅</span>}
                  </div>
                ))}
              </div>
              <div style={{ textAlign: 'center', marginTop: 18 }}>
                <button style={st.btnGrande} onClick={() => lanzarPregunta(0)}>
                  Empezar ({jugadores.length} {jugadores.length === 1 ? 'tarjeta vista' : 'tarjetas vistas'}) ▶
                </button>
                <p style={st.ayuda}>Las tarjetas que no se hayan visto aquí se añaden solas al responder.</p>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 280 }}>
              <EstadoMovil codigo={codigoMovil} ok={movilOk} onAbrir={activarMovil} usarPc={usarCamaraPc} onUsarPc={setUsarCamaraPc} />
              {usarCamaraPc && <CamaraTarjetas activo={camaraActiva} maxTarjeta={numTarjetas} onDetecciones={onDetecciones} etiqueta={etiqueta} alto="46vh" />}
              <ConsejosCamara />
            </div>
          </div>
        )}

        {(fase === 'pregunta' || fase === 'resultado') && pregunta && (
          <div style={st.columnas}>
            <div style={{ flex: camGrande ? 1 : 2.2, minWidth: 300 }}>
              {fase === 'pregunta' && tiempo > 0 && (
                <div style={st.barraTiempo}><div style={{ ...st.barraRelleno, width: `${(restante / tiempo) * 100}%` }} /></div>
              )}
              {pregunta.imagen && <img src={pregunta.imagen} alt="" style={st.imagen} />}
              <div style={st.pregunta}>{pregunta.texto}</div>
              <div style={st.opciones}>
                {pregunta.opciones.map((op, i) => {
                  const apagada = fase === 'resultado' && i !== pregunta.correcta;
                  return (
                    <div key={i} style={{ ...st.opcion, background: COLORES[i], opacity: apagada ? 0.3 : 1 }}>
                      <span style={st.opLetra}>{LETRAS_TARJETA[i]}</span>
                      <span style={{ flex: 1 }}>{op}</span>
                      {fase === 'resultado' && <span style={st.opCuenta}>{reparto[i]}</span>}
                    </div>
                  );
                })}
              </div>

              {fase === 'pregunta' ? (
                <div style={st.estadoRonda}>
                  {tiempo > 0 && <span style={{ fontSize: 22, fontWeight: 800 }}>⏱ {Math.ceil(restante)}</span>}
                  <span style={{ fontSize: 18, fontWeight: 700 }}>
                    {nRespuestas}/{Math.max(jugadores.length, nRespuestas)} han respondido
                    {jugadores.length > 0 && nRespuestas >= jugadores.length && ' · ¡todos! ✅'}
                  </span>
                  <button style={{ ...st.btnGrande, marginTop: 0 }} onClick={corregir}>Corregir ✔</button>
                </div>
              ) : (
                <Corregida pregunta={pregunta} respuestas={respuestas} jugadores={jugadores} nombre={nombre}
                  ultima={indice + 1 >= preguntas.length} onSiguiente={siguiente} />
              )}

              <div style={st.chips}>
                {jugadores.map((t) => {
                  const l = (fase === 'pregunta' ? respuestas : historial[indice]?.respuestas || {})[t];
                  const bg = fase === 'pregunta'
                    ? (l ? '#16a34a' : '#334155')
                    : (!l ? '#334155' : LETRAS_TARJETA.indexOf(l) === pregunta.correcta ? '#16a34a' : '#b91c1c');
                  return <span key={t} style={{ ...st.chipJug, background: bg }}>{nombre(t)}{fase === 'resultado' && l ? ` · ${l}` : ''}</span>;
                })}
              </div>
            </div>
            {fase === 'pregunta' && (
              <div style={{ flex: 1, minWidth: 260 }}>
                <EstadoMovil codigo={codigoMovil} ok={movilOk} onAbrir={activarMovil} usarPc={usarCamaraPc} onUsarPc={setUsarCamaraPc} />
                {usarCamaraPc && <>
                  <CamaraTarjetas activo={camaraActiva} maxTarjeta={numTarjetas} onDetecciones={onDetecciones} etiqueta={etiqueta} alto={camGrande ? '62vh' : '34vh'} compacta />
                  <div style={{ ...st.fila, marginTop: 6 }}>
                    <button style={st.btnSec} onClick={() => setCamGrande((g) => !g)}>{camGrande ? '🔍 Cámara pequeña' : '🔍 Cámara grande'}</button>
                    <label style={st.check}><input type="checkbox" checked={ocultarLetras} onChange={(e) => setOcultarLetras(e.target.checked)} /> Ocultar letras</label>
                  </div>
                </>}
              </div>
            )}
          </div>
        )}

        {fase === 'final' && (
          <div style={st.panel}>
            <h3 style={{ ...st.h3, textAlign: 'center', fontSize: 28 }}>🏆 Resultados</h3>
            {!resumen.length && <p style={{ ...st.ayuda, textAlign: 'center' }}>No se ha leído ninguna tarjeta.</p>}
            {resumen.map((r, i) => (
              <div key={r.tarjeta} style={{ ...st.filaRank, fontSize: i < 3 ? 20 : 16 }}>
                <span style={{ width: 50 }}>{['🥇', '🥈', '🥉'][i] || `${i + 1}º`}</span>
                <span style={{ color: '#64748b', width: 40 }}>#{r.tarjeta}</span>
                <span style={{ flex: 1 }}>{nombre(r.tarjeta)}</span>
                <span style={{ color: '#94a3b8', marginRight: 16 }}>{r.respondidas < preguntas.length ? `${preguntas.length - r.respondidas} sin responder · ` : ''}</span>
                <b>{r.aciertos}/{preguntas.length} ✓</b>
              </div>
            ))}
            <h4 style={{ ...st.h3, marginTop: 20, fontSize: 16 }}>Por pregunta</h4>
            <div style={st.fila}>
              {preguntas.map((p, i) => {
                const h = historial[i];
                const resp = h ? Object.values(h.respuestas) : [];
                const ok = resp.filter((l) => LETRAS_TARJETA.indexOf(l) === p.correcta).length;
                const pct = resp.length ? Math.round((ok / resp.length) * 100) : 0;
                return (
                  <span key={i} title={p.texto} style={{ ...st.chipJug, background: pct >= 70 ? '#15803d' : pct >= 40 ? '#a16207' : '#b91c1c' }}>
                    P{i + 1}: {pct}%
                  </span>
                );
              })}
            </div>
            <div style={{ textAlign: 'center', marginTop: 20, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <GuardarResultadosMandos
                tipo="PILIVE_TARJETAS"
                juego="PiLive con tarjetas"
                modalidad="Tarjetas (cámara)"
                claveNombres={LS_NOMBRES}
                recursoTitulo={recurso?.titulo || ''}
                hoja={hojaSel >= 0 ? hojas[hojaSel]?.nombre || '' : ''}
                config={{ preguntas: preguntas.length, segundos: tiempo || 'sin límite' }}
                jugadores={resumen.map((r) => ({ id: r.tarjeta, nombre: String(nombres[r.tarjeta] || '').trim(), aciertos: r.aciertos, intentos: preguntas.length, puntos: r.aciertos * 100, extra: { tarjeta: r.tarjeta, sinResponder: preguntas.length - r.respondidas } }))}
              />
              <button style={st.btnGrande} onClick={() => setFase('config')}>Jugar otra vez</button>
            </div>
          </div>
        )}

        {/* Tarjetas virtuales para probar sin imprimir nada */}
        {(fase === 'lobby' || fase === 'pregunta') && (
          <div style={{ marginTop: 22 }}>
            <button style={st.btnSec} onClick={() => setSimulador((s) => !s)}>🧪 {simulador ? 'Ocultar' : 'Probar sin'} tarjetas</button>
            {simulador && <Simulador max={numTarjetas} onLeer={(t, l) => registrar([{ tarjeta: t, letra: l }])} />}
          </div>
        )}
      </div>

      {verMovil && (
        <VentanaMovil codigo={codigoMovil} creando={creandoMovil} error={errorMovil} ok={movilOk}
          usarPc={usarCamaraPc} onUsarPc={setUsarCamaraPc} onClose={() => setVerMovil(false)} />
      )}

      {verImprimir && (
        <Suspense fallback={null}>
          <ImprimirTarjetas numInicial={numTarjetas} onClose={() => setVerImprimir(false)} />
        </Suspense>
      )}
    </div>
  );
}

function Corregida({ pregunta, respuestas, jugadores, nombre, ultima, onSiguiente }) {
  const resp = Object.entries(respuestas);
  const ok = resp.filter(([, l]) => LETRAS_TARJETA.indexOf(l) === pregunta.correcta).length;
  const sin = jugadores.filter((t) => !respuestas[t]);
  const pct = resp.length ? Math.round((ok / resp.length) * 100) : 0;
  return (
    <div style={{ ...st.panel, marginTop: 16 }}>
      <div style={{ ...st.fila, justifyContent: 'center', fontSize: 18 }}>
        <b style={{ color: '#86efac' }}>✅ {ok} aciertos</b>
        <b style={{ color: '#fca5a5' }}>❌ {resp.length - ok} fallos</b>
        <span style={{ color: '#94a3b8' }}>{pct}% de la clase</span>
      </div>
      {sin.length > 0 && <p style={{ ...st.ayuda, textAlign: 'center' }}>Sin responder: {sin.map(nombre).join(', ')}</p>}
      <div style={{ textAlign: 'center', marginTop: 10 }}>
        <button style={st.btnGrande} onClick={onSiguiente}>{ultima ? 'Ver resultados 🏆' : 'Siguiente pregunta ▶'}</button>
      </div>
    </div>
  );
}

function Simulador({ max, onLeer }) {
  const [t, setT] = useState(1);
  return (
    <div style={{ ...st.fila, marginTop: 8 }}>
      <label style={st.check}>Tarjeta
        <input type="number" min={1} max={max} value={t} onChange={(e) => setT(Math.max(1, Math.min(max, Number(e.target.value) || 1)))} style={{ ...st.select, width: 70 }} />
      </label>
      {LETRAS_TARJETA.map((l, i) => (
        <button key={l} style={{ ...st.miniBtn, background: COLORES[i] }} onClick={() => onLeer(t, l)}>{l}</button>
      ))}
      <span style={st.ayuda}>Simula que la cámara lee esa tarjeta con esa letra arriba.</span>
    </div>
  );
}

/** Recuadro junto a la cámara: estado del móvil y elegir qué cámara se usa. */
function EstadoMovil({ codigo, ok, onAbrir, usarPc, onUsarPc }) {
  if (!codigo) {
    return (
      <button style={{ ...st.btnSec, width: '100%', marginBottom: 8, padding: '10px 12px', fontSize: 14 }} onClick={onAbrir}>
        📱 ¿Sin webcam? Usa tu móvil como cámara
      </button>
    );
  }
  return (
    <div style={{ ...st.panel, padding: 12, marginBottom: 8, borderColor: ok ? '#22c55e' : '#f59e0b' }}>
      <div style={{ ...st.fila, justifyContent: 'space-between' }}>
        <b style={{ color: ok ? '#86efac' : '#fcd34d' }}>{ok ? '📱 Móvil conectado' : '📱 Esperando al móvil…'}</b>
        <button style={st.btnSec} onClick={onAbrir}>Ver QR · {codigo}</button>
      </div>
      <label style={{ ...st.check, marginTop: 8 }}>
        <input type="checkbox" checked={usarPc} onChange={(e) => onUsarPc(e.target.checked)} /> Usar también la cámara de este ordenador
      </label>
    </div>
  );
}

function VentanaMovil({ codigo, creando, error, ok, usarPc, onUsarPc, onClose }) {
  const url = codigo ? urlEscaner(codigo) : '';
  const qr = url ? `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=0f172a&margin=8` : '';
  return (
    <div style={st.fondo} onClick={onClose}>
      <div style={st.ventana} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ margin: 0, flex: 1, fontSize: 20 }}>📱 El móvil como cámara</h2>
          <button onClick={onClose} style={st.cerrarV} aria-label="Cerrar">✕</button>
        </div>
        {creando && <p>Creando la sesión…</p>}
        {error && <p style={{ color: '#dc2626', fontWeight: 700 }}>{error}</p>}
        {codigo && (
          <>
            <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.5 }}>
              Escanea el QR con tu móvil (o abre <b>{window.location.host}/?escaner={codigo}</b>). El móvil usa su cámara trasera,
              lee las tarjetas y las manda a la pizarra. No se envía ninguna imagen, solo el número de tarjeta y la letra.
            </p>
            <div style={{ textAlign: 'center' }}>
              <img src={qr} alt={`QR de la sesión ${codigo}`} width={260} height={260} style={{ borderRadius: 12, border: '1px solid #e2e8f0' }} />
              <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: 6, margin: '6px 0' }}>{codigo}</div>
              <div style={{ fontWeight: 800, color: ok ? '#15803d' : '#b45309' }}>{ok ? '✅ Móvil conectado' : '⏳ Esperando al móvil…'}</div>
            </div>
            <ul style={{ color: '#475569', fontSize: 13.5, lineHeight: 1.5, paddingLeft: 18 }}>
              <li>Recorre la clase despacio con el móvil: cada tarjeta se apunta en cuanto se lee.</li>
              <li>Desde el móvil también puedes <b>empezar</b>, <b>corregir</b> y pasar a la <b>siguiente</b> pregunta.</li>
              <li>La pantalla del móvil se queda encendida mientras esté la página abierta.</li>
            </ul>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={usarPc} onChange={(e) => onUsarPc(e.target.checked)} /> Usar también la cámara de este ordenador
            </label>
          </>
        )}
        <button onClick={onClose} style={{ marginTop: 14, width: '100%', padding: '12px 16px', borderRadius: 12, border: 'none', background: '#0f766e', color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer' }}>Listo</button>
      </div>
    </div>
  );
}

function ConsejosCamara() {
  return (
    <ul style={{ ...st.ayuda, paddingLeft: 18, marginTop: 10 }}>
      <li>Que la tarjeta se vea entera y sin tapar el cuadro negro con los dedos (cogedla por el borde).</li>
      <li>Mejor con la luz de frente; evitad que el cuadro brille (plastificado mate).</li>
      <li>Si no llega a las últimas filas, imprime las tarjetas más grandes (1 por folio) o acércate con el portátil.</li>
      <li>Recuadro verde = leída. Amarillo = tarjeta muy inclinada: que la pongan recta.</li>
    </ul>
  );
}

const st = {
  wrapper: { display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', background: 'linear-gradient(160deg, #0f172a 0%, #312e81 100%)', fontFamily: 'system-ui, sans-serif', color: '#e2e8f0', overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 18px', background: 'rgba(15,23,42,0.85)', borderBottom: '1px solid #334155' },
  backBtn: { padding: '6px 12px', borderRadius: 8, border: '1px solid #475569', background: '#0f172a', color: '#e2e8f0', fontWeight: 600, cursor: 'pointer' },
  title: { margin: 0, color: '#f1f5f9', fontSize: 18, fontWeight: 800, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  contador: { fontWeight: 800, color: '#facc15' },
  scroll: { flex: 1, overflow: 'auto', padding: '20px 16px 40px', maxWidth: 1400, width: '100%', margin: '0 auto', boxSizing: 'border-box' },
  panel: { background: 'rgba(255,255,255,0.06)', border: '1px solid #334155', borderRadius: 16, padding: 18 },
  explica: { background: 'rgba(56,189,248,0.1)', border: '1px solid #0369a1', borderRadius: 12, padding: '12px 14px', fontSize: 14.5, lineHeight: 1.55, marginBottom: 14 },
  enlace: { background: 'none', border: 'none', color: '#7dd3fc', fontWeight: 800, textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: 'inherit' },
  h3: { margin: '0 0 12px', color: '#f8fafc', fontSize: 18 },
  fila: { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  columnas: { display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-start' },
  ayuda: { color: '#94a3b8', fontSize: 13, margin: '8px 0 4px', lineHeight: 1.5 },
  check: { display: 'flex', gap: 6, alignItems: 'center', fontSize: 13.5, color: '#cbd5e1', cursor: 'pointer' },
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#94a3b8' },
  select: { padding: '7px 10px', borderRadius: 8, border: '1px solid #475569', background: '#0f172a', color: '#f1f5f9', fontSize: 15 },
  btnGrande: { marginTop: 16, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 12, padding: '13px 26px', fontSize: 17, fontWeight: 800, cursor: 'pointer' },
  btnSec: { background: 'transparent', color: '#e2e8f0', border: '1px solid #475569', borderRadius: 10, padding: '8px 12px', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  miniBtn: { minWidth: 38, padding: '6px 10px', borderRadius: 8, border: 'none', color: '#fff', fontWeight: 800, cursor: 'pointer' },
  jugGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8 },
  jugCard: { display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(15,23,42,0.7)', border: '1px solid #334155', borderRadius: 12, padding: '6px 10px' },
  jugNum: { fontWeight: 900, fontSize: 18, minWidth: 26, textAlign: 'center' },
  jugInput: { flex: 1, minWidth: 0, background: 'transparent', border: 'none', borderBottom: '1px solid #475569', color: '#f1f5f9', fontSize: 14, padding: '4px 2px' },
  barraTiempo: { height: 10, background: '#1e293b', borderRadius: 99, overflow: 'hidden', marginBottom: 16 },
  barraRelleno: { height: '100%', background: '#facc15', transition: 'width .25s linear' },
  imagen: { display: 'block', maxWidth: '100%', maxHeight: '30vh', margin: '0 auto 12px', borderRadius: 12, background: '#fff' },
  pregunta: { fontSize: 'clamp(24px, 3.6vw, 44px)', fontWeight: 900, textAlign: 'center', color: '#fff', margin: '6px 0 20px', lineHeight: 1.2 },
  opciones: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 },
  opcion: { display: 'flex', alignItems: 'center', gap: 14, color: '#fff', fontSize: 'clamp(18px, 2.4vw, 28px)', fontWeight: 800, borderRadius: 16, padding: '16px 18px', transition: 'opacity .3s' },
  opLetra: { background: 'rgba(0,0,0,0.25)', borderRadius: 10, width: 46, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  opCuenta: { background: 'rgba(0,0,0,0.3)', borderRadius: 99, padding: '2px 12px', fontSize: 18 },
  estadoRonda: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20, marginTop: 18, flexWrap: 'wrap' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 16 },
  chipJug: { color: '#fff', fontSize: 13, padding: '4px 10px', borderRadius: 99, transition: 'background .3s' },
  filaRank: { display: 'flex', alignItems: 'center', padding: '8px 4px', borderBottom: '1px solid #334155' },
  fondo: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.75)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  ventana: { background: '#fff', color: '#0f172a', borderRadius: 18, padding: 22, width: '100%', maxWidth: 480, maxHeight: '92vh', overflowY: 'auto', boxSizing: 'border-box' },
  cerrarV: { border: 'none', background: '#f1f5f9', borderRadius: 10, width: 36, height: 36, fontSize: 16, cursor: 'pointer' },
};
