import React, { useEffect, useRef, useState, useCallback } from 'react';
import { mensajeErrorGps, fmtGrados, distancia } from './geo';

/** Sigue la posición del GPS mientras `activo`. Devuelve { pos, error, recorrido }. */
export function useGps(activo) {
    const [pos, setPos] = useState(null);
    const [error, setError] = useState('');
    const [recorrido, setRecorrido] = useState(0);
    const ultimo = useRef(null);
    useEffect(() => {
        if (!activo) return;
        if (!navigator.geolocation) { setError('Este dispositivo no tiene GPS.'); return; }
        const id = navigator.geolocation.watchPosition(
            (p) => {
                const nuevo = { lat: p.coords.latitude, lng: p.coords.longitude, precision: Math.round(p.coords.accuracy || 50), t: Date.now() };
                setError('');
                setPos(nuevo);
                // Distancia recorrida: solo lecturas buenas y saltos mayores que el ruido
                if (nuevo.precision <= 25) {
                    if (ultimo.current) {
                        const d = distancia(ultimo.current, nuevo);
                        if (d > Math.max(4, nuevo.precision * 0.6) && d < 80) { setRecorrido(r => r + d); ultimo.current = nuevo; }
                    } else ultimo.current = nuevo;
                }
            },
            (e) => setError(mensajeErrorGps(e)),
            { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 },
        );
        return () => navigator.geolocation.clearWatch(id);
    }, [activo]);
    return { pos, error, recorrido };
}

/** Rumbo del móvil (0 = Norte) con DeviceOrientation. En iOS hay que pedir permiso con un toque. */
export function useBrujula() {
    const [rumbo, setRumbo] = useState(null);
    const [necesitaPermiso, setNecesitaPermiso] = useState(
        typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function');
    const suav = useRef(null);
    const activar = useCallback(() => {
        const handler = (e) => {
            let h = null;
            if (typeof e.webkitCompassHeading === 'number') h = e.webkitCompassHeading;
            else if (e.absolute && typeof e.alpha === 'number') h = 360 - e.alpha;
            if (h == null || isNaN(h)) return;
            // compensar la orientación de la pantalla
            const ang = (window.screen?.orientation?.angle ?? window.orientation ?? 0) || 0;
            h = (h + ang + 360) % 360;
            // suavizado circular
            if (suav.current == null) suav.current = h;
            else { let d = ((h - suav.current + 540) % 360) - 180; suav.current = (suav.current + d * 0.25 + 360) % 360; }
            setRumbo(suav.current);
        };
        const ev = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
        window.addEventListener(ev, handler, true);
        return () => window.removeEventListener(ev, handler, true);
    }, []);
    useEffect(() => { if (!necesitaPermiso) return activar(); }, [necesitaPermiso, activar]);
    const pedirPermiso = async () => {
        try { const r = await DeviceOrientationEvent.requestPermission(); if (r === 'granted') { setNecesitaPermiso(false); } } catch (_) {}
    };
    return { rumbo, necesitaPermiso, pedirPermiso };
}

/**
 * Brújula dibujada: la rosa gira para que la N apunte al norte real.
 * objetivo (grados) → marca magenta del rumbo que hay que seguir (modo rumbo).
 */
export function Brujula({ rumbo, objetivo = null, necesitaPermiso, pedirPermiso, tam = 210 }) {
    if (necesitaPermiso) return (
        <button onClick={pedirPermiso} style={{ padding: '12px 18px', borderRadius: 14, border: 'none', background: '#0f766e', color: 'white', fontWeight: 800, cursor: 'pointer' }}>
            🧭 Activar la brújula del móvil
        </button>
    );
    const sinSensor = rumbo == null;
    const giro = sinSensor ? 0 : -rumbo;
    const marcas = [];
    for (let g = 0; g < 360; g += 10) {
        const larga = g % 30 === 0;
        marcas.push(<line key={g} x1="100" y1={larga ? 14 : 18} x2="100" y2="24" stroke={larga ? '#0f172a' : '#94a3b8'} strokeWidth={larga ? 2 : 1} transform={`rotate(${g} 100 100)`} />);
        if (g % 30 === 0 && g % 90 !== 0) marcas.push(<text key={'t' + g} x="100" y="36" textAnchor="middle" fontSize="9" fill="#64748b" transform={`rotate(${g} 100 100)`}>{g}</text>);
    }
    let desvio = null;
    if (!sinSensor && objetivo != null) desvio = ((objetivo - rumbo + 540) % 360) - 180;
    const alineado = desvio != null && Math.abs(desvio) <= 8;
    return (
        <div style={{ textAlign: 'center' }}>
            <svg width={tam} height={tam} viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="96" fill="#f8fafc" stroke={alineado ? '#16a34a' : '#0f172a'} strokeWidth={alineado ? 6 : 3} />
                <g transform={`rotate(${giro} 100 100)`} style={{ transition: 'transform .15s linear' }}>
                    {marcas}
                    {[['N', 0, '#dc2626'], ['E', 90, '#0f172a'], ['S', 180, '#0f172a'], ['O', 270, '#0f172a']].map(([l, g, c]) => (
                        <text key={l} x="100" y="52" textAnchor="middle" fontSize="18" fontWeight="900" fill={c} transform={`rotate(${g} 100 100)`}>{l}</text>
                    ))}
                    {objetivo != null && (
                        <g transform={`rotate(${objetivo} 100 100)`}>
                            <polygon points="100,4 108,22 92,22" fill="#c026d3" />
                        </g>
                    )}
                </g>
                {/* Línea de dirección del móvil (siempre hacia arriba) */}
                <polygon points="100,62 110,100 100,94 90,100" fill={alineado ? '#16a34a' : '#0f172a'} />
                <circle cx="100" cy="100" r="5" fill="#0f172a" />
            </svg>
            <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem', marginTop: -4 }}>
                {sinSensor ? 'Brújula no disponible en este dispositivo' : `Miras a ${fmtGrados(rumbo)}`}
            </div>
            {desvio != null && (
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: alineado ? '#16a34a' : '#b45309' }}>
                    {alineado ? '✅ ¡Rumbo correcto, camina recto!' : desvio > 0 ? `Gira ${Math.round(desvio)}° a la derecha ↻` : `Gira ${Math.round(-desvio)}° a la izquierda ↺`}
                </div>
            )}
        </div>
    );
}

/** Rosa de los vientos estática (8 direcciones), para ayudar en el modo cardinal. */
export function RosaVientos({ tam = 120, resaltar }) {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
    return (
        <svg width={tam} height={tam} viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="56" fill="#fff" stroke="#cbd5e1" />
            {dirs.map((d, i) => {
                const g = i * 45, prin = i % 2 === 0;
                const on = resaltar && resaltar.includes(d);
                return (
                    <g key={d} transform={`rotate(${g} 60 60)`}>
                        <polygon points={prin ? '60,10 66,60 54,60' : '60,22 64,60 56,60'} fill={on ? '#c026d3' : prin ? '#334155' : '#94a3b8'} />
                        <text x="60" y={prin ? 9 : 20} textAnchor="middle" fontSize={prin ? 10 : 7} fontWeight="900" fill={on ? '#c026d3' : '#0f172a'}
                            transform={`rotate(${-g} 60 ${prin ? 6 : 17})`}>{d}</text>
                    </g>
                );
            })}
            <circle cx="60" cy="60" r="4" fill="#0f172a" />
        </svg>
    );
}
