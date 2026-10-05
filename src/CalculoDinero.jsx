import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { guardarRegistroLocal } from './utils/registrosLocales';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';
import { RotateCcw, CheckCircle, Trophy, Clock, Delete, Settings, SkipForward, Share2, Coins } from 'lucide-react';
import Confetti from 'react-confetti';
import { leerRetoUrl, limpiarRetoUrl } from './utils/retoLink';
import PantallaReto, { textoBotonEnvio } from './components/retos/PantallaReto';
import ModalEnviarCompeticion from './components/ModalEnviarCompeticion';
import sndAcierto from './assets/correct.mp3';
import sndFallo from './assets/sonidomonedamal.mp3';
import { leerNumeroEs } from './generadorProblemasNumeros';

// Fichas imprimibles (editor + PDF + pizarra + enlace público): se cargan solo al abrirlas
const FichasDinero = React.lazy(() => import('./FichasDinero'));

// Reproduce un sonido corto sin bloquear (cada toque crea su propia instancia)
const playSound = (src) => { try { const a = new Audio(src); a.volume = 0.6; a.play().catch(() => {}); } catch { /* noop */ } };

// ─── Imágenes de billetes y monedas (src/assets/Euros/) ───────────────────────
// Monedas en .png y billetes en .jpg, de 1 céntimo a 100 €. Si faltara alguna,
// se dibuja un respaldo con el valor para que la herramienta funcione igual.
const dineroImgs = import.meta.glob('./assets/Euros/*.{png,jpg,jpeg,webp,avif,svg}', { eager: true, import: 'default' });
const getDineroImg = (file) => dineroImgs[`./assets/Euros/${file}`] || null;

// Valores en CÉNTIMOS para evitar errores con decimales.
const DENOMINACIONES = [
    { val: 10000, label: '100 €',    tipo: 'billete', file: '100eu.jpg',   bg: '#27ae60' },
    { val: 5000,  label: '50 €',     tipo: 'billete', file: '50eu.jpg',    bg: '#e67e22' },
    { val: 2000,  label: '20 €',     tipo: 'billete', file: '20eu.jpg',    bg: '#3498db' },
    { val: 1000,  label: '10 €',     tipo: 'billete', file: '10eu.jpg',    bg: '#e74c3c' },
    { val: 500,   label: '5 €',      tipo: 'billete', file: '5eu.jpg',     bg: '#7f8c8d' },
    { val: 200,   label: '2 €',      tipo: 'moneda',  file: '2eu.png',     bg: '#bdc3c7' },
    { val: 100,   label: '1 €',      tipo: 'moneda',  file: '1eu.png',     bg: '#f1c40f' },
    { val: 50,    label: '50 cént',  tipo: 'moneda',  file: '50_cent.png', bg: '#f39c12' },
    { val: 20,    label: '20 cént',  tipo: 'moneda',  file: '20cent.png',  bg: '#f39c12' },
    { val: 10,    label: '10 cént',  tipo: 'moneda',  file: '10cent.png',  bg: '#f39c12' },
    { val: 5,     label: '5 cént',   tipo: 'moneda',  file: '5cent.png',   bg: '#d35400' },
    { val: 2,     label: '2 cént',   tipo: 'moneda',  file: '2cent.png',   bg: '#d35400' },
    { val: 1,     label: '1 cént',   tipo: 'moneda',  file: '1cent.png',   bg: '#d35400' },
];

