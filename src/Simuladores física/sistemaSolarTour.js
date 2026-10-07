// Tour guiado del Sistema Solar — pikt.es
// Lógica sin React compartida por SimuladorSistemaSolar (Física), el visor de
// la landing (SolarSystemViewer) y el editor del profesor (EditorSolarSystem):
//   · textos por defecto de cada parada y texto automático de la comparativa
//   · voces grabadas con Edge TTS y alojadas en Cloudinary (api/listening-tts,
//     destino 'tour'), con firma para saber si el audio sigue valiendo
//   · Narrador (audio grabado o, si no hay, voz del navegador) y Musica
//     (YouTube oculto o mp3 directo), con "ducking" mientras se narra
import { db, auth } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export const VOZ_TOUR = 'es-ES-AlvaroNeural';
export const RATE_TOUR = '-5%';
export const MUSICA_TOUR_DEFAULT = 'https://www.youtube.com/watch?v=7GlsxNI4LVI';
export const ADMIN_EMAIL = 'goladen@gmail.com';
// Voces del tour por defecto: las graba el admin una vez (lectura pública)
const DOC_VOCES_DEFAULT = ['voces_tour', 'sistema_solar'];

export const TOUR_PLANETAS = [
    { id: 'Sol',      emoji: '☀️', texto: 'El Sol es la estrella central de nuestro sistema solar. Con 1,4 millones de kilómetros de diámetro, en su interior cabrían más de un millón de Tierras. Su temperatura superficial alcanza los 5.500 grados Celsius, y su núcleo supera los 15 millones de grados.' },
    { id: 'Mercurio', emoji: '🪨', texto: 'Mercurio es el planeta más pequeño y el más cercano al Sol. Carece de atmósfera, lo que provoca temperaturas extremas: 430 grados de día y 180 bajo cero de noche. Un año en Mercurio dura solo 88 días terrestres.' },
    { id: 'Venus',    emoji: '🌫️', texto: 'Venus es el planeta más caliente del sistema solar, con 465 grados Celsius. Su densa atmósfera de dióxido de carbono genera un efecto invernadero extremo. Un día en Venus dura más que su propio año, y gira en sentido contrario al resto.' },
    { id: 'Tierra',   emoji: '🌍', texto: 'La Tierra es nuestro hogar y el único planeta conocido con vida. Su atmósfera protectora y el agua líquida la hacen única en el sistema solar. Con 12.742 kilómetros de diámetro, orbita el Sol a 150 millones de kilómetros.' },
    { id: 'Luna',     emoji: '🌙', texto: 'La Luna es el único satélite natural de la Tierra. Su gravedad genera las mareas oceánicas. Está a 384.400 kilómetros y tarda 27 días en completar su órbita. Es el único lugar fuera de la Tierra que ha pisado el ser humano.' },
    { id: 'Marte',    emoji: '🔴', texto: 'Marte, el planeta rojo, debe su color al óxido de hierro de su suelo. Alberga el volcán más alto del sistema solar, el Monte Olimpo, de 22 kilómetros de altura. Su día dura 24 horas y 37 minutos, casi como el nuestro.' },
    { id: 'Jupiter',  emoji: '🪐', texto: 'Júpiter es el planeta más grande del sistema solar. Su masa equivale a dos veces y media la de todos los demás planetas juntos. La Gran Mancha Roja es una tormenta colosal activa desde hace más de 350 años. Tiene 95 lunas conocidas, entre ellas Ganímedes, la mayor del sistema solar.' },
    { id: 'Saturno',  emoji: '💫', texto: 'Saturno es famoso por su espectacular sistema de anillos de hielo y roca. Es el planeta menos denso del sistema solar: tan ligero que flotaría en el agua. Tiene más de 140 lunas conocidas y su día dura solo 10 horas y media.' },
    { id: 'Urano',    emoji: '🔵', texto: 'Urano es el planeta más frío del sistema solar, con 224 grados bajo cero. Su rasgo más peculiar es que gira de lado, con una inclinación de 98 grados, probablemente por una colisión gigante en el pasado.' },
    { id: 'Neptuno',  emoji: '🌀', texto: 'Neptuno es el planeta más alejado del Sol, a 4.500 millones de kilómetros. Sus vientos son los más rápidos del sistema solar, de más de 2.100 kilómetros por hora. Un año en Neptuno dura 165 años terrestres.' },
];
export const NOMBRE_PARADA = { Jupiter: 'Júpiter' };
export const nombreParada = (id) => NOMBRE_PARADA[id] || id;

