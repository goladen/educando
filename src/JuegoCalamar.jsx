import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { ArrowLeft, Search, Play, Users, Trophy, Volume2, VolumeX, LogOut } from 'lucide-react';
import { db } from './firebase';
import {
    collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, addDoc, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { guardarRegistroLocal } from './utils/registrosLocales';
import QRSalaBoton from './components/QRSalaBoton';

/* =====================================================================
 *  LUZ ROJA · LUZ VERDE  (juego del calamar educativo)
 *  - Con la LUZ VERDE se puede responder: acierto = 1 paso adelante,
 *    fallo = 1 paso atrás.
 *  - Si respondes con la LUZ ROJA, eliminado.
 *  - Admite preguntas de cualquier recurso: selección múltiple,
 *    respuesta corta, rellenar hueco y ordenar.
 *  - Modo individual y modo online (salas live_games, tipoJuego CALAMAR).
 * ===================================================================== */

// ============================ CONSTANTES =============================
const TIPO_JUEGO = 'CALAMAR';
const VERDE = 'VERDE', AVISO = 'AVISO', ROJA = 'ROJA';

const DIFICULTADES = {
    FACIL: { nombre: 'Fácil', verde: [6000, 9000], aviso: 1100, roja: [2500, 4000] },
    NORMAL: { nombre: 'Normal', verde: [4000, 7000], aviso: 900, roja: [3000, 5000] },
    DIFICIL: { nombre: 'Difícil', verde: [2600, 4600], aviso: 700, roja: [3500, 6000] },
};

const COLOR_CHANDAL = 0x149e7a;   // verde azulado del chándal
const COLOR_FONDO = 0x8ed2f0;   // cielo pintado del pabellón

const rnd = (a, b) => a + Math.random() * (b - a);
const barajar = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
};
const limpiar = (s) => String(s ?? '').toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();

const claveJugador = (nombre) => limpiar(nombre).replace(/\s+/g, '_').slice(0, 40) || 'jugador';

// =====================================================================
//  NORMALIZACIÓN DE PREGUNTAS (cualquier recurso del profesor)
// =====================================================================
export function normalizarPreguntaCalamar(p) {
    if (!p) return null;
    const tipoOrig = String(p.tipo || '').toUpperCase();
    if (tipoOrig === 'PRESENTATION' || tipoOrig === 'DIBUJO') return null;

    const enunciado = String(p.pregunta || p.q || p.enunciado || '').trim();
    const bloques = Array.isArray(p.bloques) ? p.bloques.map(b => String(b ?? '').trim()) : [];

    // --- Ordenar ---
    if (tipoOrig === 'ORDENAR') {
        const bs = bloques.filter(Boolean);
        if (bs.length < 2) return null;
        return { tipo: 'ORDENAR', enunciado: enunciado || 'Ordena los bloques', bloques: bs, correcta: bs.join(' ') };
    }

    // --- Rellenar hueco ---
    if (tipoOrig === 'RELLENAR') {
        const hueco = bloques[1] || '';
        if (!hueco) return null;
        return {
            tipo: 'RELLENAR',
            enunciado: enunciado || 'Completa la frase',
            bloques: [bloques[0] || '', hueco, bloques[2] || ''],
            correcta: hueco,
        };
    }

    // --- Opción múltiple / respuesta corta ---
    const correcta = String(p.correcta ?? p.respuesta ?? p.ok ?? p.a ?? '').trim();
    if (!enunciado || !correcta) return null;

    let mal = p.incorrectas || p.mal || p.distractores || [];
    if (!Array.isArray(mal)) mal = [];
    mal = [...new Set(mal.map(x => String(x ?? '').trim()).filter(x => x && limpiar(x) !== limpiar(correcta)))].slice(0, 3);

    if (tipoOrig === 'SIMPLE' || mal.length === 0) return { tipo: 'CORTA', enunciado, correcta };
    return { tipo: 'MULTIPLE', enunciado, correcta, opciones: barajar([correcta, ...mal]) };
}

export function preguntasDeRecurso(recurso) {
    if (!recurso) return [];
    const crudas = Array.isArray(recurso.hojas) && recurso.hojas.length
        ? recurso.hojas.flatMap(h => h.preguntas || [])
        : (recurso.preguntas || []);
    return crudas.map(normalizarPreguntaCalamar).filter(Boolean);
}

export function esRespuestaCorrecta(pregunta, dada) {
    if (!pregunta) return false;
    if (pregunta.tipo === 'ORDENAR') return limpiar(dada) === limpiar(pregunta.bloques.join(' '));
    return limpiar(dada) === limpiar(pregunta.correcta);
}

// =====================================================================
//  BANCO LIBRE (para jugar sin recurso del profesor)
// =====================================================================
const BANCO_LIBRE = [
    { pregunta: '¿Cuánto es 7 × 8?', correcta: '56', incorrectas: ['48', '54', '64'] },
    { pregunta: '¿Cuánto es 144 : 12?', correcta: '12', incorrectas: ['11', '13', '14'] },
    { pregunta: '¿Cuál es el 25 % de 80?', correcta: '20', incorrectas: ['15', '25', '40'] },
    { pregunta: 'Raíz cuadrada de 169', correcta: '13', incorrectas: ['12', '14', '17'] },
    { pregunta: '¿Capital de Portugal?', correcta: 'Lisboa', incorrectas: ['Oporto', 'Madrid', 'Sevilla'] },
    { pregunta: '¿Capital de Japón?', correcta: 'Tokio', incorrectas: ['Pekín', 'Seúl', 'Bangkok'] },
    { pregunta: '¿Océano más grande del planeta?', correcta: 'Pacífico', incorrectas: ['Atlántico', 'Índico', 'Ártico'] },
    { pregunta: '¿Río más largo de la península ibérica?', correcta: 'Tajo', incorrectas: ['Ebro', 'Duero', 'Guadalquivir'] },
    { pregunta: 'Símbolo químico del oro', correcta: 'Au', incorrectas: ['Ag', 'Or', 'Go'] },
    { pregunta: 'Fórmula del agua', correcta: 'H₂O', incorrectas: ['CO₂', 'O₂', 'HO₂'] },
    { pregunta: 'Órgano que bombea la sangre', correcta: 'Corazón', incorrectas: ['Pulmón', 'Hígado', 'Riñón'] },
    { pregunta: 'Planeta más cercano al Sol', correcta: 'Mercurio', incorrectas: ['Venus', 'Marte', 'Tierra'] },
    { tipo: 'SIMPLE', pregunta: '"Casa" en inglés', respuesta: 'House' },
    { tipo: 'SIMPLE', pregunta: 'Pasado simple del verbo "go"', respuesta: 'Went' },
    { tipo: 'SIMPLE', pregunta: '¿Cuántos huesos tiene un adulto?', respuesta: '206' },
    { tipo: 'RELLENAR', pregunta: 'Completa la frase', bloques: ['El triángulo equilátero tiene todos sus lados', 'iguales', 'y sus ángulos de 60º.'] },
    { tipo: 'RELLENAR', pregunta: 'Completa la frase', bloques: ['La', 'fotosíntesis', 'transforma la luz en energía química.'] },
    { tipo: 'ORDENAR', pregunta: 'Ordena la frase', bloques: ['Yesterday', 'I', 'went', 'to', 'the', 'cinema'] },
    { tipo: 'ORDENAR', pregunta: 'Ordena de menor a mayor', bloques: ['1/5', '1/3', '1/2', '3/4'] },
    { tipo: 'ORDENAR', pregunta: 'Ordena los planetas desde el Sol', bloques: ['Mercurio', 'Venus', 'Tierra', 'Marte'] },
];

// =====================================================================
//  SONIDO (Web Audio, sin archivos)
// =====================================================================
function crearAudio() {
    let ctx = null, activo = true;
    const ac = () => {
        if (!activo) return null;
        try {
            if (!ctx || ctx.state === 'closed') ctx = new (window.AudioContext || window.webkitAudioContext)();
            if (ctx.state === 'suspended') ctx.resume();
            return ctx;
        } catch (e) { return null; }
    };
    const nota = (f, t0, dur, vol = 0.12, tipo = 'triangle') => {
        const c = ac(); if (!c) return;
        const o = c.createOscillator(), g = c.createGain();
        o.type = tipo; o.frequency.setValueAtTime(f, c.currentTime + t0);
        g.gain.setValueAtTime(0.0001, c.currentTime + t0);
        g.gain.exponentialRampToValueAtTime(vol, c.currentTime + t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t0 + dur);
        o.connect(g); g.connect(c.destination);
        o.start(c.currentTime + t0); o.stop(c.currentTime + t0 + dur + 0.05);
    };
    const ruido = (dur = 0.2, vol = 0.3, corte = 1200) => {
        const c = ac(); if (!c) return;
        const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
        const s = c.createBufferSource(); s.buffer = buf;
        const g = c.createGain(); g.gain.value = vol;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = corte;
        s.connect(lp); lp.connect(g); g.connect(c.destination); s.start();
    };
    // "Mu-gung-hwa kko-chi pi-eot-seum-ni-da" → melodía de 8 notas que cabe en la fase verde
    const CANCION = [392, 440, 392, 330, 392, 440, 392, 294];
    return {
        get activo() { return activo; },
        set activo(v) { activo = v; },
        cancion(duracionMs) {
            const paso = Math.max(0.16, (duracionMs / 1000) / CANCION.length);
            CANCION.forEach((f, i) => nota(f, i * paso, paso * 0.75, 0.09, 'triangle'));
        },
        aviso() { nota(660, 0, 0.12, 0.14, 'square'); nota(880, 0.14, 0.18, 0.14, 'square'); },
        roja() { nota(180, 0, 0.35, 0.16, 'sawtooth'); },
        acierto() { nota(660, 0, 0.09, 0.12, 'square'); nota(990, 0.09, 0.14, 0.12, 'square'); },
        fallo() { nota(200, 0, 0.22, 0.14, 'sawtooth'); },
        disparo() { ruido(0.35, 0.45, 2400); nota(90, 0, 0.3, 0.2, 'sawtooth'); },
        meta() {[523, 659, 784, 1046].forEach((f, i) => nota(f, i * 0.13, 0.3, 0.13, 'triangle')); },
        cerrar() { try { if (ctx) ctx.close(); } catch (e) { } ctx = null; },
    };
}

