/**
 * Solicita fullscreen + landscape sobre un elemento.
 * Debe llamarse DENTRO de un handler de evento del usuario (click/tap).
 */
export async function requestGameFullscreen(element) {
    try {
        const el = element || document.documentElement;
        if (el.requestFullscreen)            await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
        if (screen.orientation?.lock)
            await screen.orientation.lock('landscape').catch(() => {});
    } catch (e) {
        console.warn('Fullscreen:', e);
    }
}

export function exitGameFullscreen() {
    if (document.exitFullscreen)            document.exitFullscreen().catch(() => {});
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    screen.orientation?.unlock?.();
}
