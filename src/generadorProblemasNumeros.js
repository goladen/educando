// ─────────────────────────────────────────────────────────────────────────────
//  PROBLEMAS DE NÚMEROS (Cálculo Mental + fichas imprimibles)
//  Plantillas con números aleatorios que se resuelven con operaciones sencillas.
//  Categorías: naturales · enteros (positivos y negativos) · decimales (precios)
//  Cada problema: { cat, emoji, texto, preguntas: [{ p, tipo: 'num'|'opcion', r, unidad?, opciones? }], explicacion: [] }
//  Los importes se calculan en CÉNTIMOS para que no haya errores de redondeo.
// ─────────────────────────────────────────────────────────────────────────────

export const CATS_PROB_NUM = {
    naturales: { label: '🔢 Naturales', desc: 'Sumar, restar, multiplicar y repartir', color: '#2980b9' },
    enteros:   { label: '🌡️ Enteros (+ y −)', desc: 'Temperaturas, plantas, saldos, altitudes…', color: '#c0392b' },
    decimales: { label: '💶 Decimales y precios', desc: 'Compras, vueltas, ofertas, kilos…', color: '#27ae60' },
};

const R = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const R5 = (a, b) => R(Math.ceil(a / 5), Math.floor(b / 5)) * 5; // múltiplo de 5 (céntimos)

// Formato español: coma decimal y signo «−»
export const fmtNum = (x) => {
    const v = Math.round(x * 100) / 100;
    return (v < 0 ? '−' : '') + String(Math.abs(v)).replace('.', ',');
};
export const fmtEur = (x) => (x < 0 ? '−' : '') + Math.abs(x).toFixed(2).replace('.', ',') + ' €';
const eu = (c) => c / 100; // céntimos → euros
const N = fmtNum, E = (c) => fmtEur(eu(c)); // E recibe céntimos
const par = (x) => (x < 0 ? `(${N(x)})` : N(x)); // negativo entre paréntesis dentro de una operación

export const textoRespuestaNum = (q) => {
    if (q.tipo === 'opcion') return q.r;
    if (q.unidad === '€') return Number.isInteger(q.r) ? `${fmtNum(q.r)} €` : fmtEur(q.r);
    return `${fmtNum(q.r)}${q.unidad ? ` ${q.unidad}` : ''}`;
};

const NOMBRES = ['Ana', 'Luis', 'Marta', 'Pablo', 'Lucía', 'Hugo', 'Sara', 'Leo', 'Irene', 'Mario', 'Noa', 'Daniel', 'Carla', 'Iván'];
const nombre = () => pick(NOMBRES);

