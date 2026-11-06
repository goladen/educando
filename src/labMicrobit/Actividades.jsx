// Actividades de clase con las micro:bit (Laboratorio): 🎲 dados (probabilidad), 🎵 orquesta y theremín,
// 📟 pantallas (texto / iconos / sorteo), 🔌 pines con sensores externos y 🔥 frío o caliente.
// Modos del instrumento en programasLab.js (DA, MU, PI, FC + órdenes I:T e I:V). Todas tienen simulación.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { enviarAInstrumentos } from '../mandos/mandosMicrobit.js';
import { useInstrumentos, useModoInstrumento, useTodasInstrumento } from './useInstrumentos';
import { fmt } from './trilateracion';
import { st } from './estilosLab';

function Fuente({ fuente, setFuente, radio, texto }) {
  return (
    <div style={st.caja}>
      <div style={st.fila}>
        <button style={st.chip(fuente === 'placa')} disabled={!radio} onClick={() => setFuente('placa')}>📡 Con las micro:bit</button>
        <button style={st.chip(fuente === 'sim')} onClick={() => setFuente('sim')}>🧪 Simulación</button>
      </div>
      {!radio && <div style={st.nota}>Conecta la antena (arriba) para usar las placas.</div>}
      {fuente === 'placa' && <div style={st.nota}>{texto}</div>}
    </div>
  );
}

const ids = (vistas) => Object.keys(vistas).filter((id) => Date.now() - vistas[id].t < 30000).map(Number).sort((a, b) => a - b);

/* ═══════════════════════════ 🎲 DADOS ═══════════════════════════ */

