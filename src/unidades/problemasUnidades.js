// ─────────────────────────────────────────────────────────────────────────────
//  PROBLEMAS SENCILLOS con una magnitud en distintas unidades: para poder
//  operar hay que expresarlo todo en la misma unidad.
//  Cada plantilla: { id, mag, nivel (mínimo), gen() → apartado }
//  apartado = { e, s, pasos, r: [{ etiqueta?, tipo, v, unidad, tol, vTxt, distractores }], largo: true }
// ─────────────────────────────────────────────────────────────────────────────
import { fmt, conU, limpio, convertir, fraccionDePi } from './magnitudes.js';
import { R, pick, tolDe } from './generadores.js';

const NOMBRES = ['Lucía', 'Hugo', 'Martina', 'Leo', 'Sofía', 'Mateo', 'Valeria', 'Daniel', 'Alba', 'Pablo', 'Noa', 'Álex', 'Carmen', 'Iker', 'Aitana', 'Omar'];
const nombre = () => pick(NOMBRES);

const num = (v, unidad, extra = {}) => ({ tipo: 'num', v: limpio(v), unidad, tol: tolDe(v), vTxt: fmt(v), ...extra });
// Distractores típicos de un problema: sin convertir, convertir mal (×10, ÷10)…
const dis = (...xs) => xs.filter((x) => Number.isFinite(x) && x >= 0).map((x) => fmt(limpio(x)));