// ═════════════════════════════════════════════════════════════════════════════
//  NÚMEROS NATURALES
// ═════════════════════════════════════════════════════════════════════════════
const NATURALES = [
    (nv) => {
        const a = R(15, 35) * nv, b = R(3, 12) * nv, c = R(2, 10) * nv;
        return {
            emoji: '🚌', texto: `Un autobús lleva ${a} pasajeros. En una parada bajan ${b} personas y suben ${c}. ¿Cuántos pasajeros van ahora en el autobús?`,
            preguntas: [
                { p: '¿Cuántos pasajeros quedan después de que bajen?', tipo: 'num', r: a - b, unidad: 'pasajeros' },
                { p: '¿Cuántos pasajeros van ahora en el autobús?', tipo: 'num', r: a - b + c, unidad: 'pasajeros' },
            ],
            explicacion: [`${a} − ${b} = ${a - b} pasajeros`, `${a - b} + ${c} = ${a - b + c} pasajeros`],
        };
    },
    (nv) => {
        const f = R(2, 5), k = R(2, 6), c = R(3, 8) * nv;
        return {
            emoji: '🥚', texto: `En una caja de huevos hay ${f} filas de ${k} huevos. ¿Cuántos huevos hay en ${c} cajas?`,
            preguntas: [
                { p: '¿Cuántos huevos hay en una caja?', tipo: 'num', r: f * k, unidad: 'huevos' },
                { p: `¿Cuántos huevos hay en ${c} cajas?`, tipo: 'num', r: f * k * c, unidad: 'huevos' },
            ],
            explicacion: [`Una caja: ${f} · ${k} = ${f * k} huevos`, `${c} cajas: ${f * k} · ${c} = ${f * k * c} huevos`],
        };
    },
    (nv) => {
        const k = R(3, 9), q = R(4, 12) * nv, r = R(1, k - 1), total = k * q + r;
        return {
            emoji: '🍬', texto: `Tenemos ${total} caramelos y los repartimos a partes iguales entre ${k} niños. ¿Cuántos caramelos recibe cada niño? ¿Cuántos sobran?`,
            preguntas: [
                { p: '¿Cuántos caramelos recibe cada niño?', tipo: 'num', r: q, unidad: 'caramelos' },
                { p: '¿Cuántos caramelos sobran?', tipo: 'num', r, unidad: 'caramelos' },
            ],
            explicacion: [`${total} : ${k} = ${q} y el resto es ${r}`, `Comprobación: ${k} · ${q} + ${r} = ${total}`],
        };
    },
    (nv) => {
        const a = R(3, 12) * nv, s = R(4, 12), extra = R(3, 30) * nv, precio = a * s + extra, n = nombre();
        return {
            emoji: '🐷', texto: `${n} ahorra ${a} € cada semana. Quiere comprarse una bicicleta que cuesta ${precio} €. ¿Cuánto habrá ahorrado en ${s} semanas? ¿Cuánto le faltará todavía?`,
            preguntas: [
                { p: `¿Cuánto habrá ahorrado en ${s} semanas?`, tipo: 'num', r: a * s, unidad: '€' },
                { p: '¿Cuánto le faltará para la bicicleta?', tipo: 'num', r: extra, unidad: '€' },
            ],
            explicacion: [`Ahorro: ${a} · ${s} = ${a * s} €`, `Le falta: ${precio} − ${a * s} = ${extra} €`],
        };
    },
    (nv) => {
        const k = pick([25, 30, 40, 50, 55]);
        let c; do { c = R(40, 130) * nv; } while (c % k === 0);
        const buses = Math.ceil(c / k);
        return {
            emoji: '🚍', texto: `${c} alumnos van de excursión en autobuses de ${k} plazas. ¿Cuántos autobuses necesitan como mínimo? ¿Cuántas plazas quedarán libres?`,
            preguntas: [
                { p: '¿Cuántos autobuses necesitan?', tipo: 'num', r: buses, unidad: 'autobuses' },
                { p: '¿Cuántas plazas quedan libres?', tipo: 'num', r: buses * k - c, unidad: 'plazas' },
            ],
            explicacion: [`${c} : ${k} = ${Math.floor(c / k)} y sobran ${c % k} alumnos → hace falta otro autobús: ${buses}`, `Plazas: ${buses} · ${k} = ${buses * k} → libres ${buses * k} − ${c} = ${buses * k - c}`],
        };
    },
    () => {
        const a = R(8, 14), b = R(24, 36), c = a + R(5, 20), n = nombre();
        return {
            emoji: '🎂', texto: `${n} tiene ${a} años y su madre le lleva ${b} años. ¿Cuántos años tiene su madre? ¿Cuántos años tendrá la madre cuando ${n} tenga ${c}?`,
            preguntas: [
                { p: '¿Cuántos años tiene la madre?', tipo: 'num', r: a + b, unidad: 'años' },
                { p: `¿Cuántos tendrá cuando ${n} tenga ${c}?`, tipo: 'num', r: c + b, unidad: 'años' },
            ],
            explicacion: [`Madre: ${a} + ${b} = ${a + b} años`, `La diferencia de edad no cambia: ${c} + ${b} = ${c + b} años`],
        };
    },
    (nv) => {
        const p = R(4, 9), n = R(3, 8) + (nv > 1 ? R(2, 10) : 0), total = p * n, billete = [20, 50, 100, 200].find(b => b >= total);
        return {
            emoji: '🎬', texto: `Una entrada de cine cuesta ${p} €. Un grupo de ${n} amigos compra una entrada cada uno y paga con un billete de ${billete} €. ¿Cuánto cuestan las entradas? ¿Cuánto les devuelven?`,
            preguntas: [
                { p: '¿Cuánto cuestan todas las entradas?', tipo: 'num', r: total, unidad: '€' },
                { p: '¿Cuánto les devuelven?', tipo: 'num', r: billete - total, unidad: '€' },
            ],
            explicacion: [`${p} · ${n} = ${total} €`, `Vuelta: ${billete} − ${total} = ${billete - total} €`],
        };
    },
    (nv) => {
        const g = R(5, 20) * nv, v = R(3, 12) * nv;
        return {
            emoji: '🐔', texto: `En una granja hay ${g} gallinas y ${v} vacas. ¿Cuántas patas hay en total?`,
            preguntas: [
                { p: '¿Cuántas patas tienen las gallinas?', tipo: 'num', r: g * 2, unidad: 'patas' },
                { p: '¿Cuántas patas tienen las vacas?', tipo: 'num', r: v * 4, unidad: 'patas' },
                { p: '¿Cuántas patas hay en total?', tipo: 'num', r: g * 2 + v * 4, unidad: 'patas' },
            ],
            explicacion: [`Gallinas: ${g} · 2 = ${g * 2}`, `Vacas: ${v} · 4 = ${v * 4}`, `Total: ${g * 2} + ${v * 4} = ${g * 2 + v * 4} patas`],
        };
    },
];