// ─── Contexto: productos (con su tipo de IVA y precio unidad orientativo) ──────
// iva: 4 (básicos/libros) · 10 (otros alimentos) · 21 (general)
const ITEMS = [
    { sing: 'barra de pan',   plural: 'barras de pan',   emoji: '🥖', iva: 4,  pmin: 0.6,  pmax: 1.4 },
    { sing: 'litro de leche', plural: 'litros de leche', emoji: '🥛', iva: 4,  pmin: 0.8,  pmax: 1.6 },
    { sing: 'huevo',          plural: 'huevos',          emoji: '🥚', iva: 4,  pmin: 0.2,  pmax: 0.4 },
    { sing: 'manzana',        plural: 'manzanas',        emoji: '🍎', iva: 4,  pmin: 0.3,  pmax: 0.8 },
    { sing: 'plátano',        plural: 'plátanos',        emoji: '🍌', iva: 4,  pmin: 0.2,  pmax: 0.6 },
    { sing: 'naranja',        plural: 'naranjas',        emoji: '🍊', iva: 4,  pmin: 0.3,  pmax: 0.7 },
    { sing: 'yogur',          plural: 'yogures',         emoji: '🍦', iva: 4,  pmin: 0.4,  pmax: 0.9 },
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

// ─── Lista de precios del supermercado (precio en CÉNTIMOS) ────────────────────
// Se usa en el modo "Lista de la compra". Precios cerrados y realistas.
const PRODUCTOS = [
    { nombre: 'Pan',       emoji: '🥖', precio: 90 },
    { nombre: 'Leche',     emoji: '🥛', precio: 120 },
    { nombre: 'Huevos',    emoji: '🥚', precio: 250 },
    { nombre: 'Yogures',   emoji: '🍦', precio: 175 },
    { nombre: 'Queso',     emoji: '🧀', precio: 320 },
    { nombre: 'Manzanas',  emoji: '🍎', precio: 180 },
    { nombre: 'Plátanos',  emoji: '🍌', precio: 150 },
    { nombre: 'Naranjas',  emoji: '🍊', precio: 140 },
    { nombre: 'Tomates',   emoji: '🍅', precio: 160 },
    { nombre: 'Lechuga',   emoji: '🥬', precio: 80 },
    { nombre: 'Arroz',     emoji: '🍚', precio: 110 },
    { nombre: 'Pasta',     emoji: '🍝', precio: 95 },
    { nombre: 'Aceite',    emoji: '🫒', precio: 450 },
    { nombre: 'Zumo',      emoji: '🧃', precio: 130 },
    { nombre: 'Pizza',     emoji: '🍕', precio: 350 },
    { nombre: 'Galletas',  emoji: '🍪', precio: 145 },
    { nombre: 'Chocolate', emoji: '🍫', precio: 160 },
    { nombre: 'Agua',      emoji: '💧', precio: 190 },
    { nombre: 'Pollo',     emoji: '🍗', precio: 390 },
    { nombre: 'Pescado',   emoji: '🐟', precio: 480 },
];

// ─── Configuración por defecto ────────────────────────────────────────────────
export const DEFAULT_CONFIG = {
    maxPrecio: 50,          // euros
    conCentimos: true,
    tiempo: 180,
    numEjercicios: null,    // null = por tiempo
    tipos: {
        pagar: true, devolver: true, multiplicar: true, unidad: false, iva: false, rebaja: false, compra: false,
        // Porcentajes
        pctCantidad: false, aumento: false, sucesivos: false, equivalente: false, porcentajeAplicado: false, original: false,
    },
    escribir: false,        // true = se responde escribiendo el resultado en vez de con billetes y monedas
};

const MODOS_PRESET = [
    {
        id: 'EASY', icon: '👛', label: 'Monedas y billetes', desc: 'Paga la cantidad justa y calcula la vuelta', color: '#2ecc71',
        tags: ['Pagar', 'Vuelta'],
        cfg: { maxPrecio: 20, conCentimos: false, tiempo: 180, numEjercicios: null,
               tipos: { pagar: true, devolver: true, multiplicar: false, unidad: false, iva: false, rebaja: false } }
    },
    {
        id: 'MEDIUM', icon: '🛒', label: 'La compra', desc: 'Con céntimos · precios por unidad y proporciones', color: '#f39c12',
        tags: ['Pagar', 'Vuelta', '× unidad', '÷ unidad'],
        cfg: { maxPrecio: 50, conCentimos: true, tiempo: 180, numEjercicios: null,
               tipos: { pagar: true, devolver: true, multiplicar: true, unidad: true, iva: false, rebaja: false } }
    },
    {
        id: 'HARD', icon: '📈', label: 'IVA y rebajas', desc: 'Porcentajes de aumento (IVA) y descuentos', color: '#e74c3c',
        tags: ['IVA', 'Rebajas', 'Todo'],
        cfg: { maxPrecio: 100, conCentimos: true, tiempo: 180, numEjercicios: null,
               tipos: { pagar: true, devolver: true, multiplicar: true, unidad: true, iva: true, rebaja: true } }
    },
    {
        id: 'PCT', icon: '📊', label: 'Porcentajes', desc: 'Aumentos, descuentos, IVA y porcentajes sucesivos · se responde escribiendo', color: '#c0392b',
        tags: ['% de', 'Aumentos', 'Rebajas', 'IVA', 'Sucesivos', 'Precio original'],
        cfg: { maxPrecio: 100, conCentimos: true, tiempo: 300, numEjercicios: null, escribir: true,
               tipos: { pagar: false, devolver: false, multiplicar: false, unidad: false, iva: true, rebaja: true, compra: false,
                        pctCantidad: true, aumento: true, sucesivos: true, equivalente: true, porcentajeAplicado: true, original: true } }
    },
    {
        id: 'COMPRA', icon: '🛒', label: 'Lista de la compra', desc: 'Elige productos para que te sobre la cantidad justa', color: '#16a085',
        tags: ['Presupuesto', 'Lista de precios'],
        cfg: { maxPrecio: 50, conCentimos: true, tiempo: 240, numEjercicios: null,
               tipos: { pagar: false, devolver: false, multiplicar: false, unidad: false, iva: false, rebaja: false, compra: true } }
    },
    { id: 'CUSTOM', icon: '⚙️', label: 'Configurado', desc: 'Elige qué practicar, precios y tiempo', color: '#9b59b6', cfg: null },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const rInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const rItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Formatea céntimos → "12,50 €"
const fmt = (cents) => {
    const neg = cents < 0;
    const a = Math.abs(Math.round(cents));
    const e = Math.floor(a / 100);
    const c = a % 100;
    return `${neg ? '−' : ''}${e},${String(c).padStart(2, '0')} €`;
};

// Precio aleatorio en céntimos dentro de [minE, maxE] euros
const randCents = (cfg, minE, maxE) => {
    const lo = Math.max(1, Math.round(minE * 100));
    const hi = Math.max(lo, Math.round(maxE * 100));
    let c = rInt(lo, hi);
    if (!cfg.conCentimos) c = Math.max(100, Math.round(c / 100) * 100); // a euros enteros
    return c;
};

// ─── Motor de PORCENTAJES (aumentos, descuentos, IVA y porcentajes sucesivos) ──
// Todo en céntimos. `cadena` aplica variaciones sucesivas (+p % / −p %) y solo
// acepta bases con las que cada paso da céntimos exactos, para que el resultado
// se pueda pagar con monedas y no haya redondeos.
const PCT_ITEMS = [
    ['una chaqueta', '🧥'], ['un par de zapatillas', '👟'], ['una bicicleta', '🚲'], ['un móvil', '📱'],
    ['una tablet', '💻'], ['un abrigo', '🧥'], ['una consola', '🎮'], ['un par de auriculares', '🎧'],
    ['un patinete', '🛴'], ['una mochila', '🎒'], ['un reloj', '⌚'], ['una gorra', '🧢'],
];
const fmtDec = (x) => String(Math.round(x * 10000) / 10000).replace('.', ',');
const fmtPct = (x) => `${fmtDec(x)} %`;
const indice = (p) => fmtDec((100 + p) / 100); // índice de variación: −20 % → 0,8 · +21 % → 1,21
const cadena = (base, pcts) => {
    const out = [base];
    let c = base;
    for (const p of pcts) { const x = c * (100 + p); if (x % 100) return null; c = x / 100; out.push(c); }
    return out;
};
const baseExacta = (cfg, pcts) => {
    const lo = Math.max(10, Math.round(cfg.maxPrecio * 0.2)), hi = Math.max(30, cfg.maxPrecio);
    for (let i = 0; i < 400; i++) {
        const b = cfg.conCentimos && Math.random() < 0.4 ? rInt(lo * 20, hi * 20) * 5 : rInt(lo, hi) * 100;
        const c = cadena(b, pcts);
        if (c && c.every(v => v > 0)) return c;
    }
    // Sin base exacta en el rango: se redondea al céntimo en cada paso
    const out = [rInt(lo, hi) * 100];
    pcts.forEach(p => out.push(Math.round(out[out.length - 1] * (100 + p) / 100)));
    return out;
};
const conItem = () => { const [nombre, emoji] = rItem(PCT_ITEMS); return { nombre, Nombre: cap(nombre), emoji }; };
const resPct = (tipo, emoji, enunciado, num, pasos) => ({
    tipo, emoji, modo: 'NUMERO', unidad: '%', answerNum: num, answerCents: null,
    displayAnswer: fmtPct(num), enunciado, pasos, pista: pasos.join(' → '),
});
const resEur = (tipo, emoji, enunciado, cents, pasos) => ({
    tipo, emoji, answerCents: cents, displayAnswer: fmt(cents), enunciado, pasos, pista: pasos.join(' → '),
});

const PCT_GEN = {
    // El p % de una cantidad
    pctCantidad: (cfg) => {
        const p = rItem([5, 10, 15, 20, 25, 30, 40, 50, 75]);
        const [b, r] = baseExacta(cfg, [p - 100]);
        const it = conItem();
        const enun = rItem([
            `¿Cuánto es el ${p} % de ${fmt(b)}?`,
            `${it.Nombre} cuesta ${fmt(b)}. Para reservar, pagas ahora el ${p} % del precio. ¿Cuánto pagas?`,
        ]);
        return resEur('pctCantidad', '💯', enun, r, [`${p} % de ${fmt(b)} = ${fmt(b)} · ${p} : 100 = ${fmt(r)}`, `(o ${fmt(b)} · ${fmtDec(p / 100)} = ${fmt(r)})`]);
    },
    // Aumento porcentual
    aumento: (cfg) => {
        const p = rItem([5, 10, 12, 15, 20, 25, 30]);
        const [b, r] = baseExacta(cfg, [p]);
        const it = conItem();
        const enun = rItem([
            `${it.Nombre} costaba ${fmt(b)} y su precio ha subido un ${p} %. ¿Cuánto cuesta ahora?`,
            `Una factura de ${fmt(b)} tiene un recargo del ${p} % por pagarla tarde. ¿Cuánto hay que pagar?`,
        ]);
        return resEur('aumento', '📈', enun, r, [`Aumento: ${p} % de ${fmt(b)} = ${fmt(r - b)}`, `${fmt(b)} + ${fmt(r - b)} = ${fmt(r)}`, `Con el índice: ${fmt(b)} · ${indice(p)} = ${fmt(r)}`]);
    },
    // Porcentajes sucesivos: el resultado final
    sucesivos: (cfg) => {
        const it = conItem();
        const variante = rItem(['dobleDescuento', 'descuentoIva', 'subeBaja', 'triple']);
        if (variante === 'dobleDescuento') {
            const p1 = rItem([10, 20, 25, 30, 40, 50]), p2 = rItem([5, 10, 15, 20]);
            const [b, c1, c2] = baseExacta(cfg, [-p1, -p2]);
            const eq = 100 - (100 - p1) * (100 - p2) / 100;
            return resEur('sucesivos', '🏷️', `${it.Nombre} cuesta ${fmt(b)}. En rebajas tiene un ${p1} % de descuento y en caja te hacen otro ${p2} % sobre el precio ya rebajado. ¿Cuánto pagas?`, c2, [
                `1.er descuento: ${fmt(b)} − ${p1} % = ${fmt(c1)}`,
                `2.º descuento: ${fmt(c1)} − ${p2} % = ${fmt(c2)}`,
                `Con índices: ${fmt(b)} · ${indice(-p1)} · ${indice(-p2)} = ${fmt(c2)}`,
                `¡Ojo! No es un ${p1 + p2} % de descuento, sino un ${fmtPct(eq)}`,
            ]);
        }
        if (variante === 'descuentoIva') {
            const p1 = rItem([10, 15, 20, 25, 30]);
            const [b, c1, c2] = baseExacta(cfg, [-p1, 21]);
            return resEur('sucesivos', '🧾', `${it.Nombre} cuesta ${fmt(b)} sin IVA. Tiene un descuento del ${p1} % y después se le aplica el IVA del 21 %. ¿Cuál es el precio final?`, c2, [
                `Descuento: ${fmt(b)} − ${p1} % = ${fmt(c1)}`,
                `IVA: ${fmt(c1)} + 21 % = ${fmt(c2)}`,
                `Con índices: ${fmt(b)} · ${indice(-p1)} · 1,21 = ${fmt(c2)}`,
            ]);
        }
        if (variante === 'subeBaja') {
            const p = rItem([10, 20, 25, 50]);
            const [b, c1, c2] = baseExacta(cfg, [p, -p]);
            return resEur('sucesivos', '🎢', `El precio de ${it.nombre} era ${fmt(b)}. Primero sube un ${p} % y después baja un ${p} %. ¿Cuál es el precio final?`, c2, [
                `Sube: ${fmt(b)} + ${p} % = ${fmt(c1)}`,
                `Baja: ${fmt(c1)} − ${p} % = ${fmt(c2)}`,
                `Con índices: ${fmt(b)} · ${indice(p)} · ${indice(-p)} = ${fmt(c2)}`,
                `No vuelve al precio inicial: ha bajado un ${fmtPct(p * p / 100)} en total`,
            ]);
        }
        const p1 = rItem([5, 10, 20]), p2 = rItem([5, 10, 20, 25]), p3 = rItem([5, 10, 20]);
        const [b, c1, c2, c3] = baseExacta(cfg, [p1, -p2, p3]);
        return resEur('sucesivos', '📅', `${it.Nombre} costaba ${fmt(b)}. En enero su precio sube un ${p1} %, en febrero baja un ${p2} % y en marzo sube un ${p3} %. ¿Cuánto cuesta en marzo?`, c3, [
            `Enero: ${fmt(b)} + ${p1} % = ${fmt(c1)}`,
            `Febrero: ${fmt(c1)} − ${p2} % = ${fmt(c2)}`,
            `Marzo: ${fmt(c2)} + ${p3} % = ${fmt(c3)}`,
            `Con índices: ${fmt(b)} · ${indice(p1)} · ${indice(-p2)} · ${indice(p3)} = ${fmt(c3)}`,
        ]);
    },
    // Porcentaje único equivalente a dos variaciones sucesivas
    equivalente: () => {
        const variante = rItem(['descuentos', 'subeBaja', 'subidas']);
        if (variante === 'descuentos') {
            const p1 = rItem([10, 20, 25, 30, 40, 50]), p2 = rItem([10, 20, 25, 50]);
            const eq = 100 - (100 - p1) * (100 - p2) / 100;
            return resPct('equivalente', '🏷️', `Una tienda aplica un descuento del ${p1} % y después otro del ${p2} % sobre el precio rebajado. ¿A qué descuento único equivalen los dos?`, eq, [
                `Índices: ${indice(-p1)} · ${indice(-p2)} = ${fmtDec((100 - eq) / 100)}`,
                `Pagas el ${fmtPct(100 - eq)} del precio → descuento del ${fmtPct(eq)}`,
                `(no es ${p1} + ${p2} = ${p1 + p2} %)`,
            ]);
        }
        if (variante === 'subeBaja') {
            const p = rItem([10, 15, 20, 25, 30, 50]);
            return resPct('equivalente', '🎢', `Un precio sube un ${p} % y después baja un ${p} %. ¿Qué porcentaje ha bajado en total respecto al precio inicial?`, p * p / 100, [
                `Índices: ${indice(p)} · ${indice(-p)} = ${fmtDec((100 + p) * (100 - p) / 10000)}`,
                `Queda el ${fmtPct((100 + p) * (100 - p) / 100)} del precio → ha bajado un ${fmtPct(p * p / 100)}`,
            ]);
        }
        const p1 = rItem([10, 20, 25, 50]), p2 = rItem([10, 20, 30, 50]);
        const eq = (100 + p1) * (100 + p2) / 100 - 100;
        return resPct('equivalente', '📈', `El alquiler de un piso sube un ${p1} % un año y un ${p2} % al año siguiente. ¿Qué porcentaje ha subido en total?`, eq, [
            `Índices: ${indice(p1)} · ${indice(p2)} = ${fmtDec((100 + eq) / 100)}`,
            `Ha subido un ${fmtPct(eq)} (no ${p1 + p2} %)`,
        ]);
    },
    // ¿Qué porcentaje se ha aplicado?
    porcentajeAplicado: (cfg) => {
        const it = conItem();
        const sube = Math.random() < 0.4;
        const p = sube ? rItem([5, 10, 15, 20, 25, 50]) : rItem([10, 15, 20, 25, 30, 40, 50, 60]);
        const [b, f] = baseExacta(cfg, [sube ? p : -p]);
        const dif = Math.abs(f - b);
        return resPct('porcentajeAplicado', sube ? '📈' : '🏷️', sube
            ? `${it.Nombre} costaba ${fmt(b)} y ahora cuesta ${fmt(f)}. ¿Qué porcentaje ha subido?`
            : `${it.Nombre} costaba ${fmt(b)} y en rebajas cuesta ${fmt(f)}. ¿Qué porcentaje de descuento te hacen?`, p, [
            `${sube ? 'Subida' : 'Descuento'}: ${fmt(Math.max(b, f))} − ${fmt(Math.min(b, f))} = ${fmt(dif)}`,
            `${fmt(dif)} : ${fmt(b)} = ${fmtDec(p / 100)} → ${p} %`,
        ]);
    },
    // Precio original a partir del final
    original: (cfg) => {
        const it = conItem();
        if (Math.random() < 0.5) {
            const p = rItem([10, 20, 25, 30, 40, 50]);
            const [b, f] = baseExacta(cfg, [-p]);
            return resEur('original', '🔙', `Después de un descuento del ${p} %, ${it.nombre} cuesta ${fmt(f)}. ¿Cuánto costaba antes del descuento?`, b, [
                `Pagas el ${100 - p} % del precio → índice ${indice(-p)}`,
                `Precio original: ${fmt(f)} : ${indice(-p)} = ${fmt(b)}`,
            ]);
        }
        const [b, f] = baseExacta(cfg, [21]);
        return resEur('original', '🧾', `${it.Nombre} cuesta ${fmt(f)} con el IVA del 21 % incluido. ¿Cuál es su precio sin IVA?`, b, [
            `Con IVA se paga el 121 % → índice 1,21`,
            `Sin IVA: ${fmt(f)} : 1,21 = ${fmt(b)}`,
        ]);
    },
};

// ─── Motor generador ──────────────────────────────────────────────────────────
// `escrito`: se responde escribiendo (porcentajes, o si el profesor lo elige)
export const generarProblema = (cfg) => {
    const p = generarProblemaBase(cfg);
    return { ...p, escrito: p.modo === 'NUMERO' || (!!cfg.escribir && p.modo !== 'PRODUCTOS') };
};

// Comprueba una respuesta escrita: «12,50», «28», «28 %»…
export const comprobarEscrito = (problem, texto) => {
    const v = leerNumeroEs(String(texto || '').replace('%', ''));
    if (Number.isNaN(v)) return false;
    if (problem.unidad === '%') return Math.abs(v - problem.answerNum) < 0.01;
    return Math.round(v * 100) === problem.answerCents;
};

const generarProblemaBase = (cfg) => {
    const activos = Object.entries(cfg.tipos).filter(([, v]) => v).map(([k]) => k);
    if (activos.length === 0)
        return { tipo: 'pagar', enunciado: '¡Selecciona al menos un tipo de ejercicio!', emoji: '⚠️', answerCents: 0, displayAnswer: '0 €', pista: '' };

    const tipo = rItem(activos);
    if (PCT_GEN[tipo]) return PCT_GEN[tipo](cfg);

    if (tipo === 'pagar') {
        const item = rItem(ITEMS);
        const cents = randCents(cfg, 1, cfg.maxPrecio);
        return {
            tipo, emoji: item.emoji, answerCents: cents,
            displayAnswer: fmt(cents),
            enunciado: `Compras ${item.plural} por ${fmt(cents)}. Selecciona el dinero justo para pagar.`,
            pista: `Tienes que reunir exactamente ${fmt(cents)}.`,
        };
    }

    if (tipo === 'devolver') {
        const item = rItem(ITEMS);
        const cents = randCents(cfg, 1, Math.min(cfg.maxPrecio, 50));
        const PAGOS = [500, 1000, 2000, 5000, 10000, 20000];
        const pago = PAGOS.find(p => p > cents) || Math.ceil(cents / 100) * 100;
        const vuelta = pago - cents;
        return {
            tipo, emoji: item.emoji, answerCents: vuelta,
            displayAnswer: fmt(vuelta),
            enunciado: `Compras ${item.plural} por ${fmt(cents)} y pagas con ${fmt(pago)}. ¿Cuánto te tienen que devolver?`,
            pista: `${fmt(pago)} − ${fmt(cents)} = ${fmt(vuelta)}`,
        };
    }

    if (tipo === 'multiplicar') {
        const item = rItem(ITEMS.filter(i => i.pmax * 12 <= cfg.maxPrecio + 10)) || rItem(ITEMS);
        const unidad = randCents(cfg, item.pmin, item.pmax);
        const n = rInt(2, 12);
        const total = unidad * n;
        return {
            tipo, emoji: item.emoji, answerCents: total,
            displayAnswer: fmt(total),
            enunciado: `Un ${item.sing} cuesta ${fmt(unidad)}. ¿Cuánto cuestan ${n} ${item.plural}?`,
            pista: `${fmt(unidad)} × ${n} = ${fmt(total)}`,
        };
    }

    if (tipo === 'unidad') {
        const item = rItem(ITEMS);
        const n = rItem([2, 3, 4, 5, 6, 10, 12]);
        const unidad = randCents(cfg, item.pmin, item.pmax);
        const total = unidad * n;
        return {
            tipo, emoji: item.emoji, answerCents: unidad,
            displayAnswer: fmt(unidad),
            enunciado: `${n} ${item.plural} cuestan ${fmt(total)}. ¿Cuánto cuesta un ${item.sing}?`,
            pista: `${fmt(total)} ÷ ${n} = ${fmt(unidad)}`,
        };
    }

    if (tipo === 'iva') {
        const item = rItem(ITEMS);
        // base en euros enteros para que el porcentaje salga limpio
        const baseE = rInt(2, Math.max(2, Math.min(200, Math.round(cfg.maxPrecio))));
        const base = baseE * 100;
        const pct = item.iva;
        const total = Math.round(base * (1 + pct / 100));
        return {
            tipo, emoji: item.emoji, answerCents: total,
            displayAnswer: fmt(total),
            enunciado: `${cap(item.plural)} por valor de ${fmt(base)} (sin IVA). Con el IVA del ${pct}%, ¿cuánto pagas en total?`,
            pista: `${fmt(base)} + ${pct}% de ${fmt(base)} (${fmt(total - base)}) = ${fmt(total)}`,
        };
    }

    if (tipo === 'compra') {
        // Construimos una cesta-solución real para garantizar que tiene solución.
        const n = rInt(2, 4);
        let objetivo = 0;
        for (let i = 0; i < n; i++) objetivo += rItem(PRODUCTOS).precio;
        // Cuánto debe sobrar
        const sobraOpts = cfg.conCentimos ? [0, 50, 100, 150, 200, 250, 500] : [0, 100, 200, 300, 500];
        const sobra = rItem(sobraOpts);
        const dinero = objetivo + sobra;
        return {
            tipo: 'compra', modo: 'PRODUCTOS', emoji: '🛒', answerCents: objetivo,
            displayAnswer: fmt(objetivo), dinero, sobra,
            enunciado: sobra === 0
                ? `Tienes ${fmt(dinero)}. Elige productos de la lista para gastarlo todo (que no te sobre nada).`
                : `Tienes ${fmt(dinero)}. Elige productos de la lista para que te sobren exactamente ${fmt(sobra)}.`,
            pista: `Debes gastar ${fmt(dinero)} − ${fmt(sobra)} = ${fmt(objetivo)} en productos.`,
        };
    }

    // rebaja
    const item = rItem(ITEMS);
    const baseE = rInt(4, Math.max(4, Math.min(200, Math.round(cfg.maxPrecio))));
    const base = baseE * 100;
    const pct = rItem([10, 20, 25, 30, 40, 50]);
    const final = Math.round(base * (1 - pct / 100));
    return {
        tipo: 'rebaja', emoji: item.emoji, answerCents: final,
        displayAnswer: fmt(final),
        enunciado: `${cap(item.plural)} que costaban ${fmt(base)} tienen un ${pct}% de descuento. ¿Cuál es el precio final?`,
        pista: `${fmt(base)} − ${pct}% de ${fmt(base)} (${fmt(base - final)}) = ${fmt(final)}`,
    };
};

// ─── Pieza de dinero (imagen o respaldo dibujado) ──────────────────────────────
const PiezaDinero = ({ d, size, onClick, badge }) => {
    const img = getDineroImg(d.file);
    const w = d.tipo === 'billete' ? size * 1.7 : size;
    const h = size;
    return (
        <button onClick={onClick} title={d.label}
            style={{ position: 'relative', border: 'none', background: 'transparent', cursor: onClick ? 'pointer' : 'default', padding: 0, lineHeight: 0 }}>
            {img ? (
                <img src={img} alt={d.label} style={{ width: w, height: h, objectFit: 'contain', borderRadius: d.tipo === 'billete' ? 6 : '50%', boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }} />
            ) : (
                <span style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                    width: w, height: h, borderRadius: d.tipo === 'billete' ? 6 : '50%',
                    background: d.bg, color: '#fff', fontWeight: 800, fontSize: d.tipo === 'billete' ? '0.8rem' : '0.7rem',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.25)', border: '2px solid rgba(255,255,255,0.6)', padding: 2, boxSizing: 'border-box',
                }}>{d.label}</span>
            )}
            {badge != null && badge > 0 && (
                <span style={{ position: 'absolute', top: -8, right: -8, background: '#e91e63', color: '#fff', borderRadius: '50%', minWidth: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, padding: '0 4px', boxShadow: '0 2px 5px rgba(0,0,0,0.3)' }}>×{badge}</span>
            )}
        </button>
    );
};

