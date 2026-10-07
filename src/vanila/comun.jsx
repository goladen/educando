// Piezas comunes de VaniLa (modos solo, duelo y tablero): tema, sonidos, textos en
// es/ca/en/fr, partículas de letras, fichas, reloj, botones y envío al profesor.
import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';
import { sonidoActivo, setSonidoActivo } from '../utils/sonidosFeedback';
import { IDIOMAS_PALABRAS, cargarDiccionario, esVocalLetra } from '../utils/diccionarios';

// ─── Tema ────────────────────────────────────────────────────────────────────
export const T = {
    bg: '#0A0918',
    panel: 'rgba(24, 22, 48, 0.72)',
    borde: 'rgba(255,255,255,0.10)',
    cian: '#22D3EE',
    rosa: '#F472B6',
    lila: '#A78BFA',
    verde: '#34D399',
    ambar: '#FBBF24',
    rojo: '#F87171',
    naranja: '#FB923C',
    texto: '#F8FAFC',
    suave: '#94A3B8',
};
export const FUENTE = '"Inter", "Montserrat", system-ui, sans-serif';
export const COLORES_JUGADOR = [T.cian, T.rosa, T.ambar, T.verde, T.lila, T.naranja];

export const movimientoReducido = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export const useWindowSize = () => {
    const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
    useEffect(() => {
        const r = () => setSize({ w: window.innerWidth, h: window.innerHeight });
        window.addEventListener('resize', r);
        return () => window.removeEventListener('resize', r);
    }, []);
    return size;
};

