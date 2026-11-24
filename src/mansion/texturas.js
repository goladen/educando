// Texturas pintadas con canvas: nada que descargar (el juego pesa solo su código).
import * as THREE from 'three';

let semilla = 1;
const rnd = () => { semilla = (semilla * 16807) % 2147483647; return (semilla - 1) / 2147483646; };

function lienzo(n = 256) {
    const c = document.createElement('canvas'); c.width = c.height = n;
    return [c, c.getContext('2d')];
}
function ruido(g, n, alfa = 0.08, tam = 2) {
    for (let i = 0; i < n * n / (tam * tam * 3); i++) {
        const v = rnd() < 0.5 ? 0 : 255;
        g.fillStyle = `rgba(${v},${v},${v},${alfa * rnd()})`;
        g.fillRect(rnd() * n, rnd() * n, tam, tam);
    }
}

const PINTORES = {
    // ── Mansión ──
    papel(g, n) { // papel pintado morado con rombos y zócalo de madera
        g.fillStyle = '#3b2352'; g.fillRect(0, 0, n, n);
        g.strokeStyle = 'rgba(214,170,255,0.18)'; g.lineWidth = 3;
        for (let y = 0; y < n * 0.7; y += 32) for (let x = 0; x < n; x += 32) {
            g.beginPath(); g.moveTo(x + 16, y + 4); g.lineTo(x + 28, y + 16); g.lineTo(x + 16, y + 28); g.lineTo(x + 4, y + 16); g.closePath(); g.stroke();
        }
        g.fillStyle = '#2a170e'; g.fillRect(0, n * 0.7, n, n * 0.3);
        g.fillStyle = '#4a2b17'; g.fillRect(0, n * 0.7, n, 8);
        for (let x = 0; x < n; x += 64) { g.strokeStyle = 'rgba(0,0,0,0.45)'; g.strokeRect(x + 8, n * 0.75, 48, n * 0.2); }
        ruido(g, n, 0.12);
    },
    madera(g, n) {
        for (let i = 0; i < 8; i++) {
            const t = 70 + rnd() * 30;
            g.fillStyle = `rgb(${t},${t * 0.55},${t * 0.3})`; g.fillRect(0, i * n / 8, n, n / 8);
            g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, i * n / 8, n, 2);
            g.fillRect(rnd() * n, i * n / 8, 2, n / 8);
            for (let k = 0; k < 6; k++) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, i * n / 8 + rnd() * n / 8, n, 1); }
        }
        ruido(g, n, 0.1);
    },
    techoMadera(g, n) { g.fillStyle = '#1a0f0a'; g.fillRect(0, 0, n, n); g.fillStyle = '#2b1a10'; for (let x = 0; x < n; x += 64) g.fillRect(x, 0, 18, n); ruido(g, n, 0.1); },
    puertaMadera(g, n) {
        g.fillStyle = '#4a2a14'; g.fillRect(0, 0, n, n);
        g.strokeStyle = '#2a170a'; g.lineWidth = 10; g.strokeRect(14, 14, n / 2 - 22, n - 28); g.strokeRect(n / 2 + 8, 14, n / 2 - 22, n - 28);
        g.fillStyle = '#d4a020'; g.beginPath(); g.arc(n / 2, n * 0.55, 7, 0, 7); g.fill();
        ruido(g, n, 0.12);
    },
    // ── Pirámide ──
    arenisca(g, n) {
        g.fillStyle = '#a8814a'; g.fillRect(0, 0, n, n);
        for (let y = 0; y < n; y += 42) for (let x = (y / 42) % 2 ? -40 : 0; x < n; x += 80) {
            const t = 150 + rnd() * 30; g.fillStyle = `rgb(${t},${t * 0.75},${t * 0.45})`; g.fillRect(x + 2, y + 2, 76, 38);
        }
        // jeroglíficos sencillos
        g.strokeStyle = 'rgba(70,40,15,0.6)'; g.lineWidth = 3;
        for (let i = 0; i < 9; i++) {
            const x = 20 + (i % 3) * 80 + rnd() * 20, y = 20 + Math.floor(i / 3) * 80 + rnd() * 20, k = Math.floor(rnd() * 4);
            g.beginPath();
            if (k === 0) { g.arc(x, y, 9, 0, 7); g.moveTo(x, y + 9); g.lineTo(x, y + 26); g.moveTo(x - 9, y + 16); g.lineTo(x + 9, y + 16); }
            else if (k === 1) { g.moveTo(x - 12, y + 10); g.quadraticCurveTo(x, y - 14, x + 12, y + 10); g.moveTo(x - 4, y); g.arc(x - 4, y, 2, 0, 7); }
            else if (k === 2) { for (let w = 0; w < 3; w++) { g.moveTo(x - 12, y + w * 8); g.lineTo(x - 6, y - 4 + w * 8); g.lineTo(x, y + w * 8); g.lineTo(x + 6, y - 4 + w * 8); g.lineTo(x + 12, y + w * 8); } }
            else { g.moveTo(x - 10, y + 14); g.lineTo(x, y - 12); g.lineTo(x + 10, y + 14); g.closePath(); }
            g.stroke();
        }
        ruido(g, n, 0.12);
    },
    losas(g, n) {
        g.fillStyle = '#5a4428'; g.fillRect(0, 0, n, n);
        for (let y = 0; y < n; y += 64) for (let x = 0; x < n; x += 64) { const t = 110 + rnd() * 30; g.fillStyle = `rgb(${t},${t * 0.8},${t * 0.55})`; g.fillRect(x + 3, y + 3, 58, 58); }
        ruido(g, n, 0.12);
    },
    techoPiedra(g, n) { g.fillStyle = '#3d2c18'; g.fillRect(0, 0, n, n); ruido(g, n, 0.15, 3); },
    puertaPiedra(g, n) {
        g.fillStyle = '#8a6a3a'; g.fillRect(0, 0, n, n);
        g.strokeStyle = '#4a3418'; g.lineWidth = 8; g.strokeRect(16, 16, n - 32, n - 32);
        g.fillStyle = '#d9a52a'; g.beginPath(); g.ellipse(n / 2, n * 0.38, 34, 22, 0, 0, 7); g.fill(); // ojo de Horus simplificado
        g.fillStyle = '#2a1a08'; g.beginPath(); g.arc(n / 2, n * 0.38, 11, 0, 7); g.fill();
        g.strokeStyle = '#2a1a08'; g.lineWidth = 6; g.beginPath(); g.moveTo(n / 2 - 10, n * 0.47); g.lineTo(n / 2 - 22, n * 0.62); g.stroke();
        ruido(g, n, 0.14);
    },
    // ── Nave ──
    paneles(g, n) {
        g.fillStyle = '#1c2633'; g.fillRect(0, 0, n, n);
        g.fillStyle = '#2a3747'; g.fillRect(8, 8, n / 2 - 12, n * 0.62); g.fillRect(n / 2 + 4, 8, n / 2 - 12, n * 0.62);
        g.fillStyle = '#151d27'; g.fillRect(0, n * 0.7, n, n * 0.3);
        g.fillStyle = '#38e0ff'; g.fillRect(0, n * 0.68, n, 4);
        g.fillStyle = 'rgba(255,255,255,0.25)'; for (let i = 0; i < 8; i++) g.fillRect(14 + i * 30, n * 0.8, 10, 4);
        g.fillStyle = '#ffb020'; g.fillRect(n - 30, 20, 10, 10);
        ruido(g, n, 0.06);
    },
    rejilla(g, n) {
        g.fillStyle = '#222b35'; g.fillRect(0, 0, n, n);
        g.strokeStyle = '#121820'; g.lineWidth = 3;
        for (let i = 0; i <= n; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, n); g.moveTo(0, i); g.lineTo(n, i); g.stroke(); }
        g.strokeStyle = '#3a4a5c'; g.lineWidth = 6; g.strokeRect(3, 3, n - 6, n - 6);
        ruido(g, n, 0.06);
    },
    techoMetal(g, n) { g.fillStyle = '#10161e'; g.fillRect(0, 0, n, n); g.fillStyle = '#9fe8ff'; g.fillRect(n / 2 - 20, 0, 40, n); ruido(g, n, 0.05); },
    puertaMetal(g, n) {
        g.fillStyle = '#3a4656'; g.fillRect(0, 0, n, n);
        g.fillStyle = '#ffcc00'; for (let i = -n; i < n; i += 40) { g.beginPath(); g.moveTo(i, n * 0.88); g.lineTo(i + 20, n * 0.88); g.lineTo(i + 40, n); g.lineTo(i + 20, n); g.fill(); }
        g.fillStyle = '#1c2430'; g.fillRect(n / 2 - 3, 0, 6, n * 0.86);
        g.fillStyle = '#38e0ff'; g.fillRect(n * 0.2, n * 0.3, n * 0.6, 6);
        ruido(g, n, 0.06);
    },
};

