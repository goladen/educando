import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { X, Play, Trophy, Search, RefreshCw, Save, Target, ArrowLeft } from 'lucide-react';
import { db } from './firebase';
import { guardarRegistroLocal } from './utils/registrosLocales';
import { collection, query, where, getDocs, addDoc, orderBy, limit, doc, getDoc } from 'firebase/firestore';

// =====================================================================
//  BANCOS DE PREGUNTAS INTEGRADOS (modo libre, sin recurso de profesor)
//  q: enunciado · ok: respuesta correcta · mal: tres respuestas incorrectas
// =====================================================================
const BANCOS = {
    MATES: {
        nombre: 'Matemáticas', emoji: '➗', color: '#3498db',
        preguntas: [
            { q: '¿Cuál es un número primo?', ok: '3', mal: ['4', '6', '9'] },
            { q: '¿Cuánto es 7 × 8?', ok: '56', mal: ['54', '48', '64'] },
            { q: '¿Raíz cuadrada de 144?', ok: '12', mal: ['11', '14', '24'] },
            { q: '¿Cuál es múltiplo de 9?', ok: '81', mal: ['82', '76', '93'] },
            { q: '¿Cuánto es 2⁵?', ok: '32', mal: ['10', '25', '64'] },
            { q: '¿Cuál es un número par?', ok: '38', mal: ['37', '41', '55'] },
            { q: '¿Cuánto es 15 % de 200?', ok: '30', mal: ['15', '20', '35'] },
            { q: '¿Cuál es divisible por 3?', ok: '123', mal: ['124', '125', '127'] },
            { q: '¿Cuánto es 9 × 9?', ok: '81', mal: ['72', '89', '91'] },
            { q: '¿Cuál es el mcd de 12 y 18?', ok: '6', mal: ['3', '9', '36'] },
            { q: '¿Cuánto es 144 ÷ 12?', ok: '12', mal: ['11', '13', '14'] },
            { q: '¿Cuál es un número primo?', ok: '17', mal: ['15', '21', '27'] },
            { q: '¿Cuánto es 3⁴?', ok: '81', mal: ['12', '27', '64'] },
            { q: '¿Cuál es el 25 % de 80?', ok: '20', mal: ['15', '25', '40'] },
        ],
    },
    GEO: {
        nombre: 'Geografía', emoji: '🌍', color: '#27ae60',
        preguntas: [
            { q: '¿Capital de Francia?', ok: 'París', mal: ['Madrid', 'Bruselas', 'Praga'] },
            { q: '¿Capital de Italia?', ok: 'Roma', mal: ['Milán', 'Lisboa', 'Atenas'] },
            { q: '¿Capital de Alemania?', ok: 'Berlín', mal: ['Múnich', 'Viena', 'Varsovia'] },
            { q: '¿Capital de Portugal?', ok: 'Lisboa', mal: ['Oporto', 'Sevilla', 'Madrid'] },
            { q: '¿Capital de Reino Unido?', ok: 'Londres', mal: ['Dublín', 'Edimburgo', 'Oxford'] },
            { q: '¿Río más largo del mundo?', ok: 'Amazonas', mal: ['Nilo', 'Misisipi', 'Danubio'] },
            { q: '¿Continente del Sahara?', ok: 'África', mal: ['Asia', 'Oceanía', 'América'] },
            { q: '¿Océano más grande?', ok: 'Pacífico', mal: ['Atlántico', 'Índico', 'Ártico'] },
            { q: '¿Capital de Japón?', ok: 'Tokio', mal: ['Pekín', 'Seúl', 'Bangkok'] },
            { q: '¿País de la Torre Eiffel?', ok: 'Francia', mal: ['Italia', 'España', 'Bélgica'] },
            { q: '¿Cordillera de América del Sur?', ok: 'Andes', mal: ['Alpes', 'Himalaya', 'Urales'] },
            { q: '¿Capital de Egipto?', ok: 'El Cairo', mal: ['Argel', 'Túnez', 'Rabat'] },
            { q: '¿Isla más grande del mundo?', ok: 'Groenlandia', mal: ['Australia', 'Borneo', 'Madagascar'] },
        ],
    },
    ENG: {
        nombre: 'Inglés', emoji: '🇬🇧', color: '#e67e22',
        preguntas: [
            { q: '"Perro" en inglés', ok: 'Dog', mal: ['Cat', 'Cow', 'Duck'] },
            { q: '"Rojo" en inglés', ok: 'Red', mal: ['Blue', 'Green', 'Black'] },
            { q: 'Plural de "child"', ok: 'Children', mal: ['Childs', 'Childes', 'Childrens'] },
            { q: 'Pasado de "go"', ok: 'Went', mal: ['Goed', 'Gone', 'Goes'] },
            { q: '"Lunes" en inglés', ok: 'Monday', mal: ['Sunday', 'Manday', 'Moonday'] },
            { q: '"Manzana" en inglés', ok: 'Apple', mal: ['Orange', 'Grape', 'Pear'] },
            { q: 'Pasado de "eat"', ok: 'Ate', mal: ['Eated', 'Eaten', 'Eats'] },
            { q: '"Casa" en inglés', ok: 'House', mal: ['Horse', 'Hose', 'Mouse'] },
            { q: '"Número 3" en inglés', ok: 'Three', mal: ['Tree', 'Third', 'Thirty'] },
            { q: 'Artículo antes de "apple"', ok: 'An', mal: ['A', 'The', 'Any'] },
            { q: '"Feliz" en inglés', ok: 'Happy', mal: ['Angry', 'Hungry', 'Sad'] },
            { q: 'Pasado de "have"', ok: 'Had', mal: ['Haved', 'Has', 'Haven'] },
            { q: '"Agua" en inglés', ok: 'Water', mal: ['Wine', 'Milk', 'Water fall'] },
        ],
    },
    CIEN: {
        nombre: 'Ciencias', emoji: '🔬', color: '#9b59b6',
        preguntas: [
            { q: 'Símbolo químico del oro', ok: 'Au', mal: ['Ag', 'Go', 'Or'] },
            { q: 'Planeta más cercano al Sol', ok: 'Mercurio', mal: ['Venus', 'Marte', 'Tierra'] },
            { q: 'Gas que respiramos para vivir', ok: 'Oxígeno', mal: ['Nitrógeno', 'CO₂', 'Helio'] },
            { q: '¿Cuántos huesos tiene el adulto?', ok: '206', mal: ['201', '106', '306'] },
            { q: 'Órgano que bombea la sangre', ok: 'Corazón', mal: ['Pulmón', 'Hígado', 'Riñón'] },
            { q: 'Fuerza que nos atrae al suelo', ok: 'Gravedad', mal: ['Fricción', 'Magnetismo', 'Inercia'] },
            { q: 'Estado del agua a 0 °C', ok: 'Sólido', mal: ['Líquido', 'Gas', 'Plasma'] },
            { q: 'Animal mamífero', ok: 'Delfín', mal: ['Tiburón', 'Cocodrilo', 'Atún'] },
            { q: 'Fórmula del agua', ok: 'H₂O', mal: ['CO₂', 'O₂', 'HO₂'] },
            { q: 'Astro que ilumina el día', ok: 'Sol', mal: ['Luna', 'Marte', 'Venus'] },
            { q: 'Parte de la planta que hace fotosíntesis', ok: 'Hoja', mal: ['Raíz', 'Tallo', 'Flor'] },
            { q: 'Velocidad de la luz aprox.', ok: '300.000 km/s', mal: ['3.000 km/s', '30 km/s', '1.000 km/s'] },
        ],
    },
};

// =====================================================================
//  GENERADOR DE OPERACIONES MATEMÁTICAS (recursos PRO / PRO-BURBUJAS)
//  Portado de PikatronRun para soportar preguntas generadas por mathConfig.
// =====================================================================
const generarPreguntasMatematicas = (config) => {
    const questions = [];
    const count = parseInt(config.mathCount || 0);
    if (count <= 0) return [];

    const types = config.mathTypes || ['POSITIVOS'];
    const ops = config.mathOps || ['SUMA'];
    const min = parseInt(config.mathMin || 1);
    const max = parseInt(config.mathMax || 10);

    const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const getRandomFloat = (min, max) => (Math.random() * (max - min) + min).toFixed(1);
    const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
    const simplify = (n, d) => { const common = gcd(Math.abs(n), Math.abs(d)) || 1; return { n: n / common, d: d / common }; };

    for (let i = 0; i < count; i++) {
        const type = types[i % types.length];
        const op = ops[i % ops.length];
        let pObj = { pregunta: '', respuesta: '', incorrectas: [] };

        let a, b, res, labelA, labelB, operatorSymbol;
        let isFraction = type === 'FRACCIONES';
        let isDecimal = type === 'DECIMALES';
        let isNegative = type === 'NEGATIVOS';

        if (isFraction) {
            const n1 = getRandomInt(min, max); const d1 = getRandomInt(min, max) || 1;
            const n2 = getRandomInt(min, max); const d2 = getRandomInt(min, max) || 1;

            let resN, resD;
            if (op === 'SUMA') { operatorSymbol = '+'; resN = n1 * d2 + n2 * d1; resD = d1 * d2; }
            else if (op === 'RESTA') { operatorSymbol = '-'; resN = n1 * d2 - n2 * d1; resD = d1 * d2; }
            else if (op === 'MULT') { operatorSymbol = '·'; resN = n1 * n2; resD = d1 * d2; }
            else { operatorSymbol = ':'; resN = n1 * d2; resD = d1 * n2; }

            const simple = simplify(resN, resD || 1);
            if (simple.d < 0) { simple.n = -simple.n; simple.d = -simple.d; }

            pObj.pregunta = `${n1}/${d1} ${operatorSymbol} ${n2}/${d2}`;
            pObj.respuesta = `${simple.n}/${simple.d}`;
            pObj.incorrectas = [
                `${simple.n + 1}/${simple.d}`,
                `${simple.n}/${simple.d + 1}`,
                `${simple.d}/${simple.n}`
            ].filter(inc => inc !== pObj.respuesta);
        } else {
            const getVal = () => {
                let v = isDecimal ? parseFloat(getRandomFloat(min, max)) : getRandomInt(min, max);
                if (isNegative && Math.random() > 0.5) v = -v;
                return v;
            };
            a = getVal(); b = getVal();

            if (op === 'DIV') {
                if (b === 0) b = 1;
                if (!isDecimal) {
                    const resTemp = isNegative ? (Math.random() > 0.5 ? -getRandomInt(min, max) : getRandomInt(min, max)) : getRandomInt(min, max);
                    a = b * resTemp;
                }
            }

            if (op === 'SUMA') { operatorSymbol = '+'; res = a + b; }
            else if (op === 'RESTA') { operatorSymbol = '-'; res = a - b; }
            else if (op === 'MULT') { operatorSymbol = '·'; res = a * b; }
            else { operatorSymbol = ':'; res = a / b; }

            if (isDecimal || !Number.isInteger(res)) {
                res = parseFloat(res.toFixed(1));
                pObj.respuesta = String(res).replace('.', ',');
                labelA = String(a).replace('.', ',');
                labelB = String(b).replace('.', ',');
            } else {
                pObj.respuesta = String(res);
                labelA = String(a);
                labelB = String(b);
            }

            if (b < 0) labelB = `(${labelB})`;
            pObj.pregunta = `${labelA} ${operatorSymbol} ${labelB}`;

            pObj.incorrectas = [
                String(isDecimal ? (res + 1).toFixed(1).replace('.', ',') : res + 1),
                String(isDecimal ? (res - 1).toFixed(1).replace('.', ',') : res - 1),
                String(isDecimal ? (res + 10).toFixed(1).replace('.', ',') : res + 10)
            ];
        }
        questions.push(pObj);
    }
    return questions;
};

// =====================================================================
//  NORMALIZACIÓN DE PREGUNTAS (recursos de selección múltiple)
// =====================================================================
function normalizarPregunta(p) {
    if (!p) return null;
    const q = String(p.pregunta || p.q || p.enunciado || '').trim();
    const ok = String(p.respuesta ?? p.correcta ?? p.ok ?? p.a ?? '').trim();
    let mal = p.incorrectas || p.mal || p.distractores || [];
    if (!Array.isArray(mal)) mal = [];
    mal = mal.map(x => String(x).trim()).filter(x => x && x !== ok);
    // quitar duplicados
    mal = [...new Set(mal)].slice(0, 3);
    if (!q || !ok || mal.length < 1) return null;
    return { q, ok, mal };
}