// ─── Textos ──────────────────────────────────────────────────────────────────
const TEXTOS = {
    es: {
        sub: 'Forma todas las palabras que puedas con las 9 letras antes de que acabe el tiempo.',
        ojoTildes: '¡Ojo con las tildes!', tocaVocal: 'Toca una letra de tu palabra para ponerle la tilde.',
        solo: 'Solo', soloDesc: 'Contra el reloj. Rondas, sorteo automático o eligiendo vocal / consonante.',
        duelo: 'Duelo', dueloDesc: 'Dos jugadores, mismas letras. Cada punto os sube por la montaña: ¡el primero en la cumbre gana!',
        tablero: 'Tablero', tableroDesc: 'Tipo Scrabble, de 2 a 6 jugadores: en el mismo dispositivo (pasándolo por turnos) u online, cada uno en el suyo. ¡Cruzad las palabras!',
        partidaSolo: 'Partida individual', partidaDuelo: 'Duelo en la montaña',
        tiempoRonda: 'Tiempo por ronda', rondas: 'Rondas', sorteo: 'Sorteo de letras', auto: '🎲 Automático', manual: '🗣️ Vocal / consonante',
        jugador: 'Jugador', meta: 'Puntos para llegar a la cumbre', cambio: 'Cambio de letras cada',
        puntuacion: 'Puntos: 1 por letra · +2 si lleva tilde · ×2 si usas las 9 letras', puntuacionSinTilde: 'Puntos: 1 por letra · ×2 si usas las 9 letras',
        jugar: '▶ JUGAR', cargando: 'Cargando diccionario…', reintentar: 'Reintentar', atras: '← Atrás', salir: '← Salir', menu: '← Menú', menuSolo: 'Menú',
        ronda: 'RONDA', palabras: 'PALABRAS', tiempo: '¡Tiempo!', resumen: (n, p) => `${n} palabra${n === 1 ? '' : 's'} · ${p} puntos en esta ronda`,
        masLargaPosible: (w, n) => `LA MÁS LARGA POSIBLE: ${w} (${n} letras)`, habia: n => `Había al menos ${n} palabras comunes posibles`,
        repasar: '✍️ Tildes a repasar', siguiente: n => `Ronda ${n} ▶`, verResultado: 'Ver resultado ▶',
        puntos: 'PUNTOS', palabrasL: 'Palabras', acierto: 'Acierto', masLarga: 'Más larga', fallosTilde: 'Fallos de tilde', enviarProfe: '📤 Enviar al profesor',
        vocal: 'VOCAL', consonante: 'CONSONANTE', pideMas: n => `PIDE ${n} LETRA${n === 1 ? '' : 'S'} MÁS`,
        corona: n => `¡${n} corona la cumbre!`, revancha: '🔁 Revancha', nuevasLetras: '🔄 ¡Nuevas letras!', duelo2: 'DUELO · LETRAS', cambioL: 'cambio', seg: 'seg',
        teclado: "⌨️ Teclado: escribe las letras (á, é… o ' tras la letra) · Enter enviar · ⌫ borrar · Espacio mezclar",
        sinPalabras: 'Aún no hay palabras', enviar: '✔ Enviar', tilde: '´ Tilde', idioma: 'Idioma de juego',
        probarWordle: '¿Y un Wordle?', wordleDesc: 'Adivina la palabra secreta en 6 intentos, con el mismo diccionario.',
        pocoComun: 'poco común', masPalabras: 'palabras', fallos: 'fallos de tilde',
        m: { corta: 'Mínimo 3 letras', repetida: 'Esa ya la tienes', noexiste: 'No está en el diccionario', faltatilde: '¡Le falta la tilde! Toca la letra para ponérsela', tildemal: 'La tilde no va ahí' },
        modal: { titulo: '📤 Enviar al profesor', nombre: 'Nombre y apellido', nombreP: 'Tu nombre completo', curso: 'Curso', cursoP: 'Ej: 2º ESO B', codigo: 'Código del profesor', cancelar: 'Cancelar', enviar: '📤 Enviar', enviando: 'Enviando…', enviado: '¡Informe enviado!', cerrar: 'Cerrar', errNombre: 'Escribe tu nombre.', errCodigo: 'Escribe el código del profesor.', noCodigo: 'Código no encontrado.' },
    },
    ca: {
        sub: 'Forma totes les paraules que puguis amb les 9 lletres abans que s\'acabi el temps.',
        ojoTildes: 'Compte amb els accents!', tocaVocal: 'Toca una lletra de la paraula per accentuar-la (també ç i l·l).',
        solo: 'Sol', soloDesc: 'Contra rellotge. Rondes, sorteig automàtic o triant vocal / consonant.',
        duelo: 'Duel', dueloDesc: 'Dos jugadors, les mateixes lletres. Cada punt us fa pujar la muntanya: el primer al cim guanya!',
        tablero: 'Tauler', tableroDesc: 'Tipus Scrabble, de 2 a 6 jugadors: al mateix dispositiu (passant-lo per torns) o en línia, cadascú al seu. Creueu les paraules!',
        partidaSolo: 'Partida individual', partidaDuelo: 'Duel a la muntanya',
        tiempoRonda: 'Temps per ronda', rondas: 'Rondes', sorteo: 'Sorteig de lletres', auto: '🎲 Automàtic', manual: '🗣️ Vocal / consonant',
        jugador: 'Jugador', meta: 'Punts per arribar al cim', cambio: 'Canvi de lletres cada',
        puntuacion: 'Punts: 1 per lletra · +2 si porta accent · ×2 si fas servir les 9 lletres', puntuacionSinTilde: 'Punts: 1 per lletra · ×2 si fas servir les 9 lletres',
        jugar: '▶ JUGAR', cargando: 'Carregant el diccionari…', reintentar: 'Torna-ho a provar', atras: '← Enrere', salir: '← Sortir', menu: '← Menú', menuSolo: 'Menú',
        ronda: 'RONDA', palabras: 'PARAULES', tiempo: 'Temps!', resumen: (n, p) => `${n} paraul${n === 1 ? 'a' : 'es'} · ${p} punts en aquesta ronda`,
        masLargaPosible: (w, n) => `LA MÉS LLARGA POSSIBLE: ${w} (${n} lletres)`, habia: n => `N'hi havia almenys ${n} de comunes`,
        repasar: '✍️ Accents per repassar', siguiente: n => `Ronda ${n} ▶`, verResultado: 'Veure el resultat ▶',
        puntos: 'PUNTS', palabrasL: 'Paraules', acierto: 'Encert', masLarga: 'Més llarga', fallosTilde: 'Errors d\'accent', enviarProfe: '📤 Enviar al professor',
        vocal: 'VOCAL', consonante: 'CONSONANT', pideMas: n => `DEMANA ${n} LLETR${n === 1 ? 'A' : 'ES'} MÉS`,
        corona: n => `${n} corona el cim!`, revancha: '🔁 Revenja', nuevasLetras: '🔄 Lletres noves!', duelo2: 'DUEL · LLETRES', cambioL: 'canvi', seg: 'seg',
        teclado: "⌨️ Teclat: escriu les lletres (à, é, ç… o ' després de la lletra) · Enter enviar · ⌫ esborrar · Espai barrejar",
        sinPalabras: 'Encara no hi ha paraules', enviar: '✔ Enviar', tilde: '´ Accent', idioma: 'Idioma de joc',
        probarWordle: 'I un Wordle?', wordleDesc: 'Endevina la paraula secreta en 6 intents, amb el mateix diccionari.',
        pocoComun: 'poc comuna', masPalabras: 'paraules', fallos: 'errors d\'accent',
        m: { corta: 'Mínim 3 lletres', repetida: 'Aquesta ja la tens', noexiste: 'No és al diccionari', faltatilde: 'Hi falta l\'accent (o la ç / l·l)! Toca la lletra', tildemal: 'L\'accent no va aquí' },
        modal: { titulo: '📤 Enviar al professor', nombre: 'Nom i cognom', nombreP: 'El teu nom complet', curso: 'Curs', cursoP: 'Ex: 2n ESO B', codigo: 'Codi del professor', cancelar: 'Cancel·lar', enviar: '📤 Enviar', enviando: 'Enviant…', enviado: 'Informe enviat!', cerrar: 'Tancar', errNombre: 'Escriu el teu nom.', errCodigo: 'Escriu el codi del professor.', noCodigo: 'Codi no trobat.' },
    },
    en: {
        sub: 'Make as many words as you can with the 9 letters before time runs out.',
        ojoTildes: '', tocaVocal: '',
        solo: 'Solo', soloDesc: 'Beat the clock. Several rounds, random letters or choose vowel / consonant.',
        duelo: 'Duel', dueloDesc: 'Two players, same letters. Every point climbs the mountain: first to the summit wins!',
        tablero: 'Board', tableroDesc: 'Scrabble-style, 2 to 6 players: on one device (passing it around) or online, each on their own. Cross your words!',
        partidaSolo: 'Solo game', partidaDuelo: 'Mountain duel',
        tiempoRonda: 'Time per round', rondas: 'Rounds', sorteo: 'Letter draw', auto: '🎲 Random', manual: '🗣️ Vowel / consonant',
        jugador: 'Player', meta: 'Points to reach the summit', cambio: 'New letters every',
        puntuacion: 'Points: 1 per letter · ×2 if you use all 9 letters', puntuacionSinTilde: 'Points: 1 per letter · ×2 if you use all 9 letters',
        jugar: '▶ PLAY', cargando: 'Loading dictionary…', reintentar: 'Retry', atras: '← Back', salir: '← Exit', menu: '← Menu', menuSolo: 'Menu',
        ronda: 'ROUND', palabras: 'WORDS', tiempo: 'Time\'s up!', resumen: (n, p) => `${n} word${n === 1 ? '' : 's'} · ${p} points this round`,
        masLargaPosible: (w, n) => `LONGEST POSSIBLE: ${w} (${n} letters)`, habia: n => `There were at least ${n} common words`,
        repasar: '✍️ To review', siguiente: n => `Round ${n} ▶`, verResultado: 'See result ▶',
        puntos: 'POINTS', palabrasL: 'Words', acierto: 'Accuracy', masLarga: 'Longest', fallosTilde: 'Spelling slips', enviarProfe: '📤 Send to teacher',
        vocal: 'VOWEL', consonante: 'CONSONANT', pideMas: n => `PICK ${n} MORE LETTER${n === 1 ? '' : 'S'}`,
        corona: n => `${n} reaches the summit!`, revancha: '🔁 Rematch', nuevasLetras: '🔄 New letters!', duelo2: 'DUEL · LETTERS', cambioL: 'change', seg: 'sec',
        teclado: '⌨️ Keyboard: type the letters · Enter submit · ⌫ delete · Space shuffle',
        sinPalabras: 'No words yet', enviar: '✔ Submit', tilde: '´', idioma: 'Game language',
        probarWordle: 'Fancy a Wordle?', wordleDesc: 'Guess the secret word in 6 tries, same dictionary.',
        pocoComun: 'rare', masPalabras: 'words', fallos: 'spelling slips',
        m: { corta: 'At least 3 letters', repetida: 'You already have it', noexiste: 'Not in the dictionary', faltatilde: 'Check the spelling', tildemal: 'Check the spelling' },
        modal: { titulo: '📤 Send to teacher', nombre: 'Full name', nombreP: 'Your full name', curso: 'Class', cursoP: 'e.g. Year 8 B', codigo: 'Teacher code', cancelar: 'Cancel', enviar: '📤 Send', enviando: 'Sending…', enviado: 'Report sent!', cerrar: 'Close', errNombre: 'Write your name.', errCodigo: 'Write the teacher code.', noCodigo: 'Code not found.' },
    },
    fr: {
        sub: 'Forme le plus de mots possible avec les 9 lettres avant la fin du temps.',
        ojoTildes: 'Attention aux accents !', tocaVocal: 'Touche une lettre de ton mot pour l\'accentuer (é, è, ê, ç…).',
        solo: 'Solo', soloDesc: 'Contre la montre. Plusieurs manches, tirage auto ou en choisissant voyelle / consonne.',
        duelo: 'Duel', dueloDesc: 'Deux joueurs, les mêmes lettres. Chaque point fait grimper la montagne : le premier au sommet gagne !',
        tablero: 'Plateau', tableroDesc: 'Façon Scrabble, de 2 à 6 joueurs : sur un seul appareil (en le passant) ou en ligne, chacun sur le sien. Croisez vos mots !',
        partidaSolo: 'Partie solo', partidaDuelo: 'Duel en montagne',
        tiempoRonda: 'Temps par manche', rondas: 'Manches', sorteo: 'Tirage des lettres', auto: '🎲 Automatique', manual: '🗣️ Voyelle / consonne',
        jugador: 'Joueur', meta: 'Points pour atteindre le sommet', cambio: 'Nouvelles lettres toutes les',
        puntuacion: 'Points : 1 par lettre · +2 avec accent · ×2 avec les 9 lettres', puntuacionSinTilde: 'Points : 1 par lettre · ×2 avec les 9 lettres',
        jugar: '▶ JOUER', cargando: 'Chargement du dictionnaire…', reintentar: 'Réessayer', atras: '← Retour', salir: '← Quitter', menu: '← Menu', menuSolo: 'Menu',
        ronda: 'MANCHE', palabras: 'MOTS', tiempo: 'Temps écoulé !', resumen: (n, p) => `${n} mot${n === 1 ? '' : 's'} · ${p} points dans cette manche`,
        masLargaPosible: (w, n) => `LE PLUS LONG POSSIBLE : ${w} (${n} lettres)`, habia: n => `Il y avait au moins ${n} mots courants`,
        repasar: '✍️ Accents à revoir', siguiente: n => `Manche ${n} ▶`, verResultado: 'Voir le résultat ▶',
        puntos: 'POINTS', palabrasL: 'Mots', acierto: 'Réussite', masLarga: 'Le plus long', fallosTilde: 'Fautes d\'accent', enviarProfe: '📤 Envoyer au prof',
        vocal: 'VOYELLE', consonante: 'CONSONNE', pideMas: n => `ENCORE ${n} LETTRE${n === 1 ? '' : 'S'}`,
        corona: n => `${n} atteint le sommet !`, revancha: '🔁 Revanche', nuevasLetras: '🔄 Nouvelles lettres !', duelo2: 'DUEL · LETTRES', cambioL: 'change', seg: 's',
        teclado: "⌨️ Clavier : tape les lettres (é, è, ç… ou ' après la lettre) · Entrée valider · ⌫ effacer · Espace mélanger",
        sinPalabras: 'Pas encore de mots', enviar: '✔ Valider', tilde: '´ Accent', idioma: 'Langue du jeu',
        probarWordle: 'Et un Wordle ?', wordleDesc: 'Devine le mot secret en 6 essais, avec le même dictionnaire.',
        pocoComun: 'rare', masPalabras: 'mots', fallos: 'fautes d\'accent',
        m: { corta: '3 lettres minimum', repetida: 'Tu l\'as déjà', noexiste: 'Pas dans le dictionnaire', faltatilde: 'Il manque un accent ! Touche la lettre', tildemal: 'Mauvais accent' },
        modal: { titulo: '📤 Envoyer au prof', nombre: 'Nom et prénom', nombreP: 'Ton nom complet', curso: 'Classe', cursoP: 'Ex : 4e B', codigo: 'Code du professeur', cancelar: 'Annuler', enviar: '📤 Envoyer', enviando: 'Envoi…', enviado: 'Rapport envoyé !', cerrar: 'Fermer', errNombre: 'Écris ton nom.', errCodigo: 'Écris le code du professeur.', noCodigo: 'Code introuvable.' },
    },
};
export const textos = (idioma) => TEXTOS[idioma] || TEXTOS.es;

