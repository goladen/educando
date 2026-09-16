// SalaGeometria3D.jsx — Sala inmersiva de geometría 3D (WebXR / Oculus-Meta Quest)
// Herramienta de Geometrix: construir cuerpos geométricos en el espacio con los mandos,
// medirlos con una regla virtual y sincronizar la construcción con GeoGebra 3D.
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';

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
    TIPOS.forEach((t, i) => bs.push({
        id: 'tipo:' + t.id, label: `${t.emoji} ${t.nombre}`,
        x: 20 + (i % 3) * 293, y: 60 + Math.floor(i / 3) * 70, w: 283, h: 60,
        on: st.tipo === t.id,
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
    [['CONSTRUIR', '🏗️ Construir'], ['REGLA', '📏 Regla'], ['MOVER', '✋ Mover']].forEach(([m, l], i) =>
        bs.push({ id: 'modo:' + m, label: l, x: 20 + i * 293, y: 375, w: 283, h: 62, on: st.modo === m }));
    bs.push({ id: 'deshacer', label: '↩️ Deshacer', x: 20,  y: 455, w: 283, h: 60 });
    bs.push({ id: 'limpiar',  label: '🗑️ Vaciar',   x: 313, y: 455, w: 283, h: 60 });
    bs.push({ id: 'etiquetas', label: st.etiquetas ? '🏷️ Datos ON' : '🏷️ Datos OFF', x: 606, y: 455, w: 274, h: 60 });
    bs.push({ id: 'ggb', label: '📊 Enviar a GeoGebra', x: 20, y: 530, w: 576, h: 60 });
    bs.push({ id: 'medidas', label: '🧹 Borrar medidas', x: 606, y: 530, w: 274, h: 60 });
    return bs;
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
    ctx.fillText(`${st.numSolidos} cuerpos · ${st.numMedidas} medidas`, PANEL_W - 20, 32);

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
    ctx.fillText(`radio ${redondear(st.r)} m`, 230, 324);
    ctx.fillText(TIPO(st.tipo).alturaLibre ? `altura ${redondear(st.h)} m` : '—', 670, 324);
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

    const [modo, setModo] = useState('CONSTRUIR');       // CONSTRUIR | REGLA | MOVER
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

        const objetivosSolidos = () => [...mallasRef.current.values()];

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

        renderer.setAnimationLoop(() => {
            const dt = Math.min(reloj.getDelta(), 0.05);
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
    }, [solidos, seleccionado, etiquetas, transparente]);

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
    }, [medidas]);

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
            const st = {
                modo, tipo, n, r, h, etiquetas,
                numSolidos: estRef.current.solidos.length,
                numMedidas: estRef.current.medidas.length,
            };
            panel.userData.botones = botonesPanel(st);
            dibujarPanel(panel.userData.canvas.getContext('2d'), st, panel.userData.botones, panel.userData.hover);
            panel.userData.tex.needsUpdate = true;
        };
        accionesRef.current.repintarPanel = repintarPanel;
        repintarPanel();

        const pulsarBoton = (id) => {
            const [clave, valor] = id.split(':');
            switch (clave) {
                case 'tipo':  setTipo(valor); break;
                case 'lados': setN(parseInt(valor, 10)); break;
                case 'modo':  setModo(valor); fijarPuntoA(null); break;
                case 'r-': setR(v => clamp(redondear(v - PASO, 2), R_MIN, R_MAX)); break;
                case 'r+': setR(v => clamp(redondear(v + PASO, 2), R_MIN, R_MAX)); break;
                case 'h-': setH(v => clamp(redondear(v - PASO, 2), H_MIN, H_MAX)); break;
                case 'h+': setH(v => clamp(redondear(v + PASO, 2), H_MIN, H_MAX)); break;
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
            const hit = m.ultimoHit;
            if (!hit) return;
            const st = estRef.current;
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
    }, [modo, tipo, n, r, h, etiquetas, anadirSolido, anadirMedida, deshacer, vaciar, exportarAGeoGebra, fijarPuntoA]);

    // refrescar cabecera del panel cuando cambian los recuentos
    useEffect(() => { accionesRef.current.repintarPanel?.(); }, [solidos.length, medidas.length, seleccionado]);

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
                        {[['CONSTRUIR', '🏗️ Construir'], ['REGLA', '📏 Regla'], ['MOVER', '✋ Mover']].map(([m, l]) => (
                            <button key={m} onClick={() => { setModo(m); fijarPuntoA(null); }} style={est.btn(modo === m)}>{l}</button>
                        ))}
                    </div>

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
                </div>

                {/* ── LIENZO 3D ── */}
                <div ref={contRef} style={est.lienzo}>
                    <div ref={lienzoRef} style={{ position: 'absolute', inset: 0 }} />
                    <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(10,22,32,0.82)', border: '1px solid #234863', borderRadius: 10, padding: '8px 12px', fontSize: '0.78rem', pointerEvents: 'none', maxWidth: 360 }}>
                        {modo === 'CONSTRUIR' && '🏗️ Clic en el suelo para colocar el cuerpo. Clic en un cuerpo para seleccionarlo.'}
                        {modo === 'REGLA' && `📏 Clic en dos puntos para medir. ${esperandoB ? 'Marca el punto B.' : 'Marca el punto A.'}`}
                        {modo === 'MOVER' && '✋ Arrastra un cuerpo por el suelo para moverlo.'}
                        <div style={{ color: '#7fa7c4', marginTop: 4 }}>Rejilla: 1 casilla = 1 m (subdivisión 10 cm)</div>
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
