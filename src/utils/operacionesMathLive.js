// Operaciones automáticas de PiLive (antes la app aparte «MathLive»).
// Un recurso PiLive (tipo 'PRO', tipoJuego 'THINKHOOT' o el antiguo 'MATHLIVE') con
// config.isMathLive === true genera operaciones al lanzar la partida:
//  - En vivo: el motor MathLive.jsx las genera en la sala (tipo 'MATH', con teclado numérico).
//  - Jugar solo / tarjetas / mandos: recursoConOperaciones() las añade como una hoja
//    más de preguntas de 4 opciones (MULTIPLE), que esos modos ya saben jugar.

export const CONFIG_OPERACIONES_DEFECTO = {
    mathCount: 8, mathTime: 30, mathPuntosMax: 30, mathPuntosMin: 20,
    mathTypes: ['POSITIVOS'], mathOps: ['SUMA'], mathMin: 1, mathMax: 10,
};

export const tieneOperaciones = (r) => r?.config?.isMathLive === true;

export const generarOperacionesMathLive = (config) => {
    const questions = [];
    const count = parseInt(config.mathCount || 0);
    if (count <= 0) return [];

    const types = config.mathTypes?.length ? config.mathTypes : ['POSITIVOS'];
    const ops = config.mathOps?.length ? config.mathOps : ['SUMA'];
    const min = parseInt(config.mathMin || 1);
    const max = parseInt(config.mathMax || 10);

    const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const getRandomFloat = (min, max) => (Math.random() * (max - min) + min).toFixed(1);
    const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
    const simplify = (n, d) => { const common = gcd(Math.abs(n), Math.abs(d)) || 1; return { n: n / common, d: d / common }; };

    for (let i = 0; i < count; i++) {
        const type = types[i % types.length];
        const op = ops[i % ops.length];
        let qObj = { tipo: 'MATH', tiempo: config.mathTime || 30, puntosMax: config.mathPuntosMax || 100, puntosMin: config.mathPuntosMin || 50, subtipo: 'STANDARD' };
        let a, b, res, operatorSymbol;

        if (type === 'FRACCIONES') {
            qObj.subtipo = 'FRACTION';
            const n1 = getRandomInt(min, max); const d1 = getRandomInt(min, max) || 1;
            const n2 = getRandomInt(min, max) || 1; const d2 = getRandomInt(min, max) || 1;
            qObj.f1 = { n: n1, d: d1 }; qObj.f2 = { n: n2, d: d2 };
            let resN, resD;
            if (op === 'SUMA') { operatorSymbol = '+'; resN = n1 * d2 + n2 * d1; resD = d1 * d2; }
            else if (op === 'RESTA') { operatorSymbol = '-'; resN = n1 * d2 - n2 * d1; resD = d1 * d2; }
            else if (op === 'MULT') { operatorSymbol = '·'; resN = n1 * n2; resD = d1 * d2; }
            else if (op === 'DIV') { operatorSymbol = ':'; resN = n1 * d2; resD = d1 * n2; }
            const simple = simplify(resN, resD);
            if (simple.d < 0) { simple.n = -simple.n; simple.d = -simple.d; }
            qObj.operator = operatorSymbol; qObj.respuesta = { n: simple.n, d: simple.d }; qObj.q = "Calcula";
        } else {
            qObj.subtipo = 'STANDARD';
            const isDecimal = type === 'DECIMALES';
            const isNegative = type === 'NEGATIVOS';
            const getVal = () => { let v = isDecimal ? parseFloat(getRandomFloat(min, max)) : getRandomInt(min, max); if (isNegative && Math.random() > 0.5) v = -v; return v; };
            a = getVal(); b = getVal();
            if (op === 'DIV') {
                if (b === 0) b = 1;
                if (!isDecimal) { const resTemp = isNegative ? (Math.random() > 0.5 ? -getRandomInt(min, max) : getRandomInt(min, max)) : getRandomInt(min, max); a = b * resTemp; }
            }
            if (op === 'SUMA') { operatorSymbol = '+'; res = a + b; }
            else if (op === 'RESTA') {
                operatorSymbol = '-';
                // Si solo queremos POSITIVOS, evitamos que dé negativo
                if (!isNegative && b > a) { const temp = a; a = b; b = temp; }
                res = a - b;
            }
            else if (op === 'MULT') { operatorSymbol = '·'; res = a * b; }
            else if (op === 'DIV') { operatorSymbol = ':'; res = a / b; }

            if (isDecimal || !Number.isInteger(res)) {
                res = parseFloat(res.toFixed(1));
                qObj.respuesta = String(res).replace('.', ',');
            } else {
                qObj.respuesta = String(res);
            }
            qObj.displayA = String(a).replace('.', ','); qObj.displayB = String(b).replace('.', ',');
            if (b < 0) qObj.displayB = `(${qObj.displayB})`;
            qObj.operator = operatorSymbol; qObj.q = "Calcula";
        }
        questions.push(qObj);
    }
    return questions;
};

