// Ejercicios de Omni con cuadrícula: crucigrama ('crossword') y sopa de letras ('wordsearch').
// Datos (sin arrays anidados, válidos para Firestore):
//   crossword:  { tipo, filas, cols, items: [{ id, ans, clue, row, col, dir: 'across'|'down' }] }
//   wordsearch: { tipo, grid: 'ABC|DEF|…', mostrarPalabras, items: [{ id, ans, clue, row, col, dr, dc }] }
// Respuestas del alumno (objeto ans del ejercicio):
//   crossword:  cw_<fila>_<col> = letra
//   wordsearch: ws_<itemId> = true (encontrada)
import { useState, useRef, useMemo, useEffect } from 'react';
import MathText from './MathText';
import {
  normPalabra, celdasPalabra, numerarCrucigrama, medidasCrucigrama, solucionCrucigrama,
  filasSopa, lineaEntre, palabraEnLinea, celdasSopa,
} from '../utils/puzzlesPalabras';

// ─── puntuación (la usa calcScore de OmninteractiveApp) ──────────────────────
export const palabraCrucigramaOk = (it, ans) => {
  const w = normPalabra(it.ans);
  return celdasPalabra(it).every(([r, c], i) => normPalabra(ans[`cw_${r}_${c}`] || '') === w[i]);
};
export const puntuarCrucigrama = (ex, ans) => {
  const items = ex.items || [];
  return { c: items.filter(it => palabraCrucigramaOk(it, ans)).length, t: items.length };
};
export const puntuarSopa = (ex, ans) => {
  const items = ex.items || [];
  return { c: items.filter(it => ans[`ws_${it.id}`]).length, t: items.length };
};

const lado = (n, max = 36) => `min(${max}px, calc((100vw - 64px) / ${n}))`;

