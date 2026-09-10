// EnigmicLogic.jsx — "Enigmic": acertijos de lógica (cuadrado latino / zebra puzzle)
// para aprender vocabulario y preposiciones en inglés, francés y español.
//
// Estructura del tablero: N casillas (columnas) x K categorías (filas).
// Cada categoría es una permutación de sus N elementos → cada elemento aparece
// una sola vez por fila y una sola vez por columna (cuadrado latino de atributos).
// El generador crea la solución, extrae hechos verdaderos y elige un subconjunto
// mínimo de pistas que garantiza SOLUCIÓN ÚNICA (solver con propagación + DFS).

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { db } from './firebase';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';
import { guardarRegistroLocal } from './utils/registrosLocales';

/* ═══════════════════════════════════════════════════════════════
   1. VOCABULARIO  (es / en / fr)
   Cada elemento aporta por idioma:
     lbl  → etiqueta corta para el tablero ("médico" / "doctor")
     suj  → sintagma sujeto ("El médico" / "The one who sings")
     pred → predicado afirmativo ("es el médico" / "sings")
     neg  → predicado negativo ("no es el médico" / "does not sing")
   La forma "de + sintagma" (del médico / du médecin) se deriva con deForm().
   ═══════════════════════════════════════════════════════════════ */

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const low = s => s.charAt(0).toLowerCase() + s.slice(1);

function deForm(lang, suj) {
    const s = low(suj);
    if (lang === 'es') {
        if (s.startsWith('el ')) return 'del ' + s.slice(3);
        if (s.startsWith('la ')) return 'de la ' + s.slice(3);
        return 'de ' + s;
    }
    if (lang === 'ca') {
        if (s.startsWith('el ')) return 'del ' + s.slice(3);
        if (s.startsWith('la ')) return 'de la ' + s.slice(3);
        if (s.startsWith('els ')) return 'dels ' + s.slice(4);
        if (s.startsWith("l'")) return "de l'" + s.slice(2);
        return 'de ' + s;
    }
    if (lang === 'fr') {
        if (s.startsWith('le ')) return 'du ' + s.slice(3);
        if (s.startsWith('la ')) return 'de la ' + s.slice(3);
        if (s.startsWith('les ')) return 'des ' + s.slice(4);
        if (s.startsWith("l'")) return "de l'" + s.slice(2);
        return 'de ' + s;
    }
    return s; // inglés: "... of the doctor"
}

// --- constructores de elementos -------------------------------------------
// Profesiones: "El médico" / "The doctor" / "Le médecin" / "El metge"
const prof = (id, emoji, [aEs, nEs], nEn, [aFr, nFr], [aCa, nCa]) => ({
    id, emoji,
    es: { lbl: nEs, suj: cap(aEs + ' ' + nEs), pred: 'es ' + aEs + ' ' + nEs, neg: 'no es ' + aEs + ' ' + nEs },
    en: { lbl: nEn, suj: 'The ' + nEn, pred: 'is the ' + nEn, neg: 'is not the ' + nEn },
    fr: { lbl: nFr, suj: cap(aFr + ' ' + nFr), pred: 'est ' + aFr + ' ' + nFr, neg: "n'est pas " + aFr + ' ' + nFr },
    ca: { lbl: nCa, suj: cap(aCa + ' ' + nCa), pred: 'és ' + aCa + ' ' + nCa, neg: 'no és ' + aCa + ' ' + nCa },
});

// Verbos de acción: "El que canta" / "The one who sings" / "Celui qui chante" / "El que canta"
const verb = (id, emoji, es3, [en3, enBase], fr3, ca3) => ({
    id, emoji,
    es: { lbl: es3, suj: 'El que ' + es3, pred: es3, neg: 'no ' + es3 },
    en: { lbl: en3, suj: 'The one who ' + en3, pred: en3, neg: 'does not ' + enBase },
    fr: { lbl: fr3, suj: 'Celui qui ' + fr3, pred: fr3, neg: 'ne ' + fr3 + ' pas' },
    ca: { lbl: ca3, suj: 'El que ' + ca3, pred: ca3, neg: 'no ' + ca3 },
});

// Objetos / mascotas: "El que tiene el libro" / "The one who has the book"
const has = (id, emoji, [lEs, xEs], [lEn, xEn], [lFr, xFr, xFrNeg], [lCa, xCa]) => ({
    id, emoji,
    es: { lbl: lEs, suj: 'El que tiene ' + xEs, pred: 'tiene ' + xEs, neg: 'no tiene ' + xEs },
    en: { lbl: lEn, suj: 'The one who has ' + xEn, pred: 'has ' + xEn, neg: 'does not have ' + xEn },
    fr: { lbl: lFr, suj: 'Celui qui a ' + xFr, pred: 'a ' + xFr, neg: "n'a pas " + xFrNeg },
    ca: { lbl: lCa, suj: 'El que té ' + xCa, pred: 'té ' + xCa, neg: 'no té ' + xCa },
});

// Colores: "El que viste de azul" / "The one who wears blue" / "El que va vestit de blau"
const wears = (id, emoji, xEs, xEn, [lFr, xFr, xFrNeg], xCa) => ({
    id, emoji,
    es: { lbl: xEs, suj: 'El que viste de ' + xEs, pred: 'viste de ' + xEs, neg: 'no viste de ' + xEs },
    en: { lbl: xEn, suj: 'The one who wears ' + xEn, pred: 'wears ' + xEn, neg: 'does not wear ' + xEn },
    fr: { lbl: lFr, suj: 'Celui qui porte ' + xFr, pred: 'porte ' + xFr, neg: 'ne porte pas ' + xFrNeg },
    ca: { lbl: xCa, suj: 'El que va vestit de ' + xCa, pred: 'va vestit de ' + xCa, neg: 'no va vestit de ' + xCa },
});

// Comidas: "El que come pizza" / "The one who eats pizza" / "El que menja pizza"
const eats = (id, emoji, [lEs, xEs], [lEn, xEn], [lFr, xFr, xFrNeg], [lCa, xCa]) => ({
    id, emoji,
    es: { lbl: lEs, suj: 'El que come ' + xEs, pred: 'come ' + xEs, neg: 'no come ' + xEs },
    en: { lbl: lEn, suj: 'The one who eats ' + xEn, pred: 'eats ' + xEn, neg: 'does not eat ' + xEn },
    fr: { lbl: lFr, suj: 'Celui qui mange ' + xFr, pred: 'mange ' + xFr, neg: 'ne mange pas ' + xFrNeg },
    ca: { lbl: lCa, suj: 'El que menja ' + xCa, pred: 'menja ' + xCa, neg: 'no menja ' + xCa },
});

// Países: "El que viene de España" / "The one who is from Spain" / "El que ve d'Espanya"
const from = (id, emoji, pEs, pEn, [lFr, pFr], [lCa, pCa]) => ({
    id, emoji,
    es: { lbl: pEs, suj: 'El que viene de ' + pEs, pred: 'viene de ' + pEs, neg: 'no viene de ' + pEs },
    en: { lbl: pEn, suj: 'The one who is from ' + pEn, pred: 'is from ' + pEn, neg: 'is not from ' + pEn },
    fr: { lbl: lFr, suj: 'Celui qui vient ' + pFr, pred: 'vient ' + pFr, neg: 'ne vient pas ' + pFr },
    ca: { lbl: lCa, suj: 'El que ve ' + pCa, pred: 've ' + pCa, neg: 'no ve ' + pCa },
});

