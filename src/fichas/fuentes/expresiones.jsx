// ─────────────────────────────────────────────────────────────────────────────
//  Fichas · EXPRESIONES ALGEBRAICAS (Math World)
//  Lo trabajado en Álgebra (Algebra.jsx): partes de monomios y polinomios,
//  lenguaje algebraico (escribir y unir con flechas), operaciones combinadas,
//  fórmulas de otras materias (valor numérico y despejar) y áreas/perímetros
//  con polinomios. Reutiliza los MISMOS generadores que la app, así que sirve
//  para trabajar en papel y después jugar (Invasión Pi, mandos) con lo mismo.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { R, N } from '../fuenteTexto';
import { polyStr } from '../../algebra/motorFactorizacion';
import { genCombMonomios, genCombPolinomios } from '../../algebra/generadoresAlgebra';
import { genPolTerm, genTraduccion, NOMBRES } from '../../algebra/Terminologia';
import {
    generarFormula, solucionFormula, infoVar, rellenar, fmt, MATERIAS,
    generarFiguraPoli, FIGURAS_POLI, DibujoFigura,
} from '../../algebra/ProblemasAlgebra';

const noCero = (a, b) => { let v; do { v = R(a, b); } while (v === 0); return v; };
const SUPd = { 1: '', 2: '²', 3: '³', 4: '⁴', 5: '⁵' };
const LETRAS = 'ABCDEFGH';
const resPol = (p) => [{ tipo: 'texto', v: [polyStr(p)], placeholder: 'p. ej. 3x^2 − 2x + 1' }];

// ── Dibujos del tema: figura con lados polinómicos y «une con flechas» ───────
function UnirVisual({ unir, size = '1.3rem' }) {
    const fs = `calc(${size} * 0.62)`;
    const punto = <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#2c3e50', display: 'inline-block', flexShrink: 0 }} />;
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(40px,0.6fr) minmax(0,1fr)', rowGap: 10, width: '100%', color: '#2c3e50', fontSize: fs, fontWeight: 600 }}>
            {unir.izq.map((t, i) => (
                <React.Fragment key={i}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}><span><b>{i + 1}.</b> {t}</span>{punto}</div>
                    <div />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{punto}<span style={{ fontFamily: 'Georgia,serif', fontWeight: 800 }}><b>{LETRAS[i]}.</b> {unir.der[i]}</span></div>
                </React.Fragment>
            ))}
        </div>
    );
}
const VisualExpresiones = ({ ap, size }) => {
    if (ap.v?.figura) return <DibujoFigura tipo={ap.v.figura.tipo} etiquetas={ap.v.figura.etiquetas} papel maxWidth={360} />;
    if (ap.v?.unir) return <UnirVisual unir={ap.v.unir} size={size} />;
    return null;
};

// ── Fórmulas ─────────────────────────────────────────────────────────────────
function apFormula(nv, cat, tipo) {
    const ej = generarFormula(nv, cat || 'todas', tipo);
    const { f, v, despejar, target } = ej;
    const sol = solucionFormula(ej);
    const t = infoVar(f, target);
    const u = (x) => (x ? ` ${x}` : '');
    const claves = despejar ? [f.sub.k, ...f.vars.map(x => x.k).filter(k => k !== target)] : f.vars.map(x => x.k);
    const datos = claves.map(k => { const x = infoVar(f, k); return `${x.sym} = ${fmt(v[k])}${u(x.u)}`; }).join(' · ');
    const formula = `${f.sub.sym} = ${rellenar(f.tpl, f, null)}`;
    const sust = despejar ? `${fmt(v[f.sub.k])} = ${rellenar(f.tpl, f, v, [target])}` : `${f.sub.sym} = ${rellenar(f.tpl, f, v)}`;
    const pregunta = despejar ? `Calcula el dato «${t.nom}» (${t.sym}).` : `Calcula ${f.sub.nom} (${f.sub.sym}).`;
    const redondeo = sol.redondeo != null ? ` Redondea a las ${['unidades', 'décimas', 'centésimas'][sol.redondeo]}.` : '';
    return {
        e: `${MATERIAS[f.mat].emoji} ${f.nombre}. ${ej.ctx}\nFórmula: ${formula}\nDatos: ${datos}\n${pregunta}${redondeo}`,
        largo: true,
        s: `${t.sym} = ${fmt(sol.valor)}${u(t.u)}`,
        pasos: [`Sustituimos: ${sust}`, ...(despejar && f.desp?.[target] ? [`Despejamos: ${t.sym} = ${rellenar(f.desp[target], f, v)}`] : [])],
        r: [{ etiqueta: `${t.sym} =`, tipo: 'num', v: sol.valor, unidad: t.u || undefined, tol: sol.tol }],
    };
}
const CAT_MATERIAS = [['todas', '🌐 Todas las materias'], ...Object.entries(MATERIAS).map(([k, m]) => [k, `${m.emoji} ${m.nom}`])];

