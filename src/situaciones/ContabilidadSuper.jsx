// ─── Situación de aprendizaje: Contabilidad del supermercado ───────────────────
// El alumno lleva la contabilidad de un mes de un supermercado: asientos en el
// Libro Diario (Debe / Haber) con cuentas del PGC, IVA al 4 / 10 / 21 %, luz,
// alquiler con retención, nómina de un empleado, liquidación del IVA, inventario
// y regularización. Después ve el Libro Mayor, el balance de comprobación, la
// cuenta de pérdidas y ganancias y el balance de situación.
// Precios y tipos de IVA: utils/productosSuper.js (compartido con Cálculo con Dinero).
import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';
import { PRODUCTOS, PRODUCTOS_21 } from '../utils/productosSuper';

// ─── Utilidades ───────────────────────────────────────────────────────────────
const r2 = x => Math.round((x + Number.EPSILON) * 100) / 100;
const num = x => (x ?? 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const eur = x => num(x) + ' €';
const TOL = 0.035;
const LS_KEY = 'pikt_contab_super';

function parseImporte(s) {
    if (s == null) return NaN;
    let t = String(s).trim().replace(/\s|€/g, '');
    if (!t) return NaN;
    if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
    return parseFloat(t);
}

function mulberry32(a) {
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ─── Cuentas del Plan General Contable usadas ─────────────────────────────────
export const CUENTAS = [
    { c: '100',  n: 'Capital social', g: 1, t: 'PN' },
    { c: '129',  n: 'Resultado del ejercicio', g: 1, t: 'PN' },
    { c: '170',  n: 'Deudas a l/p con entidades de crédito', g: 1, t: 'P' },
    { c: '216',  n: 'Mobiliario', g: 2, t: 'A' },
    { c: '217',  n: 'Equipos para procesos de información', g: 2, t: 'A' },
    { c: '300',  n: 'Mercaderías', g: 3, t: 'A' },
    { c: '400',  n: 'Proveedores', g: 4, t: 'P' },
    { c: '410',  n: 'Acreedores por prestaciones de servicios', g: 4, t: 'P' },
    { c: '430',  n: 'Clientes', g: 4, t: 'A' },
    { c: '465',  n: 'Remuneraciones pendientes de pago', g: 4, t: 'P' },
    { c: '4700', n: 'H.P., deudora por IVA', g: 4, t: 'A' },
    { c: '472',  n: 'H.P., IVA soportado', g: 4, t: 'A' },
    { c: '4750', n: 'H.P., acreedora por IVA', g: 4, t: 'P' },
    { c: '4751', n: 'H.P., acreedora por retenciones practicadas', g: 4, t: 'P' },
    { c: '476',  n: 'Organismos de la Seguridad Social, acreedores', g: 4, t: 'P' },
    { c: '477',  n: 'H.P., IVA repercutido', g: 4, t: 'P' },
    { c: '523',  n: 'Proveedores de inmovilizado a c/p', g: 5, t: 'P' },
    { c: '570',  n: 'Caja, euros', g: 5, t: 'A' },
    { c: '572',  n: 'Bancos c/c', g: 5, t: 'A' },
    { c: '600',  n: 'Compras de mercaderías', g: 6, t: 'G' },
    { c: '610',  n: 'Variación de existencias de mercaderías', g: 6, t: 'G' },
    { c: '621',  n: 'Arrendamientos y cánones', g: 6, t: 'G' },
    { c: '628',  n: 'Suministros', g: 6, t: 'G' },
    { c: '629',  n: 'Otros servicios', g: 6, t: 'G' },
    { c: '640',  n: 'Sueldos y salarios', g: 6, t: 'G' },
    { c: '642',  n: 'Seguridad Social a cargo de la empresa', g: 6, t: 'G' },
    { c: '700',  n: 'Ventas de mercaderías', g: 7, t: 'I' },
    { c: '705',  n: 'Prestaciones de servicios', g: 7, t: 'I' },
];
const CTA = Object.fromEntries(CUENTAS.map(c => [c.c, c]));
const GRUPOS = { 1: 'Grupo 1 · Financiación básica', 2: 'Grupo 2 · Activo no corriente', 3: 'Grupo 3 · Existencias', 4: 'Grupo 4 · Acreedores y deudores', 5: 'Grupo 5 · Cuentas financieras', 6: 'Grupo 6 · Compras y gastos', 7: 'Grupo 7 · Ventas e ingresos' };
const nombreCta = c => CTA[c] ? `${c} ${CTA[c].n}` : c;

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const EMPLEADOS = ['Lucía Martín', 'Javier Ortega', 'Nerea Gil', 'Óscar Ruiz', 'Marta Pascual', 'Adrián Sanz', 'Irene Lozano', 'Hugo Navarro'];

// Tipos de cotización simplificados (aprox. 2026)
const SS_TRAB = 6.5;   // contingencias comunes + desempleo + FP + MEI
const SS_EMP = 32;     // contingencias comunes + desempleo + FOGASA + FP + AT/EP + MEI
const RET_ALQ = 19;    // retención IRPF en alquiler de local

// ─── Generador del mes ────────────────────────────────────────────────────────
export function generarMes(seed, nombre) {
    const R = mulberry32(seed);
    const rnd = (a, b) => a + R() * (b - a);
    const ri = (a, b) => Math.floor(rnd(a, b + 1));
    const pick = (arr, k) => { const c = [...arr]; const out = []; while (out.length < k && c.length) out.push(c.splice(Math.floor(R() * c.length), 1)[0]); return out; };
    const mes = MESES[seed % 12];
    const fecha = d => `${d} de ${mes}`;
    const ops = [];

    // 1 · Constitución
    const capBanco = ri(25, 40) * 1000, capCaja = ri(10, 20) * 100;
    ops.push({
        id: 'constitucion', dia: 1, emoji: '🏁', titulo: 'Constitución de la empresa',
        enunciado: `Los socios constituyen «${nombre}». Ingresan ${eur(capBanco)} en la cuenta bancaria de la empresa y dejan ${eur(capCaja)} en efectivo en la caja registradora.`,
        doc: { tipo: 'texto', titulo: 'Escritura de constitución', lineas: [['Aportación ingresada en el banco', capBanco], ['Aportación en efectivo (caja)', capCaja], ['Capital social', capBanco + capCaja]] },
        sol: [{ c: '572', d: capBanco }, { c: '570', d: capCaja }, { c: '100', h: capBanco + capCaja }],
        expl: 'El dinero que entra en la empresa (572 Bancos y 570 Caja) es activo: aumenta por el Debe. Lo que aportan los socios es patrimonio neto (100 Capital social) y aumenta por el Haber.',
    });

    // 2 · Mobiliario (inmovilizado)
    const b1 = ri(22, 40) * 100 + ri(0, 9) * 10, b2 = ri(8, 16) * 100;
    const baseMob = b1 + b2, ivaMob = r2(baseMob * 0.21);
    ops.push({
        id: 'mobiliario', dia: 2, emoji: '🗄️', titulo: 'Compra de estanterías y mostrador',
        enunciado: 'Se compran estanterías y un mostrador de caja para la tienda. El proveedor nos concede 90 días para pagar la factura.',
        doc: { tipo: 'factura', emisor: 'Equipamientos Comerciales, S.L.', receptor: nombre, numero: `EC-${ri(100, 999)}`, pie: 'Vencimiento: a 90 días', lineas: [{ n: '🗄️ Estanterías metálicas (módulos)', base: b1, tipo: 21 }, { n: '🧾 Mostrador de caja', base: b2, tipo: 21 }], desglose: [{ tipo: 21, base: baseMob, cuota: ivaMob }], total: r2(baseMob + ivaMob) },
        sol: [{ c: '216', d: baseMob }, { c: '472', d: ivaMob }, { c: '523', h: r2(baseMob + ivaMob) }],
        expl: 'Las estanterías no se compran para venderlas: son inmovilizado (216 Mobiliario), por su base imponible. El IVA que nos cobran es IVA soportado (472), un derecho frente a Hacienda, al Debe. La deuda NO va a 400 Proveedores (solo para mercaderías) sino a 523 Proveedores de inmovilizado a corto plazo.',
    });

    // 3 · Compra de mercaderías (4 %, 10 %, 21 %)
    const elegidos = [
        ...pick(PRODUCTOS.filter(p => p.iva === 4), 4),
        ...pick(PRODUCTOS.filter(p => p.iva === 10), 3),
        ...pick(PRODUCTOS_21, 3),
    ];
    const stock = elegidos.map(p => {
        const pvp = p.precio / 100;
        const baseVenta = pvp / (1 + p.iva / 100);
        const coste = r2(baseVenta * rnd(0.55, 0.68));
        const uds = ri(40, 150) * 10;
        return { ...p, pvp, baseVenta, coste, uds, base: r2(uds * coste), rest: 0, tpv: 0 };
    });
    const desglose = t => {
        const tipos = [...new Set(t.map(l => l.tipo))].sort((a, b) => a - b);
        return tipos.map(tp => { const base = r2(t.filter(l => l.tipo === tp).reduce((s, l) => s + l.base, 0)); return { tipo: tp, base, cuota: r2(base * tp / 100) }; });
    };
    const lineasCompra = stock.map(p => ({ n: `${p.emoji} ${p.nombre}`, uds: p.uds, precio: p.coste, base: p.base, tipo: p.iva }));
    const desCompra = desglose(lineasCompra);
    const baseCompra = r2(desCompra.reduce((s, d) => s + d.base, 0));
    const ivaCompra = r2(desCompra.reduce((s, d) => s + d.cuota, 0));
    const totalCompra = r2(baseCompra + ivaCompra);
    ops.push({
        id: 'compra', dia: 3, emoji: '🚚', titulo: 'Compra de mercaderías al mayorista',
        enunciado: 'Llega el primer pedido del mayorista: productos con IVA superreducido (4 %), reducido (10 %) y general (21 %). La factura se pagará más adelante.',
        doc: { tipo: 'factura', emisor: 'Distribuciones Alimentarias del Norte, S.A.', receptor: nombre, numero: `DAN-${ri(1000, 9999)}`, pie: 'Forma de pago: transferencia a 30 días', lineas: lineasCompra, desglose: desCompra, total: totalCompra },
        sol: [{ c: '600', d: baseCompra }, { c: '472', d: ivaCompra }, { c: '400', h: totalCompra }],
        expl: 'Las mercaderías que el súper compra para revender van a 600 Compras de mercaderías por la base imponible (sin IVA). Cada tipo de IVA se calcula sobre su base y se suman todas las cuotas en 472 IVA soportado (Debe). La deuda con el mayorista va a 400 Proveedores por el total de la factura (Haber).',
    });

    // 4 · Alquiler del local con retención
    const baseAlq = ri(9, 14) * 100, ivaAlq = r2(baseAlq * 0.21), retAlq = r2(baseAlq * RET_ALQ / 100);
    const pagoAlq = r2(baseAlq + ivaAlq - retAlq);
    ops.push({
        id: 'alquiler', dia: 5, emoji: '🏬', titulo: 'Alquiler del local',
        enunciado: `Se paga por banco el alquiler del local al propietario (una persona física). La factura lleva IVA del 21 % y una retención de IRPF del ${RET_ALQ} % que la empresa ingresará más tarde a Hacienda.`,
        doc: { tipo: 'factura', emisor: 'Carmen Ibáñez (propietaria del local)', receptor: nombre, numero: `ALQ-${mes.slice(0, 3).toUpperCase()}`, pie: 'Cargo en cuenta (banco)', lineas: [{ n: '🏬 Alquiler del local comercial', base: baseAlq, tipo: 21 }], desglose: [{ tipo: 21, base: baseAlq, cuota: ivaAlq }], retencion: { pct: RET_ALQ, importe: retAlq }, total: pagoAlq },
        sol: [{ c: '621', d: baseAlq }, { c: '472', d: ivaAlq }, { c: '4751', h: retAlq }, { c: '572', h: pagoAlq }],
        expl: `El alquiler es un gasto (621 Arrendamientos), al Debe por la base. El IVA soportado (472) también al Debe. La retención del ${RET_ALQ} % no se le paga al propietario: la empresa se la queda para ingresarla a Hacienda, así que es una deuda (4751, Haber). Por el banco sale solo base + IVA − retención.`,
    });

    // 5 · Venta a un restaurante (a crédito)
    const prod10 = stock.filter(p => p.iva === 10);
    const vendRest = pick(prod10, 2).map(p => { const uds = Math.min(ri(4, 12) * 10, Math.floor(p.uds * 0.25)); p.rest = uds; const precio = r2(p.baseVenta * 0.9); return { n: `${p.emoji} ${p.nombre}`, uds, precio, base: r2(uds * precio), tipo: p.iva }; });
    const desRest = desglose(vendRest);
    const baseRest = r2(desRest.reduce((s, d) => s + d.base, 0));
    const ivaRest = r2(desRest.reduce((s, d) => s + d.cuota, 0));
    const totalRest = r2(baseRest + ivaRest);
    ops.push({
        id: 'restaurante', dia: 12, emoji: '🍽️', titulo: 'Venta a un restaurante del barrio',
        enunciado: 'Un restaurante compra varias cajas con un 10 % de descuento sobre el precio sin IVA. Emitimos factura y nos la pagará el mes que viene.',
        doc: { tipo: 'factura', emisor: nombre, receptor: 'Restaurante La Plaza, S.L.', numero: `F-${ri(1, 50).toString().padStart(3, '0')}`, pie: 'Cobro: a 30 días', lineas: vendRest, desglose: desRest, total: totalRest, emitida: true },
        sol: [{ c: '430', d: totalRest }, { c: '700', h: baseRest }, { c: '477', h: ivaRest }],
        expl: 'Ahora somos nosotros quienes vendemos: la venta (700 Ventas de mercaderías) es un ingreso y va al Haber por la base. El IVA que cobramos al cliente es IVA repercutido (477): una deuda con Hacienda, al Haber. El restaurante nos debe el total (430 Clientes, activo, Debe).',
    });

    // 6 · Factura de la luz
    const kwh = ri(28, 48) * 100, precioKwh = Math.round(rnd(120, 170)) / 1000;
    const energia = r2(kwh * precioKwh), potencia = r2(rnd(55, 95));
    const ie = r2((energia + potencia) * 0.0511), contador = r2(rnd(8, 15));
    const baseLuz = r2(energia + potencia + ie + contador), ivaLuz = r2(baseLuz * 0.21), totalLuz = r2(baseLuz + ivaLuz);
    ops.push({
        id: 'luz', dia: 18, emoji: '💡', titulo: 'Factura de la luz',
        enunciado: 'Llega la factura de electricidad (cámaras frigoríficas, iluminación y cajas). Está domiciliada: se paga directamente por banco.',
        doc: { tipo: 'luz', kwh, precioKwh, energia, potencia, ie, contador, base: baseLuz, iva: ivaLuz, total: totalLuz },
        sol: [{ c: '628', d: baseLuz }, { c: '472', d: ivaLuz }, { c: '572', h: totalLuz }],
        expl: 'La electricidad es un gasto de suministros (628), al Debe por la base imponible (energía + potencia + impuesto eléctrico + contador). La electricidad lleva IVA general del 21 % (472, Debe). Como está domiciliada, sale del banco (572, Haber).',
    });

    // 7 · Pago al proveedor
    ops.push({
        id: 'pagoProv', dia: 25, emoji: '🏦', titulo: 'Pago al mayorista',
        enunciado: `Pagamos por transferencia bancaria la factura del mayorista del día 3 (${eur(totalCompra)}).`,
        doc: { tipo: 'texto', titulo: 'Orden de transferencia', lineas: [['Beneficiario: Distribuciones Alimentarias del Norte', null], ['Importe transferido', totalCompra]] },
        sol: [{ c: '400', d: totalCompra }, { c: '572', h: totalCompra }],
        expl: 'Al pagar desaparece la deuda: 400 Proveedores (pasivo) disminuye por el Debe. Sale dinero del banco: 572 (activo) disminuye por el Haber. ¡Ojo! El IVA ya se contabilizó al recibir la factura, ahora no se vuelve a anotar.',
    });

    // 8 · Ventas del mes en caja (IVA incluido)
    stock.forEach(p => { p.tpv = Math.round((p.uds - p.rest) * rnd(0.72, 0.9)); });
    const tiposTpv = [4, 10, 21].map(tp => {
        const total = r2(stock.filter(p => p.iva === tp).reduce((s, p) => s + p.tpv * p.pvp, 0));
        const base = r2(total / (1 + tp / 100));
        return { tipo: tp, total, base, cuota: r2(total - base) };
    });
    const totalTpv = r2(tiposTpv.reduce((s, t) => s + t.total, 0));
    const baseTpv = r2(tiposTpv.reduce((s, t) => s + t.base, 0));
    const ivaTpv = r2(tiposTpv.reduce((s, t) => s + t.cuota, 0));
    const efectivo = r2(totalTpv * rnd(0.28, 0.38));
    const tarjeta = r2(totalTpv - efectivo);
    ops.push({
        id: 'ventas', dia: 29, emoji: '🛒', titulo: 'Ventas del mes en las cajas',
        enunciado: 'Resumen de las cajas registradoras del mes (informe Z). Los precios del súper llevan el IVA incluido, así que hay que separar la base de la cuota de cada tipo. Una parte se cobró en efectivo y el resto con tarjeta (llega al banco).',
        doc: { tipo: 'ticketZ', tipos: tiposTpv, total: totalTpv, efectivo, tarjeta, productos: stock.map(p => ({ n: `${p.emoji} ${p.nombre}`, uds: p.tpv, pvp: p.pvp, tipo: p.iva })) },
        sol: [{ c: '570', d: efectivo }, { c: '572', d: tarjeta }, { c: '700', h: baseTpv }, { c: '477', h: ivaTpv }],
        expl: 'Para separar el IVA de un precio con IVA incluido se divide: base = total ÷ 1,04 (o 1,10 o 1,21). Ventas (700) por la suma de bases y 477 IVA repercutido por la suma de cuotas, ambas al Haber. Lo cobrado entra en caja (570) y en el banco (572), al Debe.',
    });

    // 9 · Ingreso del efectivo en el banco
    const ingreso = Math.max(100, Math.floor((efectivo * 0.9) / 100) * 100);
    ops.push({
        id: 'ingresoCaja', dia: 29, emoji: '💶', titulo: 'Ingreso del efectivo en el banco',
        enunciado: `Por seguridad, el encargado lleva ${eur(ingreso)} del efectivo de la caja al banco.`,
        doc: { tipo: 'texto', titulo: 'Resguardo de ingreso en efectivo', lineas: [['Importe ingresado en la cuenta', ingreso]] },
        sol: [{ c: '572', d: ingreso }, { c: '570', h: ingreso }],
        expl: 'Solo cambia de sitio el dinero: entra en el banco (572, Debe) y sale de la caja (570, Haber). No hay gasto ni ingreso.',
    });

    // 10 · Nómina del empleado
    const empleado = EMPLEADOS[ri(0, EMPLEADOS.length - 1)];
    const salarioBase = ri(118, 140) * 10, plus = ri(8, 20) * 10;
    const bruto = salarioBase + plus;
    const pIrpf = [8, 9, 10, 11, 12][ri(0, 4)];
    const ssT = r2(bruto * SS_TRAB / 100), irpf = r2(bruto * pIrpf / 100), neto = r2(bruto - ssT - irpf), ssE = r2(bruto * SS_EMP / 100);
    ops.push({
        id: 'nomina', dia: 30, emoji: '👩‍💼', titulo: `Nómina de ${empleado}`,
        enunciado: `Se paga por banco la nómina de ${empleado}, cajero/a reponedor/a. La Seguridad Social (la del trabajador y la de la empresa) y el IRPF retenido se ingresarán el mes que viene.`,
        doc: { tipo: 'nomina', empleado, salarioBase, plus, bruto, pIrpf, ssT, irpf, neto, ssE },
        sol: [{ c: '640', d: bruto }, { c: '642', d: ssE }, { c: '4751', h: irpf }, { c: '476', h: r2(ssT + ssE) }, { c: '572', h: neto }],
        expl: `El sueldo bruto es un gasto (640, Debe) y la cuota de la empresa a la Seguridad Social (${SS_EMP} %) es otro gasto (642, Debe). Al trabajador se le retiene IRPF (deuda con Hacienda, 4751) y su cuota de SS (${SS_TRAB} %); las dos cuotas de SS se deben a la Seguridad Social (476, Haber). Por el banco solo sale el líquido a percibir.`,
    });

    // 11 · Liquidación del IVA
    const sumCta = (c, lado) => r2(ops.reduce((s, o) => s + o.sol.filter(l => l.c === c).reduce((a, l) => a + (l[lado] || 0), 0), 0));
    const sop = sumCta('472', 'd'), rep = sumCta('477', 'h');
    const dif = r2(rep - sop);
    ops.push({
        id: 'liquidacion', dia: 31, emoji: '🧮', titulo: 'Liquidación del IVA del mes',
        enunciado: 'Fin de mes: se liquida el IVA (supón liquidación mensual). Se compara el IVA repercutido a los clientes con el IVA soportado en las compras y gastos. Si sale a pagar, se debe a Hacienda; si sale a nuestro favor, Hacienda nos lo debe.',
        doc: { tipo: 'texto', titulo: 'Modelo 303 (borrador)', ocultable: true, lineas: [['IVA repercutido del mes (477)', rep, true], ['IVA soportado del mes (472)', sop, true], [dif >= 0 ? 'Resultado: a ingresar' : 'Resultado: a compensar / devolver', Math.abs(dif), true]] },
        sol: dif >= 0
            ? [{ c: '477', d: rep }, { c: '472', h: sop }, ...(dif > 0 ? [{ c: '4750', h: dif }] : [])]
            : [{ c: '477', d: rep }, { c: '4700', d: -dif }, { c: '472', h: sop }],
        expl: dif >= 0
            ? 'Se cancelan las dos cuentas de IVA: 477 se salda por el Debe y 472 por el Haber. Como el IVA repercutido es mayor que el soportado, la diferencia es una deuda con Hacienda (4750 H.P. acreedora por IVA, Haber).'
            : 'Se cancelan las dos cuentas de IVA: 477 se salda por el Debe y 472 por el Haber. Este mes hemos soportado más IVA del que hemos repercutido (¡por el mobiliario!), así que Hacienda nos debe la diferencia (4700 H.P. deudora por IVA, Debe).',
    });

    // 12 · Inventario final (existencias)
    const inv = stock.map(p => { const quedan = p.uds - p.rest - p.tpv; return { n: `${p.emoji} ${p.nombre}`, uds: quedan, precio: p.coste, base: r2(quedan * p.coste) }; });
    const ef = r2(inv.reduce((s, l) => s + l.base, 0));
    ops.push({
        id: 'inventario', dia: 31, emoji: '📦', titulo: 'Inventario de fin de mes',
        enunciado: 'Se cuenta lo que queda en el almacén y en las estanterías. Las existencias finales se valoran a precio de coste (el precio de compra al mayorista).',
        doc: { tipo: 'inventario', lineas: inv, total: ef },
        sol: [{ c: '300', d: ef }, { c: '610', h: ef }],
        expl: 'Lo que queda sin vender sigue siendo de la empresa: es activo (300 Mercaderías, Debe). La contrapartida es 610 Variación de existencias (Haber), que corrige las compras: el gasto real es solo lo que se ha vendido.',
    });

    // 13 · Regularización
    const saldos = {};
    ops.forEach(o => o.sol.forEach(l => { saldos[l.c] = r2((saldos[l.c] || 0) + (l.d || 0) - (l.h || 0)); }));
    const reg = [];
    Object.keys(saldos).filter(c => CTA[c] && (CTA[c].g === 6 || CTA[c].g === 7) && Math.abs(saldos[c]) > 0.001)
        .sort().forEach(c => { const s = saldos[c]; if (s > 0) reg.push({ c, h: s }); else reg.push({ c, d: -s }); });
    const rD = r2(reg.reduce((s, l) => s + (l.d || 0), 0)), rH = r2(reg.reduce((s, l) => s + (l.h || 0), 0));
    const resultado = r2(rD - rH);
    if (resultado > 0) reg.push({ c: '129', h: resultado }); else if (resultado < 0) reg.push({ c: '129', d: -resultado });
    const solReg = [...reg.filter(l => l.d), ...reg.filter(l => l.h)];
    ops.push({
        id: 'regularizacion', dia: 31, emoji: '📊', titulo: 'Regularización: ¿hemos ganado dinero?',
        enunciado: 'Se cierran todas las cuentas de gastos (grupo 6) e ingresos (grupo 7) contra 129 Resultado del ejercicio. Consulta sus saldos en el Libro Mayor.',
        doc: { tipo: 'texto', titulo: 'Saldos de gastos e ingresos', ocultable: true, lineas: Object.keys(saldos).filter(c => CTA[c] && (CTA[c].g === 6 || CTA[c].g === 7) && Math.abs(saldos[c]) > 0.001).sort().map(c => [`${nombreCta(c)} (saldo ${saldos[c] > 0 ? 'deudor' : 'acreedor'})`, Math.abs(saldos[c]), true]) },
        sol: solReg,
        expl: `Los gastos tienen saldo deudor: se cancelan por el Haber. Los ingresos (y 610, que aquí tiene saldo acreedor) se cancelan por el Debe. La diferencia es el resultado: ${resultado >= 0 ? `beneficio de ${eur(resultado)} (129 al Haber)` : `pérdida de ${eur(-resultado)} (129 al Debe)`}.`,
        resultado,
    });

    return { ops, mes, empleado, resultado };
}

// ─── Validación de un asiento ─────────────────────────────────────────────────
function agregar(lineas) {
    const m = {};
    lineas.forEach(l => {
        if (l.d) m[`${l.c}|D`] = r2((m[`${l.c}|D`] || 0) + l.d);
        if (l.h) m[`${l.c}|H`] = r2((m[`${l.c}|H`] || 0) + l.h);
    });
    return m;
}

function validar(filas, sol) {
    const mensajes = [];
    const estados = filas.map(() => 'neutral');
    const lineas = [];
    filas.forEach((f, i) => {
        const d = parseImporte(f.d), h = parseImporte(f.h);
        const hayD = !isNaN(d) && d !== 0, hayH = !isNaN(h) && h !== 0;
        if (!f.c && !hayD && !hayH) return;
        if (!f.c) { estados[i] = 'mal'; mensajes.push(`Fila ${i + 1}: elige una cuenta.`); return; }
        if (!hayD && !hayH) { estados[i] = 'mal'; mensajes.push(`Fila ${i + 1}: escribe el importe en el Debe o en el Haber.`); return; }
        if (hayD && hayH) { estados[i] = 'mal'; mensajes.push(`Fila ${i + 1}: una misma línea no puede ir al Debe y al Haber a la vez.`); return; }
        if ((hayD && d < 0) || (hayH && h < 0)) { estados[i] = 'mal'; mensajes.push(`Fila ${i + 1}: los importes de un asiento son siempre positivos.`); return; }
        lineas.push({ i, c: f.c, d: hayD ? d : 0, h: hayH ? h : 0 });
    });
    if (!lineas.length) return { ok: false, mensajes: ['El asiento está vacío.'], estados, cuadra: false };
    const tD = r2(lineas.reduce((s, l) => s + l.d, 0)), tH = r2(lineas.reduce((s, l) => s + l.h, 0));
    const cuadra = Math.abs(tD - tH) < TOL;
    if (!cuadra) mensajes.push(`El asiento no cuadra: Debe ${eur(tD)} ≠ Haber ${eur(tH)}. En la partida doble, Debe y Haber deben sumar lo mismo.`);

    const a = agregar(lineas), s = agregar(sol);
    const claveOk = {};
    Object.keys(a).forEach(k => {
        const [c, lado] = k.split('|');
        const otro = `${c}|${lado === 'D' ? 'H' : 'D'}`;
        if (s[k] == null) {
            claveOk[k] = false;
            if (s[otro] != null) mensajes.push(`La cuenta ${nombreCta(c)} va al ${lado === 'D' ? 'Haber' : 'Debe'}, no al ${lado === 'D' ? 'Debe' : 'Haber'}.`);
            else mensajes.push(`La cuenta ${nombreCta(c)} no interviene en esta operación.`);
        } else if (Math.abs(s[k] - a[k]) > TOL) {
            claveOk[k] = false;
            mensajes.push(`El importe de ${nombreCta(c)} (${lado === 'D' ? 'Debe' : 'Haber'}) no es correcto.`);
        } else claveOk[k] = true;
    });
    const faltan = Object.keys(s).filter(k => a[k] == null && a[`${k.split('|')[0]}|${k.endsWith('D') ? 'H' : 'D'}`] == null);
    if (faltan.length) mensajes.push(faltan.length === 1 ? 'Falta una cuenta en el asiento.' : `Faltan ${faltan.length} cuentas en el asiento.`);
    lineas.forEach(l => { const k = `${l.c}|${l.d ? 'D' : 'H'}`; estados[l.i] = claveOk[k] ? 'ok' : 'mal'; });
    const ok = cuadra && !mensajes.length;
    return { ok, mensajes, estados, cuadra };
}

const filasDeSol = sol => sol.map(l => ({ c: l.c, d: l.d ? num(l.d) : '', h: l.h ? num(l.h) : '' }));
const filasVacias = n => Array.from({ length: n }, () => ({ c: '', d: '', h: '' }));

// ─── Estilos ──────────────────────────────────────────────────────────────────
const C = { verde: '#0f766e', verdeClaro: '#ccfbf1', azul: '#1d4ed8', fondo: '#f1f5f9', borde: '#e2e8f0', texto: '#0f172a', gris: '#64748b', debe: '#1d4ed8', haber: '#b45309' };
const card = { background: 'white', borderRadius: 16, border: `1px solid ${C.borde}`, boxShadow: '0 2px 10px rgba(15,23,42,0.05)', padding: 18 };
const btn = (bg, color = 'white') => ({ background: bg, color, border: 'none', borderRadius: 10, padding: '9px 16px', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', fontFamily: 'inherit' });
const th = { textAlign: 'left', padding: '6px 8px', fontSize: '0.75rem', color: C.gris, borderBottom: `1px solid ${C.borde}`, fontWeight: 700, whiteSpace: 'nowrap' };
const td = { padding: '6px 8px', fontSize: '0.86rem', borderBottom: `1px solid #f1f5f9` };
const tdNum = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };

// ─── Documentos de cada operación ─────────────────────────────────────────────
function Documento({ doc, ocultar }) {
    const H = v => ocultar ? <span style={{ color: '#dc2626', fontWeight: 800 }}>¿?</span> : eur(v);
    const caja = { background: '#fffdf5', border: '1px dashed #d6c9a3', borderRadius: 12, padding: 14, fontFamily: "'Courier New', monospace", fontSize: '0.84rem', color: '#3b3424', overflowX: 'auto' };

    if (doc.tipo === 'texto') return (
        <div style={caja}>
            <div style={{ fontWeight: 800, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>{doc.titulo}</div>
            {doc.lineas.map(([t, v, oc], i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '3px 0', borderTop: i === doc.lineas.length - 1 && doc.lineas.length > 1 ? '1px solid #d6c9a3' : 'none' }}>
                    <span>{t}</span>{v != null && <b>{oc && ocultar ? H(v) : eur(v)}</b>}
                </div>
            ))}
        </div>
    );

    if (doc.tipo === 'factura') return (
        <div style={caja}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                <div><div style={{ fontWeight: 800 }}>FACTURA {doc.emitida ? 'EMITIDA' : 'RECIBIDA'} · Nº {doc.numero}</div>
                    <div>De: {doc.emisor}</div><div>Para: {doc.receptor}</div></div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
                <thead><tr><th style={{ ...th, color: '#6b5d3a' }}>Concepto</th>{doc.lineas.some(l => l.uds) && <><th style={{ ...th, color: '#6b5d3a', textAlign: 'right' }}>Uds</th><th style={{ ...th, color: '#6b5d3a', textAlign: 'right' }}>Precio/ud</th></>}<th style={{ ...th, color: '#6b5d3a', textAlign: 'right' }}>Importe</th><th style={{ ...th, color: '#6b5d3a', textAlign: 'right' }}>IVA</th></tr></thead>
                <tbody>{doc.lineas.map((l, i) => (
                    <tr key={i}><td style={td}>{l.n}</td>{doc.lineas.some(x => x.uds) && <><td style={tdNum}>{l.uds}</td><td style={tdNum}>{num(l.precio)}</td></>}<td style={tdNum}>{num(l.base)}</td><td style={tdNum}>{l.tipo} %</td></tr>
                ))}</tbody>
            </table>
            <div style={{ marginTop: 10, borderTop: '1px solid #d6c9a3', paddingTop: 8 }}>
                {doc.desglose.map(d => (
                    <div key={d.tipo} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <span>Base {d.tipo} %: {eur(d.base)}</span><span>Cuota IVA {d.tipo} %: {H(d.cuota)}</span>
                    </div>
                ))}
                {doc.retencion && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Retención IRPF ({doc.retencion.pct} %)</span><span>− {H(doc.retencion.importe)}</span></div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, marginTop: 6, fontSize: '0.95rem' }}><span>{doc.retencion ? 'TOTAL A PAGAR' : 'TOTAL FACTURA'}</span><span>{H(doc.total)}</span></div>
                {doc.pie && <div style={{ marginTop: 6, fontSize: '0.78rem', opacity: 0.8 }}>{doc.pie}</div>}
            </div>
        </div>
    );

    if (doc.tipo === 'luz') return (
        <div style={caja}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>⚡ FACTURA DE ELECTRICIDAD · Suministro local comercial</div>
            {[[`Energía consumida: ${doc.kwh.toLocaleString('es-ES')} kWh × ${doc.precioKwh.toLocaleString('es-ES', { minimumFractionDigits: 3 })} €/kWh`, doc.energia], ['Término de potencia contratada', doc.potencia], ['Impuesto especial sobre la electricidad (5,11 %)', doc.ie], ['Alquiler del contador', doc.contador]].map(([t, v], i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '2px 0' }}><span>{t}</span><span>{eur(v)}</span></div>
            ))}
            <div style={{ borderTop: '1px solid #d6c9a3', marginTop: 6, paddingTop: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Base imponible</span><b>{H(doc.base)}</b></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>IVA 21 %</span><b>{H(doc.iva)}</b></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '0.95rem' }}><span>TOTAL (cargo en cuenta)</span><span>{H(doc.total)}</span></div>
            </div>
        </div>
    );

    if (doc.tipo === 'ticketZ') return (
        <div style={caja}>
            <div style={{ fontWeight: 800, marginBottom: 8, textAlign: 'center' }}>🧾 INFORME Z · VENTAS DEL MES</div>
            <details style={{ marginBottom: 8 }}>
                <summary style={{ cursor: 'pointer' }}>Ver unidades vendidas por producto</summary>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }}>
                    <thead><tr><th style={th}>Producto</th><th style={{ ...th, textAlign: 'right' }}>Uds</th><th style={{ ...th, textAlign: 'right' }}>PVP (IVA incl.)</th><th style={{ ...th, textAlign: 'right' }}>IVA</th></tr></thead>
                    <tbody>{doc.productos.map((p, i) => <tr key={i}><td style={td}>{p.n}</td><td style={tdNum}>{p.uds}</td><td style={tdNum}>{num(p.pvp)}</td><td style={tdNum}>{p.tipo} %</td></tr>)}</tbody>
                </table>
            </details>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>Tipo</th><th style={{ ...th, textAlign: 'right' }}>Total IVA incl.</th><th style={{ ...th, textAlign: 'right' }}>Base</th><th style={{ ...th, textAlign: 'right' }}>Cuota</th></tr></thead>
                <tbody>{doc.tipos.map(t => <tr key={t.tipo}><td style={td}>{t.tipo} %</td><td style={tdNum}>{eur(t.total)}</td><td style={tdNum}>{H(t.base)}</td><td style={tdNum}>{H(t.cuota)}</td></tr>)}</tbody>
            </table>
            <div style={{ borderTop: '1px solid #d6c9a3', marginTop: 6, paddingTop: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}><span>TOTAL VENTAS</span><span>{eur(doc.total)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>💶 Cobrado en efectivo</span><span>{eur(doc.efectivo)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>💳 Cobrado con tarjeta</span><span>{eur(doc.tarjeta)}</span></div>
            </div>
        </div>
    );

    if (doc.tipo === 'nomina') return (
        <div style={caja}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>👩‍💼 RECIBO DE SALARIOS · {doc.empleado}</div>
            <div style={{ fontWeight: 700 }}>I. Devengos</div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Salario base</span><span>{eur(doc.salarioBase)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Plus de transporte</span><span>{eur(doc.plus)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}><span>Total devengado (sueldo bruto)</span><span>{eur(doc.bruto)}</span></div>
            <div style={{ fontWeight: 700, marginTop: 8 }}>II. Deducciones</div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Seguridad Social del trabajador ({String(SS_TRAB).replace('.', ',')} %)</span><span>{H(doc.ssT)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Retención IRPF ({doc.pIrpf} %)</span><span>{H(doc.irpf)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: '1px solid #d6c9a3', marginTop: 6, paddingTop: 6 }}><span>LÍQUIDO A PERCIBIR</span><span>{H(doc.neto)}</span></div>
            <div style={{ marginTop: 8, fontSize: '0.8rem', background: '#f5efdc', borderRadius: 8, padding: 8 }}>Aportación de la empresa a la Seguridad Social ({SS_EMP} % del bruto): <b>{H(doc.ssE)}</b></div>
        </div>
    );

    if (doc.tipo === 'inventario') return (
        <div style={caja}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>📦 HOJA DE INVENTARIO (a precio de coste)</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 360 }}>
                <thead><tr><th style={th}>Producto</th><th style={{ ...th, textAlign: 'right' }}>Uds</th><th style={{ ...th, textAlign: 'right' }}>Coste/ud</th><th style={{ ...th, textAlign: 'right' }}>Valor</th></tr></thead>
                <tbody>{doc.lineas.map((l, i) => <tr key={i}><td style={td}>{l.n}</td><td style={tdNum}>{l.uds}</td><td style={tdNum}>{num(l.precio)}</td><td style={tdNum}>{H(l.base)}</td></tr>)}</tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, marginTop: 8 }}><span>EXISTENCIAS FINALES</span><span>{H(doc.total)}</span></div>
        </div>
    );
    return null;
}