export const CATEGORIAS = [
    {
        id: 'PROFESIONES', emoji: '👔',
        nombre: { es: 'Profesiones', en: 'Jobs', fr: 'Métiers', ca: 'Professions' },
        items: [
            prof('medico', '🩺', ['el', 'médico'], 'doctor', ['le', 'médecin'], ['el', 'metge']),
            prof('cocinero', '👨‍🍳', ['el', 'cocinero'], 'cook', ['le', 'cuisinier'], ['el', 'cuiner']),
            prof('profesor', '👩‍🏫', ['el', 'profesor'], 'teacher', ['le', 'professeur'], ['el', 'professor']),
            prof('piloto', '✈️', ['el', 'piloto'], 'pilot', ['le', 'pilote'], ['el', 'pilot']),
            prof('detective', '🕵️', ['el', 'detective'], 'detective', ['le', 'détective'], ['el', 'detectiu']),
            prof('policia', '👮', ['el', 'policía'], 'police officer', ['le', 'policier'], ['el', 'policia']),
        ],
    },
    {
        id: 'VERBOS', emoji: '🏃',
        nombre: { es: 'Acciones', en: 'Actions', fr: 'Actions', ca: 'Accions' },
        items: [
            verb('cantar', '🎤', 'canta', ['sings', 'sing'], 'chante', 'canta'),
            verb('leer', '📖', 'lee', ['reads', 'read'], 'lit', 'llegeix'),
            verb('nadar', '🏊', 'nada', ['swims', 'swim'], 'nage', 'neda'),
            verb('bailar', '💃', 'baila', ['dances', 'dance'], 'danse', 'balla'),
            verb('pintar', '🎨', 'pinta', ['paints', 'paint'], 'peint', 'pinta'),
            verb('correr', '🏃', 'corre', ['runs', 'run'], 'court', 'corre'),
        ],
    },
    {
        id: 'OBJETOS', emoji: '🎒',
        nombre: { es: 'Objetos', en: 'Objects', fr: 'Objets', ca: 'Objectes' },
        items: [
            has('libro', '📚', ['libro', 'el libro'], ['book', 'the book'], ['livre', 'le livre', 'le livre'], ['llibre', 'el llibre']),
            has('paraguas', '☂️', ['paraguas', 'el paraguas'], ['umbrella', 'the umbrella'], ['parapluie', 'le parapluie', 'le parapluie'], ['paraigua', 'el paraigua']),
            has('mochila', '🎒', ['mochila', 'la mochila'], ['backpack', 'the backpack'], ['sac à dos', 'le sac à dos', 'le sac à dos'], ['motxilla', 'la motxilla']),
            has('reloj', '⌚', ['reloj', 'el reloj'], ['watch', 'the watch'], ['montre', 'la montre', 'la montre'], ['rellotge', 'el rellotge']),
            has('llave', '🔑', ['llave', 'la llave'], ['key', 'the key'], ['clé', 'la clé', 'la clé'], ['clau', 'la clau']),
            has('movil', '📱', ['móvil', 'el móvil'], ['phone', 'the phone'], ['téléphone', 'le téléphone', 'le téléphone'], ['mòbil', 'el mòbil']),
        ],
    },
    {
        id: 'COLORES', emoji: '🎨',
        nombre: { es: 'Colores', en: 'Colours', fr: 'Couleurs', ca: 'Colors' },
        items: [
            wears('rojo', '🔴', 'rojo', 'red', ['rouge', 'du rouge', 'de rouge'], 'vermell'),
            wears('azul', '🔵', 'azul', 'blue', ['bleu', 'du bleu', 'de bleu'], 'blau'),
            wears('verde', '🟢', 'verde', 'green', ['vert', 'du vert', 'de vert'], 'verd'),
            wears('amarillo', '🟡', 'amarillo', 'yellow', ['jaune', 'du jaune', 'de jaune'], 'groc'),
            wears('negro', '⚫', 'negro', 'black', ['noir', 'du noir', 'de noir'], 'negre'),
            wears('blanco', '⚪', 'blanco', 'white', ['blanc', 'du blanc', 'de blanc'], 'blanc'),
        ],
    },
    {
        id: 'COMIDAS', emoji: '🍕',
        nombre: { es: 'Comidas', en: 'Food', fr: 'Nourriture', ca: 'Menjars' },
        items: [
            eats('pizza', '🍕', ['pizza', 'pizza'], ['pizza', 'pizza'], ['pizza', 'de la pizza', 'de pizza'], ['pizza', 'pizza']),
            eats('manzana', '🍎', ['manzana', 'una manzana'], ['apple', 'an apple'], ['pomme', 'une pomme', 'de pomme'], ['poma', 'una poma']),
            eats('pan', '🍞', ['pan', 'pan'], ['bread', 'bread'], ['pain', 'du pain', 'de pain'], ['pa', 'pa']),
            eats('queso', '🧀', ['queso', 'queso'], ['cheese', 'cheese'], ['fromage', 'du fromage', 'de fromage'], ['formatge', 'formatge']),
            eats('chocolate', '🍫', ['chocolate', 'chocolate'], ['chocolate', 'chocolate'], ['chocolat', 'du chocolat', 'de chocolat'], ['xocolata', 'xocolata']),
            eats('sopa', '🍜', ['sopa', 'sopa'], ['soup', 'soup'], ['soupe', 'de la soupe', 'de soupe'], ['sopa', 'sopa']),
        ],
    },
    {
        id: 'ANIMALES', emoji: '🐶',
        nombre: { es: 'Mascotas', en: 'Pets', fr: 'Animaux', ca: 'Mascotes' },
        items: [
            has('perro', '🐶', ['perro', 'un perro'], ['dog', 'a dog'], ['chien', 'un chien', 'de chien'], ['gos', 'un gos']),
            has('gato', '🐱', ['gato', 'un gato'], ['cat', 'a cat'], ['chat', 'un chat', 'de chat'], ['gat', 'un gat']),
            has('pajaro', '🐦', ['pájaro', 'un pájaro'], ['bird', 'a bird'], ['oiseau', 'un oiseau', "d'oiseau"], ['ocell', 'un ocell']),
            has('pez', '🐟', ['pez', 'un pez'], ['fish', 'a fish'], ['poisson', 'un poisson', 'de poisson'], ['peix', 'un peix']),
            has('caballo', '🐴', ['caballo', 'un caballo'], ['horse', 'a horse'], ['cheval', 'un cheval', 'de cheval'], ['cavall', 'un cavall']),
            has('conejo', '🐰', ['conejo', 'un conejo'], ['rabbit', 'a rabbit'], ['lapin', 'un lapin', 'de lapin'], ['conill', 'un conill']),
        ],
    },
    {
        id: 'PAISES', emoji: '🌍',
        nombre: { es: 'Países', en: 'Countries', fr: 'Pays', ca: 'Països' },
        items: [
            from('espana', '🇪🇸', 'España', 'Spain', ['Espagne', "d'Espagne"], ['Espanya', "d'Espanya"]),
            from('francia', '🇫🇷', 'Francia', 'France', ['France', 'de France'], ['França', 'de França']),
            from('italia', '🇮🇹', 'Italia', 'Italy', ['Italie', "d'Italie"], ['Itàlia', "d'Itàlia"]),
            from('portugal', '🇵🇹', 'Portugal', 'Portugal', ['Portugal', 'du Portugal'], ['Portugal', 'de Portugal']),
            from('inglaterra', '🇬🇧', 'Inglaterra', 'England', ['Angleterre', "d'Angleterre"], ['Anglaterra', "d'Anglaterra"]),
            from('alemania', '🇩🇪', 'Alemania', 'Germany', ['Allemagne', "d'Allemagne"], ['Alemanya', "d'Alemanya"]),
        ],
    },
];

export const CAT_POR_ID = Object.fromEntries(CATEGORIAS.map(c => [c.id, c]));

/* ═══════════════════════════════════════════════════════════════
   2. REDACCIÓN DE PISTAS  (la misma pista, en los 3 idiomas)
   ═══════════════════════════════════════════════════════════════ */

