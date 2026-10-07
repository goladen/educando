// VaniLa · Tablero 🧩 — modo online tipo Scrabble para 2-6 jugadores (como el dominó: por turnos).
// Cada jugador ve en su dispositivo SUS 9 letras y las va colocando en un tablero común de 15×15
// cruzando sus palabras con las que ya hay. La sala vive en live_games/{CODIGO} (tipoJuego
// VANILA_TABLERO) y todas las jugadas se aplican con transacciones.
//
// Reglas: fichas en una sola fila o columna, sin huecos y tocando lo ya jugado (la primera, sobre ★).
// La palabra principal debe existir CON SU TILDE (toca una ficha colocada para ponérsela);
// las palabras que se forman al cruzar solo tienen que existir. Casillas de premio clásicas,
// +50 si usas las 9 letras y +2 por palabra con tilde. Acaba cuando alguien vacía su atril con
// la bolsa vacía o cuando todos pasan dos vueltas seguidas.
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, onSnapshot, runTransaction } from 'firebase/firestore';
import { guardarRegistroLocal } from '../utils/registrosLocales';
import { despertarAudio, sonidoCorrecto, sonidoIncorrecto, sonidoFinal } from '../utils/sonidosFeedback';
import { IDIOMAS_PALABRAS, CODIGOS_IDIOMA, baseDe, barajar, cargarDiccionario, cargarLargas } from '../utils/diccionarios';
import {
    T, FUENTE, COLORES_JUGADOR, useWindowSize, variantesDe, conVariante, blip, sonidoTurno, sonidoPalabra,
    lanzarLetras, Boton, Opciones, Ficha, Reloj, Pantalla, Cabecera, Tarjeta, Titulo, ModalEnviarProfe,
} from './comun';

const N = 15;
const CENTRO = 7;
const ATRIL = 9;
const BINGO = 50;
const k = (r, c) => `${r}_${c}`;

// ─── Textos ──────────────────────────────────────────────────────────────────
const TX = {
    es: {
        local: 'En este dispositivo', online: 'Online', localDesc: 'Jugad todos con el mismo móvil, tablet u ordenador (o en la pizarra): en cada turno el jugador destapa SUS letras, juega y pasa el dispositivo.', continuar: '▶ Continuar partida', jugadorN: 'Jugador', anadir: '+ Añadir jugador', jugarLocal: '▶ Jugar', pasaDispositivo: 'Pasa el dispositivo. ¡Que nadie más mire la pantalla!', verFichas: '👀 Ver mis letras',
        titulo: 'Tablero', crear: 'Crear sala', unirse: 'Unirme a una sala', codigo: 'Código de sala', tuNombre: 'Tu nombre',
        yoJuego: 'Yo también juego (si no, este dispositivo será la pantalla del tablero)', tiempoTurno: 'Tiempo por turno', sinLimite: 'Sin límite',
        crearSala: '✨ Crear sala', entrar: '▶ Entrar', compartir: 'Escanea o entra en', copiar: '📋 Copiar enlace', copiado: '✓ Copiado',
        esperando: 'Esperando jugadores…', empezar: '▶ Empezar partida', esperaAnfitrion: 'Esperando a que empiece la partida…', cargandoDicc: 'Cargando diccionario…',
        tuTurno: '¡Tu turno!', turnoDe: n => `Turno de ${n}`, jugar: p => `✔ Jugar${p != null ? ` (+${p})` : ''}`, pasar: '⏭ Pasar', cambiar: '🔄 Cambiar letras',
        confirmarCambio: n => `🔄 Cambiar ${n}`, cancelar: 'Cancelar', recoger: '↩ Recoger', mezclar: '🔀', tilde: '´ Tilde', bolsa: n => `🎒 ${n} en la bolsa`,
        fin: '🏁 Fin de la partida', gana: n => `¡Gana ${n}!`, enviarProfe: '📤 Enviar al profesor', salir: '← Salir', menu: 'Menú', terminar: 'Terminar partida',
        noexiste: 'No existe ninguna sala con ese código', llena: 'La sala está llena (6 jugadores)', terminada: 'Esa partida ya terminó', escribeNombre: 'Escribe tu nombre',
        marcaCambio: 'Toca las letras que quieres cambiar', ultima: 'Última jugada', historial: 'Jugadas', jugadores: 'Jugadores', idioma: 'Idioma',
        m: {
            vacia: 'Coloca alguna letra', linea: 'Las letras deben ir en una sola fila o columna', huecos: 'No puede haber huecos entre tus letras',
            centro: 'La primera palabra debe pasar por la ★ y tener 2 letras o más', conectar: 'Tu palabra debe tocar alguna letra del tablero',
            aislada: 'Forma una palabra de 2 letras o más', noexiste: w => `«${w}» no está en el diccionario`, tilde: w => `«${w}»: revisa la tilde (toca la ficha)`,
            noTurno: 'No es tu turno', valida: p => `Jugada válida: +${p}`,
        },
        hist: { jugada: (n, w, p) => `${n}: ${w} (+${p})`, pase: n => `${n} pasa`, cambio: n => `${n} cambia letras`, tiempo: n => `${n}: se acabó el tiempo`, entra: n => `${n} se une` },
        premio: { DL: 'DL', TL: 'TL', DP: 'DP', TP: 'TP' }, bingo: '¡9 letras! +50',
    },
    ca: {
        local: 'En aquest dispositiu', online: 'En línia', localDesc: 'Jugueu tots amb el mateix mòbil, tauleta o ordinador (o a la pissarra): a cada torn el jugador destapa LES SEVES lletres, juga i passa el dispositiu.', continuar: '▶ Continuar la partida', jugadorN: 'Jugador', anadir: '+ Afegir jugador', jugarLocal: '▶ Jugar', pasaDispositivo: 'Passa el dispositiu. Que ningú més miri la pantalla!', verFichas: '👀 Veure les meves lletres',
        titulo: 'Tauler', crear: 'Crear sala', unirse: 'Unir-me a una sala', codigo: 'Codi de sala', tuNombre: 'El teu nom',
        yoJuego: 'Jo també jugo (si no, aquest dispositiu serà la pantalla del tauler)', tiempoTurno: 'Temps per torn', sinLimite: 'Sense límit',
        crearSala: '✨ Crear sala', entrar: '▶ Entrar', compartir: 'Escaneja o entra a', copiar: '📋 Copiar enllaç', copiado: '✓ Copiat',
        esperando: 'Esperant jugadors…', empezar: '▶ Començar la partida', esperaAnfitrion: 'Esperant que comenci la partida…', cargandoDicc: 'Carregant el diccionari…',
        tuTurno: 'Et toca!', turnoDe: n => `Torn de ${n}`, jugar: p => `✔ Jugar${p != null ? ` (+${p})` : ''}`, pasar: '⏭ Passar', cambiar: '🔄 Canviar lletres',
        confirmarCambio: n => `🔄 Canviar ${n}`, cancelar: 'Cancel·lar', recoger: '↩ Recollir', mezclar: '🔀', tilde: '´ Accent', bolsa: n => `🎒 ${n} a la bossa`,
        fin: '🏁 Fi de la partida', gana: n => `Guanya ${n}!`, enviarProfe: '📤 Enviar al professor', salir: '← Sortir', menu: 'Menú', terminar: 'Acabar la partida',
        noexiste: 'No hi ha cap sala amb aquest codi', llena: 'La sala és plena (6 jugadors)', terminada: 'Aquesta partida ja ha acabat', escribeNombre: 'Escriu el teu nom',
        marcaCambio: 'Toca les lletres que vols canviar', ultima: 'Última jugada', historial: 'Jugades', jugadores: 'Jugadors', idioma: 'Idioma',
        m: {
            vacia: 'Col·loca alguna lletra', linea: 'Les lletres han d\'anar en una sola fila o columna', huecos: 'No hi pot haver forats entre les teves lletres',
            centro: 'La primera paraula ha de passar per la ★ i tenir 2 lletres o més', conectar: 'La paraula ha de tocar alguna lletra del tauler',
            aislada: 'Forma una paraula de 2 lletres o més', noexiste: w => `«${w}» no és al diccionari`, tilde: w => `«${w}»: revisa l'accent, la ç o la l·l`,
            noTurno: 'No és el teu torn', valida: p => `Jugada vàlida: +${p}`,
        },
        hist: { jugada: (n, w, p) => `${n}: ${w} (+${p})`, pase: n => `${n} passa`, cambio: n => `${n} canvia lletres`, tiempo: n => `${n}: s'ha acabat el temps`, entra: n => `${n} s'hi uneix` },
        premio: { DL: 'DL', TL: 'TL', DP: 'DP', TP: 'TP' }, bingo: '9 lletres! +50',
    },
    en: {
        local: 'On this device', online: 'Online', localDesc: 'Everyone plays on the same phone, tablet or computer (or the whiteboard): on each turn the player reveals THEIR letters, plays and passes the device on.', continuar: '▶ Resume game', jugadorN: 'Player', anadir: '+ Add player', jugarLocal: '▶ Play', pasaDispositivo: 'Pass the device. No peeking, everyone else!', verFichas: '👀 Show my letters',
        titulo: 'Board', crear: 'Create room', unirse: 'Join a room', codigo: 'Room code', tuNombre: 'Your name',
        yoJuego: 'I\'m playing too (otherwise this device will be the board screen)', tiempoTurno: 'Time per turn', sinLimite: 'No limit',
        crearSala: '✨ Create room', entrar: '▶ Join', compartir: 'Scan or go to', copiar: '📋 Copy link', copiado: '✓ Copied',
        esperando: 'Waiting for players…', empezar: '▶ Start game', esperaAnfitrion: 'Waiting for the game to start…', cargandoDicc: 'Loading dictionary…',
        tuTurno: 'Your turn!', turnoDe: n => `${n}'s turn`, jugar: p => `✔ Play${p != null ? ` (+${p})` : ''}`, pasar: '⏭ Pass', cambiar: '🔄 Swap letters',
        confirmarCambio: n => `🔄 Swap ${n}`, cancelar: 'Cancel', recoger: '↩ Recall', mezclar: '🔀', tilde: '´', bolsa: n => `🎒 ${n} in the bag`,
        fin: '🏁 Game over', gana: n => `${n} wins!`, enviarProfe: '📤 Send to teacher', salir: '← Exit', menu: 'Menu', terminar: 'End game',
        noexiste: 'There is no room with that code', llena: 'The room is full (6 players)', terminada: 'That game is over', escribeNombre: 'Write your name',
        marcaCambio: 'Tap the letters you want to swap', ultima: 'Last move', historial: 'Moves', jugadores: 'Players', idioma: 'Language',
        m: {
            vacia: 'Place some letters', linea: 'Letters must be in a single row or column', huecos: 'There can\'t be gaps between your letters',
            centro: 'The first word must cover the ★ and have 2+ letters', conectar: 'Your word must touch a letter on the board',
            aislada: 'Make a word of 2 or more letters', noexiste: w => `"${w}" is not in the dictionary`, tilde: w => `"${w}": check the spelling`,
            noTurno: 'It\'s not your turn', valida: p => `Valid move: +${p}`,
        },
        hist: { jugada: (n, w, p) => `${n}: ${w} (+${p})`, pase: n => `${n} passes`, cambio: n => `${n} swaps letters`, tiempo: n => `${n}: time's up`, entra: n => `${n} joins` },
        premio: { DL: 'DL', TL: 'TL', DP: 'DW', TP: 'TW' }, bingo: 'All 9! +50',
    },
    fr: {
        local: 'Sur cet appareil', online: 'En ligne', localDesc: 'Tout le monde joue sur le même téléphone, tablette ou ordinateur (ou au tableau) : à chaque tour, le joueur découvre SES lettres, joue et passe l’appareil.', continuar: '▶ Reprendre la partie', jugadorN: 'Joueur', anadir: '+ Ajouter un joueur', jugarLocal: '▶ Jouer', pasaDispositivo: 'Passe l’appareil. Les autres, ne regardez pas !', verFichas: '👀 Voir mes lettres',
        titulo: 'Plateau', crear: 'Créer une salle', unirse: 'Rejoindre une salle', codigo: 'Code de la salle', tuNombre: 'Ton prénom',
        yoJuego: 'Je joue aussi (sinon cet appareil sera l\'écran du plateau)', tiempoTurno: 'Temps par tour', sinLimite: 'Sans limite',
        crearSala: '✨ Créer la salle', entrar: '▶ Entrer', compartir: 'Scanne ou va sur', copiar: '📋 Copier le lien', copiado: '✓ Copié',
        esperando: 'En attente des joueurs…', empezar: '▶ Lancer la partie', esperaAnfitrion: 'En attente du début de la partie…', cargandoDicc: 'Chargement du dictionnaire…',
        tuTurno: 'À toi !', turnoDe: n => `Au tour de ${n}`, jugar: p => `✔ Jouer${p != null ? ` (+${p})` : ''}`, pasar: '⏭ Passer', cambiar: '🔄 Échanger',
        confirmarCambio: n => `🔄 Échanger ${n}`, cancelar: 'Annuler', recoger: '↩ Reprendre', mezclar: '🔀', tilde: '´ Accent', bolsa: n => `🎒 ${n} dans le sac`,
        fin: '🏁 Fin de la partie', gana: n => `${n} gagne !`, enviarProfe: '📤 Envoyer au prof', salir: '← Quitter', menu: 'Menu', terminar: 'Terminer la partie',
        noexiste: 'Aucune salle avec ce code', llena: 'La salle est pleine (6 joueurs)', terminada: 'Cette partie est terminée', escribeNombre: 'Écris ton prénom',
        marcaCambio: 'Touche les lettres à échanger', ultima: 'Dernier coup', historial: 'Coups', jugadores: 'Joueurs', idioma: 'Langue',
        m: {
            vacia: 'Place des lettres', linea: 'Les lettres doivent être sur une seule ligne ou colonne', huecos: 'Pas de trous entre tes lettres',
            centro: 'Le premier mot doit passer par la ★ et avoir 2 lettres ou plus', conectar: 'Ton mot doit toucher une lettre du plateau',
            aislada: 'Forme un mot de 2 lettres ou plus', noexiste: w => `« ${w} » n'est pas dans le dictionnaire`, tilde: w => `« ${w} » : vérifie les accents (touche la lettre)`,
            noTurno: 'Ce n\'est pas ton tour', valida: p => `Coup valide : +${p}`,
        },
        hist: { jugada: (n, w, p) => `${n} : ${w} (+${p})`, pase: n => `${n} passe`, cambio: n => `${n} échange des lettres`, tiempo: n => `${n} : temps écoulé`, entra: n => `${n} arrive` },
        premio: { DL: 'LD', TL: 'LT', DP: 'MD', TP: 'MT' }, bingo: '9 lettres ! +50',
    },
};
const tx = (idioma) => TX[idioma] || TX.es;

