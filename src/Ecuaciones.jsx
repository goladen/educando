import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, CheckCircle, XCircle, Trophy, Clock, Calculator, Settings, SkipForward, Monitor, Loader, Users, Send } from 'lucide-react';
import Confetti from 'react-confetti';
import { db } from './firebase';
import { doc, setDoc, updateDoc, onSnapshot, increment, collection, addDoc, getDoc } from 'firebase/firestore';
import piHappy from './assets/Pi-contento.png';
import piAngry from './assets/Pi-enfadado.png';
import piNeutral from './assets/Pi-neutro.png';
import correctSoundFile from './assets/correct-choice-43861.mp3';
import wrongSoundFile from './assets/negative_beeps-6008.mp3';
import winSoundFile from './assets/applause-small-audience-97257.mp3';
import startSoundFile from './assets/inicio-juego.mp3';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const rInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const rNonZero = (min, max) => { let v = 0; while (v === 0) v = rInt(min, max); return v; };

const fmt1 = (coeff, variable = '') => {
    if (coeff === 0) return '';
    if (!variable) return `${coeff}`;
    if (coeff === 1) return variable;
    if (coeff === -1) return `-${variable}`;
    return `${coeff}${variable}`;
};
const fmt2 = (coeff, variable = '') => {
    if (coeff === 0) return '';
    const s = fmt1(Math.abs(coeff), variable);
    return coeff > 0 ? `+ ${s}` : `- ${s}`;
};
const buildSide = (cx, cn) => {
    if (cx === 0 && cn === 0) return "0";
    let s = "";
    if (cx !== 0) s += fmt1(cx, 'x');
    if (cn !== 0) { s += s !== "" ? ` ${fmt2(cn)}` : `${cn}`; }
    return s;
};

// ─── Banco de enunciados ──────────────────────────────────────────────────────
const ENUNCIADOS = [
    // Suma / Resta básica
    { t: "El doble de un número más tres es quince.", eq: "2x + 3 = 15", w: ["2(x + 3) = 15", "x/2 + 3 = 15", "3x + 2 = 15"] },
    { t: "La mitad de un número menos cuatro es seis.", eq: "x/2 - 4 = 6", w: ["x - 4/2 = 6", "2x - 4 = 6", "x/2 = 6 - 4"] },
    { t: "La suma de un número y su siguiente es trece.", eq: "x + (x + 1) = 13", w: ["x + x + 2 = 13", "2x = 13", "x · (x+1) = 13"] },
    { t: "El triple de la diferencia entre un número y dos es doce.", eq: "3(x - 2) = 12", w: ["3x - 2 = 12", "x/3 - 2 = 12", "3 - 2x = 12"] },
    { t: "El cuadrado de un número es cuarenta y nueve.", eq: "x² = 49", w: ["2x = 49", "x/2 = 49", "x = 49²"] },
    { t: "Un número más su mitad es quince.", eq: "x + x/2 = 15", w: ["x/2 = 15", "2x + x = 15", "x + 2 = 15"] },
    { t: "El cuádruple de un número es igual a ese número más doce.", eq: "4x = x + 12", w: ["x/4 = x + 12", "4(x + 1) = 12", "4x + 12 = x"] },
    { t: "Un número aumentado en siete es igual a veinte.", eq: "x + 7 = 20", w: ["7x = 20", "x - 7 = 20", "x · 7 = 20"] },
    { t: "Al restar ocho a un número el resultado es once.", eq: "x - 8 = 11", w: ["8 - x = 11", "x + 8 = 11", "x/8 = 11"] },
    { t: "El triple de un número menos cinco es dieciséis.", eq: "3x - 5 = 16", w: ["3(x - 5) = 16", "5x - 3 = 16", "3x + 5 = 16"] },
    { t: "La quinta parte de un número más dos es siete.", eq: "x/5 + 2 = 7", w: ["5x + 2 = 7", "x/5 - 2 = 7", "x + 2/5 = 7"] },
    { t: "Un número dividido entre cuatro es igual a nueve.", eq: "x/4 = 9", w: ["4x = 9", "x - 4 = 9", "x/9 = 4"] },
    // Problemas de edades
    { t: "Ana tiene el doble de años que Luis. La suma de sus edades es veinticuatro.", eq: "2x + x = 24", w: ["x + x = 24", "2x - x = 24", "x/2 + x = 24"] },
    { t: "Juan tiene cinco años más que María. Juntos suman treinta y uno.", eq: "x + (x + 5) = 31", w: ["x + 5x = 31", "x · (x+5) = 31", "2x - 5 = 31"] },
    { t: "El padre tiene el triple de años que su hija. La diferencia de edades es veintiocho.", eq: "3x - x = 28", w: ["3x + x = 28", "x/3 - x = 28", "3(x - x) = 28"] },
    { t: "Dentro de seis años tendré el doble de los años que tengo ahora.", eq: "x + 6 = 2x", w: ["2x + 6 = x", "x - 6 = 2x", "x + 6 = 2(x+6)"] },
    // Problemas de dinero
    { t: "Tengo el doble de dinero que mi hermano y entre los dos sumamos treinta euros.", eq: "2x + x = 30", w: ["x + 2x = 60", "x/2 + x = 30", "2(x + x) = 30"] },
    { t: "Compré tres bolígrafos y me sobraron dos euros de los doce que llevaba.", eq: "3x + 2 = 12", w: ["3x - 2 = 12", "3(x + 2) = 12", "x/3 + 2 = 12"] },
    { t: "Un libro cuesta el triple que un cuaderno. Juntos cuestan veinte euros.", eq: "3x + x = 20", w: ["x + 3 = 20", "3x - x = 20", "x · 3 = 20"] },
    { t: "Si gasto quince euros de mis ahorros me quedan el doble de lo que gasté.", eq: "x - 15 = 2 · 15", w: ["x - 15 = 2x", "x + 15 = 2 · 15", "x/15 = 2"] },
    // Problemas de longitudes / áreas
    { t: "El largo de un rectángulo es el doble del ancho. El perímetro es treinta.", eq: "2(2x + x) = 30", w: ["2x + x = 30", "2x · x = 30", "4x + 2x = 60"] },
    { t: "La base de un triángulo es tres veces la altura. El área es veinticuatro.", eq: "3x · x / 2 = 24", w: ["3x + x = 24", "3x · x = 24", "x · 3 / 2 = 24"] },
    { t: "Dos lados consecutivos de un rectángulo suman dieciocho y uno es cuatro más que el otro.", eq: "x + (x + 4) = 18", w: ["x · (x + 4) = 18", "2x + 4 = 18", "x - (x + 4) = 18"] },
    // Problemas de mezclas / velocidad
    { t: "Un tren recorre una distancia en tres horas a 80 km/h. ¿Cuánto tardaría a x km/h si la distancia es la misma?", eq: "80 · 3 = x · 4", w: ["80/3 = x/4", "x · 3 = 80 · 4", "80 + 3 = x + 4"] },
    { t: "El numerador de una fracción vale la mitad del denominador y la fracción equivale a un tercio.", eq: "x / (2x) = 1/3", w: ["2x / x = 1/3", "x / x = 1/3", "x / (x+2) = 1/3"] },
    // Consecutivos
    { t: "Tres números consecutivos suman veinticuatro.", eq: "x + (x+1) + (x+2) = 24", w: ["3x = 24", "x + x + x = 24", "x(x+1)(x+2) = 24"] },
    { t: "Dos números pares consecutivos suman veintidós.", eq: "x + (x + 2) = 22", w: ["x + (x+1) = 22", "2x + 2 = 44", "x · (x+2) = 22"] },
    { t: "Cuatro números impares consecutivos suman cuarenta.", eq: "x + (x+2) + (x+4) + (x+6) = 40", w: ["4x = 40", "x + x + x + x = 40", "x(x+2)(x+4)(x+6) = 40"] },
    // Segundo grado
    { t: "El área de un cuadrado es ochenta y un metros cuadrados.", eq: "x² = 81", w: ["2x = 81", "x/2 = 81", "4x = 81"] },
    { t: "Un número multiplicado por su siguiente consecutivo es doce.", eq: "x(x + 1) = 12", w: ["x + (x+1) = 12", "x² = 12", "x(x-1) = 12"] },
    { t: "La suma de los cuadrados de dos consecutivos es cuarenta y uno.", eq: "x² + (x+1)² = 41", w: ["x + (x+1) = 41", "(x + x+1)² = 41", "x² · (x+1)² = 41"] },
    { t: "Un rectángulo tiene base doble que la altura y área de cincuenta.", eq: "2x · x = 50", w: ["2x + x = 50", "(2x)² = 50", "x(x+2) = 50"] },
];

// ─── Configuración por defecto ────────────────────────────────────────────────
const DEFAULT_CONFIG = {
    tiempo: 180,
    minNum: 1,
    maxNum: 10,
    primerGrado: true,
    segundoGrado: false,
    conDenominadores: false,
    conParentesis: false,
    conEnunciados: false,
    numPantallas: 1,   // 1 | 2 | 3
    numAlumnos: 1,     // 1 = sin etiquetas, >1 = cicla por alumnos
};

// Modos predefinidos (equivalentes a los originales) + Personalizado
const MODOS_PRESET = [
    {
        id: 'BASIC', icon: '👶', label: 'Básico', desc: 'x+a=b, x-a=b, ax=b, x/a=b', color: '#2ecc71',
        cfg: { tiempo: 180, minNum: 2, maxNum: 20, primerGrado: true, soloBasico: true,
               segundoGrado: false, conDenominadores: false, conParentesis: false, conEnunciados: false }
    },
    {
        id: 'SIMPLE', icon: '📝', label: 'Sencillo', desc: 'ax+b = cx+d · sin paréntesis', color: '#3498db',
        cfg: { tiempo: 180, minNum: 1, maxNum: 10, primerGrado: true, soloBasico: false,
               segundoGrado: false, conDenominadores: false, conParentesis: false, conEnunciados: false }
    },
    {
        id: 'MEDIUM', icon: '🤓', label: 'Medio', desc: 'Con paréntesis o un denominador', color: '#f39c12',
        cfg: { tiempo: 180, minNum: 1, maxNum: 8, primerGrado: true, soloBasico: false,
               segundoGrado: false, conDenominadores: true, conParentesis: true, conEnunciados: false }
    },
    {
        id: 'EXPERT', icon: '🔥', label: 'Experto', desc: 'Paréntesis y denominadores', color: '#e74c3c',
        cfg: { tiempo: 180, minNum: 1, maxNum: 8, primerGrado: true, soloBasico: false,
               segundoGrado: false, conDenominadores: true, conParentesis: true, conEnunciados: false,
               forceExperto: true }
    },
    {
        id: 'QUADRATIC', icon: '📈', label: '2.º Grado', desc: 'Completas e incompletas', color: '#9b59b6',
        cfg: { tiempo: 180, minNum: 1, maxNum: 7, primerGrado: false, soloBasico: false,
               segundoGrado: true, conDenominadores: false, conParentesis: false, conEnunciados: false }
    },
    {
        id: 'TEXT', icon: '🗣️', label: 'Enunciados', desc: 'Asocia el texto a su ecuación', color: '#34495e',
        cfg: { tiempo: 180, minNum: 1, maxNum: 10, primerGrado: false, soloBasico: false,
               segundoGrado: false, conDenominadores: false, conParentesis: false, conEnunciados: true }
    },
    {
        id: 'CUSTOM', icon: '⚙️', label: 'Personalizado', desc: 'Elige el tipo, dificultad y tiempo', color: '#8e44ad',
        cfg: null
    },
];