const T = {
    es: {
        pos: (s, p) => `${s} está en la casilla ${p}.`,
        notpos: (s, p) => `${s} no está en la casilla ${p}.`,
        ends: s => `${s} está en uno de los dos extremos.`,
        same: (s, pr) => `${s} ${pr}.`,
        notsame: (s, ng) => `${s} ${ng}.`,
        leftimm: (a, b) => `${a} está justo a la izquierda ${b}.`,
        rightimm: (a, b) => `${a} está justo a la derecha ${b}.`,
        left: (a, b) => `${a} está en algún lugar a la izquierda ${b}.`,
        right: (a, b) => `${a} está en algún lugar a la derecha ${b}.`,
        next: (a, b) => `${a} está al lado ${b}.`,
        between: (a, b, c) => `${a} está entre ${b} y ${c}.`,
        casilla: 'Casilla',
    },
    en: {
        pos: (s, p) => `${s} is in position ${p}.`,
        notpos: (s, p) => `${s} is not in position ${p}.`,
        ends: s => `${s} is at one of the two ends.`,
        same: (s, pr) => `${s} ${pr}.`,
        notsame: (s, ng) => `${s} ${ng}.`,
        leftimm: (a, b) => `${a} is immediately to the left of ${b}.`,
        rightimm: (a, b) => `${a} is immediately to the right of ${b}.`,
        left: (a, b) => `${a} is somewhere to the left of ${b}.`,
        right: (a, b) => `${a} is somewhere to the right of ${b}.`,
        next: (a, b) => `${a} is next to ${b}.`,
        between: (a, b, c) => `${a} is between ${b} and ${c}.`,
        casilla: 'Position',
    },
    fr: {
        pos: (s, p) => `${s} est à la place ${p}.`,
        notpos: (s, p) => `${s} n'est pas à la place ${p}.`,
        ends: s => `${s} est à l'une des deux extrémités.`,
        same: (s, pr) => `${s} ${pr}.`,
        notsame: (s, ng) => `${s} ${ng}.`,
        leftimm: (a, b) => `${a} est juste à gauche ${b}.`,
        rightimm: (a, b) => `${a} est juste à droite ${b}.`,
        left: (a, b) => `${a} est quelque part à gauche ${b}.`,
        right: (a, b) => `${a} est quelque part à droite ${b}.`,
        next: (a, b) => `${a} est à côté ${b}.`,
        between: (a, b, c) => `${a} est entre ${b} et ${c}.`,
        casilla: 'Place',
    },
    ca: {
        pos: (s, p) => `${s} és a la casella ${p}.`,
        notpos: (s, p) => `${s} no és a la casella ${p}.`,
        ends: s => `${s} és en un dels dos extrems.`,
        same: (s, pr) => `${s} ${pr}.`,
        notsame: (s, ng) => `${s} ${ng}.`,
        leftimm: (a, b) => `${a} és just a l'esquerra ${b}.`,
        rightimm: (a, b) => `${a} és just a la dreta ${b}.`,
        left: (a, b) => `${a} és en algun lloc a l'esquerra ${b}.`,
        right: (a, b) => `${a} és en algun lloc a la dreta ${b}.`,
        next: (a, b) => `${a} és al costat ${b}.`,
        between: (a, b, c) => `${a} és entre ${b} i ${c}.`,
        casilla: 'Casella',
    },
};

// Preposiciones y estructuras que aparecen en las pistas (panel de ayuda).
// Preposiciones y estructuras que aparecen en las pistas, con un esquema visual
// del tablero que explica su significado SIN traducir (🟪 = sujeto, 🟦/🟩 = el otro).
export const PREPOSICIONES = {
    en: [
        ['in position 3', '⬜⬜🟪⬜⬜'],
        ['to the left of', '🟪 ⬜ ⬜ 🟦'],
        ['to the right of', '🟦 ⬜ ⬜ 🟪'],
        ['immediately to the left of', '🟪🟦'],
        ['immediately to the right of', '🟦🟪'],
        ['next to', '🟪🟦  /  🟦🟪'],
        ['between … and …', '🟦🟪🟩'],
        ['at one of the two ends', '🟪⬜⬜⬜🟪'],
        ['is not … / does not …', '❌'],
    ],
    fr: [
        ['à la place 3', '⬜⬜🟪⬜⬜'],
        ['à gauche de / du', '🟪 ⬜ ⬜ 🟦'],
        ['à droite de / du', '🟦 ⬜ ⬜ 🟪'],
        ['juste à gauche de / du', '🟪🟦'],
        ['juste à droite de / du', '🟦🟪'],
        ['à côté de / du', '🟪🟦  /  🟦🟪'],
        ['entre … et …', '🟦🟪🟩'],
        ["à l'une des deux extrémités", '🟪⬜⬜⬜🟪'],
        ["n'est pas … / ne … pas", '❌'],
    ],
    ca: [
        ['a la casella 3', '⬜⬜🟪⬜⬜'],
        ["a l'esquerra de / del", '🟪 ⬜ ⬜ 🟦'],
        ['a la dreta de / del', '🟦 ⬜ ⬜ 🟪'],
        ["just a l'esquerra de / del", '🟪🟦'],
        ['just a la dreta de / del', '🟦🟪'],
        ['al costat de / del', '🟪🟦  /  🟦🟪'],
        ['entre … i …', '🟦🟪🟩'],
        ['en un dels dos extrems', '🟪⬜⬜⬜🟪'],
        ['no és … / no …', '❌'],
    ],
    es: [
        ['en la casilla 3', '⬜⬜🟪⬜⬜'],
        ['a la izquierda de / del', '🟪 ⬜ ⬜ 🟦'],
        ['a la derecha de / del', '🟦 ⬜ ⬜ 🟪'],
        ['justo a la izquierda de / del', '🟪🟦'],
        ['justo a la derecha de / del', '🟦🟪'],
        ['al lado de / del', '🟪🟦  /  🟦🟪'],
        ['entre … y …', '🟦🟪🟩'],
        ['en uno de los dos extremos', '🟪⬜⬜⬜🟪'],
        ['no es … / no …', '❌'],
    ],
};

// Elemento a partir de una referencia [catIdx, itemIdx]
const ref = (cats, r) => cats[r[0]].items[r[1]];

// Redacta una pista en el idioma pedido.
export function textoPista(clue, cats, lang) {
    const t = T[lang];
    const S = r => ref(cats, r)[lang].suj;               // "El médico"
    const O = r => low(ref(cats, r)[lang].suj);          // "el médico"
    const D = r => deForm(lang, ref(cats, r)[lang].suj); // "del médico"
    switch (clue.t) {
        case 'pos': return t.pos(S(clue.a), clue.p + 1);
        case 'notpos': return t.notpos(S(clue.a), clue.p + 1);
        case 'ends': return t.ends(S(clue.a));
        case 'same': return t.same(S(clue.a), ref(cats, clue.b)[lang].pred);
        case 'notsame': return t.notsame(S(clue.a), ref(cats, clue.b)[lang].neg);
        case 'leftimm': return clue.flip
            ? t.rightimm(S(clue.b), D(clue.a))
            : t.leftimm(S(clue.a), D(clue.b));
        case 'left': return clue.flip
            ? t.right(S(clue.b), D(clue.a))
            : t.left(S(clue.a), D(clue.b));
        case 'next': return t.next(S(clue.a), D(clue.b));
        case 'between': return t.between(S(clue.a), O(clue.b), O(clue.c));
        default: return '';
    }
}

/* ═══════════════════════════════════════════════════════════════
   3. SOLVER  (dominios de bits + propagación + DFS contando hasta 2)
   Variable = (categoría, elemento). Dominio = máscara de casillas posibles.
   ═══════════════════════════════════════════════════════════════ */

const bits = m => { let c = 0; while (m) { c += m & 1; m >>= 1; } return c; };
const lowestPos = m => { let p = 0; while (!((m >> p) & 1)) p++; return p; };
const highestPos = m => { let p = 0, x = m; while (x > 1) { x >>= 1; p++; } return p; };

// ¿Se cumple la pista en una solución completa? pos[c][i] = casilla.
function cumple(clue, pos) {
    const P = r => pos[r[0]][r[1]];
    const N = pos[0].length;
    switch (clue.t) {
        case 'pos': return P(clue.a) === clue.p;
        case 'notpos': return P(clue.a) !== clue.p;
        case 'ends': return P(clue.a) === 0 || P(clue.a) === N - 1;
        case 'same': return P(clue.a) === P(clue.b);
        case 'notsame': return P(clue.a) !== P(clue.b);
        case 'leftimm': return P(clue.a) + 1 === P(clue.b);
        case 'left': return P(clue.a) < P(clue.b);
        case 'next': return Math.abs(P(clue.a) - P(clue.b)) === 1;
        case 'between': {
            const a = P(clue.a), b = P(clue.b), c = P(clue.c);
            return (b === a - 1 && c === a + 1) || (c === a - 1 && b === a + 1);
        }
        default: return true;
    }
}

