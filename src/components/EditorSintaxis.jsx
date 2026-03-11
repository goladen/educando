import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, doc, setDoc, getDocs, query, where } from 'firebase/firestore';
import { Save, X, Trash2, FolderPlus, Settings, Plus, FileText,
         ChevronDown, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { CATEGORIAS, NIVELES } from '../BibliotecaFrases';

// ──────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────
const generarCodigo = () =>
    Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('');

const nivelOpciones = NIVELES.filter(n => n.id !== null);

// Frase vacía para el constructor
const fraseVacia = () => ({ texto: '', tokens: [], nivel: 'eso' });

// ──────────────────────────────────────────────────────────
// EDITOR PRINCIPAL
// ──────────────────────────────────────────────────────────
export default function EditorSintaxis({ datos, setDatos, onClose, usuario }) {
    const [hojaActiva, setHojaActiva]         = useState(0);
    const [mostrandoConfig, setMostrandoConfig] = useState(false);
    const [guardando, setGuardando]           = useState(false);
    const [guardadoOk, setGuardadoOk]         = useState(false);

    // Estado del constructor de frases
    const [fraseEnConstruccion, setFraseEnConstruccion] = useState(fraseVacia());
    const [tokenActivo, setTokenActivo]       = useState(null);   // índice del token seleccionado
    const [inputFrase, setInputFrase]         = useState('');
    const inputRef = useRef(null);

    // ── Inicialización ──────────────────────────────────
    useEffect(() => {
        setDatos(prev => ({
            ...prev,
            tipo: 'SINTAXIS',
            tipoJuego: 'SINTAXIS',
            pais:       prev.pais       || usuario?.pais       || '',
            region:     prev.region     || usuario?.region     || '',
            poblacion:  prev.poblacion  || usuario?.poblacion  || usuario?.localidad || '',
            ciclo:      prev.ciclo      || usuario?.ciclo      || 'Secundaria',
            temas:      prev.temas      || usuario?.temasPreferidos || '',
            profesorNombre: prev.profesorNombre || usuario?.displayName || usuario?.nombre || '',
            hojas: (!prev.hojas || prev.hojas.length === 0)
                ? [{ nombreHoja: 'Grupo 1', frases: [] }]
                : prev.hojas,
        }));
    }, []);

    // ── Guardar en Firestore ────────────────────────────
    const guardar = async () => {
        if (!datos.titulo?.trim()) return alert('Introduce un título para el recurso.');
        const hojas = datos.hojas || [];
        const todasFrases = hojas.flatMap(h => h.frases || []);
        if (todasFrases.length === 0) return alert('Añade al menos una frase antes de guardar.');

        setGuardando(true);
        try {
            const ref = collection(db, 'resources');

            let docId = datos.id;
            let code = datos.accessCode;

            if (!code) {
                const checkRef = collection(db, 'resources');
                let intento = generarCodigo();
                const snap = await getDocs(query(checkRef, where('accessCode', '==', intento)));
                if (!snap.empty) intento = generarCodigo() + Math.floor(Math.random() * 9);
                code = intento;
            }
            if (!docId) docId = `sint_${Date.now()}`;

            const payload = {
                ...datos,
                id: docId,
                accessCode: code,
                profesorUid: usuario?.uid || '',
                frases: todasFrases,
                hojas: hojas,
                creadoEn: datos.creadoEn || Date.now(),
                actualizadoEn: Date.now(),
            };

            await setDoc(doc(ref, docId), payload);
            setDatos({ ...payload });
            setGuardadoOk(true);
            setTimeout(() => setGuardadoOk(false), 3000);
        } catch (e) {
            console.error(e);
            if (e.code === 'permission-denied' || e.message?.includes('permissions')) {
                alert('Sin permisos de escritura en "resources".');
            } else {
                alert('Error al guardar: ' + e.message);
            }
        }
        setGuardando(false);
    };

    // ── Gestión de Hojas ────────────────────────────────
    const addHoja = () => {
        const hojas = [...(datos.hojas || []), { nombreHoja: `Grupo ${(datos.hojas?.length||0)+1}`, frases: [] }];
        setDatos({ ...datos, hojas });
        setHojaActiva(hojas.length - 1);
    };
    const deleteHoja = (idx) => {
        if ((datos.hojas?.length || 0) <= 1) return alert('Debe haber al menos un grupo.');
        if (!window.confirm('¿Borrar este grupo y sus frases?')) return;
        const hojas = datos.hojas.filter((_, i) => i !== idx);
        setDatos({ ...datos, hojas });
        setHojaActiva(0);
    };
    const renameHoja = (idx, val) => {
        const hojas = [...datos.hojas]; hojas[idx].nombreHoja = val;
        setDatos({ ...datos, hojas });
    };

    // ── Constructor de Frases ───────────────────────────
    const tokenizar = () => {
        const texto = inputFrase.trim();
        if (!texto) return;
        const tokens = texto.split(/\s+/).map(t => ({
            text: t,
            funcion: []
        }));
        setFraseEnConstruccion({ texto, tokens, nivel: fraseEnConstruccion.nivel });
        setTokenActivo(null);
        setInputFrase('');
    };

    const asignarFuncion = (funcion) => {
        if (tokenActivo === null) return;
        const tokens = fraseEnConstruccion.tokens.map((t, i) => {
            if (i !== tokenActivo) return t;
            const ya = t.funcion.includes(funcion);
            if (ya) return { ...t, funcion: t.funcion.filter(f => f !== funcion) };
            if (t.funcion.length >= 2) return { ...t, funcion: [t.funcion[1], funcion] }; // rota
            return { ...t, funcion: [...t.funcion, funcion] };
        });
        setFraseEnConstruccion({ ...fraseEnConstruccion, tokens });
    };

    const limpiarFuncionesToken = (i) => {
        const tokens = fraseEnConstruccion.tokens.map((t, idx) =>
            idx === i ? { ...t, funcion: [] } : t
        );
        setFraseEnConstruccion({ ...fraseEnConstruccion, tokens });
    };

    const validarFrase = () => {
        const { tokens } = fraseEnConstruccion;
        if (!tokens.length) return 'Escribe una frase y pulsa «Tokenizar»';
        const sinFuncion = tokens.filter(t => t.funcion.length === 0);
        if (sinFuncion.length > 0) return `${sinFuncion.length} palabra(s) sin función asignada`;
        return null; // válido
    };

    const añadirFrase = () => {
        const error = validarFrase();
        if (error) return alert('⚠️ ' + error);
        const { tokens, nivel } = fraseEnConstruccion;
        const frase = {
            tokens: tokens.map(t => ({ text: t.text, funcion: t.funcion })),
            nivel,
            id: Date.now(),
        };
        const hojas = datos.hojas.map((h, i) =>
            i !== hojaActiva ? h : { ...h, frases: [...(h.frases||[]), frase] }
        );
        setDatos({ ...datos, hojas });
        setFraseEnConstruccion(fraseVacia());
        setTokenActivo(null);
    };

    const borrarFrase = (fraseId) => {
        const hojas = datos.hojas.map((h, i) =>
            i !== hojaActiva ? h : { ...h, frases: (h.frases||[]).filter(f => f.id !== fraseId) }
        );
        setDatos({ ...datos, hojas });
    };

    const limpiarConstructor = () => {
        setFraseEnConstruccion(fraseVacia());
        setTokenActivo(null);
    };

    // ── Render ──────────────────────────────────────────
    const hojaActual = datos.hojas?.[hojaActiva] || { frases: [] };
    const errorFrase = fraseEnConstruccion.tokens.length ? validarFrase() : null;
    const totalFrases = (datos.hojas||[]).flatMap(h=>h.frases||[]).length;

    return (
        <div style={st.overlay}>
            <div style={st.container}>

                {/* ── HEADER ── */}
                <div style={st.header}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, flex:1, minWidth:0 }}>
                        <FileText size={22}/>
                        <span style={{ fontWeight:'bold', whiteSpace:'nowrap' }}>Editor Sintaxis</span>
                        <input
                            placeholder="Título del Recurso..."
                            value={datos.titulo || ''}
                            onChange={e => setDatos({ ...datos, titulo: e.target.value })}
                            style={st.titleInput}
                        />
                    </div>
                    <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
                        {guardadoOk && (
                            <span style={{ color:'#a8ffc4', fontSize:'0.82rem', display:'flex', alignItems:'center', gap:4 }}>
                                <CheckCircle size={14}/> Guardado
                            </span>
                        )}
                        <button onClick={() => setMostrandoConfig(true)} style={st.iconBtn} title="Configuración">
                            <Settings size={20}/>
                        </button>
                        <button onClick={guardar} disabled={guardando} style={st.saveBtn}>
                            {guardando ? <RefreshCw size={16} style={{animation:'spin 1s linear infinite'}}/> : <Save size={16}/>}
                            {guardando ? 'Guardando...' : 'Guardar'}
                        </button>
                        <button onClick={onClose} style={st.iconBtn}><X size={22}/></button>
                    </div>
                </div>

                {/* ── TABS ── */}
                <div style={st.tabsBar}>
                    {datos.hojas?.map((h, i) => (
                        <div key={i} onClick={() => setHojaActiva(i)} style={{
                            ...st.tab,
                            background: i === hojaActiva ? 'white' : '#e8eaf6',
                            borderBottom: i === hojaActiva ? '3px solid #3498db' : 'none',
                            color: i === hojaActiva ? '#1a237e' : '#666',
                        }}>
                            <input
                                value={h.nombreHoja}
                                onChange={e => renameHoja(i, e.target.value)}
                                style={st.tabInput}
                                onClick={e => e.stopPropagation()}
                            />
                            <span style={{ fontSize:'0.7rem', color:'#999' }}>({(h.frases||[]).length})</span>
                            {(datos.hojas?.length||0) > 1 && (
                                <Trash2 size={13} onClick={e => { e.stopPropagation(); deleteHoja(i); }}
                                    style={{ cursor:'pointer', color:'#c62828', marginLeft:2 }}/>
                            )}
                        </div>
                    ))}
                    <button onClick={addHoja} style={st.addTabBtn} title="Nuevo grupo">
                        <FolderPlus size={19}/>
                    </button>
                </div>

                {/* ── BODY ── */}
                <div style={st.body}>

                    {/* Código de acceso */}
                    <div style={st.codeCard}>
                        <div>
                            <div style={{ fontWeight:'bold', color:'#3498db', fontSize:'0.9rem' }}>Código de Acceso</div>
                            <div style={{ fontSize:'0.75rem', color:'#888', marginTop:2 }}>
                                {totalFrases} frase{totalFrases!==1?'s':''} en total ·
                                Los alumnos buscan el recurso con este código en la app.
                            </div>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                            <span style={{ fontSize:'1.6rem', fontWeight:900, letterSpacing:4, color:'#333' }}>
                                {datos.accessCode || '─────'}
                            </span>
                            {!datos.accessCode && (
                                <span style={{ fontSize:'0.7rem', color:'#e74c3c' }}>Se genera al guardar</span>
                            )}
                        </div>
                    </div>

                    {/* ── CONSTRUCTOR DE FRASES ── */}
                    <div style={st.panel}>
                        <h3 style={st.panelTitle}>
                            ➕ Añadir nueva frase a «{hojaActual.nombreHoja}»
                        </h3>

                        {/* Paso 1: escribir frase */}
                        <div style={st.step}>
                            <div style={st.stepLabel}>1. Escribe la frase</div>
                            <div style={{ display:'flex', gap:8 }}>
                                <input
                                    ref={inputRef}
                                    value={inputFrase}
                                    onChange={e => setInputFrase(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && tokenizar()}
                                    placeholder="Ej: El niño come una manzana roja"
                                    style={st.inputBig}
                                />
                                <button onClick={tokenizar} style={st.btnBlue}>
                                    Tokenizar
                                </button>
                                {fraseEnConstruccion.tokens.length > 0 && (
                                    <button onClick={limpiarConstructor} style={st.btnGray} title="Limpiar">
                                        <X size={16}/>
                                    </button>
                                )}
                            </div>
                        </div>

                        {fraseEnConstruccion.tokens.length > 0 && (<>

                        {/* Paso 2: nivel */}
                        <div style={st.step}>
                            <div style={st.stepLabel}>2. Nivel de la frase</div>
                            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                                {nivelOpciones.map(n => (
                                    <button key={n.id} onClick={() => setFraseEnConstruccion(f=>({...f,nivel:n.id}))}
                                        style={{
                                            padding:'6px 16px', borderRadius:20, border:`2px solid ${n.color}`,
                                            background: fraseEnConstruccion.nivel === n.id ? n.color : 'white',
                                            color: fraseEnConstruccion.nivel === n.id ? 'white' : n.color,
                                            fontWeight:'bold', cursor:'pointer', fontSize:'0.85rem',
                                        }}>
                                        {n.emoji} {n.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Paso 3: asignar funciones */}
                        <div style={st.step}>
                            <div style={st.stepLabel}>3. Haz clic en una palabra y asigna su función</div>

                            {/* Tokens */}
                            <div style={{ display:'flex', flexWrap:'wrap', gap:8, padding:'14px', background:'#f8f9fa', borderRadius:12, marginBottom:12 }}>
                                {fraseEnConstruccion.tokens.map((t, i) => {
                                    const selec = tokenActivo === i;
                                    const color1 = t.funcion[0] ? CATEGORIAS[t.funcion[0]]?.color : null;
                                    const color2 = t.funcion[1] ? CATEGORIAS[t.funcion[1]]?.color : null;
                                    const bg = color1
                                        ? (color2 ? `linear-gradient(135deg,${color1} 50%,${color2} 50%)` : color1)
                                        : (selec ? '#e3f2fd' : 'white');
                                    return (
                                        <div key={i}
                                            onClick={() => setTokenActivo(tokenActivo === i ? null : i)}
                                            style={{
                                                padding:'8px 14px', borderRadius:10, cursor:'pointer',
                                                background: bg,
                                                color: color1 ? 'white' : (selec ? '#1565c0' : '#333'),
                                                border: selec ? '3px solid #1565c0' : (color1 ? '3px solid transparent' : '2px dashed #ccc'),
                                                fontWeight:'bold', fontSize:'1rem',
                                                boxShadow: selec ? '0 0 0 3px rgba(21,101,192,0.2)' : 'none',
                                                transition:'all 0.15s', userSelect:'none',
                                            }}>
                                            <div>{t.text}</div>
                                            {t.funcion.length > 0 && (
                                                <div style={{ display:'flex', gap:2, justifyContent:'center', marginTop:3 }}>
                                                    {t.funcion.map(f => (
                                                        <span key={f} style={{ fontSize:'0.7rem' }}>
                                                            {CATEGORIAS[f]?.emoji}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            {t.funcion.length > 0 && (
                                                <div
                                                    onClick={e => { e.stopPropagation(); limpiarFuncionesToken(i); }}
                                                    style={{ position:'absolute', top:-6, right:-6, background:'#e74c3c', color:'white',
                                                        borderRadius:'50%', width:16, height:16, display:'none',
                                                        alignItems:'center', justifyContent:'center', fontSize:'0.65rem', cursor:'pointer' }}>
                                                    ×
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Paleta de funciones (visible cuando hay token activo) */}
                            {tokenActivo !== null && (
                                <div style={{ background:'#fff3e0', borderRadius:12, padding:'12px 14px', border:'2px solid #f39c12' }}>
                                    <div style={{ fontSize:'0.8rem', fontWeight:'bold', color:'#e67e22', marginBottom:8 }}>
                                        Asignando función a: <strong style={{ fontSize:'1rem' }}>
                                            «{fraseEnConstruccion.tokens[tokenActivo]?.text}»
                                        </strong>
                                        <span style={{ fontWeight:'normal', color:'#999', fontSize:'0.75rem' }}> · Máx. 2 funciones</span>
                                    </div>
                                    <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
                                        {Object.entries(CATEGORIAS).map(([key, cat]) => {
                                            const sel = fraseEnConstruccion.tokens[tokenActivo]?.funcion.includes(key);
                                            return (
                                                <button key={key} onClick={() => asignarFuncion(key)}
                                                    style={{
                                                        padding:'6px 12px', borderRadius:20, cursor:'pointer',
                                                        fontWeight:'bold', fontSize:'0.78rem',
                                                        background: sel ? cat.color : '#f5f5f5',
                                                        color: sel ? 'white' : '#555',
                                                        border:`2px solid ${cat.color}`,
                                                        transform: sel ? 'scale(1.05)' : 'scale(1)',
                                                        transition:'all 0.12s',
                                                    }}>
                                                    {cat.emoji} {cat.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div style={{ display:'flex', gap:8, marginTop:10 }}>
                                        <button onClick={() => limpiarFuncionesToken(tokenActivo)}
                                            style={{ padding:'5px 12px', borderRadius:20, border:'2px solid #ccc', background:'white', cursor:'pointer', fontSize:'0.75rem', color:'#777' }}>
                                            🗑 Borrar funciones
                                        </button>
                                        <button onClick={() => setTokenActivo(null)}
                                            style={{ padding:'5px 12px', borderRadius:20, border:'none', background:'#e0e0e0', cursor:'pointer', fontSize:'0.75rem' }}>
                                            ✓ Listo
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Paso 4: añadir */}
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginTop:10, flexWrap:'wrap' }}>
                            {errorFrase ? (
                                <div style={{ display:'flex', alignItems:'center', gap:6, color:'#e74c3c', fontSize:'0.82rem' }}>
                                    <AlertCircle size={14}/> {errorFrase}
                                </div>
                            ) : (
                                <div style={{ display:'flex', alignItems:'center', gap:6, color:'#27ae60', fontSize:'0.82rem' }}>
                                    <CheckCircle size={14}/> Frase lista para añadir
                                </div>
                            )}
                            <button onClick={añadirFrase} disabled={!!errorFrase} style={{
                                ...st.btnGreen, opacity: errorFrase ? 0.45 : 1, cursor: errorFrase ? 'not-allowed' : 'pointer',
                            }}>
                                <Plus size={17}/> Añadir Frase
                            </button>
                        </div>

                        </>)}
                    </div>

                    {/* ── LISTA DE FRASES ── */}
                    <div style={st.panel}>
                        <h3 style={st.panelTitle}>
                            📋 Frases en «{hojaActual.nombreHoja}» ({(hojaActual.frases||[]).length})
                        </h3>
                        {(hojaActual.frases||[]).length === 0 ? (
                            <div style={{ textAlign:'center', color:'#bbb', padding:'30px', fontStyle:'italic' }}>
                                Ninguna frase añadida en este grupo.<br/>
                                Usa el constructor de arriba para añadir.
                            </div>
                        ) : (
                            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                                {(hojaActual.frases||[]).map((frase) => {
                                    const nInfo = NIVELES.find(n => n.id === frase.nivel);
                                    return (
                                        <div key={frase.id} style={st.fraseCard}>
                                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                                                <span style={{
                                                    background: nInfo?.color || '#999', color:'white',
                                                    padding:'2px 10px', borderRadius:20, fontSize:'0.72rem', fontWeight:'bold',
                                                }}>
                                                    {nInfo?.emoji} {nInfo?.label}
                                                </span>
                                                <button onClick={() => borrarFrase(frase.id)} style={st.btnDeleteSmall}>
                                                    <Trash2 size={14}/>
                                                </button>
                                            </div>
                                            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                                                {frase.tokens.map((t, i) => {
                                                    const c1 = CATEGORIAS[t.funcion[0]]?.color;
                                                    const c2 = CATEGORIAS[t.funcion[1]]?.color;
                                                    const bg = c1
                                                        ? (c2 ? `linear-gradient(135deg,${c1} 50%,${c2} 50%)` : c1)
                                                        : '#f0f0f0';
                                                    return (
                                                        <div key={i} style={{
                                                            padding:'5px 10px', borderRadius:8,
                                                            background: bg, color: c1 ? 'white' : '#555',
                                                            fontSize:'0.9rem', fontWeight:'bold',
                                                            display:'flex', flexDirection:'column', alignItems:'center', gap:2,
                                                        }}>
                                                            <span>{t.text}</span>
                                                            {t.funcion.length > 0 && (
                                                                <span style={{ fontSize:'0.65rem', opacity:0.85 }}>
                                                                    {t.funcion.map(f=>CATEGORIAS[f]?.label||f).join(' + ')}
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                </div>{/* end body */}

                {/* ── MODAL CONFIGURACIÓN ── */}
                {mostrandoConfig && (
                    <div style={st.modalOverlay}>
                        <div style={st.modal}>
                            <div style={st.modalHeader}>
                                <h3 style={{ margin:0, color:'#2c3e50' }}>⚙️ Configuración del Recurso</h3>
                                <button onClick={() => setMostrandoConfig(false)} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={20}/></button>
                            </div>
                            <div style={st.modalBody}>

                                {/* DATOS DE BÚSQUEDA */}
                                <SectionTitle>Datos de Búsqueda</SectionTitle>
                                <p style={{ fontSize:'0.75rem', color:'#999', marginTop:0 }}>
                                    Estos campos permiten a los alumnos encontrar tu recurso en el buscador de la app.
                                </p>
                                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                                    <InputConf label="País"    val={datos.pais}    set={v=>setDatos({...datos,pais:v})}/>
                                    <InputConf label="Región"  val={datos.region}  set={v=>setDatos({...datos,region:v})}/>
                                </div>
                                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                                    <InputConf label="Localidad"   val={datos.poblacion}      set={v=>setDatos({...datos,poblacion:v})}/>
                                    <InputConf label="Nombre del profesor" val={datos.profesorNombre} set={v=>setDatos({...datos,profesorNombre:v})}/>
                                </div>
                                <InputConf label="Temas (separados por comas)" val={datos.temas} set={v=>setDatos({...datos,temas:v})}/>
                                <div style={{ marginBottom:14 }}>
                                    <label style={st.label}>Ciclo Educativo</label>
                                    <select value={datos.ciclo||'Secundaria'} onChange={e=>setDatos({...datos,ciclo:e.target.value})} style={st.input}>
                                        <option>Infantil</option>
                                        <option>Primaria</option>
                                        <option>Secundaria</option>
                                        <option>Bachillerato</option>
                                        <option>Otros</option>
                                    </select>
                                </div>

                                {/* ESTADO */}
                                <SectionTitle>Estado</SectionTitle>
                                <ToggleRow
                                    label="Terminado (visible para alumnos)"
                                    checked={!!datos.isFinished}
                                    onChange={() => setDatos({...datos, isFinished:!datos.isFinished})}
                                />
                                <ToggleRow
                                    label="Público (permite que otros lo vean y copien)"
                                    checked={!datos.isPrivate}
                                    onChange={() => setDatos({...datos, isPrivate:!datos.isPrivate})}
                                />

                                {/* REFERENCIA DE CATEGORÍAS */}
                                <SectionTitle>Referencia de Colores</SectionTitle>
                                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                                    {Object.entries(CATEGORIAS).map(([k,v]) => (
                                        <div key={k} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 8px', borderRadius:8, background:'#f8f8f8' }}>
                                            <span style={{ width:14, height:14, borderRadius:4, background:v.color, flexShrink:0, display:'inline-block' }}/>
                                            <span style={{ fontSize:'0.78rem', color:'#444' }}>{v.emoji} {v.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <button onClick={() => setMostrandoConfig(false)} style={st.closeBtn}>Aceptar</button>
                        </div>
                    </div>
                )}

            </div>
            <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        </div>
    );
}

// ── Sub-componentes ─────────────────────────────────────
const SectionTitle = ({ children }) => (
    <h4 style={{ margin:'16px 0 8px', color:'#3498db', borderBottom:'2px solid #ebf5fb', paddingBottom:5, fontSize:'0.82rem', textTransform:'uppercase', letterSpacing:'0.5px' }}>
        {children}
    </h4>
);

const InputConf = ({ label, val, set }) => (
    <div style={{ marginBottom:12 }}>
        <label style={{ display:'block', fontSize:'0.75rem', fontWeight:'bold', color:'#555', marginBottom:4 }}>{label}</label>
        <input value={val||''} onChange={e=>set(e.target.value)} style={st.input}/>
    </div>
);

const ToggleRow = ({ label, checked, onChange }) => (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, padding:'10px 12px', background:'#ebf5fb', borderRadius:8 }}>
        <span style={{ fontSize:'0.85rem', color:'#444' }}>{label}</span>
        <input type="checkbox" checked={checked} onChange={onChange} style={{ width:18, height:18, cursor:'pointer' }}/>
    </div>
);

// ── Estilos ─────────────────────────────────────────────
const st = {
    overlay:     { position:'fixed', inset:0, background:'#f0f2f5', zIndex:3000, display:'flex', justifyContent:'center' },
    container:   { display:'flex', flexDirection:'column', height:'100%', width:'100%', maxWidth:940, margin:'0 auto', background:'white', boxShadow:'0 0 20px rgba(0,0,0,0.1)' },

    header:      { background:'#2c3e50', padding:'13px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', color:'white', gap:10 },
    titleInput:  { background:'rgba(255,255,255,0.18)', border:'none', color:'white', fontSize:'1rem', padding:'5px 10px', borderRadius:6, flex:1, outline:'none', '::placeholder':{color:'rgba(255,255,255,0.6)'} },
    iconBtn:     { background:'none', border:'none', color:'white', cursor:'pointer', padding:5 },
    saveBtn:     { background:'#3498db', border:'none', color:'white', padding:'8px 16px', borderRadius:20, display:'flex', alignItems:'center', gap:5, cursor:'pointer', fontWeight:'bold', fontSize:'0.9rem', whiteSpace:'nowrap' },

    tabsBar:     { background:'#ebf5fb', padding:'10px 10px 0', display:'flex', gap:5, overflowX:'auto', borderBottom:'1px solid #d6eaf8' },
    tab:         { padding:'9px 16px', borderRadius:'10px 10px 0 0', cursor:'pointer', fontWeight:'bold', display:'flex', alignItems:'center', gap:6, minWidth:90, flexShrink:0 },
    tabInput:    { border:'none', background:'transparent', fontWeight:'bold', width:80, outline:'none', color:'inherit', fontSize:'0.88rem' },
    addTabBtn:   { padding:'8px 10px', background:'transparent', border:'none', cursor:'pointer', color:'#3498db' },

    body:        { flex:1, padding:'18px 16px', overflowY:'auto', background:'#f8f9fa', display:'flex', flexDirection:'column', gap:16 },

    codeCard:    { background:'white', padding:'14px 18px', borderRadius:12, border:'1px solid #d6eaf8', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 },

    panel:       { background:'white', borderRadius:14, padding:'18px', boxShadow:'0 2px 10px rgba(0,0,0,0.05)' },
    panelTitle:  { margin:'0 0 14px', color:'#2c3e50', fontSize:'1rem', fontWeight:'bold' },

    step:        { marginBottom:16 },
    stepLabel:   { fontWeight:'bold', color:'#3498db', fontSize:'0.82rem', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 },

    inputBig:    { flex:1, padding:'11px 14px', borderRadius:10, border:'2px solid #d6eaf8', fontSize:'1rem', outline:'none' },
    btnBlue:     { background:'#3498db', color:'white', border:'none', borderRadius:10, padding:'0 20px', cursor:'pointer', fontWeight:'bold', fontSize:'0.9rem', whiteSpace:'nowrap', minHeight:44 },
    btnGray:     { background:'#ecf0f1', color:'#555', border:'none', borderRadius:10, padding:'0 12px', cursor:'pointer', minHeight:44, display:'flex', alignItems:'center' },
    btnGreen:    { background:'#27ae60', color:'white', border:'none', borderRadius:20, padding:'10px 22px', cursor:'pointer', fontWeight:'bold', display:'flex', alignItems:'center', gap:6 },

    fraseCard:   { background:'#f8f9fa', borderRadius:12, padding:'12px 14px', border:'1px solid #e0e0e0' },
    btnDeleteSmall: { background:'#fdecea', border:'none', color:'#c0392b', borderRadius:8, padding:'4px 8px', cursor:'pointer', display:'flex', alignItems:'center' },

    // Modal
    modalOverlay:{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:4000, padding:20 },
    modal:       { background:'white', width:'100%', maxWidth:420, borderRadius:14, maxHeight:'90vh', display:'flex', flexDirection:'column', boxShadow:'0 20px 40px rgba(0,0,0,0.2)' },
    modalHeader: { padding:'16px 18px', borderBottom:'1px solid #eee', display:'flex', justifyContent:'space-between', alignItems:'center' },
    modalBody:   { padding:'18px', overflowY:'auto', flex:1 },
    label:       { display:'block', fontSize:'0.78rem', fontWeight:'bold', color:'#555', marginBottom:5 },
    input:       { width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid #ddd', boxSizing:'border-box', fontSize:'0.88rem', outline:'none' },
    closeBtn:    { width:'100%', padding:'14px', background:'#3498db', color:'white', border:'none', borderBottomLeftRadius:14, borderBottomRightRadius:14, fontSize:'1rem', cursor:'pointer', fontWeight:'bold' },
};