// ─── CRUCIGRAMA ───────────────────────────────────────────────────────────────
export function CrosswordEx({ ex, ans, setAns, checked }) {
  const items = ex.items || [];
  const { filas, cols } = ex.filas && ex.cols ? ex : medidasCrucigrama(items);
  const sol = useMemo(() => solucionCrucigrama(items), [items]);
  const { numeros, conNum } = useMemo(() => numerarCrucigrama(items), [items]);
  const [activa, setActiva] = useState(null);           // { r, c }
  const [dir, setDir] = useState('across');
  const refs = useRef({});
  const color = ex.color || '#6D28D9';

  // Palabra que contiene la casilla activa en la dirección actual
  const palabraDe = (r, c, d) => items.find(it => it.dir === d && celdasPalabra(it).some(([a, b]) => a === r && b === c));
  const palabraActiva = activa ? (palabraDe(activa.r, activa.c, dir) || palabraDe(activa.r, activa.c, dir === 'across' ? 'down' : 'across')) : null;
  const enActiva = new Set(palabraActiva ? celdasPalabra(palabraActiva).map(([r, c]) => `${r},${c}`) : []);
  const okPorPalabra = useMemo(() => checked ? new Map(items.map(it => [it.id, palabraCrucigramaOk(it, ans)])) : null, [checked, items, ans]);

  const enfocar = (r, c) => { const el = refs.current[`${r},${c}`]; if (el) { el.focus(); el.select?.(); } };
  const elegir = (r, c) => {
    if (activa && activa.r === r && activa.c === c) {
      const otra = dir === 'across' ? 'down' : 'across';
      if (palabraDe(r, c, otra)) setDir(otra);
    } else {
      setActiva({ r, c });
      if (!palabraDe(r, c, dir)) setDir(dir === 'across' ? 'down' : 'across');
    }
  };
  const mover = (r, c, paso) => {
    const d = palabraActiva?.dir || dir;
    const nr = d === 'down' ? r + paso : r, nc = d === 'down' ? c : c + paso;
    if (sol.has(`${nr},${nc}`)) { setActiva({ r: nr, c: nc }); enfocar(nr, nc); }
  };
  const escribir = (r, c, v) => {
    const letra = normPalabra(v).slice(-1);
    setAns(`cw_${r}_${c}`, letra);
    if (letra) mover(r, c, 1);
  };
  const tecla = (e, r, c) => {
    if (checked) return;
    const flechas = { ArrowRight: [0, 1, 'across'], ArrowLeft: [0, -1, 'across'], ArrowDown: [1, 0, 'down'], ArrowUp: [-1, 0, 'down'] };
    if (flechas[e.key]) {
      e.preventDefault();
      const [dr, dc, d] = flechas[e.key];
      setDir(d);
      if (sol.has(`${r + dr},${c + dc}`)) { setActiva({ r: r + dr, c: c + dc }); enfocar(r + dr, c + dc); }
    } else if (e.key === 'Backspace' && !(ans[`cw_${r}_${c}`])) {
      e.preventDefault(); mover(r, c, -1);
    }
  };

  const pistas = (d) => conNum.filter(it => it.dir === d).sort((a, b) => a.num - b.num);
  const tam = lado(cols);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
      <div role="grid" aria-label="Crucigrama" style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, ${tam})`, gridAutoRows: tam, gap: 2, background: 'transparent', userSelect: 'none', flexShrink: 0 }}>
        {Array.from({ length: filas * cols }, (_, k) => {
          const r = Math.floor(k / cols), c = k % cols, clave = `${r},${c}`;
          if (!sol.has(clave)) return <div key={clave} />;
          const val = ans[`cw_${r}_${c}`] || '';
          const esActiva = activa && activa.r === r && activa.c === c;
          let bg = enActiva.has(clave) ? `${color}1f` : 'white', borde = esActiva ? color : '#334155';
          let bien = null;
          if (checked) {
            bien = normPalabra(val) === sol.get(clave);
            bg = bien ? '#DCFCE7' : '#FEE2E2'; borde = bien ? '#059669' : '#DC2626';
          }
          return (
            <div key={clave} style={{ position: 'relative', background: bg, border: `1.5px solid ${borde}`, borderRadius: 3, boxSizing: 'border-box' }}
              onClick={() => !checked && elegir(r, c)}>
              {numeros.has(clave) && <span style={{ position: 'absolute', top: 0, left: 2, fontSize: 'min(9px, 2.2vw)', fontWeight: 700, color: '#475569', lineHeight: 1 }}>{numeros.get(clave)}</span>}
              <input ref={el => { refs.current[clave] = el; }} value={val} readOnly={checked} maxLength={2}
                aria-label={`Fila ${r + 1}, columna ${c + 1}`} autoCapitalize="characters" autoComplete="off" spellCheck={false}
                onChange={e => escribir(r, c, e.target.value)} onKeyDown={e => tecla(e, r, c)}
                style={{ width: '100%', height: '100%', border: 'none', background: 'transparent', textAlign: 'center', textTransform: 'uppercase',
                  fontSize: 'min(17px, 4vw)', fontWeight: 700, color: '#0F172A', padding: 0, outline: 'none', fontFamily: 'inherit', caretColor: color }} />
              {checked && !bien && <span style={{ position: 'absolute', bottom: 0, right: 2, fontSize: 'min(9px, 2.2vw)', fontWeight: 800, color: '#059669' }}>{sol.get(clave)}</span>}
            </div>
          );
        })}
      </div>

      <div style={{ flex: '1 1 220px', minWidth: 200, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[['across', 'Across →'], ['down', 'Down ↓']].map(([d, titulo]) => pistas(d).length > 0 && (
          <div key={d}>
            <div style={{ fontSize: 12, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{titulo}</div>
            {pistas(d).map(it => {
              const sel = palabraActiva?.id === it.id;
              const ok = okPorPalabra?.get(it.id);
              return (
                <div key={it.id} onClick={() => { if (checked) return; setDir(d); setActiva({ r: it.row, c: it.col }); enfocar(it.row, it.col); }}
                  style={{ display: 'flex', gap: 8, padding: '5px 8px', borderRadius: 8, cursor: checked ? 'default' : 'pointer', fontSize: 14, lineHeight: 1.45,
                    background: sel ? `${color}14` : 'transparent' }}>
                  <b style={{ minWidth: 20, color: '#475569' }}>{it.num}</b>
                  <span style={{ flex: 1 }}><MathText text={it.clue || '…'} /> <span style={{ color: '#94A3B8', fontSize: 12 }}>({normPalabra(it.ans).length})</span></span>
                  {checked && <span>{ok ? '✓' : '✗'}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SOPA DE LETRAS ───────────────────────────────────────────────────────────
const COLORES_SOPA = ['#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#8B5CF6', '#EF4444', '#14B8A6', '#F97316', '#6366F1', '#84CC16', '#06B6D4', '#D946EF'];

export function WordsearchEx({ ex, ans, setAns, checked }) {
  const filas = filasSopa(ex.grid);
  const n = filas.length, m = Math.max(0, ...filas.map(f => f.length));
  const items = ex.items || [];
  const [inicio, setInicio] = useState(null);           // casilla donde empezó el arrastre / primer toque
  const [fin, setFin] = useState(null);
  const [fallo, setFallo] = useState(false);
  const arrastrando = useRef(false);
  const color = ex.color || '#6D28D9';

  // Casilla → colores de las palabras encontradas (y no encontradas al corregir)
  const marcas = useMemo(() => {
    const mp = new Map();
    items.forEach((it, i) => {
      const encontrada = !!ans[`ws_${it.id}`];
      if (!encontrada && !checked) return;
      const col = encontrada ? COLORES_SOPA[i % COLORES_SOPA.length] : '#94A3B8';
      celdasSopa(it).forEach(([r, c]) => { const k = `${r},${c}`; mp.set(k, [...(mp.get(k) || []), { col, encontrada }]); });
    });
    return mp;
  }, [items, ans, checked]);

  const linea = inicio && fin ? lineaEntre(inicio, fin) : null;
  const enLinea = new Set((linea || (inicio ? [inicio] : [])).map(([r, c]) => `${r},${c}`));

  const celdaDeEvento = (e) => {
    const p = e.touches?.[0] || e.changedTouches?.[0] || e;
    const el = document.elementFromPoint(p.clientX, p.clientY);
    const d = el?.closest?.('[data-ws]')?.dataset?.ws;
    return d ? d.split(',').map(Number) : null;
  };
  const terminar = (a, b) => {
    const l = lineaEntre(a, b);
    const it = palabraEnLinea(items, l);
    if (it && !ans[`ws_${it.id}`]) setAns(`ws_${it.id}`, true);
    else if (l && l.length > 1) { setFallo(true); setTimeout(() => setFallo(false), 450); }
    setInicio(null); setFin(null);
  };

  const onDown = (e) => {
    if (checked) return;
    const c = celdaDeEvento(e); if (!c) return;
    e.preventDefault?.();
    // Segundo toque (modo «toca inicio y toca final»)
    if (inicio && !arrastrando.current && (inicio[0] !== c[0] || inicio[1] !== c[1])) { terminar(inicio, c); return; }
    arrastrando.current = true; setInicio(c); setFin(c);
  };
  const onMove = (e) => {
    if (!arrastrando.current) return;
    const c = celdaDeEvento(e);
    if (c && lineaEntre(inicio, c)) setFin(c);
  };
  const onUp = (e) => {
    if (!arrastrando.current) return;
    arrastrando.current = false;
    const c = celdaDeEvento(e) || fin;
    if (inicio && c && (inicio[0] !== c[0] || inicio[1] !== c[1])) terminar(inicio, c);
    // si suelta en la misma casilla, queda marcada como inicio y espera el segundo toque
  };
  useEffect(() => {
    const up = () => { arrastrando.current = false; };
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, []);

  const tam = lado(m, 34);
  const mostrar = ex.mostrarPalabras !== false;
  const encontradas = items.filter(it => ans[`ws_${it.id}`]).length;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
      <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
        style={{ display: 'grid', gridTemplateColumns: `repeat(${m}, ${tam})`, gridAutoRows: tam, gap: 1, padding: 6, borderRadius: 12,
          background: fallo ? '#FEE2E2' : '#F8FAFC', border: '1.5px solid #CBD5E1', userSelect: 'none', touchAction: 'none', transition: 'background 0.2s', flexShrink: 0 }}>
        {filas.flatMap((f, r) => [...f].map((l, c) => {
          const k = `${r},${c}`, mk = marcas.get(k);
          const sel = enLinea.has(k);
          const fondo = sel ? color : mk ? (mk.length > 1 ? `linear-gradient(135deg, ${mk[0].col}66 50%, ${mk[1].col}66 50%)` : `${mk[0].col}55`) : 'transparent';
          return (
            <div key={k} data-ws={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: checked ? 'default' : 'pointer',
              background: fondo, color: sel ? 'white' : mk && !mk[0].encontrada ? '#475569' : '#0F172A',
              fontWeight: 700, fontSize: 'min(16px, 3.8vw)', fontFamily: 'ui-monospace, Menlo, Consolas, monospace' }}>{l}</div>
          );
        }))}
      </div>

      <div style={{ flex: '1 1 200px', minWidth: 180 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
          Find {items.length} words · {encontradas}/{items.length}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {items.map((it, i) => {
            const ok = !!ans[`ws_${it.id}`];
            return (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderRadius: 8, fontSize: 14,
                background: ok ? `${COLORES_SOPA[i % COLORES_SOPA.length]}22` : checked ? '#FEE2E2' : 'white', border: '1px solid #E2E8F0' }}>
                <span style={{ flex: 1 }}>
                  {it.clue && <MathText text={it.clue} />}
                  {(mostrar || ok || checked) && <b style={{ marginLeft: it.clue ? 6 : 0, letterSpacing: '0.04em', textDecoration: ok ? 'line-through' : 'none', color: ok ? '#059669' : checked ? '#B91C1C' : '#334155' }}>{normPalabra(it.ans)}</b>}
                  {!mostrar && !ok && !checked && <span style={{ marginLeft: 6, color: '#94A3B8', letterSpacing: 2 }}>{'_ '.repeat(normPalabra(it.ans).length)}</span>}
                </span>
                {ok && '✓'}
              </div>
            );
          })}
        </div>
        {!checked && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 8 }}>Arrastra de la primera a la última letra (o toca las dos).</div>}
      </div>
    </div>
  );
}
