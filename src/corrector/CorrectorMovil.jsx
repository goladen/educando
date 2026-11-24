// 📱 Móvil del profe como cámara del Corrector (pikt.es/?corregir=CODIGO).
// Lee cada hoja (nº de lista + respuestas) y la manda al ordenador, que pone la nota y
// se la devuelve. El móvil no conoce la clave: marca en azul lo que ha leído.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import CamaraTarjetas from '../tarjetas/CamaraTarjetas.jsx';
import { leerHoja, MARCAS } from './omr.js';
import { pintarLectura, crearConfirmador } from './dibujo.js';
import { hayEscritas, leerEscritas } from './escritas.js';
import { escucharCorrector, enviarHoja, latidoCorrector, TIPO_CORRECTOR } from './escanerCorrector.js';
import { sonidoCorrecto, sonidoIncorrecto, despertarAudio } from '../utils/sonidosFeedback';

const IDS = new Set(MARCAS.map((m) => m.tarjeta));

export default function CorrectorMovil({ codigoInicial = '', onExit }) {
  const [codigo, setCodigo] = useState(String(codigoInicial || '').toUpperCase().trim());
  const [escrito, setEscrito] = useState('');
  const [sesion, setSesion] = useState(undefined);
  const [estado, setEstado] = useState('Enfoca una hoja (que se vean las 4 esquinas negras).');
  const [cartel, setCartel] = useState(null); // { lista, nota… } | { clave: true }
  const [enviadas, setEnviadas] = useState(0);
  const [error, setError] = useState('');

  const sesionRef = useRef(null);
  sesionRef.current = sesion;
  const lecturaRef = useRef(null);
  const confirmador = useRef(crearConfirmador(3));
  const ultimaFirma = useRef('');
  const pendienteId = useRef(null);
  const ocupado = useRef(false); // leyendo las casillas escritas
  const estadoRef = useRef('');
  const ponerEstado = (t) => { if (estadoRef.current !== t) { estadoRef.current = t; setEstado(t); } };

  useEffect(() => {
    if (!codigo) return undefined;
    setSesion(undefined);
    return escucharCorrector(codigo, (d) => setSesion(d && d.tipoJuego === TIPO_CORRECTOR ? d : null), () => setSesion(null));
  }, [codigo]);

  // Nota que devuelve el ordenador para la última hoja enviada
  useEffect(() => {
    const id = pendienteId.current;
    const n = id && sesion?.notas?.[id];
    if (!n) return;
    pendienteId.current = null;
    setCartel(n);
    (n.nota >= 5 ? sonidoCorrecto : sonidoIncorrecto)();
  }, [sesion]);

  useEffect(() => {
    if (!codigo || !sesion) return undefined;
    latidoCorrector(codigo);
    const t = setInterval(() => latidoCorrector(codigo), 5000);
    return () => clearInterval(t);
  }, [codigo, !!sesion]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let lock = null, vivo = true;
    const pedir = () => navigator.wakeLock?.request?.('screen').then((l) => { if (vivo) lock = l; else l.release(); }).catch(() => {});
    pedir();
    const vis = () => { if (document.visibilityState === 'visible') pedir(); };
    document.addEventListener('visibilitychange', vis);
    return () => { vivo = false; document.removeEventListener('visibilitychange', vis); lock?.release?.().catch?.(() => {}); };
  }, []);

  const onFotograma = useCallback((img, dets) => {
    const s = sesionRef.current;
    if (!s) return;
    const marcas = dets.filter((d) => IDS.has(d.tarjeta));
    if (marcas.length < 3) { lecturaRef.current = null; confirmador.current.reiniciar(); ponerEstado(marcas.length ? `Veo ${marcas.length} de las 4 esquinas: encuadra la hoja entera.` : 'Enfoca una hoja (que se vean las 4 esquinas negras).'); return; }
    if (ocupado.current) return;
    const r = leerHoja(img, marcas, { nPreguntas: s.nPreguntas, nOpciones: s.nOpciones, nEscritas: s.nEscritas || 0, letras: s.letras || 8 });
    if (!r.ok) { lecturaRef.current = null; confirmador.current.reiniciar(); ponerEstado(r.motivo === 'lejos' ? 'Acércate un poco más.' : 'Una parte de la hoja se sale de la imagen.'); return; }
    lecturaRef.current = { r, t: Date.now() };
    const modo = s.modo || 'alumnos';
    const firma = confirmador.current.actualizar(r, modo);
    if (!firma) { ponerEstado('Leyendo… no muevas el móvil'); return; }
    if (firma === ultimaFirma.current) return; // ya enviada: hasta que cambie la hoja
    if (modo === 'alumnos' && !r.lista) { ponerEstado('No leo el nº de lista: falta rellenar decenas o unidades.'); return; }
    ultimaFirma.current = firma;
    setCartel(modo === 'clave' ? { clave: true } : { lista: r.lista, enviando: true });
    ponerEstado(modo === 'clave' ? '🔑 Clave enviada al ordenador' : `📤 Nº ${r.lista} enviada`);
    if (modo === 'clave') sonidoCorrecto();
    // Respuestas escritas: se leen aquí y viajan solo las probabilidades de cada casilla (sin imagen)
    ocupado.current = true;
    (hayEscritas(s) ? leerEscritas(r, s, () => false) : Promise.resolve([]))
      .then((escritas) => enviarHoja(codigo, { lista: r.lista, respuestas: r.respuestas, dudosas: r.dudosas, escritas, modo }))
      .then((id) => { if (modo === 'alumnos') pendienteId.current = id; setEnviadas((n) => n + 1); setError(''); })
      .catch(() => { ultimaFirma.current = ''; setError('No se pudo enviar (¿sin red?). Vuelve a enfocar la hoja.'); })
      .finally(() => { ocupado.current = false; });
  }, [codigo]);

  const pintarExtra = useCallback((ctx, ex) => {
    const L = lecturaRef.current, s = sesionRef.current;
    if (!L || !s || Date.now() - L.t > 700) return;
    pintarLectura(ctx, L.r, { nPreguntas: s.nPreguntas, nOpciones: s.nOpciones, nEscritas: s.nEscritas || 0, letras: s.letras || 8, ex });
  }, []);

  if (!codigo) {
    return (
      <div style={st.pantalla}>
        <div style={st.caja}>
          <h2 style={{ margin: '0 0 8px' }}>📱 Corrector · cámara del móvil</h2>
          <p style={st.ayuda}>Escribe el código que sale en el ordenador (Corrector de exámenes → 2 · Corregir → 📱 Móvil).</p>
          <form onSubmit={(e) => { e.preventDefault(); setCodigo(escrito.toUpperCase().trim()); }} style={{ display: 'flex', gap: 8 }}>
            <input value={escrito} onChange={(e) => setEscrito(e.target.value)} placeholder="C…" autoCapitalize="characters" style={st.input} />
            <button type="submit" style={st.boton('#0f766e')}>Entrar</button>
          </form>
          {onExit && <button onClick={onExit} style={{ ...st.boton('#334155'), marginTop: 14 }}>Salir</button>}
        </div>
      </div>
    );
  }
  if (sesion === undefined) return <div style={st.pantalla}><p>Conectando con el ordenador…</p></div>;
  if (sesion === null) {
    return (
      <div style={st.pantalla}>
        <div style={st.caja}>
          <h2 style={{ margin: '0 0 8px' }}>🔍 No encuentro la sesión</h2>
          <p style={st.ayuda}>No hay ninguna corrección abierta con el código {codigo}, o ya se ha cerrado en el ordenador.</p>
          <button onClick={() => { setCodigo(''); setEscrito(''); }} style={st.boton('#2563eb')}>Escribir otro código</button>
        </div>
      </div>
    );
  }

  return (
    <div style={st.pantalla} onClick={despertarAudio}>
      <div style={st.cabecera}>
        <b>📱 {codigo}</b>
        <span style={{ flex: 1, textAlign: 'center' }}>{sesion.modo === 'clave' ? '🔑 Leyendo la CLAVE' : `${sesion.nPreguntas} preguntas · ${enviadas} enviadas`}</span>
      </div>
      <div style={{ position: 'relative' }}>
        <CamaraTarjetas activo maxTarjeta={64} onDetecciones={null} etiqueta={() => ({ texto: '', color: '#38bdf8' })}
          onFotograma={onFotograma} pintarExtra={pintarExtra} alto="62vh" compacta textoContador={(n) => `📄 ${Math.min(4, n)}/4 esquinas`} />
        {cartel && !cartel.clave && (
          <div style={st.cartel(cartel.enviando ? null : cartel.nota >= 5)}>
            <div style={{ fontSize: 14 }}>Nº {cartel.lista}</div>
            {cartel.enviando ? <div style={{ fontSize: 20, fontWeight: 900 }}>Enviando…</div> : (
              <>
                <div style={{ fontSize: 36, fontWeight: 900, lineHeight: 1.1 }}>{String(cartel.nota).replace('.', ',')}</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>✅ {cartel.aciertos} · ❌ {cartel.fallos} · ⚪ {cartel.blancos}{cartel.pendientes ? ` · 🔍 ${cartel.pendientes}` : ''}</div>
              </>
            )}
          </div>
        )}
      </div>
      <div style={st.estado}>{estado}</div>
      {error && <div style={{ ...st.estado, background: '#7f1d1d' }}>{error}</div>}
      <p style={{ ...st.ayuda, textAlign: 'center' }}>Pasa las hojas una a una. La nota sale cuando el ordenador la corrige; la tabla completa está en el ordenador.</p>
    </div>
  );
}

