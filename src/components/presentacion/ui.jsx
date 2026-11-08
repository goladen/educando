// Controles pequeños de los paneles del editor de presentaciones
import { useState } from 'react';
import { DEGRADADOS } from './plantillas';
import { degradado } from './render';

export const PALETTE = [
  '#ffffff', '#000000', '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b',
  '#1f2937', '#374151', '#6b7280', '#d1d5db',
];

export const ETIQ = { fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: 0.5, textTransform: 'uppercase' };

export function ColorPicker({ value, onChange, label, allowNull, recientes = [] }) {
  const lista = [...new Set([...recientes.filter(Boolean), ...PALETTE])].slice(0, 20);
  return (
    <div style={{ marginBottom: 10 }}>
      {label && <div style={{ ...ETIQ, marginBottom: 5 }}>{label}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
        {allowNull && (
          <div onClick={() => onChange(null)} title="Automático (según el tema)"
            style={{ width: 20, height: 20, borderRadius: 4, cursor: 'pointer', background: 'linear-gradient(135deg,#374151 50%,#9ca3af 50%)', border: value == null ? '2px solid #fff' : '2px solid #374151', boxSizing: 'border-box' }} />
        )}
        {lista.map(c => (
          <div key={c} onClick={() => onChange(c)} title={c} style={{
            width: 20, height: 20, borderRadius: 4, cursor: 'pointer', background: c,
            border: value === c ? '2px solid #fff' : '2px solid transparent',
            boxSizing: 'border-box', boxShadow: c === '#ffffff' ? 'inset 0 0 0 1px #374151' : 'none',
          }} />
        ))}
        <div title="Color personalizado" style={{ width: 20, height: 20, borderRadius: 4, background: 'conic-gradient(red,#ff0,lime,cyan,blue,magenta,red)', position: 'relative', overflow: 'hidden', cursor: 'pointer', border: '2px solid #374151', boxSizing: 'border-box' }}>
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(value || '') ? value : '#6c63ff'} onChange={e => onChange(e.target.value)}
            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
        </div>
      </div>
    </div>
  );
}

export function Seccion({ titulo, children, abierta = true, extra }) {
  const [open, setOpen] = useState(abierta);
  return (
    <div style={{ borderTop: '1px solid #374151', padding: '9px 0 4px' }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: open ? 8 : 4, userSelect: 'none' }}>
        <span style={{ fontSize: 9, color: '#6b7280', width: 8 }}>{open ? '▼' : '▶'}</span>
        <span style={{ ...ETIQ, color: '#d1d5db', flex: 1 }}>{titulo}</span>
        {extra}
      </div>
      {open && children}
    </div>
  );
}

export function Deslizador({ label, value, min, max, step = 1, onChange, unidad = '', formato }) {
  const v = value ?? min;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ fontSize: 10, color: '#9ca3af' }}>{label}</span>
        <span style={{ fontSize: 10, color: '#6b7280' }}>{formato ? formato(v) : `${Math.round(v * 100) / 100}${unidad}`}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={v} onChange={e => onChange(+e.target.value)}
        style={{ width: '100%', accentColor: '#6c63ff' }} />
    </div>
  );
}

// Botones tipo "segmento": opciones [[valor, contenido, title?]]
export function Segmentado({ opciones, valor, onChange, alto = 26 }) {
  return (
    <div style={{ display: 'flex', gap: 3, marginBottom: 8 }}>
      {opciones.map(([v, cont, title]) => (
        <button key={String(v)} title={title} onClick={() => onChange(v)}
          style={{ flex: 1, height: alto, background: valor === v ? '#6c63ff' : '#374151', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 12, padding: 0 }}>
          {cont}
        </button>
      ))}
    </div>
  );
}

export function BotonMini({ children, onClick, activo, title, peligro, ancho, disabled }) {
  return (
    <button onClick={onClick} title={title} disabled={disabled}
      style={{
        flex: ancho ? undefined : 1, width: ancho, background: peligro ? 'rgba(239,68,68,0.2)' : activo ? '#6c63ff' : '#374151',
        color: peligro ? '#f87171' : disabled ? '#6b7280' : '#e5e7eb', border: 'none', borderRadius: 6, padding: '6px 4px',
        cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
      }}>
      {children}
    </button>
  );
}

export function NumInput({ label, value, onChange, step = 1, min, max, sufijo }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#111827', border: '1px solid #374151', borderRadius: 6, padding: '3px 6px', flex: 1, minWidth: 0 }}>
      <span style={{ fontSize: 9, color: '#6b7280', fontWeight: 800 }}>{label}</span>
      <input type="number" value={Number.isFinite(value) ? Math.round(value * 10) / 10 : ''} step={step} min={min} max={max}
        onChange={e => { const n = parseFloat(e.target.value); if (Number.isFinite(n)) onChange(n); }}
        style={{ width: '100%', minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 11 }} />
      {sufijo && <span style={{ fontSize: 9, color: '#6b7280' }}>{sufijo}</span>}
    </label>
  );
}

// Editor de degradado: presets + dos colores + ángulo
export function CampoDegradado({ valor, onChange }) {
  const g = valor || DEGRADADOS[0];
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4, marginBottom: 8 }}>
        {DEGRADADOS.map((d, i) => (
          <div key={i} onClick={() => onChange(d)} title="Degradado"
            style={{ height: 22, borderRadius: 5, cursor: 'pointer', background: degradado(d), border: valor && valor.from === d.from && valor.to === d.to ? '2px solid #fff' : '2px solid transparent', boxSizing: 'border-box' }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
        <input type="color" value={g.from} onChange={e => onChange({ ...g, from: e.target.value })} title="Color inicial"
          style={{ width: 30, height: 24, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }} />
        <div style={{ flex: 1, height: 14, borderRadius: 7, background: degradado({ ...g, angle: 90 }) }} />
        <input type="color" value={g.to} onChange={e => onChange({ ...g, to: e.target.value })} title="Color final"
          style={{ width: 30, height: 24, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }} />
      </div>
      <Deslizador label="Ángulo" value={g.angle ?? 135} min={0} max={360} step={5} unidad="°" onChange={a => onChange({ ...g, angle: a })} />
    </div>
  );
}
