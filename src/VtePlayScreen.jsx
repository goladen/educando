import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { VideoQuestionOverlay, useVteCss, OVL_PRESETS, ParticleEffect } from './VideoTimelineEditor';

const fmt = s => `${Math.floor(s/60).toString().padStart(2,'0')}:${Math.floor(s%60).toString().padStart(2,'0')}`;
const s2p = (s, d) => (d > 0 ? (s / d) * 100 : 0);

function loadYTAPI() {
  return new Promise(res => {
    if (window.YT?.Player) return res();
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (prev) prev(); res(); };
  });
}

export default function VtePlayScreen({ recurso, onBack }) {
  useVteCss();
  const vteData   = recurso.vteData  || {};
  const sources   = vteData.sources  || [];
  const tracks    = vteData.tracks   || [];
  const overlays  = vteData.overlays || [];
  const questions = vteData.questions|| [];
  const duration  = vteData.duration || 300;

  const vidRef     = useRef(null);
  const playersRef = useRef({});
  const readyRef   = useRef({});
  const timerRef   = useRef(null);
  const primaryRef = useRef(null);
  const prevPhRef  = useRef(0);
  const barRef     = useRef(null);
  const dragging   = useRef(false);

  const [playhead,    setPlayhead]    = useState(0);
  const [playing,     setPlaying]     = useState(false);
  const [readyCnt,    setReadyCnt]    = useState(0);
  const [activeQId,   setActiveQId]   = useState(null);
  const [totalScore,  setTotalScore]  = useState({ c: 0, t: 0 });
  const [finished,    setFinished]    = useState(false);

  const ready = readyCnt >= sources.length && sources.length > 0;

  const activeBlocks = useMemo(() => {
    const result = [];
    for (const track of tracks) {
      const clip = track.clips.find(c => playhead >= c.start && playhead < c.start + c.dur);
      if (clip) {
        const src = sources.find(s => s.id === clip.src);
        if (src) result.push({ src, track });
      }
    }
    return result;
  }, [playhead, tracks, sources]);

  const activeOverlays = useMemo(() =>
    overlays.filter(o => playhead >= o.start && playhead < o.start + o.dur)
  , [playhead, overlays]);

  const eachReady = fn => {
    Object.entries(readyRef.current).forEach(([id, ok]) => {
      if (ok) try { fn(playersRef.current[id]); } catch {}
    });
  };
  const playAll  = useCallback(() => eachReady(p => p.playVideo()), []);
  const pauseAll = useCallback(() => eachReady(p => p.pauseVideo()), []);
  const seekAll  = useCallback(t  => eachReady(p => p.seekTo(t, true)), []);
  const toggle   = useCallback(() => { if (playing) pauseAll(); else playAll(); }, [playing]);

  // Init all YouTube players on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadYTAPI();
      for (const src of sources) {
        if (cancelled || playersRef.current[src.id_yt]) continue;
        playersRef.current[src.id_yt] = new window.YT.Player(`vte-p-${src.id_yt}`, {
          videoId: src.id_yt,
          playerVars: { controls: 0, disablekb: 1, modestbranding: 1, rel: 0, iv_load_policy: 3 },
          events: {
            onReady: () => {
              readyRef.current[src.id_yt] = true;
              playersRef.current[src.id_yt].pauseVideo();
              if (!primaryRef.current) primaryRef.current = src.id_yt;
              setReadyCnt(c => c + 1);
            },
            onStateChange: e => {
              if (src.id_yt !== primaryRef.current) return;
              const isP = e.data === window.YT?.PlayerState?.PLAYING;
              setPlaying(isP);
              clearInterval(timerRef.current);
              if (isP) {
                timerRef.current = setInterval(() => {
                  try { setPlayhead(playersRef.current[src.id_yt].getCurrentTime()); } catch {}
                }, 150);
              }
            },
          },
        });
      }
    })();
    return () => {
      cancelled = true;
      clearInterval(timerRef.current);
      Object.values(playersRef.current).forEach(p => { try { p?.destroy(); } catch {} });
    };
  }, []);

  // Volume sync
  useEffect(() => {
    for (const { src, track } of activeBlocks) {
      try { if (readyRef.current[src.id_yt]) playersRef.current[src.id_yt]?.setVolume(track.volume ?? 100); } catch {}
    }
  }, [activeBlocks]);

  // Question detection + end detection
  useEffect(() => {
    if (playing && !activeQId) {
      const hit = questions.find(q => q.start > prevPhRef.current && q.start <= playhead && (q.preguntas?.length > 0));
      if (hit) { pauseAll(); setActiveQId(hit.id); }
      else if (playhead >= duration - 0.5) { pauseAll(); setFinished(true); }
    }
    prevPhRef.current = playhead;
  }, [playhead]);

  // Progress bar
  function onBarDown(e) { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); seekFromBar(e); }
  function onBarMove(e) { if (dragging.current) seekFromBar(e); }
  function onBarUp(e)   { dragging.current = false; e.currentTarget.releasePointerCapture(e.pointerId); }
  function seekFromBar(e) {
    if (!barRef.current) return;
    const { left, width } = barRef.current.getBoundingClientRect();
    const t = Math.max(0, Math.min(duration, ((e.clientX - left) / width) * duration));
    setPlayhead(t); seekAll(t);
  }

  const hasTests = questions.filter(q => q.preguntas?.length > 0).length;

  if (finished) return (
    <div style={{ minHeight:'100vh', background:'#0F172A', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, padding:24, color:'#fff', fontFamily:'inherit' }}>
      <div style={{ fontSize:52 }}>{totalScore.c === totalScore.t && totalScore.t > 0 ? '🏆' : '📝'}</div>
      <h2 style={{ margin:0, fontWeight:800, fontSize:20, textAlign:'center' }}>{recurso.titulo}</h2>
      {totalScore.t > 0 ? (
        <>
          <div style={{ fontSize:40, fontWeight:900, color: totalScore.c===totalScore.t?'#4ade80':totalScore.c/totalScore.t>=0.6?'#fde047':'#f87171' }}>
            {totalScore.c}<span style={{ fontSize:20, color:'#64748b' }}>/{totalScore.t}</span>
          </div>
          <div style={{ color:'#64748b', fontSize:14 }}>preguntas correctas</div>
        </>
      ) : (
        <div style={{ color:'#64748b', fontSize:14 }}>Vídeo completado</div>
      )}
      <button onClick={onBack} style={{ marginTop:8, padding:'12px 32px', background:'#DC2626', color:'#fff', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:'pointer' }}>← Volver</button>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:'#0F172A', display:'flex', flexDirection:'column', color:'#fff', fontFamily:'inherit' }}>
      {/* Header */}
      <div style={{ background:'#1E293B', padding:'10px 16px', display:'flex', alignItems:'center', gap:12, borderBottom:'1px solid #334155', flexShrink:0 }}>
        <button onClick={onBack} style={{ border:'none', background:'rgba(255,255,255,.1)', borderRadius:8, cursor:'pointer', fontSize:14, padding:'5px 11px', color:'white' }}>←</button>
        <span style={{ fontWeight:700, fontSize:15, flex:1, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{recurso.titulo}</span>
        {hasTests > 0 && <span style={{ color:'#94a3b8', fontSize:12, flexShrink:0 }}>{hasTests} test{hasTests!==1?'s':''}</span>}
      </div>

      {/* Main */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:16, gap:12 }}>
        {/* Monitor */}
        <div ref={vidRef} style={{ position:'relative', width:'100%', maxWidth:720, background:'#000', borderRadius:12, overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,.6)', aspectRatio:'16/9' }}>

          {/* All iframes — always in DOM, CSS-only visibility */}
          {sources.map(src => {
            const ab    = activeBlocks.find(b => b.src.id_yt === src.id_yt);
            const track = ab?.track;
            const isActive = !!ab;
            const tidx = isActive ? tracks.indexOf(track) : -1;
            return (
              <div key={src.id_yt} style={{
                position: 'absolute',
                left:   isActive ? `${track.x}%` : 0,
                top:    isActive ? `${track.y}%` : 0,
                width:  isActive ? `${track.w}%` : '100%',
                height: isActive ? `${track.h}%` : '100%',
                opacity: isActive ? (track.opacity ?? 1) : 0,
                transform: isActive ? `rotate(${track.rotation||0}deg)` : 'none',
                transformOrigin: 'center center',
                background: '#000',
                zIndex: isActive ? (tidx + 1) : 0,
                pointerEvents: 'none',
              }}>
                <div id={`vte-p-${src.id_yt}`} style={{ width:'100%', height:'100%' }} />
              </div>
            );
          })}

          {/* Question overlay */}
          {activeQId && (() => {
            const qcp = questions.find(q => q.id === activeQId);
            if (!qcp) return null;
            return (
              <VideoQuestionOverlay key={activeQId} checkpoint={qcp}
                onComplete={result => {
                  setActiveQId(null);
                  if (result) setTotalScore(s => ({ c: s.c + result.c, t: s.t + result.t }));
                  playAll();
                }} />
            );
          })()}

          {/* Text overlays */}
          {activeOverlays.map(ovl => {
            const preset = OVL_PRESETS[ovl.style] || OVL_PRESETS.title;
            const textShadow = preset.isNeon
              ? `0 0 8px ${ovl.color||'#fff'}, 0 0 18px ${ovl.color||'#fff'}, 0 0 36px ${ovl.color||'#fff'}`
              : (preset.textShadow || 'none');
            const animClass = ovl.anim && ovl.anim !== 'none' ? `vte-anim-${ovl.anim}` : undefined;
            const hasP = ovl.particles && ovl.particles !== 'none';
            return (
              <div key={ovl.id} style={{ position:'absolute', left:`${ovl.x}%`, top:`${ovl.y}%`, transform:'translate(-50%,-50%)', color: ovl.color||'#fff', userSelect:'none', zIndex:20, maxWidth:'90%', textAlign:'center', lineHeight:1.2, pointerEvents:'none' }}>
                <span className={animClass}
                  style={{ display:'inline-block', fontSize:preset.fontSize, fontWeight:preset.fontWeight, textShadow, padding: preset.padding||undefined, background: preset.background||'transparent', borderRadius: preset.borderRadius||0, whiteSpace: ovl.anim==='typewriter' ? 'nowrap' : undefined }}>
                  {ovl.text}
                </span>
                {hasP && <ParticleEffect type={ovl.particles} />}
              </div>
            );
          })}

          {!ready && sources.length > 0 && (
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,.7)', color:'#94a3b8', fontSize:13 }}>
              Cargando vídeos...
            </div>
          )}
          {sources.length === 0 && (
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', color:'#334155', fontSize:14 }}>
              Sin vídeos
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{ width:'100%', maxWidth:720, display:'flex', flexDirection:'column', gap:10 }}>
          {/* Progress bar */}
          <div ref={barRef} onPointerDown={onBarDown} onPointerMove={onBarMove} onPointerUp={onBarUp}
            style={{ position:'relative', height:6, background:'#1E293B', borderRadius:3, cursor:'pointer', touchAction:'none' }}>
            <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${s2p(playhead,duration)}%`, background:'#DC2626', borderRadius:3 }} />
            {questions.filter(q => q.preguntas?.length > 0).map(q => (
              <div key={q.id} title={q.label}
                style={{ position:'absolute', top:'50%', left:`${s2p(q.start,duration)}%`, transform:'translate(-50%,-50%)', width:10, height:10, background:'#a78bfa', borderRadius:2, rotate:'45deg', pointerEvents:'none' }} />
            ))}
          </div>

          {/* Button row */}
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button onClick={toggle} disabled={!ready}
              style={{ width:44, height:44, borderRadius:'50%', background:'#DC2626', color:'#fff', border:'none', cursor:ready?'pointer':'default', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', opacity:ready?1:0.5, flexShrink:0 }}>
              {playing ? '⏸' : '▶'}
            </button>
            <span style={{ color:'#64748b', fontSize:12, fontFamily:'monospace' }}>{fmt(playhead)} / {fmt(duration)}</span>
            {hasTests > 0 && (
              <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:5 }}>
                {questions.filter(q => q.preguntas?.length > 0).map(q => (
                  <div key={q.id} title={q.label}
                    style={{ width:8, height:8, borderRadius:'50%', background: playhead > q.start ? '#a78bfa' : '#334155' }} />
                ))}
                {totalScore.t > 0 && (
                  <span style={{ color:'#a78bfa', fontSize:11, marginLeft:4, fontWeight:700 }}>{totalScore.c}/{totalScore.t}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