// ─── Generador de ecuaciones ──────────────────────────────────────────────────
const generarEcuacion = (cfg, enunciadosBag = null) => {
    const { minNum, maxNum, primerGrado, segundoGrado, conDenominadores, conParentesis, conEnunciados } = cfg;
    const lim = Math.max(2, Math.min(maxNum, 12));
    const X = rInt(-lim, lim);

    let ast = [];
    let correctAnswers = [];
    let multipleChoice = null;
    let tipo = '';

    // Decidir qué tipo generar
    const { soloBasico, forceExperto } = cfg;
    const opciones = [];
    if (primerGrado) {
        if (soloBasico) {
            opciones.push('BASICA');
        } else if (forceExperto) {
            opciones.push('EXPERTO');
        } else if (!conParentesis && !conDenominadores) {
            opciones.push('BASICA', 'SIMPLE');
        } else {
            if (conParentesis) opciones.push('PARENTESIS');
            if (conDenominadores) opciones.push('DENOMINADOR');
            if (conParentesis && conDenominadores) opciones.push('EXPERTO');
            if (!opciones.length) opciones.push('SIMPLE');
        }
    }
    if (segundoGrado) {
        // Tres subtipos de cuadrática con igual probabilidad
        opciones.push('CUAD_COMPLETA', 'CUAD_SIN_B', 'CUAD_SIN_C');
    }
    if (conEnunciados) opciones.push('ENUNCIADO');

    if (opciones.length === 0) {
        ast.push({ t: 'text', v: 'Activa al menos una opción' });
        return { ast, correctAnswers: [0], multipleChoice: null };
    }

    tipo = opciones[Math.floor(Math.random() * opciones.length)];

    if (tipo === 'BASICA') {
        // Nivel básico: la solución siempre es positiva
        const Xpos = rInt(1, lim);
        const type = rInt(1, 4);
        const a = rInt(Math.max(1, minNum), lim);
        if (type === 1) {
            ast.push({ t: 'text', v: `x + ${a} = ${Xpos + a}` });
        } else if (type === 2) {
            ast.push({ t: 'text', v: `x - ${a} = ${Xpos - a}` });
        } else if (type === 3) {
            ast.push({ t: 'text', v: `${a}x = ${a * Xpos}` });
        } else {
            const realX = a * rInt(1, Math.floor(lim / a));
            ast = [{ t: 'frac', n: 'x', d: a }, { t: 'text', v: ` = ${realX / a}` }];
            correctAnswers = [realX];
            return { ast, correctAnswers, multipleChoice, tipo };
        }
        correctAnswers = [Xpos];

    } else if (tipo === 'SIMPLE') {
        const a = rNonZero(-lim, lim);
        let c = rNonZero(-lim, lim);
        while (c === a) c = rNonZero(-lim, lim);
        const b = rInt(-lim * 2, lim * 2);
        const d = a * X + b - c * X;
        ast.push({ t: 'text', v: `${buildSide(a, b)} = ${buildSide(c, d)}` });
        correctAnswers = [X];

    } else if (tipo === 'PARENTESIS') {
        const a = rNonZero(-Math.min(4, lim), Math.min(5, lim));
        let c = rNonZero(-Math.min(5, lim), Math.min(5, lim));
        while (c === a) c = rNonZero(-Math.min(5, lim), Math.min(5, lim));
        const b = rNonZero(-lim, lim);
        const d = a * (X + b) - c * X;
        const fStr = a === 1 ? '' : a === -1 ? '-' : `${a}`;
        ast.push({ t: 'text', v: `${fStr}(x ${fmt2(b)}) = ${buildSide(c, d)}` });
        correctAnswers = [X];

    } else if (tipo === 'DENOMINADOR') {
        const c = rInt(2, Math.min(5, lim));
        const a = rNonZero(-Math.min(4, lim), Math.min(4, lim));
        const k = rInt(-Math.min(4, lim), Math.min(4, lim));
        const b = c * k - a * X;
        const d = rInt(-3, 3);
        const e = k - d * X;
        ast.push({ t: 'frac', n: buildSide(a, b), d: c });
        ast.push({ t: 'text', v: ` = ${buildSide(d, e)}` });
        correctAnswers = [X];

    } else if (tipo === 'EXPERTO') {
        const c = rInt(2, Math.min(5, lim));
        const m = rInt(-3, 3);
        const b = c * m - X;
        const a = rNonZero(-Math.min(4, lim), Math.min(4, lim));
        const d = rNonZero(-3, 3);
        const e = a * m + d * X;
        const fStr = a === 1 ? '' : a === -1 ? '-' : `${a}`;
        ast.push({ t: 'frac', n: `${fStr}(x ${fmt2(b)})`, d: c });
        ast.push({ t: 'text', v: ` ${fmt2(d, 'x')} = ${e}` });
        correctAnswers = [X];

    } else if (tipo === 'CUAD_COMPLETA') {
        // Completa: x² + bx + c = 0, ambos b≠0 y c≠0
        let X1, X2;
        do {
            X1 = rInt(-Math.min(7, lim), Math.min(7, lim));
            X2 = rInt(-Math.min(7, lim), Math.min(7, lim));
        } while (X1 === 0 || X2 === 0 || X1 === X2);
        const b = -(X1 + X2);
        const c = X1 * X2;
        let v = `x²`;
        if (b !== 0) v += ` ${fmt2(b, 'x')}`;
        if (c !== 0) v += ` ${fmt2(c, '')}`;
        v += " = 0";
        ast.push({ t: 'text', v });
        correctAnswers = [X1, X2];
        tipo = 'CUADRATICA';

    } else if (tipo === 'CUAD_SIN_B') {
        // Incompleta sin término en x: x² + c = 0  →  x = ±√(-c), necesitamos c<0
        const r = rInt(1, Math.min(7, lim));  // raíz real positiva
        const c = -(r * r);                    // c = -r²  →  x² = r²
        let v = `x² ${fmt2(c, '')} = 0`;
        ast.push({ t: 'text', v });
        correctAnswers = [r, -r];
        tipo = 'CUADRATICA';

    } else if (tipo === 'CUAD_SIN_C') {
        // Incompleta sin término independiente: x² + bx = 0  →  x(x+b)=0  →  x=0 ó x=-b
        let b;
        do { b = rInt(-Math.min(7, lim), Math.min(7, lim)); } while (b === 0);
        let v = `x² ${fmt2(b, 'x')} = 0`;
        ast.push({ t: 'text', v });
        correctAnswers = [0, -b];
        tipo = 'CUADRATICA';

    } else if (tipo === 'ENUNCIADO') {
        // Usar bolsa para no repetir hasta que se agoten todos
        let idx;
        if (enunciadosBag && enunciadosBag.disponibles.length > 0) {
            const pos = Math.floor(Math.random() * enunciadosBag.disponibles.length);
            idx = enunciadosBag.disponibles.splice(pos, 1)[0];
            if (enunciadosBag.disponibles.length === 0) {
                // Recargar bolsa con todos excepto el último usado
                enunciadosBag.disponibles = ENUNCIADOS.map((_, i) => i).filter(i => i !== idx);
            }
        } else {
            idx = Math.floor(Math.random() * ENUNCIADOS.length);
        }
        const sel = ENUNCIADOS[idx];
        ast.push({ t: 'enunciado', v: sel.t });
        multipleChoice = [sel.eq, ...sel.w].sort(() => Math.random() - 0.5);
        correctAnswers = [sel.eq];
    }

    return { ast, correctAnswers, multipleChoice, tipo };
};

// ─── Helpers Live ─────────────────────────────────────────────────────────────
const generarCodigo = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

// Convierte ast+correctAnswers a formato serializable para Firestore
const serializarPregunta = (eq, tiempo, puntosMax, puntosMin) => ({
    ast: eq.ast,
    correctAnswers: eq.correctAnswers,
    multipleChoice: eq.multipleChoice || null,
    tipo: eq.tipo || 'SIMPLE',
    tiempo, puntosMax, puntosMin,
});

