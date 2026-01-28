import { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, where, getDocs, deleteDoc, doc, addDoc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { Trash2, Plus, FileSpreadsheet, Bot, BarChart2, Download, Save, X, Pencil, Key, Gamepad2, ArrowUp, ArrowDown, FolderPlus, Edit3, Zap } from 'lucide-react';
import useDrivePicker from 'react-google-drive-picker';
import { procesarArchivoExcel } from './ExcelParser';
import { generarPreguntasGemini } from './GeminiGenerator';
import GamePlayer from './GamePlayer';
import ThinkHootGame from './ThinkHootGame';
import EditorManual from './components/EditorManual'; // <--- IMPORTAMOS EL EDITOR

// ==============================================================================
// 🔴 ZONA DE CLAVES
// ==============================================================================

const GEMINI_API_KEY = "AIzaSyCpap7E3iSXVYyfm8cEFqa-StlPUAfFpfY";
const GOOGLE_CLIENT_ID = "544528054442-j4bijvccdnk8gbbmhe1am6bgkubp62m0.apps.googleusercontent.com";
const GOOGLE_DEVELOPER_KEY = "AIzaSyBzPXY7_iFaMjiw824Pa8HnO4nFBtK0r9s";
// ==============================================================================

const TIPOS_JUEGOS = {
    PASAPALABRA: { id: 'PASAPALABRA', label: 'Pasapalabra', color: '#3F51B5', camposConfig: [{ key: 'tiempoTotal', label: 'Tiempo Rosco (seg)', type: 'number', default: 150 }] },
    CAZABURBUJAS: { id: 'CAZABURBUJAS', label: 'Caza Burbujas', color: '#E91E63', camposConfig: [{ key: 'tiempoPregunta', label: 'Tiempo/preg (seg)', type: 'number', default: 20 }, { key: 'numPreguntas', label: 'Nº Preguntas', type: 'number', default: 10 }, { key: 'puntosAcierto', label: 'Pts Acierto', type: 'number', default: 10 }, { key: 'puntosFallo', label: 'Pts Fallo', type: 'number', default: 2 }] },
    APAREJADOS: { id: 'APAREJADOS', label: 'Aparejados', color: '#FF9800', camposConfig: [{ key: 'tiempoTotal', label: 'Tiempo Total (seg)', type: 'number', default: 60 }, { key: 'numParejas', label: 'Nº Parejas', type: 'number', default: 8 }, { key: 'puntosPareja', label: 'Pts Pareja', type: 'number', default: 10 }] },
    THINKHOOT: { id: 'THINKHOOT', label: 'ThinkHoot', color: '#9C27B0', camposConfig: [{ key: 'tiempoPregunta', label: 'Tiempo/preg (seg)', type: 'number', default: 30 }, { key: 'numPreguntas', label: 'Nº Preguntas', type: 'number', default: 10 }, { key: 'puntosMax', label: 'Puntos Max', type: 'number', default: 120 }, { key: 'puntosMin', label: 'Puntos Min', type: 'number', default: 30 }] }
};

export default function ProfesorDashboard({ usuario, googleToken }) {
    const [juegoSeleccionado, setJuegoSeleccionado] = useState('PASAPALABRA');
    const [recursos, setRecursos] = useState([]);
    const [cargando, setCargando] = useState(false);
    const [perfilProfesor, setPerfilProfesor] = useState(null);

    // UI States
    const [mostrandoCrear, setMostrandoCrear] = useState(false);
    const [mostrandoEditorManual, setMostrandoEditorManual] = useState(false);
    const [recursoResultados, setRecursoResultados] = useState(null);
    const [recursoProbando, setRecursoProbando] = useState(null);
    const [listaResultados, setListaResultados] = useState([]);
    const [hostGameData, setHostGameData] = useState(null);

    // Estado del Editor
    const [datosEditor, setDatosEditor] = useState({ id: null, titulo: '', temas: '', profesorNombre: '', pais: '', region: '', poblacion: '', config: {}, hojas: [] });

    const [openPicker] = useDrivePicker();

    useEffect(() => {
        if (usuario) {
            cargarRecursos();
            cargarPerfilProfesor();
        }
    }, [usuario, juegoSeleccionado]);

    // --- CRUD FIRESTORE ---
    const cargarPerfilProfesor = async () => { try { const d = await getDoc(doc(db, "users", usuario.uid)); if (d.exists()) setPerfilProfesor(d.data()); } catch (e) { console.error(e) } };
    const cargarRecursos = async () => { setCargando(true); try { const q = query(collection(db, "resources"), where("profesorUid", "==", usuario.uid), where("tipoJuego", "==", juegoSeleccionado)); const s = await getDocs(q); setRecursos(s.docs.map(d => ({ id: d.id, ...d.data() }))); } catch (e) { console.error(e) } setCargando(false); };

    // --- INICIAR ACCIONES ---
    const iniciarCreacion = () => {
        const nombre = (perfilProfesor && perfilProfesor.nombre) ? perfilProfesor.nombre : (usuario.displayName || "Profesor");
        const loc = perfilProfesor || {};
        const conf = {};
        TIPOS_JUEGOS[juegoSeleccionado].camposConfig.forEach(c => conf[c.key] = c.default);
        setDatosEditor({ id: null, titulo: '', temas: '', profesorNombre: nombre, pais: loc.pais || '', region: loc.region || '', poblacion: loc.poblacion || '', config: conf, hojas: [{ nombreHoja: 'Hoja 1', preguntas: [] }] });
        setMostrandoCrear(true);
    };

    const abrirEdicion = (recurso) => {
        const data = JSON.parse(JSON.stringify(recurso));
        if (!data.hojas || data.hojas.length === 0) data.hojas = [{ nombreHoja: 'General', preguntas: [] }];
        if (!data.config) data.config = {};
        setDatosEditor(data);
        setMostrandoEditorManual(true);
    };

    // --- GUARDADO ---
    const guardarRecursoFinal = async () => {
        if (!datosEditor.titulo) return alert("❌ El título es obligatorio");
        if (datosEditor.hojas.length === 0) return alert("❌ Debes tener al menos una hoja");
        const totalPreguntas = datosEditor.hojas.reduce((acc, h) => acc + h.preguntas.length, 0);
        if (totalPreguntas === 0) return alert("❌ Añade al menos una pregunta.");

        try {
            const dataToSave = {
                titulo: datosEditor.titulo,
                temas: datosEditor.temas,
                profesorUid: usuario.uid,
                profesorNombre: datosEditor.profesorNombre,
                tipoJuego: juegoSeleccionado,
                pais: datosEditor.pais, region: datosEditor.region, poblacion: datosEditor.poblacion,
                config: datosEditor.config,
                hojas: datosEditor.hojas,
                fechaCreacion: new Date()
            };

            if (datosEditor.id) {
                await updateDoc(doc(db, "resources", datosEditor.id), dataToSave);
                alert("✅ Recurso Actualizado");
            } else {
                dataToSave.accessCode = generarCodigoAcceso();
                dataToSave.origen = 'manual';
                await addDoc(collection(db, "resources"), dataToSave);
                alert(`✅ Creado! Código: ${dataToSave.accessCode}`);
            }
            setMostrandoEditorManual(false);
            cargarRecursos();
        } catch (error) { alert("Error al guardar: " + error.message); }
    };

    // --- JUEGO EN VIVO (THINKHOOT) ---
    const prepararJuegoEnVivo = (recurso) => {
        const hojas = recurso.hojas.map(h => h.nombreHoja);
        hojas.unshift("General");
        setHostGameData({ recurso, fase: 'CONFIG_HOST', hojasDisponibles: hojas, hojaElegida: 'General' });
    };

    const confirmarLanzamientoHost = async () => {
        const codigoSala = Math.floor(100000 + Math.random() * 900000).toString();
        const rec = hostGameData.recurso;
        let pool = [];
        if (hostGameData.hojaElegida === 'General') { rec.hojas.forEach(h => pool.push(...h.preguntas)); }
        else { const hObj = rec.hojas.find(h => h.nombreHoja === hostGameData.hojaElegida); if (hObj) pool = [...hObj.preguntas]; }

        pool.sort(() => Math.random() - 0.5);
        const limit = parseInt(rec.config?.numPreguntas) || 10;
        const preguntasRaw = pool.slice(0, limit);

        // Pre-barajar opciones
        const preguntasFinales = preguntasRaw.map(p => {
            const esMultiple = (p.incorrectas && Array.isArray(p.incorrectas) && p.incorrectas[0] !== '');
            let opcionesFijas = [];
            if (esMultiple) opcionesFijas = [p.correcta || p.respuesta, ...p.incorrectas].sort(() => Math.random() - 0.5);
            return { q: p.pregunta, a: p.correcta || p.respuesta, tipo: esMultiple ? 'opciones' : 'texto', opcionesFijas };
        });

        if (preguntasFinales.length === 0) return alert("Esta hoja no tiene preguntas.");

        await setDoc(doc(db, "live_games", codigoSala), {
            hostId: usuario.uid,
            recursoId: rec.id,
            recursoTitulo: rec.titulo,
            profesorNombre: rec.profesorNombre || usuario.displayName,
            config: rec.config,
            preguntas: preguntasFinales,
            estado: 'LOBBY',
            indicePregunta: 0,
            jugadores: {},
            respuestasRonda: {},
            timestamp: new Date()
        });
        setHostGameData({ ...hostGameData, codigoSala, fase: 'LIVE' });
    };

    // --- AUXILIARES ---
    const eliminarRecurso = async (id) => { if (confirm("¿Borrar?")) { await deleteDoc(doc(db, "resources", id)); setRecursos(prev => prev.filter(r => r.id !== id)); } };
    const generarCodigoAcceso = () => { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let r = ''; for (let i = 0; i < 5; i++)r += c.charAt(Math.floor(Math.random() * c.length)); return r; };
    const mostrarCodigo = async (r) => {
        if (r.accessCode) return alert(`🔑 ${r.accessCode}`);
        const newCode = generarCodigoAcceso();
        await updateDoc(doc(db, "resources", r.id), { accessCode: newCode });
        alert(`🔑 GENERADO: ${newCode}`); cargarRecursos();
    };

    const handleOpenPicker = () => {
        if (!googleToken) return alert("Reinicia sesión.");
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

    const handleFileUpload = async (e) => {
        const f = e.target.files[0]; if (!f) return;
        try { const hojas = await procesarArchivoExcel(f, juegoSeleccionado); setDatosEditor(prev => ({ ...prev, hojas: hojas, titulo: f.name.split('.')[0] })); setMostrandoCrear(false); setMostrandoEditorManual(true); } catch (e) { alert(e.message); }
    };

    const descargarGoogleSheet = async (fileId, token) => {
        const url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`;
        const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!resp.ok) throw new Error("Error descargando");
        return await resp.blob();
    };

    const procesarCreacionIA = async () => {
        const tema = prompt("Tema para la IA:"); if (!tema) return;
        try { alert("🤖 Generando..."); const hojas = await generarPreguntasGemini(GEMINI_API_KEY, tema, juegoSeleccionado); setDatosEditor(prev => ({ ...prev, hojas: hojas, titulo: tema })); setMostrandoCrear(false); setMostrandoEditorManual(true); } catch (e) { alert(e.message); }
    };

    const abrirResultados = async (recurso) => {
        setRecursoResultados(recurso); setListaResultados([]);
        try { const q = query(collection(db, "ranking"), where("recursoId", "==", recurso.id)); const s = await getDocs(q); setListaResultados(s.docs.map(d => d.data())); } catch (e) { console.error(e); }
    };

    const descargarCSV = () => {
        if (listaResultados.length === 0) return alert("Sin datos");
        let csv = "data:text/csv;charset=utf-8,Jugador,Hoja,Puntuación,Fecha\n";
        listaResultados.forEach(r => csv += `${r.jugador},${r.categoria || '-'},${r.aciertos || r.puntuacion},${r.fecha ? new Date(r.fecha.seconds * 1000).toLocaleDateString() : '-'}\n`);
        const link = document.createElement("a"); link.href = encodeURI(csv); link.download = "notas.csv"; link.click();
    };

    if (hostGameData?.fase === 'LIVE') return <ThinkHootGame isHost={true} codigoSala={hostGameData.codigoSala} usuario={usuario} onExit={() => setHostGameData(null)} />;
    if (recursoProbando) return <div style={{ background: '#2f3640', minHeight: '100vh' }}><div style={{ background: '#f1c40f', padding: '10px', textAlign: 'center' }}>MODO PRUEBA <button onClick={() => setRecursoProbando(null)}>Cerrar</button></div><GamePlayer recurso={recursoProbando} usuario={usuario} alTerminar={() => setRecursoProbando(null)} /></div>;

    return (
        <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'Arial' }}>
            <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
                {Object.values(TIPOS_JUEGOS).map(j => (
                    <button key={j.id} onClick={() => setJuegoSeleccionado(j.id)} style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', background: juegoSeleccionado === j.id ? j.color : '#eee', color: juegoSeleccionado === j.id ? 'white' : '#555', cursor: 'pointer', fontWeight: 'bold' }}>{j.label}</button>
                ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>{TIPOS_JUEGOS[juegoSeleccionado].label}</h2>
                <button onClick={iniciarCreacion} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#2196F3', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}><Plus size={18} /> Crear Nuevo</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                {recursos.map(rec => (
                    <div key={rec.id} style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', borderLeft: `6px solid ${TIPOS_JUEGOS[juegoSeleccionado].color}` }}>
                        <h3>{rec.titulo}</h3>
                        <div style={{ display: 'flex', gap: '5px', marginTop: '10px' }}>
                            {juegoSeleccionado === 'THINKHOOT' ? <button title="En Vivo" onClick={() => prepararJuegoEnVivo(rec)} style={{ background: '#9C27B0', color: 'white', border: 'none', padding: '8px', borderRadius: '5px' }}><Zap size={18} /></button> : <button title="Probar" onClick={() => setRecursoProbando(rec)} style={btnStyle('#E1BEE7', '#8E24AA')}><Gamepad2 size={18} /></button>}
                            <button onClick={() => mostrarCodigo(rec)} style={btnStyle('#FFF3E0', '#FF9800')}><Key size={18} /></button>
                            <button onClick={() => abrirEdicion(rec)} style={btnStyle('#E3F2FD', '#1565C0')}><Pencil size={18} /></button>
                            <button onClick={() => abrirResultados(rec)} style={btnStyle('#E8F5E9', '#2E7D32')}><BarChart2 size={18} /></button>
                            <button onClick={() => eliminarRecurso(rec.id)} style={btnStyle('#FFEBEE', '#C62828')}><Trash2 size={18} /></button>
                        </div>
                    </div>
                ))}
            </div>

            {mostrandoCrear && (
                <ModalOverlay onClose={() => setMostrandoCrear(false)}>
                    <h2>Nuevo {TIPOS_JUEGOS[juegoSeleccionado].label}</h2>
                    <div style={{ marginBottom: '10px' }}><label style={lbl}>Título</label><input value={datosEditor.titulo} onChange={e => setDatosEditor({ ...datosEditor, titulo: e.target.value })} style={inputStyle} /></div>
                    <div style={{ marginBottom: '10px' }}><label style={lbl}>Profesor</label><input value={datosEditor.profesorNombre} onChange={e => setDatosEditor({ ...datosEditor, profesorNombre: e.target.value })} style={inputStyle} /></div>
                    <div style={{ marginBottom: '10px' }}><label style={lbl}>Temas</label><input value={datosEditor.temas} onChange={e => setDatosEditor({ ...datosEditor, temas: e.target.value })} style={inputStyle} /></div>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                        <button onClick={() => { setMostrandoCrear(false); setMostrandoEditorManual(true); }} style={{ ...actionBtnStyle('#2196F3'), flex: 1 }}><Edit3 size={18} /> Manual</button>
                        <button onClick={procesarCreacionIA} style={{ ...actionBtnStyle('#673AB7'), flex: 1 }}><Bot size={18} /> IA</button>
                        <button onClick={handleFileUpload} style={{ ...actionBtnStyle('#107C41'), flex: 1 }}><FileSpreadsheet size={18} /> Excel</button>
                    </div>
                    <div style={{ marginTop: '10px' }}><button onClick={handleOpenPicker} style={{ ...actionBtnStyle('#FFC107'), width: '100%', color: 'black' }}>Drive</button></div>
                </ModalOverlay>
            )}

            {hostGameData?.fase === 'CONFIG_HOST' && (
                <ModalOverlay onClose={() => setHostGameData(null)}>
                    <h2>📡 Lanzar en Vivo</h2>
                    <select value={hostGameData.hojaElegida} onChange={e => setHostGameData({ ...hostGameData, hojaElegida: e.target.value })} style={{ width: '100%', padding: '10px', marginBottom: '20px' }}>{hostGameData.hojasDisponibles.map(h => <option key={h} value={h}>{h}</option>)}</select>
                    <button onClick={confirmarLanzamientoHost} style={{ width: '100%', padding: '15px', background: '#9C27B0', color: 'white', border: 'none', borderRadius: '5px' }}>🚀 GENERAR CÓDIGO</button>
                </ModalOverlay>
            )}

            {mostrandoEditorManual && <EditorManual datos={datosEditor} setDatos={setDatosEditor} configJuego={TIPOS_JUEGOS[juegoSeleccionado]} onClose={() => setMostrandoEditorManual(false)} onSave={guardarRecursoFinal} />}

            {recursoResultados && (
                <ModalOverlay onClose={() => setRecursoResultados(null)}>
                    <h2>Resultados</h2>
                    <button onClick={descargarCSV} style={{ background: '#4CAF50', color: 'white', border: 'none', padding: '10px', marginBottom: '15px' }}>Descargar CSV</button>
                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr style={{ background: '#f0f0f0', textAlign: 'left' }}><th style={{ padding: '8px' }}>Alumno</th><th>Hoja</th><th>Nota</th></tr></thead><tbody>{listaResultados.map((res, i) => (<tr key={i} style={{ borderBottom: '1px solid #ddd' }}><td style={{ padding: '8px' }}>{res.jugador}</td><td>{res.categoria}</td><td><b>{res.aciertos || res.puntuacion}</b></td></tr>))}</tbody></table></div>
                </ModalOverlay>
            )}
            <input type="file" id="input-excel-oculto" accept=".xlsx" style={{ display: 'none' }} onChange={handleFileUpload} />
        </div>
    );
}

const ModalOverlay = ({ children, onClose }) => (<div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}><div style={{ background: 'white', padding: '30px', borderRadius: '12px', width: '90%', maxWidth: '500px', position: 'relative' }}><button onClick={onClose} style={{ position: 'absolute', top: '10px', right: '10px', border: 'none', background: 'none', cursor: 'pointer' }}><X /></button>{children}</div></div>);
const btnStyle = (bg, color) => ({ flex: 1, padding: '8px', background: bg, color: color, border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' });
const actionBtnStyle = (bg) => ({ padding: '10px 20px', background: bg, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontWeight: 'bold' });
const inputStyle = { width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc', boxSizing: 'border-box', marginBottom: '10px' };
const lbl = { fontSize: '12px', color: '#666' };