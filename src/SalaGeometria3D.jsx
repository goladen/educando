// SalaGeometria3D.jsx — Sala inmersiva de geometría 3D (WebXR / Oculus-Meta Quest)
// Herramienta de Geometrix: construir cuerpos geométricos en el espacio con los mandos,
// medirlos con una regla virtual y sincronizar la construcción con GeoGebra 3D.
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { crearDesarrollo } from './utils/desarrolloPlano';
import { crearExperimentoGrifo, ALTURA_MESA, X_CONO, X_CIL } from './utils/experimentoGrifo';
import { POLIEDROS, IDS_POLIEDROS, crearPoliedroEuler } from './utils/poliedrosEuler';

/* ═══════════════════ DEFINICIÓN DE SÓLIDOS ═══════════════════ */

const TIPOS = [
    { id: 'CUBO',      nombre: 'Cubo',      emoji: '🧊', color: 0x4fc3f7, poligonal: false, alturaLibre: false },
    { id: 'PRISMA',    nombre: 'Prisma',    emoji: '🟩', color: 0x66bb6a, poligonal: true,  alturaLibre: true  },
    { id: 'PIRAMIDE',  nombre: 'Pirámide',  emoji: '🔺', color: 0xffa726, poligonal: true,  alturaLibre: true  },
    { id: 'CILINDRO',  nombre: 'Cilindro',  emoji: '🥫', color: 0xab47bc, poligonal: false, alturaLibre: true  },
    { id: 'CONO',      nombre: 'Cono',      emoji: '🍦', color: 0xef5350, poligonal: false, alturaLibre: true  },
    { id: 'ESFERA',    nombre: 'Esfera',    emoji: '⚽', color: 0x42a5f5, poligonal: false, alturaLibre: false },
];
const TIPO = id => TIPOS.find(t => t.id === id) || TIPOS[0];
const LADOS = [3, 4, 5, 6, 8];
const NOMBRE_BASE = { 3: 'triangular', 4: 'cuadrangular', 5: 'pentagonal', 6: 'hexagonal', 8: 'octogonal' };

const R_MIN = 0.1, R_MAX = 2.0, H_MIN = 0.1, H_MAX = 3.0, PASO = 0.05;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const redondear = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

/** Métricas exactas del sólido. r = radio de la circunferencia circunscrita a la base. */
function metricas(s) {
    const { tipo, r, h, n } = s;
    const PI = Math.PI;
    if (tipo === 'ESFERA') {
        return { V: (4 / 3) * PI * r ** 3, AT: 4 * PI * r * r, formulas: ['V = (4/3)·π·r³', 'A = 4·π·r²'], datos: [['r', r]] };
    }
    if (tipo === 'CILINDRO') {
        const AB = PI * r * r, AL = 2 * PI * r * h;
        return { V: AB * h, AT: 2 * AB + AL, AL, AB, formulas: ['V = π·r²·h', 'A = 2·π·r² + 2·π·r·h'], datos: [['r', r], ['h', h]] };
    }
    if (tipo === 'CONO') {
        const g = Math.hypot(r, h), AB = PI * r * r, AL = PI * r * g;
        return { V: AB * h / 3, AT: AB + AL, AL, AB, g, formulas: ['V = (π·r²·h)/3', 'A = π·r² + π·r·g', `g = √(r²+h²) = ${redondear(g)} m`], datos: [['r', r], ['h', h], ['g', g]] };
    }
    if (tipo === 'CUBO') {
        const L = r * Math.SQRT2;
        return { V: L ** 3, AT: 6 * L * L, AL: 4 * L * L, AB: L * L, L, formulas: ['V = a³', 'A = 6·a²', `a = ${redondear(L)} m`], datos: [['a', L]] };
    }
    const L = 2 * r * Math.sin(PI / n);     // lado del polígono regular
    const P = n * L;                         // perímetro de la base
    const ap = r * Math.cos(PI / n);         // apotema de la base
    const AB = P * ap / 2;
    if (tipo === 'PRISMA') {
        const AL = P * h;
        return { V: AB * h, AT: 2 * AB + AL, AL, AB, L, ap, P,
            formulas: ['V = A_base · h', 'A = 2·A_base + P·h', `A_base = (P·ap)/2 = ${redondear(AB)} m²`],
            datos: [['lado', L], ['apotema', ap], ['h', h]] };
    }
    const apLat = Math.hypot(h, ap);         // apotema lateral (generatriz de la cara)
    const AL = P * apLat / 2;
    return { V: AB * h / 3, AT: AB + AL, AL, AB, L, ap, P, apLat,
        formulas: ['V = (A_base · h)/3', 'A = A_base + (P·ap_lat)/2', `ap_lat = √(h²+ap²) = ${redondear(apLat)} m`],
        datos: [['lado', L], ['apotema', ap], ['ap. lateral', apLat], ['h', h]] };
}

function nombreSolido(s) {
    const t = TIPO(s.tipo);
    if (t.poligonal) return `${t.nombre} ${NOMBRE_BASE[s.n] || `de ${s.n} lados`}`;
    return t.nombre;
}

/** Geometría con la base apoyada en y = 0. */
function crearGeometria(s) {
    const { tipo, r, h, n } = s;
    let g;
    switch (tipo) {
        case 'ESFERA':   g = new THREE.SphereGeometry(r, 40, 28); g.translate(0, r, 0); return g;
        case 'CILINDRO': g = new THREE.CylinderGeometry(r, r, h, 48); break;
        case 'CONO':     g = new THREE.ConeGeometry(r, h, 48); break;
        case 'CUBO': {
            const L = r * Math.SQRT2;
            g = new THREE.BoxGeometry(L, L, L); g.translate(0, L / 2, 0); return g;
        }
        case 'PRISMA':   g = new THREE.CylinderGeometry(r, r, h, n); break;
        case 'PIRAMIDE': g = new THREE.ConeGeometry(r, h, n); break;
        default:         g = new THREE.BoxGeometry(r, r, r); break;
    }
    g.translate(0, h / 2, 0);
    return g;
}

/** Vértice k de la base poligonal (coordenadas locales), igual que los genera three.js. */
function verticeBase(s, k) {
    const th = (2 * Math.PI * k) / s.n;
    return new THREE.Vector3(s.r * Math.sin(th), 0, s.r * Math.cos(th));
}

/* ═══════════════════ ETIQUETAS (sprites de texto) ═══════════════════ */

function pintarTexto(canvas, lineas, opts = {}) {
    const { fondo = 'rgba(20,28,38,0.86)', color = '#ffffff', tamano = 34, borde = '#00bfa5' } = opts;
    const ctx = canvas.getContext('2d');
    ctx.font = `bold ${tamano}px system-ui, sans-serif`;
    const anchos = lineas.map(l => ctx.measureText(l).width);
    const w = Math.ceil(Math.max(120, ...anchos) + 40);
    const hLinea = Math.round(tamano * 1.35);
    const h = hLinea * lineas.length + 26;
    canvas.width = w; canvas.height = h;
    const c = canvas.getContext('2d');
    c.font = `bold ${tamano}px system-ui, sans-serif`;
    c.fillStyle = fondo;
    c.strokeStyle = borde; c.lineWidth = 4;
    const rad = 16;
    c.beginPath();
    c.moveTo(rad, 2); c.lineTo(w - rad, 2); c.quadraticCurveTo(w - 2, 2, w - 2, rad);
    c.lineTo(w - 2, h - rad); c.quadraticCurveTo(w - 2, h - 2, w - rad, h - 2);
    c.lineTo(rad, h - 2); c.quadraticCurveTo(2, h - 2, 2, h - rad);
    c.lineTo(2, rad); c.quadraticCurveTo(2, 2, rad, 2); c.closePath();
    c.fill(); c.stroke();
    c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'middle';
    lineas.forEach((l, i) => c.fillText(l, w / 2, 16 + hLinea * i + hLinea / 2));
    return { w, h };
}

function crearEtiqueta(lineas, opts) {
    const canvas = document.createElement('canvas');
    const { w, h } = pintarTexto(canvas, lineas, opts);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    sp.renderOrder = 999;
    sp.scale.set(w * 0.0012, h * 0.0012, 1);
    sp.userData.canvas = canvas;
    return sp;
}

function actualizarEtiqueta(sprite, lineas, opts) {
    const { w, h } = pintarTexto(sprite.userData.canvas, lineas, opts);
    sprite.material.map.needsUpdate = true;
    sprite.scale.set(w * 0.0012, h * 0.0012, 1);
}

const fmtLong = d => (d < 1 ? `${redondear(d * 100, 1)} cm` : `${redondear(d, 3)} m`);

/* ═══════════════════ PANEL DE MANDO EN VR (textura de canvas) ═══════════════════ */

const PANEL_W = 900, PANEL_H = 620;

function botonesPanel(st) {
    const bs = [];
    const MODOS = [['CONSTRUIR', '🏗️'], ['REGLA', '📏'], ['MOVER', '✋'], ['GRIFO', '🚰'], ['POLIEDROS', '🔷']];
    MODOS.forEach(([m, l], i) =>
        bs.push({ id: 'modo:' + m, label: l, x: 20 + i * 171, y: 375, w: 164, h: 62, on: st.modo === m }));

    if (st.modo === 'POLIEDROS') {
        IDS_POLIEDROS.forEach((pid, i) => bs.push({
            id: 'poli:' + pid, label: POLIEDROS[pid].emoji, x: 20 + i * 171, y: 60, w: 164, h: 62,
            on: st.poliId === pid,
        }));
        bs.push({ id: 'policaras', label: st.poliCaras ? '👁️ Caras ON' : '👁️ Caras OFF', x: 20, y: 455, w: 283, h: 60 });
        bs.push({ id: 'poligirar', label: st.poliGirar ? '🌀 Girando' : '🌀 Girar', x: 313, y: 455, w: 283, h: 60 });
        bs.push({ id: 'polireset', label: '🔄 Reiniciar', x: 606, y: 455, w: 274, h: 60 });
        bs.push({ id: 'polimarcar', label: '✅ Marcar todo', x: 20, y: 530, w: 576, h: 60 });
        return bs;
    }

    TIPOS.forEach((t, i) => bs.push({
        id: 'tipo:' + t.id, label: `${t.emoji} ${t.nombre}`,
        x: 20 + (i % 3) * 293, y: 60 + Math.floor(i / 3) * 70, w: 283, h: 60,
        on: st.tipo === t.id, off: st.modo === 'GRIFO',
    }));
    const poli = TIPO(st.tipo).poligonal;
    LADOS.forEach((n, i) => bs.push({
        id: 'lados:' + n, label: `${n} lados`, x: 20 + i * 176, y: 215, w: 166, h: 55,
        on: st.n === n, off: !poli,
    }));
    bs.push({ id: 'r-', label: '−', x: 20,  y: 295, w: 70, h: 58 });
    bs.push({ id: 'r+', label: '+', x: 370, y: 295, w: 70, h: 58 });
    bs.push({ id: 'h-', label: '−', x: 460, y: 295, w: 70, h: 58, off: !TIPO(st.tipo).alturaLibre });
    bs.push({ id: 'h+', label: '+', x: 810, y: 295, w: 70, h: 58, off: !TIPO(st.tipo).alturaLibre });

    if (st.modo === 'GRIFO') {
        bs.push({ id: 'expforma', label: st.expPoligonal ? '🔺 Pirámide/Prisma' : '🍦 Cono/Cilindro', x: 20, y: 455, w: 425, h: 60 });
        bs.push({ id: 'expauto', label: st.expAuto ? '⏸️ Auto ON' : '▶️ Automático', x: 455, y: 455, w: 425, h: 60 });
        bs.push({ id: 'expaccion', label: st.expEtiqueta, x: 20, y: 530, w: 576, h: 60 });
        bs.push({ id: 'expreset', label: '🔄 Reiniciar', x: 606, y: 530, w: 274, h: 60 });
        return bs;
    }

    bs.push({ id: 'deshacer',   label: '↩️ Deshacer', x: 20,  y: 455, w: 206, h: 60 });
    bs.push({ id: 'limpiar',    label: '🗑️ Vaciar',   x: 233, y: 455, w: 206, h: 60 });
    bs.push({ id: 'etiquetas',  label: st.etiquetas ? '🏷️ Datos' : '🏷️ Sin datos', x: 446, y: 455, w: 206, h: 60 });
    bs.push({ id: 'desarrollo', label: st.desarrollo ? '📦 Plegar' : '📐 Desplegar', x: 659, y: 455, w: 206, h: 60, off: !st.seleccionado });
    bs.push({ id: 'ggb',     label: '📊 Enviar a GeoGebra', x: 20,  y: 530, w: 576, h: 60 });
    bs.push({ id: 'medidas', label: '🧹 Borrar medidas',    x: 606, y: 530, w: 274, h: 60 });
    return bs;
}

/** Texto del botón principal del experimento según la fase. */
function etiquetaAccionGrifo(fase) {
    switch (fase) {
        case 'VACIO':     return '🚰 Abrir el grifo';
        case 'LLENANDO':  return '⏹️ Cerrar el grifo';
        case 'LLENO':     return '🫗 Verter en el cilindro';
        case 'MOVIENDO':
        case 'VERTIENDO':
        case 'VOLVIENDO': return '⏳ Vertiendo…';
        case 'FIN':       return '🔄 Repetir el experimento';
        default:          return '🚰 Abrir el grifo';
    }
}

