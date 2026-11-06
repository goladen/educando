// Efectos compartidos de Fútbol Quizz (pizarra 2D) y del partido con mandos micro:bit:
// sonidos (acierto, fallo, gol, silbato) y la celebración final (confeti, balones cayendo y
// «We Are The Champions»).
import React, { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import correctSoundFile from '../assets/correct-choice-43861.mp3';
import wrongSoundFile from '../assets/negative_beeps-6008.mp3';
import goalSoundFile from '../assets/gol-cutmp3.mp3';
import whistleSoundFile from '../assets/piarbitro.mp3';

const CHAMPIONS_VIDEO_ID = '04854XqcfCY'; // We Are The Champions (empieza en seg. 37)
const CHAMPIONS_START = 37;

// --- Sonidos ---
const mkAudio = (src) => { let a; return { play() { return (a ??= new Audio(src)).play(); }, reset() { if (a) a.currentTime = 0; } }; };
const audioCorrect = mkAudio(correctSoundFile);
const audioWrong = mkAudio(wrongSoundFile);
const audioGoal = mkAudio(goalSoundFile);
const safePlay = (audioObj) => { audioObj.reset(); audioObj.play().catch(() => { }); };

export const sonidoAcierto = () => safePlay(audioCorrect);
export const sonidoFallo = () => safePlay(audioWrong);
export const sonidoGol = () => safePlay(audioGoal);
// Silbato del árbitro: una instancia nueva por pitido para poder solaparlos
export const pitido = () => { try { const a = new Audio(whistleSoundFile); a.play().catch(() => { }); } catch { /* sin audio */ } };
// Tres pitidos seguidos (inicio y final del partido)
export const pitidoTriple = () => { [0, 600, 1200].forEach(d => setTimeout(pitido, d)); };

/** Confeti de los dos lados durante unos segundos + balones cayendo (capa fija, sin scroll). */
export function FondoCampeones({ color = '#f1c40f', segundos = 6 }) {
    useEffect(() => {
        const fin = Date.now() + segundos * 1000;
        let raf;
        const lanzar = () => {
            confetti({ particleCount: 5, angle: 60, spread: 70, origin: { x: 0 }, colors: ['#f1c40f', color, '#ffffff'] });
            confetti({ particleCount: 5, angle: 120, spread: 70, origin: { x: 1 }, colors: ['#f1c40f', color, '#ffffff'] });
            if (Date.now() < fin) raf = requestAnimationFrame(lanzar);
        };
        lanzar();
        return () => cancelAnimationFrame(raf);
    }, [color, segundos]);
    return (
        <>
            <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 1 }}>
                {Array.from({ length: 14 }).map((_, i) => (
                    <div key={i} style={{ position: 'absolute', top: '-60px', left: `${(i * 7 + 3) % 100}%`, fontSize: `${1.4 + (i % 4) * 0.5}rem`, animation: `fqCaer ${4 + (i % 5)}s linear ${(i % 6) * 0.6}s infinite` }}>⚽</div>
                ))}
            </div>
            <style>{`
                @keyframes fqCaer { 0% { transform: translateY(0) rotate(0deg); } 100% { transform: translateY(110vh) rotate(360deg); } }
                @keyframes fqLatido { 0%,100% { transform: scale(1); } 50% { transform: scale(1.15); } }
            `}</style>
        </>
    );
}

/** Vídeo de «We Are The Champions» que arranca solo (API de YouTube). */
export function VideoCampeones({ id = 'fq-champ-yt' }) {
    const ytRef = useRef(null);
    useEffect(() => {
        let cancelled = false; let initId = null;
        const create = () => {
            if (cancelled || !document.getElementById(id) || !window.YT?.Player) return;
            ytRef.current = new window.YT.Player(id, {
                videoId: CHAMPIONS_VIDEO_ID, height: '180', width: '320',
                playerVars: { autoplay: 1, start: CHAMPIONS_START, rel: 0, modestbranding: 1, origin: window.location.origin },
                events: { onReady: (e) => { try { e.target.seekTo(CHAMPIONS_START); e.target.playVideo(); } catch { /* nada */ } } },
            });
        };
        if (window.YT && window.YT.Player) initId = setTimeout(create, 120);
        else {
            if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
                const tag = document.createElement('script'); tag.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(tag);
            }
            const prev = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => { prev && prev(); initId = setTimeout(create, 120); };
        }
        return () => { cancelled = true; if (initId) clearTimeout(initId); if (ytRef.current) { try { ytRef.current.destroy(); } catch { /* nada */ } } };
    }, [id]);
    return (
        <div style={{ width: '100%', maxWidth: 320, borderRadius: 14, overflow: 'hidden', boxShadow: '0 12px 30px rgba(0,0,0,0.6)', background: '#000', aspectRatio: '16/9' }}>
            <div id={id} style={{ width: '100%', height: '100%' }} />
        </div>
    );
}
