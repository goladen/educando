import React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
//  Render matemático compartido (app Potencias y Raíces + fichas imprimibles)
//  Notación: FRAC(num,den) · SQRT(x) · ROOT(n,x) · a^{exp} · * → ·
//  Fracción con barra larga y radical con el símbolo estirado a la altura del
//  radicando y el vínculo cubriéndolo entero (también en el PDF, vía html2canvas).
// ─────────────────────────────────────────────────────────────────────────────

// Radical en la notación del render: índice 2 → SQRT, resto → ROOT(n, x)
export const rad = (n, x) => (n === 2 ? `SQRT(${x})` : `ROOT(${n},${x})`);
export const potStr = (a, m) => (m === 1 ? `${a}` : `${a}^{${m}}`);

const findMatch = (s, openIdx) => { let d = 0; for (let i = openIdx; i < s.length; i++) { const c = s[i]; if (c === '(') d++; else if (c === ')') { d--; if (d === 0) return i; } } return -1; };
const splitTopComma = (s) => { let d = 0; for (let i = 0; i < s.length; i++) { const c = s[i]; if (c === '(') d++; else if (c === ')') d--; else if (c === ',' && d === 0) return [s.slice(0, i), s.slice(i + 1)]; } return [s, '']; };

const findBrace = (s, openIdx) => { let d = 0; for (let i = openIdx; i < s.length; i++) { if (s[i] === '{') d++; else if (s[i] === '}') { d--; if (d === 0) return i; } } return s.length - 1; };

const Fraction =({ num, den }) => (
  <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', verticalAlign: 'middle', margin: '0 0.25em', textAlign: 'center', lineHeight: 1.15 }}>
    <span style={{ padding: '0 0.35em 0.1em' }}>{num}</span>
    <span style={{ borderTop: '1.5px solid currentColor', padding: '0.1em 0.35em 0', minWidth: '100%', boxSizing: 'border-box' }}>{den}</span>
  </span>
);

// Radical con símbolo y barra unidos: el SVG se posiciona en absoluto para tomar
// EXACTAMENTE la altura del radicando. Admite índice opcional (ⁿ√).
const Radical = ({ children, index }) => (
  <span style={{ position: 'relative', display: 'inline-block', paddingLeft: index != null ? '1.05em' : '0.72em', margin: '0 0.12em', verticalAlign: 'middle' }}>
    {index != null && (
      <span style={{ position: 'absolute', left: 0, top: '-0.35em', fontSize: '0.6em', fontWeight: 700, lineHeight: 1 }}>{index}</span>
    )}
    <span style={{ position: 'absolute', left: index != null ? '0.32em' : 0, top: 0, bottom: 0, width: '0.68em' }}>
      <svg viewBox="0 0 16 100" preserveAspectRatio="none" width="100%" height="100%" style={{ overflow: 'visible', display: 'block' }} aria-hidden="true">
        <path d="M0,64 L5,54 L9,95 L16,3" fill="none" stroke="currentColor" strokeWidth="1.3" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </span>
    <span style={{ display: 'inline-block', borderTop: '1.4px solid currentColor', padding: '0.14em 0.3em 0 0.06em' }}>{children}</span>
  </span>
);

function renderText(text, isMobile, kp) {
  const sub = String(text).split(/\^([^{}\s()]+|\{[^}]+\})/g);
  return sub.map((sp, j) => {
    if (j % 2 === 1) {
      const exp = sp.startsWith('{') ? sp.slice(1, -1) : sp;
      // superíndice real: pequeño y elevado, pegado a la base (sin saltos de línea)
      return <sup key={`${kp}-s${j}`} style={{ fontSize: '0.68em', lineHeight: 0 }}>{renderNodes(exp, isMobile, `${kp}e${j}`)}</sup>;
    }
    return sp ? <span key={`${kp}-t${j}`} style={{ whiteSpace: 'pre' }}>{sp.replace(/\*/g, '·')}</span> : null;
  });
}

function renderNodes(str, isMobile, kp = 'm') {
  const out = []; let i = 0, buf = '', k = 0;
  const flush = () => { if (buf) { out.push(<React.Fragment key={`${kp}f${k++}`}>{renderText(buf, isMobile, `${kp}${k}`)}</React.Fragment>); buf = ''; } };
  while (i < str.length) {
    // Exponente entre llaves con estructura dentro (p. ej. a^{FRAC(m,n)}): se busca la llave que cierra
    if (str.startsWith('^{', i) && /FRAC\(|SQRT\(|ROOT\(/.test(str.slice(i, findBrace(str, i + 1)))) {
      flush(); const close = findBrace(str, i + 1);
      out.push(<sup key={`${kp}sx${k++}`} style={{ fontSize: '0.62em', lineHeight: 1, verticalAlign: 'baseline', display: 'inline-block', position: 'relative', top: '-0.95em', marginLeft: '-0.1em' }}>{renderNodes(str.slice(i + 2, close), isMobile, `${kp}sx${k}`)}</sup>);
      i = close + 1;
    } else if (str.startsWith('FRAC(', i)) {
      flush(); const close = findMatch(str, i + 4); const inner = str.slice(i + 5, close);
      const [n, d] = splitTopComma(inner);
      out.push(<Fraction key={`${kp}fr${k++}`} num={renderNodes(n, isMobile, `${kp}n${k}`)} den={renderNodes(d, isMobile, `${kp}d${k}`)} />);
      i = close + 1;
    } else if (str.startsWith('SQRT(', i)) {
      flush(); const close = findMatch(str, i + 4); const inner = str.slice(i + 5, close);
      out.push(<Radical key={`${kp}rd${k++}`}>{renderNodes(inner, isMobile, `${kp}r${k}`)}</Radical>);
      i = close + 1;
    } else if (str.startsWith('ROOT(', i)) {
      flush(); const close = findMatch(str, i + 4); const inner = str.slice(i + 5, close);
      const [idx, rad] = splitTopComma(inner);
      out.push(<Radical key={`${kp}rt${k++}`} index={renderNodes(idx, isMobile, `${kp}ix${k}`)}>{renderNodes(rad, isMobile, `${kp}rr${k}`)}</Radical>);
      i = close + 1;
    } else { buf += str[i]; i++; }
  }
  flush();
  return out;
}

export function renderMath(text, isMobile, fontSize) {
  if (text == null) return null;
  return (
    <span style={{ display: 'inline-block', fontFamily: '"Cambria Math", "Times New Roman", Georgia, serif', fontSize: fontSize || (isMobile ? '1.2rem' : '1.4rem'), lineHeight: 1.5, verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
      {renderNodes(String(text), isMobile)}
    </span>
  );
}

