// 🛰️ GPS de clase y 📏 medidor de distancias.
//   modo 'gps': 2-4 satélites → circunferencias → posición (trilateración) + reto «ve al punto».
//   modo 'distancia': solo el satélite 1 → distancia al receptor (y comparación con la cinta métrica).
// Fuente de las distancias: 🧪 simulación (arrastras el receptor por la sala), 🔊 sonido (tiempo que
// tarda el pitido del satélite) o 📶 radio (intensidad de la señal).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import VistaSala from './VistaSala.jsx';
import { useInstrumentos, useModoInstrumento } from './useInstrumentos';
import { enviarAInstrumentos } from '../mandos/mandosMicrobit.js';
import {
  trilaterar, distanciaDeSonido, distanciaDeRssi, velocidadSonido, mediana, ruido, fmt,
} from './trilateracion';
import { COLORES_SAT } from './escenaSala';
import { guardarRegistroLocal } from '../utils/registrosLocales';
import { st } from './estilosLab';

const LS_CALIB = 'pikt_lab_calib';
const N_MEDIANA = 5;
const TOLERANCIA_RETO = 0.6; // m

const leerCalib = () => {
  const def = { offsetUs: {}, rssi1m: -50, n: 2.5, temp: 20, umbral: 90 };
  try { return { ...def, ...JSON.parse(localStorage.getItem(LS_CALIB) || '{}') }; } catch { return def; }
};

