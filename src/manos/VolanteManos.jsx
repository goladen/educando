// Volante con las manos para juegos de conducir (webcam, MediaPipe).
//   · Dos manos «agarrando» un volante: el giro es la inclinación de la línea entre ellas.
//     Una sola mano: girar = llevar la mano a un lado.
//   · Marchas: ☝️ 1 dedo mantenido = adelante (D) · ✌️ 2 dedos = marcha atrás (R).
//   · Preguntas: con `opciones` > 0 se deja de conducir y 1-4 dedos mantenidos 1 s
//     eligen A-D (onElegir(índice)).
// Escribe en `salidaRef.current` = { activo, giro (-1…1, + = derecha), marcha (1 | -1), hayManos }.
import React, { useEffect, useRef, useState } from 'react';
import { escucharManos } from './manosVision.js';
import VistaManos from './VistaManos.jsx';

const GIRO_MAX_GRADOS = 70; // inclinación de las manos para girar a tope
const ZONA_MUERTA_GRADOS = 10; // por debajo, recto
const CURVA = 1.6; // > 1: los giros pequeños mueven poco (control fino) y el tope llega al final
const UNA_MANO_ZONA = 0.07; // con una mano: desplazamiento sin girar…
const UNA_MANO_RECORRIDO = 0.3; // …y desplazamiento extra para girar a tope
const MARCHA_MS = 600; // tiempo mostrando 1 o 2 dedos para cambiar de marcha
const RESPUESTA_MS = 1000;
const PAUSA_TRAS_PREGUNTA_MS = 2000; // para que el ✌️ de la respuesta B no ponga la marcha atrás
const LETRAS = ['A', 'B', 'C', 'D'];

const limitar = (v) => Math.max(-1, Math.min(1, v));
/** Zona muerta + recorrido + curva progresiva → -1…1. */
const respuesta = (v, zona, recorrido) => {
  const a = Math.abs(v);
  if (a <= zona) return 0;
  return Math.sign(v) * Math.pow(Math.min(1, (a - zona) / recorrido), CURVA);
};

