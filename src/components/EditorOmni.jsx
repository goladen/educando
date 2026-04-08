// EditorOmni.jsx — Editor completo de recursos Omninteractive
// Uso: <EditorOmni recursoInicial={null} usuario={...} onBack={...} />
// Si recursoInicial viene de FotoARecurso, lo carga directamente para editar antes de guardar.

import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { Save, ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp, Image as ImgIcon } from 'lucide-react';

// ─── helpers ─────────────────────────────────────────────────────────────────
const uid = () => 'ex_' + Math.random().toString(36).slice(2, 8);
const itemUid = () => Math.random().toString(36).slice(2, 8);

const TIPOS = ['fill', 'choice', 'wordbank', 'construct', 'match', 'order', 'truefalse', 'multichoice', 'error'];
const TIPO_LABEL = {
  fill: 'Fill in the blank', choice: 'Choose the correct', wordbank: 'Word bank',
  construct: 'Write a sentence', match: 'Match', order: 'Order words',
  truefalse: 'True / False', multichoice: 'Multiple choice', error: 'Find the error',
};
const TIPO_COLOR = {
  fill: '#6D28D9', choice: '#1D4ED8', wordbank: '#B45309', construct: '#047857',
  match: '#0F766E', order: '#C2410C', truefalse: '#0369A1', multichoice: '#7E22CE', error: '#B91C1C',
};
const NIVELES = ['1 ESO', '2 ESO', '3 ESO', '4 ESO', '1 Bach', '2 Bach', 'Primaria', 'FP', 'Otros'];
const COLORES = ['#6D28D9', '#1D4ED8', '#047857', '#0F766E', '#C2410C', '#B45309', '#0369A1', '#7E22CE', '#B91C1C', '#0369A1'];

function newItem(tipo) {
  const id = itemUid();
  switch (tipo) {
    case 'fill':        return { id, lbl: '', parts: ['', ''], hint: '', ans: [''], alts: [[]] };
    case 'choice':      return { id, lbl: '', parts: ['', ''], opts: ['', ''], ans: '' };
    case 'wordbank':    return { id, lbl: '', parts: ['', ''], ans: [''], alts: [[]] };
    case 'construct':   return { id, lbl: '', prompt: '', ans: '', alts: [] };
    case 'match':       return { id, lbl: '', left: '', right: '' };
    case 'order':       return { id, lbl: '', shuffled: [''], answer: '' };
    case 'truefalse':   return { id, lbl: '', statement: '', ans: 'true' };
    case 'multichoice': return { id, lbl: '', question: '', opts: ['', '', '', ''], ans: '' };
    case 'error':       return { id, lbl: '', sentence: '', errorWord: '', correction: '' };
    default:            return { id, lbl: '' };
  }
}

function newExercise() {
  return { id: uid(), tipo: 'fill', titulo: '', enunciado: '', imagen: null, items: [newItem('fill')] };
}

const RECURSO_BASE = {
  titulo: '', nivel: '3 ESO', asignatura: 'English', tema: 'Grammar',
  color: '#6D28D9', descripcion: '', tags: [],
  pais: '', region: '', poblacion: '', ciclo: 'Secundaria',
  ejercicios: [newExercise()],
};

function generarCodigo() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ─── sub-editors por tipo ─────────────────────────────────────────────────────

