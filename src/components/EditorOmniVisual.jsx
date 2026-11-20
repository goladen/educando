// Editor visual de Omni: cada ejercicio se ve como lo verá el alumno (con las soluciones en verde)
// y se corrige ahí mismo, haciendo clic en lo que se quiera cambiar.
//   Huecos:  «Lucía [has got|'s got] a laptop.»  → la respuesta va entre corchetes; alternativas con |
//   Elegir:  «I {*can/can't} swim.»               → opciones entre llaves; la buena con *
// Lo que no tiene versión visual (matrices, expresiones) usa el editor de formulario de siempre.
import { useState, useRef, useEffect } from 'react';
import MathText from './MathText';
import { normPalabra } from '../utils/puzzlesPalabras';

// ─── notación de texto ↔ ítem ────────────────────────────────────────────────
const altsDe = (a) => (Array.isArray(a) ? a : String(a ?? '').split('|')).map(s => String(s).trim()).filter(Boolean);

export const fillATexto = (it) => (it.parts || ['']).map((p, i) => {
  if (i >= (it.parts || []).length - 1) return p;
  return p + '[' + [(it.ans || [])[i] || '', ...altsDe(it.alts?.[i])].join('|') + ']';
}).join('');

export function textoAFill(t) {
  const trozos = String(t).split(/\[([^\]]*)\]/);
  const parts = [], ans = [], alts = [];
  trozos.forEach((x, i) => {
    if (i % 2 === 0) parts.push(x);
    else { const v = x.split('|').map(s => s.trim()); ans.push(v[0] || ''); alts.push(v.slice(1).filter(Boolean)); }
  });
  if (!ans.length) return { parts: [t, ''], ans: [''], alts: [[]] };
  return { parts, ans, alts };
}

export const choiceATexto = (it) => `${it.parts?.[0] || ''}{${(it.opts || []).map(o => (o === it.ans ? '*' : '') + o).join('/')}}${it.parts?.[1] || ''}`;
export function textoAChoice(t) {
  const m = String(t).match(/^([\s\S]*?)\{([^}]*)\}([\s\S]*)$/);
  if (!m) return { parts: [t, ''], opts: ['', ''], ans: '' };
  const raw = m[2].split('/').map(s => s.trim()).filter(Boolean);
  const opts = raw.map(o => o.replace(/^\*/, ''));
  const marcada = raw.find(o => o.startsWith('*'));
  return { parts: [m[1], m[3]], opts, ans: marcada ? marcada.slice(1) : opts[0] || '' };
}

// ─── piezas ──────────────────────────────────────────────────────────────────
const verde = { background: '#DCFCE7', border: '1px solid #86EFAC', color: '#166534', borderRadius: 7, padding: '1px 8px', fontWeight: 600 };
const gris = { background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#475569', borderRadius: 7, padding: '1px 8px' };
const sinBorde = { border: '1px solid transparent', background: 'transparent', fontFamily: 'inherit', outline: 'none', borderRadius: 6, padding: '3px 6px', width: '100%', boxSizing: 'border-box' };

// Texto editable que parece texto normal (se marca al pasar el ratón)
function TextoEditable({ value, onChange, placeholder, style, multiline, autoFocus }) {
  const [hover, setHover] = useState(false);
  const st = { ...sinBorde, ...(hover ? { border: '1px dashed #CBD5E1', background: '#FAFAFF' } : {}), ...style };
  const props = { value: value || '', placeholder, onChange: e => onChange(e.target.value), onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false), autoFocus };
  if (multiline) return <textarea rows={Math.min(8, Math.max(1, String(value || '').split('\n').length))} {...props} style={{ ...st, resize: 'vertical' }} />;
  return <input {...props} style={st} />;
}