// =====================================================================
//  ESCENA 3D  (three.js) — pista, muñeca gigante y jugadores
// =====================================================================
function crearEscena(root) {
    const LARGO = 92, ANCHO = 34;
    const INICIO_Z = 8, META_Z = -LARGO + 18;
    const zDePaso = (paso, meta) => INICIO_Z + (META_Z - INICIO_Z) * Math.min(1, Math.max(0, paso / Math.max(1, meta)));

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(root.clientWidth || window.innerWidth, root.clientHeight || window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.cssText = 'position:absolute;inset:0;display:block;z-index:0;';
    root.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLOR_FONDO);
    scene.fog = new THREE.Fog(COLOR_FONDO, 60, 165);

    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 400);
    camera.position.set(0, 6, INICIO_Z + 14);

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const hemi = new THREE.HemisphereLight(0xbfe6ff, 0xc9a882, 0.75); scene.add(hemi);
    const sol = new THREE.DirectionalLight(0xfff2d8, 1.35);
    sol.position.set(26, 48, 24); sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048);
    { const c = sol.shadow.camera; c.left = c.bottom = -70; c.right = c.top = 70; c.near = 1; c.far = 160; sol.shadow.bias = -0.0015; }
    scene.add(sol);

    // --- Texturas procedurales ---
    const tex = (dibujar, size = 256, rep = 1) => {
        const c = document.createElement('canvas'); c.width = c.height = size;
        dibujar(c.getContext('2d'), size);
        const t = new THREE.CanvasTexture(c);
        t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep);
        if ('colorSpace' in t) t.colorSpace = THREE.SRGBColorSpace;
        return t;
    };
    const arenaTex = tex((g, s) => {
        g.fillStyle = '#d9b98c'; g.fillRect(0, 0, s, s);
        for (let i = 0; i < 2600; i++) {
            g.fillStyle = `rgba(${150 + Math.random() * 70 | 0},${115 + Math.random() * 60 | 0},${70 + Math.random() * 50 | 0},0.5)`;
            g.fillRect(Math.random() * s, Math.random() * s, 2, 2);
        }
    }, 256, 12);

    // --- Suelo ---
    const suelo = new THREE.Mesh(
        new THREE.PlaneGeometry(ANCHO + 70, LARGO + 90),
        new THREE.MeshStandardMaterial({ map: arenaTex, roughness: 1 })
    );
    suelo.rotation.x = -Math.PI / 2;
    suelo.position.z = -LARGO / 2 + 10;
    suelo.receiveShadow = true;
    scene.add(suelo);

    // --- Muros laterales del pabellón ---
    const matMuro = new THREE.MeshStandardMaterial({ color: 0xead6c0, roughness: 0.95 });
    const matMuroAlto = new THREE.MeshStandardMaterial({ color: 0x9ed8f2, roughness: 1 });
    [-1, 1].forEach(lado => {
        const bajo = new THREE.Mesh(new THREE.BoxGeometry(1.2, 5, LARGO + 60), matMuro);
        bajo.position.set(lado * (ANCHO / 2 + 6), 2.5, -LARGO / 2 + 10);
        bajo.receiveShadow = true; scene.add(bajo);
        const alto = new THREE.Mesh(new THREE.BoxGeometry(1.1, 16, LARGO + 60), matMuroAlto);
        alto.position.set(lado * (ANCHO / 2 + 6), 13, -LARGO / 2 + 10);
        scene.add(alto);
    });
    // Muro del fondo (detrás de la muñeca)
    const fondo = new THREE.Mesh(new THREE.BoxGeometry(ANCHO + 14, 22, 1.2), matMuroAlto);
    fondo.position.set(0, 11, META_Z - 26); scene.add(fondo);

    // --- Colinas pintadas al fondo ---
    [[-16, -8], [0, 0], [15, -6]].forEach(([x, dz]) => {
        const colina = new THREE.Mesh(new THREE.SphereGeometry(13, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
            new THREE.MeshStandardMaterial({ color: 0x6fbf5e, roughness: 1 }));
        colina.position.set(x, 0.2, META_Z - 34 + dz);
        colina.scale.set(1.5, 0.55, 1);
        scene.add(colina);
    });

    // --- Líneas de salida y meta ---
    const rayas = (z, color) => {
        const g = new THREE.Group();
        for (let i = -6; i <= 6; i++) {
            const r = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.4),
                new THREE.MeshStandardMaterial({ color: i % 2 ? color : 0xffffff, roughness: 1 }));
            r.rotation.x = -Math.PI / 2; r.position.set(i * 1.7, 0.03, z); g.add(r);
        }
        scene.add(g);
    };
    rayas(INICIO_Z + 1.5, 0xe74c3c);
    rayas(META_Z + 2, 0xe74c3c);

    // --- Árbol detrás de la muñeca ---
    const arbol = new THREE.Group();
    const tronco = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.6, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 }));
    tronco.position.y = 6; tronco.castShadow = true; arbol.add(tronco);
    const hojasMat = new THREE.MeshStandardMaterial({ color: 0x2e7d4f, roughness: 1 });
    [[0, 14, 0, 7], [-4.5, 12, 1, 5], [4.5, 12.5, -1, 5.2], [0, 17, -1, 4.6]].forEach(([x, y, z, r]) => {
        const h = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), hojasMat);
        h.position.set(x, y, z); h.castShadow = true; arbol.add(h);
    });
    arbol.position.set(-9, 0, META_Z - 16);
    scene.add(arbol);

    // ================== MUÑECA ==================
    const munieca = new THREE.Group();
    {
        const piel = new THREE.MeshStandardMaterial({ color: 0xf6ddc4, roughness: 0.85 });
        const naranja = new THREE.MeshStandardMaterial({ color: 0xef8a2b, roughness: 0.9 });
        const amarillo = new THREE.MeshStandardMaterial({ color: 0xf2d544, roughness: 0.9 });
        const negro = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.75 });
        const blanco = new THREE.MeshStandardMaterial({ color: 0xf7f7f7, roughness: 0.7 });

        // Falda
        const falda = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 2.7, 3.1, 20), naranja);
        falda.position.y = 2.6; munieca.add(falda);
        // Torso / camiseta
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.35, 2.3, 20), amarillo);
        torso.position.y = 5.2; munieca.add(torso);
        // Brazos
        [-1, 1].forEach(l => {
            const brazo = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 2.1, 6, 12), piel);
            brazo.position.set(l * 1.4, 4.9, 0); brazo.rotation.z = l * 0.16; munieca.add(brazo);
        });
        // Piernas + calcetines
        [-1, 1].forEach(l => {
            const pierna = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.6, 6, 12), piel);
            pierna.position.set(l * 0.75, 1.1, 0); munieca.add(pierna);
            const calcetin = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.9, 12), blanco);
            calcetin.position.set(l * 0.75, 0.45, 0); munieca.add(calcetin);
        });

        // --- Cabeza (gira sobre el cuello) ---
        const cabeza = new THREE.Group();
        cabeza.position.y = 7.1;
        const craneo = new THREE.Mesh(new THREE.SphereGeometry(1.5, 24, 20), piel);
        cabeza.add(craneo);
        // Pelo (casquete + flequillo + coletas)
        const pelo = new THREE.Mesh(new THREE.SphereGeometry(1.56, 24, 20, 0, Math.PI * 2, 0, Math.PI * 0.62), negro);
        pelo.position.y = 0.06; cabeza.add(pelo);
        const flequillo = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.55, 0.5), negro);
        flequillo.position.set(0, 0.85, 1.15); cabeza.add(flequillo);
        [-1, 1].forEach(l => {
            const coleta = new THREE.Mesh(new THREE.SphereGeometry(0.72, 16, 12), negro);
            coleta.position.set(l * 1.6, 0.1, -0.35); coleta.scale.set(1, 1.5, 1); cabeza.add(coleta);
        });
        // Cara (mirando al +Z local)
        const ojoMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.4, emissive: 0x000000 });
        const ojos = [];
        [-1, 1].forEach(l => {
            const ojo = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), ojoMat);
            ojo.position.set(l * 0.52, 0.16, 1.32); cabeza.add(ojo); ojos.push(ojo);
        });
        const mejillaMat = new THREE.MeshStandardMaterial({ color: 0xf08a8a, roughness: 1 });
        [-1, 1].forEach(l => {
            const m = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), mejillaMat);
            m.position.set(l * 0.95, -0.3, 1.25); cabeza.add(m);
        });
        const boca = new THREE.Mesh(new THREE.CircleGeometry(0.2, 16), new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 1 }));
        boca.position.set(0, -0.62, 1.34); cabeza.add(boca);

        munieca.add(cabeza);
        munieca.userData.cabeza = cabeza;
        munieca.userData.ojoMat = ojoMat;
        munieca.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    }
    munieca.scale.setScalar(1.55);
    munieca.position.set(3, 0, META_Z - 9);
    munieca.rotation.y = Math.PI;       // el cuerpo siempre mira hacia el fondo
    scene.add(munieca);

    // Foco rojo de "detección"
    const focoRojo = new THREE.PointLight(0xff2222, 0, 70);
    focoRojo.position.set(3, 12, META_Z - 6);
    scene.add(focoRojo);

    // ================== JUGADORES ==================
    const etiqueta = (texto, color = '#ffffff') => {
        const c = document.createElement('canvas'); c.width = 512; c.height = 128;
        const g = c.getContext('2d');
        g.fillStyle = 'rgba(0,0,0,0.55)'; g.roundRect ? (g.beginPath(), g.roundRect(8, 18, 496, 92, 26), g.fill()) : g.fillRect(8, 18, 496, 92);
        g.font = 'bold 62px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = color; g.fillText(String(texto).slice(0, 14), 256, 66);
        const t = new THREE.CanvasTexture(c);
        if ('colorSpace' in t) t.colorSpace = THREE.SRGBColorSpace;
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
        sp.scale.set(4.4, 1.1, 1);
        return sp;
    };

    const texturaDorsal = (numero) => {
        const c = document.createElement('canvas'); c.width = c.height = 256;
        const g = c.getContext('2d');
        g.fillStyle = '#149e7a'; g.fillRect(0, 0, 256, 256);
        g.fillStyle = '#ffffff'; g.font = 'bold 150px system-ui, sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(String(numero).padStart(3, '0').slice(-3), 128, 136);
        const t = new THREE.CanvasTexture(c);
        if ('colorSpace' in t) t.colorSpace = THREE.SRGBColorSpace;
        return t;
    };

    function construirJugador({ numero, nombre, esYo }) {
        const g = new THREE.Group();
        const matChandal = new THREE.MeshStandardMaterial({ color: COLOR_CHANDAL, roughness: 0.85 });
        const matPiel = new THREE.MeshStandardMaterial({ color: 0xf2cfa9, roughness: 0.9 });
        const matPelo = new THREE.MeshStandardMaterial({ color: 0x2b2118, roughness: 0.9 });

        const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.95, 6, 14), matChandal);
        torso.position.y = 1.35; g.add(torso);

        const dorsal = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.72),
            new THREE.MeshStandardMaterial({ map: texturaDorsal(numero), roughness: 0.9 }));
        dorsal.position.set(0, 1.45, -0.44); dorsal.rotation.y = Math.PI; g.add(dorsal);

        const cabeza = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 14), matPiel);
        cabeza.position.y = 2.15; g.add(cabeza);
        const pelo = new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.6), matPelo);
        pelo.position.y = 2.2; g.add(pelo);

        const brazos = [-1, 1].map(l => {
            const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.75, 6, 10), matChandal);
            b.position.set(l * 0.52, 1.35, 0); g.add(b); return b;
        });
        const piernas = [-1, 1].map(l => {
            const p = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.85, 6, 10), matChandal);
            p.position.set(l * 0.22, 0.55, 0); g.add(p); return p;
        });

        const sombra = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16),
            new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 }));
        sombra.rotation.x = -Math.PI / 2; sombra.position.y = 0.02; g.add(sombra);

        const label = etiqueta(nombre, esYo ? '#7dffb2' : '#ffffff');
        label.position.y = 3.05; g.add(label);

        g.rotation.y = Math.PI;             // mira hacia la muñeca (-Z del mundo)
        g.traverse(o => { if (o.isMesh) o.castShadow = true; });
        return { g, brazos, piernas, matChandal, matPiel, label };
    }

    // ================== ESTADO Y BUCLE ==================
    const jugadores = new Map();   // id → { obj, objetivoZ, x, eliminado, caida }
    let metaPasos = 15;
    let luzActual = VERDE;
    let objetivoCabeza = 0;        // 0 = de espaldas · PI = mirando a los jugadores
    let idYo = null;
    let modoPanoramica = false;
    let vivo = true;

    const camObjetivo = new THREE.Vector3(0, 6, INICIO_Z + 14);
    const camMira = new THREE.Vector3(0, 2, META_Z);

    function actualizar(estado) {
        metaPasos = estado.meta || 15;
        luzActual = estado.luz || VERDE;
        idYo = estado.idYo ?? null;
        modoPanoramica = !!estado.panoramica;
        objetivoCabeza = luzActual === VERDE ? 0 : Math.PI;

        const lista = estado.jugadores || [];
        const vistos = new Set();
        lista.forEach((j, i) => {
            vistos.add(j.id);
            let reg = jugadores.get(j.id);
            if (!reg) {
                const obj = construirJugador({ numero: j.numero ?? (i + 1), nombre: j.nombre, esYo: j.id === idYo });
                scene.add(obj.g);
                reg = { ...obj, objetivoZ: zDePaso(j.paso || 0, metaPasos), eliminado: false, caida: 0, fase: Math.random() * 6 };
                reg.g.position.set(0, 0, zDePaso(j.paso || 0, metaPasos));
                jugadores.set(j.id, reg);
            }
            // Carril lateral
            const n = lista.length;
            const ancho = Math.min(3.4, (ANCHO - 6) / Math.max(1, n));
            reg.x = (i - (n - 1) / 2) * ancho;
            reg.objetivoZ = zDePaso(j.paso || 0, metaPasos);
            if (j.eliminado && !reg.eliminado) {
                reg.eliminado = true;
                reg.matChandal.color.setHex(0x7a2222);
                reg.label.material.opacity = 0.5;
            }
        });
        // Quitar jugadores que ya no están
        [...jugadores.keys()].forEach(id => {
            if (!vistos.has(id)) {
                const reg = jugadores.get(id);
                scene.remove(reg.g);
                reg.g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); } });
                jugadores.delete(id);
            }
        });
    }

    const reloj = new THREE.Clock();
    function bucle() {
        if (!vivo) return;
        const dt = Math.min(0.05, reloj.getDelta());
        const t = reloj.elapsedTime;

        // Cabeza de la muñeca
        const cab = munieca.userData.cabeza;
        cab.rotation.y += (objetivoCabeza - cab.rotation.y) * Math.min(1, dt * 7);
        const mirando = Math.abs(cab.rotation.y) > Math.PI * 0.55;
        munieca.userData.ojoMat.emissive.setHex(mirando ? 0xff0000 : 0x000000);
        munieca.userData.ojoMat.emissiveIntensity = mirando ? 2.2 : 0;
        focoRojo.intensity += ((luzActual === ROJA ? 2.4 : 0) - focoRojo.intensity) * Math.min(1, dt * 5);
        munieca.position.y = Math.sin(t * 1.2) * 0.06;

        // Jugadores
        let yo = null;
        jugadores.forEach((reg) => {
            const p = reg.g.position;
            const dz = reg.objetivoZ - p.z;
            const dx = reg.x - p.x;
            const moviendo = Math.abs(dz) > 0.06 || Math.abs(dx) > 0.06;
            p.z += dz * Math.min(1, dt * 3.4);
            p.x += dx * Math.min(1, dt * 3.4);

            if (reg.eliminado) {
                reg.caida = Math.min(1, reg.caida + dt * 2.2);
                reg.g.rotation.x = -reg.caida * Math.PI * 0.5;
                reg.g.position.y = -reg.caida * 0.35;
            } else if (moviendo) {
                reg.fase += dt * 9;
                reg.piernas[0].rotation.x = Math.sin(reg.fase) * 0.7;
                reg.piernas[1].rotation.x = -Math.sin(reg.fase) * 0.7;
                reg.brazos[0].rotation.x = -Math.sin(reg.fase) * 0.6;
                reg.brazos[1].rotation.x = Math.sin(reg.fase) * 0.6;
                reg.g.position.y = Math.abs(Math.sin(reg.fase)) * 0.08;
            } else {
                [...reg.piernas, ...reg.brazos].forEach(m => { m.rotation.x *= 0.88; });
                reg.g.position.y = 0;
            }
        });
        if (idYo != null) yo = jugadores.get(idYo) || null;

        // Cámara
        if (yo && !modoPanoramica) {
            camObjetivo.set(yo.g.position.x * 0.55, 5.2, yo.g.position.z + 12.5);
            camMira.set(munieca.position.x * 0.3, 3.2, yo.g.position.z - 16);
        } else {
            camObjetivo.set(0, 17, INICIO_Z + 24);
            camMira.set(0, 3, META_Z + 6);
        }
        camera.position.lerp(camObjetivo, Math.min(1, dt * 2.2));
        camera.lookAt(camMira);

        renderer.render(scene, camera);
        requestAnimationFrame(bucle);
    }
    requestAnimationFrame(bucle);

    const redimensionar = () => {
        const w = root.clientWidth || window.innerWidth;
        const h = root.clientHeight || window.innerHeight;
        camera.aspect = w / h; camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    };
    redimensionar();
    window.addEventListener('resize', redimensionar);

    return {
        actualizar,
        dispose() {
            vivo = false;
            window.removeEventListener('resize', redimensionar);
            scene.traverse(o => {
                if (o.isMesh || o.isSprite) {
                    o.geometry?.dispose?.();
                    const m = o.material;
                    if (Array.isArray(m)) m.forEach(x => { x.map?.dispose?.(); x.dispose?.(); });
                    else if (m) { m.map?.dispose?.(); m.dispose?.(); }
                }
            });
            renderer.dispose();
            if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
        },
    };
}