// Variantes (tildes, ç, l·l) de cada letra según el idioma.
export const variantesDe = (idioma) => IDIOMAS_PALABRAS[idioma]?.variantes || {};
export const conVariante = (idioma, ch, ac) => {
    const v = variantesDe(idioma)[ch];
    return v ? v[ac % v.length] : ch;
};

// ─── Sonidos propios (los de acierto/fallo/final vienen de sonidosFeedback) ──
export const blip = (freq, { dur = 0.08, tipo = 'triangle', vol = 0.07, delay = 0, freqFin = null } = {}) => {
    if (!sonidoActivo()) return;
    try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        if (!window.gameAudioCtx) window.gameAudioCtx = new AC();
        const a = window.gameAudioCtx;
        if (a.state === 'suspended') a.resume();
        const t = a.currentTime + delay;
        const o = a.createOscillator(), g = a.createGain();
        o.type = tipo;
        o.frequency.setValueAtTime(freq, t);
        if (freqFin) o.frequency.exponentialRampToValueAtTime(freqFin, t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(a.destination);
        o.start(t); o.stop(t + dur + 0.02);
    } catch { /* sin audio */ }
};
export const sonidoFicha = (i) => blip(520 + i * 45, { dur: 0.07, tipo: 'square', vol: 0.035 });
export const sonidoRevelar = (n, paso) => { for (let i = 0; i < n; i++) blip(380 + i * 55, { dur: 0.09, vol: 0.06, delay: i * paso }); };
export const sonidoTic = (urgente) => blip(urgente ? 1100 : 800, { dur: 0.05, tipo: 'sine', vol: urgente ? 0.08 : 0.04 });
export const sonidoCambio = () => { blip(300, { dur: 0.35, tipo: 'sawtooth', vol: 0.04, freqFin: 1200 }); blip(900, { dur: 0.2, vol: 0.05, delay: 0.3 }); };
export const sonidoPalabra = (n) => { for (let i = 0; i < Math.min(n, 9); i++) blip(660 * Math.pow(1.122, i), { dur: 0.09, vol: 0.05, delay: i * 0.045 }); };
export const sonidoTurno = () => { blip(523, { dur: 0.12, vol: 0.07 }); blip(784, { dur: 0.18, vol: 0.07, delay: 0.12 }); };

