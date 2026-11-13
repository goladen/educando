// ─────────────────────────────────────────────────────────────────────────────
//  Problemas de FÍSICA y otras materias (Química, Biología, Economía, Tecnología,
//  Geografía, Música) que se resuelven con los tipos de ecuación de la app:
//  1.er grado, 2.º grado, x en el denominador, raíces, exponenciales,
//  logarítmicas y trigonométricas.
//  Cada plantilla indica sus simuladores de física (claves de LandingGames3 → SIMS)
//  para mostrarlos dentro de ellos (ProblemasSimulador.jsx) y en su ficha PDF.
//  gen() → { texto, sols, ecuacion (en x, para la gráfica), pasos, unidad?, decimales?,
//            tol?, tolRel?, grados?, rango?, cientifica?, sinGrafica?, descartadas? }
// ─────────────────────────────────────────────────────────────────────────────
import { crearProblema, MENOS, decimalEs, poli } from './ecuacionesAvanzadas';

const R = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const es = (v, d = 2) => decimalEs(v, d);
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const grad = (r) => (r * 180) / Math.PI;
const rad = (d) => (d * Math.PI) / 180;

export const TIPOS_ECU = {
    lineal: '1.er grado', cuadratica: '2.º grado', racional: 'x en el denominador', radical: 'con raíces',
    exponencial: 'exponencial', logaritmica: 'logarítmica', trigonometrica: 'trigonométrica',
};
const FIS = '⚛️ Física', QUI = '🧪 Química', BIO = '🧬 Biología', ECO = '💶 Economía', TEC = '⚙️ Tecnología', GEO = '🌍 Geografía', MUS = '🎵 Música';

// Ternas (a, b, c) con c = a·b/(a + b) entera: resistencias en paralelo, lentes…
const ternasArmonicas = (() => {
    const out = [];
    for (let a = 2; a <= 60; a++) for (let b = a; b <= 60; b++) if ((a * b) % (a + b) === 0) out.push([a, b, (a * b) / (a + b)]);
    return out;
})();
const PITAGORICAS = [[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17], [9, 12, 15], [12, 16, 20], [7, 24, 25], [20, 21, 29]];