// ─── Modal de configuración ───────────────────────────────────────────────────
const ConfigModal = ({ config, onStart, onClose }) => {
    const [local, setLocal] = useState(config);
    const set = (k, v) => setLocal(p => ({ ...p, [k]: v }));
    const TIEMPOS = [60, 120, 180, 300, 600];

    return (
        <div style={mSt.overlay}>
            <div style={mSt.modal}>
                <h2 style={mSt.title}>⚙️ Configurar Partida</h2>

                {/* Tiempo */}
                <div style={mSt.section}>
                    <div style={mSt.sTitle}>Tiempo de juego</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                        {TIEMPOS.map(t => (
                            <button key={t} onClick={() => set('tiempo', t)}
                                style={{ ...mSt.chip, background: local.tiempo === t ? '#3498db' : '#f0f0f0', color: local.tiempo === t ? 'white' : '#555' }}>
                                {t < 60 ? `${t}s` : `${t / 60} min`}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Rango */}
                <div style={mSt.section}>
                    <div style={mSt.sTitle}>Rango de números (X y coeficientes)</div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <label style={mSt.label}>Mínimo
                            <input type="number" value={local.minNum} min={1} max={local.maxNum - 1}
                                onChange={e => set('minNum', Math.max(1, parseInt(e.target.value) || 1))}
                                style={mSt.numIn} />
                        </label>
                        <span style={{ color: '#aaa', fontSize: '1.3rem' }}>—</span>
                        <label style={mSt.label}>Máximo
                            <input type="number" value={local.maxNum} min={local.minNum + 1} max={99}
                                onChange={e => set('maxNum', Math.max(local.minNum + 1, parseInt(e.target.value) || 10))}
                                style={mSt.numIn} />
                        </label>
                    </div>
                </div>

                {/* Grado */}
                <div style={mSt.section}>
                    <div style={mSt.sTitle}>Tipo de ecuación</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                        {[
                            { key: 'primerGrado', label: '1.er Grado' },
                            { key: 'segundoGrado', label: '2.º Grado' },
                        ].map(({ key, label }) => (
                            <button key={key} onClick={() => set(key, !local[key])}
                                style={{ ...mSt.chip, background: local[key] ? '#3498db' : '#f0f0f0', color: local[key] ? 'white' : '#555' }}>
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Opciones 1er grado */}
                {local.primerGrado && (
                    <div style={mSt.section}>
                        <div style={mSt.sTitle}>Opciones para 1.er grado</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                            {[
                                { key: 'conParentesis', label: '( ) Paréntesis' },
                                { key: 'conDenominadores', label: '¹⁄ₓ Denominadores' },
                            ].map(({ key, label }) => (
                                <button key={key} onClick={() => set(key, !local[key])}
                                    style={{ ...mSt.chip, background: local[key] ? '#f39c12' : '#f0f0f0', color: local[key] ? 'white' : '#555' }}>
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Enunciados */}
                <div style={mSt.section}>
                    <div style={mSt.sTitle}>Enunciados</div>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <button onClick={() => set('conEnunciados', !local.conEnunciados)}
                            style={{ ...mSt.chip, background: local.conEnunciados ? '#34495e' : '#f0f0f0', color: local.conEnunciados ? 'white' : '#555' }}>
                            🗣️ Incluir enunciados
                        </button>
                    </div>
                </div>

                {/* Pantallas / Jugadores */}
                <div style={mSt.section}>
                    <div style={mSt.sTitle}>Número de pantallas</div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                        {[
                            { n: 1, label: '1 pantalla', icon: '🖥️' },
                            { n: 2, label: '2 pantallas', icon: '👥' },
                            { n: 3, label: '3 pantallas', icon: '👨‍👩‍👦' },
                        ].map(({ n, label, icon }) => (
                            <button key={n} onClick={() => set('numPantallas', n)}
                                style={{ ...mSt.chip, background: local.numPantallas === n ? '#27ae60' : '#f0f0f0', color: local.numPantallas === n ? 'white' : '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '10px 14px' }}>
                                <span style={{ fontSize: '1.3rem' }}>{icon}</span>
                                <span style={{ fontSize: '0.78rem' }}>{label}</span>
                            </button>
                        ))}
                    </div>
                    {local.numPantallas > 1 && (
                        <p style={{ fontSize: '0.75rem', color: '#888', textAlign: 'center', margin: '6px 0 0' }}>
                            Modo pantalla grande — cada columna es un jugador independiente
                        </p>
                    )}
                </div>

                {/* Número de alumnos (cicla etiquetas) */}
                <div style={mSt.section}>
                    <div style={mSt.sTitle}>Número de alumnos <span style={{ color:'#aaa', fontWeight:'normal', textTransform:'none' }}>(asigna cada turno a un alumno)</span></div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
                        {[1, 2, 3, 4, 5, 6].map(n => (
                            <button key={n} onClick={() => set('numAlumnos', n)}
                                style={{ ...mSt.chip, background: local.numAlumnos === n ? '#9b59b6' : '#f0f0f0', color: local.numAlumnos === n ? 'white' : '#555', minWidth: 38 }}>
                                {n === 1 ? 'Libre' : n}
                            </button>
                        ))}
                        <input type="number" min="2" max="99" placeholder="…"
                            value={![1,2,3,4,5,6].includes(local.numAlumnos) ? local.numAlumnos : ''}
                            onChange={e => { const v = parseInt(e.target.value); if (v > 1) set('numAlumnos', v); }}
                            style={{ width: 52, padding: '6px 8px', borderRadius: 20, border: `2px solid ${![1,2,3,4,5,6].includes(local.numAlumnos) ? '#9b59b6' : '#ccc'}`, textAlign: 'center', fontSize: '0.9rem', outline: 'none' }} />
                    </div>
                    {local.numAlumnos > 1 && (
                        <p style={{ fontSize: '0.75rem', color: '#888', textAlign: 'center', margin: '6px 0 0' }}>
                            El encabezado mostrará «Alumno 1», «Alumno 2»… rotando con cada pregunta
                        </p>
                    )}
                </div>

                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24 }}>
                    <button onClick={onClose} style={mSt.btnSec}>Cancelar</button>
                    <button onClick={() => onStart(local)} style={mSt.btnPri}>▶ Empezar</button>
                </div>
            </div>
        </div>
    );
};

// ─── Componente local ─────────────────────────────────────────────────────────
function EcuacionesGameLocal({ onExit }) {
    const [gameState, setGameState] = useState('START');
    const [config, setConfig] = useState(DEFAULT_CONFIG);
    const [showConfig, setShowConfig] = useState(false);
    const [timeLeft, setTimeLeft] = useState(DEFAULT_CONFIG.tiempo);
    const [score, setScore] = useState(0);
    const [aciertos, setAciertos] = useState(0);
    const [skips, setSkips] = useState(0);

    const [currentEq, setCurrentEq] = useState(null);
    const [ans1, setAns1] = useState('');
    const [ans2, setAns2] = useState('');
    const [feedback, setFeedback] = useState(null);
    const [showSolution, setShowSolution] = useState(false);
    const [alumnoActual, setAlumnoActual] = useState(1);
    const ordenAlumnosRef = useRef([]); // lista barajada una sola vez al iniciar
    const punteroAlumnoRef = useRef(0); // avanza secuencialmente

    // Live config
    const [showLiveConfig, setShowLiveConfig] = useState(false);
    const [joinCode, setJoinCode] = useState('');
    const [creandoSala, setCreandoSala] = useState(false);
    const [liveConfig, setLiveConfig] = useState({
        tiempoPregunta: 30, numPreguntas: 10, puntosMax: 100, puntosMin: 50,
        primerGrado: true, conParentesis: false, conDenominadores: false,
        segundoGrado: false, conEnunciados: false,
        minNum: 1, maxNum: 10,
    });
    const [internalHostRoom, setInternalHostRoom] = useState(null);
    const [internalClientRoom, setInternalClientRoom] = useState(null);

    const timerRef = useRef(null);
    const enunciadosBagRef = useRef({ disponibles: ENUNCIADOS.map((_, i) => i) });
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 600;

    // ── Sonidos (igual que CazaBurbujas) ─────────────────────────────
    const playSound = (type) => {
        let file = null;
        if (type === 'CORRECT') file = correctSoundFile;
        else if (type === 'WRONG') file = wrongSoundFile;
        else if (type === 'WIN') file = winSoundFile;
        else if (type === 'START') file = startSoundFile;
        if (file) {
            const audio = new Audio(file);
            audio.volume = 0.6;
            audio.play().catch(() => {});
            if (type === 'CORRECT') setTimeout(() => { audio.pause(); audio.currentTime = 0; }, 1500);
        }
    };

    // ── Feedback visual grande ────────────────────────────────────────
    const [flashIcon, setFlashIcon] = useState(null); // 'CORRECT' | 'INCORRECT' | 'SKIP'
    const triggerFlash = (type) => {
        setFlashIcon(type);
        setTimeout(() => setFlashIcon(null), 700);
    };

    // Herramientas: lienzo y calculadora — siempre visible
    const [showCalc, setShowCalc] = useState(false);
    const [drawMode, setDrawMode] = useState(false);
    const [questionKey, setQuestionKey] = useState(0); // para reset del canvas por pregunta

    useEffect(() => {
        if (gameState === 'PLAYING' && timeLeft > 0) {
            timerRef.current = setInterval(() => setTimeLeft(p => p - 1), 1000);
        } else if (timeLeft <= 0 && gameState === 'PLAYING') {
            clearInterval(timerRef.current);
            setGameState('END');
        }
        return () => clearInterval(timerRef.current);
    }, [gameState, timeLeft]);

    const startGame = (cfg) => {
        setConfig(cfg);
        setScore(0);
        setAciertos(0);
        setSkips(0);
        setTimeLeft(cfg.tiempo);
        enunciadosBagRef.current = { disponibles: ENUNCIADOS.map((_, i) => i) };
        setCurrentEq(generarEcuacion(cfg, enunciadosBagRef.current));
        setAns1(''); setAns2('');
        setShowSolution(false);
        setFeedback(null);
        setShowConfig(false);
        setShowCalc(false);
        setDrawMode(false);
        setQuestionKey(0);
        // Generar lista barajada de alumnos una sola vez
        if (cfg.numAlumnos > 1) {
            const lista = Array.from({ length: cfg.numAlumnos }, (_, i) => i + 1)
                .sort(() => Math.random() - 0.5);
            ordenAlumnosRef.current = lista;
            punteroAlumnoRef.current = 0;
            setAlumnoActual(lista[0]);
        } else {
            ordenAlumnosRef.current = [];
            punteroAlumnoRef.current = 0;
            setAlumnoActual(1);
        }
        if (cfg.numPantallas > 1) {
            setGameState('DUAL');
        } else {
            setGameState('PLAYING');
        }
    };

    const siguienteEcuacion = () => {
        setCurrentEq(generarEcuacion(config, enunciadosBagRef.current));
        setAns1(''); setAns2('');
        setShowSolution(false);
        setFeedback(null);
        setDrawMode(false);
        setQuestionKey(k => k + 1);
        if (config.numAlumnos > 1) {
            const lista = ordenAlumnosRef.current;
            const nuevoPtr = punteroAlumnoRef.current + 1;
            // Al agotar la lista, rebarajar y empezar de nuevo
            if (nuevoPtr >= lista.length) {
                const nuevaLista = [...lista].sort(() => Math.random() - 0.5);
                ordenAlumnosRef.current = nuevaLista;
                punteroAlumnoRef.current = 0;
                setAlumnoActual(nuevaLista[0]);
            } else {
                punteroAlumnoRef.current = nuevoPtr;
                setAlumnoActual(lista[nuevoPtr]);
            }
        }
    };

    const esMultipleChoice = currentEq?.multipleChoice !== null && currentEq?.multipleChoice !== undefined;
    const esCuadratica = currentEq?.tipo === 'CUADRATICA';
    // Lienzo siempre disponible en todos los modos

    const comprobarSolucion = (respTexto = null) => {
        if (!currentEq || showSolution) return;

        let isCorrect = false;
        if (esMultipleChoice) {
            isCorrect = respTexto === currentEq.correctAnswers[0];
        } else if (esCuadratica) {
            const v1 = parseFloat(ans1), v2 = parseFloat(ans2);
            const [r1, r2] = currentEq.correctAnswers;
            isCorrect = (v1 === r1 && v2 === r2) || (v1 === r2 && v2 === r1) || (r1 === r2 && (v1 === r1 || v2 === r1));
        } else {
            isCorrect = parseFloat(ans1) === currentEq.correctAnswers[0];
        }

        if (isCorrect) {
            setScore(s => s + 20);
            setAciertos(a => a + 1);
            setFeedback('CORRECT');
            playSound('CORRECT');
            triggerFlash('CORRECT');
            setTimeout(() => { setFeedback(null); siguienteEcuacion(); }, 600);
        } else {
            setScore(s => Math.max(0, s - 5));
            setFeedback('INCORRECT');
            playSound('WRONG');
            triggerFlash('INCORRECT');
            setTimeout(() => setFeedback(null), 600);
        }
    };

    const handleSkip = () => {
        if (!currentEq || showSolution) return;
        setSkips(s => s + 1);
        setScore(s => Math.max(0, s - 5));
        setShowSolution(true);
        setFeedback('SKIP');
        triggerFlash('SKIP');
    };

    const handleNextAfterSkip = () => siguienteEcuacion();

    const crearSalaEnVivo = async () => {
        setCreandoSala(true);
        try {
            const codigo = generarCodigo();
            const cfgEq = {
                primerGrado: liveConfig.primerGrado, segundoGrado: liveConfig.segundoGrado,
                conParentesis: liveConfig.conParentesis, conDenominadores: liveConfig.conDenominadores,
                conEnunciados: liveConfig.conEnunciados, soloBasico: false, forceExperto: false,
                minNum: liveConfig.minNum, maxNum: liveConfig.maxNum,
            };
            const preguntas = Array.from({ length: liveConfig.numPreguntas }, () =>
                serializarPregunta(generarEcuacion(cfgEq), liveConfig.tiempoPregunta, liveConfig.puntosMax, liveConfig.puntosMin)
            );
            await setDoc(doc(db, 'live_games', codigo), {
                tipoJuego: 'ECUACIONES', estado: 'LOBBY', fasePregunta: 'RESPONDING',
                jugadores: {}, preguntas, indicePregunta: 0, respuestasRonda: {},
                questionStartTime: null, config: liveConfig, creadoEn: Date.now(),
            });
            setShowLiveConfig(false);
            setInternalHostRoom(codigo);
        } catch (e) { console.error(e); alert('Error al crear sala. Comprueba la conexión.'); }
        setCreandoSala(false);
    };

    const unirseASala = () => {
        if (joinCode.length !== 6) return alert('El código debe tener 6 caracteres.');
        setInternalClientRoom(joinCode.toUpperCase());
    };

    const handleExit = () => {
        if (typeof onExit === 'function') {
            onExit();
        } else {
            window.history.pushState({}, '', '/math_world');
            window.dispatchEvent(new Event('popstate'));
        }
    };

    // Win sound when game ends
    useEffect(() => {
        if (gameState === 'END') playSound('WIN');
    }, [gameState]);

    const borderColor = feedback === 'CORRECT' ? '#2ecc71'
        : feedback === 'INCORRECT' ? '#e74c3c'
        : feedback === 'SKIP' ? '#f39c12'
        : 'transparent';

    // Fracción renderizada con CSS
    const Fraction = ({ num, den }) => (
        <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', verticalAlign: 'middle', margin: '0 6px', fontSize: '1.2rem', color: '#2c3e50', fontWeight: 'bold' }}>
            <span style={{ borderBottom: '3px solid #2c3e50', padding: '0 5px', textAlign: 'center' }}>{num}</span>
            <span style={{ padding: '0 5px' }}>{den}</span>
        </span>
    );

    const renderSolucion = () => {
        if (!currentEq) return null;
        if (esMultipleChoice) {
            return <div style={st.solutionBox}>✅ Era: <b>{currentEq.correctAnswers[0]}</b></div>;
        }
        if (esCuadratica) {
            const [r1, r2] = currentEq.correctAnswers;
            return <div style={st.solutionBox}>✅ X₁ = <b>{r1}</b> · X₂ = <b>{r2}</b></div>;
        }
        return <div style={st.solutionBox}>✅ X = <b>{currentEq.correctAnswers[0]}</b></div>;
    };

    const configResumen = () => {
        const parts = [];
        if (config.primerGrado) {
            let s = '1.er grado';
            if (config.conParentesis) s += ' + ()';
            if (config.conDenominadores) s += ' + ¹⁄ₓ';
            parts.push(s);
        }
        if (config.segundoGrado) parts.push('2.º grado');
        if (config.conEnunciados) parts.push('enunciados');
        return parts.join(' · ') || '—';
    };

    return (
        <div style={st.container}>
            {/* Routing interno */}
            {internalHostRoom && <EcuacionesLiveHost codigoSala={internalHostRoom} onExit={() => setInternalHostRoom(null)} />}
            {internalClientRoom && <EcuacionesLiveClient codigoSala={internalClientRoom} onExit={() => setInternalClientRoom(null)} />}
            {(internalHostRoom || internalClientRoom) ? null : (<>

            {/* MODO DUAL / TRIPLE */}
            {gameState === 'DUAL' && (
                <ModoDualEcuaciones
                    config={config}
                    numPantallas={config.numPantallas || 2}
                    numAlumnos={config.numAlumnos || 1}
                    onBack={() => setGameState('START')}
                    playSound={playSound}
                />
            )}

            {showConfig && (
                <ConfigModal config={config} onStart={startGame} onClose={() => setShowConfig(false)} />
            )}

            {/* MODAL CONFIG EN VIVO */}
            {showLiveConfig && (
                <div style={mSt.overlay}>
                    <div style={{ ...mSt.modal, maxWidth: 500 }}>
                        <h2 style={mSt.title}>🔴 Juego en Vivo — Ecuaciones</h2>

                        {/* Tipos */}
                        <div style={mSt.section}>
                            <div style={mSt.sTitle}>Tipos de ecuaciones</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                                {[
                                    { key: 'primerGrado', label: '1.er Grado', color: '#3498db' },
                                    { key: 'conParentesis', label: '( ) Paréntesis', color: '#f39c12' },
                                    { key: 'conDenominadores', label: '¹⁄ₓ Denominadores', color: '#e67e22' },
                                    { key: 'segundoGrado', label: '2.º Grado', color: '#9b59b6' },
                                    { key: 'conEnunciados', label: '🗣️ Enunciados', color: '#34495e' },
                                ].map(({ key, label, color }) => (
                                    <button key={key} onClick={() => setLiveConfig(c => ({ ...c, [key]: !c[key] }))}
                                        style={{ ...mSt.chip, background: liveConfig[key] ? color : '#f0f0f0', color: liveConfig[key] ? 'white' : '#555' }}>
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <p style={{ fontSize: '0.76rem', color: '#888', textAlign: 'center', margin: '6px 0 0' }}>
                                Paréntesis y Denominadores activan sus variantes dentro del 1.er grado
                            </p>
                        </div>

                        {/* Tiempo por pregunta */}
                        <div style={mSt.section}>
                            <div style={mSt.sTitle}>Tiempo por pregunta</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
                                {[20, 30, 45, 60].map(t => (
                                    <button key={t} onClick={() => setLiveConfig(c => ({ ...c, tiempoPregunta: t }))}
                                        style={{ ...mSt.chip, background: liveConfig.tiempoPregunta === t ? '#e74c3c' : '#f0f0f0', color: liveConfig.tiempoPregunta === t ? 'white' : '#555' }}>
                                        {t}s
                                    </button>
                                ))}
                                <input type="number" min="5" max="300" placeholder="···"
                                    value={![20,30,45,60].includes(liveConfig.tiempoPregunta) ? liveConfig.tiempoPregunta : ''}
                                    onChange={e => { const v = parseInt(e.target.value); if (v > 0) setLiveConfig(c => ({ ...c, tiempoPregunta: v })); }}
                                    style={{ width: 52, padding: '6px 8px', borderRadius: 20, border: `2px solid ${![20,30,45,60].includes(liveConfig.tiempoPregunta) ? '#e74c3c' : '#ccc'}`, textAlign: 'center', fontSize: '0.9rem', outline: 'none', fontWeight: 'bold' }} />
                            </div>
                        </div>

                        {/* Número de preguntas */}
                        <div style={mSt.section}>
                            <div style={mSt.sTitle}>Número de preguntas</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
                                {[5, 8, 10, 15].map(n => (
                                    <button key={n} onClick={() => setLiveConfig(c => ({ ...c, numPreguntas: n }))}
                                        style={{ ...mSt.chip, background: liveConfig.numPreguntas === n ? '#009688' : '#f0f0f0', color: liveConfig.numPreguntas === n ? 'white' : '#555' }}>
                                        {n}
                                    </button>
                                ))}
                                <input type="number" min="1" max="50" placeholder="···"
                                    value={![5,8,10,15].includes(liveConfig.numPreguntas) ? liveConfig.numPreguntas : ''}
                                    onChange={e => { const v = parseInt(e.target.value); if (v > 0) setLiveConfig(c => ({ ...c, numPreguntas: v })); }}
                                    style={{ width: 52, padding: '6px 8px', borderRadius: 20, border: `2px solid ${![5,8,10,15].includes(liveConfig.numPreguntas) ? '#009688' : '#ccc'}`, textAlign: 'center', fontSize: '0.9rem', outline: 'none', fontWeight: 'bold' }} />
                            </div>
                        </div>

                        {/* Puntuación */}
                        <div style={mSt.section}>
                            <div style={mSt.sTitle}>Puntuación por respuesta correcta</div>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                                <label style={mSt.label}>Máx pts
                                    <input type="number" value={liveConfig.puntosMax} onChange={e => setLiveConfig(c => ({ ...c, puntosMax: parseInt(e.target.value) || 100 }))} style={mSt.numIn} />
                                </label>
                                <label style={mSt.label}>Mín pts
                                    <input type="number" value={liveConfig.puntosMin} onChange={e => setLiveConfig(c => ({ ...c, puntosMin: parseInt(e.target.value) || 50 }))} style={mSt.numIn} />
                                </label>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 20 }}>
                            <button onClick={() => setShowLiveConfig(false)} style={mSt.btnSec}>Cancelar</button>
                            <button onClick={crearSalaEnVivo} disabled={creandoSala} style={mSt.btnPri}>{creandoSala ? '⏳ Creando...' : '🚀 Lanzar Juego'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* HEADER */}
            <div style={st.header}>
                <button onClick={handleExit} style={st.btnVolver}><RotateCcw size={16} /> Salir</button>
                {gameState === 'PLAYING' && (
                    <div style={st.scoreFlex}>
                        <div style={{ ...st.scoreBoard, color: timeLeft <= 10 ? '#e74c3c' : '#333' }}>
                            <Clock size={16} /> {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                        </div>
                        <div style={{ ...st.scoreBoard, color: '#3498db' }}>
                            <Trophy size={16} /> {score}
                        </div>
                        <div style={{ ...st.scoreBoard, color: '#27ae60', fontSize: '0.9rem' }}>✅ {aciertos}</div>
                    </div>
                )}

            </div>

            {/* INICIO */}
            {gameState === 'START' && (
                <div style={{ ...st.centerCard, maxWidth: 600 }}>
                    <Calculator size={55} color="#3498db" style={{ marginBottom: 12 }} />
                    <h1 style={{ color: '#2c3e50', fontSize: isMobile ? '1.8rem' : '2.4rem', margin: '8px 0' }}>Maestro de Ecuaciones</h1>
                    <p style={{ color: '#666', marginBottom: 20, fontSize: '1rem', lineHeight: 1.5 }}>
                        Despeja la X antes de que se acabe el tiempo. ¡Todas las soluciones son números enteros!
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
                        {MODOS_PRESET.map(m => (
                            <button key={m.id}
                                onClick={() => m.cfg ? startGame(m.cfg) : setShowConfig(true)}
                                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                                    background: 'white', border: `2px solid ${m.color}`, borderRadius: 14,
                                    cursor: 'pointer', textAlign: 'left', transition: 'transform 0.15s',
                                    boxShadow: '0 3px 10px rgba(0,0,0,0.07)' }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                <span style={{ fontSize: '1.8rem', minWidth: 32 }}>{m.icon}</span>
                                <div>
                                    <div style={{ fontWeight: 'bold', color: m.color, fontSize: '1rem' }}>{m.label}</div>
                                    <div style={{ color: '#888', fontSize: '0.8rem' }}>{m.desc}</div>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Separador y sección En Vivo */}
                    <div style={{ width: '100%', height: 2, background: '#eee', margin: '16px 0' }} />
                    <button onClick={() => setShowLiveConfig(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', width: '100%',
                            background: 'white', border: '2px solid #9C27B0', borderRadius: 14,
                            cursor: 'pointer', textAlign: 'left', boxShadow: '0 3px 10px rgba(0,0,0,0.07)' }}>
                        <span style={{ fontSize: '1.8rem', minWidth: 32 }}>🔴</span>
                        <div>
                            <div style={{ fontWeight: 'bold', color: '#9C27B0', fontSize: '1rem' }}>Crear Partida en Vivo</div>
                            <div style={{ color: '#888', fontSize: '0.8rem' }}>Juego multijugador con código de sala</div>
                        </div>
                    </button>
                    <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                        <input type="text" placeholder="Código de 6 letras" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
                            style={{ flex: 1, padding: '11px 14px', borderRadius: 30, border: '2px solid #ccc', textAlign: 'center', fontSize: '1rem', outline: 'none', textTransform: 'uppercase' }} maxLength={6} />
                        <button onClick={unirseASala}
                            style={{ padding: '11px 22px', background: '#2ecc71', color: 'white', border: 'none', borderRadius: 30, fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}>Unirse</button>
                    </div>
                </div>
            )}

            {/* JUEGO */}
            {gameState === 'PLAYING' && currentEq && (
                <div style={{ ...st.centerCard, border: `4px solid ${borderColor}`, transition: 'border-color 0.2s, transform 0.2s', transform: feedback === 'CORRECT' ? 'scale(1.03)' : 'none', position: 'relative', overflow: 'hidden' }}>

                    {/* Flash de acierto/fallo (estilo CazaBurbujas) */}
                    {flashIcon && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, pointerEvents: 'none', background: flashIcon === 'CORRECT' ? 'rgba(46,204,113,0.18)' : flashIcon === 'INCORRECT' ? 'rgba(231,76,60,0.18)' : 'rgba(243,156,18,0.15)' }}>
                            <div style={{ fontSize: '6rem', animation: 'ecuFlash 0.7s ease-out forwards' }}>
                                {flashIcon === 'CORRECT' ? '✅' : flashIcon === 'INCORRECT' ? '❌' : '⏭️'}
                            </div>
                        </div>
                    )}
                    <style>{`@keyframes ecuFlash { 0%{transform:scale(0.4);opacity:0} 40%{transform:scale(1.2);opacity:1} 100%{transform:scale(1);opacity:0} }`}</style>

                    {/* Etiqueta alumno */}
                    {config.numAlumnos > 1 && (
                        <div style={{ background: '#9b59b6', color: 'white', borderRadius: 20, padding: '4px 16px', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: 10, display: 'inline-block' }}>
                            👤 Alumno {alumnoActual}
                        </div>
                    )}

                    {/* Lienzo siempre disponible */}
                    {currentEq && (
                        <div style={{ marginBottom: 12 }}>
                            {showCalc && <MiniCalculadora onClose={() => setShowCalc(false)} />}
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                                <button onClick={() => setShowCalc(c => !c)}
                                    style={{ padding: '7px 14px', background: showCalc ? '#1a1a2e' : '#f0f0f0', color: showCalc ? '#f1c40f' : '#555', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                    🧮 Calculadora
                                </button>
                                <button onClick={() => setDrawMode(d => !d)}
                                    style={{ padding: '7px 14px', background: drawMode ? '#e74c3c' : '#f0f0f0', color: drawMode ? 'white' : '#555', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                    ✏️ {drawMode ? 'Cerrar lienzo' : 'Lienzo'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Lienzo de anotaciones */}
                    {drawMode && (
                        <div style={{ position: 'relative', width: '100%', height: 180, background: '#fafafa', border: '2px dashed #bdc3c7', borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
                            <DrawingCanvas width={600} height={180} active={drawMode} key={`draw-${questionKey}`} />
                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: '#ddd', fontSize: '0.85rem', pointerEvents: 'none', userSelect: 'none' }}>
                                Dibuja aquí tu resolución
                            </div>
                        </div>
                    )}

                    {/* Ecuación */}
                    <div style={{ fontSize: isMobile ? '1.6rem' : '2rem', fontWeight: 'bold', color: '#2c3e50', marginBottom: 24, minHeight: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                        {currentEq.ast.map((el, i) => {
                            if (el.t === 'text') return <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{el.v}</span>;
                            if (el.t === 'frac') return <Fraction key={i} num={el.n} den={el.d} />;
                            if (el.t === 'enunciado') return (
                                <div key={i} style={{ fontSize: isMobile ? '1rem' : '1.2rem', lineHeight: 1.5, padding: '16px 20px', background: '#f8f9fa', borderRadius: 14, borderLeft: '5px solid #34495e', textAlign: 'left', width: '100%' }}>
                                    {el.v}
                                </div>
                            );
                            return null;
                        })}
                    </div>

                    {/* Solución visible tras pasar */}
                    {showSolution && (
                        <div style={{ marginBottom: 20 }}>
                            {renderSolucion()}
                            <button onClick={handleNextAfterSkip} style={{ ...st.btnPrimary, background: '#3498db', margin: '12px auto 0' }}>
                                Siguiente →
                            </button>
                        </div>
                    )}

                    {/* Inputs */}
                    {!showSolution && (
                        esMultipleChoice ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                                {currentEq.multipleChoice.map((opt, i) => (
                                    <button key={i} onClick={() => comprobarSolucion(opt)} style={st.btnOption}>
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                                <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#3498db' }}>
                                            {esCuadratica ? 'X₁ =' : 'X ='}
                                        </span>
                                        <input type="number" value={ans1} onChange={e => setAns1(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && comprobarSolucion()}
                                            style={st.inputMath} autoFocus />
                                    </div>
                                    {esCuadratica && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#9b59b6' }}>X₂ =</span>
                                            <input type="number" value={ans2} onChange={e => setAns2(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && comprobarSolucion()}
                                                style={st.inputMath} />
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 380 }}>
                                    <button onClick={handleSkip} style={st.btnSkip}>
                                        <SkipForward size={18} /> Pasar
                                    </button>
                                    <button onClick={() => comprobarSolucion()} style={{ ...st.btnSuccess, flex: 2 }}>
                                        <CheckCircle size={18} /> Comprobar
                                    </button>
                                </div>
                            </div>
                        )
                    )}

                    {/* Pasar también en multiple choice */}
                    {!showSolution && esMultipleChoice && (
                        <button onClick={handleSkip} style={{ ...st.btnSkip, width: '100%', justifyContent: 'center' }}>
                            <SkipForward size={18} /> Pasar (ver solución)
                        </button>
                    )}
                </div>
            )}

            {/* FINAL */}
            {gameState === 'END' && (
                <div style={st.centerCard}>
                    {score >= 100 && <Confetti recycle={false} />}
                    <Clock size={70} color="#f1c40f" style={{ marginBottom: 16 }} />
                    <h1 style={{ color: '#2c3e50', fontSize: isMobile ? '1.8rem' : '2.2rem' }}>¡Tiempo Agotado!</h1>
                    <div style={{ fontSize: '3.5rem', fontWeight: 'bold', color: '#3498db', margin: '8px 0' }}>{score}</div>
                    <p style={{ color: '#999', marginBottom: 6 }}>Puntos Totales</p>
                    <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 28, flexWrap: 'wrap' }}>
                        <span style={{ color: '#27ae60', fontWeight: 'bold' }}>✅ {aciertos} resueltas</span>
                        <span style={{ color: '#f39c12', fontWeight: 'bold' }}>⏭ {skips} pasadas</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button onClick={() => startGame(config)} style={{ ...st.btnPrimary, background: '#3498db' }}>
                            <RotateCcw size={16} /> Repetir
                        </button>
                        <button onClick={() => { setShowConfig(true); setGameState('START'); }} style={{ ...st.btnPrimary, background: '#7f8c8d' }}>
                            <Settings size={16} /> Configurar
                        </button>
                        <button onClick={() => setGameState('START')} style={st.btnVolver}>Menú</button>
                    </div>
                </div>
            )}
            </>)}
        </div>
    );
}

// ─── ROUTER PRINCIPAL ─────────────────────────────────────────────────────────
export default function EcuacionesGame({ onExit, isHost, codigoSala, usuario }) {
    if (isHost) return <EcuacionesLiveHost codigoSala={codigoSala} onExit={onExit} usuario={usuario} />;
    if (codigoSala) return <EcuacionesLiveClient codigoSala={codigoSala} onExit={onExit} usuario={usuario} />;
    return <EcuacionesGameLocal onExit={onExit} />;
}

// ─── HOST EN VIVO ─────────────────────────────────────────────────────────────
// ─── Modal enviar al profesor ────────────────────────────────────────────────
function ModalEnviarProfeEcu({ datos, onClose }) {
    const [codigo,   setCodigo]   = useState('');
    const [enviando, setEnviando] = useState(false);
    const [enviado,  setEnviado]  = useState(false);
    const [error,    setError]    = useState('');
    const esLive = !!datos.jugadores;
    const [nombre, setNombre] = useState('');
    const [curso,  setCurso]  = useState('');

    const enviar = async () => {
        const code = codigo.trim().toUpperCase();
        if (!esLive && !nombre.trim()) { setError('Escribe tu nombre.'); return; }
        if (!code) { setError('Escribe el código del profesor.'); return; }
        setEnviando(true); setError('');
        try {
            const codigoDoc = await getDoc(doc(db, 'codigos_profesor', code));
            if (!codigoDoc.exists()) { setError('Código de profesor no encontrado.'); setEnviando(false); return; }
            const jugadoresInforme = esLive ? datos.jugadores
                : [{ nombre: nombre.trim(), curso: curso.trim(), puntos: datos.puntos||0, correcto: datos.correcto, porcentaje: datos.correcto?100:0 }];
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'ECUACIONES', modalidad: esLive ? 'Online' : 'Individual',
                fecha: new Date(), codigoProfesor: code, jugadores: jugadoresInforme,
            });
            setEnviado(true);
        } catch(e) { console.error(e); setError('Error: ' + e.message); }
        setEnviando(false);
    };
    const inp = { padding:'9px 12px', borderRadius:9, border:'1.5px solid #e0e4f0', fontSize:'0.9rem', outline:'none', width:'100%', boxSizing:'border-box', fontFamily:'inherit' };
    return (
        <div style={{ position:'fixed', inset:0, zIndex:3000, background:'rgba(8,12,24,0.88)', display:'flex', alignItems:'center', justifyContent:'center', padding:16, backdropFilter:'blur(4px)' }}>
            <div style={{ background:'white', borderRadius:20, width:'100%', maxWidth:380, boxShadow:'0 30px 80px rgba(0,0,0,0.5)', padding:'26px 28px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
                    <h3 style={{ margin:0, color:'#2c3e50', fontSize:'1.05rem' }}>📤 Enviar resultados al profesor</h3>
                    <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#95a5a6', fontSize:'1.2rem' }}>✕</button>
                </div>
                {enviado ? (
                    <div style={{ textAlign:'center', padding:'20px 0' }}>
                        <CheckCircle size={48} color="#27ae60" style={{ marginBottom:10 }}/>
                        <div style={{ color:'#27ae60', fontWeight:700 }}>¡Informe enviado!</div>
                        <button onClick={onClose} style={{ marginTop:14, padding:'9px 22px', borderRadius:10, border:'none', background:'#f0f0f0', cursor:'pointer' }}>Cerrar</button>
                    </div>
                ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                        {!esLive && (<>
                            <div><label style={{ fontSize:'0.78rem', color:'#7f8c8d', fontWeight:600, display:'block', marginBottom:4 }}>Nombre y apellido</label>
                            <input value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Tu nombre completo" style={inp}/></div>
                            <div><label style={{ fontSize:'0.78rem', color:'#7f8c8d', fontWeight:600, display:'block', marginBottom:4 }}>Curso</label>
                            <input value={curso} onChange={e=>setCurso(e.target.value)} placeholder="Ej: 3º ESO A" style={inp}/></div>
                        </>)}
                        {esLive && <div style={{ background:'#f8f9fa', borderRadius:10, padding:'10px 12px', fontSize:'0.83rem', color:'#555' }}>Se enviarán los resultados de <strong>{datos.jugadores.length}</strong> jugadores.</div>}
                        <div><label style={{ fontSize:'0.78rem', color:'#7f8c8d', fontWeight:600, display:'block', marginBottom:4 }}>Código del profesor</label>
                        <input value={codigo} onChange={e=>setCodigo(e.target.value.toUpperCase())} placeholder="Ej: PROF01" maxLength={10} style={{...inp,letterSpacing:2,fontWeight:700}}/></div>
                        {error && <div style={{ color:'#e74c3c', fontSize:'0.8rem' }}>⚠ {error}</div>}
                        <div style={{ display:'flex', gap:9, marginTop:4 }}>
                            <button onClick={onClose} style={{ flex:1, padding:'10px', borderRadius:10, border:'1px solid #ddd', background:'white', cursor:'pointer', fontFamily:'inherit' }}>Cancelar</button>
                            <button onClick={enviar} disabled={enviando} style={{ flex:2, padding:'10px', borderRadius:10, border:'none', background:enviando?'#95a5a6':'linear-gradient(135deg,#3498db,#2980b9)', color:'white', fontWeight:700, cursor:enviando?'default':'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:7, opacity:enviando?.7:1 }}>
                                <Send size={15}/>{enviando?'Enviando…':'Enviar'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function EcuacionesLiveHost({ codigoSala, onExit, usuario }) {
    const [gameData, setGameData] = useState(null);
    const [jugadores, setJugadores] = useState([]);
    const [faseHost, setFaseHost] = useState('LOBBY');
    const [subFase, setSubFase] = useState('RESPONDING');
    const [timerVisual, setTimerVisual] = useState(0);
    const [stats, setStats] = useState({ aciertos: 0, total: 0, pct: 0 });
    const [cargandoSig, setCargandoSig] = useState(false);
    const timerRef = useRef(null);
    const gdRef = useRef(null);
    useEffect(() => { gdRef.current = gameData; }, [gameData]);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'live_games', codigoSala), async snap => {
            if (!snap.exists()) return;
            const data = snap.data();
            setGameData(data);
            setFaseHost(data.estado || 'LOBBY');
            setSubFase(data.fasePregunta || 'RESPONDING');
            setJugadores(data.jugadores ? Object.values(data.jugadores) : []);
            if (data.estado === 'JUEGO' && data.fasePregunta === 'RESPONDING') {
                const respuestas = data.respuestasRonda || {};
                const updates = {}; let hay = false;
                Object.entries(respuestas).forEach(([uid, resp]) => {
                    if (!resp.processed) {
                        hay = true;
                        let pts = 0;
                        if (resp.correct) {
                            const p = data.preguntas[data.indicePregunta];
                            const max = parseInt(p.puntosMax || 100), min = parseInt(p.puntosMin || 50);
                            const tt = parseInt(p.tiempo || 30);
                            const tr = (Date.now() - (data.questionStartTime || Date.now())) / 1000;
                            pts = Math.round(min + (max - min) * Math.max(0, Math.min(1, (tt - tr) / tt)));
                        }
                        updates[`respuestasRonda.${uid}.puntosGanados`] = pts;
                        updates[`respuestasRonda.${uid}.processed`] = true;
                        if (pts > 0 && data.jugadores?.[uid]) updates[`jugadores.${uid}.puntos`] = increment(pts);
                    }
                });
                if (hay) await updateDoc(doc(db, 'live_games', codigoSala), updates);
                const n = Object.keys(respuestas).length, total = Object.values(data.jugadores || {}).length;
                if (total > 0 && n >= total) revelarRespuestas(data);
            }
        });
        return () => unsub();
    }, [codigoSala]);

    useEffect(() => { setCargandoSig(false); }, [gameData?.indicePregunta, gameData?.fasePregunta, gameData?.estado]);

    useEffect(() => {
        clearInterval(timerRef.current);
        if (faseHost === 'JUEGO' && subFase === 'RESPONDING' && gameData) {
            const p = gameData.preguntas[gameData.indicePregunta];
            const tt = parseInt(p.tiempo || 30), inicio = gameData.questionStartTime || Date.now();
            const fcSent = { current: false };
            timerRef.current = setInterval(() => {
                const r = Math.max(0, Math.ceil(tt - (Date.now() - inicio) / 1000));
                setTimerVisual(r);
                if (r <= 1 && !fcSent.current) {
                    fcSent.current = true;
                    updateDoc(doc(db, 'live_games', codigoSala), { forceCheck: Date.now() }).catch(()=>{});
                }
                if (r <= 0) { clearInterval(timerRef.current); if (gdRef.current) revelarRespuestas(gdRef.current); }
            }, 500);
        }
        return () => clearInterval(timerRef.current);
    }, [faseHost, subFase, gameData?.indicePregunta, gameData?.questionStartTime]);

    const revelarRespuestas = async (d) => {
        if (d.fasePregunta !== 'RESPONDING') return;
        const jugsKeys = Object.keys(d.jugadores || {});
        const resps = d.respuestasRonda || {};
        const allResps = jugsKeys.map(uid => resps[uid] || { correct:false });
        const aciertos = allResps.filter(r => r.correct).length;
        setStats({ aciertos, total: allResps.length, pct: allResps.length > 0 ? Math.round(aciertos/allResps.length*100) : 0 });
        await updateDoc(doc(db, 'live_games', codigoSala), { fasePregunta: 'REVEAL' });
        setTimeout(() => updateDoc(doc(db, 'live_games', codigoSala), { fasePregunta: 'LEADERBOARD' }), 4000);
    };

    const iniciarJuego = async () => {
        const d = gdRef.current || gameData;
        const resetPts = {};
        Object.keys(d?.jugadores || {}).forEach(uid => { resetPts[`jugadores.${uid}.puntos`] = 0; });
        await updateDoc(doc(db, 'live_games', codigoSala), {
            estado: 'JUEGO', fasePregunta: 'RESPONDING', indicePregunta: 0,
            respuestasRonda: {}, questionStartTime: Date.now(), ...resetPts,
        });
    };

    const siguientePregunta = async () => {
        if (cargandoSig) return; setCargandoSig(true);
        const d = gdRef.current || gameData;
        const nextIdx = (d.indicePregunta || 0) + 1;
        if (nextIdx >= d.preguntas.length) {
            await updateDoc(doc(db, 'live_games', codigoSala), { estado: 'FIN' });
        } else {
            await updateDoc(doc(db, 'live_games', codigoSala), {
                indicePregunta: nextIdx, fasePregunta: 'RESPONDING',
                respuestasRonda: {}, questionStartTime: Date.now(),
            });
        }
    };

    const preguntaActual = gameData?.preguntas?.[gameData?.indicePregunta];
    const ranking = [...jugadores].sort((a, b) => (b.puntos || 0) - (a.puntos || 0));
    const isMobile = window.innerWidth <= 600;

    const Fraction = ({ num, den }) => (
        <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', verticalAlign: 'middle', margin: '0 4px', fontSize: '1.1rem', color: '#2c3e50', fontWeight: 'bold' }}>
            <span style={{ borderBottom: '2px solid #2c3e50', padding: '0 4px' }}>{num}</span>
            <span style={{ padding: '0 4px' }}>{den}</span>
        </span>
    );

    const renderEcHost = (p) => {
        if (!p?.ast) return null;
        return p.ast.map((el, i) => {
            if (el.t === 'text') return <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{el.v}</span>;
            if (el.t === 'frac') return <Fraction key={i} num={el.n} den={el.d} />;
            if (el.t === 'enunciado') return (
                <div key={i} style={{ fontSize: '1.1rem', lineHeight: 1.6, padding: '14px 18px', background: '#f8f9fa', borderRadius: 12, borderLeft: '5px solid #34495e', textAlign: 'left', width: '100%' }}>
                    {el.v}
                </div>
            );
            return null;
        });
    };

    const sH = {
        container: { minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', color: 'white', fontFamily: "'Segoe UI', sans-serif", padding: 16 },
        card: { background: 'rgba(255,255,255,0.08)', borderRadius: 20, padding: '24px 20px', maxWidth: 700, margin: '0 auto', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' },
        btn: (bg) => ({ padding: '12px 24px', background: bg, color: 'white', border: 'none', borderRadius: 30, fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', boxShadow: `0 4px 15px ${bg}66` }),
    };

    return (
        <div style={sH.container}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
                <button onClick={onExit} style={{ ...sH.btn('rgba(255,255,255,0.15)'), fontSize: '0.9rem' }}>✕ Salir</button>
                <div style={{ background: 'rgba(255,215,0,0.15)', border: '2px solid gold', borderRadius: 14, padding: '8px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: '#aaa' }}>CÓDIGO DE SALA</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'gold', letterSpacing: 6 }}>{codigoSala}</div>
                </div>
                <div style={{ color: '#aaa', fontSize: '0.9rem' }}>👥 {jugadores.length} jugadores</div>
            </div>

            {faseHost === 'LOBBY' && (
                <div style={{ ...sH.card, textAlign: 'center' }}>
                    <Calculator size={60} color="#f1c40f" style={{ marginBottom: 16 }} />
                    <h2 style={{ fontSize: '1.4rem', marginBottom: 8 }}>Sala de espera</h2>
                    <p style={{ color: '#aaa', marginBottom: 20 }}>Los alumnos se unen con el código <b style={{ color: 'gold' }}>{codigoSala}</b></p>
                    {jugadores.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
                            {jugadores.map(j => (
                                <div key={j.uid} style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 20, padding: '6px 14px', fontSize: '0.9rem' }}>
                                    {j.nombre || j.uid}
                                </div>
                            ))}
                        </div>
                    )}
                    <button onClick={iniciarJuego} disabled={jugadores.length === 0} style={sH.btn('#f1c40f')}>
                        <span style={{ color: '#1a1a2e', fontWeight: 'bold' }}>▶ Comenzar {jugadores.length > 0 ? `con ${jugadores.length} jugadores` : '(sin jugadores aún)'}</span>
                    </button>
                </div>
            )}

            {faseHost === 'JUEGO' && preguntaActual && (
                <div style={sH.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                        <span style={{ color: '#aaa', fontSize: '0.9rem' }}>Pregunta {(gameData.indicePregunta || 0) + 1} / {gameData.preguntas.length}</span>
                        <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: timerVisual <= 5 ? '#e74c3c' : '#f1c40f' }}>{timerVisual}s</div>
                        <span style={{ color: '#aaa', fontSize: '0.9rem' }}>
                            {Object.keys(gameData.respuestasRonda || {}).length}/{jugadores.length} respondidos
                        </span>
                    </div>

                    {/* Barra de tiempo */}
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, marginBottom: 20, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: timerVisual <= 5 ? '#e74c3c' : '#f1c40f', width: `${(timerVisual / preguntaActual.tiempo) * 100}%`, transition: 'width 0.5s linear, background 0.3s' }} />
                    </div>

                    <div style={{ fontSize: isMobile ? '1.5rem' : '1.9rem', fontWeight: 'bold', color: 'white', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 4, minHeight: 60 }}>
                        {renderEcHost(preguntaActual)}
                    </div>

                    {subFase === 'RESPONDING' && (
                        <div style={{ textAlign: 'center' }}>
                            <button onClick={() => { clearInterval(timerRef.current); if (gdRef.current) revelarRespuestas(gdRef.current); }}
                                style={{ ...sH.btn('#e74c3c'), fontSize: '0.9rem' }}>⏩ Forzar revelación</button>
                        </div>
                    )}

                    {(subFase === 'REVEAL' || subFase === 'LEADERBOARD') && (
                        <div>
                            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 16, marginBottom: 16, textAlign: 'center' }}>
                                <div style={{ fontSize: '0.85rem', color: '#aaa', marginBottom: 6 }}>SOLUCIÓN</div>
                                {preguntaActual.multipleChoice ? (
                                    <div style={{ fontSize: '1.2rem', color: '#2ecc71', fontWeight: 'bold' }}>{preguntaActual.correctAnswers[0]}</div>
                                ) : preguntaActual.tipo === 'CUADRATICA' ? (
                                    <div style={{ fontSize: '1.2rem', color: '#2ecc71', fontWeight: 'bold' }}>X₁={preguntaActual.correctAnswers[0]} · X₂={preguntaActual.correctAnswers[1]}</div>
                                ) : (
                                    <div style={{ fontSize: '1.4rem', color: '#2ecc71', fontWeight: 'bold' }}>X = {preguntaActual.correctAnswers[0]}</div>
                                )}
                                <div style={{ marginTop: 10, color: '#f1c40f' }}>✅ {stats.aciertos}/{stats.total} acertaron ({stats.pct}%)</div>
                            </div>

                            {subFase === 'LEADERBOARD' && ranking.length > 0 && (
                                <div style={{ marginBottom: 16 }}>
                                    <div style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: 8, textAlign: 'center' }}>CLASIFICACIÓN</div>
                                    {ranking.slice(0, 5).map((j, i) => (
                                        <div key={j.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: i === 0 ? 'rgba(241,196,15,0.15)' : 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '8px 14px', marginBottom: 4 }}>
                                            <span>{['🥇','🥈','🥉'][i] || `${i+1}.`} {j.nombre || 'Jugador'}</span>
                                            <span style={{ fontWeight: 'bold', color: '#f1c40f' }}>{j.puntos || 0} pts</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div style={{ textAlign: 'center' }}>
                                <button onClick={siguientePregunta} disabled={cargandoSig} style={sH.btn('#2ecc71')}>
                                    {cargandoSig ? '⏳' : (gameData.indicePregunta + 1 >= gameData.preguntas.length ? '🏁 Ver Resultados Finales' : '▶ Siguiente pregunta')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {faseHost === 'FIN' && (
                <FinHostEcu ranking={ranking} onExit={onExit} />
            )}
        </div>
    );
}

// ─── CLIENTE EN VIVO ──────────────────────────────────────────────────────────
function FinHostEcu({ ranking, onExit }) {
    const [mostrarEnvio, setMostrarEnvio] = useState(false);
    const maxPts = Math.max(...ranking.map(j=>j.puntos||0), 1);
    const datos = { jugadores: ranking.map(j=>({ nombre:j.nombre||'Jugador', curso:'', puntos:j.puntos||0, porcentaje:Math.round((j.puntos||0)/maxPts*100), correcto:(j.puntos||0)>0 })) };
    return (
        <div style={{ textAlign:'center' }}>
            <Confetti recycle={false} numberOfPieces={250}/>
            <Trophy size={70} color="#f1c40f" style={{ marginBottom:16 }}/>
            <h2 style={{ fontSize:'1.6rem', marginBottom:20 }}>🏆 Resultados Finales</h2>
            {ranking.map((j,i) => (
                <div key={j.uid} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background: i===0?'rgba(241,196,15,0.2)':'rgba(255,255,255,0.07)', borderRadius:12, padding:'12px 18px', marginBottom:6 }}>
                    <span style={{ fontSize:'1.1rem' }}>{['🥇','🥈','🥉'][i]||`${i+1}.`} {j.nombre||'Jugador'}</span>
                    <span style={{ fontWeight:'bold', color:'#f1c40f', fontSize:'1.2rem' }}>{j.puntos||0} pts</span>
                </div>
            ))}
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
                <button onClick={()=>setMostrarEnvio(true)} style={{ flex:1, padding:'12px', background:'linear-gradient(135deg,#3498db,#2980b9)', color:'white', border:'none', borderRadius:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
                    <Send size={15}/> Enviar a profesor
                </button>
                <button onClick={onExit} style={{ flex:1, padding:'12px', background:'#e74c3c', color:'white', border:'none', borderRadius:12, fontWeight:700, cursor:'pointer' }}>Volver al Menú</button>
            </div>
            {mostrarEnvio && <ModalEnviarProfeEcu datos={datos} onClose={()=>setMostrarEnvio(false)}/>}
        </div>
    );
}

function EcuacionesLiveClient({ codigoSala, onExit, usuario }) {
    const [gameData, setGameData] = useState(null);
    const [fase, setFase] = useState('LOBBY');
    const [subFase, setSubFase] = useState('RESPONDING');
    const [puntuacion, setPuntuacion] = useState(0);
    const [myRank, setMyRank] = useState(0);
    const [myResult, setMyResult] = useState(null);

    const [myName] = useState(() => {
        const stored = localStorage.getItem('pikt_guest_name');
        if (stored) return stored;
        const name = prompt('¿Cómo te llamas?') || 'Jugador';
        localStorage.setItem('pikt_guest_name', name);
        return name;
    });
    const [myUid] = useState(() => {
        const stored = localStorage.getItem('pikt_guest_id');
        if (stored) return stored;
        const id = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        localStorage.setItem('pikt_guest_id', id);
        return id;
    });
    const joiningRef  = useRef(false);
    const prevEstadoRef = useRef(null);
    const [forceCheck, setForceCheck] = useState(null);

    useEffect(() => {
        // Unirse solo si no existe ya en la sala
        const tryJoin = async () => {
            if (joiningRef.current) return;
            joiningRef.current = true;
            try {
                await updateDoc(doc(db, 'live_games', codigoSala), {
                    [`jugadores.${myUid}`]: { uid: myUid, nombre: myName, puntos: 0 }
                });
            } catch(e) { console.warn('join error:', e); }
            joiningRef.current = false;
        };
        tryJoin();
    }, []);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'live_games', codigoSala), snap => {
            if (!snap.exists()) return;
            const data = snap.data();
            setGameData(data);
            const estado = data.estado || 'LOBBY';
            setFase(estado); setSubFase(data.fasePregunta || 'RESPONDING');
            // Reset puntos locales si volvemos a JUEGO desde FIN (nueva partida)
            if (prevEstadoRef.current === 'FIN' && estado === 'JUEGO') setPuntuacion(0);
            prevEstadoRef.current = estado;
            const me = data.jugadores?.[myUid];
            if (me) setPuntuacion(me.puntos || 0);
            const resp = data.respuestasRonda?.[myUid];
            if (resp?.processed) setMyResult(resp);
            if (estado === 'JUEGO' && data.fasePregunta === 'RESPONDING') setMyResult(null);
            if (data.forceCheck) setForceCheck(data.forceCheck);
            if (estado === 'FIN') {
                const sorted = Object.values(data.jugadores || {}).sort((a, b) => (b.puntos || 0) - (a.puntos || 0));
                setMyRank(sorted.findIndex(j => j.uid === myUid) + 1);
            }
        });
        return () => unsub();
    }, [codigoSala, myUid]);

    if (!gameData) return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a2e, #16213e)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Loader size={40} color="white" />
        </div>
    );

    const pregunta = gameData.preguntas?.[gameData.indicePregunta];

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', fontFamily: "'Segoe UI', sans-serif", color: 'white', padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <button onClick={onExit} style={{ padding: '7px 14px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: 20, cursor: 'pointer' }}>✕</button>
                <div style={{ background: 'rgba(241,196,15,0.2)', border: '1px solid gold', borderRadius: 20, padding: '6px 16px', fontWeight: 'bold', color: 'gold' }}>
                    🏆 {puntuacion} pts
                </div>
            </div>

            {fase === 'LOBBY' && (
                <div style={{ textAlign: 'center', marginTop: 80 }}>
                    <Calculator size={70} color="#f1c40f" />
                    <h2 style={{ fontSize: '1.5rem', marginTop: 16 }}>¡Hola {myName}!</h2>
                    <p style={{ color: '#aaa' }}>Espera a que el profesor empiece la partida...</p>
                    <div style={{ marginTop: 12, color: '#888', fontSize: '0.85rem' }}>Sala: {codigoSala}</div>
                </div>
            )}

            {fase === 'JUEGO' && pregunta && (
                <ClientPreguntaEcuacion
                    key={gameData.indicePregunta}
                    pregunta={pregunta}
                    startTime={gameData.questionStartTime}
                    subFase={subFase}
                    forceCheck={forceCheck}
                    myResult={myResult}
                    puntuacion={puntuacion}
                    onResponder={async (esCorrecta) => {
                        await updateDoc(doc(db, 'live_games', codigoSala), {
                            [`respuestasRonda.${myUid}`]: { uid: myUid, correct: esCorrecta, puntosGanados: 0, processed: false }
                        });
                    }}
                />
            )}

            {fase === 'FIN' && (
                <FinClientEcu myName={myName} myRank={myRank} puntuacion={puntuacion} gameData={gameData} myUid={myUid} onExit={onExit}/>
            )}
        </div>
    );
}

function FinClientEcu({ myName, myRank, puntuacion, gameData, myUid, onExit }) {
    const [mostrarEnvio, setMostrarEnvio] = useState(false);
    const jugs = gameData?.jugadores ? Object.values(gameData.jugadores).sort((a,b)=>(b.puntos||0)-(a.puntos||0)) : [];
    const maxPts = Math.max(...jugs.map(j=>j.puntos||0), 1);
    const datos = { jugadores: jugs.map(j=>({ nombre:j.nombre||'Jugador', curso:'', puntos:j.puntos||0, porcentaje:Math.round((j.puntos||0)/maxPts*100), correcto:(j.puntos||0)>0 })) };
    return (
        <div style={{ textAlign:'center', marginTop:40 }}>
            {myRank <= 3 && <Confetti recycle={false} numberOfPieces={200}/>}
            <Trophy size={70} color="#f1c40f"/>
            <h2 style={{ fontSize:'1.6rem', margin:'16px 0 8px' }}>¡Fin de partida!</h2>
            <p style={{ color:'#aaa', marginBottom:6 }}>Enhorabuena, <b style={{ color:'white' }}>{myName}</b></p>
            <div style={{ fontSize:'1.2rem', marginBottom:4 }}>Posición: <b style={{ color:'#f1c40f' }}>{myRank}º</b></div>
            <div style={{ fontSize:'1.4rem', fontWeight:'bold', color:'#f1c40f', marginBottom:20 }}>{puntuacion} puntos</div>
            <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
                <button onClick={()=>setMostrarEnvio(true)} style={{ padding:'12px 22px', background:'linear-gradient(135deg,#3498db,#2980b9)', color:'white', border:'none', borderRadius:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:7 }}>
                    <Send size={15}/> Enviar a profesor
                </button>
                <button onClick={onExit} style={{ padding:'12px 22px', background:'#e74c3c', color:'white', border:'none', borderRadius:12, fontWeight:700, cursor:'pointer' }}>Volver al Menú</button>
            </div>
            {mostrarEnvio && <ModalEnviarProfeEcu datos={datos} onClose={()=>setMostrarEnvio(false)}/>}
        </div>
    );
}

// ─── PREGUNTA CLIENTE ─────────────────────────────────────────────────────────
function ClientPreguntaEcuacion({ pregunta, startTime, subFase, forceCheck, myResult, puntuacion, onResponder }) {
    const [ans1, setAns1] = useState('');
    const [ans2, setAns2] = useState('');
    const [enviado, setEnviado] = useState(false);
    const [timeLeft, setTimeLeft] = useState(100);
    const [isLate, setIsLate] = useState(false);
    const tRef    = useRef(null);
    const envRef  = useRef(false);  // evita doble envío — no sufre del stale closure bug

    const esCuadratica = pregunta.tipo === 'CUADRATICA';
    const esMultipleChoice = !!pregunta.multipleChoice;

    // Calcular si la respuesta actual es correcta (sin setState)
    const calcCorrect = (a1, a2) => {
        if (esMultipleChoice) return a1 === pregunta.correctAnswers[0];
        if (esCuadratica) {
            const v1 = parseFloat(a1), v2 = parseFloat(a2);
            const [r1, r2] = pregunta.correctAnswers;
            return (v1===r1&&v2===r2)||(v1===r2&&v2===r1)||(r1===r2&&(v1===r1||v2===r1));
        }
        return parseFloat(a1) === pregunta.correctAnswers[0];
    };

    // forceCheck: el host avisa 1s antes — enviamos con lo que tenga el alumno
    const ans1Ref = useRef(''); const ans2Ref = useRef('');
    useEffect(() => { ans1Ref.current = ans1; }, [ans1]);
    useEffect(() => { ans2Ref.current = ans2; }, [ans2]);

    useEffect(() => {
        if (!forceCheck || envRef.current) return;
        // No enviamos aún — guardamos en lastCorrect para cuando el timer llegue a 0
        // En realidad en Ecuaciones la respuesta es binaria, así que enviamos directamente
        envRef.current = true;
        clearInterval(tRef.current);
        setEnviado(true);
        onResponder(calcCorrect(ans1Ref.current, ans2Ref.current));
    }, [forceCheck]);

    useEffect(() => {
        if (subFase !== 'RESPONDING' || enviado) return;
        const tt = parseInt(pregunta.tiempo || 30);
        tRef.current = setInterval(() => {
            const tr = (Date.now() - startTime) / 1000;
            const pct = Math.max(0, 100 - (tr / tt * 100));
            setTimeLeft(pct);
            if (pct < 20) setIsLate(true);
            if (pct <= 0) {
                clearInterval(tRef.current);
                if (!envRef.current) {  // ← usa ref, no state (evita el stale closure bug)
                    envRef.current = true;
                    setEnviado(true);
                    onResponder(false); // tiempo agotado = incorrecto
                }
            }
        }, 150);
        return () => clearInterval(tRef.current);
    }, [startTime, subFase, enviado]);

    const enviar = (a1 = ans1, a2 = ans2) => {
        if (envRef.current) return;
        envRef.current = true;
        clearInterval(tRef.current);
        setEnviado(true);
        onResponder(calcCorrect(a1, a2));
    };

    const Fraction = ({ num, den }) => (
        <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', verticalAlign: 'middle', margin: '0 4px', fontSize: '1.2rem', color: 'white', fontWeight: 'bold' }}>
            <span style={{ borderBottom: '2px solid white', padding: '0 4px' }}>{num}</span>
            <span style={{ padding: '0 4px' }}>{den}</span>
        </span>
    );

    const barColor = isLate ? '#e74c3c' : '#f1c40f';

    if (subFase === 'REVEAL' || subFase === 'LEADERBOARD') {
        const ok = myResult?.correct; const pts = myResult?.puntosGanados || 0;
        return (
            <div style={{ textAlign: 'center', marginTop: 30 }}>
                <div style={{ fontSize: '4rem', marginBottom: 12 }}>{ok ? '✅' : (!myResult ? '⏰' : '❌')}</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', marginBottom: 8 }}>
                    {ok ? '¡CORRECTO!' : (!myResult ? '¡TIEMPO!' : 'INCORRECTO')}
                </div>
                {ok ? (
                    <div style={{ fontSize: '1.1rem', color: '#f1c40f' }}>+{pts} puntos</div>
                ) : (
                    <div style={{ color: '#aaa', fontSize: '1rem' }}>
                        Respuesta correcta: <b style={{ color: 'white' }}>
                            {pregunta.multipleChoice ? pregunta.correctAnswers[0]
                             : esCuadratica ? `X₁=${pregunta.correctAnswers[0]}, X₂=${pregunta.correctAnswers[1]}`
                             : `X = ${pregunta.correctAnswers[0]}`}
                        </b>
                    </div>
                )}
                {subFase === 'LEADERBOARD' && (
                    <div style={{ marginTop: 16, color: '#888', fontSize: '0.9rem' }}>Preparando siguiente pregunta...</div>
                )}
            </div>
        );
    }

    if (enviado) {
        return (
            <div style={{ textAlign: 'center', marginTop: 60 }}>
                <div style={{ fontSize: '3rem', marginBottom: 12 }}>⏳</div>
                <p style={{ color: '#aaa' }}>Respuesta enviada, esperando a los demás...</p>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
            {/* Barra de tiempo */}
            <div style={{ height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 4, marginBottom: 20, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: barColor, width: `${timeLeft}%`, transition: 'width 0.15s linear, background 0.3s', borderRadius: 4 }} />
            </div>

            {/* Ecuación */}
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: '20px 16px', marginBottom: 20, fontSize: '1.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 4, minHeight: 70, border: '1px solid rgba(255,255,255,0.1)' }}>
                {pregunta.ast.map((el, i) => {
                    if (el.t === 'text') return <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{el.v}</span>;
                    if (el.t === 'frac') return <Fraction key={i} num={el.n} den={el.d} />;
                    if (el.t === 'enunciado') return (
                        <div key={i} style={{ fontSize: '1.1rem', lineHeight: 1.5, padding: '12px 16px', background: 'rgba(52,73,94,0.5)', borderRadius: 12, borderLeft: '4px solid #34495e', textAlign: 'left', width: '100%' }}>
                            {el.v}
                        </div>
                    );
                    return null;
                })}
            </div>

            {/* Inputs */}
            {esMultipleChoice ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {pregunta.multipleChoice.map((opt, i) => (
                        <button key={i} onClick={() => { setAns1(opt); enviar(false); }}
                            style={{ padding: '14px 18px', fontSize: '1rem', fontWeight: 'bold', background: 'rgba(255,255,255,0.1)', color: 'white', border: '2px solid rgba(255,255,255,0.2)', borderRadius: 14, cursor: 'pointer', textAlign: 'left' }}>
                            {opt}
                        </button>
                    ))}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                    <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#f1c40f' }}>{esCuadratica ? 'X₁ =' : 'X ='}</span>
                            <input type="number" value={ans1} onChange={e => setAns1(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && enviar(false)}
                                style={{ width: 70, height: 55, fontSize: '1.8rem', textAlign: 'center', borderRadius: 10, border: '3px solid rgba(255,255,255,0.3)', outline: 'none', background: 'rgba(255,255,255,0.1)', color: 'white', fontWeight: 'bold' }} autoFocus />
                        </div>
                        {esCuadratica && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#9b59b6' }}>X₂ =</span>
                                <input type="number" value={ans2} onChange={e => setAns2(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && enviar(false)}
                                    style={{ width: 70, height: 55, fontSize: '1.8rem', textAlign: 'center', borderRadius: 10, border: '3px solid rgba(255,255,255,0.3)', outline: 'none', background: 'rgba(255,255,255,0.1)', color: 'white', fontWeight: 'bold' }} />
                            </div>
                        )}
                    </div>
                    <button onClick={() => enviar(false)}
                        style={{ padding: '14px 40px', background: '#f1c40f', color: '#1a1a2e', border: 'none', borderRadius: 30, fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', boxShadow: '0 4px 15px rgba(241,196,15,0.4)' }}>
                        ✓ Comprobar
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── MiniCalculadora ──────────────────────────────────────────────────────────
function MiniCalculadora({ onClose }) {
    const [display, setDisplay] = useState('0');
    const [prev, setPrev] = useState(null);
    const [op, setOp] = useState(null);
    const [waitNext, setWaitNext] = useState(false);

    const pressNum = (n) => {
        if (waitNext) { setDisplay(String(n)); setWaitNext(false); }
        else setDisplay(d => d === '0' ? String(n) : d + n);
    };
    const pressDecimal = () => {
        if (waitNext) { setDisplay('0.'); setWaitNext(false); return; }
        if (!display.includes('.')) setDisplay(d => d + '.');
    };
    const calc = (a, b, o) => { if (o === '+') return a + b; if (o === '-') return a - b; if (o === '×') return a * b; if (o === '÷') return b !== 0 ? a / b : 0; return b; };
    const pressOp = (o) => {
        const cur = parseFloat(display);
        if (prev !== null && !waitNext) {
            const res = calc(prev, cur, op);
            setDisplay(String(parseFloat(res.toFixed(8)))); setPrev(parseFloat(res.toFixed(8)));
        } else { setPrev(cur); }
        setOp(o); setWaitNext(true);
    };
    const pressEqual = () => {
        if (op === null || prev === null) return;
        const res = calc(prev, parseFloat(display), op);
        setDisplay(String(parseFloat(res.toFixed(8)))); setPrev(null); setOp(null); setWaitNext(true);
    };
    const pressClear = () => { setDisplay('0'); setPrev(null); setOp(null); setWaitNext(false); };
    const pressSqrt = () => { setDisplay(d => String(parseFloat(Math.sqrt(parseFloat(d)).toFixed(8)))); setWaitNext(true); };
    const pressSq = () => { const v = parseFloat(display); setDisplay(String(parseFloat((v * v).toFixed(8)))); setWaitNext(true); };

    const btn = (label, onClick, bg = '#f0f0f0', col = '#333') => (
        <button key={label} onClick={onClick} style={{ padding: '10px 0', background: bg, color: col, border: '1px solid #ddd', borderRadius: 8, fontWeight: 'bold', fontSize: '0.95rem', cursor: 'pointer', touchAction: 'manipulation' }}>{label}</button>
    );

    return (
        <div style={{ background: '#1a1a2e', borderRadius: 16, padding: 14, marginBottom: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}>
            <button onClick={onClose} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', fontSize: '0.85rem' }}>✕</button>
            <div style={{ background: '#0d0d1f', color: '#f1c40f', fontFamily: 'monospace', fontSize: '1.5rem', fontWeight: 'bold', textAlign: 'right', padding: '10px 12px', borderRadius: 10, marginBottom: 10, minHeight: 48, wordBreak: 'break-all' }}>
                {op && <span style={{ fontSize: '0.75rem', color: '#888', marginRight: 8 }}>{prev} {op}</span>}
                {display}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {btn('C', pressClear, '#e74c3c', 'white')}
                {btn('√', pressSqrt, '#3498db', 'white')}
                {btn('x²', pressSq, '#3498db', 'white')}
                {btn('÷', () => pressOp('÷'), '#f39c12', 'white')}
                {btn('7', () => pressNum('7'))}{btn('8', () => pressNum('8'))}{btn('9', () => pressNum('9'))}
                {btn('×', () => pressOp('×'), '#f39c12', 'white')}
                {btn('4', () => pressNum('4'))}{btn('5', () => pressNum('5'))}{btn('6', () => pressNum('6'))}
                {btn('-', () => pressOp('-'), '#f39c12', 'white')}
                {btn('1', () => pressNum('1'))}{btn('2', () => pressNum('2'))}{btn('3', () => pressNum('3'))}
                {btn('+', () => pressOp('+'), '#f39c12', 'white')}
                {btn('0', () => pressNum('0'))}{btn('.', pressDecimal)}{btn('±', () => setDisplay(d => String(-parseFloat(d))))}
                {btn('=', pressEqual, '#2ecc71', 'white')}
            </div>
        </div>
    );
}

// ─── DrawingCanvas ─────────────────────────────────────────────────────────────
function DrawingCanvas({ width, height, active }) {
    const cvRef = useRef(null);
    const drawing = useRef(false);
    const lastPos = useRef(null);
    const [color, setColor] = useState('#e74c3c');
    const [isEraser, setIsEraser] = useState(false);

    const getPos = (e) => {
        const rect = cvRef.current.getBoundingClientRect();
        const src = e.touches ? e.touches[0] : e;
        return { x: src.clientX - rect.left, y: src.clientY - rect.top };
    };
    const startDraw = (e) => { if (!active) return; e.preventDefault(); drawing.current = true; lastPos.current = getPos(e); };
    const doDraw = (e) => {
        if (!drawing.current || !active) return;
        e.preventDefault();
        const pos = getPos(e);
        const ctx = cvRef.current.getContext('2d');
        ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(pos.x, pos.y);
        ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
        ctx.strokeStyle = isEraser ? 'rgba(0,0,0,1)' : color;
        ctx.lineWidth = isEraser ? 22 : 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
        lastPos.current = pos;
    };
    const stopDraw = () => { drawing.current = false; };
    const clearCanvas = () => { const ctx = cvRef.current.getContext('2d'); ctx.clearRect(0, 0, width, height); };
    const COLORS = ['#e74c3c', '#2c3e50', '#3498db', '#2ecc71', '#f39c12', '#9b59b6'];

    return (
        <>
            <canvas ref={cvRef} width={width} height={height}
                style={{ position: 'absolute', top: 0, left: 0, zIndex: 6, pointerEvents: active ? 'auto' : 'none', cursor: active ? (isEraser ? 'cell' : 'crosshair') : 'default', touchAction: 'none' }}
                onMouseDown={startDraw} onMouseMove={doDraw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                onTouchStart={startDraw} onTouchMove={doDraw} onTouchEnd={stopDraw} />
            {active && (
                <div style={{ position: 'absolute', top: 6, right: 6, zIndex: 10, display: 'flex', gap: 4, alignItems: 'center', background: 'rgba(255,255,255,0.93)', borderRadius: 10, padding: '4px 6px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                    {COLORS.map(c => (
                        <button key={c} onClick={() => { setIsEraser(false); setColor(c); }}
                            style={{ width: 20, height: 20, borderRadius: '50%', background: c, border: (!isEraser && color === c) ? '3px solid white' : '1px solid rgba(0,0,0,0.15)', cursor: 'pointer', boxShadow: (!isEraser && color === c) ? `0 0 0 2px ${c}` : 'none', padding: 0 }} />
                    ))}
                    <button onClick={() => setIsEraser(e => !e)}
                        style={{ background: isEraser ? '#e0e0e0' : 'transparent', border: '1px solid #ccc', borderRadius: 6, padding: '2px 5px', cursor: 'pointer', fontSize: '0.85rem' }} title="Borrador">⬜</button>
                    <button onClick={clearCanvas}
                        style={{ background: 'transparent', border: '1px solid #ccc', borderRadius: 6, padding: '2px 5px', cursor: 'pointer', fontSize: '0.85rem' }} title="Borrar todo">🗑️</button>
                </div>
            )}
        </>
    );
}

// ─── MODO DUAL / TRIPLE — PANTALLAS MÚLTIPLES ────────────────────────────────

// ── Teclado virtual por panel (modo dual/triple) ──────────────────────────────
function VirtualKeypad({ value, onChange, onConfirm, color = '#27ae60', label = 'X=' }) {
    const press = (key) => {
        if (key === '⌫') { onChange(value.slice(0, -1)); return; }
        if (key === '+/-') { onChange(value.startsWith('-') ? value.slice(1) : value ? '-' + value : ''); return; }
        if (key === 'C')  { onChange(''); return; }
        // Evitar doble punto
        if (key === '.' && value.includes('.')) return;
        // Evitar doble '-'
        if (key === '-' && value.includes('-')) return;
        onChange(value + key);
    };

    const rows = [
        ['7','8','9'],
        ['4','5','6'],
        ['1','2','3'],
        ['+/-','0','.'],
    ];

    return (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, width:'100%' }}>
            {/* Display */}
            <div style={{ display:'flex', alignItems:'center', gap:6, width:'100%', justifyContent:'center' }}>
                <span style={{ fontSize:'1rem', fontWeight:'bold', color }}>{label}</span>
                <div style={{
                    minWidth: 80, padding:'6px 12px',
                    background:'#f8f9fa', border:`2px solid ${color}`,
                    borderRadius:10, fontSize:'1.5rem', fontWeight:'bold',
                    color:'#2c3e50', textAlign:'right', minHeight:44,
                    display:'flex', alignItems:'center', justifyContent:'flex-end',
                }}>
                    {value || <span style={{ color:'#ccc', fontSize:'1rem' }}>···</span>}
                </div>
                <button onClick={() => press('⌫')}
                    style={{ padding:'6px 10px', background:'#e74c3c', color:'white', border:'none', borderRadius:8, cursor:'pointer', fontSize:'1rem', fontWeight:'bold' }}>
                    ⌫
                </button>
            </div>
            {/* Teclado */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5, width:'100%' }}>
                {rows.flat().map(k => (
                    <button key={k} onClick={() => press(k)}
                        style={{
                            padding:'10px 0', fontSize: '1.05rem',
                            fontWeight:'bold', borderRadius:8, border:'none', cursor:'pointer',
                            background: k === '+/-' ? '#8e44ad' : k === '.' ? '#7f8c8d' : '#ecf0f1',
                            color: k === '+/-' ? 'white' : k === '.' ? 'white' : '#2c3e50',
                            boxShadow:'0 2px 0 rgba(0,0,0,0.1)',
                            transition:'transform 0.08s',
                        }}
                        onPointerDown={e => e.currentTarget.style.transform='scale(0.93)'}
                        onPointerUp={e => e.currentTarget.style.transform='scale(1)'}
                    >
                        {k}
                    </button>
                ))}
            </div>
            {/* Botón confirmar integrado */}
            <button onClick={onConfirm}
                style={{ width:'100%', padding:'10px', background:color, color:'white', border:'none', borderRadius:10, fontWeight:'bold', cursor:'pointer', fontSize:'0.95rem', marginTop:2 }}>
                ✓ Comprobar
            </button>
        </div>
    );
}

function ModoDualEcuaciones({ config, numPantallas = 2, numAlumnos = 1, onBack, playSound }) {
    const makeState = () => {
        const eq = generarEcuacion(config);
        return { eq, ans1: '', ans2: '', feedback: null, showSol: false, score: 0, total: 0 };
    };

    const [panels, setPanels] = useState(() => Array.from({ length: numPantallas }, makeState));
    const [dismissed, setDismissed] = useState(false);
    const [flashes, setFlashes] = useState(() => Array(numPantallas).fill(null));
    const [drawModes, setDrawModes] = useState(() => Array(numPantallas).fill(false));
    const [drawKeys,  setDrawKeys]  = useState(() => Array(numPantallas).fill(0));

    // ── Lista aleatoria compartida + puntero independiente por panel ──
    // Una sola lista barajada al inicio, compartida por todos los paneles.
    // Cada panel tiene su propio puntero que avanza de forma independiente.
    const shuffleArr = (arr) => [...arr].sort(() => Math.random() - 0.5);
    const listaRef    = useRef(
        numAlumnos > 1
            ? shuffleArr(Array.from({ length: numAlumnos }, (_, i) => i + 1))
            : []
    );
    // punterosRef[i] = índice actual del panel i dentro de listaRef
    // Los paneles arrancan en posiciones 0, 1, 2 de la lista
    const punterosRef = useRef(
        Array.from({ length: numPantallas }, (_, i) =>
            numAlumnos > 1 ? Math.min(i, numAlumnos - 1) : 0
        )
    );

    const [alumnos, setAlumnos] = useState(() =>
        numAlumnos > 1
            ? Array.from({ length: numPantallas }, (_, i) =>
                listaRef.current[Math.min(i, numAlumnos - 1)]
              )
            : Array(numPantallas).fill(null)
    );

    const avanzarAlumnoPanel = (panelIdx) => {
        if (numAlumnos <= 1) return;
        const nuevoPtr = punterosRef.current[panelIdx] + 1;
        if (nuevoPtr >= listaRef.current.length) {
            // Rebarajar y empezar desde 0 para este panel
            listaRef.current = shuffleArr(Array.from({ length: numAlumnos }, (_, i) => i + 1));
            punterosRef.current[panelIdx] = 0;
        } else {
            punterosRef.current[panelIdx] = nuevoPtr;
        }
        const siguiente = listaRef.current[punterosRef.current[panelIdx]];
        setAlumnos(prev => prev.map((a, i) => i === panelIdx ? siguiente : a));
    };

    const COLORS = ['#3498db', '#e74c3c', '#f39c12'];
    const LABELS = ['🔵', '🔴', '🟡'];

    const triggerFlash = (idx, type) => {
        setFlashes(f => { const n = [...f]; n[idx] = type; return n; });
        setTimeout(() => setFlashes(f => { const n = [...f]; n[idx] = null; return n; }), 700);
    };

    const comprobarPanel = (idx) => {
        const side = panels[idx];
        if (!side.eq || side.showSol) return;
        const esCuad = side.eq.tipo === 'CUADRATICA';
        const esMC = side.eq.multipleChoice != null;
        let ok = false;
        if (esMC)        ok = side.ans1 === side.eq.correctAnswers[0];
        else if (esCuad) { const v1=parseFloat(side.ans1),v2=parseFloat(side.ans2); const [r1,r2]=side.eq.correctAnswers; ok=(v1===r1&&v2===r2)||(v1===r2&&v2===r1)||(r1===r2&&(v1===r1||v2===r1)); }
        else             ok = parseFloat(side.ans1) === side.eq.correctAnswers[0];

        if (ok) { playSound('CORRECT'); triggerFlash(idx, 'CORRECT'); }
        else    { playSound('WRONG');   triggerFlash(idx, 'INCORRECT'); }

        setPanels(prev => prev.map((p, i) => i !== idx ? p : {
            ...p,
            feedback: ok ? 'CORRECT' : 'INCORRECT',
            score: ok ? p.score + 20 : Math.max(0, p.score - 5),
            total: p.total + 1,
        }));
        if (ok) setTimeout(() => siguientePanel(idx), 700);
        else    setTimeout(() => setPanels(prev => prev.map((p,i) => i!==idx ? p : {...p, feedback:null})), 700);
    };

    const skipPanel = (idx) => {
        triggerFlash(idx, 'SKIP');
        setPanels(prev => prev.map((p, i) => i !== idx ? p : { ...p, showSol: true, feedback: 'SKIP' }));
    };

    const siguientePanel = (idx) => {
        const eq = generarEcuacion(config);
        setPanels(prev => prev.map((p, i) => i !== idx ? p : { ...p, eq, ans1:'', ans2:'', feedback:null, showSol:false }));
        setDrawKeys(prev  => prev.map((k, i) => i !== idx ? k : k + 1));
        setDrawModes(prev => prev.map((d, i) => i !== idx ? d : false));
        if (numAlumnos > 1) avanzarAlumnoPanel(idx);
    };

    const setAns = (idx, field, val) => {
        setPanels(prev => prev.map((p, i) => i !== idx ? p : { ...p, [field]: val }));
    };

    const Fraction = ({ num, den }) => (
        <span style={{ display:'inline-flex', flexDirection:'column', alignItems:'center', verticalAlign:'middle', margin:'0 4px', fontSize:'1.1rem', color:'#2c3e50', fontWeight:'bold' }}>
            <span style={{ borderBottom:'2px solid #2c3e50', padding:'0 3px' }}>{num}</span>
            <span style={{ padding:'0 3px' }}>{den}</span>
        </span>
    );

    const renderEq = (eq) => eq?.ast?.map((el, i) => {
        if (el.t === 'text') return <span key={i} style={{ whiteSpace:'pre-wrap' }}>{el.v}</span>;
        if (el.t === 'frac') return <Fraction key={i} num={el.n} den={el.d} />;
        if (el.t === 'enunciado') return <div key={i} style={{ fontSize:'0.85rem', lineHeight:1.4, padding:'10px 12px', background:'#f8f9fa', borderRadius:10, borderLeft:'4px solid #34495e', textAlign:'left', width:'100%' }}>{el.v}</div>;
        return null;
    });

    const Panel = ({ idx }) => {
        const side = panels[idx];
        const flashVal = flashes[idx];
        const color = COLORS[idx] || '#3498db';
        const esCuad = side.eq?.tipo === 'CUADRATICA';
        const esMC   = side.eq?.multipleChoice != null;
        const borderC = side.feedback === 'CORRECT' ? '#2ecc71' : side.feedback === 'INCORRECT' ? '#e74c3c' : side.feedback === 'SKIP' ? '#f39c12' : '#e0e0e0';
        const aLabel = numAlumnos > 1 ? `Alumno ${alumnos[idx]}` : null;
        return (
            <div style={{ flex:1, minWidth:0, background:'white', borderRadius:16, padding:'12px 10px', boxShadow:'0 4px 15px rgba(0,0,0,0.07)', border:`3px solid ${borderC}`, transition:'border-color 0.2s', position:'relative', overflow:'hidden', display:'flex', flexDirection:'column', gap:8 }}>
                {flashVal && (
                    <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', zIndex:20, pointerEvents:'none', background: flashVal==='CORRECT'?'rgba(46,204,113,0.2)':flashVal==='INCORRECT'?'rgba(231,76,60,0.2)':'rgba(243,156,18,0.15)' }}>
                        <div style={{ fontSize:'4rem', animation:'ecuFlash 0.7s ease-out forwards' }}>{flashVal==='CORRECT'?'✅':flashVal==='INCORRECT'?'❌':'⏭️'}</div>
                    </div>
                )}
                {/* Header */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:4 }}>
                    <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
                        {aLabel
                            ? <span style={{ fontWeight:900, color, fontSize:'1.05rem' }}>{LABELS[idx]} {aLabel}</span>
                            : <span style={{ fontWeight:900, color, fontSize:'1.05rem' }}>{LABELS[idx]} Jugador {idx+1}</span>
                        }
                        {aLabel && (
                            <span style={{ color:'#aaa', fontSize:'0.72rem', marginLeft:2 }}>Jugador {idx+1}</span>
                        )}
                    </div>
                    <div style={{ background:color, color:'white', padding:'3px 10px', borderRadius:20, fontWeight:'bold', fontSize:'0.8rem' }}>
                        <Trophy size={12} style={{verticalAlign:'middle'}}/> {side.score}
                    </div>
                </div>
                {/* Ecuación */}
                <div style={{ fontSize: numPantallas > 2 ? '1.1rem' : '1.3rem', fontWeight:'bold', color:'#2c3e50', minHeight:44, display:'flex', alignItems:'center', justifyContent:'center', flexWrap:'wrap', background:'#f8f9fa', borderRadius:10, padding:'10px 8px' }}>
                    {renderEq(side.eq)}
                </div>

                {/* Lienzo por panel */}
                <div>
                    <button
                        onClick={() => setDrawModes(prev => prev.map((d, i) => i !== idx ? d : !d))}
                        style={{ padding:'5px 12px', background: drawModes[idx] ? '#e74c3c' : '#f0f0f0', color: drawModes[idx] ? 'white' : '#555', border:'none', borderRadius:20, cursor:'pointer', fontWeight:'bold', fontSize:'0.78rem' }}>
                        ✏️ {drawModes[idx] ? 'Cerrar' : 'Lienzo'}
                    </button>
                    {drawModes[idx] && (
                        <div style={{ position:'relative', width:'100%', height:120, background:'#fafafa', border:'2px dashed #bdc3c7', borderRadius:10, marginTop:6, overflow:'hidden' }}>
                            <DrawingCanvas width={600} height={120} active={true} key={`draw-${idx}-${drawKeys[idx]}`} />
                            <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', color:'#ddd', fontSize:'0.75rem', pointerEvents:'none', userSelect:'none' }}>
                                Escribe aquí
                            </div>
                        </div>
                    )}
                </div>
                {side.showSol && (
                    <div style={{ background:'#e8f8f0', border:'2px solid #27ae60', borderRadius:10, padding:'7px 12px', fontSize:'0.95rem', textAlign:'center' }}>
                        {esMC ? `✅ ${side.eq.correctAnswers[0]}` : esCuad ? `✅ X₁=${side.eq.correctAnswers[0]} X₂=${side.eq.correctAnswers[1]}` : `✅ X = ${side.eq.correctAnswers[0]}`}
                    </div>
                )}
                {!side.showSol && (
                    esMC ? (
                        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                            {side.eq.multipleChoice.map((opt, i) => (
                                <button key={i} onClick={() => { setAns(idx,'ans1',opt); setTimeout(()=>comprobarPanel(idx),50); }}
                                    style={{ padding:'8px 10px', fontSize:'0.85rem', fontWeight:'bold', background:'#f8f9fa', color:'#34495e', border:'2px solid #bdc3c7', borderRadius:8, cursor:'pointer', textAlign:'left' }}>
                                    {opt}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, width:'100%' }}>
                            <VirtualKeypad
                                value={side.ans1}
                                onChange={v => setAns(idx, 'ans1', v)}
                                onConfirm={() => comprobarPanel(idx)}
                                color={color}
                                label={esCuad ? 'X₁=' : 'X='}
                            />
                            {esCuad && (
                                <VirtualKeypad
                                    value={side.ans2}
                                    onChange={v => setAns(idx, 'ans2', v)}
                                    onConfirm={() => comprobarPanel(idx)}
                                    color="#9b59b6"
                                    label="X₂="
                                />
                            )}
                            <button onClick={() => skipPanel(idx)}
                                style={{ width:'100%', padding:'7px', background:'#f39c12', color:'white', border:'none', borderRadius:8, fontWeight:'bold', cursor:'pointer', fontSize:'0.8rem' }}>
                                ⏭ Pasar
                            </button>
                        </div>
                    )
                )}
                {side.showSol && (
                    <button onClick={() => siguientePanel(idx)}
                        style={{ padding:'8px', background:color, color:'white', border:'none', borderRadius:8, fontWeight:'bold', cursor:'pointer', fontSize:'0.88rem' }}>
                        Siguiente →
                    </button>
                )}
            </div>
        );
    };

    const modeLabel = numPantallas === 3 ? '👨‍👩‍👦 Modo Triple' : '👥 Modo Dual';

    return (
        <div style={st.container}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <button onClick={onBack} style={st.btnVolver}><RotateCcw size={16}/> Salir</button>
                <span style={{ fontWeight:'bold', color:'#27ae60', fontSize:'1.05rem' }}>{modeLabel}</span>
                <div style={{ width:60 }}/>
            </div>
            {!dismissed && (
                <div style={{ background:'#fff9e6', border:'2px solid #f39c12', borderRadius:12, padding:'10px 14px', marginBottom:12, display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontSize:'0.82rem', color:'#7d6608', flex:1 }}>
                        <strong>Modo pantalla grande:</strong> Diseñado para un monitor o tablet en horizontal.
                        {numAlumnos > 1 && ` · ${numAlumnos} alumnos rotan en el encabezado.`}
                    </span>
                    <button onClick={() => setDismissed(true)} style={{ background:'#f39c12', color:'white', border:'none', borderRadius:20, padding:'4px 12px', cursor:'pointer', fontWeight:'bold', fontSize:'0.75rem' }}>OK</button>
                </div>
            )}
            <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                {Array.from({ length: numPantallas }, (_, i) => (
                    <React.Fragment key={i}>
                        <Panel idx={i} />
                        {i < numPantallas - 1 && <div style={{ width:3, background:'#eee', alignSelf:'stretch', borderRadius:4, flexShrink:0 }}/>}
                    </React.Fragment>
                ))}
            </div>
            <style>{`@keyframes ecuFlash { 0%{transform:scale(0.4);opacity:0} 40%{transform:scale(1.2);opacity:1} 100%{transform:scale(1);opacity:0} }`}</style>
        </div>
    );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const st = {
    container: { minHeight: '100vh', background: '#E8EAF6', padding: '15px', fontFamily: "'Segoe UI', Tahoma, sans-serif", boxSizing: 'border-box' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 8 },
    btnVolver: { padding: '8px 16px', background: 'white', border: '1px solid #ccc', borderRadius: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 'bold', color: '#333', fontSize: '0.9rem' },
    btnSettings: { padding: '8px 14px', background: 'white', border: '1px solid #ccc', borderRadius: 30, cursor: 'pointer', color: '#555' },
    scoreFlex: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
    scoreBoard: { display: 'flex', gap: 6, background: 'white', padding: '7px 14px', borderRadius: 30, fontWeight: 'bold', fontSize: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', alignItems: 'center' },
    centerCard: { background: 'white', maxWidth: 620, margin: '10px auto', padding: '22px 20px', borderRadius: 20, textAlign: 'center', boxShadow: '0 15px 35px rgba(0,0,0,0.1)', boxSizing: 'border-box' },
    btnPrimary: { color: 'white', border: 'none', padding: '13px 20px', borderRadius: 30, fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 10px rgba(0,0,0,0.2)', width: '100%', maxWidth: 320 },
    btnSuccess: { background: '#27ae60', color: 'white', border: 'none', borderRadius: 14, padding: '13px 20px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 5px 0 #1e8449' },
    btnSkip: { background: '#f39c12', color: 'white', border: 'none', borderRadius: 14, padding: '13px 14px', fontSize: '0.95rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 5px 0 #d68910', flex: 1 },
    btnOption: { padding: '14px 18px', fontSize: '1.1rem', fontWeight: 'bold', background: '#f8f9fa', color: '#34495e', border: '2px solid #bdc3c7', borderRadius: 14, cursor: 'pointer' },
    inputMath: { width: 72, height: 55, fontSize: '1.8rem', textAlign: 'center', borderRadius: 10, border: '3px solid #bdc3c7', outline: 'none', background: '#f8f9fa', color: '#2c3e50', fontWeight: 'bold' },
    solutionBox: { background: '#e8f8f0', border: '2px solid #27ae60', borderRadius: 12, padding: '12px 20px', fontSize: '1.2rem', color: '#2c3e50', marginBottom: 12 },
};

const mSt = {
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
    modal: { background: 'white', borderRadius: 20, padding: '28px 24px', maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' },
    title: { textAlign: 'center', color: '#2c3e50', fontSize: '1.4rem', marginTop: 0, marginBottom: 20 },
    section: { marginBottom: 20 },
    sTitle: { fontWeight: 'bold', color: '#555', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 },
    chip: { padding: '8px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', transition: 'all 0.15s' },
    label: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, fontWeight: 'bold', color: '#555', fontSize: '0.85rem' },
    numIn: { width: 75, padding: '8px', fontSize: '1.1rem', textAlign: 'center', borderRadius: 8, border: '2px solid #ddd', outline: 'none' },
    btnPri: { padding: '12px 28px', background: '#3498db', color: 'white', border: 'none', borderRadius: 30, fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer' },
    btnSec: { padding: '12px 24px', background: '#f0f0f0', color: '#555', border: 'none', borderRadius: 30, fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' },
};
