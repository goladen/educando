import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { infoPrueba, pick } from './bancoEscape';
import { NARRACION, urlNarracion, narracionSala } from './narracion';

// Piezas comunes del escape room (modo online y modo pizarra): sonido, estilos, ambiente, zombi 2D, barras, mapa y tarjeta de pregunta.

export const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

// =====================================================================
//  SONIDO (Web Audio sintetizado + narrador grabado)
//  Todos los efectos pasan por una reverberación de «cripta» común (impulso sintético).
//  El narrador reproduce public/audio/escape/<id>.mp3 (ver narracion.js) con voz más grave,
//  reverberación y eco, y baja la música mientras habla.
// =====================================================================
// Intensidad del efecto tenebroso de la voz: 1 = voz neutra (Edge) muy procesada;
// bájalo (p. ej. 0.35) si sustituyes los mp3 por una voz que ya suena terrorífica (ElevenLabs…).
export const PROCESADO_VOZ = 1;

export function crearAudio() {
    let ctx = null, fx = null;
    const a = { activo: true };
    const c = () => {
        if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
        if (ctx.state === 'suspended') ctx.resume().catch(() => { });
        return ctx;
    };
    const impulso = (x, seg, caida) => {
        const n = Math.floor(x.sampleRate * seg), buf = x.createBuffer(2, n, x.sampleRate);
        for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, caida); }
        return buf;
    };
    // Salida de efectos: seco + reverberación
    const salida = () => {
        const x = c(); if (!x) return null;
        if (!fx) {
            const seco = x.createGain(); seco.gain.value = 0.9; seco.connect(x.destination);
            const rev = x.createConvolver(); rev.buffer = impulso(x, 2.8, 2.6);
            const humedo = x.createGain(); humedo.gain.value = 0.32;
            rev.connect(humedo).connect(x.destination);
            const entrada = x.createGain(); entrada.connect(seco); entrada.connect(rev);
            fx = { entrada, x };
        }
        return fx.entrada;
    };
    const distorsion = (x, k = 30) => {
        const w = x.createWaveShaper(), n = 1024, curva = new Float32Array(n);
        for (let i = 0; i < n; i++) { const v = (i * 2) / n - 1; curva[i] = ((1 + k) * v) / (1 + k * Math.abs(v)); }
        w.curve = curva; return w;
    };
    const ruidoBuf = (x, dur) => {
        const buf = x.createBuffer(1, Math.floor(x.sampleRate * dur), x.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        return buf;
    };
    const tono = (f, dur, { tipo = 'sine', vol = 0.15, desde = 0, hasta = null, ataque = 0.005, vibrato = 0 } = {}) => {
        if (!a.activo) return; const out = salida(); if (!out) return; const x = ctx;
        const o = x.createOscillator(), g = x.createGain(), t = x.currentTime + desde;
        o.type = tipo; o.frequency.setValueAtTime(f, t);
        if (hasta) o.frequency.exponentialRampToValueAtTime(hasta, t + dur);
        if (vibrato) { const l = x.createOscillator(), lg = x.createGain(); l.frequency.value = 6; lg.gain.value = vibrato; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur + 0.1); }
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + ataque); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
    };
    const ruido = (dur, { vol = 0.25, frec = 800, tipo = 'lowpass', q = 1, desde = 0, ataque = 0.005, barrido = null } = {}) => {
        if (!a.activo) return; const out = salida(); if (!out) return; const x = ctx;
        const s = x.createBufferSource(), f = x.createBiquadFilter(), g = x.createGain(), t = x.currentTime + desde;
        f.type = tipo; f.Q.value = q; f.frequency.setValueAtTime(frec, t);
        if (barrido) f.frequency.exponentialRampToValueAtTime(barrido, t + dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + ataque); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.buffer = ruidoBuf(x, dur); s.connect(f).connect(g).connect(out); s.start(t);
    };
    // Campana de iglesia: parciales inarmónicos con caída larga
    const campanada = (f, desde, vol = 0.12) => [[1, 1], [2.0, 0.55], [2.76, 0.4], [5.4, 0.22], [8.93, 0.12]]
        .forEach(([m, v], i) => tono(f * m, 3.2 - i * 0.45, { vol: vol * v, desde, ataque: 0.004 }));

    a.desbloquear = () => c();
    // Acierto: celesta fantasmal (tercera menor aguda con brillo)
    a.acierto = () => { tono(1046, 0.5, { tipo: 'sine', vol: 0.09 }); tono(1244, 0.6, { tipo: 'sine', vol: 0.07, desde: 0.07 }); tono(2489, 0.4, { tipo: 'sine', vol: 0.02, desde: 0.07 }); };
    // Fallo: lamento de fantasma que cae, con vibrato
    a.fallo = () => { tono(620, 1.1, { tipo: 'sine', vol: 0.09, hasta: 260, ataque: 0.12, vibrato: 18 }); tono(655, 1.0, { tipo: 'triangle', vol: 0.04, hasta: 240, ataque: 0.12, vibrato: 22 }); ruido(0.9, { vol: 0.05, frec: 1800, tipo: 'bandpass', q: 4, barrido: 500, ataque: 0.1 }); };
    // Golpe al zombi: puñetazo + chapoteo
    a.golpe = () => { tono(130, 0.22, { vol: 0.35, hasta: 38 }); ruido(0.09, { vol: 0.4, frec: 2400, tipo: 'bandpass', q: 1.2 }); ruido(0.18, { vol: 0.12, frec: 700, tipo: 'bandpass', q: 6, barrido: 250, desde: 0.03 }); };
    // Puerta: bisagra oxidada que chirría a tirones (stick-slip) y golpe seco de madera
    a.puerta = () => {
        if (!a.activo) return; const out = salida(); if (!out) return; const x = ctx, t0 = x.currentTime;
        const o = x.createOscillator(), f = x.createBiquadFilter(), f2 = x.createBiquadFilter(), g = x.createGain();
        o.type = 'sawtooth'; f.type = 'bandpass'; f.Q.value = 14; f2.type = 'bandpass'; f2.Q.value = 9; f2.frequency.value = 2300;
        let t = t0;
        o.frequency.setValueAtTime(70, t); f.frequency.setValueAtTime(900, t); g.gain.setValueAtTime(0.0001, t);
        // tirones irregulares: la frecuencia de rozamiento y el volumen tiemblan
        for (let i = 0; i < 26; i++) {
            const d = 0.04 + Math.random() * 0.07;
            o.frequency.linearRampToValueAtTime(55 + Math.random() * 90 + i * 2.5, t + d);
            f.frequency.linearRampToValueAtTime(700 + Math.random() * 1400, t + d);
            g.gain.linearRampToValueAtTime(Math.random() < 0.25 ? 0.01 : 0.12 + Math.random() * 0.12, t + d);
            t += d;
        }
        g.gain.linearRampToValueAtTime(0.0001, t + 0.15);
        o.connect(f); o.connect(f2); f.connect(g); f2.connect(g); g.connect(out);
        o.start(t0); o.stop(t + 0.3);
        const fin = (t - t0 + 0.05) * 1000;
        setTimeout(() => { if (a.activo) a.portazo(0.6); }, fin);
    };
    // Gruñido del zombi: sierra grave con temblor + formantes + distorsión + aliento
    a.rugido = () => {
        if (!a.activo) return; const out = salida(); if (!out) return; const x = ctx, t = x.currentTime, dur = 1.4;
        const o = x.createOscillator(), trem = x.createOscillator(), tg = x.createGain(), dist = distorsion(x, 40), g = x.createGain();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(95, t); o.frequency.linearRampToValueAtTime(70, t + dur);
        trem.type = 'square'; trem.frequency.value = 27; tg.gain.value = 18; trem.connect(tg).connect(o.frequency);
        const f1 = x.createBiquadFilter(), f2 = x.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 420; f1.Q.value = 3; f2.type = 'bandpass'; f2.frequency.value = 950; f2.Q.value = 5;
        f1.frequency.linearRampToValueAtTime(300, t + dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + 0.15); g.gain.setValueAtTime(0.32, t + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(dist); dist.connect(f1); dist.connect(f2); f1.connect(g); f2.connect(g); g.connect(out);
        o.start(t); trem.start(t); o.stop(t + dur + 0.05); trem.stop(t + dur + 0.05);
        ruido(dur, { vol: 0.14, frec: 600, tipo: 'bandpass', q: 1.5, ataque: 0.2 });
    };
    // Escudo: vibración metálica brillante
    a.escudo = () => { [880, 1320, 1760, 2637].forEach((f, i) => tono(f, 1.2 - i * 0.2, { vol: 0.05, desde: i * 0.02 })); ruido(0.6, { vol: 0.06, frec: 6000, tipo: 'highpass', barrido: 9000 }); };
    // Trueno: chasquido + retumbar largo con ráfagas
    a.trueno = () => {
        ruido(0.25, { vol: 0.5, frec: 3000, tipo: 'highpass' });
        ruido(3.6, { vol: 0.6, frec: 180, ataque: 0.05 });
        [0.3, 0.9, 1.6].forEach((d, i) => ruido(1.4, { vol: 0.35 - i * 0.08, frec: 320 - i * 60, desde: d, ataque: 0.08 }));
        tono(42, 3, { vol: 0.25, ataque: 0.1 });
    };
    // Victoria: campanas alegres + arpegio
    a.victoria = () => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tono(f, 0.6, { tipo: 'triangle', vol: 0.11, desde: i * 0.15 })); campanada(523, 1.1, 0.08); };
    // Derrota: risa grave del zombi (gruñidos a golpes) + acorde que se hunde
    a.derrota = () => { [392, 370, 349, 262].forEach((f, i) => tono(f, 0.9, { tipo: 'sawtooth', vol: 0.05, desde: i * 0.4, hasta: f * 0.94 })); setTimeout(() => a.rugido(), 300); };
    // ── Portazo de la mansión: madera maciza + retumbo grave + pestillo + eco de salón enorme ──
    let salon = null;
    const salidaSalon = () => {
        const x = c(); if (!x) return null;
        if (!salon) {
            const entrada = x.createGain();
            const seco = x.createGain(); seco.gain.value = 0.8;
            const rev = x.createConvolver(); rev.buffer = impulso(x, 5.2, 1.7);
            const humedo = x.createGain(); humedo.gain.value = 0.85;
            const graves = x.createBiquadFilter(); graves.type = 'lowpass'; graves.frequency.value = 1800;
            entrada.connect(seco).connect(x.destination);
            entrada.connect(graves).connect(rev).connect(humedo).connect(x.destination);
            salon = entrada;
        }
        return salon;
    };
    a.portazo = (fuerza = 1) => {
        if (!a.activo) return; const out = salidaSalon(); if (!out) return; const x = ctx, t = x.currentTime;
        // 1) impacto de la hoja contra el marco (ruido grave muy corto)
        const imp = x.createBufferSource(), fi = x.createBiquadFilter(), gi = x.createGain();
        imp.buffer = ruidoBuf(x, 0.5); fi.type = 'lowpass'; fi.frequency.setValueAtTime(1400, t); fi.frequency.exponentialRampToValueAtTime(120, t + 0.25);
        gi.gain.setValueAtTime(0.9 * fuerza, t); gi.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
        imp.connect(fi).connect(gi).connect(out); imp.start(t);
        // 2) cuerpo: retumbo grave que se hunde (madera maciza + suelo)
        [[62, 30, 0.75, 1.6, 'sine'], [96, 48, 0.3, 0.9, 'triangle'], [41, 26, 0.6, 2.2, 'sine']].forEach(([f0, f1, v, d, tipo]) => {
            const o = x.createOscillator(), g = x.createGain();
            o.type = tipo; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d);
            g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v * fuerza, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
            o.connect(g).connect(out); o.start(t); o.stop(t + d + 0.05);
        });
        // 3) traqueteo del pestillo y las bisagras (chasquidos metálicos que se apagan)
        [0.06, 0.13, 0.19, 0.3, 0.42].forEach((d, i) => {
            const s2 = x.createBufferSource(), f = x.createBiquadFilter(), g = x.createGain();
            s2.buffer = ruidoBuf(x, 0.05); f.type = 'bandpass'; f.frequency.value = 2600 + i * 300; f.Q.value = 8;
            g.gain.setValueAtTime(0.22 * fuerza * (1 - i * 0.17), t + d); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.045);
            s2.connect(f).connect(g).connect(out); s2.start(t + d);
        });
        // 4) polvo y vibración de la casa
        const p = x.createBufferSource(), fp = x.createBiquadFilter(), gp = x.createGain();
        p.buffer = ruidoBuf(x, 2.5); fp.type = 'lowpass'; fp.frequency.value = 300;
        gp.gain.setValueAtTime(0.0001, t); gp.gain.exponentialRampToValueAtTime(0.12 * fuerza, t + 0.05); gp.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
        p.connect(fp).connect(gp).connect(out); p.start(t);
    };
    /** La puerta de la mansión se cierra de golpe (inicio): portazo y, al rato, trueno lejano. */
    a.puertaCerrada = () => { a.portazo(1); setTimeout(() => { if (a.activo) a.trueno(); }, 1700); };

    // Candado: campanadas de iglesia lejanas
    a.campana = () => [0, 1.7, 3.4].forEach(d => campanada(110, d, 0.14));

    // ── Narrador ─────────────────────────────────────────────────────
    const cacheVoz = new Map();
    let vozActual = null;
    const cargarVoz = async (url) => {
        if (cacheVoz.has(url)) return cacheVoz.get(url);
        const p = fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then(b => c().decodeAudioData(b));
        cacheVoz.set(url, p);
        p.catch(() => cacheVoz.delete(url));
        return p;
    };
    /** Precarga varias frases (para que no haya espera al llegar el momento). */
    a.precargarVoces = (urls) => { if (!c()) return; urls.forEach(u => cargarVoz(u).catch(() => { })); };
    /** Reproduce una frase. Devuelve una promesa con la duración (s) o null si no se pudo. */
    a.narrar = async (url) => {
        if (!a.activo) return null;
        const x = c(); if (!x) return null;
        let buf;
        try { buf = await cargarVoz(url); } catch { return null; }
        if (!a.activo) return null;
        a.callarNarrador();
        const k = PROCESADO_VOZ;
        const s = x.createBufferSource(); s.buffer = buf;
        s.playbackRate.value = 1 - 0.1 * k;              // más grave (y algo más lenta)
        const graves = x.createBiquadFilter(); graves.type = 'lowshelf'; graves.frequency.value = 220; graves.gain.value = 6 * k;
        const agudos = x.createBiquadFilter(); agudos.type = 'highshelf'; agudos.frequency.value = 5000; agudos.gain.value = -6 * k;
        const seco = x.createGain(); seco.gain.value = 1;
        const rev = x.createConvolver(); rev.buffer = impulso(x, 3.6, 2.2);
        const humedo = x.createGain(); humedo.gain.value = 0.55 * k;
        const eco = x.createDelay(1); eco.delayTime.value = 0.32;
        const ecoFb = x.createGain(); ecoFb.gain.value = 0.25 * k;
        const ecoSal = x.createGain(); ecoSal.gain.value = 0.3 * k;
        s.connect(graves).connect(agudos);
        agudos.connect(seco).connect(x.destination);
        agudos.connect(rev).connect(humedo).connect(x.destination);
        agudos.connect(eco); eco.connect(ecoFb).connect(eco); eco.connect(ecoSal).connect(x.destination);
        // la música baja mientras habla
        if (mus) mus.master.gain.setTargetAtTime(a.volMusica * 0.3, x.currentTime, 0.2);
        s.start();
        const dur = buf.duration / s.playbackRate.value;
        vozActual = { s, fin: () => { if (mus && a.activo) mus.master.gain.setTargetAtTime(a.volMusica, ctx.currentTime, 0.8); } };
        const yo = vozActual;
        s.onended = () => { if (vozActual === yo) { vozActual = null; yo.fin(); } };
        return dur;
    };
    a.callarNarrador = () => { if (vozActual) { const v = vozActual; vozActual = null; try { v.s.stop(); } catch { /* */ } v.fin(); } };
    // ── Música de fondo de suspense (sintetizada, en bucle) ──────────────
    //  Drone grave con filtro que «respira», caja de música en La menor armónica con eco,
    //  latido de corazón y ráfagas de viento. modo 'batalla' = más rápido y con pulso.
    let mus = null;
    const ACORDES = [[57, 60, 64], [53, 57, 60], [50, 53, 57], [52, 56, 59]]; // Am, F, Dm, E (MIDI)
    const PATRON = [0, 1, 2, 1, 3, 2, 1, -1, 0, 2, 1, 3, -1, 2, 1, -1];        // índice de nota del acorde (3 = octava), -1 silencio
    const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
    a.musica = (activar, modo = 'suspense') => {
        if (!activar) {
            if (!mus) return;
            const m = mus; mus = null;
            clearInterval(m.reloj);
            try { m.master.gain.setTargetAtTime(0, ctx.currentTime, 0.4); } catch { /* */ }
            setTimeout(() => { try { m.drones.forEach(o => o.stop()); m.lfo.stop(); m.master.disconnect(); } catch { /* */ } }, 2500);
            return;
        }
        const x = c(); if (!x) return;
        if (mus) { mus.modo = modo; return; }
        const master = x.createGain(); master.gain.value = 0;
        master.connect(x.destination);
        master.gain.setTargetAtTime(a.activo ? a.volMusica : 0, x.currentTime, 1.2);
        // eco para la caja de música
        const eco = x.createDelay(1); eco.delayTime.value = 0.36;
        const fb = x.createGain(); fb.gain.value = 0.38;
        const ecoSal = x.createGain(); ecoSal.gain.value = 0.5;
        eco.connect(fb).connect(eco); eco.connect(ecoSal).connect(master);
        // drone
        const filtro = x.createBiquadFilter(); filtro.type = 'lowpass'; filtro.frequency.value = 260; filtro.Q.value = 6;
        const lfo = x.createOscillator(), lfoG = x.createGain(); lfo.frequency.value = 0.06; lfoG.gain.value = 160;
        lfo.connect(lfoG).connect(filtro.frequency); lfo.start();
        const dg = x.createGain(); dg.gain.value = 0.22; filtro.connect(dg).connect(master);
        const drones = [[hz(33), 'sawtooth'], [hz(33) * 1.007, 'sawtooth'], [hz(45), 'sine'], [hz(40), 'triangle']].map(([f, t]) => {
            const o = x.createOscillator(); o.type = t; o.frequency.value = f; o.connect(filtro); o.start(); return o;
        });
        const nota = (f, t, dur, vol, tipo = 'triangle', destino = master) => {
            const o = x.createOscillator(), g = x.createGain();
            o.type = tipo; o.frequency.setValueAtTime(f, t);
            g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            o.connect(g); g.connect(destino); if (destino !== master) g.connect(master);
            o.start(t); o.stop(t + dur + 0.05);
        };
        const latido = (t, vol) => {
            [0, 0.22].forEach((d, i) => {
                const o = x.createOscillator(), g = x.createGain();
                o.frequency.setValueAtTime(70, t + d); o.frequency.exponentialRampToValueAtTime(38, t + d + 0.18);
                g.gain.setValueAtTime(vol * (i ? 0.7 : 1), t + d); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.22);
                o.connect(g).connect(master); o.start(t + d); o.stop(t + d + 0.3);
            });
        };
        const viento = (t) => {
            const dur = 5;
            const buf = x.createBuffer(1, Math.floor(x.sampleRate * dur), x.sampleRate), d = buf.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            const s = x.createBufferSource(), f = x.createBiquadFilter(), g = x.createGain();
            f.type = 'bandpass'; f.Q.value = 3; f.frequency.setValueAtTime(300, t); f.frequency.linearRampToValueAtTime(900, t + dur / 2); f.frequency.linearRampToValueAtTime(250, t + dur);
            g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09, t + dur / 2); g.gain.linearRampToValueAtTime(0.0001, t + dur);
            s.buffer = buf; s.connect(f).connect(g).connect(master); s.start(t);
        };
        mus = { master, drones, lfo, modo, paso: 0, siguiente: x.currentTime + 0.3 };
        mus.reloj = setInterval(() => {
            const m = mus; if (!m || !ctx) return;
            const batalla = m.modo === 'batalla';
            const dur = 60 / (batalla ? 132 : 76) / 2; // corcheas
            while (m.siguiente < ctx.currentTime + 0.25) {
                const t = m.siguiente, paso = m.paso;
                const acorde = ACORDES[Math.floor(paso / 16) % ACORDES.length];
                const k = PATRON[paso % 16];
                if (k >= 0) {
                    const midi = (k === 3 ? acorde[0] + 12 : acorde[k]) + 12;
                    nota(hz(midi), t, batalla ? 0.35 : 0.9, batalla ? 0.05 : 0.07, 'triangle', eco);
                    if (!batalla && paso % 16 === 0) nota(hz(midi + 12), t, 1.6, 0.025, 'sine', eco);
                }
                if (paso % 16 === 0) nota(hz(acorde[0] - 24), t, dur * 16, batalla ? 0.08 : 0.05, 'sine');
                if (batalla) {
                    if (paso % 2 === 0) latido(t, 0.22);
                    if (paso % 4 === 2) nota(hz(acorde[0] - 12), t, 0.12, 0.08, 'square');
                } else {
                    if (paso % 16 === 0) latido(t, 0.16);
                    if (paso % 64 === 40) viento(t);
                    if (paso % 32 === 27) nota(hz(acorde[2] + 30), t, 2.2, 0.018, 'sine', eco); // campanita lejana
                }
                m.paso++; m.siguiente += dur;
            }
        }, 60);
    };
    a.volMusica = 0.55;
    a.silencio = (mudo) => {
        a.activo = !mudo;
        if (mudo) a.callarNarrador();
        if (mus && ctx) mus.master.gain.setTargetAtTime(mudo ? 0 : a.volMusica, ctx.currentTime, 0.3);
    };
    a.cerrar = () => { a.callarNarrador(); a.musica(false); try { ctx?.close(); } catch { } ctx = null; fx = null; salon = null; };
    return a;
}

