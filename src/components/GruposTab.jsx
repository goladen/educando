import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../firebase';
import {
    collection, query, where, getDocs, doc,
    setDoc, updateDoc, deleteDoc, serverTimestamp
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import useDrivePicker from 'react-google-drive-picker';
import {
    Users, Plus, Trash2, Edit2, Upload, Save, X,
    ChevronLeft, ChevronRight, Eye, EyeOff, CheckCircle, RefreshCw
} from 'lucide-react';

const GOOGLE_CLIENT_ID    = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_DEVELOPER_KEY = import.meta.env.VITE_GOOGLE_DEVELOPER_KEY;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10);
const sortAlpha = arr => [...arr].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

// ─── Modal Crear / Editar Grupo ───────────────────────────────────────────────
function ModalCrearGrupo({ profesorUid, onClose, onSaved, grupoExistente, googleToken }) {
    const [nombre,         setNombre]         = useState(grupoExistente?.nombre || '');
    const [alumnos,        setAlumnos]        = useState(grupoExistente?.alumnos || []);
    const [columnas,       setColumnas]       = useState(
        (grupoExistente?.columnas || []).map(c => ({
            oculta: false, porcentaje: null, esFormula: false, formula: '', ...c
        }))
    );
    const [celdas,         setCeldas]         = useState(grupoExistente?.celdas || {});
    const [inputNombre,    setInputNombre]    = useState('');
    const [inputGrupo,     setInputGrupo]     = useState('');
    const [guardando,      setGuardando]      = useState(false);
    const [error,          setError]          = useState('');
    const [importando,     setImportando]     = useState(false);
    const [resumenImport,  setResumenImport]  = useState(null); // { alumnos, cols }
    const fileRef = useRef();
    const [openPicker] = useDrivePicker();

    const añadirManual = () => {
        const n = inputNombre.trim();
        if (!n) return;
        setAlumnos(prev => sortAlpha([...prev, { id: uid(), nombre: n, grupo: inputGrupo.trim() }]));
        setInputNombre(''); setInputGrupo('');
    };

    const eliminarAlumno = (id) => setAlumnos(prev => prev.filter(a => a.id !== id));

    // ── Procesador común de filas ─────────────────────────────────────────────
    // Formato: fila 0 = cabeceras (col0=Nombre, col1=Grupo, col2+=calificaciones)
    //          filas 1+ = datos
    const procesarRows = (rows, alumnosActuales) => {
        if (!rows.length) throw new Error('El archivo está vacío.');

        const cabecera = rows[0].map(h => h?.toString().trim());
        // Detectar si la fila 0 es realmente una cabecera o son datos
        // (si col0 es un nombre con letras, asumimos cabecera)
        const tieneCabecera = isNaN(parseFloat(cabecera[0]));
        const dataRows  = tieneCabecera ? rows.slice(1) : rows;
        const colHeaders = tieneCabecera ? cabecera.slice(2).filter(Boolean) : [];

        // Crear columnas para col 2+
        const newCols = colHeaders.map(h => ({
            id: uid(), header: h,
            oculta: false, porcentaje: null, esFormula: false, formula: ''
        }));

        // Construir alumnos fusionando con existentes
        const listado = [...alumnosActuales];
        const nuevasCeldas = {};

        dataRows.forEach(r => {
            const nombreStr = r[0]?.toString().trim();
            if (!nombreStr) return;
            const grupoStr  = r[1]?.toString().trim() || '';

            // Reusar alumno existente (por nombre normalizado) o crear nuevo
            let alumno = listado.find(a =>
                a.nombre.trim().toLowerCase() === nombreStr.toLowerCase()
            );
            if (!alumno) {
                alumno = { id: uid(), nombre: nombreStr, grupo: grupoStr };
                listado.push(alumno);
            }

            // Celdas de calificación (col 2+)
            newCols.forEach((col, j) => {
                const val = r[j + 2]?.toString().trim() ?? '';
                nuevasCeldas[`${alumno.id}__${col.id}`] = val;
            });
        });

        return {
            todosAlumnos: sortAlpha(listado),
            newCols,
            nuevasCeldas
        };
    };

    const aplicarImport = (rows) => {
        const { todosAlumnos, newCols, nuevasCeldas } = procesarRows(rows, alumnos);
        setAlumnos(todosAlumnos);
        if (newCols.length > 0) {
            setColumnas(prev => {
                // Evitar duplicados por nombre de cabecera
                const existentes = new Set(prev.map(c => c.header.toLowerCase()));
                return [...prev, ...newCols.filter(c => !existentes.has(c.header.toLowerCase()))];
            });
            setCeldas(prev => ({ ...prev, ...nuevasCeldas }));
        }
        setResumenImport({
            alumnos: todosAlumnos.length,
            cols: newCols.map(c => c.header)
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
                aplicarImport(rows);
            } catch (err) {
                setError(err.message || 'No se pudo leer el archivo.');
            }
        };
        reader.readAsBinaryString(file);
        e.target.value = '';
    };

    const importarDesdeSheets = async (fileId, mimeType) => {
        if (!googleToken) { setError('No hay sesión de Google activa.'); return; }
        setImportando(true); setError(''); setResumenImport(null);
        try {
            const url = mimeType === 'application/vnd.google-apps.spreadsheet'
                ? `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
                : `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
            const res = await fetch(url, { headers: { Authorization: `Bearer ${googleToken}` } });
            if (!res.ok) throw new Error(`Error ${res.status} al acceder al archivo.`);
            const ab = await res.arrayBuffer();
            const wb = XLSX.read(ab, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
            aplicarImport(rows);
        } catch (e) {
            setError('Error al importar: ' + e.message);
        }
        setImportando(false);
    };

    const abrirPickerDrive = () => {
        if (!googleToken) {
            setError('Para importar de Drive debes iniciar sesión con Google. Cierra sesión y vuelve a entrar con tu cuenta de Google.');
            return;
        }
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
                    importarDesdeSheets(d.id, d.mimeType);
                }
            }
        });
    };

    const guardar = async () => {
        if (!nombre.trim()) { setError('Escribe un nombre para el grupo.'); return; }
        if (alumnos.length === 0) { setError('Añade al menos un alumno.'); return; }
        setGuardando(true); setError('');
        try {
            const id = grupoExistente?.id || uid();
            await setDoc(doc(db, 'grupos_profesor', id), {
                id,
                profesorUid,
                nombre: nombre.trim(),
                alumnos: sortAlpha(alumnos),
                columnas,
                celdas,
                fechaCreacion: grupoExistente?.fechaCreacion || serverTimestamp(),
            }, { merge: true });
            onSaved();
        } catch (e) {
            setError('Error al guardar: ' + e.message);
        }
        setGuardando(false);
    };

    return (
        <div style={ms.overlay} onClick={onClose}>
            <div style={ms.panel} onClick={e => e.stopPropagation()}>
                <div style={ms.header}>
                    <h3 style={{ margin:0, color:'#2c3e50', fontSize:'1.1rem' }}>
                        {grupoExistente ? '✏️ Editar Grupo' : '➕ Crear Grupo'}
                    </h3>
                    <button onClick={onClose} style={ms.closeBtn}><X size={18}/></button>
                </div>

                <div style={{ marginBottom:16 }}>
                    <label style={ms.label}>Nombre del grupo</label>
                    <input value={nombre} onChange={e => setNombre(e.target.value)}
                        placeholder="Ej: 3º ESO A" style={ms.input}/>
                </div>

                <div style={{ marginBottom:12 }}>
                    <label style={ms.label}>Añadir alumno manualmente</label>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                        <input value={inputNombre} onChange={e => setInputNombre(e.target.value)}
                            placeholder="Nombre y apellidos" style={{ ...ms.input, flex:2, minWidth:140 }}
                            onKeyDown={e => e.key==='Enter' && añadirManual()}/>
                        <input value={inputGrupo} onChange={e => setInputGrupo(e.target.value)}
                            placeholder="Subgrupo (opcional)" style={{ ...ms.input, flex:1, minWidth:100 }}
                            onKeyDown={e => e.key==='Enter' && añadirManual()}/>
                        <button onClick={añadirManual} style={ms.btnGreen}>
                            <Plus size={16}/> Añadir
                        </button>
                    </div>
                </div>

                <div style={{ marginBottom:16 }}>
                    <label style={ms.label}>O importar desde hoja de cálculo</label>
                    <div style={{ fontSize:'0.75rem', color:'#95a5a6', marginBottom:8 }}>
                        Fila 1: cabeceras · Col A: Nombre · Col B: Grupo · Col C en adelante: calificaciones
                    </div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }} onChange={onFileChange}/>
                        <button onClick={() => fileRef.current.click()} style={ms.btnBlue} disabled={importando}>
                            <Upload size={15}/> Subir archivo
                        </button>
                        <button onClick={abrirPickerDrive} style={ms.btnGoogle} disabled={importando}>
                            {importando
                                ? <><RefreshCw size={14} style={{ animation:'spin 1s linear infinite' }}/> Importando…</>
                                : <><img src="https://ssl.gstatic.com/docs/spreadsheets/favicon3.ico" width={15} height={15} style={{ borderRadius:2 }} alt=""/> Importar de Drive</>
                            }
                        </button>
                    </div>
                    {resumenImport && (
                        <div style={{ marginTop:10, padding:'8px 12px', background:'#e8f5e9', borderRadius:8, fontSize:'0.78rem', color:'#1b5e20' }}>
                            ✓ {resumenImport.alumnos} alumnos importados
                            {resumenImport.cols.length > 0 && (
                                <> · Columnas: <strong>{resumenImport.cols.join(', ')}</strong></>
                            )}
                        </div>
                    )}
                    {columnas.length > 0 && !resumenImport && (
                        <div style={{ marginTop:8, fontSize:'0.73rem', color:'#7f8c8d' }}>
                            {columnas.length} columna{columnas.length > 1 ? 's' : ''} de calificación guardada{columnas.length > 1 ? 's' : ''}: {columnas.map(c => c.header).join(', ')}
                        </div>
                    )}
                </div>

                {alumnos.length > 0 && (
                    <div style={{ maxHeight:220, overflowY:'auto', border:'1px solid #e0e4f0', borderRadius:10, marginBottom:14 }}>
                        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.83rem' }}>
                            <thead>
                                <tr style={{ background:'#f4f6f8', position:'sticky', top:0 }}>
                                    <th style={ms.th}>Nombre</th>
                                    <th style={ms.th}>Grupo</th>
                                    <th style={ms.th}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {alumnos.map((a, i) => (
                                    <tr key={a.id} style={{ background: i%2===0?'white':'#fafafa', borderBottom:'1px solid #f0f0f0' }}>
                                        <td style={ms.td}>{a.nombre}</td>
                                        <td style={ms.td}>{a.grupo}</td>
                                        <td style={{ ...ms.td, textAlign:'center' }}>
                                            <button onClick={() => eliminarAlumno(a.id)}
                                                style={{ background:'none', border:'none', cursor:'pointer', color:'#e74c3c', padding:'2px 4px' }}>
                                                <Trash2 size={13}/>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {alumnos.length === 0 && (
                    <div style={{ textAlign:'center', padding:'16px 0', color:'#bdc3c7', fontSize:'0.85rem', marginBottom:14 }}>
                        Sin alumnos aún. Añade manualmente o sube un archivo.
                    </div>
                )}

                {error && <div style={{ color:'#e74c3c', fontSize:'0.83rem', marginBottom:10 }}>⚠ {error}</div>}

                <div style={{ display:'flex', gap:10 }}>
                    <button onClick={onClose} style={ms.btnSecundario}>Cancelar</button>
                    <button onClick={guardar} disabled={guardando} style={{ ...ms.btnGreen, flex:1, justifyContent:'center' }}>
                        {guardando
                            ? <><RefreshCw size={14} style={{ animation:'spin 1s linear infinite' }}/> Guardando…</>
                            : <><Save size={15}/> Guardar grupo</>}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── TablaGrupo ───────────────────────────────────────────────────────────────
// Columna shape: { id, header, oculta, porcentaje, esFormula, formula }
function TablaGrupo({ grupo, profesorUid, onSaved, onDirtyChange }) {
    const [columnas,   setColumnas]   = useState(
        (grupo.columnas || []).map(c => ({
            oculta: false, porcentaje: null, esFormula: false, formula: '', ...c
        }))
    );
    const [celdas,     setCeldas]     = useState(grupo.celdas   || {});
    const [alumnos,    setAlumnos]    = useState(sortAlpha(grupo.alumnos || []));
    const [guardando,    setGuardando]    = useState(false);
    const [guardadoOk,   setGuardadoOk]   = useState(false);
    const [editHeader,   setEditHeader]   = useState(null);
    const [tempHeader,   setTempHeader]   = useState('');
    const [ocultarGrupo, setOcultarGrupo] = useState(grupo.grupoColOculta || false);
    const [isDirty,      setIsDirty]      = useState(false);

    // Notificar al padre cuando cambia el estado dirty
    useEffect(() => { onDirtyChange?.(isDirty); }, [isDirty, onDirtyChange]);

    const celdaKey = (aId, cId) => `${aId}__${cId}`;
    const setCelda = (aId, cId, val) => {
        setCeldas(prev => ({ ...prev, [celdaKey(aId, cId)]: val }));
        setIsDirty(true);
    };
    const getCelda = (aId, cId) => celdas[celdaKey(aId, cId)] ?? '';

    // ── Auto-guardado del estado oculta ──────────────────────────────────────
    const autoGuardarOculta = useCallback(async (newColumnas, newGrupoOculta) => {
        try {
            await updateDoc(doc(db, 'grupos_profesor', grupo.id), {
                columnas: newColumnas,
                grupoColOculta: newGrupoOculta
            });
        } catch (e) { console.error('Error al guardar visibilidad:', e); }
    }, [grupo.id]);

    // ── Evaluador de fórmulas ────────────────────────────────────────────────
    // Soporta: PROMEDIO(Col1,Col2,...), MAX(...), MIN(...), o número literal
    const evaluarFormula = (formula, alumnoId, depth = 0) => {
        if (depth > 5 || !formula.trim()) return '';
        const match = formula.trim().match(/^(PROMEDIO|MAX|MIN)\((.+)\)$/i);
        if (!match) {
            const n = parseFloat(formula);
            return isNaN(n) ? '' : String(n);
        }
        const fn = match[1].toUpperCase();
        const nombres = match[2].split(',').map(s => s.trim());
        const vals = nombres
            .map(name => columnas.find(c => c.header === name))
            .filter(Boolean)
            .map(c => {
                const raw = c.esFormula
                    ? evaluarFormula(c.formula || '', alumnoId, depth + 1)
                    : getCelda(alumnoId, c.id);
                return parseFloat(raw);
            })
            .filter(v => !isNaN(v));
        if (!vals.length) return '';
        if (fn === 'PROMEDIO') return (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2);
        if (fn === 'MAX') return Math.max(...vals).toFixed(2);
        if (fn === 'MIN') return Math.min(...vals).toFixed(2);
        return '';
    };

    const getValor = (alumnoId, col) =>
        col.esFormula ? evaluarFormula(col.formula || '', alumnoId) : getCelda(alumnoId, col.id);

    // ── Nota Final ponderada ─────────────────────────────────────────────────
    const notaFinal = (alumnoId) => {
        const colsConPct = columnas.filter(c => c.porcentaje != null && Number(c.porcentaje) > 0);
        if (!colsConPct.length) return '';
        let total = 0;
        colsConPct.forEach(c => {
            const v = parseFloat(getValor(alumnoId, c));
            if (!isNaN(v)) total += v * (Number(c.porcentaje) / 100);
        });
        return total.toFixed(2);
    };

    const mediaCol = (col) => {
        const vals = alumnos.map(a => parseFloat(getValor(a.id, col))).filter(v => !isNaN(v));
        if (!vals.length) return '';
        return (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2);
    };

    const notaFinalMedia = () => {
        const vals = alumnos.map(a => parseFloat(notaFinal(a.id))).filter(v => !isNaN(v));
        if (!vals.length) return '';
        return (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2);
    };

    // ── Acciones de columna ──────────────────────────────────────────────────
    const añadirColumna = () => {
        setColumnas(prev => [...prev, {
            id: uid(), header: `Tarea ${prev.length + 1}`,
            oculta: false, porcentaje: null, esFormula: false, formula: ''
        }]);
        setIsDirty(true);
    };

    const eliminarColumna = (id) => {
        setColumnas(prev => prev.filter(c => c.id !== id));
        setCeldas(prev => {
            const n = { ...prev };
            Object.keys(n).forEach(k => { if (k.endsWith(`__${id}`)) delete n[k]; });
            return n;
        });
        setIsDirty(true);
    };

    const actualizarColumna = (id, changes) => {
        const esOculta = 'oculta' in changes;
        setColumnas(prev => {
            const newCols = prev.map(c => c.id === id ? { ...c, ...changes } : c);
            if (esOculta) autoGuardarOculta(newCols, ocultarGrupo);
            return newCols;
        });
        if (!esOculta) setIsDirty(true);
    };

    const toggleOcultarGrupo = (val) => {
        setOcultarGrupo(val);
        // usar columnas actuales (las dinámicas no cambian aquí)
        setColumnas(prev => { autoGuardarOculta(prev, val); return prev; });
    };

    const ocultarTodas = () => {
        setColumnas(prev => {
            const newCols = prev.map(c => ({ ...c, oculta: true }));
            autoGuardarOculta(newCols, true);
            return newCols;
        });
        setOcultarGrupo(true);
    };

    const mostrarTodas = () => {
        setColumnas(prev => {
            const newCols = prev.map(c => ({ ...c, oculta: false }));
            autoGuardarOculta(newCols, false);
            return newCols;
        });
        setOcultarGrupo(false);
    };

    // ── Guardar / Exportar ───────────────────────────────────────────────────
    const guardar = async () => {
        setGuardando(true);
        try {
            await updateDoc(doc(db, 'grupos_profesor', grupo.id), {
                columnas, celdas, grupoColOculta: ocultarGrupo
            });
            setGuardadoOk(true);
            setIsDirty(false);
            setTimeout(() => setGuardadoOk(false), 2500);
            if (onSaved) onSaved();
        } catch (e) { alert('Error al guardar: ' + e.message); }
        setGuardando(false);
    };

    const exportar = () => {
        const cabecera = ['Nombre', 'Grupo', ...columnas.map(c => c.header), 'Nota Final'];
        const filas = alumnos.map(a => [
            a.nombre, a.grupo,
            ...columnas.map(c => getValor(a.id, c)),
            notaFinal(a.id)
        ]);
        const mediaFila = ['Media clase', '', ...columnas.map(c => mediaCol(c)), notaFinalMedia()];
        const ws = XLSX.utils.aoa_to_sheet([cabecera, ...filas, [], mediaFila]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, grupo.nombre);
        XLSX.writeFile(wb, `${grupo.nombre}.xlsx`);
    };

    // ── Render cabecera de columna dinámica ──────────────────────────────────
    const renderTh = (col) => {
        if (col.oculta) {
            return (
                <th key={col.id}
                    style={{ ...tt.thDin, minWidth:24, maxWidth:24, width:24, padding:'4px 2px', cursor:'pointer' }}
                    title={`${col.header} — clic para mostrar`}
                    onClick={() => actualizarColumna(col.id, { oculta: false })}>
                    <div style={{ writingMode:'vertical-rl', transform:'rotate(180deg)', fontSize:'0.6rem', lineHeight:1.1, userSelect:'none' }}>
                        {col.header.slice(0, 8)}
                    </div>
                    <ChevronRight size={9} style={{ marginTop:3 }}/>
                </th>
            );
        }
        return (
            <th key={col.id} style={{ ...tt.thDin, minWidth:130, verticalAlign:'top' }}>
                {/* Nombre editable */}
                {editHeader === col.id ? (
                    <input autoFocus value={tempHeader}
                        onChange={e => setTempHeader(e.target.value)}
                        onBlur={() => { actualizarColumna(col.id, { header: tempHeader || col.header }); setEditHeader(null); }}
                        onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === 'Escape') {
                                actualizarColumna(col.id, { header: tempHeader || col.header });
                                setEditHeader(null);
                            }
                        }}
                        style={{ background:'rgba(255,255,255,0.2)', border:'none', borderBottom:'2px solid white', color:'white', fontWeight:700, fontSize:'0.8rem', width:'90%', outline:'none', padding:'2px 4px', textAlign:'center' }}
                    />
                ) : (
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:4, cursor:'pointer', marginBottom:5 }}
                        onClick={() => { setEditHeader(col.id); setTempHeader(col.header); }}>
                        {col.header}
                        <Edit2 size={10} style={{ opacity:0.6 }}/>
                    </div>
                )}

                {/* % peso o fórmula */}
                {col.esFormula ? (
                    <input
                        value={col.formula}
                        onChange={e => actualizarColumna(col.id, { formula: e.target.value })}
                        placeholder="PROMEDIO(T1,T2)"
                        title="Fórmulas: PROMEDIO(Col1,Col2), MAX(...), MIN(...)"
                        style={tt.formulaInput}
                    />
                ) : (
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:3, marginBottom:4 }}>
                        <span style={{ fontSize:'0.62rem', opacity:0.75 }}>%</span>
                        <input
                            type="number" min={0} max={100}
                            value={col.porcentaje ?? ''}
                            onChange={e => {
                                const v = e.target.value === ''
                                    ? null
                                    : Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                actualizarColumna(col.id, { porcentaje: v });
                            }}
                            placeholder="—"
                            title="Peso en nota final (vacío = no cuenta)"
                            style={tt.pctInput}
                        />
                    </div>
                )}

                {/* Botones */}
                <div style={{ display:'flex', gap:2, justifyContent:'center', marginTop:3 }}>
                    <button
                        onClick={() => actualizarColumna(col.id, { esFormula: !col.esFormula })}
                        title={col.esFormula ? 'Modo valor manual' : 'Modo fórmula'}
                        style={{ ...tt.thBtn, background: col.esFormula ? 'rgba(243,156,18,0.55)' : 'rgba(255,255,255,0.15)', fontSize:'0.75rem', fontWeight:700 }}>
                        ƒ
                    </button>
                    <button
                        onClick={() => actualizarColumna(col.id, { oculta: true })}
                        title="Ocultar columna"
                        style={tt.thBtn}>
                        <EyeOff size={10}/>
                    </button>
                    <button
                        onClick={() => eliminarColumna(col.id)}
                        title="Eliminar columna"
                        style={{ ...tt.thBtn, background:'rgba(231,76,60,0.45)' }}>
                        <X size={10}/>
                    </button>
                </div>
            </th>
        );
    };

    const hayPorcentajes = columnas.some(c => c.porcentaje != null && Number(c.porcentaje) > 0);
    const totalPct = columnas.reduce((s, c) => s + (Number(c.porcentaje) || 0), 0);

    return (
        <div>
            {/* Barra de herramientas */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <h3 style={{ margin:0, color:'#2c3e50', fontSize:'1.05rem' }}>
                        <Users size={16} style={{ verticalAlign:'middle', marginRight:6 }} color="#1565C0"/>
                        {grupo.nombre}
                        <span style={{ color:'#7f8c8d', fontWeight:400 }}> · {alumnos.length} alumnos</span>
                    </h3>
                    {hayPorcentajes && (
                        <span style={{
                            fontSize:'0.72rem', padding:'2px 8px', borderRadius:20,
                            background: totalPct === 100 ? '#e8f5e9' : '#fff3e0',
                            color: totalPct === 100 ? '#2e7d32' : '#e65100',
                            fontWeight:600, border: `1px solid ${totalPct===100?'#a5d6a7':'#ffcc80'}`
                        }}>
                            Σ% = {totalPct}%{totalPct !== 100 ? ' ≠ 100' : ' ✓'}
                        </span>
                    )}
                </div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    <button onClick={ocultarTodas} style={bt.secondary} title="Ocultar todas las columnas">
                        <EyeOff size={13}/> Ocultar todo
                    </button>
                    <button onClick={mostrarTodas} style={bt.secondary} title="Mostrar todas las columnas">
                        <Eye size={13}/> Mostrar todo
                    </button>
                    <button onClick={añadirColumna} style={bt.primary}>
                        <Plus size={14}/> Columna
                    </button>
                    <button onClick={exportar} style={bt.secondary}>⬇ .xlsx</button>
                    {isDirty && !guardando && !guardadoOk && (
                        <span style={{ fontSize:'0.75rem', color:'#e65100', fontWeight:600, alignSelf:'center' }}>
                            ● Sin guardar
                        </span>
                    )}
                    <button onClick={guardar} disabled={guardando}
                        style={{ ...bt.save, background: guardadoOk ? '#27ae60' : isDirty ? '#e65100' : '#1565C0' }}>
                        {guardadoOk
                            ? <><CheckCircle size={14}/> Guardado</>
                            : guardando ? 'Guardando…'
                            : <><Save size={14}/> Guardar</>}
                    </button>
                </div>
            </div>

            {/* Tabla */}
            <div style={{ overflowX:'auto', borderRadius:12, boxShadow:'0 2px 10px rgba(0,0,0,0.08)' }}>
                <table style={{ borderCollapse:'collapse', fontSize:'0.83rem', minWidth:300 }}>
                    <thead>
                        <tr style={{ background:'#1565C0' }}>
                            <th style={{ ...tt.thFijo, minWidth:180 }}>Nombre</th>
                            {ocultarGrupo ? (
                                <th style={{ ...tt.thFijo, minWidth:24, maxWidth:24, width:24, padding:'4px 2px', cursor:'pointer' }}
                                    title="Grupo — clic para mostrar"
                                    onClick={() => toggleOcultarGrupo(false)}>
                                    <div style={{ writingMode:'vertical-rl', transform:'rotate(180deg)', fontSize:'0.6rem', lineHeight:1.1, userSelect:'none' }}>Grupo</div>
                                    <ChevronRight size={9} style={{ marginTop:3 }}/>
                                </th>
                            ) : (
                                <th style={{ ...tt.thFijo, minWidth:80 }}>
                                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:4 }}>
                                        Grupo
                                        <button onClick={() => toggleOcultarGrupo(true)} title="Ocultar columna Grupo"
                                            style={{ ...tt.thBtn, background:'rgba(255,255,255,0.2)' }}>
                                            <EyeOff size={10}/>
                                        </button>
                                    </div>
                                </th>
                            )}
                            {columnas.map(col => renderTh(col))}
                            <th style={tt.thMedia}>
                                Nota Final
                                {hayPorcentajes && (
                                    <div style={{ fontSize:'0.62rem', opacity:0.8, fontWeight:400 }}>ponderada</div>
                                )}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {alumnos.map((a, i) => {
                            const nf = notaFinal(a.id);
                            return (
                                <tr key={a.id} style={{ background: i%2===0 ? 'white' : '#f8f9fa' }}>
                                    <td style={tt.tdFijo}>{a.nombre}</td>
                                    {ocultarGrupo
                                        ? <td style={tt.tdOculto}/>
                                        : <td style={{ ...tt.tdFijo, color:'#7f8c8d', textAlign:'center' }}>{a.grupo}</td>}
                                    {columnas.map(col => {
                                        if (col.oculta) return <td key={col.id} style={tt.tdOculto}/>;
                                        if (col.esFormula) {
                                            const val = evaluarFormula(col.formula || '', a.id);
                                            return (
                                                <td key={col.id} style={{ ...tt.tdMedia, background: i%2===0?'white':'#f8f9fa' }}>
                                                    <span style={{ color:'#6d28d9', fontWeight:600 }}>{val || '—'}</span>
                                                </td>
                                            );
                                        }
                                        return (
                                            <td key={col.id} style={tt.tdEdit}>
                                                <input
                                                    value={getCelda(a.id, col.id)}
                                                    onChange={e => setCelda(a.id, col.id, e.target.value)}
                                                    style={tt.cellInput}
                                                />
                                            </td>
                                        );
                                    })}
                                    <td style={tt.tdMedia}>
                                        {nf === '' ? '—' : (
                                            <span style={{ fontWeight:700, color: parseFloat(nf)>=5 ? '#27ae60' : '#e74c3c' }}>
                                                {nf}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}

                        {/* Separador */}
                        <tr>
                            <td colSpan={3 + columnas.length + 1}
                                style={{ background:'#e8f0fe', height:4, padding:0 }}/>
                        </tr>

                        {/* Media clase */}
                        <tr style={{ background:'#e8f0fe', fontWeight:700 }}>
                            <td style={{ ...tt.tdFijo, color:'#1565C0', fontSize:'0.8rem' }}>MEDIA CLASE</td>
                            {ocultarGrupo ? <td style={tt.tdOculto}/> : <td style={tt.tdFijo}></td>}
                            {columnas.map(col =>
                                col.oculta
                                    ? <td key={col.id} style={tt.tdOculto}/>
                                    : <td key={col.id} style={{ ...tt.tdMedia, color:'#1565C0' }}>
                                        {mediaCol(col) || '—'}
                                      </td>
                            )}
                            <td style={{ ...tt.tdMedia, color:'#1565C0', fontWeight:700 }}>
                                {notaFinalMedia() || '—'}
                            </td>
                        </tr>

                        {/* Notas libres */}
                        <tr style={{ background:'#fffde7' }}>
                            <td style={{ ...tt.tdFijo, color:'#856404', fontSize:'0.78rem' }}>NOTAS</td>
                            {ocultarGrupo ? <td style={tt.tdOculto}/> : <td style={tt.tdFijo}></td>}
                            {columnas.map(col =>
                                col.oculta
                                    ? <td key={col.id} style={tt.tdOculto}/>
                                    : <td key={col.id} style={tt.tdEdit}>
                                        <input
                                            value={getCelda('__nota__', col.id)}
                                            onChange={e => setCelda('__nota__', col.id, e.target.value)}
                                            placeholder="…"
                                            style={{ ...tt.cellInput, background:'#fffde7', color:'#856404' }}
                                        />
                                      </td>
                            )}
                            <td style={tt.tdMedia}></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Leyenda fórmulas */}
            <div style={{ marginTop:10, fontSize:'0.72rem', color:'#95a5a6' }}>
                Fórmulas disponibles: <code>PROMEDIO(Col1,Col2)</code> · <code>MAX(Col1,Col2)</code> · <code>MIN(Col1,Col2)</code>
                {' · usa el nombre exacto de la columna'}
            </div>

            <style>{`@keyframes spin { 100%{ transform:rotate(360deg); } }`}</style>
        </div>
    );
}

// ─── Tab principal de Grupos ──────────────────────────────────────────────────
export default function GruposTab({ usuario, googleToken }) {
    const [grupos,           setGrupos]           = useState([]);
    const [cargando,         setCargando]         = useState(true);
    const [modalCrear,       setModalCrear]       = useState(false);
    const [grupoEditar,      setGrupoEditar]      = useState(null);
    const [subpestañaActiva, setSubpestañaActiva] = useState(null);
    const [borrando,         setBorrando]         = useState(null);
    const [confirmarBorrar,  setConfirmarBorrar]  = useState(null);
    const [hayCambios,       setHayCambios]       = useState(false);
    const [avisoTab,         setAvisoTab]         = useState(null); // id de pestaña a la que se quiere ir

    const tabsRef = useRef();
    const scrollTabs = (dir) =>
        tabsRef.current?.scrollBy({ left: dir * 180, behavior: 'smooth' });

    const cargar = useCallback(async () => {
        setCargando(true);
        try {
            const snap = await getDocs(query(
                collection(db, 'grupos_profesor'),
                where('profesorUid', '==', usuario.uid)
            ));
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            docs.sort((a, b) => (b.fechaCreacion?.seconds || 0) - (a.fechaCreacion?.seconds || 0));
            setGrupos(docs);
            setSubpestañaActiva(prev => {
                if (prev && docs.some(g => g.id === prev)) return prev;
                return docs[0]?.id || null;
            });
        } catch (e) { console.error(e); }
        setCargando(false);
    }, [usuario.uid]);

    useEffect(() => { cargar(); }, [cargar]);

    const borrar = async (id) => {
        setBorrando(id);
        try {
            await deleteDoc(doc(db, 'grupos_profesor', id));
            const restantes = grupos.filter(g => g.id !== id);
            setGrupos(restantes);
            if (subpestañaActiva === id) setSubpestañaActiva(restantes[0]?.id || null);
        } catch (e) { alert('Error: ' + e.message); }
        setBorrando(null); setConfirmarBorrar(null);
    };

    const grupoActivo = grupos.find(g => g.id === subpestañaActiva);

    return (
        <div>
            {/* ── Barra de subpestañas con flechas ───────────────────────── */}
            <div style={{ display:'flex', alignItems:'stretch', borderBottom:'2px solid #e0e4f0', marginBottom:0 }}>

                {/* Flecha izquierda */}
                <button onClick={() => scrollTabs(-1)} style={bt.arrowTab} title="Desplazar izquierda">
                    <ChevronLeft size={16}/>
                </button>

                {/* Contenedor scrollable de tabs */}
                <div ref={tabsRef}
                    style={{ display:'flex', flex:1, overflowX:'hidden', gap:0, scrollBehavior:'smooth' }}>
                    {cargando ? (
                        <div style={{ padding:'10px 16px', color:'#95a5a6', fontSize:'0.85rem' }}>Cargando…</div>
                    ) : grupos.length === 0 ? (
                        <div style={{ padding:'10px 16px', color:'#bdc3c7', fontSize:'0.85rem' }}>Sin grupos →</div>
                    ) : grupos.map(g => (
                        <div key={g.id} style={{ display:'flex', alignItems:'center', flexShrink:0 }}>
                            <button
                                onClick={() => {
                                    if (g.id === subpestañaActiva) return;
                                    if (hayCambios) { setAvisoTab(g.id); return; }
                                    setSubpestañaActiva(g.id);
                                }}
                                style={{
                                    padding:'9px 14px', border:'none', background:'none', cursor:'pointer',
                                    fontWeight: subpestañaActiva===g.id ? 700 : 400,
                                    color: subpestañaActiva===g.id ? '#1565C0' : '#7f8c8d',
                                    borderBottom: subpestañaActiva===g.id ? '3px solid #1565C0' : '3px solid transparent',
                                    marginBottom:-2, fontSize:'0.88rem', whiteSpace:'nowrap', transition:'all 0.15s'
                                }}
                            >
                                👥 {g.nombre}
                                {subpestañaActiva === g.id && hayCambios && (
                                    <span style={{ marginLeft:4, color:'#e65100', fontSize:'0.75rem' }}>●</span>
                                )}
                                <span style={{ marginLeft:5, fontSize:'0.7rem', color:'#bdc3c7' }}>
                                    {g.alumnos?.length || 0}
                                </span>
                            </button>

                            {/* Editar / eliminar solo en la pestaña activa */}
                            {subpestañaActiva === g.id && (
                                <div style={{ display:'flex', gap:2, marginBottom:2, paddingRight:4 }}>
                                    <button onClick={() => setGrupoEditar(g)} title="Editar grupo"
                                        style={{ background:'none', border:'none', cursor:'pointer', color:'#f39c12', padding:'2px 4px' }}>
                                        <Edit2 size={12}/>
                                    </button>
                                    {confirmarBorrar === g.id ? (
                                        <>
                                            <button onClick={() => borrar(g.id)} disabled={borrando === g.id}
                                                style={{ padding:'2px 7px', borderRadius:5, border:'none', background:'#e74c3c', color:'white', cursor:'pointer', fontSize:'0.73rem', fontWeight:700 }}>
                                                {borrando===g.id ? '…' : 'Eliminar'}
                                            </button>
                                            <button onClick={() => setConfirmarBorrar(null)}
                                                style={{ padding:'2px 7px', borderRadius:5, border:'1px solid #ddd', background:'white', cursor:'pointer', fontSize:'0.73rem' }}>
                                                No
                                            </button>
                                        </>
                                    ) : (
                                        <button onClick={() => setConfirmarBorrar(g.id)} title="Eliminar grupo"
                                            style={{ background:'none', border:'none', cursor:'pointer', color:'#e74c3c', padding:'2px 4px' }}>
                                            <Trash2 size={12}/>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Flecha derecha */}
                <button onClick={() => scrollTabs(1)} style={bt.arrowTab} title="Desplazar derecha">
                    <ChevronRight size={16}/>
                </button>

                {/* Botón crear */}
                <button onClick={() => setModalCrear(true)}
                    style={{ ...bt.primary, margin:'4px 8px', whiteSpace:'nowrap', flexShrink:0 }}>
                    <Plus size={14}/> Crear Grupo
                </button>
            </div>

            {/* ── Tabla del grupo activo ──────────────────────────────────── */}
            <div style={{ marginTop:20 }}>
                {cargando ? (
                    <div style={{ textAlign:'center', padding:'50px 0', color:'#95a5a6' }}>
                        <RefreshCw size={28} style={{ animation:'spin 1s linear infinite', display:'block', margin:'0 auto 12px' }}/>
                        Cargando grupos…
                    </div>
                ) : !grupoActivo ? (
                    <div style={{ background:'white', borderRadius:14, padding:'40px 20px', textAlign:'center', color:'#95a5a6', boxShadow:'0 2px 8px rgba(0,0,0,0.05)' }}>
                        <div style={{ fontSize:'2.5rem', marginBottom:10 }}>👥</div>
                        <div style={{ fontWeight:600, marginBottom:6 }}>Sin grupos todavía</div>
                        <div style={{ fontSize:'0.85rem' }}>Pulsa "Crear Grupo" para empezar.</div>
                    </div>
                ) : (
                    <TablaGrupo
                        key={grupoActivo.id}
                        grupo={grupoActivo}
                        profesorUid={usuario.uid}
                        onSaved={() => { setHayCambios(false); cargar(); }}
                        onDirtyChange={setHayCambios}
                    />
                )}
            </div>

            {/* ── Modal aviso cambios sin guardar ──────────────────────────── */}
            {avisoTab && (
                <div style={ms.overlay} onClick={() => setAvisoTab(null)}>
                    <div style={{ ...ms.panel, maxWidth:380, textAlign:'center' }} onClick={e => e.stopPropagation()}>
                        <div style={{ fontSize:'2rem', marginBottom:10 }}>⚠️</div>
                        <h3 style={{ margin:'0 0 10px', color:'#2c3e50' }}>Cambios sin guardar</h3>
                        <p style={{ color:'#7f8c8d', fontSize:'0.9rem', marginBottom:20 }}>
                            Hay cambios pendientes en este grupo. Si cambias de pestaña se perderán.
                        </p>
                        <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
                            <button
                                onClick={() => setAvisoTab(null)}
                                style={ms.btnSecundario}>
                                Volver a guardar
                            </button>
                            <button
                                onClick={() => {
                                    setSubpestañaActiva(avisoTab);
                                    setHayCambios(false);
                                    setAvisoTab(null);
                                }}
                                style={{ ...ms.btnGreen, background:'#e74c3c' }}>
                                Cambiar sin guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modales ─────────────────────────────────────────────────── */}
            {(modalCrear || grupoEditar) && (
                <ModalCrearGrupo
                    profesorUid={usuario.uid}
                    grupoExistente={grupoEditar}
                    googleToken={googleToken}
                    onClose={() => { setModalCrear(false); setGrupoEditar(null); }}
                    onSaved={() => { setModalCrear(false); setGrupoEditar(null); cargar(); }}
                />
            )}

            <style>{`@keyframes spin { 100%{ transform:rotate(360deg); } }`}</style>
        </div>
    );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const ms = {
    overlay:      { position:'fixed', inset:0, zIndex:3000, background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 },
    panel:        { background:'white', borderRadius:20, width:'100%', maxWidth:560, padding:28, boxShadow:'0 20px 50px rgba(0,0,0,0.25)', maxHeight:'90vh', overflowY:'auto' },
    header:       { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 },
    closeBtn:     { background:'none', border:'none', cursor:'pointer', color:'#95a5a6', padding:4 },
    label:        { display:'block', fontSize:'0.75rem', fontWeight:700, color:'#7f8c8d', marginBottom:5, textTransform:'uppercase', letterSpacing:.5 },
    input:        { padding:'9px 12px', borderRadius:8, border:'1.5px solid #e0e4f0', fontSize:'0.9rem', outline:'none', width:'100%', boxSizing:'border-box', fontFamily:'inherit' },
    btnGreen:     { display:'flex', alignItems:'center', gap:6, padding:'9px 16px', borderRadius:9, border:'none', background:'#27ae60', color:'white', fontWeight:700, cursor:'pointer', fontSize:'0.88rem' },
    btnBlue:      { display:'flex', alignItems:'center', gap:6, padding:'9px 16px', borderRadius:9, border:'none', background:'#1565C0', color:'white', fontWeight:700, cursor:'pointer', fontSize:'0.88rem' },
    btnGoogle:    { display:'flex', alignItems:'center', gap:6, padding:'9px 16px', borderRadius:9, border:'1.5px solid #34a853', background:'white', color:'#188038', fontWeight:700, cursor:'pointer', fontSize:'0.88rem' },
    btnSecundario:{ padding:'9px 16px', borderRadius:9, border:'1px solid #bdc3c7', background:'white', color:'#7f8c8d', fontWeight:700, cursor:'pointer', fontSize:'0.88rem' },
    th:           { padding:'8px 10px', textAlign:'left', fontWeight:600, fontSize:'0.78rem', color:'#7f8c8d' },
    td:           { padding:'7px 10px', color:'#2c3e50' },
};

const bt = {
    primary:   { display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:9, border:'none', background:'#1565C0', color:'white', fontWeight:700, cursor:'pointer', fontSize:'0.85rem' },
    secondary: { display:'flex', alignItems:'center', gap:5, padding:'8px 12px', borderRadius:9, border:'1px solid #bdc3c7', background:'white', color:'#555', fontWeight:600, cursor:'pointer', fontSize:'0.82rem' },
    save:      { display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:9, border:'none', color:'white', fontWeight:700, cursor:'pointer', fontSize:'0.85rem', transition:'background 0.3s' },
    arrowTab:  { display:'flex', alignItems:'center', justifyContent:'center', padding:'0 6px', border:'none', background:'none', cursor:'pointer', color:'#95a5a6', flexShrink:0, transition:'color 0.15s' },
};

const tt = {
    thFijo:      { padding:'10px 12px', textAlign:'left', color:'white', fontWeight:700, fontSize:'0.8rem', background:'#1565C0', position:'sticky', top:0 },
    thDin:       { padding:'8px 6px', textAlign:'center', color:'white', fontWeight:700, fontSize:'0.8rem', background:'#1976D2', position:'sticky', top:0, verticalAlign:'middle' },
    thMedia:     { padding:'10px 8px', textAlign:'center', color:'white', fontWeight:700, fontSize:'0.8rem', background:'#0d47a1', position:'sticky', top:0, minWidth:90 },
    thBtn:       { display:'inline-flex', alignItems:'center', justifyContent:'center', padding:'2px 5px', borderRadius:4, border:'none', cursor:'pointer', color:'white', background:'rgba(255,255,255,0.2)', minWidth:20 },
    pctInput:    { width:40, fontSize:'0.72rem', padding:'2px 3px', borderRadius:4, border:'1px solid rgba(255,255,255,0.4)', background:'rgba(0,0,0,0.2)', color:'white', outline:'none', textAlign:'center' },
    formulaInput:{ width:'90%', fontSize:'0.68rem', padding:'3px 5px', borderRadius:4, border:'1px solid rgba(243,156,18,0.7)', background:'rgba(0,0,0,0.25)', color:'white', outline:'none', textAlign:'center', marginBottom:2, display:'block', margin:'0 auto 4px' },
    tdFijo:      { padding:'7px 12px', borderBottom:'1px solid #f0f0f0', color:'#2c3e50', fontWeight:500, whiteSpace:'nowrap' },
    tdEdit:      { padding:'3px 4px', borderBottom:'1px solid #f0f0f0' },
    tdMedia:     { padding:'7px 8px', borderBottom:'1px solid #f0f0f0', textAlign:'center', fontSize:'0.85rem', color:'#555' },
    tdOculto:    { minWidth:24, maxWidth:24, width:24, padding:0, borderBottom:'1px solid #f0f0f0', background:'#f4f6f8' },
    cellInput:   { width:'100%', border:'none', borderRadius:4, padding:'5px 7px', fontSize:'0.83rem', textAlign:'center', background:'transparent', outline:'none', boxSizing:'border-box', color:'#2c3e50', fontFamily:'inherit' },
};