// --- Operaciones como preguntas de 4 opciones (modos sin sala) ---
const fraccionTexto = ({ n, d }) => d === 1 ? String(n) : `${n}/${d}`;

const distractores = (q) => {
    const out = new Set();
    const correcta = q.subtipo === 'FRACTION' ? fraccionTexto(q.respuesta) : q.respuesta;
    let intentos = 0;
    while (out.size < 3 && intentos++ < 60) {
        let cand;
        if (q.subtipo === 'FRACTION') {
            const { n, d } = q.respuesta;
            const opciones = [
                { n: n + 1, d }, { n: n - 1 || n + 2, d }, { n, d: d + 1 },
                { n: q.f1.n + q.f2.n, d: q.f1.d + q.f2.d }, { n: d, d: n || 1 }, { n: n + 2, d: d + 1 },
            ];
            const op = opciones[Math.floor(Math.random() * opciones.length)];
            if (!op.d || op.n * d === n * op.d) continue; // equivalente a la correcta (p. ej. 4/2 = 2)
            cand = fraccionTexto(op);
        } else {
            const esDecimal = String(correcta).includes(',');
            const v = parseFloat(String(correcta).replace(',', '.'));
            const paso = esDecimal ? [0.1, 0.2, 0.5, 1][Math.floor(Math.random() * 4)] : Math.max(1, Math.ceil(Math.random() * Math.max(2, Math.abs(v) * 0.2)));
            let num = v + (Math.random() > 0.5 ? paso : -paso);
            if (Math.random() < 0.15 && v !== 0) num = -v;
            cand = String(esDecimal ? parseFloat(num.toFixed(1)) : Math.round(num)).replace('.', ',');
        }
        if (cand !== correcta) out.add(cand);
    }
    let extra = 1;
    while (out.size < 3) { out.add(`${correcta}${'0'.repeat(extra++)}`); }
    return [...out];
};

export const operacionesComoPreguntas = (config) => generarOperacionesMathLive(config).map(q => {
    const enunciado = q.subtipo === 'FRACTION'
        ? `${fraccionTexto(q.f1)} ${q.operator} ${fraccionTexto(q.f2)} = ?`
        : `${q.displayA} ${q.operator} ${q.displayB} = ?`;
    return {
        tipo: 'MULTIPLE',
        pregunta: enunciado,
        correcta: q.subtipo === 'FRACTION' ? fraccionTexto(q.respuesta) : q.respuesta,
        incorrectas: distractores(q),
        tiempo: q.tiempo, puntosMax: q.puntosMax, puntosMin: q.puntosMin,
    };
});

export const NOMBRE_HOJA_OPERACIONES = '🧮 Operaciones';

// Para jugar solo / tarjetas / mandos: añade una hoja con las operaciones generadas.
// Si el recurso no tiene el bloque activado, lo devuelve tal cual.
export const recursoConOperaciones = (r) => {
    if (!tieneOperaciones(r)) return r;
    const hojaOps = { nombreHoja: NOMBRE_HOJA_OPERACIONES, preguntas: operacionesComoPreguntas(r.config) };
    // numPreguntas en un recurso con operaciones = preguntas «extra» que se suman a las operaciones
    const config = { ...r.config, numPreguntas: hojaOps.preguntas.length + (parseInt(r.config.numPreguntas) || 0) };
    if (Array.isArray(r.hojas) && r.hojas.length) {
        const hojas = r.hojas.filter(h => (h.preguntas || []).length > 0);
        return { ...r, config, hojas: [hojaOps, ...hojas] };
    }
    return { ...r, config, preguntas: [...hojaOps.preguntas, ...(r.preguntas || [])] };
};
