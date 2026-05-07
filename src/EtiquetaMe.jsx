import React, { useState } from 'react';
import { db } from './firebase';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc, addDoc } from 'firebase/firestore';
import {
    Search, Key, ChevronDown, ChevronUp, Filter,
    CheckCircle, XCircle, RotateCcw, ArrowLeft, Play,
    Image as ImageIcon, Trophy, Shuffle
} from 'lucide-react';
import Confetti from 'react-confetti';

// ─────────────────────────────────────────────
// HELPERS (mismos que LandingGames3)
// ─────────────────────────────────────────────
const cleanText = (str) => {
    if (!str) return '';
    return String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
};

const levenshteinDistance = (s, t) => {
    if (!s.length) return t.length;
    if (!t.length) return s.length;
    const arr = [];
    for (let i = 0; i <= t.length; i++) {
        arr[i] = [i];
        for (let j = 1; j <= s.length; j++) {
            arr[i][j] = i === 0 ? j : Math.min(
                arr[i - 1][j] + 1,
                arr[i][j - 1] + 1,
                arr[i - 1][j - 1] + (s[j - 1] === t[i - 1] ? 0 : 1)
            );
        }
    }
    return arr[t.length][s.length];
};

const checkFuzzyMatch = (text, search) => {
    const t = cleanText(text);
    const s = cleanText(search);
    if (!t || !s) return false;
    if (t.includes(s) || s.includes(t)) return true;
    const distance = levenshteinDistance(t, s);
    return 1 - distance / Math.max(t.length, s.length) >= 0.8;
};

