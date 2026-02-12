import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Search, FileSpreadsheet, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function ToolExportarGoogleSheets({ usuario, googleToken, onBack }) {
    const [misRecursos, setMisRecursos] = useState([]);
    const [resultados, setResultados] = useState([]);
    const [cargando, setCargando] = useState(false);

    // --- CORRECCIÓN AQUÍ: Usamos subiendoId en lugar de subiendo ---
    const [subiendoId, setSubiendoId] = useState(null);
    // -------------------------------------------------------------

    // Estados de Filtro
    const [busqueda, setBusqueda] = useState('');
    const [filtroApp, setFiltroApp] = useState('');
    const [filtroCiclo, setFiltroCiclo] = useState('');

    // Estado para mensajes
    const [mensaje, setMensaje] = useState(null);

    // 1. CARGAR RECURSOS DEL PROFESOR
    useEffect(() => {
        const cargarRecursos = async () => {
            setCargando(true);
            try {
                const q = query(collection(db, "resources"), where("profesorUid", "==", usuario.uid));
                const snap = await getDocs(q);
                const docs = snap.docs.map(d => ({ ...d.data(), id: d.id }));
                setMisRecursos(docs);
                setResultados(docs);
            } catch (e) {
                console.error("Error cargando:", e);
            }
            setCargando(false);
        };
        if (usuario) cargarRecursos();
    }, [usuario]);

    // 2. FILTRADO EN TIEMPO REAL
    useEffect(() => {
        let filtrados = misRecursos;

        if (busqueda) {
            const text = busqueda.toLowerCase();
            filtrados = filtrados.filter(r =>
                r.titulo.toLowerCase().includes(text) ||
                (r.temas && r.temas.toLowerCase().includes(text))
            );
        }
        if (filtroApp) {
            if (filtroApp === 'CAZABURBUJAS') {
                filtrados = filtrados.filter(r => r.tipoJuego === 'CAZABURBUJAS');
            } else {
                filtrados = filtrados.filter(r => r.tipoJuego === filtroApp);
            }
        }
        if (filtroCiclo) {
            filtrados = filtrados.filter(r => r.ciclo === filtroCiclo || r.config?.ciclo === filtroCiclo);
        }
        setResultados(filtrados);
    }, [busqueda, filtroApp, filtroCiclo, misRecursos]);

    // 3. LÓGICA DE EXPORTACIÓN A GOOGLE DRIVE
    const exportarASheets = async (recurso) => {
        if (!googleToken) {
            alert("Necesitas haber iniciado sesión con Google y dar permisos de Drive.");
            return;
        }

        // --- CORRECCIÓN AQUÍ: Usamos el ID del recurso ---
        setSubiendoId(recurso.id);
        // -------------------------------------------------

        setMensaje(null);

        try {
            // A) CREAR EL LIBRO EN MEMORIA
            const wb = XLSX.utils.book_new();
            const hojasProcesar = (recurso.hojas && recurso.hojas.length > 0)
                ? recurso.hojas
                : [{ nombreHoja: 'General', preguntas: recurso.preguntas || [] }];

            hojasProcesar.forEach(hoja => {
                const preguntas = hoja.preguntas || [];

                if (preguntas.length === 0) {
                    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ Info: "Hoja vacía o solo generador" }]), hoja.nombreHoja);
                    return;
                }

                const filas = preguntas.map(p => {
                    const tipo = recurso.tipoJuego;

                    if (tipo === 'CAZABURBUJAS' || tipo === 'THINKHOOT' || recurso.tipo === 'PRO-BURBUJAS') {
                        return {
                            'Pregunta': p.pregunta || p.q,
                            'Respuesta Correcta': p.correcta || p.respuesta || p.a,
                            'Incorrecta 1': p.incorrectas?.[0] || '',
                            'Incorrecta 2': p.incorrectas?.[1] || '',
                            'Incorrecta 3': p.incorrectas?.[2] || '',
                            'Tiempo (s)': p.tiempo || recurso.config?.tiempoPregunta || 20,
                            'Imagen': p.imagen || ''
                        };
                    }
                    else if (tipo === 'PASAPALABRA') {
                        return {
                            'Letra': p.letra,
                            'Tipo': p.tipo,
                            'Definición': p.pregunta,
                            'Respuesta': p.respuesta
                        };
                    }
                    else if (tipo === 'APAREJADOS') {
                        return {
                            'Pareja A': p.textoA,
                            'Pareja B': p.textoB
                        };
                    }
                    else {
                        return { 'Pregunta': p.pregunta, 'Respuesta': p.respuesta };
                    }
                });

                const ws = XLSX.utils.json_to_sheet(filas);
                const nombreHoja = (hoja.nombreHoja || 'Hoja').replace(/[:\\/?*[\]]/g, "").substring(0, 30);
                XLSX.utils.book_append_sheet(wb, ws, nombreHoja);
            });

            // B) GENERAR BINARIO
            const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

            // C) SUBIR A GOOGLE DRIVE
            const metadata = {
                name: `[PiKT] ${recurso.titulo}`,
                mimeType: 'application/vnd.google-apps.spreadsheet'
            };

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', blob);

            const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${googleToken}` },
                body: form
            });

            if (res.ok) {
                setMensaje({ tipo: 'exito', texto: `¡Creado en tu Drive! "${recurso.titulo}"` });
            } else {
                throw new Error("Error subiendo a Google Drive");
            }

        } catch (error) {
            console.error(error);
            setMensaje({ tipo: 'error', texto: "Error: Verifica tus permisos de Google Drive." });
        }

        // --- CORRECCIÓN AQUÍ: Liberamos el ID ---
        setSubiendoId(null);
        // ----------------------------------------
    };

    // --- RENDERIZADO ---
    return (
        <div style={{ padding: '20px', background: 'white', borderRadius: '15px', minHeight: '80vh' }}>
            {/* CABECERA */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #eee', paddingBottom: '15px' }}>
                <div>
                    <h2 style={{ color: '#27ae60', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FileSpreadsheet size={28} /> Exportar a Google Sheets
                    </h2>
                    <p style={{ color: '#7f8c8d', margin: '5px 0 0 0', fontSize: '0.9rem' }}>
                        Convierte tus juegos en Hojas de Cálculo editables en tu nube.
                    </p>
                </div>
                <button onClick={onBack} style={{ background: '#95a5a6', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer' }}>Volver</button>
            </div>

            {/* MENSAJES DE ESTADO */}
            {mensaje && (
                <div style={{
                    padding: '15px', borderRadius: '10px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px',
                    background: mensaje.tipo === 'exito' ? '#d4edda' : '#f8d7da',
                    color: mensaje.tipo === 'exito' ? '#155724' : '#721c24',
                    border: `1px solid ${mensaje.tipo === 'exito' ? '#c3e6cb' : '#f5c6cb'}`
                }}>
                    {mensaje.tipo === 'exito' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                    {mensaje.texto}
                </div>
            )}

            {/* BARRA DE BÚSQUEDA */}
            <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
                    <Search size={18} style={{ position: 'absolute', left: '10px', top: '10px', color: '#aaa' }} />
                    <input
                        placeholder="Buscar por título o tema..."
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                        style={{ width: '100%', padding: '10px 10px 10px 35px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }}
                    />
                </div>

                <select value={filtroApp} onChange={e => setFiltroApp(e.target.value)} style={selectStyle}>
                    <option value="">Todas las Apps</option>
                    <option value="CAZABURBUJAS">CazaBurbujas / Pikatron</option>
                    <option value="THINKHOOT">Pi-Live</option>
                    <option value="PASAPALABRA">Pasapalabra</option>
                    <option value="APAREJADOS">AparejaDOS</option>
                </select>

                <select value={filtroCiclo} onChange={e => setFiltroCiclo(e.target.value)} style={selectStyle}>
                    <option value="">Cualquier Ciclo</option>
                    <option value="Infantil">Infantil</option>
                    <option value="Primaria">Primaria</option>
                    <option value="Secundaria">Secundaria</option>
                    <option value="Bachillerato">Bachillerato</option>
                </select>
            </div>

            {/* LISTADO DE RESULTADOS */}
            {cargando ? <div style={{ textAlign: 'center', padding: '40px', color: '#aaa' }}>Cargando tus recursos...</div> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
                    {resultados.map(r => (
                        <div key={r.id} style={{ border: '1px solid #eee', borderRadius: '10px', padding: '15px', background: 'white', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#aaa', textTransform: 'uppercase', marginBottom: '5px' }}>
                                    {r.tipoJuego} {r.tipo === 'PRO-BURBUJAS' ? '(PRO)' : ''}
                                </div>
                                <h3 style={{ margin: '0 0 10px 0', fontSize: '1.1rem', color: '#2c3e50' }}>{r.titulo}</h3>
                                <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '15px' }}>
                                    {r.hojas?.length || 1} {r.hojas?.length === 1 ? 'Nivel' : 'Niveles'} • {r.playCount || 0} jugadas
                                </div>
                            </div>

                            <button
                                onClick={() => exportarASheets(r)}
                                disabled={subiendoId !== null}
                                style={{
                                    background: subiendoId === r.id ? '#ccc' : '#27ae60',
                                    color: 'white', border: 'none', padding: '10px',
                                    borderRadius: '8px', cursor: subiendoId !== null ? 'wait' : 'pointer', fontWeight: 'bold',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    transition: 'background 0.2s'
                                }}
                            >
                                {subiendoId === r.id ? <Loader size={18} className="spin" /> : <FileSpreadsheet size={18} />}
                                {subiendoId === r.id ? 'Creando...' : 'Crear Google Sheet'}
                            </button>
                        </div>
                    ))}
                    {resultados.length === 0 && (
                        <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#999', marginTop: '30px' }}>
                            No se encontraron recursos con esos filtros.
                        </p>
                    )}
                </div>
            )}
            <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

const selectStyle = { padding: '10px', borderRadius: '8px', border: '1px solid #ddd', background: 'white', cursor: 'pointer' };