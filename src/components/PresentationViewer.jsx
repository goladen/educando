import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { parseVideoUrl } from './PresentationEditor';

const TIPO_ICONS = {
  PASAPALABRA: '🔤', CAZABURBUJAS: '🫧', THINKHOOT: '📡', PILIVE: '📡',
  MATHLIVE: '🧮', OLYMPICLIVE: '🏅', APAREJADOS: '🃏', RULETA: '🎡',
  WORDLE: '📝', OMNI: '📚', OMNINTERACTIVE: '📚', VIDEOQUIZZ: '🎬',
  SOLAR_SYSTEM: '🪐', SINTAXIS: '🖊️', ETIQUETAS: '🏷️',
};
const TIPO_LABELS = {
  PASAPALABRA: 'Pasapalabra', CAZABURBUJAS: 'Burbujas / Pikatron', THINKHOOT: 'Pi-Live',
  MATHLIVE: 'MathLive', OLYMPICLIVE: 'Olympic Live', APAREJADOS: 'AparejaDOS',
  RULETA: 'La Ruleta', WORDLE: 'Wordle', OMNI: 'Omninteractive',
  OMNINTERACTIVE: 'Omninteractive', VIDEOQUIZZ: 'VideoQuizz', SOLAR_SYSTEM: 'Sistema Solar',
  SINTAXIS: 'Sintaxis', ETIQUETAS: 'EtiquetaMe',
};

// ─── GAME FULLSCREEN MODAL ────────────────────────────────────────────────────
function GameModal({ slide, onClose }) {
  const t = THEMES[slide.theme] || THEMES.dark;
  const gameUrl = `${window.location.origin}/?r=${slide.resourceId}`;
  const iframeRef = useRef();

  const handleFullscreen = () => {
    const el = iframeRef.current;
    if (!el) return;
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  };

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 10000, display: 'flex', flexDirection: 'column' }}>
      {/* Modal top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: '#111827', borderBottom: '1px solid #374151', flexShrink: 0 }}>
        <span style={{ fontSize: 20 }}>{TIPO_ICONS[slide.resourceType] || '🎮'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, color: '#fff', fontSize: 15, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{slide.resourceTitle || 'Juego'}</div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>{TIPO_LABELS[slide.resourceType] || 'Recurso interactivo'}</div>
        </div>
        <button
          onClick={handleFullscreen}
          title="Pantalla completa"
          style={{ background: '#374151', color: '#e5e7eb', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          ⛶ Pantalla completa
        </button>
        <button
          onClick={() => window.open(gameUrl, '_blank')}
          title="Abrir en nueva pestaña"
          style={{ background: '#374151', color: '#e5e7eb', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
        >
          ↗ Nueva pestaña
        </button>
        <button
          onClick={onClose}
          style={{ background: '#7f1d1d', color: '#fca5a5', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
        >
          ✕ Cerrar
        </button>
      </div>
      {/* Game iframe */}
      <iframe
        ref={iframeRef}
        src={gameUrl}
        style={{ flex: 1, border: 'none', background: '#000' }}
        allow="fullscreen"
        title={slide.resourceTitle || 'Juego'}
      />
    </div>
  );
}

