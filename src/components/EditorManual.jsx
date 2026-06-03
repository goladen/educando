import React, { useState, useEffect } from 'react';
import { Save, X, Trash2, Plus, Settings, RotateCcw, HelpCircle, ArrowUp, ArrowDown } from 'lucide-react'; // <--- AÑADIDO HelpCircle
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase'; // Asegúrate de importar db
import PiTutorial from './PiTutorial';
import PublicarModal from './PublicarModal';

const TUTORIAL_CREAR_RECURSO = [
    { texto: '¡Hola! Soy Pi 👋 Para añadir preguntas, pulsa el botón "＋ Añadir Pregunta" en la parte inferior. Cada pregunta tiene un enunciado y una o varias respuestas según el tipo de juego.' },
    { texto: 'Recuerda configurar el tiempo de juego y los puntos desde el botón de ajustes ⚙️ en la esquina superior derecha del editor.' },
    { texto: '¡MUY IMPORTANTE! 🚨 Cuando termines, asegúrate de activar "Publicado" en la configuración del recurso. Sin publicar, tus alumnos no podrán acceder al juego.' },
];
const JUEGOS_DESTINO = [
    { id: 'PASAPALABRA', label: 'Pasapalabra' },
    { id: 'CAZABURBUJAS', label: 'CazaBurbujas' },
    { id: 'THINKHOOT', label: 'ThinkHoot' },
    { id: 'RULETA', label: 'La Ruleta' },
    { id: 'APAREJADOS', label: 'Aparejados' }
];

// --- TEXTOS DE AYUDA POR JUEGO ---
const HELP_CONTENT = {
    PASAPALABRA: "En Pasapalabra, cada pregunta corresponde a una letra del rosco. Rellena la 'Pregunta/Definición' y la 'Respuesta Correcta'. El sistema asigna las letras automáticamente (A, B, C...).",
    CAZABURBUJAS: "Crea preguntas con una respuesta correcta y varias incorrectas. En el juego, los alumnos deben 'explotar' la burbuja con la respuesta correcta antes de que se acabe el tiempo.",
    THINKHOOT: "Juego tipo Quiz. Añade una pregunta, la respuesta correcta y hasta 3 incorrectas. Los alumnos compiten por puntos y velocidad.",
    RULETA: "Define una 'Frase Oculta' en la configuración de la hoja. Luego, añade preguntas cuyas respuestas den pistas o letras para resolver esa frase.",
    APAREJADOS: "Crea parejas de conceptos (A y B). En el juego, los elementos de la columna A y B aparecerán desordenados y el alumno debe unirlos.",
    QUESTION_SENDER: "Esta herramienta no es un juego en sí, sino un 'Buzón'. Comparte el Código de Acceso con tus alumnos para que ellos te envíen preguntas desde sus dispositivos."
};

