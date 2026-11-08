// Paneles laterales del editor: Elementos (textos, formas, líneas, emojis),
// Plantillas de diseño y Capas.
import { useMemo, useState } from 'react';
import { FORMAS, nid, estiloTexto, SuperficieEstatica } from './render';
import { TEXTOS_PRESET, LINEAS_PRESET, EMOJIS, PLANTILLAS } from './plantillas';
import { ETIQ } from './ui';

const titulo = { ...ETIQ, margin: '12px 0 6px' };
const centrar = (w, h) => ({ x: (100 - w) / 2 + (Math.random() * 4 - 2), y: (100 - h) / 2 + (Math.random() * 4 - 2), w, h });

// ─── ELEMENTOS ────────────────────────────────────────────────────────────────
export function PanelElementos({ t, onAnadir, onSubirImagen, onBuscarImagen }) {
  const [cat, setCat] = useState('Clase');

  const anadirTexto = (p) => {
    const props = p.make(t);
    onAnadir([{ id: nid(), type: 'text', ...centrar(props.w || 50, props.h || 16), ...props }], false);
  };
  const anadirForma = (shapeType) => {
    const w = shapeType === 'rect' ? 30 : ['arrow', 'arrowL', 'doubleArrow', 'chevron', 'banner', 'parallelogram'].includes(shapeType) ? 28 : 20;
    const h = shapeType === 'rect' ? 30 : ['arrow', 'arrowL', 'doubleArrow', 'chevron', 'banner', 'parallelogram'].includes(shapeType) ? 26 : w * 16 / 9;
    onAnadir([{
      id: nid(), type: 'shape', shapeType, ...centrar(w, h),
      fill: t.accent === '#ffffff' ? '#6c63ff' : t.accent, stroke: 'none', strokeWidth: 2,
      borderRadius: shapeType === 'rect' ? 12 : 0, opacity: 1,
    }], false);
  };
  const anadirLinea = (props) => onAnadir([{
    id: nid(), type: 'shape', shapeType: 'line', x: 30, y: 48.5, w: 40, h: 3, fill: t.text, strokeWidth: 4, opacity: 1, ...props,
  }], false);
  const anadirEmoji = (e) => onAnadir([{
    id: nid(), type: 'text', text: e, ...centrar(12, 22), fontSize: 84, textAlign: 'center', vAlign: 'middle', lineHeight: 1, opacity: 1,
  }], false);

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
        <button onClick={onSubirImagen} style={btnGrande('#6c63ff')}>⬆️ Subir imagen</button>
        <button onClick={onBuscarImagen} style={btnGrande('#374151')}>🔍 Buscar</button>
      </div>
      <div style={{ fontSize: 10, color: '#6b7280' }}>También puedes arrastrar imágenes al lienzo o pegarlas con Ctrl+V.</div>

      <div style={titulo}>Textos</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {TEXTOS_PRESET.map(p => {
          const props = p.make(t);
          const est = estiloTexto(props, t);
          return (
            <button key={p.label} onClick={() => anadirTexto(p)} title={p.label}
              style={{ background: t.bg, border: '1px solid #374151', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', textAlign: 'center', overflow: 'hidden' }}>
              <span style={{ ...est, fontSize: Math.max(12, Math.min(24, (props.fontSize || 20) * 0.42)), display: 'inline-block', padding: props.bgColor ? '2px 10px' : 0, background: props.bgColor || undefined, borderRadius: props.bgColor ? 12 : undefined, whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3 }}>
                {props.lista ? `${props.lista === 'number' ? '1.' : props.lista === 'check' ? '✓' : '•'} ${p.label}` : p.label}
              </span>
            </button>
          );
        })}
      </div>

      <div style={titulo}>Formas</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 5 }}>
        {Object.entries(FORMAS).filter(([k]) => k !== 'line').map(([k, f]) => (
          <button key={k} onClick={() => anadirForma(k)} title={f.label}
            style={{ background: '#111827', border: '1px solid #374151', borderRadius: 6, height: 38, cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {k === 'rect' && <div style={{ width: '100%', height: '75%', background: '#a78bfa', borderRadius: 4 }} />}
            {k === 'circle' && <div style={{ height: '100%', aspectRatio: '1', background: '#a78bfa', borderRadius: '50%' }} />}
            {f.d && <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}><path d={f.d} fill="#a78bfa" /></svg>}
          </button>
        ))}
      </div>

      <div style={titulo}>Líneas y flechas</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 5 }}>
        {LINEAS_PRESET.map(l => (
          <button key={l.label} onClick={() => anadirLinea(l.props)} title={l.label}
            style={{ background: '#111827', border: '1px solid #374151', borderRadius: 6, height: 34, cursor: 'pointer', color: '#c4b5fd', fontSize: 15, fontWeight: 900 }}>{l.icon}</button>
        ))}
      </div>

      <div style={titulo}>Emojis y stickers</div>
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 6 }}>
        {Object.keys(EMOJIS).map(c => (
          <button key={c} onClick={() => setCat(c)}
            style={{ background: cat === c ? '#6c63ff' : '#374151', color: '#fff', border: 'none', borderRadius: 10, padding: '3px 8px', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>{c}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 3 }}>
        {EMOJIS[cat].map(e => (
          <button key={e} onClick={() => anadirEmoji(e)}
            style={{ background: 'transparent', border: 'none', borderRadius: 6, fontSize: 24, cursor: 'pointer', padding: 3, color: '#fff', lineHeight: 1.2 }}>{e}</button>
        ))}
      </div>
    </div>
  );
}

const btnGrande = (bg) => ({ flex: 1, background: bg, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 0', cursor: 'pointer', fontSize: 12, fontWeight: 700 });

// ─── PLANTILLAS ───────────────────────────────────────────────────────────────
export function PanelPlantillas({ t, theme, onUsar }) {
  const vistas = useMemo(() => PLANTILLAS.map(p => ({ ...p, elements: p.crear(t) })), [t]);
  return (
    <div>
      <div style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.5, marginBottom: 10 }}>
        Diseños listos para editar con los colores del tema <b>{t.label}</b>. Se añaden como diapositiva nueva (o en la actual si está vacía).
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {vistas.map(p => (
          <button key={p.id} onClick={() => onUsar(p.crear(t))}
            style={{ background: 'transparent', border: '1px solid #374151', borderRadius: 10, padding: 0, cursor: 'pointer', overflow: 'hidden', textAlign: 'left' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#6c63ff'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#374151'; }}>
            <SuperficieEstatica slide={{ elements: p.elements, theme }} t={t} ancho={232} />
            <div style={{ padding: '5px 8px', fontSize: 11, fontWeight: 700, color: '#e5e7eb', background: '#111827' }}>{p.nombre}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── CAPAS ────────────────────────────────────────────────────────────────────
const ICONO = { text: 'T', shape: '⬟', image: '🖼', youtube: '▶', webview: '🌐', equation: '∑', music: '♫' };
const nombreCapa = (e) => {
  if (e.type === 'text' || (e.type === 'shape' && e.text)) {
    const s = String(e.text || '').replace(/\s+/g, ' ').trim();
    if (s) return s.length > 24 ? s.slice(0, 24) + '…' : s;
  }
  if (e.type === 'shape') return FORMAS[e.shapeType]?.label || 'Forma';
  return { image: 'Imagen', youtube: 'Vídeo YouTube', webview: 'Página web', equation: 'Ecuación', music: 'Pentagrama' }[e.type] || e.type;
};

export function PanelCapas({ elementos, selIds, onSeleccionar, onCambiarEls }) {
  if (!elementos.length) return <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.6 }}>Esta diapositiva aún no tiene elementos.</div>;
  const mover = (id, d) => onCambiarEls(els => {
    const a = [...els]; const i = a.findIndex(e => e.id === id); const j = i + d;
    if (i < 0 || j < 0 || j >= a.length) return els;
    [a[i], a[j]] = [a[j], a[i]]; return a;
  });
  const alternar = (id, k) => onCambiarEls(els => els.map(e => (e.id === id ? { ...e, [k]: !e[k] } : e)));
  const lista = [...elementos].reverse();
  return (
    <div>
      <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 8 }}>Arriba = delante. Mayús+clic para seleccionar varias.</div>
      {lista.map((e, i) => {
        const activo = selIds.includes(e.id);
        return (
          <div key={e.id} onClick={ev => onSeleccionar(e.id, ev.shiftKey || ev.ctrlKey || ev.metaKey)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 6px', marginBottom: 3, borderRadius: 7, cursor: 'pointer', background: activo ? 'rgba(108,99,255,0.25)' : '#111827', border: `1px solid ${activo ? '#6c63ff' : '#374151'}`, opacity: e.hidden ? 0.5 : 1 }}>
            <span style={{ width: 18, textAlign: 'center', fontSize: 11, color: '#a78bfa', fontWeight: 900 }}>{ICONO[e.type] || '?'}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: '#e5e7eb', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{nombreCapa(e)}</span>
            <button onClick={ev => { ev.stopPropagation(); alternar(e.id, 'hidden'); }} title={e.hidden ? 'Mostrar' : 'Ocultar al presentar'} style={capaBtn}>{e.hidden ? '🚫' : '👁'}</button>
            <button onClick={ev => { ev.stopPropagation(); alternar(e.id, 'locked'); }} title={e.locked ? 'Desbloquear' : 'Bloquear'} style={capaBtn}>{e.locked ? '🔒' : '🔓'}</button>
            <button onClick={ev => { ev.stopPropagation(); mover(e.id, 1); }} disabled={i === 0} title="Subir" style={capaBtn}>↑</button>
            <button onClick={ev => { ev.stopPropagation(); mover(e.id, -1); }} disabled={i === lista.length - 1} title="Bajar" style={capaBtn}>↓</button>
          </div>
        );
      })}
    </div>
  );
}
const capaBtn = { background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 11, padding: '0 2px' };