// ─── Partículas de letras ────────────────────────────────────────────────────
const emisorLetras = new Set();
export const lanzarLetras = (x, y, texto, color) => emisorLetras.forEach(fn => fn(x, y, texto, color));
export const lanzarDesde = (el, texto, color) => {
    if (!el) return lanzarLetras(window.innerWidth / 2, window.innerHeight / 2, texto, color);
    const r = el.getBoundingClientRect();
    lanzarLetras(r.left + r.width / 2, r.top + r.height / 2, texto, color);
};

export const CapaLetras = () => {
    const [items, setItems] = useState([]);
    useEffect(() => {
        let id = 0;
        const timers = new Set();
        const onEmit = (x, y, texto, color) => {
            const letras = [...texto.toUpperCase().replace(/·/g, '')];
            const lista = movimientoReducido() ? letras.slice(0, 2) : [...letras, ...letras.slice(0, 4)];
            const H = window.innerHeight;
            const nuevos = lista.map((l, i) => ({
                id: ++id, l, x: x + (Math.random() - 0.5) * 120, y: y + (Math.random() - 0.5) * 30,
                dx: (Math.random() - 0.5) * 220, dy: -(H * 0.25 + Math.random() * H * 0.3),
                rot: (Math.random() - 0.5) * 80, size: 22 + Math.random() * 30,
                dur: 1.4 + Math.random() * 1.1, delay: i * 0.04,
                color: color || [T.cian, T.rosa, T.ambar, T.verde, T.lila][i % 5],
            }));
            const ids = new Set(nuevos.map(p => p.id));
            setItems(prev => [...prev, ...nuevos].slice(-80));
            const vida = Math.max(...nuevos.map(p => p.dur + p.delay)) * 1000 + 100;
            const t = setTimeout(() => { timers.delete(t); setItems(prev => prev.filter(p => !ids.has(p.id))); }, vida);
            timers.add(t);
        };
        emisorLetras.add(onEmit);
        return () => { emisorLetras.delete(onEmit); timers.forEach(clearTimeout); };
    }, []);
    return (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 10001, overflow: 'hidden' }}>
            {items.map(p => (
                <div key={p.id} style={{
                    position: 'absolute', left: p.x, top: p.y, opacity: 0,
                    '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--rot': `${p.rot}deg`,
                    animation: `nlSube ${p.dur}s cubic-bezier(0.22,0.61,0.36,1) ${p.delay}s forwards`,
                    fontSize: p.size, fontWeight: 900, lineHeight: 1, color: p.color,
                    textShadow: `0 0 14px ${p.color}, 0 0 2px #fff`, marginLeft: -p.size * 0.3, marginTop: -p.size * 0.5,
                }}>{p.l}</div>
            ))}
        </div>
    );
};

