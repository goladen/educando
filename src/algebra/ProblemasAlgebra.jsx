// ProblemasAlgebra.jsx — Álgebra · Math World
//   9. Fórmulas: valor numérico de fórmulas de otras materias de la ESO (MRU, MRUA, energía,
//      Ohm, densidad, interés, IMC…) y, opcionalmente, despejar una incógnita.
//  10. Áreas y perímetros con polinomios: rectángulos, cuadrados y triángulos cuyos lados
//      son polinomios → P(x), A(x), valor numérico y «halla x».
import React, { useState } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import { polyStr, norm, mul, evalNum } from './motorFactorizacion';
import PolyInput from './PolyInput';

const CARD = { background: '#161b22', borderRadius: 14, padding: 20, border: '1px solid #30363d' };
const BTN = (bg, col = 'white') => ({ padding: '10px 22px', borderRadius: 9, border: 'none', background: bg, color: col, fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem' });
const BTN_SEC = { padding: '7px 14px', borderRadius: 8, border: '1px solid #30363d', background: 'transparent', color: '#c9d1d9', cursor: 'pointer', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: 6 };
const INPUT = { padding: '8px 12px', borderRadius: 7, border: '1.5px solid #30363d', background: '#0d1117', color: '#e6edf3', textAlign: 'center', fontSize: '1rem' };
const SELECT = { ...INPUT, textAlign: 'left', fontSize: '0.85rem', padding: '6px 10px' };
const MATH = { fontFamily: 'Georgia,serif', fontWeight: 700 };

// ─── Utilidades ──────────────────────────────────────────────────────────────
const ri = (lo, hi, ne) => { let v; do { v = Math.floor(Math.random() * (hi - lo + 1)) + lo; } while (ne !== undefined && v === ne); return v; };
const pick = a => a[Math.floor(Math.random() * a.length)];
const red = (x, d = 4) => Math.round(x * 10 ** d) / 10 ** d;
const dec = (lo, hi, step) => red(ri(Math.ceil(lo / step), Math.floor(hi / step)) * step);
const decNZ = (lo, hi, step) => { let v; do { v = dec(lo, hi, step); } while (v === 0); return v; };
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
export const fmt = x => { const r = red(x); return (r < 0 ? '−' : '') + String(Math.abs(r)).replace('.', ','); };
const fmtP = x => (red(x) < 0 ? `(${fmt(x)})` : fmt(x));
const leerNum = s => {
    const t = String(s).trim().replace(/[−–]/g, '-').replace(/\s/g, '').replace(',', '.');
    if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
    return parseFloat(t);
};
const NOMBRE_DEC = { 0: 'unidades', 1: 'décimas', 2: 'centésimas' };

function Feedback({ ok, msg }) {
    return (
        <div style={{ padding: '10px 20px', borderRadius: 10, background: ok ? '#0d3321' : '#2c0d0d', border: `1px solid ${ok ? '#2ecc71' : '#e74c3c'}`, color: ok ? '#2ecc71' : '#e74c3c', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'center' }}>
            {ok ? <CheckCircle size={18} /> : <XCircle size={18} />}{msg}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 9. FÓRMULAS DE OTRAS MATERIAS
// ═══════════════════════════════════════════════════════════════════════════════
// Cada fórmula: sub = magnitud que se calcula; tpl = lado derecho con {clave};
// vars con generador g(nivel) (1 = 1.º-2.º, 2 = 3.º, 3 = 4.º ESO) o gen(nivel) global;
// calc(v); ok(v, res) valida; desp = despejes lineales (el valor buscado siempre es «bonito»);
// dec = decimales a los que se redondea el resultado directo; min = nivel mínimo.
export const MATERIAS = {
    fisica: { nom: 'Física', emoji: '🚀', color: '#3498db' },
    quimica: { nom: 'Química', emoji: '⚗️', color: '#9b59b6' },
    mates: { nom: 'Matemáticas', emoji: '📐', color: '#f39c12' },
    economia: { nom: 'Economía', emoji: '💶', color: '#27ae60' },
    biologia: { nom: 'Biología y salud', emoji: '🫀', color: '#e74c3c' },
    tecnologia: { nom: 'Tecnología', emoji: '⚙️', color: '#1abc9c' },
    geografia: { nom: 'Geografía', emoji: '🗺️', color: '#e67e22' },
};

const FORMULAS = [
    // ── Física ──
    { id: 'mru', mat: 'fisica', nombre: 'MRU: posición', min: 1,
      sub: { k: 's', sym: 's', nom: 'la posición final', u: 'm' }, tpl: '{s0} + {v} · {t}',
      vars: [
          { k: 's0', sym: 's₀', nom: 'posición inicial', u: 'm', g: n => n === 1 ? ri(0, 20) : ri(-30, 50) },
          { k: 'v', sym: 'v', nom: 'velocidad', u: 'm/s', g: n => n === 1 ? ri(2, 15) : ri(-12, 25, 0) },
          { k: 't', sym: 't', nom: 'tiempo', u: 's', g: () => ri(2, 12) },
      ],
      calc: v => v.s0 + v.v * v.t,
      desp: { v: '({s} − {s0}) / {t}', t: '({s} − {s0}) / {v}', s0: '{s} − {v} · {t}' },
      ctx: ['Un ciclista avanza en línea recta a velocidad constante.', 'Un tren recorre una vía recta sin cambiar de velocidad.', 'Un patinete eléctrico circula por un carril bici recto a velocidad constante.'] },
    { id: 'vmedia', mat: 'fisica', nombre: 'Velocidad media', min: 1,
      sub: { k: 'v', sym: 'v', nom: 'la velocidad media', u: 'km/h' }, tpl: '{d} / {t}',
      vars: [{ k: 'd', sym: 'd', nom: 'distancia', u: 'km' }, { k: 't', sym: 't', nom: 'tiempo', u: 'h' }],
      gen: n => { const t = n === 1 ? ri(2, 6) : pick([ri(2, 8), dec(0.5, 4, 0.5)]); const v = ri(3, 12) * 10; return { d: red(v * t), t }; },
      calc: v => v.d / v.t, desp: { d: '{v} · {t}', t: '{d} / {v}' },
      ctx: ['Un autobús hace un viaje entre dos ciudades.', 'Una familia viaja en coche a la playa.'] },
    { id: 'mruaV', mat: 'fisica', nombre: 'MRUA: velocidad', min: 2,
      sub: { k: 'v', sym: 'v', nom: 'la velocidad final', u: 'm/s' }, tpl: '{v0} + {a} · {t}',
      vars: [
          { k: 'v0', sym: 'v₀', nom: 'velocidad inicial', u: 'm/s', g: () => ri(0, 30) },
          { k: 'a', sym: 'a', nom: 'aceleración', u: 'm/s²', g: n => n === 2 ? ri(-4, 5, 0) : decNZ(-6, 6, 0.5) },
          { k: 't', sym: 't', nom: 'tiempo', u: 's', g: () => ri(2, 10) },
      ],
      calc: v => v.v0 + v.a * v.t, ok: (v, r) => r >= 0,
      desp: { a: '({v} − {v0}) / {t}', t: '({v} − {v0}) / {a}', v0: '{v} − {a} · {t}' },
      ctx: v => v.a < 0 ? ['Un coche frena de forma uniforme antes de llegar a un semáforo.', 'Una moto reduce su velocidad de manera uniforme.'] : ['Un coche acelera de forma uniforme al salir de un peaje.', 'Un tren acelera uniformemente al salir de la estación.'] },
    { id: 'mruaS', mat: 'fisica', nombre: 'MRUA: espacio recorrido', min: 2,
      sub: { k: 's', sym: 's', nom: 'el espacio recorrido', u: 'm' }, tpl: '{v0} · {t} + ½ · {a} · {t}²',
      vars: [
          { k: 'v0', sym: 'v₀', nom: 'velocidad inicial', u: 'm/s', g: () => ri(0, 20) },
          { k: 'a', sym: 'a', nom: 'aceleración', u: 'm/s²', g: n => n === 2 ? ri(1, 5) : decNZ(-4, 6, 0.5) },
          { k: 't', sym: 't', nom: 'tiempo', u: 's', g: () => ri(2, 10) },
      ],
      calc: v => v.v0 * v.t + 0.5 * v.a * v.t * v.t, ok: (v, r) => r > 0 && v.v0 + v.a * v.t >= 0,
      desp: { v0: '({s} − ½ · {a} · {t}²) / {t}', a: '2 · ({s} − {v0} · {t}) / {t}²' },
      ctx: v => v.a < 0 ? ['Un coche frena de forma uniforme.', 'Una bici baja el ritmo de forma uniforme al llegar a una curva.'] : ['Un coche acelera de forma uniforme.', 'Un avión acelera uniformemente por la pista antes de despegar.'] },
    { id: 'caida', mat: 'fisica', nombre: 'Caída libre', min: 2,
      sub: { k: 'h', sym: 'h', nom: 'la altura a la que se encuentra', u: 'm' }, tpl: '{h0} − ½ · 9,8 · {t}²',
      vars: [
          { k: 'h0', sym: 'h₀', nom: 'altura inicial', u: 'm', g: () => ri(5, 30) * 10 },
          { k: 't', sym: 't', nom: 'tiempo', u: 's', g: n => n === 2 ? ri(1, 5) : dec(0.5, 6, 0.5) },
      ],
      calc: v => v.h0 - 4.9 * v.t * v.t, ok: (v, r) => r > 0,
      desp: { h0: '{h} + ½ · 9,8 · {t}²' },
      ctx: ['Se deja caer una pelota desde lo alto de un edificio (g = 9,8 m/s²).', 'A un escalador se le cae un mosquetón desde lo alto de una pared (g = 9,8 m/s²).'] },
    { id: 'newton', mat: 'fisica', nombre: '2.ª ley de Newton', min: 1,
      sub: { k: 'F', sym: 'F', nom: 'la fuerza', u: 'N' }, tpl: '{m} · {a}',
      vars: [
          { k: 'm', sym: 'm', nom: 'masa', u: 'kg', g: n => n === 1 ? ri(2, 50) : pick([ri(2, 80), ri(5, 15) * 100]) },
          { k: 'a', sym: 'a', nom: 'aceleración', u: 'm/s²', g: n => n === 1 ? ri(1, 10) : dec(0.5, 10, 0.5) },
      ],
      calc: v => v.m * v.a, desp: { m: '{F} / {a}', a: '{F} / {m}' },
      ctx: ['Sobre un cuerpo actúa una fuerza que le produce una aceleración.', 'Se empuja un carro y este acelera.'] },
    { id: 'peso', mat: 'fisica', nombre: 'Peso', min: 1,
      sub: { k: 'P', sym: 'P', nom: 'el peso', u: 'N' }, tpl: '{m} · 9,8',
      vars: [{ k: 'm', sym: 'm', nom: 'masa', u: 'kg', g: n => n === 1 ? ri(1, 80) : dec(0.5, 120, 0.5) }],
      calc: v => v.m * 9.8, desp: { m: '{P} / 9,8' },
      ctx: ['Calcula el peso de una mochila en la Tierra (g = 9,8 m/s²).', 'Calcula el peso de una persona en la Tierra (g = 9,8 m/s²).'] },
    { id: 'ec', mat: 'fisica', nombre: 'Energía cinética', min: 2,
      sub: { k: 'Ec', sym: 'Ec', nom: 'la energía cinética', u: 'J' }, tpl: '½ · {m} · {v}²',
      vars: [
          { k: 'm', sym: 'm', nom: 'masa', u: 'kg', g: () => pick([ri(1, 90), ri(8, 15) * 100]) },
          { k: 'v', sym: 'v', nom: 'velocidad', u: 'm/s', g: () => ri(2, 30) },
      ],
      calc: v => 0.5 * v.m * v.v * v.v, desp: { m: '2 · {Ec} / {v}²' },
      ctx: ['Un cuerpo se mueve con cierta velocidad.', 'Un patinador se desliza por la pista.', 'Un coche circula por una carretera.'] },
    { id: 'ep', mat: 'fisica', nombre: 'Energía potencial', min: 2,
      sub: { k: 'Ep', sym: 'Ep', nom: 'la energía potencial', u: 'J' }, tpl: '{m} · 9,8 · {h}',
      vars: [
          { k: 'm', sym: 'm', nom: 'masa', u: 'kg', g: () => ri(1, 90) },
          { k: 'h', sym: 'h', nom: 'altura', u: 'm', g: () => ri(2, 50) },
      ],
      calc: v => v.m * 9.8 * v.h, desp: { m: '{Ep} / (9,8 · {h})', h: '{Ep} / (9,8 · {m})' },
      ctx: ['Una escaladora está en lo alto de una vía de escalada (g = 9,8 m/s²).', 'Se sube una caja a una estantería (g = 9,8 m/s²).'] },
    { id: 'trabajo', mat: 'fisica', nombre: 'Trabajo', min: 1,
      sub: { k: 'W', sym: 'W', nom: 'el trabajo realizado', u: 'J' }, tpl: '{F} · {d}',
      vars: [
          { k: 'F', sym: 'F', nom: 'fuerza', u: 'N', g: () => ri(5, 200) },
          { k: 'd', sym: 'd', nom: 'desplazamiento', u: 'm', g: () => ri(2, 50) },
      ],
      calc: v => v.F * v.d, desp: { F: '{W} / {d}', d: '{W} / {F}' },
      ctx: ['Se arrastra un mueble por el suelo con una fuerza en la dirección del movimiento.'] },
    { id: 'potencia', mat: 'fisica', nombre: 'Potencia mecánica', min: 2,
      sub: { k: 'P', sym: 'P', nom: 'la potencia', u: 'W' }, tpl: '{W} / {t}',
      vars: [{ k: 'W', sym: 'W', nom: 'trabajo', u: 'J' }, { k: 't', sym: 't', nom: 'tiempo', u: 's' }],
      gen: () => { const t = ri(2, 30); const P = ri(5, 100) * pick([1, 10]); return { W: P * t, t }; },
      calc: v => v.W / v.t, desp: { W: '{P} · {t}', t: '{W} / {P}' },
      ctx: ['Una grúa realiza un trabajo en un tiempo determinado.', 'Un motor eleva una carga.'] },
    { id: 'presion', mat: 'fisica', nombre: 'Presión', min: 2,
      sub: { k: 'p', sym: 'p', nom: 'la presión', u: 'Pa' }, tpl: '{F} / {S}',
      vars: [{ k: 'F', sym: 'F', nom: 'fuerza', u: 'N' }, { k: 'S', sym: 'S', nom: 'superficie', u: 'm²' }],
      gen: () => { const S = pick([0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2]); const p = ri(1, 50) * 100; return { F: red(p * S), S }; },
      calc: v => v.F / v.S, desp: { F: '{p} · {S}' },
      ctx: ['Un objeto apoyado en el suelo ejerce una fuerza sobre una superficie.', 'Una persona con raquetas de nieve se apoya sobre la nieve.'] },
    { id: 'fahr', mat: 'fisica', nombre: 'Grados Fahrenheit', min: 2,
      sub: { k: 'F', sym: 'F', nom: 'la temperatura en grados Fahrenheit', u: '°F' }, tpl: '1,8 · {C} + 32',
      vars: [{ k: 'C', sym: 'C', nom: 'temperatura en grados Celsius', u: '°C', g: () => ri(-20, 45) }],
      calc: v => 1.8 * v.C + 32, desp: { C: '({F} − 32) / 1,8' },
      ctx: ['En Estados Unidos la temperatura se mide en grados Fahrenheit.'] },
    // ── Química ──
    { id: 'kelvin', mat: 'quimica', nombre: 'Escala Kelvin', min: 1,
      sub: { k: 'T', sym: 'T', nom: 'la temperatura absoluta', u: 'K' }, tpl: '{C} + 273',
      vars: [{ k: 'C', sym: 'C', nom: 'temperatura en grados Celsius', u: '°C', g: () => ri(-50, 150) }],
      calc: v => v.C + 273, desp: { C: '{T} − 273' },
      ctx: ['En el laboratorio hay que pasar la temperatura a kelvin.'] },
    { id: 'densidad', mat: 'quimica', nombre: 'Densidad', min: 1,
      sub: { k: 'd', sym: 'd', nom: 'la densidad', u: 'g/cm³' }, tpl: '{m} / {V}',
      vars: [{ k: 'm', sym: 'm', nom: 'masa', u: 'g' }, { k: 'V', sym: 'V', nom: 'volumen', u: 'cm³' }],
      gen: n => { const d = n === 1 ? pick([1, 2, 3, 5, 8]) : pick([0.8, 1, 1.03, 2.7, 7.9, 8.9, 11.3, 19.3]); const V = ri(2, 50); return { m: red(d * V), V }; },
      calc: v => v.m / v.V, desp: { m: '{d} · {V}', V: '{m} / {d}' },
      ctx: ['Se mide en el laboratorio una muestra de un material.', 'Un trozo de metal se sumerge en una probeta para medir su volumen.'] },
    { id: 'concentracion', mat: 'quimica', nombre: 'Concentración (g/L)', min: 2,
      sub: { k: 'c', sym: 'c', nom: 'la concentración', u: 'g/L' }, tpl: '{m} / {V}',
      vars: [{ k: 'm', sym: 'm', nom: 'masa de soluto', u: 'g' }, { k: 'V', sym: 'V', nom: 'volumen de disolución', u: 'L' }],
      gen: () => { const V = pick([0.25, 0.5, 1, 2, 5]); const c = ri(2, 60); return { m: red(c * V), V }; },
      calc: v => v.m / v.V, desp: { m: '{c} · {V}', V: '{m} / {c}' },
      ctx: ['Se prepara una disolución de sal en agua.', 'Se disuelve azúcar en agua para preparar un refresco.'] },
    { id: 'gases', mat: 'quimica', nombre: 'Gases ideales', min: 3, dec: 2,
      sub: { k: 'P', sym: 'P', nom: 'la presión del gas', u: 'atm' }, tpl: '{n} · 0,082 · {T} / {V}',
      vars: [
          { k: 'n', sym: 'n', nom: 'cantidad de sustancia', u: 'mol', g: () => dec(0.5, 5, 0.5) },
          { k: 'T', sym: 'T', nom: 'temperatura', u: 'K', g: () => ri(273, 400) },
          { k: 'V', sym: 'V', nom: 'volumen', u: 'L', g: () => ri(2, 30) },
      ],
      calc: v => v.n * 0.082 * v.T / v.V,
      ctx: ['Un gas está encerrado en un recipiente (R = 0,082 atm·L/(mol·K)).'] },
    // ── Matemáticas ──
    { id: 'circArea', mat: 'mates', nombre: 'Área del círculo', min: 1, dec: 2,
      sub: { k: 'A', sym: 'A', nom: 'el área', u: 'cm²' }, tpl: '3,14 · {r}²',
      vars: [{ k: 'r', sym: 'r', nom: 'radio', u: 'cm', g: n => n === 1 ? ri(1, 15) : dec(0.5, 20, 0.5) }],
      calc: v => 3.14 * v.r * v.r, ctx: ['Una pizza es circular (usa π ≈ 3,14).', 'Se dibuja un círculo con el compás (usa π ≈ 3,14).'] },
    { id: 'circLong', mat: 'mates', nombre: 'Longitud de la circunferencia', min: 1, dec: 2,
      sub: { k: 'L', sym: 'L', nom: 'la longitud', u: 'cm' }, tpl: '2 · 3,14 · {r}',
      vars: [{ k: 'r', sym: 'r', nom: 'radio', u: 'cm', g: n => n === 1 ? ri(1, 30) : dec(0.5, 40, 0.5) }],
      calc: v => 2 * 3.14 * v.r, desp: { r: '{L} / (2 · 3,14)' },
      ctx: ['Una rueda de bicicleta es circular (usa π ≈ 3,14).'] },
    { id: 'cilindro', mat: 'mates', nombre: 'Volumen del cilindro', min: 2, dec: 2,
      sub: { k: 'V', sym: 'V', nom: 'el volumen', u: 'cm³' }, tpl: '3,14 · {r}² · {h}',
      vars: [
          { k: 'r', sym: 'r', nom: 'radio de la base', u: 'cm', g: () => ri(1, 10) },
          { k: 'h', sym: 'h', nom: 'altura', u: 'cm', g: () => ri(2, 20) },
      ],
      calc: v => 3.14 * v.r * v.r * v.h, desp: { h: '{V} / (3,14 · {r}²)' },
      ctx: ['Una lata de refresco tiene forma de cilindro (usa π ≈ 3,14).'] },
    { id: 'esfera', mat: 'mates', nombre: 'Volumen de la esfera', min: 3, dec: 2,
      sub: { k: 'V', sym: 'V', nom: 'el volumen', u: 'cm³' }, tpl: '4 · 3,14 · {r}³ / 3',
      vars: [{ k: 'r', sym: 'r', nom: 'radio', u: 'cm', g: () => ri(1, 15) }],
      calc: v => 4 * 3.14 * v.r ** 3 / 3, ctx: ['Un balón tiene forma de esfera (usa π ≈ 3,14).'] },
    { id: 'angulos', mat: 'mates', nombre: 'Suma de ángulos de un polígono', min: 1,
      sub: { k: 'S', sym: 'S', nom: 'la suma de sus ángulos interiores', u: '°' }, tpl: '180 · ({n} − 2)',
      vars: [{ k: 'n', sym: 'n', nom: 'número de lados', u: '', g: () => ri(3, 12) }],
      calc: v => 180 * (v.n - 2), desp: { n: '{S} / 180 + 2' },
      ctx: ['Un polígono convexo tiene n lados.'] },
    { id: 'diagonales', mat: 'mates', nombre: 'Diagonales de un polígono', min: 1,
      sub: { k: 'D', sym: 'D', nom: 'el número de diagonales', u: '' }, tpl: '{n} · ({n} − 3) / 2',
      vars: [{ k: 'n', sym: 'n', nom: 'número de lados', u: '', g: () => ri(4, 20) }],
      calc: v => v.n * (v.n - 3) / 2, ctx: ['Un polígono convexo tiene n lados.'] },
    { id: 'pitagoras', mat: 'mates', nombre: 'Teorema de Pitágoras', min: 2,
      sub: { k: 'a', sym: 'a', nom: 'la hipotenusa', u: 'cm' }, tpl: '√({b}² + {c}²)',
      vars: [{ k: 'b', sym: 'b', nom: 'un cateto', u: 'cm' }, { k: 'c', sym: 'c', nom: 'el otro cateto', u: 'cm' }],
      gen: () => { const [x, y] = pick([[3, 4], [5, 12], [8, 15], [7, 24], [6, 8]]); const k = ri(1, 4); return Math.random() < 0.5 ? { b: x * k, c: y * k } : { b: y * k, c: x * k }; },
      calc: v => Math.sqrt(v.b * v.b + v.c * v.c),
      ctx: ['Una escalera apoyada en una pared forma un triángulo rectángulo.', 'Un triángulo rectángulo tiene estos catetos.'] },
    // ── Economía ──
    { id: 'interes', mat: 'economia', nombre: 'Interés simple', min: 1,
      sub: { k: 'I', sym: 'I', nom: 'el interés obtenido', u: '€' }, tpl: '{C} · {r} · {t} / 100',
      vars: [
          { k: 'C', sym: 'C', nom: 'capital', u: '€', g: () => ri(2, 40) * 500 },
          { k: 'r', sym: 'r', nom: 'rédito (tipo de interés)', u: '%', g: n => n === 1 ? ri(1, 6) : dec(0.5, 6, 0.5) },
          { k: 't', sym: 't', nom: 'tiempo', u: 'años', g: () => ri(1, 6) },
      ],
      calc: v => v.C * v.r * v.t / 100,
      desp: { C: '100 · {I} / ({r} · {t})', r: '100 · {I} / ({C} · {t})', t: '100 · {I} / ({C} · {r})' },
      ctx: ['Se ingresa un dinero en un depósito bancario a interés simple.'] },
    { id: 'iva', mat: 'economia', nombre: 'Precio con IVA', min: 2, dec: 2,
      sub: { k: 'P', sym: 'P', nom: 'el precio final con IVA', u: '€' }, tpl: '{p} · (1 + {iva} / 100)',
      vars: [
          { k: 'p', sym: 'p', nom: 'precio sin IVA', u: '€', g: () => ri(5, 400) },
          { k: 'iva', sym: 'IVA', nom: 'tipo de IVA', u: '%', g: () => pick([4, 10, 21]) },
      ],
      calc: v => v.p * (1 + v.iva / 100), desp: { p: '{P} / (1 + {iva} / 100)' },
      ctx: ['Una tienda pone el precio de un producto sin IVA.', 'En una factura aparece la base imponible y el tipo de IVA.'] },
    { id: 'beneficio', mat: 'economia', nombre: 'Beneficio de una venta', min: 1,
      sub: { k: 'B', sym: 'B', nom: 'el beneficio', u: '€' }, tpl: '{pv} · {n} − {C}',
      vars: [
          { k: 'pv', sym: 'p', nom: 'precio de venta de cada unidad', u: '€', g: () => ri(2, 30) },
          { k: 'n', sym: 'n', nom: 'unidades vendidas', u: 'unidades', g: () => ri(10, 200) },
          { k: 'C', sym: 'C', nom: 'costes', u: '€', g: () => ri(10, 200) * 10 },
      ],
      calc: v => v.pv * v.n - v.C, desp: { n: '({B} + {C}) / {pv}', pv: '({B} + {C}) / {n}' },
      ctx: ['Una cooperativa escolar vende camisetas para el viaje de fin de curso (si sale negativo, hay pérdidas).'] },
    // ── Biología y salud ──
    { id: 'imc', mat: 'biologia', nombre: 'Índice de masa corporal', min: 2, dec: 1,
      sub: { k: 'IMC', sym: 'IMC', nom: 'el índice de masa corporal', u: 'kg/m²' }, tpl: '{m} / {h}²',
      vars: [
          { k: 'm', sym: 'm', nom: 'masa', u: 'kg', g: () => ri(35, 100) },
          { k: 'h', sym: 'h', nom: 'estatura', u: 'm', g: () => dec(1.4, 1.95, 0.01) },
      ],
      calc: v => v.m / (v.h * v.h), ctx: ['En una revisión médica se calcula el IMC.'] },
    { id: 'fcmax', mat: 'biologia', nombre: 'Frecuencia cardiaca máxima', min: 1,
      sub: { k: 'FC', sym: 'FCmáx', nom: 'la frecuencia cardiaca máxima', u: 'pulsaciones/min' }, tpl: '220 − {e}',
      vars: [{ k: 'e', sym: 'e', nom: 'edad', u: 'años', g: () => ri(12, 70) }],
      calc: v => 220 - v.e, desp: { e: '220 − {FC}' },
      ctx: ['En Educación Física se estima la frecuencia cardiaca máxima.'] },
    { id: 'bacterias', mat: 'biologia', nombre: 'Crecimiento de bacterias', min: 3,
      sub: { k: 'N', sym: 'N', nom: 'el número de bacterias', u: 'bacterias' }, tpl: '{N0} · 2^{g}',
      vars: [
          { k: 'N0', sym: 'N₀', nom: 'bacterias iniciales', u: 'bacterias', g: () => ri(1, 50) * 10 },
          { k: 'g', sym: 'g', nom: 'número de generaciones (divisiones)', u: '', g: () => ri(2, 10) },
      ],
      calc: v => v.N0 * 2 ** v.g, ctx: ['Un cultivo de bacterias se duplica en cada generación.'] },
    // ── Tecnología ──
    { id: 'ohm', mat: 'tecnologia', nombre: 'Ley de Ohm', min: 1,
      sub: { k: 'V', sym: 'V', nom: 'el voltaje', u: 'V' }, tpl: '{I} · {R}',
      vars: [
          { k: 'I', sym: 'I', nom: 'intensidad', u: 'A', g: n => n === 1 ? ri(1, 5) : dec(0.1, 3, 0.1) },
          { k: 'R', sym: 'R', nom: 'resistencia', u: 'Ω', g: () => ri(1, 50) * 10 },
      ],
      calc: v => v.I * v.R, desp: { I: '{V} / {R}', R: '{V} / {I}' },
      ctx: ['En un circuito eléctrico hay una resistencia.', 'Se monta un circuito con una resistencia en el taller.'] },
    { id: 'potElec', mat: 'tecnologia', nombre: 'Potencia eléctrica', min: 1,
      sub: { k: 'P', sym: 'P', nom: 'la potencia', u: 'W' }, tpl: '{V} · {I}',
      vars: [
          { k: 'V', sym: 'V', nom: 'voltaje', u: 'V', g: () => pick([1.5, 4.5, 5, 9, 12, 230]) },
          { k: 'I', sym: 'I', nom: 'intensidad', u: 'A', g: () => dec(0.5, 10, 0.5) },
      ],
      calc: v => v.V * v.I, desp: { I: '{P} / {V}' },
      ctx: ['Un aparato eléctrico funciona conectado a un generador.'] },
    { id: 'coste', mat: 'tecnologia', nombre: 'Coste de la electricidad', min: 2, dec: 2,
      sub: { k: 'C', sym: 'C', nom: 'el coste', u: '€' }, tpl: '{P} · {t} · {pr}',
      vars: [
          { k: 'P', sym: 'P', nom: 'potencia del aparato', u: 'kW', g: () => dec(0.1, 3, 0.1) },
          { k: 't', sym: 't', nom: 'tiempo de uso', u: 'h', g: () => ri(1, 10) },
          { k: 'pr', sym: 'p', nom: 'precio del kWh', u: '€/kWh', g: () => dec(0.1, 0.3, 0.01) },
      ],
      calc: v => v.P * v.t * v.pr, ctx: ['Se quiere saber cuánto cuesta usar un electrodoméstico.'] },
    { id: 'engranajes', mat: 'tecnologia', nombre: 'Engranajes', min: 2,
      sub: { k: 'n2', sym: 'n₂', nom: 'la velocidad de la rueda conducida', u: 'rpm' }, tpl: '{n1} · {z1} / {z2}',
      vars: [
          { k: 'n1', sym: 'n₁', nom: 'velocidad de la rueda motriz', u: 'rpm' },
          { k: 'z1', sym: 'z₁', nom: 'dientes de la rueda motriz', u: 'dientes' },
          { k: 'z2', sym: 'z₂', nom: 'dientes de la rueda conducida', u: 'dientes' },
      ],
      gen: () => { const Z = [10, 12, 15, 20, 24, 30, 36, 40, 48, 60]; const z1 = pick(Z); let z2; do { z2 = pick(Z); } while (z2 === z1); const n1 = ri(1, 6) * 10 * z2 / gcd(z1 * 10, z2); return { n1, z1, z2 }; },
      calc: v => v.n1 * v.z1 / v.z2, desp: { n1: '{n2} · {z2} / {z1}' },
      ctx: ['Dos ruedas dentadas engranan en una máquina.'] },
    { id: 'palanca', mat: 'tecnologia', nombre: 'Ley de la palanca', min: 2, dec: 2,
      sub: { k: 'F', sym: 'F', nom: 'la fuerza que hay que hacer', u: 'N' }, tpl: '{R} · {r} / {d}',
      vars: [
          { k: 'R', sym: 'R', nom: 'resistencia (peso que se levanta)', u: 'N', g: () => ri(5, 100) * 10 },
          { k: 'r', sym: 'r', nom: 'brazo de la resistencia', u: 'm', g: () => dec(0.2, 1.5, 0.1) },
          { k: 'd', sym: 'd', nom: 'brazo de la potencia', u: 'm', g: () => dec(1, 4, 0.5) },
      ],
      calc: v => v.R * v.r / v.d, ctx: ['Se usa una palanca para levantar una piedra.'] },
    // ── Geografía ──
    { id: 'densPob', mat: 'geografia', nombre: 'Densidad de población', min: 1, dec: 1,
      sub: { k: 'D', sym: 'D', nom: 'la densidad de población', u: 'hab/km²' }, tpl: '{hab} / {S}',
      vars: [
          { k: 'hab', sym: 'N', nom: 'número de habitantes', u: 'habitantes', g: () => ri(5, 9000) * 100 },
          { k: 'S', sym: 'S', nom: 'superficie', u: 'km²', g: () => ri(10, 2000) },
      ],
      calc: v => v.hab / v.S, ctx: ['Un municipio tiene estos datos de población y superficie.'] },
    { id: 'escala', mat: 'geografia', nombre: 'Escala de un mapa', min: 2,
      sub: { k: 'Dr', sym: 'D', nom: 'la distancia real', u: 'km' }, tpl: '{dm} · {E} / 100000',
      vars: [
          { k: 'dm', sym: 'd', nom: 'distancia en el mapa', u: 'cm', g: () => ri(1, 30) },
          { k: 'E', sym: 'E', nom: 'denominador de la escala', u: '', g: () => pick([10000, 25000, 50000, 100000, 200000, 1000000]) },
      ],
      calc: v => v.dm * v.E / 100000, desp: { dm: '100000 · {Dr} / {E}' },
      ctx: ['En un mapa a escala 1 : E se mide la distancia entre dos pueblos (1 km = 100 000 cm).'] },
    { id: 'altitud', mat: 'geografia', nombre: 'Temperatura y altitud', min: 2,
      sub: { k: 'T', sym: 'T', nom: 'la temperatura en la cima', u: '°C' }, tpl: '{T0} − 6,5 · {h}',
      vars: [
          { k: 'T0', sym: 'T₀', nom: 'temperatura en el valle', u: '°C', g: () => ri(5, 30) },
          { k: 'h', sym: 'h', nom: 'desnivel', u: 'km', g: () => dec(0.5, 4, 0.5) },
      ],
      calc: v => v.T0 - 6.5 * v.h, desp: { T0: '{T} + 6,5 · {h}', h: '({T0} − {T}) / 6,5' },
      ctx: ['La temperatura baja unos 6,5 °C por cada kilómetro que se asciende. Una montañera sube desde el valle a un pico.'] },
];

export function infoVar(f, k) { return k === f.sub.k ? f.sub : f.vars.find(x => x.k === k); }
const unidad = u => (u ? ` ${u}` : '');
// Sustituye {clave} por el símbolo (si está en `simbolos`) o por su valor
export function rellenar(tpl, f, v, simbolos = []) {
    return tpl.replace(/\{(\w+)\}/g, (_, k) => (v == null || simbolos.includes(k)) ? infoVar(f, k).sym : fmtP(v[k]));
}

export function generarFormula(nivel = 2, materia = 'todas', tipo = 'valor') {
    const deMateria = FORMULAS.filter(f => materia === 'todas' || f.mat === materia);
    let lista = deMateria.filter(f => f.min <= nivel);
    if (!lista.length) lista = deMateria;
    if (tipo === 'despejar' && lista.some(f => f.desp)) lista = lista.filter(f => f.desp);
    for (let intento = 0; intento < 100; intento++) {
        const f = pick(lista);
        const v = f.gen ? f.gen(nivel) : Object.fromEntries(f.vars.map(x => [x.k, x.g(nivel)]));
        const res = f.calc(v);
        if (!isFinite(res) || (f.ok && !f.ok(v, res))) continue;
        v[f.sub.k] = res;
        const desp = Object.keys(f.desp || {});
        const despejar = desp.length > 0 && (tipo === 'despejar' || (tipo === 'mezcla' && Math.random() < 0.5));
        const ctx = typeof f.ctx === 'function' ? f.ctx(v) : f.ctx;
        return { f, v, despejar, target: despejar ? pick(desp) : f.sub.k, ctx: pick(ctx), key: Math.random() };
    }
    return generarFormula(nivel, 'todas', 'valor');
}

// Respuesta esperada y tolerancia
export function solucionFormula(ej) {
    const { f, v, despejar, target } = ej;
    if (despejar) return { valor: v[target], tol: Math.max(0.011, Math.abs(v[target]) * 0.002), redondeo: null };
    const d = f.dec ?? 2;
    const exacto = Math.abs(red(v[f.sub.k], d) - v[f.sub.k]) < 1e-9;
    return { valor: red(v[f.sub.k], d), exacto: v[f.sub.k], tol: 0.5 * 10 ** -d + 1e-6, redondeo: exacto ? null : d };
}

export function M_Formulas({ onScore }) {
    const [nivel, setNivel] = useState(2);
    const [materia, setMateria] = useState('todas');
    const [tipo, setTipo] = useState('valor');
    const [ej, setEj] = useState(() => generarFormula(2, 'todas', 'valor'));
    const [resp, setResp] = useState('');
    const [pista, setPista] = useState(false);
    const [result, setResult] = useState(null);
    const [score, setScore] = useState({ ok: 0, total: 0 });

    const nuevo = (n = nivel, m = materia, t = tipo) => { setEj(generarFormula(n, m, t)); setResp(''); setPista(false); setResult(null); };
    const { f, v, despejar, target } = ej;
    const sol = solucionFormula(ej);
    const tInfo = infoVar(f, target);
    const mat = MATERIAS[f.mat];
    const datos = despejar ? [f.sub.k, ...f.vars.map(x => x.k).filter(k => k !== target)] : f.vars.map(x => x.k);
    const formula = `${f.sub.sym} = ${rellenar(f.tpl, f, null)}`;
    const sustitucion = despejar
        ? `${fmt(v[f.sub.k])} = ${rellenar(f.tpl, f, v, [target])}`
        : `${f.sub.sym} = ${rellenar(f.tpl, f, v)}`;

    const comprobar = () => {
        const r = leerNum(resp);
        if (r == null) { setResult({ ok: false, aviso: true, msg: 'Escribe un número (puedes usar coma decimal).' }); return; }
        const ok = Math.abs(r - sol.valor) <= sol.tol || (sol.exacto != null && Math.abs(r - sol.exacto) <= sol.tol);
        setResult({ ok, msg: ok ? '¡Correcto!' : 'No es correcto. Mira la resolución.' });
        setScore(s => ({ ok: s.ok + (ok ? 1 : 0), total: s.total + 1 }));
        onScore(ok ? 1 : 0, 1, {
            modulo: 'formulas', materia: mat.nom, formula: f.nombre, despejar,
            pregunta: `${despejar ? 'Despejar ' : ''}${tInfo.sym} · ${datos.map(k => `${infoVar(f, k).sym}=${fmt(v[k])}`).join(', ')}`,
            respuesta: fmt(r), correcta: `${fmt(sol.valor)}${unidad(tInfo.u)}`, ok, pista,
        });
    };

    const lblSel = { fontSize: '0.78rem', color: '#8b949e', display: 'flex', flexDirection: 'column', gap: 4 };
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <label style={lblSel}>Curso
                    <select style={SELECT} value={nivel} onChange={e => { const n = +e.target.value; setNivel(n); nuevo(n); }}>
                        <option value={1}>1.º – 2.º ESO</option><option value={2}>3.º ESO</option><option value={3}>4.º ESO</option>
                    </select>
                </label>
                <label style={lblSel}>Materia
                    <select style={SELECT} value={materia} onChange={e => { setMateria(e.target.value); nuevo(nivel, e.target.value); }}>
                        <option value="todas">🌐 Todas</option>
                        {Object.entries(MATERIAS).map(([k, m]) => <option key={k} value={k}>{m.emoji} {m.nom}</option>)}
                    </select>
                </label>
                <label style={lblSel}>Tipo de ejercicio
                    <select style={SELECT} value={tipo} onChange={e => { setTipo(e.target.value); nuevo(nivel, materia, e.target.value); }}>
                        <option value="valor">Calcular el valor numérico</option>
                        <option value="despejar">Despejar un dato</option>
                        <option value="mezcla">Mezcla</option>
                    </select>
                </label>
            </div>

            <div style={{ ...CARD, borderColor: mat.color + '66' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                    <span style={{ padding: '3px 10px', borderRadius: 12, background: mat.color + '22', color: mat.color, fontWeight: 700, fontSize: '0.78rem' }}>{mat.emoji} {mat.nom} · {f.nombre}</span>
                    {despejar && <span style={{ padding: '3px 10px', borderRadius: 12, background: '#9b59b622', color: '#c39bd3', fontWeight: 700, fontSize: '0.78rem' }}>🔁 Despejar</span>}
                </div>
                <div style={{ ...MATH, fontSize: '1.45rem', color: '#f39c12', textAlign: 'center', margin: '6px 0 14px' }}>{formula}</div>
                <div style={{ fontSize: '0.95rem', color: '#e6edf3', lineHeight: 1.6 }}>{ej.ctx}</div>
                <ul style={{ margin: '8px 0', paddingLeft: 22, color: '#c9d1d9', fontSize: '0.92rem', lineHeight: 1.7 }}>
                    {datos.map(k => { const x = infoVar(f, k); return <li key={k}>{x.nom.charAt(0).toUpperCase() + x.nom.slice(1)}: <b style={MATH}>{x.sym} = {fmt(v[k])}{unidad(x.u)}</b></li>; })}
                </ul>
                <div style={{ fontSize: '0.95rem', color: '#e6edf3', fontWeight: 600 }}>
                    ¿Cuánto vale {despejar ? `el dato «${tInfo.nom}»` : f.sub.nom} ({tInfo.sym})?
                    {sol.redondeo != null && <span style={{ color: '#8b949e', fontWeight: 400 }}> Redondea a las {NOMBRE_DEC[sol.redondeo]}.</span>}
                </div>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ ...MATH, fontSize: '1.1rem' }}>{tInfo.sym} =</span>
                <input value={resp} onChange={e => setResp(e.target.value)} disabled={!!result && !result.aviso}
                    onKeyDown={e => { if (e.key === 'Enter' && (!result || result.aviso)) comprobar(); }}
                    inputMode="decimal" placeholder="?" style={{ ...INPUT, width: 140 }} />
                <span style={{ color: '#8b949e' }}>{tInfo.u}</span>
                {!pista && (!result || result.aviso) && <button style={BTN_SEC} onClick={() => setPista(true)}>💡 Pista</button>}
            </div>
            {pista && (!result || result.aviso) && (
                <div style={{ ...CARD, padding: 12, background: '#1a1030', border: '1px solid #9b59b644', fontSize: '0.9rem', color: '#c9d1d9' }}>
                    Sustituye cada letra por su valor: <span style={{ ...MATH, color: '#f39c12' }}>{sustitucion}</span>
                    {despejar && <div style={{ marginTop: 4 }}>Ahora resuelve la ecuación para encontrar <b>{tInfo.sym}</b>.</div>}
                </div>
            )}

            {(!result || result.aviso)
                ? <>
                    {result?.aviso && <div style={{ color: '#e88', fontSize: '0.85rem' }}>{result.msg}</div>}
                    <button style={{ ...BTN('#f39c12', '#111'), alignSelf: 'flex-start' }} onClick={comprobar}>Comprobar</button>
                </>
                : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <Feedback ok={result.ok} msg={result.msg} />
                        <div style={{ ...CARD, padding: 14, background: '#0d1117', fontSize: '0.92rem', color: '#c9d1d9', lineHeight: 1.9 }}>
                            <div><b style={{ color: '#8b949e' }}>1. Fórmula:</b> <span style={MATH}>{formula}</span></div>
                            <div><b style={{ color: '#8b949e' }}>2. Sustituimos:</b> <span style={MATH}>{sustitucion}</span></div>
                            {despejar && f.desp?.[target] && <div><b style={{ color: '#8b949e' }}>3. Despejamos:</b> <span style={MATH}>{tInfo.sym} = {rellenar(f.desp[target], f, v)}</span></div>}
                            <div><b style={{ color: '#8b949e' }}>{despejar ? '4' : '3'}. Resultado:</b> <span style={{ ...MATH, color: '#2ecc71' }}>{tInfo.sym} = {fmt(sol.exacto != null && sol.redondeo != null ? sol.exacto : sol.valor)}{sol.redondeo != null ? ` ≈ ${fmt(sol.valor)}` : ''}{unidad(tInfo.u)}</span></div>
                        </div>
                        <button style={{ ...BTN('#f39c12', '#111'), alignSelf: 'center' }} onClick={() => nuevo()}>Siguiente →</button>
                    </div>
                )}
            <span style={{ fontSize: '0.85rem', color: '#8b949e' }}>✅ {score.ok} / {score.total}</span>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 10. ÁREAS Y PERÍMETROS CON POLINOMIOS
// ═══════════════════════════════════════════════════════════════════════════════
const add = (...ps) => { const l = Math.max(...ps.map(p => p.length)); return Array.from({ length: l }, (_, i) => ps.reduce((s, p) => s + (p[i] || 0), 0)); };
const esc = (k, p) => p.map(c => c * k);
const sub = (a, b) => add(a, esc(-1, b));
const pS = p => polyStr(p);
const par = p => `(${pS(p)})`;
// «6·3² + 5·3 − 4 = 65»
function evalStr(P, x) {
    const p = norm(P); const t = [];
    for (let d = p.length - 1; d >= 0; d--) {
        const c = p[d]; if (!c) continue;
        const ac = Math.abs(c);
        const s = d === 0 ? `${ac}` : `${ac === 1 ? '' : ac + '·'}${x}${d === 2 ? '²' : d === 3 ? '³' : d > 1 ? '^' + d : ''}`;
        t.push((t.length ? (c < 0 ? ' − ' : ' + ') : (c < 0 ? '−' : '')) + s);
    }
    return `${t.join('')} = ${evalNum(P, x)}`;
}

function ladoLineal(n) {
    const a = n === 1 ? ri(1, 3) : ri(1, 5);
    const b = n === 1 ? ri(1, 6) : ri(-4, 8);
    return [b, a];
}
const TRIPLES = [[3, 4, 5], [6, 8, 10], [5, 12, 13]];

export const FIGURAS_POLI = {
    rect: 'Rectángulo', cuadrado: 'Cuadrado', triRect: 'Triángulo rectángulo',
    triIso: 'Triángulo isósceles', triBH: 'Triángulo (base y altura)', compuesta: 'Figura con hueco',
};

export function generarFiguraPoli(nivel = 2, figura = 'todas', modoValor = 'aveces') {
    const opciones = Object.keys(FIGURAS_POLI).filter(k => k !== 'compuesta' || nivel >= 2);
    const tipo = figura === 'todas' ? pick(opciones) : figura;
    const u = () => [nivel === 1 ? ri(1, 4) : ri(-1, 4), nivel === 1 ? 1 : ri(1, 2)];
    let fig;
    if (tipo === 'rect') {
        const B = ladoLineal(nivel); let H; do { H = ladoLineal(nivel); } while (H[0] === B[0] && H[1] === B[1]);
        fig = { lados: [['base', B], ['altura', H]], P: add(esc(2, B), esc(2, H)), A: mul(B, H),
            pExp: `P = 2·${par(B)} + 2·${par(H)}`, aExp: `A = base · altura = ${par(B)}·${par(H)}` };
    } else if (tipo === 'cuadrado') {
        const L = ladoLineal(nivel);
        fig = { lados: [['lado', L]], P: esc(4, L), A: mul(L, L), pExp: `P = 4·${par(L)}`, aExp: `A = lado² = ${par(L)}²` };
    } else if (tipo === 'triRect') {
        const U = u(); const [a, b, c] = nivel === 1 ? TRIPLES[0] : pick(TRIPLES);
        const C1 = esc(a, U), C2 = esc(b, U), Hp = esc(c, U);
        fig = { lados: [['cateto', C1], ['cateto', C2], ['hipotenusa', Hp]], P: add(C1, C2, Hp), A: esc(1 / 2, mul(C1, C2)),
            pExp: `P = ${par(C1)} + ${par(C2)} + ${par(Hp)}`, aExp: `A = cateto · cateto / 2 = ${par(C1)}·${par(C2)} / 2` };
    } else if (tipo === 'triIso') {
        const U = u(); const [b, h, l] = pick([[6, 4, 5], [8, 3, 5], [10, 12, 13]]);
        const Bs = esc(b, U), Hs = esc(h, U), Ls = esc(l, U);
        fig = { lados: [['base', Bs], ['altura', Hs], ['lado igual', Ls]], P: add(Bs, esc(2, Ls)), A: esc(1 / 2, mul(Bs, Hs)),
            pExp: `P = base + 2·lado = ${par(Bs)} + 2·${par(Ls)}`, aExp: `A = base · altura / 2 = ${par(Bs)}·${par(Hs)} / 2`, noLadoAltura: true };
    } else if (tipo === 'triBH') {
        const B = [2 * (nivel === 1 ? ri(1, 3) : ri(-2, 4)), 2 * ri(1, nivel === 1 ? 2 : 3)];
        const H = ladoLineal(nivel);
        fig = { lados: [['base', B], ['altura', H]], A: esc(1 / 2, mul(B, H)), aExp: `A = base · altura / 2 = ${par(B)}·${par(H)} / 2` };
    } else {
        const L = [ri(1, 3), nivel === 3 ? ri(0, 1) : 0];
        const B = [ri(4, 9), ri(1, 3) + L[1] + 1], H = [ri(3, 8), ri(1, 2) + L[1]];
        const Ln = norm(L);
        fig = { lados: [['base', B], ['altura', H], ['lado del hueco cuadrado', Ln]], A: sub(mul(B, H), mul(Ln, Ln)),
            aExp: `A = base · altura − lado² = ${par(B)}·${par(H)} − ${par(Ln)}²`, sombreada: true, extra: [[B, Ln], [H, Ln]] };
    }
    fig.A = norm(fig.A.map(c => Math.round(c)));
    if (fig.P) fig.P = norm(fig.P);

    // x que deja todas las medidas positivas (y el hueco dentro de la figura)
    const valida = x => fig.lados.every(([, p]) => evalNum(p, x) > 0) && (fig.extra || []).every(([g, s]) => evalNum(g, x) - evalNum(s, x) >= 2);
    const xs = [1, 2, 3, 4, 5, 6, 7, 8].filter(valida);
    const x0 = pick(xs.length ? xs : [8]);

    const preguntas = [];
    if (fig.P) preguntas.push({ k: 'P', tipo: 'poly', lbl: 'P(x) =', ans: fig.P, exp: `${fig.pExp} = ${pS(fig.P)}` });
    preguntas.push({ k: 'A', tipo: 'poly', lbl: fig.sombreada ? 'A(x) zona coloreada =' : 'A(x) =', ans: fig.A, exp: `${fig.aExp} = ${pS(fig.A)}` });
    const conValor = modoValor === 'siempre' || (modoValor === 'aveces' && Math.random() < 0.55);
    let enunciadoX = null;
    if (conValor) {
        if (nivel === 3 && fig.P && Math.random() < 0.5) {
            const Pv = evalNum(fig.P, x0);
            enunciadoX = `Si el perímetro mide ${Pv} cm, ¿cuánto vale x?`;
            preguntas.push({ k: 'x', tipo: 'num', lbl: 'x =', unit: '', ans: x0, exp: `${pS(fig.P)} = ${Pv} → x = ${x0}` });
            preguntas.push({ k: 'Av', tipo: 'num', lbl: 'Área para ese valor =', unit: 'cm²', ans: evalNum(fig.A, x0), exp: `A(${x0}) = ${evalStr(fig.A, x0)} cm²` });
        } else {
            if (fig.P) preguntas.push({ k: 'Pv', tipo: 'num', lbl: `P(${x0}) =`, unit: 'cm', ans: evalNum(fig.P, x0), exp: `P(${x0}) = ${evalStr(fig.P, x0)} cm` });
            preguntas.push({ k: 'Av', tipo: 'num', lbl: `A(${x0}) =`, unit: 'cm²', ans: evalNum(fig.A, x0), exp: `A(${x0}) = ${evalStr(fig.A, x0)} cm²` });
        }
    }
    return { tipo, nombre: FIGURAS_POLI[tipo], ...fig, x0, conValor, enunciadoX, preguntas, key: Math.random() };
}

// ─── Dibujo de la figura (no a escala) ────────────────────────────────────────
// tipo: clave de FIGURAS_POLI · etiquetas: textos de los lados en el orden de `lados`
// papel: colores para imprimir (fichas PDF) en lugar del tema oscuro
export function DibujoFigura({ tipo, etiquetas, papel = false, maxWidth = 440 }) {
    const C = papel
        ? { linea: '#2c3e50', relleno: 'rgba(142,68,173,0.10)', rellenoFuerte: 'rgba(142,68,173,0.28)', texto: '#2c3e50', sec: '#8e44ad', gris: '#7f8c8d', hueco: 'white' }
        : { linea: '#f39c12', relleno: 'rgba(243,156,18,0.13)', rellenoFuerte: 'rgba(243,156,18,0.35)', texto: '#e6edf3', sec: '#c39bd3', gris: '#8b949e', hueco: '#0d1117' };
    const st = { stroke: C.linea, strokeWidth: 2.5, fill: C.relleno };
    const T = ({ x, y, a = 'middle', c = C.texto, children }) => <text x={x} y={y} textAnchor={a} fill={c} style={{ fontFamily: 'Georgia,serif', fontWeight: 700, fontSize: 14 }}>{children}</text>;
    const dash = { stroke: C.gris, strokeWidth: 1.5, strokeDasharray: '5 4' };
    const L = etiquetas;
    let g;
    if (tipo === 'rect') g = <><rect x={70} y={30} width={210} height={120} {...st} /><T x={175} y={172}>{L[0]}</T><T x={290} y={95} a="start">{L[1]}</T></>;
    else if (tipo === 'cuadrado') g = <><rect x={115} y={25} width={130} height={130} {...st} /><T x={180} y={176}>{L[0]}</T><T x={255} y={95} a="start">{L[0]}</T></>;
    else if (tipo === 'triRect') g = <><polygon points="90,160 90,30 290,160" {...st} /><polyline points="90,146 104,146 104,160" fill="none" stroke={C.linea} strokeWidth={1.5} /><T x={82} y={100} a="end">{L[0]}</T><T x={190} y={180}>{L[1]}</T><T x={200} y={86} a="start" c={C.sec}>{L[2]}</T></>;
    else if (tipo === 'triIso') g = <><polygon points="60,160 300,160 180,30" {...st} /><line x1={180} y1={30} x2={180} y2={160} {...dash} /><T x={180} y={180}>{L[0]}</T><T x={186} y={118} a="start" c={C.gris}>{L[1]}</T><T x={110} y={88} a="end" c={C.sec}>{L[2]}</T><T x={250} y={88} a="start" c={C.sec}>{L[2]}</T></>;
    else if (tipo === 'triBH') g = <><polygon points="50,160 300,160 120,30" {...st} /><line x1={120} y1={30} x2={120} y2={160} {...dash} /><T x={175} y={180}>{L[0]}</T><T x={114} y={110} a="end" c={C.gris}>{L[1]}</T></>;
    else g = <><rect x={50} y={20} width={240} height={140} {...st} fill={C.rellenoFuerte} /><rect x={150} y={55} width={70} height={70} fill={C.hueco} stroke={C.sec} strokeWidth={2} /><T x={170} y={180}>{L[0]}</T><T x={300} y={95} a="start">{L[1]}</T><T x={185} y={50} c={C.sec}>{L[2]}</T></>;
    return (
        <svg viewBox="0 0 380 192" style={{ width: '100%', maxWidth, display: 'block', margin: '0 auto' }}>
            {g}
            <text x={376} y={190} textAnchor="end" fill={C.gris} style={{ fontSize: 10 }}>dibujo no a escala · medidas en cm</text>
        </svg>
    );
}

export function M_AreasPolinomios({ onScore }) {
    const [nivel, setNivel] = useState(2);
    const [figura, setFigura] = useState('todas');
    const [modoValor, setModoValor] = useState('aveces');
    const [ej, setEj] = useState(() => generarFiguraPoli(2, 'todas', 'aveces'));
    const [resp, setResp] = useState({});
    const [res, setRes] = useState(null);
    const [verExp, setVerExp] = useState(false);
    const [score, setScore] = useState({ ok: 0, total: 0 });

    const vacios = e => Object.fromEntries(e.preguntas.filter(q => q.tipo === 'poly').map(q => [q.k, [0, 0, 0]]));
    const [polys, setPolys] = useState(() => vacios(ej));
    const nuevo = (n = nivel, f = figura, m = modoValor) => { const e = generarFiguraPoli(n, f, m); setEj(e); setPolys(vacios(e)); setResp({}); setRes(null); };
    const parsed = polys;

    const comprobar = () => {
        const r = {};
        ej.preguntas.forEach(q => {
            if (q.tipo === 'poly') { const p = norm(polys[q.k] || [0]); r[q.k] = p.length === q.ans.length && p.every((c, i) => c === q.ans[i]); }
            else { const n = leerNum(resp[q.k] || ''); r[q.k] = n != null && Math.abs(n - q.ans) < 1e-6; }
        });
        const cnt = Object.values(r).filter(Boolean).length;
        setRes(r);
        setScore(s => ({ ok: s.ok + cnt, total: s.total + ej.preguntas.length }));
        onScore(cnt, ej.preguntas.length, {
            modulo: 'geopoli', figura: ej.nombre,
            lados: ej.lados.map(([n, p]) => `${n} ${pS(p)}`).join(', '),
            aciertos: cnt, total: ej.preguntas.length, ok: cnt === ej.preguntas.length,
            preguntas: ej.preguntas.map(q => ({ p: q.lbl, ok: !!r[q.k], resp: (Array.isArray(parsed[q.k]) ? pS(parsed[q.k]) : resp[q.k]) || '—', correcta: q.tipo === 'poly' ? pS(q.ans) : String(q.ans) })),
        });
    };

    const lblSel = { fontSize: '0.78rem', color: '#8b949e', display: 'flex', flexDirection: 'column', gap: 4 };
    const desc = ej.lados.map(([n, p]) => <span key={n + pS(p)}>{n} <b style={{ ...MATH, color: '#f39c12' }}>{pS(p)}</b></span>);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <label style={lblSel}>Curso
                    <select style={SELECT} value={nivel} onChange={e => { const n = +e.target.value; setNivel(n); nuevo(n); }}>
                        <option value={1}>2.º ESO</option><option value={2}>3.º ESO</option><option value={3}>4.º ESO</option>
                    </select>
                </label>
                <label style={lblSel}>Figura
                    <select style={SELECT} value={figura} onChange={e => { setFigura(e.target.value); nuevo(nivel, e.target.value); }}>
                        <option value="todas">Todas</option>
                        {Object.entries(FIGURAS_POLI).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                    </select>
                </label>
                <label style={lblSel}>Valor numérico
                    <select style={SELECT} value={modoValor} onChange={e => { setModoValor(e.target.value); nuevo(nivel, figura, e.target.value); }}>
                        <option value="aveces">En algunos ejercicios</option><option value="siempre">Siempre</option><option value="nunca">Nunca</option>
                    </select>
                </label>
            </div>

            <div style={CARD}>
                <div style={{ fontWeight: 700, color: '#e6edf3', marginBottom: 6 }}>📐 {ej.nombre}</div>
                <div style={{ fontSize: '0.9rem', color: '#c9d1d9', lineHeight: 1.7, marginBottom: 8 }}>
                    Las medidas vienen dadas por polinomios: {desc.reduce((acc, el, i) => i ? [...acc, ', ', el] : [el], [])}.
                    {' '}{ej.P ? 'Calcula el polinomio del perímetro y el del área' : `Calcula el polinomio del área${ej.sombreada ? ' de la zona coloreada' : ''}`}
                    {ej.conValor && !ej.enunciadoX ? `, y su valor numérico para x = ${ej.x0}.` : '.'}
                    {ej.enunciadoX && <> {ej.enunciadoX}</>}
                    {ej.noLadoAltura && <div style={{ fontSize: '0.8rem', color: '#8b949e' }}>Recuerda: la altura no se suma en el perímetro.</div>}
                </div>
                <DibujoFigura tipo={ej.tipo} etiquetas={ej.lados.map(([, p]) => pS(p))} />
            </div>

            <button style={{ ...BTN_SEC, alignSelf: 'flex-start' }} onClick={() => setVerExp(v => !v)}>📖 {verExp ? 'Ocultar' : 'Fórmulas y cómo se hace'}</button>
            {verExp && (
                <div style={{ ...CARD, background: '#1a1030', border: '1px solid #9b59b644', fontSize: '0.86rem', color: '#c9d1d9', lineHeight: 1.7 }}>
                    <b style={{ color: '#c39bd3' }}>Perímetro</b>: suma de todos los lados (rectángulo: 2·base + 2·altura; cuadrado: 4·lado).<br />
                    <b style={{ color: '#c39bd3' }}>Área</b>: rectángulo base·altura · cuadrado lado² · triángulo base·altura/2.<br />
                    Suma los términos semejantes para el perímetro y multiplica los polinomios (propiedad distributiva o identidades notables) para el área.<br />
                    <b style={{ color: '#c39bd3' }}>Valor numérico</b>: sustituye x por el número en el polinomio que has obtenido.<br />
                    <span style={MATH}>Ej.: (x + 3)·(2x + 1) = 2x² + x + 6x + 3 = 2x² + 7x + 3</span>
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {ej.preguntas.map(q => {
                    const ok = res?.[q.k];
                    if (q.tipo === 'poly') return (
                        <div key={q.k} style={{ ...CARD, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, borderColor: res ? (ok ? '#2ecc71' : '#e74c3c') : '#30363d' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ ...MATH, color: '#e6edf3' }}>{q.lbl}</span>
                                {res && (ok ? <CheckCircle size={18} color="#2ecc71" /> : <XCircle size={18} color="#e74c3c" />)}
                            </div>
                            <PolyInput value={polys[q.k] || [0, 0, 0]} maxDeg={2} grande disabled={!!res}
                                onChange={fn => setPolys(r => ({ ...r, [q.k]: fn(r[q.k] || [0, 0, 0]) }))} />
                            {res && <div style={{ fontSize: '0.84rem', color: ok ? '#7ee2a8' : '#f0a0a0', ...MATH, fontWeight: 400 }}>{q.exp}</div>}
                        </div>
                    );
                    return (
                        <div key={q.k} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                <span style={{ ...MATH, minWidth: 110, color: '#e6edf3' }}>{q.lbl}</span>
                                <input value={resp[q.k] || ''} onChange={e => setResp(r => ({ ...r, [q.k]: e.target.value }))} disabled={!!res}
                                    placeholder={q.tipo === 'poly' ? '2x^2 + 7x + 3' : '?'} inputMode={q.tipo === 'num' ? 'decimal' : undefined}
                                    style={{ ...INPUT, width: q.tipo === 'poly' ? 220 : 110, textAlign: q.tipo === 'poly' ? 'left' : 'center', borderColor: res ? (ok ? '#2ecc71' : '#e74c3c') : '#30363d' }} />
                                {q.unit && <span style={{ color: '#8b949e' }}>{q.unit}</span>}
                                {res && (ok ? <CheckCircle size={18} color="#2ecc71" /> : <XCircle size={18} color="#e74c3c" />)}
                            </div>
                            {res && <div style={{ fontSize: '0.84rem', paddingLeft: 120, color: ok ? '#7ee2a8' : '#f0a0a0', ...MATH, fontWeight: 400 }}>{q.exp}</div>}
                        </div>
                    );
                })}
            </div>

            {!res
                ? <button style={{ ...BTN('#f39c12', '#111'), alignSelf: 'flex-start' }} onClick={comprobar}>Comprobar</button>
                : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
                        <Feedback ok={Object.values(res).every(Boolean)} msg={Object.values(res).every(Boolean) ? '¡Todo correcto!' : `${Object.values(res).filter(Boolean).length}/${ej.preguntas.length} correctas. Revisa la resolución.`} />
                        <button style={BTN('#f39c12', '#111')} onClick={() => nuevo()}>Siguiente →</button>
                    </div>
                )}
            <span style={{ fontSize: '0.85rem', color: '#8b949e' }}>✅ {score.ok} / {score.total}</span>
        </div>
    );
}