const THEMES = {
  dark: { bg: 'linear-gradient(135deg, #1a0533 0%, #0d1b4a 50%, #0a0a1a 100%)', accent: '#6c63ff', text: '#ffffff', sub: 'rgba(255,255,255,0.65)', card: 'rgba(255,255,255,0.07)', cardBorder: 'rgba(255,255,255,0.12)', tag: 'rgba(108,99,255,0.25)', tagBorder: 'rgba(108,99,255,0.5)', tagText: '#a78bfa' },
  purple: { bg: 'linear-gradient(135deg, #6c63ff 0%, #a855f7 60%, #ec4899 100%)', accent: '#ffffff', text: '#ffffff', sub: 'rgba(255,255,255,0.8)', card: 'rgba(255,255,255,0.2)', cardBorder: 'rgba(255,255,255,0.3)', tag: 'rgba(255,255,255,0.2)', tagBorder: 'rgba(255,255,255,0.4)', tagText: '#ffffff' },
  light: { bg: '#f0f4ff', accent: '#6c63ff', text: '#1a1a2e', sub: '#555', card: '#ffffff', cardBorder: '#e8e8ff', tag: '#ede9fe', tagBorder: '#c4b5fd', tagText: '#6c63ff' },
  blue: { bg: 'linear-gradient(160deg, #0A0E45 0%, #0d0d2b 100%)', accent: '#a78bfa', text: '#ffffff', sub: 'rgba(255,255,255,0.65)', card: 'rgba(255,255,255,0.08)', cardBorder: 'rgba(255,255,255,0.12)', tag: 'rgba(108,99,255,0.25)', tagBorder: 'rgba(108,99,255,0.5)', tagText: '#a78bfa' },
  green: { bg: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)', accent: '#34d399', text: '#ffffff', sub: 'rgba(255,255,255,0.75)', card: 'rgba(255,255,255,0.1)', cardBorder: 'rgba(52,211,153,0.3)', tag: 'rgba(52,211,153,0.2)', tagBorder: 'rgba(52,211,153,0.5)', tagText: '#6ee7b7' },
  orange: { bg: 'linear-gradient(135deg, #7c2d12 0%, #431407 100%)', accent: '#fb923c', text: '#ffffff', sub: 'rgba(255,255,255,0.75)', card: 'rgba(255,255,255,0.1)', cardBorder: 'rgba(251,146,60,0.3)', tag: 'rgba(251,146,60,0.2)', tagBorder: 'rgba(251,146,60,0.5)', tagText: '#fdba74' },
};

