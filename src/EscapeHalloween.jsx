import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp, increment, arrayUnion } from 'firebase/firestore';
import QRSalaBoton, { urlSalaEnVivo } from './components/QRSalaBoton';
import { guardarRegistroLocal } from './utils/registrosLocales';
import {
    ORDEN_SALAS, generarPregunta, generarCandado, compruebaCandado, pistasDeJugador, barajar, pick,
    infoPrueba, materiaDePrueba, temaDePrueba, candadoManual, pruebaParaSala,
} from './escapeHalloween/bancoEscape';
import { TIPO_JUEGO, ETAPAS, ZOMBIS, configPorDefecto } from './escapeHalloween/constantes';
import Mansion3D, { AvatarPreview3D } from './escapeHalloween/Mansion3D';
import EditorDisfraz, { leerAvatarGuardado, avatarAleatorio } from './escapeHalloween/EditorDisfraz';
import EditorEscape from './escapeHalloween/EditorEscape';
import { disfrazDe } from './escapeHalloween/avatares3d';

/**
 *  ESCAPE ROOM DE HALLOWEEN — «La mansión del zombi»
 *  Juego cooperativo para toda la clase (sala live_games, tipoJuego ESCAPE_HALLOWEEN):
 *   · El profesor proyecta la mansión (anfitrión) y los alumnos entran con el móvil (?live=CODIGO).
 *   · Cada sala es una prueba: de una materia (con su tema) o propia del profe (texto + código buscado en el aula).
 *     En las de materia, los aciertos de todos llenan la barra de energía de la sala.
 *   · Los alumnos se disfrazan (avatar 3D) y se ven en la mansión 3D proyectada (escapeHalloween/Mansion3D).
 *   · Los escape rooms se guardan en resources (tipoJuego ESCAPE_HALLOWEEN) o en el navegador (escapeHalloween/EditorEscape).
 *   · Al llenarse aparece un candado cooperativo: las pistas se reparten entre los móviles
 *     y la clase tiene que hablar para juntarlas (un fallo resta 15 s al reloj).
 *   · Cada puerta abierta da un amuleto = una vida extra en la batalla final.
 *   · Batalla final: todos contra el zombi. Cada acierto le golpea; cada pocos segundos ataca
 *     y solo lo bloquea el escudo (un mínimo de golpes de la clase desde el último ataque).
 *   · Si se acaba el tiempo, el zombi despierta antes… y con un 50 % más de vida.
 */

const PENAL_CANDADO = 15; // segundos que resta un código incorrecto
const AVATARES = ['🧛', '🧙', '👻', '🎃', '🦇', '🕷️', '💀', '🧟', '🧌', '🐺'];

const claveDe = (nombre) => String(nombre || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'jugador';
const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

// =====================================================================
//  SONIDO (Web Audio sintetizado, sin archivos)
// =====================================================================
function crearAudio() {
    let ctx = null;
    const a = { activo: true };
    const c = () => {
        if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
        if (ctx.state === 'suspended') ctx.resume().catch(() => { });
        return ctx;
    };
    const tono = (f, dur, { tipo = 'sine', vol = 0.15, desde = 0, hasta = null } = {}) => {
        if (!a.activo) return; const x = c(); if (!x) return;
        const o = x.createOscillator(), g = x.createGain(), t = x.currentTime + desde;
        o.type = tipo; o.frequency.setValueAtTime(f, t);
        if (hasta) o.frequency.exponentialRampToValueAtTime(hasta, t + dur);
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(x.destination); o.start(t); o.stop(t + dur + 0.05);
    };
    const ruido = (dur, { vol = 0.25, frec = 800, desde = 0 } = {}) => {
        if (!a.activo) return; const x = c(); if (!x) return;
        const buf = x.createBuffer(1, Math.floor(x.sampleRate * dur), x.sampleRate);
        const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
        const s = x.createBufferSource(), f = x.createBiquadFilter(), g = x.createGain(), t = x.currentTime + desde;
        f.type = 'lowpass'; f.frequency.value = frec; g.gain.value = vol;
        s.buffer = buf; s.connect(f).connect(g).connect(x.destination); s.start(t);
    };
    a.desbloquear = () => c();
    a.acierto = () => { tono(660, 0.12, { tipo: 'triangle' }); tono(990, 0.18, { tipo: 'triangle', desde: 0.08 }); };
    a.fallo = () => tono(220, 0.35, { tipo: 'sawtooth', vol: 0.08, hasta: 110 });
    a.golpe = () => { ruido(0.12, { vol: 0.35, frec: 1200 }); tono(140, 0.15, { tipo: 'square', vol: 0.08, hasta: 60 }); };
    a.puerta = () => { tono(180, 1.1, { tipo: 'sawtooth', vol: 0.05, hasta: 420 }); tono(240, 0.9, { tipo: 'sawtooth', vol: 0.04, desde: 0.3, hasta: 130 }); ruido(0.4, { vol: 0.3, frec: 300, desde: 1.1 }); };
    a.rugido = () => { tono(90, 1.0, { tipo: 'sawtooth', vol: 0.18, hasta: 55 }); tono(97, 1.0, { tipo: 'square', vol: 0.06, hasta: 50 }); ruido(0.8, { vol: 0.15, frec: 500 }); };
    a.escudo = () => { tono(523, 0.15, { tipo: 'triangle' }); tono(784, 0.3, { tipo: 'triangle', desde: 0.1 }); };
    a.trueno = () => { ruido(2.2, { vol: 0.5, frec: 260 }); ruido(0.3, { vol: 0.4, frec: 2000 }); };
    a.victoria = () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tono(f, 0.3, { tipo: 'triangle', vol: 0.13, desde: i * 0.16 }));
    a.derrota = () => [392, 370, 349, 262].forEach((f, i) => tono(f, 0.5, { tipo: 'sawtooth', vol: 0.06, desde: i * 0.35 }));
    a.campana = () => [0, 1.6, 3.2].forEach(d => { tono(196, 1.5, { vol: 0.12, desde: d }); tono(392, 1.2, { vol: 0.05, desde: d }); });
    a.cerrar = () => { try { ctx?.close(); } catch { } ctx = null; };
    return a;
}

