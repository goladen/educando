import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { guardarRegistroLocal } from './utils/registrosLocales';
import { sonidoActivo, setSonidoActivo, sonidoCorrecto, sonidoIncorrecto, sonidoFinal } from './utils/sonidosFeedback';
import { TIPOS_MATES, crearGeneradorMates } from './ovniMates';

// ─── Ovni Abducción ──────────────────────────────────────────────────────────
// Granja 3D de noche (three.js): el enunciado pide una categoría («Abduce: VERBOS»)
// y cada animal lleva un cartel con una palabra. Hay que abducir con el rayo
// a todos los de esa categoría; si subes uno equivocado, la nave lo escupe y
// pierdes una vida. Los animales son low-poly procedurales (patas articuladas,
// caminar/correr/pastar/asustarse), sin modelos externos.

// ─── Bancos de categorías (modo libre) ───────────────────────────────────────
export const BANCOS_OVNI = [
    {
        id: 'gramatica', nombre: 'Categorías gramaticales', emoji: '📝', materia: 'Lengua',
        categorias: {
            'Sustantivos': ['casa', 'perro', 'libro', 'mesa', 'árbol', 'ciudad', 'amigo', 'montaña', 'río', 'ventana', 'lápiz', 'camino', 'flor', 'escuela', 'nube'],
            'Verbos': ['correr', 'saltar', 'comer', 'escribir', 'cantar', 'leer', 'dormir', 'jugar', 'pensar', 'nadar', 'bailar', 'vivir', 'abrir', 'mirar', 'subir'],
            'Adjetivos': ['alto', 'bonito', 'rápido', 'feliz', 'verde', 'grande', 'suave', 'valiente', 'amable', 'alegre', 'oscuro', 'pequeño', 'dulce', 'limpio', 'tranquilo'],
            'Adverbios': ['rápidamente', 'ayer', 'siempre', 'aquí', 'nunca', 'lejos', 'todavía', 'despacio', 'ahora', 'jamás', 'cerca', 'pronto', 'también', 'quizás', 'hoy'],
        },
    },
    {
        id: 'acentuacion', nombre: 'Agudas, llanas y esdrújulas', emoji: '✍️', materia: 'Lengua',
        categorias: {
            'Agudas': ['canción', 'reloj', 'papel', 'café', 'sofá', 'camión', 'pared', 'feliz', 'jabón', 'ratón', 'mamá', 'vivir', 'corazón', 'compás', 'salud'],
            'Llanas': ['árbol', 'mesa', 'lápiz', 'casa', 'fácil', 'libro', 'azúcar', 'cárcel', 'perro', 'útil', 'silla', 'césped', 'zapato', 'móvil', 'ventana'],
            'Esdrújulas': ['música', 'pájaro', 'médico', 'teléfono', 'lámpara', 'sábado', 'brújula', 'plátano', 'número', 'cámara', 'miércoles', 'océano', 'fábrica', 'árboles', 'régimen'],
        },
    },
    {
        id: 'vertebrados', nombre: 'Clases de vertebrados', emoji: '🦎', materia: 'Ciencias',
        categorias: {
            'Mamíferos': ['delfín', 'murciélago', 'ballena', 'león', 'vaca', 'ornitorrinco', 'canguro', 'lobo', 'conejo', 'elefante', 'foca', 'jirafa'],
            'Aves': ['pingüino', 'avestruz', 'águila', 'gallina', 'loro', 'búho', 'cigüeña', 'paloma', 'flamenco', 'colibrí', 'pato', 'gorrión'],
            'Reptiles': ['cocodrilo', 'tortuga', 'lagartija', 'serpiente', 'camaleón', 'iguana', 'víbora', 'caimán', 'geco', 'dragón de Komodo'],
            'Peces': ['tiburón', 'salmón', 'atún', 'sardina', 'caballito de mar', 'raya', 'trucha', 'merluza', 'pez payaso', 'bacalao'],
            'Anfibios': ['rana', 'sapo', 'salamandra', 'tritón', 'ajolote', 'gallipato'],
        },
    },
    {
        id: 'pares', nombre: 'Pares e impares', emoji: '🔢', materia: 'Matemáticas',
        categorias: {
            'Números pares': ['12', '38', '140', '6', '74', '1.000', '256', '90', '18', '2', '532', '48', '316', '64'],
            'Números impares': ['7', '15', '99', '3', '121', '57', '1', '333', '45', '89', '701', '23', '505', '77'],
        },
    },
    {
        id: 'english', nombre: 'English vocabulary', emoji: '🇬🇧', materia: 'Inglés',
        categorias: {
            'Animals': ['dog', 'horse', 'rabbit', 'tiger', 'sheep', 'monkey', 'duck', 'snake', 'whale', 'mouse'],
            'Colours': ['red', 'yellow', 'purple', 'green', 'orange', 'pink', 'brown', 'grey', 'blue', 'black'],
            'Food': ['bread', 'cheese', 'apple', 'rice', 'pasta', 'egg', 'soup', 'banana', 'cake', 'milk'],
            'Clothes': ['shirt', 'jacket', 'shoes', 'hat', 'skirt', 'socks', 'dress', 'scarf', 'trousers', 'gloves'],
        },
    },
    {
        id: 'geografia', nombre: 'Países, capitales y ríos', emoji: '🌍', materia: 'Geografía',
        categorias: {
            'Países': ['Francia', 'Portugal', 'Italia', 'Alemania', 'Grecia', 'Noruega', 'Polonia', 'Suecia', 'Irlanda', 'Austria'],
            'Capitales': ['Madrid', 'París', 'Roma', 'Berlín', 'Lisboa', 'Atenas', 'Oslo', 'Varsovia', 'Dublín', 'Viena'],
            'Ríos': ['Ebro', 'Tajo', 'Duero', 'Guadalquivir', 'Danubio', 'Rin', 'Sena', 'Támesis', 'Loira', 'Volga'],
        },
    },
];

const KEY_CUSTOM = 'pikt_ovni_custom';
const EJEMPLO_CUSTOM = 'Frutas: manzana, pera, plátano, uva, naranja, fresa\nVerduras: lechuga, zanahoria, pepino, calabacín, puerro, acelga\nCereales: trigo, arroz, maíz, avena, cebada, centeno';

/** «Categoría: palabra, palabra…» por línea → { categoría: [palabras] } (o null si no hay al menos 2 categorías con 2 palabras). */
export const parsearCategorias = (texto) => {
    const cats = {};
    String(texto || '').split('\n').forEach(linea => {
        const i = linea.indexOf(':');
        if (i <= 0) return;
        const nombre = linea.slice(0, i).trim();
        const palabras = linea.slice(i + 1).split(',').map(p => p.trim()).filter(Boolean);
        if (nombre && palabras.length) cats[nombre] = [...new Set([...(cats[nombre] || []), ...palabras])];
    });
    const validas = Object.fromEntries(Object.entries(cats).filter(([, ps]) => ps.length >= 2));
    return Object.keys(validas).length >= 2 ? validas : null;
};

const barajar = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
};

/**
 * Rondas a partir de categorías de palabras: cada ronda pide una categoría
 * (barajadas, sin repetir dos seguidas) con 3-4 palabras suyas y el resto de otras.
 * Devuelve generarRonda(i) → { objetivo, items: [{ texto, correcta, explicacion }] }.
 */
export const crearGeneradorPalabras = (categorias, totalRondas) => {
    const nombres = Object.keys(categorias);
    const esDe = (p, cat) => (categorias[cat] || []).includes(p);
    const usadas = Object.fromEntries(nombres.map(c => [c, []]));
    const orden = [];
    while (orden.length < totalRondas) {
        barajar(nombres).forEach(c => {
            if (orden.length < totalRondas && orden[orden.length - 1] !== c) orden.push(c);
        });
    }
    const sacar = (cat, n, excluirCat) => {
        let libres = categorias[cat].filter(p => !usadas[cat].includes(p) && !(excluirCat && esDe(p, excluirCat)));
        if (libres.length < n) {
            usadas[cat] = [];
            libres = categorias[cat].filter(p => !(excluirCat && esDe(p, excluirCat)));
        }
        const elegidas = barajar(libres).slice(0, n);
        usadas[cat].push(...elegidas);
        return elegidas;
    };
    return (i) => {
        const objetivo = orden[i % orden.length];
        const otras = nombres.filter(c => c !== objetivo);
        const nObj = Math.min(categorias[objetivo].length, 3 + Math.floor(Math.random() * 2));
        const items = sacar(objetivo, nObj).map(p => ({ texto: p, correcta: true }));
        for (let k = 0; items.length < ANIMALES_POR_RONDA && k < 40; k++) {
            const c = otras[k % otras.length];
            const [p] = sacar(c, 1, objetivo);
            if (p && !items.some(it => it.texto === p)) items.push({ texto: p, correcta: false, explicacion: `«${p}» es de ${c}` });
        }
        return { objetivo, items };
    };
};

// ─── Ajustes del motor ───────────────────────────────────────────────────────
const LIMITE = 52;           // medio lado del prado donde se mueven nave y animales
const ALTURA_OVNI = 8;
const RADIO_RAYO = 3.4;      // distancia horizontal para poder abducir
const ESCALA_ANIMAL = 1.3;
const ANIMALES_POR_RONDA = 8;
const VIDAS = 3;

const ANIMO = {
    tranquilos: { alerta: 0, espera: 1 },
    normal: { alerta: 5.5, espera: 1.0 },
    nerviosos: { alerta: 8, espera: 0.5 },
};

// velocidad paseando / huyendo (unidades por segundo)
const TIPOS = {
    vaca: { paseo: 0.7, huida: 4.5, alto: 2.2 },
    oveja: { paseo: 0.9, huida: 5.0, alto: 1.6 },
    cerdo: { paseo: 1.0, huida: 5.5, alto: 1.45 },
    pollo: { paseo: 2.2, huida: 6.0, alto: 1.3 },
    caballo: { paseo: 1.6, huida: 8.0, alto: 2.9 },
};
const NOMBRES_TIPOS = Object.keys(TIPOS);