export function Dados({ radio, excluir }) {
  const [fuente, setFuente] = useState(radio ? 'placa' : 'sim');
  const [caras, setCaras] = useState(6);
  const [n, setN] = useState(1);
  const [tiradas, setTiradas] = useState([]); // { id, vals }
  const placa = fuente === 'placa' && radio;
  const vistas = useTodasInstrumento(placa, `DA:${caras}:${n}`, excluir);
  useEffect(() => setTiradas([]), [caras, n]);
  useInstrumentos((ev) => { if (placa && ev.tipo === 'D' && ev.vals.length) setTiradas((t) => [...t, { id: ev.id, vals: ev.vals.slice(0, n) }]); });
  const tira = () => Array.from({ length: n }, () => 1 + Math.floor(Math.random() * caras));
  const simular = (k) => setTiradas((t) => [...t, ...Array.from({ length: k }, () => ({ id: 0, vals: tira() }))]);

  const min = n, max = n * caras;
  const valores = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const cuenta = useMemo(() => {
    const c = {};
    tiradas.forEach((t) => { const s = t.vals.reduce((a, b) => a + b, 0); c[s] = (c[s] || 0) + 1; });
    return c;
  }, [tiradas]);
  const teorica = (s) => (n === 1 ? 1 / caras : (caras - Math.abs(s - (caras + 1))) / (caras * caras));
  const N = tiradas.length;
  const media = N ? tiradas.reduce((a, t) => a + t.vals.reduce((x, y) => x + y, 0), 0) / N : 0;
  const esperada = (n * (caras + 1)) / 2;
  const topP = Math.max(...valores.map((s) => Math.max(teorica(s), N ? (cuenta[s] || 0) / N : 0)), 0.01);
  const porPlaca = {};
  tiradas.forEach((t) => { if (t.id) porPlaca[t.id] = (porPlaca[t.id] || 0) + 1; });

  const W = 640, H = 220, ml = 34, mb = 26, ancho = (W - ml - 10) / valores.length;
  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Fuente fuente={fuente} setFuente={setFuente} radio={radio}
        texto={<>Todas las placas son dados: <b>agítalas</b> y cada tirada aparece aquí (la placa enseña su resultado). Placas conectadas: {ids(vistas).length || '—'}</>} />
      <div style={st.caja}>
        <div style={{ ...st.fila, gap: 14 }}>
          <span>Caras: {[4, 6, 8, 10, 12, 20].map((c) => <button key={c} style={st.chip(caras === c)} onClick={() => setCaras(c)}>{c}</button>)}</span>
          <span>Dados: {[1, 2].map((k) => <button key={k} style={st.chip(n === k)} onClick={() => setN(k)}>{k === 1 ? 'uno' : 'dos (se suman)'}</button>)}</span>
          <button style={st.mini} onClick={() => setTiradas([])}>↺ Empezar de nuevo</button>
        </div>
        {fuente === 'sim' && (
          <div style={{ ...st.fila, marginTop: 8 }}>
            🧪 Lanzar: {[1, 10, 100, 1000].map((k) => <button key={k} style={st.btn('#0ea5e9')} onClick={() => simular(k)}>{k}</button>)}
          </div>
        )}
      </div>
      <div style={st.caja}>
        <b>{N} tiradas</b> · media <b>{fmt(media, 2)}</b> (la teórica es {fmt(esperada, 2)})
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', marginTop: 6 }} role="img" aria-label="Frecuencia relativa de cada resultado frente a su probabilidad">
          {valores.map((s, i) => {
            const fr = N ? (cuenta[s] || 0) / N : 0, p = teorica(s);
            const x = ml + i * ancho, y = (v) => H - mb - (v / topP) * (H - mb - 10);
            return (
              <g key={s}>
                <rect x={x + 2} y={y(fr)} width={Math.max(1, ancho - 4)} height={H - mb - y(fr)} rx="3" fill="#38bdf8" />
                <line x1={x + 1} x2={x + ancho - 1} y1={y(p)} y2={y(p)} stroke="#facc15" strokeWidth="3" />
                {(valores.length <= 24 || s % 2 === 0) && <text x={x + ancho / 2} y={H - 8} fill="#94a3b8" fontSize="11" textAnchor="middle">{s}</text>}
              </g>
            );
          })}
        </svg>
        <div style={st.nota}>
          <span style={{ color: '#38bdf8' }}>■</span> frecuencia relativa (veces que sale ÷ tiradas) · <span style={{ color: '#facc15' }}>━</span> probabilidad teórica
          {n === 2 ? ` (con dos dados el ${caras + 1} es lo más probable: hay más formas de sumarlo)` : ' (todas iguales: 1/' + caras + ')'}.
          Con pocas tiradas las barras bailan; cuantas más tiradas, más se acercan a la línea amarilla: es la <b>ley de los grandes números</b>.
        </div>
      </div>
      {Object.keys(porPlaca).length > 0 && (
        <div style={st.caja}>
          <b>Tiradas de cada placa</b>
          <div style={{ ...st.fila, marginTop: 6 }}>{Object.entries(porPlaca).map(([id, c]) => <span key={id} style={st.chip(false)}>Placa {id}: {c}</span>)}</div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════ 🎵 ORQUESTA ═══════════════════════════ */

const HZ = { G3: 196, A3: 220, B3: 247, C4: 262, D4: 294, E4: 330, F4: 349, G4: 392, A4: 440, B4: 494, C5: 523, D5: 587, E5: 659 };
const melodia = (txt) => txt.split(',').map((x) => { const [nota, d] = x.trim().split(' '); return [nota, Number(d)]; });
const CANCIONES = [
  {
    id: 'martinillo', nombre: 'Martinillo (canon a 4 voces)', voces: 4, entrada: 8,
    notas: melodia('C4 1,D4 1,E4 1,C4 1,C4 1,D4 1,E4 1,C4 1,E4 1,F4 1,G4 2,E4 1,F4 1,G4 2,G4 .5,A4 .5,G4 .5,F4 .5,E4 1,C4 1,G4 .5,A4 .5,G4 .5,F4 .5,E4 1,C4 1,C4 1,G3 1,C4 2,C4 1,G3 1,C4 2'),
    nota: 'Cada grupo de placas empieza 2 compases después del anterior: la misma melodía suena encima de sí misma y encaja.',
  },
  {
    id: 'alegria', nombre: 'Himno de la alegría (Beethoven)', voces: 1, entrada: 0,
    notas: melodia('E4 1,E4 1,F4 1,G4 1,G4 1,F4 1,E4 1,D4 1,C4 1,C4 1,D4 1,E4 1,E4 1.5,D4 .5,D4 2,E4 1,E4 1,F4 1,G4 1,G4 1,F4 1,E4 1,D4 1,C4 1,C4 1,D4 1,E4 1,D4 1.5,C4 .5,C4 2'),
    nota: 'Todas las placas tocan la melodía a la vez (al unísono).',
  },
  {
    id: 'acordes', nombre: 'Acordes: do, fa, sol, do', voces: 3, acordes: [['C4', 'E4', 'G4'], ['F4', 'A4', 'C5'], ['G4', 'B4', 'D5'], ['C4', 'E4', 'G4']],
    nota: 'Las placas se reparten en 3 grupos y cada grupo toca una nota del acorde: tres notas a la vez forman la armonía.',
  },
  {
    id: 'escala', nombre: 'Escala humana (cada placa una nota)', voces: 8, escala: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'],
    nota: 'Cada placa es una tecla: ordenad a los alumnos de la nota más grave a la más aguda. Sube y baja la escala.',
  },
];

let ctxAudio = null;
function sonarAqui(hz, ms) {
  try {
    ctxAudio = ctxAudio || new (window.AudioContext || window.webkitAudioContext)();
    const o = ctxAudio.createOscillator(), g = ctxAudio.createGain(), t = ctxAudio.currentTime;
    o.type = 'triangle'; o.frequency.value = hz;
    g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + ms / 1000);
    o.connect(g).connect(ctxAudio.destination); o.start(t); o.stop(t + ms / 1000);
  } catch { /* sin audio */ }
}

/** Eventos { t (pulsos), voz, nota, dur } de una canción. */
function eventosDe(c) {
  const ev = [];
  if (c.acordes) c.acordes.forEach((a, j) => a.forEach((nota, v) => ev.push({ t: j * 2, voz: v, nota, dur: 2 })));
  else if (c.escala) [...c.escala, ...c.escala.slice(0, -1).reverse()].forEach((nota, j) => ev.push({ t: j * 0.75, voz: c.escala.indexOf(nota), nota, dur: 0.7 }));
  else for (let v = 0; v < c.voces; v++) {
    let t = v * c.entrada;
    c.notas.forEach(([nota, d]) => { ev.push({ t, voz: v, nota, dur: d }); t += d; });
  }
  return ev;
}

export function Orquesta({ radio, excluir }) {
  const [fuente, setFuente] = useState(radio ? 'placa' : 'sim');
  const [cancion, setCancion] = useState(CANCIONES[0].id);
  const [bpm, setBpm] = useState(100);
  const [aqui, setAqui] = useState(!radio);
  const [theremin, setTheremin] = useState(false);
  const [sonando, setSonando] = useState(null); // voz activa (para pintar)
  const [tocando, setTocando] = useState(false);
  const placa = fuente === 'placa' && radio;
  const vistas = useTodasInstrumento(placa, theremin ? 'MU' : 'OQ', excluir);
  const timers = useRef([]);
  const c = CANCIONES.find((x) => x.id === cancion);
  const lista = ids(vistas);
  const vozDe = (i) => (c.escala ? i % c.escala.length : i % c.voces);

  const parar = () => {
    timers.current.forEach(clearTimeout); timers.current = [];
    setTocando(false); setSonando(null);
    if (placa) enviarAInstrumentos('I:T:*:0:0');
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => { if (placa) lista.forEach((id, i) => enviarAInstrumentos(`I:V:${id}:${vozDe(i) + 1}`)); }, [placa, cancion, lista.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const tocar = () => {
    parar();
    const pulso = 60000 / bpm;
    const ev = eventosDe(c);
    ev.forEach((e) => {
      timers.current.push(setTimeout(() => {
        const ms = Math.round(e.dur * pulso * 0.9);
        setSonando(e.voz);
        if (aqui || !placa) sonarAqui(HZ[e.nota], ms);
        if (placa) {
          const suyas = lista.filter((_, i) => vozDe(i) === e.voz);
          (suyas.length ? suyas : lista.length ? [lista[e.voz % lista.length]] : []).forEach((id) => enviarAInstrumentos(`I:T:${id}:${HZ[e.nota]}:${ms}`));
        }
      }, e.t * pulso));
    });
    const fin = Math.max(...ev.map((e) => e.t + e.dur)) * pulso;
    timers.current.push(setTimeout(() => { setTocando(false); setSonando(null); }, fin + 200));
    setTocando(true);
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Fuente fuente={fuente} setFuente={setFuente} radio={radio}
        texto={<>Cada placa enseña su número de grupo (voz) y toca sus notas por su altavoz. Placas conectadas: {lista.length || '—'}</>} />
      <div style={st.caja}>
        <div style={st.fila}>{CANCIONES.map((x) => <button key={x.id} style={st.chip(cancion === x.id)} onClick={() => { parar(); setCancion(x.id); }}>{x.nombre}</button>)}</div>
        <div style={st.nota}>{c.nota}</div>
        <div style={{ ...st.fila, marginTop: 8, gap: 14 }}>
          <label style={{ ...st.label, flex: '1 1 200px' }}>Tempo: {bpm} pulsos por minuto
            <input type="range" min={50} max={180} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={aqui || !placa} disabled={!placa} onChange={(e) => setAqui(e.target.checked)} /> Que suene también en el ordenador
          </label>
          {tocando ? <button style={st.btn('#dc2626')} onClick={parar}>⏹️ Parar</button> : <button style={st.btn('#16a34a')} onClick={tocar}>▶️ Tocar</button>}
        </div>
        <div style={{ ...st.fila, marginTop: 10 }}>
          {Array.from({ length: c.escala ? c.escala.length : c.voces }, (_, v) => (
            <span key={v} style={{ ...st.chip(sonando === v), minWidth: 90, textAlign: 'center' }}>
              {c.escala ? c.escala[v].replace(/\d/, '') : `Voz ${v + 1}`}{placa && ` · ${lista.filter((_, i) => vozDe(i) === v).map((id) => 'P' + id).join(' ') || '—'}`}
            </span>
          ))}
        </div>
      </div>
      <div style={st.caja}>
        <b>🎻 Theremín</b>
        <div style={st.nota}>Cada placa es un instrumento: <b>manteniendo A</b> suena; <b>inclinándola a los lados</b> cambia de nota (la escala de do) y con <b>B</b> sube una octava. Las luces enseñan la altura de la nota.</div>
        <button style={{ ...st.btn(theremin ? '#dc2626' : '#a855f7'), marginTop: 8 }} disabled={!placa} onClick={() => { parar(); setTheremin((t) => !t); }}>
          {theremin ? '⏹️ Terminar el theremín' : '🎻 Convertir las placas en theremines'}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════ 📟 PANTALLAS ═══════════════════════════ */

const ICONOS = [['HEART', '❤️'], ['HAPPY', '🙂'], ['SAD', '🙁'], ['YES', '✔️'], ['NO', '✖️'], ['ARROW_N', '⬆️'], ['STAR', '⭐'], ['GHOST', '👻'], ['DUCK', '🦆'], ['MUSIC_QUAVER', '🎵'], ['SKULL', '💀'], ['TARGET', '🎯']];
const sinTildes = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '');

export function Pantallas({ radio, excluir }) {
  const vistas = useTodasInstrumento(radio, 'PV', excluir);
  const lista = ids(vistas);
  const [destino, setDestino] = useState('*');
  const [texto, setTexto] = useState('');
  const [elegida, setElegida] = useState(null);
  const enviar = (contenido, a = destino) => enviarAInstrumentos(`I:V:${a}:${contenido}`);
  const sorteo = () => {
    if (!lista.length) return;
    const g = lista[Math.floor(Math.random() * lista.length)];
    setElegida(g);
    lista.forEach((id) => enviar(id === g ? '#YES' : '#NO', id));
    enviarAInstrumentos(`I:T:${g}:880:400`);
  };

  if (!radio) return <div style={st.aviso}>Conecta la antena (arriba) y enciende las placas.</div>;
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={st.caja}>
        <b>¿A quién?</b>
        <div style={{ ...st.fila, marginTop: 6 }}>
          <button style={st.chip(destino === '*')} onClick={() => setDestino('*')}>Todas</button>
          {lista.map((id) => <button key={id} style={st.chip(destino === String(id))} onClick={() => setDestino(String(id))}>Placa {id}</button>)}
          {!lista.length && <span style={st.nota}>⏳ Esperando a las placas…</span>}
        </div>
      </div>
      <div style={st.caja}>
        <b>Texto</b>
        <div style={{ ...st.fila, marginTop: 6 }}>
          <input value={texto} maxLength={20} onChange={(e) => setTexto(sinTildes(e.target.value))} placeholder="HOLA, TU TURNO, 3…" style={{ ...st.input, flex: 1 }} onKeyDown={(e) => { if (e.key === 'Enter' && texto) enviar(texto); }} />
          <button style={st.btn('#0ea5e9')} disabled={!texto} onClick={() => enviar(texto)}>📟 Enseñar</button>
        </div>
        <div style={st.nota}>Sin tildes ni ñ (las luces de la micro:bit no las tienen). Máximo 20 letras.</div>
        <b style={{ display: 'block', marginTop: 10 }}>Iconos</b>
        <div style={{ ...st.fila, marginTop: 6 }}>{ICONOS.map(([k, e]) => <button key={k} style={st.btn('#334155')} onClick={() => enviar('#' + k)}>{e}</button>)}</div>
        <div style={{ ...st.fila, marginTop: 10 }}>
          <button style={st.btn('#475569')} onClick={() => lista.forEach((id) => enviar(String(id), id))}>🔢 Que cada una enseñe su número</button>
          <button style={st.btn('#475569')} onClick={() => enviar(' ', '*')}>🧽 Borrar todas</button>
        </div>
      </div>
      <div style={st.caja}>
        <b>🎯 Sorteo</b>
        <div style={st.nota}>Elige una placa al azar (un grupo que sale a la pizarra, quién empieza…): la elegida enseña ✔ y pita; las demás ✖.</div>
        <div style={{ ...st.fila, marginTop: 8 }}>
          <button style={st.btn('#f59e0b')} disabled={!lista.length} onClick={sorteo}>🎲 Sortear</button>
          {elegida != null && <span style={{ fontSize: 18 }}>Ha salido la <b>placa {elegida}</b></span>}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════ 🔌 PINES ═══════════════════════════ */

const LS_PINES = 'pikt_lab_pines';
const COL_PIN = ['#38bdf8', '#f472b6', '#a3e635'];

export function Pines({ radio }) {
  const [fuente, setFuente] = useState(radio ? 'placa' : 'sim');
  const [nombres, setNombres] = useState(() => { try { return JSON.parse(localStorage.getItem(LS_PINES)) || ['Sensor en P0', 'Sensor en P1', 'Sensor en P2']; } catch { return ['Sensor en P0', 'Sensor en P1', 'Sensor en P2']; } });
  const [ver, setVer] = useState([true, false, false]);
  const [datos, setDatos] = useState([]); // [t (s), p0, p1, p2]
  const [sim, setSim] = useState([400, 700, 100]);
  const t0 = useRef(Date.now());
  useEffect(() => { try { localStorage.setItem(LS_PINES, JSON.stringify(nombres)); } catch { /* nada */ } }, [nombres]);
  useModoInstrumento(fuente === 'placa' && radio ? 'PI' : null);
  const apuntar = (v) => setDatos((d) => [...d.slice(-599), [(Date.now() - t0.current) / 1000, ...v]]);
  useInstrumentos((ev) => { if (fuente === 'placa' && ev.tipo === 'X') apuntar([ev.p0, ev.p1, ev.p2]); });
  useEffect(() => {
    if (fuente !== 'sim') return undefined;
    const t = setInterval(() => apuntar(sim.map((v) => Math.max(0, Math.min(1023, v + (Math.random() - 0.5) * 20)))), 300);
    return () => clearInterval(t);
  }, [fuente, sim]); // eslint-disable-line react-hooks/exhaustive-deps

  const ultimo = datos[datos.length - 1];
  const W = 640, H = 200, tMin = datos[0]?.[0] ?? 0, tMax = Math.max(tMin + 10, ultimo?.[0] ?? 10);
  const X = (t) => 30 + ((t - tMin) / (tMax - tMin)) * (W - 40), Y = (v) => H - 20 - (v / 1023) * (H - 30);
  const csv = () => {
    const filas = ['t (s);' + nombres.join(';'), ...datos.map((d) => d.map((x) => String(Math.round(x * 100) / 100).replace('.', ',')).join(';'))];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([filas.join('\n')], { type: 'text/csv' }));
    a.download = 'pines-microbit.csv'; a.click();
  };
  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Fuente fuente={fuente} setFuente={setFuente} radio={radio}
        texto={<>El <b>instrumento</b> lee sus pines P0, P1 y P2 (de 0 a 1023, es decir, de 0 a 3,3 V) tres veces por segundo.</>} />
      <div style={st.caja}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ ...st.caja, borderColor: ver[i] ? COL_PIN[i] : undefined }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800 }}>
                <input type="checkbox" checked={ver[i]} onChange={(e) => setVer((v) => v.map((x, j) => (j === i ? e.target.checked : x)))} /> P{i}
              </label>
              <input value={nombres[i]} onChange={(e) => setNombres((n) => n.map((x, j) => (j === i ? e.target.value.slice(0, 30) : x)))} style={{ ...st.input, width: '100%', marginTop: 4 }} />
              <div style={{ ...st.grande, fontSize: 30, color: COL_PIN[i] }}>{ultimo ? Math.round(ultimo[i + 1]) : '—'}</div>
              {ultimo && <div style={st.nota}>{fmt((ultimo[i + 1] / 1023) * 100, 0)} % · {fmt((ultimo[i + 1] / 1023) * 3.3, 2)} V</div>}
              {fuente === 'sim' && <input type="range" min={0} max={1023} value={sim[i]} onChange={(e) => setSim((s) => s.map((x, j) => (j === i ? Number(e.target.value) : x)))} style={{ width: '100%' }} />}
            </div>
          ))}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', marginTop: 10, background: 'rgba(0,0,0,.25)', borderRadius: 10 }} role="img" aria-label="Lecturas de los pines a lo largo del tiempo">
          {[0, 512, 1023].map((v) => <g key={v}><line x1={30} x2={W - 10} y1={Y(v)} y2={Y(v)} stroke="rgba(255,255,255,.08)" /><text x={4} y={Y(v) + 4} fill="#94a3b8" fontSize="10">{v}</text></g>)}
          {[0, 1, 2].filter((i) => ver[i]).map((i) => (
            <polyline key={i} fill="none" stroke={COL_PIN[i]} strokeWidth="2" points={datos.map((d) => `${X(d[0])},${Y(d[i + 1])}`).join(' ')} />
          ))}
        </svg>
        <div style={{ ...st.fila, marginTop: 8 }}>
          <button style={st.mini} disabled={!datos.length} onClick={csv}>⬇️ Descargar CSV</button>
          <button style={st.mini} onClick={() => { setDatos([]); t0.current = Date.now(); }}>↺ Borrar</button>
        </div>
      </div>
      <div style={st.caja}>
        <b>🔧 Ideas de sensores</b>
        <ul style={{ margin: '6px 0 0', paddingLeft: 20, color: '#cbd5e1', fontSize: 13.5 }}>
          <li><b>Humedad de la tierra</b> (huerto, plantas del aula): sensor de humedad con 3V, GND y su salida a P0. Más agua → otro valor: calibra con la tierra seca y recién regada.</li>
          <li><b>Luz o temperatura más precisas</b>: una fotorresistencia o un termistor con una resistencia (divisor de tensión).</li>
          <li><b>Pulsador grande</b> (alumnos con dificultades motoras): entre P1 y 3V con una resistencia a GND; se ve el salto de 0 a 1023.</li>
          <li><b>Conductividad</b> (química: agua del grifo, con sal, destilada): dos clavos o pinzas, uno en 3V y otro en P2 con una resistencia a GND.</li>
        </ul>
      </div>
    </div>
  );
}

