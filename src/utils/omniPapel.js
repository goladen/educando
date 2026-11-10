// Ficha en papel ↔ hoja interactiva Omni, con la IA del propio profesor (copiar prompt / pegar respuesta)
//   promptHojaAOmni(config)          → prompt para convertir un PDF/foto de una ficha en un recurso Omni
//   interpretarOmni(texto, config)   → recurso Omni normalizado (lanza Error si no se puede leer)
//   claveRespuestas(recurso)         → [{ ref, ejercicio, tipo, pregunta, solucion, autocorregible }]
//   promptCorreccion(recurso, opc)   → prompt para corregir fotos/vídeo de exámenes en papel
//   interpretarCorreccion(texto)     → { examenes: [{ examen, nota, items: [...] }] }
// La numeración «ejercicio.item» (p. ej. 2.3) es la misma en la hoja interactiva, en el PDF y en la corrección.

export const TIPOS_OMNI = ['fill', 'choice', 'wordbank', 'construct', 'match', 'order', 'truefalse', 'multichoice', 'error', 'short', 'expr', 'matrix', 'open'];

export const NIVELES_PAPEL = ['Infantil', '1 Primaria', '2 Primaria', '3 Primaria', '4 Primaria', '5 Primaria', '6 Primaria', '1 ESO', '2 ESO', '3 ESO', '4 ESO', '1 Bach', '2 Bach', 'FP', 'Universidad', 'Otros'];
export const IDIOMAS_PAPEL = ['Español', 'English', 'Français', 'Català', 'Euskera', 'Galego', 'Deutsch', 'Italiano', 'Português'];

const cicloDeNivel = (n = '') => /primaria/i.test(n) ? 'Primaria' : /eso/i.test(n) ? 'Secundaria' : /bach/i.test(n) ? 'Bachillerato'
  : /infantil/i.test(n) ? 'Infantil' : /fp/i.test(n) ? 'FP' : 'Otros';