// Línea que se ve «como el alumno» y al hacer clic se edita en notación
function LineaNotacion({ ver, texto, onGuardar, ayuda, color }) {
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState(texto);
  const ref = useRef(null);
  useEffect(() => { if (!editando) setBorrador(texto); }, [texto, editando]);
  useEffect(() => { if (editando) ref.current?.focus(); }, [editando]);
  const guardar = () => { setEditando(false); if (borrador !== texto) onGuardar(borrador); };
  if (editando) return (
    <div style={{ flex: 1 }}>
      <input ref={ref} value={borrador} onChange={e => setBorrador(e.target.value)} onBlur={guardar}
        onKeyDown={e => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') { setBorrador(texto); setEditando(false); } }}
        style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', border: `1.5px solid ${color}`, borderRadius: 8, fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 13 }} />
      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>{ayuda} · Intro para guardar · Esc para cancelar</div>
    </div>
  );
  return (
    <div onClick={() => setEditando(true)} title="Haz clic para editar"
      style={{ flex: 1, cursor: 'text', lineHeight: 2.1, fontSize: 14, padding: '2px 6px', borderRadius: 8, border: '1px dashed transparent' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.background = '#FAFAFF'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; }}>
      {ver}
    </div>
  );
}

const Lbl = ({ value, onChange, color }) => (
  <input value={value || ''} onChange={e => onChange(e.target.value)} placeholder="·" title="Etiqueta (1., a)…)"
    style={{ width: 34, flexShrink: 0, border: 'none', background: 'transparent', color, fontWeight: 700, fontSize: 13, fontFamily: 'inherit', outline: 'none', paddingTop: 6, textAlign: 'right' }} />
);
const Quitar = ({ onClick }) => (
  <button onClick={onClick} title="Quitar este apartado" style={{ border: 'none', background: 'transparent', color: '#CBD5E1', cursor: 'pointer', fontSize: 15, padding: '4px 6px', flexShrink: 0 }}
    onMouseEnter={e => { e.currentTarget.style.color = '#DC2626'; }} onMouseLeave={e => { e.currentTarget.style.color = '#CBD5E1'; }}>✕</button>
);
const Fila = ({ children }) => <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 10 }}>{children}</div>;

