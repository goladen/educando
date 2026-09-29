import { useState, useEffect, useCallback } from 'react';
import { getAvatarLocal, guardarAvatarLocal, AVATAR_EVENTO, AVATAR_KEY } from '../utils/avatarLocal';

// Avatar guardado en este dispositivo. Se sincroniza entre componentes
// (evento propio) y entre pestañas (evento storage).
export default function useAvatarLocal() {
    const [avatar, setAvatarState] = useState(() => getAvatarLocal());

    useEffect(() => {
        const alCambiar = () => setAvatarState(getAvatarLocal());
        const alStorage = (e) => { if (e.key === AVATAR_KEY) alCambiar(); };
        window.addEventListener(AVATAR_EVENTO, alCambiar);
        window.addEventListener('storage', alStorage);
        return () => {
            window.removeEventListener(AVATAR_EVENTO, alCambiar);
            window.removeEventListener('storage', alStorage);
        };
    }, []);

    const setAvatar = useCallback((cfg) => setAvatarState(guardarAvatarLocal(cfg)), []);
    return [avatar, setAvatar];
}