// =====================================================================
//  COMPONENTE DE LA PISTA
// =====================================================================
function Pista({ jugadores, luz, meta, idYo, panoramica }) {
    const rootRef = useRef(null);
    const apiRef = useRef(null);

    useEffect(() => {
        if (!rootRef.current) return;
        apiRef.current = crearEscena(rootRef.current);
        return () => { apiRef.current?.dispose(); apiRef.current = null; };
    }, []);

    useEffect(() => {
        apiRef.current?.actualizar({ jugadores, luz, meta, idYo, panoramica });
    }, [jugadores, luz, meta, idYo, panoramica]);

    return <div ref={rootRef} style={{ position: 'absolute', inset: 0, zIndex: 0 }} />;
}

// =====================================================================
//  PANEL DE PREGUNTA (todos los tipos)
// =====================================================================
function PanelPregunta({ pregunta, luz, deshabilitado, onResponder }) {
    const [texto, setTexto] = useState('');
    const [orden, setOrden] = useState([]);
    const [mezcla, setMezcla] = useState([]);

    useEffect(() => {
        setTexto(''); setOrden([]);
        if (pregunta?.tipo === 'ORDENAR') {
            const idx = pregunta.bloques.map((_, i) => i);
            let m = barajar(idx);
            if (m.every((v, i) => v === idx[i]) && idx.length > 1) m = [...m.slice(1), m[0]];
            setMezcla(m);
        }
    }, [pregunta]);

    if (!pregunta) return null;
    const rojo = luz === ROJA;

    const enviar = (valor) => { if (!deshabilitado) onResponder(valor); };

    const btnBase = {
        padding: '13px 16px', borderRadius: 14, border: 'none', cursor: deshabilitado ? 'default' : 'pointer',
        fontWeight: 800, fontSize: 'clamp(0.95rem, 2.4vw, 1.15rem)', color: 'white', fontFamily: 'inherit',
        background: rojo ? 'linear-gradient(135deg,#c0392b,#7f1d1d)' : 'linear-gradient(135deg,#e6317f,#b3125f)',
        boxShadow: rojo ? '0 5px 0 #5c1212' : '0 5px 0 #8d0f4b', opacity: deshabilitado ? 0.55 : 1,
        transition: 'background .25s',
    };
    const inputStyle = {
        flex: 1, padding: '13px 15px', borderRadius: 13, border: '2px solid rgba(255,255,255,0.25)',
        background: 'rgba(255,255,255,0.12)', color: 'white', fontSize: '1.05rem', fontWeight: 700,
        outline: 'none', fontFamily: 'inherit', minWidth: 90,
    };

    return (
        <div style={{
            position: 'relative', zIndex: 5, padding: '14px clamp(10px,3vw,26px) max(16px, env(safe-area-inset-bottom))',
            background: rojo ? 'linear-gradient(180deg, rgba(120,15,15,0.92), rgba(60,5,5,0.97))'
                : 'linear-gradient(180deg, rgba(14,22,30,0.88), rgba(8,12,16,0.97))',
            borderTop: `3px solid ${rojo ? '#ff4d4d' : '#e6317f'}`,
            borderTopLeftRadius: 22, borderTopRightRadius: 22, transition: 'background .3s',
        }}>
            {rojo && (
                <div style={{ textAlign: 'center', color: '#ff8a8a', fontWeight: 900, letterSpacing: 1, marginBottom: 8, fontSize: '0.9rem' }}>
                    ⛔ LUZ ROJA — NO RESPONDAS O SERÁS ELIMINADO
                </div>
            )}

            <div style={{
                color: 'white', fontWeight: 800, textAlign: 'center', marginBottom: 12,
                fontSize: 'clamp(1.05rem, 3.2vw, 1.6rem)', lineHeight: 1.25,
            }}>
                {pregunta.enunciado}
            </div>

            {pregunta.tipo === 'MULTIPLE' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, maxWidth: 900, margin: '0 auto' }}>
                    {pregunta.opciones.map((o, i) => (
                        <button key={i} style={btnBase} onClick={() => enviar(o)}>{o}</button>
                    ))}
                </div>
            )}

            {pregunta.tipo === 'CORTA' && (
                <form onSubmit={e => { e.preventDefault(); if (texto.trim()) enviar(texto); }}
                    style={{ display: 'flex', gap: 10, maxWidth: 640, margin: '0 auto' }}>
                    <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Escribe tu respuesta…"
                        autoComplete="off" style={inputStyle} />
                    <button type="submit" style={{ ...btnBase, minWidth: 120 }}>Responder</button>
                </form>
            )}

            {pregunta.tipo === 'RELLENAR' && (
                <form onSubmit={e => { e.preventDefault(); if (texto.trim()) enviar(texto); }}
                    style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'center', maxWidth: 820, margin: '0 auto' }}>
                    {pregunta.bloques[0] && <span style={{ color: '#e7f3ec', fontSize: '1.05rem', fontWeight: 600 }}>{pregunta.bloques[0]}</span>}
                    <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="…" autoComplete="off"
                        style={{ ...inputStyle, flex: '0 1 220px', textAlign: 'center', borderColor: '#e6317f' }} />
                    {pregunta.bloques[2] && <span style={{ color: '#e7f3ec', fontSize: '1.05rem', fontWeight: 600 }}>{pregunta.bloques[2]}</span>}
                    <button type="submit" style={{ ...btnBase, minWidth: 120 }}>Responder</button>
                </form>
            )}

            {pregunta.tipo === 'ORDENAR' && (
                <div style={{ maxWidth: 860, margin: '0 auto' }}>
                    <div style={{
                        minHeight: 52, display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center',
                        padding: 9, borderRadius: 13, border: '2px dashed rgba(255,255,255,0.28)', marginBottom: 10,
                    }}>
                        {orden.length === 0 && <span style={{ color: '#8aa0ad', fontSize: '0.9rem' }}>Pulsa los bloques en el orden correcto…</span>}
                        {orden.map((bi, k) => (
                            <button key={k} onClick={() => setOrden(orden.filter((_, x) => x !== k))}
                                style={{ ...btnBase, padding: '9px 13px', fontSize: '0.98rem', boxShadow: 'none', background: '#1f7a5a' }}>
                                {pregunta.bloques[bi]}
                            </button>
                        ))}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 10 }}>
                        {mezcla.filter(bi => !orden.includes(bi)).map(bi => (
                            <button key={bi} onClick={() => setOrden([...orden, bi])}
                                style={{ ...btnBase, padding: '9px 13px', fontSize: '0.98rem' }}>
                                {pregunta.bloques[bi]}
                            </button>
                        ))}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <button
                            onClick={() => orden.length === pregunta.bloques.length && enviar(orden.map(i => pregunta.bloques[i]).join(' '))}
                            style={{ ...btnBase, minWidth: 190, opacity: orden.length === pregunta.bloques.length ? 1 : 0.45 }}>
                            ✔ Comprobar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// =====================================================================