// ─── Valores de las letras y bolsa ───────────────────────────────────────────
const VALORES = {
    es: { a: 1, e: 1, o: 1, i: 1, s: 1, n: 1, l: 1, r: 1, u: 1, t: 1, d: 2, g: 2, c: 3, b: 3, m: 3, p: 3, h: 4, f: 4, v: 4, y: 4, q: 5, j: 8, ñ: 8, x: 8, z: 10 },
    ca: { a: 1, e: 1, i: 1, r: 1, s: 1, n: 1, o: 1, t: 1, l: 1, u: 1, c: 2, d: 2, m: 2, b: 3, g: 3, p: 3, f: 4, v: 4, h: 8, j: 8, q: 8, z: 8, x: 10 },
    en: { a: 1, e: 1, i: 1, o: 1, u: 1, l: 1, n: 1, s: 1, t: 1, r: 1, d: 2, g: 2, b: 3, c: 3, m: 3, p: 3, f: 4, h: 4, v: 4, w: 4, y: 4, k: 5, j: 8, x: 8, q: 10, z: 10 },
    fr: { a: 1, e: 1, i: 1, n: 1, o: 1, r: 1, s: 1, t: 1, u: 1, l: 1, d: 2, g: 2, m: 2, b: 3, c: 3, p: 3, f: 4, h: 4, v: 4, j: 8, q: 8, k: 10, w: 10, x: 10, y: 10, z: 10 },
};
const valorDe = (idioma, l) => VALORES[idioma]?.[l] ?? 1;

// Bolsa proporcional a la frecuencia de cada letra (más grande si hay muchos jugadores).
const crearBolsa = (idioma, nJugadores) => {
    const cfg = IDIOMAS_PALABRAS[idioma];
    const total = Math.max(100, nJugadores * ATRIL + 60);
    const bolsa = [];
    const repartir = (pesos, cuota) => {
        const suma = Object.values(pesos).reduce((a, b) => a + b, 0);
        for (const [l, p] of Object.entries(pesos)) {
            const n = Math.max(1, Math.round((p / suma) * cuota));
            for (let i = 0; i < n; i++) bolsa.push(l);
        }
    };
    repartir(cfg.vocales, total * 0.44);
    repartir(cfg.consonantes, total * 0.56);
    return barajar(bolsa);
};

// ─── Casillas de premio (disposición clásica) ────────────────────────────────
const PREMIOS = (() => {
    const m = {};
    const poner = (tipo, lista) => lista.forEach(([r, c]) => {
        [[r, c], [r, N - 1 - c], [N - 1 - r, c], [N - 1 - r, N - 1 - c]].forEach(([a, b]) => { m[k(a, b)] = tipo; });
    });
    poner('TP', [[0, 0], [0, 7], [7, 0]]);
    poner('DP', [[1, 1], [2, 2], [3, 3], [4, 4], [7, 7]]);
    poner('TL', [[1, 5], [5, 1], [5, 5]]);
    poner('DL', [[0, 3], [3, 0], [2, 6], [6, 2], [3, 7], [7, 3], [6, 6]]);
    return m;
})();
const COLOR_PREMIO = { TP: '#e11d48', DP: '#db2777', TL: '#2563eb', DL: '#0891b2' };

// ─── Evaluación de una jugada ────────────────────────────────────────────────
// tablero: { 'r_c': { l, v, j } } · colocadas: [{ r, c, l, v }] (l = letra base, v = con tilde/ç/l·)
// Devuelve { ok, total, palabras: [{ forma, pts, principal }] } o { ok:false, motivo, palabra? }
const unidades = (forma) => {
    // Separa una forma del diccionario en las «fichas» que la forman (l· es una ficha; œ son dos).
    const s = forma.replace(/œ/g, 'oe').replace(/æ/g, 'ae');
    const u = [];
    for (const ch of s) { if (ch === '·' && u.length) u[u.length - 1] += '·'; else u.push(ch); }
    return u;
};

