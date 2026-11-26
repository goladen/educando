// 📝 Corrector de exámenes (/corrector): hoja de respuestas con círculos A-E (hasta 50
// preguntas) que se corrige con la cámara del móvil, sin IA y sin subir imágenes.
//   Preparar  → título, nº de preguntas y opciones, clave (a mano, escaneando la hoja
//               del profe o desde un recurso), penalización y PDF (hoja y examen)
//   Corregir  → la cámara lee cada hoja: nº de lista + respuestas → nota al momento
//   Resultados→ tabla, % por pregunta, CSV y guardar en Informes
// Todo se guarda en este dispositivo (localStorage) para no perder lo corregido.
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CamaraTarjetas from '../tarjetas/CamaraTarjetas.jsx';
import { leerHoja, puntuar, aGris, LETRAS, MAX_PREGUNTAS, MARCAS, MAX_LETRAS, plantillaEscritas } from './omr.js';
import { hayEscritas, leerEscritas, estadosEscritas, textosLeidos } from './escritas.js';
import { verificarEscrita, normalizarRespuesta } from './ocrLetras.js';
import { pintarLectura } from './dibujo.js';
import useSesionMovil from './useSesionMovil.js';
import { urlCorrectorMovil } from './escanerCorrector.js';
import { descargarPdfCorrector } from './hojaPdf.js';
import { hojasTarjetas } from '../tarjetas/preguntasTarjetas.js';
import { barajar, preguntasDeRecurso } from '../utils/normalizarPreguntas';
import { sonidoCorrecto, sonidoIncorrecto, despertarAudio } from '../utils/sonidosFeedback';
import { nombresGrupoActivo } from '../utils/gruposDispositivo';
import { BotonGrupoDispositivo } from '../components/GruposDispositivo';
import { guardarRegistroLocal } from '../utils/registrosLocales';
import GuardarResultadosMandos from '../mandos/GuardarResultadosMandos.jsx';

const SelectorRecursoMandos = lazy(() => import('../mandos/SelectorRecursoMandos.jsx'));
const SubirArchivos = lazy(() => import('./SubirArchivos.jsx'));

const LS = 'pikt_corrector_v1';
const LS_NOMBRES = 'pikt_tarjetas_nombres'; // nº de lista = nº de tarjeta de PiLive: mismos nombres
const leerLS = (k, def) => { try { const v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); } catch { return def; } };
const guardarLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

const CFG_INICIAL = { titulo: '', nPreguntas: 20, nOpciones: 4, clave: Array(MAX_PREGUNTAS).fill(''), penalizacion: 0, preguntas: null, recursoTitulo: '', nEscritas: 0, letras: 8, claveEscritas: [], preguntasEscritas: null };
const COLOR = { bien: '#16a34a', mal: '#dc2626', blanco: '#f59e0b', doble: '#7c3aed', anulada: '#94a3b8', dudosa: '#7c3aed' };
const IDS_MARCAS = new Set(MARCAS.map((m) => m.tarjeta));

export default function CorrectorExamenes({ onExit }) {
  const guardado = useMemo(() => leerLS(LS, null), []);
  const [cfg, setCfg] = useState(() => ({ ...CFG_INICIAL, ...(guardado?.cfg || {}) }));
  const [resultados, setResultados] = useState(() => guardado?.resultados || {});
  const [nombres, setNombres] = useState(() => leerLS(LS_NOMBRES, {}));
  const [pestana, setPestana] = useState(() => (guardado?.cfg?.clave?.some(Boolean) ? 'corregir' : 'preparar'));
  const [modoEscaneo, setModoEscaneo] = useState('alumnos'); // alumnos | clave
  const [aviso, setAviso] = useState('');

  useEffect(() => guardarLS(LS, { cfg, resultados }), [cfg, resultados]);
  useEffect(() => guardarLS(LS_NOMBRES, nombres), [nombres]);
  useEffect(() => { if (!aviso) return undefined; const t = setTimeout(() => setAviso(''), 2600); return () => clearTimeout(t); }, [aviso]);

  const set = (cambios) => setCfg((c) => ({ ...c, ...cambios }));
  const clave = cfg.clave.slice(0, cfg.nPreguntas);
  const nClave = clave.filter(Boolean).length + (cfg.claveEscritas || []).slice(0, cfg.nEscritas || 0).filter((c) => String(c || '').trim()).length;
  const nombre = useCallback((n) => {
    const g = nombresGrupoActivo();
    return String(nombres[n] || g[n - 1] || '').trim();
  }, [nombres]);

  // La nota se recalcula siempre (si cambia la clave, cambian las notas sin reescanear)
  const notaHoja = useCallback((h) => {
    const est = estadosEscritas(h, cfg);
    return { ...puntuar(h.respuestas, clave, { penalizacion: cfg.penalizacion, escritas: est }), escritasEst: est };
  }, [cfg, clave]);
  const filas = useMemo(() => Object.values(resultados)
    .map((r) => ({ ...r, ...notaHoja(r) }))
    .sort((a, b) => a.lista - b.lista), [resultados, notaHoja]);

  // Registro local (icono Pi ×N de la tarjeta) al pasar a resultados con hojas nuevas
  const registradasRef = useRef(Object.keys(guardado?.resultados || {}).length);
  const irA = (p) => {
    if (p === 'resultados' && filas.length > registradasRef.current) {
      registradasRef.current = filas.length;
      guardarRegistroLocal('CORRECTOR', {
        titulo: cfg.titulo || `${cfg.nPreguntas} preguntas`,
        aciertos: filas.reduce((s, f) => s + f.aciertos, 0),
        intentos: filas.reduce((s, f) => s + f.validas, 0),
        nombre: `${filas.length} hojas`,
        via: 'corrector',
      });
    }
    setPestana(p);
  };

  const guardarHoja = useCallback((r) => setResultados((prev) => ({ ...prev, [r.lista]: { lista: r.lista, respuestas: r.respuestas, dudosas: r.dudosas || [], escritas: r.escritas || [], hora: Date.now(), reescaneada: !!prev[r.lista] } })), []);
  // Lectura de una hoja ya localizada → hoja para guardar (con las respuestas escritas, si las hay)
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  const prepararHoja = useCallback(async (r) => {
    const c = cfgRef.current;
    let escritas = [];
    if (hayEscritas(c)) {
      // La imagen de la fila solo se guarda si no está claramente bien (para revisarla)
      escritas = await leerEscritas(r, c, (k, cajas) => verificarEscrita(cajas, c.claveEscritas?.[k] || '').estado !== 'bien');
    }
    return { lista: r.lista, respuestas: r.respuestas, dudosas: r.dudosas || [], escritas };
  }, []);
  const revisar = useCallback((lista, k, estado) => setResultados((prev) => {
    const h = prev[lista];
    if (!h) return prev;
    const revision = { ...(h.revision || {}) };
    if (estado) revision[k] = estado; else delete revision[k];
    return { ...prev, [lista]: { ...h, revision } };
  }), []);
  const ponerClave = useCallback((resp, textos = null) => {
    setCfg((c) => ({ ...c, clave: [...resp, ...Array(MAX_PREGUNTAS).fill('')].slice(0, MAX_PREGUNTAS), ...(textos ? { claveEscritas: textos } : {}) }));
    setModoEscaneo('alumnos');
    setAviso('🔑 Clave leída: revísala en «Preparar» si quieres.');
  }, []);
  const movil = useSesionMovil({ cfg, clave, modo: modoEscaneo, onHoja: guardarHoja, onClave: ponerClave });

  const nuevaCorreccion = () => {
    if (filas.length && !window.confirm('¿Borrar las hojas corregidas y empezar otra corrección? (La clave se mantiene.)')) return;
    setResultados({});
    registradasRef.current = 0;
  };

  return (
    <div style={st.wrapper}>
      <header style={st.header}>
        <button onClick={onExit} style={st.backBtn}>← Volver</button>
        <h2 style={st.title}>📝 Corrector de exámenes</h2>
      </header>
      <nav style={st.tabs}>
        {[['preparar', '1 · Preparar'], ['corregir', '2 · Corregir'], ['resultados', `3 · Resultados (${filas.length})`]].map(([k, t]) => (
          <button key={k} onClick={() => irA(k)} style={st.tab(pestana === k)}>{t}</button>
        ))}
      </nav>

      <div style={st.scroll}>
        {pestana === 'preparar' && (
          <Preparar cfg={cfg} set={set} nClave={nClave} nombre={nombre} setNombres={setNombres}
            onEscanearClave={() => { setModoEscaneo('clave'); setPestana('corregir'); }}
            onListo={() => { setModoEscaneo('alumnos'); setPestana('corregir'); }} />
        )}
        {pestana === 'corregir' && (
          <Corregir cfg={cfg} clave={clave} modo={modoEscaneo} setModo={setModoEscaneo} nombre={nombre} resultados={resultados}
            onClave={ponerClave} onHoja={guardarHoja} movil={movil} prepararHoja={prepararHoja} notaHoja={notaHoja}
            onVerResultados={() => irA('resultados')} />
        )}
        {pestana === 'resultados' && (
          <Resultados cfg={cfg} clave={clave} filas={filas} nombre={nombre} nombres={nombres} setNombres={setNombres} onRevisar={revisar}
            onBorrar={(n) => setResultados((prev) => { const s = { ...prev }; delete s[n]; return s; })}
            onNueva={nuevaCorreccion} onSeguir={() => { setModoEscaneo('alumnos'); setPestana('corregir'); }} />
        )}
      </div>
      {aviso && <div style={st.toast}>{aviso}</div>}
    </div>
  );
}

