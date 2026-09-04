// src/hooks/usePresenceRoom.js
//
// Hook reutilizable de presencia en una sala de "Control de Aula".
// Encapsula:
//   - Detección estricta de visibilidad/foco de la pestaña (visibilitychange + blur/focus).
//   - Sincronización en tiempo real del estado del alumno en Firestore.
//   - Heartbeat (lastSeen) para que el profesor pueda detectar desconexiones reales,
//     ya que el proyecto usa Firestore (no Realtime Database, por lo que no hay onDisconnect).
//   - Limpieza completa de listeners y suscripciones al desmontar.
//
// Puede incrustarse en cualquier juego pasándole { roomCode, studentId, name }.
// Devuelve { estado, focusLostCount, room, connected }.

import { useEffect, useRef, useState, useCallback } from 'react';
import { db } from '../firebase';
import {
    doc,
    setDoc,
    updateDoc,
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

const HEARTBEAT_MS = 5000;

/**
 * @param {Object}  opts
 * @param {string}  opts.roomCode   Código de la sala (obligatorio para activarse).
 * @param {string}  opts.studentId  Identificador persistente del alumno.
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

    // Escribe el estado del alumno (merge). incFocusLost incrementa el contador de incidencias.
    const pushEstado = useCallback(async (nuevoEstado, { incFocusLost = false } = {}) => {
        const ref = studentDocRef();
        if (!ref) return;
        const payload = {
            name: name || 'Alumno',
            estado: nuevoEstado,
            lastSeen: serverTimestamp(),
            lastSeenMs: Date.now(),
        };
        if (incFocusLost) payload.focusLostCount = increment(1);
        try {
            await setDoc(ref, payload, { merge: true });
        } catch (e) {
            // Silencioso: puede fallar si la sala se cerró.
        }
    }, [studentDocRef, name]);

    // --- Alta inicial del alumno en la sala + suscripción a la sala ---
    useEffect(() => {
        if (!active) return;
        let cancelado = false;

        (async () => {
            const ref = studentDocRef();
            if (!ref) return;
            try {
                await setDoc(ref, {
                    name: name || 'Alumno',
                    estado: document.hidden ? ESTADO.DESENFOCADO : ESTADO.ACTIVO,
                    focusLostCount: 0,
                    joinedAt: serverTimestamp(),
                    lastSeen: serverTimestamp(),
                    lastSeenMs: Date.now(),
                }, { merge: true });
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
            const ae = document.activeElement;
            if (ae && ae.tagName === 'IFRAME') return; // foco en el juego incrustado
            irDesenfocado();
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

    // --- Heartbeat: mantiene lastSeen fresco para detectar desconexiones reales ---
    useEffect(() => {
        if (!active) return;
        const id = setInterval(() => {
            const ref = studentDocRef();
            if (!ref) return;
            updateDoc(ref, { lastSeen: serverTimestamp(), lastSeenMs: Date.now() }).catch(() => {});
        }, HEARTBEAT_MS);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, studentDocRef]);

    // --- Cierre de pestaña / navegación fuera: marcar desconectado ---
    useEffect(() => {
        if (!active) return;
        const marcarSalida = () => {
            const ref = studentDocRef();
            if (!ref) return;
            // updateDoc puede no completarse en unload; es un mejor-esfuerzo.
            // El heartbeat caducado en el panel del profesor es la garantía real.
            updateDoc(ref, { estado: ESTADO.DESCONECTADO, lastSeenMs: Date.now() }).catch(() => {});
        };
        window.addEventListener('pagehide', marcarSalida);
        window.addEventListener('beforeunload', marcarSalida);
        return () => {
            window.removeEventListener('pagehide', marcarSalida);
            window.removeEventListener('beforeunload', marcarSalida);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, studentDocRef]);

    return { estado, focusLostCount, room, connected };
}
