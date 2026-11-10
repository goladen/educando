// Motor de equivalencia de expresiones matemáticas para las hojas interactivas (Omni).
//   cargarMotor()                    → Promise (carga mathjs bajo demanda; solo en hojas con mates)
//   motorListo()                     → bool
//   aExpresion(texto)                → texto calculable por mathjs (desde LaTeX o desde lo que escribe el alumno)
//   equivalentes(alumno, solucion, { modo })  → true | false | null (null = no se ha podido comparar)
//        modo 'equiv'     : misma expresión (3x^2+2x = x(3x+2))
//        modo 'constante' : iguales salvo una constante (integrales indefinidas, «+ C»)
//   aLatex(texto)                    → LaTeX para la vista previa de lo que escribe el alumno
// Sintaxis del alumno: 2x^2-3x+1 · sqrt(x) · cbrt(x) · root[5](x) · log(x) (base 10) · log_2(8) · ln(x)
//   sin cos tan (también sen, tg), arcsin… · pi · e^x · |x| · 3/4 · 0,5 · √ ∛ · × ÷ ² ³
// La comparación es numérica: se evalúan las dos expresiones en varios puntos al azar.

let math = null;
let cargando = null;

export function cargarMotor() {
  if (math) return Promise.resolve(math);
  if (!cargando) cargando = import('mathjs').then(m => { math = m; return m; });
  return cargando;
}
export const motorListo = () => !!math;

// ─────────────────────────────────────────────────────────────
// Utilidades de texto: buscar el grupo {…} / (…) / […] que empieza en i
// ─────────────────────────────────────────────────────────────
const PAR = { '{': '}', '(': ')', '[': ']' };
function grupo(s, i) {
  const abre = s[i], cierra = PAR[abre];
  if (!cierra) return null;
  let n = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === abre) n++;
    else if (s[j] === cierra && --n === 0) return { dentro: s.slice(i + 1, j), fin: j + 1 };
  }
  return null;
}
const saltaEsp = (s, i) => { while (s[i] === ' ') i++; return i; };

// Argumento tras una función: {…}, (…) o el siguiente «átomo» (número, letra, \comando)
function argumento(s, i) {
  i = saltaEsp(s, i);
  if (s[i] === '{' || s[i] === '(') { const g = grupo(s, i); if (g) return g; }
  const m = s.slice(i).match(/^(-?[\d.]+[a-zA-Z]?|\\?[a-zA-Z]+(?:\^\{[^}]*\}|\^[\w.]+)?|[\w.]+)/);
  if (!m) return { dentro: '', fin: i };
  // abs(x), sqrt(x)…: la función se lleva también su paréntesis
  const j = i + m[0].length;
  if (/^\\?[a-zA-Z]+$/.test(m[0]) && s[j] === '(') { const g = grupo(s, j); if (g) return { dentro: s.slice(i, g.fin), fin: g.fin }; }
  return { dentro: m[0], fin: j };
}

