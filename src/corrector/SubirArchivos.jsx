// 🖼️ Corregir desde archivos: varias fotos de hojas o un vídeo pasando las hojas.
// Todo se analiza en este navegador (no se sube nada a internet).
//   Fotos → una lectura por foto.
//   Vídeo → una imagen cada PASO s; una hoja cuenta cuando se lee igual en 2 imágenes
//           seguidas, y por cada nº de lista se queda la lectura que más se repite.
import React, { useMemo, useRef, useState } from 'react';
import { crearDetector } from '../tarjetas/detectorTarjetas.js';
import { leerHoja, MARCAS } from './omr.js';
import { hayEscritas, leerEscritas, textosLeidos } from './escritas.js';
import { pintarLectura } from './dibujo.js';

const IDS = new Set(MARCAS.map((m) => m.tarjeta));
const LADO_FOTO = 2400; // lado largo máximo al analizar una foto
const LADO_VIDEO = 1600;
const PASO = 0.2; // segundos entre imágenes del vídeo

function aLienzo(fuente, ancho, alto, ladoMax) {
  const k = Math.min(1, ladoMax / Math.max(ancho, alto));
  const c = document.createElement('canvas');
  c.width = Math.round(ancho * k);
  c.height = Math.round(alto * k);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(fuente, 0, 0, c.width, c.height);
  return { c, ctx, img: ctx.getImageData(0, 0, c.width, c.height) };
}

function miniatura(c, r, opciones) {
  const k = 360 / c.width;
  const m = document.createElement('canvas');
  m.width = 360;
  m.height = Math.round(c.height * k);
  const ctx = m.getContext('2d');
  ctx.drawImage(c, 0, 0, m.width, m.height);
  if (r?.ok) { ctx.scale(k, k); pintarLectura(ctx, r, opciones); }
  return m.toDataURL('image/jpeg', 0.75);
}

const esperar = (el, ev) => new Promise((ok, mal) => {
  const f = () => { el.removeEventListener(ev, f); el.removeEventListener('error', e); ok(); };
  const e = () => { el.removeEventListener(ev, f); el.removeEventListener('error', e); mal(new Error('No se puede leer el vídeo')); };
  el.addEventListener(ev, f);
  el.addEventListener('error', e);
});

const MOTIVO = { marcas: 'No se ven al menos 3 de las 4 esquinas negras', lejos: 'La hoja sale muy pequeña', fuera: 'Parte de la hoja se sale de la foto' };