function PiKTPresentacionPicker({ usuario, presentacionId, onSelect, onClose }) {
    const [lista, setLista] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        if (!usuario?.uid) return;
        getDocs(query(collection(db, 'presentations'), where('uid', '==', usuario.uid)))
            .then(snap => {
                const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                docs.sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0));
                setLista(docs); setLoading(false);
            }).catch(() => setLoading(false));
    }, [usuario?.uid]);
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <div style={{ background: 'white', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 640, maxHeight: '75vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
                    <div style={{ width: 40, height: 4, borderRadius: 2, background: '#E2E8F0' }} />
                </div>
                <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 800, fontSize: 16, color: '#1E1B4B' }}>📊 Seleccionar presentación PiKT</span>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4 }}><X size={22} /></button>
                </div>
                <div style={{ overflowY: 'auto', flex: 1, padding: '0 20px' }}>
                    {loading && <div style={{ textAlign: 'center', padding: 30, color: '#94A3B8' }}>⏳ Cargando…</div>}
                    {!loading && lista.length === 0 && (
                        <div style={{ textAlign: 'center', padding: 30, color: '#94A3B8', fontSize: 13 }}>
                            No tienes presentaciones creadas.<br />Créalas desde el menú "📊 Presentaciones".
                        </div>
                    )}
                    {lista.map(p => (
                        <div key={p.id} onClick={() => onSelect(p.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', marginBottom: 6, borderRadius: 10, border: presentacionId === p.id ? '2px solid #6D28D9' : '1.5px solid #E2E8F0', background: presentacionId === p.id ? '#F5F3FF' : 'white', cursor: 'pointer' }}>
                            <div style={{ width: 40, height: 26, borderRadius: 5, background: 'linear-gradient(135deg,#6c63ff,#a855f7)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>📊</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: 14, color: '#0F172A', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{p.titulo || 'Sin título'}</div>
                                <div style={{ fontSize: 11, color: '#94A3B8' }}>{p.slides?.length || 0} diapositivas</div>
                            </div>
                            {presentacionId === p.id && <span style={{ color: '#6D28D9', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>✓</span>}
                        </div>
                    ))}
                </div>
                {presentacionId && (
                    <div style={{ padding: '8px 20px 0' }}>
                        <button onClick={() => onSelect('')} style={{ width: '100%', padding: '9px', borderRadius: 10, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                            ✕ Quitar presentación
                        </button>
                    </div>
                )}
                <div style={{ padding: '12px 20px 20px' }}>
                    <button onClick={onClose} style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: '#6D28D9', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Listo</button>
                </div>
            </div>
        </div>
    );
}

export default function EditorManual({ datos, setDatos, configJuego, onClose, onSave, usuario }) {
    const [indiceHojaActiva, setIndiceHojaActiva] = useState(0);
    const [mostrandoConfig, setMostrandoConfig] = useState(false);
    const [mostrandoAyuda, setMostrandoAyuda] = useState(false);
    const [mostrandoAvisoCierre, setMostrandoAvisoCierre] = useState(false);
    const [modalPublicar, setModalPublicar] = useState(null);
    // Estados buscador de imágenes para presentación
    const [mediaTipoPres, setMediaTipoPres] = useState(() => datos.presentacion?.piktPresentacionId ? 'pikt' : datos.presentacion?.video ? 'video' : 'imagen');
    const [modoBuscadorPres, setModoBuscadorPres] = useState(false);
    const [presPickerAbiertoManual, setPresPickerAbiertoManual] = useState(false);
    const [searchQueryPres, setSearchQueryPres] = useState('');
    const [searchResultsPres, setSearchResultsPres] = useState([]);
    const [isSearchingPres, setIsSearchingPres] = useState(false);
    const [mostrandoPreviewPres, setMostrandoPreviewPres] = useState(false);

    // ── Submission link panel ─────────────────────────────────────────────────
    const [panelEnvio,    setPanelEnvio]    = useState(false);
    const [linkCopiado,   setLinkCopiado]   = useState('');
    const copiarTexto = (texto, clave) => {
        navigator.clipboard.writeText(texto).then(() => { setLinkCopiado(clave); setTimeout(() => setLinkCopiado(''), 2000); });
    };

    // ── Import modal ──────────────────────────────────────────────────────────
    const [importModal,    setImportModal]    = useState(false);
    const [importStep,     setImportStep]     = useState(1);
    const [importRecursos, setImportRecursos] = useState([]);
    const [importRecurso,  setImportRecurso]  = useState(null);
    const [importBusqueda, setImportBusqueda] = useState('');
    const [importHojaIdx,  setImportHojaIdx]  = useState(-1);
    const [importPregs,    setImportPregs]    = useState([]);
    const [importSel,      setImportSel]      = useState(new Set());
    const [importCargando, setImportCargando] = useState(false);
    const [importGuardando,setImportGuardando]= useState(false);
    const [importError,    setImportError]    = useState('');

    useEffect(() => {
        // Inicializar hojas si no existen
        if (!datos.hojas || datos.hojas.length === 0) {
            setDatos(prev => ({ ...prev, hojas: [{ nombreHoja: 'Hoja 1', preguntas: [] }] }));
        }

        if (configJuego.id === 'CAZABURBUJAS' && !datos.config?.velocidad) {
            setDatos(prev => ({ ...prev, config: { ...prev.config, velocidad: 'MODERADO' } }));
        }

        // Lógica de Autorrelleno de Datos de Búsqueda
        setDatos(prev => ({
            ...prev,
            pais: prev.pais !== undefined ? prev.pais : (usuario?.pais || ''),
            region: prev.region !== undefined ? prev.region : (usuario?.region || ''),
            poblacion: prev.poblacion !== undefined ? prev.poblacion : (usuario?.poblacion || usuario?.localidad || ''),
            ciclo: prev.ciclo !== undefined ? prev.ciclo : (usuario?.ciclo || 'Secundaria'),
            temas: prev.temas || usuario?.temasPreferidos || '',


        }));
    }, []);
    // --- NUEVO: RECOGER PREGUNTAS DEL BUZÓN ---
    useEffect(() => {
        const cargarPreguntasDelBuzon = async () => {
            if (!datos.id) return; // Si es nuevo no tiene ID aún

            try {
                // Buscamos correos pendientes para este recurso
                const q = query(collection(db, "mail_questions"), where("recursoId", "==", datos.id));
                const snap = await getDocs(q);

                if (!snap.empty) {
                    const nuevasHojas = [...datos.hojas];
                    let seEncontraronCosas = false;

                    // Procesamos cada paquete recibido
                    for (const docMail of snap.docs) {
                        const paquete = docMail.data();
                        const idx = paquete.hojaIndex;

                        if (nuevasHojas[idx]) {
                            // Añadimos las preguntas al editor visual
                            nuevasHojas[idx].preguntas.push(...paquete.preguntas);
                            seEncontraronCosas = true;

                            // Borramos el correo del buzón para no duplicarlo la próxima vez
                            // (Solo el profesor puede borrar, así que esto es seguro)
                            await deleteDoc(doc(db, "mail_questions", docMail.id));
                        }
                    }

                    if (seEncontraronCosas) {
                        setDatos(prev => ({ ...prev, hojas: nuevasHojas }));
                        alert("📬 ¡Has recibido nuevas preguntas de alumnos! Se han añadido a la lista.");
                    }
                }
            } catch (e) {
                console.error("Error cargando buzón:", e);
            }
        };

        cargarPreguntasDelBuzon();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [datos.id]); // Se ejecuta al abrir un recurso con ID


    // --- MANEJO DE HOJAS ---
    const cambiarHoja = (e) => setIndiceHojaActiva(parseInt(e.target.value));

    const agregarHoja = () => {
        if (datos.hojas.length >= 3) return alert("Máximo 3 hojas permitidas.");
        const nuevasHojas = [...datos.hojas, { nombreHoja: `Hoja ${datos.hojas.length + 1}`, preguntas: [] }];
        setDatos({ ...datos, hojas: nuevasHojas });
        setIndiceHojaActiva(nuevasHojas.length - 1);
    };

    const borrarHoja = () => {
        if (datos.hojas.length <= 1) return alert("No puedes borrar la última hoja.");
        if (confirm("Si eliminas la hoja no se puede recuperar. ¿Estás seguro?")) {
            const nuevasHojas = [...datos.hojas];
            nuevasHojas.splice(indiceHojaActiva, 1);
            let nuevoIndice = indiceHojaActiva >= nuevasHojas.length ? nuevasHojas.length - 1 : indiceHojaActiva;
            setDatos({ ...datos, hojas: nuevasHojas });
            setIndiceHojaActiva(nuevoIndice);
        }
    };

    // --- NUEVO: REORDENAR PREGUNTAS ---
    const moverPregunta = (idx, dir) => {
        const nuevasHojas = [...datos.hojas];
        const list = nuevasHojas[indiceHojaActiva].preguntas;

        // Mover arriba (dir -1)
        if (dir === -1 && idx > 0) {
            [list[idx], list[idx - 1]] = [list[idx - 1], list[idx]];
        }
        // Mover abajo (dir 1)
        if (dir === 1 && idx < list.length - 1) {
            [list[idx], list[idx + 1]] = [list[idx + 1], list[idx]];
        }

        setDatos({ ...datos, hojas: nuevasHojas });
    };


    const actualizarNombreHoja = (val) => {
        const nuevasHojas = [...datos.hojas];
        nuevasHojas[indiceHojaActiva].nombreHoja = val;
        setDatos({ ...datos, hojas: nuevasHojas });
    };

    const getFrasesRuleta = (hoja) => {
        if (hoja.frasesOcultas?.length > 0) return [...hoja.frasesOcultas];
        if (hoja.fraseOculta) return [hoja.fraseOculta];
        return [''];
    };

    const actualizarFrasesRuleta = (idx, val) => {
        const nuevasHojas = [...datos.hojas];
        const frases = getFrasesRuleta(nuevasHojas[indiceHojaActiva]);
        frases[idx] = val;
        nuevasHojas[indiceHojaActiva].frasesOcultas = frases;
        setDatos({ ...datos, hojas: nuevasHojas });
    };

    const agregarFraseRuleta = () => {
        const nuevasHojas = [...datos.hojas];
        const frases = getFrasesRuleta(nuevasHojas[indiceHojaActiva]);
        nuevasHojas[indiceHojaActiva].frasesOcultas = [...frases, ''];
        setDatos({ ...datos, hojas: nuevasHojas });
    };

    const borrarFraseRuleta = (idx) => {
        const nuevasHojas = [...datos.hojas];
        const frases = getFrasesRuleta(nuevasHojas[indiceHojaActiva]);
        frases.splice(idx, 1);
        nuevasHojas[indiceHojaActiva].frasesOcultas = frases.length > 0 ? frases : [''];
        setDatos({ ...datos, hojas: nuevasHojas });
    };

    // --- QUESTION SENDER: GESTIÓN DE CÓDIGOS Y TARGET ---
    const generarCodigoHoja = () => {
        const codigo = Math.random().toString(36).substring(2, 7).toUpperCase();
        const nuevasHojas = [...datos.hojas];
        nuevasHojas[indiceHojaActiva].accessCode = codigo;
        setDatos({ ...datos, hojas: nuevasHojas });
    };

    const cambiarTargetGame = (nuevoTarget) => {
        setDatos({ ...datos, targetGame: nuevoTarget });
    };

    // --- MANEJO DE PREGUNTAS (Para juegos normales) ---
    const agregarPregunta = () => {
        const nuevasHojas = [...datos.hojas];
        const nuevaP = { pregunta: '', respuesta: '', correcta: '', incorrectas: ['', '', ''] };

        if (configJuego.id === 'PASAPALABRA') {
            const abecedario = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            const letraToca = abecedario[nuevasHojas[indiceHojaActiva].preguntas.length % 26] || '?';
            nuevaP.letra = letraToca;
        }

        nuevasHojas[indiceHojaActiva].preguntas.push(nuevaP);
        setDatos({ ...datos, hojas: nuevasHojas });
    };

    const editarPregunta = (idx, campo, valor) => {
        const nuevasHojas = [...datos.hojas];
        nuevasHojas[indiceHojaActiva].preguntas[idx][campo] = valor;
        setDatos({ ...datos, hojas: nuevasHojas });
    };

    const editarIncorrecta = (idxPregunta, idxIncorrecta, valor) => {
        const nuevasHojas = [...datos.hojas];
        const pregunta = nuevasHojas[indiceHojaActiva].preguntas[idxPregunta];
        if (!pregunta.incorrectas) pregunta.incorrectas = ['', '', ''];
        pregunta.incorrectas[idxIncorrecta] = valor;
        setDatos({ ...datos, hojas: nuevasHojas });
    };

    const borrarPregunta = (idx) => {
        const nuevasHojas = [...datos.hojas];
        nuevasHojas[indiceHojaActiva].preguntas.splice(idx, 1);
        setDatos({ ...datos, hojas: nuevasHojas });
    };

    // --- TOGGLES ---
    const togglePermitirCopia = () => setDatos(prev => ({ ...prev, isPrivate: !prev.isPrivate }));
    const toggleTerminado = () => setDatos(prev => ({ ...prev, isFinished: !prev.isFinished }));
    const toggleAleatorio = () => setDatos(prev => ({ ...prev, config: { ...prev.config, aleatorio: !prev.config?.aleatorio } }));

    // --- BUSCADOR DE IMÁGENES PARA PRESENTACIÓN ---
    const buscarImagenesPres = async () => {
        if (!searchQueryPres.trim()) return;
        setIsSearchingPres(true);
        try {
            // iiurlwidth=400 hace que la API devuelva thumburl (miniatura 400px)
            const res = await fetch(
                `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(searchQueryPres)}&gsrlimit=24&prop=imageinfo&iiprop=url&iiurlwidth=400&format=json&origin=*`
            );
            const data = await res.json();
            const pages = data.query?.pages || {};
            const urls = Object.values(pages)
                .map(p => {
                    const info = p.imageinfo?.[0];
                    // thumburl existe cuando iiurlwidth está activado; fallback a url original
                    return info?.thumburl || info?.url;
                })
                .filter(u => u && /\.(jpe?g|png|gif|webp|svg)(\?|$)/i.test(u));
            setSearchResultsPres(urls);
        } catch {
            alert('Error buscando imágenes. Prueba a pegar la URL directamente.');
        }
        setIsSearchingPres(false);
    };

    const setPresentacionImg = (url) => {
        setDatos(p => ({ ...p, presentacion: { ...(p.presentacion || {}), imagen: url } }));
        setModoBuscadorPres(false);
        setSearchResultsPres([]);
        setSearchQueryPres('');
    };

    const toEmbedUrl = (url) => {
        if (!url) return '';
        let m = url.match(/youtube\.com\/watch\?(?:.*&)?v=([^&]+)/);
        if (m) return `https://www.youtube.com/embed/${m[1]}`;
        m = url.match(/youtu\.be\/([^?&]+)/);
        if (m) return `https://www.youtube.com/embed/${m[1]}`;
        m = url.match(/vimeo\.com\/(\d+)/);
        if (m) return `https://player.vimeo.com/video/${m[1]}`;
        return url;
    };

    // ── Import helpers ────────────────────────────────────────────────────────
    const abrirImport = async () => {
        setImportStep(1); setImportRecurso(null); setImportBusqueda('');
        setImportHojaIdx(-1); setImportPregs([]); setImportSel(new Set()); setImportError('');
        setImportCargando(true); setImportModal(true);
        try {
            const snap = await getDocs(query(collection(db, 'resources'), where('profesorUid', '==', usuario.uid)));
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                .filter(r => !['WORDLE', 'SOPA', 'QUESTION_SENDER'].includes(r.tipoJuego))
                .sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0));
            setImportRecursos(docs);
        } catch { setImportError('Error al cargar recursos.'); }
        setImportCargando(false);
    };

    const calcImportPregs = (recurso, hojaIdx) => {
        const hojas = recurso?.hojas || [];
        const srcs = hojaIdx === -1 ? hojas.map((h, i) => ({ h, i })) : [{ h: hojas[hojaIdx], i: hojaIdx }];
        return srcs.flatMap(({ h, i }) =>
            (h?.preguntas || []).map((q, qi) => ({ hoja: h.nombreHoja || `Hoja ${i + 1}`, hojaIdx: i, qi, q }))
        ).filter(item => {
            const q = item.q;
            return !!((q.pregunta || q.terminoA || '').trim() || (q.respuesta || q.correcta || q.terminoB || '').trim());
        });
    };

    const convertirPreguntas = (selItems) => {
        const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const existingCount = (datos.hojas[indiceHojaActiva]?.preguntas || []).length;
        const target = configJuego.id;
        const poolRespuestas = selItems.map(item =>
            (item.q.respuesta || item.q.correcta || item.q.terminoB || '').trim()
        ).filter(Boolean);

        return selItems.map((item, idx) => {
            const q = item.q;
            const pregStr = (q.pregunta || q.terminoA || '').trim();
            const respStr = (q.respuesta || q.correcta || q.terminoB || '').trim();
            if (!pregStr && !respStr) return null;

            if (target === 'PASAPALABRA') {
                const letra = q.letra || (respStr && /^[A-Za-zÑñÁÉÍÓÚáéíóú]/.test(respStr)
                    ? respStr.charAt(0).toUpperCase()
                    : abc[(existingCount + idx) % 26]);
                return { letra, pregunta: pregStr, respuesta: respStr, correcta: '', incorrectas: ['', '', ''] };
            }
            if (target === 'APAREJADOS') {
                return { terminoA: pregStr, terminoB: respStr, pregunta: '', respuesta: '', correcta: '', incorrectas: ['', '', ''] };
            }
            // CAZABURBUJAS, THINKHOOT, RULETA — need incorrectas
            let incs = (q.incorrectas || []).filter(Boolean).slice(0, 3);
            if (incs.length < 3) {
                const otros = poolRespuestas.filter(r => r !== respStr && !incs.includes(r)).sort(() => Math.random() - 0.5);
                while (incs.length < 3 && otros.length > 0) incs.push(otros.shift());
                while (incs.length < 3) incs.push(`Opción ${incs.length + 1}`);
            }
            return { pregunta: pregStr, respuesta: respStr, correcta: respStr, incorrectas: incs };
        }).filter(Boolean);
    };

    const confirmarImport = () => {
        if (importSel.size === 0) return;
        setImportGuardando(true);
        try {
            const selItems = importPregs.filter((_, i) => importSel.has(i));
            const convertidas = convertirPreguntas(selItems);
            const nuevasHojas = [...datos.hojas];
            nuevasHojas[indiceHojaActiva] = {
                ...nuevasHojas[indiceHojaActiva],
                preguntas: [...(nuevasHojas[indiceHojaActiva].preguntas || []), ...convertidas],
            };
            setDatos({ ...datos, hojas: nuevasHojas });
            setImportModal(false);
        } catch { setImportError('Error al importar.'); }
        setImportGuardando(false);
    };

    const hojaActual = datos.hojas[indiceHojaActiva] || { preguntas: [] };
    const esQuestionSender = configJuego.id === 'QUESTION_SENDER';

    // --- RENDERIZADO DE CAMPOS SEGÚN JUEGO ---
    const renderCamposPregunta = (p, i) => {
        const tipo = configJuego.id;

        if (tipo === 'PASAPALABRA') {
            return (
                <div style={styles.inputsGrid}>
                    <div style={{ flex: 1 }}>
                        <label style={styles.miniLabel}>Pregunta / Definición</label>
                        <input value={p.pregunta} onChange={(e) => editarPregunta(i, 'pregunta', e.target.value)} style={styles.input} placeholder="Empieza por..." />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={styles.miniLabel}>Respuesta Correcta</label>
                        <input value={p.respuesta || p.correcta} onChange={(e) => editarPregunta(i, 'respuesta', e.target.value)} style={{ ...styles.input, borderColor: '#4CAF50' }} placeholder="Solución" />
                    </div>
                </div>
            );
        }

        else if (tipo === 'APAREJADOS') {
            return (
                <div style={styles.grid2}>
                    <input
                        placeholder="Término A (Ej: País)"
                        value={p.terminoA || ''}
                        onChange={(e) => editarPregunta(i, 'terminoA', e.target.value)}
                        style={styles.input}
                    />
                    <input
                        placeholder="Término B (Ej: Capital)"
                        value={p.terminoB || ''}
                        onChange={(e) => editarPregunta(i, 'terminoB', e.target.value)}
                        style={styles.input}
                    />
                </div>
            );
        }

        return (
            <div style={styles.inputsGrid}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                        <label style={styles.miniLabel}>Pregunta</label>
                        <input value={p.pregunta} onChange={(e) => editarPregunta(i, 'pregunta', e.target.value)} style={styles.input} placeholder="Enunciado..." />
                    </div>
                    <div>
                        <label style={styles.miniLabel}>Respuesta Correcta</label>
                        <input value={p.respuesta || p.correcta} onChange={(e) => editarPregunta(i, tipo === 'CAZABURBUJAS' ? 'correcta' : 'respuesta', e.target.value)} style={{ ...styles.input, borderColor: '#4CAF50', background: '#e8f5e9' }} placeholder="Solución" />
                    </div>
                </div>
                <div>
                    <label style={styles.miniLabel}>Respuestas Incorrectas (Opcional)</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        {[0, 1, 2].map(idxInc => (
                            <input
                                key={idxInc}
                                value={p.incorrectas ? p.incorrectas[idxInc] : ''}
                                onChange={(e) => editarIncorrecta(i, idxInc, e.target.value)}
                                style={{ ...styles.input, borderColor: '#e57373', fontSize: '13px', padding: '8px' }}
                                placeholder={`Incorrecta ${idxInc + 1}`}
                            />
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.container}>

                {/* HEADER */}
                <div style={styles.header}>
                    <div style={{ flex: 1 }}>
                        <h2 style={{ margin: 0, fontSize: '18px', color: 'white' }}>{configJuego.label}</h2>
                        <input value={datos.titulo} onChange={(e) => setDatos({ ...datos, titulo: e.target.value })} style={styles.titleInput} placeholder="Título del Recurso" />
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <PiTutorial usuario={usuario} tutorialId="crear_recurso" pasos={TUTORIAL_CREAR_RECURSO} inline={true} />

                        <button onClick={() => setMostrandoConfig(true)} style={styles.iconBtn} title="Configuración"><Settings size={24} /></button>
                        <button onClick={() => datos.isFinished ? onSave() : setModalPublicar('guardar')} style={styles.saveBtn}><Save size={20} /> <span className="hide-mobile">Guardar</span></button>
                        <button onClick={() => setMostrandoAvisoCierre(true)} style={styles.iconBtn}><X size={24} /></button>

                    </div>
                </div>

                {/* SUB-HEADER HOJAS */}
                <div style={styles.subHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                        <span style={{ fontWeight: 'bold', color: '#555' }}>Hoja:</span>
                        <select value={indiceHojaActiva} onChange={cambiarHoja} style={styles.sheetSelect}>
                            {datos.hojas.map((h, i) => <option key={i} value={i}>{h.nombreHoja || `Hoja ${i + 1}`}</option>)}
                        </select>
                    </div>
                    <div style={{ display: 'flex', gap: '5px' }}>
                        <button onClick={borrarHoja} style={styles.deleteSheetBtn} title="Eliminar Hoja"><Trash2 size={16} /></button>
                        {datos.hojas.length < 3 && <button onClick={agregarHoja} style={styles.addSheetBtn}><Plus size={16} /> Nueva</button>}
                    </div>
                </div>

                {/* BODY PRINCIPAL */}
                <div style={styles.body}>

                    {/* NOMBRE HOJA */}
                    <div style={{ marginBottom: '15px', background: 'white', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={styles.label}>Nombre de la Hoja:</label>
                            <input value={hojaActual.nombreHoja} onChange={(e) => actualizarNombreHoja(e.target.value)} style={styles.input} />
                        </div>

                        {configJuego.id === 'RULETA' && (
                            <div>
                                <label style={{ ...styles.label, color: '#E91E63' }}>🎯 Frases a Resolver (OBLIGATORIO):</label>
                                {getFrasesRuleta(hojaActual).map((frase, idx) => (
                                    <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
                                        <input
                                            value={frase}
                                            onChange={(e) => actualizarFrasesRuleta(idx, e.target.value)}
                                            style={{ ...styles.input, border: '2px solid #E91E63', fontWeight: 'bold', flex: 1 }}
                                            placeholder="Ej: LA CAPITAL DE FRANCIA"
                                        />
                                        {getFrasesRuleta(hojaActual).length > 1 && (
                                            <button
                                                onClick={() => borrarFraseRuleta(idx)}
                                                style={{ background: '#ffebee', border: 'none', color: '#c62828', borderRadius: '5px', padding: '8px', cursor: 'pointer', flexShrink: 0 }}
                                                title="Eliminar frase"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button
                                    onClick={agregarFraseRuleta}
                                    style={{ background: 'rgba(233,30,99,0.1)', border: '1px dashed #E91E63', color: '#E91E63', padding: '6px 12px', borderRadius: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 'bold', marginTop: '4px' }}
                                >
                                    <Plus size={14} /> Añadir frase
                                </button>
                            </div>
                        )}
                    </div>

                    {/* 🔗 RECIBIR PREGUNTAS — visible en todos los juegos salvo QUESTION_SENDER */}
                    {!esQuestionSender && (
                        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #ddd', marginBottom: 15, overflow: 'hidden' }}>
                            <button onClick={() => setPanelEnvio(p => !p)} style={{ width: '100%', background: panelEnvio ? '#E8EAF6' : 'white', border: 'none', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left' }}>
                                <span style={{ fontSize: 16 }}>{panelEnvio ? '▾' : '▸'}</span>
                                <span style={{ fontWeight: 700, color: '#3F51B5', fontSize: 14 }}>🔗 Recibir preguntas de alumnos</span>
                                {hojaActual.accessCode && <span style={{ marginLeft: 'auto', background: '#E8EAF6', color: '#3F51B5', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>Activo</span>}
                            </button>
                            {panelEnvio && (
                                <div style={{ padding: '14px 16px', borderTop: '1px solid #eee', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {!datos.id && (
                                        <div style={{ background: '#FFF8E1', border: '1px solid #FFD54F', borderRadius: 8, padding: '10px 14px', color: '#E65100', fontSize: 13 }}>
                                            💾 Guarda el recurso primero para que el enlace funcione.
                                        </div>
                                    )}
                                    <p style={{ margin: 0, fontSize: 13, color: '#555', lineHeight: 1.5 }}>
                                        Genera un código y comparte el enlace. Cualquier alumno podrá enviarte preguntas en el formato de <strong>{configJuego.label}</strong> sin necesidad de cuenta.
                                    </p>
                                    {!hojaActual.accessCode ? (
                                        <button onClick={generarCodigoHoja} style={{ background: '#3F51B5', color: 'white', border: 'none', padding: '10px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
                                            <RotateCcw size={15} /> Activar enlace para esta hoja
                                        </button>
                                    ) : (
                                        <>
                                            {/* Código */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F5F7FF', border: '2px solid #3F51B5', borderRadius: 10, padding: '10px 16px' }}>
                                                <span style={{ fontSize: 26, letterSpacing: 5, fontWeight: 900, color: '#3F51B5', flex: 1 }}>{hojaActual.accessCode}</span>
                                                <button onClick={() => copiarTexto(hojaActual.accessCode, 'codigo')} style={{ background: linkCopiado === 'codigo' ? '#4CAF50' : '#3F51B5', color: 'white', border: 'none', borderRadius: 7, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                                                    {linkCopiado === 'codigo' ? '✓ Copiado' : 'Copiar código'}
                                                </button>
                                            </div>
                                            {/* Enlace completo */}
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <input readOnly value={`${window.location.origin}${window.location.pathname}?c=${hojaActual.accessCode}`} style={{ ...styles.input, fontSize: 12, color: '#555', flex: 1 }} />
                                                <button onClick={() => copiarTexto(`${window.location.origin}${window.location.pathname}?c=${hojaActual.accessCode}`, 'link')} style={{ background: linkCopiado === 'link' ? '#4CAF50' : '#607D8B', color: 'white', border: 'none', borderRadius: 7, padding: '0 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                                                    {linkCopiado === 'link' ? '✓ ¡Copiado!' : '🔗 Copiar enlace'}
                                                </button>
                                            </div>
                                            <button onClick={generarCodigoHoja} style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, alignSelf: 'flex-start', textDecoration: 'underline' }}>
                                                <RotateCcw size={12} /> Regenerar código
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* 1. PANEL DE CONFIGURACIÓN (SOLO SI ES QUESTION SENDER) */}
                    {esQuestionSender && (
                        <div style={{ padding: '10px', background: '#e3f2fd', borderRadius: '10px', border: '1px solid #2196F3', marginBottom: '20px' }}>
                            <h3 style={{ color: '#1565C0', marginTop: 0 }}>Configuración de Envío</h3>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={styles.label}>Aplicación Destino (Formato para Alumnos):</label>
                                <select
                                    value={datos.targetGame || 'PASAPALABRA'}
                                    onChange={(e) => cambiarTargetGame(e.target.value)}
                                    style={{ ...styles.input, fontWeight: 'bold', color: '#333' }}
                                >
                                    {JUEGOS_DESTINO.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                                </select>
                                <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                                    Los alumnos verán el formulario adaptado para: <b>{JUEGOS_DESTINO.find(g => g.id === (datos.targetGame || 'PASAPALABRA'))?.label}</b>.
                                </p>
                            </div>

                            <div style={{ background: 'white', padding: '15px', borderRadius: '10px', textAlign: 'center', border: '2px dashed #2196F3' }}>
                                <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold', color: '#555' }}>CÓDIGO DE ACCESO PARA ESTA HOJA</label>
                                <div style={{ fontSize: '32px', letterSpacing: '5px', fontWeight: 'bold', color: '#2196F3', marginBottom: '15px' }}>
                                    {hojaActual.accessCode || '-----'}
                                </div>
                                <button onClick={generarCodigoHoja} style={{ background: '#2196F3', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 auto' }}>
                                    <RotateCcw size={18} /> Generar Nuevo Código
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 2. LISTA DE PREGUNTAS (AHORA VISIBLE SIEMPRE DEBAJO) */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h3 style={{ margin: 0, color: '#333' }}>
                            {esQuestionSender ? 'Buzón de Respuestas' : 'Preguntas'} ({hojaActual.preguntas.length})
                        </h3>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={agregarPregunta} style={styles.addQuestionBtn}><Plus size={18} /> Añadir Pregunta</button>
                            <button onClick={abrirImport} style={{ background: '#FF9800', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', fontWeight: 'bold' }}>📥 Importar</button>
                        </div>
                    </div>

                    <div style={styles.questionsList}>
                        {hojaActual.preguntas.map((p, i) => (
                            <div key={i} style={{
                                ...styles.questionCard,
                                display: 'flex',       // <--- ACTIVAMOS FLEX
                                alignItems: 'flex-start',
                                gap: '15px',           // Espacio entre columna izq y derecha
                                paddingLeft: '10px'    // Un poco menos de padding izq
                            }}>

                                {/* --- COLUMNA IZQUIERDA: CONTROLES --- */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', paddingTop: '5px', minWidth: '30px' }}>

                                    {/* Número */}
                                    <span style={{ fontWeight: 'bold', color: '#bdc3c7', fontSize: '14px', marginBottom: '2px' }}>
                                        #{i + 1}
                                    </span>

                                    {/* Flecha Arriba */}
                                    <button
                                        onClick={() => moverPregunta(i, -1)}
                                        disabled={i === 0}
                                        style={{ ...arrowBtn, opacity: i === 0 ? 0.3 : 1 }}
                                        title="Subir"
                                    >
                                        <ArrowUp size={14} color="#555" />
                                    </button>

                                    {/* Flecha Abajo */}
                                    <button
                                        onClick={() => moverPregunta(i, 1)}
                                        disabled={i === hojaActual.preguntas.length - 1}
                                        style={{ ...arrowBtn, opacity: i === hojaActual.preguntas.length - 1 ? 0.3 : 1 }}
                                        title="Bajar"
                                    >
                                        <ArrowDown size={14} color="#555" />
                                    </button>

                                    {/* Borrar (Ahora aquí a la izquierda, como en MathLive) */}
                                    <button
                                        onClick={() => borrarPregunta(i)}
                                        style={{ ...arrowBtn, background: '#ffebee', marginTop: '8px' }}
                                        title="Borrar"
                                    >
                                        <Trash2 size={14} color="#c62828" />
                                    </button>
                                </div>

                                {/* --- COLUMNA DERECHA: CAMPOS --- */}
                                <div style={{ flex: 1, width: '100%' }}>

                                    {/* Cabecera interna (Solo si hay letra o nombre de alumno) */}
                                    {(configJuego.id === 'PASAPALABRA' || p.studentName) && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>

                                            {/* Nombre Alumno (Question Sender) */}
                                            <div style={{ flex: 1 }}>
                                                {p.studentName && (
                                                    <span style={{ fontSize: '11px', color: '#1565C0', background: '#E3F2FD', padding: '3px 8px', borderRadius: '12px', fontWeight: 'bold', border: '1px solid #BBDEFB' }}>
                                                        👤 {p.studentName}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Letra Pasapalabra (A la derecha) */}
                                            {configJuego.id === 'PASAPALABRA' && (
                                                <input
                                                    value={p.letra}
                                                    onChange={(e) => editarPregunta(i, 'letra', e.target.value.toUpperCase())}
                                                    style={styles.letraInput}
                                                    maxLength={1}
                                                />
                                            )}
                                        </div>
                                    )}

                                    {/* Campos del formulario */}
                                    {renderCamposPregunta(p, i)}
                                </div>
                            </div>
                        ))}

                        {hojaActual.preguntas.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#999', border: '2px dashed #ccc', borderRadius: '10px' }}>
                                {esQuestionSender
                                    ? "Aún no has recibido preguntas de los alumnos."
                                    : "No hay preguntas. Pulsa 'Añadir Pregunta'."}
                            </div>
                        )}
                    </div>

                </div>

                {/* --- MODAL DE AVISO AL CERRAR --- */}
                {modalPublicar && (
                    <PublicarModal
                        modo={modalPublicar}
                        onGuardarPublicar={async () => {
                            await onSave({ isFinished: true });
                            setDatos(prev => ({ ...prev, isFinished: true }));
                            setModalPublicar(null);
                        }}
                        onGuardarSolo={async () => { await onSave(); setModalPublicar(null); }}
                        onSalirSinGuardar={() => { setModalPublicar(null); onClose(); }}
                        onCancelar={() => setModalPublicar(null)}
                    />
                )}

                {mostrandoAvisoCierre && (
                    <div style={styles.configOverlay}> {/* Reutilizamos el estilo de overlay existente */}
                        <div style={{ ...styles.configModal, width: '350px', textAlign: 'center', height: 'auto', maxHeight: 'none' }}>
                            <div style={{ padding: '25px' }}>
                                <h3 style={{ color: '#e74c3c', marginTop: '0' }}>⚠️ Vas a cerrar el recurso</h3>
                                <p style={{ color: '#666', fontSize: '14px', marginBottom: '25px' }}>
                                    ¿Quieres guardar los cambios antes de salir?
                                </p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {/* Guardar y publicar y salir (solo si no está publicado) */}
                                    {!datos.isFinished && (
                                        <button
                                            onClick={async () => {
                                                await onSave({ isFinished: true });
                                                setDatos(prev => ({ ...prev, isFinished: true }));
                                                onClose();
                                            }}
                                            style={{ width: '100%', padding: '12px', background: '#6366f1', color: 'white', border: 'none', borderRadius: '5px', fontSize: '1.1rem', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}
                                        >
                                            <Save size={18} /> Guardar, publicar y salir
                                        </button>
                                    )}

                                    {/* Guardar y Salir */}
                                    <button
                                        onClick={async () => {
                                            await onSave();
                                            onClose();
                                        }}
                                        style={{ width: '100%', padding: '12px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '5px', fontSize: '1.1rem', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}
                                    >
                                        <Save size={18} /> Guardar y Salir
                                    </button>

                                    {/* Salir sin guardar */}
                                    <button
                                        onClick={onClose}
                                        style={{ width: '100%', padding: '12px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                                    >
                                        Salir sin guardar
                                    </button>

                                    {/* Cancelar */}
                                    <button
                                        onClick={() => setMostrandoAvisoCierre(false)}
                                        style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', marginTop: '10px', textDecoration: 'underline' }}
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}



                {/* MODAL CONFIGURACIÓN */}
                {mostrandoConfig && (
                    <div style={styles.configOverlay}>
                        <div style={styles.configModal}>
                            <div style={styles.configHeader}>
                                <h3>Configuración</h3>
                                <button onClick={() => setMostrandoConfig(false)} style={styles.iconBtnBlack}><X /></button>
                            </div>
                            <div style={styles.configBody}>
                                {/* --- SECCIÓN DATOS DE BÚSQUEDA ESTANDARIZADA --- */}
                                <h4 style={styles.sectionTitle}>Datos de Búsqueda</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <InputConfig label="País" val={datos.pais} set={v => setDatos({ ...datos, pais: v })} />
                                    <InputConfig label="Región" val={datos.region} set={v => setDatos({ ...datos, region: v })} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <InputConfig label="Localidad" val={datos.poblacion} set={v => setDatos({ ...datos, poblacion: v })} />
                                    <InputConfig
                                        label="Temas"
                                        val={datos.temas} // <--- CAMBIADO (antes ponía datos.temasPreferidos)
                                        set={v => setDatos({ ...datos, temas: v })} // <--- CAMBIADO
                                    />
                                </div>
                                <div style={{ marginBottom: '15px' }}>
                                    <label style={styles.label}>Enseñanzas (puedes elegir varias)</label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                                        {['Infantil','Primaria','Secundaria','Bachillerato','FP','Universidad','Otros'].map(c => {
                                            const activos = Array.isArray(datos.ciclo) ? datos.ciclo : datos.ciclo ? [datos.ciclo] : ['Secundaria'];
                                            const activo = activos.includes(c);
                                            return (
                                                <button key={c} type="button" onClick={() => {
                                                    let nuevo = activo ? activos.filter(x => x !== c) : [...activos, c];
                                                    if (nuevo.length === 0) nuevo = [c];
                                                    setDatos({ ...datos, ciclo: nuevo });
                                                }} style={{
                                                    padding: '5px 12px', borderRadius: 20, border: '1.5px solid',
                                                    borderColor: activo ? '#3F51B5' : '#ddd',
                                                    background: activo ? '#3F51B5' : 'white',
                                                    color: activo ? 'white' : '#555',
                                                    fontWeight: activo ? 700 : 400,
                                                    fontSize: '0.8rem', cursor: 'pointer',
                                                }}>{c}</button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <InputConfig
                                    label="Autor (nombre que aparece al iniciar el juego)"
                                    val={datos.profesorNombre}
                                    set={v => setDatos({ ...datos, profesorNombre: v })}
                                />
                                <h4 style={styles.sectionTitle}>Ajustes de Juego</h4>
                                {configJuego.camposConfig.map(campo => (
                                    <div key={campo.key} style={{ marginBottom: '10px' }}>
                                        <label style={styles.label}>{campo.label}</label>
                                        <input type={campo.type} value={datos.config?.[campo.key] || campo.default} onChange={(e) => setDatos({ ...datos, config: { ...datos.config, [campo.key]: e.target.value } })} style={styles.input} />
                                    </div>
                                ))}

                                {/* --- AÑADIR ESTO AQUÍ: SELECTOR DE VELOCIDAD (SOLO CAZABURBUJAS) --- */}
                                {configJuego.id === 'CAZABURBUJAS' && (
                                    <div style={{ marginBottom: '15px', background: '#e3f2fd', padding: '10px', borderRadius: '8px', border: '1px solid #bbdefb' }}>
                                        <label style={styles.label}>Velocidad de Movimiento</label>
                                        <select
                                            value={datos.config?.velocidad || 'MODERADO'}
                                            onChange={(e) => setDatos({ ...datos, config: { ...datos.config, velocidad: e.target.value } })}
                                            style={{ ...styles.input, fontWeight: 'bold', color: '#1565C0' }}
                                        >
                                            <option value="LENTO">🐢 Lento</option>
                                            <option value="MODERADO">🚶 Moderado</option>
                                            <option value="RAPIDO">🐇 Rápido</option>
                                        </select>
                                    </div>
                                )}

                                {/* --- NUEVA OPCIÓN: ORDEN ALEATORIO --- */}
                                <div style={styles.toggleRow}>
                                    <div><div style={{ fontWeight: 'bold' }}>Orden Aleatorio</div><div style={{ fontSize: '12px', color: '#666' }}>Mezclar preguntas al jugar.</div></div>
                                    <button onClick={toggleAleatorio} style={{ ...styles.toggleBtn, background: datos.config?.aleatorio ? '#2196F3' : '#ccc', justifyContent: datos.config?.aleatorio ? 'flex-end' : 'flex-start' }}><div style={styles.toggleCircle}></div></button>
                                </div>

                                <h4 style={styles.sectionTitle}>Opciones</h4>
                                <div style={styles.toggleRow}>
                                    <div><div style={{ fontWeight: 'bold' }}>Permitir Copia</div><div style={{ fontSize: '12px', color: '#666' }}>Público para otros profes.</div></div>
                                    <button onClick={togglePermitirCopia} style={{ ...styles.toggleBtn, background: !datos.isPrivate ? '#4CAF50' : '#ccc', justifyContent: !datos.isPrivate ? 'flex-end' : 'flex-start' }}><div style={styles.toggleCircle}></div></button>
                                </div>
                                <div style={styles.toggleRow}>
                                    <div><div style={{ fontWeight: 'bold' }}>Terminado</div><div style={{ fontSize: '12px', color: '#666' }}>Visible para alumnos.</div></div>
                                    <button onClick={toggleTerminado} style={{ ...styles.toggleBtn, background: datos.isFinished ? '#2196F3' : '#ccc', justifyContent: datos.isFinished ? 'flex-end' : 'flex-start' }}><div style={styles.toggleCircle}></div></button>
                                </div>

                                {/* ── PRESENTACIÓN PREVIA ── */}
                                <h4 style={styles.sectionTitle}>🎬 Presentación previa</h4>
                                <p style={{ fontSize: '0.78rem', color: '#888', margin: '0 0 12px', lineHeight: 1.4 }}>
                                    Si se configura, aparece una pantalla introductoria antes de que empiece el juego.
                                </p>

                                {/* Título */}
                                <InputConfig
                                    label="Título"
                                    val={datos.presentacion?.titulo}
                                    set={v => setDatos(p => ({ ...p, presentacion: { ...(p.presentacion || {}), titulo: v } }))}
                                />

                                {/* Imagen / Vídeo — selector de tipo de media */}
                                <div style={{ marginBottom: 10 }}>
                                    <label style={{ display: 'block', fontSize: '12px', color: '#666', fontWeight: 'bold', marginBottom: 6 }}>Media</label>

                                    {/* Tabs Imagen | Vídeo | PiKT */}
                                    <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #ddd', marginBottom: 10 }}>
                                        {[['imagen', '🖼️ Imagen'], ['video', '▶️ Vídeo'], ['pikt', '📊 PiKT']].map(([tipo, label]) => (
                                            <button key={tipo} onClick={() => {
                                                setMediaTipoPres(tipo);
                                                setModoBuscadorPres(false);
                                                setSearchResultsPres([]);
                                            }}
                                                style={{ flex: 1, padding: '7px 0', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', background: mediaTipoPres === tipo ? '#3F51B5' : '#f5f5f5', color: mediaTipoPres === tipo ? 'white' : '#555', transition: '0.15s' }}
                                            >{label}</button>
                                        ))}
                                    </div>

                                    {/* ── IMAGEN ── */}
                                    {mediaTipoPres === 'imagen' && (<>
                                        {datos.presentacion?.imagen && (
                                            <div style={{ position: 'relative', marginBottom: 8 }}>
                                                <img
                                                    src={datos.presentacion.imagen}
                                                    alt="preview"
                                                    onError={e => { e.target.style.display = 'none'; }}
                                                    style={{ width: '100%', borderRadius: 8, maxHeight: 140, objectFit: 'cover', display: 'block' }}
                                                />
                                                <button
                                                    onClick={() => setDatos(p => ({ ...p, presentacion: { ...(p.presentacion || {}), imagen: '' } }))}
                                                    style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', border: 'none', color: 'white', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
                                                    title="Quitar imagen"
                                                >✕</button>
                                            </div>
                                        )}
                                        <button
                                            onClick={() => setModoBuscadorPres(p => !p)}
                                            style={{ ...styles.input, background: '#e8eaf6', color: '#3F51B5', fontWeight: 'bold', border: '1px dashed #3F51B5', cursor: 'pointer', textAlign: 'center', marginBottom: 6 }}
                                        >
                                            🔍 {modoBuscadorPres ? 'Cerrar buscador' : 'Buscar imagen'}
                                        </button>
                                        {modoBuscadorPres && (
                                            <div style={{ background: '#f5f5f5', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                                                <p style={{ margin: '0 0 8px', fontSize: '0.75rem', color: '#555' }}>Wikimedia Commons — imágenes libres de derechos</p>
                                                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                                                    <input
                                                        value={searchQueryPres}
                                                        onChange={e => setSearchQueryPres(e.target.value)}
                                                        onKeyDown={e => e.key === 'Enter' && buscarImagenesPres()}
                                                        placeholder="Ej: sistema solar, célula, mapa Europa..."
                                                        style={{ ...styles.input, flex: 1 }}
                                                    />
                                                    <button onClick={buscarImagenesPres} style={{ background: '#3F51B5', color: 'white', border: 'none', borderRadius: 6, padding: '0 14px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                                        {isSearchingPres ? '...' : 'Buscar'}
                                                    </button>
                                                </div>
                                                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                                                    <input
                                                        placeholder="O pega una URL directamente..."
                                                        style={{ ...styles.input, flex: 1, fontSize: '0.78rem' }}
                                                        onBlur={e => { if (e.target.value.startsWith('http')) setPresentacionImg(e.target.value); }}
                                                        onKeyDown={e => { if (e.key === 'Enter' && e.target.value.startsWith('http')) setPresentacionImg(e.target.value); }}
                                                    />
                                                </div>
                                                {searchResultsPres.length > 0 && (
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                                                        {searchResultsPres.map((url, i) => (
                                                            <img key={i} src={url} alt="resultado"
                                                                onClick={() => setPresentacionImg(url)}
                                                                onError={e => { e.target.style.display = 'none'; }}
                                                                style={{ width: '100%', height: 70, objectFit: 'cover', borderRadius: 6, cursor: 'pointer', border: '2px solid transparent', transition: '0.15s' }}
                                                                onMouseEnter={e => { e.target.style.border = '2px solid #3F51B5'; }}
                                                                onMouseLeave={e => { e.target.style.border = '2px solid transparent'; }}
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                                {searchResultsPres.length === 0 && !isSearchingPres && searchQueryPres && (
                                                    <p style={{ textAlign: 'center', color: '#999', fontSize: '0.8rem' }}>Sin resultados. Prueba otro término.</p>
                                                )}
                                            </div>
                                        )}
                                    </>)}

                                    {/* ── VÍDEO ── */}
                                    {mediaTipoPres === 'video' && (<>
                                        <p style={{ margin: '0 0 8px', fontSize: '0.75rem', color: '#555', lineHeight: 1.4 }}>
                                            Pega la URL de YouTube o Vimeo. El vídeo se mostrará en la pantalla de presentación en lugar de la imagen.
                                        </p>
                                        <input
                                            value={datos.presentacion?.video || ''}
                                            onChange={e => setDatos(p => ({ ...p, presentacion: { ...(p.presentacion || {}), video: e.target.value } }))}
                                            placeholder="https://www.youtube.com/watch?v=..."
                                            style={{ ...styles.input, marginBottom: 8 }}
                                        />
                                        {datos.presentacion?.video && (() => {
                                            const embed = toEmbedUrl(datos.presentacion.video);
                                            return embed ? (
                                                <div style={{ position: 'relative', paddingBottom: '56.25%', borderRadius: 8, overflow: 'hidden', background: '#000', marginBottom: 6 }}>
                                                    <iframe
                                                        src={embed}
                                                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                        allowFullScreen
                                                        title="preview"
                                                    />
                                                </div>
                                            ) : null;
                                        })()}
                                        {datos.presentacion?.video && (
                                            <button
                                                onClick={() => setDatos(p => ({ ...p, presentacion: { ...(p.presentacion || {}), video: '' } }))}
                                                style={{ background: '#ffebee', border: 'none', color: '#c62828', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}
                                            >✕ Quitar vídeo</button>
                                        )}
                                    </>)}

                                    {/* ── PIKT ── */}
                                    {mediaTipoPres === 'pikt' && (
                                        <div style={{ marginTop: 4 }}>
                                            <p style={{ margin: '0 0 8px', fontSize: '0.75rem', color: '#555', lineHeight: 1.4 }}>
                                                Lanza una presentación PiKT antes de que empiece el juego.
                                            </p>
                                            {datos.presentacion?.piktPresentacionId ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#F5F3FF', border: '1px solid #C4B5FD', borderRadius: 8, marginBottom: 6 }}>
                                                    <span style={{ fontSize: 16 }}>📊</span>
                                                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#6D28D9' }}>Presentación PiKT seleccionada</span>
                                                    <button onClick={() => setPresPickerAbiertoManual(true)} style={{ fontSize: 11, color: '#6D28D9', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, padding: '2px 6px' }}>Cambiar</button>
                                                    <button onClick={() => setDatos(p => ({ ...p, presentacion: { ...(p.presentacion || {}), piktPresentacionId: '' } }))} style={{ fontSize: 11, color: '#c62828', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, padding: '2px 4px' }}>✕</button>
                                                </div>
                                            ) : (
                                                <button onClick={() => setPresPickerAbiertoManual(true)}
                                                    style={{ width: '100%', padding: '10px', background: '#F5F3FF', color: '#6D28D9', border: '1.5px dashed #C4B5FD', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit', marginBottom: 6 }}>
                                                    🎞️ + Seleccionar presentación PiKT
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Descripción */}
                                <div style={{ marginBottom: 10 }}>
                                    <label style={{ display: 'block', fontSize: '12px', color: '#666', fontWeight: 'bold', marginBottom: 4 }}>Descripción</label>
                                    <textarea
                                        value={datos.presentacion?.descripcion || ''}
                                        onChange={e => setDatos(p => ({ ...p, presentacion: { ...(p.presentacion || {}), descripcion: e.target.value } }))}
                                        style={{ ...styles.input, resize: 'vertical', minHeight: 72, fontFamily: 'inherit' }}
                                        placeholder="Texto introductorio que verán los alumnos..."
                                    />
                                </div>

                                {/* Botón vista previa */}
                                {datos.presentacion?.titulo && (
                                    <button
                                        onClick={() => setMostrandoPreviewPres(true)}
                                        style={{ width: '100%', padding: '10px', background: '#673AB7', color: 'white', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', marginBottom: 4 }}
                                    >
                                        👁️ Vista previa de la presentación
                                    </button>
                                )}
                            </div>
                            <button onClick={() => setMostrandoConfig(false)} style={styles.closeConfigBtn}>Aceptar</button>
                        </div>
                    </div>
                )}

                {/* MODAL VISTA PREVIA PRESENTACIÓN */}
                {mostrandoPreviewPres && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 6000, background: 'linear-gradient(160deg,#0f0c29 0%,#302b63 55%,#24243e 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px', overflowY: 'auto', boxSizing: 'border-box' }}>
                        {/* Botón cerrar */}
                        <button
                            onClick={() => setMostrandoPreviewPres(false)}
                            style={{ position: 'fixed', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 'bold', zIndex: 10 }}
                        >
                            ✕ Cerrar
                        </button>

                        <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
                            {/* Título */}
                            <h1 style={{ color: 'white', margin: 0, fontSize: 'clamp(1.6rem,5vw,2.8rem)', textAlign: 'center', fontWeight: 900, lineHeight: 1.2, textShadow: '0 0 40px rgba(255,255,255,0.22)' }}>
                                {datos.presentacion?.titulo}
                            </h1>

                            {/* Vídeo o Imagen */}
                            {datos.presentacion?.video && toEmbedUrl(datos.presentacion.video) ? (
                                <div style={{ width: '100%', borderRadius: 18, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.65)', position: 'relative', paddingBottom: '56.25%', background: '#000' }}>
                                    <iframe
                                        src={toEmbedUrl(datos.presentacion.video)}
                                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                        title="presentación"
                                    />
                                </div>
                            ) : datos.presentacion?.imagen ? (
                                <div style={{ width: '100%', borderRadius: 18, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.65)' }}>
                                    <img
                                        src={datos.presentacion.imagen}
                                        alt={datos.presentacion.titulo}
                                        style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '42vh', objectFit: 'cover' }}
                                    />
                                </div>
                            ) : null}

                            {/* Descripción */}
                            {datos.presentacion?.descripcion && (
                                <p style={{ color: 'rgba(255,255,255,0.88)', margin: 0, fontSize: 'clamp(0.95rem,2.5vw,1.1rem)', textAlign: 'center', lineHeight: 1.7 }}>
                                    {datos.presentacion.descripcion}
                                </p>
                            )}

                            {/* Botón (decorativo en preview) */}
                            <button style={{ background: 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)', color: 'white', border: 'none', borderRadius: 50, padding: '16px 52px', fontSize: '1.1rem', fontWeight: 800, cursor: 'default', boxShadow: '0 8px 30px rgba(102,126,234,0.55)', display: 'flex', alignItems: 'center', gap: 10, opacity: 0.85 }}>
                                ▶ ¡Empezar!
                            </button>

                            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', margin: 0 }}>— Vista previa — los alumnos verán esta pantalla antes de jugar —</p>
                        </div>
                    </div>
                )}

                {/* MODAL DE AYUDA (NUEVO) */}
                {mostrandoAyuda && (
                    <div style={styles.configOverlay}>
                        <div style={styles.configModal}>
                            <div style={styles.configHeader}>
                                <h3>Ayuda: {configJuego.label}</h3>
                                <button onClick={() => setMostrandoAyuda(false)} style={styles.iconBtnBlack}><X /></button>
                            </div>
                            <div style={{ padding: '20px', lineHeight: '1.6', color: '#444' }}>
                                <p>{HELP_CONTENT[configJuego.id] || "Rellena los campos para crear tu recurso."}</p>
                            </div>
                            <button onClick={() => setMostrandoAyuda(false)} style={styles.closeConfigBtn}>Entendido</button>
                        </div>
                    </div>
                )}

            </div>
            <style>{`.hide-mobile { display: inline; } @media (max-width: 600px) { .hide-mobile { display: none; } }`}</style>

            {/* ── IMPORT MODAL ── */}
            {importModal && (() => {
                const TIPO_INFO = {
                    PASAPALABRA: { icon: '📝', label: 'Pasapalabra' },
                    CAZABURBUJAS: { icon: '🫧', label: 'Caza Burbujas' },
                    THINKHOOT:   { icon: '🎯', label: 'PiLive' },
                    APAREJADOS:  { icon: '🔗', label: 'Aparejados' },
                    RULETA:      { icon: '🎡', label: 'La Ruleta' },
                    SINTAXIS:    { icon: '📊', label: 'Sintaxis' },
                    ETIQUETAS:   { icon: '🏷️', label: 'Etiquetas' },
                };
                const needsWrong = ['CAZABURBUJAS', 'THINKHOOT', 'RULETA'].includes(configJuego.id);
                const allSel = importPregs.length > 0 && importPregs.every((_, i) => importSel.has(i));
                const toggleAll = () => setImportSel(allSel ? new Set() : new Set(importPregs.map((_, i) => i)));

                const recursosFiltrados = importRecursos.filter(r => {
                    const q = importBusqueda.toLowerCase();
                    return !q || (r.titulo || '').toLowerCase().includes(q) || (r.tipoJuego || '').toLowerCase().includes(q);
                });

                const hojas = importRecurso?.hojas || [];

                return (
                    <div style={{ ...styles.configOverlay, zIndex: 5000 }} onClick={e => { if (e.target === e.currentTarget) setImportModal(false); }}>
                        <div style={{ ...styles.configModal, maxWidth: 580, width: '96%', maxHeight: '90vh' }}>

                            {/* Header */}
                            <div style={{ ...styles.configHeader, gap: 8 }}>
                                {importStep === 2 && (
                                    <button onClick={() => { setImportStep(1); setImportRecurso(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#555', padding: '0 4px' }}>←</button>
                                )}
                                <h3 style={{ margin: 0, flex: 1, fontSize: 15, color: '#1E293B' }}>
                                    📥 {importStep === 1 ? 'Importar desde otro recurso' : importRecurso?.titulo || 'Seleccionar preguntas'}
                                </h3>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    {[1, 2].map(s => <div key={s} style={{ width: 8, height: 8, borderRadius: '50%', background: s === importStep ? '#3F51B5' : s < importStep ? '#4CAF50' : '#ddd' }} />)}
                                </div>
                                <button onClick={() => setImportModal(false)} style={styles.iconBtnBlack}><X size={20} /></button>
                            </div>

                            {/* Body */}
                            <div style={{ ...styles.configBody, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {importError && (
                                    <div style={{ background: '#FFEBEE', border: '1px solid #FFCDD2', borderRadius: 8, padding: '8px 12px', color: '#C62828', fontSize: 13 }}>⚠ {importError}</div>
                                )}

                                {/* ── Step 1: resource list ── */}
                                {importStep === 1 && (<>
                                    <input
                                        value={importBusqueda} onChange={e => setImportBusqueda(e.target.value)}
                                        placeholder="🔍 Buscar por título o tipo…"
                                        style={{ ...styles.input, marginBottom: 4 }}
                                    />
                                    {importCargando && <div style={{ textAlign: 'center', padding: 30, color: '#999' }}>⏳ Cargando recursos…</div>}
                                    {!importCargando && recursosFiltrados.length === 0 && (
                                        <div style={{ textAlign: 'center', padding: 30, color: '#999', border: '2px dashed #ddd', borderRadius: 10 }}>
                                            📭 No tienes recursos para importar.
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
                                        {recursosFiltrados.map(r => {
                                            const info = TIPO_INFO[r.tipoJuego] || { icon: '📋', label: r.tipoJuego || 'Recurso' };
                                            const totalPregs = (r.hojas || []).reduce((s, h) => s + (h.preguntas?.length || 0), 0);
                                            return (
                                                <button key={r.id} onClick={() => {
                                                    setImportRecurso(r);
                                                    setImportHojaIdx(-1);
                                                    const ps = calcImportPregs(r, -1);
                                                    setImportPregs(ps);
                                                    setImportSel(new Set(ps.map((_, i) => i)));
                                                    setImportStep(2);
                                                }} style={{ background: 'white', border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '11px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', transition: '0.15s' }}
                                                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#3F51B5'; e.currentTarget.style.background = '#F5F7FF'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = 'white'; }}>
                                                    <span style={{ fontSize: '1.6rem', flexShrink: 0 }}>{info.icon}</span>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontWeight: 700, fontSize: 14, color: '#0F172A', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{r.titulo || 'Sin título'}</div>
                                                        <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
                                                            {info.label} · {r.hojas?.length || 0} hoja{r.hojas?.length !== 1 ? 's' : ''} · {totalPregs} preguntas
                                                        </div>
                                                    </div>
                                                    <span style={{ color: '#94A3B8', fontSize: 18 }}>›</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </>)}

                                {/* ── Step 2: hoja + questions ── */}
                                {importStep === 2 && importRecurso && (<>
                                    {/* Hoja tabs */}
                                    {hojas.length > 1 && (
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                            <button onClick={() => {
                                                setImportHojaIdx(-1);
                                                const ps = calcImportPregs(importRecurso, -1);
                                                setImportPregs(ps); setImportSel(new Set(ps.map((_, i) => i)));
                                            }} style={{ padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${importHojaIdx === -1 ? '#3F51B5' : '#ddd'}`, background: importHojaIdx === -1 ? '#E8EAF6' : 'white', color: importHojaIdx === -1 ? '#3F51B5' : '#555', fontSize: 13, cursor: 'pointer', fontWeight: importHojaIdx === -1 ? 700 : 400 }}>Todas</button>
                                            {hojas.map((h, hi) => (
                                                <button key={hi} onClick={() => {
                                                    setImportHojaIdx(hi);
                                                    const ps = calcImportPregs(importRecurso, hi);
                                                    setImportPregs(ps); setImportSel(new Set(ps.map((_, i) => i)));
                                                }} style={{ padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${importHojaIdx === hi ? '#3F51B5' : '#ddd'}`, background: importHojaIdx === hi ? '#E8EAF6' : 'white', color: importHojaIdx === hi ? '#3F51B5' : '#555', fontSize: 13, cursor: 'pointer', fontWeight: importHojaIdx === hi ? 700 : 400 }}>
                                                    {h.nombreHoja || `Hoja ${hi + 1}`}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {needsWrong && (
                                        <div style={{ background: '#FFF3E0', border: '1px solid #FFB74D', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#E65100' }}>
                                            💡 Las preguntas sin opciones incorrectas las generará automáticamente mezclando las respuestas del resto de preguntas importadas, igual que el Conversor Mágico.
                                        </div>
                                    )}
                                    {configJuego.id === 'RULETA' && (
                                        <div style={{ background: '#FCE4EC', border: '1px solid #F48FB1', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#880E4F' }}>
                                            🎡 Recuerda: la Frase Oculta de cada hoja debes rellenarla manualmente después de importar.
                                        </div>
                                    )}

                                    {/* Select all + count */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                        <button onClick={toggleAll} style={{ background: allSel ? '#E8F5E9' : '#f5f5f5', border: `1px solid ${allSel ? '#4CAF50' : '#ddd'}`, color: allSel ? '#2E7D32' : '#555', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                                            {allSel ? '✓ Todas seleccionadas' : 'Seleccionar todas'}
                                        </button>
                                        <span style={{ color: '#94A3B8', fontSize: 12 }}>{importSel.size} / {importPregs.length}</span>
                                    </div>

                                    {/* Question list */}
                                    {importPregs.length === 0 && (
                                        <div style={{ textAlign: 'center', padding: 20, color: '#999', border: '2px dashed #eee', borderRadius: 10 }}>No hay preguntas importables en esta selección.</div>
                                    )}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 340, overflowY: 'auto' }}>
                                        {importPregs.map((item, i) => {
                                            const sel = importSel.has(i);
                                            const q = item.q;
                                            const pregStr = (q.pregunta || q.terminoA || '').trim();
                                            const respStr = (q.respuesta || q.correcta || q.terminoB || '').trim();
                                            const tieneIncs = q.incorrectas?.some(Boolean);
                                            return (
                                                <button key={i} onClick={() => setImportSel(prev => {
                                                    const next = new Set(prev);
                                                    if (next.has(i)) next.delete(i); else next.add(i);
                                                    return next;
                                                })} style={{ background: sel ? '#F0FFF4' : 'white', border: `1.5px solid ${sel ? '#4CAF50' : '#E2E8F0'}`, borderRadius: 8, padding: '9px 12px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: 10, transition: '0.1s' }}>
                                                    <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{sel ? '☑' : '☐'}</span>
                                                    <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                                                        {hojas.length > 1 && importHojaIdx === -1 && (
                                                            <div style={{ color: '#94A3B8', fontSize: 11, marginBottom: 2 }}>{item.hoja}</div>
                                                        )}
                                                        <span style={{ color: '#1E293B' }}>{pregStr}</span>
                                                        {respStr && <span style={{ color: '#4CAF50', marginLeft: 8, fontWeight: 600 }}>→ {respStr}</span>}
                                                        {needsWrong && !tieneIncs && (
                                                            <span style={{ color: '#FF9800', fontSize: 11, marginLeft: 8 }}>⚡ incs. auto</span>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </>)}
                            </div>

                            {/* Footer */}
                            {importStep === 2 && (
                                <div style={{ padding: '12px 20px', borderTop: '1px solid #eee', display: 'flex', gap: 10, justifyContent: 'flex-end', background: '#FAFAFA', borderBottomLeftRadius: 15, borderBottomRightRadius: 15 }}>
                                    <button onClick={() => setImportModal(false)} style={{ background: '#f5f5f5', border: '1px solid #ddd', color: '#555', padding: '10px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
                                    <button onClick={confirmarImport} disabled={importGuardando || importSel.size === 0} style={{ background: importSel.size === 0 ? '#ccc' : '#FF9800', border: 'none', color: 'white', padding: '10px 22px', borderRadius: 8, cursor: importSel.size === 0 ? 'default' : 'pointer', fontWeight: 700, fontSize: 13, opacity: importGuardando ? 0.7 : 1 }}>
                                        {importGuardando ? 'Importando…' : `📥 Importar ${importSel.size} pregunta${importSel.size !== 1 ? 's' : ''}`}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })()}

            {presPickerAbiertoManual && (
                <PiKTPresentacionPicker
                    usuario={usuario}
                    presentacionId={datos.presentacion?.piktPresentacionId || ''}
                    onSelect={id => { setDatos(p => ({ ...p, presentacion: { ...(p.presentacion || {}), piktPresentacionId: id } })); setPresPickerAbiertoManual(false); }}
                    onClose={() => setPresPickerAbiertoManual(false)}
                />
            )}
        </div>
    );
}

const InputConfig = ({ label, val, set }) => (<div style={{ marginBottom: '10px' }}><label style={{ display: 'block', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>{label}</label><input value={val || ''} onChange={(e) => set(e.target.value)} style={styles.input} /></div>);

const styles = {
    overlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: '#f0f2f5', zIndex: 3000, display: 'flex', flexDirection: 'column' },
    container: { display: 'flex', flexDirection: 'column', height: '100%', width: '100%', maxWidth: '1000px', margin: '0 auto', background: 'white', boxShadow: '0 0 20px rgba(0,0,0,0.1)' },
    header: { background: '#3F51B5', padding: '10px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' },
    titleInput: { background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', fontSize: '16px', padding: '5px 10px', borderRadius: '4px', width: '90%', marginTop: '5px', outline: 'none' },
    iconBtn: { background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '5px' },
    saveBtn: { background: '#4CAF50', border: 'none', color: 'white', padding: '8px 15px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontWeight: 'bold' },
    subHeader: { background: '#e8eaf6', padding: '10px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ccc' },
    sheetSelect: { padding: '8px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '14px', flex: 1, maxWidth: '200px' },
    addSheetBtn: { background: 'white', border: '1px solid #3F51B5', color: '#3F51B5', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 'bold' },
    deleteSheetBtn: { background: '#FFEBEE', border: '1px solid #FFCDD2', color: '#C62828', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    body: { flex: 1, padding: '15px', overflowY: 'auto', background: '#f9f9f9' },
    label: { display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '13px', color: '#333' },
    input: { width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ddd', boxSizing: 'border-box', fontSize: '14px' },
    addQuestionBtn: { background: '#2196F3', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px' },
    questionsList: { display: 'flex', flexDirection: 'column', gap: '15px' },
    questionCard: { background: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #eee', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' },
    questionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
    qNumber: { fontWeight: 'bold', color: '#999', fontSize: '12px' },
    letraInput: { width: '40px', textAlign: 'center', fontSize: '16px', fontWeight: 'bold', border: '2px solid #3F51B5', borderRadius: '5px', color: '#3F51B5' },
    deleteBtn: { background: '#ffebee', color: '#c62828', border: 'none', padding: '5px', borderRadius: '4px', cursor: 'pointer' },
    inputsGrid: { display: 'flex', flexDirection: 'column', gap: '10px' },
    grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
    miniLabel: { fontSize: '11px', color: '#777', marginBottom: '2px', display: 'block', textTransform: 'uppercase' },
    configOverlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 4000 },
    configModal: { background: 'white', width: '90%', maxWidth: '400px', borderRadius: '15px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' },
    configHeader: { padding: '15px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    iconBtnBlack: { background: 'none', border: 'none', cursor: 'pointer', padding: '5px' },
    configBody: { padding: '20px', overflowY: 'auto', flex: 1 },
    sectionTitle: { margin: '20px 0 10px 0', color: '#3F51B5', borderBottom: '2px solid #eee', paddingBottom: '5px' },
    closeConfigBtn: { width: '100%', padding: '15px', background: '#333', color: 'white', border: 'none', borderBottomLeftRadius: '15px', borderBottomRightRadius: '15px', fontSize: '16px', cursor: 'pointer' },
    toggleRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', padding: '10px', background: '#f5f5f5', borderRadius: '8px' },
    toggleBtn: { width: '50px', height: '26px', borderRadius: '13px', border: 'none', padding: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.3s' },
    toggleCircle: { width: '22px', height: '22px', background: 'white', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }
};

// Estilo para las flechas (puedes ponerlo justo antes de const styles = ...)
const arrowBtn = {
    background: '#eee',
    border: 'none',
    cursor: 'pointer',
    fontSize: '10px',
    padding: '4px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: '5px'
};