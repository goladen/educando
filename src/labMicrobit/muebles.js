// Catálogo de muebles para la sala 3D del Laboratorio micro:bit: piezas sencillas (low poly)
// hechas con cajas y cilindros. Medidas en metros: w (ancho), d (fondo), h (alto).
// Los de pared (pared: true) se pegan a la pared más cercana mirando hacia dentro.
import * as THREE from 'three';

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...extra });

function caja(g, w, h, d, color, x = 0, y = 0, z = 0, extra) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, extra));
  m.position.set(x, y + h / 2, z);
  m.castShadow = true; m.receiveShadow = true;
  g.add(m);
  return m;
}
function cilindro(g, r1, r2, h, color, x = 0, y = 0, z = 0, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat(color));
  m.position.set(x, y + h / 2, z);
  m.castShadow = true; m.receiveShadow = true;
  g.add(m);
  return m;
}
const patas = (g, w, d, h, color, r = 0.025) => {
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => cilindro(g, r, r, h, color, sx * (w / 2 - 0.05), 0, sz * (d / 2 - 0.05), 8));
};

export const MUEBLES = {
  mesa: {
    nombre: 'Mesa', emoji: '🪑', w: 1.2, d: 0.6, h: 0.75,
    crear(g) { caja(g, 1.2, 0.04, 0.6, 0xd4a373, 0, 0.71); patas(g, 1.2, 0.6, 0.71, 0x64748b); },
  },
  mesaProfe: {
    nombre: 'Mesa del profe', emoji: '🧑‍🏫', w: 1.6, d: 0.8, h: 0.75,
    crear(g) { caja(g, 1.6, 0.05, 0.8, 0x8d5a3b, 0, 0.7); caja(g, 1.5, 0.6, 0.05, 0x7c4a2d, 0, 0.1, 0.35); patas(g, 1.6, 0.8, 0.7, 0x475569, 0.03); },
  },
  silla: {
    nombre: 'Silla', emoji: '💺', w: 0.45, d: 0.45, h: 0.85,
    crear(g) { caja(g, 0.42, 0.04, 0.42, 0x2563eb, 0, 0.44); caja(g, 0.42, 0.38, 0.04, 0x2563eb, 0, 0.48, 0.19); patas(g, 0.45, 0.45, 0.44, 0x334155, 0.018); },
  },
  pizarra: {
    nombre: 'Pizarra', emoji: '🟩', w: 3, d: 0.06, h: 1.3, pared: true, altura: 0.85,
    crear(g) { caja(g, 3.1, 1.3, 0.04, 0x92400e, 0, 0); caja(g, 2.95, 1.18, 0.05, 0x14532d, 0, 0.06, 0.005); caja(g, 3, 0.04, 0.12, 0x92400e, 0, -0.02, 0.06); },
  },
  pantalla: {
    nombre: 'Pantalla digital', emoji: '🖥️', w: 1.7, d: 0.08, h: 1, pared: true, altura: 0.95,
    crear(g) { caja(g, 1.7, 1, 0.07, 0x111827, 0, 0); caja(g, 1.6, 0.9, 0.02, 0x38bdf8, 0, 0.05, 0.035, { emissive: 0x0c4a6e, emissiveIntensity: 0.6 }); },
  },
  puerta: {
    nombre: 'Puerta', emoji: '🚪', w: 0.9, d: 0.08, h: 2.05, pared: true, altura: 0,
    crear(g) { caja(g, 1, 2.1, 0.06, 0xe2e8f0, 0, 0); caja(g, 0.88, 2.02, 0.07, 0xb45309, 0, 0); cilindro(g, 0.025, 0.025, 0.12, 0xfbbf24, 0.33, 0.95, 0.06, 8).rotation.x = Math.PI / 2; },
  },
  ventana: {
    nombre: 'Ventana', emoji: '🪟', w: 1.5, d: 0.08, h: 1.2, pared: true, altura: 1,
    crear(g) {
      caja(g, 1.5, 1.2, 0.05, 0xf8fafc, 0, 0);
      caja(g, 1.38, 1.08, 0.06, 0x7dd3fc, 0, 0.06, 0, { transparent: true, opacity: 0.55, emissive: 0x0ea5e9, emissiveIntensity: 0.25 });
      caja(g, 0.04, 1.08, 0.07, 0xf8fafc, 0, 0.06); caja(g, 1.38, 0.04, 0.07, 0xf8fafc, 0, 0.58);
    },
  },
  armario: {
    nombre: 'Armario', emoji: '🗄️', w: 1, d: 0.5, h: 2,
    crear(g) { caja(g, 1, 2, 0.5, 0xcbd5e1, 0, 0); caja(g, 0.01, 1.9, 0.01, 0x64748b, 0, 0.05, 0.255); [-0.08, 0.08].forEach(x => caja(g, 0.03, 0.2, 0.03, 0x475569, x, 0.95, 0.26)); },
  },
  estanteria: {
    nombre: 'Estantería', emoji: '📚', w: 1.2, d: 0.35, h: 1.8,
    crear(g) {
      caja(g, 0.04, 1.8, 0.35, 0x92400e, -0.58, 0); caja(g, 0.04, 1.8, 0.35, 0x92400e, 0.58, 0);
      const colores = [0xef4444, 0x3b82f6, 0x22c55e, 0xf59e0b, 0x8b5cf6];
      [0, 0.45, 0.9, 1.35, 1.76].forEach((y, i) => {
        caja(g, 1.16, 0.04, 0.35, 0xb45309, 0, y);
        if (i < 4) for (let j = 0; j < 7; j++) caja(g, 0.07 + (j % 3) * 0.02, 0.26 + (j % 2) * 0.06, 0.24, colores[(i + j) % 5], -0.45 + j * 0.15, y + 0.04);
      });
    },
  },
  alfombra: {
    nombre: 'Alfombra', emoji: '🟪', w: 2, d: 1.4, h: 0.02,
    crear(g) { caja(g, 2, 0.015, 1.4, 0x7c3aed, 0, 0); caja(g, 1.7, 0.017, 1.1, 0xa78bfa, 0, 0); },
  },
  planta: {
    nombre: 'Planta', emoji: '🪴', w: 0.45, d: 0.45, h: 1.1,
    crear(g) {
      cilindro(g, 0.2, 0.15, 0.35, 0xc2410c);
      const hojas = new THREE.Mesh(new THREE.IcosahedronGeometry(0.33, 1), mat(0x16a34a, { flatShading: true }));
      hojas.position.y = 0.72; hojas.castShadow = true; g.add(hojas);
    },
  },
  columna: {
    nombre: 'Columna', emoji: '🏛️', w: 0.4, d: 0.4, h: 3,
    crear(g, sala) { caja(g, 0.4, sala?.alto || 3, 0.4, 0xe5e7eb, 0, 0); },
  },
  cono: {
    nombre: 'Cono (patio)', emoji: '🔶', w: 0.3, d: 0.3, h: 0.45,
    crear(g) { cilindro(g, 0.01, 0.15, 0.45, 0xf97316, 0, 0, 0, 20); caja(g, 0.32, 0.03, 0.32, 0xf97316, 0, 0); },
  },
  porteria: {
    nombre: 'Portería (patio)', emoji: '🥅', w: 3, d: 1, h: 2,
    crear(g) {
      [-1.5, 1.5].forEach(x => cilindro(g, 0.05, 0.05, 2, 0xffffff, x, 0, 0, 10));
      const t = cilindro(g, 0.05, 0.05, 3.1, 0xffffff, 0, 0, 0, 10); t.rotation.z = Math.PI / 2; t.position.y = 2;
      const red = new THREE.Mesh(new THREE.PlaneGeometry(3, 2), mat(0xffffff, { transparent: true, opacity: 0.25, side: THREE.DoubleSide, wireframe: true }));
      red.position.set(0, 1, -0.5); g.add(red);
    },
  },
};

export const TIPOS_MUEBLE = Object.keys(MUEBLES);

/** Grupo three.js de un mueble (origen en el suelo, centrado). */
export function crearMueble(tipo, sala) {
  const def = MUEBLES[tipo] || MUEBLES.mesa;
  const g = new THREE.Group();
  def.crear(g, sala);
  return g;
}

/**
 * Pega un mueble de pared a la pared más cercana: devuelve { x, y, rot } (rot en grados, mirando
 * hacia dentro de la sala). Coordenadas de sala (origen en una esquina).
 */
export function pegarAPared(x, y, sala, fondo = 0.06) {
  const opciones = [
    { d: y, x, y: fondo / 2, rot: 0 },                          // pared de y = 0 (mira hacia +y)
    { d: sala.largo - y, x, y: sala.largo - fondo / 2, rot: 180 },
    { d: x, x: fondo / 2, y, rot: 90 },                          // pared de x = 0
    { d: sala.ancho - x, x: sala.ancho - fondo / 2, y, rot: -90 },
  ];
  const o = opciones.sort((a, b) => a.d - b.d)[0];
  return { x: Math.min(Math.max(o.x, 0), sala.ancho), y: Math.min(Math.max(o.y, 0), sala.largo), rot: o.rot };
}