// Propaga las pistas sobre los dominios. Devuelve false si hay contradicción.
function propagar(dom, clues, N, K) {
    const FULL = (1 << N) - 1;
    let cambio = true, vueltas = 0;
    while (cambio && vueltas < 60) {
        cambio = false; vueltas++;
        const set = (r, m) => {
            const old = dom[r[0]][r[1]];
            const nv = old & m;
            if (nv !== old) { dom[r[0]][r[1]] = nv; cambio = true; }
            return nv !== 0;
        };
        const get = r => dom[r[0]][r[1]];

        for (const cl of clues) {
            switch (cl.t) {
                case 'pos': if (!set(cl.a, 1 << cl.p)) return false; break;
                case 'notpos': if (!set(cl.a, FULL & ~(1 << cl.p))) return false; break;
                case 'ends': if (!set(cl.a, 1 | (1 << (N - 1)))) return false; break;
                case 'same': {
                    const m = get(cl.a) & get(cl.b);
                    if (!set(cl.a, m) || !set(cl.b, m)) return false;
                    break;
                }
                case 'notsame': {
                    const da = get(cl.a), db = get(cl.b);
                    if (bits(da) === 1 && !set(cl.b, FULL & ~da)) return false;
                    if (bits(db) === 1 && !set(cl.a, FULL & ~db)) return false;
                    break;
                }
                case 'leftimm': {
                    const da = get(cl.a), db = get(cl.b);
                    if (!set(cl.a, (db >> 1) & FULL)) return false;
                    if (!set(cl.b, (da << 1) & FULL)) return false;
                    break;
                }
                case 'left': {
                    const da = get(cl.a), db = get(cl.b);
                    if (!set(cl.a, (1 << highestPos(db)) - 1)) return false;
                    if (!set(cl.b, FULL & ~((1 << (lowestPos(da) + 1)) - 1))) return false;
                    break;
                }
                case 'next': {
                    const da = get(cl.a), db = get(cl.b);
                    if (!set(cl.a, ((db << 1) | (db >> 1)) & FULL)) return false;
                    if (!set(cl.b, ((da << 1) | (da >> 1)) & FULL)) return false;
                    break;
                }
                case 'between': {
                    const da = get(cl.a), db = get(cl.b), dc = get(cl.c);
                    const m = (((db << 1) & (dc >> 1)) | ((dc << 1) & (db >> 1))) & FULL;
                    if (!set(cl.a, m)) return false;
                    const vecinos = ((get(cl.a) << 1) | (get(cl.a) >> 1)) & FULL;
                    if (!set(cl.b, vecinos) || !set(cl.c, vecinos)) return false;
                    break;
                }
                default: break;
            }
        }

        // Restricciones estructurales de cada categoría (permutación).
        for (let c = 0; c < K; c++) {
            for (let i = 0; i < N; i++) {
                if (dom[c][i] === 0) return false;
                if (bits(dom[c][i]) === 1) {
                    for (let j = 0; j < N; j++) {
                        if (j === i) continue;
                        const nv = dom[c][j] & ~dom[c][i];
                        if (nv !== dom[c][j]) { dom[c][j] = nv; cambio = true; }
                        if (nv === 0) return false;
                    }
                }
            }
            // Cada casilla debe poder alojar a alguien (y si sólo uno puede, es él).
            for (let p = 0; p < N; p++) {
                let cand = -1, n = 0;
                for (let i = 0; i < N; i++) if ((dom[c][i] >> p) & 1) { cand = i; n++; }
                if (n === 0) return false;
                if (n === 1 && dom[c][cand] !== (1 << p)) { dom[c][cand] = 1 << p; cambio = true; }
            }
        }
    }
    return true;
}

const clonar = dom => dom.map(f => f.slice());

// Cuenta soluciones hasta `limite` (2 basta para saber si es única).
function contarSoluciones(clues, N, K, limite = 2) {
    const FULL = (1 << N) - 1;
    const dom0 = Array.from({ length: K }, () => new Array(N).fill(FULL));
    if (!propagar(dom0, clues, N, K)) return 0;
    let total = 0;

    const dfs = dom => {
        if (total >= limite) return;
        // variable con menor dominio > 1
        let bc = -1, bi = -1, mejor = 99;
        for (let c = 0; c < K; c++) for (let i = 0; i < N; i++) {
            const n = bits(dom[c][i]);
            if (n > 1 && n < mejor) { mejor = n; bc = c; bi = i; }
        }
        if (bc === -1) {
            const pos = dom.map(f => f.map(m => lowestPos(m)));
            // comprobación completa (la propagación puede ser incompleta)
            for (let c = 0; c < K; c++) {
                const usadas = new Set(pos[c]);
                if (usadas.size !== N) return;
            }
            for (const cl of clues) if (!cumple(cl, pos)) return;
            total++;
            return;
        }
        for (let p = 0; p < N; p++) {
            if (!((dom[bc][bi] >> p) & 1)) continue;
            const d2 = clonar(dom);
            d2[bc][bi] = 1 << p;
            if (propagar(d2, clues, N, K)) dfs(d2);
            if (total >= limite) return;
        }
    };
    dfs(dom0);
    return total;
}

/* ═══════════════════════════════════════════════════════════════
   4. GENERADOR DE ENIGMAS
   ═══════════════════════════════════════════════════════════════ */

const rnd = n => Math.floor(Math.random() * n);
function barajar(a) {
    const x = a.slice();
    for (let i = x.length - 1; i > 0; i--) { const j = rnd(i + 1); [x[i], x[j]] = [x[j], x[i]]; }
    return x;
}

// Tipos de pista permitidos por nivel.
export const NIVELES = {
    FACIL: { id: 'FACIL', nombre: 'Fácil', tipos: ['pos', 'same', 'notsame', 'leftimm', 'next'], sinAbsolutas: 0 },
    MEDIO: { id: 'MEDIO', nombre: 'Medio', tipos: ['pos', 'notpos', 'same', 'notsame', 'leftimm', 'next', 'left', 'ends'], sinAbsolutas: 0 },
    DIFICIL: { id: 'DIFICIL', nombre: 'Difícil', tipos: ['notpos', 'same', 'notsame', 'leftimm', 'next', 'left', 'between', 'ends', 'pos'], sinAbsolutas: 1 },
};

// Construye el conjunto de hechos verdaderos de la solución.
function poolDePistas(pos, N, K, tipos) {
    const out = [];
    const add = c => out.push(c);
    const P = (c, i) => pos[c][i];

    for (let c = 0; c < K; c++) for (let i = 0; i < N; i++) {
        if (tipos.includes('pos')) add({ t: 'pos', a: [c, i], p: P(c, i) });
        if (tipos.includes('notpos')) for (let p = 0; p < N; p++) if (p !== P(c, i)) add({ t: 'notpos', a: [c, i], p });
        if (tipos.includes('ends') && (P(c, i) === 0 || P(c, i) === N - 1)) add({ t: 'ends', a: [c, i] });
    }
    for (let c1 = 0; c1 < K; c1++) for (let c2 = 0; c2 < K; c2++) {
        for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
            if (c1 === c2) continue;
            const p1 = P(c1, i), p2 = P(c2, j);
            const A = [c1, i], B = [c2, j];
            if (c1 < c2) {
                if (tipos.includes('same') && p1 === p2) add({ t: 'same', a: A, b: B });
                if (tipos.includes('notsame') && p1 !== p2) add({ t: 'notsame', a: A, b: B });
            }
            if (tipos.includes('leftimm') && p1 + 1 === p2) add({ t: 'leftimm', a: A, b: B, flip: Math.random() < 0.5 });
            if (tipos.includes('next') && Math.abs(p1 - p2) === 1 && c1 < c2) add({ t: 'next', a: A, b: B });
            if (tipos.includes('left') && p1 < p2 - 1) add({ t: 'left', a: A, b: B, flip: Math.random() < 0.5 });
        }
    }
    // pistas dentro de la misma categoría (adyacencia / orden)
    for (let c = 0; c < K; c++) for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        if (i === j) continue;
        const p1 = P(c, i), p2 = P(c, j);
        if (tipos.includes('leftimm') && p1 + 1 === p2) add({ t: 'leftimm', a: [c, i], b: [c, j], flip: Math.random() < 0.5 });
        if (tipos.includes('left') && p1 < p2 - 1 && i < j) add({ t: 'left', a: [c, i], b: [c, j], flip: Math.random() < 0.5 });
    }
    // "entre": A entre B y C (adyacentes por ambos lados)
    if (tipos.includes('between')) {
        for (let c = 0; c < K; c++) for (let i = 0; i < N; i++) {
            const p = P(c, i);
            if (p === 0 || p === N - 1) continue;
            for (let c2 = 0; c2 < K; c2++) for (let c3 = 0; c3 < K; c3++) {
                const izq = pos[c2].findIndex(x => x === p - 1);
                const der = pos[c3].findIndex(x => x === p + 1);
                if (izq < 0 || der < 0) continue;
                if (c2 === c && izq === i) continue;
                if (c3 === c && der === i) continue;
                add({ t: 'between', a: [c, i], b: [c2, izq], c: [c3, der] });
            }
        }
    }
    return out;
}

