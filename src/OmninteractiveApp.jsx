// OmninteractiveApp.jsx
// Integrar en LandingGames3: import OmninteractiveApp from './OmninteractiveApp';
// Añadir case 'OMNINTERACTIVE': return <OmninteractiveApp onBack={handleBack} />;
// El componente acepta prop: onBack (función para volver al menú principal)
import FotoARecurso from './FotoARecurso';

import { useState, useMemo } from 'react';
import { BIBLIOTECA } from './BibliotecaOmni';

// ─── helpers ────────────────────────────────────────────────────────────────
const nm = (s = '') =>
  (s || '').toLowerCase().trim().replace(/\s+/g, ' ').replace(/['']/g, "'")
    .replace(/wasn't|was not/g, 'wasnot').replace(/weren't|were not/g, 'werenot')
    .replace(/isn't|is not/g, 'isnot').replace(/aren't|are not/g, 'arenot')
    .replace(/don't|do not/g, 'donot').replace(/doesn't|does not/g, 'doesnot')
    .replace(/can't|cannot/g, 'cannot').replace(/couldn't|could not/g, 'couldnot')
    .replace(/haven't|have not/g, 'havenot').replace(/hasn't|has not/g, 'hasnot')
    .replace(/hadn't|had not/g, 'hadnot').replace(/wouldn't|would not/g, 'wouldnot')
    .replace(/mustn't|must not/g, 'mustnot').replace(/shouldn't|should not/g, 'shouldnot');

// normaliza alts: admite array de strings, array de arrays, o string con "|"
const parseAlts = (alts) => {
  if (!alts) return [];
  return alts.flatMap(a =>
    Array.isArray(a) ? a : typeof a === 'string' ? a.split('|').map(s => s.trim()).filter(Boolean) : [a]
  );
};

const okAns = (user, correct, alts = []) =>
  !!(user?.trim()) && [correct, ...parseAlts(alts)].some(a => nm(String(a)) === nm(user));

function calcScore(ex, ans) {
  let c = 0, t = 0;
  ex.items.forEach(item => {
    if (ex.tipo === 'choice') {
      t++; if ((ans[String(item.id)] || '') === item.ans) c++;
    } else if (ex.tipo === 'fill' || ex.tipo === 'wordbank') {
      const nb = item.parts.length - 1;
      for (let i = 0; i < nb; i++) {
        t++;
        if (okAns(ans[`${item.id}-${i}`] || '', item.ans[i], item.alts?.[i] || [])) c++;
      }
    } else if (ex.tipo === 'construct') {
      t++; if (okAns(ans[String(item.id)] || '', item.ans, item.alts || [])) c++;
    } else if (ex.tipo === 'match') {
      t++; if ((ans[`m_${item.id}`] || '') === item.right) c++;
    } else if (ex.tipo === 'order') {
      t++;
      const placed = ans[`ord_${item.id}`] || [];
      const built = placed.map(i => item.shuffled[i]).join(' ');
      if (nm(built) === nm(item.answer)) c++;
    } else if (ex.tipo === 'truefalse') {
      t++; if ((ans[`tf_${item.id}`] || '') === item.ans) c++;
    } else if (ex.tipo === 'multichoice') {
      t++; if ((ans[`mc_${item.id}`] || '') === item.ans) c++;
    } else if (ex.tipo === 'error') {
      t++; if (nm(ans[`err_${item.id}`] || '') === nm(item.correction)) c++;
    }
  });
  return { c, t };
}

// ─── type meta ───────────────────────────────────────────────────────────────
const TIPO_INFO = {
  fill:        { label: 'Fill in',        color: '#6D28D9' },
  choice:      { label: 'Choose',         color: '#1D4ED8' },
  wordbank:    { label: 'Word bank',      color: '#B45309' },
  construct:   { label: 'Write',          color: '#047857' },
  match:       { label: 'Match',          color: '#0F766E' },
  order:       { label: 'Order',          color: '#C2410C' },
  truefalse:   { label: 'True / False',   color: '#0369A1' },
  multichoice: { label: 'Multiple choice',color: '#7E22CE' },
  error:       { label: 'Find the error', color: '#B91C1C' },
};