// ─────────────────────────────────────────────────────────────
// 1) Ficha → hoja interactiva
// ─────────────────────────────────────────────────────────────
export function promptHojaAOmni({ idioma = 'Español', nivel = '1 ESO', asignatura = '', extra = '' } = {}) {
  return `Eres un experto en convertir fichas de ejercicios escolares en material interactivo.

Te adjunto una ficha de ejercicios (PDF, foto o documento). Conviértela en un JSON para la plataforma PIKT (pikt.es) respetando la ficha original LO MÁS FIELMENTE POSIBLE:
- Mismo orden de ejercicios y de preguntas, misma numeración y mismos enunciados (copiados literalmente, sin resumir).
- Incluye TODOS los ejercicios y TODAS las preguntas. No inventes ejercicios que no estén.
- Resuelve tú cada pregunta e incluye la respuesta correcta. Si hay varias respuestas válidas, añádelas como alternativas.
- Los textos de lectura, tablas o datos necesarios para responder van en el "enunciado" del ejercicio.
- Fórmulas y expresiones matemáticas en LaTeX entre signos de dólar: $\\frac{3}{4}$, $x^2+1$, $\\sqrt{2}$.
- Idioma de los contenidos: el de la ficha (si no se distingue, ${idioma}). Nivel: ${nivel}.${asignatura ? ` Asignatura: ${asignatura}.` : ''}
${extra ? `- Indicaciones del profesor: ${extra}\n` : ''}
Para cada ejercicio elige el "tipo" que mejor reproduzca cómo se responde en papel:
- "fill": completar huecos en una frase (puede haber varios huecos: "parts" tiene un trozo más que "ans").
- "wordbank": completar huecos con palabras de un recuadro (las palabras van en "wordbank").
- "choice": elegir entre 2-3 opciones dentro de la frase.
- "multichoice": pregunta tipo test con opciones a, b, c, d.
- "truefalse": verdadero o falso ("ans": "true" o "false").
- "match": unir con flechas columna izquierda ↔ derecha (cada item es una pareja correcta).
- "order": ordenar palabras o elementos ("shuffled" tal como aparecen, "answer" ordenado y separado por espacios).
- "error": encontrar y corregir el error de una frase.
- "construct": escribir una frase a partir de palabras dadas separadas por " / ".
- "short": respuesta corta y cerrada que es un NÚMERO o una PALABRA (un resultado, una fecha, un nombre...). En "alts" pon formas equivalentes (0,5 | 1/2).
- "expr": la respuesta es una EXPRESIÓN MATEMÁTICA con variables (derivadas, integrales indefinidas, polinomios, simplificar, factorizar, despejar, desarrollar...). PIKT la corrige comprobando si la del alumno es matemáticamente equivalente, así que basta UNA forma correcta en "ans" (en LaTeX). Para integrales indefinidas pon "modo":"constante" (acepta cualquier «+ C»); si no, "modo":"equiv".
- "matrix": la respuesta es una MATRIZ o un vector (suma, producto, inversa, traspuesta...). "ans" = lista de filas, cada fila una lista de celdas en texto: [["1","2"],["3","4"]]. "corchetes": "pmatrix" (paréntesis), "bmatrix" (corchetes) o "vmatrix" (determinante).
- "open": respuesta abierta o de desarrollo que no se puede corregir automáticamente (redacciones, explicaciones, demostraciones, estudios de funciones, dibujos). "ans" = respuesta modelo o criterios de corrección; "lineas" = número de renglones aproximado que deja la ficha.

MATEMÁTICAS — cada apartado (a, b, c...) de un ejercicio es un item distinto con su propia solución. Escribe SIEMPRE en LaTeX entre $...$:
- Fracciones con numerador y denominador claros: $\\frac{x^2-1}{x+3}$ (nunca x^2-1/x+3).
- Raíces de cualquier índice: $\\sqrt{x}$, $\\sqrt[3]{27}$, $\\sqrt[5]{x^2}$.
- Potencias: $x^{2}$, $e^{2x}$, $2^{-3}$. Polinomios ordenados: $3x^3-2x^2+x-5$.
- Logaritmos: $\\log_{2} 8$, $\\log x$ (base 10), $\\ln x$.
- Trigonometría: $\\sin x$, $\\cos(2x)$, $\\tan 45^\\circ$, $\\arcsin x$. Grados con ^\\circ.
- Derivadas: $f'(x)$, $\\frac{d}{dx}(x^3)$. Integrales: $\\int (3x^2+1)\\,dx$, $\\int_{0}^{1} x^2\\,dx$. Límites: $\\lim_{x \\to 0} \\frac{\\sin x}{x}$.
- Matrices: $\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}$; determinantes con vmatrix. Sistemas: $\\begin{cases} x+y=3 \\\\ x-y=1 \\end{cases}$.
- MUY IMPORTANTE para que el JSON sea válido: escribe cada barra invertida doble (\\\\frac, \\\\sqrt, \\\\int) y el salto de fila de las matrices con cuatro (\\\\\\\\).
- Si la respuesta es un número (log, seno de un ángulo, integral definida, determinante, límite) usa "short"; si es una expresión con variables, "expr".
- Si hay varias soluciones (x = 2 y x = −3) haz un hueco para cada una ("fill" con dos huecos) o dos items.

Devuelve SOLO el JSON (sin explicaciones ni bloques de código) con esta estructura exacta:
{"titulo":"título de la ficha","nivel":"${nivel}","asignatura":"${asignatura || 'asignatura'}","tema":"tema","descripcion":"una frase","tags":["etiqueta"],
"ejercicios":[
 {"id":"ex1","tipo":"fill","titulo":"1. Completa","enunciado":"Completa con el verbo entre paréntesis.","items":[{"id":1,"lbl":"a)","parts":["Yesterday I ","to school."],"hint":"(go)","ans":["went"],"alts":[[]]}]},
 {"id":"ex2","tipo":"wordbank","titulo":"2. ...","enunciado":"...","wordbank":["palabra1","palabra2"],"items":[{"id":1,"lbl":"a)","parts":["antes ","después"],"ans":["palabra1"],"alts":[[]]}]},
 {"id":"ex3","tipo":"choice","titulo":"3. ...","enunciado":"...","items":[{"id":1,"lbl":"a)","parts":["antes ","después"],"opts":["opción1","opción2"],"ans":"opción1"}]},
 {"id":"ex4","tipo":"multichoice","titulo":"4. ...","enunciado":"...","items":[{"id":1,"lbl":"a)","question":"pregunta","opts":["A","B","C","D"],"ans":"B"}]},
 {"id":"ex5","tipo":"truefalse","titulo":"5. ...","enunciado":"...","items":[{"id":1,"lbl":"a)","statement":"afirmación","ans":"true"}]},
 {"id":"ex6","tipo":"match","titulo":"6. ...","enunciado":"...","items":[{"id":1,"lbl":"1.","left":"izquierda","right":"derecha"}]},
 {"id":"ex7","tipo":"order","titulo":"7. ...","enunciado":"...","items":[{"id":1,"lbl":"a)","shuffled":["is","She","tall"],"answer":"She is tall"}]},
 {"id":"ex8","tipo":"error","titulo":"8. ...","enunciado":"...","items":[{"id":1,"lbl":"a)","sentence":"She have a dog.","errorWord":"have","correction":"has"}]},
 {"id":"ex9","tipo":"construct","titulo":"9. ...","enunciado":"...","items":[{"id":1,"lbl":"a)","prompt":"she / not like / pizza","ans":"She doesn't like pizza.","alts":["She does not like pizza."]}]},
 {"id":"ex10","tipo":"short","titulo":"10. Calcula","enunciado":"Calcula y simplifica.","items":[{"id":1,"lbl":"a)","question":"$\\\\frac{1}{2}+\\\\frac{1}{4}$","ans":"3/4","alts":["0,75"]}]},
 {"id":"ex11","tipo":"expr","titulo":"11. Deriva e integra","enunciado":"Calcula.","items":[{"id":1,"lbl":"a)","question":"$f(x)=x^3+x^2$, $f'(x)=$","ans":"$3x^2+2x$","modo":"equiv"},{"id":2,"lbl":"b)","question":"$\\\\int 3x^2\\\\,dx$","ans":"$x^3$","modo":"constante"}]},
 {"id":"ex12","tipo":"matrix","titulo":"12. Matrices","enunciado":"Calcula A+B.","items":[{"id":1,"lbl":"a)","question":"$A+B$","ans":[["2","1"],["0","5"]],"corchetes":"pmatrix"}]},
 {"id":"ex13","tipo":"open","titulo":"13. Explica","enunciado":"...","items":[{"id":1,"lbl":"a)","question":"¿Por qué...?","ans":"Respuesta modelo / criterios","lineas":4}]}
]}
"lbl" es la etiqueta de la pregunta tal como aparece en la ficha (a), b), 1., 2....). Usa solo los campos de cada tipo.`;
}

