import { useRef, useState, useMemo, useEffect } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
//  INSTRUMENTOS — Piano · Xilófono · Batería · Guitarra
//  · Multitáctil real (Pointer Events): varias notas a la vez en móvil/pizarra
//  · Batería realista · Guitarra Karplus-Strong (cuerdas + trastes + rasgueo)
//  · Modo DÚO: dos instrumentos a la vez en pantalla partida
//  · ESTUDIO: graba varias pistas, edita ritmo/tempo/volumen y suénalas juntas
// ─────────────────────────────────────────────────────────────────────────────

// 88 teclas de un piano real (A0 → C8), frecuencias en temperamento igual
const PITCH = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function build88() {
    const keys = [];
    for (let midi = 21; midi <= 108; midi++) {
        const name = PITCH[midi % 12];
        keys.push({
            name: name + (Math.floor(midi / 12) - 1),
            freq: 440 * Math.pow(2, (midi - 69) / 12),
            type: name.includes('#') ? 'black' : 'white',
        });
    }
    return keys;
}
const PIANO_KEYS = build88();
const WHITE_W = 46, BLACK_W = 28;

const NOTES_XYLO = [
    { name: 'DO', freq: 261.63, color: '#FF4B4B' },
    { name: 'RE', freq: 293.66, color: '#FF9F43' },
    { name: 'MI', freq: 329.63, color: '#FECA57' },
    { name: 'FA', freq: 349.23, color: '#1DD1A1' },
    { name: 'SOL', freq: 392.00, color: '#10AC84' },
    { name: 'LA', freq: 440.00, color: '#2E86DE' },
    { name: 'SI', freq: 493.88, color: '#341F97' },
    { name: 'DO↑', freq: 523.25, color: '#8395A7' },
];
const GUITAR_STRINGS = ['Mi (E4)', 'Si (B3)', 'Sol (G3)', 'Re (D3)', 'La (A2)', 'Mi (E2)'];
const GUITAR_BASE = [329.63, 246.94, 196.00, 146.83, 110.00, 82.41];
const FRET_COUNT = 4;

const INSTRUMENTS = {
    piano:    { emoji: '🎹', label: 'Piano' },
    xilofono: { emoji: '🎵', label: 'Xilófono' },
    bateria:  { emoji: '🥁', label: 'Batería' },
    guitarra: { emoji: '🎸', label: 'Guitarra' },
};
const TRACK_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#f97316'];