// ───────────────────────── 1 · Preparar ─────────────────────────
function Preparar({ cfg, set, nClave, nombre, setNombres, onEscanearClave, onListo }) {
  const [verRecurso, setVerRecurso] = useState(false);
  const [recurso, setRecurso] = useState(null);
  const [hojaSel, setHojaSel] = useState(-1);
  const [aleatorio, setAleatorio] = useState(true);
  const [textoClave, setTextoClave] = useState('');
  const [generando, setGenerando] = useState('');
  const [conClave, setConClave] = useState(false);

  const hojas = useMemo(() => hojasTarjetas(recurso, 5), [recurso]);
  const disponibles = hojaSel < 0 ? hojas.flatMap((h) => h.preguntas) : hojas[hojaSel]?.preguntas || [];
  const [conCortas, setConCortas] = useState(true);
  // Preguntas de respuesta corta del recurso que caben en las casillas (hasta 16 letras o cifras)
  const cortas = useMemo(() => {
    if (!recurso) return [];
    const r = hojaSel >= 0 && Array.isArray(recurso.hojas) ? { ...recurso, hojas: [recurso.hojas[hojaSel]] } : recurso;
    return preguntasDeRecurso(r).filter((p) => p.tipo === 'CORTA' && normalizarRespuesta(p.correcta).length >= 1 && normalizarRespuesta(p.correcta).length <= MAX_LETRAS);
  }, [recurso, hojaSel]);
  const capacidad = plantillaEscritas({ nPreguntas: cfg.nPreguntas, nEscritas: 99, letras: cfg.letras || 8 }).capacidad;
  // Si ya no caben (más preguntas tipo test o casillas más largas), se recortan
  useEffect(() => { if ((cfg.nEscritas || 0) > capacidad) set({ nEscritas: capacidad }); }, [capacidad]); // eslint-disable-line react-hooks/exhaustive-deps
  const ponerEscrita = (k, v) => { const c = [...(cfg.claveEscritas || [])]; c[k] = v; set({ claveEscritas: c }); };

  const usarRecurso = () => {
    if (!disponibles.length && !(conCortas && cortas.length)) return;
    let lista = disponibles.map((p) => {
      if (p.fijas) return p;
      const orden = barajar(p.opciones.map((_, i) => i));
      return { ...p, opciones: orden.map((i) => p.opciones[i]), correcta: orden.indexOf(p.correcta) };
    });
    if (aleatorio) lista = barajar(lista);
    lista = lista.slice(0, MAX_PREGUNTAS);
    const nOpciones = Math.max(2, Math.min(5, Math.max(...lista.map((p) => p.opciones.length))));
    // Preguntas de respuesta corta → respuestas escritas (si se pide y caben)
    let escritas = {};
    if (conCortas && cortas.length) {
      const letras = Math.max(...cortas.map((p) => normalizarRespuesta(p.correcta).length)) <= 8 ? 8 : cortas.some((p) => normalizarRespuesta(p.correcta).length > 12) ? 16 : 12;
      let nTest = lista.length, cap = 0;
      // si no caben, se quitan preguntas tipo test hasta que quepan al menos la mitad de las cortas (máx. 12)
      const quiero = Math.min(cortas.length, 12);
      while (nTest > 0 && (cap = plantillaEscritas({ nPreguntas: nTest, nEscritas: 99, letras }).capacidad) < Math.ceil(quiero / 2)) nTest -= 3;
      lista = lista.slice(0, Math.max(0, nTest));
      cap = plantillaEscritas({ nPreguntas: lista.length, nEscritas: 99, letras }).capacidad;
      const elegidas = (aleatorio ? barajar(cortas) : cortas).slice(0, Math.min(cap, quiero));
      escritas = { nEscritas: elegidas.length, letras, claveEscritas: elegidas.map((p) => p.correcta), preguntasEscritas: elegidas.map((p) => ({ texto: p.enunciado })) };
    } else escritas = { nEscritas: 0, preguntasEscritas: null };
    const clave2 = [...lista.map((p) => LETRAS[p.correcta]), ...Array(MAX_PREGUNTAS).fill('')].slice(0, MAX_PREGUNTAS);
    set({ preguntas: lista.map((p) => ({ texto: p.texto, opciones: p.opciones })), clave: clave2, nPreguntas: lista.length, nOpciones, recursoTitulo: recurso.titulo || '', titulo: cfg.titulo || recurso.titulo || '', ...escritas });
    setVerRecurso(false);
  };

  const ponerLetra = (q, l) => set({ clave: cfg.clave.map((c, i) => (i === q ? (c === l ? '' : l) : c)) });
  const aplicarTexto = () => {
    const letras = textoClave.toUpperCase().replace(/[^A-E]/g, '').split('').slice(0, cfg.nPreguntas);
    if (!letras.length) return;
    set({ clave: cfg.clave.map((c, i) => (i < letras.length ? letras[i] : c)) });
    setTextoClave('');
  };

  // Hojas personalizadas: alumnos con nombre (de «Mis grupos» o los ya escritos)
  const alumnos = useMemo(() => {
    const r = [];
    for (let n = 1; n <= 99; n++) { const nm = nombre(n); if (nm) r.push({ nombre: nm, lista: n }); }
    return r;
  }, [nombre]);

  const pdf = async (tipo) => {
    setGenerando(tipo);
    try {
      await descargarPdfCorrector({
        titulo: cfg.titulo, nPreguntas: cfg.nPreguntas, nOpciones: cfg.nOpciones,
        nEscritas: cfg.nEscritas || 0, letras: cfg.letras || 8,
        alumnos: tipo === 'personal' ? alumnos : [],
        preguntas: tipo === 'examen' || tipo === 'soloExamen' ? cfg.preguntas || [] : null,
        preguntasEscritas: tipo === 'examen' || tipo === 'soloExamen' ? cfg.preguntasEscritas : null,
        claveEscritas: cfg.claveEscritas,
        soloExamen: tipo === 'soloExamen',
        clave: cfg.clave, conClave: conClave && tipo !== 'soloExamen',
      });
    } catch (e) { alert('No se pudo crear el PDF: ' + (e?.message || e)); }
    setGenerando('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={st.explica}>
        Imprime la <b>hoja de respuestas</b> (vale una fotocopia para toda la clase), los alumnos rellenan su <b>nº de lista</b> y
        los círculos, y tú las corriges con la <b>cámara del móvil</b>: unos segundos por hoja, sin internet para leerlas y sin
        subir ninguna foto. Hasta {MAX_PREGUNTAS} preguntas.
      </div>

      <section style={st.panel}>
        <h3 style={st.h3}>El examen</h3>
        <div style={st.fila}>
          <label style={{ ...st.label, flex: 1, minWidth: 200 }}>Título (sale en la hoja)
            <input value={cfg.titulo} onChange={(e) => set({ titulo: e.target.value.slice(0, 80) })} placeholder="Examen tema 3 · Biología" style={st.input} />
          </label>
          <label style={st.label}>Preguntas
            <input type="number" min={cfg.nEscritas > 0 ? 0 : 1} max={MAX_PREGUNTAS} value={cfg.nPreguntas} onChange={(e) => set({ nPreguntas: Math.max(cfg.nEscritas > 0 ? 0 : 1, Math.min(MAX_PREGUNTAS, Number(e.target.value) || 0)) })} style={{ ...st.input, width: 80 }} />
          </label>
          <label style={st.label}>Respuestas
            <select value={cfg.nOpciones} onChange={(e) => set({ nOpciones: Number(e.target.value) })} style={st.input}>
              <option value={2}>A-B (verdadero / falso)</option>
              <option value={3}>A-C</option>
              <option value={4}>A-D</option>
              <option value={5}>A-E</option>
            </select>
          </label>
          <label style={st.label}>Los fallos
            <select value={cfg.penalizacion} onChange={(e) => set({ penalizacion: Number(e.target.value) })} style={st.input}>
              <option value={0}>No restan</option>
              {cfg.nOpciones > 2 && <option value={1 / (cfg.nOpciones - 1)}>Restan 1/{cfg.nOpciones - 1} (compensa el azar)</option>}
              <option value={0.25}>Restan 0,25</option>
              <option value={0.5}>Restan 0,5</option>
              <option value={1}>Restan 1</option>
            </select>
          </label>
        </div>
        {cfg.preguntas && (
          <p style={st.ayuda}>📚 Preguntas de «{cfg.recursoTitulo}» ({cfg.preguntas.length}). <button style={st.enlace} onClick={() => set({ preguntas: null, recursoTitulo: '' })}>Quitar el recurso</button></p>
        )}
      </section>

      <section style={st.panel}>
        <div style={{ ...st.fila, justifyContent: 'space-between' }}>
          <h3 style={{ ...st.h3, margin: 0 }}>🔑 Clave de respuestas <span style={{ color: nClave === cfg.nPreguntas ? '#16a34a' : '#b45309', fontSize: 14 }}>({nClave}/{cfg.nPreguntas})</span></h3>
          <div style={st.fila}>
            <button style={st.btnSec} onClick={onEscanearClave}>📷 Escanear mi hoja rellenada</button>
            <button style={st.btnSec} onClick={() => setVerRecurso((v) => !v)}>📚 Sacarla de un recurso</button>
          </div>
        </div>
        {verRecurso && (
          <div style={st.cajaOscura}>
            <Suspense fallback={<p>Cargando recursos…</p>}>
              <SelectorRecursoMandos seleccionado={recurso} contar={false} onPick={(r) => { setRecurso(r); setHojaSel(-1); }} />
            </Suspense>
            {recurso && (
              <div style={{ ...st.fila, marginTop: 10, color: '#e2e8f0' }}>
                <b style={{ color: '#facc15' }}>✔ {recurso.titulo}</b>
                {hojas.length > 1 && (
                  <select value={hojaSel} onChange={(e) => setHojaSel(Number(e.target.value))} style={st.input}>
                    <option value={-1}>Todas las hojas</option>
                    {hojas.map((h, i) => <option key={i} value={i}>{h.nombre} ({h.preguntas.length})</option>)}
                  </select>
                )}
                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={aleatorio} onChange={(e) => setAleatorio(e.target.checked)} /> Orden aleatorio</label>
                <span>{Math.min(MAX_PREGUNTAS, disponibles.length)} preguntas de opción múltiple</span>
                {cortas.length > 0 && <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={conCortas} onChange={(e) => setConCortas(e.target.checked)} /> y {cortas.length} de respuesta corta como respuestas escritas</label>}
                <button style={st.btnPrim} disabled={!disponibles.length && !(conCortas && cortas.length)} onClick={usarRecurso}>Usar estas preguntas</button>
              </div>
            )}
          </div>
        )}
        <div style={st.claveGrid}>
          {Array.from({ length: cfg.nPreguntas }, (_, q) => (
            <div key={q} style={st.claveFila}>
              <b style={{ width: 26, textAlign: 'right', color: '#475569' }}>{q + 1}</b>
              {LETRAS.slice(0, cfg.nOpciones).map((l) => (
                <button key={l} onClick={() => ponerLetra(q, l)} style={st.letraClave(cfg.clave[q] === l)}>{l}</button>
              ))}
            </div>
          ))}
        </div>
        <div style={{ ...st.fila, marginTop: 10 }}>
          <input value={textoClave} onChange={(e) => setTextoClave(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && aplicarTexto()} placeholder="O escríbela seguida: ABDCA BCADB…" style={{ ...st.input, flex: 1, minWidth: 200, fontFamily: 'monospace', letterSpacing: 2 }} />
          <button style={st.btnSec} onClick={aplicarTexto}>Poner</button>
          <button style={st.btnSec} onClick={() => set({ clave: Array(MAX_PREGUNTAS).fill('') })}>Borrar clave</button>
        </div>
        <p style={st.ayuda}>Una pregunta sin clave no cuenta (sirve para anular una pregunta mal planteada).</p>
      </section>

      <section style={st.panel}>
        <h3 style={st.h3}>✍️ Respuestas escritas <span style={{ fontWeight: 600, fontSize: 13, color: '#64748b' }}>(palabras o números en casillas, una MAYÚSCULA por casilla)</span></h3>
        <div style={st.fila}>
          <label style={st.label}>Cuántas
            <input type="number" min={0} max={capacidad} value={cfg.nEscritas || 0} onChange={(e) => set({ nEscritas: Math.max(0, Math.min(capacidad, Number(e.target.value) || 0)), nPreguntas: Math.max(Number(e.target.value) > 0 ? 0 : 1, cfg.nPreguntas) })} style={{ ...st.input, width: 80 }} />
          </label>
          <label style={st.label}>Casillas por respuesta
            <select value={cfg.letras || 8} onChange={(e) => set({ letras: Number(e.target.value) })} style={st.input}>
              <option value={8}>8 (dos columnas)</option>
              <option value={12}>12</option>
              <option value={16}>16</option>
            </select>
          </label>
          <span style={st.ayuda}>Con {cfg.nPreguntas} preguntas tipo test caben <b>{capacidad}</b>.{capacidad < 4 && cfg.nPreguntas > 0 ? ' Para que quepan más, baja el nº de preguntas tipo test.' : ''}</span>
        </div>
        {(cfg.nEscritas || 0) > 0 && (
          <div style={st.claveGrid}>
            {Array.from({ length: cfg.nEscritas }, (_, k) => {
              const t = normalizarRespuesta(String(cfg.claveEscritas?.[k] || '').split('/')[0]);
              const larga = t.length > (cfg.letras || 8);
              return (
                <label key={k} style={st.claveFila}>
                  <b style={{ width: 26, textAlign: 'right', color: '#475569' }}>{cfg.nPreguntas + k + 1}</b>
                  <input value={cfg.claveEscritas?.[k] || ''} onChange={(e) => ponerEscrita(k, e.target.value.slice(0, 60))} placeholder={k === 0 ? 'PARIS (o varias: PARIS / PARÍS)' : 'respuesta'}
                    style={{ ...st.input, flex: 1, minWidth: 0, textTransform: 'uppercase', borderColor: larga ? '#dc2626' : '#cbd5e1' }} title={larga ? 'No cabe en las casillas' : ''} />
                </label>
              );
            })}
          </div>
        )}
        <p style={st.ayuda}>
          Se reconocen letras y números escritos a mano en este dispositivo (sin internet). La respuesta se <b>compara con la tuya</b>:
          las que no están claras se marcan «a revisar» y las decides tú con un toque viendo lo que escribió. Las tildes no cuentan
          (PARÍS = PARIS) y los fallos escritos no restan. <b>Números</b>: enteros, negativos y decimales; el signo − y la coma
          ocupan su casilla, y valen igual -3,5, -3.5 y -3,50.
        </p>
      </section>

      <section style={st.panel}>
        <h3 style={st.h3}>🖨️ Imprimir</h3>
        <div style={st.fila}>
          <button style={st.btnPrim} onClick={() => pdf('hoja')} disabled={!!generando}>{generando === 'hoja' ? 'Creando…' : '📄 Hoja de respuestas (para fotocopiar)'}</button>
          {cfg.preguntas && <button style={st.btnPrim} onClick={() => pdf('examen')} disabled={!!generando}>{generando === 'examen' ? 'Creando…' : '📝 Examen con preguntas + hoja'}</button>}
          {cfg.preguntas && <button style={st.btnSec} onClick={() => pdf('soloExamen')} disabled={!!generando}>Solo las preguntas</button>}
          <button style={st.btnSec} onClick={() => pdf('personal')} disabled={!!generando || !alumnos.length} title={alumnos.length ? '' : 'Elige un grupo o escribe los nombres en Resultados'}>
            {generando === 'personal' ? 'Creando…' : `👥 Una hoja por alumno con nombre y nº ya marcado (${alumnos.length})`}
          </button>
        </div>
        <div style={{ ...st.fila, marginTop: 10 }}>
          <label style={st.check}><input type="checkbox" checked={conClave} onChange={(e) => setConClave(e.target.checked)} /> Añadir una página con la clave (para el profe)</label>
          <BotonGrupoDispositivo onUsar={(g) => setNombres(Object.fromEntries((g?.alumnos || []).slice(0, 99).map((a, i) => [i + 1, a])))} />
        </div>
        <p style={st.ayuda}>Imprime al 100 % o «ajustar a página», da igual; lo importante es que se vean bien los 4 cuadros negros de las esquinas.</p>
      </section>

      <div style={{ textAlign: 'center' }}>
        <button style={{ ...st.btnPrim, fontSize: 18, padding: '14px 28px' }} disabled={!nClave} onClick={onListo}>
          {nClave ? 'Corregir con la cámara →' : 'Pon la clave para empezar a corregir'}
        </button>
      </div>
    </div>
  );
}

// ───────────────────────── 2 · Corregir ─────────────────────────
const MOTIVOS = {
  marcas: (v) => `Encuadra la hoja entera: veo ${v} de las 4 esquinas negras (hacen falta 3).`,
  lejos: () => 'Acércate un poco más a la hoja.',
  fuera: () => 'Una parte de la hoja se sale de la imagen.',
};

const LS_FUENTE = 'pikt_corrector_fuente';
function Corregir({ cfg, clave, modo, setModo, nombre, resultados, onClave, onHoja, onVerResultados, movil, prepararHoja, notaHoja }) {
  // De dónde salen las hojas: cámara de este dispositivo, móvil conectado o archivos
  const [fuente, setFuente] = useState(() => leerLS(LS_FUENTE, 'camara'));
  useEffect(() => guardarLS(LS_FUENTE, fuente), [fuente]);
  useEffect(() => { if (fuente === 'movil') movil.crear(); }, [fuente]); // eslint-disable-line react-hooks/exhaustive-deps
  const [estado, setEstado] = useState({ tipo: 'info', texto: 'Enfoca una hoja con la cámara.' });
  const [ultima, setUltima] = useState(null); // última hoja aceptada (para el cartel)
  const lecturaRef = useRef(null); // { r, t, puntos }
  const rachaRef = useRef({ clave: '', n: 0 });
  const bloqueoRef = useRef({ hasta: 0, firma: '' });
  const resultadosRef = useRef(resultados);
  resultadosRef.current = resultados;
  const escritasRef = useRef({ firma: '', escritas: null });
  const procesandoRef = useRef(false); // leyendo las casillas escritas (no se acepta otra hoja mientras)
  const estadoRef = useRef('');
  const ponerEstado = (tipo, texto) => {
    const k = tipo + texto;
    if (estadoRef.current === k) return;
    estadoRef.current = k;
    setEstado({ tipo, texto });
  };

  useEffect(() => { despertarAudio(); }, []);

  const onFotograma = useCallback((img, dets) => {
    const marcas = dets.filter((d) => IDS_MARCAS.has(d.tarjeta));
    if (marcas.length < 3) {
      lecturaRef.current = null;
      rachaRef.current = { clave: '', n: 0 };
      if (Date.now() > bloqueoRef.current.hasta) ponerEstado('info', marcas.length ? MOTIVOS.marcas(marcas.length) : 'Enfoca una hoja con la cámara (que se vean las 4 esquinas).');
      return;
    }
    if (procesandoRef.current) return;
    const r = leerHoja(img, marcas, cfg, aGris(img));
    if (!r.ok) { lecturaRef.current = null; ponerEstado('info', MOTIVOS[r.motivo]?.(r.vistas.length) || 'No leo la hoja.'); return; }
    // Misma lectura en 3 fotogramas seguidos → se acepta
    const firma = `${modo === 'clave' ? 'K' : r.lista}|${r.respuestas.join(',')}`;
    // Mientras siga a la vista la hoja ya corregida, se mantienen los colores de sus respuestas escritas
    lecturaRef.current = { r, t: Date.now(), escritas: escritasRef.current.firma === firma ? escritasRef.current.escritas : null };
    const racha = rachaRef.current;
    if (racha.clave === firma) racha.n++; else rachaRef.current = { clave: firma, n: 1 };
    if (rachaRef.current.n < 3) { if (Date.now() > bloqueoRef.current.hasta) ponerEstado('leyendo', 'Leyendo… no muevas el móvil'); return; }
    if (firma === bloqueoRef.current.firma) return; // ya aceptada: hasta que cambie la hoja

    if (modo === 'clave') {
      bloqueoRef.current = { hasta: Date.now() + 1500, firma };
      sonidoCorrecto();
      const resp = r.respuestas.map((x) => (x === '*' ? '' : x));
      if (!hayEscritas(cfg)) { onClave(resp); return; }
      procesandoRef.current = true;
      ponerEstado('leyendo', '✍️ Leyendo las respuestas escritas de la clave…');
      leerEscritas(r, cfg, () => false)
        .then((esc) => onClave(resp, textosLeidos(esc)))
        .catch(() => { onClave(resp); ponerEstado('error', 'No se pudo cargar el lector de letras: escribe las respuestas escritas a mano en «Preparar».'); })
        .finally(() => { procesandoRef.current = false; });
      return;
    }
    if (!r.lista) { ponerEstado('error', 'No leo el nº de lista: que rellene un círculo de las decenas (0 si es menor de 10) y otro de las unidades.'); return; }
    const previa = resultadosRef.current[r.lista];
    if (previa && previa.respuestas.join(',') === r.respuestas.join(',')) {
      bloqueoRef.current = { hasta: Date.now() + 1200, firma };
      ponerEstado('repetida', `Nº ${r.lista} ya estaba corregida ✓`);
      return;
    }
    bloqueoRef.current = { hasta: Date.now() + 2500, firma };
    procesandoRef.current = true;
    if (hayEscritas(cfg)) ponerEstado('leyendo', '✍️ Leyendo las respuestas escritas…');
    prepararHoja(r)
      .then((h) => {
        const p = notaHoja(h);
        (p.nota >= 5 ? sonidoCorrecto : sonidoIncorrecto)();
        onHoja(h);
        escritasRef.current = { firma, escritas: p.escritasEst };
        lecturaRef.current = { r, t: Date.now(), escritas: p.escritasEst };
        setUltima({ lista: r.lista, ...p, dudosas: r.dudosas, reescaneada: !!previa });
        ponerEstado('ok', '');
      })
      .catch(() => ponerEstado('error', 'No se pudo cargar el lector de letras (¿sin internet la primera vez?). Vuelve a enfocar la hoja.'))
      .finally(() => { bloqueoRef.current.hasta = Date.now() + 2500; procesandoRef.current = false; });
  }, [cfg, modo, onClave, onHoja, prepararHoja, notaHoja]);

  // Círculos de colores sobre la hoja (ver dibujo.js)
  const pintarExtra = useCallback((ctx, ex) => {
    const L = lecturaRef.current;
    if (!L || Date.now() - L.t > 700) return;
    pintarLectura(ctx, L.r, { nPreguntas: cfg.nPreguntas, nOpciones: cfg.nOpciones, nEscritas: cfg.nEscritas || 0, letras: cfg.letras || 8, escritas: L.escritas || null, clave: modo === 'clave' ? null : clave, ex });
  }, [cfg.nPreguntas, cfg.nOpciones, cfg.nEscritas, cfg.letras, clave, modo]);

  const enCartel = ultima && estado.tipo === 'ok';
  const nHojas = Object.keys(resultados).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ ...st.fila, justifyContent: 'space-between' }}>
        <div style={st.fila}>
          <button style={st.tabMini(modo === 'alumnos')} onClick={() => setModo('alumnos')}>👩‍🎓 Hojas de alumnos</button>
          <button style={st.tabMini(modo === 'clave')} onClick={() => setModo('clave')}>🔑 Leer la clave</button>
        </div>
        <button style={st.btnSec} onClick={onVerResultados}>📊 {nHojas} {nHojas === 1 ? 'hoja corregida' : 'hojas corregidas'} →</button>
      </div>
      <div style={st.fuentes}>
        {[['camara', '📷 Esta cámara'], ['movil', '📱 Móvil conectado'], ['archivos', '🖼️ Fotos o vídeo']].map(([k, t]) => (
          <button key={k} style={st.fuente(fuente === k)} onClick={() => setFuente(k)}>{t}</button>
        ))}
      </div>
      {modo === 'clave' && <div style={st.explica}>Enfoca <b>tu</b> hoja con las respuestas correctas rellenadas. Se apuntará como clave ({cfg.nPreguntas} preguntas).</div>}

      {fuente === 'movil' && <PanelMovil movil={movil} nombre={nombre} />}
      {fuente === 'archivos' && (
        <Suspense fallback={<p>Cargando…</p>}>
          <SubirArchivos cfg={cfg} clave={clave} modo={modo} onHoja={onHoja} onClave={onClave} nombre={nombre} prepararHoja={prepararHoja} notaHoja={notaHoja} />
        </Suspense>
      )}
      {fuente === 'camara' && <>
      <div style={{ position: 'relative' }}>
        <CamaraTarjetas activo maxTarjeta={64} onDetecciones={null} etiqueta={() => ({ texto: '', color: '#38bdf8' })}
          onFotograma={onFotograma} pintarExtra={pintarExtra} alto="62vh" compacta
          textoContador={(n) => `📄 ${Math.min(4, n)}/4 esquinas de la hoja`} />
        {enCartel && (
          <div style={st.cartel(ultima.nota >= 5)}>
            <div style={{ fontSize: 15, opacity: 0.9 }}>Nº {ultima.lista}{nombre(ultima.lista) ? ` · ${nombre(ultima.lista)}` : ''}{ultima.reescaneada ? ' (otra vez)' : ''}</div>
            <div style={{ fontSize: 40, fontWeight: 900, lineHeight: 1.1 }}>{String(ultima.nota).replace('.', ',')}</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>✅ {ultima.aciertos} · ❌ {ultima.fallos} · ⚪ {ultima.blancos}{ultima.dobles ? ` · ⚠️ ${ultima.dobles} dobles` : ''}{ultima.pendientes ? ` · 🔍 ${ultima.pendientes} por revisar` : ''}</div>
            {ultima.dudosas?.length > 0 && <div style={{ fontSize: 12, marginTop: 4 }}>Revisa a mano: {ultima.dudosas.map((q) => q + 1).join(', ')} (marca floja o borrada)</div>}
          </div>
        )}
      </div>
      <div style={st.estado(estado.tipo)}>
        {estado.tipo === 'ok' ? '✅ Hoja corregida. Pasa a la siguiente.' : estado.texto}
      </div>
      <ul style={{ ...st.ayuda, paddingLeft: 18, margin: 0 }}>
        <li>Pon la hoja sobre la mesa, con buena luz y sin sombras encima. Que se vean las 4 esquinas negras.</li>
        <li>Verde = bien · rojo = mal (con la buena marcada) · naranja = en blanco · morado = doble marca.</li>
        <li>Si vuelves a escanear una hoja, se queda la última lectura.</li>
      </ul>
      </>}
    </div>
  );
}