function ItemEditorFill({ item, onChange }) {
  const nb = item.parts.length - 1;
  return (
    <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={lbl}>Etiqueta</label>
      <input style={inp} value={item.lbl} onChange={e => onChange('lbl', e.target.value)} placeholder="1." />
      <label style={lbl}>Pista (ej: "(use)")</label>
      <input style={inp} value={item.hint} onChange={e => onChange('hint', e.target.value)} placeholder="(verb)" />
      <label style={lbl}>Partes de la frase (el hueco va entre partes)</label>
      {item.parts.map((p, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#94A3B8', minWidth: 50 }}>{i === 0 ? 'Inicio' : i < item.parts.length - 1 ? `Parte ${i}` : 'Final'}</span>
          <input style={{ ...inp, flex: 1 }} value={p} onChange={e => {
            const np = [...item.parts]; np[i] = e.target.value; onChange('parts', np);
          }} placeholder={`Parte ${i + 1}`} />
          {item.parts.length > 2 && i > 0 && i < item.parts.length - 1 && (
            <button style={btnSm} onClick={() => {
              const np = item.parts.filter((_, j) => j !== i);
              const na = item.ans.filter((_, j) => j !== i - 1);
              const nl = item.alts.filter((_, j) => j !== i - 1);
              onChange('parts', np); onChange('ans', na); onChange('alts', nl);
            }}>✕</button>
          )}
        </div>
      ))}
      <button style={btnAdd} onClick={() => {
        onChange('parts', [...item.parts.slice(0, -1), '', item.parts[item.parts.length - 1]]);
        onChange('ans', [...item.ans, '']);
        onChange('alts', [...item.alts, []]);
      }}>+ añadir hueco</button>
      {item.ans.map((a, i) => (
        <div key={i}>
          <label style={lbl}>Respuesta correcta {nb > 1 ? `(hueco ${i + 1})` : ''}</label>
          <input style={inp} value={a} onChange={e => { const n = [...item.ans]; n[i] = e.target.value; onChange('ans', n); }} placeholder="respuesta" />
          <label style={{ ...lbl, marginTop: 4 }}>Alternativas válidas (separadas por |)</label>
          <input style={inp} value={(item.alts?.[i] || []).join('|')} onChange={e => {
            const n = [...(item.alts || [])];
            n[i] = e.target.value.split('|').map(s => s.trim()).filter(Boolean);
            onChange('alts', n);
          }} placeholder="wasn't | was not" />
        </div>
      ))}
    </div>
  );
}

function ItemEditorChoice({ item, onChange }) {
  return (
    <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={lbl}>Etiqueta</label>
      <input style={inp} value={item.lbl} onChange={e => onChange('lbl', e.target.value)} placeholder="1." />
      <label style={lbl}>Parte antes del hueco</label>
      <input style={inp} value={item.parts[0]} onChange={e => { const n = [...item.parts]; n[0] = e.target.value; onChange('parts', n); }} />
      <label style={lbl}>Parte después del hueco</label>
      <input style={inp} value={item.parts[1]} onChange={e => { const n = [...item.parts]; n[1] = e.target.value; onChange('parts', n); }} />
      {item.opts.map((o, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <label style={{ ...lbl, minWidth: 70 }}>Opción {i + 1}</label>
          <input style={{ ...inp, flex: 1 }} value={o} onChange={e => { const n = [...item.opts]; n[i] = e.target.value; onChange('opts', n); }} />
          {item.opts.length > 2 && <button style={btnSm} onClick={() => onChange('opts', item.opts.filter((_, j) => j !== i))}>✕</button>}
        </div>
      ))}
      <button style={btnAdd} onClick={() => onChange('opts', [...item.opts, ''])}>+ opción</button>
      <label style={lbl}>Opción correcta</label>
      <select style={inp} value={item.ans} onChange={e => onChange('ans', e.target.value)}>
        <option value="">— elige —</option>
        {item.opts.map((o, i) => <option key={i} value={o}>{o || `Opción ${i + 1}`}</option>)}
      </select>
    </div>
  );
}

function ItemEditorConstruct({ item, onChange }) {
  return (
    <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={lbl}>Etiqueta</label>
      <input style={inp} value={item.lbl} onChange={e => onChange('lbl', e.target.value)} placeholder="1." />
      <label style={lbl}>Prompt (palabras separadas por " / ")</label>
      <input style={inp} value={item.prompt} onChange={e => onChange('prompt', e.target.value)} placeholder="these socks / not buy / by my mum /." />
      <label style={lbl}>Respuesta correcta</label>
      <input style={inp} value={item.ans} onChange={e => onChange('ans', e.target.value)} />
      <label style={lbl}>Alternativas válidas (una por línea)</label>
      <textarea style={{ ...inp, height: 60 }} value={(item.alts || []).join('\n')} onChange={e => onChange('alts', e.target.value.split('\n').filter(Boolean))} />
    </div>
  );
}

