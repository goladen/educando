import React from 'react';
import { LISTA_MAGNITUDES, factoresEntre, unidad, unidadesDe, leerNumero, fmt, fmtFactor, conU } from './magnitudes.js';

// ─────────────────────────────────────────────────────────────────────────────
//  FACTORES DE CONVERSIÓN PARA RELLENAR: el alumno escribe cada factor
//  (número y unidad arriba y abajo). Vale cualquier factor correcto que sea
//  igual a 1 y deje la unidad que se quiere quitar ABAJO (1000 m / 1 km o
//  1 m / 0,001 km). Si pone la unidad al revés, se le explica.
// ─────────────────────────────────────────────────────────────────────────────

// símbolo → { mag, si } de las unidades simples (las compuestas se rellenan por partes)
const SIMPLES = {};
LISTA_MAGNITUDES.forEach((m) => m.unidades.forEach((u) => {
    if (u.si != null && !u.num && !SIMPLES[u.s]) SIMPLES[u.s] = { mag: m.id, si: u.si };
}));

/** ¿Se puede pedir el factor de esta conversión? (no en temperatura ni con radianes/π) */
export const factoresRellenables = (v) => !!v && v.clase === 'conv' && v.mag !== 'temperatura'
    && !['rad'].includes(v.de) && !['rad'].includes(v.a) && factoresEntre(v.mag, v.de, v.a).every((f) => SIMPLES[f.arriba[1]] && SIMPLES[f.abajo[1]]);

/** Unidades para elegir en un factor: las de las magnitudes de sus dos unidades. */
const opcionesDe = (f) => {
    const mags = [...new Set([SIMPLES[f.arriba[1]]?.mag, SIMPLES[f.abajo[1]]?.mag].filter(Boolean))];
    const us = mags.flatMap((m) => unidadesDe(m, 3).filter((s) => SIMPLES[s]));
    return [...new Set(us)];
};

/** ¿El factor i cambia el denominador de la unidad compuesta? */
export const esFactorDenominador = (v, f) => { const ud = unidad(v.mag, v.de); return !!ud?.den && f.arriba[1] === ud.den[1]; };

export const factorVacio = () => ({ an: '', au: '', bn: '', bu: '' });

/**
 * Corrige un factor escrito: { ok, completo, motivo }.
 * esperado = { arriba: [k, unidad], abajo: [k, unidad] }
 */
// den: el factor cambia la unidad del DENOMINADOR de una compuesta (h de km/h): la que se quita va ARRIBA
export function comprobarFactor(esperado, e, den = false) {
    const an = leerNumero(e.an), bn = leerNumero(e.bn);
    if (!e.au || !e.bu || !Number.isFinite(an) || !Number.isFinite(bn)) return { ok: false, completo: false, motivo: 'Completa los dos números y las dos unidades.' };
    if (an <= 0 || bn <= 0) return { ok: false, completo: true, motivo: 'Los números del factor tienen que ser positivos.' };
    const [, uArriba] = esperado.arriba, [, uAbajo] = esperado.abajo;
    if (e.au === uAbajo && e.bu === uArriba) return { ok: false, completo: true, motivo: den
        ? `Está al revés: ${uArriba} está abajo en la unidad compuesta, así que en el factor va ARRIBA para que se simplifique.`
        : `Está al revés: ${uAbajo} es la unidad que quieres quitar, tiene que ir ABAJO para que se simplifique.` };
    if (e.au !== uArriba || e.bu !== uAbajo) return { ok: false, completo: true, motivo: den
        ? `En este factor arriba va ${uArriba} (para quitarla del denominador) y abajo ${uAbajo} (la que quieres en el denominador).`
        : `Arriba va la unidad a la que quieres llegar (${uArriba}) y abajo la que quieres quitar (${uAbajo}).` };
    // el factor tiene que valer 1: an · si(arriba) = bn · si(abajo)
    const izq = an * SIMPLES[e.au].si, der = bn * SIMPLES[e.bu].si;
    const ok = Math.abs(izq - der) <= Math.max(izq, der) * 1e-6;
    return { ok, completo: true, motivo: ok ? '' : `${conU(fmt(bn), e.bu)} no son ${conU(fmt(an), e.au)}: el factor tiene que valer 1.` };
}