// ─── Editor de asiento ────────────────────────────────────────────────────────
function SelectorCuenta({ value, onChange, limitar }) {
    const lista = limitar ? CUENTAS.filter(c => limitar.includes(c.c)) : CUENTAS;
    const grupos = [...new Set(lista.map(c => c.g))];
    return (
        <select value={value} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '8px 6px', borderRadius: 8, border: `1px solid ${C.borde}`, fontSize: '0.85rem', background: 'white', fontFamily: 'inherit', minWidth: 0 }}>
            <option value="">— Elige cuenta —</option>
            {grupos.map(g => (
                <optgroup key={g} label={GRUPOS[g]}>
                    {lista.filter(c => c.g === g).map(c => <option key={c.c} value={c.c}>{c.c} · {c.n}</option>)}
                </optgroup>
            ))}
        </select>
    );
}

export function EditorAsiento({ filas, setFilas, estados, bloqueado, cuentas }) {
    const set = (i, campo, v) => setFilas(filas.map((f, j) => j === i ? { ...f, [campo]: v } : f));
    const tD = r2(filas.reduce((s, f) => s + (parseImporte(f.d) || 0), 0));
    const tH = r2(filas.reduce((s, f) => s + (parseImporte(f.h) || 0), 0));
    const inp = { width: '100%', padding: '8px 6px', borderRadius: 8, border: `1px solid ${C.borde}`, textAlign: 'right', fontSize: '0.9rem', fontFamily: 'inherit', boxSizing: 'border-box', minWidth: 0 };
    const colorFila = e => e === 'ok' ? '#dcfce7' : e === 'mal' ? '#fee2e2' : 'transparent';
    return (
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2.4fr) minmax(0,1fr) minmax(0,1fr) 28px', gap: 6, fontSize: '0.75rem', fontWeight: 800, color: C.gris, marginBottom: 4, padding: '0 4px' }}>
                <span>Cuenta</span><span style={{ textAlign: 'right', color: C.debe }}>DEBE</span><span style={{ textAlign: 'right', color: C.haber }}>HABER</span><span />
            </div>
            {filas.map((f, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2.4fr) minmax(0,1fr) minmax(0,1fr) 28px', gap: 6, alignItems: 'center', background: colorFila(estados?.[i]), borderRadius: 10, padding: 4, marginBottom: 3 }}>
                    {bloqueado ? <div style={{ fontSize: '0.86rem', padding: '8px 4px', paddingLeft: f.h ? 22 : 4 }}>{f.h ? 'a ' : ''}{nombreCta(f.c)}</div>
                        : <SelectorCuenta value={f.c} onChange={v => set(i, 'c', v)} limitar={cuentas} />}
                    <input disabled={bloqueado} inputMode="decimal" value={f.d} onChange={e => set(i, 'd', e.target.value)} placeholder="0,00" style={{ ...inp, borderColor: f.d ? C.debe : C.borde }} />
                    <input disabled={bloqueado} inputMode="decimal" value={f.h} onChange={e => set(i, 'h', e.target.value)} placeholder="0,00" style={{ ...inp, borderColor: f.h ? C.haber : C.borde }} />
                    {!bloqueado ? <button title="Quitar fila" onClick={() => setFilas(filas.length > 1 ? filas.filter((_, j) => j !== i) : filasVacias(1))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '1rem', padding: 0 }}>✕</button> : <span />}
                </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2.4fr) minmax(0,1fr) minmax(0,1fr) 28px', gap: 6, padding: '6px 4px', borderTop: `2px solid ${C.borde}`, marginTop: 4, fontWeight: 800, fontSize: '0.88rem' }}>
                <span>{!bloqueado && <button onClick={() => setFilas([...filas, { c: '', d: '', h: '' }])} style={{ ...btn('#e2e8f0', C.texto), padding: '5px 10px', fontSize: '0.8rem' }}>＋ Añadir fila</button>}</span>
                <span style={{ textAlign: 'right', color: C.debe }}>{num(tD)}</span>
                <span style={{ textAlign: 'right', color: C.haber }}>{num(tH)}</span>
                <span title={Math.abs(tD - tH) < TOL && tD > 0 ? 'Cuadra' : 'No cuadra'}>{tD > 0 || tH > 0 ? (Math.abs(tD - tH) < TOL ? '⚖️' : '❗') : ''}</span>
            </div>
        </div>
    );
}