// Convierte un recurso a lista de "hojas" jugables { nombreHoja, preguntas:[{q,ok,mal}] }
function recursoAHojas(recurso) {
    if (!recurso) return [];
    const config = recurso.config || {};
    // ¿El recurso genera preguntas matemáticas? (PRO / PRO-BURBUJAS con mathConfig)
    const esPro = recurso.tipo === 'PRO-BURBUJAS' || recurso.tipo === 'PRO' || parseInt(config.mathCount || 0) > 0;

    const construir = (preguntasManuales, mathConfig) => {
        let pool = (preguntasManuales || []).map(normalizarPregunta).filter(Boolean);
        if (esPro) {
            const generadas = generarPreguntasMatematicas(mathConfig || config).map(normalizarPregunta).filter(Boolean);
            pool = [...pool, ...generadas];
        }
        return pool;
    };

    if (Array.isArray(recurso.hojas) && recurso.hojas.length > 0) {
        return recurso.hojas
            .map(h => ({
                nombreHoja: h.nombreHoja || 'Hoja',
                preguntas: construir(h.preguntas, h.mathConfig),
            }))
            .filter(h => h.preguntas.length > 0);
    }
    const preguntas = construir(recurso.preguntas, null);
    return preguntas.length > 0 ? [{ nombreHoja: 'General', preguntas }] : [];
}