// =====================================================================
//  ESTILOS
// =====================================================================
export const CSS = `
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
  box-shadow: 0 10px 40px rgba(0,0,0,.5), inset 0 0 30px rgba(120,40,200,.15); }
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
.eh-barra { height: 26px; border-radius: 13px; background: rgba(255,255,255,.1); border: 2px solid rgba(255,140,26,.55); overflow: hidden; position: relative; }
.eh-barra > div { height: 100%; border-radius: 11px; transition: width .5s ease; background: linear-gradient(90deg, #ff6a00, #ffb347); box-shadow: 0 0 16px rgba(255,140,0,.7); }
.eh-vela { display: inline-block; animation: ehFlicker 1.6s ease-in-out infinite; }
@keyframes ehFlicker { 0%,100% { opacity: 1; transform: scale(1); } 40% { opacity: .75; transform: scale(.96) rotate(-2deg); } 60% { opacity: .9; transform: scale(1.03) rotate(2deg); } }
.eh-root.eh-3d { overflow: hidden; display: flex; flex-direction: column; }
.eh-layout3d { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0,1fr) min(420px, 34vw); gap: 12px; padding: 10px 12px 12px; position: relative; z-index: 1; }
.eh-escena3d { position: relative; min-height: 0; }
.eh-lateral { overflow-y: auto; overflow-x: hidden; scrollbar-gutter: stable; min-height: 0; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.eh-lateral .eh-latido { animation-name: ehLatidoSuave; }
@keyframes ehLatidoSuave { 0%,100% { opacity: 1; filter: drop-shadow(0 0 0 rgba(255,200,0,0)); } 50% { opacity: .75; filter: drop-shadow(0 0 10px rgba(255,200,0,.8)); } }
.eh-lateral .eh-aparece { animation-name: ehAparecerSuave; }
@keyframes ehAparecerSuave { from { opacity: 0; } to { opacity: 1; } }
.eh-banda { position: absolute; left: 12px; right: 12px; bottom: 12px; z-index: 2; background: rgba(20,8,38,.9); border: 2px solid rgba(255,140,26,.5); border-radius: 16px; padding: 10px 16px; }
@media (max-width: 900px) {
  .eh-root.eh-3d { overflow-y: auto; display: block; }
  .eh-layout3d { display: block; }
  .eh-escena3d { height: 48vh; margin-bottom: 12px; }
}
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

export function Ambiente({ murcielagos = 5, ligero = false }) {
    const bats = useMemo(() => Array.from({ length: murcielagos }, (_, i) => ({
        top: 5 + Math.random() * 45, dur: 14 + Math.random() * 16, delay: -Math.random() * 20, size: 18 + Math.random() * 18, id: i,
    })), [murcielagos]);
    if (ligero) return <style>{CSS}</style>;
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

export function Confeti() {
    const piezas = useMemo(() => Array.from({ length: 40 }, (_, i) => ({
        i, left: Math.random() * 100, dur: 3 + Math.random() * 3, delay: Math.random() * 2.5, e: pick(['🎃', '🍬', '🍭', '✨', '🦇', '⭐']),
    })), []);
    return piezas.map(p => <div key={p.i} className="eh-confeti" style={{ left: `${p.left}%`, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s` }}>{p.e}</div>);
}

