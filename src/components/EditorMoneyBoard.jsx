import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Plus, Trash2, Save, Play, Download, X, Check, Smartphone, LogIn, Cloud } from 'lucide-react';
import { db, auth } from '../firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { categoriasDeRecurso } from '../utils/normalizarPreguntas';
import { guardarRecursoLocal, guardarBorrador, leerBorrador, borrarBorrador } from '../utils/recursosLocales';

// Clave histórica del borrador: NO cambiarla aunque el juego se llame ahora
// Money Board, o se perderían los borradores ya guardados en los dispositivos.
const CLAVE_BORRADOR = 'PIKTBOARD';

/* =====================================================================
 *  EDITOR DE TABLEROS (Money Board) — se abre desde el propio juego.
 *  Guarda un recurso estándar en `resources` con la forma habitual
 *  { hojas: [{ nombreHoja, preguntas: [...] }] }, así que el tablero
 *  creado aquí también se puede jugar en Pasapalabra, Burbujas, etc.
 * ===================================================================== */

const MAX_CATS = 6;
const MAX_FILAS = 5;
const FUENTE = "'Segoe UI', Roboto, sans-serif";

function generarCodigo() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const wrap = {
    position: 'fixed', inset: 0, zIndex: 9999, overflowY: 'auto', fontFamily: FUENTE,
    background: 'linear-gradient(160deg, #060b1c 0%, #0f1f4d 55%, #060b1c 100%)',
    color: '#eaf1ff', padding: '18px clamp(10px, 2vw, 28px) 40px', boxSizing: 'border-box',
};

const input = {
    padding: '9px 11px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.16)',
    background: 'rgba(0,0,0,0.32)', color: '#eaf1ff', fontSize: '0.92rem',
    outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit',
};

const btn = {
    background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)',
    color: '#eaf1ff', borderRadius: 11, padding: '9px 15px', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: '0.88rem',
    fontWeight: 600, fontFamily: 'inherit',
};

const btnAzul = {
    ...btn, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
    border: 'none', fontWeight: 800, boxShadow: '0 6px 18px rgba(37,99,235,0.4)',
};

const vaciaCategoria = (i) => ({ nombreHoja: `Categoría ${i + 1}`, preguntas: [] });

// ------------------------------------------------------------------
//  IMPORTAR DESDE UN RECURSO EXISTENTE
// ------------------------------------------------------------------
function ModalImportar({ onClose, onImportar }) {
    const [busqueda, setBusqueda] = useState('');
    const [lista, setLista] = useState([]);
    const [cargando, setCargando] = useState(true);

    React.useEffect(() => {
        (async () => {
            try {
                const snap = await getDocs(query(collection(db, 'resources'), where('isPrivate', '==', false)));
                const docs = snap.docs.map(d => ({ ...d.data(), id: d.id }));
                setLista(docs.map(r => ({ r, cats: categoriasDeRecurso(r) })).filter(x => x.cats.length > 0));
            } catch (e) { console.error('Importar Money Board:', e); }
            setCargando(false);
        })();
    }, []);

    const q = busqueda.toLowerCase().trim();
    const res = !q ? lista : lista.filter(({ r }) => String(r.titulo || '').toLowerCase().includes(q));

    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
            <div onClick={e => e.stopPropagation()} style={{
                background: '#0d1830', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 18,
                padding: 22, width: '100%', maxWidth: 520, color: '#eaf1ff', boxSizing: 'border-box',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ margin: 0, color: '#f5c518', fontSize: '1.05rem' }}>📥 Importar categorías</h3>
                    <button onClick={onClose} style={{ ...btn, padding: '5px 9px' }}><X size={15} /></button>
                </div>
                <p style={{ color: '#90a4c8', fontSize: '0.82rem', margin: '0 0 10px' }}>
                    Las hojas del recurso se copiarán como categorías de tu tablero (puedes editarlas después).
                </p>
                <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar recurso…" style={{ ...input, marginBottom: 10 }} />
                <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {cargando ? <p style={{ color: '#90a4c8', textAlign: 'center' }}>Cargando…</p>
                        : res.length === 0 ? <p style={{ color: '#90a4c8', textAlign: 'center' }}>Sin resultados.</p>
                            : res.map(({ r, cats }) => (
                                <button key={r.id} onClick={() => onImportar(r, cats)} style={{
                                    ...btn, display: 'block', textAlign: 'left', width: '100%', background: 'rgba(255,255,255,0.05)',
                                }}>
                                    <div style={{ fontWeight: 700 }}>{r.titulo || 'Sin título'}</div>
                                    <div style={{ fontSize: 11, color: '#90a4c8', marginTop: 2 }}>
                                        {cats.length} hoja(s) · {cats.reduce((s, c) => s + c.preguntas.length, 0)} preguntas
                                    </div>
                                </button>
                            ))}
                </div>
            </div>
        </div>
    );
}