function SlideDisplay({ slide, isActive, onPlay }) {
  const t = THEMES[slide.theme] || THEMES.dark;
  const anim = isActive ? 'slideIn 0.55s cubic-bezier(.4,0,.2,1) both' : 'none';

  const Tags = () => (slide.tags?.length > 0 && (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: slide.layout === 'title' || slide.layout === 'cta' ? 'center' : 'flex-start' }}>
      {slide.tags.map((tag, i) => (
        <span key={i} style={{ background: t.tag, border: `1px solid ${t.tagBorder}`, color: t.tagText, borderRadius: 20, padding: 'clamp(3px,1vw,5px) clamp(10px,3vw,14px)', fontSize: 'clamp(0.7rem,2.5vw,0.82rem)', fontWeight: 600 }}>{tag}</span>
      ))}
    </div>
  ));

  const bodyLines = (slide.body || '').split('\n').filter(Boolean);

  switch (slide.layout) {
    case 'title':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'clamp(12px,3vw,20px)', padding: 'clamp(20px,5vw,40px)', height: '100%', textAlign: 'center' }}>
          <div style={{ animation: anim, fontSize: 'clamp(2rem,8vw,4.5rem)', fontWeight: 900, letterSpacing: -2, background: `linear-gradient(135deg, ${t.accent}, #ec4899)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.1 }}>
            {slide.heading}
          </div>
          {slide.subheading && (
            <div style={{ animation: anim, animationDelay: '0.15s', color: t.sub, fontSize: 'clamp(0.8rem,2.5vw,1.1rem)', fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase' }}>{slide.subheading}</div>
          )}
          {slide.imageBase64 && (
            <div style={{ animation: anim, animationDelay: '0.25s', width: '50%', maxWidth: 300, borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
              <img src={slide.imageBase64} alt="" style={{ width: '100%', objectFit: 'cover' }} />
            </div>
          )}
          <div style={{ animation: anim, animationDelay: '0.3s' }}><Tags /></div>
        </div>
      );
    case 'content':
      return (
        <div style={{ padding: 'clamp(20px,5vw,40px)', height: '100%', display: 'flex', flexDirection: 'column', gap: 'clamp(10px,2.5vw,18px)' }}>
          <div style={{ animation: anim, fontSize: 'clamp(1.3rem,4vw,2.2rem)', fontWeight: 900, color: t.text, borderBottom: `2px solid ${t.accent}33`, paddingBottom: 8 }}>{slide.heading}</div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bodyLines.map((line, i) => (
              <div key={i} style={{ animation: anim, animationDelay: `${0.1 + i * 0.1}s`, display: 'flex', alignItems: 'flex-start', gap: 10, padding: 'clamp(6px,1.5vw,10px) clamp(10px,2.5vw,16px)', background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 10, color: t.text, fontSize: 'clamp(0.85rem,2.5vw,1.05rem)', fontWeight: 500, lineHeight: 1.5 }}>
                {line.startsWith('•') ? <><span style={{ color: t.accent, fontWeight: 900, flexShrink: 0 }}>•</span><span>{line.slice(1).trim()}</span></> : line}
              </div>
            ))}
          </div>
          <div style={{ animation: anim, animationDelay: `${0.1 + bodyLines.length * 0.1}s` }}><Tags /></div>
        </div>
      );
    case 'image-right':
    case 'image-left':
      const imgRight = slide.layout === 'image-right';
      const textBlock = (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'clamp(8px,2vw,14px)', animation: anim }}>
          <div style={{ fontSize: 'clamp(1.2rem,3.5vw,2rem)', fontWeight: 900, color: t.text }}>{slide.heading}</div>
          <div style={{ color: t.text, opacity: 0.85, fontSize: 'clamp(0.85rem,2.3vw,1rem)', lineHeight: 1.7, flex: 1 }}>{slide.body}</div>
          <Tags />
        </div>
      );
      const imgBlock = (
        <div style={{ width: 'clamp(140px,35%,280px)', flexShrink: 0, animation: anim, animationDelay: '0.2s', borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.3)', background: t.card, border: `1px solid ${t.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 140 }}>
          {slide.imageBase64 ? <img src={slide.imageBase64} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: t.sub, fontSize: 32 }}>🖼️</span>}
        </div>
      );
      return (
        <div style={{ display: 'flex', flexDirection: imgRight ? 'row' : 'row-reverse', gap: 'clamp(12px,3vw,24px)', padding: 'clamp(16px,4vw,32px)', height: '100%', alignItems: 'center' }}>
          {imgRight ? <>{textBlock}{imgBlock}</> : <>{textBlock}{imgBlock}</>}
        </div>
      );
    case 'two-col':
      const col1Lines = (slide.body || '').split('\n').filter(Boolean);
      const col2Lines = (slide.col2 || '').split('\n').filter(Boolean);
      return (
        <div style={{ padding: 'clamp(16px,4vw,28px)', height: '100%', display: 'flex', flexDirection: 'column', gap: 'clamp(8px,2vw,14px)' }}>
          <div style={{ animation: anim, fontSize: 'clamp(1.2rem,3.5vw,2rem)', fontWeight: 900, color: t.text }}>{slide.heading}</div>
          <div style={{ display: 'flex', flex: 1, gap: 'clamp(8px,2vw,16px)', minHeight: 0 }}>
            {[col1Lines, col2Lines].map((lines, ci) => (
              <div key={ci} style={{ flex: 1, background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 12, padding: 'clamp(10px,2.5vw,16px)', display: 'flex', flexDirection: 'column', gap: 8, animation: anim, animationDelay: `${0.1 + ci * 0.15}s`, overflow: 'hidden' }}>
                {lines.map((line, i) => (
                  <div key={i} style={{ color: t.text, fontSize: 'clamp(0.8rem,2vw,0.95rem)', lineHeight: 1.6, display: 'flex', gap: 8 }}>
                    {line.startsWith('•') ? <><span style={{ color: t.accent, flexShrink: 0 }}>•</span><span>{line.slice(1).trim()}</span></> : line}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      );
    case 'cta':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'clamp(12px,3vw,20px)', padding: 'clamp(20px,5vw,40px)', height: '100%', textAlign: 'center' }}>
          <div style={{ animation: anim, fontSize: 'clamp(1.5rem,5.5vw,3rem)', fontWeight: 900, color: t.text, lineHeight: 1.2 }}>{slide.heading}</div>
          {slide.subheading && <div style={{ animation: anim, animationDelay: '0.15s', color: t.sub, fontSize: 'clamp(0.85rem,2.5vw,1.1rem)', fontWeight: 600 }}>{slide.subheading}</div>}
          {slide.body && (
            <div style={{ animation: anim, animationDelay: '0.3s', background: '#fff', color: t.accent !== '#ffffff' ? t.accent : '#6c63ff', fontWeight: 900, borderRadius: 40, padding: 'clamp(10px,2.5vw,14px) clamp(24px,6vw,36px)', fontSize: 'clamp(1rem,4vw,1.5rem)', boxShadow: '0 4px 24px rgba(0,0,0,0.25)' }}>{slide.body}</div>
          )}
          <div style={{ animation: anim, animationDelay: '0.45s' }}><Tags /></div>
        </div>
      );
    case 'map':
      const nodes = slide.mapNodes || [];
      const center = nodes.find(n => n.isCenter) || nodes[0];
      return (
        <div style={{ padding: 'clamp(12px,3vw,20px)', height: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ animation: anim, fontSize: 'clamp(1.1rem,3vw,1.8rem)', fontWeight: 900, color: t.text }}>{slide.heading}</div>
          <div style={{ flex: 1, position: 'relative', background: t.card, borderRadius: 12, border: `1px solid ${t.cardBorder}`, overflow: 'hidden' }}>
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              {nodes.filter(n => !n.isCenter).map(n => center && (
                <line key={`l-${n.id}`} x1={`${center.x}%`} y1={`${center.y}%`} x2={`${n.x}%`} y2={`${n.y}%`} stroke={t.cardBorder} strokeWidth={2} strokeDasharray="5,5" />
              ))}
            </svg>
            {nodes.map((node, i) => (
              <div key={node.id} style={{
                position: 'absolute', left: `${node.x}%`, top: `${node.y}%`, transform: 'translate(-50%,-50%)',
                background: node.isCenter ? t.accent : t.card, border: `2px solid ${node.isCenter ? t.accent : t.cardBorder}`,
                borderRadius: node.isCenter ? 20 : 12, padding: node.isCenter ? 'clamp(6px,2vw,10px) clamp(12px,3vw,20px)' : 'clamp(4px,1.5vw,7px) clamp(10px,2.5vw,16px)',
                color: node.isCenter ? '#fff' : t.text, fontSize: node.isCenter ? 'clamp(0.8rem,2vw,1rem)' : 'clamp(0.7rem,1.8vw,0.88rem)',
                fontWeight: node.isCenter ? 800 : 600, whiteSpace: 'nowrap', zIndex: 2,
                animation: anim, animationDelay: `${0.1 + i * 0.08}s`,
                boxShadow: node.isCenter ? `0 4px 20px ${t.accent}66` : 'none',
              }}>{node.text}</div>
            ))}
          </div>
        </div>
      );
    case 'game': {
      const icon = TIPO_ICONS[slide.resourceType] || '🎮';
      const label = TIPO_LABELS[slide.resourceType] || 'Recurso interactivo';
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 'clamp(12px,3vw,20px)', padding: 'clamp(16px,4vw,32px)' }}>
          <div style={{ animation: anim, background: t.card, border: `2px solid ${t.cardBorder}`, borderRadius: 24, padding: 'clamp(20px,5vw,36px) clamp(24px,6vw,48px)', textAlign: 'center', maxWidth: 480, width: '100%', boxShadow: `0 8px 40px rgba(0,0,0,0.3)` }}>
            <div style={{ fontSize: 'clamp(2.5rem,10vw,4rem)', marginBottom: 12 }}>{icon}</div>
            <div style={{ fontSize: 'clamp(1.1rem,3.5vw,1.8rem)', fontWeight: 900, color: t.text, marginBottom: 8 }}>{slide.resourceTitle || slide.heading || 'Juego interactivo'}</div>
            <div style={{ background: t.tag, border: `1px solid ${t.tagBorder}`, color: t.tagText, borderRadius: 20, padding: '4px 14px', display: 'inline-block', fontSize: 'clamp(0.7rem,2vw,0.85rem)', fontWeight: 700, marginBottom: 12 }}>{label}</div>
            {slide.subheading && <div style={{ color: t.sub, fontSize: 'clamp(0.78rem,2vw,0.95rem)', marginBottom: 16 }}>{slide.subheading}</div>}
            {slide.resourceId
              ? <button onClick={onPlay} style={{ background: `linear-gradient(135deg, ${t.accent}, #a855f7)`, color: '#fff', border: 'none', borderRadius: 50, padding: 'clamp(12px,3vw,16px) clamp(24px,6vw,40px)', fontSize: 'clamp(1rem,3.5vw,1.3rem)', fontWeight: 900, cursor: 'pointer', boxShadow: `0 6px 24px ${t.accent}55`, display: 'flex', alignItems: 'center', gap: 10, margin: '0 auto' }}>
                  <span style={{ fontSize: '1.2em' }}>▶</span> Jugar ahora
                </button>
              : <div style={{ color: t.sub, fontSize: 13, fontStyle: 'italic' }}>Sin juego asignado</div>
            }
          </div>
          {slide.resourceId && (
            <div style={{ animation: anim, animationDelay: '0.3s', display: 'flex', gap: 10 }}>
              <button onClick={onPlay} style={{ background: t.card, border: `1px solid ${t.cardBorder}`, color: t.sub, borderRadius: 20, padding: '5px 14px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>
                ⛶ Pantalla completa
              </button>
              <button onClick={() => window.open(`${window.location.origin}/?r=${slide.resourceId}`, '_blank')} style={{ background: t.card, border: `1px solid ${t.cardBorder}`, color: t.sub, borderRadius: 20, padding: '5px 14px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>
                ↗ Nueva pestaña
              </button>
            </div>
          )}
        </div>
      );
    }
    case 'video': {
      const parsed = parseVideoUrl(slide.videoUrl);
      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 'clamp(10px,2.5vw,20px)', gap: 'clamp(6px,1.5vw,12px)' }}>
          {slide.heading && (
            <div style={{ animation: anim, fontSize: 'clamp(1rem,3vw,1.6rem)', fontWeight: 900, color: t.text, flexShrink: 0 }}>{slide.heading}</div>
          )}
          <div style={{ flex: 1, minHeight: 0, borderRadius: 12, overflow: 'hidden', background: '#000', position: 'relative', animation: anim, animationDelay: slide.heading ? '0.15s' : '0s' }}>
            {parsed?.type === 'youtube' || parsed?.type === 'vimeo' ? (
              <iframe
                src={parsed.embed + (parsed.type === 'youtube' ? '&autoplay=0' : '')}
                style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                title={slide.heading || 'Vídeo'}
                onPlay={onPlay}
              />
            ) : parsed?.type === 'direct' ? (
              <video
                src={parsed.embed}
                controls
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                onPlay={onPlay}
                onPause={onPlay}
                onEnded={onPlay}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, color: t.sub }}>
                <span style={{ fontSize: 40 }}>▶️</span>
                <span style={{ fontSize: 13 }}>URL de vídeo no configurada</span>
              </div>
            )}
          </div>
          {slide.videoCaption && (
            <div style={{ animation: anim, animationDelay: '0.2s', color: t.sub, fontSize: 'clamp(0.7rem,1.8vw,0.9rem)', fontStyle: 'italic', textAlign: 'center', flexShrink: 0 }}>{slide.videoCaption}</div>
          )}
        </div>
      );
    }
    default:
      return <div style={{ color: t.text, padding: 24 }}>{slide.heading}</div>;
  }
}

