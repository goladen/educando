import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Muestra el total de visitantes ÚNICOS. El conteo (increment por dispositivo)
// lo hace App.jsx para cubrir también a los usuarios logueados. Doc: stats/visitantes { count }.
export default function ContadorVisitantes({ style = {} }) {
    const [total, setTotal] = useState(null);

    useEffect(() => {
        let cancelado = false;
        (async () => {
            try {
                const snap = await getDoc(doc(db, 'stats', 'visitantes'));
                if (!cancelado && snap.exists()) setTotal(snap.data().count || 0);
            } catch (e) {
                // Silencioso: si las reglas no permiten leer, no rompemos la landing
                console.warn('Contador visitantes:', e);
            }
        })();
        return () => { cancelado = true; };
    }, []);

    if (total === null) return null; // aún cargando o sin permisos: no mostramos nada

    return (
        <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            color: 'rgba(255,255,255,0.85)', fontSize: '0.85rem', fontWeight: 600,
            background: 'rgba(255,255,255,0.12)', padding: '4px 12px', borderRadius: 20,
            backdropFilter: 'blur(6px)',
            ...style,
        }}>
            👥 {total.toLocaleString('es-ES')} visitantes
        </div>
    );
}
