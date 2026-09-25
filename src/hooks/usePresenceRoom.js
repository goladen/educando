// src/hooks/usePresenceRoom.js
//
// Hook reutilizable de presencia en una sala de "Control de Aula".
// Encapsula:
//   - Detección estricta de visibilidad/foco de la pestaña (visibilitychange + blur/focus).
//   - Sincronización en tiempo real del estado del alumno en Firestore.
//   - Heartbeat (lastSeen) para que el profesor pueda detectar desconexiones reales,
//     ya que el proyecto usa Firestore (no Realtime Database, por lo que no hay onDisconnect).
//     El heartbeat reescribe también el estado → se "autocura" si quedó marcado como
//     desconectado (pagehide seguido de volver a la página, cortes de red…).
//   - Limpieza completa de listeners y suscripciones al desmontar.
//
// OJO: lastSeenMs es la hora del DISPOSITIVO del alumno; el panel del profesor NO debe compararla
// con su propio reloj (los relojes pueden ir desfasados). Úsala solo como marca que cambia en cada
// latido (ver ControlAula → vistoAt).
//
// Puede incrustarse en cualquier juego pasándole { roomCode, studentId, name }.
// Devuelve { estado, focusLostCount, room, connected }.

import { useEffect, useRef, useState, useCallback } from 'react';
import { db } from '../firebase';
import {
    doc,
    getDoc,
    setDoc,
    onSnapshot,
    serverTimestamp,
    increment,
} from 'firebase/firestore';

// Estados posibles de un alumno.
export const ESTADO = {
    ACTIVO: 'activo',        // pestaña visible y con foco
    DESENFOCADO: 'desenfocado', // ha salido de la pestaña / minimizado / cambió de ventana
    DESCONECTADO: 'desconectado',
};

export const HEARTBEAT_MS = 5000;

// Identificador persistente del dispositivo/navegador (distingue "el mismo alumno que vuelve"
// de "otro alumno con el mismo nombre en otro dispositivo").
export const getDeviceId = () => {
    try {
        let id = localStorage.getItem('control_aula_device');
        if (!id) {
            id = 'dev_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
            localStorage.setItem('control_aula_device', id);
        }
        return id;
    } catch {
        return 'dev_sin_almacenamiento';
    }
};

/**
 * @param {Object}  opts
 * @param {string}  opts.roomCode   Código de la sala (obligatorio para activarse).
 * @param {string}  opts.studentId  Identificador del alumno en la sala.
 * @param {string}  opts.name       Nombre visible del alumno.
 * @param {boolean} [opts.enabled]  Si es false, el hook no hace nada (por defecto true).
 */