export function evaluarJugada(tablero, colocadas, dicc) {
    const idioma = dicc.idioma;
    if (!colocadas.length) return { ok: false, motivo: 'vacia' };
    const nuevas = new Map(colocadas.map(p => [k(p.r, p.c), p]));
    const en = (r, c) => (r < 0 || c < 0 || r >= N || c >= N) ? null : (nuevas.get(k(r, c)) || tablero[k(r, c)] || null);
    const vacio = Object.keys(tablero).length === 0;

    const filas = new Set(colocadas.map(p => p.r)), cols = new Set(colocadas.map(p => p.c));
    if (filas.size > 1 && cols.size > 1) return { ok: false, motivo: 'linea' };

    // Palabra que pasa por (r,c) en la dirección (dr,dc)
    const palabraEn = (r, c, dr, dc) => {
        while (en(r - dr, c - dc)) { r -= dr; c -= dc; }
        const celdas = [];
        while (en(r, c)) { const x = en(r, c); celdas.push({ r, c, l: x.l, v: x.v, nueva: nuevas.has(k(r, c)) }); r += dr; c += dc; }
        return celdas;
    };

    let dir;
    if (colocadas.length > 1) dir = filas.size === 1 ? [0, 1] : [1, 0];
    else {
        const p = colocadas[0];
        dir = palabraEn(p.r, p.c, 0, 1).length >= 2 ? [0, 1] : [1, 0];
    }
    const principal = palabraEn(colocadas[0].r, colocadas[0].c, dir[0], dir[1]);
    // Sin huecos: todas las colocadas deben estar dentro de la palabra principal
    if (colocadas.some(p => !principal.some(x => x.r === p.r && x.c === p.c))) return { ok: false, motivo: 'huecos' };
    if (principal.length < 2) return { ok: false, motivo: 'aislada' };

    if (vacio) {
        if (!colocadas.some(p => p.r === CENTRO && p.c === CENTRO)) return { ok: false, motivo: 'centro' };
    } else {
        const toca = colocadas.some(p => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => tablero[k(p.r + a, p.c + b)]));
        if (!toca) return { ok: false, motivo: 'conectar' };
    }

    const palabras = [{ celdas: principal, principal: true }];
    for (const p of colocadas) {
        const cruz = palabraEn(p.r, p.c, dir[1], dir[0]);
        if (cruz.length >= 2) palabras.push({ celdas: cruz, principal: false });
    }

    let total = 0;
    const res = [];
    for (const { celdas, principal: esPrincipal } of palabras) {
        const forma = celdas.map(x => x.v).join('');
        const base = celdas.map(x => x.l).join('');
        const e = dicc.formas.get(base);
        if (!e) return { ok: false, motivo: 'noexiste', palabra: forma };
        if (esPrincipal) {
            // Las fichas nuevas deben llevar exactamente su tilde; las que ya estaban, cualquiera.
            const vale = e.formas.some(f => {
                const u = unidades(f);
                return u.length === celdas.length && celdas.every((x, i) => !x.nueva || u[i] === x.v);
            });
            if (!vale) return { ok: false, motivo: 'tilde', palabra: forma, correctas: e.formas };
        }
        let suma = 0, mult = 1;
        for (const x of celdas) {
            const pr = x.nueva ? PREMIOS[k(x.r, x.c)] : null;
            const v = valorDe(idioma, x.l);
            suma += v * (pr === 'DL' ? 2 : pr === 'TL' ? 3 : 1);
            if (pr === 'DP') mult *= 2;
            if (pr === 'TP') mult *= 3;
        }
        let pts = suma * mult;
        if (esPrincipal && forma.replace(/·/g, '') !== baseDe(forma, idioma)) pts += 2;
        total += pts;
        res.push({ forma, pts, principal: esPrincipal });
    }
    if (colocadas.length === ATRIL) total += BINGO;
    return { ok: true, total, palabras: res, bingo: colocadas.length === ATRIL };
}

// ─── Utilidades de sala ──────────────────────────────────────────────────────
const miIdentificador = () => {
    try {
        let id = localStorage.getItem('pikt_vanila_id');
        if (!id) { id = 'j' + Math.random().toString(36).slice(2, 10); localStorage.setItem('pikt_vanila_id', id); }
        return id;
    } catch { return 'j' + Math.random().toString(36).slice(2, 10); }
};
const nuevoCodigo = () => Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('');
const urlSala = (codigo) => `${window.location.origin}/vanila?tablero=${codigo}`;
const qrDe = (url, size) => `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=1a1a2e&margin=8`;
const sumaAtril = (idioma, atril = []) => atril.reduce((a, l) => a + valorDe(idioma, l), 0);
const conHistorial = (d, entrada) => [...(d.historial || []).slice(-29), { ...entrada, t: Date.now() }];

// Cierra la partida: cada uno resta lo que le queda en el atril; quien vació el suyo se lo suma.
const cierre = (d, upd, atriles, puntos, quienVacio) => {
    let suma = 0;
    for (const id of d.orden) {
        const v = id === quienVacio ? 0 : sumaAtril(d.idioma, atriles[id]);
        puntos[id] -= v; suma += v;
    }
    if (quienVacio) puntos[quienVacio] += suma;
    for (const id of d.orden) upd[`jugadores.${id}.puntos`] = puntos[id];
    upd.estado = 'fin';
    upd.finTurno = null;
};

// En el modo local el reloj del turno no arranca hasta que el jugador destapa sus letras.
const siguienteTurno = (d) => ({
    turno: (d.turno + 1) % d.orden.length,
    finTurno: d.config?.tiempoTurno && !d.local ? Date.now() + d.config.tiempoTurno * 1000 : null,
    nTurno: (d.nTurno || 0) + 1,
});

// ─── Motores: dónde vive el estado de la partida ─────────────────────────────
// Los dos exponen suscribir(cb) y transaccion(fn). fn(d) recibe el estado actual y devuelve las
// actualizaciones con rutas «a.b.c» (como updateDoc de Firestore) o null; si lanza, no se aplica nada.
// Así las reglas son las mismas jugando online (Firestore) o en un solo dispositivo (memoria).
const motorOnline = (codigo) => {
    const ref = doc(db, 'live_games', codigo);
    return {
        local: false,
        suscribir: (cb) => onSnapshot(ref, s => cb(s.exists() ? s.data() : { borrada: true })),
        transaccion: (fn) => runTransaction(db, async (tr) => {
            const s = await tr.get(ref);
            const upd = fn(s.data());
            if (upd) tr.update(ref, upd);
        }),
    };
};

const aplicarRutas = (d, upd) => {
    const n = JSON.parse(JSON.stringify(d));
    for (const [ruta, v] of Object.entries(upd)) {
        const partes = ruta.split('.');
        let o = n;
        for (const p of partes.slice(0, -1)) { if (!o[p] || typeof o[p] !== 'object') o[p] = {}; o = o[p]; }
        o[partes[partes.length - 1]] = v;
    }
    return n;
};

// La partida local se guarda en el navegador para poder continuarla si se cierra la pestaña.
const CLAVE_LOCAL = 'pikt_vanila_local';
const leerPartidaLocal = () => {
    try { const d = JSON.parse(localStorage.getItem(CLAVE_LOCAL) || 'null'); return d?.estado === 'jugando' ? d : null; }
    catch { return null; }
};
const motorLocal = (inicial) => {
    let estado = inicial;
    const subs = new Set();
    const guardar = () => {
        try { if (estado.estado === 'jugando') localStorage.setItem(CLAVE_LOCAL, JSON.stringify(estado)); else localStorage.removeItem(CLAVE_LOCAL); }
        catch { /* sin almacenamiento */ }
    };
    guardar();
    return {
        local: true,
        suscribir: (cb) => { subs.add(cb); cb(estado); return () => subs.delete(cb); },
        transaccion: async (fn) => {
            const upd = fn(estado);
            if (!upd) return;
            estado = aplicarRutas(estado, upd);
            guardar();
            subs.forEach(cb => cb(estado));
        },
    };
};

const crearPartidaLocal = (nombres, idioma, tiempoTurno) => {
    const ids = nombres.map((_, i) => `L${i}`);
    const bolsa = crearBolsa(idioma, ids.length);
    const atriles = {};
    ids.forEach(id => { atriles[id] = bolsa.splice(0, ATRIL); });
    return {
        tipoJuego: 'VANILA_TABLERO', local: true, codigo: '', idioma, estado: 'jugando', creado: Date.now(), anfitrion: null,
        config: { tiempoTurno },
        jugadores: Object.fromEntries(ids.map((id, i) => [id, { nombre: nombres[i], color: i, puntos: 0, jugadas: 0, palabras: [] }])),
        orden: ids, turno: 0, nTurno: 1, tablero: {}, bolsa, atriles, pases: 0, finTurno: null, historial: [], ultima: null,
    };
};