const RADIOS_KM = { Sol: 696340, Mercurio: 2439.7, Venus: 6051.8, Tierra: 6371, Luna: 1737.4, Marte: 3389.5, Jupiter: 69911, Saturno: 58232, Urano: 25362, Neptuno: 24622 };
const CON_ARTICULO = { Sol: 'el Sol', Tierra: 'la Tierra', Luna: 'la Luna' };
const conArt = (id) => CON_ARTICULO[id] || nombreParada(id);
const num = (x, d) => x.toLocaleString('es-ES', { maximumFractionDigits: d, minimumFractionDigits: 0 });
const mayus = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Igual que EscenaComparativa.cs de Unity: referencia la Tierra (o el menor)
export function textoComparativa(ids) {
    const lista = ids.filter(id => RADIOS_KM[id]);
    if (lista.length < 2) return '';
    let ref = lista.includes('Tierra') ? 'Tierra' : lista.reduce((a, b) => RADIOS_KM[a] <= RADIOS_KM[b] ? a : b);
    const rRef = RADIOS_KM[ref];
    const otros = lista.filter(id => id !== ref).sort((a, b) => RADIOS_KM[a] - RADIOS_KM[b]);
    let t = 'Observa la diferencia de tamaño entre estos mundos. ';
    for (const id of otros) {
        const ratio = RADIOS_KM[id] / rRef;
        if (ratio >= 10) t += `${mayus(conArt(id))}, con ${num(RADIOS_KM[id], 0)} kilómetros de radio, es ${num(ratio, 0)} veces mayor que ${conArt(ref)}. `;
        else if (ratio >= 1.2) t += `${mayus(conArt(id))} es ${num(ratio, 1)} veces mayor que ${conArt(ref)}. `;
        else if (ratio >= 0.9 && ratio <= 1.1) t += `${mayus(conArt(id))} y ${conArt(ref)} tienen un tamaño muy similar. `;
        else if (ratio < 0.9) t += `${mayus(conArt(id))} es ${num(1 / ratio, 1)} veces más pequeño que ${conArt(ref)}. `;
    }
    return t + 'Esta diferencia de escala es uno de los rasgos más asombrosos del sistema solar.';
}

export const configTourDefault = () => ({
    planetas: TOUR_PLANETAS.map(p => ({ nombre: p.id, texto: p.texto, activo: true })),
    musicaUrl: MUSICA_TOUR_DEFAULT,
    duracionEscena: 8,
    comparativa: { activa: true, texto: '', duracion: 14 },
});

// Normaliza una config (de Firestore, de un enlace o de Unity) → paradas
export function paradasDeConfig(cfg) {
    const c = cfg || configTourDefault();
    const paradas = (c.planetas || [])
        .filter(p => p && p.activo !== false && RADIOS_KM[p.nombre])
        .map(p => ({ id: p.nombre, clave: p.nombre, texto: (p.texto ?? TOUR_PLANETAS.find(x => x.id === p.nombre)?.texto ?? '').trim() }));
    const comp = c.comparativa || {};
    const compActiva = comp.activa !== false && paradas.length >= 2;
    return {
        paradas,
        duracion: Math.max(4, +c.duracionEscena || 8),
        musicaUrl: c.musicaUrl ?? MUSICA_TOUR_DEFAULT,
        comparativa: compActiva ? { clave: '_comparativa', duracion: Math.max(6, +comp.duracion || 14), texto: (comp.texto || '').trim() || textoComparativa(paradas.map(p => p.id)) } : null,
        audios: c.audios || null,
    };
}

// Firma del audio: si cambia el texto o la voz, el mp3 ya no vale
export function firmaVoz(texto) {
    const s = [String(texto || '').trim(), VOZ_TOUR, RATE_TOUR].join('|');
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(36);
}
export const audioValido = (audios, clave, texto) => {
    const a = audios?.[clave];
    return a?.url && a.firma === firmaVoz(texto) ? a.url : null;
};

// Lista de { clave, texto } que hay que locutar en un tour
export function textosALocutar(tour) {
    const l = tour.paradas.filter(p => p.texto).map(p => ({ clave: p.clave, texto: p.texto }));
    if (tour.comparativa?.texto) l.push({ clave: tour.comparativa.clave, texto: tour.comparativa.texto });
    return l;
}

// Graba en Cloudinary los audios que falten o estén desfasados.
// Devuelve el nuevo mapa de audios { clave: { url, publicId, firma } }.
export async function grabarVocesTour(tour, audiosPrevios = {}, onProgreso = () => {}) {
    const user = auth.currentUser;
    if (!user) throw new Error('Inicia sesión para grabar las voces.');
    const token = await user.getIdToken();
    const audios = { ...(audiosPrevios || {}) };
    const pendientes = textosALocutar(tour).filter(x => !audioValido(audios, x.clave, x.texto));
    let hechos = 0;
    for (const x of pendientes) {
        onProgreso(hechos, pendientes.length, x.clave);
        const r = await fetch('/api/listening-tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ texto: x.texto, voz: VOZ_TOUR, rate: RATE_TOUR, destino: 'tour', anterior: audios[x.clave]?.publicId || null }),
        });
        const res = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(res.error || `Error ${r.status}`);
        audios[x.clave] = { url: res.url, publicId: res.publicId, firma: firmaVoz(x.texto) };
        hechos++;
    }
    onProgreso(hechos, pendientes.length, null);
    return audios;
}