// ═════════════════════════════════════════════════════════════════════════════
//  NÚMEROS ENTEROS (positivos y negativos)
// ═════════════════════════════════════════════════════════════════════════════
const ENTEROS = [
    () => {
        const t1 = -R(2, 10), s = R(6, 15), b = R(5, 18), t2 = t1 + s, t3 = t2 - b;
        return {
            emoji: '🌡️', texto: `A las 7 de la mañana el termómetro marcaba ${N(t1)} °C. Hasta el mediodía la temperatura subió ${s} grados y por la noche bajó ${b} grados respecto al mediodía. ¿Qué temperatura había a mediodía? ¿Y por la noche?`,
            preguntas: [
                { p: '¿Qué temperatura había a mediodía?', tipo: 'num', r: t2, unidad: '°C' },
                { p: '¿Qué temperatura había por la noche?', tipo: 'num', r: t3, unidad: '°C' },
            ],
            explicacion: [`Mediodía: ${N(t1)} + ${s} = ${N(t2)} °C`, `Noche: ${N(t2)} − ${b} = ${N(t3)} °C`],
        };
    },
    () => {
        const max = R(-2, 14), min = -R(3, 15), x = R(2, 6);
        return {
            emoji: '❄️', texto: `En una ciudad de montaña la temperatura máxima de ayer fue ${N(max)} °C y la mínima ${N(min)} °C. ¿Cuántos grados de diferencia hubo entre la máxima y la mínima? Si hoy la mínima es ${x} grados más baja, ¿cuál es la mínima de hoy?`,
            preguntas: [
                { p: '¿Cuántos grados de diferencia hubo?', tipo: 'num', r: max - min, unidad: 'grados' },
                { p: '¿Cuál es la mínima de hoy?', tipo: 'num', r: min - x, unidad: '°C' },
            ],
            explicacion: [`Diferencia: ${N(max)} − ${par(min)} = ${N(max)} + ${N(-min)} = ${N(max - min)} grados`, `Mínima de hoy: ${N(min)} − ${x} = ${N(min - x)} °C`],
        };
    },
    () => {
        const p = R(2, 8), a = R(p + 1, p + 4), b = R(1, 6), f1 = p - a, f2 = f1 + b;
        return {
            emoji: '🛗', texto: `Un ascensor está en la planta ${p}. Baja ${a} plantas y después sube ${b}. (La planta −1 es el primer sótano). ¿En qué planta está después de bajar? ¿Y al final?`,
            preguntas: [
                { p: '¿En qué planta está después de bajar?', tipo: 'num', r: f1, unidad: '' },
                { p: '¿En qué planta está al final?', tipo: 'num', r: f2, unidad: '' },
            ],
            explicacion: [`${p} − ${a} = ${N(f1)}`, `${N(f1)} + ${b} = ${N(f2)}`],
        };
    },
    () => {
        const h = R(8, 35) * 100, d = R(5, 40) * 10, x = R(3, 15) * 10;
        return {
            emoji: '✈️', texto: `Un avión vuela a ${h} m de altitud justo encima de un submarino que está a ${d} m de profundidad (${N(-d)} m). ¿Qué distancia hay entre los dos? Si el submarino baja ${x} m más, ¿a qué altitud estará?`,
            preguntas: [
                { p: '¿Qué distancia hay entre el avión y el submarino?', tipo: 'num', r: h + d, unidad: 'm' },
                { p: '¿A qué altitud estará el submarino?', tipo: 'num', r: -d - x, unidad: 'm' },
            ],
            explicacion: [`${h} − ${par(-d)} = ${h} + ${d} = ${h + d} m`, `${N(-d)} − ${x} = ${N(-d - x)} m`],
        };
    },
    () => {
        const s = R(5, 30) * 10, r = s + R(2, 15) * 10, i = R(10, 40) * 10, n = nombre();
        return {
            emoji: '🏦', texto: `${n} tiene ${s} € en el banco. Le cobran un recibo de ${r} € y después ingresa ${i} €. ¿Cuál es su saldo después del recibo? ¿Y al final?`,
            preguntas: [
                { p: '¿Cuál es el saldo después de pagar el recibo?', tipo: 'num', r: s - r, unidad: '€' },
                { p: '¿Cuál es el saldo al final?', tipo: 'num', r: s - r + i, unidad: '€' },
            ],
            explicacion: [`${s} − ${r} = ${N(s - r)} € (números rojos)`, `${N(s - r)} + ${i} = ${N(s - r + i)} €`],
        };
    },
    () => {
        const m = R(150, 450), n = m + R(40, 85), x = R(5, 20);
        return {
            emoji: '🏛️', texto: `Un filósofo griego nació en el año ${n} a. C. (${N(-n)}) y murió en el año ${m} a. C. (${N(-m)}). ¿Cuántos años vivió? Si hubiera vivido ${x} años más, ¿en qué año habría muerto? (escríbelo como número negativo)`,
            preguntas: [
                { p: '¿Cuántos años vivió?', tipo: 'num', r: n - m, unidad: 'años' },
                { p: `¿En qué año habría muerto viviendo ${x} años más?`, tipo: 'num', r: -m + x, unidad: '' },
            ],
            explicacion: [`${N(-m)} − ${par(-n)} = ${N(-m)} + ${n} = ${n - m} años`, `${N(-m)} + ${x} = ${N(-m + x)} (año ${m - x} a. C.)`],
        };
    },
    () => {
        const p = R(5, 20), x = R(4, 10), y = R(5, 15), n = nombre();
        return {
            emoji: '🎮', texto: `En un videojuego, ${n} empieza con ${p} puntos. Pierde ${x} puntos tres veces seguidas y después gana ${y} puntos. ¿Cuántos puntos tiene después de perder? ¿Y al final?`,
            preguntas: [
                { p: '¿Cuántos puntos tiene después de perder tres veces?', tipo: 'num', r: p - 3 * x, unidad: 'puntos' },
                { p: '¿Cuántos puntos tiene al final?', tipo: 'num', r: p - 3 * x + y, unidad: 'puntos' },
            ],
            explicacion: [`${p} − 3 · ${x} = ${p} − ${3 * x} = ${N(p - 3 * x)}`, `${N(p - 3 * x)} + ${y} = ${N(p - 3 * x + y)} puntos`],
        };
    },
    () => {
        const d = R(8, 30), s = R(3, d - 2), b = R(4, 12);
        return {
            emoji: '🤿', texto: `Una buceadora está a ${d} m de profundidad (${N(-d)} m). Sube ${s} m para observar unos peces y después baja ${b} m hasta el fondo. ¿A qué profundidad está después de subir? ¿Y en el fondo?`,
            preguntas: [
                { p: '¿A qué altitud está después de subir?', tipo: 'num', r: -d + s, unidad: 'm' },
                { p: '¿A qué altitud está el fondo?', tipo: 'num', r: -d + s - b, unidad: 'm' },
            ],
            explicacion: [`${N(-d)} + ${s} = ${N(-d + s)} m`, `${N(-d + s)} − ${b} = ${N(-d + s - b)} m`],
        };
    },
];

