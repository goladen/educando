// Lengua de signos con la webcam:
//   · ModoEscribirMano  → reconoce letras del alfabeto dactilológico y las va escribiendo.
//   · ModoEnseniarSignos → asistente para que alguien que sepa signar grabe los ejemplos
//     (con la cámara o desde fotos) y los descargue para publicarlos.
// El reconocimiento está en ./signos.js; la cámara y el detector en ./manosVision.js.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import VistaManos from './VistaManos.jsx';
import { escucharManos, detectarManosEnImagen } from './manosVision.js';
import {
  LETRAS_SIGNOS,
  NUMEROS_SIGNOS,
  normalizarMano,
  crearClasificador,
  aumentarMuestra,
  leerEjemplosLocales,
  guardarEjemplosLocales,
  cargarEjemplosOficiales,
  unirEjemplos,
  descargarEjemplos,
  leerArchivoEjemplos,
} from './signos.js';

const LS_PREFS = 'pikt_signos_prefs';
const MIN_CONFIANZA = 0.6;
const ESPACIO_SIN_MANO_MS = 1500;
const OBJETIVO = 30; // ejemplos por letra al grabar
const GRABAR_MAX_MS = 6000;
const VELOCIDADES = [
  { id: 'lento', label: '🐢 Despacio', ms: 1300 },
  { id: 'normal', label: '🙂 Normal', ms: 900 },
  { id: 'rapido', label: '🐇 Rápido', ms: 600 },
];

const AZUL = '#2563EB';

function leerPrefs() {
  try {
    return { zurdo: false, velocidad: 'normal', conjunto: 'letras', autoEspacio: true, ...JSON.parse(localStorage.getItem(LS_PREFS) || '{}') };
  } catch {
    return { zurdo: false, velocidad: 'normal', conjunto: 'letras', autoEspacio: true };
  }
}
function guardarPrefs(p) {
  try {
    localStorage.setItem(LS_PREFS, JSON.stringify(p));
  } catch {
    /* sin almacenamiento: solo dura esta visita */
  }
}

let audioCtx = null;
function pitido(freq = 880, dur = 0.09) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.12, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(g).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + dur);
  } catch {
    /* sin audio */
  }
}

function usePrefs() {
  const [prefs, setPrefs] = useState(leerPrefs);
  const cambiar = (parcial) =>
    setPrefs((p) => {
      const n = { ...p, ...parcial };
      guardarPrefs(n);
      return n;
    });
  return [prefs, cambiar];
}

function useOficiales() {
  const [of, setOf] = useState(null);
  useEffect(() => {
    let vivo = true;
    cargarEjemplosOficiales().then((d) => vivo && setOf(d));
    return () => {
      vivo = false;
    };
  }, []);
  return of;
}

const contar = (muestras, clases) => clases.filter((c) => muestras?.[c]?.length).length;

