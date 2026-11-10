// Ficha imprimible de un recurso Omni (hoja interactiva) → ventana de impresión / «Guardar como PDF».
//   imprimirOmni(recurso, { soluciones, numeroExamen })
// HTML + KaTeX para que las fórmulas salgan igual que en la hoja interactiva.
import katex from 'katex';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Texto con $latex$ → HTML
function tx(s) {
  const t = String(s ?? '');
  let out = '', last = 0, m;
  const re = /\$([^$]+)\$/g;
  while ((m = re.exec(t)) !== null) {
    out += esc(t.slice(last, m.index));
    try { out += katex.renderToString(m[1], { throwOnError: false }); } catch { out += esc(m[1]); }
    last = m.index + m[0].length;
  }
  return out + esc(t.slice(last));
}

// Barajado estable (mismo orden en cada impresión)
function barajarFijo(lista, semilla) {
  let s = [...String(semilla)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const r = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const altsDe = (a) => (Array.isArray(a) ? a : [a]).flatMap(x => Array.isArray(x) ? x : String(x ?? '').split('|')).map(s => s.trim()).filter(Boolean);
const hueco = (sol, sols, ancho = 90) => sols && sol
  ? `<span class="sol">${tx(sol)}</span>`
  : `<span class="hueco" style="min-width:${ancho}px"></span>`;
const lbl = (it) => `<span class="lbl">${esc(it.lbl || '')}</span>`;

function cuerpoEjercicio(ex, sols) {
  const items = ex.items || [];
  switch (ex.tipo) {
    case 'fill':
    case 'wordbank': {
      const banco = ex.tipo === 'wordbank' && ex.wordbank?.length
        ? `<div class="banco">${ex.wordbank.map(w => `<span>${tx(w)}</span>`).join('')}</div>` : '';
      return banco + items.map(it => {
        const parts = it.parts || [''];
        const ans = Array.isArray(it.ans) ? it.ans : [it.ans];
        const html = parts.map((p, i) => tx(p) + (i < parts.length - 1 ? ' ' + hueco(ans[i], sols) + ' ' : '')).join('');
        return `<div class="item">${lbl(it)}<div>${html}${it.hint ? ` <i class="pista">${tx(it.hint)}</i>` : ''}</div></div>`;
      }).join('');
    }
    case 'choice':
      return items.map(it => `<div class="item">${lbl(it)}<div>${tx(it.parts?.[0])} <span class="opcs">(${(it.opts || []).map(o =>
        sols && o === it.ans ? `<b class="sol">${tx(o)}</b>` : tx(o)).join(' / ')})</span> ${tx(it.parts?.[1])}</div></div>`).join('');
    case 'multichoice':
      return items.map(it => `<div class="item">${lbl(it)}<div>${tx(it.question)}<div class="mc">${(it.opts || []).map((o, j) =>
        `<span class="${sols && o === it.ans ? 'sol' : ''}">${sols && o === it.ans ? '☒' : '☐'} ${'abcd'[j] || j + 1}) ${tx(o)}</span>`).join('')}</div></div></div>`).join('');
    case 'truefalse':
      return `<table class="tabla">${items.map(it => `<tr><td class="lblc">${esc(it.lbl)}</td><td>${tx(it.statement)}</td>
        <td class="vf">${sols ? `<b class="sol">${it.ans === 'true' ? 'V' : 'F'}</b>` : 'V ☐ &nbsp; F ☐'}</td></tr>`).join('')}</table>`;
    case 'match': {
      const der = barajarFijo(items.map((it, k) => ({ txt: it.right, k })), ex.id);
      const letra = (k) => String.fromCharCode(97 + der.findIndex(d => d.k === k));
      const filas = Math.max(items.length, der.length);
      let h = '<table class="unir">';
      for (let i = 0; i < filas; i++) {
        const it = items[i];
        h += `<tr><td>${it ? `<b>${i + 1}.</b> ${tx(it.left)}` : ''}</td><td class="pto">•</td><td class="pto">•</td>
          <td>${der[i] ? `<b>${String.fromCharCode(97 + i)})</b> ${tx(der[i].txt)}` : ''}</td></tr>`;
      }
      h += '</table><div class="resp-unir">' + items.map((it, k) => `${k + 1} – ${sols ? `<b class="sol">${letra(k)}</b>` : '<span class="hueco" style="min-width:26px"></span>'}`).join('&nbsp;&nbsp;&nbsp;') + '</div>';
      return h;
    }
    case 'order':
      return items.map(it => `<div class="item">${lbl(it)}<div><div class="fichas">${(it.shuffled || []).map(w => `<span>${tx(w)}</span>`).join('')}</div>
        ${sols ? `<div class="sol">${tx(it.answer)}</div>` : '<div class="linea"></div>'}</div></div>`).join('');
    case 'error':
      return items.map(it => `<div class="item">${lbl(it)}<div>${tx(it.sentence)}<div class="sub">Error: ${hueco(it.errorWord, sols, 110)} &nbsp; Corrección: ${hueco(it.correction, sols, 130)}</div></div></div>`).join('');
    case 'construct':
      return items.map(it => `<div class="item">${lbl(it)}<div><span class="prompt">${tx(it.prompt)}</span>
        ${sols ? `<div class="sol">${tx(it.ans)}</div>` : '<div class="linea"></div>'}</div></div>`).join('');
    case 'short':
      return items.map(it => `<div class="item">${lbl(it)}<div>${tx(it.question)} &nbsp; ${hueco(sols ? [it.ans, ...altsDe(it.alts)].filter(Boolean)[0] : '', sols, 140)}</div></div>`).join('');
    case 'expr':
      return items.map(it => `<div class="item">${lbl(it)}<div style="flex:1">${tx(it.question)}
        ${sols ? `<div class="sol">${tx(it.ans)}${it.modo === 'constante' ? ' + C' : ''}</div>` : '<div class="linea"></div><div class="linea"></div>'}</div></div>`).join('');
    case 'matrix':
      return items.map(it => {
        const f = it.filas || 1, c = it.cols || 1, cel = it.celdas || [];
        const filasHtml = Array.from({ length: f }, (_, r) => `<tr>${Array.from({ length: c }, (_, k) =>
          `<td>${sols ? `<span class="sol">${tx(cel[r * c + k] || '')}</span>` : ''}</td>`).join('')}</tr>`).join('');
        const tipo = it.corchetes || 'pmatrix';
        return `<div class="item">${lbl(it)}<div>${tx(it.question)} <span class="mat-eq">=</span>
          <table class="mat mat-${tipo}">${filasHtml}</table></div></div>`;
      }).join('');
    case 'open':
      return items.map(it => `<div class="item">${lbl(it)}<div style="flex:1">${tx(it.question)}
        ${sols ? `<div class="sol caja-sol">${tx(it.ans || '(respuesta abierta)')}</div>` : Array.from({ length: it.lineas || 3 }, () => '<div class="linea"></div>').join('')}</div></div>`).join('');
    default: return '';
  }
}

