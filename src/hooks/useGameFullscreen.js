import { useEffect } from 'react';

/**
 * Fuerza landscape + oculta la barra de navegación del móvil
 * mientras el componente está montado. Al desmontar restaura todo.
 */
export default function useGameFullscreen() {
    useEffect(() => {
        const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

        // Forzar landscape
        if (screen.orientation?.lock) {
            screen.orientation.lock('landscape').catch(() => {});
        }

        // Ocultar barra de navegación del navegador en móvil
        // Se consigue haciendo scroll a 0 y usando height: 100dvh
        if (isMobile) {
            document.documentElement.style.setProperty('--game-height', `${window.innerHeight}px`);
            window.scrollTo(0, 1); // fuerza al navegador a ocultar la barra

            // Reajustar si rota la pantalla
            const onResize = () => {
                document.documentElement.style.setProperty('--game-height', `${window.innerHeight}px`);
                window.scrollTo(0, 1);
            };
            window.addEventListener('resize', onResize);
            window.addEventListener('orientationchange', onResize);

            return () => {
                window.removeEventListener('resize', onResize);
                window.removeEventListener('orientationchange', onResize);
                screen.orientation?.unlock?.();
                document.documentElement.style.removeProperty('--game-height');
            };
        }

        return () => {
            screen.orientation?.unlock?.();
        };
    }, []);
}
