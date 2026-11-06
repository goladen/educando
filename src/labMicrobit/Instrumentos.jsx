// Instrumentos de mates con una micro:bit: 📐 inclinómetro, 🧭 brújula, 🌡️ sensores y 🪂 caída libre.
// Cada uno funciona con la placa «instrumento» (por la antena) o en simulación.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { montarMini, crearMicrobit3D, pintarLeds, etiqueta3D } from './escenaMini';
import { useInstrumentos, useModoInstrumento } from './useInstrumentos';
import { enviarAInstrumentos } from '../mandos/mandosMicrobit.js';
import { fmt, mediana } from './trilateracion';
import { st } from './estilosLab';

const G = 9.8;
const rad = (g) => (g * Math.PI) / 180;
const grad = (r) => (r * 180) / Math.PI;

function SelectorFuente({ fuente, setFuente, extra }) {
  return (
    <div style={st.caja}>
      <div style={st.fila}>
        <button style={st.chip(fuente === 'placa')} onClick={() => setFuente('placa')}>📡 Con la micro:bit</button>
        <button style={st.chip(fuente === 'sim')} onClick={() => setFuente('sim')}>🧪 Simulación</button>
      </div>
      {fuente === 'placa' && <div style={st.nota}>Enciende la placa <b>instrumento</b>: se pone sola en este modo. El botón <b>A</b> de la placa fija o anota la medida.{extra}</div>}
    </div>
  );
}

