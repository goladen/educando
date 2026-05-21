import { useState, useEffect, useRef } from 'react';

// ── Constants ─────────────────────────────────────────────────────────────────
export const STAFF_LS = 13;
const CNVS_W = 820, CNVS_H = 200;

export const MUSIC_NOTES = [
  { id:'redonda', sym:'𝅝', label:'Redonda' }, { id:'blanca', sym:'𝅗𝅥', label:'Blanca' },
  { id:'negra', sym:'♩', label:'Negra' }, { id:'corchea', sym:'♪', label:'Corchea' },
  { id:'semicorchea', sym:'♬', label:'Semicorchea' }, { id:'fusa', sym:'♫♫', label:'Fusa' },
];
export const MUSIC_RESTS = [
  { id:'s_redonda', sym:'▬', label:'Sil. Redonda' }, { id:'s_blanca', sym:'▭', label:'Sil. Blanca' },
  { id:'s_negra', sym:'𝄽', label:'Sil. Negra' }, { id:'s_corchea', sym:'𝄾', label:'Sil. Corchea' },
];
export const MUSIC_ACCS = [
  { id:'sharp', sym:'♯', label:'Sostenido' }, { id:'flat', sym:'♭', label:'Bemol' }, { id:'natural', sym:'♮', label:'Natural' },
];

// ── MIDI helpers ──────────────────────────────────────────────────────────────
const _TREBLE_MIDI = [84,83,81,79,77,76,74,72,71,69,67,65,64,62,60,59,57,55,53,52,50,48,47];
const _BASS_MIDI   = [62,60,59,57,55,53,52,50,48,47,45,43,41,40,38];

export function yToMidi(noteY, staffItem) {
  if (!staffItem) return 60;
  const step = Math.round((noteY - staffItem.y) / (STAFF_LS / 2));
  if (staffItem.clef === 'fa') return _BASS_MIDI[Math.max(0, Math.min(step + 3, _BASS_MIDI.length - 1))];
  return _TREBLE_MIDI[Math.max(0, Math.min(step + 4, _TREBLE_MIDI.length - 1))];
}

