// 📷 Cámara que lee las tarjetas de respuesta (todo en el navegador, sin subir imágenes).
// Dibuja encima de cada tarjeta un recuadro con su número y la letra leída.
//
// props:
//   activo        → si es false, para la cámara
//   maxTarjeta    → solo se aceptan tarjetas 1…maxTarjeta
//   onDetecciones → (detecciones) en cada fotograma analizado (ver detectorTarjetas.js)
//   etiqueta      → (d) => { texto, color } para el recuadro de cada tarjeta (opcional)
//   alto          → alto CSS del vídeo (p. ej. '42vh')
//   onFotograma   → (imagenRGBA, detecciones) antes de pintar (p. ej. el Corrector lee la hoja)
//   pintarExtra   → (ctx, ex) dibuja encima (ex(x) corrige el modo espejo)
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { crearDetector } from './detectorTarjetas.js';

const LS_CAMARA = 'pikt_tarjetas_camara';
const LS_ESPEJO = 'pikt_tarjetas_espejo';
const leer = (k, def) => { try { const v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); } catch { return def; } };
const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };
// Ancho máximo que se analiza: más píxeles = se leen tarjetas más lejanas, pero va más lento.
const ANCHO_MAX = 1920;

function nuevoWorker() {
  try {
    return new Worker(new URL('./detectorWorker.js', import.meta.url), { type: 'module' });
  } catch {
    return null;
  }
}

