// «🎚️ Potenciómetro»: el mando giratorio de la Imagina TdR STEAM (270° de giro, 0-3,3 V).
//   · Ángulo y voltaje: θ = 270·p, V = 3,3·p → funciones lineales y pendiente (V/θ = 3,3/270).
//   · Tabla de puntos (ángulo estimado ↔ lectura) con recta de regresión.
//   · Reto «pon el mando a X°»: estimar ángulos sin mirar números.
//   · El mando como control: color del LED RGB (tono del círculo cromático) o nº de LED encendidos.
import React, { useEffect, useRef, useState } from 'react';
import { st } from '../labMicrobit/estilosLab';
import { enviar } from './conexionKit';
import { useKit, fmt, regresion } from './useKit';
import { PanelSimulacion } from './Conectar';
import Grafica from './Grafica';

const GIRO = 270, VMAX = 3.3;

// Tono (0-360°) → RGB, para el modo «círculo cromático»
const hsvRgb = (h) => {
  const f = (n) => { const k = (n + h / 60) % 6; return Math.round(255 * (1 - Math.max(0, Math.min(k, 4 - k, 1)))); };
  return [f(5), f(3), f(1)];
};

// Punto a radio r y ángulo g (grados, 0 = arriba, sentido horario) en coordenadas SVG
const P = (r, g) => [r * Math.sin((Math.PI * g) / 180), -r * Math.cos((Math.PI * g) / 180)];

function Mando({ p }) {
  const a = -135 + GIRO * p; // 0 % apunta abajo a la izquierda (el punto rojo), 100 % abajo a la derecha
  const [x0, y0] = P(90, -135), [x1, y1] = P(90, 135), [xa, ya] = P(90, a), [xm, ym] = P(40, a), [xr, yr] = P(104, -135);
  return (
    <svg viewBox="-112 -112 224 196" style={{ width: '100%', maxWidth: 300 }} role="img" aria-label={`Potenciómetro girado ${Math.round(GIRO * p)} grados`}>
      <path d={`M ${x0} ${y0} A 90 90 0 1 1 ${x1} ${y1}`} fill="none" stroke="#334155" strokeWidth="10" strokeLinecap="round" />
      {p > 0.002 && <path d={`M ${x0} ${y0} A 90 90 0 ${GIRO * p > 180 ? 1 : 0} 1 ${xa} ${ya}`} fill="none" stroke="#c084fc" strokeWidth="10" strokeLinecap="round" />}
      {[0, 45, 90, 135, 180, 225, 270].map((m) => {
        const [x, y] = P(68, m - 135);
        return <text key={m} x={x} y={y + 4} fill="#94a3b8" fontSize="11" textAnchor="middle">{m}°</text>;
      })}
      <circle r="44" fill="#1e293b" stroke="#475569" strokeWidth="3" />
      <line x1="0" y1="0" x2={xm} y2={ym} stroke="#f8fafc" strokeWidth="6" strokeLinecap="round" />
      <circle r="6" fill="#f8fafc" />
      <circle cx={xr} cy={yr} r="5" fill="#ef4444" />
    </svg>
  );
}

