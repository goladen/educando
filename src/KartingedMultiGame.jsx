import { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

// ─────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────
function generarCodigo() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

const st = {
    page: { minHeight: '100vh', background: 'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 20px', color: 'white', fontFamily: "'Segoe UI',sans-serif" },
    title: { fontSize: '2.2rem', fontWeight: 900, margin: '0 0 6px', background: 'linear-gradient(90deg,#FF6B00,#FFD700)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
    subtitle: { color: '#aaa', marginBottom: 28 },
    box: { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 18, padding: '24px 28px', width: '100%', maxWidth: 480, marginBottom: 20 },
    input: { width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '1rem', boxSizing: 'border-box', marginBottom: 12 },
    btn: (bg) => ({ padding: '13px 0', width: '100%', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '1rem', color: 'white', background: bg, marginBottom: 10 }),
    card: (sel) => ({ background: sel ? 'rgba(255,107,0,0.25)' : 'rgba(255,255,255,0.07)', border: `2px solid ${sel ? '#FF6B00' : 'rgba(255,255,255,0.12)'}`, borderRadius: 14, padding: '14px 16px', cursor: 'pointer', marginBottom: 10 }),
    sheetBtn: (i) => ({ padding: '11px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', color: 'white', background: ['linear-gradient(135deg,#FF6B00,#CC4400)', 'linear-gradient(135deg,#2196F3,#1565C0)', 'linear-gradient(135deg,#9C27B0,#6A1B9A)', 'linear-gradient(135deg,#4CAF50,#2E7D32)', 'linear-gradient(135deg,#FF9800,#E65100)', 'linear-gradient(135deg,#E91E63,#AD1457)'][i % 6], marginRight: 8, marginBottom: 8 }),
    code: { fontSize: '2.5rem', fontWeight: 900, letterSpacing: 8, color: '#FFD700', textAlign: 'center', margin: '12px 0' },
    label: { fontSize: '0.85rem', color: '#aaa', marginBottom: 6 },
};

// ─────────────────────────────────────────
// PASO 1 — Nombre + Crear o Unirse
// ─────────────────────────────────────────
function PantallaLobby({ onCrear, onUnirse }) {
    const [nombre, setNombre] = useState('');
    const [codigo, setCodigo] = useState('');
    const [modo, setModo] = useState(null); // 'crear' | 'unirse'

    return (
        <div style={st.page}>
            <div style={{ fontSize: '3rem', marginBottom: 8 }}>🏎️</div>
            <h1 style={st.title}>Karting Multijugador</h1>
            <p style={st.subtitle}>Compite contra otros jugadores en tiempo real</p>

            <div style={st.box}>
                <p style={st.label}>Tu nombre en la carrera</p>
                <input
                    style={st.input}
                    placeholder="Escribe tu nombre..."
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    maxLength={20}
                />

                {!modo && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: 8 }}>
                        <button style={st.btn('linear-gradient(135deg,#FF6B00,#CC4400)')} onClick={() => setModo('crear')} disabled={!nombre.trim()}>
                            🏁 Crear sala
                        </button>
                        <button style={st.btn('linear-gradient(135deg,#2196F3,#1565C0)')} onClick={() => setModo('unirse')} disabled={!nombre.trim()}>
                            🔑 Unirse a sala
                        </button>
                    </div>
                )}

                {modo === 'unirse' && (
                    <>
                        <p style={st.label}>Código de sala</p>
                        <input
                            style={{ ...st.input, textTransform: 'uppercase', letterSpacing: 4, fontSize: '1.3rem', textAlign: 'center' }}
                            placeholder="XXXXXX"
                            value={codigo}
                            onChange={e => setCodigo(e.target.value.toUpperCase().slice(0, 6))}
                        />
                        <button style={st.btn('linear-gradient(135deg,#2196F3,#1565C0)')} onClick={() => onUnirse(nombre.trim(), codigo)} disabled={codigo.length !== 6}>
                            Unirse
                        </button>
                        <button style={{ ...st.btn('rgba(255,255,255,0.1)'), marginBottom: 0 }} onClick={() => setModo(null)}>
                            Volver
                        </button>
                    </>
                )}

                {modo === 'crear' && (
                    <button style={st.btn('linear-gradient(135deg,#FF6B00,#CC4400)')} onClick={() => onCrear(nombre.trim())}>
                        Continuar — elegir recurso
                    </button>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────
// PASO 2 (solo host) — Selector de recurso y hoja
// ─────────────────────────────────────────
function PantallaRecursos({ onListo }) {
    const [recursos, setRecursos] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [recursoSel, setRecursoSel] = useState(null);
    const [hojas, setHojas] = useState([]);

    useEffect(() => {
        const fetch = async () => {
            try {
                const [snapB, snapK] = await Promise.all([
                    getDocs(query(collection(db, 'resources'), where('tipoJuego', '==', 'CAZABURBUJAS'), where('isPrivate', '==', false))),
                    getDocs(query(collection(db, 'resources'), where('tipoJuego', '==', 'KARTINGED'), where('isPrivate', '==', false))),
                ]);
                setRecursos([
                    ...snapB.docs.map(d => ({ id: d.id, ...d.data() })),
                    ...snapK.docs.map(d => ({ id: d.id, ...d.data() })),
                ]);
            } catch (e) { console.error(e); }
            setCargando(false);
        };
        fetch();
    }, []);

    const seleccionar = (r) => {
        setRecursoSel(r);
        setHojas(r.hojas?.map(h => h.nombreHoja).filter(Boolean) || []);
    };

    return (
        <div style={st.page}>
            <h1 style={st.title}>Elige el recurso</h1>
            <p style={st.subtitle}>Todos los jugadores usarán este recurso</p>

            {cargando ? <p style={{ color: '#aaa' }}>Cargando...</p> : (
                <div style={{ width: '100%', maxWidth: 640 }}>
                    {recursos.map(r => (
                        <div key={r.id} style={st.card(recursoSel?.id === r.id)} onClick={() => seleccionar(r)}>
                            <div style={{ fontWeight: 700 }}>🚗 {r.titulo}</div>
                            <div style={{ color: '#aaa', fontSize: '0.8rem' }}>{r.hojas?.length || 1} hoja(s)</div>
                        </div>
                    ))}
                    {recursos.length === 0 && <p style={{ color: '#aaa' }}>No hay recursos disponibles.</p>}

                    {recursoSel && (
                        <div style={{ marginTop: 20 }}>
                            <p style={{ color: '#FFD700', fontWeight: 700, marginBottom: 12 }}>¿Con qué preguntas?</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                                {hojas.length > 1 && (
                                    <button style={{ ...st.sheetBtn(5), background: 'linear-gradient(135deg,#FFD700,#FFA000)', color: '#1a1a2e' }} onClick={() => onListo(recursoSel, 'General')}>
                                        🔀 Mezclar todas
                                    </button>
                                )}
                                {hojas.map((h, i) => (
                                    <button key={h} style={st.sheetBtn(i)} onClick={() => onListo(recursoSel, h)}>{h}</button>
                                ))}
                                {hojas.length === 0 && (
                                    <button style={st.sheetBtn(0)} onClick={() => onListo(recursoSel, 'General')}>🏁 Jugar</button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────
// PASO 3 — Sala de espera: muestra código, jugadores y botón Start (host)
// ─────────────────────────────────────────
function PantallaEspera({ codigo, isHost, recurso, hoja, nombre, onIniciar, onSalir }) {
    return (
        <div style={st.page}>
            <h1 style={st.title}>Sala de espera</h1>
            <p style={st.subtitle}>{isHost ? 'Comparte el código con tus compañeros' : 'Esperando a que el host empiece...'}</p>

            <div style={st.box}>
                <p style={{ ...st.label, textAlign: 'center' }}>Código de sala</p>
                <div style={st.code}>{codigo}</div>
                {isHost && (
                    <p style={{ color: '#aaa', fontSize: '0.82rem', textAlign: 'center', marginTop: 0 }}>
                        Recurso: <b style={{ color: 'white' }}>{recurso.titulo}</b> — {hoja}
                    </p>
                )}
            </div>

            {isHost && (
                <button style={st.btn('linear-gradient(135deg,#4CAF50,#2E7D32)')} onClick={onIniciar}>
                    🏁 ¡Empezar carrera!
                </button>
            )}

            <button style={{ ...st.btn('rgba(255,255,255,0.1)'), maxWidth: 480 }} onClick={onSalir}>
                Salir
            </button>
        </div>
    );
}

// ─────────────────────────────────────────
// PASO 4 — iframe de Unity
// ─────────────────────────────────────────
function PantallaJuego({ codigo, isHost, recursoId, hoja, nombre, onTerminar }) {
    const iframeRef = useRef(null);
    const containerRef = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (e.data?.type === 'KARTINGED_RESULT') onTerminar(e.data.data);
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, [onTerminar]);

    // Solo fullscreen en escritorio — en móvil el CSS ya ocupa toda la pantalla
    useEffect(() => {
        const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
        if (!isMobile) {
            const el = containerRef.current;
            if (el?.requestFullscreen) el.requestFullscreen().catch(() => {});
            else if (el?.webkitRequestFullscreen) el.webkitRequestFullscreen();
        }
    }, []);

    const params = new URLSearchParams({
        roomCode: codigo,
        isHost: isHost ? '1' : '0',
        nickname: nombre,
        recursoId,
        hoja,
    });

    const src = `/kartingedmulti/index.html?${params.toString()}`;

    return (
        <div
            ref={containerRef}
            style={{ width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0, zIndex: 9999, background: '#000' }}
        >
            <iframe
                ref={iframeRef}
                src={src}
                style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                allow="pointer-lock; fullscreen"
                sandbox="allow-scripts allow-same-origin allow-pointer-lock"
                title="Karting Multi"
            />
        </div>
    );
}

// ─────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────
export default function KartingedMultiGame({ alTerminar }) {
    const [pantalla, setPantalla] = useState('lobby');   // lobby | recursos | espera | juego | fin
    const [isHost, setIsHost] = useState(false);
    const [nombre, setNombre] = useState('');
    const [codigo, setCodigo] = useState('');
    const [recurso, setRecurso] = useState(null);
    const [hoja, setHoja] = useState('General');
    const [resultado, setResultado] = useState(null);

    const handleCrear = (nom) => {
        setNombre(nom);
        setIsHost(true);
        setCodigo(generarCodigo());
        setPantalla('recursos');
    };

    const handleUnirse = (nom, cod) => {
        setNombre(nom);
        setIsHost(false);
        setCodigo(cod);
        setPantalla('juego'); // Cliente va directo a Unity, espera dentro del juego
    };

    const handleRecursoListo = (rec, h) => {
        setRecurso(rec);
        setHoja(h);
        setPantalla('juego'); // Host va directo a Unity, el Start está dentro de Unity
    };

    const handleTerminar = (data) => {
        setResultado(data);
        setPantalla('fin');
    };

    if (pantalla === 'lobby')
        return <PantallaLobby onCrear={handleCrear} onUnirse={handleUnirse} />;

    if (pantalla === 'recursos')
        return <PantallaRecursos onListo={handleRecursoListo} />;


    if (pantalla === 'juego')
        return (
            <PantallaJuego
                codigo={codigo}
                isHost={isHost}
                recursoId={recurso?.id || ''}
                hoja={hoja}
                nombre={nombre}
                onTerminar={handleTerminar}
            />
        );

    if (pantalla === 'fin')
        return (
            <div style={st.page}>
                <div style={{ fontSize: '3rem', marginBottom: 8 }}>🏁</div>
                <h1 style={{ ...st.title, WebkitTextFillColor: '#FFD700' }}>¡Carrera terminada!</h1>
                {resultado && (
                    <div style={st.box}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                            <span>Tiempo</span><b>{resultado.tiempoFormateado}</b>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                            <span>Puntos</span><b>{resultado.puntos}</b>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
                            <span>Posición</span><b>{resultado.posicion}º</b>
                        </div>
                    </div>
                )}
                <button style={{ ...st.btn('linear-gradient(135deg,#FF6B00,#CC4400)'), maxWidth: 480 }} onClick={alTerminar}>
                    Volver al inicio
                </button>
            </div>
        );

    return null;
}