export const PLANTILLAS_CIENCIAS = [
    // ═════════════════════════ 1.er GRADO ═════════════════════════
    {
        id: 'mruPersecucion', materia: FIS, tema: 'Movimiento (MRU)', ecu: 'lineal', sims: [],
        gen: () => {
            for (;;) {
                const v1 = pick([60, 72, 80, 90]), dv = pick([10, 20, 30, 40]), v2 = v1 + dv, t0 = pick([1, 2]);
                const x = (v1 * t0) / dv;
                if (x > 12 || !Number.isInteger(x * 2)) continue;
                return {
                    texto: `Un camión sale de una ciudad a ${v1} km/h. ${t0} hora${t0 > 1 ? 's' : ''} después sale un coche por la misma carretera a ${v2} km/h. ¿Cuántas horas tarda el coche en alcanzarlo?`,
                    sols: [x], ecuacion: `${v1}(x + ${t0}) = ${v2}x`, unidad: 'h', decimales: 2,
                    pasos: [`Cuando lo alcanza han recorrido la misma distancia:  ${v1}(x + ${t0}) = ${v2}x`, `${v1}x + ${v1 * t0} = ${v2}x  →  ${dv}x = ${v1 * t0}`, `x = ${es(x)} h`],
                };
            }
        },
    },
    {
        id: 'mruaVelocidad', materia: FIS, tema: 'MRUA', ecu: 'lineal', sims: ['PLANO_INCLINADO', 'CAIDA_LIBRE'],
        gen: () => {
            const v0 = pick([0, 0, 4, 5, 8, 10, 12, 15]), a = R(1, 5), t = R(2, 12), v = v0 + a * t;
            return {
                texto: `Un coche ${v0 ? `que va a ${v0} m/s` : 'que parte del reposo'} acelera a ${a} m/s². ¿Cuánto tarda en llegar a ${v} m/s? (v = v₀ + a·t)`,
                sols: [t], ecuacion: v0 ? `${v0} + ${a}x = ${v}` : `${a}x = ${v}`, unidad: 's',
                pasos: [`v = v₀ + a·t  →  ${v0 ? `${v0} + ` : ''}${a}x = ${v}`, `${a}x = ${v - v0}  →  x = ${t} s`],
            };
        },
    },
    {
        id: 'ohmSerie', materia: FIS, tema: 'Electricidad (ley de Ohm)', ecu: 'lineal', sims: ['LEY_OHM'],
        gen: () => {
            for (;;) {
                const I = pick([0.5, 1, 2, 0.2]), R1 = R(2, 20), x = R(2, 30), V = I * (R1 + x);
                if (!Number.isInteger(V) || V > 60) continue;
                return {
                    texto: `Una pila de ${V} V alimenta dos resistencias en serie: una de ${R1} Ω y otra desconocida. Si circula una intensidad de ${es(I)} A, ¿cuánto vale la resistencia desconocida? (V = I·R)`,
                    sols: [x], ecuacion: `${I}(${R1} + x) = ${V}`, unidad: 'Ω',
                    pasos: [`En serie, R = ${R1} + x  →  ${es(I)}·(${R1} + x) = ${V}`, `${R1} + x = ${V} : ${es(I)} = ${V / I}`, `x = ${x} Ω`],
                };
            }
        },
    },
    {
        id: 'temperatura', materia: FIS, tema: 'Escalas de temperatura', ecu: 'lineal', sims: ['GAY_LUSAC'],
        gen: () => {
            if (Math.random() < 0.2) {
                return {
                    texto: '¿A qué temperatura marcan lo mismo un termómetro Celsius y uno Fahrenheit? (°F = 1,8·°C + 32)',
                    sols: [-40], ecuacion: 'x = 1.8x + 32', unidad: '°C',
                    pasos: ['Buscamos x con x = 1,8x + 32', `${MENOS}0,8x = 32  →  x = ${MENOS}40 °C`],
                };
            }
            const C = 5 * R(-4, 20), F = 1.8 * C + 32;
            return {
                texto: `Un termómetro en grados Fahrenheit marca ${es(F)} °F. ¿Qué temperatura es en grados Celsius? (°F = 1,8·°C + 32)`,
                sols: [C], ecuacion: `1.8x + 32 = ${F}`, unidad: '°C',
                pasos: [`1,8x + 32 = ${es(F)}`, `1,8x = ${es(F - 32)}  →  x = ${C} °C`],
            };
        },
    },
    {
        id: 'boyle', materia: QUI, tema: 'Leyes de los gases (Boyle)', ecu: 'lineal', sims: ['GAY_LUSAC'],
        gen: () => {
            for (;;) {
                const P1 = pick([1, 1.5, 2, 3, 4]), V1 = pick([2, 3, 4, 5, 6, 8, 10, 12]), P2 = pick([0.5, 1, 1.5, 2, 2.5, 3, 4, 6]);
                const x = (P1 * V1) / P2;
                if (P1 === P2 || !Number.isInteger(x * 10)) continue;
                return {
                    texto: `Un gas ocupa ${es(V1)} L a ${es(P1)} atm. A temperatura constante, ¿qué volumen ocupará a ${es(P2)} atm? (P₁·V₁ = P₂·V₂)`,
                    sols: [x], ecuacion: `${P1}·${V1} = ${P2}x`, unidad: 'L', decimales: 2,
                    pasos: [`${es(P1)}·${es(V1)} = ${es(P2)}·x`, `x = ${es(P1 * V1)} : ${es(P2)} = ${es(x)} L`],
                };
            }
        },
    },
    {
        id: 'mezclaDisoluciones', materia: QUI, tema: 'Disoluciones', ecu: 'lineal', sims: ['AJUSTES_REACCION', 'ENLACE_MOLECULAS'],
        gen: () => {
            for (;;) {
                const c1 = pick([5, 10, 20]), c2 = pick([40, 50, 60, 80]), c = R(c1 + 5, c2 - 5), V2 = R(1, 10);
                const x = (V2 * (c2 - c)) / (c - c1);
                if (!Number.isInteger(x * 2) || x > 30) continue;
                return {
                    texto: `¿Cuántos litros de una disolución de alcohol al ${c1} % hay que mezclar con ${V2} L de otra al ${c2} % para obtener una disolución al ${c} %?`,
                    sols: [x], ecuacion: `${c1}x + ${c2 * V2} = ${c}(x + ${V2})`, unidad: 'L', decimales: 2,
                    pasos: [`Alcohol puro: ${c1 / 100 === 0.1 ? '0,1' : es(c1 / 100)}x + ${es(c2 / 100)}·${V2} = ${es(c / 100)}(x + ${V2})  → multiplicando por 100:`, `${c1}x + ${c2 * V2} = ${c}x + ${c * V2}`, `${c - c1}x = ${c2 * V2 - c * V2}  →  x = ${es(x)} L`],
                };
            }
        },
    },
    {
        id: 'iva', materia: ECO, tema: 'IVA', ecu: 'lineal', sims: [],
        gen: () => {
            const x = 100 * R(1, 25), tipo = pick([21, 21, 10, 4]), P = Math.round(x * (100 + tipo)) / 100;
            return {
                texto: `Un producto cuesta ${es(P)} € con un IVA del ${tipo} % incluido. ¿Cuál es su precio sin IVA?`,
                sols: [x], ecuacion: `${(100 + tipo) / 100}x = ${P}`, unidad: '€', decimales: 2,
                pasos: [`Pagamos el ${100 + tipo} % del precio:  ${es((100 + tipo) / 100)}x = ${es(P)}`, `x = ${es(P)} : ${es((100 + tipo) / 100)} = ${x} €`],
            };
        },
    },
    {
        id: 'energiaAltura', materia: FIS, tema: 'Conservación de la energía', ecu: 'lineal', sims: ['PENDULO', 'CAIDA_LIBRE', 'CAIDA_ESCALADA'],
        gen: () => {
            const v = pick([10, 20, 30]), H = v * v / 20 + R(1, 20) * 5, x = H - (v * v) / 20;
            return {
                texto: `Se deja caer una pelota desde ${H} m de altura. Sin rozamiento, ¿a qué altura lleva una velocidad de ${v} m/s? (m·g·H = m·g·h + ½·m·v²; g = 10 m/s²)`,
                sols: [x], ecuacion: `10x + ${(v * v) / 2} = ${10 * H}`, unidad: 'm',
                pasos: [`La masa se simplifica:  10·${H} = 10x + ½·${v}²`, `${10 * H} = 10x + ${(v * v) / 2}  →  10x = ${10 * H - (v * v) / 2}`, `x = ${x} m`],
            };
        },
    },
    {
        id: 'colisionInelastica', materia: FIS, tema: 'Cantidad de movimiento', ecu: 'lineal', sims: ['COLISIONES'],
        gen: () => {
            for (;;) {
                const m1 = R(1, 10), x = R(1, 15), vf = R(1, 6), v1 = ((m1 + x) * vf) / m1;
                if (!Number.isInteger(v1) || v1 > 40) continue;
                return {
                    texto: `Un carrito de ${m1} kg que va a ${v1} m/s choca con otro parado y quedan unidos, moviéndose a ${vf} m/s. ¿Cuál es la masa del carrito que estaba parado? (se conserva p = m·v)`,
                    sols: [x], ecuacion: `${m1 * v1} = (${m1} + x)·${vf}`, unidad: 'kg',
                    pasos: [`Antes: ${m1}·${v1} = ${m1 * v1} kg·m/s · después: (${m1} + x)·${vf}`, `${m1} + x = ${m1 * v1} : ${vf} = ${m1 + x}`, `x = ${x} kg`],
                };
            }
        },
    },
    // ═════════════════════════ 2.º GRADO ═════════════════════════
    {
        id: 'tiroVertical', materia: FIS, tema: 'Lanzamiento vertical', ecu: 'cuadratica', sims: ['TIRO_PARABOLICO', 'CAIDA_LIBRE'],
        gen: () => {
            let t1, t2;
            do { t1 = R(1, 5); t2 = R(2, 8); } while (t1 >= t2);
            const v0 = 5 * (t1 + t2), H = 5 * t1 * t2;
            return {
                texto: `Se lanza una pelota hacia arriba a ${v0} m/s. ¿En qué instantes está a ${H} m de altura? (h = v₀·t − 5t², con g = 10 m/s²) Hay dos soluciones.`,
                sols: [t1, t2], ecuacion: `${v0}x ${MENOS} 5x² = ${H}`, unidad: 's',
                pasos: [`${v0}x ${MENOS} 5x² = ${H}  →  5x² ${MENOS} ${v0}x + ${H} = 0`, `x² ${MENOS} ${t1 + t2}x + ${t1 * t2} = 0  →  x = ${t1} ; x = ${t2}`, `A los ${t1} s pasa subiendo y a los ${t2} s, bajando`],
            };
        },
    },
    {
        id: 'caidaConVelocidad', materia: FIS, tema: 'Caída libre', ecu: 'cuadratica', sims: ['CAIDA_LIBRE', 'CAIDA_ESCALADA'],
        gen: () => {
            const v0 = pick([0, 5, 10, 15, 20]), t = R(1, 6), H = v0 * t + 5 * t * t;
            return {
                texto: `Desde lo alto de un edificio de ${H} m ${v0 ? `se lanza hacia abajo una piedra a ${v0} m/s` : 'se deja caer una piedra'}. ¿Cuánto tarda en llegar al suelo? (h = v₀·t + 5t², g = 10 m/s²)`,
                sols: [t], ecuacion: v0 ? `${v0}x + 5x² = ${H}` : `5x² = ${H}`, unidad: 's',
                pasos: v0
                    ? [`5x² + ${v0}x ${MENOS} ${H} = 0  →  ${poli([1, v0 / 5, -H / 5])} = 0`, `x = ${t}  (la solución negativa no tiene sentido)`]
                    : [`x² = ${H} : 5 = ${t * t}`, `x = ±${t}  →  x = ${t} s (la negativa no vale)`],
            };
        },
    },
    {
        id: 'mruaEspacio', materia: FIS, tema: 'MRUA', ecu: 'cuadratica', sims: ['PLANO_INCLINADO'],
        gen: () => {
            const v0 = pick([0, 1, 2, 3, 4, 5]), a = pick([2, 4, 6]), t = R(2, 10), s = v0 * t + (a * t * t) / 2;
            return {
                texto: `Un carrito baja por una rampa: ${v0 ? `sale a ${v0} m/s` : 'parte del reposo'} y acelera a ${a} m/s². ¿Cuánto tarda en recorrer ${s} m? (s = v₀·t + ½·a·t²)`,
                sols: [t], ecuacion: v0 ? `${v0}x + ${a / 2}x² = ${s}` : `${a / 2}x² = ${s}`, unidad: 's',
                pasos: [`${v0 ? `${v0}x + ` : ''}${a / 2}x² = ${s}`, v0 ? `${poli([a / 2, v0, -s])} = 0  →  x = ${t} (la negativa se descarta)` : `x² = ${t * t}  →  x = ${t} s`],
            };
        },
    },
    {
        id: 'energiaCinetica', materia: FIS, tema: 'Energía cinética', ecu: 'cuadratica', sims: ['COLISIONES', 'PENDULO'],
        gen: () => {
            const m = pick([2, 4, 10, 20, 50, 80, 1000]), v = R(2, 30), Ec = (m * v * v) / 2;
            return {
                texto: `Un cuerpo de ${m} kg tiene una energía cinética de ${Ec.toLocaleString('es-ES')} J. ¿A qué velocidad se mueve? (Ec = ½·m·v²)`,
                sols: [v], ecuacion: `${m / 2}x² = ${Ec}`, unidad: 'm/s',
                pasos: [`½·${m}·x² = ${Ec}  →  ${m / 2}x² = ${Ec}`, `x² = ${v * v}  →  x = ${v} m/s (la velocidad negativa no se usa aquí)`],
            };
        },
    },
    {
        id: 'potenciaJoule', materia: FIS, tema: 'Potencia eléctrica', ecu: 'cuadratica', sims: ['LEY_OHM'],
        gen: () => {
            const Rr = pick([2, 4, 5, 10, 20, 50]), I = pick([0.5, 1, 2, 3, 4, 5]), P = Rr * I * I;
            return {
                texto: `Una resistencia de ${Rr} Ω disipa una potencia de ${es(P)} W. ¿Qué intensidad circula por ella? (P = R·I²)`,
                sols: [I], ecuacion: `${Rr}x² = ${P}`, unidad: 'A', decimales: 2,
                pasos: [`${Rr}x² = ${es(P)}  →  x² = ${es(I * I)}`, `x = ${es(I)} A`],
            };
        },
    },
    {
        id: 'interesCompuesto2', materia: ECO, tema: 'Interés compuesto', ecu: 'cuadratica', sims: [],
        gen: () => {
            const C = pick([1000, 2000, 5000, 10000]), r = pick([2, 4, 5, 10, 20]), M = Math.round(C * (1 + r / 100) ** 2 * 100) / 100;
            return {
                texto: `Un capital de ${C.toLocaleString('es-ES')} € se convierte en ${es(M)} € en 2 años a interés compuesto. ¿Cuál es el tipo de interés anual (en %)?`,
                sols: [r], ecuacion: `${C}(1 + x/100)² = ${M}`, unidad: '%', decimales: 2,
                pasos: [`${C.toLocaleString('es-ES')}·(1 + x/100)² = ${es(M)}  →  (1 + x/100)² = ${es(M / C, 4)}`, `1 + x/100 = ${es(1 + r / 100)}  →  x = ${r} %`],
            };
        },
    },
    {
        id: 'tiroHorizontal', materia: FIS, tema: 'Tiro horizontal', ecu: 'cuadratica', sims: ['TIRO_PARABOLICO'],
        gen: () => {
            const t = R(1, 6), v = pick([5, 8, 10, 12, 15, 20]), h = 5 * t * t;
            return {
                texto: `Desde una terraza a ${h} m de altura se lanza una pelota horizontalmente a ${v} m/s. ¿Cuánto tiempo tarda en llegar al suelo? ¿Y a qué distancia cae? Responde el tiempo. (vertical: h = 5t², g = 10 m/s²)`,
                sols: [t], ecuacion: `5x² = ${h}`, unidad: 's',
                pasos: [`El movimiento vertical es una caída libre:  5x² = ${h}  →  x² = ${t * t}`, `x = ${t} s (la negativa no vale)`, `Horizontal (MRU): distancia = ${v}·${t} = ${v * t} m`],
            };
        },
    },
    {
        id: 'alturaMaxima', materia: FIS, tema: 'Tiro parabólico', ecu: 'cuadratica', sims: ['TIRO_PARABOLICO'],
        gen: () => {
            const v = pick([10, 20, 30, 40]), hmax = (v * v) / 20;
            return {
                texto: `Se lanza un objeto verticalmente hacia arriba y sube hasta ${hmax} m. ¿Con qué velocidad se lanzó? (h_máx = v₀²/(2g), g = 10 m/s²)`,
                sols: [v], ecuacion: `x²/20 = ${hmax}`, unidad: 'm/s',
                pasos: [`x²/20 = ${hmax}  →  x² = ${v * v}`, `x = ${v} m/s (la negativa no tiene sentido)`],
            };
        },
    },
    {
        id: 'pesoPlaneta', materia: FIS, tema: 'Peso y gravedad', ecu: 'lineal', sims: ['SISTEMA_SOLAR'],
        gen: () => {
            const [pl, g] = pick([['Marte', 3.7], ['la Luna', 1.6], ['Júpiter', 24.8], ['Venus', 8.9], ['Mercurio', 3.7]]), m = R(20, 120), P = Math.round(m * g * 10) / 10;
            return {
                texto: `Un astronauta pesa ${es(P, 1)} N en ${pl} (g = ${es(g, 1)} m/s²). ¿Cuál es su masa? ¿Cuánto pesaría en la Tierra (g = 9,8 m/s²)? Responde la masa. (P = m·g)`,
                sols: [m], ecuacion: `${g}x = ${P}`, unidad: 'kg', decimales: 1, tol: 0.06,
                pasos: [`${es(g, 1)}·x = ${es(P, 1)}  →  x = ${es(P, 1)} : ${es(g, 1)} = ${m} kg`, `En la Tierra: P = ${m}·9,8 = ${es(m * 9.8, 1)} N (la masa no cambia, el peso sí)`],
            };
        },
    },
    {
        id: 'kepler', materia: FIS, tema: 'Leyes de Kepler', ecu: 'cuadratica', sims: ['SISTEMA_SOLAR', 'ECLIPSE'],
        gen: () => {
            const r = pick([1, 4, 9, 16, 25]), T = r ** 1.5;
            return {
                texto: `Según la 3.ª ley de Kepler, para los planetas del Sistema Solar T² = r³ (T en años y r en unidades astronómicas). Un asteroide orbita a ${r} UA del Sol. ¿Cuánto tarda en dar una vuelta?`,
                sols: [T], ecuacion: `x² = ${r * r * r}`, unidad: 'años',
                pasos: [`x² = ${r}³ = ${r * r * r}`, `x = √${r * r * r} = ${T} años`],
            };
        },
    },
    // ═════════════════════════ x EN EL DENOMINADOR ═════════════════════════
    {
        id: 'gravitacionDistancia', materia: FIS, tema: 'Ley de la gravitación', ecu: 'racional', sims: ['SISTEMA_SOLAR', 'ECLIPSE'],
        gen: () => {
            const d = pick([2, 3, 4, 5, 10]), k = pick([4, 9, 16, 25]), F = pick([100, 200, 400, 800, 3600]);
            return {
                texto: `Dos cuerpos separados ${d} m se atraen con una fuerza de ${F} N. ¿A qué distancia habría que separarlos para que la fuerza fuera ${k} veces menor? (F = G·m·M/d²: la fuerza es inversamente proporcional a d²)`,
                sols: [d * Math.sqrt(k)], ecuacion: `${F * d * d}/x² = ${F / k}`, unidad: 'm', decimales: 2,
                pasos: [`F·d² es constante:  ${F}·${d}² = ${es(F / k)}·x²  →  ${F * d * d}/x² = ${es(F / k)}`, `x² = ${d * d * k}  →  x = ${d * Math.sqrt(k)} m`],
            };
        },
    },
    {
        id: 'resistenciasParalelo', materia: FIS, tema: 'Resistencias en paralelo', ecu: 'racional', sims: ['LEY_OHM'],
        gen: () => {
            const [a, b, c] = pick(ternasArmonicas.filter((t) => t[1] <= 40));
            const [R1, x] = Math.random() < 0.5 ? [a, b] : [b, a];
            return {
                texto: `Al conectar en paralelo una resistencia de ${R1} Ω con otra desconocida, la resistencia equivalente es de ${c} Ω. ¿Cuánto vale la desconocida? (1/R = 1/R₁ + 1/R₂)`,
                sols: [x], ecuacion: `1/${R1} + 1/x = 1/${c}`, unidad: 'Ω',
                pasos: [`1/${R1} + 1/x = 1/${c}  →  1/x = 1/${c} ${MENOS} 1/${R1} = ${R1 - c}/${R1 * c}`, `x = ${R1 * c}/${R1 - c} = ${x} Ω`],
            };
        },
    },
    {
        id: 'lentes', materia: FIS, tema: 'Óptica (lentes)', ecu: 'racional', sims: [],
        gen: () => {
            const [a, b, f] = pick(ternasArmonicas.filter((t) => t[1] <= 60));
            const [d0, x] = Math.random() < 0.5 ? [a, b] : [b, a];
            return {
                texto: `Una lente convergente tiene una distancia focal de ${f} cm. Si el objeto está a ${d0} cm de la lente, ¿a qué distancia se forma la imagen? (1/f = 1/dₒ + 1/dᵢ)`,
                sols: [x], ecuacion: `1/${d0} + 1/x = 1/${f}`, unidad: 'cm',
                pasos: [`1/x = 1/${f} ${MENOS} 1/${d0} = ${d0 - f}/${d0 * f}`, `x = ${d0 * f}/${d0 - f} = ${x} cm`],
            };
        },
    },
    {
        id: 'velocidadMedia', materia: FIS, tema: 'Velocidad media', ecu: 'racional', sims: [],
        gen: () => {
            for (;;) {
                const v1 = pick([20, 30, 40, 45, 60, 72, 80, 90]), v2 = pick([20, 30, 40, 45, 60, 72, 80, 90, 120]);
                if (v1 === v2 || (2 * v1 * v2) % (v1 + v2)) continue;
                const vm = (2 * v1 * v2) / (v1 + v2);
                return {
                    texto: `Vas de casa a la playa a ${v1} km/h y vuelves por el mismo camino. Si la velocidad media de todo el viaje ha sido de ${vm} km/h, ¿a qué velocidad volviste? (¡no es la media de las dos velocidades!)`,
                    sols: [v2], ecuacion: `2/(1/${v1} + 1/x) = ${vm}`, unidad: 'km/h',
                    pasos: [`vₘ = 2d / (d/${v1} + d/x)  →  2/(1/${v1} + 1/x) = ${vm}`, `1/${v1} + 1/x = 2/${vm}  →  1/x = 2/${vm} ${MENOS} 1/${v1}`, `x = ${v2} km/h`],
                };
            }
        },
    },
    {
        id: 'gayLussac', materia: QUI, tema: 'Leyes de los gases (Gay-Lussac)', ecu: 'racional', sims: ['GAY_LUSAC'],
        gen: () => {
            for (;;) {
                const P1 = pick([1, 1.5, 2, 2.5, 3]), T1 = pick([250, 280, 300, 320, 350, 400]), P2 = pick([1, 1.2, 1.5, 2, 2.5, 3, 4]);
                const x = (T1 * P2) / P1;
                if (P1 === P2 || !Number.isInteger(x)) continue;
                return {
                    texto: `Un gas en un recipiente rígido está a ${es(P1)} atm y ${T1} K. ¿A qué temperatura (en K) su presión será de ${es(P2)} atm? (P₁/T₁ = P₂/T₂)`,
                    sols: [x], ecuacion: `${P1}/${T1} = ${P2}/x`, unidad: 'K',
                    pasos: [`${es(P1)}/${T1} = ${es(P2)}/x  →  ${es(P1)}·x = ${es(P2)}·${T1}`, `x = ${es(P2 * T1)} : ${es(P1)} = ${x} K (${x - 273} °C)`],
                };
            }
        },
    },
    {
        id: 'concentracion', materia: QUI, tema: 'Concentración', ecu: 'racional', sims: ['AJUSTES_REACCION', 'ENLACE_MOLECULAS'],
        gen: () => {
            const c = pick([2, 4, 5, 10, 20, 25, 40, 50]), V = pick([0.25, 0.5, 1, 1.5, 2, 2.5, 4]), m = c * V;
            return {
                texto: `Disolvemos ${es(m)} g de sal en agua. ¿Qué volumen de disolución (en L) hay que preparar para que la concentración sea de ${c} g/L? (c = m/V)`,
                sols: [V], ecuacion: `${m}/x = ${c}`, unidad: 'L', decimales: 2,
                pasos: [`${es(m)}/x = ${c}  →  ${c}x = ${es(m)}`, `x = ${es(V)} L`],
            };
        },
    },
    // ═════════════════════════ CON RAÍCES ═════════════════════════
    {
        id: 'velocidadCaida', materia: FIS, tema: 'Caída libre', ecu: 'radical', sims: ['CAIDA_LIBRE', 'CAIDA_ESCALADA'],
        gen: () => {
            const v = pick([10, 20, 30, 40]), h = (v * v) / 20;
            return {
                texto: `Un objeto que cae desde el reposo llega al suelo a ${v} m/s. ¿Desde qué altura cayó? (v = √(2·g·h), g = 10 m/s²)`,
                sols: [h], ecuacion: `√{20x} = ${v}`, unidad: 'm',
                pasos: [`√{20x} = ${v}  →  elevamos al cuadrado: 20x = ${v * v}`, `x = ${h} m`],
            };
        },
    },
    {
        id: 'periodoPendulo', materia: FIS, tema: 'Péndulo simple', ecu: 'radical', sims: ['PENDULO'],
        gen: () => {
            const T = pick([1, 1.5, 2, 2.5, 3]), L = (9.8 * T * T) / (4 * Math.PI * Math.PI);
            return {
                texto: `¿Qué longitud debe tener un péndulo para que su periodo sea de ${es(T)} s? (T = 2π·√(L/g), g = 9,8 m/s²) Da el resultado con 2 decimales.`,
                sols: [L], ecuacion: `2π√{x/9.8} = ${T}`, unidad: 'm', decimales: 2, tol: 0.006,
                pasos: [`√{x/9,8} = ${es(T)}/(2π)`, `x/9,8 = (${es(T)}/(2π))²  →  x = 9,8·${es(T * T)}/(4π²)`, `x ≈ ${es(L)} m`],
            };
        },
    },
    {
        id: 'fuerzaResultante', materia: FIS, tema: 'Composición de fuerzas', ecu: 'radical', sims: ['SISTEMA_SOLAR', 'PLANO_INCLINADO'],
        gen: () => {
            const [p, q, h] = pick(PITAGORICAS), k = pick([1, 2, 5, 10]);
            const [a, x] = Math.random() < 0.5 ? [p * k, q * k] : [q * k, p * k];
            return {
                texto: `Sobre un cuerpo actúan dos fuerzas perpendiculares: una de ${a} N y otra desconocida. La fuerza resultante es de ${h * k} N. ¿Cuánto vale la fuerza desconocida? (R = √(F₁² + F₂²))`,
                sols: [x], ecuacion: `√{${a}² + x²} = ${h * k}`, unidad: 'N',
                pasos: [`√{${a}² + x²} = ${h * k}  →  ${a * a} + x² = ${h * k * h * k}`, `x² = ${x * x}  →  x = ${x} N (la negativa se descarta)`],
            };
        },
    },
    // ═════════════════════════ EXPONENCIALES ═════════════════════════
    {
        id: 'desintegracion', materia: QUI, tema: 'Radiactividad', ecu: 'exponencial', sims: ['ATOMOS'],
        gen: () => {
            const [iso, T, u] = pick([['yodo-131', 8, 'días'], ['cesio-137', 30, 'años'], ['radón-222', 4, 'días'], ['estroncio-90', 29, 'años']]);
            const N0 = pick([800, 640, 960, 1600]), k = R(1, 5), N = N0 / 2 ** k;
            return {
                texto: `El ${iso} tiene un periodo de semidesintegración de ${T} ${u}. ¿Cuánto tiempo (en ${u}) tarda una muestra de ${N0} mg en reducirse a ${es(N)} mg? (N = N₀·(½)^{t/T})`,
                sols: [k * T], ecuacion: `${N0}·(1/2)^{x/${T}} = ${N}`, unidad: u,
                pasos: [`(½)^{x/${T}} = ${es(N)}/${N0} = 1/${2 ** k} = (½)^{${k}}`, `x/${T} = ${k}  →  x = ${k * T} ${u}`],
            };
        },
    },
    {
        id: 'bacterias', materia: BIO, tema: 'Crecimiento de poblaciones', ecu: 'exponencial', sims: [],
        gen: () => {
            const N0 = pick([100, 200, 500, 1000]), tau = pick([15, 20, 30]), k = R(2, 8), N = N0 * 2 ** k;
            return {
                texto: `Una colonia de ${N0} bacterias duplica su número cada ${tau} minutos. ¿Cuánto tiempo tarda en llegar a ${N.toLocaleString('es-ES')} bacterias? (N = N₀·2^{t/τ})`,
                sols: [k * tau], ecuacion: `${N0}·2^{x/${tau}} = ${N}`, unidad: 'min',
                pasos: [`2^{x/${tau}} = ${N}/${N0} = ${2 ** k} = 2^{${k}}`, `x/${tau} = ${k}  →  x = ${k * tau} min`],
            };
        },
    },
    {
        id: 'enfriamiento', materia: FIS, tema: 'Enfriamiento', ecu: 'exponencial', sims: ['GAY_LUSAC'],
        gen: () => {
            const D0 = pick([60, 64, 80]), k = pick([5, 10]), n = R(1, 3), T = 20 + D0 / 2 ** n;
            return {
                texto: `Un café a ${20 + D0} °C se enfría en una habitación a 20 °C. La diferencia de temperatura con la habitación se reduce a la mitad cada ${k} minutos. ¿Cuándo estará a ${es(T)} °C? (T = 20 + ${D0}·2^{−t/${k}})`,
                sols: [n * k], ecuacion: `20 + ${D0}·2^{${MENOS}x/${k}} = ${T}`, unidad: 'min',
                pasos: [`${D0}·2^{${MENOS}x/${k}} = ${es(T - 20)}  →  2^{${MENOS}x/${k}} = 1/${2 ** n} = 2^{${MENOS}${n}}`, `x/${k} = ${n}  →  x = ${n * k} min`],
            };
        },
    },
    {
        id: 'capitalDuplicar', materia: ECO, tema: 'Interés compuesto', ecu: 'exponencial', sims: [],
        gen: () => {
            const r = pick([2, 3, 4, 5, 6, 8, 10]), t = Math.log(2) / Math.log(1 + r / 100);
            return {
                texto: `¿Cuántos años tarda en duplicarse un capital a interés compuesto del ${r} % anual? Da el resultado con 2 decimales. (C = C₀·(1 + r)^{t})`,
                sols: [t], ecuacion: `(1 + ${r / 100})^{x} = 2`, unidad: 'años', decimales: 2, tol: 0.006,
                pasos: [`C₀·${es(1 + r / 100)}^{x} = 2·C₀  →  ${es(1 + r / 100)}^{x} = 2`, `x = log 2 / log ${es(1 + r / 100)}`, `x ≈ ${es(t)} años`],
            };
        },
    },
    // ═════════════════════════ LOGARÍTMICAS ═════════════════════════
    {
        id: 'pH', materia: QUI, tema: 'pH', ecu: 'logaritmica', sims: ['AJUSTES_REACCION', 'ENLACE_MOLECULAS', 'ATOMOS'],
        gen: () => {
            const n = R(1, 13);
            return {
                texto: `Una disolución tiene pH = ${n}. ¿Cuál es su concentración de iones H⁺ en mol/L? (pH = −log[H⁺]; puedes escribirla como 10^-${n})`,
                sols: [10 ** -n], ecuacion: `${MENOS}log x = ${n}`, unidad: 'mol/L', cientifica: true, tolRel: 0.001, sinGrafica: true,
                pasos: [`${MENOS}log x = ${n}  →  log x = ${MENOS}${n}`, `Por definición de logaritmo:  x = 10^{${MENOS}${n}} mol/L`],
            };
        },
    },
    {
        id: 'decibelios', materia: MUS, tema: 'Intensidad del sonido', ecu: 'logaritmica', sims: [],
        gen: () => {
            const L1 = pick([30, 40, 50, 60]), dL = pick([10, 20, 30, 40, 60]), x = 10 ** (dL / 10);
            return {
                texto: `Una conversación produce ${L1} dB y un concierto ${L1 + dL} dB. ¿Cuántas veces más intenso es el sonido del concierto? (L = 10·log(I/I₀): la diferencia de niveles es 10·log(I₂/I₁))`,
                sols: [x], ecuacion: `10·log x = ${dL}`, unidad: 'veces', tolRel: 0.001, sinGrafica: x > 1000,
                pasos: [`10·log x = ${dL}  →  log x = ${dL / 10}`, `x = 10^{${dL / 10}} = ${x.toLocaleString('es-ES')} veces`],
            };
        },
    },
    {
        id: 'richter', materia: GEO, tema: 'Terremotos (escala de Richter)', ecu: 'logaritmica', sims: [],
        gen: () => {
            const M1 = pick([3, 4, 5]), d = R(1, 3), x = 10 ** d;
            return {
                texto: `En la escala de Richter M = log A + cte (A = amplitud de las ondas). ¿Cuántas veces mayor es la amplitud de un terremoto de magnitud ${M1 + d} que la de uno de magnitud ${M1}?`,
                sols: [x], ecuacion: `log x = ${d}`, unidad: 'veces', tolRel: 0.001,
                pasos: [`log A₂ ${MENOS} log A₁ = ${M1 + d} ${MENOS} ${M1}  →  log x = ${d}`, `x = 10^{${d}} = ${x.toLocaleString('es-ES')} veces`],
            };
        },
    },
    // ═════════════════════════ TRIGONOMÉTRICAS ═════════════════════════
    {
        id: 'anguloRampa', materia: FIS, tema: 'Plano inclinado', ecu: 'trigonometrica', sims: ['PLANO_INCLINADO'],
        gen: () => {
            const m = R(2, 20), th = R(10, 60), F = Math.round(10 * m * Math.sin(rad(th)) * 100) / 100, a = grad(Math.asin(F / (10 * m)));
            return {
                texto: `Un bloque de ${m} kg está en una rampa sin rozamiento. La componente del peso paralela a la rampa vale ${es(F)} N. ¿Qué ángulo forma la rampa con el suelo? (F = m·g·sen α, g = 10 m/s²) Da el ángulo con 1 decimal.`,
                sols: [a], ecuacion: `${10 * m} sen x = ${F}`, unidad: '', grados: true, rango: [0, 90], decimales: 1, tol: 0.06,
                pasos: [`${10 * m}·sen x = ${es(F)}  →  sen x = ${es(F / (10 * m), 4)}`, `x = sen⁻¹(${es(F / (10 * m), 4)}) ≈ ${es(a, 1)}°`],
            };
        },
    },
    {
        id: 'alcanceTiro', materia: FIS, tema: 'Tiro parabólico', ecu: 'trigonometrica', sims: ['TIRO_PARABOLICO'],
        gen: () => {
            const v = pick([10, 20, 30, 40]);
            if (Math.random() < 0.5) {
                const Rr = (v * v) / 20;
                return {
                    texto: `Se lanza un balón a ${v} m/s desde el suelo y cae a ${Rr} m. ¿Con qué ángulo se lanzó? (alcance R = v²·sen(2α)/g, g = 10 m/s²) Hay dos ángulos posibles entre 0° y 90°.`,
                    sols: [15, 75], ecuacion: `${(v * v) / 10} sen 2x = ${Rr}`, unidad: '', grados: true, rango: [0, 90],
                    pasos: [`${(v * v) / 10}·sen 2x = ${Rr}  →  sen 2x = 1/2`, '2x = 30° o 2x = 150°  →  x = 15° ; x = 75° (los dos llegan igual de lejos)'],
                };
            }
            const th = pick([20, 25, 35, 40]), Rr = Math.round(((v * v * Math.sin(rad(2 * th))) / 10) * 100) / 100;
            const a = grad(Math.asin((10 * Rr) / (v * v))) / 2;
            return {
                texto: `Se lanza un proyectil a ${v} m/s desde el suelo y cae a ${es(Rr)} m. ¿Con qué ángulos (entre 0° y 90°) se pudo lanzar? (R = v²·sen(2α)/g, g = 10 m/s²) Con 1 decimal.`,
                sols: [a, 90 - a], ecuacion: `${(v * v) / 10} sen 2x = ${Rr}`, unidad: '', grados: true, rango: [0, 90], decimales: 1, tol: 0.06,
                pasos: [`sen 2x = ${es(Rr)} : ${(v * v) / 10} = ${es((10 * Rr) / (v * v), 4)}`, `2x ≈ ${es(2 * a, 1)}° o 2x ≈ ${es(180 - 2 * a, 1)}°`, `x ≈ ${es(a, 1)}° ; x ≈ ${es(90 - a, 1)}° (ángulos complementarios)`],
            };
        },
    },
    {
        id: 'sombra', materia: FIS, tema: 'Astronomía (altura del Sol)', ecu: 'trigonometrica', sims: ['ECLIPSE', 'SISTEMA_SOLAR'],
        gen: () => {
            const h = R(3, 30), s = R(2, 40), a = grad(Math.atan(h / s));
            return {
                texto: `Un árbol de ${h} m proyecta una sombra de ${s} m. ¿Qué ángulo forman los rayos del Sol con el suelo? Da el ángulo con 1 decimal.`,
                sols: [a], ecuacion: `${s} tg x = ${h}`, unidad: '', grados: true, rango: [0, 90], decimales: 1, tol: 0.06,
                pasos: [`tg x = ${h}/${s} = ${es(h / s, 4)}`, `x = tg⁻¹(${es(h / s, 4)}) ≈ ${es(a, 1)}°`],
            };
        },
    },
    {
        id: 'componenteFuerza', materia: FIS, tema: 'Componentes de una fuerza', ecu: 'trigonometrica', sims: ['PLANO_INCLINADO'],
        gen: () => {
            const F = pick([20, 40, 50, 60, 80, 100]);
            if (Math.random() < 0.5) {
                return {
                    texto: `Tiras de un trineo con una cuerda con una fuerza de ${F} N. La componente horizontal de la fuerza es de ${F / 2} N. ¿Qué ángulo forma la cuerda con el suelo? (Fₓ = F·cos α)`,
                    sols: [60], ecuacion: `${F} cos x = ${F / 2}`, unidad: '', grados: true, rango: [0, 90],
                    pasos: [`${F}·cos x = ${F / 2}  →  cos x = 1/2`, 'x = 60°'],
                };
            }
            const th = R(10, 70), Fx = Math.round(F * Math.cos(rad(th)) * 100) / 100, a = grad(Math.acos(Fx / F));
            return {
                texto: `Tiras de un trineo con una cuerda con una fuerza de ${F} N. La componente horizontal es de ${es(Fx)} N. ¿Qué ángulo forma la cuerda con el suelo? (Fₓ = F·cos α) Con 1 decimal.`,
                sols: [a], ecuacion: `${F} cos x = ${Fx}`, unidad: '', grados: true, rango: [0, 90], decimales: 1, tol: 0.06,
                pasos: [`cos x = ${es(Fx)}/${F} = ${es(Fx / F, 4)}`, `x = cos⁻¹(${es(Fx / F, 4)}) ≈ ${es(a, 1)}°`],
            };
        },
    },
    // ═════════════════════════ PROPIOS DE COLISIONES, ECLIPSE Y REACCIONES ═════════════════════════
    {
        id: 'choqueMomento', materia: FIS, tema: 'Cantidad de movimiento', ecu: 'lineal', sims: ['COLISIONES'],
        gen: () => {
            for (;;) {
                const m1 = R(1, 6), v1 = R(2, 10), v1p = R(-4, v1 - 1), m2 = R(1, 10);
                const x = (m1 * (v1 - v1p)) / m2;
                if (!Number.isInteger(x * 2) || x <= 0 || v1p === 0) continue;
                return {
                    texto: `Una bola de ${m1} kg a ${v1} m/s choca contra otra de ${m2} kg que está parada. Después del choque la primera ${v1p > 0 ? `sigue a ${v1p} m/s` : `rebota a ${-v1p} m/s hacia atrás`}. ¿A qué velocidad sale la segunda? (se conserva p = m·v)`,
                    sols: [x], ecuacion: `${m1 * v1} = ${m1 * v1p} + ${m2}x`, unidad: 'm/s', decimales: 2,
                    pasos: [`Antes: ${m1}·${v1} = ${m1 * v1} · después: ${m1}·(${v1p}) + ${m2}·x`, `${m1 * v1} = ${m1 * v1p} + ${m2}x  →  ${m2}x = ${m1 * v1 - m1 * v1p}`, `x = ${es(x)} m/s`],
                };
            }
        },
    },
    {
        id: 'tiempoLuz', materia: FIS, tema: 'La velocidad de la luz', ecu: 'lineal', sims: ['ECLIPSE', 'SISTEMA_SOLAR'],
        gen: () => {
            const [que, d] = pick([['la Luna', 384000], ['el Sol', 150000000], ['Marte (en su máximo acercamiento)', 54600000], ['Júpiter (en su máximo acercamiento)', 588000000]]);
            const x = d / 300000;
            return {
                texto: `La luz viaja a 300 000 km/s. ¿Cuántos segundos tarda en llegarnos la luz de ${que}, que está a ${d.toLocaleString('es-ES')} km? (d = c·t)`,
                sols: [x], ecuacion: `300000x = ${d}`, unidad: 's', decimales: 2, tol: 0.006,
                pasos: [`300 000·x = ${d.toLocaleString('es-ES')}`, `x = ${d.toLocaleString('es-ES')} : 300 000 = ${es(x)} s${x > 120 ? ` (${es(x / 60, 1)} min)` : ''}`],
            };
        },
    },
    {
        id: 'eclipseSemejanza', materia: FIS, tema: 'Eclipses (semejanza)', ecu: 'racional', sims: ['ECLIPSE'],
        gen: () => {
            const dl = pick([360000, 384000, 400000]), k = 400, x = k * dl;
            return {
                texto: `El diámetro del Sol es unas ${k} veces el de la Luna y, en un eclipse total, los dos se ven del mismo tamaño. Si la Luna está a ${dl.toLocaleString('es-ES')} km, ¿a qué distancia está el Sol? (tamaños y distancias proporcionales: ${k}·D/x = D/${dl.toLocaleString('es-ES')})`,
                sols: [x], ecuacion: `${k}/x = 1/${dl}`, unidad: 'km', tolRel: 0.001, sinGrafica: true,
                pasos: [`Se ven iguales si D_Sol/d_Sol = D_Luna/d_Luna  →  ${k}/x = 1/${dl.toLocaleString('es-ES')}`, `x = ${k}·${dl.toLocaleString('es-ES')} = ${x.toLocaleString('es-ES')} km`],
            };
        },
    },
    {
        id: 'estequiometria', materia: QUI, tema: 'Cálculos con reacciones', ecu: 'lineal', sims: ['AJUSTES_REACCION'],
        gen: () => {
            const [reac, a, ma, b, mb] = pick([
                ['2 H₂ + O₂ → 2 H₂O', 'hidrógeno', 4, 'agua', 36],
                ['CH₄ + 2 O₂ → CO₂ + 2 H₂O', 'metano', 16, 'dióxido de carbono', 44],
                ['C + O₂ → CO₂', 'carbono', 12, 'dióxido de carbono', 44],
                ['2 Mg + O₂ → 2 MgO', 'magnesio', 48, 'óxido de magnesio', 80],
                ['CaCO₃ → CaO + CO₂', 'carbonato de calcio', 100, 'óxido de calcio', 56],
            ]);
            const k = pick([0.5, 2, 3, 5, 10, 0.25]), mB = mb * k, x = ma * k;
            return {
                texto: `En la reacción ${reac}, ${ma} g de ${a} producen ${mb} g de ${b}. ¿Cuántos gramos de ${a} hacen falta para obtener ${es(mB)} g de ${b}? (las masas son proporcionales)`,
                sols: [x], ecuacion: `${mb}x = ${ma * mB}`, unidad: 'g', decimales: 2,
                pasos: [`${ma}/${mb} = x/${es(mB)}  →  ${mb}·x = ${ma}·${es(mB)}`, `x = ${es(ma * mB)} : ${mb} = ${es(x)} g`],
            };
        },
    },
];