export function midiToName(midi) {
  const n = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
  return `${n[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

export const NOTE_BEATS = {
  redonda:4, blanca:2, negra:1, corchea:0.5, semicorchea:0.25, fusa:0.125,
  s_redonda:4, s_blanca:2, s_negra:1, s_corchea:0.5,
};

// ── Draw functions ────────────────────────────────────────────────────────────
export const drawStaff = (ctx, item) => {
  const ls = item.ls || STAFF_LS;
  ctx.save(); ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(item.x, item.y + i*ls); ctx.lineTo(item.x + item.w, item.y + i*ls); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(item.x, item.y); ctx.lineTo(item.x, item.y + 4*ls); ctx.stroke();
  const clefChar = item.clef === 'fa' ? '𝄢' : '𝄞';
  const clefSize = item.clef === 'fa' ? ls*3.2 : ls*4.8;
  const clefY    = item.clef === 'fa' ? item.y + ls*1.8 : item.y + ls*3.6;
  ctx.fillStyle = '#111'; ctx.font = `${clefSize}px serif`; ctx.textBaseline = 'alphabetic';
  ctx.fillText(clefChar, item.x + 5, clefY); ctx.restore();
};

export const drawNote = (ctx, item) => {
  const ls = item.ls || STAFF_LS;
  const rx = ls*0.65, ry = ls*0.44;
  const { x, y, figura, color: nc = '#111', stemUp = true } = item;
  const sxOff = stemUp ? rx-1 : -rx+1;
  const stemEndY = y + (stemUp ? -ls*3.5 : ls*3.5);
  ctx.save(); ctx.strokeStyle = nc; ctx.fillStyle = nc; ctx.lineWidth = 1.5;
  const head = (filled) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, -0.25, 0, Math.PI*2); if (filled) { ctx.fill(); } else { ctx.fillStyle='white'; ctx.fill(); ctx.strokeStyle=nc; ctx.stroke(); ctx.fillStyle=nc; } };
  const stem = () => { ctx.beginPath(); ctx.moveTo(x+sxOff, y); ctx.lineTo(x+sxOff, stemEndY); ctx.strokeStyle=nc; ctx.stroke(); };
  const flag = (n) => { for (let f=0; f<n; f++) { const fy = stemEndY + f*ls*0.8*(stemUp?1:-1); ctx.beginPath(); ctx.moveTo(x+sxOff, fy); if (stemUp) ctx.bezierCurveTo(x+sxOff+ls*1.8, fy+ls*0.8, x+sxOff+ls*1.4, fy+ls*1.7, x+sxOff+ls*0.2, fy+ls*2.2); else ctx.bezierCurveTo(x+sxOff+ls*1.8, fy-ls*0.8, x+sxOff+ls*1.4, fy-ls*1.7, x+sxOff+ls*0.2, fy-ls*2.2); ctx.strokeStyle=nc; ctx.stroke(); } };
  if (figura==='redonda')     { head(false); }
  if (figura==='blanca')      { head(false); stem(); }
  if (figura==='negra')       { head(true);  stem(); }
  if (figura==='corchea')     { head(true);  stem(); flag(1); }
  if (figura==='semicorchea') { head(true);  stem(); flag(2); }
  if (figura==='fusa')        { head(true);  stem(); flag(3); }
  ctx.restore();
};

export const drawRest = (ctx, item) => {
  const ls = item.ls || STAFF_LS;
  const { x, y, figura, color: c = '#111' } = item;
  ctx.save(); ctx.strokeStyle=c; ctx.fillStyle=c; ctx.lineWidth=1.5;
  if (figura==='s_redonda') { ctx.fillRect(x-ls, y, ls*2, ls*0.55); }
  else if (figura==='s_blanca') { ctx.fillRect(x-ls, y-ls*0.55, ls*2, ls*0.55); }
  else if (figura==='s_negra') { ctx.beginPath(); ctx.moveTo(x+ls*0.4, y-ls*1.2); ctx.lineTo(x-ls*0.5, y-ls*0.2); ctx.lineTo(x+ls*0.4, y+ls*0.2); ctx.lineTo(x-ls*0.4, y+ls*1.2); ctx.stroke(); }
  else if (figura==='s_corchea') { ctx.beginPath(); ctx.moveTo(x+ls*0.5, y-ls*0.8); ctx.lineTo(x-ls*0.4, y+ls*0.8); ctx.stroke(); ctx.beginPath(); ctx.arc(x+ls*0.5, y-ls*0.5, ls*0.35, 0, Math.PI*2); ctx.fill(); }
  ctx.restore();
};

export const drawAccidental = (ctx, item) => {
  const ls = item.ls || STAFF_LS;
  const sym = item.figura==='sharp' ? '♯' : item.figura==='flat' ? '♭' : '♮';
  ctx.save(); ctx.font=`bold ${ls*1.7}px serif`; ctx.fillStyle=item.color||'#111'; ctx.textBaseline='middle'; ctx.textAlign='center'; ctx.fillText(sym, item.x, item.y); ctx.restore();
};

// ── MusicStaffPanel component ─────────────────────────────────────────────────
export default function MusicStaffPanel({ onInsert, onClose }) {
  const [items, setItems] = useState([]);
  const [staffY] = useState(80);
  const [hasStaff, setHasStaff] = useState(false);
  const [selectedTool, setSelectedTool] = useState(null);
  const [cursorX, setCursorX] = useState(null);
  const [bpm, setBpm] = useState(90);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingIdx, setPlayingIdx] = useState(null);
  const canvasRef = useRef(null);
  const acRef = useRef(null);
  const pianoRef = useRef(null);
  const stopRef = useRef(false);

  const drawAll = (ctx, its, curX, pIdx = null) => {
    ctx.clearRect(0, 0, CNVS_W, CNVS_H);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, CNVS_W, CNVS_H);
    its.forEach(item => {
      if (item.t === 'staff') drawStaff(ctx, item);
      else if (item.t === 'note') drawNote(ctx, item);
      else if (item.t === 'rest') drawRest(ctx, item);
      else if (item.t === 'acc') drawAccidental(ctx, item);
    });
    if (curX !== null) {
      ctx.save(); ctx.strokeStyle = '#6c63ff'; ctx.lineWidth = 1.5; ctx.setLineDash([5,3]);
      ctx.beginPath(); ctx.moveTo(curX, 5); ctx.lineTo(curX, CNVS_H-5); ctx.stroke(); ctx.restore();
    }
    if (pIdx !== null) {
      const seq = its.filter(i => i.t==='note'||i.t==='rest').sort((a,b)=>a.x-b.x);
      const pi = seq[pIdx];
      if (pi) {
        ctx.save(); ctx.strokeStyle='#ef4444'; ctx.lineWidth=2.5; ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(pi.x, pi.y, 18, 0, Math.PI*2); ctx.stroke(); ctx.restore();
      }
    }
  };

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    drawAll(cv.getContext('2d'), items, cursorX, playingIdx);
  }, [items, cursorX, playingIdx]); // eslint-disable-line

  const getAC = () => {
    if (!acRef.current) acRef.current = new (window.AudioContext || window.webkitAudioContext)();
    if (acRef.current.state === 'suspended') acRef.current.resume();
    return acRef.current;
  };

  const loadPiano = async () => {
    if (pianoRef.current) return pianoRef.current;
    setIsLoadingAudio(true);
    try {
      const { default: Soundfont } = await import('soundfont-player');
      pianoRef.current = await Soundfont.instrument(getAC(), 'acoustic_grand_piano', { soundfont: 'MusyngKite' });
    } catch (e) {
      alert('No se pudo cargar el piano. Comprueba la conexión a internet.'); throw e;
    } finally { setIsLoadingAudio(false); }
    return pianoRef.current;
  };

  const handlePlay = async () => {
    const seq = items.filter(i => i.t==='note'||i.t==='rest').sort((a,b)=>a.x-b.x);
    if (!seq.length) return;
    const staffItem = items.find(i => i.t==='staff');
    let piano;
    try { piano = await loadPiano(); } catch { return; }
    setIsPlaying(true); stopRef.current = false;
    const secPerBeat = 60 / bpm;
    for (let i = 0; i < seq.length; i++) {
      if (stopRef.current) break;
      setPlayingIdx(i);
      const item = seq[i];
      const dur = (NOTE_BEATS[item.figura] || 1) * secPerBeat;
      if (item.t === 'note') {
        const noteName = midiToName(yToMidi(item.y, staffItem));
        piano.play(noteName, getAC().currentTime, { duration: dur * 0.9, gain: 0.85 });
      }
      await new Promise(r => setTimeout(r, dur * 1000));
    }
    setIsPlaying(false); setPlayingIdx(null);
  };

  const handleStop = () => {
    stopRef.current = true;
    if (pianoRef.current) pianoRef.current.stop();
    setIsPlaying(false); setPlayingIdx(null);
  };

  const canvasCoords = (e) => {
    const cv = canvasRef.current; if (!cv) return null;
    const r = cv.getBoundingClientRect();
    return {
      x: Math.round((e.clientX - r.left) * (CNVS_W / r.width)),
      y: Math.round((e.clientY - r.top)  * (CNVS_H / r.height)),
    };
  };

  const handleCanvasClick = (e) => {
    const pos = canvasCoords(e); if (!pos) return;
    setCursorX(pos.x);
    if (!selectedTool) return;
    if (!hasStaff) { alert('Primero añade un pentagrama'); return; }
    const { x, y } = pos;
    if (selectedTool.t === 'note') {
      setItems(prev => [...prev, { t:'note', figura:selectedTool.figura, x, y, ls:STAFF_LS, color:'#111', stemUp: y >= staffY + STAFF_LS }]);
    } else if (selectedTool.t === 'rest') {
      setItems(prev => [...prev, { t:'rest', figura:selectedTool.figura, x, y, ls:STAFF_LS, color:'#111' }]);
    } else if (selectedTool.t === 'acc') {
      setItems(prev => [...prev, { t:'acc', figura:selectedTool.figura, x, y, ls:STAFF_LS, color:'#111' }]);
    }
  };

  const addStaff = (clef) => {
    setItems(prev => [...prev, { t:'staff', x:30, y:staffY, w:CNVS_W-60, ls:STAFF_LS, clef }]);
    setHasStaff(true); setCursorX(80);
  };
  const undo = () => setItems(prev => {
    const n = [...prev]; n.pop();
    if (!n.some(i => i.t==='staff')) { setHasStaff(false); setCursorX(null); }
    return n;
  });
  const clear = () => { setItems([]); setHasStaff(false); setCursorX(null); setSelectedTool(null); };

  const handleInsert = () => {
    const cv = document.createElement('canvas');
    cv.width = CNVS_W; cv.height = CNVS_H;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, CNVS_W, CNVS_H);
    items.forEach(item => {
      if (item.t === 'staff') drawStaff(ctx, item);
      else if (item.t === 'note') drawNote(ctx, item);
      else if (item.t === 'rest') drawRest(ctx, item);
      else if (item.t === 'acc') drawAccidental(ctx, item);
    });
    onInsert({ imageData: cv.toDataURL('image/png'), items: [...items], bpm });
  };

  const ToolBtn = ({ label, t, figura }) => {
    const active = selectedTool?.t === t && selectedTool?.figura === figura;
    return (
      <button
        onClick={() => setSelectedTool(active ? null : { t, figura })}
        style={{ background: active ? '#6c63ff' : '#374151', color:'#fff', border:`2px solid ${active?'#a78bfa':'transparent'}`, borderRadius:6, padding:'4px 8px', cursor:'pointer', fontSize:11, fontWeight:700, whiteSpace:'nowrap' }}>
        {label}
      </button>
    );
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:3000 }}>
      <div style={{ background:'#1f2937', borderRadius:16, padding:20, width:'95vw', maxWidth:700, maxHeight:'90vh', overflowY:'auto', border:'1px solid #374151' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
          <h3 style={{ margin:0, color:'#fff', fontSize:16, fontWeight:900 }}>🎵 Pentagrama Musical con Sonido</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#9ca3af', fontSize:20, cursor:'pointer' }}>✕</button>
        </div>

        <div style={{ fontSize:11, color: selectedTool ? '#a78bfa' : '#6b7280', marginBottom:10, fontWeight:700, background: selectedTool ? 'rgba(108,99,255,0.12)' : 'transparent', padding:'5px 8px', borderRadius:6 }}>
          {selectedTool ? '✅ Seleccionado — haz clic en el pentagrama para colocar el símbolo' : 'Selecciona un símbolo y haz clic donde quieras colocarlo en el pentagrama'}
        </div>

        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
          <span style={{ fontSize:11, color:'#9ca3af', alignSelf:'center', fontWeight:700 }}>Pentagrama:</span>
          <button onClick={() => addStaff('sol')} style={{ background:'#1d4ed8', color:'#fff', border:'none', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontSize:11, fontWeight:700 }}>𝄞 Clave Sol</button>
          <button onClick={() => addStaff('fa')}  style={{ background:'#1d4ed8', color:'#fff', border:'none', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontSize:11, fontWeight:700 }}>𝄢 Clave Fa</button>
          <button onClick={undo}  style={{ background:'#374151', color:'#9ca3af', border:'none', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontSize:11, fontWeight:700 }}>↩ Deshacer</button>
          <button onClick={clear} style={{ background:'rgba(239,68,68,0.2)', color:'#f87171', border:'none', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontSize:11, fontWeight:700 }}>🗑 Limpiar</button>
        </div>

        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:6 }}>
          <span style={{ fontSize:11, color:'#9ca3af', alignSelf:'center', fontWeight:700 }}>Notas:</span>
          {MUSIC_NOTES.map(n => <ToolBtn key={n.id} label={`${n.sym} ${n.label}`} t="note" figura={n.id} />)}
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:6 }}>
          <span style={{ fontSize:11, color:'#9ca3af', alignSelf:'center', fontWeight:700 }}>Silencios:</span>
          {MUSIC_RESTS.map(r => <ToolBtn key={r.id} label={`${r.sym} ${r.label}`} t="rest" figura={r.id} />)}
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
          <span style={{ fontSize:11, color:'#9ca3af', alignSelf:'center', fontWeight:700 }}>Accidentales:</span>
          {MUSIC_ACCS.map(a => <ToolBtn key={a.id} label={`${a.sym} ${a.label}`} t="acc" figura={a.id} />)}
        </div>

        <div style={{ background:'#fff', borderRadius:8, overflow:'hidden', marginBottom:10, cursor: selectedTool ? 'crosshair' : 'default' }}>
          <canvas ref={canvasRef} width={CNVS_W} height={CNVS_H}
            style={{ width:'100%', height:'auto', display:'block' }}
            onClick={handleCanvasClick} />
        </div>

        {selectedTool && (
          <div style={{ marginBottom:8, textAlign:'center' }}>
            <button onClick={() => setSelectedTool(null)} style={{ background:'rgba(108,99,255,0.15)', color:'#a78bfa', border:'1px solid rgba(108,99,255,0.3)', borderRadius:8, padding:'4px 14px', cursor:'pointer', fontSize:11, fontWeight:700 }}>
              ✕ Deseleccionar
            </button>
          </div>
        )}

        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, background:'rgba(255,255,255,0.04)', borderRadius:10, padding:'8px 12px' }}>
          <span style={{ fontSize:11, color:'#9ca3af', fontWeight:700, whiteSpace:'nowrap' }}>BPM:</span>
          <input type="range" min={40} max={200} value={bpm} onChange={e => setBpm(+e.target.value)} style={{ flex:1, accentColor:'#6c63ff' }} />
          <span style={{ fontSize:12, color:'#e5e7eb', fontWeight:800, minWidth:32, textAlign:'right' }}>{bpm}</span>
          <div style={{ display:'flex', gap:6 }}>
            {isPlaying ? (
              <button onClick={handleStop} style={{ background:'rgba(239,68,68,0.2)', color:'#f87171', border:'1px solid rgba(239,68,68,0.4)', borderRadius:8, padding:'6px 14px', cursor:'pointer', fontWeight:800, fontSize:13 }}>
                ⏹ Stop
              </button>
            ) : (
              <button onClick={handlePlay}
                disabled={isLoadingAudio || items.filter(i=>i.t==='note'||i.t==='rest').length===0}
                style={{ background: isLoadingAudio || !items.some(i=>i.t==='note'||i.t==='rest') ? '#374151' : 'rgba(52,211,153,0.2)', color: isLoadingAudio || !items.some(i=>i.t==='note'||i.t==='rest') ? '#6b7280' : '#34d399', border:'1px solid rgba(52,211,153,0.4)', borderRadius:8, padding:'6px 14px', cursor:'pointer', fontWeight:800, fontSize:13 }}>
                {isLoadingAudio ? '⏳' : '▶ Play'}
              </button>
            )}
          </div>
        </div>

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ background:'#374151', color:'#9ca3af', border:'none', borderRadius:10, padding:'9px 20px', cursor:'pointer', fontWeight:700 }}>Cancelar</button>
          <button onClick={handleInsert} disabled={items.length===0}
            style={{ background: items.length===0 ? '#374151' : '#6c63ff', color:'#fff', border:'none', borderRadius:10, padding:'9px 24px', cursor: items.length===0 ? 'not-allowed' : 'pointer', fontWeight:700 }}>
            📌 Insertar en pizarra
          </button>
        </div>
      </div>
    </div>
  );
}