// ─── Libros ───────────────────────────────────────────────────────────────────
function LibroDiario({ hechos }) {
    if (!hechos.length) return <Vacio />;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {hechos.map(({ op, n }) => {
                const lineas = [...op.sol.filter(l => l.d), ...op.sol.filter(l => l.h)];
                return (
                    <div key={op.id} style={{ ...card, padding: 0, overflowX: 'auto' }}>
                        <div style={{ padding: '8px 14px', background: '#f8fafc', borderBottom: `1px solid ${C.borde}`, fontSize: '0.8rem', fontWeight: 800, color: C.gris, display: 'flex', justifyContent: 'space-between' }}>
                            <span>Asiento nº {n}</span><span>{op.fecha}</span>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
                            <tbody>{lineas.map((l, i) => (
                                <tr key={i}>
                                    <td style={{ ...tdNum, width: 110, color: C.debe }}>{l.d ? num(l.d) : ''}</td>
                                    <td style={{ ...td, paddingLeft: l.h ? 40 : 8 }}>{l.h ? 'a ' : ''}<b>({l.c})</b> {CTA[l.c]?.n}</td>
                                    <td style={{ ...tdNum, width: 110, color: C.haber }}>{l.h ? num(l.h) : ''}</td>
                                </tr>
                            ))}</tbody>
                        </table>
                        <div style={{ padding: '6px 14px', fontSize: '0.78rem', color: C.gris, fontStyle: 'italic' }}>{op.titulo}</div>
                    </div>
                );
            })}
        </div>
    );
}