// ------------------------------------------------------------------
//  EDICIÓN DE UNA CASILLA
// ------------------------------------------------------------------
function ModalCasilla({ categoria, fila, valor, datos, onGuardar, onBorrar, onClose }) {
    const [p, setP] = useState(() => ({
        pregunta: datos?.pregunta || '',
        correcta: datos?.correcta || '',
        incorrectas: [0, 1, 2].map(i => datos?.incorrectas?.[i] || ''),
    }));

    const guardar = () => {
        if (!p.pregunta.trim() || !p.correcta.trim()) return alert('Hacen falta la pregunta y la respuesta correcta.');
        onGuardar({
            pregunta: p.pregunta.trim(),
            correcta: p.correcta.trim(),
            incorrectas: p.incorrectas.map(x => x.trim()).filter(Boolean),
            tipo: p.incorrectas.some(x => x.trim()) ? 'MULTIPLE' : 'SIMPLE',
        });
    };

    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
            <div onClick={e => e.stopPropagation()} style={{
                background: '#0d1830', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 18,
                padding: 22, width: '100%', maxWidth: 520, color: '#eaf1ff', boxSizing: 'border-box',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <h3 style={{ margin: 0, fontSize: '1rem' }}>
                        <span style={{ color: '#90a4c8' }}>{categoria}</span> · <span style={{ color: '#f5c518' }}>${valor}</span>
                    </h3>
                    <button onClick={onClose} style={{ ...btn, padding: '5px 9px' }}><X size={15} /></button>
                </div>

                <label style={{ fontSize: '0.76rem', color: '#90a4c8', fontWeight: 600 }}>Pregunta o definición</label>
                <textarea value={p.pregunta} onChange={e => setP({ ...p, pregunta: e.target.value })} rows={3}
                    placeholder="¿Cuál es la capital de Francia?" style={{ ...input, marginTop: 4, marginBottom: 12, resize: 'vertical' }} />

                <label style={{ fontSize: '0.76rem', color: '#2ecc71', fontWeight: 600 }}>Respuesta correcta</label>
                <input value={p.correcta} onChange={e => setP({ ...p, correcta: e.target.value })}
                    placeholder="París" style={{ ...input, marginTop: 4, marginBottom: 12, borderColor: 'rgba(46,204,113,0.45)' }} />

                <label style={{ fontSize: '0.76rem', color: '#90a4c8', fontWeight: 600 }}>
                    Respuestas incorrectas <span style={{ color: '#5f7599' }}>(opcionales: si las pones, saldrá como test)</span>
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 4 }}>
                    {p.incorrectas.map((v, i) => (
                        <input key={i} value={v} placeholder={`Incorrecta ${i + 1}`}
                            onChange={e => setP({ ...p, incorrectas: p.incorrectas.map((x, j) => j === i ? e.target.value : x) })}
                            style={input} />
                    ))}
                </div>

                <div style={{ display: 'flex', gap: 9, marginTop: 18 }}>
                    {datos && <button onClick={onBorrar} style={{ ...btn, background: 'rgba(192,57,43,0.8)', border: 'none' }}><Trash2 size={15} /> Vaciar</button>}
                    <div style={{ flex: 1 }} />
                    <button onClick={onClose} style={btn}>Cancelar</button>
                    <button onClick={guardar} style={btnAzul}><Check size={16} /> Guardar casilla</button>
                </div>
            </div>
        </div>
    );
}