// ─── Entrada: crear o unirse ─────────────────────────────────────────────────
function Entrada({ idiomaInicial, codigoInicial, miId, onDentro, onMenu, onLocal }) {
    const [idioma, setIdioma] = useState(idiomaInicial);
    const t = tx(idioma);
    const { w } = useWindowSize();
    const [pestana, setPestana] = useState(codigoInicial ? 'online' : 'local');
    const [nombresLocal, setNombresLocal] = useState(() => {
        try { const g = JSON.parse(localStorage.getItem('pikt_vanila_nombres_local') || 'null'); if (Array.isArray(g) && g.length >= 2) return g; } catch { /* sin almacenamiento */ }
        return ['', ''];
    });
    const guardada = useMemo(leerPartidaLocal, []);
    const empezarLocal = () => {
        const nombres = nombresLocal.map((n, i) => n.trim().slice(0, 16) || `${t.jugadorN} ${i + 1}`);
        try { localStorage.setItem('pikt_vanila_nombres_local', JSON.stringify(nombresLocal)); } catch { /* sin almacenamiento */ }
        despertarAudio();
        onLocal(crearPartidaLocal(nombres, idioma, tiempo));
    };
    const [nombre, setNombre] = useState(() => { try { return localStorage.getItem('pikt_vanila_nombre') || ''; } catch { return ''; } });
    const [codigo, setCodigo] = useState(codigoInicial || '');
    const [juego, setJuego] = useState(true);
    const [tiempo, setTiempo] = useState(0);
    const [ocupado, setOcupado] = useState(false);
    const [error, setError] = useState('');
    const guardarNombre = () => { try { localStorage.setItem('pikt_vanila_nombre', nombre.trim()); } catch { /* sin almacenamiento */ } };

    const crear = async () => {
        if (juego && !nombre.trim()) { setError(t.escribeNombre); return; }
        setOcupado(true); setError(''); despertarAudio(); guardarNombre();
        try {
            let codigoN;
            for (let i = 0; i < 5; i++) { codigoN = nuevoCodigo(); if (!(await getDoc(doc(db, 'live_games', codigoN))).exists()) break; }
            await setDoc(doc(db, 'live_games', codigoN), {
                tipoJuego: 'VANILA_TABLERO', codigo: codigoN, idioma, estado: 'esperando', creado: Date.now(), anfitrion: miId,
                config: { tiempoTurno: tiempo },
                jugadores: juego ? { [miId]: { nombre: nombre.trim().slice(0, 16), color: 0, puntos: 0, jugadas: 0, palabras: [] } } : {},
                orden: [], turno: 0, nTurno: 0, tablero: {}, bolsa: [], atriles: {}, pases: 0, finTurno: null, historial: [], ultima: null,
            });
            onDentro(codigoN);
        } catch (e) { setError(e.message); }
        setOcupado(false);
    };

    const unirse = async () => {
        const cod = codigo.trim().toUpperCase();
        if (!nombre.trim()) { setError(t.escribeNombre); return; }
        if (!cod) return;
        setOcupado(true); setError(''); despertarAudio(); guardarNombre();
        try {
            const ref = doc(db, 'live_games', cod);
            await runTransaction(db, async (tr) => {
                const s = await tr.get(ref);
                if (!s.exists() || s.data().tipoJuego !== 'VANILA_TABLERO') throw new Error(t.noexiste);
                const d = s.data();
                if (d.jugadores?.[miId]) { tr.update(ref, { [`jugadores.${miId}.nombre`]: nombre.trim().slice(0, 16) }); return; }
                if (d.estado === 'fin') throw new Error(t.terminada);
                const n = Object.keys(d.jugadores || {}).length;
                if (n >= 6) throw new Error(t.llena);
                const upd = {
                    [`jugadores.${miId}`]: { nombre: nombre.trim().slice(0, 16), color: n, puntos: 0, jugadas: 0, palabras: [] },
                    historial: conHistorial(d, { tipo: 'entra', j: miId, nombre: nombre.trim().slice(0, 16) }),
                };
                if (d.estado === 'jugando') {   // se puede entrar a mitad de partida, como en el dominó
                    const bolsa = [...d.bolsa];
                    upd[`atriles.${miId}`] = bolsa.splice(0, ATRIL);
                    upd.bolsa = bolsa;
                    upd.orden = [...d.orden, miId];
                }
                tr.update(ref, upd);
            });
            onDentro(cod);
        } catch (e) { setError(e.message); }
        setOcupado(false);
    };

    const inp = { padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${T.borde}`, background: 'rgba(255,255,255,0.06)', color: 'white', fontSize: '1rem', fontFamily: FUENTE, outline: 'none', width: '100%', boxSizing: 'border-box', fontWeight: 700 };
    const etq = { color: T.suave, fontWeight: 800, fontSize: '0.75rem', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 };
    return (
        <Pantalla>
            <div style={{ position: 'fixed', top: 14, left: 14 }}><Boton onClick={onMenu} color={T.suave}>{t.salir}</Boton></div>
            <div style={{ marginTop: 50 }}><Titulo tam={Math.min(48, (w - 60) / 7)} /></div>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: T.ambar, margin: '12px 0 16px' }}>🧩 {t.titulo}</div>

            {/* ¿En este dispositivo u online? */}
            <div style={{ display: 'flex', gap: 6, padding: 5, borderRadius: 16, background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.borde}`, marginBottom: 18 }}>
                {[['local', `📱 ${t.local}`], ['online', `🌐 ${t.online}`]].map(([id, txt]) => (
                    <button key={id} className="nl-btn" onClick={() => setPestana(id)} style={{
                        padding: '10px 18px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: FUENTE, fontWeight: 800, fontSize: '0.95rem',
                        background: pestana === id ? T.ambar : 'transparent', color: pestana === id ? '#0A0918' : T.texto,
                    }}>{txt}</button>
                ))}
            </div>

            {pestana === 'local' && (
                <Tarjeta style={{ width: '100%', maxWidth: 520, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ color: T.suave, fontSize: '0.9rem', lineHeight: 1.45, textAlign: 'center' }}>{t.localDesc}</div>
                    {guardada && (
                        <Boton onClick={() => onLocal(guardada)} color={T.verde} relleno>
                            {t.continuar} ({guardada.orden.map(id => guardada.jugadores[id].nombre).join(', ')})
                        </Boton>
                    )}
                    <div>
                        <div style={etq}>{t.idioma}</div>
                        <Opciones color={T.ambar} valor={idioma} onChange={setIdioma} opciones={CODIGOS_IDIOMA.map(l => [l, `${IDIOMAS_PALABRAS[l].bandera} ${l.toUpperCase()}`])} />
                    </div>
                    <div><div style={etq}>{t.tiempoTurno}</div><Opciones color={T.ambar} valor={tiempo} onChange={setTiempo} opciones={[[0, t.sinLimite], [60, '1 min'], [90, '1:30'], [120, '2 min'], [180, '3 min']]} /></div>
                    <div>
                        <div style={etq}>{t.jugadores} ({nombresLocal.length}/6)</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {nombresLocal.map((n, i) => (
                                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <span style={{ width: 14, height: 14, borderRadius: '50%', background: COLORES_JUGADOR[i], boxShadow: `0 0 8px ${COLORES_JUGADOR[i]}`, flexShrink: 0 }} />
                                    <input value={n} maxLength={16} placeholder={`${t.jugadorN} ${i + 1}`} onChange={e => setNombresLocal(ns => ns.map((x, j) => j === i ? e.target.value : x))}
                                        style={{ ...inp, borderColor: `${COLORES_JUGADOR[i]}88` }} />
                                    {nombresLocal.length > 2 && <button onClick={() => setNombresLocal(ns => ns.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: T.suave, cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>}
                                </div>
                            ))}
                        </div>
                        {nombresLocal.length < 6 && <Boton onClick={() => setNombresLocal(ns => [...ns, ''])} color={T.suave} style={{ marginTop: 10 }}>{t.anadir}</Boton>}
                    </div>
                    <Boton onClick={empezarLocal} color={T.ambar} relleno grande>{t.jugarLocal}</Boton>
                </Tarjeta>
            )}

            {pestana === 'online' && <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: 860 }}>
                <Tarjeta style={{ flex: '1 1 320px', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ fontWeight: 900, fontSize: '1.1rem', color: T.cian }}>🙋 {t.unirse}</div>
                    <div><div style={etq}>{t.codigo}</div><input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} maxLength={6} placeholder="ABC12" style={{ ...inp, letterSpacing: 4, fontSize: '1.3rem', textAlign: 'center' }} /></div>
                    <div><div style={etq}>{t.tuNombre}</div><input value={nombre} onChange={e => setNombre(e.target.value)} maxLength={16} style={inp} /></div>
                    <Boton onClick={unirse} disabled={ocupado || !codigo.trim()} color={T.cian} relleno grande>{t.entrar}</Boton>
                </Tarjeta>
                <Tarjeta style={{ flex: '1 1 320px', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ fontWeight: 900, fontSize: '1.1rem', color: T.ambar }}>✨ {t.crear}</div>
                    <div>
                        <div style={etq}>{t.idioma}</div>
                        <Opciones color={T.ambar} valor={idioma} onChange={setIdioma} opciones={CODIGOS_IDIOMA.map(l => [l, `${IDIOMAS_PALABRAS[l].bandera} ${l.toUpperCase()}`])} />
                    </div>
                    <div><div style={etq}>{t.tiempoTurno}</div><Opciones color={T.ambar} valor={tiempo} onChange={setTiempo} opciones={[[0, t.sinLimite], [60, '1 min'], [90, '1:30'], [120, '2 min'], [180, '3 min']]} /></div>
                    <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: T.texto, fontSize: '0.88rem', cursor: 'pointer', lineHeight: 1.4 }}>
                        <input type="checkbox" checked={juego} onChange={e => setJuego(e.target.checked)} style={{ width: 18, height: 18, accentColor: T.ambar, marginTop: 2 }} />
                        {t.yoJuego}
                    </label>
                    {juego && <div><div style={etq}>{t.tuNombre}</div><input value={nombre} onChange={e => setNombre(e.target.value)} maxLength={16} style={inp} /></div>}
                    <Boton onClick={crear} disabled={ocupado} color={T.ambar} relleno grande>{t.crearSala}</Boton>
                </Tarjeta>
            </div>}
            {error && <div style={{ color: T.rojo, marginTop: 16, fontWeight: 700 }}>⚠ {error}</div>}
        </Pantalla>
    );
}