// Saca el primer objeto/array JSON de un texto (quita ```json, explicaciones, etc.)
export function extraerJSON(texto) {
  let t = String(texto || '').replace(/```(?:json)?/gi, '').trim();
  const ini = t.search(/[[{]/);
  if (ini < 0) throw new Error('No hay ningún JSON en la respuesta.');
  const abre = t[ini], cierra = abre === '{' ? '}' : ']';
  const fin = t.lastIndexOf(cierra);
  if (fin <= ini) throw new Error('El JSON está incompleto (¿se cortó la respuesta?).');
  t = t.slice(ini, fin + 1);
  // Las IAs suelen escribir LaTeX con una sola barra dentro del JSON («\frac» → \f = salto de página):
  // se duplica la barra de los comandos LaTeX habituales que no vengan ya escapados
  t = t.replace(RE_LATEX_SUELTO, '$1\\\\');
  // Cualquier otra barra que no forme un escape JSON válido (\, \; \| \{ …) también se duplica
  t = t.replace(/\\([\s\S])/g, (m, ch) => ('"\\/bfnrtu'.includes(ch) ? m : '\\\\' + ch));
  let datos;
  try { datos = JSON.parse(t); } catch {
    // Arreglos habituales: comas finales y comillas tipográficas
    const t2 = t.replace(/,\s*([}\]])/g, '$1').replace(/[“”]/g, '"');
    try { datos = JSON.parse(t2); } catch (e) { throw new Error('El JSON no es válido: ' + e.message); }
  }
  return arreglarMatrices(datos);
}

const COMANDOS_LATEX = ['frac', 'dfrac', 'tfrac', 'times', 'cdot', 'cdots', 'ldots', 'vdots', 'ddots', 'dots', 'sqrt', 'left', 'right',
  'div', 'pm', 'mp', 'neq', 'ne', 'leq', 'le', 'geq', 'ge', 'approx', 'sim', 'equiv', 'propto', 'infty',
  'alpha', 'beta', 'gamma', 'Gamma', 'delta', 'Delta', 'epsilon', 'varepsilon', 'zeta', 'eta', 'theta', 'Theta', 'kappa', 'lambda', 'Lambda',
  'mu', 'nu', 'xi', 'pi', 'Pi', 'rho', 'sigma', 'Sigma', 'tau', 'phi', 'varphi', 'Phi', 'chi', 'psi', 'omega', 'Omega', 'ell',
  'text', 'mathrm', 'mathbf', 'mathbb', 'operatorname', 'displaystyle', 'overline', 'underline', 'vec', 'bar', 'hat', 'widehat', 'overrightarrow',
  'sum', 'prod', 'int', 'iint', 'iiint', 'oint', 'partial', 'nabla', 'prime', 'lim', 'log', 'ln', 'exp', 'det', 'max', 'min',
  'sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh',
  'circ', 'degree', 'rightarrow', 'leftarrow', 'Rightarrow', 'Leftrightarrow', 'leftrightarrow', 'iff', 'implies', 'to', 'mapsto',
  'binom', 'over', 'quad', 'qquad', 'begin', 'end', 'hline', 'vert', 'lvert', 'rvert', 'mid', 'lfloor', 'rfloor', 'lceil', 'rceil',
  'in', 'notin', 'subset', 'subseteq', 'cap', 'cup', 'emptyset', 'forall', 'exists', 'neg', 'perp', 'parallel', 'angle', 'triangle', '%'];
const RE_LATEX_SUELTO = new RegExp(`(^|[^\\\\])\\\\(?=(${COMANDOS_LATEX.join('|')})(?![a-zA-Z]))`, 'g');

// Dentro de matrices/sistemas, un «\» suelto (la IA escribió \\ en el JSON) debe ser el salto de fila «\\»
function arreglarMatrices(v) {
  if (typeof v === 'string') {
    return v.includes('\\begin') ? v.replace(/\\begin\{(\w+\*?)\}([\s\S]*?)\\end\{\1\}/g, (todo, env, cuerpo) =>
      `\\begin{${env}}${cuerpo.replace(/(^|[^\\])\\(?=[\s\d+-]|$)/g, '$1\\\\')}\\end{${env}}`) : v;
  }
  if (Array.isArray(v)) return v.map(arreglarMatrices);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, arreglarMatrices(x)]));
  return v;
}

const str = (v) => (v == null ? '' : String(v));
const arr = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);
const altsLista = (a) => arr(a).flatMap(x => Array.isArray(x) ? x : str(x).split('|')).map(s => str(s).trim()).filter(Boolean);

// «\begin{pmatrix} 1 & 2 \\ 3 & 4 \end{pmatrix}» → [["1","2"],["3","4"]]
function filasDeLatex(s) {
  const m = s.match(/\\begin\{\w+\}([\s\S]*?)\\end\{\w+\}/);
  const cuerpo = (m ? m[1] : s).replace(/\$/g, '');
  return cuerpo.split(/\\\\|;/).map(f => f.split(/&|,/).map(c => c.trim())).filter(f => f.some(Boolean));
}

// Matriz guardada {filas, cols, celdas} → filas
export const filasMatriz = (it) => Array.from({ length: it.filas || 0 }, (_, r) => (it.celdas || []).slice(r * it.cols, (r + 1) * it.cols));

function normalizarItem(tipo, it, k) {
  const base = { id: it.id ?? k + 1, lbl: str(it.lbl ?? it.label ?? `${k + 1}.`) };
  switch (tipo) {
    case 'fill':
    case 'wordbank': {
      let ans = arr(it.ans).map(str);
      let parts = arr(it.parts).map(str);
      if (!ans.length) ans = [''];
      while (parts.length < ans.length + 1) parts.push('');
      if (parts.length > ans.length + 1) parts = [...parts.slice(0, ans.length), parts.slice(ans.length).join(' ')];
      const altsIn = arr(it.alts);
      const alts = ans.map((_, i) => altsLista(altsIn[i]));
      return { ...base, parts, ans, alts, ...(it.hint ? { hint: str(it.hint) } : {}) };
    }
    case 'choice': {
      const opts = arr(it.opts).map(str).filter(Boolean);
      const parts = arr(it.parts).map(str);
      return { ...base, parts: [parts[0] || '', parts.slice(1).join(' ')], opts, ans: str(it.ans) };
    }
    case 'multichoice': {
      const opts = arr(it.opts).map(str).filter(Boolean);
      let ans = str(it.ans);
      // «B» → el texto de la opción B
      if (/^[a-dA-D]\)?$/.test(ans.trim()) && !opts.includes(ans)) ans = opts['abcd'.indexOf(ans.trim()[0].toLowerCase())] || ans;
      return { ...base, question: str(it.question ?? it.pregunta), opts, ans };
    }
    case 'truefalse': {
      const a = str(it.ans).toLowerCase();
      return { ...base, statement: str(it.statement ?? it.question), ans: /^(true|t|v|verdadero|sí|si|vrai|cert|1)$/.test(a) ? 'true' : 'false' };
    }
    case 'match': return { ...base, left: str(it.left), right: str(it.right) };
    case 'order': {
      const answer = str(it.answer ?? it.ans);
      const shuffled = arr(it.shuffled).map(str).filter(Boolean);
      return { ...base, shuffled: shuffled.length ? shuffled : answer.split(/\s+/).filter(Boolean), answer };
    }
    case 'error': return { ...base, sentence: str(it.sentence), errorWord: str(it.errorWord), correction: str(it.correction) };
    case 'construct': return { ...base, prompt: str(it.prompt ?? it.question), ans: str(it.ans), alts: altsLista(it.alts) };
    case 'short': return { ...base, question: str(it.question ?? it.prompt), ans: str(arr(it.ans)[0] ?? ''), alts: altsLista(it.alts) };
    case 'expr': {
      const ans = str(arr(it.ans)[0] ?? '');
      const modo = it.modo === 'constante' || /\+\s*C\s*\$?\s*$/.test(ans) ? 'constante' : 'equiv';
      return { ...base, question: str(it.question ?? it.prompt), ans, alts: altsLista(it.alts), modo };
    }
    case 'matrix': {
      // Admite [["1","2"],["3","4"]], {filas, cols, celdas} o el LaTeX de una matriz
      let rows = Array.isArray(it.ans) && Array.isArray(it.ans[0]) ? it.ans
        : Array.isArray(it.celdas) ? Array.from({ length: it.filas || 1 }, (_, r) => it.celdas.slice(r * (it.cols || 1), (r + 1) * (it.cols || 1)))
        : filasDeLatex(str(it.ans));
      rows = rows.map(f => arr(f).map(c => str(c).trim()));
      const cols = Math.max(1, ...rows.map(f => f.length));
      const filas = Math.max(1, rows.length);
      const celdas = rows.flatMap(f => [...f, ...Array(cols - f.length).fill('')]);
      const corchetes = ['pmatrix', 'bmatrix', 'vmatrix'].includes(it.corchetes) ? it.corchetes : 'pmatrix';
      return { ...base, question: str(it.question ?? it.prompt), filas, cols, celdas, corchetes };
    }
    case 'open': return { ...base, question: str(it.question ?? it.prompt), ans: str(it.ans), lineas: Math.max(1, Math.min(20, parseInt(it.lineas) || 3)) };
    default: return null;
  }
}

export function normalizarRecursoOmni(datos, config = {}) {
  const d = Array.isArray(datos) ? { ejercicios: datos } : (datos || {});
  const ejercicios = arr(d.ejercicios).map((ex, i) => {
    const tipo = TIPOS_OMNI.includes(ex?.tipo) ? ex.tipo : (ex?.items?.[0]?.question ? 'short' : null);
    if (!tipo) return null;
    const items = arr(ex.items).map((it, k) => normalizarItem(tipo, it || {}, k)).filter(Boolean);
    if (!items.length) return null;
    return {
      id: str(ex.id || `ex${i + 1}`), tipo,
      titulo: str(ex.titulo || `Ejercicio ${i + 1}`), enunciado: str(ex.enunciado), imagen: ex.imagen || null,
      ...(tipo === 'wordbank' ? { wordbank: arr(ex.wordbank).map(str).filter(Boolean) } : {}),
      items,
    };
  }).filter(Boolean);
  // ids únicos
  const vistos = new Set();
  ejercicios.forEach((ex, i) => { if (vistos.has(ex.id)) ex.id = `ex${i + 1}_${i}`; vistos.add(ex.id); });
  const nivel = str(d.nivel || config.nivel || '1 ESO');
  return {
    titulo: str(d.titulo || 'Ficha interactiva'), nivel, asignatura: str(d.asignatura || config.asignatura || ''),
    tema: str(d.tema || ''), descripcion: str(d.descripcion || ''), tags: arr(d.tags).map(str).slice(0, 8),
    ciclo: cicloDeNivel(nivel), color: '#6D28D9',
    ordenFijo: true, origenPapel: true,
    ejercicios,
  };
}

export function interpretarOmni(texto, config) {
  const r = normalizarRecursoOmni(extraerJSON(texto), config);
  if (!r.ejercicios.length) throw new Error('No se ha encontrado ningún ejercicio válido.');
  r.id = 'auto_' + Date.now();
  return r;
}

// ─────────────────────────────────────────────────────────────
// 2) Clave de respuestas (para el PDF del profe y para la corrección)
// ─────────────────────────────────────────────────────────────
const alts = (a) => altsLista(a);
const conAlts = (ans, a) => [ans, ...alts(a)].filter(Boolean).join(' | ');

export function claveRespuestas(recurso) {
  const filas = [];
  (recurso?.ejercicios || []).forEach((ex, i) => {
    (ex.items || []).forEach((it, k) => {
      const ref = `${i + 1}.${k + 1}`;
      let pregunta = '', solucion = '', auto = true;
      switch (ex.tipo) {
        case 'fill': case 'wordbank': {
          const partes = it.parts || [];
          pregunta = partes.map((p, j) => p + (j < partes.length - 1 ? ` (${j + 1})____` : '')).join('') + (it.hint ? ` ${it.hint}` : '');
          const ansL = arr(it.ans);
          solucion = ansL.map((a, j) => (ansL.length > 1 ? `(${j + 1}) ` : '') + conAlts(a, arr(it.alts)[j])).join(' ; ');
          break;
        }
        case 'choice': pregunta = `${it.parts?.[0] || ''} [${(it.opts || []).join(' / ')}] ${it.parts?.[1] || ''}`; solucion = it.ans; break;
        case 'multichoice': pregunta = `${it.question} — ${(it.opts || []).map((o, j) => `${'abcd'[j]}) ${o}`).join('  ')}`;
          solucion = `${'abcd'[(it.opts || []).indexOf(it.ans)] || '?'}) ${it.ans}`; break;
        case 'truefalse': pregunta = it.statement; solucion = it.ans === 'true' ? 'Verdadero' : 'Falso'; break;
        case 'match': pregunta = `${it.left} → ?`; solucion = it.right; break;
        case 'order': pregunta = (it.shuffled || []).join(' / '); solucion = it.answer; break;
        case 'error': pregunta = it.sentence; solucion = `${it.errorWord} → ${it.correction}`; break;
        case 'construct': pregunta = it.prompt; solucion = conAlts(it.ans, it.alts); break;
        case 'short': pregunta = it.question; solucion = conAlts(it.ans, it.alts); break;
        case 'expr': pregunta = it.question;
          solucion = conAlts(it.ans, it.alts) + (it.modo === 'constante' ? '  (+ C; vale cualquier expresión equivalente)' : '  (vale cualquier expresión equivalente)'); break;
        case 'matrix': pregunta = it.question;
          solucion = filasMatriz(it).map(f => `[${f.join('  ')}]`).join(' '); break;
        case 'open': pregunta = it.question; solucion = it.ans || '(respuesta abierta)'; auto = false; break;
        default: break;
      }
      filas.push({ ref, ejercicio: ex.titulo, tipo: ex.tipo, lbl: it.lbl, pregunta: str(pregunta).trim(), solucion: str(solucion).trim(), autocorregible: auto });
    });
  });
  return filas;
}

// ─────────────────────────────────────────────────────────────
// 3) Corrección de exámenes en papel
// ─────────────────────────────────────────────────────────────
export function promptCorreccion(recurso, { criterios = '', puntuarAbiertas = true, notaSobre = 10 } = {}) {
  const clave = claveRespuestas(recurso);
  let ejActual = null;
  const lineas = [];
  clave.forEach(f => {
    if (f.ejercicio !== ejActual) { ejActual = f.ejercicio; lineas.push(`\n## Ejercicio ${f.ref.split('.')[0]}: ${f.ejercicio}`); }
    lineas.push(`[${f.ref}] (${f.lbl}) ${f.pregunta}\n      SOLUCIÓN: ${f.solucion}${f.autocorregible ? '' : '  (abierta: valora con estos criterios)'}`);
  });
  return `Eres un profesor corrigiendo exámenes en papel. Te adjunto fotos o un vídeo con los exámenes de varios alumnos (sin nombre), de la ficha «${recurso.titulo}». En el vídeo se pasa de un alumno a otro; en las fotos, cada examen puede ocupar una o varias imágenes seguidas.

Instrucciones:
1. Separa los exámenes y numéralos por orden de aparición: Examen 1, Examen 2... Si un examen tiene un número, código o marca identificativa escrita, anótala en "marca".
2. Para CADA pregunta de la clave lee la respuesta del alumno y compárala con la solución. Acepta respuestas equivalentes (formas equivalentes de un número o fracción, sinónimos válidos, mayúsculas/minúsculas, faltas leves si no es una pregunta de ortografía).
3. Estado de cada pregunta:
   - "bien": correcta.
   - "mal": incorrecta (indica en "comentario" el error brevemente).
   - "parcial": parcialmente correcta (explica qué falta).
   - "blanco": sin responder.
   - "no_corregible": no se puede leer, la imagen está cortada o borrosa, o necesita revisión del profesor. Explica el motivo en "comentario".
${puntuarAbiertas ? '   Las preguntas abiertas valóralas con los criterios de la solución; si dudas, usa "parcial" o "no_corregible".' : '   Las preguntas abiertas márcalas siempre como "no_corregible" (las corrige el profesor), pero transcribe lo que ha escrito el alumno.'}
4. Transcribe en "respuesta" lo que ha escrito el alumno (breve). No inventes: si no lo ves claro, "no_corregible".
5. Calcula "nota" sobre ${notaSobre} contando bien = 1, parcial = 0,5, mal y blanco = 0, y excluyendo del total las "no_corregible".
${criterios ? `6. Criterios del profesor: ${criterios}\n` : ''}
CLAVE DE RESPUESTAS (la referencia [ejercicio.pregunta] es la que debes usar):${lineas.join('\n')}

Devuelve SOLO este JSON (sin texto adicional ni bloques de código), con TODAS las preguntas de la clave en cada examen:
{"examenes":[{"examen":1,"marca":"","nota":7.5,"resumen":"comentario general breve","items":[{"ref":"1.1","estado":"bien","respuesta":"went","comentario":""},{"ref":"1.2","estado":"no_corregible","respuesta":"","comentario":"borroso"}]}]}`;
}