// Genera un enigma con solución única y pistas mínimas.
export function generarEnigma({ N = 5, catIds = ['PROFESIONES', 'VERBOS', 'OBJETOS'], nivel = 'MEDIO' }) {
    const conf = NIVELES[nivel] || NIVELES.MEDIO;
    const K = catIds.length;
    const cats = catIds.map(id => {
        const c = CAT_POR_ID[id];
        return { ...c, items: barajar(c.items).slice(0, N) };
    });

    // Solución: una permutación por categoría. pos[c][i] = casilla del elemento i.
    const pos = [];
    for (let c = 0; c < K; c++) {
        const perm = barajar([...Array(N).keys()]);
        pos.push(perm);
    }

    let pool = barajar(poolDePistas(pos, N, K, conf.tipos));
    // En nivel difícil las posiciones absolutas van al final (se usan sólo si hacen falta).
    if (conf.sinAbsolutas) {
        pool = [...pool.filter(c => c.t !== 'pos'), ...pool.filter(c => c.t === 'pos')];
    }

    const elegidas = [];
    for (const cl of pool) {
        if (contarSoluciones(elegidas, N, K, 2) === 1) break;
        elegidas.push(cl);
    }
    // Poda: quita pistas redundantes (dos pasadas para afinar).
    for (let vuelta = 0; vuelta < 2; vuelta++) {
        for (let i = elegidas.length - 1; i >= 0; i--) {
            const sin = elegidas.filter((_, k) => k !== i);
            if (contarSoluciones(sin, N, K, 2) === 1) elegidas.splice(i, 1);
        }
    }

    return {
        N, K, cats, pos,
        clues: barajar(elegidas),
        nivel: conf.id,
        creado: Date.now(),
    };
}

/* ═══════════════════════════════════════════════════════════════
   5. INTERFAZ
   ═══════════════════════════════════════════════════════════════ */

const IDIOMAS = {
    en: { flag: '🇬🇧', nom: 'English', tts: 'en-GB' },
    fr: { flag: '🇫🇷', nom: 'Français', tts: 'fr-FR' },
    ca: { flag: '🌐', nom: 'Català', tts: 'ca-ES' },
    es: { flag: '🇪🇸', nom: 'Español', tts: 'es-ES' },
};

const COL = {
    fondo: '#11161f',
    panel: '#1b2330',
    panel2: '#232d3d',
    borde: 'rgba(255,255,255,0.10)',
    texto: '#e8eef7',
    suave: '#94a3b8',
    oro: '#f1c40f',
    ok: '#2ecc71',
    mal: '#e74c3c',
    acento: '#7c3aed',
};

const hablar = (texto, lang) => {
    try {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(texto);
        u.lang = IDIOMAS[lang]?.tts || 'es-ES';
        u.rate = 0.9;
        window.speechSynthesis.speak(u);
    } catch { /* silencioso */ }
};

const fmtTiempo = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

// ---------------------------------------------------------------- pantalla de configuración
function PantallaConfig({ conf, setConf, onJugar }) {
    const toggleCat = id => {
        const ya = conf.catIds.includes(id);
        if (ya && conf.catIds.length <= 2) return;
        setConf({ ...conf, catIds: ya ? conf.catIds.filter(x => x !== id) : [...conf.catIds, id].slice(0, 5) });
    };
    const btn = (activo, extra = {}) => ({
        padding: '10px 16px', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem',
        border: activo ? `2px solid ${COL.oro}` : `1.5px solid ${COL.borde}`,
        background: activo ? 'rgba(241,196,15,0.15)' : 'rgba(255,255,255,0.05)',
        color: activo ? COL.oro : COL.texto, fontFamily: 'inherit', ...extra,
    });
    const bloque = { background: COL.panel, border: `1px solid ${COL.borde}`, borderRadius: 16, padding: '16px 18px', marginBottom: 14 };
    const titulo = { fontSize: '0.78rem', color: COL.suave, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 };

    return (
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '10px 4px 40px' }}>
            <div style={{ textAlign: 'center', marginBottom: 22 }}>
                <div style={{ fontSize: '3rem', lineHeight: 1 }}>🕵️‍♂️</div>
                <h1 style={{ margin: '8px 0 4px', fontSize: '1.7rem', color: COL.oro }}>Enigmic</h1>
                <p style={{ margin: 0, color: COL.suave, fontSize: '0.92rem' }}>
                    Acertijos de lógica al estilo Einstein. Lee las pistas en el idioma que estudias
                    y coloca cada elemento en su casilla. Cada elemento aparece una sola vez por fila y por columna.
                </p>
            </div>

            <div style={bloque}>
                <div style={titulo}>Idioma de las pistas</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {Object.entries(IDIOMAS).map(([k, v]) => (
                        <button key={k} onClick={() => setConf({ ...conf, lang: k })} style={btn(conf.lang === k)}>
                            {v.flag} {v.nom}
                        </button>
                    ))}
                </div>
            </div>

            <div style={bloque}>
                <div style={titulo}>Cómo se presentan las pistas</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button onClick={() => setConf({ ...conf, modo: 'LEER' })} style={btn(conf.modo !== 'ESCUCHAR')}>
                        📖 Leer las pistas
                    </button>
                    <button onClick={() => setConf({ ...conf, modo: 'ESCUCHAR' })} style={btn(conf.modo === 'ESCUCHAR')}>
                        🎧 Solo escuchar
                    </button>
                </div>
                <div style={{ color: COL.suave, fontSize: '0.8rem', marginTop: 8 }}>
                    {conf.modo === 'ESCUCHAR'
                        ? 'Comprensión oral: el alumno no ve el texto de las pistas, sólo puede escucharlas (todas las veces que quiera). El texto aparece al revelar la solución.'
                        : 'El alumno lee las pistas y puede escucharlas con el botón 🔊 de cada una.'}
                </div>
            </div>

            <div style={bloque}>
                <div style={titulo}>Tamaño del tablero</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    {[5, 6].map(n => (
                        <button key={n} onClick={() => setConf({ ...conf, N: n })} style={btn(conf.N === n)}>
                            {n} casillas
                        </button>
                    ))}
                    <span style={{ color: COL.suave, fontSize: '0.82rem' }}>
                        × {conf.catIds.length} categorías = tablero {conf.N}×{conf.catIds.length}
                    </span>
                </div>
            </div>

            <div style={bloque}>
                <div style={titulo}>Nivel</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {Object.values(NIVELES).map(n => (
                        <button key={n.id} onClick={() => setConf({ ...conf, nivel: n.id })} style={btn(conf.nivel === n.id)}>
                            {n.id === 'FACIL' ? '🟢' : n.id === 'MEDIO' ? '🟡' : '🔴'} {n.nombre}
                        </button>
                    ))}
                </div>
                <div style={{ color: COL.suave, fontSize: '0.8rem', marginTop: 8 }}>
                    {conf.nivel === 'FACIL' && 'Pistas directas: posición, "es el…", "justo a la izquierda de", "al lado de".'}
                    {conf.nivel === 'MEDIO' && 'Añade negaciones ("no es…", "no está en la casilla 3") y "en algún lugar a la izquierda de".'}
                    {conf.nivel === 'DIFICIL' && 'Casi sin posiciones absolutas: negaciones, "entre … y …" y "en uno de los dos extremos".'}
                </div>
            </div>

            <div style={bloque}>
                <div style={titulo}>Categorías (2 a 5) — vocabulario que se trabaja</div>
                <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                    {CATEGORIAS.map(c => (
                        <button key={c.id} onClick={() => toggleCat(c.id)} style={btn(conf.catIds.includes(c.id), { padding: '9px 13px' })}>
                            {c.emoji} {c.nombre[conf.lang]}
                        </button>
                    ))}
                </div>
            </div>

            <button onClick={onJugar} style={{
                width: '100%', padding: '16px', borderRadius: 16, border: 'none', cursor: 'pointer',
                background: `linear-gradient(135deg, ${COL.oro}, #e67e22)`, color: '#1b2330',
                fontWeight: 800, fontSize: '1.1rem', fontFamily: 'inherit',
            }}>🔍 Resolver el caso</button>
        </div>
    );
}