const st = {
  pantalla: { minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', padding: '10px 10px 24px', boxSizing: 'border-box', gap: 8 },
  caja: { background: 'rgba(255,255,255,0.06)', border: '1px solid #334155', borderRadius: 16, padding: 20, maxWidth: 420, width: '100%', margin: '40px auto 0', boxSizing: 'border-box', textAlign: 'center' },
  ayuda: { color: '#94a3b8', fontSize: 14, lineHeight: 1.5 },
  input: { flex: 1, minWidth: 0, padding: '12px 14px', borderRadius: 12, border: '1px solid #475569', background: '#020617', color: '#f1f5f9', fontSize: 22, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase' },
  boton: (bg) => ({ padding: '14px 22px', borderRadius: 14, border: 'none', background: bg, color: '#fff', fontWeight: 800, fontSize: 18, cursor: 'pointer', width: '100%' }),
  cabecera: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 15 },
  estado: { textAlign: 'center', fontWeight: 700, fontSize: 15, background: '#1e293b', borderRadius: 10, padding: '8px 10px' },
  cartel: (ok) => ({ position: 'absolute', left: '50%', bottom: 40, transform: 'translateX(-50%)', background: ok === null ? 'rgba(37,99,235,0.93)' : ok ? 'rgba(22,163,74,0.93)' : 'rgba(220,38,38,0.93)', color: '#fff', borderRadius: 16, padding: '8px 20px', textAlign: 'center', minWidth: 160, pointerEvents: 'none' }),
};