PINTORES.vendas = (g, n) => {
    g.fillStyle = '#cdbf9a'; g.fillRect(0, 0, n, n);
    for (let y = 0; y < n; y += 14) {
        g.save(); g.translate(0, y); g.rotate((rnd() - 0.5) * 0.12);
        const t = 170 + rnd() * 50; g.fillStyle = `rgb(${t},${t * 0.92},${t * 0.72})`; g.fillRect(-10, 0, n + 20, 11);
        g.fillStyle = 'rgba(60,40,20,0.35)'; g.fillRect(-10, 11, n + 20, 2);
        g.restore();
    }
    ruido(g, n, 0.15);
};

const cache = new Map();
/** Textura del catálogo (repetible). Se comparte entre partidas del mismo tipo. */
export function textura(nombre) {
    if (cache.has(nombre)) return cache.get(nombre);
    semilla = 7 + nombre.length * 131;
    const [c, g] = lienzo(256);
    (PINTORES[nombre] || PINTORES.madera)(g, 256);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    cache.set(nombre, t);
    return t;
}

/** Textura con un texto o emoji centrado (carteles, cifras de las pistas…). */
export function texturaTexto(texto, { color = '#fff', fondo = null, tam = 128, fuente = 'bold 90px "Segoe UI", sans-serif' } = {}) {
    const [c, g] = lienzo(tam);
    if (fondo) { g.fillStyle = fondo; g.fillRect(0, 0, tam, tam); }
    g.fillStyle = color; g.font = fuente; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(texto, tam / 2, tam / 2 + 4);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

/** Brillo radial (llamas, ojos, halo de las pistas). */
export function texturaBrillo() {
    if (cache.has('_brillo')) return cache.get('_brillo');
    const [c, g] = lienzo(64);
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); cache.set('_brillo', t);
    return t;
}

/** Runa de la trampa en el suelo (se ve al iluminarla). */
export function texturaRuna(tipo) {
    const k = '_runa' + tipo;
    if (cache.has(k)) return cache.get(k);
    const [c, g] = lienzo(256);
    const col = tipo === 'laser' ? '255,60,60' : tipo === 'fuego' ? '255,140,30' : '255,230,120';
    g.strokeStyle = `rgba(${col},1)`; g.lineWidth = 8; g.shadowColor = `rgba(${col},1)`; g.shadowBlur = 18;
    g.beginPath(); g.arc(128, 128, 100, 0, 7); g.stroke();
    g.beginPath(); g.arc(128, 128, 70, 0, 7); g.stroke();
    if (tipo === 'laser') { for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(40, 70 + i * 38); g.lineTo(216, 70 + i * 38); g.stroke(); } }
    else {
        g.beginPath();
        for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 4 * Math.PI / 5; const x = 128 + Math.cos(a) * 70, y = 128 + Math.sin(a) * 70; i ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.closePath(); g.stroke();
    }
    g.font = 'bold 60px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = `rgba(${col},1)`;
    g.fillText('!', 128, 132);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; cache.set(k, t);
    return t;
}