// ─────────────────────────────────────────────
// PANTALLA PRESENTACIÓN
// ─────────────────────────────────────────────
function PantallaPresentacionEtiqueta({ presentacion, onEmpezar, onExit }) {
    const toEmbed = (url) => {
        if (!url) return '';
        let m = url.match(/youtube\.com\/watch\?(?:.*&)?v=([^&]+)/);
        if (m) return `https://www.youtube.com/embed/${m[1]}`;
        m = url.match(/youtu\.be\/([^?&]+)/);
        if (m) return `https://www.youtube.com/embed/${m[1]}`;
        m = url.match(/vimeo\.com\/(\d+)/);
        if (m) return `https://player.vimeo.com/video/${m[1]}`;
        return url;
    };
    const video = presentacion.video && toEmbed(presentacion.video);
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(160deg,#0d2137 0%,#16a085 55%,#1abc9c 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 9998, padding: '24px 20px', overflowY: 'auto', fontFamily: 'Arial,sans-serif', boxSizing: 'border-box' }}>
            {onExit && <button onClick={onExit} style={{ position: 'fixed', top: 10, left: 10, background: 'white', border: '2px solid #333', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 9999, fontSize: 18, boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>←</button>}
            <div style={{ width: '100%', maxWidth: 580, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
                <h1 style={{ color: 'white', margin: 0, fontSize: 'clamp(1.6rem,5vw,2.8rem)', textAlign: 'center', fontWeight: 900, lineHeight: 1.2, textShadow: '0 0 40px rgba(255,255,255,0.22)' }}>{presentacion.titulo}</h1>
                {video ? (
                    <div style={{ width: '100%', borderRadius: 18, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.65)', position: 'relative', paddingBottom: '56.25%', background: '#000' }}>
                        <iframe src={video} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title={presentacion.titulo} />
                    </div>
                ) : presentacion.imagen ? (
                    <div style={{ width: '100%', borderRadius: 18, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.65)' }}>
                        <img src={presentacion.imagen} alt={presentacion.titulo} style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '42vh', objectFit: 'cover' }} />
                    </div>
                ) : null}
                {presentacion.descripcion && <p style={{ color: 'rgba(255,255,255,0.88)', margin: 0, fontSize: 'clamp(0.95rem,2.5vw,1.1rem)', textAlign: 'center', lineHeight: 1.7 }}>{presentacion.descripcion}</p>}
                <button onClick={onEmpezar} style={{ background: 'linear-gradient(135deg,#16a085 0%,#1abc9c 100%)', color: 'white', border: 'none', borderRadius: 50, padding: '16px 52px', fontSize: '1.1rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 30px rgba(22,160,133,0.55)', display: 'flex', alignItems: 'center', gap: 10 }}>▶ ¡Empezar!</button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────
export default function EtiquetaMe({ onExit, recurso: recursoInicial = null }) {
    // Si llega recurso desde LandingGames, saltamos la busqueda
    const [pantalla, setPantalla]           = useState(() => {
        if (!recursoInicial) return 'BUSQUEDA';
        if (recursoInicial.presentacion?.titulo) return 'PRESENTACION';
        return (recursoInicial.hojas?.length || 0) <= 1 ? 'JUGANDO' : 'ELECCION';
    });
    const [recursoActivo, setRecursoActivo] = useState(recursoInicial);
    const [hojaActiva, setHojaActiva]       = useState(() => {
        if (!recursoInicial) return null;
        if ((recursoInicial.hojas?.length || 0) === 1) return recursoInicial.hojas[0];
        return null;
    });

    const volverBusqueda = () => { setPantalla('BUSQUEDA'); setRecursoActivo(null); setHojaActiva(null); };
    const volverEleccion = () => { setPantalla('ELECCION'); setHojaActiva(null); };

    const elegirRecurso = (r) => {
        setRecursoActivo(r);
        if (r.presentacion?.titulo) {
            setPantalla('PRESENTACION');
            return;
        }
        // Si solo hay una hoja, saltamos directo al juego
        if ((r.hojas?.length || 0) <= 1) {
            setHojaActiva(r.hojas?.[0] || null);
            setPantalla('JUGANDO');
        } else {
            setPantalla('ELECCION');
        }
    };

    const empezarTrasPresentation = () => {
        const r = recursoActivo;
        if ((r.hojas?.length || 0) <= 1) {
            setHojaActiva(r.hojas?.[0] || null);
            setPantalla('JUGANDO');
        } else {
            setPantalla('ELECCION');
        }
    };

    const elegirHoja = (hoja) => {
        // hoja === null → General (aleatoria)
        const hojaFinal = hoja ?? recursoActivo.hojas[Math.floor(Math.random() * recursoActivo.hojas.length)];
        setHojaActiva(hojaFinal);
        setPantalla('JUGANDO');
    };

    if (pantalla === 'PRESENTACION' && recursoActivo?.presentacion?.titulo) {
        return (
            <PantallaPresentacionEtiqueta
                presentacion={recursoActivo.presentacion}
                onEmpezar={empezarTrasPresentation}
                onExit={onExit}
            />
        );
    }

    if (pantalla === 'ELECCION') {
        return (
            <PantallaEleccion
                recurso={recursoActivo}
                onElegir={elegirHoja}
                onVolver={volverBusqueda}
            />
        );
    }

    if (pantalla === 'JUGANDO' && hojaActiva) {
        return (
            <PantallaJuego
                recurso={recursoActivo}
                hoja={hojaActiva}
                onJugarDeNuevo={() => elegirHoja(hojaActiva)}
                onCambiarDiagrama={volverEleccion}
                onSalir={onExit}
            />
        );
    }

    return <PantallaBusqueda onElegir={elegirRecurso} onExit={onExit} />;
}

// ─────────────────────────────────────────────
// PANTALLA 1 — BUSCADOR
// ─────────────────────────────────────────────
function PantallaBusqueda({ onElegir, onExit }) {
    const [modoBusqueda, setModoBusqueda]       = useState('FILTROS');
    const [codigo, setCodigo]                   = useState('');
    const [filtros, setFiltros]                 = useState({ tema: '', ciclo: '', pais: '', region: '', poblacion: '', autor: '' });
    const [mostrarMas, setMostrarMas]           = useState(false);
    const [buscando, setBuscando]               = useState(false);
    const [resultados, setResultados]           = useState([]);

    const buscar = async () => {
        setBuscando(true);
        const ref = collection(db, 'resources');
        try {
            if (modoBusqueda === 'CODIGO') {
                const limpio = codigo.toUpperCase().trim();
                if (!limpio) { alert('Introduce un código.'); setBuscando(false); return; }
                const snap = await getDocs(query(ref, where('accessCode', '==', limpio)));
                if (!snap.empty) {
                    const r = { ...snap.docs[0].data(), id: snap.docs[0].id };
                    if (r.tipoJuego !== 'ETIQUETAS') { alert('Ese código no es un recurso de Etiquetas.'); setBuscando(false); return; }
                    setResultados([r]);
                } else {
                    alert('Código no encontrado.');
                }
            } else {
                const snap = await getDocs(query(ref, orderBy('fechaCreacion', 'desc'), limit(200)));
                const raw  = snap.docs.map(d => ({ ...d.data(), id: d.id }));
                const filtrados = raw.filter(r => {
                    if (r.tipoJuego !== 'ETIQUETAS') return false;
                    if (r.isFinished !== true) return false;
                    if (filtros.tema && !checkFuzzyMatch(r.titulo, filtros.tema) && !checkFuzzyMatch(r.temas, filtros.tema) &&
                        !(r.hojas?.some(h => checkFuzzyMatch(h.nombreHoja, filtros.tema)))) return false;
                    if (filtros.ciclo && cleanText(r.ciclo) !== cleanText(filtros.ciclo)) return false;
                    if (filtros.pais && !cleanText(r.pais).includes(cleanText(filtros.pais))) return false;
                    if (filtros.region && !cleanText(r.region).includes(cleanText(filtros.region))) return false;
                    if (filtros.poblacion && !cleanText(r.poblacion).includes(cleanText(filtros.poblacion))) return false;
                    if (filtros.autor && !cleanText(r.profesorNombre).includes(cleanText(filtros.autor))) return false;
                    return true;
                });
                if (filtrados.length === 0) alert('No se encontraron recursos con esos filtros.');
                setResultados(filtrados);
            }
        } catch (e) { console.error(e); alert('Error en búsqueda.'); }
        setBuscando(false);
    };

    return (
        <div style={st.pagina}>
            {/* Header */}
            <div style={st.headerBusqueda}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={st.logoIcon}>🏷️</div>
                    <div>
                        <div style={{ fontWeight: 900, fontSize: '1.3rem', color: 'white' }}>EtiquetaMe</div>
                        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>Aprende etiquetando imágenes</div>
                    </div>
                </div>
                {onExit && (
                    <button onClick={onExit} style={st.btnSalir}>
                        <ArrowLeft size={16} /> Salir
                    </button>
                )}
            </div>

            {/* Buscador */}
            <div style={st.buscadorCard}>
                <h3 style={{ margin: '0 0 18px', color: '#2c3e50', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Search size={18} /> Encuentra un Diagrama
                </h3>

                {/* Tabs modo */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
                    {['FILTROS', 'CODIGO'].map(m => (
                        <button key={m} onClick={() => setModoBusqueda(m)} style={{
                            ...st.tabBtn,
                            background: modoBusqueda === m ? '#e74c3c' : '#f0f0f0',
                            color:      modoBusqueda === m ? 'white'    : '#555',
                        }}>
                            {m === 'FILTROS' ? <><Filter size={14} /> Filtros</> : <><Key size={14} /> Código</>}
                        </button>
                    ))}
                </div>

                {modoBusqueda === 'CODIGO' ? (
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: 12 }}>
                            Introduce el código que te ha dado tu profesor (4-5 letras).
                        </p>
                        <input
                            placeholder="Ej: ABCDE"
                            value={codigo}
                            onChange={e => setCodigo(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && buscar()}
                            style={{ ...st.inputGrande, letterSpacing: 4, textTransform: 'uppercase' }}
                            maxLength={6}
                        />
                    </div>
                ) : (
                    <div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 10 }}>
                            <select style={st.inputFiltro} value={filtros.ciclo} onChange={e => setFiltros({ ...filtros, ciclo: e.target.value })}>
                                <option value="">🎓 Cualquier Ciclo</option>
                                <option>Infantil</option><option>Primaria</option>
                                <option>Secundaria</option><option>Bachillerato</option><option>Otros</option>
                            </select>
                            <input style={st.inputFiltro} placeholder="🔍 Tema..." value={filtros.tema} onChange={e => setFiltros({ ...filtros, tema: e.target.value })} />
                        </div>
                        <button onClick={() => setMostrarMas(b => !b)} style={st.btnMasFiltros}>
                            {mostrarMas ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            {mostrarMas ? 'Menos filtros' : 'Más filtros (País, Autor...)'}
                        </button>
                        {mostrarMas && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 10, marginTop: 10 }}>
                                <input style={st.inputFiltro} placeholder="País"           value={filtros.pais}      onChange={e => setFiltros({ ...filtros, pais: e.target.value })} />
                                <input style={st.inputFiltro} placeholder="Región"         value={filtros.region}    onChange={e => setFiltros({ ...filtros, region: e.target.value })} />
                                <input style={st.inputFiltro} placeholder="Localidad"      value={filtros.poblacion} onChange={e => setFiltros({ ...filtros, poblacion: e.target.value })} />
                                <input style={st.inputFiltro} placeholder="Nombre Profesor" value={filtros.autor}    onChange={e => setFiltros({ ...filtros, autor: e.target.value })} />
                            </div>
                        )}
                    </div>
                )}

                <button onClick={buscar} disabled={buscando} style={st.btnBuscar}>
                    {buscando ? 'Buscando...' : '🔍 Buscar'}
                </button>

                {/* Resultados */}
                {resultados.length > 0 && (
                    <div style={{ marginTop: 24, borderTop: '2px dashed #eee', paddingTop: 18 }}>
                        <p style={{ color: '#666', marginBottom: 12, fontSize: '0.9rem' }}>
                            {resultados.length} resultado{resultados.length !== 1 ? 's' : ''}
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 12, maxHeight: 420, overflowY: 'auto' }}>
                            {resultados.map(r => (
                                <TarjetaRecurso key={r.id} r={r} onClick={() => onElegir(r)} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// TARJETA DE RECURSO
// ─────────────────────────────────────────────
function TarjetaRecurso({ r, onClick }) {
    const totalMarcadores = (r.hojas || []).reduce((s, h) => s + (h.markers?.length || 0), 0);
    return (
        <div onClick={onClick} style={st.tarjeta}>
            {/* Miniatura de la primera imagen */}
            {r.hojas?.[0]?.imageUrl && (
                <div style={{ width: '100%', height: 90, overflow: 'hidden', borderRadius: '8px 8px 0 0', background: '#f0f0f0' }}>
                    <img src={r.hojas[0].imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={e => e.target.style.display = 'none'} />
                </div>
            )}
            <div style={{ padding: '10px 12px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#2c3e50', marginBottom: 4 }}>{r.titulo}</div>
                <div style={{ fontSize: '0.78rem', color: '#777', marginBottom: 6 }}>
                    📚 {r.temas || 'Sin tema'} · 🎓 {r.ciclo || 'Todos'}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#999', marginBottom: 8 }}>
                    🖼️ {r.hojas?.length || 0} diagrama{(r.hojas?.length || 0) !== 1 ? 's' : ''} · ✎ {totalMarcadores} etiqueta{totalMarcadores !== 1 ? 's' : ''}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={st.codeBadge}><Key size={11} /> {r.accessCode}</span>
                    <button style={st.btnJugar}><Play size={13} /> Jugar</button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// PANTALLA 2 — ELECCIÓN DE HOJA
// ─────────────────────────────────────────────
function PantallaEleccion({ recurso, onElegir, onVolver }) {
    const hojas = recurso?.hojas || [];

    return (
        <div style={st.pagina}>
            <div style={st.headerJuego}>
                <button onClick={onVolver} style={st.btnVolver}>
                    <ArrowLeft size={15} /> Buscador
                </button>
                <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ fontWeight: 900, fontSize: '1.1rem', color: 'white' }}>{recurso.titulo}</div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>Elige qué diagrama practicar</div>
                </div>
                <div style={{ width: 80 }} />
            </div>

            <div style={{ maxWidth: 600, margin: '0 auto', padding: '30px 16px' }}>
                {/* Opción GENERAL */}
                <div onClick={() => onElegir(null)} style={st.hojaCard}>
                    <div style={{ ...st.hojaIcono, background: '#9b59b6' }}>
                        <Shuffle size={22} color="white" />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#2c3e50' }}>🎲 General (aleatorio)</div>
                        <div style={{ fontSize: '0.8rem', color: '#888', marginTop: 3 }}>
                            Aparecerá uno de los {hojas.length} diagramas al azar
                        </div>
                    </div>
                    <Play size={20} color="#9b59b6" />
                </div>

                {/* Una tarjeta por hoja */}
                {hojas.map((hoja, i) => (
                    <div key={i} onClick={() => onElegir(hoja)} style={st.hojaCard}>
                        <div style={{ ...st.hojaIcono, background: COLORES[i % COLORES.length] }}>
                            {hoja.imageUrl
                                ? <img src={hoja.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }}
                                    onError={e => e.target.style.display = 'none'} />
                                : <ImageIcon size={20} color="white" />
                            }
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 'bold', color: '#2c3e50' }}>{hoja.nombreHoja}</div>
                            <div style={{ fontSize: '0.78rem', color: '#888', marginTop: 2 }}>
                                {hoja.markers?.length || 0} etiqueta{(hoja.markers?.length || 0) !== 1 ? 's' : ''}
                            </div>
                        </div>
                        <Play size={18} color={COLORES[i % COLORES.length]} />
                    </div>
                ))}
            </div>
        </div>
    );
}

const COLORES = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];

// ─────────────────────────────────────────────
// PANTALLA 3 - JUEGO + RESULTADO
function ModalEnviarProfe({ datos, onClose }) {
    const [codigo, setCodigo]   = useState('');
    const [nombre, setNombre]   = useState('');
    const [curso,  setCurso]    = useState('');
    const [enviando, setEnviando] = useState(false);
    const [enviado,  setEnviado]  = useState(false);
    const [error,    setError]    = useState('');

    const enviar = async () => {
        const code = codigo.trim().toUpperCase();
        if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
        if (!code) { setError('Escribe el código del profesor.'); return; }
        setEnviando(true); setError('');
        try {
            const codigoDoc = await getDoc(doc(db, 'codigos_profesor', code));
            if (!codigoDoc.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'ETIQUETAS', modalidad: 'Individual', fecha: new Date(),
                recursoId: datos.recursoId, recursoTitulo: datos.recursoTitulo,
                hoja: datos.hoja, codigoProfesor: code,
                jugadores: [{ nombre: nombre.trim(), curso: curso.trim(), aciertos: datos.aciertos, total: datos.total, nota: datos.nota }],
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
                        <div style={{ marginTop: 8, color: '#aaa', fontSize: '0.9rem' }}>{datos.aciertos}/{datos.total} · {datos.nota?.toFixed(2)}%</div>
                        <button onClick={onClose} style={{ marginTop: 16, padding: '9px 22px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', color: 'white', fontFamily: 'inherit' }}>Cerrar</button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {[['nombre', 'Nombre y apellido', nombre, setNombre, 'Tu nombre completo', false],
                          ['curso',  'Curso',             curso,  setCurso,  'Ej: 3º ESO A',       false],
                          ['codigo', 'Código del profesor', codigo, v => setCodigo(v.toUpperCase()), 'Ej: PROF01', true]
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

function PantallaJuego({ recurso, hoja, onJugarDeNuevo, onCambiarDiagrama }) {
    const markers  = hoja?.markers || [];
    const imageUrl = hoja?.imageUrl || '';

    const [respuestas, setRespuestas] = useState({});
    const [evaluacion, setEvaluacion] = useState(null);
    const [mostrarEnvio, setMostrarEnvio] = useState(false);

    const comprobar = () => {
        let aciertos = 0;
        const resultados = {};
        markers.forEach(m => {
            const correcto = cleanText(m.text || '');
            const alumno   = cleanText(respuestas[m.id] || '');
            const ok = correcto !== '' && alumno === correcto;
            if (ok) aciertos++;
            resultados[m.id] = ok;
        });
        const nota = markers.length > 0
            ? Math.round((aciertos / markers.length) * 10000) / 100
            : 0;
        setEvaluacion({ resultados, aciertos, total: markers.length, nota });
    };

    const reiniciar = () => {
        setRespuestas({});
        setEvaluacion(null);
        onJugarDeNuevo();
    };

    if (!imageUrl || markers.length === 0) {
        return (
            <div style={{ ...st.pagina, justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 20, textAlign: 'center' }}>
                <ImageIcon size={60} color="rgba(255,255,255,0.4)" />
                <p style={{ color: 'white' }}>Este diagrama no tiene imagen o etiquetas configuradas.</p>
                <button onClick={onCambiarDiagrama} style={st.btnVolver}><ArrowLeft size={15} /> Volver</button>
            </div>
        );
    }

    const perfecto = evaluacion?.aciertos === markers.length;

    return (
        <div style={st.pagina}>
            {perfecto && <Confetti recycle={false} numberOfPieces={300} />}

            <div style={st.headerJuego}>
                <button onClick={onCambiarDiagrama} style={st.btnVolver}>
                    <ArrowLeft size={15} /> Diagramas
                </button>
                <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ fontWeight: 900, fontSize: '1rem', color: 'white' }}>{recurso.titulo}</div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>{hoja.nombreHoja}</div>
                </div>
                {evaluacion ? (
                    <div style={st.notaHeader(evaluacion.nota)}>{evaluacion.nota.toFixed(2)}%</div>
                ) : (
                    <div style={{ width: 80 }} />
                )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>
                <div style={{ maxWidth: 1000, margin: '0 auto' }}>

                    {/* Wrapper con padding igual que el editor para que las etiquetas no se corten */}
                    <div style={{
                        position: 'relative', display: 'inline-block', width: '100%',
                        background: 'white', borderRadius: 14,
                        padding: 60, boxSizing: 'border-box',
                        boxShadow: '0 8px 28px rgba(0,0,0,0.3)',
                    }}>
                        <img
                            src={imageUrl} alt="diagrama"
                            style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 8, userSelect: 'none' }}
                            draggable="false"
                        />

                        {/* Lienzo del profesor — base64 PNG superpuesto sobre la imagen */}
                        {hoja.paintData && (
                            <img
                                src={hoja.paintData}
                                alt=""
                                style={{
                                    position: 'absolute', top: 0, left: 0,
                                    width: '100%', height: '100%',
                                    zIndex: 1,
                                    pointerEvents: 'none',
                                    borderRadius: 14,
                                }}
                                draggable="false"
                            />
                        )}

                        {/* Lineas SVG con overflow visible */}
                        <svg style={{
                            position: 'absolute', top: 0, left: 0,
                            width: '100%', height: '100%',
                            pointerEvents: 'none', zIndex: 2, overflow: 'visible',
                        }}>
                            <defs>
                                <marker id="arrow-game" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                                    <polygon points="0 0, 8 3, 0 6" fill="#777" />
                                </marker>
                            </defs>
                            {markers.map(m => {
                                const estado = evaluacion ? evaluacion.resultados[m.id] : null;
                                const color  = estado === true ? '#27ae60' : estado === false ? '#e74c3c' : '#777';
                                return (
                                    <line key={`line-${m.id}`}
                                        x1={`${m.anchorX}%`} y1={`${m.anchorY}%`}
                                        x2={`${m.labelX}%`}  y2={`${m.labelY}%`}
                                        stroke={color} strokeWidth="2"
                                        markerEnd="url(#arrow-game)"
                                    />
                                );
                            })}
                        </svg>

                        {/* Puntos de anclaje */}
                        {markers.map(m => {
                            const estado = evaluacion ? evaluacion.resultados[m.id] : null;
                            const color  = estado === true ? '#27ae60' : estado === false ? '#e74c3c' : '#e67e22';
                            return (
                                <div key={`anchor-${m.id}`} style={{
                                    position: 'absolute',
                                    left: `${m.anchorX}%`, top: `${m.anchorY}%`,
                                    transform: 'translate(-50%, -50%)',
                                    width: 14, height: 14, borderRadius: '50%',
                                    background: color, border: '2px solid white',
                                    boxShadow: '0 2px 5px rgba(0,0,0,0.4)',
                                    zIndex: 5, transition: 'background 0.3s',
                                }} />
                            );
                        })}

                        {/* Inputs en la posicion exacta labelX/labelY del profesor */}
                        {markers.map((m, i) => {
                            const estado      = evaluacion ? evaluacion.resultados[m.id] : null;
                            const borderColor = estado === true ? '#27ae60' : estado === false ? '#e74c3c' : '#aaa';
                            const bgColor     = estado === true ? '#e8f8f0' : estado === false ? '#fef0ef' : 'white';
                            const displayVal  = (evaluacion && estado === false) ? m.text : (respuestas[m.id] || '');
                            return (
                                <div key={`label-${m.id}`} style={{
                                    position: 'absolute',
                                    left: `${m.labelX}%`, top: `${m.labelY}%`,
                                    transform: 'translate(-50%, -50%)',
                                    zIndex: 10,
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    background: bgColor,
                                    border: `2px solid ${borderColor}`,
                                    borderRadius: 8,
                                    boxShadow: '0 3px 10px rgba(0,0,0,0.2)',
                                    padding: '3px 6px 3px 4px',
                                    whiteSpace: 'nowrap',
                                    transition: 'border-color 0.3s, background 0.3s',
                                }}>
                                    <div style={{
                                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                                        background: borderColor, color: 'white',
                                        fontWeight: 'bold', fontSize: 11,
                                        display: 'flex', justifyContent: 'center', alignItems: 'center',
                                    }}>
                                        {i + 1}
                                    </div>
                                    {!evaluacion ? (
                                        <input
                                            type="text" placeholder="..."
                                            value={respuestas[m.id] || ''}
                                            onChange={e => setRespuestas({ ...respuestas, [m.id]: e.target.value })}
                                            onKeyDown={e => e.key === 'Enter' && comprobar()}
                                            style={{
                                                border: 'none', outline: 'none',
                                                fontSize: 13, fontWeight: 'bold',
                                                background: 'transparent', color: '#2c3e50',
                                                width: `${Math.max(6, (respuestas[m.id]?.length || 0) + 3)}ch`,
                                                minWidth: 55, maxWidth: 160,
                                            }}
                                        />
                                    ) : (
                                        <span style={{
                                            fontSize: 13, fontWeight: 'bold',
                                            color: estado === true ? '#1a7a4a' : '#c0392b',
                                            padding: '1px 2px', minWidth: 40,
                                        }}>
                                            {displayVal}
                                        </span>
                                    )}
                                    {estado === true  && <CheckCircle size={14} color="#27ae60" />}
                                    {estado === false && <XCircle     size={14} color="#e74c3c" />}
                                </div>
                            );
                        })}
                    </div>

                    {/* Acciones debajo de la imagen */}
                    <div style={{ marginTop: 18, maxWidth: 460, margin: '18px auto 0' }}>
                        {!evaluacion ? (
                            <button onClick={comprobar} style={st.btnComprobar}>
                                <CheckCircle size={18} /> Comprobar
                            </button>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <div style={st.resultadoBox(evaluacion.nota)}>
                                    <div style={{ fontSize: '0.85rem', opacity: 0.85 }}>
                                        {evaluacion.aciertos} / {evaluacion.total} correctas
                                    </div>
                                    <div style={{ fontSize: '2rem', fontWeight: 900, lineHeight: 1.1 }}>
                                        {evaluacion.nota.toFixed(2)}%
                                    </div>
                                    <div style={{ fontSize: '0.9rem' }}>
                                        {perfecto ? '🎉 ¡Perfecto!' : evaluacion.nota >= 70 ? '👏 ¡Muy bien!' : evaluacion.nota >= 50 ? '💪 ¡Sigue practicando!' : '📚 ¡A estudiar más!'}
                                    </div>
                                </div>
                                <button onClick={reiniciar} style={st.btnJugarDeNuevo}>
                                    <RotateCcw size={16} /> Jugar de nuevo (misma imagen)
                                </button>
                                <button onClick={onCambiarDiagrama} style={st.btnCambiarDiagrama}>
                                    <Shuffle size={16} /> Cambiar diagrama
                                </button>
                                <button onClick={() => setMostrarEnvio(true)} style={{ ...st.btnJugarDeNuevo, background: 'linear-gradient(135deg,#27ae60,#2ecc71)', color: 'white' }}>
                                    📤 Enviar al profesor
                                </button>
                            </div>
                        )}
                    </div>
                    {mostrarEnvio && (
                        <ModalEnviarProfe
                            datos={{ recursoId: recurso?.id, recursoTitulo: recurso?.titulo, hoja: hoja?.nombreHoja, aciertos: evaluacion.aciertos, total: evaluacion.total, nota: evaluacion.nota }}
                            onClose={() => setMostrarEnvio(false)}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

const st = {
    pagina: {
        minHeight:  '100vh',
        background: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)',
        display:    'flex',
        flexDirection: 'column',
        fontFamily: "'Segoe UI', Tahoma, sans-serif",
    },

    // Headers
    headerBusqueda: {
        background:     'rgba(0,0,0,0.25)',
        padding:        '14px 20px',
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'center',
    },
    headerJuego: {
        background:     'rgba(0,0,0,0.25)',
        padding:        '12px 16px',
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'center',
        gap:            12,
    },
    logoIcon: {
        width: 44, height: 44, borderRadius: 12,
        background: '#e74c3c',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        fontSize: '1.5rem',
    },

    btnSalir: { padding: '7px 14px', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 20, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 'bold' },
    btnVolver: { padding: '7px 12px', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 20, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.85rem', fontWeight: 'bold', whiteSpace: 'nowrap' },
    notaHeader: (nota) => ({
        background: nota >= 70 ? '#27ae60' : nota >= 50 ? '#f39c12' : '#e74c3c',
        color: 'white', fontWeight: 900, fontSize: '1rem',
        padding: '5px 12px', borderRadius: 20, minWidth: 70, textAlign: 'center',
    }),

    // Buscador
    buscadorCard: {
        background: 'white', borderRadius: 16, padding: '24px',
        maxWidth: 860, margin: '24px auto', width: 'calc(100% - 32px)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
    },
    tabBtn:     { padding: '9px 18px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 5 },
    inputGrande:{ padding: '14px', fontSize: '1.4rem', textAlign: 'center', borderRadius: 10, border: '2px solid #ddd', width: '100%', maxWidth: 280, outline: 'none', boxSizing: 'border-box' },
    inputFiltro:{ padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', outline: 'none', fontSize: '0.9rem', background: 'white' },
    btnMasFiltros: { background: 'none', border: 'none', color: '#e74c3c', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, marginTop: 8, fontSize: '0.82rem' },
    btnBuscar:  { width: '100%', marginTop: 14, padding: '13px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: 10, fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' },

    // Tarjeta recurso
    tarjeta:    { background: 'white', borderRadius: 12, border: '2px solid #f0f0f0', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', overflow: 'hidden', transition: 'transform 0.15s', ':hover': { transform: 'scale(1.02)' } },
    codeBadge:  { background: '#f0f0f0', padding: '3px 8px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 'bold', color: '#666', display: 'flex', alignItems: 'center', gap: 3 },
    btnJugar:   { background: '#e74c3c', color: 'white', border: 'none', borderRadius: 10, padding: '5px 10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4 },

    // Elección hoja
    hojaCard: {
        background: 'white', borderRadius: 12, padding: '16px 18px',
        marginBottom: 12, display: 'flex', alignItems: 'center', gap: 14,
        cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
        border: '2px solid transparent', transition: 'border-color 0.15s',
    },
    hojaIcono: { width: 52, height: 52, borderRadius: 10, flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },

    // Juego
    juegoWrapper: {
        display:    'flex',
        flexWrap:   'wrap',
        gap:        20,
        padding:    '20px 16px',
        maxWidth:   1100,
        margin:     '0 auto',
        width:      '100%',
        boxSizing:  'border-box',
    },
    imageZona: {
        flex:       '1 1 420px',
        background: 'white',
        borderRadius: 14,
        padding:    10,
        boxShadow:  '0 8px 24px rgba(0,0,0,0.25)',
        textAlign:  'center',
    },
    imagenJuego: {
        maxWidth:   '100%',
        maxHeight:  '65vh',
        objectFit:  'contain',
        display:    'block',
        borderRadius: 8,
        userSelect: 'none',
    },
    respuestasZona: {
        flex:       '0 1 360px',
        background: 'white',
        borderRadius: 14,
        padding:    '20px',
        boxShadow:  '0 8px 24px rgba(0,0,0,0.25)',
        overflowY:  'auto',
        maxHeight:  '80vh',
    },
    inputRespuesta: {
        width:       '100%',
        padding:     '9px 12px',
        borderRadius: 8,
        border:      '2px solid #ddd',
        fontSize:    '0.9rem',
        outline:     'none',
        boxSizing:   'border-box',
        transition:  'border-color 0.2s',
    },
    btnComprobar: {
        width:       '100%',
        padding:     '13px',
        background:  '#27ae60',
        color:       'white',
        border:      'none',
        borderRadius: 10,
        fontSize:    '1rem',
        fontWeight:  'bold',
        cursor:      'pointer',
        display:     'flex',
        justifyContent: 'center',
        alignItems:  'center',
        gap:         8,
    },
    resultadoBox: (nota) => ({
        background:  nota >= 70 ? '#e8f8f0' : nota >= 50 ? '#fef8e7' : '#fef0ef',
        border:      `2px solid ${nota >= 70 ? '#27ae60' : nota >= 50 ? '#f39c12' : '#e74c3c'}`,
        borderRadius: 12,
        padding:     '16px',
        textAlign:   'center',
        color:       nota >= 70 ? '#1a7a4a' : nota >= 50 ? '#b7770d' : '#c0392b',
        marginBottom: 4,
    }),
    btnJugarDeNuevo: {
        width: '100%', padding: '11px', background: '#3498db', color: 'white',
        border: 'none', borderRadius: 10, fontWeight: 'bold', cursor: 'pointer',
        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 7, fontSize: '0.9rem',
    },
    btnCambiarDiagrama: {
        width: '100%', padding: '11px', background: '#ecf0f1', color: '#555',
        border: 'none', borderRadius: 10, fontWeight: 'bold', cursor: 'pointer',
        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 7, fontSize: '0.9rem',
    },
};