// ─── shared sub-components ───────────────────────────────────────────────────
function ItemLabel({ lbl, color }) {
  return <span style={{ fontWeight: 500, fontSize: 13, color, minWidth: 24, paddingTop: 6, flexShrink: 0 }}>{lbl}</span>;
}

function StatusIcon({ ok }) {
  return <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{ok ? '✓' : '✗'}</span>;
}

function CorrectAnswer({ text }) {
  return <span style={{ fontSize: 12, color: '#059669', fontWeight: 500, marginLeft: 6, whiteSpace: 'nowrap' }}>→ {text}</span>;
}

// ─── FILL ────────────────────────────────────────────────────────────────────
function FillEx({ ex, ans, setAns, checked }) {
  return (
    <div>
      {ex.items.map(item => {
        const nb = item.parts.length - 1;
        const nodes = [];
        item.parts.forEach((part, i) => {
          nodes.push(<span key={`p${i}`}>{part}</span>);
          if (i < nb) {
            const val = ans[`${item.id}-${i}`] || '';
            const correct = item.ans[i];
            const alts = item.alts?.[i] || [];
            const st = checked ? (okAns(val, correct, alts) ? 'ok' : 'err') : '';
            nodes.push(
              <span key={`b${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, verticalAlign: 'middle' }}>
                <input
                  value={val}
                  onChange={e => setAns(`${item.id}-${i}`, e.target.value)}
                  readOnly={checked}
                  placeholder="···"
                  style={{
                    width: 120, height: 27, padding: '0 8px',
                    border: `1.5px solid ${st === 'ok' ? '#059669' : st === 'err' ? '#DC2626' : '#CBD5E1'}`,
                    borderRadius: 7,
                    background: st === 'ok' ? '#DCFCE7' : st === 'err' ? '#FEE2E2' : 'white',
                    fontFamily: 'inherit', fontSize: 13, outline: 'none', verticalAlign: 'middle',
                  }}
                />
                {item.hint && nb === 1 && <span style={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic' }}>{item.hint}</span>}
                {checked && st === 'err' && <CorrectAnswer text={correct} />}
              </span>
            );
          }
        });
        return (
          <div key={item.id} style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'flex-start' }}>
            <ItemLabel lbl={item.lbl} color={ex.color} />
            <span style={{ lineHeight: 2.5, fontSize: 14 }}>{nodes}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── CHOICE ──────────────────────────────────────────────────────────────────
function ChoiceEx({ ex, ans, setAns, checked }) {
  return (
    <div>
      {ex.items.map(item => {
        const sel = ans[String(item.id)] || '';
        return (
          <div key={item.id} style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-start' }}>
            <ItemLabel lbl={item.lbl} color={ex.color} />
            <span style={{ lineHeight: 2.5, fontSize: 14 }}>
              <span>{item.parts[0]}</span>
              {item.opts.map(opt => {
                let bg = 'transparent', border = '#D1D5DB', color = '#6B7280', fw = 400;
                if (!checked && opt === sel) { bg = '#EFF6FF'; border = '#3B82F6'; color = '#1D4ED8'; fw = 500; }
                if (checked) {
                  if (opt === item.ans) { bg = '#DCFCE7'; border = '#059669'; color = '#047857'; fw = 500; }
                  else if (opt === sel) { bg = '#FEE2E2'; border = '#DC2626'; color = '#B91C1C'; fw = 500; }
                }
                return (
                  <button key={opt} onClick={() => !checked && setAns(String(item.id), opt)} style={{
                    margin: '0 4px', padding: '2px 11px', borderRadius: 20,
                    border: `1.5px solid ${border}`, background: bg, color, fontWeight: fw,
                    cursor: checked ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 13,
                    transition: 'all 0.15s', verticalAlign: 'middle',
                  }}>{opt}</button>
                );
              })}
              <span>{item.parts[1]}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── WORDBANK ─────────────────────────────────────────────────────────────────
function WordbankEx({ ex, ans, setAns, checked }) {
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '10px 14px', background: '#FFFBEB', border: '1px dashed #FCD34D', borderRadius: 10, marginBottom: 20 }}>
        <div style={{ width: '100%', fontSize: 10, fontWeight: 600, color: '#92400E', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>Word bank</div>
        {ex.wordbank.map(w => (
          <span key={w} style={{ padding: '3px 12px', background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 20, fontSize: 13, color: '#78350F' }}>{w}</span>
        ))}
      </div>
      <FillEx ex={ex} ans={ans} setAns={setAns} checked={checked} />
    </div>
  );
}

// ─── CONSTRUCT ────────────────────────────────────────────────────────────────
function ConstructEx({ ex, ans, setAns, checked }) {
  return (
    <div>
      {ex.items.map(item => {
        const val = ans[String(item.id)] || '';
        const isOk = checked && okAns(val, item.ans, item.alts || []);
        const isWr = checked && !isOk;
        const st = checked ? (isOk ? '#059669' : '#DC2626') : '#CBD5E1';
        const bg = checked ? (isOk ? '#DCFCE7' : '#FEE2E2') : 'white';
        return (
          <div key={item.id} style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 7, alignItems: 'center' }}>
              <ItemLabel lbl={item.lbl} color={ex.color} />
              {item.prompt.split(' / ').map((chip, i) => (
                <span key={i} style={{ padding: '3px 9px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 7, fontSize: 12, color: '#64748B' }}>{chip}</span>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                value={val}
                onChange={e => setAns(String(item.id), e.target.value)}
                readOnly={checked}
                placeholder="Write your sentence here…"
                style={{
                  flex: 1, height: 34, padding: '0 12px',
                  border: `1.5px solid ${st}`, borderRadius: 8,
                  background: bg, color: isOk ? '#047857' : isWr ? '#B91C1C' : '#0F172A',
                  fontFamily: 'inherit', fontSize: 13, outline: 'none',
                }}
              />
              {checked && <StatusIcon ok={isOk} />}
            </div>
            {isWr && <div style={{ marginTop: 5, fontSize: 12, color: '#059669', fontWeight: 500, paddingLeft: 2 }}>✓ {item.ans}</div>}
          </div>
        );
      })}
    </div>
  );
}

// ─── MATCH ────────────────────────────────────────────────────────────────────
function MatchEx({ ex, ans, setAns, checked }) {
  const options = useMemo(() => [...ex.items.map(i => i.right)].sort(), [ex.id]);
  return (
    <div>
      {ex.items.map(item => {
        const val = ans[`m_${item.id}`] || '';
        const isOk = checked && val === item.right;
        const isWr = checked && val !== item.right;
        return (
          <div key={item.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap' }}>
            <ItemLabel lbl={item.lbl} color={ex.color} />
            <span style={{ minWidth: 150, fontSize: 14, fontWeight: 500, paddingTop: 5, color: ex.color }}>{item.left}</span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <select
                value={val}
                onChange={e => !checked && setAns(`m_${item.id}`, e.target.value)}
                disabled={checked}
                style={{
                  width: '100%', height: 34, padding: '0 10px',
                  border: `1.5px solid ${isOk ? '#059669' : isWr ? '#DC2626' : '#CBD5E1'}`,
                  borderRadius: 8,
                  background: isOk ? '#DCFCE7' : isWr ? '#FEE2E2' : 'white',
                  fontFamily: 'inherit', fontSize: 13, outline: 'none', cursor: checked ? 'default' : 'pointer',
                }}
              >
                <option value="">— choose —</option>
                {options.map((r, i) => <option key={i} value={r}>{r}</option>)}
              </select>
              {isWr && <div style={{ marginTop: 4, fontSize: 12, color: '#059669', fontWeight: 500 }}>✓ {item.right}</div>}
            </div>
            {checked && <StatusIcon ok={isOk} />}
          </div>
        );
      })}
    </div>
  );
}

// ─── ORDER ────────────────────────────────────────────────────────────────────
function OrderEx({ ex, ans, setAns, checked }) {
  return (
    <div>
      {ex.items.map(item => {
        const placed = ans[`ord_${item.id}`] || [];
        const remaining = item.shuffled.map((w, i) => ({ w, i })).filter(({ i }) => !placed.includes(i));
        const built = placed.map(i => item.shuffled[i]).join(' ');
        const isOk = checked && nm(built) === nm(item.answer);
        const isWr = checked && !isOk;
        return (
          <div key={item.id} style={{ marginBottom: 22 }}>
            <span style={{ fontWeight: 500, fontSize: 13, color: ex.color, display: 'block', marginBottom: 8 }}>{item.lbl}</span>
            {/* Word bank */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 9, marginBottom: 8, minHeight: 42 }}>
              {remaining.length === 0 && <span style={{ fontSize: 12, color: '#CBD5E1', fontStyle: 'italic', lineHeight: '26px' }}>All words placed</span>}
              {remaining.map(({ w, i }) => (
                <button key={i} onClick={() => !checked && setAns(`ord_${item.id}`, [...placed, i])} style={{
                  padding: '4px 10px', borderRadius: 7, border: '1.5px solid #CBD5E1',
                  background: 'white', cursor: checked ? 'default' : 'pointer', fontSize: 13,
                  fontFamily: 'inherit', color: '#374151', transition: 'border-color 0.15s',
                }}>{w}</button>
              ))}
            </div>
            {/* Built sentence */}
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 12px',
              border: `1.5px solid ${isOk ? '#059669' : isWr ? '#DC2626' : '#E2E8F0'}`,
              borderRadius: 9, minHeight: 42, background: isOk ? '#DCFCE7' : isWr ? '#FEE2E2' : '#FAFAFA',
              alignItems: 'center',
            }}>
              {placed.length === 0 && <span style={{ fontSize: 12, color: '#CBD5E1', fontStyle: 'italic', lineHeight: '26px' }}>Click words above to build the sentence…</span>}
              {placed.map((idx, pos) => (
                <button key={`${idx}-${pos}`} onClick={() => !checked && setAns(`ord_${item.id}`, placed.filter((_, p) => p !== pos))} style={{
                  padding: '4px 10px', borderRadius: 7, border: '1.5px solid #CBD5E1',
                  background: 'white', cursor: checked ? 'default' : 'pointer', fontSize: 13,
                  fontFamily: 'inherit', color: '#374151',
                }}>{item.shuffled[idx]}</button>
              ))}
              {checked && <StatusIcon ok={isOk} />}
            </div>
            {isWr && <div style={{ marginTop: 5, fontSize: 12, color: '#059669', fontWeight: 500 }}>✓ {item.answer}</div>}
          </div>
        );
      })}
    </div>
  );
}

// ─── TRUE / FALSE ─────────────────────────────────────────────────────────────
function TrueFalseEx({ ex, ans, setAns, checked }) {
  return (
    <div>
      {ex.items.map(item => {
        const val = ans[`tf_${item.id}`] || '';
        const isOk = checked && val === item.ans;
        const isWr = checked && val && val !== item.ans;
        return (
          <div key={item.id} style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'flex-start' }}>
            <ItemLabel lbl={item.lbl} color={ex.color} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 7px', fontSize: 14, lineHeight: 1.5, color: '#0F172A' }}>{item.statement}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                {['true', 'false'].map(opt => {
                  const label = opt === 'true' ? 'True' : 'False';
                  const sel = val === opt;
                  let bg = 'transparent', border = '#D1D5DB', color = '#6B7280', fw = 400;
                  if (!checked && sel) { bg = '#EFF6FF'; border = '#3B82F6'; color = '#1D4ED8'; fw = 500; }
                  if (checked) {
                    if (opt === item.ans) { bg = '#DCFCE7'; border = '#059669'; color = '#047857'; fw = 500; }
                    else if (sel) { bg = '#FEE2E2'; border = '#DC2626'; color = '#B91C1C'; fw = 500; }
                  }
                  return (
                    <button key={opt} onClick={() => !checked && setAns(`tf_${item.id}`, opt)} style={{
                      padding: '5px 18px', borderRadius: 20, border: `1.5px solid ${border}`,
                      background: bg, color, fontWeight: fw, cursor: checked ? 'default' : 'pointer',
                      fontFamily: 'inherit', fontSize: 13, transition: 'all 0.15s',
                    }}>{label}</button>
                  );
                })}
                {checked && isWr && <span style={{ fontSize: 12, color: '#059669', fontWeight: 500, alignSelf: 'center', marginLeft: 4 }}>→ {item.ans === 'true' ? 'True' : 'False'}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── MULTIPLE CHOICE ──────────────────────────────────────────────────────────
function MultiChoiceEx({ ex, ans, setAns, checked }) {
  return (
    <div>
      {ex.items.map(item => {
        const val = ans[`mc_${item.id}`] || '';
        return (
          <div key={item.id} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
              <ItemLabel lbl={item.lbl} color={ex.color} />
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, fontWeight: 500 }}>{item.question}</p>
            </div>
            <div style={{ paddingLeft: 32, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
              {item.opts.map((opt, idx) => {
                const letter = ['A', 'B', 'C', 'D'][idx];
                const sel = val === opt;
                const isAns = opt === item.ans;
                let bg = 'transparent', border = '#E2E8F0', textColor = '#374151';
                if (!checked && sel) { bg = '#EFF6FF'; border = '#3B82F6'; textColor = '#1D4ED8'; }
                if (checked) {
                  if (isAns) { bg = '#DCFCE7'; border = '#059669'; textColor = '#047857'; }
                  else if (sel) { bg = '#FEE2E2'; border = '#DC2626'; textColor = '#B91C1C'; }
                }
                return (
                  <button key={opt} onClick={() => !checked && setAns(`mc_${item.id}`, opt)} style={{
                    padding: '7px 12px', borderRadius: 8, border: `1.5px solid ${border}`,
                    background: bg, color: textColor, cursor: checked ? 'default' : 'pointer',
                    fontFamily: 'inherit', fontSize: 13, textAlign: 'left', transition: 'all 0.15s',
                    display: 'flex', gap: 8, alignItems: 'center',
                  }}>
                    <span style={{ fontWeight: 600, opacity: 0.6, minWidth: 14 }}>{letter}</span>
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── ERROR ────────────────────────────────────────────────────────────────────
function ErrorEx({ ex, ans, setAns, checked }) {
  return (
    <div>
      {ex.items.map(item => {
        const val = ans[`err_${item.id}`] || '';
        const isOk = checked && nm(val) === nm(item.correction);
        const isWr = checked && !isOk;
        // highlight errorWord in sentence
        const eIdx = item.sentence.indexOf(item.errorWord);
        const before = eIdx >= 0 ? item.sentence.slice(0, eIdx) : item.sentence;
        const after = eIdx >= 0 ? item.sentence.slice(eIdx + item.errorWord.length) : '';
        return (
          <div key={item.id} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
              <ItemLabel lbl={item.lbl} color={ex.color} />
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
                {before}
                <span style={{ color: '#B91C1C', fontWeight: 600, textDecoration: 'underline' }}>{item.errorWord}</span>
                {after}
              </p>
            </div>
            <div style={{ paddingLeft: 32, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: '#64748B' }}>Correction:</span>
              <input
                value={val}
                onChange={e => setAns(`err_${item.id}`, e.target.value)}
                readOnly={checked}
                placeholder="correct word…"
                style={{
                  width: 160, height: 30, padding: '0 10px',
                  border: `1.5px solid ${isOk ? '#059669' : isWr ? '#DC2626' : '#CBD5E1'}`,
                  borderRadius: 7,
                  background: isOk ? '#DCFCE7' : isWr ? '#FEE2E2' : 'white',
                  fontFamily: 'inherit', fontSize: 13, outline: 'none',
                }}
              />
              {checked && <StatusIcon ok={isOk} />}
              {isWr && <CorrectAnswer text={item.correction} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── EXERCISE RENDERER ────────────────────────────────────────────────────────
function ExRenderer({ ex, ans, setAns, checked }) {
  const props = { ex, ans, setAns, checked };
  switch (ex.tipo) {
    case 'fill':        return <FillEx {...props} />;
    case 'choice':      return <ChoiceEx {...props} />;
    case 'wordbank':    return <WordbankEx {...props} />;
    case 'construct':   return <ConstructEx {...props} />;
    case 'match':       return <MatchEx {...props} />;
    case 'order':       return <OrderEx {...props} />;
    case 'truefalse':   return <TrueFalseEx {...props} />;
    case 'multichoice': return <MultiChoiceEx {...props} />;
    case 'error':       return <ErrorEx {...props} />;
    default: return null;
  }
}

// ─── PLAY SCREEN ──────────────────────────────────────────────────────────────
function PlayScreen({ recurso, onBack }) {
  const [exIdx, setExIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [checked, setChecked] = useState({});

  const ex = recurso.ejercicios[exIdx];
  const exAns = answers[ex.id] || {};
  const isChecked = !!checked[ex.id];
  const setAns = (key, val) => setAnswers(p => ({ ...p, [ex.id]: { ...(p[ex.id] || {}), [key]: val } }));
  const score = isChecked ? calcScore(ex, exAns) : null;
  const pct = score ? Math.round((score.c / score.t) * 100) : 0;
  const scol = !score ? recurso.color : pct === 100 ? '#059669' : pct >= 60 ? '#D97706' : '#DC2626';
  const info = TIPO_INFO[ex.tipo] || {};
  const totalEx = recurso.ejercicios.length;

  // Global progress (ejercicios completados)
  const completados = recurso.ejercicios.filter(e => checked[e.id]).length;
  const globalPct = totalEx > 0 ? Math.round((completados / totalEx) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#F1F5F9', fontFamily: 'inherit', overflow: 'hidden' }}>

      {/* ── Top bar ──────────────────────────────────────────────── */}
      <div style={{ background: 'white', borderBottom: '2px solid #E2E8F0', padding: '0 20px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0, height: 56 }}>
        <button onClick={onBack} style={{
          border: 'none', background: `${recurso.color}15`, borderRadius: 8,
          cursor: 'pointer', padding: '6px 12px', color: recurso.color,
          fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 4
        }}>← Salir</button>

        {/* Título */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{recurso.titulo}</div>
          <div style={{ fontSize: 11, color: '#94A3B8' }}>{recurso.nivel} · {recurso.asignatura}</div>
        </div>

        {/* Progreso global */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1 }}>Progreso</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: recurso.color }}>{completados}/{totalEx}</div>
          </div>
          <div style={{ width: 80, height: 8, background: '#E2E8F0', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${globalPct}%`, height: '100%', background: recurso.color, borderRadius: 4, transition: 'width 0.4s' }} />
          </div>
        </div>
      </div>

      {/* ── Layout: sidebar + contenido ──────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Sidebar de ejercicios */}
        <div style={{
          width: 200, flexShrink: 0, background: 'white', borderRight: '1px solid #E2E8F0',
          overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 8px'
        }}>
          {recurso.ejercicios.map((e, i) => {
            const s = answers[e.id] && checked[e.id] ? calcScore(e, answers[e.id]) : null;
            const p = s ? Math.round((s.c / s.t) * 100) : -1;
            const dotColor = !s ? '#CBD5E1' : p === 100 ? '#059669' : p >= 60 ? '#D97706' : '#DC2626';
            const active = i === exIdx;
            const ti = TIPO_INFO[e.tipo] || {};
            return (
              <button key={e.id} onClick={() => setExIdx(i)} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 10px', borderRadius: 10, border: 'none',
                background: active ? `${recurso.color}12` : 'transparent',
                outline: active ? `2px solid ${recurso.color}` : '2px solid transparent',
                cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                transition: 'background 0.15s, outline 0.15s',
              }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                  background: active ? recurso.color : dotColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: 11, fontWeight: 700
                }}>{i + 1}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: active ? 700 : 500, color: active ? recurso.color : '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>{e.titulo}</div>
                  <div style={{ fontSize: 10, color: ti.color || '#94A3B8', marginTop: 1 }}>{ti.label}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Contenido principal */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 40px' }}>

          {ex.imagen && (
            <div style={{ marginBottom: 18, borderRadius: 14, overflow: 'hidden', border: '1px solid #E2E8F0', maxHeight: 300 }}>
              <img src={ex.imagen} alt="" style={{ width: '100%', display: 'block', objectFit: 'cover' }} />
            </div>
          )}

          <div style={{ background: 'white', borderRadius: 18, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>

            {/* Cabecera del ejercicio */}
            <div style={{
              background: `linear-gradient(135deg, ${recurso.color}18, ${recurso.color}08)`,
              borderBottom: `2px solid ${recurso.color}25`,
              padding: '20px 28px',
              display: 'flex', gap: 16, alignItems: 'flex-start'
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, background: recurso.color,
                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 18, flexShrink: 0, boxShadow: `0 4px 12px ${recurso.color}55`
              }}>{exIdx + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                  <span style={{ fontWeight: 800, fontSize: 18, color: '#0F172A' }}>{ex.titulo}</span>
                  <span style={{
                    padding: '3px 12px', borderRadius: 20,
                    background: `${info.color || recurso.color}20`,
                    color: info.color || recurso.color, fontSize: 11, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: 0.5
                  }}>{info.label}</span>
                </div>
                <p style={{ margin: 0, fontSize: 14, color: '#475569', lineHeight: 1.6 }}>{ex.enunciado}</p>
              </div>
            </div>

            {/* Cuerpo */}
            <div style={{ padding: '28px' }}>
              <ExRenderer ex={ex} ans={exAns} setAns={setAns} checked={isChecked} />
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 28px', borderTop: '1px solid #F1F5F9',
              background: '#FAFBFC', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', gap: 12, flexWrap: 'wrap'
            }}>
              {score ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ fontSize: 30, fontWeight: 900, color: scol, lineHeight: 1 }}>{score.c}<span style={{ fontSize: 16, color: '#94A3B8' }}>/{score.t}</span></div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: scol, marginBottom: 6 }}>
                      {pct === 100 ? '🎉 Perfect!' : pct >= 80 ? '👍 Very good!' : pct >= 60 ? '🙂 Good effort!' : '📚 Keep practising!'}
                    </div>
                    <div style={{ width: 160, height: 8, background: '#E2E8F0', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: scol, borderRadius: 4, transition: 'width 0.5s' }} />
                    </div>
                  </div>
                </div>
              ) : (
                <span style={{ fontSize: 12, color: '#94A3B8' }}>{ex.items.length} {ex.items.length === 1 ? 'pregunta' : 'preguntas'}</span>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                {isChecked && (
                  <button onClick={() => { setChecked(p => ({ ...p, [ex.id]: false })); setAnswers(p => ({ ...p, [ex.id]: {} })); }} style={{
                    padding: '10px 20px', borderRadius: 10, border: '1.5px solid #E2E8F0', background: 'white',
                    color: '#374151', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}>Retry</button>
                )}
                {!isChecked && (
                  <button onClick={() => setChecked(p => ({ ...p, [ex.id]: true }))} style={{
                    padding: '10px 26px', borderRadius: 10, border: 'none', background: recurso.color,
                    color: 'white', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    boxShadow: `0 4px 14px ${recurso.color}55`,
                  }}>Check answers ✓</button>
                )}
                {exIdx < totalEx - 1 && (
                  <button onClick={() => setExIdx(exIdx + 1)} style={{
                    padding: '10px 20px', borderRadius: 10, border: `1.5px solid ${recurso.color}`,
                    background: 'white', color: recurso.color, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  }}>Next →</button>
                )}
              </div>
            </div>
          </div>

          {/* Fin del recurso */}
          {completados === totalEx && totalEx > 0 && (
            <div style={{
              marginTop: 20, background: 'white', borderRadius: 16, padding: '24px',
              textAlign: 'center', border: `2px solid #059669`, boxShadow: '0 4px 20px #05966920'
            }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🎉</div>
              <div style={{ fontWeight: 800, fontSize: 18, color: '#059669' }}>¡Recurso completado!</div>
              <div style={{ color: '#64748B', fontSize: 13, marginTop: 4 }}>Has terminado todos los ejercicios.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── BROWSE SCREEN ────────────────────────────────────────────────────────────
function BrowseScreen({ onSelect, onBack }) {
  const [query, setQuery] = useState('');
  const [nivel, setNivel] = useState('');
  const [tema, setTema] = useState('');

  const niveles = [...new Set(BIBLIOTECA.map(r => r.nivel))].sort();
  const temas = [...new Set(BIBLIOTECA.map(r => r.tema))].sort();

  const filtered = useMemo(() => BIBLIOTECA.filter(r => {
    if (nivel && r.nivel !== nivel) return false;
    if (tema && r.tema !== tema) return false;
    if (query) {
      const q = query.toLowerCase();
      return r.titulo.toLowerCase().includes(q) ||
             r.descripcion.toLowerCase().includes(q) ||
             (r.tags || []).some(t => t.toLowerCase().includes(q));
    }
    return true;
  }), [query, nivel, tema]);

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4FF', fontFamily: 'inherit' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #4338CA, #6D28D9)', padding: '20px 24px', color: 'white' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <button onClick={onBack} style={{ border: 'none', background: 'rgba(255,255,255,0.2)', borderRadius: 8, cursor: 'pointer', fontSize: 18, padding: '4px 10px', color: 'white' }}>←</button>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>Omninteractive</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>Interactive exercises · pikt.es</div>
            </div>
          </div>
          {/* Search bar */}
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search resources by topic, level or keyword…"
            style={{
              width: '100%', height: 42, padding: '0 16px',
              borderRadius: 12, border: 'none', outline: 'none',
              fontSize: 14, fontFamily: 'inherit',
              background: 'rgba(255,255,255,0.95)', color: '#0F172A',
              boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
            }}
          />
        </div>
      </div>

      {/* Filters */}
      <div style={{ background: 'white', borderBottom: '1px solid #E2E8F0', padding: '12px 24px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#94A3B8', marginRight: 4 }}>Level:</span>
          {['', ...niveles].map(n => (
            <button key={n} onClick={() => setNivel(n)} style={{
              padding: '4px 12px', borderRadius: 20,
              border: `1.5px solid ${nivel === n ? '#4338CA' : '#E2E8F0'}`,
              background: nivel === n ? '#EEF2FF' : 'transparent',
              color: nivel === n ? '#4338CA' : '#6B7280',
              fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', fontWeight: nivel === n ? 600 : 400,
            }}>{n || 'All'}</button>
          ))}
          <span style={{ fontSize: 12, color: '#94A3B8', marginLeft: 8, marginRight: 4 }}>Topic:</span>
          {['', ...temas].map(t => (
            <button key={t} onClick={() => setTema(t)} style={{
              padding: '4px 12px', borderRadius: 20,
              border: `1.5px solid ${tema === t ? '#4338CA' : '#E2E8F0'}`,
              background: tema === t ? '#EEF2FF' : 'transparent',
              color: tema === t ? '#4338CA' : '#6B7280',
              fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', fontWeight: tema === t ? 600 : 400,
            }}>{t || 'All'}</button>
          ))}
        </div>
      </div>

      {/* Resource grid */}
      <div style={{ maxWidth: 860, margin: '24px auto', padding: '0 16px 40px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 60, color: '#94A3B8' }}>
            No resources found. Try a different search.
          </div>
        )}
        {filtered.map(recurso => {
          const tipos = [...new Set(recurso.ejercicios.map(e => e.tipo))];
          return (
            <div key={recurso.id} onClick={() => onSelect(recurso)} style={{
              background: 'white', borderRadius: 16, border: `1px solid #E2E8F0`,
              borderLeft: `5px solid ${recurso.color}`, overflow: 'hidden',
              cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s',
              boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 6px rgba(0,0,0,0.06)'; }}
            >
              <div style={{ padding: '18px 18px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <span style={{ padding: '2px 10px', borderRadius: 20, background: `${recurso.color}18`, color: recurso.color, fontSize: 11, fontWeight: 700 }}>{recurso.nivel}</span>
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>{recurso.ejercicios.length} exercises</span>
                </div>
                <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#0F172A', lineHeight: 1.3 }}>{recurso.titulo}</h3>
                <p style={{ margin: '0 0 12px', fontSize: 12, color: '#64748B', lineHeight: 1.5 }}>{recurso.descripcion}</p>
                {/* Exercise type badges */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {tipos.map(t => {
                    const ti = TIPO_INFO[t] || {};
                    return (
                      <span key={t} style={{ padding: '2px 8px', borderRadius: 6, background: `${ti.color}12`, color: ti.color, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {ti.label}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div style={{ padding: '10px 18px', borderTop: '1px solid #F1F5F9', background: '#FAFAFA', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#64748B' }}>{recurso.asignatura} · {recurso.tema}</span>
                <span style={{ fontSize: 13, color: recurso.color, fontWeight: 600 }}>Open →</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function OmninteractiveApp({ onBack = () => {}, recursoDirecto = null }) {
  const [screen, setScreen] = useState(recursoDirecto ? 'play' : 'browse');
  const [recurso, setRecurso] = useState(recursoDirecto);

  if (screen === 'play' && recurso) {
    return <PlayScreen recurso={recurso} onBack={() => { if (recursoDirecto) onBack(); else setScreen('browse'); }} />;
  }
  return (
    <BrowseScreen
      onSelect={r => { setRecurso(r); setScreen('play'); }}
      onBack={onBack}
    />
  );
}