export const EXPRESIONES = {
    id: 'expresiones', nombre: 'Expresiones algebraicas', emoji: '🔤', color: '#9b59b6', etapas: ['eso'],
    desc: 'Lenguaje algebraico, partes de monomios y polinomios, operaciones combinadas, fórmulas de otras materias y áreas con polinomios',
    Visual: VisualExpresiones,
    tipos: {
        traducir: {
            label: 'Lenguaje algebraico', titulo: 'Escribe en lenguaje algebraico (x es el número desconocido).', cols: 2, alto: 70, niveles: false,
            gen: () => {
                const it = genTraduccion(1).items[0];
                return { e: it.e, largo: true, s: it.x, r: [{ tipo: 'texto', v: [it.x], placeholder: 'p. ej. 2(x + 3)' }] };
            },
        },
        traducirUnir: {
            label: 'Unir con flechas', titulo: 'Une con flechas cada enunciado con su expresión algebraica.', cols: 1, alto: 230, max: 4, niveles: false,
            gen: () => {
                const t = genTraduccion(5);
                const izq = t.items.map(it => it.e);
                const der = t.der.map(j => t.items[j].x);
                const par = t.items.map((_, i) => [i + 1, LETRAS[t.der.indexOf(i)]]);
                return {
                    e: '', v: { unir: { izq, der } }, noJuego: true,
                    s: par.map(([n, l]) => `${n} → ${l}`).join(' · '),
                    r: [{ etiqueta: 'Parejas:', tipo: 'texto', placeholder: '1C 2A 3B…',
                        v: [par.map(([n, l]) => `${n}${l}`).join(''), par.map(([n, l]) => `${n}-${l}`).join(', '), par.map(([n, l]) => `${n}→${l}`).join(', ')] }],
                };
            },
        },
        termMonomio: {
            label: 'Partes de un monomio', titulo: 'Indica el coeficiente, la parte literal y el grado de cada monomio.', cols: 2, alto: 110,
            gen: (nv) => {
                const dos = nv >= 2 && Math.random() < 0.5;
                const a = R(1, nv === 1 ? 3 : 5), b = dos ? R(1, 3) : 0, c = noCero(-9, 9);
                const lit = `x${SUPd[a]}${b ? `y${SUPd[b]}` : ''}`;
                const coefTxt = c === 1 ? '' : c === -1 ? '−' : N(c);
                return {
                    e: `${coefTxt}${lit}`, s: `Coeficiente ${N(c)} · parte literal ${lit} · grado ${a + b}`,
                    pasos: [c === 1 || c === -1 ? `Si no se ve el número, el coeficiente es ${N(c)}` : 'El coeficiente es el número (con su signo)', ...(b ? [`Grado = ${a} + ${b} = ${a + b} (se suman los exponentes de todas las letras)`] : [])],
                    r: [{ etiqueta: 'Coeficiente:', tipo: 'num', v: c }, { etiqueta: 'Parte literal:', tipo: 'texto', v: [lit] }, { etiqueta: 'Grado:', tipo: 'num', v: a + b }],
                };
            },
        },
        termPolinomio: {
            label: 'Partes de un polinomio', titulo: 'Analiza cada polinomio (¡ojo, algunos están desordenados!).', cols: 1, alto: 150, niveles: false,
            gen: () => {
                const p = genPolTerm(), s = p.sol;
                return {
                    e: `P(x) = ${p.txt}`,
                    s: `Grado ${s.grado} · ${s.nTerm} términos · coef. principal ${N(s.principal)} · término indep. ${N(s.indep)} · ${s.nombre} · ${s.completo === 'Sí' ? 'completo' : 'incompleto'}`,
                    pasos: [`Ordenado: ${polyStr(p.c)}`],
                    r: [
                        { etiqueta: 'Grado:', tipo: 'num', v: s.grado },
                        { etiqueta: 'Nº de términos:', tipo: 'num', v: s.nTerm },
                        { etiqueta: 'Coeficiente principal:', tipo: 'num', v: s.principal },
                        { etiqueta: 'Término independiente:', tipo: 'num', v: s.indep },
                        { etiqueta: 'Se llama:', tipo: 'opcion', v: s.nombre, opciones: NOMBRES },
                        { etiqueta: '¿Es completo?', tipo: 'opcion', v: s.completo, opciones: ['Sí', 'No'] },
                    ],
                };
            },
        },
        combMonomios: {
            label: 'Combinadas con monomios', titulo: 'Resuelve respetando la jerarquía: potencias, productos y cocientes, sumas y restas.', cols: 2, alto: 100, niveles: false,
            gen: () => { const g = genCombMonomios(); return { e: `${g.expr} =`, s: polyStr(g.ans), pasos: g.pasos, r: resPol(g.ans) }; },
        },
        combPolinomios: {
            label: 'Combinadas con polinomios', titulo: 'Opera y simplifica respetando la jerarquía de las operaciones.', cols: 1, alto: 120, niveles: false,
            gen: () => { const g = genCombPolinomios(); return { e: `${g.expr} =`, s: polyStr(g.ans), pasos: g.pasos, r: resPol(g.ans) }; },
        },
        formulas: {
            label: 'Fórmulas (valor numérico)', titulo: 'Sustituye los datos en la fórmula y calcula.', cols: 1, alto: 130, max: 8,
            categorias: CAT_MATERIAS,
            gen: (nv, cat) => apFormula(nv, cat, 'valor'),
        },
        formulasDespejar: {
            label: 'Fórmulas (despejar un dato)', titulo: 'Sustituye los datos y despeja la incógnita.', cols: 1, alto: 150, max: 8,
            categorias: CAT_MATERIAS,
            gen: (nv, cat) => apFormula(nv, cat, 'despejar'),
        },
        areasPoli: {
            label: 'Áreas y perímetros con polinomios', titulo: 'Calcula el perímetro y el área como polinomios (y su valor numérico si se pide).', cols: 1, alto: 300, max: 4,
            categorias: [['todas', '📐 Todas las figuras'], ...Object.entries(FIGURAS_POLI)],
            gen: (nv, cat) => {
                const ej = generarFiguraPoli(nv, cat && cat !== 'todas' ? cat : 'todas', 'aveces');
                const medidas = ej.lados.map(([n, p]) => `${n}: ${polyStr(p)}`).join(' · ');
                const pide = ej.P ? 'Calcula el polinomio del perímetro P(x) y el del área A(x)' : `Calcula el polinomio del área A(x)${ej.sombreada ? ' de la zona coloreada' : ''}`;
                const extra = ej.enunciadoX ? `. ${ej.enunciadoX}` : ej.conValor ? `, y su valor numérico para x = ${ej.x0}.` : '.';
                return {
                    e: `${ej.nombre} (medidas en cm) → ${medidas}.\n${pide}${extra}`, largo: true,
                    v: { figura: { tipo: ej.tipo, etiquetas: ej.lados.map(([, p]) => polyStr(p)) } },
                    s: ej.preguntas.map(q => `${q.lbl} ${q.tipo === 'poly' ? polyStr(q.ans) : q.ans}${q.unit ? ' ' + q.unit : ''}`).join(' · '),
                    pasos: ej.preguntas.map(q => q.exp),
                    r: ej.preguntas.map(q => (q.tipo === 'poly'
                        ? { etiqueta: q.lbl, tipo: 'texto', v: [polyStr(q.ans)], placeholder: 'p. ej. 2x^2 + 7x + 3' }
                        : { etiqueta: q.lbl, tipo: 'num', v: q.ans, unidad: q.unit || undefined })),
                };
            },
        },
    },
};