/** Monta una escena mini y devuelve una ref con la API (escena, cámara, onFrame). */
function useMini(opciones, construir) {
  const host = useRef(null);
  const api = useRef(null);
  useEffect(() => {
    const m = montarMini({ host: host.current, ...opciones });
    api.current = { ...m, ...construir(m) };
    return () => { m.destroy(); api.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return [host, api];
}

/* ═══════════════════════════ 📐 INCLINÓMETRO ═══════════════════════════ */

// Aceleración medida (mg, ejes de la placa) → ángulos. La placa en reposo mide la gravedad.
// x hacia el botón B, y hacia el conector, z saliendo de la cara de los LED (tumbada: z ≈ −1024).
function angulosDe({ x, y, z }) {
  const n = Math.hypot(x, y, z) || 1;
  return {
    incl: grad(Math.acos(Math.min(1, Math.max(-1, -z / n)))), // con la horizontal
    lado: grad(Math.atan2(x, -z)),
    frente: grad(Math.atan2(y, -z)),
  };
}

export function Inclinometro() {
  const [fuente, setFuente] = useState('sim');
  const [acc, setAcc] = useState({ x: 0, y: 0, z: -1024 });
  const [sim, setSim] = useState({ lado: 0, frente: 25 });
  const [fijado, setFijado] = useState(null);
  const [d, setD] = useState('10');
  const [ojos, setOjos] = useState('1,5');
  useModoInstrumento(fuente === 'placa' ? 'IN' : null);

  const accRef = useRef(acc); accRef.current = acc;
  useInstrumentos((ev) => {
    if (fuente !== 'placa') return;
    if (ev.tipo === 'A') setAcc({ x: ev.x, y: ev.y, z: ev.z });
    if (ev.tipo === 'P') setFijado(angulosDe(accRef.current).incl);
  });
  // Simulación: ángulos → gravedad en ejes de la placa
  useEffect(() => {
    if (fuente !== 'sim') return;
    const a = rad(sim.lado), b = rad(sim.frente);
    const v = new THREE.Vector3(Math.tan(a), Math.tan(b), -1).normalize().multiplyScalar(1024);
    setAcc({ x: v.x, y: v.y, z: v.z });
  }, [fuente, sim]);

  const ang = angulosDe(acc);
  const [host, api] = useMini({ camara: [0, 4.5, 8], objetivo: [0, 0.8, 0] }, ({ scene }) => {
    const suelo = new THREE.Mesh(new THREE.CircleGeometry(6, 48), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
    suelo.rotation.x = -Math.PI / 2; suelo.receiveShadow = true; scene.add(suelo);
    const mb = crearMicrobit3D({ escala: 0.55 });
    mb.position.y = 1.3; scene.add(mb);
    pintarLeds(mb, '00000:00000:11111:00000:00000');
    // Plano horizontal de referencia (transparente)
    const ref = new THREE.Mesh(new THREE.RingGeometry(1.8, 1.85, 64), new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide }));
    ref.rotation.x = -Math.PI / 2; ref.position.y = 1.3; scene.add(ref);
    return { mb };
  });
  useEffect(() => {
    const mb = api.current?.mb; if (!mb) return;
    // Rota la placa para que su «abajo» medido coincida con el abajo real
    const g = new THREE.Vector3(acc.x, acc.z, acc.y).normalize();
    mb.quaternion.setFromUnitVectors(g, new THREE.Vector3(0, -1, 0));
    pintarLeds(mb, ang.incl < 2 ? '00000:00000:11111:00000:00000' : ang.incl < 45 ? '00001:00010:00100:01000:10000' : '00100:00100:00100:00100:00100');
  }, [acc]); // eslint-disable-line react-hooks/exhaustive-deps

  const alfa = fijado ?? ang.incl;
  const dN = Number(String(d).replace(',', '.')) || 0, eN = Number(String(ojos).replace(',', '.')) || 0;
  const h = eN + dN * Math.tan(rad(alfa));

  return (
    <div style={st.dosColumnas}>
      <div style={st.lateral}>
        <SelectorFuente fuente={fuente} setFuente={setFuente} />
        {fuente === 'sim' && (
          <div style={st.caja}>
            <label style={st.label}>Inclinar a los lados: {fmt(sim.lado, 0)}°<input type="range" min="-80" max="80" value={sim.lado} onChange={(e) => setSim((s) => ({ ...s, lado: Number(e.target.value) }))} /></label>
            <label style={st.label}>Inclinar hacia delante/atrás: {fmt(sim.frente, 0)}°<input type="range" min="-80" max="80" value={sim.frente} onChange={(e) => setSim((s) => ({ ...s, frente: Number(e.target.value) }))} /></label>
          </div>
        )}
        <div style={st.caja}>
          <div style={st.nota}>Ángulo con la horizontal</div>
          <div style={st.grande}>{fmt(ang.incl, 1)}°</div>
          <div style={st.nota}>a los lados {fmt(ang.lado, 0)}° · delante/atrás {fmt(ang.frente, 0)}° · pendiente {ang.incl < 89 ? `${fmt(Math.tan(rad(ang.incl)) * 100, 0)} %` : '—'}</div>
          <Transportador angulo={ang.incl} />
          <div style={st.fila}>
            <button style={st.mini} onClick={() => setFijado(ang.incl)}>📌 Fijar ángulo</button>
            {fijado != null && <button style={st.mini} onClick={() => setFijado(null)}>Soltar ({fmt(fijado, 1)}°)</button>}
          </div>
        </div>
        <div style={st.caja}>
          <b>🌳 Altura de un árbol o un edificio</b>
          <div style={st.nota}>Apoya la placa en una regla que apunte a lo más alto y fija el ángulo α. Mide tu distancia al pie del objeto y la altura de tus ojos.</div>
          <div style={st.rejilla3}>
            <label style={st.label}>Distancia d (m)<input value={d} onChange={(e) => setD(e.target.value)} style={st.input} /></label>
            <label style={st.label}>Ojos (m)<input value={ojos} onChange={(e) => setOjos(e.target.value)} style={st.input} /></label>
          </div>
          <div style={st.formula}>h = ojos + d · tan α = {fmt(eN)} + {fmt(dN)} · tan {fmt(alfa, 1)}° = <b>{alfa < 89 ? `${fmt(h)} m` : '—'}</b></div>
        </div>
      </div>
      <div ref={host} style={{ ...st.vista3d, borderRadius: 16, overflow: 'hidden' }} />
    </div>
  );
}

function Transportador({ angulo }) {
  const a = Math.max(0, Math.min(90, angulo));
  const R = 90, cx = 105, cy = 110;
  const px = cx + R * Math.cos(rad(a)), py = cy - R * Math.sin(rad(a));
  return (
    <svg viewBox="0 0 210 125" style={{ width: '100%', maxWidth: 300, display: 'block', margin: '6px auto' }}>
      <path d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`} fill="rgba(56,189,248,.08)" stroke="#38bdf8" strokeWidth="1.5" />
      {Array.from({ length: 19 }, (_, i) => i * 10).map((g) => {
        const c = Math.cos(rad(g)), s = Math.sin(rad(g)), l = g % 30 ? 6 : 11;
        return <line key={g} x1={cx + R * c} y1={cy - R * s} x2={cx + (R - l) * c} y2={cy - (R - l) * s} stroke="#94a3b8" strokeWidth="1" />;
      })}
      {[0, 30, 60, 90].map((g) => <text key={g} x={cx + (R - 22) * Math.cos(rad(g))} y={cy - (R - 22) * Math.sin(rad(g)) + 4} fill="#94a3b8" fontSize="9" textAnchor="middle">{g}°</text>)}
      <path d={`M ${cx + 28} ${cy} A 28 28 0 0 0 ${cx + 28 * Math.cos(rad(a))} ${cy - 28 * Math.sin(rad(a))}`} fill="none" stroke="#facc15" strokeWidth="3" />
      <line x1={cx} y1={cy} x2={cx + R + 8} y2={cy} stroke="#64748b" strokeWidth="1.5" strokeDasharray="4 3" />
      <line x1={cx} y1={cy} x2={px} y2={py} stroke="#facc15" strokeWidth="3" strokeLinecap="round" />
      <text x={cx + 40} y={cy - 8} fill="#facc15" fontSize="12" fontWeight="800">α</text>
    </svg>
  );
}

/* ═══════════════════════════ 🧭 BRÚJULA ═══════════════════════════ */

const VIENTOS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
const viento = (g) => VIENTOS[Math.round((((g % 360) + 360) % 360) / 45) % 8];

function texturaRosa() {
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const g = c.getContext('2d'), m = 512;
  g.fillStyle = '#0b1220'; g.beginPath(); g.arc(m, m, 500, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#38bdf8'; g.lineWidth = 6; g.stroke();
  for (let a = 0; a < 360; a += 5) {
    const r1 = 490, r2 = a % 45 === 0 ? 420 : a % 15 === 0 ? 445 : 465;
    const t = rad(a - 90);
    g.strokeStyle = a % 45 === 0 ? '#f8fafc' : '#64748b'; g.lineWidth = a % 45 === 0 ? 6 : 3;
    g.beginPath(); g.moveTo(m + r1 * Math.cos(t), m + r1 * Math.sin(t)); g.lineTo(m + r2 * Math.cos(t), m + r2 * Math.sin(t)); g.stroke();
    if (a % 30 === 0 && a % 90 !== 0) { g.fillStyle = '#94a3b8'; g.font = 'bold 34px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(a), m + 385 * Math.cos(t), m + 385 * Math.sin(t)); }
  }
  ['N', 'E', 'S', 'O'].forEach((l, i) => {
    const t = rad(i * 90 - 90);
    g.fillStyle = l === 'N' ? '#ef4444' : '#f8fafc'; g.font = 'bold 90px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(l, m + 340 * Math.cos(t), m + 340 * Math.sin(t));
  });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function Brujula() {
  const [fuente, setFuente] = useState('sim');
  const [rumbo, setRumbo] = useState(40);
  const [tramos, setTramos] = useState([]); // { rumbo, d }
  const [dTramo, setDTramo] = useState('5');
  useModoInstrumento(fuente === 'placa' ? 'BR' : null);
  const rumboRef = useRef(rumbo); rumboRef.current = rumbo;
  const dRef = useRef(dTramo); dRef.current = dTramo;
  const anadirTramo = (r = rumboRef.current) => {
    const dd = Number(String(dRef.current).replace(',', '.'));
    if (dd > 0) setTramos((t) => [...t, { rumbo: Math.round(r), d: dd }]);
  };
  useInstrumentos((ev) => {
    if (fuente !== 'placa') return;
    if (ev.tipo === 'C') setRumbo(ev.grados);
    if (ev.tipo === 'P') anadirTramo();
  });

  const [host, api] = useMini({ camara: [0, 7, 6.5], objetivo: [0, 0, 0] }, ({ scene }) => {
    const rosa = new THREE.Mesh(new THREE.CircleGeometry(3.2, 96), new THREE.MeshStandardMaterial({ map: texturaRosa(), roughness: 0.8 }));
    rosa.rotation.x = -Math.PI / 2; rosa.receiveShadow = true; scene.add(rosa);
    const mb = crearMicrobit3D({ escala: 0.42 }); mb.position.y = 0.25; scene.add(mb);
    const flecha = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.2, 4), new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0x854d0e }));
    flecha.rotation.x = -Math.PI / 2; flecha.position.set(0, 0.35, -1.9);
    const pivote = new THREE.Group(); pivote.add(mb, flecha); scene.add(pivote);
    const n = etiqueta3D('Norte', { color: '#fff', fondo: '#dc2626', escala: 0.4 }); n.position.set(0, 0.6, -3.6); scene.add(n);
    return { pivote, mb };
  });
  useEffect(() => {
    const a = api.current; if (!a) return;
    a.pivote.rotation.y = -rad(rumbo); // el logo de la placa (−Z) apunta al rumbo
    pintarLeds(a.mb, '00100:01110:10101:00100:00100');
  }, [rumbo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recorrido: x hacia el este, y hacia el norte
  const puntos = useMemo(() => {
    const p = [{ x: 0, y: 0 }];
    tramos.forEach(({ rumbo: r, d }) => { const u = p[p.length - 1]; p.push({ x: u.x + d * Math.sin(rad(r)), y: u.y + d * Math.cos(rad(r)) }); });
    return p;
  }, [tramos]);
  const fin = puntos[puntos.length - 1];
  const dist = Math.hypot(fin.x, fin.y);
  const vuelta = ((grad(Math.atan2(-fin.x, -fin.y)) % 360) + 360) % 360;

  return (
    <div style={st.dosColumnas}>
      <div style={st.lateral}>
        <SelectorFuente fuente={fuente} setFuente={setFuente} extra={<>
          <div style={{ ...st.aviso, margin: '6px 0' }}>
            🧭 <b>La primera vez la placa tiene que calibrar la brújula.</b> En sus LED pasa el texto <b>«TILT TO FILL SCREEN»</b> («inclina para llenar la pantalla») y después se enciende un punto.
            <ol style={{ margin: '4px 0 0', paddingLeft: 18 }}>
              <li>Coge la placa e <b>inclínala despacio hacia todos los lados</b> (como si hicieras rodar una canica por la pantalla).</li>
              <li>Cada LED por el que pasa el punto se queda encendido: sigue hasta que se enciendan <b>los 25</b>.</li>
              <li>Sale una carita y la placa empieza a enviar el rumbo. Aléjala de imanes, móviles y patas metálicas de las mesas.</li>
            </ol>
            Mientras calibra no envía nada (la web parece parada). Tras cambiar la placa de función se reinicia y puede volver a pedirlo.
          </div>
          <button style={st.mini} onClick={() => enviarAInstrumentos('I:K')}>🔄 Calibrar otra vez</button></>} />
        {fuente === 'sim' && <div style={st.caja}><label style={st.label}>Rumbo: {fmt(rumbo, 0)}°<input type="range" min="0" max="359" value={rumbo} onChange={(e) => setRumbo(Number(e.target.value))} /></label></div>}
        <div style={st.caja}>
          <div style={st.nota}>Rumbo (ángulo desde el norte, en el sentido de las agujas del reloj)</div>
          <div style={st.grande}>{fmt(rumbo, 0)}° <span style={{ fontSize: '0.5em', color: '#38bdf8' }}>{viento(rumbo)}</span></div>
        </div>
        <div style={st.caja}>
          <b>🗺️ Recorrido con rumbos</b>
          <div style={st.nota}>Camina un tramo en línea recta, apunta la placa hacia donde vas y añade el tramo (o pulsa A en la placa). ¿A qué distancia acabas del punto de salida?</div>
          <div style={{ ...st.fila, marginTop: 6 }}>
            <label style={{ ...st.label, flex: 1 }}>Metros del tramo<input value={dTramo} onChange={(e) => setDTramo(e.target.value)} style={st.input} /></label>
            <button style={st.btn('#0ea5e9')} onClick={() => anadirTramo()}>➕ Tramo a {fmt(rumbo, 0)}°</button>
          </div>
          {tramos.length > 0 && (
            <>
              <table style={{ ...st.tabla, marginTop: 6 }}><tbody>
                {tramos.map((t, i) => (
                  <tr key={i}><td style={st.td}>{i + 1}</td><td style={st.td}>{t.rumbo}° {viento(t.rumbo)}</td><td style={st.td}>{fmt(t.d, 1)} m</td>
                    <td style={st.td}>Δx = {fmt(t.d * Math.sin(rad(t.rumbo)))} · Δy = {fmt(t.d * Math.cos(rad(t.rumbo)))}</td></tr>
                ))}
              </tbody></table>
              <div style={st.formula}>Final: ({fmt(fin.x)} ; {fmt(fin.y)}) → distancia = √({fmt(fin.x)}² + {fmt(fin.y)}²) = <b>{fmt(dist)} m</b></div>
              <div style={st.nota}>Para volver al inicio: rumbo <b>{fmt(vuelta, 0)}° ({viento(vuelta)})</b>, {fmt(dist)} m.</div>
              <Recorrido puntos={puntos} />
              <button style={st.mini} onClick={() => setTramos([])}>🧹 Empezar de nuevo</button>
            </>
          )}
        </div>
      </div>
      <div ref={host} style={{ ...st.vista3d, borderRadius: 16, overflow: 'hidden' }} />
    </div>
  );
}

function Recorrido({ puntos }) {
  const xs = puntos.map((p) => p.x), ys = puntos.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const lado = Math.max(maxX - minX, maxY - minY, 1) * 1.2;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const P = (p) => [100 + ((p.x - cx) / lado) * 180, 100 - ((p.y - cy) / lado) * 180];
  const fin = P(puntos[puntos.length - 1]), ini = P(puntos[0]);
  return (
    <svg viewBox="0 0 200 200" style={{ width: '100%', maxWidth: 260, display: 'block', margin: '8px auto', background: 'rgba(0,0,0,.3)', borderRadius: 12 }}>
      <text x="100" y="14" fill="#ef4444" fontSize="11" textAnchor="middle" fontWeight="800">N ↑</text>
      <polyline points={puntos.map((p) => P(p).join(',')).join(' ')} fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinejoin="round" />
      <line x1={ini[0]} y1={ini[1]} x2={fin[0]} y2={fin[1]} stroke="#facc15" strokeWidth="2" strokeDasharray="5 4" />
      <circle cx={ini[0]} cy={ini[1]} r="5" fill="#22c55e" /><circle cx={fin[0]} cy={fin[1]} r="5" fill="#ef4444" />
    </svg>
  );
}

/* ═══════════════════════════ 🌡️ SENSORES ═══════════════════════════ */

const SERIES = {
  temp: { nombre: 'Temperatura', unidad: '°C', color: '#f97316' },
  luz: { nombre: 'Luz', unidad: '(0-255)', color: '#facc15' },
  sonido: { nombre: 'Sonido', unidad: '(0-255)', color: '#38bdf8' },
};

export function Sensores() {
  const [fuente, setFuente] = useState('sim');
  const [datos, setDatos] = useState([]); // { t, temp, luz, sonido }
  const [serie, setSerie] = useState('temp');
  const [pausa, setPausa] = useState(false);
  const [marcas, setMarcas] = useState([]);
  const t0 = useRef(Date.now());
  const pausaRef = useRef(pausa); pausaRef.current = pausa;
  useModoInstrumento(fuente === 'placa' ? 'SE' : null);
  const anadir = (d) => { if (!pausaRef.current) setDatos((a) => [...a.slice(-599), { t: (Date.now() - t0.current) / 1000, ...d }]); };
  useInstrumentos((ev) => {
    if (fuente !== 'placa') return;
    if (ev.tipo === 'E') anadir({ temp: ev.temp, luz: ev.luz, sonido: ev.sonido });
    if (ev.tipo === 'P') setMarcas((m) => [...m, (Date.now() - t0.current) / 1000]);
  });
  useEffect(() => {
    if (fuente !== 'sim') return undefined;
    let s = { temp: 21, luz: 120, sonido: 40 };
    const id = setInterval(() => {
      s = {
        temp: Math.round((s.temp + (Math.random() - 0.5) * 0.4) * 10) / 10,
        luz: Math.max(0, Math.min(255, Math.round(s.luz + (Math.random() - 0.5) * 18))),
        sonido: Math.max(0, Math.min(255, Math.round(30 + Math.random() * (Math.random() < 0.1 ? 150 : 40)))),
      };
      anadir(s);
    }, 500);
    return () => clearInterval(id);
  }, [fuente]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setDatos([]); setMarcas([]); t0.current = Date.now(); }, [fuente]);

  const valores = datos.map((d) => d[serie]).filter(Number.isFinite);
  const media = valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null;
  const min = valores.length ? Math.min(...valores) : null, max = valores.length ? Math.max(...valores) : null;
  const desv = valores.length ? Math.sqrt(valores.reduce((a, b) => a + (b - media) ** 2, 0) / valores.length) : null;

  const csv = () => {
    const txt = 'segundos;temperatura;luz;sonido\n' + datos.map((d) => [d.t.toFixed(1), d.temp, d.luz, d.sonido].join(';').replace(/\./g, ',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + txt], { type: 'text/csv' }));
    a.download = 'datos-microbit.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div style={st.dosColumnas}>
      <div style={st.lateral}>
        <SelectorFuente fuente={fuente} setFuente={setFuente} />
        <div style={st.caja}>
          <div style={st.fila}>{Object.entries(SERIES).map(([k, s]) => <button key={k} style={st.chip(serie === k)} onClick={() => setSerie(k)}>{s.nombre}</button>)}</div>
          <div style={{ ...st.grande, color: SERIES[serie].color, marginTop: 8 }}>{fmt(valores[valores.length - 1], serie === 'temp' ? 1 : 0)} <span style={{ fontSize: '0.4em' }}>{SERIES[serie].unidad}</span></div>
          <table style={{ ...st.tabla, marginTop: 6 }}><tbody>
            <tr><td style={st.td}>Datos</td><td style={st.td}><b>{valores.length}</b></td><td style={st.td}>Media</td><td style={st.td}><b>{fmt(media, 1)}</b></td></tr>
            <tr><td style={st.td}>Mínimo</td><td style={st.td}><b>{fmt(min, 1)}</b></td><td style={st.td}>Máximo</td><td style={st.td}><b>{fmt(max, 1)}</b></td></tr>
            <tr><td style={st.td}>Rango</td><td style={st.td}><b>{fmt(max - min, 1)}</b></td><td style={st.td}>Mediana</td><td style={st.td}><b>{fmt(mediana(valores), 1)}</b></td></tr>
            <tr><td style={st.td}>Desv. típica</td><td style={st.td} colSpan={3}><b>{fmt(desv, 2)}</b></td></tr>
          </tbody></table>
          <div style={{ ...st.fila, marginTop: 8 }}>
            <button style={st.mini} onClick={() => setPausa((p) => !p)}>{pausa ? '▶ Seguir' : '⏸ Pausa'}</button>
            <button style={st.mini} onClick={() => setMarcas((m) => [...m, (Date.now() - t0.current) / 1000])}>📌 Marca</button>
            <button style={st.mini} onClick={() => { setDatos([]); setMarcas([]); t0.current = Date.now(); }}>🧹 Borrar</button>
            <button style={st.mini} disabled={!datos.length} onClick={csv}>📄 CSV (hoja de cálculo)</button>
          </div>
          <div style={st.nota}>Ideas: ¿cómo cambia la temperatura al abrir la ventana? ¿Y la luz al bajar la persiana? ¿Qué parte de la clase es más ruidosa?</div>
        </div>
      </div>
      <div style={{ ...st.vista3d, ...st.caja, minHeight: 360, display: 'flex', flexDirection: 'column' }}>
        <Grafica datos={datos} serie={serie} marcas={marcas} media={media} />
      </div>
    </div>
  );
}

function Grafica({ datos, serie, marcas, media }) {
  const W = 800, H = 420, m = { l: 50, r: 16, t: 16, b: 34 };
  const pts = datos.filter((d) => Number.isFinite(d[serie]));
  if (pts.length < 2) return <div style={{ ...st.nota, margin: 'auto' }}>Esperando datos…</div>;
  const t1 = pts[0].t, t2 = pts[pts.length - 1].t;
  let lo = Math.min(...pts.map((d) => d[serie])), hi = Math.max(...pts.map((d) => d[serie]));
  if (hi - lo < 1) { lo -= 1; hi += 1; }
  const X = (t) => m.l + ((t - t1) / (t2 - t1 || 1)) * (W - m.l - m.r);
  const Y = (v) => H - m.b - ((v - lo) / (hi - lo)) * (H - m.t - m.b);
  const ticksY = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);
  const col = SERIES[serie].color;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%', flex: 1 }}>
      {ticksY.map((v) => <g key={v}><line x1={m.l} x2={W - m.r} y1={Y(v)} y2={Y(v)} stroke="rgba(255,255,255,.1)" /><text x={m.l - 6} y={Y(v) + 4} fill="#94a3b8" fontSize="12" textAnchor="end">{fmt(v, 1)}</text></g>)}
      <text x={W / 2} y={H - 6} fill="#94a3b8" fontSize="12" textAnchor="middle">tiempo (s): de {fmt(t1, 0)} a {fmt(t2, 0)}</text>
      {media != null && <line x1={m.l} x2={W - m.r} y1={Y(media)} y2={Y(media)} stroke={col} strokeDasharray="6 5" opacity="0.6" />}
      {marcas.filter((t) => t >= t1).map((t, i) => <line key={i} x1={X(t)} x2={X(t)} y1={m.t} y2={H - m.b} stroke="#a855f7" strokeWidth="2" />)}
      <polyline points={pts.map((d) => `${X(d.t)},${Y(d[serie])}`).join(' ')} fill="none" stroke={col} strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

/* ═══════════════════════════ 🪂 CAÍDA LIBRE ═══════════════════════════ */

export function Caida() {
  const [fuente, setFuente] = useState('sim');
  const [objetivo, setObjetivo] = useState('altura'); // altura | g
  const [hConocida, setHConocida] = useState('1');
  const [hSim, setHSim] = useState('1,2');
  const [intentos, setIntentos] = useState([]); // segundos
  useModoInstrumento(fuente === 'placa' ? 'CA' : null);
  const caer = useRef(null);
  const nuevo = (t) => { setIntentos((a) => [...a.slice(-19), t]); caer.current?.(t); };
  useInstrumentos((ev) => { if (fuente === 'placa' && ev.tipo === 'F') nuevo(ev.us / 1e6); });

  const hK = Number(String(hConocida).replace(',', '.')) || 0;
  const res = (t) => (objetivo === 'altura' ? 0.5 * G * t * t : (2 * hK) / (t * t));
  const resultados = intentos.map(res);
  const mediaRes = resultados.length ? resultados.reduce((a, b) => a + b, 0) / resultados.length : null;

  const [host, api] = useMini({ camara: [3.2, 2, 5.2], objetivo: [0, 1.4, 0] }, ({ scene, onFrame }) => {
    const suelo = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
    suelo.rotation.x = -Math.PI / 2; suelo.receiveShadow = true; scene.add(suelo);
    const cojin = new THREE.Mesh(new THREE.BoxGeometry(1, 0.15, 1), new THREE.MeshStandardMaterial({ color: 0x7c3aed })); cojin.position.y = 0.075; scene.add(cojin);
    const regla = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3, 0.03), new THREE.MeshStandardMaterial({ color: 0xfacc15 })); regla.position.set(-0.8, 1.5, 0); scene.add(regla);
    for (let i = 0; i <= 30; i++) {
      const larga = i % 5 === 0;
      const tick = new THREE.Mesh(new THREE.BoxGeometry(larga ? 0.12 : 0.06, 0.01, 0.035), new THREE.MeshBasicMaterial({ color: 0x0f172a }));
      tick.position.set(-0.8 + (larga ? 0 : 0.03), i * 0.1, 0.005); scene.add(tick);
      if (i % 5 === 0) { const e = etiqueta3D(`${fmt(i / 10, 1)} m`, { escala: 0.16 }); e.position.set(-1.15, i * 0.1, 0); scene.add(e); }
    }
    const mb = crearMicrobit3D({ escala: 0.08 }); mb.rotation.x = Math.PI / 2; mb.position.set(0, 1.2, 0); scene.add(mb);
    pintarLeds(mb, '00100:00100:10101:01110:00100');
    let anim = null; // { h, t, T }
    onFrame((dt) => {
      if (!anim) return;
      anim.t += dt;
      const k = Math.min(1, anim.t / anim.T);
      mb.position.y = 0.2 + anim.h * (1 - k * k);
      if (k >= 1) { anim = null; pintarLeds(mb, '00000:01010:00000:10001:01110'); }
    });
    return { soltar: (h, T) => { anim = { h, t: 0, T }; pintarLeds(mb, '00100:00100:10101:01110:00100'); } };
  });
  caer.current = (t) => api.current?.soltar(Math.min(3, 0.5 * G * t * t), t);

  const soltarSim = () => {
    const h = Number(String(hSim).replace(',', '.')) || 1;
    const t = Math.round((Math.sqrt((2 * h) / G) + (Math.random() - 0.5) * 0.03) * 50) / 50; // el acelerómetro mide cada 20 ms
    nuevo(t);
  };

  return (
    <div style={st.dosColumnas}>
      <div style={st.lateral}>
        <SelectorFuente fuente={fuente} setFuente={setFuente} extra={<> Suelta la placa desde quieta <b>sobre un cojín</b>: mide el tiempo que pasa en caída libre (casi 0 g) hasta el golpe.</>} />
        {fuente === 'sim' && (
          <div style={{ ...st.caja, ...st.fila }}>
            <label style={{ ...st.label, flex: 1 }}>Altura (m)<input value={hSim} onChange={(e) => setHSim(e.target.value)} style={st.input} /></label>
            <button style={st.btn('#7c3aed')} onClick={soltarSim}>🪂 Soltar</button>
          </div>
        )}
        <div style={st.caja}>
          <div style={st.fila}>
            <button style={st.chip(objetivo === 'altura')} onClick={() => setObjetivo('altura')}>Calcular la altura</button>
            <button style={st.chip(objetivo === 'g')} onClick={() => setObjetivo('g')}>Calcular g</button>
          </div>
          {objetivo === 'g' && <label style={{ ...st.label, marginTop: 6 }}>Altura medida con la cinta (m)<input value={hConocida} onChange={(e) => setHConocida(e.target.value)} style={st.input} /></label>}
          <div style={st.formula}>{objetivo === 'altura' ? 'h = ½ · g · t²  (g = 9,8 m/s²)' : 'g = 2 · h / t²'}</div>
          {intentos.length > 0 && (
            <>
              <table style={{ ...st.tabla, marginTop: 6 }}><tbody>
                {intentos.map((t, i) => (
                  <tr key={i}><td style={st.td}>{i + 1}</td><td style={st.td}>t = {fmt(t, 3)} s</td>
                    <td style={st.td}>{objetivo === 'altura' ? `h = ½·9,8·${fmt(t, 3)}² = ${fmt(resultados[i])} m` : `g = 2·${fmt(hK)}/${fmt(t, 3)}² = ${fmt(resultados[i])} m/s²`}</td></tr>
                ))}
              </tbody></table>
              <div style={st.grande}>{fmt(mediaRes)} {objetivo === 'altura' ? 'm' : 'm/s²'}</div>
              <div style={st.nota}>Media de {intentos.length} intentos. Repetir y hacer la media reduce el error (el acelerómetro mide cada 20 ms aprox.).</div>
              <button style={st.mini} onClick={() => setIntentos([])}>🧹 Borrar</button>
            </>
          )}
        </div>
      </div>
      <div ref={host} style={{ ...st.vista3d, borderRadius: 16, overflow: 'hidden' }} />
    </div>
  );
}
