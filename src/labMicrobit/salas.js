// Salas del Laboratorio micro:bit: plantillas y guardado en este navegador (localStorage).
// Sala = { id, nombre, ancho, largo, alto (0 = patio, sin paredes), suelo, pared, norte (grados),
//          muebles: [{ id, tipo, x, y, rot }], satelites: [{ k, x, y }] }

const LS = 'pikt_lab_salas';
const LS_ACTUAL = 'pikt_lab_sala_actual';

export const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function aula() {
  const muebles = [];
  for (let fila = 0; fila < 3; fila++) {
    for (let col = 0; col < 3; col++) {
      const x = 1.6 + col * 2.4, y = 2.6 + fila * 1.6;
      muebles.push({ id: nuevoId() + fila + col, tipo: 'mesa', x, y, rot: 0 });
      muebles.push({ id: nuevoId() + 's' + fila + col, tipo: 'silla', x, y: y + 0.55, rot: 0 });
    }
  }
  muebles.push(
    { id: nuevoId() + 'p', tipo: 'pizarra', x: 4, y: 0.03, rot: 0 },
    { id: nuevoId() + 'mp', tipo: 'mesaProfe', x: 6.6, y: 1.2, rot: 0 },
    { id: nuevoId() + 'pu', tipo: 'puerta', x: 8.46, y: 6.2, rot: -90 },
    { id: nuevoId() + 'v1', tipo: 'ventana', x: 0.04, y: 2.5, rot: 90 },
    { id: nuevoId() + 'v2', tipo: 'ventana', x: 0.04, y: 5.5, rot: 90 },
    { id: nuevoId() + 'e', tipo: 'estanteria', x: 4, y: 7.8, rot: 180 },
    { id: nuevoId() + 'pl', tipo: 'planta', x: 0.5, y: 7.5, rot: 0 },
  );
  return {
    nombre: 'Mi aula', ancho: 8.5, largo: 8, alto: 3, suelo: 'madera', pared: '#f1f5f9', norte: 0, muebles,
    satelites: [{ k: 1, x: 0.4, y: 0.4 }, { k: 2, x: 8.1, y: 0.4 }, { k: 3, x: 0.4, y: 7.6 }],
  };
}

function patio() {
  return {
    nombre: 'Patio', ancho: 20, largo: 14, alto: 0, suelo: 'pista', pared: '#f1f5f9', norte: 0,
    muebles: [
      { id: nuevoId() + 'a', tipo: 'porteria', x: 10, y: 0.6, rot: 0 },
      { id: nuevoId() + 'b', tipo: 'porteria', x: 10, y: 13.4, rot: 180 },
      ...[[4, 4], [16, 4], [4, 10], [16, 10], [10, 7]].map(([x, y], i) => ({ id: nuevoId() + 'c' + i, tipo: 'cono', x, y, rot: 0 })),
    ],
    satelites: [{ k: 1, x: 1, y: 1 }, { k: 2, x: 19, y: 1 }, { k: 3, x: 10, y: 13 }],
  };
}

function vacia() {
  return { nombre: 'Sala vacía', ancho: 6, largo: 5, alto: 2.7, suelo: 'baldosa', pared: '#e0f2fe', norte: 0, muebles: [], satelites: [{ k: 1, x: 0.5, y: 0.5 }, { k: 2, x: 5.5, y: 0.5 }, { k: 3, x: 3, y: 4.5 }] };
}

export const PLANTILLAS = [
  { id: 'aula', nombre: '🏫 Aula con mesas', crear: aula },
  { id: 'patio', nombre: '⚽ Patio', crear: patio },
  { id: 'vacia', nombre: '⬜ Sala vacía', crear: vacia },
];

export const crearDesdePlantilla = (pid) => ({ id: nuevoId(), ...(PLANTILLAS.find((p) => p.id === pid) || PLANTILLAS[0]).crear() });

export function leerSalas() {
  try {
    const l = JSON.parse(localStorage.getItem(LS) || '[]');
    if (Array.isArray(l) && l.length) return l;
  } catch { /* sin almacenamiento */ }
  return [crearDesdePlantilla('aula')];
}

export function guardarSalas(lista) {
  try { localStorage.setItem(LS, JSON.stringify(lista)); } catch { /* lleno o sin almacenamiento */ }
}

export const leerSalaActual = () => { try { return localStorage.getItem(LS_ACTUAL); } catch { return null; } };
export const guardarSalaActual = (id) => { try { localStorage.setItem(LS_ACTUAL, id); } catch { /* nada */ } };

/** Comprueba y completa una sala importada de un archivo .json. */
export function validarSala(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('El archivo no es una sala.');
  const num = (v, def, min, max) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };
  return {
    id: nuevoId(),
    nombre: String(obj.nombre || 'Sala importada').slice(0, 60),
    ancho: num(obj.ancho, 8, 2, 60), largo: num(obj.largo, 6, 2, 60), alto: num(obj.alto, 3, 0, 8),
    suelo: ['madera', 'baldosa', 'cesped', 'pista'].includes(obj.suelo) ? obj.suelo : 'madera',
    pared: /^#[0-9a-f]{6}$/i.test(obj.pared) ? obj.pared : '#f1f5f9',
    norte: num(obj.norte, 0, -360, 360),
    muebles: (Array.isArray(obj.muebles) ? obj.muebles : []).slice(0, 300).map((m) => ({
      id: nuevoId() + Math.random().toString(36).slice(2, 5), tipo: String(m.tipo), x: num(m.x, 1, 0, 60), y: num(m.y, 1, 0, 60), rot: num(m.rot, 0, -360, 360),
    })),
    satelites: (Array.isArray(obj.satelites) ? obj.satelites : []).slice(0, 4).map((s, i) => ({ k: i + 1, x: num(s.x, 1, 0, 60), y: num(s.y, 1, 0, 60) })),
  };
}
