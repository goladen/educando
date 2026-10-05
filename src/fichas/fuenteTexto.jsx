import React from 'react';
import { leerNumeroEs } from '../generadorProblemasNumeros';

// ─────────────────────────────────────────────────────────────────────────────
//  FUENTES DE TEXTO para las fichas de Math World
//  Convierte una definición sencilla de tema (generadores que devuelven texto)
//  en una «fuente» con la interfaz de motor de FichasImprimibles.
//
//  Definición de un tema:
//    { id, nombre, emoji, color, etapas: ['primaria'|'eso'|'bach'], desc,
//      tipos: { clave: { label, titulo, cols?, alto?, max?, niveles?: false, gen(nivel) → apartado } } }
//  Apartado que devuelve gen(nivel):
//    { e: enunciado, s: solución, pasos?: [..], largo?: bool,
//      r?: [{ etiqueta?, tipo: 'num'|'frac'|'texto'|'opcion', v, unidad?, opciones?, tol? }] }
//  En la pizarra se revela un paso por clic y, al final, la solución.
// ─────────────────────────────────────────────────────────────────────────────

// ── Utilidades de formato (español) ──────────────────────────────────────────
export const R = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const mcd = (a, b) => (b ? mcd(b, a % b) : Math.abs(a));
export const mcm = (a, b) => Math.abs(a * b) / (mcd(a, b) || 1);
export const N = (x) => {
    const v = Math.round(x * 1000) / 1000;
    return (v < 0 ? '−' : '') + String(Math.abs(v)).replace('.', ',');
};
export const P = (x) => (x < 0 ? `(${N(x)})` : N(x)); // negativo entre paréntesis
export const frac = (n, d) => {
    if (d < 0) { n = -n; d = -d; }
    const g = mcd(n, d) || 1;
    n /= g; d /= g;
    return d === 1 ? N(n) : `${n < 0 ? '−' : ''}${Math.abs(n)}/${d}`;
};
// Término «ax» bien escrito: 1x → x, −1x → −x, 0 → ''
export const termino = (coef, letra, primero = false) => {
    if (coef === 0) return '';
    const abs = Math.abs(coef);
    const cuerpo = `${abs === 1 && letra ? '' : abs}${letra}`;
    if (primero) return (coef < 0 ? '−' : '') + cuerpo;
    return (coef < 0 ? ' − ' : ' + ') + cuerpo;
};
// Polinomio a partir de coeficientes [an, …, a0] con letra x
export const polinomio = (coefs, x = 'x') => {
    const g = coefs.length - 1;
    let out = '';
    coefs.forEach((c, i) => {
        const e = g - i;
        const letra = e === 0 ? '' : e === 1 ? x : `${x}${SUP[e] || '^' + e}`;
        const t = termino(c, letra, out === '');
        out += t;
    });
    return out || '0';
};
export const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
export const sup = (n) => String(n).split('').map(c => (c === '-' ? '⁻' : SUP[c] || c)).join('');

// ── Comprobación de respuestas ───────────────────────────────────────────────
const leerFrac = (txt) => {
    const t = String(txt || '').trim().replace(/\s/g, '').replace(/[−–]/g, '-');
    const m = t.match(/^(-?\d+)\/(-?\d+)$/);
    if (m) return Number(m[2]) ? Number(m[1]) / Number(m[2]) : NaN;
    return leerNumeroEs(t);
};
const SUP_INV = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-' };
// Para comparar textos: sin espacios, «−» → «-», superíndices → ^n, «4,5·10^7» = «4.5x10^7»
// (también sin tildes ni signos: «Corazón» = «corazon», «¡París!» = «paris»)
const normalizar = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[¡!¿?«»"'“”]/g, '').replace(/\.$/, '').replace(/\s/g, '').replace(/[−–]/g, '-')
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, m => '^' + m.split('').map(c => SUP_INV[c]).join(''))
    .replace(/(\d)x10/g, '$110').replace(/[·*]/g, '').replace(/,/g, '.');
export const comprobador = (q) => (valor) => {
    if (q.tipo === 'opcion') return { ok: valor === q.v };
    if (q.tipo === 'texto') {
        const t = normalizar(valor);
        if (!t) return null;
        return { ok: [].concat(q.v).some(v => normalizar(v) === t) };
    }
    const v = q.tipo === 'frac' ? leerFrac(valor) : leerNumeroEs(String(valor || '').replace('%', ''));
    if (Number.isNaN(v)) return null;
    return { ok: Math.abs(v - q.v) <= (q.tol ?? 0.01) };
};

