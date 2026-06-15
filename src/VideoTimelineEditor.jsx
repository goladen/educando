/**
 * VideoTimelineEditor.jsx — v5
 * CapCut-style, pure inline styles. No Tailwind dependency.
 * Text overlays: draggable on video, 5 visual styles, 8 color presets.
 */
import React, { useReducer, useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { db, auth } from './firebase';
import { addDoc, updateDoc, deleteDoc, doc, collection, getDoc, getDocs, query as fsQuery, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

// ─── Inject hover/focus CSS once ─────────────────────────────────────────────
const VTE_CSS = `
.vte-btn:hover{background:rgba(255,255,255,.07)!important}
.vte-btn-red{background:#ff3838;transition:background .15s}
.vte-btn-red:hover{background:#e82e2e!important}
.vte-btn-light{background:#fff;color:#000;transition:background .15s}
.vte-btn-light:hover{background:#e8e8e8!important}
.vte-btn-ghost:hover{background:#252525!important}
.vte-input:focus{border-color:#3a3a3a!important}
.vte-src-item:hover{background:#1a1a1a!important}
.vte-result-item:hover{background:#1a1a1a!important;border-color:#333!important}
.vte-clip:hover .vte-clip-del{opacity:1!important}
.vte-ovl:hover .vte-ovl-del{opacity:1!important}
.vte-track-hl{background:#111518!important}
.vte-zoom-btn:hover{color:#fff!important}
.vte-zoom-btn.z-on{background:#fff!important;color:#000!important;border-color:#fff!important}
.vte-style-btn:hover{background:#1f1f1f!important}
.vte-style-btn.s-on{background:rgba(253,224,71,.15)!important;color:#fde047!important;border-color:rgba(253,224,71,.3)!important}
.vte-del-btn:hover{background:rgba(220,38,38,.22)!important}
@keyframes vte-typing{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0% 0 0)}}
@keyframes vte-slideleft{from{opacity:0;transform:translateX(-55px)}to{opacity:1;transform:translateX(0)}}
@keyframes vte-slideright{from{opacity:0;transform:translateX(55px)}to{opacity:1;transform:translateX(0)}}
@keyframes vte-fadein{from{opacity:0}to{opacity:1}}
@keyframes vte-bouncein{0%{transform:scale(0);opacity:0}65%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
@keyframes vte-floatup{0%{transform:translateY(0) scale(1);opacity:.9}100%{transform:translateY(-65px) scale(.35);opacity:0}}
.vte-anim-typewriter{overflow:hidden;white-space:nowrap;animation:vte-typing 2.5s steps(28,end) both}
.vte-anim-slide-left{animation:vte-slideleft .55s cubic-bezier(.25,1,.5,1) both}
.vte-anim-slide-right{animation:vte-slideright .55s cubic-bezier(.25,1,.5,1) both}
.vte-anim-fade{animation:vte-fadein .9s ease both}
.vte-anim-bounce{animation:vte-bouncein .55s cubic-bezier(.34,1.56,.64,1) both}
`;
function useVteCss() {
  useEffect(() => {
    if (!document.getElementById('vte-css')) {
      const s = document.createElement('style');
      s.id = 'vte-css'; s.textContent = VTE_CSS;
      document.head.appendChild(s);
    }
  }, []);
}

// ─── YouTube helpers ──────────────────────────────────────────────────────────
function extractId(url) {
  const m = url.match(/(?:v=|\/embed\/|youtu\.be\/|\/v\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}
const thumb = (id, q = 'mqdefault') => `https://img.youtube.com/vi/${id}/${q}.jpg`;

async function oEmbed(id) {
  try {
    const r = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
    if (!r.ok) throw new Error();
    const d = await r.json();
    return { title: d.title };
  } catch { return { title: `Vídeo ${id.slice(0, 6)}` }; }
}

async function ytSearch(q, fallbackKey = '') {
  // Try server proxy first (Vercel YOUTUBE_API_KEY)
  try {
    const r = await fetch(`/api/youtube?type=search&q=${encodeURIComponent(q)}`);
    if (r.ok) return await r.json();
  } catch {}
  // Fallback: direct call with locally stored key (local dev)
  if (!fallbackKey) throw new Error('Busca en Vercel o añade una YouTube API Key para desarrollo local.');
  const r = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&type=video&maxResults=10&key=${fallbackKey}`);
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e?.error?.message || `Error ${r.status}`); }
  const d = await r.json();
  return (d.items || []).map(i => ({ id: i.id.videoId, title: i.snippet.title, channel: i.snippet.channelTitle, thumb: i.snippet.thumbnails.medium?.url || thumb(i.id.videoId) }));
}

function isoDur(str) {
  const m = str.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 300;
}
async function ytDuration(id, fallbackKey = '') {
  // Try server proxy first
  try {
    const r = await fetch(`/api/youtube?type=duration&id=${id}`);
    if (r.ok) { const d = await r.json(); return d.seconds || 300; }
  } catch {}
  // Fallback: direct call with locally stored key
  try {
    if (!fallbackKey) return 300;
    const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${id}&key=${fallbackKey}`);
    const d = await r.json();
    return isoDur(d.items?.[0]?.contentDetails?.duration || '');
  } catch { return 300; }
}

// ─── Multi-player YouTube hook ────────────────────────────────────────────────
function useMultiYTPlayer({ onTime }) {
  const playersRef   = useRef({});   // { id_yt: YT.Player }
  const readyRef     = useRef({});   // { id_yt: true }
  const timerRef     = useRef(null);
  const primaryRef   = useRef(null); // id_yt of player driving onTime
  const clipStartRef = useRef(0);    // clip.start - clip.videoOffset for primary player → converts yt-time → timeline-time
  const [playing, setPlaying] = useState(false);

  const loadAPI = () => new Promise(res => {
    if (window.YT?.Player) return res();
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s);
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (prev) prev(); res(); };
  });

  const initPlayer = useCallback(async (id_yt) => {
    if (playersRef.current[id_yt]) return;
    await loadAPI();
    playersRef.current[id_yt] = new window.YT.Player(`yt-inner-${id_yt}`, {
      videoId: id_yt,
      playerVars: { controls: 0, disablekb: 1, modestbranding: 1, rel: 0, iv_load_policy: 3 },
      events: {
        onReady: () => {
          readyRef.current[id_yt] = true;
          playersRef.current[id_yt].pauseVideo();
          if (!primaryRef.current) primaryRef.current = id_yt;
        },
        onStateChange: e => {
          if (id_yt !== primaryRef.current) return;
          const isP = e.data === window.YT?.PlayerState?.PLAYING;
          setPlaying(isP); clearInterval(timerRef.current);
          if (isP) timerRef.current = setInterval(() => {
            try { onTime(playersRef.current[id_yt].getCurrentTime() + clipStartRef.current); } catch {}
          }, 150);
        },
      },
    });
  }, []);

  const removePlayer = useCallback((id_yt) => {
    try { playersRef.current[id_yt]?.destroy(); } catch {}
    delete playersRef.current[id_yt];
    delete readyRef.current[id_yt];
    if (primaryRef.current === id_yt) primaryRef.current = Object.keys(readyRef.current)[0] || null;
  }, []);

  const eachReady = fn => Object.entries(readyRef.current).forEach(([id, ok]) => { if (ok) fn(playersRef.current[id]); });
  const seekAll  = useCallback(t       => eachReady(p => p.seekTo(t, true)), []);
  const seekOne  = useCallback((id, t) => { try { if (readyRef.current[id]) playersRef.current[id]?.seekTo(t, true); } catch {} }, []);
  const playAll  = useCallback(()      => eachReady(p => p.playVideo()), []);
  const playOne  = useCallback(id      => { try { if (readyRef.current[id]) playersRef.current[id]?.playVideo(); } catch {} }, []);
  const pauseAll = useCallback(()      => eachReady(p => p.pauseVideo()), []);
  const pauseOne = useCallback(id      => { try { if (readyRef.current[id]) playersRef.current[id]?.pauseVideo(); } catch {} }, []);
  const toggle   = useCallback(()      => playing ? pauseAll() : playAll(), [playing, pauseAll, playAll]);

  const setRate  = useCallback((id_yt, rate) => {
    try { if (readyRef.current[id_yt]) playersRef.current[id_yt]?.setPlaybackRate(rate); } catch {}
  }, []);
  const setVol   = useCallback((id_yt, vol) => {
    try { if (readyRef.current[id_yt]) playersRef.current[id_yt]?.setVolume(vol); } catch {}
  }, []);

  useEffect(() => () => clearInterval(timerRef.current), []);
  return { initPlayer, removePlayer, seekAll, seekOne, playAll, playOne, pauseAll, pauseOne, toggle, playing, setRate, setVol, primaryRef, clipStartRef };
}

// ─── Constants ────────────────────────────────────────────────────────────────
const TRACK_H  = 52;
const HEADER_W = 72;
const TEXT_H   = 28;

const SRC_PALETTE = [
  { bg: '#3b82f6' }, { bg: '#10b981' }, { bg: '#f59e0b' },
  { bg: '#ec4899' }, { bg: '#8b5cf6' }, { bg: '#06b6d4' },
];