function calcMayor(hechos) {
    const m = {};
    hechos.forEach(({ op, n }) => op.sol.forEach(l => {
        m[l.c] = m[l.c] || { d: [], h: [] };
        if (l.d) m[l.c].d.push({ n, v: l.d });
        if (l.h) m[l.c].h.push({ n, v: l.h });
    }));
    return Object.keys(m).sort().map(c => {
        const sd = r2(m[c].d.reduce((s, x) => s + x.v, 0)), sh = r2(m[c].h.reduce((s, x) => s + x.v, 0));
        return { c, ...m[c], sd, sh, saldo: r2(sd - sh) };
    });
}

function LibroMayor({ hechos }) {
    if (!hechos.length) return <Vacio />;
    const mayor = calcMayor(hechos);
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {mayor.map(cta => (
                <div key={cta.c} style={{ ...card, padding: 12 }}>
                    <div style={{ textAlign: 'center', fontWeight: 800, fontSize: '0.85rem', borderBottom: `2px solid ${C.texto}`, paddingBottom: 4 }}>{cta.c} · {CTA[cta.c]?.n}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', fontSize: '0.8rem' }}>
                        <div style={{ borderRight: `2px solid ${C.texto}`, padding: '4px 6px', minHeight: 40 }}>
                            <div style={{ color: C.debe, fontWeight: 800, fontSize: '0.7rem' }}>DEBE</div>
                            {cta.d.map((x, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.gris }}>({x.n})</span><span>{num(x.v)}</span></div>)}
                        </div>
                        <div style={{ padding: '4px 6px' }}>
                            <div style={{ color: C.haber, fontWeight: 800, fontSize: '0.7rem', textAlign: 'right' }}>HABER</div>
                            {cta.h.map((x, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.gris }}>({x.n})</span><span>{num(x.v)}</span></div>)}
                        </div>
                    </div>
                    <div style={{ borderTop: `1px solid ${C.borde}`, marginTop: 4, paddingTop: 4, fontSize: '0.8rem', textAlign: 'center', fontWeight: 700, color: Math.abs(cta.saldo) < 0.005 ? C.gris : cta.saldo > 0 ? C.debe : C.haber }}>
                        {Math.abs(cta.saldo) < 0.005 ? 'Saldada (saldo 0)' : `Saldo ${cta.saldo > 0 ? 'deudor' : 'acreedor'}: ${eur(Math.abs(cta.saldo))}`}
                    </div>
                </div>
            ))}
        </div>
    );
}

function BalanceComprobacion({ hechos }) {
    if (!hechos.length) return <Vacio />;
    const mayor = calcMayor(hechos);
    const tot = mayor.reduce((t, c) => ({ sd: t.sd + c.sd, sh: t.sh + c.sh, d: t.d + Math.max(0, c.saldo), a: t.a + Math.max(0, -c.saldo) }), { sd: 0, sh: 0, d: 0, a: 0 });
    return (
        <div style={{ ...card, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                <thead><tr><th style={th}>Cuenta</th><th style={{ ...th, textAlign: 'right' }}>Suma Debe</th><th style={{ ...th, textAlign: 'right' }}>Suma Haber</th><th style={{ ...th, textAlign: 'right' }}>Saldo deudor</th><th style={{ ...th, textAlign: 'right' }}>Saldo acreedor</th></tr></thead>
                <tbody>
                    {mayor.map(c => (
                        <tr key={c.c}><td style={td}><b>{c.c}</b> {CTA[c.c]?.n}</td><td style={tdNum}>{num(c.sd)}</td><td style={tdNum}>{num(c.sh)}</td><td style={tdNum}>{c.saldo > 0.004 ? num(c.saldo) : ''}</td><td style={tdNum}>{c.saldo < -0.004 ? num(-c.saldo) : ''}</td></tr>
                    ))}
                    <tr style={{ fontWeight: 800 }}><td style={td}>TOTALES</td><td style={tdNum}>{num(tot.sd)}</td><td style={tdNum}>{num(tot.sh)}</td><td style={tdNum}>{num(tot.d)}</td><td style={tdNum}>{num(tot.a)}</td></tr>
                </tbody>
            </table>
            <div style={{ marginTop: 10, fontSize: '0.84rem', color: Math.abs(tot.sd - tot.sh) < 0.01 ? '#15803d' : '#dc2626', fontWeight: 700 }}>
                {Math.abs(tot.sd - tot.sh) < 0.01 ? '⚖️ Las sumas del Debe y del Haber coinciden: la contabilidad cuadra.' : '❗ Las sumas no coinciden.'}
            </div>
        </div>
    );
}

function Resultados({ hechos, ops, completo }) {
    const sinReg = hechos.filter(h => h.op.id !== 'regularizacion');
    if (!sinReg.length) return <Vacio />;
    const mayor = calcMayor(sinReg);
    const gastos = mayor.filter(c => CTA[c.c]?.g === 6 && Math.abs(c.saldo) > 0.004);
    const ingresos = mayor.filter(c => CTA[c.c]?.g === 7 && Math.abs(c.saldo) > 0.004);
    const tG = r2(gastos.reduce((s, c) => s + c.saldo, 0)), tI = r2(ingresos.reduce((s, c) => s - c.saldo, 0));
    const res = r2(tI - tG);

    // IVA por tipos (desde los documentos)
    const ivaTipos = { 4: { rep: 0, sop: 0 }, 10: { rep: 0, sop: 0 }, 21: { rep: 0, sop: 0 } };
    sinReg.forEach(({ op }) => {
        const d = op.doc;
        if (d.tipo === 'factura') d.desglose.forEach(x => { ivaTipos[x.tipo][d.emitida ? 'rep' : 'sop'] += x.cuota; });
        if (d.tipo === 'ticketZ') d.tipos.forEach(x => { ivaTipos[x.tipo].rep += x.cuota; });
        if (d.tipo === 'luz') ivaTipos[21].sop += d.iva;
    });

    const fin = completo ? calcMayor(hechos) : null;
    const activo = fin ? fin.filter(c => CTA[c.c]?.t === 'A' && Math.abs(c.saldo) > 0.004) : [];
    const pasivo = fin ? fin.filter(c => (CTA[c.c]?.t === 'P' || CTA[c.c]?.t === 'PN') && Math.abs(c.saldo) > 0.004) : [];
    const tA = r2(activo.reduce((s, c) => s + c.saldo, 0)), tP = r2(pasivo.reduce((s, c) => s - c.saldo, 0));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ ...card }}>
                <h3 style={{ margin: '0 0 10px', color: C.verde }}>📊 Cuenta de pérdidas y ganancias</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                    <div>
                        <div style={{ fontWeight: 800, color: '#15803d', marginBottom: 4 }}>Ingresos</div>
                        {ingresos.map(c => <div key={c.c} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem' }}><span>{c.c} {CTA[c.c].n}</span><span>{num(-c.saldo)}</span></div>)}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: `1px solid ${C.borde}`, marginTop: 4 }}><span>Total ingresos</span><span>{eur(tI)}</span></div>
                    </div>
                    <div>
                        <div style={{ fontWeight: 800, color: '#dc2626', marginBottom: 4 }}>Gastos</div>
                        {gastos.map(c => <div key={c.c} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem' }}><span>{c.c} {CTA[c.c].n}</span><span>{c.saldo < 0 ? '−' : ''}{num(Math.abs(c.saldo))}</span></div>)}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: `1px solid ${C.borde}`, marginTop: 4 }}><span>Total gastos</span><span>{eur(tG)}</span></div>
                    </div>
                </div>
                <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: res >= 0 ? '#dcfce7' : '#fee2e2', fontWeight: 800, textAlign: 'center', color: res >= 0 ? '#166534' : '#991b1b' }}>
                    {res >= 0 ? `✅ Beneficio del mes: ${eur(res)}` : `🔻 Pérdida del mes: ${eur(-res)}`}
                    {!completo && <div style={{ fontSize: '0.75rem', fontWeight: 600, opacity: 0.8 }}>Provisional: aún quedan asientos por hacer.</div>}
                </div>
            </div>

            <div style={{ ...card, overflowX: 'auto' }}>
                <h3 style={{ margin: '0 0 10px', color: C.verde }}>🧾 IVA del mes por tipos</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 380 }}>
                    <thead><tr><th style={th}>Tipo</th><th style={{ ...th, textAlign: 'right' }}>Repercutido (477)</th><th style={{ ...th, textAlign: 'right' }}>Soportado (472)</th></tr></thead>
                    <tbody>{[4, 10, 21].map(t => <tr key={t}><td style={td}>{t === 4 ? 'Superreducido 4 %' : t === 10 ? 'Reducido 10 %' : 'General 21 %'}</td><td style={tdNum}>{num(ivaTipos[t].rep)}</td><td style={tdNum}>{num(ivaTipos[t].sop)}</td></tr>)}</tbody>
                </table>
            </div>

            {completo && (
                <div style={{ ...card, overflowX: 'auto' }}>
                    <h3 style={{ margin: '0 0 10px', color: C.verde }}>🏛️ Balance de situación a fin de mes</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                        <div>
                            <div style={{ fontWeight: 800, color: C.debe, marginBottom: 4 }}>ACTIVO (lo que tiene)</div>
                            {activo.map(c => <div key={c.c} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem' }}><span>{c.c} {CTA[c.c].n}</span><span>{num(c.saldo)}</span></div>)}
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: `1px solid ${C.borde}`, marginTop: 4 }}><span>Total activo</span><span>{eur(tA)}</span></div>
                        </div>
                        <div>
                            <div style={{ fontWeight: 800, color: C.haber, marginBottom: 4 }}>PATRIMONIO NETO Y PASIVO (de dónde sale)</div>
                            {pasivo.map(c => <div key={c.c} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem' }}><span>{c.c} {CTA[c.c].n}</span><span>{num(-c.saldo)}</span></div>)}
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: `1px solid ${C.borde}`, marginTop: 4 }}><span>Total PN + pasivo</span><span>{eur(tP)}</span></div>
                        </div>
                    </div>
                    <div style={{ marginTop: 10, fontSize: '0.84rem', fontWeight: 700, color: Math.abs(tA - tP) < 0.01 ? '#15803d' : '#dc2626' }}>
                        {Math.abs(tA - tP) < 0.01 ? '⚖️ Activo = Patrimonio neto + Pasivo. ¡El balance cuadra!' : '❗ El balance no cuadra.'}
                    </div>
                </div>
            )}
        </div>
    );
}

const Vacio = () => <div style={{ ...card, textAlign: 'center', color: C.gris }}>Todavía no hay asientos completados. Ve a la pestaña «Asientos».</div>;

// ─── Teoría ───────────────────────────────────────────────────────────────────
function Aprende() {
    const fila = (a, b, c, color) => <tr><td style={{ ...td, fontWeight: 700, color }}>{a}</td><td style={td}>{b}</td><td style={td}>{c}</td></tr>;
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
            <div style={card}>
                <h3 style={{ marginTop: 0, color: C.verde }}>⚖️ La partida doble</h3>
                <p style={{ fontSize: '0.92rem', lineHeight: 1.5 }}>Cada operación se anota en el <b>Libro Diario</b> con un <b>asiento</b>: al menos dos cuentas, unas en el <b style={{ color: C.debe }}>Debe</b> (columna izquierda) y otras en el <b style={{ color: C.haber }}>Haber</b> (columna derecha).</p>
                <p style={{ fontSize: '0.92rem', lineHeight: 1.5, margin: 0 }}>Regla de oro: <b>la suma del Debe es igual a la del Haber</b>. «No hay deudor sin acreedor».</p>
            </div>
            <div style={{ ...card, overflowX: 'auto' }}>
                <h3 style={{ marginTop: 0, color: C.verde }}>📌 ¿Debe o Haber?</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr><th style={th}>Tipo de cuenta</th><th style={th}>Aumenta</th><th style={th}>Disminuye</th></tr></thead>
                    <tbody>
                        {fila('Activo (bienes y derechos)', 'Debe', 'Haber', C.debe)}
                        {fila('Pasivo (deudas)', 'Haber', 'Debe', C.haber)}
                        {fila('Patrimonio neto', 'Haber', 'Debe', C.haber)}
                        {fila('Gastos (grupo 6)', 'Debe', '—', '#dc2626')}
                        {fila('Ingresos (grupo 7)', 'Haber', '—', '#15803d')}
                    </tbody>
                </table>
            </div>
            <div style={{ ...card, overflowX: 'auto' }}>
                <h3 style={{ marginTop: 0, color: C.verde }}>🛒 El IVA en el supermercado</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                        <tr><td style={{ ...td, fontWeight: 800 }}>4 %</td><td style={td}>{PRODUCTOS.filter(p => p.iva === 4).map(p => p.emoji + ' ' + p.nombre).join(', ')}</td></tr>
                        <tr><td style={{ ...td, fontWeight: 800 }}>10 %</td><td style={td}>{PRODUCTOS.filter(p => p.iva === 10).map(p => p.emoji + ' ' + p.nombre).join(', ')}</td></tr>
                        <tr><td style={{ ...td, fontWeight: 800 }}>21 %</td><td style={td}>{PRODUCTOS_21.map(p => p.emoji + ' ' + p.nombre).join(', ')}, 💡 electricidad, 🏬 alquiler del local</td></tr>
                    </tbody>
                </table>
                <p style={{ fontSize: '0.86rem', lineHeight: 1.5, marginBottom: 0 }}><b>IVA soportado (472)</b>: el que nos cobran al comprar → Hacienda nos lo debe (Debe).<br /><b>IVA repercutido (477)</b>: el que cobramos al vender → se lo debemos a Hacienda (Haber).<br />Precio con IVA incluido → <b>base = total ÷ (1 + tipo)</b>, p. ej. 5,50 € al 10 % → 5,50 ÷ 1,10 = 5,00 €.</p>
            </div>
            <div style={card}>
                <h3 style={{ marginTop: 0, color: C.verde }}>👩‍💼 La nómina</h3>
                <ul style={{ fontSize: '0.88rem', lineHeight: 1.6, paddingLeft: 18, margin: 0 }}>
                    <li><b>Sueldo bruto</b> (640): todo lo que gana el trabajador.</li>
                    <li>Se le descuenta su <b>Seguridad Social</b> (≈ {String(SS_TRAB).replace('.', ',')} %) y la <b>retención de IRPF</b> (4751).</li>
                    <li><b>Líquido a percibir</b>: lo que cobra en el banco.</li>
                    <li>La empresa paga además su <b>SS</b> (≈ {SS_EMP} %, cuenta 642). Las dos cuotas de SS se deben a la Seguridad Social (476).</li>
                </ul>
            </div>
            <div style={{ ...card, gridColumn: '1 / -1' }}>
                <h3 style={{ marginTop: 0, color: C.verde }}>📚 Cuentas que vas a usar</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 4, fontSize: '0.84rem' }}>
                    {CUENTAS.map(c => <div key={c.c}><b>{c.c}</b> {c.n} <span style={{ color: C.gris, fontSize: '0.72rem' }}>({{ A: 'activo', P: 'pasivo', PN: 'patrimonio neto', G: 'gasto', I: 'ingreso' }[c.t]})</span></div>)}
                </div>
                <p style={{ fontSize: '0.75rem', color: C.gris, marginBottom: 0 }}>Tipos de IVA según la Ley 37/1992; cotizaciones de la Seguridad Social simplificadas. Algunos tipos de IVA de alimentos han cambiado temporalmente en los últimos años: consulta la normativa vigente.</p>
            </div>
        </div>
    );
}