const lerpAng = (a, b, t) => {
    const d = ((((b - a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
    return a + d * t;
};
const suave = (k, dt) => 1 - Math.exp(-k * dt);

// ─── Sonidos propios (mismo AudioContext compartido que sonidosFeedback) ─────
const audioCtx = () => {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!window.gameAudioCtx) window.gameAudioCtx = new AC();
    if (window.gameAudioCtx.state === 'suspended') window.gameAudioCtx.resume();
    return window.gameAudioCtx;
};
const sfx = {
    rayo() {
        if (!sonidoActivo()) return;
        try {
            const ctx = audioCtx(); if (!ctx) return;
            const t = ctx.currentTime;
            const osc = ctx.createOscillator(); const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(110, t);
            osc.frequency.exponentialRampToValueAtTime(900, t + 1.1);
            gain.gain.setValueAtTime(0.0001, t);
            gain.gain.linearRampToValueAtTime(0.07, t + 0.1);
            gain.gain.linearRampToValueAtTime(0.0001, t + 1.2);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(t); osc.stop(t + 1.25);
        } catch { /* sin audio */ }
    },
    susto() {
        if (!sonidoActivo()) return;
        try {
            const ctx = audioCtx(); if (!ctx) return;
            const t = ctx.currentTime;
            const osc = ctx.createOscillator(); const mod = ctx.createOscillator();
            const modGain = ctx.createGain(); const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(520, t);
            osc.frequency.linearRampToValueAtTime(170, t + 0.35);
            mod.frequency.setValueAtTime(32, t);
            modGain.gain.setValueAtTime(40, t);
            gain.gain.setValueAtTime(0.12, t);
            gain.gain.linearRampToValueAtTime(0.0001, t + 0.35);
            mod.connect(modGain); modGain.connect(osc.frequency);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(t); mod.start(t); osc.stop(t + 0.36); mod.stop(t + 0.36);
        } catch { /* sin audio */ }
    },
    golpe() {
        if (!sonidoActivo()) return;
        try {
            const ctx = audioCtx(); if (!ctx) return;
            const t = ctx.currentTime;
            const osc = ctx.createOscillator(); const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(140, t);
            osc.frequency.exponentialRampToValueAtTime(45, t + 0.25);
            gain.gain.setValueAtTime(0.25, t);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(t); osc.stop(t + 0.32);
        } catch { /* sin audio */ }
    },
};

// ─── Texturas de canvas ──────────────────────────────────────────────────────
const rectRedondo = (ctx, x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
};

const texturaCartel = (texto) => {
    const c = document.createElement('canvas');
    const fuente = 'bold 60px system-ui, "Segoe UI", sans-serif';
    let ctx = c.getContext('2d');
    ctx.font = fuente;
    const w = Math.ceil(ctx.measureText(texto).width) + 60;
    c.width = w; c.height = 100;
    ctx = c.getContext('2d');
    rectRedondo(ctx, 4, 4, w - 8, 92, 22);
    ctx.fillStyle = '#fffbea'; ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = '#1e293b'; ctx.stroke();
    ctx.font = fuente; ctx.fillStyle = '#1e293b';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(texto, w / 2, 54);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return { tex, aspecto: w / 100 };
};

const texturaIcono = (simbolo, fondo) => {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.beginPath(); ctx.arc(64, 64, 56, 0, Math.PI * 2);
    ctx.fillStyle = fondo; ctx.fill();
    ctx.lineWidth = 8; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.font = 'bold 84px system-ui, sans-serif';
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(simbolo, 64, 70);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
};

const texturaPunto = () => {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
};

// ─── Fábrica de piezas low-poly ──────────────────────────────────────────────
const crearFabrica = () => {
    const geoCaja = new THREE.BoxGeometry(1, 1, 1);
    const geoIco = new THREE.IcosahedronGeometry(1, 0);
    const mats = new Map();
    const mat = (color, extra = {}) => {
        const clave = color + JSON.stringify(extra);
        if (!mats.has(clave)) mats.set(clave, new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...extra }));
        return mats.get(clave);
    };
    const pieza = (geo, padre, color, sx, sy, sz, x, y, z, extra) => {
        const m = new THREE.Mesh(geo, mat(color, extra));
        m.scale.set(sx, sy, sz); m.position.set(x, y, z);
        m.castShadow = true;
        padre.add(m);
        return m;
    };
    const caja = (...a) => pieza(geoCaja, ...a);
    const bola = (...a) => pieza(geoIco, ...a);
    // Pata con el pivote en la cadera: girar pivot.rotation.x = paso
    const pata = (padre, color, largo, grosor, x, yCadera, z, pezuña) => {
        const pivot = new THREE.Group();
        pivot.position.set(x, yCadera, z);
        caja(pivot, color, grosor, largo, grosor, 0, -largo / 2, 0);
        if (pezuña) caja(pivot, pezuña, grosor * 1.08, largo * 0.16, grosor * 1.08, 0, -largo + largo * 0.08, 0);
        padre.add(pivot);
        return pivot;
    };
    const dispose = () => { geoCaja.dispose(); geoIco.dispose(); mats.forEach(m => m.dispose()); };
    return { caja, bola, pata, mat, dispose };
};

// Cada animal mira hacia +Z en su espacio local.
const construirAnimal = (F, tipo) => {
    const root = new THREE.Group();
    const torso = new THREE.Group();
    const cabeza = new THREE.Group();
    root.add(torso);
    const rig = { root, torso, cabeza, patas: [], cola: null, alas: [], baseTorso: 0, bipedo: false };

    if (tipo === 'vaca') {
        const y = 0.75;
        rig.patas = [[-0.32, 0.55], [0.32, 0.55], [-0.32, -0.55], [0.32, -0.55]]
            .map(([x, z]) => F.pata(root, 0xf5f5f0, 0.75, 0.22, x, y, z, 0x3b2a20));
        torso.position.y = y; rig.baseTorso = y;
        F.caja(torso, 0xf5f5f0, 0.9, 0.7, 1.6, 0, 0.35, 0);
        F.caja(torso, 0x1f1f1f, 0.92, 0.32, 0.42, 0, 0.42, 0.2);
        F.caja(torso, 0x1f1f1f, 0.92, 0.36, 0.38, 0, 0.3, -0.45);
        F.caja(torso, 0xf4a6b8, 0.3, 0.16, 0.3, 0, -0.02, -0.3);
        cabeza.position.set(0, 0.75, 0.85); torso.add(cabeza);
        F.caja(cabeza, 0xf5f5f0, 0.5, 0.5, 0.55, 0, 0, 0.15);
        F.caja(cabeza, 0xf4a6b8, 0.52, 0.24, 0.2, 0, -0.13, 0.43);
        F.caja(cabeza, 0xe8dcc0, 0.08, 0.2, 0.08, 0.2, 0.32, 0.05);
        F.caja(cabeza, 0xe8dcc0, 0.08, 0.2, 0.08, -0.2, 0.32, 0.05);
        F.caja(cabeza, 0x1f1f1f, 0.18, 0.08, 0.12, 0.33, 0.12, 0.05);
        F.caja(cabeza, 0x1f1f1f, 0.18, 0.08, 0.12, -0.33, 0.12, 0.05);
        F.caja(cabeza, 0x111111, 0.07, 0.07, 0.04, 0.17, 0.08, 0.43);
        F.caja(cabeza, 0x111111, 0.07, 0.07, 0.04, -0.17, 0.08, 0.43);
        rig.cola = new THREE.Group(); rig.cola.position.set(0, 0.6, -0.8); torso.add(rig.cola);
        F.caja(rig.cola, 0x1f1f1f, 0.06, 0.6, 0.06, 0, -0.3, 0);
    } else if (tipo === 'oveja') {
        const y = 0.45;
        rig.patas = [[-0.24, 0.32], [0.24, 0.32], [-0.24, -0.32], [0.24, -0.32]]
            .map(([x, z]) => F.pata(root, 0x2b2b2b, 0.45, 0.14, x, y, z));
        torso.position.y = y; rig.baseTorso = y;
        [[0, 0.38, 0.22, 0.4], [0, 0.38, -0.22, 0.42], [0.2, 0.32, 0, 0.36], [-0.2, 0.32, 0, 0.36], [0, 0.56, 0, 0.36], [0, 0.42, -0.42, 0.3]]
            .forEach(([x, yy, z, r]) => F.bola(torso, 0xf3f0e6, r, r, r, x, yy, z));
        cabeza.position.set(0, 0.55, 0.55); torso.add(cabeza);
        F.caja(cabeza, 0x2b2b2b, 0.32, 0.36, 0.42, 0, 0, 0.12);
        F.bola(cabeza, 0xf3f0e6, 0.22, 0.16, 0.22, 0, 0.2, 0.02);
        F.caja(cabeza, 0x2b2b2b, 0.22, 0.08, 0.1, 0.24, 0.06, 0.02);
        F.caja(cabeza, 0x2b2b2b, 0.22, 0.08, 0.1, -0.24, 0.06, 0.02);
        F.caja(cabeza, 0xffffff, 0.07, 0.07, 0.03, 0.1, 0.06, 0.33);
        F.caja(cabeza, 0xffffff, 0.07, 0.07, 0.03, -0.1, 0.06, 0.33);
    } else if (tipo === 'cerdo') {
        const y = 0.36;
        rig.patas = [[-0.24, 0.38], [0.24, 0.38], [-0.24, -0.38], [0.24, -0.38]]
            .map(([x, z]) => F.pata(root, 0xf3a3b5, 0.36, 0.16, x, y, z, 0xc97b8e));
        torso.position.y = y; rig.baseTorso = y;
        F.caja(torso, 0xf3a3b5, 0.75, 0.62, 1.15, 0, 0.32, 0);
        cabeza.position.set(0, 0.42, 0.6); torso.add(cabeza);
        F.caja(cabeza, 0xf3a3b5, 0.52, 0.46, 0.4, 0, 0, 0.1);
        F.caja(cabeza, 0xe48aa0, 0.26, 0.2, 0.1, 0, -0.05, 0.34);
        F.caja(cabeza, 0x7a3044, 0.05, 0.06, 0.02, 0.06, -0.05, 0.4);
        F.caja(cabeza, 0x7a3044, 0.05, 0.06, 0.02, -0.06, -0.05, 0.4);
        F.caja(cabeza, 0xe48aa0, 0.14, 0.16, 0.06, 0.18, 0.28, 0.02);
        F.caja(cabeza, 0xe48aa0, 0.14, 0.16, 0.06, -0.18, 0.28, 0.02);
        F.caja(cabeza, 0x111111, 0.06, 0.06, 0.03, 0.13, 0.1, 0.31);
        F.caja(cabeza, 0x111111, 0.06, 0.06, 0.03, -0.13, 0.1, 0.31);
        rig.cola = new THREE.Group(); rig.cola.position.set(0, 0.5, -0.6); torso.add(rig.cola);
        F.caja(rig.cola, 0xe48aa0, 0.06, 0.06, 0.18, 0, 0, -0.06);
        F.caja(rig.cola, 0xe48aa0, 0.06, 0.14, 0.06, 0, 0.06, -0.14);
    } else if (tipo === 'caballo') {
        const y = 1.0;
        rig.patas = [[-0.24, 0.65], [0.24, 0.65], [-0.24, -0.65], [0.24, -0.65]]
            .map(([x, z]) => F.pata(root, 0x8b5a2b, 1.0, 0.18, x, y, z, 0x2b1d12));
        torso.position.y = y; rig.baseTorso = y;
        F.caja(torso, 0x8b5a2b, 0.7, 0.72, 1.75, 0, 0.36, 0);
        cabeza.position.set(0, 0.6, 0.8); torso.add(cabeza);
        const cuello = F.caja(cabeza, 0x8b5a2b, 0.32, 0.95, 0.42, 0, 0.35, 0.08); cuello.rotation.x = 0.5;
        const crin = F.caja(cabeza, 0x2b1d12, 0.12, 0.9, 0.14, 0, 0.42, -0.12); crin.rotation.x = 0.5;
        F.caja(cabeza, 0x8b5a2b, 0.32, 0.34, 0.72, 0, 0.78, 0.5);
        F.caja(cabeza, 0x5d3a1a, 0.33, 0.2, 0.2, 0, 0.72, 0.84);
        F.caja(cabeza, 0x8b5a2b, 0.08, 0.18, 0.08, 0.1, 1.0, 0.25);
        F.caja(cabeza, 0x8b5a2b, 0.08, 0.18, 0.08, -0.1, 1.0, 0.25);
        F.caja(cabeza, 0x111111, 0.05, 0.07, 0.07, 0.17, 0.86, 0.55);
        F.caja(cabeza, 0x111111, 0.05, 0.07, 0.07, -0.17, 0.86, 0.55);
        rig.cola = new THREE.Group(); rig.cola.position.set(0, 0.62, -0.88); torso.add(rig.cola);
        const colaC = F.caja(rig.cola, 0x2b1d12, 0.12, 0.8, 0.14, 0, -0.36, -0.08); colaC.rotation.x = -0.3;
    } else {
        // pollo
        const y = 0.3;
        rig.bipedo = true;
        rig.patas = [[-0.1, 0], [0.1, 0]].map(([x, z]) => F.pata(root, 0xf4b400, 0.3, 0.06, x, y, z));
        torso.position.y = y; rig.baseTorso = y;
        F.caja(torso, 0xfafafa, 0.42, 0.42, 0.52, 0, 0.24, 0);
        F.caja(torso, 0xfafafa, 0.24, 0.26, 0.12, 0, 0.4, -0.3);
        rig.alas = [1, -1].map(lado => {
            const p = new THREE.Group(); p.position.set(0.22 * lado, 0.38, 0); torso.add(p);
            F.caja(p, 0xececec, 0.06, 0.26, 0.36, 0.02 * lado, -0.12, 0);
            p.userData.lado = lado;
            return p;
        });
        cabeza.position.set(0, 0.5, 0.2); torso.add(cabeza);
        F.caja(cabeza, 0xfafafa, 0.26, 0.28, 0.26, 0, 0.1, 0.04);
        F.caja(cabeza, 0xf59e0b, 0.08, 0.07, 0.14, 0, 0.08, 0.22);
        F.caja(cabeza, 0xdc2626, 0.05, 0.13, 0.2, 0, 0.28, 0.04);
        F.caja(cabeza, 0xdc2626, 0.05, 0.1, 0.05, 0, -0.03, 0.16);
        F.caja(cabeza, 0x111111, 0.04, 0.05, 0.05, 0.13, 0.14, 0.1);
        F.caja(cabeza, 0x111111, 0.04, 0.05, 0.05, -0.13, 0.14, 0.1);
    }
    root.scale.setScalar(ESCALA_ANIMAL);
    return rig;
};

// ─── Ovni ────────────────────────────────────────────────────────────────────
const construirOvni = (F) => {
    const ovni = new THREE.Group();
    const inclin = new THREE.Group();
    const giro = new THREE.Group();
    ovni.add(inclin); inclin.add(giro);

    const perfil = [[0, -0.55], [1.1, -0.5], [2.4, -0.15], [3.0, 0], [2.6, 0.22], [1.6, 0.45], [0, 0.5]]
        .map(([x, y]) => new THREE.Vector2(x, y));
    const casco = new THREE.Mesh(new THREE.LatheGeometry(perfil, 28),
        new THREE.MeshStandardMaterial({ color: 0xb8c4d6, metalness: 0.45, roughness: 0.35, flatShading: true }));
    casco.castShadow = true;
    giro.add(casco);

    const anillo = new THREE.Mesh(new THREE.TorusGeometry(2.75, 0.09, 6, 40),
        new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5, roughness: 0.4 }));
    anillo.rotation.x = Math.PI / 2; anillo.position.y = 0.02;
    giro.add(anillo);

    const geoLuz = new THREE.SphereGeometry(0.15, 8, 6);
    const luces = [];
    for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const l = new THREE.Mesh(geoLuz, new THREE.MeshBasicMaterial({ color: 0x00ffcc }));
        l.position.set(Math.cos(a) * 2.78, 0.06, Math.sin(a) * 2.78);
        giro.add(l); luces.push(l);
    }

    const cupula = new THREE.Mesh(new THREE.SphereGeometry(1.3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.45, emissive: 0x0891b2, emissiveIntensity: 0.5, roughness: 0.1 }));
    cupula.position.y = 0.45;
    inclin.add(cupula);

    // tripulante
    const alien = new THREE.Group(); alien.position.y = 0.5; inclin.add(alien);
    F.bola(alien, 0x4ade80, 0.42, 0.5, 0.42, 0, 0.45, 0);
    F.bola(alien, 0x111111, 0.13, 0.18, 0.08, 0.15, 0.52, 0.34);
    F.bola(alien, 0x111111, 0.13, 0.18, 0.08, -0.15, 0.52, 0.34);
    F.caja(alien, 0x4ade80, 0.04, 0.3, 0.04, 0.16, 0.95, 0);
    F.caja(alien, 0x4ade80, 0.04, 0.3, 0.04, -0.16, 0.95, 0);
    F.bola(alien, 0xfacc15, 0.07, 0.07, 0.07, 0.16, 1.12, 0, { emissive: 0xfacc15, emissiveIntensity: 1 });
    F.bola(alien, 0xfacc15, 0.07, 0.07, 0.07, -0.16, 1.12, 0, { emissive: 0xfacc15, emissiveIntensity: 1 });

    const panza = new THREE.Mesh(new THREE.CircleGeometry(1.0, 24),
        new THREE.MeshBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 0.9 }));
    panza.rotation.x = Math.PI / 2; panza.position.y = -0.56;
    giro.add(panza);

    const foco = new THREE.SpotLight(0x67e8f9, 250, 32, 0.42, 0.6, 2);
    foco.position.set(0, -0.6, 0);
    const destinoFoco = new THREE.Object3D(); destinoFoco.position.set(0, -12, 0);
    ovni.add(foco); ovni.add(destinoFoco); foco.target = destinoFoco;

    return { ovni, inclin, giro, luces, panza, foco, alien };
};