export default function usePresenceRoom({ roomCode, studentId, name, enabled = true }) {
    const [room, setRoom] = useState(null);        // datos de la sala (currentRoute, etc.)
    const [estado, setEstado] = useState(ESTADO.ACTIVO);
    const [focusLostCount, setFocusLostCount] = useState(0);
    const [connected, setConnected] = useState(false);

    const estadoRef = useRef(estado);
    estadoRef.current = estado;

    const active = enabled && !!roomCode && !!studentId;

    // Referencia al documento del alumno.
    const studentDocRef = useCallback(() => {
        if (!active) return null;
        return doc(db, 'control_rooms', roomCode, 'students', studentId);
    }, [active, roomCode, studentId]);

    // Escribe el estado del alumno (merge; crea el doc si no existe). incFocusLost incrementa el contador.
    const pushEstado = useCallback(async (nuevoEstado, { incFocusLost = false } = {}) => {
        const ref = studentDocRef();
        if (!ref) return;
        const payload = {
            name: name || 'Alumno',
            deviceId: getDeviceId(),
            estado: nuevoEstado,
            lastSeen: serverTimestamp(),
            lastSeenMs: Date.now(),
        };
        if (incFocusLost) payload.focusLostCount = increment(1);
        try {
            await setDoc(ref, payload, { merge: true });
            setConnected(true);
        } catch (e) {
            // Puede fallar si la sala se cerró o no hay red; el siguiente latido reintenta.
        }
    }, [studentDocRef, name]);

    // Estado "vivo" actual (nunca DESCONECTADO mientras la página esté abierta).
    const estadoVivo = () => (document.hidden ? ESTADO.DESENFOCADO : (estadoRef.current === ESTADO.DESCONECTADO ? ESTADO.ACTIVO : estadoRef.current));

    // --- Alta (o reconexión) del alumno en la sala + suscripción a la sala ---
    useEffect(() => {
        if (!active) return;
        let cancelado = false;

        (async () => {
            const ref = studentDocRef();
            if (!ref) return;
            const inicial = document.hidden ? ESTADO.DESENFOCADO : ESTADO.ACTIVO;
            setEstado(inicial);
            const payload = {
                name: name || 'Alumno',
                deviceId: getDeviceId(),
                estado: inicial,
                lastSeen: serverTimestamp(),
                lastSeenMs: Date.now(),
            };
            // Reconexión: se conserva el documento (contador de salidas, puntuaciones, escritura…).
            try {
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    if (!cancelado) setFocusLostCount(snap.data().focusLostCount || 0);
                } else {
                    payload.joinedAt = serverTimestamp();
                    payload.focusLostCount = 0;
                }
            } catch { /* sin red: se escribe igualmente con merge */ }
            try {
                await setDoc(ref, payload, { merge: true });
                if (!cancelado) setConnected(true);
            } catch (e) {
                if (!cancelado) setConnected(false);
            }
        })();

        const unsubRoom = onSnapshot(
            doc(db, 'control_rooms', roomCode),
            (snap) => {
                if (cancelado) return;
                if (snap.exists()) setRoom({ id: snap.id, ...snap.data() });
                else setRoom(null);
            },
            () => { /* error de red: ignorar, el heartbeat reintentará */ }
        );

        return () => {
            cancelado = true;
            unsubRoom();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, roomCode, studentId]);

    // --- Detección de visibilidad y foco ---
    useEffect(() => {
        if (!active) return;

        const irActivo = () => {
            if (estadoRef.current !== ESTADO.ACTIVO) {
                setEstado(ESTADO.ACTIVO);
                pushEstado(ESTADO.ACTIVO);
            }
        };

        const irDesenfocado = () => {
            if (estadoRef.current !== ESTADO.DESENFOCADO) {
                setEstado(ESTADO.DESENFOCADO);
                setFocusLostCount((c) => c + 1);
                pushEstado(ESTADO.DESENFOCADO, { incFocusLost: true });
            }
        };

        // visibilitychange es la señal ESTRICTA de "ha salido de la pestaña o minimizado".
        const onVisibility = () => {
            if (document.hidden) irDesenfocado();
            else irActivo();
        };

        // blur: solo cuenta como desenfoque si el foco NO ha ido a nuestro propio <iframe>
        // (dentro del iframe el alumno sigue en la pestaña de clase → sigue activo).
        const onBlur = () => {
            if (document.hidden) return; // ya lo gestiona visibilitychange
            // El foco pasa al iframe un instante después del blur → comprobarlo en el siguiente tick.
            setTimeout(() => {
                if (document.hidden) return;
                const ae = document.activeElement;
                if (ae && ae.tagName === 'IFRAME') return; // foco en el juego incrustado
                if (document.hasFocus()) return;
                irDesenfocado();
            }, 0);
        };

        const onFocus = () => {
            if (!document.hidden) irActivo();
        };

        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('blur', onBlur);
        window.addEventListener('focus', onFocus);

        return () => {
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('blur', onBlur);
            window.removeEventListener('focus', onFocus);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, pushEstado]);

    // --- Heartbeat: mantiene lastSeen fresco y reescribe el estado (autocuración) ---
    useEffect(() => {
        if (!active) return;
        const latido = () => {
            const e = estadoVivo();
            if (e !== estadoRef.current) setEstado(e);
            pushEstado(e);
        };
        const id = setInterval(latido, HEARTBEAT_MS);
        // Al recuperar la red o volver a la página (bfcache en móviles) → latido inmediato.
        const onOnline = () => latido();
        const onOffline = () => setConnected(false);
        const onPageShow = () => latido();
        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);
        window.addEventListener('pageshow', onPageShow);
        return () => {
            clearInterval(id);
            window.removeEventListener('online', onOnline);
            window.removeEventListener('offline', onOffline);
            window.removeEventListener('pageshow', onPageShow);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, pushEstado]);

    // --- Cierre de pestaña / navegación fuera: marcar desconectado ---
    useEffect(() => {
        if (!active) return;
        const marcarSalida = () => {
            const ref = studentDocRef();
            if (!ref) return;
            // Mejor esfuerzo (puede no completarse en unload). Si la página vuelve (bfcache),
            // pageshow + el heartbeat reescriben el estado real.
            setDoc(ref, { estado: ESTADO.DESCONECTADO, lastSeenMs: Date.now() }, { merge: true }).catch(() => {});
        };
        window.addEventListener('pagehide', marcarSalida);
        return () => window.removeEventListener('pagehide', marcarSalida);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, studentDocRef]);

    return { estado, focusLostCount, room, connected };
}