// ─── Mini-juego ¿Debe o Haber? ────────────────────────────────────────────────
const QUIZ = [
    { m: 'Compramos mercaderías a crédito', c: '600', r: 'D', p: 'Es un gasto: los gastos van al Debe.' },
    { m: 'Compramos mercaderías a crédito', c: '400', r: 'H', p: 'Nace una deuda (pasivo): aumenta por el Haber.' },
    { m: 'Cobramos en efectivo una venta', c: '570', r: 'D', p: 'Entra dinero en caja (activo): Debe.' },
    { m: 'Cobramos en efectivo una venta', c: '700', r: 'H', p: 'Es un ingreso: los ingresos van al Haber.' },
    { m: 'IVA que nos cobra el mayorista', c: '472', r: 'D', p: 'IVA soportado: Hacienda nos lo debe (derecho, Debe).' },
    { m: 'IVA que cobramos a los clientes', c: '477', r: 'H', p: 'IVA repercutido: se lo debemos a Hacienda (Haber).' },
    { m: 'Pagamos la luz por banco', c: '628', r: 'D', p: 'Suministros es un gasto: Debe.' },
    { m: 'Pagamos la luz por banco', c: '572', r: 'H', p: 'Sale dinero del banco (disminuye un activo): Haber.' },
    { m: 'Sueldo bruto del empleado', c: '640', r: 'D', p: 'Es un gasto de personal: Debe.' },
    { m: 'Retención de IRPF de la nómina', c: '4751', r: 'H', p: 'La debemos ingresar a Hacienda: deuda, Haber.' },
    { m: 'Cuotas de la SS pendientes de pagar', c: '476', r: 'H', p: 'Deuda con la Seguridad Social: Haber.' },
    { m: 'Seguridad Social a cargo de la empresa', c: '642', r: 'D', p: 'Es un gasto de la empresa: Debe.' },
    { m: 'Los socios aportan dinero al crear la empresa', c: '100', r: 'H', p: 'El capital es patrimonio neto: aumenta por el Haber.' },
    { m: 'Compramos estanterías para la tienda', c: '216', r: 'D', p: 'Mobiliario (inmovilizado, activo) que aumenta: Debe.' },
    { m: 'Pagamos al proveedor lo que le debíamos', c: '400', r: 'D', p: 'La deuda disminuye: el pasivo disminuye por el Debe.' },
    { m: 'Un cliente nos paga lo que nos debía', c: '430', r: 'H', p: 'El derecho de cobro desaparece: el activo disminuye por el Haber.' },
    { m: 'Ingresamos el efectivo de la caja en el banco', c: '572', r: 'D', p: 'Aumenta el dinero en el banco: Debe.' },
    { m: 'Ingresamos el efectivo de la caja en el banco', c: '570', r: 'H', p: 'Disminuye el dinero en caja: Haber.' },
    { m: 'Pagamos el alquiler del local', c: '621', r: 'D', p: 'Arrendamientos es un gasto: Debe.' },
    { m: 'Vendemos a crédito a un restaurante', c: '430', r: 'D', p: 'Nace un derecho de cobro (activo): Debe.' },
    { m: 'Al hacer inventario quedan productos sin vender', c: '300', r: 'D', p: 'Las existencias son activo: Debe.' },
];

// ─── PRIMEROS PASOS (para quien nunca ha hecho contabilidad) ──────────────────
const PASOS_KEY = 'pikt_contab_pasos';
const barajar = a => [...a].sort(() => Math.random() - 0.5);
const rr = (a, b) => a + Math.random() * (b - a);
const riR = (a, b) => Math.floor(rr(a, b + 1));
const TIPO_TXT = { A: 'Activo', P: 'Pasivo', PN: 'Patrimonio neto', G: 'Gasto', I: 'Ingreso' };
const TIPO_COLOR = { A: '#2563eb', P: '#ea580c', PN: '#7c3aed', G: '#dc2626', I: '#16a34a' };

const TIPOS_PAT = [
    { v: 'A', label: '🟦 Activo', sub: 'lo que tengo o me deben' },
    { v: 'P', label: '🟧 Pasivo', sub: 'lo que debo a otros' },
    { v: 'PN', label: '🟪 Patrimonio neto', sub: 'lo que pusieron los dueños' },
    { v: 'G', label: '🟥 Gasto', sub: 'lo que consumo para funcionar' },
    { v: 'I', label: '🟩 Ingreso', sub: 'lo que gano al vender' },
];
const ELEMENTOS = [
    ['💶 El dinero de la caja registradora', 'A', 'Es dinero que tiene la empresa: activo.'],
    ['🏦 El dinero de la cuenta del banco', 'A', 'Es dinero de la empresa guardado en el banco: activo.'],
    ['🗄️ Las estanterías de la tienda', 'A', 'Es un bien que tiene la empresa y usa durante años: activo.'],
    ['📦 Los productos que quedan en el almacén', 'A', 'Son mercaderías que tiene la empresa: activo.'],
    ['🍽️ Lo que nos debe un restaurante al que vendimos', 'A', 'Es un derecho de cobro: nos lo van a pagar. Lo que nos deben es activo.'],
    ['🖥️ El ordenador de la caja', 'A', 'Es un bien de la empresa: activo.'],
    ['🚚 Lo que debemos al mayorista', 'P', 'Es una deuda: tendremos que pagarla. Lo que debemos es pasivo.'],
    ['🏛️ Un préstamo que nos dio el banco', 'P', 'Hay que devolverlo: es una deuda, pasivo.'],
    ['🧾 Los impuestos que debemos a Hacienda', 'P', 'Es una deuda con Hacienda: pasivo.'],
    ['👷 La cuota de la Seguridad Social pendiente de pagar', 'P', 'Es una deuda con la Seguridad Social: pasivo.'],
    ['🤝 El dinero que pusieron los socios al crear el súper', 'PN', 'Es la aportación de los dueños (capital): patrimonio neto.'],
    ['💡 La factura de la luz', 'G', 'Consumimos electricidad para poder funcionar: es un gasto.'],
    ['👩‍💼 El sueldo del empleado', 'G', 'Pagar al personal es un gasto.'],
    ['🏬 El alquiler del local', 'G', 'Pagar por usar el local es un gasto.'],
    ['🛒 Las compras de leche para venderla', 'G', 'En contabilidad las compras de mercaderías se anotan como gasto (cuenta 600).'],
    ['🥖 Lo que cobramos por vender pan', 'I', 'Vender es la forma de ganar dinero: ingreso.'],
    ['🧾 Lo que facturamos al restaurante por sus cajas de fruta', 'I', 'Es una venta: ingreso.'],
];
const MOVS = [
    ['Vendemos y cobramos en efectivo.', '💶 Caja', 'up', 'Entra dinero en la caja: aumenta.'],
    ['Pagamos la luz con la tarjeta del banco.', '🏦 Bancos', 'down', 'Sale dinero del banco: disminuye.'],
    ['Compramos al mayorista y le pagaremos el mes que viene.', '🚚 Proveedores (lo que debemos)', 'up', 'Ahora debemos más dinero: la deuda aumenta.'],
    ['Pagamos al mayorista lo que le debíamos.', '🚚 Proveedores (lo que debemos)', 'down', 'Ya no se lo debemos: la deuda disminuye.'],
    ['El restaurante nos paga lo que nos debía.', '🍽️ Clientes (lo que nos deben)', 'down', 'Ya no nos debe nada: lo que nos deben disminuye.'],
    ['Vendemos al restaurante y nos pagará más tarde.', '🍽️ Clientes (lo que nos deben)', 'up', 'Ahora nos deben más: aumenta.'],
    ['Llevamos dinero de la caja al banco.', '💶 Caja', 'down', 'El dinero sale de la caja: disminuye.'],
    ['Llevamos dinero de la caja al banco.', '🏦 Bancos', 'up', 'El dinero entra en el banco: aumenta.'],
    ['Compramos unas estanterías nuevas.', '🗄️ Mobiliario', 'up', 'Tenemos más muebles: aumenta.'],
    ['Devolvemos una parte del préstamo al banco.', '🏛️ Préstamo del banco', 'down', 'Debemos menos: la deuda disminuye.'],
    ['Sacamos dinero del banco para tener cambio en la caja.', '🏦 Bancos', 'down', 'Sale dinero del banco: disminuye.'],
    ['Los socios aportan más dinero a la empresa.', '🤝 Capital', 'up', 'Los dueños han puesto más: el capital aumenta.'],
];
const SOP_REP = [
    ['El mayorista nos vende leche y nos cobra IVA. Ese IVA es…', 'S'],
    ['Pagamos la factura de la luz, que lleva IVA. Ese IVA es…', 'S'],
    ['Compramos estanterías y la factura lleva IVA. Ese IVA es…', 'S'],
    ['Vendemos pan a un cliente y le cobramos el IVA. Ese IVA es…', 'R'],
    ['Facturamos al restaurante con IVA. Ese IVA es…', 'R'],
];
const EXPL_TIPO = {
    4: 'Los alimentos de primera necesidad (pan, leche, huevos, queso, frutas, verduras, arroz, aceite de oliva…) llevan el 4 % (superreducido).',
    10: 'El resto de alimentos y el agua llevan el 10 % (reducido).',
    21: 'Lo que no es alimento (limpieza, higiene, papelería) y las bebidas azucaradas o con alcohol llevan el 21 % (general).',
};
const opcionesEur = (correcta, malas) => barajar([correcta, ...malas.filter(m => Math.abs(m - correcta) > 0.004 && m > 0)].filter((v, i, a) => a.findIndex(x => Math.abs(x - v) < 0.004) === i).slice(0, 4)).map(v => ({ v, label: eur(v) }));

function preguntasIva() {
    const todos = [...PRODUCTOS, ...PRODUCTOS_21];
    const qs = [];
    barajar(todos).slice(0, 3).forEach(p => qs.push({
        pregunta: '¿Qué tipo de IVA lleva este producto?', texto: `${p.emoji} ${p.nombre}`,
        opciones: [4, 10, 21].map(t => ({ v: t, label: `${t} %`, sub: t === 4 ? 'superreducido' : t === 10 ? 'reducido' : 'general' })), ok: p.iva, expl: EXPL_TIPO[p.iva],
    }));
    barajar(SOP_REP).slice(0, 2).forEach(([t, v]) => qs.push({
        pregunta: t, texto: '🧾 IVA',
        opciones: [{ v: 'S', label: 'IVA soportado (472)', sub: 'el que pagamos al comprar' }, { v: 'R', label: 'IVA repercutido (477)', sub: 'el que cobramos al vender' }], ok: v,
        expl: v === 'S' ? 'Cuando el súper COMPRA y le cobran IVA, es IVA soportado: Hacienda nos lo descontará.' : 'Cuando el súper VENDE y cobra IVA al cliente, es IVA repercutido: se lo debemos dar a Hacienda.',
    }));
    barajar(todos).slice(0, 3).forEach(p => {
        const uds = riR(2, 12), precio = r2(p.precio / 100 / (1 + p.iva / 100)), base = r2(uds * precio), cuota = r2(base * p.iva / 100);
        const otro = p.iva === 21 ? 10 : 21;
        qs.push({
            pregunta: `Compramos ${uds} uds de ${p.nombre.toLowerCase()} a ${eur(precio)} cada una (sin IVA). El IVA es del ${p.iva} %. ¿Cuánto es el IVA?`, texto: `${p.emoji} ${uds} × ${eur(precio)}`,
            opciones: opcionesEur(cuota, [r2(base * otro / 100), r2(base + cuota), r2(precio * p.iva / 100)]), ok: cuota,
            expl: `Primero la base: ${uds} × ${num(precio)} = ${num(base)} €. Después el IVA: ${num(base)} × ${p.iva} ÷ 100 = ${num(cuota)} €.`,
        });
    });
    barajar(todos).slice(0, 2).forEach(p => {
        const uds = riR(2, 10), total = r2(uds * p.precio / 100), base = r2(total / (1 + p.iva / 100));
        const otro = p.iva === 4 ? 21 : 4;
        qs.push({
            pregunta: `En el ticket pone ${eur(total)} por ${uds} uds de ${p.nombre.toLowerCase()}, con el IVA del ${p.iva} % ya incluido. ¿Cuál es el precio SIN IVA?`, texto: `${p.emoji} ${eur(total)} (IVA incluido)`,
            opciones: opcionesEur(base, [r2(total * (1 - p.iva / 100)), r2(total / (1 + otro / 100)), r2(total * (1 + p.iva / 100))]), ok: base,
            expl: `Con IVA del ${p.iva} % pagas el ${100 + p.iva} % del precio, así que se divide: ${num(total)} ÷ ${(1 + p.iva / 100).toLocaleString('es-ES')} = ${num(base)} €. ¡No vale restar el ${p.iva} %!`,
        });
    });
    return qs;
}