function Boton({ children, onClick, color = AZUL, suave = false, disabled, style }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '8px 14px',
        borderRadius: 10,
        border: suave ? `2px solid ${color}33` : 'none',
        background: suave ? `${color}12` : color,
        color: suave ? color : '#fff',
        fontWeight: 700,
        fontSize: '0.85rem',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function Interruptor({ on, onChange, children }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

function SelectorConjunto({ valor, onChange }) {
  return (
    <div style={{ display: 'inline-flex', borderRadius: 10, overflow: 'hidden', border: `2px solid ${AZUL}33` }}>
      {[
        ['letras', '🔤 Letras'],
        ['numeros', '🔢 Números'],
      ].map(([id, label]) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          style={{ padding: '6px 12px', border: 'none', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', background: valor === id ? AZUL : '#fff', color: valor === id ? '#fff' : AZUL }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Imagen del signo (del abecedario de la herramienta) o la letra si no hay dibujo. */
function SignoOLetra({ Sign, clase, size = 90 }) {
  const img = Sign ? <Sign char={clase} size={size} hideLabel /> : null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      {img && clase !== 'Ñ' ? img : <div style={{ width: size, height: size * 0.82, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.5, color: '#94a3b8' }}>✋</div>}
      <span style={{ fontWeight: 900, fontSize: size * 0.32, color: AZUL, lineHeight: 1 }}>{clase}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ESCRIBIR CON LA MANO
// ═══════════════════════════════════════════════════════════════════════════

export function ModoEscribirMano({ Sign, onIrEnseniar }) {
  const oficiales = useOficiales();
  const [locales] = useState(leerEjemplosLocales);
  const [prefs, cambiarPrefs] = usePrefs();
  const [texto, setTexto] = useState('');
  const [vista, setVista] = useState({ clase: null, confianza: 0, progreso: 0, hayMano: false, segunda: null });

  const muestras = useMemo(() => unirEjemplos(oficiales, locales), [oficiales, locales]);
  const clasificador = useMemo(() => crearClasificador(muestras), [muestras]);
  const clases = prefs.conjunto === 'numeros' ? NUMEROS_SIGNOS : LETRAS_SIGNOS;
  const disponibles = clases.filter((c) => muestras[c]?.length);
  const hayModelo = disponibles.length > 0;

  const textoRef = useRef('');
  const vivo = useRef({});
  vivo.current = {
    clasificador,
    permitidas: new Set(clases),
    zurdo: prefs.zurdo,
    hold: (VELOCIDADES.find((v) => v.id === prefs.velocidad) || VELOCIDADES[1]).ms,
    autoEspacio: prefs.autoEspacio,
  };

  const escribir = (t) => {
    textoRef.current = t;
    setTexto(t);
  };

  useEffect(() => {
    if (!hayModelo) return undefined;
    const s = { cand: null, desde: 0, ultima: null, liberada: true, distintaDesde: 0, sinManoDesde: 0, ui: 0 };
    return escucharManos((manos) => {
      const ahora = performance.now();
      const { clasificador: clf, permitidas, zurdo, hold, autoEspacio } = vivo.current;
      const m = manos[0];
      let r = null;
      if (m) {
        s.sinManoDesde = 0;
        r = clf.clasificar(normalizarMano(m.puntos3d, zurdo), permitidas);
      } else if (!s.sinManoDesde) s.sinManoDesde = ahora;

      // Sin mano un rato → espacio (una sola vez)
      const t = textoRef.current;
      if (!m && autoEspacio && s.sinManoDesde && ahora - s.sinManoDesde > ESPACIO_SIN_MANO_MS && t && !t.endsWith(' ')) {
        escribir(t + ' ');
        pitido(440, 0.06);
        s.ultima = null;
      }

      const clase = r?.clase && r.confianza >= MIN_CONFIANZA ? r.clase : null;
      if (clase !== s.cand) {
        s.cand = clase;
        s.desde = ahora;
      }
      // Para repetir la misma letra (LL, RR, 00…) hay que cambiar de postura un momento.
      if (clase !== s.ultima) {
        if (!s.distintaDesde) s.distintaDesde = ahora;
        if (ahora - s.distintaDesde > 300) s.liberada = true;
      } else s.distintaDesde = 0;

      let progreso = 0;
      if (clase) {
        const bloqueada = clase === s.ultima && !s.liberada;
        progreso = bloqueada ? 1 : Math.min(1, (ahora - s.desde) / hold);
        if (!bloqueada && progreso >= 1) {
          escribir(textoRef.current + clase);
          pitido();
          s.ultima = clase;
          s.liberada = false;
          s.distintaDesde = 0;
        }
      }
      if (ahora - s.ui > 80) {
        s.ui = ahora;
        setVista({ clase, confianza: r?.confianza || 0, progreso, hayMano: !!m, segunda: r?.segunda || null });
      }
    });
  }, [hayModelo]);

  const leer = () => {
    if (!texto.trim() || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto.toLowerCase());
    u.lang = 'es-ES';
    window.speechSynthesis.speak(u);
  };

  if (oficiales === null) return <p style={{ textAlign: 'center', color: '#64748b' }}>⏳ Cargando…</p>;

  if (!hayModelo)
    return (
      <div style={{ textAlign: 'center', padding: '10px 6px' }}>
        <div style={{ fontSize: '3rem' }}>✋</div>
        <h3 style={{ margin: '6px 0', color: '#1e293b' }}>Todavía no hay ejemplos de {prefs.conjunto === 'numeros' ? 'números' : 'letras'}</h3>
        <p style={{ color: '#475569', fontSize: '0.92rem', maxWidth: 480, margin: '0 auto 14px' }}>
          Para reconocer los signos, alguien que sepa signar tiene que enseñárselos primero a la web grabando cada{' '}
          {prefs.conjunto === 'numeros' ? 'número' : 'letra'} con la cámara (o desde fotos).
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Boton onClick={onIrEnseniar}>🎓 Ir a «Enseñar»</Boton>
          <SelectorConjunto valor={prefs.conjunto} onChange={(c) => cambiarPrefs({ conjunto: c })} />
        </div>
      </div>
    );

  const faltan = clases.filter((c) => !muestras[c]?.length);

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'center' }}>
        <VistaManos ancho={320} colorMano={() => (vista.clase ? '#22c55e' : '#f59e0b')} />
        <div style={{ flex: '1 1 220px', minWidth: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>
            {!vista.hayMano ? '🙈 Pon la mano delante de la cámara' : vista.clase ? 'Veo…' : '🤔 No reconozco este signo'}
          </div>
          <div style={{ minHeight: 130, display: 'flex', alignItems: 'center' }}>
            {vista.clase ? <SignoOLetra Sign={Sign} clase={vista.clase} size={100} /> : <div style={{ fontSize: '3.5rem', opacity: 0.25 }}>✋</div>}
          </div>
          <div style={{ width: '80%', height: 10, borderRadius: 6, background: '#e2e8f0', overflow: 'hidden' }}>
            <div style={{ width: `${vista.progreso * 100}%`, height: '100%', background: vista.progreso >= 1 ? '#22c55e' : AZUL, transition: 'width 0.08s linear' }} />
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center' }}>
            Mantén el signo quieto hasta que se llene la barra.
            {vista.clase && vista.segunda && vista.confianza < 0.85 ? ` (¿o es la ${vista.segunda}?)` : ''}
          </div>
        </div>
      </div>

      {/* Texto escrito */}
      <div
        style={{
          marginTop: 16,
          minHeight: 70,
          padding: '12px 16px',
          borderRadius: 14,
          border: `2px solid ${AZUL}33`,
          background: '#f8fafc',
          fontSize: '2rem',
          fontWeight: 800,
          letterSpacing: 3,
          color: '#0f172a',
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
        }}
      >
        {texto || <span style={{ color: '#cbd5e1', fontSize: '1rem', fontWeight: 600, letterSpacing: 0 }}>Aquí aparecerá lo que signes…</span>}
        <span style={{ animation: 'pulse 1s infinite', color: AZUL }}>|</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, justifyContent: 'center' }}>
        <Boton suave onClick={() => escribir(texto + ' ')}>␣ Espacio</Boton>
        <Boton suave onClick={() => escribir(texto.slice(0, texto.endsWith('10') ? -2 : -1))}>⌫ Borrar</Boton>
        <Boton suave color="#dc2626" onClick={() => escribir('')}>🗑 Limpiar</Boton>
        <Boton suave color="#059669" onClick={leer}>🔊 Leer</Boton>
        <Boton suave color="#7c3aed" onClick={() => navigator.clipboard?.writeText(texto)}>📋 Copiar</Boton>
      </div>

      {/* Ajustes */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 16, alignItems: 'center', justifyContent: 'center', padding: 10, borderRadius: 12, background: '#f1f5f9' }}>
        <SelectorConjunto valor={prefs.conjunto} onChange={(c) => cambiarPrefs({ conjunto: c })} />
        <select value={prefs.velocidad} onChange={(e) => cambiarPrefs({ velocidad: e.target.value })} style={{ padding: '5px 8px', borderRadius: 8, fontWeight: 600 }}>
          {VELOCIDADES.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
        <Interruptor on={prefs.zurdo} onChange={(v) => cambiarPrefs({ zurdo: v })}>
          Signo con la mano izquierda
        </Interruptor>
        <Interruptor on={prefs.autoEspacio} onChange={(v) => cambiarPrefs({ autoEspacio: v })}>
          Quitar la mano = espacio
        </Interruptor>
      </div>
      {faltan.length > 0 && (
        <p style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center', marginTop: 8 }}>
          Aún no reconoce: {faltan.join(' ')} (faltan ejemplos en «Enseñar»).
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ENSEÑAR (grabar ejemplos)
// ═══════════════════════════════════════════════════════════════════════════

export function ModoEnseniarSignos({ Sign }) {
  const oficiales = useOficiales();
  const [prefs, cambiarPrefs] = usePrefs();
  const [datos, setDatosState] = useState(leerEjemplosLocales);
  const [sel, setSel] = useState('A');
  const [fase, setFase] = useState('quieto'); // quieto | cuenta | grabando
  const [cuenta, setCuenta] = useState(3);
  const [capturadas, setCapturadas] = useState(0);
  const [aviso, setAviso] = useState('');
  const [veo, setVeo] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const fotoRef = useRef(null);
  const archivoRef = useRef(null);

  const clases = prefs.conjunto === 'numeros' ? NUMEROS_SIGNOS : LETRAS_SIGNOS;
  useEffect(() => {
    if (!clases.includes(sel)) setSel(clases[0]);
  }, [prefs.conjunto]); // eslint-disable-line react-hooks/exhaustive-deps

  const setDatos = (fn) =>
    setDatosState((d) => {
      const n = typeof fn === 'function' ? fn(d) : fn;
      if (!guardarEjemplosLocales(n)) setAviso('⚠️ El navegador no deja guardar más: descarga el archivo para no perder lo grabado.');
      return n;
    });

  const anadir = (clase, nuevas) =>
    setDatos((d) => ({ ...d, muestras: { ...d.muestras, [clase]: [...(d.muestras[clase] || []), ...nuevas] } }));

  // Clasificador de prueba con lo que hay (propios + oficiales)
  const clasificador = useMemo(() => crearClasificador(unirEjemplos(oficiales, datos)), [oficiales, datos]);

  const vivo = useRef({});
  vivo.current = { ...vivo.current, fase, sel, zurdo: prefs.zurdo, clasificador, permitidas: new Set(clases), clases, datos };
  const buffer = useRef({ lista: [], inicio: 0, ultima: 0 });

  // Una sola suscripción: graba cuando toca y siempre dice qué letra ve.
  useEffect(() => {
    let ui = 0;
    return escucharManos((manos) => {
      const ahora = performance.now();
      const v = vivo.current;
      const m = manos[0];
      const norm = m ? normalizarMano(m.puntos3d, v.zurdo) : null;
      if (v.fase === 'grabando') {
        const b = buffer.current;
        if (norm && ahora - b.ultima > 90) {
          b.lista.push(norm);
          b.ultima = ahora;
        }
        if (b.lista.length >= OBJETIVO || ahora - b.inicio > GRABAR_MAX_MS) terminarGrabacion();
      }
      if (ahora - ui > 120) {
        ui = ahora;
        const r = norm ? v.clasificador.clasificar(norm, v.permitidas) : null;
        setVeo(m ? r || { clase: null } : null);
        if (v.fase === 'grabando') setCapturadas(buffer.current.lista.length);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function terminarGrabacion() {
    const v = vivo.current;
    const lista = buffer.current.lista;
    buffer.current.lista = [];
    vivo.current.fase = 'quieto';
    setFase('quieto');
    if (lista.length < 5) {
      setAviso('No he visto bien la mano. Ponla dentro de la imagen, con buena luz, y vuelve a probar.');
      return;
    }
    anadir(v.sel, lista);
    pitido(990, 0.15);
    setAviso(`✅ ${lista.length} ejemplos de la «${v.sel}» guardados.`);
    // Pasa sola a la siguiente letra que aún no tiene ejemplos.
    const pend = v.clases.find((c, i) => i > v.clases.indexOf(v.sel) && !v.datos.muestras[c]?.length);
    if (pend) setTimeout(() => setSel(pend), 900);
  }

  const grabar = () => {
    setAviso('');
    setFase('cuenta');
    setCuenta(3);
    let n = 3;
    pitido(660, 0.08);
    const id = setInterval(() => {
      n -= 1;
      if (n > 0) {
        setCuenta(n);
        pitido(660, 0.08);
      } else {
        clearInterval(id);
        pitido(990, 0.12);
        buffer.current = { lista: [], inicio: performance.now(), ultima: 0 };
        setCapturadas(0);
        vivo.current.fase = 'grabando';
        setFase('grabando');
      }
    }, 800);
  };

  const desdeFotos = async (files) => {
    if (!files?.length) return;
    setOcupado(true);
    setAviso('⏳ Buscando la mano en las fotos…');
    let total = 0;
    let fallidas = 0;
    for (const f of files) {
      try {
        const manos = await detectarManosEnImagen(f);
        if (!manos.length) {
          fallidas++;
          continue;
        }
        const nuevas = aumentarMuestra(normalizarMano(manos[0].puntos3d, prefs.zurdo), 20);
        anadir(sel, nuevas);
        total += nuevas.length;
      } catch {
        fallidas++;
      }
    }
    setOcupado(false);
    setAviso(
      total
        ? `✅ ${total} ejemplos de la «${sel}» sacados de ${files.length - fallidas} foto(s).${fallidas ? ` En ${fallidas} no encontré la mano.` : ''}`
        : 'No he encontrado ninguna mano en la foto. Prueba con una foto de una mano real, de frente y con buena luz (los dibujos no suelen funcionar).'
    );
  };

  const cargarArchivo = async (file) => {
    if (!file) return;
    try {
      const nuevo = await leerArchivoEjemplos(file);
      setDatos((d) => ({ autor: d.autor || nuevo.autor, muestras: unirEjemplos(d, nuevo) }));
      setAviso(`✅ Archivo cargado: ${Object.keys(nuevo.muestras).length} signos${nuevo.autor ? ` de ${nuevo.autor}` : ''}.`);
    } catch (e) {
      setAviso('⚠️ ' + e.message);
    }
  };

  const nSel = datos.muestras[sel]?.length || 0;
  const nOfSel = oficiales?.muestras?.[sel]?.length || 0;
  const hechas = contar(datos.muestras, clases);

  return (
    <div>
      <div style={{ background: '#eff6ff', border: `1.5px solid ${AZUL}33`, borderRadius: 14, padding: '12px 14px', fontSize: '0.85rem', color: '#1e3a8a', lineHeight: 1.5 }}>
        <b>🎓 Enseña los signos a la web</b> (lo hace una vez alguien que sepa signar):
        <ol style={{ margin: '6px 0 0', paddingLeft: 20 }}>
          <li>Elige una letra, pulsa <b>🔴 Grabar</b> y haz el signo delante de la cámara durante 3 segundos. Mueve un poquito la mano (gírala, acércala y aléjala) para que aprenda mejor.</li>
          <li>Pasa sola a la siguiente letra. Abajo pone qué letra reconoce ahora mismo: si confunde dos, graba más ejemplos de las dos.</li>
          <li>Al terminar, pulsa <b>📥 Descargar archivo</b> y envíaselo a quien gestiona la web para que funcione para todo el mundo.</li>
        </ol>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
        <input
          value={datos.autor}
          onChange={(e) => setDatos((d) => ({ ...d, autor: e.target.value.slice(0, 60) }))}
          placeholder="Tu nombre (opcional)"
          style={{ padding: '7px 10px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: '0.85rem' }}
        />
        <SelectorConjunto valor={prefs.conjunto} onChange={(c) => cambiarPrefs({ conjunto: c })} />
        <Interruptor on={prefs.zurdo} onChange={(v) => cambiarPrefs({ zurdo: v })}>
          Signo con la mano izquierda
        </Interruptor>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
          {hechas} de {clases.length} grabadas
        </span>
      </div>

      {/* Rejilla de letras */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
        {clases.map((c) => {
          const n = datos.muestras[c]?.length || 0;
          const ok = n >= OBJETIVO;
          return (
            <button
              key={c}
              onClick={() => fase === 'quieto' && setSel(c)}
              title={`${n} ejemplos tuyos`}
              style={{
                minWidth: 42,
                padding: '6px 4px',
                borderRadius: 10,
                cursor: 'pointer',
                border: `2px solid ${c === sel ? AZUL : ok ? '#22c55e' : n ? '#f59e0b' : '#e2e8f0'}`,
                background: c === sel ? '#dbeafe' : ok ? '#f0fdf4' : '#fff',
                fontWeight: 800,
                color: '#1e293b',
                lineHeight: 1.1,
              }}
            >
              {c}
              <div style={{ fontSize: '0.6rem', fontWeight: 700, color: ok ? '#16a34a' : '#94a3b8' }}>{ok ? '✓' : n || '·'}</div>
            </button>
          );
        })}
      </div>

      {/* Letra seleccionada */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 14, alignItems: 'flex-start', justifyContent: 'center' }}>
        <div style={{ position: 'relative' }}>
          <VistaManos ancho={320} colorMano={() => (fase === 'grabando' ? '#ef4444' : '#22c55e')} />
          {fase === 'cuenta' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '5rem', fontWeight: 900, color: '#fff', textShadow: '0 4px 16px #000' }}>{cuenta}</div>
          )}
          {fase === 'grabando' && (
            <div style={{ position: 'absolute', top: 8, left: 8, background: '#ef4444', color: '#fff', borderRadius: 8, padding: '3px 8px', fontWeight: 800, fontSize: '0.8rem' }}>
              🔴 Grabando {capturadas}/{OBJETIVO}
            </div>
          )}
        </div>
        <div style={{ flex: '1 1 220px', minWidth: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>Haz este signo:</div>
          <SignoOLetra Sign={Sign} clase={sel} size={110} />
          <div style={{ fontSize: '0.78rem', color: '#475569' }}>
            {nSel} ejemplos tuyos{nOfSel ? ` · ${nOfSel} oficiales` : ''}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Boton color="#dc2626" onClick={grabar} disabled={fase !== 'quieto' || ocupado}>
              🔴 Grabar «{sel}»
            </Boton>
            <Boton suave onClick={() => fotoRef.current?.click()} disabled={fase !== 'quieto' || ocupado}>
              📷 Desde una foto
            </Boton>
            {nSel > 0 && (
              <Boton
                suave
                color="#64748b"
                disabled={fase !== 'quieto'}
                onClick={() => {
                  if (!window.confirm(`¿Borrar los ${nSel} ejemplos de la «${sel}»?`)) return;
                  setDatos((d) => {
                    const m = { ...d.muestras };
                    delete m[sel];
                    return { ...d, muestras: m };
                  });
                }}
              >
                🗑 Borrar
              </Boton>
            )}
          </div>
          <input
            ref={fotoRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              desdeFotos([...e.target.files]);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {aviso && <div style={{ marginTop: 10, textAlign: 'center', fontWeight: 700, fontSize: '0.85rem', color: aviso.startsWith('⚠') ? '#b45309' : '#166534' }}>{aviso}</div>}

      <div style={{ marginTop: 12, textAlign: 'center', padding: 10, borderRadius: 12, background: '#f1f5f9', fontSize: '0.9rem', fontWeight: 700, color: '#334155' }}>
        🔎 Ahora mismo veo:{' '}
        {!veo ? (
          <span style={{ color: '#94a3b8' }}>ninguna mano</span>
        ) : veo.clase ? (
          <span style={{ color: veo.clase === sel ? '#16a34a' : '#dc2626', fontSize: '1.2rem' }}>
            {veo.clase} <span style={{ fontSize: '0.75rem', color: '#64748b' }}>({Math.round((veo.confianza || 0) * 100)} %)</span>
          </span>
        ) : (
          <span style={{ color: '#94a3b8' }}>un signo que no conozco</span>
        )}
      </div>

      {/* Archivo */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14, justifyContent: 'center' }}>
        <Boton color="#059669" onClick={() => descargarEjemplos(datos)} disabled={!Object.keys(datos.muestras).length}>
          📥 Descargar archivo
        </Boton>
        <Boton suave onClick={() => archivoRef.current?.click()}>
          📂 Cargar un archivo
        </Boton>
        <Boton
          suave
          color="#dc2626"
          disabled={!Object.keys(datos.muestras).length}
          onClick={() => window.confirm('¿Borrar TODOS tus ejemplos? (descarga antes el archivo si quieres conservarlos)') && setDatos({ autor: datos.autor, muestras: {} })}
        >
          🗑 Borrar todo
        </Boton>
        <input
          ref={archivoRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            cargarArchivo(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      <p style={{ fontSize: '0.72rem', color: '#94a3b8', textAlign: 'center', marginTop: 8 }}>
        Tus ejemplos se guardan solo en este navegador. Para que funcionen en otros ordenadores, descarga el archivo. Si graban varias personas, cargad los archivos de todas: así reconoce mejor manos distintas.
      </p>
    </div>
  );
}