export default function VolanteManos({ salidaRef, opciones = 0, onElegir, style, ancho = 230 }) {
  const [vista, setVista] = useState({ giro: 0, marcha: 1, hayManos: false, dedos: 0, progreso: 0, cambio: null });
  const vivo = useRef({ opciones, onElegir });
  vivo.current = { opciones, onElegir };
  const finPregunta = useRef(0);
  const opcionesAntes = useRef(opciones);

  // Al cerrarse una pregunta, unos segundos sin cambios de marcha.
  useEffect(() => {
    if (opcionesAntes.current > 0 && opciones === 0) finPregunta.current = performance.now();
    opcionesAntes.current = opciones;
  }, [opciones]);

  useEffect(() => {
    const s = {
      marcha: 1,
      giro: 0,
      cand: 0, // nº de dedos candidato (marcha o respuesta)
      desde: 0,
      respondida: false,
      sinManosDesde: 0,
      ui: 0,
    };
    salidaRef.current = { activo: true, giro: 0, marcha: 1, hayManos: false };

    const baja = escucharManos((manos) => {
      const ahora = performance.now();
      const { opciones: nOps, onElegir: elegir } = vivo.current;

      // ── Giro ──
      let giro = 0;
      if (manos.length >= 2) {
        const [a, b] = manos[0].centro.x < manos[1].centro.x ? [manos[0], manos[1]] : [manos[1], manos[0]];
        // Mano derecha más baja = volante girado a la derecha
        const grados = (Math.atan2(b.centro.y - a.centro.y, b.centro.x - a.centro.x) * 180) / Math.PI;
        giro = respuesta(grados, ZONA_MUERTA_GRADOS, GIRO_MAX_GRADOS - ZONA_MUERTA_GRADOS);
      } else if (manos.length === 1) {
        giro = respuesta(manos[0].centro.x - 0.5, UNA_MANO_ZONA, UNA_MANO_RECORRIDO);
      }
      giro = limitar(giro);
      s.giro += (giro - s.giro) * 0.25; // suavizado (quita el temblor de las manos)
      if (manos.length) s.sinManosDesde = 0;
      else if (!s.sinManosDesde) s.sinManosDesde = ahora;

      // ── Dedos: el número que enseña alguna mano (0 = puños agarrando el volante) ──
      const conDedos = manos.filter((m) => m.dedos >= 1 && !m.abierta);
      const dedos = conDedos.length ? conDedos[0].dedos : 0;
      if (dedos !== s.cand) {
        s.cand = dedos;
        s.desde = ahora;
        s.respondida = false;
      }
      const mantenido = ahora - s.desde;
      let progreso = 0;
      let cambio = null;

      if (nOps > 0) {
        // Respondiendo una pregunta
        if (dedos >= 1 && dedos <= nOps && !s.respondida) {
          progreso = Math.min(1, mantenido / RESPUESTA_MS);
          if (progreso >= 1) {
            s.respondida = true;
            elegir?.(dedos - 1);
          }
        }
      } else if (ahora - finPregunta.current > PAUSA_TRAS_PREGUNTA_MS && (dedos === 1 || dedos === 2)) {
        const nueva = dedos === 1 ? 1 : -1;
        if (nueva !== s.marcha) {
          progreso = Math.min(1, mantenido / MARCHA_MS);
          cambio = nueva;
          if (progreso >= 1) s.marcha = nueva;
        }
      }

      const sinManos = !manos.length && ahora - s.sinManosDesde > 400;
      salidaRef.current = { activo: true, giro: nOps > 0 || sinManos ? 0 : s.giro, marcha: s.marcha, hayManos: !sinManos };

      if (ahora - s.ui > 70) {
        s.ui = ahora;
        setVista({ giro: s.giro, marcha: s.marcha, hayManos: !!manos.length, dedos, progreso, cambio });
      }
    });

    return () => {
      baja();
      salidaRef.current = { activo: false, giro: 0, marcha: 1, hayManos: false };
    };
  }, [salidaRef]);

  const respondiendo = opciones > 0;
  const alto = Math.round((ancho * 9) / 16);

  return (
    <div style={{ width: ancho, background: 'rgba(0,0,0,0.6)', borderRadius: 14, padding: 6, boxShadow: '0 4px 18px rgba(0,0,0,0.5)', fontFamily: "'Segoe UI',sans-serif", ...style }}>
      <div style={{ position: 'relative', width: ancho, height: alto }}>
        <VistaManos ancho={ancho} colorMano={() => (respondiendo ? '#f1c40f' : '#2ecc71')} />
        {/* Volante */}
        {!respondiendo && (
          <svg
            viewBox="-50 -50 100 100"
            style={{ position: 'absolute', left: '50%', top: '50%', width: alto * 0.8, height: alto * 0.8, transform: `translate(-50%,-50%) rotate(${vista.giro * 90}deg)`, pointerEvents: 'none', opacity: vista.hayManos ? 0.85 : 0.4 }}
          >
            <circle r="42" fill="none" stroke="#111" strokeWidth="9" />
            <circle r="42" fill="none" stroke="#FF6B00" strokeWidth="3" />
            <circle r="9" fill="#222" stroke="#FF6B00" strokeWidth="2" />
            <path d="M -40 4 L -9 2 M 40 4 L 9 2 M 0 9 L 0 40" stroke="#222" strokeWidth="7" strokeLinecap="round" />
            <rect x="-4" y="-46" width="8" height="8" rx="2" fill="#FF6B00" />
          </svg>
        )}
        {/* Marcha */}
        <div style={{ position: 'absolute', top: 6, right: 6, width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 20, color: '#fff', background: vista.marcha === 1 ? '#27ae60' : '#c0392b', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
          {vista.marcha === 1 ? 'D' : 'R'}
        </div>
        {/* Progreso (cambio de marcha o respuesta) */}
        {vista.progreso > 0 && (
          <div style={{ position: 'absolute', left: 6, right: 6, bottom: 6, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
            <div style={{ width: `${vista.progreso * 100}%`, height: '100%', background: respondiendo ? '#f1c40f' : vista.cambio === 1 ? '#27ae60' : '#c0392b' }} />
          </div>
        )}
        {!vista.hayManos && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 18, color: '#fff', fontWeight: 800, fontSize: 12, textShadow: '0 1px 4px #000', pointerEvents: 'none' }}>
            🙌 Pon las manos delante de la cámara
          </div>
        )}
      </div>
      <div style={{ color: '#fff', fontSize: 11, textAlign: 'center', marginTop: 5, lineHeight: 1.35 }}>
        {respondiendo ? (
          <>
            Responde con los dedos: {LETRAS.slice(0, opciones).map((l, i) => `${i + 1}=${l}`).join(' · ')}
            {vista.dedos >= 1 && vista.dedos <= opciones && <b style={{ color: '#f1c40f' }}> → {LETRAS[vista.dedos - 1]}</b>}
          </>
        ) : vista.cambio ? (
          <b style={{ color: vista.cambio === 1 ? '#2ecc71' : '#e74c3c' }}>{vista.cambio === 1 ? '☝️ Poniendo marcha adelante…' : '✌️ Poniendo marcha atrás…'}</b>
        ) : (
          <>🙌 Gira las manos como un volante · ☝️ adelante · ✌️ atrás</>
        )}
      </div>
    </div>
  );
}