// ─── Modal de configuración ────────────────────────────────────────────────────
// ─── Retos por enlace (utils/retoLink.js) ─────────────────────────────────────
export const RUTA_DINERO = '/dinero';
export const TIPOS_DINERO = [
    ['pagar', '👛 Pagar exacto', '#2ecc71'],
    ['devolver', '💸 La vuelta', '#3498db'],
    ['multiplicar', '✖️ Precio total', '#f39c12'],
    ['unidad', '➗ Precio por uno', '#16a085'],
    ['compra', '🛒 Lista de la compra', '#16a085'],
    // Porcentajes
    ['pctCantidad', '💯 % de una cantidad', '#c0392b', 'pct'],
    ['iva', '🧾 IVA', '#e74c3c', 'pct'],
    ['rebaja', '🏷️ Rebajas', '#9b59b6', 'pct'],
    ['aumento', '📈 Aumentos', '#d35400', 'pct'],
    ['sucesivos', '🎢 % sucesivos', '#8e44ad', 'pct'],
    ['equivalente', '🟰 % único equivalente', '#6c3483', 'pct'],
    ['porcentajeAplicado', '❓ ¿Qué % se aplicó?', '#b03a2e', 'pct'],
    ['original', '🔙 Precio original', '#1f618d', 'pct'],
];
export const resumenDinero = (c) => {
    const cfg = { ...DEFAULT_CONFIG, ...(c || {}) };
    return [
        ...TIPOS_DINERO.filter(([k]) => cfg.tipos?.[k]).map(([, l]) => l),
        `💶 hasta ${cfg.maxPrecio} €`,
        cfg.conCentimos ? '🪙 Con céntimos' : '🪙 Sin céntimos',
        ...(cfg.escribir ? ['✍️ Respuesta escrita'] : []),
        cfg.numEjercicios ? `🔢 ${cfg.numEjercicios} ejercicios` : `⏱ ${cfg.tiempo < 60 ? `${cfg.tiempo} s` : `${cfg.tiempo / 60} min`}`,
    ];
};