export const PLANTILLAS_UNIDADES = [
    // ── LONGITUD ─────────────────────────────────────────────────────────────
    { id: 'tramos', mag: 'longitud', nivel: 1, gen: () => {
        const n = nombre(), a = R(1, 4), b = R(2, 9), c = R(10, 90) * 5;
        const total = a * 1000 + b * 100 + c;
        return { e: `${n} sale a correr: hace ${a} km por el parque, ${b} hm por el río y ${c} m hasta su casa. ¿Cuántos metros ha recorrido en total?`,
            s: `${fmt(total)} m`, pasos: [`Todo en metros: ${a} km = ${fmt(a * 1000)} m · ${b} hm = ${b * 100} m`, `${fmt(a * 1000)} + ${b * 100} + ${c} = ${fmt(total)} m`],
            r: [num(total, 'm', { distractores: dis(a + b + c, a * 100 + b * 10 + c, a * 1000 + b * 10 + c) })] };
    } },
    { id: 'cuerda', mag: 'longitud', nivel: 1, gen: () => {
        const trozo = pick([20, 25, 40, 50, 75]), n = R(4, 30), largo = (trozo * n) / 100;
        return { e: `Tenemos un rollo de cuerda de ${fmt(largo)} m y lo cortamos en trozos de ${trozo} cm. ¿Cuántos trozos salen?`,
            s: `${n} trozos`, pasos: [`Pasa los metros a centímetros: ${fmt(largo)} m = ${fmt(largo * 100)} cm`, `${fmt(largo * 100)} : ${trozo} = ${n} trozos`],
            r: [num(n, 'trozos', { distractores: dis(limpio(largo * 10 / trozo), n * 10, n + 1) })] };
    } },
    { id: 'falta', mag: 'longitud', nivel: 1, gen: () => {
        const km = pick([5, 10, 21, 42]), m = R(5, km * 10 - 1) * 100 - pick([0, 50]);
        const falta = km * 1000 - m;
        return { e: `Una carrera mide ${km} km. ${nombre()} lleva recorridos ${fmt(m)} m. ¿Cuántos metros le faltan? ¿Y cuántos kilómetros?`,
            s: `${fmt(falta)} m = ${fmt(falta / 1000)} km`, pasos: [`${km} km = ${fmt(km * 1000)} m`, `${fmt(km * 1000)} − ${fmt(m)} = ${fmt(falta)} m`, `${fmt(falta)} m : 1000 = ${fmt(falta / 1000)} km`],
            r: [num(falta, 'm', { etiqueta: 'Metros:', distractores: dis(km * 100 - m, falta / 10, falta * 10) }), num(falta / 1000, 'km', { etiqueta: 'Kilómetros:' })] };
    } },
    { id: 'perimetro', mag: 'longitud', nivel: 1, gen: () => {
        const l = R(2, 9), an = R(20, 95);
        const p = 2 * (l * 100 + an);
        return { e: `Un jardín rectangular mide ${l} m de largo y ${an} cm de ancho. ¿Cuántos centímetros de valla hacen falta para rodearlo? Exprésalo también en metros.`,
            s: `${fmt(p)} cm = ${fmt(p / 100)} m`, pasos: [`Las dos medidas en cm: ${l} m = ${l * 100} cm`, `P = 2 · (${l * 100} + ${an}) = ${fmt(p)} cm`, `${fmt(p)} cm = ${fmt(p / 100)} m`],
            r: [num(p, 'cm', { etiqueta: 'Centímetros:', distractores: dis(2 * (l + an), 2 * (l * 10 + an), l * 100 + an) }), num(p / 100, 'm', { etiqueta: 'Metros:' })] };
    } },
    // ── MASA ─────────────────────────────────────────────────────────────────
    { id: 'receta', mag: 'masa', nivel: 1, gen: () => {
        const kg = pick([0.5, 1, 1.5, 2]), g = R(5, 40) * 10, hg = R(1, 5);
        const total = kg * 1000 + g + hg * 100;
        return { e: `Para un bizcocho gigante se usan ${fmt(kg)} kg de harina, ${g} g de azúcar y ${hg} hg de mantequilla. ¿Cuántos gramos pesan los tres ingredientes juntos?`,
            s: `${fmt(total)} g`, pasos: [`Todo en gramos: ${fmt(kg)} kg = ${fmt(kg * 1000)} g · ${hg} hg = ${hg * 100} g`, `${fmt(kg * 1000)} + ${g} + ${hg * 100} = ${fmt(total)} g`],
            r: [num(total, 'g', { distractores: dis(kg + g + hg, kg * 1000 + g + hg * 10, kg * 100 + g + hg * 100) })] };
    } },
    { id: 'paquetes', mag: 'masa', nivel: 1, gen: () => {
        const p = pick([125, 200, 250, 500]), n = R(4, 40) * (p === 125 ? 8 : p === 250 ? 4 : p === 500 ? 2 : 5) / (p === 200 ? 1 : 1);
        const kg = limpio((p * n) / 1000);
        return { e: `Un saco tiene ${fmt(kg)} kg de arroz. Lo repartimos en paquetes de ${p} g. ¿Cuántos paquetes llenamos?`,
            s: `${n} paquetes`, pasos: [`${fmt(kg)} kg = ${fmt(kg * 1000)} g`, `${fmt(kg * 1000)} : ${p} = ${n} paquetes`],
            r: [num(n, 'paquetes', { distractores: dis(limpio(kg * 100 / p), n * 10, n / 10) })] };
    } },
    { id: 'camion', mag: 'masa', nivel: 2, gen: () => {
        const t = R(3, 12), cajas = R(10, 60), kg = R(2, 9) * 10;
        const queda = t * 1000 - cajas * kg;
        if (queda <= 0) return null;
        return { e: `Un camión puede cargar ${t} t. Ya lleva ${cajas} cajas de ${kg} kg cada una. ¿Cuántos kilogramos más puede cargar?`,
            s: `${fmt(queda)} kg`, pasos: [`${t} t = ${fmt(t * 1000)} kg`, `Carga: ${cajas} · ${kg} = ${fmt(cajas * kg)} kg`, `${fmt(t * 1000)} − ${fmt(cajas * kg)} = ${fmt(queda)} kg`],
            r: [num(queda, 'kg', { distractores: dis(t * 100 - cajas * kg, t - cajas * kg / 1000, queda / 10) })] };
    } },
    // ── CAPACIDAD ────────────────────────────────────────────────────────────
    { id: 'vasos', mag: 'capacidad', nivel: 1, gen: () => {
        const v = pick([20, 25, 30, 50]), n = R(3, 12) * (v === 30 ? 5 : 2), l = limpio((v * n) / 100);
        return { e: `Con una garrafa de ${fmt(l)} l de zumo llenamos vasos de ${v} cl. ¿Cuántos vasos se llenan?`,
            s: `${n} vasos`, pasos: [`${fmt(l)} l = ${fmt(l * 100)} cl`, `${fmt(l * 100)} : ${v} = ${n} vasos`],
            r: [num(n, 'vasos', { distractores: dis(limpio(l * 10 / v), n * 10, n / 2) })] };
    } },
    { id: 'deposito', mag: 'capacidad', nivel: 1, gen: () => {
        const hl = R(2, 9), dal = R(1, 9), l = R(1, 30);
        const queda = hl * 100 - dal * 10 - l;
        return { e: `Un depósito tiene ${hl} hl de agua. Se sacan ${dal} dal para regar y ${l} l para limpiar. ¿Cuántos litros quedan?`,
            s: `${fmt(queda)} l`, pasos: [`Todo en litros: ${hl} hl = ${hl * 100} l · ${dal} dal = ${dal * 10} l`, `${hl * 100} − ${dal * 10} − ${l} = ${fmt(queda)} l`],
            r: [num(queda, 'l', { distractores: dis(hl - dal - l, hl * 100 - dal - l, hl * 10 - dal * 10 - l) })] };
    } },
    { id: 'jarabe', mag: 'capacidad', nivel: 2, gen: () => {
        const dosis = pick([5, 10, 15]), n = R(8, 40), dl = limpio((dosis * n) / 100);
        return { e: `Un frasco de jarabe contiene ${fmt(dl)} dl. Cada toma es de ${dosis} ml. ¿Cuántas tomas hay en el frasco?`,
            s: `${n} tomas`, pasos: [`${fmt(dl)} dl = ${fmt(dl * 100)} ml`, `${fmt(dl * 100)} : ${dosis} = ${n} tomas`],
            r: [num(n, 'tomas', { distractores: dis(limpio(dl * 10 / dosis), n * 10, n / 10) })] };
    } },
    // ── TIEMPO ───────────────────────────────────────────────────────────────
    { id: 'pelicula', mag: 'tiempo', nivel: 1, gen: () => {
        const h = R(1, 2), m = R(5, 55), visto = R(20, 60 * h + m - 5);
        const falta = h * 60 + m - visto;
        return { e: `Una película dura ${h} h ${m} min. Ya hemos visto ${visto} minutos. ¿Cuántos minutos faltan para que acabe?`,
            s: `${falta} min`, pasos: [`${h} h ${m} min = ${h} · 60 + ${m} = ${h * 60 + m} min`, `${h * 60 + m} − ${visto} = ${falta} min`],
            r: [num(falta, 'min', { distractores: dis(h * 100 + m - visto, h + m - visto > 0 ? h + m - visto : NaN, falta + 40) })] };
    } },
    { id: 'tiempos', mag: 'tiempo', nivel: 2, gen: () => {
        const min = R(2, 9), s1 = R(30, 200), s2 = R(1, 4) * 15;
        const total = min * 60 + s1 + s2;
        return { e: `En una prueba de relevos, ${nombre()} tarda ${min} min, su compañera ${s1} s y el último ${s2} s. ¿Cuántos segundos tarda el equipo? Exprésalo en minutos y segundos.`,
            s: `${total} s = ${Math.floor(total / 60)} min ${total % 60} s`, pasos: [`${min} min = ${min * 60} s`, `${min * 60} + ${s1} + ${s2} = ${total} s`, `${total} : 60 = ${Math.floor(total / 60)} min y sobran ${total % 60} s`],
            r: [num(total, 's', { etiqueta: 'Segundos:', distractores: dis(min * 100 + s1 + s2, min + s1 + s2, total + 60) }), num(Math.floor(total / 60), 'min', { etiqueta: 'Minutos:' }), num(total % 60, 's', { etiqueta: 'y segundos:' })] };
    } },
    // ── SUPERFICIE ───────────────────────────────────────────────────────────
    { id: 'finca', mag: 'superficie', nivel: 2, gen: () => {
        const ha = R(2, 9), a = R(10, 90), m2 = R(100, 900);
        const queda = ha * 10000 - a * 100 - m2;
        return { e: `Una finca mide ${ha} ha. Se venden ${a} a para un huerto y ${m2} m² para una nave. ¿Cuántos m² quedan?`,
            s: `${fmt(queda)} m²`, pasos: [`Todo en m²: ${ha} ha = ${fmt(ha * 10000)} m² · ${a} a = ${fmt(a * 100)} m²`, `${fmt(ha * 10000)} − ${fmt(a * 100)} − ${m2} = ${fmt(queda)} m²`],
            r: [num(queda, 'm²', { distractores: dis(ha * 100 - a - m2, ha * 1000 - a * 10 - m2, queda / 10) })] };
    } },
    { id: 'baldosas', mag: 'superficie', nivel: 2, gen: () => {
        const lado = pick([20, 25, 40, 50]), l = R(3, 8), an = R(2, 6);
        const n = (l * 100 / lado) * (an * 100 / lado);
        return { e: `Queremos cubrir el suelo de una habitación de ${l} m × ${an} m con baldosas cuadradas de ${lado} cm de lado. ¿Cuántas baldosas necesitamos?`,
            s: `${fmt(n)} baldosas`, pasos: [`Área del suelo: ${l} · ${an} = ${l * an} m² = ${fmt(l * an * 10000)} cm²`, `Área de una baldosa: ${lado} · ${lado} = ${lado * lado} cm²`, `${fmt(l * an * 10000)} : ${lado * lado} = ${fmt(n)} baldosas`],
            r: [num(n, 'baldosas', { distractores: dis(n / 100, n / 10, (l * an * 100) / (lado * lado)) })] };
    } },
    // ── VOLUMEN Y CAPACIDAD ──────────────────────────────────────────────────
    { id: 'piscina', mag: 'volcap', nivel: 2, gen: () => {
        const m3 = R(20, 90), cubo = pick([10, 20, 25, 50]);
        const l = m3 * 1000, n = l / cubo;
        return { e: `Una piscina tiene ${m3} m³ de agua. ¿Cuántos litros son? Si la vaciáramos con cubos de ${cubo} l, ¿cuántos cubos harían falta?`,
            s: `${fmt(l)} l · ${fmt(n)} cubos`, pasos: [`1 m³ = 1 000 dm³ = 1 000 l → ${m3} m³ = ${fmt(l)} l`, `${fmt(l)} : ${cubo} = ${fmt(n)} cubos`],
            r: [num(l, 'l', { etiqueta: 'Litros:', distractores: dis(m3 * 100, m3 * 10, m3 * 1e6) }), num(n, 'cubos', { etiqueta: 'Cubos:' })] };
    } },
    { id: 'acuario', mag: 'volcap', nivel: 2, gen: () => {
        const a = R(4, 12), b = R(3, 6), c = R(2, 5) * 10;
        const l = limpio((a * b * c) / 10);
        return { e: `Un acuario mide ${a} dm de largo, ${b} dm de ancho y ${c} cm de alto. ¿Cuántos litros de agua caben?`,
            s: `${fmt(l)} l`, pasos: [`Todo en dm: ${c} cm = ${fmt(c / 10)} dm`, `V = ${a} · ${b} · ${fmt(c / 10)} = ${fmt(l)} dm³`, `1 dm³ = 1 l → ${fmt(l)} l`],
            r: [num(l, 'l', { distractores: dis(a * b * c, l / 10, l * 100) })] };
    } },
    // ── VELOCIDAD ────────────────────────────────────────────────────────────
    { id: 'quienCorre', mag: 'velocidad', nivel: 2, gen: () => {
        const kmh = 18 * R(2, 7), ms = R(5, 40);
        const ms1 = kmh / 3.6;
        const masR = ms1 > ms ? 'el coche' : ms1 < ms ? 'la moto' : 'van igual';
        return { e: `Un coche va a ${kmh} km/h y una moto a ${ms} m/s. Expresa la velocidad del coche en m/s. ¿Cuál va más rápido?`,
            s: `${fmt(ms1)} m/s → ${masR}`, pasos: [`${kmh} km/h · (1000 m / 1 km) · (1 h / 3600 s) = ${fmt(ms1)} m/s`, `Compara ${fmt(ms1)} m/s con ${ms} m/s`],
            r: [num(ms1, 'm/s', { etiqueta: 'Coche (m/s):', distractores: dis(kmh * 3.6, kmh / 36, kmh / 60) }), { etiqueta: 'Más rápido:', tipo: 'opcion', v: masR, opciones: ['el coche', 'la moto', 'van igual'] }] };
    } },
    { id: 'tren', mag: 'velocidad', nivel: 2, gen: () => {
        const v = pick([60, 90, 120, 150, 180, 240, 300]), min = pick([10, 15, 20, 30, 40, 45, 90]);
        const d = limpio((v * min) / 60);
        return { e: `Un tren circula a ${v} km/h durante ${min} minutos. ¿Cuántos kilómetros recorre?`,
            s: `${fmt(d)} km`, pasos: [`El tiempo en horas: ${min} min = ${fmt(limpio(min / 60))} h`, `d = v · t = ${v} · ${fmt(limpio(min / 60))} = ${fmt(d)} km`],
            r: [num(d, 'km', { distractores: dis(v * min, v / min, d * 10) })] };
    } },
    { id: 'atleta', mag: 'velocidad', nivel: 2, gen: () => {
        const m = pick([100, 200, 400]), s = pick([10, 20, 25, 40, 50, 80]);
        const ms = m / s, kmh = limpio(ms * 3.6);
        return { e: `Un atleta recorre ${m} m en ${s} s. ¿Cuál es su velocidad en m/s? ¿Y en km/h?`,
            s: `${fmt(ms)} m/s = ${fmt(kmh)} km/h`, pasos: [`v = ${m} m : ${s} s = ${fmt(ms)} m/s`, `${fmt(ms)} m/s · 3,6 = ${fmt(kmh)} km/h`],
            r: [num(ms, 'm/s', { etiqueta: 'm/s:', distractores: dis(s / m, ms * 3.6, ms / 3.6) }), num(kmh, 'km/h', { etiqueta: 'km/h:' })] };
    } },
    // ── DENSIDAD ─────────────────────────────────────────────────────────────
    { id: 'aceite', mag: 'densidad', nivel: 2, gen: () => {
        const d = pick([0.92, 0.8, 1.03, 13.6, 0.7]), l = R(2, 9);
        const kg = limpio(d * l);
        const sus = { 0.92: 'aceite', 0.8: 'alcohol', 1.03: 'agua de mar', 13.6: 'mercurio', 0.7: 'gasolina' }[d];
        return { e: `La densidad del ${sus} es ${fmt(d)} g/cm³. ¿Cuántos kilogramos pesan ${l} litros?`,
            s: `${fmt(kg)} kg`, pasos: [`${fmt(d)} g/cm³ = ${fmt(d)} kg/l (1 g/cm³ = 1 kg/l)`, `m = d · V = ${fmt(d)} · ${l} = ${fmt(kg)} kg`],
            r: [num(kg, 'kg', { distractores: dis(kg * 1000, kg / 1000, d * l * 10) })] };
    } },
    { id: 'bloque', mag: 'densidad', nivel: 3, gen: () => {
        const v = pick([50, 100, 200, 250, 400, 500]), d = pick([2.7, 7.8, 8.9, 11.3, 0.9, 19.3]);
        const g = limpio(d * v), kgm3 = d * 1000;
        return { e: `Un bloque de metal tiene una masa de ${fmt(g)} g y ocupa ${v} cm³. Calcula su densidad en g/cm³ y en kg/m³.`,
            s: `${fmt(d)} g/cm³ = ${fmt(kgm3)} kg/m³`, pasos: [`d = m / V = ${fmt(g)} g : ${v} cm³ = ${fmt(d)} g/cm³`, `${fmt(d)} g/cm³ · (1 kg / 1000 g) · (1 000 000 cm³ / 1 m³) = ${fmt(kgm3)} kg/m³`],
            r: [num(d, 'g/cm³', { etiqueta: 'g/cm³:', distractores: dis(v / g, d * 10, d / 10) }), num(kgm3, 'kg/m³', { etiqueta: 'kg/m³:' })] };
    } },
    // ── TEMPERATURA ──────────────────────────────────────────────────────────
    { id: 'termometros', mag: 'temperatura', nivel: 2, gen: () => {
        const c1 = R(-5, 15), c2 = c1 + 5 * R(1, 4);
        const f2 = limpio(c2 * 1.8 + 32);
        return { e: `Por la mañana el termómetro marcaba ${c1} °C. A mediodía, un termómetro americano marca ${fmt(f2)} °F. ¿Cuántos grados Celsius ha subido la temperatura?`,
            s: `${c2 - c1} °C`, pasos: [`${fmt(f2)} °F → °C = (${fmt(f2)} − 32) : 1,8 = ${c2} °C`, `${c2} − (${c1}) = ${c2 - c1} °C`],
            r: [num(c2 - c1, '°C', { distractores: dis(f2 - c1, c2, (f2 - c1) / 1.8) })] };
    } },
    { id: 'kelvin', mag: 'temperatura', nivel: 2, gen: () => {
        const k = R(260, 300), c = R(5, 40);
        const sube = c + 273 - k;
        if (sube <= 0) return null;
        return { e: `Un gas está a ${k} K y lo calentamos hasta ${c} °C. ¿Cuántos kelvin ha aumentado su temperatura?`,
            s: `${sube} K`, pasos: [`${c} °C = ${c} + 273 = ${c + 273} K`, `${c + 273} − ${k} = ${sube} K`],
            r: [num(sube, 'K', { distractores: dis(c - k + 1000, k - c, sube + 273) })] };
    } },
    // ── ÁNGULOS ──────────────────────────────────────────────────────────────
    { id: 'sumaAngulos', mag: 'angulo', nivel: 2, gen: () => {
        const g1 = pick([30, 45, 60, 90, 120]), g2 = pick([15, 20, 30, 40, 45, 50]);
        const fr = fraccionDePi(g1);
        return { e: `Un ángulo mide ${fr.texto} rad y otro ${g2}°. ¿Cuánto suman en grados? ¿Cuánto le falta a la suma para llegar a 180°?`,
            s: `${g1 + g2}° · faltan ${180 - g1 - g2}°`, pasos: [`${fr.texto} rad = ${g1}° (π rad = 180°)`, `${g1} + ${g2} = ${g1 + g2}°`, `180 − ${g1 + g2} = ${180 - g1 - g2}°`],
            r: [num(g1 + g2, '°', { etiqueta: 'Suma:', distractores: dis(g1 / 180 + g2, g1 + g2 + 10, 2 * g1 + g2) }), num(180 - g1 - g2, '°', { etiqueta: 'Faltan:' })] };
    } },
    { id: 'sexagesimal', mag: 'angulo', nivel: 2, gen: () => {
        const a1 = R(20, 60), m1 = R(10, 55), a2 = R(10, 40), m2 = R(10, 55);
        const tm = m1 + m2, g = a1 + a2 + Math.floor(tm / 60), m = tm % 60;
        return { e: `Suma los ángulos ${a1}° ${m1}' y ${a2}° ${m2}'. Recuerda que 60' = 1°.`,
            s: `${g}° ${m}'`, pasos: [`${a1}° + ${a2}° = ${a1 + a2}° · ${m1}' + ${m2}' = ${tm}'`, tm >= 60 ? `${tm}' = 1° ${m}' → ${g}° ${m}'` : `${g}° ${m}'`],
            r: [num(g, '°', { etiqueta: 'Grados:' }), num(m, "'", { etiqueta: 'Minutos:' })] };
    } },
];

export const MAG_PROBLEMAS = [...new Set(PLANTILLAS_UNIDADES.map((p) => p.mag))];

/** Un problema de esas magnitudes y como mucho ese nivel. */
export function generarProblemaUnidades({ mags = null, nivel = 3 } = {}) {
    const lista = PLANTILLAS_UNIDADES.filter((p) => (!mags || mags.includes(p.mag)) && p.nivel <= nivel);
    const pool = lista.length ? lista : PLANTILLAS_UNIDADES.filter((p) => p.nivel <= nivel);
    for (let i = 0; i < 30; i++) {
        const p = pick(pool);
        const ap = p.gen();
        if (ap && ap.r.every((q) => q.tipo !== 'num' || (Number.isFinite(q.v) && q.v >= 0))) return { ...ap, largo: true, probId: p.id, mag: p.mag };
    }
    return null;
}

export { conU, convertir };
