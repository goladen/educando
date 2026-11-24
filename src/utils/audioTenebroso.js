// Audio tenebroso compartido (Escape Room de Halloween y La Mansión Pitagórica):
// efectos sintetizados con reverberación de cripta, música de suspense en bucle y narrador
// (reproduce mp3 grabados con voz más grave, reverberación y eco; baja la música mientras habla).
// Movido desde src/escapeHalloween/comunes.jsx, que lo reexporta.

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