export default function GpsLab({ sala, modo = 'gps' }) {
  const distancia = modo === 'distancia';
  const sats = useMemo(() => (distancia ? sala.satelites.slice(0, 1) : sala.satelites), [sala.satelites, distancia]);
  const [fuente, setFuente] = useState('sim'); // sim | sonido | radio
  const [calib, setCalib] = useState(leerCalib);
  const [receptorSim, setReceptorSim] = useState({ x: sala.ancho * 0.55, y: sala.largo * 0.45 });
  const [ruidoSim, setRuidoSim] = useState(0.1);
  const [distSim, setDistSim] = useState([]);
  const medidas = useRef({}); // k → últimos valores (us o rssi)
  const estadoSat = useRef({}); // k → { ultimo, fallos }
  const [, setVersion] = useState(0);
  const [marcas, setMarcas] = useState([]);
  const [reto, setReto] = useState(null); // { x, y, ok }
  const [cinta, setCinta] = useState('');
  const [verMates, setVerMates] = useState(true);

  useEffect(() => { try { localStorage.setItem(LS_CALIB, JSON.stringify(calib)); } catch { /* nada */ } }, [calib]);
  useEffect(() => { medidas.current = {}; estadoSat.current = {}; setVersion((v) => v + 1); }, [fuente]);

  // ── Placas ──
  useModoInstrumento(fuente === 'sonido' ? `GS:${Math.max(1, sats.length)}` : fuente === 'radio' ? 'GR' : null);
  useEffect(() => { if (fuente === 'sonido') enviarAInstrumentos(`I:U:${calib.umbral}`); }, [fuente, calib.umbral]);

  const marcar = (p) => p && setMarcas((m) => [...m.slice(-49), { x: p.x, y: p.y }]);
  const resRef = useRef(null);

  useInstrumentos((ev) => {
    if (fuente === 'sonido' && ev.tipo === 'G') {
      const e = (estadoSat.current[ev.k] ||= { ultimo: null, fallos: 0 });
      e.ultimo = ev.us;
      if (ev.us > 0) { (medidas.current[ev.k] ||= []).push(ev.us); medidas.current[ev.k] = medidas.current[ev.k].slice(-N_MEDIANA); e.fallos = 0; } else e.fallos++;
      setVersion((v) => v + 1);
    } else if (fuente === 'radio' && ev.tipo === 'S') {
      (estadoSat.current[ev.k] ||= { ultimo: null, fallos: 0 }).ultimo = ev.rssi;
      (medidas.current[ev.k] ||= []).push(ev.rssi);
      medidas.current[ev.k] = medidas.current[ev.k].slice(-N_MEDIANA);
      setVersion((v) => v + 1);
    } else if (ev.tipo === 'P' && fuente !== 'sim') marcar(resRef.current?.punto);
  });

  // ── Simulación: distancias reales + ruido, renovadas cada 0,6 s ──
  useEffect(() => {
    if (fuente !== 'sim') return undefined;
    const calc = () => setDistSim(sats.map((s) => Math.max(0, Math.hypot(s.x - receptorSim.x, s.y - receptorSim.y) + ruido(ruidoSim))));
    calc();
    const t = setInterval(calc, 600);
    return () => clearInterval(t);
  }, [fuente, sats, receptorSim, ruidoSim]);

  const v = velocidadSonido(calib.temp);
  const dists = sats.map((s, i) => {
    if (fuente === 'sim') return distSim[i] ?? null;
    const med = mediana(medidas.current[s.k] || []);
    if (med == null) return null;
    return fuente === 'sonido' ? distanciaDeSonido(med, calib.offsetUs[s.k] || 0, v) : distanciaDeRssi(med, calib.rssi1m, calib.n);
  });
  const dentro = (p) => p.x >= -0.3 && p.y >= -0.3 && p.x <= sala.ancho + 0.3 && p.y <= sala.largo + 0.3;
  const res = distancia ? null : trilaterar(sats, dists, dentro);
  resRef.current = res;

  // Reto conseguido
  useEffect(() => {
    if (!reto || reto.ok || !res) return;
    if (Math.hypot(res.punto.x - reto.x, res.punto.y - reto.y) <= TOLERANCIA_RETO) {
      setReto((r) => ({ ...r, ok: true }));
      guardarRegistroLocal('LAB_MICROBIT', { titulo: `Reto GPS (${fmt(reto.x, 1)} ; ${fmt(reto.y, 1)})`, aciertos: 1, intentos: 1, nombre: 'GPS', via: fuente });
    }
  }, [res?.punto.x, res?.punto.y, reto]); // eslint-disable-line react-hooks/exhaustive-deps

  const nuevoReto = () => setReto({ x: Math.round((0.8 + Math.random() * (sala.ancho - 1.6)) * 2) / 2, y: Math.round((0.8 + Math.random() * (sala.largo - 1.6)) * 2) / 2, ok: false });

  const calibrar = (k) => {
    const med = mediana(medidas.current[k] || []);
    if (med == null) { alert('Todavía no hay medidas de ese satélite.'); return; }
    if (fuente === 'sonido') setCalib((c) => ({ ...c, offsetUs: { ...c.offsetUs, [k]: Math.round(med - 1e6 / v) } }));
    else setCalib((c) => ({ ...c, rssi1m: Math.round(med) }));
  };

  // ── Capas 3D ──
  const capas = useMemo(() => {
    const c = { circulos: [], puntos: [], lineas: [], rastro: marcas };
    sats.forEach((s, i) => { if (dists[i] != null) c.circulos.push({ x: s.x, y: s.y, r: dists[i], color: COLORES_SAT[(s.k - 1) % 4] }); });
    if (distancia && dists[0] != null) {
      const s = sats[0];
      if (fuente === 'sim') c.lineas.push({ a: s, b: receptorSim, color: COLORES_SAT[0], texto: `${fmt(dists[0])} m` });
    }
    if (res) {
      if (res.cortes?.puntos.length === 2) res.cortes.puntos.forEach((p) => c.puntos.push({ ...p, color: '#fde68a' }));
      c.puntos.push({ ...res.punto, color: '#facc15', grande: true, texto: `(${fmt(res.punto.x)} ; ${fmt(res.punto.y)})` });
    }
    if (reto) c.puntos.push({ x: reto.x, y: reto.y, color: reto.ok ? '#22c55e' : '#4ade80', texto: reto.ok ? '✔ ¡Conseguido!' : '🎯 Ve aquí' });
    return c;
  }, [JSON.stringify(dists), res?.punto.x, res?.punto.y, marcas, reto, receptorSim, fuente]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!sats.length || (!distancia && sats.length < 2)) {
    return <div style={st.aviso}>Para el GPS hacen falta al menos 2 satélites en la sala (mejor 3). Añádelos en «🏠 Mi sala».</div>;
  }

  const errorSim = fuente === 'sim' && res ? Math.hypot(res.punto.x - receptorSim.x, res.punto.y - receptorSim.y) : null;
  const d0 = dists[0];
  const cintaN = Number(String(cinta).replace(',', '.'));

  return (
    <div style={st.dosColumnas}>
      <div style={st.lateral}>
        <div style={st.caja}>
          <b>¿De dónde salen las distancias?</b>
          <div style={{ ...st.fila, marginTop: 6 }}>
            <button style={st.chip(fuente === 'sim')} onClick={() => setFuente('sim')}>🧪 Simulación</button>
            <button style={st.chip(fuente === 'sonido')} onClick={() => setFuente('sonido')}>🔊 Sonido</button>
            <button style={st.chip(fuente === 'radio')} onClick={() => setFuente('radio')}>📶 Radio</button>
          </div>
          {fuente === 'sim' && (
            <>
              <div style={st.nota}>Arrastra al <b style={{ color: '#c084fc' }}>receptor</b> (o pulsa en el suelo) y mira cómo cambian las circunferencias. El «ruido» imita los errores de una medida real.</div>
              <label style={{ ...st.label, marginTop: 6 }}>Error de las medidas: ± {fmt(ruidoSim)} m
                <input type="range" min="0" max="0.6" step="0.05" value={ruidoSim} onChange={(e) => setRuidoSim(Number(e.target.value))} />
              </label>
            </>
          )}
          {fuente === 'sonido' && (
            <>
              <div style={st.nota}>Cada satélite avisa por radio (llega al instante) y a la vez pita. El receptor mide cuánto tarda en oír el pitido: <b>distancia = velocidad del sonido × tiempo</b>, como el GPS de verdad con las señales de los satélites.</div>
              <div style={st.rejilla3}>
                <label style={st.label}>Temperatura (°C)<input type="number" value={calib.temp} onChange={(e) => setCalib((c) => ({ ...c, temp: Number(e.target.value) || 0 }))} style={st.input} /></label>
                <label style={st.label}>Umbral micro<input type="number" min="20" max="250" value={calib.umbral} onChange={(e) => setCalib((c) => ({ ...c, umbral: Math.max(20, Math.min(250, Number(e.target.value) || 90)) }))} style={st.input} /></label>
              </div>
              <div style={st.formula}>v = 331,3 + 0,606 · {fmt(calib.temp, 0)} = {fmt(v, 1)} m/s</div>
            </>
          )}
          {fuente === 'radio' && (
            <>
              <div style={st.nota}>Cuanto más lejos está el satélite, más débil llega su señal (RSSI). Es menos exacto que el sonido: las paredes y las personas la debilitan.</div>
              <div style={st.rejilla3}>
                <label style={st.label}>RSSI a 1 m<input type="number" value={calib.rssi1m} onChange={(e) => setCalib((c) => ({ ...c, rssi1m: Number(e.target.value) || -50 }))} style={st.input} /></label>
                <label style={st.label}>Exponente n<input type="number" step="0.1" value={calib.n} onChange={(e) => setCalib((c) => ({ ...c, n: Math.max(1.5, Math.min(5, Number(e.target.value) || 2.5)) }))} style={st.input} /></label>
              </div>
              <div style={st.formula}>d = 10^(({calib.rssi1m} − RSSI) / (10 · {fmt(calib.n, 1)}))</div>
            </>
          )}
        </div>

        <div style={st.caja}>
          <b>{distancia ? '📏 Distancia al satélite 1' : '🛰️ Distancias medidas'}</b>
          {sats.map((s, i) => {
            const e = estadoSat.current[s.k];
            return (
              <div key={s.k} style={{ ...st.fila, marginTop: 5 }}>
                <span style={{ ...st.punto, background: COLORES_SAT[(s.k - 1) % 4] }} />
                <b>S{s.k}</b>
                <span style={{ flex: 1 }}>d{s.k} = <b>{fmt(dists[i])} m</b></span>
                {fuente === 'sonido' && e && <span style={{ fontSize: 12, color: e.ultimo > 0 ? '#94a3b8' : '#fca5a5' }}>{e.ultimo === -1 ? 'no se oyó' : e.ultimo === -2 ? 'no responde' : `${fmt(e.ultimo / 1000, 1)} ms`}</span>}
                {fuente === 'radio' && e && <span style={{ fontSize: 12, color: '#94a3b8' }}>{e.ultimo} dBm</span>}
                {fuente !== 'sim' && <button style={st.mini} title="Pon el receptor a 1 m exacto de este satélite y pulsa" onClick={() => calibrar(s.k)}>📏 1 m</button>}
              </div>
            );
          })}
          {fuente === 'sonido' && <div style={st.nota}>Para calibrar, pon el receptor a <b>1 m exacto</b> de cada satélite y pulsa «📏 1 m»: se descuenta el retraso fijo de las placas.</div>}
          {fuente !== 'sim' && Object.keys(estadoSat.current).length === 0 && <div style={{ ...st.aviso, marginTop: 8 }}>Esperando medidas… Comprueba que la antena está conectada y que el instrumento y los satélites están encendidos en el mismo canal.</div>}
        </div>

        {distancia ? (
          <div style={st.caja}>
            <div style={st.grande}>{fmt(d0)} m</div>
            {fuente === 'sonido' && <div style={st.formula}>d = {fmt(v, 1)} m/s × {fmt(((mediana(medidas.current[sats[0].k] || []) || 0) - (calib.offsetUs[sats[0].k] || 0)) / 1e6, 4)} s</div>}
            <label style={{ ...st.label, marginTop: 8 }}>Medida con la cinta métrica (m)
              <input value={cinta} onChange={(e) => setCinta(e.target.value)} placeholder="por ejemplo 3,25" style={st.input} />
            </label>
            {cintaN > 0 && d0 != null && (
              <div style={st.formula}>
                Error absoluto = |{fmt(d0)} − {fmt(cintaN)}| = {fmt(Math.abs(d0 - cintaN))} m · relativo = {fmt((Math.abs(d0 - cintaN) / cintaN) * 100, 1)} %
              </div>
            )}
          </div>
        ) : (
          <>
            <div style={st.caja}>
              <b>📍 Posición calculada</b>
              <div style={st.grande}>{res ? `(${fmt(res.punto.x)} ; ${fmt(res.punto.y)})` : '—'}</div>
              {res && <div style={st.nota}>Las circunferencias no se cortan exactamente en un punto: error medio {fmt(res.error)} m.{errorSim != null && <> Distancia al receptor real: <b>{fmt(errorSim)} m</b>.</>}</div>}
              <div style={{ ...st.fila, marginTop: 8 }}>
                <button style={st.mini} disabled={!res} onClick={() => marcar(res?.punto)}>📌 Marcar punto</button>
                <button style={st.mini} disabled={!marcas.length} onClick={() => setMarcas([])}>🧹 Borrar recorrido</button>
                <button style={{ ...st.mini, background: '#15803d' }} onClick={nuevoReto}>🎯 Reto: ve a un punto</button>
              </div>
              {fuente !== 'sim' && <div style={st.nota}>Con el botón <b>A</b> del receptor también se marca el punto: así se dibuja un recorrido por la sala.</div>}
              {reto && <div style={{ ...st.aviso, marginTop: 8, ...(reto.ok ? { background: 'rgba(34,197,94,.15)', borderColor: '#22c55e', color: '#bbf7d0' } : {}) }}>
                {reto.ok ? `✔ ¡Has llegado a (${fmt(reto.x, 1)} ; ${fmt(reto.y, 1)})!` : `🎯 Lleva el receptor al punto (${fmt(reto.x, 1)} ; ${fmt(reto.y, 1)}). Vale si te quedas a menos de ${fmt(TOLERANCIA_RETO, 1)} m.`}
              </div>}
            </div>
            <div style={st.caja}>
              <button style={{ ...st.mini, background: 'transparent', padding: 0, fontSize: 14 }} onClick={() => setVerMates((x) => !x)}>{verMates ? '▼' : '▶'} <b>🧮 Cómo se calcula</b></button>
              {verMates && <Calculo sats={sats} dists={dists} res={res} />}
            </div>
          </>
        )}
      </div>

      <VistaSala
        sala={sala}
        receptor={fuente === 'sim' ? receptorSim : null}
        capas={capas}
        interaccion={{ muebles: false, satelites: false, receptor: fuente === 'sim' }}
        onMover={(clave, x, y) => { if (clave === 'r') setReceptorSim({ x, y }); }}
        onClickSuelo={(x, y) => { if (fuente === 'sim') setReceptorSim({ x, y }); }}
        style={st.vista3d}
      />
    </div>
  );
}

