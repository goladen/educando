// 📱 Página del móvil del profe (pikt.es/?escaner=CODIGO): cámara trasera que lee las
// tarjetas y manda «tarjeta → letra» a la pizarra. Desde aquí también se puede
// empezar, corregir y pasar de pregunta, para no tener que volver al ordenador.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import CamaraTarjetas from './CamaraTarjetas.jsx';
import { crearEstabilizador, LETRAS_TARJETA, MAX_TARJETAS } from './detectorTarjetas.js';
import { escucharSesion, enviarLecturas, latidoMovil, ordenMovil, TIPO_ESCANER } from './escanerRemoto.js';

const COLORES = ['#ef4444', '#3b82f6', '#f59e0b', '#22c55e'];

export default function EscanerMovil({ codigoInicial = '', onExit }) {
  const [codigo, setCodigo] = useState(String(codigoInicial || '').toUpperCase().trim());
  const [escrito, setEscrito] = useState('');
  const [sesion, setSesion] = useState(undefined); // undefined = cargando · null = no existe
  const [enviadas, setEnviadas] = useState({}); // tarjeta → letra enviada en esta ronda
  const [errorEnvio, setErrorEnvio] = useState(false);

  const sesionRef = useRef(null);
  sesionRef.current = sesion;
  const estabRef = useRef(crearEstabilizador(3));
  const pendientesRef = useRef(new Map()); // tarjeta → letra por enviar
  const enviadasRef = useRef({});
  const rondaRef = useRef(-1);

  // Sesión en Firestore
  useEffect(() => {
    if (!codigo) return undefined;
    setSesion(undefined);
    return escucharSesion(codigo, (d) => setSesion(d && d.tipoJuego === TIPO_ESCANER ? d : null), () => setSesion(null));
  }, [codigo]);

  // Nueva ronda → se olvida lo enviado
  const ronda = sesion?.ronda ?? -1;
  useEffect(() => {
    if (ronda === rondaRef.current) return;
    rondaRef.current = ronda;
    enviadasRef.current = {};
    setEnviadas({});
    pendientesRef.current.clear();
    estabRef.current.reiniciar();
  }, [ronda]);

  const fase = sesion?.fase;
  const leyendo = fase === 'lobby' || fase === 'pregunta';

  // Envío en lotes cada 0,5 s (Firestore no quiere una escritura por fotograma)
  useEffect(() => {
    if (!codigo || !leyendo) return undefined;
    const t = setInterval(() => {
      const p = pendientesRef.current;
      if (!p.size) return;
      const lote = [...p].map(([tarjeta, letra]) => ({ tarjeta, letra }));
      const r = rondaRef.current;
      p.clear();
      enviarLecturas(codigo, lote, r)
        .then(() => setErrorEnvio(false))
        .catch(() => {
          setErrorEnvio(true);
          // se reintenta en el siguiente lote (salvo que ya haya otra lectura más nueva)
          lote.forEach(({ tarjeta, letra }) => { if (!p.has(tarjeta)) p.set(tarjeta, letra); });
        });
    }, 500);
    return () => clearInterval(t);
  }, [codigo, leyendo]);

  // Latido para que la pizarra sepa que el móvil sigue ahí
  useEffect(() => {
    if (!codigo || !sesion) return undefined;
    latidoMovil(codigo);
    const t = setInterval(() => latidoMovil(codigo), 5000);
    return () => clearInterval(t);
  }, [codigo, !!sesion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pantalla siempre encendida mientras se escanea
  useEffect(() => {
    let lock = null;
    let vivo = true;
    const pedir = () => navigator.wakeLock?.request?.('screen').then((l) => { if (vivo) lock = l; else l.release(); }).catch(() => {});
    pedir();
    const vis = () => { if (document.visibilityState === 'visible') pedir(); };
    document.addEventListener('visibilitychange', vis);
    return () => { vivo = false; document.removeEventListener('visibilitychange', vis); lock?.release?.().catch?.(() => {}); };
  }, []);

  const onDetecciones = useCallback((dets) => {
    const s = sesionRef.current;
    if (!s || (s.fase !== 'lobby' && s.fase !== 'pregunta')) return;
    const nOp = s.fase === 'pregunta' ? s.nOpciones || 4 : 4;
    const nuevas = estabRef.current.actualizar(dets).filter((l) => LETRAS_TARJETA.indexOf(l.letra) < nOp);
    if (!nuevas.length) return;
    let cambia = false;
    for (const l of nuevas) {
      if (enviadasRef.current[l.tarjeta] === l.letra) continue; // ya enviada igual: no se repite
      enviadasRef.current[l.tarjeta] = l.letra;
      pendientesRef.current.set(l.tarjeta, l.letra);
      cambia = true;
    }
    if (cambia) setEnviadas({ ...enviadasRef.current });
  }, []);

  const etiqueta = useCallback((d) => {
    const s = sesionRef.current;
    // Solo el número: los nombres de los alumnos no se mandan a la sesión (es una colección abierta)
    const nombre = `#${d.tarjeta}`;
    if (s?.fase === 'pregunta' && LETRAS_TARJETA.indexOf(d.letra) >= (s.nOpciones || 4)) return { texto: `${nombre} ✗ ${d.letra}?`, color: '#f87171' };
    const ok = enviadasRef.current[d.tarjeta] === d.letra;
    return { texto: s?.fase === 'pregunta' ? `${nombre} · ${d.letra}${ok ? ' ✓' : ''}` : `${nombre}${ok ? ' ✓' : ''}`, color: ok ? '#22c55e' : '#e2e8f0' };
  }, []);

  // ── Sin código: pedirlo ──
  if (!codigo) {
    return (
      <div style={st.pantalla}>
        <div style={st.caja}>
          <h2 style={{ margin: '0 0 8px' }}>📱 Cámara para las tarjetas</h2>
          <p style={st.ayuda}>Escribe el código que aparece en la pizarra (PiLive → 🃏 Con tarjetas → 📱 Usar el móvil).</p>
          <form onSubmit={(e) => { e.preventDefault(); setCodigo(escrito.toUpperCase().trim()); }} style={{ display: 'flex', gap: 8 }}>
            <input value={escrito} onChange={(e) => setEscrito(e.target.value)} placeholder="T…" autoCapitalize="characters" style={st.input} />
            <button type="submit" style={st.boton('#16a34a')}>Entrar</button>
          </form>
          {onExit && <button onClick={onExit} style={{ ...st.boton('#334155'), marginTop: 14 }}>Salir</button>}
        </div>
      </div>
    );
  }
  if (sesion === undefined) return <div style={st.pantalla}><p>Conectando con la pizarra…</p></div>;
  if (sesion === null || fase === 'final') {
    return (
      <div style={st.pantalla}>
        <div style={st.caja}>
          <h2 style={{ margin: '0 0 8px' }}>{sesion === null ? '🔍 No encuentro la sesión' : '🏁 Partida terminada'}</h2>
          <p style={st.ayuda}>{sesion === null ? `No hay ninguna sesión abierta con el código ${codigo}. Mira el código de la pizarra.` : 'Ya puedes cerrar esta página.'}</p>
          <button onClick={() => { setCodigo(''); setEscrito(''); }} style={st.boton('#2563eb')}>Escribir otro código</button>
        </div>
      </div>
    );
  }

  const nEnviadas = Object.keys(enviadas).length;
  const total = Math.max(sesion.presentes || 0, sesion.respondidas || 0);
  const orden = (tipo) => ordenMovil(codigo, tipo);

  return (
    <div style={st.pantalla}>
      <div style={st.cabecera}>
        <span style={{ fontWeight: 900 }}>📱 {codigo}</span>
        <span style={{ flex: 1, textAlign: 'center', fontWeight: 700 }}>
          {fase === 'lobby' && 'Pasar lista'}
          {fase === 'pregunta' && `Pregunta ${sesion.indice + 1}/${sesion.total}`}
          {fase === 'resultado' && `Corregida ${sesion.indice + 1}/${sesion.total}`}
        </span>
        {errorEnvio && <span style={{ color: '#fca5a5' }}>⚠️ sin red</span>}
      </div>

      {fase === 'pregunta' && sesion.texto && <div style={st.pregunta}>{sesion.texto}</div>}

      {fase === 'config' ? (
        <div style={{ ...st.caja, margin: '20px auto' }}>
          <p style={{ margin: 0, fontSize: 18 }}>✅ Conectado con la pizarra.</p>
          <p style={st.ayuda}>Cuando abras la sala en la pizarra, aquí se encenderá la cámara para pasar lista.</p>
        </div>
      ) : leyendo ? (
        <CamaraTarjetas activo maxTarjeta={Math.min(MAX_TARJETAS, sesion.maxTarjeta || MAX_TARJETAS)} onDetecciones={onDetecciones} etiqueta={etiqueta} alto="58vh" compacta />
      ) : (
        <div style={{ ...st.caja, margin: '20px auto' }}>
          <p style={{ margin: 0, fontSize: 18 }}>✅ Corregida en la pizarra.</p>
          <p style={st.ayuda}>{sesion.respondidas || 0} respuestas. Pasa a la siguiente cuando quieras.</p>
        </div>
      )}

      <div style={st.estado}>
        {fase === 'lobby' && <span>🃏 {sesion.presentes || 0} tarjetas en la lista</span>}
        {fase === 'pregunta' && <span>✅ {sesion.respondidas || 0}/{total} han respondido · {nEnviadas} leídas con este móvil</span>}
      </div>
      {fase === 'pregunta' && (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', margin: '0 0 8px' }}>
          {LETRAS_TARJETA.slice(0, sesion.nOpciones || 4).map((l, i) => (
            <span key={l} style={{ background: COLORES[i], color: '#fff', fontWeight: 900, borderRadius: 8, padding: '2px 10px' }}>
              {l} · {Object.values(enviadas).filter((x) => x === l).length}
            </span>
          ))}
        </div>
      )}

      <div style={st.botones}>
        {fase === 'lobby' && <button onClick={() => orden('empezar')} style={st.boton('#16a34a')}>▶ Empezar</button>}
        {fase === 'pregunta' && <button onClick={() => orden('corregir')} style={st.boton('#16a34a')}>✔ Corregir</button>}
        {fase === 'resultado' && <button onClick={() => orden('siguiente')} style={st.boton('#2563eb')}>{sesion.indice + 1 >= sesion.total ? '🏆 Ver resultados' : 'Siguiente ▶'}</button>}
      </div>
      <p style={{ ...st.ayuda, textAlign: 'center', padding: '0 12px' }}>
        Recorre la clase despacio de un lado a otro: cada tarjeta se apunta en cuanto se lee (sale en verde) y cuenta la última letra.
      </p>
    </div>
  );
}

const st = {
  pantalla: { minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start', padding: '10px 10px 24px', boxSizing: 'border-box', gap: 8 },
  caja: { background: 'rgba(255,255,255,0.06)', border: '1px solid #334155', borderRadius: 16, padding: 20, maxWidth: 420, width: '100%', margin: '40px auto 0', boxSizing: 'border-box', textAlign: 'center' },
  ayuda: { color: '#94a3b8', fontSize: 14, lineHeight: 1.5 },
  input: { flex: 1, minWidth: 0, padding: '12px 14px', borderRadius: 12, border: '1px solid #475569', background: '#020617', color: '#f1f5f9', fontSize: 22, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase' },
  boton: (bg) => ({ padding: '14px 22px', borderRadius: 14, border: 'none', background: bg, color: '#fff', fontWeight: 800, fontSize: 18, cursor: 'pointer', width: '100%' }),
  cabecera: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 15 },
  pregunta: { fontWeight: 800, fontSize: 16, textAlign: 'center', color: '#f8fafc', lineHeight: 1.3, maxHeight: '4.2em', overflow: 'hidden' },
  estado: { textAlign: 'center', fontWeight: 700, fontSize: 15 },
  botones: { display: 'flex', gap: 10, padding: '0 6px' },
};