// ------------------------------------------------------------------
//  GUARDAR SIN SESIÓN: iniciar sesión aquí mismo o guardar en el aparato
// ------------------------------------------------------------------
function ModalGuardarSinSesion({ guardando, error, onIniciarSesion, onDispositivo, onClose }) {
    return (
        <div onClick={guardando ? undefined : onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10002, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
            <div onClick={e => e.stopPropagation()} style={{
                background: '#0d1830', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 18,
                padding: 24, width: '100%', maxWidth: 470, color: '#eaf1ff', boxSizing: 'border-box',
            }}>
                <h3 style={{ margin: '0 0 6px', color: '#f5c518', fontSize: '1.1rem' }}>¿Dónde guardamos tu tablero?</h3>
                <p style={{ color: '#90a4c8', fontSize: '0.86rem', margin: '0 0 18px', lineHeight: 1.55 }}>
                    No has iniciado sesión. Tranquilo: <b style={{ color: '#eaf1ff' }}>tu trabajo no se va a perder</b> elijas lo que elijas.
                </p>

                <button onClick={onIniciarSesion} disabled={guardando} style={{
                    ...btnAzul, width: '100%', justifyContent: 'flex-start', alignItems: 'flex-start',
                    flexDirection: 'column', gap: 4, padding: '14px 16px', textAlign: 'left',
                    opacity: guardando ? 0.6 : 1, cursor: guardando ? 'default' : 'pointer',
                }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.98rem' }}>
                        <LogIn size={17} /> {guardando ? 'Guardando…' : 'Iniciar sesión y guardar'}
                    </span>
                    <span style={{ fontWeight: 500, fontSize: '0.78rem', color: 'rgba(255,255,255,0.85)' }}>
                        Se abre una ventana de Google y vuelves justo aquí. Lo tendrás en cualquier dispositivo y podrás compartirlo.
                    </span>
                </button>

                <button onClick={onDispositivo} disabled={guardando} style={{
                    ...btn, width: '100%', marginTop: 10, justifyContent: 'flex-start', alignItems: 'flex-start',
                    flexDirection: 'column', gap: 4, padding: '14px 16px', textAlign: 'left',
                    opacity: guardando ? 0.6 : 1, cursor: guardando ? 'default' : 'pointer',
                }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.98rem', fontWeight: 700 }}>
                        <Smartphone size={17} /> Guardar solo en este dispositivo
                    </span>
                    <span style={{ fontWeight: 500, fontSize: '0.78rem', color: '#f0a44a' }}>
                        ⚠ Solo podrás jugarlo en este navegador. No estará en otros aparatos y se perderá si borras los datos de navegación.
                    </span>
                </button>

                {error && (
                    <div style={{ marginTop: 12, padding: '9px 12px', borderRadius: 10, background: 'rgba(231,76,60,0.15)', border: '1px solid rgba(231,76,60,0.4)', color: '#ffb3ab', fontSize: '0.82rem' }}>
                        ⚠ {error}
                    </div>
                )}

                <button onClick={onClose} disabled={guardando} style={{ ...btn, width: '100%', marginTop: 12, justifyContent: 'center', background: 'transparent', border: 'none', color: '#90a4c8' }}>
                    Seguir editando
                </button>
            </div>
        </div>
    );
}

// ------------------------------------------------------------------
//  EDITOR PRINCIPAL
// ------------------------------------------------------------------
export default function EditorMoneyBoard({ usuario, onBack, onJugar }) {
    const [titulo, setTitulo] = useState('');
    const [tema, setTema] = useState('');
    const [ciclo, setCiclo] = useState('Secundaria');
    const [valorBase, setValorBase] = useState(100);
    const [hojas, setHojas] = useState(() => [vaciaCategoria(0), vaciaCategoria(1), vaciaCategoria(2)]);
    const [editando, setEditando] = useState(null);   // { c, f }
    const [importar, setImportar] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [decidirGuardado, setDecidirGuardado] = useState(false);
    const [errorLogin, setErrorLogin] = useState('');
    const [borradorPrevio, setBorradorPrevio] = useState(null);

    // --- Borrador: nunca se pierde el trabajo aunque se cierre la pestaña ---
    const montado = useRef(false);

    useEffect(() => {
        const b = leerBorrador(CLAVE_BORRADOR);
        if (b?.datos?.hojas?.some(h => h.preguntas?.some(p => p && p.pregunta))) setBorradorPrevio(b);
    }, []);

    useEffect(() => {
        // No guardamos en el primer render (evita pisar el borrador antes de ofrecer restaurarlo).
        if (!montado.current) { montado.current = true; return; }
        const t = setTimeout(() => guardarBorrador(CLAVE_BORRADOR, { titulo, tema, ciclo, valorBase, hojas }), 600);
        return () => clearTimeout(t);
    }, [titulo, tema, ciclo, valorBase, hojas]);

    const restaurarBorrador = () => {
        const d = borradorPrevio.datos;
        setTitulo(d.titulo || ''); setTema(d.tema || '');
        setCiclo(d.ciclo || 'Secundaria'); setValorBase(d.valorBase || 100);
        setHojas(d.hojas?.length ? d.hojas : hojas);
        setBorradorPrevio(null);
    };

    const totalPreguntas = hojas.reduce((s, h) => s + h.preguntas.filter(p => p && p.pregunta).length, 0);

    const setNombre = (ci, val) => setHojas(hs => hs.map((h, i) => i === ci ? { ...h, nombreHoja: val } : h));

    const addCategoria = () => setHojas(hs => hs.length >= MAX_CATS ? hs : [...hs, vaciaCategoria(hs.length)]);

    const delCategoria = (ci) => {
        if (hojas.length <= 2) return alert('El tablero necesita al menos 2 categorías.');
        if (!window.confirm(`¿Borrar la categoría «${hojas[ci].nombreHoja}»?`)) return;
        setHojas(hs => hs.filter((_, i) => i !== ci));
    };

    const setCasilla = (ci, fi, datos) => setHojas(hs => hs.map((h, i) => {
        if (i !== ci) return h;
        const pregs = [...h.preguntas];
        while (pregs.length <= fi) pregs.push(null);
        pregs[fi] = datos;
        return { ...h, preguntas: pregs };
    }));

    const importarRecurso = (r, cats) => {
        const nuevas = cats.slice(0, MAX_CATS).map(c => ({
            nombreHoja: c.nombre,
            preguntas: c.preguntas.slice(0, MAX_FILAS).map(p => ({
                pregunta: p.tipo === 'RELLENAR' ? `${p.bloques[0]} ______ ${p.bloques[2]}`.trim() : p.enunciado,
                correcta: p.correcta,
                incorrectas: (p.opciones || []).filter(o => o !== p.correcta),
                tipo: (p.opciones || []).length > 1 ? 'MULTIPLE' : 'SIMPLE',
            })),
        }));
        setHojas(nuevas.length >= 2 ? nuevas : [...nuevas, vaciaCategoria(nuevas.length)]);
        if (!titulo.trim()) setTitulo(`${r.titulo || 'Tablero'} (tablero)`);
        setImportar(false);
    };

    /** Hojas limpias (sin casillas vacías y sin categorías vacías). */
    const hojasLimpias = () => hojas
        .map(h => ({ nombreHoja: h.nombreHoja.trim() || 'Categoría', preguntas: h.preguntas.filter(p => p && p.pregunta) }))
        .filter(h => h.preguntas.length > 0);

    const recursoLocal = () => ({
        id: 'local_' + Date.now(),
        titulo: titulo.trim() || 'Tablero sin título',
        tipoJuego: 'JEOPARDY',
        hojas: hojasLimpias(),
        valorBase,
    });

    const validar = () => {
        if (!titulo.trim()) { alert('Ponle un título al tablero.'); return false; }
        const llenas = hojas.filter(h => h.preguntas.some(p => p && p.pregunta));
        if (llenas.length < 2) { alert('Necesitas al menos 2 categorías con preguntas.'); return false; }
        return true;
    };

    // Al pulsar "Guardar": si no hay sesión, se pregunta antes de nada.
    const guardar = () => {
        if (!validar()) return;
        const u = usuario?.uid ? usuario : auth.currentUser;
        if (!u?.uid) { setDecidirGuardado(true); return; }
        guardarEnNube(u);
    };

    /** Guarda en Firestore, visible desde cualquier dispositivo. */
    const guardarEnNube = async (u) => {
        setDecidirGuardado(false);
        setGuardando(true);
        try {
            await addDoc(collection(db, 'resources'), {
                titulo: titulo.trim(),
                tipoJuego: 'JEOPARDY',
                tipo: 'JEOPARDY',
                hojas: hojasLimpias(),
                valorBase,
                temas: tema.trim(),
                ciclo,
                isPrivate: false,
                isFinished: true,
                profesorUid: u.uid,
                profesorNombre: u.displayName || 'Profesor',
                pais: u.pais || '', region: u.region || '', poblacion: u.poblacion || '',
                playCount: 0,
                fechaCreacion: new Date(),
                accessCode: generarCodigo(),
                origen: 'editor_pikt_board',
            });
            borrarBorrador();
            alert('✅ Tablero guardado en tu cuenta. Ya puedes encontrarlo en el buscador de recursos desde cualquier dispositivo.');
            onBack?.();
        } catch (e) {
            alert('Error al guardar: ' + e.message + '\n\nTu trabajo NO se ha perdido: sigue aquí y puedes guardarlo en este dispositivo.');
        }
        setGuardando(false);
    };

    /**
     * Inicia sesión con Google sin salir del editor (ventana emergente, así que
     * no se recarga la página) y guarda en cuanto hay usuario.
     */
    const iniciarSesionYGuardar = async () => {
        setErrorLogin('');
        setGuardando(true);
        try {
            const r = await signInWithPopup(auth, new GoogleAuthProvider());
            await guardarEnNube(r.user);
        } catch (e) {
            setGuardando(false);
            setErrorLogin(
                e?.code === 'auth/popup-blocked'
                    ? 'El navegador ha bloqueado la ventana de inicio de sesión. Permítela o guarda en este dispositivo.'
                    : 'No se ha podido iniciar sesión. Tu tablero sigue intacto: prueba otra vez o guárdalo en este dispositivo.'
            );
        }
    };

    /** Guarda solo en este navegador. */
    const guardarEnDispositivo = () => {
        const guardado = guardarRecursoLocal({
            titulo: titulo.trim(),
            tipoJuego: 'JEOPARDY',
            tipo: 'JEOPARDY',
            hojas: hojasLimpias(),
            valorBase,
            temas: tema.trim(),
            ciclo,
        });
        if (!guardado) {
            alert('Este navegador no permite guardar datos (¿modo privado?). Inicia sesión para guardar el tablero en tu cuenta.');
            return;
        }
        borrarBorrador();
        setDecidirGuardado(false);
        alert('📱 Tablero guardado EN ESTE DISPOSITIVO.\n\nLo verás en el buscador, en el apartado «En este dispositivo», pero solo desde este navegador: no estará en otros ordenadores ni tablets, y se perderá si borras los datos de navegación.\n\nPara tenerlo siempre disponible y poder compartirlo, inicia sesión y vuelve a guardarlo.');
        onBack?.();
    };

    const casillaDe = (ci, fi) => hojas[ci].preguntas[fi] || null;

    return (
        <div style={wrap}>
            {/* Cabecera */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                <button onClick={onBack} style={btn}><ArrowLeft size={16} /> Atrás</button>
                <h2 style={{ margin: 0, color: '#f5c518', fontSize: '1.25rem' }}>✏️ Crear tablero</h2>
                <div style={{ flex: 1 }} />
                <button onClick={() => setImportar(true)} style={btn}><Download size={16} /> Importar de un recurso</button>
                <button onClick={() => { if (validar()) onJugar(recursoLocal()); }} style={btn}><Play size={16} /> Probar</button>
                <button onClick={guardar} disabled={guardando} style={btnAzul}>
                    <Save size={16} /> {guardando ? 'Guardando…' : 'Guardar recurso'}
                </button>
            </div>

            {/* Sin sesión: se avisa desde el principio, pero se puede trabajar igual */}
            {!(usuario?.uid || auth.currentUser) && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap',
                    padding: '9px 13px', borderRadius: 12, marginBottom: 14,
                    background: 'rgba(240,164,74,0.12)', border: '1px solid rgba(240,164,74,0.35)',
                    color: '#f7d3a8', fontSize: '0.82rem',
                }}>
                    <Cloud size={16} />
                    <span style={{ flex: 1, minWidth: 200 }}>
                        No has iniciado sesión. Puedes crear el tablero igualmente: al guardar podrás
                        entrar con tu cuenta <b>sin perder nada</b>, o dejarlo solo en este dispositivo.
                    </span>
                </div>
            )}

            {/* Borrador de una sesión anterior */}
            {borradorPrevio && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                    padding: '10px 14px', borderRadius: 12, marginBottom: 14,
                    background: 'rgba(37,99,235,0.16)', border: '1px solid rgba(37,99,235,0.45)',
                    color: '#cfe0ff', fontSize: '0.84rem',
                }}>
                    <span style={{ flex: 1, minWidth: 200 }}>
                        💾 Tienes un tablero sin terminar
                        {borradorPrevio.datos?.titulo ? <> — «<b>{borradorPrevio.datos.titulo}</b>»</> : ''}. ¿Lo recuperamos?
                    </span>
                    <button onClick={restaurarBorrador} style={btnAzul}>Recuperar</button>
                    <button onClick={() => { borrarBorrador(); setBorradorPrevio(null); }} style={{ ...btn, background: 'transparent', border: 'none', color: '#90a4c8' }}>
                        Descartar
                    </button>
                </div>
            )}

            {/* Datos del recurso */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, marginBottom: 18 }}>
                <div>
                    <label style={{ fontSize: '0.74rem', color: '#90a4c8', fontWeight: 600 }}>Título del tablero</label>
                    <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Repaso Unidad 3" style={{ ...input, marginTop: 4 }} />
                </div>
                <div>
                    <label style={{ fontSize: '0.74rem', color: '#90a4c8', fontWeight: 600 }}>Tema / asignatura</label>
                    <input value={tema} onChange={e => setTema(e.target.value)} placeholder="Inglés, vocabulario" style={{ ...input, marginTop: 4 }} />
                </div>
                <div>
                    <label style={{ fontSize: '0.74rem', color: '#90a4c8', fontWeight: 600 }}>Etapa</label>
                    <select value={ciclo} onChange={e => setCiclo(e.target.value)} style={{ ...input, marginTop: 4 }}>
                        {['Infantil', 'Primaria', 'Secundaria', 'Bachillerato', 'FP', 'Universidad'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div>
                    <label style={{ fontSize: '0.74rem', color: '#90a4c8', fontWeight: 600 }}>Valor base</label>
                    <select value={valorBase} onChange={e => setValorBase(Number(e.target.value))} style={{ ...input, marginTop: 4 }}>
                        {[10, 100, 200].map(n => <option key={n} value={n}>${n}</option>)}
                    </select>
                </div>
            </div>

            <p style={{ color: '#90a4c8', fontSize: '0.84rem', margin: '0 0 10px' }}>
                Pulsa una casilla para escribir su pregunta. {totalPreguntas} pregunta(s) · {hojas.length} categoría(s).
                Cada categoría se guarda como una <b>hoja</b>, así que este recurso también servirá para Pasapalabra, Burbujas o el resto de juegos.
            </p>

            {/* Rejilla editable */}
            <div style={{
                display: 'grid', gap: 7, overflowX: 'auto', paddingBottom: 6,
                gridTemplateColumns: `repeat(${hojas.length}, minmax(140px, 1fr))`,
                gridTemplateRows: `auto repeat(${MAX_FILAS}, 70px)`,
            }}>
                {hojas.map((h, ci) => (
                    <div key={`h${ci}`} style={{ gridColumn: ci + 1, gridRow: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <input value={h.nombreHoja} onChange={e => setNombre(ci, e.target.value)} maxLength={28}
                            style={{ ...input, textAlign: 'center', fontWeight: 800, background: 'rgba(233,238,252,0.9)', color: '#0a1533', border: 'none' }} />
                        <button onClick={() => delCategoria(ci)} style={{ ...btn, padding: '3px 8px', fontSize: '0.68rem', justifyContent: 'center', background: 'transparent', border: 'none', color: '#7f92b8' }}>
                            <Trash2 size={12} /> borrar
                        </button>
                    </div>
                ))}

                {hojas.map((h, ci) => Array.from({ length: MAX_FILAS }, (_, fi) => {
                    const c = casillaDe(ci, fi);
                    return (
                        <button key={`${ci}-${fi}`} onClick={() => setEditando({ c: ci, f: fi })}
                            style={{
                                gridColumn: ci + 1, gridRow: fi + 2, borderRadius: 9, cursor: 'pointer',
                                fontFamily: 'inherit', padding: '6px 8px', textAlign: 'center', overflow: 'hidden',
                                border: c ? 'none' : '2px dashed rgba(255,255,255,0.18)',
                                background: c ? 'linear-gradient(180deg, #2563eb, #1638a8)' : 'rgba(255,255,255,0.04)',
                                color: c ? 'white' : '#5f7599',
                            }}>
                            <div style={{ fontWeight: 900, color: c ? '#f5c518' : '#5f7599', fontSize: '0.95rem' }}>${valorBase * (fi + 1)}</div>
                            <div style={{ fontSize: '0.68rem', marginTop: 3, lineHeight: 1.25, maxHeight: 34, overflow: 'hidden' }}>
                                {c ? c.pregunta : '+ añadir'}
                            </div>
                        </button>
                    );
                }))}
            </div>

            {hojas.length < MAX_CATS && (
                <button onClick={addCategoria} style={{ ...btn, marginTop: 14 }}><Plus size={16} /> Añadir categoría</button>
            )}

            {/* Modales */}
            {editando && (
                <ModalCasilla
                    key={`${editando.c}-${editando.f}`}
                    categoria={hojas[editando.c].nombreHoja}
                    fila={editando.f}
                    valor={valorBase * (editando.f + 1)}
                    datos={casillaDe(editando.c, editando.f)}
                    onGuardar={(d) => { setCasilla(editando.c, editando.f, d); setEditando(null); }}
                    onBorrar={() => { setCasilla(editando.c, editando.f, null); setEditando(null); }}
                    onClose={() => setEditando(null)}
                />
            )}
            {importar && <ModalImportar onClose={() => setImportar(false)} onImportar={importarRecurso} />}

            {decidirGuardado && (
                <ModalGuardarSinSesion
                    guardando={guardando}
                    error={errorLogin}
                    onIniciarSesion={iniciarSesionYGuardar}
                    onDispositivo={guardarEnDispositivo}
                    onClose={() => { setDecidirGuardado(false); setErrorLogin(''); }}
                />
            )}
        </div>
    );
}