/** QR y estado del móvil conectado (la sesión vive en useSesionMovil). */
function PanelMovil({ movil, nombre }) {
  const { codigo, creando, error, conectado, recibidas, crear } = movil;
  const url = codigo ? urlCorrectorMovil(codigo) : '';
  const qr = url ? 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(url) + '&bgcolor=ffffff&color=0f172a&margin=8' : '';
  return (
    <div style={{ ...st.panel, display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-start' }}>
      <div style={{ textAlign: 'center', minWidth: 240, flex: '0 0 auto' }}>
        {creando && <p>Creando la sesión…</p>}
        {error && <><p style={{ color: '#dc2626', fontWeight: 700 }}>{error}</p><button style={st.btnPrim} onClick={crear}>Reintentar</button></>}
        {codigo && <>
          <img src={qr} alt={'QR ' + codigo} width={220} height={220} style={{ borderRadius: 12, border: '1px solid #e2e8f0' }} />
          <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: 5 }}>{codigo}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{window.location.host}/?corregir={codigo}</div>
          <div style={{ marginTop: 6, fontWeight: 800, color: conectado ? '#15803d' : '#b45309' }}>{conectado ? '✅ Móvil conectado' : '⏳ Esperando al móvil…'}</div>
        </>}
      </div>
      <div style={{ flex: 1, minWidth: 240 }}>
        <h3 style={st.h3}>📱 El móvil como cámara</h3>
        <ol style={{ ...st.ayuda, paddingLeft: 18, margin: 0 }}>
          <li>Escanea el QR con el móvil (o abre la dirección de debajo).</li>
          <li>Enfoca las hojas una a una: el móvil manda el nº de lista y las respuestas, este ordenador pone la nota y se la devuelve.</li>
          <li>La tabla se va llenando en «3 · Resultados» aunque cambies de pestaña.</li>
        </ol>
        <p style={st.ayuda}>Por internet solo viajan números y letras: ni fotos, ni la clave, ni los nombres.</p>
        {recibidas.length > 0 && <>
          <h4 style={{ margin: '12px 0 6px' }}>Últimas hojas recibidas</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {recibidas.map((h) => (
              <div key={h.id} style={st.recibida}>
                {h.clave ? <b>🔑 Clave recibida</b> : <>
                  <b style={{ width: 54 }}>Nº {h.lista}</b>
                  <span style={{ flex: 1 }}>{nombre(h.lista)}</span>
                  <span>✅ {h.aciertos} ❌ {h.fallos} ⚪ {h.blancos}{h.dudosas?.length ? ' ⚠' : ''}</span>
                  <b style={{ width: 40, textAlign: 'right', color: h.nota >= 5 ? '#16a34a' : '#dc2626' }}>{String(h.nota).replace('.', ',')}</b>
                </>}
              </div>
            ))}
          </div>
        </>}
      </div>
    </div>
  );
}