function asientosGuiados() {
    const p4 = barajar(PRODUCTOS.filter(p => p.iva === 4))[0], p10 = barajar(PRODUCTOS.filter(p => p.iva === 10))[0], p4b = barajar(PRODUCTOS.filter(p => p.iva === 4 && p !== p4))[0];
    const x1 = riR(5, 40) * 10, x2 = riR(6, 50) * 10, x3 = riR(8, 25) * 10, x4 = riR(2, 9) * 100, x5 = riR(10, 60) * 10;
    const b6 = riR(20, 80) * 10, i6 = r2(b6 * 0.10), b7 = riR(10, 40) * 10, i7 = r2(b7 * 0.04);
    return [
        { t: `Compramos ${p4.nombre.toLowerCase()} al mayorista por ${eur(x1)} y lo pagamos en efectivo, con dinero de la caja.`, nota: 'Para empezar, sin IVA. Ya te damos las cuentas: solo tienes que poner el importe en el Debe o en el Haber.', sol: [{ c: '600', d: x1 }, { c: '570', h: x1 }], fijas: true },
        { t: `Vendemos productos y cobramos ${eur(x2)} en efectivo.`, nota: 'Sin IVA. Las cuentas ya están puestas.', sol: [{ c: '570', d: x2 }, { c: '700', h: x2 }], fijas: true },
        { t: `Pagamos la factura de la luz, ${eur(x3)}, con el banco.`, nota: 'Sin IVA. Las cuentas ya están puestas.', sol: [{ c: '628', d: x3 }, { c: '572', h: x3 }], fijas: true },
        { t: `Llevamos ${eur(x4)} de la caja al banco.`, nota: 'Las cuentas ya están puestas. ¿Cuál aumenta y cuál disminuye?', sol: [{ c: '572', d: x4 }, { c: '570', h: x4 }], fijas: true },
        { t: `Compramos ${p10.nombre.toLowerCase()} al mayorista por ${eur(x5)}. Se lo pagaremos dentro de un mes.`, nota: 'Ahora eliges tú las cuentas (hay alguna que sobra). Sin IVA.', sol: [{ c: '600', d: x5 }, { c: '400', h: x5 }], extra: ['570', '572'] },
        { t: `Pagamos por banco al mayorista los ${eur(x5)} que le debíamos.`, nota: 'Elige las cuentas. Pista: ¿desaparece una deuda?', sol: [{ c: '400', d: x5 }, { c: '572', h: x5 }], extra: ['600', '570'] },
        { t: `Compramos ${p10.nombre.toLowerCase()} por ${eur(b6)} más el IVA del 10 % y lo pagamos por banco.`, nota: '¡Ahora con IVA! Calcula el IVA (base × 10 ÷ 100). Son 3 cuentas: compras, IVA soportado y banco.', sol: [{ c: '600', d: b6 }, { c: '472', d: i6 }, { c: '572', h: r2(b6 + i6) }], extra: ['477', '570'] },
        { t: `Vendemos ${p4b.nombre.toLowerCase()} por ${eur(b7)} más el IVA del 4 % y lo cobramos en efectivo.`, nota: 'Con IVA: calcula el IVA (base × 4 ÷ 100). Al vender, el IVA es repercutido.', sol: [{ c: '570', d: r2(b7 + i7) }, { c: '700', h: b7 }, { c: '477', h: i7 }], extra: ['472', '572'] },
    ];
}

function razonLinea(l) {
    const t = CTA[l.c].t, lado = l.d ? 'D' : 'H';
    const mov = t === 'G' ? 'es un gasto' : t === 'I' ? 'es un ingreso' : ((lado === 'D') === (t === 'A') ? '⬆️ aumenta' : '⬇️ disminuye');
    return { tipo: TIPO_TXT[t], color: TIPO_COLOR[t], mov, lado: lado === 'D' ? 'Debe' : 'Haber' };
}

function TablaRazon({ sol, nivel }) {
    return (
        <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 380 }}>
                <thead><tr><th style={th}>Cuenta</th><th style={th}>¿Qué es?</th>{nivel >= 2 && <th style={th}>¿Qué le pasa?</th>}{nivel >= 3 && <th style={th}>Va al…</th>}</tr></thead>
                <tbody>{sol.map((l, i) => { const r = razonLinea(l); return (
                    <tr key={i}><td style={td}>{nombreCta(l.c)}</td><td style={{ ...td, color: r.color, fontWeight: 700 }}>{r.tipo}</td>{nivel >= 2 && <td style={td}>{r.mov}</td>}{nivel >= 3 && <td style={{ ...td, fontWeight: 800, color: r.lado === 'Debe' ? C.debe : C.haber }}>{r.lado}</td>}</tr>
                ); })}</tbody>
            </table>
        </div>
    );
}

// Recuadro «T» de ejemplo
const EjemploAsiento = ({ lineas, titulo }) => (
    <div style={{ background: '#fffdf5', border: '1px dashed #d6c9a3', borderRadius: 12, padding: 12, margin: '10px 0' }}>
        {titulo && <div style={{ fontWeight: 700, marginBottom: 6 }}>{titulo}</div>}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={{ ...th, color: C.debe, textAlign: 'right' }}>DEBE</th><th style={th}>Cuenta</th><th style={{ ...th, color: C.haber, textAlign: 'right' }}>HABER</th></tr></thead>
            <tbody>{lineas.map(([d, c, h], i) => <tr key={i}><td style={{ ...tdNum, color: C.debe }}>{d ? num(d) : ''}</td><td style={{ ...td, paddingLeft: h ? 30 : 8 }}>{h ? 'a ' : ''}{nombreCta(c)}</td><td style={{ ...tdNum, color: C.haber }}>{h ? num(h) : ''}</td></tr>)}</tbody>
        </table>
    </div>
);

const P = ({ children }) => <p style={{ lineHeight: 1.6, margin: '0 0 10px', fontSize: '0.98rem' }}>{children}</p>;
const Caja = ({ color, titulo, children }) => (
    <div style={{ borderLeft: `5px solid ${color}`, background: 'white', border: `1px solid ${C.borde}`, borderLeftWidth: 5, borderLeftColor: color, borderRadius: 10, padding: '10px 12px' }}>
        <div style={{ fontWeight: 800, color }}>{titulo}</div><div style={{ fontSize: '0.88rem', color: C.texto, marginTop: 3 }}>{children}</div>
    </div>
);

const PASOS = [
    {
        n: 1, emoji: '🧺', titulo: '¿Qué tiene y qué debe el súper?', desc: 'Activo, pasivo, patrimonio neto, gastos e ingresos',
        intro: () => <>
            <P>Imagina que abres tu propio supermercado. La <b>contabilidad</b> es apuntar, de forma ordenada, todo lo que pasa con el dinero de la empresa para saber cómo va. Lo primero es saber <b>de qué tipo es cada cosa</b>:</P>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
                <Caja color={TIPO_COLOR.A} titulo="🟦 Activo: lo que tengo o me deben">Dinero de la caja y del banco, estanterías, productos del almacén, lo que nos debe un cliente.</Caja>
                <Caja color={TIPO_COLOR.P} titulo="🟧 Pasivo: lo que debo">Lo que debemos al mayorista, un préstamo, impuestos pendientes.</Caja>
                <Caja color={TIPO_COLOR.PN} titulo="🟪 Patrimonio neto: lo de los dueños">El dinero que pusieron los socios para crear la empresa (capital).</Caja>
                <Caja color={TIPO_COLOR.G} titulo="🟥 Gastos: lo que consumo">Luz, alquiler, sueldos, las compras de productos para vender.</Caja>
                <Caja color={TIPO_COLOR.I} titulo="🟩 Ingresos: lo que gano">Lo que cobramos al vender.</Caja>
            </div>
            <P><br />💡 Truco: pregúntate «¿esto lo <b>tengo</b>?», «¿esto lo <b>debo</b>?», «¿me <b>cuesta</b> dinero para funcionar?» o «¿lo <b>gano</b> vendiendo?».</P>
        </>,
        generar: () => barajar(ELEMENTOS).slice(0, 10).map(([t, v, e]) => ({ pregunta: '¿Qué es esto para el supermercado?', texto: t, opciones: TIPOS_PAT, ok: v, expl: e })),
    },
    {
        n: 2, emoji: '↕️', titulo: '¿Aumenta o disminuye?', desc: 'Qué cambia cuando compramos, vendemos o pagamos',
        intro: () => <>
            <P>Cada vez que pasa algo en el súper (compramos, vendemos, pagamos…) <b>unas cosas suben y otras bajan</b>. La contabilidad apunta esos cambios.</P>
            <Caja color={TIPO_COLOR.A} titulo="Ejemplo: vendemos pan y cobramos 50 € en efectivo">💶 El dinero de la caja <b>⬆️ aumenta</b> 50 €.</Caja>
            <div style={{ height: 8 }} />
            <Caja color={TIPO_COLOR.P} titulo="Ejemplo: pagamos al mayorista 200 € que le debíamos">🏦 El dinero del banco <b>⬇️ disminuye</b> y 🚚 lo que debemos al mayorista también <b>⬇️ disminuye</b>.</Caja>
            <P><br />Fíjate: en cada operación cambian <b>al menos dos cosas</b>. Esa es la idea de la «partida doble».</P>
        </>,
        generar: () => barajar(MOVS).slice(0, 10).map(([s, c, v, e]) => ({ pregunta: s, texto: c, opciones: [{ v: 'up', label: '⬆️ Aumenta' }, { v: 'down', label: '⬇️ Disminuye' }], ok: v, expl: e })),
    },
    {
        n: 3, emoji: '⚖️', titulo: '¿Debe o Haber?', desc: 'La regla de oro para colocar cada cuenta',
        intro: () => <>
            <P>Cada cuenta se imagina como una <b>T</b> con dos lados: el <b style={{ color: C.debe }}>Debe</b> (izquierda) y el <b style={{ color: C.haber }}>Haber</b> (derecha). No significan «deber dinero»: son solo los nombres de los dos lados.</P>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, textAlign: 'center' }}>
                <div style={{ background: '#eff6ff', borderRadius: 12, padding: 12 }}><div style={{ fontWeight: 800, color: C.debe, fontSize: '1.1rem' }}>⬅ DEBE</div><div style={{ fontSize: '0.88rem', marginTop: 6 }}>🟦 Activo que <b>aumenta</b><br />🟧 Pasivo que <b>disminuye</b><br />🟥 <b>Gastos</b></div></div>
                <div style={{ background: '#fff7ed', borderRadius: 12, padding: 12 }}><div style={{ fontWeight: 800, color: C.haber, fontSize: '1.1rem' }}>HABER ➡</div><div style={{ fontSize: '0.88rem', marginTop: 6 }}>🟦 Activo que <b>disminuye</b><br />🟧 Pasivo / 🟪 PN que <b>aumenta</b><br />🟩 <b>Ingresos</b></div></div>
            </div>
            <P><br />💡 Para memorizar: <b>el activo y los gastos crecen por la izquierda (Debe)</b>; el pasivo, el patrimonio neto y los ingresos crecen por la derecha (Haber).</P>
        </>,
        generar: () => barajar(QUIZ).slice(0, 10).map(q => ({
            pregunta: q.m, texto: `(${q.c}) ${CTA[q.c].n}`, sub: `Es una cuenta de ${TIPO_TXT[CTA[q.c].t].toLowerCase()}`,
            opciones: [{ v: 'D', label: '⬅ DEBE' }, { v: 'H', label: 'HABER ➡' }], ok: q.r, expl: q.p,
        })),
    },
    {
        n: 4, emoji: '🧾', titulo: 'El IVA de los productos', desc: 'Tipos 4, 10 y 21 %, calcular el IVA y quitarlo de un precio',
        intro: () => <>
            <P>El <b>IVA</b> es un impuesto que se suma al precio. El súper lo cobra a sus clientes y después se lo entrega a Hacienda. No todos los productos llevan el mismo:</P>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                <Caja color="#16a34a" titulo="4 % · superreducido">{PRODUCTOS.filter(p => p.iva === 4).slice(0, 7).map(p => p.emoji + ' ' + p.nombre).join(', ')}…</Caja>
                <Caja color="#ca8a04" titulo="10 % · reducido">{PRODUCTOS.filter(p => p.iva === 10).slice(0, 7).map(p => p.emoji + ' ' + p.nombre).join(', ')}…</Caja>
                <Caja color="#dc2626" titulo="21 % · general">{PRODUCTOS_21.slice(0, 6).map(p => p.emoji + ' ' + p.nombre).join(', ')}, 💡 la luz…</Caja>
            </div>
            <P><br /><b>Calcular el IVA:</b> base × tipo ÷ 100. Ej.: 20 € al 10 % → 20 × 10 ÷ 100 = <b>2 €</b> de IVA → precio final 22 €.</P>
            <P><b>Quitar el IVA de un precio:</b> se divide entre 1,04 / 1,10 / 1,21. Ej.: 22 € con IVA del 10 % → 22 ÷ 1,10 = <b>20 €</b>.</P>
            <P>Si el súper <b>compra</b>, el IVA que paga es <b>soportado</b>; si <b>vende</b>, el IVA que cobra es <b>repercutido</b>.</P>
        </>,
        generar: preguntasIva,
    },
    {
        n: 5, emoji: '✍️', titulo: 'Tus primeros asientos', desc: 'Apunta operaciones sencillas en el Debe y el Haber',
        intro: () => <>
            <P>Un <b>asiento</b> es la forma de apuntar una operación en el <b>Libro Diario</b>: unas cuentas van al <b style={{ color: C.debe }}>Debe</b> y otras al <b style={{ color: C.haber }}>Haber</b>, y <b>las dos columnas tienen que sumar lo mismo</b>.</P>
            <EjemploAsiento titulo="Ejemplo: vendemos pan y cobramos 50 € en efectivo" lineas={[[50, '570', null], [null, '700', 50]]} />
            <P>Para hacerlo, piensa en 3 pasos:</P>
            <ol style={{ lineHeight: 1.7, marginTop: 0 }}>
                <li><b>¿Qué cuentas cambian?</b> → la caja (570) y las ventas (700).</li>
                <li><b>¿Qué son y qué les pasa?</b> → la caja es activo y aumenta; las ventas son un ingreso.</li>
                <li><b>¿Debe o Haber?</b> → activo que aumenta al Debe; ingreso al Haber.</li>
            </ol>
            <P>Al principio te damos las cuentas; después las eliges tú y, al final, ¡con IVA!</P>
        </>,
        asientos: true,
    },
];