// =====================================================================
//  ZOMBI (SVG)
// =====================================================================
export function Zombi({ estado = 'idle', size = 260 }) {
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

export function Corazones({ vidas, max }) {
    return (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
            {Array.from({ length: max }, (_, i) => (
                <span key={i} style={{ fontSize: '1.6rem', filter: i < vidas ? 'none' : 'grayscale(1) opacity(.3)', transition: 'filter .4s' }}>❤️</span>
            ))}
        </div>
    );
}

export function BarraVidaZombi({ hp, hpMax }) {
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

export function MapaMansion({ pruebas = [], salaIdx, amuletos = [], fase }) {
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
export function TarjetaPregunta({ pregunta, feedback, onResponder, color = '#ff8c1a' }) {
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
//  NARRADOR: frase según la fase + subtítulo en la pantalla proyectada
// =====================================================================
/** Frase del narrador al entrar en una fase (null = ninguna). */
export function idNarracionFase(fase, salaIdx, total, agotado) {
    switch (fase) {
        case 'LOBBY': return 'bienvenida';
        case 'INTRO': return 'intro';
        case 'RETOS': return narracionSala(salaIdx, total);
        case 'CANDADO': return 'candado';
        case 'ABIERTA': return 'abierta';
        case 'BATALLA': return agotado ? 'agotado' : 'batalla';
        case 'VICTORIA': return 'victoria';
        case 'DERROTA': return 'derrota';
        default: return null;
    }
}

export function useNarrador(audio, activo) {
    const [subtitulo, setSubtitulo] = useState('');
    const t = useRef(null);
    const activoRef = useRef(activo);
    activoRef.current = activo;
    useEffect(() => { audio.precargarVoces(Object.keys(NARRACION).map(urlNarracion)); }, [audio]);
    useEffect(() => () => clearTimeout(t.current), []);
    useEffect(() => { if (!activo) { audio.callarNarrador(); setSubtitulo(''); } }, [activo, audio]);
    const decir = useCallback((id, retraso = 0) => {
        const texto = NARRACION[id];
        if (!texto || !activoRef.current) return;
        clearTimeout(t.current);
        t.current = setTimeout(async () => {
            if (!activoRef.current) return;
            setSubtitulo(texto);
            const dur = await audio.narrar(urlNarracion(id));
            clearTimeout(t.current);
            // sin audio (archivo ausente o bloqueado), el subtítulo se lee igualmente
            t.current = setTimeout(() => setSubtitulo(s => (s === texto ? '' : s)), dur ? dur * 1000 + 400 : 4000 + texto.length * 45);
        }, retraso);
    }, [audio]);
    return { decir, subtitulo };
}

export function Subtitulo({ texto }) {
    if (!texto) return null;
    return (
        <div style={{ position: 'fixed', left: 0, right: 0, top: 70, zIndex: 40, display: 'flex', justifyContent: 'center', padding: '0 12px', pointerEvents: 'none' }}>
        <div key={texto} className="eh-aparece" style={{
            boxSizing: 'border-box', width: '100%', maxWidth: 900,
            padding: '10px 18px', borderRadius: 14, background: 'rgba(8,2,18,.86)', border: '2px solid rgba(255,140,26,.45)',
            color: '#f5e9ff', fontStyle: 'italic', fontSize: 'clamp(1rem,1.7vw,1.35rem)', lineHeight: 1.4, textAlign: 'center',
            boxShadow: '0 8px 30px rgba(0,0,0,.6)', pointerEvents: 'none',
        }}>🕯️ {texto}</div>
        </div>
    );
}