export default function MusicaInstrumentos({ onBack }) {
    const [activeTab, setActiveTab] = useState('piano');   // piano|xilofono|bateria|guitarra|dual|estudio
    const [leftInst, setLeftInst]   = useState('piano');
    const [rightInst, setRightInst] = useState('bateria');

    // Grabación
    const [recOn, setRecOn]   = useState(false);
    const recRef              = useRef({ active: false, start: 0, events: [] });
    const [tracks, setTracks] = useState([]);

    // Reproducción
    const [playing, setPlaying]         = useState(false);
    const [globalTempo, setGlobalTempo] = useState(1);
    const [loop, setLoop]               = useState(false);
    const loopRef      = useRef(false);
    const transportRef = useRef([]);
    useEffect(() => { loopRef.current = loop; }, [loop]);

    // ── Motor de audio ────────────────────────────────────────────────────────
    const ctxRef = useRef(null), masterRef = useRef(null), noiseRef = useRef(null);
    const audio = () => {
        if (!ctxRef.current) {
            const AC = window.AudioContext || window.webkitAudioContext;
            const ctx = new AC();
            const len = ctx.sampleRate * 1.5;
            const noise = ctx.createBuffer(1, len, ctx.sampleRate);
            const nd = noise.getChannelData(0);
            for (let i = 0; i < len; i++) nd[i] = Math.random() * 2 - 1;
            noiseRef.current = noise;

            const master = ctx.createGain(); master.gain.value = 0.9;
            const comp = ctx.createDynamicsCompressor();
            comp.threshold.value = -18; comp.knee.value = 24; comp.ratio.value = 3;
            comp.attack.value = 0.003; comp.release.value = 0.25;
            const dry = ctx.createGain(); dry.gain.value = 1;
            const wet = ctx.createGain(); wet.gain.value = 0.16;
            const irLen = ctx.sampleRate * 1.4;
            const ir = ctx.createBuffer(2, irLen, ctx.sampleRate);
            for (let c = 0; c < 2; c++) {
                const ch = ir.getChannelData(c);
                for (let i = 0; i < irLen; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 2.5);
            }
            const conv = ctx.createConvolver(); conv.buffer = ir;
            master.connect(dry).connect(comp);
            master.connect(conv).connect(wet).connect(comp);
            comp.connect(ctx.destination);
            ctxRef.current = ctx; masterRef.current = master;
        }
        if (ctxRef.current.state === 'suspended') ctxRef.current.resume();
        return { ctx: ctxRef.current, master: masterRef.current };
    };

    // ── Síntesis (cada función conecta su salida a `dest`) ─────────────────────
    const synthPiano = (freq, dest) => {
        const { ctx } = audio(); const now = ctx.currentTime;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
        lp.frequency.setValueAtTime(6500, now);
        lp.frequency.exponentialRampToValueAtTime(1100, now + 1.4);
        const out = ctx.createGain();
        out.gain.setValueAtTime(0, now);
        out.gain.linearRampToValueAtTime(0.55, now + 0.005);
        out.gain.exponentialRampToValueAtTime(0.0008, now + 2.4);
        [[1, 0.6], [2, 0.22], [3, 0.11], [4, 0.06], [5, 0.035], [6, 0.02]].forEach(([m, a], i) => {
            const o = ctx.createOscillator(); o.type = 'sine';
            o.frequency.setValueAtTime(freq * m, now);
            o.detune.setValueAtTime(i % 2 ? 3 : -2, now);
            const g = ctx.createGain();
            g.gain.setValueAtTime(a, now);
            g.gain.exponentialRampToValueAtTime(0.0001, now + 2.4 / (i * 0.6 + 1));
            o.connect(g).connect(lp); o.start(now); o.stop(now + 2.5);
        });
        const noise = ctx.createBufferSource(); noise.buffer = noiseRef.current;
        const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = freq * 2.5; nf.Q.value = 0.7;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.18, now); ng.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        noise.connect(nf).connect(ng).connect(dest); noise.start(now); noise.stop(now + 0.05);
        lp.connect(out).connect(dest);
    };

    const synthXilo = (freq, dest) => {
        const { ctx } = audio(); const now = ctx.currentTime;
        const osc = ctx.createOscillator(), over = ctx.createOscillator();
        const g = ctx.createGain(), go = ctx.createGain();
        osc.type = 'sine'; osc.frequency.setValueAtTime(freq, now);
        g.gain.setValueAtTime(0.6, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        over.type = 'sine'; over.frequency.setValueAtTime(freq * 3.93, now);
        go.gain.setValueAtTime(0.28, now); go.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.connect(g).connect(dest); over.connect(go).connect(dest);
        osc.start(now); over.start(now); osc.stop(now + 0.5); over.stop(now + 0.5);
    };

    const synthDrum = (type, dest) => {
        const { ctx } = audio(); const now = ctx.currentTime;
        const noiseSrc = () => { const n = ctx.createBufferSource(); n.buffer = noiseRef.current; return n; };
        if (type === 'kick') {
            const osc = ctx.createOscillator(), g = ctx.createGain();
            osc.frequency.setValueAtTime(165, now); osc.frequency.exponentialRampToValueAtTime(42, now + 0.12);
            g.gain.setValueAtTime(1.1, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
            osc.connect(g).connect(dest); osc.start(now); osc.stop(now + 0.4);
            const click = noiseSrc(), cf = ctx.createBiquadFilter(); cf.type = 'bandpass'; cf.frequency.value = 1800;
            const cg = ctx.createGain(); cg.gain.setValueAtTime(0.5, now); cg.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
            click.connect(cf).connect(cg).connect(dest); click.start(now); click.stop(now + 0.03);
        } else if (type === 'snare') {
            [180, 330].forEach((f, i) => {
                const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle';
                o.frequency.setValueAtTime(f, now);
                g.gain.setValueAtTime(i ? 0.18 : 0.35, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                o.connect(g).connect(dest); o.start(now); o.stop(now + 0.13);
            });
            const noise = noiseSrc();
            const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1500;
            const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 4500; bp.Q.value = 0.5;
            const ng = ctx.createGain(); ng.gain.setValueAtTime(0.6, now); ng.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            noise.connect(hp).connect(bp).connect(ng).connect(dest); noise.start(now); noise.stop(now + 0.2);
        } else if (type === 'tom') {
            const osc = ctx.createOscillator(), g = ctx.createGain();
            osc.frequency.setValueAtTime(200, now); osc.frequency.exponentialRampToValueAtTime(70, now + 0.3);
            g.gain.setValueAtTime(0.8, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
            osc.connect(g).connect(dest); osc.start(now); osc.stop(now + 0.4);
        } else if (type === 'hihat' || type === 'crash') {
            const isCrash = type === 'crash'; const dur = isCrash ? 1.3 : 0.09;
            const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = isCrash ? 5000 : 8500;
            const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = isCrash ? 8000 : 11000; bp.Q.value = 0.6;
            const g = ctx.createGain(); g.gain.setValueAtTime(isCrash ? 0.45 : 0.32, now); g.gain.exponentialRampToValueAtTime(0.001, now + dur);
            hp.connect(bp).connect(g).connect(dest);
            [2, 3, 4.16, 5.43, 6.79, 8.21].forEach(r => {
                const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 40 * r;
                o.connect(hp); o.start(now); o.stop(now + dur);
            });
            const noise = noiseSrc(), ng = ctx.createGain(); ng.gain.value = 0.4;
            noise.connect(ng).connect(hp); noise.start(now); noise.stop(now + dur);
        }
    };

    const synthPluck = (freq, dest) => {
        const { ctx } = audio(); const now = ctx.currentTime; const fs = ctx.sampleRate;
        const N = Math.max(2, Math.round(fs / freq)); const dur = 2.6; const bufLen = Math.floor(fs * dur);
        const buf = ctx.createBuffer(1, bufLen, fs); const out = buf.getChannelData(0);
        const delay = new Float32Array(N);
        for (let i = 0; i < N; i++) delay[i] = Math.random() * 2 - 1;
        const damping = freq < 150 ? 0.998 : freq < 260 ? 0.9965 : 0.995;
        let idx = 0;
        for (let i = 0; i < bufLen; i++) {
            const cur = delay[idx], nxt = delay[(idx + 1) % N];
            out[i] = cur; delay[idx] = (cur + nxt) * 0.5 * damping; idx = (idx + 1) % N;
        }
        const src = ctx.createBufferSource(); src.buffer = buf;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3800;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.7, now); g.gain.setValueAtTime(0.7, now + dur - 0.1);
        g.gain.linearRampToValueAtTime(0, now + dur);
        src.connect(lp).connect(g).connect(dest); src.start(now);
    };

    const playEvent = (inst, payload, dest) => {
        if (inst === 'piano') synthPiano(payload.freq, dest);
        else if (inst === 'xilofono') synthXilo(payload.freq, dest);
        else if (inst === 'bateria') synthDrum(payload.type, dest);
        else if (inst === 'guitarra') synthPluck(payload.freq, dest);
    };

    // Disparo en vivo (toca + graba si está grabando)
    const trigger = (inst, payload) => {
        const { master } = audio();
        playEvent(inst, payload, master);
        const rec = recRef.current;
        if (rec.active) rec.events.push({ t: performance.now() - rec.start, inst, payload });
    };

    // Reproduce una nota suelta (demostración, sin grabar)
    const playNote = (inst, payload) => { const { master } = audio(); playEvent(inst, payload, master); };

    // ── Grabación ─────────────────────────────────────────────────────────────
    const toggleRec = () => {
        if (recRef.current.active) {
            recRef.current.active = false;
            setRecOn(false);
            const events = recRef.current.events;
            if (events.length > 0) {
                setTracks(prev => [...prev, {
                    id: Date.now(),
                    name: `Pista ${prev.length + 1}`,
                    color: TRACK_COLORS[prev.length % TRACK_COLORS.length],
                    events, muted: false, volume: 0.9, speed: 1,
                }]);
            }
        } else {
            audio();
            recRef.current = { active: true, start: performance.now(), events: [] };
            setRecOn(true);
        }
    };

    // ── Reproducción multipista ───────────────────────────────────────────────
    const stopTransport = () => {
        transportRef.current.forEach(clearTimeout);
        transportRef.current = [];
        setPlaying(false);
    };
    const playTracks = (list) => {
        stopTransport();
        const { ctx, master } = audio();
        const tids = [];
        let maxDur = 0;
        list.forEach(tr => {
            if (!tr.events.length) return;
            const g = ctx.createGain(); g.gain.value = tr.volume; g.connect(master);
            const sf = tr.speed * globalTempo;
            tr.events.forEach(ev => {
                tids.push(setTimeout(() => playEvent(ev.inst, ev.payload, g), ev.t / sf));
            });
            maxDur = Math.max(maxDur, tr.events[tr.events.length - 1].t / sf);
        });
        if (!tids.length) return;
        tids.push(setTimeout(() => {
            if (loopRef.current) playTracks(list);
            else setPlaying(false);
        }, maxDur + 300));
        transportRef.current = tids;
        setPlaying(true);
    };
    const playAll = () => playTracks(tracks.filter(t => !t.muted));

    useEffect(() => () => stopTransport(), []);

    const updTrack = (id, patch) => setTracks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
    const delTrack = (id) => setTracks(prev => prev.filter(t => t.id !== id));
    const quantize = (id) => {
        const GRID = 250; // 1/8 de nota a 120 BPM
        setTracks(prev => prev.map(t => t.id === id
            ? { ...t, events: t.events.map(e => ({ ...e, t: Math.round(e.t / GRID) * GRID })) }
            : t));
    };

    // ── Estilos ───────────────────────────────────────────────────────────────
    const st = {
        container: { fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#11161a', color: '#fff', minHeight: '100vh', padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', userSelect: 'none', WebkitUserSelect: 'none' },
        nav: { display: 'flex', gap: 8, marginBottom: 14, backgroundColor: '#1e272e', padding: 8, borderRadius: 40, boxShadow: '0 8px 20px rgba(0,0,0,0.4)', flexWrap: 'wrap', justifyContent: 'center' },
        navBtn: (a) => ({ padding: '11px 20px', fontSize: '1.02rem', fontWeight: 700, border: 'none', borderRadius: 35, cursor: 'pointer', backgroundColor: a ? '#00d2d3' : 'transparent', color: a ? '#11161a' : '#a4b0be', transition: 'all 0.15s ease' }),
        board: { backgroundColor: '#1c242b', borderRadius: 24, padding: 24, width: '94%', maxWidth: 980, minHeight: 430, display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.6)', position: 'relative' },
    };

    const isInst = ['piano', 'xilofono', 'bateria', 'guitarra'].includes(activeTab);

    return (
        <div style={st.container}>
            {/* Cabecera */}
            <div style={{ width: '100%', maxWidth: 980, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                {onBack && <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600 }}>← Volver</button>}
                <div style={{ textAlign: 'center', flex: 1 }}>
                    <h1 style={{ fontSize: '1.9rem', margin: 0, color: '#00d2d3' }}>🎶 Estudio de Instrumentos</h1>
                    <p style={{ color: '#57606f', margin: '4px 0 0', fontSize: '0.9rem' }}>Toca, graba pistas y reprodúcelas juntas</p>
                </div>
                <div style={{ width: 80 }} />
            </div>

            {/* Navegación */}
            <nav style={st.nav}>
                {Object.entries(INSTRUMENTS).map(([id, m]) => (
                    <button key={id} style={st.navBtn(activeTab === id)} onClick={() => setActiveTab(id)}>{m.emoji} {m.label}</button>
                ))}
                <button style={st.navBtn(activeTab === 'dual')} onClick={() => setActiveTab('dual')}>👬 Dúo</button>
                <button style={st.navBtn(activeTab === 'aprender')} onClick={() => { stopTransport(); setActiveTab('aprender'); }}>🎓 Aprender</button>
                <button style={st.navBtn(activeTab === 'estudio')} onClick={() => { stopTransport(); setActiveTab('estudio'); }}>
                    🎚️ Estudio{tracks.length ? ` (${tracks.length})` : ''}
                </button>
            </nav>

            {/* Barra de grabación (solo tocando) */}
            {(isInst || activeTab === 'dual') && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button onClick={toggleRec} style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', borderRadius: 30, border: 'none', cursor: 'pointer', fontWeight: 700,
                        background: recOn ? '#ef4444' : '#2f3b44', color: '#fff', boxShadow: recOn ? '0 0 18px #ef444488' : 'none',
                    }}>
                        <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#fff', animation: recOn ? 'blink 1s infinite' : 'none', display: 'inline-block' }} />
                        {recOn ? 'Detener y guardar pista' : 'Grabar'}
                    </button>
                    {recOn && <span style={{ color: '#ef4444', fontWeight: 700 }}>● Grabando…</span>}
                    {!recOn && tracks.length > 0 && <span style={{ color: '#7f8c9b', fontSize: '0.85rem' }}>{tracks.length} pista(s) guardada(s) — ve a 🎚️ Estudio</span>}
                    <style>{`@keyframes blink{50%{opacity:0.2}}`}</style>
                </div>
            )}

            {/* SOLO */}
            {isInst && (
                <div style={st.board}>
                    <InstrumentBoard inst={activeTab} trigger={trigger} />
                </div>
            )}

            {/* DÚO */}
            {activeTab === 'dual' && (
                <div style={{ ...st.board, gap: 14, alignItems: 'stretch', flexWrap: 'wrap' }}>
                    {[['izquierda', leftInst, setLeftInst], ['derecha', rightInst, setRightInst]].map(([side, inst, setInst]) => (
                        <div key={side} style={{ flex: '1 1 380px', minWidth: 300, display: 'flex', flexDirection: 'column', gap: 10, background: '#161d23', borderRadius: 16, padding: 12 }}>
                            <select value={inst} onChange={e => setInst(e.target.value)}
                                style={{ alignSelf: 'center', background: '#0f1419', color: '#00d2d3', border: '1px solid #2f3b44', borderRadius: 10, padding: '6px 14px', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}>
                                {Object.entries(INSTRUMENTS).map(([id, m]) => <option key={id} value={id}>{m.emoji} {m.label}</option>)}
                            </select>
                            <div style={{ flex: 1, minHeight: 300, display: 'flex', alignItems: 'center' }}>
                                <InstrumentBoard inst={inst} trigger={trigger} compact />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* APRENDER */}
            {activeTab === 'aprender' && <Learn playNote={playNote} />}

            {/* ESTUDIO */}
            {activeTab === 'estudio' && (
                <Studio
                    tracks={tracks} playing={playing} globalTempo={globalTempo} setGlobalTempo={setGlobalTempo}
                    loop={loop} setLoop={setLoop} onPlayAll={playAll} onStop={stopTransport}
                    onPlayOne={(t) => playTracks([{ ...t, muted: false }])}
                    updTrack={updTrack} delTrack={delTrack} quantize={quantize}
                    clearAll={() => { stopTransport(); setTracks([]); }}
                    goRecord={() => setActiveTab('piano')}
                />
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Tablero de un instrumento (reutilizable: solo o dúo)
// ─────────────────────────────────────────────────────────────────────────────
function InstrumentBoard({ inst, trigger, compact, litSet }) {
    const [activeKeys, setActiveKeys] = useState(() => new Set());
    const [frets, setFrets] = useState(() => [0, 0, 0, 0, 0, 0]);
    const strumLast = useRef(new Map());

    const flash = (id) => {
        setActiveKeys(prev => { const n = new Set(prev); n.add(id); return n; });
        setTimeout(() => setActiveKeys(prev => { const n = new Set(prev); n.delete(id); return n; }), 160);
    };
    const isLit = (id) => activeKeys.has(id) || (litSet && litSet.has(id));
    const hit = (inst2, payload, id) => { trigger(inst2, payload, id); flash(id); };

    const ww = compact ? 34 : WHITE_W;
    const bw = compact ? 22 : BLACK_W;

    const pianoScrollRef = (el) => {
        if (!el) return;
        const c4 = PIANO_KEYS.findIndex(x => x.name === 'C4');
        const whitesBeforeC4 = PIANO_KEYS.filter((k, i) => k.type === 'white' && i < c4).length;
        el.scrollLeft = whitesBeforeC4 * ww - el.clientWidth / 2 + ww;
    };

    // Guitarra
    const pluckString = (i) => hit('guitarra', { freq: GUITAR_BASE[i] * Math.pow(2, frets[i] / 12) }, 's' + i);
    const handleStrum = (e) => {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const node = el && el.closest('[data-stringidx]');
        if (!node) return;
        const i = Number(node.dataset.stringidx);
        if (strumLast.current.get(e.pointerId) === i) return;
        strumLast.current.set(e.pointerId, i);
        pluckString(i);
    };
    const endStrum = (e) => strumLast.current.delete(e.pointerId);

    const wrap = { width: '100%', height: compact ? 320 : 380, position: 'relative' };

    if (inst === 'piano') {
        const whiteCount = PIANO_KEYS.filter(k => k.type === 'white').length;
        return (
            <div style={wrap}>
                <div ref={pianoScrollRef} style={{ width: '100%', height: '100%', overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch', display: 'flex', touchAction: 'pan-x' }}>
                    <div style={{ position: 'relative', width: whiteCount * ww, height: '100%', margin: 'auto 0' }}>
                        {PIANO_KEYS.map((key, index) => {
                            const isWhite = key.type === 'white';
                            const whiteBefore = PIANO_KEYS.filter((k, i) => k.type === 'white' && i < index).length;
                            const lit = isLit(key.name);
                            const isC = key.name[0] === 'C' && key.name[1] !== '#';
                            const style = isWhite ? {
                                position: 'absolute', left: whiteBefore * ww, top: 0, width: ww, height: '100%',
                                backgroundColor: lit ? '#dcdde1' : '#fff', border: '1px solid #111', borderRadius: '0 0 8px 8px', zIndex: 1, cursor: 'pointer',
                                display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 14, color: '#2f3640', fontWeight: 'bold', fontSize: '0.58rem', boxShadow: '0 6px 10px rgba(0,0,0,0.3)', touchAction: 'pan-x', boxSizing: 'border-box',
                            } : {
                                position: 'absolute', left: whiteBefore * ww - bw / 2, top: 0, width: bw, height: '62%',
                                backgroundColor: lit ? '#2e86de' : '#1e272e', border: '1px solid #000', borderRadius: '0 0 5px 5px', zIndex: 2, cursor: 'pointer',
                                boxShadow: '0 4px 8px rgba(0,0,0,0.5)', touchAction: 'pan-x', boxSizing: 'border-box',
                            };
                            return <div key={key.name} style={style} onPointerDown={(e) => { e.preventDefault(); hit('piano', { freq: key.freq }, key.name); }}>{isWhite && isC ? key.name : ''}</div>;
                        })}
                    </div>
                </div>
            </div>
        );
    }

    if (inst === 'xilofono') {
        return (
            <div style={{ ...wrap, display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
                {NOTES_XYLO.map((note, index) => {
                    const h = 100 - index * 6; const lit = isLit(note.name);
                    return (
                        <div key={note.name} onPointerDown={(e) => { e.preventDefault(); hit('xilofono', { freq: note.freq }, note.name); }}
                            style={{ width: '11%', height: `${h}%`, backgroundColor: note.color, borderRadius: 12,
                                boxShadow: lit ? 'inset 0 0 25px rgba(0,0,0,0.8)' : '0 10px 16px rgba(0,0,0,0.4), inset 0 4px 4px rgba(255,255,255,0.3)',
                                cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', padding: '22px 0', boxSizing: 'border-box',
                                transform: lit ? 'scale(0.94)' : 'scale(1)', transition: 'transform 0.08s ease', touchAction: 'none' }}>
                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#f1f2f6', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.4)' }} />
                            <span style={{ fontWeight: 800, fontSize: compact ? '1rem' : '1.3rem', color: '#fff', textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>{note.name}</span>
                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#f1f2f6', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.4)' }} />
                        </div>
                    );
                })}
            </div>
        );
    }

    if (inst === 'bateria') {
        return (
            <div style={{ ...wrap, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ position: 'relative', width: 560, height: 380, transform: compact ? 'scale(0.62)' : 'none' }}>
                    <Pad lit={isLit('kick')} onHit={() => hit('bateria', { type: 'kick' }, 'kick')} style={{ bottom: 15, left: '50%', width: 190, height: 190, marginLeft: -95, backgroundColor: '#2f3542', border: '12px solid #ced6e0' }} label="BOMBO" lc="#fff" />
                    <Pad lit={isLit('snare')} onHit={() => hit('bateria', { type: 'snare' }, 'snare')} style={{ bottom: 50, left: '4%', width: 140, height: 140, backgroundColor: '#747d8c', border: '8px solid #f1f2f6' }} label="CAJA" lc="#111" />
                    <Pad lit={isLit('tom')} onHit={() => hit('bateria', { type: 'tom' }, 'tom')} style={{ top: 30, left: '30%', width: 125, height: 125, backgroundColor: '#57606f', border: '6px solid #ced6e0' }} label="TOM" lc="#fff" />
                    <Pad lit={isLit('hihat')} onHit={() => hit('bateria', { type: 'hihat' }, 'hihat')} style={{ top: 15, left: '2%', width: 150, height: 36, backgroundColor: '#eccc68', border: '3px solid #ffa502' }} label="HI-HAT" lc="#57606f" />
                    <Pad lit={isLit('crash')} onHit={() => hit('bateria', { type: 'crash' }, 'crash')} style={{ top: 15, right: '2%', width: 175, height: 42, backgroundColor: '#ffa502', border: '3px solid #ff7f50' }} label="CRASH" lc="#fff" />
                </div>
            </div>
        );
    }

    // guitarra
    return (
        <div style={{ ...wrap, display: 'flex', backgroundColor: '#2c1505', borderRadius: 14, border: '5px solid #1a0d03', boxShadow: 'inset 0 0 30px #000', boxSizing: 'border-box', overflow: 'hidden' }}>
            <div style={{ flex: '0 0 46%', display: 'flex', flexDirection: 'column', padding: '10px 6px', boxSizing: 'border-box', borderRight: '4px solid #d9b382' }}>
                <div style={{ display: 'flex', fontSize: '0.6rem', color: '#c9a27a', fontWeight: 700, paddingLeft: 50, marginBottom: 2 }}>
                    {Array.from({ length: FRET_COUNT + 1 }, (_, f) => <div key={f} style={{ flex: 1, textAlign: 'center' }}>{f === 0 ? 'Aire' : f}</div>)}
                </div>
                {GUITAR_STRINGS.map((name, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                        <span style={{ width: 50, fontSize: '0.62rem', fontWeight: 'bold', color: '#ff7f50' }}>{name}</span>
                        {Array.from({ length: FRET_COUNT + 1 }, (_, f) => {
                            const held = frets[i] === f;
                            return (
                                <div key={f} onPointerDown={(e) => { e.preventDefault(); setFrets(prev => { const n = [...prev]; n[i] = f; return n; }); }}
                                    style={{ flex: 1, height: '74%', margin: '0 2px', borderRadius: 6, cursor: 'pointer',
                                        border: f === 0 ? '1px dashed #6b4a28' : '1px solid #4a2810',
                                        background: held ? '#00d2d3' : 'rgba(0,0,0,0.18)', boxShadow: held ? '0 0 12px #00d2d3aa' : 'none',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none' }}>
                                    {held && <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff' }} />}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
            <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-around', padding: '14px 16px', boxSizing: 'border-box', touchAction: 'none' }}
                onPointerDown={(e) => { e.preventDefault(); handleStrum(e); }}
                onPointerMove={(e) => { if (e.pressure > 0 || e.buttons || strumLast.current.has(e.pointerId)) handleStrum(e); }}
                onPointerUp={endStrum} onPointerCancel={endStrum} onPointerLeave={endStrum}>
                <div style={{ position: 'absolute', top: 6, right: 12, fontSize: '0.6rem', color: '#c9a27a' }}>↕ rasguea aquí</div>
                {GUITAR_STRINGS.map((name, i) => {
                    const lit = isLit('s' + i);
                    return (
                        <div key={i} data-stringidx={i} style={{ position: 'relative', height: 28, display: 'flex', alignItems: 'center' }}>
                            <div style={{ width: '100%', height: `${2 + i * 1.3}px`, background: lit ? '#00d2d3' : '#cbd5e1',
                                boxShadow: lit ? '0 0 10px #00d2d3' : '0 3px 6px rgba(0,0,0,0.9)',
                                transform: lit ? 'scaleY(2.2)' : 'scaleY(1)', transition: 'transform 0.05s' }} />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function Pad({ lit, onHit, style, label, lc }) {
    return (
        <div onPointerDown={(e) => { e.preventDefault(); onHit(); }}
            style={{ position: 'absolute', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                boxShadow: '0 10px 20px rgba(0,0,0,0.55)', touchAction: 'none', transform: lit ? 'scale(0.95)' : 'scale(1)', transition: 'transform 0.07s', ...style }}>
            <span style={{ fontWeight: 'bold', color: lc, fontSize: '0.9rem' }}>{label}</span>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Estudio multipista
// ─────────────────────────────────────────────────────────────────────────────
function Studio({ tracks, playing, globalTempo, setGlobalTempo, loop, setLoop, onPlayAll, onStop, onPlayOne, updTrack, delTrack, quantize, clearAll, goRecord }) {
    const dur = (t) => t.events.length ? (t.events[t.events.length - 1].t / 1000).toFixed(1) : '0.0';

    return (
        <div style={{ width: '94%', maxWidth: 980, background: '#1c242b', borderRadius: 24, padding: 22, boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
            {/* Transporte global */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
                {!playing
                    ? <button onClick={onPlayAll} disabled={!tracks.length} style={btn('#10b981', !tracks.length)}>▶ Reproducir todo</button>
                    : <button onClick={onStop} style={btn('#ef4444')}>⏹ Detener</button>}
                <button onClick={() => setLoop(l => !l)} style={btn(loop ? '#a855f7' : '#2f3b44')}>🔁 Bucle {loop ? 'ON' : 'OFF'}</button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Tempo global <b style={{ color: '#00d2d3' }}>{globalTempo.toFixed(2)}×</b></span>
                    <input type="range" min="0.5" max="2" step="0.05" value={globalTempo} onChange={e => setGlobalTempo(Number(e.target.value))} style={{ width: 120, accentColor: '#00d2d3' }} />
                </div>
                {tracks.length > 0 && <button onClick={clearAll} style={{ ...btn('#2f3b44'), marginLeft: 'auto' }}>🗑 Vaciar</button>}
            </div>

            {tracks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px 20px', color: '#7f8c9b' }}>
                    <div style={{ fontSize: 50, marginBottom: 12 }}>🎙️</div>
                    <p style={{ margin: '0 0 18px' }}>Aún no hay pistas grabadas.<br />Ve a un instrumento, pulsa <b style={{ color: '#ef4444' }}>Grabar</b> y toca algo.</p>
                    <button onClick={goRecord} style={btn('#ef4444')}>● Ir a grabar</button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {tracks.map(t => (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: t.muted ? '#161d2310' : '#161d23', borderRadius: 14, padding: '12px 14px', border: `1px solid ${t.color}40`, opacity: t.muted ? 0.5 : 1, flexWrap: 'wrap' }}>
                            {/* Nombre + color */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
                                <span style={{ width: 12, height: 12, borderRadius: '50%', background: t.color }} />
                                <input value={t.name} onChange={e => updTrack(t.id, { name: e.target.value })}
                                    style={{ background: 'transparent', border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.95rem', width: 90, outline: 'none' }} />
                            </div>

                            {/* Mini timeline */}
                            <div style={{ flex: '1 1 160px', height: 30, position: 'relative', background: 'rgba(255,255,255,0.05)', borderRadius: 6, overflow: 'hidden', minWidth: 140 }}>
                                {t.events.map((ev, i) => {
                                    const total = t.events[t.events.length - 1].t || 1;
                                    return <div key={i} style={{ position: 'absolute', left: `${(ev.t / total) * 97}%`, top: 4, bottom: 4, width: 3, borderRadius: 2, background: t.color }} />;
                                })}
                                <span style={{ position: 'absolute', right: 6, bottom: 2, fontSize: '0.6rem', color: '#7f8c9b' }}>{t.events.length} notas · {dur(t)}s</span>
                            </div>

                            {/* Velocidad */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>Velocidad {t.speed.toFixed(2)}×</span>
                                <input type="range" min="0.5" max="2" step="0.05" value={t.speed} onChange={e => updTrack(t.id, { speed: Number(e.target.value) })} style={{ width: 90, accentColor: t.color }} />
                            </div>
                            {/* Volumen */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>Volumen</span>
                                <input type="range" min="0" max="1" step="0.05" value={t.volume} onChange={e => updTrack(t.id, { volume: Number(e.target.value) })} style={{ width: 70, accentColor: t.color }} />
                            </div>

                            {/* Acciones */}
                            <button onClick={() => onPlayOne(t)} title="Escuchar pista" style={iconBtn}>▶</button>
                            <button onClick={() => quantize(t.id)} title="Cuantizar ritmo (1/8)" style={iconBtn}>⊞</button>
                            <button onClick={() => updTrack(t.id, { muted: !t.muted })} title="Silenciar" style={iconBtn}>{t.muted ? '🔇' : '🔊'}</button>
                            <button onClick={() => delTrack(t.id)} title="Eliminar" style={{ ...iconBtn, color: '#ef4444' }}>🗑</button>
                        </div>
                    ))}
                    <button onClick={goRecord} style={{ ...btn('#ef4444'), alignSelf: 'flex-start', marginTop: 4 }}>● Grabar otra pista</button>
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Biblioteca de canciones + modo Aprender (tramos de 5 notas)
// ─────────────────────────────────────────────────────────────────────────────
const SONGS = {
    piano: [
        { title: 'Escala de Do', notes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'] },
        { title: 'Estrellita', notes: ['C4', 'C4', 'G4', 'G4', 'A4', 'A4', 'G4', 'F4', 'F4', 'E4', 'E4', 'D4', 'D4', 'C4'] },
        { title: 'Oda a la alegría', notes: ['E4', 'E4', 'F4', 'G4', 'G4', 'F4', 'E4', 'D4', 'C4', 'C4', 'D4', 'E4', 'E4', 'D4', 'D4'] },
    ],
    xilofono: [
        { title: 'Escala', notes: ['DO', 'RE', 'MI', 'FA', 'SOL', 'LA', 'SI', 'DO↑'] },
        { title: 'Estrellita', notes: ['DO', 'DO', 'SOL', 'SOL', 'LA', 'LA', 'SOL', 'FA', 'FA', 'MI', 'MI', 'RE', 'RE', 'DO'] },
        { title: 'Oda a la alegría', notes: ['MI', 'MI', 'FA', 'SOL', 'SOL', 'FA', 'MI', 'RE', 'DO', 'DO', 'RE', 'MI', 'MI', 'RE', 'RE'] },
    ],
    guitarra: [
        { title: 'Cuerdas al aire', notes: ['s5', 's4', 's3', 's2', 's1', 's0'] },
        { title: 'Vaivén', notes: ['s5', 's4', 's3', 's4', 's5', 's4', 's3', 's2'] },
    ],
    bateria: [
        { title: 'Pulso básico', notes: ['kick', 'snare', 'kick', 'snare', 'kick'] },
        { title: 'Ritmo rock', notes: ['kick', 'kick', 'snare', 'hihat', 'snare'] },
        { title: 'Relleno', notes: ['tom', 'tom', 'snare', 'crash', 'kick'] },
    ],
};
const DRUM_LABEL = { kick: 'Bombo', snare: 'Caja', hihat: 'Hi-Hat', tom: 'Tom', crash: 'Crash' };

function resolveNote(inst, id) {
    if (inst === 'bateria') return { id, type: id };
    if (inst === 'xilofono') return { id, freq: NOTES_XYLO.find(x => x.name === id).freq };
    if (inst === 'guitarra') return { id, freq: GUITAR_BASE[Number(id.slice(1))] };
    return { id, freq: PIANO_KEYS.find(x => x.name === id).freq };
}
function labelFor(inst, id) {
    if (inst === 'bateria') return DRUM_LABEL[id] || id;
    if (inst === 'guitarra') return GUITAR_STRINGS[Number(id.slice(1))].split(' ')[0];
    return id;
}
function chunk(arr, n) { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o; }

function Learn({ playNote }) {
    const [song, setSong]         = useState(null);   // { title, notes, inst }
    const [segIdx, setSegIdx]     = useState(0);
    const [phase, setPhase]       = useState('demo'); // demo | input | segDone | done
    const [inputIdx, setInputIdx] = useState(0);
    const [demoLit, setDemoLit]   = useState(() => new Set());
    const [wrong, setWrong]       = useState(false);
    const timers = useRef([]);
    const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
    useEffect(() => () => clearTimers(), []);

    const segments = useMemo(() => (song ? chunk(song.notes, 5) : []), [song]);
    const seg = (segments[segIdx] || []).map(id => resolveNote(song.inst, id));

    // Suena la demostración del tramo y pasa a "tu turno"
    const playDemo = () => {
        clearTimers();
        setPhase('demo'); setInputIdx(0); setWrong(false);
        let i = 0;
        const step = () => {
            if (i >= seg.length) { setDemoLit(new Set()); setPhase('input'); return; }
            const note = seg[i];
            setDemoLit(new Set([note.id]));
            playNote(song.inst, note);
            i++;
            timers.current.push(setTimeout(() => {
                setDemoLit(new Set());
                timers.current.push(setTimeout(step, 130));
            }, 470));
        };
        step();
    };

    // Auto-reproduce la demo al entrar en un tramo
    useEffect(() => { if (song) playDemo(); /* eslint-disable-next-line */ }, [segIdx, song]);

    const onUserNote = (id) => {
        if (phase !== 'input') return;
        if (id === seg[inputIdx].id) {
            const ni = inputIdx + 1;
            if (ni >= seg.length) {
                clearTimers();
                if (segIdx + 1 >= segments.length) setPhase('done');
                else { setPhase('segDone'); timers.current.push(setTimeout(() => setSegIdx(segIdx + 1), 950)); }
            } else setInputIdx(ni);
        } else {
            setWrong(true);
            timers.current.push(setTimeout(() => setWrong(false), 350));
        }
    };
    const learnTrigger = (inst2, payload, id) => { playNote(inst2, payload); onUserNote(id); };

    // ── Biblioteca ────────────────────────────────────────────────────────────
    if (!song) {
        return (
            <div style={{ width: '94%', maxWidth: 980, background: '#1c242b', borderRadius: 24, padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
                <h2 style={{ margin: '0 0 6px', color: '#00d2d3' }}>🎓 Biblioteca de canciones</h2>
                <p style={{ color: '#7f8c9b', margin: '0 0 20px', fontSize: '0.9rem' }}>Elige una canción. La aprenderás por tramos de 5 notas: suena el tramo y tú lo repites.</p>
                {Object.entries(SONGS).map(([inst, list]) => (
                    <div key={inst} style={{ marginBottom: 20 }}>
                        <div style={{ color: '#a4b0be', fontWeight: 700, marginBottom: 10, fontSize: '0.95rem' }}>{INSTRUMENTS[inst].emoji} {INSTRUMENTS[inst].label}</div>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            {list.map(s => (
                                <button key={s.title} onClick={() => { setSong({ ...s, inst }); setSegIdx(0); }}
                                    style={{ background: '#161d23', border: '1px solid #2f3b44', borderRadius: 14, padding: '14px 18px', cursor: 'pointer', textAlign: 'left', minWidth: 150 }}>
                                    <div style={{ color: '#fff', fontWeight: 700 }}>{s.title}</div>
                                    <div style={{ color: '#7f8c9b', fontSize: '0.75rem', marginTop: 4 }}>{s.notes.length} notas · {chunk(s.notes, 5).length} tramos</div>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // ── Lección ───────────────────────────────────────────────────────────────
    const status = phase === 'demo' ? '👂 Escucha el tramo…'
        : phase === 'input' ? '🎵 Tu turno: repite el tramo'
        : phase === 'segDone' ? '✅ ¡Muy bien! Siguiente tramo…'
        : '🏆 ¡Canción completada!';

    return (
        <div style={{ width: '94%', maxWidth: 980 }}>
            <div style={{ background: '#1c242b', borderRadius: 20, padding: '14px 18px', marginBottom: 14, boxShadow: '0 12px 30px rgba(0,0,0,0.5)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <button onClick={() => { clearTimers(); setSong(null); }} style={btn('#2f3b44')}>← Canciones</button>
                    <div style={{ flex: 1 }}>
                        <div style={{ color: '#fff', fontWeight: 800, fontSize: '1.1rem' }}>{INSTRUMENTS[song.inst].emoji} {song.title}</div>
                        <div style={{ color: '#7f8c9b', fontSize: '0.8rem' }}>Tramo {Math.min(segIdx + 1, segments.length)} de {segments.length}</div>
                    </div>
                    {phase !== 'done' && <button onClick={playDemo} style={btn('#00b3b3')}>🔁 Escuchar</button>}
                    {phase === 'done' && <button onClick={() => { setSegIdx(0); }} style={btn('#10b981')}>↺ Repetir canción</button>}
                </div>

                {/* Barra de progreso por tramos */}
                <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
                    {segments.map((_, i) => (
                        <div key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: i < segIdx || phase === 'done' ? '#10b981' : i === segIdx ? '#00d2d3' : 'rgba(255,255,255,0.12)' }} />
                    ))}
                </div>

                {/* Estado + notas del tramo */}
                <div style={{ marginTop: 12, textAlign: 'center' }}>
                    <div style={{ fontWeight: 700, color: wrong ? '#ef4444' : '#e2e8f0', marginBottom: 10 }}>
                        {wrong ? '❌ Esa no, prueba otra vez' : status}
                    </div>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                        {seg.map((n, idx) => {
                            const done = phase === 'input' && idx < inputIdx;
                            const current = phase === 'input' && idx === inputIdx;
                            const demo = demoLit.has(n.id);
                            const bg = done ? '#10b981' : current ? '#00d2d3' : demo ? '#f59e0b' : '#161d23';
                            const col = done || current || demo ? '#06141a' : '#cbd5e1';
                            return (
                                <span key={idx} style={{ padding: '7px 12px', borderRadius: 10, background: bg, color: col, fontWeight: 700, fontSize: '0.85rem', border: '1px solid #2f3b44', transition: 'all 0.1s' }}>
                                    {labelFor(song.inst, n.id)}
                                </span>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Instrumento para repetir */}
            <div style={{ background: '#1c242b', borderRadius: 24, padding: 24, minHeight: 430, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
                <InstrumentBoard inst={song.inst} trigger={learnTrigger} litSet={demoLit} />
            </div>
        </div>
    );
}

const btn = (bg, disabled) => ({ padding: '10px 18px', borderRadius: 12, border: 'none', cursor: disabled ? 'default' : 'pointer', fontWeight: 700, fontSize: '0.92rem', background: disabled ? '#2f3b4480' : bg, color: '#fff', opacity: disabled ? 0.5 : 1 });
const iconBtn = { width: 38, height: 38, borderRadius: 10, border: '1px solid #2f3b44', background: '#0f1419', color: '#fff', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
