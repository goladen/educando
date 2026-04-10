// MathInput.jsx — input de texto con barra de botones para fracciones, potencias y raíces
// El valor siempre es texto plano con $...$ para las mates.
// Uso: <MathInput value={val} onChange={setVal} placeholder="..." />
import { useRef } from 'react';
import MathText from './MathText';

const SNIPPETS = [
  { label: 'a/b',    tip: 'Fracción',       latex: '\\frac{a}{b}',    cur: 6  },
  { label: 'xⁿ',    tip: 'Potencia',        latex: 'x^{n}',           cur: 3  },
  { label: 'x₂',    tip: 'Subíndice',       latex: 'x_{n}',           cur: 3  },
  { label: '√x',    tip: 'Raíz cuadrada',   latex: '\\sqrt{x}',       cur: 6  },
  { label: '∛x',    tip: 'Raíz cúbica',     latex: '\\sqrt[3]{x}',    cur: 9  },
  { label: 'π',     tip: 'Pi',              latex: '\\pi',             cur: 3  },
  { label: '±',     tip: 'Más/menos',       latex: '\\pm',             cur: 3  },
  { label: '≤',     tip: 'Menor o igual',   latex: '\\leq',            cur: 4  },
  { label: '≥',     tip: 'Mayor o igual',   latex: '\\geq',            cur: 4  },
  { label: '≠',     tip: 'Distinto',        latex: '\\neq',            cur: 4  },
  { label: '∞',     tip: 'Infinito',        latex: '\\infty',          cur: 6  },
];

export default function MathInput({ value = '', onChange, placeholder, multiline = false, style }) {
  const ref = useRef(null);

  const insertSnippet = (latex, cursorOffset) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end   = el.selectionEnd;
    const before = value.slice(0, start);
    const after  = value.slice(end);
    // Wrap in $ $ if not already inside math context
    const insert = `$${latex}$`;
    const newVal = before + insert + after;
    onChange(newVal);
    // Restore cursor inside the latex (after opening $ and the offset)
    setTimeout(() => {
      el.focus();
      const pos = start + 1 + cursorOffset; // +1 for opening $
      el.setSelectionRange(pos, pos);
    }, 0);
  };

  const hasPreview = value && value.includes('$');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {SNIPPETS.map(s => (
          <button
            key={s.label}
            type="button"
            title={s.tip}
            onClick={() => insertSnippet(s.latex, s.cur)}
            style={{
              padding: '2px 7px', fontSize: 13, borderRadius: 5,
              border: '1px solid #CBD5E1', background: '#F8FAFC',
              cursor: 'pointer', fontFamily: 'serif', lineHeight: '1.4',
              color: '#1E3A5F',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Input */}
      {multiline ? (
        <textarea
          ref={ref}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid #CBD5E1', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', ...style }}
        />
      ) : (
        <input
          ref={ref}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid #CBD5E1', fontSize: 13, fontFamily: 'inherit', ...style }}
        />
      )}

      {/* Preview en vivo */}
      {hasPreview && (
        <div style={{ padding: '5px 10px', borderRadius: 7, background: '#F0F4FF', border: '1px solid #C7D2FE', fontSize: 14 }}>
          <MathText text={value} />
        </div>
      )}
    </div>
  );
}