// =====================================================================
//  ESTILOS
// =====================================================================
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Creepster&display=swap');
.eh-root { position: fixed; inset: 0; z-index: 9999; overflow-y: auto; color: #f5e9ff; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  background: radial-gradient(ellipse at 50% 0%, #3b1d5e 0%, #1a0b2e 45%, #07030f 100%); }
.eh-titulo { font-family: 'Creepster', 'Chiller', fantasy; letter-spacing: 2px; color: #ff8c1a; text-shadow: 0 0 12px rgba(255,120,0,.7), 0 3px 0 #4a1a00; margin: 0; }
.eh-luna { position: fixed; top: 4%; right: 6%; width: 110px; height: 110px; border-radius: 50%; pointer-events: none;
  background: radial-gradient(circle at 35% 35%, #fff9e0, #f3dc8a 60%, #c9a54a); box-shadow: 0 0 60px 20px rgba(255,230,150,.25); opacity: .85; }
.eh-murcielago { position: fixed; font-size: 28px; pointer-events: none; animation: ehBat linear infinite; opacity: .8; z-index: 0; }
@keyframes ehBat { 0% { transform: translate(-10vw, 0) scaleX(1); } 25% { transform: translate(25vw, -4vh); } 50% { transform: translate(55vw, 3vh); } 75% { transform: translate(80vw, -3vh); } 100% { transform: translate(115vw, 0); } }
.eh-niebla { position: fixed; left: -20%; right: -20%; bottom: -40px; height: 180px; pointer-events: none; z-index: 0;
  background: radial-gradient(ellipse at 30% 80%, rgba(200,180,255,.18), transparent 60%), radial-gradient(ellipse at 70% 90%, rgba(200,180,255,.14), transparent 60%);
  animation: ehNiebla 14s ease-in-out infinite alternate; }
@keyframes ehNiebla { from { transform: translateX(-4%); } to { transform: translateX(4%); } }
.eh-panel { position: relative; z-index: 1; background: rgba(20, 8, 38, .78); border: 2px solid rgba(255,140,26,.35); border-radius: 20px;
  box-shadow: 0 10px 40px rgba(0,0,0,.5), inset 0 0 30px rgba(120,40,200,.15); backdrop-filter: blur(4px); }
.eh-btn { border: none; border-radius: 14px; padding: 12px 20px; font-weight: 800; font-size: 1rem; cursor: pointer; font-family: inherit;
  background: linear-gradient(180deg, #ff9b2e, #e2650a); color: #1a0700; box-shadow: 0 4px 0 #8a3500, 0 0 18px rgba(255,120,0,.35); transition: transform .1s; }
.eh-btn:active { transform: translateY(2px); box-shadow: 0 2px 0 #8a3500; }
.eh-btn:disabled { opacity: .45; cursor: not-allowed; }
.eh-btn2 { border: 2px solid rgba(255,255,255,.25); border-radius: 12px; padding: 9px 14px; font-weight: 700; font-size: .9rem; cursor: pointer;
  font-family: inherit; background: rgba(255,255,255,.08); color: #f5e9ff; }
.eh-btn2:hover { background: rgba(255,255,255,.16); }
.eh-btn2:disabled { opacity: .4; cursor: not-allowed; }
.eh-chip { border: 2px solid rgba(255,255,255,.2); border-radius: 12px; padding: 9px 12px; cursor: pointer; font-weight: 700; font-family: inherit;
  background: rgba(255,255,255,.06); color: #e9dcff; font-size: .9rem; }
.eh-chip.on { border-color: #ff8c1a; background: rgba(255,140,26,.22); color: #fff; box-shadow: 0 0 12px rgba(255,140,26,.35); }
.eh-opcion { width: 100%; text-align: center; border-radius: 14px; padding: 14px 12px; font-size: 1.05rem; font-weight: 800; cursor: pointer; font-family: inherit;
  border: 2px solid rgba(255,255,255,.18); background: rgba(70, 30, 110, .7); color: #fff; transition: transform .1s, background .2s; }
.eh-opcion:active { transform: scale(.97); }
.eh-opcion.ok { background: #15803d; border-color: #4ade80; }
.eh-opcion.mal { background: #991b1b; border-color: #f87171; }
.eh-input { width: 100%; box-sizing: border-box; padding: 14px; border-radius: 14px; border: 2px solid rgba(255,140,26,.5); background: rgba(0,0,0,.4);
  color: #fff; font-size: 1.3rem; font-weight: 800; text-align: center; letter-spacing: 3px; font-family: inherit; outline: none; }
.eh-barra { height: 26px; border-radius: 13px; background: rgba(0,0,0,.45); border: 2px solid rgba(255,255,255,.15); overflow: hidden; position: relative; }
.eh-barra > div { height: 100%; border-radius: 11px; transition: width .5s ease; background: linear-gradient(90deg, #ff6a00, #ffb347); box-shadow: 0 0 16px rgba(255,140,0,.7); }
.eh-vela { display: inline-block; animation: ehFlicker 1.6s ease-in-out infinite; }
@keyframes ehFlicker { 0%,100% { opacity: 1; transform: scale(1); } 40% { opacity: .75; transform: scale(.96) rotate(-2deg); } 60% { opacity: .9; transform: scale(1.03) rotate(2deg); } }
.eh-flota { animation: ehFlota 3s ease-in-out infinite; }
@keyframes ehFlota { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
.eh-latido { animation: ehLatido 1s ease-in-out infinite; }
@keyframes ehLatido { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }
.eh-aparece { animation: ehAparece .5s ease both; }
@keyframes ehAparece { from { opacity: 0; transform: translateY(14px) scale(.97); } to { opacity: 1; transform: none; } }
.eh-susto { animation: ehSusto .45s ease; }
@keyframes ehSusto { 0%,100% { transform: none; } 20% { transform: translateX(-10px) rotate(-2deg); } 40% { transform: translateX(10px) rotate(2deg); } 60% { transform: translateX(-6px); } 80% { transform: translateX(6px); } }
.eh-flash-rojo { position: fixed; inset: 0; pointer-events: none; z-index: 50; animation: ehFlashRojo .9s ease forwards; background: radial-gradient(circle, transparent 30%, rgba(220,0,0,.65)); }
@keyframes ehFlashRojo { from { opacity: 1; } to { opacity: 0; } }
.eh-flash-azul { position: fixed; inset: 0; pointer-events: none; z-index: 50; animation: ehFlashRojo .9s ease forwards; background: radial-gradient(circle, transparent 35%, rgba(60,160,255,.55)); }
.eh-zombi { transform-origin: 50% 100%; }
.eh-zombi.idle { animation: ehZIdle 2.4s ease-in-out infinite; }
@keyframes ehZIdle { 0%,100% { transform: rotate(-2deg); } 50% { transform: rotate(2deg) translateY(-3px); } }
.eh-zombi.golpe { animation: ehZGolpe .35s ease; }
@keyframes ehZGolpe { 0% { transform: none; filter: none; } 30% { transform: translateX(14px) rotate(4deg); filter: brightness(2) saturate(0) sepia(1) hue-rotate(-50deg); } 100% { transform: none; filter: none; } }
.eh-zombi.ataque { animation: ehZAtaque .9s ease; }
@keyframes ehZAtaque { 0% { transform: scale(1); } 40% { transform: scale(1.35) translateY(20px); } 100% { transform: scale(1); } }
.eh-zombi.muerto { animation: ehZMuerto 1.6s ease forwards; }
@keyframes ehZMuerto { 0% { transform: none; opacity: 1; } 30% { transform: rotate(-8deg); } 100% { transform: translateY(70%) rotate(18deg); opacity: .15; } }
.eh-zombi.victoria { animation: ehZRisa .5s ease-in-out infinite; }
@keyframes ehZRisa { 0%,100% { transform: translateY(0) scale(1.05); } 50% { transform: translateY(-8px) scale(1.08); } }
.eh-golpe-num { position: absolute; font-weight: 900; font-size: 2rem; color: #ffde59; text-shadow: 0 0 10px #ff3b00, 0 2px 0 #000; animation: ehNum 1s ease forwards; pointer-events: none; }
@keyframes ehNum { from { opacity: 1; transform: translateY(0) scale(1); } to { opacity: 0; transform: translateY(-80px) scale(1.4); } }
.eh-puerta { animation: ehPuerta 1.4s ease forwards; transform-origin: 0% 50%; }
@keyframes ehPuerta { from { transform: perspective(600px) rotateY(0); } to { transform: perspective(600px) rotateY(-75deg); } }
.eh-confeti { position: fixed; top: -30px; font-size: 26px; animation: ehCae linear forwards; pointer-events: none; z-index: 60; }
@keyframes ehCae { to { transform: translateY(115vh) rotate(540deg); } }
`;

function Ambiente({ murcielagos = 5 }) {
    const bats = useMemo(() => Array.from({ length: murcielagos }, (_, i) => ({
        top: 5 + Math.random() * 45, dur: 14 + Math.random() * 16, delay: -Math.random() * 20, size: 18 + Math.random() * 18, id: i,
    })), [murcielagos]);
    return (
        <>
            <style>{CSS}</style>
            <div className="eh-luna" />
            {bats.map(b => (
                <div key={b.id} className="eh-murcielago" style={{ top: `${b.top}%`, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s`, fontSize: b.size }}>🦇</div>
            ))}
            <div className="eh-niebla" />
        </>
    );
}

function Confeti() {
    const piezas = useMemo(() => Array.from({ length: 40 }, (_, i) => ({
        i, left: Math.random() * 100, dur: 3 + Math.random() * 3, delay: Math.random() * 2.5, e: pick(['🎃', '🍬', '🍭', '✨', '🦇', '⭐']),
    })), []);
    return piezas.map(p => <div key={p.i} className="eh-confeti" style={{ left: `${p.left}%`, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s` }}>{p.e}</div>);
}

// =====================================================================
//  ZOMBI (SVG)
// =====================================================================
function Zombi({ estado = 'idle', size = 260 }) {
    return (
        <svg viewBox="0 0 220 260" width={size} height={size * 260 / 220} className={`eh-zombi ${estado}`} style={{ overflow: 'visible' }}>
            <defs>
                <radialGradient id="ehPiel" cx="45%" cy="40%" r="65%">
                    <stop offset="0%" stopColor="#a3c97a" /><stop offset="100%" stopColor="#5b8a3c" />
                </radialGradient>
                <linearGradient id="ehRopa" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5a4a7a" /><stop offset="100%" stopColor="#2e2342" />
                </linearGradient>
            </defs>
            {/* brazos estirados */}
            <g>
                <rect x="10" y="132" width="78" height="26" rx="13" fill="url(#ehRopa)" transform="rotate(-12 50 145)" />
                <ellipse cx="14" cy="150" rx="16" ry="13" fill="url(#ehPiel)" />
                <path d="M2 142 l-10 -4 M0 150 l-12 0 M2 158 l-10 4" stroke="#5b8a3c" strokeWidth="5" strokeLinecap="round" />
                <rect x="132" y="132" width="78" height="26" rx="13" fill="url(#ehRopa)" transform="rotate(12 170 145)" />
                <ellipse cx="206" cy="150" rx="16" ry="13" fill="url(#ehPiel)" />
                <path d="M218 142 l10 -4 M220 150 l12 0 M218 158 l10 4" stroke="#5b8a3c" strokeWidth="5" strokeLinecap="round" />
            </g>
            {/* torso con camisa rota */}
            <path d="M62 128 Q110 112 158 128 L166 230 L54 230 Z" fill="url(#ehRopa)" />
            <path d="M54 230 l10 -14 l10 14 l12 -16 l10 16 l12 -12 l12 12 l12 -16 l10 16 l12 -14 l12 14 Z" fill="#1a0b2e" />
            <path d="M95 150 l6 18 l-8 10" stroke="#a3c97a" strokeWidth="6" fill="none" />
            <circle cx="132" cy="175" r="9" fill="#5b8a3c" />
            {/* cuello */}
            <rect x="96" y="104" width="28" height="26" fill="#6f9a4a" />
            {/* cabeza */}
            <path d="M58 60 Q58 8 110 8 Q164 8 162 62 Q162 108 110 112 Q58 108 58 60 Z" fill="url(#ehPiel)" />
            <ellipse cx="86" cy="40" rx="12" ry="8" fill="#6f9a4a" opacity=".7" />
            <ellipse cx="140" cy="86" rx="10" ry="6" fill="#4d7a30" opacity=".6" />
            {/* pelo */}
            <path d="M70 26 l-6 -14 M86 14 l-2 -14 M110 9 l2 -14 M132 13 l6 -12 M150 24 l10 -10" stroke="#2b1d12" strokeWidth="5" strokeLinecap="round" />
            {/* cicatriz */}
            <path d="M120 22 L150 40" stroke="#2f4a1d" strokeWidth="3" />
            {[0, 1, 2, 3].map(i => <path key={i} d={`M${124 + i * 8} ${20 + i * 5} l6 -8`} stroke="#2f4a1d" strokeWidth="2.5" />)}
            {/* ojos */}
            <circle cx="88" cy="60" r="17" fill="#fffbe6" />
            <circle cx="91" cy="62" r="7" fill="#d10000"><animate attributeName="r" values="7;5;7" dur="2s" repeatCount="indefinite" /></circle>
            <circle cx="134" cy="58" r="11" fill="#fffbe6" />
            <circle cx="132" cy="60" r="5" fill="#d10000" />
            <path d="M70 40 L104 48 M120 46 L150 40" stroke="#2b1d12" strokeWidth="5" strokeLinecap="round" />
            {/* boca */}
            <path d="M80 88 Q110 104 142 86 Q138 100 110 102 Q84 102 80 88 Z" fill="#2b0a0a" />
            <path d="M88 91 l4 7 l4 -6 l4 7 l4 -6 l4 7 l4 -6 l4 7 l4 -6 l4 6 l4 -7" stroke="#fffbe6" strokeWidth="2.5" fill="none" strokeLinejoin="round" />
            {/* lápida delante */}
            <path d="M40 260 L40 214 Q40 190 70 190 L150 190 Q180 190 180 214 L180 260 Z" fill="#6b6f7a" stroke="#3d404a" strokeWidth="4" />
            <text x="110" y="232" textAnchor="middle" fontSize="26" fontWeight="900" fill="#3d404a" fontFamily="Creepster, fantasy">R.I.P.</text>
            <path d="M30 258 Q110 244 190 258" stroke="#3a2a12" strokeWidth="8" fill="none" />
        </svg>
    );
}

function Corazones({ vidas, max }) {
    return (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
            {Array.from({ length: max }, (_, i) => (
                <span key={i} style={{ fontSize: '1.6rem', filter: i < vidas ? 'none' : 'grayscale(1) opacity(.3)', transition: 'filter .4s' }}>❤️</span>
            ))}
        </div>
    );
}

function BarraVidaZombi({ hp, hpMax }) {
    const pct = hpMax ? Math.max(0, Math.min(100, (hp / hpMax) * 100)) : 0;
    return (
        <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '.9rem', marginBottom: 4 }}>
                <span>🧟 Vida del zombi</span><span>{Math.max(0, hp)} / {hpMax}</span>
            </div>
            <div className="eh-barra"><div style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#16a34a,#84cc16)', boxShadow: '0 0 16px rgba(132,204,22,.7)' }} /></div>
        </div>
    );
}

function MapaMansion({ pruebas = [], salaIdx, amuletos = [], fase }) {
    return (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
            {pruebas.map((p, i) => {
                const s = infoPrueba(p, i, pruebas);
                const hecho = amuletos.includes(p.id);
                const actual = i === salaIdx && !['BATALLA', 'VICTORIA', 'DERROTA', 'LOBBY', 'INTRO'].includes(fase);
                return (
                    <div key={p.id || i} title={s.nombre} style={{
                        width: 50, height: 60, borderRadius: '24px 24px 6px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem',
                        background: hecho ? 'rgba(255,170,40,.25)' : actual ? 'rgba(160,80,255,.35)' : 'rgba(0,0,0,.35)',
                        border: `2px solid ${hecho ? '#ffb347' : actual ? '#c084fc' : 'rgba(255,255,255,.15)'}`,
                        boxShadow: actual ? '0 0 18px rgba(192,132,252,.7)' : hecho ? '0 0 12px rgba(255,170,40,.5)' : 'none',
                    }} className={actual ? 'eh-latido' : ''}>
                        {hecho ? s.amuleto.emoji : actual ? s.emoji : '🔒'}
                    </div>
                );
            })}
            <div style={{ fontSize: '1.4rem', opacity: .7 }}>➜</div>
            <div style={{
                width: 60, height: 60, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem',
                background: fase === 'BATALLA' ? 'rgba(220,0,0,.35)' : 'rgba(0,0,0,.35)', border: `2px solid ${fase === 'BATALLA' ? '#ef4444' : 'rgba(255,255,255,.15)'}`,
            }}>🧟</div>
        </div>
    );
}

// =====================================================================
//  TARJETA DE PREGUNTA (móvil)
// =====================================================================
function TarjetaPregunta({ pregunta, feedback, onResponder, color = '#ff8c1a' }) {
    if (!pregunta) return null;
    return (
        <div className={`eh-panel eh-aparece ${feedback && !feedback.ok ? 'eh-susto' : ''}`} style={{ padding: 18, borderColor: color + '88' }}>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: 8, textAlign: 'center' }}>{pregunta.texto}</div>
            {pregunta.img && (
                <div style={{ textAlign: 'center', margin: '8px 0 12px' }}>
                    <img src={pregunta.img} alt="" style={{ maxWidth: '100%', maxHeight: 150, borderRadius: 10, border: '3px solid rgba(255,255,255,.3)', background: '#fff' }} />
                </div>
            )}
            {pregunta.detalle && (
                <div style={{
                    textAlign: 'center', margin: '6px 0 14px', padding: '10px 12px', borderRadius: 12, background: 'rgba(0,0,0,.35)',
                    fontSize: pregunta.grande ? '1.7rem' : '1rem', fontWeight: pregunta.grande ? 900 : 600, lineHeight: 1.35,
                }}>{pregunta.detalle}</div>
            )}
            {pregunta.frase && (
                <div style={{ textAlign: 'center', margin: '6px 0 14px', padding: '10px 12px', borderRadius: 12, background: 'rgba(0,0,0,.35)', fontSize: '1.15rem', lineHeight: 1.6 }}>
                    {pregunta.frase.tokens.map((t, i) => (
                        <span key={i} style={i === pregunta.frase.resaltar ? { background: '#ff8c1a', color: '#1a0700', borderRadius: 6, padding: '0 6px', fontWeight: 900 } : null}>{t}{' '}</span>
                    ))}
                </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: pregunta.opciones.length > 2 && pregunta.opciones.every(o => o.length < 18) ? '1fr 1fr' : '1fr', gap: 10 }}>
                {pregunta.opciones.map((o, i) => {
                    let cls = 'eh-opcion';
                    if (feedback) { if (i === pregunta.correcta) cls += ' ok'; else if (i === feedback.elegida) cls += ' mal'; }
                    return <button key={i} className={cls} disabled={!!feedback} onClick={() => onResponder(i)}>{o}</button>;
                })}
            </div>
        </div>
    );
}


// =====================================================================
//  ANFITRIÓN (proyector del profesor)
// =====================================================================
const leer3D = () => { try { return localStorage.getItem('pikt_escape_3d') !== '0'; } catch { return true; } };

function HostEscape({ config, usuario, onSalir }) {
    const audioRef = useRef(null);
    if (!audioRef.current) audioRef.current = crearAudio();
    const audio = audioRef.current;
    const [sonido, setSonido] = useState(true);
    useEffect(() => { audio.activo = sonido; }, [sonido, audio]);
    useEffect(() => () => audio.cerrar(), [audio]);
    const [usar3D, setUsar3D] = useState(leer3D);
    const cambiar3D = () => setUsar3D(v => { try { localStorage.setItem('pikt_escape_3d', v ? '0' : '1'); } catch { /* */ } return !v; });

    const [codigo, setCodigo] = useState('');
    const [sala, setSala] = useState(null);
    const [error, setError] = useState('');
    const [ahora, setAhora] = useState(Date.now());
    const [feed, setFeed] = useState([]);
    const [zEstado, setZEstado] = useState('idle');
    const [numsGolpe, setNumsGolpe] = useState([]);
    const [flash, setFlash] = useState(null);
    const salaRef = useRef(null);
    salaRef.current = sala;
    const transRef = useRef('');
    const creada = useRef(false);
    const Z = ZOMBIS[config.zombi] || ZOMBIS.NORMAL;

    const refDoc = useMemo(() => (codigo ? doc(db, 'live_games', codigo) : null), [codigo]);
    const upd = useCallback((data) => { if (refDoc) updateDoc(refDoc, data).catch(e => console.warn('escape', e)); }, [refDoc]);

    // Crear la sala una sola vez
    useEffect(() => {
        if (creada.current) return;
        creada.current = true;
        let unsub = null;
        (async () => {
            try {
                const code = Math.random().toString(36).substring(2, 7).toUpperCase();
                await setDoc(doc(db, 'live_games', code), {
                    codigo: code, tipoJuego: TIPO_JUEGO, estado: 'esperando', fase: 'LOBBY',
                    titulo: 'Escape Room de Halloween', etapa: config.etapa, pruebas: config.pruebas.map(pruebaParaSala),
                    config: { ritmo: config.ritmo, zombi: config.zombi, minutos: config.minutos },
                    salaIdx: 0, objetivo: 0, progreso: {}, candado: null, candadoAbierto: null, pistasReveladas: 0,
                    tiempoFin: null, penalSeg: 0, tiempoAgotado: false, amuletos: [], batalla: null, ultimo: null,
                    jugadores: {}, hostNombre: usuario?.displayName || 'Profesor', hostId: usuario?.uid || null,
                    createdAt: serverTimestamp(),
                });
                setCodigo(code);
                unsub = onSnapshot(doc(db, 'live_games', code), s => { if (s.exists()) setSala(s.data()); });
            } catch (e) { setError('No se pudo crear la sala: ' + e.message); }
        })();
        return () => { if (unsub) unsub(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const jugadores = sala?.jugadores || {};
    const listaJug = Object.entries(jugadores).map(([k, j]) => ({ k, ...j }));
    const nJug = listaJug.length;
    const fase = sala?.fase || 'LOBBY';
    const pruebas = sala?.pruebas || [];
    const salaIdx = sala?.salaIdx ?? 0;
    const salaInfo = infoPrueba(pruebas[salaIdx], salaIdx, pruebas);
    const esUltima = sala ? salaIdx >= pruebas.length - 1 : false;
    const restante = sala?.tiempoFin ? sala.tiempoFin - (sala.penalSeg || 0) * 1000 - ahora : config.minutos * 60000;
    const progreso = sala?.progreso?.[`s${salaIdx}`] || 0;
    const infos3D = useMemo(() => pruebas.map((p, i) => infoPrueba(p, i, pruebas)), [pruebas]);

    // ---------- acciones ----------
    const iniciarSala = useCallback((i) => {
        const s = salaRef.current; if (!s) return;
        const prueba = s.pruebas[i];
        const n = Math.max(1, Object.keys(s.jugadores || {}).length);
        const datos = { salaIdx: i, candadoAbierto: null, pistasReveladas: 0, [`progreso.s${i}`]: 0 };
        if (!s.tiempoFin) datos.tiempoFin = Date.now() + config.minutos * 60000;
        if (!materiaDePrueba(prueba)) {
            // Prueba propia sin preguntas: directamente al código
            transRef.current = `C${i}`;
            Object.assign(datos, { fase: 'CANDADO', objetivo: 0, candado: { ...candadoManual(prueba), reparto: barajar(Object.keys(s.jugadores || {})) } });
            audio.campana();
        } else {
            transRef.current = `R${i}`;
            Object.assign(datos, { fase: 'RETOS', objetivo: Math.max(5, n * config.ritmo), candado: null });
        }
        upd(datos);
    }, [config, upd, audio]);

    const iniciarBatalla = useCallback((agotado = false) => {
        const s = salaRef.current; if (!s) return;
        transRef.current = 'BATALLA';
        const n = Math.max(1, Object.keys(s.jugadores || {}).length);
        const hpMax = Math.round(Math.max(12, n * Z.golpesPorAlumno) * (agotado ? 1.5 : 1));
        const vidas = 3 + (s.amuletos || []).length;
        upd({
            fase: 'BATALLA', tiempoAgotado: !!agotado,
            batalla: {
                hpMax, golpes: 0, golpesBase: 0, vidas, vidasMax: vidas, ataques: 0, ultimoAtaque: null,
                escudo: Math.max(2, Math.ceil(n * Z.escudo)), proximoAtaque: Date.now() + Z.ataqueMs + 6000,
            },
        });
        audio.rugido();
    }, [Z, upd, audio]);

    const revancha = () => {
        const b = salaRef.current?.batalla; if (!b) return;
        transRef.current = 'BATALLA';
        upd({ fase: 'BATALLA', 'batalla.vidas': b.vidasMax, 'batalla.golpesBase': b.golpes, 'batalla.proximoAtaque': Date.now() + Z.ataqueMs + 5000 });
        audio.rugido();
    };

    const empezar = () => { audio.desbloquear(); audio.trueno(); upd({ estado: 'jugando', fase: 'INTRO' }); };
    const siguiente = () => { const s = salaRef.current; if (!s) return; if (s.salaIdx >= s.pruebas.length - 1) iniciarBatalla(false); else iniciarSala(s.salaIdx + 1); };
    const terminar = () => { if (window.confirm('¿Terminar la partida para todos?')) upd({ estado: 'fin', fase: 'TERMINADA' }); };

    // ---------- máquina de estados del anfitrión ----------
    useEffect(() => {
        if (!sala || !refDoc) return;
        const i = sala.salaIdx;
        const prueba = sala.pruebas?.[i];
        if (sala.fase === 'RETOS' && progreso >= sala.objetivo && sala.objetivo > 0 && transRef.current !== `C${i}`) {
            transRef.current = `C${i}`;
            const cand = prueba?.tipo === 'MANUAL' ? candadoManual(prueba) : generarCandado(prueba?.materia, sala.etapa, prueba?.tema);
            upd({ fase: 'CANDADO', candado: { ...cand, reparto: barajar(Object.keys(sala.jugadores || {})) } });
            audio.campana();
        }
        if (sala.fase === 'CANDADO' && sala.candadoAbierto && transRef.current !== `A${i}`) {
            transRef.current = `A${i}`;
            upd({ fase: 'ABIERTA', amuletos: arrayUnion(prueba?.id || `p${i}`) });
            audio.puerta();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sala]);

    // Reloj + bucle de batalla (con refs para no depender del render)
    useEffect(() => {
        if (!refDoc) return;
        const id = setInterval(() => {
            const t = Date.now();
            setAhora(t);
            const s = salaRef.current; if (!s) return;
            if (['RETOS', 'CANDADO', 'ABIERTA'].includes(s.fase) && s.tiempoFin && s.tiempoFin - (s.penalSeg || 0) * 1000 - t <= 0 && transRef.current !== 'BATALLA') {
                iniciarBatalla(true);
                return;
            }
            if (s.fase !== 'BATALLA' || !s.batalla) return;
            const b = s.batalla;
            if (b.hpMax - b.golpes <= 0) {
                if (transRef.current !== 'FIN') { transRef.current = 'FIN'; upd({ fase: 'VICTORIA', estado: 'fin' }); }
                return;
            }
            if (t >= b.proximoAtaque && transRef.current !== `Z${b.ataques + 1}`) {
                transRef.current = `Z${b.ataques + 1}`;
                const bloqueado = b.golpes - (b.golpesBase || 0) >= b.escudo;
                const vidas = bloqueado ? b.vidas : b.vidas - 1;
                const datos = {
                    'batalla.ataques': b.ataques + 1, 'batalla.ultimoAtaque': { n: b.ataques + 1, bloqueado, ts: t },
                    'batalla.vidas': vidas, 'batalla.golpesBase': b.golpes, 'batalla.proximoAtaque': t + Z.ataqueMs,
                };
                if (vidas <= 0) datos.fase = 'DERROTA';
                upd(datos);
            }
        }, 500);
        return () => clearInterval(id);
    }, [refDoc, Z, upd, iniciarBatalla]);

    // Avance automático tras abrir una puerta
    useEffect(() => {
        if (fase !== 'ABIERTA') return;
        const id = setTimeout(() => { if (salaRef.current?.fase === 'ABIERTA') siguiente(); }, 9000);
        return () => clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fase, salaIdx]);

    const ultimoTs = sala?.ultimo?.ts;
    useEffect(() => {
        if (!sala?.ultimo) return;
        setFeed(f => [{ ...sala.ultimo, id: ultimoTs + Math.random() }, ...f].slice(0, 6));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ultimoTs]);

    const golpes = sala?.batalla?.golpes || 0;
    const golpesPrev = useRef(0);
    useEffect(() => {
        if (golpes > golpesPrev.current && fase === 'BATALLA') {
            const dmg = golpes - golpesPrev.current;
            audio.golpe();
            setZEstado('golpe');
            const id = Math.random();
            setNumsGolpe(n => [...n.slice(-6), { id, dmg, x: 20 + Math.random() * 60 }]);
            setTimeout(() => setNumsGolpe(n => n.filter(g => g.id !== id)), 1000);
            const t = setTimeout(() => setZEstado(e => (e === 'golpe' ? 'idle' : e)), 350);
            golpesPrev.current = golpes;
            return () => clearTimeout(t);
        }
        golpesPrev.current = golpes;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [golpes]);

    const ataqueN = sala?.batalla?.ultimoAtaque?.n || 0;
    useEffect(() => {
        if (!ataqueN) return;
        const bloqueado = sala.batalla.ultimoAtaque.bloqueado;
        setZEstado('ataque');
        setFlash(bloqueado ? 'azul' : 'rojo');
        if (bloqueado) audio.escudo(); else audio.rugido();
        const t1 = setTimeout(() => setZEstado('idle'), 900);
        const t2 = setTimeout(() => setFlash(null), 900);
        return () => { clearTimeout(t1); clearTimeout(t2); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ataqueN]);

    useEffect(() => {
        if (fase === 'VICTORIA') { setZEstado('muerto'); audio.victoria(); }
        if (fase === 'DERROTA') { setZEstado('victoria'); audio.derrota(); }
        if (fase === 'BATALLA') setZEstado('idle');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fase]);

    if (error) return <PantallaSimple titulo="😱 ¡Vaya!" texto={error} onSalir={onSalir} />;
    if (!sala) return <PantallaSimple titulo="🕯️ Encendiendo las velas…" texto="Preparando la mansión embrujada." />;

    const enSalas = ['RETOS', 'CANDADO', 'ABIERTA'].includes(fase);
    const enPelea = ['BATALLA', 'VICTORIA', 'DERROTA'].includes(fase) && sala.batalla;
    const b = sala.batalla;
    const hp = b ? b.hpMax - b.golpes : 0;
    const cand = sala.candado;
    const url = urlSalaEnVivo(codigo);
    const qr = (tam) => `https://api.qrserver.com/v1/create-qr-code/?size=${tam}x${tam}&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=1a0b2e&margin=8`;
    const abiertas = pruebas.map((p, i) => ((sala.amuletos || []).includes(p.id) ? i : -1)).filter(i => i >= 0);
    const codigoManual = (i) => String(config.pruebas.find(p => p.id === pruebas[i]?.id)?.codigo || '').split('|')[0].trim();

    const barraSup = (
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', flexWrap: 'wrap', background: 'rgba(0,0,0,.35)' }}>
            <button className="eh-btn2" onClick={onSalir}>← Salir</button>
            <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>🎃 Sala <span style={{ color: '#ffb347', letterSpacing: 3 }}>{codigo}</span></div>
            <QRSalaBoton codigo={codigo} texto="QR" style={{ padding: '7px 12px' }} />
            <div style={{ fontWeight: 700, opacity: .85 }}>👥 {nJug}</div>
            <div style={{ flex: 1 }} />
            {sala.tiempoFin && enSalas && (
                <div style={{ fontWeight: 900, fontSize: '1.6rem', color: restante < 120000 ? '#ef4444' : '#ffde59', fontVariantNumeric: 'tabular-nums' }}
                    className={restante < 60000 ? 'eh-latido' : ''}>⏳ {mmss(restante)}</div>
            )}
            <button className="eh-btn2" onClick={cambiar3D} title="Mostrar u ocultar la mansión 3D">{usar3D ? '🏚️ 3D' : '🖼️ 2D'}</button>
            <button className="eh-btn2" onClick={() => setSonido(s => !s)}>{sonido ? '🔊' : '🔇'}</button>
        </div>
    );

    // ── capa superpuesta sobre la escena 3D ──
    const capa = { position: 'absolute', zIndex: 2, background: 'rgba(20,8,38,.8)', border: '2px solid rgba(255,140,26,.4)', borderRadius: 16, padding: '10px 14px', backdropFilter: 'blur(3px)' };
    let superpuesto = null;
    if (fase === 'LOBBY') {
        superpuesto = (
            <div style={{ ...capa, top: 12, right: 12, textAlign: 'center', width: 230 }}>
                <div style={{ fontSize: '.85rem', opacity: .85 }}>{window.location.host}</div>
                <div style={{ fontSize: '2.2rem', fontWeight: 900, letterSpacing: 6, color: '#ffb347' }}>{codigo}</div>
                <img alt="QR" src={qr(220)} style={{ width: 180, height: 180, borderRadius: 12, border: '3px solid #ff8c1a' }} />
                <button className="eh-btn" disabled={nJug === 0} onClick={empezar} style={{ width: '100%', marginTop: 10 }}>🕯️ Entrar en la mansión</button>
            </div>
        );
    } else if (enSalas) {
        const pct = sala.objetivo ? Math.min(100, (progreso / sala.objetivo) * 100) : 0;
        superpuesto = (
            <div style={{ ...capa, top: 12, left: 12, maxWidth: 'min(460px, 70%)' }}>
                <div style={{ fontWeight: 800, color: salaInfo.color, textTransform: 'uppercase', letterSpacing: 2, fontSize: '.75rem' }}>Sala {salaIdx + 1} de {pruebas.length} · {salaInfo.materia}</div>
                <div style={{ fontWeight: 900, fontSize: '1.25rem' }}>{salaInfo.emoji} {salaInfo.nombre}</div>
                {fase === 'RETOS' && <div className="eh-barra" style={{ height: 16, marginTop: 6 }}><div style={{ width: `${pct}%` }} /></div>}
                {fase === 'CANDADO' && <div style={{ marginTop: 4, fontWeight: 800, color: '#ffde59' }}>🔒 {cand?.titulo}</div>}
                {fase === 'ABIERTA' && <div style={{ marginTop: 4, fontWeight: 800, color: '#4ade80' }}>🚪 ¡Puerta abierta! {salaInfo.amuleto.emoji}</div>}
            </div>
        );
    } else if (enPelea) {
        superpuesto = (
            <div style={{ ...capa, top: 12, left: '50%', transform: 'translateX(-50%)', width: 'min(560px, 90%)' }}>
                <BarraVidaZombi hp={hp} hpMax={b.hpMax} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, gap: 10, flexWrap: 'wrap' }}>
                    <Corazones vidas={b.vidas} max={b.vidasMax} />
                    {fase === 'BATALLA' && <div style={{ fontWeight: 800 }}>⏱️ {Math.max(0, Math.ceil((b.proximoAtaque - ahora) / 1000))} s · 🛡️ {Math.min(b.golpes - (b.golpesBase || 0), b.escudo)}/{b.escudo}</div>}
                </div>
            </div>
        );
    }
    const escena = usar3D && fase !== 'TERMINADA' ? (
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 1240, margin: '0 auto', padding: '12px 18px 0' }}>
            <Mansion3D pruebas={infos3D} fase={fase} salaIdx={salaIdx} abiertas={abiertas} jugadores={jugadores}
                batalla={b ? { golpes: b.golpes, ataqueN: b.ultimoAtaque?.n || 0, bloqueado: !!b.ultimoAtaque?.bloqueado } : null}
                alto={enSalas || enPelea ? 'min(52vh, 560px)' : 'min(60vh, 620px)'} />
            {superpuesto}
            {enPelea && numsGolpe.map(g => <div key={g.id} className="eh-golpe-num" style={{ left: `${g.x}%`, top: '40%', zIndex: 3 }}>−{g.dmg}</div>)}
        </div>
    ) : null;

    const controles = (extra) => (
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', padding: 14 }}>
            {extra}
            {enSalas && <>
                <button className="eh-btn2" onClick={() => upd({ tiempoFin: (sala.tiempoFin || Date.now()) + 5 * 60000 })}>➕ 5 min</button>
                <button className="eh-btn2" onClick={siguiente}>⏭ {esUltima ? 'Saltar a la batalla' : 'Saltar sala'}</button>
            </>}
            {fase !== 'VICTORIA' && fase !== 'TERMINADA' && <button className="eh-btn2" onClick={terminar}>⏹ Terminar</button>}
        </div>
    );

    // ── contenido por fase ──
    let contenido = null, extraControles = null;
    const contenedor = { position: 'relative', zIndex: 1, maxWidth: 1240, margin: '0 auto', padding: '14px 18px' };

    if (fase === 'LOBBY') {
        contenido = (
            <div style={{ ...contenedor, display: 'grid', gridTemplateColumns: usar3D ? '1fr' : 'repeat(auto-fit,minmax(300px,1fr))', gap: 18 }}>
                {!usar3D && (
                    <div className="eh-panel" style={{ padding: 24, textAlign: 'center' }}>
                        <h1 className="eh-titulo" style={{ fontSize: 'clamp(2rem,5vw,3.2rem)' }}>La mansión del zombi</h1>
                        <p style={{ opacity: .85 }}>Escanead el QR o entrad en <b>{window.location.host}</b> con el código:</p>
                        <div style={{ fontSize: '3.2rem', fontWeight: 900, letterSpacing: 10, color: '#ffb347' }}>{codigo}</div>
                        <img alt="QR" src={qr(260)} style={{ width: 220, height: 220, borderRadius: 16, marginTop: 8, border: '4px solid #ff8c1a' }} />
                        <div style={{ marginTop: 16 }}><button className="eh-btn" disabled={nJug === 0} onClick={empezar} style={{ fontSize: '1.2rem', padding: '14px 30px' }}>🕯️ Entrar en la mansión</button></div>
                    </div>
                )}
                <div className="eh-panel" style={{ padding: 18 }}>
                    <h3 style={{ margin: '0 0 6px' }}>👻 Valientes en la puerta ({nJug}) <span style={{ fontWeight: 500, fontSize: '.85rem', opacity: .7 }}>· {pruebas.length} pruebas · {ETAPAS.find(e => e.v === sala.etapa)?.l} · {config.minutos} min · {Z.l}</span></h3>
                    <MapaMansion pruebas={pruebas} salaIdx={-1} fase="LOBBY" />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                        {listaJug.length === 0 && <div style={{ opacity: .6 }}>Esperando a los primeros valientes… (cada uno elige su disfraz en el móvil)</div>}
                        {listaJug.map(j => (
                            <span key={j.k} className="eh-aparece" style={{ padding: '6px 12px', borderRadius: 20, background: 'rgba(255,140,26,.18)', border: '1px solid rgba(255,140,26,.4)', fontWeight: 700 }}>
                                {j.avatar?.disfraz ? disfrazDe(j.avatar.disfraz).emoji : AVATARES[hash(j.k) % AVATARES.length]} {j.nombre}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        );
    } else if (fase === 'INTRO') {
        contenido = (
            <div className="eh-panel eh-aparece" style={{ maxWidth: 820, margin: '18px auto', padding: 26, textAlign: 'center', position: 'relative', zIndex: 1 }}>
                {!usar3D && <div className="eh-flota" style={{ fontSize: '4rem' }}>🏚️</div>}
                <h1 className="eh-titulo" style={{ fontSize: 'clamp(1.8rem,4.5vw,3rem)' }}>¡La puerta se ha cerrado!</h1>
                <p style={{ fontSize: '1.2rem', lineHeight: 1.55 }}>
                    Es la noche de Halloween y habéis entrado en la vieja mansión… <b>¡CLAC!</b> La puerta se ha cerrado a vuestra espalda.
                    En el sótano, un <b>zombi</b> está a punto de despertar.
                </p>
                <p style={{ fontSize: '1.1rem', lineHeight: 1.55, opacity: .9 }}>
                    Superad las <b>{pruebas.length} pruebas</b> y abrid cada candado <b>entre todos</b>. Cada sala os dará un <b>amuleto</b> (una vida más para la batalla final).
                    Tenéis <b>{config.minutos} minutos</b>… si se acaba el tiempo, el zombi despertará antes y más fuerte.
                </p>
                <MapaMansion pruebas={pruebas} salaIdx={-1} fase="INTRO" />
                <button className="eh-btn" style={{ marginTop: 20, fontSize: '1.2rem', padding: '14px 30px' }} onClick={() => iniciarSala(0)}>🚪 Abrir la primera puerta</button>
            </div>
        );
    } else if (enSalas) {
        const pct = sala.objetivo ? Math.min(100, (progreso / sala.objetivo) * 100) : 0;
        const top = [...listaJug].sort((x, y) => (y.aciertos || 0) - (x.aciertos || 0)).slice(0, 5);
        const historia = pruebas[salaIdx]?.tipo === 'MANUAL' ? '' : salaInfo.historia;
        contenido = (
            <div style={contenedor}>
                <MapaMansion pruebas={pruebas} salaIdx={salaIdx} amuletos={sala.amuletos} fase={fase} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 18, marginTop: 14 }}>
                    <div className="eh-panel" style={{ padding: 22, borderColor: salaInfo.color + '99', gridColumn: 'span 2', minWidth: 0 }}>
                        {!usar3D && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                <div className="eh-flota" style={{ fontSize: '3.2rem' }}>{salaInfo.emoji}</div>
                                <div>
                                    <div style={{ fontWeight: 800, color: salaInfo.color, textTransform: 'uppercase', letterSpacing: 2, fontSize: '.85rem' }}>Sala {salaIdx + 1} de {pruebas.length} · {salaInfo.materia}</div>
                                    <h2 className="eh-titulo" style={{ fontSize: 'clamp(1.6rem,3.5vw,2.5rem)' }}>{salaInfo.nombre}</h2>
                                </div>
                            </div>
                        )}
                        {fase === 'RETOS' && <>
                            {historia && <p style={{ fontSize: '1.12rem', lineHeight: 1.5, opacity: .9, marginTop: 0 }}>{historia}</p>}
                            <p style={{ fontWeight: 800, fontSize: '1.1rem' }}>📱 ¡Responded en vuestros móviles para cargar la energía de la puerta!</p>
                            <div className="eh-barra" style={{ height: 36, borderRadius: 18 }}><div style={{ width: `${pct}%` }} /></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontWeight: 800, fontSize: '1.2rem' }}>
                                <span><span className="eh-vela">🕯️</span> {progreso} / {sala.objetivo} aciertos</span><span>{Math.round(pct)} %</span>
                            </div>
                        </>}
                        {fase === 'CANDADO' && cand && (
                            <div className="eh-aparece" style={{ textAlign: 'center' }}>
                                <div className="eh-latido" style={{ fontSize: '3.4rem' }}>🔒</div>
                                <h2 style={{ margin: '4px 0', fontSize: '1.9rem', color: '#ffde59' }}>{cand.titulo}</h2>
                                <p style={{ fontSize: '1.25rem', lineHeight: 1.5, maxWidth: 760, margin: '0 auto', whiteSpace: 'pre-wrap' }}>{cand.instruccion}</p>
                                {cand.imagen && <img src={cand.imagen} alt="" style={{ maxWidth: '100%', maxHeight: 260, borderRadius: 12, marginTop: 12 }} />}
                                {cand.compartidas
                                    ? <p style={{ fontWeight: 800, color: '#ffb347', fontSize: '1.15rem' }}>🔎 ¡Buscad el código! Cuando lo tengáis, escribidlo en cualquier móvil.{cand.longitud ? ` (${cand.longitud} ${cand.tipo === 'numero' ? 'cifras' : 'caracteres'})` : ''}</p>
                                    : <p style={{ fontWeight: 800, color: '#ffb347', fontSize: '1.15rem' }}>
                                        🗣️ ¡Hablad entre vosotros! Las pistas están repartidas en {Math.min(cand.pistas.length, Math.max(1, cand.reparto?.length || nJug))} grupos de móviles.
                                        {cand.longitud ? ` · Respuesta de ${cand.longitud} ${cand.tipo === 'numero' ? 'cifras' : 'letras'}.` : ''}
                                    </p>}
                                <p style={{ opacity: .75 }}>Cada código incorrecto resta {PENAL_CANDADO} s al reloj.</p>
                                {sala.pistasReveladas > 0 && (
                                    <div style={{ display: 'grid', gap: 8, textAlign: 'left' }}>
                                        {cand.pistas.slice(0, sala.pistasReveladas).map((p, i) => (
                                            <div key={i} className="eh-aparece" style={{ padding: 12, borderRadius: 12, background: 'rgba(255,222,89,.12)', border: '1px solid rgba(255,222,89,.4)', fontSize: '1.1rem', display: 'flex', gap: 12, alignItems: 'center' }}>
                                                💡 {p.texto} {p.img && <img src={p.img} alt="" style={{ height: 50, borderRadius: 6, background: '#fff' }} />}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        {fase === 'ABIERTA' && (
                            <div className="eh-aparece" style={{ textAlign: 'center', padding: '6px 0' }}>
                                {!usar3D && (
                                    <div style={{ display: 'inline-block', width: 110, height: 150, borderRadius: '55px 55px 6px 6px', position: 'relative', boxShadow: '0 0 40px rgba(255,200,100,.6)' }}>
                                        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(#fff6c8,#ffb347)', borderRadius: '55px 55px 6px 6px' }} />
                                        <div className="eh-puerta" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,#4a2c12,#6b4220)', borderRadius: '55px 55px 6px 6px', border: '3px solid #2a1606' }} />
                                    </div>
                                )}
                                <h2 style={{ fontSize: '2.1rem', margin: '10px 0 4px', color: '#4ade80' }}>¡Puerta abierta!</h2>
                                <p style={{ fontSize: '1.2rem' }}>
                                    {sala.candadoAbierto?.nombre && <>🗝️ <b>{sala.candadoAbierto.nombre}</b> ha escrito el código: <b style={{ color: '#ffde59' }}>{cand?.manual ? codigoManual(salaIdx) : cand?.solucionVisible}</b><br /></>}
                                    Amuleto conseguido: <span style={{ fontSize: '2rem' }}>{salaInfo.amuleto.emoji}</span> <b>{salaInfo.amuleto.nombre}</b> (+1 vida en la batalla)
                                </p>
                                <button className="eh-btn" onClick={siguiente} style={{ fontSize: '1.15rem' }}>{esUltima ? '⚔️ ¡Bajar al sótano a por el zombi!' : '🚪 Siguiente sala'}</button>
                            </div>
                        )}
                    </div>
                    <div className="eh-panel" style={{ padding: 18 }}>
                        <h3 style={{ margin: '0 0 10px' }}>⚡ En directo</h3>
                        {feed.length === 0 && <div style={{ opacity: .6 }}>Aún no hay aciertos…</div>}
                        {feed.map(f => (
                            <div key={f.id} className="eh-aparece" style={{ padding: '6px 10px', marginBottom: 6, borderRadius: 10, background: f.candado ? 'rgba(239,68,68,.2)' : 'rgba(74,222,128,.15)' }}>
                                {f.candado ? `🔐 ${f.nombre} probó un código… ¡incorrecto! −${PENAL_CANDADO} s` : `✔ ${f.nombre}`}
                            </div>
                        ))}
                        <h3 style={{ margin: '16px 0 8px' }}>🏅 Más valientes</h3>
                        {top.map((j, i) => (
                            <div key={j.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                                <span>{['🥇', '🥈', '🥉', '4.', '5.'][i]} {j.nombre}</span><b>{j.aciertos || 0}</b>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
        if (fase === 'CANDADO' && cand) extraControles = <>
            {cand.pistas.length > 0 && <button className="eh-btn2" disabled={sala.pistasReveladas >= cand.pistas.length} onClick={() => upd({ pistasReveladas: increment(1) })}>💡 Mostrar una pista en pantalla</button>}
            <button className="eh-btn2" onClick={() => upd({ candadoAbierto: { nombre: 'El profe', ts: Date.now() } })}>🔓 Abrir el candado</button>
        </>;
    } else if (enPelea) {
        const heroes = [...listaJug].sort((x, y) => ((y.golpes || 0) + (y.aciertos || 0)) - ((x.golpes || 0) + (x.aciertos || 0)));
        contenido = (
            <div style={{ ...contenedor, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 18, alignItems: 'start' }}>
                <div className="eh-panel" style={{ padding: 20, textAlign: 'center', gridColumn: 'span 2', minWidth: 0 }}>
                    {fase === 'BATALLA' && <h1 className="eh-titulo" style={{ fontSize: 'clamp(1.7rem,4vw,2.8rem)' }}>¡Batalla final contra el zombi!</h1>}
                    {fase === 'VICTORIA' && <h1 className="eh-titulo" style={{ fontSize: 'clamp(2rem,5vw,3.4rem)', color: '#4ade80' }}>¡Habéis escapado!</h1>}
                    {fase === 'DERROTA' && <h1 className="eh-titulo" style={{ fontSize: 'clamp(2rem,5vw,3.2rem)', color: '#ef4444' }}>¡El zombi os ha atrapado!</h1>}
                    {sala.tiempoAgotado && fase === 'BATALLA' && <p style={{ color: '#fca5a5', fontWeight: 800 }}>⏰ Se acabó el tiempo: el zombi ha despertado con un 50 % más de vida.</p>}
                    {!usar3D && <>
                        <div style={{ position: 'relative', display: 'inline-block', margin: '6px 0' }}>
                            <Zombi estado={zEstado} size={Math.min(280, window.innerWidth * 0.5)} />
                            {numsGolpe.map(g => <div key={g.id} className="eh-golpe-num" style={{ left: `${g.x}%`, top: '20%' }}>−{g.dmg}</div>)}
                        </div>
                        <div style={{ maxWidth: 560, margin: '0 auto' }}><BarraVidaZombi hp={hp} hpMax={b.hpMax} /></div>
                    </>}
                    {fase === 'BATALLA' && (
                        <div style={{ display: 'flex', gap: 18, justifyContent: 'center', flexWrap: 'wrap', marginTop: 10, fontSize: '1.15rem', fontWeight: 800 }}>
                            <div>⏱️ El zombi ataca en <span style={{ color: '#ffde59' }}>{Math.max(0, Math.ceil((b.proximoAtaque - ahora) / 1000))} s</span></div>
                            <div>🛡️ Escudo: <span style={{ color: b.golpes - (b.golpesBase || 0) >= b.escudo ? '#60a5fa' : '#fca5a5' }}>{Math.min(b.golpes - (b.golpesBase || 0), b.escudo)} / {b.escudo}</span> golpes</div>
                        </div>
                    )}
                    {fase === 'BATALLA' && <p style={{ opacity: .8, margin: '8px 0 0' }}>📱 Cada acierto es un golpe (¡doble si respondes en menos de 4 s!). Juntad {b.escudo} golpes antes de cada ataque para bloquearlo.</p>}
                    {fase === 'DERROTA' && (
                        <div style={{ marginTop: 10 }}>
                            <p style={{ fontSize: '1.1rem' }}>Pero el zombi está herido… ¡le quedan {hp} puntos de vida!</p>
                            <button className="eh-btn" onClick={revancha} style={{ fontSize: '1.15rem' }}>🔁 ¡Revancha! (el zombi conserva sus heridas)</button>
                        </div>
                    )}
                    {fase === 'VICTORIA' && <p style={{ fontSize: '1.25rem' }}>El zombi ha caído y la puerta de la mansión se abre. ¡Feliz Halloween! 🎃</p>}
                </div>
                <div className="eh-panel" style={{ padding: 18 }}>
                    {!usar3D && <><h3 style={{ margin: '0 0 8px', textAlign: 'center' }}>Vidas de la clase</h3><Corazones vidas={b.vidas} max={b.vidasMax} /></>}
                    <div style={{ textAlign: 'center', marginTop: 6, fontSize: '1.4rem' }}>{pruebas.map((p, i) => ((sala.amuletos || []).includes(p.id) ? infoPrueba(p, i, pruebas).amuleto.emoji : null)).filter(Boolean).join(' ')}</div>
                    <h3 style={{ margin: '12px 0 8px' }}>{fase === 'VICTORIA' ? '🏆 Héroes de la noche' : '⚔️ Golpes'}</h3>
                    <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                        {heroes.map((j, i) => (
                            <div key={j.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                                <span>{i < 3 ? ['🥇', '🥈', '🥉'][i] : `${i + 1}.`} {j.avatar?.disfraz ? disfrazDe(j.avatar.disfraz).emoji : ''} {j.nombre}</span>
                                <span>✔ {j.aciertos || 0} · 💥 {j.golpes || 0}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    } else {
        contenido = (
            <div className="eh-panel" style={{ maxWidth: 440, margin: '60px auto', padding: 26, textAlign: 'center', position: 'relative', zIndex: 1 }}>
                <h2 style={{ marginTop: 0 }}>🎃 Partida terminada</h2>
                <p>¡Gracias por jugar al escape room de Halloween!</p>
                <button className="eh-btn" onClick={onSalir}>Salir</button>
            </div>
        );
    }

    return (
        <div className="eh-root" style={fase === 'VICTORIA' ? { background: 'radial-gradient(ellipse at 50% 0%, #5e3b1d 0%, #2e1a0b 50%, #0f0703 100%)' } : undefined}>
            <Ambiente murcielagos={fase === 'BATALLA' ? 8 : 5} />
            {flash && <div className={flash === 'rojo' ? 'eh-flash-rojo' : 'eh-flash-azul'} />}
            {fase === 'VICTORIA' && <Confeti />}
            {barraSup}
            {escena}
            {contenido}
            {fase === 'VICTORIA'
                ? <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', padding: 14 }}><button className="eh-btn2" onClick={onSalir}>← Salir</button></div>
                : fase !== 'LOBBY' && fase !== 'TERMINADA' && controles(extraControles)}
        </div>
    );
}

// =====================================================================
//  ALUMNO (móvil)
// =====================================================================
function ClienteEscape({ codigo, nombre, avatarInicial, onSalir }) {
    const audioRef = useRef(null);
    if (!audioRef.current) audioRef.current = crearAudio();
    const audio = audioRef.current;
    const [sonido, setSonido] = useState(true);
    useEffect(() => { audio.activo = sonido; }, [sonido, audio]);
    useEffect(() => () => audio.cerrar(), [audio]);

    const clave = claveDe(nombre);
    const refSala = useMemo(() => doc(db, 'live_games', String(codigo).toUpperCase()), [codigo]);
    const [sala, setSala] = useState(null);
    const [error, setError] = useState('');
    const [pregunta, setPregunta] = useState(null);
    const [feedback, setFeedback] = useState(null);
    const [t0, setT0] = useState(Date.now());
    const [codigoTxt, setCodigoTxt] = useState('');
    const [esperaCandado, setEsperaCandado] = useState(0);
    const [msgCandado, setMsgCandado] = useState('');
    const [flash, setFlash] = useState(null);
    const [ahora, setAhora] = useState(Date.now());
    const [critico, setCritico] = useState(false);
    const [avatar, setAvatar] = useState(avatarInicial || leerAvatarGuardado() || avatarAleatorio());
    const [editandoDisfraz, setEditandoDisfraz] = useState(false);
    const stats = useRef({ aciertos: 0, fallos: 0, golpes: 0 });
    const registrado = useRef(false);
    const salaRef = useRef(null);
    salaRef.current = sala;

    useEffect(() => {
        let unsub = null, vivo = true;
        (async () => {
            try {
                const snap = await getDoc(refSala);
                if (!snap.exists()) { setError('La sala no existe o ya se ha cerrado.'); return; }
                const prev = snap.data().jugadores?.[clave];
                if (prev) stats.current = { aciertos: prev.aciertos || 0, fallos: prev.fallos || 0, golpes: prev.golpes || 0 };
                await updateDoc(refSala, { [`jugadores.${clave}.nombre`]: nombre, [`jugadores.${clave}.ts`]: Date.now(), [`jugadores.${clave}.avatar`]: avatar });
                if (!vivo) return;
                unsub = onSnapshot(refSala, s => {
                    if (!s.exists()) { setError('La sala se ha cerrado.'); return; }
                    setSala(s.data());
                });
            } catch (e) { setError('Error al entrar: ' + e.message); }
        })();
        return () => { vivo = false; if (unsub) unsub(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [codigo]);

    const cambiarAvatar = (a) => { setAvatar(a); updateDoc(refSala, { [`jugadores.${clave}.avatar`]: a }).catch(() => { }); };

    useEffect(() => { const id = setInterval(() => setAhora(Date.now()), 1000); return () => clearInterval(id); }, []);

    const fase = sala?.fase || 'LOBBY';
    const salaIdx = sala?.salaIdx ?? 0;
    const pruebas = sala?.pruebas || [];
    const salaInfo = infoPrueba(pruebas[salaIdx], salaIdx, pruebas);

    const nuevaPregunta = useCallback(() => {
        const s = salaRef.current; if (!s) return;
        const lista = s.pruebas || [];
        let prueba = lista[s.salaIdx];
        if (s.fase === 'BATALLA') {
            const conPreguntas = lista.filter(p => materiaDePrueba(p));
            prueba = conPreguntas.length ? pick(conPreguntas) : { tipo: 'MATERIA', materia: pick(ORDEN_SALAS), tema: 'MIX' };
        }
        const materia = materiaDePrueba(prueba) || 'MATES';
        setPregunta(generarPregunta(materia, s.etapa, temaDePrueba(prueba)));
        setT0(Date.now());
    }, []);

    useEffect(() => {
        if (fase === 'RETOS' || fase === 'BATALLA') { setFeedback(null); nuevaPregunta(); }
        if (fase === 'CANDADO') { setCodigoTxt(''); setMsgCandado(''); }
        if (fase !== 'LOBBY' && fase !== 'INTRO') setEditandoDisfraz(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fase, salaIdx]);

    const ataque = sala?.batalla?.ultimoAtaque;
    useEffect(() => {
        if (!ataque?.n) return;
        setFlash(ataque.bloqueado ? 'azul' : 'rojo');
        if (!ataque.bloqueado) { try { navigator.vibrate?.([200, 80, 200]); } catch { } audio.rugido(); } else audio.escudo();
        const t = setTimeout(() => setFlash(null), 900);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ataque?.n]);

    useEffect(() => {
        if (registrado.current) return;
        if (fase === 'VICTORIA' || fase === 'TERMINADA') {
            registrado.current = true;
            const { aciertos, fallos } = stats.current;
            guardarRegistroLocal(TIPO_JUEGO, {
                titulo: fase === 'VICTORIA' ? 'Escape Room de Halloween · ¡Escapamos!' : 'Escape Room de Halloween',
                aciertos, intentos: aciertos + fallos, nombre, via: 'online',
            });
        }
    }, [fase, nombre]);

    const responder = (i) => {
        if (!pregunta || feedback) return;
        audio.desbloquear();
        const ok = i === pregunta.correcta;
        setFeedback({ ok, elegida: i });
        if (ok) {
            audio.acierto();
            stats.current.aciertos++;
            const base = { [`jugadores.${clave}.aciertos`]: increment(1), [`jugadores.${clave}.fallos`]: stats.current.fallos, ultimo: { nombre, ts: Date.now() } };
            if (fase === 'RETOS') {
                updateDoc(refSala, { ...base, [`progreso.s${salaIdx}`]: increment(1) }).catch(() => { });
            } else if (fase === 'BATALLA') {
                const dmg = Date.now() - t0 < 4000 ? 2 : 1;
                stats.current.golpes += dmg;
                setCritico(dmg === 2);
                updateDoc(refSala, { ...base, 'batalla.golpes': increment(dmg), [`jugadores.${clave}.golpes`]: increment(dmg) }).catch(() => { });
            }
        } else {
            audio.fallo();
            stats.current.fallos++;
        }
        setTimeout(() => { setFeedback(null); setCritico(false); nuevaPregunta(); }, ok ? 650 : 1900);
    };

    const intentarCandado = () => {
        if (!sala?.candado || ahora < esperaCandado || !codigoTxt.trim()) return;
        audio.desbloquear();
        if (compruebaCandado(sala.candado, codigoTxt)) {
            audio.puerta();
            updateDoc(refSala, { candadoAbierto: { nombre, ts: Date.now() } }).catch(() => { });
        } else {
            audio.fallo();
            try { navigator.vibrate?.(300); } catch { }
            setMsgCandado(`❌ ¡Código incorrecto! El reloj pierde ${PENAL_CANDADO} s. Espera un momento antes de volver a probar.`);
            setEsperaCandado(Date.now() + 8000);
            updateDoc(refSala, { penalSeg: increment(PENAL_CANDADO), ultimo: { nombre, ts: Date.now(), candado: true } }).catch(() => { });
        }
    };

    if (error) return <PantallaSimple titulo="😱 ¡Vaya!" texto={error} onSalir={onSalir} />;
    if (!sala) return <PantallaSimple titulo="🕯️ Entrando en la mansión…" texto="Conectando con la sala." />;

    const restante = sala.tiempoFin ? sala.tiempoFin - (sala.penalSeg || 0) * 1000 - ahora : null;
    const cabecera = (
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(0,0,0,.35)' }}>
            <button className="eh-btn2" style={{ padding: '6px 10px' }} onClick={onSalir}>←</button>
            <div style={{ fontWeight: 800, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{disfrazDe(avatar?.disfraz).emoji} {nombre}</div>
            {restante != null && ['RETOS', 'CANDADO', 'ABIERTA'].includes(fase) && (
                <div style={{ fontWeight: 900, color: restante < 120000 ? '#ef4444' : '#ffde59', fontVariantNumeric: 'tabular-nums' }}>⏳ {mmss(restante)}</div>
            )}
            <button className="eh-btn2" style={{ padding: '6px 10px' }} onClick={() => setSonido(s => !s)}>{sonido ? '🔊' : '🔇'}</button>
        </div>
    );
    const envoltorio = (contenido, extra = null) => (
        <div className="eh-root"><Ambiente murcielagos={3} />
            {flash && <div className={flash === 'rojo' ? 'eh-flash-rojo' : 'eh-flash-azul'} />}
            {extra}
            {cabecera}
            <div style={{ position: 'relative', zIndex: 1, maxWidth: 560, margin: '0 auto', padding: 14 }}>{contenido}</div>
        </div>
    );

    if (fase === 'LOBBY' || fase === 'INTRO') {
        if (editandoDisfraz) return envoltorio(<EditorDisfraz avatar={avatar} nombre={nombre} onChange={cambiarAvatar} onListo={() => setEditandoDisfraz(false)} textoListo="✔ Listo" />);
        return envoltorio(
            <div className="eh-panel eh-aparece" style={{ padding: 22, textAlign: 'center' }}>
                <AvatarPreview3D avatar={avatar} size={170} />
                <h2 className="eh-titulo" style={{ fontSize: '1.9rem' }}>{fase === 'LOBBY' ? '¡Estás dentro!' : '¡La puerta se ha cerrado!'}</h2>
                <p style={{ lineHeight: 1.5 }}>{fase === 'LOBBY'
                    ? 'Mira la pantalla grande: tu personaje ya está en el jardín de la mansión. Espera a que el profe abra la puerta…'
                    : 'Mirad la pantalla grande. En cuanto se abra la primera sala, aquí te aparecerán los retos.'}</p>
                <button className="eh-btn2" onClick={() => setEditandoDisfraz(true)}>🎭 Cambiar disfraz</button>
                <div style={{ marginTop: 14 }}><MapaMansion pruebas={pruebas} salaIdx={-1} fase={fase} /></div>
            </div>
        );
    }

    if (fase === 'RETOS') {
        const prog = sala.progreso?.[`s${salaIdx}`] || 0;
        return envoltorio(<>
            <div style={{ textAlign: 'center', marginBottom: 10 }}>
                <div style={{ fontWeight: 800, color: salaInfo.color, fontSize: '.8rem', letterSpacing: 2, textTransform: 'uppercase' }}>Sala {salaIdx + 1} · {salaInfo.materia}</div>
                <div style={{ fontWeight: 900, fontSize: '1.15rem' }}>{salaInfo.emoji} {salaInfo.nombre}</div>
                <div className="eh-barra" style={{ height: 14, marginTop: 8 }}><div style={{ width: `${Math.min(100, (prog / Math.max(1, sala.objetivo)) * 100)}%` }} /></div>
            </div>
            <TarjetaPregunta pregunta={pregunta} feedback={feedback} onResponder={responder} color={salaInfo.color} />
            {feedback && !feedback.ok && <div className="eh-aparece" style={{ textAlign: 'center', marginTop: 12, fontWeight: 800, fontSize: '1.1rem' }}>👻 ¡Buuu! El fantasma te ha asustado…</div>}
            <div style={{ textAlign: 'center', marginTop: 12, opacity: .7, fontSize: '.85rem' }}>Tus aciertos: {stats.current.aciertos}</div>
        </>);
    }

    if (fase === 'CANDADO' && sala.candado) {
        const cand = sala.candado;
        let mias;
        if (cand.compartidas) mias = cand.pistas || [];
        else {
            const reparto = cand.reparto || [];
            let idx = reparto.indexOf(clave);
            const n = Math.max(1, reparto.length);
            if (idx < 0) idx = hash(clave) % n;
            mias = pistasDeJugador(cand.pistas, idx, n);
        }
        const espera = Math.max(0, Math.ceil((esperaCandado - ahora) / 1000));
        return envoltorio(
            <div className="eh-panel eh-aparece" style={{ padding: 20 }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="eh-latido" style={{ fontSize: '3rem' }}>🔒</div>
                    <h2 style={{ margin: '4px 0', color: '#ffde59' }}>{cand.titulo}</h2>
                    <p style={{ margin: '0 0 12px', opacity: .95, whiteSpace: 'pre-wrap', fontSize: cand.compartidas ? '1.1rem' : '1rem' }}>{cand.instruccion}</p>
                    {cand.imagen && <img src={cand.imagen} alt="" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 10, marginBottom: 10 }} />}
                </div>
                {mias.length > 0 && <div style={{ fontWeight: 800, marginBottom: 6 }}>{cand.compartidas ? '💡 Pista:' : `🤫 Tu${mias.length > 1 ? 's' : ''} pista${mias.length > 1 ? 's' : ''} secreta${mias.length > 1 ? 's' : ''}:`}</div>}
                {mias.map((p, i) => (
                    <div key={i} style={{ padding: 14, borderRadius: 14, background: 'rgba(255,222,89,.12)', border: '2px dashed rgba(255,222,89,.55)', marginBottom: 8, fontSize: '1.1rem', fontWeight: 700, textAlign: 'center' }}>
                        {p.texto}
                        {p.img && <div><img src={p.img} alt="" style={{ maxWidth: '100%', maxHeight: 130, marginTop: 8, borderRadius: 8, background: '#fff' }} /></div>}
                    </div>
                ))}
                <p style={{ textAlign: 'center', fontWeight: 800, color: '#ffb347' }}>{cand.compartidas ? '🔎 ¡Buscad el código por el aula!' : '🗣️ ¡Busca a los compañeros que tienen las otras pistas!'}</p>
                <input className="eh-input" value={codigoTxt} placeholder={cand.tipo === 'numero' ? '• • • •' : 'Escribe la respuesta'}
                    inputMode={cand.tipo === 'numero' ? 'numeric' : 'text'} maxLength={60}
                    onChange={e => setCodigoTxt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') intentarCandado(); }} />
                <button className="eh-btn" style={{ width: '100%', marginTop: 10 }} disabled={espera > 0 || !codigoTxt.trim()} onClick={intentarCandado}>
                    {espera > 0 ? `⏳ Espera ${espera} s` : '🗝️ Probar el código'}
                </button>
                {msgCandado && <div style={{ marginTop: 10, color: '#fca5a5', fontWeight: 700, textAlign: 'center' }}>{msgCandado}</div>}
            </div>
        );
    }

    if (fase === 'ABIERTA') {
        return envoltorio(
            <div className="eh-panel eh-aparece" style={{ padding: 24, textAlign: 'center' }}>
                <div className="eh-flota" style={{ fontSize: '4rem' }}>{salaInfo.amuleto.emoji}</div>
                <h2 style={{ color: '#4ade80', margin: '6px 0' }}>¡Puerta abierta!</h2>
                <p>{sala.candadoAbierto?.nombre ? <><b>{sala.candadoAbierto.nombre}</b> ha abierto el candado.</> : null}<br />
                    Amuleto: <b>{salaInfo.amuleto.nombre}</b> (+1 vida contra el zombi)</p>
                <p style={{ opacity: .75 }}>Preparaos para la siguiente sala…</p>
            </div>
        );
    }

    if (['BATALLA', 'VICTORIA', 'DERROTA'].includes(fase) && sala.batalla) {
        const b = sala.batalla;
        const hp = b.hpMax - b.golpes;
        if (fase === 'BATALLA') {
            return envoltorio(<>
                <div className="eh-panel" style={{ padding: 12, marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flexShrink: 0 }}><Zombi estado={feedback?.ok ? 'golpe' : 'idle'} size={70} /></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <BarraVidaZombi hp={hp} hpMax={b.hpMax} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '.85rem', fontWeight: 700 }}>
                                <span>❤️ {b.vidas}/{b.vidasMax}</span>
                                <span>⏱️ ataque en {Math.max(0, Math.ceil((b.proximoAtaque - ahora) / 1000))} s</span>
                            </div>
                        </div>
                    </div>
                </div>
                <TarjetaPregunta pregunta={pregunta} feedback={feedback} onResponder={responder} color="#ef4444" />
                {feedback?.ok && <div className="eh-aparece" style={{ textAlign: 'center', marginTop: 10, fontWeight: 900, fontSize: '1.4rem', color: '#ffde59' }}>{critico ? '💥 ¡GOLPE CRÍTICO! ×2' : '👊 ¡Golpe!'}</div>}
                {feedback && !feedback.ok && <div className="eh-aparece" style={{ textAlign: 'center', marginTop: 10, fontWeight: 800 }}>🧟 ¡El zombi ha esquivado tu golpe!</div>}
                <div style={{ textAlign: 'center', marginTop: 10, opacity: .7, fontSize: '.85rem' }}>Tus golpes: {stats.current.golpes}</div>
            </>);
        }
        return envoltorio(
            <div className="eh-panel eh-aparece" style={{ padding: 24, textAlign: 'center' }}>
                <Zombi estado={fase === 'VICTORIA' ? 'muerto' : 'victoria'} size={140} />
                <h2 className="eh-titulo" style={{ fontSize: '2.2rem', color: fase === 'VICTORIA' ? '#4ade80' : '#ef4444' }}>
                    {fase === 'VICTORIA' ? '¡Habéis escapado!' : '¡El zombi os ha atrapado!'}
                </h2>
                <p>{fase === 'VICTORIA' ? '¡Feliz Halloween! 🎃' : 'Mirad la pantalla: ¡quizá el profe os dé la revancha!'}</p>
                <p style={{ fontWeight: 800 }}>✔ {stats.current.aciertos} aciertos · 💥 {stats.current.golpes} golpes</p>
            </div>,
            fase === 'VICTORIA' ? <Confeti /> : null
        );
    }

    return envoltorio(
        <div className="eh-panel" style={{ padding: 24, textAlign: 'center' }}>
            <h2>🎃 Partida terminada</h2>
            <p>✔ {stats.current.aciertos} aciertos · 💥 {stats.current.golpes} golpes</p>
            <button className="eh-btn" onClick={onSalir}>Salir</button>
        </div>
    );
}

function PantallaSimple({ titulo, texto, onSalir }) {
    return (
        <div className="eh-root"><Ambiente murcielagos={3} />
            <div className="eh-panel" style={{ maxWidth: 440, margin: '80px auto', padding: 26, textAlign: 'center' }}>
                <h2 style={{ marginTop: 0 }}>{titulo}</h2>
                <p>{texto}</p>
                {onSalir && <button className="eh-btn" onClick={onSalir}>Salir</button>}
            </div>
        </div>
    );
}

// =====================================================================
//  COMPONENTE PRINCIPAL
// =====================================================================
export default function EscapeHalloween({ usuario, onExit, codigoSala = null }) {
    const nombreUsuario = usuario?.displayName && usuario.displayName !== 'Profe Invitado' ? usuario.displayName : '';
    const [pantalla, setPantalla] = useState(codigoSala ? (nombreUsuario ? 'DISFRAZ' : 'UNIRSE') : 'MENU');
    const [nombre, setNombre] = useState(nombreUsuario);
    const [codigoEntrada, setCodigoEntrada] = useState(String(codigoSala || '').toUpperCase());
    const [errorUnir, setErrorUnir] = useState('');
    const [config, setConfig] = useState(configPorDefecto);
    const [configPartida, setConfigPartida] = useState(null);
    const [avatar, setAvatar] = useState(() => leerAvatarGuardado() || avatarAleatorio());
    const [semilla, setSemilla] = useState(0);

    const salirAlMenu = () => { setPantalla('MENU'); setSemilla(s => s + 1); };

    if (pantalla === 'HOST' && configPartida) return <HostEscape key={'h' + semilla} config={configPartida} usuario={usuario} onSalir={salirAlMenu} />;
    if (pantalla === 'CLIENTE') return <ClienteEscape key={'c' + codigoEntrada} codigo={codigoEntrada} nombre={nombre.trim()} avatarInicial={avatar} onSalir={() => (codigoSala ? onExit?.() : salirAlMenu())} />;

    if (pantalla === 'DISFRAZ') {
        return (
            <div className="eh-root"><Ambiente />
                <div style={{ position: 'relative', zIndex: 1, maxWidth: 520, margin: '0 auto', padding: 14 }}>
                    <EditorDisfraz avatar={avatar} nombre={nombre.trim()} onChange={setAvatar} onListo={(a) => { setAvatar(a); setPantalla('CLIENTE'); }} />
                </div>
            </div>
        );
    }

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
                setPantalla('DISFRAZ');
            } catch (e) { setErrorUnir('Error: ' + e.message); }
        };
        return (
            <div className="eh-root"><Ambiente />
                <div className="eh-panel eh-aparece" style={{ maxWidth: 420, margin: '60px auto', padding: 26 }}>
                    <h2 className="eh-titulo" style={{ fontSize: '2.2rem', textAlign: 'center' }}>🎃 Entrar en la mansión</h2>
                    <label style={{ fontWeight: 700, fontSize: '.9rem' }}>Tu nombre</label>
                    <input className="eh-input" style={{ fontSize: '1.1rem', letterSpacing: 0, marginTop: 4 }} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre y apellido" maxLength={30} />
                    <label style={{ fontWeight: 700, fontSize: '.9rem', display: 'block', marginTop: 14 }}>Código de la sala</label>
                    <input className="eh-input" style={{ marginTop: 4, letterSpacing: 6 }} value={codigoEntrada} onChange={e => setCodigoEntrada(e.target.value.toUpperCase())} placeholder="ABC12" maxLength={8}
                        onKeyDown={e => { if (e.key === 'Enter') entrar(); }} />
                    {errorUnir && <div style={{ color: '#fca5a5', fontSize: '.9rem', marginTop: 8 }}>⚠ {errorUnir}</div>}
                    <button className="eh-btn" style={{ width: '100%', marginTop: 16 }} onClick={entrar}>🎭 Siguiente: elegir disfraz</button>
                    <button className="eh-btn2" style={{ width: '100%', marginTop: 10 }} onClick={() => (codigoSala ? onExit?.() : setPantalla('MENU'))}>Cancelar</button>
                </div>
            </div>
        );
    }

    if (pantalla === 'CONFIG') {
        return (
            <div className="eh-root"><Ambiente />
                <EditorEscape config={config} setConfig={setConfig} usuario={usuario} onAtras={() => setPantalla('MENU')}
                    onCrear={(c) => { setConfigPartida(c); setSemilla(s => s + 1); setPantalla('HOST'); }} />
            </div>
        );
    }

    // ── MENÚ ──
    return (
        <div className="eh-root"><Ambiente murcielagos={7} />
            <div style={{ position: 'relative', zIndex: 1, maxWidth: 760, margin: '0 auto', padding: '30px 16px', textAlign: 'center' }}>
                {onExit && <div style={{ textAlign: 'left' }}><button className="eh-btn2" onClick={onExit}>← Volver</button></div>}
                <div className="eh-flota" style={{ fontSize: '4.5rem', marginTop: 10 }}>🎃🏚️🧟</div>
                <h1 className="eh-titulo" style={{ fontSize: 'clamp(2.4rem,7vw,4.2rem)' }}>La mansión del zombi</h1>
                <p style={{ fontSize: '1.15rem', lineHeight: 1.55, opacity: .9 }}>
                    Escape room de Halloween para <b>toda la clase</b>. Montad las pruebas que queráis (de Matemáticas, Geografía, Biología, Historia, Lengua, Inglés… o con
                    vuestro propio texto y un código escondido en el aula), entrad disfrazados en la mansión 3D y derrotad juntos al <b>zombi</b> en la batalla final.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16, marginTop: 24 }}>
                    <div className="eh-panel" style={{ padding: 22 }}>
                        <div style={{ fontSize: '2.6rem' }}>📽️</div>
                        <h3 style={{ margin: '6px 0' }}>Soy el profe</h3>
                        <p style={{ opacity: .8, fontSize: '.95rem' }}>Prepara (o abre uno guardado) y proyéctalo en la pizarra digital.</p>
                        <button className="eh-btn" style={{ width: '100%' }} onClick={() => setPantalla('CONFIG')}>🕯️ Crear escape room</button>
                    </div>
                    <div className="eh-panel" style={{ padding: 22 }}>
                        <div style={{ fontSize: '2.6rem' }}>📱</div>
                        <h3 style={{ margin: '6px 0' }}>Soy alumno</h3>
                        <p style={{ opacity: .8, fontSize: '.95rem' }}>Entra con el código o el QR de la pantalla y elige tu disfraz.</p>
                        <button className="eh-btn" style={{ width: '100%' }} onClick={() => setPantalla('UNIRSE')}>🚪 Unirme</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