export default function PresentationViewer({ presentacionId, onClose }) {
  const [pres, setPres] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [current, setCurrent] = useState(0);
  const timerRef = useRef(null);
  const [animKey, setAnimKey] = useState(0);
  const [gameModalSlide, setGameModalSlide] = useState(null);
  const [videoPlaying, setVideoPlaying] = useState(false); // pause auto-advance while video plays

  useEffect(() => {
    if (!presentacionId) return;
    getDoc(doc(db, 'presentations', presentacionId)).then(snap => {
      if (snap.exists()) setPres({ id: snap.id, ...snap.data() });
      else setError('Presentación no encontrada');
      setLoading(false);
    }).catch(e => { setError(e.message); setLoading(false); });
  }, [presentacionId]);

  const slides = pres?.slides || [];

  const goTo = (idx) => {
    clearTimeout(timerRef.current);
    setAnimKey(k => k + 1);
    setCurrent(idx);
  };

  const next = () => goTo((current + 1) % slides.length);
  const prev = () => goTo((current - 1 + slides.length) % slides.length);

  useEffect(() => {
    if (!slides.length || gameModalSlide || videoPlaying) return; // pause while game/video is active
    const dur = slides[current]?.duration || 5000;
    timerRef.current = setTimeout(next, dur);
    return () => clearTimeout(timerRef.current);
  }, [current, slides.length, animKey, gameModalSlide, videoPlaying]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') next();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [current, slides.length]);

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#0d0d2b', color: '#6c63ff', fontSize: 18, fontWeight: 700 }}>⏳ Cargando…</div>;
  if (error) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#0d0d2b', color: '#f87171', fontSize: 16 }}>{error}</div>;
  if (!slides.length) return null;

  const slide = slides[current];
  const t = THEMES[slide?.theme] || THEMES.dark;
  const progress = ((current + 1) / slides.length) * 100;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 9999, display: 'flex', flexDirection: 'column', fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>
      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: scale(0.97) translateY(12px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>

      {/* Game modal */}
      {gameModalSlide && (
        <GameModal slide={gameModalSlide} onClose={() => setGameModalSlide(null)} />
      )}

      {/* Main slide area */}
      <div style={{ flex: 1, position: 'relative', background: slide?.theme ? THEMES[slide.theme]?.bg || '#0d0d2b' : '#0d0d2b', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <SlideDisplay
          key={`${presentacionId}-${current}-${animKey}`}
          slide={slide}
          isActive
          onPlay={() => {
            if (slide?.layout === 'game' && slide?.resourceId) setGameModalSlide(slide);
            else setVideoPlaying(v => !v); // toggle pause on video play/pause/end
          }}
        />

        {/* Slide counter */}
        <div style={{ position: 'absolute', top: 12, left: 14, background: 'rgba(0,0,0,0.35)', color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12, letterSpacing: 1, textTransform: 'uppercase' }}>
          {pres?.titulo || 'Presentación'} · {current + 1}/{slides.length}
        </div>

        {/* Close */}
        {onClose && (
          <button onClick={onClose} style={{ position: 'absolute', top: 10, right: 12, background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.75)', border: 'none', borderRadius: 20, padding: '5px 13px', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>✕ Cerrar</button>
        )}

        {/* Nav arrows */}
        <button onClick={prev} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.35)', color: 'rgba(255,255,255,0.7)', border: 'none', borderRadius: '50%', width: 38, height: 38, cursor: 'pointer', fontSize: 18 }}>‹</button>
        <button onClick={next} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.35)', color: 'rgba(255,255,255,0.7)', border: 'none', borderRadius: '50%', width: 38, height: 38, cursor: 'pointer', fontSize: 18 }}>›</button>
      </div>

      {/* Bottom bar */}
      <div style={{ background: 'rgba(0,0,0,0.85)', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        {/* Progress bar */}
        <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg, ${t.accent}, #a855f7)`, transition: 'width 0.4s ease', borderRadius: 2 }} />
        </div>
        {/* Dots */}
        <div style={{ display: 'flex', gap: 5 }}>
          {slides.map((_, i) => (
            <div key={i} onClick={() => goTo(i)} style={{ width: 7, height: 7, borderRadius: '50%', background: i === current ? '#fff' : 'rgba(255,255,255,0.25)', cursor: 'pointer', transform: i === current ? 'scale(1.4)' : 'scale(1)', transition: 'all 0.3s' }} />
          ))}
        </div>
        <button onClick={next} style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', border: 'none', borderRadius: 20, padding: '4px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 700, flexShrink: 0 }}>siguiente ›</button>
      </div>
    </div>
  );
}