function dibujarPanel(ctx, st, botones, hover) {
    ctx.clearRect(0, 0, PANEL_W, PANEL_H);
    ctx.fillStyle = 'rgba(16,24,34,0.95)';
    ctx.fillRect(0, 0, PANEL_W, PANEL_H);
    ctx.strokeStyle = '#00bfa5'; ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, PANEL_W - 6, PANEL_H - 6);
    ctx.fillStyle = '#7fe6d8'; ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('📐 Sala de Geometría 3D', 20, 32);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#9fb3c8'; ctx.font = '24px system-ui, sans-serif';
    ctx.fillText(st.resumen, PANEL_W - 20, 32);

    botones.forEach(b => {
        const act = b.on, hov = hover === b.id && !b.off;
        ctx.fillStyle = b.off ? '#1c2836' : act ? '#00897b' : hov ? '#2f4457' : '#243447';
        ctx.strokeStyle = hov ? '#ffd54f' : act ? '#4db6ac' : '#37506a';
        ctx.lineWidth = hov ? 5 : 3;
        const rad = 12;
        ctx.beginPath();
        ctx.moveTo(b.x + rad, b.y); ctx.lineTo(b.x + b.w - rad, b.y);
        ctx.quadraticCurveTo(b.x + b.w, b.y, b.x + b.w, b.y + rad);
        ctx.lineTo(b.x + b.w, b.y + b.h - rad);
        ctx.quadraticCurveTo(b.x + b.w, b.y + b.h, b.x + b.w - rad, b.y + b.h);
        ctx.lineTo(b.x + rad, b.y + b.h);
        ctx.quadraticCurveTo(b.x, b.y + b.h, b.x, b.y + b.h - rad);
        ctx.lineTo(b.x, b.y + rad); ctx.quadraticCurveTo(b.x, b.y, b.x + rad, b.y);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = b.off ? '#5a6b7d' : '#ffffff';
        ctx.font = `bold ${b.h > 56 ? 26 : 23}px system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2);
    });

    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 26px system-ui, sans-serif'; ctx.textAlign = 'center';
    if (st.modo === 'POLIEDROS') {
        ctx.fillText(st.poliTexto || '', PANEL_W / 2, 200);
        ctx.font = 'bold 30px system-ui, sans-serif';
        ctx.fillStyle = st.poliCompleto ? '#8bf5c0' : '#ffd54f';
        ctx.fillText(st.poliCuenta || '', PANEL_W / 2, 300);
    } else {
        ctx.fillText(`radio ${redondear(st.r)} m`, 230, 324);
        ctx.fillText(TIPO(st.tipo).alturaLibre ? `altura ${redondear(st.h)} m` : '—', 670, 324);
    }
}

/* ═══════════════════ GEOGEBRA ═══════════════════ */

// three.js usa Y como vertical; GeoGebra 3D usa Z. (x, y, z)_three → (x, −z, y)_ggb
const aGGB = v => `(${redondear(v.x, 3)},${redondear(-v.z, 3)},${redondear(v.y, 3)})`;
const deGGB = (x, y, z) => new THREE.Vector3(x, z, -y);

function cargarGeoGebra() {
    return new Promise((res, rej) => {
        if (window.GGBApplet) return res();
        const existente = document.querySelector('script[data-ggb]');
        if (existente) { existente.addEventListener('load', () => res()); existente.addEventListener('error', () => rej(new Error('ggb'))); return; }
        const s = document.createElement('script');
        s.src = 'https://www.geogebra.org/apps/deployggb.js';
        s.async = true; s.dataset.ggb = '1';
        s.onload = () => res();
        s.onerror = () => rej(new Error('No se pudo cargar GeoGebra (¿sin conexión?)'));
        document.head.appendChild(s);
    });
}

/** Comandos GeoGebra que reproducen un sólido de la sala. */
function comandosDeSolido(s) {
    const base = new THREE.Vector3(s.pos.x, s.pos.y, s.pos.z);
    const rotar = v => v.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), s.rotY).add(base);
    switch (s.tipo) {
        case 'ESFERA':
            return [`Sphere(${aGGB(base.clone().setY(base.y + s.r))},${redondear(s.r, 3)})`];
        case 'CILINDRO':
            return [`Cylinder(${aGGB(base)},${aGGB(base.clone().setY(base.y + s.h))},${redondear(s.r, 3)})`];
        case 'CONO':
            return [`Cone(${aGGB(base)},${aGGB(base.clone().setY(base.y + s.h))},${redondear(s.r, 3)})`];
        case 'CUBO': {
            const L = s.r * Math.SQRT2, m = L / 2;
            const vs = [[-m, -m], [m, -m], [m, m], [-m, m]]
                .map(([a, b]) => rotar(new THREE.Vector3(a, 0, b)));
            return [`Prism(Polygon(${vs.map(aGGB).join(',')}),${redondear(L, 3)})`];
        }
        case 'PRISMA': {
            const vs = Array.from({ length: s.n }, (_, k) => rotar(verticeBase(s, k)));
            return [`Prism(Polygon(${vs.map(aGGB).join(',')}),${redondear(s.h, 3)})`];
        }
        case 'PIRAMIDE': {
            const vs = Array.from({ length: s.n }, (_, k) => rotar(verticeBase(s, k)));
            const cusp = base.clone().setY(base.y + s.h);
            return [`Pyramid(Polygon(${vs.map(aGGB).join(',')}),${aGGB(cusp)})`];
        }
        default: return [];
    }
}

/** Divide los argumentos de un comando respetando paréntesis anidados. */
function partirArgs(txt) {
    const out = []; let nivel = 0, act = '';
    for (const ch of txt) {
        if (ch === '(' || ch === '{') nivel++;
        if (ch === ')' || ch === '}') nivel--;
        if (ch === ',' && nivel === 0) { out.push(act.trim()); act = ''; }
        else act += ch;
    }
    if (act.trim()) out.push(act.trim());
    return out;
}

function partirComando(cmd) {
    const m = /^([A-Za-zÁÉÍÓÚÑáéíóúñ]+)\s*\((.*)\)\s*$/s.exec((cmd || '').trim());
    if (!m) return null;
    return { nombre: m[1], args: partirArgs(m[2]) };
}

/* ═══════════════════ COMPONENTE ═══════════════════ */

let contadorId = 0;
const nuevoId = () => `s${Date.now().toString(36)}_${contadorId++}`;

export default function SalaGeometria3D({ onExit }) {
    const contRef = useRef(null);
    const lienzoRef = useRef(null);
    const ggbDivRef = useRef(null);
    const ggbRef = useRef(null);

    const [modo, setModo] = useState('CONSTRUIR');       // CONSTRUIR | REGLA | MOVER | GRIFO
    const [tipo, setTipo] = useState('PRISMA');
    const [n, setN] = useState(6);
    const [r, setR] = useState(0.4);
    const [h, setH] = useState(0.8);
    const [solidos, setSolidos] = useState([]);
    const [medidas, setMedidas] = useState([]);
    const [seleccionado, setSeleccionado] = useState(null);
    const [etiquetas, setEtiquetas] = useState(true);
    const [transparente, setTransparente] = useState(true);
    const [vrDisponible, setVrDisponible] = useState(null);
    const [mostrarGGB, setMostrarGGB] = useState(false);
    const [ggbEstado, setGgbEstado] = useState('');
    const [aviso, setAviso] = useState('');
    const [ayuda, setAyuda] = useState(false);

    // experimento del grifo (¿cuántos conos caben en el cilindro?)
    const [expPoligonal, setExpPoligonal] = useState(false);
    const [expLados, setExpLados] = useState(6);
    const [expR, setExpR] = useState(0.3);
    const [expH, setExpH] = useState(0.6);
    const [expFase, setExpFase] = useState('VACIO');
    const [expVertidos, setExpVertidos] = useState(0);
    const [expAuto, setExpAuto] = useState(false);
    const [expLitros, setExpLitros] = useState({ cono: 0, cil: 0 });

    // desarrollo plano (red) del cuerpo seleccionado
    const [desarrolloId, setDesarrolloId] = useState(null);
    const [desT, setDesT] = useState(0);
    const [desPlay, setDesPlay] = useState(false);
    const [desInfo, setDesInfo] = useState(null);
    const [desPestanas, setDesPestanas] = useState(true);
    const [desVertical, setDesVertical] = useState(true);

    // poliedros de Euler: contar vértices, aristas y caras
    const [poliId, setPoliId] = useState('cubo');
    const [poliMarcas, setPoliMarcas] = useState(() => new Set());
    const [poliCaras, setPoliCaras] = useState(true);
    const [poliGirar, setPoliGirar] = useState(false);

    // refs de three
    const escenaRef = useRef(null);
    const camaraRef = useRef(null);
    const rendererRef = useRef(null);
    const jugadorRef = useRef(null);
    const controlesRef = useRef(null);
    const mallasRef = useRef(new Map());
    const medidasObjRef = useRef(new Map());
    const snapRef = useRef([]);
    const fantasmaRef = useRef(null);
    const sueloRef = useRef(null);
    const mandosRef = useRef([]);
    const panelRef = useRef(null);
    const puntoAref = useRef(null);
    const marcadorARef = useRef(null);
    const arrastreRef = useRef(null);
    const estRef = useRef({});
    const accionesRef = useRef({});
    const grupoExpRef = useRef(null);
    const grupoDesRef = useRef(null);
    const expRef = useRef(null);
    const desRef = useRef(null);
    const grupoPoliRef = useRef(null);
    const poliRef = useRef(null);

    const [esperandoB, setEsperandoB] = useState(false);

    /** Fija (o borra) el primer punto de una medición y muestra su marcador. */
    const fijarPuntoA = useCallback((p) => {
        puntoAref.current = p ? p.clone() : null;
        setEsperandoB(!!p);
        const mk = marcadorARef.current;
        if (mk) { mk.visible = !!p; if (p) mk.position.copy(p); }
    }, []);

    const avisar = useCallback((txt) => { setAviso(txt); window.clearTimeout(avisar._t); avisar._t = window.setTimeout(() => setAviso(''), 3500); }, []);

    // Espejo del estado para los manejadores del bucle de render
    estRef.current = { modo, tipo, n, r, h, etiquetas, solidos, medidas, seleccionado };

    /* ---------- acciones (usables desde DOM y desde los mandos) ---------- */

    const anadirSolido = useCallback((punto) => {
        const t = TIPO(estRef.current.tipo);
        const s = {
            id: nuevoId(),
            tipo: estRef.current.tipo,
            n: t.poligonal ? estRef.current.n : 48,
            r: estRef.current.r,
            h: t.alturaLibre ? estRef.current.h : estRef.current.r,
            pos: { x: redondear(punto.x, 3), y: redondear(Math.max(0, punto.y), 3), z: redondear(punto.z, 3) },
            rotY: 0,
            color: t.color,
        };
        setSolidos(prev => [...prev, s]);
        setSeleccionado(s.id);
        return s;
    }, []);

    const borrarSolido = useCallback((id) => {
        setSolidos(prev => prev.filter(s => s.id !== id));
        setSeleccionado(sel => (sel === id ? null : sel));
    }, []);

    const deshacer = useCallback(() => setSolidos(prev => prev.slice(0, -1)), []);
    const vaciar = useCallback(() => { setSolidos([]); setMedidas([]); setSeleccionado(null); fijarPuntoA(null); }, [fijarPuntoA]);

    const anadirMedida = useCallback((a, b) => {
        setMedidas(prev => [...prev, { id: nuevoId(), a: { ...a }, b: { ...b }, d: a.distanceTo ? a.distanceTo(b) : 0 }]);
    }, []);

    /* ---------- GeoGebra ---------- */

    const abrirGeoGebra = useCallback(async () => {
        setMostrarGGB(true);
        if (ggbRef.current) return;
        setGgbEstado('Cargando GeoGebra…');
        try {
            await cargarGeoGebra();
            const cont = ggbDivRef.current;
            if (!cont) return;
            const ancho = Math.max(320, cont.clientWidth || 420);
            const alto = Math.max(320, cont.clientHeight || 420);
            const app = new window.GGBApplet({
                appName: '3d', width: ancho, height: alto,
                showToolBar: true, showAlgebraInput: true, showMenuBar: false,
                showResetIcon: false, enableFileFeatures: false, enableLabelDrags: false,
                language: 'es', borderColor: '#009688',
                appletOnLoad: (api) => { ggbRef.current = api; setGgbEstado('GeoGebra listo'); },
            }, true);
            app.inject(cont);
        } catch (e) {
            setGgbEstado('❌ ' + (e.message || 'Error cargando GeoGebra'));
        }
    }, []);

    const exportarAGeoGebra = useCallback(async () => {
        if (!ggbRef.current) { await abrirGeoGebra(); avisar('Abriendo GeoGebra… vuelve a pulsar cuando esté listo'); return; }
        const api = ggbRef.current;
        let ok = 0, fallos = 0;
        estRef.current.solidos.forEach(s => {
            comandosDeSolido(s).forEach(c => { try { api.evalCommand(c) ? ok++ : fallos++; } catch { fallos++; } });
        });
        estRef.current.medidas.forEach(m => {
            const a = new THREE.Vector3(m.a.x, m.a.y, m.a.z), b = new THREE.Vector3(m.b.x, m.b.y, m.b.z);
            try { api.evalCommand(`Segment(${aGGB(a)},${aGGB(b)})`) ? ok++ : fallos++; } catch { fallos++; }
        });
        try { api.setPerspective('T'); } catch { /* vista 3D por defecto */ }
        setGgbEstado(`Enviados ${ok} objetos${fallos ? ` · ${fallos} con error` : ''}`);
        avisar(`📊 ${ok} objetos enviados a GeoGebra`);
    }, [abrirGeoGebra, avisar]);

    const importarDeGeoGebra = useCallback(() => {
        const api = ggbRef.current;
        if (!api) { avisar('Abre primero el panel de GeoGebra'); return; }
        const num = (tok) => {
            const v = Number(tok);
            if (Number.isFinite(v)) return v;
            try { const g = api.getValue(tok); return Number.isFinite(g) ? g : null; } catch { return null; }
        };
        const punto = (tok) => {
            const lit = /^\(\s*([-\d.eE+]+)\s*,\s*([-\d.eE+]+)\s*,\s*([-\d.eE+]+)\s*\)$/.exec(tok.trim());
            if (lit) return deGGB(+lit[1], +lit[2], +lit[3]);
            const lit2 = /^\(\s*([-\d.eE+]+)\s*,\s*([-\d.eE+]+)\s*\)$/.exec(tok.trim());
            if (lit2) return deGGB(+lit2[1], +lit2[2], 0);
            try {
                if (!api.exists(tok)) return null;
                return deGGB(api.getXcoord(tok), api.getYcoord(tok), api.getZcoord(tok));
            } catch { return null; }
        };
        const vertices = (tok) => {
            const c = partirComando(tok);
            if (c && /^(Pol[ií]gono|Polygon)$/i.test(c.nombre)) {
                const pts = c.args.map(punto).filter(Boolean);
                return pts.length >= 3 ? pts : null;
            }
            try {
                if (api.exists(tok)) {
                    const sub = partirComando(api.getCommandString(tok));
                    if (sub && /^(Pol[ií]gono|Polygon)$/i.test(sub.nombre)) {
                        const pts = sub.args.map(punto).filter(Boolean);
                        return pts.length >= 3 ? pts : null;
                    }
                }
            } catch { /* ignorar */ }
            return null;
        };
        // Polígono regular → centro, radio, nº de lados y giro
        const regular = (pts) => {
            const c = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(pts.length);
            const rad = pts.reduce((a, p) => a + p.distanceTo(c), 0) / pts.length;
            const v0 = pts[0].clone().sub(c);
            const rotY = Math.atan2(v0.x, v0.z);   // vértice 0 local está en (r·sin θ, 0, r·cos θ)
            return { centro: c, r: rad, n: pts.length, rotY };
        };

        let creados = 0, ignorados = 0;
        const nuevos = [];
        let nombres = [];
        try { nombres = api.getAllObjectNames() || []; } catch { nombres = []; }
        nombres.forEach(label => {
            let cmd = '';
            try { cmd = api.getCommandString(label) || ''; } catch { return; }
            const c = partirComando(cmd);
            if (!c) return;
            const nm = c.nombre.toLowerCase();
            const base = { id: nuevoId(), rotY: 0 };
            if (nm === 'sphere' || nm === 'esfera') {
                const p = punto(c.args[0]); const rad = num(c.args[1]);
                if (!p || !rad) { ignorados++; return; }
                nuevos.push({ ...base, tipo: 'ESFERA', n: 48, r: rad, h: rad,
                    pos: { x: p.x, y: p.y - rad, z: p.z }, color: TIPO('ESFERA').color });
                creados++;
            } else if (nm === 'cylinder' || nm === 'cilindro' || nm === 'cone' || nm === 'cono') {
                const a = punto(c.args[0]), b = punto(c.args[1]); const rad = num(c.args[2]);
                if (!a || !b || !rad) { ignorados++; return; }
                const altura = a.distanceTo(b);
                const abajo = a.y <= b.y ? a : b;
                const esCono = nm.startsWith('con');
                nuevos.push({ ...base, tipo: esCono ? 'CONO' : 'CILINDRO', n: 48, r: rad, h: altura,
                    pos: { x: abajo.x, y: abajo.y, z: abajo.z }, color: TIPO(esCono ? 'CONO' : 'CILINDRO').color });
                creados++;
            } else if (nm === 'prism' || nm === 'prisma') {
                const pts = vertices(c.args[0]); const altura = num(c.args[1]);
                if (!pts || !altura) { ignorados++; return; }
                const g = regular(pts);
                nuevos.push({ ...base, tipo: 'PRISMA', n: g.n, r: g.r, h: Math.abs(altura), rotY: g.rotY,
                    pos: { x: g.centro.x, y: g.centro.y, z: g.centro.z }, color: TIPO('PRISMA').color });
                creados++;
            } else if (nm === 'pyramid' || nm === 'pirámide' || nm === 'piramide') {
                const pts = vertices(c.args[0]); const cusp = punto(c.args[1]);
                if (!pts || !cusp) { ignorados++; return; }
                const g = regular(pts);
                nuevos.push({ ...base, tipo: 'PIRAMIDE', n: g.n, r: g.r, h: Math.abs(cusp.y - g.centro.y), rotY: g.rotY,
                    pos: { x: g.centro.x, y: g.centro.y, z: g.centro.z }, color: TIPO('PIRAMIDE').color });
                creados++;
            }
        });
        if (!creados) { avisar(`No se encontraron cuerpos importables${ignorados ? ` (${ignorados} no soportados)` : ''}`); return; }
        setSolidos(prev => [...prev, ...nuevos]);
        avisar(`⬇️ ${creados} cuerpos importados de GeoGebra${ignorados ? ` · ${ignorados} ignorados` : ''}`);
    }, [avisar]);

    /* ---------- construcción de la escena ---------- */

    useEffect(() => {
        const cont = lienzoRef.current;
        if (!cont) return;

        const escena = new THREE.Scene();
        escena.background = new THREE.Color(0x0e1b26);
        escena.fog = new THREE.Fog(0x0e1b26, 18, 42);
        escenaRef.current = escena;

        const camara = new THREE.PerspectiveCamera(65, cont.clientWidth / cont.clientHeight, 0.05, 150);
        camara.position.set(0, 1.6, 3.2);
        camaraRef.current = camara;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(cont.clientWidth, cont.clientHeight);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.localClippingEnabled = true;     // lo usa el agua del experimento del grifo
        renderer.xr.enabled = true;
        cont.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // rig del jugador (cámara + mandos) para poder desplazarse en VR
        const jugador = new THREE.Group();
        jugador.add(camara);
        escena.add(jugador);
        jugadorRef.current = jugador;

        // luces
        escena.add(new THREE.HemisphereLight(0xbfd8ff, 0x20303a, 1.1));
        const sol = new THREE.DirectionalLight(0xffffff, 1.5);
        sol.position.set(4, 8, 5);
        escena.add(sol);

        // suelo + rejilla métrica (1 casilla = 1 m, subdivisión 10 cm)
        const suelo = new THREE.Mesh(
            new THREE.PlaneGeometry(40, 40),
            new THREE.MeshStandardMaterial({ color: 0x16283a, roughness: 0.95, metalness: 0 })
        );
        suelo.rotation.x = -Math.PI / 2;
        suelo.name = 'suelo';
        escena.add(suelo);
        sueloRef.current = suelo;

        const rejillaFina = new THREE.GridHelper(20, 200, 0x1d3a52, 0x1d3a52);
        rejillaFina.position.y = 0.002;
        rejillaFina.material.opacity = 0.5; rejillaFina.material.transparent = true;
        escena.add(rejillaFina);
        const rejilla = new THREE.GridHelper(20, 20, 0x00bfa5, 0x2e5d78);
        rejilla.position.y = 0.004;
        escena.add(rejilla);

        // ejes de referencia
        const ejes = new THREE.AxesHelper(1);
        ejes.position.y = 0.006;
        escena.add(ejes);

        // fantasma de previsualización
        const fantasma = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 0.1, 0.1),
            new THREE.MeshStandardMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.35, depthWrite: false })
        );
        fantasma.visible = false;
        escena.add(fantasma);
        fantasmaRef.current = fantasma;

        // contenedores del experimento del grifo y del desarrollo plano
        const grupoExp = new THREE.Group();
        grupoExp.visible = false;
        escena.add(grupoExp);
        grupoExpRef.current = grupoExp;

        const grupoDes = new THREE.Group();
        grupoDes.visible = false;
        escena.add(grupoDes);
        grupoDesRef.current = grupoDes;

        const grupoPoli = new THREE.Group();
        grupoPoli.visible = false;
        escena.add(grupoPoli);
        grupoPoliRef.current = grupoPoli;

        // marcador del primer punto de una medición
        const marcadorA = new THREE.Mesh(
            new THREE.SphereGeometry(0.025, 14, 12),
            new THREE.MeshBasicMaterial({ color: 0xffd54f, depthTest: false })
        );
        marcadorA.renderOrder = 997;
        marcadorA.visible = false;
        escena.add(marcadorA);
        marcadorARef.current = marcadorA;

        // controles de escritorio
        const controles = new OrbitControls(camara, renderer.domElement);
        controles.target.set(0, 0.8, 0);
        controles.enableDamping = true;
        controles.maxPolarAngle = Math.PI / 2 - 0.02;
        controles.update();
        controlesRef.current = controles;

        /* ---- mandos VR ---- */
        const geoRayo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
        const mandos = [];
        for (let i = 0; i < 2; i++) {
            const c = renderer.xr.getController(i);
            const rayo = new THREE.Line(geoRayo, new THREE.LineBasicMaterial({ color: 0x00e5ff }));
            rayo.scale.z = 5;
            c.add(rayo);
            const punta = new THREE.Mesh(
                new THREE.SphereGeometry(0.012, 12, 10),
                new THREE.MeshBasicMaterial({ color: 0xffd54f })
            );
            punta.position.z = -0.3;
            c.add(punta);
            jugador.add(c);

            const grip = renderer.xr.getControllerGrip(i);
            const cuerpo = new THREE.Mesh(
                new THREE.CapsuleGeometry(0.022, 0.07, 6, 12),
                new THREE.MeshStandardMaterial({ color: 0x2b3b4d, roughness: 0.6 })
            );
            cuerpo.rotation.x = Math.PI / 2.4;
            grip.add(cuerpo);
            jugador.add(grip);

            const info = { ctrl: c, grip, rayo, punta, mano: null, gamepad: null, apretando: false, giroListo: true };
            c.addEventListener('connected', (ev) => {
                info.mano = ev.data.handedness;
                info.gamepad = ev.data.gamepad || null;
                colocarPanel();
            });
            c.addEventListener('disconnected', () => { info.mano = null; info.gamepad = null; });
            c.addEventListener('selectstart', () => accionesRef.current.gatillo?.(info, true));
            c.addEventListener('selectend',   () => accionesRef.current.gatillo?.(info, false));
            c.addEventListener('squeezestart', () => { info.apretando = true; accionesRef.current.agarre?.(info, true); });
            c.addEventListener('squeezeend',   () => { info.apretando = false; accionesRef.current.agarre?.(info, false); });
            mandos.push(info);
        }
        mandosRef.current = mandos;

        // panel flotante de mando
        const lienzoPanel = document.createElement('canvas');
        lienzoPanel.width = PANEL_W; lienzoPanel.height = PANEL_H;
        const texPanel = new THREE.CanvasTexture(lienzoPanel);
        texPanel.colorSpace = THREE.SRGBColorSpace;
        const panel = new THREE.Mesh(
            new THREE.PlaneGeometry(0.46, 0.46 * PANEL_H / PANEL_W),
            new THREE.MeshBasicMaterial({ map: texPanel, transparent: true })
        );
        panel.visible = false;
        panel.userData = { canvas: lienzoPanel, tex: texPanel, botones: [], hover: null };
        panelRef.current = panel;

        function colocarPanel() {
            const izq = mandos.find(m => m.mano === 'left') || mandos[0];
            if (!izq) return;
            if (panel.parent) panel.parent.remove(panel);
            izq.grip.add(panel);
            panel.position.set(0.02, 0.10, -0.10);
            panel.rotation.set(-Math.PI / 3.1, 0, 0);
            panel.visible = true;
        }

        /* ---- bucle ---- */
        const raycaster = new THREE.Raycaster();
        const reloj = new THREE.Clock();
        const UP = new THREE.Vector3(0, 1, 0);

        const objetivosSolidos = () => [...mallasRef.current.values(), ...(poliRef.current?.piezas || [])];

        function rayoDeMando(m) {
            const mat = new THREE.Matrix4().identity().extractRotation(m.ctrl.matrixWorld);
            const origen = new THREE.Vector3().setFromMatrixPosition(m.ctrl.matrixWorld);
            const dir = new THREE.Vector3(0, 0, -1).applyMatrix4(mat).normalize();
            raycaster.set(origen, dir);
            return raycaster;
        }
        accionesRef.current.rayoDeMando = rayoDeMando;

        function moverJugador(dt) {
            const izq = mandos.find(m => m.mano === 'left');
            const der = mandos.find(m => m.mano === 'right');
            if (izq?.gamepad?.axes?.length >= 4) {
                const ax = izq.gamepad.axes[2] || 0, ay = izq.gamepad.axes[3] || 0;
                if (Math.abs(ax) > 0.15 || Math.abs(ay) > 0.15) {
                    const dirFrente = new THREE.Vector3();
                    camara.getWorldDirection(dirFrente);
                    dirFrente.y = 0; dirFrente.normalize();
                    const dirLado = new THREE.Vector3().crossVectors(dirFrente, UP).normalize();
                    const vel = 1.8 * dt;
                    jugador.position.addScaledVector(dirFrente, -ay * vel);
                    jugador.position.addScaledVector(dirLado, ax * vel);
                }
            }
            if (der?.gamepad?.axes?.length >= 4) {
                const gx = der.gamepad.axes[2] || 0;
                if (Math.abs(gx) > 0.7 && der.giroListo) {
                    der.giroListo = false;
                    const ang = -Math.sign(gx) * Math.PI / 6;
                    const cam = new THREE.Vector3();
                    camara.getWorldPosition(cam);
                    jugador.position.sub(cam).applyAxisAngle(UP, ang).add(cam);
                    jugador.rotation.y += ang;
                } else if (Math.abs(gx) < 0.3) der.giroListo = true;
                // stick vertical del mando derecho: ajusta el tamaño del cuerpo seleccionado
                const gy = der.gamepad.axes[3] || 0;
                if (Math.abs(gy) > 0.5) accionesRef.current.escalar?.(-gy * dt * 0.9);
            }
        }

        function actualizarPunteros() {
            const st = estRef.current;
            if (st.modo !== 'CONSTRUIR') fantasma.visible = false;
            mandos.forEach(m => {
                if (!m.mano) return;
                const rc = rayoDeMando(m);
                let dist = 5, color = 0x00e5ff;
                // panel (solo lo apunta el mando que NO lo lleva)
                if (panel.visible && panel.parent !== m.grip) {
                    const hitPanel = rc.intersectObject(panel, false)[0];
                    if (hitPanel && hitPanel.uv) {
                        const u = hitPanel.uv.x * PANEL_W, v = (1 - hitPanel.uv.y) * PANEL_H;
                        const b = panel.userData.botones.find(bt => !bt.off && u >= bt.x && u <= bt.x + bt.w && v >= bt.y && v <= bt.y + bt.h);
                        const nuevoHover = b ? b.id : null;
                        if (nuevoHover !== panel.userData.hover) {
                            panel.userData.hover = nuevoHover;
                            accionesRef.current.repintarPanel?.();
                        }
                        m.sobrePanel = b || null;
                        dist = hitPanel.distance; color = 0xffd54f;
                        m.rayo.scale.z = dist; m.rayo.material.color.setHex(color);
                        m.punta.position.z = -dist;
                        fantasma.visible = false;
                        return;
                    }
                    if (panel.userData.hover) { panel.userData.hover = null; accionesRef.current.repintarPanel?.(); }
                }
                m.sobrePanel = null;
                const hit = rc.intersectObjects([suelo, ...objetivosSolidos()], false)[0];
                if (hit) { dist = hit.distance; color = st.modo === 'REGLA' ? 0xffd54f : 0x00e5ff; }
                m.ultimoHit = hit || null;
                m.rayo.scale.z = Math.min(dist, 12);
                m.rayo.material.color.setHex(color);
                m.punta.position.z = -Math.min(dist, 12);
                // fantasma de construcción
                if (st.modo === 'CONSTRUIR' && hit && hit.object === suelo && m.mano === 'right') {
                    fantasma.position.copy(hit.point);
                    fantasma.visible = true;
                }
            });
        }

        /* ---- experimento del grifo: máquina de estados por fotograma ---- */
        const posCono = new THREE.Vector3();
        function tickExperimento(dt) {
            const E = expRef.current;
            if (!E?.api) return;
            const med = E.api.medidas;
            const VC = med.vConoTotal;
            let cambio = false;

            switch (E.fase) {
                case 'LLENANDO':
                    E.vCono = Math.min(VC, E.vCono + (VC / 2.6) * dt);
                    if (E.vCono >= VC - 1e-9) { E.vCono = VC; E.fase = 'LLENO'; E.espera = 0.5; cambio = true; }
                    break;
                case 'LLENO':
                    if (E.auto) { E.espera -= dt; if (E.espera <= 0) { E.fase = 'MOVIENDO'; cambio = true; } }
                    break;
                case 'MOVIENDO':
                    if (E.tMov === 0) E.lleno = E.vCono >= VC - 1e-6;   // ¿se vierte el recipiente lleno?
                    E.tMov = Math.min(1, E.tMov + dt / 0.9);
                    if (E.tMov >= 1) { E.fase = 'VERTIENDO'; cambio = true; }
                    break;
                case 'VERTIENDO': {
                    const d = Math.min(E.vCono, (VC / 1.8) * dt);
                    E.vCono -= d;
                    E.vCil = Math.min(med.vCilTotal, E.vCil + d);
                    if (E.vCono <= 1e-9) {
                        E.vCono = 0;
                        if (E.lleno) E.vertidos += 1;
                        else E.exacto = false;             // un vertido a medias rompe la cuenta exacta
                        if (E.exacto) E.vCil = E.vertidos * VC;   // ajuste exacto: sin deriva numérica
                        E.fase = 'VOLVIENDO'; cambio = true;
                    }
                    break;
                }
                case 'VOLVIENDO':
                    E.tMov = Math.max(0, E.tMov - dt / 0.9);
                    if (E.tMov <= 0) {
                        if (E.vertidos >= 3) { E.fase = 'FIN'; E.auto = false; }
                        else E.fase = E.auto ? 'LLENANDO' : 'VACIO';
                        cambio = true;
                    }
                    break;
                default: break;
            }

            posCono.set(
                THREE.MathUtils.lerp(X_CONO, X_CIL, E.tMov),
                med.alturaMesa + THREE.MathUtils.lerp(0, med.h + 0.28, E.tMov),
                0
            );
            E.api.actualizar({
                vCono: E.vCono, vCil: E.vCil, posCono,
                grifoAbierto: E.fase === 'LLENANDO',
                vertiendo: E.fase === 'VERTIENDO',
            });

            E.acum = (E.acum || 0) + dt;
            if (cambio || E.acum > 0.12) {
                E.acum = 0;
                setExpLitros({ cono: E.vCono * 1000, cil: E.vCil * 1000 });
                if (cambio) { setExpFase(E.fase); setExpVertidos(E.vertidos); setExpAuto(!!E.auto); }
            }
        }

        /* ---- desarrollo plano: animación del desplegado ---- */
        function tickDesarrollo(dt) {
            const D = desRef.current;
            if (!D?.api || !D.play) return;
            D.t = Math.min(1, D.t + dt / 2.6);
            D.api.aplicar(D.t);
            D.acum = (D.acum || 0) + dt;
            if (D.t >= 1) { D.play = false; setDesPlay(false); setDesT(1); }
            else if (D.acum > 0.1) { D.acum = 0; setDesT(D.t); }
        }

        renderer.setAnimationLoop(() => {
            const dt = Math.min(reloj.getDelta(), 0.05);
            tickExperimento(dt);
            tickDesarrollo(dt);
            const P = poliRef.current;
            if (P?.girando) P.giratorio.rotation.y += dt * 0.35;
            if (renderer.xr.isPresenting) {
                moverJugador(dt);
                actualizarPunteros();
                accionesRef.current.arrastrar?.();
            } else {
                controles.update();
            }
            renderer.render(escena, camara);
        });

        const alRedimensionar = () => {
            if (!cont.clientWidth) return;
            camara.aspect = cont.clientWidth / cont.clientHeight;
            camara.updateProjectionMatrix();
            renderer.setSize(cont.clientWidth, cont.clientHeight);
        };
        window.addEventListener('resize', alRedimensionar);
        const ro = new ResizeObserver(alRedimensionar);
        ro.observe(cont);

        // botón VR
        let btnVR = null;
        if (navigator.xr?.isSessionSupported) {
            navigator.xr.isSessionSupported('immersive-vr').then(ok => {
                setVrDisponible(ok);
                if (ok) {
                    btnVR = VRButton.createButton(renderer);
                    btnVR.style.position = 'absolute';
                    btnVR.style.bottom = '16px';
                    btnVR.style.left = '50%';
                    btnVR.style.transform = 'translateX(-50%)';
                    btnVR.style.zIndex = 20;
                    cont.appendChild(btnVR);
                }
            }).catch(() => setVrDisponible(false));
        } else setVrDisponible(false);

        return () => {
            window.removeEventListener('resize', alRedimensionar);
            ro.disconnect();
            renderer.setAnimationLoop(null);
            if (btnVR?.parentNode) btnVR.parentNode.removeChild(btnVR);
            controles.dispose();
            escena.traverse(o => {
                if (o.geometry) o.geometry.dispose();
                if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(mt => { mt.map?.dispose?.(); mt.dispose(); });
            });
            renderer.dispose();
            if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
            mallasRef.current.clear();
            medidasObjRef.current.clear();
        };
    }, []);

    /* ---------- sincronizar sólidos (estado React → escena) ---------- */

    useEffect(() => {
        const escena = escenaRef.current;
        if (!escena) return;
        const mapa = mallasRef.current;

        // eliminar los que ya no están
        [...mapa.keys()].forEach(id => {
            if (!solidos.some(s => s.id === id)) {
                const m = mapa.get(id);
                escena.remove(m);
                m.traverse(o => { o.geometry?.dispose?.(); o.material?.map?.dispose?.(); o.material?.dispose?.(); });
                mapa.delete(id);
            }
        });

        const firma = s => `${s.tipo}|${s.n}|${redondear(s.r, 4)}|${redondear(s.h, 4)}`;

        solidos.forEach(s => {
            let m = mapa.get(s.id);
            if (!m || m.userData.firma !== firma(s)) {
                if (m) {
                    escena.remove(m);
                    m.traverse(o => { o.geometry?.dispose?.(); o.material?.map?.dispose?.(); o.material?.dispose?.(); });
                }
                const geo = crearGeometria(s);
                const mat = new THREE.MeshStandardMaterial({
                    color: s.color, roughness: 0.35, metalness: 0.08,
                    transparent: true, opacity: 0.72, side: THREE.DoubleSide,
                });
                m = new THREE.Mesh(geo, mat);
                m.userData.firma = firma(s);
                m.userData.id = s.id;
                const aristas = new THREE.LineSegments(
                    new THREE.EdgesGeometry(geo, 18),
                    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })
                );
                aristas.name = 'aristas';
                m.add(aristas);
                const et = crearEtiqueta(['—']);
                et.name = 'etiqueta';
                m.add(et);
                escena.add(m);
                mapa.set(s.id, m);
            }
            m.position.set(s.pos.x, s.pos.y, s.pos.z);
            m.rotation.y = s.rotY || 0;
            // se esconde mientras se muestra su desarrollo plano o una escena aparte
            m.visible = modo !== 'GRIFO' && modo !== 'POLIEDROS' && s.id !== desarrolloId;
            m.material.opacity = transparente ? 0.72 : 1;
            m.material.transparent = transparente;
            m.material.emissive.setHex(seleccionado === s.id ? 0x334455 : 0x000000);
            const ar = m.getObjectByName('aristas');
            if (ar) ar.material.color.setHex(seleccionado === s.id ? 0xffd54f : 0xffffff);
            const et = m.getObjectByName('etiqueta');
            if (et) {
                et.visible = etiquetas;
                if (etiquetas) {
                    const mt = metricas(s);
                    actualizarEtiqueta(et, [
                        nombreSolido(s),
                        `V = ${redondear(mt.V, 3)} m³`,
                        `A = ${redondear(mt.AT, 3)} m²`,
                    ]);
                    const alturaVis = s.tipo === 'ESFERA' ? 2 * s.r : s.tipo === 'CUBO' ? s.r * Math.SQRT2 : s.h;
                    et.position.set(0, alturaVis + 0.28, 0);
                }
            }
        });

        // puntos de imán para la regla: vértices de las aristas + centros
        const pts = [];
        solidos.forEach(s => {
            const m = mapa.get(s.id);
            if (!m) return;
            m.updateMatrixWorld(true);
            const ar = m.getObjectByName('aristas');
            if (ar) {
                const pos = ar.geometry.attributes.position;
                const vistos = new Set();
                for (let i = 0; i < pos.count && pts.length < 900; i++) {
                    const v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
                    const k = `${Math.round(v.x * 200)},${Math.round(v.y * 200)},${Math.round(v.z * 200)}`;
                    if (vistos.has(k)) continue;
                    vistos.add(k);
                    pts.push(v);
                }
            }
            const alturaVis = s.tipo === 'ESFERA' ? 2 * s.r : s.tipo === 'CUBO' ? s.r * Math.SQRT2 : s.h;
            pts.push(new THREE.Vector3(s.pos.x, s.pos.y, s.pos.z));
            pts.push(new THREE.Vector3(s.pos.x, s.pos.y + alturaVis, s.pos.z));
        });
        snapRef.current = pts;
    }, [solidos, seleccionado, etiquetas, transparente, modo, desarrolloId]);

    /* ---------- sincronizar medidas ---------- */

    useEffect(() => {
        const escena = escenaRef.current;
        if (!escena) return;
        const mapa = medidasObjRef.current;
        [...mapa.keys()].forEach(id => {
            if (!medidas.some(m => m.id === id)) {
                const g = mapa.get(id);
                escena.remove(g);
                g.traverse(o => { o.geometry?.dispose?.(); o.material?.map?.dispose?.(); o.material?.dispose?.(); });
                mapa.delete(id);
            }
        });
        medidas.forEach(md => {
            if (mapa.has(md.id)) return;
            const a = new THREE.Vector3(md.a.x, md.a.y, md.a.z);
            const b = new THREE.Vector3(md.b.x, md.b.y, md.b.z);
            const g = new THREE.Group();
            const linea = new THREE.Line(
                new THREE.BufferGeometry().setFromPoints([a, b]),
                new THREE.LineBasicMaterial({ color: 0xffd54f, depthTest: false })
            );
            linea.renderOrder = 998;
            g.add(linea);
            [a, b].forEach(p => {
                const e = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffd54f, depthTest: false }));
                e.renderOrder = 998;
                e.position.copy(p);
                g.add(e);
            });
            const et = crearEtiqueta([fmtLong(a.distanceTo(b))], { borde: '#ffd54f', fondo: 'rgba(52,40,10,0.9)' });
            et.position.copy(a.clone().add(b).multiplyScalar(0.5)).add(new THREE.Vector3(0, 0.1, 0));
            g.add(et);
            escena.add(g);
            mapa.set(md.id, g);
        });
        mapa.forEach(g => { g.visible = modo !== 'GRIFO' && modo !== 'POLIEDROS'; });
    }, [medidas, modo]);

    /* ---------- fantasma de previsualización ---------- */

    useEffect(() => {
        const f = fantasmaRef.current;
        if (!f) return;
        const t = TIPO(tipo);
        const s = { tipo, n: t.poligonal ? n : 48, r, h: t.alturaLibre ? h : r };
        f.geometry.dispose();
        f.geometry = crearGeometria(s);
        f.material.color.setHex(t.color);
    }, [tipo, n, r, h]);

    /* ---------- experimento del grifo: montaje y acciones ---------- */

    useEffect(() => {
        const cont = grupoExpRef.current;
        if (!cont) return;
        if (modo !== 'GRIFO') { cont.visible = false; return; }
        const api = crearExperimentoGrifo({ poligonal: expPoligonal, n: expLados, r: expR, h: expH });
        cont.add(api.grupo);
        cont.visible = true;
        expRef.current = { api, fase: 'VACIO', vCono: 0, vCil: 0, vertidos: 0, tMov: 0, auto: false, espera: 0, exacto: true, lleno: true };
        setExpFase('VACIO'); setExpVertidos(0); setExpAuto(false); setExpLitros({ cono: 0, cil: 0 });
        return () => { cont.remove(api.grupo); api.dispose(); expRef.current = null; };
    }, [modo, expPoligonal, expLados, expR, expH]);

    // al entrar en el modo grifo, colocarse frente a la mesa
    useEffect(() => {
        if (modo !== 'GRIFO') return;
        const rnd = rendererRef.current, cam = camaraRef.current, ctr = controlesRef.current;
        if (rnd?.xr?.isPresenting) {
            const jug = jugadorRef.current;
            if (jug) { jug.position.set(0, 0, 1.7); jug.rotation.y = 0; }
        } else if (cam && ctr) {
            cam.position.set(0, 1.5, 2.3);
            ctr.target.set(0, ALTURA_MESA + expH * 0.6, 0);
            ctr.update();
        }
    }, [modo, expH]);

    const accionExperimento = useCallback(() => {
        const E = expRef.current;
        if (!E) return;
        if (E.fase === 'VACIO') { E.fase = 'LLENANDO'; setExpFase('LLENANDO'); }
        else if (E.fase === 'LLENANDO') { E.fase = 'LLENO'; setExpFase('LLENO'); }   // cerrar el grifo
        else if (E.fase === 'LLENO') { E.fase = 'MOVIENDO'; setExpFase('MOVIENDO'); }
        else if (E.fase === 'FIN') accionesRef.current.reiniciarExp?.();
    }, []);

    const reiniciarExperimento = useCallback(() => {
        const E = expRef.current;
        if (!E) return;
        Object.assign(E, { fase: 'VACIO', vCono: 0, vCil: 0, vertidos: 0, tMov: 0, auto: false, espera: 0, exacto: true, lleno: true });
        setExpFase('VACIO'); setExpVertidos(0); setExpAuto(false); setExpLitros({ cono: 0, cil: 0 });
    }, []);

    const alternarAutoExp = useCallback(() => {
        const E = expRef.current;
        if (!E) return;
        E.auto = !E.auto;
        if (E.auto && (E.fase === 'VACIO' || E.fase === 'FIN')) {
            if (E.fase === 'FIN') Object.assign(E, { vCono: 0, vCil: 0, vertidos: 0, tMov: 0 });
            E.fase = 'LLENANDO';
            setExpFase('LLENANDO'); setExpVertidos(0);
        }
        setExpAuto(E.auto);
    }, []);

    accionesRef.current.accionExp = accionExperimento;
    accionesRef.current.reiniciarExp = reiniciarExperimento;

    /* ---------- poliedros de Euler: contar V, A y C ---------- */

    useEffect(() => {
        const cont = grupoPoliRef.current;
        if (!cont) return;
        if (modo !== 'POLIEDROS') { cont.visible = false; poliRef.current = null; return; }

        const api = crearPoliedroEuler(poliId, 0.45);
        api.grupo.position.set(0, 1.25, 0);
        cont.add(api.grupo);
        cont.visible = true;
        api.girando = poliGirar;
        poliRef.current = api;
        setPoliMarcas(new Set());

        // peana para que no quede flotando
        const peana = new THREE.Group();
        const matP = new THREE.MeshStandardMaterial({ color: 0x24394d, roughness: 0.8 });
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.82, 20), matP);
        col.position.y = 0.41;
        const pie = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.05, 28), matP);
        pie.position.y = 0.025;
        peana.add(col, pie);
        cont.add(peana);

        return () => {
            cont.remove(api.grupo, peana);
            api.dispose();
            peana.traverse(o => { o.geometry?.dispose?.(); });
            matP.dispose();
            poliRef.current = null;
        };
    }, [modo, poliId]);

    useEffect(() => { poliRef.current?.aplicarMarcas(poliMarcas); }, [poliMarcas]);
    useEffect(() => { poliRef.current?.setCaras(poliCaras); }, [poliCaras, poliId, modo]);
    useEffect(() => { if (poliRef.current) poliRef.current.girando = poliGirar; }, [poliGirar, poliId, modo]);

    // al entrar en el modo, colocarse frente al poliedro
    useEffect(() => {
        if (modo !== 'POLIEDROS') return;
        const rnd = rendererRef.current, cam = camaraRef.current, ctr = controlesRef.current;
        if (rnd?.xr?.isPresenting) {
            const jug = jugadorRef.current;
            if (jug) { jug.position.set(0, 0, 1.2); jug.rotation.y = 0; }
        } else if (cam && ctr) {
            cam.position.set(0, 1.5, 1.85);
            ctr.target.set(0, 1.25, 0);
            ctr.update();
        }
    }, [modo]);

    const marcarPieza = useCallback((obj) => {
        const clave = obj?.userData?.clave;
        if (!clave) return;
        setPoliMarcas(prev => {
            const s = new Set(prev);
            if (s.has(clave)) s.delete(clave); else s.add(clave);
            return s;
        });
    }, []);
    accionesRef.current.marcarPieza = marcarPieza;

    const marcarTodo = useCallback((on) => {
        const api = poliRef.current;
        if (!api) return;
        setPoliMarcas(on ? new Set(api.piezas.map(p => p.userData.clave)) : new Set());
    }, []);

    const cuentaPoli = { V: 0, A: 0, C: 0 };
    poliMarcas.forEach(k => { if (cuentaPoli[k[0]] !== undefined) cuentaPoli[k[0]]++; });
    const statsPoli = POLIEDROS[poliId].stats;
    const totalesPoli = { V: statsPoli.vertices, A: statsPoli.aristas, C: statsPoli.caras };
    const poliCompleto = cuentaPoli.V === totalesPoli.V && cuentaPoli.A === totalesPoli.A && cuentaPoli.C === totalesPoli.C;

    /* ---------- desarrollo plano (red) del cuerpo seleccionado ---------- */

    useEffect(() => {
        const cont = grupoDesRef.current;
        if (!cont) return;
        const s = solidos.find(x => x.id === desarrolloId);
        if (!s) { cont.visible = false; desRef.current = null; setDesInfo(null); return; }
        const api = crearDesarrollo({ tipo: s.tipo, n: s.n, r: s.r, h: s.h, color: s.color });
        if (!api) {
            desRef.current = null;
            cont.visible = false;
            setDesInfo({ desarrollable: false });
            return;
        }
        cont.position.set(s.pos.x, s.pos.y, s.pos.z);
        cont.rotation.y = s.rotY || 0;
        cont.add(api.grupo);
        cont.visible = true;
        desRef.current = { api, t: 0, play: true };     // se despliega solo al abrirlo
        api.setPestanas(desPestanas);
        api.setVertical(desVertical);
        api.aplicar(0);
        setDesT(0); setDesPlay(true); setDesInfo(api.info);
        accionesRef.current.encuadrarDes?.();
        return () => { cont.remove(api.grupo); api.dispose(); desRef.current = null; };
    }, [desarrolloId, solidos]);

    /** Coloca la cámara de escritorio para ver la lámina entera, no de canto. */
    const encuadrarDesarrollo = useCallback(() => {
        const D = desRef.current, cont = grupoDesRef.current;
        const cam = camaraRef.current, ctr = controlesRef.current, rnd = rendererRef.current;
        if (!D?.api || !cont || !cam || !ctr || rnd?.xr?.isPresenting) return;
        const { centro, radio, vertical } = D.api.encuadre();
        cont.updateMatrixWorld(true);
        const c = cont.localToWorld(centro.clone());
        const d = Math.max(1.1, radio * 2.3);
        if (vertical) cam.position.set(c.x, c.y + radio * 0.15, c.z + d);
        else cam.position.set(c.x, c.y + d * 0.95, c.z + d * 0.5);
        ctr.target.copy(c);
        ctr.update();
    }, []);
    accionesRef.current.encuadrarDes = encuadrarDesarrollo;

    useEffect(() => {
        const D = desRef.current;
        if (!D?.api) return;
        D.api.setVertical(desVertical);
        encuadrarDesarrollo();
    }, [desVertical, encuadrarDesarrollo]);

    useEffect(() => {
        const D = desRef.current;
        if (!D?.api) return;
        D.api.setPestanas(desPestanas);
        D.api.aplicar(D.t);
    }, [desPestanas]);

    const fijarDesT = useCallback((v) => {
        const D = desRef.current;
        setDesT(v);
        if (!D?.api) return;
        D.t = v; D.play = false;
        D.api.aplicar(v);
        setDesPlay(false);
    }, []);

    const alternarDesarrollo = useCallback((id) => {
        setDesarrolloId(prev => (prev === id ? null : id));
    }, []);

    const reproducirDesarrollo = useCallback(() => {
        const D = desRef.current;
        if (!D?.api) return;
        if (D.t >= 1) { D.t = 0; D.api.aplicar(0); setDesT(0); }
        D.play = true;
        setDesPlay(true);
    }, []);

    /* ---------- interacción de escritorio (ratón) ---------- */

    useEffect(() => {
        const renderer = rendererRef.current;
        if (!renderer) return;
        const dom = renderer.domElement;
        const rc = new THREE.Raycaster();
        const nds = new THREE.Vector2();

        const rayo = (ev) => {
            const rect = dom.getBoundingClientRect();
            nds.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
            nds.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
            rc.setFromCamera(nds, camaraRef.current);
            return rc;
        };
        const imantar = (p) => {
            let mejor = null, dmin = 0.14;
            snapRef.current.forEach(q => { const d = q.distanceTo(p); if (d < dmin) { dmin = d; mejor = q; } });
            return mejor ? mejor.clone() : p.clone();
        };

        const alMover = (ev) => {
            if (renderer.xr.isPresenting) return;
            const r0 = rayo(ev);
            const f = fantasmaRef.current;
            const hitSuelo = r0.intersectObject(sueloRef.current, false)[0];
            if (estRef.current.modo === 'CONSTRUIR' && f) {
                if (hitSuelo) { f.position.copy(hitSuelo.point); f.visible = true; }
                else f.visible = false;
            } else if (f) f.visible = false;

            if (arrastreRef.current && hitSuelo) {
                const m = mallasRef.current.get(arrastreRef.current);
                if (m) m.position.set(hitSuelo.point.x, 0, hitSuelo.point.z);
            }
        };

        const alSoltar = () => {
            if (!arrastreRef.current) return;
            const id = arrastreRef.current;
            arrastreRef.current = null;
            controlesRef.current.enabled = true;
            const m = mallasRef.current.get(id);
            if (m) setSolidos(prev => prev.map(s => s.id === id
                ? { ...s, pos: { x: redondear(m.position.x, 3), y: redondear(m.position.y, 3), z: redondear(m.position.z, 3) } } : s));
        };

        let bajadaEn = 0, bajadaPos = { x: 0, y: 0 };
        const alBajar = (ev) => {
            if (renderer.xr.isPresenting || ev.button !== 0) return;
            bajadaEn = performance.now();
            bajadaPos = { x: ev.clientX, y: ev.clientY };
            if (estRef.current.modo !== 'MOVER') return;
            const r0 = rayo(ev);
            const hit = r0.intersectObjects([...mallasRef.current.values()], false)[0];
            if (hit) {
                arrastreRef.current = hit.object.userData.id;
                setSeleccionado(hit.object.userData.id);
                controlesRef.current.enabled = false;
            }
        };

        const alSubir = (ev) => {
            if (renderer.xr.isPresenting || ev.button !== 0) { alSoltar(); return; }
            const movido = Math.hypot(ev.clientX - bajadaPos.x, ev.clientY - bajadaPos.y);
            const rapido = performance.now() - bajadaEn < 400 && movido < 6;
            alSoltar();
            if (!rapido) return;
            const st = estRef.current;
            if (st.modo === 'GRIFO') { accionesRef.current.accionExp?.(); return; }
            if (st.modo === 'POLIEDROS') {
                const golpe = rayo(ev).intersectObjects(poliRef.current?.piezas || [], false)[0];
                if (golpe) accionesRef.current.marcarPieza?.(golpe.object);
                return;
            }
            const r0 = rayo(ev);
            const objetos = [sueloRef.current, ...mallasRef.current.values()];
            const hit = r0.intersectObjects(objetos, false)[0];
            if (!hit) return;
            if (st.modo === 'CONSTRUIR') {
                if (hit.object === sueloRef.current) anadirSolido(hit.point);
                else setSeleccionado(hit.object.userData.id);
            } else if (st.modo === 'REGLA') {
                const p = imantar(hit.point);
                if (!puntoAref.current) { fijarPuntoA(p); avisar('Punto A fijado · marca el punto B'); }
                else { anadirMedida(puntoAref.current, p); fijarPuntoA(null); }
            } else if (st.modo === 'MOVER' && hit.object !== sueloRef.current) {
                setSeleccionado(hit.object.userData.id);
            }
        };

        dom.addEventListener('pointermove', alMover);
        dom.addEventListener('pointerdown', alBajar);
        window.addEventListener('pointerup', alSubir);
        return () => {
            dom.removeEventListener('pointermove', alMover);
            dom.removeEventListener('pointerdown', alBajar);
            window.removeEventListener('pointerup', alSubir);
        };
    }, [anadirSolido, anadirMedida, avisar, fijarPuntoA]);

    /* ---------- acciones de los mandos VR ---------- */

    useEffect(() => {
        const imantar = (p) => {
            let mejor = null, dmin = 0.14;
            snapRef.current.forEach(q => { const d = q.distanceTo(p); if (d < dmin) { dmin = d; mejor = q; } });
            return mejor ? mejor.clone() : p.clone();
        };

        const repintarPanel = () => {
            const panel = panelRef.current;
            if (!panel) return;
            const enGrifo = modo === 'GRIFO';
            const st = {
                modo, etiquetas,
                tipo: enGrifo ? (expPoligonal ? 'PIRAMIDE' : 'CONO') : tipo,
                n: enGrifo ? expLados : n,
                r: enGrifo ? expR : r,
                h: enGrifo ? expH : h,
                expPoligonal, expAuto, expEtiqueta: etiquetaAccionGrifo(expFase),
                seleccionado: !!estRef.current.seleccionado,
                desarrollo: !!desarrolloId,
                poliId, poliCaras, poliGirar,
                poliTexto: POLIEDROS[poliId].name,
                poliCuenta: `V ${cuentaPoli.V}/${totalesPoli.V}   ·   A ${cuentaPoli.A}/${totalesPoli.A}   ·   C ${cuentaPoli.C}/${totalesPoli.C}`,
                poliCompleto,
                resumen: modo === 'POLIEDROS'
                    ? (poliCompleto ? 'V − A + C = 2 ✓' : 'señala y cuenta')
                    : `${estRef.current.solidos.length} cuerpos · ${estRef.current.medidas.length} medidas`,
            };
            panel.userData.botones = botonesPanel(st);
            dibujarPanel(panel.userData.canvas.getContext('2d'), st, panel.userData.botones, panel.userData.hover);
            panel.userData.tex.needsUpdate = true;
        };
        accionesRef.current.repintarPanel = repintarPanel;
        repintarPanel();

        const pulsarBoton = (id) => {
            const [clave, valor] = id.split(':');
            const enGrifo = estRef.current.modo === 'GRIFO';
            switch (clave) {
                case 'tipo':  setTipo(valor); break;
                case 'lados': enGrifo ? setExpLados(parseInt(valor, 10)) : setN(parseInt(valor, 10)); break;
                case 'modo':  setModo(valor); fijarPuntoA(null); break;
                case 'r-': enGrifo ? setExpR(v => clamp(redondear(v - PASO, 2), 0.15, 0.5))
                                   : setR(v => clamp(redondear(v - PASO, 2), R_MIN, R_MAX)); break;
                case 'r+': enGrifo ? setExpR(v => clamp(redondear(v + PASO, 2), 0.15, 0.5))
                                   : setR(v => clamp(redondear(v + PASO, 2), R_MIN, R_MAX)); break;
                case 'h-': enGrifo ? setExpH(v => clamp(redondear(v - PASO, 2), 0.3, 0.95))
                                   : setH(v => clamp(redondear(v - PASO, 2), H_MIN, H_MAX)); break;
                case 'h+': enGrifo ? setExpH(v => clamp(redondear(v + PASO, 2), 0.3, 0.95))
                                   : setH(v => clamp(redondear(v + PASO, 2), H_MIN, H_MAX)); break;
                case 'expforma':  setExpPoligonal(v => !v); break;
                case 'expauto':   alternarAutoExp(); break;
                case 'expaccion': accionExperimento(); break;
                case 'expreset':  reiniciarExperimento(); break;
                case 'desarrollo': {
                    const sel = estRef.current.seleccionado;
                    if (sel) alternarDesarrollo(sel);
                    break;
                }
                case 'poli':       setPoliId(valor); break;
                case 'policaras':  setPoliCaras(v => !v); break;
                case 'poligirar':  setPoliGirar(v => !v); break;
                case 'polireset':  setPoliMarcas(new Set()); break;
                case 'polimarcar': marcarTodo(true); break;
                case 'deshacer':  deshacer(); break;
                case 'limpiar':   vaciar(); break;
                case 'etiquetas': setEtiquetas(v => !v); break;
                case 'medidas':   setMedidas([]); fijarPuntoA(null); break;
                case 'ggb':       exportarAGeoGebra(); break;
                default: break;
            }
        };

        accionesRef.current.gatillo = (m, abajo) => {
            if (!abajo) { accionesRef.current.finArrastre?.(m); return; }
            if (m.sobrePanel) { pulsarBoton(m.sobrePanel.id); return; }
            const st = estRef.current;
            // en el experimento, apuntar a la escena y disparar avanza el paso
            if (st.modo === 'GRIFO') { accionExperimento(); return; }
            const hit = m.ultimoHit;
            if (!hit) return;
            if (st.modo === 'POLIEDROS') {
                if (hit.object.userData?.clave) marcarPieza(hit.object);
                return;
            }
            if (st.modo === 'CONSTRUIR') {
                if (hit.object === sueloRef.current) anadirSolido(hit.point);
                else setSeleccionado(hit.object.userData?.id || null);
            } else if (st.modo === 'REGLA') {
                const p = imantar(hit.point);
                if (!puntoAref.current) fijarPuntoA(p);
                else { anadirMedida(puntoAref.current, p); fijarPuntoA(null); }
            } else if (st.modo === 'MOVER') {
                if (hit.object !== sueloRef.current && hit.object.userData?.id) {
                    setSeleccionado(hit.object.userData.id);
                    m.arrastrando = { id: hit.object.userData.id, dist: hit.distance };
                }
            }
        };

        accionesRef.current.finArrastre = (m) => {
            if (!m.arrastrando) return;
            const id = m.arrastrando.id;
            m.arrastrando = null;
            const malla = mallasRef.current.get(id);
            if (malla) setSolidos(prev => prev.map(s => s.id === id
                ? { ...s, pos: { x: redondear(malla.position.x, 3), y: redondear(Math.max(0, malla.position.y), 3), z: redondear(malla.position.z, 3) },
                    rotY: redondear(malla.rotation.y, 4) } : s));
        };

        accionesRef.current.arrastrar = () => {
            mandosRef.current.forEach(m => {
                if (!m.arrastrando) return;
                const malla = mallasRef.current.get(m.arrastrando.id);
                if (!malla) return;
                const rc = accionesRef.current.rayoDeMando?.(m);
                if (!rc) return;
                const destino = rc.ray.origin.clone().addScaledVector(rc.ray.direction, m.arrastrando.dist);
                malla.position.set(destino.x, Math.max(0, destino.y), destino.z);
                if (m.gamepad?.axes?.length >= 4) {
                    const gx = m.gamepad.axes[2] || 0;
                    if (Math.abs(gx) > 0.2) malla.rotation.y += gx * 0.03;
                }
            });
        };

        // agarre (squeeze): girar el cuerpo seleccionado 15°
        accionesRef.current.agarre = (m, abajo) => {
            if (!abajo) return;
            const id = estRef.current.seleccionado;
            if (!id) return;
            setSolidos(prev => prev.map(s => s.id === id
                ? { ...s, rotY: redondear((s.rotY || 0) + (m.mano === 'left' ? -1 : 1) * Math.PI / 12, 4) } : s));
        };

        // stick vertical derecho: escala el cuerpo seleccionado (acumulado para no rehacer
        // la geometría en cada fotograma)
        let acumEscala = 0;
        accionesRef.current.escalar = (delta) => {
            const id = estRef.current.seleccionado;
            if (!id) return;
            acumEscala += delta;
            if (Math.abs(acumEscala) < 0.02) return;
            const paso = acumEscala;
            acumEscala = 0;
            setSolidos(prev => prev.map(s => s.id === id
                ? { ...s, r: clamp(redondear(s.r + paso, 3), R_MIN, R_MAX), h: clamp(redondear(s.h + paso, 3), H_MIN, H_MAX) } : s));
        };

        return () => { accionesRef.current.repintarPanel = null; };
    }, [modo, tipo, n, r, h, etiquetas, anadirSolido, anadirMedida, deshacer, vaciar, exportarAGeoGebra, fijarPuntoA,
        expPoligonal, expAuto, expFase, expR, expH, expLados, desarrolloId,
        accionExperimento, reiniciarExperimento, alternarAutoExp, alternarDesarrollo,
        poliId, poliCaras, poliGirar, poliMarcas, marcarPieza, marcarTodo]);

    // refrescar cabecera del panel cuando cambian los recuentos
    useEffect(() => { accionesRef.current.repintarPanel?.(); }, [solidos.length, medidas.length, seleccionado, expFase, expVertidos]);

    /* ---------- guardar / cargar ---------- */

    const guardar = () => {
        try {
            localStorage.setItem('geometrix_sala3d', JSON.stringify({ solidos, medidas }));
            avisar('💾 Construcción guardada en este dispositivo');
        } catch { avisar('No se pudo guardar'); }
    };
    const cargar = () => {
        try {
            const d = JSON.parse(localStorage.getItem('geometrix_sala3d') || 'null');
            if (!d) { avisar('No hay ninguna construcción guardada'); return; }
            setSolidos(d.solidos || []);
            setMedidas(d.medidas || []);
            avisar('📂 Construcción cargada');
        } catch { avisar('Archivo guardado no válido'); }
    };

    /* ---------- resumen ---------- */

    const total = solidos.reduce((acc, s) => {
        const mt = metricas(s);
        return { V: acc.V + mt.V, A: acc.A + mt.AT };
    }, { V: 0, A: 0 });

    // datos del experimento del grifo
    const expAB = expPoligonal
        ? (expLados / 2) * expR * expR * Math.sin((2 * Math.PI) / expLados)
        : Math.PI * expR * expR;
    const expVCil = expAB * expH;
    const expVCono = expVCil / 3;
    const enMovimientoExp = ['MOVIENDO', 'VERTIENDO', 'VOLVIENDO'].includes(expFase);

    const solSel = solidos.find(s => s.id === seleccionado) || null;
    const mtSel = solSel ? metricas(solSel) : null;
    const tipoSel = TIPO(tipo);

    /* ═══════════════════ RENDER ═══════════════════ */

    const est = {
        wrap: { position: 'fixed', inset: 0, zIndex: 9999, background: '#0e1b26', display: 'flex', flexDirection: 'column', color: '#e8f1f8', fontFamily: 'system-ui, sans-serif' },
        cabecera: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#0a1620', borderBottom: '1px solid #1d3a52', flexWrap: 'wrap' },
        cuerpo: { flex: 1, display: 'flex', minHeight: 0 },
        lateral: { width: 300, flexShrink: 0, overflowY: 'auto', background: '#0a1620', borderRight: '1px solid #1d3a52', padding: 12 },
        lienzo: { flex: 1, position: 'relative', minWidth: 0 },
        btn: (activo, color = '#00897b') => ({
            background: activo ? color : '#1b2c3d', color: activo ? '#fff' : '#b9cddf',
            border: `1px solid ${activo ? color : '#2b4459'}`, borderRadius: 8, padding: '8px 10px',
            cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', flex: 1, minWidth: 0,
        }),
        chip: (activo) => ({
            background: activo ? '#00897b' : '#16293a', color: activo ? '#fff' : '#a9c1d4',
            border: `1px solid ${activo ? '#4db6ac' : '#2b4459'}`, borderRadius: 20, padding: '6px 10px',
            cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700,
        }),
        seccion: { margin: '14px 0 6px', fontSize: '0.72rem', letterSpacing: 1, color: '#7fa7c4', textTransform: 'uppercase', fontWeight: 800 },
        fila: { display: 'flex', gap: 6, flexWrap: 'wrap' },
        tarjeta: { background: '#12263a', border: '1px solid #234863', borderRadius: 10, padding: 10, fontSize: '0.8rem' },
    };

    return (
        <div style={est.wrap}>
            {/* ── CABECERA ── */}
            <div style={est.cabecera}>
                <button onClick={onExit} style={{ ...est.btn(false), flex: '0 0 auto', padding: '8px 14px' }}>← Geometrix</button>
                <strong style={{ fontSize: '1rem', color: '#7fe6d8' }}>📐 Sala de Geometría 3D · VR</strong>
                <span style={{ fontSize: '0.75rem', color: '#7fa7c4' }}>
                    {vrDisponible === null ? 'comprobando visor…' : vrDisponible ? '🥽 Visor VR detectado' : '🖥️ Modo escritorio (sin visor)'}
                </span>
                <div style={{ flex: 1 }} />
                <button onClick={() => setAyuda(true)} style={{ ...est.btn(false), flex: '0 0 auto' }}>ℹ️ Ayuda</button>
                <button onClick={() => (mostrarGGB ? setMostrarGGB(false) : abrirGeoGebra())} style={{ ...est.btn(mostrarGGB, '#1565c0'), flex: '0 0 auto' }}>
                    📊 GeoGebra
                </button>
            </div>

            <div style={est.cuerpo}>
                {/* ── PANEL LATERAL ── */}
                <div style={est.lateral}>
                    <div style={est.seccion}>Modo</div>
                    <div style={est.fila}>
                        {[['CONSTRUIR', '🏗️ Construir'], ['REGLA', '📏 Regla'], ['MOVER', '✋ Mover'],
                          ['GRIFO', '🚰 Grifo'], ['POLIEDROS', '🔷 Poliedros']].map(([m, l]) => (
                            <button key={m} onClick={() => { setModo(m); fijarPuntoA(null); }} style={est.btn(modo === m)}>{l}</button>
                        ))}
                    </div>

                    {modo === 'GRIFO' ? (<>
                        <div style={est.seccion}>¿Cuántas veces cabe?</div>
                        <div style={{ ...est.tarjeta, borderColor: '#00897b' }}>
                            Llena el recipiente <b>{expPoligonal ? 'piramidal' : 'cónico'}</b> con el grifo y viértelo en
                            el <b>{expPoligonal ? 'prisma' : 'cilindro'}</b> de <b>igual base y altura</b>.
                            ¿Cuántos harán falta?
                        </div>

                        <div style={est.seccion}>Pareja de recipientes</div>
                        <div style={est.fila}>
                            <button onClick={() => setExpPoligonal(false)} style={est.btn(!expPoligonal)}>🍦 Cono → Cilindro</button>
                            <button onClick={() => setExpPoligonal(true)} style={est.btn(expPoligonal)}>🔺 Pirámide → Prisma</button>
                        </div>
                        {expPoligonal && (
                            <div style={{ ...est.fila, marginTop: 6 }}>
                                {LADOS.map(k => (
                                    <button key={k} onClick={() => setExpLados(k)} style={est.chip(expLados === k)}>{k}</button>
                                ))}
                            </div>
                        )}

                        <div style={est.seccion}>Radio de la base · {redondear(expR)} m</div>
                        <input type="range" min={0.15} max={0.5} step={0.05} value={expR}
                            onChange={e => setExpR(parseFloat(e.target.value))} style={{ width: '100%' }} />
                        <div style={est.seccion}>Altura · {redondear(expH)} m</div>
                        <input type="range" min={0.3} max={0.95} step={0.05} value={expH}
                            onChange={e => setExpH(parseFloat(e.target.value))} style={{ width: '100%' }} />

                        <div style={est.seccion}>Experimento</div>
                        <button onClick={accionExperimento} disabled={enMovimientoExp}
                            style={{ ...est.btn(!enMovimientoExp, '#0288d1'), width: '100%', padding: 12, fontSize: '0.95rem', opacity: enMovimientoExp ? 0.6 : 1 }}>
                            {etiquetaAccionGrifo(expFase)}
                        </button>
                        <div style={{ ...est.fila, marginTop: 6 }}>
                            <button onClick={alternarAutoExp} style={est.btn(expAuto, '#6a1b9a')}>{expAuto ? '⏸️ Auto ON' : '▶️ Automático'}</button>
                            <button onClick={reiniciarExperimento} style={est.btn(false)}>🔄 Reiniciar</button>
                        </div>

                        <div style={{ ...est.tarjeta, marginTop: 10, textAlign: 'center' }}>
                            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: expVertidos >= 3 ? '#66bb6a' : '#ffd54f' }}>
                                {expVertidos} / 3
                            </div>
                            <div style={{ color: '#a9c1d4', fontSize: '0.75rem' }}>vertidos completos</div>
                        </div>

                        <div style={{ ...est.tarjeta, marginTop: 6 }}>
                            <div>🍦 {expPoligonal ? 'Pirámide' : 'Cono'}: <b>{redondear(expLitros.cono, 1)}</b> L</div>
                            <div>🥫 {expPoligonal ? 'Prisma' : 'Cilindro'}: <b>{redondear(expLitros.cil, 1)}</b> L</div>
                            <div style={{ marginTop: 6, borderTop: '1px solid #234863', paddingTop: 6, color: '#a9c1d4', fontSize: '0.75rem' }}>
                                A_base = {redondear(expAB, 4)} m²<br />
                                V del {expPoligonal ? 'prisma' : 'cilindro'} = A_base·h = <b>{redondear(expVCil, 4)}</b> m³ = {redondear(expVCil * 1000, 1)} L<br />
                                V de la {expPoligonal ? 'pirámide' : 'cono'} = (A_base·h)/3 = <b>{redondear(expVCono, 4)}</b> m³ = {redondear(expVCono * 1000, 1)} L
                            </div>
                        </div>

                        {expVertidos >= 3 && (
                            <div style={{ ...est.tarjeta, marginTop: 8, background: '#0d3a33', borderColor: '#00897b' }}>
                                🎉 <b>¡Exactamente 3 veces!</b><br />
                                El {expPoligonal ? 'prisma' : 'cilindro'} se ha llenado justo con 3 recipientes.
                                Por eso el volumen de una pirámide o un cono es
                                <b> la tercera parte</b> del prisma o cilindro de la misma base y la misma altura:
                                <div style={{ marginTop: 6, textAlign: 'center', fontSize: '0.95rem', color: '#7fe6d8' }}>
                                    V = (A_base · h) / 3
                                </div>
                            </div>
                        )}
                    </>) : modo === 'POLIEDROS' ? (<>
                        <div style={est.seccion}>Poliedros regulares</div>
                        <div style={{ ...est.fila, display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                            {IDS_POLIEDROS.map(pid => (
                                <button key={pid} onClick={() => setPoliId(pid)} style={est.btn(poliId === pid)}>
                                    {POLIEDROS[pid].emoji} {POLIEDROS[pid].name}
                                </button>
                            ))}
                        </div>

                        <div style={{ ...est.tarjeta, marginTop: 10 }}>
                            Señala con el ratón (o con el mando) cada <b>vértice</b>, <b>arista</b> y <b>cara</b> para
                            irlos contando. Vuelve a señalarlos para desmarcarlos.
                        </div>

                        <div style={est.seccion}>Recuento</div>
                        {[['V', 'Vértices', '#ffd54f'], ['A', 'Aristas', '#ffd54f'], ['C', 'Caras', '#66bb6a']].map(([k, etq, col]) => (
                            <div key={k} style={{ ...est.tarjeta, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>{etq}</span>
                                <b style={{ color: cuentaPoli[k] === totalesPoli[k] ? col : '#a9c1d4', fontSize: '1.05rem' }}>
                                    {cuentaPoli[k]} / {totalesPoli[k]}
                                </b>
                            </div>
                        ))}

                        <div style={{
                            ...est.tarjeta, textAlign: 'center', fontSize: '1rem',
                            background: poliCompleto ? '#0d3a33' : '#12263a',
                            borderColor: poliCompleto ? '#00897b' : '#234863',
                        }}>
                            <div style={{ color: '#7fa7c4', fontSize: '0.72rem', marginBottom: 4 }}>FÓRMULA DE EULER</div>
                            <b style={{ color: poliCompleto ? '#8bf5c0' : '#d7e6f2' }}>
                                {cuentaPoli.V} − {cuentaPoli.A} + {cuentaPoli.C} = {cuentaPoli.V - cuentaPoli.A + cuentaPoli.C}
                            </b>
                            {poliCompleto && <div style={{ marginTop: 6, fontSize: '0.82rem' }}>🎉 ¡V − A + C = 2 en todos los poliedros!</div>}
                        </div>

                        <div style={{ ...est.fila, marginTop: 10 }}>
                            <button onClick={() => setPoliCaras(v => !v)} style={est.btn(poliCaras)}>👁️ Caras</button>
                            <button onClick={() => setPoliGirar(v => !v)} style={est.btn(poliGirar)}>🌀 Girar</button>
                        </div>
                        <div style={{ ...est.fila, marginTop: 6 }}>
                            <button onClick={() => marcarTodo(true)} style={est.btn(false)}>✅ Marcar todo</button>
                            <button onClick={() => marcarTodo(false)} style={est.btn(false)}>🔄 Reiniciar</button>
                        </div>

                        <div style={{ ...est.tarjeta, marginTop: 10 }}>
                            💡 {POLIEDROS[poliId].fact}
                        </div>
                    </>) : (<>

                    <div style={est.seccion}>Cuerpo geométrico</div>
                    <div style={{ ...est.fila, display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                        {TIPOS.map(t => (
                            <button key={t.id} onClick={() => setTipo(t.id)} style={est.btn(tipo === t.id)}>{t.emoji} {t.nombre}</button>
                        ))}
                    </div>

                    {tipoSel.poligonal && (<>
                        <div style={est.seccion}>Lados de la base</div>
                        <div style={est.fila}>
                            {LADOS.map(k => (
                                <button key={k} onClick={() => setN(k)} style={est.chip(n === k)}>{k}</button>
                            ))}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#7fa7c4', marginTop: 4 }}>
                            Base {NOMBRE_BASE[n]} · lado = {redondear(2 * r * Math.sin(Math.PI / n), 3)} m
                        </div>
                    </>)}

                    <div style={est.seccion}>Radio de la base · {redondear(r)} m</div>
                    <input type="range" min={R_MIN} max={R_MAX} step={PASO} value={r}
                        onChange={e => setR(parseFloat(e.target.value))} style={{ width: '100%' }} />

                    {tipoSel.alturaLibre && (<>
                        <div style={est.seccion}>Altura · {redondear(h)} m</div>
                        <input type="range" min={H_MIN} max={H_MAX} step={PASO} value={h}
                            onChange={e => setH(parseFloat(e.target.value))} style={{ width: '100%' }} />
                    </>)}

                    <div style={est.seccion}>Vista</div>
                    <div style={est.fila}>
                        <button onClick={() => setEtiquetas(v => !v)} style={est.btn(etiquetas)}>🏷️ Datos</button>
                        <button onClick={() => setTransparente(v => !v)} style={est.btn(transparente)}>🫧 Translúcido</button>
                    </div>

                    <div style={est.seccion}>Construcción</div>
                    <div style={est.fila}>
                        <button onClick={deshacer} style={est.btn(false)}>↩️ Deshacer</button>
                        <button onClick={() => { setMedidas([]); fijarPuntoA(null); }} style={est.btn(false)}>🧹 Medidas</button>
                        <button onClick={vaciar} style={est.btn(false, '#c62828')}>🗑️ Vaciar</button>
                    </div>
                    <div style={{ ...est.fila, marginTop: 6 }}>
                        <button onClick={guardar} style={est.btn(false)}>💾 Guardar</button>
                        <button onClick={cargar} style={est.btn(false)}>📂 Cargar</button>
                    </div>

                    <div style={est.seccion}>GeoGebra 3D</div>
                    <div style={est.fila}>
                        <button onClick={exportarAGeoGebra} style={est.btn(false, '#1565c0')}>⬆️ Enviar</button>
                        <button onClick={importarDeGeoGebra} style={est.btn(false, '#1565c0')}>⬇️ Importar</button>
                    </div>
                    {ggbEstado && <div style={{ fontSize: '0.72rem', color: '#7fa7c4', marginTop: 4 }}>{ggbEstado}</div>}

                    {solSel && mtSel && (<>
                        <div style={est.seccion}>Seleccionado</div>
                        <div style={est.tarjeta}>
                            <div style={{ fontWeight: 800, color: '#7fe6d8', marginBottom: 6 }}>{nombreSolido(solSel)}</div>
                            <div>V = <b>{redondear(mtSel.V, 4)}</b> m³</div>
                            <div>A total = <b>{redondear(mtSel.AT, 4)}</b> m²</div>
                            {mtSel.AL !== undefined && <div>A lateral = {redondear(mtSel.AL, 4)} m²</div>}
                            {mtSel.AB !== undefined && <div>A base = {redondear(mtSel.AB, 4)} m²</div>}
                            <div style={{ marginTop: 6, borderTop: '1px solid #234863', paddingTop: 6, color: '#a9c1d4', fontSize: '0.74rem' }}>
                                {mtSel.formulas.map((f, i) => <div key={i}>{f}</div>)}
                            </div>
                            <button onClick={() => borrarSolido(solSel.id)} style={{ ...est.btn(false, '#c62828'), marginTop: 8, width: '100%' }}>🗑️ Borrar este cuerpo</button>
                        </div>

                        <div style={est.seccion}>Desarrollo plano</div>
                        <button onClick={() => alternarDesarrollo(solSel.id)}
                            style={{ ...est.btn(desarrolloId === solSel.id, '#ef6c00'), width: '100%', padding: 10 }}>
                            {desarrolloId === solSel.id ? '📦 Volver a montar' : '📐 Ver desarrollo plano'}
                        </button>

                        {desarrolloId === solSel.id && desInfo && desInfo.desarrollable === false && (
                            <div style={{ ...est.tarjeta, marginTop: 8 }}>
                                ⚠️ La <b>esfera no es desarrollable</b>: no existe ninguna forma de extenderla sobre un
                                plano sin deformarla. Por eso los mapas del mundo siempre distorsionan algo.
                            </div>
                        )}

                        {desarrolloId === solSel.id && desInfo?.desarrollable && (<>
                            <div style={{ ...est.fila, marginTop: 8, alignItems: 'center' }}>
                                <button onClick={reproducirDesarrollo} style={est.btn(desPlay, '#ef6c00')}>
                                    {desPlay ? '⏳ Desplegando…' : '▶️ Animar'}
                                </button>
                                <button onClick={() => fijarDesT(desT > 0.5 ? 0 : 1)} style={est.btn(false)}>
                                    {desT > 0.5 ? '📦 Plegar' : '📐 Abrir'}
                                </button>
                            </div>
                            <input type="range" min={0} max={1} step={0.01} value={desT}
                                onChange={e => fijarDesT(parseFloat(e.target.value))}
                                style={{ width: '100%', marginTop: 8 }} />
                            <div style={{ textAlign: 'center', fontSize: '0.72rem', color: '#7fa7c4' }}>
                                {Math.round(desT * 100)}% desplegado
                            </div>
                            <div style={{ ...est.fila, marginTop: 6 }}>
                                <button onClick={() => setDesVertical(true)} style={est.btn(desVertical, '#ef6c00')}>🖼️ De frente</button>
                                <button onClick={() => setDesVertical(false)} style={est.btn(!desVertical, '#ef6c00')}>🛏️ En la mesa</button>
                            </div>
                            <div style={{ ...est.fila, marginTop: 6 }}>
                                <button onClick={() => setDesPestanas(v => !v)} style={est.btn(desPestanas, '#ef6c00')}>🩹 Pestañas</button>
                                <button onClick={encuadrarDesarrollo} style={est.btn(false)}>🎥 Encuadrar</button>
                            </div>

                            <div style={{ ...est.tarjeta, marginTop: 8 }}>
                                <div style={{ fontWeight: 800, color: '#ffb74d', marginBottom: 6 }}>Cómo se recorta</div>
                                <div style={{ marginBottom: 8, color: '#d7e6f2' }}>{desInfo.reparto}</div>
                                <div style={{ fontWeight: 800, color: '#ffb74d', marginBottom: 6 }}>Piezas de la red</div>
                                {desInfo.piezas.map((p, i) => <div key={i} style={{ marginBottom: 3 }}>• {p}</div>)}
                                <div style={{ marginTop: 6, borderTop: '1px solid #234863', paddingTop: 6, color: '#a9c1d4', fontSize: '0.74rem' }}>
                                    {desInfo.formula}
                                </div>
                                <div style={{ marginTop: 6, color: '#7fe6d8' }}>
                                    A total = <b>{redondear(desInfo.areaTotal, 4)}</b> m²
                                    &nbsp;(bases {redondear(desInfo.areaBase, 3)} + lateral {redondear(desInfo.areaLateral, 3)})
                                </div>
                            </div>
                        </>)}
                    </>)}

                    <div style={est.seccion}>Cuerpos ({solidos.length})</div>
                    {solidos.length === 0 && <div style={{ fontSize: '0.78rem', color: '#6b8ba5' }}>Haz clic en el suelo para construir.</div>}
                    {solidos.map((s, i) => (
                        <div key={s.id} onClick={() => setSeleccionado(s.id)}
                            style={{ ...est.tarjeta, marginBottom: 6, cursor: 'pointer', borderColor: seleccionado === s.id ? '#ffd54f' : '#234863' }}>
                            <b>{i + 1}. {TIPO(s.tipo).emoji} {nombreSolido(s)}</b>
                            <div style={{ color: '#a9c1d4', fontSize: '0.74rem' }}>
                                V = {redondear(metricas(s).V, 3)} m³ · A = {redondear(metricas(s).AT, 3)} m²
                            </div>
                        </div>
                    ))}

                    {solidos.length > 1 && (
                        <div style={{ ...est.tarjeta, marginTop: 6, background: '#0d3a33', borderColor: '#00897b' }}>
                            <b>Σ Total</b><br />
                            V = {redondear(total.V, 4)} m³ · A = {redondear(total.A, 4)} m²
                        </div>
                    )}

                    <div style={est.seccion}>Medidas ({medidas.length})</div>
                    {medidas.length === 0 && <div style={{ fontSize: '0.78rem', color: '#6b8ba5' }}>Modo regla: marca dos puntos del espacio. Se imantan a los vértices.</div>}
                    {medidas.map((m, i) => (
                        <div key={m.id} style={{ ...est.tarjeta, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>📏 {i + 1}: <b>{fmtLong(Math.hypot(m.b.x - m.a.x, m.b.y - m.a.y, m.b.z - m.a.z))}</b></span>
                            <button onClick={() => setMedidas(prev => prev.filter(x => x.id !== m.id))}
                                style={{ background: 'none', border: 'none', color: '#ef5350', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                        </div>
                    ))}
                    </>)}
                </div>

                {/* ── LIENZO 3D ── */}
                <div ref={contRef} style={est.lienzo}>
                    <div ref={lienzoRef} style={{ position: 'absolute', inset: 0 }} />
                    <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(10,22,32,0.82)', border: '1px solid #234863', borderRadius: 10, padding: '8px 12px', fontSize: '0.78rem', pointerEvents: 'none', maxWidth: 360 }}>
                        {modo === 'CONSTRUIR' && '🏗️ Clic en el suelo para colocar el cuerpo. Clic en un cuerpo para seleccionarlo.'}
                        {modo === 'REGLA' && `📏 Clic en dos puntos para medir. ${esperandoB ? 'Marca el punto B.' : 'Marca el punto A.'}`}
                        {modo === 'MOVER' && '✋ Arrastra un cuerpo por el suelo para moverlo.'}
                        {modo === 'GRIFO' && `🚰 ${etiquetaAccionGrifo(expFase)} — haz clic en la escena o usa el botón del panel.`}
                        {modo === 'POLIEDROS' && `🔷 ${POLIEDROS[poliId].name}: señala vértices, aristas y caras para contarlos.`}
                        {modo !== 'GRIFO' && modo !== 'POLIEDROS' && <div style={{ color: '#7fa7c4', marginTop: 4 }}>Rejilla: 1 casilla = 1 m (subdivisión 10 cm)</div>}
                        {modo === 'POLIEDROS' && <div style={{ color: '#7fa7c4', marginTop: 4 }}>V {cuentaPoli.V}/{totalesPoli.V} · A {cuentaPoli.A}/{totalesPoli.A} · C {cuentaPoli.C}/{totalesPoli.C}</div>}
                        {modo === 'GRIFO' && <div style={{ color: '#7fa7c4', marginTop: 4 }}>Las marcas amarillas del cilindro señalan los tercios de su altura.</div>}
                    </div>
                    {aviso && (
                        <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', background: '#00897b', padding: '8px 16px', borderRadius: 20, fontWeight: 700, fontSize: '0.85rem', zIndex: 15 }}>
                            {aviso}
                        </div>
                    )}
                </div>

                {/* ── PANEL GEOGEBRA ── */}
                {mostrarGGB && (
                    <div style={{ width: 460, flexShrink: 0, background: '#fff', borderLeft: '1px solid #1d3a52', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#0a1620' }}>
                            <b style={{ fontSize: '0.85rem' }}>📊 GeoGebra 3D</b>
                            <div style={{ flex: 1 }} />
                            <button onClick={exportarAGeoGebra} style={{ ...est.btn(false, '#1565c0'), flex: '0 0 auto' }}>⬆️ Enviar</button>
                            <button onClick={importarDeGeoGebra} style={{ ...est.btn(false, '#1565c0'), flex: '0 0 auto' }}>⬇️ Importar</button>
                            <button onClick={() => setMostrarGGB(false)} style={{ ...est.btn(false), flex: '0 0 auto' }}>✕</button>
                        </div>
                        <div ref={ggbDivRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }} />
                    </div>
                )}
            </div>

            {/* ── AYUDA ── */}
            {ayuda && (
                <div onClick={() => setAyuda(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: '#0f2233', border: '1px solid #234863', borderRadius: 14, padding: 20, maxWidth: 680, maxHeight: '86vh', overflowY: 'auto', fontSize: '0.88rem', lineHeight: 1.5 }}>
                        <h2 style={{ color: '#7fe6d8', marginTop: 0 }}>📐 Sala de Geometría 3D</h2>
                        <p>Construye cuerpos geométricos a tamaño real, mídelos con la regla virtual y compara los resultados con GeoGebra 3D.</p>

                        <h3 style={{ color: '#ffd54f', marginBottom: 4 }}>🥽 Con gafas VR (Meta Quest / Oculus)</h3>
                        <ul style={{ margin: '0 0 12px', paddingLeft: 20 }}>
                            <li>Abre esta página <b>en el navegador de las gafas</b> y pulsa <b>ENTER VR</b>.</li>
                            <li><b>Panel de mando</b>: aparece sobre el mando izquierdo. Apunta con el derecho y pulsa el gatillo.</li>
                            <li><b>Gatillo</b>: construir / marcar puntos de medida / coger un cuerpo, según el modo.</li>
                            <li><b>Joystick izquierdo</b>: desplazarte por la sala. <b>Joystick derecho (izq./der.)</b>: girar 30°.</li>
                            <li><b>Joystick derecho (arriba/abajo)</b>: agrandar o reducir el cuerpo seleccionado.</li>
                            <li><b>Grip (agarre lateral)</b>: gira 15° el cuerpo seleccionado (izquierdo y derecho, en sentidos opuestos).</li>
                        </ul>

                        <h3 style={{ color: '#ffd54f', marginBottom: 4 }}>🖥️ Sin gafas</h3>
                        <ul style={{ margin: '0 0 12px', paddingLeft: 20 }}>
                            <li>Arrastra para orbitar, rueda para acercar, botón derecho para desplazar.</li>
                            <li>Clic en el suelo para construir; en modo <b>Mover</b>, arrastra los cuerpos.</li>
                        </ul>

                        <h3 style={{ color: '#ffd54f', marginBottom: 4 }}>📏 Regla virtual</h3>
                        <p style={{ margin: '0 0 12px' }}>En modo <b>Regla</b>, marca dos puntos del espacio: se dibuja el segmento y su longitud real (cm o m). Los puntos se <b>imantan a los vértices y aristas</b> de los cuerpos cuando estás a menos de 14 cm, para medir aristas, diagonales, alturas o distancias entre cuerpos con precisión.</p>

                        <h3 style={{ color: '#ffd54f', marginBottom: 4 }}>🚰 Experimento del grifo</h3>
                        <p style={{ margin: '0 0 12px' }}>
                            En el modo <b>Grifo</b> aparece una mesa con dos recipientes de <b>la misma base y la misma
                            altura</b>: uno cónico (o piramidal) y otro cilíndrico (o prismático). Abre el grifo, llena el
                            primero y viértelo en el segundo. Hacen falta <b>exactamente 3 vertidos</b> para llenarlo, y cada
                            uno llega justo a una de las marcas amarillas de los tercios: es la demostración de que
                            <b> V = (A_base · h) / 3</b>. El nivel del agua se calcula con el volumen real, no por altura,
                            así que en el cono sube despacio al principio y deprisa al final.
                        </p>

                        <h3 style={{ color: '#ffd54f', marginBottom: 4 }}>🔷 Poliedros de Euler</h3>
                        <p style={{ margin: '0 0 12px' }}>
                            Los cinco sólidos platónicos (los mismos del visor de Geometrix) a tamaño real sobre una
                            peana. Señala cada <b>vértice</b>, <b>arista</b> y <b>cara</b> con el ratón o con el mando
                            para contarlos: se quedan marcados y el panel lleva la cuenta. Al terminar comprobarás que
                            siempre se cumple <b>V − A + C = 2</b>. Puedes ocultar las caras para ver el esqueleto de
                            aristas y ponerlo a girar.
                        </p>

                        <h3 style={{ color: '#ffd54f', marginBottom: 4 }}>📐 Desarrollo plano</h3>
                        <p style={{ margin: '0 0 12px' }}>
                            Selecciona un cuerpo y pulsa <b>Ver desarrollo plano</b>: sus caras se despliegan con bisagras
                            reales hasta quedar tumbadas en el suelo. Puedes animarlo o moverlo a mano con el deslizador para
                            pararlo a medio plegar. El panel muestra cada pieza de la red (bases, rectángulos, triángulos, o
                            el sector circular del cono) y cómo suman el área total. La esfera avisa de que no es
                            desarrollable.
                        </p>

                        <h3 style={{ color: '#ffd54f', marginBottom: 4 }}>📊 GeoGebra</h3>
                        <ul style={{ margin: '0 0 12px', paddingLeft: 20 }}>
                            <li><b>Enviar</b>: vuelca la construcción a la vista 3D de GeoGebra como <code>Sphere</code>, <code>Cylinder</code>, <code>Cone</code>, <code>Prism</code>, <code>Pyramid</code> y <code>Segment</code>, para ver allí los valores algebraicos.</li>
                            <li><b>Importar</b>: trae a la sala los objetos de GeoGebra creados con esos mismos comandos (los prismas y pirámides se reconstruyen como cuerpos de base regular).</li>
                            <li>GeoGebra usa Z como eje vertical; aquí la conversión es automática.</li>
                        </ul>
                        <p style={{ color: '#8fb0c8', fontSize: '0.8rem' }}>Nota: 1 unidad = 1 metro. La VR necesita conexión segura (https) y un navegador con WebXR.</p>
                        <button onClick={() => setAyuda(false)} style={{ ...est.btn(true), width: '100%', marginTop: 10, padding: 12 }}>Entendido</button>
                    </div>
                </div>
            )}
        </div>
    );
}
