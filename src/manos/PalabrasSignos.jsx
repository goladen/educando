// Lengua de signos · pestaña «🤟 Palabras»: reconocer signos con movimiento y grabar los ejemplos.
// El reconocimiento está en ./signosPalabras.js. Usa las manos y el cuerpo a la vez, así que
// enseña los fotogramas por segundo para saber si el ordenador da abasto.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import VistaManos from './VistaManos.jsx';
import { escucharManos } from './manosVision.js';
import { escucharPose, escucharEstadoPose, getPose, getVideoPose, setMaxPersonas } from '../cuerpo/poseVision.js';
import {
  PALABRAS_INICIALES,
  fotogramaSigno,
  crearSegmentador,
  crearClasificadorPalabras,
  leerPalabrasLocales,
  guardarPalabrasLocales,
  cargarPalabrasOficiales,
  unirPalabras,
  descargarPalabras,
  leerArchivoPalabras,
} from './signosPalabras.js';

const AZUL = '#2563EB';
const REPETICIONES = 5;
const FPS_MIN = 12; // por debajo, los movimientos rápidos se captan mal
const LS_LISTA = 'pikt_signos_palabras_lista';

function leerLista() {
  try {
    const l = JSON.parse(localStorage.getItem(LS_LISTA) || 'null');
    return Array.isArray(l) ? l.filter((p) => typeof p === 'string') : [];
  } catch {
    return [];
  }
}

function pitido(freq = 880, dur = 0.1) {
  try {
    const ctx = (pitido.ctx = pitido.ctx || new (window.AudioContext || window.webkitAudioContext)());
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur);
  } catch {
    /* sin audio */
  }
}

function Boton({ children, onClick, color = AZUL, suave = false, disabled }) {
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
      }}
    >
      {children}
    </button>
  );
}

/** Conecta cámara, manos y cuerpo: cada signo terminado llega a alSigno(secuencia). */
function useSignos(alSigno, zurdo) {
  const [vista, setVista] = useState({ estado: 'reposo', hayPersona: false, fps: 0 });
  const [errorPose, setErrorPose] = useState('');
  const ref = useRef({});
  ref.current = { alSigno, zurdo };

  useEffect(() => {
    setMaxPersonas(1);
    const seg = crearSegmentador((sec) => ref.current.alSigno(sec));
    const bajaPose = escucharPose(() => {});
    const bajaEstado = escucharEstadoPose((e) => setErrorPose(e.estado === 'error' ? e.error : ''));
    let ui = 0;
    let cuenta = 0;
    let desde = performance.now();
    let fps = 0;
    const bajaManos = escucharManos((manos) => {
      const ahora = performance.now();
      cuenta++;
      if (ahora - desde >= 1000) {
        fps = Math.round((cuenta * 1000) / (ahora - desde));
        cuenta = 0;
        desde = ahora;
      }
      const v = getVideoPose();
      const aspecto = v ? v.videoWidth / (v.videoHeight || 1) || 4 / 3 : 4 / 3;
      const fot = fotogramaSigno(getPose(), manos, aspecto, ref.current.zurdo);
      const estado = seg.paso(fot, ahora);
      if (ahora - ui > 120) {
        ui = ahora;
        setVista({ estado, hayPersona: !!fot, fps });
      }
    });
    return () => {
      bajaManos();
      bajaEstado();
      bajaPose();
    };
  }, []);

  return { ...vista, errorPose };
}

function Estado({ vista, enReposo }) {
  const t = vista.errorPose
    ? `⚠️ ${vista.errorPose}`
    : !vista.hayPersona
      ? '🧍 Colócate de cintura para arriba, con los dos hombros a la vista'
      : vista.estado === 'signando'
        ? '👀 Viendo el signo… baja las manos al acabar'
        : vista.estado === 'baja'
          ? '⬇️ Baja las manos para volver a empezar'
          : enReposo;
  return <div style={{ fontWeight: 700, fontSize: '0.88rem', color: vista.estado === 'signando' ? '#dc2626' : '#334155', textAlign: 'center' }}>{t}</div>;
}

function AvisoFps({ fps }) {
  if (!fps) return null;
  const lento = fps < FPS_MIN;
  return (
    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: lento ? '#b45309' : '#94a3b8', textAlign: 'center' }}>
      {fps} imágenes/s{lento ? ' · este ordenador va justo: haz los signos más despacio' : ''}
    </div>
  );
}

