// «🚪 Servo y ángulos»: la puerta (o la ventana) vista desde arriba. Al girar el servo se calculan
// el hueco que deja (cuerda = 2·r·sen(θ/2)), el arco que recorre el pomo y el área barrida, con
// retos de «ábrela lo justo para que pase la caja». Y el tiempo de reacción con el botón 1:
// la placa enciende el LED tras una espera al azar y mide cuánto tardas en pulsar.
import React, { useState } from 'react';
import { st } from '../labMicrobit/estilosLab';
import { enviar } from './conexionKit';
import { fmt } from './useKit';
import Reaccion from './Reaccion';

const rad = (g) => (g * Math.PI) / 180;
const nuevoReto = (r) => Math.round((0.4 + Math.random() * 1.3) * r * 10) / 10;

function VistaPuerta({ r, ang, objetivo }) {
  const S = 120 / r, cx = 150, cy = 250; // bisagra en el centro: la puerta cabe abierta hasta 180°
  const P = (x, y) => [cx + x * S, cy - y * S];
  const [hx, hy] = P(0, 0);
  const [tx, ty] = P(r * Math.cos(rad(ang)), r * Math.sin(rad(ang)));
  const [cxr, cyr] = P(r, 0);
  const grande = ang > 180 ? 1 : 0;
  return (
    <svg viewBox="0 0 300 280" style={{ width: '100%', maxWidth: 460, background: 'rgba(0,0,0,.25)', borderRadius: 12 }} role="img" aria-label={`Puerta abierta ${ang} grados vista desde arriba`}>
      <line x1={0} y1={hy} x2={hx} y2={hy} stroke="#e8c99b" strokeWidth="8" />
      <line x1={cxr} y1={hy} x2={300} y2={hy} stroke="#e8c99b" strokeWidth="8" />
      {ang > 0 && <path d={`M ${hx} ${hy} L ${cxr} ${cyr} A ${r * S} ${r * S} 0 ${grande} 0 ${tx} ${ty} Z`} fill="rgba(250,204,21,.15)" stroke="none" />}
      {ang > 0 && <path d={`M ${cxr} ${cyr} A ${r * S} ${r * S} 0 ${grande} 0 ${tx} ${ty}`} fill="none" stroke="#facc15" strokeWidth="2" strokeDasharray="5 4" />}
      <line x1={cxr} y1={cyr} x2={tx} y2={ty} stroke="#38bdf8" strokeWidth="2" />
      {objetivo && <rect x={cxr - Math.min(objetivo, 2 * r) * S} y={hy + 6} width={Math.min(objetivo, 2 * r) * S} height={16} fill="rgba(34,197,94,.35)" stroke="#22c55e" />}
      <line x1={hx} y1={hy} x2={tx} y2={ty} stroke="#c9a06a" strokeWidth="7" strokeLinecap="round" />
      <circle cx={hx} cy={hy} r="6" fill="#f8fafc" />
      <circle cx={tx} cy={ty} r="5" fill="#facc15" />
      <text x={hx + 22 * Math.cos(rad(ang / 2))} y={hy - 22 * Math.sin(rad(ang / 2)) + 4} fill="#f8fafc" fontSize="13" fontWeight="800" textAnchor="middle">θ</text>
    </svg>
  );
}