// ─── API ─────────────────────────────────────────────────────────────────────
// filtro: { sim?: clave del simulador, ecu?: tipo de ecuación, materia? }
// Dentro de un simulador solo hay problemas de Física y Química.
export const plantillasPara = ({ sim, ecu, materia } = {}) => {
    let lista = PLANTILLAS_CIENCIAS;
    if (ecu) lista = lista.filter((p) => p.ecu === ecu);
    if (materia) lista = lista.filter((p) => p.materia === materia);
    if (sim) {
        lista = lista.filter((p) => p.materia === FIS || p.materia === QUI);
        const delSim = lista.filter((p) => p.sims.includes(sim));
        if (delSim.length) lista = delSim;
    }
    return lista.length ? lista : PLANTILLAS_CIENCIAS.filter((p) => !sim || p.materia === FIS || p.materia === QUI);
};
export const tieneProblemasPropios = (sim) => PLANTILLAS_CIENCIAS.some((p) => p.sims.includes(sim));

// En el enunciado (texto plano) los exponentes van como superíndices o entre paréntesis
const SUPS = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '−': '⁻', '-': '⁻', t: 'ᵗ', x: 'ˣ', n: 'ⁿ' };
const textoPlano = (s) => s.replace(/\^\{([^}]*)\}/g, (m, e) => ([...e].every((c) => SUPS[c]) ? [...e].map((c) => SUPS[c]).join('') : `^(${e})`));

export function generarDesdePlantilla(pl) {
    const d = pl.gen();
    const { texto, sols, ...extra } = d;
    return crearProblema('PROBCIEN', `${pl.materia} · ${pl.tema}. ${textoPlano(texto)}`, sols, {
        ...extra, materia: pl.materia, tema: pl.tema, plantilla: pl.id, tipoEcu: TIPOS_ECU[pl.ecu],
        instruccion: d.grados
            ? 'Escribe el ángulo en grados (si hay varios, sepáralos con ;)'
            : d.cientifica ? 'Puedes escribirlo como 0,001 o como 10^-3' : undefined,
    });
}
export function genProblemaCiencias(filtro) {
    return generarDesdePlantilla(pick(plantillasPara(filtro)));
}