// ─── cuerpo de cada tipo ─────────────────────────────────────────────────────
function CuerpoVisual({ ex, color, setItem, quitarItem, ItemEditor }) {
  const items = ex.items || [];
  const fila = (it, i, contenido) => (
    <Fila key={it.id || i}>
      <Lbl value={it.lbl} onChange={v => setItem(i, { lbl: v })} color={color} />
      {contenido}
      <Quitar onClick={() => quitarItem(i)} />
    </Fila>
  );

  switch (ex.tipo) {
    case 'fill':
    case 'wordbank':
      return items.map((it, i) => fila(it, i, (
        <LineaNotacion color={color} texto={fillATexto(it)} ayuda="Pon cada respuesta entre [corchetes]; alternativas con |: [has got|'s got]"
          onGuardar={t => setItem(i, textoAFill(t))}
          ver={<>
            {(it.parts || []).map((p, k) => (
              <span key={k}><MathText text={p} />{k < (it.parts || []).length - 1 && (
                <span style={verde}>{(it.ans || [])[k] || '…'}{altsDe(it.alts?.[k]).length > 0 && <span style={{ fontWeight: 400, opacity: 0.7 }}> / {altsDe(it.alts[k]).join(' / ')}</span>}</span>
              )}</span>
            ))}
            {it.hint && <i style={{ color: '#94A3B8', fontSize: 12, marginLeft: 6 }}>{it.hint}</i>}
          </>} />
      )));

    case 'choice':
      return items.map((it, i) => fila(it, i, (
        <LineaNotacion color={color} texto={choiceATexto(it)} ayuda="Opciones entre {llaves} separadas por /; la correcta con *: {*can/can't}"
          onGuardar={t => setItem(i, textoAChoice(t))}
          ver={<>
            <MathText text={it.parts?.[0] || ''} />
            {(it.opts || []).map((o, k) => <span key={k}>{k > 0 && ' / '}<span style={o === it.ans ? verde : gris}>{o || '…'}</span></span>)}
            <MathText text={it.parts?.[1] || ''} />
          </>} />
      )));

    case 'multichoice':
      return items.map((it, i) => fila(it, i, (
        <div style={{ flex: 1 }}>
          <TextoEditable value={it.question} onChange={v => setItem(i, { question: v })} placeholder="Pregunta" style={{ fontSize: 14, fontWeight: 500 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 6, marginTop: 6 }}>
            {(it.opts || []).map((o, k) => {
              const ok = o && o === it.ans;
              return (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, border: `1.5px solid ${ok ? '#22C55E' : '#E2E8F0'}`, background: ok ? '#F0FDF4' : 'white', borderRadius: 9, padding: '2px 6px' }}>
                  <button onClick={() => setItem(i, { ans: o })} title="Marcar como correcta" style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 15, padding: 0 }}>{ok ? '✅' : '⚪'}</button>
                  <input value={o} placeholder={`Opción ${'ABCD'[k] || k + 1}`} onChange={e => {
                    const opts = [...it.opts]; opts[k] = e.target.value;
                    setItem(i, { opts, ...(ok ? { ans: e.target.value } : {}) });
                  }} style={{ ...sinBorde, padding: '4px 2px', fontSize: 13 }} />
                </div>
              );
            })}
            <button onClick={() => setItem(i, { opts: [...(it.opts || []), ''] })} style={{ border: '1px dashed #CBD5E1', background: 'transparent', borderRadius: 9, color: '#94A3B8', cursor: 'pointer', fontSize: 12 }}>+ opción</button>
          </div>
        </div>
      )));

    case 'truefalse':
      return items.map((it, i) => fila(it, i, (
        <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px' }}><TextoEditable value={it.statement} onChange={v => setItem(i, { statement: v })} placeholder="Afirmación" style={{ fontSize: 14 }} /></div>
          {[['true', 'True'], ['false', 'False']].map(([v, t]) => (
            <button key={v} onClick={() => setItem(i, { ans: v })} style={{ padding: '5px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
              border: `1.5px solid ${it.ans === v ? '#22C55E' : '#E2E8F0'}`, background: it.ans === v ? '#DCFCE7' : 'white', color: it.ans === v ? '#166534' : '#64748B', fontWeight: it.ans === v ? 700 : 400 }}>{t}</button>
          ))}
        </div>
      )));

    case 'match':
      return items.map((it, i) => fila(it, i, (
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 6, alignItems: 'center' }}>
          <TextoEditable value={it.left} onChange={v => setItem(i, { left: v })} placeholder="Izquierda" style={{ ...gris, padding: '6px 10px' }} />
          <span style={{ color: '#94A3B8' }}>↔</span>
          <TextoEditable value={it.right} onChange={v => setItem(i, { right: v })} placeholder="Derecha (su pareja)" style={{ ...verde, fontWeight: 500, padding: '6px 10px' }} />
        </div>
      )));

    case 'order':
      return items.map((it, i) => fila(it, i, (
        <div style={{ flex: 1 }}>
          <TextoEditable value={it.answer} placeholder="Frase en el orden correcto (las fichas se barajan solas)" style={{ ...verde, fontWeight: 500, padding: '6px 10px' }}
            onChange={v => setItem(i, { answer: v, shuffled: v.split(/\s+/).filter(Boolean).sort(() => Math.random() - 0.5) })} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
            {(it.shuffled || []).map((w, k) => <span key={k} style={{ ...gris, fontSize: 12 }}>{w}</span>)}
          </div>
        </div>
      )));

    case 'error':
      return items.map((it, i) => fila(it, i, (
        <div style={{ flex: 1 }}>
          <TextoEditable value={it.sentence} onChange={v => setItem(i, { sentence: v })} placeholder="Frase con un error" style={{ fontSize: 14 }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, margin: '6px 0' }}>
            <span style={{ fontSize: 11, color: '#94A3B8', alignSelf: 'center' }}>Toca la palabra errónea:</span>
            {String(it.sentence || '').split(/\s+/).filter(Boolean).map((w, k) => {
              const limpia = w.replace(/[.,!?;:]+$/, '');
              const sel = limpia === it.errorWord;
              return <button key={k} onClick={() => setItem(i, { errorWord: limpia })} style={{ border: `1px solid ${sel ? '#F87171' : '#E2E8F0'}`, background: sel ? '#FEE2E2' : 'white', color: sel ? '#B91C1C' : '#334155', textDecoration: sel ? 'underline' : 'none', borderRadius: 6, padding: '1px 7px', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>{w}</button>;
            })}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#64748B' }}>Corrección:</span>
            <TextoEditable value={it.correction} onChange={v => setItem(i, { correction: v })} placeholder="palabra correcta" style={{ ...verde, maxWidth: 220 }} />
          </div>
        </div>
      )));

    case 'construct':
    case 'short':
    case 'open': {
      const campoPreg = ex.tipo === 'construct' ? 'prompt' : 'question';
      return items.map((it, i) => fila(it, i, (
        <div style={{ flex: 1 }}>
          <TextoEditable value={it[campoPreg]} onChange={v => setItem(i, { [campoPreg]: v })} multiline={ex.tipo === 'open'}
            placeholder={ex.tipo === 'construct' ? 'Palabras dadas: she / not like / pizza' : 'Pregunta'} style={{ fontSize: 14, fontStyle: ex.tipo === 'construct' ? 'italic' : 'normal' }} />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
            <span style={{ fontSize: 12, color: '#64748B', whiteSpace: 'nowrap' }}>{ex.tipo === 'open' ? 'Modelo:' : 'Respuesta:'}</span>
            <TextoEditable value={it.ans} onChange={v => setItem(i, { ans: v })} placeholder={ex.tipo === 'open' ? 'Respuesta modelo (no puntúa)' : 'Respuesta correcta'} style={{ ...verde, fontWeight: 500 }} />
          </div>
          {ex.tipo !== 'open' && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
              <span style={{ fontSize: 12, color: '#94A3B8', whiteSpace: 'nowrap' }}>También vale:</span>
              <TextoEditable value={altsDe(it.alts).join(' | ')} onChange={v => setItem(i, { alts: v.split('|').map(s => s.trim()).filter(Boolean) })} placeholder="otras respuestas separadas por |" style={{ fontSize: 12, color: '#64748B' }} />
            </div>
          )}
        </div>
      )));
    }

    case 'crossword':
    case 'wordsearch':
      return items.map((it, i) => fila(it, i, (
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'minmax(110px, 180px) 1fr', gap: 6, alignItems: 'center' }}>
          <TextoEditable value={it.ans} onChange={v => setItem(i, { ans: v })} placeholder="PALABRA" style={{ ...verde, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '6px 10px' }} />
          <TextoEditable value={it.clue} onChange={v => setItem(i, { clue: v })} placeholder={ex.tipo === 'crossword' ? 'Pista: 🚿 You wash here.' : 'Pista opcional (emoji…)'} style={{ fontSize: 14 }} />
          {it.ans && normPalabra(it.ans) !== String(it.ans).toUpperCase() && (
            <span style={{ gridColumn: '1/-1', fontSize: 11, color: '#94A3B8' }}>Se escribirá así: {normPalabra(it.ans)}</span>
          )}
        </div>
      )));

    default:
      // Matrices, expresiones… → editor de formulario
      return items.map((it, i) => (
        <div key={it.id || i} style={{ border: '1px solid #F1F5F9', borderRadius: 10, padding: 10, marginBottom: 8, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 4, right: 4 }}><Quitar onClick={() => quitarItem(i)} /></div>
          <ItemEditor tipo={ex.tipo} item={it} onChange={(k, v) => setItem(i, { [k]: v })} onMerge={patch => setItem(i, patch)} />
        </div>
      ));
  }
}