//  HUD SUPERIOR
// =====================================================================
function HudSuperior({ luz, paso, meta, aciertos, fallos, sonido, setSonido, onSalir, titulo, extra }) {
    const conf = luz === VERDE
        ? { txt: '🟢 LUZ VERDE', bg: 'linear-gradient(135deg,#1ea65f,#0f7a45)' }
        : luz === AVISO
            ? { txt: '🟡 ¡SE GIRA!', bg: 'linear-gradient(135deg,#f0b429,#c98a08)' }
            : { txt: '🔴 LUZ ROJA', bg: 'linear-gradient(135deg,#e03131,#8d1111)' };

    return (
        <div style={{
            position: 'relative', zIndex: 5, padding: '10px clamp(10px,3vw,20px) 12px',
            background: 'linear-gradient(180deg, rgba(6,10,14,0.85), rgba(6,10,14,0))',
            display: 'flex', flexDirection: 'column', gap: 8,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={onSalir} title="Salir" style={hudBtn}><LogOut size={16} /></button>
                <button onClick={() => setSonido(s => !s)} title="Sonido" style={hudBtn}>
                    {sonido ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
                <div style={{
                    padding: '7px 16px', borderRadius: 999, background: conf.bg, color: 'white',
                    fontWeight: 900, fontSize: 'clamp(0.85rem,2.6vw,1.05rem)', letterSpacing: 0.6,
                    boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
                }}>{conf.txt}</div>
                <div style={{ flex: 1 }} />
                {typeof aciertos === 'number' && (
                    <>
                        <span style={chip('#0f7a45')}>✔ {aciertos}</span>
                        <span style={chip('#a32222')}>✘ {fallos}</span>
                    </>
                )}
                {extra}
            </div>
            {typeof paso === 'number' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, height: 12, borderRadius: 999, background: 'rgba(255,255,255,0.18)', overflow: 'hidden' }}>
                        <div style={{
                            width: `${Math.min(100, (paso / meta) * 100)}%`, height: '100%',
                            background: 'linear-gradient(90deg,#e6317f,#f5c518)', transition: 'width .4s',
                        }} />
                    </div>
                    <span style={{ color: 'white', fontWeight: 800, fontSize: '0.88rem', whiteSpace: 'nowrap' }}>
                        Paso {paso}/{meta}
                    </span>
                </div>
            )}
            {titulo && <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.76rem', fontWeight: 600 }}>{titulo}</div>}
        </div>
    );
}
const hudBtn = {
    width: 36, height: 36, borderRadius: 11, border: '1px solid rgba(255,255,255,0.25)',
    background: 'rgba(0,0,0,0.42)', color: 'white', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const chip = (bg) => ({
    padding: '5px 12px', borderRadius: 999, background: bg, color: 'white',
    fontWeight: 800, fontSize: '0.85rem',
});

// =====================================================================
//  HOOK: ciclo de luces local (individual y anfitrión)
// =====================================================================
function useCicloLuz({ activo, dificultad, audio, sonido, onCambio }) {
    const [luz, setLuz] = useState(VERDE);
    const luzRef = useRef(VERDE);
    const cambioRef = useRef(onCambio);
    cambioRef.current = onCambio;

    useEffect(() => { luzRef.current = luz; }, [luz]);

    useEffect(() => {
        if (!activo) return;
        const cfg = DIFICULTADES[dificultad] || DIFICULTADES.NORMAL;
        let timer = null, vivo = true;

        const pasar = (nueva) => {
            if (!vivo) return;
            setLuz(nueva);
            luzRef.current = nueva;
            cambioRef.current?.(nueva);
            let espera;
            if (nueva === VERDE) {
                espera = rnd(cfg.verde[0], cfg.verde[1]);
                if (sonido) audio.cancion(espera);
            } else if (nueva === AVISO) {
                espera = cfg.aviso;
                if (sonido) audio.aviso();
            } else {
                espera = rnd(cfg.roja[0], cfg.roja[1]);
                if (sonido) audio.roja();
            }
            const siguiente = nueva === VERDE ? AVISO : nueva === AVISO ? ROJA : VERDE;
            timer = setTimeout(() => pasar(siguiente), espera);
        };
        pasar(VERDE);
        return () => { vivo = false; clearTimeout(timer); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activo, dificultad, sonido]);

    return [luz, luzRef];
}

// =====================================================================
//  PARTIDA INDIVIDUAL
// =====================================================================
function PartidaSolo({ preguntas, titulo, meta, dificultad, nombre, usuario, onSalir, onReiniciar }) {
    const audioRef = useRef(null);
    if (!audioRef.current) audioRef.current = crearAudio();
    const audio = audioRef.current;

    const [sonido, setSonido] = useState(true);
    const [paso, setPaso] = useState(0);
    const [idx, setIdx] = useState(0);
    const [cola, setCola] = useState(() => barajar(preguntas));
    const [acertadas, setAcertadas] = useState([]);
    const [falladas, setFalladas] = useState([]);
    const [estado, setEstado] = useState('JUGANDO');   // JUGANDO | GANA | ELIMINADO
    const [aviso, setAviso] = useState(null);
    const [mostrarEnvio, setMostrarEnvio] = useState(false);
    const [guardado, setGuardado] = useState(false);

    useEffect(() => { audio.activo = sonido; }, [sonido, audio]);
    useEffect(() => () => audio.cerrar(), [audio]);

    const [luz, luzRef] = useCicloLuz({
        activo: estado === 'JUGANDO', dificultad, audio, sonido,
        onCambio: () => { },
    });

    const pregunta = cola[idx % cola.length] || null;

    const mostrarAviso = (texto, color) => {
        setAviso({ texto, color });
        setTimeout(() => setAviso(null), 900);
    };

    const responder = (dada) => {
        if (estado !== 'JUGANDO' || !pregunta) return;

        // ¡Respondiste con la luz roja!
        if (luzRef.current === ROJA) {
            if (sonido) audio.disparo();
            setEstado('ELIMINADO');
            return;
        }

        const ok = esRespuestaCorrecta(pregunta, dada);
        const registro = {
            enunciado: pregunta.enunciado, tipo: pregunta.tipo,
            correcta: pregunta.tipo === 'ORDENAR' ? pregunta.bloques.join(' ') : pregunta.correcta,
            dada: String(dada),
        };
        const nuevoPaso = ok ? paso + 1 : Math.max(0, paso - 1);
        if (ok) {
            setAcertadas(a => [...a, registro]);
            if (sonido) audio.acierto();
            mostrarAviso('✔ ¡Un paso adelante!', '#1ea65f');
        } else {
            setFalladas(f => [...f, registro]);
            if (sonido) audio.fallo();
            mostrarAviso('✘ Un paso atrás', '#e03131');
        }
        setPaso(nuevoPaso);
        if (nuevoPaso >= meta) { if (sonido) audio.meta(); setEstado('GANA'); }

        const siguiente = idx + 1;
        setIdx(siguiente);
        if (siguiente % cola.length === 0) setCola(c => barajar(c));
    };

    const jugadoresEscena = [{ id: 'yo', nombre: nombre || 'Tú', paso, numero: 456, eliminado: estado === 'ELIMINADO' }];

    const datosInforme = {
        titulo, aciertos: acertadas.length, fallos: falladas.length,
        intentos: acertadas.length + falladas.length, pasos: paso, meta,
        completado: estado === 'GANA', eliminado: estado === 'ELIMINADO',
        acertadas, falladas, modalidad: 'Individual',
    };

    return (
        <div style={contenedor}>
            <Pista jugadores={jugadoresEscena} luz={luz} meta={meta} idYo="yo" />

            <HudSuperior
                luz={luz} paso={paso} meta={meta}
                aciertos={acertadas.length} fallos={falladas.length}
                sonido={sonido} setSonido={setSonido} onSalir={onSalir} titulo={titulo}
            />

            <div style={{ flex: 1 }} />

            {aviso && (
                <div style={{
                    position: 'absolute', top: '32%', left: 0, right: 0, textAlign: 'center', zIndex: 6,
                    color: aviso.color, fontSize: 'clamp(1.6rem,6vw,3rem)', fontWeight: 900,
                    textShadow: '0 4px 18px rgba(0,0,0,0.8)', pointerEvents: 'none',
                }}>{aviso.texto}</div>
            )}

            {estado === 'JUGANDO' && (
                <PanelPregunta pregunta={pregunta} luz={luz} deshabilitado={false} onResponder={responder} />
            )}

            {estado !== 'JUGANDO' && (
                <PantallaFinal
                    victoria={estado === 'GANA'} datos={datosInforme}
                    onReintentar={onReiniciar} onSalir={onSalir}
                    onEnviar={() => setMostrarEnvio(true)}
                    guardado={guardado}
                    onGuardar={() => {
                        guardarRegistroLocal(TIPO_JUEGO, {
                            titulo, aciertos: acertadas.length, intentos: acertadas.length + falladas.length,
                            porcentaje: Math.round((acertadas.length / Math.max(1, acertadas.length + falladas.length)) * 100),
                            nombre: nombre || (usuario?.displayName || 'Jugador'), via: 'local',
                        });
                        setGuardado(true);
                    }}
                />
            )}

            {mostrarEnvio && (
                <ModalEnviarProfe datos={datosInforme} nombreSugerido={nombre} onClose={() => setMostrarEnvio(false)} />
            )}
        </div>
    );
}

// =====================================================================
//  PARTIDA ONLINE — ALUMNO
// =====================================================================
function PartidaOnline({ codigoSala, nombre, usuario, onSalir }) {
    const audioRef = useRef(null);
    if (!audioRef.current) audioRef.current = crearAudio();
    const audio = audioRef.current;

    const [sonido, setSonido] = useState(true);
    const [sala, setSala] = useState(null);
    const [error, setError] = useState('');
    const [paso, setPaso] = useState(0);
    const [idx, setIdx] = useState(0);
    const [cola, setCola] = useState([]);
    const [acertadas, setAcertadas] = useState([]);
    const [falladas, setFalladas] = useState([]);
    const [estado, setEstado] = useState('ESPERANDO'); // ESPERANDO | JUGANDO | GANA | ELIMINADO
    const [aviso, setAviso] = useState(null);
    const [mostrarEnvio, setMostrarEnvio] = useState(false);

    const clave = claveJugador(nombre);
    const refSala = doc(db, 'live_games', String(codigoSala).toUpperCase());
    const luzRef = useRef(VERDE);
    const estadoRef = useRef(estado);
    estadoRef.current = estado;

    useEffect(() => { audio.activo = sonido; }, [sonido, audio]);
    useEffect(() => () => audio.cerrar(), [audio]);

    // Entrar y escuchar la sala
    useEffect(() => {
        let unsub = null, vivo = true;
        (async () => {
            try {
                const snap = await getDoc(refSala);
                if (!snap.exists()) { setError('La sala no existe o ya se ha cerrado.'); return; }
                await updateDoc(refSala, {
                    [`jugadores.${clave}`]: { nombre, paso: 0, aciertos: 0, fallos: 0, eliminado: false, terminado: false, ts: Date.now() },
                });
                if (!vivo) return;
                unsub = onSnapshot(refSala, s => {
                    if (!s.exists()) { setError('La sala se ha cerrado.'); return; }
                    const d = s.data();
                    setSala(d);
                    luzRef.current = d.luz || VERDE;
                    if (d.estado === 'jugando' && estadoRef.current === 'ESPERANDO') {
                        setCola(barajar(d.preguntas || []));
                        setEstado('JUGANDO');
                    }
                });
            } catch (e) { setError('Error al entrar: ' + e.message); }
        })();
        return () => { vivo = false; if (unsub) unsub(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [codigoSala]);

    // Sonido al cambiar la luz
    const luz = sala?.luz || VERDE;
    const luzAnterior = useRef(VERDE);
    useEffect(() => {
        if (luz === luzAnterior.current || !sonido || estado !== 'JUGANDO') { luzAnterior.current = luz; return; }
        if (luz === VERDE) audio.cancion(4000);
        else if (luz === AVISO) audio.aviso();
        else audio.roja();
        luzAnterior.current = luz;
    }, [luz, sonido, estado, audio]);

    const meta = sala?.meta || 15;
    const pregunta = cola.length ? cola[idx % cola.length] : null;

    const sincronizar = useCallback(async (datos) => {
        try {
            await updateDoc(refSala, { [`jugadores.${clave}`]: { nombre, ts: Date.now(), ...datos } });
        } catch (e) { console.warn('sync', e); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [codigoSala, clave, nombre]);

    const mostrarAviso = (texto, color) => { setAviso({ texto, color }); setTimeout(() => setAviso(null), 900); };

    const responder = (dada) => {
        if (estado !== 'JUGANDO' || !pregunta) return;

        if (luzRef.current === ROJA) {
            if (sonido) audio.disparo();
            setEstado('ELIMINADO');
            sincronizar({ paso, aciertos: acertadas.length, fallos: falladas.length, eliminado: true, terminado: true });
            return;
        }

        const ok = esRespuestaCorrecta(pregunta, dada);
        const registro = {
            enunciado: pregunta.enunciado, tipo: pregunta.tipo,
            correcta: pregunta.tipo === 'ORDENAR' ? pregunta.bloques.join(' ') : pregunta.correcta,
            dada: String(dada),
        };
        const nAc = ok ? acertadas.length + 1 : acertadas.length;
        const nFa = ok ? falladas.length : falladas.length + 1;
        const nPaso = ok ? paso + 1 : Math.max(0, paso - 1);

        if (ok) { setAcertadas(a => [...a, registro]); if (sonido) audio.acierto(); mostrarAviso('✔ ¡Un paso adelante!', '#1ea65f'); }
        else { setFalladas(f => [...f, registro]); if (sonido) audio.fallo(); mostrarAviso('✘ Un paso atrás', '#e03131'); }

        setPaso(nPaso);
        setIdx(i => i + 1);

        const gana = nPaso >= meta;
        if (gana) { if (sonido) audio.meta(); setEstado('GANA'); }
        sincronizar({ paso: nPaso, aciertos: nAc, fallos: nFa, eliminado: false, terminado: gana });
    };

    const listaJugadores = Object.entries(sala?.jugadores || {}).map(([id, j], i) => ({
        id, nombre: j.nombre || id, paso: j.paso || 0, numero: 100 + i, eliminado: !!j.eliminado,
    }));

    const datosInforme = {
        titulo: sala?.titulo || 'Sala en vivo', aciertos: acertadas.length, fallos: falladas.length,
        intentos: acertadas.length + falladas.length, pasos: paso, meta,
        completado: estado === 'GANA', eliminado: estado === 'ELIMINADO',
        acertadas, falladas, modalidad: 'Online', codigoSala,
    };

    if (error) return <PantallaMensaje titulo="⚠ " texto={error} onSalir={onSalir} />;
    if (estado === 'ESPERANDO') {
        return (
            <PantallaMensaje
                titulo="⏳ Esperando al profesor"
                texto={`Estás dentro de la sala ${String(codigoSala).toUpperCase()}. La partida empezará en cuanto el profesor pulse "Empezar".`}
                onSalir={onSalir}
                extra={
                    <div style={{ marginTop: 16, color: '#8aa0ad', fontSize: '0.9rem' }}>
                        Jugadores conectados: <b style={{ color: '#7dffb2' }}>{listaJugadores.length}</b>
                    </div>
                }
            />
        );
    }

    return (
        <div style={contenedor}>
            <Pista jugadores={listaJugadores} luz={luz} meta={meta} idYo={clave} />

            <HudSuperior
                luz={luz} paso={paso} meta={meta}
                aciertos={acertadas.length} fallos={falladas.length}
                sonido={sonido} setSonido={setSonido} onSalir={onSalir}
                titulo={`${sala?.titulo || ''} · Sala ${String(codigoSala).toUpperCase()}`}
                extra={<span style={chip('#2c3e50')}>👥 {listaJugadores.length}</span>}
            />

            <div style={{ flex: 1 }} />

            {aviso && (
                <div style={{
                    position: 'absolute', top: '32%', left: 0, right: 0, textAlign: 'center', zIndex: 6,
                    color: aviso.color, fontSize: 'clamp(1.6rem,6vw,3rem)', fontWeight: 900,
                    textShadow: '0 4px 18px rgba(0,0,0,0.8)', pointerEvents: 'none',
                }}>{aviso.texto}</div>
            )}

            {estado === 'JUGANDO' && sala?.estado === 'jugando' && (
                <PanelPregunta pregunta={pregunta} luz={luz} deshabilitado={false} onResponder={responder} />
            )}

            {(estado !== 'JUGANDO' || sala?.estado === 'fin') && (
                <PantallaFinal
                    victoria={estado === 'GANA'} datos={datosInforme}
                    onSalir={onSalir} onEnviar={() => setMostrarEnvio(true)}
                    clasificacion={listaJugadores}
                />
            )}

            {mostrarEnvio && (
                <ModalEnviarProfe datos={datosInforme} nombreSugerido={nombre} onClose={() => setMostrarEnvio(false)} />
            )}
        </div>
    );
}

// =====================================================================
//  SALA ONLINE — PROFESOR (anfitrión)
// =====================================================================
function SalaHost({ preguntas, titulo, meta, dificultad, usuario, onSalir }) {
    const audioRef = useRef(null);
    if (!audioRef.current) audioRef.current = crearAudio();
    const audio = audioRef.current;

    const [sonido, setSonido] = useState(true);
    const [codigo, setCodigo] = useState('');
    const [sala, setSala] = useState(null);
    const [error, setError] = useState('');
    const creada = useRef(false);

    useEffect(() => { audio.activo = sonido; }, [sonido, audio]);

    // Crear la sala una sola vez
    useEffect(() => {
        if (creada.current) return;
        creada.current = true;
        let unsub = null;
        (async () => {
            try {
                const code = Math.random().toString(36).substring(2, 7).toUpperCase();
                await setDoc(doc(db, 'live_games', code), {
                    codigo: code,
                    tipoJuego: TIPO_JUEGO,
                    estado: 'esperando',
                    luz: VERDE,
                    meta,
                    dificultad,
                    titulo,
                    preguntas: preguntas.slice(0, 60),
                    jugadores: {},
                    hostNombre: usuario?.displayName || 'Profesor',
                    createdAt: serverTimestamp(),
                });
                setCodigo(code);
                unsub = onSnapshot(doc(db, 'live_games', code), s => { if (s.exists()) setSala(s.data()); });
            } catch (e) { setError('No se pudo crear la sala: ' + e.message); }
        })();
        return () => { if (unsub) unsub(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const jugando = sala?.estado === 'jugando';

    // El anfitrión marca el ritmo de las luces para todos
    const [luzLocal] = useCicloLuz({
        activo: jugando, dificultad, audio, sonido,
        onCambio: (nueva) => {
            if (!codigo) return;
            updateDoc(doc(db, 'live_games', codigo), { luz: nueva, luzTs: Date.now() }).catch(() => { });
        },
    });

    const lista = Object.entries(sala?.jugadores || {})
        .map(([id, j], i) => ({
            id, nombre: j.nombre || id, paso: j.paso || 0, numero: 100 + i,
            eliminado: !!j.eliminado, terminado: !!j.terminado,
            aciertos: j.aciertos || 0, fallos: j.fallos || 0,
        }));

    const empezar = () => updateDoc(doc(db, 'live_games', codigo), { estado: 'jugando', luz: VERDE }).catch(() => { });
    const terminar = () => updateDoc(doc(db, 'live_games', codigo), { estado: 'fin' }).catch(() => { });

    if (error) return <PantallaMensaje titulo="⚠" texto={error} onSalir={onSalir} />;
    if (!codigo) return <PantallaMensaje titulo="⏳" texto="Creando la sala…" onSalir={onSalir} />;

    // ---------- LOBBY ----------
    if (!jugando && sala?.estado !== 'fin') {
        return (
            <div style={{ ...menuWrap, flexDirection: 'column', gap: 16 }}>
                <div style={tarjeta}>
                    <h2 style={{ margin: '0 0 6px', color: '#e6317f', fontSize: '1.5rem' }}>🦑 Sala en vivo</h2>
                    <p style={{ color: '#9fb0bb', margin: '0 0 14px', fontSize: '0.92rem' }}>{titulo} · {meta} pasos · {DIFICULTADES[dificultad].nombre}</p>

                    <div className="big-code" style={{
                        fontSize: 'clamp(2.4rem,9vw,4rem)', fontWeight: 900, letterSpacing: 8,
                        color: '#7dffb2', textAlign: 'center', padding: '10px 0',
                    }}>{codigo}</div>

                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                        <QRSalaBoton codigo={codigo} />
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 12, maxHeight: 220, overflowY: 'auto' }}>
                        <div style={{ color: '#9fb0bb', fontSize: '0.8rem', fontWeight: 700, marginBottom: 8 }}>
                            JUGADORES ({lista.length})
                        </div>
                        {lista.length === 0
                            ? <div style={{ color: '#6d7d87', fontSize: '0.88rem' }}>Esperando a que entren los alumnos…</div>
                            : lista.map(j => (
                                <div key={j.id} style={{ color: '#e7f3ec', padding: '5px 0', fontSize: '0.95rem' }}>🟢 {j.nombre}</div>
                            ))}
                    </div>

                    <button onClick={empezar} disabled={lista.length === 0}
                        style={{ ...btnPrincipal, marginTop: 16, opacity: lista.length === 0 ? 0.5 : 1 }}>
                        <Play size={18} /> Empezar partida
                    </button>
                    <button onClick={onSalir} style={btnSecundario}>Cerrar sala</button>
                </div>
            </div>
        );
    }

    // ---------- FIN ----------
    if (sala?.estado === 'fin') {
        const orden = [...lista].sort((a, b) => (b.paso - a.paso) || (b.aciertos - a.aciertos));
        return (
            <div style={{ ...menuWrap, flexDirection: 'column' }}>
                <div style={{ ...tarjeta, maxWidth: 620 }}>
                    <h2 style={{ margin: '0 0 12px', color: '#e6317f' }}><Trophy size={22} style={{ verticalAlign: -3 }} /> Resultados · {titulo}</h2>
                    <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 10, maxHeight: 380, overflowY: 'auto' }}>
                        {orden.map((j, i) => (
                            <div key={j.id} style={{
                                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 6px',
                                borderBottom: '1px solid rgba(255,255,255,0.07)', color: '#e7f3ec',
                            }}>
                                <span style={{ width: 30, fontWeight: 900, color: i < 3 ? '#f5c518' : '#7f8c8d' }}>#{i + 1}</span>
                                <span style={{ flex: 1, fontWeight: 700 }}>
                                    {j.nombre} {j.eliminado && <span style={{ color: '#e74c3c', fontSize: '0.8rem' }}>· eliminado</span>}
                                    {j.paso >= meta && <span style={{ color: '#2ecc71', fontSize: '0.8rem' }}> · ¡meta!</span>}
                                </span>
                                <span style={chip('#0f7a45')}>✔ {j.aciertos}</span>
                                <span style={chip('#a32222')}>✘ {j.fallos}</span>
                                <span style={{ ...chip('#34495e'), minWidth: 62, textAlign: 'center' }}>{j.paso}/{meta}</span>
                            </div>
                        ))}
                    </div>
                    <button onClick={onSalir} style={{ ...btnPrincipal, marginTop: 16 }}>Salir</button>
                </div>
            </div>
        );
    }

    // ---------- PARTIDA EN CURSO (vista del profesor) ----------
    return (
        <div style={contenedor}>
            <Pista jugadores={lista} luz={luzLocal} meta={meta} idYo={null} panoramica />
            <HudSuperior
                luz={luzLocal} paso={undefined} meta={meta}
                sonido={sonido} setSonido={setSonido} onSalir={onSalir}
                titulo={`${titulo} · Sala ${codigo}`}
                extra={
                    <>
                        <span style={chip('#2c3e50')}>👥 {lista.length}</span>
                        <button onClick={terminar} style={{ ...chip('#c0392b'), border: 'none', cursor: 'pointer' }}>Terminar</button>
                    </>
                }
            />
            <div style={{ flex: 1 }} />
            <div style={{
                position: 'relative', zIndex: 5, padding: '12px 16px max(14px, env(safe-area-inset-bottom))',
                background: 'linear-gradient(180deg, rgba(8,12,16,0.2), rgba(8,12,16,0.94))',
                display: 'flex', gap: 8, overflowX: 'auto',
            }}>
                {[...lista].sort((a, b) => b.paso - a.paso).map(j => (
                    <div key={j.id} style={{
                        flex: '0 0 auto', padding: '8px 13px', borderRadius: 12,
                        background: j.eliminado ? 'rgba(192,57,43,0.25)' : 'rgba(255,255,255,0.09)',
                        border: `1px solid ${j.eliminado ? '#c0392b' : 'rgba(255,255,255,0.15)'}`, color: 'white',
                    }}>
                        <div style={{ fontWeight: 800, fontSize: '0.88rem' }}>{j.eliminado ? '💀 ' : ''}{j.nombre}</div>
                        <div style={{ fontSize: '0.76rem', color: '#9fb0bb' }}>
                            {j.paso}/{meta} · ✔{j.aciertos} ✘{j.fallos}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// =====================================================================
//  PANTALLAS AUXILIARES
// =====================================================================
function PantallaMensaje({ titulo, texto, onSalir, extra }) {
    return (
        <div style={menuWrap}>
            <div style={{ ...tarjeta, textAlign: 'center' }}>
                <div style={{ fontSize: '2.6rem', marginBottom: 8 }}>{titulo}</div>
                <p style={{ color: '#cfd9df', lineHeight: 1.5 }}>{texto}</p>
                {extra}
                <button onClick={onSalir} style={{ ...btnSecundario, marginTop: 18 }}>Salir</button>
            </div>
        </div>
    );
}

function ListaPreguntas({ titulo, items, color }) {
    if (!items.length) return null;
    return (
        <div style={{ marginTop: 12, textAlign: 'left' }}>
            <div style={{ color, fontWeight: 800, fontSize: '0.86rem', marginBottom: 6 }}>{titulo} ({items.length})</div>
            <div style={{ maxHeight: 160, overflowY: 'auto', background: 'rgba(0,0,0,0.28)', borderRadius: 10, padding: 10 }}>
                {items.map((r, i) => (
                    <div key={i} style={{ padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ color: '#e7f3ec', fontSize: '0.86rem', fontWeight: 600 }}>{r.enunciado}</div>
                        <div style={{ color: '#8aa0ad', fontSize: '0.78rem' }}>
                            Tu respuesta: <b style={{ color }}>{r.dada || '—'}</b>
                            {r.dada && limpiar(r.dada) !== limpiar(r.correcta) && <> · Correcta: <b style={{ color: '#2ecc71' }}>{r.correcta}</b></>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function PantallaFinal({ victoria, datos, onReintentar, onSalir, onEnviar, onGuardar, guardado, clasificacion }) {
    const pct = datos.intentos > 0 ? Math.round((datos.aciertos / datos.intentos) * 100) : 0;
    return (
        <div style={{ ...overlay, zIndex: 20 }}>
            <div style={{ ...tarjeta, maxWidth: 560, textAlign: 'center' }}>
                <div style={{ fontSize: 'clamp(3rem,12vw,5rem)' }}>{victoria ? '🏆' : datos.eliminado ? '💀' : '🏁'}</div>
                <h2 style={{
                    margin: '4px 0 10px', fontSize: 'clamp(1.6rem,6vw,2.6rem)',
                    color: victoria ? '#2ecc71' : datos.eliminado ? '#e6317f' : '#f5c518',
                }}>
                    {victoria ? '¡HAS CRUZADO LA META!' : datos.eliminado ? '¡ELIMINADO!' : 'FIN DE LA PARTIDA'}
                </h2>
                {datos.eliminado && (
                    <p style={{ color: '#cfd9df', marginTop: 0 }}>
                        Respondiste con la luz roja en el paso {datos.pasos} de {datos.meta}.
                    </p>
                )}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', margin: '10px 0 4px' }}>
                    <span style={chip('#0f7a45')}>✔ {datos.aciertos} acertadas</span>
                    <span style={chip('#a32222')}>✘ {datos.fallos} falladas</span>
                    <span style={chip('#34495e')}>{pct} % de acierto</span>
                    <span style={chip('#6c3483')}>Paso {datos.pasos}/{datos.meta}</span>
                </div>

                <ListaPreguntas titulo="✔ Preguntas acertadas" items={datos.acertadas} color="#2ecc71" />
                <ListaPreguntas titulo="✘ Preguntas falladas" items={datos.falladas} color="#e74c3c" />

                {clasificacion && clasificacion.length > 1 && (
                    <div style={{ marginTop: 12, textAlign: 'left' }}>
                        <div style={{ color: '#f5c518', fontWeight: 800, fontSize: '0.86rem', marginBottom: 6 }}>🏁 Clasificación</div>
                        <div style={{ maxHeight: 140, overflowY: 'auto', background: 'rgba(0,0,0,0.28)', borderRadius: 10, padding: 8 }}>
                            {[...clasificacion].sort((a, b) => b.paso - a.paso).map((j, i) => (
                                <div key={j.id} style={{ display: 'flex', gap: 8, color: '#e7f3ec', fontSize: '0.86rem', padding: '3px 0' }}>
                                    <span style={{ width: 24, color: '#7f8c8d' }}>#{i + 1}</span>
                                    <span style={{ flex: 1 }}>{j.eliminado ? '💀 ' : ''}{j.nombre}</span>
                                    <b>{j.paso}</b>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 18 }}>
                    <button onClick={onEnviar} style={btnPrincipal}>📤 Enviar al profesor</button>
                    {onGuardar && (
                        <button onClick={onGuardar} disabled={guardado}
                            style={{ ...btnSecundario, background: guardado ? '#1e6b45' : 'rgba(255,255,255,0.12)' }}>
                            {guardado ? '✅ Guardado en Mis registros' : '💾 Guardar en Mis registros'}
                        </button>
                    )}
                    {onReintentar && <button onClick={onReintentar} style={btnSecundario}>🔁 Volver a intentar</button>}
                    <button onClick={onSalir} style={btnSecundario}>Salir</button>
                </div>
            </div>
        </div>
    );
}

// =====================================================================
//  MODAL ENVIAR AL PROFESOR
// =====================================================================
function ModalEnviarProfe({ datos, nombreSugerido, onClose }) {
    const [codigo, setCodigo] = useState('');
    const [nombre, setNombre] = useState(nombreSugerido || '');
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
            const recorta = (arr) => (arr || []).slice(0, 40).map(r => ({
                enunciado: String(r.enunciado || '').slice(0, 200),
                tipo: r.tipo, dada: String(r.dada || '').slice(0, 120), correcta: String(r.correcta || '').slice(0, 120),
            }));
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: TIPO_JUEGO,
                modalidad: datos.modalidad || 'Individual',
                fecha: new Date(),
                codigoProfesor: code,
                recursoTitulo: datos.titulo || '',
                jugadores: [{
                    nombre: nombre.trim(), curso: curso.trim(),
                    aciertos: datos.aciertos, fallos: datos.fallos, intentos: datos.intentos,
                    porcentaje: datos.intentos > 0 ? Math.round((datos.aciertos / datos.intentos) * 100) : 0,
                    pasos: datos.pasos, meta: datos.meta,
                    completado: !!datos.completado, eliminado: !!datos.eliminado,
                    acertadas: recorta(datos.acertadas),
                    falladas: recorta(datos.falladas),
                }],
            });
            guardarRegistroLocal(TIPO_JUEGO, {
                titulo: datos.titulo, aciertos: datos.aciertos, intentos: datos.intentos,
                porcentaje: datos.intentos > 0 ? Math.round((datos.aciertos / datos.intentos) * 100) : 0,
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 14 }}>
            <div style={{ background: '#1e272e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, width: '100%', maxWidth: 380, padding: '24px 26px', color: 'white', fontFamily: "'Segoe UI', sans-serif" }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#e6317f' }}>📤 Enviar al profesor</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.2rem' }}>✕</button>
                </div>
                {enviado ? (
                    <div style={{ textAlign: 'center', padding: '18px 0' }}>
                        <div style={{ fontSize: '3rem' }}>✅</div>
                        <div style={{ color: '#2ecc71', fontWeight: 700 }}>¡Informe enviado!</div>
                        <div style={{ color: '#aaa', fontSize: '0.88rem', marginTop: 8 }}>
                            {datos.aciertos} acertadas · {datos.fallos} falladas
                        </div>
                        <button onClick={onClose} style={{ marginTop: 16, padding: '9px 22px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', color: 'white' }}>Cerrar</button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {[['nombre', 'Nombre y apellido', nombre, setNombre, 'Tu nombre completo', false],
                        ['curso', 'Curso', curso, setCurso, 'Ej: 3º ESO A', false],
                        ['codigo', 'Código del profesor', codigo, v => setCodigo(String(v).toUpperCase()), 'Ej: PROF01', true],
                        ].map(([key, label, val, setter, ph, mono]) => (
                            <div key={key}>
                                <label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 }}>{label}</label>
                                <input value={val} onChange={e => setter(e.target.value)} placeholder={ph} maxLength={key === 'codigo' ? 10 : undefined}
                                    style={{ ...inp, letterSpacing: mono ? 2 : 0, fontWeight: mono ? 700 : 400 }} />
                            </div>
                        ))}
                        {error && <div style={{ color: '#e74c3c', fontSize: '0.8rem' }}>⚠ {error}</div>}
                        <div style={{ display: 'flex', gap: 9, marginTop: 4 }}>
                            <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', cursor: 'pointer', color: 'white', fontFamily: 'inherit' }}>Cancelar</button>
                            <button onClick={enviar} disabled={enviando} style={{ flex: 2, padding: 10, borderRadius: 10, border: 'none', background: enviando ? '#555' : 'linear-gradient(135deg,#e6317f,#b3125f)', color: 'white', fontWeight: 700, cursor: enviando ? 'default' : 'pointer', fontFamily: 'inherit' }}>
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
//  BUSCADOR DE RECURSOS
// =====================================================================
function BuscadorRecursos({ onBack, onPick }) {
    const [busqueda, setBusqueda] = useState('');
    const [todos, setTodos] = useState([]);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const snap = await getDocs(query(collection(db, 'resources'), where('isPrivate', '==', false)));
                const docs = snap.docs.map(d => ({ ...d.data(), id: d.id }));
                const jugables = docs
                    .map(r => ({ r, n: preguntasDeRecurso(r).length }))
                    .filter(x => x.n > 0)
                    .sort((a, b) => (b.r.playCount || 0) - (a.r.playCount || 0));
                setTodos(jugables);
            } catch (e) { console.error('Buscador Calamar:', e); }
            setCargando(false);
        })();
    }, []);

    const q = limpiar(busqueda);
    const resultados = !q ? todos : todos.filter(({ r }) =>
        limpiar(r.titulo).includes(q) || limpiar(r.temas).includes(q) ||
        (r.hojas || []).some(h => limpiar(h.nombreHoja).includes(q))
    );

    return (
        <div style={menuWrap}>
            <div style={{ ...tarjeta, maxWidth: 540 }}>
                <button onClick={onBack} style={btnAtras}><ArrowLeft size={16} /> Atrás</button>
                <h2 style={{ color: '#e6317f', margin: '6px 0 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.3rem' }}>
                    <Search size={20} /> Buscar recurso
                </h2>
                <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Título, tema, hoja…"
                    style={{
                        width: '100%', padding: 11, borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)',
                        background: 'rgba(0,0,0,0.35)', color: '#e7f3ec', marginBottom: 12, boxSizing: 'border-box', fontFamily: 'inherit',
                    }} />
                <div style={{ maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {cargando ? <p style={{ color: '#8aa0ad', textAlign: 'center' }}>Cargando biblioteca…</p>
                        : resultados.length === 0 ? <p style={{ color: '#8aa0ad', textAlign: 'center' }}>Sin recursos compatibles.</p>
                            : resultados.map(({ r, n }) => (
                                <button key={r.id} onClick={() => onPick(r)} style={{
                                    textAlign: 'left', padding: '11px 13px', borderRadius: 10,
                                    border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)',
                                    color: '#e7f3ec', cursor: 'pointer', fontFamily: 'inherit',
                                }}>
                                    <div style={{ fontWeight: 700 }}>{r.titulo || 'Sin título'}</div>
                                    <div style={{ fontSize: 11, color: '#8aa0ad', marginTop: 3 }}>
                                        {r.tipoJuego || 'Recurso'}{r.profesorNombre ? ` · ${r.profesorNombre}` : ''} · {n} pregunta(s)
                                    </div>
                                </button>
                            ))}
                </div>
            </div>
        </div>
    );
}

// =====================================================================
//  COMPONENTE PRINCIPAL
// =====================================================================
export default function JuegoCalamar({ recurso = null, usuario, onExit, autoStart = false, codigoSala = null }) {
    const [pantalla, setPantalla] = useState(codigoSala ? 'UNIRSE' : 'MENU');
    const [preguntas, setPreguntas] = useState([]);
    const [titulo, setTitulo] = useState('Modo libre');
    const [meta, setMeta] = useState(15);
    const [dificultad, setDificultad] = useState('NORMAL');
    const [nombre, setNombre] = useState(usuario?.displayName || '');
    const [codigoEntrada, setCodigoEntrada] = useState(String(codigoSala || '').toUpperCase());
    const [errorUnir, setErrorUnir] = useState('');
    const [semilla, setSemilla] = useState(0);   // fuerza reinicio de la partida

    const fuente = useRef({ preguntas: [], titulo: 'Modo libre' });

    const preparar = useCallback((lista, tit) => {
        if (!lista || lista.length === 0) {
            alert('Ese recurso no tiene preguntas compatibles (opción múltiple, respuesta corta, rellenar u ordenar).');
            return false;
        }
        fuente.current = { preguntas: lista, titulo: tit };
        setPreguntas(lista); setTitulo(tit);
        return true;
    }, []);

    // Arranque directo desde un enlace con recurso
    useEffect(() => {
        if (!autoStart || !recurso) return;
        const lista = preguntasDeRecurso(recurso);
        if (lista.length) { preparar(lista, recurso.titulo || 'Recurso'); setPantalla('CONFIG'); }
    }, [autoStart, recurso, preparar]);

    const salirAlMenu = () => { setPantalla('MENU'); setSemilla(s => s + 1); };

    // ---------------- PANTALLAS DE JUEGO ----------------
    if (pantalla === 'SOLO') {
        return (
            <PartidaSolo
                key={'solo' + semilla}
                preguntas={preguntas} titulo={titulo} meta={meta} dificultad={dificultad}
                nombre={nombre || 'Jugador 456'} usuario={usuario}
                onSalir={salirAlMenu}
                onReiniciar={() => setSemilla(s => s + 1)}
            />
        );
    }

    if (pantalla === 'HOST') {
        return (
            <SalaHost
                key={'host' + semilla}
                preguntas={preguntas} titulo={titulo} meta={meta} dificultad={dificultad}
                usuario={usuario} onSalir={salirAlMenu}
            />
        );
    }

    if (pantalla === 'ONLINE') {
        return (
            <PartidaOnline
                key={'online' + codigoEntrada}
                codigoSala={codigoEntrada} nombre={nombre} usuario={usuario}
                onSalir={() => { if (codigoSala) onExit?.(); else salirAlMenu(); }}
            />
        );
    }

    if (pantalla === 'BUSCADOR') {
        return (
            <BuscadorRecursos
                onBack={() => setPantalla('MENU')}
                onPick={(r) => {
                    if (preparar(preguntasDeRecurso(r), r.titulo || 'Recurso')) setPantalla('CONFIG');
                }}
            />
        );
    }

    // ---------------- UNIRSE A UNA SALA ----------------
    if (pantalla === 'UNIRSE') {
        const entrar = async () => {
            const code = codigoEntrada.trim().toUpperCase();
            if (!nombre.trim()) { setErrorUnir('Escribe tu nombre.'); return; }
            if (!code) { setErrorUnir('Escribe el código de la sala.'); return; }
            try {
                const snap = await getDoc(doc(db, 'live_games', code));
                if (!snap.exists()) { setErrorUnir('No existe esa sala.'); return; }
                if (snap.data().tipoJuego !== TIPO_JUEGO) { setErrorUnir('Esa sala es de otro juego.'); return; }
                setCodigoEntrada(code);
                setPantalla('ONLINE');
            } catch (e) { setErrorUnir('Error: ' + e.message); }
        };
        return (
            <div style={menuWrap}>
                <div style={{ ...tarjeta, maxWidth: 400 }}>
                    {!codigoSala && <button onClick={() => setPantalla('MENU')} style={btnAtras}><ArrowLeft size={16} /> Atrás</button>}
                    <h2 style={{ color: '#e6317f', margin: '6px 0 14px', fontSize: '1.35rem' }}>🦑 Unirse a una sala</h2>
                    <label style={etiquetaCampo}>Tu nombre</label>
                    <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre y apellido" style={campo} />
                    <label style={{ ...etiquetaCampo, marginTop: 12 }}>Código de la sala</label>
                    <input value={codigoEntrada} onChange={e => setCodigoEntrada(e.target.value.toUpperCase())}
                        placeholder="ABC12" maxLength={8} style={{ ...campo, letterSpacing: 5, fontWeight: 800, textAlign: 'center' }} />
                    {errorUnir && <div style={{ color: '#e74c3c', fontSize: '0.83rem', marginTop: 8 }}>⚠ {errorUnir}</div>}
                    <button onClick={entrar} style={{ ...btnPrincipal, marginTop: 16 }}><Play size={18} /> Entrar</button>
                    <button onClick={() => (codigoSala ? onExit?.() : setPantalla('MENU'))} style={btnSecundario}>Cancelar</button>
                </div>
            </div>
        );
    }

    // ---------------- CONFIGURACIÓN DE PARTIDA ----------------
    if (pantalla === 'CONFIG') {
        return (
            <div style={menuWrap}>
                <div style={{ ...tarjeta, maxWidth: 460 }}>
                    <button onClick={() => setPantalla('MENU')} style={btnAtras}><ArrowLeft size={16} /> Atrás</button>
                    <h2 style={{ color: '#e6317f', margin: '6px 0 4px', fontSize: '1.35rem' }}>🦑 Preparar partida</h2>
                    <p style={{ color: '#9fb0bb', margin: '0 0 16px', fontSize: '0.9rem' }}>
                        {titulo} · {preguntas.length} preguntas
                    </p>

                    <label style={etiquetaCampo}>Tu nombre</label>
                    <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre y apellido" style={campo} />

                    <label style={{ ...etiquetaCampo, marginTop: 14 }}>Pasos hasta la meta</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {[10, 15, 20, 30].map(n => (
                            <button key={n} onClick={() => setMeta(n)} style={opcionChip(meta === n)}>{n}</button>
                        ))}
                    </div>

                    <label style={{ ...etiquetaCampo, marginTop: 14 }}>Dificultad (ritmo de las luces)</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {Object.entries(DIFICULTADES).map(([k, v]) => (
                            <button key={k} onClick={() => setDificultad(k)} style={opcionChip(dificultad === k)}>{v.nombre}</button>
                        ))}
                    </div>

                    <button onClick={() => { setSemilla(s => s + 1); setPantalla('SOLO'); }} style={{ ...btnPrincipal, marginTop: 20 }}>
                        <Play size={18} /> Jugar yo solo
                    </button>
                    <button onClick={() => { setSemilla(s => s + 1); setPantalla('HOST'); }} style={{ ...btnSecundario, background: 'rgba(230,49,127,0.2)', border: '1px solid #e6317f' }}>
                        <Users size={17} style={{ verticalAlign: -3, marginRight: 6 }} /> Crear sala online (profesor)
                    </button>
                </div>
            </div>
        );
    }

    // ---------------- MENÚ PRINCIPAL ----------------
    const bancoLibre = BANCO_LIBRE.map(normalizarPreguntaCalamar).filter(Boolean);
    const recursoPropio = recurso ? preguntasDeRecurso(recurso) : [];

    return (
        <div style={menuWrap}>
            <div style={{ ...tarjeta, maxWidth: 480 }}>
                <div style={{ textAlign: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: '3rem', lineHeight: 1 }}>🦑</div>
                    <h1 style={{ color: '#e6317f', margin: '6px 0 2px', fontSize: 'clamp(1.6rem,6vw,2.2rem)', letterSpacing: 1 }}>
                        LUZ ROJA · LUZ VERDE
                    </h1>
                    <p style={{ color: '#9fb0bb', margin: 0, fontSize: '0.9rem' }}>
                        Avanza acertando preguntas. Si respondes con la luz roja, eliminado.
                    </p>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.28)', borderRadius: 12, padding: 12, margin: '14px 0', color: '#cfd9df', fontSize: '0.86rem', lineHeight: 1.55 }}>
                    <div>🟢 <b>Luz verde:</b> responde. Acierto = 1 paso adelante · fallo = 1 paso atrás.</div>
                    <div>🟡 <b>¡Se gira!</b> última oportunidad para dejar de responder.</div>
                    <div>🔴 <b>Luz roja:</b> si respondes, la muñeca te ve y quedas eliminado.</div>
                </div>

                {recursoPropio.length > 0 && (
                    <button onClick={() => { if (preparar(recursoPropio, recurso.titulo || 'Recurso')) setPantalla('CONFIG'); }}
                        style={btnPrincipal}>
                        <Play size={18} /> Jugar «{recurso.titulo || 'este recurso'}»
                    </button>
                )}

                <button onClick={() => setPantalla('BUSCADOR')} style={{ ...btnPrincipal, marginTop: recursoPropio.length ? 10 : 0 }}>
                    <Search size={18} /> Elegir un recurso del profesor
                </button>

                <button onClick={() => { if (preparar(bancoLibre, 'Modo libre')) setPantalla('CONFIG'); }} style={btnSecundario}>
                    🎲 Modo libre (preguntas variadas)
                </button>

                <button onClick={() => { setErrorUnir(''); setPantalla('UNIRSE'); }} style={btnSecundario}>
                    <Users size={17} style={{ verticalAlign: -3, marginRight: 6 }} /> Unirme a una sala con código
                </button>

                {onExit && <button onClick={onExit} style={{ ...btnSecundario, opacity: 0.75 }}>Salir</button>}
            </div>
        </div>
    );
}

// =====================================================================
//  ESTILOS COMPARTIDOS
// =====================================================================
const contenedor = {
    position: 'fixed', inset: 0, zIndex: 9999, background: '#0a0f14',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    fontFamily: "'Segoe UI', system-ui, sans-serif", touchAction: 'manipulation',
};
const menuWrap = {
    position: 'fixed', inset: 0, zIndex: 9999, background: 'radial-gradient(circle at 50% 20%, #1d2430, #080b10)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
};
const overlay = {
    position: 'absolute', inset: 0, background: 'rgba(5,8,12,0.92)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14, overflowY: 'auto',
};
const tarjeta = {
    width: '100%', maxWidth: 480, background: 'rgba(18,24,32,0.96)',
    border: '1px solid rgba(255,255,255,0.12)', borderRadius: 22, padding: '22px 24px',
    boxShadow: '0 30px 80px rgba(0,0,0,0.6)', color: 'white',
};
const btnPrincipal = {
    width: '100%', padding: '13px 18px', borderRadius: 14, border: 'none', cursor: 'pointer',
    background: 'linear-gradient(135deg,#e6317f,#b3125f)', color: 'white', fontWeight: 800,
    fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
    fontFamily: 'inherit', boxShadow: '0 5px 0 #8d0f4b',
};
const btnSecundario = {
    width: '100%', padding: '11px 18px', borderRadius: 13, cursor: 'pointer', marginTop: 10,
    border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.08)',
    color: 'white', fontWeight: 700, fontSize: '0.94rem', fontFamily: 'inherit',
};
const btnAtras = {
    background: 'none', border: 'none', color: '#8aa0ad', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', padding: 0,
};
const etiquetaCampo = { fontSize: '0.78rem', color: '#9fb0bb', fontWeight: 700, display: 'block', marginBottom: 5 };
const campo = {
    width: '100%', padding: '10px 13px', borderRadius: 11, border: '1.5px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '0.95rem',
    outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};
const opcionChip = (activo) => ({
    flex: 1, padding: '9px 6px', borderRadius: 11, cursor: 'pointer', fontFamily: 'inherit',
    border: activo ? '2px solid #e6317f' : '1px solid rgba(255,255,255,0.15)',
    background: activo ? 'rgba(230,49,127,0.22)' : 'rgba(255,255,255,0.06)',
    color: 'white', fontWeight: 800, fontSize: '0.88rem',
});