// =====================================================================
//  MOTOR DEL SHOOTER (Three.js) — se monta cuando gameState === 'PLAYING'
//  Devuelve una función de limpieza.
// =====================================================================
function montarMotor({ root, preguntasInput, onEnd, onScore }) {
    const VEL_ENEMIGO = 0.9;
    const CASTIGO_CORRECTA = 25;
    const ARENA = 22;
    const AMMO_MAX = 12;

    const IS_TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (IS_TOUCH) root.classList.add('touch');
    let SENS = 1;
    const ASSIST = IS_TOUCH;

    const $ = id => root.querySelector('#' + id);
    const disposeFns = [];
    const on = (el, ev, fn, opts) => { el.addEventListener(ev, fn, opts); disposeFns.push(() => el.removeEventListener(ev, fn, opts)); };

    // ===== Audio =====
    let actx = null;
    function audio() { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); return actx; }
    function beep({ f = 440, f2 = null, t = 0.1, type = 'square', vol = 0.15 }) {
        try {
            const c = audio(); const o = c.createOscillator(); const g = c.createGain();
            o.type = type; o.frequency.setValueAtTime(f, c.currentTime);
            if (f2) o.frequency.exponentialRampToValueAtTime(f2, c.currentTime + t);
            g.gain.setValueAtTime(vol, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + t);
            o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + t);
        } catch (e) { }
    }
    function noise(t = 0.08, vol = 0.25) {
        try {
            const c = audio(); const buf = c.createBuffer(1, c.sampleRate * t, c.sampleRate);
            const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
            const s = c.createBufferSource(); s.buffer = buf; const g = c.createGain(); g.gain.value = vol;
            const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
            s.connect(lp); lp.connect(g); g.connect(c.destination); s.start();
        } catch (e) { }
    }
    const SFX = {
        shoot: () => { noise(0.07, 0.3); beep({ f: 180, f2: 60, t: 0.08, type: 'sawtooth', vol: 0.12 }); },
        hit: () => beep({ f: 900, f2: 1200, t: 0.05, type: 'square', vol: 0.08 }),
        kill: () => { beep({ f: 300, f2: 80, t: 0.2, type: 'sawtooth', vol: 0.15 }); noise(0.15, 0.2); },
        hurt: () => beep({ f: 120, f2: 70, t: 0.25, type: 'triangle', vol: 0.2 }),
        reload: () => { beep({ f: 400, t: 0.05, type: 'square', vol: 0.08 }); setTimeout(() => beep({ f: 600, t: 0.06, type: 'square', vol: 0.08 }), 250); },
        empty: () => beep({ f: 200, t: 0.04, type: 'square', vol: 0.06 }),
        heal: () => beep({ f: 500, f2: 900, t: 0.2, type: 'sine', vol: 0.12 }),
        wave: () => { beep({ f: 220, t: 0.15, type: 'square', vol: 0.1 }); setTimeout(() => beep({ f: 330, t: 0.15, type: 'square', vol: 0.1 }), 150); setTimeout(() => beep({ f: 440, t: 0.25, type: 'square', vol: 0.1 }), 300); },
        boom: () => { noise(0.4, 0.4); beep({ f: 80, f2: 30, t: 0.4, type: 'sawtooth', vol: 0.2 }); },
    };

    // ===== Escena =====
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05070a);
    scene.fog = new THREE.Fog(0x05070a, 10, 46);
    const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 200);
    camera.position.set(0, 1.7, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: !IS_TOUCH, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, IS_TOUCH ? 1.5 : 2));
    renderer.setSize(innerWidth, innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
    if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
    if (!IS_TOUCH) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
    renderer.domElement.style.cssText = 'position:absolute;inset:0;z-index:0;display:block;';
    root.insertBefore(renderer.domElement, root.firstChild);
    const onResize = () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); };
    on(window, 'resize', onResize);

    scene.add(new THREE.AmbientLight(0x445566, 0.7));
    const key = new THREE.PointLight(0x7fffb0, 1.1, 34); key.position.set(0, 9, 0); scene.add(key);
    const sun = new THREE.DirectionalLight(0xbfe8ff, 0.5); sun.position.set(8, 12, 6); scene.add(sun);
    if (!IS_TOUCH) { sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); const sc = sun.shadow.camera; sc.left = sc.bottom = -26; sc.right = sc.top = 26; sc.near = 1; sc.far = 40; sun.shadow.bias = -0.002; }
    const rim = new THREE.PointLight(0xffb84d, 0.6, 40); rim.position.set(12, 4, -12); scene.add(rim);
    const rim2 = new THREE.PointLight(0x5b8bff, 0.5, 40); rim2.position.set(-12, 4, 12); scene.add(rim2);

    // ===== Texturas procedurales =====
    function makeTex(draw, size = 256, repeat = 1) {
        const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size);
        const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); return t;
    }
    const floorTex = makeTex((g, s) => {
        g.fillStyle = '#0e1418'; g.fillRect(0, 0, s, s);
        for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`; g.fillRect(Math.random() * s, Math.random() * s, 2, 2); }
        g.strokeStyle = '#1c2a2f'; g.lineWidth = 3; g.strokeRect(2, 2, s - 4, s - 4);
        g.strokeStyle = '#121a1e'; g.lineWidth = 1; g.beginPath(); g.moveTo(s / 2, 0); g.lineTo(s / 2, s); g.moveTo(0, s / 2); g.lineTo(s, s / 2); g.stroke();
        g.fillStyle = '#1a262b'; [[12, 12], [s - 20, 12], [12, s - 20], [s - 20, s - 20]].forEach(([x, y]) => { g.beginPath(); g.arc(x + 4, y + 4, 3, 0, 7); g.fill(); });
    }, 256, 22);
    const wallTex = makeTex((g, s) => {
        g.fillStyle = '#151d21'; g.fillRect(0, 0, s, s);
        for (let y = 0; y < s; y += 32) { for (let x = 0; x < s; x += 64) { const off = (y / 32) % 2 ? 32 : 0; g.fillStyle = `rgb(${18 + Math.random() * 6},${27 + Math.random() * 6},${31 + Math.random() * 6})`; g.fillRect(x + off + 1, y + 1, 62, 30); } }
        g.fillStyle = 'rgba(255,184,77,0.6)'; for (let x = 0; x < s; x += 40) { g.fillRect(x, s - 14, 20, 6); }
    }, 256, 1);
    const hazardTex = makeTex((g, s) => {
        g.fillStyle = '#1c2a2f'; g.fillRect(0, 0, s, s);
        g.fillStyle = '#ffb84d'; for (let i = -s; i < s * 2; i += 48) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 24, 0); g.lineTo(i + 24 - s, s); g.lineTo(i - s, s); g.fill(); }
    }, 128, 1);

    // ===== Arena =====
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ARENA * 2, ARENA * 2), new THREE.MeshStandardMaterial({ map: floorTex, roughness: .85, metalness: .15 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ARENA * 2, ARENA * 2), new THREE.MeshStandardMaterial({ color: 0x090d10, roughness: 1, side: THREE.DoubleSide }));
    ceil.rotation.x = Math.PI / 2; ceil.position.y = 6; scene.add(ceil);
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x1a2328, roughness: .7, metalness: .3 });
    for (let i = -ARENA + 4; i < ARENA; i += 8) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, ARENA * 2), beamMat); b.position.set(i, 5.75, 0); scene.add(b); const b2 = new THREE.Mesh(new THREE.BoxGeometry(ARENA * 2, 0.5, 0.4), beamMat); b2.position.set(0, 5.75, i); scene.add(b2); }
    for (let x = -14; x <= 14; x += 14) for (let z = -14; z <= 14; z += 14) {
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.5), new THREE.MeshBasicMaterial({ color: 0xd8fff0 })); lamp.position.set(x, 5.45, z); scene.add(lamp);
        const pl = new THREE.PointLight(0xa8ffd0, 0.35, 16); pl.position.set(x, 5.2, z); scene.add(pl);
    }

    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: .85 });
    const wallMeshes = [];
    [[0, -ARENA, ARENA * 2, 1], [0, ARENA, ARENA * 2, 1], [-ARENA, 0, 1, ARENA * 2], [ARENA, 0, 1, ARENA * 2]].forEach(([x, z, w, d]) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 6, d), wallMat); m.position.set(x, 3, z);
        m.material = wallMat.clone(); m.material.map = wallTex.clone(); m.material.map.repeat.set(Math.max(w, d) / 4, 1.5); m.material.map.needsUpdate = true; scene.add(m); wallMeshes.push(m);
    });
    const stripMat = new THREE.MeshBasicMaterial({ color: 0x7fffb0 });
    [[0, -ARENA + 0.55, ARENA * 2, 0.05], [0, ARENA - 0.55, ARENA * 2, 0.05], [-ARENA + 0.55, 0, 0.05, ARENA * 2], [ARENA - 0.55, 0, 0.05, ARENA * 2]].forEach(([x, z, w, d]) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), stripMat); m.position.set(x, 2.2, z); scene.add(m);
    });

    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1f2b31, roughness: .6, metalness: .5 });
    const covers = [];
    function addPillar(x, z) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 6, 8), pillarMat); p.position.set(x, 3, z); p.castShadow = true; scene.add(p);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.06, 6, 16), new THREE.MeshBasicMaterial({ color: 0x5b8bff })); ring.rotation.x = Math.PI / 2; ring.position.set(x, 1.2, z); scene.add(ring);
        covers.push({ mesh: p, hw: 1.1, hd: 1.1 });
    }
    [[-16, -16], [16, 16], [16, -16], [-16, 16]].forEach(([x, z]) => addPillar(x, z));

    const coverMat = new THREE.MeshStandardMaterial({ color: 0x1c2a2f, roughness: .8, metalness: .2 });
    const hazardMat = new THREE.MeshStandardMaterial({ map: hazardTex, roughness: .8 });
    [[-7, -5, 2, 2], [7, -5, 2, 2], [-7, 6, 2, 2], [7, 6, 2, 2], [0, -12, 5, 1.5], [0, 12, 5, 1.5], [-12, 0, 1.5, 5], [12, 0, 1.5, 5]].forEach(([x, z, w, d]) => {
        const c = new THREE.Mesh(new THREE.BoxGeometry(w, 2.2, d), [coverMat, coverMat, hazardMat, coverMat, coverMat, coverMat]); c.position.set(x, 1.1, z); c.castShadow = c.receiveShadow = true; scene.add(c);
        const edge = new THREE.LineSegments(new THREE.EdgesGeometry(c.geometry), new THREE.LineBasicMaterial({ color: 0x2e4a52 })); c.add(edge);
        covers.push({ mesh: c, hw: w / 2 + 0.5, hd: d / 2 + 0.5 });
    });

    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: .7, metalness: .3 });
    [[-3, -16], [-2.4, -16.8], [3, 15.5], [17, 3], [-17, -4], [-17, -3.2]].forEach(([x, z]) => {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.1, 10), barrelMat); b.position.set(x, 0.55, z); scene.add(b);
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 10), new THREE.MeshBasicMaterial({ color: 0xffb84d })); band.position.set(x, 0.55, z); scene.add(band);
        covers.push({ mesh: b, hw: 0.8, hd: 0.8 });
    });

    const dustGeo = new THREE.BufferGeometry(); const dustPos = [];
    for (let i = 0; i < 300; i++) dustPos.push((Math.random() * 2 - 1) * ARENA, Math.random() * 5.5, (Math.random() * 2 - 1) * ARENA);
    dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(dustPos, 3));
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0x9fd8c0, size: 0.06, transparent: true, opacity: .5 })); scene.add(dust);

    // ===== Arma =====
    const gun = new THREE.Group();
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x2a353b, roughness: .5, metalness: .4 });
    const mkPart = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
    gun.add(mkPart(new THREE.BoxGeometry(0.07, 0.07, 0.55), gunMat, 0, 0, -0.35));
    gun.add(mkPart(new THREE.BoxGeometry(0.12, 0.16, 0.3), gunMat, 0, -0.05, -0.05));
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.2, 0.1), gunMat); grip.position.set(0, -0.2, 0.05); grip.rotation.x = 0.3; gun.add(grip);
    gun.add(mkPart(new THREE.BoxGeometry(0.03, 0.03, 0.2), new THREE.MeshBasicMaterial({ color: 0x7fffb0 }), 0, 0.06, -0.15));
    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfff2a0 })); flash.position.set(0, 0, -0.65); flash.visible = false; gun.add(flash);
    gun.position.set(0.28, -0.28, -0.6);
    camera.add(gun); scene.add(camera);
    const muzzleLight = new THREE.PointLight(0xffe08a, 0, 8); scene.add(muzzleLight);
    let gunKick = 0, bob = 0;

    // ===== Estado =====
    let hp = 100, ammo = 12;
    let reloading = false, score = 0, wave = 1, gameOver = false, running = false;
    let shakeT = 0, shakeA = 0;
    const hpFill = $('hp-fill'), ammoTxt = $('ammo-txt'), scoreNum = $('score-num'), waveNum = $('wave-num'),
        hitFlash = $('hit-flash'), healFlash = $('heal-flash'), waveToast = $('wave-toast'), crosshair = $('crosshair'),
        lowhp = $('lowhp'), qEl = $('question'), clickHint = $('click-hint');

    function updateHUD() {
        hpFill.style.width = Math.max(0, hp) + '%';
        hpFill.style.background = hp > 35 ? '#7fffb0' : '#ff5b5b';
        lowhp.style.background = hp <= 35 ? 'radial-gradient(ellipse at center, transparent 45%, rgba(255,40,40,.45) 100%)' : 'radial-gradient(ellipse at center, transparent 50%, rgba(255,40,40,0) 100%)';
        ammoTxt.innerHTML = (reloading ? '··' : ammo) + `<small>/${AMMO_MAX}</small>`;
        scoreNum.textContent = score; waveNum.textContent = wave;
        onScore(score);
    }
    function toast(txt) { waveToast.textContent = txt; waveToast.style.opacity = 1; setTimeout(() => waveToast.style.opacity = 0, 1600); }
    function reload() {
        if (reloading || ammo === AMMO_MAX || gameOver || !running) return;
        reloading = true; SFX.reload(); updateHUD();
        setTimeout(() => { if (killed) return; ammo = AMMO_MAX; reloading = false; updateHUD(); }, 900);
    }

    // ===== Entrada =====
    // Teclado: ↑/↓ avanzar/retroceder · ←/→ girar · W/S subir/bajar mira · Espacio disparar · R recargar
    let pitch = 0, yaw = 0, tPitch = 0, tYaw = 0;
    const move = { f: false, b: false };
    const look = { l: false, r: false, up: false, down: false };
    let joyX = 0, joyY = 0;
    on(window, 'keydown', e => {
        switch (e.code) {
            case 'ArrowUp': move.f = true; e.preventDefault(); break;
            case 'ArrowDown': move.b = true; e.preventDefault(); break;
            case 'ArrowLeft': look.l = true; e.preventDefault(); break;
            case 'ArrowRight': look.r = true; e.preventDefault(); break;
            case 'KeyW': look.up = true; break;
            case 'KeyS': look.down = true; break;
            case 'Space': audio(); shoot(); e.preventDefault(); break;
            case 'KeyR': reload(); break;
        }
    });
    on(window, 'keyup', e => {
        switch (e.code) {
            case 'ArrowUp': move.f = false; break;
            case 'ArrowDown': move.b = false; break;
            case 'ArrowLeft': look.l = false; break;
            case 'ArrowRight': look.r = false; break;
            case 'KeyW': look.up = false; break;
            case 'KeyS': look.down = false; break;
        }
    });
    // Ratón / touchpad: arrastrar apunta (vertical = sube/baja mira, horizontal = gira). Clic corto = disparar.
    // Se enlaza a root (no al canvas) para que funcione también en portátiles táctiles donde la capa táctil tapa el canvas.
    let mDown = false, mLast = null, mMoved = 0, mStart = 0;
    on(root, 'mousedown', e => { if (e.target.closest('button')) return; audio(); mDown = true; mLast = { x: e.clientX, y: e.clientY }; mMoved = 0; mStart = performance.now(); e.preventDefault(); });
    on(window, 'mousemove', e => {
        if (!mDown) return;
        const dx = e.clientX - mLast.x, dy = e.clientY - mLast.y;
        tYaw -= dx * 0.004 * SENS;
        tPitch = Math.max(-1.3, Math.min(1.3, tPitch - dy * 0.004 * SENS));
        mMoved += Math.abs(dx) + Math.abs(dy);
        mLast = { x: e.clientX, y: e.clientY };
    });
    on(window, 'mouseup', () => { if (!mDown) return; mDown = false; if (mMoved < 6 && performance.now() - mStart < 250) shoot(); });
    if (clickHint && !IS_TOUCH) setTimeout(() => { if (clickHint) clickHint.style.opacity = '0'; }, 6500);

    if (IS_TOUCH) {
        const joyZone = $('joy-zone'), joyBase = $('joy-base'), joyKnob = $('joy-knob'), lookZone = $('look-zone'), fireBtn = $('fire-btn'), reloadBtn = $('reload-btn');
        let joyId = null, joyOrigin = null, lookId = null, lookLast = null;
        const R = 45;
        on(joyZone, 'touchstart', e => {
            const t = e.changedTouches[0]; joyId = t.identifier; joyOrigin = { x: t.clientX, y: t.clientY };
            joyBase.style.display = 'block'; joyBase.style.left = t.clientX + 'px'; joyBase.style.top = t.clientY + 'px'; e.preventDefault();
        }, { passive: false });
        on(joyZone, 'touchmove', e => {
            for (const t of e.changedTouches) if (t.identifier === joyId) {
                let dx = t.clientX - joyOrigin.x, dy = t.clientY - joyOrigin.y; const len = Math.hypot(dx, dy);
                if (len > R) { dx = dx / len * R; dy = dy / len * R; }
                joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
                const n = Math.min(1, len / R), curve = n < 0.12 ? 0 : Math.pow((n - 0.12) / 0.88, 1.4);
                const ln = Math.hypot(dx, dy) || 1; joyX = (dx / ln) * curve; joyY = (dy / ln) * curve;
            }
            e.preventDefault();
        }, { passive: false });
        const joyEnd = e => { for (const t of e.changedTouches) if (t.identifier === joyId) { joyId = null; joyX = joyY = 0; joyBase.style.display = 'none'; joyKnob.style.transform = 'translate(-50%,-50%)'; } };
        on(joyZone, 'touchend', joyEnd); on(joyZone, 'touchcancel', joyEnd);

        let lookStart = null, lookMoved = 0;
        on(lookZone, 'touchstart', e => { const t = e.changedTouches[0]; if (lookId === null) { lookId = t.identifier; lookLast = { x: t.clientX, y: t.clientY }; lookStart = performance.now(); lookMoved = 0; } e.preventDefault(); }, { passive: false });
        on(lookZone, 'touchmove', e => {
            for (const t of e.changedTouches) if (t.identifier === lookId) {
                tYaw -= (t.clientX - lookLast.x) * 0.0045 * SENS; tPitch = Math.max(-1.3, Math.min(1.3, tPitch - (t.clientY - lookLast.y) * 0.0045 * SENS));
                lookMoved += Math.abs(t.clientX - lookLast.x) + Math.abs(t.clientY - lookLast.y); lookLast = { x: t.clientX, y: t.clientY };
            }
            e.preventDefault();
        }, { passive: false });
        const lookEnd = e => { for (const t of e.changedTouches) if (t.identifier === lookId) { lookId = null; if (lookMoved < 8 && performance.now() - lookStart < 220) shoot(); } };
        on(lookZone, 'touchend', lookEnd); on(lookZone, 'touchcancel', lookEnd);

        let fireHold = false, fireTimer = null;
        on(fireBtn, 'touchstart', e => { e.preventDefault(); audio(); shoot(); fireHold = true; fireTimer = setInterval(() => { if (fireHold) shoot(); }, 220); }, { passive: false });
        const fireEnd = e => { e.preventDefault(); fireHold = false; clearInterval(fireTimer); };
        on(fireBtn, 'touchend', fireEnd); on(fireBtn, 'touchcancel', fireEnd);
        on(reloadBtn, 'touchstart', e => { e.preventDefault(); reload(); }, { passive: false });
        disposeFns.push(() => clearInterval(fireTimer));
    }

    // ===== Enemigos =====
    const GRUNT = { color: 0xd23c3c, glow: 0xff5b5b, hp: 30, speed: 1.6, scale: 1.0, dmg: 8, pts: 10 };
    const enemies = [];
    function buildEnemy(T) {
        const g = new THREE.Group();
        const armor = new THREE.MeshStandardMaterial({ color: T.color, roughness: .5, metalness: .35, emissive: T.color, emissiveIntensity: .15 });
        const dark = new THREE.MeshStandardMaterial({ color: 0x1a1f24, roughness: .8, metalness: .4 });
        const glowM = new THREE.MeshBasicMaterial({ color: T.glow });
        const part = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.45), armor); torso.position.y = 1.15; g.add(torso);
        part(new THREE.BoxGeometry(0.3, 0.25, 0.05), glowM, 0, 1.2, 0.25);
        part(new THREE.BoxGeometry(0.5, 0.3, 0.4), dark, 0, 0.65, 0);
        part(new THREE.BoxGeometry(0.42, 0.4, 0.42), dark, 0, 1.8, 0);
        part(new THREE.BoxGeometry(0.34, 0.1, 0.06), glowM, 0, 1.82, 0.22);
        const horn1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.25, 0.08), armor); horn1.position.set(-0.18, 2.05, 0); g.add(horn1);
        const horn2 = horn1.clone(); horn2.position.x = 0.18; g.add(horn2);
        const sh1 = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.5), armor); sh1.position.set(-0.48, 1.5, 0); g.add(sh1);
        const sh2 = sh1.clone(); sh2.position.x = 0.48; g.add(sh2);
        const mkArm = (side) => { const p = new THREE.Group(); p.position.set(0.48 * side, 1.45, 0); const a = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), dark); a.position.y = -0.4; p.add(a); const claw = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.24), armor); claw.position.y = -0.8; p.add(claw); g.add(p); return p; };
        const armL = mkArm(-1), armR = mkArm(1);
        const mkLeg = (side) => { const p = new THREE.Group(); p.position.set(0.18 * side, 0.55, 0); const l = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.55, 0.25), dark); l.position.y = -0.28; p.add(l); const boot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.34), armor); boot.position.set(0, -0.55, 0.04); p.add(boot); g.add(p); return p; };
        const legL = mkLeg(-1), legR = mkLeg(1);
        const blob = new THREE.Mesh(new THREE.CircleGeometry(0.55, 14), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .45 })); blob.rotation.x = -Math.PI / 2; blob.position.y = 0.02; g.add(blob);
        g.scale.setScalar(T.scale);
        g.traverse(o => { if (o.isMesh) o.castShadow = true; });
        return { g, limbs: { armL, armR, legL, legR }, flashable: [armor], glowM, height: 2.1 * T.scale };
    }
    function makeLabel(text) {
        const c = document.createElement('canvas'); const g = c.getContext('2d');
        g.font = 'bold 64px Courier New, monospace';
        const w = Math.max(160, g.measureText(text).width + 60); c.width = w; c.height = 100;
        g.fillStyle = 'rgba(5,7,10,0.88)'; g.fillRect(0, 0, w, 100);
        g.strokeStyle = '#7fffb0'; g.lineWidth = 5; g.strokeRect(3, 3, w - 6, 94);
        g.font = 'bold 64px Courier New, monospace'; g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(text, w / 2, 52);
        const tex = new THREE.CanvasTexture(c); tex.minFilter = THREE.LinearFilter;
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
        sp.scale.set(w / 100 * 0.9, 0.9, 1); sp.renderOrder = 10;
        return sp;
    }
    function spawnEnemy(answer, isCorrect, angle) {
        const T = GRUNT;
        const b = buildEnemy(T);
        const d = 15 + Math.random() * 3;
        b.g.position.set(Math.cos(angle) * d, 0, Math.sin(angle) * d);
        const label = makeLabel(answer); label.position.y = b.height + 0.5; b.g.add(label);
        scene.add(b.g);
        const e = { mesh: b.g, answer, isCorrect, hp: T.hp, speed: T.speed * VEL_ENEMIGO * (0.9 + Math.random() * 0.2), cd: Math.random() * 1.5, dmg: T.dmg, pts: T.pts, w: 0.7, limbs: b.limbs, flashable: b.flashable, glowM: b.glowM, color: T.glow, phase: Math.random() * 6, h: b.height };
        b.g.traverse(o => { if (o.isMesh) o.userData.enemy = e; });
        enemies.push(e);
    }

    // Preparar preguntas (baraja indices, tope 20)
    const PREGUNTAS = preguntasInput.slice(0, 20);
    let orden = PREGUNTAS.map((_, i) => i);
    for (let i = orden.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [orden[i], orden[j]] = [orden[j], orden[i]]; }
    $('wave-total').textContent = '/' + orden.length;
    let preguntaActual = null;

    function spawnWave() {
        if (wave > orden.length) { winGame(); return; }
        preguntaActual = PREGUNTAS[orden[wave - 1]];
        qEl.textContent = preguntaActual.q;
        let respuestas = [{ t: preguntaActual.ok, ok: true }, ...preguntaActual.mal.slice(0, 3).map(t => ({ t, ok: false }))];
        for (let i = respuestas.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [respuestas[i], respuestas[j]] = [respuestas[j], respuestas[i]]; }
        const n = respuestas.length;
        const base = Math.random() * Math.PI * 2;
        respuestas.forEach((r, i) => setTimeout(() => { if (!killed && running) spawnEnemy(r.t, r.ok, base + i * (Math.PI * 2 / n) + (Math.random() - .5) * 0.4); }, i * 300));
        toast('PREGUNTA ' + wave); SFX.wave();
    }
    function wrongLeft() { return enemies.filter(e => !e.isCorrect).length; }

    // ===== Botiquines =====
    const packs = [];
    function spawnPack() {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: 0x7fffb0, emissive: 0x2a8f5a, emissiveIntensity: .8 }));
        m.position.set((Math.random() * 2 - 1) * (ARENA - 4), 0.5, (Math.random() * 2 - 1) * (ARENA - 4));
        scene.add(m); packs.push(m);
    }

    // ===== Partículas / disparo =====
    const parts = [];
    function burst(pos, color) {
        for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), new THREE.MeshBasicMaterial({ color })); m.position.copy(pos); parts.push({ mesh: m, v: new THREE.Vector3((Math.random() - .5) * 6, Math.random() * 5, (Math.random() - .5) * 6), life: 0.7 }); scene.add(m); }
    }
    const raycaster = new THREE.Raycaster();
    const tracers = [];
    function tracer(from, to) {
        const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
        const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xd8ffea, transparent: true, opacity: .9 }));
        scene.add(l); tracers.push({ l, life: 0.08 });
    }
    function sparks(pos, color) {
        for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), new THREE.MeshBasicMaterial({ color })); m.position.copy(pos); parts.push({ mesh: m, v: new THREE.Vector3((Math.random() - .5) * 4, Math.random() * 3, (Math.random() - .5) * 4), life: 0.35 }); scene.add(m); }
    }
    function impactoEnemigo(e, point) {
        if (e.isCorrect) {
            SFX.hurt(); damagePlayer(CASTIGO_CORRECTA); toast('¡ESA ERA LA CORRECTA!');
            e.flashable.forEach(m => { m.emissive.setHex(0x7fffb0); m.emissiveIntensity = 1.5; }); setTimeout(() => e.flashable.forEach(m => { m.emissive.setHex(GRUNT.color); m.emissiveIntensity = .15; }), 250);
        } else {
            e.hp -= 15; SFX.hit(); sparks(point, 0xff5b5b);
            crosshair.classList.add('hit'); setTimeout(() => crosshair.classList.remove('hit'), 90);
            e.flashable.forEach(m => m.emissiveIntensity = 1.6); setTimeout(() => e.flashable.forEach(m => m.emissiveIntensity = .15), 90);
            if (e.hp <= 0) killEnemy(e);
        }
    }
    function shoot() {
        if (gameOver || !running || reloading) return;
        if (ammo <= 0) { SFX.empty(); return; }
        ammo--; SFX.shoot(); updateHUD();
        gunKick = 1; flash.visible = true; setTimeout(() => { flash.visible = false; }, 50);
        muzzleLight.position.copy(camera.position); muzzleLight.intensity = 2.5; setTimeout(() => muzzleLight.intensity = 0, 60);
        raycaster.setFromCamera({ x: 0, y: 0 }, camera);
        const ray = raycaster.ray;
        const hits = raycaster.intersectObjects(enemies.map(e => e.mesh), true);
        const wallHits = raycaster.intersectObjects(covers.map(c => c.mesh).concat(wallMeshes), false);
        const wallDist = wallHits.length ? wallHits[0].distance : Infinity;

        let hitEnemy = null, hitPoint = null, hitDist = Infinity;
        if (hits.length) { hitEnemy = hits[0].object.userData.enemy; hitPoint = hits[0].point; hitDist = hits[0].distance; }
        else {
            // Tolerancia de puntería: impacta al enemigo cuyo cuerpo pase muy cerca del rayo
            // (radio angular ~constante en pantalla, así que ayuda sobre todo a distancia).
            let best = null, bestT = Infinity, bestPoint = null;
            enemies.forEach(e => {
                if (e.leaving) return;
                const c = new THREE.Vector3(e.mesh.position.x, e.h * 0.6, e.mesh.position.z);
                const toC = c.clone().sub(ray.origin);
                const t = toC.dot(ray.direction);
                if (t <= 0) return;
                const closest = ray.origin.clone().addScaledVector(ray.direction, t);
                const d = closest.distanceTo(c);
                const radio = 0.55 * (e.mesh.scale.x || 1) + t * 0.03; // tolerancia crece con la distancia
                if (d < radio && t < bestT) { best = e; bestT = t; bestPoint = closest; }
            });
            if (best) { hitEnemy = best; hitPoint = bestPoint; hitDist = bestT; }
        }
        // Si hay una pared más cerca que el enemigo, el disparo queda tapado
        if (hitEnemy && hitDist > wallDist) hitEnemy = null;

        const muzzle = new THREE.Vector3(0.28, -0.2, -1.1).applyMatrix4(camera.matrixWorld);
        const endPt = hitEnemy ? hitPoint : (wallHits.length ? wallHits[0].point : ray.at(60, new THREE.Vector3()));
        tracer(muzzle, endPt);
        if (!hitEnemy && wallHits.length) sparks(wallHits[0].point, 0xffb84d);
        if (hitEnemy) impactoEnemigo(hitEnemy, hitPoint);
        if (ammo === 0) setTimeout(reload, 150);
    }
    function killEnemy(e) {
        burst(e.mesh.position.clone().setY(e.h * 0.5), e.color);
        scene.remove(e.mesh); enemies.splice(enemies.indexOf(e), 1);
        score += e.pts; SFX.kill(); updateHUD();
        if (Math.random() < 0.15 && packs.length < 2) spawnPack();
        if (wrongLeft() === 0 && running) {
            enemies.forEach(c => { c.flashable.forEach(m => { m.emissive.setHex(0x7fffb0); m.emissiveIntensity = 1.2; }); c.leaving = true; });
            toast('¡CORRECTO: ' + preguntaActual.ok.toUpperCase() + '!');
            setTimeout(() => { if (killed) return; enemies.forEach(c => scene.remove(c.mesh)); enemies.length = 0; wave++; spawnWave(); }, 1600);
        }
    }
    function damagePlayer(n) {
        hp -= n; SFX.hurt(); shakeT = 0.25; shakeA = 0.04;
        hitFlash.style.background = 'rgba(255,60,60,.4)'; setTimeout(() => hitFlash.style.background = 'rgba(255,60,60,0)', 130);
        updateHUD();
        if (hp <= 0 && !gameOver) endGame();
    }

    // ===== Bucle =====
    const clock = new THREE.Clock(); const SPEED = 5.5;
    function collides(x, z) {
        for (const c of covers) if (Math.abs(x - c.mesh.position.x) < c.hw && Math.abs(z - c.mesh.position.z) < c.hd) return true;
        return false;
    }
    let killed = false, rafId = 0;
    const mmC = $('minimap'), mm = mmC.getContext('2d');
    function drawMinimap() {
        const S = mmC.width, k = S / (ARENA * 2);
        mm.clearRect(0, 0, S, S);
        mm.fillStyle = 'rgba(28,42,47,.9)';
        covers.forEach(c => mm.fillRect((c.mesh.position.x - c.hw + 0.5 + ARENA) * k, (c.mesh.position.z - c.hd + 0.5 + ARENA) * k, (c.hw - 0.5) * 2 * k, (c.hd - 0.5) * 2 * k));
        packs.forEach(p => { mm.fillStyle = '#7fffb0'; mm.fillRect((p.position.x + ARENA) * k - 2, (p.position.z + ARENA) * k - 2, 4, 4); });
        enemies.forEach(e => { mm.fillStyle = '#' + e.color.toString(16).padStart(6, '0'); mm.beginPath(); mm.arc((e.mesh.position.x + ARENA) * k, (e.mesh.position.z + ARENA) * k, 2.6, 0, 7); mm.fill(); });
        const px = (camera.position.x + ARENA) * k, pz = (camera.position.z + ARENA) * k;
        mm.save(); mm.translate(px, pz); mm.rotate(-yaw);
        mm.fillStyle = '#e7f3ec'; mm.beginPath(); mm.moveTo(0, -7); mm.lineTo(5, 5); mm.lineTo(0, 2); mm.lineTo(-5, 5); mm.closePath(); mm.fill();
        mm.strokeStyle = 'rgba(231,243,236,.25)'; mm.beginPath(); mm.moveTo(0, 0); mm.lineTo(-14, -28); mm.lineTo(14, -28); mm.closePath(); mm.stroke();
        mm.restore();
        mm.strokeStyle = '#2e4a52'; mm.strokeRect(0.5, 0.5, S - 1, S - 1);
    }
    function animate() {
        if (killed) return;
        rafId = requestAnimationFrame(animate);
        const dt = Math.min(clock.getDelta(), 0.05);
        // Giro y mira por teclado (flechas ←/→ giran, W/S suben/bajan) — coexiste con el táctil
        if (running && !gameOver) {
            const TURN = 2.0 * SENS, AIM = 1.5 * SENS;
            if (look.l) tYaw += TURN * dt;
            if (look.r) tYaw -= TURN * dt;
            if (look.up) tPitch = Math.min(1.3, tPitch + AIM * dt);
            if (look.down) tPitch = Math.max(-1.3, tPitch - AIM * dt);
        }
        const sm = 1 - Math.pow(0.001, dt);
        yaw += (tYaw - yaw) * sm; pitch += (tPitch - pitch) * sm;
        if (ASSIST && running && !gameOver) {
            let best = null, bestA = 0.14;
            enemies.forEach(e => { if (e.leaving) return; const v = new THREE.Vector3(e.mesh.position.x, e.h * 0.55, e.mesh.position.z).sub(camera.position); const d = v.length(); const fw = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ')); const ang = fw.angleTo(v); if (ang < bestA && d < 18) { best = v; bestA = ang; } });
            if (best) { const ty = Math.atan2(-best.x, -best.z), tp = Math.atan2(best.y, Math.hypot(best.x, best.z)); let dy = ty - yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); tYaw += dy * dt * 2.2; yaw += dy * dt * 2.2; tPitch += (tp - pitch) * dt * 1.5; pitch += (tp - pitch) * dt * 1.5; }
        }
        camera.rotation.set(pitch, yaw, 0, 'YXZ');

        if (running && !gameOver) {
            const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)), right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
            const dir = new THREE.Vector3();
            if (move.f) dir.add(fwd); if (move.b) dir.sub(fwd);
            if (IS_TOUCH) { dir.add(fwd.clone().multiplyScalar(-joyY)); dir.add(right.clone().multiplyScalar(joyX)); }
            const moving = dir.lengthSq() > 0.01;
            if (dir.lengthSq() > 1) dir.normalize();
            const step = dir.multiplyScalar(SPEED * dt);
            let nx = Math.max(-ARENA + 1.2, Math.min(ARENA - 1.2, camera.position.x + step.x));
            let nz = Math.max(-ARENA + 1.2, Math.min(ARENA - 1.2, camera.position.z + step.z));
            if (!collides(nx, camera.position.z)) camera.position.x = nx;
            if (!collides(camera.position.x, nz)) camera.position.z = nz;

            bob += (moving ? dt * 10 : 0);
            gunKick = Math.max(0, gunKick - dt * 8);
            gun.position.set(0.28 + Math.sin(bob) * 0.012, -0.28 + Math.abs(Math.cos(bob)) * 0.015 + gunKick * 0.06, -0.6 + gunKick * 0.12);
            gun.rotation.x = gunKick * 0.35;
            if (shakeT > 0) { shakeT -= dt; camera.position.y = 1.7 + (Math.random() - .5) * shakeA; } else camera.position.y = 1.7;

            enemies.forEach(e => {
                if (e.leaving) { e.mesh.position.y += dt * 3; e.mesh.rotation.y += dt * 6; return; }
                const to = new THREE.Vector3(camera.position.x - e.mesh.position.x, 0, camera.position.z - e.mesh.position.z);
                const dist = to.length();
                const stopDist = e.isCorrect ? 4 : 1.5 + e.w * 0.5;
                if (dist > stopDist) {
                    to.normalize();
                    enemies.forEach(o => { if (o !== e) { const dx = e.mesh.position.x - o.mesh.position.x, dz = e.mesh.position.z - o.mesh.position.z, d = Math.hypot(dx, dz); if (d < 1.4 && d > 0.01) { to.x += dx / d * 0.6; to.z += dz / d * 0.6; } } });
                    to.normalize();
                    const nx = e.mesh.position.x + to.x * e.speed * dt, nz = e.mesh.position.z + to.z * e.speed * dt;
                    if (!collides(nx, e.mesh.position.z)) e.mesh.position.x = nx; else e.mesh.position.z += (Math.random() - .5) * e.speed * dt * 2;
                    if (!collides(e.mesh.position.x, nz)) e.mesh.position.z = nz; else e.mesh.position.x += (Math.random() - .5) * e.speed * dt * 2;
                    e.mesh.lookAt(camera.position.x, 0, camera.position.z);
                    e.phase += dt * e.speed * 5;
                    const s = Math.sin(e.phase);
                    e.limbs.legL.rotation.x = s * 0.7; e.limbs.legR.rotation.x = -s * 0.7;
                    e.limbs.armL.rotation.x = -s * 0.6; e.limbs.armR.rotation.x = s * 0.6;
                    e.mesh.position.y = Math.abs(s) * 0.04;
                } else if (e.isCorrect) {
                    e.limbs.legL.rotation.x = e.limbs.legR.rotation.x = 0;
                    e.limbs.armL.rotation.x = e.limbs.armR.rotation.x = 0;
                    e.mesh.lookAt(camera.position.x, 0, camera.position.z);
                } else {
                    e.cd -= dt;
                    e.limbs.legL.rotation.x = e.limbs.legR.rotation.x = 0;
                    const t = Math.max(0, 1 - e.cd / 1.3);
                    e.limbs.armL.rotation.x = e.limbs.armR.rotation.x = -2.2 + Math.sin(t * Math.PI) * 2.4;
                    if (e.cd <= 0) { damagePlayer(e.dmg); e.cd = 1.3; }
                }
            });

            for (let i = packs.length - 1; i >= 0; i--) {
                const p = packs[i]; p.rotation.y += dt * 2; p.position.y = 0.5 + Math.sin(performance.now() * 0.004) * 0.12;
                if (p.position.distanceTo(camera.position) < 1.4) {
                    hp = Math.min(100, hp + 35); SFX.heal(); updateHUD();
                    healFlash.style.background = 'rgba(127,255,176,.25)'; setTimeout(() => healFlash.style.background = 'rgba(127,255,176,0)', 200);
                    scene.remove(p); packs.splice(i, 1);
                }
            }
        }

        for (let i = tracers.length - 1; i >= 0; i--) { const t = tracers[i]; t.life -= dt; t.l.material.opacity = Math.max(0, t.life / 0.08); if (t.life <= 0) { scene.remove(t.l); tracers.splice(i, 1); } }
        for (let i = parts.length - 1; i >= 0; i--) {
            const p = parts[i]; p.life -= dt; p.v.y -= 12 * dt;
            p.mesh.position.addScaledVector(p.v, dt); p.mesh.scale.setScalar(Math.max(0.01, p.life / 0.7));
            if (p.life <= 0) { scene.remove(p.mesh); parts.splice(i, 1); }
        }
        dust.rotation.y += dt * 0.01;
        drawMinimap();
        renderer.render(scene, camera);
    }

    function winGame() {
        gameOver = true; running = false; SFX.wave();
        if (document.pointerLockElement) document.exitPointerLock();
        onEnd({ win: true, score, total: orden.length, alcanzada: orden.length });
    }
    function endGame() {
        gameOver = true; running = false; SFX.boom();
        if (document.pointerLockElement) document.exitPointerLock();
        onEnd({ win: false, score, total: orden.length, alcanzada: wave });
    }

    // Arrancar
    updateHUD();
    running = true;
    spawnWave();
    animate();

    // ===== Limpieza =====
    return () => {
        killed = true;
        cancelAnimationFrame(rafId);
        disposeFns.forEach(fn => { try { fn(); } catch (e) { } });
        if (document.pointerLockElement) document.exitPointerLock();
        try { renderer.dispose(); } catch (e) { }
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
        try { if (actx) actx.close(); } catch (e) { }
    };
}

// =====================================================================
//  ESTILOS DEL HUD
// =====================================================================
const HUD_CSS = `
.bunker-root { position:fixed; inset:0; background:#05070a; font-family:'Courier New', monospace; overflow:hidden; touch-action:none; z-index:9998; }
.bunker-root * { -webkit-tap-highlight-color:transparent; box-sizing:border-box; }
.bunker-root #hud { position:absolute; inset:0; pointer-events:none; color:#c7d0d6; user-select:none; z-index:5; }
.bunker-root #crosshair { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:22px; height:22px; }
.bunker-root #crosshair::before, .bunker-root #crosshair::after { content:''; position:absolute; background:#7fffb0; }
.bunker-root #crosshair::before { top:10px; left:0; width:22px; height:2px; }
.bunker-root #crosshair::after  { top:0; left:10px; width:2px; height:22px; }
.bunker-root #crosshair.hit::before, .bunker-root #crosshair.hit::after { background:#ffb84d; }
.bunker-root #stats { position:absolute; bottom:max(20px, env(safe-area-inset-bottom)); left:50%; transform:translateX(-50%); display:flex; gap:22px; align-items:flex-end; }
.bunker-root .stat { display:flex; flex-direction:column; gap:4px; align-items:center; }
.bunker-root .stat-label { font-size:10px; letter-spacing:2px; color:#5c6b70; }
.bunker-root .bar-track { width:120px; height:8px; background:#12181b; border:1px solid #263238; }
.bunker-root .bar-fill { height:100%; background:#7fffb0; transition:width .12s linear; }
.bunker-root #ammo-txt { font-size:22px; color:#ffb84d; line-height:1; }
.bunker-root #ammo-txt small { font-size:11px; color:#5c6b70; }
.bunker-root #score { position:absolute; top:max(14px, env(safe-area-inset-top)); right:18px; font-size:11px; letter-spacing:2px; color:#7fffb0; text-align:right; }
.bunker-root #score .num { font-size:26px; display:block; color:#e7f3ec; }
.bunker-root #wave-banner { position:absolute; top:max(14px, env(safe-area-inset-top)); left:60px; font-size:11px; letter-spacing:3px; color:#5c6b70; }
.bunker-root #wave-banner b { color:#e7f3ec; font-weight:normal; }
.bunker-root #minimap { position:absolute; top:max(70px, calc(env(safe-area-inset-top) + 56px)); right:18px; width:120px; height:120px; border:1px solid #263238; background:rgba(5,7,10,.75); border-radius:4px; }
.bunker-root.touch #minimap { width:90px; height:90px; }
.bunker-root #question { position:absolute; top:max(44px, calc(env(safe-area-inset-top) + 30px)); left:50%; transform:translateX(-50%); max-width:70vw; text-align:center; font-size:clamp(14px,3.2vw,22px); letter-spacing:1px; color:#e7f3ec; background:rgba(5,7,10,.6); border:1px solid #263238; padding:8px 16px; border-radius:4px; }
.bunker-root #question::before { content:''; display:block; width:40px; height:2px; background:#7fffb0; margin:0 auto 6px; }
.bunker-root #wave-toast { position:absolute; top:22%; left:50%; transform:translateX(-50%); font-size:22px; letter-spacing:6px; color:#7fffb0; opacity:0; transition:opacity .3s; text-shadow:0 0 18px rgba(127,255,176,.5); text-align:center; }
.bunker-root #hit-flash, .bunker-root #heal-flash { position:absolute; inset:0; pointer-events:none; }
.bunker-root #hit-flash { background:rgba(255,60,60,0); transition:background .13s; }
.bunker-root #heal-flash { background:rgba(127,255,176,0); transition:background .2s; }
.bunker-root #vignette { position:absolute; inset:0; pointer-events:none; background:radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,.55) 100%); }
.bunker-root #lowhp { position:absolute; inset:0; pointer-events:none; transition:background .3s; }
.bunker-root #touch { position:absolute; inset:0; display:none; }
.bunker-root.touch #touch { display:block; }
.bunker-root #joy-zone { position:absolute; left:0; bottom:0; width:45%; height:60%; pointer-events:all; }
.bunker-root #look-zone { position:absolute; right:0; bottom:0; width:55%; height:75%; pointer-events:all; }
.bunker-root #joy-base { position:absolute; width:110px; height:110px; border-radius:50%; border:1px solid rgba(127,255,176,.35); background:rgba(127,255,176,.05); display:none; transform:translate(-50%,-50%); }
.bunker-root #joy-knob { position:absolute; width:46px; height:46px; border-radius:50%; background:rgba(127,255,176,.55); left:50%; top:50%; transform:translate(-50%,-50%); }
.bunker-root #fire-btn { position:absolute; right:22px; bottom:max(95px, calc(env(safe-area-inset-bottom) + 85px)); width:84px; height:84px; border-radius:50%; border:2px solid #ff5b5b; background:rgba(255,91,91,.12); color:#ff5b5b; font-family:inherit; font-size:11px; letter-spacing:2px; pointer-events:all; }
.bunker-root #fire-btn:active { background:rgba(255,91,91,.4); }
.bunker-root #reload-btn { position:absolute; right:118px; bottom:max(105px, calc(env(safe-area-inset-bottom) + 95px)); width:54px; height:54px; border-radius:50%; border:1px solid #ffb84d; background:rgba(255,184,77,.1); color:#ffb84d; font-family:inherit; font-size:10px; letter-spacing:1px; pointer-events:all; }
.bunker-root #reload-btn:active { background:rgba(255,184,77,.35); }
.bunker-root #click-hint { position:absolute; bottom:14%; left:50%; transform:translateX(-50%); max-width:90vw; text-align:center; font-size:11px; letter-spacing:1px; color:#7fffb0; background:rgba(5,7,10,.6); border:1px solid #263238; padding:8px 16px; border-radius:4px; transition:opacity .6s; }
.bunker-root.touch #click-hint { display:none; }
.bunker-root #bunker-exit { position:absolute; top:max(12px, env(safe-area-inset-top)); left:12px; z-index:10; pointer-events:all; background:rgba(5,7,10,.6); border:1px solid #263238; color:#c7d0d6; width:36px; height:36px; border-radius:6px; display:flex; align-items:center; justify-content:center; cursor:pointer; }
.bunker-root #bunker-exit:hover { border-color:#7fffb0; color:#7fffb0; }
`;

// =====================================================================
//  COMPONENTE PRINCIPAL
// =====================================================================
export default function BunkerDisparo({ recurso = null, onExit, usuario, autoStart = false }) {
    const [gameState, setGameState] = useState('MENU'); // MENU | PLAYING | WIN | GAMEOVER
    const [score, setScore] = useState(0);
    const [resultado, setResultado] = useState({ win: false, alcanzada: 0, total: 0 });
    const [fuente, setFuente] = useState({ titulo: 'Modo Libre', categoria: 'General', recursoId: null });

    const rootRef = useRef(null);
    const preguntasRef = useRef([]);
    const cleanupRef = useRef(null);

    // Ranking / envío
    const [verRanking, setVerRanking] = useState(false);
    const [mostrarEnvio, setMostrarEnvio] = useState(false);
    const [nombreInvitado, setNombreInvitado] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [yaGuardado, setYaGuardado] = useState(false);

    const ultimoInicioRef = useRef(null); // para reiniciar la misma partida

    // Empezar partida con un set de preguntas ya normalizadas
    const empezar = ({ preguntas, titulo, categoria, recursoId }, saltarTutorial = false) => {
        if (!preguntas || preguntas.length === 0) { alert('Ese conjunto no tiene preguntas jugables (necesitan enunciado, respuesta y al menos una incorrecta).'); return; }
        ultimoInicioRef.current = { preguntas, titulo, categoria, recursoId };
        preguntasRef.current = preguntas;
        setFuente({ titulo, categoria, recursoId });
        setScore(0);
        setYaGuardado(false);
        setNombreInvitado('');
        setGameState(saltarTutorial ? 'PLAYING' : 'TUTORIAL');
    };

    // Auto-arranque desde deep-link con recurso (va directo al juego)
    useEffect(() => {
        if (autoStart && recurso && gameState === 'MENU') {
            const hojas = recursoAHojas(recurso);
            const preguntas = hojas.flatMap(h => h.preguntas);
            empezar({ preguntas, titulo: recurso.titulo || 'Recurso', categoria: 'General', recursoId: recurso.id }, true);
        }
        // eslint-disable-next-line
    }, [autoStart, recurso]);

    // Montaje del motor Three.js
    useEffect(() => {
        if (gameState !== 'PLAYING' || !rootRef.current) return;
        const cleanup = montarMotor({
            root: rootRef.current,
            preguntasInput: preguntasRef.current,
            onScore: (s) => setScore(s),
            onEnd: ({ win, score: sc, alcanzada, total }) => {
                setScore(sc);
                setResultado({ win, alcanzada, total });
                setGameState(win ? 'WIN' : 'GAMEOVER');
            },
        });
        cleanupRef.current = cleanup;
        return () => { if (cleanupRef.current) cleanupRef.current(); cleanupRef.current = null; };
    }, [gameState]);

    const reiniciar = () => { if (ultimoInicioRef.current) empezar(ultimoInicioRef.current, true); };
    const volverMenu = () => { setGameState('MENU'); setScore(0); };

    // --- Guardar puntuación en ranking ---
    const guardarPuntuacion = async () => {
        if (guardando || yaGuardado) return;
        const esInvitado = !usuario || !usuario.email;
        const nombreFinal = esInvitado ? nombreInvitado.trim() : (usuario.displayName || 'Jugador');
        if (esInvitado && !nombreFinal) { alert('Introduce un nombre para el ranking.'); return; }
        setGuardando(true);
        try {
            await addDoc(collection(db, 'ranking'), {
                recursoId: fuente.recursoId || ('libre-' + fuente.categoria),
                recursoTitulo: fuente.titulo,
                tipoJuego: 'BUNKER',
                jugador: nombreFinal,
                email: esInvitado ? 'invitado' : usuario.email,
                aciertos: score,
                fecha: new Date(),
                categoria: fuente.categoria || 'General',
            });
            guardarRegistroLocal('BUNKER', { titulo: fuente.titulo, aciertos: score, nombre: nombreFinal, via: 'ranking' });
            setYaGuardado(true);
            alert('¡Puntuación guardada!');
        } catch (e) { console.error(e); alert('Error al guardar.'); }
        setGuardando(false);
    };

    // ================= PANTALLA MENÚ =================
    if (gameState === 'MENU') {
        return (
            <MenuBunker
                recurso={recurso}
                onExit={onExit}
                onEmpezar={empezar}
            />
        );
    }

    // ================= TUTORIAL (saltable) =================
    if (gameState === 'TUTORIAL') {
        return (
            <TutorialBunker
                onStart={() => setGameState('PLAYING')}
                onVolver={() => setGameState('MENU')}
            />
        );
    }

    // ================= JUEGO + OVERLAYS =================
    return (
        <div ref={rootRef} className="bunker-root">
            <style>{HUD_CSS}</style>
            {/* HUD en juego (el motor busca estos ids por querySelector) */}
            <div id="hud">
                <div id="vignette"></div>
                <div id="lowhp"></div>
                <div id="hit-flash"></div>
                <div id="heal-flash"></div>
                <div id="crosshair"></div>
                <div id="wave-banner">PREGUNTA <b id="wave-num">1</b><span id="wave-total"></span></div>
                <div id="question"></div>
                <div id="wave-toast"></div>
                <div id="score">BAJAS<span className="num" id="score-num">0</span></div>
                <div id="click-hint">↑↓ MOVER · ←→ GIRAR · ARRASTRA EL RATÓN = APUNTAR · ESPACIO/CLIC DISPARAR · R RECARGAR</div>
                <canvas id="minimap" width="140" height="140"></canvas>
                <div id="stats">
                    <div className="stat">
                        <div className="stat-label">VIDA</div>
                        <div className="bar-track"><div id="hp-fill" className="bar-fill" style={{ width: '100%' }}></div></div>
                    </div>
                    <div className="stat">
                        <div className="stat-label">MUNICIÓN</div>
                        <div id="ammo-txt">12<small>/12</small></div>
                    </div>
                </div>
                <div id="touch">
                    <div id="joy-zone"><div id="joy-base"><div id="joy-knob"></div></div></div>
                    <div id="look-zone"></div>
                    <button id="reload-btn">R</button>
                    <button id="fire-btn">FUEGO</button>
                </div>
            </div>
            <button id="bunker-exit" title="Salir" onClick={() => onExit && onExit()}><X size={20} /></button>

            {/* OVERLAYS DE FIN */}
            {(gameState === 'WIN' || gameState === 'GAMEOVER') && (
                <div style={overlayStyle}>
                    {gameState === 'WIN' ? <Trophy size={72} color="#7fffb0" style={{ marginBottom: 16 }} /> : <Target size={72} color="#ff5b5b" style={{ marginBottom: 16 }} />}
                    <h1 style={{ color: gameState === 'WIN' ? '#7fffb0' : '#ff5b5b', fontFamily: 'monospace', fontSize: '2.6rem', letterSpacing: 4, margin: 0, textShadow: '0 0 24px rgba(127,255,176,.3)' }}>
                        {gameState === 'WIN' ? 'MISIÓN CUMPLIDA' : 'HAS CAÍDO'}
                    </h1>
                    <p style={{ color: '#a7b6bb', fontFamily: 'monospace', margin: '14px 0', textAlign: 'center' }}>
                        {gameState === 'WIN'
                            ? <>Has superado las <b style={{ color: '#e7f3ec' }}>{resultado.total}</b> preguntas.</>
                            : <>Llegaste a la pregunta <b style={{ color: '#e7f3ec' }}>{resultado.alcanzada}</b> de {resultado.total}.</>}
                        <br />Bajas: <b style={{ color: '#e7f3ec' }}>{score}</b>
                    </p>

                    {!yaGuardado ? (
                        <div style={{ background: 'rgba(255,255,255,0.06)', padding: 18, borderRadius: 14, width: '90%', maxWidth: 340, marginBottom: 16 }}>
                            {(!usuario || !usuario.email) ? (
                                <>
                                    <p style={{ margin: '0 0 8px', color: '#8a9aa0', fontSize: 13, fontFamily: 'monospace' }}>Tu nombre para el ranking:</p>
                                    <input value={nombreInvitado} onChange={e => setNombreInvitado(e.target.value)} placeholder="Tu nombre" maxLength={15}
                                        style={{ padding: 10, borderRadius: 6, border: 'none', width: '100%', marginBottom: 10, textAlign: 'center', fontWeight: 'bold', boxSizing: 'border-box' }} />
                                </>
                            ) : (
                                <p style={{ color: '#7fffb0', fontWeight: 'bold', marginBottom: 12, fontFamily: 'monospace' }}>{usuario.displayName}</p>
                            )}
                            <button onClick={guardarPuntuacion} disabled={guardando} style={{ ...btnStyle, marginTop: 0, background: '#3498db', boxShadow: '0 4px 0 #2980b9', fontSize: '1rem', padding: 12 }}>
                                {guardando ? 'Guardando...' : <><Save size={18} /> Guardar puntuación</>}
                            </button>
                        </div>
                    ) : (
                        <div style={{ color: '#7fffb0', fontWeight: 'bold', marginBottom: 16, fontFamily: 'monospace' }}>✅ ¡Puntuación guardada!</div>
                    )}

                    <button onClick={() => setMostrarEnvio(true)} style={{ ...btnStyle, background: 'linear-gradient(135deg,#27ae60,#2ecc71)', boxShadow: '0 4px 0 #1e8449' }}>📤 Enviar al profesor</button>
                    <button onClick={() => setVerRanking(true)} style={{ ...btnStyle, background: '#8e44ad', boxShadow: '0 4px 0 #6c3483' }}><Trophy size={20} /> Ver ranking</button>
                    <button onClick={reiniciar} style={{ ...btnStyle, background: '#e74c3c', boxShadow: '0 4px 0 #c0392b' }}><RefreshCw size={20} /> Reintentar</button>
                    <button onClick={volverMenu} style={{ marginTop: 16, background: 'none', border: '1px solid #444', color: '#8a9aa0', padding: '8px 20px', borderRadius: 20, cursor: 'pointer', fontFamily: 'monospace' }}>Menú</button>

                    {mostrarEnvio && (
                        <ModalEnviarProfe
                            datos={{ recursoId: fuente.recursoId, recursoTitulo: fuente.titulo, hoja: fuente.categoria, aciertos: score }}
                            onClose={() => setMostrarEnvio(false)}
                        />
                    )}
                    {verRanking && <PantallaRanking fuente={fuente} onBack={() => setVerRanking(false)} />}
                </div>
            )}
        </div>
    );
}

// =====================================================================
//  MENÚ: modo libre (4 materias) + buscador de recursos
// =====================================================================
// =====================================================================
//  TUTORIAL PREVIO (saltable) — objetivo, reglas, peligro y controles
// =====================================================================
const TUTO_ARTS = [
    `<svg viewBox="0 0 220 110" width="220" height="110">
        <rect x="10" y="10" width="200" height="26" rx="3" fill="#0e1418" stroke="#7fffb0"/>
        <text x="110" y="28" text-anchor="middle" fill="#e7f3ec" font-size="12" font-family="Courier New">¿Cuál es un número primo?</text>
        <g fill="#d23c3c"><rect x="28" y="66" width="18" height="30" rx="2"/><rect x="78" y="66" width="18" height="30" rx="2"/><rect x="128" y="66" width="18" height="30" rx="2"/><rect x="178" y="66" width="18" height="30" rx="2"/></g>
        <g fill="#e7f3ec" font-size="11" font-family="Courier New" text-anchor="middle"><text x="37" y="58">4</text><text x="87" y="58">3</text><text x="137" y="58">6</text><text x="187" y="58">9</text></g>
        <g fill="none" stroke="#7fffb0" stroke-width="1"><rect x="26" y="46" width="22" height="16"/><rect x="76" y="46" width="22" height="16"/><rect x="126" y="46" width="22" height="16"/><rect x="176" y="46" width="22" height="16"/></g>
    </svg>`,
    `<svg viewBox="0 0 220 110" width="220" height="110">
        <g fill="#d23c3c"><rect x="28" y="50" width="18" height="30" rx="2" opacity=".25"/><rect x="128" y="50" width="18" height="30" rx="2" opacity=".25"/><rect x="178" y="50" width="18" height="30" rx="2" opacity=".25"/></g>
        <rect x="78" y="50" width="18" height="30" rx="2" fill="#7fffb0"/>
        <g font-size="11" font-family="Courier New" text-anchor="middle"><text x="37" y="42" fill="#5c6b70">4</text><text x="87" y="42" fill="#7fffb0">3</text><text x="137" y="42" fill="#5c6b70">6</text><text x="187" y="42" fill="#5c6b70">9</text></g>
        <g stroke="#ff5b5b" stroke-width="2"><line x1="30" y1="52" x2="44" y2="78"/><line x1="44" y1="52" x2="30" y2="78"/><line x1="130" y1="52" x2="144" y2="78"/><line x1="144" y1="52" x2="130" y2="78"/><line x1="180" y1="52" x2="194" y2="78"/><line x1="194" y1="52" x2="180" y2="78"/></g>
        <text x="110" y="100" text-anchor="middle" fill="#7fffb0" font-size="10" font-family="Courier New">¡CORRECTO: 3!</text>
    </svg>`,
    `<svg viewBox="0 0 220 110" width="220" height="110">
        <g fill="#d23c3c"><rect x="60" y="40" width="14" height="24" rx="2"/><rect x="100" y="30" width="18" height="34" rx="2"/><rect x="150" y="45" width="12" height="20" rx="2"/></g>
        <g fill="none" stroke="#7fffb0" stroke-width="1.5"><path d="M108 90 l0 -14 M108 76 l-10 10 M108 76 l10 10"/></g>
        <line x1="20" y1="70" x2="200" y2="70" stroke="#263238"/>
        <g stroke="#ff5b5b" stroke-width="1"><line x1="0" y1="80" x2="70" y2="66"/><line x1="220" y1="82" x2="150" y2="66"/></g>
        <rect x="15" y="10" width="45" height="10" rx="2" fill="#12181b" stroke="#263238"/><rect x="15" y="10" width="26" height="10" rx="2" fill="#7fffb0"/>
        <text x="65" y="19" fill="#5c6b70" font-size="8" font-family="Courier New">VIDA</text>
    </svg>`,
];

function TutorialBunker({ onStart, onVolver }) {
    const [i, setI] = useState(0);
    const isTouch = typeof window !== 'undefined' && (('ontouchstart' in window) || navigator.maxTouchPoints > 0);

    const paginas = [
        {
            titulo: 'EL OBJETIVO', art: TUTO_ARTS[0],
            texto: <>Cada pregunta hace aparecer <b>cuatro soldados</b>, cada uno con una respuesta sobre la cabeza. Solo <b>una es correcta</b>.</>,
        },
        {
            titulo: 'LA REGLA', art: TUTO_ARTS[1],
            texto: <><b>Dispara a las respuestas incorrectas.</b> Cuando caigan, la correcta se retira y pasas a la siguiente pregunta.<br /><span style={{ color: '#ff5b5b' }}>Si disparas a la correcta pierdes 25 de vida.</span></>,
        },
        {
            titulo: 'PELIGRO', art: TUTO_ARTS[2],
            texto: <>Las respuestas incorrectas <b>avanzan hacia ti</b> y atacan cuerpo a cuerpo. Usa las <b>coberturas</b>, muévete y recoge <b>botiquines verdes</b> para curarte.</>,
        },
        {
            titulo: 'CONTROLES', art: null,
            texto: (
                <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div><b style={{ color: '#7fffb0' }}>Teclado y ratón</b><br />
                        <span style={{ color: '#a7b6bb' }}>Flechas <b>↑/↓</b> avanzar y retroceder, <b>←/→</b> girar. <b>Arrastra el ratón</b> (o touchpad) para apuntar. <b>Espacio</b> o <b>clic</b> disparan. <b>R</b> recarga.</span>
                    </div>
                    <div><b style={{ color: '#7fffb0' }}>Pantalla táctil</b><br />
                        <span style={{ color: '#a7b6bb' }}>Pulgar <b>izquierdo</b>: joystick para moverte. Pulgar <b>derecho</b>: arrastra para mirar. Botón <b>FUEGO</b> dispara (mantén para ráfaga), <b>R</b> recarga.</span>
                    </div>
                    <div style={{ color: '#5c6b70', fontSize: 11 }}>{isTouch ? 'Mejor en horizontal.' : 'Consejo: apunta con el ratón y muévete con las flechas a la vez.'}</div>
                </div>
            ),
        },
    ];
    const ultima = i === paginas.length - 1;
    const pag = paginas[i];

    return (
        <div style={menuWrap}>
            <div style={{ background: 'rgba(14,20,24,0.96)', border: '1px solid #263238', borderRadius: 18, padding: 30, width: '92%', maxWidth: 420, boxShadow: '0 30px 80px rgba(0,0,0,0.6)', fontFamily: 'monospace', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <span style={{ color: '#5c6b70', fontSize: 11, letterSpacing: 2 }}>CÓMO JUGAR</span>
                    <button onClick={onStart} style={{ background: 'none', border: 'none', color: '#8a9aa0', cursor: 'pointer', fontFamily: 'monospace', fontSize: 12 }}>Saltar ✕</button>
                </div>

                {pag.art && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }} dangerouslySetInnerHTML={{ __html: pag.art }} />
                )}
                <h2 style={{ color: '#7fffb0', fontSize: 14, letterSpacing: 3, margin: '6px 0 10px', fontWeight: 'normal' }}>{pag.titulo}</h2>
                <div style={{ color: '#a7b6bb', fontSize: 13, lineHeight: 1.7, minHeight: 72 }}>{pag.texto}</div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, margin: '18px 0' }}>
                    <button onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0} style={{ background: 'transparent', border: '1px solid #263238', color: '#7fffb0', width: 40, height: 34, borderRadius: 6, cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? .25 : 1 }}>◀</button>
                    <div style={{ display: 'flex', gap: 6 }}>
                        {paginas.map((_, j) => <span key={j} style={{ width: 7, height: 7, borderRadius: '50%', background: j === i ? '#7fffb0' : '#263238' }} />)}
                    </div>
                    <button onClick={() => setI(Math.min(paginas.length - 1, i + 1))} disabled={ultima} style={{ background: 'transparent', border: '1px solid #263238', color: '#7fffb0', width: 40, height: 34, borderRadius: 6, cursor: ultima ? 'default' : 'pointer', opacity: ultima ? .25 : 1 }}>▶</button>
                </div>

                <button onClick={onStart} style={{ ...btnStyle, marginTop: 0, background: '#27ae60', boxShadow: '0 4px 0 #1e8449' }}>
                    <Play size={20} /> {ultima ? 'EMPEZAR' : 'EMPEZAR YA'}
                </button>
                <button onClick={onVolver} style={{ marginTop: 12, background: 'none', border: '1px solid #444', color: '#8a9aa0', padding: '8px 20px', borderRadius: 20, cursor: 'pointer', fontFamily: 'monospace', width: '100%' }}>Volver al menú</button>
            </div>
        </div>
    );
}

function MenuBunker({ recurso, onExit, onEmpezar }) {
    const [vista, setVista] = useState(recurso ? 'RECURSO' : 'INICIO'); // INICIO | RECURSO | BUSCADOR
    const [recursoSel, setRecursoSel] = useState(recurso || null);

    const jugarMateria = (key) => {
        const b = BANCOS[key];
        onEmpezar({ preguntas: b.preguntas, titulo: `Modo Libre · ${b.nombre}`, categoria: b.nombre, recursoId: null });
    };

    return (
        <div style={menuWrap}>
            <style>{`.bunker-menu-card{background:rgba(14,20,24,0.96);border:1px solid #263238;border-radius:18px;padding:34px;width:92%;max-width:460px;box-shadow:0 30px 80px rgba(0,0,0,0.6);}`}</style>

            {vista === 'BUSCADOR' && (
                <BuscadorRecursos onBack={() => setVista('INICIO')} onPick={(r) => { setRecursoSel(r); setVista('RECURSO'); }} />
            )}

            {vista === 'RECURSO' && recursoSel && (
                <ConfigRecurso
                    recurso={recursoSel}
                    onBack={() => { if (recurso) { onExit && onExit(); } else { setVista(recursoSel && !recurso ? 'BUSCADOR' : 'INICIO'); } }}
                    onJugar={onEmpezar}
                />
            )}

            {vista === 'INICIO' && (
                <div className="bunker-menu-card">
                    <div style={{ textAlign: 'center', marginBottom: 8 }}>
                        <h1 style={{ color: '#7fffb0', fontFamily: 'monospace', fontSize: '2.2rem', letterSpacing: 4, margin: 0, textShadow: '0 0 20px rgba(127,255,176,.35)' }}>BUNKER QUIZ</h1>
                        <p style={{ color: '#8a9aa0', fontFamily: 'monospace', fontSize: 12, marginTop: 6 }}>Dispara a las respuestas incorrectas. Deja en pie la correcta.</p>
                    </div>

                    <p style={{ color: '#5c6b70', fontFamily: 'monospace', fontSize: 11, letterSpacing: 2, margin: '18px 0 10px' }}>JUEGA SIN RECURSO</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {Object.entries(BANCOS).map(([key, b]) => (
                            <button key={key} onClick={() => jugarMateria(key)}
                                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '16px 10px', borderRadius: 12, border: `1px solid ${b.color}55`, background: `${b.color}18`, color: '#e7f3ec', cursor: 'pointer', fontFamily: 'monospace', transition: 'transform .1s' }}>
                                <span style={{ fontSize: 30 }}>{b.emoji}</span>
                                <span style={{ fontWeight: 'bold', letterSpacing: 1 }}>{b.nombre}</span>
                                <span style={{ fontSize: 10, color: '#8a9aa0' }}>{b.preguntas.length} preguntas</span>
                            </button>
                        ))}
                    </div>

                    <p style={{ color: '#5c6b70', fontFamily: 'monospace', fontSize: 11, letterSpacing: 2, margin: '22px 0 10px' }}>O JUEGA CON UN RECURSO</p>
                    <button onClick={() => setVista('BUSCADOR')} style={{ ...btnStyle, marginTop: 0, background: '#2c3e50', boxShadow: '0 4px 0 #1c2833', width: '100%' }}>
                        <Search size={20} /> Buscar recurso de un profesor
                    </button>

                    <button onClick={() => onExit && onExit()} style={{ marginTop: 24, background: 'none', border: '1px solid #444', color: '#8a9aa0', padding: '9px 22px', borderRadius: 20, cursor: 'pointer', fontFamily: 'monospace', width: '100%' }}>Volver</button>
                </div>
            )}
        </div>
    );
}

// Panel de configuración de un recurso: elegir todas las hojas o solo algunas
function ConfigRecurso({ recurso, onBack, onJugar }) {
    const hojas = recursoAHojas(recurso);
    const [seleccion, setSeleccion] = useState(() => hojas.map(h => h.nombreHoja)); // todas por defecto
    const totalPreguntas = hojas.filter(h => seleccion.includes(h.nombreHoja)).reduce((n, h) => n + h.preguntas.length, 0);

    const toggle = (nombre) => setSeleccion(sel => sel.includes(nombre) ? sel.filter(n => n !== nombre) : [...sel, nombre]);

    const jugar = () => {
        const preguntas = hojas.filter(h => seleccion.includes(h.nombreHoja)).flatMap(h => h.preguntas);
        const cat = seleccion.length === hojas.length ? 'General' : seleccion.join(' + ');
        onJugar({ preguntas, titulo: recurso.titulo || 'Recurso', categoria: cat.slice(0, 60), recursoId: recurso.id });
    };

    if (hojas.length === 0) {
        return (
            <div className="bunker-menu-card">
                <h2 style={{ color: '#ff5b5b', fontFamily: 'monospace' }}>Recurso no compatible</h2>
                <p style={{ color: '#a7b6bb', fontFamily: 'monospace', fontSize: 13 }}>Este recurso no tiene preguntas de selección múltiple utilizables (necesitan enunciado, respuesta y al menos una incorrecta).</p>
                <button onClick={onBack} style={{ ...btnStyle, background: '#2c3e50', boxShadow: '0 4px 0 #1c2833' }}><ArrowLeft size={18} /> Volver</button>
            </div>
        );
    }

    return (
        <div className="bunker-menu-card">
            <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#8a9aa0', cursor: 'pointer', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}><ArrowLeft size={16} /> Atrás</button>
            <h2 style={{ color: '#7fffb0', fontFamily: 'monospace', margin: '0 0 4px' }}>{recurso.titulo}</h2>
            <p style={{ color: '#8a9aa0', fontFamily: 'monospace', fontSize: 12, marginBottom: 16 }}>Elige con qué hojas quieres jugar.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto', marginBottom: 16 }}>
                {hojas.map(h => {
                    const on = seleccion.includes(h.nombreHoja);
                    return (
                        <button key={h.nombreHoja} onClick={() => toggle(h.nombreHoja)}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 10, cursor: 'pointer', fontFamily: 'monospace', border: `1px solid ${on ? '#7fffb0' : '#263238'}`, background: on ? 'rgba(127,255,176,.12)' : 'transparent', color: '#e7f3ec' }}>
                            <span>{on ? '☑' : '☐'} {h.nombreHoja}</span>
                            <span style={{ fontSize: 11, color: '#8a9aa0' }}>{h.preguntas.length}</span>
                        </button>
                    );
                })}
            </div>

            <button onClick={jugar} disabled={totalPreguntas === 0} style={{ ...btnStyle, marginTop: 0, background: totalPreguntas ? '#27ae60' : '#555', boxShadow: totalPreguntas ? '0 4px 0 #1e8449' : 'none' }}>
                <Play size={20} /> Jugar ({totalPreguntas} preguntas)
            </button>
        </div>
    );
}

// Buscador de recursos públicos de selección múltiple
function BuscadorRecursos({ onBack, onPick }) {
    const [busqueda, setBusqueda] = useState('');
    const [todos, setTodos] = useState([]);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        (async () => {
            setCargando(true);
            try {
                const snap = await getDocs(query(collection(db, 'resources'), where('isPrivate', '==', false)));
                const docs = snap.docs.map(d => ({ ...d.data(), id: d.id }));
                // Mismo tipo de recurso que Burbujas y Pikatron (1 correcta + 3 incorrectas);
                // descartamos los que no tengan al menos una pregunta jugable (p.ej. PRO solo-generadas)
                const jugables = docs.filter(r => r.tipoJuego === 'CAZABURBUJAS' && recursoAHojas(r).length > 0);
                jugables.sort((a, b) => (b.playCount || 0) - (a.playCount || 0));
                setTodos(jugables);
            } catch (e) { console.error('Error buscador:', e); }
            setCargando(false);
        })();
    }, []);

    const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const q = norm(busqueda);
    const resultados = !q ? todos : todos.filter(r =>
        norm(r.titulo).includes(q) ||
        norm(r.temas).includes(q) ||
        (r.hojas || []).some(h => norm(h.nombreHoja).includes(q))
    );

    return (
        <div className="bunker-menu-card" style={{ maxWidth: 520 }}>
            <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#8a9aa0', cursor: 'pointer', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}><ArrowLeft size={16} /> Atrás</button>
            <h2 style={{ color: '#7fffb0', fontFamily: 'monospace', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}><Search size={22} /> Buscar recurso</h2>
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Título, tema, hoja..."
                style={{ width: '100%', padding: 11, borderRadius: 8, border: '1px solid #263238', background: '#0a0e11', color: '#e7f3ec', fontFamily: 'monospace', marginBottom: 14, boxSizing: 'border-box' }} />

            <div style={{ maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {cargando ? <p style={{ color: '#8a9aa0', fontFamily: 'monospace', textAlign: 'center' }}>Cargando biblioteca...</p>
                    : resultados.length === 0 ? <p style={{ color: '#8a9aa0', fontFamily: 'monospace', textAlign: 'center' }}>Sin recursos compatibles.</p>
                        : resultados.map(r => (
                            <button key={r.id} onClick={() => onPick(r)}
                                style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 10, border: '1px solid #263238', background: 'transparent', color: '#e7f3ec', cursor: 'pointer', fontFamily: 'monospace' }}>
                                <div style={{ fontWeight: 'bold' }}>{r.titulo}</div>
                                <div style={{ fontSize: 11, color: '#8a9aa0', marginTop: 3 }}>
                                    {r.tipoJuego || 'Recurso'}{r.profesorNombre ? ` · ${r.profesorNombre}` : ''} · {(r.hojas?.length || 1)} hoja(s)
                                </div>
                            </button>
                        ))}
            </div>
        </div>
    );
}

