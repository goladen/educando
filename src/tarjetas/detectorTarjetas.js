// Tarjetas de respuesta de PiKT (tipo Plickers): cada alumno tiene una tarjeta
// con un marcador ArUco 4×4 y las letras A-D en los cuatro bordes. Levanta la
// tarjeta con su letra ARRIBA y la cámara lee el número (quién es) y el giro (qué
// responde). Todo se procesa en el navegador: ninguna imagen sale del equipo.
//
// Orden de las letras en la tarjeta impresa: A arriba, B derecha, C abajo, D izquierda.
import { AR } from './arucoVendor.js';

export const LETRAS_TARJETA = ['A', 'B', 'C', 'D'];
/** Máximo de tarjetas distintas (códigos del diccionario). */
export const MAX_TARJETAS = 64;
const DICCIONARIO = 'PIKT_4X4_64';

let diccionario = null;
const dic = () => (diccionario ||= new AR.Dictionary(DICCIONARIO));

/** Cuadrícula 4×4 de bits (1 = blanco) del marcador de la tarjeta n (1…64). */
export function bitsTarjeta(n) {
  const code = dic().codeList[n - 1];
  if (!code) return null;
  return Array.from({ length: 4 }, (_, y) => Array.from({ length: 4 }, (_, x) => code[y * 4 + x] === '1'));
}

/**
 * Letra según el giro: se mira hacia dónde apunta el borde superior del marcador
 * (esquina 0 → esquina 1). Derecho = A; girado para que el borde derecho quede
 * arriba = B; boca abajo = C; borde izquierdo arriba = D.
 */
export function letraDeEsquinas(c) {
  const ang = (Math.atan2(c[1].y - c[0].y, c[1].x - c[0].x) * 180) / Math.PI;
  const giro = ((Math.round(-ang / 90) % 4) + 4) % 4;
  // Distancia al múltiplo de 90° más cercano: si la tarjeta va muy inclinada (≈45°) no se fía.
  const resto = (((ang % 90) + 90) % 90);
  const desvio = Math.min(resto, 90 - resto);
  return { letra: LETRAS_TARJETA[giro], angulo: ang, dudosa: desvio > 30 };
}

/**
 * Crea un detector. `detectar({width, height, data})` (RGBA, p. ej. ImageData) →
 * [{ tarjeta, letra, dudosa, centro:{x,y}, esquinas, lado }]
 * Solo devuelve tarjetas de 1 a `maxTarjeta`.
 */
export function crearDetector({ maxTarjeta = MAX_TARJETAS, maxErrores = 1 } = {}) {
  // maxHammingDistance: el detector acepta distancia < valor → 2 = corrige 1 bit.
  const det = new AR.Detector({ dictionaryName: DICCIONARIO, maxHammingDistance: maxErrores + 1 });
  return {
    detectar(imagen) {
      const marcas = det.detect(imagen);
      const vistas = new Map();
      for (const m of marcas) {
        const tarjeta = m.id + 1;
        if (tarjeta > maxTarjeta) continue;
        const c = m.corners;
        const centro = { x: (c[0].x + c[1].x + c[2].x + c[3].x) / 4, y: (c[0].y + c[1].y + c[2].y + c[3].y) / 4 };
        const lado = Math.hypot(c[1].x - c[0].x, c[1].y - c[0].y);
        const { letra, dudosa } = letraDeEsquinas(c);
        const prev = vistas.get(tarjeta);
        // Si la misma tarjeta sale dos veces (reflejo, falso positivo), vale la más grande
        if (!prev || lado > prev.lado) vistas.set(tarjeta, { tarjeta, letra, dudosa, centro, esquinas: c.map((p) => ({ x: p.x, y: p.y })), lado, errores: m.hammingDistance });
      }
      return [...vistas.values()];
    },
  };
}

/**
 * Filtro temporal: una lectura cuenta cuando la misma tarjeta se ve con la misma
 * letra en `necesarias` fotogramas seguidos (evita lecturas al vuelo mientras el
 * alumno gira la tarjeta). Devuelve las lecturas que se acaban de confirmar.
 */
export function crearEstabilizador(necesarias = 3) {
  const racha = new Map(); // tarjeta → { letra, n }
  return {
    actualizar(detecciones) {
      const confirmadas = [];
      const vistas = new Set();
      for (const d of detecciones) {
        if (d.dudosa) continue;
        vistas.add(d.tarjeta);
        const r = racha.get(d.tarjeta);
        if (r && r.letra === d.letra) {
          r.n++;
          if (r.n === necesarias) confirmadas.push({ tarjeta: d.tarjeta, letra: d.letra });
        } else {
          racha.set(d.tarjeta, { letra: d.letra, n: 1 });
          if (necesarias <= 1) confirmadas.push({ tarjeta: d.tarjeta, letra: d.letra });
        }
      }
      // Una tarjeta que deja de verse un rato pierde la racha (se borra al 2.º fotograma sin verla)
      for (const [t, r] of racha) {
        if (vistas.has(t)) r.fuera = 0;
        else if ((r.fuera = (r.fuera || 0) + 1) > 2) racha.delete(t);
      }
      return confirmadas;
    },
    reiniciar() { racha.clear(); },
  };
}
