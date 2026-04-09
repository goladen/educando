// OmninteractiveApp.jsx
// Integrar en LandingGames3: import OmninteractiveApp from './OmninteractiveApp';
// Añadir case 'OMNINTERACTIVE': return <OmninteractiveApp onBack={handleBack} />;
// El componente acepta prop: onBack (función para volver al menú principal)
import FotoARecurso from './FotoARecurso';

import { useState, useMemo, useEffect, useRef } from 'react';
import { BIBLIOTECA } from './BibliotecaOmni';
import { db } from './firebase';
import { doc, setDoc, updateDoc, onSnapshot, increment, collection, addDoc, getDoc } from 'firebase/firestore';
import piHappy from './assets/Pi-contento.png';
import piAngry from './assets/Pi-enfadado.png';
import piNeutral from './assets/Pi-neutro.png';
import startSoundFile from './assets/inicio juego.mp3';
import correctSoundFile from './assets/correct-choice-43861.mp3';
import wrongSoundFile from './assets/wrong.mp3';

const audioStart   = new Audio(startSoundFile);
const audioCorrect = new Audio(correctSoundFile);
const audioWrong   = new Audio(wrongSoundFile);
const playAudio = (a) => { try { a.currentTime = 0; a.play().catch(() => {}); } catch {} };

const genCode = () => Math.random().toString(36).slice(2, 7).toUpperCase();

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

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function shuffleArr(arr) { return [...arr].sort(() => Math.random() - 0.5); }

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 640);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return mobile;
}

// ── Sanitize nested arrays for Firestore ─────────────────────────────────────
function sanitizeForFirestore(ejercicios) {
  return ejercicios.map(ex => ({
    ...ex,
    items: (ex.items || []).map(item => {
      const clean = { ...item };
      if (Array.isArray(item.alts)) clean.alts = item.alts.map(a => Array.isArray(a) ? a.join('|') : (a || ''));
      return clean;
    }),
  }));
}