const p2s = (px, w, dur) => Math.max(0, Math.min(dur, (px / w) * dur));
const s2p = (s, dur) => (s / dur) * 100;
const fmt = s => `${Math.floor(s / 60).toString().padStart(2, '0')}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

// Text overlay visual presets
const OVL_PRESETS = {
  title:    { fontSize: 32, fontWeight: 800, textShadow: '0 2px 12px rgba(0,0,0,.9)' },
  subtitle: { fontSize: 20, fontWeight: 600, textShadow: '0 1px 8px rgba(0,0,0,.8)' },
  caption:  { fontSize: 13, fontWeight: 400, textShadow: '0 1px 4px rgba(0,0,0,.7)' },
  box:      { fontSize: 16, fontWeight: 700, textShadow: 'none', padding: '4px 12px', background: 'rgba(0,0,0,.65)', borderRadius: 6 },
  neon:     { fontSize: 24, fontWeight: 800, isNeon: true },
};
const OVL_COLORS = ['#ffffff', '#fde047', '#fb923c', '#f87171', '#a78bfa', '#34d399', '#38bdf8', '#000000'];
const OVL_STYLE_LABELS = [['title','Grande'],['subtitle','Subtítulo'],['caption','Pequeño'],['box','Caja'],['neon','Neón']];
const OVL_ANIMS = [['none','Sin anim.'],['slide-left','← Entrada'],['slide-right','Entrada →'],['fade','Aparecer'],['typewriter','Máquina'],['bounce','Rebotar']];
const OVL_PARTICLES = [['none','Sin efecto'],['hearts','Corazones ❤️'],['stars','Estrellas ⭐'],['sparkles','Destellos ✨']];

// Default track layout: track 1 full-screen, 2-4 as small PiP corners
const TRACK_DEFAULTS = [
  { x: 0,  y: 0,  w: 100, h: 100, rotation: 0, volume: 100, opacity: 1 },
  { x: 68, y: 62, w: 32,  h: 32,  rotation: 0, volume: 100, opacity: 1 },
  { x: 68, y: 6,  w: 32,  h: 32,  rotation: 0, volume: 100, opacity: 1 },
  { x: 0,  y: 62, w: 32,  h: 32,  rotation: 0, volume: 100, opacity: 1 },
];

// ─── Reducer ──────────────────────────────────────────────────────────────────
const INIT = {
  sources: [],
  tracks: [1,2,3,4].map((n, i) => ({ id: `t${n}`, label: `Pista ${n}`, clips: [], ...TRACK_DEFAULTS[i] })),
  overlays: [], questions: [], playhead: 0, duration: 300, selId: null, hlSrc: null,
  _nc: 1, _no: 1, _ns: 1, _nq: 1,
};

function R(st, a) {
  switch (a.type) {
    case 'ADD_SRC': {
      const id = `src${st._ns}`;
      return { ...st, sources: [...st.sources, { id, title: a.title, id_yt: a.id_yt, thumb: a.thumb, dur: a.dur, ci: (st._ns - 1) % SRC_PALETTE.length }], duration: Math.max(st.duration, a.dur), hlSrc: id, _ns: st._ns + 1 };
    }
    case 'DEL_SRC': return { ...st, sources: st.sources.filter(s => s.id !== a.id), tracks: st.tracks.map(t => ({ ...t, clips: t.clips.filter(c => c.src !== a.id) })), hlSrc: st.hlSrc === a.id ? null : st.hlSrc };
    case 'HL_SRC':  return { ...st, hlSrc: st.hlSrc === a.id ? null : a.id };
    case 'ADD_CLIP': {
      const id = `c${st._nc}`; const src = st.sources.find(s => s.id === a.src); if (!src) return st;
      const dur = Math.min(src.dur, st.duration - a.start); if (dur < 1) return st;
      return { ...st, tracks: st.tracks.map(t => t.id === a.track ? { ...t, clips: [...t.clips, { id, src: a.src, start: a.start, dur, speed: 1, videoOffset: 0 }] } : t), selId: id, _nc: st._nc + 1 };
    }
    case 'UPD_CLIP':  return { ...st, tracks: st.tracks.map(t => ({ ...t, clips: t.clips.map(c => c.id === a.id ? { ...c, ...a.u } : c) })) };
    case 'UPD_TRACK': return { ...st, tracks: st.tracks.map(t => t.id === a.id ? { ...t, ...a.u } : t) };
    case 'DEL_CLIP': return { ...st, tracks: st.tracks.map(t => ({ ...t, clips: t.clips.filter(c => c.id !== a.id) })), selId: st.selId === a.id ? null : st.selId };
    case 'SPLIT': {
      let nc = st._nc; const ph = st.playhead;
      const tracks = st.tracks.map(t => {
        const c = t.clips.find(x => (a.id ? x.id === a.id : true) && ph > x.start + .5 && ph < x.start + x.dur - .5);
        if (!c) return t;
        const ld = ph - c.start; const rid = `c${nc++}`;
        return { ...t, clips: t.clips.map(x => x.id === c.id ? { ...x, dur: ld } : x).concat({ ...c, id: rid, start: ph, dur: c.dur - ld, videoOffset: (c.videoOffset || 0) + ld }) };
      });
      return { ...st, tracks, _nc: nc };
    }
    case 'ADD_OVL': {
      const id = `o${st._no}`;
      return { ...st, overlays: [...st.overlays, { id, start: a.start, dur: 6, text: 'Título', style: 'title', color: '#ffffff', x: 50, y: 82, anim: 'none', particles: 'none' }], selId: id, _no: st._no + 1 };
    }
    case 'UPD_OVL': return { ...st, overlays: st.overlays.map(o => o.id === a.id ? { ...o, ...a.u } : o) };
    case 'DEL_OVL': return { ...st, overlays: st.overlays.filter(o => o.id !== a.id), selId: st.selId === a.id ? null : st.selId };
    case 'SEEK':    return { ...st, playhead: Math.max(0, Math.min(st.duration, a.t)) };
    case 'SEL':     return { ...st, selId: a.id };
    case 'SET_DUR': return { ...st, duration: Math.max(st.playhead + 10, a.dur) };
    case 'ADD_Q': {
      const id = `q${st._nq}`;
      return { ...st, questions: [...(st.questions||[]), { id, start: a.start, label: `Test ${st._nq}`, preguntas: [] }], selId: id, _nq: st._nq + 1 };
    }
    case 'UPD_Q': return { ...st, questions: (st.questions||[]).map(q => q.id === a.id ? { ...q, ...a.u } : q) };
    case 'DEL_Q': return { ...st, questions: (st.questions||[]).filter(q => q.id !== a.id), selId: st.selId === a.id ? null : st.selId };
    case 'LOAD_STATE': {
      const vd = a.vteData || {};
      const fromArr = (arr, fn) => arr && arr.length > 0 ? Math.max(...arr.map(fn)) : 0;
      return {
        ...INIT,
        sources:   vd.sources   || [],
        tracks:    vd.tracks    || INIT.tracks,
        overlays:  vd.overlays  || [],
        questions: vd.questions || [],
        duration:  vd.duration  || 300,
        _ns: fromArr(vd.sources,   s => +s.id.replace('src','') || 0) + 1,
        _nc: fromArr((vd.tracks||[]).flatMap(t => t.clips), c => +c.id.replace('c','') || 0) + 1,
        _no: fromArr(vd.overlays,  o => +o.id.replace('o','') || 0) + 1,
        _nq: fromArr(vd.questions, q => +q.id.replace('q','') || 0) + 1,
      };
    }
    default:        return st;
  }
}

// ─── ClipBlock ────────────────────────────────────────────────────────────────
function ClipBlock({ clip, src, tlRef, dur, isSel, onUpd, onDel, onSel, onSeek }) {
  const dr  = useRef(null);
  const pal = SRC_PALETTE[src?.ci ?? 0];

  function pd(e, h) { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); dr.current = { h, x0: e.clientX, s0: clip.start, d0: clip.dur, moved: false }; }
  function pm(e, h) {
    if (!dr.current || dr.current.h !== h) return;
    const cw = tlRef.current?.getBoundingClientRect().width; if (!cw) return;
    const dx = e.clientX - dr.current.x0; if (Math.abs(dx) > 3) dr.current.moved = true; if (!dr.current.moved) return;
    const ds = (dx / cw) * dur;
    if (h === 'body') onUpd(clip.id, { start: Math.round(Math.max(0, Math.min(dur - dr.current.d0, dr.current.s0 + ds)) * 10) / 10 });
    else if (h === 'L') { const ns = Math.max(0, Math.min(dr.current.s0 + dr.current.d0 - 1, dr.current.s0 + ds)); onUpd(clip.id, { start: Math.round(ns * 10) / 10, dur: Math.max(1, Math.round((dr.current.d0 - (ns - dr.current.s0)) * 10) / 10) }); }
    else onUpd(clip.id, { dur: Math.max(1, Math.round(Math.min(dur - dr.current.s0, dr.current.d0 + ds) * 10) / 10) });
  }
  function pu(e, h) { e.currentTarget.releasePointerCapture(e.pointerId); if (dr.current && !dr.current.moved && h === 'body') { onSel(clip.id); onSeek(clip.start); } dr.current = null; }

  const hp = h => ({ onPointerDown: e => pd(e,h), onPointerMove: e => pm(e,h), onPointerUp: e => pu(e,h), onPointerCancel: () => { dr.current = null; } });

  return (
    <div className="vte-clip" style={{ position:'absolute', top:4, bottom:4, left:`${s2p(clip.start,dur)}%`, width:`${Math.max(s2p(clip.dur,dur),.4)}%`, minWidth:10, backgroundImage: src?.thumb ? `url(${src.thumb})` : 'none', backgroundSize:'cover', backgroundPosition:'center', borderRadius:6, border:`2px solid ${isSel ? '#fff' : pal.bg}`, boxShadow: isSel ? `0 0 0 2px ${pal.bg}55` : 'none', overflow:'visible', userSelect:'none' }}>
      <div style={{ position:'absolute', inset:0, borderRadius:4, background:`${pal.bg}${isSel ? 'bb':'99'}` }} />
      {/* L handle */}
      <div data-handle {...hp('L')} style={{ position:'absolute', left:-8, top:0, bottom:0, width:16, display:'flex', alignItems:'center', justifyContent:'center', cursor:'ew-resize', zIndex:10, touchAction:'none' }}>
        <div style={{ width:2, height:20, background:'rgba(255,255,255,.7)', borderRadius:2 }} />
      </div>
      {/* Body */}
      <div style={{ position:'absolute', inset:0, zIndex:1, display:'flex', flexDirection:'column', justifyContent:'center', padding:'0 12px', overflow:'hidden', cursor:'grab', touchAction:'none' }}
        onPointerDown={e => { if (e.target.closest?.('[data-handle]')) return; pd(e,'body'); }}
        onPointerMove={e => pm(e,'body')} onPointerUp={e => pu(e,'body')} onPointerCancel={() => { dr.current=null; }} onClick={e => e.stopPropagation()}>
        <span style={{ color:'#fff', fontSize:10, fontWeight:600, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', lineHeight:1.3, pointerEvents:'none', filter:'drop-shadow(0 1px 2px #000)' }}>{src?.title ?? 'Clip'}</span>
        <span style={{ color:'rgba(255,255,255,.6)', fontSize:9, fontFamily:'monospace', pointerEvents:'none' }}>{fmt(clip.dur)}{clip.speed !== 1 ? ` · ${clip.speed}×` : ''}</span>
      </div>
      {/* R handle */}
      <div data-handle {...hp('R')} style={{ position:'absolute', right:-8, top:0, bottom:0, width:16, display:'flex', alignItems:'center', justifyContent:'center', cursor:'ew-resize', zIndex:10, touchAction:'none' }}>
        <div style={{ width:2, height:20, background:'rgba(255,255,255,.7)', borderRadius:2 }} />
      </div>
      <button className="vte-clip-del" data-handle onClick={e => { e.stopPropagation(); onDel(clip.id); }} style={{ position:'absolute', top:-8, right:-4, width:16, height:16, borderRadius:'50%', background:'#dc2626', color:'#fff', fontSize:9, display:'flex', alignItems:'center', justifyContent:'center', opacity:0, border:'none', cursor:'pointer', zIndex:20, transition:'opacity .15s' }}>×</button>
    </div>
  );
}

// ─── ParticleEffect — floating hearts / stars around a text overlay ──────────
const PARTICLE_EMOJIS = { hearts: ['❤️','💕','💗'], stars: ['⭐','🌟','✨'], sparkles: ['✨','💫','🌟'] };
function ParticleEffect({ type }) {
  const emojis = PARTICLE_EMOJIS[type] || PARTICLE_EMOJIS.stars;
  const ptcls = React.useMemo(() => Array.from({ length: 9 }, (_, i) => ({
    left:  8 + (i / 9) * 84,
    dur:   1.8 + (i % 4) * 0.35,
    delay: (i * 0.32) % 2.6,
    size:  12 + (i % 3) * 5,
    emoji: emojis[i % emojis.length],
  })), [type]);
  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'visible', zIndex:0 }}>
      {ptcls.map((p, i) => (
        <span key={i} style={{ position:'absolute', left:`${p.left}%`, top:'55%', fontSize:p.size, lineHeight:1, userSelect:'none',
          animation:`vte-floatup ${p.dur}s ${p.delay}s ease-out infinite`, display:'block' }}>{p.emoji}</span>
      ))}
    </div>
  );
}

// ─── TextOverlayBlock (timeline track) ───────────────────────────────────────
function TextOverlayBlock({ ovl, tlRef, dur, isSel, onUpd, onDel, onSel }) {
  const dr = useRef(null);
  function pd(e,h) { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); dr.current = { h, x0:e.clientX, s0:ovl.start, d0:ovl.dur, moved:false }; }
  function pm(e,h) {
    if (!dr.current || dr.current.h !== h) return;
    const cw = tlRef.current?.getBoundingClientRect().width; if (!cw) return;
    const dx = e.clientX - dr.current.x0; if (Math.abs(dx) > 3) dr.current.moved = true; if (!dr.current.moved) return;
    const ds = (dx / cw) * dur;
    if (h==='body') onUpd(ovl.id, { start: Math.max(0, Math.min(dur - dr.current.d0, dr.current.s0 + ds)) });
    else onUpd(ovl.id, { dur: Math.max(1, Math.min(dur - dr.current.s0, dr.current.d0 + ds)) });
  }
  function pu(e,h) { e.currentTarget.releasePointerCapture(e.pointerId); if (dr.current && !dr.current.moved && h==='body') onSel(ovl.id); dr.current = null; }
  return (
    <div className="vte-ovl" style={{ position:'absolute', top:2, bottom:2, left:`${s2p(ovl.start,dur)}%`, width:`${Math.max(s2p(ovl.dur,dur),.4)}%`, minWidth:10, background:'rgba(253,224,71,.35)', border:`1.5px solid ${isSel?'#fde047':'#ca8a04'}`, borderRadius:4, overflow:'visible', boxShadow: isSel ? '0 0 0 1px #fde04744':'none' }}>
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', padding:'0 6px', overflow:'hidden', cursor:'grab', touchAction:'none' }}
        onPointerDown={e => { if (e.target.closest?.('[data-handle]')) return; pd(e,'body'); }} onPointerMove={e => pm(e,'body')} onPointerUp={e => pu(e,'body')} onPointerCancel={()=>{dr.current=null;}} onClick={e=>e.stopPropagation()}>
        <span style={{ color:'#713f12', fontSize:9, fontWeight:700, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', pointerEvents:'none' }}>T {ovl.text}</span>
      </div>
      <div data-handle style={{ position:'absolute', right:-4, top:0, bottom:0, width:10, display:'flex', alignItems:'center', cursor:'ew-resize', zIndex:10, touchAction:'none' }} onPointerDown={e=>pd(e,'R')} onPointerMove={e=>pm(e,'R')} onPointerUp={e=>pu(e,'R')} onPointerCancel={()=>{dr.current=null;}}>
        <div style={{ width:2, height:12, background:'rgba(113,63,18,.6)', borderRadius:1 }} />
      </div>
      <button className="vte-ovl-del" data-handle onClick={e=>{e.stopPropagation();onDel(ovl.id);}} style={{ position:'absolute', top:-6, right:-2, width:14, height:14, borderRadius:'50%', background:'#dc2626', color:'#fff', fontSize:8, display:'flex', alignItems:'center', justifyContent:'center', opacity:0, border:'none', cursor:'pointer', zIndex:20, transition:'opacity .15s' }}>×</button>
    </div>
  );
}

// ─── TextOverlayOnVideo — draggable on the monitor ────────────────────────────
function TextOverlayOnVideo({ ovl, videoRef, isSel, onSel, onMove }) {
  const dr = useRef(null);
  const preset = OVL_PRESETS[ovl.style] || OVL_PRESETS.title;
  const textShadow = preset.isNeon
    ? `0 0 8px ${ovl.color||'#fff'}, 0 0 18px ${ovl.color||'#fff'}, 0 0 36px ${ovl.color||'#fff'}`
    : (preset.textShadow || 'none');

  function onPD(e) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dr.current = { x0:e.clientX, y0:e.clientY, ox:ovl.x, oy:ovl.y, moved:false };
    onSel(ovl.id);
  }
  function onPM(e) {
    if (!dr.current || !videoRef.current) return;
    const { width, height } = videoRef.current.getBoundingClientRect();
    const dx = ((e.clientX - dr.current.x0) / width)  * 100;
    const dy = ((e.clientY - dr.current.y0) / height) * 100;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) dr.current.moved = true;
    if (!dr.current.moved) return;
    onMove(ovl.id, Math.round(Math.max(5, Math.min(95, dr.current.ox + dx))), Math.round(Math.max(5, Math.min(95, dr.current.oy + dy))));
  }
  function onPU(e) { e.currentTarget.releasePointerCapture(e.pointerId); dr.current = null; }

  const hasParticles = ovl.particles && ovl.particles !== 'none';
  const animClass    = ovl.anim && ovl.anim !== 'none' ? `vte-anim-${ovl.anim}` : undefined;

  return (
    <div
      onPointerDown={onPD} onPointerMove={onPM} onPointerUp={onPU} onPointerCancel={() => { dr.current = null; }}
      style={{ position:'absolute', left:`${ovl.x}%`, top:`${ovl.y}%`, transform:'translate(-50%,-50%)', color: ovl.color||'#fff', pointerEvents:'all', userSelect:'none', zIndex:20, maxWidth:'90%', textAlign:'center', lineHeight:1.2, cursor:'move', outline: isSel ? '1.5px dashed rgba(253,224,71,.8)' : 'none', outlineOffset:5 }}>
      <span key={`${ovl.id}-anim`} className={animClass}
        style={{ display:'inline-block', fontSize:preset.fontSize, fontWeight:preset.fontWeight, textShadow, padding: preset.padding||undefined, background: preset.background||'transparent', borderRadius: preset.borderRadius||0, whiteSpace: ovl.anim === 'typewriter' ? 'nowrap' : undefined }}>
        {ovl.text}
      </span>
      {hasParticles && <ParticleEffect type={ovl.particles} />}
    </div>
  );
}

// ─── VideoBlockOverlay — drag/resize/rotate layer (NO iframe inside) ─────────
const SIZE_PRESETS = [
  { label: '¼',    w: 32,  h: 32  },
  { label: '½',    w: 50,  h: 50  },
  { label: 'Full', w: 100, h: 100 },
];

function VideoBlockOverlay({ track, src, videoRef, isSel, onSel, onUpdate, onRotate }) {
  const dr  = useRef(null);
  const pal = SRC_PALETTE[src?.ci ?? 0];
  const rot = track.rotation || 0;

  function startDrag(e, mode) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const vr = videoRef.current?.getBoundingClientRect() || { left:0, top:0, width:1, height:1 };
    const cx = vr.left + (track.x + track.w / 2) / 100 * vr.width;
    const cy = vr.top  + (track.y + track.h / 2) / 100 * vr.height;
    dr.current = {
      mode,
      x0: e.clientX, y0: e.clientY,
      tx: track.x, ty: track.y, tw: track.w, th: track.h,
      cx, cy, rot0: rot,
      a0: Math.atan2(e.clientY - cy, e.clientX - cx),
    };
    onSel(track.id);
  }

  function onPM(e) {
    if (!dr.current || !videoRef.current) return;
    const vr = videoRef.current.getBoundingClientRect();
    const { mode, x0, y0, tx, ty, tw, th, cx, cy, rot0, a0 } = dr.current;
    const dx = ((e.clientX - x0) / vr.width)  * 100;
    const dy = ((e.clientY - y0) / vr.height) * 100;
    const min = 6;

    if (mode === 'move') {
      onUpdate(track.id, {
        x: Math.round(Math.max(0, Math.min(100 - tw, tx + dx)) * 10) / 10,
        y: Math.round(Math.max(0, Math.min(100 - th, ty + dy)) * 10) / 10,
      });
    } else if (mode === 'rotate') {
      const a1 = Math.atan2(e.clientY - cy, e.clientX - cx);
      const delta = (a1 - a0) * 180 / Math.PI;
      onRotate(track.id, ((rot0 + delta) % 360 + 360) % 360);
    } else {
      let nx = tx, ny = ty, nw = tw, nh = th;
      if (mode === 'se') {
        nw = Math.max(min, Math.min(100 - tx, tw + dx));
        nh = Math.max(min, Math.min(100 - ty, th + dy));
      } else if (mode === 'sw') {
        nx = Math.max(0, Math.min(tx + tw - min, tx + dx));
        nw = tw - (nx - tx);
        nh = Math.max(min, Math.min(100 - ty, th + dy));
      } else if (mode === 'ne') {
        nw = Math.max(min, Math.min(100 - tx, tw + dx));
        ny = Math.max(0, Math.min(ty + th - min, ty + dy));
        nh = th - (ny - ty);
      } else if (mode === 'nw') {
        nx = Math.max(0, Math.min(tx + tw - min, tx + dx));
        nw = tw - (nx - tx);
        ny = Math.max(0, Math.min(ty + th - min, ty + dy));
        nh = th - (ny - ty);
      }
      onUpdate(track.id, {
        x: Math.round(nx * 10) / 10,
        y: Math.round(ny * 10) / 10,
        w: Math.round(nw * 10) / 10,
        h: Math.round(nh * 10) / 10,
      });
    }
  }

  function onPU(e) { e.currentTarget.releasePointerCapture(e.pointerId); dr.current = null; }
  const cancel = () => { dr.current = null; };

  const cs = (cursor, top, left) => ({
    position:'absolute', top, left, width:12, height:12,
    background:'#fff', border:`2px solid ${pal.bg}`, borderRadius:3,
    cursor, zIndex:5, pointerEvents:'all',
    transform:'translate(-50%,-50%)', touchAction:'none',
  });

  return (
    <div style={{
      position:'absolute',
      left:`${track.x}%`, top:`${track.y}%`,
      width:`${track.w}%`, height:`${track.h}%`,
      transform:`rotate(${rot}deg)`,
      transformOrigin:'center center',
      zIndex: isSel ? 30 : 10,
      pointerEvents:'none',
    }}>
      {/* Move surface */}
      <div onPointerDown={e=>startDrag(e,'move')} onPointerMove={onPM} onPointerUp={onPU} onPointerCancel={cancel}
        onClick={e=>e.stopPropagation()}
        style={{ position:'absolute', inset:0, cursor:'move', pointerEvents:'all', zIndex:1, touchAction:'none' }} />
      {/* Border ring */}
      <div style={{ position:'absolute', inset:0, outline: isSel ? `2px solid ${pal.bg}` : '1px solid rgba(255,255,255,.12)', outlineOffset:-1, pointerEvents:'none', zIndex:2 }} />

      {isSel && <>
        {/* Corner resize handles */}
        <div onPointerDown={e=>startDrag(e,'nw')} onPointerMove={onPM} onPointerUp={onPU} onPointerCancel={cancel} onClick={e=>e.stopPropagation()} style={cs('nw-resize','0%','0%')} />
        <div onPointerDown={e=>startDrag(e,'ne')} onPointerMove={onPM} onPointerUp={onPU} onPointerCancel={cancel} onClick={e=>e.stopPropagation()} style={cs('ne-resize','0%','100%')} />
        <div onPointerDown={e=>startDrag(e,'sw')} onPointerMove={onPM} onPointerUp={onPU} onPointerCancel={cancel} onClick={e=>e.stopPropagation()} style={cs('sw-resize','100%','0%')} />
        <div onPointerDown={e=>startDrag(e,'se')} onPointerMove={onPM} onPointerUp={onPU} onPointerCancel={cancel} onClick={e=>e.stopPropagation()} style={cs('se-resize','100%','100%')} />
        {/* Rotation line */}
        <div style={{ position:'absolute', top:0, left:'calc(50% - 0.5px)', width:1, height:22, background:pal.bg, transform:'translateY(-100%)', pointerEvents:'none', zIndex:4 }} />
        {/* Rotation handle */}
        <div onPointerDown={e=>startDrag(e,'rotate')} onPointerMove={onPM} onPointerUp={onPU} onPointerCancel={cancel}
          onClick={e=>e.stopPropagation()} title={`${Math.round(rot)}°`}
          style={{ position:'absolute', top:-36, left:'50%', transform:'translateX(-50%)', width:14, height:14, borderRadius:'50%', background:'#fff', border:`2px solid ${pal.bg}`, cursor:'grab', pointerEvents:'all', zIndex:5, touchAction:'none' }} />
      </>}
    </div>
  );
}

// ─── VideoQuestionOverlay ─────────────────────────────────────────────────────
const Q_TIPOS = ['MULTIPLE','CORTA','ORDENAR','RELLENAR'];
const Q_COLORS = ['#3b82f6','#10b981','#f59e0b','#ec4899'];

function VideoQuestionOverlay({ checkpoint, onComplete, onSkip }) {
  const [idx,       setIdx]       = useState(0);
  const [phase,     setPhase]     = useState('ASKING'); // ASKING | FEEDBACK | DONE
  const [texto,     setTexto]     = useState('');
  const [slots,     setSlots]     = useState([]);
  const [orden,     setOrden]     = useState([]);
  const [isCorrect, setIsCorrect] = useState(null);
  const [score,     setScore]     = useState({ c: 0, t: 0 });

  const preguntas = checkpoint.preguntas || [];
  const q = preguntas[idx];
  const clean = s => s ? String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim() : '';

  const optsShuffled = useMemo(() => {
    if (!q || q.tipo !== 'MULTIPLE') return [];
    const arr = [q.correcta, ...(q.incorrectas||[])].filter(Boolean);
    for (let i = arr.length-1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [arr[i],arr[j]] = [arr[j],arr[i]]; }
    return arr;
  }, [idx]);

  const bloquesShuf = useMemo(() => {
    if (!q || q.tipo !== 'ORDENAR') return [];
    const arr = [...(q.bloques||[])];
    for (let i = arr.length-1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [arr[i],arr[j]] = [arr[j],arr[i]]; }
    if (arr.join() === (q.bloques||[]).join() && arr.length > 1) [arr[0],arr[1]] = [arr[1],arr[0]];
    return arr;
  }, [idx]);

  useEffect(() => { setTexto(''); setSlots([]); setOrden(bloquesShuf); setPhase('ASKING'); setIsCorrect(null); }, [idx]);

  function removeFromSlot(b) { setSlots(s => s.filter(x => x!==b)); setOrden(o => [...o,b]); }

  function answer(ok) {
    setIsCorrect(ok);
    setScore(s => ({ c: s.c+(ok?1:0), t: s.t+1 }));
    setPhase('FEEDBACK');
  }

  function goNext() {
    if (idx+1 >= preguntas.length) setPhase('DONE');
    else setIdx(i => i+1);
  }

  if (!q && phase !== 'DONE') return null;

  const wrap = { position:'absolute', inset:0, zIndex:50, background:'rgba(8,8,8,.93)', backdropFilter:'blur(8px)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, padding:'28px 14px 14px' };

  if (phase === 'DONE') return (
    <div style={wrap} onClick={e=>e.stopPropagation()}>
      <div style={{fontSize:36}}>{score.c===score.t?'🎉':'📝'}</div>
      <div style={{color:'#fff',fontSize:15,fontWeight:700}}>{score.c}/{score.t} correctas</div>
      <div style={{color:'#6b7280',fontSize:11}}>{checkpoint.label}</div>
      <button onClick={() => onComplete(score)} style={{marginTop:8,padding:'10px 28px',background:'#a78bfa',color:'#000',border:'none',borderRadius:12,fontSize:13,fontWeight:700,cursor:'pointer'}}>▶ Continuar vídeo</button>
    </div>
  );

  return (
    <div style={wrap} onClick={e=>e.stopPropagation()}>
      {/* progress */}
      <div style={{position:'absolute',top:8,left:0,right:0,display:'flex',alignItems:'center',gap:8,padding:'0 12px'}}>
        <div style={{flex:1,height:3,background:'#1e1e1e',borderRadius:2}}>
          <div style={{height:3,background:'#a78bfa',borderRadius:2,transition:'width .3s',width:`${(idx/preguntas.length)*100}%`}} />
        </div>
        <span style={{color:'#6b7280',fontSize:9,whiteSpace:'nowrap'}}>{idx+1}/{preguntas.length}</span>
      </div>
      {onSkip && <button onClick={onSkip} style={{position:'absolute',top:6,right:8,fontSize:9,color:'#374151',background:'transparent',border:'none',cursor:'pointer'}}>Saltar ✕</button>}

      {/* question text */}
      <div style={{color:'#fff',fontSize:12,fontWeight:600,textAlign:'center',maxWidth:'95%',lineHeight:1.45}}>{q.q||'(sin texto)'}</div>

      {/* ASKING */}
      {phase==='ASKING' && q.tipo==='MULTIPLE' && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5,width:'100%'}}>
          {optsShuffled.map((op,i)=>(
            <button key={i} onClick={()=>answer(clean(op)===clean(q.correcta))}
              style={{padding:'8px 4px',background:Q_COLORS[i%4],color:'#fff',border:'none',borderRadius:9,fontSize:10,fontWeight:600,cursor:'pointer',lineHeight:1.3}}>
              {op}
            </button>
          ))}
        </div>
      )}

      {phase==='ASKING' && q.tipo==='CORTA' && (
        <div style={{display:'flex',flexDirection:'column',gap:6,width:'100%',alignItems:'center'}}>
          <input autoFocus value={texto} onChange={e=>setTexto(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&answer(clean(texto)===clean(q.respuesta||q.correcta))}
            placeholder="Escribe tu respuesta…"
            style={{width:'100%',padding:'8px 12px',background:'#1a1a1a',color:'#fff',border:'1px solid #333',borderRadius:10,fontSize:12,outline:'none',boxSizing:'border-box'}} />
          <button onClick={()=>answer(clean(texto)===clean(q.respuesta||q.correcta))}
            style={{padding:'7px 22px',background:'#fde047',color:'#000',border:'none',borderRadius:10,fontSize:12,fontWeight:700,cursor:'pointer'}}>
            Enviar
          </button>
        </div>
      )}

      {phase==='ASKING' && q.tipo==='RELLENAR' && (
        <div style={{display:'flex',flexDirection:'column',gap:6,width:'100%',alignItems:'center'}}>
          <div style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap',justifyContent:'center'}}>
            {q.bloques?.[0] && <span style={{color:'#d1d5db',fontSize:11}}>{q.bloques[0]}</span>}
            <input autoFocus value={texto} onChange={e=>setTexto(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&answer(clean(texto)===clean(q.bloques?.[1]))}
              style={{padding:'4px 10px',background:'#1a1a1a',color:'#fde047',border:'2px solid #fde047',borderRadius:8,fontSize:12,width:110,outline:'none',textAlign:'center'}} />
            {q.bloques?.[2] && <span style={{color:'#d1d5db',fontSize:11}}>{q.bloques[2]}</span>}
          </div>
          <button onClick={()=>answer(clean(texto)===clean(q.bloques?.[1]))}
            style={{padding:'7px 22px',background:'#fde047',color:'#000',border:'none',borderRadius:10,fontSize:12,fontWeight:700,cursor:'pointer'}}>
            Enviar
          </button>
        </div>
      )}

      {phase==='ASKING' && q.tipo==='ORDENAR' && (
        <div style={{display:'flex',flexDirection:'column',gap:6,width:'100%',alignItems:'center'}}>
          <div style={{display:'flex',gap:4,flexWrap:'wrap',justifyContent:'center'}}>
            {(q.bloques||[]).map((_,i)=>(
              <div key={i} onClick={()=>slots[i]&&removeFromSlot(slots[i])}
                style={{minWidth:52,minHeight:26,padding:'3px 8px',background:slots[i]?'#7c3aed':'#1a1a1a',border:'1px dashed #374151',borderRadius:8,fontSize:10,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',cursor:slots[i]?'pointer':'default'}}>
                {slots[i]||<span style={{color:'#374151'}}>{i+1}</span>}
              </div>
            ))}
          </div>
          <div style={{display:'flex',gap:4,flexWrap:'wrap',justifyContent:'center'}}>
            {orden.map((b,i)=>(
              <button key={i} onClick={()=>{ if(slots.includes(b)) return; setSlots(s=>[...s,b]); setOrden(o=>o.filter(x=>x!==b)); }}
                style={{padding:'3px 10px',background:'#374151',color:'#fff',border:'1px solid #4b5563',borderRadius:8,fontSize:10,cursor:'pointer'}}>
                {b}
              </button>
            ))}
          </div>
          <button onClick={()=>answer(slots.every((s,i)=>clean(s)===clean(q.bloques?.[i])) && slots.length===(q.bloques||[]).length)}
            disabled={slots.length<(q.bloques||[]).length}
            style={{padding:'7px 22px',background:slots.length<(q.bloques||[]).length?'#1a1a1a':'#fde047',color:slots.length<(q.bloques||[]).length?'#374151':'#000',border:'none',borderRadius:10,fontSize:12,fontWeight:700,cursor:'pointer'}}>
            Enviar
          </button>
        </div>
      )}

      {/* FEEDBACK */}
      {phase==='FEEDBACK' && (
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
          <div style={{fontSize:30}}>{isCorrect?'✅':'❌'}</div>
          <div style={{color:isCorrect?'#4ade80':'#f87171',fontSize:13,fontWeight:700}}>{isCorrect?'¡Correcto!':'Incorrecto'}</div>
          {!isCorrect && (
            <div style={{color:'#9ca3af',fontSize:10,textAlign:'center'}}>
              Respuesta: <span style={{color:'#fff',fontWeight:600}}>
                {q.correcta||q.respuesta||q.bloques?.[1]||(q.bloques||[]).join(' → ')}
              </span>
            </div>
          )}
          <button onClick={goNext}
            style={{padding:'8px 20px',background:'#a78bfa',color:'#000',border:'none',borderRadius:10,fontSize:12,fontWeight:700,cursor:'pointer'}}>
            {idx+1>=preguntas.length?'Ver resultado':'Siguiente →'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function VideoTimelineEditor({ onBack }) {
  useVteCss();

  const [state, dispatch] = useReducer(R, INIT);
  const tlRef  = useRef(null);
  const vidRef = useRef(null);
  const phDrag = useRef(false);

  const [zoom,       setZoom]       = useState(1);
  const [hover,      setHover]      = useState(null);
  const [query,      setQuery]      = useState('');
  const [results,    setResults]    = useState([]);
  const [searching,  setSearching]  = useState(false);
  const [searchErr,  setSearchErr]  = useState('');
  const [urlInput,   setUrlInput]   = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const [apiKey,     setApiKey]     = useState(() => localStorage.getItem('yt_api_key') || '');
  const [showKey,    setShowKey]    = useState(false);
  const [keyInput,   setKeyInput]   = useState(() => localStorage.getItem('yt_api_key') || '');
  const [activeQId,  setActiveQId]  = useState(null);
  const [editPIdx,   setEditPIdx]   = useState(0);
  const [showSave,   setShowSave]   = useState(false);
  const [saveTitle,  setSaveTitle]  = useState('');
  const [saving,     setSaving]     = useState(false);
  const [saveOk,     setSaveOk]     = useState(false);
  const [shareUrl,   setShareUrl]   = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [showProjectsList, setShowProjectsList] = useState(true);
  const [myProjects,    setMyProjects]    = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [openingId,     setOpeningId]     = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId,    setDeletingId]    = useState(null);
  const savedDocId = useRef(null);
  const draftId = useRef(localStorage.getItem('vte_draft_id'));

  async function fetchMyProjects(uid) {
    setLoadingProjects(true);
    try {
      const snap = await getDocs(fsQuery(collection(db, 'resources'), where('profesorUid', '==', uid)));
      const docs = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d => d.format === 'VTE')
        .sort((a, b) => (b.fechaCreacion?.toMillis?.() ?? 0) - (a.fechaCreacion?.toMillis?.() ?? 0));
      setMyProjects(docs);
    } catch (e) { console.error('fetchMyProjects:', e); }
    setLoadingProjects(false);
  }

  // Fetch projects whenever auth resolves
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      if (user) fetchMyProjects(user.uid);
      else setMyProjects([]);
    });
    return unsub;
  }, []);

  useEffect(() => { setEditPIdx(0); }, [state.selId]);

  const ytPlayer = useMultiYTPlayer({
    onTime: t => dispatch({ type: 'SEEK', t }),
  });

  // Init / remove players as sources change
  const prevSrcIds = useRef(new Set());
  useEffect(() => {
    const current = new Set(state.sources.map(s => s.id_yt));
    // New sources
    state.sources.forEach(src => {
      if (!prevSrcIds.current.has(src.id_yt)) ytPlayer.initPlayer(src.id_yt);
    });
    // Removed sources
    prevSrcIds.current.forEach(id => {
      if (!current.has(id)) ytPlayer.removePlayer(id);
    });
    prevSrcIds.current = current;
  }, [state.sources]);

  // Seek all active YouTube players to the correct position for timeline time T
  function seekYoutubeTo(T) {
    for (const track of state.tracks) {
      const clip = track.clips.find(c => T >= c.start && T < c.start + c.dur);
      if (!clip) continue;
      const src = state.sources.find(s => s.id === clip.src);
      if (!src) continue;
      const ytTime = (clip.videoOffset || 0) + (T - clip.start);
      ytPlayer.seekOne(src.id_yt, ytTime);
      // Keep clipStartRef in sync so the timer converts yt-time → timeline-time correctly
      if (src.id_yt === ytPlayer.primaryRef.current) {
        ytPlayer.clipStartRef.current = clip.start - (clip.videoOffset || 0);
      }
    }
  }

  // playhead drag on ruler
  function rulerDown(e) { e.currentTarget.setPointerCapture(e.pointerId); phDrag.current = true; seekTo(e); }
  function rulerMove(e) { if (phDrag.current) seekTo(e); }
  function rulerUp(e)   { e.currentTarget.releasePointerCapture(e.pointerId); phDrag.current = false; }
  function seekTo(e) {
    if (!tlRef.current) return;
    const { left, width } = tlRef.current.getBoundingClientRect();
    const t = p2s(e.clientX - left, width, state.duration);
    dispatch({ type: 'SEEK', t }); seekYoutubeTo(t);
  }

  function onTrackClick(e, trackId) {
    if (!state.hlSrc || !tlRef.current || e.target.closest?.('[data-clip]')) return;
    const { left, width } = tlRef.current.getBoundingClientRect();
    dispatch({ type: 'ADD_CLIP', track: trackId, src: state.hlSrc, start: Math.round(p2s(e.clientX - left, width, state.duration)) });
  }

  function onTracksMove(e) {
    if (!state.hlSrc || !tlRef.current) { setHover(null); return; }
    const el = e.target.closest?.('[data-trackid]');
    if (!el) { setHover(null); return; }
    const { left, width } = tlRef.current.getBoundingClientRect();
    setHover({ trackId: el.dataset.trackid, time: p2s(e.clientX - left, width, state.duration) });
  }

  function onOvlTrackClick(e) {
    if (e.target.closest?.('[data-overlay]') || !tlRef.current) return;
    const { left, width } = tlRef.current.getBoundingClientRect();
    dispatch({ type: 'ADD_OVL', start: Math.round(p2s(e.clientX - left, width, state.duration)) });
  }

  async function addByUrl(raw) {
    const id = extractId(raw.trim()); if (!id) return;
    setUrlLoading(true);
    const info = await oEmbed(id);
    const dur = await ytDuration(id, apiKey);
    dispatch({ type: 'ADD_SRC', id_yt: id, title: info.title, thumb: thumb(id), dur });
    setUrlInput(''); setUrlLoading(false);
  }

  async function doSearch(e) {
    e?.preventDefault(); if (!query.trim()) return;
    setSearching(true); setSearchErr('');
    try { setResults(await ytSearch(query, apiKey)); } catch (err) { setSearchErr(err.message); }
    setSearching(false);
  }

  function saveKey() { localStorage.setItem('yt_api_key', keyInput); setApiKey(keyInput); setShowKey(false); }

  async function openProject(docId) {
    setOpeningId(docId);
    try {
      const snap = await getDoc(doc(db, 'resources', docId));
      if (snap.exists()) {
        const d = snap.data();
        setSaveTitle(d.titulo || '');
        savedDocId.current = docId;
        draftId.current = docId;
        localStorage.setItem('vte_draft_id', docId);
        dispatch({ type: 'LOAD_STATE', vteData: d.vteData || {} });
        setShowProjectsList(false);
      }
    } catch (e) { console.error('openProject failed:', e); }
    setOpeningId(null);
  }

  async function deleteProject(docId) {
    setDeletingId(docId);
    try {
      await deleteDoc(doc(db, 'resources', docId));
      if (savedDocId.current === docId) { savedDocId.current = null; draftId.current = null; localStorage.removeItem('vte_draft_id'); }
      setMyProjects(prev => prev.filter(p => p.id !== docId));
    } catch (e) { console.error('deleteProject failed:', e); }
    setDeletingId(null);
    setConfirmDeleteId(null);
  }

  function goToProjectsList() {
    setShowProjectsList(true);
    if (auth.currentUser) fetchMyProjects(auth.currentUser.uid);
  }

  async function doSave(publish = false) {
    if (!saveTitle.trim() || !auth.currentUser) return;
    setSaving(true);
    try {
      const tests = (state.questions||[]).filter(q => (q.preguntas||[]).length > 0).length;
      const data = {
        tipoJuego: 'VIDEOQUIZZ', format: 'VTE',
        titulo: saveTitle.trim(),
        isFinished: publish,
        profesorUid: auth.currentUser.uid,
        profesorNombre: auth.currentUser.displayName || auth.currentUser.email || 'Profesor',
        playCount: 0,
        youtubeUrl: state.sources[0] ? `https://youtube.com/watch?v=${state.sources[0].id_yt}` : '',
        descripcion: `${state.sources.length} vídeo${state.sources.length!==1?'s':''} · ${tests} test${tests!==1?'s':''}`,
        vteData: { sources: state.sources, tracks: state.tracks, overlays: state.overlays, questions: state.questions, duration: state.duration },
      };
      if (savedDocId.current) {
        await updateDoc(doc(db, 'resources', savedDocId.current), data);
      } else {
        data.fechaCreacion = new Date();
        const ref = await addDoc(collection(db, 'resources'), data);
        savedDocId.current = ref.id;
        draftId.current = ref.id;
        localStorage.setItem('vte_draft_id', ref.id);
      }
      if (publish) {
        const url = `${window.location.origin}?vq=${savedDocId.current}`;
        setShareUrl(url);
      } else {
        setSaveOk(true);
        setTimeout(() => setSaveOk(false), 3000);
        setShowSave(false);
      }
      // Refresh project list so the intro screen stays up-to-date
      if (auth.currentUser) fetchMyProjects(auth.currentUser.uid);
    } catch (e) { console.error('Save failed:', e); }
    setSaving(false);
  }

  // derived
  let selClip = null, selSrc = null;
  for (const t of state.tracks) { const c = t.clips.find(c => c.id === state.selId); if (c) { selClip = c; selSrc = state.sources.find(s => s.id === c.src); break; } }
  const selOvl   = state.overlays.find(o => o.id === state.selId);
  const selTrack = state.tracks.find(t => t.id === state.selId);
  const selQ     = (state.questions||[]).find(q => q.id === state.selId);
  const hlSrcObj = state.sources.find(s => s.id === state.hlSrc);

  // Active { src, track } pairs at current playhead — one entry per track (in track order)
  const activeBlocks = useMemo(() => {
    const result = [];
    for (const track of state.tracks) {
      const clip = track.clips.find(c => state.playhead >= c.start && state.playhead < c.start + c.dur);
      if (clip) {
        const src = state.sources.find(s => s.id === clip.src);
        if (src) result.push({ src, track });
      }
    }
    return result;
  }, [state.playhead, state.tracks, state.sources]);

  const activeCount = activeBlocks.length;

  const prevActiveRef = useRef(new Set());

  // Pause + show question when playhead crosses a question marker
  const prevPhRef = useRef(0);
  useEffect(() => {
    if (ytPlayer.playing && !activeQId) {
      const hit = (state.questions||[]).find(q => q.start > prevPhRef.current && q.start <= state.playhead && q.preguntas?.length > 0);
      if (hit) { ytPlayer.pauseAll(); setActiveQId(hit.id); }
    }
    prevPhRef.current = state.playhead;
  }, [state.playhead]);

  // Pause inactive players; seek + play newly active ones; sync speed/vol
  const appliedRef = useRef({});
  useEffect(() => {
    const currentActive = new Set(activeBlocks.map(b => b.src.id_yt));

    // Pause players that just left the active set
    prevActiveRef.current.forEach(id_yt => {
      if (!currentActive.has(id_yt)) ytPlayer.pauseOne(id_yt);
    });

    for (const { src, track } of activeBlocks) {
      const clip = track.clips.find(c => state.playhead >= c.start && state.playhead < c.start + c.dur);
      if (!clip) continue;

      const isNew = !prevActiveRef.current.has(src.id_yt);
      const ytTime = (clip.videoOffset || 0) + (state.playhead - clip.start);

      if (isNew) {
        // Seek to correct position within the YouTube video
        ytPlayer.seekOne(src.id_yt, ytTime);
        if (ytPlayer.playing) ytPlayer.playOne(src.id_yt);
      }

      // Keep clipStartRef updated for the primary player's timer
      if (src.id_yt === ytPlayer.primaryRef.current) {
        ytPlayer.clipStartRef.current = clip.start - (clip.videoOffset || 0);
      }

      const speed = clip.speed || 1;
      const vol   = track.volume ?? 100;
      const prev  = appliedRef.current[src.id_yt] || {};
      if (prev.speed !== speed) ytPlayer.setRate(src.id_yt, speed);
      if (prev.vol   !== vol)   ytPlayer.setVol(src.id_yt, vol);
      appliedRef.current[src.id_yt] = { speed, vol };
    }

    prevActiveRef.current = currentActive;
  }, [activeBlocks]);

  const activeOverlays = useMemo(() =>
    state.overlays.filter(o => state.playhead >= o.start && state.playhead < o.start + o.dur)
  , [state.playhead, state.overlays]);

  const ticks = useMemo(() => {
    const iv = state.duration <= 90 ? 10 : state.duration <= 300 ? 30 : 60;
    return Array.from({ length: Math.floor(state.duration / iv) + 1 }, (_, i) => i * iv);
  }, [state.duration]);

  // ── Shared style fragments ──
  const S = {
    panel:   { background: '#111', borderRight: '1px solid #1e1e1e' },
    input:   { background: '#1a1a1a', color: '#fff', border: '1px solid #252525', borderRadius: 10, outline: 'none' },
    muted:   { color: '#4b5563', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 },
  };

  // ── PROJECTS LIST SCREEN ─────────────────────────────────────────────────
  if (showProjectsList) {
    const fmt_date = ts => {
      if (!ts?.toDate) return '';
      const d = ts.toDate();
      return d.toLocaleDateString('es-ES', { day:'numeric', month:'short', year:'numeric' });
    };
    return (
      <div style={{ minHeight:'100vh', background:'#000', display:'flex', flexDirection:'column', color:'#fff', fontFamily:'inherit' }}>
        {/* Top bar */}
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom:'1px solid #1a1a1a', flexShrink:0 }}>
          {onBack && <button className="vte-btn" onClick={onBack} style={{ background:'transparent', color:'#6b7280', fontSize:13, padding:'5px 10px', borderRadius:8, border:'none', cursor:'pointer' }}>← Volver</button>}
          <div style={{ fontSize:18 }}>🎬</div>
          <span style={{ fontWeight:700, fontSize:15, color:'#fff' }}>Editor de Vídeo</span>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'24px 16px', maxWidth:680, margin:'0 auto', width:'100%', boxSizing:'border-box' }}>
          {/* New project CTA */}
          <button onClick={() => { dispatch({ type:'LOAD_STATE', vteData:{} }); savedDocId.current = null; draftId.current = null; localStorage.removeItem('vte_draft_id'); setSaveTitle(''); setShowProjectsList(false); }}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, width:'100%', padding:'16px 0', background:'#DC2626', color:'#fff', border:'none', borderRadius:16, fontWeight:700, fontSize:15, cursor:'pointer', marginBottom:32 }}>
            <span style={{ fontSize:20 }}>＋</span> Nuevo proyecto
          </button>

          {/* Projects */}
          {loadingProjects ? (
            <div style={{ textAlign:'center', color:'#4b5563', fontSize:13, padding:32 }}>Cargando proyectos…</div>
          ) : myProjects.length === 0 ? (
            <div style={{ textAlign:'center', padding:48 }}>
              <div style={{ fontSize:40, marginBottom:12 }}>📭</div>
              <p style={{ color:'#4b5563', fontSize:14, margin:0 }}>Aún no tienes proyectos guardados</p>
              <p style={{ color:'#374151', fontSize:12, margin:'6px 0 0' }}>Crea tu primero con el botón de arriba</p>
            </div>
          ) : (
            <>
              <div style={{ color:'#4b5563', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:14 }}>
                Mis proyectos · {myProjects.length}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:12 }}>
                {myProjects.map(p => {
                  const thumb  = p.vteData?.sources?.[0]?.thumb;
                  const nsrc   = p.vteData?.sources?.length ?? 0;
                  const nq     = (p.vteData?.questions || []).filter(q => q.preguntas?.length > 0).length;
                  const isOpen = !!openingId && p.id === openingId;
                  return (
                    <div key={p.id} onClick={() => !openingId && !confirmDeleteId && openProject(p.id)}
                      style={{ background:'#0f0f0f', border:'1px solid #1e1e1e', borderRadius:14, overflow:'hidden', cursor: openingId || confirmDeleteId ? 'default' : 'pointer', textAlign:'left', opacity: openingId && !isOpen ? 0.45 : 1, transition:'border-color .15s', display:'flex', flexDirection:'column', userSelect:'none' }}>
                      {/* Thumbnail */}
                      <div style={{ position:'relative', aspectRatio:'16/9', background:'#0a0a0a' }}>
                        {thumb
                          ? <img src={thumb} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
                          : <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', color:'#1e1e1e', fontSize:32 }}>🎬</div>
                        }
                        {isOpen && (
                          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:13 }}>Abriendo…</div>
                        )}
                        <span style={{ position:'absolute', top:7, right:7, fontSize:9, fontWeight:700, padding:'3px 8px', borderRadius:20, background:'rgba(0,0,0,.75)', color: p.isFinished ? '#4ade80' : '#a78bfa' }}>
                          {p.isFinished ? '● Publicado' : '○ Borrador'}
                        </span>
                      </div>
                      {/* Info */}
                      <div style={{ padding:'10px 12px', flex:1 }}>
                        <div style={{ color:'#fff', fontSize:12, fontWeight:600, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', marginBottom:4 }}>{p.titulo}</div>
                        {confirmDeleteId === p.id ? (
                          <div style={{ display:'flex', alignItems:'center', gap:6 }} onClick={e => e.stopPropagation()}>
                            <span style={{ color:'#f87171', fontSize:10, flex:1 }}>¿Eliminar?</span>
                            <button onClick={() => deleteProject(p.id)} disabled={deletingId === p.id}
                              style={{ padding:'3px 10px', background:'#dc2626', color:'#fff', border:'none', borderRadius:6, fontSize:10, fontWeight:700, cursor:'pointer', opacity: deletingId===p.id ? 0.6 : 1 }}>
                              {deletingId === p.id ? '…' : 'Sí'}
                            </button>
                            <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(null); }}
                              style={{ padding:'3px 10px', background:'#1e1e1e', color:'#9ca3af', border:'1px solid #2a2a2a', borderRadius:6, fontSize:10, cursor:'pointer' }}>
                              No
                            </button>
                          </div>
                        ) : (
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <div style={{ flex:1 }}>
                              <div style={{ color:'#4b5563', fontSize:10 }}>
                                {nsrc} vídeo{nsrc !== 1 ? 's' : ''}{nq > 0 ? ` · ${nq} test${nq !== 1 ? 's' : ''}` : ''}
                              </div>
                              {p.fechaCreacion && <div style={{ color:'#374151', fontSize:9, marginTop:2 }}>{fmt_date(p.fechaCreacion)}</div>}
                            </div>
                            <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(p.id); }}
                              style={{ padding:'4px 6px', background:'transparent', color:'#374151', border:'none', borderRadius:6, fontSize:12, cursor:'pointer', lineHeight:1, flexShrink:0 }}
                              title="Eliminar proyecto">🗑</button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── INTRO SCREEN ──────────────────────────────────────────────────────────
  if (state.sources.length === 0) {
    return (
      <div style={{ minHeight:'100vh', background:'#000', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24, position:'relative' }}>
        <div style={{ position:'absolute', top:16, left:16, display:'flex', gap:8 }}>
          <button className="vte-btn" onClick={goToProjectsList} style={{ background:'transparent', color:'#6b7280', fontSize:13, padding:'6px 12px', borderRadius:8, border:'none', cursor:'pointer' }}>← Proyectos</button>
          {onBack && <button className="vte-btn" onClick={onBack} style={{ background:'transparent', color:'#4b5563', fontSize:13, padding:'6px 12px', borderRadius:8, border:'none', cursor:'pointer' }}>Salir</button>}
        </div>

        <div style={{ width:'100%', maxWidth:480 }}>
          <div style={{ textAlign:'center', marginBottom:28 }}>
            <h1 style={{ color:'#fff', fontSize:20, fontWeight:700, margin:'0 0 4px' }}>Nuevo proyecto</h1>
            <p style={{ color:'#6b7280', fontSize:13, margin:0 }}>Busca un vídeo de YouTube para empezar</p>
          </div>

          <form onSubmit={doSearch} style={{ marginBottom:12 }}>
            <div style={{ display:'flex', gap:8 }}>
              <div style={{ flex:1, display:'flex', alignItems:'center', background:'#111', borderRadius:16, border:'1px solid #222', padding:'0 16px', gap:8 }}>
                <span style={{ color:'#4b5563' }}>🔍</span>
                <input className="vte-input" placeholder="Buscar en YouTube…" value={query} onChange={e => setQuery(e.target.value)} style={{ flex:1, background:'transparent', color:'#fff', fontSize:13, padding:'12px 0', border:'none', outline:'none' }} />
              </div>
              <button type="submit" disabled={searching} className="vte-btn-red" style={{ padding:'12px 20px', borderRadius:16, border:'none', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', opacity:searching?.5:1 }}>{searching?'…':'Buscar'}</button>
            </div>
            {searchErr && <p style={{ color:'#f87171', fontSize:11, margin:'6px 0 0 4px' }}>{searchErr}</p>}
          </form>

          {/* Local dev API key override (only shown if proxy is unavailable) */}
          {searchErr && !showKey && (
            <div style={{ display:'flex', justifyContent:'center', marginBottom:8 }}>
              <button className="vte-btn" onClick={() => setShowKey(true)} style={{ fontSize:10, padding:'4px 12px', borderRadius:20, border:'1px solid #333', color:'#6b7280', background:'transparent', cursor:'pointer' }}>
                ⚙️ Usar key local (dev)
              </button>
            </div>
          )}
          {showKey && (
            <div style={{ marginBottom:16, padding:14, background:'#111', borderRadius:14, border:'1px solid #222' }}>
              <div style={{ fontSize:10, color:'#6b7280', marginBottom:8 }}>YouTube Data API v3 — <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" style={{ color:'#60a5fa' }}>Obtener clave</a></div>
              <div style={{ display:'flex', gap:8 }}>
                <input className="vte-input" value={keyInput} onChange={e => setKeyInput(e.target.value)} placeholder="AIza…" style={{ flex:1, ...S.input, fontSize:12, padding:'7px 10px', fontFamily:'monospace' }} />
                <button className="vte-btn-light" onClick={saveKey} style={{ padding:'7px 14px', borderRadius:10, border:'none', cursor:'pointer', fontWeight:600, fontSize:12 }}>Guardar</button>
                <button className="vte-btn-ghost" onClick={() => setShowKey(false)} style={{ padding:'7px 10px', background:'#222', color:'#9ca3af', border:'none', borderRadius:10, cursor:'pointer', fontSize:12 }}>×</button>
              </div>
            </div>
          )}

          <div style={{ display:'flex', gap:8, marginBottom:24 }}>
            <div style={{ flex:1, display:'flex', alignItems:'center', background:'#111', borderRadius:16, border:'1px solid #222', padding:'0 16px', gap:8 }}>
              <span style={{ color:'#4b5563', fontSize:12 }}>▶</span>
              <input className="vte-input" placeholder="O pega una URL de YouTube…" value={urlInput} onChange={e => setUrlInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addByUrl(urlInput)} style={{ flex:1, background:'transparent', color:'#fff', fontSize:13, padding:'12px 0', border:'none', outline:'none' }} />
            </div>
            <button onClick={() => addByUrl(urlInput)} disabled={urlLoading || !urlInput.trim()} className="vte-btn-light" style={{ padding:'12px 20px', borderRadius:16, border:'none', fontWeight:700, fontSize:14, cursor:'pointer', opacity:(urlLoading||!urlInput.trim())?.3:1 }}>{urlLoading?'…':'→'}</button>
          </div>

          {results.length > 0 && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, maxHeight:280, overflowY:'auto' }}>
              {results.map(r => (
                <button key={r.id} className="vte-result-item" onClick={() => addByUrl(`https://youtube.com/watch?v=${r.id}`)} style={{ background:'#111', borderRadius:12, overflow:'hidden', border:'1px solid #1e1e1e', cursor:'pointer', textAlign:'left', padding:0, transition:'all .15s' }}>
                  <img src={r.thumb} alt="" style={{ width:'100%', aspectRatio:'16/9', objectFit:'cover', display:'block' }} />
                  <div style={{ padding:'6px 8px' }}>
                    <p style={{ color:'#fff', fontSize:10, fontWeight:500, margin:0, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', lineHeight:1.35 }}>{r.title}</p>
                    <p style={{ color:'#4b5563', fontSize:9, margin:'3px 0 0', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{r.channel}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── MAIN EDITOR ──────────────────────────────────────────────────────────
  return (
    <div style={{ display:'flex', flexDirection:'column', background:'#0a0a0a', color:'#fff', minHeight:'100vh', userSelect:'none' }}>

      {/* TOP BAR */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px', background:'#111', borderBottom:'1px solid #1e1e1e', flexShrink:0 }}>
        <button className="vte-btn" onClick={goToProjectsList} style={{ background:'transparent', color:'#6b7280', fontSize:13, padding:'4px 8px', borderRadius:6, border:'none', cursor:'pointer' }}>← Proyectos</button>
        <div style={{ width:1, height:16, background:'#222' }} />
        <span style={{ color:'#fff', fontWeight:600, fontSize:14 }}>🎬 Editor de Vídeo</span>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
          {state.selId && state.tracks.some(t => t.clips.some(c => c.id === state.selId)) && (
            <button className="vte-btn-ghost" onClick={() => dispatch({ type:'SPLIT', id:state.selId })} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', background:'#1e1e1e', color:'#d1d5db', fontSize:12, borderRadius:12, border:'1px solid #2a2a2a', cursor:'pointer' }}>✂️ Dividir</button>
          )}
          {state.sources.length > 0 && (
            <button onClick={() => { setSaveTitle(prev => prev || 'Mi VideoQuiz'); setShowSave(true); }}
              style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 12px', background:'rgba(167,139,250,.15)', color:'#a78bfa', fontSize:12, borderRadius:12, border:'1px solid rgba(167,139,250,.3)', cursor:'pointer', fontWeight:600 }}>
              💾 Guardar
            </button>
          )}
          {saveOk && <span style={{ color:'#4ade80', fontSize:11, fontWeight:600 }}>✓ Guardado</span>}
          <div style={{ color:'#6b7280', fontSize:11, fontFamily:'monospace', background:'#1a1a1a', padding:'6px 12px', borderRadius:12, border:'1px solid #222' }}>{fmt(state.playhead)} / {fmt(state.duration)}</div>
        </div>
      </div>

      {/* CENTER AREA */}
      <div style={{ display:'flex', flex:1, minHeight:320, maxHeight:'calc(100vh - 240px)' }}>

        {/* LEFT: Library */}
        <div style={{ width:208, flexShrink:0, display:'flex', flexDirection:'column', ...S.panel, overflow:'hidden' }}>
          <div style={{ padding:10, borderBottom:'1px solid #1e1e1e' }}>
            <form onSubmit={doSearch} style={{ display:'flex', gap:6 }}>
              <input className="vte-input" placeholder="Buscar en YouTube…" value={query} onChange={e => setQuery(e.target.value)} style={{ flex:1, ...S.input, fontSize:11, padding:'7px 10px' }} />
              <button type="submit" disabled={searching} className="vte-btn-red" style={{ padding:'7px 10px', borderRadius:10, border:'none', color:'#fff', fontSize:12, cursor:'pointer', opacity:searching?.4:1 }}>{searching?'…':'🔍'}</button>
            </form>
            {searchErr && <p style={{ color:'#f87171', fontSize:9, margin:'4px 0 0' }}>{searchErr}</p>}
          </div>

          <div style={{ flex:1, overflowY:'auto' }}>
            {results.map(r => (
              <button key={r.id} className="vte-result-item" onClick={() => addByUrl(`https://youtube.com/watch?v=${r.id}`)} style={{ width:'100%', display:'flex', alignItems:'center', gap:8, padding:'8px', background:'transparent', border:'none', borderBottom:'1px solid #181818', cursor:'pointer', textAlign:'left', transition:'background .12s' }}>
                <img src={r.thumb} alt="" style={{ width:56, height:32, objectFit:'cover', borderRadius:4, flexShrink:0 }} />
                <div style={{ minWidth:0 }}>
                  <p style={{ color:'#fff', fontSize:9, fontWeight:500, margin:0, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', lineHeight:1.35 }}>{r.title}</p>
                  <p style={{ color:'#4b5563', fontSize:8, margin:'2px 0 0', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{r.channel}</p>
                </div>
              </button>
            ))}

            {results.length > 0 && state.sources.length > 0 && (
              <div style={{ padding:'6px 12px', ...S.muted, borderBottom:'1px solid #1e1e1e' }}>En el proyecto</div>
            )}

            {state.sources.map(src => (
              <div key={src.id} className="vte-src-item" onClick={() => dispatch({ type:'HL_SRC', id:src.id })}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'8px', cursor:'pointer', borderBottom:'1px solid #181818', background: state.hlSrc === src.id ? 'rgba(59,130,246,.18)':'transparent', transition:'background .12s' }}>
                <div style={{ position:'relative', flexShrink:0 }}>
                  <img src={src.thumb} alt="" style={{ width:56, height:32, objectFit:'cover', borderRadius:4 }} />
                  {state.hlSrc === src.id && <div style={{ position:'absolute', inset:0, borderRadius:4, outline:'1.5px solid #60a5fa' }} />}
                </div>
                <div style={{ minWidth:0, flex:1 }}>
                  <p style={{ color:'#fff', fontSize:9, fontWeight:500, margin:0, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{src.title}</p>
                  <p style={{ color:'#4b5563', fontSize:8, fontFamily:'monospace', margin:'2px 0 0' }}>{fmt(src.dur)}</p>
                </div>
                <button onClick={e => { e.stopPropagation(); dispatch({ type:'DEL_SRC', id:src.id }); }}
                  onMouseEnter={e => e.currentTarget.style.opacity='1'} onMouseLeave={e => e.currentTarget.style.opacity='0'}
                  style={{ opacity:0, color:'#ef4444', fontSize:11, width:16, height:16, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:4, flexShrink:0, background:'transparent', border:'none', cursor:'pointer', transition:'opacity .15s' }}>×</button>
              </div>
            ))}

            <div style={{ padding:8, borderBottom:'1px solid #181818' }}>
              <div style={{ display:'flex', gap:4 }}>
                <input className="vte-input" placeholder="Pegar URL de YouTube" value={urlInput} onChange={e => setUrlInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addByUrl(urlInput)} style={{ flex:1, ...S.input, fontSize:9, padding:'6px 8px' }} />
                <button onClick={() => addByUrl(urlInput)} disabled={urlLoading || !urlInput.trim()} className="vte-btn-ghost" style={{ padding:'6px 8px', background:'#1e1e1e', color:'#fff', fontSize:9, borderRadius:8, border:'1px solid #2a2a2a', cursor:'pointer', opacity:(urlLoading||!urlInput.trim())?.3:1 }}>{urlLoading?'…':'+'}</button>
              </div>
            </div>
          </div>

          {state.hlSrc && (
            <div style={{ padding:'8px 12px', background:'rgba(59,130,246,.12)', borderTop:'1px solid rgba(96,165,250,.2)', fontSize:9, color:'#93c5fd', textAlign:'center', lineHeight:1.6 }}>
              Clic en una pista<br/>para colocar el vídeo
            </div>
          )}
        </div>

        {/* CENTER: Monitor */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#0a0a0a', minWidth:0, padding:'16px 24px', gap:12 }}>
          {/* Multi-player video monitor */}
          <div ref={vidRef} onClick={() => dispatch({ type:'SEL', id: null })}
            style={{ position:'relative', width:'100%', maxWidth:560, background:'#111', borderRadius:12, overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,.6)', aspectRatio:'16/9', cursor:'default' }}>

            {/* LAYER 1: All iframes — ALWAYS in DOM, CSS-only position/visibility/rotation */}
            {state.sources.map(src => {
              const activeBlock = activeBlocks.find(b => b.src.id_yt === src.id_yt);
              const track = activeBlock?.track;
              const isActive = !!activeBlock;
              const trackIdx = isActive ? state.tracks.indexOf(track) : -1;
              return (
                <div key={src.id_yt} style={{
                  position: 'absolute',
                  left:   isActive ? `${track.x}%` : '0%',
                  top:    isActive ? `${track.y}%` : '0%',
                  width:  isActive ? `${track.w}%` : '100%',
                  height: isActive ? `${track.h}%` : '100%',
                  opacity: isActive ? (track.opacity ?? 1) : 0,
                  pointerEvents: 'none',
                  zIndex: isActive ? (state.selId === track.id ? 20 : trackIdx + 1) : 0,
                  background: '#000',
                  transform: isActive ? `rotate(${track.rotation || 0}deg)` : 'none',
                  transformOrigin: 'center center',
                }}>
                  <div id={`yt-inner-${src.id_yt}`} style={{ width:'100%', height:'100%' }} />
                </div>
              );
            })}

            {/* LAYER 2: Interaction overlays (drag / resize corners / rotate handle) */}
            {activeBlocks.map(({ src, track }) => (
              <VideoBlockOverlay key={track.id} src={src} track={track} videoRef={vidRef}
                isSel={state.selId === track.id}
                onSel={id => dispatch({ type:'SEL', id })}
                onUpdate={(id, u) => dispatch({ type:'UPD_TRACK', id, u })}
                onRotate={(id, rotation) => dispatch({ type:'UPD_TRACK', id, u:{ rotation } })} />
            ))}

            {/* Interactive question overlay */}
            {activeQId && (() => {
              const qcp = (state.questions||[]).find(q => q.id === activeQId);
              if (!qcp) return null;
              return (
                <VideoQuestionOverlay key={activeQId} checkpoint={qcp}
                  onComplete={() => { setActiveQId(null); ytPlayer.playAll(); }}
                  onSkip={() => setActiveQId(null)} />
              );
            })()}

            {/* Text overlays */}
            {activeOverlays.map(o => (
              <TextOverlayOnVideo key={o.id} ovl={o} videoRef={vidRef}
                isSel={state.selId === o.id}
                onSel={id => dispatch({ type:'SEL', id })}
                onMove={(id, x, y) => dispatch({ type:'UPD_OVL', id, u:{ x, y } })} />
            ))}

            {activeCount === 0 && state.sources.length > 0 && (
              <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', color:'#444', fontSize:12, pointerEvents:'none' }}>
                Sin clips en este momento
              </div>
            )}
            {activeCount === 0 && state.sources.length === 0 && (
              <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', color:'#333', fontSize:12, pointerEvents:'none' }}>
                Añade un vídeo para comenzar
              </div>
            )}
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button className="vte-btn" onClick={() => { const t = Math.max(0, state.playhead-10); dispatch({type:'SEEK',t}); seekYoutubeTo(t); }} style={{ color:'#9ca3af', fontSize:18, width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'50%', background:'transparent', border:'none', cursor:'pointer' }}>⏮</button>
            <button onClick={ytPlayer.toggle} style={{ width:44, height:44, borderRadius:'50%', background:'#fff', color:'#000', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', border:'none', cursor:'pointer', boxShadow:'0 4px 16px rgba(255,255,255,.15)' }}>{ytPlayer.playing ? '⏸' : '▶'}</button>
            <button className="vte-btn" onClick={() => { const t = Math.min(state.duration, state.playhead+10); dispatch({type:'SEEK',t}); seekYoutubeTo(t); }} style={{ color:'#9ca3af', fontSize:18, width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'50%', background:'transparent', border:'none', cursor:'pointer' }}>⏭</button>
            <span style={{ color:'#6b7280', fontSize:11, fontFamily:'monospace', marginLeft:8 }}>{fmt(state.playhead)} / {fmt(state.duration)}</span>
          </div>
        </div>

        {/* RIGHT: Properties */}
        <div style={{ width:208, flexShrink:0, background:'#111', borderLeft:'1px solid #1e1e1e', display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ padding:'8px 12px', borderBottom:'1px solid #1e1e1e' }}>
            <span style={S.muted}>Propiedades</span>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:12 }}>

            {!selClip && !selOvl && !selTrack && !selQ && <p style={{ color:'#374151', fontSize:10, textAlign:'center', padding:'24px 0', lineHeight:1.6 }}>Selecciona un clip,<br/>vídeo, título o test para editar</p>}

            {/* ── Question checkpoint editor ── */}
            {selQ && (() => {
              const updQ  = u  => dispatch({ type:'UPD_Q', id:selQ.id, u });
              const addP  = tipo => {
                const np = { id:`p${Date.now()}`, tipo, q:'', correcta:'', incorrectas:['','',''], respuesta:'', bloques:['','',''] };
                updQ({ preguntas:[...(selQ.preguntas||[]), np] });
                setEditPIdx((selQ.preguntas||[]).length);
              };
              const updP  = (i, u) => updQ({ preguntas:(selQ.preguntas||[]).map((p,pi)=>pi===i?{...p,...u}:p) });
              const delP  = i => { updQ({ preguntas:(selQ.preguntas||[]).filter((_,pi)=>pi!==i) }); setEditPIdx(Math.max(0,i-1)); };
              const ep    = (selQ.preguntas||[])[editPIdx];

              return (
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <span style={{color:'#a78bfa',fontSize:10,fontWeight:700}}>⬡ Test interactivo</span>
                    <button onClick={()=>dispatch({type:'DEL_Q',id:selQ.id})} style={{color:'#ef4444',fontSize:13,padding:'2px 6px',borderRadius:6,background:'transparent',border:'none',cursor:'pointer'}}>🗑</button>
                  </div>

                  <label style={{display:'flex',flexDirection:'column',gap:3}}>
                    <span style={{color:'#4b5563',fontSize:9}}>Nombre del test</span>
                    <input value={selQ.label} onChange={e=>updQ({label:e.target.value})}
                      style={{...{background:'#1a1a1a',color:'#fff',border:'1px solid #252525',borderRadius:8,outline:'none'},fontSize:11,padding:'5px 8px'}} />
                  </label>
                  <span style={{color:'#4b5563',fontSize:9}}>En: {fmt(selQ.start)}</span>

                  {/* pregunta list */}
                  <div style={{display:'flex',flexDirection:'column',gap:4}}>
                    {(selQ.preguntas||[]).map((p,i)=>(
                      <div key={p.id} style={{borderRadius:8,overflow:'hidden',border:`1px solid ${editPIdx===i?'#a78bfa':'#252525'}`}}>
                        <div onClick={()=>setEditPIdx(i)} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 8px',background:editPIdx===i?'rgba(167,139,250,.12)':'#141414',cursor:'pointer'}}>
                          <span style={{color:'#a78bfa',fontSize:8,fontWeight:700,flexShrink:0}}>{i+1}.</span>
                          <span style={{color:'#9ca3af',fontSize:8,flex:1,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>[{p.tipo}] {p.q||'(vacío)'}</span>
                          <button onClick={e=>{e.stopPropagation();delP(i);}} style={{color:'#6b7280',fontSize:10,background:'transparent',border:'none',cursor:'pointer',flexShrink:0}}>×</button>
                        </div>

                        {editPIdx===i && ep && (
                          <div style={{padding:'8px',background:'#0d0d0d',display:'flex',flexDirection:'column',gap:7}}>
                            {/* tipo selector */}
                            <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
                              {Q_TIPOS.map(t=>(
                                <button key={t} onClick={()=>updP(i,{tipo:t})}
                                  style={{fontSize:7,padding:'2px 6px',borderRadius:6,border:`1px solid ${ep.tipo===t?'#a78bfa':'#252525'}`,background:ep.tipo===t?'rgba(167,139,250,.2)':'#1a1a1a',color:ep.tipo===t?'#a78bfa':'#6b7280',cursor:'pointer',fontWeight:ep.tipo===t?700:400}}>
                                  {t}
                                </button>
                              ))}
                            </div>

                            {/* question text */}
                            <label style={{display:'flex',flexDirection:'column',gap:2}}>
                              <span style={{color:'#4b5563',fontSize:8}}>Pregunta</span>
                              <input value={ep.q} onChange={e=>updP(i,{q:e.target.value})}
                                placeholder="Escribe la pregunta…"
                                style={{background:'#1a1a1a',color:'#fff',border:'1px solid #252525',borderRadius:7,fontSize:10,padding:'5px 8px',outline:'none'}} />
                            </label>

                            {/* type-specific fields */}
                            {ep.tipo==='MULTIPLE' && (<>
                              <label style={{display:'flex',flexDirection:'column',gap:2}}>
                                <span style={{color:'#4ade80',fontSize:8}}>✓ Respuesta correcta</span>
                                <input value={ep.correcta} onChange={e=>updP(i,{correcta:e.target.value})} placeholder="Opción correcta"
                                  style={{background:'#1a1a1a',color:'#fff',border:'1px solid #252525',borderRadius:7,fontSize:10,padding:'4px 8px',outline:'none'}} />
                              </label>
                              {[0,1,2].map(k=>(
                                <label key={k} style={{display:'flex',flexDirection:'column',gap:2}}>
                                  <span style={{color:'#f87171',fontSize:8}}>✗ Incorrecta {k+1}</span>
                                  <input value={(ep.incorrectas||[])[k]||''} onChange={e=>{ const arr=[...(ep.incorrectas||['','',''])]; arr[k]=e.target.value; updP(i,{incorrectas:arr}); }} placeholder={`Opción incorrecta ${k+1}`}
                                    style={{background:'#1a1a1a',color:'#fff',border:'1px solid #252525',borderRadius:7,fontSize:10,padding:'4px 8px',outline:'none'}} />
                                </label>
                              ))}
                            </>)}

                            {ep.tipo==='CORTA' && (
                              <label style={{display:'flex',flexDirection:'column',gap:2}}>
                                <span style={{color:'#4ade80',fontSize:8}}>Respuesta correcta</span>
                                <input value={ep.respuesta} onChange={e=>updP(i,{respuesta:e.target.value})} placeholder="Respuesta exacta"
                                  style={{background:'#1a1a1a',color:'#fff',border:'1px solid #252525',borderRadius:7,fontSize:10,padding:'4px 8px',outline:'none'}} />
                              </label>
                            )}

                            {ep.tipo==='RELLENAR' && (<>
                              <span style={{color:'#4b5563',fontSize:8}}>Texto + hueco + texto</span>
                              {[['Texto antes','0'],['Palabra correcta','1'],['Texto después','2']].map(([lbl,k])=>(
                                <label key={k} style={{display:'flex',flexDirection:'column',gap:2}}>
                                  <span style={{color: k==='1'?'#fde047':'#4b5563',fontSize:8}}>{lbl}</span>
                                  <input value={(ep.bloques||[])[+k]||''} onChange={e=>{ const b=[...(ep.bloques||['','',''])]; b[+k]=e.target.value; updP(i,{bloques:b}); }}
                                    style={{background:'#1a1a1a',color: k==='1'?'#fde047':'#fff',border:`1px solid ${k==='1'?'#ca8a04':'#252525'}`,borderRadius:7,fontSize:10,padding:'4px 8px',outline:'none'}} />
                                </label>
                              ))}
                            </>)}

                            {ep.tipo==='ORDENAR' && (<>
                              <span style={{color:'#4b5563',fontSize:8}}>Elementos en orden correcto</span>
                              {(ep.bloques||['','']).map((b,k)=>(
                                <div key={k} style={{display:'flex',gap:4,alignItems:'center'}}>
                                  <span style={{color:'#374151',fontSize:8,width:12,flexShrink:0}}>{k+1}.</span>
                                  <input value={b} onChange={e=>{ const arr=[...(ep.bloques||[])]; arr[k]=e.target.value; updP(i,{bloques:arr}); }}
                                    style={{flex:1,background:'#1a1a1a',color:'#fff',border:'1px solid #252525',borderRadius:7,fontSize:10,padding:'4px 8px',outline:'none'}} />
                                  {k>1&&<button onClick={()=>{const arr=[...(ep.bloques||[])];arr.splice(k,1);updP(i,{bloques:arr});}} style={{color:'#6b7280',background:'transparent',border:'none',cursor:'pointer',fontSize:11}}>×</button>}
                                </div>
                              ))}
                              <button onClick={()=>updP(i,{bloques:[...(ep.bloques||[]),'']})}
                                style={{fontSize:8,padding:'3px 0',background:'#1a1a1a',color:'#6b7280',border:'1px solid #252525',borderRadius:6,cursor:'pointer'}}>
                                + Añadir elemento
                              </button>
                            </>)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* add pregunta */}
                  <div style={{display:'flex',flexDirection:'column',gap:3}}>
                    <span style={{color:'#4b5563',fontSize:8}}>Añadir pregunta:</span>
                    <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
                      {Q_TIPOS.map(t=>(
                        <button key={t} onClick={()=>addP(t)}
                          style={{fontSize:8,padding:'3px 7px',background:'rgba(167,139,250,.12)',color:'#a78bfa',border:'1px solid rgba(167,139,250,.3)',borderRadius:6,cursor:'pointer'}}>
                          + {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* preview button */}
                  {(selQ.preguntas||[]).length > 0 && (
                    <button onClick={()=>{ ytPlayer.pauseAll(); dispatch({type:'SEEK',t:selQ.start}); seekYoutubeTo(selQ.start); setActiveQId(selQ.id); }}
                      style={{padding:'6px 0',background:'rgba(167,139,250,.15)',color:'#a78bfa',border:'1px solid rgba(167,139,250,.3)',borderRadius:8,fontSize:9,fontWeight:600,cursor:'pointer'}}>
                      ▶ Previsualizar test
                    </button>
                  )}
                </div>
              );
            })()}

            {/* ── Track (video block) properties ── */}
            {selTrack && (() => {
              const pal = SRC_PALETTE[state.tracks.indexOf(selTrack) % SRC_PALETTE.length];
              const activeClipInTrack = selTrack.clips.find(c => state.playhead >= c.start && state.playhead < c.start + c.dur);
              const trackSrc = activeClipInTrack ? state.sources.find(s => s.id === activeClipInTrack.src) : null;
              return (
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background: pal.bg, flexShrink:0 }} />
                    <span style={{ color:'#fff', fontSize:10, fontWeight:600 }}>{selTrack.label}</span>
                  </div>

                  {trackSrc && (
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <img src={trackSrc.thumb} alt="" style={{ width:40, height:23, objectFit:'cover', borderRadius:3, flexShrink:0 }} />
                      <p style={{ color:'#9ca3af', fontSize:9, margin:0, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{trackSrc.title}</p>
                    </div>
                  )}

                  <div>
                    <span style={{ color:'#4b5563', fontSize:9, display:'block', marginBottom:6 }}>Tamaño en pantalla</span>
                    <div style={{ display:'flex', gap:4 }}>
                      {SIZE_PRESETS.map(p => (
                        <button key={p.label} onClick={() => dispatch({ type:'UPD_TRACK', id: selTrack.id, u: { w: p.w, h: p.h } })}
                          style={{ flex:1, padding:'5px 0', borderRadius:8, fontSize:10, fontWeight:600, cursor:'pointer', background: selTrack.w === p.w ? pal.bg : '#1a1a1a', color: selTrack.w === p.w ? '#fff':'#6b7280', border:`1px solid ${selTrack.w === p.w ? pal.bg : '#252525'}`, transition:'all .15s' }}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                    {[['X','x',0,100-selTrack.w],['Y','y',0,100-selTrack.h]].map(([l,k,mn,mx]) => (
                      <label key={k}>
                        <span style={{ color:'#4b5563', fontSize:8, display:'block', marginBottom:3 }}>{l} (%)</span>
                        <input type="number" min={mn} max={mx} step={1} value={Math.round(selTrack[k])}
                          onChange={e => dispatch({ type:'UPD_TRACK', id: selTrack.id, u: { [k]: Math.max(+mn, Math.min(+mx, +e.target.value)) } })}
                          style={{ width:'100%', ...S.input, fontSize:10, padding:'6px 8px', fontFamily:'monospace', boxSizing:'border-box' }} />
                      </label>
                    ))}
                  </div>

                  <div style={{ background:`${pal.bg}15`, border:`1px solid ${pal.bg}40`, borderRadius:8, padding:'7px 9px', fontSize:9, color:`${pal.bg}cc`, lineHeight:1.5 }}>
                    🎬 Arrastra el vídeo en el monitor para moverlo
                  </div>

                  {/* Volume */}
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, marginBottom:4 }}>
                      <span style={{ color:'#6b7280' }}>Volumen</span>
                      <span style={{ color:'#fff', fontFamily:'monospace', fontWeight:700 }}>{selTrack.volume ?? 100}%</span>
                    </div>
                    <input type="range" min={0} max={100} step={1} value={selTrack.volume ?? 100}
                      onChange={e => {
                        const v = +e.target.value;
                        dispatch({ type:'UPD_TRACK', id: selTrack.id, u: { volume: v } });
                        const ab = activeBlocks.find(b => b.track.id === selTrack.id);
                        if (ab) ytPlayer.setVol(ab.src.id_yt, v);
                      }}
                      style={{ width:'100%', accentColor: pal.bg, cursor:'pointer' }} />
                    <div style={{ display:'flex', justifyContent:'space-between', color:'#374151', fontSize:9, marginTop:1 }}>
                      <span>🔇</span><span>🔊</span>
                    </div>
                  </div>

                  {/* Opacity */}
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, marginBottom:4 }}>
                      <span style={{ color:'#6b7280' }}>Transparencia</span>
                      <span style={{ color:'#fff', fontFamily:'monospace', fontWeight:700 }}>{Math.round((selTrack.opacity ?? 1) * 100)}%</span>
                    </div>
                    <input type="range" min={0} max={1} step={0.01} value={selTrack.opacity ?? 1}
                      onChange={e => dispatch({ type:'UPD_TRACK', id: selTrack.id, u: { opacity: +e.target.value } })}
                      style={{ width:'100%', accentColor: pal.bg, cursor:'pointer' }} />
                    <div style={{ display:'flex', justifyContent:'space-between', color:'#374151', fontSize:9, marginTop:1 }}>
                      <span>0%</span><span>100%</span>
                    </div>
                  </div>

                  {(selTrack.rotation || 0) !== 0 && (
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ color:'#4b5563', fontSize:9 }}>Rotación</span>
                      <span style={{ color:'#fff', fontSize:10, fontFamily:'monospace', fontWeight:700 }}>{Math.round(selTrack.rotation || 0)}°</span>
                      <button onClick={() => dispatch({ type:'UPD_TRACK', id: selTrack.id, u: { rotation: 0 } })}
                        style={{ marginLeft:'auto', fontSize:8, padding:'2px 8px', background:'#1a1a1a', color:'#9ca3af', border:'1px solid #252525', borderRadius:4, cursor:'pointer' }}>
                        Resetear
                      </button>
                    </div>
                  )}

                  <button onClick={() => dispatch({ type:'UPD_TRACK', id: selTrack.id, u: { ...TRACK_DEFAULTS[state.tracks.indexOf(selTrack)] } })}
                    style={{ padding:'5px 0', background:'#1a1a1a', color:'#6b7280', border:'1px solid #252525', borderRadius:8, fontSize:9, cursor:'pointer' }}>
                    Restablecer posición
                  </button>
                </div>
              );
            })()}

            {selClip && (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <img src={selSrc?.thumb} alt="" style={{ width:48, height:27, objectFit:'cover', borderRadius:4, flexShrink:0 }} />
                  <div style={{ minWidth:0 }}>
                    <p style={{ color:'#fff', fontSize:10, fontWeight:600, margin:0, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{selSrc?.title}</p>
                    <p style={{ color:'#6b7280', fontSize:9, fontFamily:'monospace', margin:'2px 0 0' }}>{fmt(selClip.start)} – {fmt(selClip.start + selClip.dur)}</p>
                  </div>
                </div>
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, marginBottom:6 }}>
                    <span style={{ color:'#6b7280' }}>Velocidad</span>
                    <span style={{ color:'#fff', fontFamily:'monospace', fontWeight:700 }}>{selClip.speed}×</span>
                  </div>
                  <input type="range" min={0.25} max={3} step={0.25} value={selClip.speed}
                    onChange={e => {
                      const s = +e.target.value;
                      dispatch({ type:'UPD_CLIP', id:selClip.id, u:{ speed:s } });
                      const ab = activeBlocks.find(b => b.track.clips.some(c => c.id === selClip.id));
                      if (ab) ytPlayer.setRate(ab.src.id_yt, s);
                    }}
                    style={{ width:'100%', accentColor:'#ff3838', cursor:'pointer' }} />
                  <div style={{ display:'flex', justifyContent:'space-between', color:'#374151', fontSize:8, marginTop:2 }}>{['¼','½','1','2','3'].map(s => <span key={s}>{s}×</span>)}</div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                  {[['Inicio','start',0,selClip.start+selClip.dur-1],['Duración','dur',1,state.duration]].map(([l,k,mn,mx]) => (
                    <label key={k}>
                      <span style={{ color:'#4b5563', fontSize:8, display:'block', marginBottom:3 }}>{l} (s)</span>
                      <input type="number" min={mn} max={mx} step={1} value={Math.round(selClip[k])} onChange={e => dispatch({ type:'UPD_CLIP', id:selClip.id, u:{ [k]: Math.max(+mn, Math.min(+mx, +e.target.value)) } })}
                        style={{ width:'100%', ...S.input, fontSize:10, padding:'6px 8px', fontFamily:'monospace', boxSizing:'border-box' }} />
                    </label>
                  ))}
                </div>
                <button className="vte-del-btn" onClick={() => dispatch({ type:'DEL_CLIP', id:selClip.id })} style={{ width:'100%', padding:'6px 0', background:'rgba(220,38,38,.12)', color:'#f87171', border:'none', borderRadius:10, fontSize:10, fontWeight:500, cursor:'pointer', transition:'background .15s' }}>🗑 Eliminar clip</button>
              </div>
            )}

            {selOvl && (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ color:'#fff', fontSize:10, fontWeight:600 }}>T Título</span>
                  <button onClick={() => dispatch({ type:'DEL_OVL', id:selOvl.id })} style={{ color:'#ef4444', fontSize:13, padding:'2px 6px', borderRadius:6, background:'transparent', border:'none', cursor:'pointer' }}>🗑</button>
                </div>
                <div>
                  <span style={{ color:'#4b5563', fontSize:9, display:'block', marginBottom:4 }}>Texto</span>
                  <input value={selOvl.text} onChange={e => dispatch({ type:'UPD_OVL', id:selOvl.id, u:{ text:e.target.value } })} placeholder="Escribe el título…"
                    style={{ width:'100%', ...S.input, fontSize:12, padding:'8px 10px', boxSizing:'border-box' }} />
                </div>
                <div>
                  <span style={{ color:'#4b5563', fontSize:9, display:'block', marginBottom:6 }}>Estilo visual</span>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
                    {OVL_STYLE_LABELS.map(([v, l]) => (
                      <button key={v} className={`vte-style-btn${selOvl.style === v ? ' s-on' : ''}`}
                        onClick={() => dispatch({ type:'UPD_OVL', id:selOvl.id, u:{ style:v } })}
                        style={{ padding:'6px 0', borderRadius:8, fontSize:9, fontWeight:500, cursor:'pointer', background:'#1a1a1a', color:'#6b7280', border:'1px solid #252525', transition:'all .15s' }}>{l}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <span style={{ color:'#4b5563', fontSize:9, display:'block', marginBottom:6 }}>Color del texto</span>
                  <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                    {OVL_COLORS.map(c => (
                      <button key={c} onClick={() => dispatch({ type:'UPD_OVL', id:selOvl.id, u:{ color:c } })}
                        style={{ width:22, height:22, borderRadius:'50%', background:c, border: c==='#000000' ? '1.5px solid #444':'1.5px solid transparent', cursor:'pointer', outline: selOvl.color===c ? '2px solid #fff':'none', outlineOffset:2, transition:'transform .15s' }}
                        onMouseEnter={e => e.currentTarget.style.transform='scale(1.2)'} onMouseLeave={e => e.currentTarget.style.transform='scale(1)'} />
                    ))}
                  </div>
                </div>
                <div>
                  <span style={{ color:'#4b5563', fontSize:9, display:'block', marginBottom:6 }}>Animación de entrada</span>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
                    {OVL_ANIMS.map(([v, l]) => (
                      <button key={v} className={`vte-style-btn${(selOvl.anim||'none') === v ? ' s-on' : ''}`}
                        onClick={() => dispatch({ type:'UPD_OVL', id:selOvl.id, u:{ anim:v } })}
                        style={{ padding:'6px 0', borderRadius:8, fontSize:9, fontWeight:500, cursor:'pointer', background:'#1a1a1a', color:'#6b7280', border:'1px solid #252525', transition:'all .15s' }}>{l}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <span style={{ color:'#4b5563', fontSize:9, display:'block', marginBottom:6 }}>Efecto de partículas</span>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
                    {OVL_PARTICLES.map(([v, l]) => (
                      <button key={v} className={`vte-style-btn${(selOvl.particles||'none') === v ? ' s-on' : ''}`}
                        onClick={() => dispatch({ type:'UPD_OVL', id:selOvl.id, u:{ particles:v } })}
                        style={{ padding:'6px 0', borderRadius:8, fontSize:9, fontWeight:500, cursor:'pointer', background:'#1a1a1a', color:'#6b7280', border:'1px solid #252525', transition:'all .15s' }}>{l}</button>
                    ))}
                  </div>
                </div>
                <div style={{ background:'rgba(253,224,71,.06)', border:'1px solid rgba(253,224,71,.15)', borderRadius:8, padding:'7px 9px', fontSize:9, color:'rgba(253,224,71,.7)', lineHeight:1.5 }}>
                  📌 Arrastra el título en el vídeo para moverlo
                </div>
                <p style={{ color:'#6b7280', fontSize:9, fontFamily:'monospace', margin:0 }}>{fmt(selOvl.start)} → {fmt(selOvl.start + selOvl.dur)}</p>
              </div>
            )}
          </div>

          <div style={{ padding:'8px 12px', borderTop:'1px solid #1e1e1e' }}>
            <div style={{ ...S.muted, marginBottom:4 }}>Zoom línea de tiempo</div>
            <div style={{ display:'flex', gap:4 }}>
              {[1,2,3].map(z => (
                <button key={z} className={`vte-zoom-btn${zoom===z?' z-on':''}`} onClick={() => setZoom(z)}
                  style={{ flex:1, padding:'4px 0', borderRadius:8, fontSize:9, fontWeight:700, cursor:'pointer', background:'#1a1a1a', color:'#6b7280', border:'1px solid #222', transition:'all .15s' }}>{z}×</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* TIMELINE */}
      <div style={{ background:'#111', borderTop:'1px solid #1e1e1e', flexShrink:0, minHeight:160 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderBottom:'1px solid #1e1e1e' }}>
          <span style={S.muted}>Pistas</span>
          <button className="vte-btn-ghost" onClick={onOvlTrackClick} style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 10px', background:'#1e1e1e', color:'#fde047', fontSize:9, borderRadius:8, border:'1px solid #252525', cursor:'pointer' }}>T <span>Añadir título</span></button>
          <button className="vte-btn-ghost" onClick={() => dispatch({ type:'ADD_Q', start: Math.round(state.playhead) })} style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 10px', background:'#1e1e1e', color:'#a78bfa', fontSize:9, borderRadius:8, border:'1px solid #252525', cursor:'pointer' }}>⬡ <span>Añadir test</span></button>
        </div>

        <div style={{ overflowX:'auto' }}>
          <div style={{ display:'flex' }}>
            {/* Track labels */}
            <div style={{ width:HEADER_W, flexShrink:0, background:'#0f0f0f', borderRight:'1px solid #1e1e1e' }}>
              <div style={{ height:28, borderBottom:'1px solid #1e1e1e' }} />
              <div style={{ height:TEXT_H, display:'flex', alignItems:'center', padding:'0 8px', borderBottom:'1px solid #1e1e1e' }}>
                <span style={{ fontSize:8, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'rgba(202,138,4,.7)' }}>Títulos</span>
              </div>
              <div style={{ height:TEXT_H, display:'flex', alignItems:'center', padding:'0 8px', borderBottom:'1px solid #1e1e1e' }}>
                <span style={{ fontSize:8, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'rgba(167,139,250,.7)' }}>Tests</span>
              </div>
              {state.tracks.map(t => (
                <div key={t.id} style={{ height:TRACK_H, display:'flex', alignItems:'center', gap:6, padding:'0 8px', borderBottom:'1px solid #1e1e1e' }}>
                  <div style={{ width:3, height:16, borderRadius:2, background:'#252525' }} />
                  <span style={{ fontSize:8, color:'#4b5563', fontWeight:500 }}>{t.label}</span>
                </div>
              ))}
            </div>

            {/* Scrollable track content */}
            <div style={{ flex:1, overflowX:'auto' }}>
              <div ref={tlRef} style={{ width:`${zoom*100}%`, minWidth:'100%', position:'relative' }}
                onMouseMove={onTracksMove} onMouseLeave={() => setHover(null)}>

                {/* Playhead */}
                <div style={{ position:'absolute', top:0, bottom:0, left:`${s2p(state.playhead, state.duration)}%`, width:0, pointerEvents:'none', zIndex:30 }}>
                  <div style={{ position:'absolute', top:0, bottom:0, width:1.5, background:'#ff3838', boxShadow:'0 0 6px rgba(255,56,56,.4)' }} />
                </div>

                {/* Ruler */}
                <div style={{ position:'relative', height:28, background:'#0d0d0d', borderBottom:'1px solid #1e1e1e', cursor:'ew-resize', touchAction:'none' }}
                  onPointerDown={rulerDown} onPointerMove={rulerMove} onPointerUp={rulerUp}>
                  <div style={{ position:'absolute', top:0, left:`${s2p(state.playhead, state.duration)}%`, transform:'translateX(-50%)', pointerEvents:'none', zIndex:40 }}>
                    <div style={{ width:0, height:0, borderLeft:'5px solid transparent', borderRight:'5px solid transparent', borderTop:'9px solid #ff3838', margin:'0 auto' }} />
                  </div>
                  {ticks.map(t => {
                    const isMaj = t % (ticks[1] * 2 || 60) === 0;
                    return (
                      <div key={t} style={{ position:'absolute', top:0, left:`${s2p(t, state.duration)}%` }}>
                        <div style={{ width:1, height: isMaj?14:8, background: isMaj?'#444':'#222', marginTop:6 }} />
                        {isMaj && <span style={{ position:'absolute', fontSize:8, color:'#444', fontFamily:'monospace', top:16, left:0, transform:'translateX(-50%)', whiteSpace:'nowrap' }}>{fmt(t)}</span>}
                      </div>
                    );
                  })}
                </div>

                {/* Text overlay track */}
                <div style={{ position:'relative', height:TEXT_H, background:'#0f0e00', borderBottom:'1px solid #1e1e1e', cursor:'crosshair', overflow:'visible' }}
                  onClick={onOvlTrackClick}>
                  {state.overlays.map(o => (
                    <div key={o.id} data-overlay>
                      <TextOverlayBlock ovl={o} tlRef={tlRef} dur={state.duration} isSel={state.selId === o.id}
                        onUpd={(id, u) => dispatch({ type:'UPD_OVL', id, u })}
                        onDel={id => dispatch({ type:'DEL_OVL', id })}
                        onSel={id => dispatch({ type:'SEL', id })} />
                    </div>
                  ))}
                  {state.overlays.length === 0 && <span style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, color:'rgba(113,63,18,.3)', pointerEvents:'none' }}>Clic para añadir título superpuesto</span>}
                </div>

                {/* Question markers track */}
                <div style={{ position:'relative', height:TEXT_H, background:'#0a0010', borderBottom:'1px solid #1e1e1e', cursor:'crosshair', overflow:'visible' }}
                  onClick={e => { if (e.target.closest?.('[data-question]') || !tlRef.current) return; const {left,width}=tlRef.current.getBoundingClientRect(); dispatch({type:'ADD_Q',start:Math.round(p2s(e.clientX-left,width,state.duration))}); }}>
                  {(state.questions||[]).map(qcp => (
                    <div key={qcp.id} data-question style={{ position:'absolute', top:'50%', left:`${s2p(qcp.start,state.duration)}%`, transform:'translate(-50%,-50%)', cursor:'pointer', zIndex:10 }}
                      onClick={e => { e.stopPropagation(); dispatch({type:'SEL',id:qcp.id}); }}>
                      <div style={{ width:12,height:12,background:'#a78bfa',borderRadius:2,transform:'rotate(45deg)',border:`2px solid ${state.selId===qcp.id?'#fff':'#6d28d9'}`,transition:'border .12s' }} />
                      <div style={{ position:'absolute',top:'100%',left:'50%',transform:'translateX(-50%)',marginTop:4,color:'#a78bfa',fontSize:7,whiteSpace:'nowrap',fontWeight:600 }}>{qcp.label}</div>
                    </div>
                  ))}
                  {(state.questions||[]).length===0 && <span style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,color:'rgba(167,139,250,.25)',pointerEvents:'none'}}>Clic para añadir test interactivo</span>}
                </div>

                {/* Video tracks */}
                {state.tracks.map(track => {
                  const ghostT = hover?.trackId === track.id ? hover.time : null;
                  return (
                    <div key={track.id} data-trackid={track.id}
                      className={state.hlSrc ? 'vte-track-hl' : ''}
                      style={{ position:'relative', height:TRACK_H, background:'#111', borderBottom:'1px solid #1e1e1e', overflow:'visible', cursor: state.hlSrc ? 'crosshair':'default', transition:'background .12s' }}
                      onClick={e => onTrackClick(e, track.id)}>
                      {ghostT !== null && hlSrcObj && (
                        <div style={{ position:'absolute', top:8, bottom:8, borderRadius:5, pointerEvents:'none', opacity:.3, left:`${s2p(ghostT, state.duration)}%`, width:`${s2p(Math.min(hlSrcObj.dur, state.duration - ghostT), state.duration)}%`, minWidth:4, background: SRC_PALETTE[hlSrcObj.ci].bg, backgroundImage:`url(${hlSrcObj.thumb})`, backgroundSize:'cover', backgroundPosition:'center' }} />
                      )}
                      {track.clips.map(clip => (
                        <div key={clip.id} data-clip>
                          <ClipBlock clip={clip} src={state.sources.find(s => s.id === clip.src)} tlRef={tlRef} dur={state.duration} isSel={state.selId === clip.id}
                            onUpd={(id, u) => dispatch({ type:'UPD_CLIP', id, u })}
                            onDel={id => dispatch({ type:'DEL_CLIP', id })}
                            onSel={id => dispatch({ type:'SEL', id })}
                            onSeek={t => { dispatch({type:'SEEK',t}); seekYoutubeTo(t); }} />
                        </div>
                      ))}
                      {track.clips.length === 0 && state.hlSrc && <span style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, color:'rgba(96,165,250,.3)', pointerEvents:'none' }}>Clic para colocar aquí</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* API Key modal */}
      {showKey && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50 }} onClick={() => setShowKey(false)}>
          <div style={{ background:'#111', borderRadius:20, padding:24, width:380, border:'1px solid #222', boxShadow:'0 25px 60px rgba(0,0,0,.6)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ color:'#fff', fontWeight:700, margin:'0 0 4px', fontSize:15 }}>YouTube Data API v3</h3>
            <p style={{ color:'#6b7280', fontSize:12, margin:'0 0 16px', lineHeight:1.5 }}>Necesaria para buscar vídeos. <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" style={{ color:'#60a5fa' }}>Obtén tu clave en Google Cloud Console</a></p>
            <input value={keyInput} onChange={e => setKeyInput(e.target.value)} placeholder="AIzaSy…" style={{ width:'100%', ...S.input, fontSize:13, padding:'10px 14px', fontFamily:'monospace', marginBottom:12, boxSizing:'border-box' }} />
            <div style={{ display:'flex', gap:8 }}>
              <button className="vte-btn-light" onClick={saveKey} style={{ flex:1, padding:'10px 0', background:'#fff', color:'#000', border:'none', borderRadius:12, fontWeight:600, fontSize:14, cursor:'pointer' }}>Guardar</button>
              <button className="vte-btn-ghost" onClick={() => setShowKey(false)} style={{ padding:'10px 16px', background:'#1e1e1e', color:'#9ca3af', border:'none', borderRadius:12, fontSize:14, cursor:'pointer' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Save / Publish modal */}
      {showSave && (() => {
        const hasTests = (state.questions||[]).some(q => (q.preguntas||[]).length > 0);
        const canSave  = !!saveTitle.trim() && !!auth.currentUser && !saving;
        return (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 }} onClick={() => { if (!shareUrl) setShowSave(false); }}>
            <div style={{ background:'#111', borderRadius:20, padding:24, width:380, border:'1px solid #222', boxShadow:'0 25px 60px rgba(0,0,0,.6)' }} onClick={e => e.stopPropagation()}>
              <h3 style={{ color:'#fff', fontWeight:700, margin:'0 0 8px', fontSize:15 }}>💾 Guardar proyecto</h3>

              {!shareUrl ? (<>
                <p style={{ color:'#6b7280', fontSize:11, margin:'0 0 14px', lineHeight:1.5 }}>Guarda para continuar editando más tarde o publica para compartir.</p>
                <label style={{ display:'block', color:'#9ca3af', fontSize:10, marginBottom:5 }}>Título del proyecto</label>
                <input autoFocus value={saveTitle} onChange={e => setSaveTitle(e.target.value)} placeholder="Ej: Comprensión auditiva – Unit 4"
                  style={{ width:'100%', background:'#1a1a1a', color:'#fff', border:'1px solid #333', borderRadius:10, fontSize:13, padding:'9px 12px', outline:'none', boxSizing:'border-box', marginBottom:12 }} />
                {!auth.currentUser && <p style={{ color:'#f87171', fontSize:11, margin:'0 0 10px' }}>⚠️ Debes iniciar sesión para guardar.</p>}
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <button onClick={() => doSave(false)} disabled={!canSave}
                    style={{ padding:'10px', background:'#1e1e1e', color:'#d1d5db', border:'1px solid #333', borderRadius:12, fontWeight:600, fontSize:13, cursor:'pointer', opacity:canSave?1:.5, textAlign:'left' }}>
                    💾 Guardar borrador — continuar editando después
                  </button>
                  <button onClick={() => doSave(true)} disabled={!canSave || !hasTests}
                    style={{ padding:'10px', background: hasTests&&canSave?'#a78bfa':'#1a1a1a', color: hasTests&&canSave?'#000':'#374151', border:'none', borderRadius:12, fontWeight:700, fontSize:13, cursor:hasTests&&canSave?'pointer':'default', textAlign:'left' }}>
                    🌐 Publicar y obtener enlace{!hasTests ? ' (necesita al menos 1 test)' : ''}
                  </button>
                  <button onClick={() => setShowSave(false)} style={{ padding:'8px', background:'transparent', color:'#6b7280', border:'none', borderRadius:10, fontSize:12, cursor:'pointer' }}>Cancelar</button>
                </div>
              </>) : (<>
                <p style={{ color:'#4ade80', fontSize:12, margin:'0 0 16px', fontWeight:600 }}>✓ Publicado correctamente</p>
                <label style={{ display:'block', color:'#9ca3af', fontSize:10, marginBottom:5 }}>Enlace para compartir</label>
                <div style={{ display:'flex', gap:8, marginBottom:14 }}>
                  <input readOnly value={shareUrl}
                    style={{ flex:1, background:'#1a1a1a', color:'#a78bfa', border:'1px solid #333', borderRadius:10, fontSize:11, padding:'9px 12px', outline:'none', fontFamily:'monospace' }} />
                  <button onClick={() => { navigator.clipboard.writeText(shareUrl).catch(()=>{}); setCopiedLink(true); setTimeout(()=>setCopiedLink(false),2000); }}
                    style={{ padding:'9px 14px', background: copiedLink?'#4ade80':'#a78bfa', color:'#000', border:'none', borderRadius:10, fontWeight:700, fontSize:12, cursor:'pointer', flexShrink:0 }}>
                    {copiedLink ? '✓' : '📋'}
                  </button>
                </div>
                <p style={{ color:'#6b7280', fontSize:11, margin:'0 0 12px', lineHeight:1.5 }}>Cualquiera con este enlace puede ver el VideoQuiz sin necesidad de cuenta.</p>
                <button onClick={() => { setShowSave(false); setShareUrl(''); }} style={{ width:'100%', padding:'10px', background:'#1e1e1e', color:'#9ca3af', border:'none', borderRadius:12, fontSize:13, cursor:'pointer' }}>Cerrar</button>
              </>)}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export { VideoQuestionOverlay, useVteCss, OVL_PRESETS, ParticleEffect };