// Sustituye \cmd{A}{B}… recorriendo de izquierda a derecha (admite anidados)
function reemplazaComando(s, re, construir) {
  let out = '', i = 0;
  while (i < s.length) {
    re.lastIndex = i;
    const m = re.exec(s);
    if (!m) { out += s.slice(i); break; }
    out += s.slice(i, m.index);
    const r = construir(s, m.index + m[0].length, m);
    if (!r) { out += m[0]; i = m.index + m[0].length; continue; }
    out += r.texto;
    i = r.fin;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// LaTeX / texto del alumno → expresión de mathjs
// ─────────────────────────────────────────────────────────────
const FUNCIONES = new Set(['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'asin', 'acos', 'atan', 'asec', 'acsc', 'acot',
  'sinh', 'cosh', 'tanh', 'sqrt', 'cbrt', 'nthRoot', 'log', 'log10', 'log2', 'abs', 'exp', 'logb', 'nroot']);
const CONSTANTES = new Set(['pi', 'e', 'Infinity', 'i']);
const SINONIMOS = {
  sen: 'sin', tg: 'tan', arcsen: 'asin', arcsin: 'asin', arccos: 'acos', arctg: 'atan', arctan: 'atan', asen: 'asin',
  cosec: 'csc', cotg: 'cot', ctg: 'cot', senh: 'sinh', tgh: 'tanh', raiz: 'sqrt', infty: 'Infinity', infinito: 'Infinity',
};

export function aExpresion(entrada) {
  let s = String(entrada ?? '').trim();
  if (!s) return '';
  s = s.replace(/^\$+|\$+$/g, '').replace(/\$/g, '');
  // «f'(x) = 6x+2», «y = …»: nos quedamos con el lado derecho
  if (s.includes('=') && !/[<>]=?|\\[lg]eq/.test(s)) s = s.slice(s.lastIndexOf('=') + 1);
  s = s
    .replace(/\{,\}/g, '.').replace(/(\d),(\d)/g, '$1.$2')                    // coma decimal
    .replace(/\\left|\\right|\\displaystyle|\\[,;:!]|\\quad|\\qquad|~/g, ' ')
    .replace(/\\(?:mathrm|text|operatorname)\{([^}]*)\}/g, '$1')
    .replace(/\\cdot|\\times|·|×|∙/g, '*').replace(/\\div|÷|:/g, '/')
    .replace(/−|–/g, '-').replace(/\\pm/g, '+')
    .replace(/²/g, '^2').replace(/³/g, '^3')
    .replace(/π|\\pi/g, ' pi ').replace(/\\infty|∞/g, ' Infinity ')
    .replace(/(\d+(?:\.\d+)?)\s*(?:°|\^\{?\\circ\}?|º)/g, '($1 deg)')
    .replace(/°|\^\{?\\circ\}?/g, ' deg ')
    .replace(/\\(?:d|t)?frac/g, '\\frac');
  // Quitar «+ C» de integrales indefinidas
  s = s.replace(/\+\s*(C|K|k|c)\s*$/, '');
  // |x| y \lvert x \rvert → abs(x) (antes de las funciones, para que \ln|x| tenga argumento)
  s = s.replace(/\\[lr]?vert|\\mid/g, '|');
  for (let k = 0; k < 5 && /\|[^|]+\|/.test(s); k++) s = s.replace(/\|([^|]+)\|/, ' abs($1)');
  // log10( y log2( escritos tal cual (antes de tratar «log» genérico)
  s = s.replace(/log10\s*\(/g, 'LOGDIEZ(').replace(/log2\s*\(/g, 'LOGDOS(');

  // \frac{A}{B}
  s = reemplazaComando(s, /\\frac\s*/g, (t, i) => {
    const a = argumento(t, i), b = argumento(t, a.fin);
    return { texto: `((${aExpresion(a.dentro)})/(${aExpresion(b.dentro)}))`, fin: b.fin };
  });
  // \sqrt[n]{A} y \sqrt{A}
  s = reemplazaComando(s, /\\sqrt\s*/g, (t, i) => {
    let ind = null, j = saltaEsp(t, i);
    if (t[j] === '[') { const g = grupo(t, j); if (g) { ind = g.dentro; j = g.fin; } }
    const a = argumento(t, j);
    return { texto: ind ? `nthRoot((${aExpresion(a.dentro)}),(${aExpresion(ind)}))` : `sqrt(${aExpresion(a.dentro)})`, fin: a.fin };
  });
  // root[n](A) y √ ∛ ∜ escritos por el alumno
  s = reemplazaComando(s, /root\s*\[/g, (t, i) => {
    const g = grupo(t, i - 1); if (!g) return null;
    const a = argumento(t, g.fin);
    return { texto: `nthRoot((${aExpresion(a.dentro)}),(${aExpresion(g.dentro)}))`, fin: a.fin };
  });
  s = reemplazaComando(s, /([√∛∜])\s*/g, (t, i, m) => {
    const a = argumento(t, i);
    const n = m[1] === '√' ? 2 : m[1] === '∛' ? 3 : 4;
    return { texto: n === 2 ? `sqrt(${aExpresion(a.dentro)})` : `nthRoot((${aExpresion(a.dentro)}),${n})`, fin: a.fin };
  });
  // log_b(x), \log_{b} x, \log_b x
  s = reemplazaComando(s, /\\?log\s*_\s*/g, (t, i) => {
    const b = argumento(t, i), a = argumento(t, b.fin);
    return { texto: `LOGBASE((${aExpresion(a.dentro)}),(${aExpresion(b.dentro)}))`, fin: a.fin };
  });
  // \sin^2 x → (sin(x))^2 ; \sin x → sin(x) ; \ln, \log (base 10 si no hay base)
  s = reemplazaComando(s, /\\?(sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|sinh|cosh|tanh|sen|tg|ln|log|exp)(?![a-zA-Z])\s*/g, (t, i, m) => {
    let f = SINONIMOS[m[1]] || m[1];
    if (f === 'ln') f = 'LNX'; else if (f === 'log') f = 'LOGDIEZ';
    let pot = null, j = saltaEsp(t, i);
    if (t[j] === '^') { const p = argumento(t, j + 1); pot = p.dentro; j = p.fin; }
    const a = argumento(t, j);
    if (!a.dentro) return null;
    const llamada = `${f}(${aExpresion(a.dentro)})`;
    return { texto: pot ? `(${llamada})^(${aExpresion(pot)})` : llamada, fin: a.fin };
  });
  // ^{…} → ^(…), _{…} se elimina (índices: x_1 → x1)
  s = s.replace(/\^\s*\{/g, '^(').replace(/_\s*\{([^}]*)\}/g, '$1').replace(/_(\w)/g, '$1');
  s = s.replace(/[{]/g, '(').replace(/[}]/g, ')').replace(/\\/g, ' ');

  // Palabras: funciones, constantes, sinónimos; el resto son variables de una letra (xy → x*y)
  s = s.replace(/[a-zA-Z]+/g, (w) => {
    if (w === 'LNX' || w === 'LOGBASE') return 'log';
    if (w === 'LOGDIEZ') return 'log10';
    if (w === 'LOGDOS') return 'log2';
    const syn = SINONIMOS[w] || SINONIMOS[w.toLowerCase()];
    if (syn) return syn;
    if (w === 'ln') return 'log';
    if (w === 'log') return 'log10';
    if (w === 'deg') return 'deg';
    if (FUNCIONES.has(w) || CONSTANTES.has(w)) return w;
    return w.split('').join('*');
  });
  // x(…) → x*(…) cuando x es variable (mathjs lo tomaría como función)
  s = s.replace(/(^|[^a-zA-Z0-9_])([a-zA-Z])\s*\(/g, (t, p, v) => (FUNCIONES.has(v) ? t : `${p}${v}*(`));
  return s.replace(/\s+/g, ' ').trim();
}

// ─────────────────────────────────────────────────────────────
// Evaluación
// ─────────────────────────────────────────────────────────────
const RESERVADAS = new Set([...FUNCIONES, ...CONSTANTES, 'deg']);
const PUNTOS = [0.37, 1.21, 2.63, -1.43, 0.83, 1.79, -0.61, 3.17, 0.53, 2.11, -2.27, 1.47];

function compilar(expr) {
  const nodo = math.parse(expr);
  const vars = new Set();
  nodo.traverse((n, path, padre) => {
    if (n.isSymbolNode && !RESERVADAS.has(n.name) && !(padre?.isFunctionNode && path === 'fn')) vars.add(n.name);
  });
  return { f: nodo.compile(), vars };
}

const real = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v && typeof v === 'object') {
    if (v.isComplex) return Math.abs(v.im) < 1e-9 ? v.re : null;
    if (v.isFraction || v.isBigNumber) return Number(v);
    if (v.isUnit) return v.toNumber('rad');   // por si se cuela «30 deg»
  }
  return null;
};
const iguales = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));

export function equivalentes(alumno, solucion, { modo = 'equiv' } = {}) {
  if (!math) return null;
  const ea = aExpresion(alumno), es = aExpresion(solucion);
  if (!ea || !es) return ea === es ? null : false;
  let A, S;
  try { S = compilar(es); } catch { return null; }          // la solución no se entiende: no opinamos
  try { A = compilar(ea); } catch { return false; }        // lo del alumno no se entiende: mal
  const vars = [...new Set([...A.vars, ...S.vars])];
  const scope0 = { deg: math.unit(1, 'deg') };
  let base = null, validos = 0;
  for (let k = 0; k < PUNTOS.length; k++) {
    const scope = { ...scope0 };
    vars.forEach((v, j) => { scope[v] = PUNTOS[(k + j * 5) % PUNTOS.length] + j * 0.11; });
    let va, vs;
    try { va = real(A.f.evaluate(scope)); vs = real(S.f.evaluate(scope)); } catch { continue; }
    if (va === null || vs === null) continue;
    if (modo === 'constante') {
      const d = va - vs;
      if (base === null) base = d; else if (!iguales(d, base)) return false;
    } else if (!iguales(va, vs)) return false;
    validos++;
    if (!vars.length) break;                               // sin variables basta un punto
  }
  return validos >= (vars.length ? 3 : 1) ? true : null;
}

// Vista previa (LaTeX) de lo que escribe el alumno: «así lo ha entendido PIKT»
export function aLatex(texto) {
  if (!math) return null;
  const e = aExpresion(texto);
  if (!e) return null;
  try {
    return math.parse(e).toTex({ parenthesis: 'auto', implicit: 'hide' })
      .replace(/\\mathrm\{deg\}/g, '^\\circ').replace(/\\mathrm\{([a-zA-Z])\}/g, '$1').replace(/~/g, '\\,');
  } catch { return null; }
}