// ─── Motor del juego ─────────────────────────────────────────────────────────
function crearMotor(contenedor, opciones, cb) {
    const { generarRonda, rondas: totalRondas, animo } = opciones;
    const animoCfg = ANIMO[animo] || ANIMO.normal;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    contenedor.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';

    const escena = new THREE.Scene();
    escena.fog = new THREE.Fog(0x2b1d50, 60, 175);
    const camara = new THREE.PerspectiveCamera(55, 1, 0.1, 800);

    const F = crearFabrica();
    const texturas = [];

    // Cielo con degradado + estrellas + luna (siguen a la cámara)
    const cielo = new THREE.Group(); escena.add(cielo);
    cielo.add(new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false,
        uniforms: { arriba: { value: new THREE.Color(0x070414) }, horizonte: { value: new THREE.Color(0x3d2669) } },
        vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'uniform vec3 arriba; uniform vec3 horizonte; varying vec3 vP; void main(){ float h = normalize(vP).y; gl_FragColor = vec4(mix(horizonte, arriba, smoothstep(-0.02, 0.55, h)), 1.0); }',
    })));
    const estrellasPos = [];
    for (let i = 0; i < 900; i++) {
        const th = Math.random() * Math.PI * 2; const ph = Math.acos(Math.random() * 0.92 + 0.05);
        estrellasPos.push(Math.sin(ph) * Math.cos(th) * 380, Math.cos(ph) * 380, Math.sin(ph) * Math.sin(th) * 380);
    }
    const geoEstrellas = new THREE.BufferGeometry();
    geoEstrellas.setAttribute('position', new THREE.Float32BufferAttribute(estrellasPos, 3));
    const texPunto = texturaPunto(); texturas.push(texPunto);
    const estrellas = new THREE.Points(geoEstrellas, new THREE.PointsMaterial({ size: 2.2, map: texPunto, transparent: true, depthWrite: false, fog: false, color: 0xe0e7ff, sizeAttenuation: false }));
    cielo.add(estrellas);
    const luna = new THREE.Mesh(new THREE.SphereGeometry(14, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfef9c3, fog: false }));
    luna.position.set(-140, 150, -300); cielo.add(luna);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texPunto, color: 0xfef3c7, transparent: true, opacity: 0.35, depthWrite: false, fog: false }));
    halo.scale.set(90, 90, 1); halo.position.copy(luna.position); cielo.add(halo);

    // Luces
    escena.add(new THREE.HemisphereLight(0x9fb3ff, 0x2d4a1e, 1.15));
    const lunaLuz = new THREE.DirectionalLight(0xdbe4ff, 1.7);
    lunaLuz.position.set(-30, 60, 25);
    lunaLuz.castShadow = true;
    lunaLuz.shadow.mapSize.set(2048, 2048);
    Object.assign(lunaLuz.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 160 });
    lunaLuz.shadow.bias = -0.0005;
    escena.add(lunaLuz);

    // Suelo: prado plano dentro de la valla y lomas fuera
    const geoSuelo = new THREE.PlaneGeometry(420, 420, 120, 120);
    geoSuelo.rotateX(-Math.PI / 2);
    const pos = geoSuelo.attributes.position;
    const colores = [];
    const cTmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        const fuera = Math.max(Math.abs(x), Math.abs(z)) - 64;
        let y = 0;
        if (fuera > 0) y = Math.min(fuera / 30, 1) * (Math.sin(x * 0.05) * 4 + Math.cos(z * 0.045) * 5 + Math.sin((x + z) * 0.11) * 1.5 + 4);
        pos.setY(i, y);
        const v = Math.random() * 0.06;
        cTmp.setHSL(0.27 + v * 0.3, 0.5, (fuera > 0 ? 0.2 : 0.27) + v);
        colores.push(cTmp.r, cTmp.g, cTmp.b);
    }
    geoSuelo.setAttribute('color', new THREE.Float32BufferAttribute(colores, 3));
    geoSuelo.computeVertexNormals();
    const suelo = new THREE.Mesh(geoSuelo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
    suelo.receiveShadow = true;
    escena.add(suelo);

    // Matas de hierba (instanciadas)
    const geoMata = new THREE.ConeGeometry(0.18, 0.6, 4);
    geoMata.translate(0, 0.3, 0);
    const matas = new THREE.InstancedMesh(geoMata, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), 900);
    const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const s = new THREE.Vector3(); const p = new THREE.Vector3();
    for (let i = 0; i < 900; i++) {
        p.set((Math.random() - 0.5) * 124, 0, (Math.random() - 0.5) * 124);
        q.setFromEuler(new THREE.Euler((Math.random() - 0.5) * 0.4, Math.random() * Math.PI, (Math.random() - 0.5) * 0.4));
        const k = 0.6 + Math.random() * 0.9; s.set(k, k * (0.7 + Math.random() * 0.8), k);
        m4.compose(p, q, s); matas.setMatrixAt(i, m4);
        cTmp.setHSL(0.24 + Math.random() * 0.08, 0.55, 0.25 + Math.random() * 0.12);
        matas.setColorAt(i, cTmp);
    }
    matas.instanceColor.needsUpdate = true;
    matas.receiveShadow = true;
    escena.add(matas);

    // Valla del prado
    const LV = 62;
    const postes = [];
    for (let t = -LV; t <= LV; t += 4) postes.push([t, -LV], [t, LV], [-LV, t], [LV, t]);
    const valla = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 1.6, 0.3), F.mat(0x8a6a48), postes.length);
    postes.forEach(([x, z], i) => { m4.makeTranslation(x, 0.8, z); valla.setMatrixAt(i, m4); });
    valla.castShadow = true;
    escena.add(valla);
    [[0, -LV, LV * 2, 0], [0, LV, LV * 2, 0], [-LV, 0, LV * 2, Math.PI / 2], [LV, 0, LV * 2, Math.PI / 2]].forEach(([x, z, largo, rot]) => {
        [0.6, 1.2].forEach(h => {
            const tabla = F.caja(escena, 0x9c7a55, largo, 0.14, 0.08, x, h, z);
            tabla.rotation.y = rot;
        });
    });

    // Granero, silo y casa al fondo
    const granero = new THREE.Group(); granero.position.set(-22, 0, -82); escena.add(granero);
    F.caja(granero, 0xb91c1c, 14, 8, 12, 0, 4, 0);
    const forma = new THREE.Shape(); forma.moveTo(-7.6, 0); forma.lineTo(0, 5); forma.lineTo(7.6, 0); forma.closePath();
    const tejado = new THREE.Mesh(new THREE.ExtrudeGeometry(forma, { depth: 12.8, bevelEnabled: false }), F.mat(0x5b1414));
    tejado.position.set(0, 8, -6.4); tejado.castShadow = true; granero.add(tejado);
    F.caja(granero, 0x7f1d1d, 5, 6, 0.3, 0, 3, 6.05);
    F.caja(granero, 0xfafafa, 5.4, 0.3, 0.35, 0, 6.1, 6.1);
    F.caja(granero, 0xfef08a, 2.4, 1.6, 0.2, 0, 9.8, 6.4, { emissive: 0xfde047, emissiveIntensity: 1.2 });
    const silo = new THREE.Group(); silo.position.set(-8, 0, -84); escena.add(silo);
    const cil = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 14, 16), F.mat(0x94a3b8)); cil.position.y = 7; cil.castShadow = true; silo.add(cil);
    const capa = new THREE.Mesh(new THREE.SphereGeometry(3.05, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), F.mat(0x64748b)); capa.position.y = 14; silo.add(capa);
    const casa = new THREE.Group(); casa.position.set(28, 0, -86); escena.add(casa);
    F.caja(casa, 0xe7d8c0, 10, 6, 8, 0, 3, 0);
    const formaC = new THREE.Shape(); formaC.moveTo(-5.6, 0); formaC.lineTo(0, 3.5); formaC.lineTo(5.6, 0); formaC.closePath();
    const tejC = new THREE.Mesh(new THREE.ExtrudeGeometry(formaC, { depth: 8.6, bevelEnabled: false }), F.mat(0x4b5563));
    tejC.position.set(0, 6, -4.3); casa.add(tejC);
    [[-2.8, 3.4], [2.8, 3.4]].forEach(([x, y]) => F.caja(casa, 0xfde68a, 1.6, 1.4, 0.2, x, y, 4.05, { emissive: 0xfbbf24, emissiveIntensity: 1.4 }));
    F.caja(casa, 0x6b4423, 1.6, 2.8, 0.2, 0, 1.4, 4.05);
    const farol = new THREE.PointLight(0xfbbf24, 60, 30, 2); farol.position.set(28, 4, -80); escena.add(farol);

    // Árboles alrededor
    const geoTronco = new THREE.CylinderGeometry(0.35, 0.5, 2.4, 6); geoTronco.translate(0, 1.2, 0);
    const geoCopa = new THREE.ConeGeometry(2.2, 4.5, 7); geoCopa.translate(0, 4.6, 0);
    const geoCopa2 = new THREE.ConeGeometry(1.6, 3.4, 7); geoCopa2.translate(0, 6.6, 0);
    for (let i = 0; i < 70; i++) {
        const a = Math.random() * Math.PI * 2; const r = 72 + Math.random() * 60;
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (z < -70 && Math.abs(x) < 40) continue; // deja ver la granja
        const arbol = new THREE.Group();
        const fuera = Math.max(Math.abs(x), Math.abs(z)) - 64;
        const yBase = Math.min(fuera / 30, 1) * (Math.sin(x * 0.05) * 4 + Math.cos(z * 0.045) * 5 + Math.sin((x + z) * 0.11) * 1.5 + 4);
        arbol.position.set(x, yBase - 0.2, z);
        const k = 0.8 + Math.random() * 0.7; arbol.scale.setScalar(k);
        const tronco = new THREE.Mesh(geoTronco, F.mat(0x5b3a1e)); tronco.castShadow = true; arbol.add(tronco);
        const verde = [0x1f4d2b, 0x245c32, 0x1b4426][i % 3];
        const c1 = new THREE.Mesh(geoCopa, F.mat(verde)); c1.castShadow = true; arbol.add(c1);
        const c2 = new THREE.Mesh(geoCopa2, F.mat(verde)); c2.castShadow = true; arbol.add(c2);
        escena.add(arbol);
    }
    // Pacas de paja y rocas junto a la valla
    const geoPaca = new THREE.CylinderGeometry(1, 1, 1.6, 12); geoPaca.rotateZ(Math.PI / 2);
    [[-58, 20], [-57, 23], [57, -30], [58, 10], [-30, 57], [35, 58]].forEach(([x, z]) => {
        const paca = new THREE.Mesh(geoPaca, F.mat(0xd4a84b)); paca.position.set(x, 1, z); paca.rotation.y = Math.random() * 3; paca.castShadow = true; escena.add(paca);
    });

    // Ovni
    const O = construirOvni(F);
    escena.add(O.ovni);
    const ovni = { x: 0, z: 30, vx: 0, vz: 0 };

    // Rayo tractor
    const uniformsRayo = { uTiempo: { value: 0 }, uColor: { value: new THREE.Color(0x00ffcc) }, uFuerza: { value: 0 } };
    const geoRayo = new THREE.CylinderGeometry(0.7, RADIO_RAYO * 0.85, 1, 32, 1, true);
    geoRayo.translate(0, 0.5, 0);
    const rayo = new THREE.Mesh(geoRayo, new THREE.ShaderMaterial({
        uniforms: uniformsRayo, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `uniform float uTiempo; uniform vec3 uColor; uniform float uFuerza; varying vec2 vUv;
            void main(){
                float bandas = 0.55 + 0.45 * sin(vUv.y * 26.0 + uTiempo * 9.0);
                float borde = 0.6 + 0.4 * sin(vUv.x * 6.2832 * 6.0 + uTiempo * 2.0);
                float a = (0.25 + 0.75 * vUv.y) * bandas * borde * uFuerza;
                gl_FragColor = vec4(uColor * 1.4, a * 0.55);
            }`,
    }));
    rayo.visible = false;
    escena.add(rayo);

    // Círculo del rayo en el suelo y marcador del objetivo
    const circulo = new THREE.Mesh(new THREE.RingGeometry(RADIO_RAYO - 0.25, RADIO_RAYO, 48).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.45, depthWrite: false }));
    circulo.position.y = 0.06; escena.add(circulo);
    const marca = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.85, 6, 1).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.9, depthWrite: false }));
    marca.position.y = 0.08; marca.visible = false; escena.add(marca);

    // Partículas (explosiones de color)
    const NP = 500;
    const pPos = new Float32Array(NP * 3).fill(-999);
    const pCol = new Float32Array(NP * 3);
    const pVel = new Float32Array(NP * 3);
    const pVida = new Float32Array(NP);
    const geoPart = new THREE.BufferGeometry();
    geoPart.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    geoPart.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
    const particulas = new THREE.Points(geoPart, new THREE.PointsMaterial({ size: 0.55, map: texPunto, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    particulas.frustumCulled = false;
    escena.add(particulas);
    let pSig = 0;
    const explosion = (x, y, z, color, n = 70, fuerza = 7) => {
        const c = new THREE.Color(color);
        for (let i = 0; i < n; i++) {
            const k = pSig; pSig = (pSig + 1) % NP;
            pPos[k * 3] = x; pPos[k * 3 + 1] = y; pPos[k * 3 + 2] = z;
            const th = Math.random() * Math.PI * 2; const ph = Math.acos(Math.random() * 2 - 1); const v = fuerza * (0.4 + Math.random() * 0.6);
            pVel[k * 3] = Math.sin(ph) * Math.cos(th) * v; pVel[k * 3 + 1] = Math.cos(ph) * v + 2; pVel[k * 3 + 2] = Math.sin(ph) * Math.sin(th) * v;
            pCol[k * 3] = c.r; pCol[k * 3 + 1] = c.g; pCol[k * 3 + 2] = c.b;
            pVida[k] = 0.8 + Math.random() * 0.6;
        }
    };

    const texAlerta = texturaIcono('!', '#ef4444');
    const texMareo = texturaIcono('?', '#f59e0b');
    texturas.push(texAlerta, texMareo);

    // ── Estado de la partida ──
    const estado = {
        ronda: 0, objetivo: null, animales: [], vidas: VIDAS,
        aciertos: 0, fallos: 0, fallosLista: [], aciertosLista: [],
        abduciendo: null, objetivoId: null, pausaHasta: 0, terminado: false,
        rayoRojoHasta: 0, temblor: 0, ultimoSusto: 0,
    };
    const quitarAnimal = (a) => {
        if (a.rig.root.parent) a.rig.root.parent.remove(a.rig.root);
        a.cartel.material.map.dispose();
        a.cartel.material.dispose();
        a.icono.material.dispose();
        a.fuera = true;
    };

    const crearAnimal = ({ texto: palabra, correcta, explicacion }, id, x, z) => {
        const tipo = NOMBRES_TIPOS[Math.floor(Math.random() * NOMBRES_TIPOS.length)];
        const rig = construirAnimal(F, tipo);
        const { tex, aspecto } = texturaCartel(palabra);
        const cartel = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
        const hCartel = 0.62;
        cartel.scale.set(aspecto * hCartel, hCartel, 1);
        cartel.position.y = TIPOS[tipo].alto / ESCALA_ANIMAL + 0.45;
        cartel.renderOrder = 10;
        rig.root.add(cartel);
        const icono = new THREE.Sprite(new THREE.SpriteMaterial({ map: texAlerta, depthWrite: false }));
        icono.scale.set(0.55, 0.55, 1);
        icono.position.y = cartel.position.y + 0.65;
        icono.visible = false; icono.renderOrder = 11;
        rig.root.add(icono);
        rig.root.position.set(x, 0, z);
        rig.root.rotation.y = Math.random() * Math.PI * 2;
        escena.add(rig.root);
        return {
            id, tipo, palabra, correcta, explicacion, rig, cartel, icono, hCartel, aspecto,
            x, y: 0, z, vx: 0, vz: 0, vy: 0,
            estado: 'PASEO', t: Math.random() * 2, fase: Math.random() * 6, amp: 0, aparicion: 0,
            fuera: false,
        };
    };

    const emitirHud = () => {
        const quedan = estado.animales.filter(a => !a.fuera && a.correcta).length;
        cb.onHud({
            ronda: estado.ronda + 1, totalRondas, objetivo: estado.objetivo, quedan,
            vidas: estado.vidas, aciertos: estado.aciertos, fallos: estado.fallos,
        });
    };

    const empezarRonda = (i) => {
        estado.animales.forEach(a => { if (!a.fuera) quitarAnimal(a); });
        estado.ronda = i;
        const { objetivo, items } = generarRonda(i);
        estado.objetivo = objetivo;
        const puestos = [];
        estado.animales = barajar(items).slice(0, ANIMALES_POR_RONDA).map((it, idx) => {
            let x = 0, z = 0;
            for (let intento = 0; intento < 40; intento++) {
                x = (Math.random() * 2 - 1) * (LIMITE - 6);
                z = (Math.random() * 2 - 1) * (LIMITE - 6);
                const lejosOvni = Math.hypot(x - ovni.x, z - ovni.z) > 12;
                if (lejosOvni && puestos.every(([px, pz]) => Math.hypot(px - x, pz - z) > 9)) break;
            }
            puestos.push([x, z]);
            const a = crearAnimal(it, `${i}-${idx}`, x, z);
            a.aparicion = -idx * 0.12; // aparecen escalonados
            return a;
        });
        estado.abduciendo = null;
        cb.onRonda({ ronda: i + 1, totalRondas, objetivo: estado.objetivo });
        emitirHud();
    };

    const terminar = (ganado) => {
        if (estado.terminado || destruido) return;
        estado.terminado = true;
        cb.onFin({
            ganado, aciertos: estado.aciertos, fallos: estado.fallos,
            fallosLista: estado.fallosLista, aciertosLista: estado.aciertosLista,
            rondasCompletadas: ganado ? totalRondas : estado.ronda, totalRondas,
        });
    };

    // ── Controles ──
    const teclas = new Set();
    const joy = { x: 0, y: 0, activo: false };
    const abducir = () => {
        if (estado.terminado || estado.abduciendo || estado.objetivoId == null) return;
        const a = estado.animales.find(an => an.id === estado.objetivoId);
        if (!a || a.fuera || a.estado === 'ABDUCCION' || a.estado === 'CAIDA') return;
        a.estado = 'ABDUCCION'; a.vy = 0.5; a.icono.visible = false;
        estado.abduciendo = a;
        sfx.rayo();
    };
    const alPulsar = (e) => {
        const k = e.key.toLowerCase();
        if (k === ' ' || k === 'enter') { e.preventDefault(); abducir(); return; }
        if (k.startsWith('arrow')) e.preventDefault();
        teclas.add(k);
    };
    const alSoltar = (e) => teclas.delete(e.key.toLowerCase());
    window.addEventListener('keydown', alPulsar);
    window.addEventListener('keyup', alSoltar);

    const entrada = () => {
        if (joy.activo) return { x: joy.x, z: joy.y };
        let x = 0, z = 0;
        if (teclas.has('arrowup') || teclas.has('w')) z -= 1;
        if (teclas.has('arrowdown') || teclas.has('s')) z += 1;
        if (teclas.has('arrowleft') || teclas.has('a')) x -= 1;
        if (teclas.has('arrowright') || teclas.has('d')) x += 1;
        const l = Math.hypot(x, z);
        return l > 1 ? { x: x / l, z: z / l } : { x, z };
    };

    // ── Tamaño ──
    const redimensionar = () => {
        const w = contenedor.clientWidth || 1, h = contenedor.clientHeight || 1;
        renderer.setSize(w, h);
        camara.aspect = w / h;
        // en vertical (móvil) alejamos un poco la cámara
        camara.fov = w / h < 1 ? 70 : 55;
        camara.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(redimensionar);
    ro.observe(contenedor);
    redimensionar();

    const mirar = new THREE.Vector3(0, 0, 20);
    camara.position.set(0, 21, 46);

    // ── Actualización de cada animal ──
    const actualizarAnimal = (a, dt, t) => {
        const tipoCfg = TIPOS[a.tipo];
        const dx = a.x - ovni.x, dz = a.z - ovni.z;
        const dist = Math.hypot(dx, dz);
        let salto = 0;

        if (a.aparicion < 1) {
            a.aparicion = Math.min(1, a.aparicion + dt * 2.2);
        }

        if (a.estado === 'PASEO') {
            a.t -= dt;
            if (a.t <= 0) {
                if (a.tipo === 'pollo') {
                    if (Math.random() > 0.4) { const ang = Math.random() * Math.PI * 2; a.vx = Math.sin(ang) * tipoCfg.paseo; a.vz = Math.cos(ang) * tipoCfg.paseo; a.t = 0.4 + Math.random() * 0.5; }
                    else { a.vx = 0; a.vz = 0; a.t = 0.5 + Math.random() * 0.8; }
                } else if (Math.random() > 0.35) {
                    const ang = Math.random() * Math.PI * 2; const v = tipoCfg.paseo * (0.6 + Math.random() * 0.6);
                    a.vx = Math.sin(ang) * v; a.vz = Math.cos(ang) * v; a.t = 1.5 + Math.random() * 3;
                } else { a.vx = 0; a.vz = 0; a.t = 1.5 + Math.random() * 2.5; }
            }
            if (animoCfg.alerta > 0 && dist < animoCfg.alerta && !estado.abduciendo && a.aparicion >= 1) {
                a.estado = 'ALERTA'; a.t = animoCfg.espera; a.vx = 0; a.vz = 0;
                a.icono.material.map = texAlerta; a.icono.visible = true;
            }
        } else if (a.estado === 'ALERTA') {
            a.t -= dt;
            salto = Math.abs(Math.sin(t * 14)) * 0.25;
            // gira para mirar a la nave
            a.rig.root.rotation.y = lerpAng(a.rig.root.rotation.y, Math.atan2(-dx, -dz), suave(10, dt));
            if (dist > animoCfg.alerta * 1.6) { a.estado = 'PASEO'; a.t = 0; a.icono.visible = false; }
            else if (a.t <= 0) {
                a.estado = 'HUIDA'; a.t = 2 + Math.random();
                const l = dist || 1;
                const ang = Math.atan2(dx / l, dz / l) + (Math.random() - 0.5) * 0.8;
                a.vx = Math.sin(ang) * tipoCfg.huida; a.vz = Math.cos(ang) * tipoCfg.huida;
                if (t - estado.ultimoSusto > 0.35) { sfx.susto(); estado.ultimoSusto = t; }
            }
        } else if (a.estado === 'HUIDA') {
            a.t -= dt;
            if (a.t < 0.6) { a.vx *= 1 - suave(3, dt); a.vz *= 1 - suave(3, dt); }
            if (a.t <= 0 || dist > animoCfg.alerta * 3) { a.estado = 'PASEO'; a.t = 0.5; a.icono.visible = false; }
        } else if (a.estado === 'ABDUCCION') {
            a.vy = Math.min(a.vy + dt * 5, 6);
            a.y += a.vy * dt;
            a.x += (ovni.x - a.x) * suave(4, dt);
            a.z += (ovni.z - a.z) * suave(4, dt);
            a.vx = 0; a.vz = 0;
            a.rig.root.rotation.y += dt * (2 + a.y);
            if (a.y >= ALTURA_OVNI - 1.4) resolverAbduccion(a);
        } else if (a.estado === 'CAIDA') {
            a.vy -= 25 * dt;
            a.y += a.vy * dt;
            a.rig.root.rotation.x += dt * 6;
            if (a.y <= 0) {
                a.y = 0;
                if (a.vy < -5) { a.vy = -a.vy * 0.35; sfx.golpe(); explosion(a.x, 0.3, a.z, 0xa3a3a3, 18, 3); }
                else {
                    a.vy = 0; a.vx = 0; a.vz = 0; a.rig.root.rotation.x = 0;
                    a.estado = 'MAREO'; a.t = 1.6;
                    a.icono.material.map = texMareo; a.icono.visible = true;
                }
            }
        } else if (a.estado === 'MAREO') {
            a.t -= dt;
            a.rig.root.rotation.z = Math.sin(t * 9) * 0.18;
            if (a.t <= 0) { a.estado = 'PASEO'; a.t = 0; a.rig.root.rotation.z = 0; a.icono.visible = false; }
        }

        a.x += a.vx * dt; a.z += a.vz * dt;
        if (a.estado !== 'ABDUCCION') {
            if (a.x < -LIMITE) { a.x = -LIMITE; a.vx = Math.abs(a.vx); }
            if (a.x > LIMITE) { a.x = LIMITE; a.vx = -Math.abs(a.vx); }
            if (a.z < -LIMITE) { a.z = -LIMITE; a.vz = Math.abs(a.vz); }
            if (a.z > LIMITE) { a.z = LIMITE; a.vz = -Math.abs(a.vz); }
        }

        // ── Animación del esqueleto ──
        const rig = a.rig;
        const vel = Math.hypot(a.vx, a.vz);
        const forcejeo = a.estado === 'ABDUCCION' || a.estado === 'CAIDA';
        const ampObjetivo = forcejeo ? 0.9 : Math.min(vel * (a.tipo === 'pollo' ? 0.35 : 0.2), 0.75);
        a.amp += (ampObjetivo - a.amp) * suave(8, dt);
        a.fase += dt * (forcejeo ? 18 : (2 + vel * (a.tipo === 'pollo' ? 5 : 2.6)));
        const sn = Math.sin(a.fase);
        if (rig.bipedo) {
            rig.patas[0].rotation.x = sn * a.amp; rig.patas[1].rotation.x = -sn * a.amp;
        } else {
            // paso cruzado: delantera izq. con trasera dcha.
            rig.patas[0].rotation.x = sn * a.amp; rig.patas[3].rotation.x = sn * a.amp;
            rig.patas[1].rotation.x = -sn * a.amp; rig.patas[2].rotation.x = -sn * a.amp;
        }
        rig.torso.position.y = rig.baseTorso + Math.abs(Math.cos(a.fase)) * a.amp * 0.07;
        rig.torso.rotation.z = Math.sin(a.fase) * a.amp * 0.05;
        // pastar cuando está parado
        const pastando = a.estado === 'PASEO' && vel < 0.05 && a.tipo !== 'pollo';
        const picoteo = a.estado === 'PASEO' && vel < 0.05 && a.tipo === 'pollo' ? Math.max(0, Math.sin(t * 7 + a.fase)) * 0.7 : 0;
        const cabezaObj = forcejeo ? Math.sin(t * 20) * 0.3 : pastando ? 0.75 + Math.sin(t * 2 + a.fase) * 0.08 : picoteo + Math.sin(a.fase * 2) * a.amp * 0.15;
        rig.cabeza.rotation.x += (cabezaObj - rig.cabeza.rotation.x) * suave(5, dt);
        if (rig.cola) rig.cola.rotation.z = Math.sin(t * 3 + a.fase) * 0.35;
        rig.alas.forEach(ala => {
            const aleteo = vel > 2 || forcejeo ? 0.4 + Math.sin(t * 32) * 0.6 : 0.05;
            ala.rotation.z = aleteo * ala.userData.lado * -1;
        });
        if (vel > 0.1 && a.estado !== 'ALERTA') {
            rig.root.rotation.y = lerpAng(rig.root.rotation.y, Math.atan2(a.vx, a.vz), suave(a.estado === 'HUIDA' ? 10 : 4, dt));
        }

        // aparición con rebote elástico
        let esc = ESCALA_ANIMAL;
        if (a.aparicion < 1) {
            const k = Math.max(0, a.aparicion);
            esc *= k === 0 ? 0.0001 : 1 + Math.sin(k * Math.PI * 2.5) * (1 - k) * 0.5 - (1 - k) * 0.6;
        }
        if (a.estado === 'ABDUCCION') esc *= THREE.MathUtils.clamp((ALTURA_OVNI - 1 - a.y) / 3, 0.25, 1);
        rig.root.scale.setScalar(Math.max(esc, 0.0001));
        rig.root.position.set(a.x, a.y + salto, a.z);

        // el cartel del objetivo se agranda
        const kc = estado.objetivoId === a.id ? 1.3 : 1;
        a.cartel.scale.set(a.aspecto * a.hCartel * kc, a.hCartel * kc, 1);
    };

    const resolverAbduccion = (a) => {
        estado.abduciendo = null;
        if (a.correcta) {
            estado.aciertos++;
            estado.aciertosLista.push({ palabra: a.palabra, categoria: estado.objetivo });
            explosion(ovni.x, ALTURA_OVNI - 1, ovni.z, 0x4ade80, 90, 8);
            explosion(ovni.x, ALTURA_OVNI - 1, ovni.z, 0xfde047, 40, 5);
            quitarAnimal(a);
            sonidoCorrecto();
            cb.onAviso({ tipo: 'ok', texto: `✅ «${a.palabra}» → ${estado.objetivo}` });
            emitirHud();
            const quedan = estado.animales.filter(an => !an.fuera && an.correcta).length;
            if (quedan === 0) {
                if (estado.ronda + 1 >= totalRondas) {
                    estado.pausaHasta = reloj.elapsedTime + 1.4;
                    setTimeout(() => terminar(true), 1400);
                } else {
                    cb.onAviso({ tipo: 'ronda', texto: '🌟 ¡Ronda completada!' });
                    const sig = estado.ronda + 1;
                    estado.pausaHasta = reloj.elapsedTime + 1.6;
                    setTimeout(() => { if (!estado.terminado && !destruido) empezarRonda(sig); }, 1600);
                }
            }
        } else {
            estado.fallos++;
            estado.vidas--;
            estado.fallosLista.push({ palabra: a.palabra, explicacion: a.explicacion, buscabas: estado.objetivo });
            a.estado = 'CAIDA'; a.vy = 2;
            const ang = Math.random() * Math.PI * 2;
            a.vx = Math.sin(ang) * 3.5; a.vz = Math.cos(ang) * 3.5;
            explosion(ovni.x, ALTURA_OVNI - 1, ovni.z, 0xef4444, 60, 6);
            estado.rayoRojoHasta = reloj.elapsedTime + 0.7;
            estado.temblor = 0.6;
            sonidoIncorrecto();
            cb.onAviso({ tipo: 'mal', texto: `❌ ${a.explicacion || `«${a.palabra}» no es de ${estado.objetivo}`}` });
            emitirHud();
            if (estado.vidas <= 0) {
                estado.pausaHasta = reloj.elapsedTime + 1.6;
                setTimeout(() => terminar(false), 1600);
            }
        }
    };

    // ── Bucle ──
    const reloj = new THREE.Clock();
    let raf = 0;
    let destruido = false;
    const colorRayoNormal = new THREE.Color(0x00ffcc);
    const colorRayoRojo = new THREE.Color(0xff3355);
    let objetivoVisible = false;

    const bucle = () => {
        if (destruido) return;
        raf = requestAnimationFrame(bucle);
        const dt = Math.min(reloj.getDelta(), 0.05);
        const t = reloj.elapsedTime;
        const enPausa = estado.terminado || t < estado.pausaHasta;

        // nave: aceleración suave, se bloquea mientras abduce
        const inp = estado.abduciendo || enPausa ? { x: 0, z: 0 } : entrada();
        const VMAX = 12;
        ovni.vx += (inp.x * VMAX - ovni.vx) * suave(inp.x ? 3.5 : 2.5, dt);
        ovni.vz += (inp.z * VMAX - ovni.vz) * suave(inp.z ? 3.5 : 2.5, dt);
        ovni.x = THREE.MathUtils.clamp(ovni.x + ovni.vx * dt, -LIMITE, LIMITE);
        ovni.z = THREE.MathUtils.clamp(ovni.z + ovni.vz * dt, -LIMITE, LIMITE);
        const flotar = Math.sin(t * 2) * 0.25;
        O.ovni.position.set(ovni.x, ALTURA_OVNI + flotar, ovni.z);
        O.inclin.rotation.z += (-ovni.vx * 0.035 - O.inclin.rotation.z) * suave(5, dt);
        O.inclin.rotation.x += (ovni.vz * 0.035 - O.inclin.rotation.x) * suave(5, dt);
        O.giro.rotation.y += dt * (1.2 + Math.hypot(ovni.vx, ovni.vz) * 0.15);
        O.alien.rotation.y = Math.sin(t * 0.8) * 0.6;
        O.luces.forEach((l, i) => {
            const k = (Math.sin(t * 6 - i * 0.9) + 1) / 2;
            l.material.color.setRGB(0.1 + k * 0.4, 0.6 + k * 0.4, 0.5 + k * 0.3);
        });

        // objetivo más cercano bajo la nave
        let mejor = null; let dMin = RADIO_RAYO;
        if (!estado.abduciendo && !enPausa) {
            estado.animales.forEach(a => {
                if (a.fuera || a.estado === 'CAIDA' || a.aparicion < 1) return;
                const d = Math.hypot(a.x - ovni.x, a.z - ovni.z);
                if (d < dMin) { dMin = d; mejor = a; }
            });
        }
        estado.objetivoId = mejor ? mejor.id : null;
        if (!!mejor !== objetivoVisible) { objetivoVisible = !!mejor; cb.onObjetivo(objetivoVisible); }

        estado.animales.forEach(a => { if (!a.fuera) actualizarAnimal(a, dt, t); });

        // rayo, foco y círculo
        const rojo = t < estado.rayoRojoHasta;
        uniformsRayo.uTiempo.value = t;
        uniformsRayo.uColor.value.copy(rojo ? colorRayoRojo : colorRayoNormal);
        const fuerzaObj = estado.abduciendo || rojo ? 1 : mejor ? 0.35 : 0;
        uniformsRayo.uFuerza.value += (fuerzaObj - uniformsRayo.uFuerza.value) * suave(8, dt);
        rayo.visible = uniformsRayo.uFuerza.value > 0.01;
        rayo.position.set(ovni.x, 0, ovni.z);
        rayo.scale.set(1, ALTURA_OVNI + flotar - 0.5, 1);
        O.foco.intensity = 250 + uniformsRayo.uFuerza.value * 500;
        O.foco.color.copy(rojo ? colorRayoRojo : colorRayoNormal);
        O.panza.material.color.copy(rojo ? colorRayoRojo : colorRayoNormal);
        circulo.position.x = ovni.x; circulo.position.z = ovni.z;
        circulo.material.color.set(mejor ? 0x4ade80 : 0x00f0ff);
        circulo.material.opacity = 0.3 + Math.sin(t * 4) * 0.12 + (mejor ? 0.3 : 0);
        marca.visible = !!mejor;
        if (mejor) {
            marca.position.x = mejor.x; marca.position.z = mejor.z;
            marca.rotation.y = t * 1.5;
            const k = 1 + Math.sin(t * 8) * 0.08; marca.scale.set(k, 1, k);
        }

        // partículas
        for (let i = 0; i < NP; i++) {
            if (pVida[i] <= 0) continue;
            pVida[i] -= dt;
            if (pVida[i] <= 0) { pPos[i * 3 + 1] = -999; continue; }
            pVel[i * 3 + 1] -= 9 * dt;
            pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
            const f = Math.min(1, pVida[i]);
            pCol[i * 3] *= 0.985 + f * 0.015; pCol[i * 3 + 1] *= 0.985 + f * 0.015; pCol[i * 3 + 2] *= 0.985 + f * 0.015;
        }
        geoPart.attributes.position.needsUpdate = true;
        geoPart.attributes.color.needsUpdate = true;

        // cámara que sigue a la nave con inercia
        const objCam = new THREE.Vector3(ovni.x * 0.85, 21, ovni.z + 16);
        camara.position.lerp(objCam, suave(2.5, dt));
        mirar.lerp(new THREE.Vector3(ovni.x, 0, ovni.z - 4), suave(4, dt));
        if (estado.temblor > 0) {
            estado.temblor = Math.max(0, estado.temblor - dt);
            const k = estado.temblor * 0.6;
            camara.position.x += (Math.random() - 0.5) * k; camara.position.y += (Math.random() - 0.5) * k;
        }
        camara.lookAt(mirar);
        cielo.position.copy(camara.position);

        renderer.render(escena, camara);
    };

    empezarRonda(0);
    raf = requestAnimationFrame(bucle);

    return {
        abducir,
        setJoy(x, y, activo) { joy.x = x; joy.y = y; joy.activo = activo; },
        destruir() {
            destruido = true;
            cancelAnimationFrame(raf);
            ro.disconnect();
            window.removeEventListener('keydown', alPulsar);
            window.removeEventListener('keyup', alSoltar);
            estado.animales.forEach(a => { if (!a.fuera) quitarAnimal(a); });
            escena.traverse(o => {
                if (o.geometry) o.geometry.dispose();
                if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
            });
            texturas.forEach(tx => tx.dispose());
            F.dispose();
            renderer.dispose();
            if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
        },
    };
}

// ─── UI ──────────────────────────────────────────────────────────────────────
const NEON = '#00f0ff';
const VERDE = '#4ade80';

const Joystick = ({ onMover }) => {
    const baseRef = useRef(null);
    const idRef = useRef(null);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const mover = (e) => {
        const r = baseRef.current.getBoundingClientRect();
        let dx = e.clientX - r.left - r.width / 2;
        let dy = e.clientY - r.top - r.height / 2;
        const max = r.width * 0.32;
        const d = Math.hypot(dx, dy);
        if (d > max) { dx = dx / d * max; dy = dy / d * max; }
        setPos({ x: dx, y: dy });
        onMover(dx / max, dy / max, true);
    };
    const soltar = (e) => {
        if (idRef.current !== e.pointerId) return;
        idRef.current = null;
        setPos({ x: 0, y: 0 });
        onMover(0, 0, false);
    };
    return (
        <div
            ref={baseRef}
            onPointerDown={(e) => { idRef.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); mover(e); }}
            onPointerMove={(e) => { if (idRef.current === e.pointerId) mover(e); }}
            onPointerUp={soltar} onPointerCancel={soltar}
            style={{ width: 'min(30vw, 150px)', aspectRatio: '1/1', borderRadius: '50%', background: 'rgba(10,15,40,0.55)', border: `2px solid ${NEON}88`, position: 'relative', touchAction: 'none', boxShadow: `0 0 18px ${NEON}44` }}
        >
            <div style={{ position: 'absolute', left: '50%', top: '50%', width: '40%', height: '40%', borderRadius: '50%', background: `${NEON}bb`, boxShadow: `0 0 15px ${NEON}`, transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`, transition: idRef.current === null ? 'transform 0.2s ease-out' : 'none' }} />
        </div>
    );
};

const JuegoOvni = ({ generarRonda, rondas, animo, onFin, onSalir }) => {
    const contRef = useRef(null);
    const motorRef = useRef(null);
    const [hud, setHud] = useState(null);
    const [aviso, setAviso] = useState(null);
    const [cartelRonda, setCartelRonda] = useState(null);
    const [hayObjetivo, setHayObjetivo] = useState(false);
    const [tactil] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches);
    const onFinRef = useRef(onFin);
    onFinRef.current = onFin;

    useEffect(() => {
        let tAviso = 0; let tRonda = 0;
        const motor = crearMotor(contRef.current, { generarRonda, rondas, animo }, {
            onHud: setHud,
            onObjetivo: setHayObjetivo,
            onAviso: (a) => { setAviso({ ...a, k: Date.now() }); clearTimeout(tAviso); tAviso = setTimeout(() => setAviso(null), 2200); },
            onRonda: (r) => { setCartelRonda(r); clearTimeout(tRonda); tRonda = setTimeout(() => setCartelRonda(null), 2200); },
            onFin: (res) => onFinRef.current(res),
        });
        motorRef.current = motor;
        return () => { clearTimeout(tAviso); clearTimeout(tRonda); motor.destruir(); motorRef.current = null; };
    }, [generarRonda, rondas, animo]);

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#070414', userSelect: 'none', touchAction: 'none', overflow: 'hidden', fontFamily: 'system-ui, "Segoe UI", sans-serif' }}>
            <style>{`@keyframes ovniEntra { from { opacity: 0; transform: translate(-50%, -20px) scale(0.9); } to { opacity: 1; transform: translate(-50%, 0) scale(1); } }
                @keyframes ovniRonda { 0% { opacity: 0; transform: translate(-50%,-50%) scale(0.7); } 15% { opacity: 1; transform: translate(-50%,-50%) scale(1.05); } 25% { transform: translate(-50%,-50%) scale(1); } 85% { opacity: 1; } 100% { opacity: 0; } }`}</style>
            <div ref={contRef} style={{ position: 'absolute', inset: 0 }} />

            {/* Barra superior */}
            <div style={{ position: 'absolute', top: 10, left: 10, right: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', pointerEvents: 'none' }}>
                <button onClick={onSalir} style={{ pointerEvents: 'auto', background: 'rgba(10,15,36,0.7)', color: '#fff', border: `1px solid ${NEON}66`, borderRadius: 10, padding: '8px 14px', cursor: 'pointer', fontWeight: 700 }}>✕ Salir</button>
                {hud && (
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'center', minWidth: 0 }}>
                        <div style={{ background: 'rgba(10,15,36,0.72)', border: `2px solid ${NEON}`, borderRadius: 16, padding: '8px 18px', boxShadow: `0 0 16px ${NEON}55`, color: '#fff', textAlign: 'center', maxWidth: '100%' }}>
                            <div style={{ fontSize: 'clamp(0.7rem, 1.6vw, 0.85rem)', color: '#a5b4fc', letterSpacing: 1 }}>RONDA {hud.ronda}/{hud.totalRondas} · 🛸 ABDUCE</div>
                            <div style={{ fontSize: 'clamp(1.2rem, 3.4vw, 2rem)', fontWeight: 900, color: NEON, textShadow: `0 0 12px ${NEON}`, lineHeight: 1.15, overflowWrap: 'anywhere' }}>{hud.objetivo.toUpperCase()}</div>
                            <div style={{ fontSize: 'clamp(0.75rem, 1.8vw, 0.95rem)', color: '#e2e8f0' }}>Quedan <b style={{ color: VERDE }}>{hud.quedan}</b></div>
                        </div>
                    </div>
                )}
                {hud && (
                    <div style={{ background: 'rgba(10,15,36,0.7)', borderRadius: 10, padding: '8px 12px', color: '#fff', fontWeight: 700, fontSize: '1rem', whiteSpace: 'nowrap' }}>
                        {'❤️'.repeat(Math.max(hud.vidas, 0))}{'🖤'.repeat(Math.max(VIDAS - hud.vidas, 0))}
                        <span style={{ marginLeft: 10, color: VERDE }}>✓ {hud.aciertos}</span>
                    </div>
                )}
            </div>

            {/* Aviso de acierto / fallo */}
            {aviso && aviso.tipo !== 'ronda' && (
                <div key={aviso.k} style={{ position: 'absolute', top: '24%', left: '50%', transform: 'translateX(-50%)', animation: 'ovniEntra 0.25s ease-out', background: aviso.tipo === 'ok' ? 'rgba(22,101,52,0.9)' : 'rgba(153,27,27,0.92)', color: '#fff', borderRadius: 14, padding: '10px 18px', fontWeight: 800, fontSize: 'clamp(0.95rem, 2.4vw, 1.3rem)', boxShadow: '0 6px 24px rgba(0,0,0,0.4)', maxWidth: '90vw', textAlign: 'center', pointerEvents: 'none' }}>
                    {aviso.texto}
                </div>
            )}

            {/* Cartel de inicio de ronda */}
            {(cartelRonda || aviso?.tipo === 'ronda') && (
                <div key={cartelRonda ? `r${cartelRonda.ronda}` : aviso.k} style={{ position: 'absolute', top: '50%', left: '50%', animation: 'ovniRonda 2.2s ease-out forwards', textAlign: 'center', pointerEvents: 'none', color: '#fff', textShadow: `0 0 18px ${NEON}, 0 2px 4px #000`, width: '90vw' }}>
                    {cartelRonda ? (
                        <>
                            <div style={{ fontSize: 'clamp(1rem, 3vw, 1.6rem)', fontWeight: 700, color: '#c7d2fe' }}>Ronda {cartelRonda.ronda} de {cartelRonda.totalRondas}</div>
                            <div style={{ fontSize: 'clamp(1.8rem, 6vw, 3.6rem)', fontWeight: 900 }}>Abduce: <span style={{ color: NEON }}>{cartelRonda.objetivo}</span></div>
                        </>
                    ) : (
                        <div style={{ fontSize: 'clamp(1.8rem, 6vw, 3.4rem)', fontWeight: 900 }}>{aviso.texto}</div>
                    )}
                </div>
            )}

            {/* Controles */}
            <div style={{ position: 'absolute', left: 16, right: 16, bottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', pointerEvents: 'none' }}>
                <div style={{ pointerEvents: 'auto' }}>
                    {tactil ? <Joystick onMover={(x, y, activo) => motorRef.current?.setJoy(x, y, activo)} /> : (
                        <div style={{ background: 'rgba(10,15,36,0.6)', color: '#cbd5e1', borderRadius: 10, padding: '8px 12px', fontSize: '0.85rem' }}>
                            <b style={{ color: NEON }}>WASD / flechas</b> mover · <b style={{ color: VERDE }}>Espacio</b> abducir
                        </div>
                    )}
                </div>
                <button
                    onPointerDown={(e) => { e.preventDefault(); motorRef.current?.abducir(); }}
                    style={{
                        pointerEvents: 'auto', width: 'min(26vw, 130px)', aspectRatio: '1/1', borderRadius: '50%',
                        border: `3px solid ${hayObjetivo ? VERDE : '#475569'}`,
                        background: hayObjetivo ? 'rgba(34,197,94,0.25)' : 'rgba(10,15,36,0.55)',
                        boxShadow: hayObjetivo ? `0 0 30px ${VERDE} inset, 0 0 22px ${VERDE}` : 'none',
                        color: '#fff', fontWeight: 900, fontSize: 'clamp(0.8rem, 2.4vw, 1rem)', cursor: 'pointer',
                        transform: hayObjetivo ? 'scale(1.06)' : 'scale(1)', transition: 'all 0.15s', touchAction: 'none',
                    }}
                >
                    <div style={{ fontSize: 'clamp(1.6rem, 6vw, 2.6rem)' }}>🛸</div>
                    ABDUCIR
                </button>
            </div>
        </div>
    );
};

const estiloBtn = (activo, color = NEON) => ({
    background: activo ? `${color}22` : 'rgba(255,255,255,0.04)', color: activo ? color : '#cbd5e1',
    border: `2px solid ${activo ? color : 'rgba(255,255,255,0.15)'}`, borderRadius: 12, padding: '10px 12px',
    cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', textAlign: 'left',
});

export default function OvniAbduccion({ onExit }) {
    const [pantalla, setPantalla] = useState('MENU');
    const [bancoId, setBancoId] = useState('gramatica');
    const [rondas, setRondas] = useState(5);
    const [animo, setAnimo] = useState('normal');
    const [textoCustom, setTextoCustom] = useState(() => { try { return localStorage.getItem(KEY_CUSTOM) || EJEMPLO_CUSTOM; } catch { return EJEMPLO_CUSTOM; } });
    const [partida, setPartida] = useState(null);
    const [resultado, setResultado] = useState(null);
    const [sonido, setSonido] = useState(sonidoActivo());

    const [tiposMates, setTiposMates] = useState(() => TIPOS_MATES.map(t => t.id));
    const [nivelMates, setNivelMates] = useState('primaria');

    const custom = bancoId === 'custom';
    const numeros = bancoId === 'numeros';
    const catsCustom = custom ? parsearCategorias(textoCustom) : null;
    const banco = BANCOS_OVNI.find(b => b.id === bancoId);
    const puedeEmpezar = custom ? !!catsCustom : numeros ? tiposMates.length > 0 : !!banco;

    const empezar = () => {
        if (!puedeEmpezar) return;
        let generarRonda; let titulo;
        if (numeros) {
            generarRonda = crearGeneradorMates(tiposMates, nivelMates);
            titulo = `Números (${nivelMates === 'eso' ? 'ESO' : 'Primaria'})`;
        } else {
            if (custom) { try { localStorage.setItem(KEY_CUSTOM, textoCustom); } catch { /* sin localStorage */ } }
            generarRonda = crearGeneradorPalabras(custom ? catsCustom : banco.categorias, rondas);
            titulo = custom ? 'Mis categorías' : banco.nombre;
        }
        setPartida({ generarRonda, rondas, animo, titulo, k: Date.now() });
        setPantalla('JUEGO');
    };
    const alternarTipo = (id) => setTiposMates(ts => (ts.includes(id) ? ts.filter(t => t !== id) : [...ts, id]));

    const alTerminar = (res) => {
        setResultado(res);
        setPantalla('FIN');
        if (res.ganado) sonidoFinal();
        guardarRegistroLocal('OVNI', {
            titulo: `Ovni · ${partida?.titulo || ''}`,
            aciertos: res.aciertos, intentos: res.aciertos + res.fallos, via: 'juego',
        });
    };

    if (pantalla === 'JUEGO' && partida) {
        return <JuegoOvni key={partida.k} generarRonda={partida.generarRonda} rondas={partida.rondas} animo={partida.animo} onFin={alTerminar} onSalir={() => setPantalla('MENU')} />;
    }

    const fondo = { position: 'fixed', inset: 0, zIndex: 9999, overflowY: 'auto', background: 'radial-gradient(ellipse at top, #2d1b4e 0%, #110c1c 60%, #070414 100%)', color: '#fff', fontFamily: 'system-ui, "Segoe UI", sans-serif' };

    if (pantalla === 'FIN' && resultado) {
        return (
            <div style={fondo}>
                <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 64 }}>{resultado.ganado ? '🛸✨' : '🛸💥'}</div>
                    <h1 style={{ color: resultado.ganado ? VERDE : '#f87171', textShadow: `0 0 18px ${resultado.ganado ? VERDE : '#f87171'}`, margin: '8px 0' }}>
                        {resultado.ganado ? '¡Misión completada!' : 'Nave averiada'}
                    </h1>
                    <p style={{ color: '#c7d2fe' }}>{partida?.titulo} · rondas {resultado.rondasCompletadas}/{resultado.totalRondas}</p>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', margin: '18px 0' }}>
                        <div style={{ background: 'rgba(74,222,128,0.12)', border: `2px solid ${VERDE}`, borderRadius: 14, padding: '12px 22px' }}><div style={{ fontSize: 30, fontWeight: 900, color: VERDE }}>{resultado.aciertos}</div>aciertos</div>
                        <div style={{ background: 'rgba(248,113,113,0.12)', border: '2px solid #f87171', borderRadius: 14, padding: '12px 22px' }}><div style={{ fontSize: 30, fontWeight: 900, color: '#f87171' }}>{resultado.fallos}</div>fallos</div>
                    </div>
                    {resultado.fallosLista.length > 0 && (
                        <div style={{ textAlign: 'left', background: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: '12px 16px', margin: '0 0 18px' }}>
                            <div style={{ fontWeight: 800, marginBottom: 8, color: '#fca5a5' }}>Para repasar</div>
                            {resultado.fallosLista.map((f, i) => (
                                <div key={i} style={{ padding: '4px 0', borderTop: i ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
                                    <b style={{ color: NEON }}>{f.palabra}</b> → {f.explicacion || 'no era de la categoría'} <span style={{ color: '#94a3b8' }}>(buscabas {f.buscabas})</span>
                                </div>
                            ))}
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button onClick={empezar} style={{ ...estiloBtn(true, VERDE), textAlign: 'center' }}>🔁 Jugar otra vez</button>
                        <button onClick={() => setPantalla('MENU')} style={{ ...estiloBtn(true), textAlign: 'center' }}>⚙️ Cambiar categorías</button>
                        <button onClick={onExit} style={{ ...estiloBtn(false), textAlign: 'center' }}>← Salir</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={fondo}>
            <div style={{ maxWidth: 820, margin: '0 auto', padding: '20px 16px 40px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button onClick={onExit} style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontWeight: 700 }}>← Volver</button>
                    <button onClick={() => setSonido(setSonidoActivo(!sonido))} style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>{sonido ? '🔊' : '🔇'}</button>
                </div>
                <div style={{ textAlign: 'center', margin: '14px 0 20px' }}>
                    <div style={{ fontSize: 56 }}>🛸</div>
                    <h1 style={{ margin: '4px 0', color: NEON, textShadow: `0 0 18px ${NEON}`, fontSize: 'clamp(1.8rem, 5vw, 2.6rem)' }}>Ovni Abducción</h1>
                    <p style={{ color: '#c7d2fe', margin: 0 }}>Cada animal lleva una palabra. Abduce solo los que pertenecen a la categoría que se pide.</p>
                </div>

                <h3 style={{ color: '#a5b4fc', fontSize: '0.9rem', letterSpacing: 1, textTransform: 'uppercase' }}>Categorías</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                    {BANCOS_OVNI.map(b => (
                        <button key={b.id} onClick={() => setBancoId(b.id)} style={estiloBtn(bancoId === b.id)}>
                            <span style={{ fontSize: '1.3rem', marginRight: 6 }}>{b.emoji}</span>{b.nombre}
                            <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#94a3b8', marginTop: 4 }}>{b.materia} · {Object.keys(b.categorias).join(', ')}</div>
                        </button>
                    ))}
                    <button onClick={() => setBancoId('numeros')} style={estiloBtn(numeros, '#facc15')}>
                        <span style={{ fontSize: '1.3rem', marginRight: 6 }}>🔢</span>Números
                        <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#94a3b8', marginTop: 4 }}>Matemáticas · primos, divisores, múltiplos, fracciones, potencias, mayor/menor</div>
                    </button>
                    <button onClick={() => setBancoId('custom')} style={estiloBtn(custom, VERDE)}>
                        <span style={{ fontSize: '1.3rem', marginRight: 6 }}>✏️</span>Mis categorías
                        <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#94a3b8', marginTop: 4 }}>Escribe las tuyas</div>
                    </button>
                </div>

                {custom && (
                    <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: 6 }}>Una categoría por línea: <code style={{ color: VERDE }}>Categoría: palabra, palabra, palabra</code> (mínimo 2 categorías con 2 palabras).</div>
                        <textarea value={textoCustom} onChange={e => setTextoCustom(e.target.value)} rows={6}
                            style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.35)', color: '#fff', border: `1px solid ${catsCustom ? VERDE : '#f87171'}`, borderRadius: 10, padding: 10, fontSize: '0.95rem', fontFamily: 'inherit' }} />
                        {!catsCustom && <div style={{ color: '#fca5a5', fontSize: '0.85rem' }}>Faltan categorías: necesitas al menos 2 con 2 palabras cada una.</div>}
                    </div>
                )}

                {numeros && (
                    <div style={{ marginTop: 12, background: 'rgba(250,204,21,0.06)', border: '1px solid rgba(250,204,21,0.3)', borderRadius: 12, padding: 12 }}>
                        <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: 8 }}>Cada ronda sale al azar de los tipos marcados, con números nuevos:</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
                            {TIPOS_MATES.map(t => (
                                <button key={t.id} onClick={() => alternarTipo(t.id)} style={{ ...estiloBtn(tiposMates.includes(t.id), '#facc15'), padding: '8px 10px' }}>
                                    {tiposMates.includes(t.id) ? '☑' : '☐'} <span style={{ display: 'inline-block', minWidth: 26, textAlign: 'center' }}>{t.emoji}</span> {t.nombre}
                                </button>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ color: '#a5b4fc', fontSize: '0.85rem', fontWeight: 700 }}>NIVEL</span>
                            {[['primaria', '🎒 Primaria'], ['eso', '🎓 ESO']].map(([id, txt]) =>
                                <button key={id} onClick={() => setNivelMates(id)} style={{ ...estiloBtn(nivelMates === id, '#facc15'), textAlign: 'center', padding: '6px 12px' }}>{txt}</button>)}
                            <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                                {nivelMates === 'eso' ? 'Números hasta 200, potencias hasta 2¹⁰ y 3⁶, decimales y negativos' : 'Números hasta 100, potencias hasta 2⁷ y 3⁵, enteros'}
                            </span>
                        </div>
                        {!tiposMates.length && <div style={{ color: '#fca5a5', fontSize: '0.85rem', marginTop: 6 }}>Marca al menos un tipo.</div>}
                    </div>
                )}

                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 18 }}>
                    <div>
                        <h3 style={{ color: '#a5b4fc', fontSize: '0.9rem', letterSpacing: 1, textTransform: 'uppercase' }}>Rondas</h3>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {[3, 5, 8].map(n => <button key={n} onClick={() => setRondas(n)} style={{ ...estiloBtn(rondas === n), textAlign: 'center', minWidth: 52 }}>{n}</button>)}
                        </div>
                    </div>
                    <div>
                        <h3 style={{ color: '#a5b4fc', fontSize: '0.9rem', letterSpacing: 1, textTransform: 'uppercase' }}>Animales</h3>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {[['tranquilos', '😌 Tranquilos'], ['normal', '🐄 Normales'], ['nerviosos', '😱 Asustadizos']].map(([id, txt]) =>
                                <button key={id} onClick={() => setAnimo(id)} style={{ ...estiloBtn(animo === id), textAlign: 'center' }}>{txt}</button>)}
                        </div>
                    </div>
                </div>

                <div style={{ textAlign: 'center', marginTop: 28 }}>
                    <button onClick={empezar} disabled={!puedeEmpezar}
                        style={{ background: 'transparent', color: NEON, border: `3px solid ${NEON}`, borderRadius: 14, padding: '14px 42px', fontSize: '1.3rem', fontWeight: 900, cursor: !puedeEmpezar ? 'not-allowed' : 'pointer', opacity: !puedeEmpezar ? 0.5 : 1, boxShadow: `0 0 20px ${NEON}66 inset, 0 0 20px ${NEON}66`, letterSpacing: 2 }}>
                        🚀 DESPEGAR
                    </button>
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: 14 }}>
                        Si abduces un animal equivocado la nave lo escupe y pierdes una vida ({VIDAS} en total).
                    </p>
                </div>
            </div>
        </div>
    );
}