export const ConfigModal = ({ config, onStart, onClose, titulo = '⚙️ Configurar cálculo con dinero', textoAceptar = '▶ Empezar' }) => {
    const [local, setLocal] = useState({ ...DEFAULT_CONFIG, ...config });
    const [modoConteo, setModoConteo] = useState(config.numEjercicios ? 'ejercicios' : 'tiempo');

    const setField = (k, v) => setLocal(p => ({ ...p, [k]: v }));
    const toggleTipo = (k) => {
        const next = { ...local.tipos, [k]: !local.tipos[k] };
        if (!Object.values(next).some(Boolean)) return;
        setLocal(p => ({ ...p, tipos: next }));
    };

    const Chip = ({ active, onClick, children, color = '#27ae60' }) => (
        <button onClick={onClick} style={{
            padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontWeight: 'bold', fontSize: '0.9rem', transition: 'all 0.15s',
            background: active ? color : '#f0f0f0', color: active ? 'white' : '#555',
            boxShadow: active ? `0 3px 8px ${color}55` : 'none',
        }}>{children}</button>
    );
    const Section = ({ label, children }) => (
        <div style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 700, color: '#555', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>{label}</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>{children}</div>
        </div>
    );

    const handleStart = () => {
        onStart({ ...local, numEjercicios: modoConteo === 'ejercicios' ? (local.numEjercicios || 10) : null });
    };


    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: 'white', borderRadius: 22, padding: '28px 24px', maxWidth: 480, width: '100%', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 25px 70px rgba(0,0,0,0.3)' }}>
                <h2 style={{ textAlign: 'center', color: '#2c3e50', fontSize: '1.3rem', marginTop: 0, marginBottom: 22 }}>{titulo}</h2>

                <Section label="🧮 Qué practicar">
                    {TIPOS_DINERO.filter(t => !t[3]).map(([k, lab, col]) => (
                        <Chip key={k} active={!!local.tipos[k]} onClick={() => toggleTipo(k)} color={col}>{lab}</Chip>
                    ))}
                </Section>

                <Section label="📊 Porcentajes">
                    {TIPOS_DINERO.filter(t => t[3] === 'pct').map(([k, lab, col]) => (
                        <Chip key={k} active={!!local.tipos[k]} onClick={() => toggleTipo(k)} color={col}>{lab}</Chip>
                    ))}
                </Section>

                <Section label="✍️ Cómo se responde">
                    <Chip active={!local.escribir} onClick={() => setField('escribir', false)} color="#16a085">💶 Con billetes y monedas</Chip>
                    <Chip active={!!local.escribir} onClick={() => setField('escribir', true)} color="#c0392b">✍️ Escribiendo el resultado</Chip>
                    <div style={{ width: '100%', fontSize: '0.75rem', color: '#999' }}>Las preguntas cuya respuesta es un % siempre se responden escribiendo.</div>
                </Section>

                <Section label="🪙 Céntimos">
                    <Chip active={!local.conCentimos} onClick={() => setField('conCentimos', false)} color="#2ecc71">€ enteros</Chip>
                    <Chip active={local.conCentimos} onClick={() => setField('conCentimos', true)} color="#f39c12">Con céntimos</Chip>
                </Section>

                <Section label="💶 Precio máximo">
                    {[10, 20, 50, 100, 200].map(p => (
                        <Chip key={p} active={local.maxPrecio === p} onClick={() => setField('maxPrecio', p)} color="#16a085">{p} €</Chip>
                    ))}
                </Section>

                <Section label="⏱ Modo de juego">
                    <Chip active={modoConteo === 'tiempo'} onClick={() => setModoConteo('tiempo')} color="#e91e63">⏱ Por tiempo</Chip>
                    <Chip active={modoConteo === 'ejercicios'} onClick={() => setModoConteo('ejercicios')} color="#009688">🔢 Por ejercicios</Chip>
                </Section>

                {modoConteo === 'tiempo' ? (
                    <Section label="⏱ Tiempo">
                        {[60, 120, 180, 300].map(t => (
                            <Chip key={t} active={local.tiempo === t} onClick={() => setField('tiempo', t)} color="#e91e63">{t < 60 ? `${t}s` : `${t / 60} min`}</Chip>
                        ))}
                    </Section>
                ) : (
                    <Section label="🔢 Nº de ejercicios">
                        {[5, 10, 15, 20].map(n => (
                            <Chip key={n} active={(local.numEjercicios || 10) === n} onClick={() => setField('numEjercicios', n)} color="#009688">{n}</Chip>
                        ))}
                    </Section>
                )}

                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 20 }}>
                    <button onClick={onClose} style={{ padding: '12px 24px', background: '#f0f0f0', color: '#555', border: 'none', borderRadius: 30, fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
                    <button onClick={handleStart} style={{ padding: '12px 28px', background: '#9b59b6', color: 'white', border: 'none', borderRadius: 30, fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px #9b59b655' }}>{textoAceptar}</button>
                </div>
            </div>
        </div>
    );
};

// ─── Modal enviar al profesor ──────────────────────────────────────────────────
function ModalEnviarProfe({ datos, onClose }) {
    const [codigo, setCodigo] = useState('');
    const [nombre, setNombre] = useState('');
    const [curso, setCurso] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [enviado, setEnviado] = useState(false);
    const [error, setError] = useState('');

    const enviar = async () => {
        const code = codigo.trim().toUpperCase();
        if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
        if (!code) { setError('Escribe el código del profesor.'); return; }
        setEnviando(true); setError('');
        try {
            const codigoDoc = await getDoc(doc(db, 'codigos_profesor', code));
            if (!codigoDoc.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
            const intentos = datos.aciertos + datos.fallos;
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'DINERO', modalidad: 'Individual', fecha: new Date(),
                codigoProfesor: code,
                jugadores: [{
                    nombre: nombre.trim(), curso: curso.trim(),
                    aciertos: datos.aciertos, fallos: datos.fallos, intentos,
                    puntos: datos.puntos, skips: datos.skips,
                    porcentaje: Math.round((datos.aciertos / Math.max(1, intentos)) * 100),
                    config: { tipos: datos.config.tipos, maxPrecio: datos.config.maxPrecio, conCentimos: datos.config.conCentimos, tiempo: datos.config.tiempo, numEjercicios: datos.config.numEjercicios },
                    ...(datos.reto ? { reto: datos.reto } : {}),
                }],
            });
            guardarRegistroLocal('DINERO', { titulo: 'Cálculo con Dinero', aciertos: datos.aciertos, intentos, nombre: nombre.trim(), curso: curso.trim(), via: 'profesor' });
            setEnviado(true);
        } catch (e) { setError('Error: ' + e.message); }
        setEnviando(false);
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ background: '#1e272e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, width: '100%', maxWidth: 380, padding: '26px 28px', boxShadow: '0 30px 80px rgba(0,0,0,0.7)', color: 'white', fontFamily: "'Segoe UI', sans-serif" }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f1c40f' }}>📤 Enviar al profesor</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.2rem' }}>✕</button>
                </div>
                {enviado ? (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{ fontSize: '3rem', marginBottom: 10 }}>✅</div>
                        <div style={{ color: '#2ecc71', fontWeight: 700, fontSize: '1.1rem' }}>¡Informe enviado!</div>
                        <div style={{ marginTop: 8, color: '#aaa', fontSize: '0.9rem' }}>✅ {datos.aciertos} aciertos · ❌ {datos.fallos} fallos · {datos.puntos} pts</div>
                        <button onClick={onClose} style={{ marginTop: 16, padding: '9px 22px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', color: 'white' }}>Cerrar</button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {[['nombre', 'Nombre y apellido', nombre, setNombre, 'Tu nombre completo', false],
                          ['curso', 'Curso', curso, setCurso, 'Ej: 5º Primaria', false],
                          ['codigo', 'Código del profesor', codigo, v => setCodigo(v.toUpperCase()), 'Ej: PROF01', true]
                        ].map(([key, label, val, setter, ph, mono]) => (
                            <div key={key}>
                                <label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 }}>{label}</label>
                                <input value={val} onChange={e => setter(e.target.value)} placeholder={ph} maxLength={key === 'codigo' ? 10 : undefined}
                                    style={{ padding: '9px 12px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box', letterSpacing: mono ? 2 : 0, fontWeight: mono ? 700 : 400 }} />
                            </div>
                        ))}
                        {error && <div style={{ color: '#e74c3c', fontSize: '0.8rem' }}>⚠ {error}</div>}
                        <div style={{ display: 'flex', gap: 9, marginTop: 4 }}>
                            <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', cursor: 'pointer', color: 'white' }}>Cancelar</button>
                            <button onClick={enviar} disabled={enviando} style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: enviando ? '#555' : 'linear-gradient(135deg,#3498db,#2980b9)', color: 'white', fontWeight: 700, cursor: enviando ? 'default' : 'pointer' }}>
                                {enviando ? 'Enviando…' : '📤 Enviar'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Zona jugable reutilizable (enunciado + respuesta + acciones) ──────────────
// No incluye tarjeta exterior: el contenedor (single o dual) la aporta.
function BoardPlay({ problem, seleccion, cesta, showSolution, isMobile, pieceSize, visibles,
                     addPieza, quitarPieza, addProducto, quitarProducto, limpiar, comprobar, pasar, entrada = '', setEntrada }) {
    if (!problem) return null;
    const esCompra = problem.modo === 'PRODUCTOS';
    const totalSel = Object.entries(seleccion).reduce((s, [v, n]) => s + Number(v) * n, 0);
    const totalCesta = Object.entries(cesta).reduce((s, [idx, n]) => s + PRODUCTOS[idx].precio * n, 0);

    return (
        <>
            {/* Enunciado */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                <span style={{ fontSize: isMobile ? '2.4rem' : '3rem' }}>{problem.emoji}</span>
                <span style={{ fontSize: isMobile ? '1.05rem' : '1.25rem', fontWeight: 700, color: '#2c3e50', textAlign: 'left', maxWidth: 460 }}>{problem.enunciado}</span>
            </div>

            {problem.escrito ? (
                <>
                    {/* Respuesta escrita (porcentajes o modo «escribiendo») */}
                    <div style={{ background: '#f8f9fa', borderRadius: 14, padding: '12px 16px', marginBottom: 16, border: '2px solid #e0e0e0' }}>
                        <span style={{ fontSize: '0.85rem', color: '#7f8c8d', display: 'block', marginBottom: 6 }}>{showSolution ? '✅ Solución:' : 'Escribe el resultado:'}</span>
                        {showSolution ? (
                            <div style={{ fontSize: isMobile ? '2rem' : '2.6rem', fontWeight: 'bold', color: '#27ae60' }}>{problem.displayAnswer}</div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                <input value={entrada} onChange={e => setEntrada(e.target.value)} onKeyDown={e => e.key === 'Enter' && comprobar()}
                                    inputMode="decimal" placeholder={problem.unidad === '%' ? '28' : '12,50'} autoFocus
                                    style={{ width: isMobile ? 150 : 190, padding: '10px 12px', borderRadius: 12, border: '2px solid #16a085', fontSize: isMobile ? '1.6rem' : '2rem', fontWeight: 800, textAlign: 'center', color: '#2c3e50', outline: 'none' }} />
                                <span style={{ fontSize: isMobile ? '1.5rem' : '1.9rem', fontWeight: 800, color: '#16a085' }}>{problem.unidad === '%' ? '%' : '€'}</span>
                            </div>
                        )}
                    </div>
                </>
            ) : esCompra ? (
                <>
                    {/* Marcador gastado / te sobra */}
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
                        <div style={{ background: '#f8f9fa', borderRadius: 14, padding: '8px 16px', border: '2px solid #e0e0e0', minWidth: 110 }}>
                            <span style={{ fontSize: '0.78rem', color: '#7f8c8d', display: 'block' }}>🛒 Gastado</span>
                            <div style={{ fontSize: isMobile ? '1.5rem' : '1.9rem', fontWeight: 'bold', color: totalCesta === problem.answerCents && totalCesta > 0 ? '#27ae60' : '#16a085' }}>{fmt(totalCesta)}</div>
                        </div>
                        <div style={{ background: '#f8f9fa', borderRadius: 14, padding: '8px 16px', border: '2px solid #e0e0e0', minWidth: 110 }}>
                            <span style={{ fontSize: '0.78rem', color: '#7f8c8d', display: 'block' }}>👛 Te sobra</span>
                            <div style={{ fontSize: isMobile ? '1.5rem' : '1.9rem', fontWeight: 'bold', color: (problem.dinero - totalCesta) === problem.sobra ? '#27ae60' : (problem.dinero - totalCesta < 0 ? '#e74c3c' : '#e67e22') }}>
                                {fmt(problem.dinero - totalCesta)}
                            </div>
                        </div>
                    </div>

                    {showSolution && (
                        <div style={{ fontSize: '0.9rem', color: '#27ae60', fontWeight: 700, marginBottom: 10 }}>
                            ✅ Tenías que gastar {problem.displayAnswer}
                        </div>
                    )}

                    {/* Carrito */}
                    {!showSolution && totalCesta > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                            {Object.keys(cesta).map(idx => {
                                const p = PRODUCTOS[idx];
                                return (
                                    <button key={idx} onClick={() => quitarProducto(idx)} title={`Quitar ${p.nombre}`}
                                        style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4, background: '#eef7f3', border: '2px solid #16a08555', borderRadius: 10, padding: '5px 9px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, color: '#2c3e50' }}>
                                        <span style={{ fontSize: '1.1rem' }}>{p.emoji}</span>×{cesta[idx]}
                                    </button>
                                );
                            })}
                            <button onClick={limpiar} style={{ ...st.btnVolver, padding: '6px 12px', fontSize: '0.8rem' }}><Delete size={14} /> Vaciar</button>
                        </div>
                    )}

                    {/* Lista de precios del supermercado */}
                    {!showSolution && (
                        <div style={{ background: '#eef7f3', borderRadius: 14, padding: 10, marginBottom: 16 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isMobile ? 2 : 4}, 1fr)`, gap: 7 }}>
                                {PRODUCTOS.map((p, idx) => (
                                    <button key={idx} onClick={() => addProducto(idx)}
                                        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', border: cesta[idx] ? '2px solid #16a085' : '2px solid #e0e0e0', borderRadius: 10, padding: '7px 8px', cursor: 'pointer', textAlign: 'left' }}>
                                        <span style={{ fontSize: '1.3rem' }}>{p.emoji}</span>
                                        <span style={{ flex: 1, minWidth: 0 }}>
                                            <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#2c3e50', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</span>
                                            <span style={{ fontSize: '0.78rem', color: '#16a085', fontWeight: 700 }}>{fmt(p.precio)}</span>
                                        </span>
                                        {cesta[idx] > 0 && <span style={{ background: '#16a085', color: 'white', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800 }}>{cesta[idx]}</span>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <>
                    {/* Total reunido / respuesta — con billetes y monedas */}
                    <div style={{ background: '#f8f9fa', borderRadius: 14, padding: '10px 16px', marginBottom: 14, border: '2px solid #e0e0e0' }}>
                        <span style={{ fontSize: '0.85rem', color: '#7f8c8d', display: 'block', marginBottom: 2 }}>
                            {showSolution
                                ? (problem.tipo === 'pagar' ? '✅ Tenías que reunir:' : '✅ Solución:')
                                : (problem.tipo === 'pagar' ? 'Llevas reunido:' : 'Tu respuesta:')}
                        </span>
                        <div style={{ fontSize: isMobile ? '2rem' : '2.6rem', fontWeight: 'bold', color: showSolution ? '#27ae60' : (totalSel === problem.answerCents && totalSel > 0 ? '#27ae60' : '#16a085') }}>
                            {showSolution ? problem.displayAnswer : fmt(totalSel)}
                        </div>
                    </div>

                    {/* Piezas elegidas */}
                    {!showSolution && totalSel > 0 && (
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', marginBottom: 14, minHeight: pieceSize }}>
                            {DENOMINACIONES.filter(d => seleccion[d.val]).map(d => (
                                <PiezaDinero key={d.val} d={d} size={pieceSize * 0.85} badge={seleccion[d.val]} onClick={() => quitarPieza(d.val)} />
                            ))}
                            <button onClick={limpiar} style={{ ...st.btnVolver, padding: '6px 12px', fontSize: '0.8rem' }}><Delete size={14} /> Vaciar</button>
                        </div>
                    )}

                    {/* Cajón de denominaciones */}
                    {!showSolution && (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 16, background: '#eef7f3', borderRadius: 14, padding: 12 }}>
                            {visibles.map(d => (
                                <PiezaDinero key={d.val} d={d} size={pieceSize} onClick={() => addPieza(d.val)} />
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Solución (al pasar) */}
            {showSolution && (
                <div style={{ background: '#fff8e1', border: '2px solid #ffe082', borderRadius: 12, padding: '10px 14px', marginBottom: 16, color: '#8d6e00', fontWeight: 600, fontSize: '0.95rem', textAlign: problem.pasos ? 'left' : 'center' }}>
                    {problem.pasos
                        ? problem.pasos.map((p, i) => <div key={i}>{i === 0 ? '👁 ' : '· '}{p}</div>)
                        : <>👁 {problem.pista}</>}
                </div>
            )}

            {/* Acciones */}
            {!showSolution && (
                <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={pasar} style={st.btnSkip} title="Pasar (−2 pts, ver solución)"><SkipForward size={18} /> Pasar</button>
                    <button onClick={comprobar} style={{ ...st.btnSuccess, flex: 2 }}><CheckCircle size={20} /> Comprobar</button>
                </div>
            )}
        </>
    );
}

// ─── Tablero independiente para el modo dual ───────────────────────────────────
function TableroDual({ idx, accent, isMobile }) {
    const [estado, setEstado] = useState('MENU'); // MENU | PLAY
    const [config, setConfig] = useState(null);
    const [problem, setProblem] = useState(null);
    const [seleccion, setSeleccion] = useState({});
    const [cesta, setCesta] = useState({});
    const [entrada, setEntrada] = useState('');
    const [feedback, setFeedback] = useState(null);
    const [showSolution, setShowSolution] = useState(false);
    const [score, setScore] = useState(0);
    const [aciertos, setAciertos] = useState(0);
    const [fallos, setFallos] = useState(0);

    const pieceSize = isMobile ? 34 : 40;
    const visibles = config ? DENOMINACIONES.filter(d => d.val <= Math.max(200, Math.round(config.maxPrecio * 100))) : [];

    const nuevo = (cfg) => { setProblem(generarProblema(cfg)); setSeleccion({}); setCesta({}); setEntrada(''); setShowSolution(false); };
    const empezar = (cfg) => { setConfig(cfg); setScore(0); setAciertos(0); setFallos(0); setFeedback(null); nuevo(cfg); setEstado('PLAY'); };

    const esCompra = problem?.modo === 'PRODUCTOS';
    const totalSel = Object.entries(seleccion).reduce((s, [v, n]) => s + Number(v) * n, 0);
    const totalCesta = Object.entries(cesta).reduce((s, [i, n]) => s + PRODUCTOS[i].precio * n, 0);
    const totalActual = esCompra ? totalCesta : totalSel;

    const addPieza = (val) => { if (!showSolution) setSeleccion(p => ({ ...p, [val]: (p[val] || 0) + 1 })); };
    const quitarPieza = (val) => setSeleccion(p => { const n = (p[val] || 0) - 1; const x = { ...p }; if (n <= 0) delete x[val]; else x[val] = n; return x; });
    const addProducto = (i) => { if (!showSolution) setCesta(c => ({ ...c, [i]: (c[i] || 0) + 1 })); };
    const quitarProducto = (i) => setCesta(c => { const n = (c[i] || 0) - 1; const x = { ...c }; if (n <= 0) delete x[i]; else x[i] = n; return x; });
    const limpiar = () => { setSeleccion({}); setCesta({}); };

    const comprobar = () => {
        if (!problem || showSolution || feedback) return;
        if (problem.escrito ? comprobarEscrito(problem, entrada) : totalActual === problem.answerCents) {
            playSound(sndAcierto);
            setScore(s => s + 10); setAciertos(a => a + 1); setFeedback('CORRECT');
            setTimeout(() => { setFeedback(null); nuevo(config); }, 700);
        } else {
            playSound(sndFallo);
            setScore(s => Math.max(0, s - 3)); setFallos(f => f + 1); setFeedback('INCORRECT');
            setTimeout(() => setFeedback(null), 700);
        }
    };
    const pasar = () => {
        if (!problem || showSolution || feedback) return;
        setFallos(f => f + 1); setScore(s => Math.max(0, s - 2)); setShowSolution(true); setFeedback('SKIP');
        setTimeout(() => { setFeedback(null); nuevo(config); }, 2000);
    };

    const borderColor = feedback === 'CORRECT' ? '#2ecc71' : feedback === 'INCORRECT' ? '#e74c3c' : feedback === 'SKIP' ? '#f39c12' : `${accent}44`;

    return (
        <div style={{ flex: 1, minWidth: 0, background: 'white', borderRadius: 18, border: `4px solid ${borderColor}`, padding: isMobile ? '10px 8px' : '16px 14px', boxShadow: '0 8px 20px rgba(0,0,0,0.08)', transition: 'border-color 0.2s', boxSizing: 'border-box' }}>
            {/* Cabecera del jugador */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, color: accent, fontSize: '1rem' }}>👤 Jugador {idx}</span>
                {estado === 'PLAY' && (
                    <>
                        <span style={{ fontWeight: 800, color: accent, display: 'flex', alignItems: 'center', gap: 3 }}><Trophy size={14} /> {score}</span>
                        <span style={{ fontWeight: 700, color: '#27ae60' }}>✅ {aciertos}</span>
                        <span style={{ fontWeight: 700, color: '#e74c3c' }}>❌ {fallos}</span>
                        <button onClick={() => setEstado('MENU')} style={{ ...st.btnVolver, padding: '5px 10px', fontSize: '0.78rem' }}><Settings size={13} /> Modo</button>
                    </>
                )}
            </div>

            {estado === 'MENU' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: '6px 2px' }}>
                    <p style={{ textAlign: 'center', color: '#999', fontSize: '0.85rem', margin: '0 0 4px' }}>Elige un modo de juego</p>
                    {MODOS_PRESET.filter(m => m.cfg).map(m => (
                        <button key={m.id} onClick={() => empezar(m.cfg)}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'white', border: `2px solid ${m.color}`, borderRadius: 14, cursor: 'pointer', textAlign: 'left' }}>
                            <div style={{ background: m.color, borderRadius: 10, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0 }}>{m.icon}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 'bold', color: '#2c3e50', fontSize: '0.95rem' }}>{m.label}</div>
                                <div style={{ color: '#888', fontSize: '0.76rem' }}>{m.desc}</div>
                            </div>
                        </button>
                    ))}
                </div>
            ) : (
                <BoardPlay problem={problem} seleccion={seleccion} cesta={cesta} showSolution={showSolution}
                    isMobile={isMobile} pieceSize={pieceSize} visibles={visibles}
                    addPieza={addPieza} quitarPieza={quitarPieza} addProducto={addProducto} quitarProducto={quitarProducto}
                    limpiar={limpiar} comprobar={comprobar} pasar={pasar} entrada={entrada} setEntrada={setEntrada} />
            )}
        </div>
    );
}

// ─── Componente principal ──────────────────────────────────────────────────────
export default function CalculoDineroGame({ usuario, onExit }) {
    // Reto por enlace: configuración fija del profesor
    const [reto, setReto] = useState(() => leerRetoUrl());
    const esRetoCompeticion = !!(reto?.compId && reto?.catId);
    // Ficha imprimible compartida por enlace: /dinero?ficha=ID abre directamente su vista pública
    const [fichaPublicaId, setFichaPublicaId] = useState(() => (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('ficha') : null));
    const [gameState, setGameState] = useState(() => (fichaPublicaId ? 'FICHAS' : 'START')); // START | PLAYING | END | FICHAS
    const [config, setConfig] = useState(() => ({ ...DEFAULT_CONFIG, ...(reto?.config || {}), tipos: { ...DEFAULT_CONFIG.tipos, ...(reto?.config?.tipos || {}) } }));
    const [showConfig, setShowConfig] = useState(false);
    const [mostrarEnvio, setMostrarEnvio] = useState(false);
    const [dual, setDual] = useState(false);

    const [timeLeft, setTimeLeft] = useState(DEFAULT_CONFIG.tiempo);
    const [score, setScore] = useState(0);
    const [aciertos, setAciertos] = useState(0);
    const [fallos, setFallos] = useState(0);
    const [skips, setSkips] = useState(0);
    const [ejercicioActual, setEjercicioActual] = useState(1);

    const [problem, setProblem] = useState(null);
    const [seleccion, setSeleccion] = useState({});   // {val: count} de billetes/monedas
    const [cesta, setCesta] = useState({});           // {idxProducto: count} en modo lista de la compra
    const [entrada, setEntrada] = useState('');       // respuesta escrita (porcentajes / modo «escribiendo»)
    const [feedback, setFeedback] = useState(null);    // 'CORRECT' | 'INCORRECT' | 'SKIP'
    const [showSolution, setShowSolution] = useState(false);

    const timerRef = useRef(null);
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 600;
    const modoEjercicios = !!config.numEjercicios;

    // Temporizador
    useEffect(() => {
        if (modoEjercicios) return;
        if (gameState === 'PLAYING' && timeLeft > 0) {
            timerRef.current = setInterval(() => setTimeLeft(p => p - 1), 1000);
        } else if (timeLeft <= 0 && gameState === 'PLAYING') {
            clearInterval(timerRef.current);
            setGameState('END');
        }
        return () => clearInterval(timerRef.current);
    }, [gameState, timeLeft, modoEjercicios]);

    const nuevoProblema = (cfg) => {
        setProblem(generarProblema(cfg));
        setSeleccion({});
        setCesta({});
        setEntrada('');
        setShowSolution(false);
    };

    const startGame = (cfg = config) => {
        setConfig(cfg);
        setScore(0); setAciertos(0); setFallos(0); setSkips(0);
        setEjercicioActual(1);
        setTimeLeft(cfg.tiempo);
        setFeedback(null);
        nuevoProblema(cfg);
        setGameState('PLAYING');
    };

    const avanzar = () => {
        if (config.numEjercicios && ejercicioActual + 1 > config.numEjercicios) {
            setGameState('END');
        } else {
            setEjercicioActual(n => n + 1);
            nuevoProblema(config);
        }
    };

    const esCompra = problem?.modo === 'PRODUCTOS';

    // Total seleccionado: billetes/monedas (modo dinero) o carrito (modo compra)
    const totalSel = Object.entries(seleccion).reduce((s, [v, n]) => s + Number(v) * n, 0);
    const totalCesta = Object.entries(cesta).reduce((s, [idx, n]) => s + PRODUCTOS[idx].precio * n, 0);
    const totalActual = esCompra ? totalCesta : totalSel;

    const addPieza = (val) => { if (!showSolution) setSeleccion(p => ({ ...p, [val]: (p[val] || 0) + 1 })); };
    const quitarPieza = (val) => setSeleccion(p => {
        const n = (p[val] || 0) - 1;
        const next = { ...p };
        if (n <= 0) delete next[val]; else next[val] = n;
        return next;
    });
    const addProducto = (idx) => { if (!showSolution) setCesta(c => ({ ...c, [idx]: (c[idx] || 0) + 1 })); };
    const quitarProducto = (idx) => setCesta(c => {
        const n = (c[idx] || 0) - 1;
        const next = { ...c };
        if (n <= 0) delete next[idx]; else next[idx] = n;
        return next;
    });
    const limpiar = () => { setSeleccion({}); setCesta({}); setEntrada(''); };

    const acierto = () => {
        playSound(sndAcierto);
        setScore(s => s + 10); setAciertos(a => a + 1); setFeedback('CORRECT');
        setTimeout(() => { setFeedback(null); avanzar(); }, 700);
    };
    const fallo = () => {
        playSound(sndFallo);
        setScore(s => Math.max(0, s - 3)); setFallos(f => f + 1); setFeedback('INCORRECT');
        setTimeout(() => setFeedback(null), 700);
    };

    const comprobar = () => {
        if (!problem || showSolution || feedback) return;
        if (problem.escrito ? comprobarEscrito(problem, entrada) : totalActual === problem.answerCents) acierto(); else fallo();
    };

    const pasar = () => {
        if (!problem || showSolution || feedback) return;
        setSkips(s => s + 1); setFallos(f => f + 1); setScore(s => Math.max(0, s - 2));
        setShowSolution(true); setFeedback('SKIP');
        setTimeout(() => { setFeedback(null); avanzar(); }, problem.pasos?.length > 2 ? 5000 : 2200); // más tiempo si hay varios pasos
    };

    const quitarFichaDeUrl = () => {
        if (!fichaPublicaId) return;
        const u = new URL(window.location.href); u.searchParams.delete('ficha');
        window.history.replaceState({}, '', u.pathname + u.search);
        setFichaPublicaId(null);
    };

    const handleExit = () => {
        clearInterval(timerRef.current);
        quitarFichaDeUrl();
        if (gameState !== 'START') setGameState('START');
        else if (typeof onExit === 'function') onExit();
        else window.location.href = '/';
    };

    const compartir = () => {
        const url = window.location.href;
        if (navigator.share) navigator.share({ title: 'Cálculo con Dinero', text: 'Practica el dinero aquí', url }).catch(() => {});
        else navigator.clipboard.writeText(url).then(() => alert('✅ Enlace copiado'));
    };

    const borderColor = feedback === 'CORRECT' ? '#2ecc71' : feedback === 'INCORRECT' ? '#e74c3c' : feedback === 'SKIP' ? '#f39c12' : 'transparent';
    const visibles = DENOMINACIONES.filter(d => d.val <= Math.max(200, Math.round(config.maxPrecio * 100)));
    const pieceSize = isMobile ? 42 : 52;

    // ── MODO DUAL: pantalla partida, cada jugador elige su modo y juega solo ──
    if (dual) {
        return (
            <div style={st.container}>
                <div style={st.header}>
                    <button onClick={() => setDual(false)} style={st.btnVolver}><RotateCcw size={16} /> Salir del dual</button>
                    <span style={{ fontWeight: 800, color: '#16a085', fontSize: '1rem' }}>👥 Modo dual · 2 jugadores</span>
                    <button onClick={compartir} style={st.btnVolver} title="Compartir"><Share2 size={16} /></button>
                </div>
                <div style={{ display: 'flex', gap: 12, flexDirection: isMobile ? 'column' : 'row', alignItems: 'stretch' }}>
                    <TableroDual idx={1} accent="#3498db" isMobile={isMobile} />
                    <TableroDual idx={2} accent="#e74c3c" isMobile={isMobile} />
                </div>
            </div>
        );
    }

    return (
        <div style={st.container}>
            {showConfig && (
                <ConfigModal config={config} onStart={(cfg) => { startGame(cfg); setShowConfig(false); }} onClose={() => setShowConfig(false)} />
            )}

            {/* HEADER */}
            <div style={st.header}>
                <button onClick={handleExit} style={st.btnVolver}><RotateCcw size={16} /> Salir</button>
                <button onClick={compartir} style={st.btnVolver} title="Compartir"><Share2 size={16} /></button>
                {gameState === 'PLAYING' && (
                    <div style={st.scoreFlex}>
                        {modoEjercicios ? (
                            <div style={{ ...st.scoreBoard, color: '#009688' }}>🔢 {ejercicioActual}/{config.numEjercicios}</div>
                        ) : (
                            <div style={{ ...st.scoreBoard, color: timeLeft <= 10 ? '#e74c3c' : '#333' }}>
                                <Clock size={16} /> {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                            </div>
                        )}
                        <div style={{ ...st.scoreBoard, color: '#16a085' }}><Trophy size={16} /> {score}</div>
                        <div style={{ ...st.scoreBoard, color: '#27ae60', fontSize: '0.9rem' }}>✅ {aciertos}</div>
                        <div style={{ ...st.scoreBoard, color: '#e74c3c', fontSize: '0.9rem' }}>❌ {fallos}</div>
                    </div>
                )}
            </div>

            {/* RETO POR ENLACE */}
            {gameState === 'START' && reto && (
                <PantallaReto reto={reto} nombreJuego="Cálculo con dinero" emoji="💶" color="#16a085"
                    chips={resumenDinero(config)}
                    onEmpezar={() => startGame(config)}
                    onLibre={() => { limpiarRetoUrl(); setReto(null); setConfig(DEFAULT_CONFIG); }} />
            )}

            {/* INICIO */}
            {gameState === 'START' && !reto && (
                <div style={{ ...st.centerCard, maxWidth: 560 }}>
                    <Coins size={50} color="#16a085" style={{ marginBottom: 8 }} />
                    <h1 style={{ color: '#2c3e50', fontSize: isMobile ? '1.8rem' : '2.3rem', margin: '6px 0 4px' }}>Cálculo con Dinero</h1>
                    <p style={{ color: '#999', marginBottom: 22, fontSize: '0.9rem' }}>
                        Paga con billetes y monedas, calcula la vuelta, proporciones, IVA y rebajas
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {MODOS_PRESET.map(m => (
                            <button key={m.id}
                                onClick={() => m.cfg ? startGame(m.cfg) : setShowConfig(true)}
                                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: 'white', border: `2px solid ${m.color}`, borderRadius: 16, cursor: 'pointer', textAlign: 'left', boxShadow: '0 3px 10px rgba(0,0,0,0.07)', width: '100%' }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 20px ${m.color}33`; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 3px 10px rgba(0,0,0,0.07)'; }}
                            >
                                <div style={{ background: m.color, borderRadius: 12, width: 46, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>{m.icon}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 'bold', color: '#2c3e50', fontSize: '1rem', marginBottom: 3 }}>{m.label}</div>
                                    <div style={{ color: '#888', fontSize: '0.82rem', marginBottom: m.tags ? 6 : 0 }}>{m.desc}</div>
                                    {m.tags && (
                                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                            {m.tags.map(t => <span key={t} style={{ background: m.color + '22', color: m.color, border: `1px solid ${m.color}55`, borderRadius: 6, padding: '1px 7px', fontSize: '0.78rem', fontWeight: 700 }}>{t}</span>)}
                                        </div>
                                    )}
                                </div>
                                <span style={{ color: m.color, fontSize: '1.3rem', flexShrink: 0 }}>›</span>
                            </button>
                        ))}

                        {/* Separador */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0' }}>
                            <div style={{ flex: 1, height: 1, background: '#eee' }} />
                            <span style={{ color: '#bbb', fontSize: '0.75rem' }}>para el profesor</span>
                            <div style={{ flex: 1, height: 1, background: '#eee' }} />
                        </div>

                        {/* Fichas imprimibles */}
                        <button onClick={() => setGameState('FICHAS')}
                            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: 'white', border: '2px solid #c0392b', borderRadius: 16, cursor: 'pointer', textAlign: 'left', boxShadow: '0 3px 10px rgba(0,0,0,0.07)', width: '100%' }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 20px #c0392b33'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 3px 10px rgba(0,0,0,0.07)'; }}
                        >
                            <div style={{ background: '#c0392b', borderRadius: 12, width: 46, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>🖨️</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 'bold', color: '#2c3e50', fontSize: '1rem', marginBottom: 3 }}>Fichas para imprimir</div>
                                <div style={{ color: '#888', fontSize: '0.82rem' }}>Crea una ficha en PDF (dinero, porcentajes, problemas de precios), guárdala y corrígela en el monitor</div>
                            </div>
                            <span style={{ color: '#c0392b', fontSize: '1.3rem', flexShrink: 0 }}>›</span>
                        </button>

                        {/* Separador */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0' }}>
                            <div style={{ flex: 1, height: 1, background: '#eee' }} />
                            <span style={{ color: '#bbb', fontSize: '0.75rem' }}>2 jugadores</span>
                            <div style={{ flex: 1, height: 1, background: '#eee' }} />
                        </div>

                        {/* Modo dual */}
                        <button onClick={() => setDual(true)}
                            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: 'white', border: '2px solid #8e44ad', borderRadius: 16, cursor: 'pointer', textAlign: 'left', boxShadow: '0 3px 10px rgba(0,0,0,0.07)', width: '100%' }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 20px #8e44ad33'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 3px 10px rgba(0,0,0,0.07)'; }}
                        >
                            <div style={{ background: '#8e44ad', borderRadius: 12, width: 46, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>👥</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 'bold', color: '#2c3e50', fontSize: '1rem', marginBottom: 3 }}>Modo dual</div>
                                <div style={{ color: '#888', fontSize: '0.82rem' }}>Pantalla partida · cada jugador elige su propio modo y juega a la vez</div>
                            </div>
                            <span style={{ color: '#8e44ad', fontSize: '1.3rem', flexShrink: 0 }}>›</span>
                        </button>
                    </div>
                </div>
            )}

            {/* FICHAS IMPRIMIBLES */}
            {gameState === 'FICHAS' && (
                <React.Suspense fallback={<div style={{ textAlign: 'center', color: '#16a085', fontWeight: 800, padding: 40 }}>Cargando fichas…</div>}>
                    <FichasDinero isMobile={isMobile} fichaPublicaId={fichaPublicaId}
                        onSalir={() => { quitarFichaDeUrl(); setGameState('START'); }} />
                </React.Suspense>
            )}

            {/* JUEGO */}
            {gameState === 'PLAYING' && problem && (
                <div style={{ ...st.centerCard, maxWidth: 640, border: `4px solid ${borderColor}`, transition: 'border-color 0.2s, transform 0.2s', transform: feedback === 'CORRECT' ? 'scale(1.02)' : 'none' }}>
                    <BoardPlay problem={problem} seleccion={seleccion} cesta={cesta} showSolution={showSolution}
                        isMobile={isMobile} pieceSize={pieceSize} visibles={visibles}
                        addPieza={addPieza} quitarPieza={quitarPieza} addProducto={addProducto} quitarProducto={quitarProducto}
                        limpiar={limpiar} comprobar={comprobar} pasar={pasar} entrada={entrada} setEntrada={setEntrada} />
                </div>
            )}

            {/* FINAL */}
            {gameState === 'END' && (
                <div style={st.centerCard}>
                    {score >= 80 && <Confetti recycle={false} />}
                    {modoEjercicios ? <Trophy size={70} color="#f1c40f" style={{ marginBottom: 16 }} /> : <Clock size={70} color="#f1c40f" style={{ marginBottom: 16 }} />}
                    <h1 style={{ color: '#2c3e50', fontSize: isMobile ? '1.8rem' : '2.2rem' }}>{modoEjercicios ? '¡Ejercicios completados!' : '¡Tiempo agotado!'}</h1>
                    <div style={{ fontSize: '3.5rem', fontWeight: 'bold', color: '#16a085', margin: '8px 0' }}>{score}</div>
                    <p style={{ color: '#999', marginBottom: 6 }}>Puntos Totales</p>
                    <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 28, flexWrap: 'wrap' }}>
                        <span style={{ color: '#27ae60', fontWeight: 'bold' }}>✅ {aciertos} aciertos</span>
                        <span style={{ color: '#f39c12', fontWeight: 'bold' }}>⏭ {skips} pasadas</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button onClick={() => startGame(config)} style={{ ...st.btnPrimary, background: '#16a085' }}><RotateCcw size={16} /> Repetir</button>
                        {!reto && <button onClick={() => { setShowConfig(true); setGameState('START'); }} style={{ ...st.btnPrimary, background: '#7f8c8d' }}><Settings size={16} /> Configurar</button>}
                        <button onClick={() => setGameState('START')} style={st.btnVolver}>Menú</button>
                        <button onClick={() => setMostrarEnvio(true)} style={{ ...st.btnPrimary, background: esRetoCompeticion ? 'linear-gradient(135deg,#f39c12,#e67e22)' : 'linear-gradient(135deg,#27ae60,#2ecc71)' }}>{textoBotonEnvio(reto)}</button>
                    </div>
                </div>
            )}
            {mostrarEnvio && esRetoCompeticion && (
                <ModalEnviarCompeticion compId={reto.compId} catId={reto.catId} puntos={score}
                    detalle={{ aciertos, fallos, skips }} nombreJuego="Cálculo con dinero" tituloReto={reto.titulo || ''}
                    onClose={() => setMostrarEnvio(false)} />
            )}
            {mostrarEnvio && !esRetoCompeticion && (
                <ModalEnviarProfe datos={{ aciertos, fallos, puntos: score, skips, config, reto: reto ? (reto.titulo || 'Reto') : null }} onClose={() => setMostrarEnvio(false)} />
            )}
        </div>
    );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const st = {
    container: { minHeight: '100vh', background: '#e8f5e9', padding: '15px', fontFamily: "'Segoe UI', Tahoma, sans-serif", boxSizing: 'border-box' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 8 },
    btnVolver: { padding: '8px 16px', background: 'white', border: '1px solid #ccc', borderRadius: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 'bold', color: '#333', fontSize: '0.9rem' },
    scoreFlex: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
    scoreBoard: { display: 'flex', gap: 6, background: 'white', padding: '7px 14px', borderRadius: 30, fontWeight: 'bold', fontSize: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', alignItems: 'center' },
    centerCard: { background: 'white', maxWidth: 520, margin: '10px auto', padding: '22px 20px', borderRadius: 20, textAlign: 'center', boxShadow: '0 15px 35px rgba(0,0,0,0.1)', boxSizing: 'border-box' },
    btnPrimary: { color: 'white', border: 'none', padding: '13px 20px', borderRadius: 30, fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 10px rgba(0,0,0,0.2)', maxWidth: 300 },
    btnSuccess: { background: '#27ae60', color: 'white', border: 'none', borderRadius: 14, padding: '14px 20px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 5px 0 #1e8449' },
    btnSkip: { background: '#f39c12', color: 'white', border: 'none', borderRadius: 14, padding: '14px 16px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 5px 0 #d68910', flex: 1 },
};
