// ─── Productos del supermercado compartidos ────────────────────────────────────
// Lo usan Cálculo con Dinero (Math World) y la situación de aprendizaje
// «Contabilidad del supermercado». Módulo ligero: no importa ningún componente.
//
// Tipos de IVA en España (Ley 37/1992, art. 91):
//   4 %  superreducido → pan, leche, huevos, quesos, frutas, verduras, legumbres,
//                        cereales, aceite de oliva, libros…
//   10 % reducido      → resto de alimentos (carne, pescado, yogures, zumos, agua…)
//   21 % general       → refrescos azucarados, alcohol, limpieza, higiene, textil,
//                        papelería, electricidad…

// Productos con rango de precio por unidad (en euros) — problemas de Cálculo con Dinero.
export const ITEMS = [
    { sing: 'barra de pan',   plural: 'barras de pan',   emoji: '🥖', iva: 4,  pmin: 0.6,  pmax: 1.4 },
    { sing: 'litro de leche', plural: 'litros de leche', emoji: '🥛', iva: 4,  pmin: 0.8,  pmax: 1.6 },
    { sing: 'huevo',          plural: 'huevos',          emoji: '🥚', iva: 4,  pmin: 0.2,  pmax: 0.4 },
    { sing: 'manzana',        plural: 'manzanas',        emoji: '🍎', iva: 4,  pmin: 0.3,  pmax: 0.8 },
    { sing: 'plátano',        plural: 'plátanos',        emoji: '🍌', iva: 4,  pmin: 0.2,  pmax: 0.6 },
    { sing: 'naranja',        plural: 'naranjas',        emoji: '🍊', iva: 4,  pmin: 0.3,  pmax: 0.7 },
    { sing: 'yogur',          plural: 'yogures',         emoji: '🍦', iva: 10, pmin: 0.4,  pmax: 0.9 },
    { sing: 'libro',          plural: 'libros',          emoji: '📚', iva: 4,  pmin: 8,    pmax: 22 },
    { sing: 'paquete de pasta', plural: 'paquetes de pasta', emoji: '🍝', iva: 10, pmin: 0.9, pmax: 2 },
    { sing: 'zumo',           plural: 'zumos',           emoji: '🧃', iva: 10, pmin: 1,    pmax: 2.5 },
    { sing: 'pizza',          plural: 'pizzas',          emoji: '🍕', iva: 10, pmin: 3,    pmax: 7 },
    { sing: 'helado',         plural: 'helados',         emoji: '🍨', iva: 10, pmin: 1.5,  pmax: 3.5 },
    { sing: 'cuaderno',       plural: 'cuadernos',       emoji: '📓', iva: 21, pmin: 1.5,  pmax: 4 },
    { sing: 'lápiz',          plural: 'lápices',         emoji: '✏️', iva: 21, pmin: 0.4,  pmax: 1.2 },
    { sing: 'camiseta',       plural: 'camisetas',       emoji: '👕', iva: 21, pmin: 6,    pmax: 18 },
    { sing: 'balón',          plural: 'balones',         emoji: '⚽', iva: 21, pmin: 8,    pmax: 20 },
    { sing: 'mochila',        plural: 'mochilas',        emoji: '🎒', iva: 21, pmin: 10,   pmax: 30 },
    { sing: 'juguete',        plural: 'juguetes',        emoji: '🧸', iva: 21, pmin: 5,    pmax: 25 },
];

// Lista de precios del supermercado (precio de venta al público en CÉNTIMOS, IVA incluido).
// Cálculo con Dinero la usa en «Lista de la compra» (solo nombre/emoji/precio).
export const PRODUCTOS = [
    { nombre: 'Pan',       emoji: '🥖', precio: 90,  iva: 4  },
    { nombre: 'Leche',     emoji: '🥛', precio: 120, iva: 4  },
    { nombre: 'Huevos',    emoji: '🥚', precio: 250, iva: 4  },
    { nombre: 'Yogures',   emoji: '🍦', precio: 175, iva: 10 },
    { nombre: 'Queso',     emoji: '🧀', precio: 320, iva: 4  },
    { nombre: 'Manzanas',  emoji: '🍎', precio: 180, iva: 4  },
    { nombre: 'Plátanos',  emoji: '🍌', precio: 150, iva: 4  },
    { nombre: 'Naranjas',  emoji: '🍊', precio: 140, iva: 4  },
    { nombre: 'Tomates',   emoji: '🍅', precio: 160, iva: 4  },
    { nombre: 'Lechuga',   emoji: '🥬', precio: 80,  iva: 4  },
    { nombre: 'Arroz',     emoji: '🍚', precio: 110, iva: 4  },
    { nombre: 'Pasta',     emoji: '🍝', precio: 95,  iva: 10 },
    { nombre: 'Aceite',    emoji: '🫒', precio: 450, iva: 4  },
    { nombre: 'Zumo',      emoji: '🧃', precio: 130, iva: 10 },
    { nombre: 'Pizza',     emoji: '🍕', precio: 350, iva: 10 },
    { nombre: 'Galletas',  emoji: '🍪', precio: 145, iva: 10 },
    { nombre: 'Chocolate', emoji: '🍫', precio: 160, iva: 10 },
    { nombre: 'Agua',      emoji: '💧', precio: 190, iva: 10 },
    { nombre: 'Pollo',     emoji: '🍗', precio: 390, iva: 10 },
    { nombre: 'Pescado',   emoji: '🐟', precio: 480, iva: 10 },
];

// Productos del súper con IVA general (21 %). No se mezclan con PRODUCTOS para no
// cambiar la «Lista de la compra» de Cálculo con Dinero.
export const PRODUCTOS_21 = [
    { nombre: 'Refresco de cola', emoji: '🥤', precio: 165, iva: 21 },
    { nombre: 'Detergente',       emoji: '🧴', precio: 695, iva: 21 },
    { nombre: 'Papel higiénico',  emoji: '🧻', precio: 450, iva: 21 },
    { nombre: 'Champú',           emoji: '🧼', precio: 325, iva: 21 },
    { nombre: 'Cerveza (pack 6)', emoji: '🍺', precio: 420, iva: 21 },
    { nombre: 'Lejía',            emoji: '🧪', precio: 110, iva: 21 },
    { nombre: 'Cuaderno',         emoji: '📓', precio: 250, iva: 21 },
];