// =====================================================================
//  RANKING
// =====================================================================
function PantallaRanking({ fuente, onBack }) {
    const [top10, setTop10] = useState([]);
    const [cargando, setCargando] = useState(true);
    const recursoId = fuente.recursoId || ('libre-' + fuente.categoria);

    useEffect(() => {
        (async () => {
            setCargando(true);
            try {
                const q = query(collection(db, 'ranking'),
                    where('recursoId', '==', recursoId),
                    where('tipoJuego', '==', 'BUNKER'),
                    orderBy('aciertos', 'desc'), limit(10));
                const snap = await getDocs(q);
                setTop10(snap.docs.map(d => d.data()));
            } catch (e) { console.error('Ranking:', e); }
            setCargando(false);
        })();
    }, [recursoId]);

    return (
        <div style={{ ...overlayStyle, zIndex: 3000 }}>
            <div className="bunker-menu-card" style={{ maxWidth: 460 }}>
                <h2 style={{ color: '#7fffb0', fontFamily: 'monospace', marginTop: 0 }}>🏆 Top 10 · {fuente.titulo}</h2>
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 10, height: 300, overflowY: 'auto', marginBottom: 18, padding: 10 }}>
                    {cargando ? <p style={{ color: '#8a9aa0', fontFamily: 'monospace' }}>Cargando...</p>
                        : top10.length === 0 ? <p style={{ color: '#8a9aa0', fontFamily: 'monospace' }}>Sin puntuaciones todavía.</p>
                            : top10.map((f, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: 9, borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#e7f3ec', fontFamily: 'monospace' }}>
                                    <span style={{ fontWeight: 'bold', color: i < 3 ? '#7fffb0' : '#8a9aa0', width: 30 }}>#{i + 1}</span>
                                    <span style={{ flex: 1, textAlign: 'left' }}>{f.jugador}</span>
                                    <span style={{ fontWeight: 'bold', color: '#ffb84d' }}>{f.aciertos}</span>
                                </div>
                            ))}
                </div>
                <button onClick={onBack} style={{ ...btnStyle, background: '#7f8c8d', boxShadow: '0 4px 0 #616a6b', marginTop: 0 }}>Cerrar</button>
            </div>
        </div>
    );
}