// ---------------------------------------------------------------- tablero
function Tablero({ enigma, lang, grid, notas, onCelda, revelado, marcarErrores }) {
    const { N, cats } = enigma;
    const solDe = (c, p) => enigma.pos[c].indexOf(p);
    const cellBase = {
        minHeight: 62, borderRadius: 12, border: `1.5px dashed ${COL.borde}`,
        background: 'rgba(255,255,255,0.04)', cursor: 'pointer', display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 4, textAlign: 'center', gap: 2, transition: 'background .15s',
    };
    return (
        <div style={{ overflowX: 'auto', paddingBottom: 6 }}>
            <div style={{
                display: 'grid',
                gridTemplateColumns: `minmax(96px, 0.9fr) repeat(${N}, minmax(78px, 1fr))`,
                gap: 6, minWidth: 96 + N * 84,
            }}>
                <div />
                {Array.from({ length: N }, (_, p) => (
                    <div key={p} style={{
                        textAlign: 'center', fontWeight: 800, color: COL.oro, fontSize: '0.85rem',
                        padding: '6px 0', background: 'rgba(241,196,15,0.08)', borderRadius: 10,
                    }}>{T[lang].casilla} {p + 1}</div>
                ))}

                {cats.map((cat, c) => (
                    <React.Fragment key={cat.id}>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px',
                            background: COL.panel2, borderRadius: 10, fontWeight: 700, fontSize: '0.82rem',
                        }}>
                            <span style={{ fontSize: '1.1rem' }}>{cat.emoji}</span>
                            <span>{cat.nombre[lang]}</span>
                        </div>
                        {Array.from({ length: N }, (_, p) => {
                            const idx = revelado ? solDe(c, p) : grid[c][p];
                            const item = idx == null || idx < 0 ? null : cat.items[idx];
                            const malo = marcarErrores && !revelado && idx != null && idx !== solDe(c, p);
                            const bueno = marcarErrores && !revelado && idx != null && idx === solDe(c, p);
                            const desc = [...(notas[`${c}-${p}`] || [])];
                            return (
                                <div key={p} onClick={() => onCelda(c, p)} style={{
                                    ...cellBase,
                                    border: item ? `2px solid ${malo ? COL.mal : bueno ? COL.ok : COL.acento}` : cellBase.border,
                                    background: item
                                        ? (malo ? 'rgba(231,76,60,0.16)' : bueno ? 'rgba(46,204,113,0.16)' : 'rgba(124,58,237,0.16)')
                                        : cellBase.background,
                                }}>
                                    {item ? (
                                        <>
                                            <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{item.emoji}</span>
                                            <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>{item[lang].lbl}</span>
                                        </>
                                    ) : desc.length ? (
                                        <span style={{ fontSize: '0.85rem', opacity: 0.55, filter: 'grayscale(1)' }}>
                                            {desc.map(i => cat.items[i].emoji).join('')}
                                        </span>
                                    ) : <span style={{ color: COL.suave, fontSize: '1.1rem', opacity: 0.35 }}>+</span>}
                                </div>
                            );
                        })}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------- selector de elemento
function Picker({ cat, lang, N, grid, fila, casilla, notas, onElegir, onNota, onQuitar, onClose }) {
    const puestos = {};
    grid[fila].forEach((it, p) => { if (it != null) puestos[it] = p; });
    const desc = notas[`${fila}-${casilla}`] || new Set();
    return (
        <div onClick={onClose} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 10001,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
            <div onClick={e => e.stopPropagation()} style={{
                background: COL.panel, border: `1px solid ${COL.borde}`, borderRadius: 18,
                padding: '18px 20px', width: '100%', maxWidth: 420, color: COL.texto,
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontWeight: 800, color: COL.oro }}>
                        {cat.emoji} {cat.nombre[lang]} → {T[lang].casilla} {casilla + 1}
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: COL.suave, fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
                    {cat.items.map((it, i) => {
                        const en = puestos[i];
                        const tachado = desc.has(i);
                        return (
                            <div key={it.id} style={{
                                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 9px', borderRadius: 11,
                                border: `1.5px solid ${tachado ? 'rgba(231,76,60,0.5)' : COL.borde}`,
                                background: tachado ? 'rgba(231,76,60,0.08)' : 'rgba(255,255,255,0.05)',
                                opacity: tachado ? 0.55 : 1,
                            }}>
                                <button onClick={() => onElegir(i)} style={{
                                    flex: 1, display: 'flex', alignItems: 'center', gap: 7, background: 'none',
                                    border: 'none', color: COL.texto, cursor: 'pointer', fontFamily: 'inherit',
                                    fontSize: '0.85rem', fontWeight: 700, textAlign: 'left', padding: 0,
                                    textDecoration: tachado ? 'line-through' : 'none',
                                }}>
                                    <span style={{ fontSize: '1.3rem' }}>{it.emoji}</span>
                                    <span>{it[lang].lbl}</span>
                                    {en != null && en !== casilla && (
                                        <span style={{ fontSize: '0.68rem', color: COL.suave }}>({en + 1})</span>
                                    )}
                                </button>
                                <button title="Descartar en esta casilla" onClick={() => onNota(i)} style={{
                                    background: 'none', border: 'none', color: tachado ? COL.mal : COL.suave,
                                    cursor: 'pointer', fontSize: '0.9rem', padding: 0,
                                }}>🚫</button>
                            </div>
                        );
                    })}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                    <button onClick={onQuitar} style={{
                        flex: 1, padding: '10px', borderRadius: 11, border: `1px solid ${COL.borde}`,
                        background: 'transparent', color: COL.texto, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700,
                    }}>🧹 Vaciar casilla</button>
                </div>
                <div style={{ color: COL.suave, fontSize: '0.74rem', marginTop: 9 }}>
                    🚫 marca un elemento como imposible en esta casilla (queda anotado en el tablero).
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------- enviar al profesor
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
                tipo: 'ENIGMIC',
                modalidad: 'Individual',
                fecha: new Date(),
                codigoProfesor: code,
                jugadores: [{
                    nombre: nombre.trim(),
                    curso: curso.trim(),
                    aciertos: datos.aciertos,
                    intentos: datos.intentos,
                    porcentaje: Math.round((datos.aciertos / Math.max(1, datos.intentos)) * 100),
                    idioma: datos.idioma,
                    nivel: datos.nivel,
                    tablero: datos.tablero,
                    modo: datos.modo,
                    categorias: datos.categorias,
                    tiempoTotal: datos.tiempoTotal,
                    ayudas: datos.ayudas,
                }],
            });
            guardarRegistroLocal('ENIGMIC', {
                titulo: `Enigmic ${datos.tablero} · ${datos.idioma}`,
                aciertos: datos.aciertos, intentos: datos.intentos,
                porcentaje: Math.round((datos.aciertos / Math.max(1, datos.intentos)) * 100),
                nombre: nombre.trim(), curso: curso.trim(), via: 'profesor',
            });
            setEnviado(true);
        } catch (e) { setError('Error: ' + e.message); }
        setEnviando(false);
    };

    const inp = {
        padding: '9px 12px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.15)',
        background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '0.9rem',
        outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit',
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 10002, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 14 }}>
            <div style={{ background: '#1e272e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, width: '100%', maxWidth: 380, padding: '26px 28px', color: 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f1c40f' }}>📤 Enviar al profesor</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.2rem' }}>✕</button>
                </div>
                {enviado ? (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{ fontSize: '3rem' }}>✅</div>
                        <div style={{ color: '#2ecc71', fontWeight: 700 }}>¡Informe enviado!</div>
                        <div style={{ color: '#aaa', fontSize: '0.88rem', marginTop: 8 }}>{datos.aciertos}/{datos.intentos} enigmas resueltos</div>
                        <button onClick={onClose} style={{ marginTop: 16, padding: '9px 22px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', color: 'white' }}>Cerrar</button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div><label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 }}>Nombre y apellido</label>
                            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre completo" style={inp} /></div>
                        <div><label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 }}>Curso</label>
                            <input value={curso} onChange={e => setCurso(e.target.value)} placeholder="Ej: 3º ESO A" style={inp} /></div>
                        <div><label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 }}>Código del profesor</label>
                            <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="Ej: PROF01" maxLength={10} style={{ ...inp, letterSpacing: 2, fontWeight: 700 }} /></div>
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

