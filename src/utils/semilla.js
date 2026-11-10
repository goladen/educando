// ─── Azar con semilla ────────────────────────────────────────────────────────
// Para que una ficha PDF y un juego tengan EXACTAMENTE las mismas preguntas, en el
// mismo orden y con las opciones colocadas igual: se genera todo dentro de
// conSemilla(semilla, fn), que sustituye Math.random por un generador repetible
// mientras dura fn (tiene que ser síncrona). Con la misma semilla y el mismo
// contenido, sale siempre lo mismo (en cualquier ordenador).

/** Generador mulberry32: rápido y suficiente para barajar preguntas. */
export function aleatorioConSemilla(semilla) {
  let a = (Number(semilla) >>> 0) || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const nuevaSemilla = () => Math.floor(Math.random() * 2 ** 31) + 1;

/** Ejecuta fn() con Math.random sustituido por el generador de la semilla. */
export function conSemilla(semilla, fn) {
  const original = Math.random;
  Math.random = aleatorioConSemilla(semilla);
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}