// ─── Tablero visual ──────────────────────────────────────────────────────────
function Rejilla({ sala, colocadas, celda, onCelda, seleccionCelda, ultimaCeldas, preview }) {
    const t = tx(sala.idioma);
    const fs = celda * 0.52;
    const pendientes = new Map(colocadas.map(p => [k(p.r, p.c), p]));
    const celdas = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const key = k(r, c);
        const fija = sala.tablero?.[key];
        const pend = pendientes.get(key);
        const pr = PREMIOS[key];
        const ficha = fija || pend;
        const colorJ = fija ? COLORES_JUGADOR[sala.jugadores?.[fija.j]?.color ?? 0] : T.ambar;
        const esUltima = ultimaCeldas.has(key);
        const sel = seleccionCelda === key;
        celdas.push(
            <div key={key + (fija ? '-f' : pend ? '-p' : '')} onClick={() => onCelda(r, c)} className="nl-anim" style={{
                width: celda, height: celda, boxSizing: 'border-box', borderRadius: Math.max(3, celda * 0.14), position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', userSelect: 'none',
                background: ficha ? (pend ? `linear-gradient(160deg, ${T.ambar}55, #2a2140)` : 'linear-gradient(160deg, #fef3c7, #fcd34d)')
                    : pr ? `${COLOR_PREMIO[pr]}${pr.startsWith('T') ? '66' : '40'}` : 'rgba(255,255,255,0.05)',
                border: sel ? `2px solid #fff` : pend ? `2px solid ${T.ambar}` : ficha ? `1px solid ${colorJ}` : '1px solid rgba(255,255,255,0.06)',
                boxShadow: esUltima ? `0 0 10px ${colorJ}` : pend ? `0 0 8px ${T.ambar}88` : 'none',
                borderBottom: fija ? `3px solid ${colorJ}` : undefined,
                animation: ficha ? (pend || esUltima ? 'nlCae .35s ease-out' : undefined) : undefined,
            }}>
                {ficha ? (
                    <>
                        <span style={{ fontWeight: 900, fontSize: ficha.v.length > 1 ? fs * 0.8 : fs, color: pend ? '#fff' : '#1c1917', fontFamily: FUENTE, lineHeight: 1 }}>{ficha.v.toUpperCase()}</span>
                        {celda >= 24 && <span style={{ position: 'absolute', bottom: 1, right: 2, fontSize: Math.max(6, celda * 0.22), fontWeight: 800, color: pend ? T.ambar : '#78350f' }}>{valorDe(sala.idioma, ficha.l)}</span>}
                    </>
                ) : r === CENTRO && c === CENTRO ? (
                    <span style={{ fontSize: fs, color: '#f9a8d4' }}>★</span>
                ) : pr && celda >= 22 ? (
                    <span style={{ fontSize: Math.max(7, celda * 0.26), fontWeight: 800, color: 'rgba(255,255,255,0.75)', fontFamily: FUENTE }}>{t.premio[pr]}</span>
                ) : null}
            </div>
        );
    }
    return (
        <div style={{ position: 'relative' }}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${N}, ${celda}px)`, gap: Math.max(1, celda * 0.06), padding: 6, borderRadius: 14, background: 'rgba(10,9,24,0.85)', border: `1px solid ${T.borde}`, boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
                {celdas}
            </div>
            {preview && (
                <div style={{ position: 'absolute', left: '50%', bottom: -14, transform: 'translateX(-50%)', whiteSpace: 'nowrap', padding: '4px 12px', borderRadius: 20, fontWeight: 800, fontSize: '0.8rem', background: preview.ok ? T.verde : `${T.rojo}dd`, color: preview.ok ? '#052e1c' : '#fff', zIndex: 2 }}>
                    {preview.texto}
                </div>
            )}
        </div>
    );
}

// ─── Partida ─────────────────────────────────────────────────────────────────
// motor: motorOnline(codigo) o motorLocal(estado). En local, «yo» es siempre quien tiene el turno.
function Partida({ motor, codigo, miId: miIdFijo, onMenu }) {
    const { w, h } = useWindowSize();
    const [sala, setSala] = useState(null);
    const [revelado, setRevelado] = useState(null);   // local: nTurno cuyo atril ya se ha destapado
    const [envioDe, setEnvioDe] = useState(null);     // id del jugador que envía al profesor
    const [dicc, setDicc] = useState(null);
    const [colocadas, setColocadas] = useState([]);   // [{ r, c, l, v, i }] i = índice en el atril
    const [selAtril, setSelAtril] = useState(null);
    const [selCelda, setSelCelda] = useState(null);
    const [ordenAtril, setOrdenAtril] = useState(null);
    const [modoCambio, setModoCambio] = useState(false);
    const [marcadas, setMarcadas] = useState(new Set());
    const [aviso, setAviso] = useState(null);
    const [zoom, setZoom] = useState(false);
    const [copiado, setCopiado] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [banner, setBanner] = useState(null);
    const stats = useRef({});   // por jugador: { intentos, fallosTilde }
    const statsDe = (id) => (stats.current[id] ??= { intentos: 0, fallosTilde: [] });
    const ultimaVista = useRef(null);
    const turnoVisto = useRef(null);
    const guardado = useRef(false);
    const local = motor.local;

    useEffect(() => motor.suscribir(setSala), [motor]);

    const idioma = sala?.idioma || 'es';
    const t = tx(idioma);
    const VAR = variantesDe(idioma);
    useEffect(() => {
        if (!sala?.idioma) return;
        let vivo = true;
        cargarDiccionario(sala.idioma).then(cargarLargas).then(d => vivo && setDicc(d)).catch(e => vivo && setAviso({ texto: e.message, ok: false, n: Date.now() }));
        return () => { vivo = false; };
    }, [sala?.idioma]);

    const turnoId = sala?.orden?.[sala.turno];
    const miId = local ? turnoId : miIdFijo;
    const yo = sala?.jugadores?.[miId];
    const juego = !!yo;
    const atril = useMemo(() => sala?.atriles?.[miId] || [], [sala, miId]);
    const miTurno = sala?.estado === 'jugando' && turnoId === miId;
    const esAnfitrion = local || sala?.anfitrion === miId;
    // Local: mientras no se destapa el turno, las letras quedan tapadas para que nadie las vea.
    const tapado = local && sala?.estado === 'jugando' && revelado !== sala.nTurno;

    // Orden visual del atril (se puede mezclar); se reajusta cuando cambian las letras o el turno.
    const firmaAtril = atril.join('') + (local ? `#${sala?.nTurno}` : '');
    useEffect(() => { setOrdenAtril(atril.map((_, i) => i)); setColocadas([]); setMarcadas(new Set()); setModoCambio(false); setSelAtril(null); setSelCelda(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [firmaAtril]);
    const destapar = () => {
        despertarAudio();
        setRevelado(sala.nTurno);
        sonidoTurno();
        const nT = sala.nTurno;
        motor.transaccion(d => (d.config?.tiempoTurno && d.nTurno === nT && !d.finTurno) ? { finTurno: Date.now() + d.config.tiempoTurno * 1000 } : null);
    };
    // Si otro jugador ocupa una casilla donde tenía fichas pendientes, se devuelven al atril.
    useEffect(() => { if (sala?.tablero) setColocadas(cs => cs.filter(p => !sala.tablero[k(p.r, p.c)])); }, [sala?.tablero]);

    // Avisos: tu turno y jugadas de los demás.
    useEffect(() => {
        if (!sala || sala.estado !== 'jugando') return;
        const clave = `${sala.nTurno}`;
        if (turnoVisto.current === clave) return;
        turnoVisto.current = clave;
        if (miTurno && !local) { sonidoTurno(); try { navigator.vibrate?.(150); } catch { /* sin vibración */ } setBanner({ texto: t.tuTurno, n: Date.now(), color: COLORES_JUGADOR[yo?.color ?? 0] }); }
    }, [sala, miTurno, t, yo, local]);
    useEffect(() => {
        const u = sala?.ultima;
        if (!u || ultimaVista.current === u.n) return;
        const primera = ultimaVista.current === null;
        ultimaVista.current = u.n;
        if (primera || u.tipo !== 'jugada') return;
        const c = COLORES_JUGADOR[sala.jugadores?.[u.j]?.color ?? 0];
        sonidoPalabra(u.palabras?.[0]?.forma?.length || 4);
        lanzarLetras(window.innerWidth / 2, window.innerHeight * 0.45, u.palabras?.[0]?.forma || '', c);
        if (u.bingo) setBanner({ texto: t.bingo, n: Date.now(), color: T.ambar });
    }, [sala, t]);
    // Al acabar: registro local (online, el mío; en local, el de cada jugador).
    const datosDe = (id) => {
        const j = sala.jugadores[id];
        const s = statsDe(id);
        const intentos = Math.max(s.intentos, j.jugadas || 0);
        return { j, intentos, porcentaje: Math.round(((j.jugadas || 0) / Math.max(1, intentos)) * 100) };
    };
    useEffect(() => {
        if (sala?.estado !== 'fin' || guardado.current) return;
        const ids = local ? sala.orden : (yo ? [miIdFijo] : []);
        if (!ids.length) return;
        guardado.current = true;
        sonidoFinal();
        for (const id of ids) {
            const { j, intentos, porcentaje } = datosDe(id);
            guardarRegistroLocal('VANILA', {
                titulo: `VaniLa · Tablero${local ? ' (mismo dispositivo)' : ''} ${IDIOMAS_PALABRAS[idioma].nombre} · ${j.puntos} pts`,
                aciertos: j.jugadas || 0, intentos, porcentaje, nombre: j.nombre, via: 'juego',
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sala?.estado, yo, idioma, local]);

    // Tiempo de turno: cualquiera que vea el turno caducado lo pasa (la transacción evita duplicados).
    const [ahora, setAhora] = useState(Date.now());
    useEffect(() => { const iv = setInterval(() => setAhora(Date.now()), 500); return () => clearInterval(iv); }, []);
    useEffect(() => {
        if (sala?.estado !== 'jugando' || !sala.finTurno || ahora < sala.finTurno + 1500) return;
        const nT = sala.nTurno;
        motor.transaccion((d) => {
            if (d.estado !== 'jugando' || d.nTurno !== nT || !d.finTurno || Date.now() < d.finTurno + 1000) return null;
            const quien = d.orden[d.turno];
            const upd = { ...siguienteTurno(d), pases: (d.pases || 0) + 1, ultima: { tipo: 'tiempo', j: quien, n: Date.now() }, historial: conHistorial(d, { tipo: 'tiempo', j: quien }) };
            if (upd.pases >= 2 * d.orden.length) cierre(d, upd, d.atriles, Object.fromEntries(d.orden.map(id => [id, d.jugadores[id].puntos])), null);
            return upd;
        }).catch(() => { /* otro cliente ya lo pasó */ });
    }, [ahora, sala, motor]);

    const avisar = (texto, ok) => setAviso({ texto, ok, n: Date.now() });
    const motivoTexto = (r) => {
        if (r.motivo === 'noexiste') return t.m.noexiste(r.palabra.toUpperCase());
        if (r.motivo === 'tilde') return t.m.tilde(r.palabra.toUpperCase());
        return t.m[r.motivo] || '✖';
    };

    // Vista previa de la jugada mientras se colocan fichas
    const preview = useMemo(() => {
        if (!dicc || !sala || !colocadas.length) return null;
        const r = evaluarJugada(sala.tablero || {}, colocadas, dicc);
        return r.ok ? { ok: true, texto: t.m.valida(r.total), total: r.total } : { ok: false, texto: motivoTexto(r) };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dicc, sala?.tablero, colocadas, t]);

    // ─── Acciones ───
    const usadosAtril = new Set(colocadas.map(p => p.i));
    const pulsarAtril = (i) => {
        if (modoCambio) { setMarcadas(m => { const n = new Set(m); n.has(i) ? n.delete(i) : n.add(i); return n; }); blip(700, { dur: 0.05 }); return; }
        if (usadosAtril.has(i)) return;
        setSelAtril(s => s === i ? null : i);
        setSelCelda(null);
        blip(600, { dur: 0.05, vol: 0.05 });
    };
    const pulsarCelda = (r, c) => {
        if (!juego || sala.estado !== 'jugando' || modoCambio) return;
        const key = k(r, c);
        if (sala.tablero?.[key]) return;
        const pend = colocadas.find(p => p.r === r && p.c === c);
        if (pend) {
            // 1.º toque: seleccionar · 2.º toque: devolver al atril
            if (selCelda === key) { setColocadas(cs => cs.filter(p => p !== pend)); setSelCelda(null); blip(300, { dur: 0.06 }); }
            else { setSelCelda(key); setSelAtril(null); }
            return;
        }
        let i = selAtril;
        if (i == null) i = (ordenAtril || []).find(x => !usadosAtril.has(x));   // sin selección: la primera libre
        if (i == null) return;
        const l = atril[i];
        setColocadas(cs => [...cs, { r, c, l, v: l, i }]);
        setSelAtril(null);
        setSelCelda(key);
        blip(520 + colocadas.length * 40, { dur: 0.07, tipo: 'square', vol: 0.035 });
    };
    const cambiarVariante = () => {
        const objetivo = selCelda ? colocadas.find(p => k(p.r, p.c) === selCelda) : colocadas[colocadas.length - 1];
        if (!objetivo || !VAR[objetivo.l]) return;
        const vs = VAR[objetivo.l];
        setColocadas(cs => cs.map(p => p === objetivo ? { ...p, v: vs[(vs.indexOf(p.v) + 1) % vs.length] } : p));
        blip(900, { dur: 0.06, vol: 0.05 });
    };
    const recoger = () => { setColocadas([]); setSelCelda(null); };
    const mezclar = () => { setOrdenAtril(o => barajar(o || [])); blip(240, { dur: 0.18, tipo: 'sine', vol: 0.05, freqFin: 520 }); };

    const jugar = async () => {
        if (!miTurno || !dicc || !colocadas.length || enviando) return;
        const st = statsDe(miId);
        st.intentos++;
        const r = evaluarJugada(sala.tablero || {}, colocadas, dicc);
        if (!r.ok) {
            if (r.motivo === 'tilde') st.fallosTilde.push({ escrita: r.palabra, correcta: r.correctas.join(' / ') });
            avisar(motivoTexto(r), false); sonidoIncorrecto(); return;
        }
        setEnviando(true);
        try {
            await motor.transaccion((d) => {
                if (d.estado !== 'jugando' || d.orden[d.turno] !== miId) throw new Error(t.m.noTurno);
                const mio = [...(d.atriles[miId] || [])];
                for (const p of colocadas) {
                    if (d.tablero?.[k(p.r, p.c)]) throw new Error('✖');
                    const i = mio.indexOf(p.l);
                    if (i < 0) throw new Error('✖');
                    mio.splice(i, 1);
                }
                const ev = evaluarJugada(d.tablero || {}, colocadas, dicc);
                if (!ev.ok) throw new Error(motivoTexto(ev));
                const bolsa = [...(d.bolsa || [])];
                mio.push(...bolsa.splice(0, ATRIL - mio.length));
                const principal = ev.palabras.find(x => x.principal)?.forma || '';
                const upd = {
                    bolsa, [`atriles.${miId}`]: mio, pases: 0, ...siguienteTurno(d),
                    [`jugadores.${miId}.jugadas`]: (d.jugadores[miId].jugadas || 0) + 1,
                    [`jugadores.${miId}.palabras`]: [...(d.jugadores[miId].palabras || []), ...ev.palabras.map(x => x.forma)].slice(-60),
                    ultima: { tipo: 'jugada', j: miId, celdas: colocadas.map(p => k(p.r, p.c)), palabras: ev.palabras, pts: ev.total, bingo: ev.bingo, n: Date.now() },
                    historial: conHistorial(d, { tipo: 'jugada', j: miId, w: principal, p: ev.total }),
                };
                for (const p of colocadas) upd[`tablero.${k(p.r, p.c)}`] = { l: p.l, v: p.v, j: miId };
                const puntos = Object.fromEntries(d.orden.map(id => [id, d.jugadores[id].puntos]));
                puntos[miId] += ev.total;
                upd[`jugadores.${miId}.puntos`] = puntos[miId];
                if (!bolsa.length && !mio.length) cierre(d, upd, { ...d.atriles, [miId]: [] }, puntos, miId);
                return upd;
            });
            sonidoCorrecto();
            setColocadas([]); setSelCelda(null);
        } catch (e) { avisar(e.message, false); sonidoIncorrecto(); }
        setEnviando(false);
    };

    const pasarOCambiar = async (cambio) => {
        if (!miTurno || enviando) return;
        setEnviando(true);
        try {
            await motor.transaccion((d) => {
                if (d.estado !== 'jugando' || d.orden[d.turno] !== miId) throw new Error(t.m.noTurno);
                const upd = { ...siguienteTurno(d), pases: (d.pases || 0) + 1 };
                if (cambio) {
                    const mio = [...d.atriles[miId]];
                    const fuera = [...marcadas].sort((a, b) => b - a).map(i => mio.splice(i, 1)[0]);
                    const bolsa = [...d.bolsa];
                    if (bolsa.length < fuera.length) throw new Error('🎒 0');
                    mio.push(...bolsa.splice(0, fuera.length));
                    upd.bolsa = barajar([...bolsa, ...fuera]);
                    upd[`atriles.${miId}`] = mio;
                }
                upd.ultima = { tipo: cambio ? 'cambio' : 'pase', j: miId, n: Date.now() };
                upd.historial = conHistorial(d, { tipo: cambio ? 'cambio' : 'pase', j: miId });
                if (upd.pases >= 2 * d.orden.length) cierre(d, upd, upd[`atriles.${miId}`] ? { ...d.atriles, [miId]: upd[`atriles.${miId}`] } : d.atriles, Object.fromEntries(d.orden.map(id => [id, d.jugadores[id].puntos])), null);
                return upd;
            });
            setModoCambio(false); setMarcadas(new Set()); setColocadas([]);
        } catch (e) { avisar(e.message, false); }
        setEnviando(false);
    };

    const empezar = async () => {
        await motor.transaccion((d) => {
            if (d.estado !== 'esperando') return null;
            const ids = barajar(Object.keys(d.jugadores || {}));
            if (!ids.length) return null;
            const bolsa = crearBolsa(d.idioma, ids.length);
            const atriles = {};
            ids.forEach(id => { atriles[id] = bolsa.splice(0, ATRIL); });
            return { estado: 'jugando', orden: ids, turno: 0, nTurno: 1, bolsa, atriles, pases: 0, finTurno: d.config?.tiempoTurno ? Date.now() + d.config.tiempoTurno * 1000 : null };
        });
    };
    const terminar = async () => {
        await motor.transaccion((d) => {
            if (d.estado !== 'jugando') return null;
            const upd = {};
            cierre(d, upd, d.atriles, Object.fromEntries(d.orden.map(id => [id, d.jugadores[id].puntos])), null);
            return upd;
        });
    };

    // Atajos de teclado: Enter jugar, Esc recoger, ' tilde.
    useEffect(() => {
        const onKey = (e) => {
            if (e.target?.tagName === 'INPUT' || tapado) return;
            if (e.key === 'Enter') { e.preventDefault(); jugar(); }
            else if (e.key === 'Escape') recoger();
            else if (e.key === "'" || e.key === '´') cambiarVariante();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    if (!sala) return <Pantalla><div style={{ color: T.suave }}>…</div></Pantalla>;
    if (sala.borrada) return <Pantalla><div style={{ color: T.rojo, marginBottom: 16 }}>⚠ {t.noexiste}</div><Boton onClick={onMenu}>{t.menu}</Boton></Pantalla>;

    const jugadoresOrden = (sala.orden?.length ? sala.orden : Object.keys(sala.jugadores || {})).filter(id => sala.jugadores?.[id]);
    const ancho = w >= 1000;
    const espacioTablero = ancho ? Math.min(w - 32 - 340 - 24, h - (juego ? 190 : 90)) : w - 24;
    const celdaBase = Math.max(18, Math.floor((espacioTablero - 12) / N - 1));
    const celda = zoom && !ancho ? Math.max(celdaBase, 34) : celdaBase;
    const ultimaCeldas = new Set(sala.ultima?.tipo === 'jugada' ? sala.ultima.celdas || [] : []);
    const restante = sala.finTurno ? Math.max(0, (sala.finTurno - ahora) / 1000) : null;
    const tamFicha = Math.max(30, Math.min(54, Math.floor((Math.min(w, 620) - 32 - 8 * 6) / ATRIL)));
    const nombreDe = (id) => sala.jugadores?.[id]?.nombre || '?';
    const colorDe = (id) => COLORES_JUGADOR[sala.jugadores?.[id]?.color ?? 0];
    const ganadorId = sala.estado === 'fin' ? jugadoresOrden.reduce((m, id) => (!m || sala.jugadores[id].puntos > sala.jugadores[m].puntos ? id : m), null) : null;
    const textoHist = (hh) => hh.tipo === 'jugada' ? t.hist.jugada(nombreDe(hh.j), (hh.w || '').toUpperCase(), hh.p) : hh.tipo === 'entra' ? t.hist.entra(hh.nombre || nombreDe(hh.j)) : t.hist[hh.tipo]?.(nombreDe(hh.j)) || '';

    // ─── Sala de espera ───
    if (sala.estado === 'esperando') {
        const url = urlSala(codigo);
        return (
            <Pantalla>
                <div style={{ position: 'fixed', top: 14, left: 14 }}><Boton onClick={onMenu} color={T.suave}>{t.salir}</Boton></div>
                <Tarjeta style={{ maxWidth: 720, width: '100%', boxSizing: 'border-box', display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                        <img src={qrDe(url, 220)} alt="QR" width={200} height={200} style={{ borderRadius: 14, background: '#fff' }} />
                        <div style={{ color: T.suave, fontSize: '0.8rem', marginTop: 8 }}>{t.compartir}</div>
                        <div style={{ fontWeight: 800, fontSize: '0.85rem', wordBreak: 'break-all', maxWidth: 220 }}>{url.replace(/^https?:\/\//, '')}</div>
                        <Boton onClick={() => { navigator.clipboard?.writeText(url).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1500); }).catch(() => window.prompt('', url)); }} color={T.suave} style={{ marginTop: 8 }}>{copiado ? t.copiado : t.copiar}</Boton>
                    </div>
                    <div style={{ flex: 1, minWidth: 240, textAlign: 'center' }}>
                        <div style={{ color: T.suave, fontWeight: 800, letterSpacing: 2, fontSize: '0.8rem' }}>{t.codigo.toUpperCase()} · {IDIOMAS_PALABRAS[idioma].bandera}</div>
                        <div style={{ fontSize: '3.4rem', fontWeight: 900, letterSpacing: 8, color: T.ambar, textShadow: `0 0 24px ${T.ambar}` }}>{codigo}</div>
                        <div style={{ color: T.suave, margin: '10px 0' }}>{t.esperando} ({jugadoresOrden.length}/6)</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 18 }}>
                            {jugadoresOrden.map(id => (
                                <span key={id} className="nl-anim" style={{ padding: '6px 14px', borderRadius: 20, fontWeight: 800, border: `2px solid ${colorDe(id)}`, color: colorDe(id), animation: 'nlPop .3s ease-out' }}>
                                    {nombreDe(id)}{id === miId ? ' ⭐' : ''}
                                </span>
                            ))}
                        </div>
                        {esAnfitrion
                            ? <Boton onClick={empezar} disabled={!jugadoresOrden.length} color={T.verde} relleno grande>{t.empezar}</Boton>
                            : <div style={{ color: T.cian, fontWeight: 700, animation: 'nlParpadeo 1.6s infinite' }}>{t.esperaAnfitrion}</div>}
                    </div>
                </Tarjeta>
            </Pantalla>
        );
    }

    // ─── Marcador ───
    const marcador = (
        <Tarjeta style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ color: T.suave, fontWeight: 800, fontSize: '0.75rem', letterSpacing: 1 }}>{t.jugadores.toUpperCase()}</span>
                <span style={{ color: T.suave, fontSize: '0.8rem', fontWeight: 700 }}>{t.bolsa(sala.bolsa?.length || 0)}</span>
            </div>
            {jugadoresOrden.map(id => {
                const j = sala.jugadores[id];
                const activo = sala.estado === 'jugando' && turnoId === id;
                return (
                    <div key={id} style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 12, marginBottom: 4,
                        background: activo ? `${colorDe(id)}22` : 'transparent', border: `1.5px solid ${activo ? colorDe(id) : 'transparent'}`,
                    }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: colorDe(id), boxShadow: `0 0 8px ${colorDe(id)}`, animation: activo ? 'nlParpadeo 1s infinite' : undefined }} />
                        <span style={{ flex: 1, fontWeight: 800, color: activo ? colorDe(id) : T.texto, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ganadorId === id ? '🏆 ' : ''}{j.nombre}{!local && id === miId ? ' ⭐' : ''}
                        </span>
                        <span style={{ fontWeight: 900, fontSize: '1.1rem', color: colorDe(id) }}>{j.puntos}</span>
                    </div>
                );
            })}
            {(sala.historial || []).length > 0 && (
                <div style={{ marginTop: 10, borderTop: `1px solid ${T.borde}`, paddingTop: 8, maxHeight: ancho ? 200 : 90, overflowY: 'auto' }}>
                    {[...sala.historial].reverse().slice(0, 12).map((hh, i) => (
                        <div key={hh.t + '-' + i} style={{ fontSize: '0.78rem', color: i ? T.suave : T.texto, padding: '2px 0' }}>
                            <span style={{ color: colorDe(hh.j) }}>●</span> {textoHist(hh)}
                        </div>
                    ))}
                </div>
            )}
            {!juego && sala.estado === 'jugando' && (
                <div style={{ marginTop: 12, textAlign: 'center' }}>
                    <img src={qrDe(urlSala(codigo), 140)} alt="QR" width={110} height={110} style={{ borderRadius: 10, background: '#fff' }} />
                    <div style={{ fontWeight: 900, letterSpacing: 4, color: T.ambar }}>{codigo}</div>
                </div>
            )}
            {esAnfitrion && sala.estado === 'jugando' && (
                <div style={{ marginTop: 10, textAlign: 'center' }}><button onClick={() => window.confirm(`${t.terminar}?`) && terminar()} style={{ background: 'none', border: 'none', color: T.suave, textDecoration: 'underline', cursor: 'pointer', fontSize: '0.78rem' }}>{t.terminar}</button></div>
            )}
        </Tarjeta>
    );

    // ─── Atril y controles ───
    const controles = juego && sala.estado === 'jugando' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: '100%' }}>
            {modoCambio && <div style={{ color: T.ambar, fontWeight: 700, fontSize: '0.88rem' }}>{t.marcaCambio}</div>}
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', padding: '10px 12px', borderRadius: 18, background: 'rgba(120,53,15,0.35)', border: `1px solid ${T.ambar}44` }}>
                {(ordenAtril || []).filter(i => i < atril.length).map(i => (
                    <Ficha key={firmaAtril + '-' + i} ch={atril[i]} idioma={idioma} tam={tamFicha} valor={valorDe(idioma, atril[i])}
                        usada={!modoCambio && usadosAtril.has(i)} seleccionada={modoCambio ? marcadas.has(i) : selAtril === i}
                        retraso={i * 0.06} onClick={() => pulsarAtril(i)} />
                ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {modoCambio ? (
                    <>
                        <Boton onClick={() => { setModoCambio(false); setMarcadas(new Set()); }} color={T.suave}>{t.cancelar}</Boton>
                        <Boton onClick={() => pasarOCambiar(true)} disabled={!miTurno || !marcadas.size || enviando || (sala.bolsa?.length || 0) < marcadas.size} color={T.ambar} relleno>{t.confirmarCambio(marcadas.size)}</Boton>
                    </>
                ) : (
                    <>
                        <Boton onClick={mezclar} color={T.lila}>{t.mezclar}</Boton>
                        <Boton onClick={recoger} disabled={!colocadas.length} color={T.suave}>{t.recoger}</Boton>
                        {Object.keys(VAR).length > 0 && <Boton onClick={cambiarVariante} disabled={!colocadas.some(p => VAR[p.l])} color={T.ambar}>{t.tilde}</Boton>}
                        <Boton onClick={() => pasarOCambiar(false)} disabled={!miTurno || enviando} color={T.suave}>{t.pasar}</Boton>
                        <Boton onClick={() => { setColocadas([]); setModoCambio(true); }} disabled={!miTurno || enviando || !(sala.bolsa?.length)} color={T.suave}>{t.cambiar}</Boton>
                        <Boton onClick={jugar} disabled={!miTurno || !colocadas.length || enviando || !dicc} color={COLORES_JUGADOR[yo.color ?? 0]} relleno>
                            {t.jugar(preview?.ok ? preview.total : null)}
                        </Boton>
                    </>
                )}
            </div>
        </div>
    );

    const cabeceraTurno = sala.estado === 'jugando' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
            <span style={{ fontWeight: 900, fontSize: '1.05rem', color: colorDe(turnoId), animation: miTurno ? 'nlLatido 1s infinite' : undefined }} className="nl-anim">
                {local ? t.turnoDe(nombreDe(turnoId)) : miTurno ? t.tuTurno : t.turnoDe(nombreDe(turnoId))}
            </span>
            {restante != null && <Reloj restante={restante} total={sala.config.tiempoTurno} tam={44} />}
        </div>
    );

    return (
        <Pantalla centrar={false}>
            <Cabecera
                izquierda={<Boton onClick={onMenu} color={T.suave}>{t.salir}</Boton>}
                centro={<div style={{ fontWeight: 900, letterSpacing: 2, color: T.suave, fontSize: '0.82rem' }}>🧩 {local ? '📱' : codigo} · {IDIOMAS_PALABRAS[idioma].bandera}</div>}
                derecha={!ancho && <Boton onClick={() => setZoom(z => !z)} color={T.suave}>{zoom ? '🔍−' : '🔍+'}</Boton>}
            />
            {!dicc && <div style={{ color: T.suave, marginBottom: 8 }}>{t.cargandoDicc}</div>}
            <div style={{ display: 'flex', flexDirection: ancho ? 'row' : 'column', gap: 18, alignItems: ancho ? 'flex-start' : 'center', justifyContent: 'center', width: '100%' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, maxWidth: '100%' }}>
                    {cabeceraTurno}
                    <div style={{ maxWidth: '100%', overflowX: 'auto', padding: '2px 2px 16px' }}>
                        <Rejilla sala={sala} colocadas={colocadas} celda={celda} onCelda={pulsarCelda} seleccionCelda={selCelda} ultimaCeldas={ultimaCeldas} preview={preview} />
                    </div>
                    {aviso && <div key={aviso.n} className="nl-anim" style={{ padding: '5px 14px', borderRadius: 20, fontWeight: 800, fontSize: '0.88rem', background: aviso.ok ? T.verde : `${T.rojo}cc`, color: aviso.ok ? '#052e1c' : '#fff', animation: 'nlPop .25s ease-out' }}>{aviso.texto}</div>}
                    {controles}
                </div>
                <div style={{ width: ancho ? 340 : Math.min(w - 24, 520) }}>{marcador}</div>
            </div>

            {banner && (
                <div key={banner.n} className="nl-anim" style={{
                    position: 'fixed', left: '50%', top: '40%', zIndex: 200, pointerEvents: 'none', padding: '16px 34px', borderRadius: 20,
                    fontWeight: 900, fontSize: 'clamp(1.3rem, 4vw, 2.2rem)', color: '#0A0918', background: banner.color, boxShadow: `0 0 50px ${banner.color}`,
                    animation: 'nlBanner 1.6s ease-out forwards', whiteSpace: 'nowrap',
                }}>{banner.texto}</div>
            )}

            {sala.estado === 'fin' && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 250, background: 'rgba(5,4,15,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                    <Tarjeta style={{ maxWidth: 460, width: '100%', textAlign: 'center', border: `2px solid ${colorDe(ganadorId)}`, boxShadow: `0 0 60px ${colorDe(ganadorId)}66`, animation: 'nlPop .4s ease-out' }}>
                        <div style={{ fontSize: '2.6rem' }}>🏆</div>
                        <div style={{ color: T.suave, fontWeight: 800, letterSpacing: 1 }}>{t.fin}</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 900, color: colorDe(ganadorId), margin: '6px 0 16px' }}>{t.gana(nombreDe(ganadorId))}</div>
                        {[...jugadoresOrden].sort((a, b) => sala.jugadores[b].puntos - sala.jugadores[a].puntos).map((id, pos) => (
                            <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 10, background: !local && id === miId ? 'rgba(255,255,255,0.06)' : 'transparent' }}>
                                <span style={{ flex: 1, textAlign: 'left', fontWeight: 800, color: colorDe(id) }}>{pos + 1}. {nombreDe(id)}</span>
                                <span style={{ fontWeight: 900 }}>{sala.jugadores[id].puntos}</span>
                                {local && <button title={t.enviarProfe} onClick={() => setEnvioDe(id)} style={{ background: 'none', border: `1px solid ${T.ambar}`, borderRadius: 8, color: T.ambar, cursor: 'pointer', padding: '2px 8px' }}>📤</button>}
                            </div>
                        ))}
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18, flexWrap: 'wrap' }}>
                            {!local && juego && <Boton onClick={() => setEnvioDe(miIdFijo)} color={T.ambar} relleno>{t.enviarProfe}</Boton>}
                            <Boton onClick={onMenu} color={T.suave}>{t.menu}</Boton>
                        </div>
                    </Tarjeta>
                </div>
            )}

            {envioDe && sala.jugadores?.[envioDe] && (() => {
                const { j, intentos } = datosDe(envioDe);
                return (
                    <ModalEnviarProfe key={envioDe} idioma={idioma} onClose={() => setEnvioDe(null)} datos={{
                        nombre: j.nombre, modalidad: 'Tablero', modo: `Tablero ${local ? 'mismo dispositivo' : 'online'} (${jugadoresOrden.length} jugadores)`, idioma,
                        aciertos: j.jugadas || 0, intentos, puntos: j.puntos,
                        palabras: j.palabras || [], fallosTilde: statsDe(envioDe).fallosTilde,
                        masLarga: (j.palabras || []).reduce((m, x) => x.length > m.length ? x : m, ''),
                    }} />
                );
            })()}

            {/* Mismo dispositivo: pantalla de paso de turno (tapa las letras del siguiente jugador) */}
            {tapado && (() => {
                const c = colorDe(turnoId);
                const ult = (sala.historial || []).filter(x => x.tipo !== 'entra').slice(-1)[0];
                return (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: `radial-gradient(circle at 50% 30%, ${c}33, #0A0918 70%)`, backdropFilter: 'blur(14px)' }}>
                        <div style={{ position: 'fixed', top: 14, left: 14 }}><Boton onClick={onMenu} color={T.suave}>{t.salir}</Boton></div>
                        <div className="nl-anim" style={{ textAlign: 'center', maxWidth: 460, animation: 'nlPop .35s ease-out' }}>
                            <div style={{ fontSize: '3rem' }}>📱</div>
                            <div style={{ fontSize: 'clamp(1.6rem, 6vw, 2.4rem)', fontWeight: 900, color: c, textShadow: `0 0 22px ${c}` }}>{t.turnoDe(nombreDe(turnoId))}</div>
                            <div style={{ color: T.texto, margin: '14px 0 6px', fontSize: '1.02rem' }}>{t.pasaDispositivo}</div>
                            {ult && <div style={{ color: T.suave, fontSize: '0.9rem', margin: '10px 0' }}>{t.ultima}: <span style={{ color: colorDe(ult.j), fontWeight: 800 }}>{textoHist(ult)}</span></div>}
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', margin: '14px 0 22px' }}>
                                {jugadoresOrden.map(id => <span key={id} style={{ padding: '4px 12px', borderRadius: 20, border: `1.5px solid ${colorDe(id)}`, color: colorDe(id), fontWeight: 800, fontSize: '0.85rem' }}>{nombreDe(id)} · {sala.jugadores[id].puntos}</span>)}
                            </div>
                            <Boton onClick={destapar} color={c} relleno grande>{t.verFichas}</Boton>
                            {sala.config?.tiempoTurno ? <div style={{ color: T.suave, fontSize: '0.8rem', marginTop: 10 }}>⏱️ {sala.config.tiempoTurno} s</div> : null}
                        </div>
                    </div>
                );
            })()}
        </Pantalla>
    );
}

