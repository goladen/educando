// src/data/mensekiData.js
// Retos Menseki (laberintos de áreas). Coordenadas de cuadrícula visual (no a escala).
// rects: { id, x, y, w, h, area }  → area: número, "?" (incógnita) o null (en blanco)
// cotas: { lado, desde: [x, y], hasta: [x, y], valor } → valor: número o "?"

export const MENSEKI_BASE = [
  // ==========================================
  // PRIMARIA (15 RETOS - 5º y 6º de Primaria)
  // ==========================================
  {
    id: "prim-01",
    nivel: "primaria",
    dificultad: 1,
    titulo: "Misma altura",
    rects: [
      { id: "A", x: 0, y: 0, w: 2, h: 2, area: 20 },
      { id: "B", x: 2, y: 0, w: 3, h: 2, area: "?" }
    ],
    cotas: [
      { lado: "top", desde: [0, 0], hasta: [2, 0], valor: 4 },
      { lado: "top", desde: [2, 0], hasta: [5, 0], valor: 6 }
    ],
    solucion: 30,
    unidad: "cm²",
    pista: "Calcula primero cuánto mide la altura usando el rectángulo de la izquierda.",
    explicacion: "Altura = 20 ÷ 4 = 5 cm. Área desconocida = 6 × 5 = 30 cm²."
  },
  {
    id: "prim-02",
    nivel: "primaria",
    dificultad: 1,
    titulo: "Misma base",
    rects: [
      { id: "A", x: 0, y: 0, w: 3, h: 2, area: 21 },
      { id: "B", x: 0, y: 2, w: 3, h: 2, area: 35 }
    ],
    cotas: [
      { lado: "left", desde: [0, 0], hasta: [0, 2], valor: 3 },
      { lado: "left", desde: [0, 2], hasta: [0, 4], valor: "?" }
    ],
    solucion: 5,
    unidad: "cm",
    pista: "Los dos rectángulos tienen exactamente el mismo ancho.",
    explicacion: "Ancho = 21 ÷ 3 = 7 cm. Altura inferior = 35 ÷ 7 = 5 cm."
  },
  {
    id: "prim-03",
    nivel: "primaria",
    dificultad: 1,
    titulo: "Base total",
    rects: [
      { id: "A", x: 0, y: 0, w: 2, h: 2, area: 30 },
      { id: "B", x: 2, y: 0, w: 2, h: 2, area: 24 }
    ],
    cotas: [
      { lado: "left", desde: [0, 0], hasta: [0, 2], valor: 6 },
      { lado: "bottom", desde: [0, 2], hasta: [4, 2], valor: "?" }
    ],
    solucion: 9,
    unidad: "cm",
    pista: "Puedes hallar cada base por separado o sumar las dos áreas primero.",
    explicacion: "Área total = 30 + 24 = 54 cm². Base total = 54 ÷ 6 = 9 cm."
  },
  {
    id: "prim-04",
    nivel: "primaria",
    dificultad: 1,
    titulo: "Lo que sobra",
    rects: [
      { id: "A", x: 0, y: 0, w: 2, h: 2, area: 32 },
      { id: "B", x: 2, y: 0, w: 2, h: 2, area: "?" }
    ],
    cotas: [
      { lado: "left", desde: [0, 0], hasta: [0, 2], valor: 8 },
      { lado: "top", desde: [0, 0], hasta: [4, 0], valor: 9 }
    ],
    solucion: 40,
    unidad: "cm²",
    pista: "Calcula el área del rectángulo grande completo y réstale la parte conocida.",
    explicacion: "Área total = 9 × 8 = 72 cm². Área derecha = 72 − 32 = 40 cm²."
  },
  {
    id: "prim-05",
    nivel: "primaria",
    dificultad: 2,
    titulo: "Cuadrícula 2×2",
    rects: [
      { id: "A", x: 0, y: 0, w: 2, h: 2, area: 12 },
      { id: "B", x: 2, y: 0, w: 3, h: 2, area: 21 },
      { id: "C", x: 0, y: 2, w: 2, h: 2, area: 20 },
      { id: "D", x: 2, y: 2, w: 3, h: 2, area: "?" }
    ],
    cotas: [
      { lado: "top", desde: [0, 0], hasta: [2, 0], valor: 4 }
    ],
    solucion: 35,
    unidad: "cm²",
    pista: "Empieza por el rectángulo de 12 cm² para descubrir las alturas y el otro ancho.",
    explicacion: "Altura fila 1 = 12 ÷ 4 = 3 cm. Ancho col 2 = 21 ÷ 3 = 7 cm. Altura fila 2 = 20 ÷ 4 = 5 cm. Área = 7 × 5 = 35 cm²."
  },
  {
    id: "prim-06",
    nivel: "primaria",
    dificultad: 2,
    titulo: "Camino en L",
    rects: [
      { id: "A", x: 0, y: 0, w: 2, h: 2, area: 24 },
      { id: "B", x: 2, y: 0, w: 2, h: 2, area: 20 },
      { id: "C", x: 0, y: 2, w: 2, h: 3, area: 48 },
      { id: "D", x: 2, y: 2, w: 2, h: 3, area: null }
    ],
    cotas: [
      { lado: "top", desde: [2, 0], hasta: [4, 0], valor: 5 },
      { lado: "left", desde: [0, 2], hasta: [0, 5], valor: "?" }
    ],
    solucion: 8,
    unidad: "cm",
    pista: "Empieza por arriba a la derecha (20 cm²) y ve pasando medidas hacia la izquierda.",
    explicacion: "Altura fila 1 = 20 ÷ 5 = 4 cm. Ancho col 1 = 24 ÷ 4 = 6 cm. Altura buscada = 48 ÷ 6 = 8 cm."
  },
  {
    id: "prim-07",
    nivel: "primaria",
    dificultad: 2,
    titulo: "Ancho compartido",
    rects: [
      { id: "A", x: 0, y: 0, w: 2, h: 2, area: 30 },
      { id: "B", x: 2, y: 0, w: 2, h: 2, area: null },
      { id: "C", x: 0, y: 2, w: 2, h: 2, area: 15 },
      { id: "D", x: 2, y: 2, w: 2, h: 2, area: "?" }
    ],
    cotas: [
      { lado: "left", desde: [0, 0], hasta: [0, 2], valor: 6 },
      { lado: "top", desde: [0, 0], hasta: [4, 0], valor: 9 }
    ],
    solucion: 12,
    unidad: "cm²",
    pista: "Halla el ancho de la columna izquierda y réstaselo a 9 cm.",
    explicacion: "Ancho col 1 = 30 ÷ 6 = 5 cm → ancho col 2 = 9 − 5 = 4 cm. Altura fila 2 = 15 ÷ 5 = 3 cm. Área = 4 × 3 = 12 cm²."
  },
  {
    id: "prim-08",
    nivel: "primaria",
    dificultad: 2,
    titulo: "Techo doble",
    rects: [
      { id: "A", x: 0, y: 0, w: 2, h: 2, area: 12 },
      { id: "B", x: 2, y: 0, w: 3, h: 2, area: 24 },
      { id: "C", x: 0, y: 2, w: 5, h: 2, area: "?" }
    ],
    cotas: [
      { lado: "left", desde: [0, 0], hasta: [0, 2], valor: 4 },
      { lado: "left", desde: [0, 2], hasta: [0, 4], valor: 5 }
    ],
    solucion: 45,
    unidad: "cm²",
    pista: "Suma las áreas de arriba para encontrar la base total de la figura.",
    explicacion: "Área superior = 12 + 24 = 36 cm². Base total = 36 ÷ 4 = 9 cm. Área inferior = 9 × 5 = 45 cm²."
  },
  {
    id: "prim-09",
    nivel: "primaria",
    dificultad: 2,
    titulo: "Torre y pisos",
    rects: [
      { id: "A", x: 0, y: 0, w: 2, h: 4, area: 45 },
      { id: "B", x: 2, y: 0, w: 2, h: 2, area: 12 },
      { id: "C", x: 2, y: 2, w: 2, h: 2, area: "?" }
    ],
    cotas: [
      { lado: "top", desde: [0, 0], hasta: [2, 0], valor: 5 },
      { lado: "top", desde: [2, 0], hasta: [4, 0], valor: 4 }
    ],
    solucion: 24,
    unidad: "cm²",
    pista: "La altura del rectángulo de 45 cm² es igual a la suma de las dos alturas de la derecha.",
    explicacion: "Altura total = 45 ÷ 5 = 9 cm. Altura superior derecha = 12 ÷ 4 = 3 cm. Altura inferior = 9 − 3 = 6 cm. Área = 4 × 6 = 24 cm²."
  },
  {
    id: "prim-10",
    nivel: "primaria",
    dificultad: 3,
    titulo: "El doble sin medidas",
    rects: [
      { id: "A", x: 0, y: 0, w: 2, h: 2, area: 12 },
      { id: "B", x: 2, y: 0, w: 3, h: 2, area: 24 },
      { id: "C", x: 0, y: 2, w: 2, h: 2, area: 20 },
      { id: "D", x: 2, y: 2, w: 3, h: 2, area: "?" }
    ],
    cotas: [],
    solucion: 40,
    unidad: "cm²",
    pista: "No necesitas saber los lados: compara 12 y 24 en la fila de arriba.",
    explicacion: "Como 24 es el doble de 12, la columna derecha es el doble de ancha que la izquierda. Por tanto, el área buscada es el doble de 20: 20 × 2 = 40 cm²."
  },
  {
    id: "prim-11",
    nivel: "primaria",
    dificultad: 3,
    titulo: "El triple vertical",
    rects: [
      { id: "A", x: 0, y: 0, w: 2, h: 2, area: 15 },
      { id: "B", x: 2, y: 0, w: 2, h: 2, area: 21 },
      { id: "C", x: 0, y: 2, w: 2, h: 3, area: 45 },
      { id: "D", x: 2, y: 2, w: 2, h: 3, area: "?" }
    ],
    cotas: [],
    solucion: 63,
    unidad: "cm²",
    pista: "Fíjate cuántas veces cabe el rectángulo de 15 cm² dentro del de 45 cm².",
    explicacion: "45 ÷ 15 = 3, así que la fila de abajo es 3 veces más alta que la de arriba. Área buscada = 21 × 3 = 63 cm²."
  },
  {
    id: "prim-12",
    nivel: "primaria",
    dificultad: 3,
    titulo: "El hueco central",
    rects: [
      { id: "A", x: 0, y: 0, w: 2, h: 2, area: 28 },
      { id: "B", x: 2, y: 0, w: 2, h: 2, area: "?" },
      { id: "C", x: 4, y: 0, w: 2, h: 2, area: 21 }
    ],
    cotas: [
      { lado: "left", desde: [0, 0], hasta: [0, 2], valor: 7 },
      { lado: "bottom", desde: [0, 2], hasta: [6, 2], valor: 12 }
    ],
    solucion: 35,
    unidad: "cm²",
    pista: "Halla el área total de los tres rectángulos juntos y resta los dos extremos.",
    explicacion: "Área total = 12 × 7 = 84 cm². Área central = 84 − 28 − 21 = 35 cm²."
  },
  {
    id: "prim-13",
    nivel: "primaria",
    dificultad: 3,
    titulo: "Bota en L",
    rects: [
      { id: "A", x: 0, y: 0, w: 2, h: 2, area: 24 },
      { id: "B", x: 0, y: 2, w: 2, h: 2, area: 30 },
      { id: "C", x: 2, y: 2, w: 3, h: 2, area: "?" }
    ],
    cotas: [
      { lado: "left", desde: [0, 0], hasta: [0, 2], valor: 4 },
      { lado: "bottom", desde: [0, 4], hasta: [5, 4], valor: 14 }
    ],
    solucion: 40,
    unidad: "cm²",
    pista: "Averigua primero el ancho de la columna izquierda usando el rectángulo de 24 cm².",
    explicacion: "Ancho izquierdo = 24 ÷ 4 = 6 cm → ancho derecho = 14 − 6 = 8 cm. Altura inferior = 30 ÷ 6 = 5 cm. Área = 8 × 5 = 40 cm²."
  },
  {
    id: "prim-14",
    nivel: "primaria",
    dificultad: 3,
    titulo: "Unir para dividir",
    rects: [
      { id: "A", x: 0, y: 0, w: 2, h: 2, area: 24 },
      { id: "B", x: 2, y: 0, w: 2, h: 2, area: 30 },
      { id: "C", x: 0, y: 2, w: 2, h: 2, area: "?" },
      { id: "D", x: 2, y: 2, w: 2, h: 2, area: 20 }
    ],
    cotas: [
      { lado: "top", desde: [0, 0], hasta: [4, 0], valor: 9 }
    ],
    solucion: 16,
    unidad: "cm²",
    pista: "Junta los dos rectángulos de arriba (24 + 30) para encontrar la altura de la primera fila.",
    explicacion: "Fila superior = 24 + 30 = 54 cm² → altura = 54 ÷ 9 = 6 cm. Anchos: 24 ÷ 6 = 4 cm y 30 ÷ 6 = 5 cm. Altura fila 2 = 20 ÷ 5 = 4 cm. Área = 4 × 4 = 16 cm²."
  },
  {
    id: "prim-15",
    nivel: "primaria",
    dificultad: 3,
    titulo: "Altura total",
    rects: [
      { id: "A", x: 0, y: 0, w: 2, h: 2, area: 30 },
      { id: "B", x: 2, y: 0, w: 2, h: 2, area: 20 },
      { id: "C", x: 0, y: 2, w: 2, h: 2, area: 18 },
      { id: "D", x: 2, y: 2, w: 2, h: 2, area: null }
    ],
    cotas: [
      { lado: "top", desde: [0, 0], hasta: [4, 0], valor: 10 },
      { lado: "left", desde: [0, 0], hasta: [0, 4], valor: "?" }
    ],
    solucion: 8,
    unidad: "cm",
    pista: "Suma 30 y 20 para hallar la altura superior, y luego saca el ancho de la columna izquierda.",
    explicacion: "Fila superior = 50 cm² → altura 1 = 50 ÷ 10 = 5 cm. Ancho izquierdo = 30 ÷ 5 = 6 cm → altura 2 = 18 ÷ 6 = 3 cm. Altura total = 5 + 3 = 8 cm."
  },

  // ==========================================
  // SECUNDARIA (15 RETOS - 1º a 4º de ESO)
  // ==========================================
  {
    id: "sec-01",
    nivel: "secundaria",
    dificultad: 3,
    titulo: "Sin decimales",
    rects: [
      { id: "A", x: 0, y: 0, w: 2, h: 2, area: 14 },
      { id: "B", x: 2, y: 0, w: 2, h: 2, area: 18 },
      { id: "C", x: 0, y: 2, w: 2, h: 2, area: 21 },
      { id: "D", x: 2, y: 2, w: 2, h: 2, area: "?" }
    ],
    cotas: [
      { lado: "top", desde: [0, 0], hasta: [4, 0], valor: 8 },
      { lado: "left", desde: [0, 0], hasta: [0, 4], valor: 10 }
    ],
    solucion: 27,
    unidad: "cm²",
    pista: "Si intentas calcular los anchos individuales salen decimales. ¡Prueba a trabajar con las filas completas!",
    explicacion: "Fila superior = 14 + 18 = 32 cm² → altura 1 = 32 ÷ 8 = 4 cm. Altura 2 = 10 − 4 = 6 cm. Fila inferior completa = 8 × 6 = 48 cm². Área D = 48 − 21 = 27 cm²."
  },
  {
    id: "sec-02",
    nivel: "secundaria",
    dificultad: 3,
    titulo: "Efecto dominó 2×3",
    rects: [
      { id: "A", x: 0, y: 0, w: 2, h: 2, area: 12 },
      { id: "B", x: 2, y: 0, w: 2, h: 2, area: 18 },
      { id: "C", x: 4, y: 0, w: 2, h: 2, area: null },
      { id: "D", x: 0, y: 2, w: 2, h: 3, area: "?" },
      { id: "E", x: 2, y: 2, w: 2, h: 3, area: 42 },
      { id: "F", x: 4, y: 2, w: 2, h: 3, area: 35 }
    ],
    cotas: [
      { lado: "top", desde: [4, 0], hasta: [6, 0], valor: 5 }
    ],
    solucion: 28,
    unidad: "cm²",
    pista: "Recorre la figura en zigzag empezando por el rectángulo de 35 cm².",
    explicacion: "Altura fila 2 = 35 ÷ 5 = 7 cm → ancho col 2 = 42 ÷ 7 = 6 cm → altura fila 1 = 18 ÷ 6 = 3 cm → ancho col 1 = 12 ÷ 3 = 4 cm. Área D = 4 × 7 = 28 cm²."
  },
  {
    id: "sec-03",
    nivel: "secundaria",
    dificultad: 3,
    titulo: "Razón 2 a 3",
    rects: [
      { id: "A", x: 0, y: 0, w: 2, h: 2, area: 20 },
      { id: "B", x: 2, y: 0, w: 3, h: 2, area: 30 },
      { id: "C", x: 0, y: 2, w: 2, h: 3, area: 32 },
      { id: "D", x: 2, y: 2, w: 3, h: 3, area: "?" }
    ],
    cotas: [],
    solucion: 48,
    unidad: "cm²",
    pista: "Simplifica la proporción entre 20 y 30: esa misma proporción se mantiene abajo.",
    explicacion: "La razón entre los anchos es 20 : 30 = 2 : 3. Como 32 = 2 × 16, el área buscada es 3 × 16 = 48 cm²."
  },
  {
    id: "sec-04",
    nivel: "secundaria",
    dificultad: 3,
    titulo: "Suma vertical y proporción",
    rects: [
      { id: "A", x: 0, y: 0, w: 2, h: 2, area: 14 },
      { id: "B", x: 2, y: 0, w: 3, h: 2, area: 21 },
      { id: "C", x: 0, y: 2, w: 2, h: 2, area: 18 },
      { id: "D", x: 2, y: 2, w: 3, h: 2, area: null }
    ],
    cotas: [
      { lado: "left", desde: [0, 0], hasta: [0, 4], valor: 8 },
      { lado: "top", desde: [0, 0], hasta: [5, 0], valor: "?" }
    ],
    solucion: 10,
    unidad: "cm",
    pista: "Suma 14 y 18 para sacar el ancho izquierdo, y usa la razón 14 : 21 para el derecho.",
    explicacion: "Columna izquierda = 14 + 18 = 32 cm² → ancho 1 = 32 ÷ 8 = 4 cm. Como 14 : 21 = 2 : 3, ancho 2 = 4 × 3 ÷ 2 = 6 cm. Total = 4 + 6 = 10 cm."
  },
  {
    id: "sec-05",
    nivel: "secundaria",
    dificultad: 4,
    titulo: "El escalón",
    rects: [
      { id: "A", x: 0, y: 0, w: 2, h: 3, area: 50 },
      { id: "B", x: 2, y: 1, w: 3, h: 2, area: "?" }
    ],
    cotas: [
      { lado: "top", desde: [0, 0], hasta: [2, 0], valor: 5 },
      { lado: "right", desde: [2, 0], hasta: [2, 1], valor: 3 },
      { lado: "bottom", desde: [0, 3], hasta: [5, 3], valor: 13 }
    ],
    solucion: 56,
    unidad: "cm²",
    pista: "El escalón de 3 cm te da la diferencia exacta entre las alturas de ambos rectángulos.",
    explicacion: "Altura A = 50 ÷ 5 = 10 cm → altura B = 10 − 3 = 7 cm. Ancho B = 13 − 5 = 8 cm. Área B = 8 × 7 = 56 cm²."
  },
  {
    id: "sec-06",
    nivel: "secundaria",
    dificultad: 4,
    titulo: "Columna partida",
    rects: [
      { id: "A", x: 0, y: 0, w: 2, h: 2, area: 20 },
      { id: "B", x: 2, y: 0, w: 2, h: 3, area: 48 },
      { id: "C", x: 0, y: 2, w: 2, h: 1, area: "?" }
    ],
    cotas: [
      { lado: "top", desde: [0, 0], hasta: [4, 0], valor: 10 },
      { lado: "left", desde: [0, 0], hasta: [0, 3], valor: 8 }
    ],
    solucion: 12,
    unidad: "cm²",
    pista: "Calcula el área total del gran rectángulo de 10 × 8 y réstale las partes conocidas.",
    explicacion: "Área total = 10 × 8 = 80 cm². Área C = 80 − 48 − 20 = 12 cm²."
  },
  {
    id: "sec-07",
    nivel: "secundaria",
    dificultad: 4,
    titulo: "Agrupar antes de comparar",
    rects: [
      { id: "A", x: 0, y: 0, w: 2, h: 2, area: 18 },
      { id: "B", x: 2, y: 0, w: 3, h: 2, area: 30 },
      { id: "C", x: 5, y: 0, w: 2, h: 2, area: 24 },
      { id: "D", x: 0, y: 2, w: 2, h: 3, area: 27 },
      { id: "E", x: 2, y: 2, w: 5, h: 3, area: "?" }
    ],
    cotas: [],
    solucion: 81,
    unidad: "cm²",
    pista: "Fusiona mentalmente los rectángulos de 30 y 24 cm²: juntos tienen exactamente el mismo ancho que E.",
    explicacion: "Área(B + C) = 30 + 24 = 54 cm². Como 54 es el triple de 18, el ancho de E es el triple del de D. Área E = 27 × 3 = 81 cm²."
  },
  {
    id: "sec-08",
    nivel: "secundaria",
    dificultad: 4,
    titulo: "El molinillo central",
    rects: [
      { id: "A", x: 0, y: 0, w: 2, h: 1, area: 28 },
      { id: "B", x: 2, y: 0, w: 1, h: 2, area: 30 },
      { id: "C", x: 0, y: 1, w: 1, h: 2, area: 28 },
      { id: "D", x: 1, y: 2, w: 2, h: 1, area: 40 },
      { id: "M", x: 1, y: 1, w: 1, h: 1, area: "?" }
    ],
    cotas: [
      { lado: "top", desde: [0, 0], hasta: [2, 0], valor: 7 },
      { lado: "left", desde: [0, 1], hasta: [0, 3], valor: 7 },
      { lado: "bottom", desde: [1, 3], hasta: [3, 3], valor: 8 }
    ],
    solucion: 6,
    unidad: "cm²",
    pista: "Averigua las medidas exteriores del cuadrado/rectángulo grande y resta los cuatro bordes.",
    explicacion: "Altura A = 28 ÷ 7 = 4 cm → altura total = 4 + 7 = 11 cm. Ancho C = 28 ÷ 7 = 4 cm → ancho total = 4 + 8 = 12 cm. Área total = 12 × 11 = 132 cm². Centro = 132 − (28 + 30 + 28 + 40) = 6 cm²."
  },
  {
    id: "sec-09",
    nivel: "secundaria",
    dificultad: 4,
    titulo: "Cortes desalineados",
    rects: [
      { id: "A", x: 0, y: 0, w: 2, h: 2, area: 27 },
      { id: "B", x: 0, y: 2, w: 2, h: 3, area: 45 },
      { id: "C", x: 2, y: 0, w: 2, h: 3, area: 40 },
      { id: "D", x: 2, y: 3, w: 2, h: 2, area: "?" }
    ],
    cotas: [
      { lado: "top", desde: [0, 0], hasta: [2, 0], valor: 6 },
      { lado: "top", desde: [2, 0], hasta: [4, 0], valor: 5 }
    ],
    solucion: 20,
    unidad: "cm²",
    pista: "No intentes hallar la altura de 27 ni de 45 por separado; únelos en una sola columna.",
    explicacion: "Columna izquierda = 27 + 45 = 72 cm² → altura total = 72 ÷ 6 = 12 cm. Columna derecha completa = 5 × 12 = 60 cm². Área D = 60 − 40 = 20 cm²."
  },
  {
    id: "sec-10",
    nivel: "secundaria",
    dificultad: 4,
    titulo: "Proporción oculta",
    rects: [
      { id: "A", x: 0, y: 0, w: 2, h: 2, area: 15 },
      { id: "C", x: 0, y: 2, w: 2, h: 2, area: 21 },
      { id: "BD", x: 2, y: 0, w: 2, h: 4, area: 48 },
      { id: "E", x: 0, y: 4, w: 2, h: 2, area: 24 },
      { id: "F", x: 2, y: 4, w: 2, h: 2, area: "?" }
    ],
    cotas: [],
    solucion: 32,
    unidad: "cm²",
    pista: "Combina los dos bloques superiores izquierdos para compararlos con el de 48 cm².",
    explicacion: "Área(A + C) = 15 + 21 = 36 cm². La razón de anchos respecto a BD es 36 : 48 = 3 : 4. Por tanto, Área F = 24 × 4 ÷ 3 = 32 cm²."
  },
  {
    id: "sec-11",
    nivel: "secundaria",
    dificultad: 4,
    titulo: "Escalera de 5 peldaños",
    rects: [
      { id: "A", x: 0, y: 0, w: 2, h: 2, area: 12 },
      { id: "B", x: 2, y: 0, w: 2, h: 2, area: 18 },
      { id: "C", x: 2, y: 2, w: 2, h: 2, area: 30 },
      { id: "D", x: 4, y: 2, w: 2, h: 2, area: 25 },
      { id: "E", x: 4, y: 4, w: 2, h: 2, area: 20 }
    ],
    cotas: [
      { lado: "top", desde: [0, 0], hasta: [2, 0], valor: 4 },
      { lado: "right", desde: [6, 4], hasta: [6, 6], valor: "?" }
    ],
    solucion: 4,
    unidad: "cm",
    pista: "Baja escalón a escalón desde arriba a la izquierda sin saltarte ningún rectángulo.",
    explicacion: "Alto A = 12 ÷ 4 = 3 → ancho B = 18 ÷ 3 = 6 → alto C = 30 ÷ 6 = 5 → ancho D = 25 ÷ 5 = 5 → alto E = 20 ÷ 5 = 4 cm."
  },
  {
    id: "sec-12",
    nivel: "secundaria",
    dificultad: 5,
    titulo: "El puente en U",
    rects: [
      { id: "C", x: 0, y: 0, w: 2, h: 3, area: 45 },
      { id: "A", x: 2, y: 1, w: 2, h: 2, area: 30 },
      { id: "B", x: 4, y: 0, w: 2, h: 3, area: 65 }
    ],
    cotas: [
      { lado: "top", desde: [2, 1], hasta: [4, 1], valor: 5 },
      { lado: "right", desde: [2, 0], hasta: [2, 1], valor: 4 },
      { lado: "bottom", desde: [0, 3], hasta: [6, 3], valor: "?" }
    ],
    solucion: 16,
    unidad: "cm",
    pista: "Los dos pilares laterales tienen la misma altura. ¡Júntalos en un solo rectángulo!",
    explicacion: "Altura A = 30 ÷ 5 = 6 cm → altura pilares = 6 + 4 = 10 cm. Pilares juntos = 45 + 65 = 110 cm² → suma de sus bases = 110 ÷ 10 = 11 cm. Base total = 11 + 5 = 16 cm."
  },
  {
    id: "sec-13",
    nivel: "secundaria",
    dificultad: 5,
    titulo: "El salto de altura",
    rects: [
      { id: "A", x: 0, y: 0, w: 2, h: 2, area: 18 },
      { id: "B", x: 2, y: 0, w: 3, h: 2, area: 30 },
      { id: "C", x: 0, y: 2, w: 2, h: 3, area: "?" },
      { id: "D", x: 2, y: 2, w: 3, h: 3, area: null }
    ],
    cotas: [
      { lado: "top", desde: [0, 0], hasta: [5, 0], valor: 12 },
      { lado: "left", desde: [0, 0], hasta: [0, 5], valor: 10 }
    ],
    solucion: 27,
    unidad: "cm²",
    pista: "Encuentra primero las dos alturas usando la fila superior completa, y luego aplica su proporción.",
    explicacion: "Fila superior = 18 + 30 = 48 cm² → altura 1 = 48 ÷ 12 = 4 cm → altura 2 = 10 − 4 = 6 cm. La proporción entre alturas es 6 : 4 = 3 : 2, así que Área C = 18 × 3 ÷ 2 = 27 cm²."
  },
  {
    id: "sec-14",
    nivel: "secundaria",
    dificultad: 5,
    titulo: "Doble estrategia",
    rects: [
      { id: "A", x: 0, y: 0, w: 2, h: 2, area: 14 },
      { id: "B", x: 2, y: 0, w: 2, h: 2, area: 18 },
      { id: "C", x: 4, y: 0, w: 3, h: 2, area: null },
      { id: "D", x: 0, y: 2, w: 2, h: 3, area: null },
      { id: "E", x: 2, y: 2, w: 2, h: 3, area: "?" },
      { id: "F", x: 4, y: 2, w: 3, h: 3, area: 36 }
    ],
    cotas: [
      { lado: "top", desde: [0, 0], hasta: [4, 0], valor: 8 },
      { lado: "top", desde: [4, 0], hasta: [7, 0], valor: 6 }
    ],
    solucion: 27,
    unidad: "cm²",
    pista: "Averigua la altura de la fila 1 combinando A y B, y la altura de la fila 2 usando F.",
    explicacion: "Altura fila 1 = (14 + 18) ÷ 8 = 4 cm. Altura fila 2 = 36 ÷ 6 = 6 cm. Como las alturas están en razón 6 : 4 = 3 : 2, Área E = 18 × 3 ÷ 2 = 27 cm²."
  },
  {
    id: "sec-15",
    nivel: "secundaria",
    dificultad: 5,
    titulo: "Molinillo maestro",
    rects: [
      { id: "A", x: 0, y: 0, w: 2, h: 1, area: 27 },
      { id: "B", x: 2, y: 0, w: 1, h: 2, area: 48 },
      { id: "C", x: 0, y: 1, w: 1, h: 2, area: "?" },
      { id: "D", x: 1, y: 2, w: 2, h: 1, area: 40 },
      { id: "M", x: 1, y: 1, w: 1, h: 1, area: 20 }
    ],
    cotas: [
      { lado: "top", desde: [0, 0], hasta: [2, 0], valor: 9 },
      { lado: "right", desde: [3, 0], hasta: [3, 2], valor: 8 }
    ],
    solucion: 45,
    unidad: "cm²",
    pista: "Halla los lados de A y B para entrar en el cuadrado central M; desde ahí desbloquearás D y C.",
    explicacion: "Alto A = 27 ÷ 9 = 3 cm. Ancho B = 48 ÷ 8 = 6 cm. Alto M = 8 − 3 = 5 cm → ancho M = 20 ÷ 5 = 4 cm. Entonces ancho C = 9 − 4 = 5 cm, y ancho D = 4 + 6 = 10 cm → alto D = 40 ÷ 10 = 4 cm. Alto C = 5 + 4 = 9 cm → Área C = 5 × 9 = 45 cm²."
  }
];