// ── Fuente a partir de la definición ─────────────────────────────────────────
export const crearFuente = (def) => {
    const tipoDe = (x) => def.tipos[x.tipo] || Object.values(def.tipos)[0];

    const generarApartados = (ej, n, existentes = []) => {
        const t = tipoDe(ej);
        const clave = (a) => `${a.e}|${a.img || ''}|${JSON.stringify(a.v ?? '')}`; // con imagen o dibujo el texto puede repetirse
        const vistos = new Set(existentes.map(clave));
        const out = [];
        for (let i = 0; out.length < n && i < n * 40; i++) {
            const a = t.gen(ej.nivel || 1);
            if (!a || vistos.has(clave(a))) continue;
            vistos.add(clave(a));
            out.push({ tipo: ej.tipo, ...a });
        }
        // t.repetir: si se agotan los distintos (p. ej. 8 notas), se permiten repeticiones
        for (let i = 0; t.repetir && out.length < n && i < n * 10; i++) { const a = t.gen(ej.nivel || 1); if (a) out.push({ tipo: ej.tipo, ...a }); }
        return out;
    };

    // ap.img: imagen (misma web o con CORS, para que salga en el PDF) · def.Visual: dibujo propio del tema
    const Visual = def.Visual;
    const Enunciado = ({ ap, size = '1.4rem' }) => {
        const texto = ap.largo
            ? <p style={{ margin: 0, fontSize: `calc(${size} * 0.62)`, lineHeight: 1.5, color: '#2c3e50', fontWeight: 600, whiteSpace: 'pre-line' }}>{ap.e}</p>
            : <span style={{ fontSize: `calc(${size} * 0.8)`, fontWeight: 800, color: '#2c3e50', whiteSpace: 'pre-line' }}>{ap.e}</span>;
        if (!ap.img && !(Visual && ap.v)) return texto;
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                {ap.img && <img src={ap.img} alt="" crossOrigin="anonymous" style={{ height: `calc(${size} * ${ap.imgAlto || 3.2})`, maxWidth: '100%', objectFit: 'contain', borderRadius: 8, border: '1px solid #eee', background: 'white' }} />}
                {Visual && ap.v && <Visual ap={ap} size={size} />}
                {ap.e && texto}
            </div>
        );
    };

    const Solucion = ({ ap }) => (
        <div style={{ color: '#c0392b', fontSize: '0.85rem', fontWeight: 700, lineHeight: 1.5 }}>
            <div style={{ fontSize: '1.02rem', fontWeight: 900 }}>{ap.s}</div>
            {ap.pasos?.length > 0 && <div style={{ color: '#7f8c8d', fontWeight: 600 }}>{ap.pasos.join(' · ')}</div>}
        </div>
    );

    const pasosMax = (ap) => (ap.pasos?.length || 0) + 1;

    const RespuestaInline = () => null;

    const Revelado = ({ ap, vis, zoom }) => {
        if (vis < 1) return null;
        const pasos = ap.pasos || [];
        const final = vis >= pasosMax(ap);
        return (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6, fontSize: `${1.05 * zoom}rem` }}>
                {pasos.slice(0, vis).map((p, i) => (
                    <div key={i} style={{ fontWeight: 700, color: '#2c3e50' }}><span style={{ color: '#95a5a6' }}>→ </span>{p}</div>
                ))}
                {final && (
                    <div style={{ marginTop: 4, background: '#e8f5e9', borderRadius: 12, padding: '8px 12px', fontWeight: 900, color: '#1e8449', fontSize: `${1.2 * zoom}rem` }}>✅ {ap.s}</div>
                )}
            </div>
        );
    };

    // 'frac' y 'texto' usan una casilla de texto libre; 'num' el teclado numérico
    const respuestas = (ap) => (ap.r || []).map(q => ({
        etiqueta: q.etiqueta, unidad: q.unidad, opciones: q.opciones, comprobar: comprobador(q),
        tipo: q.tipo === 'opcion' ? 'opcion' : q.tipo === 'num' ? 'num' : 'frac',
        placeholder: q.placeholder || (q.tipo === 'texto' ? 'escribe aquí' : undefined),
    }));

    const titulos = Object.fromEntries(Object.entries(def.tipos).map(([k, t]) => [k, t.titulo]));
    const tipos = Object.fromEntries(Object.entries(def.tipos).map(([k, t]) => [k, { label: t.label, color: t.color || def.color }]));

    return {
        id: def.id, nombre: def.nombre, emoji: def.emoji, color: def.color, etapas: def.etapas, desc: def.desc,
        tipos, titulos,
        layout: (ej) => { const t = tipoDe(ej); return { cols: t.cols || 2, alto: t.alto || 80 }; },
        generarApartados,
        maxApartados: (ej) => tipoDe(ej).max || 12,
        usaNivel: (tipo) => (def.tipos[tipo]?.niveles !== false),
        esTexto: (ap) => !!ap.largo,
        sizeHoja: () => '1.3rem',
        Enunciado, Solucion, pasosMax, RespuestaInline, Revelado, respuestas,
    };
};