/* ═══════════════════════════ 🔥 FRÍO O CALIENTE ═══════════════════════════ */

const nivelDe = (rssi) => Math.max(0, Math.min(5, Math.floor((rssi + 95) / 10)));

export function FrioCaliente({ radio }) {
  const [fuente, setFuente] = useState(radio ? 'placa' : 'sim');
  const [rssi, setRssi] = useState(null);
  const [hist, setHist] = useState([]);
  const [dSim, setDSim] = useState(8);
  const ultimas = useRef({});
  useModoInstrumento(fuente === 'placa' && radio ? 'FC' : null);
  const apuntar = (v) => { setRssi(v); setHist((h) => [...h.slice(-80), v]); };
  useInstrumentos((ev) => {
    if (fuente !== 'placa' || ev.tipo !== 'S') return;
    ultimas.current[ev.k] = { v: ev.rssi, t: ev.t };
    const vivas = Object.values(ultimas.current).filter((x) => ev.t - x.t < 2000);
    apuntar(Math.max(...vivas.map((x) => x.v)));
  });
  useEffect(() => {
    if (fuente !== 'sim') return undefined;
    const t = setInterval(() => apuntar(Math.round(-50 - 25 * Math.log10(Math.max(0.3, dSim)) + (Math.random() - 0.5) * 6)), 500);
    return () => clearInterval(t);
  }, [fuente, dSim]); // eslint-disable-line react-hooks/exhaustive-deps

  const nivel = rssi == null ? 0 : nivelDe(rssi);
  const COL = ['#38bdf8', '#38bdf8', '#a3e635', '#facc15', '#f97316', '#ef4444'];
  const TXT = ['🥶 Congelado', '❄️ Frío', '🙂 Templado', '😊 Caliente', '🔥 ¡Muy caliente!', '🔥🔥 ¡Te quemas!'];
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Fuente fuente={fuente} setFuente={setFuente} radio={radio}
        texto={<>Esconde un <b>satélite</b> (el «tesoro»). Los alumnos lo buscan con el <b>instrumento</b>: sus luces suben como unas barras y pita más agudo cuanto más cerca. Sirve también sin mirar la pantalla.</>} />
      <div style={{ ...st.caja, textAlign: 'center' }}>
        <div style={{ fontSize: 'clamp(28px, 6vw, 56px)', fontWeight: 900, color: COL[nivel] }}>{rssi == null ? '…' : TXT[nivel]}</div>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 8, height: 120, marginTop: 10 }}>
          {[1, 2, 3, 4, 5].map((b) => <span key={b} style={{ width: 34, height: b * 22, borderRadius: 6, background: nivel >= b ? COL[b] : '#1e293b' }} />)}
        </div>
        {rssi != null && <div style={st.nota}>Intensidad de la señal: {rssi} dBm (cuanto más cerca de 0, más cerca del tesoro)</div>}
        {fuente === 'sim' && (
          <label style={{ ...st.label, maxWidth: 360, margin: '10px auto 0' }}>🧪 Distancia al tesoro: {fmt(dSim, 1)} m
            <input type="range" min={0.3} max={20} step={0.1} value={dSim} onChange={(e) => setDSim(Number(e.target.value))} />
          </label>
        )}
        <svg viewBox="0 0 400 60" style={{ width: '100%', maxWidth: 500, height: 'auto', marginTop: 10 }} role="img" aria-label="Evolución de la señal">
          <polyline fill="none" stroke="#f97316" strokeWidth="2" points={hist.map((v, i) => `${(i / 80) * 400},${60 - ((Math.max(-100, Math.min(-40, v)) + 100) / 60) * 60}`).join(' ')} />
        </svg>
      </div>
      <div style={st.nota}>
        La señal de radio se debilita con la distancia, pero también con las paredes, los cuerpos y los muebles: a veces «enfría» sin alejarte. ¡Buen momento para hablar de cómo funciona el wifi!
      </div>
    </div>
  );
}
