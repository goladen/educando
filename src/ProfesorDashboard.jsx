import { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, where, getDocs, deleteDoc, doc, addDoc, updateDoc, getDoc, setDoc, orderBy } from 'firebase/firestore';
import { Trash2, Plus, FileSpreadsheet, Bot, BarChart2, Download, Save, X, Pencil, Key, Gamepad2, Zap, Edit3, FolderPlus, ArrowUp, ArrowDown, Globe, Search, Copy, Eye, Users, User, RotateCcw } from 'lucide-react';
import useDrivePicker from 'react-google-drive-picker';
import { procesarArchivoExcel } from './ExcelParser';
import { generarPreguntasGemini } from './GeminiGenerator';
import GamePlayer from './GamePlayer';
import ThinkHootGame from './ThinkHootGame';
import EditorManual from './components/EditorManual';
import RuletaGame from './RuletaGame'; // Importamos el juego para modo prueba

// ==============================================================================
// 🔴 ZONA DE CLAVES (TUS CLAVES)
// ==============================================================================
const GEMINI_API_KEY = "AIzaSyCpap7E3iSXVYyfm8cEFqa-StlPUAfFpfY";
const GOOGLE_CLIENT_ID = "544528054442-j4bijvccdnk8gbbmhe1am6bgkubp62m0.apps.googleusercontent.com";
const GOOGLE_DEVELOPER_KEY = "AIzaSyDOFNi_V_HbCKS8bQWAsFqQKBEiBrBYQCw";
// ==============================================================================

const TIPOS_JUEGOS = {
    PASAPALABRA: { id: 'PASAPALABRA', label: 'Pasapalabra', color: '#3F51B5', camposConfig: [{ key: 'tiempoTotal', label: 'Tiempo Rosco (seg)', type: 'number', default: 150 }] },
    CAZABURBUJAS: { id: 'CAZABURBUJAS', label: 'Caza Burbujas', color: '#E91E63', camposConfig: [{ key: 'tiempoPregunta', label: 'Tiempo/preg (seg)', type: 'number', default: 20 }, { key: 'numPreguntas', label: 'Nº Preguntas', type: 'number', default: 10 }, { key: 'puntosAcierto', label: 'Pts Acierto', type: 'number', default: 10 }, { key: 'puntosFallo', label: 'Pts Fallo', type: 'number', default: 2 }] },
    APAREJADOS: { id: 'APAREJADOS', label: 'Aparejados', color: '#FF9800', camposConfig: [{ key: 'tiempoTotal', label: 'Tiempo Total (seg)', type: 'number', default: 60 }, { key: 'numParejas', label: 'Nº Parejas', type: 'number', default: 8 }, { key: 'puntosPareja', label: 'Pts Pareja', type: 'number', default: 10 }] },
    THINKHOOT: { id: 'THINKHOOT', label: 'ThinkHoot', color: '#9C27B0', camposConfig: [{ key: 'tiempoPregunta', label: 'Tiempo/preg (seg)', type: 'number', default: 30 }, { key: 'numPreguntas', label: 'Nº Preguntas', type: 'number', default: 10 }, { key: 'puntosMax', label: 'Puntos Max', type: 'number', default: 120 }, { key: 'puntosMin', label: 'Puntos Min', type: 'number', default: 30 }] },
    // 👇 NUEVO JUEGO AÑADIDO
    RULETA: { id: 'RULETA', label: 'La Ruleta', color: '#f1c40f', camposConfig: [{ key: 'tiempoTurno', label: 'Tiempo Turno (s)', type: 'number', default: 20 }] }
};