export const ESTILOS_CSS = `
@keyframes nlSube { 0% { transform: translate(0,0) scale(.3) rotate(0); opacity: 0 } 12% { transform: translate(calc(var(--dx)*.1), calc(var(--dy)*.08)) scale(1.2) rotate(calc(var(--rot)*.2)); opacity: 1 } 70% { opacity: .9 } 100% { transform: translate(var(--dx), var(--dy)) scale(.8) rotate(var(--rot)); opacity: 0 } }
@keyframes nlEntra { 0% { transform: translateY(-70vh) rotateX(160deg) scale(.6); opacity: 0 } 60% { transform: translateY(10px) rotateX(-12deg) scale(1.06); opacity: 1 } 80% { transform: translateY(-4px) rotateX(4deg) } 100% { transform: none; opacity: 1 } }
@keyframes nlPop { 0% { transform: scale(.3); opacity: 0 } 60% { transform: scale(1.18); opacity: 1 } 100% { transform: scale(1) } }
@keyframes nlShake { 0%,100% { transform: translateX(0) } 20% { transform: translateX(-10px) } 40% { transform: translateX(9px) } 60% { transform: translateX(-6px) } 80% { transform: translateX(4px) } }
@keyframes nlBrilla { 0% { box-shadow: 0 0 0 rgba(52,211,153,0) } 40% { box-shadow: 0 0 32px rgba(52,211,153,.85) } 100% { box-shadow: 0 0 0 rgba(52,211,153,0) } }
@keyframes nlFlota { 0%,100% { transform: translateY(0) rotate(var(--r,0deg)) } 50% { transform: translateY(-9px) rotate(calc(var(--r,0deg) * -1)) } }
@keyframes nlLatido { 0%,100% { transform: scale(1) } 50% { transform: scale(1.08) } }
@keyframes nlNube { from { transform: translateX(-60px) } to { transform: translateX(360px) } }
@keyframes nlBandera { 0%,100% { transform: skewY(0deg) scaleX(1) } 50% { transform: skewY(-8deg) scaleX(.85) } }
@keyframes nlPiernaA { 0%,100% { transform: rotate(-28deg) } 50% { transform: rotate(28deg) } }
@keyframes nlPiernaB { 0%,100% { transform: rotate(28deg) } 50% { transform: rotate(-28deg) } }
@keyframes nlBanner { 0% { transform: translate(-50%,-50%) scale(.4); opacity: 0 } 20% { transform: translate(-50%,-50%) scale(1.1); opacity: 1 } 80% { transform: translate(-50%,-50%) scale(1); opacity: 1 } 100% { transform: translate(-50%,-50%) scale(1.3); opacity: 0 } }
@keyframes nlCae { 0% { transform: translateY(-40px) scale(1.4); opacity: 0 } 70% { transform: translateY(3px) scale(.95); opacity: 1 } 100% { transform: none; opacity: 1 } }
@keyframes nlParpadeo { 0%,100% { opacity: 1 } 50% { opacity: .45 } }
.nl-btn { transition: transform .12s, filter .12s, box-shadow .2s; }
.nl-btn:hover:not(:disabled) { filter: brightness(1.15); transform: translateY(-2px); }
.nl-btn:active:not(:disabled) { transform: translateY(1px) scale(.97); }
.nl-ficha { transition: transform .15s, opacity .2s, filter .2s; }
.nl-ficha:hover:not(:disabled) { transform: translateY(-4px) scale(1.04); }
@media (prefers-reduced-motion: reduce) { .nl-anim { animation: none !important; } }
`;