export default function Potenciometro() {
  const kit = useKit();
  const v = kit.lectura?.pot;
  const p = v == null ? 0 : v / 100;
  const ang = GIRO * p, volt = VMAX * p;
  const [puntos, setPuntos] = useState([]); // [θ estimado, % leído]
  const [estimado, setEstimado] = useState('');
  const [reto, setReto] = useState(null);   // { objetivo, hecho: [{ obj, real }] }
  const [control, setControl] = useState('');
  const ultimo = useRef('');

  // El mando controla el LED RGB o el zumbador (solo manda órdenes cuando cambia lo bastante)
  useEffect(() => {
    if (!control || v == null) return;
    let clave, orden;
    if (control === 'color') { const c = hsvRgb(ang * 360 / GIRO); clave = c.map((x) => x >> 4).join(); orden = () => enviar('rgb', c); }
    else if (control === 'brillo') { const b = Math.round(p * 255); clave = String(b >> 3); orden = () => enviar('rgb', [b, b, b]); }
    else if (control === 'leds') { const n = Math.round(p * 2); clave = String(n); orden = () => { enviar('led', n >= 1 ? 1 : 0); enviar('led2', n >= 2 ? 1 : 0); }; }
    if (clave !== ultimo.current) { ultimo.current = clave; orden(); }
  }, [control, v]); // eslint-disable-line react-hooks/exhaustive-deps

  const anotar = () => {
    const e = Number(String(estimado).replace(',', '.'));
    if (!Number.isFinite(e) || v == null) return;
    setPuntos((ps) => [...ps, [e, v]].sort((a, b) => a[0] - b[0]));
    setEstimado('');
  };
  const rec = puntos.length >= 2 ? regresion(puntos.map((q) => q[0]), puntos.map((q) => q[1])) : null;
  const nuevoReto = () => setReto((r) => ({ objetivo: 15 * Math.round(1 + Math.random() * 16), hecho: r?.hecho || [] }));
  const comprobarReto = () => setReto((r) => ({ ...r, hecho: [...r.hecho, { obj: r.objetivo, real: ang }], objetivo: null }));
  const errores = reto?.hecho.map((h) => Math.abs(h.real - h.obj)) || [];

  return (
    <div style={st.dosColumnas}>
      <div style={st.lateral}>
        <div style={st.caja}>
          <b>🎚️ Gira el potenciómetro</b>
          <div style={{ display: 'flex', justifyContent: 'center' }}><Mando p={p} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, textAlign: 'center' }}>
            <div><div style={st.nota}>Lectura</div><b style={{ fontSize: 20 }}>{fmt(v, 0)} %</b></div>
            <div><div style={st.nota}>Ángulo θ</div><b style={{ fontSize: 20 }}>{fmt(ang, 0)}°</b></div>
            <div><div style={st.nota}>Voltaje V</div><b style={{ fontSize: 20 }}>{fmt(volt, 2)} V</b></div>
          </div>
          <div style={st.formula}>θ = 270° · p = 270 · {fmt(p, 2)} = {fmt(ang, 0)}°</div>
          <div style={st.formula}>V = 3,3 V · p = {fmt(volt, 2)} V → V = (3,3 / 270) · θ ≈ {fmt(VMAX / GIRO, 4)} · θ</div>
          <div style={st.nota}>Las dos son funciones lineales (proporcionalidad directa). La pendiente 3,3/270 dice cuántos voltios aumenta por cada grado.</div>
          {kit.fuente === 'placa' && kit.placa === 'tdr' && <div style={st.aviso}>🎚️ Antes de instalar o subir un programa, vuelve a poner el mando a cero (la flecha al punto rojo).</div>}
        </div>
        <PanelSimulacion campos={['pot']} />
        <div style={st.caja}>
          <b>🕹️ El mando como control</b>
          <div style={{ ...st.fila, marginTop: 6 }}>
            {[['', 'Nada'], ['color', '🌈 Color del RGB'], ['brillo', '💡 Brillo del RGB'], ['leds', '🔴🔵 Nº de LED']].map(([k, n]) => (
              <button key={k} style={st.chip(control === k)} onClick={() => { setControl(k); ultimo.current = ''; }}>{n}</button>
            ))}
          </div>
          {control === 'color' && <div style={st.nota}>El ángulo del mando elige el tono en el círculo cromático: 0° rojo, 120° verde, 240° azul. Tono = θ · 360/270 = {fmt(ang * 360 / GIRO, 0)}°.</div>}
          {control === 'brillo' && <div style={st.nota}>Brillo = 255 · p = {fmt(p * 255, 0)} (de 0 a 255): otra función lineal.</div>}
          {control === 'leds' && <div style={st.nota}>Redondeo: n = redondear(2·p) = {Math.round(p * 2)} LED encendidos. ¿En qué ángulos cambia?</div>}
        </div>
      </div>

      <div style={{ flex: '3 1 420px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={st.caja}>
          <b>🎯 Reto: pon el mando a…</b>
          {!reto?.objetivo
            ? <div style={{ marginTop: 6 }}><button style={st.btn('#16a34a')} onClick={nuevoReto}>Nuevo ángulo</button></div>
            : <div style={{ ...st.fila, marginTop: 6 }}>
                <span style={{ fontSize: 30, fontWeight: 900, color: '#c084fc' }}>{reto.objetivo}°</span>
                <span style={st.nota}>Gíralo sin mirar la pantalla y pulsa:</span>
                <button style={st.btn('#0ea5e9')} onClick={comprobarReto}>¡Ya!</button>
              </div>}
          {reto?.hecho.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 13.5 }}>
              {reto.hecho.slice(-6).map((h, i) => <div key={i}>Pedido {h.obj}° → pusiste {fmt(h.real, 0)}° (error {fmt(Math.abs(h.real - h.obj), 0)}°)</div>)}
              <div style={{ marginTop: 4 }}><b>Error medio: {fmt(errores.reduce((a, b) => a + b, 0) / errores.length, 1)}°</b> en {errores.length} intentos</div>
            </div>
          )}
        </div>

        <div style={st.caja}>
          <b>📈 ¿Es lineal de verdad?</b>
          <div style={st.nota}>Pon el mando en ángulos que sepas (0°, 90°, 135°, 180°, 270°…: usa las marcas o un transportador), escribe el ángulo y anota la lectura.</div>
          <div style={{ ...st.fila, marginTop: 6 }}>
            <input style={{ ...st.input, width: 90 }} placeholder="θ (°)" value={estimado} onChange={(e) => setEstimado(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && anotar()} />
            <button style={st.btn('#c084fc')} onClick={anotar}>📍 Anotar ({fmt(v, 0)} %)</button>
            {puntos.length > 0 && <button style={st.mini} onClick={() => setPuntos([])}>🗑️ Borrar</button>}
          </div>
          <Grafica series={[{ puntos, color: '#c084fc', nombre: 'Medidas', linea: false }]}
            curvas={[{ f: (x) => (100 * x) / GIRO, color: '#94a3b8', nombre: 'Ideal: p = θ / 270' }, ...(rec ? [{ f: (x) => rec.a + rec.b * x, color: '#facc15', nombre: 'Recta de regresión' }] : [])]}
            ejeX="ángulo θ (°)" ejeY="lectura (%)" xMin={0} xMax={GIRO} yMin={0} yMax={100} alto={220} />
          {rec && <div style={st.nota}>Recta: <span style={st.formula}>p = {fmt(rec.a, 1)} + {fmt(rec.b, 3)}·θ</span> (R² = {fmt(rec.r2, 3)}). La ideal tiene pendiente 100/270 ≈ 0,370. Los potenciómetros reales no son perfectos: cerca de los extremos el ADC de la ESP32 se satura.</div>}
        </div>
      </div>
    </div>
  );
}