const caja = { padding: '6px 8px', borderRadius: 8, border: '2px solid #cbd5e1', fontSize: '1.05rem', fontWeight: 800, width: 92, textAlign: 'right', fontFamily: 'inherit' };
const sel = { padding: '6px 4px', borderRadius: 8, border: '2px solid #cbd5e1', fontSize: '1rem', fontWeight: 800, background: 'white', fontFamily: 'inherit' };

function Fila({ n, u, onN, onU, opciones, color, disabled }) {
    return (
        <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
            <input value={n} onChange={(e) => onN(e.target.value)} disabled={disabled} inputMode="decimal" placeholder="nº" style={{ ...caja, borderColor: color }} />
            <select value={u} onChange={(e) => onU(e.target.value)} disabled={disabled} style={{ ...sel, borderColor: color }}>
                <option value="">unidad</option>
                {opciones.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
        </span>
    );
}

/**
 * valor de · ( __ __ / __ __ ) · … = (resultado abajo, en la casilla de siempre)
 * entradas: [{ an, au, bn, bu }] · correccion: null | [{ ok, motivo }]
 */
export default function FactoresEditables({ v, entradas, setEntradas, correccion = null }) {
    const fs = factoresEntre(v.mag, v.de, v.a);
    const ud = unidad(v.mag, v.de);
    const cambiar = (i, campo, valor) => setEntradas((xs) => xs.map((x, k) => (k === i ? { ...x, [campo]: valor } : x)));
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
            <div style={{ fontWeight: 800, color: '#7c3aed', fontSize: '0.92rem', textAlign: 'center' }}>
                🔁 Escribe {fs.length > 1 ? 'los factores' : 'el factor'} de conversión: arriba la unidad a la que llegas, abajo la que quieres quitar
                {ud?.num && <> (unidad compuesta: un factor para la de arriba y otro para la de abajo)</>}.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'center', fontWeight: 800, fontSize: '1.15rem', color: '#0f172a' }}>
                <span>{conU(fmt(v.valor), v.de)}</span>
                {fs.map((f, i) => {
                    const c = correccion?.[i];
                    const color = c ? (c.ok ? '#16a34a' : '#dc2626') : '#a78bfa';
                    const e = entradas[i] || factorVacio();
                    const op = opcionesDe(f);
                    return (
                        <React.Fragment key={i}>
                            <span>·</span>
                            <span style={{ fontSize: '2rem', color: '#94a3b8', fontWeight: 300 }}>(</span>
                            <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                <Fila n={e.an} u={e.au} onN={(x) => cambiar(i, 'an', x)} onU={(x) => cambiar(i, 'au', x)} opciones={op} color={color} disabled={!!correccion} />
                                <span style={{ width: '100%', height: 3, background: color, borderRadius: 2 }} />
                                <Fila n={e.bn} u={e.bu} onN={(x) => cambiar(i, 'bn', x)} onU={(x) => cambiar(i, 'bu', x)} opciones={op} color={color} disabled={!!correccion} />
                            </span>
                            <span style={{ fontSize: '2rem', color: '#94a3b8', fontWeight: 300 }}>)</span>
                        </React.Fragment>
                    );
                })}
                <span>= ?</span>
            </div>
            {correccion && fs.map((f, i) => !correccion[i]?.ok && (
                <div key={i} style={{ color: '#b91c1c', fontWeight: 700, fontSize: '0.9rem', textAlign: 'center' }}>
                    ❌ Factor {fs.length > 1 ? i + 1 : ''}: {correccion[i]?.motivo} Uno correcto: ({fmtFactor(f.arriba[0])} {f.arriba[1]} / {fmtFactor(f.abajo[0])} {f.abajo[1]})
                </div>
            ))}
        </div>
    );
}
