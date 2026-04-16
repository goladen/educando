import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import {
    collection, query, where, getDocs, doc, updateDoc
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import useDrivePicker from 'react-google-drive-picker';
import {
    X, Users, ChevronRight, ChevronLeft, CheckSquare, Square,
    CheckCircle, RefreshCw, Plus, Upload
} from 'lucide-react';

const GOOGLE_CLIENT_ID     = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_DEVELOPER_KEY = import.meta.env.VITE_GOOGLE_DEVELOPER_KEY;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10);
const norm = (s) => s?.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') || '';

// Extrae la puntuación de un jugador del informe (devuelve string o '')
const extraerPuntuacion = (jugador) => {
    if (!jugador) return '';
    if (jugador.porcentaje != null) return String(jugador.porcentaje);
    if (jugador.aciertos != null && jugador.intentos > 0)
        return String(Math.round(jugador.aciertos / jugador.intentos * 100));
    if (jugador.puntuacion != null) return String(jugador.puntuacion);
    return '';
};

// ─── Modal principal ──────────────────────────────────────────────────────────
export default function ModalAgregarAGrupo({ informe, profesorUid, googleToken, onClose }) {
    const tipo       = informe._tipoJuego || informe.tipo || '';
    const jugadores  = informe.jugadores || []; // [{ nombre, porcentaje, aciertos, ... }]
    const autores    = tipo === 'STORYCUBES'
        ? [...new Set((informe.historia || []).map(s => s.autor))]
        : [];
    const tieneScore = tipo !== 'STORYCUBES' && jugadores.length > 0;

    // ── Pasos: 1=grupo, 2=columna, 3=alumnos+notas ──────────────────────────
    const [paso,          setPaso]          = useState(1);
    const [grupos,        setGrupos]        = useState([]);
    const [cargandoGrupos,setCargandoGrupos]= useState(true);
    const [grupoSel,      setGrupoSel]      = useState(null);   // objeto grupo
    const [colSel,        setColSel]        = useState('');     // id columna o '__nueva__'
    const [nuevaColNombre,setNuevaColNombre]= useState('');
    const [seleccionados, setSeleccionados] = useState(new Set()); // Set alumnoId
    const [notas,         setNotas]         = useState({});     // { alumnoId: string }
    const [guardando,     setGuardando]     = useState(false);
    const [guardadoOk,    setGuardadoOk]    = useState(false);
    const [error,         setError]         = useState('');
    const [importando,    setImportando]    = useState(false);
    const [openPicker] = useDrivePicker();
    const fileRef = useRef();

    // ── Cargar grupos ────────────────────────────────────────────────────────
    useEffect(() => {
        getDocs(query(
            collection(db, 'grupos_profesor'),
            where('profesorUid', '==', profesorUid)
        )).then(snap => {
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            docs.sort((a, b) => (b.fechaCreacion?.seconds || 0) - (a.fechaCreacion?.seconds || 0));
            setGrupos(docs);
        }).catch(console.error)
          .finally(() => setCargandoGrupos(false));
    }, [profesorUid]);

    // ── Al seleccionar grupo: pre-rellenar notas por nombre ──────────────────
    const seleccionarGrupo = (g) => {
        setGrupoSel(g);
        setColSel('');
        setNuevaColNombre('');
        // Pre-mapear notas: buscar cada alumno en la lista de jugadores del informe
        const notasInit = {};
        (g.alumnos || []).forEach(a => {
            const jugador = jugadores.find(j => norm(j.nombre) === norm(a.nombre));
            if (jugador) notasInit[a.id] = extraerPuntuacion(jugador);
        });
        setNotas(notasInit);
        setSeleccionados(new Set((g.alumnos || []).map(a => a.id))); // todos pre-seleccionados
        setPaso(2);
    };

    // ── Avanzar de paso 2 → 3 ───────────────────────────────────────────────
    const confirmarColumna = () => {
        if (!colSel) { setError('Selecciona o crea una columna.'); return; }
        if (colSel === '__nueva__' && !nuevaColNombre.trim()) { setError('Escribe el nombre de la nueva columna.'); return; }
        setError('');
        setPaso(3);
    };

    // ── Toggle alumno ────────────────────────────────────────────────────────
    const toggleAlumno = (id) => {
        setSeleccionados(prev => {
            const n = new Set(prev);
            n.has(id) ? n.delete(id) : n.add(id);
            return n;
        });
    };

    const toggleTodos = () => {
        const todos = (grupoSel?.alumnos || []).map(a => a.id);
        setSeleccionados(prev => prev.size === todos.length ? new Set() : new Set(todos));
    };

    // ── Guardar ──────────────────────────────────────────────────────────────
    // ── Aplicar notas desde filas de hoja (col A = nombre, col B = nota) ────
    const aplicarFilasHoja = (rows) => {
        // Detectar si la primera fila es cabecera (no numérica en col B)
        const start = rows.length > 1 && isNaN(parseFloat(rows[0]?.[1])) ? 1 : 0;
        const mapa = {};
        rows.slice(start).forEach(r => {
            const nombre = r[0]?.toString().trim();
            const nota   = r[1]?.toString().trim();
            if (nombre) mapa[norm(nombre)] = nota ?? '';
        });
        setNotas(prev => {
            const nuevo = { ...prev };
            (grupoSel?.alumnos || []).forEach(a => {
                const hit = mapa[norm(a.nombre)];
                if (hit !== undefined) nuevo[a.id] = hit;
            });
            return nuevo;
        });
        // Seleccionar los alumnos que aparecen en la hoja
        setSeleccionados(prev => {
            const n = new Set(prev);
            (grupoSel?.alumnos || []).forEach(a => {
                if (mapa[norm(a.nombre)] !== undefined) n.add(a.id);
            });
            return n;
        });
    };

    const onFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const wb = XLSX.read(ev.target.result, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
                aplicarFilasHoja(rows);
            } catch { setError('No se pudo leer el archivo.'); }
        };
        reader.readAsBinaryString(file);
        e.target.value = '';
    };

    const importarDesdeDrive = async (fileId, mimeType) => {
        if (!googleToken) { setError('No hay sesión de Google activa.'); return; }
        setImportando(true); setError('');
        try {
            const url = mimeType === 'application/vnd.google-apps.spreadsheet'
                ? `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
                : `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
            const res = await fetch(url, { headers: { Authorization: `Bearer ${googleToken}` } });
            if (!res.ok) throw new Error(`Error ${res.status}`);
            const ab = await res.arrayBuffer();
            const wb = XLSX.read(ab, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
            aplicarFilasHoja(rows);
        } catch (e) { setError('Error al importar: ' + e.message); }
        setImportando(false);
    };

    const abrirPickerDrive = () => {
        openPicker({
            clientId: GOOGLE_CLIENT_ID,
            developerKey: GOOGLE_DEVELOPER_KEY,
            viewId: 'SPREADSHEETS',
            token: googleToken,
            showUploadView: false,
            supportDrives: true,
            multiselect: false,
            mimetypes: [
                'application/vnd.google-apps.spreadsheet',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            ],
            callbackFunction: (data) => {
                if (data.action === 'picked') {
                    const d = data.docs[0];
                    importarDesdeDrive(d.id, d.mimeType);
                }
            }
        });
    };

    const guardar = async () => {
        if (seleccionados.size === 0) { setError('Selecciona al menos un alumno.'); return; }
        setGuardando(true); setError('');
        try {
            // Resolver columna
            let colId;
            let columnas = [...(grupoSel.columnas || [])];
            if (colSel === '__nueva__') {
                colId = uid();
                columnas.push({
                    id: colId,
                    header: nuevaColNombre.trim(),
                    oculta: false, porcentaje: null, esFormula: false, formula: ''
                });
            } else {
                colId = colSel;
            }

            // Construir actualizaciones de celdas
            const celdas = { ...(grupoSel.celdas || {}) };
            seleccionados.forEach(alumnoId => {
                const nota = notas[alumnoId] ?? '';
                celdas[`${alumnoId}__${colId}`] = nota;
            });

            await updateDoc(doc(db, 'grupos_profesor', grupoSel.id), { columnas, celdas });
            setGuardadoOk(true);
            setTimeout(onClose, 1400);
        } catch (e) {
            setError('Error al guardar: ' + e.message);
        }
        setGuardando(false);
    };

    // ── Columnas disponibles del grupo seleccionado ──────────────────────────
    const columnasDinamicas = (grupoSel?.columnas || []).filter(c => !c.esFormula);

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div style={st.overlay} onClick={onClose}>
            <div style={st.panel} onClick={e => e.stopPropagation()}>

                {/* Cabecera */}
                <div style={st.header}>
                    <div>
                        <div style={{ fontWeight:700, color:'#2c3e50', fontSize:'1.05rem' }}>
                            Añadir al cuaderno de grupo
                        </div>
                        <div style={{ fontSize:'0.75rem', color:'#95a5a6', marginTop:2 }}>
                            Paso {paso} de 3 · {paso===1?'Seleccionar grupo':paso===2?'Seleccionar columna':'Alumnos y calificación'}
                        </div>
                    </div>
                    <button onClick={onClose} style={st.closeBtn}><X size={18}/></button>
                </div>

                {/* Barra de pasos */}
                <div style={{ display:'flex', gap:4, marginBottom:20 }}>
                    {[1,2,3].map(n => (
                        <div key={n} style={{
                            flex:1, height:4, borderRadius:4,
                            background: n <= paso ? '#1565C0' : '#e0e4f0',
                            transition:'background 0.3s'
                        }}/>
                    ))}
                </div>

                {/* ── PASO 1: Seleccionar grupo ──────────────────────────── */}
                {paso === 1 && (
                    <div>
                        <div style={st.label}>Elige un grupo</div>
                        {cargandoGrupos ? (
                            <div style={{ textAlign:'center', padding:'30px 0', color:'#95a5a6' }}>
                                <RefreshCw size={22} style={{ animation:'spin 1s linear infinite' }}/>
                            </div>
                        ) : grupos.length === 0 ? (
                            <div style={{ textAlign:'center', padding:'24px', color:'#bdc3c7', fontSize:'0.88rem' }}>
                                No tienes grupos creados. Ve a la pestaña Grupos para crear uno.
                            </div>
                        ) : (
                            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                                {grupos.map(g => (
                                    <button key={g.id} onClick={() => seleccionarGrupo(g)} style={st.grupoBtn}>
                                        <Users size={15} color="#1565C0"/>
                                        <span style={{ flex:1, textAlign:'left' }}>
                                            <strong>{g.nombre}</strong>
                                            <span style={{ marginLeft:8, color:'#95a5a6', fontSize:'0.8rem' }}>
                                                {g.alumnos?.length || 0} alumnos
                                            </span>
                                        </span>
                                        <ChevronRight size={15} color="#bdc3c7"/>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── PASO 2: Seleccionar columna ──────────────────────── */}
                {paso === 2 && grupoSel && (
                    <div>
                        <div style={st.label}>Columna del cuaderno de <strong>{grupoSel.nombre}</strong></div>
                        <div style={{ display:'flex', flexDirection:'column', gap:7, marginBottom:12 }}>
                            {columnasDinamicas.map(col => (
                                <button key={col.id}
                                    onClick={() => setColSel(col.id)}
                                    style={{ ...st.colBtn, borderColor: colSel===col.id ? '#1565C0' : '#e0e4f0', background: colSel===col.id ? '#e8f0fe' : 'white', color: colSel===col.id ? '#1565C0' : '#2c3e50' }}>
                                    {colSel === col.id && <CheckCircle size={14} color="#1565C0"/>}
                                    {col.header}
                                    {col.porcentaje ? <span style={{ marginLeft:'auto', fontSize:'0.72rem', color:'#7f8c8d' }}>{col.porcentaje}%</span> : null}
                                </button>
                            ))}

                            {/* Nueva columna */}
                            <button
                                onClick={() => setColSel('__nueva__')}
                                style={{ ...st.colBtn, borderColor: colSel==='__nueva__' ? '#27ae60' : '#e0e4f0', background: colSel==='__nueva__' ? '#e8f5e9' : 'white', color: colSel==='__nueva__' ? '#27ae60' : '#7f8c8d' }}>
                                <Plus size={14}/>
                                Nueva columna
                            </button>
                        </div>

                        {colSel === '__nueva__' && (
                            <input
                                autoFocus
                                value={nuevaColNombre}
                                onChange={e => setNuevaColNombre(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && confirmarColumna()}
                                placeholder="Nombre de la nueva columna (ej: Sopa Volcanes)"
                                style={st.input}
                            />
                        )}

                        {error && <div style={st.error}>{error}</div>}
                        <div style={st.btnRow}>
                            <button onClick={() => { setPaso(1); setError(''); }} style={st.btnSec}>
                                <ChevronLeft size={14}/> Volver
                            </button>
                            <button onClick={confirmarColumna} style={st.btnPrimary}>
                                Siguiente <ChevronRight size={14}/>
                            </button>
                        </div>
                    </div>
                )}

                {/* ── PASO 3: Alumnos + calificaciones ─────────────────── */}
                {paso === 3 && grupoSel && (
                    <div>
                        <div style={st.label}>
                            Columna: <strong>
                                {colSel === '__nueva__' ? nuevaColNombre : columnasDinamicas.find(c=>c.id===colSel)?.header}
                            </strong>
                        </div>

                        {!tieneScore && (
                            <div style={{ background:'#fff8e1', border:'1px solid #ffe082', borderRadius:8, padding:'8px 12px', fontSize:'0.78rem', color:'#856404', marginBottom:12 }}>
                                Este tipo de juego no tiene calificación automática. Introduce las notas manualmente o importa desde una hoja de cálculo.
                            </div>
                        )}

                        {/* Importar calificaciones desde hoja */}
                        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12, padding:'10px 12px', background:'#f8f9fa', borderRadius:10, border:'1px solid #e0e4f0' }}>
                            <span style={{ fontSize:'0.75rem', color:'#7f8c8d', alignSelf:'center', fontWeight:600, flexBasis:'100%', marginBottom:2 }}>
                                Importar calificaciones (col A: nombre alumno · col B: calificación)
                            </span>
                            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }} onChange={onFileChange}/>
                            <button onClick={() => fileRef.current.click()} disabled={importando}
                                style={{ ...st.btnImport, border:'1px solid #bdc3c7', color:'#555' }}>
                                <Upload size={13}/> Subir archivo
                            </button>
                            {googleToken && (
                                <button onClick={abrirPickerDrive} disabled={importando}
                                    style={{ ...st.btnImport, border:'1px solid #34a853', color:'#188038' }}>
                                    {importando
                                        ? <><RefreshCw size={13} style={{ animation:'spin 1s linear infinite' }}/> Importando…</>
                                        : <><img src="https://ssl.gstatic.com/docs/spreadsheets/favicon3.ico" width={13} height={13} style={{ borderRadius:2 }} alt=""/> Google Sheets</>
                                    }
                                </button>
                            )}
                        </div>

                        {/* Seleccionar todos */}
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, padding:'4px 0' }}>
                            <button onClick={toggleTodos} style={st.checkBtn}>
                                {seleccionados.size === (grupoSel.alumnos||[]).length
                                    ? <CheckSquare size={16} color="#1565C0"/>
                                    : <Square size={16} color="#bdc3c7"/>}
                                <span style={{ fontSize:'0.82rem', color:'#555', marginLeft:4 }}>
                                    Todos ({(grupoSel.alumnos||[]).length})
                                </span>
                            </button>
                            <span style={{ marginLeft:'auto', fontSize:'0.75rem', color:'#95a5a6' }}>
                                {seleccionados.size} seleccionados
                            </span>
                        </div>

                        {/* Lista de alumnos */}
                        <div style={{ maxHeight:320, overflowY:'auto', border:'1px solid #e0e4f0', borderRadius:10, marginBottom:12 }}>
                            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.83rem' }}>
                                <thead>
                                    <tr style={{ background:'#f4f6f8', position:'sticky', top:0 }}>
                                        <th style={st.th}></th>
                                        <th style={st.th}>Alumno</th>
                                        <th style={{ ...st.th, textAlign:'center' }}>
                                            Calificación
                                            {tieneScore && <span style={{ marginLeft:4, fontWeight:400, color:'#95a5a6', fontSize:'0.7rem' }}>(% del juego)</span>}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(grupoSel.alumnos || []).map((a, i) => {
                                        const checked = seleccionados.has(a.id);
                                        const nota    = notas[a.id] ?? '';
                                        const tieneMatch = tieneScore && jugadores.some(j => norm(j.nombre) === norm(a.nombre));
                                        return (
                                            <tr key={a.id} style={{ background: i%2===0 ? 'white' : '#fafafa', opacity: checked ? 1 : 0.45 }}>
                                                <td style={{ padding:'6px 10px', width:32 }}>
                                                    <button onClick={() => toggleAlumno(a.id)} style={st.checkBtn}>
                                                        {checked
                                                            ? <CheckSquare size={15} color="#1565C0"/>
                                                            : <Square size={15} color="#bdc3c7"/>}
                                                    </button>
                                                </td>
                                                <td style={{ padding:'6px 8px', color:'#2c3e50', fontWeight:500 }}>
                                                    {a.nombre}
                                                    {a.grupo && <span style={{ marginLeft:6, fontSize:'0.7rem', color:'#bdc3c7' }}>{a.grupo}</span>}
                                                    {tieneMatch && (
                                                        <span style={{ marginLeft:6, fontSize:'0.68rem', background:'#e8f0fe', color:'#1565C0', padding:'1px 5px', borderRadius:8 }}>↑ auto</span>
                                                    )}
                                                </td>
                                                <td style={{ padding:'4px 8px', textAlign:'center' }}>
                                                    <input
                                                        type="number"
                                                        min={0} max={10} step={0.1}
                                                        value={nota}
                                                        onChange={e => setNotas(prev => ({ ...prev, [a.id]: e.target.value }))}
                                                        disabled={!checked}
                                                        placeholder="—"
                                                        style={{ ...st.notaInput, opacity: checked ? 1 : 0.4, background: tieneMatch ? '#e8f0fe' : 'white' }}
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {error && <div style={st.error}>{error}</div>}

                        <div style={st.btnRow}>
                            <button onClick={() => { setPaso(2); setError(''); }} style={st.btnSec}>
                                <ChevronLeft size={14}/> Volver
                            </button>
                            <button onClick={guardar} disabled={guardando} style={{ ...st.btnPrimary, background: guardadoOk ? '#27ae60' : '#1565C0', minWidth:130 }}>
                                {guardadoOk
                                    ? <><CheckCircle size={14}/> Guardado</>
                                    : guardando
                                    ? <><RefreshCw size={14} style={{ animation:'spin 1s linear infinite' }}/> Guardando…</>
                                    : `Guardar en ${grupoSel.nombre}`}
                            </button>
                        </div>
                    </div>
                )}

                <style>{`@keyframes spin { 100%{ transform:rotate(360deg); } }`}</style>
            </div>
        </div>
    );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const st = {
    overlay:    { position:'fixed', inset:0, zIndex:4000, background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 },
    panel:      { background:'white', borderRadius:20, width:'100%', maxWidth:520, padding:28, boxShadow:'0 20px 50px rgba(0,0,0,0.25)', maxHeight:'90vh', overflowY:'auto' },
    header:     { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 },
    closeBtn:   { background:'none', border:'none', cursor:'pointer', color:'#95a5a6', padding:4, flexShrink:0 },
    label:      { fontSize:'0.78rem', fontWeight:700, color:'#7f8c8d', textTransform:'uppercase', letterSpacing:.5, marginBottom:10 },
    input:      { padding:'9px 12px', borderRadius:8, border:'1.5px solid #e0e4f0', fontSize:'0.9rem', outline:'none', width:'100%', boxSizing:'border-box', fontFamily:'inherit', marginBottom:10 },
    grupoBtn:   { display:'flex', alignItems:'center', gap:10, padding:'11px 14px', borderRadius:10, border:'1.5px solid #e0e4f0', background:'white', cursor:'pointer', transition:'all 0.15s', fontSize:'0.9rem' },
    colBtn:     { display:'flex', alignItems:'center', gap:8, padding:'10px 14px', borderRadius:9, border:'1.5px solid #e0e4f0', background:'white', cursor:'pointer', fontSize:'0.88rem', fontWeight:600, transition:'all 0.15s' },
    checkBtn:   { background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', padding:2 },
    th:         { padding:'7px 10px', textAlign:'left', fontWeight:600, fontSize:'0.75rem', color:'#7f8c8d', borderBottom:'1px solid #f0f0f0' },
    notaInput:  { width:70, padding:'4px 6px', borderRadius:6, border:'1.5px solid #e0e4f0', fontSize:'0.85rem', textAlign:'center', fontFamily:'inherit', outline:'none', cursor:'pointer' },
    error:      { color:'#e74c3c', fontSize:'0.82rem', marginBottom:10, display:'flex', alignItems:'center', gap:4 },
    btnRow:     { display:'flex', gap:10, justifyContent:'flex-end', marginTop:4 },
    btnPrimary: { display:'flex', alignItems:'center', gap:6, padding:'10px 18px', borderRadius:9, border:'none', background:'#1565C0', color:'white', fontWeight:700, cursor:'pointer', fontSize:'0.88rem' },
    btnSec:     { display:'flex', alignItems:'center', gap:6, padding:'10px 14px', borderRadius:9, border:'1px solid #e0e4f0', background:'white', color:'#7f8c8d', fontWeight:600, cursor:'pointer', fontSize:'0.88rem' },
    btnImport:  { display:'flex', alignItems:'center', gap:5, padding:'7px 12px', borderRadius:8, background:'white', fontWeight:600, cursor:'pointer', fontSize:'0.8rem' },
};