// ─── Piezas de interfaz ──────────────────────────────────────────────────────
export const Boton = ({ children, onClick, color = T.cian, relleno = false, disabled, grande, style, title }) => (
    <button className="nl-btn" onClick={onClick} disabled={disabled} title={title} style={{
        padding: grande ? '14px 28px' : '10px 18px', borderRadius: 14, fontFamily: FUENTE,
        fontWeight: 800, fontSize: grande ? '1.05rem' : '0.92rem', letterSpacing: 0.5,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1,
        border: `2px solid ${color}`, color: relleno ? '#0A0918' : color,
        background: relleno ? color : 'rgba(255,255,255,0.04)',
        boxShadow: relleno ? `0 0 22px ${color}66` : 'none', ...style,
    }}>{children}</button>
);

export const Opciones = ({ valor, opciones, onChange, color = T.cian }) => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        {opciones.map(([v, etiqueta]) => (
            <button key={v} className="nl-btn" onClick={() => onChange(v)} style={{
                padding: '9px 16px', borderRadius: 12, fontFamily: FUENTE, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
                border: `2px solid ${valor === v ? color : T.borde}`, color: valor === v ? '#0A0918' : T.texto,
                background: valor === v ? color : 'rgba(255,255,255,0.04)',
            }}>{etiqueta}</button>
        ))}
    </div>
);

// Ficha de letra. `retraso` controla la animación de entrada (en segundos). `valor` = puntos (tablero).
export const Ficha = ({ ch, idioma = 'es', tam, usada, onClick, retraso = 0, animar = true, disabled, valor, seleccionada, texto }) => {
    const vocal = esVocalLetra(ch, idioma);
    const c = vocal ? T.cian : T.lila;
    return (
        <button className="nl-ficha nl-anim" onClick={onClick} disabled={disabled || usada} style={{
            width: tam, height: tam * 1.12, borderRadius: Math.max(8, tam * 0.2), fontFamily: FUENTE,
            fontSize: tam * 0.55, fontWeight: 900, color: usada ? 'rgba(255,255,255,0.18)' : '#fff',
            border: `2px solid ${seleccionada ? T.ambar : usada ? 'rgba(255,255,255,0.08)' : c}`,
            background: usada ? 'rgba(255,255,255,0.03)' : `linear-gradient(160deg, ${c}40 0%, rgba(20,18,45,0.95) 70%)`,
            boxShadow: usada ? 'none' : seleccionada ? `0 0 0 3px ${T.ambar}, 0 0 22px ${T.ambar}` : `0 6px 0 ${c}55, 0 0 18px ${c}44, inset 0 1px 0 rgba(255,255,255,0.25)`,
            textShadow: usada ? 'none' : `0 0 10px ${c}`, cursor: usada || disabled ? 'default' : 'pointer',
            transform: usada ? 'scale(0.9)' : seleccionada ? 'translateY(-6px)' : undefined, padding: 0, position: 'relative',
            animation: animar ? `nlEntra .7s cubic-bezier(.2,.8,.3,1.2) ${retraso}s both` : undefined,
        }}>
            {(texto || ch).toUpperCase()}
            <span style={{ position: 'absolute', bottom: tam * 0.06, right: tam * 0.1, fontSize: tam * 0.17, fontWeight: 700, opacity: usada ? 0 : 0.6 }}>
                {valor != null ? valor : (vocal ? 'V' : 'C')}
            </span>
        </button>
    );
};