// ─── tarjeta de ejercicio ────────────────────────────────────────────────────
export default function EjercicioVisual({ ex, idx, total, color, onUpdate, onDelete, onMove, TIPOS, TIPO_LABEL, TIPO_COLOR, newItem, ItemEditor, PanelPuzzle }) {
  const tc = TIPO_COLOR[ex.tipo] || color;
  const set = (patch) => onUpdate({ ...ex, ...patch });
  const setItem = (i, patch) => onUpdate({ ...ex, items: ex.items.map((it, j) => j === i ? { ...it, ...patch } : it) });
  const quitarItem = (i) => onUpdate({ ...ex, items: ex.items.filter((_, j) => j !== i) });
  const cambiarTipo = (tipo) => {
    if (ex.items.length > 1 || (ex.items[0] && JSON.stringify(ex.items[0]).length > 60)) {
      if (!window.confirm('Al cambiar el tipo se vacían los apartados de este ejercicio. ¿Seguir?')) return;
    }
    onUpdate({ ...ex, tipo, items: [newItem(tipo)], wordbank: tipo === 'wordbank' ? [] : undefined });
  };
  const puzzle = ex.tipo === 'crossword' || ex.tipo === 'wordsearch';
  const huecos = ex.tipo === 'fill' || ex.tipo === 'wordbank';

  return (
    <div style={{ background: 'white', borderRadius: 18, border: '1px solid #E2E8F0', overflow: 'hidden', marginBottom: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
      {/* cabecera: igual que la del alumno */}
      <div style={{ background: `linear-gradient(135deg,${color}18,${color}08)`, borderBottom: `2px solid ${color}25`, padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 17, flexShrink: 0 }}>{idx + 1}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 220px' }}>
              <TextoEditable value={ex.titulo} onChange={v => set({ titulo: v })} placeholder="Título del ejercicio" style={{ fontWeight: 800, fontSize: 17, color: '#0F172A' }} />
            </div>
            <select value={ex.tipo} onChange={e => cambiarTipo(e.target.value)} title="Tipo de ejercicio"
              style={{ border: 'none', borderRadius: 20, background: `${tc}20`, color: tc, fontSize: 11, fontWeight: 700, padding: '4px 8px', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit' }}>
              {TIPOS.map(t => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
            </select>
          </div>
          <TextoEditable value={ex.enunciado} onChange={v => set({ enunciado: v })} multiline placeholder="Enunciado / instrucciones para el alumno" style={{ fontSize: 14, color: '#475569', marginTop: 2 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {idx > 0 && <button onClick={() => onMove(idx, -1)} title="Subir" style={btnMini}>↑</button>}
          {idx < total - 1 && <button onClick={() => onMove(idx, 1)} title="Bajar" style={btnMini}>↓</button>}
          <button onClick={() => onDelete(idx)} title="Borrar ejercicio" style={btnMini}>🗑</button>
        </div>
      </div>

      <div style={{ padding: '16px 18px 10px' }}>
        {ex.tipo === 'wordbank' && (
          <div style={{ padding: '10px 14px', background: '#FFFBEB', border: '1px dashed #FCD34D', borderRadius: 10, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#92400E', letterSpacing: '0.06em', textTransform: 'uppercase', flex: 1 }}>Word bank (separadas por comas)</span>
              <button onClick={() => set({ wordbank: [...new Set(ex.items.flatMap(it => it.ans || []).filter(Boolean))] })} style={{ ...btnMini, fontSize: 11, width: 'auto', padding: '2px 8px' }}>↻ Rellenar con las respuestas</button>
            </div>
            <TextoEditable value={(ex.wordbank || []).join(', ')} onChange={v => set({ wordbank: v.split(',').map(s => s.trim()).filter(Boolean) })} placeholder="palabra1, palabra2…" style={{ color: '#78350F' }} />
          </div>
        )}
        {puzzle && <PanelPuzzle ex={ex} onUpdate={onUpdate} />}

        <CuerpoVisual ex={ex} color={color} setItem={setItem} quitarItem={quitarItem} ItemEditor={ItemEditor} />

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid #F1F5F9', padding: '10px 0 4px', marginTop: 6 }}>
          <button onClick={() => set({ items: [...ex.items, newItem(ex.tipo)] })} style={{ border: `1px dashed ${color}`, background: 'transparent', color, borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
            + {puzzle ? 'palabra' : 'apartado'}
          </button>
          {huecos && (
            <label style={{ fontSize: 12, color: '#475569', display: 'flex', gap: 5, alignItems: 'center', cursor: 'pointer' }} title="Para listas de palabras sueltas: el alumno puede escribirlas en cualquier orden">
              <input type="checkbox" onChange={e => set({ sinOrden: e.target.checked })}
                checked={ex.sinOrden === true || (ex.sinOrden !== false && ex.items.length > 1 && ex.items.every(it => (it.parts || []).every(p => !String(p).trim())))} />
              Respuestas en cualquier orden
            </label>
          )}
          <label style={{ fontSize: 12, color: '#475569', display: 'flex', gap: 5, alignItems: 'center' }}>
            ⏱ <input type="number" min="0" max="600" value={ex.tiempo || 0} onChange={e => set({ tiempo: Math.max(0, parseInt(e.target.value) || 0) })} style={{ width: 56, border: '1px solid #E2E8F0', borderRadius: 6, padding: '2px 4px' }} /> s
          </label>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94A3B8' }}>{ex.items.length} {puzzle ? 'palabras' : 'apartados'}</span>
        </div>
      </div>
    </div>
  );
}

const btnMini = { width: 28, height: 26, border: '1px solid #E2E8F0', background: 'white', borderRadius: 7, cursor: 'pointer', fontSize: 12, color: '#64748B' };
