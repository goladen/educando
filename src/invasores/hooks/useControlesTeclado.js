// Teclado físico (PC / pizarra con teclado). Con 1 jugador vale cualquier tecla; con 2 o más:
//   J1 → fila de números, −, Retroceso, Espacio  ·  A / D / W (variante 2)
//   J2 → teclado numérico, −, +, Intro          ·  ← / → / ↑ (variante 2)
// J3 y J4 juegan solo con la pantalla táctil.
import { useEffect, useRef } from 'react';

const esCampo = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);

function jugadorDeTecla(code, n) {
  if (n <= 1) return 0;
  if (/^Numpad/.test(code) || code === 'Enter' || /^Arrow/.test(code)) return 1;
  return 0;
}

function teclaV1(e, modo) {
  const { code, key } = e;
  if (code === 'Backspace' || code === 'NumpadAdd') return 'DEL';
  if (code === 'Escape' || code === 'Delete') return 'CLR';
  if (code === 'Space' && modo !== 'letras') return 'FUEGO';
  if (code === 'Enter' || code === 'NumpadEnter') return 'FUEGO';
  if (modo === 'letras') {
    if (code === 'Space') return ' ';
    if (/^\p{L}$/u.test(key)) return key.toUpperCase();
    if (/^\d$/.test(key)) return key;
    return null;
  }
  if (/^(Digit|Numpad)\d$/.test(code)) return code.slice(-1);
  if (code === 'Minus' || code === 'NumpadSubtract' || key === '-') return '±';
  if (code === 'Comma' || code === 'Period' || code === 'NumpadDecimal') return ',';
  if (modo === 'opciones' && /^Key[A-D]$/.test(code)) return 'ABCD'.indexOf(code.slice(-1)) + 1 + '';
  return null;
}

const MOV = {
  KeyA: ['izq', 0], KeyD: ['der', 0], KeyW: ['fuego', 0], Space: ['fuego', 0],
  ArrowLeft: ['izq', 1], ArrowRight: ['der', 1], ArrowUp: ['fuego', 1], Enter: ['fuego', 1], NumpadEnter: ['fuego', 1],
};

/**
 * activo: solo durante la partida · variante: 'DISPARA' | 'FILTRO'
 * modoDe(j) → 'numerico' | 'opciones' | 'letras' · acciones: { tecla(j, t), elegir(j, k), fuego(j), input(j, patch) }
 */
export function useControlesTeclado({ activo, variante, numJugadores, modoDe, acciones }) {
  const ref = useRef({ modoDe, acciones });
  ref.current = { modoDe, acciones };

  useEffect(() => {
    if (!activo) return undefined;
    const abajo = (e) => {
      if (esCampo(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const { modoDe: md, acciones: ac } = ref.current;
      if (variante === 'FILTRO') {
        const m = MOV[e.code];
        if (!m) return;
        const j = numJugadores <= 1 ? 0 : m[1];
        if (j >= numJugadores) return;
        e.preventDefault();
        if (e.repeat) return;
        ac.input(j, m[0] === 'fuego' ? { fuego: true, toque: true } : { [m[0]]: true });
        return;
      }
      const j = jugadorDeTecla(e.code, numJugadores);
      if (j >= numJugadores) return;
      const modo = md(j);
      const t = teclaV1(e, modo);
      if (!t) return;
      e.preventDefault();
      if (t === 'FUEGO') { if (!e.repeat) ac.fuego(j); return; }
      if (modo === 'opciones' && /^[1-4]$/.test(t)) { ac.elegir(j, Number(t) - 1); return; }
      if (modo === 'opciones') return;
      ac.tecla(j, t);
    };
    const arriba = (e) => {
      if (variante !== 'FILTRO') return;
      const m = MOV[e.code];
      if (!m) return;
      const j = numJugadores <= 1 ? 0 : m[1];
      if (j >= numJugadores) return;
      ref.current.acciones.input(j, { [m[0]]: false });
    };
    window.addEventListener('keydown', abajo);
    window.addEventListener('keyup', arriba);
    return () => { window.removeEventListener('keydown', abajo); window.removeEventListener('keyup', arriba); };
  }, [activo, variante, numJugadores]);
}
