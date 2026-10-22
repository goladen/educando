// Lectura y corrección de las respuestas del alumno en «Uso de la calculadora».
// Admite: 10,05 · −3 · 19/12 · 1 7/12 · 1⌟7⌟12 · 5,99·10^23 · 5.99e23 ·
// 2,5×10¹³ · 37°48′0″ · 37°48'0" · 37°48°0 (formato de la fx-82MS) · 1h 25min 48s

const SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-' };

const limpiar = (s) => String(s ?? '')
    .trim()
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, m => '^' + m.split('').map(c => SUP[c]).join(''))
    .replace(/[−–]/g, '-')
    .replace(/\s+/g, ' ');

const num = (s) => {
    const t = String(s).replace(',', '.').trim();
    return /^-?\d*\.?\d+$/.test(t) ? Number(t) : NaN;
};

// Devuelve { valor, forma: 'decimal'|'fraccion'|'sexagesimal', n?, d? } o null
export function leerRespuesta(texto) {
    const s = limpiar(texto);
    if (!s) return null;

    // Sexagesimal: 37°48′0″, 37°48'0", 37°48°0, 1h 25min 48s
    let m = s.match(/^(-?\d+(?:[.,]\d+)?)\s*(?:°|º|h)\s*(?:(\d+(?:[.,]\d+)?)\s*(?:′|'|°|º|min|m)\s*)?(?:(\d+(?:[.,]\d+)?)\s*(?:″|"|''|s|°|º)?)?$/i);
    if (m && /[°ºh]/i.test(s)) {
        const g = num(m[1]), mi = m[2] ? num(m[2]) : 0, se = m[3] ? num(m[3]) : 0;
        const signo = g < 0 || s.startsWith('-') ? -1 : 1;
        return { valor: signo * (Math.abs(g) + mi / 60 + se / 3600), forma: 'sexagesimal' };
    }

    // Fracción mixta: 1 7/12  ·  1⌟7⌟12
    m = s.match(/^(-?\d+)\s*(?:\s|⌟)\s*(\d+)\s*[/⌟]\s*(\d+)$/);
    if (m) {
        const e = Number(m[1]), n = Number(m[2]), d = Number(m[3]);
        if (!d) return null;
        const signo = m[1].startsWith('-') ? -1 : 1;
        const nn = signo * (Math.abs(e) * d + n);
        return { valor: nn / d, forma: 'fraccion', n: nn, d };
    }

    // Fracción simple: 19/12 · 19⌟12
    m = s.match(/^(-?\d+)\s*[/⌟]\s*(-?\d+)$/);
    if (m) {
        const n = Number(m[1]), d = Number(m[2]);
        if (!d) return null;
        return { valor: n / d, forma: 'fraccion', n, d };
    }

    // Notación científica: 5,99·10^23 · 5.99x10^-3 · 5,99e23 · 5.99 ×10 23
    m = s.replace(/\s/g, '').match(/^(-?\d*[.,]?\d+)(?:[x×·*]10\^?|e|E)\+?(-?\d+)$/);
    if (m) {
        const a = num(m[1]), b = Number(m[2]);
        if (Number.isFinite(a)) return { valor: a * 10 ** b, forma: 'decimal' };
    }

    // Decimal (admite separador de miles con espacio: 10 042)
    const v = num(s.replace(/(\d) (?=\d{3}\b)/g, '$1'));
    if (Number.isFinite(v)) return { valor: v, forma: 'decimal' };
    return null;
}

const mcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };

const valorEsperado = (resp) => (typeof resp === 'string' ? leerRespuesta(resp)?.valor : resp);

// Comprueba la respuesta de un reto (o de un paso de una serie).
// cfg: { respuesta, tipo, tol, tolRel, irreducible }
// → { ok, motivo? }
export function comprobar(texto, cfg) {
    const r = leerRespuesta(texto);
    if (!r) return { ok: false, motivo: 'No entiendo ese número. Usa coma o punto para los decimales, / para fracciones y °′″ para el sistema sexagesimal.' };
    const esperado = valorEsperado(cfg.respuesta);
    const tipo = cfg.tipo || 'numero';

    if (tipo === 'fraccion') {
        if (r.forma !== 'fraccion') return { ok: false, motivo: 'Escribe la respuesta como fracción, por ejemplo 19/12 o 1 7/12.' };
        if (Math.abs(r.valor - esperado) > 1e-9) return { ok: false };
        if (cfg.irreducible && mcd(r.n, r.d) !== 1) return { ok: false, motivo: 'El valor es correcto, pero la fracción aún se puede simplificar.' };
        return { ok: true };
    }
    if (tipo === 'sexagesimal') {
        if (r.forma !== 'sexagesimal') return { ok: false, motivo: 'Escríbelo en grados (u horas), minutos y segundos: por ejemplo 12°30′15″ o 12°30\'15".' };
        return { ok: Math.abs(r.valor - esperado) <= 0.6 / 3600 };
    }
    const tolAbs = cfg.tol ?? (tipo === 'entero' ? 0 : 1e-6);
    const tolR = cfg.tolRel ? Math.abs(esperado) * cfg.tolRel : 0;
    return { ok: Math.abs(r.valor - esperado) <= Math.max(tolAbs, tolR) + 1e-12 };
}

// Texto bonito de un número (coma decimal, notación científica si hace falta)
export function formatear(v) {
    if (typeof v === 'string') return v;
    if (!Number.isFinite(v)) return String(v);
    const a = Math.abs(v);
    if (a !== 0 && (a >= 1e10 || a < 1e-4)) {
        const [m, e] = v.toExponential(3).split('e');
        return `${String(Number(m)).replace('.', ',')}·10^${Number(e)}`;
    }
    return String(Number(v.toPrecision(10))).replace('.', ',');
}