// ───────────────────────── 3 · Resultados ─────────────────────────
const TXT_ESTADO = { bien: '✓', mal: '✗', blanco: '—', dudosa: '?', anulada: 'sin clave' };

/** Una respuesta escrita para revisar: lo que escribió (imagen), lo esperado y botones ✔ / ✘. */
function RevisarEscrita({ f, k, cfg, nombre, onRevisar, compacta = false }) {
  const e = f.escritasEst[k];
  const img = f.escritas?.[k]?.img;
  return (
    <div style={{ ...st.revision, borderColor: COLOR[e.estado] || '#cbd5e1' }}>
      <div style={{ fontSize: 13 }}>
        {!compacta && <b>Nº {f.lista}{nombre(f.lista) ? ' · ' + nombre(f.lista) : ''} · </b>}
        <b>P{cfg.nPreguntas + k + 1}</b> · esperado <b>{String(cfg.claveEscritas?.[k] || '—').toUpperCase()}</b>
        {e.leida ? <> · leído <b style={{ fontFamily: 'monospace' }}>{e.leida}</b></> : null}
        {e.manual && <span style={{ color: '#64748b' }}> (corregida a mano)</span>}
      </div>
      {img ? <img src={img} alt="Lo que escribió" style={{ maxWidth: '100%', height: 44, objectFit: 'contain', alignSelf: 'flex-start', background: '#fff', borderRadius: 6 }} />
        : <span style={st.ayuda}>{e.estado === 'dudosa' ? 'Sin imagen (leída con el móvil): mírala en la hoja.' : ''}</span>}
      <div style={{ display: 'flex', gap: 6 }}>
        <button style={{ ...st.mini, background: e.estado === 'bien' ? '#16a34a' : '#fff', color: e.estado === 'bien' ? '#fff' : '#0f172a' }} onClick={() => onRevisar(f.lista, k, 'bien')}>✔ Bien</button>
        <button style={{ ...st.mini, background: e.estado === 'mal' ? '#dc2626' : '#fff', color: e.estado === 'mal' ? '#fff' : '#0f172a' }} onClick={() => onRevisar(f.lista, k, 'mal')}>✘ Mal</button>
        {e.manual && <button style={st.mini} onClick={() => onRevisar(f.lista, k, null)}>↺ Automático</button>}
      </div>
    </div>
  );
}