export default function ServoAngulos() {
  const [servo, setServo] = useState('puerta');
  const [r, setR] = useState(6);
  const [ang, setAng] = useState(0);
  const [reto, setReto] = useState(null); // { caja, resp, ok }

  const mover = (a) => { setAng(a); enviar(servo, a); };
  const cuerda = 2 * r * Math.sin(rad(ang) / 2);
  const arco = Math.PI * r * ang / 180;
  const area = Math.PI * r * r * ang / 360;
  const angReto = reto ? (2 * Math.asin(Math.min(1, reto.caja / (2 * r))) * 180) / Math.PI : null;

  const comprobar = () => {
    const a = Number(String(reto.resp).replace(',', '.'));
    const ok = Math.abs(a - angReto) <= 2;
    setReto({ ...reto, ok });
    if (Number.isFinite(a)) mover(Math.round(Math.max(0, Math.min(180, a))));
  };

  return (
    <div style={st.dosColumnas}>
      <div style={st.lateral}>
        <div style={st.caja}>
          <b>🚪 Mueve el servo</b>
          <div style={{ ...st.fila, marginTop: 6 }}>
            <button style={st.chip(servo === 'puerta')} onClick={() => setServo('puerta')}>🚪 Puerta</button>
            <button style={st.chip(servo === 'ventana')} onClick={() => setServo('ventana')}>🪟 Ventana</button>
            <label style={{ ...st.label, flexDirection: 'row', alignItems: 'center', gap: 6 }}>radio r (cm)
              <input type="number" min={1} step={0.5} style={{ ...st.input, width: 70 }} value={r} onChange={(ev) => setR(Math.max(0.5, Number(ev.target.value) || 6))} />
            </label>
          </div>
          <label style={{ ...st.label, marginTop: 8 }}>Ángulo θ = {ang}°
            <input type="range" min={0} max={180} value={ang} onChange={(ev) => mover(Number(ev.target.value))} />
          </label>
          <div style={st.fila}>{[0, 30, 45, 60, 90, 120, 180].map((a) => <button key={a} style={st.chip(ang === a)} onClick={() => mover(a)}>{a}°</button>)}</div>
          <div style={st.nota}>Mide r en tu maqueta: la anchura de la puerta, de la bisagra al borde.</div>
        </div>

        <div style={st.caja}>
          <b>🧮 Cálculos</b>
          <div style={st.formula}>hueco = 2·r·sen(θ/2) = 2·{fmt(r, 1)}·sen({fmt(ang / 2, 1)}°) = <b>{fmt(cuerda, 2)} cm</b></div>
          <div style={st.formula}>arco del pomo = π·r·θ/180 = <b>{fmt(arco, 2)} cm</b></div>
          <div style={st.formula}>área barrida = π·r²·θ/360 = <b>{fmt(area, 2)} cm²</b></div>
          <div style={st.formula}>pomo en ( r·cos θ , r·sen θ ) = ( {fmt(r * Math.cos(rad(ang)), 2)} , {fmt(r * Math.sin(rad(ang)), 2)} )</div>
        </div>

        <div style={st.caja}>
          <b>🎯 Reto: que pase la caja</b>
          {!reto
            ? <div style={{ marginTop: 6 }}><button style={st.btn('#16a34a')} onClick={() => setReto({ caja: nuevoReto(r), resp: '', ok: null })}>Nuevo reto</button></div>
            : <>
                <div style={{ marginTop: 6, fontSize: 14 }}>Una caja de <b>{fmt(reto.caja, 1)} cm</b> de ancho tiene que pasar por la puerta. ¿Qué ángulo mínimo hay que abrirla?</div>
                <div style={{ ...st.fila, marginTop: 6 }}>
                  <input style={{ ...st.input, width: 80 }} placeholder="θ (°)" value={reto.resp} onChange={(ev) => setReto({ ...reto, resp: ev.target.value, ok: null })} onKeyDown={(ev) => ev.key === 'Enter' && comprobar()} />
                  <button style={st.btn('#0ea5e9')} onClick={comprobar}>Comprobar y abrir</button>
                  <button style={st.mini} onClick={() => setReto({ caja: nuevoReto(r), resp: '', ok: null })}>Otro</button>
                </div>
                {reto.ok === true && <div style={{ ...st.nota, color: '#86efac' }}>✅ ¡Correcto! θ = 2·arcsen({fmt(reto.caja, 1)} / {fmt(2 * r, 1)}) ≈ {fmt(angReto, 1)}°</div>}
                {reto.ok === false && <div style={{ ...st.nota, color: '#fca5a5' }}>❌ Mira cuánto hueco deja tu ángulo en «Cálculos» y ajusta. Pista: despeja θ de 2·r·sen(θ/2) = {fmt(reto.caja, 1)}.</div>}
              </>}
        </div>
      </div>

      <div style={{ flex: '3 1 420px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ ...st.caja, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <b style={{ alignSelf: 'flex-start' }}>Vista desde arriba</b>
          <VistaPuerta r={r} ang={ang} objetivo={reto?.caja} />
          <div style={st.nota}>Azul: el hueco (cuerda). Amarillo: el arco que recorre el pomo y el sector barrido.{reto ? ' Verde: la caja.' : ''}</div>
        </div>

        <Reaccion />
      </div>
    </div>
  );
}