export default function ProfesorDashboard({ usuario, googleToken }) {
    // Estados Principales
    const [juegoSeleccionado, setJuegoSeleccionado] = useState('PASAPALABRA');
    const [vista, setVista] = useState('MIS_RECURSOS'); // 'MIS_RECURSOS' | 'BIBLIOTECA'

    // Datos
    const [recursos, setRecursos] = useState([]);
    const [bibliotecaRecursos, setBibliotecaRecursos] = useState([]);

    // Filtros Búsqueda
    const [filtrosInput, setFiltrosInput] = useState({ pais: '', region: '', poblacion: '', tema: '' });
    const [filtrosActivos, setFiltrosActivos] = useState({ pais: '', region: '', poblacion: '', tema: '' });

    const [cargando, setCargando] = useState(false);
    const [perfilProfesor, setPerfilProfesor] = useState(null);

    // Modales y UI
    const [mostrandoCrear, setMostrandoCrear] = useState(false);
    const [mostrandoEditorManual, setMostrandoEditorManual] = useState(false);
    const [recursoResultados, setRecursoResultados] = useState(null);
    const [recursoProbando, setRecursoProbando] = useState(null);
    const [recursoInspeccionando, setRecursoInspeccionando] = useState(null);
    const [listaResultados, setListaResultados] = useState([]);
    const [hostGameData, setHostGameData] = useState(null);

    // Editor State
    const [datosEditor, setDatosEditor] = useState({ id: null, titulo: '', temas: '', profesorNombre: '', pais: '', region: '', poblacion: '', config: {}, hojas: [], isPrivate: false });

    const [openPicker] = useDrivePicker();

    useEffect(() => {
        if (usuario) {
            cargarPerfilProfesor();
            if (vista === 'MIS_RECURSOS') cargarRecursosPropios();
            else cargarBiblioteca();
        }
    }, [usuario, juegoSeleccionado, vista]);

    // --- CARGA DE DATOS ---
    const cargarPerfilProfesor = async () => { try { const d = await getDoc(doc(db, "users", usuario.uid)); if (d.exists()) setPerfilProfesor(d.data()); } catch (e) { console.error(e) } };

    const cargarRecursosPropios = async () => {
        setCargando(true);
        try {
            const q = query(collection(db, "resources"), where("profesorUid", "==", usuario.uid), where("tipoJuego", "==", juegoSeleccionado));
            const s = await getDocs(q);
            setRecursos(s.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) { console.error(e) }
        setCargando(false);
    };

    const cargarBiblioteca = async () => {
        setCargando(true);
        try {
            const q = query(collection(db, "resources"), where("tipoJuego", "==", juegoSeleccionado), where("isPrivate", "==", false), orderBy("playCount", "desc"));
            const s = await getDocs(q);
            const docs = s.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.profesorUid !== usuario.uid);
            setBibliotecaRecursos(docs);
        } catch (e) { console.error("Error Biblio:", e); }
        setCargando(false);
    };

    // --- FILTRADO ---
    const getRecursosFiltrados = () => {
        return bibliotecaRecursos.filter(r => {
            const clean = (t) => t ? t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
            const f = filtrosActivos;
            const matchPais = !f.pais || clean(r.pais).includes(clean(f.pais));
            const matchRegion = !f.region || clean(r.region).includes(clean(f.region));
            const matchPob = !f.poblacion || clean(r.poblacion).includes(clean(f.poblacion));
            const matchTema = !f.tema || clean(r.titulo).includes(clean(f.tema)) || (r.temas && clean(r.temas).includes(clean(f.tema)));
            return matchPais && matchRegion && matchPob && matchTema;
        });
    };

    // --- ACCIONES ---
    const ejecutarBusqueda = () => { setFiltrosActivos(filtrosInput); };
    const limpiarBusqueda = () => { const vacio = { pais: '', region: '', poblacion: '', tema: '' }; setFiltrosInput(vacio); setFiltrosActivos(vacio); };
    const incrementarPopularidad = async (recurso) => { try { await updateDoc(doc(db, "resources", recurso.id), { playCount: (recurso.playCount || 0) + 1 }); } catch (e) { console.log("Error stats"); } };

    const copiarRecurso = async (recursoOriginal) => {
        if (!confirm(`¿Copiar "${recursoOriginal.titulo}" a tus recursos?`)) return;
        try {
            const copia = { ...recursoOriginal, profesorUid: usuario.uid, profesorNombre: perfilProfesor?.nombre || usuario.displayName, titulo: `${recursoOriginal.titulo} (Copia)`, playCount: 0, isPrivate: true, origen: 'biblioteca', fechaCreacion: new Date(), accessCode: generarCodigoAcceso() };
            delete copia.id;
            await addDoc(collection(db, "resources"), copia);
            alert("¡Copiado!"); setVista('MIS_RECURSOS');
        } catch (e) { alert("Error: " + e.message); }
    };

    // --- GESTIÓN CRUD ---
    const iniciarCreacion = () => {
        const nombre = (perfilProfesor && perfilProfesor.nombre) ? perfilProfesor.nombre : (usuario.displayName || "Profesor");
        const loc = perfilProfesor || {};
        const conf = {};
        TIPOS_JUEGOS[juegoSeleccionado].camposConfig.forEach(c => conf[c.key] = c.default);
        setDatosEditor({ id: null, titulo: '', temas: '', profesorNombre: nombre, pais: loc.pais || '', region: loc.region || '', poblacion: loc.poblacion || '', config: conf, hojas: [{ nombreHoja: 'Hoja 1', preguntas: [] }], isPrivate: false });
        setMostrandoCrear(true);
    };

    const abrirEdicion = (recurso) => {
        const data = JSON.parse(JSON.stringify(recurso));
        if (!data.hojas || data.hojas.length === 0) data.hojas = [{ nombreHoja: 'General', preguntas: [] }];
        if (!data.config) data.config = {};
        setDatosEditor(data);
        setMostrandoEditorManual(true);
    };

    const guardarRecursoFinal = async () => {
        if (!datosEditor.titulo) return alert("Falta Título");
        if (datosEditor.hojas.length === 0) return alert("Faltan Hojas");
        const totalPreguntas = datosEditor.hojas.reduce((acc, h) => acc + h.preguntas.length, 0);
        if (totalPreguntas === 0) return alert("Añade preguntas.");
        try {
            const dataToSave = { ...datosEditor, profesorUid: usuario.uid, tipoJuego: juegoSeleccionado, fechaCreacion: new Date() };
            if (datosEditor.id) { await updateDoc(doc(db, "resources", datosEditor.id), dataToSave); alert("Actualizado"); }
            else { dataToSave.accessCode = generarCodigoAcceso(); dataToSave.playCount = 0; dataToSave.origen = 'manual'; await addDoc(collection(db, "resources"), dataToSave); alert(`Creado: ${dataToSave.accessCode}`); }
            setMostrandoEditorManual(false); cargarRecursosPropios();
        } catch (error) { alert("Error: " + error.message); }
    };

    const eliminarRecurso = async (id) => { if (confirm("¿Borrar?")) { await deleteDoc(doc(db, "resources", id)); setRecursos(prev => prev.filter(r => r.id !== id)); } };
    const generarCodigoAcceso = () => { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let r = ''; for (let i = 0; i < 5; i++)r += c.charAt(Math.floor(Math.random() * c.length)); return r; };
    const mostrarCodigo = async (r) => { if (r.accessCode) return alert(`🔑 ${r.accessCode}`); const newCode = generarCodigoAcceso(); await updateDoc(doc(db, "resources", r.id), { accessCode: newCode }); alert(`Nuevo: ${newCode}`); cargarRecursosPropios(); };

    // --- DRIVE / EXCEL / IA ---
    const handleOpenPicker = () => {
        openPicker({
            clientId: GOOGLE_CLIENT_ID, developerKey: GOOGLE_DEVELOPER_KEY, viewId: "DOCS", token: googleToken, showUploadView: true, showUploadFolders: true, supportDrives: true, multiselect: false, mimetypes: ["application/vnd.google-apps.spreadsheet"],
            callbackFunction: async (data) => {
                if (data.action === 'picked') {
                    try {
                        const fileId = data.docs[0].id;
                        const blob = await descargarGoogleSheet(fileId, googleToken);
                        const hojas = await procesarArchivoExcel(blob, juegoSeleccionado);
                        setDatosEditor(prev => ({ ...prev, hojas: hojas, titulo: data.docs[0].name }));
                        setMostrandoCrear(false); setMostrandoEditorManual(true);
                    } catch (e) { alert("Error Drive: " + e.message); }
                }
            },
        });
    };

    const descargarGoogleSheet = async (fileId, token) => {
        const url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`;
        const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!resp.ok) throw new Error("Error descargando");
        return await resp.blob();
    };

    const handleFileUpload = async (e) => {
        const f = e.target.files[0]; if (!f) return;
        try { const hojas = await procesarArchivoExcel(f, juegoSeleccionado); setDatosEditor(prev => ({ ...prev, hojas: hojas, titulo: f.name.split('.')[0] })); setMostrandoCrear(false); setMostrandoEditorManual(true); } catch (e) { alert(e.message); }
    };

    const procesarCreacionIA = async () => {
        const tema = prompt("Tema para la IA:"); if (!tema) return;
        try { alert("Generando..."); const hojas = await generarPreguntasGemini(GEMINI_API_KEY, tema, juegoSeleccionado); setDatosEditor(prev => ({ ...prev, hojas: hojas, titulo: tema })); setMostrandoCrear(false); setMostrandoEditorManual(true); } catch (e) { alert(e.message); }
    };

    // --- JUEGO EN VIVO ---
    const prepararJuegoEnVivo = (recurso) => { incrementarPopularidad(recurso); const hojas = recurso.hojas.map(h => h.nombreHoja); hojas.unshift("General"); setHostGameData({ recurso, fase: 'CONFIG_HOST', hojasDisponibles: hojas, hojaElegida: 'General' }); };
    const confirmarLanzamientoHost = async () => {
        const codigoSala = Math.floor(100000 + Math.random() * 900000).toString();
        const rec = hostGameData.recurso;
        let pool = [];
        if (hostGameData.hojaElegida === 'General') { rec.hojas.forEach(h => pool.push(...h.preguntas)); } else { const hObj = rec.hojas.find(h => h.nombreHoja === hostGameData.hojaElegida); if (hObj) pool = [...hObj.preguntas]; }
        pool.sort(() => Math.random() - 0.5);
        const preguntasFinales = pool.slice(0, parseInt(rec.config?.numPreguntas) || 10).map(p => ({ q: p.pregunta, a: p.correcta || p.respuesta, tipo: (p.incorrectas?.length > 0) ? 'opciones' : 'texto', opcionesFijas: (p.incorrectas?.length > 0) ? [p.correcta || p.respuesta, ...p.incorrectas].sort(() => Math.random() - 0.5) : [] }));
        if (preguntasFinales.length === 0) return alert("Sin preguntas.");
        await setDoc(doc(db, "live_games", codigoSala), { hostId: usuario.uid, recursoId: rec.id, recursoTitulo: rec.titulo, profesorNombre: rec.profesorNombre, config: rec.config, preguntas: preguntasFinales, estado: 'LOBBY', indicePregunta: 0, jugadores: {}, respuestasRonda: {}, timestamp: new Date() });
        setHostGameData({ ...hostGameData, codigoSala, fase: 'LIVE' });
    };

    const abrirResultados = async (recurso) => { setRecursoResultados(recurso); setListaResultados([]); try { const q = query(collection(db, "ranking"), where("recursoId", "==", recurso.id)); const s = await getDocs(q); setListaResultados(s.docs.map(d => d.data())); } catch (e) { console.error(e); } };
    const descargarCSV = () => { if (listaResultados.length === 0) return alert("Sin datos"); let csv = "data:text/csv;charset=utf-8,Jugador,Hoja,Puntuación,Fecha\n"; listaResultados.forEach(r => csv += `${r.jugador},${r.categoria || '-'},${r.aciertos || r.puntuacion},${r.fecha ? new Date(r.fecha.seconds * 1000).toLocaleDateString() : '-'}\n`); const link = document.createElement("a"); link.href = encodeURI(csv); link.download = "notas.csv"; link.click(); };
    const probarJuego = (recurso) => { incrementarPopularidad(recurso); setRecursoProbando(recurso); };

    // --- RENDER ---
    if (hostGameData?.fase === 'LIVE') return <ThinkHootGame isHost={true} codigoSala={hostGameData.codigoSala} usuario={usuario} onExit={() => setHostGameData(null)} />;
    if (recursoProbando) return <div style={{ background: '#2f3640', minHeight: '100vh' }}><div style={{ background: '#f1c40f', padding: '10px', textAlign: 'center' }}>MODO PRUEBA <button onClick={() => setRecursoProbando(null)} style={{ marginLeft: 20 }}>Cerrar</button></div><GamePlayer recurso={recursoProbando} usuario={usuario} alTerminar={() => setRecursoProbando(null)} /></div>;

    return (
        <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'Arial' }}>
            <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>{Object.values(TIPOS_JUEGOS).map(j => (<button key={j.id} onClick={() => setJuegoSeleccionado(j.id)} style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', background: juegoSeleccionado === j.id ? j.color : '#eee', color: juegoSeleccionado === j.id ? 'white' : '#555', cursor: 'pointer', fontWeight: 'bold' }}>{j.label}</button>))}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>{vista === 'MIS_RECURSOS' ? `Mis Recursos: ${TIPOS_JUEGOS[juegoSeleccionado].label}` : `Biblioteca: ${TIPOS_JUEGOS[juegoSeleccionado].label}`}</h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => setVista(vista === 'MIS_RECURSOS' ? 'BIBLIOTECA' : 'MIS_RECURSOS')} style={{ background: '#27ae60', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold' }}>{vista === 'MIS_RECURSOS' ? <><Globe size={18} /> Ir a Biblioteca</> : <><User size={18} /> Mis Recursos</>}</button>
                    {vista === 'MIS_RECURSOS' && (<button onClick={iniciarCreacion} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#2196F3', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}><Plus size={18} /> Crear Nuevo</button>)}
                </div>
            </div>

            {vista === 'BIBLIOTECA' && (
                <div style={{ background: '#f9f9f9', padding: '15px', borderRadius: '10px', marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', color: '#666' }}><Search size={16} /> Filtros:</span>
                    <input placeholder="Tema..." value={filtrosInput.tema} onChange={e => setFiltrosInput({ ...filtrosInput, tema: e.target.value })} style={inputFilter} />
                    <input placeholder="País" value={filtrosInput.pais} onChange={e => setFiltrosInput({ ...filtrosInput, pais: e.target.value })} style={inputFilter} />
                    <button onClick={ejecutarBusqueda} style={{ background: '#2980b9', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer' }}><Search size={16} /></button>
                    <button onClick={limpiarBusqueda} style={{ background: '#bdc3c7', color: 'white', border: 'none', padding: '8px', borderRadius: '5px' }}><RotateCcw size={16} /></button>
                </div>
            )}

            {(() => {
                const lista = vista === 'MIS_RECURSOS' ? recursos : getRecursosFiltrados();
                if (lista.length === 0) return <div style={{ textAlign: 'center', padding: '40px', background: '#f5f5f5', border: '2px dashed #ccc' }}><h3>No hay recursos</h3></div>;
                return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                        {lista.map(rec => (
                            <div key={rec.id} style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', borderLeft: `6px solid ${TIPOS_JUEGOS[juegoSeleccionado].color}`, position: 'relative' }}>
                                {vista === 'BIBLIOTECA' && <div style={{ position: 'absolute', top: '10px', right: '10px', background: '#f1c40f', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold' }}><Users size={12} /> {rec.playCount || 0}</div>}
                                <h3 style={{ margin: '0 0 5px 0', fontSize: '18px' }}>{rec.titulo}</h3>
                                {rec.temas && <p style={{ fontSize: '12px', color: '#666' }}>{rec.temas}</p>}
                                {vista === 'BIBLIOTECA' && <div style={{ fontSize: '11px', color: '#888', marginBottom: '10px' }}>📍 {rec.poblacion || 'Sin loc.'}, {rec.pais || 'Sin país'} | 👨‍🏫 {rec.profesorNombre}</div>}
                                <div style={{ display: 'flex', gap: '5px', marginTop: '10px' }}>
                                    {vista === 'MIS_RECURSOS' ? (
                                        <>
                                            <button title="Probar" onClick={() => probarJuego(rec)} style={btnStyle('#E1BEE7', '#8E24AA')}><Gamepad2 size={18} /></button>
                                            <button title="Código" onClick={() => mostrarCodigo(rec)} style={btnStyle('#FFF3E0', '#FF9800')}><Key size={18} /></button>
                                            <button title="Editar" onClick={() => abrirEdicion(rec)} style={btnStyle('#E3F2FD', '#1565C0')}><Pencil size={18} /></button>
                                            <button title="Resultados" onClick={() => abrirResultados(rec)} style={btnStyle('#E8F5E9', '#2E7D32')}><BarChart2 size={18} /></button>
                                            <button title="Borrar" onClick={() => eliminarRecurso(rec.id)} style={btnStyle('#FFEBEE', '#C62828')}><Trash2 size={18} /></button>
                                        </>
                                    ) : (
                                            <>
                                                <button onClick={() => probarJuego(rec)} style={{ ...btnStyle('#E1BEE7', '#8E24AA'), flex: 2 }}><Gamepad2 size={18} /> Probar</button>
                                                <button onClick={() => setRecursoInspeccionando(rec)} style={btnStyle('#eee', '#333')}><Eye size={18} /></button>
                                                <button onClick={() => copiarRecurso(rec)} style={{ ...btnStyle('#27ae60', 'white'), flex: 2 }}><Copy size={18} /> Copiar</button>
                                            </>
                                        )}
                                </div>
                            </div>
                        ))}
                    </div>
                );
            })()}

            {mostrandoCrear && (<ModalOverlay onClose={() => setMostrandoCrear(false)}><h2>Nuevo {TIPOS_JUEGOS[juegoSeleccionado].label}</h2><div style={{ marginBottom: '10px' }}><label style={lbl}>Título</label><input value={datosEditor.titulo} onChange={e => setDatosEditor({ ...datosEditor, titulo: e.target.value })} style={inputStyle} /></div><div style={{ marginBottom: '10px' }}><label style={lbl}>Profesor</label><input value={datosEditor.profesorNombre} onChange={e => setDatosEditor({ ...datosEditor, profesorNombre: e.target.value })} style={inputStyle} /></div><div style={{ marginBottom: '10px' }}><label style={lbl}>Temas</label><input value={datosEditor.temas} onChange={e => setDatosEditor({ ...datosEditor, temas: e.target.value })} style={inputStyle} /></div><div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}><button onClick={() => { setMostrandoCrear(false); setMostrandoEditorManual(true); }} style={{ ...actionBtnStyle('#2196F3'), flex: 1 }}><Edit3 size={18} /> Manual</button><button onClick={procesarCreacionIA} style={{ ...actionBtnStyle('#673AB7'), flex: 1 }}><Bot size={18} /> IA</button><button onClick={handleFileUpload} style={{ ...actionBtnStyle('#107C41'), flex: 1 }}><FileSpreadsheet size={18} /> Excel</button></div><div style={{ marginTop: '10px' }}><button onClick={handleOpenPicker} className="notranslate" translate="no" style={{ ...actionBtnStyle('#FFC107'), width: '100%', color: 'black', display: 'flex', justifyContent: 'center', gap: '10px' }}>Google Drive</button></div></ModalOverlay>)}
            {hostGameData?.fase === 'CONFIG_HOST' && (<ModalOverlay onClose={() => setHostGameData(null)}><h2>📡 Lanzar en Vivo</h2><select value={hostGameData.hojaElegida} onChange={e => setHostGameData({ ...hostGameData, hojaElegida: e.target.value })} style={{ width: '100%', padding: '10px', marginBottom: '20px' }}>{hostGameData.hojasDisponibles.map(h => <option key={h} value={h}>{h}</option>)}</select><button onClick={confirmarLanzamientoHost} style={{ width: '100%', padding: '15px', background: '#9C27B0', color: 'white', border: 'none', borderRadius: '5px' }}>🚀 GENERAR CÓDIGO</button></ModalOverlay>)}
            {mostrandoEditorManual && <EditorManual datos={datosEditor} setDatos={setDatosEditor} configJuego={TIPOS_JUEGOS[juegoSeleccionado]} onClose={() => setMostrandoEditorManual(false)} onSave={guardarRecursoFinal} />}
            {recursoResultados && (<ModalOverlay onClose={() => setRecursoResultados(null)}><h2>Resultados</h2><button onClick={descargarCSV} style={{ background: '#4CAF50', color: 'white', border: 'none', padding: '10px', marginBottom: '15px' }}>Descargar CSV</button><div style={{ maxHeight: '300px', overflowY: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr style={{ background: '#f0f0f0', textAlign: 'left' }}><th style={{ padding: '8px' }}>Alumno</th><th>Hoja</th><th>Nota</th></tr></thead><tbody>{listaResultados.map((res, i) => (<tr key={i} style={{ borderBottom: '1px solid #ddd' }}><td style={{ padding: '8px' }}>{res.jugador}</td><td>{res.categoria}</td><td><b>{res.aciertos || res.puntuacion}</b></td></tr>))}</tbody></table></div></ModalOverlay>)}
            {recursoInspeccionando && (<ModalOverlay onClose={() => setRecursoInspeccionando(null)}><h2>Inspeccionando: {recursoInspeccionando.titulo}</h2><div style={{ maxHeight: '400px', overflowY: 'auto', background: '#f5f5f5', padding: '10px', borderRadius: '10px' }}>{recursoInspeccionando.hojas.map((h, i) => (<div key={i} style={{ marginBottom: '15px' }}><h4 style={{ borderBottom: '1px solid #ccc', paddingBottom: '5px' }}>{h.nombreHoja} ({h.preguntas.length} preguntas)</h4><ul style={{ paddingLeft: '20px' }}>{h.preguntas.map((p, j) => (<li key={j} style={{ fontSize: '12px', marginBottom: '5px' }}><b>{p.pregunta || p.letra}</b> {p.respuesta || p.correcta ? `➡ ${p.respuesta || p.correcta}` : ''}</li>))}</ul></div>))}</div><button onClick={() => { setRecursoInspeccionando(null); copiarRecurso(recursoInspeccionando); }} style={{ ...actionBtnStyle('#27ae60'), width: '100%', marginTop: '10px' }}>📥 COPIAR ESTE RECURSO</button></ModalOverlay>)}
            <input type="file" id="input-excel-oculto" accept=".xlsx" style={{ display: 'none' }} onChange={handleFileUpload} />
        </div>
    );
}

// Estilos
const ModalOverlay = ({ children, onClose }) => (<div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}><div style={{ background: 'white', padding: '30px', borderRadius: '12px', width: '90%', maxWidth: '500px', position: 'relative' }}><button onClick={onClose} style={{ position: 'absolute', top: '10px', right: '10px', border: 'none', background: 'none', cursor: 'pointer' }}><X /></button>{children}</div></div>);
const btnStyle = (bg, color) => ({ flex: 1, padding: '8px', background: bg, color: color, border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' });
const actionBtnStyle = (bg) => ({ padding: '10px 20px', background: bg, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontWeight: 'bold' });
const inputStyle = { width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc', boxSizing: 'border-box', marginBottom: '10px' };
const inputFilter = { padding: '8px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '13px', width: '120px' };
const lbl = { fontSize: '12px', color: '#666' };