export async function cargarVocesDefault() {
    try {
        const s = await getDoc(doc(db, ...DOC_VOCES_DEFAULT));
        return s.exists() ? (s.data().audios || {}) : {};
    } catch { return {}; }
}
export async function guardarVocesDefault(audios) {
    await setDoc(doc(db, ...DOC_VOCES_DEFAULT), { audios, actualizado: Date.now() });
}

// ─────────────────────────────────────────────────────────── NARRADOR
// Reproduce el mp3 grabado; si no hay, usa la mejor voz española del navegador.
export class Narrador {
    constructor() { this.audio = null; this.utt = null; this.activo = true; this._fin = null; }
    _mejorVoz() {
        const voces = window.speechSynthesis?.getVoices() || [];
        const es = voces.filter(v => /^es/i.test(v.lang));
        return es.find(v => /natural|online|neural/i.test(v.name) && /es-ES/i.test(v.lang))
            || es.find(v => /google/i.test(v.name) && /es-ES/i.test(v.lang))
            || es.find(v => /es-ES/i.test(v.lang)) || es[0] || null;
    }
    // Devuelve una promesa que se resuelve al terminar (o al detener)
    decir(texto, url) {
        this.detener();
        if (!this.activo || !texto) return Promise.resolve();
        return new Promise((resolve) => {
            this._fin = resolve;
            const acabar = () => { if (this._fin === resolve) { this._fin = null; resolve(); } };
            if (url) {
                const a = new Audio(url);
                a.volume = 1;
                a.onended = acabar; a.onerror = () => { this.audio = null; this._tts(texto, acabar); };
                this.audio = a;
                a.play().catch(() => { this.audio = null; this._tts(texto, acabar); });
            } else this._tts(texto, acabar);
        });
    }
    _tts(texto, acabar) {
        if (!('speechSynthesis' in window)) { setTimeout(acabar, Math.min(20000, texto.length * 65)); return; }
        const u = new SpeechSynthesisUtterance(texto);
        u.lang = 'es-ES'; u.rate = 0.95;
        const v = this._mejorVoz(); if (v) u.voice = v;
        u.onend = acabar; u.onerror = acabar;
        this.utt = u;
        window.speechSynthesis.speak(u);
    }
    pausar() { if (this.audio) this.audio.pause(); else if (this.utt) window.speechSynthesis.pause(); }
    reanudar() { if (this.audio) this.audio.play().catch(() => {}); else if (this.utt) window.speechSynthesis.resume(); }
    detener() {
        if (this.audio) { this.audio.onended = null; this.audio.onerror = null; this.audio.pause(); this.audio = null; }
        if (this.utt) { this.utt.onend = null; this.utt.onerror = null; this.utt = null; try { window.speechSynthesis.cancel(); } catch { /* */ } }
        if (this._fin) { const f = this._fin; this._fin = null; f(); }
    }
}

// ─────────────────────────────────────────────────────────── MÚSICA
const ytId = (url) => (String(url || '').match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/) || [])[1] || null;
let ytApi = null;
const cargarYT = () => ytApi || (ytApi = new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev && prev(); resolve(window.YT); };
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s);
}));

export class Musica {
    constructor() { this.vol = 35; this.duck = false; this.yt = null; this.audio = null; this.div = null; this.parado = true; }
    _volEf() { return this.duck ? Math.round(this.vol * 0.4) : this.vol; }
    async reproducir(url) {
        this.detener(); this.parado = false;
        if (!url) return;
        const id = ytId(url);
        if (id) {
            const YT = await cargarYT();
            if (this.parado) return;
            this.div = document.createElement('div');
            this.div.style.cssText = 'position:fixed;width:1px;height:1px;left:-10px;bottom:0;opacity:0;pointer-events:none;';
            const hueco = document.createElement('div'); this.div.appendChild(hueco); document.body.appendChild(this.div);
            this.yt = new YT.Player(hueco, {
                height: '1', width: '1', videoId: id,
                playerVars: { autoplay: 1, loop: 1, playlist: id, controls: 0, disablekb: 1, playsinline: 1 },
                events: { onReady: (e) => { if (this.parado) return; e.target.setVolume(this._volEf()); e.target.playVideo(); } },
            });
        } else {
            this.audio = new Audio(url); this.audio.loop = true; this.audio.volume = this._volEf() / 100;
            this.audio.play().catch(() => {});
        }
    }
    _aplicar() {
        try { this.yt?.setVolume?.(this._volEf()); } catch { /* aún cargando */ }
        if (this.audio) this.audio.volume = this._volEf() / 100;
    }
    setDuck(d) { this.duck = d; this._aplicar(); }
    pausar() { try { this.yt?.pauseVideo?.(); } catch { /* */ } this.audio?.pause(); }
    reanudar() { if (this.parado) return; try { this.yt?.playVideo?.(); } catch { /* */ } this.audio?.play().catch(() => {}); }
    detener() {
        this.parado = true;
        try { this.yt?.destroy?.(); } catch { /* */ }
        this.yt = null;
        if (this.div) { this.div.remove(); this.div = null; }
        if (this.audio) { this.audio.pause(); this.audio = null; }
    }
}
