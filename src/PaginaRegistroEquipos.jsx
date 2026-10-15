// src/PaginaRegistroEquipos.jsx
//
// Página independiente del registro de uso de equipos de una comunidad, accesible por enlace
// (?equipos_registro=<comId>). Visible solo para MIEMBROS (lo imponen las reglas de Firestore).
// El gestor (creador) de la comunidad puede editar/borrar cualquier registro.

import React, { useEffect, useState } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { RegistroSesiones } from './SesionEquipos';

export default function PaginaRegistroEquipos({ comId, onExit }) {
    const [user, setUser] = useState(() => auth.currentUser);
    const [gestor, setGestor] = useState(false);

    useEffect(() => onAuthStateChanged(auth, setUser), []);
    useEffect(() => {
        if (!user || !comId) return;
        getDoc(doc(db, 'comunidades', comId))
            .then((s) => setGestor(s.exists() && s.data().creadorUid === user.uid))
            .catch(() => {});
    }, [user, comId]);

    const login = async () => { try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch { /* nada */ } };

    if (!user) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: '#0f172a', color: 'white', padding: 20, textAlign: 'center', fontFamily: "'Segoe UI', sans-serif" }}>
                <div style={{ fontSize: 44 }}>📚</div>
                <h2 style={{ margin: 0 }}>Registro de uso de equipos</h2>
                <p style={{ color: '#94a3b8', maxWidth: 380 }}>Inicia sesión para ver el registro. Solo los miembros de la comunidad pueden verlo.</p>
                <button onClick={login} style={{ background: '#4f46e5', color: 'white', border: 'none', borderRadius: 12, padding: '13px 26px', cursor: 'pointer', fontWeight: 800, fontSize: '1rem' }}>Iniciar sesión con Google</button>
                <button onClick={onExit} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>Volver</button>
            </div>
        );
    }

    return <RegistroSesiones scope="comunidad" codigoEquipos={comId} canGestionar={gestor} onClose={onExit} />;
}