// Preguntas de opción múltiple de un paso
function PreguntasPaso({ paso, onFin }) {
    const [preg] = useState(() => paso.generar());
    const [i, setI] = useState(0);
    const [aciertos, setAciertos] = useState(0);
    const [resp, setResp] = useState(null);
    const q = preg[i];
    const igual = (a, b) => typeof a === 'number' ? Math.abs(a - b) < 0.004 : a === b;
    const responder = v => { if (resp != null) return; setResp(v); if (igual(v, q.ok)) setAciertos(a => a + 1); };
    const siguiente = () => { if (i + 1 >= preg.length) { onFin(aciertos, preg.length); return; } setI(i + 1); setResp(null); };
    const acierta = resp != null && igual(resp, q.ok);
    return (
        <div style={{ ...card, maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: C.gris, fontSize: '0.8rem', fontWeight: 700 }}><span>Pregunta {i + 1} de {preg.length}</span><span>✅ {aciertos}</span></div>
            <div style={{ height: 6, background: '#e2e8f0', borderRadius: 99, margin: '8px 0 14px' }}><div style={{ height: '100%', width: `${i / preg.length * 100}%`, background: C.verde, borderRadius: 99 }} /></div>
            <div style={{ fontSize: '1rem', color: C.texto, lineHeight: 1.5 }}>{q.pregunta}</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, margin: '10px 0 4px' }}>{q.texto}</div>
            {q.sub && <div style={{ fontSize: '0.82rem', color: C.gris }}>{q.sub}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${q.opciones.length > 3 ? 150 : 170}px, 1fr))`, gap: 8, marginTop: 16 }}>
                {q.opciones.map(o => {
                    const esOk = igual(o.v, q.ok), elegida = resp != null && igual(o.v, resp);
                    const bg = resp == null ? 'white' : esOk ? '#dcfce7' : elegida ? '#fee2e2' : 'white';
                    const bd = resp == null ? C.borde : esOk ? '#16a34a' : elegida ? '#dc2626' : C.borde;
                    return (
                        <button key={String(o.v)} onClick={() => responder(o.v)} style={{ background: bg, border: `2px solid ${bd}`, borderRadius: 12, padding: '12px 10px', cursor: resp == null ? 'pointer' : 'default', fontFamily: 'inherit', fontSize: '0.98rem', fontWeight: 700, color: C.texto }}>
                            {o.label}{o.sub && <div style={{ fontSize: '0.74rem', fontWeight: 500, color: C.gris, marginTop: 2 }}>{o.sub}</div>}
                        </button>
                    );
                })}
            </div>
            {resp != null && (
                <div style={{ marginTop: 14, background: acierta ? '#f0fdf4' : '#fef2f2', borderRadius: 12, padding: 12 }}>
                    <div style={{ fontWeight: 800, color: acierta ? '#15803d' : '#b91c1c' }}>{acierta ? '¡Correcto! 🎉' : 'No es así'}</div>
                    <div style={{ fontSize: '0.92rem', margin: '4px 0 10px', lineHeight: 1.5 }}>{q.expl}</div>
                    <button onClick={siguiente} style={btn(C.verde)}>{i + 1 >= preg.length ? 'Ver resultado' : 'Siguiente →'}</button>
                </div>
            )}
        </div>
    );
}

// Asientos guiados (paso 5)
function AsientosGuiados({ onFin }) {
    const [ops] = useState(asientosGuiados);
    const filasIni = o => o.fijas ? barajar(o.sol).map(l => ({ c: l.c, d: '', h: '' })) : filasVacias(o.sol.length);
    const [i, setI] = useState(0);
    const [filas, setFilas] = useState(() => filasIni(ops[0]));
    const [fb, setFb] = useState(null);
    const [estado, setEstado] = useState('jugando');
    const [ayuda, setAyuda] = useState(0);
    const [aciertos, setAciertos] = useState(0);
    const op = ops[i];
    const cuentas = [...new Set([...op.sol.map(l => l.c), ...(op.extra || [])])].sort();
    const comprobar = () => { const r = validar(filas, op.sol); setFb(r); if (r.ok) { setEstado('ok'); setAciertos(a => a + 1); } };
    const revelar = () => { setEstado('revelado'); setFilas(filasDeSol(op.sol)); setFb(null); };
    const siguiente = () => {
        if (i + 1 >= ops.length) { onFin(aciertos, ops.length); return; }
        setI(i + 1); setFilas(filasIni(ops[i + 1])); setFb(null); setEstado('jugando'); setAyuda(0);
    };
    const hecho = estado !== 'jugando';
    return (
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: C.gris, fontSize: '0.8rem', fontWeight: 700 }}><span>Asiento {i + 1} de {ops.length}</span><span>✅ {aciertos}</span></div>
                <div style={{ height: 6, background: '#e2e8f0', borderRadius: 99, margin: '8px 0 12px' }}><div style={{ height: '100%', width: `${i / ops.length * 100}%`, background: C.verde, borderRadius: 99 }} /></div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, lineHeight: 1.5 }}>{op.t}</div>
                <div style={{ fontSize: '0.86rem', color: C.gris, marginTop: 6 }}>ℹ️ {op.nota}</div>
            </div>
            <div style={card}>
                <EditorAsiento filas={filas} setFilas={f => { setFilas(f); if (fb) setFb(null); }} estados={fb?.estados} bloqueado={hecho} cuentas={cuentas} />
                {fb && !fb.ok && <div style={{ marginTop: 10, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 10, fontSize: '0.86rem', color: '#991b1b' }}>{fb.mensajes.map((m, k) => <div key={k}>• {m}</div>)}</div>}
                {!hecho && ayuda > 0 && (
                    <div style={{ marginTop: 10, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 10 }}>
                        <div style={{ fontWeight: 800, fontSize: '0.86rem', marginBottom: 6 }}>🧠 Piensa paso a paso</div>
                        <TablaRazon sol={op.sol} nivel={ayuda} />
                    </div>
                )}
                {hecho && (
                    <div style={{ marginTop: 10, background: estado === 'ok' ? '#f0fdf4' : '#fffbeb', border: `1px solid ${estado === 'ok' ? '#bbf7d0' : '#fde68a'}`, borderRadius: 10, padding: 10 }}>
                        <div style={{ fontWeight: 800, marginBottom: 6 }}>{estado === 'ok' ? '✅ ¡Asiento correcto!' : '👁️ Así se hace:'}</div>
                        <TablaRazon sol={op.sol} nivel={3} />
                    </div>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                    {!hecho ? <>
                        <button onClick={comprobar} style={btn(C.verde)}>✔ Comprobar</button>
                        {ayuda < 3 && <button onClick={() => setAyuda(a => a + 1)} style={btn('#e0e7ff', '#3730a3')}>🧠 Ayúdame a pensar {ayuda > 0 ? `(${ayuda}/3)` : ''}</button>}
                        <button onClick={revelar} style={btn('#fef3c7', '#92400e')}>👁️ Ver solución</button>
                    </> : <button onClick={siguiente} style={btn(C.azul)}>{i + 1 >= ops.length ? 'Ver resultado' : 'Siguiente asiento →'}</button>}
                </div>
            </div>
        </div>
    );
}

// Un paso completo: explicación → actividad → resultado
function PasoView({ paso, onTerminar, onSiguiente, onSalir, onEmpezarMes }) {
    const [fase, setFase] = useState('intro');
    const [res, setRes] = useState(null);
    const [vuelta, setVuelta] = useState(0);
    const fin = (a, t) => { setRes({ a, t }); setFase('fin'); onTerminar(a, t); };
    if (fase === 'intro') return (
        <div style={{ ...card, maxWidth: 820, margin: '0 auto' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: C.gris }}>PASO {paso.n} DE {PASOS.length}</div>
            <h2 style={{ margin: '4px 0 12px', color: C.verde }}>{paso.emoji} {paso.titulo}</h2>
            {paso.intro()}
            <button onClick={() => setFase('jugar')} style={{ ...btn(C.verde), padding: '12px 22px', marginTop: 6 }}>¡Entendido, a practicar! →</button>
        </div>
    );
    if (fase === 'jugar') return paso.asientos
        ? <AsientosGuiados key={vuelta} onFin={fin} />
        : <PreguntasPaso key={vuelta} paso={paso} onFin={fin} />;
    const pct = res.a / res.t;
    const estrellas = pct >= 0.9 ? 3 : pct >= 0.7 ? 2 : pct >= 0.5 ? 1 : 0;
    return (
        <div style={{ ...card, maxWidth: 520, margin: '0 auto', textAlign: 'center' }}>
            <div style={{ fontSize: 46 }}>{'⭐'.repeat(estrellas) || '💪'}</div>
            <h2 style={{ margin: '6px 0', color: C.verde }}>{res.a} de {res.t} correctas</h2>
            <p style={{ color: C.gris, marginTop: 0 }}>{pct >= 0.7 ? '¡Paso superado! Ya puedes seguir.' : 'Repasa la explicación y vuelve a intentarlo: necesitas un 70 % para superarlo.'}</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => { setVuelta(v => v + 1); setFase(pct >= 0.7 ? 'jugar' : 'intro'); }} style={btn('#e2e8f0', C.texto)}>🔁 Repetir</button>
                {paso.n < PASOS.length && <button onClick={onSiguiente} style={btn(C.verde)}>Paso {paso.n + 1} →</button>}
                {paso.n === PASOS.length && <button onClick={onEmpezarMes} style={btn(C.verde)}>🏪 ¡Al mes del supermercado!</button>}
                <button onClick={onSalir} style={btn('#e2e8f0', C.texto)}>Ver los pasos</button>
            </div>
        </div>
    );
}

// ─── Modal enviar al profesor ─────────────────────────────────────────────────
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
            const snap = await getDoc(doc(db, 'codigos_profesor', code));
            if (!snap.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'CONTABILIDAD_SUPER', modalidad: 'Individual', fecha: new Date(), codigoProfesor: code,
                jugadores: [{
                    nombre: nombre.trim(), curso: curso.trim(),
                    aciertos: datos.aciertos, intentos: datos.intentos,
                    porcentaje: Math.round((datos.aciertos / Math.max(1, datos.intentos)) * 100),
                    empresa: datos.empresa, mes: datos.mes, modo: datos.modo,
                    comprobaciones: datos.comprobaciones, pistas: datos.pistas, revelados: datos.revelados,
                    completado: datos.completado, resultado: datos.resultado,
                    quiz: datos.quiz, asientos: datos.asientos, pasos: datos.pasos,
                }],
            });
            setEnviado(true);
        } catch (e) { setError('Error: ' + e.message); }
        setEnviando(false);
    };
    const inp = { padding: '9px 12px', borderRadius: 9, border: `1.5px solid ${C.borde}`, fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' };
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 10050, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
            <div style={{ ...card, width: '100%', maxWidth: 380 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <h3 style={{ margin: 0, color: C.verde }}>📤 Enviar al profesor</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gris, fontSize: '1.2rem' }}>✕</button>
                </div>
                {enviado ? (
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                        <div style={{ fontSize: '3rem' }}>✅</div>
                        <div style={{ color: '#15803d', fontWeight: 700 }}>¡Informe enviado!</div>
                        <div style={{ color: C.gris, fontSize: '0.88rem', marginTop: 6 }}>{datos.empresa ? `${datos.aciertos}/${datos.intentos} asientos correctos sin ver la solución` : `${datos.aciertos}/${datos.intentos} primeros pasos superados`}</div>
                        <button onClick={onClose} style={{ ...btn('#e2e8f0', C.texto), marginTop: 14 }}>Cerrar</button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre y apellido" style={inp} />
                        <input value={curso} onChange={e => setCurso(e.target.value)} placeholder="Curso (ej.: 4.º ESO B)" style={inp} />
                        <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="Código del profesor" maxLength={10} style={{ ...inp, letterSpacing: 2, fontWeight: 700 }} />
                        {error && <div style={{ color: '#dc2626', fontSize: '0.8rem' }}>⚠ {error}</div>}
                        <div style={{ display: 'flex', gap: 9 }}>
                            <button onClick={onClose} style={{ ...btn('#e2e8f0', C.texto), flex: 1 }}>Cancelar</button>
                            <button onClick={enviar} disabled={enviando} style={{ ...btn(enviando ? '#94a3b8' : C.verde), flex: 2 }}>{enviando ? 'Enviando…' : '📤 Enviar'}</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ContabilidadSuper({ onBack }) {
    const [partida, setPartida] = useState(() => { try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch { return null; } });
    const [vista, setVista] = useState('inicio'); // inicio | paso | aprende | mes
    const [tab, setTab] = useState('asientos');   // asientos | diario | mayor | balance | resultados
    const [idx, setIdx] = useState(0);
    const [filas, setFilas] = useState(filasVacias(3));
    const [fb, setFb] = useState(null);
    const [pasosProg, setPasosProg] = useState(() => { try { return JSON.parse(localStorage.getItem(PASOS_KEY) || '{}') || {}; } catch { return {}; } });
    const [pasoActivo, setPasoActivo] = useState(1);
    const [envio, setEnvio] = useState(false);
    const [nombreNuevo, setNombreNuevo] = useState('Supermercado El Barrio');
    const [modoNuevo, setModoNuevo] = useState('ayuda');

    const mesData = useMemo(() => partida ? generarMes(partida.seed, partida.nombre) : null, [partida?.seed, partida?.nombre]);
    const ops = useMemo(() => (mesData?.ops || []).map(o => ({ ...o, fecha: `${o.dia} de ${mesData.mes}` })), [mesData]);
    const prog = partida?.progreso || {};
    const op = ops[idx];
    const est = prog[idx] || { estado: 'pendiente', intentos: 0, pistas: 0 };
    const hecho = est.estado === 'ok' || est.estado === 'revelado';
    const ocultar = partida?.modo === 'reto';

    useEffect(() => { try { localStorage.setItem(PASOS_KEY, JSON.stringify(pasosProg)); } catch { /* sin almacenamiento */ } }, [pasosProg]);
    useEffect(() => { try { if (partida) localStorage.setItem(LS_KEY, JSON.stringify(partida)); } catch { /* sin almacenamiento */ } }, [partida]);
    useEffect(() => {
        if (!op) return;
        const e = prog[idx];
        setFilas(e && (e.estado === 'ok' || e.estado === 'revelado') ? filasDeSol(op.sol) : filasVacias(Math.max(2, Math.min(op.sol.length, 4))));
        setFb(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idx, partida?.seed]);

    const setEst = (i, cambios) => setPartida(p => ({ ...p, progreso: { ...p.progreso, [i]: { ...(p.progreso[i] || { estado: 'pendiente', intentos: 0, pistas: 0 }), ...cambios } } }));

    const empezar = () => {
        const seed = Math.floor(Math.random() * 1e9);
        setPartida({ seed, nombre: nombreNuevo.trim() || 'Supermercado', modo: modoNuevo, progreso: {} });
        setIdx(0); setTab('asientos'); setVista('mes');
    };

    const comprobar = () => {
        const r = validar(filas, op.sol);
        setFb(r);
        setEst(idx, { intentos: est.intentos + 1, ...(r.ok ? { estado: 'ok' } : {}) });
    };
    const pedirPista = () => setEst(idx, { pistas: Math.min(2, est.pistas + 1) });
    const revelar = () => { setEst(idx, { estado: 'revelado' }); setFilas(filasDeSol(op.sol)); setFb(null); };

    const hechos = ops.map((o, i) => ({ op: o, n: i + 1, e: prog[i] })).filter(h => h.e && (h.e.estado === 'ok' || h.e.estado === 'revelado'));
    const completo = ops.length > 0 && hechos.length === ops.length;
    const nOk = ops.filter((_, i) => prog[i]?.estado === 'ok').length;
    const nRev = ops.filter((_, i) => prog[i]?.estado === 'revelado').length;
    const nComp = Object.values(prog).reduce((s, e) => s + (e.intentos || 0), 0);
    const nPistas = Object.values(prog).reduce((s, e) => s + (e.pistas || 0), 0);

    const pistaNivel = Math.max(est.pistas, partida?.modo === 'ayuda' ? 1 : 0);
    const cuentasSol = op ? [...new Set(op.sol.map(l => l.c))] : [];

    // ── Cabecera común ──
    const Cabecera = ({ titulo, volver }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <button onClick={volver} style={btn('#e2e8f0', C.texto)}>← Volver</button>
            <h2 style={{ margin: 0, color: C.verde, fontSize: '1.3rem', flex: 1, minWidth: 200 }}>{titulo}</h2>
        </div>
    );

    const contenedor = { minHeight: '100%', background: C.fondo, fontFamily: "'Segoe UI', system-ui, sans-serif", color: C.texto };
    const ancho = { maxWidth: 1180, margin: '0 auto', padding: '18px 16px 50px' };

    const pasosOk = PASOS.filter(p => pasosProg[p.n]?.superado).length;
    const terminarPaso = (n, a, t) => setPasosProg(pp => {
        const prev = pp[n] || {};
        return { ...pp, [n]: { mejor: Math.max(prev.mejor || 0, a), total: t, ultimo: a, veces: (prev.veces || 0) + 1, superado: prev.superado || a / t >= 0.7 } };
    });
    const datosInforme = () => ({
        aciertos: partida ? nOk : pasosOk, intentos: partida ? ops.length : PASOS.length,
        empresa: partida?.nombre || null, mes: mesData?.mes || null, modo: partida?.modo || null,
        comprobaciones: nComp, pistas: nPistas, revelados: nRev, completado: completo,
        resultado: completo ? mesData.resultado : null, quiz: pasosProg[3]?.ultimo ?? null,
        asientos: ops.map((o, i) => ({ titulo: o.titulo, estado: prog[i]?.estado || 'pendiente', intentos: prog[i]?.intentos || 0, pistas: prog[i]?.pistas || 0 })),
        pasos: PASOS.map(p => ({ n: p.n, titulo: p.titulo, mejor: pasosProg[p.n]?.mejor ?? null, total: pasosProg[p.n]?.total ?? null, superado: !!pasosProg[p.n]?.superado })),
    });
    const modalEnvio = envio && <ModalEnviarProfe onClose={() => setEnvio(false)} datos={datosInforme()} />;
    const btnEnvio = <button onClick={() => setEnvio(true)} style={btn('linear-gradient(135deg,#f59e0b,#ea580c)')}>📤 Enviar al profesor</button>;

    // ── Inicio ──
    if (vista === 'inicio') return (
        <div style={contenedor}><div style={ancho}>
            <Cabecera titulo="" volver={onBack} />
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ fontSize: 64 }}>🏪📒</div>
                <h1 style={{ margin: '6px 0', color: C.verde, fontSize: 'clamp(1.6rem, 4vw, 2.4rem)' }}>Contabilidad del supermercado</h1>
                <p style={{ color: C.gris, maxWidth: 640, margin: '0 auto', lineHeight: 1.5 }}>Aprende a llevar las cuentas de tu propio supermercado: qué tiene y qué debe, el Debe y el Haber, el IVA de los productos… y al final, un mes completo con la luz, el alquiler y la nómina del empleado.</p>
            </div>

            {/* Itinerario */}
            <div style={{ ...card, marginBottom: 16, border: `2px solid ${C.verde}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                    <div style={{ flex: 1, minWidth: 220 }}>
                        <h3 style={{ margin: 0, color: C.verde }}>🐣 Primeros pasos</h3>
                        <div style={{ fontSize: '0.86rem', color: C.gris }}>¿Nunca has hecho contabilidad? Empieza aquí. Cada paso tiene una explicación corta y un ejemplo antes de practicar.</div>
                    </div>
                    <div style={{ fontWeight: 800, color: C.verde }}>{pasosOk}/{PASOS.length} superados</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
                    {PASOS.map(p => {
                        const pr = pasosProg[p.n];
                        const recomendado = !pr?.superado && PASOS.filter(x => x.n < p.n).every(x => pasosProg[x.n]?.superado);
                        return (
                            <button key={p.n} onClick={() => { setPasoActivo(p.n); setVista('paso'); }} style={{ textAlign: 'left', background: pr?.superado ? '#f0fdf4' : recomendado ? C.verdeClaro : 'white', border: `2px solid ${pr?.superado ? '#86efac' : recomendado ? C.verde : C.borde}`, borderRadius: 14, padding: 12, cursor: 'pointer', fontFamily: 'inherit', color: C.texto }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: 28 }}>{p.emoji}</span>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: pr?.superado ? '#15803d' : C.gris }}>{pr?.superado ? '✅' : recomendado ? '👉 Empieza aquí' : `Paso ${p.n}`}</span>
                                </div>
                                <div style={{ fontWeight: 800, margin: '6px 0 2px', fontSize: '0.92rem' }}>{p.n}. {p.titulo}</div>
                                <div style={{ fontSize: '0.76rem', color: C.gris }}>{p.desc}</div>
                                {pr && <div style={{ fontSize: '0.74rem', marginTop: 4, fontWeight: 700, color: C.verde }}>Mejor: {pr.mejor}/{pr.total}</div>}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
                <div style={card}>
                    <h3 style={{ marginTop: 0 }}>🏪 El mes del supermercado</h3>
                    <div style={{ fontSize: '0.82rem', color: C.gris, marginBottom: 10 }}>13 operaciones reales de un mes, con libros, balance y resultado.{pasosOk < PASOS.length && ' Recomendado tras los primeros pasos.'}</div>
                    <label style={{ fontSize: '0.8rem', color: C.gris, fontWeight: 700 }}>Nombre de tu supermercado</label>
                    <input value={nombreNuevo} onChange={e => setNombreNuevo(e.target.value)} maxLength={40} style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 9, border: `1.5px solid ${C.borde}`, margin: '4px 0 12px', fontFamily: 'inherit', fontSize: '0.95rem' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                        {[['ayuda', '🧭 Con ayuda', 'Los documentos muestran todas las cuotas y se indican las cuentas que intervienen.'], ['reto', '🎯 Reto', 'Calcula tú el IVA, la nómina y los totales. Las cuentas no se indican.']].map(([v, t, d]) => (
                            <label key={v} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: 10, borderRadius: 10, border: `2px solid ${modoNuevo === v ? C.verde : C.borde}`, background: modoNuevo === v ? C.verdeClaro : 'white', cursor: 'pointer' }}>
                                <input type="radio" checked={modoNuevo === v} onChange={() => setModoNuevo(v)} style={{ marginTop: 3 }} />
                                <span><b>{t}</b><br /><span style={{ fontSize: '0.8rem', color: C.gris }}>{d}</span></span>
                            </label>
                        ))}
                    </div>
                    <button onClick={empezar} style={{ ...btn(C.verde), width: '100%', padding: 12 }}>Empezar el mes →</button>
                    {partida && (
                        <button onClick={() => setVista('mes')} style={{ ...btn('#e2e8f0', C.texto), width: '100%', marginTop: 8 }}>
                            Continuar «{partida.nombre}» ({Object.values(partida.progreso || {}).filter(e => e.estado !== 'pendiente').length}/13)
                        </button>
                    )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div onClick={() => setVista('aprende')} style={{ ...card, cursor: 'pointer' }}>
                        <div style={{ fontSize: 40 }}>📘</div>
                        <h3 style={{ margin: '6px 0' }}>Chuleta de consulta</h3>
                        <p style={{ color: C.gris, fontSize: '0.9rem', margin: 0 }}>Todo resumido: partida doble, Debe y Haber, tipos de IVA, la nómina y las cuentas del Plan General Contable.</p>
                    </div>
                    <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ flex: 1, minWidth: 160, fontSize: '0.86rem', color: C.gris }}>¿Has terminado? Manda tu progreso a tu profe.</span>
                        {btnEnvio}
                    </div>
                </div>
            </div>
            {modalEnvio}
        </div></div>
    );

    if (vista === 'paso') {
        const paso = PASOS.find(p => p.n === pasoActivo) || PASOS[0];
        return (
            <div style={contenedor}><div style={ancho}>
                <Cabecera titulo={`🐣 Primeros pasos · ${paso.n}/${PASOS.length}`} volver={() => setVista('inicio')} />
                <PasoView key={paso.n} paso={paso}
                    onTerminar={(a, t) => terminarPaso(paso.n, a, t)}
                    onSiguiente={() => setPasoActivo(paso.n + 1)}
                    onSalir={() => setVista('inicio')}
                    onEmpezarMes={() => setVista('inicio')} />
            </div></div>
        );
    }

    if (vista === 'aprende') return (
        <div style={contenedor}><div style={ancho}>
            <Cabecera titulo="📘 Chuleta de consulta" volver={() => setVista('inicio')} />
            <Aprende />
        </div></div>
    );

    // ── Mes ──
    if (!partida || !op) return null;
    const TABS = [['asientos', '✍️ Asientos'], ['diario', '📒 Libro Diario'], ['mayor', '📑 Libro Mayor'], ['balance', '⚖️ Comprobación'], ['resultados', '📊 Resultados']];

    return (
        <div style={contenedor}><div style={ancho}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                <button onClick={() => setVista('inicio')} style={btn('#e2e8f0', C.texto)}>← Menú</button>
                <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 800, color: C.verde, fontSize: '1.15rem' }}>🏪 {partida.nombre}</div>
                    <div style={{ fontSize: '0.8rem', color: C.gris }}>Mes de {mesData.mes} · {partida.modo === 'reto' ? '🎯 Reto' : '🧭 Con ayuda'} · {hechos.length}/{ops.length} asientos · ✅ {nOk} a pulso</div>
                </div>
                {btnEnvio}
            </div>
            <div style={{ height: 8, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden', marginBottom: 12 }}>
                <div style={{ height: '100%', width: `${hechos.length / ops.length * 100}%`, background: C.verde, transition: 'width .3s' }} />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                {TABS.map(([k, t]) => <button key={k} onClick={() => setTab(k)} style={{ ...btn(tab === k ? C.verde : 'white', tab === k ? 'white' : C.texto), border: `1px solid ${tab === k ? C.verde : C.borde}`, padding: '7px 12px', fontSize: '0.84rem' }}>{t}</button>)}
            </div>

            {tab === 'diario' && <LibroDiario hechos={hechos} />}
            {tab === 'mayor' && <LibroMayor hechos={hechos} />}
            {tab === 'balance' && <BalanceComprobacion hechos={hechos} />}
            {tab === 'resultados' && <Resultados hechos={hechos} ops={ops} completo={completo} />}

            {tab === 'asientos' && (
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    {/* Lista de operaciones */}
                    <div style={{ ...card, padding: 10, flex: '1 1 220px', maxWidth: '100%' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: C.gris, padding: '2px 6px 8px' }}>OPERACIONES DEL MES</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 520, overflowY: 'auto' }}>
                            {ops.map((o, i) => {
                                const e = prog[i]?.estado;
                                return (
                                    <button key={o.id} onClick={() => setIdx(i)} style={{ display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', padding: '7px 8px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: i === idx ? C.verdeClaro : 'transparent', fontSize: '0.82rem', color: C.texto }}>
                                        <span style={{ width: 22, textAlign: 'center' }}>{e === 'ok' ? '✅' : e === 'revelado' ? '👁️' : o.emoji}</span>
                                        <span style={{ flex: 1 }}><b>{i + 1}.</b> {o.titulo}<br /><span style={{ fontSize: '0.7rem', color: C.gris }}>{o.fecha}</span></span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Operación actual */}
                    <div style={{ flex: '4 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={card}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: C.gris }}>OPERACIÓN {idx + 1} · {op.fecha.toUpperCase()}</div>
                            <h3 style={{ margin: '4px 0 8px', fontSize: '1.2rem' }}>{op.emoji} {op.titulo}</h3>
                            <p style={{ margin: '0 0 12px', lineHeight: 1.5 }}>{op.enunciado}</p>
                            <Documento doc={op.doc} ocultar={ocultar && !hecho} />
                        </div>

                        <div style={card}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                                <h3 style={{ margin: 0, fontSize: '1rem' }}>✍️ Asiento en el Libro Diario</h3>
                                {est.intentos > 0 && <span style={{ fontSize: '0.75rem', color: C.gris }}>Comprobaciones: {est.intentos}</span>}
                            </div>
                            {!hecho && pistaNivel >= 1 && (
                                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 10, marginBottom: 10, fontSize: '0.84rem' }}>
                                    <b>💡 Cuentas que intervienen:</b>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                                        {cuentasSol.map(c => {
                                            const lado = op.sol.find(l => l.c === c)?.d ? 'Debe' : 'Haber';
                                            return <span key={c} style={{ background: 'white', border: `1px solid ${C.borde}`, borderRadius: 99, padding: '3px 10px' }}>{nombreCta(c)}{pistaNivel >= 2 && <b style={{ color: lado === 'Debe' ? C.debe : C.haber }}> → {lado}</b>}</span>;
                                        })}
                                    </div>
                                </div>
                            )}
                            <EditorAsiento filas={filas} setFilas={f => { setFilas(f); if (fb) setFb(null); }} estados={fb?.estados} bloqueado={hecho} />
                            {fb && !fb.ok && (
                                <div style={{ marginTop: 10, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 10, fontSize: '0.86rem', color: '#991b1b' }}>
                                    {fb.mensajes.map((m, i) => <div key={i}>• {m}</div>)}
                                </div>
                            )}
                            {hecho && (
                                <div style={{ marginTop: 10, background: est.estado === 'ok' ? '#f0fdf4' : '#fffbeb', border: `1px solid ${est.estado === 'ok' ? '#bbf7d0' : '#fde68a'}`, borderRadius: 10, padding: 12, fontSize: '0.88rem', lineHeight: 1.5 }}>
                                    <b>{est.estado === 'ok' ? '✅ ¡Asiento correcto!' : '👁️ Solución'}</b>
                                    <div style={{ marginTop: 4 }}>{op.expl}</div>
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                                {!hecho && <>
                                    <button onClick={comprobar} style={btn(C.verde)}>✔ Comprobar</button>
                                    {pistaNivel < 2 && <button onClick={pedirPista} style={btn('#e0e7ff', '#3730a3')}>💡 {pistaNivel === 0 ? 'Pista: cuentas' : 'Pista: Debe/Haber'}</button>}
                                    <button onClick={revelar} style={btn('#fef3c7', '#92400e')}>👁️ Ver solución</button>
                                </>}
                                {idx > 0 && <button onClick={() => setIdx(idx - 1)} style={btn('#e2e8f0', C.texto)}>← Anterior</button>}
                                {idx < ops.length - 1 && <button onClick={() => setIdx(idx + 1)} style={btn(hecho ? C.azul : '#e2e8f0', hecho ? 'white' : C.texto)}>Siguiente →</button>}
                                {completo && <button onClick={() => setTab('resultados')} style={btn('#7c3aed')}>📊 Ver resultados del mes</button>}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {modalEnvio}
        </div></div>
    );
}