// ─── Raíz del modo tablero ───────────────────────────────────────────────────
export default function TableroOnline({ idiomaInicial = 'es', codigoInicial = null, onMenu }) {
    const miId = useMemo(miIdentificador, []);
    const [motorL, setMotorL] = useState(null);   // partida en este dispositivo
    // Se vuelve a la sala guardada (al recargar), salvo que un enlace apunte a otra distinta.
    const [codigo, setCodigo] = useState(() => {
        let guardada = null;
        try { guardada = sessionStorage.getItem('pikt_vanila_sala'); } catch { /* sin almacenamiento */ }
        if (codigoInicial && guardada !== codigoInicial.toUpperCase()) return null;
        return guardada;
    });
    const entrar = useCallback((c) => { setCodigo(c); try { sessionStorage.setItem('pikt_vanila_sala', c); } catch { /* sin almacenamiento */ } }, []);
    const salir = () => {
        try { sessionStorage.removeItem('pikt_vanila_sala'); } catch { /* sin almacenamiento */ }
        if (window.location.search.includes('tablero=')) window.history.replaceState({}, '', window.location.pathname);
        onMenu();
    };
    const motorO = useMemo(() => codigo ? motorOnline(codigo) : null, [codigo]);
    if (motorL) return <Partida motor={motorL} onMenu={salir} />;
    if (!codigo) return <Entrada idiomaInicial={idiomaInicial} codigoInicial={codigoInicial} miId={miId} onDentro={entrar} onMenu={salir}
        onLocal={(estado) => setMotorL(motorLocal(estado))} />;
    return <Partida motor={motorO} codigo={codigo} miId={miId} onMenu={salir} />;
}