// ═════════════════════════════════════════════════════════════════════════════
//  DECIMALES (precios en céntimos para evitar errores de redondeo)
// ═════════════════════════════════════════════════════════════════════════════
const DECIMALES = [
    () => {
        const n = R(2, 6), pc = R5(85, 450), total = n * pc, billete = [500, 1000, 2000, 5000].find(b => b >= total);
        const cosa = pick(['cuadernos', 'bolígrafos de colores', 'botellas de zumo', 'paquetes de galletas', 'rotuladores']);
        return {
            emoji: '🛒', texto: `Compramos ${n} ${cosa} a ${E(pc)} la unidad y pagamos con un billete de ${eu(billete)} €. ¿Cuánto cuesta la compra? ¿Cuánto nos devuelven?`,
            preguntas: [
                { p: '¿Cuánto cuesta la compra?', tipo: 'num', r: eu(total), unidad: '€' },
                { p: '¿Cuánto nos devuelven?', tipo: 'num', r: eu(billete - total), unidad: '€' },
            ],
            explicacion: [`${E(pc)} · ${n} = ${E(total)}`, `Vuelta: ${eu(billete)} − ${N(eu(total))} = ${E(billete - total)}`],
        };
    },
    () => {
        const p1 = R5(120, 690), p2 = R5(85, 450), p3 = R5(200, 990), total = p1 + p2 + p3, billete = total <= 2000 ? 2000 : 5000;
        return {
            emoji: '🧾', texto: `En el supermercado compramos pan por ${E(p1)}, leche por ${E(p2)} y fruta por ${E(p3)}. Pagamos con un billete de ${eu(billete)} €. ¿Cuánto cuesta todo? ¿Cuánto nos devuelven?`,
            preguntas: [
                { p: '¿Cuánto cuesta la compra?', tipo: 'num', r: eu(total), unidad: '€' },
                { p: '¿Cuánto nos devuelven?', tipo: 'num', r: eu(billete - total), unidad: '€' },
            ],
            explicacion: [`${N(eu(p1))} + ${N(eu(p2))} + ${N(eu(p3))} = ${E(total)}`, `${eu(billete)} − ${N(eu(total))} = ${E(billete - total)}`],
        };
    },
    () => {
        const kg = pick([0.5, 1.5, 2, 2.5, 3]), pc = R(60, 195) * 2, coste = Math.round(kg * pc);
        const pc2 = R(50, 160) * 2;
        const [fruta, art] = pick([['manzanas', 'las'], ['naranjas', 'las'], ['plátanos', 'los'], ['peras', 'las'], ['tomates', 'los']]);
        const Art = art[0].toUpperCase() + art.slice(1);
        return {
            emoji: '🍎', texto: `${Art} ${fruta} cuestan ${E(pc)} el kilo. Compramos ${N(kg)} kg. Además compramos 1 kg de patatas a ${E(pc2)} el kilo. ¿Cuánto cuestan ${art} ${fruta}? ¿Cuánto pagamos en total?`,
            preguntas: [
                { p: `¿Cuánto cuestan ${art} ${fruta}?`, tipo: 'num', r: eu(coste), unidad: '€' },
                { p: '¿Cuánto pagamos en total?', tipo: 'num', r: eu(coste + pc2), unidad: '€' },
            ],
            explicacion: [`${N(eu(pc))} · ${N(kg)} = ${E(coste)}`, `${N(eu(coste))} + ${N(eu(pc2))} = ${E(coste + pc2)}`],
        };
    },
    () => {
        const n = R(3, 6), x = R5(650, 2400), total = n * x, propina = R(2, 10) * 100;
        return {
            emoji: '🍕', texto: `${n} amigos cenan juntos y la cuenta es de ${E(total)}. Deciden pagar a partes iguales. ¿Cuánto paga cada uno? Si además dejan ${eu(propina)} € de propina, ¿cuánto pagan en total?`,
            preguntas: [
                { p: '¿Cuánto paga cada uno?', tipo: 'num', r: eu(x), unidad: '€' },
                { p: '¿Cuánto pagan en total con la propina?', tipo: 'num', r: eu(total + propina), unidad: '€' },
            ],
            explicacion: [`${N(eu(total))} : ${n} = ${E(x)}`, `${N(eu(total))} + ${eu(propina)} = ${E(total + propina)}`],
        };
    },
    () => {
        const pc = R5(150, 890);
        const cosa = pick(['botes de champú', 'paquetes de pasta', 'cajas de cereales', 'tarros de miel']);
        return {
            emoji: '🏷️', texto: `En una tienda hay una oferta 3×2 en ${cosa}: te llevas 3 y pagas 2. Cada uno cuesta ${E(pc)}. ¿Cuánto costarían 3 sin oferta? ¿Cuánto pagas con la oferta? ¿Cuánto te ahorras?`,
            preguntas: [
                { p: '¿Cuánto costarían 3 sin la oferta?', tipo: 'num', r: eu(3 * pc), unidad: '€' },
                { p: '¿Cuánto pagas con la oferta?', tipo: 'num', r: eu(2 * pc), unidad: '€' },
                { p: '¿Cuánto te ahorras?', tipo: 'num', r: eu(pc), unidad: '€' },
            ],
            explicacion: [`Sin oferta: 3 · ${N(eu(pc))} = ${E(3 * pc)}`, `Con oferta: 2 · ${N(eu(pc))} = ${E(2 * pc)}`, `Ahorro: ${N(eu(3 * pc))} − ${N(eu(2 * pc))} = ${E(pc)}`],
        };
    },
    () => {
        const pc = R5(1500, 4990), reb = R5(250, Math.min(1500, pc - 500)), fin = pc - reb;
        const cosa = pick(['unas zapatillas', 'una mochila', 'una sudadera', 'unos auriculares']);
        return {
            emoji: '👟', texto: `${cosa[0].toUpperCase() + cosa.slice(1)} cuestan ${E(pc)} y en rebajas las descuentan ${E(reb)}. ¿Cuál es el precio rebajado? ¿Cuánto cuestan dos al precio rebajado?`,
            preguntas: [
                { p: '¿Cuál es el precio rebajado?', tipo: 'num', r: eu(fin), unidad: '€' },
                { p: '¿Cuánto cuestan dos al precio rebajado?', tipo: 'num', r: eu(2 * fin), unidad: '€' },
            ],
            explicacion: [`${N(eu(pc))} − ${N(eu(reb))} = ${E(fin)}`, `2 · ${N(eu(fin))} = ${E(2 * fin)}`],
        };
    },
    () => {
        const na = pick([4, 6, 8]), nb = pick([4, 6, 8].filter(x => x !== na));
        let ua = R(25, 80), ub; do { ub = R(25, 80); } while (ub === ua);
        const pa = na * ua, pb = nb * ub;
        return {
            emoji: '🥛', texto: `El pack A tiene ${na} yogures y cuesta ${E(pa)}. El pack B tiene ${nb} yogures y cuesta ${E(pb)}. ¿Cuánto cuesta un yogur de cada pack? ¿Qué pack sale más barato por yogur?`,
            preguntas: [
                { p: '¿Cuánto cuesta un yogur del pack A?', tipo: 'num', r: eu(ua), unidad: '€' },
                { p: '¿Cuánto cuesta un yogur del pack B?', tipo: 'num', r: eu(ub), unidad: '€' },
                { p: '¿Qué pack sale más barato por yogur?', tipo: 'opcion', r: ua < ub ? 'A' : 'B', opciones: ['A', 'B'] },
            ],
            explicacion: [`A: ${N(eu(pa))} : ${na} = ${E(ua)}`, `B: ${N(eu(pb))} : ${nb} = ${E(ub)}`, `Más barato: pack ${ua < ub ? 'A' : 'B'}`],
        };
    },
    () => {
        const pl = R(135, 179), l = R(20, Math.floor(10000 / pl)), coste = pl * l;
        return {
            emoji: '⛽', texto: `La gasolina cuesta ${N(eu(pl))} € el litro. Echamos ${l} litros y pagamos con un billete de 100 €. ¿Cuánto cuesta la gasolina? ¿Cuánto nos devuelven?`,
            preguntas: [
                { p: '¿Cuánto cuesta la gasolina?', tipo: 'num', r: eu(coste), unidad: '€' },
                { p: '¿Cuánto nos devuelven?', tipo: 'num', r: eu(10000 - coste), unidad: '€' },
            ],
            explicacion: [`${N(eu(pl))} · ${l} = ${E(coste)}`, `100 − ${N(eu(coste))} = ${E(10000 - coste)}`],
        };
    },
    () => {
        const a = R(5, 25) * 5, b = R(4, 30) * 5, c = R(6, 20) * 5, total = a + b + c; // centésimas de kg
        const tope = Math.ceil(total / 100 + 1) * 100;
        return {
            emoji: '⚖️', texto: `En una bolsa metemos ${N(a / 100)} kg de arroz, ${N(b / 100)} kg de harina y ${N(c / 100)} kg de azúcar. ¿Cuánto pesa la bolsa? ¿Cuántos kilos faltan para llegar a ${tope / 100} kg?`,
            preguntas: [
                { p: '¿Cuánto pesa la bolsa?', tipo: 'num', r: total / 100, unidad: 'kg' },
                { p: `¿Cuánto falta para ${tope / 100} kg?`, tipo: 'num', r: (tope - total) / 100, unidad: 'kg' },
            ],
            explicacion: [`${N(a / 100)} + ${N(b / 100)} + ${N(c / 100)} = ${N(total / 100)} kg`, `${tope / 100} − ${N(total / 100)} = ${N((tope - total) / 100)} kg`],
        };
    },
];