export default function SubirArchivos({ cfg, clave, modo, onHoja, onClave, nombre, prepararHoja, notaHoja }) {
  const [items, setItems] = useState([]); // { id, archivo, estado, texto, mini, lista, nota }
  const [progreso, setProgreso] = useState(null); // { texto, pct }
  const det = useMemo(() => crearDetector({ maxTarjeta: 64 }), []);
  const cancelar = useRef(false);
  const inputRef = useRef(null);
  const opcDibujo = { nPreguntas: cfg.nPreguntas, nOpciones: cfg.nOpciones, nEscritas: cfg.nEscritas || 0, letras: cfg.letras || 8, clave: modo === 'clave' ? null : clave };

  const añadir = (it) => setItems((prev) => [...prev, { id: Math.random().toString(36).slice(2), ...it }]);

  const leer = (img) => {
    const dets = det.detectar(img).filter((d) => IDS.has(d.tarjeta));
    return leerHoja(img, dets, cfg);
  };

  // Guarda una lectura buena como hoja (o como clave) y la añade al informe. lienzo: imagen para la miniatura.
  const aceptar = async (r, archivo, lienzo, extra = '') => {
    if (modo === 'clave') {
      const resp = r.respuestas.map((x) => (x === '*' ? '' : x));
      let textos = null;
      if (hayEscritas(cfg)) { try { textos = textosLeidos(await leerEscritas(r, cfg, () => false)); } catch { /* sin lector: solo el test */ } }
      onClave(resp, textos);
      añadir({ archivo, estado: 'ok', texto: '🔑 Clave leída' + (textos ? ' (también las escritas: revísalas en «Preparar»)' : '') + extra, mini: miniatura(lienzo, r, opcDibujo) });
      cancelar.current = true; // solo cuenta la primera hoja
      return;
    }
    if (!r.lista) { añadir({ archivo, estado: 'error', texto: 'No se lee el nº de lista', mini: miniatura(lienzo, r, opcDibujo) }); return; }
    let h;
    try { h = await prepararHoja(r); } catch { añadir({ archivo, estado: 'error', texto: 'No se pudo cargar el lector de letras (¿sin internet?)', mini: miniatura(lienzo, r, opcDibujo) }); return; }
    const p = notaHoja(h);
    onHoja(h);
    const texto = '✅ ' + p.aciertos + ' · ❌ ' + p.fallos + ' · ⚪ ' + p.blancos
      + (p.pendientes ? ' · 🔍 ' + p.pendientes + ' por revisar' : '')
      + (r.dudosas.length ? ' · ⚠ revisar ' + r.dudosas.map((q) => q + 1).join(', ') : '') + extra;
    añadir({ archivo, estado: 'ok', lista: r.lista, nota: p.nota, texto, mini: miniatura(lienzo, r, { ...opcDibujo, escritas: p.escritasEst }) });
  };

  const foto = async (f) => {
    let bmp;
    try { bmp = await createImageBitmap(f, { imageOrientation: 'from-image' }); } catch {
      añadir({ archivo: f.name, estado: 'error', texto: /hei[cf]$/i.test(f.name) ? 'Formato HEIC no compatible: guarda la foto como JPG' : 'No se puede abrir la imagen' });
      return;
    }
    const { c, img } = aLienzo(bmp, bmp.width, bmp.height, LADO_FOTO);
    bmp.close?.();
    const r = leer(img);
    if (!r.ok) { añadir({ archivo: f.name, estado: 'error', texto: MOTIVO[r.motivo] || 'No se lee la hoja', mini: miniatura(c, null, opcDibujo) }); return; }
    await aceptar(r, f.name, c);
  };

  const video = async (f) => {
    const url = URL.createObjectURL(f);
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
    try {
      await esperar(v, 'loadeddata');
      const dur = v.duration;
      if (!Number.isFinite(dur) || !v.videoWidth) throw new Error('vídeo vacío');
      const porLista = new Map(); // lista|'K' → Map(firma → { n, r, c })
      let anterior = '';
      for (let t = 0; t <= dur && !cancelar.current; t += PASO) {
        v.currentTime = Math.min(t, dur - 0.01);
        await esperar(v, 'seeked');
        const { c, img } = aLienzo(v, v.videoWidth, v.videoHeight, LADO_VIDEO);
        const r = leer(img);
        setProgreso({ texto: `${f.name}: ${Math.round(t)} de ${Math.round(dur)} s · ${porLista.size} ${porLista.size === 1 ? 'hoja' : 'hojas'}`, pct: Math.round((t / dur) * 100) });
        if (!r.ok || (modo === 'alumnos' && !r.lista)) { anterior = ''; continue; }
        const firma = `${r.lista}|${r.respuestas.join(',')}`;
        if (firma === anterior) {
          const k = modo === 'clave' ? 'K' : r.lista;
          if (!porLista.has(k)) porLista.set(k, new Map());
          const m = porLista.get(k);
          const e = m.get(firma);
          if (e) e.n++; else m.set(firma, { n: 1, r, c });
        }
        anterior = firma;
      }
      if (!porLista.size) { añadir({ archivo: f.name, estado: 'error', texto: 'No se ha leído ninguna hoja: pasa cada hoja más despacio (1-2 s quieta) y con las 4 esquinas a la vista' }); return; }
      for (const m of porLista.values()) {
        const mejor = [...m.values()].sort((a, b) => b.n - a.n)[0];
        const otras = m.size - 1;
        await aceptar(mejor.r, f.name, mejor.c, otras ? ` · ${otras} lectura(s) distinta(s): ¿hoja movida? Revísala` : '');
      }
    } catch (e) {
      añadir({ archivo: f.name, estado: 'error', texto: e?.message || 'No se puede leer el vídeo' });
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const procesar = async (lista) => {
    const archivos = [...lista];
    if (!archivos.length) return;
    cancelar.current = false;
    for (let i = 0; i < archivos.length && !cancelar.current; i++) {
      const f = archivos[i];
      setProgreso({ texto: `Analizando ${f.name} (${i + 1}/${archivos.length})…`, pct: Math.round((i / archivos.length) * 100) });
      await new Promise((r) => setTimeout(r, 30)); // deja pintar el progreso
      if (f.type.startsWith('video/')) await video(f); else await foto(f);
    }
    setProgreso(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={st.zona}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (!progreso) procesar(e.dataTransfer.files); }}
      >
        <div style={{ fontSize: 34 }}>🖼️ 🎞️</div>
        <b>Arrastra aquí las fotos o el vídeo</b>
        <span style={st.ayuda}>Varias fotos a la vez (una hoja por foto) o un vídeo pasando las hojas una a una. No se sube nada a internet.</span>
        <button style={st.btn} disabled={!!progreso} onClick={() => inputRef.current?.click()}>Elegir archivos</button>
        <input ref={inputRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => procesar(e.target.files)} />
      </div>
      {modo === 'clave' && <div style={st.aviso}>🔑 Modo clave: la primera hoja que se lea se guardará como clave.</div>}
      {progreso && (
        <div style={st.progreso}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span>{progreso.texto}</span><button style={st.mini} onClick={() => { cancelar.current = true; }}>Parar</button></div>
          <div style={st.barra}><div style={{ ...st.relleno, width: `${progreso.pct}%` }} /></div>
        </div>
      )}
      <ul style={{ ...st.ayuda, margin: 0, paddingLeft: 18 }}>
        <li><b>Fotos:</b> la hoja entera, de frente y con luz, sin que la corte el borde.</li>
        <li><b>Vídeo:</b> graba con el móvil quieto (o apoyado) y deja cada hoja 1-2 segundos; luego cambia a la siguiente.</li>
      </ul>
      {items.length > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b>{items.filter((i) => i.estado === 'ok').length} leídas · {items.filter((i) => i.estado !== 'ok').length} con problemas</b>
            <button style={st.mini} onClick={() => setItems([])}>Limpiar lista</button>
          </div>
          <div style={st.rejilla}>
            {[...items].reverse().map((it) => (
              <div key={it.id} style={{ ...st.tarjeta, borderColor: it.estado === 'ok' ? '#86efac' : '#fca5a5' }}>
                {it.mini && <img src={it.mini} alt="" style={{ width: '100%', borderRadius: 8, display: 'block' }} />}
                <div style={{ padding: '6px 4px', fontSize: 13 }}>
                  {it.lista && <div style={{ fontWeight: 900, fontSize: 15 }}>Nº {it.lista}{nombre(it.lista) ? ` · ${nombre(it.lista)}` : ''} · <span style={{ color: it.nota >= 5 ? '#16a34a' : '#dc2626' }}>{String(it.nota).replace('.', ',')}</span></div>}
                  <div style={{ color: it.estado === 'ok' ? '#334155' : '#b91c1c', fontWeight: it.estado === 'ok' ? 500 : 700 }}>{it.texto}</div>
                  <div style={{ color: '#94a3b8', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.archivo}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const st = {
  zona: { border: '2px dashed #94a3b8', borderRadius: 16, background: '#fff', padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' },
  ayuda: { color: '#64748b', fontSize: 13, lineHeight: 1.5 },
  btn: { padding: '11px 20px', borderRadius: 10, border: 'none', background: '#0f766e', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer' },
  mini: { padding: '4px 10px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 12 },
  aviso: { background: '#fef9c3', borderRadius: 10, padding: '8px 12px', fontWeight: 700, fontSize: 14 },
  progreso: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, fontSize: 14 },
  barra: { height: 8, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden', marginTop: 8 },
  relleno: { height: '100%', background: '#0f766e', transition: 'width .2s' },
  rejilla: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 },
  tarjeta: { background: '#fff', border: '2px solid', borderRadius: 12, padding: 6 },
};