// ── Pi-K-T-¡YA! countdown ────────────────────────────────────────────────────
function PantallaCuentaAtras({ onFinished }) {
  const [paso, setPaso] = useState(0);
  const [txt,  setTxt]  = useState('π');
  const COLORS = ['#3B82F6', '#EF4444', '#F59E0B', '#10B981'];
  useEffect(() => {
    playAudio(audioStart);
    (async () => {
      for (const [t, i] of [['π', 0], ['K', 1], ['T', 2], ['¡YA!', 3]]) {
        setTxt(t); setPaso(i);
        await new Promise(r => setTimeout(r, 1000));
      }
      onFinished();
    })();
  }, []);
  return (
    <div style={{ position:'fixed', inset:0, background:'radial-gradient(circle,#1e1b4b,#000)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:9999, flexDirection:'column', gap:20 }}>
      <div key={paso} style={{ fontSize:'10rem', fontWeight:900, color:COLORS[paso], animation:'omniZoom 0.5s ease-out', textAlign:'center', lineHeight:1 }}>{txt}</div>
      <style>{`@keyframes omniZoom{from{transform:scale(0.3);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
    </div>
  );
}

// ── Timer bar ─────────────────────────────────────────────────────────────────
function TimerBar({ tiempo, startTime, onTimeUp }) {
  const [pct, setPct] = useState(100);
  const ref = useRef(null);
  useEffect(() => {
    if (!tiempo || !startTime) return;
    clearInterval(ref.current);
    const tick = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const p = Math.max(0, 100 - (elapsed / tiempo * 100));
      setPct(p);
      if (p <= 0) { clearInterval(ref.current); onTimeUp?.(); }
    };
    tick();
    ref.current = setInterval(tick, 250);
    return () => clearInterval(ref.current);
  }, [startTime, tiempo]);
  if (!tiempo || !startTime) return null;
  const remaining = Math.max(0, Math.ceil(tiempo - (Date.now() - startTime) / 1000));
  const barColor = pct > 50 ? '#059669' : pct > 20 ? '#D97706' : '#DC2626';
  return (
    <div style={{ marginTop:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'rgba(255,255,255,0.7)', marginBottom:3 }}>
        <span>⏱</span><span style={{ fontWeight:700, color:barColor }}>{remaining}s</span>
      </div>
      <div style={{ height:6, background:'rgba(255,255,255,0.2)', borderRadius:3, overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', background:barColor, borderRadius:3, transition:'width 0.25s linear' }} />
      </div>
    </div>
  );
}

// ── Modal enviar al profesor ──────────────────────────────────────────────────
function ModalEnviarOmni({ recurso, resultados, onClose }) {
  const [nombre,   setNombre]   = useState('');
  const [curso,    setCurso]    = useState('');
  const [codigo,   setCodigo]   = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado,  setEnviado]  = useState(false);
  const [error,    setError]    = useState('');
  const totalC   = resultados.reduce((s, r) => s + r.c, 0);
  const totalT   = resultados.reduce((s, r) => s + r.t, 0);
  const pctTotal = totalT > 0 ? Math.round(totalC / totalT * 100) : 0;

  const enviar = async () => {
    if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
    const code = codigo.trim().toUpperCase();
    if (!code) { setError('Escribe el código del profesor.'); return; }
    setEnviando(true); setError('');
    try {
      const snap = await getDoc(doc(db, 'codigos_profesor', code));
      if (!snap.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
      await addDoc(collection(db, 'informes_juegos'), {
        tipo: 'OMNINTERACTIVE', modalidad: 'Individual', fecha: new Date(),
        codigoProfesor: code, recursoTitulo: recurso.titulo,
        jugadores: [{ nombre: nombre.trim(), curso: curso.trim(), porcentaje: pctTotal, correcto: pctTotal >= 60, puntos: pctTotal,
          tipoEjercicio: recurso.titulo, detalles: resultados.map(r => ({ titulo: r.titulo, pct: r.t > 0 ? Math.round(r.c / r.t * 100) : 0 })) }],
      });
      setEnviado(true);
    } catch (e) { setError('Error: ' + e.message); }
    setEnviando(false);
  };

  const inp = { padding:'9px 12px', borderRadius:9, border:'1.5px solid #E2E8F0', fontSize:'0.9rem', outline:'none', width:'100%', boxSizing:'border-box', fontFamily:'inherit' };

  return (
    <div style={{ position:'fixed', inset:0, zIndex:3000, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'white', borderRadius:20, width:'100%', maxWidth:380, padding:'26px 28px', boxShadow:'0 30px 80px rgba(0,0,0,0.4)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <h3 style={{ margin:0, color:'#1F2937', fontSize:'1.05rem' }}>📤 Enviar resultados al profesor</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#9CA3AF', fontSize:'1.3rem' }}>✕</button>
        </div>
        {enviado ? (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            <div style={{ fontSize:48 }}>✅</div>
            <div style={{ fontWeight:700, color:'#059669', fontSize:'1.05rem', marginTop:8 }}>¡Enviado!</div>
            <div style={{ fontSize:'2rem', fontWeight:900, color:pctTotal===100?'#059669':pctTotal>=60?'#D97706':'#DC2626', margin:'10px 0' }}>{pctTotal}%</div>
            <button onClick={onClose} style={{ marginTop:8, padding:'9px 22px', borderRadius:10, border:'none', background:'#F1F5F9', cursor:'pointer', fontFamily:'inherit' }}>Cerrar</button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div><label style={{ fontSize:'0.78rem', color:'#6B7280', fontWeight:600, display:'block', marginBottom:4 }}>Nombre *</label>
              <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre completo" style={inp} /></div>
            <div><label style={{ fontSize:'0.78rem', color:'#6B7280', fontWeight:600, display:'block', marginBottom:4 }}>Curso</label>
              <input value={curso} onChange={e => setCurso(e.target.value)} placeholder="Ej: 3º ESO A" style={inp} /></div>
            <div><label style={{ fontSize:'0.78rem', color:'#6B7280', fontWeight:600, display:'block', marginBottom:4 }}>Código del profesor *</label>
              <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="XXXXX" style={{ ...inp, textTransform:'uppercase', letterSpacing:3, fontWeight:700 }} /></div>
            {error && <div style={{ color:'#DC2626', fontSize:'0.82rem', background:'#FEF2F2', padding:'8px 12px', borderRadius:8 }}>{error}</div>}
            <button onClick={enviar} disabled={enviando} style={{ padding:'11px', borderRadius:10, border:'none', background:'#6D28D9', color:'white', fontWeight:700, cursor:'pointer', fontFamily:'inherit', marginTop:4, opacity:enviando ? 0.7 : 1 }}>
              {enviando ? 'Enviando…' : 'Enviar resultados'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Summary screen ────────────────────────────────────────────────────────────
function SummaryScreen({ recurso, shuffledEj, answers, onBack, onRetry }) {
  const [showModal, setShowModal] = useState(false);
  const resultados = shuffledEj.map(ex => {
    const s = calcScore(ex, answers[ex.id] || {});
    return { id:ex.id, titulo:ex.titulo, c:s.c, t:s.t, pct: s.t > 0 ? Math.round(s.c / s.t * 100) : 0 };
  });
  const totalC   = resultados.reduce((s, r) => s + r.c, 0);
  const totalT   = resultados.reduce((s, r) => s + r.t, 0);
  const pctTotal = totalT > 0 ? Math.round(totalC / totalT * 100) : 0;
  const piImg    = pctTotal >= 60 ? piHappy : pctTotal < 30 ? piAngry : piNeutral;

  return (
    <div style={{ minHeight:'100dvh', background:'#F1F5F9', fontFamily:'inherit' }}>
      <div style={{ background:'linear-gradient(135deg,#4338CA,#6D28D9)', padding:'28px 20px', textAlign:'center', color:'white' }}>
        <img src={piImg} alt="Pi" style={{ width:80, height:80, objectFit:'contain', marginBottom:10 }} />
        <div style={{ fontSize:52, fontWeight:900, lineHeight:1 }}>{pctTotal}<span style={{ fontSize:22 }}>%</span></div>
        <div style={{ fontSize:14, opacity:0.85, marginTop:6 }}>{recurso.titulo}</div>
        <div style={{ fontSize:13, opacity:0.7, marginTop:2 }}>{totalC}/{totalT} respuestas correctas</div>
      </div>
      <div style={{ maxWidth:600, margin:'0 auto', padding:'20px 16px 40px' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:20 }}>
          {resultados.map(r => (
            <div key={r.id} style={{ background:'white', borderRadius:12, padding:'14px 18px', boxShadow:'0 1px 6px rgba(0,0,0,0.06)', display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:600, fontSize:14, color:'#1F2937', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.titulo}</div>
                <div style={{ fontSize:12, color:'#64748B', marginTop:2 }}>{r.c}/{r.t} correctas</div>
              </div>
              <div style={{ flexShrink:0, textAlign:'right' }}>
                <div style={{ fontWeight:800, fontSize:18, color:r.pct===100?'#059669':r.pct>=60?'#D97706':'#DC2626' }}>{r.pct}%</div>
                <div style={{ width:70, height:5, background:'#E2E8F0', borderRadius:3, overflow:'hidden', marginTop:4 }}>
                  <div style={{ width:`${r.pct}%`, height:'100%', background:r.pct===100?'#059669':r.pct>=60?'#D97706':'#DC2626', borderRadius:3 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          {onRetry && (
            <button onClick={onRetry} style={{ flex:1, minWidth:130, padding:'12px', borderRadius:11, border:'1.5px solid #6D28D9', background:'white', color:'#6D28D9', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>🔁 Repetir</button>
          )}
          <button onClick={() => setShowModal(true)} style={{ flex:1, minWidth:130, padding:'12px', borderRadius:11, border:'none', background:'linear-gradient(135deg,#3B82F6,#2563EB)', color:'white', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>📤 Enviar al profesor</button>
          <button onClick={onBack} style={{ flex:1, minWidth:130, padding:'12px', borderRadius:11, border:'none', background:'#1F2937', color:'white', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>← Volver</button>
        </div>
      </div>
      {showModal && <ModalEnviarOmni recurso={recurso} resultados={resultados} onClose={() => setShowModal(false)} />}
    </div>
  );
}

// ── Play Screen (single player) ───────────────────────────────────────────────
function PlayScreen({ recurso, onBack }) {
  const isMobile = useIsMobile();
  const [shuffledEj]    = useState(() => recurso.ejercicios.map(ex => ({ ...ex, items: shuffleArr(ex.items) })));
  const [exIdx,          setExIdx]      = useState(0);
  const [answers,        setAnswers]    = useState({});
  const [checked,        setChecked]    = useState({});
  const [startTimes,     setStartTimes] = useState({});
  const [showSummary,    setShowSummary]= useState(false);

  const soloUnIntento = !!recurso.soloUnIntento;
  const attemptKey    = `omni_done_${recurso.id || recurso.titulo}`;
  const alreadyDone   = soloUnIntento && !!localStorage.getItem(attemptKey);

  const ex        = shuffledEj[exIdx];
  const exAns     = answers[ex.id] || {};
  const isChecked = !!checked[ex.id];
  const totalEx   = shuffledEj.length;
  const completados = shuffledEj.filter(e => checked[e.id]).length;
  const globalPct   = totalEx > 0 ? Math.round(completados / totalEx * 100) : 0;
  const score = isChecked ? calcScore(ex, exAns) : null;
  const pct   = score ? Math.round(score.c / score.t * 100) : 0;
  const scol  = !score ? recurso.color : pct === 100 ? '#059669' : pct >= 60 ? '#D97706' : '#DC2626';
  const info  = TIPO_INFO[ex.tipo] || {};

  // Init timer when switching exercises
  useEffect(() => {
    if ((ex.tiempo || 0) > 0 && !startTimes[ex.id])
      setStartTimes(p => ({ ...p, [ex.id]: Date.now() }));
  }, [exIdx]);

  const autoCheck  = (exId) => setChecked(p => p[exId] ? p : { ...p, [exId]: true });
  const setAns     = (key, val) => setAnswers(p => ({ ...p, [ex.id]: { ...(p[ex.id] || {}), [key]: val } }));

  const handleCheck = () => {
    if (isChecked) return;
    setChecked(p => ({ ...p, [ex.id]: true }));
    if (calcScore(ex, exAns).c > 0) playAudio(audioCorrect); else playAudio(audioWrong);
  };

  const handleRetry = () => {
    setChecked(p => ({ ...p, [ex.id]: false }));
    setAnswers(p => ({ ...p, [ex.id]: {} }));
    setStartTimes(p => ({ ...p, [ex.id]: Date.now() }));
  };

  const handleFinish = () => {
    if (soloUnIntento) localStorage.setItem(attemptKey, '1');
    setShowSummary(true);
  };

  if (alreadyDone) return (
    <div style={{ minHeight:'100dvh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#F1F5F9', padding:20, textAlign:'center', fontFamily:'inherit' }}>
      <img src={piNeutral} alt="Pi" style={{ width:90, objectFit:'contain', marginBottom:16 }} />
      <h2 style={{ color:'#1F2937', margin:'0 0 8px' }}>Solo un intento permitido</h2>
      <p style={{ color:'#64748B', maxWidth:300, margin:0 }}>Ya has completado este test desde este dispositivo.</p>
      <button onClick={onBack} style={{ marginTop:20, padding:'10px 24px', borderRadius:10, border:'none', background:'#6D28D9', color:'white', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>← Volver</button>
    </div>
  );

  if (showSummary) return (
    <SummaryScreen recurso={recurso} shuffledEj={shuffledEj} answers={answers} onBack={onBack}
      onRetry={soloUnIntento ? null : () => { setAnswers({}); setChecked({}); setExIdx(0); setStartTimes({}); setShowSummary(false); }}
    />
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100dvh', background:'#F1F5F9', fontFamily:'inherit', overflow:'hidden' }}>
      {/* Top bar */}
      <div style={{ background:'white', borderBottom:'2px solid #E2E8F0', padding:'0 12px', display:'flex', alignItems:'center', gap:10, flexShrink:0, height:52 }}>
        <button onClick={onBack} style={{ border:'none', background:`${recurso.color}15`, borderRadius:8, cursor:'pointer', padding:'6px 10px', color:recurso.color, fontWeight:700, fontSize:14, flexShrink:0 }}>← Salir</button>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:800, fontSize:isMobile ? 13 : 15, color:'#0F172A', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{recurso.titulo}</div>
        </div>
        <span style={{ fontSize:12, fontWeight:700, color:recurso.color, flexShrink:0 }}>{completados}/{totalEx}</span>
        <div style={{ width:isMobile ? 50 : 80, height:7, background:'#E2E8F0', borderRadius:4, overflow:'hidden', flexShrink:0 }}>
          <div style={{ width:`${globalPct}%`, height:'100%', background:recurso.color, borderRadius:4, transition:'width 0.4s' }} />
        </div>
      </div>

      {/* Mobile tabs */}
      {isMobile && (
        <div style={{ background:'white', borderBottom:'1px solid #E2E8F0', overflowX:'auto', flexShrink:0, WebkitOverflowScrolling:'touch' }}>
          <div style={{ display:'flex', padding:'6px 8px', gap:6, width:'max-content' }}>
            {shuffledEj.map((e, i) => {
              const s = checked[e.id] ? calcScore(e, answers[e.id] || {}) : null;
              const p = s ? Math.round(s.c / s.t * 100) : -1;
              const dc = !s ? '#CBD5E1' : p === 100 ? '#059669' : p >= 60 ? '#D97706' : '#DC2626';
              const active = i === exIdx;
              return (
                <button key={e.id} onClick={() => setExIdx(i)} style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 10px', borderRadius:20, border:'none', background:active ? recurso.color : '#F1F5F9', color:active ? 'white' : '#64748B', cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:active ? 700 : 500, whiteSpace:'nowrap' }}>
                  <span style={{ width:16, height:16, borderRadius:'50%', flexShrink:0, background:active ? 'rgba(255,255,255,0.3)' : dc, display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color:'white' }}>{i + 1}</span>
                  {e.titulo}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        {/* Sidebar desktop */}
        {!isMobile && (
          <div style={{ width:200, flexShrink:0, background:'white', borderRight:'1px solid #E2E8F0', overflowY:'auto', display:'flex', flexDirection:'column', gap:4, padding:'12px 8px' }}>
            {shuffledEj.map((e, i) => {
              const s = checked[e.id] ? calcScore(e, answers[e.id] || {}) : null;
              const p = s ? Math.round(s.c / s.t * 100) : -1;
              const dc = !s ? '#CBD5E1' : p === 100 ? '#059669' : p >= 60 ? '#D97706' : '#DC2626';
              const active = i === exIdx;
              const ti = TIPO_INFO[e.tipo] || {};
              return (
                <button key={e.id} onClick={() => setExIdx(i)} style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 10px', borderRadius:10, border:'none', background:active ? `${recurso.color}12` : 'transparent', outline:active ? `2px solid ${recurso.color}` : '2px solid transparent', cursor:'pointer', textAlign:'left', fontFamily:'inherit' }}>
                  <div style={{ width:26, height:26, borderRadius:8, flexShrink:0, background:active ? recurso.color : dc, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:11, fontWeight:700 }}>{i + 1}</div>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:active ? 700 : 500, color:active ? recurso.color : '#374151', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:120 }}>{e.titulo}</div>
                    <div style={{ fontSize:10, color:ti.color || '#94A3B8', marginTop:1 }}>{ti.label}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Content */}
        <div style={{ flex:1, overflowY:'auto', padding:isMobile ? '12px 10px 32px' : '24px 28px 40px' }}>
          <div style={{ background:'white', borderRadius:isMobile ? 14 : 18, border:'1px solid #E2E8F0', overflow:'hidden', boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>

            {/* Exercise header */}
            <div style={{ background:`linear-gradient(135deg,${recurso.color}18,${recurso.color}08)`, borderBottom:`2px solid ${recurso.color}25`, padding:isMobile ? '14px 16px' : '20px 28px', display:'flex', gap:12, alignItems:'flex-start' }}>
              <div style={{ width:isMobile ? 34 : 44, height:isMobile ? 34 : 44, borderRadius:10, background:recurso.color, color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:isMobile ? 15 : 18, flexShrink:0 }}>{exIdx + 1}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:4 }}>
                  <span style={{ fontWeight:800, fontSize:isMobile ? 15 : 18, color:'#0F172A' }}>{ex.titulo}</span>
                  <span style={{ padding:'2px 10px', borderRadius:20, background:`${info.color || recurso.color}20`, color:info.color || recurso.color, fontSize:10, fontWeight:700, textTransform:'uppercase' }}>{info.label}</span>
                </div>
                <p style={{ margin:0, fontSize:isMobile ? 13 : 14, color:'#475569', lineHeight:1.5 }}>{ex.enunciado}</p>
                {/* Timer bar */}
                {(ex.tiempo || 0) > 0 && startTimes[ex.id] && !isChecked && (
                  <TimerBar tiempo={ex.tiempo} startTime={startTimes[ex.id]} onTimeUp={() => autoCheck(ex.id)} />
                )}
              </div>
            </div>

            {/* Body */}
            <div style={{ padding:isMobile ? '16px' : '28px' }}>
              <ExRenderer ex={ex} ans={exAns} setAns={setAns} checked={isChecked} />
            </div>

            {/* Footer */}
            <div style={{ padding:isMobile ? '12px 16px' : '16px 28px', borderTop:'1px solid #F1F5F9', background:'#FAFBFC', display:'flex', flexDirection:isMobile ? 'column' : 'row', alignItems:isMobile ? 'stretch' : 'center', justifyContent:'space-between', gap:10 }}>
              {score ? (
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ fontSize:26, fontWeight:900, color:scol, lineHeight:1 }}>{score.c}<span style={{ fontSize:14, color:'#94A3B8' }}>/{score.t}</span></div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:scol, marginBottom:4 }}>{pct === 100 ? '🎉 Perfect!' : pct >= 80 ? '👍 Very good!' : pct >= 60 ? '🙂 Good effort!' : '📚 Keep practising!'}</div>
                    <div style={{ width:120, height:7, background:'#E2E8F0', borderRadius:4, overflow:'hidden' }}>
                      <div style={{ width:`${pct}%`, height:'100%', background:scol, borderRadius:4, transition:'width 0.5s' }} />
                    </div>
                  </div>
                </div>
              ) : (
                <span style={{ fontSize:12, color:'#94A3B8' }}>{ex.items.length} {ex.items.length === 1 ? 'pregunta' : 'preguntas'}</span>
              )}
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {isChecked && !soloUnIntento && (
                  <button onClick={handleRetry} style={{ flex:isMobile ? 1 : undefined, padding:'10px 16px', borderRadius:10, border:'1.5px solid #E2E8F0', background:'white', color:'#374151', fontFamily:'inherit', fontSize:13, fontWeight:600, cursor:'pointer' }}>Retry</button>
                )}
                {!isChecked && (
                  <button onClick={handleCheck} style={{ flex:isMobile ? 1 : undefined, padding:'10px 20px', borderRadius:10, border:'none', background:recurso.color, color:'white', fontFamily:'inherit', fontSize:14, fontWeight:700, cursor:'pointer', boxShadow:`0 4px 14px ${recurso.color}55` }}>Check ✓</button>
                )}
                {isChecked && exIdx < totalEx - 1 && (
                  <button onClick={() => setExIdx(exIdx + 1)} style={{ flex:isMobile ? 1 : undefined, padding:'10px 16px', borderRadius:10, border:`1.5px solid ${recurso.color}`, background:'white', color:recurso.color, fontFamily:'inherit', fontSize:13, fontWeight:700, cursor:'pointer' }}>Next →</button>
                )}
                {isChecked && exIdx === totalEx - 1 && (
                  <button onClick={handleFinish} style={{ flex:isMobile ? 1 : undefined, padding:'10px 20px', borderRadius:10, border:'none', background:'#059669', color:'white', fontFamily:'inherit', fontSize:14, fontWeight:700, cursor:'pointer' }}>Ver resultados 🏁</button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Live host ─────────────────────────────────────────────────────────────────
function OmniLiveHost({ recurso, codigoSala, onExit }) {
  const [gameData,  setGameData]  = useState(null);
  const [fase,      setFase]      = useState('CREATING');
  const [subFase,   setSubFase]   = useState('RESPONDING');
  const [timer,     setTimer]     = useState(0);
  const [stats,     setStats]     = useState({ aciertos:0, total:0, pct:0 });
  const [jugadores, setJugadores] = useState([]);
  const timerRef = useRef(null);
  const gdRef    = useRef(null);
  useEffect(() => { gdRef.current = gameData; }, [gameData]);

  // Create Firestore document
  useEffect(() => {
    const shuffled = shuffleArr(recurso.ejercicios).map(ex => ({ ...ex, items: shuffleArr(ex.items) }));
    const sanitized = sanitizeForFirestore(shuffled);
    setDoc(doc(db, 'live_games', codigoSala), {
      estado:'LOBBY', recursoTitulo:recurso.titulo,
      ejercicios: sanitized, indicePregunta:0,
      fasePregunta:'RESPONDING', questionStartTime:null,
      respuestasRonda:{}, jugadores:{},
    }).then(() => setFase('LOBBY'));
  }, []);

  // Listen to Firestore
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'live_games', codigoSala), async snap => {
      if (!snap.exists()) return;
      const data = snap.data();
      setGameData(data);
      setFase(data.estado || 'LOBBY');
      setSubFase(data.fasePregunta || 'RESPONDING');
      setJugadores(data.jugadores ? Object.values(data.jugadores) : []);
      // Auto-reveal when all responded
      if (data.estado === 'JUEGO' && data.fasePregunta === 'RESPONDING') {
        const n = Object.keys(data.respuestasRonda || {}).length;
        const tot = Object.keys(data.jugadores || {}).length;
        if (tot > 0 && n >= tot) revelar(data);
      }
    });
    return () => unsub();
  }, [codigoSala]);

  // Host countdown timer
  useEffect(() => {
    clearInterval(timerRef.current);
    if (fase === 'JUEGO' && subFase === 'RESPONDING' && gameData) {
      const ex  = gameData.ejercicios?.[gameData.indicePregunta];
      const tt  = (ex?.tiempo || 0) > 0 ? ex.tiempo : 30;
      const ini = gameData.questionStartTime || Date.now();
      timerRef.current = setInterval(() => {
        const r = Math.max(0, Math.ceil(tt - (Date.now() - ini) / 1000));
        setTimer(r);
        if (r <= 0) { clearInterval(timerRef.current); if (gdRef.current) revelar(gdRef.current); }
      }, 500);
    }
    return () => clearInterval(timerRef.current);
  }, [fase, subFase, gameData?.indicePregunta, gameData?.questionStartTime]);

  const revelar = async (d) => {
    if (d.fasePregunta !== 'RESPONDING') return;
    const ex      = d.ejercicios?.[d.indicePregunta];
    const resps   = d.respuestasRonda || {};
    const updates = {};
    Object.keys(d.jugadores || {}).forEach(uid => {
      const resp = resps[uid];
      if (!resp || resp.processed) return;
      const ratio = resp.ratio ?? 0;
      const tt  = (ex?.tiempo || 0) > 0 ? ex.tiempo : 30;
      const tr  = (Date.now() - (d.questionStartTime || Date.now())) / 1000;
      const pts = ratio > 0 ? Math.round((50 + 50 * Math.max(0, Math.min(1, (tt - tr) / tt))) * ratio) : 0;
      updates[`respuestasRonda.${uid}.puntosGanados`] = pts;
      updates[`respuestasRonda.${uid}.processed`]     = true;
      if (pts > 0 && d.jugadores?.[uid]) updates[`jugadores.${uid}.puntos`] = increment(pts);
    });
    const ac  = Object.values(resps).filter(r => (r.ratio || 0) > 0).length;
    const tot = Object.keys(d.jugadores || {}).length;
    setStats({ aciertos:ac, total:tot, pct: tot > 0 ? Math.round(ac / tot * 100) : 0 });
    if (Object.keys(updates).length) await updateDoc(doc(db, 'live_games', codigoSala), updates);
    await updateDoc(doc(db, 'live_games', codigoSala), { fasePregunta:'REVEAL' });
    setTimeout(() => updateDoc(doc(db, 'live_games', codigoSala), { fasePregunta:'LEADERBOARD' }), 4000);
  };

  const siguientePregunta = async () => {
    const d    = gdRef.current || gameData;
    const next = (d.indicePregunta || 0) + 1;
    if (next < d.ejercicios.length) {
      await updateDoc(doc(db, 'live_games', codigoSala), { indicePregunta:next, respuestasRonda:{}, fasePregunta:'RESPONDING', questionStartTime:Date.now() });
    } else {
      await updateDoc(doc(db, 'live_games', codigoSala), { estado:'FIN' });
    }
  };

  const empezar = async () => {
    const resetPts = {};
    Object.keys(gameData?.jugadores || {}).forEach(uid => { resetPts[`jugadores.${uid}.puntos`] = 0; });
    await updateDoc(doc(db, 'live_games', codigoSala), { estado:'COUNTDOWN', ...resetPts });
  };

  const finCuentaAtras = async () => {
    await updateDoc(doc(db, 'live_games', codigoSala), { estado:'JUEGO', indicePregunta:0, respuestasRonda:{}, fasePregunta:'RESPONDING', questionStartTime:Date.now() });
  };

  if (fase === 'CREATING') return <div style={sLive.wrap}><div style={{ color:'white', margin:'auto', fontSize:18 }}>Creando sala...</div></div>;
  if (fase === 'COUNTDOWN') return <PantallaCuentaAtras onFinished={finCuentaAtras} />;

  const ex      = gameData?.ejercicios?.[gameData?.indicePregunta];
  const exTiempo = (ex?.tiempo || 0) > 0 ? ex.tiempo : 30;
  const sorted  = [...jugadores].sort((a, b) => (b.puntos || 0) - (a.puntos || 0));
  const nResp   = Object.keys(gameData?.respuestasRonda || {}).length;
  const isLast  = (gameData?.indicePregunta || 0) >= (gameData?.ejercicios?.length || 1) - 1;
  const piImg   = stats.pct >= 60 ? piHappy : (stats.total > 0 && stats.pct < 30) ? piAngry : piNeutral;
  const timerPct = Math.round(timer / exTiempo * 100);

  return (
    <div style={sLive.wrap}>
      <div style={sLive.hud}>
        <button onClick={onExit} style={sLive.btnExit}>✕ Salir</button>
        <div style={sLive.code}>SALA: <strong>{codigoSala}</strong></div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {fase === 'JUEGO' && <span style={sLive.qCounter}>Ej. {(gameData?.indicePregunta || 0) + 1}/{gameData?.ejercicios?.length}</span>}
          <span style={sLive.players}>👥 {jugadores.length}</span>
        </div>
      </div>

      {fase === 'JUEGO' && (
        <div style={{ textAlign:'center', paddingTop:6 }}>
          <img src={piImg} alt="Pi" style={{ width:60, height:60, objectFit:'contain' }} />
          {stats.total > 0 && <div style={{ color:'#f1c40f', fontWeight:700, fontSize:13 }}>{stats.pct}% correctas</div>}
        </div>
      )}

      <div style={sLive.area}>
        {/* LOBBY */}
        {fase === 'LOBBY' && (
          <div style={sLive.lobby}>
            <div style={{ fontSize:'2.5rem' }}>📚</div>
            <h1 style={{ color:'white', margin:'6px 0 4px', fontSize:'1.4rem' }}>{gameData?.recursoTitulo}</h1>
            <div style={{ color:'#f1c40f', fontSize:'2.8rem', fontWeight:900, letterSpacing:6, margin:'8px 0' }}>{codigoSala}</div>
            <p style={{ color:'rgba(255,255,255,0.65)', fontSize:'0.85rem', margin:'0 0 14px' }}>{gameData?.ejercicios?.length} ejercicios · comparte el código con tus alumnos</p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center', marginBottom:20, maxWidth:400 }}>
              {jugadores.map((j, i) => <div key={i} style={sLive.chip}>{j.nombre}</div>)}
            </div>
            <button onClick={empezar} disabled={jugadores.length === 0} style={{ ...sLive.btnStart, opacity:jugadores.length === 0 ? 0.45 : 1 }}>▶ EMPEZAR</button>
          </div>
        )}

        {/* JUEGO */}
        {fase === 'JUEGO' && ex && (
          <div style={{ width:'100%', maxWidth:640, display:'flex', flexDirection:'column', gap:12 }}>
            {subFase === 'RESPONDING' && (
              <div style={sLive.questionCard}>
                <div style={{ color:'rgba(255,255,255,0.6)', fontSize:12, marginBottom:6 }}>Ejercicio {(gameData?.indicePregunta || 0) + 1}</div>
                <div style={{ fontWeight:800, fontSize:'1.15rem', color:'white', marginBottom:4 }}>{ex.titulo}</div>
                <div style={{ color:'rgba(255,255,255,0.8)', fontSize:14, marginBottom:14 }}>{ex.enunciado}</div>
                <div style={{ height:8, background:'rgba(255,255,255,0.15)', borderRadius:4, overflow:'hidden', marginBottom:10 }}>
                  <div style={{ width:`${timerPct}%`, height:'100%', background:timerPct > 50 ? '#10B981' : timerPct > 20 ? '#F59E0B' : '#EF4444', transition:'width 0.5s' }} />
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
                  <div style={{ color:'#f1c40f', fontWeight:900, fontSize:'1.6rem' }}>{timer}s</div>
                  <div style={{ color:'rgba(255,255,255,0.65)', fontSize:13 }}>{nResp}/{jugadores.length} respondidos</div>
                  <button onClick={() => revelar(gdRef.current || gameData)} style={sLive.btnForce}>⏹ Revelar</button>
                </div>
              </div>
            )}
            {subFase === 'REVEAL' && (
              <div style={{ ...sLive.revealCard, textAlign:'center' }}>
                <div style={{ color:'rgba(255,255,255,0.65)', fontSize:13, marginBottom:8 }}>Ejercicio {(gameData?.indicePregunta || 0) + 1} — Resultado</div>
                <div style={{ fontWeight:800, color:'white', fontSize:'1.05rem', marginBottom:12 }}>{ex.titulo}</div>
                <div style={{ color:'#f1c40f', fontSize:'1.4rem', fontWeight:700 }}>{stats.aciertos}/{stats.total} correctas ({stats.pct}%)</div>
              </div>
            )}
            {subFase === 'LEADERBOARD' && (
              <div style={sLive.leaderboard}>
                <h2 style={{ color:'white', margin:'0 0 14px', textAlign:'center' }}>🏆 Clasificación</h2>
                {sorted.slice(0, 10).map((j, i) => (
                  <div key={j.uid || i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 14px', borderRadius:10, marginBottom:6, background:i===0?'rgba(241,196,15,0.25)':i===1?'rgba(189,195,199,0.2)':i===2?'rgba(205,127,50,0.2)':'rgba(255,255,255,0.07)' }}>
                    <span style={{ fontWeight:700, color:'#f1c40f', minWidth:24 }}>{i + 1}.</span>
                    <span style={{ flex:1, color:'white' }}>{j.nombre}</span>
                    <span style={{ fontWeight:700, color:'#2ecc71' }}>{j.puntos || 0} pts</span>
                  </div>
                ))}
                <button onClick={siguientePregunta} style={sLive.btnNext}>{isLast ? '🏆 Podio Final' : 'Siguiente →'}</button>
              </div>
            )}
          </div>
        )}

        {/* FIN */}
        {fase === 'FIN' && (
          <div style={{ width:'100%', maxWidth:480 }}>
            <h1 style={{ color:'#f1c40f', textAlign:'center', margin:'0 0 20px' }}>🏆 PODIO FINAL 🏆</h1>
            {sorted.map((j, i) => (
              <div key={j.uid || i} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', borderRadius:10, marginBottom:6, background:i===0?'rgba(241,196,15,0.25)':i===1?'rgba(189,195,199,0.2)':i===2?'rgba(205,127,50,0.2)':'rgba(255,255,255,0.07)' }}>
                <span style={{ fontSize:'1.2rem' }}>{['🥇','🥈','🥉'][i] || `${i+1}.`}</span>
                <span style={{ flex:1, color:'white', fontWeight:600 }}>{j.nombre}</span>
                <span style={{ color:'#2ecc71', fontWeight:700 }}>{j.puntos || 0} pts</span>
              </div>
            ))}
            <button onClick={onExit} style={{ width:'100%', marginTop:16, padding:'12px', borderRadius:12, border:'none', background:'#e74c3c', color:'white', fontWeight:700, cursor:'pointer', fontFamily:'inherit', fontSize:15 }}>Cerrar Sala</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Live client ───────────────────────────────────────────────────────────────
function OmniLiveClient({ codigoSala, nombreInicial, onExit }) {
  const [gameData,   setGameData]   = useState(null);
  const [fase,       setFase]       = useState('LOBBY');
  const [subFase,    setSubFase]    = useState('RESPONDING');
  const [puntos,     setPuntos]     = useState(0);
  const [myResult,   setMyResult]   = useState(null);
  const [myRank,     setMyRank]     = useState(null);
  const [forceCheck, setForceCheck] = useState(null);
  const joiningRef = useRef(false);
  const myUid  = useRef('guest_' + Math.random().toString(36).slice(2, 9)).current;
  const myName = nombreInicial || 'Alumno';

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'live_games', codigoSala), async snap => {
      if (!snap.exists()) { alert('La sala se ha cerrado.'); onExit(); return; }
      const data = snap.data();
      setGameData(data);
      const estado = data.estado || 'LOBBY';
      setFase(estado);
      setSubFase(data.fasePregunta || 'RESPONDING');
      const jugs = data.jugadores || {};
      if (!jugs[myUid] && !joiningRef.current && (estado === 'LOBBY' || estado === 'COUNTDOWN')) {
        joiningRef.current = true;
        try { await updateDoc(doc(db, 'live_games', codigoSala), { [`jugadores.${myUid}`]: { uid:myUid, nombre:myName, puntos:0 } }); }
        catch (e) { console.warn(e); }
        joiningRef.current = false;
      }
      if (jugs[myUid]) setPuntos(jugs[myUid].puntos || 0);
      setMyResult(data.respuestasRonda?.[myUid] || null);
      if (data.forceCheck) setForceCheck(data.forceCheck);
      if (estado === 'FIN') {
        const s = Object.values(jugs).sort((a, b) => (b.puntos || 0) - (a.puntos || 0));
        setMyRank(s.findIndex(j => j.uid === myUid) + 1);
      }
    });
    return () => unsub();
  }, [codigoSala]);

  if (!gameData) return <div style={{ ...sLive.wrap, justifyContent:'center', alignItems:'center' }}><div style={{ color:'white' }}>Conectando...</div></div>;
  if (fase === 'COUNTDOWN') return <PantallaCuentaAtras onFinished={() => {}} />;

  const ex = gameData.ejercicios?.[gameData.indicePregunta];

  const submitAnswer = async (ratio) => {
    await updateDoc(doc(db, 'live_games', codigoSala), {
      [`respuestasRonda.${myUid}`]: { uid:myUid, ratio, correct:ratio > 0, puntosGanados:0, processed:false },
    });
  };

  return (
    <div style={sLive.wrap}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 16px', background:'rgba(0,0,0,0.25)', flexShrink:0 }}>
        <button onClick={onExit} style={sLive.btnExit}>✕</button>
        <div style={{ color:'#f1c40f', fontWeight:800, fontSize:16 }}>{puntos} pts</div>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'12px 16px 32px' }}>
        {fase === 'LOBBY' && (
          <div style={{ textAlign:'center', paddingTop:50 }}>
            <div style={{ fontSize:'3rem', marginBottom:12 }}>📚</div>
            <h2 style={{ color:'white', margin:'0 0 8px' }}>¡Hola, {myName}!</h2>
            <p style={{ color:'rgba(255,255,255,0.65)' }}>Esperando al profesor...</p>
          </div>
        )}
        {fase === 'JUEGO' && ex && (
          <OmniClientExercise
            key={gameData.indicePregunta}
            ex={ex}
            startTime={gameData.questionStartTime}
            subFase={subFase}
            myResult={myResult}
            forceCheck={forceCheck}
            onSubmit={submitAnswer}
          />
        )}
        {fase === 'FIN' && (
          <div style={{ textAlign:'center', paddingTop:40 }}>
            <img src={myRank <= 3 ? piHappy : piNeutral} alt="Pi" style={{ width:80, objectFit:'contain', marginBottom:12 }} />
            <h1 style={{ color:'#f1c40f', margin:'0 0 8px' }}>¡FIN!</h1>
            <p style={{ color:'white', fontSize:'1.1rem', margin:'0 0 4px' }}>{myName}</p>
            <p style={{ color:'#f1c40f', fontSize:'2.5rem', fontWeight:900, margin:'0 0 4px' }}>{myRank}ª posición</p>
            <p style={{ color:'#2ecc71', fontSize:'1.3rem', margin:'0 0 20px' }}>{puntos} pts</p>
            <button onClick={onExit} style={{ padding:'12px 28px', borderRadius:12, border:'none', background:'#e74c3c', color:'white', fontWeight:700, cursor:'pointer', fontFamily:'inherit', fontSize:15 }}>Salir al Menú</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Client exercise component ─────────────────────────────────────────────────
function OmniClientExercise({ ex, startTime, subFase, myResult, forceCheck, onSubmit }) {
  const [answers,   setAnswers]   = useState({});
  const [submitted, setSubmitted] = useState(false);
  const submitRef = useRef(false);

  const doSubmit = () => {
    if (submitRef.current) return;
    submitRef.current = true;
    setSubmitted(true);
    const s = calcScore(ex, answers);
    const ratio = s.t > 0 ? s.c / s.t : 0;
    if (ratio > 0) playAudio(audioCorrect); else playAudio(audioWrong);
    onSubmit(ratio);
  };

  useEffect(() => {
    if (forceCheck && !submitRef.current) doSubmit();
  }, [forceCheck]);

  const setAns  = (key, val) => setAnswers(p => ({ ...p, [key]: val }));
  const score   = submitted ? calcScore(ex, answers) : null;
  const pct     = score ? Math.round(score.c / score.t * 100) : 0;
  const scol    = !score ? '#6D28D9' : pct === 100 ? '#059669' : pct >= 60 ? '#D97706' : '#DC2626';
  const info    = TIPO_INFO[ex.tipo] || {};
  const sRatio  = myResult?.ratio ?? null;

  return (
    <div style={{ background:'rgba(255,255,255,0.08)', borderRadius:16, overflow:'hidden' }}>
      <div style={{ background:'rgba(255,255,255,0.1)', padding:'14px 18px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
          <span style={{ fontWeight:800, color:'white', fontSize:15 }}>{ex.titulo}</span>
          <span style={{ padding:'2px 10px', borderRadius:20, background:`${info.color || '#6D28D9'}30`, color:info.color || '#a78bfa', fontSize:10, fontWeight:700, textTransform:'uppercase' }}>{info.label}</span>
        </div>
        <p style={{ margin:0, color:'rgba(255,255,255,0.8)', fontSize:13 }}>{ex.enunciado}</p>
        {subFase === 'RESPONDING' && !submitted && (ex.tiempo || 0) > 0 && startTime && (
          <TimerBar tiempo={ex.tiempo} startTime={startTime} onTimeUp={doSubmit} />
        )}
      </div>
      <div style={{ padding:'16px 18px' }}>
        {(subFase === 'RESPONDING' || !submitted) && (
          <>
            <ExRenderer ex={ex} ans={answers} setAns={setAns} checked={submitted} />
            {!submitted ? (
              <button onClick={doSubmit} style={{ width:'100%', marginTop:14, padding:'12px', borderRadius:10, border:'none', background:'#6D28D9', color:'white', fontWeight:700, cursor:'pointer', fontFamily:'inherit', fontSize:14 }}>Enviar ✓</button>
            ) : (
              <div style={{ marginTop:12, textAlign:'center', color:'rgba(255,255,255,0.65)', fontSize:13 }}>Esperando resultado...</div>
            )}
          </>
        )}
        {subFase === 'REVEAL' && (
          <div style={{ textAlign:'center', padding:'16px 0' }}>
            <div style={{ fontSize:40, marginBottom:8 }}>
              {sRatio !== null ? (sRatio === 1 ? '🎉' : sRatio > 0 ? '👍' : '❌') : (score?.c > 0 ? '👍' : '❌')}
            </div>
            {score && <div style={{ fontSize:22, fontWeight:900, color:scol }}>{score.c}/{score.t} · {pct}%</div>}
            <div style={{ color:'rgba(255,255,255,0.6)', marginTop:6, fontSize:13 }}>Mirando clasificación...</div>
          </div>
        )}
        {subFase === 'LEADERBOARD' && (
          <div style={{ textAlign:'center', padding:'14px 0', color:'rgba(255,255,255,0.6)', fontSize:13 }}>Clasificación en pantalla del profesor</div>
        )}
      </div>
    </div>
  );
}

// ── Live mode styles ──────────────────────────────────────────────────────────
const sLive = {
  wrap:         { display:'flex', flexDirection:'column', minHeight:'100dvh', background:'linear-gradient(160deg,#1a1a2e,#16213e,#0f3460)', fontFamily:'inherit' },
  hud:          { display:'flex', alignItems:'center', gap:12, padding:'10px 16px', background:'rgba(0,0,0,0.3)', flexShrink:0 },
  btnExit:      { background:'rgba(231,76,60,0.8)', color:'white', border:'none', borderRadius:8, padding:'6px 12px', cursor:'pointer', fontWeight:700, fontFamily:'inherit', fontSize:13 },
  code:         { color:'rgba(255,255,255,0.65)', fontSize:14 },
  qCounter:     { color:'#f1c40f', fontWeight:700, fontSize:14 },
  players:      { color:'rgba(255,255,255,0.75)', fontSize:14 },
  area:         { flex:1, display:'flex', justifyContent:'center', alignItems:'center', padding:'16px', overflowY:'auto' },
  lobby:        { display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', maxWidth:480, width:'100%' },
  chip:         { background:'rgba(255,255,255,0.14)', color:'white', padding:'5px 14px', borderRadius:20, fontSize:13, fontWeight:600 },
  btnStart:     { marginTop:8, padding:'14px 36px', borderRadius:14, border:'none', background:'linear-gradient(135deg,#f1c40f,#e67e22)', color:'#1a1a2e', fontWeight:900, fontSize:18, cursor:'pointer', fontFamily:'inherit' },
  questionCard: { background:'rgba(255,255,255,0.07)', borderRadius:16, padding:'20px', border:'1px solid rgba(255,255,255,0.12)', width:'100%' },
  revealCard:   { background:'rgba(255,255,255,0.07)', borderRadius:16, padding:'24px', textAlign:'center', border:'1px solid rgba(255,255,255,0.12)', width:'100%' },
  leaderboard:  { background:'rgba(255,255,255,0.07)', borderRadius:16, padding:'20px', border:'1px solid rgba(255,255,255,0.12)', width:'100%' },
  btnForce:     { padding:'7px 14px', borderRadius:8, border:'1px solid rgba(255,255,255,0.3)', background:'transparent', color:'white', cursor:'pointer', fontFamily:'inherit', fontSize:13 },
  btnNext:      { width:'100%', marginTop:14, padding:'12px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#f1c40f,#e67e22)', color:'#1a1a2e', fontWeight:800, cursor:'pointer', fontFamily:'inherit', fontSize:15 },
};

// ── Browse Screen ─────────────────────────────────────────────────────────────
function BrowseScreen({ onSelect, onBack, onLiveHost, onLiveJoin }) {
  const [query,    setQuery]    = useState('');
  const [nivel,    setNivel]    = useState('');
  const [tema,     setTema]     = useState('');
  const [showLive, setShowLive] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');

  const niveles = [...new Set(BIBLIOTECA.map(r => r.nivel))].sort();
  const temas   = [...new Set(BIBLIOTECA.map(r => r.tema))].sort();

  const filtered = useMemo(() => BIBLIOTECA.filter(r => {
    if (nivel && r.nivel !== nivel) return false;
    if (tema  && r.tema  !== tema)  return false;
    if (query) {
      const q = query.toLowerCase();
      return r.titulo.toLowerCase().includes(q) || r.descripcion.toLowerCase().includes(q) || (r.tags || []).some(t => t.toLowerCase().includes(q));
    }
    return true;
  }), [query, nivel, tema]);

  return (
    <div style={{ minHeight:'100vh', background:'#F0F4FF', fontFamily:'inherit' }}>
      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#4338CA,#6D28D9)', padding:'16px', color:'white' }}>
        <div style={{ maxWidth:860, margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
            <button onClick={onBack} style={{ border:'none', background:'rgba(255,255,255,0.2)', borderRadius:8, cursor:'pointer', fontSize:18, padding:'4px 10px', color:'white', flexShrink:0 }}>←</button>
            <div>
              <div style={{ fontSize:20, fontWeight:800, letterSpacing:'-0.5px' }}>Omninteractive</div>
              <div style={{ fontSize:12, opacity:0.75 }}>Interactive exercises · pikt.es</div>
            </div>
          </div>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search resources…"
            style={{ display:'block', width:'100%', boxSizing:'border-box', height:42, padding:'0 16px', borderRadius:12, border:'none', outline:'none', fontSize:14, fontFamily:'inherit', background:'rgba(255,255,255,0.95)', color:'#0F172A', boxShadow:'0 2px 12px rgba(0,0,0,0.15)' }} />
        </div>
      </div>

      {/* Live mode bar */}
      {(onLiveHost || onLiveJoin) && (
        <div style={{ background:'white', borderBottom:'1px solid #E2E8F0', padding:'10px 16px' }}>
          <div style={{ maxWidth:860, margin:'0 auto' }}>
            {!showLive ? (
              <button onClick={() => setShowLive(true)} style={{ background:'linear-gradient(135deg,#6D28D9,#4338CA)', color:'white', border:'none', borderRadius:10, padding:'8px 18px', fontWeight:700, cursor:'pointer', fontFamily:'inherit', fontSize:13 }}>
                🎮 Modo Online
              </button>
            ) : (
              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <button onClick={onLiveHost} style={{ padding:'8px 14px', borderRadius:10, border:'none', background:'#059669', color:'white', fontWeight:700, cursor:'pointer', fontFamily:'inherit', fontSize:13 }}>👨‍🏫 Crear sala</button>
                <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="CÓDIGO" maxLength={6}
                  style={{ width:84, padding:'8px 10px', borderRadius:8, border:'1px solid #E2E8F0', textTransform:'uppercase', fontWeight:700, letterSpacing:2, fontFamily:'inherit', outline:'none', fontSize:13, boxSizing:'border-box' }} />
                <input value={joinName} onChange={e => setJoinName(e.target.value)} placeholder="Tu nombre"
                  style={{ flex:1, minWidth:100, maxWidth:160, padding:'8px 10px', borderRadius:8, border:'1px solid #E2E8F0', fontFamily:'inherit', outline:'none', fontSize:13, boxSizing:'border-box' }} />
                <button onClick={() => { if (joinCode.trim() && joinName.trim()) onLiveJoin(joinCode.trim(), joinName.trim()); }}
                  style={{ padding:'8px 14px', borderRadius:10, border:'none', background:'#6D28D9', color:'white', fontWeight:700, cursor:'pointer', fontFamily:'inherit', fontSize:13 }}>Unirse →</button>
                <button onClick={() => setShowLive(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#94A3B8', fontSize:18, padding:'0 4px' }}>✕</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ background:'white', borderBottom:'1px solid #E2E8F0', padding:'10px 16px' }}>
        <div style={{ maxWidth:860, margin:'0 auto', display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
          <span style={{ fontSize:12, color:'#94A3B8', marginRight:2 }}>Level:</span>
          {['', ...niveles].map(n => (
            <button key={n} onClick={() => setNivel(n)} style={{ padding:'3px 10px', borderRadius:20, border:`1.5px solid ${nivel === n ? '#4338CA' : '#E2E8F0'}`, background:nivel === n ? '#EEF2FF' : 'transparent', color:nivel === n ? '#4338CA' : '#6B7280', fontFamily:'inherit', fontSize:12, cursor:'pointer', fontWeight:nivel === n ? 600 : 400 }}>{n || 'All'}</button>
          ))}
          <span style={{ fontSize:12, color:'#94A3B8', marginLeft:6, marginRight:2 }}>Topic:</span>
          {['', ...temas].map(t => (
            <button key={t} onClick={() => setTema(t)} style={{ padding:'3px 10px', borderRadius:20, border:`1.5px solid ${tema === t ? '#4338CA' : '#E2E8F0'}`, background:tema === t ? '#EEF2FF' : 'transparent', color:tema === t ? '#4338CA' : '#6B7280', fontFamily:'inherit', fontSize:12, cursor:'pointer', fontWeight:tema === t ? 600 : 400 }}>{t || 'All'}</button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={{ maxWidth:860, margin:'20px auto', padding:'0 16px 40px', display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:14 }}>
        {filtered.length === 0 && <div style={{ gridColumn:'1/-1', textAlign:'center', padding:60, color:'#94A3B8' }}>No resources found.</div>}
        {filtered.map(recurso => {
          const tipos = [...new Set(recurso.ejercicios.map(e => e.tipo))];
          return (
            <div key={recurso.id} onClick={() => onSelect(recurso)}
              style={{ background:'white', borderRadius:16, border:'1px solid #E2E8F0', borderLeft:`5px solid ${recurso.color}`, overflow:'hidden', cursor:'pointer', boxShadow:'0 1px 6px rgba(0,0,0,0.06)', transition:'transform 0.15s,box-shadow 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 6px rgba(0,0,0,0.06)'; }}
            >
              <div style={{ padding:'18px 18px 14px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                  <span style={{ padding:'2px 10px', borderRadius:20, background:`${recurso.color}18`, color:recurso.color, fontSize:11, fontWeight:700 }}>{recurso.nivel}</span>
                  <span style={{ fontSize:11, color:'#94A3B8' }}>{recurso.ejercicios.length} exercises</span>
                </div>
                <h3 style={{ margin:'0 0 6px', fontSize:16, fontWeight:700, color:'#0F172A', lineHeight:1.3 }}>{recurso.titulo}</h3>
                <p style={{ margin:'0 0 10px', fontSize:12, color:'#64748B', lineHeight:1.5 }}>{recurso.descripcion}</p>
                <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                  {tipos.map(t => { const ti = TIPO_INFO[t] || {}; return <span key={t} style={{ padding:'2px 8px', borderRadius:6, background:`${ti.color}12`, color:ti.color, fontSize:10, fontWeight:600, textTransform:'uppercase' }}>{ti.label}</span>; })}
                </div>
              </div>
              <div style={{ padding:'10px 18px', borderTop:'1px solid #F1F5F9', background:'#FAFAFA', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:12, color:'#64748B' }}>{recurso.asignatura} · {recurso.tema}</span>
                <span style={{ fontSize:13, color:recurso.color, fontWeight:600 }}>Open →</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function OmninteractiveApp({ onBack = () => {}, recursoDirecto = null }) {
  const [screen,   setScreen]   = useState(recursoDirecto ? 'play' : 'browse');
  const [recurso,  setRecurso]  = useState(recursoDirecto);
  const [liveMode, setLiveMode] = useState(null); // null | {role:'host',codigoSala} | {role:'client',codigoSala,nombre}

  // Live host: needs resource selection first
  if (liveMode?.role === 'host' && !recurso) {
    return <BrowseScreen onSelect={r => setRecurso(r)} onBack={() => setLiveMode(null)} />;
  }
  if (liveMode?.role === 'host' && recurso) {
    return <OmniLiveHost recurso={recurso} codigoSala={liveMode.codigoSala} onExit={() => { setLiveMode(null); setRecurso(null); setScreen('browse'); }} />;
  }
  if (liveMode?.role === 'client') {
    return <OmniLiveClient codigoSala={liveMode.codigoSala} nombreInicial={liveMode.nombre} onExit={() => setLiveMode(null)} />;
  }
  if (screen === 'play' && recurso) {
    return <PlayScreen recurso={recurso} onBack={() => { if (recursoDirecto) onBack(); else setScreen('browse'); }} />;
  }
  return (
    <BrowseScreen
      onSelect={r => { setRecurso(r); setScreen('play'); }}
      onBack={onBack}
      onLiveHost={() => { setRecurso(null); setLiveMode({ role:'host', codigoSala:genCode() }); }}
      onLiveJoin={(code, nombre) => setLiveMode({ role:'client', codigoSala:code, nombre })}
    />
  );
}