// Anillo de cuenta atrás.
export const Reloj = ({ restante, total, tam = 92, etiqueta }) => {
    const frac = total > 0 ? Math.max(0, Math.min(1, restante / total)) : 0;
    const seg = Math.ceil(restante);
    const color = seg <= 5 ? T.rojo : seg <= 10 ? T.ambar : T.verde;
    const r = tam / 2 - 7, C = 2 * Math.PI * r;
    return (
        <div className="nl-anim" style={{ position: 'relative', width: tam, height: tam, animation: seg <= 5 && seg > 0 ? 'nlLatido .5s ease-in-out infinite' : undefined }}>
            <svg width={tam} height={tam} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={tam / 2} cy={tam / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={7} />
                <circle cx={tam / 2} cy={tam / 2} r={r} fill="none" stroke={color} strokeWidth={7} strokeLinecap="round"
                    strokeDasharray={C} strokeDashoffset={C * (1 - frac)} style={{ transition: 'stroke-dashoffset .25s linear, stroke .3s', filter: `drop-shadow(0 0 6px ${color})` }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                <span style={{ fontSize: tam * 0.32, fontWeight: 900, color }}>{seg}</span>
                {etiqueta && <span style={{ fontSize: Math.max(9, tam * 0.11), color: T.suave, fontWeight: 700, marginTop: 2 }}>{etiqueta}</span>}
            </div>
        </div>
    );
};

export const BotonSonido = () => {
    const [on, setOn] = useState(() => sonidoActivo());
    return (
        <button className="nl-btn" title={on ? 'Silenciar' : 'Activar sonido'} onClick={() => setOn(setSonidoActivo(!on))} style={{
            width: 42, height: 42, borderRadius: 12, border: `1px solid ${T.borde}`, background: 'rgba(255,255,255,0.05)',
            color: T.texto, fontSize: '1.15rem', cursor: 'pointer', flexShrink: 0,
        }}>{on ? '🔊' : '🔇'}</button>
    );
};

export const Pantalla = ({ children, centrar = true, zIndex = 9999 }) => (
    <div style={{
        position: 'fixed', inset: 0, zIndex, overflowY: 'auto', overflowX: 'hidden', fontFamily: FUENTE, color: T.texto,
        background: `radial-gradient(circle at 20% 0%, #2a1b5e55 0%, transparent 45%), radial-gradient(circle at 85% 100%, #0e4f6355 0%, transparent 45%), ${T.bg}`,
    }}>
        <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: centrar ? 'center' : 'flex-start', padding: '16px 16px 28px', boxSizing: 'border-box' }}>
            {children}
        </div>
    </div>
);