// =====================================================================
//  MODAL ENVIAR AL PROFESOR
// =====================================================================
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
            const codigoDoc = await getDoc(doc(db, 'codigos_profesor', code));
            if (!codigoDoc.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'BUNKER', modalidad: 'Individual', fecha: new Date(),
                recursoId: datos.recursoId || null, recursoTitulo: datos.recursoTitulo,
                hoja: datos.hoja, codigoProfesor: code,
                jugadores: [{ nombre: nombre.trim(), curso: curso.trim(), aciertos: datos.aciertos, fallos: 0, hoja: datos.hoja }],
            });
            guardarRegistroLocal('BUNKER', { titulo: datos.recursoTitulo, aciertos: datos.aciertos, nombre: nombre.trim(), curso: curso.trim(), via: 'profesor' });
            setEnviado(true);
        } catch (e) { setError('Error: ' + e.message); }
        setEnviando(false);
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ background: '#1e272e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, width: '100%', maxWidth: 380, padding: '26px 28px', boxShadow: '0 30px 80px rgba(0,0,0,0.7)', color: 'white', fontFamily: "'Segoe UI', sans-serif" }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#7fffb0' }}>📤 Enviar al profesor</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.2rem' }}>✕</button>
                </div>
                {enviado ? (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{ fontSize: '3rem', marginBottom: 10 }}>✅</div>
                        <div style={{ color: '#2ecc71', fontWeight: 700, fontSize: '1.1rem' }}>¡Informe enviado!</div>
                        <div style={{ marginTop: 8, color: '#aaa', fontSize: '0.9rem' }}>{datos.aciertos} puntos</div>
                        <button onClick={onClose} style={{ marginTop: 16, padding: '9px 22px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', color: 'white', fontFamily: 'inherit' }}>Cerrar</button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {[['nombre', 'Nombre y apellido', nombre, setNombre, 'Tu nombre completo', false],
                        ['curso', 'Curso', curso, setCurso, 'Ej: 3º ESO A', false],
                        ['codigo', 'Código del profesor', codigo, v => setCodigo(v.toUpperCase()), 'Ej: PROF01', true]
                        ].map(([key, label, val, setter, ph, mono]) => (
                            <div key={key}>
                                <label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 }}>{label}</label>
                                <input value={val} onChange={e => setter(e.target.value)} placeholder={ph} maxLength={key === 'codigo' ? 10 : undefined}
                                    style={{ padding: '9px 12px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', letterSpacing: mono ? 2 : 0, fontWeight: mono ? 700 : 400 }} />
                            </div>
                        ))}
                        {error && <div style={{ color: '#e74c3c', fontSize: '0.8rem' }}>⚠ {error}</div>}
                        <div style={{ display: 'flex', gap: 9, marginTop: 4 }}>
                            <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', cursor: 'pointer', color: 'white', fontFamily: 'inherit' }}>Cancelar</button>
                            <button onClick={enviar} disabled={enviando} style={{ flex: 2, padding: 10, borderRadius: 10, border: 'none', background: enviando ? '#555' : 'linear-gradient(135deg,#3498db,#2980b9)', color: 'white', fontWeight: 700, cursor: enviando ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                                {enviando ? 'Enviando…' : '📤 Enviar'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// =====================================================================
//  ESTILOS COMPARTIDOS
// =====================================================================
const menuWrap = { position: 'fixed', inset: 0, background: '#05070a', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998, padding: 16, overflowY: 'auto' };
const overlayStyle = { position: 'absolute', inset: 0, background: 'rgba(5,7,10,0.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20, overflowY: 'auto' };
const btnStyle = { padding: '13px 26px', fontSize: '1.05rem', color: 'white', border: 'none', borderRadius: 12, cursor: 'pointer', display: 'flex', gap: 10, marginTop: 12, fontWeight: 'bold', transition: 'transform 0.1s', alignItems: 'center', justifyContent: 'center', width: '100%', fontFamily: 'monospace' };
