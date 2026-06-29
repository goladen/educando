import { useState, useEffect, useRef } from 'react';
import GameLauncher from './components/GameLauncher';
import { db } from './firebase';
import { guardarRegistroLocal } from './utils/registrosLocales';
import { collection, query, where, getDocs, doc, getDoc, addDoc } from 'firebase/firestore';

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
// PASO 4 — iframe de Unity via GameLauncher
// ─────────────────────────────────────────
function PantallaJuego({ codigo, isHost, recursoId, hoja, nombre, onTerminar }) {
    const params = new URLSearchParams({
        roomCode: codigo,
        isHost: isHost ? '1' : '0',
        nickname: nombre,
        recursoId,
        hoja,
    });
    const src = `/kartingedmulti/index.html?${params.toString()}`;

    return (
        <GameLauncher
            src={src}
            title="Karting Multi"
            onMessage={(data) => { if (data.type === 'KARTINGED_RESULT') onTerminar(data.data); }}
            onSalir={() => onTerminar(null)}
        />
    );
}

// ─────────────────────────────────────────
function ModalEnviarProfe({ datos, onClose }) {
    const [codigoProfe, setCodigoProfe] = useState('');
    const [nombre, setNombre]   = useState('');
    const [curso,  setCurso]    = useState('');
    const [enviando, setEnviando] = useState(false);
    const [enviado,  setEnviado]  = useState(false);
    const [error,    setError]    = useState('');

    const enviar = async () => {
        const code = codigoProfe.trim().toUpperCase();
        if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
        if (!code) { setError('Escribe el código del profesor.'); return; }
        setEnviando(true); setError('');
        try {
            const codigoDoc = await getDoc(doc(db, 'codigos_profesor', code));
            if (!codigoDoc.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'KARTINGED_MULTI', modalidad: 'Multijugador', fecha: new Date(),
                recursoId: datos.recursoId, recursoTitulo: datos.recursoTitulo,
                codigoProfesor: code,
                jugadores: [{ nombre: nombre.trim(), curso: curso.trim(), puntos: datos.puntos, posicion: datos.posicion }],
            });
            guardarRegistroLocal('KARTINGED_MULTI', {
                titulo: datos.recursoTitulo, aciertos: datos.puntos ?? 0,
                nombre: nombre.trim(), curso: curso.trim(), via: 'profesor',
            });
            setEnviado(true);
        } catch(e) { setError('Error: ' + e.message); }
        setEnviando(false);
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.75)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ background: '#1e272e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, width: '100%', maxWidth: 380, padding: '26px 28px', boxShadow: '0 30px 80px rgba(0,0,0,0.7)', color: 'white', fontFamily: "'Segoe UI', sans-serif" }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f1c40f' }}>📤 Enviar al profesor</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.2rem' }}>✕</button>
                </div>
                {enviado ? (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{ fontSize: '3rem', marginBottom: 10 }}>✅</div>
                        <div style={{ color: '#2ecc71', fontWeight: 700, fontSize: '1.1rem' }}>¡Informe enviado!</div>
                        <button onClick={onClose} style={{ marginTop: 16, padding: '9px 22px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', color: 'white', fontFamily: 'inherit' }}>Cerrar</button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {[['nombre', 'Nombre y apellido', nombre, setNombre, 'Tu nombre completo', false],
                          ['curso',  'Curso',             curso,  setCurso,  'Ej: 3º ESO A',       false],
                          ['codigo', 'Código del profesor', codigoProfe, v => setCodigoProfe(v.toUpperCase()), 'Ej: PROF01', true]
                        ].map(([key, label, val, setter, ph, mono]) => (
                            <div key={key}>
                                <label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 }}>{label}</label>
                                <input value={val} onChange={e => setter(e.target.value)} placeholder={ph} maxLength={key==='codigo'?10:undefined}
                                    style={{ padding: '9px 12px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', letterSpacing: mono ? 2 : 0, fontWeight: mono ? 700 : 400 }}/>
                            </div>
                        ))}
                        {error && <div style={{ color: '#e74c3c', fontSize: '0.8rem' }}>⚠ {error}</div>}
                        <div style={{ display: 'flex', gap: 9, marginTop: 4 }}>
                            <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', cursor: 'pointer', color: 'white', fontFamily: 'inherit' }}>Cancelar</button>
                            <button onClick={enviar} disabled={enviando} style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: enviando ? '#555' : 'linear-gradient(135deg,#3498db,#2980b9)', color: 'white', fontWeight: 700, cursor: enviando ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                                {enviando ? 'Enviando…' : '📤 Enviar'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

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
    const [mostrarEnvio, setMostrarEnvio] = useState(false);

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
                <button style={{ ...st.btn('linear-gradient(135deg,#27ae60,#2ecc71)'), maxWidth: 480 }} onClick={() => setMostrarEnvio(true)}>
                    📤 Enviar al profesor
                </button>
                <button style={{ ...st.btn('linear-gradient(135deg,#FF6B00,#CC4400)'), maxWidth: 480 }} onClick={alTerminar}>
                    Volver al inicio
                </button>
                {mostrarEnvio && (
                    <ModalEnviarProfe
                        datos={{ recursoId: recurso?.id, recursoTitulo: recurso?.titulo, puntos: resultado?.puntos, posicion: resultado?.posicion }}
                        onClose={() => setMostrarEnvio(false)}
                    />
                )}
            </div>
        );

    return null;
}