const PLANTILLAS = { naturales: NATURALES, enteros: ENTEROS, decimales: DECIMALES };

// Genera un problema de una categoría (nivel 1-3 solo escala los naturales)
export const generarProblemaNumeros = (cat, nivel = 2) => {
    const lista = PLANTILLAS[cat] || NATURALES;
    const nv = nivel === 1 ? 1 : nivel === 2 ? 2 : 5;
    return { cat, ...pick(lista)(nv) };
};

// n problemas distintos (no repite plantilla mientras queden)
export const generarProblemasNumeros = (cats, n, nivel = 2, existentes = []) => {
    const pool = [];
    cats.forEach(c => (PLANTILLAS[c] || []).forEach((fn, i) => pool.push({ c, fn, id: `${c}-${i}` })));
    const usados = new Set(existentes.map(p => p.plantilla));
    const out = [];
    const nv = nivel === 1 ? 1 : nivel === 2 ? 2 : 5;
    for (let i = 0; out.length < n && i < n * 10; i++) {
        let libres = pool.filter(p => !usados.has(p.id));
        if (!libres.length) { usados.clear(); libres = pool; }
        const p = pick(libres);
        usados.add(p.id);
        out.push({ cat: p.c, plantilla: p.id, ...p.fn(nv) });
    }
    return out;
};

// Lee lo que escribe el alumno: «12,5», «−7», «-7», «1.500»
export const leerNumeroEs = (txt) => {
    let t = String(txt || '').trim().replace(/\s/g, '').replace(/[−–]/g, '-').replace(/[€a-zA-Z°²]/g, '');
    if (!t || t === '-') return NaN;
    if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
    return Number(t);
};