/* ═══════════════════════════════════════════════════════════════
   6. COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════════ */

export default function EnigmicLogic({ usuario, onExit, onBack }) {
    const salir = onExit || onBack || (() => { window.history.pushState({}, '', '/'); window.location.reload(); });

    const [pantalla, setPantalla] = useState('CONFIG');
    const [conf, setConf] = useState({ lang: 'en', N: 5, nivel: 'MEDIO', modo: 'LEER', catIds: ['PROFESIONES', 'VERBOS', 'OBJETOS'] });
    const [enigma, setEnigma] = useState(null);
    const [grid, setGrid] = useState([]);
    const [notas, setNotas] = useState({});
    const [picker, setPicker] = useState(null);
    const [usadas, setUsadas] = useState(new Set());
    const [revelado, setRevelado] = useState(false);
    const [marcarErrores, setMarcarErrores] = useState(false);
    const [aviso, setAviso] = useState('');
    const [victoria, setVictoria] = useState(false);
    const [ayuda, setAyuda] = useState(false);
    const [segundos, setSegundos] = useState(0);
    const [mostrarEnvio, setMostrarEnvio] = useState(false);

    // estadísticas de sesión
    const [resueltos, setResueltos] = useState(0);
    const [intentos, setIntentos] = useState(0);
    const [ayudasUsadas, setAyudas] = useState(0);
    const [tiempoTotal, setTiempoTotal] = useState(0);

    const timerRef = useRef(null);
    useEffect(() => {
        if (pantalla !== 'JUEGO' || victoria || revelado) return;
        timerRef.current = setInterval(() => setSegundos(s => s + 1), 1000);
        return () => clearInterval(timerRef.current);
    }, [pantalla, victoria, revelado]);

    const nuevoEnigma = useCallback((c = conf) => {
        const e = generarEnigma({ N: c.N, catIds: c.catIds, nivel: c.nivel });
        setEnigma(e);
        setGrid(Array.from({ length: e.K }, () => new Array(e.N).fill(null)));
        setNotas({});
        setUsadas(new Set());
        setRevelado(false);
        setMarcarErrores(false);
        setVictoria(false);
        setAviso('');
        setSegundos(0);
        setPantalla('JUEGO');
    }, [conf]);

    const ponerEnCelda = (i) => {
        const { c, p } = picker;
        setGrid(g => g.map((fila, fc) => fc !== c ? fila : fila.map((v, fp) => (fp === p ? i : (v === i ? null : v)))));
        setMarcarErrores(false);
        setPicker(null);
    };
    const vaciarCelda = () => {
        const { c, p } = picker;
        setGrid(g => g.map((fila, fc) => fc !== c ? fila : fila.map((v, fp) => (fp === p ? null : v))));
        setPicker(null);
    };
    const toggleNota = (i) => {
        const { c, p } = picker;
        const k = `${c}-${p}`;
        setNotas(n => {
            const s = new Set(n[k] || []);
            s.has(i) ? s.delete(i) : s.add(i);
            return { ...n, [k]: s };
        });
    };

    const comprobar = () => {
        if (!enigma) return;
        const vacias = grid.some(f => f.some(v => v == null));
        if (vacias) { setAviso('Faltan casillas por completar.'); return; }
        let mal = 0;
        for (let c = 0; c < enigma.K; c++) for (let p = 0; p < enigma.N; p++) {
            if (grid[c][p] !== enigma.pos[c].indexOf(p)) mal++;
        }
        setIntentos(n => n + 1);
        setMarcarErrores(true);
        if (mal === 0) {
            setVictoria(true);
            setResueltos(n => n + 1);
            setTiempoTotal(t => t + segundos);
            setAviso('');
            guardarRegistroLocal('ENIGMIC', {
                titulo: `Enigmic ${enigma.N}×${enigma.K} · ${IDIOMAS[conf.lang].nom} · ${NIVELES[conf.nivel].nombre}`,
                aciertos: resueltos + 1, intentos: intentos + 1,
                porcentaje: Math.round(((resueltos + 1) / (intentos + 1)) * 100),
                nombre: usuario?.displayName || '', curso: '', via: 'guardar',
            });
        } else {
            setAviso(`${mal} casilla${mal === 1 ? '' : 's'} mal colocada${mal === 1 ? '' : 's'} (en rojo).`);
        }
    };

    const resolver = () => {
        setRevelado(true);
        setAyudas(a => a + 1);
        setIntentos(n => n + 1);
        setAviso('Solución revelada: este enigma no cuenta como resuelto.');
    };

    const soloAudio = conf.modo === 'ESCUCHAR';
    const hayVoz = typeof window !== 'undefined' && !!window.speechSynthesis;

    // Lee todas las pistas seguidas, con una pausa entre ellas.
    const reproducirTodas = () => {
        if (!enigma || !hayVoz) return;
        window.speechSynthesis.cancel();
        enigma.clues.forEach(cl => {
            const u = new SpeechSynthesisUtterance(textoPista(cl, enigma.cats, conf.lang));
            u.lang = IDIOMAS[conf.lang].tts;
            u.rate = 0.9;
            window.speechSynthesis.speak(u);
        });
    };

    const bloqueBtn = (bg, extra = {}) => ({
        padding: '10px 15px', borderRadius: 12, border: 'none', cursor: 'pointer',
        background: bg, color: 'white', fontWeight: 700, fontSize: '0.85rem', fontFamily: 'inherit', ...extra,
    });

    // ------------------------------------------------ render
    const cuerpo = (() => {
        if (pantalla === 'CONFIG') {
            return <PantallaConfig conf={conf} setConf={setConf} onJugar={() => nuevoEnigma(conf)} />;
        }
        if (!enigma) return null;
        const lang = conf.lang;
        return (
            <div style={{ maxWidth: 1080, margin: '0 auto', padding: '4px 4px 40px' }}>
                {/* barra de estado */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ background: COL.panel2, borderRadius: 10, padding: '6px 11px', fontSize: '0.8rem', fontWeight: 700 }}>
                        ⏱️ {fmtTiempo(segundos)}
                    </span>
                    <span style={{ background: COL.panel2, borderRadius: 10, padding: '6px 11px', fontSize: '0.8rem', fontWeight: 700 }}>
                        🏆 {resueltos}/{intentos}
                    </span>
                    <span style={{ background: COL.panel2, borderRadius: 10, padding: '6px 11px', fontSize: '0.8rem' }}>
                        {IDIOMAS[lang].flag} {enigma.N}×{enigma.K} · {NIVELES[enigma.nivel].nombre} · {soloAudio ? '🎧 solo escucha' : '📖 lectura'}
                    </span>
                    <div style={{ flex: 1 }} />
                    <button onClick={() => setAyuda(a => !a)} style={bloqueBtn('rgba(255,255,255,0.1)')}>📖 Vocabulario</button>
                    <button onClick={() => setPantalla('CONFIG')} style={bloqueBtn('rgba(255,255,255,0.1)')}>⚙️ Ajustes</button>
                </div>

                {ayuda && (
                    <div style={{ background: COL.panel, border: `1px solid ${COL.borde}`, borderRadius: 16, padding: '14px 16px', marginBottom: 12 }}>
                        <div style={{ fontWeight: 800, color: COL.oro, marginBottom: 8, fontSize: '0.9rem' }}>
                            Preposiciones y estructuras ({IDIOMAS[lang].nom})
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px,1fr))', gap: 6, marginBottom: 12 }}>
                            {PREPOSICIONES[lang].map(([a, esquema]) => (
                                <div key={a} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 7 }}>
                                    <strong style={{ color: COL.texto }}>{a}</strong>
                                    <span style={{ letterSpacing: 1 }}>{esquema}</span>
                                </div>
                            ))}
                        </div>
                        <div style={{ fontWeight: 800, color: COL.oro, marginBottom: 8, fontSize: '0.9rem' }}>Vocabulario del caso</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px,1fr))', gap: 6 }}>
                            {enigma.cats.map(cat => cat.items.map(it => (
                                <div key={cat.id + it.id} style={{ fontSize: '0.8rem', display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <span>{it.emoji}</span>
                                    <strong>{it[lang].lbl}</strong>
                                    <button onClick={() => hablar(it[lang].lbl, lang)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COL.suave, padding: 0 }}>🔊</button>
                                </div>
                            )))}
                        </div>
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 14 }}>
                    <div style={{ background: COL.panel, border: `1px solid ${COL.borde}`, borderRadius: 16, padding: '14px 14px 10px' }}>
                        <Tablero
                            enigma={enigma} lang={lang} grid={grid} notas={notas}
                            revelado={revelado} marcarErrores={marcarErrores}
                            onCelda={(c, p) => !revelado && setPicker({ c, p })}
                        />
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                            <button onClick={comprobar} disabled={revelado} style={bloqueBtn(revelado ? '#555' : `linear-gradient(135deg,${COL.ok},#27ae60)`)}>✅ Comprobar</button>
                            <button onClick={() => nuevoEnigma()} style={bloqueBtn(`linear-gradient(135deg,${COL.acento},#5b21b6)`)}>🔄 Nuevo caso</button>
                            <button onClick={resolver} disabled={revelado} style={bloqueBtn('rgba(255,255,255,0.1)')}>💡 Resolver</button>
                            <button onClick={() => setMostrarEnvio(true)} style={bloqueBtn(`linear-gradient(135deg,${COL.oro},#e67e22)`, { color: '#1b2330' })}>📤 Enviar al profesor</button>
                        </div>
                        {aviso && (
                            <div style={{ marginTop: 10, fontSize: '0.85rem', color: victoria ? COL.ok : COL.oro }}>⚠ {aviso}</div>
                        )}
                    </div>

                    {/* pistas */}
                    <div style={{ background: COL.panel, border: `1px solid ${COL.borde}`, borderRadius: 16, padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 800, color: COL.oro }}>
                                {soloAudio ? '🎧' : '🔎'} {enigma.clues.length} pistas
                            </span>
                            <span style={{ color: COL.suave, fontSize: '0.76rem' }}>
                                {soloAudio
                                    ? 'Modo escucha: las pistas no se ven. Púlsalas para oírlas las veces que necesites.'
                                    : 'Toca una pista para tacharla cuando la hayas usado.'}
                            </span>
                            {soloAudio && (
                                <button onClick={reproducirTodas} style={bloqueBtn('rgba(255,255,255,0.1)', { padding: '6px 11px', fontSize: '0.78rem' })}>
                                    ▶️ Escuchar todas
                                </button>
                            )}
                        </div>
                        {soloAudio && !hayVoz && (
                            <div style={{ color: COL.mal, fontSize: '0.8rem', marginBottom: 9 }}>
                                ⚠ Este navegador no tiene voz disponible. Cambia a modo lectura en ⚙️ Ajustes.
                            </div>
                        )}
                        <ol style={{ margin: 0, paddingLeft: soloAudio && !revelado ? 0 : 22, listStyleType: soloAudio && !revelado ? 'none' : 'decimal', display: 'flex', flexDirection: 'column', gap: 9 }}>
                            {enigma.clues.map((cl, i) => {
                                const tach = usadas.has(i);
                                const texto = textoPista(cl, enigma.cats, lang);
                                const verTexto = !soloAudio || revelado;
                                const toggleTachar = () => setUsadas(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });
                                return (
                                    <li key={i} style={{ color: tach ? COL.suave : COL.texto }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            {verTexto ? (
                                                <span onClick={toggleTachar}
                                                    style={{ flex: 1, cursor: 'pointer', fontSize: '0.92rem', lineHeight: 1.45, textDecoration: tach ? 'line-through' : 'none' }}
                                                >{texto}</span>
                                            ) : (
                                                <button onClick={() => hablar(texto, lang)} style={{
                                                    flex: 1, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 9,
                                                    padding: '9px 12px', borderRadius: 11, cursor: 'pointer', fontFamily: 'inherit',
                                                    border: `1.5px solid ${tach ? COL.borde : 'rgba(124,58,237,0.55)'}`,
                                                    background: tach ? 'rgba(255,255,255,0.03)' : 'rgba(124,58,237,0.14)',
                                                    color: COL.texto, fontWeight: 700, fontSize: '0.88rem', opacity: tach ? 0.5 : 1,
                                                }}>
                                                    <span style={{ fontSize: '1.1rem' }}>🔊</span>
                                                    <span>Escuchar pista {i + 1}</span>
                                                </button>
                                            )}
                                            {verTexto && (
                                                <button onClick={() => hablar(texto, lang)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: COL.suave, fontSize: '0.9rem' }}>🔊</button>
                                            )}
                                            {!verTexto && (
                                                <button onClick={toggleTachar} title="Marcar como usada"
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: tach ? COL.ok : COL.suave, fontSize: '1rem' }}>
                                                    {tach ? '☑' : '☐'}
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ol>
                        <div style={{ marginTop: 12, color: COL.suave, fontSize: '0.76rem', borderTop: `1px solid ${COL.borde}`, paddingTop: 9 }}>
                            Regla: en cada fila, cada elemento ocupa una casilla distinta; ninguna casilla puede repetir elemento de la misma fila.
                        </div>
                    </div>
                </div>
            </div>
        );
    })();

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999, background: COL.fondo, color: COL.texto,
            overflowY: 'auto', fontFamily: "'Segoe UI', system-ui, sans-serif", padding: '58px 12px 20px',
        }}>
            <button onClick={salir} style={{
                position: 'fixed', top: 12, left: 12, zIndex: 10000, padding: '8px 14px', borderRadius: 10,
                border: `1px solid ${COL.borde}`, background: COL.panel2, color: COL.texto, fontWeight: 700, cursor: 'pointer',
            }}>← Volver</button>

            {cuerpo}

            {picker && enigma && (
                <Picker
                    cat={enigma.cats[picker.c]} lang={conf.lang} N={enigma.N} grid={grid}
                    fila={picker.c} casilla={picker.p} notas={notas}
                    onElegir={ponerEnCelda} onNota={toggleNota} onQuitar={vaciarCelda} onClose={() => setPicker(null)}
                />
            )}

            {victoria && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                    <div style={{ background: COL.panel, border: `2px solid ${COL.ok}`, borderRadius: 20, padding: '26px 28px', maxWidth: 380, width: '100%', textAlign: 'center' }}>
                        <div style={{ fontSize: '3rem' }}>🎉</div>
                        <h2 style={{ margin: '6px 0', color: COL.ok }}>¡Caso resuelto!</h2>
                        <p style={{ color: COL.suave, fontSize: '0.9rem', margin: '0 0 16px' }}>
                            Tiempo: {fmtTiempo(segundos)} · Enigmas resueltos: {resueltos}/{intentos}
                        </p>
                        <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
                            <button onClick={() => nuevoEnigma()} style={bloqueBtn(`linear-gradient(135deg,${COL.acento},#5b21b6)`, { padding: '12px' })}>🔄 Otro caso</button>
                            <button onClick={() => setMostrarEnvio(true)} style={bloqueBtn(`linear-gradient(135deg,${COL.oro},#e67e22)`, { padding: '12px', color: '#1b2330' })}>📤 Enviar al profesor</button>
                            <button onClick={() => setVictoria(false)} style={bloqueBtn('rgba(255,255,255,0.1)', { padding: '12px' })}>Ver el tablero</button>
                        </div>
                    </div>
                </div>
            )}

            {mostrarEnvio && (
                <ModalEnviarProfe
                    datos={{
                        aciertos: resueltos, intentos: Math.max(1, intentos),
                        idioma: IDIOMAS[conf.lang].nom, nivel: NIVELES[conf.nivel].nombre,
                        tablero: `${conf.N}×${conf.catIds.length}`,
                        modo: conf.modo === 'ESCUCHAR' ? 'Solo escucha' : 'Lectura',
                        categorias: conf.catIds.map(id => CAT_POR_ID[id].nombre.es),
                        tiempoTotal, ayudas: ayudasUsadas,
                    }}
                    onClose={() => setMostrarEnvio(false)}
                />
            )}
        </div>
    );
}