export default function CamaraTarjetas({ activo = true, maxTarjeta = 40, onDetecciones, etiqueta, alto = '40vh', compacta = false, onFotograma, pintarExtra, textoContador }) {
  const videoRef = useRef(null);
  const capaRef = useRef(null);
  const lienzoRef = useRef(null);
  const streamRef = useRef(null);
  const workerRef = useRef(null);
  const detLocalRef = useRef(null);
  const ocupadoRef = useRef(false);
  const ultimoRef = useRef([]);
  const cbRef = useRef(onDetecciones);
  cbRef.current = onDetecciones;
  const etiquetaRef = useRef(etiqueta);
  etiquetaRef.current = etiqueta;
  const fotoRef = useRef(onFotograma);
  fotoRef.current = onFotograma;
  const extraRef = useRef(pintarExtra);
  extraRef.current = pintarExtra;
  const maxRef = useRef(maxTarjeta);
  maxRef.current = maxTarjeta;

  const [camaras, setCamaras] = useState([]);
  const [camaraId, setCamaraId] = useState(() => leer(LS_CAMARA, ''));
  const [espejo, setEspejo] = useState(() => leer(LS_ESPEJO, false));
  const espejoRef = useRef(espejo);
  espejoRef.current = espejo;
  const [error, setError] = useState('');
  const [info, setInfo] = useState({ fps: 0, vistas: 0, res: '' });

  // Dibuja los recuadros de la última lectura sobre el vídeo.
  const pintar = useCallback((dets, w, h) => {
    const cv = capaRef.current;
    if (!cv) return;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    const ex = (x) => (espejoRef.current ? w - x : x);
    for (const d of dets) {
      const et = etiquetaRef.current?.(d) || {};
      const color = et.color || (d.dudosa ? '#facc15' : '#22c55e');
      ctx.lineWidth = Math.max(3, w / 300);
      ctx.strokeStyle = color;
      ctx.beginPath();
      d.esquinas.forEach((p, i) => (i ? ctx.lineTo(ex(p.x), p.y) : ctx.moveTo(ex(p.x), p.y)));
      ctx.closePath();
      ctx.stroke();
      const texto = et.texto ?? `${d.tarjeta} · ${d.dudosa ? '?' : d.letra}`;
      if (texto === '') continue;
      const fs = Math.max(16, Math.min(48, d.lado * 0.45));
      ctx.font = `900 ${fs}px system-ui, sans-serif`;
      const tw = ctx.measureText(texto).width;
      const x = ex(d.centro.x) - tw / 2 - 6;
      const y = Math.min(...d.esquinas.map((p) => p.y)) - fs - 10;
      ctx.fillStyle = color;
      ctx.fillRect(x, Math.max(0, y), tw + 12, fs + 8);
      ctx.fillStyle = '#0f172a';
      ctx.fillText(texto, x + 6, Math.max(0, y) + fs);
    }
    try { extraRef.current?.(ctx, ex); } catch { /* dibujo opcional */ }
  }, []);

  // Cámara
  useEffect(() => {
    if (!activo) return undefined;
    let cancelado = false;
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(window.isSecureContext ? 'Este navegador no permite usar la cámara.' : 'La cámara solo funciona con https:// (o en localhost).');
      return undefined;
    }
    const video = camaraId
      ? { deviceId: { exact: camaraId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
      : { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } };
    navigator.mediaDevices.getUserMedia({ video, audio: false })
      .catch((e) => {
        // La cámara guardada ya no existe → la que haya
        if (camaraId && (e?.name === 'OverconstrainedError' || e?.name === 'NotFoundError')) {
          return navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        }
        throw e;
      })
      .then(async (stream) => {
        if (cancelado) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) { v.srcObject = stream; try { await v.play(); } catch { /* autoplay */ } }
        try {
          const devs = await navigator.mediaDevices.enumerateDevices();
          if (!cancelado) setCamaras(devs.filter((d) => d.kind === 'videoinput'));
        } catch { /* sin lista */ }
      })
      .catch((e) => {
        if (cancelado) return;
        const n = e?.name;
        setError(n === 'NotAllowedError' ? 'No hay permiso para usar la cámara. Pulsa el candado de la barra de direcciones y permite la cámara.'
          : n === 'NotFoundError' ? 'No se encuentra ninguna cámara conectada.'
          : n === 'NotReadableError' ? 'La cámara la está usando otra aplicación (Teams, Meet…). Ciérrala y vuelve a intentarlo.'
          : 'No se pudo abrir la cámara.');
      });
    return () => {
      cancelado = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [activo, camaraId]);

  // Bucle de análisis: un fotograma cada vez (el siguiente sale cuando acaba el anterior).
  useEffect(() => {
    if (!activo) return undefined;
    let vivo = true;
    let raf = 0;
    let marcas = [];
    const worker = nuevoWorker();
    workerRef.current = worker;
    let buffer = null;
    let tam = { w: 0, h: 0 };
    let imgEnviada = null;

    const entregar = (dets, w, h, img) => {
      ocupadoRef.current = false;
      if (!vivo) return;
      ultimoRef.current = dets;
      if (img) { try { fotoRef.current?.(img, dets); } catch { /* lector opcional */ } }
      pintar(dets, w, h);
      cbRef.current?.(dets);
      const ahora = performance.now();
      marcas = [...marcas.filter((t) => ahora - t < 1000), ahora];
      setInfo((i) => (i.vistas === dets.length && i.fps === marcas.length && i.res === `${w}×${h}` ? i : { fps: marcas.length, vistas: dets.length, res: `${w}×${h}` }));
    };

    if (worker) {
      worker.onmessage = (e) => {
        buffer = e.data.buffer;
        entregar(e.data.detecciones, tam.w, tam.h, imgEnviada);
      };
      worker.onerror = () => {
        // Sin worker (navegador antiguo): se analiza en el hilo principal
        workerRef.current = null;
        ocupadoRef.current = false;
      };
    }

    const paso = () => {
      if (!vivo) return;
      raf = requestAnimationFrame(paso);
      const v = videoRef.current;
      if (ocupadoRef.current || !v || v.readyState < 2 || !v.videoWidth) return;
      const esc = Math.min(1, ANCHO_MAX / v.videoWidth);
      const w = Math.round(v.videoWidth * esc);
      const h = Math.round(v.videoHeight * esc);
      let cv = lienzoRef.current;
      if (!cv) cv = lienzoRef.current = document.createElement('canvas');
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(v, 0, 0, w, h);
      const img = ctx.getImageData(0, 0, w, h);
      ocupadoRef.current = true;
      tam = { w, h };
      imgEnviada = fotoRef.current ? img : null;
      if (workerRef.current) {
        // Se reutiliza el buffer que devuelve el worker para no crear memoria en cada fotograma
        let buf = buffer && buffer.byteLength === img.data.byteLength ? new Uint8ClampedArray(buffer) : new Uint8ClampedArray(img.data.length);
        buf.set(img.data);
        buffer = null;
        workerRef.current.postMessage({ id: 0, width: w, height: h, buffer: buf.buffer, maxTarjeta: maxRef.current }, [buf.buffer]);
      } else {
        if (!detLocalRef.current || detLocalRef.current.max !== maxRef.current) {
          detLocalRef.current = { max: maxRef.current, det: crearDetector({ maxTarjeta: maxRef.current }) };
        }
        let dets = [];
        try { dets = detLocalRef.current.det.detectar(img); } catch { dets = []; }
        entregar(dets, w, h, img);
      }
    };
    raf = requestAnimationFrame(paso);
    return () => {
      vivo = false;
      cancelAnimationFrame(raf);
      worker?.terminate();
      workerRef.current = null;
      ocupadoRef.current = false;
    };
  }, [activo, pintar]);

  // Al cambiar el modo espejo se repinta la última lectura
  useEffect(() => {
    escribir(LS_ESPEJO, espejo);
    const cv = capaRef.current;
    if (cv) pintar(ultimoRef.current, cv.width, cv.height);
  }, [espejo, pintar]);

  if (!activo) return null;

  return (
    <div style={st.caja}>
      <div style={{ ...st.marco, height: alto }}>
        <video ref={videoRef} muted playsInline style={{ ...st.video, transform: espejo ? 'scaleX(-1)' : 'none' }} />
        <canvas ref={capaRef} style={st.capa} />
        {error && <div style={st.error}>📷 {error}</div>}
      </div>
      <div style={st.barra}>
        <span style={{ fontWeight: 800, color: info.vistas ? '#86efac' : '#94a3b8' }}>
          {textoContador ? textoContador(info.vistas) : `🃏 ${info.vistas} ${info.vistas === 1 ? 'tarjeta' : 'tarjetas'} a la vista`}
        </span>
        {!compacta && <span style={{ color: '#64748b' }}>{info.fps} fps · {info.res}</span>}
        {camaras.length > 1 && (
          <select value={camaraId} onChange={(e) => { setCamaraId(e.target.value); escribir(LS_CAMARA, e.target.value); }} style={st.select} aria-label="Cámara">
            <option value="">Cámara por defecto</option>
            {camaras.map((c, i) => <option key={c.deviceId || i} value={c.deviceId}>{c.label || `Cámara ${i + 1}`}</option>)}
          </select>
        )}
        <label style={{ display: 'flex', gap: 4, alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={espejo} onChange={(e) => setEspejo(e.target.checked)} /> Espejo
        </label>
      </div>
    </div>
  );
}

const st = {
  caja: { display: 'flex', flexDirection: 'column', gap: 6, width: '100%' },
  marco: { position: 'relative', width: '100%', background: '#000', borderRadius: 14, overflow: 'hidden', border: '2px solid #334155' },
  video: { width: '100%', height: '100%', objectFit: 'contain', display: 'block' },
  capa: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' },
  error: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 20, color: '#fde68a', fontWeight: 700, background: 'rgba(15,23,42,0.85)' },
  barra: { display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', fontSize: 13, color: '#cbd5e1' },
  select: { padding: '4px 8px', borderRadius: 8, border: '1px solid #475569', background: '#0f172a', color: '#f1f5f9', fontSize: 13, maxWidth: 220 },
};
