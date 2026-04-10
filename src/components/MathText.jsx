// MathText.jsx — renderiza texto mezclado con LaTeX entre $ $
// Uso: <MathText text="Resuelve $\frac{x}{2}=3$" />
import katex from 'katex';
import 'katex/dist/katex.min.css';

export default function MathText({ text, style }) {
  if (!text) return null;

  // Divide el texto en trozos: texto plano | $math$
  const parts = [];
  let remaining = text;
  const re = /\$([^$]+)\$/g;
  let last = 0;
  let match;

  re.lastIndex = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push({ type: 'text', val: text.slice(last, match.index) });
    parts.push({ type: 'math', val: match[1] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ type: 'text', val: text.slice(last) });

  return (
    <span style={style}>
      {parts.map((p, i) => {
        if (p.type === 'text') return <span key={i}>{p.val}</span>;
        try {
          const html = katex.renderToString(p.val, { throwOnError: false, displayMode: false });
          return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
        } catch {
          return <span key={i} style={{ color: '#DC2626' }}>{p.val}</span>;
        }
      })}
    </span>
  );
}