function ItemEditorMatch({ item, onChange }) {
  return (
    <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={lbl}>Etiqueta</label>
      <input style={inp} value={item.lbl} onChange={e => onChange('lbl', e.target.value)} placeholder="1." />
      <label style={lbl}>Columna izquierda</label>
      <input style={inp} value={item.left} onChange={e => onChange('left', e.target.value)} />
      <label style={lbl}>Columna derecha (definición)</label>
      <input style={inp} value={item.right} onChange={e => onChange('right', e.target.value)} />
    </div>
  );
}

function ItemEditorOrder({ item, onChange }) {
  return (
    <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={lbl}>Etiqueta</label>
      <input style={inp} value={item.lbl} onChange={e => onChange('lbl', e.target.value)} placeholder="1." />
      <label style={lbl}>Palabras desordenadas (separadas por espacio)</label>
      <input style={inp} value={(item.shuffled || []).join(' ')} onChange={e => onChange('shuffled', e.target.value.split(' ').filter(Boolean))} placeholder="than is bigger Madrid London" />
      <label style={lbl}>Frase correcta</label>
      <input style={inp} value={item.answer} onChange={e => onChange('answer', e.target.value)} placeholder="London is bigger than Madrid." />
    </div>
  );
}

function ItemEditorTrueFalse({ item, onChange }) {
  return (
    <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={lbl}>Etiqueta</label>
      <input style={inp} value={item.lbl} onChange={e => onChange('lbl', e.target.value)} placeholder="1." />
      <label style={lbl}>Afirmación</label>
      <input style={inp} value={item.statement} onChange={e => onChange('statement', e.target.value)} />
      <label style={lbl}>Respuesta</label>
      <select style={inp} value={item.ans} onChange={e => onChange('ans', e.target.value)}>
        <option value="true">True</option>
        <option value="false">False</option>
      </select>
    </div>
  );
}

function ItemEditorMultiChoice({ item, onChange }) {
  return (
    <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={lbl}>Etiqueta</label>
      <input style={inp} value={item.lbl} onChange={e => onChange('lbl', e.target.value)} placeholder="1." />
      <label style={lbl}>Pregunta</label>
      <input style={inp} value={item.question} onChange={e => onChange('question', e.target.value)} />
      {['A', 'B', 'C', 'D'].map((letter, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B', minWidth: 18 }}>{letter}</span>
          <input style={{ ...inp, flex: 1 }} value={item.opts[i] || ''} onChange={e => { const n = [...item.opts]; n[i] = e.target.value; onChange('opts', n); }} />
        </div>
      ))}
      <label style={lbl}>Opción correcta</label>
      <select style={inp} value={item.ans} onChange={e => onChange('ans', e.target.value)}>
        <option value="">— elige —</option>
        {item.opts.map((o, i) => <option key={i} value={o}>{['A', 'B', 'C', 'D'][i]}: {o}</option>)}
      </select>
    </div>
  );
}

function ItemEditorError({ item, onChange }) {
  return (
    <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={lbl}>Etiqueta</label>
      <input style={inp} value={item.lbl} onChange={e => onChange('lbl', e.target.value)} placeholder="1." />
      <label style={lbl}>Frase con error</label>
      <input style={inp} value={item.sentence} onChange={e => onChange('sentence', e.target.value)} placeholder="She have worked here for ten years." />
      <label style={lbl}>Palabra errónea (tal cual aparece en la frase)</label>
      <input style={inp} value={item.errorWord} onChange={e => onChange('errorWord', e.target.value)} placeholder="have" />
      <label style={lbl}>Corrección</label>
      <input style={inp} value={item.correction} onChange={e => onChange('correction', e.target.value)} placeholder="has" />
    </div>
  );
}

function ItemEditor({ tipo, item, onChange }) {
  switch (tipo) {
    case 'fill':        return <ItemEditorFill item={item} onChange={onChange} />;
    case 'choice':      return <ItemEditorChoice item={item} onChange={onChange} />;
    case 'wordbank':    return <ItemEditorFill item={item} onChange={onChange} />;
    case 'construct':   return <ItemEditorConstruct item={item} onChange={onChange} />;
    case 'match':       return <ItemEditorMatch item={item} onChange={onChange} />;
    case 'order':       return <ItemEditorOrder item={item} onChange={onChange} />;
    case 'truefalse':   return <ItemEditorTrueFalse item={item} onChange={onChange} />;
    case 'multichoice': return <ItemEditorMultiChoice item={item} onChange={onChange} />;
    case 'error':       return <ItemEditorError item={item} onChange={onChange} />;
    default: return null;
  }
}