export const Cabecera = ({ izquierda, centro, derecha }) => (
    <div style={{ width: '100%', maxWidth: 1200, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>{izquierda}</div>
        <div style={{ textAlign: 'center', minWidth: 0 }}>{centro}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{derecha}<BotonSonido /></div>
    </div>
);

export const Tarjeta = ({ children, style }) => (
    <div style={{ background: T.panel, border: `1px solid ${T.borde}`, borderRadius: 22, padding: 22, backdropFilter: 'blur(10px)', ...style }}>{children}</div>
);

// Título animado V-A-N-I-L-A con fichas.
export const Titulo = ({ tam = 56 }) => (
    <div style={{ display: 'flex', gap: tam * 0.12, justifyContent: 'center' }}>
        {[...'VANILA'].map((l, i) => {
            const c = 'AEIOU'.includes(l) ? T.cian : T.lila;
            return (
                <div key={i} className="nl-anim" style={{
                    width: tam, height: tam * 1.12, borderRadius: tam * 0.2, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 900, fontSize: tam * 0.58, color: '#fff', textShadow: `0 0 12px ${c}`,
                    border: `2px solid ${c}`, background: `linear-gradient(160deg, ${c}44, #14122d)`, boxShadow: `0 5px 0 ${c}55, 0 0 16px ${c}44`,
                    '--r': `${(i % 2 ? 1 : -1) * 3}deg`,
                    animation: `nlEntra .8s cubic-bezier(.2,.8,.3,1.2) ${i * 0.08}s both, nlFlota 2.4s ease-in-out ${1 + i * 0.12}s infinite`,
                }}>{l}</div>
            );
        })}
    </div>
);

// Carga el diccionario del idioma (y vuelve a cargar si cambia).
export const useDiccionario = (idioma) => {
    const [estado, setEstado] = useState({ dicc: null, error: null });
    const cargar = useCallback(() => {
        setEstado({ dicc: null, error: null });
        let vivo = true;
        cargarDiccionario(idioma).then(d => vivo && setEstado({ dicc: d, error: null })).catch(e => vivo && setEstado({ dicc: null, error: e.message }));
        return () => { vivo = false; };
    }, [idioma]);
    useEffect(() => cargar(), [cargar]);
    return { ...estado, reintentar: cargar };
};

// ─── Enviar al profesor ──────────────────────────────────────────────────────
export function ModalEnviarProfe({ datos, idioma = 'es', onClose }) {
    const t = textos(idioma).modal;
    const [codigo, setCodigo] = useState('');
    const [nombre, setNombre] = useState(datos.nombre || '');
    const [curso, setCurso] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [enviado, setEnviado] = useState(false);
    const [error, setError] = useState('');

    const enviar = async () => {
        const code = codigo.trim().toUpperCase();
        if (!nombre.trim()) { setError(t.errNombre); return; }
        if (!code) { setError(t.errCodigo); return; }
        setEnviando(true); setError('');
        try {
            const snap = await getDoc(doc(db, 'codigos_profesor', code));
            if (!snap.exists()) { setError(t.noCodigo); setEnviando(false); return; }
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'VANILA',
                modalidad: datos.modalidad || 'Individual',
                fecha: new Date(),
                codigoProfesor: code,
                jugadores: [{
                    nombre: nombre.trim(),
                    curso: curso.trim(),
                    aciertos: datos.aciertos,
                    intentos: datos.intentos,
                    porcentaje: Math.round((datos.aciertos / Math.max(1, datos.intentos)) * 100),
                    puntos: datos.puntos,
                    idioma: datos.idioma || idioma,
                    modo: datos.modo || 'Solo',
                    rondas: datos.rondas || null,
                    duracion: datos.duracion || null,
                    masLarga: datos.masLarga || '',
                    palabras: (datos.palabras || []).slice(0, 80),
                    fallosTilde: (datos.fallosTilde || []).slice(0, 30),
                    noExisten: datos.noExisten || 0,
                }],
            });
            setEnviado(true);
        } catch (e) { setError('Error: ' + e.message); }
        setEnviando(false);
    };

    const inp = {
        padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${T.borde}`, background: 'rgba(255,255,255,0.06)',
        color: 'white', fontSize: '0.92rem', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: FUENTE,
    };
    const etq = { fontSize: '0.78rem', color: T.suave, fontWeight: 700, display: 'block', marginBottom: 4 };
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
            <div style={{ background: '#15132e', border: `1px solid ${T.borde}`, borderRadius: 20, width: '100%', maxWidth: 380, padding: '24px 26px', color: 'white', fontFamily: FUENTE, boxShadow: `0 0 40px ${T.lila}33` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: T.ambar }}>{t.titulo}</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.2rem' }}>✕</button>
                </div>
                {enviado ? (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{ fontSize: '3rem' }}>✅</div>
                        <div style={{ color: T.verde, fontWeight: 800 }}>{t.enviado}</div>
                        <div style={{ color: T.suave, fontSize: '0.88rem', marginTop: 8 }}>{datos.aciertos} · ⭐ {datos.puntos}</div>
                        <Boton onClick={onClose} color={T.suave} style={{ marginTop: 16 }}>{t.cerrar}</Boton>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div><label style={etq}>{t.nombre}</label><input value={nombre} onChange={e => setNombre(e.target.value)} placeholder={t.nombreP} style={inp} /></div>
                        <div><label style={etq}>{t.curso}</label><input value={curso} onChange={e => setCurso(e.target.value)} placeholder={t.cursoP} style={inp} /></div>
                        <div><label style={etq}>{t.codigo}</label><input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="PROF01" maxLength={10} style={{ ...inp, letterSpacing: 2, fontWeight: 800 }} /></div>
                        {error && <div style={{ color: T.rojo, fontSize: '0.82rem' }}>⚠ {error}</div>}
                        <div style={{ display: 'flex', gap: 9, marginTop: 4 }}>
                            <Boton onClick={onClose} color={T.suave} style={{ flex: 1 }}>{t.cancelar}</Boton>
                            <Boton onClick={enviar} disabled={enviando} color={T.cian} relleno style={{ flex: 2 }}>{enviando ? t.enviando : t.enviar}</Boton>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