const ESTADOS = ['bien', 'mal', 'parcial', 'blanco', 'no_corregible'];
const normEstado = (e) => {
  const s = str(e).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s-]+/g, '_');
  if (ESTADOS.includes(s)) return s;
  if (/^(correct|ok|si|true|acierto)/.test(s)) return 'bien';
  if (/^(incorrect|error|fallo|wrong|false)/.test(s)) return 'mal';
  if (/^(partial|medio)/.test(s)) return 'parcial';
  if (/^(vacio|empty|sin_resp|en_blanco|blank)/.test(s)) return 'blanco';
  return 'no_corregible';
};

export function interpretarCorreccion(texto, recurso) {
  const d = extraerJSON(texto);
  const lista = Array.isArray(d) ? d : arr(d.examenes);
  const refs = claveRespuestas(recurso).map(f => f.ref);
  const examenes = lista.map((ex, i) => {
    const porRef = {};
    arr(ex.items).forEach(it => { if (it?.ref != null) porRef[str(it.ref).replace(/[[\]\s]/g, '')] = it; });
    const items = refs.map(ref => {
      const it = porRef[ref];
      return it
        ? { ref, estado: normEstado(it.estado), respuesta: str(it.respuesta), comentario: str(it.comentario) }
        : { ref, estado: 'no_corregible', respuesta: '', comentario: 'La IA no la ha devuelto' };
    });
    const c = cuenta(items);
    return { examen: ex.examen ?? i + 1, marca: str(ex.marca), resumen: str(ex.resumen), notaIA: ex.nota, items, ...c };
  });
  if (!examenes.length) throw new Error('No se ha encontrado ningún examen en la respuesta.');
  return { examenes };
}

export function cuenta(items) {
  const n = (e) => items.filter(i => i.estado === e).length;
  const bien = n('bien'), mal = n('mal'), parcial = n('parcial'), blanco = n('blanco'), noCorr = n('no_corregible');
  const corregibles = bien + mal + parcial + blanco;
  const nota = corregibles ? Math.round(((bien + parcial * 0.5) / corregibles) * 100) / 10 : null; // sobre 10
  return { bien, mal, parcial, blanco, noCorr, corregibles, nota };
}