function Resultados({ cfg, clave, filas, nombre, nombres, setNombres, onBorrar, onNueva, onSeguir, onRevisar }) {
  // Cola de respuestas escritas dudosas (las decide el profe)
  const porRevisar = filas.flatMap((f) => (f.escritasEst || []).map((e, k) => ({ f, k, e })).filter(({ e }) => e.estado === 'dudosa'));
  const [verRevision, setVerRevision] = useState(true);
  const [abierta, setAbierta] = useState(null);
  const n = filas.length;
  const media = n ? filas.reduce((s, f) => s + f.nota, 0) / n : 0;
  const aprobados = filas.filter((f) => f.nota >= 5).length;
  const porPregunta = clave.map((c, q) => {
    if (!c || !n) return null;
    const ok = filas.filter((f) => f.respuestas[q] === c).length;
    return Math.round((ok / n) * 100);
  });

  const csv = () => {
    const nE = cfg.nEscritas || 0;
    const cabE = Array.from({ length: nE }, (_, k) => `P${cfg.nPreguntas + k + 1} (escrita)`);
    const cab = ['Nº lista', 'Nombre', 'Aciertos', 'Fallos', 'En blanco', 'Dobles', 'Por revisar', 'Nota', ...clave.map((_, q) => `P${q + 1}`), ...cabE];
    const lineas = filas.map((f) => [f.lista, nombre(f.lista), f.aciertos, f.fallos, f.blancos, f.dobles, f.pendientes || 0, String(f.nota).replace('.', ','),
      ...clave.map((_, q) => f.respuestas[q] || ''),
      ...(f.escritasEst || []).map((e) => (e.leida ? `${e.leida} ${TXT_ESTADO[e.estado] || ''}` : TXT_ESTADO[e.estado] || ''))]);
    lineas.push(['', 'CLAVE', '', '', '', '', '', '', ...clave, ...Array.from({ length: nE }, (_, k) => String(cfg.claveEscritas?.[k] || '').toUpperCase())]);
    const txt = [cab, ...lineas].map((l) => l.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' }));
    a.download = `${(cfg.titulo || 'correccion').replace(/[^\wáéíóúñ -]+/gi, '').trim() || 'correccion'}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  if (!n) {
    return (
      <div style={{ ...st.panel, textAlign: 'center' }}>
        <p>Todavía no hay hojas corregidas.</p>
        <button style={st.btnPrim} onClick={onSeguir}>📷 Empezar a corregir</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={st.resumen}>
        <div><b style={{ fontSize: 26 }}>{n}</b><br />hojas</div>
        <div><b style={{ fontSize: 26 }}>{media.toFixed(1).replace('.', ',')}</b><br />nota media</div>
        <div><b style={{ fontSize: 26, color: '#16a34a' }}>{aprobados}</b><br />aprobados</div>
        <div><b style={{ fontSize: 26, color: '#dc2626' }}>{n - aprobados}</b><br />suspensos</div>
      </div>

      {porRevisar.length > 0 && (
        <section style={{ ...st.panel, borderColor: '#c4b5fd', background: '#faf5ff' }}>
          <div style={{ ...st.fila, justifyContent: 'space-between' }}>
            <h3 style={{ ...st.h3, margin: 0 }}>🔍 {porRevisar.length} {porRevisar.length === 1 ? 'respuesta escrita' : 'respuestas escritas'} por revisar</h3>
            <button style={st.mini} onClick={() => setVerRevision((v) => !v)}>{verRevision ? 'Ocultar' : 'Revisar'}</button>
          </div>
          <p style={st.ayuda}>No está claro si coincide con la respuesta: decide tú. Hasta entonces no suman (la nota puede subir).</p>
          {verRevision && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8, marginTop: 8 }}>
              {porRevisar.map(({ f, k }) => <RevisarEscrita key={f.lista + '-' + k} f={f} k={k} cfg={cfg} nombre={nombre} onRevisar={onRevisar} />)}
            </div>
          )}
        </section>
      )}

      <section style={st.panel}>
        <div style={{ overflowX: 'auto' }}>
          <table style={st.tabla}>
            <thead>
              <tr>{['Nº', 'Nombre', '✅', '❌', '⚪', 'Nota', ''].map((h, i) => <th key={i} style={st.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <React.Fragment key={f.lista}>
                  <tr>
                    <td style={st.td}><b>{f.lista}</b></td>
                    <td style={st.td}>
                      <input data-nombres-grupo="si" value={nombres[f.lista] ?? ''} placeholder={nombre(f.lista) || `Nombre del nº ${f.lista}`}
                        onChange={(e) => setNombres((p) => ({ ...p, [f.lista]: e.target.value }))} style={st.inputTabla} />
                    </td>
                    <td style={st.td}>{f.aciertos}</td>
                    <td style={st.td}>{f.fallos}{f.dobles ? <span title="dobles marcas" style={{ color: COLOR.doble }}> ({f.dobles}⚠)</span> : ''}</td>
                    <td style={st.td}>{f.blancos}</td>
                    <td style={{ ...st.td, fontWeight: 900, color: f.nota >= 5 ? '#16a34a' : '#dc2626' }}>{String(f.nota).replace('.', ',')}{f.dudosas?.length ? <span title="Hay marcas dudosas" style={{ color: '#b45309' }}> ⚠</span> : ''}{f.pendientes ? <span title="Respuestas escritas por revisar" style={{ color: COLOR.dudosa }}> 🔍{f.pendientes}</span> : ''}</td>
                    <td style={{ ...st.td, whiteSpace: 'nowrap' }}>
                      <button style={st.mini} onClick={() => setAbierta(abierta === f.lista ? null : f.lista)}>{abierta === f.lista ? 'Ocultar' : 'Ver'}</button>
                      <button style={st.mini} onClick={() => window.confirm(`¿Quitar la hoja del nº ${f.lista}?`) && onBorrar(f.lista)}>🗑</button>
                    </td>
                  </tr>
                  {abierta === f.lista && (
                    <tr><td colSpan={7} style={{ ...st.td, background: '#f8fafc' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {f.detalle.map((d, q) => (
                          <span key={q} title={`Clave: ${clave[q] || '—'}`} style={{ ...st.chip, background: COLOR[d] }}>
                            {q + 1}: {f.respuestas[q] === '*' ? '2+' : f.respuestas[q] || '—'}{d === 'mal' ? ` (${clave[q]})` : ''}
                          </span>
                        ))}
                      </div>
                      {f.dudosas?.length > 0 && <p style={st.ayuda}>⚠ Marcas dudosas (flojas o borradas) en: {f.dudosas.map((q) => q + 1).join(', ')}. Compruébalas en la hoja.</p>}
                      {(f.escritasEst || []).length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {f.escritasEst.map((e, k) => (
                              <span key={k} title={'Esperado: ' + String(cfg.claveEscritas?.[k] || '—').toUpperCase()} style={{ ...st.chip, background: COLOR[e.estado] || '#64748b' }}>
                                {cfg.nPreguntas + k + 1}: {e.leida || '—'} {TXT_ESTADO[e.estado]}{e.manual ? ' ✋' : ''}
                              </span>
                            ))}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 6, marginTop: 6 }}>
                            {f.escritasEst.map((e, k) => (e.estado !== 'anulada' && e.estado !== 'blanco' && (f.escritas?.[k]?.img || e.manual || e.estado !== 'bien')
                              ? <RevisarEscrita key={k} f={f} k={k} cfg={cfg} nombre={nombre} onRevisar={onRevisar} compacta /> : null))}
                          </div>
                        </div>
                      )}
                    </td></tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={st.panel}>
        <h3 style={st.h3}>Aciertos por pregunta</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {porPregunta.map((pct, q) => (
            <span key={q} style={{ ...st.chip, background: pct === null ? COLOR.anulada : pct >= 70 ? '#15803d' : pct >= 40 ? '#a16207' : '#b91c1c' }} title={clave[q] ? `Clave ${clave[q]}` : 'Sin clave'}>
              P{q + 1}: {pct === null ? '—' : `${pct}%`}
            </span>
          ))}
        </div>
        <p style={st.ayuda}>En rojo, las que menos ha acertado la clase: buenas candidatas para repasar.</p>
      </section>

      <div style={{ ...st.fila, justifyContent: 'center' }}>
        <button style={st.btnPrim} onClick={onSeguir}>📷 Seguir corrigiendo</button>
        <button style={st.btnSec} onClick={csv}>⬇️ Descargar CSV (Excel)</button>
        <GuardarResultadosMandos
          tipo="CORRECTOR" juego="Corrector de exámenes" modalidad="Hoja de respuestas (cámara)" claveNombres={LS_NOMBRES}
          recursoTitulo={cfg.titulo || cfg.recursoTitulo || ''}
          config={{ preguntas: cfg.nPreguntas, escritas: cfg.nEscritas || 0, opciones: LETRAS.slice(0, cfg.nOpciones).join(''), penalizacion: cfg.penalizacion }}
          jugadores={filas.map((f) => ({ id: f.lista, nombre: nombre(f.lista), aciertos: f.aciertos, intentos: f.validas, fallos: f.fallos, puntos: f.nota, extra: { nota: f.nota, blancos: f.blancos, porRevisar: f.pendientes || 0, respuestas: f.respuestas.join('') || '', escritas: (f.escritasEst || []).map((e) => e.leida || '-').join(' ') } }))}
          estilo={{ padding: '10px 16px' }}
        />
        <button style={st.btnSec} onClick={onNueva}>🧹 Nueva corrección</button>
      </div>
    </div>
  );
}

const st = {
  wrapper: { display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', background: '#f1f5f9', fontFamily: 'system-ui, sans-serif', color: '#0f172a', overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: '#0f766e', color: '#fff' },
  backBtn: { padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.5)', background: 'transparent', color: '#fff', fontWeight: 700, cursor: 'pointer' },
  title: { margin: 0, fontSize: 18, fontWeight: 800, flex: 1 },
  tabs: { display: 'flex', gap: 4, padding: '8px 12px 0', background: '#fff', borderBottom: '1px solid #e2e8f0', overflowX: 'auto' },
  tab: (on) => ({ padding: '9px 14px', border: 'none', borderBottom: `3px solid ${on ? '#0f766e' : 'transparent'}`, background: 'transparent', fontWeight: 800, color: on ? '#0f766e' : '#64748b', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 14 }),
  scroll: { flex: 1, overflow: 'auto', padding: '14px 12px 40px', maxWidth: 1000, width: '100%', margin: '0 auto', boxSizing: 'border-box' },
  explica: { background: '#ecfeff', border: '1px solid #a5f3fc', borderRadius: 12, padding: '10px 14px', fontSize: 14, lineHeight: 1.5 },
  panel: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 16 },
  cajaOscura: { background: '#0f172a', borderRadius: 12, padding: 12, marginTop: 10 },
  h3: { margin: '0 0 10px', fontSize: 17 },
  fila: { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#475569', fontWeight: 600 },
  input: { padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 15, background: '#fff', color: '#0f172a', fontFamily: 'inherit' },
  ayuda: { color: '#64748b', fontSize: 13, lineHeight: 1.5, margin: '8px 0 0' },
  check: { display: 'flex', gap: 6, alignItems: 'center', fontSize: 14, cursor: 'pointer' },
  enlace: { background: 'none', border: 'none', color: '#0f766e', fontWeight: 800, textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: 'inherit' },
  btnPrim: { padding: '10px 16px', borderRadius: 10, border: 'none', background: '#0f766e', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' },
  btnSec: { padding: '9px 14px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', fontWeight: 700, fontSize: 14, cursor: 'pointer' },
  tabMini: (on) => ({ padding: '8px 12px', borderRadius: 10, border: `2px solid ${on ? '#0f766e' : '#cbd5e1'}`, background: on ? '#ccfbf1' : '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }),
  claveGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '4px 16px', marginTop: 12 },
  claveFila: { display: 'flex', alignItems: 'center', gap: 5 },
  letraClave: (on) => ({ width: 34, height: 30, borderRadius: 999, border: `2px solid ${on ? '#0f766e' : '#cbd5e1'}`, background: on ? '#0f766e' : '#fff', color: on ? '#fff' : '#64748b', fontWeight: 800, cursor: 'pointer', fontSize: 13 }),
  cartel: (ok) => ({ position: 'absolute', left: '50%', bottom: 40, transform: 'translateX(-50%)', background: ok ? 'rgba(22,163,74,0.93)' : 'rgba(220,38,38,0.93)', color: '#fff', borderRadius: 16, padding: '10px 22px', textAlign: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.35)', minWidth: 200, pointerEvents: 'none' }),
  estado: (tipo) => ({ textAlign: 'center', fontWeight: 800, fontSize: 15, padding: '8px 10px', borderRadius: 10, background: tipo === 'ok' ? '#dcfce7' : tipo === 'error' ? '#fee2e2' : tipo === 'repetida' ? '#e0f2fe' : tipo === 'leyendo' ? '#fef9c3' : '#e2e8f0', color: '#0f172a' }),
  resumen: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, textAlign: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 12, fontSize: 13, color: '#475569' },
  tabla: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: { textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: 13 },
  td: { padding: '6px 8px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' },
  inputTabla: { width: '100%', minWidth: 120, border: 'none', borderBottom: '1px solid #e2e8f0', padding: '4px 2px', fontSize: 14, background: 'transparent', fontFamily: 'inherit' },
  mini: { padding: '4px 8px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 12, marginRight: 4 },
  chip: { color: '#fff', fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 99 },
  fuentes: { display: 'flex', gap: 6, flexWrap: 'wrap', background: '#e2e8f0', padding: 4, borderRadius: 12 },
  fuente: (on) => ({ flex: 1, minWidth: 120, padding: '9px 10px', borderRadius: 9, border: 'none', background: on ? '#fff' : 'transparent', boxShadow: on ? '0 1px 4px rgba(0,0,0,0.15)' : 'none', fontWeight: 800, color: on ? '#0f766e' : '#475569', cursor: 'pointer', fontSize: 14 }),
  recibida: { display: 'flex', gap: 10, alignItems: 'center', background: '#f8fafc', borderRadius: 8, padding: '6px 10px', fontSize: 14 },
  revision: { display: 'flex', flexDirection: 'column', gap: 6, background: '#fff', border: '2px solid', borderRadius: 10, padding: 8 },
  toast: { position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: '#0f172a', color: '#fff', padding: '10px 18px', borderRadius: 12, fontWeight: 700, zIndex: 50 },
};