export default function ModoPalabrasSignos() {
  const [oficiales, setOficiales] = useState(null);
  const [datos, setDatosState] = useState(leerPalabrasLocales);
  const [extra, setExtra] = useState(leerLista);
  const [pestana, setPestana] = useState('reconocer');
  const [zurdo, setZurdo] = useState(false);

  useEffect(() => {
    let vivo = true;
    cargarPalabrasOficiales().then((d) => {
      if (!vivo) return;
      setOficiales(d);
      // Sin ninguna palabra grabada, lo primero que se puede hacer es enseñarlas.
      if (!Object.keys(d.muestras).length && !Object.keys(leerPalabrasLocales().muestras).length) setPestana('grabar');
    });
    return () => {
      vivo = false;
    };
  }, []);

  const muestras = useMemo(() => unirPalabras(oficiales, datos), [oficiales, datos]);
  const hayEjemplos = Object.keys(muestras).length > 0;
  const lista = useMemo(
    () => [...new Set([...PALABRAS_INICIALES, ...extra, ...Object.keys(datos.muestras)])],
    [extra, datos]
  );

  const pestanas = [
    ['reconocer', '🤟 Reconocer'],
    ['grabar', '🎓 Enseñar palabras'],
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
        <div style={{ display: 'inline-flex', borderRadius: 10, overflow: 'hidden', border: `2px solid ${AZUL}33` }}>
          {pestanas.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setPestana(id)}
              style={{ padding: '7px 14px', border: 'none', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', background: pestana === id ? AZUL : '#fff', color: pestana === id ? '#fff' : AZUL }}
            >
              {label}
            </button>
          ))}
        </div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
          <input type="checkbox" checked={zurdo} onChange={(e) => setZurdo(e.target.checked)} />
          Signo con la mano izquierda
        </label>
      </div>

      {oficiales === null ? (
        <p style={{ textAlign: 'center', color: '#64748b' }}>⏳ Cargando…</p>
      ) : pestana === 'reconocer' ? (
        hayEjemplos ? (
          <Reconocer key={String(zurdo)} muestras={muestras} zurdo={zurdo} />
        ) : (
          <div style={{ textAlign: 'center', padding: '10px 6px' }}>
            <div style={{ fontSize: '3rem' }}>🤟</div>
            <h3 style={{ margin: '6px 0', color: '#1e293b' }}>Todavía no hay palabras grabadas</h3>
            <p style={{ color: '#475569', fontSize: '0.92rem', maxWidth: 480, margin: '0 auto 14px' }}>
              Alguien que sepa signar tiene que enseñar primero cada palabra, haciéndola unas cuantas veces delante de la cámara.
            </p>
            <Boton onClick={() => setPestana('grabar')}>🎓 Enseñar palabras</Boton>
          </div>
        )
      ) : (
        <Grabar
          datos={datos}
          setDatosState={setDatosState}
          lista={lista}
          extra={extra}
          setExtra={setExtra}
          oficiales={oficiales}
          zurdo={zurdo}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// RECONOCER
// ═══════════════════════════════════════════════════════════════════════════

function Reconocer({ muestras, zurdo }) {
  const [texto, setTexto] = useState('');
  const [ultimo, setUltimo] = useState(null);
  const clasificador = useMemo(() => crearClasificadorPalabras(muestras), [muestras]);

  const vista = useSignos((sec) => {
    const r = clasificador.clasificar(sec);
    setUltimo(r);
    if (r?.clase && !r.dudosa) {
      setTexto((t) => (t ? `${t} ${r.clase}` : r.clase));
      pitido();
    } else pitido(330, 0.12);
  }, zurdo);

  const leer = () => {
    if (!texto.trim() || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto.toLowerCase());
    u.lang = 'es-ES';
    window.speechSynthesis.speak(u);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'center' }}>
        <VistaManos ancho={320} colorMano={() => (vista.estado === 'signando' ? '#ef4444' : '#22c55e')} />
        <div style={{ flex: '1 1 220px', minWidth: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <Estado vista={vista} enReposo="🙌 Sube las manos y haz un signo" />
          <div style={{ minHeight: 76, display: 'flex', alignItems: 'center', textAlign: 'center' }}>
            {!ultimo ? (
              <span style={{ fontSize: '3rem', opacity: 0.25 }}>🤟</span>
            ) : ultimo.clase && ultimo.dudosa ? (
              <span style={{ fontWeight: 800, color: '#b45309' }}>🤔 ¿{ultimo.clase} o {ultimo.segunda}? Repite el signo</span>
            ) : ultimo.clase ? (
              <span style={{ fontWeight: 900, fontSize: '1.7rem', color: AZUL }}>{ultimo.clase}</span>
            ) : (
              <span style={{ fontWeight: 800, color: '#64748b' }}>No lo reconozco{ultimo.cercana ? ` (lo más parecido: ${ultimo.cercana})` : ''}</span>
            )}
          </div>
          {ultimo && <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Diferencia con los ejemplos: {ultimo.distancia.toFixed(2)}</div>}
          <AvisoFps fps={vista.fps} />
        </div>
      </div>
      <div
        style={{
          marginTop: 16,
          minHeight: 64,
          padding: '12px 16px',
          borderRadius: 14,
          border: `2px solid ${AZUL}33`,
          background: '#f8fafc',
          fontSize: '1.6rem',
          fontWeight: 800,
          color: '#0f172a',
          wordBreak: 'break-word',
        }}
      >
        {texto || <span style={{ color: '#cbd5e1', fontSize: '1rem', fontWeight: 600 }}>Aquí aparecerán las palabras…</span>}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, justifyContent: 'center' }}>
        <Boton suave onClick={() => setTexto((t) => t.split(' ').slice(0, -1).join(' '))}>⌫ Borrar palabra</Boton>
        <Boton suave color="#dc2626" onClick={() => setTexto('')}>🗑 Limpiar</Boton>
        <Boton suave color="#059669" onClick={leer}>🔊 Leer</Boton>
      </div>
      <p style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center', marginTop: 10 }}>
        Reconoce signos sueltos: baja las manos entre uno y otro. Palabras disponibles: {clasificador.clases.join(', ')}.
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ENSEÑAR
// ═══════════════════════════════════════════════════════════════════════════

function Grabar({ datos, setDatosState, lista, extra, setExtra, oficiales, zurdo }) {
  const [sel, setSel] = useState(lista[0]);
  const [grabando, setGrabando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [nueva, setNueva] = useState('');
  const archivoRef = useRef(null);

  const setDatos = (fn) =>
    setDatosState((d) => {
      const n = typeof fn === 'function' ? fn(d) : fn;
      if (!guardarPalabrasLocales(n)) setAviso('⚠️ El navegador no deja guardar más: descarga el archivo para no perder lo grabado.');
      return n;
    });

  const hechos = useRef(0);
  const vivo = useRef({});
  vivo.current = { grabando, sel };

  const vista = useSignos((sec) => {
    const { grabando: g, sel: palabra } = vivo.current;
    if (!g) return;
    setDatos((d) => ({ ...d, muestras: { ...d.muestras, [palabra]: [...(d.muestras[palabra] || []), sec] } }));
    hechos.current += 1;
    pitido(990, 0.12);
    if (hechos.current >= REPETICIONES) {
      setGrabando(false);
      setAviso(`✅ «${palabra}» grabada ${REPETICIONES} veces.`);
    } else setAviso(`Repetición ${hechos.current} de ${REPETICIONES}: baja las manos y hazla otra vez.`);
  }, zurdo);

  const empezar = () => {
    hechos.current = 0;
    setAviso(`Haz «${sel}» y baja las manos al acabar. Repítela ${REPETICIONES} veces.`);
    setGrabando(true);
  };

  const anadirPalabra = () => {
    const p = nueva.trim().toUpperCase().slice(0, 40);
    if (!p) return;
    if (!lista.includes(p)) {
      const l = [...extra, p];
      setExtra(l);
      try {
        localStorage.setItem(LS_LISTA, JSON.stringify(l));
      } catch {
        /* solo dura esta visita */
      }
    }
    setSel(p);
    setNueva('');
  };

  const cargar = async (file) => {
    if (!file) return;
    try {
      const n = await leerArchivoPalabras(file);
      setDatos((d) => ({ autor: d.autor || n.autor, muestras: unirPalabras(d, n) }));
      setAviso(`✅ Archivo cargado: ${Object.keys(n.muestras).length} palabras.`);
    } catch (e) {
      setAviso('⚠️ ' + e.message);
    }
  };

  const nSel = datos.muestras[sel]?.length || 0;
  const nOf = oficiales?.muestras?.[sel]?.length || 0;
  const hayDatos = Object.keys(datos.muestras).length > 0;

  return (
    <div>
      <div style={{ background: '#eff6ff', border: `1.5px solid ${AZUL}33`, borderRadius: 14, padding: '12px 14px', fontSize: '0.85rem', color: '#1e3a8a', lineHeight: 1.5 }}>
        <b>🎓 Enseña las palabras a la web</b> (lo hace alguien que sepa signar):
        <ol style={{ margin: '6px 0 0', paddingLeft: 20 }}>
          <li>Colócate de cintura para arriba. Elige una palabra y pulsa <b>🔴 Grabar</b>.</li>
          <li>Haz el signo y <b>baja las manos</b> al acabar: suena un pitido por cada repetición. Hazlo {REPETICIONES} veces, con pequeñas variaciones.</li>
          <li>Al terminar, pulsa <b>📥 Descargar archivo</b> y envíaselo a quien gestiona la web.</li>
        </ol>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
        {lista.map((p) => {
          const n = datos.muestras[p]?.length || 0;
          const ok = n >= REPETICIONES;
          return (
            <button
              key={p}
              onClick={() => !grabando && setSel(p)}
              style={{
                padding: '6px 10px',
                borderRadius: 10,
                cursor: 'pointer',
                border: `2px solid ${p === sel ? AZUL : ok ? '#22c55e' : n ? '#f59e0b' : '#e2e8f0'}`,
                background: p === sel ? '#dbeafe' : ok ? '#f0fdf4' : '#fff',
                fontWeight: 800,
                fontSize: '0.8rem',
                color: '#1e293b',
              }}
            >
              {p} <span style={{ color: ok ? '#16a34a' : '#94a3b8' }}>{ok ? '✓' : n || ''}</span>
            </button>
          );
        })}
        <span style={{ display: 'inline-flex', gap: 4 }}>
          <input
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && anadirPalabra()}
            placeholder="Otra palabra…"
            style={{ width: 120, padding: '6px 8px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: '0.8rem' }}
          />
          <Boton suave onClick={anadirPalabra} disabled={!nueva.trim()}>＋</Boton>
        </span>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 14, alignItems: 'flex-start', justifyContent: 'center' }}>
        <VistaManos ancho={320} colorMano={() => (vista.estado === 'signando' && grabando ? '#ef4444' : '#22c55e')} />
        <div style={{ flex: '1 1 220px', minWidth: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ fontWeight: 900, fontSize: '1.5rem', color: AZUL, textAlign: 'center' }}>{sel}</div>
          <div style={{ fontSize: '0.78rem', color: '#475569' }}>
            {nSel} ejemplos tuyos{nOf ? ` · ${nOf} oficiales` : ''}
          </div>
          <Estado vista={vista} enReposo={grabando ? '🙌 Sube las manos y haz el signo' : 'Pulsa «Grabar» para empezar'} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {grabando ? (
              <Boton color="#64748b" onClick={() => setGrabando(false)}>⏹ Parar</Boton>
            ) : (
              <Boton color="#dc2626" onClick={empezar}>🔴 Grabar «{sel}»</Boton>
            )}
            {nSel > 0 && (
              <Boton
                suave
                color="#64748b"
                disabled={grabando}
                onClick={() => {
                  if (!window.confirm(`¿Borrar los ${nSel} ejemplos de «${sel}»?`)) return;
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
          <AvisoFps fps={vista.fps} />
        </div>
      </div>

      {aviso && <div style={{ marginTop: 10, textAlign: 'center', fontWeight: 700, fontSize: '0.85rem', color: aviso.startsWith('⚠') ? '#b45309' : '#166534' }}>{aviso}</div>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14, justifyContent: 'center', alignItems: 'center' }}>
        <input
          value={datos.autor}
          onChange={(e) => setDatos((d) => ({ ...d, autor: e.target.value.slice(0, 60) }))}
          placeholder="Tu nombre (opcional)"
          style={{ padding: '7px 10px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: '0.85rem' }}
        />
        <Boton color="#059669" onClick={() => descargarPalabras(datos)} disabled={!hayDatos}>📥 Descargar archivo</Boton>
        <Boton suave onClick={() => archivoRef.current?.click()}>📂 Cargar un archivo</Boton>
        <input
          ref={archivoRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            cargar(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      <p style={{ fontSize: '0.72rem', color: '#94a3b8', textAlign: 'center', marginTop: 8 }}>
        Tus ejemplos se guardan solo en este navegador. Para que funcionen en otros ordenadores, descarga el archivo.
      </p>
    </div>
  );
}
