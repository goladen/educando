// Música de YouTube para «Baila, para y habla»: PiKT reproduce y PARA el vídeo en los momentos al azar.
import { useEffect, useRef, useState } from 'react';

/** Saca { video, lista } de un enlace (watch?v=, youtu.be/, shorts/, embed/, live/, music.youtube…) o de un id suelto. */
export function parsearYouTube(texto) {
    const t = String(texto || '').trim();
    if (!t) return null;
    if (/^[\w-]{11}$/.test(t)) return { video: t, lista: null };
    try {
        const u = new URL(t.startsWith('http') ? t : `https://${t}`);
        if (!/(^|\.)youtube\.com$|(^|\.)youtu\.be$|youtube-nocookie\.com$/.test(u.hostname)) return null;
        const lista = u.searchParams.get('list');
        let video = u.searchParams.get('v');
        if (!video && u.hostname.endsWith('youtu.be')) video = u.pathname.slice(1).split('/')[0];
        if (!video) { const m = u.pathname.match(/\/(shorts|embed|live|v)\/([\w-]{11})/); if (m) video = m[2]; }
        if (video && !/^[\w-]{11}$/.test(video)) video = null;
        return video || lista ? { video, lista } : null;
    } catch { return null; }
}

let promesaAPI = null;
function cargarAPI() {
    if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
    if (promesaAPI) return promesaAPI;
    promesaAPI = new Promise((resolve) => {
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => { try { prev?.(); } catch { /* */ } resolve(window.YT); };
        if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
            const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.async = true;
            document.head.appendChild(s);
        } else {
            const id = setInterval(() => { if (window.YT && window.YT.Player) { clearInterval(id); resolve(window.YT); } }, 200);
        }
    });
    return promesaAPI;
}

/** Reproductor controlado: { listo, error, play(), pause() }. El div con id `contenedorId` debe existir. */
export function useReproductorYouTube(fuente, contenedorId) {
    const player = useRef(null);
    const [listo, setListo] = useState(false);
    const [error, setError] = useState('');
    const clave = fuente ? `${fuente.video || ''}|${fuente.lista || ''}` : '';

    useEffect(() => {
        if (!fuente) return undefined;
        let cancelado = false; // StrictMode monta dos veces: que no queden dos reproductores
        setListo(false); setError('');
        cargarAPI().then((YT) => {
            const caja = document.getElementById(contenedorId);
            if (cancelado || !caja) return;
            // YouTube SUSTITUYE el elemento por su iframe: se le da un hijo propio, no el div de React
            const hueco = document.createElement('div');
            caja.innerHTML = ''; caja.appendChild(hueco);
            const vars = { autoplay: 0, controls: 1, rel: 0, playsinline: 1, modestbranding: 1, loop: 1 };
            if (fuente.lista) { vars.listType = 'playlist'; vars.list = fuente.lista; }
            else if (fuente.video) vars.playlist = fuente.video; // necesario para que loop funcione con un solo vídeo
            player.current = new YT.Player(hueco, {
                width: '100%', height: '100%', videoId: fuente.video || undefined, playerVars: vars,
                events: {
                    onReady: () => { if (!cancelado) setListo(true); },
                    onError: (e) => { if (!cancelado) setError(e?.data === 101 || e?.data === 150 ? 'El autor de este vídeo no deja reproducirlo fuera de YouTube. Prueba con otro.' : 'No se puede reproducir este vídeo.'); },
                },
            });
        });
        return () => {
            cancelado = true;
            try { player.current?.destroy(); } catch { /* */ }
            player.current = null;
            const caja = document.getElementById(contenedorId);
            if (caja) caja.innerHTML = '';
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clave, contenedorId]);

    return {
        listo, error,
        play() { try { player.current?.playVideo(); } catch { /* */ } },
        pause() { try { player.current?.pauseVideo(); } catch { /* */ } },
    };
}
