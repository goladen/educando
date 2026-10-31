// Cargar un test en el mBot2: la pregunta se oye por el altavoz del CyberPi, las respuestas se
// ven en su pantalla y se responde con su joystick. Todo queda guardado en la placa, en la
// ranura 8: después funciona sin cable, sin ordenador y sin Wi-Fi.
import React, { useMemo, useRef, useState } from 'react';
import { auth } from '../firebase';
import SelectorRecursoMandos, { hojasQuiz } from '../mandos/SelectorRecursoMandos.jsx';
import { barajar } from '../mandos/QuizMandos.jsx';
import { cargarTestEnRobot, desconectarCyberpi, prepararCargaTest, soportaSerialCyberpi } from './cyberpiMbot.js';

const VOCES = [
  ['es-ES-ElviraNeural', '🇪🇸 Español'],
  ['ca-ES-JoanaNeural', 'Català'],
  ['en-GB-SoniaNeural', '🇬🇧 English'],
  ['fr-FR-DeniseNeural', '🇫🇷 Français'],
];
const OPCIONES_NUM = [5, 10, 15, 20];
const BYTES_POR_SEGUNDO = 875; // medido con la placa por USB

function base64ABytes(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function generarVoz(texto, voz, token) {
  const r = await fetch('/api/listening-tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ texto, voz, rate: '-5%', soloAudio: true }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.audioBase64) throw new Error(d.error || 'No se ha podido generar la voz.');
  return base64ABytes(d.audioBase64);
}

const minutos = (seg) => (seg < 90 ? `${Math.max(1, Math.round(seg))} s` : `${Math.round(seg / 60)} min`);

export default function CargarTestRobot({ onExit }) {
  const [recurso, setRecurso] = useState(null);
  const [hoja, setHoja] = useState(-1);
  const [cuantas, setCuantas] = useState(10);
  const [voz, setVoz] = useState(VOCES[0][0]);
  const [fase, setFase] = useState('elegir'); // elegir | cargando | hecho
  const [prog, setProg] = useState({ txt: '', p: 0 });
  const [error, setError] = useState('');
  const [resumen, setResumen] = useState(null);
  const cancelar = useRef(false);

  const hojas = useMemo(() => (recurso ? hojasQuiz(recurso) : []), [recurso]);
  const preguntas = useMemo(() => {
    const lista = hoja >= 0 ? hojas[hoja]?.preguntas || [] : hojas.flatMap((h) => h.preguntas);
    return lista.filter((q) => q.opciones.length >= 2 && q.opciones.length <= 4 && q.correcta >= 0);
  }, [hojas, hoja]);

  const empezar = async () => {
    setError('');
    const user = auth.currentUser;
    if (!user) return setError('Inicia sesión para generar la voz de las preguntas.');
    cancelar.current = false;
    try {
      // Lo primero, el puerto: el navegador solo abre esa ventana justo después del clic.
      if (!(await prepararCargaTest())) return undefined;
      setFase('cargando');
      const token = await user.getIdToken();
      const elegidas = barajar(preguntas).slice(0, cuantas);
      const listas = [];
      for (let i = 0; i < elegidas.length; i++) {
        if (cancelar.current) throw new Error('Carga cancelada.');
        setProg({ txt: `Generando la voz: pregunta ${i + 1} de ${elegidas.length}`, p: (i / elegidas.length) * 0.1 });
        const q = elegidas[i];
        const correcta = q.opciones[q.correcta];
        const opciones = barajar(q.opciones);
        listas.push({ mp3: await generarVoz(q.texto, voz, token), opciones, correcta: opciones.indexOf(correcta) });
      }
      const total = listas.reduce((s, q) => s + q.mp3.length, 0);
      const inicio = Date.now();
      await cargarTestEnRobot(listas, {
        cancelado: () => cancelar.current,
        onProgreso: (hechos, txt) => {
          const seg = hechos > 0 ? ((Date.now() - inicio) / hechos) * (total - hechos) / 1000 : total / BYTES_POR_SEGUNDO;
          setProg({ txt: `${txt} · faltan unos ${minutos(seg)}`, p: 0.1 + (hechos / total) * 0.9 });
        },
      });
      setResumen({ n: listas.length, kb: Math.round(total / 1024) });
      setFase('hecho');
    } catch (e) {
      await desconectarCyberpi().catch(() => {});
      setError(e?.message || String(e));
      setFase('elegir');
    }
    return undefined;
  };

  const seg = (cuantas * 30000) / BYTES_POR_SEGUNDO;

  return (
    <div style={st.wrap}>
      <div style={st.cabecera}>
        <button onClick={onExit} disabled={fase === 'cargando'} style={st.btnSec}>← Salir</button>
        <b style={{ fontSize: '1.05rem' }}>🗣️ Cargar un test en el mBot2</b>
      </div>
      <div style={st.cuerpo}>
        {fase === 'hecho' && (
          <div style={st.caja}>
            <div style={{ fontSize: '2.6rem', textAlign: 'center' }}>✅</div>
            <h3 style={{ textAlign: 'center', margin: '4px 0' }}>Test guardado en el robot</h3>
            <p style={{ textAlign: 'center', color: '#94a3b8', margin: '0 0 10px' }}>{resumen?.n} preguntas · {resumen?.kb} KB</p>
            <ol style={st.lista}>
              <li>Quita el cable USB.</li>
              <li>En el menú del CyberPi entra en <b>switch program</b> y elige el <b>8</b>.</li>
              <li>Pulsa el <b>botón A</b> o <b>🗣️ Preguntar</b> en «Conducir el mBot2»: <b>se oye la pregunta</b> y salen las respuestas en la pantalla.</li>
              <li><b>Joystick arriba y abajo</b> para elegir · <b>púlsalo</b> para responder · <b>botón A</b> para repetirla.</li>
            </ol>
            <button onClick={() => setFase('elegir')} style={st.btn}>Cargar otro test</button>
          </div>
        )}

        {fase === 'cargando' && (
          <div style={st.caja}>
            <h3 style={{ margin: '0 0 8px' }}>⏳ Cargando… no desconectes el cable</h3>
            <div style={{ height: 14, borderRadius: 8, background: '#334155', overflow: 'hidden' }}>
              <div style={{ width: `${Math.round(prog.p * 100)}%`, height: '100%', background: '#22c55e', transition: 'width .3s' }} />
            </div>
            <p style={{ color: '#cbd5e1', fontSize: '0.88rem' }}>{prog.txt}</p>
            <button onClick={() => { cancelar.current = true; }} style={st.btnSec}>Cancelar</button>
          </div>
        )}

        {fase === 'elegir' && (
          <>
            <div style={st.caja}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                El robot <b>lee la pregunta en voz alta</b>, muestra las respuestas en su pantalla y se contesta con su <b>joystick</b>.
                Queda guardado en la placa: después funciona sin cable ni internet. Se usa la <b>ranura 8</b> de «switch program».
              </p>
            </div>
            <div style={{ background: '#fff', color: '#0f172a', borderRadius: 14, padding: 10 }}>
              <SelectorRecursoMandos seleccionado={recurso} onPick={(r) => { setRecurso(r); setHoja(-1); }} />
            </div>
            {recurso && (
              <div style={st.caja}>
                <b>{recurso.titulo}</b>
                {hojas.length > 1 && (
                  <select value={hoja} onChange={(e) => setHoja(Number(e.target.value))} style={st.select}>
                    <option value={-1}>Todas las hojas</option>
                    {hojas.map((h, i) => <option key={h.nombre + i} value={i}>{h.nombre} ({h.preguntas.length})</option>)}
                  </select>
                )}
                <div style={st.fila}>
                  <label style={st.etq}>
                    Preguntas
                    <select value={cuantas} onChange={(e) => setCuantas(Number(e.target.value))} style={st.select}>
                      {OPCIONES_NUM.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                  <label style={st.etq}>
                    Voz
                    <select value={voz} onChange={(e) => setVoz(e.target.value)} style={st.select}>
                      {VOCES.map(([id, t]) => <option key={id} value={id}>{t}</option>)}
                    </select>
                  </label>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  {preguntas.length} preguntas de 2 a 4 opciones disponibles. Se eligen al azar. La carga tarda unos {minutos(seg)} (depende de lo largas que sean).
                  Sustituye el test anterior guardado en el robot.
                </p>
                <button onClick={empezar} disabled={!preguntas.length || !soportaSerialCyberpi()} style={st.btn}>🔌 Conectar por USB y cargar</button>
                {!soportaSerialCyberpi() && <p style={{ color: '#f97316', fontSize: '0.85rem' }}>Necesitas Chrome o Edge en un ordenador.</p>}
              </div>
            )}
            {error && <div style={{ ...st.caja, color: '#fb923c', fontWeight: 700 }}>⚠️ {error}</div>}
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>
              Conecta el CyberPi del robot por USB con el menú inicial a la vista y cierra mBlock y el editor de bloques.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const st = {
  wrap: { position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 100%)', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' },
  cabecera: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: 'rgba(15,23,42,0.85)', flexWrap: 'wrap' },
  cuerpo: { flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 720, width: '100%', margin: '0 auto', boxSizing: 'border-box' },
  caja: { background: 'rgba(30,41,59,0.9)', border: '1px solid #334155', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 },
  fila: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  etq: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8rem', fontWeight: 700 },
  select: { padding: '7px 8px', borderRadius: 8, fontWeight: 600 },
  lista: { margin: '0 0 12px', paddingLeft: 22, lineHeight: 1.7, fontSize: '0.92rem' },
  btn: { padding: '11px 16px', borderRadius: 10, border: 'none', background: '#22c55e', color: '#052e16', fontWeight: 800, cursor: 'pointer', fontSize: '0.95rem' },
  btnSec: { padding: '7px 12px', borderRadius: 9, border: '1px solid #475569', background: 'transparent', color: '#e2e8f0', fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start' },
};
