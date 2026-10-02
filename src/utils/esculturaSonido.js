// esculturaSonido.js — Sonidos sintetizados (Web Audio) del Taller de Escultura 3D.
// Sin archivos de audio: golpes de cincel = ráfaga de ruido filtrado + chasquido;
// gubia, lija, taladro y arcilla = ruido continuo cuyo volumen sigue a la cantidad
// de material que se está quitando; torno = zumbido de motor.

export function crearSonidoTaller() {
    let ctx = null, ruido = null, activo = true;
    let cadena = null;            // { tipo, nodos[], gain }
    let motor = null;             // zumbido del torno

    const asegurar = () => {
        if (!ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            ctx = new AC();
            ruido = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
            const d = ruido.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        }
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    };

    function golpe(intensidad, dureza) {
        const c = asegurar(); if (!c) return;
        const t = c.currentTime;
        const v = Math.min(0.55, 0.15 + intensidad * 0.4);
        const src = c.createBufferSource(); src.buffer = ruido;
        const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900 + dureza * 900; bp.Q.value = 1.1;
        const g = c.createGain();
        g.gain.setValueAtTime(v, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.08 + 0.03 * dureza);
        src.connect(bp).connect(g).connect(c.destination);
        src.start(t, Math.random() * 0.8, 0.16);
        const o = c.createOscillator(); o.type = 'triangle';
        o.frequency.setValueAtTime(1500 + dureza * 600, t);
        o.frequency.exponentialRampToValueAtTime(700, t + 0.05);
        const g2 = c.createGain();
        g2.gain.setValueAtTime(v * 0.45, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        o.connect(g2).connect(c.destination);
        o.start(t); o.stop(t + 0.07);
    }

    function montarCadena(tipo, dureza) {
        pararCadena();
        const c = ctx;
        const gain = c.createGain(); gain.gain.value = 0; gain.connect(c.destination);
        const nodos = [];
        const src = c.createBufferSource(); src.buffer = ruido; src.loop = true;
        const fil = c.createBiquadFilter();
        if (tipo === 'LIJA') { fil.type = 'highpass'; fil.frequency.value = 2500 + dureza * 400; }
        else if (tipo === 'ARCILLA') { fil.type = 'lowpass'; fil.frequency.value = 450; }
        else if (tipo === 'TALADRO') { fil.type = 'bandpass'; fil.frequency.value = 1400; fil.Q.value = 2; }
        else { fil.type = 'bandpass'; fil.frequency.value = 700 + dureza * 500; fil.Q.value = 0.9; }
        src.connect(fil).connect(gain);
        src.start();
        nodos.push(src, fil);
        if (tipo === 'TALADRO') {
            const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 150 + dureza * 40;
            const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
            const go = c.createGain(); go.gain.value = 0.5;
            o.connect(lp).connect(go).connect(gain);
            o.start();
            nodos.push(o, lp, go);
        }
        cadena = { tipo, nodos, gain };
    }

    function pararCadena() {
        if (!cadena) return;
        for (const n of cadena.nodos) { try { n.stop?.(); } catch { /* ya parado */ } n.disconnect(); }
        cadena.gain.disconnect();
        cadena = null;
    }

    /** Llamar cada vez que una herramienta modifica la pieza. */
    function actividad(tipo, cambio, dureza) {
        if (!activo || cambio <= 0) return;
        if (tipo === 'CINCEL') { golpe(Math.min(1, cambio / 60), dureza); return; }
        const c = asegurar(); if (!c) return;
        if (cadena?.tipo !== tipo) montarCadena(tipo, dureza);
        const t = c.currentTime;
        const nivel = Math.min(0.22, 0.04 + cambio * (tipo === 'LIJA' ? 0.004 : 0.003));
        cadena.gain.gain.cancelScheduledValues(t);
        cadena.gain.gain.setTargetAtTime(nivel, t, 0.02);
        cadena.gain.gain.setTargetAtTime(0, t + 0.09, 0.05);
    }

    function torno(encendido) {
        if (!encendido || !activo) {
            if (motor) { const m = motor; motor = null; m.g.gain.setTargetAtTime(0, ctx.currentTime, 0.1); setTimeout(() => { try { m.o.stop(); } catch { /* */ } m.g.disconnect(); }, 500); }
            return;
        }
        const c = asegurar(); if (!c || motor) return;
        const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 62;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
        const g = c.createGain(); g.gain.value = 0;
        o.connect(lp).connect(g).connect(c.destination);
        o.start();
        g.gain.setTargetAtTime(0.06, c.currentTime, 0.2);
        motor = { o, g };
    }

    return {
        actividad,
        torno,
        setActivo(b) { activo = b; if (!b) { pararCadena(); torno(false); } },
        dispose() { pararCadena(); if (motor) { try { motor.o.stop(); } catch { /* */ } } motor = null; ctx?.close?.(); ctx = null; },
    };
}