// ─── styles ───────────────────────────────────────────────────────────────────
const inp = {
  width: '100%', padding: '7px 10px', border: '1px solid #E2E8F0', borderRadius: 8,
  fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
};
const lbl = { fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 };
const btnSm = { border: '1px solid #FCA5A5', background: '#FEE2E2', color: '#B91C1C', borderRadius: 6, cursor: 'pointer', padding: '3px 8px', fontSize: 12 };
const btnAdd = { border: '1px dashed #CBD5E1', background: '#F8FAFC', color: '#64748B', borderRadius: 8, cursor: 'pointer', padding: '6px 12px', fontSize: 12, marginTop: 4 };

// ─── ExercisePanel ────────────────────────────────────────────────────────────
function ExercisePanel({ ex, idx, total, onUpdate, onDelete, onMove, color }) {
  const [open, setOpen] = useState(true);
  const [openItems, setOpenItems] = useState({});

  const updateField = (k, v) => onUpdate({ ...ex, [k]: v });
  const updateItem = (i, field, val) => {
    const items = ex.items.map((it, j) => j === i ? { ...it, [field]: val } : it);
    onUpdate({ ...ex, items });
  };
  const addItem = () => onUpdate({ ...ex, items: [...ex.items, newItem(ex.tipo)] });
  const deleteItem = (i) => onUpdate({ ...ex, items: ex.items.filter((_, j) => j !== i) });
  const changeType = (tipo) => onUpdate({ ...ex, tipo, items: [newItem(tipo)], wordbank: tipo === 'wordbank' ? [''] : undefined });

  const tc = TIPO_COLOR[ex.tipo] || color;

  return (
    <div style={{ border: `1px solid #E2E8F0`, borderRadius: 14, overflow: 'hidden', marginBottom: 12, borderLeft: `4px solid ${tc}` }}>
      {/* exercise header */}
      <div style={{ background: '#F8FAFC', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: tc, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{idx + 1}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ex.titulo || '(sin título)'}</div>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: `${tc}18`, color: tc }}>{TIPO_LABEL[ex.tipo] || ex.tipo}</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {idx > 0 && <button style={btnSm} onClick={() => onMove(idx, -1)}>↑</button>}
          {idx < total - 1 && <button style={btnSm} onClick={() => onMove(idx, 1)}>↓</button>}
          <button style={btnSm} onClick={() => onDelete(idx)}>🗑</button>
          <button onClick={() => setOpen(o => !o)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94A3B8', padding: '2px 4px' }}>
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {open && (
        <div style={{ padding: '16px' }}>
          {/* exercise metadata */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={lbl}>Tipo de ejercicio</label>
              <select style={inp} value={ex.tipo} onChange={e => changeType(e.target.value)}>
                {TIPOS.map(t => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Título del ejercicio</label>
              <input style={inp} value={ex.titulo} onChange={e => updateField('titulo', e.target.value)} placeholder="Complete the sentences…" />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Enunciado / instrucciones</label>
            <textarea style={{ ...inp, height: 56, resize: 'vertical' }} value={ex.enunciado} onChange={e => updateField('enunciado', e.target.value)} placeholder="Complete the answers with the verbs in brackets." />
          </div>
          <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
            <ImgIcon size={14} color="#94A3B8" />
            <input style={{ ...inp, flex: 1 }} value={ex.imagen || ''} onChange={e => updateField('imagen', e.target.value || null)} placeholder="URL de imagen (opcional)" />
          </div>

          {/* wordbank */}
          {ex.tipo === 'wordbank' && (
            <div style={{ marginBottom: 14, padding: '10px 14px', background: '#FFFBEB', border: '1px dashed #FCD34D', borderRadius: 10 }}>
              <label style={lbl}>Palabras del banco (separadas por ",")</label>
              <input style={inp} value={(ex.wordbank || []).join(', ')} onChange={e => updateField('wordbank', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} placeholder="not build, take, write, not invite, tell" />
            </div>
          )}

          {/* items */}
          <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 8 }}>Preguntas / ítems ({ex.items.length})</div>
            {ex.items.map((item, i) => (
              <div key={item.id || i} style={{ border: '1px solid #F1F5F9', borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
                <div style={{ background: '#F8FAFC', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                  onClick={() => setOpenItems(o => ({ ...o, [i]: !o[i] }))}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B', flex: 1 }}>
                    Ítem {i + 1}{item.lbl ? ` — ${item.lbl}` : ''}
                  </span>
                  <button style={btnSm} onClick={e => { e.stopPropagation(); deleteItem(i); }}>✕</button>
                  {openItems[i] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
                {openItems[i] && (
                  <div style={{ padding: '10px 12px' }}>
                    <ItemEditor tipo={ex.tipo} item={item} onChange={(field, val) => updateItem(i, field, val)} />
                  </div>
                )}
              </div>
            ))}
            <button style={btnAdd} onClick={addItem}>+ añadir ítem</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function EditorOmni({ recursoInicial = null, usuario, onBack }) {
  const [recurso, setRecurso] = useState(() => {
    if (recursoInicial) return { ...RECURSO_BASE, ...recursoInicial };
    return { ...RECURSO_BASE };
  });
  const [saving, setSaving] = useState(false);
  const [showConfig, setShowConfig] = useState(!recursoInicial);

  useEffect(() => {
    if (!recurso.pais && usuario?.pais) setRecurso(r => ({ ...r, pais: usuario.pais, region: usuario.region || '', poblacion: usuario.poblacion || '' }));
  }, []);

  const setField = (k, v) => setRecurso(r => ({ ...r, [k]: v }));

  const addExercise = () => setRecurso(r => ({ ...r, ejercicios: [...r.ejercicios, newExercise()] }));
  const updateExercise = (i, ex) => setRecurso(r => ({ ...r, ejercicios: r.ejercicios.map((e, j) => j === i ? ex : e) }));
  const deleteExercise = (i) => setRecurso(r => ({ ...r, ejercicios: r.ejercicios.filter((_, j) => j !== i) }));
  const moveExercise = (i, dir) => {
    const exs = [...recurso.ejercicios];
    const j = i + dir;
    [exs[i], exs[j]] = [exs[j], exs[i]];
    setRecurso(r => ({ ...r, ejercicios: exs }));
  };

  // Firestore no admite arrays anidados: convierte alts [[a,b],[c]] → ["a|b","c"]
  const sanitizeEjercicios = (ejercicios) => ejercicios.map(ex => ({
    ...ex,
    items: (ex.items || []).map(item => {
      const clean = { ...item };
      if (Array.isArray(item.alts)) {
        clean.alts = item.alts.map(a => Array.isArray(a) ? a.join('|') : (a || ''));
      }
      return clean;
    }),
  }));

  const save = async () => {
    if (!recurso.titulo.trim()) return alert('Añade un título al recurso.');
    if (!recurso.ejercicios.length) return alert('El recurso necesita al menos un ejercicio.');
    setSaving(true);
    try {
      const data = {
        ...recurso,
        ejercicios: sanitizeEjercicios(recurso.ejercicios),
        tipoJuego: 'OMNINTERACTIVE',
        tipo: 'OMNI',
        isFinished: true,
        profesorUid: usuario?.uid || 'anon',
        profesorNombre: usuario?.displayName || 'Anon',
        pais: recurso.pais || usuario?.pais || '',
        region: recurso.region || usuario?.region || '',
        poblacion: recurso.poblacion || usuario?.poblacion || '',
        ciclo: recurso.ciclo || 'Secundaria',
        temas: recurso.tema || '',
        playCount: 0,
        fechaCreacion: new Date(),
        accessCode: generarCodigo(),
        origen: 'editor_omni',
      };
      delete data.id;
      if (recurso.id && !recurso.id.startsWith('auto_')) {
        await updateDoc(doc(db, 'resources', recurso.id), data);
        alert('Recurso actualizado.');
      } else {
        await addDoc(collection(db, 'resources'), data);
        alert('Recurso guardado correctamente.');
      }
      onBack?.();
    } catch (e) {
      alert('Error al guardar: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4FF', fontFamily: 'inherit' }}>
      {/* top bar */}
      <div style={{ background: 'white', borderBottom: '1px solid #E2E8F0', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 100 }}>
        <button onClick={onBack} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748B', display: 'flex', alignItems: 'center', gap: 4, fontSize: 14 }}>
          <ArrowLeft size={18} /> Volver
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#0F172A' }}>Editor Omni</div>
          <div style={{ fontSize: 12, color: '#94A3B8' }}>{recurso.titulo || 'Nuevo recurso'}</div>
        </div>
        <button onClick={() => setShowConfig(c => !c)} style={{ border: '1px solid #E2E8F0', background: showConfig ? '#EEF2FF' : 'white', color: showConfig ? '#4338CA' : '#64748B', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          ⚙ Configuración
        </button>
        <button onClick={save} disabled={saving} style={{ border: 'none', background: recurso.color || '#6D28D9', color: 'white', borderRadius: 9, padding: '9px 20px', cursor: 'pointer', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 7, opacity: saving ? 0.7 : 1 }}>
          <Save size={16} /> {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      <div style={{ maxWidth: 860, margin: '24px auto', padding: '0 16px 60px' }}>
        {/* config panel */}
        {showConfig && (
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid #E2E8F0', padding: '24px', marginBottom: 20, boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#0F172A', marginBottom: 18 }}>Configuración del recurso</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>Título *</label>
                <input style={inp} value={recurso.titulo} onChange={e => setField('titulo', e.target.value)} placeholder="Passive Voice – Shopping" />
              </div>
              <div>
                <label style={lbl}>Nivel</label>
                <select style={inp} value={recurso.nivel} onChange={e => setField('nivel', e.target.value)}>
                  {NIVELES.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Ciclo</label>
                <select style={inp} value={recurso.ciclo} onChange={e => setField('ciclo', e.target.value)}>
                  {['Infantil', 'Primaria', 'Secundaria', 'Bachillerato', 'FP', 'Otros'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Asignatura</label>
                <input style={inp} value={recurso.asignatura} onChange={e => setField('asignatura', e.target.value)} placeholder="English" />
              </div>
              <div>
                <label style={lbl}>Tema</label>
                <input style={inp} value={recurso.tema} onChange={e => setField('tema', e.target.value)} placeholder="Grammar" />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>Descripción</label>
                <textarea style={{ ...inp, height: 56, resize: 'vertical' }} value={recurso.descripcion} onChange={e => setField('descripcion', e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Tags (separados por coma)</label>
                <input style={inp} value={(recurso.tags || []).join(', ')} onChange={e => setField('tags', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} placeholder="passive, grammar, shopping" />
              </div>
              <div>
                <label style={lbl}>Color del recurso</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  {COLORES.map(c => (
                    <div key={c} onClick={() => setField('color', c)} style={{ width: 26, height: 26, borderRadius: '50%', background: c, cursor: 'pointer', border: recurso.color === c ? '3px solid #0F172A' : '2px solid transparent' }} />
                  ))}
                </div>
              </div>
              <div>
                <label style={lbl}>País</label>
                <input style={inp} value={recurso.pais} onChange={e => setField('pais', e.target.value)} placeholder="España" />
              </div>
              <div>
                <label style={lbl}>Región / Provincia</label>
                <input style={inp} value={recurso.region} onChange={e => setField('region', e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Localidad</label>
                <input style={inp} value={recurso.poblacion} onChange={e => setField('poblacion', e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {/* exercises */}
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #E2E8F0', padding: '20px 20px 8px', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#0F172A' }}>Ejercicios ({recurso.ejercicios.length})</div>
            <button onClick={addExercise} style={{ border: 'none', background: recurso.color || '#6D28D9', color: 'white', borderRadius: 9, padding: '8px 16px', cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={15} /> Añadir ejercicio
            </button>
          </div>
          {recurso.ejercicios.map((ex, i) => (
            <ExercisePanel
              key={ex.id || i}
              ex={ex} idx={i} total={recurso.ejercicios.length}
              color={recurso.color || '#6D28D9'}
              onUpdate={ex => updateExercise(i, ex)}
              onDelete={deleteExercise}
              onMove={moveExercise}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