export function htmlOmni(recurso, { soluciones = false, numeroExamen = true } = {}) {
  const r = recurso || {};
  const ejercicios = (r.ejercicios || []).map((ex, i) => `
    <section class="ej">
      <h2><span class="num">${i + 1}</span>${tx(String(ex.titulo || '').replace(/^\s*\d+\s*[.)-]\s*/, ''))}</h2>
      ${ex.enunciado ? `<p class="enun">${tx(ex.enunciado).replace(/\n/g, '<br>')}</p>` : ''}
      ${ex.imagen ? `<img class="img" src="${esc(ex.imagen)}" alt="">` : ''}
      ${cuerpoEjercicio(ex, soluciones)}
    </section>`).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(r.titulo)}${soluciones ? ' — Soluciones' : ''}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.45/dist/katex.min.css">
<style>
  @page { size: A4; margin: 14mm 14mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; font-size: 12.5pt; line-height: 1.55; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; border-bottom: 2px solid #4c1d95; padding-bottom: 6px; margin-bottom: 14px; }
  header h1 { font-size: 17pt; margin: 0; color: #4c1d95; }
  header .meta { font-size: 9.5pt; color: #555; }
  .nexamen { border: 1.5px solid #333; border-radius: 6px; padding: 4px 10px; font-size: 10pt; white-space: nowrap; }
  .nexamen span { display: inline-block; min-width: 60px; border-bottom: 1px solid #333; }
  .badge-sol { background: #dcfce7; color: #166534; border-radius: 6px; padding: 3px 10px; font-weight: 700; font-size: 10pt; }
  .ej { margin-bottom: 16px; break-inside: avoid-page; }
  .ej h2 { font-size: 12.5pt; margin: 0 0 4px; display: flex; gap: 8px; align-items: baseline; }
  .ej h2 .num { background: #4c1d95; color: white; border-radius: 5px; padding: 0 7px; font-size: 10pt; }
  .enun { margin: 0 0 8px; color: #333; }
  .img { max-width: 100%; max-height: 260px; display: block; margin: 6px 0; }
  .item { display: flex; gap: 8px; margin: 0 0 9px; break-inside: avoid; }
  .lbl { font-weight: 700; min-width: 22px; color: #4c1d95; }
  .hueco { display: inline-block; border-bottom: 1.3px solid #222; height: 1.1em; vertical-align: baseline; }
  .linea { border-bottom: 1px solid #999; height: 1.7em; margin-top: 2px; }
  .pista { color: #555; }
  .banco { border: 1.5px solid #444; border-radius: 6px; padding: 6px 10px; margin: 0 0 10px; display: flex; flex-wrap: wrap; gap: 6px 16px; }
  .fichas { display: flex; flex-wrap: wrap; gap: 6px; }
  .fichas span { border: 1px solid #888; border-radius: 4px; padding: 0 7px; }
  .mc { display: flex; flex-wrap: wrap; gap: 4px 22px; margin-top: 2px; }
  .sub { margin-top: 4px; }
  .prompt { color: #333; font-style: italic; }
  .tabla { border-collapse: collapse; width: 100%; }
  .tabla td { border-bottom: 1px solid #ddd; padding: 4px 6px; vertical-align: top; }
  .tabla .lblc { font-weight: 700; color: #4c1d95; width: 28px; }
  .tabla .vf { white-space: nowrap; width: 100px; text-align: right; }
  .unir { width: 100%; border-collapse: collapse; }
  .unir td { padding: 4px 6px; vertical-align: middle; width: 44%; }
  .unir td.pto { width: 6%; text-align: center; font-size: 14pt; }
  .resp-unir { margin-top: 6px; font-size: 11pt; }
  .sol { color: #15803d; font-weight: 700; }
  .mat { display: inline-table; vertical-align: middle; border-collapse: separate; border-spacing: 6px 4px; margin: 4px 0 4px 6px; padding: 0 4px; }
  .mat td { min-width: 46px; height: 30px; text-align: center; border-bottom: 1px dotted #aaa; }
  .mat-pmatrix { border-left: 2px solid #222; border-right: 2px solid #222; border-radius: 14px; }
  .mat-bmatrix { border-left: 2px solid #222; border-right: 2px solid #222; border-radius: 0; }
  .mat-vmatrix { border-left: 2px solid #222; border-right: 2px solid #222; }
  .mat-eq { margin-left: 4px; }
  .caja-sol { border: 1px dashed #15803d; border-radius: 6px; padding: 4px 8px; margin-top: 4px; font-weight: 500; }
  footer { margin-top: 18px; font-size: 8.5pt; color: #888; text-align: center; }
  @media print { .noprint { display: none; } }
  .noprint { position: fixed; top: 10px; right: 10px; }
  .noprint button { padding: 8px 16px; font-size: 13px; border-radius: 8px; border: none; background: #4c1d95; color: white; cursor: pointer; }
</style></head><body>
<div class="noprint"><button onclick="window.print()">🖨️ Imprimir / Guardar PDF</button></div>
<header>
  <div><h1>${tx(r.titulo)}</h1><div class="meta">${esc([r.asignatura, r.nivel, r.tema].filter(Boolean).join(' · '))}</div></div>
  ${soluciones ? '<div class="badge-sol">SOLUCIONES</div>' : numeroExamen ? '<div class="nexamen">Nº / código: <span></span></div>' : ''}
</header>
${ejercicios}
<footer>Hoja creada con PIKT · pikt.es</footer>
<script>window.addEventListener('load', () => setTimeout(() => window.print(), 600));</script>
</body></html>`;
}

export function imprimirOmni(recurso, opciones) {
  const w = window.open('', '_blank');
  if (!w) { alert('El navegador ha bloqueado la ventana emergente. Permite las ventanas emergentes de pikt.es para imprimir.'); return; }
  w.document.open();
  w.document.write(htmlOmni(recurso, opciones));
  w.document.close();
}