// Explicación con los números de ahora: circunferencias → sistema lineal → solución
function Calculo({ sats, dists, res }) {
  const usados = sats.map((s, i) => ({ s, d: dists[i] })).filter((u) => u.d != null);
  if (usados.length < 2) return <div style={st.nota}>Faltan medidas.</div>;
  const p = (x) => (x < 0 ? `(${fmt(x)})` : fmt(x));
  const circ = (s, d) => `(x − ${p(s.x)})² + (y − ${p(s.y)})² = ${fmt(d)}²`;
  return (
    <div style={{ marginTop: 6 }}>
      <div style={st.nota}>1️⃣ Cada distancia dice que el receptor está en una circunferencia con centro en el satélite:</div>
      {usados.map(({ s, d }) => <div key={s.k} style={{ ...st.formula, color: COLORES_SAT[(s.k - 1) % 4] }}>{circ(s, d)}</div>)}
      {usados.length === 2 && res?.cortes && (
        <div style={st.nota}>
          2️⃣ Con dos circunferencias {res.cortes.seCortan ? <>hay <b>dos</b> puntos de corte: ({fmt(res.cortes.puntos[0].x)} ; {fmt(res.cortes.puntos[0].y)}) y ({fmt(res.cortes.puntos[1].x)} ; {fmt(res.cortes.puntos[1].y)}). Se elige el que está dentro de la sala; con un tercer satélite se sabría seguro.</> : <>no llegan a cortarse (las medidas tienen error): se toma el punto intermedio entre ellas.</>}
        </div>
      )}
      {usados.length >= 3 && res?.sistema && (
        <>
          <div style={st.nota}>2️⃣ Restando la 1.ª a la 2.ª y a la 3.ª desaparecen x² e y² y queda un sistema lineal:</div>
          <div style={st.formula}>{fmt(res.sistema.a)}·x + {p(res.sistema.b)}·y = {fmt(res.sistema.c)}</div>
          <div style={st.formula}>{fmt(res.sistema.e)}·x + {p(res.sistema.f)}·y = {fmt(res.sistema.g)}</div>
          {res.sistema.punto ? (
            <div style={st.nota}>3️⃣ Por Cramer (determinante {fmt(res.sistema.det)}): x = {fmt(res.sistema.punto.x)}, y = {fmt(res.sistema.punto.y)}.{usados.length === 4 && ' Con 4 satélites hay más ecuaciones que incógnitas: se busca el punto que mejor las cumple todas (mínimos cuadrados).'}</div>
          ) : (
            <div style={st.nota}>3️⃣ El determinante es 0: los satélites están en línea recta y no se puede saber el punto. ¡Colócalos formando un triángulo!</div>
          )}
        </>
      )}
    </div>
  );
}
